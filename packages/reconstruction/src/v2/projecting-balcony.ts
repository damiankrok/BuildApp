/**
 * 005Y-N7 (C): a balcony that stands proud of the wall, read from the plan of the storey it opens from.
 *
 * A balcony inside a recess is read from the recess (its fascia on the render). One that projects past the wall line
 * has no recess: the plan draws it as a thin outline beyond the wall's outer face, in front of the doors that open
 * onto it, closed back to the face by a line at each end. All three are required:
 *
 *  - a floor-level opening (a door or a French window) in that face on that storey — an upper-storey door to the
 *    outside needs somewhere to step;
 *  - an outer line parallel to the face, 0.6–3 m out, covering the doors' span — the slab's edge (often drawn
 *    doubled: the balustrade);
 *  - a line from that edge back to the face at each end of it — what a dimension chain, which also runs parallel to
 *    a face, never draws. A chain (or the roof's overhang) also runs past a corner of the facade; an outline does not.
 *
 * The plan gives the slab's footprint (SOURCE_DERIVED). Its thickness and the balustrade's height are not drawn on a
 * plan: they are DISPLAY_ASSUMPTION values, named as such.
 */
import { round6 } from '@buildapp/source-common'
import type { Raster } from '@buildapp/source-cv'
import type { PlanFrameV2 } from './frame.js'
import { lumaAt } from './scan.js'

export type BalconySide = 'FRONT' | 'REAR' | 'WEST' | 'EAST'

export type BalconyOutline = {
  /** Distance from the wall's outer face to the outline's outer line, metres. */
  reach: number
  /** The outline's extent along the facade. */
  from: number
  to: number
  /** Share of the depth each end's return line is drawn over (low end, high end). */
  returns: [number, number]
  why: string
}

/** Ink: anything darker than this on the plan (lines, hatch borders). */
const LINE_LUMA = 200
/** The outline is looked for this far out from the face … */
export const BALCONY_MIN_REACH_M = 0.6
/** … up to this far (a deeper platform on an upper storey is a terrace on a roof, not read here). */
export const BALCONY_MAX_REACH_M = 3
/** The outer line spans at least this share of the doors' span (a callout printed on it breaks it). */
const EDGE_COVERAGE = 0.75
/** A doubled edge (slab and balustrade) is two lines at most this far apart. */
const EDGE_DOUBLE_M = 0.15
/** Each end's return line is drawn over at least this share of the depth. */
const RETURN_COVERAGE = 0.7
/** A line running past a corner of the facade by more than this is a dimension chain or a roof edge. */
const PAST_CORNER_M = 0.3
/** Lines closer than this to the return before them are part of the same end (a doubled line, an extension line). */
const RETURN_CLUSTER_M = 0.4
/** Between its two returns the edge is drawn over at least this share (a callout printed on it breaks it). */
const EDGE_SPAN_COVERAGE = 0.8
/** Beyond each return the edge's row is checked over this stretch … */
const BEYOND_FROM_M = 0.15
const BEYOND_TO_M = 0.6
/** … and is drawn over less than this share: the slab's edge turns at its corner; an overhang or a chain runs on. */
const BEYOND_MAX_COVERAGE = 0.5

const outward = (side: BalconySide): 1 | -1 => (side === 'FRONT' || side === 'WEST' ? -1 : 1)
const alongX = (side: BalconySide): boolean => side === 'FRONT' || side === 'REAR'

type Probe = { ink: (a: number, c: number) => boolean; inside: (a: number, c: number) => boolean; mpp: number }

