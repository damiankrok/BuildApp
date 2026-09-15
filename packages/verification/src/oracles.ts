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

/**
 * Material runs of a ray through *several* closed solids, as the union of
 * the runs through each. Casting one ray through the concatenated triangles
 * of separate solids is not the same thing: a hit on one solid's face can
 * coincide with a hit on another's (two walls that abut), and the parity
 * count then goes wrong. Runs that touch are merged, so two abutting solids
 * read as one continuous run.
 */
export function unionMaterialRuns(solids: ReadonlyArray<readonly OTri[]>, origin: OVec3, dir: OVec3, eps = 1e-9): MaterialRun[] {
  const all = solids.flatMap((s) => materialRuns(s, origin, dir)).sort((a, b) => a.t0 - b.t0)
  const out: MaterialRun[] = []
  for (const r of all) {
    const last = out[out.length - 1]
    if (last && r.t0 <= last.t1 + eps) last.t1 = Math.max(last.t1, r.t1)
    else out.push({ ...r })
  }
  return out
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

// ---------------------------------------------------------------------------
// Storey ring closure
// ---------------------------------------------------------------------------

export type OVec2 = { x: number; z: number }

export type RingProbeOptions = {
  /** World y values to probe at; a point on the envelope counts as covered when any height finds material. */
  heights: number[]
  /** Spacing of probe points along each edge (m). */
  step?: number
  /** Distance from each vertex of the first and last probe on an edge (m). */
  endInset?: number
  /** How far material may begin inside the outer line before the probe counts as a gap (m). */
  tolerance?: number
  /** Minimum material depth a probe must find (m). */
  minThickness?: number
  /** Grid step of the pairwise overlap estimate (m). */
  overlapStep?: number
}

export type RingGap = { edge: number; from: number; to: number; length: number; probes: number; worstStart: number }
export type RingCornerProbe = { vertex: number; reflex: boolean; materialStart: number; materialLength: number; ok: boolean }
export type RingOverlap = { a: string; b: string; volume: number; worstSharedLength: number }

export type RingClosureReport = {
  closed: boolean
  /** Edge spans of the declared envelope where no wall material starts at the outer line. */
  gaps: RingGap[]
  corners: RingCornerProbe[]
  /** Pairs of the given solids that share volume. */
  overlaps: RingOverlap[]
  /** Edges where material was found *outside* the envelope but not inside (a reversed wall). */
  outsideOnly: number[]
  probes: number
  edgeLengths: number[]
}

/**
 * Independent storey-envelope oracle. Given the declared outer footprint
 * polygon and the compiled solids of the storey's walls (and nothing else —
 * no junction record, no compiler function), it walks the envelope and fires
 * rays from just outside the outer line inward at several heights: at every
 * probe point material must begin at the outer line (within `tolerance`) and
 * run at least `minThickness` deep at one of the heights; at every vertex a
 * ray along the inward bisector must find the corner block filled. Contiguous
 * failing probes are reported as measured gaps; pairwise shared volume of the
 * given solids is reported as overlaps. A missing wall, a shifted endpoint, a
 * reversed wall, a duplicated wall or an unfilled corner all show up here by
 * measurement.
 */
export function ringClosureReport(polygon: readonly OVec2[], solids: ReadonlyArray<{ id: string; triangles: readonly OTri[] }>, opts: RingProbeOptions): RingClosureReport {
  const step = opts.step ?? 0.25
  const endInset = opts.endInset ?? 0.05
  const tol = opts.tolerance ?? 1e-3
  const minT = opts.minThickness ?? 0.05
  const OUTSIDE = 0.01
  const perSolid = solids.map((s) => s.triangles)
  // Orientation by the shoelace formula (local; the oracle shares no code with the model).
  let area2 = 0
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    area2 += a.x * b.z - b.x * a.z
  }
  const sign = area2 >= 0 ? 1 : -1
  const n = polygon.length
  const gaps: RingGap[] = []
  const outsideOnly: number[] = []
  const edgeLengths: number[] = []
  let probes = 0

  /** Material found from a start point along a horizontal direction, at any probe height. */
  const probe = (p: OVec2, d: OVec2): { start: number; length: number } => {
    let best: { start: number; length: number } = { start: Infinity, length: 0 }
    for (const y of opts.heights) {
      const runs = unionMaterialRuns(perSolid, { x: p.x, y, z: p.z }, { x: d.x, y: 0, z: d.z })
      probes++
      if (runs.length === 0) continue
      const r = runs[0]
      const cand = { start: r.t0 - OUTSIDE, length: r.t1 - r.t0 }
      if (cand.start < best.start || (Math.abs(cand.start - best.start) <= 1e-12 && cand.length > best.length)) best = cand
    }
    return best
  }

  for (let i = 0; i < n; i++) {
    const a = polygon[i]
    const b = polygon[(i + 1) % n]
    const L = Math.hypot(b.x - a.x, b.z - a.z)
    edgeLengths.push(L)
    const u = { x: (b.x - a.x) / L, z: (b.z - a.z) / L }
    // Inward is to the left of travel for a positively oriented polygon.
    const inward = { x: -u.z * sign, z: u.x * sign }
    const count = Math.max(2, Math.ceil((L - 2 * endInset) / step) + 1)
    const spacing = (L - 2 * endInset) / (count - 1)
    let open: RingGap | null = null
    let anyInside = false
    let anyOutside = false
    for (let k = 0; k < count; k++) {
      // Probe positions are nudged off round numbers so a ray never runs exactly along a jamb or a corner.
      const s = Math.min(L - endInset, endInset + spacing * k + 0.00371)
      const p = { x: a.x + u.x * s - inward.x * OUTSIDE, z: a.z + u.z * s - inward.z * OUTSIDE }
      const r = probe(p, inward)
      const ok = r.start <= tol && r.start >= -OUTSIDE - 1e-9 && r.length >= minT
      if (ok) anyInside = true
      if (!ok) {
        const back = probe({ x: a.x + u.x * s + inward.x * OUTSIDE, z: a.z + u.z * s + inward.z * OUTSIDE }, { x: -inward.x, z: -inward.z })
        if (back.start <= tol && back.length >= minT) anyOutside = true
        if (!open) open = { edge: i, from: s, to: s, length: 0, probes: 0, worstStart: r.start }
        open.to = s
        open.probes++
        open.worstStart = Math.max(open.worstStart, r.start)
        open.length = open.probes * spacing
      } else if (open) {
        gaps.push(open)
        open = null
      }
    }
    if (open) gaps.push(open)
    if (anyOutside && !anyInside) outsideOnly.push(i)
  }

  const corners: RingCornerProbe[] = []
  for (let i = 0; i < n; i++) {
    const p0 = polygon[(i + n - 1) % n]
    const p1 = polygon[i]
    const p2 = polygon[(i + 1) % n]
    const d0 = norm2({ x: p1.x - p0.x, z: p1.z - p0.z })
    const d1 = norm2({ x: p2.x - p1.x, z: p2.z - p1.z })
    const cross = d0.x * d1.z - d0.z * d1.x
    const reflex = cross * sign < 0
    // Bisector of the interior angle, pointing into the polygon.
    let bis = norm2({ x: -d0.x + d1.x, z: -d0.z + d1.z })
    if (bis.x === 0 && bis.z === 0) bis = { x: -d0.z * sign, z: d0.x * sign }
    const inwardNormal = { x: (-d0.z - d1.z) * sign, z: (d0.x + d1.x) * sign }
    if (bis.x * inwardNormal.x + bis.z * inwardNormal.z < 0) bis = { x: -bis.x, z: -bis.z }
    // Two rays parallel to the bisector, one nudged along each edge, so neither passes exactly through
    // the inner corner point where three walls' corners meet (a grazing hit would fool the parity count).
    const nudge = 0.02
    let worst: { start: number; length: number } = { start: -Infinity, length: Infinity }
    for (const from of [
      { x: p1.x + d1.x * nudge, z: p1.z + d1.z * nudge },
      { x: p1.x - d0.x * nudge, z: p1.z - d0.z * nudge },
    ]) {
      const r = probe({ x: from.x - bis.x * OUTSIDE, z: from.z - bis.z * OUTSIDE }, bis)
      worst = { start: Math.max(worst.start, r.start), length: Math.min(worst.length, r.length) }
    }
    corners.push({ vertex: i, reflex, materialStart: worst.start, materialLength: worst.length, ok: worst.start <= tol && worst.start >= -OUTSIDE - 1e-9 && worst.length >= minT })
  }

  const overlaps: RingOverlap[] = []
  for (let i = 0; i < solids.length; i++) {
    for (let k = i + 1; k < solids.length; k++) {
      const ba = boundsOf(solids[i].triangles)
      const bb = boundsOf(solids[k].triangles)
      if (!ba || !bb || !boxesOverlap(ba, bb)) continue
      const est = overlapEstimate(solids[i].triangles, solids[k].triangles, opts.overlapStep ?? 0.05)
      if (est.volume > 1e-6 || est.worstSharedLength > 1e-6) overlaps.push({ a: solids[i].id, b: solids[k].id, volume: est.volume, worstSharedLength: est.worstSharedLength })
    }
  }

  return { closed: gaps.length === 0 && corners.every((c) => c.ok), gaps, corners, overlaps, outsideOnly, probes, edgeLengths }
}

