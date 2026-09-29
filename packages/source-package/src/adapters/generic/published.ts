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
import type { PageFacts } from './markup.js'

const FACT_KEYS: Array<{ test: RegExp; key: string; unit: PublishedFact['unit'] }> = [
  { test: /powierzchnia netto|\bnet area\b|^powierzchnia domu\b|\bpow\.? domu\b/, key: 'house_net_area', unit: 'm2' },
  { test: /uzytkowa bez schod/, key: 'usable_area_without_stairs', unit: 'm2' },
  { test: /powierzchnia uzytkowa|\bpow\.? uzytkowa|\busable area\b|\bliving area\b|\bfloor space\b/, key: 'usable_area', unit: 'm2' },
  { test: /garaz|\bgarage\b/, key: 'garage_area', unit: 'm2' },
  { test: /kotlown|\bboiler\b|\butility\b/, key: 'boiler_room_area', unit: 'm2' },
  { test: /zabudowy|\bfootprint\b|\bbuilt[- ]?up\b|\bbuilding area\b/, key: 'footprint_area', unit: 'm2' },
  { test: /powierzchnia podlog|\bfloor area\b/, key: 'floor_area', unit: 'm2' },
  { test: /powierzchnia dachu|\broof area\b/, key: 'roof_area', unit: 'm2' },
  { test: /kubatur|\bvolume\b/, key: 'volume', unit: 'none' },
  // The building's height, not a knee wall's or a room's: the label is anchored and the parts excluded.
  { test: /^(wysokosc|height)( (budynku|domu|calkowita|calosci|building|total|overall))?$|^(building|overall|total) height$/, key: 'building_height', unit: 'm' },
  { test: /^powierzchnia calkowita|\btotal area\b|\bgross area\b/, key: 'total_area', unit: 'm2' },
  { test: /kat (nachylenia|dachu)|nachylenie|\bpitch\b/, key: 'roof_pitch', unit: 'deg' },
  { test: /szerokosc (budynku|domu)|\bbuilding width\b/, key: 'building_width', unit: 'm' },
  { test: /dlugosc (budynku|domu)|\bbuilding length\b/, key: 'building_length', unit: 'm' },
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
  if (/m²|\bm2\b|\bmkw\b|\bsq/.test(v) || /m²|\bm2\b/.test(deaccent(label))) return 'm2'
  if (/m³|\bm3\b/.test(v)) return 'none'
  if (/°|\bst\.?\b|\bdeg\b|stopni/.test(v)) return 'deg'
  if (/\bm\b/.test(v) && fallback !== 'none') return 'm'
  return fallback
}

/** The figures a page prints, keyed by the vocabulary of their labels. First occurrence of each key wins. */
export function genericFacts(facts: PageFacts): PublishedFact[] {
  const out: PublishedFact[] = []
  const seen = new Set<string>()
  for (const p of facts.pairs) {
    const label = deaccent(p.label)
    const raw = p.value
    // a plot's two dimensions on one line: "19,05 x 20,6 m"
    if (/wymiary dzialki|\bplot (size|dimensions)\b/.test(label)) {
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
    const text = m[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    if (text.length >= 120 && /dach|dom|projekt|roof|house|storey|kondygnac|garaz|garage/i.test(deaccent(text)) && (!best || text.length > best.length)) best = text
  }
  if (best) push('description', 'description', best)
  return out.sort((a, b) => compareCodeUnits(a.key, b.key) || compareCodeUnits(a.label, b.label) || compareCodeUnits(a.text, b.text))
}
