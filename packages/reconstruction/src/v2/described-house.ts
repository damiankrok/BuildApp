/**
 * v3.53 — a described house, as the building the drawings' path builds.
 *
 * `HouseDescription` (source-vision) states bodies, storeys, roofs, openings per facade, characteristic features and
 * broad colours, in metres in one frame (x along the front from the left, z from the front to the rear). This turns an
 * admitted description into `BuildingV2`: the same intermediate the plan cascade solves, written by the same emitter,
 * checked by the same model validator and compiled by the same compiler. Nothing here reads a picture, knows a
 * publisher or a house, or writes a mesh.
 *
 * What a description may NOT do is carried, not hidden: every object's evidence is VISUAL_SEMANTIC (a reading of the
 * sources' appearance and print by a reader, not a measurement the drawings' chains confirmed) or
 * ASSUMED_FOR_RENDERING (a side no source shows, a convention), and every adjustment made here to make the stated
 * thing buildable — a body clipped where two overlapped, an opening narrowed to its wall, a roof kind the model cannot
 * build stood in for by another — is returned as a typed adjustment the result shows. A stand-in is a named
 * discrepancy, never a silent success.
 */
import { round6 } from '@buildapp/source-common'
import { serializeModel } from '@buildapp/model'
import type { DescribedBody, DescribedOpening, HouseDescription, HouseSide, PublishedFigure } from '@buildapp/source-vision'
import type { BuildingV2, CanopyV2, DormerV2, LevelV2, MassV2, PlaneRoofV2, AttachedRoofV2, BalconyV2, RailingV2, TerraceV2, PitchedAttachedRoofV2, PocketV2 } from './building.js'
import { cornerPocketSpecs } from './corner-pockets.js'
import { attachedGableLayout } from './attached-roof-form.js'
import type { MainRoofForJoin } from './attached-roof-form.js'
import type { Facade, OpeningFamily, OpeningV2 } from './openings-v2.js'
import type { ProvenanceStatus } from './graph.js'
import type { PlaneRoofKey, PlaneRoofLayout, RoofEnd } from './plane-roof.js'
import { planeAt, planeRoofLayout } from './plane-roof.js'
import { emitBuilding } from './emit.js'
import { buildCandidateModel, fitPreviewProgram } from '../candidate.js'

export const DESCRIBED_HOUSE_BUILDER_VERSION = '0.7.0'
export const DESCRIBED_HOUSE_LABEL = 'MODEL Z OPISU ŹRÓDEŁ'

export type DescribedAdjustmentCode =
  | 'FRAME_SHIFTED'
  | 'BODIES_RESCALED_TO_OVERALL'
  | 'SCALED_TO_PUBLISHED_FIGURE'
  | 'SCALED_TO_DRAWINGS_MEASURE'
  | 'DRAWINGS_MEASURE_NOT_APPLIED'
  | 'SCALED_TO_DRAWINGS_LOCAL_MEASURE'
  | 'DRAWINGS_LOCAL_MEASURE_AGREES'
  | 'DRAWINGS_LOCAL_MEASURE_DISAGREES'
  | 'HEIGHT_FROM_DRAWINGS_MEASURE'
  | 'BODY_CLIPPED'
  | 'BODY_DROPPED'
  | 'EAVES_HEIGHT_CLAMPED'
  | 'ROOF_KIND_STOOD_IN'
  | 'ROOF_PITCH_ASSUMED'
  | 'HIP_RIDGE_ALONG_LONGER_SIDE'
  | 'OPENING_MOVED_TO_WALL'
  | 'OPENING_NARROWED'
  | 'OPENING_LOWERED'
  | 'OPENING_DROPPED'
  | 'FEATURE_DROPPED'
  | 'FEATURE_ADJUSTED'

export type DescribedAdjustment = { code: DescribedAdjustmentCode; subject: string; why: string }

export type DescribedBuilding = { building: BuildingV2; adjustments: DescribedAdjustment[]; mainMassId: string }

type Rect = { x0: number; z0: number; x1: number; z1: number }
const FACADE: Record<HouseSide, Facade> = { FRONT: 'FRONT', REAR: 'REAR', LEFT: 'WEST', RIGHT: 'EAST' }
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))
const tanDeg = (d: number): number => Math.tan((d * Math.PI) / 180)
const cosDeg = (d: number): number => Math.cos((d * Math.PI) / 180)
const ROOF_THICKNESS_M = 0.28
const WALL_T = 0.3
const SNAP_M = 0.15
const HIP_RIDGE_MARGIN_M = 1
const FLAT_ROOF_UPSTAND_M = 0.15
const CANOPY_SNAP_M = 0.25
const RECESS_MIN_DEPTH_M = 1

/** Cluster nearly equal coordinates onto one value, so bodies that touch share an exact line. */
function snapper(values: number[]): (v: number) => number {
  const sorted = [...new Set(values.map((v) => round6(v)))].sort((a, b) => a - b)
  const groups: number[][] = []
  for (const v of sorted) {
    const g = groups[groups.length - 1]
    if (g && v - g[g.length - 1] <= SNAP_M) g.push(v)
    else groups.push([v])
  }
  const reps = groups.map((g) => ({ lo: g[0], hi: g[g.length - 1], to: round6(Math.round((g.reduce((s, x) => s + x, 0) / g.length) * 20) / 20) }))
  return (v) => reps.find((r) => v >= r.lo - 1e-9 && v <= r.hi + 1e-9)?.to ?? round6(v)
}

/** Does `other` stand against `rect`'s side over part of [a0,a1] (touching or overlapping it there)? */
function coveredSpans(rect: Rect, side: Facade, others: Rect[]): Array<[number, number]> {
  const spans: Array<[number, number]> = []
  for (const o of others) {
    const eps = 0.05
    if (side === 'FRONT' && o.z1 >= rect.z0 - eps && o.z0 < rect.z0 - eps) spans.push([Math.max(o.x0, rect.x0), Math.min(o.x1, rect.x1)])
    if (side === 'REAR' && o.z0 <= rect.z1 + eps && o.z1 > rect.z1 + eps) spans.push([Math.max(o.x0, rect.x0), Math.min(o.x1, rect.x1)])
    if (side === 'WEST' && o.x1 >= rect.x0 - eps && o.x0 < rect.x0 - eps) spans.push([Math.max(o.z0, rect.z0), Math.min(o.z1, rect.z1)])
    if (side === 'EAST' && o.x0 <= rect.x1 + eps && o.x1 > rect.x1 + eps) spans.push([Math.max(o.z0, rect.z0), Math.min(o.z1, rect.z1)])
  }
  return spans.filter(([a, b]) => b - a > 0.05)
}

/** A single slope over a body: one plane, its eave on the low side, as a plane-roof layout of one plane. */
function shedLayout(body: Rect, highSide: HouseSide, pitchDeg: number, lowEaveY: number): { layout: PlaneRoofLayout; ridgeAxis: 'X' | 'Z' } {
  const tan = tanDeg(pitchDeg)
  const alongX = highSide === 'FRONT' || highSide === 'REAR'
  const run = alongX ? body.z1 - body.z0 : body.x1 - body.x0
  const ridgeY = round6(lowEaveY + run * tan)
  const P = (x: number, z: number): { x: number; z: number } => ({ x: round6(x), z: round6(z) })
  const boundary = [P(body.x0, body.z0), P(body.x1, body.z0), P(body.x1, body.z1), P(body.x0, body.z1)]
  // the low edge: opposite the high side
  const low = highSide === 'REAR' ? { a: P(body.x0, body.z0), b: P(body.x1, body.z0), down: { x: 0, z: -1 }, key: 'LOW' as const } : highSide === 'FRONT' ? { a: P(body.x0, body.z1), b: P(body.x1, body.z1), down: { x: 0, z: 1 }, key: 'HIGH' as const } : highSide === 'RIGHT' ? { a: P(body.x0, body.z0), b: P(body.x0, body.z1), down: { x: -1, z: 0 }, key: 'LOW' as const } : { a: P(body.x1, body.z0), b: P(body.x1, body.z1), down: { x: 1, z: 0 }, key: 'HIGH' as const }
  const high = highSide === 'REAR' ? [P(body.x0, body.z1), P(body.x1, body.z1)] : highSide === 'FRONT' ? [P(body.x0, body.z0), P(body.x1, body.z0)] : highSide === 'RIGHT' ? [P(body.x1, body.z0), P(body.x1, body.z1)] : [P(body.x0, body.z0), P(body.x0, body.z1)]
  const sides = alongX ? [[P(body.x0, body.z0), P(body.x0, body.z1)], [P(body.x1, body.z0), P(body.x1, body.z1)]] : [[P(body.x0, body.z0), P(body.x1, body.z0)], [P(body.x0, body.z1), P(body.x1, body.z1)]]
  const layout: PlaneRoofLayout = {
    ridgeAt: alongX ? high[0].z : high[0].x,
    ridgeY,
    ridge: [high[0], high[1]],
    planes: [{ key: low.key, boundary, downslope: low.down, datum: { x: low.a.x, y: round6(lowEaveY), z: low.a.z }, pitchDeg }],
    joins: [],
    eaves: [{ key: low.key, start: low.a, end: low.b }],
    verges: sides.map((s) => ({ key: low.key, start: s[0], end: s[1] })),
  }
  return { layout, ridgeAxis: alongX ? 'X' : 'Z' }
}

/** The top a wall of `mass` may reach at a point along `facade`, under its roof: what an opening's head must stay under. */
function wallTopAt(mass: MassV2, facade: Facade, at: number, roof: PlaneRoofV2 | undefined, flat: AttachedRoofV2 | undefined, fallback: number): number {
  if (flat) return flat.slabSoffitY
  if (!roof) return fallback
  const p = facade === 'FRONT' ? { x: at, z: mass.z0 + 0.05 } : facade === 'REAR' ? { x: at, z: mass.z1 - 0.05 } : facade === 'WEST' ? { x: mass.x0 + 0.05, z: at } : { x: mass.x1 - 0.05, z: at }
  const plane = planeAt(roof.layout, p) ?? roof.layout.planes[0]
  const drop = (plane.datum.x - p.x) * plane.downslope.x + (plane.datum.z - p.z) * plane.downslope.z
  // the plane's top at the point: its datum lies on the eave, the surface rises against the downslope
  const top = plane.datum.y + drop * tanDeg(plane.pitchDeg)
  return top - roof.thicknessM / cosDeg(plane.pitchDeg)
}

/**
 * The described house as `BuildingV2`. Total: a description `checkHouseDescription` admitted always yields a building
 * with at least its main body; everything it could not place as stated is in `adjustments`.
 */
/**
 * What the drawings' path measured, where it measured anything — each measure with what it is a measure OF and what it
 * rests on (v3.53.2). A verified scale proves the size of what was measured; it does not prove that what was measured
 * is the whole house.
 *
 *  - `overall`: the whole building's outline in plan. Its premise is either the plan's own overall dimension lines
 *    (`OVERALL_DIMENSION_LINES`: the outline framed by its dimension chains on both axes — true of the house whether or
 *    not the model built all of it) or a model that is the whole reading (`COMPLETE_OUTLINE`: the extent of the walls
 *    it placed). A partial model's built extent is never an `overall`.
 *  - `bodies`: bodies the drawings' path placed at a verified scale. Each measures that body and nothing else.
 *  - `partial`: the drawings' model is not the whole house by its own account (a partial model, a body missing).
 *  - `storeyHeightM`: a storey height it measured.
 *
 * A measure outranks a published figure and the reader's own reading of size — of size only: none of this says which
 * bodies, roofs or openings there are. Each is applied by name or, where it cannot be, refused by name.
 */
