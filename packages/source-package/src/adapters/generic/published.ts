/**
 * What a project page PRINTS about the house, read generically: the figures
 * (areas, height, volume, plot), the room schedule and the specification
 * lines, from tables, definition lists and labelled list items — by the
 * vocabulary of the labels, never by a site's class names.
 *
 * A figure is an aggregate and no geometry may be derived from one. A
 * specification is kept as printed text, because deciding what "dach
 * dwuspadowy 40°" means is a reading, and readings belong in the metric
 * layer. The keys are the same ones the specialist adapters produce, so the
 * layers downstream need not know which adapter read the page.
 */
import type { PublishedFact, PublishedRoom, PublishedSpecification, StoreyRole } from '../../schema.js'
import { compareCodeUnits, deaccent, parseLocaleNumber } from '../../text.js'
import type { LabelValue, PageFacts } from './markup.js'

type FactUnit = PublishedFact['unit']
const FACT_KEYS: Array<{ test: RegExp; key: string; unit: FactUnit }> = [
  { test: /powierzchnia netto|\bnet area\b|^powierzchnia domu\b|\bpow\.? domu\b/, key: 'house_net_area', unit: 'm2' },
  { test: /uzytkowa bez schod/, key: 'usable_area_without_stairs', unit: 'm2' },
  { test: /powierzchnia uzytkowa|\bpow\.? uzytkowa|\busable area\b|\bliving area\b|\bfloor space\b/, key: 'usable_area', unit: 'm2' },
  { test: /garaz|\bgarage\b/, key: 'garage_area', unit: 'm2' },
  { test: /kotlown|\bboiler\b|\butility\b/, key: 'boiler_room_area', unit: 'm2' },
  { test: /zabudowy|\bfootprint\b|\bbuilt[- ]?up\b|\bbuilding area\b/, key: 'footprint_area', unit: 'm2' },
  { test: /powierzchnia podlog|\bfloor area\b/, key: 'floor_area', unit: 'm2' },
  // A qualified roof area is not the roof's area: the sloped and the flat part are two figures, and neither is their sum.
  { test: /powierzchnia dachu (skosn|spadzist|strom)\w*|\bpitched roof area\b|\bsloped roof area\b/, key: 'sloped_roof_area', unit: 'm2' },
  { test: /powierzchnia dachu plask\w*|powierzchnia stropodachu|\bflat roof area\b/, key: 'flat_roof_area', unit: 'm2' },
  { test: /powierzchnia dachu|\broof area\b/, key: 'roof_area', unit: 'm2' },
  { test: /kubatur|\bvolume\b/, key: 'volume', unit: 'none' },
  // The building's height, not a knee wall's or a room's: the label is anchored and the parts excluded.
  { test: /^(wysokosc|height)( (budynku|domu|calkowita|calosci|building|total|overall))?$|^(building|overall|total) height$/, key: 'building_height', unit: 'm' },
  { test: /^powierzchnia calkowita|\btotal area\b|\bgross area\b/, key: 'total_area', unit: 'm2' },
  { test: /kat (nachylenia|dachu)|nachylenie|\bpitch\b/, key: 'roof_pitch', unit: 'deg' },
  { test: /szerokosc (budynku|domu)|\bbuilding width\b/, key: 'building_width', unit: 'm' },
  { test: /dlugosc (budynku|domu)|\bbuilding length\b/, key: 'building_length', unit: 'm' },
  // Counts, as the publisher counts them: "4 rooms" by its own convention, never checked against a plan here.
  { test: /^(liczba|ilosc) pokoi\b|^pokoje$|\bnumber of (bed)?rooms\b/, key: 'room_count', unit: 'count' },
  { test: /^(liczba|ilosc) lazienek\b|^lazienki$|\bnumber of bathrooms\b/, key: 'bathroom_count', unit: 'count' },
]

const SPEC_KEYS: Array<{ test: RegExp; key: string }> = [
  { test: /^dach\b|^roof\b/, key: 'roof' },
  { test: /^scianka kolankowa|^knee wall/, key: 'knee_wall' },
  { test: /^scian|^wall/, key: 'walls' },
  { test: /^strop|^ceiling|^floor structure/, key: 'floor_structure' },
  { test: /^fundament|^foundation/, key: 'foundation' },
  { test: /^stolarka|^okna|^drzwi|^window|^door|^joinery/, key: 'joinery' },
  { test: /^brama gara|^garage door/, key: 'garage_door' },
  { test: /^komin|^chimney/, key: 'chimney' },
  { test: /^schod|^stair/, key: 'stairs' },
  { test: /^taras|^balkon|^terrace|^balcony/, key: 'terrace' },
  { test: /^elewacj|^facade|^fasad/, key: 'facade' },
  { test: /^technolog|^konstrukc|^construction/, key: 'construction' },
]

