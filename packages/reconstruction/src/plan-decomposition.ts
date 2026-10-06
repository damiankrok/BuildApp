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
import type { Checkpoint, PixelRect } from '@buildapp/source-common'
import { connectedComponents, dilate, dominantBandThickness, erode } from '@buildapp/source-cv'
import type { Band, Mask } from '@buildapp/source-cv'
import type { CoordinateRegistration, DimensionChain, DimensionObservation } from '@buildapp/source-metrics'
import { exteriorSpan, framingChains, outerTotalSpans } from './plan-extent.js'
import type { ChainRoleRecord, WallWitness } from './plan-extent.js'
import { BOUNDARY_EVIDENCE_VERSION, assignCallouts, because, cornerLegs, readWallLine, solidLayer, withCallout } from './boundary-evidence.js'
import { decompositionIdOf, gapEvidenceRecords } from './gap-evidence.js'
import type { GapEvidenceRecord } from './gap-evidence.js'
import type { BoundaryGap, GapCallout, GapClass, SolidLayer, WallLine } from './boundary-evidence.js'
import { outlineSupport, solveOutline } from './boundary-outline.js'
import type { OutlineEdge, OutlineGrid, OutlineResult, OutlineSupport } from './boundary-outline.js'
import { classifyBodies } from './boundary-bodies.js'
import { completeBoundary } from './boundary-completion.js'
import type { CompletionPart, ExtentConflict, ExtentSideStatement } from './boundary-completion.js'
import type { AttachedBody } from './boundary-bodies.js'

/**
 * The plan's dimension-framed extent: which end spans of a dimension line are kept, and when the walls question a
 * framed side. 1.0.0 (005I): unread end spans the drawing states are kept (`EndSpanDecision`) and `refuteByWalls`
 * marks a frame the walls contradict weak. Named so a run record can tell 005H's extent from 005I's (post-review D7).
 */
export const PLAN_EXTENT_VERSION = '1.0.0' as const

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
  /**
   * 005C: the envelope is an OUTLINE, not a box — the grid cells the
   * opening-aware boundary encloses (`boundary-outline.ts`). `rect` is then its
   * bounding box. Absent on every plan whose long-band box the drawing does not
   * contradict.
   */
  outline?: Array<{ ix: number; iy: number }>
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
  /** 005C: what the opening-aware boundary found, whether or not it was accepted. */
  boundary?: BoundaryRecord
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
  /**
   * 005C: the SHEET's wall thickness, in pixels (`planSheet`). The boundary
   * reads piers and opens the ink by a third of it; the decomposition's own
   * thickness is re-measured on the frame's bands and moves with the extent.
   */
  sheetWallPx?: number
  /**
   * 005C: the ticks of the plan's exterior dimension chains, read or not.
   * A facade drawn only as piers and glazing makes no grid line of its own,
   * and an unread chain's ticks are the drawing's statement of where it is:
   * the boundary's shadow grid adds a line at each one that has none near it.
   */
  exteriorTicks?: { x: readonly number[]; y: readonly number[] }
  /** 005C: read the opening-aware boundary at all (on by default). */
  openingAware?: boolean
  /** Told at each boundary line read and each opening judged, for progress and cancellation. Write-only. */
  checkpoint?: Checkpoint
  /**
   * 005F: the sides of the plan's extent its exterior dimension chains state, and how strongly (`extentSidesOf`). A side
   * the box stops materially inside is an ENVELOPE_EXTENT_CONFLICT (`boundary-completion.ts`): recorded always, and
   * the only way a part beyond the box joined through a door or a drawn line may be judged an attached room.
   */
  extentSides?: readonly ExtentSideStatement[]
  /**
   * 005K, experimental: the drawn-gap rule (`DrawnGapCheck` in `boundary-evidence.ts`). OFF unless asked for; the
   * product never asks. Every reading records the rule's conditions on each WEAK gap either way.
   */
  drawnGapRule?: 'OFF' | 'ON'
}

type CoreOptions = Required<Omit<PlanDecompositionOptions, 'sheetWallPx' | 'exteriorTicks' | 'openingAware' | 'checkpoint' | 'extentSides' | 'drawnGapRule'>>

const DEFAULTS: CoreOptions = {
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

/**
 * 005I: what was decided about a short unread segment at the end of the chain that frames an axis. KEPT_SUPPORTED: the
 * drawing states it — its end marks are ticks, and a number is printed on it or a neighbouring line ends where it ends
 * — so it is a span of the building, however short. TRIMMED_STUB: nothing states it; it is a witness line struck past
 * the last segment, and the frame stops before it. Every decision is on the record; none is silent.
 */
export type EndSpanDecision = { chainId: string; end: 'LO' | 'HI'; fromPx: number; toPx: number; pixelLength: number; decision: 'KEPT_SUPPORTED' | 'TRIMMED_STUB'; why: string }

/** The widest read chain's stretch on one axis, trimmed of unread stubs at its ends (see `dimensionedExtent`). */
export function dimensionedAxis(chains: readonly DimensionChain[], axis: 'HORIZONTAL' | 'VERTICAL'): { lo: number; hi: number; chainId: string; endSpans: EndSpanDecision[] } | null {
  const pick = (axis: 'HORIZONTAL' | 'VERTICAL'): { lo: number; hi: number; chainId: string; endSpans: EndSpanDecision[] } | null => {
    let best: { lo: number; hi: number; chainId: string; endSpans: EndSpanDecision[] } | null = null
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
      //
      // 005I: unless the drawing states it (`endSpanSupport`). Blind round 7 trimmed a `100` end segment, read the
      // same by both readers and bound to its span, because the scale kept was 3 % short and the reading missed by
      // 2.5 px: the frame then stopped 0.9 m inside the house.
      const floor = Math.min(...read.map((seg) => seg.pixelLength)) * 0.5
      const segments = [...chain.segments].sort((a, b) => a.fromPx - b.fromPx)
      const unread = (seg: DimensionChain['segments'][number]): boolean => seg.origin !== 'READ' && seg.origin !== 'CHAIN_CORRECTED'
      const endSpans: EndSpanDecision[] = []
      const decide = (k: number, end: 'LO' | 'HI', outer: boolean): boolean => {
        const seg = segments[k]
        const support = endSpanSupport(chain, seg, end, outer)
        endSpans.push({ chainId: chain.id, end, fromPx: seg.fromPx, toPx: seg.toPx, pixelLength: seg.pixelLength, decision: support ? 'KEPT_SUPPORTED' : 'TRIMMED_STUB', why: support ?? `unread, ${round6(seg.pixelLength)} px against half the shortest read segment (${round6(floor)} px), and nothing in the drawing states it` })
        return support !== null
      }
      let first = 0
      let last = segments.length - 1
      while (first <= last && unread(segments[first]) && segments[first].pixelLength < floor && !decide(first, 'LO', first === 0)) first += 1
      while (last >= first && unread(segments[last]) && segments[last].pixelLength < floor && !decide(last, 'HI', last === segments.length - 1)) last -= 1
      if (first > last) continue
      const lo = segments[first].fromPx
      const hi = segments[last].toPx
      if (!best || hi - lo > best.hi - best.lo) best = { lo, hi, chainId: chain.id, endSpans }
    }
    return best
  }
  return pick(axis)
}

/**
 * 005I: whether the drawing states a short unread end segment, and why — or null. Both of its marks must be ticks (a
 * questionable or label-ink mark ends nothing on its own), and either a number is printed on it and bound to it, or
 * it ends where the chain ends — at the chain's first (resp. last) tick — and a neighbouring parallel line ENDS there
 * too (`DimensionChain.topology.alignedEnds`, computed at the lines' first and last ticks). A record made before 005D
 * (no mark classes) counts every mark a tick, as it always did.
 */
function endSpanSupport(chain: DimensionChain, seg: DimensionChain['segments'][number], end: 'LO' | 'HI', outer: boolean): string | null {
  const classOf = (i: number): string => (chain.marks?.length === chain.ticksPx.length ? chain.marks[i].class : 'TICK')
  const classAt = (px: number): string => {
    const i = chain.ticksPx.findIndex((t) => Math.abs(t - px) < 0.5)
    return i < 0 ? 'TICK' : classOf(i)
  }
  if (classAt(seg.fromPx) !== 'TICK' || classAt(seg.toPx) !== 'TICK') return null
  if (seg.labelled) return `a number is printed on it and bound to it, between two ticks`
  const ticks = chain.ticksPx.filter((_, i) => classOf(i) === 'TICK')
  const chainEnd = end === 'LO' ? ticks[0] : ticks[ticks.length - 1]
  const segEnd = end === 'LO' ? seg.fromPx : seg.toPx
  const aligned = outer && chainEnd !== undefined && Math.abs(chainEnd - segEnd) < 0.5 && chain.topology?.alignedEnds[end === 'LO' ? 0 : 1] === true
  if (aligned) return `it ends at the chain's end tick, where a neighbouring parallel line ends too (${chain.topology?.groupId ?? ''})`
  return null
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
  /** 005I: the short end segments of the framing chains, kept because the drawing states them or trimmed as stubs. */
  endSpans?: EndSpanDecision[]
  /** 005I: sides of the frame the walls contradict (`refuteByWalls`), and what was done about each. */
  refutations?: ExtentRefutation[]
}

export type ExtentProvenance = 'DIMENSION_CHAIN_EXTENT' | 'EXTERIOR_CHAIN_TICKS' | 'WALL_GEOMETRY_EXTENT' | 'OUTER_TOTAL_MARKS'

/**
 * 005I: a side of a dimension-stated frame that the wall witness contradicts — at least two of its walls run on past
 * the side by more than two wall thicknesses. The walls state no dimension, so they never move the side themselves:
 * the side is moved only to where a dimension line drawn beside the building ENDS — its first or last tick — within a
 * wall of where the contradicting walls end, and only if no two walls still run on past it (ALTERNATE_DIMENSION_MARK);
 * otherwise the frame is kept (DOWNGRADED). Either way the frame is marked weak: a side the walls had to question is
 * one the resolver weighs, not a dimension statement it takes on trust. A side framed by the drawing's own overall
 * dimension (OUTER_TOTAL_MARKS) or by the walls is never asked.
 */
