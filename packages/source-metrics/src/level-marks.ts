/**
 * v3.45: the level marks printed on a section (`+7,70` over a ▽), read by the shipped numeric recogniser and admitted
 * only by the same drawing.
 *
 * Measured on 23 development sections (`research/reading-v345`): the template reader read 51 of 110 legible level marks
 * and carried 17 wrong values (a missed comma, `±` for `+`, a dropped minus, `+2,46` for `+2,96`), because its glyph
 * templates were fitted to plan dimension labels. The recogniser's unconstrained decode reads the whole mark — sign,
 * digits and decimal comma — and its digit-constrained beam reads the digits again; the two agree on nearly every mark.
 *
 * What a label is: a template token, upright, at least `MIN_CAP_PX` tall, that stands over a level symbol
 * (`markerApexBelow`) — the symbol, not the text, says that this is a level mark and which row it marks. The token's box
 * is widened along the ink of its own rows (a sign or a last digit the template split off), and only that crop goes to
 * the recogniser: it sees no row, no other label, no published figure.
 *
 * What a reading must be to be heard (`levelReadingOf`):
 *  - exactly one signed level pattern in the unconstrained decode (`+`, `-`, `−` or `±`, one or two digits, a decimal
 *    comma or point, two digits) — junk the widened crop caught beside it is dropped, two patterns refuse the crop;
 *  - the decode's mean probability at least `MIN_MEAN_P`;
 *  - the digit-constrained beam's first or second value reads the same digits (it may read the sign as one more digit):
 *    two decoders of the same frames agreeing, never one reading alone.
 *
 * What a heard reading must be to stand: `checkLevelReadings` — its own level symbol below it, one ladder through the
 * marks (leave one out, at least three), and a printed `±0,00` standing on that ladder. Consistent differences alone do
 * not anchor the zero: every mark misread by the same +0,15 m makes a ladder just as straight (`zeroAnchor`).
 */
import type { PixelRect } from '@buildapp/source-common'
import type { Gray, Raster } from '@buildapp/source-cv'
import { markerApexBelow } from './extract.js'
import type { ExternalLevelReading } from './external-levels.js'
import { labelCrop } from './recogniser.js'
import type { ExternalReading, LabelCrop } from './recogniser.js'

export const LEVEL_MARKS_NAME = 'metrics.level-marks' as const
export const LEVEL_MARKS_VERSION = '1.0.0' as const
/** A label shorter than this is not handed to the recogniser (the legibility gate the numeric lattice holds labels to). */
export const MIN_CAP_PX = 10
/** The unconstrained decode's mean probability a reading needs to be heard at all. */
export const MIN_MEAN_P = 0.9
/** The ink-run widening: a column of ink within this share of the label's height continues the label. */
export const WIDEN_GAP_SHARE = 0.45

/** A token the template reader found, as the level-mark reader needs it. */
export type LevelToken = { box: PixelRect; upright: boolean }
/** One level label: where its ink is (`tight`), the same row's ink run around it (`wide`), and the row its symbol marks. */
export type LevelLabel = { key: string; box: PixelRect; tight: PixelRect; apexRow: number; source: 'TOKEN' | 'INK' }

const LEVEL = /([+\-−±])\s?(\d{1,2})[,.](\d{2})(?!\d)/g

/**
 * Upright words of the drawing's own ink, independent of the template reader: glyph-sized connected components joined
 * along a row. A level label the template never tokenised (it happens: a `±0,00` beside a slab) is still a word of ink
 * standing over its symbol. Only words of at least three components and `MIN_CAP_PX` cap are kept.
 */
