/**
 * Discovering a project page's technical assets without knowing the site.
 *
 * Everything the page exposes as a picture is a candidate — `img` `src`,
 * `srcset`, lazy attributes, `<picture>` sources, anchors to images and PDFs,
 * `og:image` — and each candidate carries the words around it: its alt and
 * title, the caption on it, the nearest heading above it. Two rules then
 * drop what is plainly not a drawing of THIS house, and both are stated in
 * terms of structure, never of a hostname:
 *
 *   - site chrome by name (logo, icon, sprite, banner, payment …);
 *   - a NAVIGATION THUMBNAIL: a picture wrapped in a link to another page of
 *     the same site, with no drawing word on it — the "related projects"
 *     strip, the category tiles, the header logo linking home.
 *
 * A bounded, one-level crawl follows links whose words promise drawings
 * ("rzuty", "elewacje", "przekrój", "rysunki techniczne" …) on the same
 * registrable domain, at most `MAX_CRAWL_PAGES` of them, in a deterministic
 * order, each fetched under the same safety policy as the page. Nothing is
 * followed from a followed page: this is not a spider.
 */
import { absolutize, decodeEntities, discoverImages, looksLikeDocument, looksLikeImage, type DiscoveredCandidate } from '../../discovery.js'
import { deaccent, stripTags } from '../../text.js'
import { contextAt, type PageFacts } from './markup.js'
import { ANY_DRAWING_WORD, CHROME_NAME, DRAWING_LINK_WORDS } from './vocabulary.js'

/** How many linked pages of the same site may be read for more drawings. */
export const MAX_CRAWL_PAGES = 4

export type DroppedCandidate = { url: string; code: 'CHROME_ASSET' | 'NAVIGATION_THUMBNAIL' | 'OFF_SITE'; why: string }

export type GenericDiscovery = {
  candidates: DiscoveredCandidate[]
  dropped: DroppedCandidate[]
  /** The same-site pages that were followed, in the order they were fetched. */
  followed: string[]
}

const ATTR = (tag: string, name: string): string | undefined => {
  const m = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag)
  return m ? decodeEntities(m[2] ?? m[3] ?? m[4] ?? '') : undefined
}

/**
 * The registrable part of a host name: `www.example.co.uk` → `example.co.uk`,
 * `assets.example.pl` → `example.pl`. An approximation of the public suffix
 * list, on the side of caution: a two-letter country code under a short
 * second level (`co`, `com`, `org`, `net`, `edu`, `gov`, `ac`) takes three
 * labels, everything else two.
 */
export function registrableDomain(hostname: string): string {
  const labels = hostname.toLowerCase().replace(/\.$/, '').split('.')
  if (labels.length <= 2) return labels.join('.')
  const [tld, second] = [labels[labels.length - 1], labels[labels.length - 2]]
  const three = tld.length === 2 && ['co', 'com', 'org', 'net', 'edu', 'gov', 'ac'].includes(second)
  return labels.slice(three ? -3 : -2).join('.')
}

const sameSite = (a: string, b: string): boolean => registrableDomain(new URL(a).hostname) === registrableDomain(new URL(b).hostname)

const srcsetUrls = (srcset: string | undefined, base: string): string[] => {
  if (!srcset) return []
  const out: string[] = []
  for (const entry of srcset.split(',')) {
    const url = entry.trim().split(/\s+/)[0]
    const abs = url ? absolutize(url, base) : null
    if (abs && looksLikeImage(abs)) out.push(abs)
  }
  return out
}

/**
 * `<picture><source srcset="…"></picture>`: every source, with the picture's
 * own `img` alt as caption, and ONE group key for the picture — its sources,
 * its `img` and that `img`'s own srcset are the same picture by structure,
 * whatever their filenames. A bare `<img srcset>` groups its `src` with its
 * candidates the same way.
 */
