/**
 * The numeric reader's candidate lattice (BUILDPLAN-ANALYZER-005E).
 *
 * The 005D reader returns one reading per piece of ink and a few runners-up per glyph, and the metric layer may then
 * consider one substitution. On the development houses that reader is right on under a third of the dimension labels,
 * and when it is wrong it is often wrong in two places or in where it cut the ink: an `8` beside a `0` read as `0`
 * and `1` (the `0`'s hollow middle cut instead of the `8|0` junction), or two independent coin tosses on a `7` and a
 * `3`. The truth then leaves the candidate set before any reasoning can weigh it.
 *
 * This module re-reads one label from the very ink field its pass read and returns a bounded, image-only lattice:
 *
 *   ink variants   the reader's own mask (DEFAULT), a stricter one (STRICT) and a local mean–deviation one (SAUVOLA):
 *                  touching strokes come apart under a stricter threshold, faint ones survive a local one;
 *   segmentations  the reader's own cuts (the ANCHOR), and re-cuts at the window's valleys, each valley column given
 *                  to either side, at most two boundaries moved, cells of glyph proportions only;
 *   glyphs         every admitted character's score (the grammar admits digits in a full-height cell), the
 *                  candidates within ρ of the cell's best, calibrated by a softmax of the scores;
 *   sequences      a bounded beam over the cells (at most two non-top choices), merged over the paths by text — one
 *                  ink, one set of values — emitted best first until the mass or the count bound.
 *
 * What it never takes: a scale, a span, a chain, a tick, another label, a published figure. What it never does: count
 * a value twice because two variants or two cuts reached it, or let a re-cut stand in for what the reader read. The
 * AS-READ value is the top reading of the anchor of the ink variant whose cells match best; everything else is an
 * alternative the image supports, for the metric layer to weigh and never to count.
 */
import { round6 } from '@buildapp/source-common'
import type { PixelRect } from '@buildapp/source-common'
import type { Gray, Mask } from '@buildapp/source-cv'
import { PROTOTYPE_HOLE_COUNTS, cellSources, columnProfile, cropToken, estimateShear, holeStats, pageRectOfPass, scoreCell, segment, shear } from './ocr.js'
import type { Bitmap, CellCut, MatcherOptions, OcrResult, TextOrientation, TextToken } from './ocr.js'
import { parseNumber } from './parse.js'
import { toCentimetres } from './schema.js'

export const NUMERIC_LATTICE_NAME = 'metrics.numeric-lattice' as const
export const NUMERIC_LATTICE_VERSION = '1.1.0' as const
/**
 * 005H: the lattice with an external recogniser's witness beside it (`ensemble.ts`). A run with no recogniser reads
 * every label exactly as 1.1.0 did and says so; a run with one stamps this version on every lattice it records.
 */
export const NUMERIC_LATTICE_ENSEMBLE_VERSION = '1.2.0' as const

/**
 * The bounds, every one a count or a ratio — never a clock — so a phone and a server reach the same lattice.
 * Chosen on the synthetic calibration corpus and the FIT development labels; checked on the held-back corpus and the
 * HELD_BACK labels; the measured tables live with the stage's calibration artefacts, never read from here.
 */
export const LATTICE_BOUNDS = {
  /** Ink variants read per label. */
  variants: 3,
  /** A non-top character is a candidate when its score is at least this share of the cell's best. */
  glyphRatio: 0.6,
  /** Candidates per cell, the best included. */
  perCell: 4,
  /** Softmax temperature of the glyph scores (the NLL fit on development glyphs). */
  temperature: 0.05,
  /** Non-top choices per sequence. */
  nonTop: 2,
  /** Partial sequences kept per cell. */
  beam: 16,
  /** A sequence is dropped below this share of its path's best probability. */
  floor: 0.01,
  /** Sequences emitted per ink, best first, until this cumulative mass or this count. */
  mass: 0.95,
  sequences: 8,
  /** Re-cuts: valleys per boundary window, boundaries moved, hypotheses per variant, texts per variant and per ink. */
  valleys: 2,
  movedBoundaries: 2,
  segmentations: 16,
  textsPerVariant: 4,
  textsPerInk: 6,
  /** A re-cut is kept when its geometric-mean glyph score is at least this share of the variant's best. */
  segmentationRatio: 0.7,
  /** Cost of a re-cut against the cuts the reader made, in natural-log probability units. */
  recutPenalty: 1,
  /** Anchors of more cells than this are no dimension: they keep the anchor only. */
  maxCells: 7,
} as const

/**
 * The reading-quality classes (pre-review D's four), on the probability of the as-read string among the ink's emitted
 * values and its margin over the next value. On the FIT labels that probability separates a right reading from a wrong
 * one at AUC 0.75 against 0.65 for the worst glyph runner ratio (0.73 topology-aware); on the HELD_BACK labels the two
 * are a near-tie (0.81 against 0.83) — the stage's calibration tables. LOW_QUALITY: a glyph matched under the floor, or
 * text under the legible height. CLEAR: the reading holds at least `clearP` of the ink's mass and the next value at most
 * half of it (`clearMargin`). SUPPORTED: at least `supportedP`, with the next value at most half of it
 * (`supportedMargin`) — a two-value coin toss is AMBIGUOUS whatever share it holds (005E post-review C P0). AMBIGUOUS
 * otherwise, and whenever the as-read value moves under the stability bracket (`STABILITY_BRACKET`). Chosen on the FIT
 * labels and the calibration corpus, checked on the held-back ones. 005F raised both margins 0.3 → 0.5: count
 * hypotheses and counter-safe cuts concentrate an ink's values, and SUPPORTED precision on FIT and the calibration corpus
 * fell below 005E's; the margin restores it on both, keeping the most right readings of the bars tried (005F
 * calibration record).
 */
export const OCR_CLASS_BOUNDS = { lowScore: 0.2, legibleCapPx: 10, clearP: 0.6, clearMargin: 0.5, supportedP: 0.35, supportedMargin: 0.5 } as const

/**
 * 005F: the bounds of glyph-count hypotheses, counter-safe cuts and the plan's dimension-font style (pre-review A,
 * the stage's `segmentation-count-review.md`), every one a count or a ratio. A count is
 * decided by the width of the ink against the plan's own glyph width and by topology — never by the template score, which
 * reads a glyph split in two as two `1`s as readily as the truth (A P0-3), and never by a scale.
 */
export const COUNT_BOUNDS = {
  /** A style sample: an isolated glyph run of the reader's mask whose ink width over its token's cap lies in this band. */
  sampleBand: [0.35, 0.8],
  /** A label's style: the median sample over tokens whose cap is within this factor of its own, from at least `styleSamples`. */
  styleCapRatio: 1.25,
  styleSamples: 8,
  /**
   * A glyph count is admitted when its per-glyph width over the style lies in this band. Development true counts lie at
   * 0.81–1.17; the upper bound 1.3 was placed with round 5's condensed four-digit overall (1.40 at three cells) in view, and the
   * development labels alone admit any bound from 1.17 to above 1.56 (post-review D5F-4: stated, not hidden).
   */
  styleBand: [0.75, 1.3],
  /** With no style, the per-glyph width over the cap (development 0.405–0.576, the corpus 0.446–0.667), and its centre. */
  noStyleBand: [0.4, 0.7],
  noStyleCentre: 0.49,
  /** A boundary a count adds needs a valley at least this deep: 1 − ink / the lower of the peaks within half a pitch. */
  addDepth: 0.35,
  /** New texts a count alternative may add to an ink, outside the re-cut budget. */
  countTexts: 2,
  /**
   * Segmentations per count of one ink variant (005E's machinery), per ink variant and per ink; cells scored per ink. The
   * per-variant and per-ink counts follow from the per-count one and do not bind. Every variant's anchor is exempt from
   * the cell cap and the stability bracket scores up to 28 cells more (a development label reached 118 scorings): the
   * cell cap bounds the hypotheses, not the ink. Only the per-ink caps are recorded (`truncated`); the per-count cap, the
   * count-text cap and the tail cap truncate silently (post-review B5F-3, B5F-4, B5F-6: stated, not hidden).
   */
  segmentationsPerCount: 16,
  segmentationsPerVariant: 48,
  segmentationsPerInk: 144,
  cellsPerInk: 96,
  /** A counter: a hole at least this share of the cap tall that is a hole on at least `counterPersist` of its pixels in every other ink mask. */
  counterHeight: 0.2,
  counterPersist: 0.5,
  /** A value of another digit count at this share of the ink's values or more makes its reading AMBIGUOUS. */
  countRivalP: 0.1,
} as const

/**
 * 005F: the ambiguity tail (pre-review B, `beam-tail-review.md`): values a reading reaches with exactly two moderate
 * substitutions, each independently supported by the image — at least `glyphRatio` of the cell's best and within
 * `T·ln(1/glyphShare)` of it — that the count bound cut. At most `perInk` per ink. Recorded beside the emitted values,
 * never among them: no probability, never as-read, never a witness, a contest value, a correction or a structural
 * option. Every tail value is at least 0.04 of its path's best (0.2²), above the beam's floor: the floor is not lowered.
 */
export const TAIL_BOUNDS = { substitutions: 2, glyphRatio: 0.7, glyphShare: 0.2, perInk: 2 } as const

/**
 * The stability bracket (005E post-review D P1): the stricter masks' thresholds — STRICT's delta and SAUVOLA's k — scaled
 * by each factor, the anchors read again and the as-read rule applied. A reading whose value moves under a tenth of a
 * threshold was never decided by the image: it cannot be CLEAR or SUPPORTED. The width is fixed a priori, not fitted.
 */
export const STABILITY_BRACKET = [0.9, 1.1] as const

