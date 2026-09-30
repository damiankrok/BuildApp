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
import { pageRegions, type PageRegions } from './regions.js'

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
  { test: /powierzchnia dachu|\bpow\.? dachu\b|\broof area\b/, key: 'roof_area', unit: 'm2' },
  { test: /kubatur|\bvolume\b/, key: 'volume', unit: 'none' },
  // The building's height, not a knee wall's or a room's: the label is anchored and the parts excluded.
  { test: /^(wysokosc|height)( (budynku|domu|calkowita|calosci|building|total|overall))?$|^(building|overall|total) height$/, key: 'building_height', unit: 'm' },
  { test: /^powierzchnia calkowita|\btotal area\b|\bgross area\b/, key: 'total_area', unit: 'm2' },
  // the roof's pitch, never the terrain's
  { test: /kat (nachylenia( dachu| polaci)?|dachu)$|^(glowny )?kat nachylenia (dachu|polaci)|nachylenie (dachu|polaci)|\broof pitch\b|^pitch$/, key: 'roof_pitch', unit: 'deg' },
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

// ---------------------------------------------------------------------------
// Shapes (005C). A figure is one number and at most its unit; a figure with a
// bound or an estimate on it ("do 150 m²", "ok. 160 m²", "150–180 m²") or a
// blank ("—") holds its label's place and states no value.
// ---------------------------------------------------------------------------

const NUMBER = String.raw`\d{1,6}(?:[   ]\d{3})*(?:[.,]\d+)?`
const UNIT = String.raw`(?:m\s*²|m\s*³|m2|m3|mkw\.?|m\s*kw\.?|m|cm|mm|°|st\.?|stopni|%|szt\.?)`
const QUALIFIER = String.raw`(?:ok\.?|ca\.?|~|≈|okolo|do|od|max\.?|maks\.?|min\.?|ponad|powyzej|ponizej|nie wiecej niz|up to|approx\.?|about|around|<|>|≤|≥)`
/** A whole block that is one number and at most a unit: a figure. Prose with a number in it is not. */
const VALUE_BLOCK = new RegExp(`^${NUMBER}\\s*${UNIT}?$`)
/** Two plot dimensions in one: "21,15 x 24,60 m". */
const PLOT_BLOCK = new RegExp(`^(${NUMBER})\\s*(?:m\\s*)?[x×]\\s*(${NUMBER})\\s*m$`)
/** A bound, an estimate or a range where a figure would stand: it takes the figure's place and states none. */
const QUALIFIED_BLOCK = new RegExp(`^${QUALIFIER}\\s*${NUMBER}\\s*${UNIT}?$|^${NUMBER}\\s*${UNIT}?\\s*[-–—]\\s*${NUMBER}\\s*${UNIT}?$`)
/** A value left blank. */
const BLANK_BLOCK = /^(?:[-–—−]+|brak|n\/?a|b\/d|nie dotyczy)$/
/** "Label: figure" in one block; the label part is judged separately. */
const INLINE = new RegExp(`^(.{2,60}?)\\s*[:–—-]?\\s+(${QUALIFIER}\\s*)?(${NUMBER}\\s*${UNIT}?)$`)

/** A label that bounds or rates a figure instead of stating it: a planning limit, an index, a ratio. */
const BOUND_WORDS = /\b(max\w*|maks\w*|min|minimaln\w*|minimum|wskaznik\w*|dopuszczaln\w*|przekrocz\w*|limit\w*|ratio|coverage)\b/
/** A label about one storey is not a figure of the house. */
const STOREY_QUALIFIER = /\b(parter\w*|poddasz\w*|pietr\w*|piwnic\w*|przyziem\w*|ground floor|first floor|upper floor|attic|basement|loft)\b/
/** Words of the fact vocabulary: a block of six or seven words carrying one is a label too long to trust, not prose to skip. */
const LOOSE_VOCABULARY = /\b(wysokosc|powierzchni\w*|pow\.|kubatur\w*|kat|nachyleni\w*|szerokosc|dlugosc|glebokosc|dzialk\w*|garaz\w*|area|height|volume|pitch|width|length|footprint)\b/

type StatedUnit = 'm2' | 'm3' | 'm' | 'deg' | 'other' | undefined
const statedUnit = (text: string): StatedUnit => {
  const v = deaccent(text)
  if (/m\s*²|\bm2\b|\bmkw\b|\bm\s*kw\b/.test(v)) return 'm2'
  if (/m\s*³|\bm3\b/.test(v)) return 'm3'
  if (/\bcm\b|\bmm\b|%|\bszt\b|\bzl\b|\bpln\b|\beur\b/.test(v)) return 'other'
  if (/°|\bst\.?$|\bstopni|\bdeg\b/.test(v)) return 'deg'
  if (/\bm\b/.test(v)) return 'm'
  return undefined
}

