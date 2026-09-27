/**
 * The cross-section basis of a linear solid.
 *
 * A member is stated as a centreline plus two cross-section dimensions, which
 * is the smallest description that is also unambiguous — but only if the axes
 * those dimensions are measured along are derived the same way everywhere. So
 * they are derived HERE, once, and the validator, the compiler, the viewer and
 * the reconstruction solver all call this function rather than each rebuilding
 * the frame from the path and quietly disagreeing about which way is up.
 *
 * The derivation, for a path direction `d`:
 *
 * - `depthAxis = normalize(d × up)`. For a horizontal member this is
 *   horizontal and perpendicular to the path — the direction it stands proud
 *   of a wall, which is what "depth" means for a member on a facade. For a
 *   vertical member the cross product vanishes and the axis falls back to
 *   world +z, which is into the building.
 * - `widthAxis = normalize(depthAxis × d)`. For a horizontal member this is
 *   world up: the dimension you see in an elevation.
 *
 * `rollDeg` then rotates both about the path, for a member whose section is not
 * square to the world — a raking gable member, a canted fin.
 */
import type { Vec3 } from './geometry-types.js'
import type { LinearSolid, MemberCut } from './schema.js'

const EPS = 1e-9

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x })
const length = (a: Vec3): number => Math.hypot(a.x, a.y, a.z)

function normalize(a: Vec3): Vec3 {
  const n = length(a)
  return n < EPS ? { x: 0, y: 0, z: 0 } : { x: a.x / n, y: a.y / n, z: a.z / n }
}

const scale = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k })
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })

export type LinearSolidBasis = {
  /** Unit vector from start to end. Zero when the member is degenerate. */
  pathDir: Vec3
  /** Unit vector the `width` is measured along. */
  widthAxis: Vec3
  /** Unit vector the `depth` is measured along. */
  depthAxis: Vec3
  /** Centreline length. */
  length: number
}

/** True when the member has no length to extrude along. */
export const linearSolidIsDegenerate = (solid: Pick<LinearSolid, 'start' | 'end'>): boolean => length(sub(solid.end, solid.start)) < 1e-6

export function linearSolidBasis(solid: Pick<LinearSolid, 'start' | 'end' | 'rollDeg'>): LinearSolidBasis {
  const along = sub(solid.end, solid.start)
  const len = length(along)
  if (len < 1e-6) return { pathDir: { x: 0, y: 0, z: 0 }, widthAxis: { x: 0, y: 1, z: 0 }, depthAxis: { x: 0, y: 0, z: 1 }, length: 0 }
  const pathDir = normalize(along)
  const up: Vec3 = { x: 0, y: 1, z: 0 }
  let depth0 = cross(pathDir, up)
  // A vertical member: the cross product with up vanishes, so pick a fixed
  // world axis rather than an arbitrary one, so two vertical members with the
  // same numbers are the same shape.
  if (length(depth0) < 1e-6) depth0 = { x: 0, y: 0, z: 1 }
  const depthAxis0 = normalize(depth0)
  const widthAxis0 = normalize(cross(depthAxis0, pathDir))

  const roll = ((solid.rollDeg ?? 0) * Math.PI) / 180
  if (Math.abs(roll) < 1e-12) return { pathDir, widthAxis: widthAxis0, depthAxis: depthAxis0, length: len }
  const c = Math.cos(roll)
  const s = Math.sin(roll)
  const widthAxis = normalize(add(scale(widthAxis0, c), scale(depthAxis0, s)))
  const depthAxis = normalize(add(scale(depthAxis0, c), scale(widthAxis0, -s)))
  return { pathDir, widthAxis, depthAxis, length: len }
}

/**
 * Where each of the member's four long arrises meets its end planes, as
 * distances along the path from the start face: `[start, end]` per arris, in
 * the corner order below. Square ends give `[0, length]`; a stated cut moves
 * each arris end to where it crosses the cut plane. `null` when a cut plane
 * runs (nearly) along the path, so it cannot end the member.
 */
