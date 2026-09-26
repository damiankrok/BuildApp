/**
 * Geometry closure audit.
 *
 * A compiled building is a set of closed solids, one per semantic object. On
 * their own the solids are all correct; what a viewer sees, and an owner
 * judges, is how they MEET. A slab whose edge stands in the plane of the wall
 * face draws two faces in one place and flickers; a verge board that passes
 * through a return wall reads as two boxes pushed into each other; a railing
 * that stops a hand's width from the wall it should reach reads as a
 * mistake, however exact the railing itself is.
 *
 * This audit measures those meetings. For every pair of structural solids it
 * finds the volume the two share, the area they draw twice in one plane
 * facing the same way, and the gap between solids that were meant to touch;
 * and it reads the model's own semantics — junctions, hosts, roofs a wall
 * follows, balconies a railing guards — to know which meetings were INTENDED
 * (a chimney through a roof, a slab bearing on its walls) and which were not.
 * A meeting that was intended and is clean is a relation satisfied; a
 * meeting that was not intended, or an intended one that is not clean, is a
 * finding with a measure in metres, square metres or cubic metres.
 *
 * Nothing here repairs geometry. The audit's job is to make a defect a
 * number that a stage can be held to, and to name the pair of objects and
 * the relation so the fix lands in the layer that owns the join — the
 * semantic model, the DSL command, or the compiler — rather than in an
 * epsilon.
 */
import type { CanonicalBuildingModel } from '@buildapp/model'
import type { CompiledMesh, CompiledScene, Triangle, Vec3 } from './types.js'

// ---------------------------------------------------------------------------
// report types
// ---------------------------------------------------------------------------

/** How two objects are meant to meet. */
export type ClosureRelationKind =
  /** Faces touch along a shared plane, with no volume in common. */
  | 'CONTACT'
  /** One passes through the other on purpose: a chimney through a roof, a stair through a slab hole. */
  | 'PENETRATION'
  /** The two never touch. */
  | 'SEPARATION'
  /** One member's face lies in the other's, continuing it: a verge along a rake, a fascia along an eave. */
  | 'FLUSH'
  /** A railing on the edge it guards: its base on the slab, its ends at the walls or turning into another run. */
  | 'GUARDS'
  /**
   * A plate built into the walls that carry it: it may share volume with a
   * wall up to the wall's own thickness, and must show no edge face in the
   * plane of the wall's outer face.
   */
  | 'BEARING'

export type ClosureRelationLabel =
  | 'WALL<->WALL'
  | 'WALL<->SLAB'
  | 'WALL<->ROOF'
  | 'WALL<->RETURN_WALL'
  | 'MAIN_MASS<->ATTACHED_MASS'
  | 'BALCONY_SLAB<->WALL'
  | 'BALCONY_SLAB<->FASCIA'
  | 'RAILING<->BALCONY'
  | 'PARAPET<->FLAT_ROOF'
  | 'FACADE_FRAME<->HOST_FACADE'
  | 'TERRACE<->EXTERIOR_FLOOR_DATUM'
  | 'TERRACE<->WALL'
  | 'TRIM<->ROOF'
  | 'CHIMNEY<->ROOF'
  | 'CHIMNEY<->SLAB'
  | 'CHIMNEY<->WALL'
  | 'STAIR<->SLAB'
  | 'OTHER'

export type ClosureRelation = {
  a: string
  b: string
  label: ClosureRelationLabel
  kind: ClosureRelationKind
  why: string
}

export type ClosureFindingCode =
  | 'INTERSECTION'
  | 'COPLANAR_DUPLICATE'
  | 'GAP'
  | 'EXPOSED_INTERNAL_FACE'
  | 'SLIVER_TRIANGLES'
  | 'NON_MANIFOLD'
  | 'RAILING_END_FREE'
  | 'RAILING_OFF_BASE'
  | 'MEMBER_DISCONNECTED'
  | 'TERRACE_MISALIGNED'

export type ClosureFinding = {
  code: ClosureFindingCode
  severity: 'ERROR' | 'WARNING' | 'INFO'
  /**
   * EXTERIOR: seen from outside the building (a facade, a roof, a balcony, a
   * terrace). INTERIOR: inside the envelope — a stair against a partition —
   * which the exterior review does not see but the model still carries.
   */
  scope: 'EXTERIOR' | 'INTERIOR'
  objects: string[]
  relation?: ClosureRelationLabel
  intended?: ClosureRelationKind
  measure: number
  unit: 'm' | 'm2' | 'm3' | 'count'
  message: string
}

export type ClosureMetrics = {
  pairsChecked: number
  /** Same-facing coplanar area that lies under a third solid's opposite face: never drawn, recorded for completeness. */
  enclosedCoplanarAreaM2: number
  exteriorFindingCount: number
  interiorFindingCount: number
  intersectionCount: number
  intersectionVolumeM3: number
  coplanarDuplicateCount: number
  coplanarDuplicateAreaM2: number
  gapCount: number
  sliverTriangleCount: number
  nonManifoldSolidCount: number
  disconnectedMemberCount: number
  railingFreeEndCount: number
  railingEndDistanceMaxM: number
  terraceAlignmentResidualM: number
}

export type ClosureReport = {
  schema: 'buildapp.geometry-closure-report'
  schemaVersion: '1.0.0'
  modelId: string
  relations: ClosureRelation[]
  findings: ClosureFinding[]
  metrics: ClosureMetrics
  /** Every pair that shares volume or a same-facing plane, whatever the relation said, for the record. */
  contacts: Array<{ a: string; b: string; relation: ClosureRelationLabel; intended: ClosureRelationKind; volumeM3: number; coplanarM2: number }>
}

export type ClosureOptions = {
  /** Shared volume below this is a touch, not an intersection. */
  volumeToleranceM3?: number
  /** Same-facing coplanar area below this is an edge, not a duplicate face. */
  coplanarToleranceM2?: number
  /** Faces this far apart still count as in one plane (a viewer flickers on less). */
  planeToleranceM?: number
  /** A railing end further than this from its host is free. */
  railingEndToleranceM?: number
  /**
   * Two solids the model says meet, standing apart by more than the plane
   * tolerance and at most this, show a gap a viewer sees as a crack of light;
   * further apart they are simply not meeting (the relation's own finding).
   */
  gapSearchM?: number
  /** Objects whose parts are not in this list are ignored (markers, glazing, fills). */
  parts?: ReadonlyArray<CompiledMesh['part']>
  /** Sampling step for the shared-volume estimate between non-box solids. */
  sampleStepM?: number
}

