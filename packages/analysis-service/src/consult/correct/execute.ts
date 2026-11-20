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
 */
import { applyCommands } from '@buildapp/commands'
import type { BuildingCommand } from '@buildapp/commands'
import { compileBuilding, geometryClosureAudit } from '@buildapp/geometry'
import { serializeModel } from '@buildapp/model'
import type { CanonicalBuildingModel, Opening, Wall } from '@buildapp/model'
import { sha256Hex, stableJson } from '@buildapp/source-common'
import type { Raster } from '@buildapp/source-package'
import { applyAppearance, usableGeometryFingerprint } from '../../appearance/consumer.js'
import { APPEARANCE_OBSERVATION_SCHEMA, APPEARANCE_OBSERVATION_VERSION } from '../../appearance/contract.js'
import type { AppearanceObservation } from '../../appearance/contract.js'
import { CAPABILITIES, CORRECTION_REGISTRY_VERSION, isPatchOperation } from './registry.js'
import type { PatchFields, PatchOperation } from './registry.js'
import { compareFill, compareHypotheses, iou, isRaked, supportOf, SOURCE_GATE_VERSION } from './source-gate.js'
import type { Box, FillVerdict, HypothesisVerdict, Shape } from './source-gate.js'
import { resolveWitness, WITNESS_RESOLVER_VERSION } from './resolve.js'

export const CORRECTION_EXECUTOR_VERSION = '1.2.0' as const

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
  origin: 'ANALYZER' | 'ASSIGNED'
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
  origin: 'REVIEW' | 'SKETCH' | 'CONTROL'
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
  bound?: { frameId: string; side?: Side; box?: Box; hostId?: string; ids: string[]; depth?: 'SECOND_VIEW' | 'ROOF_MEET_LINE' | 'DISPLAY_ASSUMPTION'; values?: Record<string, number> }
  source?: { frameId: string; sourceByteHash: string; crop?: Box }
  gate?: { winner: HypothesisVerdict['winner']; proposedZ: number | null; currentZ?: number | null; nullBoxes: number; why: string; /** 1.1.0: BOX, POLYGON (a raked head on either side) or FILL (a change of kind on the same shape). */ measure?: 'BOX' | 'POLYGON' | 'FILL'; fill?: Pick<FillVerdict, 'observed' | 'features'> }
  measure?: { builtBox?: Box; iouWithProposal?: number; builtSupportZ?: number | null; headErrorPx?: number; builtKind?: string; sourceVerified: boolean | null; why: string }
  commands?: BuildingCommand[]
  /** v3.54.17: how a printed witness was bound to the target (its observation, the body both stand on, the datum). */
  witness?: WitnessResolution
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
const levelOf = (m: CanonicalBuildingModel, id: string): { elevation: number; height: number } => m.levels.find((l) => l.id === id) ?? { elevation: 0, height: 3 }

const pxOf = (p: Projection, along: number): number => (along - p.alongAtPx0) / (p.alongSign * p.mpp)
const alongOf = (p: Projection, px: number): number => p.alongAtPx0 + p.alongSign * p.mpp * px
const yOf = (p: Projection, py: number): number => (p.zeroRow - py) * (p.mppV ?? p.mpp)
const pyOf = (p: Projection, y: number): number => p.zeroRow - y / (p.mppV ?? p.mpp)
const tolPxOf = (v: BindView): number => Math.max(2, Math.min(8, Math.ceil(Math.max(v.alongErrorM, 0.03) / v.projection.mpp)))

