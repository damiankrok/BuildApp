/**
 * v3.53.1: what the host's house reader may cost — enforced before a request leaves, for the whole host.
 *
 * Every request the reader makes (the sorting of the page's pictures as much as the description) is paid for on the
 * host's key. This is the smallest thing that bounds it for a private pilot; it is not a billing system.
 *
 *  - **A reservation, not a counter.** Before a request is sent, its conservative cost (every picture at its largest
 *    token count, the whole question, the answer at its token ceiling, at the model's list price) is added to the
 *    books inside an exclusive lock, and the request is refused if the books would pass the cumulative ceiling or the
 *    day's. Two workers cannot both take the last reservation: check and write are one critical section.
 *  - **Cumulative.** `maxUsd` is a ceiling on everything this host has ever reserved, across days and restarts.
 *    The day's ceilings (requests, descriptions) sit beside it.
 *  - **What is not known is counted in full.** A request that ended in an answer is settled down to what its usage
 *    says. One that failed, timed out, was cancelled, or whose worker died keeps its whole reservation: it may have
 *    been billed. Only a request refused before it left (no credentials) gives its reservation back.
 *  - **Never a reset.** A state file that does not parse, fails its checks or has gone missing beside its journal
 *    makes the reader unavailable until a person has looked: the books are never restarted at zero by a damaged file.
 *  - **Bounded input.** A request with more pictures, more bytes or a longer question than the limits is refused
 *    unsent; the answer's ceiling comes from the provider and is part of the reservation.
 *
 * What this cannot do: survive the loss of the whole data volume (state, backup and journal together). The provider's
 * own spend limit on the key is the backstop for that, and the deployment notes say to set one.
 * The journal holds amounts, token counts, model names and times — never a key, an address or a picture.
 */
import { appendFileSync, closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { HouseReaderUnavailable } from '@buildapp/source-vision'
import type { StructuredVision, StructuredVisionPurpose, StructuredVisionRequest } from '@buildapp/source-vision'

/** List price per million tokens; `above` is the tier that applies to a whole request whose prompt passes the threshold. */
export type ModelPrice = { inputUsdPerMTok: number; outputUsdPerMTok: number; above?: { promptTokens: number; inputUsdPerMTok: number; outputUsdPerMTok: number } }

/**
 * The provider's list prices as published on 2026-11-03 (platform.claude.com, pricing). A model that is not here has
 * no price and is never asked. When the list changes, this table changes with it — a stale low price under-reserves.
 */
export const HOUSE_READER_PRICES: Record<string, ModelPrice> = {
  'claude-haiku-5-5': { inputUsdPerMTok: 0.1, outputUsdPerMTok: 0.5, above: { promptTokens: 100_000, inputUsdPerMTok: 0.5, outputUsdPerMTok: 2.5 } },
  'claude-sonnet-5-5': { inputUsdPerMTok: 2, outputUsdPerMTok: 10 },
  'claude-opus-5-5': { inputUsdPerMTok: 4, outputUsdPerMTok: 20 },
}

export const costUsd = (price: ModelPrice, inputTokens: number, outputTokens: number): number => {
  const tier = price.above && inputTokens > price.above.promptTokens ? price.above : price
  return Math.round(((inputTokens * tier.inputUsdPerMTok + outputTokens * tier.outputUsdPerMTok) / 1e6) * 1e6) / 1e6
}

export type SpendLimits = {
  /** Cumulative ceiling, in USD, on everything reserved since the books were opened (the opening balance included). */
  maxUsd: number
  maxRequestsPerDay: number
  maxDescriptionsPerDay: number
  /** Per request: how much may be sent at all. */
  maxPictures: Record<StructuredVisionPurpose, number>
  maxPictureBytes: number
  maxTotalPictureBytes: number
  maxQuestionChars: number
}

export const DEFAULT_SPEND_LIMITS: Omit<SpendLimits, 'maxUsd'> = {
  maxRequestsPerDay: 60,
  maxDescriptionsPerDay: 20,
  maxPictures: { HOUSE_TRIAGE: 40, HOUSE_DESCRIPTION: 16 },
  maxPictureBytes: 1_500_000,
  maxTotalPictureBytes: 8_000_000,
  maxQuestionChars: 60_000,
}

/** The most tokens one picture can cost on any current model, at the sizes this analyzer sends (long edge ≤ 1568 px). */
export const TOKENS_PER_PICTURE_CEILING = 5000
/** Characters per token, taken low so that the estimate is high. */
const CHARS_PER_TOKEN = 2.5
const REQUEST_OVERHEAD_TOKENS = 1500

export type SpendState = {
  schema: 'buildapp.house-reader-spend'
  version: 1
  openedAt: string
  /** What was already spent elsewhere when the books were opened (never changed afterwards). */
  openingUsd: number
  /** Opening balance + every settled request + every reservation still standing. */
  cumulativeUsd: number
  requests: number
  descriptions: number
  day: string
  dayRequests: number
  dayDescriptions: number
  updatedAt: string
}

const round6 = (v: number): number => Math.round(v * 1e6) / 1e6
const dayOf = (now: Date): string => now.toISOString().slice(0, 10)
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0
const isAmount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0

function parseState(text: string): SpendState {
  const s = JSON.parse(text) as Partial<SpendState>
  const ok =
    s.schema === 'buildapp.house-reader-spend' && s.version === 1 && typeof s.openedAt === 'string' && isAmount(s.openingUsd) && isAmount(s.cumulativeUsd) && (s.cumulativeUsd as number) + 1e-9 >= (s.openingUsd as number) &&
    isCount(s.requests) && isCount(s.descriptions) && typeof s.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.day) && isCount(s.dayRequests) && isCount(s.dayDescriptions) && typeof s.updatedAt === 'string'
  if (!ok) throw new Error('the spend state fails its own checks')
  return s as SpendState
}

