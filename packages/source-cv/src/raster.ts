/**
 * Decoded rasters and the scalar fields derived from them.
 *
 * This layer receives pixels that someone else already decoded (the package
 * layer owns PNG/JPEG/GIF and the byte hashes); nothing here knows what a
 * file is. That separation is what keeps this package browser-safe: no
 * `node:*`, no `fetch`, no `<canvas>`, no image codecs. Hand it a width, a
 * height and RGBA bytes and it will only ever do arithmetic.
 *
 * COORDINATE CONVENTION, used by every function in this package:
 *   - origin is the TOP-LEFT of the decoded image, `x` increases right and
 *     `y` increases DOWN, matching the RGBA buffer's row-major layout and
 *     `PixelPoint` in `@buildapp/source-common`.
 *   - every `PixelRect` produced here is INCLUSIVE of both corners and is
 *     addressed in whole pixels: the rect `{x0:2,y0:2,x1:4,y1:4}` covers nine
 *     pixels, not four. That is why component `fill` divides by
 *     `(x1-x0+1)*(y1-y0+1)` rather than by `rectArea`, which measures a
 *     continuous rectangle. Callers converting to normalized coordinates
 *     should decide deliberately whether they mean the pixel's corner or its
 *     centre; this package always means the pixel itself.
 *
 * DETERMINISM: every function here is a pure function of its arguments. There
 * is no randomness, no clock, no locale, and no floating point operation
 * beyond IEEE-754 `+ - * /` and the transcendentals used for angles, so the
 * same input bytes give the same output bytes on every engine.
 */
import type { PixelRect } from '@buildapp/source-common'

/** A decoded image: RGBA, row-major, 4 bytes per pixel, origin top-left. */
export type Raster = { width: number; height: number; data: Uint8ClampedArray }

/** A single-channel field over the same grid: one byte per pixel, row-major. */
export type Gray = { width: number; height: number; data: Uint8ClampedArray }

const clampInt = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v)

/**
 * Rec. 601 luma (0.299 R + 0.587 G + 0.114 B).
 *
 * Rec. 709 is the correct weighting for modern display primaries, but this is
 * not colour science: it is a reading of drafting ink on paper. Architectural
 * line work is overwhelmingly neutral (black, greys, the odd blue print), and
 * for a neutral pixel 601 and 709 agree exactly. Where they disagree is on
 * saturated colour, and there 601's heavier red weight is the one that keeps a
 * red annotation closer in luma to the grey line work around it — which is
 * precisely the ambiguity `inkChannel` exists to resolve. Using 601 keeps that
 * ambiguity visible in the luma channel instead of half-hiding it, and it is
 * also what almost every scanner and PDF rasteriser used on these drawings
 * applied when it produced the greyscale in the first place, so a greyscale
 * source and a colour source of the same sheet land on the same numbers.
 */
export function toGray(r: Raster): Gray {
  const n = r.width * r.height
  const out = new Uint8ClampedArray(n)
  for (let i = 0; i < n; i++) {
    const o = i * 4
    out[i] = Math.round(0.299 * r.data[o] + 0.587 * r.data[o + 1] + 0.114 * r.data[o + 2])
  }
  return { width: r.width, height: r.height, data: out }
}

/**
 * The INK channel: the per-pixel minimum of R, G and B.
 *
 * Why not luma: a saturated red dimension annotation, RGB (255, 0, 0), has
 * luma 76 — exactly the luma of a neutral 30% grey, the sort of tone used for
 * furniture hatching or a screened-back existing-building layer. A luma
 * threshold therefore cannot separate "a line someone drew in red because it
 * carries a number" from "background texture someone drew in grey because it
 * does not". The channel minimum can: the red is 0, the grey is 76. More
 * generally `min(R,G,B)` is dark whenever ANY primary is dark, so every
 * saturated hue (a cyan grid, a magenta centreline, a yellow highlight over
 * black text) survives, while paper — which is bright in all three channels —
 * cannot. Ink survives where luma loses it, and the cost is that a pale
 * saturated wash also reads as ink, which the threshold then rejects on
 * magnitude.
 */
export function inkChannel(r: Raster): Gray {
  const n = r.width * r.height
  const out = new Uint8ClampedArray(n)
  for (let i = 0; i < n; i++) {
    const o = i * 4
    const g = r.data[o + 1]
    const b = r.data[o + 2]
    let v = r.data[o]
    if (g < v) v = g
    if (b < v) v = b
    out[i] = v
  }
  return { width: r.width, height: r.height, data: out }
}

/**
 * Chroma as `max - min` per pixel: 0 for anything neutral, 255 for a fully
 * saturated primary. This is the field that says WHERE a colour decision was
 * made. Neutral line work is the drawing; saturated line work is usually
 * annotation laid over it (dimensions, section marks, revision clouds), so a
 * caller that wants to weight or ignore annotation reads this rather than
 * guessing from luma.
 */
