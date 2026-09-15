/**
 * Binary ink masks and the shapes you can count on them.
 *
 * Everything above this file reasons about SETS OF PIXELS, not intensities.
 * Collapsing a field to 0/1 early is deliberate: a drawing is line art, so the
 * interesting structure is topological (what is connected to what, how long a
 * run is, how much of a boundary is backed) and intensity beyond the
 * threshold decision only adds ways for two runs on the same bytes to
 * disagree. `Uint8Array` rather than a bitset because the inner loops are
 * random-access and a byte read beats a shift-and-mask on every engine that
 * matters; the memory cost of one byte per pixel is bounded by the caller
 * downscaling first (`downscaleGray`).
 *
 * Determinism rules observed here:
 *   - `connectedComponents` never returns labels in discovery order; it sorts
 *     and only then assigns ids, so a component's id depends on the picture
 *     and not on which corner the scan happened to start from.
 *   - no `Set`/`Map` iteration reaches a result; where a set is used it is for
 *     membership only and the output is rebuilt from an ordered source.
 *   - rectangles are INCLUSIVE pixel rectangles (see `raster.ts`), so a
 *     component's bounding area is `(x1-x0+1)*(y1-y0+1)`.
 */
import { round6 } from '@buildapp/source-common'
import type { PixelPoint, PixelRect } from '@buildapp/source-common'
import type { Gray } from './raster.js'
import { percentile } from './raster.js'

/** A binary field over a pixel grid: `data[y*width + x]` is 0 or 1, nothing else. */
export type Mask = { width: number; height: number; data: Uint8Array }

/** Read a mask with out-of-bounds treated as empty. Off the paper there is no ink. */
export const maskAt = (m: Mask, x: number, y: number): number => (x < 0 || y < 0 || x >= m.width || y >= m.height ? 0 : m.data[y * m.width + x])

/**
 * `1` where the field is at most `t`. The comparison is `<=` and not `>=`
 * because in every convention this package uses, INK IS DARK: paper is 255,
 * a drawn line is near 0. A caller holding a field where high means "more
 * evidence" (a saturation field, an edge magnitude) must invert it first
 * rather than hoping this function guesses.
 */
export function threshold(g: Gray, t: number): Mask {
  const n = g.width * g.height
  const out = new Uint8Array(n)
  for (let i = 0; i < n; i++) out[i] = g.data[i] <= t ? 1 : 0
  return { width: g.width, height: g.height, data: out }
}

/**
 * Ink from a field, with a threshold chosen from the picture rather than from
 * a constant.
 *
 * The default is the 8th percentile, clamped into [90, 170]. Each part earns
 * its place:
 *   - PERCENTILE, not Otsu: a drawing sheet is not bimodal in any useful
 *     sense. It is ~95% paper, and Otsu's between-class variance on such a
 *     histogram drifts with how much white margin the crop happens to include,
 *     which makes the threshold depend on framing rather than on ink. The
 *     ink fraction of architectural line work is remarkably stable, so
 *     "the darkest few percent" is the more honest model.
 *   - 0.08 rather than 0.02: at 2% a sheet dense with hatching loses its
 *     lighter linework; at 8% we accept some antialiased halo, which the
 *     thinness and closure tests downstream reject on shape instead of tone.
 *   - LOWER CLAMP 90: on a nearly blank sheet the 8th percentile is paper
 *     noise (say 246), and thresholding there turns JPEG ringing into
 *     thousands of components. Below 90 nothing that reads as paper survives.
 *   - UPPER CLAMP 170: on a dark or heavily screened scan the 8th percentile
 *     can land at 200+, at which point the whole sheet is "ink". 170 is the
 *     point past which a tone is more plausibly a grey wash than a drawn line.
 * Callers with a calibrated source should pass `threshold` explicitly; the
 * default exists so that an uncalibrated one still produces something usable.
 */
export function inkMask(g: Gray, opts: { threshold?: number } = {}): Mask {
  const auto = Math.min(170, Math.max(90, percentile(g, 0.08)))
  return threshold(g, opts.threshold ?? auto)
}