/** Ink at a world point (along the facade, across it), with a pixel of slack across a thin line. */
function probeOf(raster: Raster, frame: PlanFrameV2, side: BalconySide): Probe {
  const ax = alongX(side)
  const px = (a: number, c: number) => (ax ? frame.toPixel(a, c) : frame.toPixel(c, a))
  const inside = (a: number, c: number): boolean => {
    const p = px(a, c)
    return p.x >= 1 && p.y >= 1 && p.x < raster.width - 1 && p.y < raster.height - 1
  }
  const ink = (a: number, c: number): boolean => {
    const p = px(a, c)
    const x = Math.round(p.x)
    const y = Math.round(p.y)
    // one pixel either way across the line's direction (a line along the facade is crossed in c, a return in a)
    return Math.min(lumaAt(raster, x, y), lumaAt(raster, x + 1, y), lumaAt(raster, x - 1, y), lumaAt(raster, x, y + 1), lumaAt(raster, x, y - 1)) < LINE_LUMA
  }
  return { ink, inside, mpp: (frame.mppX + frame.mppY) / 2 }
}

/** Share of the stretch a0..a1 (along the facade) at depth c that is ink. */
function rowCoverage(p: Probe, c: number, a0: number, a1: number): number {
  let hit = 0
  let n = 0
  for (let a = a0; a <= a1; a += p.mpp) {
    n += 1
    if (p.ink(a, c)) hit += 1
  }
  return n > 0 ? hit / n : 0
}

/** The best share of the depth c0..c1 (across the facade) drawn near `a`, and where exactly that line is. */
function returnCoverage(p: Probe, a: number, c0: number, c1: number): { coverage: number; at: number } {
  let best = { coverage: 0, at: a }
  // the return may sit a pixel or two either side of where it is looked for
  for (const da of [0, -p.mpp, p.mpp, -2 * p.mpp, 2 * p.mpp]) {
    let hit = 0
    let n = 0
    for (let c = Math.min(c0, c1); c <= Math.max(c0, c1); c += p.mpp) {
      n += 1
      if (p.ink(a + da, c)) hit += 1
    }
    const coverage = n > 0 ? hit / n : 0
    if (coverage > best.coverage) best = { coverage, at: a + da }
  }
  return best
}

/**
 * The lines out from the face that span the doors, nearest first: each a row of ink across them, taken with its
 * doubled partner when one is drawn within `EDGE_DOUBLE_M`.
 */
function* edgeCandidates(p: Probe, faceAt: number, out: 1 | -1, a0: number, a1: number): Generator<number> {
  for (let d = BALCONY_MIN_REACH_M; d <= BALCONY_MAX_REACH_M; d += p.mpp) {
    const c = faceAt + out * d
    if (!p.inside((a0 + a1) / 2, c)) return
    if (rowCoverage(p, c, a0, a1) < EDGE_COVERAGE) continue
    let edge = d
    for (let e = d + p.mpp; e <= d + EDGE_DOUBLE_M; e += p.mpp) if (rowCoverage(p, faceAt + out * e, a0, a1) >= EDGE_COVERAGE) edge = e
    yield edge
    d = edge + p.mpp
  }
}

/**
 * Where the outline ends along the facade: the nearest group of lines, outside the doors' span, that run from the
 * face out to the edge (a return), and of that group the outermost. Searched from the doors out towards each corner, never past it by more than `PAST_CORNER_M`.
 */
function returnAt(p: Probe, from: number, limit: number, c0: number, c1: number): { at: number; coverage: number } | undefined {
  const dir = Math.sign(limit - from) || 1
  let found: { at: number; coverage: number } | undefined
  for (let a = from; dir > 0 ? a <= limit : a >= limit; a += dir * p.mpp) {
    // a return is often drawn doubled, with a dimension's extension line beside it: the outline's end is the
    // outermost line of that cluster
    if (found && Math.abs(a - found.at) > RETURN_CLUSTER_M) break
    const r = returnCoverage(p, a, c0, c1)
    if (r.coverage >= RETURN_COVERAGE && (!found || (r.at - found.at) * dir > 0)) found = r
  }
  return found
}

/**
 * The balcony outline in front of `doorSpan` on the `side` face at `faceAt`, or undefined when the plan draws none.
 * `wallSpan` is the facade's extent along it: the returns are looked for within it.
 */
