/**
 * Reading the numbers printed on a drawing.
 *
 * This is deliberately a NUMERIC reader, not a general one. A published
 * architectural drawing carries its hard evidence as short strings of digits
 * with a handful of signs — `790`, `+3,06`, `−0,32`, `40°`, `300/230` — and a
 * reader restricted to that alphabet can be held to a much higher standard
 * than one that must also cope with Polish room names in a condensed italic.
 * Room names are left to a vision pass; numbers are read here, deterministically.
 *
 * The pipeline, in order, and why each step is there:
 *
 *  1. **Ink.** A local-contrast mask, because dimension text on these sheets is
 *     a mid grey on a light grey page under a watermark, and a global
 *     threshold either misses it or floods.
 *  2. **Glyph-sized components.** A digit is a small, dense, isolated blob.
 *     Anything too large, too thin or too sparse is drawing, not text.
 *  3. **Tokens.** Glyphs on a common baseline, within a gap of their own
 *     height, are one number. This is where `1205` becomes one thing.
 *  4. **De-skew.** Drawing text is usually italic and italic glyphs TOUCH, so
 *     they arrive as one component. The shear that maximises the contrast of
 *     the column ink profile is the one that stands the token upright, and an
 *     upright token segments on its own valleys.
 *  5. **Segmentation.** Vertical projection valleys, with an expected glyph
 *     width from the token's height, so a merged `205` becomes three cells.
 *  6. **Classification.** Shape overlap against the bitmaps in `font.ts`,
 *     with the number of enclosed holes as a separate strong signal. Every
 *     glyph reports its own score, and the token's confidence is the weakest
 *     of them: a number is only as good as its worst digit.
 *
 * What the reader never does is guess. A cell whose best match is not clearly
 * better than its second is returned as a glyph with alternatives and a low
 * score, and the caller decides whether a reading that weak is worth having.
 */
import { round6 } from '@buildapp/source-common'
import type { PixelRect } from '@buildapp/source-common'
import { rectIoU } from '@buildapp/source-common'
import { adaptiveInkMask, connectedComponents, inkChannel } from '@buildapp/source-cv'
import type { Gray, Mask, Raster } from '@buildapp/source-cv'
import { ALTERNATE_BITMAPS, GLYPH_ALPHABET, GLYPH_BITMAPS } from './font.js'

/** Normalised grid every glyph and every prototype is resampled onto. */
export const CELL_W = 12
export const CELL_H = 16

export type GlyphReading = {
  /** The character this cell was read as. */
  char: string
  /** 0..1: how well the cell matched, after the topology check. */
  score: number
  /**
   * 0.5..1: how much better the winner is than the runner-up.
   *
   * The match score says how good the reading is; this says how DECIDED it is,
   * and they are different questions. A clean `+` matched at 0.36 against
   * nothing else is a certain plus sign; a `1` matched at 0.52 with a `2` at
   * 0.45 behind it is a coin toss however respectable 0.52 looks. A constraint
   * may only be hard when the reading is decided, so this is the number the
   * evidence layer gates on.
   */
  confidence: number
  /** Other characters that also fit, best first. Empty when the winner was clear. */
  alternatives: Array<{ char: string; score: number }>
  /** Where the cell is, in the source image's pixels. */
  box: PixelRect
  /** Enclosed holes in the cell and where they sit: the topology signal, kept for the record. */
  holes: HoleStats
}

export type TextToken = {
  /** The characters, joined. */
  text: string
  /** Weakest glyph score in the token: a number is only as good as its worst digit. */
  score: number
  /** Weakest glyph confidence in the token: one undecided digit makes the whole number undecided. */
  confidence: number
  glyphs: GlyphReading[]
  box: PixelRect
  /** Estimated italic shear, in degrees, that stood the token upright. */
  shearDeg: number
  /** Cap height of the token's glyphs, in pixels: the text size this was read at. */
  height: number
  /** Which way up the text was when it was read. */
  orientation: TextOrientation
}

/**
 * Which way a run of text is set.
 *
 * Drawings turn their text. A vertical dimension chain carries its numbers
 * rotated a quarter turn so they read along the chain, and a reader that only
 * knows horizontal text sees a column of unrelated blobs where a plan's entire
 * depth is written. Reading a page therefore means reading it three times —
 * once as it lies and once each way on its side — and saying, for every token,
 * which pass found it.
 */
export type TextOrientation = 'HORIZONTAL' | 'ROTATED_CW' | 'ROTATED_CCW'

export type OcrOptions = {
  /** Smallest glyph height, in pixels. Below this a component is noise. */
  minGlyphHeight?: number
  /** Largest glyph height, in pixels, as a fraction of the image's larger edge. */
  maxGlyphHeightFrac?: number
  /** How much darker than its neighbourhood a pixel must be to count as ink. */
  inkDelta?: number
  /** Below this score a glyph is returned but the token is not trusted. */
  minGlyphScore?: number
  /** Only read inside this rectangle. */
  region?: PixelRect
  /** Which way up to read. Defaults to all three. */
  orientations?: readonly TextOrientation[]
}

const DEFAULTS: Required<Omit<OcrOptions, 'region' | 'orientations'>> = { minGlyphHeight: 6, maxGlyphHeightFrac: 0.06, inkDelta: 8, minGlyphScore: 0.55 }

// ---------------------------------------------------------------------------
// prototypes
// ---------------------------------------------------------------------------

