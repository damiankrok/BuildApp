/**
 * How one gap in a wall becomes an opening: which printed callout labels it, what the elevations show of it, where its
 * sill and head are, and what kind of opening it is. `readWallOpenings` (openings-v2.ts) finds the gaps and calls these
 * steps in order; each step takes what it needs as plain values, so it can be tested on its own.
 *
 * Units: metres along and above the storey's world frame; callout sizes in centimetres as printed.
 */
import { round6 } from '@buildapp/source-common'
import type { ProvenanceStatus } from './graph.js'
import { CONVENTIONS } from '../solve.js'
import type { DrawnDoorLeaf, OpeningFamily, OpeningV2, WallHost } from './openings-v2.js'

// --- callouts ------------------------------------------------------------------------------------------------------

/** A callout read below this confidence is not weighed at all. */
export const CALLOUT_MIN_CONFIDENCE = 0.2
/** A width reading fits a plan gap within this share of the gap's width … */
export const CALLOUT_WIDTH_FIT_SHARE = 0.12
/** … or within this many metres, whichever is larger (a narrow gap is read to a few pixels). */
export const CALLOUT_WIDTH_FIT_MIN_M = 0.12

export type CalloutCandidates = {
  widths: Array<{ cm: number; score: number; planCorroborated?: boolean }>
  heights: Array<{ cm: number; score: number }>
}

/** A callout near the wall, with the position of its text in world metres and its readings. */
export type NearbyCallout = { id: string; rawText?: string; confidence: number; textCentre: { x: number; z: number }; pixelCentre: [number, number]; candidates: CalloutCandidates }

export type CalloutMatch = { callout: OpeningV2['callout']; weighed: Array<Record<string, unknown>> }

/**
 * The printed callout that labels a gap: the nearest one within reach whose width readings include one that fits the
 * gap. The gap's own width picks among the reader's width readings; a reading the recogniser's gate refused
 * (`planCorroborated`) counts only where none of the reader's own first three fits. `weighed` lists every callout
 * considered and why it was taken or not (diagnostics only).
 */
export function matchOpeningCallout(gap: { centre: number; widthM: number }, host: Pick<WallHost, 'facade' | 'centreAt'>, callouts: readonly NearbyCallout[], reachM: number, traced: boolean): CalloutMatch {
  const alongX = host.facade === 'FRONT' || host.facade === 'REAR'
  const fits = (c: { cm: number }): boolean => Math.abs(c.cm / 100 - gap.widthM) <= Math.max(CALLOUT_WIDTH_FIT_MIN_M, gap.widthM * CALLOUT_WIDTH_FIT_SHARE)
  let callout: OpeningV2['callout']
  const weighed: Array<Record<string, unknown>> = []
  for (const ev of callouts) {
    const cands = ev.candidates
    const alongDistance = Math.abs((alongX ? ev.textCentre.x : ev.textCentre.z) - gap.centre)
    const acrossDistance = Math.abs((alongX ? ev.textCentre.z : ev.textCentre.x) - host.centreAt)
    if (alongDistance > reachM || acrossDistance > reachM) continue
    const seen = traced ? { evidenceId: ev.id, rawText: ev.rawText, px: ev.pixelCentre, confidence: ev.confidence, widths: cands.widths.slice(0, 3).map((c) => c.cm), heights: cands.heights.slice(0, 3).map((c) => c.cm), alongM: round6(alongDistance), acrossM: round6(acrossDistance) } : undefined
    if (ev.confidence < CALLOUT_MIN_CONFIDENCE) {
      if (seen) weighed.push({ ...seen, decision: 'REJECTED', reason: `confidence ${ev.confidence} < ${CALLOUT_MIN_CONFIDENCE}` })
      continue
    }
    const readerOwn = cands.widths.filter((c) => !c.planCorroborated).slice(0, 3).filter(fits)
    const agreeing = readerOwn.length > 0 ? readerOwn : cands.widths.filter((c) => c.planCorroborated && fits(c))
    if (agreeing.length === 0) {
      if (seen) weighed.push({ ...seen, decision: 'REJECTED', reason: `no width reading within 12 % of the ${gap.widthM.toFixed(2)} m gap` })
      continue
    }
    if (seen) weighed.push({ ...seen, decision: 'AGREES' })
    const width = agreeing.reduce((best, c) => (c.score > best.score ? c : best), agreeing[0])
    const distance = round6(Math.hypot(alongDistance, acrossDistance))
    if (callout && callout.distanceM <= distance) continue
    callout = {
      widthCm: width.cm,
      heightCm: cands.heights[0].cm,
      evidenceId: ev.id,
      distanceM: distance,
      heightCandidates: cands.heights,
      ...(width.planCorroborated ? { widthCorroboratedByPlan: true as const } : {}),
      ...(width !== cands.widths[0] ? { resolvedBy: width.planCorroborated ? `the ${gap.widthM.toFixed(2)} m plan gap corroborated the width reading ${width.cm} the recogniser's gate refused, over ${cands.widths[0].cm}` : `the ${gap.widthM.toFixed(2)} m plan gap picked the width reading ${width.cm} over ${cands.widths[0].cm}` } : {}),
    }
  }
  return { callout, weighed }
}

