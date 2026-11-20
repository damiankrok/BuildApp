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
import type { BuildingCommand } from '@buildapp/commands'
import type { CanonicalBuildingModel, Wall } from '@buildapp/model'
import type { Evidence } from '@buildapp/model'
import { compareRegions } from '../correct/source-gate.js'
import type { Poly } from '../correct/source-gate.js'
import { facadePx, levelOf, openingBoxes, pictureOf, tolPxOf, toFrameX, toFrameY, viewOf } from '../correct/execute.js'
import type { BindPicture, BindView, Bound, Ctx, CorrectionProposal, Refusal, Side } from '../correct/execute.js'
import { targetBodies } from '../correct/resolve.js'
import { area, bodiesOf, bodyCommands, extentOn, MASSING_TOLERANCES, MASSING_VERSION, massingCommands, MINIATURE_CONVENTIONS, profileOver, readableStretch, registerByPlan, solveMassing } from './massing.js'
import type { BodySpec, Fidelity, MassingHypothesis, ModelBody, OutlineObservation, Rect, RoofSpec, SilhouetteObservation } from './massing.js'

export const MASSING_OPS_VERSION = '1.4.0' as const
/** v3.54.17 R2: the most overhang a drawn roof may have past its body on a side, and the steepest pitch the kernel builds. */
export const MAX_OVERHANG_M = 1.0
export const MAX_PITCH_DEG = 85
export type MassingObservations = { outline?: OutlineObservation; silhouettes: readonly SilhouetteObservation[] }

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
  const eaves = m.roofs.filter((r) => b.roofIds.includes(r.id)).map((r) => levelOf(m, r.levelId).elevation + r.eaveOffset)
  const top = level.length > 0 ? Math.min(...level) : Math.min(...eaves)
  if (!Number.isFinite(top)) return undefined
  const e = extentOn(rect, view.side)
  const p = view.projection
  const a0 = pxOf(p, e.lo)
  const a1 = pxOf(p, e.hi)
  return [[a0, pyOf(p, floor)], [a1, pyOf(p, floor)], [a1, pyOf(p, top)], [a0, pyOf(p, top)]]
}

