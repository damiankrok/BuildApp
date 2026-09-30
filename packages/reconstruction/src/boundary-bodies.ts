/**
 * What a part of the plan beyond the long-band box is to the building (BUILDPLAN-ANALYZER-005C).
 *
 * The box (`walledEnvelope`) is taken from long walls, so a wing, a garage or a
 * terrace beside the house lies outside it by construction. Whether such a part
 * is built used to be decided by how far two bands reached out of the box
 * (`baysOf`): a threshold that measured 1.86 m on one house and 1.5 m on
 * another, and that no wing with a flush side wall ever met. Here it is decided
 * by the part's relations to the house, read off the boundary evidence:
 *
 *   junction  the edge it shares with the box, and how much of it is wall. A
 *             wing whose rooms run on into the house shares a mostly open edge;
 *             a garage built against the house shares a party wall.
 *   sides     its own perimeter away from the house: wall, free-standing posts,
 *             or nothing.
 *   mouth     the widest gap on that perimeter the outline left open.
 *
 * and named:
 *
 *   PROJECTING_WING    enclosed, and its interior continues the house's across
 *                      an open junction: built.
 *   FLUSH_ATTACHED     enclosed, against a party wall: attached, not a
 *                      continuation of the box's interior.
 *   RECESSED_ATTACHED  inside the box but left open by the outline: an
 *                      entrance, a loggia or a porch the house wraps. Not built.
 *   OPEN_MOUTH_GARAGE  two wall sides and a blank mouth between wall jambs as
 *                      wide as a vehicle, a vehicle's length deep, and the
 *                      only way in from outside: open in the first reading;
 *                      the reading that shuts pocket mouths may shut it. A
 *                      walled terrace with a second opening, or as shallow as
 *                      a terrace, is no garage.
 *   COVERED_TERRACE    carried on posts, not walls: never built.
 *   SEPARATE_BODY      shares no edge with the house.
 *   UNKNOWN            none of these holds.
 *
 * Every part is classified, accepted or not, and reported. The classification
 * decides nothing about metres; it names what the outline did.
 */
import { round6 } from '@buildapp/source-common'
import type { PixelRect } from '@buildapp/source-common'
import type { BoundaryGap, WallLine } from './boundary-evidence.js'
import type { OutlineEdge, OutlineGrid, OutlineResult } from './boundary-outline.js'

export type BodyRelation = 'PROJECTING_WING' | 'FLUSH_ATTACHED' | 'RECESSED_ATTACHED' | 'OPEN_MOUTH_GARAGE' | 'COVERED_TERRACE' | 'SEPARATE_BODY' | 'UNKNOWN'

export type AttachedBody = {
  relation: BodyRelation
  /** Inside the opening-aware outline (closed by wall and bridged openings), or reached only through a gap left open. */
  enclosed: boolean
  /** Part of the plan the building is cut from. */
  built: boolean
  cells: number
  areaM2: number
  rect: PixelRect
  /** The edge shared with the house, and the share of it drawn as wall-thick ink. */
  junction: { lengthM: number; wallShare: number }
  /** Its perimeter away from the house: WALL ink, free-standing posts, and what is left. */
  sides: { lengthM: number; wallShare: number; postShare: number }
  /** The widest gap on that perimeter the outline left open, when there is one. */
  mouth?: { widthM: number; signature: BoundaryGap['signature']; jambs: BoundaryGap['jambs']; gapId: string }
  why: string
}

/** A vehicle door is at least this wide; a person's door is narrower. */
const VEHICLE_MOUTH_M = 2.2
/** A garage is at least a car's length deep behind its door (005C post-review); a terrace between returns is not. */
const VEHICLE_DEPTH_M = 4.5
/**
 * A garage is walled on more than its mouth's worth of its own perimeter: more than half of it wall (005C
 * post-review). A terrace between one garden wall and the house, as deep as its mouth is wide, is exactly half.
 */
const GARAGE_WALL_SHARE = 0.6
/** How many parts one plan may classify. */
export const MAX_BODIES = 16

