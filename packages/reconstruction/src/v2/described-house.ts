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
import type { BuildingV2, CanopyV2, DormerV2, LevelV2, MassV2, PlaneRoofV2, AttachedRoofV2, BalconyV2, RailingV2, TerraceV2, PitchedAttachedRoofV2 } from './building.js'
import { attachedGableLayout } from './attached-roof-form.js'
import type { MainRoofForJoin } from './attached-roof-form.js'
import type { Facade, OpeningFamily, OpeningV2 } from './openings-v2.js'
import type { ProvenanceStatus } from './graph.js'
import type { PlaneRoofKey, PlaneRoofLayout, RoofEnd } from './plane-roof.js'
import { planeAt, planeRoofLayout } from './plane-roof.js'
import { emitBuilding } from './emit.js'
import { buildCandidateModel, fitPreviewProgram } from '../candidate.js'

export const DESCRIBED_HOUSE_BUILDER_VERSION = '0.1.0'
export const DESCRIBED_HOUSE_LABEL = 'MODEL Z OPISU ŹRÓDEŁ'

export type DescribedAdjustmentCode =
  | 'FRAME_SHIFTED'
  | 'BODIES_RESCALED_TO_OVERALL'
  | 'SCALED_TO_PUBLISHED_FIGURE'
  | 'BODY_CLIPPED'
  | 'BODY_DROPPED'
  | 'EAVES_HEIGHT_CLAMPED'
  | 'ROOF_KIND_STOOD_IN'
  | 'ROOF_PITCH_ASSUMED'
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
export function buildingFromHouseDescription(input: HouseDescription, options: { published?: PublishedFigure[] } = {}): DescribedBuilding {
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
  if (d.overall.basis !== 'PRINTED_ON_DRAWING' && !rescale) {
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
  const kx = rescale ? (fx + fz) / 2 : kp
  const kz = kx
  if (Math.abs(minX) > 1e-6 || Math.abs(minZ) > 1e-6) adj('FRAME_SHIFTED', 'frame', `the bodies started at x ${minX.toFixed(2)}, z ${minZ.toFixed(2)}: moved to the origin`)
  if (rescale) adj('BODIES_RESCALED_TO_OVERALL', 'frame', `the bodies spanned ${spanX.toFixed(2)} × ${spanZ.toFixed(2)} m, the overall size is stated as ${d.overall.widthM} × ${d.overall.depthM} m: every position scaled by ${kx.toFixed(3)}`)
  const X = (x: number): number => (x - minX) * kx
  const Z = (z: number): number => (z - minZ) * kz
  const snapX = snapper(d.bodies.flatMap((b) => [X(b.x0), X(b.x1)]))
  const snapZ = snapper(d.bodies.flatMap((b) => [Z(b.z0), Z(b.z1)]))

  type Body = { src: DescribedBody; id: string; rect: Rect }
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
  const mainMassId = 'main'

  // --- levels ------------------------------------------------------------------------------------------------------
  const H = round6(clamp(d.overall.storeyHeightM, 2.5, 3.6))
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
      attachedRoofs.push({ massId: m.id, slabTopY: eaveY, slabSoffitY: round6(eaveY - 0.25), footprint: { ...b.rect }, projectsOverZone: false, featureId: `described-roof-${src.id}`, provenance: prov })
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
      const shed = shedLayout(b.rect, highSide, pitch, eaveY)
      planeRoofs.push({ massId: m.id, ridgeAxis: shed.ridgeAxis, pitchDeg: pitch, eaveY, ridgeY: shed.layout.ridgeY, ends: { min: 'GABLE', max: 'GABLE' }, thicknessM: ROOF_THICKNESS_M, layout: shed.layout, featureId: `described-roof-${src.id}`, provenance: prov, why: `a single slope at ${pitch}°, highest on the ${highSide.toLowerCase()} side, as the sources show it` })
      return
    }
    const w = b.rect.x1 - b.rect.x0
    const dep = b.rect.z1 - b.rect.z0
    const ridgeAxis: 'X' | 'Z' = src.roof.ridge === 'ALONG_X' ? 'X' : src.roof.ridge === 'ALONG_Z' ? 'Z' : w >= dep ? 'X' : 'Z'
    const ends: { min: RoofEnd; max: RoofEnd } = kind === 'HIP' || kind === 'PYRAMID' ? { min: 'HIP', max: 'HIP' } : { min: 'GABLE', max: 'GABLE' }
    // the eaves stand out past the walls where nothing stands against them; the plane passes through the wall's top edge
    const eaveSides: Facade[] = ridgeAxis === 'X' ? ['FRONT', 'REAR'] : ['WEST', 'EAST']
    const endSides: Facade[] = ridgeAxis === 'X' ? ['WEST', 'EAST'] : ['FRONT', 'REAR']
    const free = (s: Facade): boolean => coveredSpans(b.rect, s, others).length === 0
    const over = clamp(src.roof.overhangM, 0, 0.8)
    // under a hip every side is an eave and all four lie at one height: the eaves stand out by one amount all round, or
    // (where a body stands against any side) not at all — an end eave set in from the others would sit below its wall
    const hipped = ends.min === 'HIP'
    const eaveOut = hipped ? ([...eaveSides, ...endSides].every(free) ? over : 0) : eaveSides.every(free) ? over : 0
    const endOut = (s: Facade): number => (hipped ? eaveOut : free(s) ? Math.min(over, 0.4) : 0)
    const body: Rect = ridgeAxis === 'X' ? { x0: b.rect.x0 - endOut(endSides[0]), x1: b.rect.x1 + endOut(endSides[1]), z0: b.rect.z0 - eaveOut, z1: b.rect.z1 + eaveOut } : { x0: b.rect.x0 - eaveOut, x1: b.rect.x1 + eaveOut, z0: b.rect.z0 - endOut(endSides[0]), z1: b.rect.z1 + endOut(endSides[1]) }
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
    const [w0, w1] = alongX ? [mass.x0, mass.x1] : [mass.z0, mass.z1]
    let lo = at - (o.widthM * kx) / 2
    let hi = at + (o.widthM * kx) / 2
    // not where another body stands against this wall on this storey
    const against = coveredSpans(rect, facade, masses.filter((x) => x !== mass && x.storeys.includes(o.storey)).map((x) => ({ x0: x.x0, z0: x.z0, x1: x.x1, z1: x.z1 })))
    const blocked = [...against, ...(taken.get(`${mass.id}:${facade}:${o.storey}`) ?? [])]
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
    const key = `${mass.id}:${facade}:${o.storey}`
    taken.set(key, [...(taken.get(key) ?? []), [lo, hi]])
    const status: ProvenanceStatus = o.basis === 'HYPOTHETICAL' ? 'ASSUMED_FOR_RENDERING' : prov
    const width = round6(hi - lo)
    const panes = Math.min(o.panes, Math.max(1, Math.floor(width / 0.45)))
    openings.push({
      id: `opening-${facade.toLowerCase()}-${o.storey}-${n + 1}`,
      storeyIndex: o.storey,
      massId: mass.id,
      facade,
      planeAt: facade === 'FRONT' ? mass.z0 : facade === 'REAR' ? mass.z1 : facade === 'WEST' ? mass.x0 : mass.x1,
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
    terraces.push({ id: `terrace-${n + 1}`, storeyIndex: 0, side: facade, polygon: [{ x: round6(r.x0), z: round6(r.z0) }, { x: round6(r.x1), z: round6(r.z0) }, { x: round6(r.x1), z: round6(r.z1) }, { x: round6(r.x0), z: round6(r.z1) }], topY: -0.02, thicknessM: 0.15, surface: 'UNKNOWN', edge: 'FLUSH', massIds: [host.id], featureId: `described-terrace-${n + 1}`, provenance: prov, why: `a terrace ${t.depthM} m deep against the ${t.side.toLowerCase()} side, as pictures ${t.images.join(', ')} show it` })
  })
  const canopies: CanopyV2[] = []
  d.canopies.forEach((c, n) => {
    const r: Rect = { x0: round6(Math.min(X(c.x0), X(c.x1))), x1: round6(Math.max(X(c.x0), X(c.x1))), z0: round6(Math.min(Z(c.z0), Z(c.z1))), z1: round6(Math.max(Z(c.z0), Z(c.z1))) }
    if (r.x1 - r.x0 < 0.5 || r.z1 - r.z0 < 0.5) return adj('FEATURE_DROPPED', `canopy ${n + 1}`, 'smaller than half a metre')
    // its posts stand along the edge away from the bodies it leans on: at both ends of that edge and evenly between
    const touches = (side: Facade): boolean => coveredSpans(r, side, masses.map((m) => ({ x0: m.x0, z0: m.z0, x1: m.x1, z1: m.z1 }))).length > 0
    const inset = 0.15
    const edges: Record<Facade, [{ x: number; z: number }, { x: number; z: number }]> = { FRONT: [{ x: r.x0 + inset, z: r.z0 + inset }, { x: r.x1 - inset, z: r.z0 + inset }], REAR: [{ x: r.x0 + inset, z: r.z1 - inset }, { x: r.x1 - inset, z: r.z1 - inset }], WEST: [{ x: r.x0 + inset, z: r.z0 + inset }, { x: r.x0 + inset, z: r.z1 - inset }], EAST: [{ x: r.x1 - inset, z: r.z0 + inset }, { x: r.x1 - inset, z: r.z1 - inset }] }
    const opposite: Record<Facade, Facade> = { FRONT: 'REAR', REAR: 'FRONT', WEST: 'EAST', EAST: 'WEST' }
    const leaning = (['FRONT', 'REAR', 'WEST', 'EAST'] as Facade[]).filter(touches)
    const outerSides = leaning.map((sd) => opposite[sd]).filter((sd) => !touches(sd))
    const outer = outerSides.sort((a, b) => Math.hypot(edges[b][1].x - edges[b][0].x, edges[b][1].z - edges[b][0].z) - Math.hypot(edges[a][1].x - edges[a][0].x, edges[a][1].z - edges[a][0].z))[0]
    const posts: Array<{ x: number; z: number }> = []
    if (c.posts > 0 && outer) {
      const [a, b] = edges[outer]
      const k = Math.max(1, c.posts)
      for (let i = 0; i < k; i += 1) {
        const t = k === 1 ? (touches(outer === 'FRONT' || outer === 'REAR' ? 'WEST' : 'FRONT') ? 1 : 0) : i / (k - 1)
        posts.push({ x: round6(a.x + (b.x - a.x) * t), z: round6(a.z + (b.z - a.z) * t) })
      }
    } else if (c.posts > 0) {
      // free-standing: at its corners
      for (const p of [edges.FRONT[0], edges.FRONT[1], edges.REAR[1], edges.REAR[0]].slice(0, Math.min(4, c.posts))) posts.push({ x: round6(p.x), z: round6(p.z) })
    }
    if (posts.length < c.posts) adj('FEATURE_ADJUSTED', `canopy ${n + 1}`, `${c.posts} post(s) stated, ${posts.length} placed`)
    // under a body's eaves the eaves are the cover: a plate is built only where it stays clear below the roof plane
    const mid = { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 }
    let underside = clamp(c.undersideM, 2.0, 7)
    for (const roof of planeRoofs) {
      const plane = planeAt(roof.layout, mid)
      if (!plane) continue
      const soffit = plane.datum.y + ((plane.datum.x - mid.x) * plane.downslope.x + (plane.datum.z - mid.z) * plane.downslope.z) * tanDeg(plane.pitchDeg) - roof.thicknessM / cosDeg(plane.pitchDeg)
      underside = Math.min(underside, soffit - 0.18 - 0.1)
    }
    if (underside < 2.05) {
      adj('FEATURE_DROPPED', `canopy ${n + 1}`, `it lies under a roof's eaves, which stand ${underside < 2.05 ? 'too low for a plate below them' : ''}: the eaves are its cover`)
      return
    }
    if (underside < c.undersideM - 0.08) adj('FEATURE_ADJUSTED', `canopy ${n + 1}`, `underside stated at ${c.undersideM} m, a roof's eaves stand over it: built at ${underside.toFixed(2)} m`)
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
export function reconstructFromHouseDescription(description: HouseDescription, modelId: string, options: { published?: PublishedFigure[] } = {}): DescribedModel {
  const { building, adjustments, mainMassId } = buildingFromHouseDescription(description, options)
  const emitted = emitBuilding(building, DESCRIBED_HOUSE_LABEL)
  const preview = fitPreviewProgram(emitted.program, { label: DESCRIBED_HOUSE_LABEL, modelId, mainMassId, toleranceM: 0.05 })
  if (!preview.fit.ok) return { ok: false, reason: `the model refused command ${preview.fit.failedAt} (${preview.fit.command.type}): ${preview.fit.errors.map((e) => `${e.code} ${e.message ?? ''}`).join('; ').slice(0, 400)}`, adjustments }
  const model = buildCandidateModel(preview.fit.program, DESCRIBED_HOUSE_LABEL, modelId)
  return { ok: true, building, modelJson: serializeModel(model), program: preview.fit.program as unknown[], adjustments, emitterNotes: emitted.notes, refused: preview.failures.map((f) => ({ type: f.type, ...(f.id ? { id: f.id } : {}), codes: f.codes, message: f.message })), fits: preview.fit.fits.map((f) => ({ openingId: f.openingId, action: f.action, why: f.why })) }
}