type Prototype = {
  char: string
  /**
   * The prototype's shape at several slants.
   *
   * De-skewing a token straightens its VERTICAL strokes, but a typeface's
   * diagonals — the stem of a 7, the waist of a 4 — end up straighter or
   * steeper than an upright specimen of the same digit, by however much the
   * estimate missed and however much this typeface's italic differs from a
   * simple slant. Matching against a few slants of each prototype absorbs
   * both, and costs nothing: there are seventeen characters and the grids are
   * tiny.
   */
  cells: Array<{ cell: Float64Array; field: Float64Array }>
  holes: HoleStats
  aspect: number
  /** Ink-box height as a fraction of the font's cap height: 1 for a digit, a fifth for a comma. */
  relHeight: number
  /** Top of the ink box as a fraction of the cap height, from the cap line: 0 for a digit, near 1 for a comma. */
  relTop: number
}

/**
 * Resample a boolean bitmap onto the normalised cell by area coverage,
 * KEEPING ITS PROPORTIONS, and centred.
 *
 * Stretching each glyph to fill the grid is the obvious normalisation and it
 * is catastrophic here: a `1` is a bar three pixels wide, and stretched to
 * twelve it becomes a solid slab whose chamfer distance to every other digit
 * is tiny — so a one wins against a two, a seven and a five alike. Scaling by
 * the larger dimension and centring keeps a one a bar and a zero a ring, which
 * is the difference the matcher is supposed to be measuring.
 */
function resample(width: number, height: number, at: (x: number, y: number) => boolean): Float64Array {
  const out = new Float64Array(CELL_W * CELL_H)
  const scale = Math.min(CELL_W / width, CELL_H / height)
  const w = Math.max(1, Math.min(CELL_W, Math.round(width * scale)))
  const h = Math.max(1, Math.min(CELL_H, Math.round(height * scale)))
  const ox = Math.floor((CELL_W - w) / 2)
  const oy = Math.floor((CELL_H - h) / 2)
  for (let gy = 0; gy < h; gy += 1) {
    const y0 = (gy * height) / h
    const y1 = ((gy + 1) * height) / h
    for (let gx = 0; gx < w; gx += 1) {
      const x0 = (gx * width) / w
      const x1 = ((gx + 1) * width) / w
      let hit = 0
      let n = 0
      // Sample the source box; at least one sample per cell even when the
      // source is smaller than the grid.
      const steps = 3
      for (let sy = 0; sy < steps; sy += 1) {
        for (let sx = 0; sx < steps; sx += 1) {
          const px = Math.min(width - 1, Math.floor(x0 + ((x1 - x0) * (sx + 0.5)) / steps))
          const py = Math.min(height - 1, Math.floor(y0 + ((y1 - y0) * (sy + 0.5)) / steps))
          if (at(px, py)) hit += 1
          n += 1
        }
      }
      out[(oy + gy) * CELL_W + ox + gx] = n === 0 ? 0 : hit / n
    }
  }
  return out
}

export type HoleStats = {
  /** Enclosed background regions: 0 for 1/2/3/5/7, 1 for 0/4/6/9, 2 for 8. */
  count: number
  /** Centre of the largest hole, down from the glyph's top, as a fraction of its height. */
  cy: number
  /** Area of the largest hole, as a fraction of the glyph's box. */
  areaFrac: number
}

/**
 * Holes, and where they are.
 *
 * The count alone splits the digits into three families and leaves the hardest
 * one — 0, 4, 6 and 9 — undivided, which is exactly the family a small,
 * slanted, JPEG-softened glyph gets wrong. Where the hole SITS separates them
 * at a glance and at a pixel: high for a 9 and a 4, low for a 6, centred and
 * large for a 0.
 *
 * Holes smaller than a twentieth of the glyph are ignored. At this size a
 * single stray pixel bridging a counter turns one hole into two, and a reader
 * that lets that decide between a 0 and an 8 is reading the compression, not
 * the drawing.
 */
export function holeStats(width: number, height: number, at: (x: number, y: number) => boolean): HoleStats {
  // Flood the background from the border; anything unreached is enclosed.
  const seen = new Uint8Array(width * height)
  const stack: number[] = []
  const push = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    const i = y * width + x
    if (seen[i] || at(x, y)) return
    seen[i] = 1
    stack.push(i)
  }
  for (let x = 0; x < width; x += 1) {
    push(x, 0)
    push(x, height - 1)
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y)
    push(width - 1, y)
  }
  while (stack.length > 0) {
    const i = stack.pop() as number
    const x = i % width
    const y = (i - x) / width
    push(x + 1, y)
    push(x - 1, y)
    push(x, y + 1)
    push(x, y - 1)
  }
  const minArea = Math.max(2, Math.round(width * height * 0.035))
  const visited = new Uint8Array(width * height)
  const regions: Array<{ area: number; sumY: number }> = []
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x
      if (at(x, y) || seen[i] || visited[i]) continue
      const q = [i]
      visited[i] = 1
      let area = 0
      let sumY = 0
      while (q.length > 0) {
        const j = q.pop() as number
        const jx = j % width
        const jy = (j - jx) / width
        area += 1
        sumY += jy
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const nx = jx + dx
          const ny = jy + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const k = ny * width + nx
          if (at(nx, ny) || seen[k] || visited[k]) continue
          visited[k] = 1
          q.push(k)
        }
      }
      if (area >= minArea) regions.push({ area, sumY })
    }
  }
  if (regions.length === 0) return { count: 0, cy: 0.5, areaFrac: 0 }
  const largest = regions.reduce((a, b) => (b.area > a.area ? b : a))
  return { count: regions.length, cy: round6(largest.sumY / largest.area / Math.max(1, height - 1)), areaFrac: round6(largest.area / (width * height)) }
}