const STOREY_WORDS: Array<{ test: RegExp; storey: StoreyRole }> = [
  { test: /\bparter\b|\bprzyziemie\b|\bground\b/, storey: 'GROUND' },
  { test: /\bpoddasz\w*|\bstrych\b|\battic\b|\bloft\b/, storey: 'ATTIC' },
  { test: /\bpietro\b|\bpietra\b|\bfirst floor\b|\bupper\b/, storey: 'UPPER' },
  { test: /\bpiwnic\w*|\bbasement\b|\bcellar\b/, storey: 'BASEMENT' },
]

const unitOf = (label: string, value: string, fallback: PublishedFact['unit']): PublishedFact['unit'] => {
  const v = deaccent(value)
  if (fallback === 'count') return 'count'
  if (/m²|\bm2\b|\bmkw\b|\bsq/.test(v) || /m²|\bm2\b/.test(deaccent(label))) return 'm2'
  if (/m³|\bm3\b/.test(v)) return 'none'
  if (/°|\bst\.?\b|\bdeg\b|stopni/.test(v)) return 'deg'
  if (/\bm\b/.test(v) && fallback !== 'none') return 'm'
  return fallback
}

const UNIT_STATED = /m²|m³|\bm2\b|\bm3\b|\bmkw\b|\bm\b|°|\bst\.?$|\bstopni|\bdeg\b/
/** A whole block that is one number and at most a unit: "278,30 m²", "30°", "4". Prose with a number in it is not. */
const VALUE_BLOCK = /^(?:ok\.?\s*|ca\.?\s*|~\s*)?\d{1,6}(?:[ \u00a0\u202f]\d{3})*(?:[.,]\d+)?\s*(?:m\s*²|m\s*³|m2|m3|mkw\.?|m|cm|°|st\.?|stopni|%|szt\.?)?$/
const isFactLabel = (text: string): string | undefined => {
  const t = text.replace(/[:\s]+$/, '').trim()
  const folded = deaccent(t)
  if (t.length < 3 || t.length > 60 || /\d/.test(t) || /[?!.]$/.test(folded.replace(/\b(min|max|dl|szer|pow|ok|gl)\.$/, '')) || t.split(/\s+/).length > 6) return undefined
  if (/wymiary dzialki|\bplot (size|dimensions)\b/.test(folded)) return 'plot'
  return FACT_KEYS.find((f) => f.test.test(folded))?.key
}
/**
 * Label/value pairs a page builds from blocks rather than a table: a short
 * label in the fact vocabulary, then the first block that is nothing but a
 * number and a unit — skipping what sits between (a tooltip, its heading,
 * its prose, its close button), and stopping at the next label. And the
 * inline form, "Powierzchnia użytkowa 172,90 m²" in one block.
 */