/**
 * A label without what is not its words: the unit it states ("(m2)", "[m²]")
 * and the standard it measures by ("wg PN-ISO 9836:1997"). The unit is kept:
 * a label that says "m²" lets a bare number be square metres.
 */
export function cleanLabel(raw: string): { text: string; unit: StatedUnit } {
  let unit: StatedUnit
  let text = raw.replace(/\s*[([]\s*(m\s*²|m\s*³|m2|m3|m|°|stopni|deg)\s*[)\]]/gi, (_m, u: string) => {
    unit = statedUnit(u) ?? unit
    return ' '
  })
  text = text.replace(/\s+w\s+(m\s*²|m\s*³|m2|m3|stopniach)\s*$/i, (_m, u: string) => {
    unit = statedUnit(u) ?? unit
    return ''
  })
  text = text.replace(/\s*[([]?\s*(?:wg|według|wedlug|per|according to)?\s*\b(?:PN|EN|ISO|DIN)(?:[- ]?(?:EN|ISO|B))*[- ]?\d[\d:.-]*\s*[)\]]?/gi, ' ')
  return { text: text.replace(/\s+/g, ' ').replace(/[:*\s]+$/, '').trim(), unit }
}

const plotKey = (folded: string): string | undefined => {
  if (/\b(szer\w*|width)\b/.test(folded) && /\bdzialk\w*|\bplot\b/.test(folded)) return 'plot_min_width'
  if (/\b(dl|dlug\w*|glebok\w*|length|depth)\b/.test(folded) && /\bdzialk\w*|\bplot\b/.test(folded)) return 'plot_min_depth'
  if (/wymiary dzialki|\bplot (size|dimensions)\b/.test(folded)) return 'plot'
  return undefined
}

/**
 * The fact key of a label, or undefined: a short phrase in the fact
 * vocabulary, with no digit and no sentence end, that neither bounds a figure
 * nor names one storey. `maxWords` is the reader's own limit: a label printed
 * inline with its figure is held to four words, because "nie może przekroczyć"
 * and "około" are words too.
 */
export function factKeyOf(label: string, maxWords: number): string | undefined {
  const folded = deaccent(cleanLabel(label).text)
  if (folded.length < 3 || folded.length > 60 || folded.split(/\s+/).length > maxWords || /\d/.test(folded)) return undefined
  if (/[?!]$/.test(folded) || /\.$/.test(folded.replace(/\b(min|max|dl|szer|pow|gl|wym|calk|uzytk|zab|glebok)\.$/, ''))) return undefined
  const plot = plotKey(folded)
  if (plot) return plot
  if (BOUND_WORDS.test(folded) || STOREY_QUALIFIER.test(folded) || new RegExp(`(^|\\s)${QUALIFIER}$`).test(folded)) return undefined
  return FACT_KEYS.find((f) => f.test.test(folded))?.key
}

// ---------------------------------------------------------------------------
// Label/value pairs from blocks (005C): a value belongs to a label only inside
// the smallest element holding both, and only when that element holds no
// other label and exactly one figure. An element holding several facts is
// read flat only when each of its sections (a heading opens one) alternates
// strictly label, figure, label, figure from its first block to its last —
// the one arrangement whose direction is not a guess.
// ---------------------------------------------------------------------------

type TokenKind = 'K' | 'X' | 'V' | 'S'
type Token = { block: number; kind: TokenKind; key?: string; inline?: true; heading?: true }

/** "Label: figure" in one block, matched on the folded text (a qualifier is "około" or "okolo" alike), cut from the printed one. */
function inlineParts(text: string): { label: string; qualified: boolean; value: string } | undefined {
  const t = text.trim()
  const folded = deaccent(t)
  const m = INLINE.exec(folded)
  if (!m) return undefined
  const same = folded.length === t.length
  return { label: same ? t.slice(0, m[1].length) : m[1], qualified: !!m[2], value: same ? t.slice(t.length - m[3].length) : m[3] }
}