function buildPrototype(char: string, rows: readonly string[]): Prototype {
  const h = rows.length
  const w = rows[0].length
  // Trim to the glyph's own ink box, so a short sign and a full-height digit
  // are compared on the same normalised grid rather than by where they sit.
  let x0 = w
  let x1 = -1
  let y0 = h
  let y1 = -1
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (rows[y][x] !== '#') continue
      x0 = Math.min(x0, x)
      x1 = Math.max(x1, x)
      y0 = Math.min(y0, y)
      y1 = Math.max(y1, y)
    }
  }
  const bw = x1 - x0 + 1
  const bh = y1 - y0 + 1
  const at = (x: number, y: number): boolean => rows[y0 + y][x0 + x] === '#'
  // Slanted copies: the shear is applied about the glyph's vertical centre,
  // the same way the reader de-skews a token, so a residual slant in the
  // reader's estimate is a slant one of these copies already carries.
  const slanted = (slope: number) => {
    const pad = Math.ceil(Math.abs(slope) * bh) + 1
    const w2 = bw + pad
    const grid = new Uint8Array(w2 * bh)
    const mid = (bh - 1) / 2
    for (let y = 0; y < bh; y += 1) {
      const shift = Math.round((mid - y) * slope) + (slope > 0 ? 0 : pad)
      for (let x = 0; x < bw; x += 1) {
        if (!at(x, y)) continue
        const nx = x + shift
        if (nx < 0 || nx >= w2) continue
        grid[y * w2 + nx] = 1
      }
    }
    return resample(w2, bh, (x, y) => grid[y * w2 + x] === 1)
  }
  // The font grid's own height is the cap height: a digit fills it, a comma
  // occupies a fifth of it at the bottom, a degree sign a quarter at the top.
  // That relative size and position is most of a sign's identity at this
  // resolution, and comparing shape alone would let every small blob match
  // every small prototype.
  return {
    char,
    cells: [resample(bw, bh, at), slanted(-0.22), slanted(-0.11), slanted(0.11), slanted(0.22)].map((c) => {
      const t = thin(c)
      return { cell: t, field: distanceField(t) }
    }),
    holes: holeStats(bw, bh, at),
    aspect: bw / bh,
    relHeight: bh / h,
    relTop: y0 / h,
  }
}

const PROTOTYPES: Prototype[] = GLYPH_ALPHABET.flatMap((char) => [buildPrototype(char, GLYPH_BITMAPS[char]), ...(ALTERNATE_BITMAPS[char] ?? []).map((rows) => buildPrototype(char, rows))])

// ---------------------------------------------------------------------------
// glyph classification
// ---------------------------------------------------------------------------

/**
 * Shape distance between two normalised cells.
 *
 * Plain overlap (intersection over union) is the obvious measure and it is the
 * wrong one at this size: a glyph thirteen pixels tall resampled onto a
 * sixteen-row grid lands a stroke half a cell off as often as not, and overlap
 * punishes that as hard as it punishes a different digit. Chamfer distance —
 * how far each inked cell is from the nearest inked cell of the other shape,
 * both ways — forgives the shift and still separates the digits, because a 5
 * and a 6 differ by where their strokes ARE and not by half a cell.
 */
function distanceField(cell: Float64Array): Float64Array {
  const INF = 1e6
  const d = new Float64Array(CELL_W * CELL_H)
  for (let i = 0; i < d.length; i += 1) d[i] = cell[i] > 0.35 ? 0 : INF
  // Two-pass chamfer on a 4-neighbourhood with diagonals, which on a grid this
  // small is within a few percent of the true Euclidean distance.
  const step = (x: number, y: number, dx: number, dy: number, cost: number): void => {
    const nx = x + dx
    const ny = y + dy
    if (nx < 0 || ny < 0 || nx >= CELL_W || ny >= CELL_H) return
    const v = d[ny * CELL_W + nx] + cost
    if (v < d[y * CELL_W + x]) d[y * CELL_W + x] = v
  }
  for (let y = 0; y < CELL_H; y += 1) {
    for (let x = 0; x < CELL_W; x += 1) {
      step(x, y, -1, 0, 1)
      step(x, y, 0, -1, 1)
      step(x, y, -1, -1, 1.414)
      step(x, y, 1, -1, 1.414)
    }
  }
  for (let y = CELL_H - 1; y >= 0; y -= 1) {
    for (let x = CELL_W - 1; x >= 0; x -= 1) {
      step(x, y, 1, 0, 1)
      step(x, y, 0, 1, 1)
      step(x, y, 1, 1, 1.414)
      step(x, y, -1, 1, 1.414)
    }
  }
  return d
}

/**
 * Zhang–Suen thinning: reduce a shape to a one-cell-wide skeleton.
 *
 * Without this the matcher spends most of its discrimination on STROKE WEIGHT.
 * A dimension printed thirteen pixels tall has strokes two pixels thick, which
 * on the normalised grid is a fifth of the glyph's width, and a prototype
 * drawn with the same nominal thickness at twelve rows is fatter still. Two
 * fat shapes overlap heavily whatever they are — which is how a one comes to
 * match a two — and the only way to compare the SKELETONS the typeface
 * actually draws is to reduce both to skeletons first.
 *
 * The algorithm is the standard one and it is deterministic: iterate two
 * alternating passes, deleting boundary pixels whose removal cannot break the
 * shape, until nothing changes.
 */
