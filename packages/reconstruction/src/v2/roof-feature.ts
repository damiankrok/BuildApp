/**
 * v3.54.3: a secondary roof feature the drawings' path did not read, added to the building it built — the consumer of a
 * ROOF_FEATURE correction.
 *
 * The drawings' path reads one roof per body; a dormer (a wall dormer over an entrance, a dormer on the slope) is in no
 * plan as a body and it reads none. A correction says, in the terms a picture of one side gives: which side it is on,
 * between which shares of that side's wall extent it stands (left to right as that side is seen), how high its eaves
 * and its ridge are as shares of the host roof's rise, and whether its front wall continues the facade or stands back
 * on the slope. Nothing in it is a coordinate or a mesh: the analyzer turns the shares into the building's own frame,
 * picks the host plane, lays the dormer out with the model's own rule (`layoutDormer`) and refuses, with a typed
 * reason, what that rule or the roof it stands on cannot hold. The feature's metres come from shares of a picture and
 * are a visual approximation: its provenance is VISUAL_SEMANTIC and it authorises no quantity.
 *
 * A legacy main gable holds no dormer (the model cuts dormers in roof PLANES): the gable is restated as its two planes
 * with gable ends (`planeRoofLayout`), the same roof to the last surface, exactly as a hipped main roof is restated.
 * That restatement is refused where something is bound to the gable as a gable (verge boards, a wing whose valleys cut
 * it): REPRESENTATION_LIMIT, named.
 */
import { layoutDormer } from '@buildapp/model'
import { round6 } from '@buildapp/source-common'
import type { BuildingV2, DormerV2, PlaneRoofV2 } from './building.js'
import { planeRoofLayout, rooflightPlaneKey } from './plane-roof.js'
import type { PlaneRoofKey, PlaneRoofPlane } from './plane-roof.js'

export const ROOF_FEATURE_NAME = 'reconstruction.roof-feature' as const
export const ROOF_FEATURE_VERSION = '0.1.0' as const

/** A side of the model as its views name it: FRONT is the face at min z seen with x to the right; RIGHT the face at max x. */
export type ModelSide = 'FRONT' | 'RIGHT' | 'REAR' | 'LEFT'

export type RoofFeatureKind = 'GABLE_DORMER' | 'SHED_DORMER' | 'FLAT_DORMER'

export type RoofFeatureCorrection = {
  /** The feature's stable id in the model (made by the binder from side and place; never by a consultant). */
  id: string
  proposalId: string
  kind: RoofFeatureKind
  side: ModelSide
  /** Its two sides, left to right as that side is seen, as shares (0..1) of the building's wall extent on that side. */
  fromShare: number
  toShare: number
  /** Its eaves and its ridge as shares of the host roof's rise: 0 at the host's eaves, 1 at its ridge. */
  eaveShare: number
  ridgeShare?: number
  /** FLUSH: its front wall continues the facade below (a wall dormer). SET_BACK: it stands on the slope behind the eaves. */
  front: 'FLUSH' | 'SET_BACK'
  /** Whether its front shows glazing (a window is then placed by convention). */
  glazed: boolean
  why: string
}

export type RoofFeatureRefusal = 'NO_PITCHED_HOST' | 'GABLE_END_SIDE' | 'REPRESENTATION_LIMIT' | 'OUT_OF_RANGE' | 'OVERLAPS' | 'LAYOUT_REFUSED' | 'DUPLICATE'

export type RoofFeatureOutcome = {
  id: string
  proposalId: string
  status: 'APPLIED' | 'REFUSED'
  code?: RoofFeatureRefusal
  why: string
  /** What was built, in the building's frame (metres). */
  built?: { massId: string; planeKey: PlaneRoofKey; type: DormerV2['type']; front: DormerV2['front']; widthM: number; eaveY: number; ridgeY?: number; hostEaveY: number; hostRidgeY: number; restatedMainGable: boolean; adjustments: string[] }
}

/** What a dormer may be, as the model's rule and a house allow it. Each bound is a refusal's reason, not a fit. */
export const ROOF_FEATURE_BOUNDS = {
  /** Narrower is a chimney or a vent, not a dormer. */
  minWidthM: 0.8,
  /** A "dormer" wider than this share of its eaves is the roof itself (a second storey, a cross wing), not a feature on it. */
  maxEaveShare: 0.6,
  /** Its sides stay this far inside the host plane's ends. */
  endMarginM: 0.3,
  /** Its ridge stays this far under the host's. */
  ridgeClearM: 0.15,
  /** A flush front stands this far inside the plane's eaves edge (the model cuts strictly inside a plane). */
  flushInsetM: 0.06,
  /** A set-back front stands where the host roof is this far under the dormer's eaves (a convention: a window's height). */
  setBackFaceM: 1.25,
  minSetBackM: 0.5,
  /** A gable dormer's own pitch, degrees. */
  pitchDeg: [12, 70] as const,
  wallThicknessM: 0.2,
  roofThicknessM: 0.2,
  frontOverhangM: 0.3,
} as const

