/**
 * Decomposing a floor plan into the masses a building is actually made of.
 *
 * The stage this replaces took the outermost dimension on each axis, drew a
 * rectangle, and called it the building. That is wrong in a way no amount of
 * later numeric fitting can repair: a house with an attached garage set back
 * from the street is not a rectangle, and once the rectangle exists every
 * subsequent decision — which walls, which storeys, which roof — is a decision
 * about the wrong object.
 *
 * The replacement reads the plan as a grid of structural cells:
 *
 *  1. **Grid lines** come from two independent sources. The dimension chains
 *     give exact METRIC breakpoints — the positions where the draughtsman said
 *     one measurement ends and the next begins — and the wall bands give the
 *     DRAWN structure. The two do not coincide to the pixel and should not:
 *     a witness line is struck on a wall's FACE, a band's axis runs down its
 *     CENTRE. They are matched within a wall's thickness, the chain's position
 *     is kept because the chain is the metric authority, and the band's is
 *     kept beside it because that is where the ink actually is.
 *  2. **Cells** are the rectangles between consecutive lines.
 *  3. **Each grid edge gets a closure**: how much of it is shut, by a wall
 *     band or — a glazed wall is still a wall — by an unbroken thin line.
 *  4. **A flood fill over the cells** decides what is inside. Flooding cells
 *     rather than pixels is what makes doorways survive: a 0.9 m doorway in a
 *     5 m wall leaves that wall 82% shut, and 82% shut is shut, whereas a
 *     pixel fill pours straight through it and drowns the whole interior.
 *  5. **Adjacent cells of one class merge** into maximal rectangles, which are
 *     the masses.
 *
 * The result CAN be a single rectangle — when the evidence says so — and is
 * not one otherwise. Nothing here knows the name of any project, and nothing
 * here carries a dimension of any real building.
 */
import { round6 } from '@buildapp/source-common'
import type { PixelRect } from '@buildapp/source-common'
import { connectedComponents, dilate, dominantBandThickness, erode } from '@buildapp/source-cv'
import type { Band, Mask } from '@buildapp/source-cv'
import type { CoordinateRegistration, DimensionChain } from '@buildapp/source-metrics'
import { exteriorSpan, framingChains } from './plan-extent.js'
import type { ChainRoleRecord, WallWitness } from './plan-extent.js'

/** Where a grid line came from. The two kinds are independent, and a line with both is as certain as a plan gets. */
export type GridLineSupport = {
  /** Chains whose segment boundaries fall on this line. */
  chainIds: string[]
  /**
   * The longest span, in pixels, of any chain that breaks here.
   *
   * A plan carries chains at several depths — one across the whole building,
   * one along a wing, one from a door to a corner — and they state different
   * KINDS of thing. Two lines a few centimetres apart, each with a printed
   * number on it, are told apart by which of them the longer chain broke at,
   * because the chain that measures more of the building is the one stating
   * structure rather than detail.
   */
  chainSpanPx: number
  /** Of those, the chains that had a number PRINTED on the segment, rather than deriving it from their own scale. */
  printedChainIds: string[]
  /** Wall bands whose axis lies on this line, by total length in pixels. */
  bandLength: number
  /** How much of the plan's extent the supporting bands span. */
  bandCoverage: number
  /**
   * True when a supporting band runs wall to wall.
   *
   * Coverage alone cannot see a return. The two side walls of a 1.60 m loggia
   * are a tenth of the plan long and are structure all the same: they carry
   * the facade over the mouth, they are what makes the pocket a pocket, and
   * without a grid line on them the recess has no sides and the flood fill
   * walks through the whole front of the building. What tells them from a
   * stray mark is not their length but their ENDS — a member that lands on a
   * wall at both ends spans between them, and a member that stops in mid-air
   * does not.
   */
  bandSpans: boolean
}

export type GridLine = {
  axis: 'X' | 'Y'
  /** Position in the frame's pixels — the chain's, when a chain states one, because the chain is what the metre reading is attached to. */
  px: number
  /**
   * Every raw position that merged into this line, ascending. A witness line
   * and a wall axis are half a wall apart, so asking "is there ink on this
   * line" has to be asked at both.
   */
  probesPx: number[]
  support: GridLineSupport
  /** 0..1. */
  confidence: number
  why: string
}

export type CellClass = 'BUILT' | 'RECESS' | 'OUTSIDE'

/** How shut one edge of one cell is, and what shuts it. */
export type EdgeClosure = {
  /** Fraction covered by wall bands. */
  wall: number
  /** Fraction covered by continuous ink of any weight — glazing, a thin contour, a balustrade. */
  line: number
  /** Fraction taken up by holes in a wall that carries on either side of them: doors and windows. */
  opening: number
  /** The three combined: what the flood fill is stopped by. */
  closure: number
}

export type PlanCell = {
  ix: number
  iy: number
  rect: PixelRect
  classification: CellClass
  /** Closure of each edge, in order: top, right, bottom, left. */
  edges: [EdgeClosure, EdgeClosure, EdgeClosure, EdgeClosure]
  /** True when the flood fill could not reach this cell from outside the plan. */
  enclosed: boolean
  /** Ink inside the cell that is not wall: furniture, hatching, annotation. */
  interiorInk: number
  confidence: number
  why: string
}

export type PlanRegion = {
  id: string
  classification: CellClass
  /** In the frame's pixels. */
  rect: PixelRect
  /** In metres, in the registration's plane. */
  metric: { x0: number; z0: number; x1: number; z1: number }
  cells: Array<{ ix: number; iy: number }>
  confidence: number
  why: string
}

/**
 * The box the building's walls occupy.
 *
 * Distinct from the dimensioned extent, which usually reaches past the walls
 * to an eaves line, a terrace edge or a plot boundary — the outer segments of
 * a depth chain are very often a zone in front and a zone behind rather than
 * part of the building at all. The envelope is where the WALLS are, and a mass
 * that falls outside it is a paving pattern the flood fill happened to find a
 * ring around.
 */
export type WalledEnvelope = {
  rect: PixelRect
  metric: { x0: number; z0: number; x1: number; z1: number }
  /** How many wall bands on each axis it was taken from. */
  bands: { vertical: number; horizontal: number }
  why: string
}

/** A printed opening callout on the plan: where it sits and every width it might be saying. */
export type PlanCallout = {
  id: string
  at: { x: number; y: number }
  /** Width readings, best first, in centimetres. */
  widthsCm: Array<{ value: number; confidence: number }>
}

/**
 * What the drawing says about one wide gap: is it a hole in a wall that goes
 * on, or the place where the wall stops?
 *
 * A width alone cannot say. A double garage door is 5 m, a sliding glass wall
 * 6 m, and the open side of a carport is 5 m too; what tells them apart is
 * what is drawn AROUND the gap, and each of these is one independent thing
 * the draughtsman drew or did not draw.
 */
export type OpeningEvidence = {
  /** The wall on either side of the gap is real wall material. */
  jambs: boolean
  /** For a bay: both of its side walls reach the line the gap is on. */
  corners?: boolean
  /** Fraction of the gap spanned by ONE continuous thin line inside the wall's own thickness: a door leaf, a glazing line, a sill. */
  infill: number
  /** A printed opening callout at the gap whose width agrees with it. */
  callout?: { id: string; widthCm: number; confidence: number }
  /** The area the gap alone would let the outside into: a pocket, or a building's interior. */
  pocketM2?: number
}

/** One wide gap weighed, and what was decided about it. */
export type WideOpeningDecision = {
  /** A gap between two pieces of one wall line, or the mouth of a bay two walls reach out to enclose. */
  kind: 'COLLINEAR_GAP' | 'BAY_MOUTH'
  /** The grid line the gap lies on. */
  axis: 'X' | 'Y'
  linePx: number
  /** The gap, along the line, in pixels. */
  fromPx: number
  toPx: number
  widthM: number
  evidence: OpeningEvidence
  decision: 'OPENING_IN_WALL' | 'OPEN_SIDE'
  /** 0..1: how much independent evidence the decision rests on. */
  score: number
  why: string
}

/**
 * A bay: two walls leaving the walled envelope side by side and running out
 * from it — a garage wing, a porch, a carport. Whether its far side is shut is
 * a separate question, answered by its mouth.
 */
export type PlanBay = {
  /** The envelope side it leaves from. */
  side: 'MIN_X' | 'MAX_X' | 'MIN_Z' | 'MAX_Z'
  /** Outer faces of its side walls, from the envelope edge to its far line. */
  rect: PixelRect
  /** The axes of its two side walls. */
  wallAxesPx: [number, number]
  mouth: WideOpeningDecision
}

/** One reading of the plan's enclosure, with what it concluded. */
export type EnclosureHypothesis = {
  id: 'H0_STRICT_ENCLOSURE' | 'H1_WIDE_OPENING_CONTINUITY'
  /** What the hypothesis allows to shut an edge. */
  rule: string
  builtCells: number
  builtAreaPx: number
  /** The evidenced wide openings this hypothesis closes; none for H0. */
  closedOpenings: number
  score: number
  why: string
}

export type PlanDecomposition = {
  frameId: string
  /** The wall thickness the plan's own bands imply, in pixels and in metres. */
  wallThickness: { px: number; m: number }
  /** The box the wall bands occupy, or null when no wall was found on one of the axes. */
  envelope: WalledEnvelope | null
  linesX: GridLine[]
  linesY: GridLine[]
  cells: PlanCell[]
  regions: PlanRegion[]
  /** The dimensioned extent the decomposition was cut from, in pixels. */
  extent: PixelRect
  /** Named things the decomposition could not settle. */
  unresolved: Array<{ what: string; reason: string }>
  /** Every gap wider than a lintel conventionally spans, with the evidence weighed and the decision. */
  wideOpenings: WideOpeningDecision[]
  /** Bays reaching out of the envelope. */
  bays: PlanBay[]
  /** The enclosure readings that were considered, and which one the cells follow. */
  hypotheses: EnclosureHypothesis[]
  chosenHypothesis: EnclosureHypothesis['id'] | null
}

export type PlanDecompositionOptions = {
  /** Two candidate lines of the SAME kind closer than this are one line. */
  snapPx?: number
  /** A band shorter than this fraction of the plan's extent does not make a grid line on its own. */
  minBandCoverage?: number
  /** Closure at or above which an edge stops the flood fill. */
  closureThreshold?: number
  /** Ink density above which a cell is considered to contain drawn content. */
  contentInk?: number
  /** Smallest cell worth keeping, in metres. */
  minCellM?: number
  /** Fallback wall thickness in pixels, used only when no band is thick enough to measure one. */
  fallbackWallPx?: number
  /** Shortest unbroken stretch of line work worth believing, in pixels. */
  minLinePx?: number
  /** The widest hole a wall may have and still count as a wall, in metres, on the gap's width alone. */
  maxOpeningM?: number
  /** The widest hole that can still be a hole in a wall when the drawing says so, in metres. */
  maxWideOpeningM?: number
  /** Continuous thin line needed across a wide gap, as a fraction of it, to count as drawn infill. */
  minInfill?: number
  /** The plan's printed opening callouts. */
  callouts?: readonly PlanCallout[]
  /**
   * Read every gap left open as the mouth of a pocket as a hole in the wall instead (005A). A wide
   * gap in front of a space shut on every other side is a carport or a garage behind a wide door,
   * a loggia or a room behind a glazed wall: the plan alone does not say which. Today's reading
   * takes the pocket; the resolver asks for this one as another reading, never as the first.
   */
  shutPocketMouths?: boolean
}

const DEFAULTS: Required<PlanDecompositionOptions> = {
  snapPx: 5,
  minBandCoverage: 0.18,
  closureThreshold: 0.62,
  contentInk: 0.02,
  minCellM: 0.45,
  fallbackWallPx: 12,
  minLinePx: 18,
  // A garage door is about 2.4 m and the widest domestic one about 3.0. Past
  // that a hole is not a hole: it is where the wall stops, which is what the
  // mouth of a loggia and the open side of a carport are. The number is a
  // convention, and it is the only thing separating the two.
  maxOpeningM: 3.2,
  // Past the convention above a gap needs the drawing's word that it is an
  // opening: a door or glazing drawn across it, or a callout printing its
  // width. A 6 m sliding wall and a 5 m double garage door are real; past 8 m
  // even that is not enough on a house.
  maxWideOpeningM: 8,
  minInfill: 0.7,
  callouts: [],
  shutPocketMouths: false,
}

const at = (m: Mask, x: number, y: number): number => (x < 0 || y < 0 || x >= m.width || y >= m.height ? 0 : m.data[y * m.width + x])

/**
 * The wall thickness this plan is drawn at, from the bands themselves.
 *
 * Length-weighted, because the longest bands are the ones most likely to be
 * walls rather than a heavy piece of furniture, and a median rather than a
 * mean because one very thick band — a hatched section cut, a filled column —
 * should not move it. The measure itself lives in `@buildapp/source-cv`, where
 * the metric layer uses the same one to check a plan's scale.
 */
export function bandWallThickness(bands: readonly Band[], fallbackPx: number): number {
  return dominantBandThickness(bands, fallbackPx)
}

type RawLine = { px: number; support: GridLineSupport; probes: number[] }

/**
 * A band that lands on another wall at both of its ends.
 *
 * The junction itself is invisible to the band reader — where two walls meet,
 * the run ACROSS one of them is the length of the other and every pixel of the
 * corner fails the thickness test — so the two are never quite touching in the
 * output, and the test allows for that gap. Length is not the criterion but
 * there is still a floor on it: a mark shorter than a couple of wall
 * thicknesses is a mark.
 */
