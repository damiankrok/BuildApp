/**
 * Compilers for the schema 1.6.0 primitives: roof planes (with the holes
 * their roof openings cut — rooflights, chimney holes, dormer bodies), wall
 * panels, platforms, exterior step runs, and the restrained generic
 * representation of an unknown assembly.
 *
 * Every solid is closed and outward-wound, built on the same principles as
 * the rest of the compiler: faces that share an edge compute it from the
 * same values. A roof plane is its plan region (`boundary − holes`,
 * tessellated by `tessellateRegion`) lifted onto its top surface and onto its
 * underside, with vertical faces on every boundary segment — so two planes
 * that share a plan edge meet face to face along it, and a hole's faces are
 * the reveals of the opening that cut it. Nothing here reads an assembly to
 * decide geometry: assemblies say what the primitives are together; the
 * primitives compile.
 */
import {
  linearSolidBasis,
  pointOnPolygonBoundary,
  pointInPolygonStrict,
  roofOpeningOutline,
  roofPlaneDrop,
  roofPlaneTopAt,
  wallFrame,
  wallPlanPoint,
  type Assembly,
  type Level,
  type PlanPolygon,
  type Platform,
  type RoofOpening,
  type RoofPlane,
  type StepRun,
  type Vec2,
  type Wall,
  type WallPanel,
} from '@buildapp/model'
import { frameBox, quadOut, triOut, triangulatePolygon } from './primitives.js'
import { tessellateRegion } from './region.js'
import type { CompileDiagnostic, Triangle, Vec3 } from './types.js'
import type { TopFunction } from './wall-compiler.js'

const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z })

// ---------------------------------------------------------------------------
// Roof planes
// ---------------------------------------------------------------------------

export type RoofPlaneCompileOutput = {
  triangles: Triangle[]
  /** Faces lining each hole, by roof opening id: the reveals. */
  reveals: Map<string, Triangle[]>
  /** Openings that could not be cut (their outline did not become a hole of the region). */
  uncut: string[]
}

/**
 * One roof plane as a closed solid: its top surface over `boundary − holes`,
 * its underside `thickness / cos(pitch)` below, a vertical face on every
 * boundary segment. The faces around a hole are returned as that opening's
 * reveals, so the plane's solid is the union of `triangles` and `reveals`.
 */
export function compileRoofPlane(plane: RoofPlane, openings: readonly RoofOpening[]): RoofPlaneCompileOutput {
  const holes = openings.map((o) => ({ id: o.id, outline: roofOpeningOutline(o) }))
  const t = tessellateRegion(
    plane.boundary.map((p) => ({ u: p.x, v: p.z })),
    holes.map((h) => h.outline.map((p) => ({ u: p.x, v: p.z }))),
  )
  const drop = roofPlaneDrop(plane)
  const top = (u: number, v: number): Vec3 => v3(u, roofPlaneTopAt(plane, u, v), v)
  const bottom = (u: number, v: number): Vec3 => v3(u, roofPlaneTopAt(plane, u, v) - drop, v)
  const up = v3(plane.pitchDeg === 0 ? 0 : Math.tan((plane.pitchDeg * Math.PI) / 180) * plane.downslope.x, 1, plane.pitchDeg === 0 ? 0 : Math.tan((plane.pitchDeg * Math.PI) / 180) * plane.downslope.z)
  const down = v3(-up.x, -up.y, -up.z)
  const triangles: Triangle[] = []
  for (const [a, b, c] of t.triangles) {
    triOut(triangles, top(a.u, a.v), top(b.u, b.v), top(c.u, c.v), up)
    triOut(triangles, bottom(a.u, a.v), bottom(b.u, b.v), bottom(c.u, c.v), down)
  }
  const reveals = new Map<string, Triangle[]>()
  for (const [p, q] of t.boundary) {
    const outward = v3(q.v - p.v, 0, -(q.u - p.u))
    const hole = holes.find((h) => pointOnPolygonBoundary({ x: p.u, z: p.v }, h.outline, 1e-9) && pointOnPolygonBoundary({ x: q.u, z: q.v }, h.outline, 1e-9))
    const target = hole ? (reveals.get(hole.id) ?? []) : triangles
    quadOut(target, bottom(p.u, p.v), bottom(q.u, q.v), top(q.u, q.v), top(p.u, p.v), outward)
    if (hole) reveals.set(hole.id, target)
  }
  const uncut = holes.filter((h) => !reveals.has(h.id)).map((h) => h.id)
  return { triangles, reveals, uncut }
}

