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
import { PROTOTYPE_HOLE_COUNTS, cellSources, cropToken, estimateShear, holeStats, pageRectOfPass, scoreCell, segment, shear } from './ocr.js'
import type { Bitmap, CellCut, MatcherOptions, TextOrientation, TextToken } from './ocr.js'
import { parseNumber } from './parse.js'
import { toCentimetres } from './schema.js'

export const NUMERIC_LATTICE_NAME = 'metrics.numeric-lattice' as const
export const NUMERIC_LATTICE_VERSION = '1.0.0' as const

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
 * text under the legible height. CLEAR: the reading holds at least `clearP` of the ink's mass (its margin is then at
 * least a third). SUPPORTED: at least `supportedP`, with no other value within `supportedMargin` of it — a two-value
 * coin toss is AMBIGUOUS whatever share it holds (005E post-review C P0). AMBIGUOUS otherwise, and whenever the as-read
 * value moves under the stability bracket (`STABILITY_BRACKET`). Chosen on the FIT labels and the calibration corpus,
 * checked on the held-back ones.
 */
export const OCR_CLASS_BOUNDS = { lowScore: 0.2, legibleCapPx: 10, clearP: 0.6, clearMargin: 0.3, supportedP: 0.35, supportedMargin: 0.3 } as const

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
  reader: { name: typeof NUMERIC_LATTICE_NAME; version: typeof NUMERIC_LATTICE_VERSION }
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
  cache: 'HIT' | 'MISS'
}

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