// --- elevations ----------------------------------------------------------------------------------------------------

/** An extent shorter than this on an elevation is a frame or a sill board, not an opening. */
export const ELEVATION_MIN_OPENING_M = 0.5
/** The object reader's extent replaces the contrast reader's when it contains it within this margin. */
export const ELEVATION_CONTAINS_MARGIN_M = 0.1

export type ElevationExtent = { sillY: number; headY: number; contrast: number }

/**
 * Of the two readers of one elevation, the extent to keep: the contrast reader stands where it read something the
 * object reader does not contain; where it read nothing, or only a part of the same opening (a blind's dark half), the
 * object reader's whole extent replaces it. Null when neither read an opening at least `ELEVATION_MIN_OPENING_M` tall.
 */
export function preferredElevationExtent(byObject: ElevationExtent | null, byContrast: ElevationExtent | null): ElevationExtent | null {
  const ext = !byContrast ? byObject : byObject && byObject.sillY <= byContrast.sillY + ELEVATION_CONTAINS_MARGIN_M && byObject.headY >= byContrast.headY - ELEVATION_CONTAINS_MARGIN_M ? byObject : byContrast
  if (!ext || ext.headY - ext.sillY < ELEVATION_MIN_OPENING_M) return null
  return ext
}

/** How much an elevation reading is trusted: from its contrast, capped (an elevation never equals a printed size). */
export const elevationConfidence = (contrast: number): number => round6(Math.min(0.85, 0.4 + contrast / 100))

// --- sill and head -------------------------------------------------------------------------------------------------

/** A printed height at least this tall is a door's: the opening reaches the floor. */
export const DOOR_HEIGHT_MIN_M = 1.95
/** The head shorter printed openings share when nothing reads their sill. */
export const COMMON_HEAD_M = 2.2
/** A printed height and an elevation's extent agree within this. */
export const HEIGHT_AGREEMENT_M = 0.2
/** An elevation's height picks among the reader's height readings within this … */
export const HEIGHT_PICK_TOLERANCE_M = 0.15
/** … among readings scored at least this share of the best one. */
export const HEIGHT_PICK_MIN_SCORE_SHARE = 0.7
/** Two height readings the matcher scores within this are read alike. */
export const HEIGHT_RIVAL_SCORE_MARGIN = 0.02
/** … when they differ by at least this many centimetres. */
export const HEIGHT_RIVAL_MIN_CM = 15
/** An extent may start this far below the floor and still be the floor (the drawing's line weight). */
export const FLOOR_SLACK_M = 0.05

export type SillHead = {
  sillY: number
  headY: number
  sill: ProvenanceStatus
  head: ProvenanceStatus
  /** The callout as read, with its height re-picked by the elevation where that applies. */
  callout: OpeningV2['callout']
  notes: string[]
}

/**
 * The sill and head of an opening from what read it: a printed callout and an elevation together, either alone, or
 * nothing (null — the caller assumes them from the plan's convention). `weakHeight` says whether the callout's height
 * was read too weakly to stand over an elevation that contradicts it (`weakPrintedHeight`).
 */
