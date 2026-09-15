/**
 * Source-native 2D geometry, shared by the acquisition and observation layers.
 *
 * Two coordinate systems, and the distinction is load-bearing:
 *
 * - PIXEL coordinates are the source asset's own, with the origin at its
 *   top-left, `x` right and `y` DOWN, measured on the DECODED image. They are
 *   only meaningful together with the asset's decoded width and height, which
 *   is why every observation names its asset and every asset records the
 *   dimensions its bytes actually have (never the ones a web page claims).
 * - NORMALIZED coordinates are those divided by the decoded width and height,
 *   so they lie in [0, 1] and survive a rescale of the same picture. An
 *   observation carries both: pixels for provenance, normalized for
 *   comparison between variants of the same drawing.
 *
 * Nothing here is metric. Turning either into metres needs an anchor (a
 * printed dimension, a scale bar) and is the solver's job, not this layer's.
 */
import { z } from 'zod'

export const finite = z.number().finite()
export const unitInterval = z.number().finite().min(-0.5).max(1.5)

/** A point in a source asset's own pixel grid (origin top-left, y down). */
export const PixelPointSchema = z.object({ x: finite, y: finite }).strict()
export type PixelPoint = z.infer<typeof PixelPointSchema>

/** A point normalized by the decoded size of its asset. Slightly outside [0,1] is allowed so a reading may sit on the very edge. */
export const NormPointSchema = z.object({ x: unitInterval, y: unitInterval }).strict()
export type NormPoint = z.infer<typeof NormPointSchema>

export const PixelRectSchema = z.object({ x0: finite, y0: finite, x1: finite, y1: finite }).strict()
export type PixelRect = z.infer<typeof PixelRectSchema>

/** Decoded size of an image, in pixels, as its bytes define it. */
export const PixelSizeSchema = z.object({ width: z.number().int().positive(), height: z.number().int().positive() }).strict()
export type PixelSize = z.infer<typeof PixelSizeSchema>

export const toNorm = (p: PixelPoint, size: PixelSize): NormPoint => ({ x: round6(p.x / size.width), y: round6(p.y / size.height) })
export const fromNorm = (p: NormPoint, size: PixelSize): PixelPoint => ({ x: round6(p.x * size.width), y: round6(p.y * size.height) })

/** Six decimals, and never a negative zero: enough for a pixel coordinate on any plausible raster, and stable to hash. */
export function round6(v: number): number {
  const r = Math.round(v * 1e6) / 1e6
  return r === 0 ? 0 : r
}

export const rectOf = (points: readonly PixelPoint[]): PixelRect | null => {
  if (points.length === 0) return null
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const p of points) {
    x0 = Math.min(x0, p.x)
    y0 = Math.min(y0, p.y)
    x1 = Math.max(x1, p.x)
    y1 = Math.max(y1, p.y)
  }
  return { x0: round6(x0), y0: round6(y0), x1: round6(x1), y1: round6(y1) }
}

export const rectArea = (r: PixelRect): number => Math.max(0, r.x1 - r.x0) * Math.max(0, r.y1 - r.y0)

export function rectIntersection(a: PixelRect, b: PixelRect): PixelRect | null {
  const x0 = Math.max(a.x0, b.x0)
  const y0 = Math.max(a.y0, b.y0)
  const x1 = Math.min(a.x1, b.x1)
  const y1 = Math.min(a.y1, b.y1)
  return x1 > x0 && y1 > y0 ? { x0, y0, x1, y1 } : null
}

/** Intersection over union of two rectangles: 1 when identical, 0 when disjoint. */
export function rectIoU(a: PixelRect, b: PixelRect): number {
  const i = rectIntersection(a, b)
  if (!i) return 0
  const inter = rectArea(i)
  const union = rectArea(a) + rectArea(b) - inter
  return union <= 0 ? 0 : round6(inter / union)
}

/** Angle of the segment p→q in degrees, measured from the +x axis with y DOWN, folded into [0, 180). */
export function segmentAngleDeg(p: PixelPoint, q: PixelPoint): number {
  const deg = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI
  const folded = ((deg % 180) + 180) % 180
  return round6(folded)
}

export const segmentLength = (p: PixelPoint, q: PixelPoint): number => round6(Math.hypot(q.x - p.x, q.y - p.y))

/** Smallest difference between two angles that are equal modulo 180°. */
export function angleDeltaDeg(a: number, b: number): number {
  const d = Math.abs(((a - b) % 180) + 180) % 180
  return round6(Math.min(d, 180 - d))
}
