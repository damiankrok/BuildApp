/**
 * v3.46: the vertical dimensions printed on a section — a clear storey height, a knee wall, a window's height — read as
 * what they are: a number printed along a dimension line, the line's two ends, and the span between them.
 *
 * Measured on development sections before this reader (`research/reading-v346`, per-sign scorer): of 59 legible
 * vertical dimensions the template reader had the right numerals on the sign for 38, and 3 became measurements. The
 * chain reader that turns plan numbers into dimensions needs several numbers on one line agreeing on a scale; a
 * section's vertical dimensions stand one to a line, drawn in a faint grey the plan's ink mask does not keep, and the
 * section's scale comes from elsewhere: its own level marks.
 *
 * What a label is: an OCR token the template found printed along the vertical (either way), holding at least two
 * digits, taller than wide and at least `MIN_LABEL_LONG_PX` long. The template only finds it: its digits are what the
 * shipped recogniser reads on the label turned upright, both ways (`sectionHeightCrops`), and a reading must be heard
 * (`heightReadingOf`: two or three digits, optionally ",5", mean probability at least `MIN_HEIGHT_MEAN_P`, the digit beam
 * agreeing); two turns hearing two different numbers leave the label unread. On development sections the template
 * alone misread 9 for 4 and 3 for 5 with the line's length still inside any useful tolerance: the length check cannot
 * tell near digits apart, so it is never the only witness of the digits.
 *
 * What it must stand beside: a faint line parallel to it, within `LINE_SEARCH_PX` of its side, running past it over
 * `MIN_LINE_COVER` of its rows. The line's ends, walking along it from the label: the face of something thick it runs
 * into (a slab, a wall, a roof), or, where it runs on into paper, the tick that crosses it short of its free end (a
 * knee wall's dimension line runs on past the tick that marks the wall's head). What makes it a measurement: the span
 * between the ends, at the section's own level-ladder scale (registered from the level marks, never from these numbers),
 * equals the heard value within `lengthToleranceCm`. A label that fails any step is left unread, and says why.
 *
 * The reader knows no project: every threshold is in pixels of the label's own size or in the ladder's metres.
 */
import type { PixelPoint, PixelRect } from '@buildapp/source-common'
import type { Gray } from '@buildapp/source-cv'
import { cropForToken } from './recogniser.js'
import type { ExternalReading, LabelCrop } from './recogniser.js'

export const SECTION_HEIGHTS_NAME = 'metrics.section-heights' as const
export const SECTION_HEIGHTS_VERSION = '1.0.0' as const
/** The shortest label read (its extent along the text, px). */
export const MIN_LABEL_LONG_PX = 18
/** The recogniser's mean probability a reading needs to be heard. */
export const MIN_HEIGHT_MEAN_P = 0.95
/** How far from the label's side the dimension line is looked for (px). */
export const LINE_SEARCH_PX = 22
/** A pixel darker than this is ink (the dimension lines are faint grey). */
export const FAINT_INK = 236
/** A pixel darker than this is solid drawing ink (walls, slabs, roofs), not a faint line. */
export const SOLID_INK = 110
/** The share of the label's rows the line must run beside it. */
export const MIN_LINE_COVER = 0.85
/** The most paper (px) a line may break for before it is taken to have ended. */
export const MAX_GAP_PX = 2
/** A row whose solid ink runs at least this wide across the line is something thick: the line's end is its face. */
export const THICK_RUN_PX = 7
/** How far in from a free end a tick is looked for (px), and how far either side of the line its ink must reach. */
export const TICK_SEARCH_PX = 24
export const TICK_REACH_PX: readonly [number, number] = [2, 6]

const HEARD = /^(\d{2,3})([,.]5)?$/

/** The span must equal the value within 2.5 px at the ladder's scale or 1.5 % of the value, whichever is more. */
export const lengthToleranceCm = (valueCm: number, cmPerPx: number): number => Math.max(2.5 * cmPerPx, 0.015 * valueCm)

export type SectionHeightToken = { id: string; text: string; box: PixelRect; orientation?: string }
export type SectionHeightLabel = { key: string; token: SectionHeightToken }

