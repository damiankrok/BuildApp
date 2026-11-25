/**
 * v3.54.21 — a ROOF SYSTEM: the pitched roofs of a house solved together, for LOCAL and for a body built from a read.
 *
 * Until now a house's roofs were composed in two places that did not know of each other. The drawings' solver joined a
 * wing's gable to the main gable (`attachedGableLayout`, `valleyCutMainRoof`) within a stated scope — two gables, the
 * wing's valleys starting on the main eave, no overhang; the body built from a structure read put one complete roof over
 * every rectangle of walls and joined nothing (a wing's roof ended on the party line, in the air over the main slope).
 * This module states the roof as what it is — REGIONS, each with its own identity, host, extent and parameters — and
 * computes how they meet, deterministically:
 *
 *   - a region's own surface is the LOWER envelope of its planes (two slopes of a gable; four of a hip);
 *   - the house's roof is the UPPER envelope of its regions' surfaces: where two regions cover the same ground, the one
 *     standing higher is the roof there, and the line where they stand level is their crease — a VALLEY where the roof
 *     folds inwards. Nobody has to state a valley's ends: they are where two planes meet;
 *   - a region whose ridge ends on another region's side, and does not stand above that region's ridge, RUNS ON over
 *     it (as an intersecting gable is built) as far as that region's ridge line; everything of it that lies under the
 *     other roof is cut away, and so is the other roof under it. A region that would show nothing there (its ridge
 *     under the other's eaves) simply ABUTS: nothing is forced into a valley;
 *   - a region need not be the roof of a rectangle of walls. A cross gable over one body (`over`) is a region inside
 *     another's extent: the outline has no step, the roof has two ridges.
 *
 * Nothing here knows a source, a house or an API. The caller states regions; the solver returns the visible polygon of
 * every plane, the creases between them with their kinds and end heights, how each pair of regions meets and why, and
 * the adjustments it made within the stated tolerances (never silently).
 *
 * Scope, by name: gable and hip regions over axis-parallel rectangles. Flat roofs are not regions (they do not join).
 * Overhangs are not laid out here; a region with eaves standing more than `CHEEK_FREE_M` above the roof it runs over
 * shows a cheek the model does not build (reported per relation as `cheekM`).
 */
import { round6 } from '@buildapp/source-common'
import type { PlanBox, Vec2 } from './attached-roof-form.js'

export const ROOF_SYSTEM_VERSION = '1.0.1' as const

export type RoofRegionKind = 'GABLE' | 'HIP'
export type RoofRegion = {
  /** Stable identity of the roof region (it survives regeneration; planes are named under it). */
  id: string
  /** The body (ring of walls) that carries it. A cross gable is carried by the body of the region it stands over. */
  hostBodyId: string
  /** The region's own extent on its walls, in plan. */
  rect: PlanBox
  kind: RoofRegionKind
  ridgeAxis: 'X' | 'Z'
  /** The top surface at the wall face along the eaves (world y). */
  eaveY: number
  /** The ridge (world y). */
  ridgeY: number
  /** A hip: how far each ridge end stands in from its end wall (default: half the span, one pitch all round). */
  hipRunM?: number
  thicknessM: number
  /** A region standing inside another region's extent, on the same walls (a cross gable with no step of the outline). */
  over?: string
  /** Regions this one must not be joined with (the source draws a wall between them): it stops at the party line. */
  separateFrom?: readonly string[]
}

export type RoofPlaneKey = 'LOW' | 'HIGH' | 'END_MIN' | 'END_MAX'
export type DrainSide = 'minX' | 'maxX' | 'minZ' | 'maxZ'
export type SolvedPlane = {
  id: string
  regionId: string
  key: RoofPlaneKey
  /** The plan side the plane falls towards. */
  drains: DrainSide
  boundary: Vec2[]
  datum: { x: number; y: number; z: number }
  pitchDeg: number
  downslope: Vec2
  thicknessM: number
}
export type RoofCreaseKind = 'RIDGE' | 'HIP' | 'VALLEY'
export type SolvedCrease = { id: string; kind: RoofCreaseKind; planeIds: [string, string]; regionIds: [string, string]; start: Vec2; end: Vec2; startY: number; endY: number; /** the two top surfaces' distance at the two ends (0 for a crease) */ gapM: number }
export type SolvedFreeEdge = { id: string; kind: 'EAVE' | 'VERGE' | 'ABUTMENT' | 'BOUNDARY'; planeId: string; regionId: string; start: Vec2; end: Vec2 }
export type RoofRelationKind = 'VALLEY' | 'ABUTMENT' | 'SEPARATE' | 'CROSS_GABLE' | 'IN_LINE'
export type RoofRelation = {
  /** The region whose ridge ends at the other (or the region standing over the other). */
  a: string
  b: string
  kind: RoofRelationKind
  why: string
  /** How far `a` was run on over `b` (metres along its ridge), where it was. */
  extendedM?: number
  /** `a`'s eaves above `b`'s surface where it leaves `b`'s wall: the height of a cheek the model does not build. */
  cheekM?: number
}
export type RoofAdjustment = { regionId: string; property: 'ridgeY' | 'eaveY'; from: number; to: number; why: string }
export type RoofViolation = { regionId: string; property: 'pitchDeg' | 'ridgeY' | 'rect'; value: number; why: string }
export type SolvedRegion = { id: string; hostBodyId: string; kind: RoofRegionKind; ridgeAxis: 'X' | 'Z'; rect: PlanBox; eaveY: number; ridgeY: number; pitchDeg: number; endPitchDeg?: number; hipRunM?: number; planeIds: string[]; /** this region is laid out in planes with others (it meets one of them over common ground) */ joined: boolean }
export type RoofSystemSolution = {
  version: string
  regions: SolvedRegion[]
  planes: SolvedPlane[]
  creases: SolvedCrease[]
  freeEdges: SolvedFreeEdge[]
  relations: RoofRelation[]
  adjustments: RoofAdjustment[]
  violations: RoofViolation[]
}