const sleepCell = new Int32Array(new SharedArrayBuffer(4))
const sleepSync = (ms: number): void => void Atomics.wait(sleepCell, 0, 0, ms)

const LOCK_WAIT_MS = 10_000
const LOCK_STALE_MS = 30_000

export class SpendLedgerError extends Error {
  constructor(
    readonly reason: 'STATE_DAMAGED' | 'STATE_MISSING' | 'LOCK_TIMEOUT',
    message: string,
  ) {
    super(message)
    this.name = 'SpendLedgerError'
  }
}

export type Reservation = { id: string; purpose: StructuredVisionPurpose; model: string; reservedUsd: number }

export type SpendLedger = {
  /** The books as they stand; throws `SpendLedgerError` where they cannot be trusted. Never creates or repairs them. */
  read(): SpendState
  /** Take `usd` out of what is left, or throw `HouseReaderUnavailable('BUDGET')`. One critical section. */
  reserve(purpose: StructuredVisionPurpose, model: string, usd: number): Reservation
  /** Replace a reservation by what the request is known to have cost. Omitted: the reservation stands in full. */
  settle(reservation: Reservation, actual: { usd: number; inputTokens?: number; outputTokens?: number } | 'NOT_SENT', note?: string): void
  remainingUsd(): number
}

/**
 * Open the books in `dir`. They are created only when nothing of them exists — no state, no backup, no journal — and
 * then at `openingUsd`. Anything else that is not a readable, valid state is an error for a person, not a fresh start.
 */
