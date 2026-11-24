/**
 * v3.54.16 — the one executor of supported corrections, on the model that stands.
 *
 *   validate (registry, revision, numbers) → bind (source picture → registration → host wall / level / roof) →
 *   source gate (the proposal against the ORIGINAL picture; the model's element as the other hypothesis) →
 *   apply on a copy (`@buildapp/commands`, or the appearance consumer for a finish) → dependents restated in the same
 *   transaction → compile → measure (the built element back in the source picture; every object outside the
 *   transaction's dependency set byte for byte the same) → commit, or roll back with the reason.
 *
 * Independent proposals are independent transactions: a good chimney stays when a window proposal beside it is
 * refused. Proposals that share a `group` are one transaction and stand or fall together. Nothing here re-runs the
 * analyzer: the model that stands is edited by the same commands the analyzer emits, so its ids, rooms, relations,
 * materials and every element the patch is not about are carried over unchanged — and that is measured, not assumed.
 *
 * v3.54.16 audit fixes (executor 1.1.0):
 *  - A2: an opening hypothesis is its full shape (a raked head's two ends) and its exact kind (WINDOW, DOOR,
 *    GLAZED_DOOR, GARAGE_DOOR). Place and size are judged by the polygon gate; a change of kind on the same shape by the
 *    separate fill measure; the built opening is measured by its head ends and its kind, not by its bounding box alone.
 *  - A3: a printed value witnesses a parameter only as a bound observation — its role matches the property, it is
 *    anchored to a source frame with a byte hash, it is on the picture the proposal names, and in a model of several
 *    bodies it names the same body as the proposal. A number that merely equals the proposed one is not a witness;
 *    two equal numbers on different bodies are ambiguous, never mutual confirmation.
 *
 * v3.54.17 R3 (executor 1.4.0):
 *  - an opening removed or re-cut takes its own relationships with it (an alignment with an opening round the corner);
 *  - a stack's depth without a second view is read on the parametric roofs too (a massing/LOCAL model has no roof
 *    planes: every stack stood mid-depth, one drawn behind the ridge in front of it); a stack whose plan footprint
 *    overlaps one standing is that stack seen again (DUPLICATE), whatever view it was read from;
 *  - the eaves overhang read on a gable view is capped at the reach that clears other bodies' roofs and walls (an
 *    annex's parapet) — named with both values, never built into them.
 */
import { applyCommands } from '@buildapp/commands'
import type { BuildingCommand } from '@buildapp/commands'
import { compileBuilding, geometryClosureAudit, roofGeometry } from '@buildapp/geometry'
import { serializeModel, validateModel } from '@buildapp/model'
import type { CanonicalBuildingModel, Opening, Wall } from '@buildapp/model'
import { sha256Hex, stableJson } from '@buildapp/source-common'
import type { Raster } from '@buildapp/source-package'
import { applyAppearance, usableGeometryFingerprint } from '../../appearance/consumer.js'
import { APPEARANCE_OBSERVATION_SCHEMA, APPEARANCE_OBSERVATION_VERSION } from '../../appearance/contract.js'
import type { AppearanceObservation } from '../../appearance/contract.js'
import { CAPABILITIES, CORRECTION_REGISTRY_VERSION, isPatchOperation } from './registry.js'
import type { PatchFields, PatchOperation } from './registry.js'
import { compareFill, compareHypotheses, HYPOTHESIS_Z_MARGIN, iou, isRaked, supportOf, SOURCE_GATE_VERSION, SUPPORT_Z_MIN } from './source-gate.js'
import type { Box, FillVerdict, HypothesisVerdict, Shape } from './source-gate.js'
import { resolveWitness, WITNESS_RESOLVER_VERSION } from './resolve.js'
import { bindBuildMassing, bindSetOutline, bindSetRoof, MAX_OVERHANG_M } from '../massing/ops.js'
import type { MassingObservations } from '../massing/ops.js'
import { bindBuildInterior } from './interior.js'
import type { InteriorObservation } from './interior.js'

export const CORRECTION_EXECUTOR_VERSION = '1.9.0' as const

export type Side = 'FRONT' | 'RIGHT' | 'REAR' | 'LEFT'
export const SIDES: readonly Side[] = ['FRONT', 'RIGHT', 'REAR', 'LEFT']
export type Projection = { mpp: number; mppV?: number; alongAtPx0: number; alongSign: 1 | -1; zeroRow: number }
/** A registration the binder may place through: the analyzer's own (facadeAlignment.views) or one a transaction assigned. */
export type BindView = {
  side: Side
  frameId: string
  projection: Projection
  /** Heights low on the walls (sills, heads) may be read through it. */
  heights: boolean
  /** v3.54.16: the vertical is anchored at the apex on the ridge datum — heights near the roof (a stack's top) are read even where low ones were refused. */
  roofAnchored?: boolean
  /** v3.54.17 R3: SKETCH — registered from the provider's sketch of that elevation (its wall ends against the plan's side, its
   *  ground row behind whatever stands in front of the house), accepted only when the model's eaves land on the sketch's. */
  origin: 'ANALYZER' | 'ASSIGNED' | 'SKETCH'
  alongErrorM: number
  heightErrorM: number
}
/** A source picture as the reviewer saw it: its frame, the downscale to that frame, the frame's raster. */
export type BindPicture = { n: number; frameId: string; projection: string; transform: { x0: number; y0: number; scale: number }; raster: Raster; sourceByteHash: string }
/** A printed value someone other than the proposer read (the analyzer's metric evidence or the independent metric read). */
export type PrintedWitness = {
  valueM: number
  unit: 'm' | 'deg'
  frameId: string
  by: 'ANALYZER' | 'METRIC_READ'
  literal?: string
  /** v3.54.16 audit A3: what the printed mark marks (FLOOR, EAVES, CEILING, RIDGE, CHIMNEY, ROOF_PITCH …); absent = unknown. */
  role?: string
  /** The body or element the mark belongs to, as the source names it (absent = not named). */
  host?: string
  /** The datum the level is measured from (the reader's reference: FINISHED_LEVEL, STRUCTURAL_LEVEL, TERRAIN, UNKNOWN). */
  datum?: string
  /** v3.54.17: where the mark is printed, in its frame's pixels (the text box): what puts it on a body. */
  box?: Box
  /** The source variant the mark was read on. */
  sourceByteHash?: string
  observationId?: string
}

export type CorrectionProposal = {
  proposalId: string
  baseRevision: string
  operation: string
  targetId: string
  defectId?: string
  group?: string
  patch?: PatchFields
  /** Coordinates already in this frame's pixels (a sketch read on the original elevation), instead of a numbered picture. */
  frameId?: string
  uncertainty?: 'LOW' | 'MEDIUM' | 'HIGH'
  justification?: string
  /** METRIC (v3.54.17 R3): made by the analyzer from the independent metric read's printed dimensions. */
  /** v3.54.19 ADD_PLAN_OPENING: a gap the plan draws in a wall (its span along the side, metres of the model) with the kind, sill and height one metric reading of that side's elevation gives for the same stretch. */
  planOpening?: { side: Side; a0: number; a1: number; kind: OpeningPatchKindExact; sillM: number; heightM: number; gapId: string; frameId: string; share: number }
  /** PLAN (v3.54.19): made by the analyzer from the plan skeleton (BUILD_INTERIOR, ADD_PLAN_OPENING). */
  origin: 'REVIEW' | 'SKETCH' | 'CONTROL' | 'METRIC' | 'PLAN'
}

export type PatchStatus = 'COMMITTED' | 'REJECTED_BY_SOURCE' | 'NEEDS_EVIDENCE' | 'UNSUPPORTED_OPERATION' | 'INVALID' | 'STALE_REVISION' | 'DUPLICATE' | 'HELD' | 'ROLLED_BACK' | 'GROUP_ROLLED_BACK' | 'DEFERRED_ROOF_FEATURE' | 'NO_EFFECT'

export type PatchRecord = {
  proposalId: string
  defectId?: string
  group?: string
  operation: string
  targetId: string
  origin: CorrectionProposal['origin']
  status: PatchStatus
  code?: string
  why: string
  txId?: string
  /** What the patch was bound to: the source frame and its pixels, the side, the host, the ids it creates or changes. */
  bound?: { frameId: string; side?: Side; box?: Box; hostId?: string; ids: string[]; /** v3.54.18: openings that gave way to this one, each with its own support z on the picture. */ displaced?: Record<string, number | null>; depth?: 'SECOND_VIEW' | 'ROOF_MEET_LINE' | 'DISPLAY_ASSUMPTION'; values?: Record<string, number> ; /** v3.54.19: the head of a door or gate cut to the top of its wall (it was drawn a little above the wall top the model has) */ headCut?: { fromM: number; toM: number; wallId: string }; /** v3.54.19: the opening cut back to the end of the wall that holds most of it */ endClip?: { fromM: [number, number]; toM: [number, number]; wallId: string } }
  source?: { frameId: string; sourceByteHash: string; crop?: Box }
  gate?: { winner: HypothesisVerdict['winner']; proposedZ: number | null; currentZ?: number | null; nullBoxes: number; /** 1.3.0: the band the z was read against (absent: JOINT). */ nullMode?: 'JOINT' | 'CLAIMS_ROBUST' | 'DISPLACED'; /** v3.54.18: the picture did not decide this element; it follows the adopted reading of its facade (never source-verified). */ adopted?: true; /** v3.54.18: the opening's span is the plan's and this reading's alike; only ASSUMED properties were replaced. */ crossWitness?: 'PLAN_SPAN'; why: string; /** 1.1.0: BOX, POLYGON (a raked head on either side) or FILL (a change of kind on the same shape). */ measure?: 'BOX' | 'POLYGON' | 'FILL' | 'REGION'; fill?: Pick<FillVerdict, 'observed' | 'features'> }
  measure?: { builtBox?: Box; iouWithProposal?: number; builtSupportZ?: number | null; headErrorPx?: number; builtKind?: string; sourceVerified: boolean | null; why: string }
  commands?: BuildingCommand[]
  /** v3.54.17: how a printed witness was bound to the target (its observation, the body both stand on, the datum). */
  witness?: WitnessResolution
  /** v3.54.17: the body/roof hypothesis a massing patch built (bodies, provenance, missing anchors, dependants). */
  massing?: Record<string, unknown>
}
export type WitnessResolution = { observationId?: string; frameId: string; bodyId?: string; alongM?: number; targetBodyIds?: string[]; datum: string; resolver: string; why: string }

export type TransactionRecord = { txId: string; patches: string[]; group?: string; decision: 'COMMITTED' | 'ROLLED_BACK' | 'REFUSED'; why: string; changed: string[]; allowed: string[]; collateral: string[]; closureBefore: number; closureAfter?: number; revisionBefore: string; revisionAfter?: string }

export type CorrectionOutcome = {
  registry: string
  executor: string
  gate: string
  baseRevision: string
  revision: string
  model: CanonicalBuildingModel
  records: PatchRecord[]
  transactions: TransactionRecord[]
  views: BindView[]
}

export const modelRevision = (m: CanonicalBuildingModel): string => sha256Hex(serializeModel(m)).slice(0, 12)

// ---------------------------------------------------------------------------------------------------------------
// geometry of sides, walls and pictures
// ---------------------------------------------------------------------------------------------------------------

const r6 = (v: number): number => Math.round(v * 1e6) / 1e6
const alongAxis = (s: Side): 'x' | 'z' => (s === 'FRONT' || s === 'REAR' ? 'x' : 'z')
/** The side's outward direction along the other axis (FRONT at the lowest z, as the analyzer's frames place it). */
const outward = (s: Side): 1 | -1 => (s === 'REAR' || s === 'RIGHT' ? 1 : -1)
export const sideOfFacade = (f: string): Side | undefined => (f === 'FRONT' ? 'FRONT' : f === 'REAR' ? 'REAR' : f === 'EAST' || f === 'RIGHT' ? 'RIGHT' : f === 'WEST' || f === 'LEFT' ? 'LEFT' : undefined)
const facadeOfSide = (s: Side): 'FRONT' | 'REAR' | 'EAST' | 'WEST' => (s === 'RIGHT' ? 'EAST' : s === 'LEFT' ? 'WEST' : s)

const wallLen = (w: Wall): number => Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z)
const parallelTo = (w: Wall, s: Side): boolean => {
  const L = wallLen(w)
  if (L < 0.05) return false
  const d = alongAxis(s) === 'x' ? Math.abs(w.end.z - w.start.z) : Math.abs(w.end.x - w.start.x)
  return d / L < 0.05
}
const exteriorWalls = (m: CanonicalBuildingModel): Wall[] => m.walls.filter((w) => w.kind === 'EXTERIOR')
const centre = (m: CanonicalBuildingModel): { x: number; z: number } => {
  const ws = exteriorWalls(m)
  const xs = ws.flatMap((w) => [w.start.x, w.end.x])
  const zs = ws.flatMap((w) => [w.start.z, w.end.z])
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 }
}
/** The side an exterior wall faces, from its orientation and where it stands against the building's middle. */
export function sideOfWall(m: CanonicalBuildingModel, w: Wall): Side | undefined {
  const c = centre(m)
  const mid = { x: (w.start.x + w.end.x) / 2, z: (w.start.z + w.end.z) / 2 }
  if (parallelTo(w, 'FRONT')) return mid.z < c.z ? 'FRONT' : 'REAR'
  if (parallelTo(w, 'LEFT')) return mid.x < c.x ? 'LEFT' : 'RIGHT'
  return undefined
}
/** The walled range of a side along its axis. */
export function sideRange(m: CanonicalBuildingModel, s: Side): { lo: number; hi: number } | undefined {
  const ws = exteriorWalls(m).filter((w) => sideOfWall(m, w) === s)
  if (ws.length === 0) return undefined
  const a = alongAxis(s)
  const vs = ws.flatMap((w) => [w.start[a], w.end[a]])
  return { lo: Math.min(...vs), hi: Math.max(...vs) }
}
export const levelOf = (m: CanonicalBuildingModel, id: string): { elevation: number; height: number } => m.levels.find((l) => l.id === id) ?? { elevation: 0, height: 3 }

const pxOf = (p: Projection, along: number): number => (along - p.alongAtPx0) / (p.alongSign * p.mpp)
const alongOf = (p: Projection, px: number): number => p.alongAtPx0 + p.alongSign * p.mpp * px
const yOf = (p: Projection, py: number): number => (p.zeroRow - py) * (p.mppV ?? p.mpp)
const pyOf = (p: Projection, y: number): number => p.zeroRow - y / (p.mppV ?? p.mpp)
export const tolPxOf = (v: BindView): number => Math.max(2, Math.min(8, Math.ceil(Math.max(v.alongErrorM, 0.03) / v.projection.mpp)))

/** Where along its side an opening of the model is, and how high. */
export function openingSpan(m: CanonicalBuildingModel, o: Opening): { side: Side; a0: number; a1: number; y0: number; y1: number; wall: Wall } | undefined {
  const w = m.walls.find((x) => x.id === o.wallId)
  if (!w || w.kind !== 'EXTERIOR') return undefined
  const side = sideOfWall(m, w)
  if (!side) return undefined
  const L = wallLen(w)
  const ax = alongAxis(side)
  const at = (u: number): number => w.start[ax] + ((w.end[ax] - w.start[ax]) * u) / L
  const base = levelOf(m, w.levelId).elevation + w.baseOffset
  const p = [at(o.offset), at(o.offset + o.width)]
  return { side, a0: Math.min(...p), a1: Math.max(...p), y0: base + o.sill, y1: base + o.sill + o.height, wall: w }
}
const boxOfSpan = (v: BindView, s: { a0: number; a1: number; y0: number; y1: number }): Box => {
  const xs = [pxOf(v.projection, s.a0), pxOf(v.projection, s.a1)]
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: pyOf(v.projection, s.y1), y1: pyOf(v.projection, s.y0) }
}
/** v3.54.16: the model's EXTERIOR openings on one side, in metres along the side's axis and up (interior doors never). */
/**
 * v3.54.18 R2 — the gaps a LOCAL model traced on the PLAN, kept as evidence when its body is replaced. The place of an
 * opening along its wall is read from one drawing (the plan), the elevation reading draws it on another: where the two
 * give the same span, they are two drawings agreeing — whichever body stands. Only gaps whose place came from the plan
 * are taken; the assumed sill and height of such an opening are no evidence and are not carried.
 */
export type PlanGap = { id: string; side: Side; a0: number; a1: number; storeyLo: number; storeyHi: number }
export function planGapsOf(m: CanonicalBuildingModel): PlanGap[] {
  const out: PlanGap[] = []
  const fromPlan = (v: string | undefined): boolean => v === 'SOURCE_DERIVED' || v === 'SOURCE_EXACT'
  for (const o of m.openings) {
    const ev = (o as { evidence?: { properties?: Record<string, string> } }).evidence?.properties
    if (!ev || !fromPlan(ev.offset) || !fromPlan(ev.width)) continue
    const sp = openingSpan(m, o)
    if (!sp || sp.wall.kind !== 'EXTERIOR') continue
    const level = m.levels.find((l) => l.id === sp.wall.levelId)
    if (!level) continue
    out.push({ id: o.id, side: sp.side, a0: r6(sp.a0), a1: r6(sp.a1), storeyLo: level.elevation, storeyHi: level.elevation + level.height })
  }
  return out
}

