/**
 * What the production service registers. The only place that names a
 * publisher; it names no project.
 */
import { archonAdapter, genericProjectPageAdapter } from '@buildapp/source-package'
import type { SourceAdapter } from '@buildapp/source-package'
import { anthropicStructuredVision, anthropicVisionReasoner } from '@buildapp/source-vision'
import { join } from 'node:path'
import type { AnalysisWiring } from './executor.js'
import { DEFAULT_SPEND_LIMITS, HOUSE_READER_PRICES, openSpendLedger, spendGuardedStructuredVision } from './house-reader-spend.js'
import { CONSULT_PRICES, HOUSE_READING_LIMITS, anthropicConsultant, fileAcceptedConsultStore, fileAcceptedStore } from '@buildapp/analysis-service'
import type { ReadingStep } from '@buildapp/analysis-service'
import type { SpendLimits } from './house-reader-spend.js'

const count = (value: string | undefined, fallback: number, max: number): number => {
  const n = value === undefined || value.trim() === '' ? NaN : Number(value)
  return Number.isInteger(n) && n >= 0 ? Math.min(n, max) : fallback
}
const amount = (value: string | undefined): number => {
  const n = value === undefined || value.trim() === '' ? NaN : Number(value)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

/**
 * Why the house reader is on or off on this host, in words an operator reads at start-up. It is on only when ALL of
 * these are set: `ANALYZER_HOUSE_READER=live`, a cumulative ceiling `ANALYZER_HOUSE_READER_MAX_USD` above what is
 * already spent, the pilot's access token, and models whose price is known. Nothing here reads the provider's key.
 */
export function houseReaderPlan(env: Record<string, string | undefined> = process.env): { on: boolean; why: string; limits: SpendLimits; openingUsd: number; dir: string; model: string; triageModel: string } {
  const limits: SpendLimits = { ...DEFAULT_SPEND_LIMITS, maxUsd: amount(env.ANALYZER_HOUSE_READER_MAX_USD), maxDescriptionsPerDay: count(env.ANALYZER_HOUSE_READER_MAX_PER_DAY, DEFAULT_SPEND_LIMITS.maxDescriptionsPerDay, 10_000), maxRequestsPerDay: count(env.ANALYZER_HOUSE_READER_MAX_REQUESTS_PER_DAY, DEFAULT_SPEND_LIMITS.maxRequestsPerDay, 30_000) }
  const model = env.ANALYZER_HOUSE_READER_MODEL?.trim() || 'claude-sonnet-5-5'
  const triageModel = env.ANALYZER_HOUSE_TRIAGE_MODEL?.trim() || 'claude-haiku-5-5'
  const plan = { limits, openingUsd: amount(env.ANALYZER_HOUSE_READER_SPENT_USD), dir: env.ANALYZER_DATA_DIR?.trim() || '.data/analyzer', model, triageModel }
  const off = (why: string) => ({ on: false, why, ...plan })
  if (env.ANALYZER_HOUSE_READER !== 'live') return off('ANALYZER_HOUSE_READER is not "live"')
  if (!(limits.maxUsd > 0)) return off('no cumulative ceiling: set ANALYZER_HOUSE_READER_MAX_USD')
  if (!(env.ANALYZER_HOUSE_READER_TOKEN ?? '').trim()) return off('no access token: set ANALYZER_HOUSE_READER_TOKEN as a secret of this host')
  if ((env.ANALYZER_HOUSE_READER_TOKEN ?? '').trim().length < 24) return off('the access token is shorter than 24 characters')
  for (const m of [model, triageModel]) if (!HOUSE_READER_PRICES[m]) return off(`no list price is known for ${m}`)
  return { on: true, why: `ceiling ${limits.maxUsd} USD cumulative (opening balance ${plan.openingUsd}), ${limits.maxDescriptionsPerDay} descriptions and ${limits.maxRequestsPerDay} requests a day`, ...plan }
}

/** Specialists first; the generic project-page reader last, so an unknown public page is inspected, not refused. */
export const productionAdapters = (): SourceAdapter[] => [archonAdapter, genericProjectPageAdapter]

/**
 * The older per-facade vision provider (`ANALYZER_VISION=live`) runs inside the drawings' path on EVERY job, for any
 * client, with no spend books and no access token. On a host anyone can reach that is an unbounded paid path, so the
 * flag alone no longer switches it on: it also needs `ANALYZER_VISION_UNBOUNDED_SPEND=accept`, which a deployment
 * recipe never sets. It has never been run against the live API from this repository.
 */
export const legacyVisionOn = (env: Record<string, string | undefined> = process.env): boolean => env.ANALYZER_VISION === 'live' && env.ANALYZER_VISION_UNBOUNDED_SPEND === 'accept'

/**
 * `ANALYZER_VISION=live` gives the analyzer a server-side vision provider; its
 * key is read from the server's environment by the provider and is never
 * returned by any endpoint. Anything else: the deterministic analyzer alone.
 */
/**
 * v3.54.2 pilot: `ANALYZER_CONSULTANT=pilot` (with the same ceiling, books and access token as the house reader) gives an
 * allowed job the consultant instead of the house reader. Off by default; the two are never on together.
 */
export function consultantPlan(env: Record<string, string | undefined> = process.env): { on: boolean; why: string } {
  if (env.ANALYZER_CONSULTANT !== 'pilot') return { on: false, why: 'ANALYZER_CONSULTANT is not "pilot"' }
  const reader = houseReaderPlan({ ...env, ANALYZER_HOUSE_READER: 'live' })
  return reader.on ? { on: true, why: 'consultant pilot on' } : { on: false, why: reader.why }
}

/**
 * v3.54.4 pilot: `ANALYZER_HOUSE_DESCRIPTION=pilot` (with the same ceiling, books and access token as the house reader)
 * gives an allowed job the whole-house description beside LOCAL. Off by default; it takes the place of the consultant
 * and of the house reader, never runs with them.
 */
export function houseDescriptionPlan(env: Record<string, string | undefined> = process.env): { on: boolean; why: string } {
  if (env.ANALYZER_HOUSE_DESCRIPTION !== 'pilot') return { on: false, why: 'ANALYZER_HOUSE_DESCRIPTION is not "pilot"' }
  const reader = houseReaderPlan({ ...env, ANALYZER_HOUSE_READER: 'live' })
  return reader.on ? { on: true, why: 'whole-house description pilot on' } : { on: false, why: reader.why }
}

export const productionWiring = (env: Record<string, string | undefined> = process.env): AnalysisWiring => ({
  adapters: productionAdapters(),
  ...(legacyVisionOn(env) ? { vision: anthropicVisionReasoner({}) } : {}),
  // v3.53: `ANALYZER_HOUSE_READER=live` lets a page the drawings' path refuses be read as a whole (analysis-service
  // `analyseLink`). The provider reads its key from this server's environment: no endpoint returns it and no client
  // holds it. Every request is reserved in the host's spend books before it is sent (`house-reader-spend.ts`), and a
  // job reaches the reader only when its submission carried the pilot's access token (`executeJob`).
  ...(() => {
    if (houseDescriptionPlan(env).on) {
      const plan = houseReaderPlan({ ...env, ANALYZER_HOUSE_READER: 'live' })
      const ledger = openSpendLedger({ dir: plan.dir, limits: plan.limits, openingUsd: plan.openingUsd })
      const transports = new Map<ReadingStep, ReturnType<typeof anthropicConsultant>>()
      return {
        houseDescription: {
          // v3.54.6 (D39): accepted revisions in the host's private data directory (hash-named files, no address or key)
          accepted: fileAcceptedStore(join(env.ANALYZER_DATA_DIR?.trim() || '.data/analyzer', 'accepted-house-revisions')),
          modelFor: (step: ReadingStep) => {
            if (!transports.has(step)) transports.set(step, anthropicConsultant({ model: plan.model, maxOutputTokens: HOUSE_READING_LIMITS.maxOutputTokens[step], timeoutMs: 300_000 }))
            return transports.get(step) as ReturnType<typeof anthropicConsultant>
          },
          price: HOUSE_READER_PRICES[plan.model],
          spend: {
            reserve: (m: string, usd: number) => {
              const r = ledger.reserve('CONSULTATION', m, usd)
              return { id: r.id, usd: r.reservedUsd }
            },
            settle: (r: { id: string; usd: number }, actual: { usd: number; inputTokens: number; outputTokens: number } | 'NOT_SENT', note?: string) => ledger.settle({ id: r.id, purpose: 'CONSULTATION', model: plan.model, reservedUsd: r.usd }, actual, note),
          },
        },
      }
    }
    // v3.54.2: the consultant pilot, when switched on, takes the place of the house reader
    if (consultantPlan(env).on) {
      const plan = houseReaderPlan({ ...env, ANALYZER_HOUSE_READER: 'live' })
      const ledger = openSpendLedger({ dir: plan.dir, limits: plan.limits, openingUsd: plan.openingUsd })
      // v3.54.15 (opt-in): `ANALYZER_STRICT_TOOLS=on` sends every answer tool strict; `ANALYZER_PROMPT_CACHE=5m|1h`
      // puts one cache breakpoint on the stable prefix (tools + system) — priced by `CONSULT_PRICES` (writes per TTL, reads)
      const strict = env.ANALYZER_STRICT_TOOLS === 'on'
      const cacheTtl: '5m' | '1h' | undefined = env.ANALYZER_PROMPT_CACHE === '5m' ? '5m' : env.ANALYZER_PROMPT_CACHE === '1h' ? '1h' : undefined
      const transportOpts = { ...(strict ? { strict: true } : {}), ...(cacheTtl ? { cache: { ttl: cacheTtl } } : {}) }
      const priceOf = (m: string) => CONSULT_PRICES[m] ?? HOUSE_READER_PRICES[m]
      const model = anthropicConsultant({ model: plan.model, ...transportOpts })
      const price = priceOf(plan.model)
      // v3.54.14: `ANALYZER_METRIC_CONSULTANT=on` adds the metric consultant (independent read of the printed dimensions,
      // check of the analyzer's readings, deterministic resolver) before the label rounds, in the same books and ceiling;
      // its model is `ANALYZER_METRIC_CONSULTANT_MODEL` (default claude-opus-5-5), refused when its price is not known
      const metricModelId = env.ANALYZER_METRIC_CONSULTANT_MODEL?.trim() || 'claude-opus-5-5'
      const modelOfReservation = new Map<string, string>()
      const metricOn = env.ANALYZER_METRIC_CONSULTANT === 'on' && Boolean(HOUSE_READER_PRICES[metricModelId])
      return {
        // v3.54.17 R2: each consulted job's requests and answers, kept whatever the job's end (private; never served)
        exchangeDir: join(env.ANALYZER_DATA_DIR?.trim() || '.data/analyzer', 'consult-exchanges'),
        consultant: {
          model,
          price,
          variant: 'C' as const,
          // v3.54.14: accepted consulted revisions in the host's private data directory (hash-named, answers only)
          accepted: { store: fileAcceptedConsultStore(join(env.ANALYZER_DATA_DIR?.trim() || '.data/analyzer', 'accepted-consulted-revisions')) },
          // v3.54.15 (measured): the metric read stays non-strict unless `ANALYZER_STRICT_METRIC=on` — under strict decoding
          // the nullable dimension-line ends came back null on Ballina twice (research and host), which loses the witness
          // that settles its scale; without strict the same read returns them (research/source-to-model/v35415/results)
          ...(metricOn ? { metricRead: 'ON' as const, metricModel: anthropicConsultant({ model: metricModelId, maxOutputTokens: 16000, timeoutMs: 300_000, effort: 'medium', ...(env.ANALYZER_STRICT_METRIC === 'on' ? transportOpts : cacheTtl ? { cache: { ttl: cacheTtl } } : {}) }), metricPrice: priceOf(metricModelId) } : {}),
          // v3.54.14: `ANALYZER_SKETCHES=on` adds the four automatic sketches (form + finish) on the same metric facts
          ...(env.ANALYZER_SKETCHES === 'on' ? { sketches: 'ON' as const, sketchModel: anthropicConsultant({ model: 'claude-sonnet-5-5', maxOutputTokens: 6000, timeoutMs: 240_000, effort: 'medium', ...transportOpts }), sketchPrice: priceOf('claude-sonnet-5-5') } : {}),
          spend: {
            reserve: (m: string, usd: number) => {
              const r = ledger.reserve('CONSULTATION', m, usd)
              modelOfReservation.set(r.id, m)
              return { id: r.id, usd: r.reservedUsd }
            },
            // the model a reservation was made for is the one it is settled under (the metric consultant may use another)
            settle: (r: { id: string; usd: number }, actual: { usd: number; inputTokens: number; outputTokens: number } | 'NOT_SENT', note?: string) => ledger.settle({ id: r.id, purpose: 'CONSULTATION', model: modelOfReservation.get(r.id) ?? plan.model, reservedUsd: r.usd }, actual, note),
          },
        },
      }
    }
    const plan = houseReaderPlan(env)
    if (!plan.on) return {}
    const ledger = openSpendLedger({ dir: plan.dir, limits: plan.limits, openingUsd: plan.openingUsd })
    // v3.54.1: `ANALYZER_HOUSE_READER_EVERY_MODEL=on` also reads a complete drawings model (one reading per allowed job)
    // and prefers the description only where it shows that model short of the house; off, as before
    return { houseReader: spendGuardedStructuredVision(anthropicStructuredVision({ model: plan.model, triageModel: plan.triageModel }), ledger, { limits: plan.limits }), ...(env.ANALYZER_HOUSE_READER_EVERY_MODEL === 'on' ? { readEveryModel: true } : {}) }
  })(),
})