/** Tolerances, fixed before any result. */
export const ROOF_SYSTEM_TOLERANCES = {
  /** Two rectangles share a line within this (metres). */
  touchM: 0.05,
  /** A ridge read this little above the ridge it runs into is at that ridge (metres): the two meet in a point, not in a step. */
  ridgeSnapM: 0.25,
  /** Eaves read this close to the eaves of the roof they run over are level with them (metres): the valleys start in the corner. */
  eaveSnapM: 0.25,
  /** A region's ridge must stand at least this far above the other's eaves to show over its slope at all (metres). */
  showM: 0.1,
  /** A cheek lower than this is not reported (metres). */
  cheekFreeM: 0.3,
  /** A pitched roof region is neither flatter nor steeper than this (degrees): outside, the parameters are not one roof's. */
  minPitchDeg: 8,
  maxPitchDeg: 62,
  /** Polygons smaller than this are nothing (m²); points nearer than this are one (m). */
  areaEps: 1e-5,
  pointEps: 2e-5,
} as const

// ---------------------------------------------------------------------------
// Plane arithmetic and convex polygons
// ---------------------------------------------------------------------------

type Lin = { c: number; gx: number; gz: number }
const at = (l: Lin, p: Vec2): number => l.c + l.gx * p.x + l.gz * p.z
const sub = (a: Lin, b: Lin): Lin => ({ c: a.c - b.c, gx: a.gx - b.gx, gz: a.gz - b.gz })
const areaOf = (poly: readonly Vec2[]): number => {
  let s = 0
  for (let i = 0; i < poly.length; i += 1) { const [a, b] = [poly[i], poly[(i + 1) % poly.length]]; s += a.x * b.z - b.x * a.z }
  return s / 2
}
const boxPoly = (b: PlanBox): Vec2[] => [{ x: b.x0, z: b.z0 }, { x: b.x1, z: b.z0 }, { x: b.x1, z: b.z1 }, { x: b.x0, z: b.z1 }]
const samePoint = (a: Vec2, b: Vec2, eps: number = ROOF_SYSTEM_TOLERANCES.pointEps): boolean => Math.abs(a.x - b.x) <= eps && Math.abs(a.z - b.z) <= eps
const dedupe = (poly: Vec2[]): Vec2[] => poly.filter((p, i) => !samePoint(p, poly[(i + poly.length - 1) % poly.length]))

/** A polygon without corners on a straight run and without spikes (an edge walked out and straight back). */
function tidy(poly: Vec2[]): Vec2[] {
  let v = dedupe(poly)
  for (let changed = true; changed && v.length >= 3; ) {
    changed = false
    for (let i = 0; i < v.length; i += 1) {
      const [a, q, b] = [v[(i + v.length - 1) % v.length], v[i], v[(i + 1) % v.length]]
      const cross = (q.x - a.x) * (b.z - q.z) - (q.z - a.z) * (b.x - q.x)
      if (Math.abs(cross) <= ROOF_SYSTEM_TOLERANCES.pointEps * Math.max(Math.hypot(q.x - a.x, q.z - a.z), Math.hypot(b.x - q.x, b.z - q.z))) { v = dedupe(v.filter((_, k) => k !== i)); changed = true; break }
    }
  }
  return v.length >= 3 && Math.abs(areaOf(v)) > ROOF_SYSTEM_TOLERANCES.areaEps ? v : []
}

/** A convex polygon cut to the half-plane `f ≥ 0` (Sutherland–Hodgman; the subject is convex, so is the result). */
function clipHalf(poly: readonly Vec2[], f: Lin): Vec2[] {
  if (poly.length === 0) return []
  const out: Vec2[] = []
  for (let i = 0; i < poly.length; i += 1) {
    const [a, b] = [poly[i], poly[(i + 1) % poly.length]]
    const [fa, fb] = [at(f, a), at(f, b)]
    if (fa >= 0) out.push(a)
    if ((fa > 0 && fb < 0) || (fa < 0 && fb > 0)) { const k = fa / (fa - fb); out.push({ x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k }) }
  }
  const d = dedupe(out)
  return d.length >= 3 && Math.abs(areaOf(d)) > ROOF_SYSTEM_TOLERANCES.areaEps ? d : []
}
/** The half-plane to the left of the directed edge a → b, as `f ≥ 0` (a counter-clockwise polygon's inside). */
const leftOf = (a: Vec2, b: Vec2): Lin => ({ gx: -(b.z - a.z), gz: b.x - a.x, c: (b.z - a.z) * a.x - (b.x - a.x) * a.z })
const neg = (l: Lin): Lin => ({ c: -l.c, gx: -l.gx, gz: -l.gz })
const ccw = (poly: Vec2[]): Vec2[] => (areaOf(poly) < 0 ? [...poly].reverse() : poly)

/** A convex polygon less a convex polygon, as convex pieces with disjoint insides (each: inside the subject, outside one edge of the cutter, inside the edges before it). */
function subtractConvex(subject: readonly Vec2[], cutter: readonly Vec2[]): Vec2[][] {
  const k = ccw([...cutter])
  if (k.length < 3) return [[...subject]]
  // the two do not overlap: nothing to take
  let inter: Vec2[] = [...subject]
  for (let i = 0; i < k.length && inter.length > 0; i += 1) inter = clipHalf(inter, leftOf(k[i], k[(i + 1) % k.length]))
  if (inter.length === 0) return [[...subject]]
  const pieces: Vec2[][] = []
  let rest: Vec2[] = [...subject]
  for (let i = 0; i < k.length && rest.length > 0; i += 1) {
    const edge = leftOf(k[i], k[(i + 1) % k.length])
    const out = clipHalf(rest, neg(edge))
    if (out.length > 0) pieces.push(out)
    rest = clipHalf(rest, edge)
  }
  return pieces
}