export function sideOpeningSpans(m: CanonicalBuildingModel, side: Side): Array<{ id: string; a0: number; a1: number; b0: number; b1: number }> {
  return m.openings.flatMap((o) => {
    const s = openingSpan(m, o)
    return s && s.side === side ? [{ id: o.id, a0: s.a0, a1: s.a1, b0: s.y0, b1: s.y1 }] : []
  })
}
/** The model's openings drawn on one view, as boxes in its frame pixels. */
export function openingBoxes(m: CanonicalBuildingModel, v: BindView): Array<{ id: string; box: Box }> {
  return m.openings.flatMap((o) => {
    const s = openingSpan(m, o)
    return s && s.side === v.side ? [{ id: o.id, box: boxOfSpan(v, s) }] : []
  })
}
/** v3.54.18: the share of the longer span an update must share with the model's plan-traced opening to be the same opening. */
export const PLAN_SPAN_AGREE = 0.7
/** v3.54.19: a door's or gate's head may be cut to its wall's top when it overshoots by at most this share of its own height. */
export const HEAD_CUT_MAX_SHARE = 0.25
/** v3.54.19: an opening running past the end of a wall is kept in that wall when at least this share of its width lies in it. */
export const END_CLIP_MIN_SHARE = 0.85
export type OpeningPatchKindExact = 'WINDOW' | 'DOOR' | 'GLAZED_DOOR' | 'GARAGE_DOOR'
/** A2: the exact kind of a model opening, from its fill (a glazed leaf, a garage door), never WINDOW / not-WINDOW. */
export function kindOfOpening(m: CanonicalBuildingModel, id: string): OpeningPatchKindExact | undefined {
  if (m.windows.some((w) => w.openingId === id)) return 'WINDOW'
  const d = m.doors.find((x) => x.openingId === id)
  if (!d) return undefined
  const panels = (d as { assembly?: { panels: Array<{ kind: string; glazing?: string }> } }).assembly?.panels ?? []
  if ((d as { usage?: string }).usage === 'GARAGE' || (panels.length > 0 && panels.every((p) => p.kind === 'PANEL'))) return 'GARAGE_DOOR'
  if (panels.some((p) => p.kind === 'LEAF' && p.glazing === 'FULL')) return 'GLAZED_DOOR'
  return 'DOOR'
}
/** A2: a model opening on one view as its shape: its box and, for a raked head, the head's two ends in the frame. */
export function shapeOfOpening(m: CanonicalBuildingModel, o: Opening, v: BindView): Shape | undefined {
  const s = openingSpan(m, o)
  if (!s || s.side !== v.side) return undefined
  const box = boxOfSpan(v, s)
  if (o.head?.kind !== 'RAKED') return box
  const ax = alongAxis(s.side)
  const L = wallLen(s.wall)
  const nearAlong = s.wall.start[ax] + ((s.wall.end[ax] - s.wall.start[ax]) * o.offset) / L
  const base = levelOf(m, s.wall.levelId).elevation + s.wall.baseOffset
  const yNear = pyOf(v.projection, base + o.sill + o.height)
  const yFar = pyOf(v.projection, base + o.sill + o.head.heightFar)
  const nearIsLeft = Math.abs(pxOf(v.projection, nearAlong) - box.x0) <= Math.abs(pxOf(v.projection, nearAlong) - box.x1)
  const headLeftY = nearIsLeft ? yNear : yFar
  const headRightY = nearIsLeft ? yFar : yNear
  return { ...box, y0: Math.min(headLeftY, headRightY), headLeftY, headRightY }
}
/** Two opening shapes are the same geometry: one box (overlap ≥ 0.9) and, when raked, the same head ends within tol. */
const sameShape = (a: Shape, b: Shape): boolean => {
  if (iou(a, b) < 0.9 || isRaked(a) !== isRaked(b)) return false
  if (!isRaked(a)) return true
  const tol = Math.max(2, 0.04 * (a.y1 - a.y0))
  return Math.abs((a.headLeftY as number) - (b.headLeftY as number)) <= tol && Math.abs((a.headRightY as number) - (b.headRightY as number)) <= tol
}
const headError = (a: Shape, b: Shape): number => (isRaked(a) && isRaked(b) ? Math.max(Math.abs((a.headLeftY as number) - (b.headLeftY as number)), Math.abs((a.headRightY as number) - (b.headRightY as number))) : isRaked(a) || isRaked(b) ? Infinity : Math.max(Math.abs(a.y0 - b.y0), 0))

/** The side's wall area in the view's pixels: its walled range across, ground floor to the lowest wall top up. */
export const facadePx = (m: CanonicalBuildingModel, v: BindView): { x0: number; x1: number; y0?: number; y1?: number } => {
  const r = sideRange(m, v.side)
  if (!r) return { x0: 0, x1: 0 }
  const xs = [pxOf(v.projection, r.lo), pxOf(v.projection, r.hi)]
  const ws = exteriorWalls(m).filter((w) => sideOfWall(m, w) === v.side)
  const floor = Math.min(...ws.map((w) => levelOf(m, w.levelId).elevation + w.baseOffset))
  const top = Math.min(...ws.map((w) => levelOf(m, w.levelId).elevation + w.baseOffset + w.height))
  return { x0: Math.min(...xs), x1: Math.max(...xs), ...(v.heights && Number.isFinite(floor) && Number.isFinite(top) ? { y0: pyOf(v.projection, top), y1: pyOf(v.projection, floor) } : {}) }
}

// ---------------------------------------------------------------------------------------------------------------
// objects and their digests: what a transaction changed
// ---------------------------------------------------------------------------------------------------------------

export function objectDigests(m: CanonicalBuildingModel): Map<string, string> {
  const out = new Map<string, string>()
  for (const [k, v] of Object.entries(m as unknown as Record<string, unknown>)) {
    if (Array.isArray(v)) for (const o of v as Array<{ id?: string }>) out.set(`${k}:${o.id ?? stableJson(o, 0).slice(0, 40)}`, sha256Hex(stableJson(o, 0)))
    else out.set(k, sha256Hex(stableJson(v ?? null, 0)))
  }
  return out
}
const changedKeys = (a: Map<string, string>, b: Map<string, string>): string[] => [...new Set([...a.keys(), ...b.keys()])].filter((k) => a.get(k) !== b.get(k)).sort()

// ---------------------------------------------------------------------------------------------------------------
// binding: one proposal → commands (or an appearance observation), the ids it may change, what to measure
// ---------------------------------------------------------------------------------------------------------------

export type Expect =
  | { kind: 'OPENING'; id: string; view: BindView; box: Box; shape: Shape; levelId: string; openingKind: OpeningPatchKindExact; fillChangeFrom?: OpeningPatchKindExact; adopted?: true }
  | { kind: 'REMOVED'; id: string; adopted?: true }
  | { kind: 'CHIMNEY'; id: string; view: BindView; box: Box }
  | { kind: 'FINISH'; hosts: string[] }
  | { kind: 'PARAM'; targetId: string; property: string; value: number }
  | { kind: 'VIEW'; view: BindView }
  /** v3.54.17: the body and roof operations measure their own effect on the compiled candidate (massing/ops.ts). */
  | { kind: 'CUSTOM'; measure: (working: CanonicalBuildingModel, before: CanonicalBuildingModel, pictures: readonly BindPicture[]) => { failure?: string; measure: NonNullable<PatchRecord['measure']> } }

export type Bound = { commands: BuildingCommand[]; appearance?: { obs: AppearanceObservation; projection: Projection }; allowed: string[]; expect: Expect; record: Pick<PatchRecord, 'bound' | 'source' | 'gate' | 'witness' | 'massing'>; /** v3.54.17: registrations the patch made (by the plan), kept with it. */ views?: BindView[]; /** v3.54.17: one edit of several objects at once (a moved ring), validated as a whole after the commands. */ transform?: (m: CanonicalBuildingModel) => CanonicalBuildingModel }
export type Refusal = { status: PatchStatus; code: string; why: string; record?: Pick<PatchRecord, 'bound' | 'source' | 'gate' | 'massing'> }

/** v3.54.17 R3: a registered plan sheet (pixels → world metres), for a printed dimension's line. */
export type BindPlan = { frameId: string; toWorld: (px: number, py: number) => { x: number; z: number } }
/** v3.54.17 R3: facts the publisher's page states in words (not printed on a drawing): the roof's pitch. */
export type PageFacts = { roofPitchDeg?: number }
export type Ctx = { model: CanonicalBuildingModel; views: BindView[]; pictures: readonly BindPicture[]; witnesses: readonly PrintedWitness[]; planGaps?: readonly PlanGap[]; massing?: MassingObservations; /** v3.54.19: the plan skeleton in the model's frame (BUILD_INTERIOR). */ interior?: InteriorObservation; plans?: readonly BindPlan[]; facts?: PageFacts; claims?: FacadeClaims; adopted?: ReadonlySet<string> }
/** v3.54.18 (gate 1.3.0): per source frame, every opening box the reading of that picture draws (frame pixels) — the places it does NOT call plain wall. */
export type FacadeClaims = ReadonlyMap<string, readonly Box[]>

const short = (s: string): string => sha256Hex(s).slice(0, 6)
/**
 * v3.54.19: the id of an element a proposal creates follows the proposal's OWN name, without the suffix a re-application
 * adds to it (`@<revision>` when the committed proposals are laid on a rebuilt base, `@p2` on a later pass). The same
 * source observation then builds the same element id on every base: a fate recorded at the first application still names
 * the element of the delivered model (until now it named an id the rebuild had replaced), and a reviewer's reference to
 * an element survives a rebuild. Where that id is already taken in the model, the full name is hashed as before.
 */
const stableShort = (proposalId: string, taken: (id: string) => boolean, prefix: string): string => {
  const base = short(proposalId.replace(/(@[A-Za-z0-9]+)+$/, ''))
  return taken(`${prefix}${base}`) ? short(proposalId) : base
}

export function pictureOf(ctx: Ctx, p: CorrectionProposal, n: number | undefined): BindPicture | undefined {
  if (p.frameId) return ctx.pictures.find((x) => x.frameId === p.frameId)
  return n === undefined ? undefined : ctx.pictures.find((x) => x.n === n)
}
const toFrame = (pic: BindPicture, p: CorrectionProposal, b: Box): Box => (p.frameId ? b : { x0: pic.transform.x0 + b.x0 / pic.transform.scale, y0: pic.transform.y0 + b.y0 / pic.transform.scale, x1: pic.transform.x0 + b.x1 / pic.transform.scale, y1: pic.transform.y0 + b.y1 / pic.transform.scale })
export const toFrameY = (pic: BindPicture, p: CorrectionProposal, y: number): number => (p.frameId ? y : pic.transform.y0 + y / pic.transform.scale)
export const toFrameX = (pic: BindPicture, p: CorrectionProposal, x: number): number => (p.frameId ? x : pic.transform.x0 + x / pic.transform.scale)
const finiteBox = (b: Box | undefined): b is Box => !!b && [b.x0, b.y0, b.x1, b.y1].every((v) => typeof v === 'number' && Number.isFinite(v)) && b.x1 > b.x0 && b.y1 > b.y0
const inPicture = (pic: BindPicture, b: Box): boolean => b.x0 >= -2 && b.y0 >= -2 && b.x1 <= pic.raster.width + 2 && b.y1 <= pic.raster.height + 2

export function viewOf(ctx: Ctx, pic: BindPicture): BindView | undefined {
  // a transaction's own registration first; then the analyzer's when its vertical passed the analyzer's own check; then
  // the sketch's (checked by the eaves); the analyzer's without heights last (it failed its own vertical check)
  return preferredView(ctx.views, pic.frameId)
}
/** v3.54.17 R3: the registration a frame is placed through, by rank (optionally on one side only). */
export function preferredView(views: readonly BindView[], frameId: string, side?: Side): BindView | undefined {
  const of = views.filter((v) => v.frameId === frameId && (!side || v.side === side))
  return of.find((v) => v.origin === 'ASSIGNED') ?? of.find((v) => v.origin === 'ANALYZER' && v.heights) ?? of.find((v) => v.origin === 'SKETCH') ?? of[0]
}

/** A source elevation picture and the registration that places it, or why the proposal cannot be placed through it. */
function elevationOf(ctx: Ctx, p: CorrectionProposal, n: number | undefined, need: 'HEIGHTS' | 'ROOF' | 'ALONG'): { pic: BindPicture; view: BindView } | Refusal {
  const pic = pictureOf(ctx, p, n)
  if (!pic) return { status: 'INVALID', code: 'NOT_A_SOURCE_PICTURE', why: `picture ${String(n ?? p.frameId)} is not one of the source pictures shown: a correction is placed from a source elevation, never from the model's own views` }
  if (pic.projection !== 'ORTHOGRAPHIC_ELEVATION') return { status: 'INVALID', code: 'NOT_ORTHOGRAPHIC', why: `picture ${pic.n} is not an orthographic elevation (${pic.projection}): its pixels are not a facade's metres` }
  const view = viewOf(ctx, pic)
  if (!view) return { status: 'NEEDS_EVIDENCE', code: 'VIEW_NOT_REGISTERED', why: `the analyzer did not register picture ${pic.n} (${pic.frameId}) to a side; an ASSIGN_VIEW in the same group can register it` }
  if (need === 'HEIGHTS' && !view.heights) return { status: 'NEEDS_EVIDENCE', code: 'VIEW_WITHOUT_HEIGHTS', why: `picture ${pic.n} is registered without heights low on the ${view.side.toLowerCase()} side's walls (its ground misses the terrain datum): a sill and a head cannot be read from it` }
  if (need === 'ROOF' && !view.heights && !view.roofAnchored) return { status: 'NEEDS_EVIDENCE', code: 'VIEW_WITHOUT_HEIGHTS', why: `picture ${pic.n} has no height datum on the ${view.side.toLowerCase()} side (neither the ground nor the ridge): a stack's top cannot be read from it` }
  return { pic, view }
}

/** The exterior wall on `side` that the along range and height range fall on: the outermost one that holds them. */
function hostWall(m: CanonicalBuildingModel, side: Side, a0: number, a1: number, y0: number, y1: number): Wall | undefined {
  const ax = alongAxis(side)
  const perp = ax === 'x' ? 'z' : 'x'
  const fits = exteriorWalls(m).filter((w) => {
    if (sideOfWall(m, w) !== side) return false
    const lo = Math.min(w.start[ax], w.end[ax])
    const hi = Math.max(w.start[ax], w.end[ax])
    if (a0 < lo - 0.02 || a1 > hi + 0.02) return false
    const base = levelOf(m, w.levelId).elevation + w.baseOffset
    return y0 >= base - 0.05 && y0 < base + w.height - 0.1 && y1 <= base + w.height + 0.05
  })
  fits.sort((p, q) => outward(side) * ((q.start[perp] + q.end[perp]) / 2 - (p.start[perp] + p.end[perp]) / 2))
  return fits[0]
}

function fillCommands(m: CanonicalBuildingModel, id: string, kind: 'WINDOW' | 'DOOR' | 'GLAZED_DOOR' | 'GARAGE_DOOR', fillId: string, hostT: number): BuildingCommand[] {
  // v3.54.18: where the model holds no unit to copy from (the first opening of a body built without LOCAL), the fill takes
  // the palette's material of its kind when the model defines it — glass in a window, a leaf in a door
  const has = (mid: string): string | undefined => (m.materials.some((x) => x.id === mid) ? mid : undefined)
  if (kind === 'WINDOW') {
    const like = m.windows.find((w) => w.frameDepth <= hostT) ?? m.windows[0]
    const mat = like?.materialId ?? has('mat-glass')
    return [{ type: 'placeWindow', id: fillId, openingId: id, ...(like ? { frameWidth: like.frameWidth, frameDepth: Math.min(like.frameDepth, hostT * 0.9), frameInset: Math.min(like.frameInset, Math.max(0, hostT - like.frameDepth)), glassThickness: like.glassThickness } : {}), ...(mat ? { materialId: mat } : {}) } as BuildingCommand]
  }
  const like = m.doors.find((d) => d.frameDepth <= hostT) ?? m.doors[0]
  const frame = like ? { frameWidth: like.frameWidth, frameDepth: Math.min(like.frameDepth, hostT * 0.9), frameInset: Math.min(like.frameInset, Math.max(0, hostT - like.frameDepth)), leafThickness: like.leafThickness } : {}
  const glass = m.windows.find((w) => w.materialId)?.materialId ?? has('mat-glass')
  const solid = m.doors.find((d) => d.materialId && d.materialId !== glass && (d as { usage?: string }).usage !== 'GARAGE')?.materialId ?? has('mat-timber')
  const gate = m.doors.find((d) => (d as { usage?: string }).usage === 'GARAGE' && d.materialId)?.materialId ?? has('mat-gate') ?? like?.materialId
  if (kind === 'GARAGE_DOOR') return [{ type: 'placeDoor', id: fillId, openingId: id, ...frame, assembly: { panels: [{ kind: 'PANEL', fraction: 1 }], mullionWidth: 0.04 }, usage: 'GARAGE', ...(gate ? { materialId: gate } : {}) } as BuildingCommand]
  if (kind === 'GLAZED_DOOR') return [{ type: 'placeDoor', id: fillId, openingId: id, ...frame, assembly: { panels: [{ kind: 'LEAF', fraction: 1, hinge: 'LEFT', glazing: 'FULL' }], mullionWidth: 0.04 }, ...(glass ? { materialId: glass } : like?.materialId ? { materialId: like.materialId } : {}) } as BuildingCommand]
  return [{ type: 'placeDoor', id: fillId, openingId: id, ...frame, ...(solid ? { materialId: solid } : like?.materialId ? { materialId: like.materialId } : {}) } as BuildingCommand]
}