export type ExtentRefutation = {
  side: 'W' | 'E' | 'N' | 'S'
  atPx: number
  wallsPast: number
  overshootPx: number
  action: 'ALTERNATE_DIMENSION_MARK' | 'DOWNGRADED'
  movedToPx?: number
  chainId?: string
  why: string
}

/** Walls run past a side by this many wall thicknesses, and at least this many of them, to contradict it. */
export const EXTENT_REFUTATION_BOUNDS = { pastWalls: 2, walls: 2 } as const

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
export function planExtent(chainsIn: readonly DimensionChain[], bands: readonly Band[], wallPx: number, witness?: WallWitness | null, observations?: readonly DimensionObservation[]): PlanExtent | null {
  const extent = planExtentByWalls(chainsIn, bands, wallPx, witness)
  const stated = observations ? outspannedByOuterTotal(extent, chainsIn, observations, wallPx) : extent
  if (!stated) return stated
  // 005I: the end spans the framing chains kept or trimmed, on the record whichever frame stood.
  const endSpans = (['HORIZONTAL', 'VERTICAL'] as const).flatMap((a) => dimensionedAxis(chainsIn, a)?.endSpans ?? [])
  const recorded = endSpans.length > 0 ? { ...stated, endSpans } : stated
  return witness ? refuteByWalls(recorded, chainsIn, witness, wallPx) : recorded
}

/**
 * 005I (§16): wall evidence may refute a frame's side, never state one (`ExtentRefutation`). Only a side the
 * dimensions framed is asked: a side the walls already framed has nothing to refute.
 */
export function refuteByWalls(extent: PlanExtent, chains: readonly DimensionChain[], witness: WallWitness, wallPx: number): PlanExtent {
  const B = EXTENT_REFUTATION_BOUNDS
  const past = B.pastWalls * wallPx
  let rect = { ...extent.rect }
  const refutations: ExtentRefutation[] = []
  const sides: Array<{ side: ExtentRefutation['side']; axis: 'HORIZONTAL' | 'VERTICAL'; low: boolean }> = [
    { side: 'W', axis: 'HORIZONTAL', low: true },
    { side: 'E', axis: 'HORIZONTAL', low: false },
    { side: 'N', axis: 'VERTICAL', low: true },
    { side: 'S', axis: 'VERTICAL', low: false },
  ]
  for (const d of sides) {
    const provenance = d.axis === 'HORIZONTAL' ? extent.provenance?.x : extent.provenance?.y
    if (provenance === 'WALL_GEOMETRY_EXTENT' || provenance === 'OUTER_TOTAL_MARKS') continue
    const at = d.axis === 'HORIZONTAL' ? (d.low ? rect.x0 : rect.x1) : d.low ? rect.y0 : rect.y1
    // Walls across the side: bands along the other axis whose run crosses the side's line and goes on past it.
    const across = witness.bands.filter((b) => (d.axis === 'HORIZONTAL' ? b.axis === 'HORIZONTAL' : b.axis === 'VERTICAL'))
    const beyondOf = (side: number): number[] =>
      across
        .map((b) => {
          const [lo, hi] = d.axis === 'HORIZONTAL' ? [b.bounds.x0, b.bounds.x1] : [b.bounds.y0, b.bounds.y1]
          return d.low ? (hi > side + wallPx && lo < side - past ? side - lo : 0) : lo < side - wallPx && hi > side + past ? hi - side : 0
        })
        .filter((v) => v > 0)
    const beyond = beyondOf(at)
    if (beyond.length < B.walls) continue
    const overshoot = round6(Math.max(...beyond))
    const wallsEnd = d.low ? at - overshoot : at + overshoot
    // Where a dimension line on this axis, not drawn across the building, ENDS (its first or last tick), within a wall
    // of where the contradicting walls end — never a tick inside a line (a window, a pier, a terrace post).
    const roles = new Map((extent.roles ?? []).map((r) => [r.chainId, r.role]))
    const marks = chains
      .filter((c) => c.axis === d.axis && roles.get(c.id) !== 'INTERIOR')
      .flatMap((c) => {
        const ticks = c.ticksPx.map((px, i) => ({ px, chainId: c.id, cls: c.marks?.length === c.ticksPx.length ? c.marks[i].class : 'TICK' })).filter((m) => m.cls === 'TICK')
        return ticks.length >= 2 ? [ticks[0], ticks[ticks.length - 1]] : []
      })
      .filter((m) => Math.abs(m.px - wallsEnd) <= wallPx && (d.low ? m.px < at - wallPx / 2 : m.px > at + wallPx / 2))
      .sort((a, b) => Math.abs(a.px - wallsEnd) - Math.abs(b.px - wallsEnd) || (a.chainId < b.chainId ? -1 : a.chainId > b.chainId ? 1 : 0))
    const alternate = marks.find((m) => beyondOf(m.px).length < B.walls)
    const why = `${beyond.length} wall${beyond.length === 1 ? '' : 's'} run on past the ${d.side} side by up to ${Math.round(overshoot)} px (more than ${B.pastWalls} walls)`
    if (alternate) {
      const moved = round6(alternate.px)
      if (d.axis === 'HORIZONTAL') rect = d.low ? { ...rect, x0: moved } : { ...rect, x1: moved }
      else rect = d.low ? { ...rect, y0: moved } : { ...rect, y1: moved }
      refutations.push({ side: d.side, atPx: round6(at), wallsPast: beyond.length, overshootPx: overshoot, action: 'ALTERNATE_DIMENSION_MARK', movedToPx: moved, chainId: alternate.chainId, why: `${why}; ${alternate.chainId} ends within a wall of where they end, and no two walls run on past it: the side is taken there, weak` })
    } else refutations.push({ side: d.side, atPx: round6(at), wallsPast: beyond.length, overshootPx: overshoot, action: 'DOWNGRADED', why: `${why}; no dimension line out there ends where they end, so the frame stands, weak` })
  }
  if (refutations.length === 0) return extent
  return { ...extent, rect, weak: true, why: `${extent.why}; the walls contradict ${refutations.map((r) => r.side).join(', ')}: ${refutations.map((r) => r.why).join('; ')}`, refutations }
}

/**
 * 005D (§2.5 of the contract): an axis framed by a chain drawn across the building, while the
 * drawing states the building's overall dimension on that axis in a line beside it, is framed by
 * that overall line's end ticks instead — read or not. The overall line is the dimension graph's
 * statement of where the faces are (`outerTotalSpans`): its ends are ticks, it crosses no wall, a
 * label is centred on the whole of it, and it lies outside the frame on the other axis. The framing
 * chain must cross wall-thick ink (a wall face among its marks): a read line beside the building is
 * never outspanned this way. As for every refusal, the frame only ever widens.
 */
function outspannedByOuterTotal(extent: PlanExtent | null, chains: readonly DimensionChain[], observations: readonly DimensionObservation[], wallPx: number): PlanExtent | null {
  if (!extent) return extent
  const totals = outerTotalSpans(chains, observations)
  if (totals.length === 0) return extent
  let rect = extent.rect
  const provenance = { ...(extent.provenance ?? { x: 'DIMENSION_CHAIN_EXTENT' as ExtentProvenance, y: 'DIMENSION_CHAIN_EXTENT' as ExtentProvenance }) }
  const refused: string[] = [...(extent.refused ?? [])]
  const reasons: string[] = []
  for (const a of ['HORIZONTAL', 'VERTICAL'] as const) {
    const framed = dimensionedAxis(chains, a)
    if (!framed) continue
    const chain = chains.find((c) => c.id === framed.chainId)
    if (!chain?.marks?.some((m) => m.class !== 'REJECTED' && m.reasons.includes('WEDGE_NOT_STROKE'))) continue
    const [lo, hi] = a === 'HORIZONTAL' ? [rect.x0, rect.x1] : [rect.y0, rect.y1]
    const [olo, ohi] = a === 'HORIZONTAL' ? [rect.y0, rect.y1] : [rect.x0, rect.x1]
    const outer = totals
      .filter((t) => t.axis === a && (t.baselinePx < olo || t.baselinePx > ohi))
      .filter((t) => t.lo <= framed.lo + wallPx && t.hi >= framed.hi - wallPx && t.hi - t.lo > framed.hi - framed.lo + 2 * wallPx)
      .filter((t) => t.hi - t.lo > hi - lo + 2 * wallPx)
      .sort((p, q) => q.hi - q.lo - (p.hi - p.lo) || (p.chainId < q.chainId ? -1 : 1))[0]
    if (!outer) continue
    rect = a === 'HORIZONTAL' ? { ...rect, x0: round6(Math.min(rect.x0, outer.lo)), x1: round6(Math.max(rect.x1, outer.hi)) } : { ...rect, y0: round6(Math.min(rect.y0, outer.lo)), y1: round6(Math.max(rect.y1, outer.hi)) }
    provenance[a === 'HORIZONTAL' ? 'x' : 'y'] = 'OUTER_TOTAL_MARKS'
    refused.push(framed.chainId)
    reasons.push(`its ${a === 'HORIZONTAL' ? 'width' : 'depth'} was framed by a chain drawn across the building (${Math.round(framed.hi - framed.lo)} px); the overall dimension printed beside it spans ${Math.round(outer.hi - outer.lo)} px between its end ticks, with its label "${outer.labelRaw}" centred on the whole of it`)
  }
  if (reasons.length === 0) return extent
  return { ...extent, rect, weak: true, why: `${extent.why}; ${reasons.join('; ')}`, refused: [...new Set(refused)].sort(), provenance }
}