/**
 * Convex pieces with disjoint insides merged into the simple polygons they make together: every piece's edges are split
 * at the other pieces' corners, an edge walked both ways is inside and dropped, and what is left is chained into loops
 * (at a point two loops share, the walk turns as far left as it can, so they stay two polygons). Undefined when a loop is
 * a hole: the caller then keeps the convex pieces.
 */
function mergePieces(pieces: Vec2[][]): Vec2[][] | undefined {
  const eps = ROOF_SYSTEM_TOLERANCES.pointEps
  const snap = (p: Vec2): Vec2 => ({ x: round6(p.x), z: round6(p.z) })
  const polys = pieces.map((p) => dedupe(ccw(p.map(snap)))).filter((p) => p.length >= 3)
  if (polys.length <= 1) return polys
  const corners = polys.flat()
  type Edge = { a: Vec2; b: Vec2 }
  const edges: Edge[] = []
  for (const poly of polys) {
    for (let i = 0; i < poly.length; i += 1) {
      const [a, b] = [poly[i], poly[(i + 1) % poly.length]]
      const len = Math.hypot(b.x - a.x, b.z - a.z)
      if (len <= eps) continue
      // the other pieces' corners that lie on this edge split it
      const on = corners.map((q) => ({ q, t: ((q.x - a.x) * (b.x - a.x) + (q.z - a.z) * (b.z - a.z)) / (len * len) })).filter(({ q, t }) => t > eps / len && t < 1 - eps / len && Math.abs((q.x - a.x) * (b.z - a.z) - (q.z - a.z) * (b.x - a.x)) / len <= eps).sort((p, q) => p.t - q.t)
      const chain = [a, ...on.map((o) => o.q), b]
      for (let j = 0; j + 1 < chain.length; j += 1) if (!samePoint(chain[j], chain[j + 1])) edges.push({ a: chain[j], b: chain[j + 1] })
    }
  }
  const key = (p: Vec2): string => `${Math.round(p.x / eps / 2)}:${Math.round(p.z / eps / 2)}`
  const alive = edges.map(() => true)
  for (let i = 0; i < edges.length; i += 1) {
    if (!alive[i]) continue
    for (let j = i + 1; j < edges.length; j += 1) if (alive[j] && samePoint(edges[i].a, edges[j].b) && samePoint(edges[i].b, edges[j].a)) { alive[i] = false; alive[j] = false; break }
  }
  const left = edges.filter((_, i) => alive[i])
  const from = new Map<string, Edge[]>()
  for (const e of left) from.set(key(e.a), [...(from.get(key(e.a)) ?? []), e])
  const used = new Set<Edge>()
  const loops: Vec2[][] = []
  for (const start of left) {
    if (used.has(start)) continue
    const loop: Vec2[] = []
    let e: Edge | undefined = start
    for (let guard = 0; e && !used.has(e) && guard < 10000; guard += 1) {
      used.add(e)
      loop.push(e.a)
      const cur: Edge = e
      const next: Edge[] = (from.get(key(cur.b)) ?? []).filter((n) => !used.has(n) || n === start)
      if (next.length === 0) return undefined
      // the furthest left turn first: a point shared by two loops does not weld them
      const turn = (n: Edge): number => Math.atan2((cur.b.x - cur.a.x) * (n.b.z - n.a.z) - (cur.b.z - cur.a.z) * (n.b.x - n.a.x), (cur.b.x - cur.a.x) * (n.b.x - n.a.x) + (cur.b.z - cur.a.z) * (n.b.z - n.a.z))
      e = [...next].sort((p, q) => turn(q) - turn(p))[0]
      if (e === start) break
    }
    // corners on a straight run are not corners
    const clean = dedupe(loop).filter((p, i, v) => { const [a, b] = [v[(i + v.length - 1) % v.length], v[(i + 1) % v.length]]; return Math.abs((p.x - a.x) * (b.z - a.z) - (p.z - a.z) * (b.x - a.x)) > eps * Math.hypot(b.x - a.x, b.z - a.z) })
    if (clean.length < 3) continue
    const s = areaOf(clean)
    if (s < -ROOF_SYSTEM_TOLERANCES.areaEps) return undefined
    if (s > ROOF_SYSTEM_TOLERANCES.areaEps) loops.push(clean)
  }
  return loops
}

// ---------------------------------------------------------------------------
// Regions as planes
// ---------------------------------------------------------------------------

type RPlane = { key: RoofPlaneKey; drains: DrainSide; lin: Lin; tan: number; downslope: Vec2; datum: { x: number; y: number; z: number } }
type Laid = { region: RoofRegion; index: number; domain: PlanBox; planes: RPlane[]; half: number; run: number; eaveY: number; ridgeY: number; /** the ends of the ridge that are not a hip end: it runs on, or stops at a party line */ openEnd: { min: boolean; max: boolean } }

const frame = (r: { rect: PlanBox; ridgeAxis: 'X' | 'Z' }): { u0: number; u1: number; t0: number; t1: number } => (r.ridgeAxis === 'Z' ? { u0: r.rect.x0, u1: r.rect.x1, t0: r.rect.z0, t1: r.rect.z1 } : { u0: r.rect.z0, u1: r.rect.z1, t0: r.rect.x0, t1: r.rect.x1 })
const deg = (tan: number): number => Math.round(((Math.atan(tan) * 180) / Math.PI) * 1e4) / 1e4