const DEFAULTS: Required<ClosureOptions> = {
  volumeToleranceM3: 0.002,
  coplanarToleranceM2: 0.005,
  planeToleranceM: 0.003,
  railingEndToleranceM: 0.06,
  gapSearchM: 0.1,
  parts: ['WALL', 'SLAB', 'ROOF', 'BALCONY', 'TERRACE', 'CHIMNEY', 'LINEAR_SOLID', 'ROOF_TRIM', 'STAIR_STEP'],
  sampleStepM: 0.05,
}

// ---------------------------------------------------------------------------
// triangle helpers
// ---------------------------------------------------------------------------

type Bounds = { min: Vec3; max: Vec3 }

const boundsOf = (tris: readonly Triangle[]): Bounds => {
  const min = { x: Infinity, y: Infinity, z: Infinity }
  const max = { x: -Infinity, y: -Infinity, z: -Infinity }
  for (const t of tris) {
    for (const p of [t.a, t.b, t.c]) {
      if (p.x < min.x) min.x = p.x
      if (p.y < min.y) min.y = p.y
      if (p.z < min.z) min.z = p.z
      if (p.x > max.x) max.x = p.x
      if (p.y > max.y) max.y = p.y
      if (p.z > max.z) max.z = p.z
    }
  }
  return { min, max }
}

const overlap1 = (a0: number, a1: number, b0: number, b1: number): number => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))

const normalOf = (t: Triangle): Vec3 => {
  const ux = t.b.x - t.a.x
  const uy = t.b.y - t.a.y
  const uz = t.b.z - t.a.z
  const vx = t.c.x - t.a.x
  const vy = t.c.y - t.a.y
  const vz = t.c.z - t.a.z
  return { x: uy * vz - uz * vy, y: uz * vx - ux * vz, z: ux * vy - uy * vx }
}

const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z

type Plane = { n: Vec3; d: number; key: string }

/** The plane of a triangle, with a key that groups triangles a viewer would draw in one place. */
function planeOf(t: Triangle, planeTol: number): Plane | null {
  const n = normalOf(t)
  const len = Math.hypot(n.x, n.y, n.z)
  if (len < 1e-12) return null
  const unit = { x: n.x / len, y: n.y / len, z: n.z / len }
  const d = dot(unit, t.a)
  const q = (v: number): number => Math.round(v * 200) / 200
  const key = `${q(unit.x)},${q(unit.y)},${q(unit.z)}|${Math.round(d / planeTol)}`
  return { n: unit, d, key }
}

type P2 = { u: number; v: number }

/** Project a point onto a plane's 2D chart: the two axes least aligned with the normal. */
function chart(n: Vec3): (p: Vec3) => P2 {
  const ax = Math.abs(n.x)
  const ay = Math.abs(n.y)
  const az = Math.abs(n.z)
  if (ax >= ay && ax >= az) return (p) => ({ u: p.y, v: p.z })
  if (ay >= ax && ay >= az) return (p) => ({ u: p.x, v: p.z })
  return (p) => ({ u: p.x, v: p.y })
}

const polyArea = (poly: readonly P2[]): number => {
  let s = 0
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    s += a.u * b.v - b.u * a.v
  }
  return Math.abs(s) / 2
}

/** Sutherland–Hodgman: the part of `subject` inside convex `clip`. */
function clipPolygon(subject: readonly P2[], clip: readonly P2[]): P2[] {
  let output = [...subject]
  const ccw = polyArea(clip) > 0 && signedArea(clip) > 0
  for (let i = 0; i < clip.length && output.length > 0; i += 1) {
    const a = clip[i]
    const b = clip[(i + 1) % clip.length]
    const input = output
    output = []
    const inside = (p: P2): boolean => {
      const cross = (b.u - a.u) * (p.v - a.v) - (b.v - a.v) * (p.u - a.u)
      return ccw ? cross >= -1e-12 : cross <= 1e-12
    }
    const intersect = (p: P2, q: P2): P2 => {
      const dx1 = q.u - p.u
      const dy1 = q.v - p.v
      const dx2 = b.u - a.u
      const dy2 = b.v - a.v
      const den = dx1 * dy2 - dy1 * dx2
      if (Math.abs(den) < 1e-15) return q
      const t = ((a.u - p.u) * dy2 - (a.v - p.v) * dx2) / den
      return { u: p.u + t * dx1, v: p.v + t * dy1 }
    }
    for (let j = 0; j < input.length; j += 1) {
      const cur = input[j]
      const prev = input[(j + input.length - 1) % input.length]
      const curIn = inside(cur)
      const prevIn = inside(prev)
      if (curIn) {
        if (!prevIn) output.push(intersect(prev, cur))
        output.push(cur)
      } else if (prevIn) output.push(intersect(prev, cur))
    }
  }
  return output
}

const signedArea = (poly: readonly P2[]): number => {
  let s = 0
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    s += a.u * b.v - b.u * a.v
  }
  return s / 2
}

type CoplanarPiece = { area: number; centroid: Vec3; normal: Vec3 }

/** Area two coplanar triangle sets draw over each other, facing the same way. */
function coplanarSameFacingArea(A: readonly Triangle[], B: readonly Triangle[], planeTol: number): number {
  return coplanarSameFacingPieces(A, B, planeTol).reduce((a, p) => a + p.area, 0)
}

