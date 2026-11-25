/**
 * v3.54.17 — the body and roof operations of the correction registry, bound like every other patch: to the model that
 * stands (or the empty one), through a registered source elevation, gated on the original picture before anything is
 * applied, built by the kernel's own commands in the executor's transaction, measured on the compiled candidate.
 *
 *   BUILD_MASSING — the body (or a missing body) from the plan outline and the elevation silhouettes (massing.ts).
 *   SET_ROOF      — the roof of one named body replaced by the form, axis and heights a source elevation draws
 *                   (also a wrong flat → a source-justified gable), with the walls' tops and their openings accounted.
 *   SET_OUTLINE   — a body's extent along one side moved to where a source elevation draws its walls' ends, with the
 *                   walls' openings and finish regions, the roof's footprint, slabs and rooms moved with it.
 *
 * Dependants are part of the binding: what cannot follow (an opening above new eaves, an opening left outside a shorter
 * wall, a party line with another body, a roof made of planes) refuses the whole patch by name, so nothing is left
 * orphaned and nothing unrelated changes (the executor's collateral check holds the rest of the model).
 */
import { applyCommands } from '@buildapp/commands'
import type { BuildingCommand } from '@buildapp/commands'
import { validateModel } from '@buildapp/model'
import type { CanonicalBuildingModel, Opening, Wall } from '@buildapp/model'
import type { Evidence } from '@buildapp/model'
import { compareRegions } from '../correct/source-gate.js'
import type { Poly } from '../correct/source-gate.js'
import { facadePx, levelOf, openingBoxes, pictureOf, tolPxOf, toFrameX, toFrameY, viewOf } from '../correct/execute.js'
import type { BindPicture, BindView, Bound, Ctx, CorrectionProposal, Refusal, Side } from '../correct/execute.js'
import { targetBodies } from '../correct/resolve.js'
import type { BuildStructure } from '../structure.js'
import { regionOfPlane } from '../readback.js'
import { pointInPoly, solveRoofSystem } from '@buildapp/reconstruction'
import { area, bodiesOf, bodyCommands, extentOn, joinedBodiesOf, roofRegionsOfModel, roofSystemCommands, roofSystemOf, ROOF_SYSTEM_ID, outlineWithFront, pointWithFront, HIP_PLANE_SIDES, hipPlaneCommands, hipSpecFrom, hipWallTopM, MASSING_TOLERANCES, MAX_OVERHANG_M, MASSING_VERSION, massingCommands, MINIATURE_CONVENTIONS, profileOver, readableStretch, registerByPlan, solveMassing, wallCornerTopM } from './massing.js'
import type { BodySpec, Fidelity, MassingHypothesis, ModelBody, OutlineObservation, Rect, RoofSpec, SilhouetteObservation } from './massing.js'

export const MASSING_OPS_VERSION = '1.13.0' as const
/** v3.54.17 R2: the most overhang a drawn roof may have past its body on a side, and the steepest pitch the kernel builds. */
export { MAX_OVERHANG_M }
/** v3.54.18 (ops 1.6.0): an opening whose height the model ASSUMED comes down under a roof the source draws — to this far under the wall top, and only while at least this much of it is left (else the roof patch is refused, as before). */
export const HEAD_CLEARANCE_M = 0.1
export const MIN_YIELDED_HEIGHT_M = 0.5
export const MAX_PITCH_DEG = 85
export type MassingObservations = { outline?: OutlineObservation; silhouettes: readonly SilhouetteObservation[]; /** the side the plan read marks the main entrance on: which quarter turn a turned set of elevations is */ entranceSide?: Side; /** v3.54.19: the plan's partitions in the outline's frame (where two bodies in line meet) */ planWalls?: ReadonlyArray<{ a: { x: number; z: number }; b: { x: number; z: number } }> }

const r6 = (v: number): number => Math.round(v * 1e6) / 1e6
const along = (s: Side): 'x' | 'z' => (s === 'FRONT' || s === 'REAR' ? 'x' : 'z')
const pxOf = (p: BindView['projection'], a: number): number => (a - p.alongAtPx0) / (p.alongSign * p.mpp)
const pyOf = (p: BindView['projection'], y: number): number => p.zeroRow - y / (p.mppV ?? p.mpp)
const alongOfPx = (p: BindView['projection'], x: number): number => p.alongAtPx0 + p.alongSign * p.mpp * x
const STATUS_OF: Record<Fidelity, Evidence['status']> = { SOURCE_EXACT: 'SOURCE_EXACT', SOURCE_DERIVED: 'SOURCE_DERIVED', SOURCE_TRACED: 'GEOMETRIC_INFERRED', DISPLAY_ASSUMPTION: 'ASSUMED', TRACE_UNCERTAIN: 'UNRESOLVED' }

// ---- polygons in a picture --------------------------------------------------------------------------------------

function inPoly(poly: Poly, x: number, y: number): boolean {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if (poly[i][1] > y !== poly[j][1] > y && x < ((poly[j][0] - poly[i][0]) * (y - poly[i][1])) / (poly[j][1] - poly[i][1]) + poly[i][0]) c = !c
  return c
}
/** Overlap of two pixel polygons, by a 64 × 64 sample of their joint bounding box. */
export function polygonIou(a: Poly, b: Poly): number {
  const xs = [...a, ...b].map((p) => p[0])
  const ys = [...a, ...b].map((p) => p[1])
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const y0 = Math.min(...ys)
  const y1 = Math.max(...ys)
  let i = 0
  let u = 0
  for (let ix = 0; ix < 64; ix += 1) for (let iy = 0; iy < 64; iy += 1) {
    const x = x0 + ((ix + 0.5) * (x1 - x0)) / 64
    const y = y0 + ((iy + 0.5) * (y1 - y0)) / 64
    const pa = inPoly(a, x, y)
    const pb = inPoly(b, x, y)
    if (pa && pb) i += 1
    if (pa || pb) u += 1
  }
  return u > 0 ? i / u : 0
}
function hull(pts: ReadonlyArray<readonly [number, number]>): Poly {
  const p = [...pts].map((q) => [q[0], q[1]] as [number, number]).sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (p.length < 3) return p
  const cross = (o: [number, number], a: [number, number], b: [number, number]): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lo: Array<[number, number]> = []
  for (const q of p) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop()
    lo.push(q)
  }
  const up: Array<[number, number]> = []
  for (const q of [...p].reverse()) {
    while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop()
    up.push(q)
  }
  return [...lo.slice(0, -1), ...up.slice(0, -1)]
}

/** A roof spec's outline as the elevation of `side` draws it (orthographic, in that registration's pixels). */
export function specSilhouette(spec: RoofSpec, rect: Rect, view: BindView, overhang = 0): Poly {
  const p = view.projection
  const e = extentOn(rect, view.side)
  const a0 = pxOf(p, e.lo - overhang)
  const a1 = pxOf(p, e.hi + overhang)
  const yE = pyOf(p, spec.eavesM)
  // a flat roof is drawn as the walls' top: the parapet band down to the plate
  if (spec.kind === 'FLAT') return [[a0, yE + MINIATURE_CONVENTIONS.parapetM / p.mpp], [a1, yE + MINIATURE_CONVENTIONS.parapetM / p.mpp], [a1, yE], [a0, yE]]
  const yR = pyOf(p, spec.ridgeM ?? spec.eavesM)
  const ridgeAlongSide = (spec.ridgeAxis === 'X') === (along(view.side) === 'x')
  if (spec.kind === 'HIP') {
    // ops 1.7.0: a hip as its four planes project — a trapezoid on the sides along the ridge (the ridge ends stand the hip
    // run in from the end walls), a triangle on the hip ends; the fascia level all round, the overhang's fall below the
    // eaves at the wall (`hipPlaneCommands` builds exactly this)
    const half = (ridgeAlongSide ? (spec.ridgeAxis === 'X' ? rect.maxZ - rect.minZ : rect.maxX - rect.minX) : e.hi - e.lo) / 2
    const length = ridgeAlongSide ? e.hi - e.lo : spec.ridgeAxis === 'X' ? rect.maxX - rect.minX : rect.maxZ - rect.minZ
    const rise = (spec.ridgeM ?? spec.eavesM) - spec.eavesM
    const run = Math.min(Math.max(spec.hipRunM ?? half, 0.05), length / 2)
    const oh = spec.overhangM ?? 0
    const tanP = rise / half
    const ohEnd = rise > 0 ? (oh * tanP * run) / rise : 0
    const yF = pyOf(p, spec.eavesM - oh * tanP)
    if (ridgeAlongSide) return [[pxOf(p, e.lo - ohEnd), yF], [pxOf(p, e.hi + ohEnd), yF], [pxOf(p, e.hi - run), yR], [pxOf(p, e.lo + run), yR]]
    return [[pxOf(p, e.lo - oh), yF], [pxOf(p, e.hi + oh), yF], [pxOf(p, (e.lo + e.hi) / 2), yR]]
  }
  if (ridgeAlongSide) return [[a0, yE], [a1, yE], [a1, yR], [a0, yR]]
  return [[a0, yE], [a1, yE], [(a0 + a1) / 2, yR]]
}

/**
 * v3.54.17 R3: a gable with an overhang as an elevation along its ridge draws it: the slope runs on past the walls by the
 * overhang and its lower edge (the fascia) stands that reach times the slope below the eaves at the wall.
 */
function withOverhang(spec: RoofSpec, rect: Rect, view: BindView, oh: number): Poly {
  const drop = oh * Math.tan(((spec.pitchDeg ?? 0) * Math.PI) / 180)
  return specSilhouette({ ...spec, eavesM: spec.eavesM - drop }, rect, view, oh)
}

/** The roofs and roof planes over a body, as the elevation of `side` draws them: one hull, or none. */
export function bodyRoofSilhouette(m: CanonicalBuildingModel, b: ModelBody, view: BindView): Poly | undefined {
  const p = view.projection
  const ax = along(view.side)
  const pts: Array<[number, number]> = []
  for (const id of b.roofIds) {
    const r = m.roofs.find((q) => q.id === id)
    if (!r) continue
    const eaves = levelOf(m, r.levelId).elevation + r.eaveOffset
    const span = r.ridgeAxis === 'X' ? r.footprint.maxZ - r.footprint.minZ : r.footprint.maxX - r.footprint.minX
    const rise = r.kind === 'GABLE' ? Math.tan((r.pitchDeg * Math.PI) / 180) * (span / 2) : 0
    const spec: RoofSpec = r.kind === 'GABLE' ? { kind: 'GABLE', ridgeAxis: r.ridgeAxis, eavesM: eaves, ridgeM: eaves + rise } : { kind: 'FLAT', eavesM: eaves + MINIATURE_CONVENTIONS.parapetM }
    pts.push(...specSilhouette(spec, r.footprint, view, r.overhang).map((q) => [q[0], q[1]] as [number, number]))
  }
  for (const id of b.planeIds) {
    const pl = m.roofPlanes.find((q) => q.id === id)
    if (!pl) continue
    const t = Math.tan((pl.pitchDeg * Math.PI) / 180)
    for (const v of pl.boundary) {
      const y = pl.datum.y - t * ((v.x - pl.datum.x) * pl.downslope.x + (v.z - pl.datum.z) * pl.downslope.z)
      pts.push([pxOf(p, ax === 'x' ? v.x : v.z), pyOf(p, y)])
    }
  }
  return pts.length >= 3 ? hull(pts) : undefined
}

/** A body's walls as one rectangle in the elevation of `side`: floor to the lowest wall top (the eaves line). */
function bodyWallSilhouette(m: CanonicalBuildingModel, b: ModelBody, view: BindView, rect: Rect = b.rect): Poly | undefined {
  const ws = m.walls.filter((w) => b.wallIds.includes(w.id))
  if (ws.length === 0) return undefined
  const floor = Math.min(...ws.map((w) => levelOf(m, w.levelId).elevation + w.baseOffset))
  // the walls' top where they stop level (a flat roof's parapet); where they follow a roof, that roof's eaves
  const level = ws.filter((w) => !w.topProfile).map((w) => levelOf(m, w.levelId).elevation + w.baseOffset + w.height)
  const eaves = [...m.roofs.filter((r) => b.roofIds.includes(r.id)).map((r) => levelOf(m, r.levelId).elevation + r.eaveOffset), ...m.roofPlanes.filter((pl) => b.planeIds.includes(pl.id)).map((pl) => pl.datum.y)]
  const top = level.length > 0 ? Math.min(...level) : Math.min(...eaves)
  if (!Number.isFinite(top)) return undefined
  const e = extentOn(rect, view.side)
  const p = view.projection
  const a0 = pxOf(p, e.lo)
  const a1 = pxOf(p, e.hi)
  return [[a0, pyOf(p, floor)], [a1, pyOf(p, floor)], [a1, pyOf(p, top)], [a0, pyOf(p, top)]]
}

const hipHalfOf = (spec: RoofSpec, rect: Rect): number => ((spec.ridgeAxis ?? 'X') === 'X' ? rect.maxZ - rect.minZ : rect.maxX - rect.minX) / 2
/** A body's whole silhouette as an elevation draws it: its walls from the ground to the eaves, and its roof. */
function specBody(rect: Rect, spec: RoofSpec, view: BindView, floorM: number, overhang = 0): Poly[] {
  const p = view.projection
  const e = extentOn(rect, view.side)
  const a0 = pxOf(p, e.lo)
  const a1 = pxOf(p, e.hi)
  const top = spec.kind === 'HIP' ? Math.min(hipWallTopM(spec, false, hipHalfOf(spec, rect)), hipWallTopM(spec, true, hipHalfOf(spec, rect))) : spec.eavesM
  return [[[a0, pyOf(p, floorM)], [a1, pyOf(p, floorM)], [a1, pyOf(p, top)], [a0, pyOf(p, top)]], ...(spec.kind === 'GABLE' ? [overhang > 0 ? withOverhang(spec, rect, view, overhang) : specSilhouette(spec, rect, view)] : spec.kind === 'HIP' ? [specSilhouette(spec, rect, view)] : [])]
}
function modelBody(m: CanonicalBuildingModel, b: ModelBody, view: BindView, rect: Rect = b.rect): Poly[] {
  const w = bodyWallSilhouette(m, b, view, rect)
  const r = rect === b.rect ? bodyRoofSilhouette(m, b, view) : undefined
  return [...(w ? [w] : []), ...(r ? [r] : [])]
}
const others = (m: CanonicalBuildingModel, bodies: readonly ModelBody[], b: ModelBody, view: BindView): Poly[] => bodies.filter((q) => q.id !== b.id).flatMap((q) => modelBody(m, q, view))
const regionRecord = (g: ReturnType<typeof compareRegions>) => ({ winner: g.winner, proposedZ: null, currentZ: null, nullBoxes: g.background.n, why: g.why, measure: 'REGION' as const })
/** A built body back in the source: what it covers must be drawn matter (null when the picture cannot tell). */
function drawnBack(r: BindPicture['raster'], sil: Poly[], occupied: Poly[], ground: number): { verified: boolean | null; why: string } {
  const g = compareRegions(r, sil, [], occupied, ground)
  return { verified: g.proposedOnly.cls === 'BUILDING' ? true : g.proposedOnly.cls === 'BACKGROUND' ? false : null, why: g.proposedOnly.cls === 'EMPTY' ? 'nothing to draw back' : `${Math.round(g.proposedOnly.share * 100)} % drawn matter` }
}

const framePoly = (pic: BindPicture, p: CorrectionProposal, poly: ReadonlyArray<readonly [number, number]>): Poly => poly.map((q) => [toFrameX(pic, p, q[0]), toFrameY(pic, p, q[1])] as [number, number])

