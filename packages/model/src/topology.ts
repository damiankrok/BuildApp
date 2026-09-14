/**
 * Wall topology resolution: junction records -> physical wall extents.
 *
 * The invariant of this module: **callers state intended topology; the model
 * resolves physical wall ownership.** A wall's `start`/`end` describe its
 * nominal outer-face line in natural footprint coordinates. Junctions say how
 * walls meet. This module turns them into an `EndCut` per wall end — the
 * `a`-parameter (distance along the wall from `start`) at which the wall's
 * material stops, separately on its outer face (`c = 0`) and its inner face
 * (`c = thickness`) — so that every junction's shared material exists exactly
 * once, with no gap and no overlap, at any angle.
 *
 * Geometry of the three kinds (see docs/WALL_TOPOLOGY.md for pictures):
 *
 * - CORNER (owner O, other A): O's end cut lies in A's *far* face plane (the
 *   face of A farther from O's body), so O covers the whole corner block; A's
 *   end cut lies in O's *near* face plane (the face of O first reached from
 *   A's body), so A stops where O's material begins. At a convex corner this
 *   leaves O untouched and trims A by O's thickness; at a reflex corner it
 *   extends O by A's thickness into the notch and leaves A untouched.
 * - BUTT / T (terminating A, host H): A's end cut lies in H's near face
 *   plane; H is not modified and owns the contact material. T additionally
 *   requires the contact to lie strictly inside H's physical length.
 *
 * Everything here is line arithmetic in the plan (x/z). A wall's line is its
 * outer face; its inner face is the parallel line `thickness` inward; a face
 * plane of one wall crossed with a face line of another gives the cut. No
 * triangles, no compiler, no repair: a junction that cannot be resolved is
 * reported by code with the measured gap or overshoot, and the walls keep
 * their nominal extents.
 */
import type { Vec2 } from './geometry-types.js'
import { polygonIsSimple, polygonSignedArea } from './geometry-types.js'
import type { ValidationIssue } from './issues.js'
import { fmtNumber } from './issues.js'
import { wallLength } from './query.js'
import type { CanonicalBuildingModel, Wall, WallEnd, WallEndRef, WallJunction, WallRing } from './schema.js'

/** Where a wall's material stops at one end, as `a` on the outer face and on the inner face. */
export type EndCut = { outer: number; inner: number }
export type WallExtent = { start: EndCut; end: EndCut }

export type JunctionRole = 'OWNER' | 'TRIMMED' | 'HOST'

export type ResolvedParticipant = { wallId: string; end?: WallEnd; role: JunctionRole; cut?: EndCut }

export type ResolvedJunction = {
  id: string
  kind: WallJunction['kind']
  ok: boolean
  /** The outer-corner point (CORNER) or the terminating wall's declared endpoint (BUTT/T). */
  point?: Vec2
  participants: ResolvedParticipant[]
  /** BUTT / T: the contact span on the host's face, as host `a` values, and which face. */
  contact?: { face: 'OUTER' | 'INNER'; a0: number; a1: number }
}

export type ResolvedTopology = {
  /** Physical extent of every wall (nominal when no junction touches an end). */
  extents: Map<string, WallExtent>
  junctions: Map<string, ResolvedJunction>
  /** `wallId:END` -> the junction that resolved that end and the wall's role in it. */
  endClaims: Map<string, { junctionId: string; role: JunctionRole }>
  issues: ValidationIssue[]
}

const EPS = 1e-9
/** Two face cuts closer than this are the same cut (perpendicular junctions computed in floating point). */
const SNAP = 1e-9

export const endKey = (ref: WallEndRef): string => `${ref.wallId}:${ref.end}`

// ---------------------------------------------------------------------------
// Plan-line arithmetic
// ---------------------------------------------------------------------------

type Line = {
  wall: Wall
  p: Vec2
  /** Unit direction start -> end. */
  u: Vec2
  /** Outward normal (`up x u` projected to the plan). */
  n: Vec2
  /** Direction into the material. */
  inward: Vec2
  T: number
  L: number
}

function lineOf(wall: Wall): Line {
  const L = wallLength(wall)
  const u = { x: (wall.end.x - wall.start.x) / L, z: (wall.end.z - wall.start.z) / L }
  const n = { x: u.z, z: -u.x }
  return { wall, p: wall.start, u, n, inward: { x: -n.x, z: -n.z }, T: wall.thickness, L }
}

