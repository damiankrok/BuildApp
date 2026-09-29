/**
 * The source acquisition router: which adapter reads a fetched page.
 *
 * Ordered strategies, and the order is the design (BUILDPLAN-INTEGRATION-004A):
 *
 *   1. a specialist publisher adapter that recognises the address — it knows
 *      the publisher's conventions and is the strongest reader of its pages;
 *   2. a generic project-page adapter, which inspects the markup and decides
 *      whether a house project is there at all;
 *   3. an honest, typed answer when neither applies: the page is not a
 *      project, it needs a browser before its content exists, or no generic
 *      adapter is registered at all.
 *
 * Specialists are optimisers, not an allowlist. The router runs AFTER the
 * page has been fetched under the safety policy (`security.ts`, `net.ts`), so
 * an unfamiliar host means "inspect", never "refuse". A specialist is still
 * preferred for every address it recognises: a strong publisher parser is not
 * replaced by a weaker generic reading of the same page.
 */
import type { AdapterContext, SourceAdapter, SourceClassification } from './adapter.js'

export type SourceRoute =
  | { kind: 'SPECIALIST'; adapter: SourceAdapter }
  | { kind: 'GENERIC'; adapter: SourceAdapter; classification: SourceClassification }
  | { kind: 'UNSUPPORTED_CONTENT'; code: 'SOURCE_NOT_PROJECT' | 'SOURCE_REQUIRES_RENDERING'; classification: SourceClassification; adapter: SourceAdapter }
  | { kind: 'NO_ADAPTER' }

export const isSpecialist = (a: SourceAdapter): boolean => (a.strategy ?? 'SPECIALIST') === 'SPECIALIST'
export const isGeneric = (a: SourceAdapter): boolean => a.strategy === 'GENERIC'

/** The specialist that recognises this address, if one is registered. Registration order breaks ties. */
export function specialistFor(url: URL, adapters: readonly SourceAdapter[]): SourceAdapter | undefined {
  return adapters.find((a) => isSpecialist(a) && a.matches(url))
}

/** True when the registry has a generic strategy: an unfamiliar host will be inspected rather than refused. */
export const hasGenericStrategy = (adapters: readonly SourceAdapter[]): boolean => adapters.some(isGeneric)

/**
 * Whether an address can be routed at all WITHOUT fetching it. With a generic
 * adapter registered the answer is always yes for a safe address; without one
 * only a specialist's URL can be, and refusing the rest before a fetch keeps a
 * specialist-only registry (a test, a locked-down deployment) from fetching
 * pages it could never read.
 */
export const routableBeforeFetch = (url: URL, adapters: readonly SourceAdapter[]): boolean => hasGenericStrategy(adapters) || specialistFor(url, adapters) !== undefined

/**
 * Route a fetched page. `ctx.url` is the address after redirects, so a
 * specialist is matched on where the page really is; the generic adapters
 * are then asked, in registration order, and the first with a verdict
 * decides. A generic adapter that says NOT_PROJECT or REQUIRES_RENDERING
 * stops the routing with that answer: another generic adapter is not asked
 * to overrule it, because two generic readers disagreeing is not evidence
 * of a project.
 */
export function routeSourceAcquisition(ctx: AdapterContext, adapters: readonly SourceAdapter[]): SourceRoute {
  const url = new URL(ctx.url)
  const specialist = specialistFor(url, adapters)
  if (specialist) return { kind: 'SPECIALIST', adapter: specialist }
  const generic = adapters.find((a) => isGeneric(a) && a.matches(url))
  if (!generic) return { kind: 'NO_ADAPTER' }
  // A generic reader must classify: without a classifier it would read every page, so it reads none.
  if (!generic.classify) return { kind: 'NO_ADAPTER' }
  const classification = generic.classify(ctx)
  if (classification.verdict === 'PROJECT_PAGE') return { kind: 'GENERIC', adapter: generic, classification }
  return { kind: 'UNSUPPORTED_CONTENT', code: classification.verdict === 'NOT_PROJECT' ? 'SOURCE_NOT_PROJECT' : 'SOURCE_REQUIRES_RENDERING', classification, adapter: generic }
}