function oneBody(m: CanonicalBuildingModel, targetId: string): { body: ModelBody; bodies: ModelBody[] } | Refusal {
  const bodies = bodiesOf(m)
  const tb = targetBodies(m, bodies, targetId) ?? (bodies.some((b) => b.id === targetId) ? { ids: [targetId], what: targetId } : undefined)
  if (!tb) return { status: 'INVALID', code: 'UNKNOWN_BODY', why: `${targetId} is not a body of the model, nor a roof, plane or wall of one (bodies: ${bodies.map((b) => b.id).join(', ') || 'none'})` }
  if (tb.ids.length !== 1) return { status: 'NEEDS_EVIDENCE', code: 'AMBIGUOUS_BODY', why: `${targetId} belongs to ${tb.ids.join(' and ')}: name one body (its wall ring or its roof)` }
  return { body: bodies.find((b) => b.id === tb.ids[0]) as ModelBody, bodies }
}
// v3.54.17 R3: a body of walls without a ring record (bodiesOf) is rectangular when every wall of it is square to the plan
const rectangular = (m: CanonicalBuildingModel, b: ModelBody): boolean => (b.ringIds.length > 0 ? b.ringIds.every((id) => (m.wallRings.find((r) => r.id === id)?.wallIds.length ?? 0) === 4) : b.wallIds.length >= 3 && m.walls.filter((w) => b.wallIds.includes(w.id)).every((w) => Math.abs(w.start.x - w.end.x) < 1e-3 || Math.abs(w.start.z - w.end.z) < 1e-3))
const topLevelOf = (m: CanonicalBuildingModel, b: ModelBody): { id: string; elevation: number } | undefined => b.levelIds.map((id) => ({ id, elevation: levelOf(m, id).elevation })).sort((x, y) => y.elevation - x.elevation)[0]