/**
 * Separable morphology over a square (Chebyshev) structuring element.
 * Separable because a square element is the product of a horizontal and a
 * vertical one, which turns O(r^2) per pixel into O(r), and because the square
 * (rather than a disc) keeps axis-aligned line work axis-aligned — a disc
 * rounds the corners of exactly the rectangles we are about to look for.
 * Outside the mask counts as 0 for both operators, so dilation cannot invent
 * a border and erosion eats one; that is the conservative direction for both.
 */
function morph(m: Mask, r: number, union: boolean): Mask {
  const rad = Math.max(0, Math.floor(r))
  if (rad === 0) return { width: m.width, height: m.height, data: m.data.slice() }
  const { width: w, height: h } = m
  const tmp = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    const base = y * w
    for (let x = 0; x < w; x++) {
      let v = union ? 0 : 1
      for (let k = -rad; k <= rad; k++) {
        const xx = x + k
        const s = xx < 0 || xx >= w ? 0 : m.data[base + xx]
        if (union) {
          if (s === 1) {
            v = 1
            break
          }
        } else if (s === 0) {
          v = 0
          break
        }
      }
      tmp[base + x] = v
    }
  }
  const out = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = union ? 0 : 1
      for (let k = -rad; k <= rad; k++) {
        const yy = y + k
        const s = yy < 0 || yy >= h ? 0 : tmp[yy * w + x]
        if (union) {
          if (s === 1) {
            v = 1
            break
          }
        } else if (s === 0) {
          v = 0
          break
        }
      }
      out[y * w + x] = v
    }
  }
  return { width: w, height: h, data: out }
}

/** Grow ink by `r` pixels in the Chebyshev metric. Used to close the hairline gaps a JPEG leaves in a thin line. */
export const dilate = (m: Mask, r = 1): Mask => morph(m, r, true)

/** Shrink ink by `r` pixels. Paired with `dilate` it opens (removes speckle) or closes (bridges dashes) without moving an edge. */
export const erode = (m: Mask, r = 1): Mask => morph(m, r, false)

/**
 * One connected blob of ink.
 *
 * `fill` is pixels divided by the area of the INCLUSIVE bounding box, and it
 * is the cheapest discriminator this package has between the two things a
 * caller most needs to tell apart: a drawn LINE (long, thin, fill near
 * `1/thickness` of its bounding box for a diagonal, or near 1 only because
 * the box is degenerate) and a filled BAND or hatched region (fill well above
 * a half). Combined with the bounding box's aspect ratio it separates "a
 * drafting line someone used to say where a dimension goes" from "a wall
 * someone drew because it is made of bricks".
 */
export type Component = { id: number; pixels: number; bounds: PixelRect; centroid: PixelPoint; fill: number }

type RawComponent = { pixels: number; bounds: PixelRect; centroid: PixelPoint; fill: number }

/**
 * Label connected ink, then sort, then number.
 *
 * Ids are assigned AFTER sorting — pixels descending, then bounds x0, then
 * bounds y0 — so that `components[0]` means "the biggest thing on the sheet"
 * on every run and in every engine, and never "whatever the raster scan
 * reached first". Two blobs of exactly the same size are ordered by where
 * they are, which is a property of the drawing; discovery order is a property
 * of the loop, and a property of the loop must never reach a caller.
 *
 * The flood fill is iterative over an explicit index stack: a recursive fill
 * on a 4000-pixel-wide scan overflows the JavaScript stack long before it
 * runs out of memory.
 */
