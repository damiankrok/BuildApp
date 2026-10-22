/**
 * 005Y-N7 (C): a covered terrace or porch cut out of a corner of a body — the roof carries on over it, the walls step in.
 *
 * The layout reads a body as its rectangle; a recess in one face (a pocket) is found by the plan's decomposition, but
 * one at a corner is open on two sides and has no returns, and the body was built closed over it: its open sides
 * read as one wide floor-length "window" each. On the plan the corner says what it is:
 *
 *  - along both faces from the corner the wall band is not drawn (no solid ink across the wall's depth);
 *  - where the open stretches end, the recess's back walls step in, meeting at the inner corner; at least one is
 *    drawn solid and as thick as the outer walls (the other may be almost all door);
 *  - no room the plan labels lies inside the notch (a corner window has a room behind it, and no thick wall where its
 *    glass ends).
 *
 * Only then is the corner a recess: two passages through the ring walls open through the corner, the two back walls,
 * and the post the plan draws at the outer corner when it draws one. The roof is not touched.
 */
import { round6 } from '@buildapp/source-common'
import type { Raster } from '@buildapp/source-cv'
import type { PlanFrameV2 } from './frame.js'
import { lumaAt } from './scan.js'

export type CornerXSide = 'WEST' | 'EAST'
export type CornerZSide = 'FRONT' | 'REAR'
export type Rect = { x0: number; z0: number; x1: number; z1: number }

export type CornerNotch = {
  xSide: CornerXSide
  zSide: CornerZSide
  /** The notch in world metres: the open corner of the body's rectangle, to the back walls' faces. */
  rect: Rect
  /** Darkness of the two back walls over their length (the wall along z, the wall along x). */
  backShares: [number, number]
  /** A post at the outer corner, when the plan draws one. */
  post?: Rect
  why: string
}

/** Wall ink: solid, darker than this. */
const WALL_LUMA = 128
/** A stretch of the face is open where less than this share of the wall's depth is ink. */
const OPEN_DEPTH_SHARE = 0.4
/** The open stretch ends where the wall band is solid again over this length. */
const SOLID_RUN_M = 0.3
/** A notch is at least this deep along each face (a corner window's pier, a jog in the ink, is less). */
export const NOTCH_MIN_M = 1.2
/** … and leaves the rest of the face as wall: a notch is a corner of a body, not the body. */
const NOTCH_MAX_SHARE = 0.75
/**
 * At least one back wall is solid over this share of its length. The other may be almost all door — a terrace's
 * short back wall often is one wide glazed door — but a corner window has no wall this thick behind it at all.
 */
const BACK_WALL_SHARE = 0.6
/** The open stretch is open over at least this share of it (a mullion or a post line may cross it). */
const OPEN_SHARE = 0.8
/** A post: the outer corner block is solid over at least this share. */
const POST_SHARE = 0.6

type Sampler = { mpp: number; dark: (x: number, z: number) => boolean }

function samplerOf(raster: Raster, frame: PlanFrameV2): Sampler {
  return {
    mpp: (frame.mppX + frame.mppY) / 2,
    dark: (x, z) => {
      const p = frame.toPixel(x, z)
      return lumaAt(raster, p.x, p.y) < WALL_LUMA
    },
  }
}

/**
 * Share of a wall band's depth that is ink at one place along it: the band runs along `axis`, its face at `face`, its
 * material on the side `into` (+1/-1 across the axis), `T` deep. The middle of the depth is sampled (a face line drawn
 * thin is not a wall).
 */
function depthShare(s: Sampler, axis: 'X' | 'Z', along: number, face: number, into: 1 | -1, T: number): number {
  let hit = 0
  let n = 0
  for (let d = 0.2 * T; d <= 0.8 * T; d += s.mpp) {
    const c = face + into * d
    n += 1
    if (axis === 'X' ? s.dark(along, c) : s.dark(c, along)) hit += 1
  }
  return n > 0 ? hit / n : 0
}

/** Share of a stretch of a wall band that is solid (most of its depth ink). */
function bandShare(s: Sampler, axis: 'X' | 'Z', a0: number, a1: number, face: number, into: 1 | -1, T: number): number {
  let solid = 0
  let n = 0
  for (let a = Math.min(a0, a1); a <= Math.max(a0, a1); a += s.mpp) {
    n += 1
    if (depthShare(s, axis, a, face, into, T) >= 1 - OPEN_DEPTH_SHARE) solid += 1
  }
  return n > 0 ? solid / n : 0
}

/**
 * How far the wall band is open along a face from a corner: from just past the corner block, walking away from it,
 * to where the band is solid again over `SOLID_RUN_M`. Undefined when it is solid at once or never again.
 */
function openStretch(s: Sampler, axis: 'X' | 'Z', corner: number, dir: 1 | -1, limit: number, face: number, into: 1 | -1, T: number): { length: number; openShare: number } | undefined {
  let solidRun = 0
  let open = 0
  let total = 0
  for (let a = corner + dir * T; dir > 0 ? a <= limit : a >= limit; a += dir * s.mpp) {
    total += 1
    if (depthShare(s, axis, a, face, into, T) < 1 - OPEN_DEPTH_SHARE) {
      open += 1
      solidRun = 0
      continue
    }
    // a solid run shorter than SOLID_RUN_M (a mullion, a post) is part of the stretch
    solidRun += s.mpp
    if (solidRun < SOLID_RUN_M) continue
    if (open === 0) return undefined
    const end = a - dir * (solidRun - s.mpp)
    const counted = total - Math.round(solidRun / s.mpp)
    return { length: round6(Math.abs(end - corner)), openShare: round6(open / Math.max(1, counted)) }
  }
  return undefined
}