const dot2 = (a: Vec2, b: Vec2): number => a.x * b.x + a.z * b.z
const noNegativeZero = (v: number): number => (v === 0 ? 0 : v)

/** Point of a wall at `a` along it and `c` into the material. */
export const wallPlanPointOf = (wall: Wall, a: number, c: number): Vec2 => {
  const l = lineOf(wall)
  return { x: l.p.x + l.u.x * a + l.inward.x * c, z: l.p.z + l.u.z * a + l.inward.z * c }
}

/** Depth of a plan point into a wall's band: 0 on the outer line, `thickness` on the inner face. */
const depthInto = (B: Line, pt: Vec2): number => -((pt.x - B.p.x) * B.n.x + (pt.z - B.p.z) * B.n.z)

/** Parameter along B (from B's start) of a plan point. */
const alongOf = (B: Line, pt: Vec2): number => (pt.x - B.p.x) * B.u.x + (pt.z - B.p.z) * B.u.z

/**
 * `a` on wall A's face at depth `cA` where that face crosses wall B's face at
 * depth `dB` (0 = outer line, B.T = inner face). `null` when parallel.
 */
function crossing(A: Line, cA: number, B: Line, dB: number): number | null {
  const den = dot2(A.u, B.n)
  if (Math.abs(den) < 1e-9) return null
  const q = { x: A.p.x + A.inward.x * cA - B.p.x, z: A.p.z + A.inward.z * cA - B.p.z }
  return (-dB - dot2(q, B.n)) / den
}

const endPoint = (A: Line, end: WallEnd): Vec2 => (end === 'START' ? A.p : { x: A.p.x + A.u.x * A.L, z: A.p.z + A.u.z * A.L })

type EndAgainst =
  | { ok: true; near: number; far: number; fromInside: boolean; depth: number; cutTo: (faceDepth: number) => EndCut }
  | { ok: false; code: 'JUNCTION_PARALLEL_WALLS' | 'JUNCTION_GAP' | 'JUNCTION_OVERSHOOT'; measured?: number; message: string }

/**
 * How the end `eA` of wall A stands against wall B: which of B's faces is the
 * near one (first reached from A's body) and the far one, whether A's
 * declared endpoint lies within B's thickness band (± `tol`), and the cuts
 * of A's two faces against any face of B.
 */
