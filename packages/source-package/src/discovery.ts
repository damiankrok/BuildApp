/**
 * Discovery: turning a page's markup into candidate assets.
 *
 * Discovery is deliberately GENEROUS and deliberately DUMB. It records every
 * address the page exposes, through every channel it exposes it, and never
 * decides which is best — that is the variant policy's job, and it can only be
 * done after the bytes have been fetched and decoded. Duplication is the
 * point: the same drawing reached through two channels is corroboration, and
 * the channel a candidate arrived through is evidence about how much to trust
 * its crop.
 *
 * Nothing here fetches. Nothing here parses with a DOM (there is none in a
 * pure module); the markup is scanned with bounded regular expressions.
 */

/** How an address was found. Ordered from most to least trustworthy as a statement of what the asset IS. */
export type DiscoveryChannel = 'ANCHOR_HREF' | 'FLOOR_PLAN_ATTR' | 'OG_IMAGE' | 'LIGHTBOX_ENDPOINT' | 'IMG_SRCSET' | 'IMG_SRC' | 'IMG_LAZY_ATTR' | 'DOCUMENT_LINK' | 'VARIANT_CONVENTION'

/**
 * How much a channel's copy can be trusted to define what the asset IS —
 * its crop and its descriptive naming. NOT how big it is: size is measured,
 * never inferred from a channel.
 *
 * The page's own `<img>` is where the descriptive filename and the alt text
 * live, so it defines the drawing's identity; a lightbox anchor points at the
 * publisher's original of exactly that element, so it is stronger still. A
 * conventional guess at a larger address is the weakest thing here: it is a
 * hypothesis until the bytes come back.
 */
export const CHANNEL_TRUST: Record<DiscoveryChannel, number> = {
  ANCHOR_HREF: 90,
  FLOOR_PLAN_ATTR: 85,
  OG_IMAGE: 80,
  LIGHTBOX_ENDPOINT: 75,
  IMG_SRCSET: 60,
  IMG_SRC: 50,
  IMG_LAZY_ATTR: 45,
  DOCUMENT_LINK: 40,
  VARIANT_CONVENTION: 10,
}

/** One address the markup exposed, with everything known about it before a byte is fetched. */
export type DiscoveredCandidate = {
  url: string
  channel: DiscoveryChannel
  /** The document whose markup exposed it: the page URL, or a discovery endpoint. */
  exposedBy: string
  /** Where in that markup, e.g. `img[src]`, `a[href]`, `img[data-floor-pom-img]`. */
  locator: string
  caption?: string
  declaredWidth?: number
  declaredHeight?: number
  /**
   * Candidates sharing a non-empty `groupKey` are the same logical asset by
   * STRUCTURE rather than by name. That matters because a publisher's
   * high-resolution original often carries no descriptive slug at all, so a
   * name comparison would file a 1280 px elevation as an unrelated picture.
   */
  groupKey?: string
}

const ATTR = (tag: string, name: string): string | undefined => {
  const m = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag)
  if (!m) return undefined
  return decodeEntities(m[2] ?? m[3] ?? m[4] ?? '')
}

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', oacute: 'ó', '#39': "'" }

export function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, body: string) => {
    const key = body.toLowerCase()
    if (NAMED[key] !== undefined) return NAMED[key]
    if (key.startsWith('#x')) return String.fromCodePoint(parseInt(key.slice(2), 16))
    if (key.startsWith('#')) return String.fromCodePoint(parseInt(key.slice(1), 10))
    return whole
  })
}

/** Remove script, style and comment bodies: their contents are not page text and confuse every text rule. */
export const stripScripts = (html: string): string =>
  html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')

