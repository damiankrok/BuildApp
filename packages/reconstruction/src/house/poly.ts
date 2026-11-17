/**
 * v3.54.4 — plan polygons for the house builder: plain geometry in the model's plan (x, z), no project's data.
 *
 * Orientation: a polygon is COUNTER-CLOCKWISE "on a plan drawn with the front at the bottom" — x to the right, z up the
 * sheet — which is a positive signed area in (x, z). The inside is to the LEFT of travel, so the outward normal of an
 * edge a→b is (dz, −dx) normalised.
 */
export type P2 = { x: number; z: number }

export const EPS = 1e-6
const r6 = (v: number): number => Math.round(v * 1e6) / 1e6
export const pt = (x: number, z: number): P2 => ({ x: r6(x), z: r6(z) })

export function signedArea(poly: readonly P2[]): number {
  let a = 0
  for (let i = 0; i < poly.length; i += 1) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    a += p.x * q.z - q.x * p.z
  }
  return a / 2
}
export const area = (poly: readonly P2[]): number => Math.abs(signedArea(poly))

export function bbox(poly: readonly P2[]): { x0: number; z0: number; x1: number; z1: number } {
  return { x0: Math.min(...poly.map((p) => p.x)), z0: Math.min(...poly.map((p) => p.z)), x1: Math.max(...poly.map((p) => p.x)), z1: Math.max(...poly.map((p) => p.z)) }
}

/** Drop repeated and collinear vertices; make it counter-clockwise; start at the frontmost, then leftmost vertex. */
export function canonical(poly: readonly P2[], collinearTol = 1e-4): P2[] {
  let out: P2[] = []
  for (const p of poly) if (out.length === 0 || Math.hypot(p.x - out[out.length - 1].x, p.z - out[out.length - 1].z) > 1e-5) out.push(pt(p.x, p.z))
  if (out.length > 1 && Math.hypot(out[0].x - out[out.length - 1].x, out[0].z - out[out.length - 1].z) <= 1e-5) out.pop()
  let changed = true
  while (changed && out.length > 3) {
    changed = false
    for (let i = 0; i < out.length; i += 1) {
      const a = out[(i + out.length - 1) % out.length]
      const b = out[i]
      const c = out[(i + 1) % out.length]
      const cross = (b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x)
      const dot = (b.x - a.x) * (c.x - b.x) + (b.z - a.z) * (c.z - b.z)
      if (Math.abs(cross) <= collinearTol * Math.max(1, Math.hypot(b.x - a.x, b.z - a.z) * Math.hypot(c.x - b.x, c.z - b.z)) && dot > 0) {
        out.splice(i, 1)
        changed = true
        break
      }
    }
  }
  if (signedArea(out) < 0) out = out.reverse()
  let k = 0
  for (let i = 1; i < out.length; i += 1) if (out[i].z < out[k].z - 1e-6 || (Math.abs(out[i].z - out[k].z) <= 1e-6 && out[i].x < out[k].x)) k = i
  return [...out.slice(k), ...out.slice(0, k)]
}

export function isSimple(poly: readonly P2[]): boolean {
  const n = poly.length
  if (n < 3 || area(poly) < 1e-6) return false
  const cross = (a: P2, b: P2, c: P2): number => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue
      const a = poly[i]
      const b = poly[(i + 1) % n]
      const c = poly[j]
      const d = poly[(j + 1) % n]
      const d1 = cross(a, b, c)
      const d2 = cross(a, b, d)
      const d3 = cross(c, d, a)
      const d4 = cross(c, d, b)
      if (((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) && ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS))) return false
    }
  }
  return true
}

export function contains(poly: readonly P2[], p: P2): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const a = poly[i]
    const b = poly[j]
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside
  }
  return inside
}

/** Distance from a point to the segment a–b, and where along it (0..1) the nearest point is. */
export function toSegment(p: P2, a: P2, b: P2): { d: number; t: number } {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const l2 = dx * dx + dz * dz
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)) : 0
  return { d: Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz)), t }
}

/** Does the point lie on the polygon's boundary (within `tol`)? Returns the edge index, or −1. */
export function onBoundary(poly: readonly P2[], p: P2, tol = 0.02): number {
  for (let i = 0; i < poly.length; i += 1) if (toSegment(p, poly[i], poly[(i + 1) % poly.length]).d <= tol) return i
  return -1
}

export const edgeOf = (poly: readonly P2[], i: number): { a: P2; b: P2; len: number; u: P2; out: P2 } => {
  const a = poly[i]
  const b = poly[(i + 1) % poly.length]
  const len = Math.hypot(b.x - a.x, b.z - a.z)
  const u = { x: (b.x - a.x) / (len || 1), z: (b.z - a.z) / (len || 1) }
  return { a, b, len, u, out: { x: u.z, z: -u.x } }
}