export type DescribedAnchors = {
  overall?: { widthM: number; depthM: number; premise: 'OVERALL_DIMENSION_LINES' | 'COMPLETE_OUTLINE'; why: string }
  bodies?: Array<{ role: 'MAIN' | 'ATTACHED'; widthM: number; depthM: number; why: string }>
  partial?: boolean
  storeyHeightM?: { value: number; why: string }
}

export type DescribedBuildOptions = { published?: PublishedFigure[]; anchors?: DescribedAnchors }

export function buildingFromHouseDescription(input: HouseDescription, options: DescribedBuildOptions = {}): DescribedBuilding {
  const adjustments: DescribedAdjustment[] = []
  const adj = (code: DescribedAdjustmentCode, subject: string, why: string): void => void adjustments.push({ code, subject, why })
  const d = input

  // --- the frame: leftmost face x = 0, frontmost face z = 0; the bodies span the stated overall size ---------------
  const minX = Math.min(...d.bodies.map((b) => Math.min(b.x0, b.x1)))
  const minZ = Math.min(...d.bodies.map((b) => Math.min(b.z0, b.z1)))
  const spanX = Math.max(...d.bodies.map((b) => Math.max(b.x0, b.x1))) - minX
  const spanZ = Math.max(...d.bodies.map((b) => Math.max(b.z0, b.z1))) - minZ
  // The overall size a page publishes often takes in porches and decks: the bodies are compared with it together with
  // the roofs over open areas. Positions are scaled only by ONE factor on both axes (a unit or scale slip); a size that
  // disagrees on one axis only is left as stated and the disagreement stays a named issue of the description.
  const withCanopies = (pick: (r: { x0: number; x1: number; z0: number; z1: number }) => [number, number]): number => {
    const all = [...d.bodies, ...d.canopies].map(pick)
    return Math.max(...all.map((p) => Math.max(...p))) - Math.min(...all.map((p) => Math.min(...p)))
  }
  const fx = d.overall.widthM / withCanopies((r) => [r.x0, r.x1])
  const fz = d.overall.depthM / withCanopies((r) => [r.z0, r.z1])
  const rescale = Math.abs(fx - 1) > 0.08 && Math.abs(fz - 1) > 0.08 && Math.abs(fx / fz - 1) < 0.05
  // A size that is NOT printed on a drawing (scaled or estimated) and that the page's own figures contradict takes its
  // scale from those figures: the published width and length where both are given and the stated shape has their
  // proportion, else the published footprint area. One factor for every position: the shape is the reader's, the size
  // the page's. Named, and approximate — a published figure is not a dimension confirmed on the drawing.
  let kp = 1
  // What the drawings measured sets the size — within what each measure is a measure of.
  let anchored = false
  const sameShape = (aw: number, ad: number, w: number, dep: number): number | undefined => {
    // held both ways round (the two paths need not agree on which side is the front); one factor where both axes ask for the same one
    const ways = ([[aw, ad], [ad, aw]] as const).map(([p, q]) => ({ ax: p / w, az: q / dep })).filter((c) => Math.abs(c.ax / c.az - 1) < 0.1).map((c) => (c.ax + c.az) / 2)
    const k = ways.sort((p, q) => Math.abs(p - 1) - Math.abs(q - 1))[0]
    return k !== undefined && k > 0.5 && k < 2 ? k : undefined
  }
  const whole = options.anchors?.overall
  const local = options.anchors?.bodies ?? []
  if (whole && spanX > 0 && spanZ > 0) {
    // The whole outline, measured: the walls' extent as described is held against it. Proportions that disagree are not forced.
    const k = sameShape(whole.widthM, whole.depthM, spanX, spanZ)
    if (k !== undefined) {
      anchored = true
      kp = k
      adj('SCALED_TO_DRAWINGS_MEASURE', 'frame', `${whole.why}: the walls as described span ${spanX.toFixed(2)} × ${spanZ.toFixed(2)} m, every position scaled by ${k.toFixed(3)}`)
    } else adj('DRAWINGS_MEASURE_NOT_APPLIED', 'frame', `${whole.why}, but the walls as described span ${spanX.toFixed(2)} × ${spanZ.toFixed(2)} m — another proportion: the description keeps its own size`)
  } else if (local.length > 0) {
    // A measured BODY constrains the body it is, where that body can be told: one of the same role and the same shape.
    // Where the drawings built only part of the house, a description of ONE body cannot be told to be that part — the
    // part's size is not the house's. And a size the description read printed on a drawing is not overruled by a part:
    // the two are held against one another and the outcome is said.
    const main = local.find((b) => b.role === 'MAIN') ?? local[0]
    const candidates = d.bodies.filter((b) => (main.role === 'MAIN') === (b.role === 'MAIN')).map((b) => ({ b, k: sameShape(main.widthM, main.depthM, Math.abs(b.x1 - b.x0), Math.abs(b.z1 - b.z0)) })).filter((c): c is { b: DescribedBody; k: number } => c.k !== undefined)
    const partOfMore = options.anchors?.partial === true && d.bodies.length < 2
    if (partOfMore) adj('DRAWINGS_MEASURE_NOT_APPLIED', 'frame', `${main.why}; the drawings built only part of the house, and that part's size is not the size of the one body described`)
    else if (candidates.length !== 1) adj('DRAWINGS_MEASURE_NOT_APPLIED', 'frame', `${main.why}; ${candidates.length === 0 ? 'no described body of that role has its shape' : 'more than one described body has its shape'}: it cannot be told which body it measures`)
    else {
      const { b, k } = candidates[0]
      if (d.overall.basis === 'PRINTED_ON_DRAWING') {
        if (Math.abs(k - 1) <= 0.06) adj('DRAWINGS_LOCAL_MEASURE_AGREES', b.id, `${main.why}: ${b.id} as described is ${Math.abs(b.x1 - b.x0).toFixed(2)} × ${Math.abs(b.z1 - b.z0).toFixed(2)} m — the size read printed on the drawing stands`)
        else adj('DRAWINGS_LOCAL_MEASURE_DISAGREES', b.id, `${main.why}, but ${b.id} as described is ${Math.abs(b.x1 - b.x0).toFixed(2)} × ${Math.abs(b.z1 - b.z0).toFixed(2)} m: a measured body does not overrule a size read printed for the whole — neither is confirmed`)
      } else if (Math.abs(k - 1) > 0.02) {
        anchored = true
        kp = k
        adj('SCALED_TO_DRAWINGS_LOCAL_MEASURE', b.id, `${main.why}: ${b.id} as described is ${Math.abs(b.x1 - b.x0).toFixed(2)} × ${Math.abs(b.z1 - b.z0).toFixed(2)} m, every position scaled by ${k.toFixed(3)} — the other bodies keep the proportions they were described in`)
      } else {
        anchored = true
        adj('DRAWINGS_LOCAL_MEASURE_AGREES', b.id, `${main.why}: ${b.id} as described has that size`)
      }
    }
  }
  if (!anchored && d.overall.basis !== 'PRINTED_ON_DRAWING' && !rescale) {
    const fig = (key: string): number | undefined => options.published?.find((f) => f.key === key)?.value
    const pw = fig('building_width')
    const pl = fig('building_length')
    const pa = fig('footprint_area')
    const area = d.bodies.reduce((s, b) => s + Math.abs(b.x1 - b.x0) * Math.abs(b.z1 - b.z0), 0)
    const spanW = withCanopies((r) => [r.x0, r.x1])
    const spanD = withCanopies((r) => [r.z0, r.z1])
    const candidates: Array<{ k: number; why: string }> = []
    if (pw !== undefined && pl !== undefined) {
      for (const [w, l] of [[pw, pl], [pl, pw]]) if (Math.abs(w / spanW / (l / spanD) - 1) < 0.06) candidates.push({ k: (w / spanW + l / spanD) / 2, why: `the page publishes ${pw} × ${pl} m` })
    }
    if (candidates.length === 0 && pa !== undefined && area > 0) candidates.push({ k: Math.sqrt(pa / area), why: `the page publishes a footprint of ${pa} m², the bodies as stated cover ${area.toFixed(1)} m²` })
    const c = candidates.sort((a, b) => Math.abs(a.k - 1) - Math.abs(b.k - 1))[0]
    if (c && Math.abs(c.k - 1) > 0.06 && c.k > 0.6 && c.k < 1.6) {
      kp = c.k
      adj('SCALED_TO_PUBLISHED_FIGURE', 'frame', `the overall size is ${d.overall.basis.toLowerCase().replace(/_/g, ' ')} (${d.overall.widthM} × ${d.overall.depthM} m) and ${c.why}: every position scaled by ${c.k.toFixed(3)} — approximate, a published figure is not a dimension confirmed on a drawing`)
    }
  }
  const kx = anchored ? kp : rescale ? (fx + fz) / 2 : kp
  const kz = kx
  if (Math.abs(minX) > 1e-6 || Math.abs(minZ) > 1e-6) adj('FRAME_SHIFTED', 'frame', `the bodies started at x ${minX.toFixed(2)}, z ${minZ.toFixed(2)}: moved to the origin`)
  if (rescale && !anchored) adj('BODIES_RESCALED_TO_OVERALL', 'frame', `the bodies spanned ${spanX.toFixed(2)} × ${spanZ.toFixed(2)} m, the overall size is stated as ${d.overall.widthM} × ${d.overall.depthM} m: every position scaled by ${kx.toFixed(3)}`)
  const X = (x: number): number => (x - minX) * kx
  const Z = (z: number): number => (z - minZ) * kz
  const snapX = snapper(d.bodies.flatMap((b) => [X(b.x0), X(b.x1)]))
  const snapZ = snapper(d.bodies.flatMap((b) => [Z(b.z0), Z(b.z1)]))

  /** `roofRect`: the outline the roof keeps where the walls stand back from it under a recessed porch. */
  type Body = { src: DescribedBody; id: string; rect: Rect; roofRect?: Rect }
  const ordered = [...d.bodies].sort((a, b) => Number(b.role === 'MAIN') - Number(a.role === 'MAIN'))
  const bodies: Body[] = []
  for (const b of ordered) {
    const rect: Rect = { x0: snapX(Math.min(X(b.x0), X(b.x1))), x1: snapX(Math.max(X(b.x0), X(b.x1))), z0: snapZ(Math.min(Z(b.z0), Z(b.z1))), z1: snapZ(Math.max(Z(b.z0), Z(b.z1))) }
    // a body never stands inside one already placed: it is cut back along the axis that loses least
    for (const prev of bodies) {
      const ox = Math.min(rect.x1, prev.rect.x1) - Math.max(rect.x0, prev.rect.x0)
      const oz = Math.min(rect.z1, prev.rect.z1) - Math.max(rect.z0, prev.rect.z0)
      if (ox <= 1e-6 || oz <= 1e-6) continue
      const before = { ...rect }
      if (ox <= oz) {
        if (rect.x0 < prev.rect.x0) rect.x1 = prev.rect.x0
        else rect.x0 = prev.rect.x1
      } else if (rect.z0 < prev.rect.z0) rect.z1 = prev.rect.z0
      else rect.z0 = prev.rect.z1
      adj('BODY_CLIPPED', b.id, `it overlapped ${prev.src.id} by ${ox.toFixed(2)} × ${oz.toFixed(2)} m: cut back from ${before.x0}..${before.x1} × ${before.z0}..${before.z1} to ${rect.x0}..${rect.x1} × ${rect.z0}..${rect.z1}`)
    }
    if (rect.x1 - rect.x0 < 1.2 || rect.z1 - rect.z0 < 1.2) {
      adj('BODY_DROPPED', b.id, `after placing, ${Math.max(0, rect.x1 - rect.x0).toFixed(2)} × ${Math.max(0, rect.z1 - rect.z0).toFixed(2)} m is left of it: too small to build`)
      continue
    }
    bodies.push({ src: b, id: b.role === 'MAIN' ? 'main' : `body-${b.id}`, rect })
  }
  // --- canopies stated WITHIN a body's walls ------------------------------------------------------------------------------
  // The reader was asked for roofs over OPEN areas. One stated inside a body, against one of its faces, is either
  //  - shallow (under a metre): a canopy over a door that the reader kept inside the frame — it projects from that face;
  //  - across the whole face and deeper: a porch or terrace under the body's own roof — the walls stand back by its
  //    depth, the roof keeps its outline, its posts stand where the face was;
  //  - over part of a face, or at a corner, a metre deep or more: a recess cut into the body on the ground storey — a
  //    passage through the body's own wall over its mouth, the wall behind it with the openings stated on that side,
  //    a post at an open corner — under whatever the body carries above it (v3.53.2);
  //  - anything else: said, and not built.
  const canopyRect = (c: HouseDescription['canopies'][number]): Rect => ({ x0: round6(Math.min(X(c.x0), X(c.x1))), x1: round6(Math.max(X(c.x0), X(c.x1))), z0: round6(Math.min(Z(c.z0), Z(c.z1))), z1: round6(Math.max(Z(c.z0), Z(c.z1))) })
  type CanopyPlan = { kind: 'OPEN' } | { kind: 'PROJECTS'; rect: Rect; from: string } | { kind: 'RECESS'; body: Body; facade: Facade; rect: Rect } | { kind: 'POCKET'; body: Body; facade: Facade; rect: Rect; corner?: { xSide: 'WEST' | 'EAST'; zSide: 'FRONT' | 'REAR' } } | { kind: 'UNBUILT'; why: string }
  const canopyPlans: CanopyPlan[] = d.canopies.map((c) => {
    const r = canopyRect(c)
    const host = bodies.find((b) => r.x0 >= b.rect.x0 - 0.05 && r.x1 <= b.rect.x1 + 0.05 && r.z0 >= b.rect.z0 - 0.05 && r.z1 <= b.rect.z1 + 0.05)
    if (!host) return { kind: 'OPEN' }
    const h = host.rect
    const on: Facade[] = []
    if (Math.abs(r.z0 - h.z0) <= 0.05) on.push('FRONT')
    if (Math.abs(r.z1 - h.z1) <= 0.05) on.push('REAR')
    if (Math.abs(r.x0 - h.x0) <= 0.05) on.push('WEST')
    if (Math.abs(r.x1 - h.x1) <= 0.05) on.push('EAST')
    const acrossX = Math.abs(r.x0 - h.x0) <= 0.3 && Math.abs(r.x1 - h.x1) <= 0.3
    const acrossZ = Math.abs(r.z0 - h.z0) <= 0.3 && Math.abs(r.z1 - h.z1) <= 0.3
    const face = on.find((f) => (f === 'FRONT' || f === 'REAR' ? !acrossZ : !acrossX))
    if (!face) return { kind: 'UNBUILT', why: `it is stated in the middle of ${host.src.id}, against none of its faces` }
    const alongX = face === 'FRONT' || face === 'REAR'
    const depth = alongX ? r.z1 - r.z0 : r.x1 - r.x0
    if (depth < RECESS_MIN_DEPTH_M && on.length === 1) {
      const out: Rect = face === 'FRONT' ? { ...r, z0: h.z0 - depth, z1: h.z0 } : face === 'REAR' ? { ...r, z0: h.z1, z1: h.z1 + depth } : face === 'WEST' ? { ...r, x0: h.x0 - depth, x1: h.x0 } : { ...r, x0: h.x1, x1: h.x1 + depth }
      return { kind: 'PROJECTS', rect: out, from: host.src.id }
    }
    const across = alongX ? acrossX : acrossZ
    const left = alongX ? h.z1 - h.z0 - depth : h.x1 - h.x0 - depth
    if (across && host.src.roof.kind !== 'FLAT' && depth >= RECESS_MIN_DEPTH_M && left >= 3) return { kind: 'RECESS', body: host, facade: face, rect: r }
    // a recess cut into the body: at a corner (against two faces that meet) or inside one face
    const inside: Rect = { x0: Math.max(r.x0, h.x0), z0: Math.max(r.z0, h.z0), x1: Math.min(r.x1, h.x1), z1: Math.min(r.z1, h.z1) }
    const [w, dz] = [inside.x1 - inside.x0, inside.z1 - inside.z0]
    const zSide = on.find((f): f is 'FRONT' | 'REAR' => f === 'FRONT' || f === 'REAR')
    const xSide = on.find((f): f is 'WEST' | 'EAST' => f === 'WEST' || f === 'EAST')
    const others = bodies.filter((b) => b !== host).map((b) => b.rect)
    const free = (f: Facade, from: number, to: number): boolean => coveredSpans(h, f, others).every(([a, b]) => Math.min(b, to) - Math.max(a, from) <= 0.05)
    const roomLeft = h.x1 - h.x0 - w >= 3 && h.z1 - h.z0 - dz >= 3
    if (!across && Math.min(w, dz) >= RECESS_MIN_DEPTH_M && roomLeft && on.length === 2 && zSide && xSide && !acrossX && !acrossZ) {
      if (free(zSide, inside.x0, inside.x1) && free(xSide, inside.z0, inside.z1)) return { kind: 'POCKET', body: host, facade: zSide, rect: inside, corner: { xSide, zSide } }
      return { kind: 'UNBUILT', why: `it is stated in a corner of ${host.src.id} where another body stands against it: a recess of a form this builder does not cut` }
    }
    if (!across && on.length === 1 && depth >= RECESS_MIN_DEPTH_M && left >= 3) {
      const [m0, m1] = alongX ? [inside.x0 - h.x0, h.x1 - inside.x1] : [inside.z0 - h.z0, h.z1 - inside.z1]
      const span: [number, number] = alongX ? [inside.x0, inside.x1] : [inside.z0, inside.z1]
      if (Math.min(m0, m1) >= WALL_T + 0.3 && span[1] - span[0] >= 1 && free(face, span[0], span[1])) return { kind: 'POCKET', body: host, facade: face, rect: inside }
    }
    return { kind: 'UNBUILT', why: `it is stated within ${host.src.id}'s walls${across ? '' : ', over part of a face'} — a recessed porch of a form this builder does not cut into a body yet` }
  })
  canopyPlans.forEach((plan, n) => {
    if (plan.kind !== 'RECESS') return
    const b = plan.body
    if (b.roofRect) return void (canopyPlans[n] = { kind: 'UNBUILT', why: `${b.src.id} already stands back under its roof on another side` })
    // a body whose walls move cannot also be cut where they stood
    canopyPlans.forEach((other, k) => {
      if (other.kind === 'POCKET' && other.body === b) canopyPlans[k] = { kind: 'UNBUILT', why: `${b.src.id} stands back under its roof on another side: a recess cut into the face it had is not built as well` }
    })
    b.roofRect = { ...b.rect }
    const r = plan.rect
    if (plan.facade === 'FRONT') b.rect = { ...b.rect, z0: r.z1 }
    else if (plan.facade === 'REAR') b.rect = { ...b.rect, z1: r.z0 }
    else if (plan.facade === 'WEST') b.rect = { ...b.rect, x0: r.x1 }
    else b.rect = { ...b.rect, x1: r.x0 }
    adj('FEATURE_ADJUSTED', `canopy ${n + 1}`, `it is stated within ${b.src.id}'s walls across its whole ${plan.facade.toLowerCase()} face: ${b.src.id}'s walls stand back by its depth under the roof, which keeps its outline`)
  })

  const mainMassId = 'main'

  // --- levels ------------------------------------------------------------------------------------------------------
  const measuredH = options.anchors?.storeyHeightM
  const H = round6(measuredH ? clamp(measuredH.value, 2.2, 4.5) : clamp(d.overall.storeyHeightM, 2.5, 3.6))
  if (measuredH) adj('HEIGHT_FROM_DRAWINGS_MEASURE', 'levels', `${measuredH.why}: storeys built ${H.toFixed(2)} m high (described as ${d.overall.storeyHeightM} m)`)
  const levelsOf = (b: DescribedBody): number => b.storeys + (b.habitableAttic && b.roof.kind !== 'FLAT' ? 1 : 0)
  const nLevels = Math.max(...bodies.map((b) => levelsOf(b.src)))
  const levels: LevelV2[] = Array.from({ length: nLevels }, (_, i) => ({ index: i, id: `lvl-${i}`, elevation: round6(i * H), height: H, wallTop: round6((i + 1) * H), featureId: `described-level-${i}` }))
  const prov: ProvenanceStatus = 'VISUAL_SEMANTIC'

  const masses: MassV2[] = bodies.map((b) => ({ id: b.id, role: b.id === mainMassId ? 'MAIN' : 'ATTACHED', ...b.rect, storeys: Array.from({ length: levelsOf(b.src) }, (_, i) => i), featureId: `described-body-${b.src.id}`, sourceMassId: `described-${b.src.id}` }))
  const massOf = (bodyId: string): MassV2 | undefined => masses[bodies.findIndex((b) => b.src.id === bodyId)]

  // --- roofs ---------------------------------------------------------------------------------------------------------
  const planeRoofs: PlaneRoofV2[] = []
  const attachedRoofs: AttachedRoofV2[] = []
  bodies.forEach((b, i) => {
    const m = masses[i]
    const src = b.src
    const top = Math.max(...m.storeys)
    const attic = src.habitableAttic && src.roof.kind !== 'FLAT'
    const floorTop = top * H
    // rooms in the roof: the walls of that storey must clear the roof's own build-up at the eaves to have any material
    const kneeMin = src.roof.kind === 'FLAT' ? 0.3 : ROOF_THICKNESS_M / cosDeg(clamp(src.roof.pitchDeg || 30, 8, 60)) + 0.15
    const [lo, hi] = attic ? [floorTop + kneeMin, floorTop + 2.4] : [floorTop + 2.2, floorTop + H + 0.8]
    const eaveY = round6(clamp(src.eavesHeightM, lo, hi))
    if (Math.abs(eaveY - src.eavesHeightM) > 0.05) adj('EAVES_HEIGHT_CLAMPED', src.id, `eaves stated at ${src.eavesHeightM} m, ${src.storeys} full storey(s)${attic ? ' and rooms in the roof' : ''} at ${H} m each put them at ${lo.toFixed(2)}..${hi.toFixed(2)} m: built at ${eaveY}`)
    const others = bodies.filter((o) => o !== b).map((o) => o.rect)
    let kind = src.roof.kind
    if (kind === 'FLAT') {
      // The stated eaves height is the top of the walls; the roof plate lies within them, its top below their top by a
      // low upstand — a plate flush with the wall tops would draw its bearing strip and the wall top in one plane.
      attachedRoofs.push({ massId: m.id, slabTopY: round6(eaveY - FLAT_ROOF_UPSTAND_M), slabSoffitY: round6(eaveY - FLAT_ROOF_UPSTAND_M - 0.25), parapetTopY: eaveY, footprint: { ...b.rect }, projectsOverZone: false, featureId: `described-roof-${src.id}`, provenance: prov })
      return
    }
    let pitch = src.roof.pitchDeg
    if (!(pitch >= 8)) {
      pitch = kind === 'SHED' ? 12 : 30
      adj('ROOF_PITCH_ASSUMED', src.id, `a ${kind.toLowerCase()} roof stated at ${src.roof.pitchDeg}°: built at ${pitch}°`)
    }
    pitch = clamp(pitch, 8, 60)
    if (kind === 'HALF_HIP' || kind === 'MANSARD' || kind === 'OTHER') {
      adj('ROOF_KIND_STOOD_IN', src.id, `a ${kind.toLowerCase().replace('_', '-')} roof is not a form the model builds: a gable of the stated pitch and ridge stands in for it`)
      kind = 'GABLE'
    }
    if (kind === 'SHED') {
      const highSide: HouseSide = src.roof.highSide === 'NA' ? 'REAR' : src.roof.highSide
      const shed = shedLayout(b.roofRect ?? b.rect, highSide, pitch, eaveY)
      planeRoofs.push({ massId: m.id, ridgeAxis: shed.ridgeAxis, pitchDeg: pitch, eaveY, ridgeY: shed.layout.ridgeY, ends: { min: 'GABLE', max: 'GABLE' }, thicknessM: ROOF_THICKNESS_M, layout: shed.layout, featureId: `described-roof-${src.id}`, provenance: prov, why: `a single slope at ${pitch}°, highest on the ${highSide.toLowerCase()} side, as the sources show it` })
      return
    }
    // the roof is laid out over the outline it keeps; under a recessed porch the walls stand back from it
    const rr = b.roofRect ?? b.rect
    const w = rr.x1 - rr.x0
    const dep = rr.z1 - rr.z0
    let ridgeAxis: 'X' | 'Z' = src.roof.ridge === 'ALONG_X' ? 'X' : src.roof.ridge === 'ALONG_Z' ? 'Z' : w >= dep ? 'X' : 'Z'
    // A hip of one pitch over a rectangle has its ridge along the longer side — geometry, not a reading: across the
    // shorter side the two hip ends would meet before any ridge. A ridge stated that way is turned, by name. A body
    // within a metre of square keeps what was read: its ridge is shorter than that metre either way.
    if (kind === 'HIP' && Math.abs(w - dep) >= HIP_RIDGE_MARGIN_M && ridgeAxis !== (w > dep ? 'X' : 'Z')) {
      ridgeAxis = w > dep ? 'X' : 'Z'
      adj('HIP_RIDGE_ALONG_LONGER_SIDE', src.id, `a hip roof stated with its ridge across the shorter side of a ${w.toFixed(1)} × ${dep.toFixed(1)} m body: at one pitch the ridge runs along the longer side`)
    }
    const ends: { min: RoofEnd; max: RoofEnd } = kind === 'HIP' || kind === 'PYRAMID' ? { min: 'HIP', max: 'HIP' } : { min: 'GABLE', max: 'GABLE' }
    // the eaves stand out past the walls where nothing stands against them; the plane passes through the wall's top edge
    const eaveSides: Facade[] = ridgeAxis === 'X' ? ['FRONT', 'REAR'] : ['WEST', 'EAST']
    const endSides: Facade[] = ridgeAxis === 'X' ? ['WEST', 'EAST'] : ['FRONT', 'REAR']
    const free = (s: Facade): boolean => coveredSpans(rr, s, others).length === 0
    const over = clamp(src.roof.overhangM, 0, 0.8)
    // under a hip every side is an eave and all four lie at one height: the eaves stand out by one amount all round, or
    // (where a body stands against any side) not at all — an end eave set in from the others would sit below its wall
    const hipped = ends.min === 'HIP'
    const eaveOut = hipped ? ([...eaveSides, ...endSides].every(free) ? over : 0) : eaveSides.every(free) ? over : 0
    const endOut = (s: Facade): number => (hipped ? eaveOut : free(s) ? Math.min(over, 0.4) : 0)
    const body: Rect = ridgeAxis === 'X' ? { x0: rr.x0 - endOut(endSides[0]), x1: rr.x1 + endOut(endSides[1]), z0: rr.z0 - eaveOut, z1: rr.z1 + eaveOut } : { x0: rr.x0 - eaveOut, x1: rr.x1 + eaveOut, z0: rr.z0 - endOut(endSides[0]), z1: rr.z1 + endOut(endSides[1]) }
    const layoutEave = round6(eaveY - eaveOut * tanDeg(pitch))
    const layout = planeRoofLayout({ x0: round6(body.x0), x1: round6(body.x1), z0: round6(body.z0), z1: round6(body.z1) }, ridgeAxis, pitch, layoutEave, ends)
    planeRoofs.push({ massId: m.id, ridgeAxis, pitchDeg: pitch, eaveY: layoutEave, ridgeY: layout.ridgeY, ends, thicknessM: ROOF_THICKNESS_M, layout, featureId: `described-roof-${src.id}`, provenance: prov, why: `a ${kind.toLowerCase()} roof at ${pitch}° (${src.roof.pitchBasis.toLowerCase().replace(/_/g, ' ')}), its ridge ${ridgeAxis === 'X' ? 'along the front' : 'front to back'}, eaves at ${eaveY} m, as the sources show it` })
  })
  // --- a gable whose ridge runs INTO a neighbour's slope is a cross gable: its planes run on over that slope to the
  // valleys where the two surfaces meet, instead of stopping as a wall above the neighbour's eaves ---------------------
  const pitchedAttachedRoofs: PitchedAttachedRoofV2[] = []
  for (const own of [...planeRoofs]) {
    if (own.massId === mainMassId || own.layout.planes.length !== 2 || own.ends.min !== 'GABLE' || own.ends.max !== 'GABLE') continue
    const m = masses.find((x) => x.id === own.massId) as MassV2
    const [t0, t1] = own.ridgeAxis === 'X' ? [m.x0, m.x1] : [m.z0, m.z1]
    const [u0, u1] = own.ridgeAxis === 'X' ? [m.z0, m.z1] : [m.x0, m.x1]
    for (const host of planeRoofs) {
      if (host === own || host.ridgeAxis === own.ridgeAxis || host.layout.planes.length < 2) continue
      const h = masses.find((x) => x.id === host.massId) as MassV2
      const [ht0, ht1] = own.ridgeAxis === 'X' ? [h.x0, h.x1] : [h.z0, h.z1]
      const [hu0, hu1] = own.ridgeAxis === 'X' ? [h.z0, h.z1] : [h.x0, h.x1]
      const party: 'MIN' | 'MAX' | undefined = Math.abs(t0 - ht1) <= 0.05 ? 'MIN' : Math.abs(t1 - ht0) <= 0.05 ? 'MAX' : undefined
      if (!party || u0 < hu0 - 0.05 || u1 > hu1 + 0.05) continue
      // the host's top surface at its wall line on the party side: its ridge less the fall over the run to that wall
      const partyAt = party === 'MIN' ? ht1 : ht0
      const hostWallEave = host.ridgeY - Math.abs(host.layout.ridgeAt - partyAt) * tanDeg(host.pitchDeg)
      const join: MainRoofForJoin = { ridgeAxis: host.ridgeAxis, ridgeAt: host.layout.ridgeAt, eaveY: round6(hostWallEave), ridgeY: host.ridgeY, pitchDeg: host.pitchDeg, footprint: { x0: h.x0, x1: h.x1, z0: h.z0, z1: h.z1 } }
      const src = bodies.find((b) => b.id === m.id)?.src as DescribedBody
      const body = { x0: m.x0, x1: m.x1, z0: m.z0, z1: m.z1 }
      // this roof's top surface at its own wall lines (no eaves projection on a cross gable)
      const ownEave = round6(own.ridgeY - ((u1 - u0) / 2) * tanDeg(own.pitchDeg))
      const layout = attachedGableLayout(body, own.ridgeAxis, own.pitchDeg, ownEave, join, { anyEaves: true })
      if (layout.join.kind !== 'VALLEY') continue
      const hostKey: PlaneRoofKey = party === 'MIN' ? 'HIGH' : 'LOW'
      pitchedAttachedRoofs.push({ massId: m.id, kind: 'GABLE', ridgeAxis: own.ridgeAxis, pitchDeg: own.pitchDeg, pitchSource: src.roof.pitchBasis === 'PRINTED_ON_DRAWING' || src.roof.pitchBasis === 'PUBLISHED_ON_PAGE' ? 'STATED' : 'MEASURED', eaveY: ownEave, ridgeY: layout.ridgeY, thicknessM: ROOF_THICKNESS_M, footprint: body, layout, form: { kind: 'GABLE', ridgeAxis: own.ridgeAxis, pitchDeg: own.pitchDeg, pitchSource: 'MEASURED', measuredRiseM: round6(layout.ridgeY - ownEave), expectedRiseM: round6(layout.ridgeY - ownEave), readings: [], confidence: src.confidence, why: own.why }, joinRoofId: `roof-${host.massId}-plane-${hostKey.toLowerCase()}`, featureId: own.featureId, provenance: prov })
      planeRoofs.splice(planeRoofs.indexOf(own), 1)
      break
    }
  }
  // the main body's roof first: a chimney is cut in the first plane roof
  planeRoofs.sort((a, b) => Number(b.massId === mainMassId) - Number(a.massId === mainMassId))
  const roofOf = (massId: string): PlaneRoofV2 | undefined => planeRoofs.find((r) => r.massId === massId)
  const flatOf = (massId: string): AttachedRoofV2 | undefined => attachedRoofs.find((r) => r.massId === massId)

  // --- recesses cut into a body (v3.53.2) --------------------------------------------------------------------------------
  // The model's own pocket: the body's ring wall keeps running over the mouth above a passage; a wall of its own stands
  // behind it. At a corner the two faces each open through the corner block and a post stands where they met.
  const pockets: PocketV2[] = []
  type PocketSeat = { pocket: PocketV2; from: number; to: number; faceAt: number }
  const seats: PocketSeat[] = []
  canopyPlans.forEach((plan, n) => {
    if (plan.kind !== 'POCKET') return
    const c = d.canopies[n]
    const mass = masses[bodies.indexOf(plan.body)]
    const body: Rect = { x0: mass.x0, z0: mass.z0, x1: mass.x1, z1: mass.z1 }
    const r = plan.rect
    // the head of the passage: the underside the reader states, under the storey's ceiling
    const headY = round6(clamp(c.undersideM, 2.05, H - 0.3))
    const featureId = `described-canopy-${n + 1}`
    const name = `canopy ${n + 1}`
    const told = `a ${c.kind.toLowerCase().replace(/_/g, ' ')} stated within ${plan.body.src.id}'s walls, as pictures ${c.images.join(', ')} show it`
    const add = (pocket: PocketV2, seat: { from: number; to: number; faceAt: number }): void => {
      pockets.push(pocket)
      seats.push({ pocket, ...seat })
    }
    if (plan.corner) {
      const { xSide, zSide } = plan.corner
      const cx = xSide === 'WEST' ? body.x0 : body.x1
      const cz = zSide === 'FRONT' ? body.z0 : body.z1
      const P = 0.3
      const post: Rect = { x0: round6(xSide === 'WEST' ? cx : cx - P), x1: round6(xSide === 'WEST' ? cx + P : cx), z0: round6(zSide === 'FRONT' ? cz : cz - P), z1: round6(zSide === 'FRONT' ? cz + P : cz) }
      const why = `${told}: a recess ${(r.x1 - r.x0).toFixed(2)} × ${(r.z1 - r.z0).toFixed(2)} m cut out of its ${zSide.toLowerCase()}-${xSide.toLowerCase()} corner on the ground storey, open on both faces under a head at ${headY.toFixed(2)} m`
      for (const spec of cornerPocketSpecs({ xSide, zSide, rect: r, backShares: [1, 1], ...(c.posts > 0 ? { post } : {}), why }, body, WALL_T)) {
        const id = `pocket-${mass.id}-0-${pockets.length}`
        add({ id, massId: mass.id, facade: spec.facade, storeyIndex: 0, from: spec.from, to: spec.to, mouthAt: spec.mouthAt, backAt: spec.backAt, headY, headProvenance: prov, walls: [{ id: `${id}-back`, role: 'BACK', start: spec.back.start, end: spec.back.end, thicknessM: WALL_T }], backOpenings: [], openEnd: spec.openEnd, ...(spec.carriesPost && c.posts > 0 ? { post } : {}), featureId, why }, { from: spec.back.from, to: spec.back.to, faceAt: spec.back.faceAt })
      }
      adj('FEATURE_ADJUSTED', name, `it is stated within ${plan.body.src.id}'s walls at its ${zSide.toLowerCase()}-${xSide.toLowerCase()} corner: built as a recess cut out of that corner under what the body carries above it${c.posts > 0 ? ', with a post at the corner' : ''}, not as a roof of its own`)
      return
    }
    const facade = plan.facade
    const alongX = facade === 'FRONT' || facade === 'REAR'
    const inward = facade === 'FRONT' || facade === 'WEST' ? 1 : -1
    const mouthAt = facade === 'FRONT' ? body.z0 : facade === 'REAR' ? body.z1 : facade === 'WEST' ? body.x0 : body.x1
    const backFace = facade === 'FRONT' ? r.z1 : facade === 'REAR' ? r.z0 : facade === 'WEST' ? r.x1 : r.x0
    const [lowFace, highFace] = alongX ? [r.x0, r.x1] : [r.z0, r.z1]
    const ring0 = mouthAt + inward * WALL_T
    const back1 = backFace + inward * WALL_T
    const at = (u: number, v: number): { x: number; z: number } => (alongX ? { x: round6(u), z: round6(v) } : { x: round6(v), z: round6(u) })
    // a wall is given by its face towards the recess, its material to the left of its run
    const faced = (a: { x: number; z: number }, b: { x: number; z: number }, material: { x: number; z: number }): { start: { x: number; z: number }; end: { x: number; z: number } } => {
      const dir = { x: b.x - a.x, z: b.z - a.z }
      return -dir.z * material.x + dir.x * material.z > 0 ? { start: a, end: b } : { start: b, end: a }
    }
    const lowDir = alongX ? { x: -1, z: 0 } : { x: 0, z: -1 }
    const highDir = alongX ? { x: 1, z: 0 } : { x: 0, z: 1 }
    const deepDir = alongX ? { x: 0, z: inward } : { x: inward, z: 0 }
    const id = `pocket-${mass.id}-0-${pockets.length}`
    const why = `${told}: a recess ${(highFace - lowFace).toFixed(2)} m wide and ${Math.abs(backFace - mouthAt).toFixed(2)} m deep in its ${facade.toLowerCase()} face on the ground storey, under a head at ${headY.toFixed(2)} m`
    add(
      {
        id,
        massId: mass.id,
        facade,
        storeyIndex: 0,
        from: round6(lowFace),
        to: round6(highFace),
        mouthAt: round6(mouthAt),
        backAt: round6(backFace),
        headY,
        headProvenance: prov,
        walls: [
          { id: `${id}-return-low`, role: 'RETURN', ...faced(at(lowFace, ring0), at(lowFace, back1), lowDir), thicknessM: WALL_T },
          { id: `${id}-return-high`, role: 'RETURN', ...faced(at(highFace, ring0), at(highFace, back1), highDir), thicknessM: WALL_T },
          { id: `${id}-back`, role: 'BACK', ...faced(at(lowFace, backFace), at(highFace, backFace), deepDir), thicknessM: WALL_T },
        ],
        backOpenings: [],
        featureId,
        why,
      },
      { from: round6(lowFace), to: round6(highFace), faceAt: round6(backFace) },
    )
    adj('FEATURE_ADJUSTED', name, `it is stated within ${plan.body.src.id}'s walls over part of its ${facade.toLowerCase()} face: built as a recess cut into that face under what the body carries above it, not as a roof of its own`)
  })

  // --- openings --------------------------------------------------------------------------------------------------------
  const openings: OpeningV2[] = []
  const FAMILY: Record<DescribedOpening['kind'], OpeningFamily> = { WINDOW: 'WINDOW', LARGE_GLAZING: 'MULTI_PANEL_GLAZING', ENTRANCE_DOOR: 'DOOR', DOOR: 'DOOR', GLAZED_DOOR: 'GLAZED_DOOR', GARAGE_DOOR: 'GARAGE_DOOR' }
  const taken = new Map<string, Array<[number, number]>>()
  d.openings.forEach((o, n) => {
    const name = `opening ${n + 1} (${o.kind.toLowerCase()} on ${o.side.toLowerCase()}, storey ${o.storey})`
    const facade = FACADE[o.side]
    const alongX = facade === 'FRONT' || facade === 'REAR'
    const at = alongX ? snapX(X(o.at)) : snapZ(Z(o.at))
    // the body named, when its wall holds the point; otherwise the body whose outer wall on that side does
    const holds = (m: MassV2): boolean => m.storeys.includes(o.storey) && (alongX ? at > m.x0 + WALL_T && at < m.x1 - WALL_T : at > m.z0 + WALL_T && at < m.z1 - WALL_T)
    const named = massOf(o.bodyId)
    const outer = (m: MassV2): number => (facade === 'FRONT' ? -m.z0 : facade === 'REAR' ? m.z1 : facade === 'WEST' ? -m.x0 : m.x1)
    const mass = named && holds(named) ? named : [...masses].filter(holds).sort((a, b) => outer(b) - outer(a))[0]
    if (!mass) return adj('OPENING_DROPPED', name, `no body has a wall on that side at ${at.toFixed(2)} m on storey ${o.storey}`)
    if (mass !== named) adj('OPENING_MOVED_TO_WALL', name, `${o.bodyId} has no wall there on that storey: placed in ${mass.id}'s wall, which stands at that position`)
    const rect: Rect = { x0: mass.x0, z0: mass.z0, x1: mass.x1, z1: mass.z1 }
    // where the face is cut back into a recess on this storey, what is stated there stands in the wall behind it
    const seat = seats.find((q) => q.pocket.massId === mass.id && q.pocket.facade === facade && q.pocket.storeyIndex === o.storey && at > q.pocket.from && at < q.pocket.to)
    const key = seat ? `pocket:${seat.pocket.id}` : `${mass.id}:${facade}:${o.storey}`
    const [w0, w1] = seat ? [seat.from - WALL_T, seat.to + WALL_T] : alongX ? [mass.x0, mass.x1] : [mass.z0, mass.z1]
    let lo = at - (o.widthM * kx) / 2
    let hi = at + (o.widthM * kx) / 2
    // not where another body stands against this wall on this storey
    const against = seat ? [] : coveredSpans(rect, facade, masses.filter((x) => x !== mass && x.storeys.includes(o.storey)).map((x) => ({ x0: x.x0, z0: x.z0, x1: x.x1, z1: x.z1 })))
    // nor in the mouth of a recess: that part of the face is a passage
    const mouths = seat ? [] : seats.filter((q) => q.pocket.massId === mass.id && q.pocket.facade === facade && q.pocket.storeyIndex === o.storey).map((q): [number, number] => [q.pocket.from, q.pocket.to])
    const blocked = [...against, ...mouths, ...(taken.get(key) ?? [])]
    const limLo = Math.max(w0 + WALL_T + 0.1, ...blocked.filter(([, b]) => b <= at + 1e-6).map(([, b]) => b + 0.12))
    const limHi = Math.min(w1 - WALL_T - 0.1, ...blocked.filter(([a]) => a >= at - 1e-6).map(([a]) => a - 0.12))
    if (blocked.some(([a, b]) => at > a && at < b)) return adj('OPENING_DROPPED', name, `at ${at.toFixed(2)} m another body or an opening already placed stands in that wall`)
    if (lo < limLo || hi > limHi) {
      const was = hi - lo
      lo = Math.max(lo, limLo)
      hi = Math.min(hi, limHi)
      if (hi - lo < Math.min(0.5, was)) return adj('OPENING_DROPPED', name, `only ${Math.max(0, hi - lo).toFixed(2)} m of wall is free there`)
      adj('OPENING_NARROWED', name, `${was.toFixed(2)} m wide as stated, ${(hi - lo).toFixed(2)} m of wall is free there`)
    }
    const floor = o.storey * H
    const isTop = o.storey === Math.max(...mass.storeys)
    const door = o.kind !== 'WINDOW' && o.kind !== 'LARGE_GLAZING'
    const sill = round6(floor + (door ? 0 : clamp(o.sillM, 0, 2.2)))
    const roof = roofOf(mass.id)
    const flat = flatOf(mass.id)
    const cross = pitchedAttachedRoofs.find((r) => r.massId === mass.id)
    const crossTop = cross ? (alongX === (cross.ridgeAxis === 'X') ? cross.eaveY - cross.thicknessM / cosDeg(cross.pitchDeg) : cross.eaveY + Math.max(0, Math.min(lo - (alongX ? mass.x0 : mass.z0), (alongX ? mass.x1 : mass.z1) - hi)) * tanDeg(cross.pitchDeg) - cross.thicknessM / cosDeg(cross.pitchDeg)) : undefined
    const ceiling = crossTop !== undefined && isTop ? crossTop - 0.12 : isTop ? Math.min(wallTopAt(mass, facade, lo + 0.05, roof, flat, floor + H), wallTopAt(mass, facade, hi - 0.05, roof, flat, floor + H)) - 0.12 : floor + H - 0.3
    let head = round6(sill + o.heightM)
    if (head > ceiling) {
      if (ceiling - sill < 0.45) return adj('OPENING_DROPPED', name, `the wall is ${(ceiling - floor).toFixed(2)} m high under the roof there: no room for it at a sill of ${(sill - floor).toFixed(2)} m`)
      if (head - ceiling > 0.08) adj('OPENING_LOWERED', name, `head stated at ${(head - floor).toFixed(2)} m above the floor, the wall under the roof there reaches ${(ceiling - floor).toFixed(2)} m`)
      head = round6(ceiling)
    }
    taken.set(key, [...(taken.get(key) ?? []), [lo, hi]])
    if (seat) adj('OPENING_MOVED_TO_WALL', name, `the ${facade.toLowerCase()} face is cut back into a recess there: it stands in the wall behind the recess`)
    const status: ProvenanceStatus = o.basis === 'HYPOTHETICAL' ? 'ASSUMED_FOR_RENDERING' : prov
    const width = round6(hi - lo)
    const panes = Math.min(o.panes, Math.max(1, Math.floor(width / 0.45)))
    ;(seat ? seat.pocket.backOpenings : openings).push({
      id: `opening-${facade.toLowerCase()}-${o.storey}-${n + 1}`,
      storeyIndex: o.storey,
      massId: mass.id,
      facade,
      planeAt: seat ? seat.faceAt : facade === 'FRONT' ? mass.z0 : facade === 'REAR' ? mass.z1 : facade === 'WEST' ? mass.x0 : mass.x1,
      interval: [round6(lo), round6(hi)],
      widthM: width,
      sillY: sill,
      headY: head,
      profile: 'RECTANGULAR',
      family: FAMILY[o.kind],
      mullions: door || panes < 2 ? [] : Array.from({ length: panes - 1 }, (_, k) => round6((k + 1) / panes)),
      planGap: { frameId: 'described-house', pixelRect: { x0: 0, y0: 0, x1: 0, y1: 0 } },
      provenance: { interval: status, width: status, sill: status, head: status, profile: 'ASSUMED_FOR_RENDERING', family: status },
      uncertaintyM: o.basis === 'PLAN_AND_ELEVATION' ? 0.2 : 0.4,
      unresolved: [`described from the sources (${o.basis.toLowerCase().replace(/_/g, ' ')}), not measured on a registered drawing`],
      confidence: o.confidence,
      why: `a ${o.kind.toLowerCase().replace(/_/g, ' ')} ${o.widthM} m wide at ${o.at} m along the ${o.side.toLowerCase()} wall, as the sources' pictures ${o.images.join(', ')} show it`,
    })
  })

  // --- dormers, rooflights, chimneys -------------------------------------------------------------------------------------
  const planeKeyFor = (roof: PlaneRoofV2, side: HouseSide): PlaneRoofKey | undefined => {
    const want: PlaneRoofKey = roof.ridgeAxis === 'X' ? (side === 'FRONT' ? 'LOW' : side === 'REAR' ? 'HIGH' : side === 'LEFT' ? 'END_MIN' : 'END_MAX') : side === 'LEFT' ? 'LOW' : side === 'RIGHT' ? 'HIGH' : side === 'FRONT' ? 'END_MIN' : 'END_MAX'
    return roof.layout.planes.some((p) => p.key === want) ? want : undefined
  }
  const dormers: DormerV2[] = []
  d.dormers.forEach((dm, n) => {
    const name = `dormer ${n + 1}`
    const mass = massOf(dm.bodyId)
    const roof = mass ? roofOf(mass.id) : undefined
    const key = roof ? planeKeyFor(roof, dm.slope) : undefined
    if (!mass || !roof || !key || key === 'END_MIN' || key === 'END_MAX') return adj('FEATURE_DROPPED', name, `${dm.bodyId} has no roof slope facing ${dm.slope.toLowerCase()} that can carry it`)
    const plane = roof.layout.planes.find((p) => p.key === key) as PlaneRoofLayout['planes'][number]
    const alongX = roof.ridgeAxis === 'X'
    const at = alongX ? snapX(X(dm.at)) : snapZ(Z(dm.at))
    const [m0, m1] = alongX ? [mass.x0, mass.x1] : [mass.z0, mass.z1]
    const half = Math.min(dm.widthM / 2, (m1 - m0) / 2 - 0.8)
    if (half < 0.45) return adj('FEATURE_DROPPED', name, `the roof is too short for a dormer ${dm.widthM} m wide`)
    const c = clamp(at, m0 + 0.8 + half, m1 - 0.8 - half)
    // its front face a little up the slope from the wall under the eave
    const setback = 0.5
    const wallLine = alongX ? (key === 'LOW' ? mass.z0 : mass.z1) : key === 'LOW' ? mass.x0 : mass.x1
    const inward = key === 'LOW' ? 1 : -1
    const f = wallLine + inward * setback
    const front = alongX ? { start: { x: round6(c - half), z: round6(f) }, end: { x: round6(c + half), z: round6(f) } } : { start: { x: round6(f), z: round6(c - half) }, end: { x: round6(f), z: round6(c + half) } }
    const frontDrop = (plane.datum.x - front.start.x) * plane.downslope.x + (plane.datum.z - front.start.z) * plane.downslope.z
    const frontY = plane.datum.y + frontDrop * tanDeg(plane.pitchDeg)
    const atticFloor = Math.max(...mass.storeys) * H
    // its walls stand a window and its head above the host slope at the front face
    const eaveY = Math.max(frontY + 1.6, atticFloor + 2.3)
    if (eaveY > roof.ridgeY - 0.35) return adj('FEATURE_DROPPED', name, `its walls would reach ${eaveY.toFixed(2)} m, the roof's ridge is at ${roof.ridgeY.toFixed(2)} m`)
    const ridgeY = dm.type === 'GABLE' ? Math.min(eaveY + half * tanDeg(Math.min(roof.pitchDeg, 40)), roof.ridgeY - 0.15) : undefined
    const type = dm.type === 'SHED' && roof.pitchDeg < 22 ? 'FLAT' : dm.type
    dormers.push({ id: `dormer-${n + 1}`, massId: mass.id, planeKey: key, type, front, eaveY: round6(eaveY), ...(ridgeY !== undefined ? { ridgeY: round6(ridgeY) } : {}), ...(type === 'SHED' ? { shedPitchDeg: round6(Math.max(6, roof.pitchDeg - 22)) } : {}), window: { width: round6(Math.max(0.5, 2 * half - 0.7)), height: round6(clamp(eaveY - frontY - 0.95, 0.45, 1.3)) }, featureId: `described-dormer-${n + 1}`, provenance: prov, why: `a ${dm.type.toLowerCase()} dormer ${dm.widthM} m wide on the ${dm.slope.toLowerCase()} slope, as pictures ${dm.images.join(', ')} show it; its heights are a convention` })
  })
  const rooflights: BuildingV2['rooflights'] = []
  d.rooflights.forEach((r, n) => {
    const name = `rooflight ${n + 1}`
    const mass = massOf(r.bodyId)
    const roof = mass ? roofOf(mass.id) : undefined
    const key = roof ? planeKeyFor(roof, r.slope) : undefined
    if (!mass || !roof || !key || key === 'END_MIN' || key === 'END_MAX') return adj('FEATURE_DROPPED', name, `${r.bodyId} has no roof slope facing ${r.slope.toLowerCase()}`)
    const alongX = roof.ridgeAxis === 'X'
    const at = alongX ? snapX(X(r.at)) : snapZ(Z(r.at))
    const [m0, m1] = alongX ? [mass.x0, mass.x1] : [mass.z0, mass.z1]
    const [u0, u1] = alongX ? [mass.z0, mass.z1] : [mass.x0, mass.x1]
    const halfSpan = (u1 - u0) / 2
    const c = clamp(at, m0 + 0.6 + r.widthM / 2, m1 - 0.6 - r.widthM / 2)
    // half-way up its slope, in plan
    const s0 = key === 'LOW' ? u0 + halfSpan * 0.4 : u1 - halfSpan * 0.4 - 0.8
    const box = { alongFrom: round6(c - r.widthM / 2), alongTo: round6(c + r.widthM / 2), slopeFrom: round6(s0), slopeTo: round6(s0 + 0.8) }
    const inside = [box.alongFrom + 0.01, box.alongTo - 0.01].every((a) => [box.slopeFrom + 0.01, box.slopeTo - 0.01].every((s) => planeAt(roof.layout, alongX ? { x: a, z: s } : { x: s, z: a })?.key === key))
    const underDormer = dormers.some((dm) => dm.massId === mass.id && dm.planeKey === key && (alongX ? dm.front.start.x < box.alongTo + 0.3 && dm.front.end.x > box.alongFrom - 0.3 : dm.front.start.z < box.alongTo + 0.3 && dm.front.end.z > box.alongFrom - 0.3))
    if (!inside || underDormer) return adj('FEATURE_DROPPED', name, underDormer ? 'a dormer stands there' : 'it would lie across a hip or the ridge')
    rooflights.push({ id: `rooflight-${n + 1}`, slope: key, ...box, yFrom: 0, yTo: 0, frameId: 'described-house', confidence: r.confidence, why: `a rooflight on the ${r.slope.toLowerCase()} slope, as pictures ${r.images.join(', ')} show it; its height up the slope is a convention`, featureId: `described-rooflight-${n + 1}`, provenance: prov, widthM: r.widthM, lengthM: 0.8, planeId: `roof-${mass.id}-plane-${key.toLowerCase()}`, ridgeAxis: roof.ridgeAxis })
  })
  const chimneys: BuildingV2['chimneys'] = []
  d.chimneys.forEach((c, n) => {
    const x = snapX(X(c.x))
    const z = snapZ(Z(c.z))
    const mass = masses.find((m) => x > m.x0 + 0.3 && x < m.x1 - 0.3 && z > m.z0 + 0.3 && z < m.z1 - 0.3)
    if (!mass) return adj('FEATURE_DROPPED', `chimney ${n + 1}`, `no body stands at x ${x.toFixed(2)}, z ${z.toFixed(2)}`)
    const roof = roofOf(mass.id)
    const flat = flatOf(mass.id)
    const topY = roof ? roof.ridgeY + 0.5 : (flat?.slabTopY ?? H) + 1.0
    chimneys.push({ id: `chimney-${n + 1}`, x0: round6(x - 0.25), z0: round6(z - 0.25), x1: round6(x + 0.25), z1: round6(z + 0.25), topY: round6(topY), storeysSeen: [], renderFrames: [], confidence: c.confidence, why: `a stack above the roof, as pictures ${c.images.join(', ')} show it; its size and height are a convention`, featureId: `described-chimney-${n + 1}`, provenance: prov })
  })

  // --- balconies, terraces, canopies ---------------------------------------------------------------------------------------
  const balconies: BalconyV2[] = []
  const railings: RailingV2[] = []
  const outside = (mass: MassV2, facade: Facade, from: number, to: number, depth: number): Rect => (facade === 'FRONT' ? { x0: from, x1: to, z0: mass.z0 - depth, z1: mass.z0 } : facade === 'REAR' ? { x0: from, x1: to, z0: mass.z1, z1: mass.z1 + depth } : facade === 'WEST' ? { x0: mass.x0 - depth, x1: mass.x0, z0: from, z1: to } : { x0: mass.x1, x1: mass.x1 + depth, z0: from, z1: to })
  d.balconies.forEach((bal, n) => {
    const mass = massOf(bal.bodyId)
    // a terrace on the flat roof of a lower body: the roof is its floor, a guard runs round the roof's free edges
    const flatUnder = mass ? flatOf(mass.id) : undefined
    if (mass && flatUnder && bal.storey === Math.max(...mass.storeys) + 1) {
      if (bal.railing === 'NONE') return adj('FEATURE_ADJUSTED', `balcony ${n + 1}`, `a terrace on ${bal.bodyId}'s flat roof with no guard: the roof itself is all there is to build`)
      const others = masses.filter((x) => x !== mass && x.storeys.includes(bal.storey)).map((x) => ({ x0: x.x0, z0: x.z0, x1: x.x1, z1: x.z1 }))
      const rect: Rect = { x0: mass.x0, z0: mass.z0, x1: mass.x1, z1: mass.z1 }
      const in_ = 0.08
      const corner = { FRONT: [{ x: rect.x0 + in_, z: rect.z0 + in_ }, { x: rect.x1 - in_, z: rect.z0 + in_ }], EAST: [{ x: rect.x1 - in_, z: rect.z0 + in_ }, { x: rect.x1 - in_, z: rect.z1 - in_ }], REAR: [{ x: rect.x1 - in_, z: rect.z1 - in_ }, { x: rect.x0 + in_, z: rect.z1 - in_ }], WEST: [{ x: rect.x0 + in_, z: rect.z1 - in_ }, { x: rect.x0 + in_, z: rect.z0 + in_ }] } as const
      // the free sides in order round the roof, starting after a side a taller body stands against
      const order: Facade[] = ['FRONT', 'EAST', 'REAR', 'WEST']
      const free = order.map((sd) => coveredSpans(rect, sd, others).length === 0)
      if (!free.some(Boolean)) return adj('FEATURE_DROPPED', `balcony ${n + 1}`, 'the flat roof it is stated on has no free edge')
      const start = free.every(Boolean) ? 0 : (free.findIndex((f, i) => f && !free[(i + 3) % 4]) + 4) % 4
      const path: Array<{ x: number; z: number }> = []
      for (let k = 0; k < 4; k += 1) {
        const i = (start + k) % 4
        if (!free[i]) break
        const [a, b] = corner[order[i]]
        if (path.length === 0) path.push({ x: round6(a.x), z: round6(a.z) })
        path.push({ x: round6(b.x), z: round6(b.z) })
      }
      const id = `roof-terrace-${n + 1}`
      railings.push({ id: `${id}-railing`, storeyIndex: Math.max(...mass.storeys), start: path[0], end: path[path.length - 1], path, baseY: flatUnder.slabTopY, heightM: 1.1, featureId: `described-${id}-railing`, provenance: prov, why: `a terrace on the flat roof of ${bal.bodyId}, guarded round its free edges (${bal.railing.toLowerCase()}), as pictures ${bal.images.join(', ')} show it; 1.1 m high by convention` })
      return
    }
    if (!mass || !mass.storeys.includes(bal.storey)) return adj('FEATURE_DROPPED', `balcony ${n + 1}`, `${bal.bodyId} has no storey ${bal.storey} to carry it`)
    const facade = FACADE[bal.side]
    const alongX = facade === 'FRONT' || facade === 'REAR'
    const T = alongX ? X : Z
    const [m0, m1] = alongX ? [mass.x0, mass.x1] : [mass.z0, mass.z1]
    const from = clamp(Math.min(T(bal.from), T(bal.to)), m0, m1 - 0.8)
    const to = clamp(Math.max(T(bal.from), T(bal.to)), from + 0.8, m1)
    const r = outside(mass, facade, round6(from), round6(to), bal.depthM)
    const topY = round6(bal.storey * H)
    const id = `balcony-${n + 1}`
    balconies.push({ id, kind: 'BALCONY', storeyIndex: bal.storey, x0: round6(r.x0), z0: round6(r.z0), x1: round6(r.x1), z1: round6(r.z1), topY, thicknessM: 0.2, side: facade, projecting: true, featureId: `described-${id}`, provenance: prov, why: `a balcony ${bal.depthM} m deep on the ${bal.side.toLowerCase()} side, storey ${bal.storey}, as pictures ${bal.images.join(', ')} show it` })
    if (bal.railing !== 'NONE') {
      // round its three free edges, from the wall and back to it
      const path = facade === 'FRONT' ? [{ x: r.x0, z: r.z1 }, { x: r.x0, z: r.z0 }, { x: r.x1, z: r.z0 }, { x: r.x1, z: r.z1 }] : facade === 'REAR' ? [{ x: r.x0, z: r.z0 }, { x: r.x0, z: r.z1 }, { x: r.x1, z: r.z1 }, { x: r.x1, z: r.z0 }] : facade === 'WEST' ? [{ x: r.x1, z: r.z0 }, { x: r.x0, z: r.z0 }, { x: r.x0, z: r.z1 }, { x: r.x1, z: r.z1 }] : [{ x: r.x0, z: r.z0 }, { x: r.x1, z: r.z0 }, { x: r.x1, z: r.z1 }, { x: r.x0, z: r.z1 }]
      const pts = path.map((p) => ({ x: round6(p.x), z: round6(p.z) }))
      railings.push({ id: `${id}-railing`, storeyIndex: bal.storey, start: pts[0], end: pts[pts.length - 1], path: pts, hostId: id, baseY: topY, heightM: 1.1, featureId: `described-${id}-railing`, provenance: prov, why: `the balcony's guard round its free edges (${bal.railing.toLowerCase()}), as the pictures show it; 1.1 m high by convention` })
    }
  })
  const terraces: TerraceV2[] = []
  d.terraces.forEach((t, n) => {
    const facade = FACADE[t.side]
    const alongX = facade === 'FRONT' || facade === 'REAR'
    const T = alongX ? X : Z
    const from = Math.min(T(t.from), T(t.to))
    const to = Math.max(T(t.from), T(t.to))
    const mid = (from + to) / 2
    const outer = (m: MassV2): number => (facade === 'FRONT' ? -m.z0 : facade === 'REAR' ? m.z1 : facade === 'WEST' ? -m.x0 : m.x1)
    const host = [...masses].filter((m) => (alongX ? mid > m.x0 && mid < m.x1 : mid > m.z0 && mid < m.z1)).sort((a, b) => outer(b) - outer(a))[0]
    if (!host || to - from < 0.8) return adj('FEATURE_DROPPED', `terrace ${n + 1}`, 'no body stands behind it')
    const r = outside(host, facade, round6(from), round6(to), t.depthM)
    // not under another body
    if (masses.some((m) => m !== host && Math.min(r.x1, m.x1) - Math.max(r.x0, m.x0) > 0.3 && Math.min(r.z1, m.z1) - Math.max(r.z0, m.z0) > 0.3)) return adj('FEATURE_DROPPED', `terrace ${n + 1}`, 'another body stands where it is stated')
    terraces.push({ id: `terrace-${n + 1}`, storeyIndex: 0, side: facade, polygon: [{ x: round6(r.x0), z: round6(r.z0) }, { x: round6(r.x1), z: round6(r.z0) }, { x: round6(r.x1), z: round6(r.z1) }, { x: round6(r.x0), z: round6(r.z1) }], topY: 0, thicknessM: 0.15, surface: 'UNKNOWN', edge: 'FLUSH', massIds: [host.id], featureId: `described-terrace-${n + 1}`, provenance: prov, why: `a terrace ${t.depthM} m deep against the ${t.side.toLowerCase()} side, as pictures ${t.images.join(', ')} show it` })
  })
  const canopies: CanopyV2[] = []
  const massRects = masses.map((m) => ({ id: m.id, x0: m.x0, z0: m.z0, x1: m.x1, z1: m.z1 }))
  /** `r` with whatever of it lies inside `o` cut away, along the axis that loses least; null when nothing worth building is left. */
  const cutBack = (r: Rect, o: Rect): Rect | null => {
    const ox = Math.min(r.x1, o.x1) - Math.max(r.x0, o.x0)
    const oz = Math.min(r.z1, o.z1) - Math.max(r.z0, o.z0)
    if (ox <= 0.01 || oz <= 0.01) return r
    const options: Rect[] = []
    if (r.x0 < o.x0 - 0.01) options.push({ ...r, x1: o.x0 })
    if (r.x1 > o.x1 + 0.01) options.push({ ...r, x0: o.x1 })
    if (r.z0 < o.z0 - 0.01) options.push({ ...r, z1: o.z0 })
    if (r.z1 > o.z1 + 0.01) options.push({ ...r, z0: o.z1 })
    const best = options.sort((p, q) => (q.x1 - q.x0) * (q.z1 - q.z0) - (p.x1 - p.x0) * (p.z1 - p.z0))[0]
    return best && best.x1 - best.x0 >= 0.5 && best.z1 - best.z0 >= 0.5 ? best : null
  }
  const pitchedRoofs: Array<{ layout: { planes: PlaneRoofLayout['planes'] }; thicknessM: number }> = [...planeRoofs, ...pitchedAttachedRoofs.map((r) => ({ layout: r.layout as unknown as { planes: PlaneRoofLayout['planes'] }, thicknessM: ROOF_THICKNESS_M }))]
  const outlineOf = (planes: PlaneRoofLayout['planes']): Rect => {
    const pts = planes.flatMap((pl) => pl.boundary)
    return { x0: Math.min(...pts.map((q) => q.x)), x1: Math.max(...pts.map((q) => q.x)), z0: Math.min(...pts.map((q) => q.z)), z1: Math.max(...pts.map((q) => q.z)) }
  }
  /** The roof's top surface over a plan point, or undefined outside it. */
  const roofTopAt = (planes: PlaneRoofLayout['planes'], q: { x: number; z: number }): number | undefined => {
    const plane = planeAt({ planes } as PlaneRoofLayout, q)
    return plane ? plane.datum.y + ((plane.datum.x - q.x) * plane.downslope.x + (plane.datum.z - q.z) * plane.downslope.z) * tanDeg(plane.pitchDeg) : undefined
  }
  d.canopies.forEach((c, n) => {
    const name = `canopy ${n + 1}`
    const plan = canopyPlans[n]
    if (plan.kind === 'UNBUILT') return adj('FEATURE_DROPPED', name, plan.why)
    // built above as a recess cut into the body: what covers it is the body itself
    if (plan.kind === 'POCKET') return
    if (plan.kind === 'RECESS') {
      // under the body's own roof: no plate, the posts stand where the face was and carry the roof's edge
      const rect = plan.rect
      const host = masses[bodies.indexOf(plan.body)]
      const roof = roofOf(host.id)
      const alongX = plan.facade === 'FRONT' || plan.facade === 'REAR'
      const line = plan.facade === 'FRONT' ? rect.z0 + 0.15 : plan.facade === 'REAR' ? rect.z1 - 0.15 : plan.facade === 'WEST' ? rect.x0 + 0.15 : rect.x1 - 0.15
      const [lo, hi] = alongX ? [rect.x0 + 0.15, rect.x1 - 0.15] : [rect.z0 + 0.15, rect.z1 - 0.15]
      const k = Math.min(Math.max(c.posts, 2), Math.floor((hi - lo) / 0.9) + 1)
      const posts = Array.from({ length: k }, (_, i) => (alongX ? { x: round6(lo + ((hi - lo) * i) / (k - 1)), z: round6(line) } : { x: round6(line), z: round6(lo + ((hi - lo) * i) / (k - 1)) }))
      const soffits = roof ? posts.map((q) => roofTopAt(roof.layout.planes, q)).filter((y): y is number => y !== undefined).map((y) => y - roof.thicknessM / cosDeg(roof.pitchDeg)) : []
      if (!roof || soffits.length === 0 || Math.min(...soffits) < 2.05) return adj('FEATURE_ADJUSTED', name, `its posts are not built: the roof's edge stands too low over them`)
      const key = planeAt(roof.layout, posts[0])?.key ?? 'LOW'
      if (k !== c.posts) adj('FEATURE_ADJUSTED', name, `${c.posts} post(s) stated, ${k} placed along the face`)
      canopies.push({ id: `canopy-${n + 1}`, kind: c.kind, rect, undersideY: round6(Math.min(...soffits) - 0.02), thicknessM: 0.18, posts, plate: false, hostId: `roof-${host.id}-plane-${key.toLowerCase().replace('_', '-')}`, featureId: `described-canopy-${n + 1}`, provenance: prov, why: `a ${c.kind.toLowerCase().replace(/_/g, ' ')} under ${plan.body.src.id}'s own roof, as pictures ${c.images.join(', ')} show it` })
      return
    }
    let r: Rect = plan.kind === 'PROJECTS' ? plan.rect : canopyRect(c)
    if (plan.kind === 'PROJECTS') adj('FEATURE_ADJUSTED', name, `it is stated within ${plan.from}'s walls and under a metre deep: built projecting from that face by its depth`)
    if (r.x1 - r.x0 < 0.5 || r.z1 - r.z0 < 0.5) return adj('FEATURE_DROPPED', name, 'smaller than half a metre')
    // An edge stated within a hand of a body's face IS on that face: the bodies were snapped, the canopy follows them.
    for (const m of massRects) {
      const overlapsZ = Math.min(r.z1, m.z1) - Math.max(r.z0, m.z0) > 0.2
      const overlapsX = Math.min(r.x1, m.x1) - Math.max(r.x0, m.x0) > 0.2
      const near = (v: number, face: number): boolean => Math.abs(v - face) > 1e-6 && Math.abs(v - face) <= CANOPY_SNAP_M
      if (overlapsZ && near(r.x0, m.x1)) r = { ...r, x0: m.x1 }
      if (overlapsZ && near(r.x1, m.x0)) r = { ...r, x1: m.x0 }
      if (overlapsX && near(r.z0, m.z1)) r = { ...r, z0: m.z1 }
      if (overlapsX && near(r.z1, m.z0)) r = { ...r, z1: m.z0 }
    }
    // A canopy covers open ground: what of it lies within a body's walls is cut away. One stated wholly inside a body
    // is a recess under the body's own floor or roof, which this model does not cut — said, not built as a plate
    // through the walls.
    for (const m of massRects) {
      const cut = cutBack(r, m)
      if (!cut) return adj('FEATURE_DROPPED', name, `nothing of it lies outside ${m.id}'s walls`)
      if (cut !== r) adj('FEATURE_ADJUSTED', name, `the part of it within ${m.id}'s walls is not built: ${(r.x1 - r.x0).toFixed(2)} × ${(r.z1 - r.z0).toFixed(2)} m cut back to ${(cut.x1 - cut.x0).toFixed(2)} × ${(cut.z1 - cut.z0).toFixed(2)} m`)
      r = cut
    }
    // what it leans on is read off the canopy as stated against the bodies; clipping it under an eave must not turn a
    // porch along a wall into a free-standing roof
    const stated: Rect = { ...r }
    let underside = clamp(c.undersideM, 2.0, 7)
    // Two covers do not lie in one another: a canopy is cut back from one already built at its height, and from a
    // balcony at its height, which is then the cover of what lies under it.
    for (const prev of canopies) {
      if (Math.abs(prev.undersideY - underside) > 0.6) continue
      const cut = cutBack(r, prev.rect)
      if (!cut) return adj('FEATURE_DROPPED', name, `${prev.id} already covers where it is stated`)
      if (cut !== r) adj('FEATURE_ADJUSTED', name, `cut back from ${prev.id}, which covers part of it`)
      r = cut
    }
    for (const bal of balconies) {
      if (Math.abs(bal.topY - (underside + 0.18)) > 0.7) continue
      const cut = cutBack(r, { x0: bal.x0, z0: bal.z0, x1: bal.x1, z1: bal.z1 })
      if (!cut) return adj('FEATURE_DROPPED', name, `${bal.id} stands over it at that height and is its cover`)
      if (cut !== r) adj('FEATURE_ADJUSTED', name, `cut back from under ${bal.id}, which covers part of it`)
      r = cut
    }
    // Under a roof's edge the roof is the cover. Where the plate as stated would stand in a roof (its eaves reach over
    // it and are not clear above it), the plate begins where the roof ends and is no higher than the roof's edge there.
    for (const roof of pitchedRoofs) {
      const outline = outlineOf(roof.layout.planes)
      const ox = Math.min(r.x1, outline.x1) - Math.max(r.x0, outline.x0)
      const oz = Math.min(r.z1, outline.z1) - Math.max(r.z0, outline.z0)
      if (ox <= 0.01 || oz <= 0.01) continue
      const inside = { x0: Math.max(r.x0, outline.x0), x1: Math.min(r.x1, outline.x1), z0: Math.max(r.z0, outline.z0), z1: Math.min(r.z1, outline.z1) }
      const samples = [0.02, 0.5, 0.98].flatMap((u) => [0.02, 0.5, 0.98].map((v) => ({ x: inside.x0 + (inside.x1 - inside.x0) * u, z: inside.z0 + (inside.z1 - inside.z0) * v })))
      const tops = samples.map((q) => roofTopAt(roof.layout.planes, q)).filter((y): y is number => y !== undefined)
      if (tops.length === 0) continue
      const lowestSoffit = Math.min(...tops) - roof.thicknessM / cosDeg(Math.max(...roof.layout.planes.map((pl) => pl.pitchDeg)))
      if (lowestSoffit >= underside + 0.18 + 0.05) continue
      const cut = cutBack(r, outline)
      if (!cut) return adj('FEATURE_DROPPED', name, 'it lies under a roof\'s eaves, which are its cover')
      const edgeTop = Math.min(...tops)
      const lowered = Math.min(underside, edgeTop - 0.18)
      if (cut !== r || lowered < underside - 0.01) adj('FEATURE_ADJUSTED', name, `a roof's eaves reach over it: the plate begins at the roof's edge${lowered < underside - 0.01 ? ` and stands at ${lowered.toFixed(2)} m, level with that edge (stated ${c.undersideM} m)` : ''}`)
      r = cut
      underside = lowered
    }
    if (underside < 2.05) return adj('FEATURE_DROPPED', name, `beside the roof's edge its plate would stand at ${underside.toFixed(2)} m, too low to walk under: the eaves are its cover`)
    r = { x0: round6(r.x0), z0: round6(r.z0), x1: round6(r.x1), z1: round6(r.z1) }
    // its posts stand along the edge away from the bodies it leans on: at both ends of that edge and evenly between
    const touches = (side: Facade): boolean => coveredSpans(stated, side, masses.map((m) => ({ x0: m.x0, z0: m.z0, x1: m.x1, z1: m.z1 }))).length > 0
    const inset = 0.15
    const edges: Record<Facade, [{ x: number; z: number }, { x: number; z: number }]> = { FRONT: [{ x: r.x0 + inset, z: r.z0 + inset }, { x: r.x1 - inset, z: r.z0 + inset }], REAR: [{ x: r.x0 + inset, z: r.z1 - inset }, { x: r.x1 - inset, z: r.z1 - inset }], WEST: [{ x: r.x0 + inset, z: r.z0 + inset }, { x: r.x0 + inset, z: r.z1 - inset }], EAST: [{ x: r.x1 - inset, z: r.z0 + inset }, { x: r.x1 - inset, z: r.z1 - inset }] }
    const opposite: Record<Facade, Facade> = { FRONT: 'REAR', REAR: 'FRONT', WEST: 'EAST', EAST: 'WEST' }
    const leaning = (['FRONT', 'REAR', 'WEST', 'EAST'] as Facade[]).filter(touches)
    const outerSides = leaning.map((sd) => opposite[sd]).filter((sd) => !touches(sd))
    const outer = outerSides.sort((a, b) => Math.hypot(edges[b][1].x - edges[b][0].x, edges[b][1].z - edges[b][0].z) - Math.hypot(edges[a][1].x - edges[a][0].x, edges[a][1].z - edges[a][0].z))[0]
    const posts: Array<{ x: number; z: number }> = []
    if (c.posts > 0 && outer) {
      const [a, b] = edges[outer]
      // as many as stand clear of one another along the edge: a post every 0.9 m at the closest
      const k = Math.min(Math.max(1, c.posts), Math.floor(Math.hypot(b.x - a.x, b.z - a.z) / 0.9) + 1)
      for (let i = 0; i < k; i += 1) {
        const t = k === 1 ? (touches(outer === 'FRONT' || outer === 'REAR' ? 'WEST' : 'FRONT') ? 1 : 0) : i / (k - 1)
        posts.push({ x: round6(a.x + (b.x - a.x) * t), z: round6(a.z + (b.z - a.z) * t) })
      }
    } else if (c.posts > 0) {
      // free-standing: at its corners
      for (const p of [edges.FRONT[0], edges.FRONT[1], edges.REAR[1], edges.REAR[0]].slice(0, Math.min(4, c.posts))) posts.push({ x: round6(p.x), z: round6(p.z) })
    }
    // a post never stands in a wall: where the edge runs along a body, that body carries the canopy there
    const free = posts.filter((q) => !massRects.some((m) => q.x > m.x0 - 0.15 && q.x < m.x1 + 0.15 && q.z > m.z0 - 0.15 && q.z < m.z1 + 0.15))
    posts.length = 0
    posts.push(...free)
    if (posts.length < c.posts) adj('FEATURE_ADJUSTED', name, `${c.posts} post(s) stated, ${posts.length} placed`)
    canopies.push({ id: `canopy-${n + 1}`, kind: c.kind, rect: r, undersideY: round6(underside), thicknessM: 0.18, posts, featureId: `described-canopy-${n + 1}`, provenance: prov, why: `a ${c.kind.toLowerCase().replace(/_/g, ' ')} over an open area, as pictures ${c.images.join(', ')} show it` })
  })

  // --- colours: the main body's walls are the house's; a body of another tone takes the dark, mid or accent material ------
  const lum = (hexColour: string): number => {
    const n = parseInt(hexColour.slice(1), 16)
    return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
  }
  const mainSrc = bodies.find((b) => b.id === mainMassId)?.src
  const wall = mainSrc?.wallColour
  const massTones: BuildingV2['massTones'] = []
  for (const b of bodies) {
    if (!wall || b.id === mainMassId || b.src.wallColour.toLowerCase() === wall.toLowerCase()) continue
    const dl = lum(b.src.wallColour) - lum(wall)
    if (dl < -0.25) massTones.push({ massId: b.id, tone: lum(b.src.wallColour) < 0.35 ? 'DARK' : 'MID', share: 1, views: b.src.images.length, why: `walls of another tone (${b.src.wallColour}) than the main body's (${wall}), as the pictures show` })
  }

  const building: BuildingV2 = {
    label: DESCRIBED_HOUSE_LABEL,
    wallThicknessM: WALL_T,
    slabThicknessM: 0.25,
    levels,
    masses,
    attachedRoofs,
    pitchedAttachedRoofs,
    planeRoofs,
    recesses: [],
    returns: [],
    ...(pockets.length > 0 ? { pockets } : {}),
    balconies,
    railings,
    portalHeads: [],
    verges: [],
    terraces,
    massTones,
    returnTones: [],
    facadeGraph: { nodes: [], edges: [] },
    chimneys,
    rooflights,
    openings,
    sharedDoors: [],
    interior: [],
    assemblies: [],
    surfaceRegions: [],
    dormers,
    canopies,
    palette: { ...(wall ? { wall } : {}), roof: d.palette.roof, joinery: d.palette.joinery, garageDoor: d.palette.garageDoor, accent: d.palette.accent },
    bodyBasis: { status: prov, why: `described from the sources as a whole (overall size ${d.overall.basis.toLowerCase().replace(/_/g, ' ')}); not the plan's printed chains and wall bands` },
  }
  return { building, adjustments, mainMassId }
}