function bindOpening(ctx: Ctx, p: CorrectionProposal): Bound | Refusal {
  const m = ctx.model
  const f = p.patch ?? {}
  const existing = p.operation === 'ADD_OPENING' ? undefined : m.openings.find((o) => o.id === p.targetId)
  if (p.operation !== 'ADD_OPENING' && !existing) return { status: 'INVALID', code: 'UNKNOWN_TARGET', why: `${p.targetId} is not an opening of revision ${modelRevision(m)}` }
  const ofExisting = existing ? openingSpan(m, existing) : undefined
  if (p.operation === 'REMOVE_OPENING') {
    const target = existing as Opening
    if (!ofExisting) return { status: 'INVALID', code: 'HOST_NOT_ON_A_SIDE', why: `${target.id} is not on an exterior side the views show` }
    const pic = pictureOf(ctx, p, f.picture)
    const view = pic ? viewOf(ctx, pic) : ctx.views.find((v) => v.side === ofExisting.side && v.heights)
    if (!view || view.side !== ofExisting.side) return { status: 'NEEDS_EVIDENCE', code: 'NO_VIEW_OF_THAT_SIDE', why: `no registered elevation of the ${ofExisting.side.toLowerCase()} side to hold ${target.id} against` }
    const src = ctx.pictures.find((x) => x.frameId === view.frameId) as BindPicture
    const box = boxOfSpan(view, ofExisting)
    const others = openingBoxes(m, view).filter((o) => o.id !== target.id).map((o) => o.box)
    const claimed = ctx.claims?.get(view.frameId)
    const s = supportOf(src.raster, box, facadePx(m, view), [box, ...others], tolPxOf(view), undefined, claimed ? [box, ...claimed] : undefined)
    const gate = { winner: (s.z === null ? 'UNDECIDED' : s.z < 1 ? 'PROPOSED' : s.supported ? 'CURRENT' : 'UNDECIDED') as HypothesisVerdict['winner'], proposedZ: null, currentZ: s.z, nullBoxes: s.null.n, ...(s.null.mode ? { nullMode: s.null.mode } : {}), why: s.z === null ? 'too few free places on the band to judge' : s.z < 1 ? `the source draws nothing distinct where ${target.id} stands (z ${s.z} < 1)` : s.supported ? `the source draws an opening where ${target.id} stands (z ${s.z}): it is not removed` : `the source is not clear at ${target.id} (z ${s.z})` }
    const record = { bound: { frameId: view.frameId, side: view.side, box, hostId: target.wallId, ids: [target.id] }, source: { frameId: src.frameId, sourceByteHash: src.sourceByteHash, crop: box }, gate }
    // v3.54.18: on an adopted facade an opening the picture does not decide follows the reading; one the picture seems to
    // support is removed only when the reading explains those edges by something else it draws there (a finish boundary)
    const adopt = p.origin === 'SKETCH' && f.adopt === true && (ctx.adopted?.has(view.frameId) ?? false)
    const followsReading = adopt && (gate.winner === 'UNDECIDED' || (gate.winner === 'CURRENT' && typeof f.explained === 'string' && f.explained.length > 0))
    if (followsReading) (gate as { adopted?: true; why: string }).adopted = true
    if (followsReading) gate.why = `${gate.why} — the facade's reading is adopted (most of its openings supported by the picture, none refuted)${gate.winner === 'CURRENT' ? `, and it explains these edges: ${f.explained}` : ''}: the opening it does not draw goes, NOT source-verified`
    if (gate.winner === 'CURRENT' && !followsReading) return { status: 'REJECTED_BY_SOURCE', code: 'SOURCE_SHOWS_OPENING', why: gate.why, record }
    if (gate.winner === 'UNDECIDED' && !followsReading) return { status: 'NEEDS_EVIDENCE', code: 'SOURCE_UNDECIDED', why: gate.why, record }
    const fills = [...m.windows.filter((w) => w.openingId === target.id).map((w) => `windows:${w.id}`), ...m.doors.filter((d) => d.openingId === target.id).map((d) => `doors:${d.id}`)]
    // the cascade takes the opening's own relationships with it (an alignment with an opening round the corner is about
    // the removed opening, not about the other one)
    const rels = m.relationships.filter((r) => r.from === target.id || r.to === target.id).map((r) => `relationships:${r.id}`)
    return { commands: [{ type: 'removeFeature', targetId: target.id, cascade: true }], allowed: [`openings:${target.id}`, ...fills, ...rels], expect: { kind: 'REMOVED', id: target.id, ...(followsReading ? { adopted: true as const } : {}) }, record }
  }
  if (!finiteBox(f.box)) return { status: 'INVALID', code: 'NO_BOX', why: `${p.operation} states the opening's box in a source picture (x0 < x1, y0 < y1); this one does not` }
  const currentKind = existing ? kindOfOpening(m, existing.id) : undefined
  const kind = f.kind ?? currentKind
  if (!kind) return { status: 'INVALID', code: 'NO_KIND', why: 'ADD_OPENING names the kind (WINDOW, DOOR, GLAZED_DOOR, GARAGE_DOOR)' }
  const at = elevationOf(ctx, p, f.picture, 'HEIGHTS')
  if ('status' in at) return at
  const { pic, view } = at
  let box = toFrame(pic, p, f.box)
  if (!inPicture(pic, box)) return { status: 'INVALID', code: 'OUT_OF_PICTURE', why: `the box lies outside picture ${pic.n}` }
  if (existing && ofExisting && ofExisting.side !== view.side) return { status: 'NEEDS_EVIDENCE', code: 'OTHER_SIDE', why: `${existing.id} is on the ${ofExisting.side.toLowerCase()} side; picture ${pic.n} is registered as the ${view.side.toLowerCase()} side: moving an opening to another side is not an update` }
  const pr = view.projection
  const xs = [alongOf(pr, box.x0), alongOf(pr, box.x1)]
  let a0 = r6(Math.min(...xs))
  let a1 = r6(Math.max(...xs))
  const y0 = r6(yOf(pr, box.y1))
  let y1 = r6(yOf(pr, box.y0))
  // v3.54.19: an opening that lies almost wholly in one wall and runs a few centimetres past its END (the line between two
  // bodies is where the outline's step was traced, the opening where the elevation's registration put it) had no host
  // wall and was refused whole — a garage lost its gate over 5 cm. It is kept in the wall that holds at least
  // `END_CLIP_MIN_SHARE` of it, cut back to that wall's end; less than that is two walls' business and is refused as before.
  let endClip: { fromM: [number, number]; toM: [number, number]; wallId: string } | undefined
  if (!existing && !hostWall(m, view.side, a0, a1, y0, Math.min(y1, y0 + 0.3))) {
    const ax = alongAxis(view.side)
    const cands = exteriorWalls(m).flatMap((w) => {
      if (sideOfWall(m, w) !== view.side) return []
      const lo = Math.min(w.start[ax], w.end[ax]) + 0.03
      const hi = Math.max(w.start[ax], w.end[ax]) - 0.03
      const base = levelOf(m, w.levelId).elevation + w.baseOffset
      if (!(y0 >= base - 0.05 && y0 < base + w.height - 0.1)) return []
      const share = (Math.min(a1, hi) - Math.max(a0, lo)) / (a1 - a0)
      return share >= END_CLIP_MIN_SHARE && share < 1 ? [{ w, lo, hi, share }] : []
    }).sort((p, q) => q.share - p.share)
    if (cands.length > 0) {
      const c = cands[0]
      endClip = { fromM: [a0, a1], toM: [r6(Math.max(a0, c.lo)), r6(Math.min(a1, c.hi))], wallId: c.w.id }
      ;[a0, a1] = endClip.toM
      const px = [pxOf(pr, a0), pxOf(pr, a1)]
      box = { ...box, x0: Math.min(...px), x1: Math.max(...px) }
    }
  }
  // v3.54.19: a door or a gate whose drawn head stands a little ABOVE the top of the only wall it can stand in (the wall's
  // top was read at the fascia, a lower bound; the gate is drawn up to the eaves) was refused whole as NO_HOST_WALL — the
  // garage lost its gate over a few centimetres. Its head is cut to the wall's top, named in the record; a box that
  // overshoots by more than a quarter of its own height is not this case and is refused as before.
  let headCut: { fromM: number; toM: number; wallId: string } | undefined
  if (!existing && (kind === 'DOOR' || kind === 'GLAZED_DOOR' || kind === 'GARAGE_DOOR') && !hostWall(m, view.side, a0, a1, y0, y1)) {
    const lower = exteriorWalls(m).filter((w) => { if (sideOfWall(m, w) !== view.side) return false; const ax = alongAxis(view.side); const lo = Math.min(w.start[ax], w.end[ax]); const hi = Math.max(w.start[ax], w.end[ax]); const base = levelOf(m, w.levelId).elevation + w.baseOffset; return a0 >= lo - 0.02 && a1 <= hi + 0.02 && y0 >= base - 0.05 && y0 < base + w.height - 0.1 })
    const top = lower.length > 0 ? Math.max(...lower.map((w) => levelOf(m, w.levelId).elevation + w.baseOffset + w.height)) : undefined
    if (top !== undefined && y1 > top && y1 - top <= HEAD_CUT_MAX_SHARE * (y1 - y0) && top - 0.03 - y0 >= 1.6) {
      headCut = { fromM: y1, toM: r6(top - 0.03), wallId: lower.sort((p, q) => levelOf(m, q.levelId).elevation + q.baseOffset + q.height - (levelOf(m, p.levelId).elevation + p.baseOffset + p.height))[0].id }
      y1 = headCut.toM
      box = { ...box, y0: pyOf(pr, y1) }
    }
  }
  if (!(a1 - a0 >= 0.2) || !(y1 - y0 >= 0.25)) return { status: 'INVALID', code: 'TOO_SMALL', why: `the box is ${(a1 - a0).toFixed(2)} × ${(y1 - y0).toFixed(2)} m at the registration: not an opening` }
  const host = hostWall(m, view.side, a0, a1, y0, y1)
  if (!host) return { status: 'INVALID', code: 'NO_HOST_WALL', why: `no exterior wall of the ${view.side.toLowerCase()} side holds ${a0.toFixed(2)}..${a1.toFixed(2)} m along it from ${y0.toFixed(2)} to ${y1.toFixed(2)} m` }
  // v3.54.17 R3: an update may absorb other openings of the same wall that its new shape covers (the source's one
  // opening is several in the model): each must exist, stand on the host wall, and lie within the new shape along it
  const absorbed: Opening[] = []
  for (const aid of f.absorbs ?? []) {
    if (!existing) return { status: 'INVALID', code: 'ABSORB_WITHOUT_TARGET', why: 'only an update of an opening the model has absorbs others' }
    const o = m.openings.find((x) => x.id === aid)
    if (!o || o.id === existing.id) return { status: 'INVALID', code: 'UNKNOWN_TARGET', why: `${aid} is not another opening of this revision` }
    const sp = openingSpan(m, o)
    if (!sp || o.wallId !== host.id) return { status: 'INVALID', code: 'ABSORB_OTHER_WALL', why: `${aid} does not stand on ${host.id}, the wall the new shape is cut in` }
    const tolA = Math.max(0.15, 3 * view.alongErrorM)
    if (sp.a0 < a0 - tolA || sp.a1 > a1 + tolA || sp.y0 < y0 - tolA || sp.y1 > y1 + tolA) return { status: 'INVALID', code: 'ABSORB_OUTSIDE_SHAPE', why: `${aid} stands ${sp.a0.toFixed(2)}..${sp.a1.toFixed(2)} m along, ${sp.y0.toFixed(2)}..${sp.y1.toFixed(2)} m high: not within the new shape ${a0.toFixed(2)}..${a1.toFixed(2)} × ${y0.toFixed(2)}..${y1.toFixed(2)} m` }
    absorbed.push(o)
  }
  // v3.54.18: openings of the host wall the new shape overlaps and the proposing reading does not draw (named by it).
  // One already gone (its own removal was kept earlier in this run) is simply no longer in the way.
  const displaced: Opening[] = []
  for (const did of f.displaces ?? []) {
    const o = m.openings.find((x) => x.id === did)
    if (!o || o.id === existing?.id || absorbed.some((x) => x.id === o.id) || o.wallId !== host.id) continue
    const sp = openingSpan(m, o)
    if (!sp || Math.min(sp.a1, a1) - Math.max(sp.a0, a0) <= 0.01 || Math.min(sp.y1, y1) - Math.max(sp.y0, y0) <= 0.01) continue
    displaced.push(o)
  }
  // the source gate: the proposal and the model's element (for an update) against the original picture
  const others = openingBoxes(m, view).filter((o) => o.id !== existing?.id && !absorbed.some((x) => x.id === o.id) && !displaced.some((x) => x.id === o.id))
  const duplicate = others.find((o) => iou(o.box, box) > 0.3)
  if (duplicate) return { status: 'DUPLICATE', code: 'OPENING_ALREADY_THERE', why: `${duplicate.id} already stands there (overlap ${iou(duplicate.box, box).toFixed(2)}): an opening is updated, never doubled` }
  // A2: both hypotheses as full shapes (a raked head's two ends), and the kinds as their own measure
  const proposedShape: Shape = typeof f.headLeftY === 'number' && typeof f.headRightY === 'number' ? { ...box, headLeftY: toFrameY(pic, p, f.headLeftY), headRightY: toFrameY(pic, p, f.headRightY), y0: Math.min(box.y0, toFrameY(pic, p, f.headLeftY), toFrameY(pic, p, f.headRightY)) } : box
  const currentShape = existing ? shapeOfOpening(m, existing, view) : undefined
  let g: HypothesisVerdict
  // v3.54.18: the openings the reading of THIS picture draws — where the joint band is too thin, the band is its plain wall
  const claimed = ctx.claims?.get(pic.frameId)
  let fillFrom: OpeningPatchKindExact | undefined
  let fillRecord: Pick<FillVerdict, 'observed' | 'features'> | undefined
  if (existing && currentShape && sameShape(proposedShape, currentShape)) {
    if (currentKind === kind || !currentKind) return { status: 'NO_EFFECT', code: 'ALREADY_AS_PROPOSED', why: `${existing.id} already stands with this shape and kind (${kind}) on picture ${pic.n}`, record: { bound: { frameId: view.frameId, side: view.side, box, ids: [existing.id] }, source: { frameId: pic.frameId, sourceByteHash: pic.sourceByteHash, crop: box } } }
    // the same shape, another kind: the position test cannot decide it — the fill of the opening does, or nothing does
    const fv = compareFill(pic.raster, proposedShape, kind as OpeningPatchKindExact, currentKind)
    fillFrom = currentKind
    fillRecord = { observed: fv.observed, features: fv.features }
    const sup = supportOf(pic.raster, proposedShape, facadePx(m, view), [proposedShape, ...others.map((o) => o.box)], tolPxOf(view), undefined, claimed ? [proposedShape, ...claimed] : undefined)
    g = { winner: fv.winner, proposed: sup, why: fv.why }
  } else g = compareHypotheses(pic.raster, proposedShape, currentShape, facadePx(m, view), others.map((o) => o.box), tolPxOf(view), claimed)
  const gate = { winner: g.winner, proposedZ: g.proposed.z, ...(g.current ? { currentZ: g.current.z } : {}), nullBoxes: g.proposed.null.n, ...(g.proposed.null.mode ? { nullMode: g.proposed.null.mode } : {}), why: g.why, measure: fillRecord ? ('FILL' as const) : (g.measure ?? 'BOX'), ...(fillRecord ? { fill: fillRecord } : {}) }
  const id = existing?.id ?? `op-fix-${view.side.toLowerCase()}-${stableShort(p.proposalId, (q) => m.openings.some((o) => o.id === q), `op-fix-${view.side.toLowerCase()}-`)}`
  const L = wallLen(host)
  const ax = alongAxis(view.side)
  const dir = (host.end[ax] - host.start[ax]) / L
  const u0 = r6(Math.min((a0 - host.start[ax]) * dir, (a1 - host.start[ax]) * dir))
  const width = r6(a1 - a0)
  const base = levelOf(m, host.levelId).elevation + host.baseOffset
  const sill = r6(Math.max(0, y0 - base))
  let height = r6(y1 - base - sill)
  let head: { kind: 'RAKED'; heightFar: number } | undefined
  if (typeof f.headLeftY === 'number' && typeof f.headRightY === 'number') {
    const hl = yOf(pr, toFrameY(pic, p, f.headLeftY)) - base - sill
    const hr = yOf(pr, toFrameY(pic, p, f.headRightY)) - base - sill
    // the near edge (u0) is the picture's left column when the wall runs with the picture, else its right
    const leftIsNear = (alongOf(pr, box.x0) - host.start[ax]) * dir <= (alongOf(pr, box.x1) - host.start[ax]) * dir
    const near = leftIsNear ? hl : hr
    const far = leftIsNear ? hr : hl
    if (near > 0.3 && far > 0.3 && Math.abs(near - far) > 0.05) {
      height = r6(near)
      head = { kind: 'RAKED', heightFar: r6(far) }
    }
  }
  const record = { bound: { frameId: view.frameId, side: view.side, box, hostId: host.id, ids: [id], values: { offset: u0, width, sill, height }, ...(headCut ? { headCut } : {}), ...(endClip ? { endClip } : {}) }, source: { frameId: pic.frameId, sourceByteHash: pic.sourceByteHash, crop: box }, gate }
  // v3.54.18 — PER-PROPERTY ARBITRATION. LOCAL's openings say what each of their properties rests on: the place along the
  // wall is a gap traced on the PLAN, the sill and height mostly ASSUMED ("no callout read, not read on an elevation").
  // When an update keeps the plan's span (the elevation reading draws the same opening where the plan has its gap — two
  // drawings, two readers) and changes only what the model ASSUMED, the model's shape has no evidence to be beaten by a
  // margin: the picture must only not refute the proposal (z at or above the "nothing distinct" bound) — and where the
  // picture itself supports the proposal (z ≥ 2), a still higher score of the ASSUMED box does not keep it: a taller box
  // that happens to end on other drawn edges (a spandrel panel, a cladding joint) is not thereby read. The printed or
  // elevation-read properties of an opening never fall under this rule.
  const evp = (existing as { evidence?: { properties?: Record<string, string> } } | undefined)?.evidence?.properties
  const fromPlan = (v: string | undefined): boolean => v === 'SOURCE_DERIVED' || v === 'SOURCE_EXACT'
  const spanShare = existing && ofExisting ? (Math.min(a1, ofExisting.a1) - Math.max(a0, ofExisting.a0)) / Math.max(a1 - a0, ofExisting.a1 - ofExisting.a0) : 0
  // v3.54.18 R2 — the same rule where the body was REPLACED: the proposal adds an opening on a wall that has none there, and
  // the replaced LOCAL model had traced a gap of that span on the plan (same side, same storey, ≥ 70 % of the longer span
  // shared — a wall-wide gap witnesses nothing). The picture must not refute it. Never source-verified.
  const yMid = (y0 + y1) / 2
  const gapHit = !existing && ctx.planGaps ? ctx.planGaps.filter((w) => w.side === view.side && yMid >= w.storeyLo && yMid <= w.storeyHi).map((w) => ({ w, share: (Math.min(a1, w.a1) - Math.max(a0, w.a0)) / Math.max(a1 - a0, w.a1 - w.a0) })).sort((x, z) => z.share - x.share)[0] : undefined
  // v3.54.19 — NO EVIDENCE IS NOT EVIDENCE OF ABSENCE. The gate reads contrast: a glazing stands out of its wall, a door
  // leaf drawn in the wall's own tone, or in the shade of a porch, does not — the picture then "supports the plain wall"
  // (z near or below zero) however plainly the door is drawn. For a DOOR, GLAZED_DOOR or GARAGE_DOOR the elevation
  // reading draws where the PLAN leaves a gap of that span in that wall, the contrast score is therefore not asked: two
  // drawings, read by two readers, put an opening there. A window still needs the picture not to refute it (z ≥ 1).
  const doorKind = kind === 'DOOR' || kind === 'GLAZED_DOOR' || kind === 'GARAGE_DOOR'
  const gapAgrees = !fillRecord && !existing && !!gapHit && gapHit.share >= PLAN_SPAN_AGREE
  const gapWitness = gapAgrees && ((g.winner === 'UNDECIDED' && g.proposed.z !== null && g.proposed.z >= SUPPORT_Z_MIN - HYPOTHESIS_Z_MARGIN) || (doorKind && (g.winner === 'UNDECIDED' || g.winner === 'CURRENT')))
  const spanWitness = (g.winner === 'UNDECIDED' || (g.winner === 'CURRENT' && g.proposed.supported === true)) && !fillRecord && !!existing && !!evp && fromPlan(evp.offset) && fromPlan(evp.width) && evp.sill === 'ASSUMED' && evp.height === 'ASSUMED' && spanShare >= PLAN_SPAN_AGREE && g.proposed.z !== null && g.proposed.z >= SUPPORT_Z_MIN - HYPOTHESIS_Z_MARGIN
  const crossWitness = spanWitness || gapWitness
  if (gapWitness && gapHit) {
    ;(gate as { crossWitness?: string }).crossWitness = 'PLAN_GAP'
    gate.why = `${g.why} — but the plan shows a gap of this span on this side (${gapHit.w.id}${gapHit.w.id.startsWith('plan-') ? ', read on the plan sheet in its wall colour' : ' of the LOCAL model whose body was replaced'}: ${gapHit.w.a0.toFixed(2)}..${gapHit.w.a1.toFixed(2)} m, ${Math.round(gapHit.share * 100)} % shared with this elevation reading): two drawings give the same opening${g.winner === 'CURRENT' || g.proposed.z === null || g.proposed.z < SUPPORT_Z_MIN - HYPOTHESIS_Z_MARGIN ? `; the picture's contrast (z ${g.proposed.z}) is not asked of a ${String(kind).toLowerCase().replace('_', ' ')}, whose leaf need not stand out of its wall` : `, and the picture does not refute it (z ${g.proposed.z})`}`
  }
  if (spanWitness) {
    ;(gate as { crossWitness?: string }).crossWitness = 'PLAN_SPAN'
    gate.why = `${g.why} — but the model's ${existing?.id} keeps its place from the plan (a traced gap; ${Math.round(spanShare * 100)} % of the span shared with this elevation reading) and its sill and height were ASSUMED, never read: the reading replaces the assumption, and the picture does not refute it (z ${g.proposed.z})`
  }
  if (g.winner === 'CURRENT' && !crossWitness) return { status: 'REJECTED_BY_SOURCE', code: fillRecord ? 'MODEL_FILL_BETTER_SUPPORTED' : existing ? 'MODEL_BETTER_SUPPORTED' : 'SOURCE_SHOWS_NO_OPENING', why: g.why, record }
  const followsReading = g.winner === 'UNDECIDED' && !crossWitness && !fillRecord && p.origin === 'SKETCH' && f.adopt === true && (ctx.adopted?.has(pic.frameId) ?? false)
  if (followsReading) {
    ;(gate as { adopted?: true }).adopted = true
    gate.why = `${g.why} — the facade's reading is adopted (most of its openings supported by the picture, none refuted): this element follows it, NOT source-verified`
  }
  if (g.winner === 'UNDECIDED' && !followsReading && !crossWitness) return { status: 'NEEDS_EVIDENCE', code: fillRecord ? 'FILL_UNDECIDED' : 'SOURCE_UNDECIDED', why: g.why, record }
  // v3.54.18: each opening in the way is held against the picture on its own. One the picture supports as a distinct
  // element, most of which lies OUTSIDE the new shape, is another real opening: the proposal is refused, by name.
  const displacedZ: Record<string, number | null> = {}
  for (const o of displaced) {
    const sp = openingSpan(m, o) as NonNullable<ReturnType<typeof openingSpan>>
    const dbox = boxOfSpan(view, sp)
    const ds = supportOf(pic.raster, dbox, facadePx(m, view), [dbox, box, ...others.map((q) => q.box)], tolPxOf(view), undefined, claimed ? [dbox, ...claimed] : undefined)
    displacedZ[o.id] = ds.z
    const inter = Math.max(0, Math.min(dbox.x1, box.x1) - Math.max(dbox.x0, box.x0)) * Math.max(0, Math.min(dbox.y1, box.y1) - Math.max(dbox.y0, box.y0))
    const inside = inter / Math.max(1e-9, (dbox.x1 - dbox.x0) * (dbox.y1 - dbox.y0))
    if (ds.supported === true && inside < 0.5) return { status: 'NEEDS_EVIDENCE', code: 'DISPLACES_SUPPORTED_OPENING', why: `the new shape overlaps ${o.id}, which the source draws as an element of its own (z ${ds.z}) and which lies mostly outside the new shape (${Math.round(inside * 100)} % inside): two openings the picture supports cannot share that stretch — neither is chosen`, record }
  }
  if (displaced.length > 0) (record.bound as { displaced?: Record<string, number | null> }).displaced = displacedZ
  if (u0 < -0.01 || u0 + width > L + 0.01) return { status: 'INVALID', code: 'HOST_TOO_SHORT', why: `${host.id} is ${L.toFixed(2)} m long; the opening would run ${u0.toFixed(2)}..${(u0 + width).toFixed(2)} m along it`, record }
  const oldFills = existing ? [...m.windows.filter((w) => w.openingId === existing.id).map((w) => ({ coll: 'windows', id: w.id })), ...m.doors.filter((d) => d.openingId === existing.id).map((d) => ({ coll: 'doors', id: d.id }))] : []
  const fillId = oldFills[0] && ((oldFills[0].coll === 'windows') === (kind === 'WINDOW')) ? oldFills[0].id : `${id}-${kind === 'WINDOW' ? 'unit' : 'leaf'}`
  const commands: BuildingCommand[] = [
    ...absorbed.map((o) => ({ type: 'removeFeature' as const, targetId: o.id, cascade: true })),
    ...displaced.map((o) => ({ type: 'removeFeature' as const, targetId: o.id, cascade: true })),
    ...(existing ? [{ type: 'removeFeature' as const, targetId: existing.id, cascade: true }] : []),
    { type: 'cutOpening', id, wallId: host.id, kind: kind === 'WINDOW' ? 'WINDOW' : 'DOOR', offset: Math.max(0, u0), sill, width, height, ...(head ? { head } : {}) },
    ...fillCommands(m, id, kind, fillId, host.thickness),
  ]
  // the re-cut opening's own relationships (an alignment LOCAL drew with an opening round the corner) go with the old cut
  const gone = [...(existing ? [existing.id] : []), ...absorbed.map((o) => o.id), ...displaced.map((o) => o.id)]
  const oldRels = m.relationships.filter((r) => gone.includes(r.from) || gone.includes(r.to)).map((r) => `relationships:${r.id}`)
  const absorbedKeys = [...absorbed, ...displaced].flatMap((o) => [`openings:${o.id}`, ...m.windows.filter((w) => w.openingId === o.id).map((w) => `windows:${w.id}`), ...m.doors.filter((d) => d.openingId === o.id).map((d) => `doors:${d.id}`)])
  return { commands, allowed: [`openings:${id}`, ...oldFills.map((x) => `${x.coll}:${x.id}`), `${kind === 'WINDOW' ? 'windows' : 'doors'}:${fillId}`, ...oldRels, ...absorbedKeys], expect: { kind: 'OPENING', id, view, box, shape: head ? proposedShape : box, levelId: host.levelId, openingKind: kind as OpeningPatchKindExact, ...(fillFrom ? { fillChangeFrom: fillFrom } : {}), ...(followsReading ? { adopted: true as const } : {}) }, record }
}