function spansWallToWall(band: Band, bands: readonly Band[]): boolean {
  if (band.length < band.thickness * 2.5) return false
  const gap = Math.max(3, band.thickness * 1.2)
  const vertical = band.axis === 'VERTICAL'
  const ends = vertical ? [band.bounds.y0, band.bounds.y1] : [band.bounds.x0, band.bounds.x1]
  const side0 = vertical ? band.bounds.x0 : band.bounds.y0
  const side1 = vertical ? band.bounds.x1 : band.bounds.y1
  const lands = (end: number): boolean =>
    bands.some((other) => {
      if (other === band || other.axis === band.axis) return false
      const across0 = vertical ? other.bounds.y0 : other.bounds.x0
      const across1 = vertical ? other.bounds.y1 : other.bounds.x1
      if (end < across0 - gap || end > across1 + gap) return false
      const along0 = vertical ? other.bounds.x0 : other.bounds.y0
      const along1 = vertical ? other.bounds.x1 : other.bounds.y1
      return along1 >= side0 - gap && along0 <= side1 + gap
    })
  return ends.every(lands)
}

/**
 * The grid lines a plan's own evidence supports.
 *
 * A chain segment boundary is a metric statement; a wall band axis is a drawn
 * one. Chains are collected first and keep their positions, because a
 * dimension is the only thing on the sheet that states a length; bands then
 * join the chain line they are within a wall's thickness of, or stand as their
 * own line when there is no chain near them.
 */
export function gridLines(
  chains: readonly DimensionChain[],
  bands: readonly Band[],
  extent: PixelRect,
  options: PlanDecompositionOptions = {},
): { linesX: GridLine[]; linesY: GridLine[] } {
  const opt = { ...DEFAULTS, ...options }
  const spanX = Math.max(1, extent.x1 - extent.x0)
  const spanY = Math.max(1, extent.y1 - extent.y0)

  const collect = (axis: 'X' | 'Y'): GridLine[] => {
    const span = axis === 'X' ? spanX : spanY
    const low = (axis === 'X' ? extent.x0 : extent.y0) - opt.snapPx
    const high = (axis === 'X' ? extent.x1 : extent.y1) + opt.snapPx
    const raw: RawLine[] = []
    const nearest = (px: number, tolerance: number): RawLine | undefined => {
      let best: RawLine | undefined
      let bestGap = tolerance
      for (const line of raw) {
        const gap = Math.abs(line.px - px)
        if (gap <= bestGap) {
          best = line
          bestGap = gap
        }
      }
      return best
    }

    // --- chains first: they carry the metric, so they keep their positions ---
    for (const chain of chains) {
      const runsAlong = (chain.axis === 'HORIZONTAL') === (axis === 'X')
      if (!runsAlong) continue
      const chainSpan = Math.max(...chain.ticksPx) - Math.min(...chain.ticksPx)
      for (const segment of chain.segments) {
        // A span nothing was read on and nothing derived is a tick the chain
        // itself does not believe.
        if (segment.valueCm === undefined) continue
        const printed = segment.origin === 'READ' || segment.origin === 'CHAIN_CORRECTED'
        for (const px of [segment.fromPx, segment.toPx]) {
          if (px < low || px > high) continue
          const held = nearest(px, opt.snapPx)
          const line = held ?? { px: round6(px), support: { chainIds: [], printedChainIds: [], chainSpanPx: 0, bandLength: 0, bandCoverage: 0, bandSpans: false }, probes: [round6(px)] }
          if (!held) raw.push(line)
          if (!line.support.chainIds.includes(chain.id)) line.support.chainIds.push(chain.id)
          if (printed && !line.support.printedChainIds.includes(chain.id)) line.support.printedChainIds.push(chain.id)
          line.support.chainSpanPx = Math.max(line.support.chainSpanPx, round6(chainSpan))
          if (!line.probes.some((p) => Math.abs(p - px) <= 1)) line.probes.push(round6(px))
        }
      }
    }

    // --- then the bands, which join the chain line they belong to ------------
    for (const band of bands) {
      const across = (band.axis === 'VERTICAL') === (axis === 'X')
      if (!across) continue
      const px = band.axisPx
      if (px < low || px > high) continue
      // A witness line is struck on a wall's FACE and a band's axis runs down
      // its CENTRE, so a band belongs to a chain line that sits on its axis OR
      // on either of its faces. Where several chains break inside one wall —
      // an overall dimension to the outside of it and a room dimension to the
      // inside — the one that measures more of the building takes the band,
      // because that is the line the building's own outline follows and the
      // other is a note about a room.
      const faces = axis === 'X' ? [band.bounds.x0, band.bounds.x1] : [band.bounds.y0, band.bounds.y1]
      const window = Math.max(opt.snapPx, band.thickness * 0.75)
      const faceWindow = Math.max(opt.snapPx, band.thickness * 0.35)
      const claimants = raw.filter((l) => Math.abs(l.px - px) <= window || faces.some((f) => Math.abs(l.px - f) <= faceWindow))
      claimants.sort((a, b) => b.support.chainSpanPx - a.support.chainSpanPx || Math.abs(a.px - px) - Math.abs(b.px - px) || a.px - b.px)
      const held = claimants[0] ?? nearest(px, window)
      const line = held ?? { px: round6(px), support: { chainIds: [], printedChainIds: [], chainSpanPx: 0, bandLength: 0, bandCoverage: 0, bandSpans: false }, probes: [round6(px)] }
      if (!held) raw.push(line)
      line.support.bandLength += band.length
      line.support.bandCoverage = Math.min(1, line.support.bandLength / span)
      if (spansWallToWall(band, bands)) line.support.bandSpans = true
      // A wall has two faces and an axis, and which of the three a drawing
      // hangs its openings off varies: a window is drawn across the wall, a
      // garage door along its inner face, a terrace edge along its outer one.
      // All three are recorded so that looking for ink on this line looks
      // where the ink of this wall actually is.
      for (const probe of [px, ...faces]) if (!line.probes.some((q) => Math.abs(q - probe) <= 1)) line.probes.push(round6(probe))
    }

    return raw
      .filter((line) => line.support.chainIds.length > 0 || line.support.bandCoverage >= opt.minBandCoverage || line.support.bandSpans)
      .map((line) => {
        const chain = line.support.chainIds.length > 0
        const printed = line.support.printedChainIds.length > 0
        const band = line.support.bandCoverage >= opt.minBandCoverage || line.support.bandSpans
        // A tick whose number was READ is a statement; a tick whose number the
        // chain worked out from its own scale is an inference, and an
        // inference must not outrank the statement it was inferred from —
        // which is exactly what happens when a detail chain inside a room
        // carries a wall band and the overall chain across the sheet does not.
        const confidence = printed ? (band ? 0.95 : 0.8) : chain ? (band ? 0.75 : 0.5) : 0.6
        return {
          axis,
          px: round6(line.px),
          probesPx: [...line.probes].sort((a, b) => a - b),
          support: { ...line.support, bandCoverage: round6(line.support.bandCoverage) },
          confidence,
          why: chain && band
            ? `a dimension chain breaks here and a wall band ${Math.round(line.support.bandLength)} px long lies on it`
            : chain
              ? `${line.support.chainIds.length} dimension chain${line.support.chainIds.length === 1 ? '' : 's'} break here, with no wall drawn on the line`
              : `a wall band ${Math.round(line.support.bandLength)} px long lies here, with no dimension breaking on it`,
        }
      })
      .sort((a, b) => a.px - b.px)
  }

  return { linesX: collect('X'), linesY: collect('Y') }
}

/**
 * Thin out lines that sit on top of one another, best-supported first.
 *
 * Taken in rank order rather than in position order, because a run of four
 * near-coincident candidates has to collapse onto the one the evidence is
 * strongest for — the printed dimension, not whichever of them happens to come
 * first along the axis. The losers hand over their probe positions, so the ink
 * they were drawn from is still looked at when edges are measured.
 */
function thinLines(lines: readonly GridLine[], minGapPx: number, probeGapPx: number): GridLine[] {
  const rank = (l: GridLine): number => l.confidence * 1e9 + Math.min(9999, l.support.chainSpanPx) * 1e3 + Math.min(999, l.support.bandLength)
  const order = [...lines].sort((a, b) => rank(b) - rank(a) || a.px - b.px)
  const kept: GridLine[] = []
  for (const line of order) {
    const clash = kept.find((k) => Math.abs(k.px - line.px) < minGapPx)
    if (clash) {
      // Only probes close enough to be the same piece of construction are
      // inherited: a line 40 cm away is a different wall, not another face of
      // this one, and probing there would measure the wrong ink.
      const merged = [...clash.probesPx, ...line.probesPx.filter((p) => Math.abs(p - clash.px) <= probeGapPx)]
      clash.probesPx = [...new Set(merged.map((p) => round6(p)))].sort((a, b) => a - b)
      continue
    }
    kept.push({ ...line, probesPx: [...line.probesPx] })
  }
  return kept.sort((a, b) => a.px - b.px)
}

/** The stretches of a grid line that wall bands lying on it cover. */
function wallIntervals(bands: readonly Band[], axis: 'X' | 'Y', line: GridLine, from: number, to: number, tolerance: number): Array<[number, number]> {
  const covered: Array<[number, number]> = []
  for (const band of bands) {
    const along = (band.axis === 'VERTICAL') === (axis === 'X')
    if (along) {
      // Compare against the band's extent across rather than its centre alone: a
      // wall drawn 18 px thick still shuts an edge falling anywhere inside it.
      const lo = axis === 'X' ? band.bounds.x0 : band.bounds.y0
      const hi = axis === 'X' ? band.bounds.x1 : band.bounds.y1
      if (!line.probesPx.some((p) => p >= lo - tolerance && p <= hi + tolerance)) continue
      const a = axis === 'X' ? band.bounds.y0 : band.bounds.x0
      const b = axis === 'X' ? band.bounds.y1 : band.bounds.x1
      const overlap: [number, number] = [Math.max(from, a), Math.min(to, b)]
      if (overlap[1] > overlap[0]) covered.push(overlap)
      continue
    }
    // A wall CROSSING this line is solid where it crosses, and the band reader
    // cannot see it: at a junction the run ACROSS belongs to the other wall, so
    // every pixel of the corner fails the thickness test and drops out. Left
    // out, a 0.6 m pier between a garage door and the corner disappears
    // entirely, the garage's front reads as a wall that simply stops, and the
    // flood fill walks in through it and calls the garage ground.
    const segment = band.segments.some((g) => g.from - tolerance <= line.px && g.to + tolerance >= line.px)
    if (!segment) continue
    const a = axis === 'X' ? band.bounds.y0 : band.bounds.x0
    const b = axis === 'X' ? band.bounds.y1 : band.bounds.x1
    const overlap: [number, number] = [Math.max(from, a), Math.min(to, b)]
    if (overlap[1] > overlap[0]) covered.push(overlap)
  }
  return covered
}

/** Overlapping probe windows merged, so a thick wall is scanned once rather than three times. */
function mergeWindows(windows: ReadonlyArray<readonly [number, number]>): Array<[number, number]> {
  const sorted = [...windows].map(([a, b]) => [a, b] as [number, number]).sort((p, q) => p[0] - q[0])
  const out: Array<[number, number]> = []
  for (const [a, b] of sorted) {
    const last = out[out.length - 1]
    if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b)
    else out.push([a, b])
  }
  return out
}

/** Total length of a set of possibly overlapping intervals. */
function unionLength(intervals: Array<[number, number]>): number {
  intervals.sort((p, q) => p[0] - q[0])
  let total = 0
  let reach = -Infinity
  for (const [a, b] of intervals) {
    const start = Math.max(a, reach)
    if (b > start) total += b - start
    reach = Math.max(reach, b)
  }
  return total
}

/**
 * The stretches of a grid line that drawn LINE work shuts.
 *
 * A fully glazed wall, a balustrade, the thin outline of a terrace: none of
 * them are wall bands, all of them are the building's edge, and without them a
 * flood fill walks through a picture window and reports the living room as
 * garden.
 *
 * What counts is CONTINUITY. Ink beside the line at one point means nothing —
 * a plan is full of furniture, hatching and a printer's watermark, and every
 * one of them touches some line somewhere. Ink beside the line for an unbroken
 * stretch longer than a wall is thick is a drawn edge, so only runs that long
 * are returned and everything shorter is dropped on the floor.
 *
 * Measured over the WHOLE line and clipped afterwards, never per cell edge.
 * Continuity belongs to the drawing; a cell boundary that happens to cut a
 * long stroke in two does not make either half less continuous, and measuring
 * inside the cell would call both halves noise.
 */
function lineIntervals(mask: Mask, axis: 'X' | 'Y', line: GridLine, from: number, to: number, tolerance: number, minRun: number): Array<[number, number]> {
  const a = Math.max(0, Math.round(from))
  const b = Math.min((axis === 'X' ? mask.height : mask.width) - 1, Math.round(to))
  const covered: Array<[number, number]> = []
  if (b <= a) return covered
  const probes = mergeWindows(line.probesPx.map((p) => [Math.round(p - tolerance), Math.round(p + tolerance)] as const))
  let run = -1
  for (let t = a; t <= b + 1; t += 1) {
    let found = false
    if (t <= b) {
      for (const [lo, hi] of probes) {
        for (let s2 = lo; s2 <= hi; s2 += 1) {
          if (at(mask, axis === 'X' ? s2 : t, axis === 'X' ? t : s2) === 1) {
            found = true
            break
          }
        }
        if (found) break
      }
    }
    if (found) {
      if (run < 0) run = t
    } else if (run >= 0) {
      if (t - run >= minRun) covered.push([run, t])
      run = -1
    }
  }
  return covered
}