/** A body's whole silhouette as an elevation draws it: its walls from the ground to the eaves, and its roof. */
function specBody(rect: Rect, spec: RoofSpec, view: BindView, floorM: number, overhang = 0): Poly[] {
  const p = view.projection
  const e = extentOn(rect, view.side)
  const a0 = pxOf(p, e.lo)
  const a1 = pxOf(p, e.hi)
  const top = spec.kind === 'FLAT' ? spec.eavesM : spec.eavesM
  return [[[a0, pyOf(p, floorM)], [a1, pyOf(p, floorM)], [a1, pyOf(p, top)], [a0, pyOf(p, top)]], ...(spec.kind === 'GABLE' ? [overhang > 0 ? withOverhang(spec, rect, view, overhang) : specSilhouette(spec, rect, view)] : [])]
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
  if ((f.roofKind !== 'GABLE' && f.roofKind !== 'FLAT') || !Array.isArray(f.roofPolygon) || f.roofPolygon.length < 3) return { status: 'INVALID', code: 'NO_ROOF_SHAPE', why: 'SET_ROOF states roofKind (GABLE or FLAT) and roofPolygon (the roof as the picture draws it, ≥ 3 points)' }
  const ob = oneBody(m, p.targetId)
  if ('status' in ob) return ob
  const { body, bodies } = ob
  if (body.wallIds.length === 0) return { status: 'UNSUPPORTED_OPERATION', code: 'NO_WALLS', why: `${body.id} has no walls: a roof is set on a body; build the body first (BUILD_MASSING)` }
  if (!rectangular(m, body)) return { status: 'UNSUPPORTED_OPERATION', code: 'NOT_RECTANGULAR', why: `${body.id}'s rings are not four-walled: a roof over a non-rectangular body is beyond this version` }
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
    if (prof.shape === 'TRAPEZOID') return { status: 'UNSUPPORTED_OPERATION', code: 'HIP_ROOF', why: `the drawn roof is a trapezoid on the ${view.side.toLowerCase()} side: a hip roof, beyond gable and flat` }
    const axis: 'X' | 'Z' = prof.shape === 'TRIANGLE' ? (along(view.side) === 'x' ? 'Z' : 'X') : along(view.side) === 'x' ? 'X' : 'Z'
    const span = axis === 'X' ? body.rect.maxZ - body.rect.minZ : body.rect.maxX - body.rect.minX
    spec = { kind: 'GABLE', ridgeAxis: axis, pitchDeg: Math.round(((Math.atan2(rise, span / 2) * 180) / Math.PI) * 10) / 10, eavesM: r6(prof.eavesM), ridgeM: r6(prof.topM) }
    // v3.54.17 R3: seen along its ridge, a gable's lowest drawn edge is its fascia — past the wall by the overhang and
    // lower than the eaves at the wall. With the pitch the page states, the eaves at the wall follow from the drawn ridge
    // (ridge − half the span × tan pitch) and the overhang from the drawn fascia; both must be possible (0..MAX), or the
    // pitch and the drawing disagree and the page's pitch is not used (named)
    const pagePitch = ctx.facts?.roofPitchDeg
    if (prof.shape !== 'TRIANGLE' && pagePitch !== undefined && pagePitch >= 10 && pagePitch <= 60) {
      const tan = Math.tan((pagePitch * Math.PI) / 180)
      const eavesWall = prof.topM - (span / 2) * tan
      const oh = (eavesWall - prof.eavesM) / tan
      if (oh >= -0.05 && oh <= MAX_OVERHANG_M) {
        spec = { kind: 'GABLE', ridgeAxis: axis, pitchDeg: pagePitch, eavesM: r6(eavesWall), ridgeM: r6(prof.topM) }
        overhangM = Math.round(Math.max(0, oh) * 100) / 100
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
        pitchFrom = `the page's ${pagePitch}° with the drawn ridge ${prof.topM.toFixed(2)} m: eaves at the wall ${eavesWall.toFixed(2)} m, fascia ${prof.eavesM.toFixed(2)} m → overhang ${overhangM.toFixed(2)} m`
      } else pitchFrom = `the page's ${pagePitch}° would put the overhang at ${oh.toFixed(2)} m from the drawn ridge and fascia: not used, the drawn eaves taken`
    }
  } else spec = { kind: 'FLAT', eavesM: r6(prof.topM) }
  // (d) a pitch the kernel cannot build is named here, with its inputs — never clamped to a buildable one
  if (spec.kind === 'GABLE' && !((spec.pitchDeg ?? 0) <= MAX_PITCH_DEG)) return { status: 'NEEDS_EVIDENCE', code: 'IMPLAUSIBLE_PITCH', why: `${(spec.pitchDeg ?? 0).toFixed(1)}° from a rise of ${rise.toFixed(2)} m over half of ${(spec.ridgeAxis === 'X' ? body.rect.maxZ - body.rect.minZ : body.rect.maxX - body.rect.minX).toFixed(2)} m through ${hv.how}: beyond ${MAX_PITCH_DEG}°, the registration or the drawn roof is not this body's` }
  if (!(spec.eavesM - top.elevation > 0.3)) return { status: 'INVALID', code: 'IMPOSSIBLE_EAVES', why: `the drawn eaves at ${spec.eavesM.toFixed(2)} m are not above ${top.id} (${top.elevation.toFixed(2)} m)` }
  // the source decides between the model's roof and the proposal on the original picture
  const proposed = overhangM > 0 ? withOverhang(spec, body.rect, view, overhangM) : specSilhouette(spec, body.rect, view)
  const floorM = Math.min(...body.levelIds.map((id) => levelOf(m, id).elevation))
  const occupied = others(m, bodies, body, view)
  const gate = compareRegions(pic.raster, specBody(body.rect, spec, view, floorM, overhangM), modelBody(m, body, view), occupied, view.projection.zeroRow)
  const gateRec = regionRecord(gate)
  const record = { bound: { frameId: pic.frameId, side: view.side, hostId: body.id, ids: [body.id], values: { eavesM: spec.eavesM, ...(overhangM > 0 ? { overhangM } : {}), ...(spec.ridgeM ? { ridgeM: spec.ridgeM } : {}), ...(spec.pitchDeg ? { pitchDeg: spec.pitchDeg } : {}) } }, source: { frameId: pic.frameId, sourceByteHash: pic.sourceByteHash }, gate: gateRec, massing: { version: MASSING_OPS_VERSION, body: body.id, spec, registration: hv.how, profile: prof.why } }
  if (gate.winner === 'CURRENT') return { status: 'REJECTED_BY_SOURCE', code: 'SOURCE_SUPPORTS_MODEL', why: `the picture supports the model's roof over the proposal: ${gate.why}`, record }
  if (gate.winner !== 'PROPOSED') return { status: 'NEEDS_EVIDENCE', code: 'SOURCE_UNDECIDED', why: `the picture does not decide between the model's roof and the proposal: ${gate.why}`, record }
  // dependants: the walls of the top storey take the new top; an opening that would rise above it refuses the patch
  const topWalls = m.walls.filter((w) => body.wallIds.includes(w.id) && w.levelId === top.id)
  const eavesRel = spec.eavesM - top.elevation
  const ridgeAlong = (w: Wall): boolean => (spec.kind === 'GABLE' ? Math.abs(spec.ridgeAxis === 'X' ? w.end.x - w.start.x : w.end.z - w.start.z) > 1e-6 : true)
  const blocked = m.openings.filter((o) => topWalls.some((w) => w.id === o.wallId && ridgeAlong(w) && o.sill + o.height > eavesRel - w.baseOffset + 1e-3))
  if (blocked.length > 0) return { status: 'NEEDS_EVIDENCE', code: 'OPENING_ABOVE_EAVES', why: `${blocked.map((o) => o.id).join(', ')} would rise above the new eaves at ${spec.eavesM.toFixed(2)} m: the opening and the roof disagree, and the patch does not move either`, record }
  const removedRoofs = body.roofIds
  const keepId = removedRoofs.length === 1 ? removedRoofs[0] : `roof-${body.id}`
  const cmds: BuildingCommand[] = [...removedRoofs.map((id) => ({ type: 'removeFeature', targetId: id, cascade: true }) as BuildingCommand), ...body.planeIds.map((id) => ({ type: 'removeFeature', targetId: id, cascade: true }) as BuildingCommand)]
  for (const w of topWalls) {
    const h = spec.kind === 'GABLE' ? (spec.ridgeM as number) - top.elevation - w.baseOffset : eavesRel - w.baseOffset
    cmds.push({ type: 'setProperty', targetId: w.id, property: 'height', value: r6(h) })
    if (w.topProfile) cmds.push({ type: 'setProperty', targetId: w.id, property: 'topProfile', value: undefined })
  }
  const others2 = bodies.filter((b) => b.id !== body.id).map((b) => b.rect)
  const built = bodyCommands({ id: body.id, rect: body.rect, roof: spec, provenance: {} }, top.id, top.elevation, others2, 0.3).filter((c) => c.type === 'createRoof') as Array<Extract<BuildingCommand, { type: 'createRoof' }>>
  // v3.54.17 R3: every wall that followed a removed roof (interior partitions under it included) follows the new one —
  // the cascade leaves them with their flat storey height, which runs up through the new roof — and the roof keeps its
  // material
  const followers = m.walls.filter((w) => !topWalls.some((t) => t.id === w.id) && w.topProfile?.kind === 'FOLLOW_ROOF' && removedRoofs.includes(w.topProfile.roofId)).map((w) => w.id)
  const oldMaterial = m.roofs.find((r) => removedRoofs.includes(r.id) && r.materialId)?.materialId
  const roofCmd = { ...built[0], id: keepId, ...(oldMaterial && !built[0].materialId ? { materialId: oldMaterial } : {}), ...(overhangM > 0 ? { overhang: overhangM } : {}), ...(spec.kind === 'GABLE' ? { capWallIds: [...topWalls.map((w) => w.id), ...followers] } : {}), evidence: { status: 'SOURCE_DERIVED' as const, source: pic.frameId, locator: `roof polygon on ${pic.frameId}`, interpretation: `${spec.kind}${spec.ridgeAxis ? ` along ${spec.ridgeAxis}` : ''} read from the source elevation through ${hv.how}` } }
  cmds.push(roofCmd as BuildingCommand)
  const removedDeps = m.roofOpenings.filter((o) => removedRoofs.includes(o.roofId) || body.planeIds.includes(o.roofId)).map((o) => o.id)
  // v3.54.17 R3: interior walls under the roof follow its new underside (their tops are capped by it), nothing else of them
  const underRoof = m.walls.filter((w) => w.kind !== 'EXTERIOR' && body.levelIds.includes(w.levelId) && [w.start, w.end].every((q) => q.x >= body.rect.minX - 0.05 && q.x <= body.rect.maxX + 0.05 && q.z >= body.rect.minZ - 0.05 && q.z <= body.rect.maxZ + 0.05)).map((w) => `walls:${w.id}`)
  const allowed = [...underRoof, ...removedRoofs.map((id) => `roofs:${id}`), `roofs:${keepId}`, ...body.planeIds.map((id) => `roofPlanes:${id}`), ...topWalls.map((w) => `walls:${w.id}`), ...removedDeps.map((id) => `roofOpenings:${id}`), 'rooflights:*', 'roofEdges:*']
  const measure = (working: CanonicalBuildingModel, _before: CanonicalBuildingModel, pictures: readonly BindPicture[]): { failure?: string; measure: { sourceVerified: boolean | null; why: string; iouWithProposal?: number; builtSupportZ?: number | null } } => {
    const nb = bodiesOf(working).find((b) => b.id === body.id)
    const sil = nb ? bodyRoofSilhouette(working, nb, view) : undefined
    if (!sil) return { failure: `${body.id} has no roof in the candidate`, measure: { sourceVerified: false, why: 'no roof built' } }
    const ov = polygonIou(sil, proposed)
    const src = pictures.find((q) => q.frameId === pic.frameId)
    const back = src && nb ? drawnBack(src.raster, modelBody(working, nb, view), occupied, view.projection.zeroRow) : undefined
    const kind = working.roofs.find((r) => r.id === keepId)?.kind
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
  return cmds.map((c) => (c.type === 'createWallRing' ? { ...c, evidence: ev('ring') } : c.type === 'createRoof' ? { ...c, evidence: ev('roof') } : c))
}

