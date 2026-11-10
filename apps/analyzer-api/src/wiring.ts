/**
 * What the production service registers. The only place that names a
 * publisher; it names no project.
 */
import { archonAdapter, genericProjectPageAdapter } from '@buildapp/source-package'
import type { SourceAdapter } from '@buildapp/source-package'
import { anthropicStructuredVision, anthropicVisionReasoner } from '@buildapp/source-vision'
import { join } from 'node:path'
import type { AnalysisWiring } from './executor.js'
import { cappedStructuredVision } from './house-reader-budget.js'

const maxPerDay = (value: string | undefined): number => {
  const n = value === undefined || value.trim() === '' ? NaN : Number(value)
  return Number.isInteger(n) && n >= 0 ? Math.min(n, 10_000) : 20
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
  // `analyseLink`). The key stays in this server's environment (ANTHROPIC_API_KEY): no endpoint returns it and no client
  // holds it. Each such analysis is a paid call — two requests, about 0.1–0.2 USD at the default models. Off by default.
  // A host-wide ceiling on paid descriptions per day (ANALYZER_HOUSE_READER_MAX_PER_DAY, default 20; 0 turns the
  // reader off), counted in the data directory so that it holds across restarts and worker threads.
  ...(env.ANALYZER_HOUSE_READER === 'live'
    ? { houseReader: cappedStructuredVision(anthropicStructuredVision({ ...(env.ANALYZER_HOUSE_READER_MODEL ? { model: env.ANALYZER_HOUSE_READER_MODEL } : {}), ...(env.ANALYZER_HOUSE_TRIAGE_MODEL ? { triageModel: env.ANALYZER_HOUSE_TRIAGE_MODEL } : {}) }), { file: join(env.ANALYZER_DATA_DIR?.trim() || '.data/analyzer', 'house-reader-usage.json'), maxDescriptionsPerDay: maxPerDay(env.ANALYZER_HOUSE_READER_MAX_PER_DAY) }) }
    : {}),
})