/** The registration a roof is read through: the analyzer's with heights, or one made by the body's own plan extent. */
function heightView(ctx: Ctx, p: CorrectionProposal, pic: BindPicture, body: ModelBody): { view: BindView; how: string } | Refusal {
  const v = viewOf(ctx, pic)
  if (v && (v.heights || v.roofAnchored)) return { view: v, how: `${v.origin.toLowerCase()} registration of ${pic.frameId} (${v.side.toLowerCase()})` }
  const f = p.patch ?? {}
  const side = f.side ?? v?.side
  if (side && typeof f.wallLeftX === 'number' && typeof f.wallRightX === 'number' && typeof f.groundY === 'number') {
    const l = toFrameX(pic, p, f.wallLeftX)
    const r = toFrameX(pic, p, f.wallRightX)
    const g = toFrameY(pic, p, f.groundY)
    // v3.54.17 R2: wall ends of the whole house register by the whole house's extent (never by one body's narrow one)
    const house = f.extent === 'HOUSE'
    const all = bodiesOf(ctx.model).filter((q) => q.ringIds.length > 0).map((q) => extentOn(q.rect, side))
    const ext = house ? { lo: Math.min(...all.map((e) => e.lo)), hi: Math.max(...all.map((e) => e.hi)) } : extentOn(body.rect, side)
    const reg = registerByPlan({ observationId: p.proposalId, side, frameId: pic.frameId, sourceByteHash: pic.sourceByteHash, groundRow: g, walls: [[[l, g], [r, g], [r, g - 10], [l, g - 10]]], roofs: [] }, ext)
    if ('view' in reg) return { view: reg.view, how: `registered by ${house ? "the house's" : `${body.id}'s`} plan extent: ${reg.why}` }
    return { status: 'NEEDS_EVIDENCE', code: 'NO_HEIGHT_REGISTRATION', why: reg.refused }
  }
  return { status: 'NEEDS_EVIDENCE', code: 'NO_HEIGHT_REGISTRATION', why: `picture ${pic.n} (${pic.frameId}) has no registration with heights: give side, wallLeftX/wallRightX (the body's wall ends) and groundY, and the analyzer registers it by the body's plan extent` }
}

// ---- SET_ROOF ---------------------------------------------------------------------------------------------------

export function bindSetRoof(ctx: Ctx, p: CorrectionProposal): Bound | Refusal {
  const m = ctx.model
  const f = p.patch ?? {}
  if ((f.roofKind !== 'GABLE' && f.roofKind !== 'FLAT' && f.roofKind !== 'HIP') || !Array.isArray(f.roofPolygon) || f.roofPolygon.length < 3) return { status: 'INVALID', code: 'NO_ROOF_SHAPE', why: 'SET_ROOF states roofKind (GABLE, HIP or FLAT) and roofPolygon (the roof as the picture draws it, ≥ 3 points)' }
  const ob = oneBody(m, p.targetId)
  if ('status' in ob) return ob
  const { body, bodies } = ob
  if (body.wallIds.length === 0) return { status: 'UNSUPPORTED_OPERATION', code: 'NO_WALLS', why: `${body.id} has no walls: a roof is set on a body; build the body first (BUILD_MASSING)` }
  if (!rectangular(m, body)) return { status: 'UNSUPPORTED_OPERATION', code: 'NOT_RECTANGULAR', why: `${body.id}'s rings are not four-walled: a roof over a non-rectangular body is beyond this version` }
  // ops 1.13.0: a roof that is one region of a ROOF SYSTEM (its planes are cut by the roofs it meets, and theirs by it)
  // is never changed alone: the correction is measured as for any roof, then the WHOLE system is solved again from its
  // regions with this one replaced, and its planes, creases and free edges are stated anew in one transaction (below).
  const system = m.assemblies.find((q) => q.kind === 'ROOF' && q.id === ROOF_SYSTEM_ID)
  const regionId = `roof-${body.id.replace(/^ring-/, '')}`
  const member = !!system && system.kind === 'ROOF' && m.roofPlanes.some((pl) => system.planeIds.includes(pl.id) && regionOfPlane(pl.id) === regionId)
  const pic = pictureOf(ctx, p, f.picture)
  if (!pic) return { status: 'INVALID', code: 'NOT_A_SOURCE_PICTURE', why: `picture ${String(f.picture ?? p.frameId)} is not a source picture of this check` }
  if (pic.projection !== 'ORTHOGRAPHIC_ELEVATION') return { status: 'INVALID', code: 'NOT_ORTHOGRAPHIC', why: `picture ${pic.n} is ${pic.projection}: a perspective draws no metric roof` }
  const hv = heightView(ctx, p, pic, body)
  if ('status' in hv) return hv
  const view = hv.view
  const poly = framePoly(pic, p, f.roofPolygon)
  // v3.54.17 R2 (audit §5): plausibility BEFORE any command — the kernel stays the last guard, never the only one
  // (a) one picture, one scale: a registration made for this patch must agree with the one the picture already has
  const known = viewOf(ctx, pic)
  if (known && known !== view && known.side === view.side) {
    const k = view.projection.mpp / known.projection.mpp
    if (k < 0.85 || k > 1 / 0.85) return { status: 'NEEDS_EVIDENCE', code: 'REGISTRATION_INCONSISTENT', why: `${hv.how} gives ${(view.projection.mpp * 100).toFixed(2)} cm/px, the picture's own registration ${(known.projection.mpp * 100).toFixed(2)} cm/px: two scales of one drawing — the patch's wall ends are not this side's` }
  }
  // (b) the body's own stretch on this side: where another body is projected too, what is drawn there is not only this one
  const e = extentOn(body.rect, view.side)
  const shared = bodies.some((q) => q !== body && q.wallIds.length > 0 && Math.min(e.hi, extentOn(q.rect, view.side).hi) - Math.max(e.lo, extentOn(q.rect, view.side).lo) > 1e-6)
  const st = shared ? readableStretch(body.rect, bodies.filter((q) => q !== body && q.wallIds.length > 0).map((q) => q.rect), view.side) : e
  if (!st) return { status: 'NEEDS_EVIDENCE', code: 'BODY_HIDDEN_ON_SIDE', why: `on the ${view.side.toLowerCase()} side ${body.id}'s whole stretch is shared with another body: what is drawn over it may be the other's roof` }
  const prof = profileOver(view, st.lo, st.hi, { walls: [], roofs: [poly] })
  if (!prof) return { status: 'INVALID', code: 'ROOF_NOT_OVER_BODY', why: `the drawn roof does not stand over ${body.id}'s ${(e.hi - e.lo).toFixed(2)} m on the ${view.side.toLowerCase()} side` }
  // (c) the drawn roof's width belongs to this body: a gable end as wide as the body's span, slopes not much wider than it
  {
    const px = poly.map((q) => q[0])
    const drawnM = (Math.max(...px) - Math.min(...px)) * view.projection.mpp
    const stretchM = e.hi - e.lo
    if (prof.shape === 'TRIANGLE' && (drawnM < 0.75 * stretchM || drawnM > stretchM + 2 * MAX_OVERHANG_M)) return { status: 'NEEDS_EVIDENCE', code: 'ROOF_NOT_THIS_BODY', why: `the drawn gable is ${drawnM.toFixed(2)} m wide, ${body.id} is ${stretchM.toFixed(2)} m on the ${view.side.toLowerCase()} side: not this body's gable at this registration` }
    if (prof.shape !== 'TRIANGLE' && drawnM > stretchM + 2 * MAX_OVERHANG_M) return { status: 'NEEDS_EVIDENCE', code: 'ROOF_WIDER_THAN_BODY', why: `the drawn roof is ${drawnM.toFixed(2)} m wide over ${body.id}'s ${stretchM.toFixed(2)} m (more than ${MAX_OVERHANG_M} m of overhang a side): another body's roof, or another registration` }
  }
  const rise = prof.topM - prof.eavesM
  if ((f.roofKind === 'FLAT') !== (rise < MASSING_TOLERANCES.flatRiseM)) return { status: 'INVALID', code: 'KIND_CONTRADICTS_SHAPE', why: `${f.roofKind} proposed, but the drawn roof rises ${rise.toFixed(2)} m over its eaves (flat below ${MASSING_TOLERANCES.flatRiseM} m)` }
  const top = topLevelOf(m, body) as { id: string; elevation: number }
  let spec: RoofSpec
  let overhangM = 0
  let pitchFrom: string | undefined
  if (f.roofKind === 'GABLE') {
    if (prof.shape === 'TRAPEZOID') return { status: 'INVALID', code: 'HIP_ROOF', why: `GABLE proposed, but the drawn roof is a trapezoid on the ${view.side.toLowerCase()} side (its top shorter than its eaves at both ends): a hip — roofKind HIP states it` }
    const axis: 'X' | 'Z' = prof.shape === 'TRIANGLE' ? (along(view.side) === 'x' ? 'Z' : 'X') : along(view.side) === 'x' ? 'X' : 'Z'
    const span = axis === 'X' ? body.rect.maxZ - body.rect.minZ : body.rect.maxX - body.rect.minX
    spec = { kind: 'GABLE', ridgeAxis: axis, pitchDeg: Math.round(((Math.atan2(rise, span / 2) * 180) / Math.PI) * 10) / 10, eavesM: r6(prof.eavesM), ridgeM: r6(prof.topM) }
    // v3.54.18 (ops 1.5.0): the eaves AT THE WALL are where the drawn walls end at the body's corners (`wallTopY`, the
    // line both an eaves view and a gable view share). The drawn roof's lowest edge is its fascia — or a porch roof
    // carried lower (Alberto: the lowest edge at 2.38 m gave a 35° roof for the page's 25°; the walls end at 2.87 m).
    const wallTopM = typeof f.wallTopY === 'number' && Number.isFinite(f.wallTopY) ? (view.projection.zeroRow - toFrameY(pic, p, f.wallTopY)) * (view.projection.mppV ?? view.projection.mpp) : undefined
    const wallTopOk = wallTopM !== undefined && wallTopM - top.elevation > 0.3 && prof.topM - wallTopM >= MASSING_TOLERANCES.flatRiseM
    if (wallTopOk) {
      // the drawn wall ends under the roof: that line is the roof's UNDERSIDE at the wall. The roof's top surface there
      // (what `eaveOffset` states, and what the wall compiler takes the slab's thickness off) stands above it by the
      // slab measured vertically, t / cos(pitch) — solved with the pitch it changes. Read as the top surface itself, the
      // built wall ended 0.3 m under the drawn one and every opening whose head reached into that band was not cut
      // (Alberto: 14 openings of two eaves walls in the model and in no view).
      const t = MINIATURE_CONVENTIONS.roofThicknessM
      let e = wallTopM as number
      for (let i = 0; i < 6; i += 1) e = (wallTopM as number) + t / Math.cos(Math.atan2(Math.max(0.01, prof.topM - e), span / 2))
      if (prof.topM - e >= MASSING_TOLERANCES.flatRiseM) spec = { kind: 'GABLE', ridgeAxis: axis, pitchDeg: Math.round(((Math.atan2(prof.topM - e, span / 2) * 180) / Math.PI) * 10) / 10, eavesM: r6(e), ridgeM: r6(prof.topM) }
      else spec = { kind: 'GABLE', ridgeAxis: axis, pitchDeg: Math.round(((Math.atan2(prof.topM - (wallTopM as number), span / 2) * 180) / Math.PI) * 10) / 10, eavesM: r6(wallTopM as number), ridgeM: r6(prof.topM) }
    }
    // v3.54.17 R3: seen along its ridge, a gable's lowest drawn edge is its fascia — past the wall by the overhang and
    // lower than the eaves at the wall. With the pitch the page states, the eaves at the wall follow from the drawn ridge
    // (ridge − half the span × tan pitch) and the overhang from the drawn fascia; both must be possible (0..MAX), or the
    // pitch and the drawing disagree and the page's pitch is not used (named)
    const pagePitch = ctx.facts?.roofPitchDeg
    if (prof.shape !== 'TRIANGLE' && pagePitch !== undefined && pagePitch >= 10 && pagePitch <= 60) {
      const tan = Math.tan((pagePitch * Math.PI) / 180)
      const eavesWall = prof.topM - (span / 2) * tan
      // with the walls' top drawn: a boxed soffit hides the wall between the fascia line and the plate, so the plate the
      // page's pitch gives may stand above the drawn wall top by no more than the overhang's fall — and the overhang is
      // that fall over the pitch. Without it (R3): the overhang from the roof's lowest edge.
      const oh = wallTopOk ? (eavesWall - (wallTopM as number)) / tan : (eavesWall - prof.eavesM) / tan
      if (oh >= (wallTopOk ? -0.35 / tan : -0.05) && oh <= MAX_OVERHANG_M + (wallTopOk ? 0.25 : 0)) {
        spec = { kind: 'GABLE', ridgeAxis: axis, pitchDeg: pagePitch, eavesM: r6(eavesWall), ridgeM: r6(prof.topM) }
        overhangM = Math.round(Math.min(MAX_OVERHANG_M, Math.max(0, oh)) * 100) / 100
        // the model builds one overhang all round: where another body stands against an eaves side within that reach,
        // the eaves overhang would run into it — the heights and the pitch are kept, the overhang is not built (named)
        const eavesSides = axis === 'X' ? (['minZ', 'maxZ'] as const) : (['minX', 'maxX'] as const)
        const against = bodies.find((q) => q.id !== body.id && eavesSides.some((k) => {
          const gap = k === 'minZ' ? body.rect.minZ - q.rect.maxZ : k === 'maxZ' ? q.rect.minZ - body.rect.maxZ : k === 'minX' ? body.rect.minX - q.rect.maxX : q.rect.minX - body.rect.maxX
          const ov = axis === 'X' ? Math.min(q.rect.maxX, body.rect.maxX) - Math.max(q.rect.minX, body.rect.minX) : Math.min(q.rect.maxZ, body.rect.maxZ) - Math.max(q.rect.minZ, body.rect.minZ)
          return gap > -0.05 && gap < overhangM + 0.05 && ov > 0.05
        }))
        if (against && overhangM > 0) {
          pitchFrom = `the page's ${pagePitch}° with the drawn ridge: eaves at the wall ${eavesWall.toFixed(2)} m; the drawn ${overhangM.toFixed(2)} m eaves overhang is NOT built — ${against.id} stands against an eaves side (one overhang all round in the model)`
          overhangM = 0
        }
        pitchFrom = `the page's ${pagePitch}° with the drawn ridge ${prof.topM.toFixed(2)} m: eaves at the wall ${eavesWall.toFixed(2)} m, ${wallTopOk ? `the drawn walls end at ${(wallTopM as number).toFixed(2)} m` : `fascia ${prof.eavesM.toFixed(2)} m`} → overhang ${overhangM.toFixed(2)} m`
      } else pitchFrom = `the page's ${pagePitch}° would put the overhang at ${oh.toFixed(2)} m from the drawn ridge and fascia: not used, the drawn eaves taken`
    }
  } else if (f.roofKind === 'HIP') {
    // ops 1.7.0: a hip is read on a side ALONG its ridge — the one view that draws how far the ridge ends stand in from
    // the end walls (a trapezoid). A hip end draws a triangle, the same as a gable's: it does not state the hip run
    if (prof.shape !== 'TRAPEZOID' || !prof.ridge) return { status: prof.shape === 'BAND' ? 'INVALID' : 'NEEDS_EVIDENCE', code: prof.shape === 'BAND' ? 'KIND_CONTRADICTS_SHAPE' : 'HIP_RUN_NOT_SEEN', why: prof.shape === 'BAND' ? `HIP proposed, but the drawn roof is a band on the ${view.side.toLowerCase()} side (its top as long as its eaves): a gable's slope` : `the ${view.side.toLowerCase()} side draws a ${prof.shape.toLowerCase()}: a hip's ridge ends are read on a side along the ridge (a trapezoid), not on a hip end` }
    const axis: 'X' | 'Z' = along(view.side) === 'x' ? 'X' : 'Z'
    const span = axis === 'X' ? body.rect.maxZ - body.rect.minZ : body.rect.maxX - body.rect.minX
    const run = ((prof.ridge.lo - e.lo) + (e.hi - prof.ridge.hi)) / 2
    if (run < MASSING_TOLERANCES.minHipRunM) return { status: 'INVALID', code: 'KIND_CONTRADICTS_SHAPE', why: `HIP proposed, but the drawn ridge ends ${run.toFixed(2)} m in from ${body.id}'s end walls (a hip from ${MASSING_TOLERANCES.minHipRunM} m): a gable's slope` }
    // the eaves' reach past the walls as this view draws it; built only where the body stands alone
    const reachDrawn = prof.drawn ? ((e.lo - prof.drawn.lo) + (prof.drawn.hi - e.hi)) / 2 : 0
    const reach = bodies.filter((q) => q.wallIds.length > 0).length === 1 ? Math.round(Math.min(MAX_OVERHANG_M, Math.max(0, reachDrawn)) * 100) / 100 : 0
    spec = hipSpecFrom({ axis, span, length: e.hi - e.lo, topM: prof.topM, lowM: prof.eavesM, runM: run, reachM: reach })
    pitchFrom = `the drawn ridge ends ${run.toFixed(2)} m in from the end walls; the slope from the roof's lowest drawn edge (${prof.eavesM.toFixed(2)} m) over ${(span / 2 + (spec.overhangM ?? 0)).toFixed(2)} m to the ridge: ${spec.pitchDeg}°, the top surface at the wall face ${spec.eavesM.toFixed(2)} m${spec.overhangM ? `, eaves reach ${spec.overhangM.toFixed(2)} m` : ''}`
  } else spec = { kind: 'FLAT', eavesM: r6(prof.topM) }
  // (d) a pitch the kernel cannot build is named here, with its inputs — never clamped to a buildable one
  if (spec.kind !== 'FLAT' && !((spec.pitchDeg ?? 0) <= MAX_PITCH_DEG)) return { status: 'NEEDS_EVIDENCE', code: 'IMPLAUSIBLE_PITCH', why: `${(spec.pitchDeg ?? 0).toFixed(1)}° from a rise of ${rise.toFixed(2)} m over half of ${(spec.ridgeAxis === 'X' ? body.rect.maxZ - body.rect.minZ : body.rect.maxX - body.rect.minX).toFixed(2)} m through ${hv.how}: beyond ${MAX_PITCH_DEG}°, the registration or the drawn roof is not this body's` }
  // (e) ops 1.13.0: the height the page states for the building is a witness from outside every drawing. No roof of the
  // house stands above it; a proposal that does — while the roof it would replace stands nearer to it — is a picture
  // registered at another scale, however well its own pixels agree with it (a body the builder had agreed at the printed
  // ridge was replaced by a roof 1.8 m above the building's stated height, and the source gate, which sees one picture,
  // called it drawn). Named, with both numbers; nothing is clamped.
  {
    const H = ctx.facts?.buildingHeightM
    if (H !== undefined && H > 2 && spec.kind !== 'FLAT' && spec.ridgeM !== undefined) {
      const tol = Math.max(0.6, 0.1 * H)
      const tops = [...m.roofs.filter((r) => body.roofIds.includes(r.id) && r.kind !== 'FLAT').map((r) => levelOf(m, r.levelId).elevation + r.eaveOffset + Math.tan((r.pitchDeg * Math.PI) / 180) * ((r.ridgeAxis === 'X' ? body.rect.maxZ - body.rect.minZ : body.rect.maxX - body.rect.minX) / 2)), ...m.roofPlanes.filter((pl) => body.planeIds.includes(pl.id)).flatMap((pl) => pl.boundary.map((q) => pl.datum.y - Math.tan((pl.pitchDeg * Math.PI) / 180) * ((q.x - pl.datum.x) * pl.downslope.x + (q.z - pl.datum.z) * pl.downslope.z)))]
      const cur = tops.length > 0 ? Math.max(...tops) : undefined
      if (spec.ridgeM > H + tol && (cur === undefined || Math.abs(spec.ridgeM - H) > Math.abs(cur - H) + 0.05)) return { status: 'NEEDS_EVIDENCE', code: 'ABOVE_PUBLISHED_HEIGHT', why: `the proposed ridge at ${spec.ridgeM.toFixed(2)} m stands ${(spec.ridgeM - H).toFixed(2)} m above the height the page states for the whole building (${H.toFixed(2)} m, tolerance ${tol.toFixed(2)} m)${cur !== undefined ? `; the roof it would replace tops at ${cur.toFixed(2)} m` : ''}: the picture is registered at another scale through ${hv.how}, or the drawn roof is not this body's — the roof is not replaced` }
    }
  }
  if (!(spec.eavesM - top.elevation > 0.3)) return { status: 'INVALID', code: 'IMPOSSIBLE_EAVES', why: `the drawn eaves at ${spec.eavesM.toFixed(2)} m are not above ${top.id} (${top.elevation.toFixed(2)} m)` }
  // a region of the roof system is built without an eaves overhang (the system's planes end on the walls' lines): named
  if (member && overhangM > 0) { pitchFrom = `${pitchFrom ?? ''}; the drawn ${overhangM.toFixed(2)} m overhang is not built on a roof of the roof system`; overhangM = 0 }
  if (member && spec.overhangM) spec = { ...spec, overhangM: 0 }
  // the source decides between the model's roof and the proposal on the original picture
  const proposed = overhangM > 0 ? withOverhang(spec, body.rect, view, overhangM) : specSilhouette(spec, body.rect, view)
  const floorM = Math.min(...body.levelIds.map((id) => levelOf(m, id).elevation))
  const occupied = others(m, bodies, body, view)
  const gate = compareRegions(pic.raster, specBody(body.rect, spec, view, floorM, overhangM), modelBody(m, body, view), occupied, view.projection.zeroRow)
  const gateRec = regionRecord(gate)
  const record = { bound: { frameId: pic.frameId, side: view.side, hostId: body.id, ids: [body.id], values: { eavesM: spec.eavesM, ...(overhangM > 0 ? { overhangM } : {}), ...(spec.overhangM ? { overhangM: spec.overhangM } : {}), ...(spec.hipRunM ? { hipRunM: spec.hipRunM } : {}), ...(spec.ridgeM ? { ridgeM: spec.ridgeM } : {}), ...(spec.pitchDeg ? { pitchDeg: spec.pitchDeg } : {}) } }, source: { frameId: pic.frameId, sourceByteHash: pic.sourceByteHash }, gate: gateRec, massing: { version: MASSING_OPS_VERSION, body: body.id, spec, registration: hv.how, profile: prof.why } }
  if (gate.winner === 'CURRENT') return { status: 'REJECTED_BY_SOURCE', code: 'SOURCE_SUPPORTS_MODEL', why: `the picture supports the model's roof over the proposal: ${gate.why}`, record }
  if (gate.winner !== 'PROPOSED') return { status: 'NEEDS_EVIDENCE', code: 'SOURCE_UNDECIDED', why: `the picture does not decide between the model's roof and the proposal: ${gate.why}`, record }
  // dependants: the walls of the top storey take the new top; an opening that would rise above it refuses the patch
  const topWalls = m.walls.filter((w) => body.wallIds.includes(w.id) && w.levelId === top.id)
  const eavesRel = spec.eavesM - top.elevation
  const ridgeAlong = (w: Wall): boolean => (spec.kind === 'GABLE' ? Math.abs(spec.ridgeAxis === 'X' ? w.end.x - w.start.x : w.end.z - w.start.z) > 1e-6 : true)
  // v3.54.18 (ops 1.6.0): held against the wall top the compiler builds — the roof's underside at the wall, the slab's
  // vertical thickness under `eaveOffset` — not against the roof's top surface (an opening between the two passed this
  // check and was then not cut). An opening whose HEIGHT the model only assumed yields to the roof the source draws:
  // its head comes down to the wall top in the same transaction (property-level rule: an assumption does not block a
  // read fact); a height that was read or printed still refuses the patch, and neither is moved.
  const slabM = spec.kind !== 'FLAT' ? MINIATURE_CONVENTIONS.roofThicknessM / Math.cos(((spec.pitchDeg ?? 0) * Math.PI) / 180) : 0
  const wallTopRel = eavesRel - slabM
  // under a hip the end walls (across the ridge) end under the hip ends' own pitch
  const hipEnd = (w: Wall): boolean => spec.kind === 'HIP' && Math.abs(spec.ridgeAxis === 'X' ? w.end.x - w.start.x : w.end.z - w.start.z) <= 1e-6
  const wallTopOf = (w: Wall): number => (hipEnd(w) ? hipWallTopM(spec, true, hipHalfOf(spec, body.rect)) - top.elevation : wallTopRel)
  const above = m.openings.filter((o) => topWalls.some((w) => w.id === o.wallId && ridgeAlong(w) && o.sill + o.height > wallTopOf(w) - w.baseOffset + 1e-3))
  const heightAssumed = (o: Opening): boolean => (o.evidence as { properties?: Record<string, string> } | undefined)?.properties?.height === 'ASSUMED'
  const hostTop = (o: Opening): number => { const w = topWalls.find((q) => q.id === o.wallId); return (w ? wallTopOf(w) : wallTopRel) - (w?.baseOffset ?? 0) }
  const yields = above.filter((o) => heightAssumed(o) && hostTop(o) - HEAD_CLEARANCE_M - o.sill >= MIN_YIELDED_HEIGHT_M)
  const blocked = above.filter((o) => !yields.includes(o))
  if (blocked.length > 0) return { status: 'NEEDS_EVIDENCE', code: 'OPENING_ABOVE_EAVES', why: `${blocked.map((o) => o.id).join(', ')} would rise above the wall top under the new roof (${(top.elevation + wallTopRel).toFixed(2)} m; eaves ${spec.eavesM.toFixed(2)} m): the opening and the roof disagree, and the patch does not move either`, record }
  if (member) {
    // the system as the model holds it, proved by solving it again (nothing recorded elsewhere is trusted to describe it)
    if (spec.kind === 'FLAT') return { status: 'UNSUPPORTED_OPERATION', code: 'ROOF_SYSTEM_MEMBER_FLAT', why: `${body.id}'s roof is one region of the roof system: a flat roof in its place is another body form (the system holds pitched regions) — not done by this operation, the difference stays open by name`, record }
    const rec = roofRegionsOfModel(m)
    if ('why' in rec) return { status: 'UNSUPPORTED_OPERATION', code: 'ROOF_SYSTEM_NOT_RECOVERED', why: `${body.id}'s roof is one region of the roof system, and the system cannot be solved again from the model: ${rec.why}`, record }
    const lights = m.roofOpenings.filter((o) => rec.planeIds.includes(o.roofId))
    if (lights.length > 0) return { status: 'UNSUPPORTED_OPERATION', code: 'ROOF_SYSTEM_HAS_ROOF_WINDOWS', why: `the roof system carries ${lights.length} roof opening(s) (${lights.map((o) => o.id).join(', ')}): solving it again would drop them from planes that no longer exist — the roof is corrected before roof windows are placed, not after`, record }
    const next = rec.regions.map((q) => (q.id === regionId ? { ...q, kind: spec.kind as 'GABLE' | 'HIP', ridgeAxis: spec.ridgeAxis ?? q.ridgeAxis, eaveY: spec.eavesM, ridgeY: spec.ridgeM as number, ...(spec.kind === 'HIP' && spec.hipRunM !== undefined ? { hipRunM: spec.hipRunM } : { hipRunM: undefined }) } : q)).map((q) => { const { hipRunM, ...rest } = q; return hipRunM === undefined ? rest : q })
    const sol = solveRoofSystem(next)
    if (sol.violations.length > 0) return { status: 'NEEDS_EVIDENCE', code: 'ROOF_SYSTEM_VIOLATION', why: `with ${body.id}'s roof as proposed the roof system does not solve: ${sol.violations.map((v) => v.why).join('; ')}`.slice(0, 600), record }
    const before = joinedBodiesOf(rec.solution)
    const after = joinedBodiesOf(sol)
    if (before.size !== after.size || [...before].some((id) => !after.has(id))) return { status: 'UNSUPPORTED_OPERATION', code: 'ROOF_SYSTEM_MEMBERSHIP_CHANGES', why: `with ${body.id}'s roof as proposed the roofs that meet are no longer the same (${[...before].sort().join(', ')} → ${[...after].sort().join(', ') || 'none'}): a body leaving or entering the system is rebuilt with its walls, which this operation does not do`, record }
    const oldPlanes = m.roofPlanes.filter((pl) => rec.planeIds.includes(pl.id))
    const levelId = oldPlanes[0].levelId
    const material = oldPlanes.find((pl) => pl.materialId)?.materialId
    const evidence = { status: 'SOURCE_DERIVED' as const, source: pic.frameId, locator: `roof polygon on ${pic.frameId}`, interpretation: `${spec.kind}${spec.ridgeAxis ? ` along ${spec.ridgeAxis}` : ''} read from the source elevation through ${hv.how}; the roof system solved again with it` }
    const systemBodies = bodies.filter((q) => after.has(q.id.replace(/^ring-/, '')))
    const specs = systemBodies.map((q) => ({ id: q.id.replace(/^ring-/, ''), rect: q.rect, roof: { kind: 'GABLE' as const, eavesM: 0 }, provenance: {} }))
    const ringWalls = m.walls.filter((w) => systemBodies.some((q) => q.wallIds.includes(w.id)))
    const thickness = Math.max(...ringWalls.map((w) => w.thickness))
    // every wall that died into a plane of the old system and is not a ring wall (a partition under the roof) dies into
    // the planes of the new one that stand over its own line
    const followers = m.walls.filter((w) => !ringWalls.includes(w) && w.topProfile?.kind === 'FOLLOW_ROOF_PLANES' && w.topProfile.planeIds.some((id) => rec.planeIds.includes(id)))
    const joinedRegions = new Set(sol.regions.filter((q) => after.has(q.hostBodyId)).map((q) => q.id))
    const newPlanes = sol.planes.filter((q) => joinedRegions.has(q.regionId))
    const cmds: BuildingCommand[] = [{ type: 'removeFeature', targetId: ROOF_SYSTEM_ID, cascade: false } as BuildingCommand, ...rec.planeIds.map((id) => ({ type: 'removeFeature', targetId: id, cascade: true }) as BuildingCommand)]
    for (const q of systemBodies) {
      const ridge = Math.max(...sol.regions.filter((g) => g.hostBodyId === q.id.replace(/^ring-/, '')).map((g) => g.ridgeY))
      for (const w of m.walls.filter((x) => q.wallIds.includes(x.id) && x.levelId === top.id)) cmds.push({ type: 'setProperty', targetId: w.id, property: 'height', value: r6(ridge - levelOf(m, w.levelId).elevation - w.baseOffset) })
    }
    for (const o of yields) cmds.push({ type: 'setProperty', targetId: o.id, property: 'height', value: r6(hostTop(o) - HEAD_CLEARANCE_M - o.sill) })
    cmds.push(...roofSystemCommands(sol, specs, levelId, thickness).map((c) => (c.type === 'createRoofPlane' ? ({ ...c, ...(material ? { materialId: material } : {}), evidence } as BuildingCommand) : c)))
    for (const w of followers) {
      const over = new Set<string>()
      for (let k = 0; k <= 24; k += 1) { const t = 0.005 + (0.99 * k) / 24; const q = { x: w.start.x + (w.end.x - w.start.x) * t, z: w.start.z + (w.end.z - w.start.z) * t }; for (const pl of newPlanes) if (pointInPoly(q, pl.boundary, 1e-9)) over.add(pl.id) }
      if (over.size > 0) cmds.push({ type: 'setProperty', targetId: w.id, property: 'topProfile', value: { kind: 'FOLLOW_ROOF_PLANES', planeIds: [...over].sort() } } as BuildingCommand)
    }
    const allowed = [`assemblies:${ROOF_SYSTEM_ID}`, 'roofPlanes:*', 'roofEdges:*', ...ringWalls.map((w) => `walls:${w.id}`), ...followers.map((w) => `walls:${w.id}`), ...yields.flatMap((o) => [`openings:${o.id}`, `windows:${o.id}-unit`, `doors:${o.id}-unit`])]
    const want = sol.regions.find((q) => q.id === regionId)
    const measure = (working: CanonicalBuildingModel, _before: CanonicalBuildingModel, pictures: readonly BindPicture[]): { failure?: string; measure: { sourceVerified: boolean | null; why: string } } => {
      // the candidate's own system, measured back and solved again, must hold this region as it was solved here
      const back = roofRegionsOfModel(working)
      if ('why' in back) return { failure: `the roof system of the candidate is not the one solved: ${back.why}`, measure: { sourceVerified: false, why: back.why } }
      const got = back.solution.regions.find((q) => q.id === regionId)
      if (!got || !want || got.kind !== want.kind || got.ridgeAxis !== want.ridgeAxis || Math.abs(got.eaveY - want.eaveY) > 0.01 || Math.abs(got.ridgeY - want.ridgeY) > 0.01) return { failure: `${regionId} was not built as solved (${got ? `${got.kind} along ${got.ridgeAxis}, ${got.eaveY.toFixed(2)} → ${got.ridgeY.toFixed(2)} m` : 'absent'})`, measure: { sourceVerified: false, why: 'the region measured back differs from the one solved' } }
      const src = pictures.find((q) => q.frameId === pic.frameId)
      const drawn = src ? drawnBack(src.raster, specBody(body.rect, { ...spec, eavesM: want.eaveY, ridgeM: want.ridgeY }, view, floorM, 0), occupied, view.projection.zeroRow) : undefined
      const rel = back.solution.relations.filter((q) => q.a === regionId || q.b === regionId).map((q) => `${q.a} → ${q.b} ${q.kind}`).join('; ')
      return { measure: { sourceVerified: drawn ? drawn.verified : null, why: `the roof system solved again with ${regionId} as ${want.kind} along ${want.ridgeAxis}, eaves ${want.eaveY.toFixed(2)} m, ridge ${want.ridgeY.toFixed(2)} m, ${want.pitchDeg.toFixed(1)}° (${rel || 'meets no other roof'}; ${back.solution.creases.filter((c) => c.kind === 'VALLEY').length} valley(s)); measured back from the candidate's planes; the body drawn back into ${pic.frameId} covers ${drawn?.why ?? '—'}` } }
    }
    return { commands: cmds, allowed, expect: { kind: 'CUSTOM', measure }, record: { ...record, massing: { ...record.massing, roofSystem: { regions: sol.regions.map((q) => ({ id: q.id, kind: q.kind, ridgeAxis: q.ridgeAxis, eaveY: q.eaveY, ridgeY: q.ridgeY, pitchDeg: q.pitchDeg })), relations: sol.relations, adjustments: sol.adjustments } } } }
  }
  const removedRoofs = body.roofIds
  // a hip's four planes carry their roof's id (`<roof>-minZ` …): a body roofed by them keeps that id through any change
  const hipBase = body.planeIds.length === HIP_PLANE_SIDES.length ? HIP_PLANE_SIDES.reduce<string | undefined>((base, sd) => { const id = body.planeIds.find((q) => q.endsWith(`-${sd}`)); const b = id?.slice(0, -sd.length - 1); return id && (base === undefined || base === b) ? b : '' }, undefined) : undefined
  const keepId = removedRoofs.length === 1 ? removedRoofs[0] : removedRoofs.length === 0 && hipBase ? hipBase : `roof-${body.id}`
  const cmds: BuildingCommand[] = [...removedRoofs.map((id) => ({ type: 'removeFeature', targetId: id, cascade: true }) as BuildingCommand), ...body.planeIds.map((id) => ({ type: 'removeFeature', targetId: id, cascade: true }) as BuildingCommand)]
  for (const w of topWalls) {
    const h = spec.kind === 'GABLE' ? (spec.ridgeM as number) - top.elevation - w.baseOffset : spec.kind === 'HIP' ? wallTopOf(w) - w.baseOffset : eavesRel - w.baseOffset
    cmds.push({ type: 'setProperty', targetId: w.id, property: 'height', value: r6(h) })
    if (w.topProfile) cmds.push({ type: 'setProperty', targetId: w.id, property: 'topProfile', value: undefined })
  }
  for (const o of yields) cmds.push({ type: 'setProperty', targetId: o.id, property: 'height', value: r6(hostTop(o) - HEAD_CLEARANCE_M - o.sill) })
  const others2 = bodies.filter((b) => b.id !== body.id).map((b) => b.rect)
  const built = bodyCommands({ id: body.id, rect: body.rect, roof: spec, provenance: {} }, top.id, top.elevation, others2, 0.3).filter((c) => c.type === 'createRoof') as Array<Extract<BuildingCommand, { type: 'createRoof' }>>
  // v3.54.17 R3: every wall that followed a removed roof (interior partitions under it included) follows the new one —
  // the cascade leaves them with their flat storey height, which runs up through the new roof — and the roof keeps its
  // material
  const followers = m.walls.filter((w) => !topWalls.some((t) => t.id === w.id) && w.topProfile?.kind === 'FOLLOW_ROOF' && removedRoofs.includes(w.topProfile.roofId)).map((w) => w.id)
  const oldMaterial = m.roofs.find((r) => removedRoofs.includes(r.id) && r.materialId)?.materialId
  const evidence = { status: 'SOURCE_DERIVED' as const, source: pic.frameId, locator: `roof polygon on ${pic.frameId}`, interpretation: `${spec.kind}${spec.ridgeAxis ? ` along ${spec.ridgeAxis}` : ''} read from the source elevation through ${hv.how}` }
  if (spec.kind === 'HIP') {
    // every wall under a hip ends level under it: the walls that followed the removed roof take the same top
    for (const id of followers) {
      const w = m.walls.find((q) => q.id === id) as Wall
      cmds.push({ type: 'setProperty', targetId: id, property: 'height', value: r6(Math.min(w.height, top.elevation + Math.min(wallTopRel, hipWallTopM(spec, true, hipHalfOf(spec, body.rect)) - top.elevation) - levelOf(m, w.levelId).elevation - w.baseOffset)) })
    }
    cmds.push(...hipPlaneCommands(keepId, top.id, body.rect, spec, { ...(oldMaterial ? { materialId: oldMaterial } : {}), evidence }))
  }
  const roofCmd = spec.kind === 'HIP' ? undefined : { ...built[0], id: keepId, ...(oldMaterial && !built[0].materialId ? { materialId: oldMaterial } : {}), ...(overhangM > 0 ? { overhang: overhangM } : {}), ...(spec.kind === 'GABLE' ? { capWallIds: [...topWalls.map((w) => w.id), ...followers] } : {}), evidence }
  if (roofCmd) cmds.push(roofCmd as BuildingCommand)
  const removedDeps = m.roofOpenings.filter((o) => removedRoofs.includes(o.roofId) || body.planeIds.includes(o.roofId)).map((o) => o.id)
  // v3.54.17 R3: interior walls under the roof follow its new underside (their tops are capped by it), nothing else of them
  const underRoof = m.walls.filter((w) => w.kind !== 'EXTERIOR' && body.levelIds.includes(w.levelId) && [w.start, w.end].every((q) => q.x >= body.rect.minX - 0.05 && q.x <= body.rect.maxX + 0.05 && q.z >= body.rect.minZ - 0.05 && q.z <= body.rect.maxZ + 0.05)).map((w) => `walls:${w.id}`)
  const allowed = [...underRoof, ...followers.map((id) => `walls:${id}`), ...removedRoofs.map((id) => `roofs:${id}`), `roofs:${keepId}`, ...HIP_PLANE_SIDES.map((sd) => `roofPlanes:${keepId}-${sd}`), ...body.planeIds.map((id) => `roofPlanes:${id}`), ...topWalls.map((w) => `walls:${w.id}`), ...removedDeps.map((id) => `roofOpenings:${id}`), 'rooflights:*', 'roofEdges:*', ...yields.flatMap((o) => [`openings:${o.id}`, `windows:${o.id}-unit`, `doors:${o.id}-unit`])]
  const measure = (working: CanonicalBuildingModel, _before: CanonicalBuildingModel, pictures: readonly BindPicture[]): { failure?: string; measure: { sourceVerified: boolean | null; why: string; iouWithProposal?: number; builtSupportZ?: number | null } } => {
    const nb = bodiesOf(working).find((b) => b.id === body.id)
    const sil = nb ? bodyRoofSilhouette(working, nb, view) : undefined
    if (!sil) return { failure: `${body.id} has no roof in the candidate`, measure: { sourceVerified: false, why: 'no roof built' } }
    const ov = polygonIou(sil, proposed)
    const src = pictures.find((q) => q.frameId === pic.frameId)
    const back = src && nb ? drawnBack(src.raster, modelBody(working, nb, view), occupied, view.projection.zeroRow) : undefined
    const kind = working.roofs.find((r) => r.id === keepId)?.kind ?? (HIP_PLANE_SIDES.every((sd) => working.roofPlanes.some((q) => q.id === `${keepId}-${sd}`)) ? 'HIP' : undefined)
    const why = `built ${keepId} (${kind}) drawn back into ${pic.frameId}: overlap ${ov.toFixed(2)} with the source's roof; the built body covers ${back?.why ?? '—'}`
    if (ov < 0.8) return { failure: `${keepId} was not built as the source draws it (overlap ${ov.toFixed(2)})`, measure: { sourceVerified: false, why, iouWithProposal: Math.round(ov * 1000) / 1000 } }
    if (kind !== spec.kind) return { failure: `${keepId} was built ${kind}, not ${spec.kind}`, measure: { sourceVerified: false, why } }
    return { measure: { sourceVerified: back ? back.verified : null, why, iouWithProposal: Math.round(ov * 1000) / 1000 } }
  }
  return { commands: cmds, allowed, expect: { kind: 'CUSTOM', measure }, record }
}

// ---- SET_OUTLINE ------------------------------------------------------------------------------------------------

export function bindSetOutline(ctx: Ctx, p: CorrectionProposal): Bound | Refusal {
  const m = ctx.model
  const f = p.patch ?? {}
  const ob = oneBody(m, p.targetId)
  if ('status' in ob) return ob
  const { body, bodies } = ob
  if (body.planeIds.length > 0) return { status: 'UNSUPPORTED_OPERATION', code: 'PLANE_ROOF_OUTLINE', why: `${body.id}'s roof is made of planes: a plane roof does not follow a moved outline in this version (SET_ROOF it first)` }
  // v3.54.17 R3: a printed overall dimension moves the walls standing on the house's ends, ring or no ring, as long as
  // the body's walls are square to the plan (each along x or along z)
  if (f.printed) {
    const ws = m.walls.filter((w) => body.wallIds.includes(w.id))
    if (ws.length < 3 || ws.some((w) => Math.abs(w.start.x - w.end.x) > 1e-3 && Math.abs(w.start.z - w.end.z) > 1e-3)) return { status: 'UNSUPPORTED_OPERATION', code: 'NOT_RECTANGULAR', why: `${body.id}'s walls are not square to the plan: its outline is not moved by a printed length` }
    return bindOutlineByPrinted(ctx, p, body, bodies)
  }
  if (body.ringIds.length === 0 || !rectangular(m, body)) return { status: 'UNSUPPORTED_OPERATION', code: 'NOT_RECTANGULAR', why: `${body.id} is not a four-walled body: its outline is changed by rebuilding it (BUILD_MASSING)` }
  if (typeof f.wallLeftX !== 'number' || typeof f.wallRightX !== 'number') return { status: 'INVALID', code: 'NO_EXTENT', why: "SET_OUTLINE states wallLeftX and wallRightX: the body's wall ends as the picture draws them" }
  const pic = pictureOf(ctx, p, f.picture)
  if (!pic || pic.projection !== 'ORTHOGRAPHIC_ELEVATION') return { status: 'INVALID', code: 'NOT_ORTHOGRAPHIC', why: 'SET_OUTLINE reads the wall ends on a source orthographic elevation' }
  const view = viewOf(ctx, pic)
  if (!view) return { status: 'NEEDS_EVIDENCE', code: 'VIEW_NOT_REGISTERED', why: `${pic.frameId} is not registered to a side: the wall ends cannot be put in metres` }
  const a = [alongOfPx(view.projection, toFrameX(pic, p, f.wallLeftX)), alongOfPx(view.projection, toFrameX(pic, p, f.wallRightX))].sort((x, y) => x - y)
  const ax = along(view.side)
  const old = extentOn(body.rect, view.side)
  const dLo = r6(a[0] - old.lo)
  const dHi = r6(a[1] - old.hi)
  const tol = Math.max(0.05, view.alongErrorM)
  if (Math.abs(dLo) < tol && Math.abs(dHi) < tol) return { status: 'INVALID', code: 'NO_CHANGE', why: `the drawn ends (${a[0].toFixed(2)}–${a[1].toFixed(2)} m) are ${body.id}'s own within ${tol.toFixed(2)} m` }
  if (a[1] - a[0] < MASSING_TOLERANCES.minBodyM) return { status: 'INVALID', code: 'IMPOSSIBLE_EXTENT', why: `${(a[1] - a[0]).toFixed(2)} m is not a body` }
  const lo = Math.abs(dLo) < tol ? old.lo : r6(a[0])
  const hi = Math.abs(dHi) < tol ? old.hi : r6(a[1])
  const newRect: Rect = ax === 'x' ? { ...body.rect, minX: lo, maxX: hi } : { ...body.rect, minZ: lo, maxZ: hi }
  // a party line with another body does not move alone
  const party = bodies.filter((b) => b.id !== body.id).find((b) => {
    const e = extentOn(b.rect, view.side)
    return (lo !== old.lo && (Math.abs(e.hi - old.lo) < 0.05 || Math.abs(e.lo - old.lo) < 0.05)) || (hi !== old.hi && (Math.abs(e.lo - old.hi) < 0.05 || Math.abs(e.hi - old.hi) < 0.05))
  })
  if (party) return { status: 'UNSUPPORTED_OPERATION', code: 'PARTY_LINE', why: `the moved end of ${body.id} is the line it shares with ${party.id}: two bodies' party wall is not moved by one of them` }
  const overlap = bodies.filter((b) => b.id !== body.id).find((b) => Math.min(b.rect.maxX, newRect.maxX) - Math.max(b.rect.minX, newRect.minX) > 0.05 && Math.min(b.rect.maxZ, newRect.maxZ) - Math.max(b.rect.minZ, newRect.minZ) > 0.05)
  if (overlap) return { status: 'INVALID', code: 'OVERLAPS_BODY', why: `the new extent of ${body.id} runs into ${overlap.id}` }
  // the source: the walls at the new extent against the walls at the model's
  const proposedPoly = bodyWallSilhouette(m, body, view, newRect)
  const currentPoly = bodyWallSilhouette(m, body, view)
  if (!proposedPoly || !currentPoly) return { status: 'NEEDS_EVIDENCE', code: 'NO_WALL_TOP', why: `${body.id}'s walls have no level top to draw` }
  // each hypothesis is the whole body: its walls at that extent and its roof stretched to it (the roof is not background)
  const roofNow = bodyRoofSilhouette(m, body, view)
  const pxA = [pxOf(view.projection, old.lo), pxOf(view.projection, old.hi)]
  const pxB = [pxOf(view.projection, lo), pxOf(view.projection, hi)]
  const stretch = (q: Poly): Poly => q.map(([x, y]) => [pxB[0] + ((x - pxA[0]) * (pxB[1] - pxB[0])) / (pxA[1] - pxA[0]), y] as [number, number])
  const occupied = others(m, bodies, body, view)
  const gate = compareRegions(pic.raster, [proposedPoly, ...(roofNow ? [stretch(roofNow)] : [])], [currentPoly, ...(roofNow ? [roofNow] : [])], occupied, view.projection.zeroRow)
  const record = { bound: { frameId: pic.frameId, side: view.side, hostId: body.id, ids: [body.id], values: { lo, hi, dLo, dHi } }, source: { frameId: pic.frameId, sourceByteHash: pic.sourceByteHash }, gate: regionRecord(gate), massing: { version: MASSING_OPS_VERSION, body: body.id, from: old, to: { lo, hi }, axis: ax } }
  if (gate.winner === 'CURRENT') return { status: 'REJECTED_BY_SOURCE', code: 'SOURCE_SUPPORTS_MODEL', why: `the picture supports ${body.id}'s present extent: ${gate.why}`, record }
  if (gate.winner !== 'PROPOSED') return { status: 'NEEDS_EVIDENCE', code: 'SOURCE_UNDECIDED', why: `the picture does not decide the extent: ${gate.why}`, record }
  const e = outlineEdit(m, body, old, lo, hi, ax, newRect, record)
  if ('status' in e) return e
  const { cmds, transform, allowed } = e
  const measure = (working: CanonicalBuildingModel, _b: CanonicalBuildingModel, pictures: readonly BindPicture[]): { failure?: string; measure: { sourceVerified: boolean | null; why: string; builtSupportZ?: number | null } } => {
    const nb = bodiesOf(working).find((b) => b.id === body.id)
    const e = nb ? extentOn(nb.rect, view.side) : undefined
    if (!e || Math.abs(e.lo - lo) > 0.01 || Math.abs(e.hi - hi) > 0.01) return { failure: `${body.id} was not built to ${lo.toFixed(2)}–${hi.toFixed(2)} m`, measure: { sourceVerified: false, why: `built extent ${e ? `${e.lo.toFixed(2)}–${e.hi.toFixed(2)}` : 'none'}` } }
    const src = pictures.find((q) => q.frameId === pic.frameId)
    const sil = nb ? bodyWallSilhouette(working, nb, view) : undefined
    const back = src && sil ? drawnBack(src.raster, [sil], occupied, view.projection.zeroRow) : undefined
    return { measure: { sourceVerified: back ? back.verified : null, why: `${body.id} now ${lo.toFixed(2)}–${hi.toFixed(2)} m along ${ax}; its walls drawn back into ${pic.frameId} cover ${back?.why ?? '—'}` } }
  }
  return { commands: cmds, transform, allowed, expect: { kind: 'CUSTOM', measure }, record }
}

/** v3.54.17 R3: a body's walls moved to `lo`..`hi` along `ax`, with their dependants (openings, regions, roofs, slabs, rooms) — shared by SET_OUTLINE read on an elevation and SET_OUTLINE from a printed overall dimension. */
function outlineEdit(m: CanonicalBuildingModel, body: ModelBody, old: { lo: number; hi: number }, lo: number, hi: number, ax: 'x' | 'z', newRect: Rect, record: NonNullable<Refusal['record']>): { cmds: BuildingCommand[]; transform: (x: CanonicalBuildingModel) => CanonicalBuildingModel; allowed: string[] } | Refusal {
  const dLo = r6(lo - old.lo)
  const dHi = r6(hi - old.hi)
  // dependants: wall ends on the moved lines, openings and regions re-measured from their wall's new start
  const key = ax
  const mv = (v: number): number => (Math.abs(v - old.lo) < 1e-3 ? lo : Math.abs(v - old.hi) < 1e-3 ? hi : v)
  const cmds: BuildingCommand[] = []
  // the ring moves as one edit: every wall end, offset and region at once (one end alone breaks its corner)
  const edits = new Map<string, Record<string, unknown>>()
  const edit = (id: string, prop: string, value: unknown): void => void edits.set(id, { ...(edits.get(id) ?? {}), [prop]: value })
  const allowed: string[] = []
  const blocked: string[] = []
  for (const w of m.walls.filter((q) => body.wallIds.includes(q.id))) {
    const start = { ...w.start, [key]: mv(w.start[key]) }
    const end = { ...w.end, [key]: mv(w.end[key]) }
    if (start[key] === w.start[key] && end[key] === w.end[key]) continue
    const len0 = Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z)
    const len = Math.hypot(end.x - start.x, end.z - start.z)
    const dir = { x: (end.x - start.x) / len, z: (end.z - start.z) / len }
    const shift = (w.start.x - start.x) * dir.x + (w.start.z - start.z) * dir.z
    edit(w.id, 'start', start)
    edit(w.id, 'end', end)
    allowed.push(`walls:${w.id}`)
    for (const o of m.openings.filter((q) => q.wallId === w.id)) {
      const off = r6(o.offset + shift)
      if (off < 0 || off + o.width > len + 1e-6) blocked.push(o.id)
      else if (Math.abs(shift) > 1e-9) {
        edit(o.id, 'offset', off)
        allowed.push(`openings:${o.id}`)
      }
    }
    for (const rg of m.surfaceRegions.filter((q) => q.hostId === w.id && (q.face === 'OUTER' || q.face === 'INNER'))) {
      const a0 = Math.max(0, rg.rect.a0 + shift)
      const a1 = Math.min(len, rg.rect.a1 + shift)
      if (a1 - a0 < 0.05) {
        blocked.push(rg.id)
        continue
      }
      // a region that covered the whole wall keeps covering it
      const whole = rg.rect.a0 <= 1e-3 && rg.rect.a1 >= len0 - 1e-3
      const rect = whole ? { ...rg.rect, a0: 0, a1: r6(len) } : { ...rg.rect, a0: r6(a0), a1: r6(a1) }
      edit(rg.id, 'rect', rect)
      if (rg.outline) edit(rg.id, 'outline', whole ? undefined : rg.outline.map((q) => ({ ...q, a: r6(Math.min(len, Math.max(0, q.a + shift))) })))
      allowed.push(`surfaceRegions:${rg.id}`)
    }
  }
  if (blocked.length > 0) return { status: 'NEEDS_EVIDENCE', code: 'DEPENDANT_OUTSIDE_OUTLINE', why: `${blocked.join(', ')} would be left outside ${body.id}'s new walls: the outline and those elements disagree, and the patch moves neither`, record }
  for (const c of m.chimneys) {
    const cx = (c.footprint.minX + c.footprint.maxX) / 2
    const cz = (c.footprint.minZ + c.footprint.maxZ) / 2
    const inOld = cx >= body.rect.minX && cx <= body.rect.maxX && cz >= body.rect.minZ && cz <= body.rect.maxZ
    const inNew = cx >= newRect.minX && cx <= newRect.maxX && cz >= newRect.minZ && cz <= newRect.maxZ
    if (inOld && !inNew) return { status: 'NEEDS_EVIDENCE', code: 'DEPENDANT_OUTSIDE_OUTLINE', why: `chimney ${c.id} would stand outside ${body.id}`, record }
  }
  for (const r of m.roofs.filter((q) => body.roofIds.includes(q.id))) {
    const fpR = { ...r.footprint }
    const k0 = key === 'x' ? 'minX' : 'minZ'
    const k1 = key === 'x' ? 'maxX' : 'maxZ'
    if (Math.abs(fpR[k0] - old.lo) < 0.05) fpR[k0] = lo
    if (Math.abs(fpR[k1] - old.hi) < 0.05) fpR[k1] = hi
    if (fpR[k0] !== r.footprint[k0] || fpR[k1] !== r.footprint[k1]) {
      cmds.push({ type: 'resizeFeature', targetId: r.id, footprint: fpR })
      allowed.push(`roofs:${r.id}`)
    }
  }
  // slabs and rooms of the body's levels whose vertices lie on a moved line move with it
  for (const coll of ['slabs', 'rooms'] as const) for (const o of (m[coll] as Array<{ id: string; levelId: string; polygon: Array<{ x: number; z: number }> }>).filter((q) => body.levelIds.includes(q.levelId))) {
    const inside = o.polygon.every((v) => v.x >= body.rect.minX - 0.4 && v.x <= body.rect.maxX + 0.4 && v.z >= body.rect.minZ - 0.4 && v.z <= body.rect.maxZ + 0.4)
    if (!inside) continue
    const near = (v: number, line: number): boolean => Math.abs(v - line) < 0.4
    const poly = o.polygon.map((v) => ({ ...v, [key]: near(v[key], old.lo) && lo !== old.lo ? r6(v[key] + dLo) : near(v[key], old.hi) && hi !== old.hi ? r6(v[key] + dHi) : v[key] }))
    if (poly.some((v, i) => v[key] !== o.polygon[i][key])) {
      edit(o.id, 'polygon', poly)
      allowed.push(`${coll}:${o.id}`)
    }
  }
  for (const rid of body.ringIds) allowed.push(`wallRings:${rid}`, `wallJunctions:${rid}*`)
  const transform = (x: CanonicalBuildingModel): CanonicalBuildingModel => {
    const out = structuredClone(x) as unknown as Record<string, unknown>
    for (const v of Object.values(out)) if (Array.isArray(v)) for (const o of v as Array<Record<string, unknown>>) {
      const e = edits.get(o.id as string)
      if (!e) continue
      for (const [k, val] of Object.entries(e)) {
        if (val === undefined) delete o[k]
        else o[k] = val
      }
    }
    return out as unknown as CanonicalBuildingModel
  }
  return { cmds, transform, allowed }
}