/** The overlapping pieces themselves, each with a point on it and the shared outward normal. */
function coplanarSameFacingPieces(A: readonly Triangle[], B: readonly Triangle[], planeTol: number): CoplanarPiece[] {
  const pieces: CoplanarPiece[] = []
  const groups = new Map<string, { n: Vec3; a: Triangle[]; b: Triangle[] }>()
  for (const t of A) {
    const p = planeOf(t, planeTol)
    if (!p) continue
    const g = groups.get(p.key) ?? { n: p.n, a: [], b: [] }
    g.a.push(t)
    groups.set(p.key, g)
  }
  for (const t of B) {
    const p = planeOf(t, planeTol)
    if (!p) continue
    const g = groups.get(p.key)
    if (!g) continue
    g.b.push(t)
  }
  for (const g of groups.values()) {
    if (g.a.length === 0 || g.b.length === 0) continue
    const to2 = chart(g.n)
    const d = dot(g.n, g.a[0].a)
    // Lift a chart point back onto the plane.
    const lift = (q: P2): Vec3 => {
      const ax = Math.abs(g.n.x)
      const ay = Math.abs(g.n.y)
      const az = Math.abs(g.n.z)
      if (ax >= ay && ax >= az) return { x: (d - g.n.y * q.u - g.n.z * q.v) / g.n.x, y: q.u, z: q.v }
      if (ay >= ax && ay >= az) return { x: q.u, y: (d - g.n.x * q.u - g.n.z * q.v) / g.n.y, z: q.v }
      return { x: q.u, y: q.v, z: (d - g.n.x * q.u - g.n.y * q.v) / g.n.z }
    }
    for (const ta of g.a) {
      const pa = [to2(ta.a), to2(ta.b), to2(ta.c)]
      if (polyArea(pa) < 1e-9) continue
      for (const tb of g.b) {
        const pb = [to2(tb.a), to2(tb.b), to2(tb.c)]
        if (polyArea(pb) < 1e-9) continue
        const clipped = clipPolygon(pa, pb)
        if (clipped.length < 3) continue
        const area = polyArea(clipped)
        if (area < 1e-7) continue
        const cu = clipped.reduce((a, q) => a + q.u, 0) / clipped.length
        const cv = clipped.reduce((a, q) => a + q.v, 0) / clipped.length
        pieces.push({ area, centroid: lift({ u: cu, v: cv }), normal: g.n })
      }
    }
  }
  return pieces
}

/** Möller–Trumbore, for the parity test. */
function rayHitsTriangle(o: Vec3, dir: Vec3, t: Triangle): number | null {
  const e1 = { x: t.b.x - t.a.x, y: t.b.y - t.a.y, z: t.b.z - t.a.z }
  const e2 = { x: t.c.x - t.a.x, y: t.c.y - t.a.y, z: t.c.z - t.a.z }
  const p = { x: dir.y * e2.z - dir.z * e2.y, y: dir.z * e2.x - dir.x * e2.z, z: dir.x * e2.y - dir.y * e2.x }
  const det = dot(e1, p)
  if (Math.abs(det) < 1e-12) return null
  const inv = 1 / det
  const s = { x: o.x - t.a.x, y: o.y - t.a.y, z: o.z - t.a.z }
  const u = dot(s, p) * inv
  if (u < -1e-9 || u > 1 + 1e-9) return null
  const q = { x: s.y * e1.z - s.z * e1.y, y: s.z * e1.x - s.x * e1.z, z: s.x * e1.y - s.y * e1.x }
  const v = dot(dir, q) * inv
  if (v < -1e-9 || u + v > 1 + 1e-9) return null
  const dist = dot(e2, q) * inv
  return dist > 1e-9 ? dist : null
}

function containsPoint(tris: readonly Triangle[], p: Vec3): boolean {
  // An odd direction, so no ray runs along a face or through an edge of an axis-aligned solid.
  const dir = { x: 0.3417, y: 0.8123, z: 0.4719 }
  let crossings = 0
  for (const t of tris) if (rayHitsTriangle(p, dir, t) !== null) crossings += 1
  return crossings % 2 === 1
}

/** Volume two solids share, by sampling the overlap of their boxes. */
function sharedVolume(A: readonly Triangle[], bA: Bounds, B: readonly Triangle[], bB: Bounds, step: number): number {
  const x0 = Math.max(bA.min.x, bB.min.x)
  const x1 = Math.min(bA.max.x, bB.max.x)
  const y0 = Math.max(bA.min.y, bB.min.y)
  const y1 = Math.min(bA.max.y, bB.max.y)
  const z0 = Math.max(bA.min.z, bB.min.z)
  const z1 = Math.min(bA.max.z, bB.max.z)
  if (x1 - x0 <= 1e-6 || y1 - y0 <= 1e-6 || z1 - z0 <= 1e-6) return 0
  const nx = Math.max(1, Math.min(24, Math.ceil((x1 - x0) / step)))
  const ny = Math.max(1, Math.min(24, Math.ceil((y1 - y0) / step)))
  const nz = Math.max(1, Math.min(24, Math.ceil((z1 - z0) / step)))
  const cell = ((x1 - x0) / nx) * ((y1 - y0) / ny) * ((z1 - z0) / nz)
  let inside = 0
  for (let i = 0; i < nx; i += 1) {
    const x = x0 + ((i + 0.5) * (x1 - x0)) / nx
    for (let j = 0; j < ny; j += 1) {
      const y = y0 + ((j + 0.5) * (y1 - y0)) / ny
      for (let k = 0; k < nz; k += 1) {
        const z = z0 + ((k + 0.5) * (z1 - z0)) / nz
        const p = { x, y, z }
        if (containsPoint(A, p) && containsPoint(B, p)) inside += 1
      }
    }
  }
  return inside * cell
}

/** Edges used once (open) or more than twice (branched) in a closed solid. */
function manifoldDefects(tris: readonly Triangle[]): number {
  const count = new Map<string, number>()
  const key = (p: Vec3): string => `${Math.round(p.x * 1e5)},${Math.round(p.y * 1e5)},${Math.round(p.z * 1e5)}`
  for (const t of tris) {
    for (const [p, q] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]] as const) {
      const a = key(p)
      const b = key(q)
      const k = a < b ? `${a}|${b}` : `${b}|${a}`
      count.set(k, (count.get(k) ?? 0) + 1)
    }
  }
  let bad = 0
  for (const n of count.values()) if (n !== 2) bad += 1
  return bad
}

function sliverCount(tris: readonly Triangle[]): number {
  let n = 0
  for (const t of tris) {
    const nn = normalOf(t)
    const area = Math.hypot(nn.x, nn.y, nn.z) / 2
    const e = Math.min(Math.hypot(t.b.x - t.a.x, t.b.y - t.a.y, t.b.z - t.a.z), Math.hypot(t.c.x - t.b.x, t.c.y - t.b.y, t.c.z - t.b.z), Math.hypot(t.a.x - t.c.x, t.a.y - t.c.y, t.a.z - t.c.z))
    if (area < 1e-6 || e < 0.0005) n += 1
  }
  return n
}

