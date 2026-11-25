/**
 * v3.54.17 — the basic mass of a house from source observations, before (and without) a LOCAL model.
 *
 * Observations, never a third description of the house: a plan OUTLINE in metres (from a plan frame whose scale the
 * analyzer measured, or from the walls of the model that stands), and each elevation's SILHOUETTE as the sketch reads
 * it (its ground row, wall zones and roof surfaces, in that elevation's own frame pixels). From them:
 *
 *   1. each elevation is registered BY THE PLAN — its building width in pixels against the outline's extent along that
 *      side gives metres per pixel; the vertical scale is the same (an orthographic elevation is drawn isotropic), and
 *      the ground row is the sketch's. A wrong roof in the model never enters this registration, so a roof can be
 *      corrected before any height of the model is trusted (no "no correction without registration" loop).
 *   2. the outline is split into at most two rectangles (the supported scope: a rectangle, or two joined bodies); where
 *      both splits of an L are possible, the one whose line an elevation's silhouette steps at is taken, else both are
 *      kept and the larger main body is named as the choice.
 *   3. per body, the elevations that face it give its eaves and ridge (or flat top) and its roof form: a gable END is a
 *      triangle on the sides across the ridge, the SLOPES a band on the sides along it; a flat roof rises nothing above
 *      its walls. A hip (a trapezoid on every side) or a form no elevation decides is named, never guessed.
 *
 * Every number keeps its provenance (SOURCE_DERIVED from a registered drawing, DISPLAY_ASSUMPTION for a miniature
 * convention such as the wall thickness or a parapet); what is missing is listed as the anchor it lacks.
 */
import type { BuildingCommand } from '@buildapp/commands'
import type { CanonicalBuildingModel, Wall } from '@buildapp/model'
import { pointInPoly, ROOF_SYSTEM_TOLERANCES, solveRoofSystem } from '@buildapp/reconstruction'
import type { RoofRegion, RoofSystemSolution } from '@buildapp/reconstruction'
import type { BindView, Projection, Side } from '../correct/execute.js'
import type { Poly } from '../correct/source-gate.js'

export const MASSING_VERSION = '1.11.0' as const

import type { BuildStructure, StructureSide } from '../structure.js'
export type Rect = { minX: number; maxX: number; minZ: number; maxZ: number }
export type Fidelity = 'SOURCE_EXACT' | 'SOURCE_DERIVED' | 'SOURCE_TRACED' | 'DISPLAY_ASSUMPTION' | 'TRACE_UNCERTAIN'
export type Prov = { fidelity: Fidelity; source: string; why: string }

/** A plan outline in metres: x along the FRONT (left to right as the front elevation shows it), z from the front (0) back. */
export type OutlineObservation = { observationId: string; frameId: string; sourceByteHash: string; outline: ReadonlyArray<{ x: number; z: number }>; by: 'API_PLAN_OUTLINE' | 'MODEL_WALLS' | 'CONTROL'; fidelity: Fidelity; why: string }
/** One elevation as the sketch reads it, in its own frame pixels. */
export type SilhouetteObservation = { observationId: string; side: Side; frameId: string; sourceByteHash: string; groundRow: number | null; walls: Poly[]; roofs: Poly[]; silhouette?: Poly | null }

export type RoofForm = 'GABLE' | 'FLAT' | 'HIP'
/**
 * `eavesM` is the roof's top surface at the wall face (a flat roof: the parapet's top). A HIP (massing 1.3.0) also states
 * `hipRunM` — how far each end of the ridge stands in from the end wall — and may state `overhangM`, the eaves' reach past
 * the walls on the sides along the ridge (the hip ends reach so far that the fascia stays level all round).
 */
export type RoofSpec = { kind: RoofForm; ridgeAxis?: 'X' | 'Z'; pitchDeg?: number; eavesM: number; ridgeM?: number; hipRunM?: number; overhangM?: number }
/**
 * massing 1.11.0: what became of ONE property of a roof — a value taken from a read or a page beside what was built.
 *   APPLIED                 the built value is the taken one (within the stated tolerance), or was derived from it;
 *   RETAINED_WITH_CONFLICT  the drawn value stands, the taken one disagrees — both on the record, with the difference;
 *   REJECTED                the taken value was not used, by a named reason;
 *   UNUSED_UNSUPPORTED      no consumer exists for it;
 *   UNRESOLVED              nothing decides.
 */
export type PropertyFate = { property: string; fate: 'APPLIED' | 'RETAINED_WITH_CONFLICT' | 'REJECTED' | 'UNUSED_UNSUPPORTED' | 'UNRESOLVED'; taken?: string; built?: string; residual?: number; why: string }
export type BodySpec = { id: string; rect: Rect; roof: RoofSpec; provenance: Record<string, Prov>; fates?: PropertyFate[] }
/** A description is bound to a body by its own views when at least this many more of them draw one ridge direction than the other. */
export const BIND_BY_VIEWS = 2
/** A built pitch agrees with a stated one within this (degrees); a height within `MASSING_TOLERANCES.heightAgreeM` / share. */
export const PITCH_AGREE_DEG = 6
/** …and is THE stated pitch within this (degrees). */
export const PITCH_SAME_DEG = 3
export type SettleInput = {
  /** A pitch stated for this roof from outside its own silhouettes, and by whom. */
  pitch?: { deg: number; from: string; /** stated for THIS roof: a disagreement with it is acted on. Otherwise it is only what a roof whose own heights make no roof falls back to (a lower roof need not have the main roof's pitch). */ binding: boolean }
  /** The eaves are a line two views draw (a wall's corner under the roof); else only a lower bound of the wall's top. */
  eavesHeld: boolean
  drawnEavesM: number
  /** The drawn top is this roof's own ridge (a view across the ridge draws the roof narrowing to it). */
  topOwn: boolean
  /** A height of the house's top from outside the silhouettes (the ridge the read states as printed, the page's building height), metres. */
  topWitnessM?: number
  statedRidge?: { m: number; status: string }
  statedEaves?: { m: number; status: string }
}
/**
 * massing 1.11.0 — pitch, eaves and ridge of ONE roof agreed again over its FINAL span. `ridge = eaves + half·tan(pitch)`
 * always holds for what is built; the question is which two of the three are held and which follows:
 *  - the built pitch is within a roof's range and agrees with the stated one (or none is stated): nothing changes;
 *  - else, with a stated pitch: where the eaves are only a lower bound and the top is this roof's own, the EAVES follow
 *    from the ridge (a cross gable's walls stand higher than the eaves line of the roof beside it); where the top is not
 *    this roof's own (a band drawn over a narrow body is the roof behind it), the RIDGE follows from the eaves; where
 *    both are held and the pitch is a roof's, the drawing stands and the stated pitch is kept as a conflict — with the
 *    span the stated numbers WOULD close over, which says whether this rectangle is that roof's at all;
 *  - a pitch outside a roof's range is never built and never clipped to the limit: the heights and the span are not one
 *    roof's, and the ridge follows from the eaves at the stated pitch, by name.
 */