/** The class of a reading, from the reader's own evidence only. */
export function ocrClassOf(m: { minGlyphScore: number; capHeightPx: number; asReadP: number; probabilityMargin: number; stable?: boolean }): OcrClass {
  const B = OCR_CLASS_BOUNDS
  if (m.minGlyphScore < B.lowScore || m.capHeightPx < B.legibleCapPx) return 'LOW_QUALITY'
  if (m.stable === false) return 'AMBIGUOUS'
  if (m.asReadP >= B.clearP && m.probabilityMargin >= B.clearMargin) return 'CLEAR'
  if (m.asReadP >= B.supportedP && m.probabilityMargin >= B.supportedMargin) return 'SUPPORTED'
  return 'AMBIGUOUS'
}

export type InkVariant = 'DEFAULT' | 'STRICT' | 'SAUVOLA'
export const INK_VARIANTS: readonly InkVariant[] = ['DEFAULT', 'STRICT', 'SAUVOLA']
export type OcrClass = 'CLEAR' | 'SUPPORTED' | 'AMBIGUOUS' | 'LOW_QUALITY'

/** The 005E matcher: the 005D template matcher with the small-counter tolerance and hole-to-hole comparison. */
export const LATTICE_MATCHER: MatcherOptions = { smallCounterFill: true, pairedHoles: true }

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const
const SMALL_SIGNS = [',', '.', '-', '°'] as const

/** One cell's candidates: the admitted characters it may be, best first. */
export type LatticeGlyph = {
  /** Columns of the cut in the de-skewed token. */
  x0: number
  x1: number
  /** 0..1 scores; `p` the calibrated probability among the admitted characters. */
  candidates: Array<{ char: string; score: number; p: number }>
  /** The cell's best score over its admitted alphabet. */
  top: number
  /** Second admitted score over the first — never filtered — and the same ignoring runners-up whose topology the cell contradicts. */
  runnerRatio: number
  topologyRunnerRatio: number
  holes: number
  /** The run the cell was cut from held more than one cell (touching glyphs). */
  touching: boolean
  /** The cell's ink is more than one piece (a broken stroke). */
  broken: boolean
}

/** One way of cutting one ink variant. */
export type LatticePath = {
  id: string
  variant: InkVariant
  kind: 'ANCHOR' | 'RECUT'
  slope: number
  cuts: number[]
  changedBoundaries: number
  /** Geometric mean of the cells' top scores, and its share of the variant's best. */
  segScore: number
  ratioToBest: number
  glyphs: LatticeGlyph[]
}

export type LatticeSequence = {
  text: string
  /** The dimension it states, in centimetres (a 2–4 digit whole number, or a decimal in metres), when it states one. */
  valueCm?: number
  /** Image-only: Σ ln p over its glyphs, less the re-cut penalty; normalised probability over the emitted set. */
  logP: number
  p: number
  /** Geometric mean of its glyphs' scores: comparable across glyph counts. */
  imageScore: number
  nonTop: Array<{ index: number; top: string; chosen: string; ratio: number }>
  minGlyphMargin: number
  avgGlyphMargin: number
  /** The paths that reached it (best first); the first decides its score. */
  pathIds: string[]
  variants: InkVariant[]
  asRead: boolean
}

export type LabelLattice = {
  reader: { name: typeof NUMERIC_LATTICE_NAME; version: typeof NUMERIC_LATTICE_VERSION | typeof NUMERIC_LATTICE_ENSEMBLE_VERSION }
  orientation: TextOrientation
  /** The 005D reader's text for this ink, unchanged. */
  rawTopText: string
  /** The as-read string: the top reading of the anchor (the reader's own cuts) of the ink variant whose cells match best. */
  asRead: string
  asReadValueCm?: number
  sequences: LatticeSequence[]
  ocrClass: OcrClass
  classWhy: string
  minGlyphScore: number
  maxRunnerRatio: number
  /** Image score of the best different-valued sequence over the as-read one's (0 when none). */
  sequenceMargin: number
  /** The as-read string's share of the ink's emitted probability, and 1 − (the best other value's / its own). */
  asReadP: number
  probabilityMargin: number
  /** The ink variant whose anchor gave the as-read string. */
  asReadVariant: InkVariant
  /** Entropy (nats) of the emitted sequences' probabilities. */
  entropy: number
  capHeightPx: number
  /** The as-read path's cells on the page as it lies. */
  glyphBoxes: PixelRect[]
  paths: LatticePath[]
  expansions: number
  truncatedBy: 'MASS' | 'COUNT' | 'FLOOR' | 'NONE'
  /** Values merged before the cut, and the share of their probability the emitted ones carry (a truth may lie past it). */
  mergedCount: number
  emittedMass: number
  /** The as-read string under the stability bracket's masks, and whether its value held (`STABILITY_BRACKET`). */
  asReadStability: { stable: boolean; bracket: string[] }
  /**
   * 005F: the glyph counts the ink was read at. `asRead` is the as-read string's digit count; `alternatives` the other
   * counts any ink variant kept a hypothesis at; `decisive` the variants whose reader count the plan's style ruled out
   * and replaced; `widthAmbiguous` whether the as-read variant's cut admits a count one away that fits its width at
   * least as well; `rivalP` the largest share of another digit count among the emitted values.
   */
  countAmbiguity: GlyphCountAmbiguity
  /** 005F: values two moderate substitutions reach past the count bound (`TAIL_BOUNDS`). A record, never a reading. */
  tail: LatticeTailValue[]
  /** 005F: what the segmentation tried and what bounded it (telemetry for the Evidence Pack). */
  segmentation: SegmentationTelemetry
  cache: 'HIT' | 'MISS'
}

export type GlyphCountAmbiguity = {
  asRead: number
  alternatives: number[]
  decisive: InkVariant[]
  widthAmbiguous: boolean
  rivalP: number
}

export type LatticeTailValue = {
  text: string
  valueCm: number
  logP: number
  imageScore: number
  nonTop: Array<{ index: number; top: string; chosen: string; ratio: number }>
  pathIds: string[]
}

export type SegmentationTelemetry = {
  /** The plan's dimension-font style at this label's cap: the median isolated glyph width over the cap, and from how many samples. */
  style: { pitch: number | null; samples: number }
  /** Per ink variant: the reader's count, the count kept as the anchor, and the alternatives a run admitted. */
  counts: Array<{ variant: InkVariant; reader: number; anchor: number; alternatives: number[]; decisive: boolean; widthAmbiguous: boolean }>
  /** Anchor cuts moved off a counter, and re-cut or count hypotheses pruned for cutting one. */
  counterCutsMoved: number
  counterCutsPruned: number
  segmentations: number
  cellsScored: number
  /** Hypotheses not scored because a bound was reached. */
  truncated: number
}

/** 005F: the plan's dimension-font style, as samples (`dimensionStyleOf`) and as a label sees it (`styleFor`). */
export type DimensionStyle = { samples: Array<{ cap: number; width: number }> }
export type LabelStyle = { pitch: number | null; samples: number }

/** The pass's frame and what it holds. */
export type PassField = { orientation: TextOrientation; ink: Gray; page: { width: number; height: number } }

// ---------------------------------------------------------------------------
// ink variants on a crop
// ---------------------------------------------------------------------------

/** The window radius the reader's adaptive mask uses on a frame of this size. */
export const pageMaskRadius = (w: number, h: number): number => Math.max(2, Math.floor(Math.max(4, Math.round(Math.max(w, h) / 40))))

type Crop = { gray: Gray; ox: number; oy: number }

function cropGray(ink: Gray, rect: PixelRect, pad: number): Crop {
  const x0 = Math.max(0, Math.round(rect.x0) - pad)
  const y0 = Math.max(0, Math.round(rect.y0) - pad)
  const x1 = Math.min(ink.width - 1, Math.round(rect.x1) + pad)
  const y1 = Math.min(ink.height - 1, Math.round(rect.y1) + pad)
  const w = Math.max(1, x1 - x0 + 1)
  const h = Math.max(1, y1 - y0 + 1)
  const data = new Uint8ClampedArray(w * h)
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) data[y * w + x] = ink.data[(y0 + y) * ink.width + x0 + x]
  return { gray: { width: w, height: h, data }, ox: x0, oy: y0 }
}

/**
 * One binarisation of a crop, with the page's window radius: inside the token's box (at least a radius from the crop's
 * edge, or at the page's own edge) the window is the page's, so DEFAULT is the reader's own mask exactly.
 */
function variantMask(g: Gray, radius: number, variant: InkVariant, factor = 1): Mask {
  const w = g.width
  const h = g.height
  const sat = new Float64Array((w + 1) * (h + 1))
  const sq = new Float64Array((w + 1) * (h + 1))
  for (let y = 0; y < h; y += 1) {
    let row = 0
    let rowSq = 0
    for (let x = 0; x < w; x += 1) {
      const v = g.data[y * w + x]
      row += v
      rowSq += v * v
      sat[(y + 1) * (w + 1) + x + 1] = sat[y * (w + 1) + x + 1] + row
      sq[(y + 1) * (w + 1) + x + 1] = sq[y * (w + 1) + x + 1] + rowSq
    }
  }
  const data = new Uint8Array(w * h)
  for (let y = 0; y < h; y += 1) {
    const y0 = Math.max(0, y - radius)
    const y1 = Math.min(h - 1, y + radius)
    for (let x = 0; x < w; x += 1) {
      const x0 = Math.max(0, x - radius)
      const x1 = Math.min(w - 1, x + radius)
      const n = (y1 - y0 + 1) * (x1 - x0 + 1)
      const box = (t: Float64Array): number => t[(y1 + 1) * (w + 1) + x1 + 1] - t[y0 * (w + 1) + x1 + 1] - t[(y1 + 1) * (w + 1) + x0] + t[y0 * (w + 1) + x0]
      const sum = box(sat)
      const v = g.data[y * w + x]
      if (variant === 'SAUVOLA') {
        const mean = sum / n
        const sd = Math.sqrt(Math.max(0, box(sq) / n - mean * mean))
        data[y * w + x] = v <= 110 || v < mean * (1 + 0.2 * factor * (sd / 128 - 1)) ? 1 : 0
        continue
      }
      // The reader's own rule (`adaptiveInkMask`): a rounded local mean, an absolute bar and a delta below the mean.
      const mean = Math.round(sum / n)
      const [delta, absolute] = variant === 'DEFAULT' ? [8, 110] : [48 * factor, 60]
      data[y * w + x] = v <= absolute || mean - v >= delta ? 1 : 0
    }
  }
  return { width: w, height: h, data }
}