export function blockPairs(facts: PageFacts): LabelValue[] {
  const out: LabelValue[] = []
  // A table is the table reader's: a column header is not a row label, whatever the next cell says.
  const inTable = (at: number): boolean => facts.tables.some((t) => at >= t.offset && at < t.end) || facts.gridRanges.some(([a, b]) => at >= a && at < b)
  // A card linking to another page is that page's summary: "165,40 m²" under a related project's name is not this house.
  const cards = [...facts.body.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"'#][^"']*)["'][^>]*>[\s\S]{0,6000}?<\/a>/gi)]
    .filter((a) => !/\.(pdf|dwg|dxf|jpe?g|png|gif|webp)(\?|#|$)/i.test(a[1]) && !/^(javascript|mailto|tel):/i.test(a[1]))
    .map((a) => [a.index ?? 0, (a.index ?? 0) + a[0].length] as [number, number])
  const inCard = (at: number): boolean => cards.some(([a, b]) => at >= a && at < b)
  const blocks = facts.blocks.filter((b) => !inTable(b.offset) && !inCard(b.offset))
  const claimed = new Set<number>()
  // What may stand between a label and its value: the label again, prose, a control's caption, a glyph.
  const passable = (b: { text: string; tag: string }, key: string): boolean =>
    isFactLabel(b.text) === key || b.text.split(/\s+/).length >= 6 || b.text.length >= 40 || ['button', 'option', 'select', 'textarea'].includes(b.tag) || !/[a-z0-9]/i.test(deaccent(b.text))
  for (let i = 0; i < blocks.length; i++) {
    const text = blocks[i].text
    const inline = /^(.{3,60}?)\s*[:–-]?\s+((?:ok\.?\s*)?\d[\d \u00a0.,]*\s*(?:m\s*²|m\s*³|m2|m3|mkw\.?|m|°|st\.?)?)$/.exec(text)
    if (inline && isFactLabel(inline[1])) {
      out.push({ label: inline[1].replace(/[:\s]+$/, ''), value: inline[2], source: 'inline', offset: blocks[i].offset })
      continue
    }
    const key = isFactLabel(text)
    if (!key) continue
    for (let j = i + 1; j < Math.min(blocks.length, i + 13); j++) {
      const next = blocks[j].text
      if (VALUE_BLOCK.test(deaccent(next))) {
        if (!claimed.has(j)) {
          claimed.add(j)
          out.push({ label: text.replace(/[:\s]+$/, ''), value: next, source: 'block', offset: blocks[i].offset })
        }
        break
      }
      if (!passable(blocks[j], key)) break
    }
  }
  return out
}

/** The figures a page prints, keyed by the vocabulary of their labels. First occurrence of each key wins. */
export function genericFacts(facts: PageFacts): PublishedFact[] {
  const out: PublishedFact[] = []
  const seen = new Set<string>()
  // The structured readers first, whole; the block reader only fills keys they did not state.
  // Two different block readings of one key is a question, not a first-wins: the key is left out.
  const blockValues = new Map<string, Set<number>>()
  for (const p of blockPairs(facts)) {
    const k = FACT_KEYS.find((f) => f.test.test(deaccent(p.label)))?.key
    const v = parseLocaleNumber(p.value)
    if (k && v !== null) blockValues.set(k, (blockValues.get(k) ?? new Set()).add(v))
  }
  const ambiguous = new Set([...blockValues.entries()].filter(([, vs]) => vs.size > 1).map(([k]) => k))
  for (const p of [...facts.pairs, ...blockPairs(facts).filter((b) => !ambiguous.has(FACT_KEYS.find((f) => f.test.test(deaccent(b.label)))?.key ?? ''))]) {
    const label = deaccent(p.label)
    const raw = p.value
    // a plot's two dimensions on one line: "21,40 x 18,5 m"
    if (/wymiary dzialki|\bplot (size|dimensions)\b/.test(label)) {
      // one dimension per line: "Min. wymiary działki dł." | "23,48 m"
      const single = /\b(szer\w*|width)\b/.test(label) ? 'plot_min_width' : /\b(dl|dlug\w*|glebok\w*|length|depth)\b/.test(label) ? 'plot_min_depth' : undefined
      if (single && !/[x×]/.test(raw)) {
        const v = parseLocaleNumber(raw)
        if (v !== null && v > 0 && !seen.has(single)) {
          seen.add(single)
          out.push({ key: single, label: p.label, value: v, unit: 'm', raw })
        }
        continue
      }
      const m = /(\d+[.,]?\d*)\s*[x×]\s*(\d+[.,]?\d*)/.exec(raw)
      if (m) {
        for (const [key, text] of [
          ['plot_min_width', m[1]],
          ['plot_min_depth', m[2]],
        ] as const) {
          const value = parseLocaleNumber(text)
          if (value !== null && !seen.has(key)) {
            seen.add(key)
            out.push({ key, label: p.label, value, unit: 'm', raw })
          }
        }
      }
      continue
    }
    const mapped = FACT_KEYS.find((f) => f.test.test(label))
    if (!mapped || seen.has(mapped.key)) continue
    const value = parseLocaleNumber(raw)
    if (value === null || value <= 0) continue
    // Precision before reach, for every reader: a figure is a number and its unit, not a sentence with a number in it;
    // a dimensional figure states its unit (in the value or the label); a count is a whole number; a label with a digit is a feature line.
    if (/\d/.test(p.label.replace(/^\s*\d{1,2}\.\s+/, ''))) continue
    if (!VALUE_BLOCK.test(deaccent(raw.trim()))) continue
    if (p.source === 'block' || p.source === 'inline' || mapped.unit === 'count') {
      if (mapped.unit === 'count' ? !/^\d{1,3}$/.test(raw.trim()) : !UNIT_STATED.test(deaccent(raw)) && !UNIT_STATED.test(label)) continue
    }
    seen.add(mapped.key)
    out.push({ key: mapped.key, label: p.label, value, unit: unitOf(p.label, raw, mapped.unit), raw })
  }
  return out.sort((a, b) => compareCodeUnits(a.key, b.key))
}

/**
 * The room schedule: tables whose rows are `N. name | area`, on the storey
 * a heading above the table or a row inside it names. A table that names
 * no storey contributes nothing: a room on an unknown storey is a guess.
 */
export function genericRooms(facts: PageFacts): PublishedRoom[] {
  const rooms: PublishedRoom[] = []
  const seen = new Set<string>()
  for (const t of facts.tables) {
    const inTable = t.rows.slice(0, 4).flatMap((r) => r.cells).map(deaccent).join(' ')
    const above = deaccent(t.headingBefore ?? '')
    const storey = STOREY_WORDS.find((s) => s.test.test(inTable))?.storey ?? STOREY_WORDS.find((s) => s.test.test(above))?.storey
    if (!storey) continue
    for (const r of t.rows) {
      const cells = r.cells.filter((c) => c !== '')
      if (cells.length < 2) continue
      // "1. Salon | 29,52", or the number in a cell of its own: "1." | "Salon" | "29,52"
      let index: number | undefined
      let label: string | undefined
      let areaText: string | undefined
      const joined = /^(\d{1,2})\.?\s+(.+)$/.exec(cells[0])
      const alone = /^(\d{1,2})\.?$/.exec(cells[0])
      if (joined) [index, label, areaText] = [Number(joined[1]), joined[2].trim(), cells[1]]
      else if (alone && cells.length >= 3) [index, label, areaText] = [Number(alone[1]), cells[1].trim(), cells[2]]
      if (index === undefined || !label || areaText === undefined || /\d/.test(label.replace(/\s/g, '')) && /^[\d.,\s]+$/.test(label)) continue
      const area = parseLocaleNumber(areaText)
      if (area === null || area <= 0) continue
      const key = `${storey}:${index}`
      if (seen.has(key)) continue
      seen.add(key)
      rooms.push({ storey, index, label, area, raw: cells.slice(0, 4).join(' | ') })
    }
  }
  return rooms.sort((a, b) => compareCodeUnits(a.storey, b.storey) || a.index - b.index)
}

/** Specification lines by the vocabulary of their labels, plus the page's own descriptions. */
export function genericSpecifications(facts: PageFacts): PublishedSpecification[] {
  const out: PublishedSpecification[] = []
  const seen = new Set<string>()
  const push = (key: string, label: string, text: string): void => {
    const trimmed = text.replace(/\s+/g, ' ').trim()
    if (trimmed.length < 3) return
    const dedupe = `${key}::${trimmed}`
    if (seen.has(dedupe)) return
    seen.add(dedupe)
    out.push({ key, label, text: trimmed })
  }
  for (const p of facts.pairs) {
    const label = deaccent(p.label)
    const spec = SPEC_KEYS.find((k) => k.test.test(label))
    if (spec) push(spec.key, p.label, p.value)
  }
  if (facts.metaDescription) push('summary', 'meta description', facts.metaDescription)
  if (facts.ogDescription && facts.ogDescription !== facts.metaDescription) push('summary', 'og:description', facts.ogDescription)
  // The longest paragraph that talks about the house: a publisher's prose is where "a gable roof with no eaves" is said.
  let best: string | undefined
  for (const m of facts.body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const at = m.index ?? 0
    if (facts.formRanges.some(([a, b]) => at >= a && at < b)) continue
    const text = m[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    const folded = deaccent(text)
    if (/danych osobowych|dane osobowe|\brodo\b|polityk\w* prywatnosci|\bcookies?\b|wyrazam zgode|personal data|privacy policy/.test(folded)) continue
    if (text.length >= 120 && /\bdach\w*|\bdom(u|y|ie|em)?\b|\bprojekt\w*|\broof\b|\bhouse\b|\bstorey\b|\bkondygnac\w*|\bgaraz\w*|\bgarage\b/.test(folded) && (!best || text.length > best.length)) best = text
  }
  if (best) push('description', 'description', best)
  return out.sort((a, b) => compareCodeUnits(a.key, b.key) || compareCodeUnits(a.label, b.label) || compareCodeUnits(a.text, b.text))
}
