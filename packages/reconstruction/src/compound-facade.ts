/**
 * Compound facade spans: one wide gap on a facade line that is really several (BUILDPLAN-ANALYZER-005N).
 *
 * The incumbent wide-gap reader (`collinearWideGaps`) takes the pieces of a wall line from the wall BANDS that run
 * along it, and weighs the gap between two of them as one thing. A front that holds a recessed entrance and a garage
 * door side by side breaks that: the wall-thick pier between them, and the return that runs from it to the entrance's
 * set-back wall, are not bands along the line (a pier is shorter than a band, a return crosses the line), so the
 * entrance's mouth, the pier and the garage door are read as one gap. Its width then decides against it three times:
 * no one drawn line spans the whole of it, it is wider than a lintel, and the pocket it may hide grows with the square
 * of its width — a garage and a hall fit inside the pocket of a 7.8 m "mouth".
 *
 * So, before any gap on a facade is decided, its topology is read from the drawing's own wall-thick ink (the
 * boundary's solid layer, `readWallLine`), facade-local and bounded:
 *
 *   WALL PIECES    the facade line read across the gap: every stretch of wall-thick ink on it;
 *   SEPARATORS     of those, the ones the drawing makes structural —
 *                    WALL_RETURN  wall-thick ink on the line with a wall running inward from it (a return);
 *                    FACADE_PIER  a stretch of wall along the line, part of a wall body, between two mouths;
 *                  and the ones it does not: a free-standing block with no wall behind it (a post), a block too
 *                  close to the gap's end to leave a mouth beside it. Thin lines — a mullion, a leader, a
 *                  dimension, a hatch, a furniture stroke — are not wall-thick and are never read as pieces at all;
 *   INTERVALS      the gap cut at its separators: each one a mouth of its own;
 *   DECISIONS      each interval on its own evidence only — the line drawn across IT, the callout printed at IT,
 *                  the pocket behind IT — and a recess mouth (two returns and a set-back wall that closes the
 *                  building behind it) stays open: an open recess mouth is not an open building interior.
 *
 * A span with no separator is left exactly as the incumbent reads it. Nothing here reads a published figure, a
 * name, an expected count or the outcome of anything downstream: only the ink, the plan's scale and its callouts.
 */
import { round6 } from '@buildapp/source-common'
import type { Mask } from '@buildapp/source-cv'
import { gapSignature, gapStrokes, patternAcross, readWallLine } from './boundary-evidence.js'
import type { LinePiece, SolidLayer, WallLineOptions } from './boundary-evidence.js'
import type { OpeningEvidence, PlanCallout } from './plan-decomposition.js'

export const COMPOUND_FACADE_VERSION = '1.0.0' as const

/**
 * The deepest a recess can be: a car's length. A mouth whose set-back wall lies further in is the front of a garage
 * or of a room, and its depth says nothing about whether it is open.
 */
export const RECESS_MAX_DEPTH_M = 4.5
/** A return runs inward at least this far, and at least three walls: less is the end of a wall turning a corner, not a wall. */
export const RETURN_MIN_M = 0.9
/** The narrowest mouth a separator may leave beside it: a separator closer than this to a gap's end is part of its jamb. */
export const MIN_INTERVAL_M = 0.6
/** A set-back wall closes a recess when wall ink and door-sized holes between wall jambs cover this share of its mouth. */
export const BACK_WALL_COVER = 0.9
/** At most this many compound spans per plan, and separators per span: the reading stays facade-local and bounded. */
export const COMPOUND_BOUNDS = { spans: 24, separators: 8, backWallReads: 64 } as const

export type SeparatorKind = 'WALL_RETURN' | 'FACADE_PIER'

/** One piece of wall-thick ink inside a compound span, and whether the drawing makes it a separator. */
export type FacadeSeparator = {
  id: string
  /** Along the facade line, in pixels. */
  fromPx: number
  toPx: number
  /** Where the ink's own axis runs across the line. */
  axisPx: number
  /** The wall-solid layer's verdict on the ink's part: a stretch of a wall body, or a free-standing block. */
  inkKind: 'WALL' | 'POST'
  /** Its wall inward from the facade, read perpendicular to the line, in metres (0 when none touches the line). */
  returnM: number
  accepted: boolean
  kind: SeparatorKind | 'NOT_A_SEPARATOR'
  why: string
}