/**
 * v3.54.19 — ADD_PLAN_OPENING: an opening where the ground-floor PLAN leaves a gap in an exterior wall and the model has
 * none. The span along the wall is the plan's (read on the sheet, deterministic); the kind, sill and height are what one
 * metric reading of that side's elevation gives for the same stretch (`facade-metric.ts`), checked for plausibility. Two
 * drawings and two readers put an opening there; nothing is located in the elevation's pixels, so the contrast gate is
 * not asked and the opening is never source-verified. A head above its wall is cut to the wall (as for any door).
 */
function bindPlanOpening(ctx: Ctx, p: CorrectionProposal): Bound | Refusal {
  const m = ctx.model
  const f = p.planOpening
  if (!f) return { status: 'INVALID', code: 'NO_PLAN_OPENING', why: 'ADD_PLAN_OPENING states the plan gap and the reading it follows; this one does not' }
  if (!(ctx.planGaps ?? []).some((g) => g.id === f.gapId && g.side === f.side && Math.abs(g.a0 - f.a0) < 0.02 && Math.abs(g.a1 - f.a1) < 0.02)) return { status: 'NEEDS_EVIDENCE', code: 'NO_PLAN_GAP', why: `${f.gapId} is not a gap the plan draws on the ${f.side.toLowerCase()} side of this model` }
  const taken = sideOpeningSpans(m, f.side).find((o) => (Math.min(o.a1, f.a1) - Math.max(o.a0, f.a0)) / Math.max(o.a1 - o.a0, f.a1 - f.a0) >= 0.4 && o.b0 < f.sillM + f.heightM && o.b1 > f.sillM)
  if (taken) return { status: 'DUPLICATE', code: 'OPENING_ALREADY_THERE', why: `${taken.id} already stands in that stretch of the ${f.side.toLowerCase()} side` }
  const level = [...m.levels].sort((a, b) => a.elevation - b.elevation)[0]
  const y0 = r6((level?.elevation ?? 0) + Math.max(0, f.sillM))
  let y1 = r6(y0 + f.heightM)
  let host = hostWall(m, f.side, f.a0, f.a1, y0, y1)
  if (!host) {
    const lower = exteriorWalls(m).filter((w) => { if (sideOfWall(m, w) !== f.side) return false; const ax = alongAxis(f.side); const lo = Math.min(w.start[ax], w.end[ax]); const hi = Math.max(w.start[ax], w.end[ax]); const base = levelOf(m, w.levelId).elevation + w.baseOffset; return f.a0 >= lo - 0.02 && f.a1 <= hi + 0.02 && y0 >= base - 0.05 && y0 < base + w.height - 0.1 })
    const top = lower.length > 0 ? Math.max(...lower.map((w) => levelOf(m, w.levelId).elevation + w.baseOffset + w.height)) : undefined
    if (top !== undefined && y1 > top && y1 - top <= HEAD_CUT_MAX_SHARE * (y1 - y0) && top - 0.03 - y0 >= (f.kind === 'WINDOW' ? 0.4 : 1.6)) {
      y1 = r6(top - 0.03)
      host = hostWall(m, f.side, f.a0, f.a1, y0, y1)
    }
  }
  if (!host) return { status: 'INVALID', code: 'NO_HOST_WALL', why: `no exterior wall of the ${f.side.toLowerCase()} side holds ${f.a0.toFixed(2)}..${f.a1.toFixed(2)} m along it from ${y0.toFixed(2)} to ${y1.toFixed(2)} m` }
  const ax = alongAxis(f.side)
  const L = Math.hypot(host.end.x - host.start.x, host.end.z - host.start.z)
  const uOf = (a: number): number => ((a - host.start[ax]) / (host.end[ax] - host.start[ax])) * L
  const u0 = r6(Math.max(0.05, Math.min(uOf(f.a0), uOf(f.a1))))
  const width = r6(Math.min(Math.abs(uOf(f.a1) - uOf(f.a0)), L - 0.05 - u0))
  if (!(width >= 0.3)) return { status: 'INVALID', code: 'TOO_SMALL', why: `the gap leaves ${width.toFixed(2)} m on ${host.id}` }
  const base = levelOf(m, host.levelId).elevation + host.baseOffset
  const sill = r6(y0 - base)
  const height = r6(y1 - y0)
  const id = `op-plan-${f.side.toLowerCase()}-${stableShort(p.proposalId, (q) => m.openings.some((o) => o.id === q), `op-plan-${f.side.toLowerCase()}-`)}`
  const fillId = `${id}-${f.kind === 'WINDOW' ? 'unit' : 'leaf'}`
  const evidence = { status: 'SOURCE_DERIVED', source: f.frameId, interpretation: `a gap the ground-floor plan draws in this wall (${f.gapId}: ${f.a0.toFixed(2)}..${f.a1.toFixed(2)} m), where the model had no opening; its kind, sill and height follow one metric reading of this side's elevation (${f.frameId}, ${Math.round(f.share * 100)} % of the span shared): not located in the elevation's pixels, not source-verified`, properties: { offset: 'SOURCE_DERIVED', width: 'SOURCE_DERIVED', sill: 'VISUAL_INFERRED', height: 'VISUAL_INFERRED' } }
  // an opening of the model in the way: one that itself stands on a gap of the plan is another real opening (refused, by
  // name); one that covers NO gap of the plan stands where the plan draws wall — the plan and this reading agree against
  // it, and it gives way (removed in the same transaction, named in the record)
  const shareOf = (a0: number, a1: number, b0: number, b1: number): number => (Math.min(a1, b1) - Math.max(a0, b0)) / Math.max(a1 - a0, b1 - b0, 1e-6)
  const inWay = m.openings.filter((o) => o.wallId === host.id).map((o) => ({ o, sp: openingSpan(m, o) })).filter((q): q is { o: Opening; sp: NonNullable<ReturnType<typeof openingSpan>> } => !!q.sp && Math.min(q.sp.a1, f.a1 + 0.05) - Math.max(q.sp.a0, f.a0 - 0.05) > 0.01 && Math.min(q.sp.y1, y1) - Math.max(q.sp.y0, y0) > 0.01)
  const backed = inWay.find((q) => (ctx.planGaps ?? []).some((g) => g.side === f.side && shareOf(g.a0, g.a1, q.sp.a0, q.sp.a1) >= 0.4))
  if (backed) return { status: 'NEEDS_EVIDENCE', code: 'OVERLAPS_PLAN_BACKED_OPENING', why: `${backed.o.id} overlaps this stretch and itself stands on a gap of the plan: two openings the plan draws cannot share a stretch — neither is moved` }
  const displaced = inWay.map((q) => q.o)
  const commands = [
    ...displaced.map((o) => ({ type: 'removeFeature' as const, targetId: o.id, cascade: true })),
    { type: 'cutOpening', id, wallId: host.id, kind: f.kind === 'WINDOW' ? 'WINDOW' : 'DOOR', offset: u0, sill, width, height, evidence },
    ...fillCommands(m, id, f.kind as 'WINDOW' | 'DOOR' | 'GLAZED_DOOR' | 'GARAGE_DOOR', fillId, host.thickness),
  ] as BuildingCommand[]
  const goneKeys = displaced.flatMap((o) => [`openings:${o.id}`, ...m.windows.filter((w) => w.openingId === o.id).map((w) => `windows:${w.id}`), ...m.doors.filter((d) => d.openingId === o.id).map((d) => `doors:${d.id}`), ...m.relationships.filter((r) => r.from === o.id || r.to === o.id).map((r) => `relationships:${r.id}`)])
  const measure = (working: CanonicalBuildingModel): { failure?: string; measure: { sourceVerified: boolean | null; why: string } } => {
    if (!working.openings.some((o) => o.id === id)) return { failure: `${id} was not cut`, measure: { sourceVerified: false, why: 'the opening is not in the candidate' } }
    return { measure: { sourceVerified: null, why: `${id} (${f.kind}) cut in ${host.id} at the plan's gap ${f.a0.toFixed(2)}..${f.a1.toFixed(2)} m, sill ${sill.toFixed(2)} m, ${height.toFixed(2)} m high by the elevation's metric reading; two drawings, not source-verified` } }
  }
  return { commands, allowed: [`openings:${id}`, `${f.kind === 'WINDOW' ? 'windows' : 'doors'}:${fillId}`, ...goneKeys], expect: { kind: 'CUSTOM', measure }, record: { bound: { frameId: f.frameId, side: f.side, hostId: host.id, ids: [id], ...(displaced.length > 0 ? { displaced: Object.fromEntries(displaced.map((o) => [o.id, null])) } : {}), values: { offset: u0, width, sill, height } } } }
}

/** Where a stack meets the roof, across the side: the roof planes' height along the line at `along`. */
function roofMeet(m: CanonicalBuildingModel, side: Side, along: number, yMeet: number): { c: number; how: 'ROOF_MEET_LINE' | 'DISPLAY_ASSUMPTION' } {
  const ax = alongAxis(side)
  const perp = ax === 'x' ? 'z' : 'x'
  const ws = exteriorWalls(m)
  const vs = ws.flatMap((w) => [w.start[perp], w.end[perp]])
  const lo = Math.min(...vs)
  const hi = Math.max(...vs)
  const inside = (pt: { x: number; z: number }, poly: ReadonlyArray<{ x: number; z: number }>): boolean => {
    let ins = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if ((poly[i].z > pt.z) !== (poly[j].z > pt.z) && pt.x < ((poly[j].x - poly[i].x) * (pt.z - poly[i].z)) / (poly[j].z - poly[i].z) + poly[i].x) ins = !ins
    return ins
  }
  const roofGeoms = m.roofs.flatMap((r) => { const l = m.levels.find((x) => x.id === r.levelId); return l && r.kind !== 'FLAT' ? [roofGeometry(r, l)] : [] })
  const top = (c: number): number => {
    const pt = ax === 'x' ? { x: along, z: c } : { x: c, z: along }
    let best = -Infinity
    for (const pl of m.roofPlanes ?? []) {
      if (!inside(pt, pl.boundary)) continue
      const d = (pt.x - pl.datum.x) * pl.downslope.x + (pt.z - pl.datum.z) * pl.downslope.z
      best = Math.max(best, pl.datum.y - Math.tan((pl.pitchDeg * Math.PI) / 180) * d)
    }
    // v3.54.17 R3: the parametric roofs too (a massing or LOCAL model has no roof planes: without them every stack stood
    // at the middle of the walls' depth, a FAR stack in front of the ridge it is drawn behind)
    for (const g of roofGeoms) if (g.covers(pt.x, pt.z)) best = Math.max(best, g.topAt(pt.x, pt.z))
    return best
  }
  const N = 80
  const samples = Array.from({ length: N + 1 }, (_, i) => lo + ((hi - lo) * i) / N).map((c) => ({ c, h: top(c) })).filter((s) => Number.isFinite(s.h))
  if (samples.length === 0) return { c: (lo + hi) / 2, how: 'DISPLAY_ASSUMPTION' }
  const peak = samples.reduce((a, s) => (s.h > a.h ? s : a))
  if (yMeet >= peak.h - 0.05) return { c: peak.c, how: 'ROOF_MEET_LINE' }
  // the first place from this side where the roof reaches the meet line
  const ordered = outward(side) < 0 ? samples : [...samples].reverse()
  const hit = ordered.find((s) => s.h >= yMeet)
  return hit ? { c: hit.c, how: 'ROOF_MEET_LINE' } : { c: peak.c, how: 'DISPLAY_ASSUMPTION' }
}