export type DescribedModel =
  | { ok: true; building: BuildingV2; modelJson: string; program: unknown[]; adjustments: DescribedAdjustment[]; emitterNotes: string[]; refused: Array<{ type: string; id?: string; codes: string[]; message: string }>; fits: Array<{ openingId: string; action: string; why: string }> }
  | { ok: false; reason: string; adjustments: DescribedAdjustment[] }

/**
 * A description to a model: build, emit, fit — an object the model's validator refuses is taken out and named
 * (`refused`), as the drawings' preview does — and run through the model's own validator.
 */
export function reconstructFromHouseDescription(description: HouseDescription, modelId: string, options: DescribedBuildOptions = {}): DescribedModel {
  const { building, adjustments, mainMassId } = buildingFromHouseDescription(description, options)
  const emitted = emitBuilding(building, DESCRIBED_HOUSE_LABEL)
  const preview = fitPreviewProgram(emitted.program, { label: DESCRIBED_HOUSE_LABEL, modelId, mainMassId, toleranceM: 0.05 })
  if (!preview.fit.ok) return { ok: false, reason: `the model refused command ${preview.fit.failedAt} (${preview.fit.command.type}): ${preview.fit.errors.map((e) => `${e.code} ${e.message ?? ''}`).join('; ').slice(0, 400)}`, adjustments }
  const model = buildCandidateModel(preview.fit.program, DESCRIBED_HOUSE_LABEL, modelId)
  return { ok: true, building, modelJson: serializeModel(model), program: preview.fit.program as unknown[], adjustments, emitterNotes: emitted.notes, refused: preview.failures.map((f) => ({ type: f.type, ...(f.id ? { id: f.id } : {}), codes: f.codes, message: f.message })), fits: preview.fit.fits.map((f) => ({ openingId: f.openingId, action: f.action, why: f.why })) }
}