/** The surface a set of roof planes presents to a wall below: where it covers, and its underside there. */
export type PlaneSurface = {
  covers(x: number, z: number): boolean
  undersideAt(x: number, z: number): number
  /** Every boundary edge of every plane (holes included): where the underside may change slope along a line. */
  edges: Array<{ a: Vec2; b: Vec2 }>
}

export function planeSurface(planes: readonly RoofPlane[], holesOf: (planeId: string) => readonly PlanPolygon[]): PlaneSurface {
  const items = planes.map((p) => ({ p, holes: holesOf(p.id) }))
  const inside = (x: number, z: number, poly: readonly Vec2[]): boolean => pointInPolygonStrict({ x, z }, poly) || pointOnPolygonBoundary({ x, z }, poly, 1e-9)
  const coveringAt = (x: number, z: number): RoofPlane[] => items.filter((it) => inside(x, z, it.p.boundary) && !it.holes.some((h) => pointInPolygonStrict({ x, z }, h))).map((it) => it.p)
  const edges: PlaneSurface['edges'] = []
  for (const it of items) for (const poly of [it.p.boundary, ...it.holes]) for (let i = 0; i < poly.length; i++) edges.push({ a: poly[i], b: poly[(i + 1) % poly.length] })
  return {
    covers: (x, z) => coveringAt(x, z).length > 0,
    undersideAt: (x, z) => Math.min(...coveringAt(x, z).map((p) => roofPlaneTopAt(p, x, z) - roofPlaneDrop(p))),
    edges,
  }
}

/** Parameters t ∈ (0, L) where the line p + d·t crosses a plane boundary edge. */
function surfaceBreaksAlong(s: PlaneSurface, p: Vec2, d: Vec2, L: number): number[] {
  const out: number[] = []
  for (const e of s.edges) {
    const ex = e.b.x - e.a.x
    const ez = e.b.z - e.a.z
    const den = d.x * ez - d.z * ex
    if (Math.abs(den) < 1e-12) continue
    const wx = e.a.x - p.x
    const wz = e.a.z - p.z
    const t = (wx * ez - wz * ex) / den
    const sPar = (wx * d.z - wz * d.x) / den
    if (t > 1e-9 && t < L - 1e-9 && sPar >= -1e-9 && sPar <= 1 + 1e-9) out.push(t)
  }
  return out
}

/**
 * The top of a wall that dies into roof planes (FOLLOW_ROOF_PLANES): its
 * nominal height where no plane covers it, else the lowest underside above
 * it. Breaks: where either face crosses a plane edge, and where the underside
 * crosses the nominal height.
 */
export function wallTopUnderPlanes(wall: Wall, level: Level, surface: PlaneSurface, span: { a0: number; a1: number }): { top: TopFunction; breaks: number[]; diagnostics: CompileDiagnostic[] } {
  const f = wallFrame(wall, level)
  const top: TopFunction = (u, c) => {
    const p = wallPlanPoint(f, u, c)
    if (!surface.covers(p.x, p.z)) return wall.height
    return Math.min(wall.height, surface.undersideAt(p.x, p.z) - f.baseY)
  }
  const breaks: number[] = []
  let uncovered = false
  for (const c of [0, wall.thickness]) {
    const p = wallPlanPoint(f, span.a0, c)
    breaks.push(...surfaceBreaksAlong(surface, p, { x: f.u.x, z: f.u.z }, span.a1 - span.a0).map((t) => t + span.a0))
    for (const u of [span.a0, span.a1, ...breaks]) {
      const q = wallPlanPoint(f, u, c)
      if (!surface.covers(q.x, q.z)) uncovered = true
    }
  }
  const sorted = [...new Set([span.a0, span.a1, ...breaks])].sort((a, b) => a - b)
  for (const c of [0, wall.thickness]) {
    const under = (u: number): number => {
      const q = wallPlanPoint(f, u, c)
      return surface.covers(q.x, q.z) ? surface.undersideAt(q.x, q.z) - f.baseY - wall.height : 0
    }
    for (let i = 0; i + 1 < sorted.length; i++) {
      const d0 = under(sorted[i])
      const d1 = under(sorted[i + 1])
      if ((d0 < -1e-9 && d1 > 1e-9) || (d0 > 1e-9 && d1 < -1e-9)) breaks.push(sorted[i] + (d0 / (d0 - d1)) * (sorted[i + 1] - sorted[i]))
    }
  }
  const diagnostics: CompileDiagnostic[] = uncovered
    ? [{ code: 'WALL_NOT_UNDER_ROOF', severity: 'WARNING', message: `wall ${wall.id} follows roof planes but is not entirely under them; outside them it keeps its nominal height`, objectId: wall.id }]
    : []
  return { top, breaks, diagnostics }
}