export function thin(cell: Float64Array): Float64Array {
  const g = new Uint8Array(CELL_W * CELL_H)
  for (let i = 0; i < g.length; i += 1) g[i] = cell[i] > 0.35 ? 1 : 0
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= CELL_W || y >= CELL_H ? 0 : g[y * CELL_W + x])
  for (let guard = 0; guard < 64; guard += 1) {
    let removed = 0
    for (const pass of [0, 1]) {
      const doomed: number[] = []
      for (let y = 0; y < CELL_H; y += 1) {
        for (let x = 0; x < CELL_W; x += 1) {
          if (g[y * CELL_W + x] !== 1) continue
          // The eight neighbours, clockwise from north.
          const n = [at(x, y - 1), at(x + 1, y - 1), at(x + 1, y), at(x + 1, y + 1), at(x, y + 1), at(x - 1, y + 1), at(x - 1, y), at(x - 1, y - 1)]
          const count = n.reduce((a, b) => a + b, 0)
          if (count < 2 || count > 6) continue
          // Exactly one 0→1 transition going round: removing the pixel keeps
          // the shape connected.
          let transitions = 0
          for (let k = 0; k < 8; k += 1) if (n[k] === 0 && n[(k + 1) % 8] === 1) transitions += 1
          if (transitions !== 1) continue
          const [n0, n1, n2, n3, n4, n5, n6, n7] = n
          if (pass === 0) {
            if (n0 * n2 * n4 !== 0) continue
            if (n2 * n4 * n6 !== 0) continue
          } else {
            if (n0 * n2 * n6 !== 0) continue
            if (n0 * n4 * n6 !== 0) continue
          }
          void n1
          void n3
          void n5
          void n7
          doomed.push(y * CELL_W + x)
        }
      }
      for (const i of doomed) g[i] = 0
      removed += doomed.length
    }
    if (removed === 0) break
  }
  const out = new Float64Array(CELL_W * CELL_H)
  for (let i = 0; i < g.length; i += 1) out[i] = g[i]
  return out
}

/**
 * Distance from one shape's ink to the other's, weighted by ink coverage, as a
 * ROOT MEAN SQUARE rather than a plain mean.
 *
 * The plain mean is too kind to a shape that is a subset of another. A one is
 * a bar, and every pixel of that bar sits on or beside some stroke of a two,
 * so the two's extra ink — the whole left half of it — is averaged away
 * against a sea of near-zero distances and a one scores as well against a two
 * as a two does. Squaring makes a part of the shape that has no counterpart at
 * all cost what it should, which is the thing that actually distinguishes
 * these digits.
 */
function directedChamfer(from: Float64Array, toField: Float64Array): number {
  let sum = 0
  let weight = 0
  for (let i = 0; i < from.length; i += 1) {
    if (from[i] <= 0) continue
    sum += from[i] * toField[i] * toField[i]
    weight += from[i]
  }
  return weight <= 0 ? 8 : Math.sqrt(sum / weight)
}

/** Soft intersection over union: how much ink the two shapes actually share. */
export function overlapScore(a: Float64Array, b: Float64Array): number {
  let inter = 0
  let union = 0
  for (let i = 0; i < a.length; i += 1) {
    inter += Math.min(a[i], b[i])
    union += Math.max(a[i], b[i])
  }
  return union <= 0 ? 0 : inter / union
}

/** 1 when the shapes coincide, falling off with the symmetric chamfer distance. */
function shapeScore(cell: Float64Array, cellField: Float64Array, proto: Float64Array, protoField: Float64Array): number {
  const both = (directedChamfer(cell, protoField) + directedChamfer(proto, cellField)) / 2
  // Half a grid cell of error is a soft edge; two and a half is a different glyph.
  return Math.max(0, 1 - both / 2.5)
}

export type CellSource = {
  width: number
  height: number
  at: (x: number, y: number) => boolean
  /** The cell's ink height, as a fraction of the token's cap height. */
  relHeight: number
  /** The cell's top, measured down from the token's cap line, as a fraction of the cap height. */
  relTop: number
}

/** How well a cell's size and position on the line match a prototype's. */
function sizePrior(source: CellSource, p: Prototype): number {
  const dh = Math.abs(source.relHeight - p.relHeight)
  const dt = Math.abs(source.relTop - p.relTop)
  // A tenth of the cap height is nothing; half of it is a different character.
  return Math.max(0.05, 1 - dh * 1.6 - dt * 1.2)
}

/**
 * How well a cell's proportions match a prototype's, as a graded penalty.
 *
 * A threshold here is the wrong shape of rule, and the reason is a one: a `1`
 * is roughly a third as wide as it is tall and every other digit is half to
 * two thirds, so a band wide enough not to reject a fat one is also wide
 * enough to let a one win against a seven. Scoring the log of the ratio is
 * symmetric — twice as wide is penalised exactly as much as half as wide —
 * and leaves the decision to the shape when the proportions are close.
 */
function aspectPrior(aspect: number, p: Prototype): number {
  const r = Math.log(Math.max(0.05, aspect) / Math.max(0.05, p.aspect))
  return Math.max(0.2, 1 - Math.abs(r) * 0.95)
}

/** Classify one glyph cell against the prototypes. */
export function classifyCell(source: CellSource, box: PixelRect): GlyphReading {
  const cell = thin(resample(source.width, source.height, source.at))
  const cellField = distanceField(cell)
  const holes = holeStats(source.width, source.height, source.at)
  const aspect = source.width / Math.max(1, source.height)
  const perPrototype = PROTOTYPES.map((p) => {
    let score = Math.max(...p.cells.map((c) => shapeScore(cell, cellField, c.cell, c.field)))
    // Topology is a far stronger signal than pixel overlap at this size: an
    // 8 and a 0 overlap heavily and differ by one enclosed region.
    if (p.holes.count !== holes.count) score *= 0.5
    else if (holes.count > 0) {
      // Same family: WHERE the hole sits is what separates a 9 from a 6.
      score *= Math.max(0.35, 1 - Math.abs(holes.cy - p.holes.cy) * 2.2 - Math.abs(holes.areaFrac - p.holes.areaFrac) * 1.2)
    }
    // A glyph much wider or narrower than the prototype is a different glyph,
    // however well the resampled grids happen to line up.
    score *= aspectPrior(aspect, p)
    // And a full-height blob is not a comma however well a comma's stub
    // happens to correlate with it once both are stretched to one grid.
    score *= sizePrior(source, p)
    return { char: p.char, score: round6(score) }
  })
  // One score per CHARACTER — the best of its forms — so an open four and a
  // closed four are one candidate rather than two competing ones.
  const byChar = new Map<string, number>()
  for (const r of perPrototype) byChar.set(r.char, Math.max(byChar.get(r.char) ?? 0, r.score))
  const scored = [...byChar].map(([char, score]) => ({ char, score })).sort((a, b) => b.score - a.score || a.char.localeCompare(b.char))
  const best = scored[0]
  // Every reading keeps its runners-up, always. A dimension chain that has to
  // sum can then choose among them, and a chain is a far better judge of a
  // thirteen-pixel digit than any amount of template matching.
  const alternatives = scored.slice(1, 4).filter((s) => s.score > 0.2)
  const runnerUp = scored[1]?.score ?? 0
  const confidence = best.score + runnerUp <= 0 ? 0 : round6(best.score / (best.score + runnerUp))
  return { char: best.char, score: best.score, confidence, alternatives, box, holes }
}

