/**
 * v3.54.17 — the continuation's spend books: no new pool. The books v3.54.16 closed at 27.812357 USD; the shared ceiling stays
 * 28.854612 USD, so 1.042255 USD remain for this stage (the panel balance is not a limit). Every request reserves its worst case first and is refused when the reservation would pass the
 * ceiling; it is settled at the reported usage (a transport failure keeps its reservation as spent: unknown cost stays
 * reserved). No key is read or written here.
 *
 * v3.54.17 R2 (audit §6): the earlier version kept reservations in a process-local Map and merged entries on write, so two
 * independent clients each saw only their own reservations (the audit's probe: 0.80 + 0.80 USD accepted against 1.042255 USD).
 * Now every reservation is an entry ON DISK (`status: 'RESERVED'`), and reserve, settle and booking all read the books,
 * decide and write inside ONE exclusive lock — the host's own lock and durable write (`apps/analyzer-api/src/file-lock.ts`),
 * not a second mechanism. A reservation counts against the ceiling from the moment it is taken until it is settled, by any
 * process. Each one has an `attemptId`: reserving an attempt that is already on the books returns that reservation, and
 * settling one that is already settled changes nothing — a retry never books the same attempt twice.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { withFileLock, writeDurably } from '../../../apps/analyzer-api/src/file-lock.js'
import type { ConsultSpend } from '../../../packages/analysis-service/src/consult/loop.js'

export const ROOT = join(__dirname, '../../..')
export const LEDGER = join(ROOT, 'research/ai-assist/spend-ledger-v35417.json')
export const OPENING_USD = 27.812357
export const STAGE_CAP_USD = 1.042255
export const CEILING_USD = Math.round((OPENING_USD + STAGE_CAP_USD) * 1e6) / 1e6
export const LEDGER_VERSION = '2.0.0'

export type Entry = { at: string; phase: string; house: string; variant: string; note: string; model: string; reservedUsd: number; costUsd: number; inputTokens: number; outputTokens: number; cacheReadInputTokens?: number; cacheCreation5mInputTokens?: number; cacheCreation1hInputTokens?: number; status: 'SETTLED' | 'NOT_SENT' | 'FAILED_KEPT_RESERVED' | 'RESERVED'; attemptId?: string; pid?: number }
export type Ledger = { schema: string; currency: 'USD'; costBasis: string; billing: string; openingUsd: number; stageCapUsd: number; ceilingUsd: number; openingNote: string; entries: Entry[]; totalUsd: number; stageSpentUsd: number; requests: number; ledgerVersion?: string; openReservedUsd?: number }

const r6 = (v: number): number => Math.round(v * 1e6) / 1e6

export function loadLedger(path: string = LEDGER, opening: { openingUsd: number; ceilingUsd: number } = { openingUsd: OPENING_USD, ceilingUsd: CEILING_USD }): Ledger {
  if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8')) as Ledger
  return { schema: 'buildapp.ai-spend-ledger.v35417', currency: 'USD', costBasis: 'USAGE_PRICED (official list prices per MTok)', billing: 'NOT_RECONCILED_WITH_INVOICE', openingUsd: opening.openingUsd, stageCapUsd: r6(opening.ceilingUsd - opening.openingUsd), ceilingUsd: opening.ceilingUsd, openingNote: 'the books v3.54.16 closed at 27.812357 USD; v3.54.17 opens no new pool: the remaining pool to the shared ceiling 28.854612 USD is 1.042255 USD; replays and accepted revisions never pass through these books (0 USD, no request)', entries: [], totalUsd: opening.openingUsd, stageSpentUsd: 0, requests: 0 }
}

/** Spent (settled and failed-kept) plus every reservation still standing: what the ceiling is held against. */
export function committedUsd(l: Ledger): number {
  return r6(l.openingUsd + l.entries.reduce((s, e) => s + (e.status === 'RESERVED' ? e.reservedUsd : e.costUsd), 0))
}

function restate(l: Ledger): Ledger {
  const settled = l.entries.filter((e) => e.status !== 'RESERVED')
  l.totalUsd = r6(l.openingUsd + settled.reduce((s, e) => s + e.costUsd, 0))
  l.stageSpentUsd = r6(l.totalUsd - l.openingUsd)
  l.requests = settled.filter((e) => e.status !== 'NOT_SENT').length
  l.openReservedUsd = r6(l.entries.filter((e) => e.status === 'RESERVED').reduce((s, e) => s + e.reservedUsd, 0))
  l.ledgerVersion = LEDGER_VERSION
  return l
}