const valueOf = (text: string): number | undefined => {
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
export function labelLattice(pass: PassField, token: TextToken, cache?: LatticeCache): LabelLattice | undefined {
  const box = token.passBox
  if (!box) return undefined
  const radius = pageMaskRadius(pass.ink.width, pass.ink.height)
  const crop = cropGray(pass.ink, box, radius + 2)
  const local = { x0: Math.round(box.x0) - crop.ox, y0: Math.round(box.y0) - crop.oy, x1: Math.round(box.x1) - crop.ox, y1: Math.round(box.y1) - crop.oy }
  const key = `${hashBytes(crop.gray.data)}|${crop.gray.width}x${crop.gray.height}|${local.x0},${local.y0},${local.x1},${local.y1}|${radius}`
  const held = cache?.get(key)
  const toPage = (r: PixelRect): PixelRect => pageRectOfPass({ x0: r.x0 + crop.ox, y0: r.y0 + crop.oy, x1: r.x1 + crop.ox, y1: r.y1 + crop.oy }, pass.orientation, pass.page)
  if (held && held.crop.length === crop.gray.data.length && held.crop.every((v, i) => v === crop.gray.data[i])) {
    const { glyphBoxesInPass, ...rest } = held.result
    return { ...rest, orientation: token.orientation, rawTopText: token.text, glyphBoxes: glyphBoxesInPass.map(toPage), cache: 'HIT' }
  }
  const computed = computeLattice(crop.gray, local, radius)
  if (!computed) return undefined
  cache?.set(key, { crop: crop.gray.data.slice(), result: computed })
  const { glyphBoxesInPass, ...rest } = computed
  return { ...rest, orientation: token.orientation, rawTopText: token.text, glyphBoxes: glyphBoxesInPass.map(toPage), cache: 'MISS' }
}

function computeLattice(gray: Gray, local: PixelRect, radius: number): (Omit<LabelLattice, 'glyphBoxes' | 'cache' | 'orientation' | 'rawTopText'> & { glyphBoxesInPass: PixelRect[] }) | undefined {
  const counter = { expansions: 0, floorDrops: 0 }
  const paths: LatticePath[] = []
  const height = local.y1 - local.y0 + 1
  const width = local.x1 - local.x0 + 1
  let anchorDefault: { path: LatticePath; cells: CellCut[]; sheared: Bitmap; slope: number } | undefined
  const anchorsByVariant = new Map<InkVariant, { path: LatticePath; cells: CellCut[]; sheared: Bitmap; slope: number }>()
  const masks = new Map<InkVariant, Mask>()
  for (const variant of INK_VARIANTS.slice(0, LATTICE_BOUNDS.variants)) {
    const mask = variantMask(gray, radius, variant)
    masks.set(variant, mask)
    const bmp = cropToken(mask, local)
    const { slope, sheared } = estimateShear(bmp)
    const anchorCells = segment(sheared)
    if (anchorCells.length === 0) continue
    // A stricter mask that breaks the ink into more cells than a dimension has is no reading of it: no paths, no beam.
    if (variant !== 'DEFAULT' && anchorCells.length > LATTICE_BOUNDS.maxCells) continue
    // The glyph height: the tallest cut's ink, the reader's own cap height.
    const capHeight = Math.max(1, ...cellSources(sheared, anchorCells).map((c) => c.y1 - c.y0 + 1))
    const hyps = segmentationHypotheses(sheared, capHeight)
    const memo = new Map<string, LatticeGlyph | null>()
    const variantPaths: Array<{ path: LatticePath; cells: CellCut[] }> = []
    hyps.forEach((h, hi) => {
      const cuts = cellSources(sheared, h.cells)
      if (cuts.length === 0) return
      // A run the anchor split into several cells is touching ink.
      const runCells = new Map<number, number>()
      const runOf = (c: Cut): number => {
        let x = c.x0
        while (x > 0 && columnInk(sheared, x - 1) > 0) x -= 1
        return x
      }
      for (const c of h.cells) runCells.set(runOf(c), (runCells.get(runOf(c)) ?? 0) + 1)
      const glyphs = cuts.map((c) => {
        const k = `${c.x0}-${c.x1}|${c.source.relHeight}|${c.source.relTop}`
        let g = memo.get(k)
        if (g === undefined) {
          g = glyphOf(c, (runCells.get(runOf(c)) ?? 1) > 1)
          memo.set(k, g)
        }
        return g as LatticeGlyph
      })
      variantPaths.push({
        path: { id: `${variant}:${hi}`, variant, kind: hi === 0 ? 'ANCHOR' : 'RECUT', slope: round6(slope), cuts: h.cells.slice(1).map((c) => c.x0), changedBoundaries: h.changed, segScore: geoMean(glyphs.map((g) => g.top)), ratioToBest: 0, glyphs },
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
  for (const path of paths.filter((p) => p.kind === 'ANCHOR')) for (const s of beam(path.glyphs, counter)) offer(path, s, s.logP)
  for (const path of paths.filter((p) => p.kind === 'RECUT')) {
    const top: Partial = { chars: path.glyphs.map((g) => g.candidates[0].char), picks: path.glyphs.map(() => 0), logP: round6(path.glyphs.reduce((a, g) => a + Math.log(Math.max(1e-12, g.candidates[0].p)), 0)), nonTop: 0 }
    counter.expansions += path.glyphs.length
    const text = top.chars.join('')
    if (!merged.has(text)) {
      if ((recutTexts.get(path.variant) ?? 0) >= LATTICE_BOUNDS.textsPerVariant || recutTotal >= LATTICE_BOUNDS.textsPerInk) continue
      recutTexts.set(path.variant, (recutTexts.get(path.variant) ?? 0) + 1)
      recutTotal += 1
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
    for (const variant of INK_VARIANTS.slice(1, LATTICE_BOUNDS.variants)) {
      const r = anchorReading(variantMask(gray, radius, variant, factor), local, variant)
      if (r) reads.push(r)
    }
    return pickAsRead(reads, reads[0]).text
  })
  const asReadStable = bracket.every((t) => (valueOf(asReadText) === undefined ? t === asReadText : valueOf(t) === valueOf(asReadText)))
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
    const value = valueOf(m.text)
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
  const asReadValue = valueOf(asReadText)
  const differs = (s: LatticeSequence): boolean => !s.asRead && (asReadValue === undefined ? s.text !== asReadText : s.valueCm !== undefined && s.valueCm !== asReadValue)
  const rivals = sequences.filter(differs)
  const sequenceMargin = asReadScore > 0 && rivals.length > 0 ? round6(Math.max(...rivals.map((s) => s.imageScore)) / asReadScore) : 0
  const asReadP = asReadSeq?.p ?? 0
  const probabilityMargin = asReadP > 0 && rivals.length > 0 ? round6(1 - Math.max(...rivals.map((s) => s.p)) / asReadP) : 1
  const B = OCR_CLASS_BOUNDS
  const ocrClass = ocrClassOf({ minGlyphScore, capHeightPx: height, asReadP, probabilityMargin, stable: asReadStable })
  const next = rivals.length > 0 ? `the next value ${round6(1 - probabilityMargin)} of it` : 'no other value'
  const classWhy =
    ocrClass === 'LOW_QUALITY'
      ? height < B.legibleCapPx
        ? `set ${height} px tall, under the ${B.legibleCapPx} px a figure is legible at`
        : `a glyph matched at ${minGlyphScore}, under ${B.lowScore}: an ink or a cut the matcher cannot read`
      : !asReadStable
        ? `the stricter masks read it ${bracket.join(' / ')} a tenth of a threshold either way: the image does not decide it`
        : ocrClass === 'CLEAR'
          ? `the reading holds ${round6(asReadP)} of the ink's values and no other value comes within ${B.clearMargin} of it`
          : ocrClass === 'SUPPORTED'
            ? `the reading holds ${round6(asReadP)} of the ink's values; ${next}`
            : `the reading holds ${round6(asReadP)} of the ink's values; ${next}`
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
  const valued = anchors.filter((a) => valueOf(a.text) !== undefined)
  const plain = anchors.filter((a) => !/^0\d/.test(a.text))
  return [...(valued.length > 0 ? valued : plain.length > 0 ? plain : [fallback])].sort((a, b) => b.segScore - a.segScore || INK_VARIANTS.indexOf(a.variant) - INK_VARIANTS.indexOf(b.variant))[0]
}

/** One mask's anchor — the reader's own cuts of it — read cell by cell, as `computeLattice` reads it; no re-cuts, no beam. */
function anchorReading(mask: Mask, local: PixelRect, variant: InkVariant): AnchorRead | undefined {
  const { sheared } = estimateShear(cropToken(mask, local))
  const cells = segment(sheared)
  if (cells.length === 0 || (variant !== 'DEFAULT' && cells.length > LATTICE_BOUNDS.maxCells)) return undefined
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
