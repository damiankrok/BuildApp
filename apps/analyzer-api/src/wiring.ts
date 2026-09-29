/**
 * What the production service registers. The only place that names a
 * publisher; it names no project.
 */
import { archonAdapter, genericProjectPageAdapter } from '@buildapp/source-package'
import type { SourceAdapter } from '@buildapp/source-package'
import { anthropicVisionReasoner } from '@buildapp/source-vision'
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
})