// ---------------------------------------------------------------------------
// semantics: which meetings are intended
// ---------------------------------------------------------------------------

/**
 * One closed solid: usually one semantic object, but a roof's edge members
 * are solids of their own (`id` is the trim's solid id, `objectId` the roof).
 */
type Solid = { id: string; objectId: string; kind: CompiledMesh['objectKind']; part: CompiledMesh['part']; tris: Triangle[]; bounds: Bounds; levelId?: string }

function solidsOf(scene: CompiledScene, parts: ReadonlyArray<CompiledMesh['part']>): Solid[] {
  const by = new Map<string, Solid>()
  for (const m of scene.meshes) {
    if (!parts.includes(m.part)) continue
    // Reveals belong to the wall's solid; fills and markers are not structure.
    if (m.part === 'WALL_REVEAL' || m.part === 'ROOF_REVEAL') continue
    const key = m.part === 'ROOF_TRIM' ? m.solidId : m.objectId
    const s = by.get(key) ?? { id: key, objectId: m.objectId, kind: m.objectKind, part: m.part, tris: [], bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }, levelId: m.levelId }
    s.tris.push(...m.triangles)
    by.set(key, s)
  }
  // Reveals close the wall solid: add them back to their wall so the parity test sees a closed surface.
  for (const m of scene.meshes) {
    if (m.part !== 'WALL_REVEAL' && m.part !== 'ROOF_REVEAL') continue
    const host = m.part === 'WALL_REVEAL' ? m.hostWallId : m.hostRoofId
    const s = host ? by.get(host) : undefined
    if (s) s.tris.push(...m.triangles)
  }
  for (const s of by.values()) s.bounds = boundsOf(s.tris)
  return [...by.values()].sort((a, b) => (a.id < b.id ? -1 : 1))
}

type Semantics = ReturnType<typeof semanticsOf>

function semanticsOf(model: CanonicalBuildingModel) {
  const walls = new Map(model.walls.map((w) => [w.id, w]))
  const slabs = new Map(model.slabs.map((s) => [s.id, s]))
  const roofs = new Map(model.roofs.map((r) => [r.id, r]))
  const balconies = new Map(model.balconies.map((b) => [b.id, b]))
  const railings = new Map(model.railings.map((r) => [r.id, r]))
  const solids = new Map(model.linearSolids.map((s) => [s.id, s]))
  const chimneys = new Map(model.chimneys.map((c) => [c.id, c]))
  const levels = new Map(model.levels.map((l) => [l.id, l]))
  const stairs = new Map(model.stairs.map((s) => [s.id, s]))
  const terraces = new Map(model.terraces.map((t) => [t.id, t]))
  const junctions = new Set<string>()
  for (const j of model.wallJunctions) {
    const ids = j.kind === 'CORNER' ? [j.a.wallId, j.b.wallId] : [j.wall.wallId, j.againstWallId]
    for (const a of ids) for (const b of ids) if (a !== b) junctions.add(`${a}|${b}`)
  }
  const ringOf = new Map<string, string>()
  for (const ring of model.wallRings) for (const id of ring.wallIds) ringOf.set(id, ring.id)
  const isReturn = (id: string): boolean => /return/i.test(id)
  return { walls, slabs, roofs, balconies, railings, solids, chimneys, levels, stairs, terraces, junctions, ringOf, isReturn }
}