/** Ink inside a rectangle that is not part of a wall band: furniture, hatching, annotation, a room number. */
function interiorInk(mask: Mask, bands: readonly Band[], rect: PixelRect): number {
  const inset = 3
  const x0 = Math.round(rect.x0) + inset
  const x1 = Math.round(rect.x1) - inset
  const y0 = Math.round(rect.y0) + inset
  const y1 = Math.round(rect.y1) - inset
  if (x1 <= x0 || y1 <= y0) return 0
  const inBand = (x: number, y: number): boolean =>
    bands.some((b) => x >= b.bounds.x0 - 1 && x <= b.bounds.x1 + 1 && y >= b.bounds.y0 - 1 && y <= b.bounds.y1 + 1)
  let ink = 0
  let total = 0
  // Sample rather than scan: a cell can be a quarter of the sheet.
  const step = Math.max(1, Math.floor(Math.min(x1 - x0, y1 - y0) / 48))
  for (let y = y0; y <= y1; y += step) {
    for (let x = x0; x <= x1; x += step) {
      total += 1
      if (at(mask, x, y) === 1 && !inBand(x, y)) ink += 1
    }
  }
  return round6(total === 0 ? 0 : ink / total)
}

/**
 * One edge's closure, from the wall it is built of, the line work drawn on it,
 * and the doors and windows cut through it.
 *
 * Wall and line are unioned rather than maxed, because half a wall and half a
 * window in line with each other make one shut edge, and taking the larger of
 * the halves would call it half open.
 *
 * The third term is the one that matters for a garage. A wall with a 2.4 m
 * door in it is 36% covered and 100% a wall: it encloses the garage, it holds
 * the storey above up, and a reader that treats it as a missing face floods
 * straight through the door and reports the garage as ground. So a hole
 * BETWEEN TWO PIECES OF THE SAME WALL counts as shut, and a hole at the END
 * of one does not — that is where the wall stops, not where it is pierced.
 * The width cap keeps the rule honest: the open side of a carport and the
 * mouth of a loggia are wider than any lintel spans, and stay open.
 */
function closureOf(
  walls: ReadonlyArray<readonly [number, number]>,
  lines: ReadonlyArray<readonly [number, number]>,
  from: number,
  to: number,
  maxOpeningPx: number,
  minJambPx: number,
  evidenced: ReadonlyArray<readonly [number, number]> = [],
): EdgeClosure {
  const span = Math.max(1, to - from)
  const clip = (intervals: ReadonlyArray<readonly [number, number]>): Array<[number, number]> => {
    const out: Array<[number, number]> = []
    for (const [a, b] of intervals) {
      const lo = Math.max(a, from)
      const hi = Math.min(b, to)
      if (hi > lo) out.push([lo, hi])
    }
    return out
  }
  const w = clip(walls)
  const l = clip(lines)
  // The pieces of wall on this edge, in order, with the touching ones joined.
  const pieces: Array<[number, number]> = []
  for (const [a, b] of [...w].sort((p, q) => p[0] - q[0])) {
    const last = pieces[pieces.length - 1]
    if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b)
    else pieces.push([a, b])
  }
  const holes: Array<[number, number]> = []
  for (let i = 0; i + 1 < pieces.length; i += 1) {
    const [, end] = pieces[i]
    const [start] = pieces[i + 1]
    const jambs = Math.min(pieces[i][1] - pieces[i][0], pieces[i + 1][1] - pieces[i + 1][0])
    if (start - end <= maxOpeningPx && jambs >= minJambPx) holes.push([end, start])
  }
  // Wider holes the drawing itself says are openings, found over the whole
  // line rather than inside this one edge (see `wideOpenings`).
  holes.push(...clip(evidenced))
  return {
    wall: round6(Math.min(1, unionLength([...w]) / span)),
    line: round6(Math.min(1, unionLength([...l]) / span)),
    opening: round6(Math.min(1, unionLength([...holes]) / span)),
    closure: round6(Math.min(1, unionLength([...w, ...l, ...holes]) / span)),
  }
}

/**
 * The stretch of each axis a plan's dimensions actually speak about.
 *
 * The widest chain that READ something wins its axis. A chain whose every
 * segment was derived is a row of ticks the reader found and could not
 * interpret, and letting one of those set the extent hands the decomposition a
 * frame reaching out to a north arrow or a scale bar. Where no chain read
 * anything at all, nothing is returned and the caller has to say so.
 */
export function dimensionedExtent(chains: readonly DimensionChain[]): PixelRect | null {
  const x = dimensionedAxis(chains, 'HORIZONTAL')
  const y = dimensionedAxis(chains, 'VERTICAL')
  if (!x || !y) return null
  return { x0: round6(x.lo), y0: round6(y.lo), x1: round6(x.hi), y1: round6(y.hi) }
}

/** The widest read chain's stretch on one axis, trimmed of unread stubs at its ends (see `dimensionedExtent`). */
export function dimensionedAxis(chains: readonly DimensionChain[], axis: 'HORIZONTAL' | 'VERTICAL'): { lo: number; hi: number; chainId: string } | null {
  const pick = (axis: 'HORIZONTAL' | 'VERTICAL'): { lo: number; hi: number; chainId: string } | null => {
    let best: { lo: number; hi: number; chainId: string } | null = null
    for (const chain of chains) {
      if (chain.axis !== axis) continue
      const read = chain.segments.filter((seg) => seg.origin === 'READ' || seg.origin === 'CHAIN_CORRECTED')
      if (read.length === 0) continue
      // A chain's outermost segments are often not segments at all: a witness
      // line struck a centimetre past the last one, the end of the rule, a
      // tick belonging to a different chain that happened to be collinear. One
      // the chain could not read AND which is far shorter than the shortest it
      // could is not a span of the building, and letting it set the frame adds
      // a strip of nothing to whichever end it is on.
      const floor = Math.min(...read.map((seg) => seg.pixelLength)) * 0.5
      const segments = [...chain.segments].sort((a, b) => a.fromPx - b.fromPx)
      let first = 0
      let last = segments.length - 1
      while (first <= last && segments[first].origin !== 'READ' && segments[first].origin !== 'CHAIN_CORRECTED' && segments[first].pixelLength < floor) first += 1
      while (last >= first && segments[last].origin !== 'READ' && segments[last].origin !== 'CHAIN_CORRECTED' && segments[last].pixelLength < floor) last -= 1
      if (first > last) continue
      const lo = segments[first].fromPx
      const hi = segments[last].toPx
      if (!best || hi - lo > best.hi - best.lo) best = { lo, hi, chainId: chain.id }
    }
    return best
  }
  return pick(axis)
}

/**
 * Bands long enough to be walls rather than a step, a pier, a bush or a piece
 * of furniture.
 *
 * Two and a half wall thicknesses. Generous on purpose: an exterior wall with
 * two wide windows in it survives as three short pieces, and the piece between
 * the windows is the only evidence that side of the building has a wall at
 * all. What this has to exclude is the drawn furniture of a sheet, which is
 * small in a different way — a kerb, a bush, a bath — and a threshold set to
 * exclude a broken wall as well would lose the wall.
 */
const longBands = (bands: readonly Band[], wallPx: number): Band[] => bands.filter((b) => b.length >= wallPx * 2.5)

/** The box the AXES of a set of bands span, taken out to the walls' outer faces. Null unless both orientations are present. */
function axisBox(bands: readonly Band[], wallPx: number): PixelRect | null {
  const vertical = bands.filter((b) => b.axis === 'VERTICAL').map((b) => b.axisPx)
  const horizontal = bands.filter((b) => b.axis === 'HORIZONTAL').map((b) => b.axisPx)
  if (vertical.length === 0 || horizontal.length === 0) return null
  const half = wallPx / 2
  return {
    x0: round6(Math.min(...vertical) - half),
    x1: round6(Math.max(...vertical) + half),
    y0: round6(Math.min(...horizontal) - half),
    y1: round6(Math.max(...horizontal) + half),
  }
}

/**
 * The frame of the plan to decompose.
 *
 * Two candidates, and they check each other. The dimension chains draw one
 * frame, and where the chains are good it is the better of the two because it
 * is metric. The wall bands draw another, and where the chains are sparse — an
 * upper-storey plan is very often dimensioned only where it differs from the
 * one below — the chain frame covers a corner of the building and calling it
 * the building would throw the rest away.
 *
 * So the walls vote. If most of the wall that was found lies inside the chain
 * frame, the chains are describing this building and the frame is theirs,
 * widened to whatever wall pokes out of it. If most of it lies outside, the
 * chains are describing a detail of it, the frame is the walls', and the
 * result is marked weak so that nothing downstream mistakes it for a metric
 * statement.
 */
export type PlanExtent = {
  rect: PixelRect
  weak: boolean
  why: string
  /** 005B: each chain's role against the wall witness, and the chains refused as the building's extent. */
  roles?: ChainRoleRecord[]
  refused?: string[]
  /** 005B: where each axis of the frame came from. */
  provenance?: { x: ExtentProvenance; y: ExtentProvenance }
}

export type ExtentProvenance = 'DIMENSION_CHAIN_EXTENT' | 'EXTERIOR_CHAIN_TICKS' | 'WALL_GEOMETRY_EXTENT'

/**
 * With a wall witness (005B), a chain drawn across the building may not frame
 * it. The legacy frame stands, byte for byte, unless a chain it was taken from
 * — the widest read chain on either axis — is an interior chain that does not
 * span the walls. Then each refused axis is taken from the WIDEST of what the
 * drawing states there — another read chain, an exterior chain's ticks — or,
 * where no statement covers half of the wall witness, from the witness: never
 * from a short read chain merely because it is read. The other axis
 * keeps the legacy frame's range. The new frame replaces the legacy one only
 * where it is wider on a refused axis: refusing a room's width can only ever
 * widen the building. Provenance says, per axis, what the frame came from; a
 * legacy frame the walls had to supply (weak) says so too.
 */
export function planExtent(chainsIn: readonly DimensionChain[], bands: readonly Band[], wallPx: number, witness?: WallWitness | null): PlanExtent | null {
  const legacy = planExtentOf(chainsIn, bands, wallPx)
  if (witness === undefined) return legacy
  const framing = framingChains(chainsIn, witness, wallPx)
  const refusedAll = new Set(framing.roles.filter((r) => r.refused).map((r) => r.chainId))
  const chains = framing.allowed
  const legacyProvenance: PlanExtent['provenance'] = legacy?.weak ? { x: 'WALL_GEOMETRY_EXTENT', y: 'WALL_GEOMETRY_EXTENT' } : { x: 'DIMENSION_CHAIN_EXTENT', y: 'DIMENSION_CHAIN_EXTENT' }
  const annotate = (e: PlanExtent | null, refused: string[], provenance: PlanExtent['provenance']): PlanExtent | null => (e ? { ...e, roles: framing.roles, refused, provenance } : e)
  const framedX = dimensionedAxis(chainsIn, 'HORIZONTAL')?.chainId
  const framedY = dimensionedAxis(chainsIn, 'VERTICAL')?.chainId
  const refusedX = framedX !== undefined && refusedAll.has(framedX)
  const refusedY = framedY !== undefined && refusedAll.has(framedY)
  if (!witness || !legacy || (!refusedX && !refusedY)) return annotate(legacy, [], legacyProvenance)
  // The refused chains that would have framed an axis: wider than the widest chain allowed there.
  const displaced = (['HORIZONTAL', 'VERTICAL'] as const)
    .flatMap((a) => {
      const kept = dimensionedAxis(chains, a)
      const keptSpan = kept ? kept.hi - kept.lo : -1
      return chainsIn
        .filter((c) => c.axis === a && refusedAll.has(c.id))
        .filter((c) => {
          const own = dimensionedAxis([c], a)
          return own !== null && own.hi - own.lo > keptSpan
        })
        .map((c) => c.id)
    })
    .sort()
  type Span = { lo: number; hi: number; provenance: ExtentProvenance }
  const widest = (a: 'HORIZONTAL' | 'VERTICAL'): Span => {
    // What the drawing states: another read chain, an exterior chain's ticks — the widest of them.
    const statements: Span[] = []
    const read = dimensionedAxis(chains, a)
    if (read) statements.push({ lo: read.lo, hi: read.hi, provenance: 'DIMENSION_CHAIN_EXTENT' })
    const ticks = exteriorSpan(chainsIn, framing.roles, a, witness)
    if (ticks) statements.push({ lo: ticks.lo, hi: ticks.hi, provenance: 'EXTERIOR_CHAIN_TICKS' })
    const walls: Span = a === 'HORIZONTAL' ? { lo: witness.rect.x0, hi: witness.rect.x1, provenance: 'WALL_GEOMETRY_EXTENT' } : { lo: witness.rect.y0, hi: witness.rect.y1, provenance: 'WALL_GEOMETRY_EXTENT' }
    const stated = statements.reduce<Span | undefined>((best, c) => (!best || c.hi - c.lo > best.hi - best.lo + 1e-9 ? c : best), undefined)
    // The walls frame the axis only where nothing stated covers half of them: a witness may carry wall-thick
    // ink attached outside the building (a parapet, a planter), and a statement is not overruled by it.
    return stated && stated.hi - stated.lo >= (walls.hi - walls.lo) / 2 ? stated : walls
  }
  const x: Span = refusedX ? widest('HORIZONTAL') : { lo: legacy.rect.x0, hi: legacy.rect.x1, provenance: legacyProvenance.x }
  const y: Span = refusedY ? widest('VERTICAL') : { lo: legacy.rect.y0, hi: legacy.rect.y1, provenance: legacyProvenance.y }
  const rect = { x0: round6(x.lo), y0: round6(y.lo), x1: round6(x.hi), y1: round6(y.hi) }
  const inside = longBands(bands, wallPx).filter((b) => (b.axis === 'VERTICAL' ? b.axisPx >= rect.x0 && b.axisPx <= rect.x1 : b.axisPx >= rect.y0 && b.axisPx <= rect.y1))
  const widened = ((r: PixelRect, o: PixelRect | null): PixelRect => (o ? { x0: Math.min(r.x0, o.x0), y0: Math.min(r.y0, o.y0), x1: Math.max(r.x1, o.x1), y1: Math.max(r.y1, o.y1) } : r))(rect, axisBox(inside, wallPx))
  const said = (p: ExtentProvenance): string => (p === 'DIMENSION_CHAIN_EXTENT' ? 'a read chain' : p === 'EXTERIOR_CHAIN_TICKS' ? 'the ticks of an exterior chain' : 'the wall witness')
  const next: PlanExtent = {
    rect: widened,
    weak: x.provenance !== 'DIMENSION_CHAIN_EXTENT' || y.provenance !== 'DIMENSION_CHAIN_EXTENT' || legacy.weak,
    why: `${displaced.length} interior chain${displaced.length === 1 ? ' was' : 's were'} refused as the building's extent; its width is taken from ${said(x.provenance)} and its depth from ${said(y.provenance)}`,
  }
  // A refusal exists to stop a room's width standing for the building's. It stands only where the frame taken
  // without the refused chain is wider on a refused axis than the legacy frame was; a narrower one says the
  // walls, not the chain, were what the legacy frame rested on.
  const widens =
    (refusedX && next.rect.x1 - next.rect.x0 > legacy.rect.x1 - legacy.rect.x0 + wallPx * 2) || (refusedY && next.rect.y1 - next.rect.y0 > legacy.rect.y1 - legacy.rect.y0 + wallPx * 2)
  return widens ? annotate(next, displaced, { x: x.provenance, y: y.provenance }) : annotate(legacy, [], legacyProvenance)
}

