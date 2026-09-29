/**
 * The generic public project-page adapter.
 *
 * Asked only when no specialist recognises an address (`router.ts`), it
 * reads a fetched page for what it states and what it shows, decides whether
 * a house project is there, and — when one is — discovers its drawings,
 * classifies them by the words around them and reads the published figures.
 * It knows no publisher, no hostname and no project: point it at a page on
 * a site it has never seen and it does what the markup lets it do, and says
 * what it could not.
 *
 * It runs on the phone as it runs here: no API key, no remote model, no
 * browser, no script execution. JSON-LD is parsed as data.
 */
import { channelClaims } from '../../adapter.js'
import type { AdapterContext, ProjectIdentity, SourceAdapter, SourceClassification } from '../../adapter.js'
import type { DiscoveredCandidate } from '../../discovery.js'
import type { RoleClaim } from '../../roles.js'
import { compareCodeUnits, deaccent } from '../../text.js'
import { discoverOnDocument, drawingLinks, sizeStem, type DroppedCandidate } from './assets.js'
import { classifyProjectPage } from './classify.js'
import { jsonLdStrings, readPageFacts, type PageFacts } from './markup.js'
import { genericFacts, genericRooms, genericSpecifications } from './published.js'
import { ANNOTATION_WORDS, DOCUMENT_WORDS, STOREY_WORDS, VIEW_WORDS, firstMatch, type WordRule } from './vocabulary.js'

export const GENERIC_ADAPTER_ID = 'generic.project-page'
export const GENERIC_ADAPTER_VERSION = '1.0.0'

/** Read once per page: the facts are pure in the markup, so the same markup gives the same facts. */
const factsCache = new WeakMap<AdapterContext, PageFacts>()
const factsOf = (ctx: AdapterContext): PageFacts => {
  let f = factsCache.get(ctx)
  if (!f) {
    f = readPageFacts(ctx.html, ctx.url)
    factsCache.set(ctx, f)
  }
  return f
}

/** The site's name is what a title repeats after its separator; the project's name is what comes before. */
function projectName(facts: PageFacts): string | undefined {
  const candidates = [facts.ogTitle, facts.h1, facts.title].filter((t): t is string => !!t && t.trim() !== '')
  if (candidates.length === 0) return undefined
  const raw = candidates[0].trim()
  const parts = raw.split(/\s+\|\s+/)
  const name = parts.length > 1 ? parts.slice(0, -1).join(' | ') : raw
  return name.trim() || undefined
}

/**
 * The publisher's own identifier for the page, when it states one: a
 * structured-data sku or product id, or an opaque hexadecimal token of at
 * least ten characters in the page's own path. Absent otherwise — an
 * identity is then derived from the canonical address, which is stable and
 * is never a job id or a time.
 */
function externalId(facts: PageFacts): string | undefined {
  const structured = jsonLdStrings(facts.jsonLd, ['sku', 'productID', 'mpn'])
  if (structured.length > 0) return structured[0].trim() || undefined
  try {
    const path = new URL(facts.url).pathname
    for (const segment of path.split(/[/,;]/)) {
      if (/^[a-z]{0,2}[0-9a-f]{10,}$/i.test(segment)) return segment
    }
  } catch {
    // not a URL: no id
  }
  return undefined
}

const apply = (claims: RoleClaim[], rules: readonly WordRule[], text: string | undefined, scale: number, signal: string): void => {
  if (!text) return
  const hit = firstMatch(rules, text)
  if (!hit) return
  claims.push({ ...hit.rule.claim, signal, detail: `${hit.rule.why} (matched "${hit.matched}" in "${text.slice(0, 80)}")`, confidence: Math.round(hit.rule.confidence * scale * 100) / 100 })
}

/** The descriptive part of a filename, folded and with separators as spaces. */
const fileWords = (url: string): string => {
  const file = decodeURIComponent(url.split('/').pop() ?? '').replace(/\.[a-z0-9]+$/i, '')
  return deaccent(file).replace(/[-_.+]+/g, ' ')
}

