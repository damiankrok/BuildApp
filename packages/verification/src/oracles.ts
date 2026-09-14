/**
 * Independent geometry oracles.
 *
 * These read emitted triangles and share no code with the compiler: the
 * compiler tiles faces, it never computes a volume, pairs an edge or casts a
 * ray. A test that agrees with both is therefore evidence, not tautology.
 *
 * The triangle type is structural (`{ a, b, c }` of `{ x, y, z }`) so this
 * package depends on nothing else in the workspace.
 */
export type OVec3 = { x: number; y: number; z: number }
export type OTri = { a: OVec3; b: OVec3; c: OVec3 }

const sub = (a: OVec3, b: OVec3): OVec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const dot = (a: OVec3, b: OVec3): number => a.x * b.x + a.y * b.y + a.z * b.z
const cross = (a: OVec3, b: OVec3): OVec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x })
const len = (a: OVec3): number => Math.hypot(a.x, a.y, a.z)

/** Signed volume by the divergence theorem. Negative means wound inside out. */
export function meshVolume(tris: readonly OTri[]): number {
  let v = 0
  for (const t of tris) v += dot(t.a, cross(t.b, t.c))
  return v / 6
}

export function surfaceArea(tris: readonly OTri[]): number {
  let s = 0
  for (const t of tris) s += len(cross(sub(t.b, t.a), sub(t.c, t.a))) / 2
  return s
}

export type ManifoldReport = {
  closed: boolean
  triangleCount: number
  /** Directed edges with no opposite partner: holes or T-junctions. */
  boundaryEdges: number
  /** Directed edges traversed more than once: inconsistent winding or duplicated faces. */
  duplicateEdges: number
  /** Distinct vertex positions, compared exactly. */
  vertexCount: number
}

const key = (p: OVec3): string => `${p.x},${p.y},${p.z}`

/**
 * Directed-edge pairing. Every edge of a closed, consistently oriented mesh
 * is traversed exactly once as p->q and once as q->p. Vertices are compared
 * exactly: a compiler that computes each shared vertex from the same local
 * values produces bit-identical doubles, and this checks that it did.
 */
export function manifoldReport(tris: readonly OTri[]): ManifoldReport {
  const count = new Map<string, number>()
  const verts = new Set<string>()
  for (const t of tris) {
    const ks = [key(t.a), key(t.b), key(t.c)]
    for (const k of ks) verts.add(k)
    for (let i = 0; i < 3; i++) {
      const e = `${ks[i]}|${ks[(i + 1) % 3]}`
      count.set(e, (count.get(e) ?? 0) + 1)
    }
  }
  let boundary = 0
  let duplicate = 0
  for (const [e, n] of count) {
    if (n > 1) duplicate += n - 1
    const [p, q] = e.split('|')
    if (!count.has(`${q}|${p}`)) boundary++
  }
  return { closed: boundary === 0 && duplicate === 0, triangleCount: tris.length, boundaryEdges: boundary, duplicateEdges: duplicate, vertexCount: verts.size }
}

export type RayHit = { t: number; entering: boolean; point: OVec3 }

/**
 * Möller–Trumbore, both facings. `entering` is true when the ray goes against
 * the triangle's formula normal, i.e. into the material of an outward-wound
 * solid. Hits at the same distance collapse to one.
 */
export function rayHits(tris: readonly OTri[], origin: OVec3, dir: OVec3, eps = 1e-9): RayHit[] {
  const hits: RayHit[] = []
  for (const t of tris) {
    const e1 = sub(t.b, t.a)
    const e2 = sub(t.c, t.a)
    const p = cross(dir, e2)
    const det = dot(e1, p)
    if (Math.abs(det) < 1e-14) continue
    const inv = 1 / det
    const s = sub(origin, t.a)
    const u = dot(s, p) * inv
    if (u < -eps || u > 1 + eps) continue
    const q = cross(s, e1)
    const v = dot(dir, q) * inv
    if (v < -eps || u + v > 1 + eps) continue
    const tt = dot(e2, q) * inv
    if (tt < eps) continue
    const n = cross(e1, e2)
    hits.push({ t: tt, entering: dot(n, dir) < 0, point: { x: origin.x + dir.x * tt, y: origin.y + dir.y * tt, z: origin.z + dir.z * tt } })
  }
  hits.sort((a, b) => a.t - b.t)
  const out: RayHit[] = []
  for (const h of hits) {
    const last = out[out.length - 1]
    if (last && Math.abs(last.t - h.t) <= 1e-9 && last.entering === h.entering) continue
    out.push(h)
  }
  return out
}

export type MaterialRun = { t0: number; t1: number }

/**
 * Intervals of the ray that lie inside the solid (an outward-wound closed
 * mesh), as distances along `dir`. A ray that starts inside is reported from 0.
 */
export function materialRuns(tris: readonly OTri[], origin: OVec3, dir: OVec3): MaterialRun[] {
  const hits = rayHits(tris, origin, dir)
  const runs: MaterialRun[] = []
  let depth = 0
  let start = 0
  // If the first crossing is an exit we started inside.
  if (hits.length > 0 && !hits[0].entering) {
    depth = 1
    start = 0
  }
  for (const h of hits) {
    if (h.entering) {
      if (depth === 0) start = h.t
      depth++
    } else {
      depth = Math.max(0, depth - 1)
      if (depth === 0) runs.push({ t0: start, t1: h.t })
    }
  }
  return runs
}