type Interval = [number, number]
const cover = (intervals: readonly Interval[], a: number, b: number): number => {
  const clipped = intervals
    .map(([p, q]) => [Math.max(p, a), Math.min(q, b)] as Interval)
    .filter(([p, q]) => q > p)
    .sort((p, q) => p[0] - q[0])
  let total = 0
  let reach = -Infinity
  for (const [p, q] of clipped) {
    const s = Math.max(p, reach)
    if (q > s) total += q - s
    reach = Math.max(reach, q)
  }
  return total
}

/**
 * Enclosure with every gap between two pieces of ink bridged, whatever is drawn
 * across it (up to the widest opening a wall can carry): the parts a garage
 * mouth or a row of terrace posts would close. Line work still closes nothing.
 */
function relaxedInside(grid: OutlineGrid, nx: number, ny: number, maxWideOpeningM: number): Uint8Array {
  const { linesX, linesY, wallsX, wallsY, wallPx } = grid
  const tolerance = Math.max(2, Math.round(wallPx * 0.25))
  const closed = (line: WallLine, a: number, b: number): boolean => {
    const ink: Interval[] = line.pieces.map((p) => [p.from, p.to])
    const gaps: Interval[] = line.gaps.filter((g) => g.widthM <= maxWideOpeningM).map((g) => [g.fromPx, g.toPx])
    return b - a - cover([...ink, ...gaps], a, b) <= tolerance
  }
  const v = (ix: number, iy: number): boolean => closed(wallsX[ix], linesY[iy], linesY[iy + 1])
  const h = (iy: number, ix: number): boolean => closed(wallsY[iy], linesX[ix], linesX[ix + 1])
  const reached = new Uint8Array(nx * ny)
  const queue: Array<[number, number]> = []
  const push = (ix: number, iy: number): void => {
    if (ix < 0 || iy < 0 || ix >= nx || iy >= ny || reached[iy * nx + ix] === 1) return
    reached[iy * nx + ix] = 1
    queue.push([ix, iy])
  }
  for (let iy = 0; iy < ny; iy += 1) {
    if (!v(0, iy)) push(0, iy)
    if (!v(nx, iy)) push(nx - 1, iy)
  }
  for (let ix = 0; ix < nx; ix += 1) {
    if (!h(0, ix)) push(ix, 0)
    if (!h(ny, ix)) push(ix, ny - 1)
  }
  while (queue.length > 0) {
    const [ix, iy] = queue.pop() as [number, number]
    if (!v(ix, iy)) push(ix - 1, iy)
    if (!v(ix + 1, iy)) push(ix + 1, iy)
    if (!h(iy, ix)) push(ix, iy - 1)
    if (!h(iy + 1, ix)) push(ix, iy + 1)
  }
  const inside = new Uint8Array(nx * ny)
  for (let i = 0; i < inside.length; i += 1) inside[i] = reached[i] === 1 ? 0 : 1
  return inside
}

/**
 * Classify every part of the plan beyond the house: the enclosed extensions the
 * outline found, and the parts only a bridged mouth or post row would close.
 *
 * `box` marks the long-band box's cells, `house` the cells of the building as
 * cut (the box's cells the outline confirms, and any accepted extension), and
 * `accepted` the extension cells the outline adopted.
 */