const norm2 = (v: OVec2): OVec2 => {
  const l = Math.hypot(v.x, v.z)
  return l > 0 ? { x: v.x / l, z: v.z / l } : v
}

// ---------------------------------------------------------------------------
// Depth probing (recesses, portals, characteristic zones)
// ---------------------------------------------------------------------------

export type DepthProbeOptions = {
  /** Corner of the probe rectangle, in world coordinates. */
  origin: OVec3
  /** Edge vectors of the probe rectangle: probe points are `origin + s·ea + t·eb`, s, t in [0, 1]. */
  ea: OVec3
  eb: OVec3
  /** Direction every ray travels (need not be unit; distances are reported in world units). */
  dir: OVec3
  /** Samples along `ea` and along `eb`; points sit at cell centres, nudged off round numbers. */
  samples: [number, number]
  /** Distance from the probe plane within which material counts as "at the plane" (m). */
  planeTolerance?: number
}

export type DepthProbeReport = {
  rays: number
  /** Distance along each ray to the first material (Infinity when the ray meets none). */
  firstHit: number[]
  /** The nearest first material found by any ray. */
  shallowest: number
  /** The farthest first material found by any ray that met material. */
  deepest: number
  /** Rays whose first material lies within `planeTolerance` of the probe plane. */
  atPlane: number
  /** Rays that met no material at all. */
  open: number
}