/**
 * v3.54.17 R3: SET_OUTLINE from a PRINTED overall dimension of the plan (the metric read's WHOLE_HOUSE, OUTER_FACE
 * length with its dimension line's two ends). The line's ends are put in metres through the plan's own registration; the
 * line must be the printed length at the plan's scale (within 1.5 % or 0.1 m), or it is not that dimension. The body
 * standing at both ends of the house on that axis takes the printed length, centred on the drawn line (the residual of
 * the plan's scale split evenly), an end that already agrees staying where it is. An elevation registered by the
 * model's own walls cannot show that the walls are too short or too long — the printed dimension can.
 */
function bindOutlineByPrinted(ctx: Ctx, p: CorrectionProposal, body: ModelBody, bodies: readonly ModelBody[]): Bound | Refusal {
  const m = ctx.model
  const pr = (p.patch ?? {}).printed
  if (!pr || !(pr.valueM > 0)) return { status: 'INVALID', code: 'NO_PRINTED_VALUE', why: 'SET_OUTLINE from a printed dimension states its value and the dimension line\'s ends' }
  const plan = ctx.plans?.find((q) => q.frameId === pr.planFrameId)
  if (!plan) return { status: 'NEEDS_EVIDENCE', code: 'PLAN_NOT_REGISTERED', why: `the plan ${pr.planFrameId} is not registered: the dimension line cannot be put in metres` }
  const w0 = plan.toWorld(pr.from[0], pr.from[1])
  const w1 = plan.toWorld(pr.to[0], pr.to[1])
  const ax: 'x' | 'z' = Math.abs(w1.x - w0.x) >= Math.abs(w1.z - w0.z) ? 'x' : 'z'
  const side: Side = ax === 'x' ? 'FRONT' : 'RIGHT'
  const a = [w0[ax], w1[ax]].sort((x, y) => x - y)
  const measured = a[1] - a[0]
  const record = { bound: { frameId: pr.planFrameId, ids: [body.id], values: { printedM: pr.valueM, measuredM: r6(measured), lineLo: r6(a[0]), lineHi: r6(a[1]) } }, source: { frameId: pr.planFrameId, sourceByteHash: pr.sourceByteHash } }
  if (Math.abs(measured - pr.valueM) > Math.max(0.1, 0.015 * pr.valueM)) return { status: 'REJECTED_BY_SOURCE', code: 'DIMENSION_OFF_SCALE', why: `the dimension line "${pr.literal}" spans ${measured.toFixed(2)} m at the plan's scale, not the printed ${pr.valueM} m: it is not that dimension at this registration`, record }
  const c = (a[0] + a[1]) / 2
  const lo0 = r6(c - pr.valueM / 2)
  const hi0 = r6(c + pr.valueM / 2)
  const ext = bodies.map((b) => ({ b, e: extentOn(b.rect, side) }))
  const hLo = Math.min(...ext.map((x) => x.e.lo))
  const hHi = Math.max(...ext.map((x) => x.e.hi))
  // the house as it stands already measures the printed length at both ends: nothing to move, whoever stands there
  const tolH = Math.max(0.05, 0.005 * pr.valueM)
  // a body that already runs between the line's two ends is what the line measures (a main body beside a porch)
  const same = ext.find((x) => Math.abs(x.e.lo - lo0) < tolH && Math.abs(x.e.hi - hi0) < tolH)
  if (same) return { status: 'NO_EFFECT', code: 'OUTLINE_AGREES', why: `${same.b.id} runs ${same.e.lo.toFixed(2)}–${same.e.hi.toFixed(2)} m along ${ax}, between the printed "${pr.literal}" line's ends`, record }
  if (Math.abs(hLo - lo0) < tolH && Math.abs(hHi - hi0) < tolH) return { status: 'NO_EFFECT', code: 'OUTLINE_AGREES', why: `the house runs ${hLo.toFixed(2)}–${hHi.toFixed(2)} m along ${ax}; the printed "${pr.literal}" agrees within ${tolH.toFixed(2)} m at each end`, record }
  const atLo = ext.filter((x) => Math.abs(x.e.lo - hLo) < 0.05)
  const atHi = ext.filter((x) => Math.abs(x.e.hi - hHi) < 0.05)
  if (atLo.length !== 1 || atHi.length !== 1 || atLo[0].b.id !== body.id || atHi[0].b.id !== body.id) return { status: 'NEEDS_EVIDENCE', code: 'NOT_ONE_BODY_AT_ENDS', why: `the house's ends along ${ax} are not both ${body.id}'s alone (${atLo.map((x) => x.b.id).join('+')} / ${atHi.map((x) => x.b.id).join('+')}): which body takes the printed length is not told`, record }
  const old = extentOn(body.rect, side)
  const tol = Math.max(0.05, 0.005 * pr.valueM)
  const dLo = lo0 - old.lo
  const dHi = hi0 - old.hi
  if (Math.abs(dLo) < tol && Math.abs(dHi) < tol) return { status: 'NO_EFFECT', code: 'OUTLINE_AGREES', why: `${body.id} is ${(old.hi - old.lo).toFixed(2)} m along ${ax}; the printed "${pr.literal}" agrees within ${tol.toFixed(2)} m at each end`, record }
  if (Math.max(Math.abs(dLo), Math.abs(dHi)) > Math.max(0.6, 0.05 * pr.valueM)) return { status: 'NEEDS_EVIDENCE', code: 'PRINTED_TOO_FAR', why: `the printed "${pr.literal}" would move ${body.id}'s ends by ${dLo.toFixed(2)} / ${dHi.toFixed(2)} m: more than a traced wall face misses by — another part of the house, not this outline`, record }
  const lo = Math.abs(dLo) < tol ? old.lo : lo0
  const hi = Math.abs(dHi) < tol ? old.hi : hi0
  const newRect: Rect = ax === 'x' ? { ...body.rect, minX: lo, maxX: hi } : { ...body.rect, minZ: lo, maxZ: hi }
  const overlap = bodies.filter((b) => b.id !== body.id).find((b) => Math.min(b.rect.maxX, newRect.maxX) - Math.max(b.rect.minX, newRect.minX) > 0.05 && Math.min(b.rect.maxZ, newRect.maxZ) - Math.max(b.rect.minZ, newRect.minZ) > 0.05 && !(Math.min(b.rect.maxX, body.rect.maxX) - Math.max(b.rect.minX, body.rect.minX) > 0.05 && Math.min(b.rect.maxZ, body.rect.maxZ) - Math.max(b.rect.minZ, body.rect.minZ) > 0.05))
  if (overlap) return { status: 'INVALID', code: 'OVERLAPS_BODY', why: `the new extent of ${body.id} runs into ${overlap.id}`, record }
  const rec = { ...record, bound: { ...record.bound, values: { ...record.bound.values, lo, hi, dLo: r6(lo - old.lo), dHi: r6(hi - old.hi) } } }
  const e = outlineEdit(m, body, old, lo, hi, ax, newRect, rec)
  if ('status' in e) return e
  const measure = (working: CanonicalBuildingModel): { failure?: string; measure: { sourceVerified: boolean | null; why: string } } => {
    const nb = bodiesOf(working).find((b) => b.id === body.id)
    const got = nb ? extentOn(nb.rect, side) : undefined
    if (!got || Math.abs(got.lo - lo) > 0.01 || Math.abs(got.hi - hi) > 0.01) return { failure: `${body.id} was not built to ${lo.toFixed(2)}–${hi.toFixed(2)} m`, measure: { sourceVerified: false, why: 'built extent differs' } }
    return { measure: { sourceVerified: true, why: `${body.id} now ${lo.toFixed(2)}–${hi.toFixed(2)} m along ${ax} = the printed "${pr.literal}" (its line ${a[0].toFixed(2)}–${a[1].toFixed(2)} m on the plan)` } }
  }
  return { commands: e.cmds, transform: e.transform, allowed: e.allowed, expect: { kind: 'CUSTOM', measure }, record: rec }
}