export type IntervalRole = 'OPENING_IN_WALL' | 'RECESS_MOUTH' | 'OPEN_SIDE' | 'UNRESOLVED'

/** One atomic interval of a compound span: a mouth of its own. */
export type FacadeInterval = {
  id: string
  fromPx: number
  toPx: number
  widthM: number
  /** What stands at each end: the span's own jamb, or a separator. */
  bounds: ['JAMB' | 'SEPARATOR', 'JAMB' | 'SEPARATOR']
  evidence: OpeningEvidence
  /** The recess behind it: returns at both ends and the set-back wall between them, when the drawing has them. */
  recess?: {
    backWallPx: number
    depthM: number
    cover: number
    returns: [number, number]
    /** The grid line the back wall is read on, and whether the grid gained it for this recess (`backWallLines`). */
    gridLinePx?: number
    lineAdded?: boolean
  }
  /**
   * The longest drawn line across the mouth, inside the wall's band, runs on past a jamb: beyond the jamb's own ink by
   * more than a wall. A door leaf or glazing stops at its jambs; a slab edge, a kerb or a terrace outline does not, and
   * is not infill.
   */
  infillRunsPast: boolean
  /** Whether each end is wall-thick ink on the facade line (a separator, or a jamb the ink reader confirms). */
  jambInk: [boolean, boolean]
  /** What is drawn across its mouth, read as the boundary reads a gap (`gapSignature`): only glazing or a leaf on the axis shuts a recess. */
  signature: 'GLAZING' | 'LEAF_AXIS' | 'LEAF_FACE' | 'DASHED' | 'BLANK'
  role: IntervalRole
  why: string
}

export type CompoundFacadeSpan = {
  id: string
  axis: 'X' | 'Y'
  linePx: number
  /** The parent gap, between the two pieces of wall the incumbent reader found. */
  fromPx: number
  toPx: number
  /** The same gap between the jambs' own wall-thick ink, which may run on past the bands' ends. */
  inkFromPx: number
  inkToPx: number
  widthM: number
  /** Which way the building lies from the line: +1 toward larger pixel coordinates, −1 toward smaller. */
  inward: 1 | -1
  separators: FacadeSeparator[]
  intervals: FacadeInterval[]
  why: string
}

export type CompoundContext = {
  mask: Mask
  solid: SolidLayer
  wallPx: number
  /** Metres per pixel along a line of each axis: an X line runs along y. */
  mppAlong: (axis: 'X' | 'Y') => number
  mppAcross: (axis: 'X' | 'Y') => number
  maxOpeningM: number
  maxWideOpeningM: number
  minInfill: number
  callouts: readonly PlanCallout[]
  /** The longest single stroke across a stretch of the line, inside the wall's band, as a fraction of it. */
  infill: (axis: 'X' | 'Y', from: number, to: number, bandLo: number, bandHi: number) => number
}

/** A wide gap the incumbent reader found on one line, with the band window its jambs occupy across the line. */
export type ParentGap = { axis: 'X' | 'Y'; linePx: number; fromPx: number; toPx: number; bandLo: number; bandHi: number; inward: 1 | -1 }

/**
 * Whether the longest drawn line across [from, to], inside the band window, runs on past either jamb: its row carries
 * ink on beyond the jamb's own ink (`jambLo`, `jambHi`, the ink pieces at the interval's ends) by more than a wall. A
 * jamb whose wall runs on past the stretch read (null) has no far end here: a line along it is the wall's own.
 */