export function inkWords(gray: Gray): PixelRect[] {
  const { width: W, height: H, data } = gray
  const seen = new Uint8Array(W * H)
  const comps: PixelRect[] = []
  const stack: number[] = []
  for (let i = 0; i < W * H; i += 1) {
    if (seen[i] || data[i] >= 170) continue
    let x0 = W, x1 = -1, y0 = H, y1 = -1, n = 0
    stack.push(i)
    seen[i] = 1
    while (stack.length > 0) {
      const j = stack.pop() as number
      const x = j % W
      const y = (j - x) / W
      n += 1
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      if (x1 - x0 > 60 || y1 - y0 > 60) n = -1e9 // too large for a glyph: keep flooding (to mark it) but drop it
      if (x > 0 && !seen[j - 1] && data[j - 1] < 170) { seen[j - 1] = 1; stack.push(j - 1) }
      if (x < W - 1 && !seen[j + 1] && data[j + 1] < 170) { seen[j + 1] = 1; stack.push(j + 1) }
      if (y > 0 && !seen[j - W] && data[j - W] < 170) { seen[j - W] = 1; stack.push(j - W) }
      if (y < H - 1 && !seen[j + W] && data[j + W] < 170) { seen[j + W] = 1; stack.push(j + W) }
    }
    if (n > 0 && y1 - y0 <= 40 && x1 - x0 <= 40) comps.push({ x0, x1: x1 + 1, y0, y1: y1 + 1 })
  }
  comps.sort((a, b) => a.x0 - b.x0)
  const used = new Uint8Array(comps.length)
  const words: PixelRect[] = []
  for (let i = 0; i < comps.length; i += 1) {
    if (used[i] || comps[i].y1 - comps[i].y0 < MIN_CAP_PX * 0.6) continue
    // the word's band is set by its glyph-sized components only: a comma or a dot joins the word but never moves the
    // band (or a dotted symbol edge below the text would walk it down), and nothing wider than half a cap joins below it
    let w = { ...comps[i] }
    let band = { y0: comps[i].y0, y1: comps[i].y1 }
    let count = 1
    used[i] = 1
    for (let grew = true; grew; ) {
      grew = false
      const cap = band.y1 - band.y0
      for (let k = 0; k < comps.length; k += 1) {
        if (used[k]) continue
        const c = comps[k]
        const gap = c.x0 - w.x1
        if (gap > Math.max(3, cap * 0.6) || c.x1 < w.x0 - Math.max(3, cap * 0.6)) continue
        const ch = c.y1 - c.y0
        const glyph = ch >= cap * 0.6 && ch <= cap * 1.6 && Math.min(c.y1, band.y1) - Math.max(c.y0, band.y0) >= ch * 0.5
        const mark = ch < cap * 0.6 && c.x1 - c.x0 <= cap * 0.5 && c.y0 >= band.y0 - 2 && c.y1 <= band.y1 + cap * 0.35
        if (!glyph && !mark) continue
        w = { x0: Math.min(w.x0, c.x0), x1: Math.max(w.x1, c.x1), y0: Math.min(w.y0, glyph ? c.y0 : w.y0), y1: Math.max(w.y1, glyph ? c.y1 : w.y1) }
        if (glyph) band = { y0: Math.min(band.y0, c.y0), y1: Math.max(band.y1, c.y1) }
        used[k] = 1
        count += 1
        grew = true
      }
    }
    if (count >= 3 && w.y1 - w.y0 >= MIN_CAP_PX && w.x1 - w.x0 > w.y1 - w.y0) words.push(w)
  }
  return words
}

/**
 * The label boxes of one section: upright template tokens and upright words of ink that stand over a level symbol,
 * each widened along its own rows' ink, one per place.
 */
export function levelLabels(raster: Raster, gray: Gray, tokens: readonly LevelToken[]): LevelLabel[] {
  const dark = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < gray.width && y < gray.height && gray.data[y * gray.width + x] < 170
  const colInk = (x: number, b: PixelRect): boolean => {
    for (let y = Math.round(b.y0); y <= Math.round(b.y1); y += 1) if (dark(x, y)) return true
    return false
  }
  const candidates: Array<{ box: PixelRect; source: 'TOKEN' | 'INK' }> = [
    ...tokens.filter((t) => t.upright).map((t) => ({ box: t.box, source: 'TOKEN' as const })),
    ...inkWords(gray).map((box) => ({ box, source: 'INK' as const })),
  ]
  const out: LevelLabel[] = []
  for (const t of candidates) {
    const h = t.box.y1 - t.box.y0
    if (h < MIN_CAP_PX) continue
    const apex = markerApexBelow(raster, t.box)
    if (!apex) continue
    const gap = Math.max(3, Math.round(h * WIDEN_GAP_SHARE))
    let x0 = Math.round(t.box.x0)
    let x1 = Math.round(t.box.x1)
    for (let miss = 0, x = x0 - 1; miss <= gap && x >= 0; x -= 1) {
      if (colInk(x, t.box)) {
        x0 = x
        miss = 0
      } else miss += 1
    }
    for (let miss = 0, x = x1 + 1; miss <= gap && x < gray.width; x += 1) {
      if (colInk(x, t.box)) {
        x1 = x
        miss = 0
      } else miss += 1
    }
    const box = { x0, x1, y0: t.box.y0, y1: t.box.y1 }
    // one label per place: two tokens (or a token and its ink word) of one mark widen to the same run
    const sameInk = (a: PixelRect, b: PixelRect): boolean => {
      const ix = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)
      const iy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)
      const small = Math.min((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0))
      return ix > 0 && iy > 0 && (ix * iy) / Math.max(1, small) >= 0.5
    }
    if (out.some((o) => (Math.abs(o.apexRow - apex.row) <= 2 && Math.min(o.box.x1, box.x1) - Math.max(o.box.x0, box.x0) > 0) || sameInk(o.tight, t.box) || sameInk(o.box, box))) continue
    out.push({ key: `L${out.length}`, box, tight: t.box, apexRow: apex.row, source: t.source })
  }
  return out
}