// ---------------------------------------------------------------------------
// Wall panels
// ---------------------------------------------------------------------------

const profileAt = (points: WallPanel['bottom'], u: number): number => {
  if (u <= points[0].u) return points[0].y
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (u <= b.u) return b.u - a.u <= 1e-12 ? b.y : a.y + ((u - a.u) / (b.u - a.u)) * (b.y - a.y)
  }
  return points[points.length - 1].y
}

/** A wall panel: the prism between its bottom and top polylines, `thickness` deep behind its outer face line. */
export function compileWallPanel(panel: WallPanel): Triangle[] {
  const L = Math.hypot(panel.end.x - panel.start.x, panel.end.z - panel.start.z)
  const u = { x: (panel.end.x - panel.start.x) / L, z: (panel.end.z - panel.start.z) / L }
  // outward normal n = up × u; material lies along −n
  const n = { x: u.z, z: -u.x }
  const P = (a: number, y: number, c: number): Vec3 => v3(panel.start.x + u.x * a - n.x * c, y, panel.start.z + u.z * a - n.z * c)
  const breaks = [...new Set([...panel.bottom.map((p) => p.u), ...panel.top.map((p) => p.u)])].sort((a, b) => a - b)
  const t = panel.thickness
  const out: Triangle[] = []
  const outward = v3(n.x, 0, n.z)
  const inward = v3(-n.x, 0, -n.z)
  for (let i = 0; i + 1 < breaks.length; i++) {
    const a0 = breaks[i]
    const a1 = breaks[i + 1]
    const b0 = profileAt(panel.bottom, a0)
    const b1 = profileAt(panel.bottom, a1)
    const t0 = profileAt(panel.top, a0)
    const t1 = profileAt(panel.top, a1)
    quadOut(out, P(a0, b0, 0), P(a1, b1, 0), P(a1, t1, 0), P(a0, t0, 0), outward)
    quadOut(out, P(a0, b0, t), P(a1, b1, t), P(a1, t1, t), P(a0, t0, t), inward)
    quadOut(out, P(a0, t0, 0), P(a1, t1, 0), P(a1, t1, t), P(a0, t0, t), v3(0, 1, 0))
    quadOut(out, P(a0, b0, 0), P(a1, b1, 0), P(a1, b1, t), P(a0, b0, t), v3(0, -1, 0))
  }
  const first = breaks[0]
  const last = breaks[breaks.length - 1]
  quadOut(out, P(first, profileAt(panel.bottom, first), 0), P(first, profileAt(panel.bottom, first), t), P(first, profileAt(panel.top, first), t), P(first, profileAt(panel.top, first), 0), v3(-u.x, 0, -u.z))
  quadOut(out, P(last, profileAt(panel.bottom, last), 0), P(last, profileAt(panel.bottom, last), t), P(last, profileAt(panel.top, last), t), P(last, profileAt(panel.top, last), 0), v3(u.x, 0, u.z))
  return out
}

// ---------------------------------------------------------------------------
// Platforms
// ---------------------------------------------------------------------------