export type SectionHeightVerdict = {
  label: SectionHeightLabel
  text?: string
  valueCm?: number
  meanP?: number
  line?: { x: number; top: number; bottom: number; topEnd: 'THICK' | 'TICK' | 'GAP'; bottomEnd: 'THICK' | 'TICK' | 'GAP' }
  measuredCm?: number
  admitted: boolean
  why: string
}

/** The labels to read: vertical tokens of at least two digits, taller than wide, long enough. */
export function sectionHeightLabels(tokens: readonly SectionHeightToken[]): SectionHeightLabel[] {
  return tokens
    .filter((t) => (t.orientation === 'ROTATED_CW' || t.orientation === 'ROTATED_CCW') && (t.text.match(/\d/g) ?? []).length >= 2)
    .filter((t) => t.box.y1 - t.box.y0 >= MIN_LABEL_LONG_PX && t.box.y1 - t.box.y0 >= 1.2 * (t.box.x1 - t.box.x0))
    .map((token, i) => ({ key: `h${i}`, token }))
}

/** A gray image turned a quarter: clockwise (`cw`) or counter-clockwise. */
export function quarterTurn(g: Gray, cw: boolean): Gray {
  const out = new Uint8ClampedArray(g.width * g.height)
  const W = g.height
  for (let y = 0; y < g.height; y += 1) {
    for (let x = 0; x < g.width; x += 1) {
      const nx = cw ? g.height - 1 - y : y
      const ny = cw ? x : g.width - 1 - x
      out[ny * W + nx] = g.data[y * g.width + x]
    }
  }
  return { width: W, height: g.width, data: out }
}

/** Each label upright both ways, for the recogniser: keys `${key}c` (turned clockwise) and `${key}a` (anticlockwise). */
export function sectionHeightCrops(gray: Gray, labels: readonly SectionHeightLabel[]): LabelCrop[] {
  return labels.flatMap((l) => {
    const crop = cropForToken(gray, { x0: l.token.box.x0, x1: l.token.box.x1, y0: l.token.box.y0, y1: l.token.box.y1 })
    const cap = Math.max(1, Math.round(l.token.box.x1 - l.token.box.x0))
    return [
      { key: `${l.key}c`, gray: quarterTurn(crop, true), capPx: cap },
      { key: `${l.key}a`, gray: quarterTurn(crop, false), capPx: cap },
    ]
  })
}

/** What one recogniser reading of a height label says, or why it says nothing. */
export function heightReadingOf(r: ExternalReading): { text?: string; why: string } {
  const text = r.greedy.text.trim()
  const m = HEARD.exec(text)
  if (!m) return { why: `"${r.greedy.text}" is not a height in centimetres` }
  if (r.greedy.meanP < MIN_HEIGHT_MEAN_P) return { why: `read "${text}" at mean probability ${r.greedy.meanP}, under ${MIN_HEIGHT_MEAN_P}` }
  const digits = `${m[1]}${m[2] ? '5' : ''}`
  if (!r.topK.slice(0, 2).some((k) => k.text === digits)) return { why: `the digit beam reads ${r.topK.slice(0, 2).map((k) => k.text).join(' or ')}, not the ${digits} the full decode reads` }
  return { text, why: `read "${text}" (mean ${r.greedy.meanP}); the digit beam agrees` }
}

/** The run of solid ink across row y through column x: its width, px. */
function solidRunAt(g: Gray, x: number, y: number): number {
  const solid = (px: number): boolean => px >= 0 && px < g.width && g.data[y * g.width + px] < SOLID_INK
  if (!solid(x)) return 0
  let a = x
  let b = x
  while (solid(a - 1)) a -= 1
  while (solid(b + 1)) b += 1
  return b - a + 1
}

const inkAt = (g: Gray, x: number, y: number): boolean => x >= 0 && y >= 0 && x < g.width && y < g.height && g.data[y * g.width + x] < FAINT_INK
const lineAt = (g: Gray, x: number, y: number): boolean => inkAt(g, x, y) || inkAt(g, x - 1, y) || inkAt(g, x + 1, y)
const thickAt = (g: Gray, x: number, y: number): boolean => solidRunAt(g, x, y) >= THICK_RUN_PX || solidRunAt(g, x - 1, y) >= THICK_RUN_PX || solidRunAt(g, x + 1, y) >= THICK_RUN_PX