export function connectedComponents(m: Mask, opts: { minPixels?: number; connectivity?: 4 | 8 } = {}): Component[] {
  const minPixels = Math.max(1, Math.floor(opts.minPixels ?? 1))
  const connectivity = opts.connectivity ?? 8
  const { width: w, height: h, data } = m
  const n = w * h
  const seen = new Uint8Array(n)
  const stack = new Int32Array(n)
  // 4-connectivity treats a diagonal touch as a separate blob, which is what
  // you want for hatching; 8 keeps an antialiased diagonal line in one piece,
  // which is what you want for line work, so it is the default.
  const dxs = connectivity === 8 ? [1, -1, 0, 0, 1, 1, -1, -1] : [1, -1, 0, 0]
  const dys = connectivity === 8 ? [0, 0, 1, -1, 1, -1, 1, -1] : [0, 0, 1, -1]
  const raw: RawComponent[] = []

  for (let start = 0; start < n; start++) {
    if (data[start] !== 1 || seen[start] === 1) continue
    let top = 0
    stack[top++] = start
    seen[start] = 1
    let pixels = 0
    let x0 = w
    let y0 = h
    let x1 = -1
    let y1 = -1
    let sumX = 0
    let sumY = 0
    while (top > 0) {
      const idx = stack[--top]
      const x = idx % w
      const y = (idx - x) / w
      pixels++
      sumX += x
      sumY += y
      if (x < x0) x0 = x
      if (y < y0) y0 = y
      if (x > x1) x1 = x
      if (y > y1) y1 = y
      for (let k = 0; k < dxs.length; k++) {
        const nx = x + dxs[k]
        const ny = y + dys[k]
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const ni = ny * w + nx
        if (data[ni] !== 1 || seen[ni] === 1) continue
        seen[ni] = 1
        stack[top++] = ni
      }
    }
    if (pixels < minPixels) continue
    const boxArea = (x1 - x0 + 1) * (y1 - y0 + 1)
    raw.push({
      pixels,
      bounds: { x0, y0, x1, y1 },
      centroid: { x: round6(sumX / pixels), y: round6(sumY / pixels) },
      fill: round6(pixels / boxArea),
    })
  }

  raw.sort((a, b) => b.pixels - a.pixels || a.bounds.x0 - b.bounds.x0 || a.bounds.y0 - b.bounds.y0 || a.bounds.x1 - b.bounds.x1 || a.bounds.y1 - b.bounds.y1)
  return raw.map((c, i) => ({ id: i, pixels: c.pixels, bounds: c.bounds, centroid: c.centroid, fill: c.fill }))
}

/** The inclusive bounding box of all set pixels, or null when nothing is set. */
export function maskBounds(m: Mask): PixelRect | null {
  let x0 = m.width
  let y0 = m.height
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < m.height; y++) {
    const base = y * m.width
    for (let x = 0; x < m.width; x++) {
      if (m.data[base + x] !== 1) continue
      if (x < x0) x0 = x
      if (y < y0) y0 = y
      if (x > x1) x1 = x
      if (y > y1) y1 = y
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 }
}

/**
 * Intersection over union of two masks, pixel by pixel.
 *
 * Masks of different sizes are compared on the union grid with the missing
 * region treated as empty, rather than rejected: the common caller is "the
 * same drawing at two crops or two scales" and silently scoring 0 would look
 * like a real disagreement. Two empty masks score 0, not 1 — there is no
 * evidence of agreement in two absences.
 */
export function maskIoU(a: Mask, b: Mask): number {
  const w = Math.max(a.width, b.width)
  const h = Math.max(a.height, b.height)
  let inter = 0
  let union = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const av = maskAt(a, x, y)
      const bv = maskAt(b, x, y)
      if (av === 1 && bv === 1) inter++
      if (av === 1 || bv === 1) union++
    }
  }
  return union === 0 ? 0 : round6(inter / union)
}

/**
 * Fraction of set pixels in each row / each column.
 *
 * These two vectors are the cheapest structural summary of a drawing there
 * is: a floor plan's walls show as spikes in both, a section's storey
 * divisions show as spikes in `occupancyRows` only, and a blank band between
 * two spikes is a room or a storey height. Values are rounded to six decimals
 * so the arrays are safe to hash into a sealed artefact.
 */
export function occupancyRows(m: Mask): Float64Array {
  const out = new Float64Array(m.height)
  if (m.width <= 0) return out
  for (let y = 0; y < m.height; y++) {
    const base = y * m.width
    let c = 0
    for (let x = 0; x < m.width; x++) c += m.data[base + x]
    out[y] = round6(c / m.width)
  }
  return out
}

export function occupancyCols(m: Mask): Float64Array {
  const out = new Float64Array(m.width)
  if (m.height <= 0) return out
  const counts = new Int32Array(m.width)
  for (let y = 0; y < m.height; y++) {
    const base = y * m.width
    for (let x = 0; x < m.width; x++) counts[x] += m.data[base + x]
  }
  for (let x = 0; x < m.width; x++) out[x] = round6(counts[x] / m.height)
  return out
}

/**
 * Mean of a square neighbourhood, by summed-area table.
 *
 * O(1) per pixel regardless of radius, which matters because the radius that
 * makes background subtraction work is a large fraction of the image and a
 * naive box filter at that size costs more than everything else in the
 * pipeline put together. Edges are handled by clamping the window rather than
 * by padding, so a pixel near the border is compared with the neighbourhood it
 * actually has.
 */
