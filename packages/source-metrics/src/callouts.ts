/**
 * Reading opening callouts: the circled `width / height` a plan prints beside
 * every window and door.
 *
 * The symbol is a small circle split by a horizontal diameter, with the
 * opening's width in centimetres above the line and its height below it, so
 * `110` over `230` means a 110 x 230 cm opening. It is the only place a floor
 * plan states the HEIGHT of an opening, which is why it is worth a reader of
 * its own.
 *
 * The general numeric reader cannot read it. On a published sheet the ring,
 * the bar and the six-pixel digits all touch, so the ink arrives as one
 * component the size of a word and is thrown away for being too sparse; and
 * even cut free, digits this small have no counters left for the topology
 * check to count. So this reader does the geometry first and the reading
 * second:
 *
 *  1. **Candidate ink.** Some publishers print the callouts in a saturated
 *     red or orange, which a saturation threshold isolates from every black
 *     line on the sheet. Many print them in the same grey as the walls. Both
 *     masks are searched and the results merged, so a coloured callout is
 *     found on its clean mask and a black one is still found on the ink.
 *  2. **Rings.** Long straight runs (walls, leaders) are stripped and only
 *     ink that borders paper is kept, so a callout tied to a wall by its
 *     leader does not become part of the wall and a poched wall becomes an
 *     outline no annulus fits. Within what remains, every plausible centre
 *     and radius is tested by sampling an annulus: a callout is a ring with
 *     little ink just inside or outside it, a mostly empty interior and a
 *     horizontal bar through its centre.
 *  3. **Halves.** The ring's own ink and the bar are painted out of a grey
 *     crop of the interior, which is split at the bar. Each half is then
 *     stood upright — the digits are set in a steep italic, and a vertical
 *     cut through slanted glyphs hands the matcher a diagonal slab whatever
 *     the digit was — and cut at the fixed pitch a monospaced numeral font
 *     has.
 *  4. **Digits.** Each cell is matched, in GREY, against the reader's own
 *     digit prototypes rendered at the cell's own size. Matching the
 *     anti-aliased intensities rather than a thresholded shape is what makes
 *     a four-pixel-wide glyph readable at all: the sub-pixel information is
 *     in the greys, and a threshold throws it away.
 *
 * Everything is deterministic and nothing here knows what a wall is, which
 * building this is, or what a sensible opening size might be beyond the range
 * the callout convention itself allows.
 */
import { round6, stableId } from '@buildapp/source-common'
import type { PixelRect } from '@buildapp/source-common'
import { adaptiveInkMask, connectedComponents, inkChannel, saturationField } from '@buildapp/source-cv'
import type { Gray, Mask, Raster } from '@buildapp/source-cv'
import { ALTERNATE_BITMAPS, DIGIT_BITMAPS } from './font.js'

export type CalloutReading = {
  /** Stable across runs: a function of the frame and the circle's centre. */
  id: string
  circle: { cx: number; cy: number; radiusPx: number }
  /** The diameter line's row, when one was found. */
  bar: { y: number } | null
  /** The upper number: the opening's width in centimetres. */
  widthCm: number | null
  /** The lower number: the opening's height in centimetres. */
  heightCm: number | null
  /** Raw text of each half, exactly as read. */
  upperText: string
  lowerText: string
  /** The in-range readings each half supports, best first: what a consumer with its own evidence chooses among. */
  widthCandidates: HalfCandidate[]
  heightCandidates: HalfCandidate[]
  /** Min of the two halves' token confidences; 0 when either number is missing. */
  confidence: number
  /** The circle's bounding box, in the raster's pixels. */
  box: PixelRect
  why: string
}

export type CalloutOptions = {
  /** Smallest ring radius to look for, in pixels. */
  minRadiusPx?: number
  /** Largest ring radius to look for, in pixels. */
  maxRadiusPx?: number
  /** Only report callouts whose circle lies inside this rectangle. */
  region?: PixelRect
  /** Also search a saturation mask, for publishers who print the callouts in colour. Default true. */
  useColour?: boolean
  /** The frame the readings are made on; part of every reading's id. */
  frameId?: string
}

/** The range the `width/height` convention allows, in centimetres. Anything outside it is not a callout however well it matched. */
const WIDTH_RANGE = { min: 40, max: 700 } as const
const HEIGHT_RANGE = { min: 40, max: 400 } as const

const DEFAULTS = { minRadiusPx: 9, maxRadiusPx: 60, useColour: true, frameId: '' } as const

/**
 * How the halves are matched. Prototypes at more than one scale, because the
 * digits' x-height varies with the anti-aliasing of a six-pixel glyph; a
 * prior on the pitch, because at this size a wrong cell count can always be
 * paid for with cells that happen to look like digits; and a higher "on"
 * threshold, because the faint fringe under the bar is the bar's, not a
 * digit's. Generic to small italic numerals; nothing here is a building.
 */
const HALF_TUNING: Tuning = { scales: true, pitchPrior: 0.5, on: 0.5 }

/** Saturation above which a pixel is coloured ink rather than grey line work. */
const SATURATION_INK = 60

/** How well a half must match before a ring is believed to carry a number at all. */
const MIN_HALF_SCORE = 0.55

// ---------------------------------------------------------------------------
// masks
// ---------------------------------------------------------------------------

const maskOf = (g: Gray, keep: (v: number) => boolean): Mask => {
  const data = new Uint8Array(g.width * g.height)
  for (let i = 0; i < data.length; i += 1) data[i] = keep(g.data[i]) ? 1 : 0
  return { width: g.width, height: g.height, data }
}

const at = (m: Mask, x: number, y: number): number => (x < 0 || y < 0 || x >= m.width || y >= m.height ? 0 : m.data[y * m.width + x])

/** Darkness of a grey field, 0 paper to 1 solid ink, paper beyond its edges. */
const darkAt = (g: Gray, x: number, y: number): number => (x < 0 || y < 0 || x >= g.width || y >= g.height ? 0 : (255 - g.data[y * g.width + x]) / 255)