export function classifyBodies(grid: OutlineGrid, outline: OutlineResult, box: Uint8Array, house: Uint8Array, accepted: Uint8Array, maxWideOpeningM: number): AttachedBody[] {
  const { linesX, linesY, wallsX, wallsY, mppX, mppY } = grid
  const { nx, ny } = outline
  const index = (ix: number, iy: number): number => iy * nx + ix
  const relaxed = relaxedInside(grid, nx, ny, maxWideOpeningM)
  const bridgedIds = new Set([...outline.bridged.strong.map((g) => g.id), ...outline.bridged.weak.map((w) => w.gap.id)])
  // A part: cells off the house that the box or the relaxed enclosure holds, grouped by adjacency — the box's own
  // cells the outline leaves open (3), enclosed extensions (1) and open ones (2) apart.
  const inPart = (i: number): number => (house[i] === 1 ? 0 : box[i] === 1 ? 3 : outline.inside[i] === 1 ? 1 : relaxed[i] === 1 ? 2 : 0)
  const seen = new Uint8Array(nx * ny)
  type Side = { line: WallLine; a: number; b: number; lengthM: number; edge: OutlineEdge; other: number }
  const sidesOf = (ix: number, iy: number): Side[] => {
    const w = (linesX[ix + 1] - linesX[ix]) * mppX
    const hgt = (linesY[iy + 1] - linesY[iy]) * mppY
    return [
      { line: wallsY[iy], a: linesX[ix], b: linesX[ix + 1], lengthM: w, edge: outline.hEdge[iy][ix], other: iy > 0 ? index(ix, iy - 1) : -1 },
      { line: wallsX[ix + 1], a: linesY[iy], b: linesY[iy + 1], lengthM: hgt, edge: outline.vEdge[ix + 1][iy], other: ix + 1 < nx ? index(ix + 1, iy) : -1 },
      { line: wallsY[iy + 1], a: linesX[ix], b: linesX[ix + 1], lengthM: w, edge: outline.hEdge[iy + 1][ix], other: iy + 1 < ny ? index(ix, iy + 1) : -1 },
      { line: wallsX[ix], a: linesY[iy], b: linesY[iy + 1], lengthM: hgt, edge: outline.vEdge[ix][iy], other: ix > 0 ? index(ix - 1, iy) : -1 },
    ]
  }
  const out: AttachedBody[] = []
  for (let i0 = 0; i0 < nx * ny && out.length < MAX_BODIES; i0 += 1) {
    const kind = inPart(i0)
    if (kind === 0 || seen[i0] === 1) continue
    const members: number[] = []
    const stack = [i0]
    seen[i0] = 1
    while (stack.length > 0) {
      const k = stack.pop() as number
      members.push(k)
      const kx = k % nx
      const ky = (k - kx) / nx
      for (const s of sidesOf(kx, ky)) if (s.other >= 0 && seen[s.other] === 0 && inPart(s.other) === kind) {
        seen[s.other] = 1
        stack.push(s.other)
      }
    }
    members.sort((p, q) => p - q)
    const mine = new Set(members)
    let areaM2 = 0
    let junctionM = 0
    let junctionInk = 0
    let sideM = 0
    let sideWall = 0
    let sidePost = 0
    const openGaps = new Map<string, BoundaryGap>()
    const rect = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
    for (const k of members) {
      const kx = k % nx
      const ky = (k - kx) / nx
      areaM2 += (linesX[kx + 1] - linesX[kx]) * mppX * (linesY[ky + 1] - linesY[ky]) * mppY
      rect.x0 = Math.min(rect.x0, linesX[kx])
      rect.x1 = Math.max(rect.x1, linesX[kx + 1])
      rect.y0 = Math.min(rect.y0, linesY[ky])
      rect.y1 = Math.max(rect.y1, linesY[ky + 1])
      for (const s of sidesOf(kx, ky)) {
        if (s.other >= 0 && mine.has(s.other)) continue
        const span = Math.max(1e-9, s.b - s.a)
        const wallInk = cover(s.line.pieces.filter((p) => p.kind === 'WALL').map((p) => [p.from, p.to] as Interval), s.a, s.b) / span
        const postInk = cover(s.line.pieces.filter((p) => p.kind === 'POST').map((p) => [p.from, p.to] as Interval), s.a, s.b) / span
        // the house, and the parts this reading builds: a neighbour's walls are its junction, never its own sides
        if (s.other >= 0 && (house[s.other] === 1 || (accepted[s.other] === 1 && !mine.has(s.other)))) {
          junctionM += s.lengthM
          junctionInk += s.lengthM * Math.min(1, wallInk + postInk)
          continue
        }
        sideM += s.lengthM
        sideWall += s.lengthM * wallInk
        sidePost += s.lengthM * postInk
        for (const g of s.line.gaps) if (!bridgedIds.has(g.id) && Math.min(g.toPx, s.b) - Math.max(g.fromPx, s.a) > 0) openGaps.set(g.id, g)
      }
    }
    const junction = { lengthM: round6(junctionM), wallShare: round6(junctionM > 0 ? junctionInk / junctionM : 0) }
    const sides = { lengthM: round6(sideM), wallShare: round6(sideM > 0 ? sideWall / sideM : 0), postShare: round6(sideM > 0 ? sidePost / sideM : 0) }
    const widest = [...openGaps.values()].sort((p, q) => q.widthM - p.widthM || (p.id < q.id ? -1 : p.id > q.id ? 1 : 0))[0]
    const mouth = widest ? { widthM: round6(widest.widthM), signature: widest.signature, jambs: widest.jambs, gapId: widest.id } : undefined
    const depthM = widest ? (widest.axis === 'Y' ? (rect.y1 - rect.y0) * mppY : (rect.x1 - rect.x0) * mppX) : 0
    const enclosed = kind === 1
    const built = members.some((k) => accepted[k] === 1)
    let relation: BodyRelation
    let why: string
    if (junctionM === 0) {
      relation = 'SEPARATE_BODY'
      why = 'it shares no edge with the house'
    } else if (kind === 3) {
      relation = 'RECESSED_ATTACHED'
      why = `inside the box, but the outline leaves it open${mouth ? ` through a ${mouth.widthM.toFixed(2)} m ${mouth.signature.toLowerCase()} gap` : ''}: a recess the house wraps, not built`
    } else if (enclosed && built) {
      relation = junction.wallShare < 0.5 ? 'PROJECTING_WING' : 'FLUSH_ATTACHED'
      why = `enclosed by wall and openings, its interior running on into the house across ${junction.lengthM.toFixed(2)} m of junction ${Math.round(junction.wallShare * 100)}% drawn as wall`
    } else if (enclosed) {
      relation = junction.wallShare >= 0.5 && sides.wallShare >= 0.35 ? 'FLUSH_ATTACHED' : 'UNKNOWN'
      why = `enclosed, but walled off from the house on every shared edge (${Math.round(junction.wallShare * 100)}% of the junction is wall): not a continuation of its interior, and not built in this reading`
    } else if (mouth && openGaps.size === 1 && depthM >= VEHICLE_DEPTH_M && mouth.jambs[0] === 'WALL' && mouth.jambs[1] === 'WALL' && mouth.widthM >= VEHICLE_MOUTH_M && mouth.widthM <= maxWideOpeningM && (mouth.signature === 'BLANK' || mouth.signature === 'DASHED') && sides.wallShare >= GARAGE_WALL_SHARE && sides.postShare < 0.1) {
      relation = 'OPEN_MOUTH_GARAGE'
      why = `walls on ${Math.round(sides.wallShare * 100)}% of its own perimeter and a ${mouth.widthM.toFixed(2)} m mouth between wall jambs with nothing drawn across it: open in this reading; the reading that shuts pocket mouths may shut it`
    } else if (sides.postShare > 0 && sides.wallShare < 0.35) {
      relation = 'COVERED_TERRACE'
      why = `carried on free-standing posts (${Math.round(sides.postShare * 100)}% of its perimeter) with ${Math.round(sides.wallShare * 100)}% wall: a terrace or a canopy, never built`
    } else {
      relation = 'UNKNOWN'
      why = `open to the outside${mouth ? ` through a ${mouth.widthM.toFixed(2)} m ${mouth.signature.toLowerCase()} gap` : ''}, ${Math.round(sides.wallShare * 100)}% of its perimeter wall and ${Math.round(sides.postShare * 100)}% posts: nothing names what it is`
    }
    out.push({ relation, enclosed, built, cells: members.length, areaM2: round6(areaM2), rect: { x0: round6(rect.x0), y0: round6(rect.y0), x1: round6(rect.x1), y1: round6(rect.y1) }, junction, sides, ...(mouth ? { mouth } : {}), why })
  }
  return out
}