const toInt = (v: string | undefined): number | undefined => {
  if (v === undefined) return undefined
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/**
 * Resolve an address against a base. Relative, root-relative and absolute
 * forms all go through the URL parser rather than string concatenation,
 * because a publisher that serves its markup from one host and its assets
 * from another will otherwise produce addresses that 404 *and* split one
 * asset into two.
 */
export function absolutize(href: string, base: string): string | null {
  try {
    return new URL(href.trim(), base).toString()
  } catch {
    return null
  }
}

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp)(\?|#|$)/i
const DOC_EXT = /\.(pdf)(\?|#|$)/i

export const looksLikeImage = (url: string): boolean => IMAGE_EXT.test(url)
export const looksLikeDocument = (url: string): boolean => DOC_EXT.test(url)

export type DiscoveryOptions = {
  /** Base URL for resolving relative addresses. */
  base: string
  /** The document these candidates came from (the page, or an endpoint). */
  exposedBy: string
  /** Keep only addresses this predicate accepts — used to drop site chrome before anything is fetched. */
  accept?: (url: string) => boolean
  /** Endpoint paths worth fetching and re-scanning, matched against an `a[data-src]` value. */
  endpointPattern?: RegExp
}

const LAZY_ATTRS = ['data-src', 'data-original', 'data-lazy-src', 'data-lazy', 'data-echo'] as const

/**
 * Scan markup for every image address it exposes.
 *
 * Anchors are handled first and with their contents, because an anchor that
 * WRAPS an image is the publisher saying "this small copy and this large copy
 * are the same picture" — a structural statement far stronger than any
 * filename comparison, and the only thing that pairs a descriptive page copy
 * with an original whose filename carries no description at all.
 */
export function discoverImages(html: string, opts: DiscoveryOptions): DiscoveredCandidate[] {
  const out: DiscoveredCandidate[] = []
  const accept = opts.accept ?? (() => true)
  const push = (c: DiscoveredCandidate | null): void => {
    if (c && accept(c.url)) out.push(c)
  }
  const seenInAnchor = new Set<string>()

  // --- anchors, with whatever they wrap ---
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]{0,4000}?)<\/a>/gi)) {
    const attrs = m[1]
    const inner = m[2]
    const href = ATTR(attrs, 'href')
    const caption = ATTR(attrs, 'data-caption') ?? ATTR(attrs, 'title')
    const innerImgs = [...inner.matchAll(/<img\b([^>]*)>/gi)]
    const innerUrls: string[] = []
    for (const im of innerImgs) {
      const src = ATTR(im[1], 'src')
      const abs = src ? absolutize(src, opts.base) : null
      if (abs) innerUrls.push(abs)
    }
    // the anchor and the images it wraps are one logical asset
    const hrefAbs = href && href !== 'javascript:;' ? absolutize(href, opts.base) : null
    const groupKey = hrefAbs && looksLikeImage(hrefAbs) ? `anchor:${hrefAbs}` : innerUrls.length > 0 ? `anchor:${innerUrls[0]}` : undefined

    if (hrefAbs && looksLikeImage(hrefAbs)) {
      push({ url: hrefAbs, channel: 'ANCHOR_HREF', exposedBy: opts.exposedBy, locator: 'a[href]', caption, groupKey })
      seenInAnchor.add(hrefAbs)
    } else if (hrefAbs && looksLikeDocument(hrefAbs)) {
      push({ url: hrefAbs, channel: 'DOCUMENT_LINK', exposedBy: opts.exposedBy, locator: 'a[href]', caption })
    }
    for (const im of innerImgs) {
      for (const c of imgCandidates(im[1], opts, caption, groupKey)) {
        push(c)
        seenInAnchor.add(c.url)
      }
    }
  }

  // --- every remaining img ---
  for (const m of html.matchAll(/<img\b([^>]*)>/gi)) {
    for (const c of imgCandidates(m[1], opts, undefined, undefined)) {
      if (!seenInAnchor.has(c.url)) push(c)
    }
  }

  // --- og:image ---
  for (const m of html.matchAll(/<meta\b([^>]*)>/gi)) {
    const attrs = m[1]
    const prop = (ATTR(attrs, 'property') ?? ATTR(attrs, 'name') ?? '').toLowerCase()
    if (prop !== 'og:image' && prop !== 'og:image:secure_url' && prop !== 'twitter:image') continue
    const content = ATTR(attrs, 'content')
    const abs = content ? absolutize(content, opts.base) : null
    if (abs && looksLikeImage(abs)) push({ url: abs, channel: 'OG_IMAGE', exposedBy: opts.exposedBy, locator: `meta[${prop}]` })
  }

  return dedupe(out)
}