/** The relation the model intends between two solids, and its label. */
function relationOf(a: Solid, b: Solid, s: Semantics): ClosureRelation | null {
  const order = (x: Solid, y: Solid, f: (p: Solid, q: Solid) => ClosureRelation | null): ClosureRelation | null => f(x, y) ?? f(y, x)
  const wallOf = (x: Solid) => s.walls.get(x.id)
  return order(a, b, (p, q) => {
    // walls
    if (p.kind === 'wall' && q.kind === 'wall') {
      const wp = wallOf(p)
      const wq = wallOf(q)
      if (!wp || !wq) return null
      if (s.junctions.has(`${p.id}|${q.id}`)) return { a: p.id, b: q.id, label: s.isReturn(p.id) || s.isReturn(q.id) ? 'WALL<->RETURN_WALL' : 'WALL<->WALL', kind: 'CONTACT', why: 'a declared junction' }
      if (s.ringOf.get(p.id) && s.ringOf.get(p.id) === s.ringOf.get(q.id)) return { a: p.id, b: q.id, label: 'WALL<->WALL', kind: 'CONTACT', why: 'members of one ring meet at its corners' }
      if (s.isReturn(p.id) !== s.isReturn(q.id)) return { a: p.id, b: q.id, label: 'WALL<->RETURN_WALL', kind: 'CONTACT', why: 'a return stands against the ring wall it springs from' }
      if (wp.kind === 'EXTERIOR' && wq.kind === 'EXTERIOR' && s.ringOf.get(p.id) !== s.ringOf.get(q.id) && wp.levelId === wq.levelId) return { a: p.id, b: q.id, label: 'MAIN_MASS<->ATTACHED_MASS', kind: 'CONTACT', why: 'the rings of two bodies share a party face' }
      return { a: p.id, b: q.id, label: 'WALL<->WALL', kind: wp.kind === 'INTERIOR' || wq.kind === 'INTERIOR' ? 'CONTACT' : 'SEPARATION', why: 'walls meet only at their ends' }
    }
    if (p.kind === 'wall' && q.kind === 'slab') return { a: p.id, b: q.id, label: 'WALL<->SLAB', kind: 'BEARING', why: 'a slab bears into the walls under it and the walls above stand on it' }
    if (p.kind === 'roof' && q.kind === 'roof' && p.objectId === q.objectId) return { a: p.id, b: q.id, label: 'TRIM<->ROOF', kind: 'FLUSH', why: 'an edge member of this roof, compiled with it' }
    if (p.kind === 'wall' && q.kind === 'roof' && q.part === 'ROOF_TRIM') {
      const w = wallOf(p)
      const follows = w?.topProfile?.kind === 'FOLLOW_ROOF' && w.topProfile.roofId === q.objectId
      return { a: p.id, b: q.id, label: s.isReturn(p.id) ? 'FACADE_FRAME<->HOST_FACADE' : 'TRIM<->ROOF', kind: follows ? 'CONTACT' : 'SEPARATION', why: follows ? 'the wall top dies into the member’s underside' : 'the wall does not follow this roof' }
    }
    if (p.kind === 'wall' && q.kind === 'roof') {
      const w = wallOf(p)
      const follows = w?.topProfile?.kind === 'FOLLOW_ROOF' && w.topProfile.roofId === q.id
      const r = s.roofs.get(q.id)
      if (r?.kind === 'FLAT' && w?.kind === 'EXTERIOR') return { a: p.id, b: q.id, label: 'PARAPET<->FLAT_ROOF', kind: follows ? 'CONTACT' : 'BEARING', why: follows ? 'the wall stops at the plate' : 'a flat roof plate bears into the walls that carry it; a parapet rises past it' }
      return { a: p.id, b: q.id, label: 'WALL<->ROOF', kind: follows ? 'CONTACT' : 'SEPARATION', why: follows ? 'the wall top follows the roof underside' : 'the wall does not follow this roof' }
    }
    if (p.kind === 'wall' && q.kind === 'balcony') {
      const bal = s.balconies.get(q.id)
      const label: ClosureRelationLabel = bal?.kind === 'TERRACE' ? 'TERRACE<->WALL' : 'BALCONY_SLAB<->WALL'
      return { a: p.id, b: q.id, label, kind: 'CONTACT', why: 'a slab meets the wall it is fixed to and the returns that bound it' }
    }
    if (p.kind === 'wall' && q.kind === 'terrace') return { a: p.id, b: q.id, label: 'TERRACE<->WALL', kind: 'CONTACT', why: 'a terrace meets the facade it lies against' }
    if (p.kind === 'wall' && q.kind === 'linearSolid') {
      const solid = s.solids.get(q.id)
      const hosted = solid?.hostId === p.id
      return { a: p.id, b: q.id, label: 'FACADE_FRAME<->HOST_FACADE', kind: hosted ? 'CONTACT' : 'SEPARATION', why: hosted ? 'the member runs on this wall' : 'a member is not hosted by this wall' }
    }
    if (p.kind === 'wall' && q.kind === 'chimney') return { a: p.id, b: q.id, label: 'CHIMNEY<->WALL', kind: wallOf(p)?.kind === 'INTERIOR' ? 'PENETRATION' : 'SEPARATION', why: 'a stack is built into the partition it stands on' }
    if (p.kind === 'wall' && q.kind === 'stair') return { a: p.id, b: q.id, label: 'OTHER', kind: 'CONTACT', why: 'a flight runs against a wall' }
    // slabs
    if (p.kind === 'slab' && q.kind === 'chimney') return { a: p.id, b: q.id, label: 'CHIMNEY<->SLAB', kind: 'PENETRATION', why: 'a stack passes through every floor' }
    if (p.kind === 'slab' && q.kind === 'stair') return { a: p.id, b: q.id, label: 'STAIR<->SLAB', kind: 'CONTACT', why: 'a stair lands on the slab through its hole' }
    if (p.kind === 'slab' && q.kind === 'balcony') return { a: p.id, b: q.id, label: 'BALCONY_SLAB<->WALL', kind: 'SEPARATION', why: 'a balcony slab is its own plate beside the floor slab' }
    if (p.kind === 'slab' && q.kind === 'slab') return { a: p.id, b: q.id, label: 'OTHER', kind: 'SEPARATION', why: 'one slab per storey and body' }
    // roofs
    if (p.kind === 'roof' && q.kind === 'chimney') return { a: p.id, b: q.id, label: 'CHIMNEY<->ROOF', kind: 'PENETRATION', why: 'a stack pierces the roof' }
    if ((p.kind === 'roof' || p.kind === 'balcony') && q.kind === 'balcony' && p.kind === 'roof') {
      // A roof edge member continuing a balcony slab: one band.
      return { a: p.id, b: q.id, label: 'BALCONY_SLAB<->FASCIA', kind: 'CONTACT', why: 'a roof edge meets a balcony slab end to end' }
    }
    if (p.kind === 'roof' && q.kind === 'linearSolid') {
      const solid = s.solids.get(q.id)
      return { a: p.id, b: q.id, label: 'TRIM<->ROOF', kind: solid?.hostId === p.id ? 'FLUSH' : 'SEPARATION', why: solid?.hostId === p.id ? 'a member along the roof edge' : 'a member the roof does not host' }
    }
    if (p.kind === 'roof' && q.kind === 'roof') return { a: p.id, b: q.id, label: 'MAIN_MASS<->ATTACHED_MASS', kind: 'CONTACT', why: 'two bodies’ roofs may meet along their party line' }
    if (p.kind === 'roof' && (q.kind === 'balcony' || q.kind === 'terrace')) return { a: p.id, b: q.id, label: 'OTHER', kind: 'SEPARATION', why: 'a roof stands clear of the slabs below it' }
    // balconies and members
    if (p.kind === 'balcony' && q.kind === 'linearSolid') return { a: p.id, b: q.id, label: 'BALCONY_SLAB<->FASCIA', kind: 'CONTACT', why: 'a fascia runs along the slab edge' }
    if (p.kind === 'balcony' && q.kind === 'balcony') return { a: p.id, b: q.id, label: 'OTHER', kind: 'SEPARATION', why: 'two slabs' }
    if (p.kind === 'balcony' && q.kind === 'chimney') return { a: p.id, b: q.id, label: 'OTHER', kind: 'SEPARATION', why: 'a stack stands clear of a slab' }
    if (p.kind === 'linearSolid' && q.kind === 'linearSolid') return { a: p.id, b: q.id, label: 'FACADE_FRAME<->HOST_FACADE', kind: 'CONTACT', why: 'members of one frame meet end to end' }
    if (p.kind === 'chimney' && q.kind === 'chimney') return { a: p.id, b: q.id, label: 'OTHER', kind: 'SEPARATION', why: 'two stacks' }
    if (p.kind === 'stair' && q.kind === 'chimney') return { a: p.id, b: q.id, label: 'OTHER', kind: 'SEPARATION', why: 'a stair stands clear of a stack' }
    return null
  })
}

// ---------------------------------------------------------------------------
// the audit
// ---------------------------------------------------------------------------