export function resolveSillAndHead(host: Pick<WallHost, 'floorY' | 'storeyHeightM'>, read: { callout: OpeningV2['callout']; elevation: OpeningV2['elevation'] }, weakHeight: (heightM: number, drawnM: number, candidates: Array<{ cm: number; score: number }> | undefined) => { weak: boolean; confidence: number }): SillHead | null {
  let callout = read.callout
  const elevation = read.elevation
  const notes: string[] = []
  if (callout && elevation) {
    // The elevation's own height picks among the reader's height readings when the best one disagrees with it and
    // another, nearly as good, does not.
    const drawn = elevation.headY - elevation.sillY
    if (Math.abs(drawn - callout.heightCm / 100) > HEIGHT_AGREEMENT_M && callout.heightCandidates) {
      const top = callout.heightCandidates[0]?.score ?? 0
      const fitting = callout.heightCandidates.filter((c) => Math.abs(c.cm / 100 - drawn) <= HEIGHT_PICK_TOLERANCE_M && c.score >= top * HEIGHT_PICK_MIN_SCORE_SHARE)
      if (fitting.length > 0) {
        const pick = fitting.reduce((best, c) => (Math.abs(c.cm / 100 - drawn) < Math.abs(best.cm / 100 - drawn) ? c : best), fitting[0])
        callout = { ...callout, heightCm: pick.cm, resolvedBy: `${callout.resolvedBy ? `${callout.resolvedBy}; ` : ''}the elevation's ${drawn.toFixed(2)} m picked the height reading ${pick.cm} over ${callout.heightCandidates[0].cm}` }
      }
    }
    const h = callout.heightCm / 100
    if (Math.abs(elevation.headY - elevation.sillY - h) <= HEIGHT_AGREEMENT_M) {
      const sillY = round6((elevation.sillY + Math.max(host.floorY, elevation.headY - h)) / 2)
      return { sillY, headY: round6(sillY + h), sill: 'SOURCE_CORROBORATED', head: 'SOURCE_CORROBORATED', callout, notes }
    }
    const weak = weakHeight(h, elevation.headY - elevation.sillY, callout.heightCandidates)
    if (weak.weak) {
      // A height read weakly, contradicted by the elevation by more than half a metre, with no reading among its own
      // candidates the elevation fits, is not printed evidence over the drawing: the elevation's extent stands. The
      // printed width, which the plan's gap agreed with, stays.
      notes.push(`the printed height read ${h.toFixed(2)} m with confidence ${weak.confidence.toFixed(2)} against the elevation's ${(elevation.headY - elevation.sillY).toFixed(2)} m (${elevation.sillY.toFixed(2)}..${elevation.headY.toFixed(2)}), and none of its height readings fits the elevation: the elevation stands`)
      return { sillY: elevation.sillY, headY: elevation.headY, sill: 'IMAGE_METRIC_REGISTERED', head: 'IMAGE_METRIC_REGISTERED', callout, notes }
    }
    // The printed height stands over an elevation that contradicts it; the elevation's sill is kept only where an
    // opening of the printed height starting there would still fit in the storey.
    const fits = elevation.sillY >= host.floorY - FLOOR_SLACK_M && elevation.sillY + h <= host.floorY + host.storeyHeightM + FLOOR_SLACK_M
    const sill = h >= DOOR_HEIGHT_MIN_M ? { y: host.floorY, p: 'SOURCE_DERIVED' as const } : fits ? { y: elevation.sillY, p: 'IMAGE_METRIC_REGISTERED' as const } : { y: round6(host.floorY + Math.max(0, COMMON_HEAD_M - h)), p: 'ASSUMED_FOR_RENDERING' as const }
    notes.push(`the elevation reads ${(elevation.headY - elevation.sillY).toFixed(2)} m tall (${elevation.sillY.toFixed(2)}..${elevation.headY.toFixed(2)}) against the printed ${h.toFixed(2)}; the printed height stands`)
    return { sillY: sill.y, headY: round6(sill.y + h), sill: sill.p, head: 'SOURCE_EXACT', callout, notes }
  }
  if (callout) {
    const h = callout.heightCm / 100
    // A printed height with no elevation reading: a door-height opening reaches the floor, a shorter one takes a common head.
    const sillY = h >= DOOR_HEIGHT_MIN_M ? host.floorY : round6(host.floorY + Math.max(0, COMMON_HEAD_M - h))
    let head: ProvenanceStatus = 'SOURCE_EXACT'
    if (h < DOOR_HEIGHT_MIN_M) notes.push('sill height (no elevation reading; a common head is assumed)')
    // Two readings the matcher cannot tell apart, and nothing else to tell them by.
    const best = callout.heightCandidates?.[0].score ?? 0
    const rival = callout.heightCandidates?.slice(1).find((c) => c.score >= best - HEIGHT_RIVAL_SCORE_MARGIN && Math.abs(c.cm - callout.heightCm) >= HEIGHT_RIVAL_MIN_CM)
    if (rival) {
      head = 'UNRESOLVED'
      notes.push(`the printed height reads ${callout.heightCm} or ${rival.cm} alike, and no elevation shows this wall`)
    }
    return { sillY, headY: round6(sillY + h), sill: h >= DOOR_HEIGHT_MIN_M ? 'SOURCE_DERIVED' : 'ASSUMED_FOR_RENDERING', head, callout, notes }
  }
  if (elevation) return { sillY: elevation.sillY, headY: elevation.headY, sill: 'IMAGE_METRIC_REGISTERED', head: 'IMAGE_METRIC_REGISTERED', callout, notes }
  return null
}

