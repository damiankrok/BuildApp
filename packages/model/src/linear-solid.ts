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
import type { LinearSolid } from './schema.js'

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
 * The eight corners of the member's box, in a fixed order: the start face's
 * four corners then the end face's, each face ordered (−w −d), (+w −d),
 * (+w +d), (−w +d). Fixed so a compiler can index them rather than search.
 */
export function linearSolidCorners(solid: Pick<LinearSolid, 'start' | 'end' | 'rollDeg' | 'width' | 'depth'>): Vec3[] {
  const b = linearSolidBasis(solid)
  const hw = solid.width / 2
  const hd = solid.depth / 2
  const offsets: Array<[number, number]> = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ]
  const face = (centre: Vec3): Vec3[] => offsets.map(([w, d]) => add(centre, add(scale(b.widthAxis, w), scale(b.depthAxis, d))))
  return [...face(solid.start), ...face(solid.end)]
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

/** Volume of the member's box: the number an oracle checks a compiled mesh against. */
export const linearSolidVolume = (solid: Pick<LinearSolid, 'start' | 'end' | 'width' | 'depth'>): number => length(sub(solid.end, solid.start)) * solid.width * solid.depth
