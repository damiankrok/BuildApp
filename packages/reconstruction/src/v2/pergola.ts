/**
 * 005Y-N7 (C): a pergola beside the house, read from the ground plan — only where the plan draws what carries it.
 *
 * A pergola on a plan is its posts: small solid squares standing outside the walls, on the corners of a rectangle
 * that lies against one of the body's faces (its beams are thin lines, which furniture, paving and dimension chains
 * also draw). Nothing is built from a line alone:
 *
 *  - a post is a solid dark square 0.1–0.4 m across, outside the body, clear of it (plants are green, furniture and
 *    paving are outlines, a dimension tick is a line, a chimney stands inside the walls);
 *  - at least three posts stand on the corners of one rectangle (a fourth corner may be the wall's), each side at
 *    least `PERGOLA_MIN_SIDE_M`, and one side of it lies against a face of the body.
 *
 * The posts' positions are SOURCE_DERIVED; the height of the frame, the beams' section and the slats over it are
 * not drawn on a plan and are DISPLAY_ASSUMPTION values, named as such.
 */
import { round6 } from '@buildapp/source-common'
import type { Raster } from '@buildapp/source-cv'
import type { PlanFrameV2 } from './frame.js'
import { lumaAt } from './scan.js'

export type Rect = { x0: number; z0: number; x1: number; z1: number }
export type PergolaSide = 'FRONT' | 'REAR' | 'WEST' | 'EAST'

export type PergolaReading = {
  /** The frame's rectangle through the posts' centres, in world metres. */
  rect: Rect
  posts: Rect[]
  /** The face of the body it stands against. */
  side: PergolaSide
  why: string
}

/** A post is solid: darker than this … */
const POST_LUMA = 80
/** … between these sizes across (m) … */
export const POST_MIN_M = 0.1
export const POST_MAX_M = 0.4
/** … filling at least this share of its box, and about as wide as deep. */
const POST_FILL = 0.75
const POST_ASPECT = 1.6
/** Posts are looked for this far out from the body. */
const PERGOLA_REACH_M = 6
/** Posts on one line of the frame: their centres within this of it. */
const LINE_TOLERANCE_M = 0.15
/** Each side of the frame is at least this long. */
export const PERGOLA_MIN_SIDE_M = 1.5
/** The frame's side towards the body lies within this of the body's face. */
const AGAINST_FACE_M = 0.8
/** What a plan does not draw: the frame's height and its beams' section (DISPLAY_ASSUMPTION). */
export const PERGOLA_HEIGHT_ASSUMED_M = 2.5
export const PERGOLA_BEAM_ASSUMED = { width: 0.12, depth: 0.2 } as const

const inside = (r: Rect, x: number, z: number, margin = 0): boolean => x > r.x0 - margin && x < r.x1 + margin && z > r.z0 - margin && z < r.z1 + margin

/** The solid squares outside the body, within reach of it: the plan's posts. */
export function findPosts(raster: Raster, frame: PlanFrameV2, body: Rect): Rect[] {
  const mpp = (frame.mppX + frame.mppY) / 2
  const a = frame.toPixel(body.x0 - PERGOLA_REACH_M, body.z0 - PERGOLA_REACH_M)
  const b = frame.toPixel(body.x1 + PERGOLA_REACH_M, body.z1 + PERGOLA_REACH_M)
  const px0 = Math.max(0, Math.floor(Math.min(a.x, b.x)))
  const px1 = Math.min(raster.width - 1, Math.ceil(Math.max(a.x, b.x)))
  const py0 = Math.max(0, Math.floor(Math.min(a.y, b.y)))
  const py1 = Math.min(raster.height - 1, Math.ceil(Math.max(a.y, b.y)))
  const W = px1 - px0 + 1
  const seen = new Uint8Array(W * (py1 - py0 + 1))
  const dark = (x: number, y: number): boolean => lumaAt(raster, x, y) < POST_LUMA
  const maxPx = Math.ceil(POST_MAX_M / mpp) + 2
  const posts: Rect[] = []
  for (let y = py0; y <= py1; y += 1)
    for (let x = px0; x <= px1; x += 1) {
      const k = (y - py0) * W + (x - px0)
      if (seen[k] || !dark(x, y)) continue
      // flood the component; one larger than a post is a wall or a hatch, and is dropped as soon as it says so
      const stack = [[x, y]]
      seen[k] = 1
      let n = 0
      let bx0 = x
      let bx1 = x
      let by0 = y
      let by1 = y
      let large = false
      while (stack.length > 0) {
        const [cx, cy] = stack.pop() as [number, number]
        n += 1
        bx0 = Math.min(bx0, cx)
        bx1 = Math.max(bx1, cx)
        by0 = Math.min(by0, cy)
        by1 = Math.max(by1, cy)
        if (bx1 - bx0 > maxPx || by1 - by0 > maxPx) large = true
        for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
          if (nx < px0 || nx > px1 || ny < py0 || ny > py1) continue
          const nk = (ny - py0) * W + (nx - px0)
          if (seen[nk] || !dark(nx, ny)) continue
          seen[nk] = 1
          stack.push([nx, ny])
        }
      }
      if (large) continue
      const w = (bx1 - bx0 + 1) * mpp
      const h = (by1 - by0 + 1) * mpp
      if (w < POST_MIN_M || h < POST_MIN_M || w > POST_MAX_M || h > POST_MAX_M) continue
      if (Math.max(w, h) / Math.min(w, h) > POST_ASPECT || n / ((bx1 - bx0 + 1) * (by1 - by0 + 1)) < POST_FILL) continue
      const p0 = frame.toWorld(bx0, by0)
      const p1 = frame.toWorld(bx1 + 1, by1 + 1)
      const r = { x0: round6(Math.min(p0.x, p1.x)), x1: round6(Math.max(p0.x, p1.x)), z0: round6(Math.min(p0.z, p1.z)), z1: round6(Math.max(p0.z, p1.z)) }
      if (inside(body, (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, 0.05)) continue
      posts.push(r)
    }
  return posts
}