// ---------------------------------------------------------------------------
// tokens
// ---------------------------------------------------------------------------

type Blob = { box: PixelRect; pixels: number }

const boxHeight = (b: PixelRect): number => b.y1 - b.y0 + 1
const boxWidth = (b: PixelRect): number => b.x1 - b.x0 + 1

/** Merge two boxes. */
const merge = (a: PixelRect, b: PixelRect): PixelRect => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) })

/**
 * Group glyph blobs into tokens: same baseline, similar height, a gap no wider
 * than a glyph. A comma sits below the baseline and a degree sign above it, so
 * the test is overlap of the vertical extents rather than equality of them.
 */
function groupTokens(blobs: readonly Blob[], marks: readonly Blob[] = []): Blob[][] {
  const sorted = [...blobs].sort((a, b) => a.box.x0 - b.box.x0 || a.box.y0 - b.box.y0)
  const used = new Set<number>()
  const tokens: Blob[][] = []
  const boxes: PixelRect[] = []
  for (let i = 0; i < sorted.length; i += 1) {
    if (used.has(i)) continue
    const group = [sorted[i]]
    used.add(i)
    let box = sorted[i].box
    for (let j = i + 1; j < sorted.length; j += 1) {
      if (used.has(j)) continue
      const b = sorted[j].box
      const h = Math.max(boxHeight(box), boxHeight(b))
      const gap = b.x0 - box.x1
      if (gap > h * 0.9) continue
      if (gap < -h * 0.6) continue
      const overlapY = Math.min(box.y1, b.y1) - Math.max(box.y0, b.y0)
      if (overlapY < Math.min(boxHeight(box), boxHeight(b)) * 0.35) continue
      group.push(sorted[j])
      used.add(j)
      box = merge(box, b)
    }
    tokens.push(group)
    boxes.push(box)
  }

  // Punctuation is too small to be a glyph and too important to lose.
  //
  // A comma is three pixels tall beside a digit that is twenty-two, so the
  // height floor that keeps speckle out of the reader also throws away the
  // decimal separator — and `+2,80` arrives as `+2` and `80`, which parses to
  // nothing and loses a storey height. So small dense marks are collected
  // separately and may JOIN a token, never start one: a full-height glyph is
  // still required before anything is read at all.
  for (const mark of marks) {
    let best: { index: number; distance: number } | undefined
    for (let i = 0; i < boxes.length; i += 1) {
      const box = boxes[i]
      const h = boxHeight(box)
      const gap = Math.max(box.x0 - mark.box.x1, mark.box.x0 - box.x1)
      if (gap > h * 0.55) continue
      // On the line, or hanging just below it, or sitting just above it.
      if (mark.box.y1 < box.y0 - h * 0.35) continue
      if (mark.box.y0 > box.y1 + h * 0.35) continue
      const distance = Math.max(0, gap)
      if (!best || distance < best.distance) best = { index: i, distance }
    }
    if (!best) continue
    tokens[best.index].push(mark)
    boxes[best.index] = merge(boxes[best.index], mark.box)
  }
  return tokens
}

// ---------------------------------------------------------------------------
// de-skew and segmentation
// ---------------------------------------------------------------------------

/** A 1-bit crop: the de-skew and the segmenter both work on these. */
export type Bitmap = { width: number; height: number; data: Uint8Array }

export function cropToken(mask: Mask, box: PixelRect): Bitmap {
  const width = boxWidth(box)
  const height = boxHeight(box)
  const data = new Uint8Array(width * height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sx = Math.round(box.x0) + x
      const sy = Math.round(box.y0) + y
      data[y * width + x] = sx >= 0 && sy >= 0 && sx < mask.width && sy < mask.height ? mask.data[sy * mask.width + sx] : 0
    }
  }
  return { width, height, data }
}

/** Shear a bitmap by `slope` columns per row, about its vertical centre. */
export function shear(bmp: Bitmap, slope: number): Bitmap {
  const extra = Math.ceil(Math.abs(slope) * bmp.height) + 1
  const width = bmp.width + extra
  const data = new Uint8Array(width * bmp.height)
  const mid = (bmp.height - 1) / 2
  for (let y = 0; y < bmp.height; y += 1) {
    const shift = Math.round((mid - y) * slope) + (slope > 0 ? 0 : extra)
    for (let x = 0; x < bmp.width; x += 1) {
      if (bmp.data[y * bmp.width + x] !== 1) continue
      const nx = x + shift
      if (nx < 0 || nx >= width) continue
      data[y * width + nx] = 1
    }
  }
  return { width, height: bmp.height, data }
}

export const columnProfile = (bmp: Bitmap): number[] => {
  const out: number[] = new Array(bmp.width).fill(0)
  for (let y = 0; y < bmp.height; y += 1) for (let x = 0; x < bmp.width; x += 1) out[x] += bmp.data[y * bmp.width + x]
  return out
}