export function genericRoleClaims(candidate: DiscoveredCandidate): RoleClaim[] {
  const claims: RoleClaim[] = [...channelClaims(candidate.channel)]
  const file = fileWords(candidate.url)
  const caption = candidate.caption
  const context = candidate.context
  // A filename is the publisher's filing; a caption is prose about the picture; a heading above it is context.
  apply(claims, DOCUMENT_WORDS, file, 1, 'url-slug')
  apply(claims, STOREY_WORDS, file, 1, 'url-slug')
  apply(claims, VIEW_WORDS, file, 1, 'url-slug')
  apply(claims, ANNOTATION_WORDS, file, 1, 'url-slug')
  apply(claims, DOCUMENT_WORDS, caption, 0.95, 'caption')
  apply(claims, STOREY_WORDS, caption, 0.95, 'caption')
  apply(claims, VIEW_WORDS, caption, 0.95, 'caption')
  apply(claims, ANNOTATION_WORDS, caption, 0.95, 'caption')
  apply(claims, DOCUMENT_WORDS, context, 0.7, 'context')
  apply(claims, STOREY_WORDS, context, 0.7, 'context')
  apply(claims, VIEW_WORDS, context, 0.7, 'context')
  // A picture linked from a lightbox anchor is the page's own idea of a full-size drawing.
  if (candidate.channel === 'OG_IMAGE' && !claims.some((c) => c.document)) claims.push({ document: 'PERSPECTIVE_RENDER', signal: 'channel', detail: 'the page’s share image is its hero picture, a visualisation unless named otherwise', confidence: 0.4 })
  return claims
}

export type GenericDiscoveryReport = { dropped: DroppedCandidate[]; followed: string[] }

export function genericIdentity(ctx: AdapterContext): ProjectIdentity {
  const facts = factsOf(ctx)
  const host = new URL(ctx.url).hostname.replace(/^www\./, '')
  return { externalId: externalId(facts), name: projectName(facts), publisher: host }
}

export function genericClassify(ctx: AdapterContext): SourceClassification {
  return classifyProjectPage(factsOf(ctx))
}

/**
 * Discover on the page, then on at most `MAX_CRAWL_PAGES` same-site pages
 * whose links promise drawings. Every fetch goes through `ctx.fetchText`,
 * which is the acquisition's own safety-validated, byte-capped, redirect-
 * checked fetch; a page that fails to fetch is recorded there and skipped.
 */
export async function genericDiscover(ctx: AdapterContext, report?: GenericDiscoveryReport): Promise<DiscoveredCandidate[]> {
  const facts = factsOf(ctx)
  const dropped: DroppedCandidate[] = report?.dropped ?? []
  const title = projectName(facts)
  const out = discoverOnDocument(facts, ctx.url, title, dropped)
  const known = new Set(out.map((c) => c.url))
  const links = drawingLinks(facts, ctx.url)
  for (const link of links) {
    const markup = await ctx.fetchText(link)
    if (markup === null) continue
    report?.followed.push(link)
    const sub = readPageFacts(markup, link)
    for (const c of discoverOnDocument(sub, link, title, dropped)) {
      if (known.has(c.url)) continue
      known.add(c.url)
      out.push(c)
    }
  }
  return out.sort((a, b) => compareCodeUnits(a.url, b.url) || compareCodeUnits(a.channel, b.channel) || compareCodeUnits(a.locator, b.locator))
}

export const genericProjectPageAdapter: SourceAdapter = {
  id: GENERIC_ADAPTER_ID,
  version: GENERIC_ADAPTER_VERSION,
  strategy: 'GENERIC',
  matches: (url) => url.protocol === 'https:' && url.hostname !== '',
  classify: genericClassify,
  identify: genericIdentity,
  displayTitle: (identity) => identity.name?.replace(/^projekt(u)?\s+(domu\s+)?/i, '').replace(/\s+dane\s+projektu$/i, '').trim() || undefined,
  discover: (ctx) => genericDiscover(ctx),
  resolutionCandidates: () => [],
  roleClaims: genericRoleClaims,
  groupKey: (candidate) => candidate.groupKey ?? sizeStem(candidate.url),
  parsePublished: (ctx) => {
    const facts = factsOf(ctx)
    return { facts: genericFacts(facts), specifications: genericSpecifications(facts), rooms: genericRooms(facts) }
  },
}

export { classifyProjectPage } from './classify.js'
export { readPageFacts } from './markup.js'
export type { PageFacts } from './markup.js'
export { MAX_CRAWL_PAGES, registrableDomain, sizeStem } from './assets.js'
export type { DroppedCandidate } from './assets.js'