export function geometryClosureAudit(model: CanonicalBuildingModel, scene: CompiledScene, options: ClosureOptions = {}): ClosureReport {
  const opt = { ...DEFAULTS, ...options }
  const sem = semanticsOf(model)
  const solids = solidsOf(scene, opt.parts)
  const relations: ClosureRelation[] = []
  const findings: ClosureFinding[] = []
  const contacts: ClosureReport['contacts'] = []
  const metrics: ClosureMetrics = { pairsChecked: 0, enclosedCoplanarAreaM2: 0, exteriorFindingCount: 0, interiorFindingCount: 0, intersectionCount: 0, intersectionVolumeM3: 0, coplanarDuplicateCount: 0, coplanarDuplicateAreaM2: 0, gapCount: 0, sliverTriangleCount: 0, nonManifoldSolidCount: 0, disconnectedMemberCount: 0, railingFreeEndCount: 0, railingEndDistanceMaxM: 0, terraceAlignmentResidualM: 0 }

  for (let i = 0; i < solids.length; i += 1) {
    for (let j = i + 1; j < solids.length; j += 1) {
      const A = solids[i]
      const B = solids[j]
      const near = (pad: number): boolean =>
        overlap1(A.bounds.min.x - pad, A.bounds.max.x + pad, B.bounds.min.x, B.bounds.max.x) > 0 &&
        overlap1(A.bounds.min.y - pad, A.bounds.max.y + pad, B.bounds.min.y, B.bounds.max.y) > 0 &&
        overlap1(A.bounds.min.z - pad, A.bounds.max.z + pad, B.bounds.min.z, B.bounds.max.z) > 0
      if (!near(opt.gapSearchM)) continue
      if (!near(opt.planeToleranceM)) {
        // Apart, but close: a gap, if the model says these two meet.
        const rel = relationOf(A, B, sem)
        if (!rel || !MEETS.has(rel.kind) || !DECLARED_MEETINGS.has(rel.label)) continue
        const gap = Math.min(meshDistance(A.tris, B.tris), meshDistance(B.tris, A.tris))
        if (gap > opt.planeToleranceM && gap <= opt.gapSearchM) {
          metrics.gapCount += 1
          findings.push({ code: 'GAP', severity: 'ERROR', scope: scopeOf(A, B, sem), objects: [A.id, B.id], relation: rel.label, intended: rel.kind, measure: round4(gap), unit: 'm', message: `${A.id} and ${B.id} stand ${gap.toFixed(3)} m apart where the model says they meet (${rel.why}): a visible crack` })
        }
        continue
      }
      metrics.pairsChecked += 1
      const rel = relationOf(A, B, sem) ?? { a: A.id, b: B.id, label: 'OTHER' as const, kind: 'SEPARATION' as const, why: 'no relation the model states' }
      relations.push(rel)
      const volume = sharedVolume(A.tris, A.bounds, B.tris, B.bounds, opt.sampleStepM)
      // Only what a viewer can draw counts as a duplicate: a piece lying under
      // a third solid (its outward side inside that solid) is enclosed.
      let coplanar = 0
      for (const piece of coplanarSameFacingPieces(A.tris, B.tris, opt.planeToleranceM)) {
        const probe = { x: piece.centroid.x + piece.normal.x * 0.004, y: piece.centroid.y + piece.normal.y * 0.004, z: piece.centroid.z + piece.normal.z * 0.004 }
        const enclosed = solids.some((o) => o !== A && o !== B && probe.x >= o.bounds.min.x && probe.x <= o.bounds.max.x && probe.y >= o.bounds.min.y && probe.y <= o.bounds.max.y && probe.z >= o.bounds.min.z && probe.z <= o.bounds.max.z && containsPoint(o.tris, probe))
        if (enclosed) metrics.enclosedCoplanarAreaM2 += piece.area
        else coplanar += piece.area
      }
      const scope = scopeOf(A, B, sem)
      if (volume > opt.volumeToleranceM3 || coplanar > opt.coplanarToleranceM2) contacts.push({ a: A.id, b: B.id, relation: rel.label, intended: rel.kind, volumeM3: round4(volume), coplanarM2: round4(coplanar) })
      const allowed = rel.kind === 'BEARING' ? bearingAllowance(A, B, sem) : 0
      if (volume > Math.max(opt.volumeToleranceM3, allowed) && rel.kind !== 'PENETRATION') {
        metrics.intersectionCount += 1
        metrics.intersectionVolumeM3 += volume
        findings.push({ code: 'INTERSECTION', severity: rel.kind === 'SEPARATION' || rel.kind === 'CONTACT' || rel.kind === 'BEARING' ? 'ERROR' : 'WARNING', scope, objects: [A.id, B.id], relation: rel.label, intended: rel.kind, measure: round4(volume), unit: 'm3', message: `${A.id} and ${B.id} share ${volume.toFixed(3)} m³; the model intends ${rel.kind.toLowerCase()} (${rel.why})${allowed > 0 ? `; a bearing may take ${allowed.toFixed(3)} m³` : ''}` })
      }
      if (coplanar > opt.coplanarToleranceM2 && rel.kind !== 'FLUSH') {
        metrics.coplanarDuplicateCount += 1
        metrics.coplanarDuplicateAreaM2 += coplanar
        findings.push({ code: 'COPLANAR_DUPLICATE', severity: rel.kind === 'PENETRATION' ? 'WARNING' : 'ERROR', scope, objects: [A.id, B.id], relation: rel.label, intended: rel.kind, measure: round4(coplanar), unit: 'm2', message: `${A.id} and ${B.id} draw ${coplanar.toFixed(3)} m² of face in one plane facing the same way: a viewer flickers there` })
      }
    }
  }

  // Per-solid soundness.
  for (const s of solids) {
    const slivers = sliverCount(s.tris)
    if (slivers > 0) {
      metrics.sliverTriangleCount += slivers
      findings.push({ code: 'SLIVER_TRIANGLES', severity: 'WARNING', scope: solidScope(s, sem), objects: [s.id], measure: slivers, unit: 'count', message: `${s.id} carries ${slivers} sliver triangle${slivers === 1 ? '' : 's'} (area under 1 mm² or an edge under 0.5 mm)` })
    }
    const open = manifoldDefects(s.tris)
    if (open > 0) {
      metrics.nonManifoldSolidCount += 1
      findings.push({ code: 'NON_MANIFOLD', severity: 'WARNING', scope: solidScope(s, sem), objects: [s.id], measure: open, unit: 'count', message: `${s.id} has ${open} edge${open === 1 ? '' : 's'} not shared by exactly two triangles` })
    }
  }

  // Railings: on their base, ending at something.
  const railingEnds: Array<{ id: string; p: { x: number; z: number }; y: number }> = []
  for (const r of model.railings) {
    const level = sem.levels.get(r.levelId)
    if (!level) continue
    const baseY = level.elevation + r.baseOffset
    const host = r.hostId ? sem.balconies.get(r.hostId) ?? sem.terraces.get(r.hostId) : undefined
    if (host) {
      const hostLevel = sem.levels.get(host.levelId)
      const top = (hostLevel?.elevation ?? 0) + host.topOffset
      const off = Math.abs(baseY - top)
      if (off > 0.02) findings.push({ code: 'RAILING_OFF_BASE', severity: 'ERROR', scope: 'EXTERIOR', objects: [r.id, r.hostId as string], relation: 'RAILING<->BALCONY', intended: 'GUARDS', measure: round4(off), unit: 'm', message: `${r.id} stands ${off.toFixed(3)} m off the top of ${r.hostId}` })
      relations.push({ a: r.id, b: r.hostId as string, label: 'RAILING<->BALCONY', kind: 'GUARDS', why: 'a railing guards the slab it names' })
    }
    const path = r.path && r.path.length >= 2 ? r.path : [r.start, r.end]
    railingEnds.push({ id: r.id, p: path[0], y: baseY }, { id: r.id, p: path[path.length - 1], y: baseY })
  }
  const wallFaces = model.walls.filter((w) => w.kind === 'EXTERIOR')
  const distanceToWall = (p: { x: number; z: number }, y: number): number => {
    let best = Infinity
    for (const w of wallFaces) {
      const level = sem.levels.get(w.levelId)
      if (!level) continue
      const y0 = level.elevation + w.baseOffset
      if (y < y0 - 0.05 || y > y0 + w.height + 0.05) continue
      // Distance to the wall's plan rectangle (outer line and its thickness inward).
      const dx = w.end.x - w.start.x
      const dz = w.end.z - w.start.z
      const L = Math.hypot(dx, dz)
      if (L < 1e-9) continue
      const ux = dx / L
      const uz = dz / L
      const rx = p.x - w.start.x
      const rz = p.z - w.start.z
      const along = rx * ux + rz * uz
      // Inward from the outer face, as the model defines it: (-u.z, u.x). The material is across ∈ [0, thickness].
      const across = rx * -uz + rz * ux
      const dAlong = along < 0 ? -along : along > L ? along - L : 0
      const dAcross = across < 0 ? -across : across > w.thickness ? across - w.thickness : 0
      best = Math.min(best, Math.hypot(dAlong, dAcross))
    }
    return best
  }
  for (const e of railingEnds) {
    const toWall = distanceToWall(e.p, e.y + 0.3)
    const toOther = Math.min(Infinity, ...railingEnds.filter((o) => o.id !== e.id && Math.abs(o.y - e.y) < 0.05).map((o) => Math.hypot(o.p.x - e.p.x, o.p.z - e.p.z)))
    const d = Math.min(toWall, toOther)
    metrics.railingEndDistanceMaxM = Math.max(metrics.railingEndDistanceMaxM, Number.isFinite(d) ? d : 0)
    if (d > opt.railingEndToleranceM) {
      metrics.railingFreeEndCount += 1
      findings.push({ code: 'RAILING_END_FREE', severity: 'ERROR', scope: 'EXTERIOR', objects: [e.id], relation: 'RAILING<->BALCONY', intended: 'GUARDS', measure: round4(d), unit: 'm', message: `${e.id} ends at (${e.p.x.toFixed(2)}, ${e.p.z.toFixed(2)}) ${Number.isFinite(d) ? d.toFixed(2) : '∞'} m from any wall or other railing: a free end` })
    }
  }

  // Terraces: at the exterior floor datum, against their facade.
  for (const t of sem.terraces.values()) {
    const level = sem.levels.get(t.levelId)
    if (!level) continue
    const top = level.elevation + t.topOffset
    const residual = Math.abs(top - level.elevation)
    metrics.terraceAlignmentResidualM = Math.max(metrics.terraceAlignmentResidualM, residual)
    if (residual > 0.05) findings.push({ code: 'TERRACE_MISALIGNED', severity: 'WARNING', scope: 'EXTERIOR', objects: [t.id], relation: 'TERRACE<->EXTERIOR_FLOOR_DATUM', intended: 'CONTACT', measure: round4(residual), unit: 'm', message: `${t.id} lies ${residual.toFixed(3)} m off the finished floor it serves` })
  }

  // Members that touch nothing: a facade frame member must meet its host or another member.
  const memberIds = new Set([...model.linearSolids.map((s) => s.id)])
  for (const id of memberIds) {
    const touched = contacts.some((c) => (c.a === id || c.b === id) && (c.volumeM3 > 0 || c.coplanarM2 > 0)) || relations.some((r) => (r.a === id || r.b === id) && r.kind !== 'SEPARATION' && solids.some((s) => s.id === (r.a === id ? r.b : r.a)))
    const solid = solids.find((s) => s.id === id)
    if (!solid) continue
    // Touch = bounds within tolerance of some other solid's bounds.
    const near = solids.some((o) => o.id !== id && overlap1(solid.bounds.min.x - 0.02, solid.bounds.max.x + 0.02, o.bounds.min.x, o.bounds.max.x) > 0 && overlap1(solid.bounds.min.y - 0.02, solid.bounds.max.y + 0.02, o.bounds.min.y, o.bounds.max.y) > 0 && overlap1(solid.bounds.min.z - 0.02, solid.bounds.max.z + 0.02, o.bounds.min.z, o.bounds.max.z) > 0)
    if (!near && !touched) {
      metrics.disconnectedMemberCount += 1
      findings.push({ code: 'MEMBER_DISCONNECTED', severity: 'WARNING', scope: 'EXTERIOR', objects: [id], relation: 'FACADE_FRAME<->HOST_FACADE', intended: 'CONTACT', measure: 1, unit: 'count', message: `${id} touches no other solid` })
    }
  }

  metrics.enclosedCoplanarAreaM2 = round4(metrics.enclosedCoplanarAreaM2)
  metrics.exteriorFindingCount = findings.filter((f) => f.scope === 'EXTERIOR' && f.severity !== 'INFO').length
  metrics.interiorFindingCount = findings.filter((f) => f.scope === 'INTERIOR' && f.severity !== 'INFO').length
  metrics.intersectionVolumeM3 = round4(metrics.intersectionVolumeM3)
  metrics.coplanarDuplicateAreaM2 = round4(metrics.coplanarDuplicateAreaM2)
  metrics.railingEndDistanceMaxM = round4(metrics.railingEndDistanceMaxM)
  metrics.terraceAlignmentResidualM = round4(metrics.terraceAlignmentResidualM)
  findings.sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || b.measure - a.measure)
  return { schema: 'buildapp.geometry-closure-report', schemaVersion: '1.0.0', modelId: model.id, relations, findings, metrics, contacts }
}