// ---------------------------------------------------------------------------
// segmentation hypotheses (pre-review A)
// ---------------------------------------------------------------------------

type Cut = { x0: number; x1: number }

/** The column profile's ink runs. */
function runsOf(profile: readonly number[]): Cut[] {
  const runs: Cut[] = []
  let start = -1
  for (let x = 0; x < profile.length; x += 1) {
    if (profile[x] > 0 && start < 0) start = x
    if (profile[x] === 0 && start >= 0) {
      runs.push({ x0: start, x1: x - 1 })
      start = -1
    }
  }
  if (start >= 0) runs.push({ x0: start, x1: profile.length - 1 })
  return runs
}

/**
 * The anchor (the reader's own cuts) and its re-cuts. Per internal boundary of a run the reader split, the window the
 * reader searched (centre at the uniform pitch, half-width 0.3·E); its two deepest valleys (a plateau is one valley),
 * each valley column given to the left or the right cell; plus the anchor's cut. A hypothesis moves at most two
 * boundaries and keeps every cell between 0.2 and 0.95 of the glyph height. The glyph count is never changed.
 */
export function segmentationHypotheses(sheared: Bitmap, glyphHeight: number): Array<{ cells: Cut[]; changed: number }> {
  const anchor = segment(sheared)
  const out: Array<{ cells: Cut[]; changed: number }> = [{ cells: anchor, changed: 0 }]
  if (anchor.length > LATTICE_BOUNDS.maxCells || anchor.length < 2) return out
  const profile = new Array<number>(sheared.width).fill(0)
  for (let y = 0; y < sheared.height; y += 1) for (let x = 0; x < sheared.width; x += 1) profile[x] += sheared.data[y * sheared.width + x]
  const expected = Math.max(3, sheared.height * 0.55)
  // The boundaries the anchor made inside a run: (cell index after the cut, the cut column, the window).
  type Boundary = { index: number; cut: number; options: number[] }
  const boundaries: Boundary[] = []
  for (const run of runsOf(profile)) {
    const width = run.x1 - run.x0 + 1
    const count = Math.max(1, Math.round(width / expected))
    if (count === 1 || width < expected * 1.45) continue
    for (let k = 1; k < count; k += 1) {
      const centre = run.x0 + (width * k) / count
      const lo = Math.max(run.x0 + 1, Math.round(centre - expected * 0.3))
      const hi = Math.min(run.x1 - 1, Math.round(centre + expected * 0.3))
      // The anchor's cell that starts inside this window is the one after the cut.
      const index = anchor.findIndex((c, i) => i > 0 && c.x0 >= lo && c.x0 <= hi + 1)
      if (index < 0) continue
      const cut = anchor[index].x0
      // Valleys: local minima of the profile in the window (a plateau of equal values is one valley, its left column).
      const valleys: Array<{ x: number; ink: number }> = []
      for (let x = lo; x <= hi; x += 1) {
        const left = x > lo ? profile[x - 1] : Infinity
        if (profile[x] > left) continue
        if (profile[x] === left && x > lo) continue
        let end = x
        while (end + 1 <= hi && profile[end + 1] === profile[x]) end += 1
        const right = end < hi ? profile[end + 1] : Infinity
        if (profile[x] <= right) valleys.push({ x, ink: profile[x] })
      }
      valleys.sort((a, b) => a.ink - b.ink || Math.abs(a.x - centre) - Math.abs(b.x - centre) || a.x - b.x)
      const options = new Set<number>()
      for (const v of valleys.slice(0, LATTICE_BOUNDS.valleys)) {
        options.add(v.x)
        options.add(v.x + 1)
      }
      options.delete(cut)
      boundaries.push({ index, cut, options: [...options].filter((x) => x > run.x0 && x <= run.x1).sort((a, b) => a - b) })
    }
  }
  if (boundaries.length === 0) return out
  const minW = Math.max(1, Math.floor(0.2 * glyphHeight))
  const maxW = Math.ceil(0.95 * glyphHeight)
  // Within a run the reader's cells are contiguous; a moved start moves the previous cell's end with it.
  const contiguous = anchor.map((c, i) => i + 1 < anchor.length && c.x1 + 1 === anchor[i + 1].x0)
  const build = (moves: Array<{ b: Boundary; x: number }>): Cut[] | undefined => {
    const starts = anchor.map((c) => c.x0)
    for (const m of moves) starts[m.b.index] = m.x
    const cells: Cut[] = []
    for (let i = 0; i < anchor.length; i += 1) {
      const x0 = starts[i]
      const x1 = contiguous[i] ? starts[i + 1] - 1 : anchor[i].x1
      if (x1 < x0) return undefined
      const changed = x0 !== anchor[i].x0 || x1 !== anchor[i].x1
      // Only a cell the re-cut changed must have a glyph's proportions; the reader's own cells stand as they were.
      if (changed && (x1 - x0 + 1 < minW || x1 - x0 + 1 > maxW)) return undefined
      cells.push({ x0, x1 })
    }
    return cells
  }
  // Order: fewer moved boundaries first, then boundary index, then cut column.
  for (const b of boundaries) {
    for (const x of b.options) {
      if (out.length >= LATTICE_BOUNDS.segmentations) return out
      const cells = build([{ b, x }])
      if (cells) out.push({ cells, changed: 1 })
    }
  }
  if (LATTICE_BOUNDS.movedBoundaries >= 2) {
    for (let i = 0; i < boundaries.length; i += 1) {
      for (let j = i + 1; j < boundaries.length; j += 1) {
        for (const xi of boundaries[i].options) {
          for (const xj of boundaries[j].options) {
            if (out.length >= LATTICE_BOUNDS.segmentations) return out
            const cells = build([
              { b: boundaries[i], x: xi },
              { b: boundaries[j], x: xj },
            ])
            if (cells) out.push({ cells, changed: 2 })
          }
        }
      }
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// 005F: the plan's dimension-font style, counter-safe cuts, bounded glyph-count hypotheses (pre-review A)
// ---------------------------------------------------------------------------

/**
 * The plan's dimension-font style: every isolated glyph the reader's own mask finds in the plan's raw tokens, as its ink
 * width over its token's cap height. Touching glyphs make one run, so only runs of one glyph's width are samples. Image
 * only: no value, chain, scale or published figure. Built from the reader's raw tokens rather than from CLEAR or
 * SUPPORTED labels, because a class depends on the count the style is used to decide.
 */
export function dimensionStyleOf(read: Pick<OcrResult, 'raw' | 'passes'>): DimensionStyle {
  const samples: DimensionStyle['samples'] = []
  if (!read.raw || !read.passes) return { samples }
  const [lo, hi] = COUNT_BOUNDS.sampleBand
  for (const t of read.raw) {
    const box = t.passBox
    const ink = read.passes[t.orientation]
    if (!box || !ink || t.glyphs.length < 1 || t.glyphs.length > 6) continue
    const radius = pageMaskRadius(ink.width, ink.height)
    const crop = cropGray(ink, box, radius + 2)
    const local = { x0: Math.round(box.x0) - crop.ox, y0: Math.round(box.y0) - crop.oy, x1: Math.round(box.x1) - crop.ox, y1: Math.round(box.y1) - crop.oy }
    const { sheared } = estimateShear(cropToken(variantMask(crop.gray, radius, 'DEFAULT'), local))
    const anchor = segment(sheared)
    if (anchor.length === 0) continue
    const cap = Math.max(1, ...cellSources(sheared, anchor).map((c) => c.y1 - c.y0 + 1))
    for (const run of runsOf(columnProfile(sheared))) {
      const width = (run.x1 - run.x0 + 1) / cap
      if (width >= lo && width <= hi) samples.push({ cap, width: round6(width) })
    }
  }
  return { samples }
}

/** The style a label of this cap height sees: the median sample of tokens of a like cap, or none under `styleSamples`. */
export function styleFor(style: DimensionStyle | undefined, cap: number): LabelStyle {
  const near = (style?.samples ?? []).filter((x) => x.cap >= cap / COUNT_BOUNDS.styleCapRatio && x.cap <= cap * COUNT_BOUNDS.styleCapRatio).map((x) => x.width).sort((a, b) => a - b)
  if (near.length < COUNT_BOUNDS.styleSamples) return { pitch: null, samples: near.length }
  return { pitch: near[Math.floor((near.length - 1) / 2)], samples: near.length }
}

type Counter = { x0: number; x1: number }

/** Background components of a bitmap that do not touch its border (4-connected), in scan order, and the hole mask. */
function holesOf(b: Bitmap): { holes: Array<Counter & { y0: number; y1: number; px: number[] }>; isHole: Uint8Array } {
  const w = b.width
  const h = b.height
  const seen = new Uint8Array(w * h)
  const holes: Array<Counter & { y0: number; y1: number; px: number[] }> = []
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i0 = y * w + x
      if (b.data[i0] === 1 || seen[i0] === 1) continue
      seen[i0] = 1
      const stack = [i0]
      const px: number[] = []
      let border = false
      let x0 = x
      let x1 = x
      let y0 = y
      let y1 = y
      while (stack.length > 0) {
        const j = stack.pop() as number
        const cx = j % w
        const cy = (j - cx) / w
        px.push(j)
        x0 = Math.min(x0, cx)
        x1 = Math.max(x1, cx)
        y0 = Math.min(y0, cy)
        y1 = Math.max(y1, cy)
        if (cx === 0 || cy === 0 || cx === w - 1 || cy === h - 1) border = true
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = cx + dx
          const ny = cy + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const k = ny * w + nx
          if (b.data[k] === 1 || seen[k] === 1) continue
          seen[k] = 1
          stack.push(k)
        }
      }
      if (!border) holes.push({ x0, x1, y0, y1, px })
    }
  }
  const isHole = new Uint8Array(w * h)
  for (const hole of holes) for (const j of hole.px) isHole[j] = 1
  return { holes, isHole }
}