/** Offset every edge outwards by its own distance (mitred corners). A zero distance keeps the edge where it is. */
export function offset(poly: readonly P2[], dist: readonly number[]): P2[] {
  const n = poly.length
  const lines = poly.map((_, i) => {
    const e = edgeOf(poly, i)
    return { p: { x: e.a.x + e.out.x * dist[i], z: e.a.z + e.out.z * dist[i] }, u: e.u }
  })
  const out: P2[] = []
  for (let i = 0; i < n; i += 1) {
    const l0 = lines[(i + n - 1) % n]
    const l1 = lines[i]
    const den = l0.u.x * l1.u.z - l0.u.z * l1.u.x
    if (Math.abs(den) < 1e-9) {
      // parallel neighbours (a straight vertex): step both offsets
      const e = edgeOf(poly, i)
      const d0 = dist[(i + n - 1) % n]
      const d1 = dist[i]
      if (Math.abs(d0 - d1) > 1e-9) {
        out.push(pt(poly[i].x + e.out.x * d0, poly[i].z + e.out.z * d0))
        out.push(pt(poly[i].x + e.out.x * d1, poly[i].z + e.out.z * d1))
      } else out.push(pt(poly[i].x + e.out.x * d1, poly[i].z + e.out.z * d1))
      continue
    }
    const t = ((l1.p.x - l0.p.x) * l1.u.z - (l1.p.z - l0.p.z) * l1.u.x) / den
    out.push(pt(l0.p.x + l0.u.x * t, l0.p.z + l0.u.z * t))
  }
  return out
}

/** Keep the part of a polygon on the side of the line through `at` where (p − at)·n ≥ 0. */
export function clipHalfPlane(poly: readonly P2[], at: P2, n: P2): P2[] {
  const side = (p: P2): number => (p.x - at.x) * n.x + (p.z - at.z) * n.z
  const out: P2[] = []
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const sa = side(a)
    const sb = side(b)
    if (sa >= -EPS) out.push(a)
    if ((sa > EPS && sb < -EPS) || (sa < -EPS && sb > EPS)) {
      const t = sa / (sa - sb)
      out.push(pt(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t))
    }
  }
  return canonicalLoose(out)
}

/** Clip a polygon by a convex one (both counter-clockwise). */
export function clipConvex(poly: readonly P2[], convex: readonly P2[]): P2[] {
  let out: P2[] = [...poly]
  for (let i = 0; i < convex.length && out.length >= 3; i += 1) {
    const e = edgeOf(convex, i)
    out = clipHalfPlane(out, e.a, { x: -e.out.x, z: -e.out.z })
  }
  return out
}

/** Like `canonical`, without moving the start: used for clip results that may be degenerate. */
function canonicalLoose(poly: readonly P2[]): P2[] {
  const out: P2[] = []
  for (const p of poly) if (out.length === 0 || Math.hypot(p.x - out[out.length - 1].x, p.z - out[out.length - 1].z) > 1e-6) out.push(p)
  if (out.length > 1 && Math.hypot(out[0].x - out[out.length - 1].x, out[0].z - out[out.length - 1].z) <= 1e-6) out.pop()
  return out
}

/** The stretches of the segment a–b that lie on the boundary of `poly` (within `tol`), as parameters along a→b in metres. */
export function sharedStretches(a: P2, b: P2, poly: readonly P2[], tol = 0.03): Array<[number, number]> {
  const len = Math.hypot(b.x - a.x, b.z - a.z)
  if (len < 1e-6) return []
  const u = { x: (b.x - a.x) / len, z: (b.z - a.z) / len }
  const out: Array<[number, number]> = []
  for (let i = 0; i < poly.length; i += 1) {
    const c = poly[i]
    const d = poly[(i + 1) % poly.length]
    const el = Math.hypot(d.x - c.x, d.z - c.z)
    if (el < 1e-6) continue
    // parallel and on the same line
    const cross = Math.abs(u.x * ((d.z - c.z) / el) - u.z * ((d.x - c.x) / el))
    if (cross > 1e-3) continue
    const off = Math.abs((c.x - a.x) * u.z - (c.z - a.z) * u.x)
    if (off > tol) continue
    const t0 = (c.x - a.x) * u.x + (c.z - a.z) * u.z
    const t1 = (d.x - a.x) * u.x + (d.z - a.z) * u.z
    const lo = Math.max(0, Math.min(t0, t1))
    const hi = Math.min(len, Math.max(t0, t1))
    if (hi - lo > 0.05) out.push([lo, hi])
  }
  out.sort((p, q) => p[0] - q[0])
  const merged: Array<[number, number]> = []
  for (const s of out) {
    const last = merged[merged.length - 1]
    if (last && s[0] <= last[1] + 1e-6) last[1] = Math.max(last[1], s[1])
    else merged.push([s[0], s[1]])
  }
  return merged
}