/** Read, change and write the books inside the one lock: the only way any of these functions touches the file. */
export function underLock<T>(path: string, change: (l: Ledger) => T, opening?: { openingUsd: number; ceilingUsd: number }): T {
  return withFileLock(`${path}.lock`, () => {
    const l = loadLedger(path, opening)
    const out = change(l)
    writeDurably(path, `${JSON.stringify(restate(l), null, 1)}\n`)
    return out
  })
}

export class LedgerRefusal extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LedgerRefusal'
  }
}

export type LedgerSpend = ConsultSpend & {
  /** Reserve under a caller's attempt id: the same id again returns the reservation already on the books. */
  reserveAttempt(attemptId: string, model: string, usd: number, note: string): { id: string; usd: number }
  /** What this client has reserved and not settled (from the books, not from memory). */
  open(): number
}

export function ledgerSpend(context: { phase: string; house: string; variant: string }, options: { path?: string; openingUsd?: number; ceilingUsd?: number } = {}): LedgerSpend {
  const path = options.path ?? LEDGER
  const opening = { openingUsd: options.openingUsd ?? OPENING_USD, ceilingUsd: options.ceilingUsd ?? CEILING_USD }
  const mine = new Set<string>()
  const reserveAttempt = (attemptId: string, model: string, usd: number, note: string): { id: string; usd: number } =>
    underLock(path, (l) => {
      const existing = l.entries.find((e) => e.attemptId === attemptId)
      if (existing) return { id: attemptId, usd: existing.reservedUsd }
      const amount = r6(usd)
      const standing = committedUsd(l)
      if (standing + amount > l.ceilingUsd + 1e-9) throw new LedgerRefusal(`a reservation of ${amount.toFixed(4)} USD would pass the ceiling ${l.ceilingUsd} (spent and reserved by every client: ${standing.toFixed(6)}): not sent`)
      l.entries.push({ at: new Date().toISOString(), phase: context.phase, house: context.house, variant: context.variant, note, model, reservedUsd: amount, costUsd: 0, inputTokens: 0, outputTokens: 0, status: 'RESERVED', attemptId, pid: process.pid })
      mine.add(attemptId)
      return { id: attemptId, usd: amount }
    }, opening)
  return {
    reserveAttempt,
    reserve: (model, usd, note) => reserveAttempt(`a-${randomBytes(8).toString('hex')}`, model, usd, note),
    open: () => r6(loadLedger(path, opening).entries.filter((e) => e.status === 'RESERVED' && mine.has(e.attemptId ?? '')).reduce((s, e) => s + e.reservedUsd, 0)),
    settle(reservation, actual, note) {
      underLock(path, (l) => {
        const e = l.entries.find((x) => x.attemptId === reservation.id)
        // settled already (a retry of the settlement): nothing changes; unknown to the books: booked as found, never twice
        if (e && e.status !== 'RESERVED') return
        const base: Entry = e ?? { at: new Date().toISOString(), phase: context.phase, house: context.house, variant: context.variant, note: '', model: '?', reservedUsd: r6(reservation.usd), costUsd: 0, inputTokens: 0, outputTokens: 0, status: 'RESERVED', attemptId: reservation.id }
        if (!e) l.entries.push(base)
        base.at = new Date().toISOString()
        if (note) base.note = `${base.note} (${note})`
        if (actual === 'NOT_SENT') Object.assign(base, { costUsd: 0, inputTokens: 0, outputTokens: 0, status: 'NOT_SENT' })
        else {
          // a transport failure is settled at its reservation with no tokens (`loop.ts`); an answered request always has tokens
          const tokens = actual.inputTokens + actual.outputTokens + (actual.cacheReadInputTokens ?? 0) + (actual.cacheCreation5mInputTokens ?? 0) + (actual.cacheCreation1hInputTokens ?? 0)
          if (tokens === 0 && actual.usd === 0) Object.assign(base, { costUsd: 0, inputTokens: 0, outputTokens: 0, status: 'NOT_SENT', note: `${base.note} — replayed answer: no request left the process` })
          else Object.assign(base, { costUsd: r6(actual.usd), inputTokens: actual.inputTokens, outputTokens: actual.outputTokens, ...(actual.cacheReadInputTokens !== undefined ? { cacheReadInputTokens: actual.cacheReadInputTokens } : {}), ...(actual.cacheCreation5mInputTokens !== undefined ? { cacheCreation5mInputTokens: actual.cacheCreation5mInputTokens } : {}), ...(actual.cacheCreation1hInputTokens !== undefined ? { cacheCreation1hInputTokens: actual.cacheCreation1hInputTokens } : {}), status: tokens === 0 ? 'FAILED_KEPT_RESERVED' : 'SETTLED' })
        }
      }, opening)
    },
  }
}