export function readBalconyOutline(raster: Raster, frame: PlanFrameV2, side: BalconySide, faceAt: number, doorSpan: [number, number], wallSpan: [number, number], onReject?: (why: string) => void): BalconyOutline | undefined {
  const reject = (why: string): undefined => {
    onReject?.(why)
    return undefined
  }
  const p = probeOf(raster, frame, side)
  const out = outward(side)
  const a0 = doorSpan[0] + 0.05
  const a1 = doorSpan[1] - 0.05
  if (a1 - a0 < 0.4) return reject('the doors span less than 0.4 m')
  // A line not closed back to the face at both ends — the roof's overhang drawn round the storey, a dimension chain —
  // is not the slab's edge; the search goes on out past it.
  const passed: string[] = []
  for (const reach of edgeCandidates(p, faceAt, out, a0, a1)) {
    const edgeAt = faceAt + out * reach
    // the returns stand between the face and the edge, short of both lines themselves
    const c0 = faceAt + out * 0.1
    const c1 = edgeAt - out * 0.1
    const low = returnAt(p, doorSpan[0], wallSpan[0] - PAST_CORNER_M, c0, c1)
    const high = returnAt(p, doorSpan[1], wallSpan[1] + PAST_CORNER_M, c0, c1)
    if (!low || !high) {
      passed.push(`${reach.toFixed(2)} m: no return to the face ${!low ? 'below' : 'above'} the doors`)
      continue
    }
    // the edge runs between the two returns (a callout printed on it may break it)
    const coverage = rowCoverage(p, edgeAt, low.at, high.at)
    if (coverage < EDGE_SPAN_COVERAGE) {
      passed.push(`${reach.toFixed(2)} m: the line covers ${Math.round(coverage * 100)} % of ${low.at.toFixed(2)}..${high.at.toFixed(2)}`)
      continue
    }
    const beyondLow = rowCoverage(p, edgeAt, low.at - BEYOND_TO_M, low.at - BEYOND_FROM_M)
    const beyondHigh = rowCoverage(p, edgeAt, high.at + BEYOND_FROM_M, high.at + BEYOND_TO_M)
    if (beyondLow >= BEYOND_MAX_COVERAGE || beyondHigh >= BEYOND_MAX_COVERAGE) {
      passed.push(`${reach.toFixed(2)} m: the line runs on past its ${beyondLow >= BEYOND_MAX_COVERAGE ? 'low' : 'high'} return (${Math.round(Math.max(beyondLow, beyondHigh) * 100)} % drawn beyond it)`)
      continue
    }
    return outlineOf(side, reach, round6(low.at), round6(high.at), [round6(low.coverage), round6(high.coverage)], doorSpan, passed)
  }
  return reject(passed.length > 0 ? `no line closed back to the face: ${passed.join('; ')}` : `no line spans the doors ${BALCONY_MIN_REACH_M}–${BALCONY_MAX_REACH_M} m out`)
}

function outlineOf(side: BalconySide, reach: number, from: number, to: number, returns: [number, number], doorSpan: [number, number], passed: string[]): BalconyOutline {
  return {
    reach: round6(reach),
    from: round6(from),
    to: round6(to),
    returns,
    why: `an outline ${reach.toFixed(2)} m out from the ${side.toLowerCase()} face spans ${from.toFixed(2)}..${to.toFixed(2)} in front of the doors at ${doorSpan[0].toFixed(2)}..${doorSpan[1].toFixed(2)}, closed back to the face at both ends (${Math.round(returns[0] * 100)} % and ${Math.round(returns[1] * 100)} % of its depth drawn)${passed.length > 0 ? `; nearer lines passed over: ${passed.join('; ')}` : ''}`,
  }
}

/** The slab's plan rectangle: from the face out to the edge, along the outline. */
export function balconyRect(side: BalconySide, faceAt: number, o: BalconyOutline): { x0: number; z0: number; x1: number; z1: number } {
  const c0 = Math.min(faceAt, faceAt + outward(side) * o.reach)
  const c1 = Math.max(faceAt, faceAt + outward(side) * o.reach)
  return alongX(side) ? { x0: o.from, x1: o.to, z0: round6(c0), z1: round6(c1) } : { x0: round6(c0), x1: round6(c1), z0: o.from, z1: o.to }
}