/**
 * The shear that stands a token upright.
 *
 * Upright text has deep, narrow valleys between its glyphs; slanted text
 * smears them. So the shear that maximises the variance of the column ink
 * profile is the one that un-slants the token — a standard trick, and the
 * reason it is worth the search is that a slanted token's glyphs TOUCH, and
 * touching glyphs cannot be segmented at all.
 */
export function estimateShear(bmp: Bitmap): { slope: number; sheared: Bitmap } {
  /**
   * How upright a token looks, as two numbers compared in order.
   *
   * The first is the count of EMPTY COLUMNS between the token's first and last
   * ink: the gaps between the glyphs. That is the thing shearing destroys —
   * lean a line of type far enough and every gap is bridged by the glyph
   * beside it — and it is the thing segmentation needs back, so it is what the
   * search maximises.
   *
   * The second, used only to break ties, is the sum of squares of the column
   * profile: with the same total ink, it is largest when that ink is packed
   * into the fewest columns. It settles the case the gap count cannot — text
   * set so tightly that the glyphs touch at every shear, which is exactly the
   * italic a plan's dimensions are set in.
   *
   * What neither of them is, is the VARIANCE of the profile. Shearing widens
   * the bitmap and the new columns are empty, so a mean-based measure rewards
   * the widest shear on offer no matter what the text looks like, and every
   * token comes back leaning twenty degrees.
   */
  const score = (b: Bitmap): { gaps: number; packed: number } => {
    const profile = columnProfile(b)
    let first = -1
    let last = -1
    for (let x = 0; x < profile.length; x += 1) {
      if (profile[x] === 0) continue
      if (first < 0) first = x
      last = x
    }
    let gaps = 0
    for (let x = first + 1; x < last; x += 1) if (profile[x] === 0) gaps += 1
    return { gaps, packed: profile.reduce((a, v) => a + v * v, 0) }
  }

  let best: { slope: number; sheared: Bitmap; gaps: number; packed: number } | undefined
  for (let k = -6; k <= 6; k += 1) {
    const slope = k * 0.06
    const sheared = k === 0 ? bmp : shear(bmp, slope)
    const { gaps, packed } = score(sheared)
    const better = !best || gaps > best.gaps || (gaps === best.gaps && packed > best.packed)
    // Ties go to the smaller shear: upright text should be reported upright.
    const equal = best !== undefined && gaps === best.gaps && packed === best.packed && Math.abs(slope) < Math.abs(best.slope)
    if (better || equal) best = { slope, sheared, gaps, packed }
  }
  return best ? { slope: best.slope, sheared: best.sheared } : { slope: 0, sheared: bmp }
}

/**
 * Cut a token into glyph cells at the valleys of its column profile.
 *
 * The expected glyph width comes from the token's own height, because that is
 * a property of the typeface rather than of the number, and it stops a `0`
 * being cut down its middle where the profile happens to dip.
 */
export function segment(bmp: Bitmap): Array<{ x0: number; x1: number }> {
  const profile = columnProfile(bmp)
  const ink = profile.map((v) => v > 0)
  // Maximal runs of ink, then split any run wide enough to be more than one glyph.
  const runs: Array<{ x0: number; x1: number }> = []
  let start = -1
  for (let x = 0; x < bmp.width; x += 1) {
    if (ink[x] && start < 0) start = x
    if (!ink[x] && start >= 0) {
      runs.push({ x0: start, x1: x - 1 })
      start = -1
    }
  }
  if (start >= 0) runs.push({ x0: start, x1: bmp.width - 1 })

  const expected = Math.max(3, bmp.height * 0.55)
  const out: Array<{ x0: number; x1: number }> = []
  for (const run of runs) {
    const width = run.x1 - run.x0 + 1
    const count = Math.max(1, Math.round(width / expected))
    if (count === 1 || width < expected * 1.45) {
      out.push(run)
      continue
    }
    // Cut at the deepest column inside each expected boundary window rather
    // than at a fixed pitch: real glyph gaps wander.
    const cuts: number[] = []
    for (let k = 1; k < count; k += 1) {
      const centre = run.x0 + (width * k) / count
      const lo = Math.max(run.x0 + 1, Math.round(centre - expected * 0.3))
      const hi = Math.min(run.x1 - 1, Math.round(centre + expected * 0.3))
      let bestX = Math.round(centre)
      let bestV = Infinity
      for (let x = lo; x <= hi; x += 1) {
        if (profile[x] < bestV) {
          bestV = profile[x]
          bestX = x
        }
      }
      cuts.push(bestX)
    }
    let from = run.x0
    for (const cut of cuts) {
      if (cut - from >= 2) out.push({ x0: from, x1: cut - 1 })
      from = cut
    }
    if (run.x1 - from >= 1) out.push({ x0: from, x1: run.x1 })
  }
  return out
}

// ---------------------------------------------------------------------------
// the reader
// ---------------------------------------------------------------------------

export type OcrResult = {
  tokens: TextToken[]
  /** Glyph-sized blobs found, before grouping: the reader's own coverage figure. */
  blobCount: number
}


/**
 * The same ink, read twice, is one number.
 *
 * Turning the page both ways finds every vertical number twice — once the
 * right way up and once upside down, where `750` comes back as `057` and every
 * digit is its own mirror image. Both readings are of the same ink, so only
 * one of them can be what is printed, and the one to keep is the one that
 * matched better: a mirrored five is a poor five, and the score says so.
 *
 * Deciding it here rather than downstream matters, because two readings of one
 * number reaching a dimension chain is worse than either of them alone — the
 * chain sees two numbers where the drawing has one and concludes that nothing
 * explains the span.
 */