/**
 * Remove every horizontal and vertical run of ink longer than `maxLen`.
 *
 * A ring's longest straight run is a short chord; a wall's is the wall. A
 * callout tied to the wall it belongs to by a leader is one component with
 * that wall, and searching the whole wall network for rings is both slow and
 * a source of false rings wherever hatching meets a corner. Stripping the
 * long runs leaves rings, digits and the odd short leader.
 */
function stripLongRuns(m: Mask, maxLen: number): Mask {
  const { width, height } = m
  const out = new Uint8Array(m.data)
  for (let y = 0; y < height; y += 1) {
    let start = -1
    for (let x = 0; x <= width; x += 1) {
      const v = x < width ? m.data[y * width + x] : 0
      if (v === 1 && start < 0) start = x
      if (v === 0 && start >= 0) {
        if (x - start > maxLen) for (let k = start; k < x; k += 1) out[y * width + k] = 0
        start = -1
      }
    }
  }
  for (let x = 0; x < width; x += 1) {
    let start = -1
    for (let y = 0; y <= height; y += 1) {
      const v = y < height ? m.data[y * width + x] : 0
      if (v === 1 && start < 0) start = y
      if (v === 0 && start >= 0) {
        if (y - start > maxLen) for (let k = start; k < y; k += 1) out[k * width + x] = 0
        start = -1
      }
    }
  }
  return { width, height, data: out }
}

/**
 * Keep only the ink that borders paper.
 *
 * A callout's ring is a line one or two pixels wide and every pixel of it
 * survives. A poched wall is a band, and what survives of it is its outline —
 * a rectangle, which the annulus test then fails on its diagonals — instead
 * of a solid through which every annulus of every radius passes.
 */
function thinInk(m: Mask): Mask {
  const { width, height } = m
  const out = new Uint8Array(width * height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (m.data[y * width + x] !== 1) continue
      if (at(m, x - 1, y) === 0 || at(m, x + 1, y) === 0 || at(m, x, y - 1) === 0 || at(m, x, y + 1) === 0) out[y * width + x] = 1
    }
  }
  return { width, height, data: out }
}

// ---------------------------------------------------------------------------
// rings
// ---------------------------------------------------------------------------

type Circle = { cx: number; cy: number; r: number }
type Bar = { y0: number; y1: number }
type Ring = Circle & { annulus: number; interior: number; inside: number; outside: number; bar: Bar | null; score: number }

const ANGLES = 48
const COS = Array.from({ length: ANGLES }, (_, k) => Math.cos((2 * Math.PI * k) / ANGLES))
const SIN = Array.from({ length: ANGLES }, (_, k) => Math.sin((2 * Math.PI * k) / ANGLES))

/** Fraction of `ANGLES` samples on the annulus `radius ± tolerance` that land on ink. */
function annulusHits(m: Mask, cx: number, cy: number, radius: number, tolerance: number, giveUpBelow = 0): number {
  let hits = 0
  const allowedMisses = ANGLES - Math.ceil(giveUpBelow * ANGLES)
  for (let k = 0; k < ANGLES; k += 1) {
    let hit = false
    for (let rho = radius - tolerance; rho <= radius + tolerance && !hit; rho += 1) {
      if (at(m, Math.round(cx + rho * COS[k]), Math.round(cy + rho * SIN[k])) === 1) hit = true
    }
    if (hit) hits += 1
    else if (k + 1 - hits > allowedMisses) return 0
  }
  return hits / ANGLES
}

/** Mean darkness of a grey field round a circle. */
function annulusDarkness(g: Gray, cx: number, cy: number, radius: number): number {
  let sum = 0
  for (let k = 0; k < ANGLES; k += 1) sum += darkAt(g, Math.round(cx + radius * COS[k]), Math.round(cy + radius * SIN[k]))
  return sum / ANGLES
}

/** Fraction of the disk of `radius` that is ink. */
function diskFill(m: Mask, cx: number, cy: number, radius: number): number {
  let ink = 0
  let n = 0
  const r2 = radius * radius
  for (let y = -radius; y <= radius; y += 1) {
    for (let x = -radius; x <= radius; x += 1) {
      if (x * x + y * y > r2) continue
      n += 1
      ink += at(m, cx + x, cy + y)
    }
  }
  return n === 0 ? 0 : ink / n
}

/**
 * Eight points on the circle — the four where it is tangent to its bounding
 * box and the four between them — with a pixel of tolerance each. Six of
 * eight is the cheapest test there is that a drawn ring never fails and a
 * patch of hatching rarely passes, and it keeps the full sampling for the few
 * candidates that deserve it.
 */
const DIAG = Math.SQRT1_2
function cardinalHits(m: Mask, cx: number, cy: number, r: number): boolean {
  const hit = (x: number, y: number, dx: number, dy: number): number => (at(m, x, y) === 1 || at(m, x + dx, y + dy) === 1 || at(m, x - dx, y - dy) === 1 ? 1 : 0)
  const d = Math.round(r * DIAG)
  const hits =
    hit(cx + r, cy, 1, 0) +
    hit(cx - r, cy, 1, 0) +
    hit(cx, cy + r, 0, 1) +
    hit(cx, cy - r, 0, 1) +
    hit(cx + d, cy + d, 1, 1) +
    hit(cx - d, cy - d, 1, 1) +
    hit(cx + d, cy - d, 1, -1) +
    hit(cx - d, cy + d, 1, -1)
  return hits >= 6
}

/**
 * The diameter line: the row nearest the centre whose ink spans most of the
 * chord. Returns the rows it occupies, so a two-pixel bar is painted out whole.
 */
