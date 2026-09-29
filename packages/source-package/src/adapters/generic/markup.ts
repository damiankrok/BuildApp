/**
 * Semantic reading of a project page's markup, without a DOM and without
 * running anything in it.
 *
 * A page is read for what it SAYS about itself: its title and canonical
 * address, its OpenGraph and description metas, its JSON-LD (parsed as data,
 * never evaluated), its headings, its tables and definition lists, and how
 * much text there is once the scripts are gone. Everything here is a bounded
 * regular-expression scan over the markup; no script is executed, no style is
 * applied, no network is touched.
 */
import { decodeEntities, stripScripts } from '../../discovery.js'
import { deaccent, stripTags } from '../../text.js'

export type Heading = { level: number; text: string; offset: number }
export type TableRow = { cells: string[]; offset: number }
export type Table = { rows: TableRow[]; offset: number; end: number; headingBefore?: string }
export type LabelValue = { label: string; value: string; source: 'table' | 'dl' | 'li' | 'meta'; offset: number }

export type JsonLdNode = Record<string, unknown>

export type PageFacts = {
  url: string
  /** The markup with scripts, styles and comments blanked, positions preserved as far as the blanks allow. */
  body: string
  title?: string
  canonicalUrl?: string
  ogTitle?: string
  ogType?: string
  ogDescription?: string
  metaDescription?: string
  lang?: string
  h1?: string
  headings: Heading[]
  tables: Table[]
  /** Every label → value pair the page prints as such: two-cell table rows, dt/dd pairs, `label: value` list items. */
  pairs: LabelValue[]
  jsonLd: JsonLdNode[]
  /** Words on the page once the markup is gone. */
  text: string
  textLength: number
  scriptCount: number
  /** `<noscript>` says the page wants a browser, or the body is one empty mount point. */
  scriptShellHints: string[]
  imageCount: number
}

const ATTR = (tag: string, name: string): string | undefined => {
  const m = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag)
  return m ? decodeEntities(m[2] ?? m[3] ?? m[4] ?? '') : undefined
}

const metaContent = (html: string, key: 'property' | 'name', value: string): string | undefined => {
  for (const m of html.matchAll(/<meta\b([^>]*)>/gi)) {
    const k = ATTR(m[1], key)
    if (k?.toLowerCase() === value) return ATTR(m[1], 'content')?.trim()
  }
  return undefined
}

/** JSON-LD blocks, parsed as data. A block that is not JSON is skipped; `@graph` arrays are flattened. */
export function readJsonLd(html: string): JsonLdNode[] {
  const out: JsonLdNode[] = []
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const type = ATTR(m[1], 'type')?.toLowerCase() ?? ''
    if (!type.includes('ld+json')) continue
    let parsed: unknown
    try {
      parsed = JSON.parse(m[2].trim())
    } catch {
      continue
    }
    const push = (node: unknown): void => {
      if (Array.isArray(node)) {
        for (const n of node) push(n)
        return
      }
      if (node && typeof node === 'object') {
        const record = node as JsonLdNode
        out.push(record)
        if (Array.isArray(record['@graph'])) for (const n of record['@graph'] as unknown[]) push(n)
      }
    }
    push(parsed)
  }
  return out
}

/** Every heading, with its offset in `body`, in document order. */
function readHeadings(body: string): Heading[] {
  const out: Heading[] = []
  for (const m of body.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    const text = stripTags(m[2])
    if (text) out.push({ level: Number(m[1]), text, offset: m.index ?? 0 })
  }
  return out
}

function readTables(body: string, headings: readonly Heading[]): Table[] {
  const out: Table[] = []
  for (const t of body.matchAll(/<table\b[\s\S]*?<\/table>/gi)) {
    const offset = t.index ?? 0
    const rows: TableRow[] = []
    for (const r of t[0].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...r[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => stripTags(c[1]))
      if (cells.length > 0) rows.push({ cells, offset: offset + (r.index ?? 0) })
    }
    const before = [...headings].reverse().find((h) => h.offset < offset)
    out.push({ rows, offset, end: offset + t[0].length, headingBefore: before?.text })
  }
  return out
}