/**
 * The counters of one ink variant's de-skewed token: holes at least `counterHeight` of the cap tall that are holes in
 * every other ink mask too (re-sheared at this variant's slope). A pocket one threshold closes and another opens — the
 * gap between two touching glyphs — is not a counter; the inside of a `0` is one in every mask (A P1-2).
 */
function persistentCounters(raws: ReadonlyMap<InkVariant, Bitmap>, variant: InkVariant, slope: number, sheared: Bitmap, cap: number): Counter[] {
  const mine = holesOf(sheared)
  const others = [...raws].filter(([v]) => v !== variant).map(([, raw]) => holesOf(slope === 0 ? raw : shear(raw, slope)).isHole)
  const minH = Math.max(2, Math.ceil(COUNT_BOUNDS.counterHeight * cap))
  return mine.holes
    .filter((hole) => hole.y1 - hole.y0 + 1 >= minH && others.every((o) => hole.px.filter((j) => j < o.length && o[j] === 1).length >= COUNT_BOUNDS.counterPersist * hole.px.length))
    .map((hole) => ({ x0: hole.x0, x1: hole.x1 }))
}

/**
 * Whether a boundary — a cell starting at column `b` — breaks a counter: it passes through it, or it takes the counter's
 * wall (the column beside it) unless a second counter on the other side shares that wall (two touching hollow glyphs).
 */
const cutsCounter = (b: number, counters: readonly Counter[]): boolean =>
  counters.some((c) => (c.x0 < b && b <= c.x1) || (c.x1 + 1 === b && !counters.some((d) => d.x0 === b + 1)) || (c.x0 === b && !counters.some((d) => d.x1 === b - 2)))

const breaksCounter = (cells: readonly Cut[], counters: readonly Counter[]): boolean => cells.slice(1).some((c, i) => cells[i].x1 + 1 === c.x0 && cutsCounter(c.x0, counters))

/** How deep a valley is: 1 − its ink over the lower of the highest columns within half a pitch either side. */
function valleyDepth(profile: readonly number[], x: number, half: number, run: Cut): number {
  let left = 0
  let right = 0
  for (let i = Math.max(run.x0, x - half); i < x; i += 1) left = Math.max(left, profile[i])
  for (let i = x + 1; i <= Math.min(run.x1, x + half); i += 1) right = Math.max(right, profile[i])
  const m = Math.min(left, right)
  return m <= 0 ? 0 : 1 - profile[x] / m
}

/** Per boundary of a run cut into `k` glyphs: the two deepest valleys within ±0.3 pitch, each column to either side, never through a counter. */
function boundaryOptions(profile: readonly number[], run: Cut, k: number, counters: readonly Counter[]): Array<{ options: number[]; depth: number }> {
  const width = run.x1 - run.x0 + 1
  const pitch = width / k
  const half = Math.max(1, Math.round(pitch / 2))
  const out: Array<{ options: number[]; depth: number }> = []
  for (let i = 1; i < k; i += 1) {
    const centre = run.x0 + pitch * i
    const lo = Math.max(run.x0 + 1, Math.round(centre - 0.3 * pitch))
    const hi = Math.min(run.x1 - 1, Math.round(centre + 0.3 * pitch))
    const valleys: Array<{ x: number; ink: number }> = []
    for (let x = lo; x <= hi; x += 1) {
      const left = x > lo ? profile[x - 1] : Infinity
      if (profile[x] > left || (profile[x] === left && x > lo)) continue
      let end = x
      while (end + 1 <= hi && profile[end + 1] === profile[x]) end += 1
      const right = end < hi ? profile[end + 1] : Infinity
      if (profile[x] <= right) valleys.push({ x, ink: profile[x] })
    }
    valleys.sort((a, b) => a.ink - b.ink || Math.abs(a.x - centre) - Math.abs(b.x - centre) || a.x - b.x)
    const options: number[] = []
    let depth = 0
    let used = 0
    for (const v of valleys) {
      if (used >= LATTICE_BOUNDS.valleys) break
      const safe = [v.x, v.x + 1].filter((b) => b > run.x0 && b <= run.x1 && !cutsCounter(b, counters))
      if (safe.length === 0) continue
      used += 1
      for (const b of safe) if (!options.includes(b)) options.push(b)
      depth = Math.max(depth, valleyDepth(profile, v.x, half, run))
    }
    out.push({ options, depth })
  }
  return out
}

/** A run split at one option per boundary: the first options, then one and two moved, cells of glyph proportions only, at most `segmentationsPerCount`. */
function splitRun(run: Cut, options: ReadonlyArray<{ options: number[] }>, others: readonly Cut[], cap: number): Cut[][] {
  const minW = Math.max(1, Math.floor(0.2 * cap))
  const maxW = Math.ceil(0.95 * cap)
  const base = options.map((o) => o.options[0])
  const out: Cut[][] = []
  const seen = new Set<string>()
  const push = (starts: number[]): void => {
    if (out.length >= COUNT_BOUNDS.segmentationsPerCount) return
    const key = starts.join(',')
    if (seen.has(key)) return
    seen.add(key)
    const xs = [run.x0, ...starts, run.x1 + 1]
    const cells: Cut[] = []
    for (let i = 0; i + 1 < xs.length; i += 1) {
      const w = xs[i + 1] - xs[i]
      if (w < minW || w > maxW) return
      cells.push({ x0: xs[i], x1: xs[i + 1] - 1 })
    }
    out.push([...others, ...cells].sort((a, b) => a.x0 - b.x0))
  }
  push(base)
  for (let i = 0; i < options.length; i += 1) for (const x of options[i].options) push(base.map((b, j) => (j === i ? x : b)))
  for (let i = 0; i < options.length; i += 1) for (let j = i + 1; j < options.length; j += 1) for (const xi of options[i].options) for (const xj of options[j].options) push(base.map((b, m) => (m === i ? xi : m === j ? xj : b)))
  return out
}

type CountHypothesis = { cells: Cut[]; changed: number; kind: 'ANCHOR' | 'RECUT'; countAlt: boolean; counterCut: boolean }
type CountReading = { hyps: CountHypothesis[]; reader: number; anchor: number; alternatives: number[]; decisive: boolean; widthAmbiguous: boolean; counterMoved: number; counterPruned: number }

/**
 * One ink variant's segmentations under the 005F rules (pre-review A, contract A2–A3):
 *
 *   counters      a reader cut through a persistent counter moves to the deepest valley in its window that cuts none
 *                 (the count stays); re-cuts and count hypotheses through one are pruned;
 *   counts        for each ink run of the anchor, the counts one either side, admitted when their per-glyph width over
 *                 the plan's style (`pitch`) lies in the style band — or, with no style, over the cap in the no-style
 *                 band — and they fit the width better than the anchor's, every boundary has a valley that cuts no
 *                 counter, and an added boundary's valley is at least `addDepth` deep; at most one per direction;
 *   decisive      with a style, an anchor count the band rules out is replaced by the admitted one: the only way the
 *                 reader's count changes, by width and topology alone;
 *   otherwise     an admitted count enters as re-cuts (`countAlt`), never the reader's cut.
 *
 * `widthAmbiguous`: some run of the final anchor admits a count one away that fits its width at least as well.
 */