export function findBar(m: Mask, circle: Circle): Bar | null {
  const half = Math.max(2, circle.r - 2)
  const chord = 2 * half + 1
  const reach = Math.max(3, Math.round(circle.r * 0.25))
  const runOf = (y: number): number => {
    let best = 0
    let run = 0
    for (let x = circle.cx - half; x <= circle.cx + half; x += 1) {
      if (at(m, x, y) === 1) run += 1
      else run = 0
      if (run > best) best = run
    }
    return best
  }
  let bestY = -1
  let bestRun = 0
  for (let dy = 0; dy <= reach; dy += 1) {
    for (const y of dy === 0 ? [circle.cy] : [circle.cy - dy, circle.cy + dy]) {
      const run = runOf(y)
      if (run > bestRun) {
        bestRun = run
        bestY = y
      }
    }
  }
  if (bestY < 0 || bestRun < chord * 0.75) return null
  let y0 = bestY
  let y1 = bestY
  while (runOf(y0 - 1) >= chord * 0.75 && bestY - y0 < 2) y0 -= 1
  while (runOf(y1 + 1) >= chord * 0.75 && y1 - bestY < 2) y1 += 1
  return { y0, y1 }
}

const ringScore = (ring: Omit<Ring, 'score'>): number => round6(ring.annulus - 0.5 * Math.max(ring.inside, ring.outside) - Math.max(0, ring.interior - 0.3) + (ring.bar ? 0.25 : 0))

/**
 * Score one candidate circle fully, or return undefined when it is plainly not a ring.
 *
 * A ring is ink on the circle and NOT ink just inside or just outside it:
 * the contrast is what separates a drawn circle from a patch of hatching or
 * the inside of a wall, through which every annulus of every radius passes.
 * The bar is found here too, because a ring with a bar is a far better
 * candidate than one without and the ranking should know it.
 */
function scoreRing(searchable: Mask, original: Mask, cx: number, cy: number, r: number): Ring | undefined {
  const annulus = annulusHits(searchable, cx, cy, r, 1, 0.65)
  if (annulus < 0.65) return undefined
  const inside = annulusHits(searchable, cx, cy, r - 3, 0)
  const outside = annulusHits(searchable, cx, cy, r + 3, 0)
  if (Math.max(inside, outside) > 0.5) return undefined
  if (annulus - Math.max(inside, outside) < 0.3) return undefined
  const interior = diskFill(original, cx, cy, Math.max(2, r - 3))
  if (interior < 0.02 || interior > 0.6) return undefined
  const partial = { cx, cy, r, annulus, interior, inside, outside, bar: findBar(original, { cx, cy, r }) }
  return { ...partial, score: ringScore(partial) }
}

/**
 * Every ring in the mask, best first, with no two sharing a centre.
 *
 * Centres are searched only inside the bounding boxes of components at least
 * a ring's diameter across, which is most of a blank sheet skipped for free.
 * Each candidate passes the tangent-point test before it is sampled round,
 * and the survivors are refined to the neighbouring centre and radius that
 * fit best.
 */
function findRings(searchable: Mask, original: Mask, minR: number, maxR: number): Ring[] {
  const components = connectedComponents(searchable, { minPixels: Math.round(2 * Math.PI * minR * 0.5) })
  const { width, height } = searchable
  // Summed-area table of the searchable ink, so the ink inside any box is
  // four lookups: a ring's box holds about `2 pi r` pixels of ink, and a box
  // holding several times that is hatching, not a ring.
  const sat = new Float64Array((width + 1) * (height + 1))
  for (let y = 0; y < height; y += 1) {
    let row = 0
    for (let x = 0; x < width; x += 1) {
      row += searchable.data[y * width + x]
      sat[(y + 1) * (width + 1) + (x + 1)] = sat[y * (width + 1) + (x + 1)] + row
    }
  }
  const boxInk = (cx: number, cy: number, r: number): number => {
    const x0 = Math.max(0, cx - r)
    const y0 = Math.max(0, cy - r)
    const x1 = Math.min(width - 1, cx + r)
    const y1 = Math.min(height - 1, cy + r)
    return sat[(y1 + 1) * (width + 1) + (x1 + 1)] - sat[y0 * (width + 1) + (x1 + 1)] - sat[(y1 + 1) * (width + 1) + x0] + sat[y0 * (width + 1) + x0]
  }
  const radii = maxR - minR + 1
  const seen = new Set<number>()
  const found: Ring[] = []
  for (const c of components) {
    const w = c.bounds.x1 - c.bounds.x0 + 1
    const h = c.bounds.y1 - c.bounds.y0 + 1
    if (w < 2 * minR - 2 || h < 2 * minR - 2) continue
    const rMax = Math.min(maxR, Math.floor(Math.max(w, h) / 2) + 2)
    // A ring's centre lies about a radius inside its component's box; a
    // little further out allows for the side a wall has swallowed.
    for (let cy = c.bounds.y0 + minR - 2; cy <= c.bounds.y1 - minR + 2; cy += 1) {
      for (let cx = c.bounds.x0 + minR - 2; cx <= c.bounds.x1 - minR + 2; cx += 1) {
        for (let r = minR; r <= rMax; r += 1) {
          const ink = boxInk(cx, cy, r)
          const perimeter = 2 * Math.PI * r
          if (ink < perimeter * 0.5 || ink > perimeter * 3) continue
          if (!cardinalHits(searchable, cx, cy, r)) continue
          const key = (cy * width + cx) * radii + (r - minR)
          if (seen.has(key)) continue
          seen.add(key)
          const ring = scoreRing(searchable, original, cx, cy, r)
          if (ring) found.push(ring)
        }
      }
    }
  }
  // Best first; ties by position so the order is a property of the picture.
  found.sort((a, b) => b.score - a.score || a.cy - b.cy || a.cx - b.cx || a.r - b.r)
  const kept: Ring[] = []
  for (const ring of found) {
    if (kept.some((k) => Math.hypot(k.cx - ring.cx, k.cy - ring.cy) < Math.max(k.r, ring.r))) continue
    let best = ring
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dr = -1; dr <= 1; dr += 1) {
          const r = ring.r + dr
          if (r < minR || r > maxR) continue
          const candidate = scoreRing(searchable, original, ring.cx + dx, ring.cy + dy, r)
          if (candidate && candidate.score > best.score) best = candidate
        }
      }
    }
    kept.push(best)
  }
  return kept
}