/**
 * How much volume a plate may share with a wall it bears into: the wall's
 * thickness by the plate's thickness by the length the two run together.
 * More than that and the plate is not bearing but passing through.
 */
function bearingAllowance(a: Solid, b: Solid, sem: Semantics): number {
  const wallSolid = a.kind === 'wall' ? a : b.kind === 'wall' ? b : undefined
  const plate = wallSolid === a ? b : a
  const wall = wallSolid ? sem.walls.get(wallSolid.id) : undefined
  if (!wall || !wallSolid) return 0
  const plateThickness = plate.kind === 'slab' ? sem.slabs.get(plate.id)?.thickness ?? 0 : plate.kind === 'roof' ? sem.roofs.get(plate.id)?.thickness ?? 0 : plate.bounds.max.y - plate.bounds.min.y
  const runX = overlap1(wallSolid.bounds.min.x, wallSolid.bounds.max.x, plate.bounds.min.x, plate.bounds.max.x)
  const runZ = overlap1(wallSolid.bounds.min.z, wallSolid.bounds.max.z, plate.bounds.min.z, plate.bounds.max.z)
  const run = Math.max(runX, runZ)
  return wall.thickness * plateThickness * run * 1.02
}

/** Whether a solid is part of what is seen from outside: exterior walls, roofs and their trims, slabs' edges, balconies, terraces, members. */
function solidScope(s: Solid, sem: Semantics): 'EXTERIOR' | 'INTERIOR' {
  if (s.kind === 'stair' || s.kind === 'room') return 'INTERIOR'
  if (s.kind === 'wall') return sem.walls.get(s.id)?.kind === 'INTERIOR' ? 'INTERIOR' : 'EXTERIOR'
  return 'EXTERIOR'
}

