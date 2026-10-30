/**
 * N9-01: small plan-geometry helpers the relations share. A wall's `start → end` is its outer-face line at the base;
 * its thickness runs to the left of that direction (`n = (−u.z, u.x)`), which is where the schema puts the inner face.
 */
import type { Wall } from '@buildapp/model'

type P = { x: number; z: number }

export function wallAxes(w: Pick<Wall, 'start' | 'end'>): { length: number; u: P; n: P } {
  const dx = w.end.x - w.start.x
  const dz = w.end.z - w.start.z
  const length = Math.hypot(dx, dz)
  const u = length > 0 ? { x: dx / length, z: dz / length } : { x: 1, z: 0 }
  return { length, u, n: { x: -u.z, z: u.x } }
}

/** The wall's band in plan: outer-face line and inner-face line, as a quadrilateral. */
export function bandQuad(w: Pick<Wall, 'start' | 'end' | 'thickness'>): P[] {
  const { n } = wallAxes(w)
  return [
    { x: w.start.x, z: w.start.z },
    { x: w.end.x, z: w.end.z },
    { x: w.end.x + n.x * w.thickness, z: w.end.z + n.z * w.thickness },
    { x: w.start.x + n.x * w.thickness, z: w.start.z + n.z * w.thickness },
  ]
}

export function pointInPolygon(poly: readonly P[], x: number, z: number): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const a = poly[i]
    const b = poly[j]
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside
  }
  return inside
}

export function polygonArea(poly: readonly P[]): number {
  let s = 0
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) s += poly[j].x * poly[i].z - poly[i].x * poly[j].z
  return Math.abs(s) / 2
}
