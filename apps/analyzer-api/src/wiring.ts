/**
 * What the production service registers. The only place that names a
 * publisher; it names no project.
 */
import { archonAdapter, genericProjectPageAdapter } from '@buildapp/source-package'
import type { SourceAdapter } from '@buildapp/source-package'
import { anthropicStructuredVision, anthropicVisionReasoner } from '@buildapp/source-vision'
import type { AnalysisWiring } from './executor.js'

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
  ...(env.ANALYZER_HOUSE_READER === 'live' ? { houseReader: anthropicStructuredVision({ ...(env.ANALYZER_HOUSE_READER_MODEL ? { model: env.ANALYZER_HOUSE_READER_MODEL } : {}), ...(env.ANALYZER_HOUSE_TRIAGE_MODEL ? { triageModel: env.ANALYZER_HOUSE_TRIAGE_MODEL } : {}) }) } : {}),
})