/** Where a balustrade stands: in from the slab's free edges, back to the face at both ends. */
export const BALUSTRADE_INSET_M = 0.05

/** The balustrade round the three free edges of a projecting slab: face → edge → edge → face. */
export function balustradePath(side: BalconySide, faceAt: number, o: BalconyOutline): Array<{ x: number; z: number }> {
  const out = outward(side)
  const cFace = faceAt + out * BALUSTRADE_INSET_M
  const cEdge = faceAt + out * (o.reach - BALUSTRADE_INSET_M)
  const lo = o.from + BALUSTRADE_INSET_M
  const hi = o.to - BALUSTRADE_INSET_M
  const pts: Array<[number, number]> = [
    [lo, cFace],
    [lo, cEdge],
    [hi, cEdge],
    [hi, cFace],
  ]
  return pts.map(([a, c]) => (alongX(side) ? { x: round6(a), z: round6(c) } : { x: round6(c), z: round6(a) }))
}

/** A floor-level opening reaches down to the storey floor (within this) … */
const FLOOR_SILL_M = 0.1
/** … and is a door's height at least. */
const DOOR_HEAD_MIN_M = 1.8

export type FloorDoorGroup = { side: BalconySide; massId: string; planeAt: number; span: [number, number]; openingIds: string[] }

/**
 * The floor-level openings of one storey, grouped by the face they stand in: the doors a balcony would be stepped
 * onto from. Any family — a glazed door and a French window open onto a balcony alike.
 */
export function floorLevelDoorGroups(openings: ReadonlyArray<{ id: string; storeyIndex: number; massId: string; facade: BalconySide; planeAt: number; interval: [number, number]; sillY: number; headY: number }>, storey: number, floorY: number): FloorDoorGroup[] {
  const groups = new Map<string, FloorDoorGroup>()
  for (const o of openings) {
    if (o.storeyIndex !== storey || Math.abs(o.sillY - floorY) > FLOOR_SILL_M || o.headY - o.sillY < DOOR_HEAD_MIN_M) continue
    const key = `${o.massId}|${o.facade}|${o.planeAt}`
    const g = groups.get(key)
    if (g) {
      g.span = [Math.min(g.span[0], o.interval[0]), Math.max(g.span[1], o.interval[1])]
      g.openingIds.push(o.id)
    } else groups.set(key, { side: o.facade, massId: o.massId, planeAt: o.planeAt, span: [o.interval[0], o.interval[1]], openingIds: [o.id] })
  }
  return [...groups.values()].sort((a, b) => (a.massId + a.side < b.massId + b.side ? -1 : 1))
}

/** What a plan cannot say about a balcony: shown at these, and named as assumed. */
export const BALCONY_SLAB_ASSUMED_M = 0.2
export const BALUSTRADE_HEIGHT_ASSUMED_M = 1.1

/** Doors further apart than this along a face open onto different things (a stretch of wall stands between). */
export const DOOR_CLUSTER_GAP_M = 1.2

/**
 * The ways a face's floor-level doors can be read: all together first (one balcony in front of several doors),
 * then each run of doors with no more than `DOOR_CLUSTER_GAP_M` of wall between them.
 */
export function doorSpanCandidates(group: FloorDoorGroup, openings: ReadonlyArray<{ id: string; interval: [number, number] }>): FloorDoorGroup[] {
  const mine = openings.filter((o) => group.openingIds.includes(o.id)).sort((a, b) => a.interval[0] - b.interval[0])
  const clusters: FloorDoorGroup[] = []
  for (const o of mine) {
    const last = clusters[clusters.length - 1]
    if (last && o.interval[0] - last.span[1] <= DOOR_CLUSTER_GAP_M) {
      last.span = [last.span[0], Math.max(last.span[1], o.interval[1])]
      last.openingIds.push(o.id)
    } else clusters.push({ ...group, span: [o.interval[0], o.interval[1]], openingIds: [o.id] })
  }
  return clusters.length > 1 ? [group, ...clusters] : [group]
}