function countHypotheses(sheared: Bitmap, cap: number, raws: ReadonlyMap<InkVariant, Bitmap>, variant: InkVariant, slope: number, pitch: number | null): CountReading {
  const base = segmentationHypotheses(sheared, cap)
  const counters = persistentCounters(raws, variant, slope, sheared, cap)
  let hyps: CountHypothesis[] = base.map((h, i) => ({ cells: h.cells, changed: h.changed, kind: i === 0 ? 'ANCHOR' : 'RECUT', countAlt: false, counterCut: breaksCounter(h.cells, counters) }))
  const reader = hyps[0].cells.length
  const profile = columnProfile(sheared)
  const runs = runsOf(profile)
  let anchor = hyps[0].cells
  let counterMoved = 0
  if (hyps[0].counterCut) {
    const cells: Cut[] = []
    for (const run of runs) {
      const inRun = anchor.filter((c) => c.x0 >= run.x0 && c.x1 <= run.x1)
      if (inRun.length >= 2 && inRun.slice(1).some((c) => cutsCounter(c.x0, counters))) {
        const options = boundaryOptions(profile, run, inRun.length, counters)
        const starts = inRun.slice(1).map((c, i) => (cutsCounter(c.x0, counters) ? (options[i]?.options[0] ?? c.x0) : c.x0))
        const xs = [run.x0, ...starts, run.x1 + 1]
        for (let i = 0; i + 1 < xs.length; i += 1) if (xs[i + 1] > xs[i]) cells.push({ x0: xs[i], x1: xs[i + 1] - 1 })
      } else cells.push(...inRun)
    }
    if (!breaksCounter(cells, counters) && cells.length === anchor.length) {
      hyps = [{ cells, changed: 0, kind: 'ANCHOR', countAlt: false, counterCut: false }, { ...hyps[0], kind: 'RECUT' }, ...hyps.slice(1)]
      anchor = cells
      counterMoved = 1
    }
  }
  const band = pitch === null ? COUNT_BOUNDS.noStyleBand : [pitch * COUNT_BOUNDS.styleBand[0], pitch * COUNT_BOUNDS.styleBand[1]]
  const centre = pitch ?? COUNT_BOUNDS.noStyleCentre
  const admitted = (w: number, k: number): boolean => k >= 1 && w / (k * cap) >= band[0] && w / (k * cap) <= band[1]
  const misfit = (w: number, k: number): number => Math.abs(Math.log(w / (k * cap) / centre))
  type Alt = { dir: number; k: number; misfit: number; segs: Cut[][]; decisive: boolean }
  const alts: Alt[] = []
  if (anchor.length <= LATTICE_BOUNDS.maxCells) {
    for (const run of runs) {
      const w = run.x1 - run.x0 + 1
      const a = anchor.filter((c) => c.x0 >= run.x0 && c.x1 <= run.x1).length
      if (a === 0) continue
      for (const k of [a - 1, a + 1]) {
        if (!admitted(w, k)) continue
        if (admitted(w, a) && misfit(w, k) >= misfit(w, a)) continue
        const options = boundaryOptions(profile, run, k, counters)
        if (options.some((o) => o.options.length === 0)) continue
        if (k > a && options.length > 0 && Math.min(...options.map((o) => o.depth)) < COUNT_BOUNDS.addDepth) continue
        const others = anchor.filter((c) => c.x1 < run.x0 || c.x0 > run.x1)
        const segs = splitRun(run, options, others, cap)
        // Only a split is decisive (post-review A5F-1): a style wider than the label's own face (a title block or room
        // names at the same cap) would otherwise merge touching glyphs with no valley to answer for; a merge stays a
        // count alternative.
        if (segs.length > 0) alts.push({ dir: Math.sign(k - a), k: k - a + anchor.length, misfit: misfit(w, k), segs, decisive: pitch !== null && !admitted(w, a) && k > a })
      }
    }
  }
  const chosen = [1, -1].map((d) => alts.filter((x) => x.dir === d).sort((x, y) => x.misfit - y.misfit || x.k - y.k)[0]).filter((x): x is Alt => x !== undefined)
  const decisive = chosen.find((x) => x.decisive)
  if (decisive) hyps = decisive.segs.map((cells, i) => ({ cells, changed: i === 0 ? 0 : 1, kind: i === 0 ? 'ANCHOR' : 'RECUT', countAlt: false, counterCut: false }))
  else for (const alt of chosen) for (const cells of alt.segs) hyps.push({ cells, changed: 1, kind: 'RECUT', countAlt: true, counterCut: false })
  // Width ambiguity of the final anchor: a run whose width fits a count one away at least as well (contract A5). Under the
  // plan's style that is the whole test (post-review A5F-2): the valley and counter gates decide whether a count is worth
  // reading, not whether the width leaves it in doubt — glyphs that touch with no valley are exactly where it is. With no
  // style the band is wide and says little, so the image must also allow that count: a valley that cuts no counter at
  // every boundary, deep enough where a boundary is added (a `000` split through a wall is no ambiguity).
  const finalAnchor = hyps[0].cells
  let widthAmbiguous = false
  for (const run of runs) {
    const w = run.x1 - run.x0 + 1
    const a = finalAnchor.filter((c) => c.x0 >= run.x0 && c.x1 <= run.x1).length
    if (a === 0) continue
    for (const k of [a - 1, a + 1]) {
      if (!admitted(w, k) || misfit(w, k) > misfit(w, a)) continue
      if (pitch !== null) {
        widthAmbiguous = true
        continue
      }
      const options = boundaryOptions(profile, run, k, counters)
      if (options.some((o) => o.options.length === 0)) continue
      if (k > a && options.length > 0 && Math.min(...options.map((o) => o.depth)) < COUNT_BOUNDS.addDepth) continue
      widthAmbiguous = true
    }
  }
  const before = hyps.length
  hyps = hyps.filter((h) => h.kind === 'ANCHOR' || !h.counterCut).slice(0, COUNT_BOUNDS.segmentationsPerVariant)
  return {
    hyps,
    reader,
    anchor: finalAnchor.length,
    alternatives: decisive ? [] : [...new Set(chosen.map((x) => x.k))].sort((a, b) => a - b),
    decisive: decisive !== undefined,
    widthAmbiguous,
    counterMoved,
    counterPruned: before - hyps.length,
  }
}

// ---------------------------------------------------------------------------
// glyphs and sequences
// ---------------------------------------------------------------------------

/** The admitted alphabet of a cell: digits in a full-height cell, the small signs in a short one. */
const alphabetOf = (relHeight: number): readonly string[] => (relHeight >= 0.6 ? DIGITS : SMALL_SIGNS)

/** Components of a cell's ink, 8-connected: more than one is a broken stroke. */
function pieces(c: CellCut): number {
  const { width: w, height: h, at } = c.source
  const seen = new Uint8Array(w * h)
  let n = 0
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!at(x, y) || seen[y * w + x]) continue
      n += 1
      const stack = [y * w + x]
      seen[y * w + x] = 1
      while (stack.length > 0) {
        const i = stack.pop() as number
        const cx = i % w
        const cy = (i - cx) / w
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const nx = cx + dx
            const ny = cy + dy
            if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen[ny * w + nx] || !at(nx, ny)) continue
            seen[ny * w + nx] = 1
            stack.push(ny * w + nx)
          }
        }
      }
    }
  }
  return n
}

function glyphOf(c: CellCut, touching: boolean): LatticeGlyph {
  const { scores, holes } = scoreCell(c.source, LATTICE_MATCHER)
  const alphabet = alphabetOf(c.source.relHeight)
  const admitted = scores.filter((s) => alphabet.includes(s.char))
  const top = admitted[0]?.score ?? 0
  const T = LATTICE_BOUNDS.temperature
  const z = admitted.reduce((a, s) => a + Math.exp((s.score - top) / T), 0)
  const prob = (s: number): number => (z > 0 ? Math.exp((s - top) / T) / z : 0)
  const candidates = admitted
    .filter((s, i) => i === 0 || (top > 0 && s.score >= LATTICE_BOUNDS.glyphRatio * top))
    .slice(0, LATTICE_BOUNDS.perCell)
    .map((s) => ({ char: s.char, score: s.score, p: round6(prob(s.score)) }))
  const second = admitted[1]?.score ?? 0
  const topoSecond = admitted.slice(1).find((s) => PROTOTYPE_HOLE_COUNTS.get(s.char)?.has(holes.count))?.score ?? 0
  return {
    x0: c.x0,
    x1: c.x1,
    candidates,
    top: round6(top),
    runnerRatio: top > 0 ? round6(second / top) : 0,
    topologyRunnerRatio: top > 0 ? round6(topoSecond / top) : 0,
    holes: holes.count,
    touching,
    broken: pieces(c) > 1,
  }
}

type Partial = { chars: string[]; picks: number[]; logP: number; nonTop: number }

/** The bounded beam over one path's cells. */
function beam(glyphs: readonly LatticeGlyph[], counter: { expansions: number; floorDrops: number }): Partial[] {
  let frontier: Partial[] = [{ chars: [], picks: [], logP: 0, nonTop: 0 }]
  for (const g of glyphs) {
    const next: Partial[] = []
    for (const f of frontier) {
      g.candidates.forEach((c, i) => {
        const nonTop = f.nonTop + (i === 0 ? 0 : 1)
        if (nonTop > LATTICE_BOUNDS.nonTop) return
        counter.expansions += 1
        next.push({ chars: [...f.chars, c.char], picks: [...f.picks, i], logP: round6(f.logP + Math.log(Math.max(1e-12, c.p))), nonTop })
      })
    }
    next.sort((a, b) => b.logP - a.logP || a.nonTop - b.nonTop || (a.chars.join('') < b.chars.join('') ? -1 : a.chars.join('') > b.chars.join('') ? 1 : 0))
    frontier = next.slice(0, LATTICE_BOUNDS.beam)
  }
  if (frontier.length === 0) return frontier
  const floor = frontier[0].logP + Math.log(LATTICE_BOUNDS.floor)
  const kept = frontier.filter((f) => f.logP >= floor)
  counter.floorDrops += frontier.length - kept.length
  return kept
}

/** The dimension a string states, in centimetres: a 2–4 digit whole number or a decimal in metres, never with a leading zero. */
export const dimensionValueOf = (text: string): number | undefined => {
  if (/^0\d/.test(text)) return undefined
  const parsed = parseNumber(text).find((p) => p.kind === 'LINEAR_DIMENSION')
  return parsed ? round6(toCentimetres(parsed.value, parsed.unit)) : undefined
}

const geoMean = (xs: readonly number[]): number => (xs.length === 0 ? 0 : round6(Math.exp(xs.reduce((a, x) => a + Math.log(Math.max(1e-6, x)), 0) / xs.length)))

// ---------------------------------------------------------------------------
// one label
// ---------------------------------------------------------------------------

export type LatticeCache = Map<string, { crop: Uint8ClampedArray; result: Omit<LabelLattice, 'glyphBoxes' | 'cache' | 'orientation' | 'rawTopText'> & { glyphBoxesInPass: PixelRect[] } }>

const hashBytes = (bytes: Uint8ClampedArray): string => {
  // FNV-1a, 32 bits twice with different offsets: a key, verified against the bytes on a hit.
  let a = 0x811c9dc5
  let b = 0x01000193 ^ 0x9e3779b9
  for (let i = 0; i < bytes.length; i += 1) {
    a = Math.imul(a ^ bytes[i], 0x01000193) >>> 0
    b = Math.imul(b ^ bytes[i], 0x01000197) >>> 0
  }
  return `${a.toString(16)}${b.toString(16)}:${bytes.length}`
}