const centre = (r: Rect): { x: number; z: number } => ({ x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 })

/** Values that several posts share, within the tolerance: the lines a frame can stand on. */
function lines(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b)
  const out: number[] = []
  let group: number[] = []
  for (const v of sorted) {
    if (group.length > 0 && v - group[group.length - 1] > LINE_TOLERANCE_M) {
      out.push(group.reduce((s, x) => s + x, 0) / group.length)
      group = []
    }
    group.push(v)
  }
  if (group.length > 0) out.push(group.reduce((s, x) => s + x, 0) / group.length)
  return out
}

/** The face of the body a rectangle lies against, if one does (overlapping it along, within reach across). */
function faceAgainst(r: Rect, body: Rect): PergolaSide | undefined {
  const alongX = Math.min(r.x1, body.x1) - Math.max(r.x0, body.x0) > 0.5
  const alongZ = Math.min(r.z1, body.z1) - Math.max(r.z0, body.z0) > 0.5
  if (alongZ && Math.abs(r.x1 - body.x0) <= AGAINST_FACE_M) return 'WEST'
  if (alongZ && Math.abs(r.x0 - body.x1) <= AGAINST_FACE_M) return 'EAST'
  if (alongX && Math.abs(r.z1 - body.z0) <= AGAINST_FACE_M) return 'FRONT'
  if (alongX && Math.abs(r.z0 - body.z1) <= AGAINST_FACE_M) return 'REAR'
  return undefined
}

/**
 * The pergola the posts make: the largest rectangle against a face of the body with posts on at least three of its
 * corners. Undefined when the posts make none.
 */
export function pergolaFromPosts(posts: Rect[], body: Rect): PergolaReading | undefined {
  const c = posts.map(centre)
  const xs = lines(c.map((p) => p.x))
  const zs = lines(c.map((p) => p.z))
  const near = (p: { x: number; z: number }, x: number, z: number): boolean => Math.abs(p.x - x) <= LINE_TOLERANCE_M && Math.abs(p.z - z) <= LINE_TOLERANCE_M
  let best: PergolaReading | undefined
  let bestArea = 0
  for (let i = 0; i < xs.length; i += 1)
    for (let j = i + 1; j < xs.length; j += 1)
      for (let k = 0; k < zs.length; k += 1)
        for (let l = k + 1; l < zs.length; l += 1) {
          const rect = { x0: round6(xs[i]), x1: round6(xs[j]), z0: round6(zs[k]), z1: round6(zs[l]) }
          if (rect.x1 - rect.x0 < PERGOLA_MIN_SIDE_M || rect.z1 - rect.z0 < PERGOLA_MIN_SIDE_M) continue
          const corners = [
            [rect.x0, rect.z0],
            [rect.x1, rect.z0],
            [rect.x0, rect.z1],
            [rect.x1, rect.z1],
          ].filter(([x, z]) => c.some((p) => near(p, x, z))).length
          if (corners < 3) continue
          const side = faceAgainst(rect, body)
          if (!side) continue
          const area = (rect.x1 - rect.x0) * (rect.z1 - rect.z0)
          if (area <= bestArea) continue
          // the frame's posts: those on its edges
          const onFrame = posts.filter((_, n) => {
            const p = c[n]
            const onX = Math.abs(p.x - rect.x0) <= LINE_TOLERANCE_M || Math.abs(p.x - rect.x1) <= LINE_TOLERANCE_M
            const onZ = Math.abs(p.z - rect.z0) <= LINE_TOLERANCE_M || Math.abs(p.z - rect.z1) <= LINE_TOLERANCE_M
            return (onX && p.z >= rect.z0 - LINE_TOLERANCE_M && p.z <= rect.z1 + LINE_TOLERANCE_M) || (onZ && p.x >= rect.x0 - LINE_TOLERANCE_M && p.x <= rect.x1 + LINE_TOLERANCE_M)
          })
          bestArea = area
          best = { rect, posts: onFrame, side, why: `${onFrame.length} posts drawn as solid squares outside the ${side.toLowerCase()} face stand on a ${(rect.x1 - rect.x0).toFixed(2)} × ${(rect.z1 - rect.z0).toFixed(2)} m frame against it (${corners} of its corners carry a post)` }
        }
  return best
}

/** The frame's beams: its four sides through the posts' centres, at the top of the frame. */
export function pergolaBeams(rect: Rect, topY: number): Array<{ start: { x: number; y: number; z: number }; end: { x: number; y: number; z: number } }> {
  const y = round6(topY - PERGOLA_BEAM_ASSUMED.depth / 2)
  const p = (x: number, z: number) => ({ x: round6(x), y, z: round6(z) })
  return [
    { start: p(rect.x0, rect.z0), end: p(rect.x1, rect.z0) },
    { start: p(rect.x1, rect.z0), end: p(rect.x1, rect.z1) },
    { start: p(rect.x1, rect.z1), end: p(rect.x0, rect.z1) },
    { start: p(rect.x0, rect.z1), end: p(rect.x0, rect.z0) },
  ]
}