function imgCandidates(attrs: string, opts: DiscoveryOptions, inheritedCaption: string | undefined, groupKey: string | undefined): DiscoveredCandidate[] {
  const out: DiscoveredCandidate[] = []
  const caption = inheritedCaption ?? ATTR(attrs, 'alt') ?? ATTR(attrs, 'title')
  const declaredWidth = toInt(ATTR(attrs, 'width'))
  const declaredHeight = toInt(ATTR(attrs, 'height'))
  const add = (url: string | undefined, channel: DiscoveryChannel, locator: string): void => {
    const abs = url ? absolutize(url, opts.base) : null
    if (abs && looksLikeImage(abs)) out.push({ url: abs, channel, exposedBy: opts.exposedBy, locator, caption, declaredWidth, declaredHeight, groupKey })
  }
  add(ATTR(attrs, 'src'), 'IMG_SRC', 'img[src]')
  // a plan published only through a bespoke attribute is invisible to any src-only scan
  for (const name of ['data-floor-pom-img', 'data-floor-img', 'data-plan-img']) {
    const v = ATTR(attrs, name)
    if (v) add(v, 'FLOOR_PLAN_ATTR', `img[${name}]`)
  }
  for (const name of LAZY_ATTRS) {
    const v = ATTR(attrs, name)
    if (v && IMAGE_EXT.test(v)) add(v, 'IMG_LAZY_ATTR', `img[${name}]`)
  }
  const srcset = ATTR(attrs, 'srcset')
  if (srcset) {
    // descriptors are a CLAIM about size and are used only for ordering; whether a
    // copy really carries more pixels is settled by decoding it
    for (const entry of srcset.split(',')) {
      const url = entry.trim().split(/\s+/)[0]
      if (url) add(url, 'IMG_SRCSET', 'img[srcset]')
    }
  }
  return out
}

/** Endpoint addresses the page says can be fetched for more markup. */
export function discoverEndpoints(html: string, opts: DiscoveryOptions): Array<{ url: string; caption?: string }> {
  if (!opts.endpointPattern) return []
  const out: Array<{ url: string; caption?: string }> = []
  const seen = new Set<string>()
  for (const m of html.matchAll(/<a\b([^>]*)>/gi)) {
    const attrs = m[1]
    const dataSrc = ATTR(attrs, 'data-src')
    if (!dataSrc || !opts.endpointPattern.test(dataSrc)) continue
    const abs = absolutize(dataSrc, opts.base)
    if (!abs || seen.has(abs)) continue
    seen.add(abs)
    out.push({ url: abs, caption: ATTR(attrs, 'data-caption') ?? ATTR(attrs, 'title') })
  }
  for (const m of html.matchAll(/\bdata-path\s*=\s*"([^"]+)"/gi)) {
    if (!opts.endpointPattern.test(m[1])) continue
    const abs = absolutize(m[1], opts.base)
    if (!abs || seen.has(abs)) continue
    seen.add(abs)
    out.push({ url: abs })
  }
  return out.sort((a, b) => a.url.localeCompare(b.url))
}

/** One record per (url, channel, exposedBy); the same address through two channels stays two records, because that is corroboration. */
function dedupe(list: readonly DiscoveredCandidate[]): DiscoveredCandidate[] {
  const seen = new Set<string>()
  const out: DiscoveredCandidate[] = []
  for (const c of list) {
    const key = `${c.url}|${c.channel}|${c.exposedBy}|${c.locator}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(c)
  }
  return out.sort((a, b) => a.url.localeCompare(b.url) || a.channel.localeCompare(b.channel) || a.locator.localeCompare(b.locator))
}