function planExtentOf(chains: readonly DimensionChain[], bands: readonly Band[], wallPx: number): { rect: PixelRect; weak: boolean; why: string } | null {
  const long = longBands(bands, wallPx)
  const chainRect = dimensionedExtent(chains)
  const fromBands = axisBox(long, wallPx)
  if (!chainRect) {
    if (!fromBands) return null
    return { rect: fromBands, weak: true, why: `no dimension chain on this frame read a value, so the frame is the ${long.length} wall bands' own` }
  }
  const within = (b: Band, rect: PixelRect): boolean => {
    const axisPx = b.axisPx
    return b.axis === 'VERTICAL' ? axisPx >= rect.x0 && axisPx <= rect.x1 : axisPx >= rect.y0 && axisPx <= rect.y1
  }
  // Even when the chains only describe a corner of the plan they say WHERE on
  // the sheet the plan is, and a sheet carries other drawn matter — a title
  // block, a logo, a north arrow, a second small drawing — that has nothing to
  // do with this building. Bands more than a third of the chains' own span
  // away from them are that other matter.
  const margin = 0.35
  const near: PixelRect = {
    x0: chainRect.x0 - (chainRect.x1 - chainRect.x0) * margin,
    x1: chainRect.x1 + (chainRect.x1 - chainRect.x0) * margin,
    y0: chainRect.y0 - (chainRect.y1 - chainRect.y0) * margin,
    y1: chainRect.y1 + (chainRect.y1 - chainRect.y0) * margin,
  }
  const candidates = long.filter((b) => within(b, near))
  const inside = candidates.filter((b) => within(b, chainRect))
  const lengthOf = (list: readonly Band[]): number => list.reduce((a, b) => a + b.length, 0)
  const held = lengthOf(inside)
  const loose = lengthOf(candidates) - held
  const widen = (rect: PixelRect, other: PixelRect | null): PixelRect =>
    other ? { x0: Math.min(rect.x0, other.x0), y0: Math.min(rect.y0, other.y0), x1: Math.max(rect.x1, other.x1), y1: Math.max(rect.y1, other.y1) } : rect
  if (held >= loose) {
    return { rect: widen(chainRect, axisBox(inside, wallPx)), weak: false, why: `the dimension chains' own span, with ${Math.round(held)} px of the ${Math.round(held + loose)} px of wall found lying inside it` }
  }
  const nearBands = axisBox(candidates, wallPx) ?? fromBands
  return {
    rect: widen(chainRect, nearBands),
    weak: true,
    why: `${Math.round(loose)} px of the ${Math.round(held + loose)} px of wall found lies outside the dimension chains' span, so the chains describe a detail of this plan and not its extent`,
  }
}

/**
 * The box the wall bands occupy, snapped to the structural grid.
 *
 * Taken from the bands' AXES rather than their bounding boxes, because a band
 * is measured along its whole run and a run overshoots: a wall drawn past the
 * corner, a post standing out on a terrace, a right-hand wall whose ink
 * continues into a logo. An axis is a position and cannot overshoot, and half
 * a wall on either side of the outermost axes is the wall's own outer face.
 * The result is then snapped to the nearest grid line, because a dimension
 * chain states where that face is to the centimetre and a band estimates it.
 */
function walledEnvelope(
  bands: readonly Band[],
  linesX: readonly GridLine[],
  linesY: readonly GridLine[],
  wallPx: number,
  registration: CoordinateRegistration,
): WalledEnvelope | null {
  // Short bands are not walls. A bush, a step, a kerb and a pier are all drawn
  // in heavy ink and all of them sit outside the building, so an envelope
  // taken from every band there is reaches out to whichever of them is drawn
  // furthest away. A wall runs.
  const long = longBands(bands, wallPx)
  const axes = axisBox(long, wallPx)
  if (!axes) return null
  const box = sideWallReach(long, bands, axes, wallPx)
  const vertical = long.filter((b) => b.axis === 'VERTICAL')
  const horizontal = long.filter((b) => b.axis === 'HORIZONTAL')
  const snap = (px: number, lines: readonly GridLine[]): number => {
    let best = px
    let gap = wallPx
    for (const line of lines) {
      const d = Math.abs(line.px - px)
      if (d < gap) {
        gap = d
        best = line.px
      }
    }
    return best
  }
  const rect: PixelRect = { x0: snap(box.x0, linesX), x1: snap(box.x1, linesX), y0: snap(box.y0, linesY), y1: snap(box.y1, linesY) }
  // One wall line on an axis gives a box with no thickness. That is not a
  // small envelope, it is the absence of one, and reporting it as a rectangle
  // would have every cell of the plan fall outside the building.
  if (rect.x1 - rect.x0 < wallPx * 4 || rect.y1 - rect.y0 < wallPx * 4) return null
  const u0 = (rect.x0 - registration.originPx.x) * registration.metresPerPixelX
  const u1 = (rect.x1 - registration.originPx.x) * registration.metresPerPixelX
  const v0 = (rect.y0 - registration.originPx.y) * registration.metresPerPixelY
  const v1 = (rect.y1 - registration.originPx.y) * registration.metresPerPixelY
  return {
    rect,
    metric: { x0: round6(Math.min(u0, u1)), z0: round6(Math.min(v0, v1)), x1: round6(Math.max(u0, u1)), z1: round6(Math.max(v0, v1)) },
    bands: { vertical: vertical.length, horizontal: horizontal.length },
    why: `the outermost of ${vertical.length} wall axes across and ${horizontal.length} along, taken to their outer faces and snapped to the dimension grid`,
  }
}

/**
 * Where the building's two outermost side walls both run past the last long
 * wall across them, and stop at the same line, the building goes on to that
 * line (BUILDPLAN-ANALYZER-005B).
 *
 * The box above is taken from the long walls' axes, and a side of the building
 * whose wall is all openings — a garage door, a recessed entrance and a wide
 * window in one front — leaves no long band on that side: only piers, each
 * shorter than a wall is long. The box then stops at the last long wall inside
 * the building, and every room between it and the real front is outside by
 * construction. Both side walls of the building still run down to the front,
 * and two parallel walls that each run on well past the box and stop together
 * are the building's own sides, not a kerb or a post: one wall running on
 * alone is a wing, a fence or a pergola, and is left to the bays. Their common
 * end is the front's inner face; the front's axis is half a wall beyond it,
 * snapped to the grid like every other side.
 *
 * The front must be there to be found: at least one piece of wall-thick ink —
 * a pier between two openings — lies on that line between the two side walls,
 * clear of their corners, on the side walls' own end line (within half a
 * wall). Side walls running on to a line with nothing across it are the
 * returns of a loggia or a porch, whose mouth is open and whose floor is
 * outside; that is a recess, and it stays one.
 *
 * And the box must have stopped at a partition, not at a facade: when the
 * long cross wall the box ends on is wall-thick, it IS the building's outside
 * wall, and side walls running on past it with a pier at their ends frame a
 * terrace, a carport or a covered porch in front of it — outside.
 */
function sideWallReach(long: readonly Band[], all: readonly Band[], box: PixelRect, wallPx: number): PixelRect {
  const half = wallPx / 2
  const reach = { ...box }
  for (const axis of ['VERTICAL', 'HORIZONTAL'] as const) {
    const vertical = axis === 'VERTICAL'
    const bands = long.filter((b) => b.axis === axis)
    const [s0, s1] = vertical ? [box.x0 + half, box.x1 - half] : [box.y0 + half, box.y1 - half]
    const sideA = bands.filter((b) => Math.abs(b.axisPx - s0) <= wallPx)
    const sideB = bands.filter((b) => Math.abs(b.axisPx - s1) <= wallPx)
    if (sideA.length === 0 || sideB.length === 0 || s1 - s0 < wallPx * 4) continue
    const from = (b: Band): number => (vertical ? b.bounds.y0 : b.bounds.x0)
    const to = (b: Band): number => (vertical ? b.bounds.y1 : b.bounds.x1)
    const [e0, e1] = vertical ? [box.y0, box.y1] : [box.x0, box.x1]
    const endA = Math.max(...sideA.map(to))
    const endB = Math.max(...sideB.map(to))
    const startA = Math.min(...sideA.map(from))
    const startB = Math.min(...sideB.map(from))
    // A pier on the line: wall-thick ink across the side walls' axis, between them and clear of their corners.
    const across = all.filter((b) => b.axis !== axis && b.thickness >= wallPx * 0.6)
    const pierOn = (line: number): boolean =>
      across.some((b) => {
        const [a0, a1] = vertical ? [b.bounds.x0, b.bounds.x1] : [b.bounds.y0, b.bounds.y1]
        return Math.abs(b.axisPx - line) <= half && a0 >= s0 + wallPx && a1 <= s1 - wallPx
      })
    // The long cross walls the box ends on: all partitions (thinner than a wall), or is one a facade?
    const crossLong = long.filter((b) => b.axis !== axis)
    const endsOnPartition = (edge: number): boolean => {
      const at = crossLong.filter((b) => Math.abs(b.axisPx - edge) <= wallPx)
      return at.length > 0 && at.every((b) => b.thickness < wallPx * 0.7)
    }
    const farEnd = Math.min(endA, endB)
    const nearEnd = Math.max(startA, startB)
    const far = farEnd - e1 >= wallPx * 2 && Math.abs(endA - endB) <= wallPx * 2 && endsOnPartition(e1 - half) && pierOn(farEnd + half) ? round6(farEnd + half) : e1
    const near = e0 - nearEnd >= wallPx * 2 && Math.abs(startA - startB) <= wallPx * 2 && endsOnPartition(e0 + half) && pierOn(nearEnd - half) ? round6(nearEnd - half) : e0
    if (vertical) {
      reach.y0 = near
      reach.y1 = far
    } else {
      reach.x0 = near
      reach.x1 = far
    }
  }
  return reach
}

/**
 * The longest single stroke of ink running along a gap, as a fraction of it.
 *
 * Searched across a band of rows (or columns) rather than on one probe line,
 * because where a drawing puts a door leaf or a glazing line inside a wall's
 * thickness varies — on the inner face, on the axis, in two lines either side
 * of it — while its being ONE unbroken stroke from jamb to jamb does not. A
 * pixel or two of break is forgiven: anti-aliasing thins a hairline, it does
 * not interrupt it.
 */
export function infillAcross(mask: Mask, along: 'X' | 'Y', from: number, to: number, bandLo: number, bandHi: number): number {
  const a = Math.max(0, Math.round(from))
  const b = Math.min((along === 'X' ? mask.width : mask.height) - 1, Math.round(to))
  if (b <= a) return 0
  let best = 0
  for (let r = Math.round(bandLo); r <= Math.round(bandHi); r += 1) {
    let run = 0
    let gap = 0
    let longest = 0
    for (let t = a; t <= b; t += 1) {
      const ink = along === 'X' ? at(mask, t, r) : at(mask, r, t)
      if (ink === 1) {
        run += 1 + gap
        gap = 0
      } else if (run > 0 && gap < 2) {
        gap += 1
      } else {
        run = 0
        gap = 0
      }
      if (run > longest) longest = run
    }
    best = Math.max(best, longest)
  }
  return round6(Math.min(1, best / Math.max(1, b - a)))
}

/** A callout printed at a gap whose width agrees with the gap's. */
function calloutAt(
  callouts: readonly PlanCallout[],
  along: 'X' | 'Y',
  linePx: number,
  fromPx: number,
  toPx: number,
  widthsCm: readonly number[],
  reachPx: number,
  sidePx: number,
  nearerThan?: number,
): OpeningEvidence['callout'] {
  let best: OpeningEvidence['callout']
  for (const c of callouts) {
    const across = along === 'X' ? c.at.y : c.at.x
    const at1 = along === 'X' ? c.at.x : c.at.y
    const off = Math.abs(across - linePx)
    if (off > reachPx) continue
    if (nearerThan !== undefined && Math.abs(across - nearerThan) < off) continue
    if (at1 < fromPx - sidePx || at1 > toPx + sidePx) continue
    for (const w of c.widthsCm) {
      const ok = widthsCm.some((g) => Math.abs(w.value - g) <= Math.max(35, g * 0.12))
      if (ok && (!best || w.confidence > best.confidence)) best = { id: c.id, widthCm: w.value, confidence: round6(w.confidence) }
    }
  }
  return best
}

/**
 * The stretches of one wall line that are wall ALONG it: its own bands, not
 * the walls that cross it. A gap between two of these is a gap in one wall;
 * a gap between two crossing walls is a mouth between two others.
 */