export function openSpendLedger(options: { dir: string; limits: SpendLimits; openingUsd?: number; now?: () => Date }): SpendLedger {
  const now = options.now ?? ((): Date => new Date())
  const file = join(options.dir, 'house-reader-spend.json')
  const backup = `${file}.bak`
  const journal = join(options.dir, 'house-reader-spend.journal.jsonl')
  const lock = `${file}.lock`
  const limits = options.limits

  const withLock = <T>(body: () => T): T => {
    mkdirSync(options.dir, { recursive: true })
    const deadline = Date.now() + LOCK_WAIT_MS
    for (;;) {
      try {
        const fd = openSync(lock, 'wx')
        writeFileSync(fd, `${process.pid} ${new Date().toISOString()}\n`)
        closeSync(fd)
        break
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e
        // a holder that died: its lock is taken away by exactly one of the waiters (a rename succeeds once)
        try {
          if (Date.now() - statSync(lock).mtimeMs > LOCK_STALE_MS) {
            const aside = `${lock}.stale-${randomBytes(4).toString('hex')}`
            renameSync(lock, aside)
            unlinkSync(aside)
            continue
          }
        } catch {
          // released or taken aside by another in the meantime: try again
        }
        if (Date.now() > deadline) throw new SpendLedgerError('LOCK_TIMEOUT', 'the spend books are held by another request for too long')
        sleepSync(15)
      }
    }
    try {
      return body()
    } finally {
      try {
        unlinkSync(lock)
      } catch {
        // already gone: a waiter judged this holder dead; nothing to release
      }
    }
  }

  const load = (create: boolean): SpendState => {
    if (existsSync(file)) {
      try {
        return parseState(readFileSync(file, 'utf8'))
      } catch (e) {
        throw new SpendLedgerError('STATE_DAMAGED', `the spend state cannot be read (${(e as Error).message.slice(0, 80)}): the reader stays off until a person has looked at it`)
      }
    }
    if (existsSync(backup) || existsSync(journal)) throw new SpendLedgerError('STATE_MISSING', 'the spend state is gone but its backup or journal is there: the reader stays off until a person has restored it')
    if (!create) throw new SpendLedgerError('STATE_MISSING', 'the spend books have not been opened on this host')
    const at = now().toISOString()
    const opening = round6(Math.max(0, options.openingUsd ?? 0))
    const fresh: SpendState = { schema: 'buildapp.house-reader-spend', version: 1, openedAt: at, openingUsd: opening, cumulativeUsd: opening, requests: 0, descriptions: 0, day: dayOf(now()), dayRequests: 0, dayDescriptions: 0, updatedAt: at }
    store(fresh, { event: 'OPENED', at, openingUsd: opening, maxUsd: limits.maxUsd })
    return fresh
  }

  const writeDurably = (path: string, text: string): void => {
    const tmp = `${path}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
    const fd = openSync(tmp, 'w')
    try {
      writeFileSync(fd, text)
      fsyncSync(fd)
    } finally {
      closeSync(fd)
    }
    renameSync(tmp, path)
  }

  /** The journal line first (so a state that is lost is known to be lost), then the backup, then the state. */
  const store = (state: SpendState, line: Record<string, unknown>): void => {
    appendFileSync(journal, `${JSON.stringify(line)}\n`)
    const text = `${JSON.stringify(state)}\n`
    writeDurably(backup, text)
    writeDurably(file, text)
  }

  const today = (state: SpendState): SpendState => (state.day === dayOf(now()) ? state : { ...state, day: dayOf(now()), dayRequests: 0, dayDescriptions: 0 })

  return {
    read: () => today(load(false)),
    remainingUsd: () => {
      try {
        return Math.max(0, round6(limits.maxUsd - load(false).cumulativeUsd))
      } catch {
        return 0
      }
    },
    reserve: (purpose, model, usd) =>
      withLock(() => {
        const state = today(load(true))
        const amount = round6(usd)
        const refuse = (why: string): never => {
          throw new HouseReaderUnavailable('BUDGET', why)
        }
        if (!(amount > 0)) refuse('a request with no stated cost cannot be reserved')
        if (state.cumulativeUsd + amount > limits.maxUsd + 1e-9) refuse(`this host's ceiling of ${limits.maxUsd} USD would be passed: ${state.cumulativeUsd.toFixed(4)} is on the books and this request reserves ${amount.toFixed(4)}`)
        if (state.dayRequests + 1 > limits.maxRequestsPerDay) refuse(`this host's ${limits.maxRequestsPerDay} requests for the day are used`)
        if (purpose === 'HOUSE_DESCRIPTION' && state.dayDescriptions + 1 > limits.maxDescriptionsPerDay) refuse(`this host's ${limits.maxDescriptionsPerDay} house descriptions for the day are used`)
        const at = now().toISOString()
        const id = randomBytes(8).toString('hex')
        const next: SpendState = { ...state, cumulativeUsd: round6(state.cumulativeUsd + amount), requests: state.requests + 1, descriptions: state.descriptions + (purpose === 'HOUSE_DESCRIPTION' ? 1 : 0), dayRequests: state.dayRequests + 1, dayDescriptions: state.dayDescriptions + (purpose === 'HOUSE_DESCRIPTION' ? 1 : 0), updatedAt: at }
        store(next, { event: 'RESERVED', id, at, purpose, model, reservedUsd: amount, cumulativeUsd: next.cumulativeUsd })
        return { id, purpose, model, reservedUsd: amount }
      }),
    settle: (reservation, actual, note) =>
      withLock(() => {
        const state = load(false)
        const at = now().toISOString()
        // a request known not to have left gives everything back; a known cost replaces the reservation, and is never
        // allowed to be booked BELOW zero or to hide an overrun: a cost above the reservation is booked as it is
        const cost = actual === 'NOT_SENT' ? 0 : round6(Math.max(0, actual.usd))
        const next: SpendState = { ...state, cumulativeUsd: round6(Math.max(state.openingUsd, state.cumulativeUsd - reservation.reservedUsd + cost)), updatedAt: at }
        store(next, { event: actual === 'NOT_SENT' ? 'RELEASED' : 'SETTLED', id: reservation.id, at, purpose: reservation.purpose, model: reservation.model, reservedUsd: reservation.reservedUsd, usd: cost, ...(actual !== 'NOT_SENT' ? { inputTokens: actual.inputTokens ?? null, outputTokens: actual.outputTokens ?? null } : {}), ...(note ? { note } : {}), cumulativeUsd: next.cumulativeUsd })
      }),
  }
}