/** Where along its side an opening of the model is, and how high. */
function openingSpan(m: CanonicalBuildingModel, o: Opening): { side: Side; a0: number; a1: number; y0: number; y1: number; wall: Wall } | undefined {
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
const facadePx = (m: CanonicalBuildingModel, v: BindView): { x0: number; x1: number; y0?: number; y1?: number } => {
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

type Expect =
  | { kind: 'OPENING'; id: string; view: BindView; box: Box; shape: Shape; levelId: string; openingKind: OpeningPatchKindExact; fillChangeFrom?: OpeningPatchKindExact }
  | { kind: 'REMOVED'; id: string }
  | { kind: 'CHIMNEY'; id: string; view: BindView; box: Box }
  | { kind: 'FINISH'; hosts: string[] }
  | { kind: 'PARAM'; targetId: string; property: string; value: number }
  | { kind: 'VIEW'; view: BindView }

type Bound = { commands: BuildingCommand[]; appearance?: { obs: AppearanceObservation; projection: Projection }; allowed: string[]; expect: Expect; record: Pick<PatchRecord, 'bound' | 'source' | 'gate' | 'witness'> }
type Refusal = { status: PatchStatus; code: string; why: string; record?: Pick<PatchRecord, 'bound' | 'source' | 'gate'> }

type Ctx = { model: CanonicalBuildingModel; views: BindView[]; pictures: readonly BindPicture[]; witnesses: readonly PrintedWitness[] }

const short = (s: string): string => sha256Hex(s).slice(0, 6)

function pictureOf(ctx: Ctx, p: CorrectionProposal, n: number | undefined): BindPicture | undefined {
  if (p.frameId) return ctx.pictures.find((x) => x.frameId === p.frameId)
  return n === undefined ? undefined : ctx.pictures.find((x) => x.n === n)
}
const toFrame = (pic: BindPicture, p: CorrectionProposal, b: Box): Box => (p.frameId ? b : { x0: pic.transform.x0 + b.x0 / pic.transform.scale, y0: pic.transform.y0 + b.y0 / pic.transform.scale, x1: pic.transform.x0 + b.x1 / pic.transform.scale, y1: pic.transform.y0 + b.y1 / pic.transform.scale })
const toFrameY = (pic: BindPicture, p: CorrectionProposal, y: number): number => (p.frameId ? y : pic.transform.y0 + y / pic.transform.scale)
const toFrameX = (pic: BindPicture, p: CorrectionProposal, x: number): number => (p.frameId ? x : pic.transform.x0 + x / pic.transform.scale)
const finiteBox = (b: Box | undefined): b is Box => !!b && [b.x0, b.y0, b.x1, b.y1].every((v) => typeof v === 'number' && Number.isFinite(v)) && b.x1 > b.x0 && b.y1 > b.y0
const inPicture = (pic: BindPicture, b: Box): boolean => b.x0 >= -2 && b.y0 >= -2 && b.x1 <= pic.raster.width + 2 && b.y1 <= pic.raster.height + 2

function viewOf(ctx: Ctx, pic: BindPicture): BindView | undefined {
  return ctx.views.find((v) => v.frameId === pic.frameId && v.origin === 'ASSIGNED') ?? ctx.views.find((v) => v.frameId === pic.frameId)
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
  if (kind === 'WINDOW') {
    const like = m.windows.find((w) => w.frameDepth <= hostT) ?? m.windows[0]
    return [{ type: 'placeWindow', id: fillId, openingId: id, ...(like ? { frameWidth: like.frameWidth, frameDepth: Math.min(like.frameDepth, hostT * 0.9), frameInset: Math.min(like.frameInset, Math.max(0, hostT - like.frameDepth)), glassThickness: like.glassThickness, ...(like.materialId ? { materialId: like.materialId } : {}) } : {}) }]
  }
  const like = m.doors.find((d) => d.frameDepth <= hostT) ?? m.doors[0]
  const frame = like ? { frameWidth: like.frameWidth, frameDepth: Math.min(like.frameDepth, hostT * 0.9), frameInset: Math.min(like.frameInset, Math.max(0, hostT - like.frameDepth)), leafThickness: like.leafThickness } : {}
  const glass = m.windows.find((w) => w.materialId)?.materialId
  if (kind === 'GARAGE_DOOR') return [{ type: 'placeDoor', id: fillId, openingId: id, ...frame, assembly: { panels: [{ kind: 'PANEL', fraction: 1 }], mullionWidth: 0.04 }, usage: 'GARAGE', ...(like?.materialId ? { materialId: like.materialId } : {}) }]
  if (kind === 'GLAZED_DOOR') return [{ type: 'placeDoor', id: fillId, openingId: id, ...frame, assembly: { panels: [{ kind: 'LEAF', fraction: 1, hinge: 'LEFT', glazing: 'FULL' }], mullionWidth: 0.04 }, ...(glass ? { materialId: glass } : like?.materialId ? { materialId: like.materialId } : {}) }]
  return [{ type: 'placeDoor', id: fillId, openingId: id, ...frame, ...(like?.materialId ? { materialId: like.materialId } : {}) }]
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
    const s = supportOf(src.raster, box, facadePx(m, view), [box, ...others], tolPxOf(view))
    const gate = { winner: (s.z === null ? 'UNDECIDED' : s.z < 1 ? 'PROPOSED' : s.supported ? 'CURRENT' : 'UNDECIDED') as HypothesisVerdict['winner'], proposedZ: null, currentZ: s.z, nullBoxes: s.null.n, why: s.z === null ? 'too few free places on the band to judge' : s.z < 1 ? `the source draws nothing distinct where ${target.id} stands (z ${s.z} < 1)` : s.supported ? `the source draws an opening where ${target.id} stands (z ${s.z}): it is not removed` : `the source is not clear at ${target.id} (z ${s.z})` }
    const record = { bound: { frameId: view.frameId, side: view.side, box, hostId: target.wallId, ids: [target.id] }, source: { frameId: src.frameId, sourceByteHash: src.sourceByteHash, crop: box }, gate }
    if (gate.winner === 'CURRENT') return { status: 'REJECTED_BY_SOURCE', code: 'SOURCE_SHOWS_OPENING', why: gate.why, record }
    if (gate.winner === 'UNDECIDED') return { status: 'NEEDS_EVIDENCE', code: 'SOURCE_UNDECIDED', why: gate.why, record }
    const fills = [...m.windows.filter((w) => w.openingId === target.id).map((w) => `windows:${w.id}`), ...m.doors.filter((d) => d.openingId === target.id).map((d) => `doors:${d.id}`)]
    return { commands: [{ type: 'removeFeature', targetId: target.id, cascade: true }], allowed: [`openings:${target.id}`, ...fills], expect: { kind: 'REMOVED', id: target.id }, record }
  }
  if (!finiteBox(f.box)) return { status: 'INVALID', code: 'NO_BOX', why: `${p.operation} states the opening's box in a source picture (x0 < x1, y0 < y1); this one does not` }
  const currentKind = existing ? kindOfOpening(m, existing.id) : undefined
  const kind = f.kind ?? currentKind
  if (!kind) return { status: 'INVALID', code: 'NO_KIND', why: 'ADD_OPENING names the kind (WINDOW, DOOR, GLAZED_DOOR, GARAGE_DOOR)' }
  const at = elevationOf(ctx, p, f.picture, 'HEIGHTS')
  if ('status' in at) return at
  const { pic, view } = at
  const box = toFrame(pic, p, f.box)
  if (!inPicture(pic, box)) return { status: 'INVALID', code: 'OUT_OF_PICTURE', why: `the box lies outside picture ${pic.n}` }
  if (existing && ofExisting && ofExisting.side !== view.side) return { status: 'NEEDS_EVIDENCE', code: 'OTHER_SIDE', why: `${existing.id} is on the ${ofExisting.side.toLowerCase()} side; picture ${pic.n} is registered as the ${view.side.toLowerCase()} side: moving an opening to another side is not an update` }
  const pr = view.projection
  const xs = [alongOf(pr, box.x0), alongOf(pr, box.x1)]
  const a0 = r6(Math.min(...xs))
  const a1 = r6(Math.max(...xs))
  const y0 = r6(yOf(pr, box.y1))
  const y1 = r6(yOf(pr, box.y0))
  if (!(a1 - a0 >= 0.2) || !(y1 - y0 >= 0.25)) return { status: 'INVALID', code: 'TOO_SMALL', why: `the box is ${(a1 - a0).toFixed(2)} × ${(y1 - y0).toFixed(2)} m at the registration: not an opening` }
  const host = hostWall(m, view.side, a0, a1, y0, y1)
  if (!host) return { status: 'INVALID', code: 'NO_HOST_WALL', why: `no exterior wall of the ${view.side.toLowerCase()} side holds ${a0.toFixed(2)}..${a1.toFixed(2)} m along it from ${y0.toFixed(2)} to ${y1.toFixed(2)} m` }
  // the source gate: the proposal and the model's element (for an update) against the original picture
  const others = openingBoxes(m, view).filter((o) => o.id !== existing?.id)
  const duplicate = others.find((o) => iou(o.box, box) > 0.3)
  if (duplicate) return { status: 'DUPLICATE', code: 'OPENING_ALREADY_THERE', why: `${duplicate.id} already stands there (overlap ${iou(duplicate.box, box).toFixed(2)}): an opening is updated, never doubled` }
  // A2: both hypotheses as full shapes (a raked head's two ends), and the kinds as their own measure
  const proposedShape: Shape = typeof f.headLeftY === 'number' && typeof f.headRightY === 'number' ? { ...box, headLeftY: toFrameY(pic, p, f.headLeftY), headRightY: toFrameY(pic, p, f.headRightY), y0: Math.min(box.y0, toFrameY(pic, p, f.headLeftY), toFrameY(pic, p, f.headRightY)) } : box
  const currentShape = existing ? shapeOfOpening(m, existing, view) : undefined
  let g: HypothesisVerdict
  let fillFrom: OpeningPatchKindExact | undefined
  let fillRecord: Pick<FillVerdict, 'observed' | 'features'> | undefined
  if (existing && currentShape && sameShape(proposedShape, currentShape)) {
    if (currentKind === kind || !currentKind) return { status: 'NO_EFFECT', code: 'ALREADY_AS_PROPOSED', why: `${existing.id} already stands with this shape and kind (${kind}) on picture ${pic.n}`, record: { bound: { frameId: view.frameId, side: view.side, box, ids: [existing.id] }, source: { frameId: pic.frameId, sourceByteHash: pic.sourceByteHash, crop: box } } }
    // the same shape, another kind: the position test cannot decide it — the fill of the opening does, or nothing does
    const fv = compareFill(pic.raster, proposedShape, kind as OpeningPatchKindExact, currentKind)
    fillFrom = currentKind
    fillRecord = { observed: fv.observed, features: fv.features }
    const sup = supportOf(pic.raster, proposedShape, facadePx(m, view), [proposedShape, ...others.map((o) => o.box)], tolPxOf(view))
    g = { winner: fv.winner, proposed: sup, why: fv.why }
  } else g = compareHypotheses(pic.raster, proposedShape, currentShape, facadePx(m, view), others.map((o) => o.box), tolPxOf(view))
  const gate = { winner: g.winner, proposedZ: g.proposed.z, ...(g.current ? { currentZ: g.current.z } : {}), nullBoxes: g.proposed.null.n, why: g.why, measure: fillRecord ? ('FILL' as const) : (g.measure ?? 'BOX'), ...(fillRecord ? { fill: fillRecord } : {}) }
  const id = existing?.id ?? `op-fix-${view.side.toLowerCase()}-${short(p.proposalId)}`
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
  const record = { bound: { frameId: view.frameId, side: view.side, box, hostId: host.id, ids: [id], values: { offset: u0, width, sill, height } }, source: { frameId: pic.frameId, sourceByteHash: pic.sourceByteHash, crop: box }, gate }
  if (g.winner === 'CURRENT') return { status: 'REJECTED_BY_SOURCE', code: fillRecord ? 'MODEL_FILL_BETTER_SUPPORTED' : existing ? 'MODEL_BETTER_SUPPORTED' : 'SOURCE_SHOWS_NO_OPENING', why: g.why, record }
  if (g.winner === 'UNDECIDED') return { status: 'NEEDS_EVIDENCE', code: fillRecord ? 'FILL_UNDECIDED' : 'SOURCE_UNDECIDED', why: g.why, record }
  if (u0 < -0.01 || u0 + width > L + 0.01) return { status: 'INVALID', code: 'HOST_TOO_SHORT', why: `${host.id} is ${L.toFixed(2)} m long; the opening would run ${u0.toFixed(2)}..${(u0 + width).toFixed(2)} m along it`, record }
  const oldFills = existing ? [...m.windows.filter((w) => w.openingId === existing.id).map((w) => ({ coll: 'windows', id: w.id })), ...m.doors.filter((d) => d.openingId === existing.id).map((d) => ({ coll: 'doors', id: d.id }))] : []
  const fillId = oldFills[0] && ((oldFills[0].coll === 'windows') === (kind === 'WINDOW')) ? oldFills[0].id : `${id}-${kind === 'WINDOW' ? 'unit' : 'leaf'}`
  const commands: BuildingCommand[] = [
    ...(existing ? [{ type: 'removeFeature' as const, targetId: existing.id, cascade: true }] : []),
    { type: 'cutOpening', id, wallId: host.id, kind: kind === 'WINDOW' ? 'WINDOW' : 'DOOR', offset: Math.max(0, u0), sill, width, height, ...(head ? { head } : {}) },
    ...fillCommands(m, id, kind, fillId, host.thickness),
  ]
  return { commands, allowed: [`openings:${id}`, ...oldFills.map((x) => `${x.coll}:${x.id}`), `${kind === 'WINDOW' ? 'windows' : 'doors'}:${fillId}`], expect: { kind: 'OPENING', id, view, box, shape: head ? proposedShape : box, levelId: host.levelId, openingKind: kind as OpeningPatchKindExact, ...(fillFrom ? { fillChangeFrom: fillFrom } : {}) }, record }
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
  const top = (c: number): number => {
    const pt = ax === 'x' ? { x: along, z: c } : { x: c, z: along }
    let best = -Infinity
    for (const pl of m.roofPlanes ?? []) {
      if (!inside(pt, pl.boundary)) continue
      const d = (pt.x - pl.datum.x) * pl.downslope.x + (pt.z - pl.datum.z) * pl.downslope.z
      best = Math.max(best, pl.datum.y - Math.tan((pl.pitchDeg * Math.PI) / 180) * d)
    }
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
    return Math.min(c1a, a1) - Math.max(c0a, a0) > 0.5 * Math.min(c1a - c0a, a1 - a0)
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
  const id = existing?.id ?? `chimney-fix-${view.side.toLowerCase()}-${short(p.proposalId)}`
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
    regions: [{ regionId: `finish-${short(p.proposalId)}-r`, class: f.material, outline: [[box.x0, box.y0], [box.x1, box.y0], [box.x1, box.y1], [box.x0, box.y1]], visibility: 'VISIBLE', uncertaintyPx: Math.max(2, tolPxOf(view)) }],
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
  const gate = { winner: (asDeclared === null || asMirror === null ? 'UNDECIDED' : asDeclared - asMirror >= 1 ? 'PROPOSED' : asMirror - asDeclared >= 1 ? 'CURRENT' : 'UNDECIDED') as HypothesisVerdict['winner'], proposedZ: asDeclared, currentZ: asMirror, nullBoxes: 0, why: asDeclared === null ? 'the model has no opening on that side to test the orientation with' : `the side's openings drawn through the declared orientation score z ${asDeclared?.toFixed(2)}, through its mirror z ${asMirror?.toFixed(2)}` }
  if (gate.winner === 'CURRENT') return { status: 'REJECTED_BY_SOURCE', code: 'MIRROR_CONTRADICTED', why: `the picture supports the other orientation: ${gate.why}`, record: { ...record, gate } }
  if (tops.length > 0 && view.heights) {
    const drawnTop = pyOf(projection, Math.max(...tops))
    if (drawnTop < 0) return { status: 'REJECTED_BY_SOURCE', code: 'AXIS_MISMATCH', why: `at the scale the ${side.toLowerCase()} side's ${(range.hi - range.lo).toFixed(2)} m gives this picture, its walls would rise above the picture: the drawing is not that side`, record: { ...record, gate } }
  }
  // the axis, measured: at the scale this side's walled length gives the picture, the model's eaves (the side walls'
  // storey top) must land on the eaves row the proposal names — a drawing of the other axis has the other length
  if (typeof f.eavesY === 'number') {
    const sideWalls = exteriorWalls(m).filter((w) => sideOfWall(m, w) === side)
    const eavesM = Math.max(...sideWalls.map((w) => { const lv = levelOf(m, w.levelId); return lv.elevation + w.baseOffset + (w.topProfile ? lv.height : w.height) }))
    const want = toFrameY(pic, p, f.eavesY)
    const got = pyOf(projection, eavesM)
    const tol = Math.max(3, 0.05 * Math.abs(ground - want))
    record.bound.values = { ...record.bound.values, eavesRowModel: r6(got), eavesRowDrawn: r6(want) }
    if (Math.abs(got - want) > tol) return { status: 'REJECTED_BY_SOURCE', code: 'AXIS_MISMATCH', why: `at ${mpp.toFixed(5)} m/px (the ${side.toLowerCase()} side's ${(range.hi - range.lo).toFixed(2)} m across the drawn walls) the model's eaves at ${eavesM.toFixed(2)} m land on row ${got.toFixed(0)}, the drawing's on row ${want.toFixed(0)} (tolerance ${tol.toFixed(0)} px): the picture is not that side at that scale`, record: { ...record, gate } }
  }
  if (held && held.side !== side && held.origin === 'ANALYZER' && gate.winner !== 'PROPOSED') return { status: 'NEEDS_EVIDENCE', code: 'VIEW_CONFLICT', why: `the analyzer registered picture ${pic.n} as the ${held.side.toLowerCase()} side; the source does not show the proposed side better (${gate.why})`, record: { ...record, gate } }
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
}

const closureErrors = (model: CanonicalBuildingModel): { n: number; scene?: ReturnType<typeof compileBuilding>; failed?: string } => {
  try {
    const scene = compileBuilding(model)
    const c = geometryClosureAudit(model, scene)
    return { n: c.findings.filter((x) => x.scope === 'EXTERIOR' && x.severity === 'ERROR').length, scene }
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
    if (!isPatchOperation(p.operation)) {
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
    let workingViews = views
    const pending: Array<{ p: CorrectionProposal; bound?: Bound; view?: BindView; extra: Partial<PatchRecord> }> = []
    let refusal: { p: CorrectionProposal; r: Refusal } | undefined
    for (const p of ordered) {
      const ctx: Ctx = { model: working, views: workingViews, pictures: input.pictures, witnesses: input.witnesses ?? [] }
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
      const b = op === 'SET_FINISH' ? bindFinish(ctx, p) : op === 'SET_PARAMETER' ? bindParameter(ctx, p) : op === 'ADD_CHIMNEY' || op === 'UPDATE_CHIMNEY' ? bindChimney(ctx, p) : bindOpening(ctx, p)
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
    const ok = (k: string): boolean => allowed.includes(k) || allowed.some((a) => a.endsWith(':*') && k.startsWith(a.slice(0, -1)))
    const collateral = changed.filter((k) => !ok(k))
    tx.changed = changed
    tx.allowed = allowed
    tx.collateral = collateral
    tx.closureAfter = after.n
    const measures = new Map<string, PatchRecord['measure']>()
    let failure: string | undefined
    if (after.failed) failure = `the candidate does not compile: ${after.failed}`
    else if (after.n > before.n) failure = `the candidate has ${after.n - before.n} more exterior joint error(s) than the model before`
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
        const sup = builtShape && pic ? supportOf(pic.raster, builtShape, facadePx(working, e.view), [builtShape, ...others], tolPxOf(e.view)) : undefined
        const builtKind = o ? kindOfOpening(working, o.id) : undefined
        const fillOk = e.fillChangeFrom && builtShape && pic ? compareFill(pic.raster, builtShape, e.openingKind, e.fillChangeFrom).winner === 'PROPOSED' : true
        const hErr = builtShape ? headError(builtShape, e.shape) : Infinity
        const hTol = Math.max(3, 0.05 * (e.box.y1 - e.box.y0))
        const verified = sup ? (sup.supported === null ? null : sup.supported && fillOk) : null
        measures.set(x.p.proposalId, { ...(built ? { builtBox: built } : {}), iouWithProposal: Math.round(ov * 1000) / 1000, builtSupportZ: sup?.z ?? null, ...(Number.isFinite(hErr) ? { headErrorPx: Math.round(hErr * 10) / 10 } : {}), ...(builtKind ? { builtKind } : {}), sourceVerified: verified, why: built ? `built ${e.id} (${builtKind ?? '?'}) on ${s?.wall.id} drawn back into the source: overlap ${ov.toFixed(2)} with the proposal${isRaked(e.shape) ? `, head ends within ${Number.isFinite(hErr) ? hErr.toFixed(1) : '∞'} px` : ''}, support z ${sup?.z ?? '—'}${e.fillChangeFrom ? `; fill ${fillOk ? 'shows' : 'does not show'} a ${e.openingKind}` : ''}` : `${e.id} is not in the candidate` })
        if (!built || ov < 0.85) failure = `${e.id} was not built where the proposal binds it (overlap ${ov.toFixed(2)})`
        else if (s && s.wall.levelId !== e.levelId) failure = `${e.id} was built on another storey`
        else if (isRaked(e.shape) && !(hErr <= hTol)) failure = `${e.id}'s head was not built as proposed (its ends are ${Number.isFinite(hErr) ? hErr.toFixed(1) : 'not'} px off, tolerance ${hTol.toFixed(1)})`
        else if (builtKind !== e.openingKind) failure = `${e.id} was built as ${builtKind ?? 'nothing'}, not ${e.openingKind}`
      } else if (e.kind === 'REMOVED') {
        if (working.openings.some((q) => q.id === e.id)) failure = `${e.id} is still in the candidate`
        measures.set(x.p.proposalId, { sourceVerified: true, why: `${e.id} and its fill removed` })
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
