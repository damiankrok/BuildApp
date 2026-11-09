/**
 * v3.45: the room numbers printed on a floor plan (`7` in the garage, `12` in a bathroom), read by the shipped numeric
 * recogniser instead of the template reader.
 *
 * Measured on development plans before this reader (the reading-v345 room-number probe): of 281 rooms on 26
 * houses 94 carried a number, and 47 labels were refused as "reads as 1 or 5 alike". The template reader's glyphs were
 * fitted to plan dimension labels; a room number is set larger, in a different (italic, often red) face, so it misreads
 * `6` as `8` and `3` as `9`, and the page's orientation vote then sets the clean upright reading aside for a garbled one
 * of the same ink. On one development ground plan the recogniser read all six numbers right at mean probability
 * ≥ 0.996 where the template misread two and set aside a third.
 *
 * What a label is: a template token, upright, of one or two digits, at least `ROOM_NUMBER_MIN_CAP_PX` tall (either side of the
 * page vote: the vote is what discards the clean ones), and not on a dimension line (the caller leaves out every label
 * the numeric lattice read as a measurement). Its box is widened along the ink of its own rows, so a digit the
 * template split off a longer label comes back as the whole label — and a three-digit dimension is then no room number.
 * Only that crop goes to the recogniser: no position, no room, no published list.
 *
 * What a reading must be to be heard (`roomNumberReadingOf`):
 *  - the unconstrained decode is one or two digits and nothing else;
 *  - its mean probability is at least `ROOM_NUMBER_MIN_MEAN_P`;
 *  - the digit-constrained beam's first value reads the same digits;
 *  - the label is no wider than its digits: `roomNumberWidthPerDigit` of its height per digit (a word of ink wider than that is
 *    not what was read).
 *
 * A heard reading is not yet a room's number. It is an upright token like any other; the plan's interior reader decides
 * whether it numbers a room — inside the room, naming a published room of the storey, one number per room, the published
 * area its check — as for the template's tokens, with one difference: its size is not compared with the sheet's other
 * text (on development sheets whose dimension labels stand 17 px tall the room numbers stand 16 px, and the template's
 * "larger than the median" rule refuses all of them; the dimension-line exclusion is what keeps measurements out). The recogniser reads foliage and callout halves too (`66` on a
 * hedge at 0.9999, `78` from a `78/118` ring): the place and the published list refuse those, not the probability.
 */
import type { PixelRect } from '@buildapp/source-common'
import { round6, stableId } from '@buildapp/source-common'
import type { Gray } from '@buildapp/source-cv'
import { labelCrop } from './recogniser.js'
import type { ExternalReading, LabelCrop } from './recogniser.js'
import type { OcrToken } from './schema.js'

export const ROOM_NUMBERS_NAME = 'metrics.room-numbers' as const
export const ROOM_NUMBERS_VERSION = '1.0.0' as const
/** A label shorter than this is not read (room numbers on the smallest development sheets stand 11 px tall). */
export const ROOM_NUMBER_MIN_CAP_PX = 8
/** The unconstrained decode's mean probability a reading needs to be heard. */
export const ROOM_NUMBER_MIN_MEAN_P = 0.98
/** The widest a label of n digits may be: (0.8·n + 0.2) of its height (DEV: one digit 0.3–0.7, two 0.9–1.2). */
export const roomNumberWidthPerDigit = (digits: number): number => 0.8 * digits + 0.2
/** The ink-run widening: a column of ink within this share of the label's height continues the label. */
export const ROOM_NUMBER_WIDEN_GAP_SHARE = 0.45

const DIGITS = /^\d{1,2}$/

/** One label: its widened box, the template tokens of its ink, and their cap height as the template measured it. */
export type RoomNumberLabel = { key: string; box: PixelRect; tokenIds: string[]; heightPx: number }

/** The label's box widened along the ink of its own rows (gray below 170 is ink). */
export function widenAlongRow(gray: Gray, b: PixelRect): PixelRect {
  const dark = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < gray.width && y < gray.height && gray.data[y * gray.width + x] < 170
  const colInk = (x: number): boolean => {
    for (let y = Math.round(b.y0); y <= Math.round(b.y1); y += 1) if (dark(x, y)) return true
    return false
  }
  const gap = Math.max(3, Math.round((b.y1 - b.y0) * ROOM_NUMBER_WIDEN_GAP_SHARE))
  let x0 = Math.round(b.x0)
  let x1 = Math.round(b.x1)
  for (let miss = 0, x = x0 - 1; miss <= gap && x >= 0; x -= 1) {
    if (colInk(x)) {
      x0 = x
      miss = 0
    } else miss += 1
  }
  for (let miss = 0, x = x1 + 1; miss <= gap && x < gray.width; x += 1) {
    if (colInk(x)) {
      x1 = x
      miss = 0
    } else miss += 1
  }
  return { x0, x1, y0: b.y0, y1: b.y1 }
}