/**
 * The notch at one corner of a body's rectangle on a storey's plan, or undefined (with the reason) when the corner is
 * closed, or open only as a window is. `insideRoom` says whether a room the plan labels lies in a rectangle.
 */
export function readCornerNotch(raster: Raster, frame: PlanFrameV2, body: Rect, T: number, xSide: CornerXSide, zSide: CornerZSide, insideRoom: (r: Rect) => boolean, onReject?: (why: string) => void): CornerNotch | undefined {
  const reject = (why: string): undefined => {
    onReject?.(why)
    return undefined
  }
  const s = samplerOf(raster, frame)
  const cx = xSide === 'WEST' ? body.x0 : body.x1
  const cz = zSide === 'FRONT' ? body.z0 : body.z1
  const intoX: 1 | -1 = xSide === 'WEST' ? 1 : -1
  const intoZ: 1 | -1 = zSide === 'FRONT' ? 1 : -1
  const width = body.x1 - body.x0
  const depth = body.z1 - body.z0
  // along the zSide face (a band running along x), and along the xSide face (a band running along z)
  const alongZFace = openStretch(s, 'X', cx, intoX, cx + intoX * (width - T), cz, intoZ, T)
  const alongXFace = openStretch(s, 'Z', cz, intoZ, cz + intoZ * (depth - T), cx, intoX, T)
  const name = `${zSide.toLowerCase()}-${xSide.toLowerCase()} corner`
  if (!alongZFace || !alongXFace) return reject(`${name}: the wall band is drawn ${!alongZFace ? `along the ${zSide.toLowerCase()} face` : `along the ${xSide.toLowerCase()} face`} from the corner`)
  const bx = alongZFace.length
  const az = alongXFace.length
  if (bx > width * NOTCH_MAX_SHARE || az > depth * NOTCH_MAX_SHARE) return reject(`${name}: open ${bx.toFixed(2)} m and ${az.toFixed(2)} m along faces ${width.toFixed(2)} and ${depth.toFixed(2)} m long: more than a corner`)
  if (bx < NOTCH_MIN_M || az < NOTCH_MIN_M) return reject(`${name}: open ${bx.toFixed(2)} m along the ${zSide.toLowerCase()} face and ${az.toFixed(2)} m along the ${xSide.toLowerCase()} face; a notch is at least ${NOTCH_MIN_M} m each way`)
  if (alongZFace.openShare < OPEN_SHARE || alongXFace.openShare < OPEN_SHARE) return reject(`${name}: the open stretches are open over ${Math.round(alongZFace.openShare * 100)} % and ${Math.round(alongXFace.openShare * 100)} % only`)
  // the back walls: one parallel to the xSide face at bx in, running from the zSide face az deep; one parallel to the
  // zSide face at az in, running from the xSide face bx along — each as thick as the outer walls
  const innerX = cx + intoX * bx
  const innerZ = cz + intoZ * az
  const backAlongZ = bandShare(s, 'Z', cz + intoZ * T, innerZ, innerX, intoX, T)
  const backAlongX = bandShare(s, 'X', cx + intoX * T, innerX, innerZ, intoZ, T)
  if (Math.max(backAlongZ, backAlongX) < BACK_WALL_SHARE) return reject(`${name}: open ${bx.toFixed(2)} × ${az.toFixed(2)} m, but no wall as thick as the outer walls steps in where the open stretches end (${Math.round(backAlongZ * 100)} %, ${Math.round(backAlongX * 100)} % solid): a corner window, not a recess`)
  const rect: Rect = { x0: round6(Math.min(cx, innerX)), x1: round6(Math.max(cx, innerX)), z0: round6(Math.min(cz, innerZ)), z1: round6(Math.max(cz, innerZ)) }
  if (insideRoom(rect)) return reject(`${name}: a room the plan labels lies in the open ${bx.toFixed(2)} × ${az.toFixed(2)} m corner: glazing round a room, not a recess`)
  const corner: Rect = { x0: round6(Math.min(cx, cx + intoX * T)), x1: round6(Math.max(cx, cx + intoX * T)), z0: round6(Math.min(cz, cz + intoZ * T)), z1: round6(Math.max(cz, cz + intoZ * T)) }
  let solid = 0
  let n = 0
  for (let x = corner.x0 + s.mpp; x < corner.x1; x += s.mpp)
    for (let z = corner.z0 + s.mpp; z < corner.z1; z += s.mpp) {
      n += 1
      if (s.dark(x, z)) solid += 1
    }
  const post = n > 0 && solid / n >= POST_SHARE ? corner : undefined
  return {
    xSide,
    zSide,
    rect,
    backShares: [round6(backAlongZ), round6(backAlongX)],
    ...(post ? { post } : {}),
    why: `the ${name} is open ${bx.toFixed(2)} m along the ${zSide.toLowerCase()} face and ${az.toFixed(2)} m along the ${xSide.toLowerCase()} face, where walls as thick as the outer walls step in (${Math.round(backAlongZ * 100)} % and ${Math.round(backAlongX * 100)} % solid, doors between); no room is labelled inside${post ? '; the plan draws a post at the outer corner' : ''}`,
  }
}