function layRegion(region: RoofRegion, index: number, eaveY: number, ridgeY: number, domain: PlanBox, openEnd: { min: boolean; max: boolean }): Laid {
  const { u0, u1, t0, t1 } = frame(region)
  const axisZ = region.ridgeAxis === 'Z'
  const half = (u1 - u0) / 2
  const tan = Math.max(1e-6, (ridgeY - eaveY) / half)
  // h = e + (u − u0)·tan, written in x and z
  const linU = (e: number, uAt: number, slope: number): Lin => (axisZ ? { c: e - slope * uAt, gx: slope, gz: 0 } : { c: e - slope * uAt, gx: 0, gz: slope })
  const linT = (e: number, tAt: number, slope: number): Lin => (axisZ ? { c: e - slope * tAt, gx: 0, gz: slope } : { c: e - slope * tAt, gx: slope, gz: 0 })
  const W = (u: number, t: number): { x: number; y: number; z: number } => (axisZ ? { x: round6(u), y: round6(eaveY), z: round6(t) } : { x: round6(t), y: round6(eaveY), z: round6(u) })
  const D = (du: number, dt: number): Vec2 => (axisZ ? { x: du, z: dt } : { x: dt, z: du })
  const [uLo, uHi, tLo, tHi]: DrainSide[] = axisZ ? ['minX', 'maxX', 'minZ', 'maxZ'] : ['minZ', 'maxZ', 'minX', 'maxX']
  const planes: RPlane[] = [
    { key: 'LOW', drains: uLo, lin: linU(eaveY, u0, tan), tan, downslope: D(-1, 0), datum: W(u0, t0) },
    { key: 'HIGH', drains: uHi, lin: linU(eaveY, u1, -tan), tan, downslope: D(1, 0), datum: W(u1, t0) },
  ]
  const run = region.kind === 'HIP' ? Math.min(Math.max(region.hipRunM ?? half, 0.05), (t1 - t0) / 2) : 0
  if (region.kind === 'HIP') {
    const tanQ = (ridgeY - eaveY) / run
    if (!openEnd.min) planes.push({ key: 'END_MIN', drains: tLo, lin: linT(eaveY, t0, tanQ), tan: tanQ, downslope: D(0, -1), datum: W(u0, t0) })
    if (!openEnd.max) planes.push({ key: 'END_MAX', drains: tHi, lin: linT(eaveY, t1, -tanQ), tan: tanQ, downslope: D(0, 1), datum: W(u0, t1) })
  }
  return { region, index, domain, planes, half, run, eaveY, ridgeY, openEnd }
}

/** The region's own surface over a point of its domain (the lower envelope of its planes). */
const surfaceAt = (l: Laid, p: Vec2): number => Math.min(...l.planes.map((q) => at(q.lin, p)))
const inBox = (b: PlanBox, p: Vec2, eps = 1e-9): boolean => p.x >= b.x0 - eps && p.x <= b.x1 + eps && p.z >= b.z0 - eps && p.z <= b.z1 + eps
const overlapArea = (a: PlanBox, b: PlanBox): number => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0))

/** Where `a`'s ridge ends on `b`'s side: which end, how far `b`'s surface rises behind that line, or why it does not run on. */
function ridgeEndAgainst(a: RoofRegion, b: RoofRegion): { end: 'MIN' | 'MAX'; depth: number } | { why: string } | undefined {
  const T = ROOF_SYSTEM_TOLERANCES
  const fa = frame(a)
  // b's extent in a's frame: along a's ridge (t) and across it (u)
  const [bt0, bt1, bu0, bu1] = a.ridgeAxis === 'Z' ? [b.rect.z0, b.rect.z1, b.rect.x0, b.rect.x1] : [b.rect.x0, b.rect.x1, b.rect.z0, b.rect.z1]
  const end: 'MIN' | 'MAX' | undefined = Math.abs(fa.t1 - bt0) <= T.touchM ? 'MAX' : Math.abs(fa.t0 - bt1) <= T.touchM ? 'MIN' : undefined
  if (!end) return undefined
  if (Math.min(fa.u1, bu1) - Math.max(fa.u0, bu0) <= 0.1) return undefined
  const crosswise = a.ridgeAxis !== b.ridgeAxis
  if (b.kind === 'GABLE' && !crosswise) return { why: `${a.id} and ${b.id} stand in line, ridge to ridge: a gable wall is between them, no slope to run over` }
  if (fa.u0 < bu0 - T.touchM || fa.u1 > bu1 + T.touchM) return { why: `${a.id} is wider than the side of ${b.id} it stands against (${(fa.u1 - fa.u0).toFixed(2)} m against ${(bu1 - bu0).toFixed(2)} m): its roof stops at the party line` }
  const fb = frame(b)
  const depth = crosswise ? (fb.u1 - fb.u0) / 2 : Math.min(Math.max(b.hipRunM ?? (fb.u1 - fb.u0) / 2, 0.05), (fb.t1 - fb.t0) / 2)
  return { end, depth }
}

// ---------------------------------------------------------------------------
// The solve
// ---------------------------------------------------------------------------

export function solveRoofSystem(input: readonly RoofRegion[]): RoofSystemSolution {
  // 1.0.1: a region whose pitch comes out of range (as read, or after an eave snapped to a neighbour's) takes no part in
  // the system — solved again WITHOUT it, so no neighbour keeps a cut, a run-on or a valley made against a roof that is
  // then not built in planes (it left a hole in the main slope). Its violation is kept; its body is roofed apart.
  const excluded = new Map<string, RoofViolation>()
  for (let k = 0; k <= input.length; k += 1) {
    const s = solveOnce(input, new Set(excluded.keys()))
    const fresh = s.violations.filter((v) => v.property === 'pitchDeg' && !excluded.has(v.regionId))
    if (fresh.length === 0) return { ...s, violations: [...excluded.values(), ...s.violations.filter((v) => !excluded.has(v.regionId))] }
    for (const v of fresh) excluded.set(v.regionId, { ...v, why: `${v.why}; the system is solved without it (no neighbour is cut by it) and its body is roofed apart` })
  }
  return solveOnce(input, new Set(excluded.keys()))
}