function dedupeOrientations(tokens: readonly TextToken[]): TextToken[] {
  const merit = (t: TextToken): number => t.score * t.confidence * t.glyphs.length
  const area = (b: PixelRect): number => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0)
  const covered = (inner: PixelRect, outer: PixelRect): number => {
    const w = Math.min(inner.x1, outer.x1) - Math.max(inner.x0, outer.x0)
    const h = Math.min(inner.y1, outer.y1) - Math.max(inner.y0, outer.y0)
    if (w <= 0 || h <= 0) return 0
    return (w * h) / Math.max(1, area(inner))
  }
  // A SHEET turns its vertical text one way, not both.
  //
  // Deciding each clash on its own merits is not enough: a mirrored `1260`
  // sometimes matches better than the real one, and a page then comes back
  // with most of its vertical dimensions read correctly and one of them
  // reversed — which is far worse than either all right or all wrong, because
  // nothing downstream can tell which is which. Summing the evidence across
  // the whole page and letting the winning turn take every clash is both more
  // accurate and more predictable.
  const totalFor = (orientation: TextOrientation): number => tokens.filter((t) => t.orientation === orientation).reduce((a, t) => a + merit(t), 0)
  const cw = totalFor('ROTATED_CW')
  const ccw = totalFor('ROTATED_CCW')
  const losing: TextOrientation | undefined = cw > ccw * 1.1 ? 'ROTATED_CCW' : ccw > cw * 1.1 ? 'ROTATED_CW' : undefined

  const kept: TextToken[] = []
  for (const token of [...tokens].sort((a, b) => merit(b) - merit(a) || a.box.x0 - b.box.x0 || a.box.y0 - b.box.y0)) {
    if (token.orientation === losing) continue
    // Overlap alone is not enough to spot the duplicates. The wrong-way pass
    // rarely returns one mirrored token covering the same box: it returns a
    // handful of short fragments scattered ACROSS it, each too small for their
    // intersection over union to look like a match while every one of them is
    // made of ink some better token has already explained. So the test is
    // CONTAINMENT — is this token mostly inside something already kept — which
    // catches the fragments and the whole-token mirror alike.
    const clash = kept.some((k) => k.orientation !== token.orientation && (rectIoU(k.box, token.box) > 0.4 || covered(token.box, k.box) > 0.6))
    if (!clash) kept.push(token)
  }
  return kept.sort((a, b) => a.box.y0 - b.box.y0 || a.box.x0 - b.box.x0 || a.orientation.localeCompare(b.orientation))
}

/** Turn a grey field a quarter turn, so text set along a vertical chain can be read the same way as any other. */
function rotateGray(ink: Gray, direction: 'ROTATED_CW' | 'ROTATED_CCW'): Gray {
  const { width, height, data } = ink
  const out = new Uint8ClampedArray(width * height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const v = data[y * width + x]
      // CW: what was at the bottom-left is now at the top-left.
      const rx = direction === 'ROTATED_CW' ? height - 1 - y : y
      const ry = direction === 'ROTATED_CW' ? x : width - 1 - x
      out[ry * height + rx] = v
    }
  }
  return { width: height, height: width, data: out }
}

/** Put a box read in a rotated frame back where it belongs on the page. */
function unrotateRect(r: PixelRect, size: { width: number; height: number }, direction: 'ROTATED_CW' | 'ROTATED_CCW'): PixelRect {
  const corners =
    direction === 'ROTATED_CW'
      ? [
          { x: r.y0, y: size.height - r.x0 },
          { x: r.y1, y: size.height - r.x1 },
        ]
      : [
          { x: size.width - r.y0, y: r.x0 },
          { x: size.width - r.y1, y: r.x1 },
        ]
  return {
    x0: round6(Math.min(corners[0].x, corners[1].x)),
    y0: round6(Math.min(corners[0].y, corners[1].y)),
    x1: round6(Math.max(corners[0].x, corners[1].x)),
    y1: round6(Math.max(corners[0].y, corners[1].y)),
  }
}

/**
 * Read every number-like token in a raster, each way up.
 *
 * The three passes are independent reads of the same bytes and they are kept
 * separate all the way through: a token knows which pass found it, so a
 * vertical chain can look only at the vertically set text and never pick up a
 * horizontal number that happens to lie across it.
 */
export function readNumbers(raster: Raster, options: OcrOptions = {}): OcrResult {
  const ink = inkChannel(raster)
  const orientations = options.orientations ?? (['HORIZONTAL', 'ROTATED_CW', 'ROTATED_CCW'] as const)
  const tokens: TextToken[] = []
  let blobCount = 0
  for (const orientation of orientations) {
    if (orientation === 'HORIZONTAL') {
      const r = readNumbersFromInk(ink, { ...options, orientations: ['HORIZONTAL'] })
      tokens.push(...r.tokens)
      blobCount += r.blobCount
      continue
    }
    const rotated = rotateGray(ink, orientation)
    // A region is stated in page coordinates; rotating the page rotates it too.
    const r = readNumbersFromInk(rotated, { ...options, region: undefined, orientations: ['HORIZONTAL'] })
    blobCount += r.blobCount
    for (const token of r.tokens) {
      const box = unrotateRect(token.box, ink, orientation)
      if (options.region && (box.x0 < options.region.x0 || box.x1 > options.region.x1 || box.y0 < options.region.y0 || box.y1 > options.region.y1)) continue
      tokens.push({
        ...token,
        orientation,
        box,
        glyphs: token.glyphs.map((g) => ({ ...g, box: unrotateRect(g.box, ink, orientation) })),
      })
    }
  }
  tokens.sort((a, b) => a.box.y0 - b.box.y0 || a.box.x0 - b.box.x0 || a.orientation.localeCompare(b.orientation))
  return { tokens: dedupeOrientations(tokens), blobCount }
}

