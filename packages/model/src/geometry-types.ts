/**
 * Plain numeric value types shared by the whole model.
 *
 * Plan coordinates are `{ x, z }` in the model's world frame; vertical
 * positions are `y`. Nothing here depends on any renderer.
 */
import { z } from 'zod'

export const finite = z.number().finite()
export const positive = z.number().finite().positive()
export const nonNegative = z.number().finite().nonnegative()

export const Vec2Schema = z.object({ x: finite, z: finite }).strict()
export type Vec2 = z.infer<typeof Vec2Schema>

export const Vec3Schema = z.object({ x: finite, y: finite, z: finite }).strict()
export type Vec3 = z.infer<typeof Vec3Schema>

/** An axis-aligned plan rectangle in world x/z. */
export const PlanRectSchema = z
  .object({ minX: finite, maxX: finite, minZ: finite, maxZ: finite })
  .strict()
export type PlanRect = z.infer<typeof PlanRectSchema>

/** A simple plan polygon, at least three vertices, no closing repeat. */
export const PlanPolygonSchema = z.array(Vec2Schema).min(3)
export type PlanPolygon = z.infer<typeof PlanPolygonSchema>

export const rectWidth = (r: PlanRect): number => r.maxX - r.minX
export const rectDepth = (r: PlanRect): number => r.maxZ - r.minZ
export const rectIsValid = (r: PlanRect): boolean => r.maxX - r.minX > 0 && r.maxZ - r.minZ > 0

/** Signed area by the shoelace formula, in the model's x/z plane. */
export function polygonSignedArea(p: readonly Vec2[]): number {
  let s = 0
  for (let i = 0; i < p.length; i++) {
    const a = p[i]
    const b = p[(i + 1) % p.length]
    s += a.x * b.z - b.x * a.z
  }
  return s / 2
}

export const polygonArea = (p: readonly Vec2[]): number => Math.abs(polygonSignedArea(p))

export const rectToPolygon = (r: PlanRect): Vec2[] => [
  { x: r.minX, z: r.minZ },
  { x: r.maxX, z: r.minZ },
  { x: r.maxX, z: r.maxZ },
  { x: r.minX, z: r.maxZ },
]

/**
 * True when the polygon is simple enough for this stage: no repeated vertex,
 * no zero-length edge, non-zero area, and no two non-adjacent edges crossing.
 */
export function polygonIsSimple(p: readonly Vec2[], eps = 1e-9): boolean {
  const n = p.length
  if (n < 3) return false
  for (let i = 0; i < n; i++) {
    const a = p[i]
    const b = p[(i + 1) % n]
    if (Math.hypot(b.x - a.x, b.z - a.z) <= eps) return false
  }
  if (Math.abs(polygonSignedArea(p)) <= eps) return false
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue
      if (segmentsCross(p[i], p[(i + 1) % n], p[j], p[(j + 1) % n], eps)) return false
    }
  }
  return true
}

function orient(a: Vec2, b: Vec2, c: Vec2): number {
  return (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)
}

function segmentsCross(p1: Vec2, p2: Vec2, q1: Vec2, q2: Vec2, eps: number): boolean {
  const d1 = orient(q1, q2, p1)
  const d2 = orient(q1, q2, p2)
  const d3 = orient(p1, p2, q1)
  const d4 = orient(p1, p2, q2)
  if (((d1 > eps && d2 < -eps) || (d1 < -eps && d2 > eps)) && ((d3 > eps && d4 < -eps) || (d3 < -eps && d4 > eps))) {
    return true
  }
  return false
}