export function settleRoof(roof: RoofSpec, rect: Rect, w: SettleInput): { roof: RoofSpec; notes: string[]; fates: PropertyFate[] } {
  const notes: string[] = []
  const fates: PropertyFate[] = []
  if (roof.kind === 'FLAT' || roof.ridgeM === undefined) return { roof, notes, fates }
  const R = ROOF_SYSTEM_TOLERANCES
  const axis = roof.ridgeAxis ?? 'X'
  const half = (axis === 'X' ? rect.maxZ - rect.minZ : rect.maxX - rect.minX) / 2
  const length = axis === 'X' ? rect.maxX - rect.minX : rect.maxZ - rect.minZ
  const degOf = (e: number, r: number): number => (Math.atan2(r - e, half) * 180) / Math.PI
  let [eaves, ridge] = [roof.eavesM, roof.ridgeM]
  const was = degOf(eaves, ridge)
  const P = w.pitch
  const tanP = P ? Math.tan((P.deg * Math.PI) / 180) : 0
  const inRange = (d: number): boolean => d >= R.minPitchDeg && d <= R.maxPitchDeg
  const off = P !== undefined && P.binding && Math.abs(was - P.deg) > PITCH_AGREE_DEG
  const t = MINIATURE_CONVENTIONS.roofThicknessM
  if (P && (off || !inRange(was))) {
    const eavesFromRidge = ridge - half * tanP
    const ridgeFromEaves = eaves + half * tanP
    const wallUnder = eavesFromRidge - t / Math.cos((P.deg * Math.PI) / 180)
    // the ridge is held where something outside the silhouettes puts the house's top there too
    const ridgeHeld = w.topWitnessM !== undefined && Math.abs(ridge - w.topWitnessM) <= Math.max(0.6, 0.1 * w.topWitnessM)
    if (!w.eavesHeld && w.topOwn && ridgeHeld && wallUnder >= w.drawnEavesM - Math.max(MASSING_TOLERANCES.heightAgreeM, MASSING_TOLERANCES.heightAgreeShare * w.drawnEavesM) && wallUnder >= STOREY_WALLS.oneMinM && ridge - eavesFromRidge >= MASSING_TOLERANCES.flatRiseM) {
      notes.push(`${was.toFixed(1)}° over the ${(2 * half).toFixed(2)} m span it now has against ${P.deg}° (${P.from}): the ridge at ${ridge.toFixed(2)} m is this roof's own (a view across it draws the roof narrowing to it; ${w.topWitnessM} m is stated for the house's top from outside the silhouettes) and its eaves were only a lower bound (${w.drawnEavesM.toFixed(2)} m, the lowest edge drawn there) — the eaves follow from the ridge: ${eavesFromRidge.toFixed(2)} m, the walls under them to ${wallUnder.toFixed(2)} m`)
      fates.push({ property: 'pitchDeg', fate: 'APPLIED', taken: `${P.deg}° (${P.from})`, built: `${P.deg.toFixed(1)}°`, residual: 0, why: 'the eaves were derived from the drawn ridge at this pitch' })
      eaves = eavesFromRidge
    } else if (!w.topOwn || !inRange(was)) {
      notes.push(`${was.toFixed(1)}° over the ${(2 * half).toFixed(2)} m span it now has${inRange(was) ? ` against ${P.deg}° (${P.from})` : ` — outside ${R.minPitchDeg}–${R.maxPitchDeg}°: these heights and this span are not one roof's`}: ${w.topOwn ? 'the heights were read over another span' : 'no view across the ridge draws this roof narrowing to the top drawn over it (it is the roof behind it)'} — the ridge follows from this body's own eaves at ${P.deg}° (${P.from}): ${ridgeFromEaves.toFixed(2)} m, not ${ridge.toFixed(2)} m`)
      fates.push({ property: 'pitchDeg', fate: 'APPLIED', taken: `${P.deg}° (${P.from})`, built: `${P.deg.toFixed(1)}°`, residual: 0, why: 'the ridge was derived from the eaves at this pitch' }, { property: 'ridgeM', fate: 'REJECTED', taken: `${ridge.toFixed(2)} m (the top drawn over this body)`, built: `${ridgeFromEaves.toFixed(2)} m`, residual: r6(ridgeFromEaves - ridge), why: w.topOwn ? 'with this span the drawn heights make no roof' : 'the drawn top is not this roof\'s own' })
      ridge = ridgeFromEaves
    } else {
      const closes = (ridge - eaves) / Math.max(1e-6, tanP)
      fates.push({ property: 'pitchDeg', fate: 'RETAINED_WITH_CONFLICT', taken: `${P.deg}° (${P.from})`, built: `${was.toFixed(1)}°`, residual: r6(was - P.deg), why: `the eaves (${eaves.toFixed(2)} m) and the ridge (${ridge.toFixed(2)} m) are both drawn and held; at ${P.deg}° they would close over a ${(2 * closes).toFixed(2)} m span, this body's is ${(2 * half).toFixed(2)} m — the stated pitch is of another span (or this rectangle is not that roof's)` })
    }
  } else if (!inRange(was)) {
    fates.push({ property: 'pitchDeg', fate: 'UNRESOLVED', built: `${was.toFixed(1)}°`, why: `${was.toFixed(1)}° is outside ${R.minPitchDeg}–${R.maxPitchDeg}° and no pitch is stated for this roof from outside its silhouettes` })
  } else if (P?.binding) fates.push(Math.abs(was - P.deg) <= PITCH_SAME_DEG ? { property: 'pitchDeg', fate: 'APPLIED', taken: `${P.deg}° (${P.from})`, built: `${was.toFixed(1)}°`, residual: r6(was - P.deg), why: `the built pitch is the stated one within ${PITCH_SAME_DEG}°` } : { property: 'pitchDeg', fate: 'RETAINED_WITH_CONFLICT', taken: `${P.deg}° (${P.from})`, built: `${was.toFixed(1)}°`, residual: r6(was - P.deg), why: `the drawn heights give ${was.toFixed(1)}°; within ${PITCH_AGREE_DEG}° of the stated pitch nothing is moved (the difference is within what a registration reads), and it is kept on the record` })
  const tolH = (v: number): number => Math.max(MASSING_TOLERANCES.heightAgreeM, MASSING_TOLERANCES.heightAgreeShare * v)
  if (w.statedRidge) { const d = ridge - w.statedRidge.m; fates.push({ property: 'ridgeM', fate: Math.abs(d) <= tolH(ridge) ? 'APPLIED' : 'RETAINED_WITH_CONFLICT', taken: `${w.statedRidge.m} m (${w.statedRidge.status}, above the floor)`, built: `${ridge.toFixed(2)} m`, residual: r6(d), why: Math.abs(d) <= tolH(ridge) ? 'the drawn ridge agrees with the stated one' : 'the ridge is the one the registered elevations draw; the stated one differs (its datum or its roof may be another)' }) }
  if (w.statedEaves) { const wallTop = eaves - t / Math.cos(Math.atan2(ridge - eaves, half)); const d = wallTop - w.statedEaves.m; fates.push({ property: 'eavesM', fate: Math.abs(d) <= tolH(wallTop) ? 'APPLIED' : 'RETAINED_WITH_CONFLICT', taken: `${w.statedEaves.m} m (${w.statedEaves.status}, top of the walls above the floor)`, built: `${wallTop.toFixed(2)} m`, residual: r6(d), why: Math.abs(d) <= tolH(wallTop) ? 'the built wall top agrees with the stated one' : 'the wall top is the one the registered elevations draw; the stated one differs' }) }
  const pitchDeg = Math.round(degOf(eaves, ridge) * 10) / 10
  if (eaves === roof.eavesM && ridge === roof.ridgeM && pitchDeg === roof.pitchDeg) return { roof, notes, fates }
  const next: RoofSpec = { ...roof, pitchDeg, eavesM: r6(eaves), ridgeM: r6(ridge), ...(roof.kind === 'HIP' ? { hipRunM: r6(Math.min(roof.hipRunM ?? half, length / 2)) } : {}) }
  // a stale pitch (the heights kept, the span changed) is corrected without a note of its own: the pitch always follows the heights
  return { roof: next, notes, fates }
}
/**
 * massing 1.11.0: a roof region that is NOT the roof of a rectangle of walls — a cross gable standing on a body's own
 * walls, a second ridge across its roof. The outline has no step under it; the roof has. It has its own identity
 * (`roof-<body>-cross-<side>`), its own extent, its own heights and pitch, and is hosted by the body it stands on.
 */
export type CrossRoofSpec = { id: string; over: string; side: Side; rect: Rect; ridgeAxis: 'X' | 'Z'; eavesM: number; ridgeM: number; pitchDeg: number; provenance: Prov }
export type MassingStatus = 'BUILDABLE' | 'INSUFFICIENT' | 'UNSUPPORTED_FORM'
export type MassingHypothesis = {
  version: string
  status: MassingStatus
  bodies: BodySpec[]
  /** The registrations made from the plan (one per elevation that could be registered), usable by the executor. */
  views: BindView[]
  /** Other readings kept beside the chosen one (an L split the elevations did not decide, a roof axis two views dispute). */
  alternatives: string[]
  /** Anchors without which the mass is not built (or a part of it is not): named, never filled in. */
  missing: Array<{ anchor: string; why: string }>
  /** What each elevation was used for, or why not. */
  views_used: Array<{ side: Side; frameId: string; used: boolean; why: string }>
  wallThicknessM: number
  /**
   * massing 1.4.0: the side of the PLAN SHEET that is the body's front (absent: the plan's foot, as the plan convention
   * has it). Where the elevations are drawn a quarter turn from the plan's sides, the body is built in the SOURCE's frame
   * — the model's own frame says "the front facade outer face is z = 0" — and the plan sheet is then turned against it.
   */
  planFront?: Side
  /** massing 1.11.0: roof regions that are not a body's own roof (cross gables), each hosted by a body of `bodies`. */
  crossRoofs?: CrossRoofSpec[]
  /** massing 1.11.0: pairs of bodies whose roofs the source shows apart (a wall between them): never joined in a valley. */
  separateRoofs?: Array<[string, string]>
  why: string
}

/** Fixed before any result: the miniature's tolerances, from the drawings' resolution and the purpose of a recognisable mass. */
export const MASSING_TOLERANCES = {
  /** Two elevations agree on a height within this (metres), or this share of it. */
  heightAgreeM: 0.35,
  heightAgreeShare: 0.08,
  /** massing 1.7.0: the elevations' step between two bodies in line is moved onto a wall the plan draws across the body within this (metres). */
  stepSnapM: 1.25,
  /** A roof rising less than this above its eaves is flat. */
  flatRiseM: 0.4,
  /** A lower body's roof is not steeper than this (degrees): a steeper reading is the roof of the body behind it (massing 1.7.0). */
  maxOwnPitchDeg: 60,
  /** Width at the top of a roof surface over its width at the eaves: a triangle (a gable end) below, a band (slopes) above. */
  triangleBelow: 0.35,
  bandAbove: 0.6,
  /** A storey this low or a body this narrow is not a body. */
  minBodyM: 2.0,
  /** Below this share of an outline's area a rectangle is an offset in the line, not a second body. */
  minWingShare: 0.12,
  /** A hip's ridge end stands at least this far in from the end wall (metres); nearer, the drawn top is a gable's. */
  minHipRunM: 0.5,
  /** A roof whose slopes run on to a level top at least this long (metres, and this share of the stretch) has a ridge there: not a gable end's point. */
  minRidgeM: 1.0,
  minRidgeShare: 0.1,
  /** Two bodies in line under different roofs: the drawn top jumps at least this much (metres) at one place, on two opposite views. */
  stepM: 1.2,
  /** …and the two views put that place within this (metres) of each other. */
  stepAgreeM: 0.8,
} as const
/** The furthest a drawn roof edge is taken to overhang its wall (metres): beyond it the edge is another body's. */
export const MAX_OVERHANG_M = 1.0
/** Conventions of the miniature, named where they are used (never presented as read). */
export const MINIATURE_CONVENTIONS = { wallThicknessM: 0.3, parapetM: 0.3, flatRoofThicknessM: 0.2, roofThicknessM: 0.25, roofMaterialId: 'mat-roof', roofColor: '#5a5550' } as const
/**
 * v3.54.18 (massing 1.1.0): the miniature's palette on a body built without LOCAL — the ids and default tones the drawings'
 * solver gives its own models, so an opening placed on such a body has glass, a door a leaf, a wall a render. NONE of these
 * tones is read from the source here (finish zones are, later, through SET_FINISH): a named convention, DISPLAY_ASSUMPTION.
 */
export const MINIATURE_PALETTE = [
  { id: 'mat-wall', name: 'Rendered wall (tone not read: miniature convention)', color: '#e8e4dc' },
  { id: 'mat-roof', name: 'Roof covering (tone not read: miniature convention)', color: '#5a5550' },
  { id: 'mat-glass', name: 'Glazing', color: '#9fc3d8', opacity: 0.35 },
  { id: 'mat-timber', name: 'Timber (door leaf, cladding)', color: '#b07a4a' },
  { id: 'mat-gate', name: 'Garage door', color: '#55585c' },
  { id: 'mat-chimney', name: 'Chimney', color: '#6d6a66' },
] as const

const r6 = (v: number): number => Math.round(v * 1e6) / 1e6
const along = (s: Side): 'x' | 'z' => (s === 'FRONT' || s === 'REAR' ? 'x' : 'z')
const signOf = (s: Side): 1 | -1 => (s === 'FRONT' || s === 'RIGHT' ? 1 : -1)
const pxRange = (polys: readonly Poly[]): { x0: number; x1: number } | undefined => {
  const xs = polys.flatMap((p) => p.map((q) => q[0]))
  return xs.length > 0 ? { x0: Math.min(...xs), x1: Math.max(...xs) } : undefined
}

export function rectOfOutline(outline: ReadonlyArray<{ x: number; z: number }>): Rect {
  return { minX: Math.min(...outline.map((p) => p.x)), maxX: Math.max(...outline.map((p) => p.x)), minZ: Math.min(...outline.map((p) => p.z)), maxZ: Math.max(...outline.map((p) => p.z)) }
}
export const area = (r: Rect): number => (r.maxX - r.minX) * (r.maxZ - r.minZ)
export const extentOn = (r: Rect, s: Side): { lo: number; hi: number } => (along(s) === 'x' ? { lo: r.minX, hi: r.maxX } : { lo: r.minZ, hi: r.maxZ })
/**
 * v3.54.17 R2 (audit §5): the stretches of a body on one side that no other body covers — where what is drawn there can
 * only be that body (in front of or behind another, a body's columns show the other's walls and roof). A body whose
 * stretch is wholly shared on a side is not read on that side: hidden, or not told apart, it is named, never measured.
 */
export function exclusiveStretches(rect: Rect, others: readonly Rect[], s: Side): Array<{ lo: number; hi: number }> {
  const e = extentOn(rect, s)
  let free: Array<{ lo: number; hi: number }> = [e]
  for (const o of others) {
    const c = extentOn(o, s)
    free = free.flatMap((f) => (c.hi <= f.lo + 1e-6 || c.lo >= f.hi - 1e-6 ? [f] : [...(c.lo > f.lo ? [{ lo: f.lo, hi: c.lo }] : []), ...(c.hi < f.hi ? [{ lo: c.hi, hi: f.hi }] : [])]))
  }
  return free.filter((f) => f.hi - f.lo > 1e-6)
}
/** The longest exclusive stretch, when it is long enough to read a roof over (≥ 1 m and ≥ a quarter of the body's stretch), 5 % in from its ends. */
export function readableStretch(rect: Rect, others: readonly Rect[], s: Side): { lo: number; hi: number } | undefined {
  const e = extentOn(rect, s)
  const best = exclusiveStretches(rect, others, s).sort((a, b) => b.hi - b.lo - (a.hi - a.lo))[0]
  if (!best || best.hi - best.lo < Math.max(1, 0.25 * (e.hi - e.lo))) return undefined
  // 5 % in from each end: the columns next to where another body's wall stands still catch its edge
  const inset = 0.05 * (best.hi - best.lo)
  return { lo: best.lo + inset, hi: best.hi - inset }
}

/**
 * massing 1.8.0 — the building's width on an elevation, in pixels. It is the walls' extent HALF-WAY UP THE STOREY (the row
 * midway between the ground row and the lowest roof edge), not the extent of everything drawn as wall: a stone plinth, a
 * terrace wall or a retaining wall runs on past the house at the ground, and taken into the width it put a 7.9 m gable
 * end over 825 px instead of 548 — every height of that view came out at two thirds, and a plain rectangular house had
 * its eaves "at 1.59 m: not a storey" and no model at all. Where no roof is drawn, or the walls are not drawn at that
 * row (or only a fragment of them is), the whole extent stands as before.
 */
export function wallEndsPx(walls: readonly Poly[], roofs: readonly Poly[], groundRow: number | null | undefined): { x0: number; x1: number } | undefined {
  const all = pxRange(walls)
  if (!all || groundRow === null || groundRow === undefined || !Number.isFinite(groundRow) || roofs.length === 0) return all
  const edges = roofs.flatMap((p) => p.map((q) => q[1])).filter((y) => y < groundRow - 4)
  if (edges.length === 0) return all
  const row = (groundRow + Math.max(...edges)) / 2
  const e = rowExtent(walls, row)
  if (!e || e[1] - e[0] < WALL_ENDS_MIN_SHARE * (all.x1 - all.x0)) return all
  return { x0: e[0], x1: e[1] }
}
export const WALL_ENDS_MIN_SHARE = 0.4

/**
 * 1. An elevation registered by the plan: its building's width in pixels against the outline's extent along that side.
 * The vertical scale is the horizontal one (isotropic drawing, DISPLAY_ASSUMPTION until two sides agree on a height).
 */
export function registerByPlan(obs: SilhouetteObservation, extent: { lo: number; hi: number }): { view: BindView; why: string } | { refused: string } {
  const px = obs.walls.length > 0 ? wallEndsPx(obs.walls, obs.roofs, obs.groundRow) : pxRange(obs.silhouette ? [obs.silhouette] : [])
  if (!px || px.x1 - px.x0 < 20) return { refused: `the ${obs.side.toLowerCase()} elevation draws no building width to register` }
  if (obs.groundRow === null || !Number.isFinite(obs.groundRow)) return { refused: `the ${obs.side.toLowerCase()} elevation names no ground row` }
  const span = extent.hi - extent.lo
  if (!(span > MASSING_TOLERANCES.minBodyM)) return { refused: `the outline is ${span.toFixed(2)} m along the ${obs.side.toLowerCase()} side` }
  const mpp = span / (px.x1 - px.x0)
  const sign = signOf(obs.side)
  const alongAtPx0 = sign === 1 ? extent.lo - mpp * px.x0 : extent.hi + mpp * px.x0
  const projection: Projection = { mpp: r6(mpp), alongAtPx0: r6(alongAtPx0), alongSign: sign, zeroRow: obs.groundRow }
  return { view: { side: obs.side, frameId: obs.frameId, projection, heights: true, origin: 'ASSIGNED', alongErrorM: r6(Math.max(0.05, 3 * mpp)), heightErrorM: r6(Math.max(0.1, 4 * mpp)) }, why: `${(px.x1 - px.x0).toFixed(0)} px of building against ${span.toFixed(2)} m of plan: ${(mpp * 100).toFixed(2)} cm/px, vertical the same (isotropic drawing), ground row ${obs.groundRow}` }
}

const pxOfAlong = (p: Projection, a: number): number => (a - p.alongAtPx0) / (p.alongSign * p.mpp)
const yOfRow = (p: Projection, row: number): number => (p.zeroRow - row) * (p.mppV ?? p.mpp)

/** A polygon's covered rows on one pixel column (its lowest and highest edge crossings), or undefined off it. */
export function columnRange(poly: Poly, x: number): [number, number] | undefined {
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i < poly.length; i += 1) {
    const [ax, ay] = poly[i]
    const [bx, by] = poly[(i + 1) % poly.length]
    if ((ax - x) * (bx - x) > 0 || ax === bx) {
      if (ax === bx && Math.abs(ax - x) < 0.5) { lo = Math.min(lo, ay, by); hi = Math.max(hi, ay, by) }
      continue
    }
    const y = ay + ((by - ay) * (x - ax)) / (bx - ax)
    lo = Math.min(lo, y)
    hi = Math.max(hi, y)
  }
  return hi >= lo ? [lo, hi] : undefined
}
const COLUMNS = 48

/**
 * The part of one elevation over one body's stretch of its side: top, eaves and the roof's shape, read column by column
 * inside the stretch. `own` are the polygons attributed to this body on this side (see `attribute`).
 */
export type RoofProfile = {
  topM: number
  eavesM: number
  shape: 'TRIANGLE' | 'BAND' | 'TRAPEZOID' | 'NONE'
  why: string
  /** massing 1.3.0: the drawn top's two ends along the side (metres, the slopes run on to the top row), where a roof is drawn. */
  ridge?: { lo: number; hi: number }
  /** The drawn roof's two ends at its lowest edge along the side (metres): past the walls by the overhang. */
  drawn?: { lo: number; hi: number }
  /** The roof is drawn as its edge only (a verge seen from the gable end), not as a surface. */
  hollow?: boolean
}
/**
 * massing 1.4.0: a plan outline turned so that the side of the sheet the front elevation draws (`front`: the sheet's LEFT
 * or RIGHT) becomes the front (z = 0), a rigid quarter turn — never a mirror: facing the sheet's left side, the sheet's
 * foot is on the right hand; facing its right side, the sheet's head is.
 */
export function outlineWithFront(outline: ReadonlyArray<{ x: number; z: number }>, front: Side): Array<{ x: number; z: number }> {
  return outline.map((p) => pointWithFront(p, front, outline))
}
/** massing 1.6.0: one point of the plan's frame turned with its outline (the same rigid turn, about the outline's own box — the point may lie outside it). */
export function pointWithFront(p: { x: number; z: number }, front: Side, outline: ReadonlyArray<{ x: number; z: number }>): { x: number; z: number } {
  const [minX, maxX, minZ, maxZ] = [Math.min(...outline.map((q) => q.x)), Math.max(...outline.map((q) => q.x)), Math.min(...outline.map((q) => q.z)), Math.max(...outline.map((q) => q.z))]
  const r = (v: number): number => Math.round(v * 1e4) / 1e4
  if (front === 'LEFT') return { x: r(maxZ - p.z), z: r(p.x - minX) }
  if (front === 'RIGHT') return { x: r(p.z - minZ), z: r(maxX - p.x) }
  if (front === 'REAR') return { x: r(maxX - p.x), z: r(maxZ - p.z) }
  return { x: p.x, z: p.z }
}
/** The stretch a set of polygons spans on one pixel row (leftmost to rightmost edge crossing), or none. */
export function rowExtent(polys: readonly Poly[], row: number): [number, number] | undefined {
  let lo = Infinity
  let hi = -Infinity
  for (const poly of polys) {
    for (let i = 0; i < poly.length; i += 1) {
      const [ax, ay] = poly[i]
      const [bx, by] = poly[(i + 1) % poly.length]
      if (ay === by || (ay - row) * (by - row) > 0) continue
      const x = ax + ((bx - ax) * (row - ay)) / (by - ay)
      lo = Math.min(lo, x)
      hi = Math.max(hi, x)
    }
  }
  return hi >= lo ? [lo, hi] : undefined
}
export function profileOver(view: BindView, a0: number, a1: number, own: { walls: Poly[]; roofs: Poly[] }): RoofProfile | undefined {
  const p = view.projection
  const xs = [pxOfAlong(p, a0), pxOfAlong(p, a1)]
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const cols = Array.from({ length: COLUMNS }, (_, i) => x0 + ((i + 0.5) * (x1 - x0)) / COLUMNS)
  const cover = (polys: readonly Poly[], x: number): [number, number] | undefined => {
    let r: [number, number] | undefined
    for (const poly of polys) {
      const c = columnRange(poly, x)
      if (c) r = r ? [Math.min(r[0], c[0]), Math.max(r[1], c[1])] : c
    }
    return r
  }
  const roofCols = cols.map((x) => cover(own.roofs, x))
  const wallCols = cols.map((x) => cover(own.walls, x))
  const roofed = roofCols.filter((c): c is [number, number] => !!c)
  const walled = wallCols.filter((c): c is [number, number] => !!c)
  if (walled.length < COLUMNS / 3 && roofed.length < COLUMNS / 3) return undefined
  if (roofed.length < COLUMNS / 3) {
    const top = Math.min(...walled.map((c) => c[0]))
    return { topM: yOfRow(p, top), eavesM: yOfRow(p, top), shape: 'NONE', why: `no roof surface drawn over this stretch: the walls' top (row ${top.toFixed(0)}) is the top` }
  }
  // the top: the highest sampled column — and (massing 1.3.0) the roof's own corners inside the stretch, so an apex that
  // falls between two columns is not read half a column's fall too low
  const topRow = Math.min(...roofed.map((c) => c[0]), ...own.roofs.flatMap((poly) => poly.filter((q) => q[0] >= x0 && q[0] <= x1).map((q) => q[1])))
  const eavesRow = Math.max(...roofed.map((c) => c[1]))
  const h = eavesRow - topRow
  const share = (row: number): number => roofCols.filter((c) => !!c && c[0] <= row && c[1] >= row).length
  // massing 1.3.0: a gable end is often drawn as its verge alone — two bars meeting at the ridge, no surface between
  // them. Counted as covered columns, such a roof has almost none near its eaves and its "width ratio" is that of a band
  // (three houses' gable ends were read as slopes, and the ridge direction then fell to a tie or to the wrong side).
  // Where the roof is hollow at its foot, its width on a row is its outline's (leftmost to rightmost crossing) instead.
  const hollow = h >= 2 && share(eavesRow - 0.1 * h) < 0.5 * roofed.length
  const widthAt = (row: number): number => {
    const e = rowExtent(own.roofs, row)
    return e ? Math.max(0, Math.min(x1, e[1]) - Math.max(x0, e[0])) : 0
  }
  const ratio = hollow ? widthAt(topRow + 0.1 * h) / Math.max(1, widthAt(eavesRow - 0.1 * h), widthAt(eavesRow - 0.3 * h)) : share(topRow + 0.1 * h) / Math.max(1, share(eavesRow - 0.1 * h))
  const byRatio = h < 2 ? 'BAND' : ratio < MASSING_TOLERANCES.triangleBelow ? 'TRIANGLE' : ratio > MASSING_TOLERANCES.bandAbove ? 'BAND' : 'TRAPEZOID'
  // the drawn top's ends: the outline's crossings a tenth and three tenths of the way down, run on to the top row (the
  // surfaces that reach the top only — a porch roof lower down is not the ridge's)
  const upper = own.roofs.filter((poly) => Math.min(...poly.map((q) => q[1])) <= topRow + 0.15 * h)
  const [e1, e3] = [rowExtent(upper, topRow + 0.1 * h), rowExtent(upper, topRow + 0.3 * h)]
  const alongOf = (x: number): number => p.alongAtPx0 + p.alongSign * p.mpp * x
  const span = (c0: number, c1: number): { lo: number; hi: number } => ({ lo: Math.min(alongOf(c0), alongOf(c1)), hi: Math.max(alongOf(c0), alongOf(c1)) })
  const ridge = h >= 2 && e1 && e3 ? span(Math.min(e1[0] + 0.5 * (e1[0] - e3[0]), (e1[0] + e1[1]) / 2), Math.max(e1[1] + 0.5 * (e1[1] - e3[1]), (e1[0] + e1[1]) / 2)) : undefined
  // a triangle comes to a point. Where the two slopes run on to a LEVEL top of some length instead — a metre or more and
  // a tenth of the stretch — the roof is a hip with a short ridge, however narrow that top is against the eaves (a garage
  // whose ridge is a fifth of its length was a "triangle" by the width ratio, and its hip was asked for on the wrong view)
  const ridgeLen = ridge ? Math.min(ridge.hi, Math.max(a0, a1)) - Math.max(ridge.lo, Math.min(a0, a1)) : 0
  const shape = byRatio === 'TRIANGLE' && ridgeLen >= Math.max(MASSING_TOLERANCES.minRidgeM, MASSING_TOLERANCES.minRidgeShare * Math.abs(a1 - a0)) ? 'TRAPEZOID' : byRatio
  const xsAll = upper.flatMap((poly) => poly.map((q) => q[0]))
  const drawn = xsAll.length > 0 ? span(Math.min(...xsAll), Math.max(...xsAll)) : undefined
  return { topM: yOfRow(p, topRow), eavesM: yOfRow(p, eavesRow), shape, why: `roof ${shape.toLowerCase()} from row ${topRow.toFixed(0)} to ${eavesRow.toFixed(0)} (width ratio ${ratio.toFixed(2)}${shape !== byRatio ? `, a level top ${ridgeLen.toFixed(2)} m long` : ''}${hollow ? ', drawn as its edge only: the outline\'s width' : ''})`, ...(ridge ? { ridge } : {}), ...(drawn ? { drawn } : {}), ...(hollow ? { hollow } : {}) }
}

/**
 * v3.54.18: the top of the drawn walls at a body's two outer corners, in metres — the wall plate under the soffit, the ONE
 * line every view of a body shares (an eaves view and a gable view alike end their wall zone there). The roof's own lowest
 * edge is not that line: it is the fascia, lower by the overhang's fall, or a porch roof carried lower still. Undefined
 * when the reading draws no wall corner within 3 % of the stretch at either end.
 */
export function wallCornerTopM(view: BindView, lo: number, hi: number, walls: readonly Poly[], groundRow: number | null): number | undefined {
  if (groundRow === null) return undefined
  const p = view.projection
  const px = [pxOfAlong(p, lo), pxOfAlong(p, hi)]
  const [c0, c1] = [Math.min(...px), Math.max(...px)]
  const near = Math.max(2, 0.03 * (c1 - c0))
  const corner = (cx: number): number | undefined => {
    const ys = walls.flatMap((poly) => poly.filter((q) => Math.abs(q[0] - cx) <= near && q[1] < groundRow - 2).map((q) => q[1]))
    return ys.length > 0 ? Math.min(...ys) : undefined
  }
  const [k0, k1] = [corner(c0), corner(c1)]
  return k0 !== undefined && k1 !== undefined ? (yOfRow(p, k0) + yOfRow(p, k1)) / 2 : undefined
}

/**
 * Which drawn polygons belong to which body on one side. Bodies side by side on this side (disjoint stretches) share a
 * polygon that spans both, each reading its own columns of it; bodies one in front of the other (overlapping stretches)
 * take each polygon whole, by the stretch it matches best (intersection over union) — so a low wing in front never
 * inherits the taller roof behind it.
 */
function attribute(obs: SilhouetteObservation, view: BindView, stretches: ReadonlyArray<{ lo: number; hi: number }>): Array<{ walls: Poly[]; roofs: Poly[] }> {
  const p = view.projection
  const px = stretches.map((s) => {
    const a = pxOfAlong(p, s.lo)
    const b = pxOfAlong(p, s.hi)
    return { x0: Math.min(a, b), x1: Math.max(a, b) }
  })
  const overlapping = px.some((a, i) => px.some((b, j) => j > i && Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0.05 * Math.min(a.x1 - a.x0, b.x1 - b.x0)))
  const out = px.map(() => ({ walls: [] as Poly[], roofs: [] as Poly[] }))
  for (const [key, polys] of [['walls', obs.walls], ['roofs', obs.roofs]] as const) for (const poly of polys) {
    const r = pxRange([poly])
    if (!r) continue
    const inter = px.map((s) => Math.max(0, Math.min(s.x1, r.x1) - Math.max(s.x0, r.x0)))
    if (!overlapping) {
      px.forEach((s, i) => { if (inter[i] > 0.1 * (s.x1 - s.x0)) out[i][key].push(poly) })
      continue
    }
    const iou = px.map((s, i) => inter[i] / (Math.max(s.x1, r.x1) - Math.min(s.x0, r.x0)))
    const best = iou.indexOf(Math.max(...iou))
    if (iou[best] > 0.3) out[best][key].push(poly)
  }
  return out
}

/**
 * v3.54.18 (massing 1.1.0): an orthogonal outline with more corners than a rectangle or an L, reduced step by step — a
 * named MINIATURE CONVENTION, never a measured outline. Each reduction removes the cheapest step (an edge is slid until
 * the shorter of its two neighbours is gone; the area between is added or cut), as long as that single step is at most
 * `stepShare` of the bounding rectangle's area and all of them together at most `totalShare`. A terrace notch, a bay,
 * an entrance recess under the same roof go; a third wing of real size does not (the outline stays unsupported, by name).
 */
export const OUTLINE_SIMPLIFICATION = { stepShare: 0.06, totalShare: 0.12, corners: 6 } as const
export function simplifyOutline(outline: ReadonlyArray<{ x: number; z: number }>, /** massing 1.8.0: take out every step that is small enough and stop there, whatever number of corners is left */ partial = false): { outline: Array<{ x: number; z: number }>; steps: Array<{ areaM2: number; at: { x: number; z: number } }>; changedM2: number; share: number } | undefined {
  const clean = (v: Array<{ x: number; z: number }>): Array<{ x: number; z: number }> => {
    let pts = v.filter((p, i) => Math.hypot(p.x - v[(i + 1) % v.length].x, p.z - v[(i + 1) % v.length].z) > 1e-6)
    for (let changed = true; changed && pts.length > 4; ) {
      changed = false
      for (let i = 0; i < pts.length; i += 1) {
        const a = pts[(i + pts.length - 1) % pts.length]
        const b = pts[(i + 1) % pts.length]
        const q = pts[i]
        if ((Math.abs(a.x - q.x) < 1e-6 && Math.abs(b.x - q.x) < 1e-6) || (Math.abs(a.z - q.z) < 1e-6 && Math.abs(b.z - q.z) < 1e-6)) {
          pts = pts.filter((_, k) => k !== i)
          changed = true
          break
        }
      }
    }
    return pts
  }
  let pts = clean(outline.map((p) => ({ x: p.x, z: p.z })))
  const orth = (v: Array<{ x: number; z: number }>): boolean => v.every((p, i) => { const n = v[(i + 1) % v.length]; return Math.abs(p.x - n.x) < 1e-6 || Math.abs(p.z - n.z) < 1e-6 })
  if (pts.length <= OUTLINE_SIMPLIFICATION.corners || !orth(pts)) return undefined
  const bb = rectOfOutline(pts)
  const total = (bb.maxX - bb.minX) * (bb.maxZ - bb.minZ)
  const steps: Array<{ areaM2: number; at: { x: number; z: number } }> = []
  let changed = 0
  while (pts.length > OUTLINE_SIMPLIFICATION.corners) {
    const n = pts.length
    let best: { cost: number; next: Array<{ x: number; z: number }>; at: { x: number; z: number } } | undefined
    for (let i = 0; i < n; i += 1) {
      // edge e = pts[i] → pts[i+1]; its neighbours p = pts[i-1] → pts[i] and q = pts[i+1] → pts[i+2]
      const [p0, e0, e1, q1] = [pts[(i + n - 1) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]]
      const eLen = Math.hypot(e1.x - e0.x, e1.z - e0.z)
      for (const side of ['p', 'q'] as const) {
        // slide e along the neighbour being removed, by that neighbour's whole length
        const d = side === 'p' ? { x: p0.x - e0.x, z: p0.z - e0.z } : { x: q1.x - e1.x, z: q1.z - e1.z }
        const cost = eLen * Math.hypot(d.x, d.z)
        if (best && cost >= best.cost) continue
        const next = pts.map((v, k) => (k === i || k === (i + 1) % n ? { x: v.x + d.x, z: v.z + d.z } : v))
        best = { cost, next: clean(next), at: { x: r6((e0.x + e1.x) / 2), z: r6((e0.z + e1.z) / 2) } }
      }
    }
    if (!best || best.next.length >= pts.length || best.cost > OUTLINE_SIMPLIFICATION.stepShare * total || changed + best.cost > OUTLINE_SIMPLIFICATION.totalShare * total || !orth(best.next)) { if (partial) break; return undefined }
    changed += best.cost
    steps.push({ areaM2: r6(best.cost), at: best.at })
    pts = best.next
  }
  return { outline: pts.map((p) => ({ x: r6(p.x), z: r6(p.z) })), steps, changedM2: r6(changed), share: r6(changed / total) }
}

/**
 * massing 1.8.0 — an orthogonal outline as an EXACT partition into at most `max` rectangles: none overlapping, nothing of
 * the outline left over, the fewest rectangles possible (of two such partitions, the one with the larger main rectangle).
 * `wingsOf` takes the largest rectangle that fits inside first; on a house with a wing standing against the MIDDLE of
 * its side that rectangle is the band the two share, and what is left of the house above and below it is then "too
 * small to be a body" — a 15.6 × 9.65 m house was built 14.7 × 6.1 m. A partition has no such band: the wing is one
 * rectangle and the house the other. Undefined where no partition into `max` rectangles exists.
 */
export function partitionOf(outline: ReadonlyArray<{ x: number; z: number }>, max: number = WINGS.maxBodies, valid?: (r: Rect) => boolean): Rect[] | undefined {
  const uniq = (v: number[]): number[] => [...v].sort((a, b) => a - b).filter((q, i, w) => i === 0 || q - w[i - 1] > 1e-6)
  const xs = uniq(outline.map((p) => p.x))
  const zs = uniq(outline.map((p) => p.z))
  const [nx, nz] = [xs.length - 1, zs.length - 1]
  if (nx < 1 || nz < 1 || nx * nz > 400) return undefined
  const inside = (x: number, z: number): boolean => {
    let c = false
    for (let i = 0, j = outline.length - 1; i < outline.length; j = i, i += 1) {
      const [a, b] = [outline[i], outline[j]]
      if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) c = !c
    }
    return c
  }
  const cell = Array.from({ length: nx }, (_, i) => Array.from({ length: nz }, (_, j) => inside((xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2)))
  const used = cell.map((col) => col.map(() => false))
  let best: Rect[] | undefined
  // R2: a cover whose every rectangle is a body in its own right (`valid`) before one that leaves a sliver — the largest
  // rectangle first would slice a house and its wing across both and leave a strip; then the fewest, then the largest main
  const whole = (a: Rect[]): boolean => !valid || a.every(valid)
  const better = (a: Rect[], b: Rect[] | undefined): boolean => !b || (whole(a) !== whole(b) ? whole(a) : a.length < b.length || (a.length === b.length && Math.max(...a.map(area)) > Math.max(...b.map(area)) + 1e-9))
  const search = (acc: Rect[]): void => {
    // the first free cell, column by column: it is the low corner of the rectangle that covers it
    let fi = -1
    let fj = -1
    outer: for (let i = 0; i < nx; i += 1) for (let j = 0; j < nz; j += 1) if (cell[i][j] && !used[i][j]) { fi = i; fj = j; break outer }
    if (fi < 0) { if (better(acc, best)) best = acc.map((r) => ({ ...r })); return }
    if (acc.length >= max || (best && whole(best) && acc.length + 1 > best.length)) return
    let maxJ = nz
    for (let i = fi; i < nx; i += 1) {
      // how far up this column is free from fj
      let j = fj
      while (j < maxJ && cell[i][j] && !used[i][j]) j += 1
      if (j === fj) break
      maxJ = j
      for (let top = fj + 1; top <= maxJ; top += 1) {
        for (let a = fi; a <= i; a += 1) for (let b = fj; b < top; b += 1) used[a][b] = true
        search([...acc, { minX: xs[fi], maxX: xs[i + 1], minZ: zs[fj], maxZ: zs[top] }])
        for (let a = fi; a <= i; a += 1) for (let b = fj; b < top; b += 1) used[a][b] = false
      }
    }
  }
  search([])
  return best
}

/** 2. An orthogonal outline as one rectangle or two joined rectangles (both splits of an L). */
export function rectanglesOf(outline: ReadonlyArray<{ x: number; z: number }>): { splits: Rect[][]; why: string } {
  const pts = outline.filter((p, i) => {
    const a = outline[(i + outline.length - 1) % outline.length]
    const b = outline[(i + 1) % outline.length]
    return !((Math.abs(a.x - p.x) < 1e-6 && Math.abs(b.x - p.x) < 1e-6) || (Math.abs(a.z - p.z) < 1e-6 && Math.abs(b.z - p.z) < 1e-6))
  })
  const bb = rectOfOutline(pts)
  if (pts.length === 4) return { splits: [[bb]], why: 'a rectangle' }
  if (pts.length !== 6) return { splits: [], why: `an outline of ${pts.length} corners: beyond the supported scope (a rectangle or two joined bodies)` }
  // the L's notch: the bounding box's corner the outline does not reach; split along either line through the reflex vertex
  const inside = (x: number, z: number): boolean => {
    let c = false
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) if (pts[i].z > z !== pts[j].z > z && x < ((pts[j].x - pts[i].x) * (z - pts[i].z)) / (pts[j].z - pts[i].z) + pts[i].x) c = !c
    return c
  }
  const reflex = pts.find((p) => p.x > bb.minX + 1e-6 && p.x < bb.maxX - 1e-6 && p.z > bb.minZ + 1e-6 && p.z < bb.maxZ - 1e-6)
  if (!reflex) return { splits: [], why: 'an L whose inner corner could not be found' }
  const cut = (axis: 'x' | 'z'): Rect[] => {
    const parts = axis === 'x' ? [{ ...bb, maxX: reflex.x }, { ...bb, minX: reflex.x }] : [{ ...bb, maxZ: reflex.z }, { ...bb, minZ: reflex.z }]
    // each part, cut back to the outline: the side of the other line where the notch is, is outside
    return parts.map((r) => {
      const mx = (r.minX + r.maxX) / 2
      const mz = (r.minZ + r.maxZ) / 2
      if (inside(mx, mz) && inside(r.minX + 1e-3, r.minZ + 1e-3) && inside(r.maxX - 1e-3, r.maxZ - 1e-3) && inside(r.minX + 1e-3, r.maxZ - 1e-3) && inside(r.maxX - 1e-3, r.minZ + 1e-3)) return r
      return axis === 'x' ? (inside(mx, r.minZ + 1e-3) ? { ...r, maxZ: reflex.z } : { ...r, minZ: reflex.z }) : inside(r.minX + 1e-3, mz) ? { ...r, maxX: reflex.x } : { ...r, minX: reflex.x }
    })
  }
  return { splits: [cut('x'), cut('z')], why: 'an L: two joined rectangles, split at its inner corner either way' }
}