/** A tick crossing the line near row y: ink reaching out on both sides of it within two rows. */
function tickAt(g: Gray, x: number, y: number): boolean {
  const side = (s: 1 | -1): boolean => {
    for (let dy = -2; dy <= 2; dy += 1) for (let d = TICK_REACH_PX[0]; d <= TICK_REACH_PX[1]; d += 1) if (inkAt(g, x + s * d, y + dy)) return true
    return false
  }
  return side(1) && side(-1)
}

/** Walk along column x from row `from` in direction `dir`: the line's end, and what ends it. */
function walk(g: Gray, x: number, from: number, dir: 1 | -1): { row: number; end: 'THICK' | 'TICK' | 'GAP' } {
  let last = from
  let gap = 0
  for (let y = from + dir; y >= 0 && y < g.height; y += dir) {
    if (thickAt(g, x, y)) return { row: y - dir, end: 'THICK' }
    if (lineAt(g, x, y)) {
      last = y
      gap = 0
    } else if (++gap > MAX_GAP_PX) break
  }
  // A free end: the dimension ends at the tick crossing the line short of it, where there is one.
  for (let k = 0; k <= TICK_SEARCH_PX; k += 1) {
    const y = last - dir * k
    if ((dir === -1 ? y > from : y < from) || y < 0 || y >= g.height) break
    if (tickAt(g, x, y)) {
      // the tick's own row: of the rows the test looked at, the one whose ink reaches out furthest on both sides
      let best = y
      let bestN = -1
      for (let r = y - 2; r <= y + 2; r += 1) {
        let n = 0
        for (let d = TICK_REACH_PX[0]; d <= TICK_REACH_PX[1]; d += 1) n += (inkAt(g, x - d, r) ? 1 : 0) + (inkAt(g, x + d, r) ? 1 : 0)
        if (n > bestN) {
          best = r
          bestN = n
        }
      }
      return { row: best, end: 'TICK' }
    }
  }
  return { row: last, end: 'GAP' }
}

/** The dimension line beside a vertical label: the nearest column that runs ink beside all of it and is not a wall. */
export function lineBeside(g: Gray, box: PixelRect): { x: number; cover: number } | undefined {
  const y0 = Math.round(box.y0)
  const y1 = Math.round(box.y1)
  const rows = Math.max(1, y1 - y0 + 1)
  for (let d = 2; d <= LINE_SEARCH_PX; d += 1) {
    for (const x of [Math.round(box.x1) + d, Math.round(box.x0) - d]) {
      if (x < 1 || x >= g.width - 1) continue
      let n = 0
      let solid = 0
      for (let y = y0; y <= y1; y += 1) {
        if (inkAt(g, x, y)) n += 1
        if (g.data[y * g.width + x] < SOLID_INK) solid += 1
      }
      if (solid / rows > 0.5) continue
      if (n / rows >= MIN_LINE_COVER) return { x, cover: n / rows }
    }
  }
  return undefined
}