export function bindBuildMassing(ctx: Ctx, p: CorrectionProposal): Bound | Refusal {
  const m = ctx.model
  const obs = ctx.massing
  if (!obs?.outline) return { status: 'NEEDS_EVIDENCE', code: 'NO_OUTLINE', why: 'BUILD_MASSING needs the plan outline (a plan frame read at a measured scale, or the walls of a model): none was observed' }
  // §6: the side each labelled elevation draws is a hypothesis of its own — solved as labelled and turned by 90°, the
  // reading whose views agree on every body's heights is taken (ties stay as labelled); the other is kept named
  const agreeing = (x: MassingHypothesis): number => x.bodies.filter((b) => b.provenance.height?.fidelity === 'SOURCE_DERIVED').length
  const asLabelled = solveMassing({ outline: obs.outline, silhouettes: obs.silhouettes })
  const turnedH = solveMassing({ outline: obs.outline, silhouettes: obs.silhouettes.map((q) => ({ ...q, side: TURN[q.side] })) })
  const turn = agreeing(turnedH) > agreeing(asLabelled)
  const h: MassingHypothesis = turn ? { ...turnedH, alternatives: [...turnedH.alternatives, `the elevations draw the model's sides turned by 90° from their labels: ${agreeing(turnedH)} body/bodies' heights agree so against ${agreeing(asLabelled)} as labelled (the labelled reading is kept as an alternative)`] } : { ...asLabelled, alternatives: [...asLabelled.alternatives, ...(agreeing(turnedH) === agreeing(asLabelled) && turnedH.status === 'BUILDABLE' ? [`turned by 90° the elevations agree as well (${agreeing(turnedH)} body/bodies): the labels are kept`] : [])] }
  const record = { massing: { version: MASSING_OPS_VERSION, hypothesis: h } as Record<string, unknown>, ...(obs.outline.frameId ? { source: { frameId: obs.outline.frameId, sourceByteHash: obs.outline.sourceByteHash } } : {}) }
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
    cmds = cmds.flatMap((c) => (c.type === 'createWallRing' || c.type === 'createRoof' ? withEvidence([c], missing.find((b) => (c.id ?? '').endsWith(b.id)) as BodySpec, frames) : [c]))
  } else {
    const lv = [...m.levels].sort((a, b) => a.elevation - b.elevation)[0]
    const rects = [...existing.map((e) => e.rect), ...missing.map((b) => b.rect)]
    cmds = missing.flatMap((b) => withEvidence(bodyCommands(b, lv.id, lv.elevation, rects.filter((r) => r !== b.rect), h.wallThicknessM), b, frames))
  }
  cmds = [...sources, ...cmds]
  const allowed = [...missing.flatMap((b) => [`walls:ring-${b.id}*`, `wallRings:ring-${b.id}`, `wallJunctions:ring-${b.id}*`, `roofs:roof-${b.id}`]), 'evidenceSources:src-*', 'levels:*', ...(m.building ? [] : ['building', 'building:*'])]
  const viewsUsed = h.views
  const measure = (working: CanonicalBuildingModel, _b: CanonicalBuildingModel, pictures: readonly BindPicture[]): { failure?: string; measure: { sourceVerified: boolean | null; why: string } } => {
    const built = bodiesOf(working)
    const lines: string[] = []
    let verified: boolean | null = true
    for (const b of missing) {
      const nb = built.find((q) => q.id === `ring-${b.id}`)
      if (!nb || nb.roofIds.length !== 1) return { failure: `${b.id} was not built as a walled body with its roof`, measure: { sourceVerified: false, why: `${b.id} missing in the candidate` } }
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
  perBody?: Array<{ bodyId: string; labelled: Array<{ frameId: string; side: Side; eavesM: number }>; turned: Array<{ frameId: string; side: Side; eavesM: number }>; hidden: Array<{ frameId: string; side: Side; why: string }>; agreesLabelled: boolean | null; agreesTurned: boolean | null }>
  /** The bodies whose views agree under the assignment used (UNDECIDED: as labelled) — the only ones a roof proposal may touch. */
  confirmed?: string[]
  /** The side each elevation is read as, the ONE mapping every consumer of the sketches uses (roofs and openings). */
  sideOf?: Record<string, Side>
  why: string
}
const TURN: Record<Side, Side> = { FRONT: 'RIGHT', RIGHT: 'REAR', REAR: 'LEFT', LEFT: 'FRONT' }
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
export function orientationOf(sketches: readonly SketchForMassing[], m: CanonicalBuildingModel, sideOf: (facade: string) => Side | undefined): OrientationHypothesis {
  const bodies = bodiesOf(m).filter((b) => b.ringIds.length > 0)
  type Read = { frameId: string; side: Side; eavesM: number }
  const per = new Map(bodies.map((b) => [b.id, { labelled: [] as Read[], turned: [] as Read[], hidden: [] as Array<{ frameId: string; side: Side; why: string }> }]))
  for (const turn of [false, true]) {
    for (const s of sketches) {
      const lab = sideOf(s.facade)
      if (!lab || s.groundRow === null || s.walls.length === 0 || s.roofs.length === 0 || bodies.length === 0) continue
      const side = turn ? TURN[lab] : lab
      const all = bodies.map((q) => extentOn(q.rect, side))
      const ext = { lo: Math.min(...all.map((e) => e.lo)), hi: Math.max(...all.map((e) => e.hi)) }
      const r = registerByPlan({ observationId: 'o', side, frameId: s.frameId, sourceByteHash: '', groundRow: s.groundRow, walls: s.walls, roofs: [] }, ext)
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
        let prof = profileOver(r.view, st.lo, st.hi, { walls: [], roofs })
        // v3.54.17 R3: seen from the gable end, the eaves an eaves view draws (the fascia, past the wall by the overhang and
        // lower by overhang × slope) stand at the roof's own ends, outside the walls' stretch: read the gable over the full
        // width of ITS roof (only polygons mostly over this stretch — an annex roof beside it is not this roof's eaves)
        if (prof?.shape === 'TRIANGLE') {
          const pr = r.view.projection
          const spanPx = Math.abs(pr.alongSign * (st.hi - st.lo) / pr.mpp)
          const toPx = (a: number): number => (a - pr.alongAtPx0) / (pr.alongSign * pr.mpp)
          const sx0 = Math.min(toPx(st.lo), toPx(st.hi))
          const sx1 = Math.max(toPx(st.lo), toPx(st.hi))
          const own = roofs.filter((poly) => { const xs = poly.map((q) => q[0]); return Math.min(Math.max(...xs), sx1) - Math.max(Math.min(...xs), sx0) > 0.5 * spanPx })
          const xs = own.flatMap((poly) => poly.map((q) => q[0]))
          if (own.length && xs.length) {
            const ends = [pr.alongAtPx0 + pr.alongSign * pr.mpp * Math.min(...xs), pr.alongAtPx0 + pr.alongSign * pr.mpp * Math.max(...xs)]
            const lo = Math.max(Math.min(...ends), st.lo - MAX_OVERHANG_M)
            const hi = Math.min(Math.max(...ends), st.hi + MAX_OVERHANG_M)
            const wide = profileOver(r.view, lo, hi, { walls: [], roofs: own })
            if (wide?.shape === 'TRIANGLE') prof = wide
          }
        }
        if (prof && prof.shape !== 'NONE') per.get(b.id)?.[turn ? 'turned' : 'labelled'].push({ frameId: s.frameId, side, eavesM: Math.round(prof.eavesM * 100) / 100 })
      }
    }
  }
  const agree = (v: Read[]): boolean | null => {
    if (v.length < 2) return null
    const e = v.map((x) => x.eavesM)
    return Math.max(...e) - Math.min(...e) <= Math.max(MASSING_TOLERANCES.heightAgreeM, MASSING_TOLERANCES.heightAgreeShare * Math.max(...e))
  }
  const perBody = bodies.map((b) => { const q = per.get(b.id) as { labelled: Read[]; turned: Read[]; hidden: Array<{ frameId: string; side: Side; why: string }> }; return { bodyId: b.id, labelled: q.labelled, turned: q.turned, hidden: q.hidden, agreesLabelled: agree(q.labelled), agreesTurned: agree(q.turned) } })
  const flat = (k: 'labelled' | 'turned'): number[] => perBody.flatMap((b) => b[k].map((x) => x.eavesM))
  const spread = (v: number[]): number | null => (v.length >= 2 ? Math.round((Math.max(...v) - Math.min(...v)) * 100) / 100 : null)
  const judged = (k: 'agreesLabelled' | 'agreesTurned') => perBody.filter((b) => b[k] !== null)
  const allAgree = (k: 'agreesLabelled' | 'agreesTurned'): boolean => judged(k).length > 0 && judged(k).every((b) => b[k] === true)
  const describe = (k: 'labelled' | 'turned'): string => perBody.filter((b) => b[k].length > 0).map((b) => `${b.bodyId} ${b[k].map((x) => x.eavesM).join('/')} m`).join('; ') || 'none'
  const mapping = (turn: boolean): Record<string, Side> => Object.fromEntries(sketches.flatMap((s) => { const lab = sideOf(s.facade); return lab ? [[s.frameId, turn ? TURN[lab] : lab]] : [] }))
  const base = { labelled: { eavesM: flat('labelled'), spreadM: spread(flat('labelled')) }, turned: { eavesM: flat('turned'), spreadM: spread(flat('turned')) }, perBody }
  if (judged('agreesLabelled').length === 0) return { ...base, assignment: 'AS_LABELLED', confirmed: [], sideOf: mapping(false), why: `no body is read by two views (${describe('labelled')}): read as labelled, nothing confirmed by agreement` }
  if (allAgree('agreesLabelled')) return { ...base, assignment: 'AS_LABELLED', confirmed: perBody.filter((b) => b.agreesLabelled).map((b) => b.bodyId), sideOf: mapping(false), why: `each body's views agree as labelled (${describe('labelled')})` }
  if (allAgree('agreesTurned')) return { ...base, assignment: 'TURNED_90', confirmed: perBody.filter((b) => b.agreesTurned).map((b) => b.bodyId), sideOf: mapping(true), why: `as labelled the views disagree on a body (${describe('labelled')}); turned by 90° every body's views agree (${describe('turned')}): the elevations draw the model's sides turned — read so for every consumer, named, no wall moved` }
  const ok = perBody.filter((b) => b.agreesLabelled === true).map((b) => b.bodyId)
  return { ...base, assignment: 'UNDECIDED', confirmed: ok, sideOf: mapping(false), why: `neither as labelled (${describe('labelled')}) nor turned (${describe('turned')}) does every body's pair of views agree; ${ok.length > 0 ? `${ok.join(', ')} agree as labelled and stay confirmed` : 'no body is confirmed'}` }
}