function runsPast(ctx: CompoundContext, parent: ParentGap, from: number, to: number, jambLo: number | null, jambHi: number | null): boolean {
  const t = ctx.wallPx
  const ink = (along: number, across: number): number => {
    const x = Math.round(parent.axis === 'Y' ? along : across)
    const y = Math.round(parent.axis === 'Y' ? across : along)
    return x < 0 || y < 0 || x >= ctx.mask.width || y >= ctx.mask.height ? 0 : ctx.mask.data[y * ctx.mask.width + x]
  }
  // the row of the longest stroke across the mouth (a pixel or two of break forgiven, as `infillAcross` does)
  let best = { len: 0, row: -1 }
  for (let r = Math.round(parent.bandLo); r <= Math.round(parent.bandHi); r += 1) {
    let run = 0
    let gap = 0
    let longest = 0
    for (let a = Math.round(from); a <= Math.round(to); a += 1) {
      if (ink(a, r) === 1) {
        run += 1 + gap
        gap = 0
      } else if (run > 0 && gap < 2) gap += 1
      else {
        run = 0
        gap = 0
      }
      longest = Math.max(longest, run)
    }
    if (longest > best.len) best = { len: longest, row: r }
  }
  if (best.row < 0) return false
  // ink on that row (or a row either side) beyond a jamb, past the jamb's own ink: how far it carries on
  const carries = (start: number, dir: 1 | -1): number => {
    let n = 0
    for (let a = start; n <= t * 2; a += dir) {
      if ([best.row - 1, best.row, best.row + 1].some((r) => ink(a, r) === 1)) n += 1
      else break
    }
    return n
  }
  return (jambHi !== null && carries(Math.round(jambHi) + 1, 1) > t) || (jambLo !== null && carries(Math.round(jambLo) - 1, -1) > t)
}

const lineOptions = (ctx: CompoundContext, mppAlong: number): WallLineOptions => ({ wallPx: ctx.wallPx, mppAlong, maxOpeningM: ctx.maxOpeningM, maxWideOpeningM: ctx.maxWideOpeningM })

/** The other axis's line: a wall crossing a Y line runs along an X line. */
const across = (axis: 'X' | 'Y'): 'X' | 'Y' => (axis === 'X' ? 'Y' : 'X')

/**
 * How far wall-thick ink runs inward from the facade line at one position: the piece of the perpendicular line,
 * read from just outside the facade to the deepest a recess can be, that touches the facade's wall.
 */
function returnRun(ctx: CompoundContext, parent: ParentGap, at: number): { from: number; to: number; px: number } | null {
  const t = ctx.wallPx
  const perp = across(parent.axis)
  const depthPx = (RECESS_MAX_DEPTH_M + t * ctx.mppAcross(parent.axis)) / ctx.mppAcross(parent.axis)
  const a = parent.inward > 0 ? parent.linePx - t : parent.linePx - depthPx
  const b = parent.inward > 0 ? parent.linePx + depthPx : parent.linePx + t
  const line = readWallLine(ctx.mask, ctx.solid, perp, at, a, b, lineOptions(ctx, ctx.mppAlong(perp)))
  // the piece that reaches the facade's own wall: within a wall of the line on the outside, a wall's thickness of it inside
  const touching = line.pieces.filter((p) => (parent.inward > 0 ? p.from <= parent.linePx + t && p.to >= parent.linePx - t : p.to >= parent.linePx - t && p.from <= parent.linePx + t))
  if (touching.length === 0) return null
  const best = touching.sort((p, q) => q.to - q.from - (p.to - p.from) || p.from - q.from)[0]
  return { from: best.from, to: best.to, px: at }
}

/** The length of a return run inward of the facade line, in pixels. */
const inwardOf = (parent: ParentGap, run: { from: number; to: number } | null): number => (run === null ? 0 : Math.max(0, parent.inward > 0 ? run.to - parent.linePx : parent.linePx - run.from))

