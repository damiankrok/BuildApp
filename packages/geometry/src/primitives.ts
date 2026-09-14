/**
 * Triangle emission helpers. Every face goes through `quadOut` / `triOut`,
 * which take the corners in any planar order plus the direction the face
 * should point, and wind the triangles so the formula normal agrees with it.
 * That removes a whole class of "wound the wrong way" bugs: the caller states
 * the geometric fact (this face looks along +up) and never counts corners.
 */
import type { Vec2 } from '@buildapp/model'
import { polygonSignedArea } from '@buildapp/model'
import { cross, dot, sub, v3, type Triangle, type Vec3 } from './types.js'

const EPS = 1e-12

const same = (a: Vec3, b: Vec3): boolean => a.x === b.x && a.y === b.y && a.z === b.z

/** One triangle, wound so its formula normal points along `outward`. Degenerate input emits nothing. */
export function triOut(out: Triangle[], p0: Vec3, p1: Vec3, p2: Vec3, outward: Vec3): void {
  if (same(p0, p1) || same(p1, p2) || same(p0, p2)) return
  const n = cross(sub(p1, p0), sub(p2, p0))
  const l2 = dot(n, n)
  if (l2 <= EPS * EPS) return
  if (dot(n, outward) >= 0) out.push({ a: p0, b: p1, c: p2 })
  else out.push({ a: p0, b: p2, c: p1 })
}

/**
 * A planar quad `p0 p1 p2 p3` (corners in cyclic order) as two triangles,
 * each wound to face `outward`. Collapsed edges reduce it to one triangle;
 * a fully collapsed quad emits nothing.
 */
export function quadOut(out: Triangle[], p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, outward: Vec3): void {
  // Split along the diagonal that keeps both halves non-degenerate when an
  // edge has collapsed (a trapezoid whose top has shrunk to a point).
  if (same(p0, p1)) return triOut(out, p1, p2, p3, outward)
  if (same(p1, p2)) return triOut(out, p0, p1, p3, outward)
  if (same(p2, p3)) return triOut(out, p0, p1, p2, outward)
  if (same(p3, p0)) return triOut(out, p0, p1, p2, outward)
  triOut(out, p0, p1, p2, outward)
  triOut(out, p0, p2, p3, outward)
}

/** An axis-aligned world box, closed and outward-wound. */
export function worldBox(out: Triangle[], minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number): void {
  const P = (x: number, y: number, z: number): Vec3 => v3(x, y, z)
  quadOut(out, P(minX, maxY, minZ), P(maxX, maxY, minZ), P(maxX, maxY, maxZ), P(minX, maxY, maxZ), v3(0, 1, 0))
  quadOut(out, P(minX, minY, minZ), P(maxX, minY, minZ), P(maxX, minY, maxZ), P(minX, minY, maxZ), v3(0, -1, 0))
  quadOut(out, P(maxX, minY, minZ), P(maxX, maxY, minZ), P(maxX, maxY, maxZ), P(maxX, minY, maxZ), v3(1, 0, 0))
  quadOut(out, P(minX, minY, minZ), P(minX, maxY, minZ), P(minX, maxY, maxZ), P(minX, minY, maxZ), v3(-1, 0, 0))
  quadOut(out, P(minX, minY, maxZ), P(maxX, minY, maxZ), P(maxX, maxY, maxZ), P(minX, maxY, maxZ), v3(0, 0, 1))
  quadOut(out, P(minX, minY, minZ), P(maxX, minY, minZ), P(maxX, maxY, minZ), P(minX, maxY, minZ), v3(0, 0, -1))
}

/**
 * A box in an arbitrary affine frame: corner `origin`, edge vectors `e0 e1 e2`
 * (not necessarily unit or orthogonal). Faces are wound outward by the actual
 * face directions, so any handedness of the edge triple is fine.
 */
