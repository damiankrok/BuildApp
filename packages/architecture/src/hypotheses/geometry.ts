/**
 * Plain vector arithmetic for reading proposals: plane fits, plan distances,
 * bounds. No triangles: the pipeline states objects, the compiler draws them.
 */
import type { Vec2, Vec3 } from '@buildapp/model'
import type { ProposalGeometry, SemanticProposal } from '../proposals.js'

export const r9 = (v: number): number => Math.round(v * 1e9) / 1e9
export const r6 = (v: number): number => Math.round(v * 1e6) / 1e6

export const plan = (p: Vec3): Vec2 => ({ x: p.x, z: p.z })
export const dist2 = (a: Vec2, b: Vec2): number => Math.hypot(b.x - a.x, b.z - a.z)

export function unit2(v: Vec2): Vec2 | null {
  const l = Math.hypot(v.x, v.z)
  return l > 1e-12 ? { x: v.x / l, z: v.z / l } : null
}

/** The upward unit normal of a planar 3D outline (Newell's method), or null for no area. */
export function upwardNormal(points: readonly Vec3[]): Vec3 | null {
  let nx = 0
  let ny = 0
  let nz = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    nx += (a.y - b.y) * (a.z + b.z)
    ny += (a.z - b.z) * (a.x + b.x)
    nz += (a.x - b.x) * (a.y + b.y)
  }
  const l = Math.hypot(nx, ny, nz)
  if (l < 1e-12) return null
  const s = ny < 0 ? -1 : 1
  return { x: (s * nx) / l, y: (s * ny) / l, z: (s * nz) / l }
}

/** Signed plan area (positive: counter-clockwise in the x–z plan as the builders draw it). */
export function signedArea(poly: readonly Vec2[]): number {
  let a = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    a += p.x * q.z - q.x * p.z
  }
  return a / 2
}

export function pointSegmentDistance2(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const L = dx * dx + dz * dz
  const t = L > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / L)) : 0
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t))
}

export function pointInPolygon(p: Vec2, poly: readonly Vec2[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside
  }
  return inside
}

export type Box = { min: Vec3; max: Vec3 }

/** World points a proposal's geometry names (none for a value). */
export function pointsOf(g: ProposalGeometry): Vec3[] {
  if (g.type === 'POLYGON') return g.points
  if (g.type === 'SEGMENT') return [g.start, g.end]
  return []
}

export function boxOf(ps: readonly SemanticProposal[]): Box | null {
  const pts = ps.flatMap((p) => pointsOf(p.geometry))
  if (pts.length === 0) return null
  const min = { x: Infinity, y: Infinity, z: Infinity }
  const max = { x: -Infinity, y: -Infinity, z: -Infinity }
  for (const q of pts) {
    min.x = Math.min(min.x, q.x)
    min.y = Math.min(min.y, q.y)
    min.z = Math.min(min.z, q.z)
    max.x = Math.max(max.x, q.x)
    max.y = Math.max(max.y, q.y)
    max.z = Math.max(max.z, q.z)
  }
  return { min, max }
}

export const polygonArea = (poly: readonly Vec2[]): number => Math.abs(signedArea(poly))