function bindChimney(ctx: Ctx, p: CorrectionProposal): Bound | Refusal {
  const m = ctx.model
  const f = p.patch ?? {}
  const existing = p.operation === 'UPDATE_CHIMNEY' ? m.chimneys.find((c) => c.id === p.targetId) : undefined
  if (p.operation === 'UPDATE_CHIMNEY' && !existing) return { status: 'INVALID', code: 'UNKNOWN_TARGET', why: `${p.targetId} is not a chimney of this revision` }
  if (!finiteBox(f.box)) return { status: 'INVALID', code: 'NO_BOX', why: 'a chimney proposal states the stack\'s box in a source elevation' }
  const at = elevationOf(ctx, p, f.picture, 'ROOF')
  if ('status' in at) return at
  const { pic, view } = at
  const box = toFrame(pic, p, f.box)
  if (!inPicture(pic, box)) return { status: 'INVALID', code: 'OUT_OF_PICTURE', why: `the box lies outside picture ${pic.n}` }
  const pr = view.projection
  const xs = [alongOf(pr, box.x0), alongOf(pr, box.x1)]
  const a0 = r6(Math.min(...xs))
  const a1 = r6(Math.max(...xs))
  const yTop = r6(yOf(pr, box.y0))
  const yMeet = r6(yOf(pr, box.y1))
  const wallTops = exteriorWalls(m).map((w) => levelOf(m, w.levelId).elevation + w.baseOffset + (w.topProfile ? 0 : w.height))
  const eaves = Math.max(...wallTops.filter((v) => Number.isFinite(v)), 0)
  if (!(a1 - a0 >= 0.2 && a1 - a0 <= 2.5)) return { status: 'INVALID', code: 'NOT_A_STACK', why: `the box is ${(a1 - a0).toFixed(2)} m wide at the registration: not a chimney stack` }
  if (!(yTop > eaves + 0.2)) return { status: 'INVALID', code: 'NOT_ABOVE_ROOF', why: `its top lands at ${yTop.toFixed(2)} m, not above the walls' tops (${eaves.toFixed(2)} m): not a stack above the roof` }
  // the other axis: a second elevation at right angles, else the roof's own planes where the stack meets them
  const ax = alongAxis(view.side)
  let c0: number
  let c1: number
  let depth: 'SECOND_VIEW' | 'ROOF_MEET_LINE' | 'DISPLAY_ASSUMPTION'
  const second = f.depthPicture !== undefined && finiteBox(f.depthBox) ? elevationOf(ctx, { ...p, frameId: undefined }, f.depthPicture, 'ALONG') : undefined
  if (second && !('status' in second) && alongAxis(second.view.side) !== ax) {
    const b2 = toFrame(second.pic, p, f.depthBox as Box)
    const cs = [alongOf(second.view.projection, b2.x0), alongOf(second.view.projection, b2.x1)]
    c0 = Math.min(...cs)
    c1 = Math.max(...cs)
    depth = 'SECOND_VIEW'
  } else {
    const meet = roofMeet(m, view.side, (a0 + a1) / 2, yMeet)
    const d = a1 - a0
    // the stack's face seen in this elevation stands where it meets the roof; its depth is taken equal to its width
    c0 = meet.c - (outward(view.side) < 0 ? 0 : d)
    c1 = c0 + d
    if (yMeet >= yTop - 0.05) {
      c0 = meet.c - d / 2
      c1 = meet.c + d / 2
    }
    depth = meet.how
  }
  const footprint = ax === 'x' ? { minX: a0, maxX: a1, minZ: r6(c0), maxZ: r6(c1) } : { minX: r6(c0), maxX: r6(c1), minZ: a0, maxZ: a1 }
  // one stack seen from two sides is one stack: along this side's axis, a chimney already standing over most of the same
  // stretch is that stack (its depth from one view is not known well enough to tell two stacks apart behind each other)
  const alongOfChimney = (c: { footprint: { minX: number; maxX: number; minZ: number; maxZ: number } }): [number, number] => (ax === 'x' ? [c.footprint.minX, c.footprint.maxX] : [c.footprint.minZ, c.footprint.maxZ])
  const clash = m.chimneys.find((c) => {
    if (c.id === existing?.id) return false
    const [c0a, c1a] = alongOfChimney(c)
    if (Math.min(c1a, a1) - Math.max(c0a, a0) > 0.5 * Math.min(c1a - c0a, a1 - a0)) return true
    // whatever the axis: a stack whose plan footprint overlaps one standing is that stack seen again (two stacks do not
    // share masonry), not a second one to build into it
    return Math.min(c.footprint.maxX, footprint.maxX) > Math.max(c.footprint.minX, footprint.minX) && Math.min(c.footprint.maxZ, footprint.maxZ) > Math.max(c.footprint.minZ, footprint.minZ)
  })
  if (clash) return { status: 'DUPLICATE', code: 'CHIMNEY_ALREADY_THERE', why: `${clash.id} already stands there: a chimney is updated, never doubled` }
  const others = openingBoxes(m, view).map((o) => o.box)
  const currentBox = existing ? (() => {
    const xs2 = ax === 'x' ? [existing.footprint.minX, existing.footprint.maxX] : [existing.footprint.minZ, existing.footprint.maxZ]
    const lv = levelOf(m, existing.levelId).elevation + existing.baseOffset
    return boxOfSpan(view, { a0: xs2[0], a1: xs2[1], y0: Math.max(lv, eaves), y1: lv + existing.height })
  })() : undefined
  const fp = facadePx(m, view)
  const g = compareHypotheses(pic.raster, box, currentBox, { x0: Math.min(box.x0, fp.x0), x1: Math.max(box.x1, fp.x1) }, others, tolPxOf(view))
  const gate = { winner: g.winner, proposedZ: g.proposed.z, ...(g.current ? { currentZ: g.current.z } : {}), nullBoxes: g.proposed.null.n, why: g.why }
  const ground = m.levels.slice().sort((x, y) => x.elevation - y.elevation)[0]
  const id = existing?.id ?? `chimney-fix-${view.side.toLowerCase()}-${stableShort(p.proposalId, (q) => m.chimneys.some((o) => o.id === q), `chimney-fix-${view.side.toLowerCase()}-`)}`
  const record = { bound: { frameId: view.frameId, side: view.side, box, ids: [id], depth, values: { a0, a1, top: yTop, meet: yMeet } }, source: { frameId: pic.frameId, sourceByteHash: pic.sourceByteHash, crop: box }, gate }
  if (g.winner === 'CURRENT') return { status: 'REJECTED_BY_SOURCE', code: existing ? 'MODEL_BETTER_SUPPORTED' : 'SOURCE_SHOWS_NO_STACK', why: g.why, record }
  if (g.winner === 'UNDECIDED') return { status: 'NEEDS_EVIDENCE', code: 'SOURCE_UNDECIDED', why: g.why, record }
  const material = existing?.materialId ?? m.chimneys.find((c) => c.materialId)?.materialId ?? m.materials.find((x) => /chimney|brick/i.test(`${x.id} ${x.name}`))?.id
  const commands: BuildingCommand[] = [
    ...(existing ? [{ type: 'removeFeature' as const, targetId: existing.id, cascade: true }] : []),
    { type: 'placeChimney', id, levelId: ground?.id ?? 'lvl-0', footprint, baseOffset: 0, height: r6(yTop - (ground?.elevation ?? 0)), ...(material ? { materialId: material } : {}) },
  ]
  return { commands, allowed: [`chimneys:${id}`, ...(existing ? m.roofOpenings.filter((o) => (o as { throughId?: string }).throughId === existing.id).map((o) => `roofOpenings:${o.id}`) : [])], expect: { kind: 'CHIMNEY', id, view, box }, record }
}
function bindFinish(ctx: Ctx, p: CorrectionProposal): Bound | Refusal {
  const f = p.patch ?? {}
  if (!finiteBox(f.box) || !f.material) return { status: 'INVALID', code: 'NO_BOX', why: 'SET_FINISH states the area (box) and its material' }
  const at = elevationOf(ctx, p, f.picture, 'HEIGHTS')
  if ('status' in at) return at
  const { pic, view } = at
  const box = toFrame(pic, p, f.box)
  if (!inPicture(pic, box)) return { status: 'INVALID', code: 'OUT_OF_PICTURE', why: `the box lies outside picture ${pic.n}` }
  const obs: AppearanceObservation = {
    schema: APPEARANCE_OBSERVATION_SCHEMA,
    schemaVersion: APPEARANCE_OBSERVATION_VERSION,
    observationId: `finish-${short(p.proposalId)}`,
    facade: facadeOfSide(view.side),
    source: { sourceByteHash: pic.sourceByteHash, imageSha256: pic.sourceByteHash, imageWidth: pic.raster.width, imageHeight: pic.raster.height, sourceWidth: pic.raster.width, sourceHeight: pic.raster.height },
    toSource: [[1, 0, 0], [0, 1, 0]],
    toSourceWhy: 'a box in the original elevation\'s own frame pixels',
    toSourceResidualPx: 0,
    regions: [{ regionId: `finish-${short(p.proposalId)}-r`, class: f.material, outline: p.frameId && f.outline && f.outline.length >= 3 && f.outline.every((q) => Number.isFinite(q[0]) && Number.isFinite(q[1])) ? f.outline : [[box.x0, box.y0], [box.x1, box.y0], [box.x1, box.y1], [box.x0, box.y1]], visibility: 'VISIBLE', uncertaintyPx: Math.max(2, tolPxOf(view)) }],
    producer: { kind: p.origin === 'SKETCH' ? 'API_CONTOUR_READING' : 'MANUAL_DIAGNOSTIC', version: CORRECTION_EXECUTOR_VERSION },
  } as AppearanceObservation
  const hosts = exteriorWalls(ctx.model).filter((w) => sideOfWall(ctx.model, w) === view.side).map((w) => w.id)
  return { commands: [], appearance: { obs, projection: view.projection }, allowed: ['surfaceRegions:*', 'materials:*'], expect: { kind: 'FINISH', hosts }, record: { bound: { frameId: view.frameId, side: view.side, box, ids: hosts }, source: { frameId: pic.frameId, sourceByteHash: pic.sourceByteHash, crop: box } } }
}

/** A3: which printed roles state each property (a ceiling mark is never a floor, a ridge never a wall top). */
export const WITNESS_ROLES: Record<NonNullable<PatchFields['property']>, readonly string[]> = { LEVEL_ELEVATION: ['FLOOR'], WALL_HEIGHT: ['EAVES', 'CEILING'], CHIMNEY_HEIGHT: ['CHIMNEY'], ROOF_PITCH: ['ROOF_PITCH'] }

/**
 * A3: the one printed observation that witnesses `v` for this property, or why there is none: the role must state
 * the property; the mark must be anchored (a frame and its source byte hash); when the proposal names its picture, the
 * mark must be on that picture's frame; in a model of more than one body the mark and the proposal must name the same
 * body; and two candidates that remain on different bodies or pictures are ambiguous — neither is chosen.
 */
function bindWitness(ctx: Ctx, f: PatchFields, v: number, targetId: string): { witness: PrintedWitness; resolution: WitnessResolution } | Refusal {
  const prop = f.property as NonNullable<PatchFields['property']>
  const unit = prop === 'ROOF_PITCH' ? 'deg' : 'm'
  const tol = unit === 'deg' ? 0.5 : 0.005
  const sameValue = ctx.witnesses.filter((w) => w.unit === unit && Math.abs(w.valueM - v) <= tol)
  if (sameValue.length === 0) return { status: 'NEEDS_EVIDENCE', code: 'NO_INDEPENDENT_WITNESS', why: `${v} ${unit} is not among the printed values the analyzer or the independent metric read hold: the proposer's own reading is not a second witness` }
  const roles = WITNESS_ROLES[prop]
  const roled = sameValue.filter((w) => w.role !== undefined && roles.includes(w.role))
  if (roled.length === 0) return { status: 'NEEDS_EVIDENCE', code: 'WITNESS_ROLE_MISMATCH', why: `${v} ${unit} is printed (${sameValue.map((w) => `${w.literal ?? w.valueM} on ${w.frameId}${w.role ? ` as ${w.role}` : ', role unknown'}`).join('; ').slice(0, 240)}) but not as a ${roles.join(' / ')} mark: an equal number is not a witness of ${prop}` }
  const anchored = roled.filter((w) => !!w.frameId && !!w.sourceByteHash)
  if (anchored.length === 0) return { status: 'NEEDS_EVIDENCE', code: 'WITNESS_NOT_ANCHORED', why: `the ${roles.join(' / ')} mark ${v} ${unit} has no source frame and byte hash: it cannot be traced to a picture` }
  let cand = anchored
  if (f.sourcePicture !== undefined) {
    const pic = ctx.pictures.find((x) => x.n === f.sourcePicture)
    cand = pic ? anchored.filter((w) => w.frameId === pic.frameId) : []
    if (cand.length === 0) return { status: 'NEEDS_EVIDENCE', code: 'WITNESS_NOT_ON_PICTURE', why: `the proposal reads ${v} ${unit} on picture ${f.sourcePicture}${pic ? ` (${pic.frameId})` : ', which is not a source picture of this check'}; the matching mark is on ${anchored.map((w) => w.frameId).join(', ')}` }
  }
  // v3.54.17: the witness and the target must stand on the same body of the model, by place, never by name
  const res = resolveWitness(ctx.model, ctx.views, targetId, prop, cand)
  if (!res.ok) return { status: 'NEEDS_EVIDENCE', code: res.code, why: res.why }
  return { witness: res.witness, resolution: { observationId: res.witness.observationId, frameId: res.witness.frameId, ...(res.located ? { bodyId: res.located.bodyId, alongM: res.located.alongM } : {}), ...(res.targetBodyIds ? { targetBodyIds: res.targetBodyIds } : {}), datum: res.datum, resolver: WITNESS_RESOLVER_VERSION, why: res.why } }
}

function bindParameter(ctx: Ctx, p: CorrectionProposal): Bound | Refusal {
  const m = ctx.model
  const f = p.patch ?? {}
  if (!f.property || typeof f.value !== 'number' || !Number.isFinite(f.value) || !f.unit) return { status: 'INVALID', code: 'NO_VALUE', why: 'SET_PARAMETER states property, value and unit as printed' }
  const k = f.unit === 'cm' ? 0.01 : f.unit === 'mm' ? 0.001 : 1
  const v = f.value * k
  if (f.property === 'ROOF_PITCH' ? f.unit !== 'deg' : f.unit === 'deg') return { status: 'INVALID', code: 'WRONG_UNIT', why: `${f.property} in ${f.unit}: a pitch is in degrees, a level or height in m, cm or mm` }
  if (f.literal !== undefined) {
    const num = Number((f.literal.match(/[-+±]?\d+(?:[.,]\d+)?/)?.[0] ?? 'NaN').replace(',', '.').replace('±', ''))
    if (!Number.isFinite(num) || Math.abs(num - f.value) > 1e-6) return { status: 'INVALID', code: 'LITERAL_MISMATCH', why: `the literal "${f.literal}" does not state the value ${f.value}` }
  }
  // A3: a witness is a bound observation someone other than the proposer read — the same value is only one condition
  const bw = bindWitness(ctx, f, v, p.targetId)
  if ('status' in bw) return bw
  const witness = bw.witness
  const allowed: string[] = []
  const commands: BuildingCommand[] = []
  const source = { frameId: witness.frameId, sourceByteHash: witness.sourceByteHash as string }
  if (f.property === 'LEVEL_ELEVATION') {
    const lv = m.levels.find((l) => l.id === p.targetId)
    if (!lv) return { status: 'INVALID', code: 'UNKNOWN_TARGET', why: `${p.targetId} is not a level` }
    const below = m.levels.filter((l) => l.elevation < lv.elevation).sort((a, b) => b.elevation - a.elevation)[0]
    if (below && !(v > below.elevation + 1.8)) return { status: 'INVALID', code: 'IMPOSSIBLE_STOREY', why: `${v} m would leave ${(v - below.elevation).toFixed(2)} m over ${below.id}` }
    commands.push({ type: 'setProperty', targetId: lv.id, property: 'elevation', value: r6(v) })
    allowed.push(`levels:${lv.id}`)
    if (below) {
      // dependents: the storey below now reaches the new floor; its walls of the old full height follow it
      commands.push({ type: 'setProperty', targetId: below.id, property: 'height', value: r6(v - below.elevation) })
      allowed.push(`levels:${below.id}`)
      for (const w of m.walls.filter((x) => x.levelId === below.id && !x.topProfile && Math.abs(x.baseOffset + x.height - below.height) < 0.002)) {
        commands.push({ type: 'setProperty', targetId: w.id, property: 'height', value: r6(v - below.elevation - w.baseOffset) })
        allowed.push(`walls:${w.id}`)
      }
    }
    return { commands, allowed, expect: { kind: 'PARAM', targetId: lv.id, property: 'elevation', value: r6(v) }, record: { witness: bw.resolution, bound: { frameId: witness.frameId, ids: allowed.map((a) => a.split(':')[1]), values: { valueM: r6(v) } }, source } }
  }
  if (f.property === 'WALL_HEIGHT' || f.property === 'CHIMNEY_HEIGHT') {
    const obj = f.property === 'WALL_HEIGHT' ? m.walls.find((w) => w.id === p.targetId) : m.chimneys.find((c) => c.id === p.targetId)
    if (!obj) return { status: 'INVALID', code: 'UNKNOWN_TARGET', why: `${p.targetId} is not a ${f.property === 'WALL_HEIGHT' ? 'wall' : 'chimney'}` }
    if (f.property === 'WALL_HEIGHT' && (obj as Wall).topProfile) return { status: 'UNSUPPORTED_OPERATION', code: 'TOP_FOLLOWS_ROOF', why: `${obj.id}'s top follows the roof: its height is the roof's, not a parameter of the wall` }
    const base = levelOf(m, obj.levelId).elevation + obj.baseOffset
    const h = r6(v - base)
    if (!(h > 0.3)) return { status: 'INVALID', code: 'IMPOSSIBLE_HEIGHT', why: `the printed level ${v} m is ${h} m above ${obj.id}'s base` }
    const coll = f.property === 'WALL_HEIGHT' ? 'walls' : 'chimneys'
    return { commands: [{ type: 'setProperty', targetId: obj.id, property: 'height', value: h }], allowed: [`${coll}:${obj.id}`], expect: { kind: 'PARAM', targetId: obj.id, property: 'height', value: h }, record: { witness: bw.resolution, bound: { frameId: witness.frameId, ids: [obj.id], values: { valueM: r6(v), height: h } }, source } }
  }
  const roof = m.roofs.find((r) => r.id === p.targetId)
  if (!roof) return { status: 'UNSUPPORTED_OPERATION', code: m.roofPlanes.some((r) => r.id === p.targetId) ? 'PLANE_ROOF_PITCH' : 'UNKNOWN_TARGET', why: m.roofPlanes.some((r) => r.id === p.targetId) ? `${p.targetId} is a roof plane: its pitch follows from the planes meeting at the ridge; a single plane is not re-pitched in this version` : `${p.targetId} is not a roof` }
  return { commands: [{ type: 'setProperty', targetId: roof.id, property: 'pitchDeg', value: r6(v) }], allowed: [`roofs:${roof.id}`], expect: { kind: 'PARAM', targetId: roof.id, property: 'pitchDeg', value: r6(v) }, record: { witness: bw.resolution, bound: { frameId: witness.frameId, ids: [roof.id], values: { pitchDeg: r6(v) } }, source } }
}

/**
 * v3.54.17 R3: the height of the eaves seen on `side` — where the main pitched roof over that side's walls begins (the
 * lowest edge of its slopes, the same height at a gable end's corners). Before R3 this was the tallest wall on the side,
 * which on a gable-walled storey is the gable's top: a single-storey house with a 5.9 m gable wall then "had" its eaves at
 * 5.9 m and every registration of its true 2.8 m eaves was refused as the other axis. Flat roofs only: the walls' tops.
 */
export function sideEavesM(m: CanonicalBuildingModel, side: Side, range?: { lo: number; hi: number }): number {
  const r = range ?? sideRange(m, side)
  const ax = alongAxis(side)
  const pitched = m.roofs.filter((x) => x.kind !== 'FLAT' && x.pitchDeg > 0)
  const over = pitched.map((x) => {
    const f = x.footprint
    const [lo, hi] = ax === 'x' ? [f.minX, f.maxX] : [f.minZ, f.maxZ]
    const share = r ? Math.max(0, Math.min(hi, r.hi) - Math.max(lo, r.lo)) : hi - lo
    return { x, share, area: (f.maxX - f.minX) * (f.maxZ - f.minZ) }
  }).filter((o) => o.share > 0).sort((a, b) => b.share - a.share || b.area - a.area)[0]
  if (over) return levelOf(m, over.x.levelId).elevation + over.x.eaveOffset
  const walls = exteriorWalls(m).filter((w) => sideOfWall(m, w) === side)
  return Math.max(...walls.map((w) => { const lv = levelOf(m, w.levelId); return lv.elevation + w.baseOffset + (w.topProfile ? lv.height : w.height) }))
}

/** v3.54.17 R3: the pitched roof over `side`'s walls (the most of its run, then the largest) — the main roof seen there. */
export function sideRoof(m: CanonicalBuildingModel, side: Side, range?: { lo: number; hi: number }): CanonicalBuildingModel['roofs'][number] | undefined {
  const r = range ?? sideRange(m, side)
  const ax = alongAxis(side)
  return m.roofs.filter((x) => x.kind !== 'FLAT' && x.pitchDeg > 0).map((x) => {
    const f = x.footprint
    const [lo, hi] = ax === 'x' ? [f.minX, f.maxX] : [f.minZ, f.maxZ]
    return { x, share: r ? Math.max(0, Math.min(hi, r.hi) - Math.max(lo, r.lo)) : hi - lo, area: (f.maxX - f.minX) * (f.maxZ - f.minZ) }
  }).filter((o) => o.share > 0).sort((a, b) => b.share - a.share || b.area - a.area)[0]?.x
}

/**
 * v3.54.18 — ADD_ROOF_WINDOW: a window in the plane of a slope (a skylight), read on the elevation that sees that slope
 * face-on. Before v3.54.18 such a window had no consumer: the sketch's opening "drawn on the roof and on no wall" was
 * skipped by name, so a house with seven roof windows had none. The box is placed up the slope by plain geometry — a
 * point h above the eaves lies h / tan(pitch) in from the eaves line — on the pitched roof over that stretch, and judged
 * against the ORIGINAL picture on the roof's own band (a framed element on the covering), with the reading's other
 * elements out of the band. Refused by name: a gable-side view (the slope is seen edge-on there), a view without heights,
 * a box that is not on the slope (below the eaves, past the ridge), another roof opening already there.
 */