/** The labels to read on one plan: upright one- or two-digit template tokens, widened, one label per widened box. */
export function roomNumberLabels(gray: Gray, tokens: readonly Pick<OcrToken, 'id' | 'text' | 'box' | 'orientation' | 'heightPx'>[]): { labels: RoomNumberLabel[]; crops: LabelCrop[] } {
  const labels: RoomNumberLabel[] = []
  const crops: LabelCrop[] = []
  const byBox = new Map<string, RoomNumberLabel>()
  for (const t of tokens) {
    if (t.orientation !== 'HORIZONTAL' || !DIGITS.test(t.text) || t.box.y1 - t.box.y0 < ROOM_NUMBER_MIN_CAP_PX) continue
    const box = widenAlongRow(gray, t.box)
    const k = `${box.x0},${box.x1},${box.y0},${box.y1}`
    const seen = byBox.get(k)
    if (seen) {
      seen.tokenIds.push(t.id)
      seen.heightPx = Math.max(seen.heightPx, t.heightPx)
      continue
    }
    const label = { key: `n${labels.length}`, box, tokenIds: [t.id], heightPx: t.heightPx }
    byBox.set(k, label)
    labels.push(label)
    crops.push(labelCrop(label.key, gray, box))
  }
  return { labels, crops }
}

export type RoomNumberVerdict = { label: RoomNumberLabel; text?: string; meanP?: number; why: string }

/** What the recogniser's reading of one label says, and whether it is heard. */
export function roomNumberReadingOf(label: RoomNumberLabel, r: ExternalReading | undefined): RoomNumberVerdict {
  if (!r) return { label, why: 'the recogniser returned nothing for the label' }
  const text = r.greedy.text.trim()
  if (!DIGITS.test(text)) return { label, why: `"${r.greedy.text}" is not one or two digits` }
  if (r.greedy.meanP < ROOM_NUMBER_MIN_MEAN_P) return { label, why: `read "${text}" at mean probability ${r.greedy.meanP}, under ${ROOM_NUMBER_MIN_MEAN_P}` }
  if (r.topK[0]?.text !== text) return { label, why: `the digit beam reads ${r.topK[0]?.text ?? 'nothing'}, not ${text}` }
  const h = Math.max(1, label.box.y1 - label.box.y0)
  if (label.box.x1 - label.box.x0 > roomNumberWidthPerDigit(text.length) * h) return { label, why: `the label is ${label.box.x1 - label.box.x0} px wide for ${text.length} digit${text.length === 1 ? '' : 's'} ${h} px tall: wider than what was read` }
  return { label, text, meanP: r.greedy.meanP, why: `read "${text}" (mean ${r.greedy.meanP}, beam ${r.topK[0].text})` }
}

/**
 * The heard readings as OCR tokens of their frame: upright, kept, `reader: 'RECOGNISER'`, the box the crop was cut
 * from. One glyph per digit, the box split evenly (the recogniser does not place its characters).
 */
export function roomNumberTokens(frame: { id: string; assetId: string; variantByteHash: string }, labels: readonly RoomNumberLabel[], readings: readonly ExternalReading[]): { tokens: OcrToken[]; verdicts: RoomNumberVerdict[] } {
  const byKey = new Map(readings.map((r) => [r.key, r]))
  const verdicts = labels.map((l) => roomNumberReadingOf(l, byKey.get(l.key)))
  const tokens: OcrToken[] = []
  for (const v of verdicts) {
    if (!v.text || v.meanP === undefined) continue
    const { box } = v.label
    const p = round6(v.meanP)
    const step = (box.x1 - box.x0) / v.text.length
    tokens.push({
      id: stableId('ocr-room', v.text, { frameId: frame.id, box }),
      frameId: frame.id,
      assetId: frame.assetId,
      variantByteHash: frame.variantByteHash,
      text: v.text,
      score: p,
      confidence: p,
      box,
      // the template's own measure of the same ink: the interior reader compares it with the template's other tokens
      heightPx: Math.max(1, v.label.heightPx),
      shearDeg: 0,
      glyphs: [...v.text].map((char, i) => ({ char, score: p, confidence: p, box: { x0: round6(box.x0 + i * step), x1: round6(box.x0 + (i + 1) * step), y0: box.y0, y1: box.y1 }, alternatives: [] })),
      orientation: 'HORIZONTAL',
      pageVote: 'KEPT',
      reader: 'RECOGNISER',
      supersedes: v.label.tokenIds,
    })
  }
  return { tokens, verdicts }
}