/** The horizontal pass, for a caller that already has an ink field (so a page is converted once). */
export function readNumbersFromInk(ink: Gray, options: OcrOptions = {}): OcrResult {
  const opt = { ...DEFAULTS, ...options }
  const mask = adaptiveInkMask(ink, { delta: opt.inkDelta })
  const larger = Math.max(ink.width, ink.height)
  const maxH = Math.max(opt.minGlyphHeight + 2, opt.maxGlyphHeightFrac * larger)
  const region = options.region

  const components = connectedComponents(mask, { minPixels: 3 })
  const inRegion = (c: { bounds: PixelRect }): boolean => !region || (c.bounds.x0 >= region.x0 && c.bounds.x1 <= region.x1 && c.bounds.y0 >= region.y0 && c.bounds.y1 <= region.y1)
  // Small, dense, roughly square marks: a comma, a full stop, a degree sign.
  const marks: Blob[] = components
    .filter((c) => {
      const h = boxHeight(c.bounds)
      const w = boxWidth(c.bounds)
      if (h >= opt.minGlyphHeight || h < 2) return false
      if (w > h * 2.5 || w < 1) return false
      if (c.fill < 0.35) return false
      return inRegion(c)
    })
    .map((c) => ({ box: c.bounds, pixels: c.pixels }))

  const blobs: Blob[] = components
    .filter((c) => {
      const h = boxHeight(c.bounds)
      const w = boxWidth(c.bounds)
      if (h < opt.minGlyphHeight || h > maxH) return false
      // A glyph is not much wider than it is tall, unless it is a run of
      // touching italic digits — allow up to five of them.
      if (w > h * 4) return false
      if (w < 1) return false
      // Text is dense; a fragment of a drawn line is not.
      if (c.fill < 0.18) return false
      return inRegion(c)
    })
    .map((c) => ({ box: c.bounds, pixels: c.pixels }))

  const tokens: TextToken[] = []
  for (const group of groupTokens(blobs, marks)) {
    const box = group.map((g) => g.box).reduce(merge)
    const height = boxHeight(box)
    const crop = cropToken(mask, box)
    const { slope, sheared } = estimateShear(crop)
    const cells = segment(sheared)
    if (cells.length === 0) continue
    // The token's cap line and cap height: the tallest cell in it. Almost
    // every number contains at least one full-height digit, and measuring the
    // small signs against that is what tells a comma from a nought.
    const extents = cells.map((cell) => {
      let top = sheared.height
      let bottom = -1
      for (let y = 0; y < sheared.height; y += 1) {
        for (let x = cell.x0; x <= cell.x1; x += 1) {
          if (sheared.data[y * sheared.width + x] !== 1) continue
          top = Math.min(top, y)
          bottom = Math.max(bottom, y)
          break
        }
      }
      return { top, bottom, height: bottom - top + 1 }
    })
    const capHeight = Math.max(1, ...extents.map((e) => e.height))
    const capTop = Math.min(...extents.filter((e) => e.height >= capHeight * 0.8).map((e) => e.top))
    const glyphs: GlyphReading[] = []
    for (const cell of cells) {
      // Trim the cell to its own ink box, in BOTH directions, so a glyph is
      // compared on its shape and its proportions rather than on where it
      // happened to sit in the cut. The horizontal trim is what makes the
      // aspect signal mean anything: a cut is a fixed pitch wide, so an
      // untrimmed one is exactly as wide as an untrimmed seven.
      let y0 = sheared.height
      let y1 = -1
      let ix0 = cell.x1 + 1
      let ix1 = cell.x0 - 1
      for (let y = 0; y < sheared.height; y += 1) {
        for (let x = cell.x0; x <= cell.x1; x += 1) {
          if (sheared.data[y * sheared.width + x] !== 1) continue
          y0 = Math.min(y0, y)
          y1 = Math.max(y1, y)
          ix0 = Math.min(ix0, x)
          ix1 = Math.max(ix1, x)
        }
      }
      if (y1 < y0 || ix1 < ix0) continue
      const w = ix1 - ix0 + 1
      const h = y1 - y0 + 1
      if (w < 1 || h < 1) continue
      const source: CellSource = {
        width: w,
        height: h,
        at: (x, y) => sheared.data[(y0 + y) * sheared.width + ix0 + x] === 1,
        relHeight: h / Math.max(1, capHeight),
        relTop: (y0 - capTop) / Math.max(1, capHeight),
      }
      // The cell's box in SOURCE pixels, undoing the shear approximately: the
      // token's own box bounds it, and the cut's fraction places it inside.
      const fx0 = ix0 / Math.max(1, sheared.width)
      const fx1 = (ix1 + 1) / Math.max(1, sheared.width)
      const cellBox: PixelRect = {
        x0: round6(box.x0 + fx0 * boxWidth(box)),
        y0: round6(box.y0 + (y0 / Math.max(1, sheared.height)) * height),
        x1: round6(box.x0 + fx1 * boxWidth(box)),
        y1: round6(box.y0 + ((y1 + 1) / Math.max(1, sheared.height)) * height),
      }
      glyphs.push(classifyCell(source, cellBox))
    }
    if (glyphs.length === 0) continue
    tokens.push({
      text: glyphs.map((g) => g.char).join(''),
      score: round6(Math.min(...glyphs.map((g) => g.score))),
      confidence: round6(Math.min(...glyphs.map((g) => g.confidence))),
      glyphs,
      box,
      shearDeg: round6((Math.atan(slope) * 180) / Math.PI),
      height,
      orientation: 'HORIZONTAL',
    })
  }
  tokens.sort((a, b) => a.box.y0 - b.box.y0 || a.box.x0 - b.box.x0)
  return { tokens, blobCount: blobs.length }
}