/**
 * Fire a grid of parallel rays from a rectangle and report, per ray, how far
 * the first material lies (through the union of the given solids). Used to
 * measure a recess: from the outer plane inward, every ray across the mouth
 * must find its first material at the back plane, none at the outer plane.
 */
export function depthProbeReport(solids: ReadonlyArray<readonly OTri[]>, opts: DepthProbeOptions): DepthProbeReport {
  const [na, nb] = opts.samples
  const tol = opts.planeTolerance ?? 1e-3
  const dl = len(opts.dir)
  const dir = { x: opts.dir.x / dl, y: opts.dir.y / dl, z: opts.dir.z / dl }
  const firstHit: number[] = []
  let shallowest = Infinity
  let deepest = -Infinity
  let atPlane = 0
  let open = 0
  for (let i = 0; i < na; i++) {
    for (let j = 0; j < nb; j++) {
      const s = (i + 0.5) / na + 0.00137 / na
      const t = (j + 0.5) / nb + 0.00091 / nb
      const p = { x: opts.origin.x + opts.ea.x * s + opts.eb.x * t, y: opts.origin.y + opts.ea.y * s + opts.eb.y * t, z: opts.origin.z + opts.ea.z * s + opts.eb.z * t }
      const runs = unionMaterialRuns(solids, p, dir)
      const d = runs.length > 0 ? runs[0].t0 : Infinity
      firstHit.push(d)
      if (d === Infinity) open++
      else {
        shallowest = Math.min(shallowest, d)
        deepest = Math.max(deepest, d)
        if (d <= tol) atPlane++
      }
    }
  }
  return { rays: firstHit.length, firstHit, shallowest, deepest, atPlane, open }
}

// ---------------------------------------------------------------------------
// Coverage along a line (railing infill, continuity of a fascia)
// ---------------------------------------------------------------------------

export type LineCoverage = {
  length: number
  /** Total length of the segment inside any of the solids. */
  covered: number
  /** covered / length. */
  fraction: number
  /** The longest uncovered stretch strictly inside the segment. */
  longestGap: number
  runs: MaterialRun[]
}

/**
 * How much of the segment `from -> to` lies inside the union of the given
 * solids, as distances from `from`. A glass balustrade reads as one long run
 * with small gaps at its posts; a bar balustrade as many short runs; an
 * absent one as nothing.
 */
export function lineCoverage(solids: ReadonlyArray<readonly OTri[]>, from: OVec3, to: OVec3): LineCoverage {
  const d = sub(to, from)
  const length = len(d)
  const dir = { x: d.x / length, y: d.y / length, z: d.z / length }
  // start just before the segment so a run beginning exactly at `from` is entered cleanly
  const back = 1e-3
  const origin = { x: from.x - dir.x * back, y: from.y - dir.y * back, z: from.z - dir.z * back }
  const runs = unionMaterialRuns(solids, origin, dir)
    .map((r) => ({ t0: Math.max(0, r.t0 - back), t1: Math.min(length, r.t1 - back) }))
    .filter((r) => r.t1 > r.t0)
  let covered = 0
  let longestGap = 0
  let cursor = 0
  for (const r of runs) {
    covered += r.t1 - r.t0
    longestGap = Math.max(longestGap, r.t0 - cursor)
    cursor = r.t1
  }
  longestGap = Math.max(longestGap, length - cursor)
  return { length, covered, fraction: covered / length, longestGap, runs }
}

// ---------------------------------------------------------------------------
// Plan point-in-polygon (room adjacency)
// ---------------------------------------------------------------------------

/** Even-odd test of a plan point against a simple polygon. Points on an edge count as inside. */
export function pointInPolygon(p: OVec2, polygon: readonly OVec2[]): boolean {
  let inside = false
  const n = polygon.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = polygon[i]
    const b = polygon[j]
    // on the edge?
    const cross = (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x)
    if (Math.abs(cross) < 1e-12 && Math.min(a.x, b.x) - 1e-12 <= p.x && p.x <= Math.max(a.x, b.x) + 1e-12 && Math.min(a.z, b.z) - 1e-12 <= p.z && p.z <= Math.max(a.z, b.z) + 1e-12) return true
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside
  }
  return inside
}