/**
 * massing 1.6.0: an orthogonal outline of ANY number of corners as bodies — the largest rectangle that fits inside it, then
 * the largest that fits in what is left, and so on (the corners' own columns and rows are the only lines a body can end
 * on). Until now an outline that was neither a rectangle nor an L, and could not be simplified into one by small steps,
 * was "beyond the supported form": a house with a garage wing AND a rear projection got no body at all. Each rectangle is
 * a body the elevations must then give a height and a roof; what no rectangle covers (a notch's rim, a bay narrower than
 * a body) is not modelled, by name and by area. Nothing is added to the outline: bodies only ever lie inside it.
 */
export const WINGS = { maxBodies: 4 } as const
export function wingsOf(outline: ReadonlyArray<{ x: number; z: number }>, minAreaM2: number, minSideM: number): { rects: Rect[]; coveredM2: number; outlineM2: number } | undefined {
  const orth = outline.every((p, i) => { const n = outline[(i + 1) % outline.length]; return Math.abs(p.x - n.x) < 1e-6 || Math.abs(p.z - n.z) < 1e-6 })
  if (!orth || outline.length < 4) return undefined
  const uniq = (v: number[]): number[] => [...new Set(v.map((q) => r6(q)))].sort((a, b) => a - b)
  const xs = uniq(outline.map((p) => p.x))
  const zs = uniq(outline.map((p) => p.z))
  const inside = (x: number, z: number): boolean => {
    let c = false
    for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) if (outline[i].z > z !== outline[j].z > z && x < ((outline[j].x - outline[i].x) * (z - outline[i].z)) / (outline[j].z - outline[i].z) + outline[i].x) c = !c
    return c
  }
  const [nx, nz] = [xs.length - 1, zs.length - 1]
  const free = Array.from({ length: nx }, (_, i) => Array.from({ length: nz }, (_, j) => inside((xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2)))
  let outlineM2 = 0
  for (let i = 0; i < nx; i += 1) for (let j = 0; j < nz; j += 1) if (free[i][j]) outlineM2 += (xs[i + 1] - xs[i]) * (zs[j + 1] - zs[j])
  const rects: Rect[] = []
  while (rects.length < WINGS.maxBodies) {
    let best: { i0: number; i1: number; j0: number; j1: number; a: number } | undefined
    for (let i0 = 0; i0 < nx; i0 += 1) for (let j0 = 0; j0 < nz; j0 += 1) for (let i1 = i0; i1 < nx; i1 += 1) {
      if (!free[i1][j0]) break
      for (let j1 = j0; j1 < nz; j1 += 1) {
        let ok = true
        for (let i = i0; i <= i1 && ok; i += 1) if (!free[i][j1]) ok = false
        if (!ok) break
        const a = (xs[i1 + 1] - xs[i0]) * (zs[j1 + 1] - zs[j0])
        if (!best || a > best.a + 1e-9) best = { i0, i1, j0, j1, a }
      }
    }
    if (!best) break
    const r: Rect = { minX: xs[best.i0], maxX: xs[best.i1 + 1], minZ: zs[best.j0], maxZ: zs[best.j1 + 1] }
    if (rects.length > 0 && (best.a < minAreaM2 || r.maxX - r.minX < minSideM || r.maxZ - r.minZ < minSideM)) break
    rects.push(r)
    for (let i = best.i0; i <= best.i1; i += 1) for (let j = best.j0; j <= best.j1; j += 1) free[i][j] = false
  }
  if (rects.length === 0) return undefined
  return { rects, coveredM2: r6(rects.reduce((t, q) => t + area(q), 0)), outlineM2: r6(outlineM2) }
}

export type MassingInput = { outline: OutlineObservation; silhouettes: readonly SilhouetteObservation[]; /** massing 1.9.0: the agreed structure (structure.ts) — the parts that are bodies of their own, the roof's kind and ridge, the storeys under the eaves */ structure?: BuildStructure; wallThicknessM?: { value: number; prov: Prov }; /** the roof pitch the page publishes (degrees): used only where no view shows the wall's corner under the roof, and only when the drawn walls allow it */ publishedPitchDeg?: number; /** massing 1.11.0: the building's height the page publishes (metres, from the ground): a witness of the house's top from outside the silhouettes */ publishedHeightM?: number; /** massing 1.7.0: the partitions the plan draws inside the outline, in the outline's own frame (metres): where two bodies in line meet */ planWalls?: ReadonlyArray<{ a: { x: number; z: number }; b: { x: number; z: number } }> }

/** A reported part is a body only where the outline steps out by at least this (metres): a garage holds a car between two walls; a 2 m slab of the main house's own wall line is not one. */
export const STRUCTURE_WING_MIN_M = 2.8
/**
 * massing 1.9.0: the rectangle that steps out of an orthogonal outline on one side — the outline's longest edge on that
 * side's extreme line, back to the nearer of the two corners its neighbours run in to — and the outline without it. Not a
 * wing when the edge is (nearly) the whole of that side (nothing steps out: two bodies in line are told apart by the
 * elevations) or the step is narrower than a body.
 */
export function wingOnSide(outline: ReadonlyArray<{ x: number; z: number }>, side: StructureSide, minM: number = STRUCTURE_WING_MIN_M): { rect: Rect; rest: Array<{ x: number; z: number }> } | undefined {
  const n = outline.length
  if (n < 6) return undefined
  const bb = rectOfOutline(outline)
  const ax: 'x' | 'z' = side === 'LEFT' || side === 'RIGHT' ? 'x' : 'z'
  const ot: 'x' | 'z' = ax === 'x' ? 'z' : 'x'
  const ext = side === 'LEFT' ? bb.minX : side === 'RIGHT' ? bb.maxX : side === 'FRONT' ? bb.minZ : bb.maxZ
  const inward = side === 'RIGHT' || side === 'REAR' ? -1 : 1
  let at = -1
  let len = 0
  for (let i = 0; i < n; i += 1) {
    const [a, b] = [outline[i], outline[(i + 1) % n]]
    if (Math.abs(a[ax] - ext) < 1e-6 && Math.abs(b[ax] - ext) < 1e-6 && Math.abs(a[ot] - b[ot]) > len) { at = i; len = Math.abs(a[ot] - b[ot]) }
  }
  if (at < 0) return undefined
  const [p, a, b, q] = [outline[(at - 1 + n) % n], outline[at], outline[(at + 1) % n], outline[(at + 2) % n]]
  if (Math.abs(p[ot] - a[ot]) > 1e-6 || Math.abs(q[ot] - b[ot]) > 1e-6) return undefined
  const depth = Math.min(Math.abs(p[ax] - ext), Math.abs(q[ax] - ext))
  const whole = ax === 'x' ? bb.maxZ - bb.minZ : bb.maxX - bb.minX
  if (depth < minM || len < minM || len > whole - 0.5) return undefined
  const inner = ext + inward * depth
  const [lo, hi] = [Math.min(a[ot], b[ot]), Math.max(a[ot], b[ot])]
  const rect: Rect = ax === 'x' ? { minX: Math.min(ext, inner), maxX: Math.max(ext, inner), minZ: lo, maxZ: hi } : { minX: lo, maxX: hi, minZ: Math.min(ext, inner), maxZ: Math.max(ext, inner) }
  const moved = outline.map((v, i) => (i === at || i === (at + 1) % n ? { ...v, [ax]: inner } : { ...v }))
  // drop repeated corners and corners on a straight run
  let rest = moved.filter((v, i) => { const u = moved[(i - 1 + moved.length) % moved.length]; return Math.abs(u.x - v.x) > 1e-6 || Math.abs(u.z - v.z) > 1e-6 })
  for (let changed = true; changed && rest.length > 4; ) {
    changed = false
    for (let i = 0; i < rest.length; i += 1) {
      const [u, v, t] = [rest[(i - 1 + rest.length) % rest.length], rest[i], rest[(i + 1) % rest.length]]
      if ((Math.abs(u.x - v.x) < 1e-6 && Math.abs(v.x - t.x) < 1e-6) || (Math.abs(u.z - v.z) < 1e-6 && Math.abs(v.z - t.z) < 1e-6)) { rest = rest.filter((_, k) => k !== i); changed = true; break }
    }
  }
  if (rest.length < 4) return undefined
  return { rect, rest }
}

