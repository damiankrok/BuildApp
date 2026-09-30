/**
 * Where on a page a statement sits, and whether it is the page's own (005C).
 *
 * A figure or a document is this house's only when it sits outside the site's
 * chrome (navigation, footers), outside forms and controls — a filter's
 * "50 m²" is a search, not a house — and outside a CARD: the smallest element
 * around it that links to another page, when that element links to at most
 * two pages and does not hold the page's own title. That is what a related-
 * project tile, a "recently viewed" strip or a listing entry is, however it
 * is styled: a summary of somewhere else. A card links out through its
 * TITLE — its picture, its heading, or the link it opens with; a link in the
 * middle of small print (a privacy policy under a form) makes nothing a card.
 * Stated in structure, never in a site's class names.
 */
import { absolutize, decodeEntities } from '../../discovery.js'
import { stripTags } from '../../text.js'
import { pathAt, type BlockElement, type PageFacts } from './markup.js'

export type Exclusion = 'LINK' | 'CONTROL' | 'CHROME' | 'CARD'

/** Elements whose contents are a control or its caption: a form, a picker, a button, a modal. */
const CONTROL_TAGS = new Set(['form', 'select', 'option', 'textarea', 'button', 'label', 'fieldset', 'dialog'])
/** Elements whose contents are the site's, not the page's. */
const CHROME_TAGS = new Set(['nav', 'footer'])
/** A card links to one page, two at most (the picture and the title, a "compare" beside them). */
const MAX_CARD_TARGETS = 2
const NOT_A_PAGE = /\.(pdf|dwg|dxf|zip|rar|7z|jpe?g|png|gif|webp|bmp|svg)(\?|#|$)/i

const ATTR = (tag: string, name: string): string | undefined => {
  const m = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag)
  return m ? decodeEntities(m[2] ?? m[3] ?? m[4] ?? '') : undefined
}

type Link = { start: number; end: number; target: string; pictured: boolean }

export type PageRegions = {
  /** Why a statement at this offset (inside these block elements, outermost first) is not the page's own; undefined: it is. */
  excluded: (offset: number, path?: readonly number[]) => Exclusion | undefined
}

/** The page's own address without its fragment and trailing slash, for telling a link elsewhere from a link to itself. */
const pageKey = (url: string): string => {
  try {
    const u = new URL(url)
    u.hash = ''
    return u.toString().replace(/\/+$/, '')
  } catch {
    return url
  }
}

/** Every link to another page of any site: an anchor with an address that is not a fragment, a script or a file. */
function pageLinks(facts: PageFacts): Link[] {
  const own = new Set([pageKey(facts.url), ...(facts.canonicalUrl ? [pageKey(absolutize(facts.canonicalUrl, facts.url) ?? facts.canonicalUrl)] : [])])
  const out: Link[] = []
  for (const a of facts.body.matchAll(/<a\b([^>]*)>([\s\S]{0,8000}?)<\/a>/gi)) {
    const href = ATTR(a[1], 'href')?.trim()
    if (!href || href.startsWith('#') || /^(javascript|mailto|tel):/i.test(href) || NOT_A_PAGE.test(href)) continue
    const abs = absolutize(href, facts.url)
    if (!abs || !/^https?:/i.test(abs)) continue
    const target = pageKey(abs)
    if (own.has(target)) continue
    const start = a.index ?? 0
    out.push({ start, end: start + a[0].length, target, pictured: /<(img|picture|h[1-6])\b/i.test(a[2]) })
  }
  return out
}

export function pageRegions(facts: PageFacts): PageRegions {
  const links = pageLinks(facts)
  const elements: readonly BlockElement[] = facts.elements
  const h1 = facts.headings.find((h) => h.level === 1)?.offset
  const headings = [...facts.body.matchAll(/<h([1-6])\b[^>]*>[\s\S]*?<\/h\1>/gi)].map((m) => [m.index ?? 0, (m.index ?? 0) + m[0].length] as [number, number])
  /** A link that is the element's title: it wraps a picture or a heading, sits in a heading, or is the first text the element has. */
  const titleLink = (l: Link, e: BlockElement): boolean => l.pictured || headings.some(([a, b]) => l.start > a && l.start < b) || stripTags(facts.body.slice(e.start, l.start)) === ''
  const memo = new Map<number, 'CARD' | 'STOP' | 'OUT'>()
  /** CARD: this element is a card. STOP: it links to too many pages to be one, and so does everything around it. OUT: look further out. */
  const verdict = (id: number): 'CARD' | 'STOP' | 'OUT' => {
    const known = memo.get(id)
    if (known) return known
    const e = elements[id]
    const inside = links.filter((l) => l.start >= e.start && l.start < e.end)
    const holdsH1 = h1 !== undefined && h1 >= e.start && h1 < e.end
    const v = inside.length === 0 ? 'OUT' : holdsH1 || new Set(inside.map((l) => l.target)).size > MAX_CARD_TARGETS ? 'STOP' : inside.some((l) => titleLink(l, e)) ? 'CARD' : 'OUT'
    memo.set(id, v)
    return v
  }
  return {
    excluded: (offset, known) => {
      if (links.some((l) => offset > l.start && offset < l.end)) return 'LINK'
      if (facts.formRanges.some(([a, b]) => offset >= a && offset < b)) return 'CONTROL'
      const path = known ?? pathAt(elements, offset)
      if (path.some((id) => CONTROL_TAGS.has(elements[id].tag))) return 'CONTROL'
      if (path.some((id) => CHROME_TAGS.has(elements[id].tag))) return 'CHROME'
      for (let i = path.length - 1; i >= 0; i--) {
        const v = verdict(path[i])
        if (v === 'CARD') return 'CARD'
        if (v === 'STOP') return undefined
      }
      return undefined
    },
  }
}
