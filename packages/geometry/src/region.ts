/**
 * Planar regions with holes: `outer − holes`, tessellated so that an
 * extrusion of the region is one closed manifold.
 *
 * The region is cut into horizontal bands at every vertex `v` (the scanline
 * grid). Inside a band no edge starts or ends, so the edges crossing it,
 * sorted by `u`, pair up left/right under the even-odd rule into trapezoids
 * — a hole is simply two more crossings. Every trapezoid corner lying on a
 * scanline is a break on that line, and every trapezoid's top and bottom
 * edge is split on all the breaks of its line, so the triangles on either
 * side of a scanline meet vertex for vertex (no T-junction), and the
 * boundary walls, split on the same scanlines and breaks, share those
 * vertices too. A hole may share boundary with the outer polygon (a stair
 * void against a wall): the two coincident, opposite boundary segments have
 * no material between them and cancel, which is exactly the region
 * difference. No bridging, no ear clipping, no repair.
 *
 * Coordinates are abstract `(u, v)`: plan `(x, z)` for slabs, wall-local
 * `(a, b)` for door frames and finish regions.
 */
import { quadOut, triOut } from './primitives.js'
import type { Triangle, Vec3 } from './types.js'

export type P2 = { u: number; v: number }
export type Tessellation = {
  /** Triangles with positive orientation in (u, v) (counter-clockwise with u right and v up). */
  triangles: Array<[P2, P2, P2]>
  /** Boundary segments, directed with the region's material on the LEFT (outer loops positive, holes negative), split on the grid, coincident opposite pairs removed. */
  boundary: Array<[P2, P2]>
}

const EPS = 1e-9
const signedArea = (p: readonly P2[]): number => {
  let s = 0
  for (let i = 0; i < p.length; i++) {
    const a = p[i]
    const b = p[(i + 1) % p.length]
    s += a.u * b.v - b.u * a.v
  }
  return s / 2
}
const key = (p: P2): string => `${p.u},${p.v}`

/** `u` of the edge p→q at height `v` (exact at the endpoints). */
function uAt(p: P2, q: P2, v: number): number {
  if (v === p.v) return p.u
  if (v === q.v) return q.u
  return p.u + ((v - p.v) * (q.u - p.u)) / (q.v - p.v)
}

export function tessellateRegion(outerIn: readonly P2[], holesIn: ReadonlyArray<readonly P2[]>): Tessellation {
  const outer = signedArea(outerIn) >= 0 ? [...outerIn] : [...outerIn].reverse()
  const holes = holesIn.map((h) => (signedArea(h) <= 0 ? [...h] : [...h].reverse()))
  const loops = [outer, ...holes]
  type Edge = { p: P2; q: P2 }
  const edges: Edge[] = []
  for (const loop of loops) for (let i = 0; i < loop.length; i++) edges.push({ p: loop[i], q: loop[(i + 1) % loop.length] })

  // scanlines: every distinct vertex v
  const vsAll = [...new Set(loops.flat().map((p) => p.v))].sort((a, b) => a - b)
  const vs: number[] = []
  for (const v of vsAll) if (vs.length === 0 || v - vs[vs.length - 1] > EPS) vs.push(v)
  const snapV = (v: number): number => vs.find((x) => Math.abs(x - v) <= EPS) ?? v
  for (const e of edges) {
    e.p = { u: e.p.u, v: snapV(e.p.v) }
    e.q = { u: e.q.u, v: snapV(e.q.v) }
  }

  type Trap = { band: number; bl: number; br: number; tl: number; tr: number }
  const traps: Trap[] = []
  for (let k = 0; k + 1 < vs.length; k++) {
    const v0 = vs[k]
    const v1 = vs[k + 1]
    const vm = (v0 + v1) / 2
    const crossing = edges.filter((e) => e.p.v !== e.q.v && Math.min(e.p.v, e.q.v) <= v0 + EPS && Math.max(e.p.v, e.q.v) >= v1 - EPS)
    const xs = crossing.map((e) => ({ e, um: uAt(e.p, e.q, vm), u0: uAt(e.p, e.q, v0), u1: uAt(e.p, e.q, v1) })).sort((a, b) => a.um - b.um || a.u0 - b.u0 || a.u1 - b.u1)
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const L = xs[i]
      const R = xs[i + 1]
      if (R.u0 - L.u0 <= EPS && R.u1 - L.u1 <= EPS) continue
      traps.push({ band: k, bl: L.u0, br: R.u0, tl: L.u1, tr: R.u1 })
    }
  }

  // breaks on every scanline: trapezoid corners and vertices
  const breaks = new Map<number, number[]>()
  const addBreak = (k: number, u: number): void => {
    const list = breaks.get(k) ?? []
    if (!list.some((x) => Math.abs(x - u) <= EPS)) list.push(u)
    breaks.set(k, list)
  }
  for (const t of traps) {
    addBreak(t.band, t.bl)
    addBreak(t.band, t.br)
    addBreak(t.band + 1, t.tl)
    addBreak(t.band + 1, t.tr)
  }
  for (const loop of loops) for (const p of loop) addBreak(vs.indexOf(snapV(p.v)), p.u)
  for (const list of breaks.values()) list.sort((a, b) => a - b)
  const chain = (k: number, u0: number, u1: number): P2[] => {
    const v = vs[k]
    if (u1 - u0 <= EPS) return [{ u: u0, v }]
    const inner = (breaks.get(k) ?? []).filter((u) => u > u0 + EPS && u < u1 - EPS)
    return [{ u: u0, v }, ...inner.map((u) => ({ u, v })), { u: u1, v }]
  }

  const triangles: Array<[P2, P2, P2]> = []
  const push = (a: P2, b: P2, c: P2): void => {
    const area = (b.u - a.u) * (c.v - a.v) - (b.v - a.v) * (c.u - a.u)
    if (Math.abs(area) <= 1e-14) return
    triangles.push(area > 0 ? [a, b, c] : [a, c, b])
  }
  for (const t of traps) {
    const B = chain(t.band, t.bl, t.br)
    const T = chain(t.band + 1, t.tl, t.tr)
    let i = 0
    let j = 0
    while (i < B.length - 1 || j < T.length - 1) {
      const advanceB = j === T.length - 1 || (i < B.length - 1 && B[i + 1].u <= T[j + 1].u)
      if (advanceB) {
        push(B[i], B[i + 1], T[j])
        i++
      } else {
        push(B[i], T[j + 1], T[j])
        j++
      }
    }
  }

  // boundary: every loop edge split on the scanlines it crosses and, when horizontal, on its line's breaks
  const segments: Array<[P2, P2]> = []
  for (const e of edges) {
    const pts: P2[] = [e.p]
    if (e.p.v !== e.q.v) {
      const lo = Math.min(e.p.v, e.q.v)
      const hi = Math.max(e.p.v, e.q.v)
      const inside = vs.filter((v) => v > lo + EPS && v < hi - EPS)
      if (e.p.v > e.q.v) inside.reverse()
      for (const v of inside) pts.push({ u: uAt(e.p, e.q, v), v })
    } else {
      const k = vs.indexOf(e.p.v)
      const lo = Math.min(e.p.u, e.q.u)
      const hi = Math.max(e.p.u, e.q.u)
      const inner = (breaks.get(k) ?? []).filter((u) => u > lo + EPS && u < hi - EPS)
      if (e.p.u > e.q.u) inner.reverse()
      for (const u of inner) pts.push({ u, v: e.p.v })
    }
    pts.push(e.q)
    for (let i = 0; i + 1 < pts.length; i++) segments.push([pts[i], pts[i + 1]])
  }
  const count = new Map<string, number>()
  for (const [p, q] of segments) count.set(`${key(p)}|${key(q)}`, (count.get(`${key(p)}|${key(q)}`) ?? 0) + 1)
  const boundary = segments.filter(([p, q]) => !count.has(`${key(q)}|${key(p)}`))
  return { triangles, boundary }
}