function solveOnce(input: readonly RoofRegion[], excluded: ReadonlySet<string>): RoofSystemSolution {
  const T = ROOF_SYSTEM_TOLERANCES
  const byId = new Map(input.map((r) => [r.id, r]))
  const relations: RoofRelation[] = []
  const adjustments: RoofAdjustment[] = []
  const violations: RoofViolation[] = []
  const eave = new Map(input.map((r) => [r.id, r.eaveY]))
  const ridge = new Map(input.map((r) => [r.id, r.ridgeY]))
  const domain = new Map(input.map((r) => [r.id, { ...r.rect }]))
  const open = new Map(input.map((r) => [r.id, { min: false, max: false }]))
  const sep = (a: RoofRegion, b: RoofRegion): boolean => (a.separateFrom ?? []).includes(b.id) || (b.separateFrom ?? []).includes(a.id)

  for (const r of input) {
    const f = frame(r)
    if (!(f.u1 - f.u0 > 0.2) || !(f.t1 - f.t0 > 0.2)) violations.push({ regionId: r.id, property: 'rect', value: Math.min(f.u1 - f.u0, f.t1 - f.t0), why: `${r.id} is ${(f.u1 - f.u0).toFixed(2)} × ${(f.t1 - f.t0).toFixed(2)} m: not a roof region` })
    if (!(r.ridgeY > r.eaveY + 1e-3)) violations.push({ regionId: r.id, property: 'ridgeY', value: r.ridgeY, why: `${r.id}: the ridge (${r.ridgeY.toFixed(2)} m) is not above the eaves (${r.eaveY.toFixed(2)} m)` })
  }
  const sound = (r: RoofRegion): boolean => !excluded.has(r.id) && !violations.some((v) => v.regionId === r.id)
  const halfOf = (r: RoofRegion): number => { const f = frame(r); return (f.u1 - f.u0) / 2 }
  const pitchOk = (r: RoofRegion, e: number, top: number): boolean => { const p = deg((top - e) / Math.max(1e-6, halfOf(r))); return p >= T.minPitchDeg && p <= T.maxPitchDeg }

  // 1. a region standing over another (a cross gable): its eaves and ridge held to the roof it stands on
  for (const a of input) {
    if (!a.over || !sound(a)) continue
    const b = byId.get(a.over)
    if (!b || !sound(b)) { relations.push({ a: a.id, b: a.over, kind: 'SEPARATE', why: `${a.id} is stated over ${a.over}, which is not a roof region of this system` }); continue }
    const rb = ridge.get(b.id) as number
    const ra = ridge.get(a.id) as number
    // 1.0.1: a cross gable stands on the host's slope and dies into it below the host's ridge: one read above that ridge
    // (beyond the snap) would end in the air over it, an open triangle — not built, by name
    if (ra > rb + T.ridgeSnapM) { violations.push({ regionId: a.id, property: 'ridgeY', value: ra, why: `${a.id} is stated over ${b.id} with its ridge at ${ra.toFixed(2)} m, above ${b.id}'s ridge (${rb.toFixed(2)} m): a cross gable dies into the slope below that ridge — this one would end in the air; not built` }); continue }
    if (ra > rb && ra - rb <= T.ridgeSnapM) { adjustments.push({ regionId: a.id, property: 'ridgeY', from: ra, to: rb, why: `read ${(ra - rb).toFixed(2)} m above the ridge of ${b.id} it runs into: within the reading's tolerance, the two ridges meet` }); ridge.set(a.id, rb) }
    const eb = eave.get(b.id) as number
    const ea = eave.get(a.id) as number
    if (Math.abs(ea - eb) <= T.eaveSnapM && ea !== eb && pitchOk(a, eb, ridge.get(a.id) as number)) { adjustments.push({ regionId: a.id, property: 'eaveY', from: ea, to: eb, why: `read ${Math.abs(ea - eb).toFixed(2)} m off the eaves of ${b.id}: within the reading's tolerance, the eaves are level` }); eave.set(a.id, eb) }
    relations.push({ a: a.id, b: b.id, kind: 'CROSS_GABLE', why: `${a.id} stands over ${b.id} on the same walls: a second ridge across it, dying into its slope` })
  }

  // 2. a region whose ridge ends on another region's side: it runs on over that region, or stops at the party line
  for (const a of input) {
    if (a.over || !sound(a)) continue
    for (const b of input) {
      if (a === b || b.over || !sound(b)) continue
      const hit = ridgeEndAgainst(a, b)
      if (!hit) continue
      if (sep(a, b)) { relations.push({ a: a.id, b: b.id, kind: 'SEPARATE', why: `${a.id} and ${b.id} are stated apart (a wall stands between their roofs): ${a.id} stops at the party line` }); continue }
      if ('why' in hit) {
        const kind: RoofRelationKind = /in line/.test(hit.why) ? 'IN_LINE' : 'ABUTMENT'
        // two roofs in line are one relation, seen from either
        if (!(kind === 'IN_LINE' && relations.some((q) => q.kind === 'IN_LINE' && q.a === b.id && q.b === a.id))) relations.push({ a: a.id, b: b.id, kind, why: hit.why })
        continue
      }
      let ra = ridge.get(a.id) as number
      const rb = ridge.get(b.id) as number
      const eb = eave.get(b.id) as number
      if (ra > rb + T.ridgeSnapM) { relations.push({ a: a.id, b: b.id, kind: 'ABUTMENT', why: `${a.id}'s ridge (${ra.toFixed(2)} m) stands above ${b.id}'s (${rb.toFixed(2)} m): it does not die into that roof — its end is a wall over it` }); continue }
      if (ra <= eb + T.showM) { relations.push({ a: a.id, b: b.id, kind: 'ABUTMENT', why: `${a.id}'s ridge (${ra.toFixed(2)} m) is not above ${b.id}'s eaves (${eb.toFixed(2)} m): its roof meets ${b.id}'s wall and nothing of it shows over that roof` }); continue }
      if (ra > rb) { adjustments.push({ regionId: a.id, property: 'ridgeY', from: ra, to: rb, why: `read ${(ra - rb).toFixed(2)} m above the ridge of ${b.id} it runs into: within the reading's tolerance, the two ridges meet` }); ridge.set(a.id, rb); ra = rb }
      const ea = eave.get(a.id) as number
      // (1.0.1: never a snap that would put the pitch out of range — the eaves then stay as read, a cheek or a step named)
      if (Math.abs(ea - eb) <= T.eaveSnapM && ea !== eb && ra - eb > 0.3 && pitchOk(a, eb, ra)) { adjustments.push({ regionId: a.id, property: 'eaveY', from: ea, to: eb, why: `read ${Math.abs(ea - eb).toFixed(2)} m off the eaves of ${b.id}: within the reading's tolerance, the eaves are level and the valleys start in the corner` }); eave.set(a.id, eb) }
      const d = domain.get(a.id) as PlanBox
      if (a.ridgeAxis === 'Z') { if (hit.end === 'MAX') d.z1 = a.rect.z1 + hit.depth; else d.z0 = a.rect.z0 - hit.depth } else if (hit.end === 'MAX') d.x1 = a.rect.x1 + hit.depth; else d.x0 = a.rect.x0 - hit.depth
      const o = open.get(a.id) as { min: boolean; max: boolean }
      if (hit.end === 'MAX') o.max = true; else o.min = true
      const cheek = (eave.get(a.id) as number) - eb
      relations.push({ a: a.id, b: b.id, kind: 'VALLEY', why: `${a.id}'s ridge ends on ${b.id}'s side and does not stand above its ridge: its planes run on over ${b.id}'s slope to where the two top surfaces meet`, extendedM: round6(hit.depth), ...(cheek > T.cheekFreeM ? { cheekM: round6(cheek) } : {}) })
    }
  }

  const laid = input.filter(sound).map((r, i) => layRegion(r, i, eave.get(r.id) as number, ridge.get(r.id) as number, domain.get(r.id) as PlanBox, open.get(r.id) as { min: boolean; max: boolean }))
  for (const l of laid) {
    const p = deg((l.ridgeY - l.eaveY) / l.half)
    if (p < T.minPitchDeg || p > T.maxPitchDeg) violations.push({ regionId: l.region.id, property: 'pitchDeg', value: p, why: `${l.region.id}: ${p.toFixed(1)}° from eaves ${l.eaveY.toFixed(2)} m to ridge ${l.ridgeY.toFixed(2)} m over half of ${(2 * l.half).toFixed(2)} m — outside ${T.minPitchDeg}–${T.maxPitchDeg}°: these heights and this span are not one roof's` })
  }

  // 3. every plane: its own polygon in its region (lower envelope), less what another region stands above (upper envelope)
  const meets = new Map<string, Set<string>>()
  const visible = new Map<string, { laid: Laid; plane: RPlane; polys: Vec2[][] }>()
  for (const l of laid) {
    for (const p of l.planes) {
      let own: Vec2[] = boxPoly(l.domain)
      for (const q of l.planes) if (q !== p && own.length > 0) own = clipHalf(own, sub(q.lin, p.lin))
      let pieces: Vec2[][] = own.length > 0 ? [own] : []
      for (const s of laid) {
        if (s === l || overlapArea(s.domain, l.domain) <= T.areaEps || pieces.length === 0) continue
        let k: Vec2[] = boxPoly(s.domain)
        for (const q of s.planes) {
          if (k.length === 0) break
          const f = sub(q.lin, p.lin)
          if (Math.abs(f.gx) < 1e-9 && Math.abs(f.gz) < 1e-9) { if (f.c > 1e-6 || (Math.abs(f.c) <= 1e-6 && s.index < l.index)) continue; k = []; break }
          k = clipHalf(k, f)
        }
        if (k.length === 0) continue
        const before = pieces.reduce((t, q) => t + Math.abs(areaOf(q)), 0)
        pieces = pieces.flatMap((piece) => subtractConvex(piece, k))
        const after = pieces.reduce((t, q) => t + Math.abs(areaOf(q)), 0)
        if (before - after > T.areaEps) { meets.set(l.region.id, (meets.get(l.region.id) ?? new Set()).add(s.region.id)); meets.set(s.region.id, (meets.get(s.region.id) ?? new Set()).add(l.region.id)) }
      }
      const merged = mergePieces(pieces) ?? pieces.map((q) => dedupe(ccw(q.map((v) => ({ x: round6(v.x), z: round6(v.z) })))))
      visible.set(`${l.region.id}|${p.key}`, { laid: l, plane: p, polys: merged.filter((q) => q.length >= 3) })
    }
  }

  // a VALLEY relation whose region shows nothing over the other is an abutment after all (named)
  for (const rel of relations) {
    if (rel.kind !== 'VALLEY') continue
    const b = byId.get(rel.b) as RoofRegion
    const shows = [...visible.values()].some((v) => v.laid.region.id === rel.a && v.polys.some((poly) => { const c = poly.reduce((t, q) => ({ x: t.x + q.x / poly.length, z: t.z + q.z / poly.length }), { x: 0, z: 0 }); return poly.some((q) => inBox(b.rect, q, -1e-4)) || inBox(b.rect, c, -1e-4) }))
    if (!shows) { rel.kind = 'ABUTMENT'; rel.why = `${rel.a}'s planes were run on over ${rel.b} and nothing of them stands above its roof: it meets ${rel.b}'s wall`; delete rel.extendedM; delete rel.cheekM }
  }

  // a region run on over another with its eaves BELOW that roof's eaves meets that body's wall along the party line up
  // to where it has risen to them. Its planes are stated in two pieces there — over its own walls, and over the other
  // roof — so a wall under the other roof follows only the piece that stands over it, never the one that meets its face
  for (const rel of relations) {
    if (rel.kind !== 'VALLEY') continue
    const [a, b] = [byId.get(rel.a) as RoofRegion, byId.get(rel.b) as RoofRegion]
    if (!((eave.get(a.id) as number) < (eave.get(b.id) as number) - 1e-6)) continue
    const fa = frame(a)
    const dom = domain.get(a.id) as PlanBox
    const max = a.ridgeAxis === 'Z' ? dom.z1 > a.rect.z1 + 1e-9 : dom.x1 > a.rect.x1 + 1e-9
    const party = max ? fa.t1 : fa.t0
    // own side: t ≤ party (the ridge runs on at its MAX end) or t ≥ party
    const own: Lin = a.ridgeAxis === 'Z' ? { c: max ? party : -party, gx: 0, gz: max ? -1 : 1 } : { c: max ? party : -party, gx: max ? -1 : 1, gz: 0 }
    for (const v of visible.values()) {
      if (v.laid.region.id !== a.id) continue
      v.polys = v.polys.flatMap((poly) => {
        const parts = [clipHalf(poly, own), clipHalf(poly, neg(own))].map((q) => tidy(q.map((w) => ({ x: round6(w.x), z: round6(w.z) })))).filter((q) => q.length >= 3)
        const sum = parts.reduce((t, q) => t + Math.abs(areaOf(q)), 0)
        return parts.length === 2 && Math.abs(sum - Math.abs(areaOf(poly))) <= 1e-4 ? parts : [poly]
      })
    }
  }

  const joinedIds = new Set<string>()
  for (const [id, others] of meets) if (others.size > 0) joinedIds.add(id)
  for (const rel of relations) if (rel.kind === 'VALLEY' || rel.kind === 'CROSS_GABLE') { joinedIds.add(rel.a); joinedIds.add(rel.b) }

  const planes: SolvedPlane[] = []
  for (const { laid: l, plane: p, polys } of visible.values()) {
    polys.forEach((boundary, i) => planes.push({ id: `${l.region.id}-${p.drains}${polys.length > 1 ? `-${i}` : ''}`, regionId: l.region.id, key: p.key, drains: p.drains, boundary, datum: p.datum, pitchDeg: deg(p.tan), downslope: p.downslope, thicknessM: l.region.thicknessM }))
  }

  // 4. creases: where two planes' polygons share a stretch; free edges: every other stretch
  const linOf = new Map<string, Lin>()
  for (const { laid: l, plane: p, polys } of visible.values()) polys.forEach((_, i) => linOf.set(`${l.region.id}-${p.drains}${polys.length > 1 ? `-${i}` : ''}`, p.lin))
  const creases: SolvedCrease[] = []
  const freeEdges: SolvedFreeEdge[] = []
  type Stretch = { a: Vec2; b: Vec2 }
  const sharedOn = (a: Vec2, b: Vec2, other: readonly Vec2[]): Stretch[] => {
    const len = Math.hypot(b.x - a.x, b.z - a.z)
    const out: Stretch[] = []
    if (len <= 1e-4) return out
    for (let j = 0; j < other.length; j += 1) {
      const [c, d] = [other[j], other[(j + 1) % other.length]]
      const dist = (q: Vec2): number => Math.abs((q.x - a.x) * (b.z - a.z) - (q.z - a.z) * (b.x - a.x)) / len
      if (dist(c) > 1e-4 || dist(d) > 1e-4) continue
      const tOf = (q: Vec2): number => ((q.x - a.x) * (b.x - a.x) + (q.z - a.z) * (b.z - a.z)) / (len * len)
      const [t0, t1] = [Math.max(0, Math.min(tOf(c), tOf(d))), Math.min(1, Math.max(tOf(c), tOf(d)))]
      if ((t1 - t0) * len > 1e-3) out.push({ a: { x: round6(a.x + (b.x - a.x) * t0), z: round6(a.z + (b.z - a.z) * t0) }, b: { x: round6(a.x + (b.x - a.x) * t1), z: round6(a.z + (b.z - a.z) * t1) } })
    }
    return out
  }
  for (let i = 0; i < planes.length; i += 1) {
    const A = planes[i]
    const la = linOf.get(A.id) as Lin
    for (let e = 0; e < A.boundary.length; e += 1) {
      const [a, b] = [A.boundary[e], A.boundary[(e + 1) % A.boundary.length]]
      const len = Math.hypot(b.x - a.x, b.z - a.z)
      if (len <= 1e-4) continue
      const covered: Array<[number, number]> = []
      const abuts: Array<[number, number]> = []
      for (let j = 0; j < planes.length; j += 1) {
        if (j === i) continue
        const B = planes[j]
        for (const s of sharedOn(a, b, B.boundary)) {
          const tOf = (q: Vec2): number => ((q.x - a.x) * (b.x - a.x) + (q.z - a.z) * (b.z - a.z)) / (len * len)
          const span: [number, number] = [Math.min(tOf(s.a), tOf(s.b)), Math.max(tOf(s.a), tOf(s.b))]
          const lb = linOf.get(B.id) as Lin
          const [ya, yb] = [at(la, s.a), at(la, s.b)]
          const gap = Math.max(Math.abs(ya - at(lb, s.a)), Math.abs(yb - at(lb, s.b)))
          if (gap > 1e-3) {
            // two heights on one line: no crease. The lower plane meets what rises past it there (an abutment); the
            // upper plane's edge is its own eave or verge
            const mid = { x: (s.a.x + s.b.x) / 2, z: (s.a.z + s.b.z) / 2 }
            if (at(la, mid) < at(lb, mid)) abuts.push(span)
            continue
          }
          covered.push(span)
          if (j < i) continue
          // a step into A from the crease: where A stands above B's plane run on, the roof folds inwards (a valley)
          const n = { x: -(b.z - a.z) / len, z: (b.x - a.x) / len }
          const mid = { x: (s.a.x + s.b.x) / 2 + n.x * 0.05, z: (s.a.z + s.b.z) / 2 + n.z * 0.05 }
          const d = at(la, mid) - at(lb, mid)
          if (Math.abs(d) < 1e-6) continue // one continuous plane: no crease to name
          const kind: RoofCreaseKind = d > 0 ? 'VALLEY' : Math.abs(ya - yb) <= 1e-4 ? 'RIDGE' : 'HIP'
          const n0 = creases.filter((c) => c.planeIds[0] === A.id && c.planeIds[1] === B.id).length
          creases.push({ id: `${kind.toLowerCase()}-${A.id.replace(/^roof-/, '')}-${B.id.replace(/^roof-/, '')}${n0 > 0 ? `-${n0}` : ''}`, kind, planeIds: [A.id, B.id], regionIds: [A.regionId, B.regionId], start: s.a, end: s.b, startY: round6(ya), endY: round6(yb), gapM: round6(gap) })
        }
      }
      // what no other plane shares is free: an eave (level, the slope runs down to it), a verge (along the slope), else a boundary
      const taken = [...covered, ...abuts].sort((p, q) => p[0] - q[0])
      let from = 0
      const frees: Array<[number, number]> = []
      for (const [c0, c1] of taken) { if (c0 > from + 1e-6) frees.push([from, c0]); from = Math.max(from, c1) }
      if (from < 1 - 1e-6) frees.push([from, 1])
      const point = (f: number): Vec2 => ({ x: round6(a.x + (b.x - a.x) * f), z: round6(a.z + (b.z - a.z) * f) })
      const free = (kind: SolvedFreeEdge['kind'], f0: number, f1: number): void => { if ((f1 - f0) * len > 1e-3) freeEdges.push({ id: `${kind.toLowerCase()}-${A.id.replace(/^roof-/, '')}-${freeEdges.filter((q) => q.planeId === A.id).length}`, kind, planeId: A.id, regionId: A.regionId, start: point(f0), end: point(f1) }) }
      for (const [f0, f1] of abuts) free('ABUTMENT', f0, f1)
      for (const [f0, f1] of frees) {
        const level = Math.abs(at(la, point(f0)) - at(la, point(f1))) <= 1e-4
        // the outward normal of a counter-clockwise polygon's edge
        const out = { x: (b.z - a.z) / len, z: -(b.x - a.x) / len }
        const down = out.x * A.downslope.x + out.z * A.downslope.z
        const alongSlope = Math.abs(((b.x - a.x) * A.downslope.x + (b.z - a.z) * A.downslope.z) / len) > 0.999
        free(level && down > 0.999 ? 'EAVE' : alongSlope ? 'VERGE' : 'BOUNDARY', f0, f1)
      }
    }
  }

  const regions: SolvedRegion[] = laid.map((l) => ({ id: l.region.id, hostBodyId: l.region.hostBodyId, kind: l.region.kind, ridgeAxis: l.region.ridgeAxis, rect: { ...l.region.rect }, eaveY: round6(l.eaveY), ridgeY: round6(l.ridgeY), pitchDeg: deg((l.ridgeY - l.eaveY) / l.half), ...(l.region.kind === 'HIP' ? { endPitchDeg: deg((l.ridgeY - l.eaveY) / l.run), hipRunM: round6(l.run) } : {}), planeIds: planes.filter((p) => p.regionId === l.region.id).map((p) => p.id), joined: joinedIds.has(l.region.id) }))
  return { version: ROOF_SYSTEM_VERSION, regions, planes, creases, freeEdges, relations, adjustments, violations }
}