function separatorOf(ctx: CompoundContext, parent: ParentGap, piece: LinePiece): FacadeSeparator {
  const t = ctx.wallPx
  const mpp = ctx.mppAlong(parent.axis)
  const mppIn = ctx.mppAcross(parent.axis)
  const minMouth = Math.max(MIN_INTERVAL_M / mpp, t)
  const id = `sep-${parent.axis}-${Math.round(parent.linePx)}-${Math.round(piece.from)}-${Math.round(piece.to)}`
  const base = { id, fromPx: round6(piece.from), toPx: round6(piece.to), axisPx: round6(piece.axisPx), inkKind: piece.kind }
  // the wall inward from it, read at its centre and at both of its ends: the best of the three
  const centre = (piece.from + piece.to) / 2
  const probes = [centre, Math.min(piece.to - 1, piece.from + t / 2), Math.max(piece.from + 1, piece.to - t / 2)]
  const runs = probes.map((p) => returnRun(ctx, parent, p))
  const returnPx = Math.max(...runs.map((r) => inwardOf(parent, r)))
  const returnM = round6(returnPx * mppIn)
  if (piece.from - parent.fromPx < minMouth || parent.toPx - piece.to < minMouth) {
    return { ...base, returnM, accepted: false, kind: 'NOT_A_SEPARATOR', why: `wall-thick ink ${Math.round(piece.from)}–${Math.round(piece.to)} px leaves no mouth of ${MIN_INTERVAL_M} m beside it: part of the gap's jamb` }
  }
  const returnMin = Math.max(RETURN_MIN_M / mppIn, 3 * t)
  if (returnPx >= returnMin) {
    return { ...base, returnM, accepted: true, kind: 'WALL_RETURN', why: `wall-thick ink on the facade with a wall running ${returnM.toFixed(2)} m inward from it: a return between two mouths` }
  }
  if (piece.kind === 'WALL' && piece.along) {
    return { ...base, returnM, accepted: true, kind: 'FACADE_PIER', why: `a ${round6((piece.to - piece.from) * mpp).toFixed(2)} m stretch of wall along the facade, part of a wall body, between two mouths: a pier` }
  }
  return {
    ...base,
    returnM,
    accepted: false,
    kind: 'NOT_A_SEPARATOR',
    why: piece.kind === 'POST' ? `a free-standing block ${Math.round(piece.to - piece.from)} px long with ${returnM.toFixed(2)} m of wall behind it: a post, which establishes no wall relation` : `wall-thick ink too short to be a stretch of wall (${Math.round(piece.to - piece.from)} px) with ${returnM.toFixed(2)} m of wall behind it: no return, no pier`,
  }
}

/**
 * The set-back wall closing a recess interval: the nearest parallel line inward, within the deepest a recess can be,
 * where wall-thick ink and the openings in it cover the mouth. A hole in it counts only as a hole in a WALL: drawn
 * across (glazing, a leaf) or door-sized beside a stretch of wall that runs along the line inside the mouth. Two
 * returns' cross-sections with the mouth's width of nothing between them are the returns, not a wall behind them.
 */
function backWallOf(ctx: CompoundContext, parent: ParentGap, from: number, to: number, reach: number): { px: number; cover: number } | null {
  const t = ctx.wallPx
  const mpp = ctx.mppAlong(parent.axis)
  const maxHolePx = ctx.maxOpeningM / mpp
  const step = Math.max(1, Math.round(t / 2))
  const deepest = Math.min(reach, RECESS_MAX_DEPTH_M / ctx.mppAcross(parent.axis))
  // along-wall ink inside the mouth, clear of the returns' own thickness at its ends
  const inside = (p: LinePiece): boolean => p.along && Math.min(p.to, to - t) - Math.max(p.from, from + t) >= t
  let reads = 0
  for (let d = Math.round(t * 1.5); d <= deepest && reads < COMPOUND_BOUNDS.backWallReads; d += step) {
    reads += 1
    const at = parent.linePx + parent.inward * d
    const line = readWallLine(ctx.mask, ctx.solid, parent.axis, at, from - t, to + t, lineOptions(ctx, mpp))
    // the wall's own pieces on this line: their axis near it, and clear of the facade's wall at the mouth's line
    const pieces = line.pieces.filter((p) => Math.abs(p.axisPx - at) <= t * 0.75 && Math.abs(p.axisPx - parent.linePx) >= t * 1.25).sort((p, q) => p.from - q.from)
    if (pieces.length === 0) continue
    const covered: Array<[number, number]> = pieces.map((p) => [p.from, p.to])
    for (let i = 0; i + 1 < pieces.length; i += 1) {
      const [l, r] = [pieces[i], pieces[i + 1]]
      if (r.from - l.to > maxHolePx) continue
      const drawn = gapSignature(gapStrokes(ctx.mask, parent.axis, (l.axisPx + r.axisPx) / 2, l.to, r.from, t, { left: l, right: r }), t).signature
      if (drawn === 'GLAZING' || drawn === 'LEAF_AXIS' || drawn === 'LEAF_FACE' || inside(l) || inside(r)) covered.push([l.to, r.from])
    }
    const cover = coverOf(covered, from, to) / Math.max(1, to - from)
    if (cover >= BACK_WALL_COVER) {
      // the wall's axis from its own stretches along the line: a crossing return's centre is wherever the read was
      const along = pieces.filter((p) => p.along)
      const weighed = along.length > 0 ? along : pieces
      const axisPx = weighed.reduce((a, p) => a + p.axisPx * (p.to - p.from), 0) / Math.max(1, weighed.reduce((a, p) => a + (p.to - p.from), 0))
      return { px: round6(axisPx), cover: round6(cover) }
    }
  }
  return null
}

