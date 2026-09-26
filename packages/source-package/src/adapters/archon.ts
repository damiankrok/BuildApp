/**
 * ARCHON adapter (archon.pl).
 *
 * This is the only file in the analyzer that knows anything about one
 * publisher's markup or naming. It knows nothing about any particular
 * BUILDING: no project name, no coordinates, no expected features. Point it
 * at a different ARCHON project and it behaves identically.
 *
 * Three publisher facts do the real work here, and each was verified against
 * the live site rather than assumed:
 *
 * 1. **Product assets live under `/images/products/<projectCode>/`.** Site
 *    chrome (banners, payment icons, profile pictures) is served from other
 *    paths, so the project's own material can be separated from the furniture
 *    of the page before a single byte is fetched.
 *
 * 2. **A high-resolution original is published at `__<n + 11000>`.** The page
 *    embeds a 400x300 section; the same drawing exists at 1138x854 — 8 times
 *    the pixels — and is reachable only by this convention, because the
 *    section is embedded through a script handler with no anchor to follow.
 *    That one asset is where the historical acquisition bug lived: the copy
 *    you analyse changes the answer, so the package records which copy won.
 *
 * 3. **The original's filename carries no description.** `…__264.jpg` is
 *    `elewacja-frontowa-…` but `…__11264.jpg` is just `projekt-<name>-…`.
 *    Pairing by filename would therefore classify a 1280 px front elevation
 *    as an unrelated picture. Pairing is structural: a conventional variant
 *    inherits its parent's identity, and an anchor that wraps an image says
 *    the two are the same picture.
 */
import { slugify } from '@buildapp/source-common'
import { CHANNEL_TRUST, decodeEntities, discoverEndpoints, discoverImages, stripScripts, type DiscoveredCandidate } from '../discovery.js'
import type { AdapterContext, ProjectIdentity, SourceAdapter } from '../adapter.js'
import type { RoleClaim } from '../roles.js'
import type { PublishedFact, PublishedRoom, PublishedSpecification, StoreyRole } from '../schema.js'

export const ARCHON_ADAPTER_ID = 'archon.pl'
export const ARCHON_ADAPTER_VERSION = '1.0.0'

/** The offset at which this publisher serves the full-resolution original of an asset. */
export const VARIANT_BLOCK = 11000