function bindRoofWindow(ctx: Ctx, p: CorrectionProposal): Bound | Refusal {
  const m = ctx.model
  const f = p.patch ?? {}
  if (!finiteBox(f.box)) return { status: 'INVALID', code: 'NO_BOX', why: 'ADD_ROOF_WINDOW states the window\'s box in a source picture (x0 < x1, y0 < y1)' }
  const at = elevationOf(ctx, p, f.picture, 'HEIGHTS')
  if ('status' in at) return at
  const { pic, view } = at
  const box = toFrame(pic, p, f.box)
  if (!inPicture(pic, box)) return { status: 'INVALID', code: 'OUT_OF_PICTURE', why: `the box lies outside picture ${pic.n}` }
  const pr = view.projection
  const xs = [alongOf(pr, box.x0), alongOf(pr, box.x1)]
  const a0 = r6(Math.min(...xs))
  const a1 = r6(Math.max(...xs))
  const h0 = yOf(pr, box.y1)
  const h1 = yOf(pr, box.y0)
  const roof = sideRoof(m, view.side, { lo: a0, hi: a1 })
  if (!roof) return { status: 'NEEDS_EVIDENCE', code: 'NO_PITCHED_ROOF', why: `the model has no pitched roof over ${a0.toFixed(2)}..${a1.toFixed(2)} m of the ${view.side.toLowerCase()} side` }
  const ax = alongAxis(view.side)
  if ((roof.ridgeAxis === 'X') !== (ax === 'x')) return { status: 'NEEDS_EVIDENCE', code: 'SLOPE_SEEN_EDGE_ON', why: `${roof.id}'s ridge runs across the ${view.side.toLowerCase()} side (a gable end): its slopes are seen edge-on there, and a window in a slope is placed from the elevation that sees the slope face-on` }
  const eaves = levelOf(m, roof.levelId).elevation + roof.eaveOffset
  const tan = Math.tan((roof.pitchDeg * Math.PI) / 180)
  const fp = roof.footprint
  const half = (ax === 'x' ? fp.maxZ - fp.minZ : fp.maxX - fp.minX) / 2
  const t0 = r6((h0 - eaves) / tan)
  const t1 = r6((h1 - eaves) / tan)
  const [lo, hi] = ax === 'x' ? [fp.minX, fp.maxX] : [fp.minZ, fp.maxZ]
  const record = { bound: { frameId: view.frameId, side: view.side, box, hostId: roof.id, ids: [] as string[], values: { alongFrom: a0, alongTo: a1, aboveEavesFrom: r6(h0 - eaves), aboveEavesTo: r6(h1 - eaves), inFromEavesFrom: t0, inFromEavesTo: t1 } }, source: { frameId: pic.frameId, sourceByteHash: pic.sourceByteHash, crop: box } }
  if (!(a1 - a0 >= 0.3) || !(t1 - t0 >= 0.2) || t0 < -0.15 || t1 > half - 0.05 || a0 < lo - 0.05 || a1 > hi + 0.05) return { status: 'INVALID', code: 'NOT_ON_THE_SLOPE', why: `the box runs ${a0.toFixed(2)}..${a1.toFixed(2)} m along and ${(h0 - eaves).toFixed(2)}..${(h1 - eaves).toFixed(2)} m above the eaves of ${roof.id} (${t0.toFixed(2)}..${t1.toFixed(2)} m in from the eaves at ${roof.pitchDeg}°; the slope is ${half.toFixed(2)} m deep, ${lo.toFixed(2)}..${hi.toFixed(2)} m along): not a window on that slope`, record }
  const u0 = Math.max(0, t0)
  const near = view.side === 'FRONT' || view.side === 'LEFT'
  const [p0, p1] = ax === 'x' ? (near ? [fp.minZ + u0, fp.minZ + t1] : [fp.maxZ - t1, fp.maxZ - u0]) : near ? [fp.minX + u0, fp.minX + t1] : [fp.maxX - t1, fp.maxX - u0]
  const footprint = ax === 'x' ? { minX: a0, maxX: a1, minZ: r6(p0), maxZ: r6(p1) } : { minX: r6(p0), maxX: r6(p1), minZ: a0, maxZ: a1 }
  const clash = m.roofOpenings.find((o) => { const q = (o as { footprint?: { minX: number; maxX: number; minZ: number; maxZ: number } }).footprint; return !!q && Math.min(q.maxX, footprint.maxX) - Math.max(q.minX, footprint.minX) > 0.02 && Math.min(q.maxZ, footprint.maxZ) - Math.max(q.minZ, footprint.minZ) > 0.02 })
  if (clash) return { status: 'DUPLICATE', code: 'ROOF_OPENING_ALREADY_THERE', why: `${clash.id} already stands on that part of ${roof.id}: a roof opening is never doubled`, record }
  // the source gate on the roof's own band: the slope's rows (eaves to ridge) across the roof's run on this side
  const band = { x0: Math.min(pxOf(pr, lo), pxOf(pr, hi)), x1: Math.max(pxOf(pr, lo), pxOf(pr, hi)), y0: pyOf(pr, eaves + half * tan), y1: pyOf(pr, eaves) }
  const claimed = ctx.claims?.get(pic.frameId) ?? []
  const sup = supportOf(pic.raster, box, band, [box, ...claimed], tolPxOf(view), false, [box, ...claimed])
  const gate = { winner: (sup.z === null ? 'UNDECIDED' : sup.supported ? 'PROPOSED' : sup.z < SUPPORT_Z_MIN - HYPOTHESIS_Z_MARGIN ? 'CURRENT' : 'UNDECIDED') as HypothesisVerdict['winner'], proposedZ: sup.z, nullBoxes: sup.null.n, ...(sup.null.mode ? { nullMode: sup.null.mode } : {}), why: sup.z === null ? 'too few same-size places on the roof band to judge' : sup.supported ? `the source draws a framed element on the slope in the proposed box (z ${sup.z})` : `the source draws nothing distinct enough on the slope there (z ${sup.z})`, measure: 'BOX' as const }
  const id = `rw-fix-${view.side.toLowerCase()}-${stableShort(p.proposalId, (q) => m.roofOpenings.some((o) => o.id === q) || m.rooflights.some((o) => o.id === q), `rw-fix-${view.side.toLowerCase()}-`)}`
  const rec = { ...record, bound: { ...record.bound, ids: [id] }, gate }
  if (gate.winner === 'CURRENT') return { status: 'REJECTED_BY_SOURCE', code: 'SOURCE_SHOWS_NO_ROOF_WINDOW', why: gate.why, record: rec }
  if (gate.winner === 'UNDECIDED') return { status: 'NEEDS_EVIDENCE', code: 'SOURCE_UNDECIDED', why: gate.why, record: rec }
  const measure = (working: CanonicalBuildingModel): { failure?: string; measure: NonNullable<PatchRecord['measure']> } => {
    const built = working.roofOpenings.find((o) => o.id === id)
    const lit = working.rooflights.some((l) => (l as { roofOpeningId?: string }).roofOpeningId === id)
    return { ...(built && lit ? {} : { failure: `${id} was not built with its light on ${roof.id}` }), measure: { sourceVerified: built && lit ? true : null, builtSupportZ: sup.z, why: built && lit ? `${id} (ROOFLIGHT) cut in ${roof.id} ${t0.toFixed(2)}..${t1.toFixed(2)} m in from the eaves, with its light; the box is supported by the source (z ${sup.z})` : `${id} is not in the candidate` } }
  }
  return { commands: [{ type: 'cutRoofOpening', id, roofId: roof.id, kind: 'ROOFLIGHT', footprint }, { type: 'placeRooflight', id: `${id}-light`, roofOpeningId: id }] as BuildingCommand[], allowed: [`roofOpenings:${id}`, `rooflights:${id}-light`, `roofs:${roof.id}`], expect: { kind: 'CUSTOM', measure }, record: rec }
}

/** v3.54.17 R3: the most the two ends of one drawn roof may differ in overhang before it is not read as one overhang. */
export const OVERHANG_END_SPREAD_M = 0.4
/** A difference from the model's overhang below this is the drawing's resolution, not a correction. */
export const OVERHANG_MIN_CHANGE_M = 0.1

/**
 * SET_ROOF_OVERHANG: how far the roof stands past the walls, read on a source elevation through its registration — the
 * drawn roof's two ends against the drawn walls' two outer corners. Before R3 every roof the analyzer built or set had no
 * overhang at all (createRoof overhang 0): the eaves and verges ended flush with the walls, where the drawings show the
 * roof standing out. Both ends are read; each must be ≥ 0 (a drawn roof narrower than its walls is not an overhang) and
 * ≤ MAX_OVERHANG_M, and they must agree within OVERHANG_END_SPREAD_M; the walls must land on the side's walls at that
 * registration (the drawing's walls are the model's). The roof takes their mean (one overhang per roof in the model).
 */
function bindOverhang(ctx: Ctx, p: CorrectionProposal): Bound | Refusal {
  const m = ctx.model
  const f = p.patch ?? {}
  const roof = m.roofs.find((r) => r.id === p.targetId)
  if (!roof) return { status: 'INVALID', code: 'UNKNOWN_TARGET', why: `${p.targetId} is not a roof of this revision` }
  const xs = [f.roofLeftX, f.roofRightX, f.wallLeftX, f.wallRightX]
  if (!xs.every((v) => typeof v === 'number' && Number.isFinite(v))) return { status: 'INVALID', code: 'NO_ANCHORS', why: 'SET_ROOF_OVERHANG states roofLeftX, roofRightX, wallLeftX and wallRightX' }
  const at = elevationOf(ctx, p, f.picture, 'ALONG')
  if ('status' in at) return at
  const { pic, view } = at
  const [rl, rr, wl, wr] = (xs as number[]).map((x) => toFrameX(pic, p, x))
  if (!(rr > rl && wr > wl)) return { status: 'INVALID', code: 'NO_ANCHORS', why: 'the roof\'s and the walls\' ends are not left before right' }
  const pr = view.projection
  const range = sideRange(m, view.side)
  if (!range) return { status: 'INVALID', code: 'NO_SUCH_SIDE', why: `the model has no exterior wall on the ${view.side.toLowerCase()} side` }
  const wa = [alongOf(pr, wl), alongOf(pr, wr)].sort((a, b) => a - b)
  const tolWall = Math.max(0.15, 3 * view.alongErrorM)
  if (Math.abs(wa[0] - range.lo) > tolWall || Math.abs(wa[1] - range.hi) > tolWall) return { status: 'REJECTED_BY_SOURCE', code: 'WALLS_NOT_THE_SIDE', why: `at this registration the drawn walls stand ${wa[0].toFixed(2)}..${wa[1].toFixed(2)} m along the ${view.side.toLowerCase()} side, the model's ${range.lo.toFixed(2)}..${range.hi.toFixed(2)} m (tolerance ${tolWall.toFixed(2)} m): the overhang would be measured from other walls` }
  const left = (wl - rl) * pr.mpp
  const right = (rr - wr) * pr.mpp
  const record = { bound: { frameId: pic.frameId, ids: [roof.id], values: { leftM: r6(left), rightM: r6(right) } }, source: { frameId: pic.frameId, sourceByteHash: pic.sourceByteHash } }
  // a drawn end a pixel or two inside the wall corner is the drawing's line width, not a negative overhang
  const noise = Math.max(0.03, 2 * pr.mpp)
  if (left < -noise || right < -noise) return { status: 'REJECTED_BY_SOURCE', code: 'ROOF_NARROWER_THAN_WALLS', why: `the drawn roof ends ${left.toFixed(2)} / ${right.toFixed(2)} m past the walls: narrower than the walls is not an overhang`, record }
  if (Math.max(left, right) > MAX_OVERHANG_M) return { status: 'NEEDS_EVIDENCE', code: 'IMPLAUSIBLE_OVERHANG', why: `the drawn roof stands ${left.toFixed(2)} / ${right.toFixed(2)} m past the walls; more than ${MAX_OVERHANG_M} m is a canopy or another body's roof, not this roof's overhang`, record }
  const cm = (v: number): number => Math.round(Math.max(0, v) * 100) / 100
  const ax = alongAxis(view.side)
  const ridgeAx = roof.ridgeAxis === 'Z' ? 'z' : 'x'
  const f0 = roof.footprint
  const [fLo, fHi] = ax === 'x' ? [f0.minX, f0.maxX] : [f0.minZ, f0.maxZ]
  if (roof.kind !== 'FLAT' && ax === ridgeAx) {
    // an eaves-side elevation: the roof's two ends past the walls are its VERGES, read end by end (they may differ). The
    // roof is lengthened along its ridge to them (its eaves, ridge and slopes are unchanged by a longer ridge); the
    // all-round overhang already in the model counts towards them.
    const tolEnd = Math.max(0.15, 3 * view.alongErrorM)
    if (fLo > range.lo + tolEnd) return { status: 'NEEDS_EVIDENCE', code: 'ROOF_NOT_AT_SIDE_ENDS', why: `${roof.id} does not reach the ${view.side.toLowerCase()} side's ends (${fLo.toFixed(2)}..${fHi.toFixed(2)} vs ${range.lo.toFixed(2)}..${range.hi.toFixed(2)} m): its verges are not the drawn roof's ends`, record }
    if (fHi < range.hi - tolEnd) return { status: 'NEEDS_EVIDENCE', code: 'ROOF_NOT_AT_SIDE_ENDS', why: `${roof.id} does not reach the ${view.side.toLowerCase()} side's ends (${fLo.toFixed(2)}..${fHi.toFixed(2)} vs ${range.lo.toFixed(2)}..${range.hi.toFixed(2)} m): its verges are not the drawn roof's ends`, record }
    // which drawn end is the low end of the axis: the registration's own sign
    const [vLo, vHi] = pr.alongSign > 0 ? [left, right] : [right, left]
    const lo = r6(range.lo - Math.max(0, cm(vLo) - roof.overhang))
    const hi = r6(range.hi + Math.max(0, cm(vHi) - roof.overhang))
    if (Math.abs(lo - fLo) < OVERHANG_MIN_CHANGE_M && Math.abs(hi - fHi) < OVERHANG_MIN_CHANGE_M) return { status: 'NO_EFFECT', code: 'OVERHANG_AGREES', why: `the drawn verges ${cm(vLo).toFixed(2)} / ${cm(vHi).toFixed(2)} m and the model's agree within ${OVERHANG_MIN_CHANGE_M} m`, record }
    const footprint = ax === 'x' ? { ...f0, minX: lo, maxX: hi } : { ...f0, minZ: lo, maxZ: hi }
    const measure = (working: CanonicalBuildingModel): { failure?: string; measure: NonNullable<PatchRecord['measure']> } => {
      const r = working.roofs.find((x) => x.id === roof.id)
      const got = r ? (ax === 'x' ? [r.footprint.minX, r.footprint.maxX] : [r.footprint.minZ, r.footprint.maxZ]) : undefined
      const ok = !!got && Math.abs(got[0] - lo) < 0.005 && Math.abs(got[1] - hi) < 0.005
      return { ...(ok ? {} : { failure: `${roof.id}'s ends are not at ${lo}..${hi}` }), measure: { sourceVerified: null, why: `verges ${cm(vLo).toFixed(2)} / ${cm(vHi).toFixed(2)} m past the ${view.side.toLowerCase()} side's walls: ${roof.id} runs ${lo.toFixed(2)}..${hi.toFixed(2)} m along its ridge` } }
    }
    return { commands: [{ type: 'resizeFeature', targetId: roof.id, footprint }], allowed: [`roofs:${roof.id}`], expect: { kind: 'CUSTOM', measure }, record: { ...record, bound: { ...record.bound, values: { ...record.bound.values, vergeLowM: cm(vLo), vergeHighM: cm(vHi), footprintLo: lo, footprintHi: hi } } } }
  }
  // a gable-end elevation (or a flat roof): the two ends past the walls are the EAVES overhang, one value for the roof
  if (Math.abs(left - right) > OVERHANG_END_SPREAD_M) return { status: 'NEEDS_EVIDENCE', code: 'ASYMMETRIC_OVERHANG', why: `the two eaves stand ${left.toFixed(2)} and ${right.toFixed(2)} m past the walls: more than ${OVERHANG_END_SPREAD_M} m apart, not one overhang (named, not averaged)`, record }
  const v = cm((left + right) / 2)
  if (Math.abs(v - roof.overhang) < OVERHANG_MIN_CHANGE_M) return { status: 'NO_EFFECT', code: 'OVERHANG_AGREES', why: `the drawing's ${v.toFixed(2)} m and the model's ${roof.overhang.toFixed(2)} m agree within ${OVERHANG_MIN_CHANGE_M} m`, record }
  // the overhang is all round: verges a lengthened ridge already gives keep their reach (the ridge shortened by the change)
  const cmds: BuildingCommand[] = [{ type: 'setProperty', targetId: roof.id, property: 'overhang', value: v }]
  if (roof.kind !== 'FLAT') {
    const rr0 = sideRange(m, ridgeAx === 'x' ? 'FRONT' : 'RIGHT')
    const [gLo, gHi] = ridgeAx === 'x' ? [f0.minX, f0.maxX] : [f0.minZ, f0.maxZ]
    if (rr0 && (gLo < rr0.lo - 1e-6 || gHi > rr0.hi + 1e-6)) {
      const lo = r6(Math.min(rr0.lo, gLo + (v - roof.overhang)))
      const hi = r6(Math.max(rr0.hi, gHi - (v - roof.overhang)))
      cmds.push({ type: 'resizeFeature', targetId: roof.id, footprint: ridgeAx === 'x' ? { ...f0, minX: lo, maxX: hi } : { ...f0, minZ: lo, maxZ: hi } })
    }
  }
  // the overhang is all round in the model: where another body's roof stands under a side's reach (a lower annex against
  // the eaves), the eaves' underside must pass over it — the overhang is capped at the reach that clears it (named), never
  // built into it. (A plate trimmed back on one side is not used: the walls following the roof then cut into it.)
  const levelFull = (id: string) => m.levels.find((l) => l.id === id) as CanonicalBuildingModel['levels'][number]
  const main = roofGeometry({ ...roof, overhang: v }, levelFull(roof.levelId))
  const E = 0.02
  const sides = ['minX', 'maxX', 'minZ', 'maxZ'] as const
  const strip = (k: (typeof sides)[number]): { minX: number; maxX: number; minZ: number; maxZ: number } => k === 'minX' ? { minX: f0.minX - v, maxX: f0.minX - E, minZ: f0.minZ - v, maxZ: f0.maxZ + v } : k === 'maxX' ? { minX: f0.maxX + E, maxX: f0.maxX + v, minZ: f0.minZ - v, maxZ: f0.maxZ + v } : k === 'minZ' ? { minX: f0.minX - v, maxX: f0.maxX + v, minZ: f0.minZ - v, maxZ: f0.minZ - E } : { minX: f0.minX - v, maxX: f0.maxX + v, minZ: f0.maxZ + E, maxZ: f0.maxZ + v }
  const dist = (k: (typeof sides)[number], x: number, z: number): number => (k === 'minX' ? f0.minX - x : k === 'maxX' ? x - f0.maxX : k === 'minZ' ? f0.minZ - z : z - f0.maxZ)
  let cap = v
  const blockers: string[] = []
  for (const o of m.roofs.filter((r) => r.id !== roof.id)) {
    const og = roofGeometry(o, levelFull(o.levelId))
    for (const k of sides) {
      const st = strip(k)
      const ix = { minX: Math.max(st.minX, og.covered.minX), maxX: Math.min(st.maxX, og.covered.maxX), minZ: Math.max(st.minZ, og.covered.minZ), maxZ: Math.min(st.maxZ, og.covered.maxZ) }
      if (!(ix.maxX - ix.minX > E && ix.maxZ - ix.minZ > E)) continue
      for (let i = 0; i <= 6; i += 1) for (let j = 0; j <= 6; j += 1) {
        const x = ix.minX + ((ix.maxX - ix.minX) * i) / 6
        const z = ix.minZ + ((ix.maxZ - ix.minZ) * j) / 6
        if (!main.covers(x, z) || !og.covers(x, z)) continue
        if (main.undersideAt(x, z) >= og.topAt(x, z) + E) continue
        // this point of the reach meets the other roof: the overhang stops short of it
        const d = dist(k, x, z)
        if (d < cap) {
          cap = Math.max(0, d - E)
          if (!blockers.includes(o.id)) blockers.push(o.id)
        }
      }
    }
  }
  // and the walls of other bodies standing in that reach (an annex's parapet): their tops are fixed heights
  for (const w of exteriorWalls(m)) {
    if (w.topProfile?.kind === 'FOLLOW_ROOF' && w.topProfile.roofId === roof.id) continue
    const wl = levelFull(w.levelId)
    if (!wl) continue
    const topY = wl.elevation + w.baseOffset + (w.topProfile?.kind === 'POLYLINE' ? Math.max(...w.topProfile.points.map((q) => q.height)) : w.height)
    const dx = w.end.x - w.start.x
    const dz = w.end.z - w.start.z
    const len = Math.hypot(dx, dz)
    if (len < 1e-6) continue
    const nx = -dz / len
    const nz = dx / len
    for (let i = 0; i <= 10; i += 1) for (const off of [-w.thickness, 0, w.thickness]) {
      const x = w.start.x + (dx * i) / 10 + nx * off
      const z = w.start.z + (dz * i) / 10 + nz * off
      for (const k of sides) {
        const d = dist(k, x, z)
        if (!(d > E && d <= v) || !main.covers(x, z)) continue
        if (main.undersideAt(x, z) >= topY + E) continue
        if (d < cap) {
          cap = Math.max(0, d - E)
          if (!blockers.includes(w.id)) blockers.push(w.id)
        }
      }
    }
  }
  const vc = cm(Math.min(v, cap))
  if (blockers.length > 0 && Math.abs(vc - roof.overhang) < OVERHANG_MIN_CHANGE_M) return { status: 'NEEDS_EVIDENCE', code: 'OVERHANG_BLOCKED', why: `the drawn ${v.toFixed(2)} m eaves overhang would run into ${blockers.join(', ')}; the most that clears it (${vc.toFixed(2)} m) is no change from the model's ${roof.overhang.toFixed(2)} m (one overhang all round in the model: named, not built)`, record: { ...record, bound: { ...record.bound, values: { ...record.bound.values, overhangM: v, clearsM: vc } } } }
  if (vc !== v) {
    cmds[0] = { type: 'setProperty', targetId: roof.id, property: 'overhang', value: vc }
    if (cmds[1] && cmds[1].type === 'resizeFeature') {
      const rr0 = sideRange(m, ridgeAx === 'x' ? 'FRONT' : 'RIGHT')
      const [gLo, gHi] = ridgeAx === 'x' ? [f0.minX, f0.maxX] : [f0.minZ, f0.maxZ]
      if (rr0) {
        const lo = r6(Math.min(rr0.lo, gLo + (vc - roof.overhang)))
        const hi = r6(Math.max(rr0.hi, gHi - (vc - roof.overhang)))
        cmds[1] = { type: 'resizeFeature', targetId: roof.id, footprint: ridgeAx === 'x' ? { ...f0, minX: lo, maxX: hi } : { ...f0, minZ: lo, maxZ: hi } }
      }
    }
  }
  return { commands: cmds, allowed: [`roofs:${roof.id}`], expect: { kind: 'PARAM', targetId: roof.id, property: 'overhang', value: vc }, record: { ...record, bound: { ...record.bound, values: { ...record.bound.values, overhangM: vc, ...(vc !== v ? { drawnOverhangM: v } : {}) } } } }
}