/** Total length of the ray inside the solid. */
export function materialLength(tris: readonly OTri[], origin: OVec3, dir: OVec3): number {
  return materialRuns(tris, origin, dir).reduce((s, r) => s + (r.t1 - r.t0), 0)
}

/** Length along the ray inside BOTH solids: the shared material along that line. */
export function sharedMaterialLength(a: readonly OTri[], b: readonly OTri[], origin: OVec3, dir: OVec3): number {
  const ra = materialRuns(a, origin, dir)
  const rb = materialRuns(b, origin, dir)
  let s = 0
  for (const x of ra) for (const y of rb) s += Math.max(0, Math.min(x.t1, y.t1) - Math.max(x.t0, y.t0))
  return s
}

export type Box3 = { min: OVec3; max: OVec3 }

export function boundsOf(tris: readonly OTri[]): Box3 | null {
  let b: Box3 | null = null
  for (const t of tris) {
    for (const p of [t.a, t.b, t.c]) {
      if (!b) b = { min: { ...p }, max: { ...p } }
      else {
        b.min.x = Math.min(b.min.x, p.x)
        b.min.y = Math.min(b.min.y, p.y)
        b.min.z = Math.min(b.min.z, p.z)
        b.max.x = Math.max(b.max.x, p.x)
        b.max.y = Math.max(b.max.y, p.y)
        b.max.z = Math.max(b.max.z, p.z)
      }
    }
  }
  return b
}

export function boxesOverlap(a: Box3, b: Box3, eps = 1e-9): boolean {
  return a.min.x < b.max.x - eps && b.min.x < a.max.x - eps && a.min.y < b.max.y - eps && b.min.y < a.max.y - eps && a.min.z < b.max.z - eps && b.min.z < a.max.z - eps
}

export type OverlapEstimate = {
  /** Estimated shared volume, m³, from a grid of vertical rays. */
  volume: number
  /** The longest shared material along any single ray, m. */
  worstSharedLength: number
  rays: number
}

/**
 * Estimate the volume two solids share by firing vertical rays on a grid
 * over the intersection of their bounding boxes. Exact per ray; the grid is
 * the only approximation. Rays are offset off the grid lines so that faces
 * lying exactly on a coordinate plane are not sampled edge-on.
 */
export function overlapEstimate(a: readonly OTri[], b: readonly OTri[], step = 0.1): OverlapEstimate {
  const ba = boundsOf(a)
  const bb = boundsOf(b)
  if (!ba || !bb || !boxesOverlap(ba, bb)) return { volume: 0, worstSharedLength: 0, rays: 0 }
  const minX = Math.max(ba.min.x, bb.min.x)
  const maxX = Math.min(ba.max.x, bb.max.x)
  const minZ = Math.max(ba.min.z, bb.min.z)
  const maxZ = Math.min(ba.max.z, bb.max.z)
  const y0 = Math.min(ba.min.y, bb.min.y) - 1
  const dir = { x: 0, y: 1, z: 0 }
  const nx = Math.max(1, Math.ceil((maxX - minX) / step))
  const nz = Math.max(1, Math.ceil((maxZ - minZ) / step))
  const dx = (maxX - minX) / nx
  const dz = (maxZ - minZ) / nz
  let volume = 0
  let worst = 0
  let rays = 0
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const x = minX + (i + 0.5) * dx + 1e-7
      const z = minZ + (j + 0.5) * dz + 1e-7
      const s = sharedMaterialLength(a, b, { x, y: y0, z }, dir)
      rays++
      if (s > worst) worst = s
      volume += s * dx * dz
    }
  }
  return { volume, worstSharedLength: worst, rays }
}

export type PlaneCluster = { normal: OVec3; area: number; triangles: number; pitchDeg: number }

/**
 * Group triangles by unit normal and report each group's area and the angle
 * its normal makes with vertical — a roof plane's pitch, measured from the
 * emitted geometry and from nothing else.
 */
export function planeClusters(tris: readonly OTri[], angleTolDeg = 0.01): PlaneCluster[] {
  const out: PlaneCluster[] = []
  const cosTol = Math.cos((angleTolDeg * Math.PI) / 180)
  for (const t of tris) {
    const n = cross(sub(t.b, t.a), sub(t.c, t.a))
    const l = len(n)
    if (l < 1e-14) continue
    const un = { x: n.x / l, y: n.y / l, z: n.z / l }
    const area = l / 2
    let hit = out.find((c) => dot(c.normal, un) >= cosTol)
    if (!hit) {
      hit = { normal: un, area: 0, triangles: 0, pitchDeg: (Math.acos(Math.min(1, Math.abs(un.y))) * 180) / Math.PI }
      out.push(hit)
    }
    hit.area += area
    hit.triangles++
  }
  return out.sort((a, b) => b.area - a.area)
}

/** Upward-facing planes only (roof tops), largest first. */
export const upwardPlanes = (tris: readonly OTri[]): PlaneCluster[] => planeClusters(tris).filter((c) => c.normal.y > 1e-9)