/** The roof's top surface over a plan point, as the solved planes make it (the highest plane whose polygon holds the point), or undefined off the roof. */
export function roofSystemTopAt(s: RoofSystemSolution, x: number, z: number): number | undefined {
  let top: number | undefined
  for (const p of s.planes) {
    if (!pointInPoly({ x, z }, p.boundary)) continue
    const y = p.datum.y - Math.tan((p.pitchDeg * Math.PI) / 180) * ((x - p.datum.x) * p.downslope.x + (z - p.datum.z) * p.downslope.z)
    if (top === undefined || y > top) top = y
  }
  return top
}
export function pointInPoly(q: Vec2, poly: readonly Vec2[], eps = 1e-6): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [a, b] = [poly[i], poly[j]]
    const len = Math.hypot(b.x - a.x, b.z - a.z)
    if (len > 0 && Math.abs((q.x - a.x) * (b.z - a.z) - (q.z - a.z) * (b.x - a.x)) / len <= eps && q.x >= Math.min(a.x, b.x) - eps && q.x <= Math.max(a.x, b.x) + eps && q.z >= Math.min(a.z, b.z) - eps && q.z <= Math.max(a.z, b.z) + eps) return true
    if (a.z > q.z !== b.z > q.z && q.x < ((b.x - a.x) * (q.z - a.z)) / (b.z - a.z) + a.x) inside = !inside
  }
  return inside
}