/** Extrude a plan region (u = x, v = z) between `y0` and `y1` into one closed, outward-wound solid. */
export function extrudePlanRegion(out: Triangle[], outer: readonly { x: number; z: number }[], holes: ReadonlyArray<readonly { x: number; z: number }[]>, y0: number, y1: number): void {
  const t = tessellateRegion(
    outer.map((p) => ({ u: p.x, v: p.z })),
    holes.map((h) => h.map((p) => ({ u: p.x, v: p.z }))),
  )
  const lo = Math.min(y0, y1)
  const hi = Math.max(y0, y1)
  const P = (p: P2, y: number): Vec3 => ({ x: p.u, y, z: p.v })
  for (const [a, b, c] of t.triangles) {
    triOut(out, P(a, hi), P(b, hi), P(c, hi), { x: 0, y: 1, z: 0 })
    triOut(out, P(a, lo), P(b, lo), P(c, lo), { x: 0, y: -1, z: 0 })
  }
  for (const [p, q] of t.boundary) {
    // material on the left of p→q in the (x, z) plane: outward is to the right, (dz, −dx)
    const outward: Vec3 = { x: q.v - p.v, y: 0, z: -(q.u - p.u) }
    quadOut(out, P(p, lo), P(q, lo), P(q, hi), P(p, hi), outward)
  }
}

/**
 * Extrude a wall-local region (u = a along the wall, v = b up) from `c0` to
 * `c1` inward through the wall frame into one closed, outward-wound solid —
 * a door frame with several apertures, a finish skin with the openings left
 * out.
 */
export function extrudeLocalRegion(
  out: Triangle[],
  f: { u: Vec3; up: Vec3; n: Vec3 },
  point: (a: number, b: number, c: number) => Vec3,
  outer: readonly { a: number; b: number }[],
  holes: ReadonlyArray<readonly { a: number; b: number }[]>,
  c0: number,
  c1: number,
): void {
  const t = tessellateRegion(
    outer.map((p) => ({ u: p.a, v: p.b })),
    holes.map((h) => h.map((p) => ({ u: p.a, v: p.b }))),
  )
  const lo = Math.min(c0, c1)
  const hi = Math.max(c0, c1)
  const P = (p: P2, c: number): Vec3 => point(p.u, p.v, c)
  const nOut = f.n
  const nIn: Vec3 = { x: -f.n.x, y: -f.n.y, z: -f.n.z }
  for (const [a, b, c] of t.triangles) {
    triOut(out, P(a, lo), P(b, lo), P(c, lo), nOut)
    triOut(out, P(a, hi), P(b, hi), P(c, hi), nIn)
  }
  for (const [p, q] of t.boundary) {
    // material on the left of p→q in the (a, b) plane: outward is (db, −da) in that plane
    const da = q.u - p.u
    const db = q.v - p.v
    const outward: Vec3 = { x: f.u.x * db - f.up.x * da, y: f.u.y * db - f.up.y * da, z: f.u.z * db - f.up.z * da }
    quadOut(out, P(p, lo), P(q, lo), P(q, hi), P(p, hi), outward)
  }
}