/**
 * How far in from the nominal radius the ring's ink reaches, read off the
 * greys: the radius at which the ring's darkness has fallen to a third of
 * its peak. Rings are drawn at different weights and anti-aliased differently,
 * and painting a fixed margin either leaves a fringe of ring to be read as a
 * digit or eats the digits' ends.
 */
export function innerEdge(g: Gray, circle: Circle): number {
  let peak = 0
  let peakAt = circle.r
  for (let rho = circle.r - 2; rho <= circle.r + 1; rho += 1) {
    const d = annulusDarkness(g, circle.cx, circle.cy, rho)
    if (d > peak) {
      peak = d
      peakAt = rho
    }
  }
  for (let rho = peakAt - 1; rho >= peakAt - 5 && rho > 2; rho -= 1) {
    if (annulusDarkness(g, circle.cx, circle.cy, rho) < peak * 0.33) return rho
  }
  return Math.max(2, peakAt - 5)
}

// ---------------------------------------------------------------------------
// the digit matcher
// ---------------------------------------------------------------------------

/** How many samples per source pixel a half is stood upright at: cells are matched at this resolution. */
const UPSAMPLE = 3
/** Slants the halves are tried at, as columns per row, and the residual slants the prototypes absorb after de-skewing. */
const SLANTS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6] as const
const RESIDUAL_SLANTS = [-0.1, 0, 0.1] as const
const OFFSETS = [-1, 0, 1] as const
/** Rows of the grid every cell is matched on; its width follows the cell's own proportions. */
const CELL_ROWS = 24
/** Samples of paper kept round a cell's ink box, so an edge stroke is not an edge of the grid. */
const CELL_MARGIN = 1

export type DigitReadingFn = (cache: RenderCache, cell: Float64Array, w: number, h: number, inkW: number, inkH: number, tuning?: Tuning) => DigitReading
export type DigitPrototype = { char: string; rows: readonly string[]; x0: number; y0: number; bw: number; bh: number }

function buildPrototypes(): DigitPrototype[] {
  const out: DigitPrototype[] = []
  for (const char of Object.keys(DIGIT_BITMAPS).sort()) {
    for (const rows of [DIGIT_BITMAPS[char], ...(ALTERNATE_BITMAPS[char] ?? [])]) {
      const h = rows.length
      const w = rows[0].length
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
      out.push({ char, rows, x0, y0, bw: x1 - x0 + 1, bh: y1 - y0 + 1 })
    }
  }
  return out
}

export const PROTOTYPES: DigitPrototype[] = buildPrototypes()

const protoInk = (p: DigitPrototype, x: number, y: number): number => {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  return ix < 0 || iy < 0 || ix >= p.bw || iy >= p.bh ? 0 : p.rows[p.y0 + iy][p.x0 + ix] === '#' ? 1 : 0
}

/**
 * A prototype rendered at a cell's size: stretched to `w x h`, sheared by
 * `slant`, shifted by a fraction of a pixel, and area-averaged so that its
 * strokes have the soft edges a printed glyph has at this size. Cached by
 * size, because every cell on a sheet is within a pixel of the same size.
 */
export type RenderCache = Map<string, Float64Array>

export function renderPrototype(cache: RenderCache, p: DigitPrototype, index: number, w: number, h: number, slant: number, ox: number, oy: number, scale = 1, align = 0): Float64Array {
  const key = `${index}|${w}|${h}|${slant}|${ox}|${oy}|${scale}|${align}`
  const hit = cache.get(key)
  if (hit) return hit
  const pad = Math.abs(slant) * p.bh
  const pw = p.bw + pad
  const out = new Float64Array(w * h)
  // The glyph fills the cell's ink box, which is the cell less its margin of
  // one sample all round; the margin is where the render is paper.
  const innerW = w - 2 * CELL_MARGIN
  const innerH = h - 2 * CELL_MARGIN
  for (let j = 0; j < h; j += 1) {
    for (let i = 0; i < w; i += 1) {
      // `scale` < 1 draws the glyph shorter than the box, `align` 0 at its top and 1 at its bottom.
      const cy = ((j - CELL_MARGIN + 0.5 + oy) / innerH - align * (1 - scale)) / scale
      const cx = (i - CELL_MARGIN + 0.5 + ox) / innerW
      const py = cy * p.bh
      const px = cx * pw - pad / 2 - (p.bh / 2 - py) * slant
      out[j * w + i] = protoInk(p, px, py)
    }
  }
  // Averaged over one source pixel's footprint, so the render has the soft
  // edges the cell has: the cell is sampled between the pixels of an
  // anti-aliased print, and a crisp render would be penalised for its edges
  // by every digit alike. Separable, and the edges clamp.
  const reach = Math.floor(UPSAMPLE / 2)
  const tmp = new Float64Array(w * h)
  for (let j = 0; j < h; j += 1) {
    for (let i = 0; i < w; i += 1) {
      let sum = 0
      let n = 0
      for (let dx = -reach; dx <= reach; dx += 1) {
        const x = i + dx
        if (x < 0 || x >= w) continue
        sum += out[j * w + x]
        n += 1
      }
      tmp[j * w + i] = sum / n
    }
  }
  const soft = new Float64Array(w * h)
  for (let j = 0; j < h; j += 1) {
    for (let i = 0; i < w; i += 1) {
      let sum = 0
      let n = 0
      for (let dy = -reach; dy <= reach; dy += 1) {
        const y = j + dy
        if (y < 0 || y >= h) continue
        sum += tmp[y * w + i]
        n += 1
      }
      soft[j * w + i] = sum / n
    }
  }
  const ready = normalised(soft)
  cache.set(key, ready)
  return ready
}