function readPairs(body: string, tables: readonly Table[]): LabelValue[] {
  const out: LabelValue[] = []
  for (const t of tables) {
    for (const r of t.rows) {
      // two cells, or a label cell followed by exactly one non-empty value cell
      const nonEmpty = r.cells.filter((c) => c !== '')
      if (nonEmpty.length === 2 && r.cells[0] !== '') out.push({ label: nonEmpty[0], value: nonEmpty[1], source: 'table', offset: r.offset })
    }
  }
  for (const dl of body.matchAll(/<dl\b[\s\S]*?<\/dl>/gi)) {
    const at = dl.index ?? 0
    const items = [...dl[0].matchAll(/<(dt|dd)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    for (let i = 0; i + 1 < items.length; i++) {
      if (items[i][1].toLowerCase() === 'dt' && items[i + 1][1].toLowerCase() === 'dd') {
        const label = stripTags(items[i][2])
        const value = stripTags(items[i + 1][2])
        if (label && value) out.push({ label, value, source: 'dl', offset: at + (items[i].index ?? 0) })
      }
    }
  }
  for (const li of body.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const text = stripTags(li[1])
    const m = /^([^:]{2,60}):\s*(.{1,200})$/.exec(text)
    if (m) out.push({ label: m[1].trim(), value: m[2].trim(), source: 'li', offset: li.index ?? 0 })
  }
  return out.sort((a, b) => a.offset - b.offset)
}

/** Read everything a page states about itself. Pure, bounded, deterministic. */
export function readPageFacts(html: string, url: string): PageFacts {
  const body = stripScripts(html)
  const headings = readHeadings(body)
  const tables = readTables(body, headings)
  const title = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(body)
  const canonical = [...body.matchAll(/<link\b([^>]*)>/gi)].map((m) => m[1]).find((attrs) => ATTR(attrs, 'rel')?.toLowerCase() === 'canonical')
  const lang = /<html\b([^>]*)>/i.exec(body)
  const text = stripTags(body.replace(/<(head|nav|footer|header|noscript)\b[\s\S]*?<\/\1>/gi, ' '))
  const shellHints: string[] = []
  for (const m of html.matchAll(/<noscript\b[^>]*>([\s\S]*?)<\/noscript>/gi)) {
    const words = deaccent(stripTags(m[1]))
    if (/javascript|skrypt|enable|wlacz/.test(words)) shellHints.push(`noscript: ${stripTags(m[1]).slice(0, 80)}`)
  }
  const bodyMarkup = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(body)?.[1] ?? body
  if (/^\s*(<div\b[^>]*>\s*<\/div>|<[a-z]+-root\b[^>]*>\s*<\/[a-z]+-root>)\s*$/i.test(bodyMarkup)) shellHints.push('the body is one empty mount point')
  return {
    url,
    body,
    title: title ? stripTags(title[1]) : undefined,
    canonicalUrl: canonical ? ATTR(canonical, 'href') : undefined,
    ogTitle: metaContent(body, 'property', 'og:title'),
    ogType: metaContent(body, 'property', 'og:type'),
    ogDescription: metaContent(body, 'property', 'og:description'),
    metaDescription: metaContent(body, 'name', 'description'),
    lang: lang ? ATTR(lang[1], 'lang') : undefined,
    h1: headings.find((h) => h.level === 1)?.text,
    headings,
    tables,
    pairs: readPairs(body, tables),
    jsonLd: readJsonLd(html),
    text,
    textLength: text.length,
    scriptCount: (html.match(/<script\b/gi) ?? []).length,
    scriptShellHints: shellHints,
    imageCount: (body.match(/<img\b/gi) ?? []).length,
  }
}

/** The nearest heading above an offset, and any figure caption just after it. */
export function contextAt(facts: PageFacts, offset: number): string | undefined {
  const heading = [...facts.headings].reverse().find((h) => h.offset < offset)
  const after = facts.body.slice(offset, offset + 1500)
  const figcaption = /<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i.exec(after)
  const parts = [heading?.text, figcaption ? stripTags(figcaption[1]) : undefined].filter((p): p is string => !!p)
  return parts.length > 0 ? parts.join(' · ') : undefined
}

/** The JSON-LD values under any of `keys`, as strings, first found first. */
export function jsonLdStrings(nodes: readonly JsonLdNode[], keys: readonly string[]): string[] {
  const out: string[] = []
  const visit = (node: unknown, depth: number): void => {
    if (depth > 4 || !node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const n of node) visit(n, depth + 1)
      return
    }
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (keys.includes(k) && (typeof v === 'string' || typeof v === 'number')) out.push(String(v))
      else if (v && typeof v === 'object') visit(v, depth + 1)
    }
  }
  for (const n of nodes) visit(n, 0)
  return out
}

/** The `@type` values of every JSON-LD node, lowercased. */
export const jsonLdTypes = (nodes: readonly JsonLdNode[]): string[] =>
  nodes.flatMap((n) => {
    const t = n['@type']
    return (Array.isArray(t) ? t : [t]).filter((x): x is string => typeof x === 'string').map((x) => x.toLowerCase())
  })