/**
 * Re-read one raw token from its pass's ink field and return its lattice. The token must carry `passBox`
 * (`readNumbers(…, { retainPasses: true })`). Image only: nothing here sees a scale, a chain or a published figure.
 */
export function labelLattice(pass: PassField, token: TextToken, cache?: LatticeCache, style: LabelStyle = { pitch: null, samples: 0 }): LabelLattice | undefined {
  const box = token.passBox
  if (!box) return undefined
  const radius = pageMaskRadius(pass.ink.width, pass.ink.height)
  const crop = cropGray(pass.ink, box, radius + 2)
  const local = { x0: Math.round(box.x0) - crop.ox, y0: Math.round(box.y0) - crop.oy, x1: Math.round(box.x1) - crop.ox, y1: Math.round(box.y1) - crop.oy }
  // The style takes part in the reading (005F): two crops alike under different styles are two readings.
  const key = `${hashBytes(crop.gray.data)}|${crop.gray.width}x${crop.gray.height}|${local.x0},${local.y0},${local.x1},${local.y1}|${radius}|${style.pitch ?? 'none'}:${style.samples}`
  const held = cache?.get(key)
  const toPage = (r: PixelRect): PixelRect => pageRectOfPass({ x0: r.x0 + crop.ox, y0: r.y0 + crop.oy, x1: r.x1 + crop.ox, y1: r.y1 + crop.oy }, pass.orientation, pass.page)
  if (held && held.crop.length === crop.gray.data.length && held.crop.every((v, i) => v === crop.gray.data[i])) {
    const { glyphBoxesInPass, ...rest } = held.result
    return { ...rest, orientation: token.orientation, rawTopText: token.text, glyphBoxes: glyphBoxesInPass.map(toPage), cache: 'HIT' }
  }
  const computed = computeLattice(crop.gray, local, radius, style)
  if (!computed) return undefined
  cache?.set(key, { crop: crop.gray.data.slice(), result: computed })
  const { glyphBoxesInPass, ...rest } = computed
  return { ...rest, orientation: token.orientation, rawTopText: token.text, glyphBoxes: glyphBoxesInPass.map(toPage), cache: 'MISS' }
}