// ---- BUILD_MASSING ----------------------------------------------------------------------------------------------

/** Evidence on the commands that create a body: the per-property fidelity from the hypothesis, one source per frame. */
function withEvidence(cmds: BuildingCommand[], b: BodySpec, frames: string[]): BuildingCommand[] {
  const pr = b.provenance
  const ev = (what: 'ring' | 'roof'): Evidence => ({
    status: STATUS_OF[(what === 'roof' ? pr.roof?.fidelity : pr.outline?.fidelity) ?? 'TRACE_UNCERTAIN'],
    source: frames.join(' + '),
    interpretation: what === 'roof' ? pr.roof?.why ?? '' : `${pr.outline?.why ?? ''}; heights: ${pr.height?.why ?? ''}`,
    properties: what === 'roof' ? { pitchDeg: STATUS_OF[pr.roof?.fidelity ?? 'TRACE_UNCERTAIN'], eaveOffset: STATUS_OF[pr.height?.fidelity ?? 'TRACE_UNCERTAIN'] } : { polygon: STATUS_OF[pr.outline?.fidelity ?? 'TRACE_UNCERTAIN'], height: STATUS_OF[pr.height?.fidelity ?? 'TRACE_UNCERTAIN'], thickness: STATUS_OF[pr.wallThickness?.fidelity ?? 'DISPLAY_ASSUMPTION'] },
    sourceIds: frames.map((fr) => `src-${fr}`),
  })
  return cmds.map((c) => (c.type === 'createWallRing' ? { ...c, evidence: ev('ring') } : c.type === 'createRoof' ? { ...c, evidence: ev('roof') } : c.type === 'createRoofPlane' ? ({ ...c, evidence: { ...ev('roof'), properties: { pitchDeg: STATUS_OF[pr.roof?.fidelity ?? 'TRACE_UNCERTAIN'], datum: STATUS_OF[pr.height?.fidelity ?? 'TRACE_UNCERTAIN'] } } } as BuildingCommand) : c))
}