// --- the kind of opening -------------------------------------------------------------------------------------------

/** A sill this close to the floor reaches it. */
export const REACHES_FLOOR_M = 0.12
/** A vehicle door's sill sits this close to the floor. */
export const VEHICLE_SILL_MAX_M = 0.1
/** The widest opening read as a single door. */
export const DOOR_MAX_WIDTH_M = 1.3
/** The tallest opening read as a single door. */
export const DOOR_MAX_HEIGHT_M = 2.35
/** The narrowest opening a glazed door or a floor-length window is read as. */
export const GLAZED_DOOR_MIN_WIDTH_M = 0.75
/** From this width an opening to the floor is a multi-panel glazing. */
export const MULTI_PANEL_MIN_WIDTH_M = 2.0

/**
 * The plan's symbols at the gap, asked lazily: each is a raster scan, and each is asked only where the decision
 * reaches it (so the scans, and the diagnostics some of them write, happen exactly where the rules need them).
 */
export type OpeningSymbols = {
  /** Glazing drawn across the gap: dark ink, or the light lines a frame and glass are drawn with. */
  glazed: () => boolean
  /** A door's leaf and swing drawn beside the gap, read strictly. */
  leaf: () => DrawnDoorLeaf | undefined
  /** A swing arc drawn in the room behind the gap. */
  swingDrawn: () => boolean
}

export type OpeningFamilyFacts = {
  storeyIndex: number
  widthM: number
  /** Sill and head above the storey's floor, as resolved (or assumed). */
  sillAboveFloorM: number
  heightM: number
  /** Nothing read the heights: they were assumed from the plan's convention. */
  heightsAssumed: boolean
  /** With assumed heights: the plan's convention made it a door (a door-wide gap with no glazing), and whether a swing is drawn. */
  doorBySymbol: boolean
  doorSwing: boolean
  /** The gap is the one open side of a room named a garage (and no glazing is drawn across it). */
  vehicleMouth?: { why: string }
  /** The plan draws an overhead door's tracks from both jambs. */
  overheadTracks?: { why: string }
  /** An attached single-storey body: a wide opening to the floor there is a vehicle door. */
  attachedSingleStorey: boolean
  /** The wall belongs to a room the publisher's list names a garage. */
  garageRoom?: { why: string }
  symbols: OpeningSymbols
}

export type OpeningFamilyDecision = {
  family: OpeningFamily
  /** Set only where the decision says how it was read; otherwise the caller's default stands. */
  provenance?: ProvenanceStatus
  /** A vehicle door whose heights nothing read: its sill goes to the floor and its head to the convention. */
  vehicleDoorAssumedHeights?: true
  leaf?: DrawnDoorLeaf
  notes: string[]
}

/** The width from which a ground-storey gap can be a vehicle door. */
export const VEHICLE_DOOR_MIN_WIDTH_M = 2.2

/**
 * What kind of opening a gap is. A vehicle door, a door or a full-height screen needs a sill something READ: an
 * assumed sill decides nothing, and with assumed heights only the plan's own symbols (a vehicle mouth, an overhead
 * door's tracks, the door convention) make anything but a window. With read heights the plan symbol decides between a
 * door and a glazed opening: a window is drawn with glazing lines across the gap, a door leaves the gap empty and
 * draws its leaf and swing beside it.
 */
