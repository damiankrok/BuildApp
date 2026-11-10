/**
 * v3.53.1: what the host's paid reader may cost is enforced before a request leaves — with a stand-in reader, so that
 * nothing here is paid for. The cases are the ones a counter gets wrong: two workers on the last reservation, requests
 * that fail, a damaged or missing state, a restart, a ceiling that spans days.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { build } from 'esbuild'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { HouseReaderUnavailable } from '@buildapp/source-vision'
import type { StructuredVision, StructuredVisionRequest } from '@buildapp/source-vision'
import { DEFAULT_SPEND_LIMITS, SpendLedgerError, costUsd, openSpendLedger, reservationUsd, spendGuardedStructuredVision } from '../src/house-reader-spend.js'
import type { SpendLimits } from '../src/house-reader-spend.js'
import { houseReaderPlan, legacyVisionOn, productionWiring } from '../src/wiring.js'
import { loadConfig } from '../src/config.js'
import { pilotAccess } from '../src/http.js'

const dirs: string[] = []
const fresh = (): string => {
  const d = mkdtempSync(join(tmpdir(), 'house-reader-spend-'))
  dirs.push(d)
  return d
}
const keep = new Set<string>()
afterEach(() => {
  for (const d of dirs.splice(0)) if (!keep.has(d)) rmSync(d, { recursive: true, force: true })
})

const limits = (over: Partial<SpendLimits> = {}): SpendLimits => ({ ...DEFAULT_SPEND_LIMITS, maxUsd: 1, ...over })
const PRICES = { m: { inputUsdPerMTok: 2, outputUsdPerMTok: 10 }, t: { inputUsdPerMTok: 0.1, outputUsdPerMTok: 0.5 } }
const picture = (n: number, bytes = 1000) => ({ number: n, bytes: new Uint8Array(bytes), mediaType: 'image/jpeg' })
const request = (purpose: StructuredVisionRequest['purpose'], pictures = 2): StructuredVisionRequest => ({ purpose, system: 'sys', text: 'question', schema: { type: 'object' } as never, pictures: Array.from({ length: pictures }, (_, i) => picture(i + 1)) })

/** A reader that never reaches a provider: it answers, fails or times out as told, and counts what it was asked. */
function standIn(behaviour: (r: StructuredVisionRequest, n: number) => Promise<{ inputTokens?: number; outputTokens?: number }> = async () => ({ inputTokens: 1000, outputTokens: 500 })): StructuredVision & { asked: string[] } {
  const asked: string[] = []
  return {
    asked,
    provider: { id: 'stand-in', model: 'm', triageModel: 't', version: 'test', maxOutputTokens: { HOUSE_TRIAGE: 1000, HOUSE_DESCRIPTION: 4000 }, requestTimeoutMs: 1000 },
    available: () => true,
    ask: async (r) => {
      asked.push(r.purpose)
      const usage = await behaviour(r, asked.length)
      return { output: {}, usage: { ...usage, latencyMs: 1, model: r.purpose === 'HOUSE_TRIAGE' ? 't' : 'm' } }
    },
  }
}