/** ops 1.9.0: a reading's top agrees with the page's building height within this (the page measures from the ground, the model from its floor). */
export const PAGE_HEIGHT_AGREE = { m: 0.6, share: 0.1 } as const
/** ops 1.13.0: the registered views of one reading are at one scale within `same` (largest over smallest); they are not beyond `apart`. */
export const SCALE_AGREE = { same: 1.12, apart: 1.3 } as const

/**
 * ops 1.12.0: the hypothesis BUILD_MASSING takes from the observations — solved as labelled and turned by a quarter, the
 * reading the page's height fits (else the one whose views agree on more bodies) taken. One function for the executor and
 * for the offline replay of a recorded input (`record.massing.input`), so the two cannot disagree.
 */
export function massingHypothesisOf(obs: MassingObservations & { outline: NonNullable<MassingObservations['outline']> }, facts: { roofPitchDeg?: number; buildingHeightM?: number; structure?: BuildStructure } | undefined, ownFrame: boolean): { h: MassingHypothesis; turn: boolean } {
  // §6: the side each labelled elevation draws is a hypothesis of its own — solved as labelled and turned by 90°, the
  // reading whose views agree on every body's heights is taken (ties stay as labelled); the other is kept named
  const pitchFact = { ...(facts?.roofPitchDeg !== undefined ? { publishedPitchDeg: facts.roofPitchDeg } : {}), ...(facts?.buildingHeightM !== undefined ? { publishedHeightM: facts.buildingHeightM } : {}) }
  const agreeing = (x: MassingHypothesis): number => x.bodies.filter((b) => b.provenance.height?.fidelity === 'SOURCE_DERIVED').length
  const structureFact = facts?.structure ? { structure: facts.structure } : {}
  const wallsFact = { ...(obs.planWalls && obs.planWalls.length > 0 ? { planWalls: obs.planWalls } : {}), ...structureFact }
  const asLabelled = solveMassing({ outline: obs.outline, silhouettes: obs.silhouettes, ...pitchFact, ...wallsFact })
  // ops 1.7.0: the same quarter turn the orientation hypothesis takes (the plan's main entrance decides which), so the
  // views this body is built through carry the sides every later consumer reads them on
  // ops 1.8.0: a body built from the sources is built in the SOURCE's frame. Where the elevations are drawn a quarter
  // turn from the plan's sides, the plan outline is turned — rigidly — so that the side the front elevation draws is the
  // model's front, and every elevation is then read on the side its caption names: no turned mapping is carried through
  // the consumers, and the delivered model keeps its own frame's promise ("the front facade outer face is z = 0"). The
  // plan's main entrance says which end the front is; unmarked, the first turn stands as a convention.
  const planFront: Side = obs.entranceSide === TURN_BACK.FRONT ? 'LEFT' : 'RIGHT'
  // (a model that already has bodies keeps its frame: a body added to it is read through the turned side mapping, as before)
    const quarter = planFront === 'LEFT' ? TURN_BACK : TURN
  const frame0 = obs.outline.outline
  const turnedH = ownFrame ? solveMassing({ outline: { ...obs.outline, outline: outlineWithFront(obs.outline.outline, planFront) }, silhouettes: obs.silhouettes, ...pitchFact, ...structureFact, ...(obs.planWalls && obs.planWalls.length > 0 ? { planWalls: obs.planWalls.map((w) => ({ a: pointWithFront(w.a, planFront, frame0), b: pointWithFront(w.b, planFront, frame0) })) } : {}) }) : solveMassing({ outline: obs.outline, silhouettes: obs.silhouettes.map((q) => ({ ...q, side: quarter[q.side] })), ...pitchFact, ...wallsFact })
  // ops 1.9.0: which reading the page's own building height fits. The two readings put the same drawn heights over
  // different widths, so their ridges differ by the outline's aspect; where the page states the building's height and
  // exactly one reading's top agrees with it, that reading is taken — a fact from outside the drawings decides before
  // a count of agreeing views does (two views that agree with each other on the wrong width agree on the wrong height)
  const topOf = (x: MassingHypothesis): number | undefined => (x.status === 'BUILDABLE' && x.bodies.length > 0 ? Math.max(...x.bodies.map((b) => b.roof.ridgeM ?? b.roof.eavesM)) : undefined)
  const pageH = facts?.buildingHeightM
  const fits = (x: MassingHypothesis): boolean => { const t = topOf(x); return pageH !== undefined && t !== undefined && Math.abs(t - pageH) <= Math.max(PAGE_HEIGHT_AGREE.m, PAGE_HEIGHT_AGREE.share * pageH) }
  const byHeight = pageH !== undefined && fits(asLabelled) !== fits(turnedH) ? (fits(turnedH) ? 'TURNED' : 'LABELLED') : undefined
  // ops 1.13.0: which reading the DRAWINGS' OWN SCALES fit. Each registered view's scale is the body's extent on that side
  // over the drawn walls' width: read on the right sides, the elevations of one house come out at one scale (they are one
  // set of drawings); read a quarter turn off, the front and rear are stretched over the side's length and the sides over
  // the front's, and the scales part by the outline's aspect. Where one reading's views agree in scale (within
  // `SCALE_AGREE.same`) and the other's differ (beyond `SCALE_AGREE.apart`), on views of BOTH directions, the agreeing
  // reading is taken — after the page's height (a fact from outside the drawings), before a count of agreeing heights
  // (two views stretched alike agree with each other). A near-square outline has no such difference and decides nothing.
  const scaleSpread = (x: MassingHypothesis): number | undefined => {
    const vs = x.status === 'BUILDABLE' ? x.views.filter((v) => Number.isFinite(v.projection.mpp) && v.projection.mpp > 0) : []
    const alongX = vs.filter((v) => v.side === 'FRONT' || v.side === 'REAR')
    const alongZ = vs.filter((v) => v.side === 'LEFT' || v.side === 'RIGHT')
    if (alongX.length === 0 || alongZ.length === 0 || vs.length < 3) return undefined
    return Math.max(...vs.map((v) => v.projection.mpp)) / Math.min(...vs.map((v) => v.projection.mpp))
  }
  const [sL, sT] = [scaleSpread(asLabelled), scaleSpread(turnedH)]
  const byScale = !byHeight && sL !== undefined && sT !== undefined && Math.min(sL, sT) <= SCALE_AGREE.same && Math.max(sL, sT) >= SCALE_AGREE.apart ? (sT < sL ? 'TURNED' : 'LABELLED') : undefined
  const turn = byHeight ? byHeight === 'TURNED' : byScale ? byScale === 'TURNED' : agreeing(turnedH) > agreeing(asLabelled)
  const scaleNote = sL !== undefined && sT !== undefined ? [`the drawings' scales: as labelled the registered views differ by a factor of ${sL.toFixed(2)}, turned by 90° by ${sT.toFixed(2)}${byScale ? ` — the reading whose views share one scale is taken (${byScale === 'TURNED' ? 'turned by 90°' : 'as labelled'})` : byHeight ? ' (the page\'s height decided)' : ' (no decision: both alike, or neither one scale)'}`] : []
  const heightNote = byHeight ? [`the page states the building ${pageH} m high: ${byHeight === 'TURNED' ? 'turned by 90°' : 'as labelled'} the top stands at ${(topOf(byHeight === 'TURNED' ? turnedH : asLabelled) as number).toFixed(2)} m, ${byHeight === 'TURNED' ? 'as labelled' : 'turned by 90°'} at ${topOf(byHeight === 'TURNED' ? asLabelled : turnedH)?.toFixed(2) ?? 'no'} m — the reading the page's height fits is taken (heights agreeing: ${agreeing(asLabelled)} as labelled, ${agreeing(turnedH)} turned)`] : []
  const h: MassingHypothesis = turn && !ownFrame ? { ...turnedH, alternatives: [...turnedH.alternatives, `the elevations draw the model's sides turned by 90° from their labels: ${agreeing(turnedH)} body/bodies' heights agree so against ${agreeing(asLabelled)} as labelled (the labelled reading is kept as an alternative)`] } : turn ? { ...turnedH, planFront, alternatives: [...turnedH.alternatives, `the body is built in the elevations' frame, the plan sheet's ${planFront.toLowerCase()} side as its front (${obs.entranceSide === undefined ? 'which end is a convention: the plan read marks no main entrance' : obs.entranceSide === planFront ? 'the plan marks its main entrance there' : `the plan marks its main entrance on its ${obs.entranceSide.toLowerCase()} side, where neither quarter turn puts the front: a convention`}) — the elevations draw the plan's sides turned by 90° from their labels: ${agreeing(turnedH)} body/bodies' heights agree so against ${agreeing(asLabelled)} as labelled (the labelled reading is kept as an alternative)`] } : { ...asLabelled, alternatives: [...asLabelled.alternatives, ...(agreeing(turnedH) === agreeing(asLabelled) && turnedH.status === 'BUILDABLE' ? [`turned by 90° the elevations agree as well (${agreeing(turnedH)} body/bodies): the labels are kept`] : [])] }
  if (heightNote.length > 0) h.alternatives = [...h.alternatives, ...heightNote]
  if (scaleNote.length > 0) h.alternatives = [...h.alternatives, ...scaleNote]
  return { h, turn }
}