export function classifyOpeningFamily(f: OpeningFamilyFacts): OpeningFamilyDecision {
  const reachesFloor = f.sillAboveFloorM < REACHES_FLOOR_M
  const onFloorForVehicle = f.sillAboveFloorM < VEHICLE_SILL_MAX_M
  const doorSized = f.widthM <= DOOR_MAX_WIDTH_M && f.heightM <= DOOR_MAX_HEIGHT_M
  if (f.heightsAssumed && (f.vehicleMouth || f.overheadTracks)) {
    const why = f.vehicleMouth?.why ?? f.overheadTracks?.why
    return { family: 'GARAGE_DOOR', provenance: 'SOURCE_DERIVED', vehicleDoorAssumedHeights: true, notes: [`a vehicle door: ${why}; its sill and head are assumed (${CONVENTIONS.openingHead} m) — no callout or elevation reads them`] }
  }
  if (f.vehicleMouth && !f.heightsAssumed && onFloorForVehicle) return { family: 'GARAGE_DOOR', notes: [] }
  if (f.overheadTracks && !f.heightsAssumed) return { family: 'GARAGE_DOOR', provenance: 'SOURCE_DERIVED', notes: [`a vehicle door: ${f.overheadTracks.why}`] }
  if (f.heightsAssumed) return f.doorBySymbol ? { family: 'DOOR', provenance: f.doorSwing ? 'SOURCE_DERIVED' : 'VISUAL_SEMANTIC', notes: [] } : { family: 'WINDOW', provenance: 'ASSUMED_FOR_RENDERING', notes: [] }
  if (f.attachedSingleStorey && f.storeyIndex === 0 && f.widthM >= VEHICLE_DOOR_MIN_WIDTH_M && onFloorForVehicle) return { family: 'GARAGE_DOOR', notes: [] }
  if (reachesFloor && f.widthM >= MULTI_PANEL_MIN_WIDTH_M) return { family: 'MULTI_PANEL_GLAZING', notes: [] }
  const glazed = f.symbols.glazed()
  if (reachesFloor && !glazed && doorSized) return { family: 'DOOR', notes: [] }
  // In a wall of a garage, an opening to the floor a door wide is its door: lines across the gap there are the frame,
  // not a French window's glass (a garage has none).
  if (reachesFloor && f.garageRoom && doorSized) return { family: 'DOOR', provenance: 'VISUAL_SEMANTIC', notes: [`a door by its room: ${f.garageRoom.why}; its leaf is not read on the plan`] }
  // Lines across the gap and a door's own symbol beside it — a leaf drawn open from one jamb, as long as the gap is
  // wide, and the arc it sweeps to the other — are a glazed leaf in a door, not a window to the floor. On the ground
  // storey only: above it a floor-length glazing with no balcony in the model is a French window.
  if (reachesFloor && glazed && f.storeyIndex === 0 && f.widthM >= GLAZED_DOOR_MIN_WIDTH_M && doorSized) {
    const leaf = f.symbols.leaf()
    if (leaf) return { family: 'GLAZED_DOOR', provenance: 'SOURCE_DERIVED', leaf, notes: [...(leaf.swing === 'OUT' ? ['opens outward: its leaf and arc are drawn outside the wall'] : []), 'the leaf’s glazing (lines across the gap beside a drawn leaf and swing: glass, or a threshold the plan draws the same way)'] }
  }
  if (reachesFloor && glazed && f.widthM >= GLAZED_DOOR_MIN_WIDTH_M && f.widthM <= MULTI_PANEL_MIN_WIDTH_M && f.storeyIndex === 0 && !f.symbols.swingDrawn()) return { family: 'WINDOW', notes: [] }
  if (reachesFloor && f.widthM > DOOR_MAX_WIDTH_M && f.widthM < MULTI_PANEL_MIN_WIDTH_M) return { family: 'GLAZED_DOOR', notes: [] }
  if (reachesFloor && !glazed) return { family: 'DOOR', notes: [] }
  // Narrower than any glazed door, to the floor, with a leaf or its swing drawn: a plain door, and the lines across its
  // gap are the threshold the plan draws there. Without a leaf or a swing it stays a window; the width cut is not moved.
  if (reachesFloor && glazed && f.widthM < GLAZED_DOOR_MIN_WIDTH_M) {
    const leaf = f.symbols.leaf()
    if (leaf || f.symbols.swingDrawn()) return { family: 'DOOR', provenance: 'SOURCE_DERIVED', ...(leaf ? { leaf } : {}), notes: [`a door ${f.widthM.toFixed(2)} m wide: its ${leaf ? 'leaf' : 'swing'} is drawn, so the lines across the gap are its threshold, not glass`] }
  }
  return { family: 'WINDOW', notes: [] }
}