/** The sketch's anchors of one elevation, in that elevation's frame pixels (the provider's typed contours). */
export type SketchAnchors = { frameId: string; side: Side; wallLeftX: number; wallRightX: number; groundY: number; eavesY: number; /** the drawn roof's top row (its ridge or apex) */ ridgeY?: number }

/**
 * v3.54.17 R3: a source elevation registered from the provider's sketch of it — the same ASSIGN_VIEW binder, checks and
 * refusals as a reviewer's (mirror gate, axis by the eaves), labelled SKETCH. The sketch's ground row is drawn behind what
 * stands in front of the house (pots, bins, furniture hide the drawn ground in the original, which is what fails the
 * analyzer's own vertical check), and its wall ends span the side the plan measures; the vertical is the horizontal scale
 * (isotropic drawing). The model's eaves must land on the sketch's eaves row or nothing is registered.
 */
export function registerFromSketch(ctx: Ctx, a: SketchAnchors): { view: BindView; why: string; /** the model's openings drawn through it, against the picture (z; null: none to test) */ support: number | null } | Refusal {
  const p: CorrectionProposal = { proposalId: `sketch-view:${a.frameId}`, baseRevision: modelRevision(ctx.model), operation: 'ASSIGN_VIEW', targetId: a.side, frameId: a.frameId, patch: { side: a.side, wallLeftX: a.wallLeftX, wallRightX: a.wallRightX, groundY: a.groundY, eavesY: a.eavesY }, origin: 'SKETCH', uncertainty: 'MEDIUM', justification: 'the sketch of this elevation: wall ends, ground row and eaves row' }
  const b = bindView(ctx, p)
  if (!('status' in b)) return { view: { ...b.view, origin: 'SKETCH' }, why: `${b.why}; model eaves on the sketch's eaves row (${String(b.record.bound?.values?.eavesRowModel)} vs ${String(b.record.bound?.values?.eavesRowDrawn)})`, support: b.record.gate?.proposedZ ?? null }
  // an overhang hides the top of the walls under its soffit and fascia: the drawn walls then stop below the model's eaves.
  // The ridge is hidden by nothing — the registration stands when the model's ridge lands on the drawn roof's top instead
  if (b.code !== 'AXIS_MISMATCH' || a.ridgeY === undefined) return b
  const ridgeM = sideRidgeM(ctx.model, a.side)
  if (ridgeM === undefined) return b
  const noEaves = bindView(ctx, { ...p, patch: { ...p.patch, eavesY: undefined } })
  if ('status' in noEaves) return noEaves
  const got = pyOf(noEaves.view.projection, ridgeM)
  const tol = Math.max(3, 0.05 * Math.abs(a.groundY - a.ridgeY))
  if (Math.abs(got - a.ridgeY) > tol) return { ...b, why: `${b.why}; nor does the model's ridge at ${ridgeM.toFixed(2)} m (row ${got.toFixed(0)}) land on the drawn roof's top (row ${a.ridgeY.toFixed(0)}, tolerance ${tol.toFixed(0)} px)` }
  return { support: noEaves.record.gate?.proposedZ ?? null, view: { ...noEaves.view, origin: 'SKETCH' }, why: `${noEaves.why}; the model's ridge on the drawn roof's top (row ${got.toFixed(0)} vs ${a.ridgeY.toFixed(0)}) — its eaves row was not (an overhang hides the walls' top): ${b.why}`.slice(0, 600) }
}

/** v3.54.17 R3: the top of the main pitched roof over `side` (its ridge, the slope's top surface), above ±0.00. */
export function sideRidgeM(m: CanonicalBuildingModel, side: Side): number | undefined {
  const r = sideRoof(m, side)
  if (!r) {
    // executor 1.8.0: a house roofed in planes alone (a hip): the planes' highest point is its ridge
    const ys = m.roofPlanes.flatMap((pl) => pl.boundary.map((v) => pl.datum.y - Math.tan((pl.pitchDeg * Math.PI) / 180) * ((v.x - pl.datum.x) * pl.downslope.x + (v.z - pl.datum.z) * pl.downslope.z)))
    return ys.length > 0 ? Math.max(...ys) : undefined
  }
  if (r.kind !== 'GABLE') return undefined
  const f = r.footprint
  const half = (r.ridgeAxis === 'Z' ? f.maxX - f.minX : f.maxZ - f.minZ) / 2
  return levelOf(m, r.levelId).elevation + r.eaveOffset + half * Math.tan((r.pitchDeg * Math.PI) / 180)
}

/** ASSIGN_VIEW: a registration of a source elevation for one side, checked against the side's walls before it is used. */
function bindView(ctx: Ctx, p: CorrectionProposal): { view: BindView; record: Pick<PatchRecord, 'bound' | 'source' | 'gate'>; why: string } | Refusal {
  const m = ctx.model
  const f = p.patch ?? {}
  const pic = pictureOf(ctx, p, f.picture)
  if (!pic || pic.projection !== 'ORTHOGRAPHIC_ELEVATION') return { status: 'INVALID', code: 'NOT_AN_ELEVATION', why: `picture ${String(f.picture)} is not a source orthographic elevation` }
  const side = f.side
  if (!side || typeof f.wallLeftX !== 'number' || typeof f.wallRightX !== 'number' || typeof f.groundY !== 'number' || !(f.wallRightX > f.wallLeftX)) return { status: 'INVALID', code: 'NO_ANCHORS', why: 'ASSIGN_VIEW states side, wallLeftX < wallRightX and groundY' }
  const range = sideRange(m, side)
  if (!range) return { status: 'INVALID', code: 'NO_SUCH_SIDE', why: `the model has no exterior wall on the ${side.toLowerCase()} side` }
  const left = toFrameX(pic, p, f.wallLeftX)
  const right = toFrameX(pic, p, f.wallRightX)
  const ground = toFrameY(pic, p, f.groundY)
  const mpp = (range.hi - range.lo) / (right - left)
  const natural: 1 | -1 = side === 'FRONT' || side === 'RIGHT' ? 1 : -1
  const sign = (f.mirrored ? -natural : natural) as 1 | -1
  const projection: Projection = { mpp: r6(mpp), alongSign: sign, alongAtPx0: r6(sign > 0 ? range.lo - mpp * left : range.hi + mpp * left), zeroRow: r6(ground) }
  // the axis: the drawn height of the walls at this scale against the model's — a wrong side has the wrong width
  const tops = exteriorWalls(m).filter((w) => sideOfWall(m, w) === side && !w.topProfile).map((w) => levelOf(m, w.levelId).elevation + w.baseOffset + w.height)
  const view: BindView = { side, frameId: pic.frameId, projection, heights: true, origin: 'ASSIGNED', alongErrorM: Math.max(0.03, 3 * mpp), heightErrorM: 0.3 }
  const record: Pick<PatchRecord, 'source'> & { bound: NonNullable<PatchRecord['bound']> } = { bound: { frameId: pic.frameId, side, ids: [pic.frameId], values: { mpp: r6(mpp), alongAtPx0: projection.alongAtPx0, zeroRow: projection.zeroRow } }, source: { frameId: pic.frameId, sourceByteHash: pic.sourceByteHash } }
  if (!(left >= -2 && right <= pic.raster.width + 2 && ground <= pic.raster.height + 2 && ground > 0)) return { status: 'INVALID', code: 'OUT_OF_PICTURE', why: 'the anchors lie outside the picture', record }
  const held = ctx.views.find((v) => v.frameId === pic.frameId)
  // the mirror and the side: the model's own openings on that side, drawn through this registration and through its mirror,
  // against the picture — the orientation the source supports better is the one that may be assigned
  // v3.54.18: a drawing is called mirrored only on evidence — the mirror must itself be SUPPORTED by the picture (mean
  // z ≥ 2 over the side's openings), not merely score a little less badly. The openings this test draws are the MODEL's,
  // and on a side LOCAL filled with phantoms both orientations score as noise (Medulin: −0.14 against 0.98, Alberto:
  // 0.67 against 1.80): a registration was then refused by the very errors the reading had come to correct.
  const probe = (pr: Projection): number | null => {
    const v2 = { ...view, projection: pr }
    const boxes = openingBoxes(m, v2).map((o) => o.box).filter((b) => b.x0 >= 0 && b.x1 <= pic.raster.width && b.y0 >= 0 && b.y1 <= pic.raster.height)
    if (boxes.length === 0) return null
    const zs = boxes.map((b) => supportOf(pic.raster, b, { x0: left, x1: right }, boxes, tolPxOf(v2)).z).filter((z): z is number => z !== null)
    return zs.length > 0 ? zs.reduce((a, z) => a + z, 0) / zs.length : null
  }
  const asDeclared = probe(projection)
  const flipped: Projection = { ...projection, alongSign: (-sign) as 1 | -1, alongAtPx0: r6(-sign > 0 ? range.lo - mpp * left : range.hi + mpp * left) }
  const asMirror = probe(flipped)
  const gate = { winner: (asDeclared === null || asMirror === null ? 'UNDECIDED' : asDeclared - asMirror >= 1 ? 'PROPOSED' : asMirror - asDeclared >= 1 && asMirror >= SUPPORT_Z_MIN ? 'CURRENT' : 'UNDECIDED') as HypothesisVerdict['winner'], proposedZ: asDeclared, currentZ: asMirror, nullBoxes: 0, why: asDeclared === null ? 'the model has no opening on that side to test the orientation with' : `the side's openings drawn through the declared orientation score z ${asDeclared?.toFixed(2)}, through its mirror z ${asMirror?.toFixed(2)}` }
  if (gate.winner === 'CURRENT') return { status: 'REJECTED_BY_SOURCE', code: 'MIRROR_CONTRADICTED', why: `the picture supports the other orientation: ${gate.why}`, record: { ...record, gate } }
  if (tops.length > 0 && view.heights) {
    const drawnTop = pyOf(projection, Math.max(...tops))
    if (drawnTop < 0) return { status: 'REJECTED_BY_SOURCE', code: 'AXIS_MISMATCH', why: `at the scale the ${side.toLowerCase()} side's ${(range.hi - range.lo).toFixed(2)} m gives this picture, its walls would rise above the picture: the drawing is not that side`, record: { ...record, gate } }
  }
  // the axis, measured: at the scale this side's walled length gives the picture, the model's eaves (the side walls'
  // storey top) must land on the eaves row the proposal names — a drawing of the other axis has the other length
  if (typeof f.eavesY === 'number') {
    const eavesM = sideEavesM(m, side, range)
    const want = toFrameY(pic, p, f.eavesY)
    const got = pyOf(projection, eavesM)
    const tol = Math.max(3, 0.05 * Math.abs(ground - want))
    record.bound.values = { ...record.bound.values, eavesRowModel: r6(got), eavesRowDrawn: r6(want) }
    if (Math.abs(got - want) > tol) return { status: 'REJECTED_BY_SOURCE', code: 'AXIS_MISMATCH', why: `at ${mpp.toFixed(5)} m/px (the ${side.toLowerCase()} side's ${(range.hi - range.lo).toFixed(2)} m across the drawn walls) the model's eaves at ${eavesM.toFixed(2)} m land on row ${got.toFixed(0)}, the drawing's on row ${want.toFixed(0)} (tolerance ${tol.toFixed(0)} px): the picture is not that side at that scale`, record: { ...record, gate } }
  }
  // v3.54.17 R3: the analyzer's registration outranks another side only when its own vertical check passed — one whose
  // ground missed the terrain datum (heights: false) is the registration that failed, not a contrary witness
  if (held && held.side !== side && held.origin === 'ANALYZER' && held.heights && gate.winner !== 'PROPOSED') return { status: 'NEEDS_EVIDENCE', code: 'VIEW_CONFLICT', why: `the analyzer registered picture ${pic.n} as the ${held.side.toLowerCase()} side; the source does not show the proposed side better (${gate.why})`, record: { ...record, gate } }
  return { view, record: { ...record, gate }, why: `picture ${pic.n} registered as the ${side.toLowerCase()} side at ${mpp.toFixed(5)} m/px${f.mirrored ? ', mirrored' : ''}; ${gate.why}` }
}

// ---------------------------------------------------------------------------------------------------------------
// the executor
// ---------------------------------------------------------------------------------------------------------------

export type ExecuteInput = {
  model: CanonicalBuildingModel
  views: readonly BindView[]
  pictures: readonly BindPicture[]
  proposals: readonly CorrectionProposal[]
  witnesses?: readonly PrintedWitness[]
  /** Proposal ids already given in this session (a repeated proposal is not applied twice). */
  seen?: Set<string>
  /** v3.54.17: the plan outline and the elevation silhouettes BUILD_MASSING reads. */
  massing?: MassingObservations
  /**
   * v3.54.17 R2: ids an element index listed for an earlier revision and that no longer exist (an opening rebuilt under
   * another id, a wall renamed by a migration), with the revision that last held them: a proposal naming one is refused
   * as STALE_TARGET, not as a made-up id.
   */
  retiredIds?: ReadonlyMap<string, string>
  /**
   * v3.54.17 R3: registrations that are a function of the model (the sketch's, checked by the model's eaves): derived again
   * on the working model before each transaction, so a roof committed earlier in the same run registers the views the
   * openings and stacks after it are placed through. `held` are the other registrations at that moment.
   */
  derivedViews?: (model: CanonicalBuildingModel, held: readonly BindView[]) => BindView[]
  /** v3.54.18: what each source picture's reading draws as openings (the gate's fallback band is that reading's plain wall). */
  claims?: FacadeClaims
  /** v3.54.18 R2: plan gaps of a LOCAL body that was replaced — a second drawing's witness for an added opening. */
  planGaps?: readonly PlanGap[]
  /** v3.54.18: the frames whose reading the run adopted as a whole facade (supported on most openings, refuted on none). */
  adopted?: ReadonlySet<string>
  /** v3.54.17 R3: the run's registered plan sheets (SET_OUTLINE from a printed dimension). */
  plans?: readonly BindPlan[]
  /** v3.54.17 R3: facts of the project page (SET_ROOF reads the stated pitch). */
  facts?: PageFacts
  /** v3.54.19: the plan skeleton in the model's frame — what BUILD_INTERIOR builds from. */
  interior?: InteriorObservation
}

/** v3.54.17 R2: the operations whose targetId must name an element of the model (the element index's ids). */
const LISTED_TARGET_OPS = new Set(['UPDATE_OPENING', 'REMOVE_OPENING', 'UPDATE_CHIMNEY', 'SET_PARAMETER', 'SET_ROOF', 'SET_OUTLINE', 'SET_ROOF_OVERHANG'])
/** Any element of the model by its id (collections the operations edit, and the wall rings a body is named by). */
export function elementExists(m: CanonicalBuildingModel, id: string): boolean {
  const colls = [m.levels, m.walls, m.wallRings, m.openings, m.roofs, m.roofPlanes, m.chimneys] as ReadonlyArray<ReadonlyArray<{ id: string }>>
  return colls.some((c) => c.some((x) => x.id === id))
}

/** Compile diagnostics that mean "this opening was not cut": the model holds it, every viewer shows a solid wall. */
const UNCUT_CODES: ReadonlySet<string> = new Set(['OPENING_ABOVE_WALL_TOP', 'OPENING_OPEN_END_UNSUPPORTED'])

const closureErrors = (model: CanonicalBuildingModel): { n: number; scene?: ReturnType<typeof compileBuilding>; failed?: string; named?: string[]; uncut?: string[] } => {
  try {
    const scene = compileBuilding(model)
    const c = geometryClosureAudit(model, scene)
    const errs = c.findings.filter((x) => x.scope === 'EXTERIOR' && x.severity === 'ERROR')
    // v3.54.18 (executor 1.6.0): an opening the compiler refuses to cut stands in the model and in no viewer
    const uncut = scene.diagnostics.filter((d) => d.severity === 'ERROR' && UNCUT_CODES.has(d.code) && d.objectId).map((d) => d.objectId as string)
    return { n: errs.length, scene, named: errs.map((x) => { return `${x.code} ${x.objects.join('+')}` }), uncut }
  } catch (e) {
    return { n: Number.POSITIVE_INFINITY, failed: (e as Error).message.slice(0, 200) }
  }
}