function pictureSources(html: string, base: string, exposedBy: string): { candidates: DiscoveredCandidate[]; groups: Map<string, string> } {
  const candidates: DiscoveredCandidate[] = []
  const groups = new Map<string, string>()
  for (const m of html.matchAll(/<picture\b[^>]*>([\s\S]{0,6000}?)<\/picture>/gi)) {
    const img = /<img\b([^>]*)>/i.exec(m[1])
    const caption = img ? (ATTR(img[1], 'alt') ?? ATTR(img[1], 'title')) : undefined
    const imgSrc = img ? ATTR(img[1], 'src') : undefined
    const members: string[] = []
    for (const s of m[1].matchAll(/<source\b([^>]*)>/gi)) members.push(...srcsetUrls(ATTR(s[1], 'srcset'), base))
    const own = imgSrc ? absolutize(imgSrc, base) : null
    if (own && looksLikeImage(own)) members.push(own)
    if (img) members.push(...srcsetUrls(ATTR(img[1], 'srcset'), base))
    if (members.length === 0) continue
    const key = `picture:${[...members].sort()[0]}`
    for (const u of members) if (!groups.has(u)) groups.set(u, key)
    for (const s of m[1].matchAll(/<source\b([^>]*)>/gi)) {
      for (const abs of srcsetUrls(ATTR(s[1], 'srcset'), base)) candidates.push({ url: abs, channel: 'IMG_SRCSET', exposedBy, locator: 'picture>source[srcset]', caption, groupKey: key })
    }
  }
  for (const m of html.matchAll(/<img\b([^>]*)>/gi)) {
    const set = srcsetUrls(ATTR(m[1], 'srcset'), base)
    if (set.length === 0) continue
    const own = ATTR(m[1], 'src')
    const abs = own ? absolutize(own, base) : null
    const members = [...set, ...(abs && looksLikeImage(abs) ? [abs] : [])]
    const key = groups.get(members[0]) ?? `srcset:${[...members].sort()[0]}`
    for (const u of members) if (!groups.has(u)) groups.set(u, key)
  }
  return { candidates, groups }
}

/**
 * For every `img`, the words on it: alt, title, data-caption, aria-label,
 * and the anchor it sits in. Keyed by absolute URL, first occurrence wins.
 */
function imageWords(facts: PageFacts, base: string): Map<string, { words: string; context?: string; linkedPage?: string; offset: number }> {
  const out = new Map<string, { words: string; context?: string; linkedPage?: string; offset: number }>()
  const anchors: Array<{ start: number; end: number; href?: string; words: string }> = []
  for (const a of facts.body.matchAll(/<a\b([^>]*)>([\s\S]{0,4000}?)<\/a>/gi)) {
    const start = a.index ?? 0
    anchors.push({ start, end: start + a[0].length, href: ATTR(a[1], 'href'), words: `${ATTR(a[1], 'title') ?? ''} ${ATTR(a[1], 'data-caption') ?? ''} ${ATTR(a[1], 'aria-label') ?? ''} ${stripTags(a[2])}` })
  }
  for (const m of facts.body.matchAll(/<img\b([^>]*)>/gi)) {
    const offset = m.index ?? 0
    const attrs = m[1]
    const words = ['alt', 'title', 'data-caption', 'aria-label', 'data-title'].map((n) => ATTR(attrs, n) ?? '').join(' ')
    const anchor = anchors.find((a) => a.start < offset && offset < a.end)
    const href = anchor?.href && anchor.href !== 'javascript:;' && !anchor.href.startsWith('#') ? absolutize(anchor.href, base) : null
    const linkedPage = href && !looksLikeImage(href) && !looksLikeDocument(href) ? href : undefined
    const urls = [ATTR(attrs, 'src'), ATTR(attrs, 'data-src'), ATTR(attrs, 'data-original'), ATTR(attrs, 'data-lazy-src')].filter((u): u is string => !!u)
    for (const u of urls) {
      const abs = absolutize(u, base)
      if (!abs || out.has(abs)) continue
      out.set(abs, { words: `${words} ${anchor?.words ?? ''}`.replace(/\s+/g, ' ').trim(), context: contextAt(facts, offset), linkedPage, offset })
    }
  }
  return out
}

/** Same-site links whose words promise drawings, in a deterministic order, at most `MAX_CRAWL_PAGES`. */
export function drawingLinks(facts: PageFacts, pageUrl: string): string[] {
  const out = new Map<string, number>()
  for (const a of facts.body.matchAll(/<a\b([^>]*)>([\s\S]{0,2000}?)<\/a>/gi)) {
    const href = ATTR(a[1], 'href')
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue
    const abs = absolutize(href, pageUrl)
    if (!abs || !abs.startsWith('https:') || looksLikeImage(abs) || looksLikeDocument(abs)) continue
    const target = new URL(abs)
    target.hash = ''
    const current = new URL(pageUrl)
    current.hash = ''
    if (target.toString() === current.toString() || !sameSite(abs, pageUrl)) continue
    const words = deaccent(`${ATTR(a[1], 'title') ?? ''} ${stripTags(a[2])} ${decodeURIComponent(target.pathname)}`)
    if (!DRAWING_LINK_WORDS.test(words)) continue
    // A path under the page's own path (`/projekt/x/rzuty`) is the strongest sign the link belongs to this project.
    const under = target.pathname.startsWith(current.pathname.replace(/\/$/, '') + '/') ? 0 : 1
    const key = target.toString()
    if (!out.has(key)) out.set(key, under)
  }
  return [...out.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).map(([url]) => url).slice(0, MAX_CRAWL_PAGES)
}

