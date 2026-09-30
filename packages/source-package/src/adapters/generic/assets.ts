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
import { registrableDomain } from '../../logical-url.js'
import { compareCodeUnits, deaccent, safeDecode, stripTags } from '../../text.js'
import { contextAt, pathAt, type PageFacts } from './markup.js'
import { pageRegions } from './regions.js'
import { ANY_DRAWING_WORD, CHROME_NAME, DRAWING_LINK_WORDS } from './vocabulary.js'

/** How many linked pages of the same site may be read for more drawings. */
export const MAX_CRAWL_PAGES = 4

export type DroppedCandidate = { url: string; code: 'CHROME_ASSET' | 'NAVIGATION_THUMBNAIL' | 'OFF_SITE' | 'DOCUMENT'; why: string }

/**
 * The labels of the list items an offset sits in, outermost first, each
 * item's own text up to its nested list: "Obrys budynku w skali 1:500" over
 * "PDF podstawa". A nested download list names its files on the parent item.
 */
export function listLabelsAt(body: string, offset: number): string[] {
  const stack: Array<{ tag: string; start: number; leadEnd?: number }> = []
  for (const m of body.slice(0, offset).matchAll(/<(\/?)(li|ul|ol)\b[^>]*>/gi)) {
    const closing = m[1] === '/'
    const tag = m[2].toLowerCase()
    const at = m.index ?? 0
    if (!closing) {
      if (tag !== 'li') {
        const parent = [...stack].reverse().find((x) => x.tag === 'li')
        if (parent && parent.leadEnd === undefined) parent.leadEnd = at
      }
      if (tag === 'li') {
        // an unclosed <li> before a sibling <li> is closed by it
        while (stack.length > 0 && stack[stack.length - 1].tag === 'li') stack.pop()
      }
      stack.push({ tag, start: at + m[0].length })
    } else {
      const i = stack.map((x) => x.tag).lastIndexOf(tag)
      if (i >= 0) stack.length = i
    }
  }
  const items = stack.filter((x) => x.tag === 'li')
  // the innermost item is the link's own; its label is the link text, read elsewhere
  return items.slice(0, -1).map((x) => stripTags(body.slice(x.start, x.leadEnd ?? offset))).filter((t) => t !== '' && t.length <= 120)
}

/**
 * A technical document the page links: a PDF or a CAD file, with the words around it. Never an image candidate.
 * `text` is the link's own words; `rowLabel` the label of the row it is filed in (005C): the text before it in its
 * own item ("Obrys budynku w skali 1:500: PDF"), the item it is nested under, its table row's first cell, its `dt`,
 * or a heading with nothing but links between it and the link.
 */
export type DocumentLink = { url: string; format: 'PDF' | 'DWG' | 'DXF'; text: string; rowLabel?: string; heading?: string }