function planExtentByWalls(chainsIn: readonly DimensionChain[], bands: readonly Band[], wallPx: number, witness?: WallWitness | null): PlanExtent | null {
  const legacy = planExtentOf(chainsIn, bands, wallPx)
  if (witness === undefined) return legacy
  const framing = framingChains(chainsIn, witness, wallPx)
  const refusedAll = new Set(framing.roles.filter((r) => r.refused).map((r) => r.chainId))
  const chains = framing.allowed
  const legacyProvenance: PlanExtent['provenance'] = legacy?.weak ? { x: 'WALL_GEOMETRY_EXTENT', y: 'WALL_GEOMETRY_EXTENT' } : { x: 'DIMENSION_CHAIN_EXTENT', y: 'DIMENSION_CHAIN_EXTENT' }
  const annotate = (e: PlanExtent | null, refused: string[], provenance: PlanExtent['provenance']): PlanExtent | null => (e ? { ...e, roles: framing.roles, refused, provenance } : e)
  const framedX = dimensionedAxis(chainsIn, 'HORIZONTAL')?.chainId
  const framedY = dimensionedAxis(chainsIn, 'VERTICAL')?.chainId
  // 005C: a read chain that frames an axis over less than half of the walls' span there, while an exterior chain
  // drawn beside the building covers all of them, states a detail and not the building: it is outspanned, and the
  // axis is taken from what the drawing states widest, as for a refused chain. Being read is not being the extent.
  const outspanned = (a: 'HORIZONTAL' | 'VERTICAL', framed: string | undefined): boolean => {
    if (!witness || framed === undefined || refusedAll.has(framed)) return false
    const own = dimensionedAxis(chainsIn.filter((c) => c.id === framed), a)
    const [w0, w1] = a === 'HORIZONTAL' ? [witness.rect.x0, witness.rect.x1] : [witness.rect.y0, witness.rect.y1]
    if (!own || own.hi - own.lo >= (w1 - w0) / 2) return false
    const ticks = exteriorSpan(chainsIn, framing.roles, a, witness)
    return ticks !== null && framing.roles.find((r) => r.chainId === ticks.chainId)?.coversWitness === true && ticks.hi - ticks.lo > own.hi - own.lo + 2 * wallPx
  }
  const shortX = outspanned('HORIZONTAL', framedX)
  const shortY = outspanned('VERTICAL', framedY)
  const refusedX = (framedX !== undefined && refusedAll.has(framedX)) || shortX
  const refusedY = (framedY !== undefined && refusedAll.has(framedY)) || shortY
  if (!witness || !legacy || (!refusedX && !refusedY)) return annotate(legacy, [], legacyProvenance)
  // The refused chains that would have framed an axis: wider than the widest chain allowed there.
  const displaced = [...(shortX && framedX !== undefined ? [framedX] : []), ...(shortY && framedY !== undefined ? [framedY] : [])]
  displaced.push(...(['HORIZONTAL', 'VERTICAL'] as const)
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
    }))
  displaced.sort()
  type Span = { lo: number; hi: number; provenance: ExtentProvenance }
  const widest = (a: 'HORIZONTAL' | 'VERTICAL'): Span => {
    // What the drawing states: another read chain, an exterior chain's ticks — the widest of them.
    const statements: Span[] = []
    const read = dimensionedAxis(chains.filter((c) => !displaced.includes(c.id)), a)
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
    why: `${displaced.length} ${shortX || shortY ? 'interior or outspanned' : 'interior'} chain${displaced.length === 1 ? ' was' : 's were'} refused as the building's extent; its width is taken from ${said(x.provenance)} and its depth from ${said(y.provenance)}`,
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
    // The front's OUTER face, a whole wall past the side walls' common end (their end is its inner face): the box's
    // other sides are outer faces too, and an axis here builds the building half a wall short (005C).
    const far = farEnd - e1 >= wallPx * 2 && Math.abs(endA - endB) <= wallPx * 2 && endsOnPartition(e1 - half) && pierOn(farEnd + half) ? round6(farEnd + wallPx) : e1
    const near = e0 - nearEnd >= wallPx * 2 && Math.abs(startA - startB) <= wallPx * 2 && endsOnPartition(e0 + half) && pierOn(nearEnd - half) ? round6(nearEnd - wallPx) : e0
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
      // Two walls standing at the side's own ends are the building's own sides running on, and a "bay" between them
      // is the whole front (005C). Only those: a bay inset from them is a bay however much of the side it spans
      // (005C post-review; it used to be any pair spanning more than 0.8 of the side).
      if (Math.abs(a.b.axisPx - acrossLo) <= ctx.wallPx * 1.5 && Math.abs(c.b.axisPx - acrossHi) <= ctx.wallPx * 1.5) continue
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
  const incumbent = decomposeCore(mask, chains, bands, registration, extent, options)
  // A plan with no scale of its own (a unit placeholder) can state no opening width: its boundary is not read.
  if (options.openingAware === false || registration.confidence <= 0 || incumbent.linesX.length < 2 || incumbent.linesY.length < 2) return incumbent
  const extension = boundaryExtension(mask, bands, registration, extent, incumbent, options, chains)
  if (!extension.override) return { ...incumbent, boundary: extension.record }
  const outlined = decomposeCore(mask, chains, bands, registration, extent, options, extension.override)
  return { ...outlined, boundary: extension.record }
}

/** The grid, the outline and its border edges a decomposition is re-cut on when the boundary is accepted. */
export type OutlineOverride = {
  linesX: GridLine[]
  linesY: GridLine[]
  outline: OutlineResult
  why: string
  /**
   * 005F: completions the boundary accepted (`boundary-completion.ts`), each a set of cells of this grid, and — when
   * nothing beyond the box was adopted — the box reading's own built regions, which stand as they were: a completion
   * extends the body it ends only along that body's whole side, and is otherwise a body of its own. The incumbent
   * bodies are never re-tiled (pre-review C P0-2: a re-tiling merged a garage into the house and lost a storey).
   */
  completions?: Array<Array<{ ix: number; iy: number }>>
  /** The kind of each completion, in the same order: only a box completion extends the body it ends (C5F-7). */
  completionKinds?: CompletionPart['kind'][]
  seeds?: PixelRect[]
}