function alongWallPieces(bands: readonly Band[], axis: 'X' | 'Y', line: GridLine, tolerance: number): Array<{ from: number; to: number; lo: number; hi: number }> {
  const pieces: Array<{ from: number; to: number; lo: number; hi: number }> = []
  for (const band of bands) {
    const along = (band.axis === 'VERTICAL') === (axis === 'X')
    if (!along) continue
    const lo = axis === 'X' ? band.bounds.x0 : band.bounds.y0
    const hi = axis === 'X' ? band.bounds.x1 : band.bounds.y1
    if (!line.probesPx.some((p) => p >= lo - tolerance && p <= hi + tolerance)) continue
    for (const seg of band.segments) pieces.push({ from: seg.from, to: seg.to, lo, hi })
  }
  pieces.sort((p, q) => p.from - q.from)
  const merged: typeof pieces = []
  for (const piece of pieces) {
    const last = merged[merged.length - 1]
    if (last && piece.from <= last.to + 1) {
      last.to = Math.max(last.to, piece.to)
      last.lo = Math.min(last.lo, piece.lo)
      last.hi = Math.max(last.hi, piece.hi)
    } else merged.push({ ...piece })
  }
  return merged
}

type WideOpeningContext = {
  mask: Mask
  bands: readonly Band[]
  linesX: readonly GridLine[]
  linesY: readonly GridLine[]
  envelope: WalledEnvelope | null
  wallPx: number
  mppX: number
  mppY: number
  callouts: readonly PlanCallout[]
  maxOpeningPx: number
  maxWidePx: number
  /** The resolver's other reading: a mouth both side walls reach, within the widest a wall's hole can be, is an opening. */
  shutMouths: boolean
  minJambPx: number
  minInfill: number
  tolerance: number
}

/**
 * Gaps in one wall line wider than the width convention, weighed.
 *
 * Found over the WHOLE line: continuity belongs to the drawing, and a 5 m
 * opening that a grid line happens to cross is still one opening between the
 * same two pieces of wall. Only a gap between two pieces of the SAME wall is
 * weighed here — a mouth between two walls that cross the line is a
 * different thing, and is a bay's question if it is anybody's.
 *
 * A wide gap is an opening only when a door or glazing is drawn across it:
 * a callout near it is recorded but does not decide, because the callout by
 * a recess's mouth very often belongs to the glazing at its back.
 */
function collinearWideGaps(ctx: WideOpeningContext): Array<{ axis: 'X' | 'Y'; line: GridLine; decision: WideOpeningDecision }> {
  const out: Array<{ axis: 'X' | 'Y'; line: GridLine; decision: WideOpeningDecision }> = []
  for (const axis of ['X', 'Y'] as const) {
    const lines = axis === 'X' ? ctx.linesX : ctx.linesY
    const mpp = axis === 'X' ? ctx.mppY : ctx.mppX
    for (const line of lines) {
      const pieces = alongWallPieces(ctx.bands, axis, line, ctx.tolerance)
      for (let i = 0; i + 1 < pieces.length; i += 1) {
        const left = pieces[i]
        const right = pieces[i + 1]
        const gap = right.from - left.to
        if (gap <= ctx.maxOpeningPx || gap > ctx.maxWidePx) continue
        const jambs = left.to - left.from >= ctx.minJambPx && right.to - right.from >= ctx.minJambPx
        if (!jambs) continue
        const lo = Math.min(left.lo, right.lo) - 1
        const hi = Math.max(left.hi, right.hi) + 1
        // `along` is the direction the wall runs: a vertical grid line (X) is a wall running along y.
        const infill = infillAcross(ctx.mask, axis === 'X' ? 'Y' : 'X', left.to, right.from, lo, hi)
        const widthM = round6(gap * mpp)
        const callout = calloutAt(ctx.callouts, axis === 'X' ? 'Y' : 'X', line.px, left.to, right.from, [widthM * 100], Math.max(ctx.wallPx * 4, 1.5 / mpp), 1 / mpp)
        const opening = infill >= ctx.minInfill
        out.push({
          axis,
          line,
          decision: {
            kind: 'COLLINEAR_GAP',
            axis,
            linePx: line.px,
            fromPx: round6(left.to),
            toPx: round6(right.from),
            widthM,
            evidence: { jambs, infill, ...(callout ? { callout } : {}) },
            decision: opening ? 'OPENING_IN_WALL' : 'OPEN_SIDE',
            score: round6(Math.min(1, 0.3 + 0.5 * Math.min(1, infill / ctx.minInfill) + (callout ? 0.2 : 0))),
            why: opening
              ? `a ${widthM.toFixed(2)} m gap between two pieces of one wall with ${Math.round(infill * 100)}% of it spanned by one drawn line${callout ? ` and a callout of ${callout.widthCm} cm beside it` : ''}: an opening in a wall that carries on`
              : `a ${widthM.toFixed(2)} m gap between two pieces of one wall, wider than a lintel conventionally spans, with only ${Math.round(infill * 100)}% of it drawn across: where the wall stops`,
          },
        })
      }
    }
  }
  return out
}

/**
 * Bays: two walls leaving the envelope side by side, and what closes them.
 *
 * The walled envelope is the box the long walls' axes span, so a wing whose
 * far side is not itself a long wall — a garage fronted by two piers and a
 * door — falls outside it and is pre-seeded as ground. What says otherwise is
 * the bay's own construction: two walls of the building's own thickness
 * running out from it together, and a mouth between their ends that the
 * drawing shuts. The mouth is shut when both side walls reach its line AND
 * either one drawn line spans the gap inside the wall's thickness (the door
 * leaf, the glazing) or a callout printed at the mouth states the gap's width.
 * Walls reaching out with nothing drawn between their ends — a carport, a
 * covered passage, a porch — leave the mouth open, and the bay stays ground.
 */
function baysOf(ctx: WideOpeningContext): PlanBay[] {
  const env = ctx.envelope
  if (!env) return []
  const out: PlanBay[] = []
  const sides = [
    { side: 'MAX_Z' as const, bandAxis: 'VERTICAL' as const, edge: env.rect.y1, dir: 1, lines: ctx.linesY, mpp: ctx.mppY, acrossMpp: ctx.mppX },
    { side: 'MIN_Z' as const, bandAxis: 'VERTICAL' as const, edge: env.rect.y0, dir: -1, lines: ctx.linesY, mpp: ctx.mppY, acrossMpp: ctx.mppX },
    { side: 'MAX_X' as const, bandAxis: 'HORIZONTAL' as const, edge: env.rect.x1, dir: 1, lines: ctx.linesX, mpp: ctx.mppX, acrossMpp: ctx.mppY },
    { side: 'MIN_X' as const, bandAxis: 'HORIZONTAL' as const, edge: env.rect.x0, dir: -1, lines: ctx.linesX, mpp: ctx.mppX, acrossMpp: ctx.mppY },
  ]
  const minOut = Math.max(ctx.wallPx * 4, 1.5 / Math.max(ctx.mppX, ctx.mppY))
  for (const s of sides) {
    const vertical = s.bandAxis === 'VERTICAL'
    const acrossLo = vertical ? env.rect.x0 : env.rect.y0
    const acrossHi = vertical ? env.rect.x1 : env.rect.y1
    const runOf = (b: Band): [number, number] => (vertical ? [b.bounds.y0, b.bounds.y1] : [b.bounds.x0, b.bounds.x1])
    const leaving = ctx.bands
      .filter((b) => b.axis === s.bandAxis && b.thickness >= ctx.wallPx * 0.6 && b.axisPx >= acrossLo - ctx.wallPx && b.axisPx <= acrossHi + ctx.wallPx)
      .map((b) => {
        const [r0, r1] = runOf(b)
        // where the band starts relative to the envelope edge, and how far out it reaches
        const start = s.dir > 0 ? r0 : r1
        const reach = s.dir > 0 ? r1 - s.edge : s.edge - r0
        return { b, start, reach }
      })
      .filter((x) => Math.abs(x.start - s.edge) <= ctx.wallPx * 2.5 && x.reach >= minOut)
      .sort((p, q) => p.b.axisPx - q.b.axisPx)
    for (let i = 0; i + 1 < leaving.length; i += 1) {
      const a = leaving[i]
      const c = leaving[i + 1]
      const separationM = (c.b.axisPx - a.b.axisPx) * s.acrossMpp
      if (separationM < 2) continue
      // The far line: the grid line at the outer face of the mouth, a wall's
      // thickness past where the SHORTER side wall's band stops (the corner
      // block beyond it belongs to the mouth's wall, and the band reader drops
      // corner pixels).
      const reach = Math.min(a.reach, c.reach)
      const target = s.edge + s.dir * (reach + ctx.wallPx)
      const far = [...s.lines].sort((p, q) => Math.abs(p.px - target) - Math.abs(q.px - target))[0]
      if (!far || Math.abs(far.px - target) > ctx.wallPx * 1.5) continue
      if (Math.abs(far.px - s.edge) < minOut) continue
      const inner0 = vertical ? a.b.bounds.x1 : a.b.bounds.y1
      const inner1 = vertical ? c.b.bounds.x0 : c.b.bounds.y0
      const outer0 = vertical ? a.b.bounds.x0 : a.b.bounds.y0
      const outer1 = vertical ? c.b.bounds.x1 : c.b.bounds.y1
      // Both side walls reach the far line, within a wall's thickness of it.
      const corners = [a, c].every((x) => x.reach >= Math.abs(far.px - s.edge) - ctx.wallPx * 1.6)
      // The mouth's own wall: from the outer face line inward by one wall's
      // thickness. Piers are solid across all of it; a door leaf or a glazing
      // line is drawn somewhere inside it, or on its inner face, so the
      // infill is searched a little deeper — but never on the outer face line
      // itself, where a paving edge or a kerb can run straight past a carport.
      const pier0 = s.dir > 0 ? far.px - ctx.wallPx * 1.05 : far.px + 1
      const pier1 = s.dir > 0 ? far.px - 1 : far.px + ctx.wallPx * 1.05
      const fill0 = s.dir > 0 ? far.px - ctx.wallPx * 1.6 : far.px + ctx.wallPx * 0.25
      const fill1 = s.dir > 0 ? far.px - ctx.wallPx * 0.25 : far.px + ctx.wallPx * 1.6
      // Piers: columns of the mouth's wall that are solid ink.
      const solid: boolean[] = []
      const z0 = Math.round(Math.min(pier0, pier1))
      const z1 = Math.round(Math.max(pier0, pier1))
      for (let t = Math.round(inner0); t <= Math.round(inner1); t += 1) {
        let ink = 0
        for (let r = z0; r <= z1; r += 1) ink += vertical ? at(ctx.mask, t, r) : at(ctx.mask, r, t)
        solid.push(ink >= (z1 - z0 + 1) * 0.6)
      }
      // A solid run narrower than a jamb is not a pier: it is a leader line
      // from a callout, a door stop, a hairline drawn across the zone.
      for (let k = 0; k < solid.length; ) {
        if (!solid[k]) {
          k += 1
          continue
        }
        let e = k
        while (e < solid.length && solid[e]) e += 1
        if (e - k < ctx.minJambPx) for (let j = k; j < e; j += 1) solid[j] = false
        k = e
      }
      const gaps: Array<[number, number]> = []
      let runStart = -1
      for (let k = 0; k <= solid.length; k += 1) {
        const open = k < solid.length && !solid[k]
        if (open && runStart < 0) runStart = k
        if (!open && runStart >= 0) {
          if (k - runStart >= 3) gaps.push([Math.round(inner0) + runStart, Math.round(inner0) + k])
          runStart = -1
        }
      }
      const widest = gaps.sort((p, q) => q[1] - q[0] - (p[1] - p[0]))[0] ?? [inner0, inner1]
      const gapPx = widest[1] - widest[0]
      const widthM = round6(gapPx * s.acrossMpp)
      const infill = infillAcross(ctx.mask, vertical ? 'X' : 'Y', widest[0], widest[1], Math.round(Math.min(fill0, fill1)), Math.round(Math.max(fill0, fill1)))
      const callout = calloutAt(
        ctx.callouts,
        vertical ? 'X' : 'Y',
        far.px,
        outer0,
        outer1,
        [widthM * 100, (inner1 - inner0) * s.acrossMpp * 100],
        Math.max(ctx.wallPx * 4, 1.5 / s.mpp),
        1 / s.acrossMpp,
        s.edge,
      )
      const drawn = infill >= ctx.minInfill
      const evidenced = corners && (drawn || !!callout) && (gapPx <= ctx.maxWidePx || (drawn && !!callout))
      // The other reading of an undrawn mouth both side walls reach: a garage door or a glazed
      // wall rather than a carport or a loggia. Asked for by the resolver only.
      const byHypothesis = !evidenced && ctx.shutMouths && corners && gapPx <= ctx.maxWidePx
      const opening = evidenced || byHypothesis
      const signals = [corners ? 'both side walls reach it' : 'a side wall stops short of it', drawn ? `${Math.round(infill * 100)}% of the gap is one drawn line` : `only ${Math.round(infill * 100)}% of the gap is drawn across`, callout ? `a callout of ${callout.widthCm} cm is printed at it` : 'no callout states its width']
      const mouth: WideOpeningDecision = {
        kind: 'BAY_MOUTH',
        axis: vertical ? 'Y' : 'X',
        linePx: far.px,
        fromPx: round6(widest[0]),
        toPx: round6(widest[1]),
        widthM,
        evidence: { jambs: corners, corners, infill, ...(callout ? { callout } : {}) },
        decision: opening ? 'OPENING_IN_WALL' : 'OPEN_SIDE',
        score: round6((corners ? 0.3 : 0) + (drawn ? 0.35 : 0.35 * Math.min(1, infill / ctx.minInfill) * 0.5) + (callout ? 0.35 * Math.min(1, callout.confidence / 0.5) : 0)),
        why: byHypothesis
          ? `the mouth of a bay two walls reach out to, ${widthM.toFixed(2)} m wide: ${signals.join(', ')} — read, as another reading of the plan, as a wide opening in the bay's front wall rather than an open side`
          : opening
            ? `the mouth of a bay two walls enclose, ${widthM.toFixed(2)} m wide: ${signals.join(', ')} — an opening in the bay's front wall`
            : `the mouth of a bay two walls reach out to, ${widthM.toFixed(2)} m wide: ${signals.join(', ')} — an open side`,
      }
      const rect: PixelRect = vertical
        ? { x0: outer0, x1: outer1, y0: Math.min(s.edge, far.px), y1: Math.max(s.edge, far.px) }
        : { y0: outer0, y1: outer1, x0: Math.min(s.edge, far.px), x1: Math.max(s.edge, far.px) }
      out.push({ side: s.side, rect, wallAxesPx: [a.b.axisPx, c.b.axisPx], mouth })
    }
  }
  return out
}