/**
 * A meeting is exterior when both solids are exterior ones; a meeting in
 * which either is an interior object (a partition, a stair) happens inside
 * the envelope. A chimney meets partitions inside and the roof outside.
 */
function scopeOf(a: Solid, b: Solid, sem: Semantics): 'EXTERIOR' | 'INTERIOR' {
  const sa = solidScope(a, sem)
  const sb = solidScope(b, sem)
  if (sa === 'INTERIOR' || sb === 'INTERIOR') return 'INTERIOR'
  return 'EXTERIOR'
}

/** Relations under which two solids are meant to touch. */
const MEETS = new Set<ClosureRelationKind>(['CONTACT', 'BEARING', 'FLUSH'])

/**
 * The meetings the model states outright — a junction, a ring, a wall that
 * follows a roof, a slab fixed to a wall, a member on its host — as opposed
 * to the ones a relation merely permits. Only these can show a gap.
 */
const DECLARED_MEETINGS = new Set<ClosureRelationLabel>(['WALL<->WALL', 'WALL<->RETURN_WALL', 'WALL<->SLAB', 'WALL<->ROOF', 'MAIN_MASS<->ATTACHED_MASS', 'BALCONY_SLAB<->WALL', 'BALCONY_SLAB<->FASCIA', 'FACADE_FRAME<->HOST_FACADE', 'TERRACE<->WALL', 'PARAPET<->FLAT_ROOF', 'TRIM<->ROOF'])

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })

/** Distance from a point to a triangle (Ericson, Real-Time Collision Detection, 5.1.5). */
function pointTriangleDistance(p: Vec3, t: Triangle): number {
  const { a, b, c } = t
  const ab = sub(b, a)
  const ac = sub(c, a)
  const ap = sub(p, a)
  const d1 = dot(ab, ap)
  const d2 = dot(ac, ap)
  const at = (q: Vec3): number => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z)
  if (d1 <= 0 && d2 <= 0) return at(a)
  const bp = sub(p, b)
  const d3 = dot(ab, bp)
  const d4 = dot(ac, bp)
  if (d3 >= 0 && d4 <= d3) return at(b)
  const vc = d1 * d4 - d3 * d2
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3)
    return at({ x: a.x + ab.x * v, y: a.y + ab.y * v, z: a.z + ab.z * v })
  }
  const cp = sub(p, c)
  const d5 = dot(ab, cp)
  const d6 = dot(ac, cp)
  if (d6 >= 0 && d5 <= d6) return at(c)
  const vb = d5 * d2 - d1 * d6
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6)
    return at({ x: a.x + ac.x * w, y: a.y + ac.y * w, z: a.z + ac.z * w })
  }
  const va = d3 * d6 - d5 * d4
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6))
    return at({ x: b.x + (c.x - b.x) * w, y: b.y + (c.y - b.y) * w, z: b.z + (c.z - b.z) * w })
  }
  const denom = 1 / (va + vb + vc)
  const v = vb * denom
  const w = vc * denom
  return at({ x: a.x + ab.x * v + ac.x * w, y: a.y + ab.y * v + ac.y * w, z: a.z + ab.z * v + ac.z * w })
}

/** The least distance from any vertex of A to any triangle of B. */
function meshDistance(A: readonly Triangle[], B: readonly Triangle[]): number {
  let best = Infinity
  for (const t of A) for (const p of [t.a, t.b, t.c]) for (const u of B) best = Math.min(best, pointTriangleDistance(p, u))
  return best
}

const severityRank = (s: ClosureFinding['severity']): number => (s === 'ERROR' ? 0 : s === 'WARNING' ? 1 : 2)
const round4 = (v: number): number => Math.round(v * 1e4) / 1e4