function computeLattice(gray: Gray, local: PixelRect, radius: number, style: LabelStyle): (Omit<LabelLattice, 'glyphBoxes' | 'cache' | 'orientation' | 'rawTopText'> & { glyphBoxesInPass: PixelRect[] }) | undefined {
  const counter = { expansions: 0, floorDrops: 0 }
  const paths: LatticePath[] = []
  const height = local.y1 - local.y0 + 1
  const width = local.x1 - local.x0 + 1
  let anchorDefault: { path: LatticePath; cells: CellCut[]; sheared: Bitmap; slope: number } | undefined
  const anchorsByVariant = new Map<InkVariant, { path: LatticePath; cells: CellCut[]; sheared: Bitmap; slope: number }>()
  const masks = new Map<InkVariant, Mask>()
  const raws = new Map<InkVariant, Bitmap>()
  for (const variant of INK_VARIANTS.slice(0, LATTICE_BOUNDS.variants)) {
    const mask = variantMask(gray, radius, variant)
    masks.set(variant, mask)
    raws.set(variant, cropToken(mask, local))
  }
  // 005F: which paths are count alternatives (their own text budget), and what the segmentation tried.
  const countAltPaths = new Set<string>()
  const telemetry: SegmentationTelemetry = { style, counts: [], counterCutsMoved: 0, counterCutsPruned: 0, segmentations: 0, cellsScored: 0, truncated: 0 }
  const widthAmbiguousOf = new Map<InkVariant, boolean>()
  const decisiveVariants: InkVariant[] = []
  const countAlternatives = new Set<number>()
  for (const variant of INK_VARIANTS.slice(0, LATTICE_BOUNDS.variants)) {
    const bmp = raws.get(variant) as Bitmap
    const { slope, sheared } = estimateShear(bmp)
    const anchorCells = segment(sheared)
    if (anchorCells.length === 0) continue
    // A stricter mask that breaks the ink into more cells than a dimension has is no reading of it: no paths, no beam.
    if (variant !== 'DEFAULT' && anchorCells.length > LATTICE_BOUNDS.maxCells) continue
    // The glyph height: the tallest cut's ink, the reader's own cap height.
    const capHeight = Math.max(1, ...cellSources(sheared, anchorCells).map((c) => c.y1 - c.y0 + 1))
    const reading = countHypotheses(sheared, capHeight, raws, variant, slope, style.pitch)
    telemetry.counts.push({ variant, reader: reading.reader, anchor: reading.anchor, alternatives: reading.alternatives, decisive: reading.decisive, widthAmbiguous: reading.widthAmbiguous })
    telemetry.counterCutsMoved += reading.counterMoved
    telemetry.counterCutsPruned += reading.counterPruned
    widthAmbiguousOf.set(variant, reading.widthAmbiguous)
    if (reading.decisive) decisiveVariants.push(variant)
    for (const k of reading.alternatives) countAlternatives.add(k)
    const memo = new Map<string, LatticeGlyph | null>()
    const variantPaths: Array<{ path: LatticePath; cells: CellCut[] }> = []
    reading.hyps.forEach((h, hi) => {
      // Bounded per ink (005F): segmentations and scored cells. The anchor is always read.
      if (h.kind !== 'ANCHOR' && telemetry.segmentations >= COUNT_BOUNDS.segmentationsPerInk) {
        telemetry.truncated += 1
        return
      }
      const cuts = cellSources(sheared, h.cells)
      if (cuts.length === 0) return
      const keyOf = (c: CellCut): string => `${c.x0}-${c.x1}|${c.source.relHeight}|${c.source.relTop}`
      const fresh = new Set(cuts.map(keyOf).filter((k) => !memo.has(k))).size
      if (h.kind !== 'ANCHOR' && telemetry.cellsScored + fresh > COUNT_BOUNDS.cellsPerInk) {
        telemetry.truncated += 1
        return
      }
      telemetry.segmentations += 1
      // A run the anchor split into several cells is touching ink.
      const runCells = new Map<number, number>()
      const runOf = (c: Cut): number => {
        let x = c.x0
        while (x > 0 && columnInk(sheared, x - 1) > 0) x -= 1
        return x
      }
      for (const c of h.cells) runCells.set(runOf(c), (runCells.get(runOf(c)) ?? 0) + 1)
      const glyphs = cuts.map((c) => {
        const k = keyOf(c)
        let g = memo.get(k)
        if (g === undefined) {
          g = glyphOf(c, (runCells.get(runOf(c)) ?? 1) > 1)
          memo.set(k, g)
          telemetry.cellsScored += 1
        }
        return g as LatticeGlyph
      })
      if (h.countAlt) countAltPaths.add(`${variant}:${hi}`)
      variantPaths.push({
        path: { id: `${variant}:${hi}`, variant, kind: h.kind, slope: round6(slope), cuts: h.cells.slice(1).map((c) => c.x0), changedBoundaries: h.changed, segScore: geoMean(glyphs.map((g) => g.top)), ratioToBest: 0, glyphs },
        cells: cuts,
      })
    })
    if (variantPaths.length === 0) continue
    const best = Math.max(...variantPaths.map((v) => v.path.segScore))
    const kept = variantPaths.filter((v) => v.path.kind === 'ANCHOR' || v.path.segScore >= LATTICE_BOUNDS.segmentationRatio * best)
    for (const v of kept) {
      v.path.ratioToBest = best > 0 ? round6(v.path.segScore / best) : 0
      paths.push(v.path)
      if (v.path.kind === 'ANCHOR') anchorsByVariant.set(variant, { path: v.path, cells: v.cells, sheared, slope })
      if (variant === 'DEFAULT' && v.path.kind === 'ANCHOR') anchorDefault = { path: v.path, cells: v.cells, sheared, slope }
    }
  }
  if (!anchorDefault) return undefined

  // Sequences per path, merged by text: one ink, one set of values; a value's score is the best path that reached it.
  // An anchor (the reader's cuts of one ink variant) contributes its beam; a re-cut only its own best reading, at a
  // cost, and at most `textsPerVariant` new values per variant and `textsPerInk` over the ink (pre-reviews A, C).
  type Merged = { text: string; logP: number; path: LatticePath; picks: number[]; nonTop: number; pathIds: string[]; variants: Set<InkVariant> }
  const merged = new Map<string, Merged>()
  const recutTexts = new Map<InkVariant, number>()
  let recutTotal = 0
  const offer = (path: LatticePath, s: Partial, logP: number): void => {
    const text = s.chars.join('')
    const held = merged.get(text)
    if (!held) merged.set(text, { text, logP, path, picks: s.picks, nonTop: s.nonTop, pathIds: [path.id], variants: new Set([path.variant]) })
    else {
      held.variants.add(path.variant)
      // The path that decides a value's score is listed first; the others in the order they reached it.
      if (logP > held.logP) Object.assign(held, { logP, path, picks: s.picks, nonTop: s.nonTop, pathIds: [path.id, ...held.pathIds] })
      else held.pathIds.push(path.id)
    }
  }
  // 005F: the anchors' final frontiers, kept for the ambiguity tail (`TAIL_BOUNDS`); they decide nothing.
  const frontiers: Array<{ path: LatticePath; partials: Partial[] }> = []
  for (const path of paths.filter((p) => p.kind === 'ANCHOR')) {
    const partials = beam(path.glyphs, counter)
    frontiers.push({ path, partials })
    for (const s of partials) offer(path, s, s.logP)
  }
  // 005F: a count alternative is a re-cut with its own budget of new texts, outside the re-cuts' (pre-review A C4).
  let countTexts = 0
  for (const path of paths.filter((p) => p.kind === 'RECUT')) {
    const top: Partial = { chars: path.glyphs.map((g) => g.candidates[0].char), picks: path.glyphs.map(() => 0), logP: round6(path.glyphs.reduce((a, g) => a + Math.log(Math.max(1e-12, g.candidates[0].p)), 0)), nonTop: 0 }
    counter.expansions += path.glyphs.length
    const text = top.chars.join('')
    if (!merged.has(text)) {
      if (countAltPaths.has(path.id)) {
        if (countTexts >= COUNT_BOUNDS.countTexts) continue
        countTexts += 1
      } else {
        if ((recutTexts.get(path.variant) ?? 0) >= LATTICE_BOUNDS.textsPerVariant || recutTotal >= LATTICE_BOUNDS.textsPerInk) continue
        recutTexts.set(path.variant, (recutTexts.get(path.variant) ?? 0) + 1)
        recutTotal += 1
      }
    }
    offer(path, top, round6(top.logP - LATTICE_BOUNDS.recutPenalty))
  }
  // The as-read string: the anchor (the reader's own cuts) of the ink variant whose cells match the templates best —
  // never a re-cut. On the development labels and both synthetic corpora this reads right where the reader's own mask
  // did not 13 and 76 times for 1 and 14 the other way (the stage's calibration tables).
  const anchors = paths.filter((p) => p.kind === 'ANCHOR')
  const asReadPath = pickAsRead(anchors.map((p) => ({ text: anchorText(p), segScore: p.segScore, variant: p.variant, path: p })), { text: anchorText(anchorDefault.path), segScore: anchorDefault.path.segScore, variant: 'DEFAULT', path: anchorDefault.path }).path
  const asReadText = anchorText(asReadPath)
  // The stability bracket: the stricter masks read again a tenth either way (DEFAULT is the reader's own and stays).
  const bracket = STABILITY_BRACKET.map((factor) => {
    const reads: AnchorRead[] = [{ text: anchorText(anchorDefault.path), segScore: anchorDefault.path.segScore, variant: 'DEFAULT' }]
    // The masks as this bracket reads them (DEFAULT is the reader's own and stays): the counters must persist in these.
    const bracketMasks = new Map(INK_VARIANTS.slice(0, LATTICE_BOUNDS.variants).map((v) => [v, v === 'DEFAULT' ? (masks.get(v) as Mask) : variantMask(gray, radius, v, factor)] as const))
    const bracketRaws = new Map([...bracketMasks].map(([v, m]) => [v, cropToken(m, local)] as const))
    for (const variant of INK_VARIANTS.slice(1, LATTICE_BOUNDS.variants)) {
      const r = anchorReading(bracketMasks.get(variant) as Mask, local, variant, bracketRaws, style.pitch)
      if (r) reads.push(r)
    }
    return pickAsRead(reads, reads[0]).text
  })
  const asReadStable = bracket.every((t) => (dimensionValueOf(asReadText) === undefined ? t === asReadText : dimensionValueOf(t) === dimensionValueOf(asReadText)))
  const asReadCells = asReadPath === anchorDefault.path ? anchorDefault : anchorsByVariant.get(asReadPath.variant)
  const ordered = [...merged.values()].sort((a, b) => b.logP - a.logP || a.nonTop - b.nonTop || (a.text < b.text ? -1 : a.text > b.text ? 1 : 0))
  // Emit best first until the mass or the count bound; the as-read string is always kept.
  const z = ordered.reduce((a, m) => a + Math.exp(m.logP - ordered[0].logP), 0)
  // At most `sequences` values, the as-read one among them: a slot is kept for it until it is emitted.
  const asReadEntry = merged.get(asReadText)
  const emitted: Merged[] = []
  let mass = 0
  let truncatedBy: LabelLattice['truncatedBy'] = 'NONE'
  for (const m of ordered) {
    const reserved = asReadEntry && m !== asReadEntry && !emitted.includes(asReadEntry) ? 1 : 0
    if (emitted.length + reserved >= LATTICE_BOUNDS.sequences) {
      truncatedBy = 'COUNT'
      break
    }
    if (mass >= LATTICE_BOUNDS.mass) {
      truncatedBy = 'MASS'
      break
    }
    emitted.push(m)
    mass += Math.exp(m.logP - ordered[0].logP) / z
  }
  if (asReadEntry && !emitted.includes(asReadEntry)) emitted.push(asReadEntry)
  if (truncatedBy === 'NONE' && counter.floorDrops > 0) truncatedBy = 'FLOOR'
  const zEmitted = emitted.reduce((a, m) => a + Math.exp(m.logP - ordered[0].logP), 0)
  // What the cut left out: the values merged, and the share of their probability the emitted ones carry.
  const mergedCount = ordered.length
  const emittedMass = round6(Math.min(1, zEmitted / z))
  const sequences: LatticeSequence[] = emitted.map((m) => {
    const chosen = m.picks.map((pick, i) => m.path.glyphs[i].candidates[pick])
    const margins = m.path.glyphs.map((g) => round6(1 - g.runnerRatio))
    const value = dimensionValueOf(m.text)
    return {
      text: m.text,
      ...(value !== undefined ? { valueCm: value } : {}),
      logP: m.logP,
      p: round6(Math.exp(m.logP - ordered[0].logP) / zEmitted),
      imageScore: geoMean(chosen.map((c) => c.score)),
      nonTop: m.picks.flatMap((pick, i) => (pick === 0 ? [] : [{ index: i, top: m.path.glyphs[i].candidates[0].char, chosen: m.path.glyphs[i].candidates[pick].char, ratio: round6(m.path.glyphs[i].candidates[pick].score / Math.max(1e-6, m.path.glyphs[i].top)) }])),
      minGlyphMargin: round6(Math.min(...margins)),
      avgGlyphMargin: round6(margins.reduce((a, x) => a + x, 0) / Math.max(1, margins.length)),
      pathIds: m.pathIds,
      variants: INK_VARIANTS.filter((v) => m.variants.has(v)),
      asRead: m.text === asReadText,
    }
  })

  // Reading quality, from the as-read path only.
  const read = asReadCells ?? anchorDefault
  const anchor = read.path
  const minGlyphScore = round6(Math.min(...anchor.glyphs.map((g) => g.top)))
  // Recorded beside the class: the worst runner ratio, a runner-up whose topology the cell contradicts set aside only
  // when the cell's hole count is the same in every ink variant (a counter a threshold opens or closes is no evidence).
  const stable = anchor.glyphs.map((g, i) => {
    const cell = read.cells[i]
    if (!cell) return false
    for (const [variant, mask] of masks) {
      if (variant === anchor.variant) continue
      const raw = cropToken(mask, local)
      // `estimateShear` leaves an upright token as it is; `shear` at slope 0 would pad it a column.
      const other = read.slope === 0 ? raw : shear(raw, read.slope)
      const at = (x: number, y: number): boolean => {
        const sx = cell.ix0 + x
        const sy = cell.y0 + y
        return sx < other.width && sy < other.height && other.data[sy * other.width + sx] === 1
      }
      if (holeStats(cell.ix1 - cell.ix0 + 1, cell.y1 - cell.y0 + 1, at).count !== g.holes) return false
    }
    return true
  })
  const ratios = anchor.glyphs.map((g, i) => (stable[i] ? g.topologyRunnerRatio : g.runnerRatio))
  const maxRunnerRatio = round6(Math.max(0, ...ratios))
  const asReadSeq = sequences.find((s) => s.asRead)
  const asReadScore = asReadSeq?.imageScore ?? geoMean(anchor.glyphs.map((g) => g.top))
  const asReadValue = dimensionValueOf(asReadText)
  const differs = (s: LatticeSequence): boolean => !s.asRead && (asReadValue === undefined ? s.text !== asReadText : s.valueCm !== undefined && s.valueCm !== asReadValue)
  const rivals = sequences.filter(differs)
  const sequenceMargin = asReadScore > 0 && rivals.length > 0 ? round6(Math.max(...rivals.map((s) => s.imageScore)) / asReadScore) : 0
  const asReadP = asReadSeq?.p ?? 0
  const probabilityMargin = asReadP > 0 && rivals.length > 0 ? round6(1 - Math.max(...rivals.map((s) => s.p)) / asReadP) : 1
  const B = OCR_CLASS_BOUNDS
  let ocrClass = ocrClassOf({ minGlyphScore, capHeightPx: height, asReadP, probabilityMargin, stable: asReadStable })
  // 005F (contract A5): how many glyphs the ink holds is part of what is read. A value of another digit count at a tenth
  // of the ink's values, or a cut whose width fits a glyph more or fewer as well, leaves the reading AMBIGUOUS; any other
  // value of another count keeps it from CLEAR. A 3-vs-4 ambiguity is never CLEAR.
  const digitsOf = (t: string): number => t.replace(/[^0-9]/g, '').length
  const asReadDigits = digitsOf(asReadText)
  const otherCount = sequences.filter((q) => !q.asRead && q.valueCm !== undefined && digitsOf(q.text) !== asReadDigits)
  const rivalP = round6(Math.max(0, ...otherCount.map((q) => q.p)))
  const widthAmbiguous = widthAmbiguousOf.get(anchor.variant) === true
  let countWhy: string | undefined
  if (ocrClass === 'CLEAR' || ocrClass === 'SUPPORTED') {
    // 005F: no figure is printed with a leading zero (005B): such a reading is of no dimension, however sure the glyphs.
    if (/^0\d/.test(asReadText)) {
      ocrClass = 'AMBIGUOUS'
      countWhy = `read ${asReadText}, with a leading zero no printed figure has: a reading of no dimension, whatever its glyphs score`
    } else if (rivalP >= COUNT_BOUNDS.countRivalP) {
      ocrClass = 'AMBIGUOUS'
      countWhy = `a value of another digit count holds ${rivalP} of the ink's values: the image does not settle how many glyphs it holds`
    } else if (widthAmbiguous) {
      ocrClass = 'AMBIGUOUS'
      countWhy = `its width fits a glyph more or fewer as well as the ${asReadDigits} it was cut into: the image does not settle how many glyphs it holds`
    } else if (!telemetry.counts.some((c) => c.reader === anchor.glyphs.length)) {
      // post-review A5F-1: a count no ink variant's own reader cut is the style's alone — and the style is the page's
      // median face, not necessarily this label's
      ocrClass = 'AMBIGUOUS'
      countWhy = `cut into ${anchor.glyphs.length}, a count only the plan's style gave it — no ink variant's reader cut it so: the image does not settle how many glyphs it holds`
    } else if (new Set([...anchorsByVariant.values()].map((v) => v.path.glyphs.length)).size > 1) {
      // post-review A5F-4: the image score cannot choose a count (contract §0)
      ocrClass = 'AMBIGUOUS'
      countWhy = `the ink variants cut it into different counts (${[...anchorsByVariant.values()].map((v) => v.path.glyphs.length).join('/')}): the image does not settle how many glyphs it holds`
    } else if (otherCount.length > 0 && ocrClass === 'CLEAR') {
      ocrClass = 'SUPPORTED'
      countWhy = `a value of another digit count is among the ink's values (${rivalP}): never CLEAR`
    } else if (ocrClass === 'CLEAR' && decisiveVariants.includes(anchor.variant)) {
      // post-review D5F-4: a count the plan's style chose over the reader's is a judgement about the ink's width, not a
      // reading the image settles alone — never CLEAR until blind rounds show such changes hold
      ocrClass = 'SUPPORTED'
      countWhy = `cut at the count the plan's style chose over the reader's: never CLEAR`
    }
  }
  const next = rivals.length > 0 ? `the next value ${round6(1 - probabilityMargin)} of it` : 'no other value'
  const classWhy = countWhy ??
    (ocrClass === 'LOW_QUALITY'
      ? height < B.legibleCapPx
        ? `set ${height} px tall, under the ${B.legibleCapPx} px a figure is legible at`
        : `a glyph matched at ${minGlyphScore}, under ${B.lowScore}: an ink or a cut the matcher cannot read`
      : !asReadStable
        ? `the stricter masks read it ${bracket.join(' / ')} a tenth of a threshold either way: the image does not decide it`
        : ocrClass === 'CLEAR'
          ? `the reading holds ${round6(asReadP)} of the ink's values and no other value comes within ${B.clearMargin} of it`
          : ocrClass === 'SUPPORTED'
            ? `the reading holds ${round6(asReadP)} of the ink's values; ${next}`
            : `the reading holds ${round6(asReadP)} of the ink's values; ${next}`)
  // 005F (contract A4, pre-review B): the ambiguity tail — values an anchor reached with exactly two moderate
  // substitutions, each supported by the image on its own, that the count bound cut. A record beside the values: no
  // probability, never as-read, outside every decision.
  const emittedValues = new Set(sequences.flatMap((q) => (q.valueCm !== undefined ? [q.valueCm] : [])))
  const shareBar = round6(LATTICE_BOUNDS.temperature * Math.log(1 / TAIL_BOUNDS.glyphShare))
  const tailByText = new Map<string, LatticeTailValue>()
  for (const { path, partials } of frontiers) {
    for (const q of partials) {
      if (q.nonTop !== TAIL_BOUNDS.substitutions) continue
      const supported = q.picks.every((pick, i) => {
        if (pick === 0) return true
        const g = path.glyphs[i]
        const c = g.candidates[pick]
        return round6(c.score) >= round6(TAIL_BOUNDS.glyphRatio * g.top) && round6(g.top - c.score) <= shareBar
      })
      if (!supported) continue
      const text = q.chars.join('')
      const valueCm = dimensionValueOf(text)
      if (valueCm === undefined || emittedValues.has(valueCm)) continue
      const held = tailByText.get(text)
      if (held) {
        if (q.logP > held.logP) Object.assign(held, { logP: q.logP, pathIds: [path.id, ...held.pathIds] })
        else held.pathIds.push(path.id)
        continue
      }
      tailByText.set(text, {
        text,
        valueCm,
        logP: q.logP,
        imageScore: geoMean(q.picks.map((pick, i) => path.glyphs[i].candidates[pick].score)),
        nonTop: q.picks.flatMap((pick, i) => (pick === 0 ? [] : [{ index: i, top: path.glyphs[i].candidates[0].char, chosen: path.glyphs[i].candidates[pick].char, ratio: round6(path.glyphs[i].candidates[pick].score / Math.max(1e-6, path.glyphs[i].top)) }])),
        pathIds: [path.id],
      })
    }
  }
  const tail: LatticeTailValue[] = []
  for (const t of [...tailByText.values()].sort((a, b) => b.logP - a.logP || (a.text < b.text ? -1 : a.text > b.text ? 1 : 0))) {
    if (tail.length >= TAIL_BOUNDS.perInk) break
    if (tail.some((u) => u.valueCm === t.valueCm)) continue
    tail.push(t)
  }
  const ps = sequences.map((s) => s.p).filter((p) => p > 0)
  const entropy = round6(-ps.reduce((a, p) => a + p * Math.log(p), 0))
  // The as-read cells on the page: the cut's columns mapped back through the shear's fraction, as the reader does.
  const sw = Math.max(1, read.sheared.width)
  const sh = Math.max(1, read.sheared.height)
  const glyphBoxesInPass = read.cells.map((c) => ({
    x0: round6(local.x0 + (c.ix0 / sw) * width),
    y0: round6(local.y0 + (c.y0 / sh) * height),
    x1: round6(local.x0 + ((c.ix1 + 1) / sw) * width),
    y1: round6(local.y0 + ((c.y1 + 1) / sh) * height),
  }))
  return {
    reader: { name: NUMERIC_LATTICE_NAME, version: NUMERIC_LATTICE_VERSION },
    asRead: asReadText,
    ...(asReadValue !== undefined ? { asReadValueCm: asReadValue } : {}),
    sequences,
    ocrClass,
    classWhy,
    minGlyphScore,
    maxRunnerRatio,
    sequenceMargin,
    asReadP: round6(asReadP),
    probabilityMargin,
    asReadVariant: anchor.variant,
    entropy,
    capHeightPx: height,
    paths,
    expansions: counter.expansions,
    truncatedBy,
    mergedCount,
    emittedMass,
    asReadStability: { stable: asReadStable, bracket },
    countAmbiguity: { asRead: asReadDigits, alternatives: [...countAlternatives].sort((a, b) => a - b), decisive: decisiveVariants, widthAmbiguous, rivalP },
    tail,
    segmentation: telemetry,
    glyphBoxesInPass,
  }
}