const OUTWARD: Record<ModelSide, { x: number; z: number }> = { FRONT: { x: 0, z: -1 }, REAR: { x: 0, z: 1 }, RIGHT: { x: 1, z: 0 }, LEFT: { x: -1, z: 0 } }

/** The building's ground-storey wall extent along a side, in the direction that side is seen left to right. */
export function sideExtent(building: Pick<BuildingV2, 'masses'>, side: ModelSide): { from: number; to: number } | undefined {
  const lowest = Math.min(...building.masses.flatMap((m) => m.storeys))
  const ms = building.masses.filter((m) => m.storeys.includes(lowest) && !m.pieceOf)
  if (ms.length === 0) return undefined
  const alongX = side === 'FRONT' || side === 'REAR'
  const lo = Math.min(...ms.map((m) => (alongX ? m.x0 : m.z0)))
  const hi = Math.max(...ms.map((m) => (alongX ? m.x1 : m.z1)))
  // FRONT and RIGHT are seen with the coordinate growing to the right; REAR and LEFT with it falling
  return side === 'FRONT' || side === 'RIGHT' ? { from: lo, to: hi } : { from: hi, to: lo }
}

/** The main gable restated as a plane roof with gable ends: the same surfaces, as planes a dormer can stand in. */
function restateMainGable(b: BuildingV2): { building: BuildingV2 } | { refused: string } {
  const r = b.mainRoof
  if (!r) return { refused: 'the building has no main gable to restate' }
  const bound = [...(b.verges.length > 0 ? ['verge boards'] : []), ...(b.pitchedAttachedRoofs.length > 0 ? ['attached pitched roofs'] : [])]
  if (bound.length > 0) return { refused: `${bound.join(' and ')} are bound to the main roof as a gable; it cannot be restated as planes, and the model cuts a dormer only in a plane` }
  const oh = r.eaves?.overhangM ?? 0
  const body = { x0: r.footprint.x0 - oh, x1: r.footprint.x1 + oh, z0: r.footprint.z0 - oh, z1: r.footprint.z1 + oh }
  const eaveY = round6(r.eaveY - oh * Math.tan((r.pitchDeg * Math.PI) / 180))
  const layout = planeRoofLayout(body, r.ridgeAxis, r.pitchDeg, eaveY, { min: 'GABLE', max: 'GABLE' })
  const rooflights = b.rooflights.map((q) => {
    if (q.planeId) return q
    const key = rooflightPlaneKey(layout, r.ridgeAxis, q)
    return key ? { ...q, planeId: `roof-${r.massId}-plane-${key.toLowerCase().replace('_', '-')}`, ridgeAxis: r.ridgeAxis } : q
  })
  if (rooflights.some((q) => !q.planeId)) return { refused: 'a rooflight of the main gable lies in no one plane of it; the gable is kept' }
  const plane: PlaneRoofV2 = { massId: r.massId, ridgeAxis: r.ridgeAxis, pitchDeg: r.pitchDeg, eaveY, ridgeY: layout.ridgeY, ends: { min: 'GABLE', max: 'GABLE' }, thicknessM: r.thicknessM, layout, featureId: r.featureId, provenance: r.provenance, why: `${r.pitchDeg}° gable on the authority of ${r.authority.toLowerCase().replace(/_/g, ' ')}, restated as its two planes to carry a dormer; ${r.coversZonesWhy}` }
  const { mainRoof: _gone, ...rest } = b
  return { building: { ...rest, planeRoofs: [...(b.planeRoofs ?? []), plane], rooflights } }
}

const inside = (p: { x: number; z: number }, poly: ReadonlyArray<{ x: number; z: number }>): boolean => {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    if (poly[i].z > p.z !== poly[j].z > p.z && p.x < ((poly[j].x - poly[i].x) * (p.z - poly[i].z)) / (poly[j].z - poly[i].z) + poly[i].x) c = !c
  }
  return c
}
const boundsOf = (ps: ReadonlyArray<{ x: number; z: number }>): { x0: number; z0: number; x1: number; z1: number } => ({ x0: Math.min(...ps.map((p) => p.x)), z0: Math.min(...ps.map((p) => p.z)), x1: Math.max(...ps.map((p) => p.x)), z1: Math.max(...ps.map((p) => p.z)) })
const overlap = (a: { x0: number; z0: number; x1: number; z1: number }, b: { x0: number; z0: number; x1: number; z1: number }): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1