/** The crops the recogniser is given — each label twice, as tight as its ink and widened along its row — keyed opaquely. */
export const levelCrops = (gray: Gray, labels: readonly LevelLabel[]): LabelCrop[] => labels.flatMap((l) => [labelCrop(`${l.key}t`, gray, l.tight), labelCrop(`${l.key}w`, gray, l.box)])

export type LevelReadingVerdict = { text?: string; why: string }

/** What one recogniser reading of a level label says, or why it says nothing. */
export function levelReadingOf(r: ExternalReading): LevelReadingVerdict {
  const matches = [...r.greedy.text.matchAll(LEVEL)]
  if (matches.length === 0) return { why: `"${r.greedy.text}" holds no signed level` }
  if (matches.length > 1) return { why: `"${r.greedy.text}" holds ${matches.length} levels: the crop is not one label` }
  if (r.greedy.meanP < MIN_MEAN_P) return { why: `read "${r.greedy.text}" at mean probability ${r.greedy.meanP}, under ${MIN_MEAN_P}` }
  const [, signRaw, units, cents] = matches[0]
  const digits = `${units}${cents}`
  const agrees = r.topK.slice(0, 2).some((k) => k.text === digits || (k.text.length === digits.length + 1 && k.text.endsWith(digits)))
  if (!agrees) return { why: `the digit beam reads ${r.topK.slice(0, 2).map((k) => k.text).join(' or ')}, not the ${digits} the full decode reads` }
  const sign = signRaw === '−' ? '-' : signRaw
  return { text: `${sign}${units},${cents}`, why: `read "${r.greedy.text}" (mean ${r.greedy.meanP}); the digit beam agrees (${digits})` }
}

/**
 * The heard readings of one section, ready for `checkLevelReadings`; each refused label named. A label is read twice
 * (tight and widened): what one crop hears and the other does not contradict is heard; two crops hearing two different
 * levels refuse the label — never the likelier of the two.
 */
export function levelReadingsFrom(labels: readonly LevelLabel[], readings: readonly ExternalReading[]): { readings: ExternalLevelReading[]; refused: Array<{ box: PixelRect; why: string }> } {
  const byKey = new Map(readings.map((r) => [r.key, r]))
  const heard: ExternalLevelReading[] = []
  const refused: Array<{ box: PixelRect; why: string }> = []
  for (const l of labels) {
    const crops = [byKey.get(`${l.key}t`), byKey.get(`${l.key}w`), byKey.get(l.key)].filter((r): r is ExternalReading => r !== undefined)
    if (crops.length === 0) {
      refused.push({ box: l.box, why: 'the recogniser returned nothing for the label' })
      continue
    }
    const verdicts = crops.map((r) => ({ r, v: levelReadingOf(r) }))
    const texts = [...new Set(verdicts.filter((x) => x.v.text).map((x) => x.v.text as string))]
    if (texts.length === 1) {
      const best = verdicts.filter((x) => x.v.text === texts[0]).reduce((a, b) => (b.r.greedy.meanP > a.r.greedy.meanP ? b : a))
      heard.push({ text: texts[0], boxPx: l.box, classConfidence: best.r.greedy.meanP })
    } else if (texts.length > 1) refused.push({ box: l.box, why: `the tight and the widened crop read ${texts.join(' and ')}: the label is ambiguous` })
    else refused.push({ box: l.box, why: verdicts.map((x) => x.v.why).join('; ') })
  }
  return { readings: heard, refused }
}