export function linearSolidArrisSpans(solid: Pick<LinearSolid, 'start' | 'end' | 'rollDeg' | 'width' | 'depth' | 'startCut' | 'endCut'>): Array<[number, number]> | null {
  const b = linearSolidBasis(solid)
  const hw = solid.width / 2
  const hd = solid.depth / 2
  const out: Array<[number, number]> = []
  const at = (cut: MemberCut | undefined, q: Vec3, nominal: number): number | null => {
    if (!cut) return nominal
    const n = cut.normal
    const nl = length(n)
    if (nl < EPS) return null
    const nd = (n.x * b.pathDir.x + n.y * b.pathDir.y + n.z * b.pathDir.z) / nl
    if (Math.abs(nd) < 0.2) return null
    const w = sub(cut.point, q)
    return (w.x * n.x + w.y * n.y + w.z * n.z) / (nl * nd)
  }
  for (const [w, d] of CORNER_OFFSETS) {
    const q = add(solid.start, add(scale(b.widthAxis, w * hw), scale(b.depthAxis, d * hd)))
    const s = at(solid.startCut, q, 0)
    const e = at(solid.endCut, q, b.length)
    if (s === null || e === null) return null
    out.push([s, e])
  }
  return out
}

const CORNER_OFFSETS: ReadonlyArray<[number, number]> = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
]

/**
 * What is wrong with a member's stated end cuts, in words, or `null`: a cut
 * plane along the path, a cut that leaves an arris with no length, or one that
 * moves an arris end further than the section is deep (a cut that is not a
 * joint at that end but a different member).
 */
export function linearSolidCutIssue(solid: Pick<LinearSolid, 'start' | 'end' | 'rollDeg' | 'width' | 'depth' | 'startCut' | 'endCut'>): string | null {
  if (!solid.startCut && !solid.endCut) return null
  const spans = linearSolidArrisSpans(solid)
  if (!spans) return 'a cut plane runs within 78° of the member\'s path, so it cannot end it'
  const L = linearSolidBasis(solid).length
  const reach = 5 * (solid.width + solid.depth)
  for (const [s, e] of spans) {
    if (!(e - s > 1e-6)) return 'the cuts leave an arris with no length'
    if (Math.abs(s) > reach || Math.abs(e - L) > reach) return 'a cut moves an arris end further than a joint could'
  }
  return null
}

/**
 * The eight corners of the member's box, in a fixed order: the start face's
 * four corners then the end face's, each face ordered (−w −d), (+w −d),
 * (+w +d), (−w +d). Fixed so a compiler can index them rather than search.
 * A stated end cut moves that face's corners along their arrises into the
 * cut plane.
 */
export function linearSolidCorners(solid: Pick<LinearSolid, 'start' | 'end' | 'rollDeg' | 'width' | 'depth'> & Partial<Pick<LinearSolid, 'startCut' | 'endCut'>>): Vec3[] {
  const b = linearSolidBasis(solid)
  const hw = solid.width / 2
  const hd = solid.depth / 2
  const spans = solid.startCut || solid.endCut ? linearSolidArrisSpans(solid) : null
  const corner = (i: number, t: number | null, centre: Vec3): Vec3 => {
    const [w, d] = CORNER_OFFSETS[i]
    const base = t === null ? centre : add(solid.start, scale(b.pathDir, t))
    return add(base, add(scale(b.widthAxis, w * hw), scale(b.depthAxis, d * hd)))
  }
  return [
    ...[0, 1, 2, 3].map((i) => corner(i, spans ? spans[i][0] : null, solid.start)),
    ...[0, 1, 2, 3].map((i) => corner(i, spans ? spans[i][1] : null, solid.end)),
  ]
}

/** Axis-aligned bounds of the member's box. */
export function linearSolidBounds(solid: Pick<LinearSolid, 'start' | 'end' | 'rollDeg' | 'width' | 'depth'>): { min: Vec3; max: Vec3 } {
  const corners = linearSolidCorners(solid)
  const min = { x: Infinity, y: Infinity, z: Infinity }
  const max = { x: -Infinity, y: -Infinity, z: -Infinity }
  for (const c of corners) {
    min.x = Math.min(min.x, c.x)
    min.y = Math.min(min.y, c.y)
    min.z = Math.min(min.z, c.z)
    max.x = Math.max(max.x, c.x)
    max.y = Math.max(max.y, c.y)
    max.z = Math.max(max.z, c.z)
  }
  return { min, max }
}

/**
 * Volume of the member: the number an oracle checks a compiled mesh against.
 * A cut prism holds its section times the length of its centroid axis, which
 * is the mean of the four arris lengths.
 */
export function linearSolidVolume(solid: Pick<LinearSolid, 'start' | 'end' | 'width' | 'depth'> & Partial<Pick<LinearSolid, 'rollDeg' | 'startCut' | 'endCut'>>): number {
  if (!solid.startCut && !solid.endCut) return length(sub(solid.end, solid.start)) * solid.width * solid.depth
  const spans = linearSolidArrisSpans(solid)
  if (!spans) return 0
  return (spans.reduce((a, [s, e]) => a + (e - s), 0) / 4) * solid.width * solid.depth
}