/** Read one label: the heard value, the line beside it, its ends, and whether their span at the section's scale is that value. */
export function judgeSectionHeight(g: Gray, label: SectionHeightLabel, readings: readonly ExternalReading[], cmPerPx: number, turn?: 'c' | 'a'): SectionHeightVerdict {
  const byKey = new Map(readings.map((r) => [r.key, r]))
  const turns = (turn ? [byKey.get(`${label.key}${turn}`)] : [byKey.get(`${label.key}c`), byKey.get(`${label.key}a`)]).filter((r): r is ExternalReading => r !== undefined)
  if (turns.length === 0) return { label, admitted: false, why: 'the recogniser returned nothing for the label' }
  const heard = turns.map((r) => ({ r, v: heightReadingOf(r) }))
  const texts = [...new Set(heard.filter((h) => h.v.text).map((h) => h.v.text as string))]
  if (texts.length === 0) return { label, admitted: false, why: heard.map((h) => h.v.why).join('; ') }
  if (texts.length > 1) return { label, admitted: false, why: `turned one way the label reads ${texts[0]}, the other way ${texts[1]}: ambiguous` }
  const text = texts[0].replace('.', ',')
  const meanP = Math.max(...heard.filter((h) => h.v.text === texts[0]).map((h) => h.r.greedy.meanP))
  const valueCm = Number(text.replace(',', '.'))
  const beside = lineBeside(g, label.token.box)
  if (!beside) return { label, text, valueCm, meanP, admitted: false, why: `no faint line runs beside "${text}" within ${LINE_SEARCH_PX} px over ${Math.round(MIN_LINE_COVER * 100)} % of its length` }
  const mid = Math.round((label.token.box.y0 + label.token.box.y1) / 2)
  const up = walk(g, beside.x, mid, -1)
  const down = walk(g, beside.x, mid, 1)
  const spanPx = down.row - up.row
  const measuredCm = Math.round(spanPx * cmPerPx * 10) / 10
  const tol = lengthToleranceCm(valueCm, cmPerPx)
  const line = { x: beside.x, top: up.row, bottom: down.row, topEnd: up.end, bottomEnd: down.end }
  const endName = (e: 'THICK' | 'TICK' | 'GAP'): string => (e === 'THICK' ? 'the face of a slab, wall or roof' : e === 'TICK' ? 'its tick' : 'where the line stops')
  const ends = `from row ${up.row} (${endName(up.end)}) to row ${down.row} (${endName(down.end)})`
  if (Math.abs(measuredCm - valueCm) > tol) return { label, text, valueCm, meanP, line, measuredCm, admitted: false, why: `the line beside "${text}" at x ${beside.x} runs ${ends}, ${spanPx} px: ${measuredCm} cm at the section's scale, not ${valueCm} (tolerance ${tol.toFixed(1)} cm)` }
  return { label, text, valueCm, meanP, line, measuredCm, admitted: true, why: `read "${text}" (mean ${meanP}) along the line at x ${beside.x}, which runs ${ends}: ${spanPx} px, ${measuredCm} cm at the section's own level-ladder scale (${cmPerPx.toFixed(4)} cm/px), the printed value within ${tol.toFixed(1)} cm` }
}

/**
 * Every label of one sheet. A sheet prints its vertical dimensions one way up, and which way is decided on the sheet,
 * from the drawing: each label is judged once with each quarter turn alone; the turn under which the drawing admits
 * readings, where the other turn has none admitted anywhere on the sheet, is the sheet's, and every label is then
 * read that way only. Where both turns or neither have admitted readings the labels are judged with both turns, and a
 * label the two turns read differently stays unread. (On development sections the template's own orientation flag
 * did not say which way a label reads: labels it flagged either way all read the same turn.)
 */
export function judgeSectionHeights(g: Gray, labels: readonly SectionHeightLabel[], readings: readonly ExternalReading[], cmPerPx: number): { verdicts: SectionHeightVerdict[]; turn?: 'c' | 'a'; why: string } {
  const c = labels.map((l) => judgeSectionHeight(g, l, readings, cmPerPx, 'c'))
  const a = labels.map((l) => judgeSectionHeight(g, l, readings, cmPerPx, 'a'))
  const nc = c.filter((v) => v.admitted).length
  const na = a.filter((v) => v.admitted).length
  if (nc > 0 && na === 0) return { verdicts: c, turn: 'c', why: `the sheet's vertical labels read turned clockwise: ${nc} reading${nc === 1 ? '' : 's'} admitted by the drawing that way, none the other` }
  if (na > 0 && nc === 0) return { verdicts: a, turn: 'a', why: `the sheet's vertical labels read turned anticlockwise: ${na} reading${na === 1 ? '' : 's'} admitted by the drawing that way, none the other` }
  return { verdicts: labels.map((l) => judgeSectionHeight(g, l, readings, cmPerPx)), why: nc + na === 0 ? 'no reading admitted either way: the sheet says nothing about which way its labels read' : `readings admitted both ways (${nc} clockwise, ${na} anticlockwise): each label is read both ways and stays unread where they differ` }
}

/** The ends of a reading as a segment, for the evidence's measured geometry. */
export const segmentOf = (v: SectionHeightVerdict): { type: 'SEGMENT'; a: PixelPoint; b: PixelPoint } | undefined =>
  v.line ? { type: 'SEGMENT', a: { x: v.line.x, y: v.line.top }, b: { x: v.line.x, y: v.line.bottom } } : undefined