export function executeCorrections(input: ExecuteInput): CorrectionOutcome {
  const seen = input.seen ?? new Set<string>()
  const baseRevision = modelRevision(input.model)
  let model = input.model
  let views: BindView[] = [...input.views]
  const records: PatchRecord[] = []
  const transactions: TransactionRecord[] = []
  const rec = (p: CorrectionProposal, status: PatchStatus, code: string | undefined, why: string, extra: Partial<PatchRecord> = {}): PatchRecord => {
    const r: PatchRecord = { proposalId: p.proposalId, ...(p.defectId ? { defectId: p.defectId } : {}), ...(p.group ? { group: p.group } : {}), operation: p.operation, targetId: p.targetId, origin: p.origin, status, ...(code ? { code } : {}), why, ...extra }
    records.push(r)
    return r
  }
  // 1. validation that needs no model: the registry, the revision, repeats, uncertainty
  const admitted: CorrectionProposal[] = []
  for (const p of input.proposals) {
    if (seen.has(p.proposalId)) {
      rec(p, 'DUPLICATE', 'DUPLICATE_PROPOSAL_ID', 'this proposal id was already given: a repeated proposal is not applied twice')
      continue
    }
    seen.add(p.proposalId)
    // v3.54.19: BUILD_INTERIOR is the analyzer's own operation (origin PLAN): never offered to a reviewer, so not in the registry
    if (!isPatchOperation(p.operation) && !((p.operation === 'BUILD_INTERIOR' || p.operation === 'ADD_PLAN_OPENING') && p.origin === 'PLAN')) {
      rec(p, 'UNSUPPORTED_OPERATION', 'NOT_IN_REGISTRY', `${p.operation} is not an operation of registry ${CORRECTION_REGISTRY_VERSION}: the analyzer cannot execute it; the defect stays open and named`)
      continue
    }
    if (p.operation === 'ROOF_FEATURE') {
      rec(p, 'DEFERRED_ROOF_FEATURE', undefined, `handed to ${CAPABILITIES.ROOF_FEATURE.consumer}`)
      continue
    }
    if (p.baseRevision !== baseRevision) {
      rec(p, 'STALE_REVISION', 'STALE_REVISION', `names revision ${p.baseRevision}; the model is at ${baseRevision}: a proposal about another revision is never applied silently`)
      continue
    }
    if (p.uncertainty === 'HIGH') {
      rec(p, 'HELD', 'HIGH_UNCERTAINTY', 'HIGH uncertainty: kept as a hypothesis, not applied')
      continue
    }
    // v3.54.17 R2: a listed operation names an element of THIS revision; one that is gone is stale, one never listed is unknown
    if (LISTED_TARGET_OPS.has(p.operation) && !elementExists(input.model, p.targetId)) {
      const was = input.retiredIds?.get(p.targetId)
      if (was) rec(p, 'INVALID', 'STALE_TARGET', `${p.targetId} was an element of revision ${was}; revision ${baseRevision} no longer has it (rebuilt or renamed): name an element of this revision's index`)
      else rec(p, 'INVALID', 'UNKNOWN_TARGET', `${p.targetId} is not an element of revision ${baseRevision}: a targetId names an id of the element index, never a made-up one`)
      continue
    }
    admitted.push(p)
  }
  // 2. transactions: each proposal alone, or every proposal of one group together (a view first, then what it places)
  const txs = new Map<string, CorrectionProposal[]>()
  for (const p of admitted) {
    const key = p.group ? `group:${p.group}` : `alone:${p.proposalId}`
    txs.set(key, [...(txs.get(key) ?? []), p])
  }
  let n = 0
  for (const [key, members] of txs) {
    n += 1
    const txId = `tx${n}`
    const ordered = [...members].sort((a, b) => Number(b.operation === 'ASSIGN_VIEW') - Number(a.operation === 'ASSIGN_VIEW'))
    const before = closureErrors(model)
    const digestsBefore = objectDigests(model)
    let working = model
    const heldNow = input.derivedViews ? views.filter((v) => v.origin !== 'SKETCH') : views
    let workingViews = input.derivedViews ? [...heldNow, ...input.derivedViews(model, heldNow)] : views
    const pending: Array<{ p: CorrectionProposal; bound?: Bound; view?: BindView; extra: Partial<PatchRecord> }> = []
    let refusal: { p: CorrectionProposal; r: Refusal } | undefined
    for (const p of ordered) {
      const ctx: Ctx = { model: working, views: workingViews, pictures: input.pictures, witnesses: input.witnesses ?? [], ...(input.planGaps ? { planGaps: input.planGaps } : {}), ...(input.massing ? { massing: input.massing } : {}), ...(input.interior ? { interior: input.interior } : {}), ...(input.plans ? { plans: input.plans } : {}), ...(input.facts ? { facts: input.facts } : {}), ...(input.claims ? { claims: input.claims } : {}), ...(input.adopted ? { adopted: input.adopted } : {}) }
      if (p.operation === 'ASSIGN_VIEW') {
        const b = bindView(ctx, p)
        if ('status' in b) {
          refusal = { p, r: b }
          break
        }
        workingViews = [...workingViews.filter((v) => v.frameId !== b.view.frameId || v.origin !== 'ASSIGNED'), b.view]
        pending.push({ p, view: b.view, extra: { ...b.record, txId } })
        continue
      }
      const op = p.operation as PatchOperation
      const b = (p.operation as string) === 'BUILD_INTERIOR' ? bindBuildInterior(ctx, p) : (p.operation as string) === 'ADD_PLAN_OPENING' ? bindPlanOpening(ctx, p) : op === 'SET_FINISH' ? bindFinish(ctx, p) : op === 'SET_PARAMETER' ? bindParameter(ctx, p) : op === 'ADD_CHIMNEY' || op === 'UPDATE_CHIMNEY' ? bindChimney(ctx, p) : op === 'BUILD_MASSING' ? bindBuildMassing(ctx, p) : op === 'SET_ROOF' ? bindSetRoof(ctx, p) : op === 'SET_OUTLINE' ? bindSetOutline(ctx, p) : op === 'SET_ROOF_OVERHANG' ? bindOverhang(ctx, p) : op === 'ADD_ROOF_WINDOW' ? bindRoofWindow(ctx, p) : bindOpening(ctx, p)
      if ('status' in b) {
        refusal = { p, r: b }
        break
      }
      // apply on the working copy now, so a later member of the group binds against it
      if (b.appearance) {
        try {
          working = applyAppearance(working, [b.appearance.obs], () => b.appearance?.projection).model
        } catch (e) {
          refusal = { p, r: { status: 'ROLLED_BACK', code: 'CONSUMER_FAILED', why: (e as Error).message.slice(0, 300), record: b.record } }
          break
        }
      }
      if (b.commands.length > 0) {
        const res = applyCommands(working, b.commands)
        if (res.failedAt !== undefined) {
          const fail = res.results[res.failedAt] as { errors?: Array<{ code: string; message: string }> }
          refusal = { p, r: { status: 'ROLLED_BACK', code: 'COMMAND_REFUSED', why: `the model refused ${b.commands[res.failedAt].type}: ${(fail.errors ?? []).map((e) => `[${e.code}] ${e.message}`).join('; ').slice(0, 300)}`, record: b.record } }
          break
        }
        working = res.model
      }
      if (b.transform) {
        const v = validateModel(b.transform(working))
        if (!v.ok || !v.model) {
          refusal = { p, r: { status: 'ROLLED_BACK', code: 'COMMAND_REFUSED', why: `the model refused the edit: ${v.issues.filter((i) => i.severity === 'ERROR').map((i) => `[${i.code}] ${i.message}`).join('; ').slice(0, 300)}`, record: b.record } }
          break
        }
        working = v.model
      }
      if (b.views) workingViews = [...workingViews.filter((v) => !b.views?.some((q) => q.frameId === v.frameId)), ...b.views]
      pending.push({ p, bound: b, extra: { ...b.record, commands: b.commands, txId } })
    }
    const tx: TransactionRecord = { txId, patches: members.map((m) => m.proposalId), ...(key.startsWith('group:') ? { group: key.slice(6) } : {}), decision: 'REFUSED', why: '', changed: [], allowed: [], collateral: [], closureBefore: before.n, revisionBefore: modelRevision(model) }
    transactions.push(tx)
    if (refusal) {
      rec(refusal.p, refusal.r.status, refusal.r.code, refusal.r.why, { ...(refusal.r.record ?? {}), txId })
      for (const q of members.filter((x) => x !== refusal?.p)) rec(q, 'GROUP_ROLLED_BACK', 'GROUP_MEMBER_REFUSED', `its group ${q.group ?? ''} stands or falls together, and ${refusal.p.proposalId} was refused (${refusal.r.code})`, { txId })
      tx.why = `${refusal.p.proposalId}: ${refusal.r.code} — ${refusal.r.why}`.slice(0, 400)
      continue
    }
    // 3. compile and measure: the transaction's own effect, and nothing outside its dependency set
    const after = closureErrors(working)
    const digestsAfter = objectDigests(working)
    const changed = changedKeys(digestsBefore, digestsAfter)
    const allowed = pending.flatMap((x) => x.bound?.allowed ?? [])
    const ok = (k: string): boolean => allowed.includes(k) || allowed.some((a) => a.endsWith('*') && k.startsWith(a.slice(0, -1)))
    const collateral = changed.filter((k) => !ok(k))
    tx.changed = changed
    tx.allowed = allowed
    tx.collateral = collateral
    tx.closureAfter = after.n
    const measures = new Map<string, PatchRecord['measure']>()
    let failure: string | undefined
    if (after.failed) failure = `the candidate does not compile: ${after.failed}`
    else if (after.n > before.n) failure = `the candidate has ${after.n - before.n} more exterior joint error(s) than the model before: ${(after.named ?? []).filter((x) => !(before.named ?? []).includes(x)).slice(0, 4).join('; ')}`
    else if ((after.uncut ?? []).some((id) => !(before.uncut ?? []).includes(id))) failure = `OPENING_NOT_CUT: the candidate leaves ${(after.uncut ?? []).filter((id) => !(before.uncut ?? []).includes(id)).slice(0, 6).join(', ')} uncut by the compiler (above the top of its wall, or run through a skewed end): an opening no viewer shows is not a correction`
    else if (collateral.length > 0) failure = `the transaction changed ${collateral.slice(0, 6).join(', ')}, which it is not about`
    for (const x of pending) {
      if (failure || !x.bound) continue
      const e = x.bound.expect
      if (e.kind === 'OPENING') {
        const o = working.openings.find((q) => q.id === e.id)
        const s = o ? openingSpan(working, o) : undefined
        const builtShape = o ? shapeOfOpening(working, o, e.view) : undefined
        const built = s ? boxOfSpan(e.view, s) : undefined
        const pic = input.pictures.find((q) => q.frameId === e.view.frameId)
        const ov = built ? iou(built, e.box) : 0
        const others = openingBoxes(working, e.view).filter((q) => q.id !== e.id).map((q) => q.box)
        // A2: the built SHAPE (head ends) back in the source, and the built KIND — not the bounding box alone
        const claimedHere = input.claims?.get(e.view.frameId)
        const sup = builtShape && pic ? supportOf(pic.raster, builtShape, facadePx(working, e.view), [builtShape, ...others], tolPxOf(e.view), undefined, claimedHere ? [builtShape, ...claimedHere] : undefined) : undefined
        const builtKind = o ? kindOfOpening(working, o.id) : undefined
        const fillOk = e.fillChangeFrom && builtShape && pic ? compareFill(pic.raster, builtShape, e.openingKind, e.fillChangeFrom).winner === 'PROPOSED' : true
        const hErr = builtShape ? headError(builtShape, e.shape) : Infinity
        const hTol = Math.max(3, 0.05 * (e.box.y1 - e.box.y0))
        const verified = e.adopted ? false : sup ? (sup.supported === null ? null : sup.supported && fillOk) : null
        measures.set(x.p.proposalId, { ...(built ? { builtBox: built } : {}), iouWithProposal: Math.round(ov * 1000) / 1000, builtSupportZ: sup?.z ?? null, ...(Number.isFinite(hErr) ? { headErrorPx: Math.round(hErr * 10) / 10 } : {}), ...(builtKind ? { builtKind } : {}), sourceVerified: verified, why: built ? `built ${e.id} (${builtKind ?? '?'}) on ${s?.wall.id} drawn back into the source: overlap ${ov.toFixed(2)} with the proposal${isRaked(e.shape) ? `, head ends within ${Number.isFinite(hErr) ? hErr.toFixed(1) : '∞'} px` : ''}, support z ${sup?.z ?? '—'}${e.fillChangeFrom ? `; fill ${fillOk ? 'shows' : 'does not show'} a ${e.openingKind}` : ''}` : `${e.id} is not in the candidate` })
        if (!built || ov < 0.85) failure = `${e.id} was not built where the proposal binds it (overlap ${ov.toFixed(2)})`
        else if (s && s.wall.levelId !== e.levelId) failure = `${e.id} was built on another storey`
        else if (isRaked(e.shape) && !(hErr <= hTol)) failure = `${e.id}'s head was not built as proposed (its ends are ${Number.isFinite(hErr) ? hErr.toFixed(1) : 'not'} px off, tolerance ${hTol.toFixed(1)})`
        else if (builtKind !== e.openingKind) failure = `${e.id} was built as ${builtKind ?? 'nothing'}, not ${e.openingKind}`
      } else if (e.kind === 'REMOVED') {
        if (working.openings.some((q) => q.id === e.id)) failure = `${e.id} is still in the candidate`
        measures.set(x.p.proposalId, { sourceVerified: e.adopted ? false : true, why: `${e.id} and its fill removed${e.adopted ? ' (the adopted reading of the facade; the picture alone did not decide it)' : ''}` })
      } else if (e.kind === 'CHIMNEY') {
        const c = working.chimneys.find((q) => q.id === e.id)
        const ax = alongAxis(e.view.side)
        const built = c ? boxOfSpan(e.view, { a0: ax === 'x' ? c.footprint.minX : c.footprint.minZ, a1: ax === 'x' ? c.footprint.maxX : c.footprint.maxZ, y0: yOf(e.view.projection, e.box.y1), y1: levelOf(working, c.levelId).elevation + c.baseOffset + c.height }) : undefined
        const ov = built ? iou(built, e.box) : 0
        const pic = input.pictures.find((q) => q.frameId === e.view.frameId)
        const sup = built && pic ? supportOf(pic.raster, built, { x0: Math.min(built.x0, facadePx(working, e.view).x0), x1: Math.max(built.x1, facadePx(working, e.view).x1) }, [built, ...openingBoxes(working, e.view).map((q) => q.box)], tolPxOf(e.view)) : undefined
        measures.set(x.p.proposalId, { ...(built ? { builtBox: built } : {}), iouWithProposal: Math.round(ov * 1000) / 1000, builtSupportZ: sup?.z ?? null, sourceVerified: sup ? sup.supported : null, why: built ? `built ${e.id} drawn back into the source: overlap ${ov.toFixed(2)}, support z ${sup?.z ?? '—'}` : `${e.id} is not in the candidate` })
        if (!built || ov < 0.85) failure = `${e.id} was not built where the proposal binds it (overlap ${ov.toFixed(2)})`
      } else if (e.kind === 'FINISH') {
        const same = usableGeometryFingerprint(working) === usableGeometryFingerprint(model)
        const added = working.surfaceRegions.filter((r) => !model.surfaceRegions.some((q) => q.id === r.id)).length
        measures.set(x.p.proposalId, { sourceVerified: null, why: `${added} region(s) added; usable geometry ${same ? 'unchanged' : 'CHANGED'}; the finish class, its boundary and its surface are not measured in the picture (a reviewer's agreement closes it only as CLOSED_REVIEW_ONLY)` })
        if (!same) failure = 'a finish changed the usable geometry'
        else if (added === 0 && stableJson(working.surfaceRegions, 0) === stableJson(model.surfaceRegions, 0)) failure = 'NO_EFFECT: the finish consumer added no region (the area falls on no wall face the side shows)'
      } else if (e.kind === 'CUSTOM') {
        const r = e.measure(working, model, input.pictures)
        measures.set(x.p.proposalId, r.measure)
        if (r.failure) failure = r.failure
      } else if (e.kind === 'PARAM') {
        const hit = Object.values(working as unknown as Record<string, unknown>).flatMap((v) => (Array.isArray(v) ? (v as Array<Record<string, unknown>>) : [])).find((o) => o.id === e.targetId)
        const got = hit?.[e.property]
        measures.set(x.p.proposalId, { sourceVerified: true, why: `${e.targetId}.${e.property} = ${String(got)} (printed value witnessed)` })
        if (typeof got !== 'number' || Math.abs(got - e.value) > 1e-6) failure = `${e.targetId}.${e.property} is ${String(got)}, not ${e.value}`
      }
    }
    if (failure) {
      const noEffect = failure.startsWith('NO_EFFECT')
      tx.decision = 'ROLLED_BACK'
      tx.why = failure
      for (const x of pending) rec(x.p, noEffect ? 'NO_EFFECT' : 'ROLLED_BACK', noEffect ? 'NO_EFFECT' : 'MEASURE_FAILED', failure, { ...x.extra, ...(measures.get(x.p.proposalId) ? { measure: measures.get(x.p.proposalId) } : {}) })
      continue
    }
    tx.decision = 'COMMITTED'
    model = working
    views = workingViews
    tx.revisionAfter = modelRevision(model)
    tx.why = `${pending.length} patch(es) applied; ${changed.length} object(s) changed, all inside the transaction's dependency set; exterior joint errors ${before.n} → ${after.n}`
    for (const x of pending) rec(x.p, 'COMMITTED', undefined, x.view ? 'registration assigned' : 'applied, compiled and measured', { ...x.extra, ...(measures.get(x.p.proposalId) ? { measure: measures.get(x.p.proposalId) } : {}) })
  }
  return { registry: CORRECTION_REGISTRY_VERSION, executor: CORRECTION_EXECUTOR_VERSION, gate: SOURCE_GATE_VERSION, baseRevision, revision: modelRevision(model), model, records, transactions, views }
}

/** The analyzer's own registrations of a run, as the binder reads them. */
export function viewsOfRun(views: ReadonlyArray<{ facade: string; frameId: string; registration?: string; heights: boolean; alongErrorM: number; heightErrorM: number; projection: { mpp: number; alongAtPx0: number; alongSign: 1 | -1; zeroRow: number } }>): BindView[] {
  return views.flatMap((v) => {
    const side = sideOfFacade(v.facade)
    // SILHOUETTE: one scale with the apex on the ridge datum (frame.ts) — the roof's heights hold where the ground's were refused
    return side ? [{ side, frameId: v.frameId, projection: { ...v.projection }, heights: v.heights, ...(v.registration === 'SILHOUETTE' ? { roofAnchored: true } : {}), origin: 'ANALYZER' as const, alongErrorM: v.alongErrorM, heightErrorM: v.heightErrorM }] : []
  })
}

/** v3.54.17 R3: the projection helpers the chimney fusion of two perpendicular sketches reads through (`chimney-fusion.ts`). */
export { alongAxis, alongOf, outward, yOf }