function coverOf(intervals: ReadonlyArray<readonly [number, number]>, a: number, b: number): number {
  const clipped = intervals
    .map(([p, q]) => [Math.max(p, a), Math.min(q, b)] as [number, number])
    .filter(([p, q]) => q > p)
    .sort((p, q) => p[0] - q[0] || p[1] - q[1])
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
 * The callouts printed at one interval: across the line within reach of it, along the line within the interval, or
 * past an end that is the span's own jamb — never past a separator into the next mouth. A callout belongs to at most
 * one interval: the one its position falls in.
 */
function calloutsOf(ctx: CompoundContext, parent: ParentGap, from: number, to: number, bounds: FacadeInterval['bounds'], widthCm: number): OpeningEvidence['callout'] {
  const mppA = ctx.mppAlong(parent.axis)
  const reach = Math.max(ctx.wallPx * 4, 1.5 / ctx.mppAcross(parent.axis))
  const slack = 1 / mppA
  const lo = bounds[0] === 'JAMB' ? from - slack : from
  const hi = bounds[1] === 'JAMB' ? to + slack : to
  let best: OpeningEvidence['callout']
  for (const c of [...ctx.callouts].sort((p, q) => (p.id < q.id ? -1 : p.id > q.id ? 1 : 0))) {
    const off = Math.abs((parent.axis === 'Y' ? c.at.y : c.at.x) - parent.linePx)
    const along = parent.axis === 'Y' ? c.at.x : c.at.y
    if (off > reach || along < lo || along > hi) continue
    for (const w of c.widthsCm) {
      if (Math.abs(w.value - widthCm) > Math.max(35, widthCm * 0.12)) continue
      if (!best || w.confidence > best.confidence) best = { id: c.id, widthCm: w.value, confidence: round6(w.confidence) }
    }
  }
  return best
}

/**
 * Read one wide gap's facade-local topology. Returns null when the drawing puts no separator inside it: the gap is
 * then exactly what the incumbent reader says it is.
 */
export function compoundSpanOf(ctx: CompoundContext, parent: ParentGap): CompoundFacadeSpan | null {
  const t = ctx.wallPx
  const mpp = ctx.mppAlong(parent.axis)
  const mppIn = ctx.mppAcross(parent.axis)
  // read well past the gap's ends, so that a jamb's wall is read whole
  const margin = Math.max(4 * t, 2 / mpp)
  const readFrom = parent.fromPx - margin
  const readTo = parent.toPx + margin
  const facade = readWallLine(ctx.mask, ctx.solid, parent.axis, parent.linePx, readFrom, readTo, lineOptions(ctx, mpp))
  // the jambs as the ink has them: a jamb's wall may run on past where its band was measured to end (a return's foot)
  const leftJamb = facade.pieces.find((p) => p.from <= parent.fromPx + 1 && p.to > parent.fromPx + 1)
  const rightJamb = facade.pieces.find((p) => p.to >= parent.toPx - 1 && p.from < parent.toPx - 1)
  const from = leftJamb ? Math.max(parent.fromPx, leftJamb.to) : parent.fromPx
  const to = rightJamb ? Math.min(parent.toPx, rightJamb.from) : parent.toPx
  if (to - from < 2 * Math.max(MIN_INTERVAL_M / mpp, t)) return null
  // wall-thick ink strictly inside the gap
  const inside = facade.pieces.filter((p) => p.from > from + 1 && p.to < to - 1).sort((p, q) => p.from - q.from || p.to - q.to)
  if (inside.length === 0) return null
  const separators = inside.slice(0, COMPOUND_BOUNDS.separators).map((p) => separatorOf(ctx, { ...parent, fromPx: from, toPx: to }, p))
  const accepted = separators.filter((s) => s.accepted)
  if (accepted.length === 0) return null
  const spanId = `compound-${parent.axis}-${Math.round(parent.linePx)}-${Math.round(parent.fromPx)}-${Math.round(parent.toPx)}`
  // the intervals between the span's jambs and its separators
  const cuts: Array<{ from: number; to: number; bounds: FacadeInterval['bounds'] }> = []
  let start = from
  let startBound: 'JAMB' | 'SEPARATOR' = 'JAMB'
  for (const s of accepted) {
    cuts.push({ from: start, to: s.fromPx, bounds: [startBound, 'SEPARATOR'] })
    start = s.toPx
    startBound = 'SEPARATOR'
  }
  cuts.push({ from: start, to, bounds: [startBound, 'JAMB'] })
  // the ink pieces standing at each cut's ends, for reading what is drawn across it
  const pieceAt = (px: number, side: 'LEFT' | 'RIGHT'): LinePiece | undefined => facade.pieces.find((p) => (side === 'LEFT' ? Math.abs(p.to - px) <= 1 : Math.abs(p.from - px) <= 1))
  // the returns at each cut's ends: a separator's own, or the jamb's wall turning inward at the gap's end
  const jambReturn = (at: number): number => inwardOf(parent, returnRun(ctx, parent, at))
  const sepReturn = (px: number): number => {
    const s = accepted.find((x) => x.fromPx === px || x.toPx === px)
    return s ? s.returnM / mppIn : 0
  }
  const intervals: FacadeInterval[] = cuts.map((c, k) => {
    const widthM = round6((c.to - c.from) * mpp)
    const id = `${spanId}/i${k}`
    const infill = round6(ctx.infill(parent.axis, c.from, c.to, parent.bandLo, parent.bandHi))
    const callout = calloutsOf(ctx, parent, c.from, c.to, c.bounds, widthM * 100)
    const evidence: OpeningEvidence = { jambs: true, infill, ...(callout ? { callout } : {}) }
    // returns at both ends, and the set-back wall between them within the reach of the shorter
    const left = c.bounds[0] === 'SEPARATOR' ? sepReturn(c.from) : jambReturn(c.from - t / 2)
    const right = c.bounds[1] === 'SEPARATOR' ? sepReturn(c.to) : jambReturn(c.to + t / 2)
    const reach = Math.min(left, right, RECESS_MAX_DEPTH_M / mppIn)
    const back = reach >= Math.max(RETURN_MIN_M / mppIn, 3 * t) ? backWallOf(ctx, parent, c.from, c.to, reach + t) : null
    // a recess is no deeper than a car's length: a set-back wall further in is the back of a garage, a carport or a room
    const depthM = back ? round6(Math.abs(back.px - parent.linePx) * mppIn) : Infinity
    const recess = back && depthM <= RECESS_MAX_DEPTH_M ? { backWallPx: back.px, depthM, cover: back.cover, returns: [round6(left * mppIn), round6(right * mppIn)] as [number, number] } : undefined
    // what is drawn across the mouth, read exactly as the boundary reads a gap between two jambs
    const lp = pieceAt(c.from, 'LEFT')
    const rp = pieceAt(c.to, 'RIGHT')
    const axisPx = lp && rp ? (lp.axisPx + rp.axisPx) / 2 : (lp ?? rp)?.axisPx ?? parent.linePx
    const read = gapSignature(gapStrokes(ctx.mask, parent.axis, axisPx, c.from, c.to, t, { left: lp, right: rp }), t)
    const signature = read.signature === 'GLAZING' && patternAcross(ctx.mask, parent.axis, axisPx, c.from, c.to, t) ? 'DASHED' : read.signature
    // both ends wall-thick ink on the facade line: a separator, or a jamb the ink reader confirms (a band can be a beam)
    const jambInk: [boolean, boolean] = [lp !== undefined, rp !== undefined]
    // how far the jambs' own ink reaches on either side of the mouth: past it, a line carrying on is line work
    // past a separator lies the next mouth, decided on its own: a line carrying on there is that mouth's
    const jambLo = c.bounds[0] === 'SEPARATOR' ? null : lp ? (lp.from <= readFrom + 1 ? null : lp.from) : c.from - t
    const jambHi = c.bounds[1] === 'SEPARATOR' ? null : rp ? (rp.to >= readTo - 1 ? null : rp.to) : c.to + t
    const infillRunsPast = infill >= ctx.minInfill && runsPast(ctx, parent, c.from, c.to, jambLo, jambHi)
    const common = { id, fromPx: round6(c.from), toPx: round6(c.to), widthM, bounds: c.bounds, evidence, signature, infillRunsPast, jambInk }
    if (widthM > ctx.maxWideOpeningM) {
      return { ...common, ...(recess ? { recess } : {}), role: 'OPEN_SIDE', why: `a ${widthM.toFixed(2)} m mouth, wider than any opening a wall carries: where the wall stops` }
    }
    if (recess) {
      // A recess is shut only by what shuts a wall: glazing across its mouth, or a door leaf on its axis. One line at a
      // face is a step, a slab edge or a sill as often as a door, and a recess with its back wall drawn is open.
      const shut = signature === 'GLAZING' || (signature === 'LEAF_AXIS' && widthM <= ctx.maxOpeningM)
      if (shut) return { ...common, recess, role: 'OPENING_IN_WALL', why: `a ${widthM.toFixed(2)} m mouth between two returns, ${signature === 'GLAZING' ? 'glazed' : 'with a door leaf on its axis'}: an enclosed porch, not a recess` }
      return { ...common, recess, role: 'RECESS_MOUTH', why: `a ${widthM.toFixed(2)} m mouth between two returns (${recess.returns[0].toFixed(2)} m, ${recess.returns[1].toFixed(2)} m) with a set-back wall ${recess.depthM.toFixed(2)} m behind it covering ${Math.round(recess.cover * 100)}% of it, ${signature.toLowerCase()} across: a recess, open at its mouth, closed at its back` }
    }
    if (infill >= ctx.minInfill && !infillRunsPast && jambInk[0] && jambInk[1]) {
      return { ...common, role: 'OPENING_IN_WALL', why: `a ${widthM.toFixed(2)} m mouth with ${Math.round(infill * 100)}% of it spanned by one drawn line inside the wall's band, stopping at its jambs: an opening in a wall that carries on` }
    }
    if (callout && jambInk[0] && jambInk[1] && c.bounds.includes('SEPARATOR') && left >= Math.max(RETURN_MIN_M / mppIn, 3 * t) && right >= Math.max(RETURN_MIN_M / mppIn, 3 * t)) {
      return { ...common, role: 'OPENING_IN_WALL', why: `a ${widthM.toFixed(2)} m mouth walled on both sides, deeper than a recess, with a callout of ${callout.widthCm} cm printed at it and nowhere else: an opening in its own wall` }
    }
    if (infill >= ctx.minInfill && !(jambInk[0] && jambInk[1])) {
      return { ...common, role: 'OPEN_SIDE', why: `a ${widthM.toFixed(2)} m mouth drawn across (${Math.round(infill * 100)}%), but with no wall-thick ink at ${jambInk[0] ? 'its far' : 'its near'} end on the facade line: not a hole between two pieces of wall` }
    }
    return { ...common, role: 'OPEN_SIDE', why: infillRunsPast ? `a ${widthM.toFixed(2)} m mouth whose one line across (${Math.round(infill * 100)}%) runs on past its jambs — a slab edge, a kerb, a terrace outline, not a door — and no set-back wall closing it within ${RECESS_MAX_DEPTH_M} m` : `a ${widthM.toFixed(2)} m mouth with only ${Math.round(infill * 100)}% of it drawn across and no set-back wall closing it within ${RECESS_MAX_DEPTH_M} m` }
  })
  return {
    id: spanId,
    axis: parent.axis,
    linePx: round6(parent.linePx),
    fromPx: round6(parent.fromPx),
    toPx: round6(parent.toPx),
    inkFromPx: round6(from),
    inkToPx: round6(to),
    widthM: round6((parent.toPx - parent.fromPx) * mpp),
    inward: parent.inward,
    separators,
    intervals,
    why: `${accepted.length} separator${accepted.length === 1 ? '' : 's'} (${accepted.map((s) => s.kind.toLowerCase().replace('_', ' ')).join(', ')}) cut one ${round6((parent.toPx - parent.fromPx) * mpp).toFixed(2)} m gap into ${intervals.length} mouths, each decided on its own evidence`,
  }
}