/**
 * Each elevation sketch, held against each body of the model: where the body has no roof, or its roof's form, ridge
 * direction or outline disagree with what the sketch draws over it, one SET_ROOF proposal with the sketch's own roof
 * polygon (frame pixels) — and, where the analyzer did not register that elevation with heights, the sketch's wall ends
 * and ground row so the executor registers it by the body's plan extent. The executor's gate decides; this only asks.
 * One proposal per body (the elevation that shows its roof form most clearly), never two on one body.
 */
export function roofProposalsFromSketches(sketches: readonly SketchForMassing[], m: CanonicalBuildingModel, views: readonly BindView[], rev: string, sideOf: (facade: string) => Side | undefined): { proposals: CorrectionProposal[]; accounts: MassingProposalAccount[]; orientation: OrientationHypothesis } {
  const bodies = bodiesOf(m).filter((b) => b.wallIds.length > 0 && rectangular(m, b))
  const best = new Map<string, { score: number; p: CorrectionProposal }>()
  const accounts: MassingProposalAccount[] = []
  const orientation = orientationOf(sketches, m, sideOf)
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
        const r = registerByPlan({ observationId: `sk-${s.frameId}`, side, frameId: s.frameId, sourceByteHash: '', groundRow: s.groundRow, walls: s.walls, roofs: [] }, { lo: Math.min(...all.map((e) => e.lo)), hi: Math.max(...all.map((e) => e.hi)) })
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
      if (!prof || prof.shape === 'TRAPEZOID') {
        acc.skipped.push({ bodyId: b.id, why: prof ? 'the sketch draws a trapezoid (a hip): beyond SET_ROOF' : 'the roof does not stand over the body' })
        continue
      }
      const kind: 'GABLE' | 'FLAT' = prof.topM - prof.eavesM < MASSING_TOLERANCES.flatRiseM ? 'FLAT' : 'GABLE'
      const current = bodyRoofSilhouette(m, b, view)
      const curKind = m.roofs.find((r) => b.roofIds.includes(r.id))?.kind ?? (b.planeIds.length > 0 ? 'PLANES' : 'NONE')
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
        patch: { roofKind: kind, roofPolygon: poly.map((q) => [q[0], q[1]] as [number, number]), side, ...(reg ? {} : { wallLeftX: Math.min(...xs), wallRightX: Math.max(...xs), groundY: s.groundRow, extent: 'HOUSE' as const }) },
      }
      // a band (slopes) or a triangle (gable end) is a clear form; a registered view beats one made by the plan
      const score = (prof.shape === 'BAND' || prof.shape === 'TRIANGLE' ? 2 : 1) + (reg ? 1 : 0) + over[0].share
      const prev = best.get(b.id)
      if (!prev || score > prev.score) best.set(b.id, { score, p })
      acc.proposed.push({ bodyId: b.id, why: p.justification as string })
    }
  }
  return { proposals: [...best.values()].map((x) => x.p), accounts, orientation }
}
