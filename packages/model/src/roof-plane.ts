/**
 * Roof-plane arithmetic, shared by the validator, the DSL, the compiler and
 * the analyzer so that every layer evaluates a plane the same way.
 *
 * A plane's top surface is
 *
 *   y(p) = datum.y − tan(pitch) · ((p − datum) · downslope)
 *
 * over its boundary polygon; the plate is `thickness` deep perpendicular to
 * the slope, i.e. `thickness / cos(pitch)` measured vertically. A plane's
 * boundaries are its outer polygon and the outlines of the roof openings it
 * hosts (a dormer's cut, a rooflight, a chimney's hole): an edge of the roof
 * graph may lie on either.
 *
 * The polygon helpers here are exact up to a stated tolerance and never
 * repair anything: a segment is on a boundary or it is not.
 */
import type { PlanPolygon, PlanRect, Vec2, Vec3 } from './geometry-types.js'
import { rectToPolygon } from './geometry-types.js'
import type { CanonicalBuildingModel, RoofOpening, RoofPlane } from './schema.js'

/** Metres: how far a point may be from a line and still be on it. */
export const ROOF_GRAPH_TOLERANCE = 1e-6

export const roofPlaneSlope = (p: Pick<RoofPlane, 'pitchDeg'>): number => Math.tan((p.pitchDeg * Math.PI) / 180)

/** World y of the plane's top surface at plan point (x, z). */
export function roofPlaneTopAt(p: Pick<RoofPlane, 'datum' | 'pitchDeg' | 'downslope'>, x: number, z: number): number {
  if (p.pitchDeg === 0) return p.datum.y
  return p.datum.y - roofPlaneSlope(p) * ((x - p.datum.x) * p.downslope.x + (z - p.datum.z) * p.downslope.z)
}

/** Vertical distance from the top surface to the underside. */
export const roofPlaneDrop = (p: Pick<RoofPlane, 'pitchDeg' | 'thickness'>): number => p.thickness / Math.cos((p.pitchDeg * Math.PI) / 180)

export const roofPlaneUndersideAt = (p: Pick<RoofPlane, 'datum' | 'pitchDeg' | 'downslope' | 'thickness'>, x: number, z: number): number => roofPlaneTopAt(p, x, z) - roofPlaneDrop(p)

/** Unit normal of the top surface, pointing up. */
export function roofPlaneNormal(p: Pick<RoofPlane, 'pitchDeg' | 'downslope'>): Vec3 {
  const s = roofPlaneSlope(p)
  const n = { x: s * p.downslope.x, y: 1, z: s * p.downslope.z }
  const l = Math.hypot(n.x, n.y, n.z)
  return { x: n.x / l, y: n.y / l, z: n.z / l }
}

// ---------------------------------------------------------------------------
// Plan polygon helpers
// ---------------------------------------------------------------------------

export type PlanSegment = { a: Vec2; b: Vec2 }

export const polygonEdges = (poly: readonly Vec2[]): PlanSegment[] => poly.map((a, i) => ({ a, b: poly[(i + 1) % poly.length] }))

/** Distance from p to the segment ab, in plan. */
export function pointSegmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const l2 = dx * dx + dz * dz
  if (l2 <= 0) return Math.hypot(p.x - a.x, p.z - a.z)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2))
  return Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz))
}

export const pointOnPolygonBoundary = (p: Vec2, poly: readonly Vec2[], tol = ROOF_GRAPH_TOLERANCE): boolean => polygonEdges(poly).some((e) => pointSegmentDistance(p, e.a, e.b) <= tol)

/**
 * The parameter interval [t0, t1] ⊂ [0, 1] of segment ab that lies on the
 * segment cd (collinear within `tol`), or null when they do not overlap.
 */