const journalOf = (dir: string): Array<Record<string, unknown>> => readFileSync(join(dir, 'house-reader-spend.journal.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as Record<string, unknown>)

describe('a reservation is taken before the request, and settled to what the request cost', () => {
  it('reserves the conservative cost, then books the usage the answer states', async () => {
    const dir = fresh()
    const ledger = openSpendLedger({ dir, limits: limits() })
    const reader = standIn()
    const guarded = spendGuardedStructuredVision(reader, ledger, { limits: limits(), prices: PRICES })
    const r = request('HOUSE_DESCRIPTION')
    const reserved = reservationUsd(r, 4000, PRICES.m)
    expect(reserved).toBeGreaterThan(0.06) // two pictures at their ceiling and the whole answer: far above the real cost
    const answer = await guarded.ask(r)
    expect(answer.usage.estimatedCostUsd).toBe(costUsd(PRICES.m, 1000, 500))
    expect(ledger.read().cumulativeUsd).toBe(0.007)
    expect(journalOf(dir).map((l) => l.event)).toEqual(['OPENED', 'RESERVED', 'SETTLED'])
    expect(journalOf(dir)[1].reservedUsd).toBe(reserved)
  })

  it('a request that would pass the cumulative ceiling is not sent', async () => {
    const dir = fresh()
    const l = limits({ maxUsd: 0.05 })
    const reader = standIn()
    const guarded = spendGuardedStructuredVision(reader, openSpendLedger({ dir, limits: l }), { limits: l, prices: PRICES })
    const e = await guarded.ask(request('HOUSE_DESCRIPTION')).catch((x: unknown) => x)
    expect(e).toBeInstanceOf(HouseReaderUnavailable)
    expect((e as HouseReaderUnavailable).reason).toBe('BUDGET')
    expect(reader.asked).toEqual([])
  })

  it('the ceiling is cumulative: it holds across days, where the day\'s counts start again', async () => {
    const dir = fresh()
    let today = new Date('2026-03-01T10:00:00Z')
    const l = limits({ maxUsd: 0.02, maxDescriptionsPerDay: 1 })
    const ledger = openSpendLedger({ dir, limits: l, now: () => today })
    const reader = standIn()
    const guarded = spendGuardedStructuredVision(reader, ledger, { limits: l, prices: { m: { inputUsdPerMTok: 0.2, outputUsdPerMTok: 1 }, t: PRICES.t } })
    await guarded.ask(request('HOUSE_DESCRIPTION'))
    // the same day: the day's one description is used
    expect(((await guarded.ask(request('HOUSE_DESCRIPTION')).catch((x: unknown) => x)) as HouseReaderUnavailable).message).toMatch(/descriptions for the day/)
    today = new Date('2026-03-02T10:00:00Z')
    expect(ledger.read().dayDescriptions).toBe(0)
    await guarded.ask(request('HOUSE_DESCRIPTION'))
    today = new Date('2026-03-03T10:00:00Z')
    await guarded.ask(request('HOUSE_DESCRIPTION'))
    // three settled requests of 0.0007 each: 0.0021 on the books, and the next reservation (0.0063) still fits; shrink the ceiling to see it bite
    const tight = spendGuardedStructuredVision(reader, openSpendLedger({ dir, limits: { ...l, maxUsd: 0.005 }, now: () => new Date('2026-03-09T10:00:00Z') }), { limits: { ...l, maxUsd: 0.005 }, prices: { m: { inputUsdPerMTok: 0.2, outputUsdPerMTok: 1 }, t: PRICES.t } })
    expect(((await tight.ask(request('HOUSE_DESCRIPTION')).catch((x: unknown) => x)) as HouseReaderUnavailable).reason).toBe('BUDGET')
    expect(reader.asked).toHaveLength(3)
  })
})

describe('what is not known to be free is counted', () => {
  it('three failed sortings use three requests and keep their reservations in full', async () => {
    const dir = fresh()
    const l = limits({ maxRequestsPerDay: 3 })
    const ledger = openSpendLedger({ dir, limits: l })
    const reader = standIn(async () => {
      throw new HouseReaderUnavailable('TRANSPORT', 'connection reset')
    })
    const guarded = spendGuardedStructuredVision(reader, ledger, { limits: l, prices: PRICES })
    for (let i = 0; i < 3; i++) expect(((await guarded.ask(request('HOUSE_TRIAGE', 10)).catch((x: unknown) => x)) as HouseReaderUnavailable).reason).toBe('TRANSPORT')
    const each = reservationUsd(request('HOUSE_TRIAGE', 10), 1000, PRICES.t)
    expect(ledger.read().dayRequests).toBe(3)
    expect(ledger.read().cumulativeUsd).toBeCloseTo(3 * each, 6)
    // the fourth is refused by the books, unsent
    expect(((await guarded.ask(request('HOUSE_TRIAGE', 10)).catch((x: unknown) => x)) as HouseReaderUnavailable).reason).toBe('BUDGET')
    expect(reader.asked).toHaveLength(3)
    expect(guarded.available()).toBe(false)
  })

  it('a timeout, a cancellation and an answer without its usage all leave the reservation standing', async () => {
    const dir = fresh()
    const ledger = openSpendLedger({ dir, limits: limits() })
    const reader = standIn(async (_r, n) => {
      if (n === 1) throw new HouseReaderUnavailable('TRANSPORT', 'Request timed out.')
      if (n === 2) throw new DOMException('aborted', 'AbortError')
      return {}
    })
    const guarded = spendGuardedStructuredVision(reader, ledger, { limits: limits(), prices: PRICES })
    const each = reservationUsd(request('HOUSE_DESCRIPTION'), 4000, PRICES.m)
    await guarded.ask(request('HOUSE_DESCRIPTION')).catch(() => undefined)
    await guarded.ask(request('HOUSE_DESCRIPTION')).catch(() => undefined)
    await guarded.ask(request('HOUSE_DESCRIPTION'))
    expect(ledger.read().cumulativeUsd).toBeCloseTo(3 * each, 6)
    expect(journalOf(dir).filter((l) => l.event === 'SETTLED' || l.event === 'RELEASED')).toEqual([])
  })

  it('a request the provider refused before running a model (a bad key, a rate limit) gives its reservation back; a server error does not', async () => {
    const dir = fresh()
    const ledger = openSpendLedger({ dir, limits: limits() })
    const reader = standIn(async (_r, n) => {
      throw new HouseReaderUnavailable(n === 1 ? 'REJECTED_UNBILLED' : 'TRANSPORT', n === 1 ? 'HTTP 401: invalid x-api-key' : 'HTTP 529: overloaded')
    })
    const guarded = spendGuardedStructuredVision(reader, ledger, { limits: limits(), prices: PRICES })
    await guarded.ask(request('HOUSE_DESCRIPTION')).catch(() => undefined)
    expect(ledger.read().cumulativeUsd).toBe(0)
    await guarded.ask(request('HOUSE_DESCRIPTION')).catch(() => undefined)
    expect(ledger.read().cumulativeUsd).toBe(reservationUsd(request('HOUSE_DESCRIPTION'), 4000, PRICES.m))
    // both count as requests of the day: a host that keeps being refused does not keep trying for free
    expect(ledger.read().dayRequests).toBe(2)
  })

  it('only a request that never left gives its reservation back', async () => {
    const dir = fresh()
    const ledger = openSpendLedger({ dir, limits: limits() })
    const guarded = spendGuardedStructuredVision(standIn(async () => {
      throw new HouseReaderUnavailable('NO_CREDENTIALS', 'no key on this host')
    }), ledger, { limits: limits(), prices: PRICES })
    await guarded.ask(request('HOUSE_DESCRIPTION')).catch(() => undefined)
    expect(ledger.read().cumulativeUsd).toBe(0)
    expect(journalOf(dir).map((l) => l.event)).toEqual(['OPENED', 'RESERVED', 'RELEASED'])
  })
})

describe('the input is bounded before anything is reserved', () => {
  it('too many pictures, a picture too large, too many bytes or too long a question are refused unsent and unbooked', async () => {
    const dir = fresh()
    const l = limits({ maxPictureBytes: 5000, maxTotalPictureBytes: 12_000, maxQuestionChars: 100 })
    const ledger = openSpendLedger({ dir, limits: l })
    const reader = standIn()
    const guarded = spendGuardedStructuredVision(reader, ledger, { limits: l, prices: PRICES })
    const cases: StructuredVisionRequest[] = [
      request('HOUSE_DESCRIPTION', 17),
      { ...request('HOUSE_DESCRIPTION'), pictures: [picture(1, 6000)] },
      { ...request('HOUSE_DESCRIPTION'), pictures: [picture(1, 4500), picture(2, 4500), picture(3, 4500)] },
      { ...request('HOUSE_DESCRIPTION'), text: 'x'.repeat(200) },
    ]
    for (const c of cases) expect(((await guarded.ask(c).catch((x: unknown) => x)) as HouseReaderUnavailable).reason).toBe('REQUEST_TOO_LARGE')
    expect(reader.asked).toEqual([])
    expect(existsSync(join(dir, 'house-reader-spend.json'))).toBe(false)
  })

  it('a model with no stated price, or a provider with no stated answer ceiling, is never asked', async () => {
    const dir = fresh()
    const reader = standIn()
    const noPrice = spendGuardedStructuredVision(reader, openSpendLedger({ dir, limits: limits() }), { limits: limits(), prices: { t: PRICES.t } })
    expect(noPrice.available()).toBe(false)
    expect(((await noPrice.ask(request('HOUSE_DESCRIPTION')).catch((x: unknown) => x)) as HouseReaderUnavailable).reason).toBe('BUDGET')
    const { maxOutputTokens: _m, ...bare } = reader.provider
    const noCeiling = spendGuardedStructuredVision({ ...reader, provider: bare }, openSpendLedger({ dir, limits: limits() }), { limits: limits(), prices: PRICES })
    expect(noCeiling.available()).toBe(false)
    expect(reader.asked).toEqual([])
  })
})

describe('the books are never restarted by a damaged or missing state', () => {
  const spendOnce = async (dir: string): Promise<number> => {
    const ledger = openSpendLedger({ dir, limits: limits() })
    await spendGuardedStructuredVision(standIn(), ledger, { limits: limits(), prices: PRICES }).ask(request('HOUSE_DESCRIPTION'))
    return ledger.read().cumulativeUsd
  }

  it('a restart reads the books where they were left', async () => {
    const dir = fresh()
    const before = await spendOnce(dir)
    const again = openSpendLedger({ dir, limits: limits() })
    expect(again.read().cumulativeUsd).toBe(before)
    expect(again.read().requests).toBe(1)
  })

  it('a state that does not parse, or fails its checks, keeps the reader off — it is not replaced by zero', async () => {
    for (const damage of ['{"schema":"buildapp.house-reader-spend","version":1,"cumu', '{}', JSON.stringify({ schema: 'buildapp.house-reader-spend', version: 1, openedAt: 'x', openingUsd: 0, cumulativeUsd: -1, requests: 0, descriptions: 0, day: '2026-03-01', dayRequests: 0, dayDescriptions: 0, updatedAt: 'x' })]) {
      const dir = fresh()
      await spendOnce(dir)
      writeFileSync(join(dir, 'house-reader-spend.json'), damage)
      const ledger = openSpendLedger({ dir, limits: limits() })
      expect(() => ledger.read()).toThrow(SpendLedgerError)
      const reader = standIn()
      const guarded = spendGuardedStructuredVision(reader, ledger, { limits: limits(), prices: PRICES })
      expect(guarded.available()).toBe(false)
      expect(((await guarded.ask(request('HOUSE_DESCRIPTION')).catch((x: unknown) => x)) as HouseReaderUnavailable).reason).toBe('BUDGET')
      expect(reader.asked).toEqual([])
      expect(readFileSync(join(dir, 'house-reader-spend.json'), 'utf8')).toBe(damage)
      expect(ledger.remainingUsd()).toBe(0)
    }
  })

  it('a state that has gone missing beside its journal keeps the reader off', async () => {
    const dir = fresh()
    await spendOnce(dir)
    unlinkSync(join(dir, 'house-reader-spend.json'))
    const reader = standIn()
    const guarded = spendGuardedStructuredVision(reader, openSpendLedger({ dir, limits: limits() }), { limits: limits(), prices: PRICES })
    expect(guarded.available()).toBe(false)
    await guarded.ask(request('HOUSE_DESCRIPTION')).catch(() => undefined)
    expect(reader.asked).toEqual([])
    expect(existsSync(join(dir, 'house-reader-spend.json'))).toBe(false)
  })

  it('books opened with what was already spent elsewhere start there, and only once', async () => {
    const dir = fresh()
    const l = limits({ maxUsd: 5 })
    const ledger = openSpendLedger({ dir, limits: l, openingUsd: 2.72807938 })
    await spendGuardedStructuredVision(standIn(), ledger, { limits: l, prices: PRICES }).ask(request('HOUSE_DESCRIPTION'))
    expect(ledger.read().openingUsd).toBe(2.728079)
    expect(ledger.read().cumulativeUsd).toBeCloseTo(2.735079, 6)
    // a later start with another opening figure does not move books that exist
    expect(openSpendLedger({ dir, limits: l, openingUsd: 0 }).read().cumulativeUsd).toBeCloseTo(2.735079, 6)
    expect(ledger.remainingUsd()).toBeCloseTo(5 - 2.735079, 6)
  })
})

describe('two workers cannot both take the last reservation', () => {
  // A separate PROCESS per taker — the strongest form of "another worker". The books' code is bundled once, as the
  // service's own build bundles it, and each taker is a plain `node` run of that bundle.
  let taker = ''
  beforeAll(async () => {
    const out = fresh()
    keep.add(out)
    taker = join(out, 'taker.mjs')
    const entry = join(out, 'entry.ts')
    writeFileSync(entry, `import { openSpendLedger } from ${JSON.stringify(join(import.meta.dirname, '../src/house-reader-spend.ts'))}\nconst [dir, limits, usd, purpose] = process.argv.slice(2)\ntry { openSpendLedger({ dir, limits: JSON.parse(limits) }).reserve(purpose as never, 'm', Number(usd)); console.log(JSON.stringify({ ok: true })) } catch (e) { console.log(JSON.stringify({ ok: false, reason: (e as { reason?: string }).reason ?? (e as Error).name })) }\n`)
    await build({ entryPoints: [entry], outfile: taker, bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'silent', banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" } })
  }, 120_000)
  const inProcess = (dir: string, l: SpendLimits, usd: number, purpose: string): Promise<{ ok: boolean; reason?: string }> =>
    new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [taker, dir, JSON.stringify(l), String(usd), purpose], { stdio: ['ignore', 'pipe', 'pipe'] })
      let out = ''
      let err = ''
      child.stdout.on('data', (d) => (out += String(d)))
      child.stderr.on('data', (d) => (err += String(d)))
      child.on('error', reject)
      child.on('close', () => {
        try {
          resolve(JSON.parse(out.trim().split('\n').pop() ?? '') as { ok: boolean; reason?: string })
        } catch {
          reject(new Error(`taker printed ${JSON.stringify(out)} ${err.slice(0, 400)}`))
        }
      })
    })

  it('twelve processes on books with room for five: exactly five reservations, and the books say five', async () => {
    const dir = fresh()
    const l = limits({ maxUsd: 0.5, maxRequestsPerDay: 100 })
    const results = await Promise.all(Array.from({ length: 12 }, () => inProcess(dir, l, 0.1, 'HOUSE_TRIAGE')))
    expect(results.filter((r) => r.ok)).toHaveLength(5)
    expect(results.filter((r) => !r.ok).every((r) => r.reason === 'BUDGET')).toBe(true)
    const state = openSpendLedger({ dir, limits: l }).read()
    expect(state.requests).toBe(5)
    expect(state.cumulativeUsd).toBeCloseTo(0.5, 6)
    expect(journalOf(dir).filter((x) => x.event === 'RESERVED')).toHaveLength(5)
  }, 120_000)

  it('at a day limit of one description, two concurrent takers: one is asked, one is refused', async () => {
    const dir = fresh()
    const l = limits({ maxUsd: 10, maxDescriptionsPerDay: 1 })
    const results = await Promise.all([inProcess(dir, l, 0.1, 'HOUSE_DESCRIPTION'), inProcess(dir, l, 0.1, 'HOUSE_DESCRIPTION'), inProcess(dir, l, 0.1, 'HOUSE_DESCRIPTION')])
    expect(results.filter((r) => r.ok)).toHaveLength(1)
    expect(openSpendLedger({ dir, limits: l }).read().dayDescriptions).toBe(1)
  }, 60_000)

  it('concurrent requests in one process: the guard sends exactly as many as the books allow', async () => {
    const dir = fresh()
    const each = reservationUsd(request('HOUSE_DESCRIPTION'), 4000, PRICES.m)
    const l = limits({ maxUsd: each * 2.5 })
    const reader = standIn(async () => {
      await new Promise((r) => setTimeout(r, 20))
      return {}
    })
    const guarded = spendGuardedStructuredVision(reader, openSpendLedger({ dir, limits: l }), { limits: l, prices: PRICES })
    const settled = await Promise.allSettled(Array.from({ length: 6 }, () => guarded.ask(request('HOUSE_DESCRIPTION'))))
    expect(settled.filter((s) => s.status === 'fulfilled')).toHaveLength(2)
    expect(reader.asked).toHaveLength(2)
  })
})

describe('who may reach the paid reader, and when it is on at all', () => {
  const on = { ANALYZER_HOUSE_READER: 'live', ANALYZER_HOUSE_READER_MAX_USD: '2', ANALYZER_HOUSE_READER_TOKEN: 'a-long-enough-pilot-token-0123456789' }
  it('the reader is on only with a cumulative ceiling, an access token and models whose price is known', () => {
    expect(houseReaderPlan({}).on).toBe(false)
    expect(houseReaderPlan(on).on).toBe(true)
    expect(houseReaderPlan({ ...on, ANALYZER_HOUSE_READER_MAX_USD: undefined }).why).toMatch(/ceiling/)
    expect(houseReaderPlan({ ...on, ANALYZER_HOUSE_READER_MAX_USD: '0' }).on).toBe(false)
    expect(houseReaderPlan({ ...on, ANALYZER_HOUSE_READER_TOKEN: '' }).why).toMatch(/access token/)
    expect(houseReaderPlan({ ...on, ANALYZER_HOUSE_READER_TOKEN: 'short' }).on).toBe(false)
    expect(houseReaderPlan({ ...on, ANALYZER_HOUSE_READER_MODEL: 'a-model-nobody-priced' }).why).toMatch(/no list price/)
    // the plan never carries the token
    expect(JSON.stringify(houseReaderPlan(on))).not.toContain(on.ANALYZER_HOUSE_READER_TOKEN)
  })
  it('the older per-facade vision provider, which has no books and no token, is not switched on by its flag alone', () => {
    expect(legacyVisionOn({ ANALYZER_VISION: 'live' })).toBe(false)
    expect(productionWiring({ ANALYZER_VISION: 'live' }).vision).toBeUndefined()
    expect(loadConfig({ ANALYZER_VISION: 'live' }).vision).toBe('deterministic')
    expect(legacyVisionOn({ ANALYZER_VISION: 'live', ANALYZER_VISION_UNBOUNDED_SPEND: 'accept' })).toBe(true)
    expect(loadConfig({ ANALYZER_VISION: 'live', ANALYZER_VISION_UNBOUNDED_SPEND: 'accept' }).vision).toBe('live')
  })
  it('with nothing configured the production wiring holds no reader of any kind', () => {
    const w = productionWiring({})
    expect(w.houseReader).toBeUndefined()
    expect(w.vision).toBeUndefined()
    expect(loadConfig({ ANALYZER_HOUSE_READER_TOKEN: 'a-token-without-the-switch-0123456789' }).houseReaderToken).toBe('')
  })
  it('a submission is granted only with the host\'s token; a wrong one is named, none is the free path', () => {
    const token = on.ANALYZER_HOUSE_READER_TOKEN
    expect(pilotAccess(undefined, token)).toBe('NONE')
    expect(pilotAccess(`Bearer ${token}`, token)).toBe('GRANTED')
    expect(pilotAccess(`bearer   ${token} `, token)).toBe('GRANTED')
    expect(pilotAccess('Bearer something-else', token)).toBe('WRONG')
    expect(pilotAccess(`Bearer ${token}`, '')).toBe('WRONG')
    expect(pilotAccess('Basic abc', token)).toBe('NONE')
  })
})