/**
 * Cut the plan into cells and say what each one is.
 *
 * The classification is three-way on purpose. BUILT and OUTSIDE are the
 * obvious cases; RECESS is the one that matters, because a porch, a loggia or
 * a recessed entrance is enclosed by the building on three sides and open on
 * the fourth, and a two-way classifier has to call it either a room — which
 * walls it in — or nothing — which deletes the most characteristic thing about
 * the facade. Giving it its own answer is what lets the solver build it as
 * topology later.
 */
export function decomposePlan(
  mask: Mask,
  chains: readonly DimensionChain[],
  bands: readonly Band[],
  registration: CoordinateRegistration,
  extent: PixelRect,
  options: PlanDecompositionOptions = {},
): PlanDecomposition {
  const opt = { ...DEFAULTS, ...options }
  // A band counts as this building's only when its AXIS falls inside the
  // dimensioned extent and most of its run does too. A sheet carries a north
  // arrow, a title block and a printer's logo, all of them drawn in heavy ink,
  // and none of them are walls.
  const inside = bands.filter((b) => {
    const axisPx = b.axisPx
    const withinAxis = b.axis === 'VERTICAL' ? axisPx >= extent.x0 && axisPx <= extent.x1 : axisPx >= extent.y0 && axisPx <= extent.y1
    if (!withinAxis) return false
    const lo = b.axis === 'VERTICAL' ? Math.max(b.bounds.y0, extent.y0) : Math.max(b.bounds.x0, extent.x0)
    const hi = b.axis === 'VERTICAL' ? Math.min(b.bounds.y1, extent.y1) : Math.min(b.bounds.x1, extent.x1)
    const total = b.axis === 'VERTICAL' ? b.bounds.y1 - b.bounds.y0 : b.bounds.x1 - b.bounds.x0
    return total > 0 && (hi - lo) / total >= 0.6
  })
  const wallPx = bandWallThickness(inside, opt.fallbackWallPx)
  const mppX = registration.metresPerPixelX
  const mppY = registration.metresPerPixelY
  const wallM = round6(wallPx * Math.max(mppX, mppY))
  const all = gridLines(chains, inside, extent, options)
  const unresolved: PlanDecomposition['unresolved'] = []

  const minCellPx = opt.minCellM / Math.max(mppX, mppY)
  const linesX = thinLines(all.linesX, minCellPx, wallPx)
  const linesY = thinLines(all.linesY, minCellPx, wallPx)
  const envelope = walledEnvelope(inside, linesX, linesY, wallPx, registration)
  if (envelope === null) {
    unresolved.push({
      what: 'the extent of this building\u2019s walls',
      reason: 'no wall band runs along one of the two axes, so there is nothing to take an outer face from',
    })
  }
  if (linesX.length < 2 || linesY.length < 2) {
    unresolved.push({
      what: 'a structural grid for this plan',
      reason: `only ${linesX.length} vertical and ${linesY.length} horizontal lines are supported by a dimension chain or a wall band`,
    })
    return { frameId: registration.frameId, wallThickness: { px: round6(wallPx), m: wallM }, envelope, linesX, linesY, cells: [], regions: [], extent, unresolved, wideOpenings: [], bays: [], hypotheses: [], chosenHypothesis: null }
  }

  const nx = linesX.length - 1
  const ny = linesY.length - 1
  const tolerance = Math.max(4, wallPx * 0.6)
  const lineTolerance = Math.max(3, wallPx * 0.35)
  const maxOpeningPx = opt.maxOpeningM / Math.max(mppX, mppY)
  const minJambPx = Math.max(2, wallPx * 0.5)

  const maxWidePx = opt.maxWideOpeningM / Math.max(mppX, mppY)
  const ctx: WideOpeningContext = { mask, bands: inside, linesX, linesY, envelope, wallPx, mppX, mppY, callouts: opt.callouts, maxOpeningPx, maxWidePx, shutMouths: opt.shutPocketMouths, minJambPx, minInfill: opt.minInfill, tolerance }
  // Wide gaps the drawing says are openings (H1's extra closures), per line.
  const collinear = collinearWideGaps(ctx)
  const bays = baysOf(ctx)
  const evidenceMap = (gaps: ReadonlyArray<{ axis: 'X' | 'Y'; line: GridLine; decision: WideOpeningDecision }>): Map<string, Array<[number, number]>> => {
    const map = new Map<string, Array<[number, number]>>()
    for (const g of gaps) {
      const key = `${g.axis}:${g.line.px}`
      map.set(key, [...(map.get(key) ?? []), [g.decision.fromPx, g.decision.toPx]])
    }
    return map
  }
  let evidencedOn = evidenceMap(collinear.filter((g) => g.decision.decision === 'OPENING_IN_WALL'))

  // --- closures of every edge of the grid, computed once per hypothesis ---
  // vEdge[ix][iy] is the vertical edge on line ix beside cell row iy.
  const topY = linesY[0].px
  const bottomY = linesY[ny].px
  const leftX = linesX[0].px
  const rightX = linesX[nx].px
  const edgesFor = (withEvidence: boolean, evidence: Map<string, Array<[number, number]>> = evidencedOn): { vEdge: EdgeClosure[][]; hEdge: EdgeClosure[][] } => {
    const vEdge: EdgeClosure[][] = []
    for (let ix = 0; ix <= nx; ix += 1) {
      const walls = wallIntervals(inside, 'X', linesX[ix], topY, bottomY, tolerance)
      const drawn = lineIntervals(mask, 'X', linesX[ix], topY, bottomY, lineTolerance, opt.minLinePx)
      const extra = withEvidence ? (evidence.get(`X:${linesX[ix].px}`) ?? []) : []
      const column: EdgeClosure[] = []
      for (let iy = 0; iy < ny; iy += 1) column.push(closureOf(walls, drawn, linesY[iy].px, linesY[iy + 1].px, maxOpeningPx, minJambPx, extra))
      vEdge.push(column)
    }
    const hEdge: EdgeClosure[][] = []
    for (let iy = 0; iy <= ny; iy += 1) {
      const walls = wallIntervals(inside, 'Y', linesY[iy], leftX, rightX, tolerance)
      const drawn = lineIntervals(mask, 'Y', linesY[iy], leftX, rightX, lineTolerance, opt.minLinePx)
      const extra = withEvidence ? (evidence.get(`Y:${linesY[iy].px}`) ?? []) : []
      const row: EdgeClosure[] = []
      for (let ix = 0; ix < nx; ix += 1) row.push(closureOf(walls, drawn, linesX[ix].px, linesX[ix + 1].px, maxOpeningPx, minJambPx, extra))
      hEdge.push(row)
    }
    if (withEvidence) {
      // A shut bay mouth shuts every edge of its far line between its two
      // side walls' axes: the piers, the corner blocks and the opening
      // between them are one front wall.
      for (const bay of bays) {
        if (bay.mouth.decision !== 'OPENING_IN_WALL') continue
        const [a0, a1] = bay.wallAxesPx
        if (bay.mouth.axis === 'Y') {
          const iy = linesY.findIndex((l) => l.px === bay.mouth.linePx)
          if (iy < 0) continue
          for (let ix = 0; ix < nx; ix += 1) {
            const centre = (linesX[ix].px + linesX[ix + 1].px) / 2
            if (centre < a0 || centre > a1) continue
            const e = hEdge[iy][ix]
            hEdge[iy][ix] = { ...e, opening: round6(Math.max(e.opening, 1 - e.wall)), closure: 1 }
          }
        } else {
          const ix = linesX.findIndex((l) => l.px === bay.mouth.linePx)
          if (ix < 0) continue
          for (let iy = 0; iy < ny; iy += 1) {
            const centre = (linesY[iy].px + linesY[iy + 1].px) / 2
            if (centre < a0 || centre > a1) continue
            const e = vEdge[ix][iy]
            vEdge[ix][iy] = { ...e, opening: round6(Math.max(e.opening, 1 - e.wall)), closure: 1 }
          }
        }
      }
    }
    return { vEdge, hEdge }
  }

  // --- flood fill over the CELLS, from outside the plan inwards ---
  const index = (ix: number, iy: number): number => iy * nx + ix
  const open = (c: EdgeClosure): boolean => c.closure < opt.closureThreshold
  const shutBays = bays.filter((b) => b.mouth.decision === 'OPENING_IN_WALL')
  const flood = (vEdge: EdgeClosure[][], hEdge: EdgeClosure[][], withBays: boolean): Uint8Array => {
    const reached = new Uint8Array(nx * ny)
    const queue: Array<[number, number]> = []
    const push = (ix: number, iy: number): void => {
      if (ix < 0 || iy < 0 || ix >= nx || iy >= ny) return
      if (reached[index(ix, iy)] === 1) return
      reached[index(ix, iy)] = 1
      queue.push([ix, iy])
    }
    // Anything beyond the walls is outside by construction, whatever ring of
    // paving, planting or plot boundary happens to be drawn around it. This is
    // what stops a front zone under the eaves from reading as a room. A bay
    // whose mouth the drawing shuts is walls too, and is left to the fill.
    if (envelope) {
      for (let iy = 0; iy < ny; iy += 1) {
        for (let ix = 0; ix < nx; ix += 1) {
          const cx = (linesX[ix].px + linesX[ix + 1].px) / 2
          const cy = (linesY[iy].px + linesY[iy + 1].px) / 2
          const inEnvelope = cx >= envelope.rect.x0 && cx <= envelope.rect.x1 && cy >= envelope.rect.y0 && cy <= envelope.rect.y1
          const inBay = withBays && shutBays.some((b) => cx >= b.rect.x0 && cx <= b.rect.x1 && cy >= b.rect.y0 && cy <= b.rect.y1)
          if (!inEnvelope && !inBay) push(ix, iy)
        }
      }
    }
    for (let iy = 0; iy < ny; iy += 1) {
      if (open(vEdge[0][iy])) push(0, iy)
      if (open(vEdge[nx][iy])) push(nx - 1, iy)
    }
    for (let ix = 0; ix < nx; ix += 1) {
      if (open(hEdge[0][ix])) push(ix, 0)
      if (open(hEdge[ny][ix])) push(ix, ny - 1)
    }
    while (queue.length > 0) {
      const [ix, iy] = queue.pop() as [number, number]
      if (open(vEdge[ix][iy])) push(ix - 1, iy)
      if (open(vEdge[ix + 1][iy])) push(ix + 1, iy)
      if (open(hEdge[iy][ix])) push(ix, iy - 1)
      if (open(hEdge[iy + 1][ix])) push(ix, iy + 1)
    }
    return reached
  }

  // A gap with nothing drawn across it can still be a hole in a wall: what
  // decides is what lies BEHIND it. Flood the plan with the gap open and with
  // it shut; the difference is the pocket the gap alone lets the outside into.
  // A porch, a loggia, a recessed entrance is a pocket about as deep as its
  // mouth is wide. The whole interior of a building, rooms and partitions
  // and all, is not a pocket — and a gap that would let the outside into it
  // is an opening in the wall, however wide, as long as the wall carries on
  // either side of it.
  {
    const undecided = collinear.filter((g) => g.decision.decision === 'OPEN_SIDE')
    if (undecided.length > 0) {
      const base = edgesFor(true)
      const reachedOpen = flood(base.vEdge, base.hEdge, true)
      const mppArea = mppX * mppY
      for (const g of undecided) {
        const shut = edgesFor(true, evidenceMap([...collinear.filter((c) => c.decision.decision === 'OPENING_IN_WALL'), g]))
        const reachedShut = flood(shut.vEdge, shut.hEdge, true)
        let pocketPx = 0
        let pocketCells = 0
        for (let iy = 0; iy < ny; iy += 1) {
          for (let ix = 0; ix < nx; ix += 1) {
            if (reachedOpen[index(ix, iy)] === 1 && reachedShut[index(ix, iy)] === 0) {
              pocketCells += 1
              pocketPx += (linesX[ix + 1].px - linesX[ix].px) * (linesY[iy + 1].px - linesY[iy].px)
            }
          }
        }
        const pocketM2 = round6(pocketPx * mppArea)
        const limitM2 = round6(Math.max(6, 2.5 * g.decision.widthM * g.decision.widthM))
        if (pocketCells > 0 && pocketM2 > limitM2) {
          g.decision = {
            ...g.decision,
            evidence: { ...g.decision.evidence, pocketM2 },
            decision: 'OPENING_IN_WALL',
            score: round6(Math.min(1, g.decision.score + 0.35)),
            why: `a ${g.decision.widthM.toFixed(2)} m gap between two pieces of one wall with nothing drawn across it, but behind it lies ${pocketM2.toFixed(1)} m² that is shut on every other side — the building's interior, not a ${limitM2.toFixed(1)} m² pocket — so the wall carries on across it`,
          }
        } else if (pocketCells > 0 && opt.shutPocketMouths) {
          g.decision = {
            ...g.decision,
            evidence: { ...g.decision.evidence, pocketM2 },
            decision: 'OPENING_IN_WALL',
            why: `a ${g.decision.widthM.toFixed(2)} m gap between two pieces of one wall with nothing drawn across it, in front of ${pocketM2.toFixed(1)} m² shut on every other side: read, as another reading of the plan, as a wide opening in the wall rather than the mouth of a pocket`,
          }
        } else if (pocketCells > 0) {
          g.decision = { ...g.decision, evidence: { ...g.decision.evidence, pocketM2 }, why: `${g.decision.why}; behind it lies only a ${pocketM2.toFixed(1)} m² pocket (a porch, a loggia, a recess), no deeper than such a mouth leads to` }
        }
      }
      evidencedOn = evidenceMap(collinear.filter((c) => c.decision.decision === 'OPENING_IN_WALL'))
    }
  }

  // Two readings of the enclosure. H0 shuts an edge on its wall, its drawn
  // line and the doorways the width convention allows. H1 also shuts the wide
  // gaps the drawing itself says are openings. Where nothing is evidenced they
  // are the same reading and H0 is taken; where they differ, every edge H1
  // adds rests on at least two independent signals, and it is taken.
  const strict = edgesFor(false)
  const reachedH0 = flood(strict.vEdge, strict.hEdge, false)
  const evidencedCount = [...evidencedOn.values()].reduce((a, l) => a + l.length, 0) + shutBays.length
  const continuity = evidencedCount > 0 ? edgesFor(true) : strict
  const reachedH1 = evidencedCount > 0 ? flood(continuity.vEdge, continuity.hEdge, true) : reachedH0
  const areaOf = (reached: Uint8Array): { cells: number; areaPx: number } => {
    let cells = 0
    let areaPx = 0
    for (let iy = 0; iy < ny; iy += 1) {
      for (let ix = 0; ix < nx; ix += 1) {
        if (reached[index(ix, iy)] === 1) continue
        cells += 1
        areaPx += (linesX[ix + 1].px - linesX[ix].px) * (linesY[iy + 1].px - linesY[iy].px)
      }
    }
    return { cells, areaPx: round6(areaPx) }
  }
  const h0 = areaOf(reachedH0)
  const h1 = areaOf(reachedH1)
  const evidenceScores = [...collinear.filter((g) => g.decision.decision === 'OPENING_IN_WALL').map((g) => g.decision.score), ...shutBays.map((b) => b.mouth.score)]
  const differs = evidencedCount > 0 && (h0.cells !== h1.cells || h0.areaPx !== h1.areaPx)
  const hypotheses: EnclosureHypothesis[] = [
    {
      id: 'H0_STRICT_ENCLOSURE',
      rule: `an edge is shut by wall, by drawn line, or by a doorway no wider than ${opt.maxOpeningM} m between two pieces of wall`,
      builtCells: h0.cells,
      builtAreaPx: h0.areaPx,
      closedOpenings: 0,
      score: differs ? 0.5 : 1,
      why: differs ? 'it leaves open gaps the drawing itself draws shut' : 'no wider gap is evidenced as an opening, so this is the whole reading',
    },
    {
      id: 'H1_WIDE_OPENING_CONTINUITY',
      rule: `H0, plus gaps up to ${opt.maxWideOpeningM} m between pieces of one wall that a drawn line spans or that would otherwise open the building's interior, and bay mouths both side walls reach that a drawn line or a matching callout shuts`,
      builtCells: h1.cells,
      builtAreaPx: h1.areaPx,
      closedOpenings: evidencedCount,
      score: differs ? round6(Math.min(...evidenceScores)) : 1,
      why: differs ? `${evidencedCount} wide opening${evidencedCount === 1 ? '' : 's'} closed, each on its own evidence (the weakest scoring ${Math.min(...evidenceScores).toFixed(2)})` : 'identical to H0 here',
    },
  ]
  const chosenHypothesis: EnclosureHypothesis['id'] = differs ? 'H1_WIDE_OPENING_CONTINUITY' : 'H0_STRICT_ENCLOSURE'
  const { vEdge, hEdge } = differs ? continuity : strict
  const reached = differs ? reachedH1 : reachedH0
  const wideOpenings = [...collinear.map((g) => g.decision), ...bays.map((b) => b.mouth)]

  // --- classify ---
  const cells: PlanCell[] = []
  for (let iy = 0; iy < ny; iy += 1) {
    for (let ix = 0; ix < nx; ix += 1) {
      const rect: PixelRect = { x0: linesX[ix].px, y0: linesY[iy].px, x1: linesX[ix + 1].px, y1: linesY[iy + 1].px }
      const edges: PlanCell['edges'] = [hEdge[iy][ix], vEdge[ix + 1][iy], hEdge[iy + 1][ix], vEdge[ix][iy]]
      const enclosed = reached[index(ix, iy)] === 0
      const shut = edges.filter((e) => e.closure >= opt.closureThreshold).length
      const content = interiorInk(mask, inside, rect)
      let classification: CellClass
      let why: string
      if (enclosed) {
        classification = 'BUILT'
        why = `no way in from outside the plan; ${shut} of its four edges are shut`
      } else if (shut >= 3 && envelope !== null && rect.x0 >= envelope.rect.x0 && rect.x1 <= envelope.rect.x1 && rect.y0 >= envelope.rect.y0 && rect.y1 <= envelope.rect.y1) {
        classification = 'RECESS'
        why = `open to the outside but shut on ${shut} sides: a pocket in the building rather than a room`
      } else {
        classification = 'OUTSIDE'
        why = `reachable from outside the plan with only ${shut} shut edge${shut === 1 ? '' : 's'}`
      }
      cells.push({
        ix,
        iy,
        rect,
        classification,
        edges,
        enclosed,
        interiorInk: content,
        confidence: round6(Math.min(0.95, 0.4 + 0.12 * shut + (enclosed ? 0.12 : 0) + (content >= opt.contentInk ? 0.05 : 0))),
        why,
      })
    }
  }

  // A recess is a pocket IN a building, so the building has to be around it.
  // Two tests, and a cell has to survive both. It must have built neighbours
  // on at least two of its shut sides — otherwise it is a patch of ground
  // that a dimension line, a watermark and the sheet's edge happen to have
  // boxed in — and those sides must not be opposite each other, because a gap
  // running clean between two parts of a building is a passage between them
  // and not a pocket in either.
  const byKey = new Map(cells.map((c) => [`${c.ix}:${c.iy}`, c]))
  const builtSides = (cell: PlanCell): boolean[] => {
    const neighbours: Array<[number, number]> = [
      [cell.ix, cell.iy - 1],
      [cell.ix + 1, cell.iy],
      [cell.ix, cell.iy + 1],
      [cell.ix - 1, cell.iy],
    ]
    return neighbours.map(([jx, jy], side) => cell.edges[side].closure >= opt.closureThreshold && byKey.get(`${jx}:${jy}`)?.classification === 'BUILT')
  }
  for (const cell of cells) {
    if (cell.classification !== 'RECESS') continue
    const [top, right, bottom, left] = builtSides(cell)
    const count = [top, right, bottom, left].filter(Boolean).length
    if (count < 2) {
      cell.classification = 'OUTSIDE'
      cell.why = `shut on ${cell.edges.filter((e) => e.closure >= opt.closureThreshold).length} sides but with the building on only ${count} of them: ground that happens to be boxed in, not a pocket`
    } else if (count === 2 && ((top && bottom) || (left && right))) {
      cell.classification = 'OUTSIDE'
      cell.why = 'the building is on two opposite sides of it: a gap between parts of the building, not a pocket in one'
    }
  }

  const regions = mergeRegions(cells, linesX, linesY, registration, nx, ny)
  if (regions.filter((r) => r.classification === 'BUILT').length === 0) {
    unresolved.push({ what: 'any built mass on this plan', reason: 'the flood fill reached every cell of the structural grid: no part of the plan is enclosed' })
  }
  return { frameId: registration.frameId, wallThickness: { px: round6(wallPx), m: wallM }, envelope, linesX, linesY, cells, regions, extent, unresolved, wideOpenings, bays, hypotheses, chosenHypothesis }
}