function endAgainst(A: Line, eA: WallEnd, B: Line, tol: number): EndAgainst {
  const den = dot2(A.u, B.n)
  if (Math.abs(den) < 1e-9) {
    return { ok: false, code: 'JUNCTION_PARALLEL_WALLS', message: `walls ${A.wall.id} and ${B.wall.id} are parallel; they cannot meet at a junction` }
  }
  const E = endPoint(A, eA)
  const depth = depthInto(B, E)
  const sgn = eA === 'END' ? 1 : -1
  const bodyDir = { x: -sgn * A.u.x, z: -sgn * A.u.z }
  const fromInside = dot2(bodyDir, B.inward) > 0
  const near = fromInside ? B.T : 0
  const far = fromInside ? 0 : B.T
  // Gap: the endpoint stops short of the band on the side it arrives from. Overshoot: it passes the far face.
  const short = fromInside ? depth - B.T : -depth
  const past = fromInside ? -depth : depth - B.T
  if (short > tol) {
    return {
      ok: false,
      code: 'JUNCTION_GAP',
      measured: short,
      message: `the ${eA} of wall ${A.wall.id} stops ${fmtNumber(short)} m short of wall ${B.wall.id} (tolerance ${fmtNumber(tol)} m)`,
    }
  }
  if (past > tol) {
    return {
      ok: false,
      code: 'JUNCTION_OVERSHOOT',
      measured: past,
      message: `the ${eA} of wall ${A.wall.id} passes ${fmtNumber(past)} m beyond the far face of wall ${B.wall.id} (tolerance ${fmtNumber(tol)} m)`,
    }
  }
  const cutTo = (faceDepth: number): EndCut => {
    const outer = noNegativeZero(crossing(A, 0, B, faceDepth)!)
    const inner = noNegativeZero(crossing(A, A.T, B, faceDepth)!)
    return Math.abs(outer - inner) <= SNAP ? { outer, inner: outer } : { outer, inner }
  }
  return { ok: true, near, far, fromInside, depth, cutTo }
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

export const nominalExtent = (wall: Wall): WallExtent => {
  const L = wallLength(wall)
  return { start: { outer: 0, inner: 0 }, end: { outer: L, inner: L } }
}

/** The a-range both faces of the wall share: openings must lie inside it. */
export const physicalCore = (e: WallExtent): { a0: number; a1: number } => ({
  a0: Math.max(e.start.outer, e.start.inner),
  a1: Math.min(e.end.outer, e.end.inner),
})

/** The a-range either face reaches. */
export const physicalSpan = (e: WallExtent): { a0: number; a1: number } => ({
  a0: Math.min(e.start.outer, e.start.inner),
  a1: Math.max(e.end.outer, e.end.inner),
})

export const junctionEndRefs = (j: WallJunction): WallEndRef[] => (j.kind === 'CORNER' ? [j.a, j.b] : [j.wall])

export const junctionWallIds = (j: WallJunction): string[] => (j.kind === 'CORNER' ? [j.a.wallId, j.b.wallId] : [j.wall.wallId, j.againstWallId])

export function resolveWallTopology(m: CanonicalBuildingModel): ResolvedTopology {
  const issues: ValidationIssue[] = []
  const walls = new Map(m.walls.map((w) => [w.id, w]))
  const lines = new Map<string, Line>()
  const lineFor = (id: string): Line => {
    let l = lines.get(id)
    if (!l) {
      l = lineOf(walls.get(id)!)
      lines.set(id, l)
    }
    return l
  }
  const extents = new Map<string, WallExtent>()
  for (const w of m.walls) if (wallLength(w) > EPS) extents.set(w.id, nominalExtent(w))
  const junctions = new Map<string, ResolvedJunction>()
  const endClaims = new Map<string, { junctionId: string; role: JunctionRole }>()
  const err = (code: ValidationIssue['code'], message: string, objectId: string, measured?: number): void => {
    issues.push({ code, severity: 'ERROR', message, objectId, measured })
  }
  const warn = (code: ValidationIssue['code'], message: string, objectId: string): void => {
    issues.push({ code, severity: 'WARNING', message, objectId })
  }

  const setCut = (wallId: string, end: WallEnd, cut: EndCut): void => {
    const e = extents.get(wallId)!
    if (end === 'START') e.start = cut
    else e.end = cut
  }

  // Pass 1: every junction's end cuts, from face lines only (no ordering dependency).
  const pending: Array<{ j: WallJunction; resolved: ResolvedJunction; host: Line; term: Line; face: number }> = []
  for (const j of m.wallJunctions) {
    const resolved: ResolvedJunction = { id: j.id, kind: j.kind, ok: false, participants: [] }
    junctions.set(j.id, resolved)
    const ids = junctionWallIds(j)
    let missing = false
    for (const id of ids) {
      if (!walls.has(id) || !extents.has(id)) {
        err('UNKNOWN_WALL', `junction ${j.id} refers to wall "${id}", which does not exist${walls.has(id) ? ' as a wall with length' : ''}`, j.id)
        missing = true
      }
    }
    if (missing) continue
    if (ids[0] === ids[1]) {
      err('JUNCTION_SELF_REFERENCE', `junction ${j.id} joins wall ${ids[0]} to itself`, j.id)
      continue
    }
    const [w0, w1] = ids.map((id) => walls.get(id)!)
    if (w0.levelId !== w1.levelId) {
      err('JUNCTION_LEVEL_MISMATCH', `junction ${j.id} joins wall ${w0.id} on level ${w0.levelId} to wall ${w1.id} on level ${w1.levelId}`, j.id)
      continue
    }
    // Each wall end is resolved by at most one junction.
    let conflict = false
    for (const ref of junctionEndRefs(j)) {
      const prev = endClaims.get(endKey(ref))
      if (prev) {
        err('ENDPOINT_JUNCTION_CONFLICT', `the ${ref.end} of wall ${ref.wallId} is claimed by junction ${j.id} and by junction ${prev.junctionId}`, j.id)
        conflict = true
      }
    }
    if (conflict) continue

    if (j.kind === 'CORNER') {
      if (j.owner !== j.a.wallId && j.owner !== j.b.wallId) {
        err('JUNCTION_OWNER_NOT_PARTICIPANT', `corner ${j.id} names owner "${j.owner}", which is neither ${j.a.wallId} nor ${j.b.wallId}`, j.id)
        continue
      }
      const ownerRef = j.owner === j.a.wallId ? j.a : j.b
      const otherRef = j.owner === j.a.wallId ? j.b : j.a
      const O = lineFor(ownerRef.wallId)
      const A = lineFor(otherRef.wallId)
      const oAgainst = endAgainst(O, ownerRef.end, A, j.tolerance)
      const aAgainst = endAgainst(A, otherRef.end, O, j.tolerance)
      let bad = false
      for (const r of [oAgainst, aAgainst]) {
        if (!r.ok) {
          err(r.code, `corner ${j.id}: ${r.message}`, j.id, r.measured)
          bad = true
        }
      }
      if (bad || !oAgainst.ok || !aAgainst.ok) continue
      const ownerCut = oAgainst.cutTo(oAgainst.far)
      const otherCut = aAgainst.cutTo(aAgainst.near)
      setCut(ownerRef.wallId, ownerRef.end, ownerCut)
      setCut(otherRef.wallId, otherRef.end, otherCut)
      endClaims.set(endKey(ownerRef), { junctionId: j.id, role: 'OWNER' })
      endClaims.set(endKey(otherRef), { junctionId: j.id, role: 'TRIMMED' })
      const pa = crossing(O, 0, A, 0)!
      resolved.point = { x: O.p.x + O.u.x * pa, z: O.p.z + O.u.z * pa }
      resolved.participants = [
        { wallId: ownerRef.wallId, end: ownerRef.end, role: 'OWNER', cut: ownerCut },
        { wallId: otherRef.wallId, end: otherRef.end, role: 'TRIMMED', cut: otherCut },
      ]
      resolved.ok = true
      if (O.wall.kind === 'INTERIOR' && A.wall.kind === 'EXTERIOR') {
        warn('JUNCTION_KIND_MIX', `corner ${j.id}: INTERIOR wall ${O.wall.id} owns a corner shared with EXTERIOR wall ${A.wall.id}; the exterior skin shows the interior wall's end`, j.id)
      }
      continue
    }

    // BUTT / T
    const A = lineFor(j.wall.wallId)
    const H = lineFor(j.againstWallId)
    const r = endAgainst(A, j.wall.end, H, j.tolerance)
    if (!r.ok) {
      err(r.code, `${j.kind === 'T' ? 'T-junction' : 'butt'} ${j.id}: ${r.message}`, j.id, r.measured)
      continue
    }
    const cut = r.cutTo(r.near)
    setCut(j.wall.wallId, j.wall.end, cut)
    endClaims.set(endKey(j.wall), { junctionId: j.id, role: 'TRIMMED' })
    resolved.point = endPoint(A, j.wall.end)
    resolved.participants = [
      { wallId: j.wall.wallId, end: j.wall.end, role: 'TRIMMED', cut },
      { wallId: j.againstWallId, role: 'HOST' },
    ]
    if (A.wall.kind === 'EXTERIOR' && H.wall.kind === 'INTERIOR') {
      warn('JUNCTION_KIND_MIX', `${j.kind} ${j.id}: EXTERIOR wall ${A.wall.id} terminates against INTERIOR wall ${H.wall.id}`, j.id)
    }
    pending.push({ j, resolved, host: H, term: A, face: r.near })
  }

  // Pass 2: butt/T contacts against the hosts' *physical* faces.
  for (const { j, resolved, host, term, face } of pending) {
    const cut = resolved.participants[0].cut!
    const pOuter = wallPlanPointOf(term.wall, cut.outer, 0)
    const pInner = wallPlanPointOf(term.wall, cut.inner, term.T)
    const c0 = Math.min(alongOf(host, pOuter), alongOf(host, pInner))
    const c1 = Math.max(alongOf(host, pOuter), alongOf(host, pInner))
    const he = extents.get(host.wall.id)!
    const faceName = face === 0 ? 'OUTER' : 'INNER'
    const h0 = face === 0 ? he.start.outer : he.start.inner
    const h1 = face === 0 ? he.end.outer : he.end.inner
    resolved.contact = { face: faceName, a0: c0, a1: c1 }
    const tol = j.tolerance
    if (j.kind === 'T') {
      const inside = c0 > h0 + tol && c1 < h1 - tol
      if (!inside) {
        const outBy = Math.max(h0 + tol - c0, c1 - (h1 - tol))
        err(
          'T_JUNCTION_POSITION',
          `T-junction ${j.id}: wall ${term.wall.id} meets the ${faceName.toLowerCase()} face of ${host.wall.id} at ${fmtNumber(c0)}..${fmtNumber(c1)} m along it, which is not strictly inside its physical extent ${fmtNumber(h0)}..${fmtNumber(h1)} m (out by ${fmtNumber(outBy)} m)`,
          j.id,
          outBy,
        )
        continue
      }
    } else if (c0 < h0 - tol || c1 > h1 + tol) {
      const outBy = Math.max(h0 - c0, c1 - h1)
      err(
        'BUTT_OFF_HOST',
        `butt ${j.id}: wall ${term.wall.id} meets the ${faceName.toLowerCase()} face of ${host.wall.id} at ${fmtNumber(c0)}..${fmtNumber(c1)} m along it, outside its physical extent ${fmtNumber(h0)}..${fmtNumber(h1)} m (by ${fmtNumber(outBy)} m)`,
        j.id,
        outBy,
      )
      continue
    }
    resolved.ok = true
  }

  // A wall must keep material after its ends were cut.
  for (const w of m.walls) {
    const e = extents.get(w.id)
    if (!e) continue
    const core = physicalCore(e)
    if (core.a1 - core.a0 <= 1e-6) {
      err('WALL_CONSUMED', `wall ${w.id} has no material left after its junctions were resolved (physical ${fmtNumber(core.a0)}..${fmtNumber(core.a1)} m of ${fmtNumber(wallLength(w))} m)`, w.id, core.a1 - core.a0)
    }
  }

  // Rings: a closed chain of walls joined by corner junctions.
  const junctionById = new Map(m.wallJunctions.map((j) => [j.id, j]))
  for (const ring of m.wallRings) {
    let broken = false
    for (const id of ring.wallIds) {
      if (!walls.has(id)) {
        err('UNKNOWN_WALL', `ring ${ring.id} lists wall "${id}", which does not exist`, ring.id)
        broken = true
      }
    }
    for (const id of ring.junctionIds) {
      if (!junctionById.has(id)) {
        err('UNKNOWN_JUNCTION', `ring ${ring.id} lists junction "${id}", which does not exist`, ring.id)
        broken = true
      }
    }
    if (broken) continue
    const n = ring.wallIds.length
    if (n < 3 || ring.junctionIds.length !== n) {
      err('RING_DEGENERATE', `ring ${ring.id} lists ${n} walls and ${ring.junctionIds.length} junctions; a ring needs at least three of each, one junction per vertex`, ring.id)
      continue
    }
    if (new Set(ring.wallIds).size !== n) {
      err('RING_DEGENERATE', `ring ${ring.id} lists a wall more than once`, ring.id)
      continue
    }
    for (const id of ring.wallIds) {
      if (walls.get(id)!.levelId !== ring.levelId) err('RING_LEVEL_MISMATCH', `ring ${ring.id} on level ${ring.levelId} lists wall ${id} on level ${walls.get(id)!.levelId}`, ring.id)
    }
    for (let i = 0; i < n; i++) {
      const prev = ring.wallIds[(i + n - 1) % n]
      const cur = ring.wallIds[i]
      const j = junctionById.get(ring.junctionIds[i])!
      const joins =
        j.kind === 'CORNER' &&
        ((j.a.wallId === prev && j.a.end === 'END' && j.b.wallId === cur && j.b.end === 'START') ||
          (j.b.wallId === prev && j.b.end === 'END' && j.a.wallId === cur && j.a.end === 'START'))
      if (!joins) {
        err('RING_NOT_CLOSED', `ring ${ring.id}: junction ${j.id} at vertex ${i} must be a CORNER joining the END of ${prev} to the START of ${cur}`, ring.id)
      } else if (!junctions.get(j.id)?.ok) {
        err('RING_NOT_CLOSED', `ring ${ring.id}: corner ${j.id} at vertex ${i} (between ${prev} and ${cur}) could not be resolved`, ring.id)
      }
    }
    const poly = ring.wallIds.map((id) => walls.get(id)!.start)
    if (!polygonIsSimple(poly)) err('RING_DEGENERATE', `ring ${ring.id}: the polygon of its wall start points is not a simple polygon with area`, ring.id)
  }

  return { extents, junctions, endClaims, issues }
}

/** The outer footprint polygon a ring describes: its walls' start points in ring order. */
export function ringPolygon(m: CanonicalBuildingModel, ring: WallRing): Vec2[] | undefined {
  const out: Vec2[] = []
  for (const id of ring.wallIds) {
    const w = m.walls.find((x) => x.id === id)
    if (!w) return undefined
    out.push({ ...w.start })
  }
  return out
}

/** The physical plan footprint of a wall after topology resolution: a convex quadrilateral. */
export function wallPhysicalFootprint(wall: Wall, extent: WallExtent): Vec2[] {
  return [
    wallPlanPointOf(wall, extent.start.outer, 0),
    wallPlanPointOf(wall, extent.end.outer, 0),
    wallPlanPointOf(wall, extent.end.inner, wall.thickness),
    wallPlanPointOf(wall, extent.start.inner, wall.thickness),
  ]
}

// ---------------------------------------------------------------------------
// Overlap between wall footprints
// ---------------------------------------------------------------------------

function ccw(poly: readonly Vec2[]): Vec2[] {
  return polygonSignedArea(poly) >= 0 ? [...poly] : [...poly].reverse()
}

/** Sutherland–Hodgman clip of a convex polygon by a convex, positively oriented polygon. */
function clipConvex(subject: readonly Vec2[], clip: readonly Vec2[]): Vec2[] {
  let out = [...subject]
  for (let i = 0; i < clip.length && out.length > 0; i++) {
    const a = clip[i]
    const b = clip[(i + 1) % clip.length]
    const side = (p: Vec2): number => (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x)
    const input = out
    out = []
    for (let k = 0; k < input.length; k++) {
      const cur = input[k]
      const prev = input[(k + input.length - 1) % input.length]
      const sc = side(cur)
      const sp = side(prev)
      const inCur = sc >= -1e-12
      const inPrev = sp >= -1e-12
      if (inCur) {
        if (!inPrev) out.push(intersect(prev, cur, sp, sc))
        out.push(cur)
      } else if (inPrev) out.push(intersect(prev, cur, sp, sc))
    }
  }
  return out
}

function intersect(p: Vec2, q: Vec2, sp: number, sq: number): Vec2 {
  const t = sp / (sp - sq)
  return { x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t }
}

/** Area shared by two convex plan polygons. */
export function convexOverlapArea(a: readonly Vec2[], b: readonly Vec2[]): number {
  const clipped = clipConvex(ccw(a), ccw(b))
  return clipped.length < 3 ? 0 : Math.abs(polygonSignedArea(clipped))
}

/** Plan overlap area above which two walls sharing a height range are an error. */
export const WALL_OVERLAP_AREA_LIMIT = 1e-6

/**
 * Every pair of walls whose height ranges intersect and whose physical
 * footprints share more than `WALL_OVERLAP_AREA_LIMIT` of plan area. Declared
 * junctions resolve to contact only, so anything found here is an overlap the
 * topology does not justify.
 */
export function wallOverlapIssues(m: CanonicalBuildingModel, extents: ReadonlyMap<string, WallExtent>): ValidationIssue[] {
  const out: ValidationIssue[] = []
  const levels = new Map(m.levels.map((l) => [l.id, l]))
  type Entry = { wall: Wall; foot: Vec2[]; y0: number; y1: number; box: { minX: number; maxX: number; minZ: number; maxZ: number } }
  const entries: Entry[] = []
  for (const w of m.walls) {
    const e = extents.get(w.id)
    const level = levels.get(w.levelId)
    if (!e || !level) continue
    const foot = wallPhysicalFootprint(w, e)
    const box = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }
    for (const p of foot) {
      box.minX = Math.min(box.minX, p.x)
      box.maxX = Math.max(box.maxX, p.x)
      box.minZ = Math.min(box.minZ, p.z)
      box.maxZ = Math.max(box.maxZ, p.z)
    }
    const y0 = level.elevation + w.baseOffset
    entries.push({ wall: w, foot, y0, y1: y0 + w.height, box })
  }
  for (let i = 0; i < entries.length; i++) {
    for (let k = i + 1; k < entries.length; k++) {
      const a = entries[i]
      const b = entries[k]
      if (Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) <= EPS) continue
      if (a.box.maxX <= b.box.minX + EPS || b.box.maxX <= a.box.minX + EPS || a.box.maxZ <= b.box.minZ + EPS || b.box.maxZ <= a.box.minZ + EPS) continue
      const area = convexOverlapArea(a.foot, b.foot)
      if (area > WALL_OVERLAP_AREA_LIMIT) {
        out.push({
          code: 'WALLS_OVERLAP',
          severity: 'ERROR',
          objectId: a.wall.id,
          measured: area,
          message: `walls ${a.wall.id} and ${b.wall.id} share ${area.toFixed(4)} m² of plan area over a common height range; declare a junction (CORNER, BUTT or T) or move one of them`,
        })
      }
    }
  }
  return out
}