function tokensOf(text: string, block: number, heading: boolean): Token[] {
  const t = text.trim()
  const folded = deaccent(t)
  const mark = heading ? { heading: true as const } : {}
  if (VALUE_BLOCK.test(folded) || PLOT_BLOCK.test(folded)) return [{ block, kind: 'V' }]
  if (QUALIFIED_BLOCK.test(folded) || BLANK_BLOCK.test(folded)) return [{ block, kind: 'S' }]
  const inline = inlineParts(t)
  if (inline && /[a-z]{2}/i.test(deaccent(inline.label)) && inline.label.split(/\s+/).length <= 6) {
    const key = factKeyOf(inline.label, 4)
    return [key ? { block, kind: 'K', key, inline: true } : { block, kind: 'X', inline: true }, { block, kind: inline.qualified ? 'S' : 'V', inline: true }]
  }
  const key = factKeyOf(t, 6)
  if (key) return [{ block, kind: 'K', key, ...mark }]
  if (t.length < 3 || !/[a-z]{2}/i.test(folded)) return []
  const words = t.split(/\s+/).length
  // prose — a sentence, or a definition ("Wysokość budynku – liczona jako …") — is passed over, whatever words it uses
  if (words >= 8 || /[.!?]$/.test(folded.replace(/\b(min|max|dl|szer|pow|gl|nr|ul|ok)\.$/, ''))) return []
  if ((words >= 6 || t.length >= 40) && !LOOSE_VOCABULARY.test(folded)) return []
  return [{ block, kind: 'X', ...mark }]
}

/** Label/value pairs a page builds from blocks rather than a table, each inside its own row. */
export function blockPairs(facts: PageFacts, regions: PageRegions = pageRegions(facts)): LabelValue[] {
  const out: LabelValue[] = []
  const blocks = facts.blocks
  // A table is the table reader's: a column header is not a row label, whatever the next cell says.
  const inTable = (at: number): boolean => facts.tables.some((t) => at >= t.offset && at < t.end) || facts.gridRanges.some(([a, b]) => at >= a && at < b)
  const tokens: Token[] = []
  blocks.forEach((b, i) => {
    if (inTable(b.offset) || regions.excluded(b.offset, b.path)) return
    tokens.push(...tokensOf(b.text, i, /^h[1-6]$/.test(b.tag)))
  })
  // the label as printed, less its colon; its unit and standard are read from it later, not dropped here
  const emit = (k: Token, v: Token, source: LabelValue['source']): void => {
    const inline = k.inline ? inlineParts(blocks[k.block].text) : undefined
    const label = (inline ? inline.label : blocks[k.block].text).replace(/[:\s–—-]+$/, '').trim()
    const value = inline ? inline.value : blocks[v.block].text.trim()
    out.push({ label, value, source, offset: blocks[k.block].offset })
  }
  // inline pairs are complete on their own
  for (let i = 0; i + 1 < tokens.length; i++) if (tokens[i].inline && tokens[i].kind === 'K' && tokens[i + 1].block === tokens[i].block && tokens[i + 1].kind === 'V') emit(tokens[i], tokens[i + 1], 'inline')

  const within = (lo: number, hi: number): Token[] => tokens.filter((u) => blocks[u.block].offset >= lo && blocks[u.block].offset < hi)
  const flatMemo = new Map<number, Map<Token, Token>>()
  const flat = (scope: number, members: Token[]): Map<Token, Token> => {
    const memo = flatMemo.get(scope)
    if (memo) return memo
    // A heading that no figure follows is a section's title: it closes one run and opens the next.
    const sections: Token[][] = [[]]
    for (const [i, u] of members.entries()) {
      const next = members[i + 1]
      if (u.kind === 'X' && u.heading && !(next && !next.inline && (next.kind === 'V' || next.kind === 'S'))) {
        sections.push([])
        continue
      }
      const seq = sections[sections.length - 1]
      const last = seq[seq.length - 1]
      // the label again (a tooltip's heading) is one label
      if (u.kind === 'K' && !u.inline && last?.kind === 'K' && !last.inline && last.key === u.key) continue
      seq.push(u)
    }
    const isLabel = (u: Token): boolean => u.kind === 'K' || u.kind === 'X'
    const pairs = new Map<Token, Token>()
    for (const seq of sections) {
      const alternates = seq.length % 2 === 0 && seq.every((u, i) => isLabel(u) === (i % 2 === 0))
      if (alternates) for (let i = 0; i < seq.length; i += 2) if (seq[i].kind === 'K' && !seq[i].inline && seq[i + 1].kind === 'V') pairs.set(seq[i], seq[i + 1])
    }
    flatMemo.set(scope, pairs)
    return pairs
  }
  for (const t of tokens) {
    if (t.kind !== 'K' || t.inline) continue
    const path = blocks[t.block].path
    for (let d = path.length - 1; d >= -1; d--) {
      const scope = d >= 0 ? facts.elements[path[d]] : undefined
      const members = scope ? within(scope.start, scope.end) : tokens
      const others = members.filter((u, i) => (u.kind === 'X' && !(u.heading && !(members[i + 1] && !members[i + 1].inline && (members[i + 1].kind === 'V' || members[i + 1].kind === 'S')))) || (u.kind === 'K' && (u.inline || u.key !== t.key)))
      const slots = members.filter((u) => !u.inline && (u.kind === 'V' || u.kind === 'S'))
      if (others.length === 0 && slots.length === 0) continue
      if (others.length === 0) {
        if (slots.length === 1 && slots[0].kind === 'V') emit(t, slots[0], 'block')
        break
      }
      const partner = flat(scope?.id ?? -1, members).get(t)
      if (partner) emit(t, partner, 'block')
      break
    }
  }
  return out.sort((a, b) => a.offset - b.offset)
}