/**
 * Every candidate on one document, with its words, minus chrome and
 * navigation thumbnails. Off-site images (another registrable domain, a CDN
 * excepted only when the page links it as an image) are kept: a CDN is
 * where a publisher keeps its drawings, and every address is still fetched
 * under the safety policy.
 */
export function discoverOnDocument(facts: PageFacts, exposedBy: string, pageTitle: string | undefined, dropped: DroppedCandidate[]): DiscoveredCandidate[] {
  const base = facts.url
  const words = imageWords(facts, base)
  const pictures = pictureSources(facts.body, base, exposedBy)
  const raw = [...discoverImages(facts.body, { base, exposedBy }), ...pictures.candidates]
  const out: DiscoveredCandidate[] = []
  const seenDropped = new Set<string>()
  const drop = (url: string, code: DroppedCandidate['code'], why: string): void => {
    if (seenDropped.has(url)) return
    seenDropped.add(url)
    dropped.push({ url, code, why })
  }
  const titleFolded = pageTitle ? deaccent(pageTitle).replace(/[^a-z0-9]+/g, ' ').trim() : ''
  for (const c of raw) {
    if (!c.url.startsWith('https:')) continue
    const file = decodeURIComponent(c.url.split('/').pop() ?? '')
    const info = words.get(c.url)
    const text = deaccent(`${c.caption ?? ''} ${info?.words ?? ''}`)
    if (CHROME_NAME.test(file) || CHROME_NAME.test(text)) {
      drop(c.url, 'CHROME_ASSET', `named as site chrome ("${file.slice(0, 60)}")`)
      continue
    }
    if (c.channel === 'DOCUMENT_LINK' && !ANY_DRAWING_WORD.test(deaccent(`${c.caption ?? ''} ${file}`))) {
      drop(c.url, 'CHROME_ASSET', 'a document link with no drawing word on it')
      continue
    }
    if (info?.linkedPage && !ANY_DRAWING_WORD.test(text) && !ANY_DRAWING_WORD.test(deaccent(info.context ?? ''))) {
      // A picture that is a link to another page, saying nothing about a drawing: a tile, not a sheet.
      // Unless it is plainly captioned as this very project — then the link is a lightbox in disguise.
      const captioned = titleFolded !== '' && text.replace(/[^a-z0-9]+/g, ' ').includes(titleFolded)
      if (!captioned) {
        drop(c.url, 'NAVIGATION_THUMBNAIL', `linked to ${info.linkedPage.slice(0, 80)} with no drawing word on it`)
        continue
      }
    }
    out.push({ ...c, caption: c.caption ?? (info?.words || undefined), context: info?.context, groupKey: c.groupKey ?? pictures.groups.get(c.url) })
  }
  return out.sort((a, b) => a.url.localeCompare(b.url) || a.channel.localeCompare(b.channel) || a.locator.localeCompare(b.locator))
}

/**
 * The stem a publisher varies the size suffix of: `plan-800x600.jpg`,
 * `plan_thumb.png`, `plan@2x.png`, `plan-lo.gif` and `plan.png` are one
 * drawing. Used only as a grouping key; the bytes still decide.
 */
export function sizeStem(url: string): string | undefined {
  try {
    const u = new URL(url)
    const file = decodeURIComponent(u.pathname.split('/').pop() ?? '')
    const dir = u.pathname.slice(0, u.pathname.length - (u.pathname.split('/').pop() ?? '').length)
    const stem = file
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/@\dx$/i, '')
      .replace(/[-_]\d{2,4}x\d{2,4}$/i, '')
      .replace(/[-_]?(thumb|thumbnail|small|medium|large|lo|hi|low|high|xl|min|preview|mini)$/i, '')
    return stem.length >= 4 ? `${u.hostname}${dir}${stem}`.toLowerCase() : undefined
  } catch {
    return undefined
  }
}