/** The conservative cost of a request: what is reserved before it is sent. */
export function reservationUsd(request: Pick<StructuredVisionRequest, 'system' | 'text' | 'schema' | 'pictures'>, maxOutputTokens: number, price: ModelPrice): number {
  const textTokens = Math.ceil((request.system.length + request.text.length + JSON.stringify(request.schema).length) / CHARS_PER_TOKEN)
  const inputTokens = request.pictures.length * TOKENS_PER_PICTURE_CEILING + textTokens + REQUEST_OVERHEAD_TOKENS
  return costUsd(price, inputTokens, maxOutputTokens)
}

/**
 * The reader behind the books. A request is checked against the input limits, reserved, sent, and settled; whatever
 * goes wrong after it was sent leaves the reservation standing. A model with no stated price, or a provider that does
 * not state its answer ceiling, cannot be reserved for and is therefore never asked.
 */
export function spendGuardedStructuredVision(reader: StructuredVision, ledger: SpendLedger, options: { limits: SpendLimits; prices?: Record<string, ModelPrice> }): StructuredVision {
  const { limits } = options
  const prices = options.prices ?? HOUSE_READER_PRICES
  const modelOf = (purpose: StructuredVisionPurpose): string => (purpose === 'HOUSE_TRIAGE' ? reader.provider.triageModel : reader.provider.model)
  const configured = (): boolean => !!reader.provider.maxOutputTokens && !!prices[reader.provider.model] && !!prices[reader.provider.triageModel]
  return {
    provider: reader.provider,
    available: () => {
      if (!reader.available() || !configured()) return false
      try {
        const state = ledger.read()
        return state.cumulativeUsd < limits.maxUsd && state.dayRequests < limits.maxRequestsPerDay && state.dayDescriptions < limits.maxDescriptionsPerDay
      } catch (e) {
        // books not opened yet are opened by the first reservation; damaged or lost books keep the reader off
        return e instanceof SpendLedgerError && e.reason === 'STATE_MISSING' && /not been opened/.test(e.message)
      }
    },
    ask: async (request) => {
      const model = modelOf(request.purpose)
      const price = prices[model]
      const ceiling = reader.provider.maxOutputTokens?.[request.purpose]
      if (!price || !ceiling) throw new HouseReaderUnavailable('BUDGET', `no price or answer ceiling is stated for ${model}: a request that cannot be reserved for is not sent`)
      const tooLarge = (why: string): never => {
        throw new HouseReaderUnavailable('REQUEST_TOO_LARGE', why)
      }
      if (request.pictures.length > limits.maxPictures[request.purpose]) tooLarge(`${request.pictures.length} pictures in one ${request.purpose} request; at most ${limits.maxPictures[request.purpose]} are sent`)
      let total = 0
      for (const p of request.pictures) {
        if (p.bytes.byteLength > limits.maxPictureBytes) tooLarge(`picture ${p.number} is ${p.bytes.byteLength} bytes; at most ${limits.maxPictureBytes} are sent`)
        total += p.bytes.byteLength
      }
      if (total > limits.maxTotalPictureBytes) tooLarge(`${total} bytes of pictures in one request; at most ${limits.maxTotalPictureBytes} are sent`)
      if (request.system.length + request.text.length > limits.maxQuestionChars) tooLarge(`a question of ${request.system.length + request.text.length} characters; at most ${limits.maxQuestionChars} are sent`)
      let reservation: Reservation
      try {
        reservation = ledger.reserve(request.purpose, model, reservationUsd(request, ceiling, price))
      } catch (e) {
        if (e instanceof SpendLedgerError) throw new HouseReaderUnavailable('BUDGET', e.message)
        throw e
      }
      let answer: Awaited<ReturnType<StructuredVision['ask']>>
      try {
        answer = await reader.ask(request)
      } catch (e) {
        // not sent at all: given back. Anything else — a timeout, a dropped connection, a refusal, a cancellation —
        // may have been billed, and the reservation stands in full.
        if (e instanceof HouseReaderUnavailable && e.reason === 'NO_CREDENTIALS') ledger.settle(reservation, 'NOT_SENT')
        throw e
      }
      const { inputTokens, outputTokens } = answer.usage
      // an answer without its usage is an answer whose cost is not known: the reservation stands
      if (typeof inputTokens === 'number' && typeof outputTokens === 'number') {
        const usd = costUsd(price, inputTokens, outputTokens)
        ledger.settle(reservation, { usd, inputTokens, outputTokens })
        return { output: answer.output, usage: { ...answer.usage, estimatedCostUsd: usd } }
      }
      return answer
    },
  }
}