export function saturationField(r: Raster): Gray {
  const n = r.width * r.height
  const out = new Uint8ClampedArray(n)
  for (let i = 0; i < n; i++) {
    const o = i * 4
    const rr = r.data[o]
    const gg = r.data[o + 1]
    const bb = r.data[o + 2]
    const hi = rr > gg ? (rr > bb ? rr : bb) : gg > bb ? gg : bb
    const lo = rr < gg ? (rr < bb ? rr : bb) : gg < bb ? gg : bb
    out[i] = hi - lo
  }
  return { width: r.width, height: r.height, data: out }
}

/**
 * The value at quantile `p` of a single-channel field, via a 256-bucket
 * histogram.
 *
 * A histogram rather than a sort: the domain is exactly 256 values, so the
 * histogram is exact (not an approximation) AND it is O(n) with no comparison
 * order to leak — two runs on the same field always return the same integer.
 * `p` is clamped into [0, 1]; `percentile(g, 0)` is the minimum and
 * `percentile(g, 1)` the maximum. An empty field returns 0.
 */
export function percentile(g: Gray, p: number): number {
  const n = g.width * g.height
  if (n <= 0) return 0
  const q = p < 0 ? 0 : p > 1 ? 1 : p
  const hist = new Int32Array(256)
  for (let i = 0; i < n; i++) hist[g.data[i]]++
  // rank is an index into the sorted values, so p=1 selects the last one
  const rank = Math.min(n - 1, Math.max(0, Math.floor(q * (n - 1))))
  let seen = 0
  for (let v = 0; v < 256; v++) {
    seen += hist[v]
    if (seen > rank) return v
  }
  return 255
}

/**
 * Box-filter downscale to a bounded long edge.
 *
 * Every detector in this package is O(pixels) at best and O(pixels x angles)
 * at worst (see `houghSegments`), so the single most effective thing a caller
 * can do with a 6000-pixel-wide scan is bound it here first. A box filter,
 * not a Lanczos or a bilinear: box averaging over the exact source footprint
 * of each destination pixel is the only resampler that preserves the MEAN ink
 * density of a region, which is what every threshold downstream is reading.
 * A sharpening kernel would invent contrast that was never in the bytes.
 *
 * Returns the input object itself when it is already within `maxEdge`, so a
 * caller can pipe unconditionally without paying for a copy.
 */
export function downscaleGray(g: Gray, maxEdge: number): Gray {
  const edge = Math.max(1, Math.floor(maxEdge))
  const longest = Math.max(g.width, g.height)
  if (longest <= edge) return g
  const scale = edge / longest
  const w = Math.max(1, Math.floor(g.width * scale))
  const h = Math.max(1, Math.floor(g.height * scale))
  const out = new Uint8ClampedArray(w * h)
  for (let y = 0; y < h; y++) {
    const sy0 = Math.floor((y * g.height) / h)
    const sy1 = Math.max(sy0 + 1, Math.floor(((y + 1) * g.height) / h))
    for (let x = 0; x < w; x++) {
      const sx0 = Math.floor((x * g.width) / w)
      const sx1 = Math.max(sx0 + 1, Math.floor(((x + 1) * g.width) / w))
      let sum = 0
      let count = 0
      for (let sy = sy0; sy < sy1 && sy < g.height; sy++) {
        const base = sy * g.width
        for (let sx = sx0; sx < sx1 && sx < g.width; sx++) {
          sum += g.data[base + sx]
          count++
        }
      }
      out[y * w + x] = count > 0 ? Math.round(sum / count) : 0
    }
  }
  return { width: w, height: h, data: out }
}

/**
 * Crop to an INCLUSIVE pixel rectangle, clamped to the field.
 *
 * Coordinates are rounded to whole pixels and clamped into range, and the
 * result is never empty: a rect entirely off the field collapses to the
 * nearest single pixel rather than to a zero-sized `Gray`, because every
 * consumer here divides by width or height somewhere and a 0 x 0 field would
 * turn a bad crop into a NaN two layers away instead of an obvious one.
 */
export function cropGray(g: Gray, rect: PixelRect): Gray {
  const x0 = clampInt(Math.round(rect.x0), 0, g.width - 1)
  const y0 = clampInt(Math.round(rect.y0), 0, g.height - 1)
  const x1 = clampInt(Math.round(rect.x1), x0, g.width - 1)
  const y1 = clampInt(Math.round(rect.y1), y0, g.height - 1)
  const w = x1 - x0 + 1
  const h = y1 - y0 + 1
  const out = new Uint8ClampedArray(w * h)
  for (let y = 0; y < h; y++) {
    const src = (y0 + y) * g.width + x0
    for (let x = 0; x < w; x++) out[y * w + x] = g.data[src + x]
  }
  return { width: w, height: h, data: out }
}

/**
 * Sample with clamp-to-edge addressing. Clamping rather than wrapping or
 * returning 0: a kernel that runs off the edge of a drawing should see more
 * paper, not a phantom dark border that then registers as a wall.
 */
export function grayAt(g: Gray, x: number, y: number): number {
  const xi = clampInt(Math.floor(x), 0, g.width - 1)
  const yi = clampInt(Math.floor(y), 0, g.height - 1)
  return g.data[yi * g.width + xi]
}