/**
 * Merge adjacent cells of one class into maximal rectangles, biggest first.
 *
 * Reading order will not do here. Taken row by row, a one-cell-wide sliver in
 * the top row claims the whole column beneath it before the body of the
 * building is ever reached, and the house comes out as two strips instead of
 * one mass. Taking the largest rectangle first — largest by AREA ON THE SHEET,
 * not by cell count, since cells are whatever size the dimension chains made
 * them — puts the masses down before the offcuts. Ties are broken by position
 * so the answer is the same twice.
 */
function mergeRegions(
  cells: readonly PlanCell[],
  linesX: readonly GridLine[],
  linesY: readonly GridLine[],
  registration: CoordinateRegistration,
  nx: number,
  ny: number,
): PlanRegion[] {
  const byIndex = new Map(cells.map((c) => [`${c.ix}:${c.iy}`, c]))
  const claimed = new Set<string>()
  const regions: PlanRegion[] = []

  const toMetric = (rect: PixelRect): PlanRegion['metric'] => {
    const u0 = (rect.x0 - registration.originPx.x) * registration.metresPerPixelX
    const u1 = (rect.x1 - registration.originPx.x) * registration.metresPerPixelX
    const v0 = (rect.y0 - registration.originPx.y) * registration.metresPerPixelY
    const v1 = (rect.y1 - registration.originPx.y) * registration.metresPerPixelY
    return { x0: round6(Math.min(u0, u1)), z0: round6(Math.min(v0, v1)), x1: round6(Math.max(u0, u1)), z1: round6(Math.max(v0, v1)) }
  }
  const free = (ix: number, iy: number, klass: CellClass): boolean => {
    const cell = byIndex.get(`${ix}:${iy}`)
    return cell !== undefined && cell.classification === klass && !claimed.has(`${ix}:${iy}`)
  }
  const widthPx = (ix: number): number => linesX[ix + 1].px - linesX[ix].px
  const heightPx = (iy: number): number => linesY[iy + 1].px - linesY[iy].px

  for (;;) {
    let best: { ix: number; iy: number; w: number; h: number; area: number; klass: CellClass } | null = null
    for (let iy = 0; iy < ny; iy += 1) {
      for (let ix = 0; ix < nx; ix += 1) {
        const seed = byIndex.get(`${ix}:${iy}`)
        if (!seed || seed.classification === 'OUTSIDE' || claimed.has(`${ix}:${iy}`)) continue
        const klass = seed.classification
        let reach = nx - ix
        let spanY = 0
        for (let h = 1; iy + h <= ny; h += 1) {
          let run = 0
          while (run < reach && free(ix + run, iy + h - 1, klass)) run += 1
          reach = Math.min(reach, run)
          if (reach === 0) break
          spanY += heightPx(iy + h - 1)
          let spanX = 0
          for (let k = 0; k < reach; k += 1) spanX += widthPx(ix + k)
          const area = spanX * spanY
          if (!best || area > best.area + 1e-9) best = { ix, iy, w: reach, h, area, klass }
        }
      }
    }
    if (!best) break
    const members: Array<{ ix: number; iy: number }> = []
    for (let dy = 0; dy < best.h; dy += 1) {
      for (let dx = 0; dx < best.w; dx += 1) {
        claimed.add(`${best.ix + dx}:${best.iy + dy}`)
        members.push({ ix: best.ix + dx, iy: best.iy + dy })
      }
    }
    const rect: PixelRect = { x0: linesX[best.ix].px, y0: linesY[best.iy].px, x1: linesX[best.ix + best.w].px, y1: linesY[best.iy + best.h].px }
    const confidences = members.map((mm) => byIndex.get(`${mm.ix}:${mm.iy}`)?.confidence ?? 0)
    regions.push({
      id: `region-${best.klass.toLowerCase()}-${best.ix}-${best.iy}`,
      classification: best.klass,
      rect,
      metric: toMetric(rect),
      cells: members,
      confidence: round6(Math.min(...confidences)),
      why: `${members.length} adjacent ${best.klass.toLowerCase()} cell${members.length === 1 ? '' : 's'} merged`,
    })
  }
  return regions.sort((a, b) => (b.rect.x1 - b.rect.x0) * (b.rect.y1 - b.rect.y0) - (a.rect.x1 - a.rect.x0) * (a.rect.y1 - a.rect.y0) || a.id.localeCompare(b.id))
}

/**
 * The BUILT regions of a plan gathered into BODIES.
 *
 * Regions are maximal RECTANGLES, and a building is not obliged to be one. A
 * house with a loggia bitten out of its front decomposes into the big
 * rectangle behind the pocket and the two strips either side of it, and those
 * three are one house: nothing is drawn between them, you walk from one to
 * the next without passing a wall, and reporting them as three bodies is the
 * same error as reporting the whole plan as one box, made in the other
 * direction.
 *
 * So two adjacent regions are one body when NO WALL IS DRAWN between them. A
 * wall is what divides a garage from the house it stands against; an
 * unmarked grid line, struck where a dimension chain happens to break or
 * where a recess's return wall ends, divides nothing.
 *
 * A body is only turned back into a rectangle when it IS one — when its
 * bounding box is covered by its own cells and by the pockets bitten out of
 * it. A body that is genuinely L-shaped stays as its separate regions, to be
 * reported as two bodies standing against each other, because inflating it to
 * its bounding box would build over ground the plan shows as open.
 */