function decomposeCore(
  mask: Mask,
  chains: readonly DimensionChain[],
  bands: readonly Band[],
  registration: CoordinateRegistration,
  extent: PixelRect,
  options: PlanDecompositionOptions,
  override?: OutlineOverride,
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
  const unresolved: PlanDecomposition['unresolved'] = []

  const minCellPx = opt.minCellM / Math.max(mppX, mppY)
  const all = override ? undefined : gridLines(chains, inside, extent, options)
  const linesX = override ? override.linesX : thinLines(all?.linesX ?? [], minCellPx, wallPx)
  const linesY = override ? override.linesY : thinLines(all?.linesY ?? [], minCellPx, wallPx)
  const envelope = override ? outlineEnvelope(override, inside, wallPx, registration) : walledEnvelope(inside, linesX, linesY, wallPx, registration)
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
    if (override) {
      // The outline's border (005C): an edge the boundary closes with wall-thick ink and bridged openings is shut,
      // whatever thin ink it carries — its solid ink is wall, its bridges are openings, never wall.
      const cellIn = (ix: number, iy: number): boolean => ix >= 0 && iy >= 0 && ix < nx && iy < ny && override.outline.inside[iy * nx + ix] === 1
      const shut = (e: EdgeClosure, o: OutlineEdge): EdgeClosure => ({ wall: round6(Math.max(e.wall, o.solid)), line: e.line, opening: round6(Math.max(e.opening, Math.min(1 - Math.max(e.wall, o.solid), o.bridged))), closure: 1 })
      // 005F: with completions, the border of what is built — the box reading's own cells and the completed parts — is
      // decided, and every edge on it is shut: the box reading's cells were never the outline's, so its edge there may
      // not be closed, and a re-cut must not lose a room the box reading built (pre-review C P0-2).
      const decided = override.completions !== undefined && override.completions.length > 0
      for (let ix = 0; ix <= nx; ix += 1) for (let iy = 0; iy < ny; iy += 1) if (cellIn(ix - 1, iy) !== cellIn(ix, iy) && (decided || override.outline.vEdge[ix][iy].closed)) vEdge[ix][iy] = shut(vEdge[ix][iy], override.outline.vEdge[ix][iy])
      for (let iy = 0; iy <= ny; iy += 1) for (let ix = 0; ix < nx; ix += 1) if (cellIn(ix, iy - 1) !== cellIn(ix, iy) && (decided || override.outline.hEdge[iy][ix].closed)) hEdge[iy][ix] = shut(hEdge[iy][ix], override.outline.hEdge[iy][ix])
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
    if (override) {
      // 005C: outside the outline is outside by construction — the outline in place of the box.
      for (let iy = 0; iy < ny; iy += 1) for (let ix = 0; ix < nx; ix += 1) if (override.outline.inside[iy * nx + ix] !== 1) push(ix, iy)
    } else if (envelope) {
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

  const merged = mergeRegions(cells, linesX, linesY, registration, nx, ny)
  // 005F: with completions, the bodies the reading had stand as they were and the completions are laid against them.
  const regions = override?.completions && override.completions.length > 0 ? stableRegions(merged, cells, linesX, linesY, registration, nx, ny, override) : merged
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
 * 005F: the BUILT regions of a plan re-cut with completions (`OutlineOverride.completions`), without re-tiling what
 * the reading already had (pre-review C P0-2).
 *
 *   base         the box reading's own built regions (`seeds`, when nothing beyond the box was adopted — each one a
 *                union of this finer grid's cells), or else the 005C reading's own largest-first tiling of its cells;
 *   completion   a completion that is a rectangle sharing one whole side with exactly one base region extends it (a
 *                garage's end, the width of the garage); any other is tiled on its own, a body against the house;
 *   leftovers    built cells neither covers are tiled largest-first, as before.
 *
 * The other classes' regions are `mergeRegions`' own. The result is sorted as `mergeRegions` sorts.
 */
function stableRegions(merged: readonly PlanRegion[], cells: readonly PlanCell[], linesX: readonly GridLine[], linesY: readonly GridLine[], registration: CoordinateRegistration, nx: number, ny: number, override: OutlineOverride): PlanRegion[] {
  const key = (c: { ix: number; iy: number }): string => `${c.ix}:${c.iy}`
  const byKey = new Map(cells.map((c) => [key(c), c]))
  const isBuilt = (c: { ix: number; iy: number }): boolean => byKey.get(key(c))?.classification === 'BUILT'
  const toMetric = (rect: PixelRect): PlanRegion['metric'] => {
    const u0 = (rect.x0 - registration.originPx.x) * registration.metresPerPixelX
    const u1 = (rect.x1 - registration.originPx.x) * registration.metresPerPixelX
    const v0 = (rect.y0 - registration.originPx.y) * registration.metresPerPixelY
    const v1 = (rect.y1 - registration.originPx.y) * registration.metresPerPixelY
    return { x0: round6(Math.min(u0, u1)), z0: round6(Math.min(v0, v1)), x1: round6(Math.max(u0, u1)), z1: round6(Math.max(v0, v1)) }
  }
  const centreIn = (c: { ix: number; iy: number }, r: PixelRect): boolean => {
    const cx = (linesX[c.ix].px + linesX[c.ix + 1].px) / 2
    const cy = (linesY[c.iy].px + linesY[c.iy + 1].px) / 2
    return cx >= r.x0 && cx <= r.x1 && cy >= r.y0 && cy <= r.y1
  }
  const rectOfCells = (members: ReadonlyArray<{ ix: number; iy: number }>): PixelRect => ({
    x0: Math.min(...members.map((m) => linesX[m.ix].px)),
    y0: Math.min(...members.map((m) => linesY[m.iy].px)),
    x1: Math.max(...members.map((m) => linesX[m.ix + 1].px)),
    y1: Math.max(...members.map((m) => linesY[m.iy + 1].px)),
  })
  const isRectangle = (members: ReadonlyArray<{ ix: number; iy: number }>): boolean => {
    const ixs = members.map((m) => m.ix)
    const iys = members.map((m) => m.iy)
    const w = Math.max(...ixs) - Math.min(...ixs) + 1
    const h = Math.max(...iys) - Math.min(...iys) + 1
    return new Set(members.map(key)).size === w * h
  }
  const regionOf = (members: Array<{ ix: number; iy: number }>, why: string, rect: PixelRect = rectOfCells(members)): PlanRegion => {
    const sorted = [...members].sort((a, b) => a.iy - b.iy || a.ix - b.ix)
    return {
      id: `region-built-${sorted[0].ix}-${sorted[0].iy}`,
      classification: 'BUILT',
      rect: { x0: round6(rect.x0), y0: round6(rect.y0), x1: round6(rect.x1), y1: round6(rect.y1) },
      metric: toMetric(rect),
      cells: sorted,
      confidence: round6(Math.min(...sorted.map((m) => byKey.get(key(m))?.confidence ?? 0))),
      why,
    }
  }
  const tile = (members: ReadonlyArray<{ ix: number; iy: number }>, why: string): PlanRegion[] => {
    const keep = new Set(members.map(key))
    const only = cells.map((c) => (keep.has(key(c)) ? c : { ...c, classification: 'OUTSIDE' as CellClass }))
    return mergeRegions(only, linesX, linesY, registration, nx, ny)
      .filter((r) => r.classification === 'BUILT')
      .map((r) => ({ ...r, why: `${r.why}; ${why}` }))
  }
  const completionCells = new Set((override.completions ?? []).flat().map(key))
  const claimed = new Set<string>()
  const base: PlanRegion[] = []
  if (override.seeds) {
    for (const rect of override.seeds) {
      const members = cells.filter((c) => centreIn(c, rect) && !claimed.has(key(c)))
      if (members.length === 0) continue
      for (const m of members) claimed.add(key(m))
      const built = members.filter(isBuilt)
      if (built.length === members.length) base.push(regionOf(built.map((c) => ({ ix: c.ix, iy: c.iy })), 'a body of the box reading, as it was', rect))
      else if (built.length > 0) base.push(...tile(built, 'what the re-cut still builds of a body of the box reading'))
    }
  } else {
    const reading = cells.filter((c) => c.classification === 'BUILT' && !completionCells.has(key(c)))
    for (const c of reading) claimed.add(key(c))
    base.push(...tile(reading, 'the reading as it was'))
  }
  const extra: PlanRegion[] = []
  for (const [gi, group] of (override.completions ?? []).entries()) {
    const members = group.filter((m) => isBuilt(m) && !claimed.has(key(m)))
    if (members.length === 0) continue
    for (const m of members) claimed.add(key(m))
    const g = rectOfCells(members)
    // a box completion that is a rectangle sharing one whole side of exactly one body extends it; an attached room is a
    // body of its own (contract B6)
    const extendable = (override.completionKinds?.[gi] ?? 'BOX_COMPLETION') === 'BOX_COMPLETION'
    const along = extendable && isRectangle(members)
      ? base.filter((r) => {
          const R = r.rect
          const eq = (a: number, b: number): boolean => Math.abs(a - b) < 0.5
          return (eq(g.x0, R.x0) && eq(g.x1, R.x1) && (eq(g.y0, R.y1) || eq(g.y1, R.y0))) || (eq(g.y0, R.y0) && eq(g.y1, R.y1) && (eq(g.x0, R.x1) || eq(g.x1, R.x0)))
        })
      : []
    if (along.length === 1) {
      const r = along[0]
      const rect = { x0: Math.min(r.rect.x0, g.x0), y0: Math.min(r.rect.y0, g.y0), x1: Math.max(r.rect.x1, g.x1), y1: Math.max(r.rect.y1, g.y1) }
      Object.assign(r, { rect: { x0: round6(rect.x0), y0: round6(rect.y0), x1: round6(rect.x1), y1: round6(rect.y1) }, metric: toMetric(rect), cells: [...r.cells, ...members].sort((a, b) => a.iy - b.iy || a.ix - b.ix), why: `${r.why}; completed along its whole side` })
    } else extra.push(...tile(members, 'a completion against the house'))
  }
  const leftovers = cells.filter((c) => c.classification === 'BUILT' && !claimed.has(key(c)))
  const rest = leftovers.length > 0 ? tile(leftovers, 'left over') : []
  const area = (r: PlanRegion): number => (r.rect.x1 - r.rect.x0) * (r.rect.y1 - r.rect.y0)
  return [...base, ...extra, ...rest, ...merged.filter((r) => r.classification !== 'BUILT')].sort((a, b) => area(b) - area(a) || a.id.localeCompare(b.id))
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
/**
 * Re-cut the rectangles of an outline frame so that no body is a strip (005C).
 *
 * The regions are cut largest-first, and on an outline whose faces step by a
 * wall's thickness the largest rectangle runs across the step and leaves a
 * strip beside it: 0.4 m of wall-thick face, 0.9 m of a room's end. A strip
 * narrower than a body can be is not a body, and dropping it drops a room's
 * floor with it. So a strip that runs a neighbour's whole side is joined to
 * it (the cells, and so the area, exactly as they were); a band no deeper than
 * `maxStepM` along most of a side is joined as the rectangle around both, the
 * notch no larger than the band; the result must be at least `minSpanM`
 * across and one the caller accepts (the layout's wall gate). The neighbour is
 * never cut: a strip along part of a side — a porch, a bay — stays its own.
 */
export function recutSlivers(regions: readonly PlanRegion[], decomposition: PlanDecomposition, registration: CoordinateRegistration, minSpanM: number, accept: (region: PlanRegion) => boolean = () => true, maxStepM = 0): PlanRegion[] {
  const cellAt = new Map(decomposition.cells.map((c) => [`${c.ix}:${c.iy}`, c]))
  type Box = { ix0: number; iy0: number; ix1: number; iy1: number }
  const boxOf = (r: PlanRegion): Box | undefined => {
    if (r.cells.length === 0) return undefined
    const b = { ix0: Math.min(...r.cells.map((c) => c.ix)), iy0: Math.min(...r.cells.map((c) => c.iy)), ix1: Math.max(...r.cells.map((c) => c.ix)), iy1: Math.max(...r.cells.map((c) => c.iy)) }
    // only a region that IS its box of cells can be re-cut as one
    return r.cells.length === (b.ix1 - b.ix0 + 1) * (b.iy1 - b.iy0 + 1) ? b : undefined
  }
  const rectOf = (b: Box): PixelRect | undefined => {
    const a = cellAt.get(`${b.ix0}:${b.iy0}`)
    const z = cellAt.get(`${b.ix1}:${b.iy1}`)
    return a && z ? { x0: a.rect.x0, y0: a.rect.y0, x1: z.rect.x1, y1: z.rect.y1 } : undefined
  }
  const spanOk = (r: PixelRect | undefined): boolean => r !== undefined && (r.x1 - r.x0) * registration.metresPerPixelX >= minSpanM && (r.y1 - r.y0) * registration.metresPerPixelY >= minSpanM
  const regionOf = (b: Box, from: readonly PlanRegion[]): PlanRegion | undefined => {
    const rect = rectOf(b)
    if (!rect) return undefined
    const cells: Array<{ ix: number; iy: number }> = []
    for (let iy = b.iy0; iy <= b.iy1; iy += 1) for (let ix = b.ix0; ix <= b.ix1; ix += 1) cells.push({ ix, iy })
    const u0 = (rect.x0 - registration.originPx.x) * registration.metresPerPixelX
    const u1 = (rect.x1 - registration.originPx.x) * registration.metresPerPixelX
    const v0 = (rect.y0 - registration.originPx.y) * registration.metresPerPixelY
    const v1 = (rect.y1 - registration.originPx.y) * registration.metresPerPixelY
    return {
      id: `region-built-${b.ix0}-${b.iy0}`,
      classification: 'BUILT',
      rect,
      metric: { x0: round6(Math.min(u0, u1)), z0: round6(Math.min(v0, v1)), x1: round6(Math.max(u0, u1)), z1: round6(Math.max(v0, v1)) },
      cells,
      confidence: round6(Math.min(...from.map((r) => r.confidence))),
      why: `re-cut from ${from.map((r) => r.id).join(' and ')} so that no body is a strip narrower than ${minSpanM.toFixed(2)} m`,
    }
  }
  let out = [...regions]
  for (let guard = 0; guard < regions.length * 2; guard += 1) {
    let changed = false
    for (const strip of out) {
      if (strip.classification !== 'BUILT' || spanOk(strip.rect)) continue
      const s = boxOf(strip)
      if (!s) continue
      for (const next of out) {
        if (next === strip || next.classification !== 'BUILT') continue
        const n = boxOf(next)
        if (!n) continue
        // the strip lies along the neighbour: they share a whole side of the strip
        const above = s.iy1 + 1 === n.iy0 || n.iy1 + 1 === s.iy0
        const beside = s.ix1 + 1 === n.ix0 || n.ix1 + 1 === s.ix0
        // A strip that runs the neighbour's whole side is joined to it: the two are then one rectangle, and no cut
        // moves. A strip along PART of a side is never joined by cutting the neighbour at its ends — that invents a
        // party wall through the house and carries a porch up the house's storeys (005C post-review). A band no deeper
        // than `maxStepM` (the outer part of a wall, a face step) that covers most of the side is joined as the one
        // rectangle around both, the notch it leaves no larger than the band itself; a deeper strip, or a short one,
        // is left to the layout's own rules.
        const stripM = Math.min((strip.rect.x1 - strip.rect.x0) * registration.metresPerPixelX, (strip.rect.y1 - strip.rect.y0) * registration.metresPerPixelY)
        const band = stripM <= maxStepM
        let pieces: Box[] | undefined
        let absorbed: PlanRegion[] = []
        if (above && s.ix0 === n.ix0 && s.ix1 === n.ix1) pieces = [{ ix0: s.ix0, ix1: s.ix1, iy0: Math.min(s.iy0, n.iy0), iy1: Math.max(s.iy1, n.iy1) }]
        else if (beside && s.iy0 === n.iy0 && s.iy1 === n.iy1) pieces = [{ iy0: s.iy0, iy1: s.iy1, ix0: Math.min(s.ix0, n.ix0), ix1: Math.max(s.ix1, n.ix1) }]
        else if (band && ((above && s.ix0 >= n.ix0 && s.ix1 <= n.ix1) || (beside && s.iy0 >= n.iy0 && s.iy1 <= n.iy1))) {
          const union: Box = { ix0: Math.min(s.ix0, n.ix0), iy0: Math.min(s.iy0, n.iy0), ix1: Math.max(s.ix1, n.ix1), iy1: Math.max(s.iy1, n.iy1) }
          const inBox = (b: Box, ix: number, iy: number): boolean => ix >= b.ix0 && ix <= b.ix1 && iy >= b.iy0 && iy <= b.iy1
          const areaM2 = (cs: Array<{ ix: number; iy: number }>): number => cs.reduce((a, c) => {
            const cell = cellAt.get(`${c.ix}:${c.iy}`)
            return a + (cell ? (cell.rect.x1 - cell.rect.x0) * registration.metresPerPixelX * (cell.rect.y1 - cell.rect.y0) * registration.metresPerPixelY : 0)
          }, 0)
          const notch: Array<{ ix: number; iy: number }> = []
          for (let iy = union.iy0; iy <= union.iy1; iy += 1) for (let ix = union.ix0; ix <= union.ix1; ix += 1) if (!inBox(s, ix, iy) && !inBox(n, ix, iy)) notch.push({ ix, iy })
          // another strip of the same band inside the notch is taken in with it; a body's cell there stops the join
          const owner = (c: { ix: number; iy: number }): PlanRegion | undefined => out.find((r) => r !== strip && r !== next && r.cells.some((x) => x.ix === c.ix && x.iy === c.iy))
          const owners = new Set(notch.map(owner).filter((r): r is PlanRegion => r !== undefined))
          const bandOnly = [...owners].every((r) => !spanOk(r.rect) && r.cells.every((c) => inBox(union, c.ix, c.iy)))
          const open = notch.filter((c) => owner(c) === undefined)
          const bandM2 = areaM2(strip.cells) + [...owners].reduce((a, r) => a + areaM2(r.cells), 0)
          if (bandOnly && areaM2(open) <= bandM2) {
            pieces = [union]
            absorbed = [...owners]
          }
        }
        if (!pieces) continue
        const kept = pieces.filter((b) => b.ix1 >= b.ix0 && b.iy1 >= b.iy0)
        const made = kept.map((b) => regionOf(b, [strip, next]))
        // two strips stacked end to end (one band cut by a grid line) become one longer strip, for the next pass
        const stacked = !spanOk(next.rect) && made.length === 1 && made[0] !== undefined
        // every piece must be a body the layout would keep: a re-cut that leaves one it rejects loses its floor
        if (!stacked && made.some((r) => r === undefined || !spanOk(r.rect) || !accept(r))) continue
        out = [...out.filter((r) => r !== strip && r !== next && !absorbed.includes(r)), ...(made as PlanRegion[])]
        changed = true
        break
      }
      if (changed) break
    }
    if (!changed) break
  }
  return out.sort((a, b) => (b.rect.x1 - b.rect.x0) * (b.rect.y1 - b.rect.y0) - (a.rect.x1 - a.rect.x0) * (a.rect.y1 - a.rect.y0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

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
    // pocket in it, or the box is not the body's shape. On a plan cut on its
    // outline (005C post-review), a recess outside the outline is a pocket only
    // as small as the pocket rule's floor (6 m², an entrance niche); larger, it
    // is the ground a U or an L wraps, and inflating across it builds a
    // courtyard.
    const outlined = decomposition.envelope?.outline ? new Set(decomposition.envelope.outline.map((c) => `${c.ix}:${c.iy}`)) : undefined
    const scaled = (decomposition.regions.find((r) => r.classification === 'BUILT' && r.rect.x1 > r.rect.x0) ?? parts[0])
    const pxArea = (r: PixelRect): number => (r.x1 - r.x0) * (r.y1 - r.y0)
    const m2PerPx = scaled ? ((scaled.metric.x1 - scaled.metric.x0) * (scaled.metric.z1 - scaled.metric.z0)) / Math.max(1e-9, pxArea(scaled.rect)) : 0
    const recessOf = (c: { ix: number; iy: number }) => decomposition.regions.find((r) => r.classification === 'RECESS' && r.cells.some((x) => x.ix === c.ix && x.iy === c.iy))
    const pocket = (c: PlanCell): boolean => {
      if (c.classification !== 'RECESS') return false
      if (!outlined || outlined.has(`${c.ix}:${c.iy}`)) return true
      const region = recessOf(c)
      return region !== undefined && pxArea(region.rect) * m2PerPx <= POCKET_FLOOR_M2
    }
    const rectangular = decomposition.cells.every((c) => {
      const inside = c.rect.x0 >= rect.x0 && c.rect.x1 <= rect.x1 && c.rect.y0 >= rect.y0 && c.rect.y1 <= rect.y1
      if (!inside) return true
      return own.has(`${c.ix}:${c.iy}`) || pocket(c)
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

// ---------------------------------------------------------------------------
// The opening-aware boundary (005C): read, weighed against the incumbent box,
// and accepted only where the drawing proves the box incomplete.
// ---------------------------------------------------------------------------

/** One component of the outline beyond the incumbent box, and what was decided about it. */
export type BoundaryExtension = {
  cells: Array<{ ix: number; iy: number }>
  areaM2: number
  /** Length of the box's edge across which the outline continues with no wall or opening on it, in metres. */
  continuesAcrossM: number
  accepted: boolean
  why: string
}

/** What the opening-aware boundary found on a plan (`decomposition.boundary`). */
export type BoundaryRecord = {
  version: string
  /** 005K: this reading's identity (`decompositionIdOf`) and scale: a gap id is unique only within one reading. */
  decompositionId: string
  mpp: { x: number; y: number }
  wallPx: number
  /** Lines the shadow grid added at exterior-chain ticks with no grid line near them. */
  shadowLines: { x: number[]; y: number[] }
  gaps: Record<GapClass, number>
  drawingBreaks: number
  bridged: { strong: number; weak: number; pocketMouths: number; unjudged: number }
  /** Candidate A (the long-band box and its shut bays) and B (the opening-aware outline), each with its perimeter's support. */
  candidates: Array<{ id: 'A_LONG_BAND_BOX' | 'B_OPENING_AWARE_OUTLINE'; cells: number; support: OutlineSupport }>
  extensions: BoundaryExtension[]
  accepted: boolean
  floods: number
  /**
   * The outline under the two jamb policies: STRONG bridges only, and STRONG plus WEAK bridged by what lies behind
   * them (the reading). `disagree` when either adopts an outline and what the two build differs by more than 6 %.
   */
  policies: { strict: { accepted: boolean; areaM2: number; support: OutlineSupport }; exclusion: { accepted: boolean; areaM2: number; support: OutlineSupport }; disagree: boolean }
  /** Every part of the plan beyond the house, and its relation to it (`boundary-bodies.ts`). */
  bodies: AttachedBody[]
  /** Open-mouthed garages this reading shut (only in the reading that shuts pocket mouths). */
  shutGarageMouths: number
  /** 005F: the extent's stated sides the box stops materially inside, and the parts judged as completions. */
  extentConflicts: ExtentConflict[]
  completions: CompletionPart[]
  /** 005F: enclosed parts the completion cap left unjudged (B5F-1), and the long-band box the sides were weighed against. */
  completionsUnjudged: number
  box: PixelRect | null
  why: string
  /** 005K: one record per gap left WEAK (or upgraded by the drawn-gap rule), in canonical order; and the rule's mode. */
  gapEvidence: GapEvidenceRecord[]
  gapEvidenceOmitted: number
  drawnGapRule: 'OFF' | 'ON'
}

/** The pocket rule's floor (the pipeline's `max(6 m², 2.5 w²)`): a recess no larger is a pocket of the body around it. */
const POCKET_FLOOR_M2 = 6
/** Two outlines this close in area are one reading (the AGREES band of the layout gate). */
const POLICY_AGREES = 0.06

/**
 * Do the two jamb policies read two buildings? Both building what the box builds is agreement; either adopting an
 * outline and the two then building more than 6 % apart is not — one adopting and the other not included (005C
 * post-review: it used to take both adopting, so a reading that only the WEAK bridges made could never be doubted).
 */
export function policiesDisagree(strict: { adopted: boolean; areaM2: number }, exclusion: { adopted: boolean; areaM2: number }): boolean {
  return (strict.adopted || exclusion.adopted) && Math.abs(strict.areaM2 - exclusion.areaM2) > Math.max(strict.areaM2, exclusion.areaM2) * POLICY_AGREES
}
/** How many components beyond the box one plan may weigh. */
const MAX_EXTENSIONS = 16

const solidCache = new WeakMap<Mask, Map<number, SolidLayer>>()
const solidOf = (mask: Mask, wallPx: number): SolidLayer => {
  let byWall = solidCache.get(mask)
  if (!byWall) {
    byWall = new Map()
    solidCache.set(mask, byWall)
  }
  const key = Math.round(wallPx * 1000)
  let layer = byWall.get(key)
  if (!layer) {
    layer = solidLayer(mask, wallPx)
    byWall.set(key, layer)
  }
  return layer
}

function shadowLine(axis: 'X' | 'Y', px: number): GridLine {
  return {
    axis,
    px: round6(px),
    probesPx: [round6(px)],
    support: { chainIds: [], printedChainIds: [], chainSpanPx: 0, bandLength: 0, bandCoverage: 0, bandSpans: false },
    confidence: 0.5,
    why: 'a tick of an exterior dimension chain, read or not, where no wall band or read segment put a line: the drawing says a face is here',
  }
}

function outlineEnvelope(override: OutlineOverride, bands: readonly Band[], wallPx: number, registration: CoordinateRegistration): WalledEnvelope {
  const { linesX, linesY, outline } = override
  const cells: Array<{ ix: number; iy: number }> = []
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (let iy = 0; iy < outline.ny; iy += 1) {
    for (let ix = 0; ix < outline.nx; ix += 1) {
      if (outline.inside[iy * outline.nx + ix] !== 1) continue
      cells.push({ ix, iy })
      x0 = Math.min(x0, linesX[ix].px)
      x1 = Math.max(x1, linesX[ix + 1].px)
      y0 = Math.min(y0, linesY[iy].px)
      y1 = Math.max(y1, linesY[iy + 1].px)
    }
  }
  const rect = { x0: round6(x0), y0: round6(y0), x1: round6(x1), y1: round6(y1) }
  const u0 = (rect.x0 - registration.originPx.x) * registration.metresPerPixelX
  const u1 = (rect.x1 - registration.originPx.x) * registration.metresPerPixelX
  const v0 = (rect.y0 - registration.originPx.y) * registration.metresPerPixelY
  const v1 = (rect.y1 - registration.originPx.y) * registration.metresPerPixelY
  const long = longBands(bands, wallPx)
  return {
    rect,
    metric: { x0: round6(Math.min(u0, u1)), z0: round6(Math.min(v0, v1)), x1: round6(Math.max(u0, u1)), z1: round6(Math.max(v0, v1)) },
    bands: { vertical: long.filter((b) => b.axis === 'VERTICAL').length, horizontal: long.filter((b) => b.axis === 'HORIZONTAL').length },
    why: override.why,
    outline: cells,
  }
}

/**
 * Read the opening-aware boundary on a plan and weigh it against the incumbent
 * box (the acceptance rule of the 005C boundary review).
 *
 * The box stands, byte for byte, unless a component of the outline beyond it
 * continues the box's interior across a stretch of the box's own edge that has
 * neither wall nor opening on it: the drawing then says the building goes on
 * where the box says it stops. Only then is the plan re-cut on the outline.
 */
export function boundaryExtension(
  mask: Mask,
  bands: readonly Band[],
  registration: CoordinateRegistration,
  extent: PixelRect,
  incumbent: PlanDecomposition,
  options: PlanDecompositionOptions,
  chains: readonly DimensionChain[] = [],
): { record: BoundaryRecord; override?: OutlineOverride; walls: { x: WallLine[]; y: WallLine[] }; lines: { x: number[]; y: number[] }; outline: OutlineResult } {
  const opt = { ...DEFAULTS, ...options }
  const wallPx = options.sheetWallPx ?? bandWallThickness(bands, opt.fallbackWallPx)
  const mppX = registration.metresPerPixelX
  const mppY = registration.metresPerPixelY
  const solid = solidOf(mask, wallPx)
  // the shadow grid: the plan's own lines, and a line at every exterior tick with none within half a wall
  const addLines = (existing: readonly GridLine[], ticks: readonly number[], axis: 'X' | 'Y', lo: number, hi: number): { lines: GridLine[]; added: number[] } => {
    const added: number[] = []
    for (const p of [...ticks].sort((a, b) => a - b)) {
      if (p < lo - opt.snapPx || p > hi + opt.snapPx) continue
      if (existing.some((l) => Math.abs(l.px - p) <= wallPx * 0.5) || added.some((q) => Math.abs(q - p) <= wallPx * 0.5)) continue
      added.push(round6(p))
    }
    return { lines: [...existing, ...added.map((p) => shadowLine(axis, p))].sort((a, b) => a.px - b.px), added }
  }
  const sx = addLines(incumbent.linesX, options.exteriorTicks?.x ?? [], 'X', extent.x0, extent.x1)
  const sy = addLines(incumbent.linesY, options.exteriorTicks?.y ?? [], 'Y', extent.y0, extent.y1)
  const linesX = sx.lines
  const linesY = sy.lines
  const nx = linesX.length - 1
  const ny = linesY.length - 1
  const drawnGapRule = options.drawnGapRule ?? 'OFF'
  const lineOptions = (mppAlong: number) => ({ wallPx, mppAlong, maxOpeningM: opt.maxOpeningM, maxWideOpeningM: opt.maxWideOpeningM, drawnGapRule })
  // Progress, write-only: one tick per line read and per weak gap judged.
  const linesTotal = linesX.length + linesY.length
  let linesRead = 0
  const read = (axis: 'X' | 'Y', l: GridLine): WallLine => {
    linesRead += 1
    options.checkpoint?.tick({ subphase: { id: 'BOUNDARY', label: 'joining the outline' }, counters: { lines: linesRead, linesTotal } })
    return axis === 'X' ? readWallLine(mask, solid, 'X', l.px, linesY[0].px, linesY[ny].px, lineOptions(mppY)) : readWallLine(mask, solid, 'Y', l.px, linesX[0].px, linesX[nx].px, lineOptions(mppX))
  }
  let wallsX = linesX.map((l) => read('X', l))
  let wallsY = linesY.map((l) => read('Y', l))
  const callouts = assignCallouts([...wallsX, ...wallsY], opt.callouts, (a) => (a === 'X' ? mppX : mppY), (a) => (a === 'X' ? mppY : mppX), wallPx)
  const upgrade = (line: WallLine): WallLine => ({ ...line, gaps: line.gaps.map((g) => (callouts.has(g.id) ? withCallout(g, callouts.get(g.id) as GapCallout, opt.maxWideOpeningM) : g)) })
  wallsX = wallsX.map(upgrade)
  wallsY = wallsY.map(upgrade)
  const corners = cornerLegs(mask, wallsX, wallsY, lineOptions(mppY), lineOptions(mppX))
  const withLegs = (lines: WallLine[], legs: BoundaryGap[][]): WallLine[] => lines.map((line, i) => (legs[i].length === 0 ? line : { ...line, gaps: [...line.gaps, ...legs[i]].sort((a, b) => a.fromPx - b.fromPx) }))
  wallsX = withLegs(wallsX, corners.x)
  wallsY = withLegs(wallsY, corners.y)
  const grid: OutlineGrid = { linesX: linesX.map((l) => l.px), linesY: linesY.map((l) => l.px), wallsX, wallsY, mppX, mppY, wallPx }
  const onJudge = (judged: number, total: number): void => options.checkpoint?.tick({ subphase: { id: 'BOUNDARY_GAPS', label: 'judging the openings' }, counters: { gaps: judged, gapsTotal: total } })
  const exclusion = solveOutline(grid, { onJudge })
  const index = (ix: number, iy: number): number => iy * nx + ix
  const centreIn = (ix: number, iy: number, r: PixelRect): boolean => {
    const cx = (linesX[ix].px + linesX[ix + 1].px) / 2
    const cy = (linesY[iy].px + linesY[iy + 1].px) / 2
    return cx >= r.x0 && cx <= r.x1 && cy >= r.y0 && cy <= r.y1
  }
  const env = incumbent.envelope
  const shutBays = incumbent.bays.filter((b) => b.mouth.decision === 'OPENING_IN_WALL')
  const inA = new Uint8Array(nx * ny)
  for (let iy = 0; iy < ny; iy += 1) for (let ix = 0; ix < nx; ix += 1) if ((env && centreIn(ix, iy, env.rect)) || shutBays.some((b) => centreIn(ix, iy, b.rect))) inA[index(ix, iy)] = 1
  const allGaps = [...wallsX, ...wallsY].flatMap((l) => l.gaps)
  const counts = { DRAWING_BREAK_SUPPORTED: [...wallsX, ...wallsY].reduce((a, l) => a + l.drawingBreaks, 0), OPENING_SUPPORTED: 0, UNKNOWN_GAP: 0, TRUE_EXTERIOR_GAP: 0 } as Record<GapClass, number>
  for (const g of allGaps) counts[g.cls] += 1
  const valid = (jx: number, jy: number): boolean => jx >= 0 && jy >= 0 && jx < nx && jy < ny
  // The outline may only widen the building: it replaces the box when it encloses more than the box's own reading
  // built. An outline smaller than that has leaked where the box held, and the box stands.
  const areaOf = (cells: Uint8Array): number => {
    let total = 0
    for (let iy = 0; iy < ny; iy += 1) for (let ix = 0; ix < nx; ix += 1) if (cells[index(ix, iy)] === 1) total += (linesX[ix + 1].px - linesX[ix].px) * mppX * (linesY[iy + 1].px - linesY[iy].px) * mppY
    return total
  }
  const incumbentBuiltM2 = incumbent.cells.filter((c) => c.classification === 'BUILT').reduce((a, c) => a + (c.rect.x1 - c.rect.x0) * mppX * (c.rect.y1 - c.rect.y0) * mppY, 0)
  // The cells the box's own reading built, on the shadow grid: an adopted outline keeps every one of them (005C
  // post-review). Where the outline leaks past a wall the box's reading held, the box's reading stands.
  const builtA = new Uint8Array(nx * ny)
  const builtCells = incumbent.cells.filter((c) => c.classification === 'BUILT')
  for (let iy = 0; iy < ny; iy += 1) for (let ix = 0; ix < nx; ix += 1) if (builtCells.some((c) => centreIn(ix, iy, c.rect))) builtA[index(ix, iy)] = 1
  // A doorway: a door-sized opening bridged in a wall line, a leaf or nothing drawn across it (a window is not one).
  const doorwayOn = (line: WallLine, a: number, b: number): boolean =>
    line.gaps.some((g) => g.boundary !== 'NONE' && g.widthM <= opt.maxOpeningM && (g.signature === 'LEAF_AXIS' || g.signature === 'BLANK') && Math.min(g.toPx, b) - Math.max(g.fromPx, a) > 0)

  /**
   * Weigh one outline against the box: its parts beyond the box, which of them continue the box's interior across an
   * edge with no wall and no opening (or are named in `forced`: a garage whose mouth the reading shut), and the
   * outline adopted — the box's cells the outline confirms, every cell the box's reading built (where the outline
   * leaks past a wall the box held, the box stands), and the accepted parts. An accepted part keeps only what its
   * continuation reaches through open edges and openings, and the wall cells around that (005C post-review): a room
   * behind its door belongs with the room in front of it, a yard behind a solid wall does not ride in with the wing
   * beside it. A part walled off from the box on every shared edge is rejected, and touching the box does not bring
   * it back: a planter or a pier against the front wall encloses ground, not a room of this building.
   */
  const adopt = (outline: OutlineResult, forced?: Uint8Array): { extensions: BoundaryExtension[]; accepted: Uint8Array; final: Uint8Array; any: boolean } => {
    const extensions: BoundaryExtension[] = []
    const seen = new Uint8Array(nx * ny)
    const accepted = new Uint8Array(nx * ny)
    const neighbours = (ix: number, iy: number): Array<{ jx: number; jy: number; edge: OutlineEdge; lengthM: number; door: boolean }> => [
      { jx: ix, jy: iy - 1, edge: outline.hEdge[iy][ix], lengthM: (linesX[ix + 1].px - linesX[ix].px) * mppX, door: doorwayOn(wallsY[iy], linesX[ix].px, linesX[ix + 1].px) },
      { jx: ix + 1, jy: iy, edge: outline.vEdge[ix + 1][iy], lengthM: (linesY[iy + 1].px - linesY[iy].px) * mppY, door: doorwayOn(wallsX[ix + 1], linesY[iy].px, linesY[iy + 1].px) },
      { jx: ix, jy: iy + 1, edge: outline.hEdge[iy + 1][ix], lengthM: (linesX[ix + 1].px - linesX[ix].px) * mppX, door: doorwayOn(wallsY[iy + 1], linesX[ix].px, linesX[ix + 1].px) },
      { jx: ix - 1, jy: iy, edge: outline.vEdge[ix][iy], lengthM: (linesY[iy + 1].px - linesY[iy].px) * mppY, door: doorwayOn(wallsX[ix], linesY[iy].px, linesY[iy + 1].px) },
    ]
    const capped: number[] = []
    if (env) {
      for (let iy = 0; iy < ny; iy += 1) {
        for (let ix = 0; ix < nx; ix += 1) {
          const i0 = index(ix, iy)
          if (seen[i0] === 1 || outline.inside[i0] !== 1 || inA[i0] === 1) continue
          if (extensions.length >= MAX_EXTENSIONS) {
            capped.push(i0)
            continue
          }
          const members: Array<{ ix: number; iy: number }> = []
          const stack: Array<[number, number]> = [[ix, iy]]
          seen[i0] = 1
          while (stack.length > 0) {
            const [cx, cy] = stack.pop() as [number, number]
            members.push({ ix: cx, iy: cy })
            for (const n of neighbours(cx, cy)) {
              if (!valid(n.jx, n.jy)) continue
              const j = index(n.jx, n.jy)
              if (seen[j] === 1 || outline.inside[j] !== 1 || inA[j] === 1) continue
              seen[j] = 1
              stack.push([n.jx, n.jy])
            }
          }
          members.sort((p, q) => p.iy - q.iy || p.ix - q.ix)
          let across = 0
          let areaM2 = 0
          for (const m of members) {
            areaM2 += (linesX[m.ix + 1].px - linesX[m.ix].px) * mppX * (linesY[m.iy + 1].px - linesY[m.iy].px) * mppY
            for (const n of neighbours(m.ix, m.iy)) {
              if (!valid(n.jx, n.jy)) continue
              const j = index(n.jx, n.jy)
              if (inA[j] === 1 && outline.inside[j] === 1 && !n.edge.closed) across += n.lengthM
            }
          }
          const shut = forced !== undefined && members.some((m) => forced[index(m.ix, m.iy)] === 1)
          const ok = across > 0 || shut
          // What the continuation carries (005C post-review): from the cells entered from the box's rooms (or a shut
          // garage's), through edges with no wall or with an opening in them — a room behind its door — and the
          // wall-thickness cells bordering what that reaches. A yard or a planter behind a solid wall is walled off
          // from the rooms that continue the box, and does not ride in with them.
          if (ok) {
            const inPart = new Set(members.map((m) => index(m.ix, m.iy)))
            const thin = (k: number): boolean => {
              const kx = k % nx
              const ky = (k - kx) / nx
              return Math.min(linesX[kx + 1].px - linesX[kx].px, linesY[ky + 1].px - linesY[ky].px) <= wallPx * 1.5
            }
            const kept = new Set<number>()
            const stack: number[] = []
            for (const m of members) {
              const k = index(m.ix, m.iy)
              // entered from the box's own rooms: across an open edge, or through a door or an opening in its wall
              const seed = (forced !== undefined && forced[k] === 1) || neighbours(m.ix, m.iy).some((n) => valid(n.jx, n.jy) && inA[index(n.jx, n.jy)] === 1 && outline.inside[index(n.jx, n.jy)] === 1 && (!n.edge.closed || n.edge.bridged > 0 || n.door))
              if (seed && !kept.has(k)) {
                kept.add(k)
                stack.push(k)
              }
            }
            while (stack.length > 0) {
              const k = stack.pop() as number
              const kx = k % nx
              for (const n of neighbours(kx, (k - kx) / nx)) {
                if (!valid(n.jx, n.jy)) continue
                const j = index(n.jx, n.jy)
                if (!inPart.has(j) || kept.has(j)) continue
                if (n.edge.closed && n.edge.bridged <= 0 && !n.door) continue
                kept.add(j)
                stack.push(j)
              }
            }
            for (const m of members) {
              const k = index(m.ix, m.iy)
              if (kept.has(k) || !thin(k)) continue
              if (neighbours(m.ix, m.iy).some((n) => valid(n.jx, n.jy) && kept.has(index(n.jx, n.jy)) && !thin(index(n.jx, n.jy)))) kept.add(k)
            }
            const off = members.filter((m) => !kept.has(index(m.ix, m.iy)))
            if (off.length > 0 && off.length < members.length) {
              const offM2 = off.reduce((a, m) => a + (linesX[m.ix + 1].px - linesX[m.ix].px) * mppX * (linesY[m.iy + 1].px - linesY[m.iy].px) * mppY, 0)
              extensions.push({ cells: off, areaM2: round6(offM2), continuesAcrossM: 0, accepted: false, why: `${offM2.toFixed(1)} m² enclosed beside a part that continues the box, but walled off from it: no opening in the wall between` })
              members.splice(0, members.length, ...members.filter((m) => kept.has(index(m.ix, m.iy))))
              areaM2 -= offM2
            }
          }
          extensions.push({
            cells: members,
            areaM2: round6(areaM2),
            continuesAcrossM: round6(across),
            accepted: ok,
            why: across > 0
              ? `${areaM2.toFixed(1)} m² enclosed by wall and openings beyond the box, continuing its interior across ${across.toFixed(2)} m of the box's edge that carries no wall and no opening: the building goes on where the box stops`
              : shut
                ? `${areaM2.toFixed(1)} m² beyond the box behind a garage mouth this reading shuts: two wall sides and the house behind it`
                : `${areaM2.toFixed(1)} m² enclosed beyond the box, but separated from its interior by wall or openings on every shared edge: not a continuation of this building's interior`,
          })
        }
      }
    }
    if (capped.length > 0) extensions.push({ cells: capped.map((i) => ({ ix: i % nx, iy: Math.floor(i / nx) })), areaM2: round6(capped.reduce((a, i) => a + (linesX[(i % nx) + 1].px - linesX[i % nx].px) * mppX * (linesY[Math.floor(i / nx) + 1].px - linesY[Math.floor(i / nx)].px) * mppY, 0)), continuesAcrossM: 0, accepted: false, why: `more than ${MAX_EXTENSIONS} parts beyond the box: the rest are not weighed, and not built` })
    for (const e of extensions) if (e.accepted) for (const m of e.cells) accepted[index(m.ix, m.iy)] = 1
    // the box's cells the outline confirms, every cell the box's reading built, and the accepted parts
    const final = new Uint8Array(nx * ny)
    for (let i = 0; i < nx * ny; i += 1) if ((outline.inside[i] === 1 && inA[i] === 1) || builtA[i] === 1 || accepted[i] === 1) final[i] = 1
    // The outline may only widen the building: adopted, it must build more than the box's reading did.
    const widens = areaOf(final) > incumbentBuiltM2 + 1e-9
    if (!widens) for (const e of extensions) if (e.accepted) Object.assign(e, { accepted: false, why: `${e.why}; but it builds no more than the ${incumbentBuiltM2.toFixed(1)} m² the box builds, and the box stands` })
    const any = extensions.some((e) => e.accepted)
    if (!any) accepted.fill(0)
    return { extensions, accepted, final: any ? final : builtA, any }
  }

  // Two policies (the contract's §2.2): STRONG bridges only, and STRONG plus WEAK bridged by what lies behind them.
  // The second is the reading; the first is its check. Both adopting outlines more than 6 % apart is a question the
  // drawing does not settle, recorded here and raised only if the reading then stops.
  const strict = solveOutline(grid, { policy: 'STRICT' })
  const strictAdopted = adopt(strict)
  const reading = adopt(exclusion)
  // The house the parts are named against: the building as this reading cuts it, less the parts it accepts — those
  // are named too. Their cells still count as the house on a neighbour's junction (005C post-review: a terrace
  // beside an accepted wing borrowed the wing's walls as its own sides).
  // When the reading adopts nothing, the house is the box, every cell of it (the parts are named against the box).
  const house = reading.any ? reading.final.map((v, i) => (v === 1 && reading.accepted[i] !== 1 ? 1 : 0)) : inA
  const bodies = classifyBodies(grid, exclusion, inA, house, reading.accepted, opt.maxWideOpeningM)

  // The reading that shuts pocket mouths (005A's resolver) shuts an open-mouthed garage's mouth too: its mouth gap
  // is read as an opening, and the garage is adopted by its relation, not by a continuation it does not have.
  const garages = options.shutPocketMouths ? bodies.filter((b) => b.relation === 'OPEN_MOUTH_GARAGE' && b.mouth) : []
  let outline = exclusion
  let chosen = reading
  let outlineWalls = { x: wallsX, y: wallsY }
  if (garages.length > 0) {
    const mouths = new Set(garages.map((b) => b.mouth?.gapId))
    const shut = (line: WallLine): WallLine => ({ ...line, gaps: line.gaps.map((g) => (mouths.has(g.id) ? { ...g, cls: 'OPENING_SUPPORTED' as const, boundary: 'STRONG' as const, occupancy: 'OPENING' as const, why: `${g.why}; shut as a garage mouth in the reading that shuts pocket mouths`, ...because(g, 'SHUT_GARAGE_MOUTH') } : g)) })
    outlineWalls = { x: wallsX.map(shut), y: wallsY.map(shut) }
    const shutGrid: OutlineGrid = { ...grid, wallsX: outlineWalls.x, wallsY: outlineWalls.y }
    const forced = new Uint8Array(nx * ny)
    for (let iy = 0; iy < ny; iy += 1) for (let ix = 0; ix < nx; ix += 1) if (garages.some((b) => centreIn(ix, iy, b.rect))) forced[index(ix, iy)] = 1
    outline = solveOutline(shutGrid, { onJudge })
    chosen = adopt(outline, forced)
  }
  const { extensions } = chosen
  let final = chosen.final
  const anyAccepted = chosen.any
  // 005F: the extent's stated sides against the box, and the parts the outline encloses that the reading does not
  // build, judged as attached rooms or box completions (`boundary-completion.ts`). Pixels, walls and chain geometry
  // only: no printed value, no published figure.
  const completion = completeBoundary({
    linesX: linesX.map((l) => l.px),
    linesY: linesY.map((l) => l.px),
    wallsX,
    wallsY,
    mppX,
    mppY,
    wallPx,
    outline,
    strict,
    inA,
    builtA,
    accepted: chosen.accepted,
    box: env?.rect ?? null,
    extent,
    solid,
    sides: options.extentSides ?? [],
    chains,
  })
  const completed = completion.parts.filter((p) => p.decision === 'ACCEPTED')
  if (completed.length > 0) {
    final = final.map((v, i) => (v === 1 || completion.accepted[i] === 1 ? 1 : 0))
    // the bodies named before the completion: one a completion now builds is built (C5F-8)
    for (const b of bodies) {
      if (b.built) continue
      const inside = completed.find((p) => p.rect.x0 >= b.rect.x0 - wallPx && p.rect.x1 <= b.rect.x1 + wallPx && p.rect.y0 >= b.rect.y0 - wallPx && p.rect.y1 <= b.rect.y1 + wallPx)
      if (inside) Object.assign(b, { built: true, why: `${b.why}; built as ${inside.kind === 'ATTACHED_ROOM' ? 'an attached room' : 'a box completion'}, clipped to ${round6(inside.areaM2)} m² (005F)` })
    }
  }
  const supportOf = (inside: Uint8Array, result: OutlineResult = outline): OutlineSupport => outlineSupport(grid, { ...result, inside })
  const strictM2 = round6(areaOf(strictAdopted.final))
  const exclusionM2 = round6(areaOf(reading.final))
  const disagree = policiesDisagree({ adopted: strictAdopted.any, areaM2: strictM2 }, { adopted: reading.any, areaM2: exclusionM2 })
  // 005K: the reading's open questions, as source-addressable records (observational: nothing below reads them)
  const decompositionId = decompositionIdOf({ extent, mppX: round6(mppX), mppY: round6(mppY), wallPx: round6(wallPx), linesX: linesX.map((l) => l.px), linesY: linesY.map((l) => l.px), shutPocketMouths: options.shutPocketMouths === true })
  const evidence = gapEvidenceRecords({ mask, wallsX: outlineWalls.x, wallsY: outlineWalls.y, mppX, mppY, wallPx, decompositionId, outline, drawnGapRule })
  const record: BoundaryRecord = {
    version: BOUNDARY_EVIDENCE_VERSION,
    decompositionId,
    mpp: { x: round6(mppX), y: round6(mppY) },
    wallPx: round6(wallPx),
    shadowLines: { x: sx.added, y: sy.added },
    gaps: counts,
    drawingBreaks: counts.DRAWING_BREAK_SUPPORTED,
    bridged: { strong: outline.bridged.strong.length, weak: outline.bridged.weak.length, pocketMouths: outline.pocketMouths.length, unjudged: outline.unjudged },
    candidates: [
      { id: 'A_LONG_BAND_BOX', cells: inA.reduce((a, v) => a + v, 0), support: supportOf(inA) },
      { id: 'B_OPENING_AWARE_OUTLINE', cells: outline.inside.reduce((a, v) => a + v, 0), support: supportOf(outline.inside) },
    ],
    extensions,
    accepted: anyAccepted,
    floods: exclusion.floods + strict.floods + (outline === exclusion ? 0 : outline.floods),
    policies: {
      strict: { accepted: strictAdopted.any, areaM2: strictM2, support: supportOf(strict.inside, strict) },
      exclusion: { accepted: reading.any, areaM2: exclusionM2, support: supportOf(exclusion.inside, exclusion) },
      disagree,
    },
    bodies,
    shutGarageMouths: garages.length,
    extentConflicts: completion.conflicts,
    completions: completion.parts,
    completionsUnjudged: completion.unjudged,
    box: env?.rect ?? null,
    why: !env
      ? 'the plan has no long-band box to weigh the outline against'
      : anyAccepted
        ? `the outline continues the box's interior past its edge (${extensions.filter((e) => e.accepted).length} component${extensions.filter((e) => e.accepted).length === 1 ? '' : 's'}): the plan is cut on the outline${completed.length > 0 ? `, and ${completed.length} part${completed.length === 1 ? '' : 's'} it encloses completed` : ''}`
        : completed.length > 0
          ? `the box stands, and ${completed.length} part${completed.length === 1 ? '' : 's'} the outline encloses ${completed.length === 1 ? 'is' : 'are'} completed (${completed.map((p) => p.kind.toLowerCase().replace('_', ' ')).join(', ')}): the plan is cut on the outline with the box's bodies as they were`
          : 'the outline adds nothing the box leaves open: the box stands',
    gapEvidence: evidence.records,
    gapEvidenceOmitted: evidence.omitted,
    drawnGapRule,
  }
  const debug = { walls: { x: wallsX, y: wallsY }, lines: { x: linesX.map((l) => l.px), y: linesY.map((l) => l.px) }, outline }
  if (!anyAccepted && completed.length === 0) return { record, ...debug }
  const completions = completed.map((p) => p.cells)
  return {
    ...debug,
    record,
    override: {
      linesX,
      linesY,
      outline: { ...outline, inside: final },
      why: `the opening-aware outline: wall-thick ink and ${outline.bridged.strong.length + outline.bridged.weak.length} bridged opening${outline.bridged.strong.length + outline.bridged.weak.length === 1 ? '' : 's'} enclose ${final.reduce((a, v) => a + v, 0)} cells, ${anyAccepted ? 'continuing the long-band box across an edge it could not support' : 'the long-band box and the parts completed against it'}`,
      ...(completions.length > 0 ? { completions, completionKinds: completed.map((p) => p.kind) } : {}),
      ...(completions.length > 0 && !anyAccepted ? { seeds: incumbent.regions.filter((r) => r.classification === 'BUILT').map((r) => r.rect) } : {}),
    },
  }
}