const PROJECT_CODE_IN_URL = /-(m[0-9a-f]{8,})(?:[/?#]|$)/i
const PROJECT_CODE_IN_ASSETS = /assets\.archon\.pl\/images\/products\/(m[0-9a-f]{8,})\//i
const PRODUCT_ASSET = /\/images\/products\/(m[0-9a-f]{8,})\//i
const ENDPOINT = /^\/(product_fancybox_[a-z_]+|products)\//i

/** Strip Polish diacritics so one rule matches `przekrój` and `przekroj` alike. */
const deaccent = (text: string): string => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** The descriptive part of an asset URL: the filename without its content hash, variant id and extension. */
export function assetSlug(url: string): string {
  const file = url.split('/').pop() ?? ''
  return deaccent(file.replace(/-[0-9a-f]{16,}__\d+\.[a-z0-9]+$/i, '').replace(/__\d+\.[a-z0-9]+$/i, '').replace(/\.[a-z0-9]+$/i, ''))
}

/** The publisher's variant id, the `__<n>` before the extension. */
export function variantId(url: string): number | null {
  const m = /__(\d{1,6})\.[a-z0-9]+(?:\?|#|$)/i.exec(url)
  return m ? Number(m[1]) : null
}

/** The address of the same asset without the resolution block, so a page copy and its original share one identity. */
export function variantStem(url: string): string | null {
  const m = /^(.*)__(\d{1,6})(\.[a-z0-9]+)(\?.*)?$/i.exec(url)
  if (!m) return null
  const n = Number(m[2])
  const base = n >= VARIANT_BLOCK ? n - VARIANT_BLOCK : n
  return `${m[1]}__${base}${m[3]}`
}

/**
 * Addresses worth trying for a larger copy. Only ever ONE candidate, and only
 * when this address is not already an original. A 404 is a useful answer: it
 * says no larger copy is published, which is exactly what the hero render's
 * `__11289` reports.
 */
export function archonResolutionCandidates(url: string): string[] {
  const m = /^(.*)__(\d{1,6})(\.[a-z0-9]+)(\?.*)?$/i.exec(url)
  if (!m) return []
  const n = Number(m[2])
  if (n >= VARIANT_BLOCK) return []
  return [`${m[1]}__${n + VARIANT_BLOCK}${m[3]}${m[4] ?? ''}`]
}

// ---------------------------------------------------------------------------
// Roles from the publisher's vocabulary
// ---------------------------------------------------------------------------

type Rule = { test: RegExp; claim: Omit<RoleClaim, 'signal' | 'detail' | 'confidence'>; confidence: number; why: string }

/** Polish drawing vocabulary. Ordered: the first matching document rule wins the document dimension. */
const DOCUMENT_RULES: Rule[] = [
  { test: /\brzut\b|\bplan\b/, claim: { document: 'FLOOR_PLAN' }, confidence: 0.92, why: '"rzut" names a floor plan' },
  { test: /\bprzekroj\w*/, claim: { document: 'SECTION' }, confidence: 0.92, why: '"przekrój" names a section' },
  { test: /\belewacj\w*/, claim: { document: 'ELEVATION' }, confidence: 0.92, why: '"elewacja" names an elevation' },
  { test: /\bsytuacj\w*/, claim: { document: 'SITE_PLAN' }, confidence: 0.9, why: '"sytuacja" names a site plan' },
  { test: /\bwidok\b|\bwizualizacj\w*/, claim: { document: 'PERSPECTIVE_RENDER' }, confidence: 0.88, why: '"widok" / "wizualizacja" names a visualisation' },
]

const STOREY_RULES: Rule[] = [
  { test: /\bparter\w*/, claim: { storey: 'GROUND' }, confidence: 0.92, why: '"parter" is the ground storey' },
  { test: /\bpoddasz\w*|\bstrych\w*/, claim: { storey: 'ATTIC' }, confidence: 0.92, why: '"poddasze" is the attic storey' },
  { test: /\bpietr\w*|\bpiętr\w*/, claim: { storey: 'UPPER' }, confidence: 0.85, why: '"piętro" is an upper storey' },
  { test: /\bpiwnic\w*|\bsuteren\w*/, claim: { storey: 'BASEMENT' }, confidence: 0.85, why: '"piwnica" is a basement' },
]

const VIEW_RULES: Rule[] = [
  { test: /\bfrontow\w*|\bprzedni\w*/, claim: { view: 'FRONT' }, confidence: 0.9, why: '"frontowa" is the front' },
  { test: /\bogrodow\w*|\btyln\w*/, claim: { view: 'REAR' }, confidence: 0.9, why: '"ogrodowa" (garden) is the rear' },
  // the publisher names BOTH side elevations "boczna". Which side is which is simply not stated,
  // and guessing would silently mirror a facade, so the honest answer is SIDE_UNSPECIFIED.
  { test: /\bboczn\w*/, claim: { view: 'SIDE_UNSPECIFIED' }, confidence: 0.9, why: '"boczna" names a side, but this publisher labels both sides identically' },
]

const ANNOTATION_RULES: Rule[] = [{ test: /z-powierzchniami|\bpowierzchni\w*/, claim: { annotation: 'AREA_TABLE' }, confidence: 0.9, why: '"z powierzchniami" is the copy carrying the room area table' }]

export function archonRoleClaims(candidate: DiscoveredCandidate): RoleClaim[] {
  const slug = assetSlug(candidate.url)
  const caption = deaccent(candidate.caption ?? '')
  const text = `${slug} ${caption}`
  const claims: RoleClaim[] = []
  const apply = (rules: Rule[], scale: number, signal: string, source: string): void => {
    for (const r of rules) {
      if (!r.test.test(source)) continue
      claims.push({ ...r.claim, signal, detail: `${r.why} (matched "${source.slice(0, 80)}")`, confidence: Math.round(r.confidence * scale * 100) / 100 })
      break
    }
  }
  apply(DOCUMENT_RULES, 1, 'url-slug', slug)
  apply(STOREY_RULES, 1, 'url-slug', slug)
  apply(VIEW_RULES, 1, 'url-slug', slug)
  apply(ANNOTATION_RULES, 1, 'url-slug', slug)
  // the caption is weaker than the filename: it is prose, and this publisher's alt text repeats the project name
  apply(DOCUMENT_RULES, 0.85, 'caption', caption)
  apply(STOREY_RULES, 0.85, 'caption', caption)
  apply(VIEW_RULES, 0.85, 'caption', caption)

  // A plan reached through the bespoke floor attribute is the AREA copy; the plan in the page's
  // own <img> is the DIMENSIONED copy. The dimensioned copy has no distinguishing word in its
  // filename at all, so it can only be identified by the channel it arrived through — and getting
  // this wrong hands every dimension reader the one copy with no dimension chains on it.
  const isPlanText = DOCUMENT_RULES[0].test.test(text)
  if (candidate.channel === 'FLOOR_PLAN_ATTR') {
    claims.push({ document: 'FLOOR_PLAN', annotation: 'AREA_TABLE', signal: 'channel', detail: 'published through the floor-plan attribute, which carries the area-labelled copy', confidence: 0.8 })
  } else if (isPlanText && candidate.channel === 'IMG_SRC' && !ANNOTATION_RULES[0].test.test(text)) {
    claims.push({ annotation: 'DIMENSIONED', signal: 'channel', detail: 'a plan in the page body that is not the area copy: the dimensioned copy', confidence: 0.6 })
  }

  // A floor fragment names its storey in the endpoint path, and that is stronger than any filename,
  // because the publisher's own high-resolution plans carry no descriptive slug at all.
  const floor = /\/product_fancybox_floor\/[^/]+\/(\d+)/i.exec(candidate.exposedBy)
  if (floor) {
    const storey = storeyForFloorIndex(Number(floor[1]))
    if (storey) claims.push({ document: 'FLOOR_PLAN', storey, signal: 'endpoint', detail: `exposed by the publisher's floor fragment ${floor[0]}`, confidence: 0.86 })
    if (!ANNOTATION_RULES[0].test.test(text) && candidate.locator === 'img[src]') {
      claims.push({ annotation: 'DIMENSIONED', signal: 'endpoint', detail: 'the plain plan inside a floor fragment is the dimensioned copy', confidence: 0.55 })
    }
  }
  return claims
}

/**
 * This publisher indexes floor fragments 1 and 3 for a two-storey house. The
 * mapping is a claim like any other and is deliberately conservative: an index
 * it has not seen produces no claim at all rather than a guess.
 */
function storeyForFloorIndex(index: number): StoreyRole | null {
  if (index === 1) return 'GROUND'
  if (index === 3) return 'ATTIC'
  return null
}

// ---------------------------------------------------------------------------
// Published figures
// ---------------------------------------------------------------------------

/** Canonical keys for the figures this publisher prints, matched on its stable slug rather than its visible label. */
const FACT_KEYS: Array<{ test: RegExp; key: string; unit: PublishedFact['unit'] }> = [
  { test: /^powierzchnia-netto-domu/, key: 'house_net_area', unit: 'm2' },
  { test: /^powierzchnia-uzytkowa-bez-schodow/, key: 'usable_area_without_stairs', unit: 'm2' },
  { test: /^powierzchnia-uzytkowa/, key: 'usable_area', unit: 'm2' },
  { test: /^powierzchnia-garazu/, key: 'garage_area', unit: 'm2' },
  { test: /^powierzchnia-kotlowni/, key: 'boiler_room_area', unit: 'm2' },
  { test: /^powierzchnia-zabudowy/, key: 'footprint_area', unit: 'm2' },
  { test: /^powierzchnia-podlog/, key: 'floor_area', unit: 'm2' },
  { test: /^powierzchnia-calkowita/, key: 'total_area', unit: 'm2' },
  { test: /^powierzchnia-dachu/, key: 'roof_area', unit: 'm2' },
  { test: /^kubatura/, key: 'volume', unit: 'none' },
  { test: /^wysokosc-budynku/, key: 'building_height', unit: 'm' },
]

/** `129,04` and `1 205,5` are numbers here; the decimal comma and the thin space are this locale's, not noise. */
export function parsePlNumber(text: string): number | null {
  const cleaned = text.replace(/ /g, ' ')
  const m = /-?\d[\d ]*(?:[.,]\d+)?/.exec(cleaned)
  if (!m) return null
  const n = Number(m[0].replace(/ /g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

const stripTags = (html: string): string => decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()

/**
 * Canonical keys for the subjects this publisher writes a specification line
 * about, matched on the deaccented label it prints.
 *
 * Deliberately small and deliberately not exhaustive: a line whose label is
 * not here is still kept, under the key `other`, because the reading layer
 * searches the text and an unrecognised label is a reason to read it, not a
 * reason to throw it away.
 */
const SPEC_KEYS: Array<{ test: RegExp; key: string }> = [
  { test: /^dach\b/, key: 'roof' },
  { test: /^scianka kolankowa/, key: 'knee_wall' },
  { test: /^scian/, key: 'walls' },
  { test: /^strop/, key: 'floor_structure' },
  { test: /^fundament/, key: 'foundation' },
  { test: /^stolarka|^okna|^drzwi/, key: 'joinery' },
  { test: /^brama gara/, key: 'garage_door' },
  { test: /^komin/, key: 'chimney' },
  { test: /^schod/, key: 'stairs' },
  { test: /^taras|^balkon/, key: 'terrace' },
  { test: /^elewacj/, key: 'facade' },
]

/**
 * The publisher's technical specification list, and its prose description.
 *
 * Both are printed statements about the building, and between them they carry
 * things no drawing states as plainly: the roof's kind and pitch in words, the
 * wall build-up in centimetres, the height of a knee wall, and whether the
 * roof has eaves at all. They are returned as text and nothing here decides
 * what they mean.
 */
export function archonSpecifications(html: string): PublishedSpecification[] {
  const text = stripScripts(html)
  const out: PublishedSpecification[] = []
  const seen = new Set<string>()
  const push = (key: string, label: string, body: string): void => {
    const trimmed = body.replace(/\s+/g, ' ').trim()
    if (trimmed.length < 3) return
    const dedupe = `${key}::${trimmed}`
    if (seen.has(dedupe)) return
    seen.add(dedupe)
    out.push({ key, label, text: trimmed })
  }

  for (const m of text.matchAll(/<div[^>]*class="[^"]*technical-data-item[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*technical-data-item|$)/gi)) {
    for (const item of m[1].matchAll(/class="product-data__title"[^>]*>\s*<strong>([\s\S]*?)<\/strong>([\s\S]*?)<\/div>/gi)) {
      const label = stripTags(item[1]).replace(/:\s*$/, '')
      const body = stripTags(item[2])
      if (label.length === 0) continue
      const slug = deaccent(label)
      push(SPEC_KEYS.find((k) => k.test.test(slug))?.key ?? 'other', label, body)
    }
  }

  const meta = /<meta[^>]*name="description"[^>]*content="([^"]+)"/i.exec(html)
  if (meta) push('summary', 'meta description', decodeEntities(meta[1]))
  // The prose below the drawings is marketing copy, and it is also the only
  // place this publisher says things like "a gable roof with no eaves" — which
  // is a statement about the building's geometry however it was meant.
  const prose = /<div[^>]*id="bottom-description"[^>]*>([\s\S]*?)<\/div>/i.exec(text)
  if (prose) push('description', 'description', stripTags(prose[1]))
  out.sort((a, b) => a.key.localeCompare(b.key) || a.label.localeCompare(b.label) || a.text.localeCompare(b.text))
  return out
}

export function archonPublished(html: string): { facts: PublishedFact[]; specifications: PublishedSpecification[]; rooms: PublishedRoom[] } {
  const text = stripScripts(html)
  const facts: PublishedFact[] = []
  const seen = new Set<string>()

  for (const m of text.matchAll(/<div[^>]*class="[^"]*product-data__item[^"]*"[^>]*data-resource="([^"]+)"[^>]*>([\s\S]{0,4000}?<\/div>)\s*<\/div>/gi)) {
    const slug = deaccent(m[1])
    const body = m[2]
    const titleM = /class="product-data__title"[^>]*>([\s\S]*?)<\/div>/i.exec(body)
    const valueM = /class="product-data__value"[^>]*>([\s\S]*?)<\/div>/i.exec(body)
    if (!titleM || !valueM) continue
    const label = stripTags(titleM[1])
    const raw = stripTags(valueM[1])
    const mapped = FACT_KEYS.find((f) => f.test.test(slug))
    if (!mapped) continue
    const value = parsePlNumber(raw)
    if (value === null || seen.has(mapped.key)) continue
    seen.add(mapped.key)
    facts.push({ key: mapped.key, label, value, unit: mapped.unit, raw })
  }

  const rooms: PublishedRoom[] = []
  for (const table of text.matchAll(/<table[\s\S]*?<\/table>/gi)) {
    const body = table[0]
    const firstTh = /<th[^>]*>([\s\S]*?)<\/th>/i.exec(body)
    if (!firstTh) continue
    const heading = deaccent(stripTags(firstTh[1]))
    const storey: StoreyRole | null = /parter|przyziemie/.test(heading) ? 'GROUND' : /poddasze|pietro/.test(heading) ? 'ATTIC' : null
    if (!storey) continue
    for (const row of body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => stripTags(c[1]))
      if (cells.length < 2) continue
      const nameM = /^(\d+)\.\s*(.+)$/.exec(cells[0])
      if (!nameM) continue
      const area = parsePlNumber(cells[1])
      if (area === null || area <= 0) continue
      rooms.push({ storey, index: Number(nameM[1]), label: nameM[2].trim(), area, raw: cells.slice(0, 3).join(' | ') })
    }
  }
  rooms.sort((a, b) => a.storey.localeCompare(b.storey) || a.index - b.index)
  facts.sort((a, b) => a.key.localeCompare(b.key))
  return { facts, specifications: archonSpecifications(html), rooms }
}

// ---------------------------------------------------------------------------
// The adapter
// ---------------------------------------------------------------------------

function projectCode(ctx: AdapterContext): string | undefined {
  const fromUrl = PROJECT_CODE_IN_URL.exec(ctx.url)
  if (fromUrl) return fromUrl[1]
  const fromAssets = PROJECT_CODE_IN_ASSETS.exec(ctx.html)
  return fromAssets ? fromAssets[1] : undefined
}

function projectName(html: string): string | undefined {
  const og = /<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i.exec(html)
  if (og) return decodeEntities(og[1]).replace(/\s*[-|]\s*ARCHON.*$/i, '').trim()
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  return title ? stripTags(title[1]).replace(/\s*[-|]\s*ARCHON.*$/i, '').trim() : undefined
}

export const archonAdapter: SourceAdapter = {
  id: ARCHON_ADAPTER_ID,
  version: ARCHON_ADAPTER_VERSION,

  matches: (url) => /(^|\.)archon\.pl$/i.test(url.hostname),

  identify: (ctx) => ({ externalId: projectCode(ctx), name: projectName(ctx.html), publisher: ARCHON_ADAPTER_ID }),

  // The page titles a project "Projekt domu <name> Dane projektu"; a person calls it "<name>".
  displayTitle: (identity) => identity.name?.replace(/^projekt\s+domu\s+/i, '').replace(/\s+dane\s+projektu$/i, '').trim() || undefined,

  resolutionCandidates: archonResolutionCandidates,

  roleClaims: archonRoleClaims,

  /**
   * Candidates of the same asset share the address of its page copy: an
   * original found by the resolution convention resolves to the same stem,
   * so it inherits the identity of the described copy instead of becoming a
   * nameless picture of its own.
   */
  groupKey: (candidate) => variantStem(candidate.url) ?? undefined,

  async discover(ctx) {
    const code = projectCode(ctx)
    // only this project's own material; site chrome is served from other paths
    const accept = (url: string): boolean => {
      const m = PRODUCT_ASSET.exec(url)
      return m !== null && (code === undefined || m[1].toLowerCase() === code.toLowerCase())
    }
    const fromPage = discoverImages(ctx.html, { base: ctx.url, exposedBy: ctx.url, accept, endpointPattern: ENDPOINT })
    const endpoints = discoverEndpoints(ctx.html, { base: ctx.url, exposedBy: ctx.url, accept, endpointPattern: ENDPOINT })

    const out = [...fromPage]
    for (const endpoint of endpoints) {
      const markup = await ctx.fetchText(endpoint.url)
      if (markup === null) continue
      const found = discoverImages(markup, { base: endpoint.url, exposedBy: endpoint.url, accept })
      for (const c of found) out.push({ ...c, caption: c.caption ?? endpoint.caption })
    }
    return out.sort((a, b) => a.url.localeCompare(b.url) || CHANNEL_TRUST[b.channel] - CHANNEL_TRUST[a.channel] || a.locator.localeCompare(b.locator))
  },

  parsePublished: (ctx) => archonPublished(ctx.html),
}

/** A readable, deterministic caption for an asset that has none, from its slug. */
export const captionFromSlug = (url: string): string => slugify(assetSlug(url)).replace(/-/g, ' ') || 'asset'