/** A platform: its polygon between its top surface (level, or a ramp's plane) and `thickness` below. Null when the polygon cannot be triangulated. */
export function compilePlatform(p: Platform, level: Level): Triangle[] | null {
  const y0 = level.elevation + p.topOffset
  const topAt = (x: number, z: number): number => (p.slope ? y0 - p.slope.gradient * ((x - p.slope.origin.x) * p.slope.downhill.x + (z - p.slope.origin.z) * p.slope.downhill.z) : y0)
  const tri = triangulatePolygon(p.polygon)
  if (!tri) return null
  const out: Triangle[] = []
  const T = (q: Vec2): Vec3 => v3(q.x, topAt(q.x, q.z), q.z)
  const B = (q: Vec2): Vec3 => v3(q.x, topAt(q.x, q.z) - p.thickness, q.z)
  const up = p.slope ? v3(p.slope.gradient * p.slope.downhill.x, 1, p.slope.gradient * p.slope.downhill.z) : v3(0, 1, 0)
  for (const [i, j, k] of tri) {
    triOut(out, T(p.polygon[i]), T(p.polygon[j]), T(p.polygon[k]), up)
    triOut(out, B(p.polygon[i]), B(p.polygon[j]), B(p.polygon[k]), v3(-up.x, -up.y, -up.z))
  }
  const ccw = signed(p.polygon) > 0
  for (let i = 0; i < p.polygon.length; i++) {
    const a = p.polygon[i]
    const b = p.polygon[(i + 1) % p.polygon.length]
    const outward = ccw ? v3(b.z - a.z, 0, -(b.x - a.x)) : v3(-(b.z - a.z), 0, b.x - a.x)
    quadOut(out, B(a), B(b), T(b), T(a), outward)
  }
  return out
}

const signed = (p: readonly Vec2[]): number => {
  let s = 0
  for (let i = 0; i < p.length; i++) {
    const a = p[i]
    const b = p[(i + 1) % p.length]
    s += a.x * b.z - b.x * a.z
  }
  return s / 2
}

// ---------------------------------------------------------------------------
// Exterior step runs
// ---------------------------------------------------------------------------

/**
 * An exterior step run. SOLID: one closed stepped solid — the run's profile
 * (risers and treads over the grade) extruded across its width. OPEN_TREADS:
 * one closed box per tread.
 */
export function compileStepRun(s: StepRun, level: Level): Triangle[] {
  const d = s.direction
  const right = { x: d.z, z: -d.x }
  const base = level.elevation + s.baseOffset
  const out: Triangle[] = []
  const P = (along: number, y: number, across: number): Vec3 => v3(s.start.x + d.x * along + right.x * across, y, s.start.z + d.z * along + right.z * across)
  if (s.construction === 'OPEN_TREADS') {
    const tt = s.treadThickness ?? Math.min(0.05, s.rise)
    for (let k = 1; k <= s.steps; k++) {
      const top = base + k * s.rise
      frameBox(out, P((k - 1) * s.going, top - tt, 0), v3(d.x * s.going, 0, d.z * s.going), v3(right.x * s.width, 0, right.z * s.width), v3(0, tt, 0))
    }
    return out
  }
  // the profile in (along, y): up the first riser, along each tread, down the back to the grade
  const prof: Array<{ s: number; y: number }> = [{ s: 0, y: base }]
  for (let k = 1; k <= s.steps; k++) {
    prof.push({ s: (k - 1) * s.going, y: base + k * s.rise })
    prof.push({ s: k * s.going, y: base + k * s.rise })
  }
  prof.push({ s: s.steps * s.going, y: base })
  const tri = triangulatePolygon(prof.map((p) => ({ x: p.s, z: p.y })))
  if (!tri) return []
  const left = v3(-right.x, 0, -right.z)
  const rightN = v3(right.x, 0, right.z)
  for (const [i, j, k] of tri) {
    triOut(out, P(prof[i].s, prof[i].y, 0), P(prof[j].s, prof[j].y, 0), P(prof[k].s, prof[k].y, 0), left)
    triOut(out, P(prof[i].s, prof[i].y, s.width), P(prof[j].s, prof[j].y, s.width), P(prof[k].s, prof[k].y, s.width), rightN)
  }
  // the profile's outward normal on edge a→b, in (along, y): right of travel for a counter-clockwise
  // profile, left of it for a clockwise one (up the first riser, along the treads, down the back is clockwise)
  const ccw = signed(prof.map((p) => ({ x: p.s, z: p.y }))) > 0
  for (let i = 0; i < prof.length; i++) {
    const a = prof[i]
    const b = prof[(i + 1) % prof.length]
    const ns = ccw ? b.y - a.y : -(b.y - a.y)
    const ny = ccw ? -(b.s - a.s) : b.s - a.s
    const outward = v3(d.x * ns, ny, d.z * ns)
    quadOut(out, P(a.s, a.y, 0), P(b.s, b.y, 0), P(b.s, b.y, s.width), P(a.s, a.y, s.width), outward)
  }
  return out
}