export function bindBuildMassing(ctx: Ctx, p: CorrectionProposal): Bound | Refusal {
  const m = ctx.model
  const obs = ctx.massing
  if (!obs?.outline) return { status: 'NEEDS_EVIDENCE', code: 'NO_OUTLINE', why: 'BUILD_MASSING needs the plan outline (a plan frame read at a measured scale, or the walls of a model): none was observed' }
  const ownFrame = !bodiesOf(m).some((b) => b.ringIds.length > 0)
  const { h, turn } = massingHypothesisOf({ ...obs, outline: obs.outline }, ctx.facts, ownFrame)
  // ops 1.12.0: the observations the hypothesis was solved from are part of the record — the body can be solved again
  // offline from the record alone (a failed or a disputed body is reproduced without buying its readings a second time)
  const input = { outline: obs.outline, silhouettes: obs.silhouettes, ...(obs.planWalls ? { planWalls: obs.planWalls } : {}), ...(obs.entranceSide ? { entranceSide: obs.entranceSide } : {}), facts: { ...(ctx.facts?.roofPitchDeg !== undefined ? { roofPitchDeg: ctx.facts.roofPitchDeg } : {}), ...(ctx.facts?.buildingHeightM !== undefined ? { buildingHeightM: ctx.facts.buildingHeightM } : {}), ...(ctx.facts?.structure ? { structure: ctx.facts.structure } : {}) }, ownFrame, taken: turn ? 'TURNED_90' : 'AS_LABELLED' }
  const record = { massing: { version: MASSING_OPS_VERSION, hypothesis: h, input } as Record<string, unknown>, ...(obs.outline.frameId ? { source: { frameId: obs.outline.frameId, sourceByteHash: obs.outline.sourceByteHash } } : {}) }
  if (h.status !== 'BUILDABLE') return { status: h.status === 'UNSUPPORTED_FORM' ? 'UNSUPPORTED_OPERATION' : 'NEEDS_EVIDENCE', code: h.status === 'UNSUPPORTED_FORM' ? 'MASSING_UNSUPPORTED_FORM' : 'MASSING_MISSING_ANCHORS', why: `${h.why}; missing: ${h.missing.map((x) => `${x.anchor} (${x.why})`).join('; ') || 'none'}`, record }
  const existing = bodiesOf(m).filter((b) => b.ringIds.length > 0)
  const iouR = (a: Rect, b: Rect): number => {
    const ix = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX))
    const iz = Math.max(0, Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ))
    return (ix * iz) / (area(a) + area(b) - ix * iz)
  }
  const missing = h.bodies.filter((b) => existing.every((e) => iouR(e.rect, b.rect) < 0.5))
  const partial = missing.filter((b) => existing.some((e) => iouR(e.rect, b.rect) > 0.05))
  if (partial.length > 0) return { status: 'UNSUPPORTED_OPERATION', code: 'PARTIAL_OVERLAP', why: `${partial.map((b) => b.id).join(', ')} overlap a body the model has: that is a change of its outline (SET_OUTLINE), not a missing body`, record }
  if (missing.length === 0) return { status: 'INVALID', code: 'BODIES_PRESENT', why: `every body of the hypothesis (${h.bodies.map((b) => b.id).join(', ')}) is in the model already`, record }
  const frames = [...new Set([obs.outline.frameId, ...h.views.map((v) => v.frameId)])].filter(Boolean)
  const sources = frames.filter((fr) => !m.evidenceSources.some((s) => s.id === `src-${fr}`)).map((fr) => ({ type: 'addEvidenceSource', id: `src-${fr}`, kind: 'DRAWING', label: fr, note: `frame ${fr}` }) as BuildingCommand)
  let cmds: BuildingCommand[]
  if (existing.length === 0) {
    const partH = { ...h, bodies: missing }
    cmds = massingCommands(partH, m)
    // ops 1.13.0: the roof system's statements are tried on the kernel BEFORE they are proposed. A system the kernel
    // refuses (a plane it cannot bound, an edge off its planes) must not cost the house its body: the roofs are then built
    // apart, as before this stage, and the refusal is carried on the hypothesis as a BUILD_ERROR — named in the record,
    // in ROOF_SYSTEM and in the feature trace, never silent
    if (joinedBodiesOf(roofSystemOf(partH)).size > 0) {
      const dry = applyCommands(m, [...sources, ...cmds])
      const bad = dry.failedAt !== undefined ? `command ${dry.failedAt} (${(cmds[dry.failedAt - sources.length] as { type?: string; id?: string } | undefined)?.type ?? '?'} ${(cmds[dry.failedAt - sources.length] as { id?: string } | undefined)?.id ?? ''}): ${JSON.stringify(dry.results[dry.failedAt]).slice(0, 300)}` : !validateModel(dry.model).ok ? `the candidate does not validate: ${JSON.stringify(validateModel(dry.model)).slice(0, 300)}` : undefined
      if (bad) { h.roofBuildError = `the kernel refused the roof system (${bad}); the roofs are built apart`; cmds = massingCommands(partH, m, { apart: true }) }
    }
    cmds = cmds.flatMap((c) => (c.type === 'createWallRing' || c.type === 'createRoof' || c.type === 'createRoofPlane' ? withEvidence([c], missing.find((b) => c.id === `ring-${b.id}` || c.id === `roof-${b.id}` || (c.id ?? '').startsWith(`roof-${b.id}-`)) as BodySpec, frames) : [c]))
  } else {
    const lv = [...m.levels].sort((a, b) => a.elevation - b.elevation)[0]
    const rects = [...existing.map((e) => e.rect), ...missing.map((b) => b.rect)]
    cmds = missing.flatMap((b) => withEvidence(bodyCommands(b, lv.id, lv.elevation, rects.filter((r) => r !== b.rect), h.wallThicknessM), b, frames))
  }
  cmds = [...sources, ...cmds]
  // ops 1.12.0: a body under the roof system has its planes cut by the others' (a slope in two pieces is `-<side>-<n>`), a cross gable its own planes, and the system its creases, free edges and one ROOF assembly
  const sol = roofSystemOf(h)
  const joined = h.roofBuildError ? new Set<string>() : joinedBodiesOf(sol)
  const allowed = [...missing.flatMap((b) => [`walls:ring-${b.id}*`, `wallRings:ring-${b.id}`, `wallJunctions:ring-${b.id}*`, `roofs:roof-${b.id}`, ...HIP_PLANE_SIDES.map((sd) => `roofPlanes:roof-${b.id}-${sd}`), ...(joined.has(b.id) ? [`roofPlanes:roof-${b.id}-*`] : [])]), ...(joined.size > 0 ? ['roofEdges:*', `assemblies:${ROOF_SYSTEM_ID}`] : []), 'evidenceSources:src-*', 'levels:*', 'materials:mat-*', ...(m.building ? [] : ['building', 'building:*'])]
  const viewsUsed = h.views
  const measure = (working: CanonicalBuildingModel, _b: CanonicalBuildingModel, pictures: readonly BindPicture[]): { failure?: string; measure: { sourceVerified: boolean | null; why: string } } => {
    const built = bodiesOf(working)
    const lines: string[] = []
    let verified: boolean | null = true
    for (const b of missing) {
      const nb = built.find((q) => q.id === `ring-${b.id}`)
      if (!nb || (joined.has(b.id) ? nb.planeIds.length < 2 : b.roof.kind === 'HIP' ? nb.planeIds.length !== HIP_PLANE_SIDES.length : nb.roofIds.length !== 1)) return { failure: `${b.id} was not built as a walled body with its roof`, measure: { sourceVerified: false, why: `${b.id} missing in the candidate` } }
      let yes = 0
      let no = 0
      for (const v of viewsUsed) {
        const src = pictures.find((q) => q.frameId === v.frameId)
        if (!src) continue
        const back = drawnBack(src.raster, modelBody(working, nb, v), others(working, built, nb, v), v.projection.zeroRow)
        lines.push(`${b.id} on ${v.side.toLowerCase()}: ${back.why}`)
        if (back.verified === true) yes += 1
        if (back.verified === false) no += 1
      }
      // a body is verified when two elevations draw it and none contradicts it
      if (no > 0) verified = false
      else if (yes < 2 && verified !== false) verified = null
    }
    return { measure: { sourceVerified: verified, why: `${missing.length} body/bodies built (${missing.map((b) => b.id).join(', ')}); ${lines.join('; ') || 'no source raster to draw them back into'}` } }
  }
  return { commands: cmds, allowed, expect: { kind: 'CUSTOM', measure }, record: { ...record, bound: { frameId: obs.outline.frameId, ids: missing.map((b) => b.id), values: Object.fromEntries(missing.flatMap((b) => [[`${b.id}.eavesM`, b.roof.eavesM], ...(b.roof.ridgeM ? [[`${b.id}.ridgeM`, b.roof.ridgeM]] : [])])) } }, views: viewsUsed }
}

// ---- the sketch channel's body/roof proposals -------------------------------------------------------------------

export type SketchForMassing = { facade: string; frameId: string; groundRow: number | null; walls: Poly[]; roofs: Poly[] }
export type MassingProposalAccount = { frameId: string; side?: Side; proposed: Array<{ bodyId: string; why: string }>; skipped: Array<{ bodyId?: string; why: string }> }
/** v3.54.17 §6 / R2: which model side each labelled elevation draws, decided per body by the heights its views agree on. */
export type OrientationHypothesis = {
  assignment: 'AS_LABELLED' | 'TURNED_90' | 'UNDECIDED'
  /** Every body's eaves as each view reads it over the body's own (exclusive) stretch, labelled and turned (R2). */
  labelled: { eavesM: number[]; spreadM: number | null }
  turned: { eavesM: number[]; spreadM: number | null }
  perBody?: Array<{ bodyId: string; labelled: Array<{ frameId: string; side: Side; eavesM: number; wallTopM?: number }>; turned: Array<{ frameId: string; side: Side; eavesM: number; wallTopM?: number }>; hidden: Array<{ frameId: string; side: Side; why: string }>; agreesLabelled: boolean | null; agreesTurned: boolean | null }>
  /** The bodies whose views agree under the assignment used (UNDECIDED: as labelled) — the only ones a roof proposal may touch. */
  confirmed?: string[]
  /** The side each elevation is read as, the ONE mapping every consumer of the sketches uses (roofs and openings). */
  sideOf?: Record<string, Side>
  /** TURNED_90 only: which gable end the front elevation draws (the plan's main entrance decides; else the first turn, a convention). */
  turn?: 'FRONT_ON_RIGHT' | 'FRONT_ON_LEFT'
  why: string
}
const TURN: Record<Side, Side> = { FRONT: 'RIGHT', RIGHT: 'REAR', REAR: 'LEFT', LEFT: 'FRONT' }
/** The other quarter turn: heights cannot tell the two apart (they differ by which end of the house the front elevation draws). */
const TURN_BACK: Record<Side, Side> = { FRONT: 'LEFT', LEFT: 'REAR', REAR: 'RIGHT', RIGHT: 'FRONT' }
/** What does not come from the elevations and may decide what their heights cannot. */
export type OrientationHints = { /** the side of the plan its main entrance is marked on (the plan read) */ entranceSide?: Side; /** ops 1.9.0: the building's height the page states (metres) */ buildingHeightM?: number }
/** Whether a body stands in front of every other body whose stretch it shares on this side (its face nearer the viewer). */
function inFront(r: Rect, others: readonly Rect[], s: Side): boolean {
  const e = extentOn(r, s)
  const face = (q: Rect): number => (s === 'FRONT' ? -q.minZ : s === 'REAR' ? q.maxZ : s === 'LEFT' ? -q.minX : q.maxX)
  return others.filter((o) => { const c = extentOn(o, s); return Math.min(e.hi, c.hi) - Math.max(e.lo, c.lo) > 1e-6 }).every((o) => face(r) > face(o) + 1e-6)
}

/**
 * The sides the sketches draw, held against the model's plan, PER BODY (R2): each elevation is registered by the house's
 * whole extent on the side it is read as; each body's eaves is then read over the stretch only it occupies on that side
 * (a body in front of or behind another is not read where they overlap — the lower garage is never compared with the
 * main roof drawn behind it). A body's views agree or not; the assignment is AS_LABELLED when every body read twice
 * agrees as labelled, TURNED_90 when they do not and every one agrees turned, else UNDECIDED — and then the bodies that
 * do agree as labelled stay confirmed: an uncertain fragment does not block an independent, well-confirmed one.
 * Different eaves of different bodies are never evidence of a turn. The turn never moves a wall.
 */
export function orientationOf(sketches: readonly SketchForMassing[], m: CanonicalBuildingModel, sideOf: (facade: string) => Side | undefined, hints: OrientationHints = {}): OrientationHypothesis {
  const bodies = bodiesOf(m).filter((b) => b.ringIds.length > 0)
  type Read = { frameId: string; side: Side; eavesM: number; wallTopM?: number; shape?: string; topM?: number; stretchM?: number }
  const per = new Map(bodies.map((b) => [b.id, { labelled: [] as Read[], turned: [] as Read[], hidden: [] as Array<{ frameId: string; side: Side; why: string }> }]))
  for (const turn of [false, true]) {
    for (const s of sketches) {
      const lab = sideOf(s.facade)
      if (!lab || s.groundRow === null || s.walls.length === 0 || s.roofs.length === 0 || bodies.length === 0) continue
      const side = turn ? (hints.entranceSide === TURN_BACK.FRONT ? TURN_BACK[lab] : TURN[lab]) : lab
      const all = bodies.map((q) => extentOn(q.rect, side))
      const ext = { lo: Math.min(...all.map((e) => e.lo)), hi: Math.max(...all.map((e) => e.hi)) }
      const r = registerByPlan({ observationId: 'o', side, frameId: s.frameId, sourceByteHash: '', groundRow: s.groundRow, walls: s.walls, roofs: s.roofs }, ext)
      if (!('view' in r)) continue
      for (const b of bodies) {
        const others = bodies.filter((q) => q !== b)
        // where it stands alone on this side; else, when it stands in FRONT of every body sharing its stretch, the whole
        // stretch with only the roofs no wider than it (a taller roof behind, wider than the body, is not its own)
        const alone = readableStretch(b.rect, others.map((q) => q.rect), side)
        const front = !alone && inFront(b.rect, others.map((q) => q.rect), side) ? extentOn(b.rect, side) : undefined
        const st = alone ?? front
        if (!st) {
          if (!turn) per.get(b.id)?.hidden.push({ frameId: s.frameId, side, why: `on the ${side.toLowerCase()} side ${b.id}'s stretch is shared with a body in front of it: hidden or not told apart, not read` })
          continue
        }
        const roofs = front ? s.roofs.filter((poly) => { const xs = poly.map((q) => q[0]); const w = (Math.max(...xs) - Math.min(...xs)) * r.view.projection.mpp; return w <= st.hi - st.lo + 2 * MAX_OVERHANG_M }) : s.roofs
        const prof = profileOver(r.view, st.lo, st.hi, { walls: [], roofs })
        // v3.54.18 (ops 1.5.0): the SAME physical line in every view — the top of the drawn walls at the body's outer
        // corners (the wall plate under the soffit). The roof's own lower edge is not that line: a gable view draws the
        // verge as a band along the slope, an eaves view draws the dripping edge an overhang carries lower, and the two
        // differ by the band's thickness and the overhang's fall (Ballina live: 3.26 / 3.28 m against 2.91 / 2.86 m for
        // walls that end at 2.9 m in all four drawings). Where a view draws no wall corner there, the roof's edge stays.
        const own = extentOn(b.rect, side) // the body's own ends (the readable stretch is drawn in from them)
        const wt = wallCornerTopM(r.view, own.lo, own.hi, s.walls, s.groundRow)
        const wallTopM = wt !== undefined ? Math.round(wt * 100) / 100 : undefined
        if (prof && prof.shape !== 'NONE') per.get(b.id)?.[turn ? 'turned' : 'labelled'].push({ frameId: s.frameId, side, eavesM: Math.round(prof.eavesM * 100) / 100, ...(wallTopM !== undefined ? { wallTopM } : {}), shape: prof.shape, topM: Math.round(prof.topM * 100) / 100, stretchM: Math.round((own.hi - own.lo) * 100) / 100 })
      }
    }
  }
  const agree = (v: Read[]): boolean | null => {
    if (v.length < 2) return null
    // the walls' corner tops when every view of this body draws them (one line in all views); else the roofs' edges
    const walls = v.every((x) => x.wallTopM !== undefined)
    const e = walls ? v.map((x) => x.wallTopM as number) : v.map((x) => x.eavesM)
    const tol = Math.max(MASSING_TOLERANCES.heightAgreeM, MASSING_TOLERANCES.heightAgreeShare * Math.max(...e))
    if (Math.max(...e) - Math.min(...e) <= tol) return true
    // ops 1.7.0: the wall's top is not one drawn line in every view after all. A view of the gable END sees the wall's
    // corner run up to the roof's underside; a view ALONG the ridge sees the fascia and a boxed soffit in front of it
    // and draws its walls ending lower — by no more than the overhang's fall at the pitch the gable end draws. Views
    // that differ so are the same body seen from its two kinds of side, not a turned assignment (a house whose side
    // gable was finally read drew its walls to 3.17 m there and to 2.53 / 2.70 m under its eaves: "undecided").
    if (!walls) return false
    const ends = v.filter((x) => x.shape === 'TRIANGLE')
    const sides = v.filter((x) => x.shape !== 'TRIANGLE')
    if (ends.length === 0 || sides.length === 0) return false
    const endTops = ends.map((x) => x.wallTopM as number)
    if (Math.max(...endTops) - Math.min(...endTops) > tol) return false
    const endTop = endTops.reduce((a, q) => a + q, 0) / endTops.length
    const fall = Math.max(...ends.map((x) => (MAX_OVERHANG_M * Math.max(0, (x.topM ?? endTop) - endTop)) / Math.max(0.5, (x.stretchM ?? 1) / 2)))
    return sides.every((x) => (x.wallTopM as number) <= endTop + tol && (x.wallTopM as number) >= endTop - fall - tol)
  }
  // ops 1.7.0: a turn is evidenced only by views on BOTH axes of a body. Two opposite sides (front and rear) are scaled
  // by the same plan extent under either assignment, so the ratio of their heights is the same turned or not — and with
  // a tolerance in metres, turning onto the shorter side shrinks any disagreement under it (a garage read 2.62 / 2.14 m
  // as labelled, by two different ground rows, "agreed" at 1.65 / 1.35 m turned). Such a pair says nothing about the turn.
  const twoAxes = (v: Read[]): boolean => new Set(v.map((x) => along(x.side))).size === 2
  const perBody = bodies.map((b) => { const q = per.get(b.id) as { labelled: Read[]; turned: Read[]; hidden: Array<{ frameId: string; side: Side; why: string }> }; return { bodyId: b.id, labelled: q.labelled, turned: q.turned, hidden: q.hidden, agreesLabelled: agree(q.labelled), agreesTurned: twoAxes(q.turned) ? agree(q.turned) : null } })
  const flat = (k: 'labelled' | 'turned'): number[] => perBody.flatMap((b) => b[k].map((x) => x.eavesM))
  const spread = (v: number[]): number | null => (v.length >= 2 ? Math.round((Math.max(...v) - Math.min(...v)) * 100) / 100 : null)
  const judged = (k: 'agreesLabelled' | 'agreesTurned') => perBody.filter((b) => b[k] !== null)
  const allAgree = (k: 'agreesLabelled' | 'agreesTurned'): boolean => judged(k).length > 0 && judged(k).every((b) => b[k] === true)
  const describe = (k: 'labelled' | 'turned'): string => perBody.filter((b) => b[k].length > 0).map((b) => (b[k].every((x) => x.wallTopM !== undefined) ? `${b.bodyId} wall tops ${b[k].map((x) => x.wallTopM).join('/')} m` : `${b.bodyId} ${b[k].map((x) => x.eavesM).join('/')} m`)).join('; ') || 'none'
  // ops 1.7.0: WHICH quarter turn. The heights that show the elevations are turned are the same for both turns — they
  // differ by which END of the house the front elevation draws. The plan says it where it marks its main entrance: the
  // elevation labelled FRONT is the entrance side. Marked on the model's left side, the turn is the other one; marked
  // nowhere, or on a side neither turn puts the front on, the first turn stands as a convention (named either way).
  const back = hints.entranceSide === TURN_BACK.FRONT
  const turnWhy = hints.entranceSide === undefined ? 'which of the two quarter turns is a convention: the plan read marks no main entrance' : hints.entranceSide === TURN.FRONT || back ? `the plan marks its main entrance on the ${hints.entranceSide.toLowerCase()} side: the front elevation draws that side` : `the plan marks its main entrance on the ${hints.entranceSide.toLowerCase()} side, where neither quarter turn puts the front elevation: the first turn stands as a convention`
  const mapping = (turn: boolean): Record<string, Side> => Object.fromEntries(sketches.flatMap((s) => { const lab = sideOf(s.facade); return lab ? [[s.frameId, turn ? (back ? TURN_BACK[lab] : TURN[lab]) : lab]] : [] }))
  const base = { labelled: { eavesM: flat('labelled'), spreadM: spread(flat('labelled')) }, turned: { eavesM: flat('turned'), spreadM: spread(flat('turned')) }, perBody }
  // ops 1.9.0: the page's building height before any count of agreeing views (see bindBuildMassing): the two assignments
  // put the same drawn tops over different widths; where exactly one of them puts the house's top at the height the page
  // states, that one is the assignment
  const pageH = hints.buildingHeightM
  if (pageH !== undefined) {
    const mid = (v: number[]): number | undefined => { if (v.length === 0) return undefined; const q = [...v].sort((x, y) => x - y); return (q[Math.floor((q.length - 1) / 2)] + q[Math.ceil((q.length - 1) / 2)]) / 2 }
    const topUnder = (k: 'labelled' | 'turned'): number | undefined => { const tops = perBody.map((b) => mid(b[k].map((x) => x.topM).filter((t): t is number => t !== undefined))).filter((t): t is number => t !== undefined); return tops.length > 0 ? Math.max(...tops) : undefined }
    const [tl, tt] = [topUnder('labelled'), topUnder('turned')]
    const fit = (t: number | undefined): boolean => t !== undefined && Math.abs(t - pageH) <= Math.max(PAGE_HEIGHT_AGREE.m, PAGE_HEIGHT_AGREE.share * pageH)
    if (fit(tl) !== fit(tt) && twoAxes(perBody.flatMap((b) => b.turned))) {
      const why = `the page states the building ${pageH} m high: as labelled the drawn top stands at ${tl?.toFixed(2) ?? 'no'} m, turned by 90° at ${tt?.toFixed(2) ?? 'no'} m — the assignment the page's height fits is taken (as labelled: ${describe('labelled')}; turned: ${describe('turned')})`
      if (fit(tl)) return { ...base, assignment: 'AS_LABELLED', confirmed: perBody.filter((b) => b.agreesLabelled).map((b) => b.bodyId), sideOf: mapping(false), why }
      return { ...base, assignment: 'TURNED_90', confirmed: perBody.filter((b) => b.agreesTurned).map((b) => b.bodyId), sideOf: mapping(true), why: `${why}; ${turnWhy}`, turn: back ? 'FRONT_ON_LEFT' : 'FRONT_ON_RIGHT' }
    }
  }
  if (judged('agreesLabelled').length === 0) return { ...base, assignment: 'AS_LABELLED', confirmed: [], sideOf: mapping(false), why: `no body is read by two views (${describe('labelled')}): read as labelled, nothing confirmed by agreement` }
  if (allAgree('agreesLabelled')) return { ...base, assignment: 'AS_LABELLED', confirmed: perBody.filter((b) => b.agreesLabelled).map((b) => b.bodyId), sideOf: mapping(false), why: `each body's views agree as labelled (${describe('labelled')})` }
  if (allAgree('agreesTurned')) return { ...base, assignment: 'TURNED_90', confirmed: perBody.filter((b) => b.agreesTurned).map((b) => b.bodyId), sideOf: mapping(true), why: `as labelled the views disagree on a body (${describe('labelled')}); turned by 90° every body's views agree (${describe('turned')}): the elevations draw the model's sides turned — read so for every consumer, named, no wall moved; ${turnWhy}`, turn: back ? 'FRONT_ON_LEFT' : 'FRONT_ON_RIGHT' }
  const ok = perBody.filter((b) => b.agreesLabelled === true).map((b) => b.bodyId)
  if (perBody.filter((b) => b.agreesLabelled === false).every((b) => !twoAxes(b.labelled))) return { ...base, assignment: 'AS_LABELLED', confirmed: ok, sideOf: mapping(false), why: `the views that disagree on a body (${describe('labelled')}) stand on one axis of it: opposite sides scale alike under a turn, so their disagreement is a reading of the height, not evidence about the sides — read as labelled${ok.length > 0 ? `; ${ok.join(', ')} confirmed by agreement` : ', nothing confirmed'}` }
  return { ...base, assignment: 'UNDECIDED', confirmed: ok, sideOf: mapping(false), why: `neither as labelled (${describe('labelled')}) nor turned (${describe('turned')}) does every body's pair of views agree; ${ok.length > 0 ? `${ok.join(', ')} agree as labelled and stay confirmed` : 'no body is confirmed'}` }
}