/** Two full storeys of walls end no lower than this above the floor; one storey's no higher (the miniature's bounds of a storey, metres). */
export const STOREY_WALLS = { twoMinM: 4.4, oneMaxM: 4.6, oneMinM: 2.0 } as const

/**
 * massing 1.9.0: a body's roof as the silhouettes solved it, corrected by the agreed structure — each change named:
 *  - the KIND: a hip the silhouettes read as a gable (a hip seen from its short side IS a triangle) is built as a hip
 *    with one pitch all round (its ridge along the longer side; DISPLAY_ASSUMPTION: the hip run is half the span);
 *    a gable they read as a hip is built as a gable;
 *  - the RIDGE's direction of a gable, the heights kept (the pitch follows the new span);
 *  - the STOREYS: walls that end below two storeys under a roof reported over two full storeys (the silhouettes took a
 *    band, a canopy or a lower part's roof for the eaves) are raised to where the agreed pitch from the drawn ridge puts
 *    them, else to the eaves the read states as printed or derived; the same, downwards, for one storey.
 * A flat reading is left alone (no height to build a pitched roof from), and so is a pitched one the structure calls flat.
 */
export function roofByStructure(roof: RoofSpec, want: { kind?: 'GABLE' | 'HIP' | 'FLAT'; axis?: 'X' | 'Z'; full?: 1 | 2; pitchDeg?: number; eavesM?: { m: number; status: string }; /** the wall tops the elevations themselves draw for this body, one per view (metres) */ drawnTopsM?: readonly number[] }, rect: Rect): { roof: RoofSpec; notes: string[] } {
  const notes: string[] = []
  if (want.kind === 'FLAT') return { roof, notes }
  const t = MINIATURE_CONVENTIONS.roofThicknessM
  const [dx, dz] = [rect.maxX - rect.minX, rect.maxZ - rect.minZ]
  if (roof.kind === 'FLAT' || roof.ridgeM === undefined) {
    // the silhouettes found nothing rising above the walls (a gable wall sketched as a wall up to the ridge and no roof
    // surface told apart), the agreed structure reports a pitched roof: the drawn top is its ridge, and the walls end
    // where the agreed pitch from that ridge puts them — else where the read states the eaves as printed or derived
    if (roof.kind !== 'FLAT' || (want.kind !== 'GABLE' && want.kind !== 'HIP')) return { roof, notes }
    const axis0: 'X' | 'Z' = want.kind === 'HIP' ? (dx >= dz ? 'X' : 'Z') : want.axis ?? (dx >= dz ? 'X' : 'Z')
    const span0 = axis0 === 'X' ? dz : dx
    const ridge0 = roof.eavesM
    const top0 = (e: number): number => e - t / Math.cos(Math.atan2(Math.max(0.01, ridge0 - e), span0 / 2))
    const fits0 = (e: number): boolean => ridge0 - e >= MASSING_TOLERANCES.flatRiseM && top0(e) >= STOREY_WALLS.oneMinM && (want.full === 2 ? top0(e) >= STOREY_WALLS.twoMinM : want.full === 1 ? top0(e) <= STOREY_WALLS.oneMaxM : true)
    const byPitch0 = want.pitchDeg !== undefined ? ridge0 - (span0 / 2) * Math.tan((want.pitchDeg * Math.PI) / 180) : undefined
    const stated0 = want.eavesM && want.eavesM.status !== 'ESTIMATED' && want.eavesM.status !== 'UNKNOWN' ? want.eavesM.m + t : undefined
    const e0 = byPitch0 !== undefined && fits0(byPitch0) ? byPitch0 : stated0 !== undefined && fits0(stated0) ? stated0 : undefined
    if (e0 === undefined) return { roof, notes }
    notes.push(`the silhouettes read nothing rising above the walls (drawn to ${ridge0.toFixed(2)} m); the structure reports a ${want.kind.toLowerCase()}: that top is its ridge and the walls end at ${top0(e0).toFixed(2)} m (${e0 === byPitch0 ? `the agreed ${want.pitchDeg}° down from it` : `the eaves the read states as ${want.eavesM?.status}`})`)
    const pitch0 = Math.round(((Math.atan2(ridge0 - e0, span0 / 2) * 180) / Math.PI) * 10) / 10
    if (want.kind === 'HIP') { notes.push(`a hip with one pitch all round — the ridge ends half the span (${(span0 / 2).toFixed(2)} m) in from the end walls: DISPLAY_ASSUMPTION`); return { roof: { kind: 'HIP', ridgeAxis: axis0, pitchDeg: pitch0, eavesM: r6(e0), ridgeM: r6(ridge0), hipRunM: r6(Math.min(span0 / 2, (axis0 === 'X' ? dx : dz) / 2)) }, notes } }
    return { roof: { kind: 'GABLE', ridgeAxis: axis0, pitchDeg: pitch0, eavesM: r6(e0), ridgeM: r6(ridge0) }, notes }
  }
  const kind = want.kind ?? roof.kind
  let axis: 'X' | 'Z' = roof.ridgeAxis ?? 'X'
  if (kind === 'HIP') {
    const longer: 'X' | 'Z' = dx >= dz ? 'X' : 'Z'
    if (roof.kind !== 'HIP' && axis !== longer) { notes.push(`a hip's ridge runs along the longer side (${longer}), not ${axis}`); axis = longer }
  } else if (want.axis && want.axis !== axis) { notes.push(`the ridge runs along ${want.axis} (the silhouettes gave ${axis})`); axis = want.axis }
  const span = axis === 'X' ? dz : dx
  const length = axis === 'X' ? dx : dz
  const ridge = roof.ridgeM
  let eaves = roof.eavesM
  const pitchOf = (e: number): number => Math.atan2(Math.max(0.01, ridge - e), span / 2)
  const wallTop = (e: number): number => e - t / Math.cos(pitchOf(e))
  if (want.full !== undefined) {
    const low = want.full === 2 && wallTop(eaves) < STOREY_WALLS.twoMinM
    const high = want.full === 1 && wallTop(eaves) > STOREY_WALLS.oneMaxM
    if (low || high) {
      const fits = (e: number): boolean => ridge - e >= MASSING_TOLERANCES.flatRiseM && (want.full === 2 ? wallTop(e) >= STOREY_WALLS.twoMinM : wallTop(e) <= STOREY_WALLS.oneMaxM && wallTop(e) >= STOREY_WALLS.oneMinM)
      const byPitch = want.pitchDeg !== undefined ? ridge - (span / 2) * Math.tan((want.pitchDeg * Math.PI) / 180) : undefined
      const stated = want.eavesM && want.eavesM.status !== 'ESTIMATED' && want.eavesM.status !== 'UNKNOWN' ? want.eavesM.m : undefined
      let byStated: number | undefined
      if (stated !== undefined) { let e = stated; for (let k = 0; k < 6; k += 1) e = stated + t / Math.cos(pitchOf(e)); byStated = e }
      const was = wallTop(eaves)
      // first what the elevations themselves draw: the wall tops of the views that ARE within the storey (the solver's
      // one figure took a view where a cross gable's wall rises, or a lower part's eaves)
      const drawn = (want.drawnTopsM ?? []).filter((v) => (want.full === 2 ? v >= STOREY_WALLS.twoMinM : v <= STOREY_WALLS.oneMaxM && v >= STOREY_WALLS.oneMinM)).sort((p, q) => p - q)
      let byDrawn: number | undefined
      if (drawn.length > 0) { const target = drawn[Math.floor((drawn.length - 1) / 2)]; let e = target; for (let k = 0; k < 6; k += 1) e = target + t / Math.cos(pitchOf(e)); byDrawn = e }
      if (byDrawn !== undefined && fits(byDrawn)) { eaves = byDrawn; notes.push(`${want.full === 2 ? 'two full storeys' : 'one storey'} under the eaves: the walls end at ${wallTop(eaves).toFixed(2)} m (the wall top ${drawn.length} elevation(s) draw within the storey), not at ${was.toFixed(2)} m`) }
      else if (byPitch !== undefined && fits(byPitch)) { eaves = byPitch; notes.push(`${want.full === 2 ? 'two full storeys' : 'one storey'} under the eaves: the walls end at ${wallTop(eaves).toFixed(2)} m (the agreed ${want.pitchDeg}° down from the drawn ridge at ${ridge.toFixed(2)} m), not at ${was.toFixed(2)} m`) }
      else if (byStated !== undefined && fits(byStated)) { eaves = byStated; notes.push(`${want.full === 2 ? 'two full storeys' : 'one storey'} under the eaves: the walls end at ${wallTop(eaves).toFixed(2)} m (the eaves the read states as ${want.eavesM?.status}), not at ${was.toFixed(2)} m`) }
    }
  }
  const pitchDeg = Math.round(((pitchOf(eaves) * 180) / Math.PI) * 10) / 10
  if (kind === 'HIP') {
    if (roof.kind === 'HIP' && notes.length === 0) return { roof, notes }
    if (roof.kind !== 'HIP') notes.push(`a hip (no gable wall), built with one pitch all round — the ridge ends half the span (${(span / 2).toFixed(2)} m) in from the end walls: DISPLAY_ASSUMPTION`)
    const run = roof.kind === 'HIP' && roof.hipRunM !== undefined && roof.ridgeAxis === axis ? roof.hipRunM : span / 2
    return { roof: { kind: 'HIP', ridgeAxis: axis, pitchDeg, eavesM: r6(eaves), ridgeM: r6(ridge), hipRunM: r6(Math.min(run, length / 2)) }, notes }
  }
  if (roof.kind === 'HIP') notes.push('a gable (the read reports gable walls), not a hip')
  if (notes.length === 0) return { roof, notes }
  return { roof: { kind: 'GABLE', ridgeAxis: axis, pitchDeg, eavesM: r6(eaves), ridgeM: r6(ridge) }, notes }
}

/**
 * massing 1.11.0 — a GABLE WALL drawn over a part of a stretch of one elevation: a wall polygon that keeps its width up
 * to its shoulders and then narrows to a point at least `CROSS_GABLE.minRiseM` higher. Returned in metres along the side
 * (its extent at the shoulders) with the shoulders' and the apex's heights; undefined where no such wall is drawn, or
 * where it spans (nearly) the whole stretch — then it is the body's own gable end, not a second ridge across its roof.
 */
export const CROSS_GABLE = { minRiseM: 0.8, minWidthM: 2.0, maxShare: 0.85, shoulderShare: 0.97, pointShare: 0.4 } as const
export function gableWallOver(view: BindView, stretch: { lo: number; hi: number }, walls: readonly Poly[], groundRow: number | null): { lo: number; hi: number; shoulderM: number; apexM: number } | undefined {
  if (groundRow === null || !Number.isFinite(groundRow)) return undefined
  const p = view.projection
  const alongOf = (x: number): number => p.alongAtPx0 + p.alongSign * p.mpp * x
  let best: { lo: number; hi: number; shoulderM: number; apexM: number } | undefined
  for (const poly of walls) {
    const top = Math.min(...poly.map((q) => q[1]))
    const foot = Math.max(...poly.map((q) => q[1]))
    if (foot - top < 20) continue
    const widthAt = (row: number): number => { const e = rowExtent([poly], row); return e ? e[1] - e[0] : 0 }
    const base = Math.max(widthAt(foot - 0.1 * (foot - top)), widthAt(foot - 0.3 * (foot - top)))
    if (base <= 0) continue
    // the shoulders: the highest row at which the wall still has its width
    let shoulder = foot
    for (let k = 0; k <= 240; k += 1) { const row = foot - ((foot - top) * k) / 240; if (widthAt(row) >= CROSS_GABLE.shoulderShare * base) shoulder = row; else if (row < shoulder - 0.15 * (foot - top)) break }
    const rise = yOfRow(p, top) - yOfRow(p, shoulder)
    if (rise < CROSS_GABLE.minRiseM) continue
    if (widthAt(shoulder - 0.8 * (shoulder - top)) > CROSS_GABLE.pointShare * base) continue
    // its extent where it has its full width (below the shoulders)
    const e = rowExtent([poly], shoulder + 0.25 * (foot - shoulder))
    if (!e) continue
    const [a, b] = [Math.min(alongOf(e[0]), alongOf(e[1])), Math.max(alongOf(e[0]), alongOf(e[1]))]
    const [lo, hi] = [Math.max(a, stretch.lo), Math.min(b, stretch.hi)]
    if (hi - lo < CROSS_GABLE.minWidthM || hi - lo < 0.8 * (b - a) || hi - lo > CROSS_GABLE.maxShare * (stretch.hi - stretch.lo)) continue
    const cand = { lo: r6(lo), hi: r6(hi), shoulderM: r6(yOfRow(p, shoulder)), apexM: r6(yOfRow(p, top)) }
    if (!best || cand.hi - cand.lo > best.hi - best.lo) best = cand
  }
  return best
}