export function planBodies(decomposition: PlanDecomposition, wallShare = 0.5): PlanRegion[] {
  const built = decomposition.regions.filter((r) => r.classification === 'BUILT')
  if (built.length < 2) return built
  const byCell = new Map<string, number>()
  built.forEach((region, index) => {
    for (const cell of region.cells) byCell.set(`${cell.ix}:${cell.iy}`, index)
  })
  const cellAt = new Map(decomposition.cells.map((c) => [`${c.ix}:${c.iy}`, c]))
  const parent = built.map((_, i) => i)
  const find = (i: number): number => {
    let root = i
    while (parent[root] !== root) root = parent[root]
    let walk = i
    while (parent[walk] !== walk) {
      const next = parent[walk]
      parent[walk] = root
      walk = next
    }
    return root
  }

  // How much of each pair's shared boundary carries a wall.
  const shared = new Map<string, { length: number; walled: number }>()
  for (const cell of decomposition.cells) {
    const mine = byCell.get(`${cell.ix}:${cell.iy}`)
    if (mine === undefined) continue
    const neighbours: Array<[number, number]> = [
      [cell.ix, cell.iy - 1],
      [cell.ix + 1, cell.iy],
      [cell.ix, cell.iy + 1],
      [cell.ix - 1, cell.iy],
    ]
    for (let s = 0; s < 4; s += 1) {
      const theirs = byCell.get(`${neighbours[s][0]}:${neighbours[s][1]}`)
      if (theirs === undefined || theirs === mine) continue
      const key = mine < theirs ? `${mine}:${theirs}` : `${theirs}:${mine}`
      const lengthPx = s % 2 === 0 ? cell.rect.x1 - cell.rect.x0 : cell.rect.y1 - cell.rect.y0
      const entry = shared.get(key) ?? { length: 0, walled: 0 }
      entry.length += lengthPx
      entry.walled += lengthPx * cell.edges[s].wall
      shared.set(key, entry)
    }
  }
  for (const [key, entry] of shared) {
    if (entry.length <= 0 || entry.walled / entry.length >= wallShare) continue
    const [a, b] = key.split(':').map(Number)
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[rb] = ra
  }

  const groups = new Map<number, number[]>()
  built.forEach((_, index) => {
    const root = find(index)
    groups.set(root, [...(groups.get(root) ?? []), index])
  })
  const out: PlanRegion[] = []
  for (const [, members] of groups) {
    if (members.length === 1) {
      out.push(built[members[0]])
      continue
    }
    const parts = members.map((i) => built[i])
    const rect: PixelRect = {
      x0: Math.min(...parts.map((p) => p.rect.x0)),
      y0: Math.min(...parts.map((p) => p.rect.y0)),
      x1: Math.max(...parts.map((p) => p.rect.x1)),
      y1: Math.max(...parts.map((p) => p.rect.y1)),
    }
    const cells = parts.flatMap((p) => p.cells)
    const own = new Set(cells.map((c) => `${c.ix}:${c.iy}`))
    // Everything inside the bounding box has to be either this body or a
    // pocket in it, or the box is not the body's shape.
    const rectangular = decomposition.cells.every((c) => {
      const inside = c.rect.x0 >= rect.x0 && c.rect.x1 <= rect.x1 && c.rect.y0 >= rect.y0 && c.rect.y1 <= rect.y1
      if (!inside) return true
      return own.has(`${c.ix}:${c.iy}`) || c.classification === 'RECESS'
    })
    if (!rectangular) {
      for (const part of parts) out.push(part)
      continue
    }
    const pockets = decomposition.regions.filter(
      (r) => r.classification === 'RECESS' && r.rect.x0 >= rect.x0 && r.rect.x1 <= rect.x1 && r.rect.y0 >= rect.y0 && r.rect.y1 <= rect.y1,
    ).length
    const widest = [...parts].sort((a, b) => (b.rect.x1 - b.rect.x0) * (b.rect.y1 - b.rect.y0) - (a.rect.x1 - a.rect.x0) * (a.rect.y1 - a.rect.y0))[0]
    out.push({
      id: widest.id,
      classification: 'BUILT',
      rect,
      metric: {
        x0: Math.min(...parts.map((p) => p.metric.x0)),
        z0: Math.min(...parts.map((p) => p.metric.z0)),
        x1: Math.max(...parts.map((p) => p.metric.x1)),
        z1: Math.max(...parts.map((p) => p.metric.z1)),
      },
      cells,
      confidence: round6(Math.min(...parts.map((p) => p.confidence))),
      why: `${parts.length} built regions with no wall drawn between them, making one body${pockets > 0 ? ` with ${pockets} pocket${pockets === 1 ? '' : 's'} bitten out of it` : ''}`,
    })
  }
  return out.sort((a, b) => (b.rect.x1 - b.rect.x0) * (b.rect.y1 - b.rect.y0) - (a.rect.x1 - a.rect.x0) * (a.rect.y1 - a.rect.y0) || a.id.localeCompare(b.id))
}

// ---------------------------------------------------------------------------
// Alternative readings (005A): generators the plan resolver asks for when the
// reading above stops. Nothing here runs on a plan today's pipeline accepts.
// ---------------------------------------------------------------------------

/**
 * The box the drawing's WALL INK occupies, independent of any dimension chain.
 *
 * The chain extent above trusts the widest chain that read a value; when the
 * only chain read on an axis is a detail chain across one room, the extent is
 * a strip of that room and every wall outside it is cut away. This reads the
 * other witness: open the ink mask by a third of a wall (hairlines, text and
 * hatching vanish, walls stay), keep the solid pieces at least two walls
 * square, join pieces closer than eight walls to each other, and take the
 * largest joined cluster by ink. A title block or a legend is a separate
 * cluster and loses on ink; a site plan drawn on the same sheet would win, and
 * that is why this is a candidate the resolver scores, never the answer.
 */
export function wallClusterExtent(mask: Mask, wallPx: number): { rect: PixelRect; parts: number; why: string } | null {
  const r = Math.max(1, Math.round(wallPx * 0.3))
  const opened = dilate(erode(mask, r), r)
  const pieces = connectedComponents(opened, { minPixels: Math.round(wallPx * wallPx * 2), connectivity: 8 })
  if (pieces.length === 0) return null
  const gap = wallPx * 8
  const parent = pieces.map((_, i) => i)
  const find = (i: number): number => {
    let root = i
    while (parent[root] !== root) root = parent[root]
    return root
  }
  for (let i = 0; i < pieces.length; i += 1) {
    for (let j = i + 1; j < pieces.length; j += 1) {
      const a = pieces[i].bounds
      const b = pieces[j].bounds
      if (a.x0 - gap <= b.x1 && b.x0 - gap <= a.x1 && a.y0 - gap <= b.y1 && b.y0 - gap <= a.y1) {
        const ra = find(i)
        const rb = find(j)
        if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb)
      }
    }
  }
  const clusters = new Map<number, number[]>()
  pieces.forEach((_, i) => clusters.set(find(i), [...(clusters.get(find(i)) ?? []), i]))
  const ranked = [...clusters.entries()]
    .map(([root, members]) => ({ root, members, ink: members.reduce((a, i) => a + pieces[i].pixels, 0) }))
    .sort((a, b) => b.ink - a.ink || a.root - b.root)
  const best = ranked[0].members.map((i) => pieces[i].bounds)
  const rect = { x0: Math.min(...best.map((b) => b.x0)), y0: Math.min(...best.map((b) => b.y0)), x1: Math.max(...best.map((b) => b.x1)), y1: Math.max(...best.map((b) => b.y1)) }
  if (rect.x1 - rect.x0 < wallPx * 4 || rect.y1 - rect.y0 < wallPx * 4) return null
  return { rect, parts: best.length, why: `the largest cluster of solid wall ink: ${best.length} piece${best.length === 1 ? '' : 's'} within eight walls of each other, ${Math.round(rect.x1 - rect.x0)} × ${Math.round(rect.y1 - rect.y0)} px` }
}

/**
 * BUILT cells tiled WALLED-FIRST: the largest rectangle whose own perimeter is
 * drawn as wall at least `minWallFraction` of its length, then the next among
 * the cells left, until none qualifies. Cells no walled rectangle takes are
 * returned as `demoted`: enclosed by line work, not by construction.
 *
 * The incumbent tiling (`mergeRegions`) takes the largest rectangle first and
 * asks about walls afterwards, so a covered terrace closed by a kerb line and
 * merged into the house's rectangle drags the whole house under the wall
 * threshold, and the house is dropped with the terrace. Asking first keeps the
 * house and leaves the terrace out. The threshold is the layout's own
 * `MIN_MASS_WALL_FRACTION`, passed in, not a new constant.
 *
 * And every OUTSIDE side must carry some wall. A rectangle can clear the
 * threshold on its walled sides while one side runs along a kerb line with no
 * wall band on it at all: that side is the edge of a terrace, not of a
 * building, and the rectangle has grown past the walls. A fully glazed side
 * still has its jamb walls on it; a side drawn only as line work has none. A
 * side facing other built cells is inside the building, and an open-plan
 * connection there is no evidence of anything.
 */
export function walledFirstRegions(
  decomposition: PlanDecomposition,
  registration: Pick<CoordinateRegistration, 'metresPerPixelX' | 'metresPerPixelY' | 'originPx'>,
  minWallFraction: number,
  closureThreshold = DEFAULTS.closureThreshold,
): { regions: PlanRegion[]; demoted: Array<{ ix: number; iy: number }> } {
  const { linesX, linesY } = decomposition
  const nx = linesX.length - 1
  const ny = linesY.length - 1
  const byIndex = new Map(decomposition.cells.map((c) => [`${c.ix}:${c.iy}`, c]))
  const claimed = new Set<string>()
  const open = (ix: number, iy: number): boolean => byIndex.get(`${ix}:${iy}`)?.classification === 'BUILT' && !claimed.has(`${ix}:${iy}`)
  const mppX = registration.metresPerPixelX
  const mppY = registration.metresPerPixelY
  /** The rectangle's walled share of perimeter, or -1 when one of its sides carries no wall band at all. */
  const wallFraction = (ix0: number, iy0: number, ix1: number, iy1: number): number => {
    let perimeter = 0
    let walled = 0
    const outsideLength = [0, 0, 0, 0]
    const outsideWall = [0, 0, 0, 0]
    const across: Array<[number, number]> = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ]
    const side = (ix: number, iy: number, s: 0 | 1 | 2 | 3): void => {
      const cell = byIndex.get(`${ix}:${iy}`)
      if (!cell) return
      const lengthM = s % 2 === 0 ? (cell.rect.x1 - cell.rect.x0) * mppX : (cell.rect.y1 - cell.rect.y0) * mppY
      perimeter += lengthM
      if (byIndex.get(`${ix + across[s][0]}:${iy + across[s][1]}`)?.classification !== 'BUILT') {
        outsideLength[s] += lengthM
        outsideWall[s] += lengthM * cell.edges[s].wall
      }
      if (cell.edges[s].closure >= closureThreshold) walled += lengthM * cell.edges[s].wall
    }
    for (let ix = ix0; ix <= ix1; ix += 1) {
      side(ix, iy0, 0)
      side(ix, iy1, 2)
    }
    for (let iy = iy0; iy <= iy1; iy += 1) {
      side(ix1, iy, 1)
      side(ix0, iy, 3)
    }
    if (outsideLength.some((length, s) => length > 0 && outsideWall[s] <= 0)) return -1
    return perimeter === 0 ? 0 : walled / perimeter
  }
  const regions: PlanRegion[] = []
  for (;;) {
    let best: { ix: number; iy: number; w: number; h: number; area: number; fraction: number } | null = null
    for (let iy = 0; iy < ny; iy += 1) {
      for (let ix = 0; ix < nx; ix += 1) {
        if (!open(ix, iy)) continue
        let reach = nx - ix
        let spanY = 0
        for (let h = 1; iy + h <= ny; h += 1) {
          let run = 0
          while (run < reach && open(ix + run, iy + h - 1)) run += 1
          reach = Math.min(reach, run)
          if (reach === 0) break
          spanY += linesY[iy + h].px - linesY[iy + h - 1].px
          let spanX = 0
          for (let w = 1; w <= reach; w += 1) {
            spanX += linesX[ix + w].px - linesX[ix + w - 1].px
            const area = spanX * spanY
            if (best && area <= best.area + 1e-9) continue
            const fraction = wallFraction(ix, iy, ix + w - 1, iy + h - 1)
            if (fraction < minWallFraction) continue
            best = { ix, iy, w, h, area, fraction }
          }
        }
      }
    }
    if (!best) break
    const members: Array<{ ix: number; iy: number }> = []
    for (let dy = 0; dy < best.h; dy += 1) {
      for (let dx = 0; dx < best.w; dx += 1) {
        claimed.add(`${best.ix + dx}:${best.iy + dy}`)
        members.push({ ix: best.ix + dx, iy: best.iy + dy })
      }
    }
    const rect: PixelRect = { x0: linesX[best.ix].px, y0: linesY[best.iy].px, x1: linesX[best.ix + best.w].px, y1: linesY[best.iy + best.h].px }
    const u0 = (rect.x0 - registration.originPx.x) * mppX
    const u1 = (rect.x1 - registration.originPx.x) * mppX
    const v0 = (rect.y0 - registration.originPx.y) * mppY
    const v1 = (rect.y1 - registration.originPx.y) * mppY
    regions.push({
      id: `region-built-${best.ix}-${best.iy}`,
      classification: 'BUILT',
      rect,
      metric: { x0: round6(Math.min(u0, u1)), z0: round6(Math.min(v0, v1)), x1: round6(Math.max(u0, u1)), z1: round6(Math.max(v0, v1)) },
      cells: members,
      confidence: round6(Math.min(...members.map((m) => byIndex.get(`${m.ix}:${m.iy}`)?.confidence ?? 0))),
      why: `${members.length} built cell${members.length === 1 ? '' : 's'} taken walled-first: the largest rectangle whose own perimeter is ${Math.round(best.fraction * 100)}% wall`,
    })
  }
  const demoted = decomposition.cells.filter((c) => c.classification === 'BUILT' && !claimed.has(`${c.ix}:${c.iy}`)).map((c) => ({ ix: c.ix, iy: c.iy }))
  regions.sort((a, b) => (b.rect.x1 - b.rect.x0) * (b.rect.y1 - b.rect.y0) - (a.rect.x1 - a.rect.x0) * (a.rect.y1 - a.rect.y0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return { regions, demoted }
}