/**
 * Each elevation sketch, held against each body of the model: where the body has no roof, or its roof's form, ridge
 * direction or outline disagree with what the sketch draws over it, one SET_ROOF proposal with the sketch's own roof
 * polygon (frame pixels) — and, where the analyzer did not register that elevation with heights, the sketch's wall ends
 * and ground row so the executor registers it by the body's plan extent. The executor's gate decides; this only asks.
 * One proposal per body (the elevation that shows its roof form most clearly), never two on one body.
 */
export function roofProposalsFromSketches(sketches: readonly SketchForMassing[], m: CanonicalBuildingModel, views: readonly BindView[], rev: string, sideOf: (facade: string) => Side | undefined, hints: OrientationHints = {}): { proposals: CorrectionProposal[]; accounts: MassingProposalAccount[]; orientation: OrientationHypothesis } {
  const bodies = bodiesOf(m).filter((b) => b.wallIds.length > 0 && rectangular(m, b))
  const best = new Map<string, { score: number; p: CorrectionProposal }>()
  const accounts: MassingProposalAccount[] = []
  const orientation = orientationOf(sketches, m, sideOf, hints)
  // R2: UNDECIDED blocks only the bodies whose views disagree; the confirmed ones are proposed for, as labelled
  const turned = orientation.assignment === 'TURNED_90'
  const allowed = (id: string): boolean => orientation.assignment !== 'UNDECIDED' || (orientation.confirmed ?? []).includes(id)
  for (const s of sketches) {
    const lab = sideOf(s.facade)
    const side = orientation.sideOf?.[s.frameId] ?? (lab ? (turned ? TURN[lab] : lab) : undefined)
    const acc: MassingProposalAccount = { frameId: s.frameId, ...(side ? { side } : {}), proposed: [], skipped: [] }
    accounts.push(acc)
    if (!side) {
      acc.skipped.push({ why: `${s.facade} is not a side of the model` })
      continue
    }
    if (s.roofs.length === 0 || s.groundRow === null) {
      acc.skipped.push({ why: s.roofs.length === 0 ? 'the sketch draws no roof surface' : 'the sketch names no ground row' })
      continue
    }
    const xs = s.walls.flatMap((w) => w.map((q) => q[0]))
    // a registration the analyzer made is used only where the sides are as labelled (the turn is not its hypothesis)
    const reg = turned ? undefined : views.find((v) => v.frameId === s.frameId && (v.heights || v.roofAnchored))
    for (const b of bodies) {
      if (!allowed(b.id)) {
        acc.skipped.push({ bodyId: b.id, why: `ORIENTATION_UNDECIDED for ${b.id}: ${orientation.why}` })
        continue
      }
      // R2: only the stretch this body alone occupies on this side is read (a body in front of or behind another is not)
      const own = readableStretch(b.rect, bodies.filter((q) => q !== b).map((q) => q.rect), side)
      if (!own) {
        acc.skipped.push({ bodyId: b.id, why: `BODY_HIDDEN_ON_SIDE: on the ${side.toLowerCase()} side ${b.id}'s stretch is shared with another body (hidden, or not told apart)` })
        continue
      }
      const view = reg ?? (xs.length > 0 ? (() => {
        // the whole house's walls in the sketch against the model's whole extent on that side (the body's own may be hidden)
        const all = bodies.map((q) => extentOn(q.rect, side))
        const r = registerByPlan({ observationId: `sk-${s.frameId}`, side, frameId: s.frameId, sourceByteHash: '', groundRow: s.groundRow, walls: s.walls, roofs: s.roofs }, { lo: Math.min(...all.map((e) => e.lo)), hi: Math.max(...all.map((e) => e.hi)) })
        return 'view' in r ? r.view : undefined
      })() : undefined)
      if (!view) {
        acc.skipped.push({ bodyId: b.id, why: 'the elevation is not registered with heights and its walls cannot register it by the plan' })
        continue
      }
      const e = own
      const x0 = Math.min(pxOf(view.projection, e.lo), pxOf(view.projection, e.hi))
      const x1 = Math.max(pxOf(view.projection, e.lo), pxOf(view.projection, e.hi))
      // the sketch's roof surfaces over this body: the one that covers most of its stretch
      // v3.54.17 R3: the roof's width is held against the body's WHOLE extent on this side (the readable stretch is only
      // the part no other body stands before; a main roof over a porch is not "twice as wide" as its body)
      const full = extentOn(b.rect, side)
      const f0 = Math.min(pxOf(view.projection, full.lo), pxOf(view.projection, full.hi))
      const f1 = Math.max(pxOf(view.projection, full.lo), pxOf(view.projection, full.hi))
      const over = s.roofs.map((r) => {
        const rx = r.map((q) => q[0])
        const inter = Math.max(0, Math.min(x1, Math.max(...rx)) - Math.max(x0, Math.min(...rx)))
        return { r, share: inter / Math.max(1, x1 - x0), union: (Math.max(f1, Math.max(...rx)) - Math.min(f0, Math.min(...rx))) / Math.max(1, f1 - f0) }
      }).filter((q) => q.share > 0.6 && q.union < 1.4).sort((a, c) => c.share - a.share)
      if (over.length === 0) {
        acc.skipped.push({ bodyId: b.id, why: 'no roof surface of the sketch spans this body on this side' })
        continue
      }
      const poly = over[0].r
      const prof = profileOver(view, e.lo, e.hi, { walls: [], roofs: [poly] })
      if (!prof) {
        acc.skipped.push({ bodyId: b.id, why: 'the roof does not stand over the body' })
        continue
      }
      // ops 1.7.0: a trapezoid whose top ends stand in from the body's end walls is a hip seen along its ridge
      const hipRun = prof.shape === 'TRAPEZOID' && prof.ridge ? ((prof.ridge.lo - full.lo) + (full.hi - prof.ridge.hi)) / 2 : undefined
      if (prof.shape === 'TRAPEZOID' && !(hipRun !== undefined && hipRun >= MASSING_TOLERANCES.minHipRunM)) {
        acc.skipped.push({ bodyId: b.id, why: 'the sketch draws a trapezoid whose top does not stand in from the body\'s end walls: neither a gable\'s slope nor a hip read here' })
        continue
      }
      const isHip = (q: ModelBody): boolean => q.roofIds.length === 0 && q.planeIds.length === HIP_PLANE_SIDES.length && HIP_PLANE_SIDES.every((sd) => q.planeIds.some((id) => id.endsWith(`-${sd}`)))
      const curKind = m.roofs.find((r) => b.roofIds.includes(r.id))?.kind ?? (isHip(b) ? 'HIP' : b.planeIds.length > 0 ? 'PLANES' : 'NONE')
      // a hip END draws a triangle, as a gable end does: on that view the two are one form (the outline and the top decide)
      const kind: 'GABLE' | 'FLAT' | 'HIP' = prof.topM - prof.eavesM < MASSING_TOLERANCES.flatRiseM ? 'FLAT' : prof.shape === 'TRAPEZOID' || (prof.shape === 'TRIANGLE' && curKind === 'HIP') ? 'HIP' : 'GABLE'
      const current = bodyRoofSilhouette(m, b, view)
      const ov = current ? polygonIou(current, poly) : 0
      // v3.54.17 R3: the roof's top is a height of its own — a ridge drawn 0.6 m above the model's is a different roof even
      // where the two outlines overlap well (the shared tolerance of two views on one height decides)
      const topOf = (q: Poly): number => (view.projection.zeroRow - Math.min(...q.map((t) => t[1]))) * (view.projection.mppV ?? view.projection.mpp)
      const modelTop = current ? topOf(current) : undefined
      const topGap = modelTop !== undefined && kind === 'GABLE' ? prof.topM - modelTop : 0
      const topDisagrees = Math.abs(topGap) > Math.max(MASSING_TOLERANCES.heightAgreeM, MASSING_TOLERANCES.heightAgreeShare * prof.topM)
      const disagree = !current ? 'the body has no roof' : curKind !== kind && curKind !== 'PLANES' ? `the model's roof is ${curKind}, the sketch draws ${kind}` : topDisagrees ? `the drawn roof's top is ${prof.topM.toFixed(2)} m, the model's ${(modelTop as number).toFixed(2)} m (${topGap > 0 ? '+' : ''}${topGap.toFixed(2)} m)` : ov < 0.6 ? `the model's roof and the drawn one overlap ${ov.toFixed(2)}` : undefined
      if (!disagree) {
        acc.skipped.push({ bodyId: b.id, why: `the drawn roof agrees with the model's (${kind}, overlap ${ov.toFixed(2)})` })
        continue
      }
      // v3.54.18: where the drawn walls end at this body's corners (the eaves at the wall), as a row of this frame
      // (the body's OWN ends — `full`; the readable stretch is drawn in from them by 5 % and holds no wall corner:
      // read there, the wall top was never found and the roof's lowest edge — a fascia, a porch roof — stood in for it)
      const wtM = wallCornerTopM(view, full.lo, full.hi, s.walls, s.groundRow)
      const wallTopRow = wtM !== undefined ? Math.round((view.projection.zeroRow - wtM / (view.projection.mppV ?? view.projection.mpp)) * 10) / 10 : undefined
      const p: CorrectionProposal = {
        proposalId: `sk-roof-${b.id}-${s.frameId.slice(-10)}`,
        baseRevision: rev,
        operation: 'SET_ROOF',
        targetId: b.roofIds[0] ?? b.planeIds[0] ?? b.id,
        frameId: s.frameId,
        origin: 'SKETCH',
        uncertainty: 'MEDIUM',
        justification: `${disagree}; the sketch of the ${lab?.toLowerCase()} elevation${turned ? ` (drawing the model's ${side.toLowerCase()} side: ${orientation.why})` : ''} draws a ${prof.shape.toLowerCase()} ${kind.toLowerCase()} roof over it`,
        // R2: the registration the proposal was read through travels with it — the whole house's walls against the whole
        // house's extent — so the executor reads the same scale (the narrow wall ends of one body gave the 87° annex)
        patch: { roofKind: kind, roofPolygon: poly.map((q) => [q[0], q[1]] as [number, number]), side, ...(wallTopRow !== undefined ? { wallTopY: wallTopRow } : {}), ...(reg ? {} : { wallLeftX: Math.min(...xs), wallRightX: Math.max(...xs), groundY: s.groundRow, extent: 'HOUSE' as const }) },
      }
      // a band (slopes) or a triangle (gable end) is a clear form; a registered view beats one made by the plan
      const score = (prof.shape === 'TRAPEZOID' ? 3 : prof.shape === 'BAND' || prof.shape === 'TRIANGLE' ? 2 : 1) + (reg ? 1 : 0) + over[0].share
      const prev = best.get(b.id)
      if (!prev || score > prev.score) best.set(b.id, { score, p })
      acc.proposed.push({ bodyId: b.id, why: p.justification as string })
    }
  }
  return { proposals: [...best.values()].map((x) => x.p), accounts, orientation }
}