/** 3. The mass the observations support, or exactly what they lack. */
export function solveMassing(input: MassingInput): MassingHypothesis {
  const t = input.wallThicknessM?.value ?? MINIATURE_CONVENTIONS.wallThicknessM
  const base = { version: MASSING_VERSION, alternatives: [] as string[], missing: [] as MassingHypothesis['missing'], views_used: [] as MassingHypothesis['views_used'], wallThicknessM: t }
  const bb = rectOfOutline(input.outline.outline)
  const views: BindView[] = []
  const byView = new Map<Side, { obs: SilhouetteObservation; view: BindView }>()
  for (const s of input.silhouettes) {
    const reg = registerByPlan(s, extentOn(bb, s.side))
    if ('refused' in reg) {
      base.views_used.push({ side: s.side, frameId: s.frameId, used: false, why: reg.refused })
      continue
    }
    views.push(reg.view)
    byView.set(s.side, { obs: s, view: reg.view })
    base.views_used.push({ side: s.side, frameId: s.frameId, used: true, why: reg.why })
  }
  if (byView.size === 0) return { ...base, status: 'INSUFFICIENT', bodies: [], views, missing: [{ anchor: 'ELEVATION_SILHOUETTE', why: 'no elevation could be registered by the plan: no height and no roof form can be read' }], why: 'the outline alone gives a footprint, not a mass' }
  // massing 1.9.0: a part the agreed structure names as a volume of its own (a garage, a wing) on one side of the house,
  // where the outline steps out on that side, is a body — before any small-step convention can close its two steps (a
  // 3.6 m garage against a 10 m house is two steps of 4 % each: taken out as "small", the house and its garage became
  // one body under one roof). What is left of the outline is read as before.
  let src: ReadonlyArray<{ x: number; z: number }> = input.outline.outline
  const wingBodies: Array<{ rect: Rect; part: BuildStructure['parts'][number] }> = []
  for (const part of input.structure?.parts ?? []) {
    const wg = wingOnSide(src, part.where)
    if (!wg) { base.alternatives.push(`STRUCTURE: the ${part.what.toLowerCase()} reported on the ${part.where.toLowerCase()} has no step of the outline on that side to stand on: not a body of its own here`); continue }
    wingBodies.push({ rect: wg.rect, part })
    src = wg.rest
    base.alternatives.push(`STRUCTURE: the ${part.what.toLowerCase()} reported on the ${part.where.toLowerCase()} stands where the outline steps out on that side (${(wg.rect.maxX - wg.rect.minX).toFixed(2)} × ${(wg.rect.maxZ - wg.rect.minZ).toFixed(2)} m): a body of its own`)
  }
  let split = rectanglesOf(src)
  if (split.splits.length === 0) {
    // v3.54.18: small steps of the outline (a terrace notch, a bay) are taken out as a named miniature convention
    const simple = simplifyOutline(src)
    if (simple) {
      split = rectanglesOf(simple.outline)
      if (split.splits.length > 0) base.alternatives.push(`MINIATURE_CONVENTION: the outline's ${simple.steps.length} small step(s) (${simple.changedM2.toFixed(1)} m², ${(simple.share * 100).toFixed(1)} % of its bounding rectangle) are not modelled — the body is ${split.why}; the drawn outline is kept in the observation`)
    }
  }
  if (split.splits.length === 0) {
    // massing 1.8.0: the outline with every small step taken out, as an exact partition into bodies — each a rectangle
    // of a body's size, nothing of the outline left over
    const part = simplifyOutline(src, true)
    const total0 = area(bb)
    const aBody = (q: Rect): boolean => Math.min(q.maxX - q.minX, q.maxZ - q.minZ) >= MASSING_TOLERANCES.minBodyM && area(q) >= MASSING_TOLERANCES.minWingShare * total0
    const exact = part ? partitionOf(part.outline, WINGS.maxBodies, aBody) : undefined
    if (part && exact && exact.length >= 2 && exact.every(aBody)) {
      const rects = [...exact].sort((p, q) => area(q) - area(p))
      split = { splits: [rects], why: `an outline of ${input.outline.outline.length} corners as ${rects.length} bodies` }
      base.alternatives.push(`the outline (${input.outline.outline.length} corners) is read as ${rects.length} bodies — ${part.steps.length > 0 ? `MINIATURE_CONVENTION: its ${part.steps.length} small step(s) (${part.changedM2.toFixed(1)} m², ${(part.share * 100).toFixed(1)} % of its bounding rectangle) are not modelled; ` : ''}what is left is partitioned exactly into rectangles, nothing left over (${rects.map((q) => `${(q.maxX - q.minX).toFixed(2)} × ${(q.maxZ - q.minZ).toFixed(2)} m`).join(', ')})`)
    }
  }
  if (split.splits.length === 0) {
    // massing 1.6.0: an outline no small step reduces to a rectangle or an L is taken as its own bodies, largest first
    const total0 = area(bb)
    const w = wingsOf(src, MASSING_TOLERANCES.minWingShare * total0, MASSING_TOLERANCES.minBodyM)
    if (w && w.rects.length >= 1) {
      split = { splits: [w.rects], why: `an outline of ${input.outline.outline.length} corners as ${w.rects.length} bodies` }
      base.alternatives.push(`the outline (${input.outline.outline.length} corners, ${w.outlineM2.toFixed(1)} m²) is read as ${w.rects.length} bodies — the largest rectangle that fits inside it, then the largest in what is left (${w.rects.map((q) => `${(q.maxX - q.minX).toFixed(2)} × ${(q.maxZ - q.minZ).toFixed(2)} m`).join(', ')})${w.outlineM2 - w.coveredM2 > 0.5 ? `; MINIATURE_CONVENTION: ${(w.outlineM2 - w.coveredM2).toFixed(1)} m² of it (${(((w.outlineM2 - w.coveredM2) / w.outlineM2) * 100).toFixed(0)} %) lies in no body and is not modelled` : ''}`)
    }
  }
  if (split.splits.length === 0) return { ...base, status: 'UNSUPPORTED_FORM', bodies: [], views, missing: [{ anchor: 'SUPPORTED_OUTLINE', why: split.why }], why: split.why }
  // choose the split whose line an elevation steps at: a body boundary is a jump of the drawn top AT that line (a gable's
  // slope runs through it continuously); the top is read just either side of the line, on every view that shows it
  const stepAt = (rects: Rect[]): number => {
    if (rects.length < 2) return 0
    const [ra, rb] = rects
    const line: { axis: 'x' | 'z'; at: number } | undefined = Math.abs(ra.maxX - rb.minX) < 1e-6 || Math.abs(rb.maxX - ra.minX) < 1e-6 ? { axis: 'x', at: Math.abs(ra.maxX - rb.minX) < 1e-6 ? ra.maxX : rb.maxX } : Math.abs(ra.maxZ - rb.minZ) < 1e-6 || Math.abs(rb.maxZ - ra.minZ) < 1e-6 ? { axis: 'z', at: Math.abs(ra.maxZ - rb.minZ) < 1e-6 ? ra.maxZ : rb.maxZ } : undefined
    if (!line) return 0
    let score = 0
    for (const { obs, view } of byView.values()) {
      if (along(obs.side) !== line.axis) continue
      const p = view.projection
      const d = Math.max(0.1, 3 * p.mpp)
      const topAt = (a: number): number | undefined => {
        const x = pxOfAlong(p, a)
        const rows = [...obs.walls, ...obs.roofs].map((q) => columnRange(q, x)?.[0]).filter((v): v is number => v !== undefined)
        return rows.length > 0 ? yOfRow(p, Math.min(...rows)) : undefined
      }
      const l = topAt(line.at - d)
      const r = topAt(line.at + d)
      if (l !== undefined && r !== undefined && Math.abs(l - r) > MASSING_TOLERANCES.heightAgreeM) score += 1
    }
    return score
  }
  let rects = split.splits[0]
  if (split.splits.length > 1) {
    const sc = split.splits.map(stepAt)
    const best = sc[0] === sc[1] ? (Math.max(...split.splits[0].map(area)) >= Math.max(...split.splits[1].map(area)) ? 0 : 1) : sc[0] > sc[1] ? 0 : 1
    rects = split.splits[best]
    if (sc[0] === sc[1]) base.alternatives.push(`the L splits either way; no elevation steps at either line (${sc[0]} / ${sc[1]}): the split with the larger main body is taken, the other kept as an alternative`)
    else base.alternatives.push(`the L's other split (${sc[1 - best]} elevation steps against ${sc[best]}) is kept as an alternative`)
  }
  const total = area(bb)
  {
    const all = rects
    rects = rects.filter((r) => area(r) >= MASSING_TOLERANCES.minWingShare * total && r.maxX - r.minX >= MASSING_TOLERANCES.minBodyM && r.maxZ - r.minZ >= MASSING_TOLERANCES.minBodyM)
    // massing 1.5.0: an L whose second rectangle is too thin to be a body is one body with a corner taken out. Dropping
    // the thin rectangle cut a strip off the whole length of the house (a garage 8.2 m deep became 7.0 m, and no side
    // elevation registered on it any more); where the open corner is the smaller of the two, the corner is closed
    // instead — the bounding rectangle, a named miniature convention like every other step not modelled.
    if (all.length === 2 && rects.length === 1) {
      const dropped = all.find((r) => r !== rects[0]) as Rect
      const box: Rect = { minX: Math.min(all[0].minX, all[1].minX), maxX: Math.max(all[0].maxX, all[1].maxX), minZ: Math.min(all[0].minZ, all[1].minZ), maxZ: Math.max(all[0].maxZ, all[1].maxZ) }
      const corner = area(box) - area(all[0]) - area(all[1])
      if (corner >= 0 && corner < area(dropped)) {
        rects = [box]
        base.alternatives.push(`MINIATURE_CONVENTION: the L's second rectangle (${area(dropped).toFixed(1)} m², ${Math.min(dropped.maxX - dropped.minX, dropped.maxZ - dropped.minZ).toFixed(2)} m thin) is not a body of its own; the corner it leaves open (${corner.toFixed(1)} m²) is the smaller: the body is the bounding rectangle, the corner closed — not cut off along the house's whole length`)
      }
    }
  }
  // massing 1.5.0: one rectangle on the plan, two bodies in line — a house and a lower garage under their own roofs. The
  // plan's outline does not show it; two OPPOSITE elevations do, where the drawn top (walls and roofs) jumps at one place
  // along the side (a gable seen from its end slopes through such a place and a hip end slopes down to it: neither
  // jumps). Both views must put the jump at the same place of the plan and the lower part on the same side of it.
  const builtOn = new Map<Rect, Rect>()
  if (rects.length === 1 && wingBodies.length === 0) {
    const rect = rects[0]
    const jumpOn = (obs: SilhouetteObservation, view: BindView): { at: number; lowAbove: boolean; by: number } | undefined => {
      const e = extentOn(rect, obs.side)
      const p = view.projection
      const N = 120
      const tops = Array.from({ length: N }, (_, i) => {
        const a = e.lo + ((i + 0.5) * (e.hi - e.lo)) / N
        const x = pxOfAlong(p, a)
        const rows = [...obs.walls, ...obs.roofs].map((q) => columnRange(q, x)?.[0]).filter((v): v is number => v !== undefined)
        return { a, y: rows.length > 0 ? yOfRow(p, Math.min(...rows)) : undefined }
      })
      let best: { at: number; lowAbove: boolean; by: number } | undefined
      for (let i = 1; i < N - 1; i += 1) {
        const [l, r] = [tops[i - 1].y, tops[i + 1].y]
        if (l === undefined || r === undefined) continue
        const by = Math.abs(l - r)
        if (by >= MASSING_TOLERANCES.stepM && (!best || by > best.by) && tops[i].a - e.lo >= MASSING_TOLERANCES.minBodyM && e.hi - tops[i].a >= MASSING_TOLERANCES.minBodyM) best = { at: tops[i].a, lowAbove: r < l, by }
      }
      return best
    }
    for (const axis of ['x', 'z'] as const) {
      const js = [...byView.values()].filter((v) => along(v.obs.side) === axis).map((v) => jumpOn(v.obs, v.view)).filter((j): j is NonNullable<typeof j> => !!j)
      if (js.length < 2) continue
      const at = js.reduce((t, j) => t + j.at, 0) / js.length
      if (Math.max(...js.map((j) => j.at)) - Math.min(...js.map((j) => j.at)) > MASSING_TOLERANCES.stepAgreeM || !js.every((j) => j.lowAbove === js[0].lowAbove)) continue
      // massing 1.7.0: the elevations say THAT the top steps, and — through a roof's overhang and a registration — only
      // roughly WHERE; the plan draws the wall the two bodies meet at. A partition the plan draws across the body (over
      // half its depth) within reach of the elevations' step is that wall: the bodies are split on it.
      const [lo, hi, depth] = axis === 'x' ? [rect.minX, rect.maxX, rect.maxZ - rect.minZ] : [rect.minZ, rect.maxZ, rect.maxX - rect.minX]
      const across = (input.planWalls ?? []).filter((w) => (axis === 'x' ? Math.abs(w.a.x - w.b.x) < 0.05 : Math.abs(w.a.z - w.b.z) < 0.05)).map((w) => ({ at: axis === 'x' ? (w.a.x + w.b.x) / 2 : (w.a.z + w.b.z) / 2, len: axis === 'x' ? Math.abs(w.a.z - w.b.z) : Math.abs(w.a.x - w.b.x) }))
      const lines = across.map((w) => ({ at: w.at, len: across.filter((v) => Math.abs(v.at - w.at) <= 0.2).reduce((t, v) => t + v.len, 0) })).filter((w) => w.len >= 0.5 * depth && Math.abs(w.at - at) <= MASSING_TOLERANCES.stepSnapM && w.at - lo >= MASSING_TOLERANCES.minBodyM && hi - w.at >= MASSING_TOLERANCES.minBodyM).sort((p, q) => Math.abs(p.at - at) - Math.abs(q.at - at))
      const cut = lines[0]?.at ?? at
      // The bodies are READ where the elevations draw the step (the taller roof's verge overhangs the lower body: read
      // over its plan extent, the lower body would take that roof for its own) and BUILT on the plan's wall.
      rects = axis === 'x' ? [{ ...rect, maxX: at }, { ...rect, minX: at }] : [{ ...rect, maxZ: at }, { ...rect, minZ: at }]
      if (cut !== at) {
        builtOn.set(rects[0], axis === 'x' ? { ...rect, maxX: cut } : { ...rect, maxZ: cut })
        builtOn.set(rects[1], axis === 'x' ? { ...rect, minX: cut } : { ...rect, minZ: cut })
      }
      base.alternatives.push(`the outline is one rectangle, but ${js.length} opposite elevations draw the top stepping by ${js.map((j) => j.by.toFixed(2)).join(' / ')} m at ${js.map((j) => j.at.toFixed(2)).join(' / ')} m along ${axis}: two bodies in line (split at ${cut.toFixed(2)} m${lines[0] ? ` — on the wall the plan draws across the body there, ${lines[0].len.toFixed(2)} m of its ${depth.toFixed(2)} m depth; the elevations alone put the step at ${at.toFixed(2)} m` : ''}), each with its own roof`)
      break
    }
  }
  rects.sort((a, b) => area(b) - area(a))
  rects = [...rects, ...wingBodies.map((q) => q.rect)]
  const bodies: BodySpec[] = []
  type BodyRead = { side: Side; p: RoofProfile; ext: { lo: number; hi: number }; wallTopM?: number }
  const readsOf = (i: number, rect: Rect): BodyRead[] => {
    const reads: BodyRead[] = []
    for (const { obs, view } of byView.values()) {
      const e = extentOn(rect, obs.side)
      // a body hidden behind another on this side (its whole stretch inside the other's, and further back) is not read there
      const depth = (r: Rect): number => (obs.side === 'FRONT' ? r.minZ : obs.side === 'REAR' ? -r.maxZ : obs.side === 'LEFT' ? r.minX : -r.maxX)
      if (rects.some((other) => { if (other === rect) return false; const eo = extentOn(other, obs.side); return eo.lo <= e.lo + 0.05 && eo.hi >= e.hi - 0.05 && depth(other) < depth(rect) - 0.05 })) continue
      const own = attribute(obs, view, rects.map((r) => extentOn(r, obs.side)))[i]
      const p = profileOver(view, e.lo, e.hi, own)
      const wt = p && p.shape !== 'NONE' ? wallCornerTopM(view, e.lo, e.hi, own.walls, obs.groundRow) : undefined
      if (p) reads.push({ side: obs.side, p, ext: e, ...(wt !== undefined ? { wallTopM: wt } : {}) })
    }
    return reads
  }
  const allReads = rects.map((rect, i) => readsOf(i, rect))
  const axisOfSide = (sd: Side): 'X' | 'Z' => (along(sd) === 'x' ? 'X' : 'Z')
  /** What a body's own views say of its ridge: slopes (a band) on the sides along it, a gable end (a triangle) across it. */
  const drawnAxis = (reads: readonly BodyRead[]): { X: number; Z: number } => {
    const v = { X: 0, Z: 0 }
    for (const r of reads) { if (r.p.shape === 'BAND') v[axisOfSide(r.side)] += 1; if (r.p.shape === 'TRIANGLE') v[axisOfSide(r.side) === 'X' ? 'Z' : 'X'] += 1 }
    return v
  }
  // massing 1.11.0 — which body each description of the agreed structure is OF. The read describes roofs ("the main
  // roof, its ridge parallel to the front"; "a wing on the front, its ridge front-to-back"); it does not say which
  // rectangle of the outline carries which. Until now the main roof's description went to the largest rectangle. Where
  // that rectangle's own elevations draw, on every side, the ridge of a reported PART instead (a gable on the front and
  // the rear, slopes on both sides: the cross wing itself), the part is that body's description — and the main roof's
  // is the bodies' beside it. Nothing is turned against four views of its own because a larger label was nearer.
  const partOf = new Map<Rect, BuildStructure['parts'][number]>(wingBodies.map((q) => [q.rect, q.part]))
  let mainRects = new Set<Rect>(rects.length > 0 ? [rects[0]] : [])
  if (input.structure && rects.length > 1 && !partOf.has(rects[0])) {
    const st = input.structure
    const v0 = drawnAxis(allReads[0])
    const own0: 'X' | 'Z' | undefined = v0.X - v0.Z >= BIND_BY_VIEWS ? 'X' : v0.Z - v0.X >= BIND_BY_VIEWS ? 'Z' : undefined
    const reaches = (r: Rect, side: StructureSide): boolean => (side === 'FRONT' ? rects.every((o) => r.minZ <= o.minZ + 0.05) : side === 'REAR' ? rects.every((o) => r.maxZ >= o.maxZ - 0.05) : side === 'LEFT' ? rects.every((o) => r.minX <= o.minX + 0.05) : rects.every((o) => r.maxX >= o.maxX - 0.05))
    const free = st.parts.filter((q) => ![...partOf.values()].includes(q))
    const explains = own0 && st.mainRidge && st.mainRidge !== own0 ? free.find((q) => q.ridge === own0 && reaches(rects[0], q.where)) : undefined
    if (explains && own0) {
      partOf.set(rects[0], explains)
      mainRects = new Set(rects.filter((r) => !partOf.has(r)))
      base.alternatives.push(`STRUCTURE: the ${explains.what.toLowerCase()} reported on the ${explains.where.toLowerCase()} with its ridge along ${own0} is the body whose own elevations draw that ridge (mass-main: ${Math.max(v0.X, v0.Z)} view(s) to ${Math.min(v0.X, v0.Z)}) and which stands furthest out on that side; the main roof's description (ridge along ${st.mainRidge}) is of the ${mainRects.size} bod${mainRects.size === 1 ? 'y' : 'ies'} beside it, not of the largest rectangle`)
    }
  }
  const mainRep = [...mainRects].sort((p, q) => area(q) - area(p))[0]
  // massing 1.11.0 — a reported part with NO step of the outline and no body of its own: a cross gable on the main
  // body's own walls, where the elevation of its side draws a gable wall over a part of that body's stretch (a wall
  // rising above its own shoulders to a point). The read says THAT a second ridge is there; the drawing says WHERE.
  const crossCands: Array<{ part: BuildStructure['parts'][number]; side: Side; lo: number; hi: number; shoulderM: number; apexM: number }> = []
  const unbuiltParts: Array<{ part: BuildStructure['parts'][number]; why: string }> = []
  for (const part of input.structure?.parts ?? []) {
    if ([...partOf.values()].includes(part)) continue
    const side = part.where as Side
    const seen = byView.get(side)
    if (!mainRep || !seen) { unbuiltParts.push({ part, why: `no registered elevation of the ${side.toLowerCase()} side to place it on` }); continue }
    const g = gableWallOver(seen.view, extentOn(mainRep, side), seen.obs.walls, seen.obs.groundRow)
    if (!g) { unbuiltParts.push({ part, why: `the ${side.toLowerCase()} elevation draws no gable wall over a part of the main body's stretch: where it stands is not known` }); continue }
    crossCands.push({ part, side, ...g })
  }
  for (const [i, rect] of rects.entries()) {
    const id = i === 0 ? 'mass-main' : `mass-wing-${i}`
    const reads = allReads[i]
    if (reads.length === 0) {
      base.missing.push({ anchor: `HEIGHT:${id}`, why: `no registered elevation shows ${id}` })
      continue
    }
    // massing 1.3.0: the median of an even count is the middle of its two middle values (it was the lower of them: with
    // four views the ridge stood at the second lowest reading, at the edge of the tolerance the higher two were then held to)
    const median = (v: number[]): number => { const q = [...v].sort((a, b) => a - b); return (q[Math.floor((q.length - 1) / 2)] + q[Math.ceil((q.length - 1) / 2)]) / 2 }
    const top = median(reads.map((r) => r.p.topM))
    // v3.54.18 (massing 1.1.0): the eaves at the wall are where the drawn walls end at the body's corners, when every view
    // that reads this body draws them; else the roofs' lowest edges, as before.
    // massing 1.3.0: a view of the gable END sees the wall's corner run up to the roof's underside; a view ALONG the ridge
    // sees the fascia and a boxed soffit in front of that line and draws its walls ending lower, by up to the overhang's
    // fall. So where a gable-end view draws the wall corners, they are the eaves at the wall — provided the gable ends
    // agree with each other and no view along the ridge draws its walls ending HIGHER, or lower than an overhang can
    // hide (then the views disagree, and the median of all stands as before, unconfirmed).
    const tolOf = (v: number): number => Math.max(MASSING_TOLERANCES.heightAgreeM, MASSING_TOLERANCES.heightAgreeShare * v)
    const ends = reads.filter((r) => r.p.shape === 'TRIANGLE' && r.wallTopM !== undefined)
    const sides = reads.filter((r) => !ends.includes(r))
    const endTop = ends.length > 0 ? median(ends.map((r) => r.wallTopM as number)) : undefined
    const endsAgree = endTop !== undefined && Math.max(...ends.map((r) => r.wallTopM as number)) - Math.min(...ends.map((r) => r.wallTopM as number)) <= tolOf(endTop)
    const fallMax = endTop !== undefined ? MAX_OVERHANG_M * (Math.max(0, top - endTop) / Math.max(0.5, median(ends.map((r) => r.ext.hi - r.ext.lo)) / 2)) : 0
    const byEnds = endTop !== undefined && endsAgree && sides.every((r) => { const v = r.wallTopM ?? r.p.eavesM; return v <= endTop + tolOf(endTop) && v >= endTop - fallMax - tolOf(endTop) })
    const byWalls = byEnds || reads.every((r) => r.wallTopM !== undefined)
    const eavesOf = (r: (typeof reads)[number]): number => (byWalls ? (r.wallTopM ?? r.p.eavesM) : r.p.eavesM)
    const eaves = byEnds ? (endTop as number) : median(reads.map(eavesOf))
    const spread = Math.max(...reads.map(eavesOf)) - Math.min(...reads.map(eavesOf))
    // two views confirm a height when they draw it within the tolerance; a view along the ridge that only does not
    // contradict the gable end (its walls end lower, behind the soffit) is not a second witness of that line
    const agree = byEnds ? reads.filter((r) => Math.abs(eavesOf(r) - eaves) <= tolOf(eaves)).length >= 2 : reads.length >= 2 && spread <= tolOf(eaves)
    const hProv: Prov = { fidelity: agree ? 'SOURCE_DERIVED' : 'TRACE_UNCERTAIN', source: reads.map((r) => r.side).join('+'), why: `${reads.length} registered elevation(s) give eaves ${byWalls ? '(the walls\' corner tops) ' : ''}${reads.map((r) => eavesOf(r).toFixed(2)).join(' / ')} m and top ${reads.map((r) => r.p.topM.toFixed(2)).join(' / ')} m${byEnds ? ` — the gable-end view(s) (${ends.map((r) => r.side).join(', ')}) show the wall corner under the roof: ${eaves.toFixed(2)} m is taken${sides.length > 0 ? '; a view along the ridge draws its walls ending behind the fascia, lower by no more than an overhang hides' : ''}${agree ? ' (two views draw that line)' : ' (one view draws that line)'}` : agree ? ' (they agree)' : reads.length < 2 ? ' (one view: the vertical scale is the horizontal one, unconfirmed)' : ` (they disagree by ${spread.toFixed(2)} m)`}` }
    if (eaves < MASSING_TOLERANCES.minBodyM) {
      base.missing.push({ anchor: `HEIGHT:${id}`, why: `the elevations put ${id}'s eaves at ${eaves.toFixed(2)} m: not a storey` })
      continue
    }
    const rise = top - eaves
    let roof: RoofSpec
    let roofProv: Prov
    if (rise < MASSING_TOLERANCES.flatRiseM || reads.every((r) => r.p.shape === 'NONE')) {
      roof = { kind: 'FLAT', eavesM: r6(top) }
      roofProv = { fidelity: hProv.fidelity, source: hProv.source, why: `nothing rises more than ${MASSING_TOLERANCES.flatRiseM} m above the walls: a flat roof, its parapet at ${top.toFixed(2)} m (the plate ${MINIATURE_CONVENTIONS.parapetM} m below: DISPLAY_ASSUMPTION)` }
    } else {
      // the axis: slopes (a band) are seen on the sides along the ridge, the gable end (a triangle) on the sides across it
      const vote = { X: 0, Z: 0 }
      const axOf = (sd: Side): 'X' | 'Z' => (along(sd) === 'x' ? 'X' : 'Z')
      for (const r of reads) {
        if (r.p.shape === 'BAND') vote[axOf(r.side)] += 1
        if (r.p.shape === 'TRIANGLE') vote[axOf(r.side) === 'X' ? 'Z' : 'X'] += 1
      }
      const traps = reads.filter((r) => r.p.shape === 'TRAPEZOID' && r.p.ridge)
      let axis: 'X' | 'Z' = vote.X >= vote.Z ? 'X' : 'Z'
      let everyTrapezoid = false
      if (vote.X === vote.Z) {
        if (vote.X === 0 && traps.length > 0) {
          // massing 1.3.0: every view a trapezoid — a hip whose every side shows a level top (a cross ridge, an L under
          // one roof). The ridge is taken along the side whose drawn top is longest; named, never confirmed
          const longest = [...traps].sort((a, b) => ((b.p.ridge as { lo: number; hi: number }).hi - (b.p.ridge as { lo: number; hi: number }).lo) - ((a.p.ridge as { lo: number; hi: number }).hi - (a.p.ridge as { lo: number; hi: number }).lo))[0]
          axis = axOf(longest.side)
          everyTrapezoid = true
          base.alternatives.push(`${id}: every elevation draws a trapezoid (a hip); the ridge is taken along ${axis}, the side whose drawn top is longest (${((longest.p.ridge as { lo: number; hi: number }).hi - (longest.p.ridge as { lo: number; hi: number }).lo).toFixed(2)} m on ${longest.side})`)
        } else {
          base.missing.push({ anchor: `ROOF_AXIS:${id}`, why: `the elevations do not decide ${id}'s ridge direction (X ${vote.X} / Z ${vote.Z})` })
          if (vote.X === 0) continue
          base.alternatives.push(`${id}: ridge along X or Z (${vote.X} views each); X is taken`)
        }
      }
      const span = axis === 'X' ? rect.maxZ - rect.minZ : rect.maxX - rect.minX
      const length = axis === 'X' ? rect.maxX - rect.minX : rect.maxZ - rect.minZ
      // v3.54.18 (massing 1.2.0): eaves read from the walls' corner tops are the roof's UNDERSIDE at the wall; the roof's
      // top surface there (`eavesM`, what createRoof takes) is the slab's vertical thickness above it, solved with the
      // pitch it changes — so the built wall ends where the drawn one does and the openings under it are cut
      // massing 1.5.0: where NO view shows the wall's corner under the roof (every view of this body looks along the
      // ridge), the drawn wall tops are the fascia line — a LOWER bound of the wall's top, the highest of them the
      // tightest; their median put the wall below its own doors. The page's roof pitch, where it is published, says where
      // the slope from the drawn ridge meets the wall — taken when the drawn walls allow it (not above that line, not
      // further below it than an overhang hides); else the highest drawn wall top stands, unconfirmed.
      // massing 1.7.0: the same holds where a gable end IS seen but gives no wall corner the views agree on (its walls
      // not read to the roof, or read wider than the body) and not every view draws its walls' tops: what is left are
      // roofs' lower edges and some wall tops. A roof's lowest drawn edge is the eaves' edge out on the overhang — below
      // the place the slope crosses the wall — so it too is a lower bound of the wall's top, never the roof's top surface
      // at the wall (taken so, a 49° roof stood 0.4 m into its own walls and every door under it went uncut).
      const boundOnly = !byEnds && reads.every((r) => r.p.shape !== 'TRIANGLE')
      // (there the median of the roofs' lower edges stands — as the wall's top under the roof, not as the roof's top)
      const fasciaOnly = !byEnds && !byWalls && !boundOnly
      const lower = boundOnly ? Math.max(...reads.map((r) => r.wallTopM ?? r.p.eavesM)) : eaves
      const underside = byWalls || boundOnly || fasciaOnly
      let eavesTop = lower
      if (underside) for (let i = 0; i < 6; i += 1) eavesTop = lower + MINIATURE_CONVENTIONS.roofThicknessM / Math.cos(Math.atan2(Math.max(0.01, top - eavesTop), span / 2))
      if (top - eavesTop < MASSING_TOLERANCES.flatRiseM) eavesTop = lower
      let pitch = (Math.atan2(top - eavesTop, span / 2) * 180) / Math.PI
      let pitchNote = ''
      const P = input.publishedPitchDeg
      if (boundOnly && P !== undefined && P >= 10 && P <= 60) {
        const tan = Math.tan((P * Math.PI) / 180)
        const topAtWall = top - (span / 2) * tan
        const wallAt = topAtWall - MINIATURE_CONVENTIONS.roofThicknessM / Math.cos((P * Math.PI) / 180)
        if (wallAt >= lower - tolOf(lower) && wallAt - lower <= MAX_OVERHANG_M * tan + tolOf(lower) && top - topAtWall >= MASSING_TOLERANCES.flatRiseM) {
          eavesTop = topAtWall
          pitch = P
          pitchNote = `; no view shows the wall's corner under the roof: the page's ${P}° from the drawn ridge puts the wall's top at ${wallAt.toFixed(2)} m, the drawn walls end at ${lower.toFixed(2)} m behind the fascia (within what an overhang hides)`
        } else pitchNote = `; no view shows the wall's corner under the roof and the page's ${P}° does not fit the drawn walls (it would put their top at ${wallAt.toFixed(2)} m, they are drawn to ${lower.toFixed(2)} m): the highest drawn wall top is taken, unconfirmed`
      } else if (fasciaOnly) pitchNote = `; no gable-end view gives the wall's corner under the roof: the roofs' lowest drawn edge (${lower.toFixed(2)} m, the eaves' edge out on the overhang) is taken as the wall's top under the roof, a lower bound`
      else if (boundOnly) pitchNote = `; no view shows the wall's corner under the roof: the highest drawn wall top (${lower.toFixed(2)} m) is taken as the wall's, a lower bound`
      // massing 1.3.0: a HIP — the sides ALONG the ridge draw a trapezoid (the ridge shorter than the eaves, a hip slope
      // at each end), none of them a band. How far each ridge end stands in from its end wall is read on those views,
      // through the registration that put the wall ends on the plan. A gable draws a band there and is built as before.
      const alongTraps = traps.filter((r) => axOf(r.side) === axis)
      const alongBands = reads.filter((r) => r.p.shape === 'BAND' && axOf(r.side) === axis)
      const runs = alongTraps.map((r) => (((r.p.ridge as { lo: number; hi: number }).lo - r.ext.lo) + (r.ext.hi - (r.p.ridge as { lo: number; hi: number }).hi)) / 2)
      const run = runs.length > 0 ? median(runs) : undefined
      if (run !== undefined && alongBands.length > 0) base.alternatives.push(`${id}: a view along ${axis} draws a trapezoid (ridge ends ${run.toFixed(2)} m in) and another a band: a gable is taken, a hip kept as an alternative`)
      if (run !== undefined && alongBands.length === 0 && run >= MASSING_TOLERANCES.minHipRunM) {
        const hipRun = Math.min(run, length / 2)
        // the eaves' reach past the walls, where the views along the ridge draw it and the body stands alone (one
        // overhang all round would run into a body standing against it)
        const reaches = alongTraps.filter((r) => r.p.drawn).map((r) => ((r.ext.lo - (r.p.drawn as { lo: number; hi: number }).lo) + ((r.p.drawn as { lo: number; hi: number }).hi - r.ext.hi)) / 2)
        const reach = rects.length === 1 && reaches.length > 0 ? Math.round(Math.min(MAX_OVERHANG_M, Math.max(0, median(reaches))) * 100) / 100 : 0
        const runsAgree = runs.length >= 2 && Math.max(...runs) - Math.min(...runs) <= Math.max(MASSING_TOLERANCES.heightAgreeM, 0.15 * hipRun)
        const low = reach >= 0.1 ? median(reads.map((r) => r.p.eavesM)) : eaves
        roof = hipSpecFrom({ axis, span, length, topM: top, lowM: low, runM: hipRun, reachM: reach })
        const hipEaves = roof.eavesM
        roofProv = { fidelity: !everyTrapezoid && runsAgree && hProv.fidelity === 'SOURCE_DERIVED' ? 'SOURCE_DERIVED' : 'TRACE_UNCERTAIN', source: reads.map((r) => `${r.side}:${r.p.shape}`).join(' '), why: `a hip, ridge along ${axis}: the side(s) along it draw a trapezoid, the ridge ends ${runs.map((v) => v.toFixed(2)).join(' / ')} m in from the end walls (${hipRun.toFixed(2)} m taken${run > length / 2 ? ', half the length: the ridge is a point' : ''}); main pitch ${roof.pitchDeg}° from the drawn roof's lowest edge at ${low.toFixed(2)} m up to the ridge over ${(span / 2 + reach).toFixed(2)} m (half the span${reach >= 0.1 ? ` and the ${reach.toFixed(2)} m the eaves are drawn past the walls` : ''}), hip ends ${((Math.atan2(top - hipEaves, hipRun) * 180) / Math.PI).toFixed(1)}°; the roof's top surface at the wall face ${hipEaves.toFixed(2)} m, the walls end under it at ${hipWallTopM(roof).toFixed(2)} m${reach < 0.1 && rects.length > 1 ? '; no overhang built (another body stands against this one)' : ''}` }
      } else {
        // massing 1.7.0: a lower body standing against a taller one is drawn, on the views that look past it, with the
        // taller body's roof above its own — read as this body's top, that gives a spire (66° over a 4 m garage). A roof
        // steeper than any house roof is not this body's: it takes the first body's pitch (else the page's) from its own
        // walls' top, named and unconfirmed.
        let top0 = top
        const lead = bodies[0]?.roof.pitchDeg ?? (P !== undefined && P >= 10 && P <= 60 ? P : undefined)
        if (i > 0 && pitch > MASSING_TOLERANCES.maxOwnPitchDeg && lead !== undefined && lead <= MASSING_TOLERANCES.maxOwnPitchDeg) {
          top0 = eavesTop + (span / 2) * Math.tan((lead * Math.PI) / 180)
          pitchNote = `; the top drawn over this body (${top.toFixed(2)} m) would make a ${pitch.toFixed(1)}° roof — steeper than a house roof: it is the roof of the body behind it; this body takes ${lead}° (${bodies[0]?.roof.pitchDeg !== undefined ? 'the first body\'s pitch' : 'the page\'s pitch'}) from its own walls' top, unconfirmed`
          base.alternatives.push(`${id}: the drawn top ${top.toFixed(2)} m gives ${pitch.toFixed(1)}° over a ${span.toFixed(2)} m span; taken as another body's roof seen behind it — built at ${lead}° to ${top0.toFixed(2)} m`)
          pitch = lead
        }
        roof = { kind: 'GABLE', ridgeAxis: axis, pitchDeg: Math.round(pitch * 10) / 10, eavesM: r6(eavesTop), ridgeM: r6(top0) }
        roofProv = { fidelity: top0 === top && vote.X !== vote.Z && hProv.fidelity === 'SOURCE_DERIVED' ? 'SOURCE_DERIVED' : 'TRACE_UNCERTAIN', source: reads.map((r) => `${r.side}:${r.p.shape}`).join(' '), why: `ridge along ${axis} (slopes seen on the sides along it, the gable end across it); pitch ${roof.pitchDeg}° from a ${(top0 - eavesTop).toFixed(2)} m rise over half of ${span.toFixed(2)} m${pitchNote || (byWalls ? ` (the walls end at ${eaves.toFixed(2)} m: the roof's underside there)` : '')}` }
      }
    }
    // a body read at the elevations' step and built on the plan's wall: its heights stand; a gable across the moved side
    // keeps its ridge height over the new span (the pitch follows)
    const fates: PropertyFate[] = []
    if (input.structure) {
      const st = input.structure
      const wing = partOf.get(rect)
      // no body of a house rises a storey above its main volume unless the read reports such a part: under a one-storey
      // main volume the other bodies' walls stay within one storey too (never the other way: a wing beside a two-storey
      // main volume is as high as its own elevations draw it)
      const oneStoreyHouse = st.fullStoreys === 1 && st.parts.every((q) => q.fullStoreys !== 2)
      // a body beside the main one takes the main ridge's direction only where its own views do not draw the other
      const ownAxisAgainst = (ax: 'X' | 'Z'): boolean => { const v = drawnAxis(reads); return (ax === 'X' ? v.Z - v.X : v.X - v.Z) >= BIND_BY_VIEWS }
      // a description is executed whole or not at all: "the main ridge along A, and a cross wing with its ridge along B"
      // turns the main ridge away from B only when that cross wing is built too. With the wing left unbuilt, the turn
      // would take away the one gable the drawings do show.
      const cross = unbuiltParts.find((q) => q.part.ridge !== undefined && q.part.ridge !== st.mainRidge)
      const halfDescription = rect === mainRep && roof.kind === 'GABLE' && st.mainRidge !== undefined && roof.ridgeAxis !== st.mainRidge && cross !== undefined && cross.part.ridge === roof.ridgeAxis
      if (halfDescription && cross) {
        base.alternatives.push(`STRUCTURE ${id}: the read reports the main ridge along ${st.mainRidge} AND a ${cross.part.what.toLowerCase()} on the ${cross.part.where.toLowerCase()} with its ridge along ${cross.part.ridge}; that part cannot be built here (${cross.why}) — the main ridge is NOT turned for half of the description: the ridge the elevations draw (${roof.ridgeAxis}) stands`)
        fates.push({ property: 'mainRidge', fate: 'RETAINED_WITH_CONFLICT', taken: `along ${st.mainRidge}`, built: `along ${roof.ridgeAxis}`, why: `turning it needs the reported ${cross.part.what.toLowerCase()} (ridge ${cross.part.ridge}) built with it, and that part has no place: ${cross.why}` })
      }
      const want = wing ? { ...(wing.roof ? { kind: wing.roof } : {}), ...(wing.ridge ? { axis: wing.ridge } : {}), full: wing.fullStoreys, ...(st.pitchDeg !== undefined ? { pitchDeg: st.pitchDeg } : {}), drawnTopsM: reads.map((q) => q.wallTopM ?? q.p.eavesM).filter((v) => Number.isFinite(v)) }
        : { ...(st.mainRoof ? { kind: st.mainRoof } : {}), ...(mainRects.has(rect) && st.mainRidge && (rect === mainRep || !ownAxisAgainst(st.mainRidge)) && !halfDescription ? { axis: st.mainRidge } : {}), ...(st.fullStoreys && (rect === mainRep || oneStoreyHouse) ? { full: st.fullStoreys } : {}), ...(st.pitchDeg !== undefined ? { pitchDeg: st.pitchDeg } : {}), ...(rect === mainRep && st.eavesM ? { eavesM: st.eavesM } : {}), drawnTopsM: reads.map((q) => q.wallTopM ?? q.p.eavesM).filter((v) => Number.isFinite(v)) }
      const applied = roofByStructure(roof, want, rect)
      if (applied.notes.length > 0) {
        roof = applied.roof
        for (const n of applied.notes) base.alternatives.push(`STRUCTURE ${id}: ${n}`)
        roofProv = { fidelity: 'TRACE_UNCERTAIN', source: `${roofProv.source} + STRUCTURE_READ`, why: `${roofProv.why}; the agreed structure: ${applied.notes.join('; ')}` }
      }
    }
    const onPlan = builtOn.get(rect)
    if (onPlan && roof.kind === 'GABLE' && roof.ridgeM !== undefined) {
      const spanNow = roof.ridgeAxis === 'X' ? onPlan.maxZ - onPlan.minZ : onPlan.maxX - onPlan.minX
      roof = { ...roof, pitchDeg: Math.round(((Math.atan2(roof.ridgeM - roof.eavesM, spanNow / 2) * 180) / Math.PI) * 10) / 10 }
    }
    const built = onPlan ?? rect
    // massing 1.11.0 — AFTER the last change of kind, axis, span and height: pitch, eaves and ridge are agreed again over
    // the span the roof now has (a limit checked before the ridge was turned does not hold after it)
    if (roof.kind !== 'FLAT' && roof.ridgeM !== undefined) {
      const st = input.structure
      const bound = partOf.has(rect) ? 'PART' : rect === mainRep ? 'MAIN' : mainRects.has(rect) ? 'MAIN_BESIDE' : 'NONE'
      const lead = bodies[0]?.roof.pitchDeg
      const P0 = input.publishedPitchDeg
      // the roof the read's (and the page's) pitch is OF: the main roof's body, and any body that carries the house's top
      // (its own drawn ridge at the height stated for the house from outside the silhouettes). For every other roof a
      // pitch from elsewhere is only what it falls back to when its own heights make no roof.
      const topWitnessM = st?.ridgeM && st.ridgeM.status !== 'ESTIMATED' ? st.ridgeM.m : input.publishedHeightM
      const carriesTop = topWitnessM !== undefined && Math.abs((roof.ridgeM ?? 0) - topWitnessM) <= Math.max(0.6, 0.1 * topWitnessM)
      const own = bound === 'MAIN' || carriesTop
      const witness: SettleInput['pitch'] = st?.pitchDeg !== undefined && (own || bound !== 'NONE') ? { deg: st.pitchDeg, from: own ? 'the pitch the structure read states for the main roof' : 'the pitch the structure read states (for the main roof: a fallback here)', binding: own }
        : P0 !== undefined && P0 >= 10 && P0 <= 60 ? { deg: P0, from: 'the pitch the page publishes', binding: own }
          : lead !== undefined && lead >= ROOF_SYSTEM_TOLERANCES.minPitchDeg && lead <= ROOF_SYSTEM_TOLERANCES.maxPitchDeg ? { deg: lead, from: 'the first body\'s pitch (a fallback: no pitch is stated for this roof)', binding: false } : undefined
      const axis = roof.ridgeAxis ?? 'X'
      const ends = reads.filter((r) => axisOfSide(r.side) !== axis)
      const settled = settleRoof(roof, built, {
        ...(witness ? { pitch: witness } : {}),
        // the eaves are a wall corner two views draw (or a wall top the storeys rule took from the views): held; else a lower bound
        eavesHeld: hProv.fidelity === 'SOURCE_DERIVED' || /the wall top \d+ elevation\(s\) draw within the storey/.test(roofProv.why),
        drawnEavesM: Math.min(...reads.map((r) => r.wallTopM ?? r.p.eavesM)),
        // the top is this roof's own where a view across its ridge draws it narrowing to it (a gable end, a hip end)
        topOwn: ends.length === 0 ? i === 0 : ends.some((r) => r.p.shape === 'TRIANGLE' || r.p.shape === 'TRAPEZOID'),
        ...(topWitnessM !== undefined ? { topWitnessM } : {}),
        ...(st?.ridgeM && bound === 'MAIN' ? { statedRidge: st.ridgeM } : {}),
        ...(st?.eavesM && bound === 'MAIN' ? { statedEaves: st.eavesM } : {}),
      })
      fates.push(...settled.fates)
      if (settled.notes.length > 0) {
        roof = settled.roof
        for (const n of settled.notes) base.alternatives.push(`AGREED AGAIN ${id}: ${n}`)
        roofProv = { fidelity: 'TRACE_UNCERTAIN', source: roofProv.source, why: `${roofProv.why}; agreed again after the last change: ${settled.notes.join('; ')}` }
      } else roof = settled.roof
      if (partOf.has(rect) && !wingBodies.some((q) => q.rect === rect)) fates.push({ property: 'part', fate: 'APPLIED', taken: `${partOf.get(rect)?.what}@${partOf.get(rect)?.where} ridge ${partOf.get(rect)?.ridge ?? '—'}`, built: `${id} ${roof.kind} along ${roof.ridgeAxis ?? '—'}`, why: 'bound to the body whose own elevations draw this ridge' })
    }
    bodies.push({ id, ...(fates.length > 0 ? { fates } : {}), rect: { minX: r6(built.minX), maxX: r6(built.maxX), minZ: r6(built.minZ), maxZ: r6(built.maxZ) }, roof, provenance: { outline: { fidelity: input.outline.fidelity, source: input.outline.by, why: input.outline.why }, height: hProv, roof: roofProv, wallThickness: input.wallThicknessM?.prov ?? { fidelity: 'DISPLAY_ASSUMPTION', source: 'MINIATURE', why: `${MINIATURE_CONVENTIONS.wallThicknessM} m: no wall thickness was measured` } } })
  }
  if (bodies.length === 0) return { ...base, status: 'INSUFFICIENT', bodies, views, why: `no body has its height and roof read (${base.missing.map((m) => m.anchor).join(', ')})` }
  const crossRoofs: CrossRoofSpec[] = []
  const hostSpec = mainRep ? bodies.find((b) => b.id === (rects.indexOf(mainRep) === 0 ? 'mass-main' : `mass-wing-${rects.indexOf(mainRep)}`)) : undefined
  for (const c of crossCands) {
    const name = `the ${c.part.what.toLowerCase()} reported on the ${c.side.toLowerCase()}`
    const refuse = (why: string): void => { unbuiltParts.push({ part: c.part, why }); base.alternatives.push(`STRUCTURE: ${name} is not built as a cross gable: ${why}`) }
    if (!hostSpec || hostSpec.roof.kind === 'FLAT' || hostSpec.roof.ridgeM === undefined) { refuse('the main body has no pitched roof to stand it on'); continue }
    const crossAxis: 'X' | 'Z' = along(c.side) === 'x' ? 'Z' : 'X'
    if ((hostSpec.roof.ridgeAxis ?? 'X') === crossAxis) { refuse(`the main ridge runs along ${crossAxis} itself: the gable wall drawn on that side is the main roof's own`); continue }
    const r = hostSpec.rect
    const e = extentOn(r, c.side)
    const [lo, hi] = [Math.max(e.lo, c.lo), Math.min(e.hi, c.hi)]
    const half = (hi - lo) / 2
    if (half < MASSING_TOLERANCES.minBodyM / 2) { refuse(`the gable wall drawn there is ${(2 * half).toFixed(2)} m wide`); continue }
    // its eaves are the main roof's (the same walls); its pitch is the drawn gable wall's own (shoulders to apex over its half width)
    const tan = (c.apexM - c.shoulderM) / half
    const pitch = (Math.atan(tan) * 180) / Math.PI
    if (pitch < ROOF_SYSTEM_TOLERANCES.minPitchDeg || pitch > ROOF_SYSTEM_TOLERANCES.maxPitchDeg) { refuse(`the gable wall drawn there rises ${(c.apexM - c.shoulderM).toFixed(2)} m over half of ${(2 * half).toFixed(2)} m (${pitch.toFixed(1)}°): not a roof's pitch`); continue }
    const ridge = hostSpec.roof.eavesM + half * tan
    const mid = along(c.side) === 'x' ? (r.minZ + r.maxZ) / 2 : (r.minX + r.maxX) / 2
    const rect: Rect = c.side === 'FRONT' ? { minX: r6(lo), maxX: r6(hi), minZ: r.minZ, maxZ: r6(mid) } : c.side === 'REAR' ? { minX: r6(lo), maxX: r6(hi), minZ: r6(mid), maxZ: r.maxZ } : c.side === 'LEFT' ? { minX: r.minX, maxX: r6(mid), minZ: r6(lo), maxZ: r6(hi) } : { minX: r6(mid), maxX: r.maxX, minZ: r6(lo), maxZ: r6(hi) }
    crossRoofs.push({ id: `roof-${hostSpec.id}-cross-${c.side.toLowerCase()}`, over: hostSpec.id, side: c.side, rect, ridgeAxis: crossAxis, eavesM: hostSpec.roof.eavesM, ridgeM: r6(ridge), pitchDeg: Math.round(pitch * 10) / 10, provenance: { fidelity: 'TRACE_UNCERTAIN', source: `STRUCTURE_READ + ${c.side}`, why: `${name} has no step of the outline: a cross gable on the main body's own walls, where the ${c.side.toLowerCase()} elevation draws a gable wall from ${lo.toFixed(2)} to ${hi.toFixed(2)} m along that side (shoulders ${c.shoulderM.toFixed(2)} m, apex ${c.apexM.toFixed(2)} m: ${pitch.toFixed(1)}°); its eaves are the main roof's, its ridge ${ridge.toFixed(2)} m, dying into the main slope` } })
    hostSpec.fates = [...(hostSpec.fates ?? []), { property: 'part', fate: 'APPLIED', taken: `${c.part.what}@${c.part.where} ridge ${c.part.ridge ?? '—'}`, built: `roof-${hostSpec.id}-cross-${c.side.toLowerCase()} (${(2 * half).toFixed(2)} m wide, ${pitch.toFixed(1)}°, ridge ${ridge.toFixed(2)} m)`, why: 'a cross gable on the main body\'s walls where its side\'s elevation draws a gable wall' }]
    base.alternatives.push(`STRUCTURE: ${name} has no step of the outline to stand on — built as a CROSS GABLE over ${hostSpec.id}: ${lo.toFixed(2)}–${hi.toFixed(2)} m along the ${c.side.toLowerCase()}, ${pitch.toFixed(1)}°, ridge ${ridge.toFixed(2)} m along ${crossAxis} (the ${c.side.toLowerCase()} elevation draws its gable wall there)`)
  }
  if (hostSpec) for (const u of unbuiltParts) hostSpec.fates = [...(hostSpec.fates ?? []), { property: 'part', fate: 'UNRESOLVED', taken: `${u.part.what}@${u.part.where} ridge ${u.part.ridge ?? '—'}`, why: u.why }]
  return { ...base, status: 'BUILDABLE', bodies, views, ...(crossRoofs.length > 0 ? { crossRoofs } : {}), why: `${bodies.length} body/bodies: ${bodies.map((b) => `${b.id} ${(b.rect.maxX - b.rect.minX).toFixed(2)} × ${(b.rect.maxZ - b.rect.minZ).toFixed(2)} m, ${b.roof.kind}${b.roof.ridgeAxis ? ` along ${b.roof.ridgeAxis}` : ''} eaves ${b.roof.eavesM.toFixed(2)}${b.roof.ridgeM ? ` ridge ${b.roof.ridgeM.toFixed(2)}` : ''}`).join('; ')}` }
}

/** A rectangle's sides shared with another body (a party line): where a flat plate runs to the face and bears nothing more. */
function partySides(rect: Rect, others: readonly Rect[]): { minX: boolean; maxX: boolean; minZ: boolean; maxZ: boolean } {
  const touch = (a: number, b: number): boolean => Math.abs(a - b) < 1e-3
  const overlapZ = (o: Rect): boolean => Math.min(o.maxZ, rect.maxZ) - Math.max(o.minZ, rect.minZ) > 0.1
  const overlapX = (o: Rect): boolean => Math.min(o.maxX, rect.maxX) - Math.max(o.minX, rect.minX) > 0.1
  return {
    minX: others.some((o) => touch(o.maxX, rect.minX) && overlapZ(o)),
    maxX: others.some((o) => touch(o.minX, rect.maxX) && overlapZ(o)),
    minZ: others.some((o) => touch(o.maxZ, rect.minZ) && overlapX(o)),
    maxZ: others.some((o) => touch(o.minZ, rect.maxZ) && overlapX(o)),
  }
}

/**
 * Under a hip every wall ends level, at the roof's underside at its own face: the slab's vertical thickness under
 * `eavesM` — at the main pitch on the sides along the ridge, at the hip end's own pitch on the end walls (`end`), which
 * is steeper where the hip run is shorter than half the span (a wall left at the other height runs into the slab).
 */
export function hipWallTopM(spec: RoofSpec, end = false, halfSpan?: number): number {
  const rise = (spec.ridgeM ?? spec.eavesM) - spec.eavesM
  const pitch = spec.pitchDeg !== undefined ? (spec.pitchDeg * Math.PI) / 180 : Math.atan2(rise, 1)
  const half = halfSpan ?? (Math.tan(pitch) > 0 ? rise / Math.tan(pitch) : 1)
  const run = Math.max(0.05, spec.hipRunM ?? half)
  return spec.eavesM - MINIATURE_CONVENTIONS.roofThicknessM / Math.cos(end ? Math.atan2(rise, run) : Math.atan2(rise, half))
}
/**
 * A hip's spec from what one view along its ridge draws. Every side of a hip is an eaves side: no view shows the wall's
 * corner under the roof, each draws the fascia at the END of the overhang. The slope therefore runs from that line — the
 * slab's underside at the drawn roof's lowest edge (`lowM`) — over the overhang (`reachM`) AND half the span up to the
 * ridge; read as if it started at the wall face, the pitch came out too steep by the overhang's share (36° for a roof
 * drawn at 30°). The top surface at the wall face follows from the ridge and that pitch.
 */
export function hipSpecFrom(a: { axis: 'X' | 'Z'; span: number; length: number; topM: number; lowM: number; runM: number; reachM: number }): RoofSpec {
  const reach = a.reachM >= 0.1 ? a.reachM : 0
  let tanP = Math.max(0.01, a.topM - a.lowM) / (a.span / 2 + reach)
  for (let i = 0; i < 8; i += 1) tanP = Math.max(0.01, a.topM - a.lowM - MINIATURE_CONVENTIONS.roofThicknessM / Math.cos(Math.atan(tanP))) / (a.span / 2 + reach)
  return { kind: 'HIP', ridgeAxis: a.axis, pitchDeg: Math.round(((Math.atan(tanP) * 180) / Math.PI) * 10) / 10, eavesM: r6(a.topM - (a.span / 2) * tanP), ridgeM: r6(a.topM), hipRunM: r6(Math.min(a.runM, a.length / 2)), ...(reach > 0 ? { overhangM: reach } : {}) }
}
/** The plan side a hip's plane drains to: the plane's stable name under its roof's id (`roof-<body>-minZ`, …). */
export const HIP_PLANE_SIDES = ['minZ', 'maxZ', 'minX', 'maxX'] as const
/**
 * massing 1.3.0: a hip roof over a rectangle, as the kernel states roofs — four planes (`createRoofPlane`), two along the
 * ridge and one at each end, meeting at the ridge and the hips. `eavesM` is the top surface at the wall face on the sides
 * along the ridge; the ridge ends stand `hipRunM` in from the end walls (half the length: a point). With an overhang the
 * fascia stays level all round, so the hip ends reach `overhang × tan(main) / tan(hip end)` past their walls.
 */
export function hipPlaneCommands(id: string, levelId: string, rect: Rect, spec: RoofSpec, extra: Record<string, unknown> = {}): BuildingCommand[] {
  const axisX = (spec.ridgeAxis ?? 'X') === 'X'
  // a frame of its own: u along the ridge, v across it
  const [u0, u1, v0, v1] = axisX ? [rect.minX, rect.maxX, rect.minZ, rect.maxZ] : [rect.minZ, rect.maxZ, rect.minX, rect.maxX]
  const pt = (u: number, v: number): { x: number; z: number } => (axisX ? { x: r6(u), z: r6(v) } : { x: r6(v), z: r6(u) })
  const dir = (du: number, dv: number): { x: number; z: number } => (axisX ? { x: du, z: dv } : { x: dv, z: du })
  const ring = (pts: Array<{ x: number; z: number }>): Array<{ x: number; z: number }> => (axisX ? pts : [...pts].reverse())
  const E = spec.eavesM
  const R = spec.ridgeM ?? E
  const half = (v1 - v0) / 2
  const run = Math.min(Math.max(spec.hipRunM ?? half, 0.05), (u1 - u0) / 2)
  const tanP = (R - E) / half
  const tanQ = (R - E) / run
  const oh = spec.overhangM ?? 0
  const ohEnd = tanQ > 0 ? (oh * tanP) / tanQ : 0
  const fascia = r6(E - oh * tanP)
  const [a0, a1, b0, b1, mid] = [u0 - ohEnd, u1 + ohEnd, v0 - oh, v1 + oh, (v0 + v1) / 2]
  const [r0, r1] = [u0 + run, u1 - run]
  const point = r1 - r0 < 1e-3
  const deg = (tan: number): number => Math.round(((Math.atan(tan) * 180) / Math.PI) * 1e4) / 1e4
  const t = MINIATURE_CONVENTIONS.roofThicknessM
  const [vLo, vHi, uLo, uHi] = axisX ? (['minZ', 'maxZ', 'minX', 'maxX'] as const) : (['minX', 'maxX', 'minZ', 'maxZ'] as const)
  const plane = (side: string, boundary: Array<{ x: number; z: number }>, at: { x: number; z: number }, tan: number, down: { x: number; z: number }): BuildingCommand => ({ type: 'createRoofPlane', id: `${id}-${side}`, levelId, boundary: ring(boundary), datum: { x: at.x, y: fascia, z: at.z }, pitchDeg: deg(tan), downslope: down, thickness: t, ...extra }) as BuildingCommand
  return [
    plane(vLo, [pt(a0, b0), pt(a1, b0), ...(point ? [pt((u0 + u1) / 2, mid)] : [pt(r1, mid), pt(r0, mid)])], pt(a0, b0), tanP, dir(0, -1)),
    plane(vHi, [pt(a1, b1), pt(a0, b1), ...(point ? [pt((u0 + u1) / 2, mid)] : [pt(r0, mid), pt(r1, mid)])], pt(a0, b1), tanP, dir(0, 1)),
    plane(uLo, [pt(a0, b1), pt(a0, b0), pt(point ? (u0 + u1) / 2 : r0, mid)], pt(a0, b0), tanQ, dir(-1, 0)),
    plane(uHi, [pt(a1, b0), pt(a1, b1), pt(point ? (u0 + u1) / 2 : r1, mid)], pt(a1, b0), tanQ, dir(1, 0)),
  ]
}

const hipHalf = (b: BodySpec): number => ((b.roof.ridgeAxis ?? 'X') === 'X' ? b.rect.maxZ - b.rect.minZ : b.rect.maxX - b.rect.minX) / 2
/** The ring and the roof of one body, by the kernel's own commands (the same convention LOCAL emits). */
export function bodyCommands(b: BodySpec, levelId: string, levelElevation: number, others: readonly Rect[], t: number): BuildingCommand[] {
  const r = b.rect
  const ring = `ring-${b.id}`
  const polygon = [{ x: r.minX, z: r.minZ }, { x: r.maxX, z: r.minZ }, { x: r.maxX, z: r.maxZ }, { x: r.minX, z: r.maxZ }]
  const walls = [0, 1, 2, 3].map((i) => `${ring}-w${i}`)
  if (b.roof.kind === 'GABLE') {
    const ridge = (b.roof.ridgeM ?? b.roof.eavesM) - levelElevation
    return [
      { type: 'createWallRing', id: ring, levelId, polygon, thickness: t, height: r6(ridge), baseOffset: 0, kind: 'EXTERIOR', cornerOwnership: 'ALTERNATE' },
      { type: 'createRoof', id: `roof-${b.id}`, levelId, kind: 'GABLE', footprint: { ...r }, eaveOffset: r6(b.roof.eavesM - levelElevation), pitchDeg: b.roof.pitchDeg ?? 30, ridgeAxis: b.roof.ridgeAxis ?? 'X', overhang: 0, thickness: MINIATURE_CONVENTIONS.roofThicknessM, capWallIds: walls },
    ] as BuildingCommand[]
  }
  if (b.roof.kind === 'HIP') {
    return [
      { type: 'createWallRing', id: ring, levelId, polygon, thickness: t, height: r6(hipWallTopM(b.roof, false, hipHalf(b)) - levelElevation), baseOffset: 0, kind: 'EXTERIOR', cornerOwnership: 'ALTERNATE' },
      // the ring's walls run minZ, maxX, maxZ, minX: the two across the ridge are the hip ends
      ...(Math.abs(hipWallTopM(b.roof, true, hipHalf(b)) - hipWallTopM(b.roof, false, hipHalf(b))) > 1e-4 ? ((b.roof.ridgeAxis ?? 'X') === 'X' ? [1, 3] : [0, 2]).map((i) => ({ type: 'setProperty', targetId: walls[i], property: 'height', value: r6(hipWallTopM(b.roof, true, hipHalf(b)) - levelElevation) })) : []),
      ...hipPlaneCommands(`roof-${b.id}`, levelId, r, b.roof),
    ] as BuildingCommand[]
  }
  // a flat roof as the elevation draws it: the walls' top is the parapet's; the plate lies a parapet below it
  const top = b.roof.eavesM - levelElevation
  const party = partySides(r, others)
  const half = r6(t / 2)
  return [
    { type: 'createWallRing', id: ring, levelId, polygon, thickness: t, height: r6(top), baseOffset: 0, kind: 'EXTERIOR', cornerOwnership: 'ALTERNATE' },
    { type: 'createRoof', id: `roof-${b.id}`, levelId, kind: 'FLAT', footprint: { ...r }, eaveOffset: r6(top - MINIATURE_CONVENTIONS.parapetM), pitchDeg: 0, ridgeAxis: 'X', overhang: 0, thickness: MINIATURE_CONVENTIONS.flatRoofThicknessM, plateInset: { minX: party.minX ? 0 : half, maxX: party.maxX ? 0 : half, minZ: party.minZ ? 0 : half, maxZ: party.maxZ ? 0 : half } },
  ] as BuildingCommand[]
}

/**
 * massing 1.11.0 — the house's pitched roofs as ONE roof system (`@buildapp/reconstruction` `solveRoofSystem`, the same
 * solver for the drawings' models and for a body built from a read): one region per pitched body, one per cross gable.
 * The solver says how they meet — a valley where a wing's ridge runs into another slope, an abutment where a lower roof
 * meets a wall, nothing where the source shows them apart — and returns every plane cut to what is seen of it.
 */
export function roofRegionsOf(h: Pick<MassingHypothesis, 'bodies' | 'crossRoofs' | 'separateRoofs'>): RoofRegion[] {
  const apart = (id: string): string[] => (h.separateRoofs ?? []).flatMap(([a, b]) => (a === id ? [`roof-${b}`] : b === id ? [`roof-${a}`] : []))
  const box = (r: Rect): RoofRegion['rect'] => ({ x0: r.minX, z0: r.minZ, x1: r.maxX, z1: r.maxZ })
  const out: RoofRegion[] = []
  for (const b of h.bodies) {
    if (b.roof.kind === 'FLAT' || b.roof.ridgeM === undefined) continue
    const sep = apart(b.id)
    out.push({ id: `roof-${b.id}`, hostBodyId: b.id, rect: box(b.rect), kind: b.roof.kind, ridgeAxis: b.roof.ridgeAxis ?? 'X', eaveY: b.roof.eavesM, ridgeY: b.roof.ridgeM, ...(b.roof.kind === 'HIP' && b.roof.hipRunM !== undefined ? { hipRunM: b.roof.hipRunM } : {}), thicknessM: MINIATURE_CONVENTIONS.roofThicknessM, ...(sep.length > 0 ? { separateFrom: sep } : {}) })
  }
  for (const c of h.crossRoofs ?? []) if (out.some((r) => r.id === `roof-${c.over}`)) out.push({ id: c.id, hostBodyId: c.over, rect: box(c.rect), kind: 'GABLE', ridgeAxis: c.ridgeAxis, eaveY: c.eavesM, ridgeY: c.ridgeM, thicknessM: MINIATURE_CONVENTIONS.roofThicknessM, over: `roof-${c.over}` })
  return out
}
export function roofSystemOf(h: Pick<MassingHypothesis, 'bodies' | 'crossRoofs' | 'separateRoofs'>): RoofSystemSolution {
  return solveRoofSystem(roofRegionsOf(h))
}
/** The bodies whose roofs are laid out in planes together: a joined region with no violation, and every region it meets. */
export function joinedBodiesOf(sol: RoofSystemSolution): Set<string> {
  const bad = new Set(sol.violations.map((v) => v.regionId))
  return new Set(sol.regions.filter((r) => r.joined && !bad.has(r.id)).map((r) => r.hostBodyId))
}
export const ROOF_SYSTEM_ID = 'roofsys-main' as const

/**
 * The commands of the joined part of a roof system: every plane as the solver cut it (`createRoofPlane`), the creases
 * between them with their kinds and segments (`connectRoofPlanes`: RIDGE, HIP, VALLEY), the free edges (`createRoofEdge`:
 * EAVE, VERGE, ABUTMENT), the walls under them following the planes that cover them, and one ROOF assembly that names
 * the planes and edges as one roof. The same statements the drawings' solver emits for its valley-cut roofs.
 */
export function roofSystemCommands(sol: RoofSystemSolution, bodies: readonly BodySpec[], levelId: string, t: number): BuildingCommand[] {
  const joined = joinedBodiesOf(sol)
  const regions = sol.regions.filter((r) => joined.has(r.hostBodyId))
  const ids = new Set(regions.map((r) => r.id))
  const planes = sol.planes.filter((p) => ids.has(p.regionId))
  if (planes.length === 0) return []
  const cmds: BuildingCommand[] = []
  for (const p of planes) cmds.push({ type: 'createRoofPlane', id: p.id, levelId, boundary: p.boundary, datum: p.datum, pitchDeg: p.pitchDeg, downslope: p.downslope, thickness: p.thicknessM } as BuildingCommand)
  const planeIds = new Set(planes.map((p) => p.id))
  const edgeIds: string[] = []
  for (const c of sol.creases) {
    if (!planeIds.has(c.planeIds[0]) || !planeIds.has(c.planeIds[1])) continue
    cmds.push({ type: 'connectRoofPlanes', id: c.id, kind: c.kind, planeIds: c.planeIds, segment: { start: c.start, end: c.end } } as BuildingCommand)
    edgeIds.push(c.id)
  }
  for (const e of sol.freeEdges) {
    if (!planeIds.has(e.planeId)) continue
    cmds.push({ type: 'createRoofEdge', id: e.id, kind: e.kind, planeId: e.planeId, start: e.start, end: e.end } as BuildingCommand)
    edgeIds.push(e.id)
  }
  // each wall of a joined body dies into the planes that stand over it (sampled inside its own thickness: a plane that
  // only touches the wall's outer line — a lower roof meeting it from outside — is not over it)
  for (const b of bodies) {
    if (!joined.has(b.id)) continue
    const r = b.rect
    const lines: Array<[{ x: number; z: number }, { x: number; z: number }, { x: number; z: number }]> = [
      [{ x: r.minX, z: r.minZ }, { x: r.maxX, z: r.minZ }, { x: 0, z: 1 }],
      [{ x: r.maxX, z: r.minZ }, { x: r.maxX, z: r.maxZ }, { x: -1, z: 0 }],
      [{ x: r.maxX, z: r.maxZ }, { x: r.minX, z: r.maxZ }, { x: 0, z: -1 }],
      [{ x: r.minX, z: r.maxZ }, { x: r.minX, z: r.minZ }, { x: 1, z: 0 }],
    ]
    lines.forEach(([a, e, inward], i) => {
      const over = new Set<string>()
      for (let k = 0; k <= 24; k += 1) for (const c of [0.02, t / 2, t - 0.02]) {
        const f = 0.005 + (0.99 * k) / 24
        const q = { x: a.x + (e.x - a.x) * f + inward.x * c, z: a.z + (e.z - a.z) * f + inward.z * c }
        for (const p of planes) if (pointInPoly(q, p.boundary, 1e-9)) over.add(p.id)
      }
      if (over.size > 0) cmds.push({ type: 'setProperty', targetId: `ring-${b.id}-w${i}`, property: 'topProfile', value: { kind: 'FOLLOW_ROOF_PLANES', planeIds: [...over].sort() } } as BuildingCommand)
    })
  }
  const kinds = new Set(regions.map((r) => r.kind))
  cmds.push({ type: 'createAssembly', assembly: { id: ROOF_SYSTEM_ID, kind: 'ROOF', classification: sol.creases.some((c) => c.kind === 'VALLEY' && planeIds.has(c.planeIds[0])) ? 'INTERSECTING' : kinds.size > 1 ? 'COMPOSITE' : kinds.has('HIP') ? 'HIP' : 'GABLE', planeIds: [...planeIds], edgeIds, openingIds: [], dormerIds: [], chimneyIds: [], trimIds: [], hostIds: bodies.filter((b) => joined.has(b.id)).map((b) => `ring-${b.id}`), quality: 'COMPLETE' } } as BuildingCommand)
  return cmds
}

/** BUILD_MASSING: the whole mass from nothing (no model, or no exterior walls): one level, one ring per body and the roofs — each body's own, or the house's roof system where roofs meet. */
export function massingCommands(h: MassingHypothesis, model: CanonicalBuildingModel): BuildingCommand[] {
  const top = Math.max(...h.bodies.map((b) => (b.roof.kind !== 'FLAT' ? b.roof.ridgeM ?? b.roof.eavesM : b.roof.eavesM)))
  const cmds: BuildingCommand[] = []
  if (!model.building) cmds.push({ type: 'createBuilding', id: 'building', name: 'massing' } as BuildingCommand)
  const levelId = model.levels[0]?.id ?? 'lvl-0'
  if (model.levels.length === 0) cmds.push({ type: 'createLevel', id: levelId, name: 'Massing', index: 0, elevation: 0, height: r6(top) } as BuildingCommand)
  const rects = h.bodies.map((b) => b.rect)
  const levelElevation = model.levels[0]?.elevation ?? 0
  // v3.54.18 (massing 1.1.0): the roof covering's material, as the drawings' solver names it. Its tone is NOT read from
  // the source here (the sketch contract carries no roof finish): a named miniature convention, so the roof is not left
  // without a material (a pale roof on a body built without LOCAL — R3's open item 4).
  for (const mat of MINIATURE_PALETTE) if (!model.materials.some((x) => x.id === mat.id)) cmds.push({ type: 'defineMaterial', ...mat } as BuildingCommand)
  const sol = roofSystemOf(h)
  const joined = joinedBodiesOf(sol)
  const dress = (c: BuildingCommand): BuildingCommand => (c.type === 'createRoof' || c.type === 'createRoofPlane' ? ({ ...c, materialId: MINIATURE_CONVENTIONS.roofMaterialId } as BuildingCommand) : c.type === 'createWallRing' ? ({ ...c, materialId: 'mat-wall' } as BuildingCommand) : c)
  for (const b of h.bodies) {
    if (!joined.has(b.id)) { cmds.push(...bodyCommands(b, levelId, levelElevation, rects.filter((r) => r !== b.rect), h.wallThicknessM).map(dress)); continue }
    // a body under the roof system: its ring to the highest ridge it carries; its walls then die into the planes over them
    const r = b.rect
    const ridge = Math.max(...sol.regions.filter((q) => q.hostBodyId === b.id).map((q) => q.ridgeY))
    cmds.push(dress({ type: 'createWallRing', id: `ring-${b.id}`, levelId, polygon: [{ x: r.minX, z: r.minZ }, { x: r.maxX, z: r.minZ }, { x: r.maxX, z: r.maxZ }, { x: r.minX, z: r.maxZ }], thickness: h.wallThicknessM, height: r6(ridge - levelElevation), baseOffset: 0, kind: 'EXTERIOR', cornerOwnership: 'ALTERNATE' } as BuildingCommand))
  }
  cmds.push(...roofSystemCommands(sol, h.bodies, levelId, h.wallThicknessM).map(dress))
  return cmds
}

/** The bodies of a model as the kernel holds them: each exterior wall ring with the roofs and planes that stand over it. */
export type ModelBody = { id: string; ringIds: string[]; levelIds: string[]; wallIds: string[]; rect: Rect; roofIds: string[]; planeIds: string[] }
export function bodiesOf(m: CanonicalBuildingModel): ModelBody[] {
  const wallById = new Map(m.walls.map((w) => [w.id, w]))
  const rings = m.wallRings.map((r) => ({ id: r.id, levelId: r.levelId, walls: r.wallIds.map((id) => wallById.get(id)).filter((w): w is Wall => !!w && w.kind === 'EXTERIOR') })).filter((r) => r.walls.length > 0)
  const rectOf = (ws: Wall[]): Rect => ({ minX: Math.min(...ws.flatMap((w) => [w.start.x, w.end.x])), maxX: Math.max(...ws.flatMap((w) => [w.start.x, w.end.x])), minZ: Math.min(...ws.flatMap((w) => [w.start.z, w.end.z])), maxZ: Math.max(...ws.flatMap((w) => [w.start.z, w.end.z])) })
  // rings of different storeys over one footprint are one body
  const bodies: ModelBody[] = []
  for (const r of rings) {
    const rect = rectOf(r.walls)
    const same = bodies.find((b) => Math.abs(b.rect.minX - rect.minX) < 0.15 && Math.abs(b.rect.maxX - rect.maxX) < 0.15 && Math.abs(b.rect.minZ - rect.minZ) < 0.15 && Math.abs(b.rect.maxZ - rect.maxZ) < 0.15)
    if (same) {
      same.ringIds.push(r.id)
      same.levelIds.push(r.levelId)
      same.wallIds.push(...r.walls.map((w) => w.id))
    } else bodies.push({ id: r.id, ringIds: [r.id], levelIds: [r.levelId], wallIds: r.walls.map((w) => w.id), rect, roofIds: [], planeIds: [] })
  }
  // v3.54.17 R3: exterior walls a reconstruction built without a WallRing record (its envelope walls named <body>-w<n>,
  // split walls <body>-w<n>-<k>) are that body's walls: grouped by the name and storey, never left for a roof to stand
  // over nothing (a body counted from its roof's footprint is as wide as the roof's overhang, not as its walls)
  const inRing = new Set(rings.flatMap((r) => r.walls.map((w) => w.id)))
  const envelopes = new Map<string, Wall[]>()
  for (const w of m.walls) {
    if (w.kind !== 'EXTERIOR' || inRing.has(w.id)) continue
    const k = /^(.+)-w\d+(?:-\d+)?$/.exec(w.id)
    if (!k) continue
    const key = `${k[1]}|${w.levelId}`
    envelopes.set(key, [...(envelopes.get(key) ?? []), w])
  }
  for (const [key, ws] of [...envelopes].sort((x, y) => x[0].localeCompare(y[0]))) {
    if (ws.length < 3) continue
    const rect = rectOf(ws)
    const id = key.split('|')[0]
    const same = bodies.find((b) => Math.abs(b.rect.minX - rect.minX) < 0.15 && Math.abs(b.rect.maxX - rect.maxX) < 0.15 && Math.abs(b.rect.minZ - rect.minZ) < 0.15 && Math.abs(b.rect.maxZ - rect.maxZ) < 0.15)
    if (same) {
      same.levelIds.push(ws[0].levelId)
      same.wallIds.push(...ws.map((w) => w.id))
    } else bodies.push({ id, ringIds: [], levelIds: [ws[0].levelId], wallIds: ws.map((w) => w.id), rect, roofIds: [], planeIds: [] })
  }
  const contains = (b: Rect, x: number, z: number): boolean => x >= b.minX - 0.05 && x <= b.maxX + 0.05 && z >= b.minZ - 0.05 && z <= b.maxZ + 0.05
  const smallest = (x: number, z: number): ModelBody | undefined => bodies.filter((b) => contains(b.rect, x, z)).sort((a, b) => area(a.rect) - area(b.rect))[0]
  // a roof or a group of touching planes over no ring is a body of its own (a model of roofs without walls still has
  // its bodies counted, not its roofs)
  const orphans: Array<{ rect: Rect; roofIds: string[]; planeIds: string[] }> = []
  const touches = (a: Rect, b: Rect): boolean => a.minX <= b.maxX + 0.05 && b.minX <= a.maxX + 0.05 && a.minZ <= b.maxZ + 0.05 && b.minZ <= a.maxZ + 0.05
  const adopt = (rect: Rect, roofId?: string, planeId?: string): void => {
    const o = planeId ? orphans.find((x) => x.planeIds.length > 0 && touches(x.rect, rect)) : undefined
    if (o) {
      o.rect = { minX: Math.min(o.rect.minX, rect.minX), maxX: Math.max(o.rect.maxX, rect.maxX), minZ: Math.min(o.rect.minZ, rect.minZ), maxZ: Math.max(o.rect.maxZ, rect.maxZ) }
      if (planeId) o.planeIds.push(planeId)
      return
    }
    orphans.push({ rect, roofIds: roofId ? [roofId] : [], planeIds: planeId ? [planeId] : [] })
  }
  for (const roof of m.roofs) {
    const b = smallest((roof.footprint.minX + roof.footprint.maxX) / 2, (roof.footprint.minZ + roof.footprint.maxZ) / 2)
    if (b) b.roofIds.push(roof.id)
    else adopt({ ...roof.footprint }, roof.id)
  }
  for (const pl of m.roofPlanes) {
    const pts = pl.boundary
    if (pts.length === 0) continue
    const b = smallest(pts.reduce((a, p) => a + p.x, 0) / pts.length, pts.reduce((a, p) => a + p.z, 0) / pts.length)
    if (b) b.planeIds.push(pl.id)
    else adopt({ minX: Math.min(...pts.map((p) => p.x)), maxX: Math.max(...pts.map((p) => p.x)), minZ: Math.min(...pts.map((p) => p.z)), maxZ: Math.max(...pts.map((p) => p.z)) }, undefined, pl.id)
  }
  for (const [i, o] of orphans.entries()) bodies.push({ id: `roofed-${i}`, ringIds: [], levelIds: [], wallIds: [], rect: o.rect, roofIds: o.roofIds, planeIds: o.planeIds })
  return bodies
}