/**
 * The corrections applied in order to a building, each either built into `dormers` or refused with its reason. The
 * building is returned unchanged when nothing applies; a refusal never changes it.
 */
export function applyRoofFeatures(input: BuildingV2, corrections: readonly RoofFeatureCorrection[]): { building: BuildingV2; outcomes: RoofFeatureOutcome[] } {
  let b = input
  const outcomes: RoofFeatureOutcome[] = []
  const B = ROOF_FEATURE_BOUNDS
  for (const c of corrections) {
    const refuse = (code: RoofFeatureRefusal, why: string): void => void outcomes.push({ id: c.id, proposalId: c.proposalId, status: 'REFUSED', code, why })
    if ((b.dormers ?? []).some((d) => d.id === c.id)) {
      refuse('DUPLICATE', `a feature ${c.id} is already in the building: a repeated correction is not applied twice`)
      continue
    }
    if (![c.fromShare, c.toShare, c.eaveShare].every((v) => Number.isFinite(v)) || !(c.fromShare >= -0.02 && c.toShare <= 1.02 && c.toShare > c.fromShare) || !(c.eaveShare > 0.02 && c.eaveShare < 0.9)) {
      refuse('OUT_OF_RANGE', `its place (${c.fromShare}..${c.toShare} of the side) or its eaves (${c.eaveShare} of the rise) is not a place on a roof`)
      continue
    }
    const mainId = b.masses.find((m) => m.role === 'MAIN')?.id ?? b.masses[0]?.id
    let restated = false
    let roof = (b.planeRoofs ?? []).find((r) => r.massId === mainId) ?? (b.planeRoofs ?? [])[0]
    let candidate = b
    if (!roof) {
      if (!b.mainRoof) {
        refuse('NO_PITCHED_HOST', 'the building has no pitched main roof: a dormer stands in a pitched plane')
        continue
      }
      const r = restateMainGable(b)
      if ('refused' in r) {
        refuse('REPRESENTATION_LIMIT', r.refused)
        continue
      }
      candidate = r.building
      roof = (candidate.planeRoofs ?? []).find((x) => x.massId === b.mainRoof?.massId) as PlaneRoofV2
      restated = true
    }
    const out = OUTWARD[c.side]
    const plane: PlaneRoofPlane | undefined = roof.layout.planes.find((p) => p.downslope.x * out.x + p.downslope.z * out.z > 0.9)
    if (!plane) {
      refuse('GABLE_END_SIDE', `the ${c.side.toLowerCase()} side is a gable end of the roof (no slope runs down to it): what stands there is the gable itself, not a feature on a slope`)
      continue
    }
    const ext = sideExtent(candidate, c.side)
    if (!ext) {
      refuse('NO_PITCHED_HOST', 'the building has no ground storey walls to place the feature against')
      continue
    }
    const adjustments: string[] = []
    const alongX = c.side === 'FRONT' || c.side === 'REAR'
    const at = (share: number): number => ext.from + (ext.to - ext.from) * share
    let a0 = Math.min(at(c.fromShare), at(c.toShare))
    let a1 = Math.max(at(c.fromShare), at(c.toShare))
    // the host plane's own extent along its eaves, and across (eaves edge → ridge)
    const pb = boundsOf(plane.boundary)
    const [e0, e1] = alongX ? [pb.x0, pb.x1] : [pb.z0, pb.z1]
    if (a1 - a0 < B.minWidthM) {
      refuse('OUT_OF_RANGE', `${(a1 - a0).toFixed(2)} m wide: narrower than ${B.minWidthM} m is not a dormer`)
      continue
    }
    if (a1 - a0 > B.maxEaveShare * (e1 - e0)) {
      refuse('OUT_OF_RANGE', `${(a1 - a0).toFixed(2)} m wide on eaves of ${(e1 - e0).toFixed(2)} m: more than ${B.maxEaveShare * 100} % of the eaves is the roof itself (another storey, a cross wing), not a feature on it`)
      continue
    }
    if (a0 < e0 + B.endMarginM || a1 > e1 - B.endMarginM) {
      const w = a1 - a0
      const n0 = Math.min(Math.max(a0, e0 + B.endMarginM), e1 - B.endMarginM - w)
      if (Math.abs(n0 - a0) > 0.5) {
        refuse('OUT_OF_RANGE', `it would stand ${a0.toFixed(2)}..${a1.toFixed(2)} m along eaves that run ${e0.toFixed(2)}..${e1.toFixed(2)} m: off the roof's end`)
        continue
      }
      adjustments.push(`moved ${(n0 - a0).toFixed(2)} m along the eaves to keep ${B.endMarginM} m from the roof's end`)
      a0 = n0
      a1 = n0 + w
    }
    const rise = roof.ridgeY - roof.eaveY
    const eaveY = round6(roof.eaveY + c.eaveShare * rise)
    const type: DormerV2['type'] = c.kind === 'GABLE_DORMER' ? 'GABLE' : c.kind === 'SHED_DORMER' ? 'SHED' : 'FLAT'
    let ridgeY: number | undefined
    if (type === 'GABLE') {
      const share = c.ridgeShare
      if (share === undefined || !(share > c.eaveShare + 0.05) || share > 1.1) {
        refuse('OUT_OF_RANGE', `a gable dormer needs its ridge above its eaves and no higher than the roof's (ridge ${share ?? 'not given'} against eaves ${c.eaveShare} of the rise)`)
        continue
      }
      ridgeY = roof.eaveY + share * rise
      if (ridgeY > roof.ridgeY - B.ridgeClearM) {
        adjustments.push(`its ridge lowered ${(ridgeY - (roof.ridgeY - B.ridgeClearM)).toFixed(2)} m to stay ${B.ridgeClearM} m under the roof's`)
        ridgeY = roof.ridgeY - B.ridgeClearM
      }
      ridgeY = round6(ridgeY)
      const pitch = (Math.atan((ridgeY - eaveY) / ((a1 - a0) / 2)) * 180) / Math.PI
      if (pitch < B.pitchDeg[0] || pitch > B.pitchDeg[1]) {
        refuse('OUT_OF_RANGE', `its own slopes would pitch ${pitch.toFixed(0)}°: outside ${B.pitchDeg[0]}–${B.pitchDeg[1]}°, the shares do not describe a gable dormer`)
        continue
      }
    }
    // the front face: across the slope, at the eaves edge (FLUSH) or up the slope by convention (SET_BACK)
    const tanH = Math.tan((plane.pitchDeg * Math.PI) / 180)
    const edge = alongX ? (out.z < 0 ? pb.z0 : pb.z1) : out.x < 0 ? pb.x0 : pb.x1
    const eavesTop = roof.eaveY
    // a flush front stands in the facade's own plane: the host body's wall face on that side, where the roof's edge runs
    // past it (an overhang, a zone under the eaves), and never outside the plane's edge
    const body = candidate.masses.find((m) => m.id === roof.massId)
    const face = body ? (c.side === 'FRONT' ? body.z0 : c.side === 'REAR' ? body.z1 : c.side === 'LEFT' ? body.x0 : body.x1) : edge
    const faceInset = (edge - face) * (alongX ? out.z : out.x)
    // The model keeps two walls out of one place in plan: the attic's own wall stands on the facade line, so a flush
    // front stands directly behind it (that wall's thickness back). Seen from its side the silhouette is the wall
    // dormer's; from the end a strip of roof one wall deep remains in front of it — a limit of the representation, said.
    const wallBack = (body?.wallThicknessM ?? candidate.wallThicknessM) + B.flushInsetM
    let back = Math.max(B.flushInsetM, faceInset + wallBack)
    if (c.front === 'FLUSH') adjustments.push(`its front stands ${wallBack.toFixed(2)} m behind the facade's outer face (directly behind the storey's own wall): the model keeps two walls out of one place`)
    if (c.front === 'SET_BACK') back = Math.max(faceInset + wallBack, faceInset + B.minSetBackM, (eaveY - B.setBackFaceM - eavesTop) / tanH)
    const across = edge - (alongX ? out.z : out.x) * back
    const front = alongX ? { start: { x: round6(a0), z: round6(across) }, end: { x: round6(a1), z: round6(across) } } : { start: { x: round6(across), z: round6(a0) }, end: { x: round6(across), z: round6(a1) } }
    // the model's own rule decides whether this dormer exists on this plane
    const host = { datum: plane.datum, pitchDeg: plane.pitchDeg, downslope: plane.downslope, thickness: roof.thicknessM }
    const laid = layoutDormer({ type, host, front, eaveY, ...(ridgeY !== undefined ? { ridgeY } : {}), ...(type === 'SHED' ? { shedPitchDeg: round6(Math.max(6, plane.pitchDeg - 22)) } : {}), wallThickness: B.wallThicknessM, roofThickness: B.roofThicknessM, frontOverhang: B.frontOverhangM })
    if (!laid.ok) {
      refuse('LAYOUT_REFUSED', `the model's dormer rule refuses it: ${laid.reason}`)
      continue
    }
    const cut = laid.layout.cutOutline
    if (cut.some((p) => !inside(p, plane.boundary))) {
      refuse('LAYOUT_REFUSED', `the hole it cuts leaves the ${plane.key.toLowerCase()} plane of the roof (it reaches past the ridge or an end)`)
      continue
    }
    const cb = boundsOf(cut)
    const planeId = `roof-${roof.massId}-plane-${plane.key.toLowerCase().replace('_', '-')}`
    const hit = [
      ...candidate.chimneys.filter((ch) => overlap(cb, { x0: ch.x0, z0: ch.z0, x1: ch.x1, z1: ch.z1 })).map((ch) => `chimney ${ch.id}`),
      ...candidate.rooflights
        .filter((q) => q.planeId === planeId)
        .filter((q) => overlap(cb, roof.ridgeAxis === 'X' ? { x0: Math.min(q.alongFrom, q.alongTo), x1: Math.max(q.alongFrom, q.alongTo), z0: Math.min(q.slopeFrom, q.slopeTo), z1: Math.max(q.slopeFrom, q.slopeTo) } : { z0: Math.min(q.alongFrom, q.alongTo), z1: Math.max(q.alongFrom, q.alongTo), x0: Math.min(q.slopeFrom, q.slopeTo), x1: Math.max(q.slopeFrom, q.slopeTo) }))
        .map((q) => `rooflight ${q.id}`),
      ...(candidate.dormers ?? []).filter((d) => d.massId === roof.massId && d.planeKey === plane.key && overlap(cb, boundsOf([d.front.start, d.front.end, { x: d.front.start.x - plane.downslope.x * 3, z: d.front.start.z - plane.downslope.z * 3 }]))).map((d) => `dormer ${d.id}`),
    ]
    if (hit.length > 0) {
      refuse('OVERLAPS', `it would stand where ${hit.join(', ')} already cut${hit.length === 1 ? 's' : ''} the roof: two readings of one place, neither set aside here`)
      continue
    }
    // a window by convention where the front shows glazing and the wall under the dormer's roof holds one
    let window: DormerV2['window']
    if (c.glazed) {
      const W = laid.layout.width
      const width = round6(Math.min(W - 0.5, Math.max(0.6, W * 0.6)))
      const offset = (W - width) / 2
      const headroom = Math.min(laid.layout.frontUndersideAt(offset), laid.layout.frontUndersideAt(offset + width)) - laid.layout.frontWall.baseY
      const sill = laid.layout.hostDropAtFront + 0.3
      const height = round6(Math.min(1.6, headroom - sill - 0.12))
      if (width >= 0.5 && offset > 0.06 && height >= 0.45) window = { width, height }
      else adjustments.push('no window placed: the front wall under its roof is too small to hold one by convention')
    }
    const dormer: DormerV2 = {
      id: c.id,
      massId: roof.massId,
      planeKey: plane.key,
      type,
      front,
      eaveY,
      ...(ridgeY !== undefined ? { ridgeY } : {}),
      ...(type === 'SHED' ? { shedPitchDeg: round6(Math.max(6, plane.pitchDeg - 22)) } : {}),
      ...(window ? { window } : {}),
      featureId: `corrected-${c.id}`,
      provenance: 'VISUAL_SEMANTIC',
      why: `${c.why}; placed from shares of the ${c.side.toLowerCase()} side as a picture shows it (${ROOF_FEATURE_NAME} ${ROOF_FEATURE_VERSION}): its position and heights are a visual approximation, not a measurement${adjustments.length > 0 ? `; ${adjustments.join('; ')}` : ''}`,
    }
    b = { ...candidate, dormers: [...(candidate.dormers ?? []), dormer] }
    outcomes.push({ id: c.id, proposalId: c.proposalId, status: 'APPLIED', why: dormer.why, built: { massId: roof.massId, planeKey: plane.key, type, front, widthM: round6(a1 - a0), eaveY, ...(ridgeY !== undefined ? { ridgeY } : {}), hostEaveY: roof.eaveY, hostRidgeY: roof.ridgeY, restatedMainGable: restated, adjustments } })
  }
  return { building: b, outcomes }
}
