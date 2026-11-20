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
import { area, bodiesOf, bodyCommands, extentOn, MASSING_TOLERANCES, MASSING_VERSION, massingCommands, MINIATURE_CONVENTIONS, profileOver, registerByPlan, solveMassing } from './massing.js'
import type { BodySpec, Fidelity, MassingHypothesis, ModelBody, OutlineObservation, Rect, RoofSpec, SilhouetteObservation } from './massing.js'

export const MASSING_OPS_VERSION = '1.0.0' as const
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
function specBody(rect: Rect, spec: RoofSpec, view: BindView, floorM: number): Poly[] {
  const p = view.projection
  const e = extentOn(rect, view.side)
  const a0 = pxOf(p, e.lo)
  const a1 = pxOf(p, e.hi)
  const top = spec.kind === 'FLAT' ? spec.eavesM : spec.eavesM
  return [[[a0, pyOf(p, floorM)], [a1, pyOf(p, floorM)], [a1, pyOf(p, top)], [a0, pyOf(p, top)]], ...(spec.kind === 'GABLE' ? [specSilhouette(spec, rect, view)] : [])]
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
const rectangular = (m: CanonicalBuildingModel, b: ModelBody): boolean => b.ringIds.every((id) => (m.wallRings.find((r) => r.id === id)?.wallIds.length ?? 0) === 4)
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
    const reg = registerByPlan({ observationId: p.proposalId, side, frameId: pic.frameId, sourceByteHash: pic.sourceByteHash, groundRow: g, walls: [[[l, g], [r, g], [r, g - 10], [l, g - 10]]], roofs: [] }, extentOn(body.rect, side))
    if ('view' in reg) return { view: reg.view, how: `registered by ${body.id}'s plan extent: ${reg.why}` }
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
  if (body.ringIds.length === 0) return { status: 'UNSUPPORTED_OPERATION', code: 'NO_WALLS', why: `${body.id} has no walls: a roof is set on a body; build the body first (BUILD_MASSING)` }
  if (!rectangular(m, body)) return { status: 'UNSUPPORTED_OPERATION', code: 'NOT_RECTANGULAR', why: `${body.id}'s rings are not four-walled: a roof over a non-rectangular body is beyond this version` }
  const pic = pictureOf(ctx, p, f.picture)
  if (!pic) return { status: 'INVALID', code: 'NOT_A_SOURCE_PICTURE', why: `picture ${String(f.picture ?? p.frameId)} is not a source picture of this check` }
  if (pic.projection !== 'ORTHOGRAPHIC_ELEVATION') return { status: 'INVALID', code: 'NOT_ORTHOGRAPHIC', why: `picture ${pic.n} is ${pic.projection}: a perspective draws no metric roof` }
  const hv = heightView(ctx, p, pic, body)
  if ('status' in hv) return hv
  const view = hv.view
  const poly = framePoly(pic, p, f.roofPolygon)
  const e = extentOn(body.rect, view.side)
  const prof = profileOver(view, e.lo, e.hi, { walls: [], roofs: [poly] })
  if (!prof) return { status: 'INVALID', code: 'ROOF_NOT_OVER_BODY', why: `the drawn roof does not stand over ${body.id}'s ${(e.hi - e.lo).toFixed(2)} m on the ${view.side.toLowerCase()} side` }
  const rise = prof.topM - prof.eavesM
  if ((f.roofKind === 'FLAT') !== (rise < MASSING_TOLERANCES.flatRiseM)) return { status: 'INVALID', code: 'KIND_CONTRADICTS_SHAPE', why: `${f.roofKind} proposed, but the drawn roof rises ${rise.toFixed(2)} m over its eaves (flat below ${MASSING_TOLERANCES.flatRiseM} m)` }
  const top = topLevelOf(m, body) as { id: string; elevation: number }
  let spec: RoofSpec
  if (f.roofKind === 'GABLE') {
    if (prof.shape === 'TRAPEZOID') return { status: 'UNSUPPORTED_OPERATION', code: 'HIP_ROOF', why: `the drawn roof is a trapezoid on the ${view.side.toLowerCase()} side: a hip roof, beyond gable and flat` }
    const axis: 'X' | 'Z' = prof.shape === 'TRIANGLE' ? (along(view.side) === 'x' ? 'Z' : 'X') : along(view.side) === 'x' ? 'X' : 'Z'
    const span = axis === 'X' ? body.rect.maxZ - body.rect.minZ : body.rect.maxX - body.rect.minX
    spec = { kind: 'GABLE', ridgeAxis: axis, pitchDeg: Math.round(((Math.atan2(rise, span / 2) * 180) / Math.PI) * 10) / 10, eavesM: r6(prof.eavesM), ridgeM: r6(prof.topM) }
  } else spec = { kind: 'FLAT', eavesM: r6(prof.topM) }
  if (!(spec.eavesM - top.elevation > 0.3)) return { status: 'INVALID', code: 'IMPOSSIBLE_EAVES', why: `the drawn eaves at ${spec.eavesM.toFixed(2)} m are not above ${top.id} (${top.elevation.toFixed(2)} m)` }
  // the source decides between the model's roof and the proposal on the original picture
  const proposed = specSilhouette(spec, body.rect, view)
  const floorM = Math.min(...body.levelIds.map((id) => levelOf(m, id).elevation))
  const occupied = others(m, bodies, body, view)
  const gate = compareRegions(pic.raster, specBody(body.rect, spec, view, floorM), modelBody(m, body, view), occupied, view.projection.zeroRow)
  const gateRec = regionRecord(gate)
  const record = { bound: { frameId: pic.frameId, side: view.side, hostId: body.id, ids: [body.id], values: { eavesM: spec.eavesM, ...(spec.ridgeM ? { ridgeM: spec.ridgeM } : {}), ...(spec.pitchDeg ? { pitchDeg: spec.pitchDeg } : {}) } }, source: { frameId: pic.frameId, sourceByteHash: pic.sourceByteHash }, gate: gateRec, massing: { version: MASSING_OPS_VERSION, body: body.id, spec, registration: hv.how, profile: prof.why } }
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
  const roofCmd = { ...built[0], id: keepId, ...(spec.kind === 'GABLE' ? { capWallIds: topWalls.map((w) => w.id) } : {}), evidence: { status: 'SOURCE_DERIVED' as const, source: pic.frameId, locator: `roof polygon on ${pic.frameId}`, interpretation: `${spec.kind}${spec.ridgeAxis ? ` along ${spec.ridgeAxis}` : ''} read from the source elevation through ${hv.how}` } }
  cmds.push(roofCmd as BuildingCommand)
  const removedDeps = m.roofOpenings.filter((o) => removedRoofs.includes(o.roofId) || body.planeIds.includes(o.roofId)).map((o) => o.id)
  const allowed = [...removedRoofs.map((id) => `roofs:${id}`), `roofs:${keepId}`, ...body.planeIds.map((id) => `roofPlanes:${id}`), ...topWalls.map((w) => `walls:${w.id}`), ...removedDeps.map((id) => `roofOpenings:${id}`), 'rooflights:*', 'roofEdges:*']
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
  if (typeof f.wallLeftX !== 'number' || typeof f.wallRightX !== 'number') return { status: 'INVALID', code: 'NO_EXTENT', why: "SET_OUTLINE states wallLeftX and wallRightX: the body's wall ends as the picture draws them" }
  const ob = oneBody(m, p.targetId)
  if ('status' in ob) return ob
  const { body, bodies } = ob
  if (body.ringIds.length === 0 || !rectangular(m, body)) return { status: 'UNSUPPORTED_OPERATION', code: 'NOT_RECTANGULAR', why: `${body.id} is not a four-walled body: its outline is changed by rebuilding it (BUILD_MASSING)` }
  if (body.planeIds.length > 0) return { status: 'UNSUPPORTED_OPERATION', code: 'PLANE_ROOF_OUTLINE', why: `${body.id}'s roof is made of planes: a plane roof does not follow a moved outline in this version (SET_ROOF it first)` }
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
  const measure = (working: CanonicalBuildingModel, _b: CanonicalBuildingModel, pictures: readonly BindPicture[]): { failure?: string; measure: { sourceVerified: boolean | null; why: string; builtSupportZ?: number | null } } => {
    const nb = bodiesOf(working).find((b) => b.id === body.id)
    const e = nb ? extentOn(nb.rect, view.side) : undefined
    if (!e || Math.abs(e.lo - lo) > 0.01 || Math.abs(e.hi - hi) > 0.01) return { failure: `${body.id} was not built to ${lo.toFixed(2)}–${hi.toFixed(2)} m`, measure: { sourceVerified: false, why: `built extent ${e ? `${e.lo.toFixed(2)}–${e.hi.toFixed(2)}` : 'none'}` } }
    const src = pictures.find((q) => q.frameId === pic.frameId)
    const sil = nb ? bodyWallSilhouette(working, nb, view) : undefined
    const back = src && sil ? drawnBack(src.raster, [sil], occupied, view.projection.zeroRow) : undefined
    return { measure: { sourceVerified: back ? back.verified : null, why: `${body.id} now ${lo.toFixed(2)}–${hi.toFixed(2)} m along ${ax}; its walls drawn back into ${pic.frameId} cover ${back?.why ?? '—'}` } }
  }
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
  return { commands: cmds, transform, allowed, expect: { kind: 'CUSTOM', measure }, record }
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
  const h: MassingHypothesis = solveMassing({ outline: obs.outline, silhouettes: obs.silhouettes })
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