/** Zero-mean, unit-norm copy of a field, so that its correlation with another such copy is one dot product. */
export function normalised(a: Float64Array): Float64Array {
  const n = a.length
  let mean = 0
  for (let i = 0; i < n; i += 1) mean += a[i]
  mean /= n
  let norm = 0
  const out = new Float64Array(n)
  for (let i = 0; i < n; i += 1) {
    out[i] = a[i] - mean
    norm += out[i] * out[i]
  }
  if (norm <= 0) return out
  const scale = 1 / Math.sqrt(norm)
  for (let i = 0; i < n; i += 1) out[i] *= scale
  return out
}

/** Correlation of two normalised fields: 1 when they are the same picture up to gain and offset. */
function correlation(a: Float64Array, b: Float64Array): number {
  let sum = 0
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i]
  return sum
}

export type DigitReading = { char: string; score: number; confidence: number; alternatives: Array<{ char: string; score: number }> }

/**
 * Match one cell against every digit.
 *
 * The score is the best correlation over three residual slants and a
 * one-sample shift each way, scaled by how well the cell's proportions fit
 * the digit's: stretched to one box a `1` and a `0` are both a slab, and the
 * proportions are what tell them apart.
 */
const SCALES: ReadonlyArray<[number, number]> = [[1, 0], [0.88, 0], [0.88, 1]]
export function classifyDigit(cache: RenderCache, cell: Float64Array, w: number, h: number, inkW: number, inkH: number, tuning: Tuning = {}): DigitReading {
  const aspect = inkW / Math.max(1, inkH)
  const byChar = new Map<string, number>()
  const ready = normalised(cell)
  const scales = tuning.scales ? SCALES : SCALES.slice(0, 1)
  PROTOTYPES.forEach((p, index) => {
    let best = -1
    for (const slant of RESIDUAL_SLANTS) {
      for (const oy of OFFSETS) {
        for (const ox of OFFSETS) {
          for (const [scale, align] of scales) best = Math.max(best, correlation(ready, renderPrototype(cache, p, index, w, h, slant, ox, oy, scale, align)))
        }
      }
    }
    const ratio = Math.log(Math.max(0.05, aspect) / Math.max(0.05, p.bw / p.bh))
    const score = Math.max(0, best) * Math.max(0.2, 1 - Math.abs(ratio) * 0.6)
    byChar.set(p.char, Math.max(byChar.get(p.char) ?? 0, score))
  })
  const scored = [...byChar].map(([char, score]) => ({ char, score: round6(score) })).sort((a, b) => b.score - a.score || a.char.localeCompare(b.char))
  const best = scored[0]
  const runnerUp = scored[1]?.score ?? 0
  const confidence = best.score + runnerUp <= 0 ? 0 : round6(best.score / (best.score + runnerUp))
  return { char: best.char, score: best.score, confidence, alternatives: scored.slice(1, 3) }
}

// ---------------------------------------------------------------------------
// reading a half
// ---------------------------------------------------------------------------

export type HalfCandidate = { text: string; value: number; score: number }

type HalfReading = {
  text: string
  value: number | null
  confidence: number
  /** Mean cell match, 0..1: how much the ink looked like digits at all. */
  score: number
  /** Glyph height and horizontal centre, in the source's pixels, for judging whether two halves are set in one font. */
  height: number
  centreX: number
  /**
   * The other in-range readings the ink supports, best first, the winner
   * included. Six-pixel digits are read at the edge of what a matcher can
   * tell apart, so the reading is a short list rather than one number, and
   * whoever holds independent evidence — a plan gap of a known width, an
   * elevation the opening is drawn on — picks from the list rather than
   * inheriting the matcher's coin toss.
   */
  candidates: HalfCandidate[]
}

const EMPTY_HALF: HalfReading = { text: '', value: null, confidence: 0, score: 0, height: 0, centreX: 0, candidates: [] }

/** Bilinear darkness at a continuous position in a grey crop, pixel centres at half-integers. */
function darknessAt(g: Gray, x: number, y: number): number {
  const fx = x - 0.5
  const fy = y - 0.5
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const tx = fx - x0
  const ty = fy - y0
  const a = darkAt(g, x0, y0)
  const b = darkAt(g, x0 + 1, y0)
  const c = darkAt(g, x0, y0 + 1)
  const d = darkAt(g, x0 + 1, y0 + 1)
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty
}

/**
 * Stand a half upright, supersampled.
 *
 * Each candidate slant is sheared onto its own field at `UPSAMPLE` samples
 * per source pixel, and the one kept is the one with the most empty columns
 * between its first and last ink — the gaps between the glyphs, which a
 * slant smears and segmentation needs back. Every slant is sampled the same
 * way, so none is favoured for being sampled on the pixel grid.
 */
export function upright(g: Gray): { field: Float64Array; width: number; height: number; slant: number } {
  const mid = g.height / 2
  const height = g.height * UPSAMPLE
  let best: { field: Float64Array; width: number; slant: number; gaps: number } | undefined
  for (const slant of SLANTS) {
    const extra = Math.ceil(slant * g.height)
    const width = (g.width + extra) * UPSAMPLE
    const field = new Float64Array(width * height)
    const profile = new Float64Array(width)
    for (let Y = 0; Y < height; Y += 1) {
      const y = (Y + 0.5) / UPSAMPLE
      for (let X = 0; X < width; X += 1) {
        // An italic leans right: its top is to the right of its bottom. So the
        // upper rows sample the source to their right and the lower rows to
        // their left, and the canvas is widened by the lean to keep both.
        const x = (X + 0.5) / UPSAMPLE + (mid - y) * slant - extra / 2
        const d = darknessAt(g, x, y)
        field[Y * width + X] = d
        profile[X] += d
      }
    }
    // Gap columns alone decide, and a tie goes to the smaller slant. The
    // main reader breaks ties on how tightly the profile packs; at this size
    // that would prefer whatever slant stands a 4's diagonal upright, which
    // is not the slant the text is set at.
    const peak = Math.max(0, ...profile)
    let first = -1
    let last = -1
    for (let x = 0; x < width; x += 1) {
      if (profile[x] <= peak * 0.1) continue
      if (first < 0) first = x
      last = x
    }
    let gaps = 0
    for (let x = first + 1; x < last; x += 1) if (profile[x] <= peak * 0.1) gaps += 1
    if (!best || gaps > best.gaps) best = { field, width, slant, gaps }
  }
  return best ? { field: best.field, width: best.width, height, slant: best.slant } : { field: new Float64Array(0), width: 0, height, slant: 0 }
}