export function frameBox(out: Triangle[], origin: Vec3, e0: Vec3, e1: Vec3, e2: Vec3): void {
  const P = (i: number, j: number, k: number): Vec3 => ({
    x: origin.x + e0.x * i + e1.x * j + e2.x * k,
    y: origin.y + e0.y * i + e1.y * j + e2.y * k,
    z: origin.z + e0.z * i + e1.z * j + e2.z * k,
  })
  const neg = (a: Vec3): Vec3 => ({ x: -a.x, y: -a.y, z: -a.z })
  const n0 = cross(e1, e2)
  const n1 = cross(e2, e0)
  const n2 = cross(e0, e1)
  // ±e0 faces
  quadOut(out, P(1, 0, 0), P(1, 1, 0), P(1, 1, 1), P(1, 0, 1), dot(n0, e0) >= 0 ? n0 : neg(n0))
  quadOut(out, P(0, 0, 0), P(0, 1, 0), P(0, 1, 1), P(0, 0, 1), dot(n0, e0) >= 0 ? neg(n0) : n0)
  // ±e1 faces
  quadOut(out, P(0, 1, 0), P(1, 1, 0), P(1, 1, 1), P(0, 1, 1), dot(n1, e1) >= 0 ? n1 : neg(n1))
  quadOut(out, P(0, 0, 0), P(1, 0, 0), P(1, 0, 1), P(0, 0, 1), dot(n1, e1) >= 0 ? neg(n1) : n1)
  // ±e2 faces
  quadOut(out, P(0, 0, 1), P(1, 0, 1), P(1, 1, 1), P(0, 1, 1), dot(n2, e2) >= 0 ? n2 : neg(n2))
  quadOut(out, P(0, 0, 0), P(1, 0, 0), P(1, 1, 0), P(0, 1, 0), dot(n2, e2) >= 0 ? neg(n2) : n2)
}

/**
 * Ear-clipping triangulation of a simple plan polygon. Returns index triples
 * into the input, or `null` when the polygon cannot be triangulated (which
 * the caller reports rather than papers over).
 */
export function triangulatePolygon(poly: readonly Vec2[]): Array<[number, number, number]> | null {
  const n = poly.length
  if (n < 3) return null
  const ccw = polygonSignedArea(poly) > 0
  const idx: number[] = []
  for (let i = 0; i < n; i++) idx.push(ccw ? i : n - 1 - i)
  const tris: Array<[number, number, number]> = []
  const area2 = (a: Vec2, b: Vec2, c: Vec2): number => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)
  const inside = (p: Vec2, a: Vec2, b: Vec2, c: Vec2): boolean =>
    area2(a, b, p) >= -1e-12 && area2(b, c, p) >= -1e-12 && area2(c, a, p) >= -1e-12
  let guard = 0
  while (idx.length > 3 && guard++ < 10000) {
    let clipped = false
    for (let i = 0; i < idx.length; i++) {
      const i0 = idx[(i + idx.length - 1) % idx.length]
      const i1 = idx[i]
      const i2 = idx[(i + 1) % idx.length]
      const a = poly[i0]
      const b = poly[i1]
      const c = poly[i2]
      if (area2(a, b, c) <= 1e-12) continue // reflex or degenerate
      let ear = true
      for (const j of idx) {
        if (j === i0 || j === i1 || j === i2) continue
        if (inside(poly[j], a, b, c)) {
          ear = false
          break
        }
      }
      if (!ear) continue
      tris.push([i0, i1, i2])
      idx.splice(i, 1)
      clipped = true
      break
    }
    if (!clipped) return null
  }
  if (idx.length === 3) tris.push([idx[0], idx[1], idx[2]])
  return tris
}

/**
 * Extrude a simple plan polygon vertically into a closed solid between
 * `y0` and `y1`. Returns false when the polygon cannot be triangulated.
 */
export function extrudePolygon(out: Triangle[], poly: readonly Vec2[], y0: number, y1: number): boolean {
  const tri = triangulatePolygon(poly)
  if (!tri) return false
  const lo = Math.min(y0, y1)
  const hi = Math.max(y0, y1)
  for (const [i, j, k] of tri) {
    triOut(out, v3(poly[i].x, hi, poly[i].z), v3(poly[j].x, hi, poly[j].z), v3(poly[k].x, hi, poly[k].z), v3(0, 1, 0))
    triOut(out, v3(poly[i].x, lo, poly[i].z), v3(poly[j].x, lo, poly[j].z), v3(poly[k].x, lo, poly[k].z), v3(0, -1, 0))
  }
  const ccw = polygonSignedArea(poly) > 0
  const n = poly.length
  for (let i = 0; i < n; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % n]
    const dx = q.x - p.x
    const dz = q.z - p.z
    // For a positive-area traversal the interior is on the left of p->q in
    // the x/z plane, so outward is (dz, -dx); a negative traversal flips it.
    const outward = ccw ? v3(dz, 0, -dx) : v3(-dz, 0, dx)
    quadOut(out, v3(p.x, lo, p.z), v3(q.x, lo, q.z), v3(q.x, hi, q.z), v3(p.x, hi, p.z), outward)
  }
  return true
}