/**
 * Every label/value pair the page states as its own: the structured readers'
 * (table rows, `dl`, `label: value` list items) and the block reader's, minus
 * those in chrome, controls and cards. What classification and the figures
 * are read from, so a listing's tiles are nobody's figures.
 */
export function pagePairs(facts: PageFacts): LabelValue[] {
  const regions = pageRegions(facts)
  const structured = facts.pairs.filter((p) => !regions.excluded(p.offset))
  return [...structured, ...blockPairs(facts, regions)].sort((a, b) => a.offset - b.offset)
}

/** Physically possible, whatever the label: a pitch under 90°, a building between 1 and 100 m tall, a positive area. */
const plausible = (key: string, value: number): boolean =>
  value > 0 && (key !== 'roof_pitch' || value < 90) && (key !== 'building_height' || (value > 1 && value < 100)) && (!key.startsWith('plot_') || value < 1000)

/** The figures a page prints, keyed by the vocabulary of their labels. Two readings of one key that differ leave the key out. */
export function genericFacts(facts: PageFacts): PublishedFact[] {
  const readings = new Map<string, Array<{ label: string; raw: string; value: number; unit: FactUnit }>>()
  const add = (key: string, label: string, raw: string, value: number | null, unit: FactUnit): void => {
    if (value === null || !plausible(key, value)) return
    readings.set(key, [...(readings.get(key) ?? []), { label, raw, value, unit }])
  }
  for (const p of pagePairs(facts)) {
    const key = factKeyOf(p.label, 8)
    if (!key) continue
    const raw = p.value.trim()
    const folded = deaccent(raw)
    const labelUnit = cleanLabel(p.label).unit
    if (key === 'plot') {
      // a plot's two dimensions on one line: "21,40 x 18,5 m"
      const m = PLOT_BLOCK.exec(folded) ?? (labelUnit === 'm' ? new RegExp(`^(${NUMBER})\\s*[x×]\\s*(${NUMBER})$`).exec(folded) : null)
      if (m) {
        add('plot_min_width', p.label, raw, parseLocaleNumber(m[1]), 'm')
        add('plot_min_depth', p.label, raw, parseLocaleNumber(m[2]), 'm')
      }
      continue
    }
    if (!VALUE_BLOCK.test(folded)) continue
    const stated = statedUnit(raw)
    const mapped = key === 'plot_min_width' || key === 'plot_min_depth' ? { unit: 'm' as FactUnit } : FACT_KEYS.find((f) => f.key === key)
    if (!mapped) continue
    // Precision before reach, for every reader: the figure's unit is the key's, stated in the value or the label.
    const compatible =
      mapped.unit === 'count'
        ? stated === undefined && labelUnit === undefined && /^\d{1,3}$/.test(raw)
        : mapped.unit === 'none'
          ? stated === 'm3' || (stated === undefined && labelUnit === 'm3')
          : stated === mapped.unit || (stated === undefined && labelUnit === mapped.unit)
    if (!compatible) continue
    add(key, p.label, raw, parseLocaleNumber(raw), mapped.unit)
  }
  const out: PublishedFact[] = []
  for (const [key, rs] of readings) {
    if (new Set(rs.map((r) => r.value)).size !== 1) continue
    out.push({ key, label: rs[0].label, value: rs[0].value, unit: rs[0].unit, raw: rs[0].raw })
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
  const regions = pageRegions(facts)
  for (const p of facts.pairs.filter((x) => !regions.excluded(x.offset))) {
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