function collinearOverlap(a: Vec2, b: Vec2, c: Vec2, d: Vec2, tol: number): [number, number] | null {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const L = Math.hypot(dx, dz)
  if (L <= tol) return null
  // both c and d must lie on the line through ab
  const off = (p: Vec2): number => Math.abs((p.x - a.x) * dz - (p.z - a.z) * dx) / L
  if (off(c) > tol || off(d) > tol) return null
  const t = (p: Vec2): number => ((p.x - a.x) * dx + (p.z - a.z) * dz) / (L * L)
  const lo = Math.max(0, Math.min(t(c), t(d)))
  const hi = Math.min(1, Math.max(t(c), t(d)))
  return hi - lo > tol / L ? [lo, hi] : null
}

/** True when the whole segment ab lies on the boundary of one of the polygons (covered by their collinear edges). */
export function segmentOnBoundaries(a: Vec2, b: Vec2, boundaries: ReadonlyArray<readonly Vec2[]>, tol = ROOF_GRAPH_TOLERANCE): boolean {
  const L = Math.hypot(b.x - a.x, b.z - a.z)
  if (L <= tol) return false
  const intervals: Array<[number, number]> = []
  for (const poly of boundaries) for (const e of polygonEdges(poly)) {
    const o = collinearOverlap(a, b, e.a, e.b, tol)
    if (o) intervals.push(o)
  }
  intervals.sort((x, y) => x[0] - y[0])
  let reach = 0
  const slack = tol / L
  for (const [lo, hi] of intervals) {
    if (lo > reach + slack) return false
    reach = Math.max(reach, hi)
  }
  return reach >= 1 - slack
}

/**
 * The maximal plan segments along which two polygon boundaries coincide:
 * where two roof planes share an edge. Collinear pieces that touch are
 * merged; the order is deterministic (by first coordinate).
 */
export function sharedBoundarySegments(A: ReadonlyArray<readonly Vec2[]>, B: ReadonlyArray<readonly Vec2[]>, tol = ROOF_GRAPH_TOLERANCE): PlanSegment[] {
  const pieces: PlanSegment[] = []
  for (const pa of A) for (const ea of polygonEdges(pa)) {
    for (const pb of B) for (const eb of polygonEdges(pb)) {
      const o = collinearOverlap(ea.a, ea.b, eb.a, eb.b, tol)
      if (!o) continue
      const at = (t: number): Vec2 => ({ x: ea.a.x + (ea.b.x - ea.a.x) * t, z: ea.a.z + (ea.b.z - ea.a.z) * t })
      pieces.push({ a: at(o[0]), b: at(o[1]) })
    }
  }
  // merge collinear touching pieces
  const merged: PlanSegment[] = []
  const used = new Set<number>()
  for (let i = 0; i < pieces.length; i++) {
    if (used.has(i)) continue
    let seg = pieces[i]
    used.add(i)
    let grew = true
    while (grew) {
      grew = false
      for (let j = 0; j < pieces.length; j++) {
        if (used.has(j)) continue
        const q = pieces[j]
        if (collinearOverlap(seg.a, seg.b, q.a, q.b, tol) === null && !touchesCollinear(seg, q, tol)) continue
        seg = hull(seg, q)
        used.add(j)
        grew = true
      }
    }
    merged.push(seg)
  }
  return merged
    .map((s) => (s.a.x < s.b.x - tol || (Math.abs(s.a.x - s.b.x) <= tol && s.a.z < s.b.z) ? s : { a: s.b, b: s.a }))
    .sort((p, q) => p.a.x - q.a.x || p.a.z - q.a.z || p.b.x - q.b.x || p.b.z - q.b.z)
}

function touchesCollinear(s: PlanSegment, q: PlanSegment, tol: number): boolean {
  const dx = s.b.x - s.a.x
  const dz = s.b.z - s.a.z
  const L = Math.hypot(dx, dz)
  const off = (p: Vec2): number => Math.abs((p.x - s.a.x) * dz - (p.z - s.a.z) * dx) / L
  if (off(q.a) > tol || off(q.b) > tol) return false
  const close = (p: Vec2, r: Vec2): boolean => Math.hypot(p.x - r.x, p.z - r.z) <= tol
  return close(s.a, q.a) || close(s.a, q.b) || close(s.b, q.a) || close(s.b, q.b)
}

