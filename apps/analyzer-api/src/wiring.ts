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
 * `ANALYZER_VISION=live` gives the analyzer a server-side vision provider; its
 * key is read from the server's environment by the provider and is never
 * returned by any endpoint. Anything else: the deterministic analyzer alone.
 */
export const productionWiring = (env: Record<string, string | undefined> = process.env): AnalysisWiring => ({
  adapters: productionAdapters(),
  ...(env.ANALYZER_VISION === 'live' ? { vision: anthropicVisionReasoner({}) } : {}),
  // v3.53: `ANALYZER_HOUSE_READER=live` lets a page the drawings' path refuses be read as a whole (analysis-service
  // `analyseLink`). The provider reads its key from this server's environment: no endpoint returns it and no client
  // holds it. Every request is reserved in the host's spend books before it is sent (`house-reader-spend.ts`), and a
  // job reaches the reader only when its submission carried the pilot's access token (`executeJob`).
  ...(() => {
    const plan = houseReaderPlan(env)
    if (!plan.on) return {}
    const ledger = openSpendLedger({ dir: plan.dir, limits: plan.limits, openingUsd: plan.openingUsd })
    return { houseReader: spendGuardedStructuredVision(anthropicStructuredVision({ model: plan.model, triageModel: plan.triageModel }), ledger, { limits: plan.limits }) }
  })(),
})