/** A `1` is narrower than every other numeral, in this font and in every drawing font: this much narrower. */
const NARROW = 0.7

/**
 * Read the digits in one half of a callout.
 *
 * `g` is a grey crop with everything but the digits painted white. The half
 * is stood upright and its glyph band found; then, because the font is
 * monospaced except for its `1`, every way of laying two or three cells
 * across the band — each cell full width or narrow — is tried, and the
 * layout whose cells match digits best is the reading. Cutting on the
 * lightest columns instead does not work at this size: a 1-pixel gap
 * between anti-aliased glyphs is no lighter than the counter of a `0`.
 */
export type Tuning = { on?: number; scales?: boolean; pitchPrior?: number }
export function readHalf(cache: RenderCache, g: Gray, range: { min: number; max: number }, trace?: (msg: string) => void, classify: DigitReadingFn = classifyDigit, tuning: Tuning = {}): HalfReading {
  const up = upright(g)
  const { field, width, height } = up
  if (width === 0) return EMPTY_HALF
  let peak = 0
  for (let i = 0; i < field.length; i += 1) if (field[i] > peak) peak = field[i]
  if (peak <= 0) return EMPTY_HALF
  // A row or column is ink when something in it is a real stroke, not when
  // its total is large: a diagonal crosses a column in one sample and is
  // still that column's ink.
  const on = peak * (tuning.on ?? 0.35)
  const rowMax = new Float64Array(height)
  const colMax = new Float64Array(width)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const v = field[y * width + x]
      if (v > rowMax[y]) rowMax[y] = v
      if (v > colMax[x]) colMax[x] = v
    }
  }
  let top = 0
  while (top < height && rowMax[top] <= on) top += 1
  let bottom = height - 1
  while (bottom > top && rowMax[bottom] <= on) bottom -= 1
  const bandH = bottom - top + 1
  if (bandH < 3 * UPSAMPLE) return EMPTY_HALF
  let left = 0
  while (left < width && colMax[left] <= on) left += 1
  let right = width - 1
  while (right > left && colMax[right] <= on) right -= 1
  const bandW = right - left + 1
  if (bandW < 3 * UPSAMPLE) return EMPTY_HALF
  const colProfile = new Float64Array(width)
  for (let y = top; y <= bottom; y += 1) for (let x = 0; x < width; x += 1) colProfile[x] += field[y * width + x]

  // Trim one cell to its own ink, resample it onto the matcher's grid, and
  // match it. Layouts share most of their cells, so each is read once.
  const cellCache = new Map<number, DigitReading | undefined>()
  const readCell = (x0: number, x1: number): DigitReading | undefined => {
    const key = x0 * width + x1
    if (cellCache.has(key)) return cellCache.get(key)
    const reading = readCellUncached(x0, x1)
    cellCache.set(key, reading)
    return reading
  }
  const readCellUncached = (x0: number, x1: number): DigitReading | undefined => {
    let a = x0
    let b = x1
    const cellColOn = (x: number): boolean => {
      for (let y = top; y <= bottom; y += 1) if (field[y * width + x] > on) return true
      return false
    }
    while (a < b && !cellColOn(a)) a += 1
    while (b > a && !cellColOn(b)) b -= 1
    const cellRowOn = (y: number): boolean => {
      for (let x = a; x <= b; x += 1) if (field[y * width + x] > on) return true
      return false
    }
    let t = top
    while (t < bottom && !cellRowOn(t)) t += 1
    let u = bottom
    while (u > t && !cellRowOn(u)) u -= 1
    const inkW = b - a + 1
    const inkH = u - t + 1
    if (inkW < 2 || inkH < 2 || !cellColOn(a)) return undefined
    // Resampled onto a grid of fixed height, with a sample of margin all
    // round, so that every cell on a sheet is one of a few sizes and the
    // prototypes are rendered once per size rather than once per cell.
    const h = CELL_ROWS
    const w = Math.max(3, Math.round((CELL_ROWS - 2 * CELL_MARGIN) * (inkW / inkH))) + 2 * CELL_MARGIN
    const cell = new Float64Array(w * h)
    const sample = (X: number, Y: number): number => {
      const fx = X - 0.5
      const fy = Y - 0.5
      const x0f = Math.floor(fx)
      const y0f = Math.floor(fy)
      const tx = fx - x0f
      const ty = fy - y0f
      const f = (x: number, y: number): number => (x < 0 || y < 0 || x >= width || y >= height ? 0 : field[y * width + x])
      return (f(x0f, y0f) * (1 - tx) + f(x0f + 1, y0f) * tx) * (1 - ty) + (f(x0f, y0f + 1) * (1 - tx) + f(x0f + 1, y0f + 1) * tx) * ty
    }
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const sx = a + ((x - CELL_MARGIN + 0.5) / (w - 2 * CELL_MARGIN)) * inkW
        const sy = t + ((y - CELL_MARGIN + 0.5) / (h - 2 * CELL_MARGIN)) * inkH
        cell[y * w + x] = sample(sx, sy)
      }
    }
    const reading = classify(cache, cell, w, h, inkW, inkH, tuning)
    if (trace) trace(`cell x=[${x0},${x1}] ink a=${a} b=${b} t=${t} u=${u} inkW=${inkW} inkH=${inkH} grid ${w}x${h} → ${reading.char} ${reading.score} ${JSON.stringify(reading.alternatives)}`)
    return reading
  }

  type Candidate = { text: string; cells: DigitReading[]; score: number; narrow: number }
  const candidates: Candidate[] = []
  for (const count of [2, 3]) {
    for (let pattern = 0; pattern < 1 << count; pattern += 1) {
      const widths = Array.from({ length: count }, (_, k) => ((pattern >> k) & 1 ? NARROW : 1))
      const unit = bandW / widths.reduce((sum, v) => sum + v, 0)
      // A numeral is narrower than it is tall and wider than a third of that.
      if (unit < bandH * 0.3 || unit > bandH * 1.05) continue
      const cuts: number[] = []
      let edge = left
      for (let k = 1; k < count; k += 1) {
        edge += widths[k - 1] * unit
        // The nominal cut, moved to the lightest column within a sample of it.
        let bestX = Math.round(edge)
        for (let x = Math.round(edge) - 1; x <= Math.round(edge) + 1; x += 1) {
          if (x <= left || x > right) continue
          if (colProfile[x] < colProfile[bestX]) bestX = x
        }
        cuts.push(bestX)
      }
      const bounds = [left, ...cuts, right + 1]
      if (trace) trace(`count ${count} pattern ${widths.join('/')}: band left=${left} right=${right} top=${top} bottom=${bottom} unit=${round6(unit)} cuts=${cuts.join(',')}`)
      const cells: DigitReading[] = []
      for (let k = 0; k < count; k += 1) {
        const cell = readCell(bounds[k], bounds[k + 1] - 1)
        if (!cell) break
        cells.push(cell)
      }
      if (cells.length !== count) continue
      const narrow = widths.filter((v) => v !== 1).length
      // A numeral is about two thirds as wide as it is tall; a layout that
      // needs cells much narrower or wider than that is paying for a wrong
      // count with cells that happen to look like digits.
      const pitchPenalty = (tuning.pitchPrior ?? 0) * Math.abs(unit / bandH - 0.65)
      candidates.push({ text: cells.map((c) => c.char).join(''), cells, score: round6(cells.reduce((sum, c) => sum + c.score, 0) / count - pitchPenalty), narrow })
    }
  }
  // Best match first; a layout with fewer narrow cells wins a tie, because
  // every layout can be made to fit by calling enough of its cells a 1.
  candidates.sort((a, b) => b.score - a.score || a.narrow - b.narrow || a.text.localeCompare(b.text))
  const best = candidates[0]
  if (!best) return EMPTY_HALF
  const inRange = (v: number): boolean => v >= range.min && v <= range.max
  // Every layout's text, and every single-cell runner-up of the two best
  // layouts, scored as the mean of its cells; distinct in-range values only.
  const pool = new Map<string, number>()
  const offer = (text: string, score: number): void => {
    const v = Number(text)
    if (!/^\d+$/.test(text) || !inRange(v)) return
    const key = String(v)
    pool.set(key, Math.max(pool.get(key) ?? 0, round6(score)))
  }
  for (const c of candidates) offer(c.text, c.score)
  for (const layout of candidates.slice(0, 2)) {
    layout.cells.forEach((cell, i) => {
      for (const alt of cell.alternatives) {
        const text = layout.cells.map((c, j) => (j === i ? alt.char : c.char)).join('')
        offer(text, (layout.score * layout.cells.length - cell.score + alt.score) / layout.cells.length)
      }
    })
  }
  const shortlist: HalfCandidate[] = [...pool].map(([key, score]) => ({ text: key, value: Number(key), score })).sort((a, b) => b.score - a.score || a.value - b.value).slice(0, 6)
  const geometry = { height: round6(bandH / UPSAMPLE), centreX: round6((left + right + 1) / 2 / UPSAMPLE - (up.width / UPSAMPLE - g.width) / 2), candidates: shortlist }
  const value = Number(best.text)
  const confidence = round6(Math.min(...best.cells.map((c) => c.confidence)))
  if (inRange(value)) return { text: best.text, value, confidence, score: best.score, ...geometry }
  // Out of range as read: the best single-character runner-up that is in
  // range is offered instead, at that character's own confidence.
  let fallback: HalfReading | undefined
  best.cells.forEach((cell, i) => {
    for (const alt of cell.alternatives) {
      const text = best.cells.map((c, j) => (j === i ? alt.char : c.char)).join('')
      const v = Number(text)
      if (!inRange(v)) continue
      const conf = round6(Math.min(cell.score <= 0 ? 0 : alt.score / (alt.score + cell.score), ...best.cells.filter((_, j) => j !== i).map((c) => c.confidence)))
      if (!fallback || conf > fallback.confidence) fallback = { text, value: v, confidence: conf, score: best.score, ...geometry }
    }
  })
  return fallback ?? { text: best.text, value: null, confidence: 0, score: best.score, ...geometry }
}