function hull(s: PlanSegment, q: PlanSegment): PlanSegment {
  const dx = s.b.x - s.a.x
  const dz = s.b.z - s.a.z
  const t = (p: Vec2): number => (p.x - s.a.x) * dx + (p.z - s.a.z) * dz
  const pts = [s.a, s.b, q.a, q.b].sort((p, r) => t(p) - t(r))
  return { a: pts[0], b: pts[pts.length - 1] }
}

// ---------------------------------------------------------------------------
// A plane in its model
// ---------------------------------------------------------------------------

/** The outline a roof opening cuts, in plan: its polygon, or its rectangle. */
export const roofOpeningOutline = (o: Pick<RoofOpening, 'footprint' | 'outline'>): PlanPolygon => o.outline ?? rectToPolygon(o.footprint)

/** The bounding rectangle of a polygon. */
export function polygonBounds(poly: readonly Vec2[]): PlanRect {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const p of poly) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minZ = Math.min(minZ, p.z)
    maxZ = Math.max(maxZ, p.z)
  }
  return { minX, maxX, minZ, maxZ }
}

export const roofOpeningsOfPlane = (m: CanonicalBuildingModel, planeId: string): RoofOpening[] => m.roofOpenings.filter((o) => o.roofId === planeId)

/** Every boundary of a plane: its outer polygon first, then the outline of every roof opening it hosts, by id. */
export function roofPlaneBoundaries(m: CanonicalBuildingModel, plane: RoofPlane): PlanPolygon[] {
  const holes = roofOpeningsOfPlane(m, plane.id)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map(roofOpeningOutline)
  return [plane.boundary, ...holes]
}

/**
 * How two planes meet across a shared plan edge, read off their surfaces
 * alone: CONVEX (the surface bends down on both sides — a ridge or a hip),
 * CONCAVE (a valley), STEP (their heights differ along the edge) or FLUSH
 * (one continuous plane). `into` is a plan direction pointing into plane A.
 */
export function roofJoinShape(A: RoofPlane, B: RoofPlane, a: Vec2, b: Vec2, intoA: Vec2): 'CONVEX' | 'CONCAVE' | 'STEP' | 'FLUSH' {
  const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }
  const gapAt = (p: Vec2): number => roofPlaneTopAt(A, p.x, p.z) - roofPlaneTopAt(B, p.x, p.z)
  if (Math.abs(gapAt(a)) > 1e-4 || Math.abs(gapAt(b)) > 1e-4 || Math.abs(gapAt(mid)) > 1e-4) return 'STEP'
  const probe = { x: mid.x + intoA.x * 0.1, z: mid.z + intoA.z * 0.1 }
  const d = roofPlaneTopAt(B, probe.x, probe.z) - roofPlaneTopAt(A, probe.x, probe.z)
  if (d > 1e-6) return 'CONVEX'
  if (d < -1e-6) return 'CONCAVE'
  return 'FLUSH'
}

/** A unit plan vector perpendicular to ab pointing into `poly` (tested a small step off the segment's midpoint), or null if neither side is inside. */
export function inwardNormal(a: Vec2, b: Vec2, poly: readonly Vec2[]): Vec2 | null {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const L = Math.hypot(dx, dz)
  if (L <= 0) return null
  const n = { x: -dz / L, z: dx / L }
  const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }
  const step = Math.min(0.01, L / 10)
  if (pointInPolygonStrict({ x: mid.x + n.x * step, z: mid.z + n.z * step }, poly)) return n
  if (pointInPolygonStrict({ x: mid.x - n.x * step, z: mid.z - n.z * step }, poly)) return { x: -n.x, z: -n.z }
  return null
}

/** Even-odd containment, boundary excluded. */
export function pointInPolygonStrict(p: Vec2, poly: readonly Vec2[]): boolean {
  if (pointOnPolygonBoundary(p, poly, 1e-12)) return false
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside
  }
  return inside
}

export const vec2Length = (v: Vec2): number => Math.hypot(v.x, v.z)