/**
 * The outline of polygons that TILE (touch along edges, do not overlap): every edge is split where another polygon's
 * vertex lies on it, a stretch walked in both directions is inside the union and is dropped, and what is left is chained
 * into loops. Returns the loops, the largest first; a union that is not one loop comes back as several.
 */
export function unionTiling(polys: readonly (readonly P2[])[], tol = 0.02): P2[][] {
  const verts = polys.flat()
  type E = { a: P2; b: P2 }
  const edges: E[] = []
  for (const poly of polys) {
    for (let i = 0; i < poly.length; i += 1) {
      const a = poly[i]
      const b = poly[(i + 1) % poly.length]
      const len = Math.hypot(b.x - a.x, b.z - a.z)
      if (len < 1e-6) continue
      const cuts = verts
        .map((v) => ({ v, s: toSegment(v, a, b) }))
        .filter((q) => q.s.d <= tol && q.s.t > 1e-6 && q.s.t < 1 - 1e-6)
        .map((q) => q.s.t)
        .sort((p, q) => p - q)
      const ts = [0, ...cuts.filter((t, k, arr) => k === 0 || t - arr[k - 1] > 1e-6), 1]
      for (let k = 0; k + 1 < ts.length; k += 1) edges.push({ a: pt(a.x + (b.x - a.x) * ts[k], a.z + (b.z - a.z) * ts[k]), b: pt(a.x + (b.x - a.x) * ts[k + 1], a.z + (b.z - a.z) * ts[k + 1]) })
    }
  }
  const near = (p: P2, q: P2): boolean => Math.hypot(p.x - q.x, p.z - q.z) <= tol
  const alive = edges.map(() => true)
  for (let i = 0; i < edges.length; i += 1) {
    if (!alive[i]) continue
    for (let j = i + 1; j < edges.length; j += 1) {
      if (alive[j] && near(edges[i].a, edges[j].b) && near(edges[i].b, edges[j].a)) {
        alive[i] = false
        alive[j] = false
        break
      }
    }
  }
  const rest = edges.filter((_, i) => alive[i])
  const loops: P2[][] = []
  const used = rest.map(() => false)
  for (let i = 0; i < rest.length; i += 1) {
    if (used[i]) continue
    const loop: P2[] = [rest[i].a]
    used[i] = true
    let at = rest[i].b
    for (let guard = 0; guard < rest.length + 2; guard += 1) {
      if (near(at, loop[0])) break
      loop.push(at)
      const k = rest.findIndex((e, j) => !used[j] && near(e.a, at))
      if (k < 0) break
      used[k] = true
      at = rest[k].b
    }
    if (loop.length >= 3) loops.push(loop)
  }
  return loops.sort((p, q) => area(q) - area(p))
}

/**
 * Make nearly axis-parallel edges axis-parallel and bring nearly equal wall lines of several polygons onto one line, so
 * that bodies traced one by one share their common walls exactly. `lines` collects the lines found (for a later polygon).
 */
export function squareUp(polys: readonly (readonly P2[])[], angleTolDeg = 6, mergeTol = 0.12): P2[][] {
  const tan = Math.tan((angleTolDeg * Math.PI) / 180)
  const out = polys.map((poly) => poly.map((p) => ({ x: p.x, z: p.z })))
  type L = { axis: 'x' | 'z'; at: number; w: number; members: Array<{ p: number; i: number }> }
  const lines: L[] = []
  out.forEach((poly, pi) => {
    for (let i = 0; i < poly.length; i += 1) {
      const a = poly[i]
      const b = poly[(i + 1) % poly.length]
      const dx = Math.abs(b.x - a.x)
      const dz = Math.abs(b.z - a.z)
      if (dz <= tan * dx && dx > 1e-6) lines.push({ axis: 'z', at: (a.z + b.z) / 2, w: dx, members: [{ p: pi, i }, { p: pi, i: (i + 1) % poly.length }] })
      else if (dx <= tan * dz && dz > 1e-6) lines.push({ axis: 'x', at: (a.x + b.x) / 2, w: dz, members: [{ p: pi, i }, { p: pi, i: (i + 1) % poly.length }] })
    }
  })
  for (const axis of ['x', 'z'] as const) {
    const ls = lines.filter((l) => l.axis === axis).sort((p, q) => p.at - q.at)
    let group: L[] = []
    const flush = (): void => {
      if (group.length === 0) return
      const w = group.reduce((s, l) => s + l.w, 0)
      const at = group.reduce((s, l) => s + l.at * l.w, 0) / w
      for (const l of group) for (const m of l.members) out[m.p][m.i][axis] = at
      group = []
    }
    for (const l of ls) {
      if (group.length > 0 && l.at - group[0].at > mergeTol) flush()
      group.push(l)
    }
    flush()
  }
  return out.map((poly) => poly.map((p) => pt(p.x, p.z)))
}