export function localMean(g: Gray, radius: number): Gray {
  const r = Math.max(1, Math.floor(radius))
  const w = g.width
  const h = g.height
  // (w+1) x (h+1) prefix sums; Float64 because a 4000x3000 sheet of 255s
  // overflows 32-bit integer precision well before the corner.
  const sat = new Float64Array((w + 1) * (h + 1))
  for (let y = 0; y < h; y++) {
    let row = 0
    for (let x = 0; x < w; x++) {
      row += g.data[y * w + x]
      sat[(y + 1) * (w + 1) + (x + 1)] = sat[y * (w + 1) + (x + 1)] + row
    }
  }
  const out = new Uint8ClampedArray(w * h)
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r)
    const y1 = Math.min(h - 1, y + r)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r)
      const x1 = Math.min(w - 1, x + r)
      const sum = sat[(y1 + 1) * (w + 1) + (x1 + 1)] - sat[y0 * (w + 1) + (x1 + 1)] - sat[(y1 + 1) * (w + 1) + x0] + sat[y0 * (w + 1) + x0]
      out[y * w + x] = Math.round(sum / ((y1 - y0 + 1) * (x1 - x0 + 1)))
    }
  }
  return { width: w, height: h, data: out }
}

/**
 * Ink by local contrast rather than by a global level.
 *
 * `inkMask`'s single threshold is right for a drawing whose lines are black on
 * white. It is wrong for the ones this pipeline actually meets: a published
 * plan whose fine lines — the stair treads, the furniture, the hatches — are
 * drawn in a light grey barely darker than the paper, over a page-wide
 * watermark that shifts the paper's own level. A global threshold either
 * misses those lines entirely or, lowered enough to catch them, floods the
 * mask with the watermark.
 *
 * Comparing each pixel with the MEAN OF ITS OWN NEIGHBOURHOOD asks the right
 * question — "is this darker than the paper around it?" — which is what makes
 * a 200-on-215 tread line and a 20-on-250 wall line both come out as ink, and
 * a smooth watermark gradient come out as neither.
 *
 * `absolute` keeps genuinely dark pixels regardless of their surroundings, so
 * the middle of a thick poched wall does not read as background merely because
 * everything near it is equally black.
 */
export function adaptiveInkMask(g: Gray, opts: { radius?: number; delta?: number; absolute?: number } = {}): Mask {
  const radius = Math.max(2, Math.floor(opts.radius ?? Math.max(4, Math.round(Math.max(g.width, g.height) / 40))))
  const delta = opts.delta ?? 8
  const absolute = opts.absolute ?? 110
  const mean = localMean(g, radius)
  const data = new Uint8Array(g.width * g.height)
  for (let i = 0; i < data.length; i++) data[i] = g.data[i] <= absolute || mean.data[i] - g.data[i] >= delta ? 1 : 0
  return { width: g.width, height: g.height, data }
}

/**
 * Where the picture CHANGES, rather than where it is dark.
 *
 * An ink mask answers "is this pixel part of a mark?", which is the right
 * question for a silhouette, a connected component or a filled wall. It is the
 * wrong question for a line, because a band of mid-tone reads as one solid
 * region of ink and its two drawn edges disappear into it — and a member's two
 * edges are exactly what tells you it is a member and how thick it is.
 *
 * A central-difference gradient asks the other question. Every tone boundary
 * becomes a thin ridge, whatever the tones on either side of it are, so the
 * edges of a light band on a lighter wall come out as two lines exactly as the
 * edges of a black line on white paper do.
 */
export function gradientMask(g: Gray, opts: { threshold?: number } = {}): Mask {
  const t = opts.threshold ?? 18
  const w = g.width
  const h = g.height
  const data = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const left = g.data[y * w + Math.max(0, x - 1)]
      const right = g.data[y * w + Math.min(w - 1, x + 1)]
      const up = g.data[Math.max(0, y - 1) * w + x]
      const down = g.data[Math.min(h - 1, y + 1) * w + x]
      if (Math.max(Math.abs(right - left), Math.abs(down - up)) >= t) data[y * w + x] = 1
    }
  }
  return { width: w, height: h, data }
}