// ---------------------------------------------------------------------------
// the reader
// ---------------------------------------------------------------------------

type Source = { mask: Mask; grey: Gray; label: string }

/**
 * Whether two halves read as one callout: both matched like digits, in one
 * font, centred on the circle. This is what keeps a circle of furniture with
 * a line through it from becoming an opening with a plausible size.
 */
function coherent(upper: HalfReading, lower: HalfReading, circle: Circle): boolean {
  if (upper.value === null || lower.value === null) return false
  if (upper.score < MIN_HALF_SCORE || lower.score < MIN_HALF_SCORE) return false
  const tallest = Math.max(upper.height, lower.height)
  if (Math.abs(upper.height - lower.height) > Math.max(2, tallest * 0.35)) return false
  if (tallest < circle.r * 0.2 || tallest > circle.r * 0.9) return false
  const reach = Math.max(2, circle.r * 0.3)
  return Math.abs(upper.centreX - circle.r) <= reach && Math.abs(lower.centreX - circle.r) <= reach
}

/**
 * Read every opening callout on a raster.
 *
 * Results are sorted by row then column, and a circle found on both the
 * colour mask and the ink mask is reported once, from whichever mask fitted
 * it better.
 */
export function readOpeningCallouts(raster: Raster, options: CalloutOptions = {}): CalloutReading[] {
  const opt = { ...DEFAULTS, ...options }
  const minR = Math.max(3, Math.round(opt.minRadiusPx))
  const maxR = Math.max(minR, Math.round(opt.maxRadiusPx))
  const ink = inkChannel(raster)
  const inkMask = adaptiveInkMask(ink, {})

  const sources: Source[] = []
  if (opt.useColour) {
    const saturation = saturationField(raster)
    const colourMask = maskOf(saturation, (v) => v > SATURATION_INK)
    const coloured = connectedComponents(colourMask, { minPixels: 4 })
    if (coloured.length >= 3) {
      // Grey for reading: the ink where the ink is coloured, paper elsewhere,
      // so a black line crossing a red callout is not read as a stroke.
      const grey: Gray = { width: ink.width, height: ink.height, data: new Uint8ClampedArray(ink.width * ink.height) }
      for (let i = 0; i < grey.data.length; i += 1) grey.data[i] = colourMask.data[i] === 1 ? ink.data[i] : 255
      sources.push({ mask: colourMask, grey, label: 'coloured ink' })
    }
  }
  sources.push({ mask: inkMask, grey: ink, label: 'ink' })

  type Found = { ring: Ring; source: Source }
  const found: Found[] = []
  for (const source of sources) {
    const searchable = thinInk(stripLongRuns(source.mask, 3 * maxR))
    for (const ring of findRings(searchable, source.mask, minR, maxR)) {
      if (opt.region) {
        const { region } = opt
        if (ring.cx - ring.r < region.x0 || ring.cx + ring.r > region.x1 || ring.cy - ring.r < region.y0 || ring.cy + ring.r > region.y1) continue
      }
      found.push({ ring, source })
    }
  }
  found.sort((a, b) => b.ring.score - a.ring.score || a.ring.cy - b.ring.cy || a.ring.cx - b.ring.cx)
  const kept: Found[] = []
  for (const f of found) {
    if (kept.some((k) => Math.hypot(k.ring.cx - f.ring.cx, k.ring.cy - f.ring.cy) < Math.max(k.ring.r, f.ring.r))) continue
    kept.push(f)
  }

  const cache: RenderCache = new Map()
  const readings: CalloutReading[] = []
  for (const { ring, source } of kept) {
    const { bar } = ring
    const inner = innerEdge(source.grey, ring)
    const box: PixelRect = { x0: ring.cx - ring.r, y0: ring.cy - ring.r, x1: ring.cx + ring.r, y1: ring.cy + ring.r }
    // The interior, as grey, with the ring and the bar painted out.
    const size = 2 * ring.r + 1
    const crop: Gray = { width: size, height: size, data: new Uint8ClampedArray(size * size).fill(255) }
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const px = box.x0 + x
        const py = box.y0 + y
        if (px < 0 || py < 0 || px >= source.grey.width || py >= source.grey.height) continue
        if (Math.hypot(x - ring.r, y - ring.r) > inner - 0.5) continue
        if (bar && py >= bar.y0 && py <= bar.y1) continue
        crop.data[y * size + x] = source.grey.data[py * source.grey.width + px]
      }
    }
    const splitTop = bar ? bar.y0 - box.y0 : ring.r
    const splitBottom = bar ? bar.y1 - box.y0 : ring.r
    const half = (y0: number, y1: number): Gray => {
      const h = Math.max(0, y1 - y0 + 1)
      const data = new Uint8ClampedArray(size * h)
      for (let y = 0; y < h; y += 1) for (let x = 0; x < size; x += 1) data[y * size + x] = crop.data[(y0 + y) * size + x]
      return { width: size, height: h, data }
    }
    const upper = splitTop > 0 ? readHalf(cache, half(0, splitTop - 1), WIDTH_RANGE, undefined, classifyDigit, HALF_TUNING) : EMPTY_HALF
    const lower = splitBottom < size - 1 ? readHalf(cache, half(splitBottom + 1, size - 1), HEIGHT_RANGE, undefined, classifyDigit, HALF_TUNING) : EMPTY_HALF
    const complete = coherent(upper, lower, ring)
    // A ring with no bar is a circle, not this symbol — unless it reads as
    // one anyway, in which case the bar was lost to the rendering, not absent.
    if (!bar && !complete) continue
    const confidence = complete ? round6(Math.min(upper.confidence, lower.confidence) * (bar ? 1 : 0.5)) : 0
    readings.push({
      id: stableId('callout', opt.frameId, { cx: ring.cx, cy: ring.cy }),
      circle: { cx: ring.cx, cy: ring.cy, radiusPx: ring.r },
      bar: bar ? { y: round6((bar.y0 + bar.y1) / 2) } : null,
      widthCm: complete ? upper.value : null,
      heightCm: complete ? lower.value : null,
      upperText: upper.text,
      lowerText: lower.text,
      widthCandidates: upper.candidates,
      heightCandidates: lower.candidates,
      confidence,
      box,
      why: `a ${2 * ring.r} px ring on the ${source.label} (${round6(ring.annulus * 100)} per cent of its circumference inked, interior ${round6(ring.interior * 100)} per cent), ${bar ? `split by a bar at row ${round6((bar.y0 + bar.y1) / 2)}` : 'with no bar found, split at its centre'}; read "${upper.text || '?'}" (match ${upper.score}, ${upper.height} px tall) over "${lower.text || '?'}" (match ${lower.score}, ${lower.height} px tall)${complete ? '' : ': not a coherent pair of numbers'}`,
    })
  }
  return readings.sort((a, b) => a.circle.cy - b.circle.cy || a.circle.cx - b.circle.cx)
}