// ---------------------------------------------------------------------------
// Unknown assemblies
// ---------------------------------------------------------------------------

const PATCH = 0.02
const BAR = 0.03

/**
 * The restrained generic representation of an unknown assembly: each
 * observed planar patch as a plate `PATCH` thick, each observed segment as a
 * slender bar. Nothing is drawn from the extent alone, and nothing that was
 * not observed is completed: the representation shows what was measured,
 * not a guess at what the thing is.
 */
export function compileUnknownAssembly(a: Extract<Assembly, { kind: 'UNKNOWN' }>): Triangle[] {
  const out: Triangle[] = []
  for (const f of a.observedPlanesOrSegments) {
    if (f.kind === 'SEGMENT') {
      const basis = linearSolidBasis({ start: f.start, end: f.end })
      if (basis.length <= 0) continue
      const origin = v3(f.start.x - basis.widthAxis.x * (BAR / 2) - basis.depthAxis.x * (BAR / 2), f.start.y - basis.widthAxis.y * (BAR / 2) - basis.depthAxis.y * (BAR / 2), f.start.z - basis.widthAxis.z * (BAR / 2) - basis.depthAxis.z * (BAR / 2))
      frameBox(out, origin, v3(basis.pathDir.x * basis.length, basis.pathDir.y * basis.length, basis.pathDir.z * basis.length), v3(basis.widthAxis.x * BAR, basis.widthAxis.y * BAR, basis.widthAxis.z * BAR), v3(basis.depthAxis.x * BAR, basis.depthAxis.y * BAR, basis.depthAxis.z * BAR))
      continue
    }
    const pts = f.outline
    const o = pts[0]
    let normal: Vec3 | undefined
    for (let i = 1; i + 1 < pts.length && !normal; i++) {
      const e1 = v3(pts[i].x - o.x, pts[i].y - o.y, pts[i].z - o.z)
      const e2 = v3(pts[i + 1].x - o.x, pts[i + 1].y - o.y, pts[i + 1].z - o.z)
      const c = v3(e1.y * e2.z - e1.z * e2.y, e1.z * e2.x - e1.x * e2.z, e1.x * e2.y - e1.y * e2.x)
      const l = Math.hypot(c.x, c.y, c.z)
      if (l > 1e-9) normal = v3(c.x / l, c.y / l, c.z / l)
    }
    if (!normal) continue
    const nrm = normal
    // a 2D chart on the patch's plane
    const ax = Math.abs(nrm.x) < 0.9 ? v3(1, 0, 0) : v3(0, 1, 0)
    const e1 = normalize3(cross3(ax, nrm))
    const e2 = cross3(nrm, e1)
    const chart = pts.map((p) => ({ x: (p.x - o.x) * e1.x + (p.y - o.y) * e1.y + (p.z - o.z) * e1.z, z: (p.x - o.x) * e2.x + (p.y - o.y) * e2.y + (p.z - o.z) * e2.z }))
    const tri = triangulatePolygon(chart)
    if (!tri) continue
    const at = (i: number, side: number): Vec3 => v3(pts[i].x + nrm.x * side * (PATCH / 2), pts[i].y + nrm.y * side * (PATCH / 2), pts[i].z + nrm.z * side * (PATCH / 2))
    for (const [i, j, k] of tri) {
      triOut(out, at(i, 1), at(j, 1), at(k, 1), nrm)
      triOut(out, at(i, -1), at(j, -1), at(k, -1), v3(-nrm.x, -nrm.y, -nrm.z))
    }
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
    const cz = pts.reduce((s, p) => s + p.z, 0) / pts.length
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length
      const mid = v3((pts[i].x + pts[j].x) / 2 - cx, (pts[i].y + pts[j].y) / 2 - cy, (pts[i].z + pts[j].z) / 2 - cz)
      quadOut(out, at(i, -1), at(j, -1), at(j, 1), at(i, 1), mid)
    }
  }
  return out
}

const cross3 = (a: Vec3, b: Vec3): Vec3 => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x)
const normalize3 = (a: Vec3): Vec3 => {
  const l = Math.hypot(a.x, a.y, a.z)
  return l > 0 ? v3(a.x / l, a.y / l, a.z / l) : a
}