const DOCUMENT_HREF = /\.(pdf|dwg|dxf)(?:[?#]|$)/i
/** At most this many documents are read from one page: a download centre is not this house's documentation. */
export const MAX_DOCUMENT_LINKS = 16

const trimLabel = (text: string): string => text.replace(/^[\s:–—·,;|/()-]+|[\s:–—·,;|/(-]+$/g, '').trim()
const withoutLinks = (html: string): string => html.replace(/<a\b[\s\S]*?<\/a>/gi, ' ')

/** The label of the row a link is filed in, nearest first; undefined when the link stands alone. */
function rowLabelAt(facts: PageFacts, at: number): string | undefined {
  const els = facts.elements
  const path = pathAt(els, at)
  const inner = path.length > 0 ? els[path[path.length - 1]] : undefined
  const own = inner ? trimLabel(stripTags(withoutLinks(facts.body.slice(inner.start, at)))) : ''
  if (own && own.length <= 120) return own
  const parentItem = listLabelsAt(facts.body, at).pop()
  if (parentItem) return parentItem
  const tr = [...path].reverse().map((id) => els[id]).find((e) => e.tag === 'tr')
  if (tr) {
    const first = els.find((e) => e.parent === tr.id && (e.tag === 'td' || e.tag === 'th'))
    if (first && !(at >= first.start && at < first.end)) {
      const label = trimLabel(stripTags(withoutLinks(facts.body.slice(first.start, first.end))))
      if (label && label.length <= 120) return label
    }
  }
  const dd = [...path].reverse().map((id) => els[id]).find((e) => e.tag === 'dd')
  if (dd) {
    const dt = els.filter((e) => e.parent === dd.parent && e.tag === 'dt' && e.start < dd.start).pop()
    if (dt) {
      const label = trimLabel(stripTags(facts.body.slice(dt.start, dt.end)))
      if (label && label.length <= 120) return label
    }
  }
  // a section's heading, never the page's own title
  const heading = [...facts.headings].reverse().find((h) => h.offset < at)
  if (heading && heading.level >= 2) {
    const close = facts.body.indexOf('</h', heading.offset)
    const end = close < 0 ? heading.offset : facts.body.indexOf('>', close) + 1
    if (end > heading.offset && end <= at && trimLabel(stripTags(withoutLinks(facts.body.slice(end, at)))) === '') return heading.text
  }
  return undefined
}

/** Every PDF / DWG / DXF the page itself links: not in its chrome, a control or a card (`regions.ts`). */
export function documentLinks(facts: PageFacts, base: string): DocumentLink[] {
  const out = new Map<string, DocumentLink>()
  const regions = pageRegions(facts)
  for (const a of facts.body.matchAll(/<a\b([^>]*)>([\s\S]{0,2000}?)<\/a>/gi)) {
    const href = ATTR(a[1], 'href')
    if (!href) continue
    const abs = absolutize(href, base)
    if (!abs || !abs.startsWith('https:')) continue
    const ext = DOCUMENT_HREF.exec(new URL(abs).pathname)
    if (!ext) continue
    const at = a.index ?? 0
    if (regions.excluded(at)) continue
    const heading = [...facts.headings].reverse().find((h) => h.offset < at)?.text
    const text = `${ATTR(a[1], 'title') ?? ''} ${ATTR(a[1], 'aria-label') ?? ''} ${stripTags(a[2])}`.replace(/\s+/g, ' ').trim()
    const rowLabel = rowLabelAt(facts, at)
    if (!out.has(abs)) out.set(abs, { url: abs, format: ext[1].toUpperCase() as DocumentLink['format'], text, ...(rowLabel ? { rowLabel } : {}), heading })
  }
  return [...out.values()].sort((a, b) => compareCodeUnits(a.url, b.url)).slice(0, MAX_DOCUMENT_LINKS)
}

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
function imageWords(facts: PageFacts, base: string): Map<string, { words: string; figcaption?: string; context?: string; linkedPage?: string; offset: number }> {
  const out = new Map<string, { words: string; figcaption?: string; context?: string; linkedPage?: string; offset: number }>()
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
      out.set(abs, { words: `${words} ${anchor?.words ?? ''}`.replace(/\s+/g, ' ').trim(), figcaption: figcaptionOf(facts.body, offset), context: contextAt(facts, offset), linkedPage, offset })
    }
  }
  return out
}

/** The caption of the <figure> an offset sits in, and only that figure's: a caption is never borrowed from the next one. */
function figcaptionOf(body: string, offset: number): string | undefined {
  const open = body.lastIndexOf('<figure', offset)
  if (open < 0 || body.lastIndexOf('</figure', offset) > open) return undefined
  const close = body.indexOf('</figure', offset)
  const inside = body.slice(open, close < 0 ? offset + 1500 : close)
  const m = /<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i.exec(inside)
  return m ? stripTags(m[1]) || undefined : undefined
}

/** Words any project address carries; they name no project. */
const GENERIC_SLUG = new Set(['projekt', 'projekty', 'projektu', 'projekt-domu', 'dom', 'domu', 'domy', 'domow', 'katalog', 'house', 'home', 'project', 'projects', 'plan', 'plans', 'index', 'html', 'php', 'htm', 'aspx', 'id', 'www'])

/** An address part as tokens: decoded, folded, split on anything that is not a letter or a digit. */
const tokensOf = (text: string): string[] => deaccent(safeDecode(text).toLowerCase()).split(/[^a-z0-9]+/).filter((t) => t !== '')

/**
 * What names THIS project in an address (005C): its own last path segment (the extension dropped) as a token
 * sequence, and its query values that look like identifiers (`?id=4711`). A sequence counts only when it has a
 * token that is not a generic word ("projekt", "dom").
 */
function projectNames(pageUrl: URL): string[][] {
  const names: string[][] = []
  const last = pageUrl.pathname.replace(/\/+$/, '').split('/').pop() ?? ''
  const slug = tokensOf(last.replace(/\.(html?|php|aspx?)$/i, ''))
  if (slug.some((t) => !GENERIC_SLUG.has(t) && (t.length >= 3 || /\d/.test(t)))) names.push(slug)
  for (const [, v] of pageUrl.searchParams) {
    const t = tokensOf(v)
    if (t.length > 0 && t.some((x) => !GENERIC_SLUG.has(x) && (x.length >= 3 || /\d/.test(x)))) names.push(t)
  }
  return names
}

/**
 * Does a run of text name this project, and nothing more than its drawings? The name's tokens must appear whole
 * and in order, and every other token in the same run must be a drawing word or a generic one: "dom-pod-grabem-
 * rzuty" is this house's plans, "dom-pod-grabem-2" and "dom-pod-grabem-lustro" are two other projects, "filipa"
 * does not contain "lipa", and "47110" is not "4711".
 */
function namesProject(run: string[], name: string[]): boolean {
  for (let i = 0; i + name.length <= run.length; i++) {
    if (!name.every((t, k) => run[i + k] === t)) continue
    const rest = [...run.slice(0, i), ...run.slice(i + name.length)]
    if (rest.every((t) => GENERIC_SLUG.has(t) || DRAWING_LINK_WORDS.test(t) || /^(i|and|oraz|und|z|w|na|pdf)$/.test(t))) return true
  }
  return false
}

/** Same-site links whose words promise drawings, in a deterministic order, at most `MAX_CRAWL_PAGES`. */
export function drawingLinks(facts: PageFacts, pageUrl: string): string[] {
  const out = new Map<string, number>()
  const current = new URL(pageUrl)
  current.hash = ''
  const names = projectNames(current)
  for (const a of facts.body.matchAll(/<a\b([^>]*)>([\s\S]{0,2000}?)<\/a>/gi)) {
    const href = ATTR(a[1], 'href')
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue
    const abs = absolutize(href, pageUrl)
    // a file is never a page: a CAD drawing or an archive is a document, recorded with the documents or not at all
    if (!abs || !abs.startsWith('https:') || looksLikeImage(abs) || looksLikeDocument(abs) || /\.(dwg|dxf|zip|rar|7z)(\?|#|$)/i.test(abs)) continue
    const target = new URL(abs)
    target.hash = ''
    if (target.toString() === current.toString() || !sameSite(abs, pageUrl)) continue
    // The site's root and the listings above this page (`/`, `/katalog/`) are navigation: a project's drawings are
    // never kept on a page that contains the project (005C).
    const trimmed = (path: string): string => path.replace(/\/+$/, '')
    if (trimmed(target.pathname) === '' || (target.search === '' && current.pathname.startsWith(`${trimmed(target.pathname)}/`))) continue
    const linkWords = `${ATTR(a[1], 'title') ?? ''} ${stripTags(a[2])}`
    const words = deaccent(`${linkWords} ${safeDecode(target.pathname)}`)
    if (!DRAWING_LINK_WORDS.test(words)) continue
    // A path under the page's own path (`/projekt/x/rzuty`), or the same page with a tab (`?id=4711&tab=rzuty`), is
    // the strongest sign the link belongs to this project.
    const under = target.pathname.startsWith(current.pathname.replace(/\/$/, '') + '/') || (target.pathname === current.pathname && [...current.searchParams].every(([k, v]) => target.searchParams.get(k) === v)) ? 0 : 1
    // Otherwise the link must name this project and nothing else: in a path segment, a query value or its own words.
    if (under === 1) {
      const runs = [...target.pathname.split('/').map((seg) => tokensOf(seg.replace(/\.(html?|php|aspx?)$/i, ''))), ...[...target.searchParams.values()].map(tokensOf), tokensOf(linkWords)]
      if (!names.some((name) => runs.some((run) => namesProject(run, name)))) continue
    }
    const key = target.toString()
    if (!out.has(key)) out.set(key, under)
  }
  return [...out.entries()].sort((a, b) => a[1] - b[1] || compareCodeUnits(a[0], b[0])).map(([url]) => url).slice(0, MAX_CRAWL_PAGES)
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
    const file = safeDecode(c.url.split('/').pop() ?? '')
    const info = words.get(c.url)
    const text = deaccent(`${c.caption ?? ''} ${info?.words ?? ''}`)
    if (CHROME_NAME.test(file) || CHROME_NAME.test(text)) {
      drop(c.url, 'CHROME_ASSET', `named as site chrome ("${file.slice(0, 60)}")`)
      continue
    }
    if (c.channel === 'DOCUMENT_LINK') {
      drop(c.url, 'DOCUMENT', 'a linked document: recorded with the documents, never measured as a picture')
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
    const caption = [c.caption ?? (info?.words || undefined), info?.figcaption].filter((t): t is string => !!t && t.trim() !== '').join(' · ') || undefined
    out.push({ ...c, caption, context: info?.context, groupKey: c.groupKey ?? pictures.groups.get(c.url) })
  }
  return out.sort((a, b) => compareCodeUnits(a.url, b.url) || compareCodeUnits(a.channel, b.channel) || compareCodeUnits(a.locator, b.locator))
}

/**
 * The stem a publisher varies the size suffix of: `plan-800x600.jpg`,
 * `plan_thumb.png`, `plan@2x.png`, `plan-lo.gif` and `plan.png` are one
 * drawing. Used only as a grouping key; the bytes still decide.
 */
export function sizeStem(url: string): string | undefined {
  try {
    const u = new URL(url)
    const file = safeDecode(u.pathname.split('/').pop() ?? '')
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