type AnchorRead = { text: string; segScore: number; variant: InkVariant }

const anchorText = (p: LatticePath): string => p.glyphs.map((g) => g.candidates[0]?.char ?? '').join('')

/**
 * The as-read rule: among the anchors that state a dimension the one whose cells match best; failing that, among those
 * without a leading zero (no number is printed with one); failing that, the reader's own (DEFAULT).
 */
function pickAsRead<T extends AnchorRead>(anchors: readonly T[], fallback: T): T {
  const valued = anchors.filter((a) => dimensionValueOf(a.text) !== undefined)
  const plain = anchors.filter((a) => !/^0\d/.test(a.text))
  return [...(valued.length > 0 ? valued : plain.length > 0 ? plain : [fallback])].sort((a, b) => b.segScore - a.segScore || INK_VARIANTS.indexOf(a.variant) - INK_VARIANTS.indexOf(b.variant))[0]
}

/**
 * One mask's anchor — the reader's own cuts of it under the 005F count and counter rules — read cell by cell, as
 * `computeLattice` reads it; no re-cuts, no beam. `raws` are the ink masks the counters must persist in.
 */
function anchorReading(mask: Mask, local: PixelRect, variant: InkVariant, raws: ReadonlyMap<InkVariant, Bitmap>, pitch: number | null): AnchorRead | undefined {
  const raw = cropToken(mask, local)
  const { sheared, slope } = estimateShear(raw)
  const reader = segment(sheared)
  if (reader.length === 0 || (variant !== 'DEFAULT' && reader.length > LATTICE_BOUNDS.maxCells)) return undefined
  const capHeight = Math.max(1, ...cellSources(sheared, reader).map((c) => c.y1 - c.y0 + 1))
  const cells = countHypotheses(sheared, capHeight, raws, variant, slope, pitch).hyps[0].cells
  const cuts = cellSources(sheared, cells)
  if (cuts.length === 0) return undefined
  const runOf = (c: Cut): number => {
    let x = c.x0
    while (x > 0 && columnInk(sheared, x - 1) > 0) x -= 1
    return x
  }
  const runCells = new Map<number, number>()
  for (const c of cells) runCells.set(runOf(c), (runCells.get(runOf(c)) ?? 0) + 1)
  const glyphs = cuts.map((c) => glyphOf(c, (runCells.get(runOf(c)) ?? 1) > 1))
  return { text: glyphs.map((g) => g.candidates[0]?.char ?? '').join(''), segScore: geoMean(glyphs.map((g) => g.top)), variant }
}

function columnInk(b: Bitmap, x: number): number {
  let n = 0
  for (let y = 0; y < b.height; y += 1) n += b.data[y * b.width + x]
  return n
}
