/**
 * Independent measurements of the compiled Marcówki scene, shared by the
 * regression tests and the audit script. Everything here reads emitted
 * triangles through `@buildapp/verification` and plan polygons through the
 * model's records; nothing asks the compiler where it put anything.
 */
import { openingLeaves, polygonArea, roofOpeningUndersideShift, type CanonicalBuildingModel, type Opening, type Vec2 } from '@buildapp/model'
import { compileBuilding, solidTriangles, type CompiledScene } from '@buildapp/geometry'
import {
  boundsOf,
  boxesOverlap,
  depthProbeReport,
  lineCoverage,
  manifoldReport,
  materialLength,
  materialRuns,
  meshVolume,
  overlapEstimate,
  pointInPolygon,
  ringClosureReport,
  unionMaterialRuns,
  upwardPlanes,
  type Box3,
  type OTri,
  type OVec3,
} from '@buildapp/verification'
import { EXPECTED_OPENINGS, EXPECTED_ROOFLIGHT_CUT, EXPECTED_SHELL, EXPECTED_STAIR, EXPECTED_STAIR_VOID, createMarcowkiReferenceBuilding, type ExpectedOpening, type ExpectedRegion } from '../src/index.js'

export const V = (x: number, y: number, z: number): OVec3 => ({ x, y, z })

export type Scene = { model: CanonicalBuildingModel; scene: CompiledScene }

export function marcowkiScene(model = createMarcowkiReferenceBuilding()): Scene {
  return { model, scene: compileBuilding(model) }
}

/** Every structural solid, by id. */
export function structuralSolids(scene: CompiledScene): Map<string, OTri[]> {
  const ids = [...new Set(scene.meshes.filter((m) => m.structural).map((m) => m.solidId))].sort()
  return new Map(ids.map((id) => [id, solidTriangles(scene, id)]))
}

export const wallSolids = (s: Scene, ids: readonly string[]): Array<{ id: string; triangles: OTri[] }> => ids.map((id) => ({ id, triangles: solidTriangles(s.scene, id) }))

// ---------------------------------------------------------------------------
// Depth and recesses
// ---------------------------------------------------------------------------

export type DepthReport = {
  /** Extent of all structural solids along z. */
  minZ: number
  maxZ: number
  characteristicDepth: number
  /** Extent of the exterior ring walls along z (the walled envelope). */
  nominalMinZ: number
  nominalMaxZ: number
  nominalDepth: number
  frontZone: number
  rearZone: number
}

export function depthReport(s: Scene): DepthReport {
  const solids = structuralSolids(s.scene)
  let minZ = Infinity
  let maxZ = -Infinity
  for (const tris of solids.values()) {
    const b = boundsOf(tris)!
    minZ = Math.min(minZ, b.min.z)
    maxZ = Math.max(maxZ, b.max.z)
  }
  const ringIds = s.model.wallRings.flatMap((r) => r.wallIds)
  let nMin = Infinity
  let nMax = -Infinity
  for (const id of ringIds) {
    const b = boundsOf(solidTriangles(s.scene, id))!
    nMin = Math.min(nMin, b.min.z)
    nMax = Math.max(nMax, b.max.z)
  }
  return { minZ, maxZ, characteristicDepth: maxZ - minZ, nominalMinZ: nMin, nominalMaxZ: nMax, nominalDepth: nMax - nMin, frontZone: nMin - minZ, rearZone: maxZ - nMax }
}

export type RecessReport = {
  side: 'FRONT' | 'REAR'
  statedDepth: number
  rays: number
  /** Rays whose first material lies at the outer plane. */
  atOuterPlane: number
  shallowest: number
  /** Rays that met material nearer than the stated depth (minus tolerance). */
  nearerThanStated: number
  /** Rays that met material at the stated depth within tolerance (the back wall) — through a window they meet it further. */
  atBackPlane: number
  /** Beside the mouth, on the returns: rays that meet material at the outer plane. */
  returnRaysAtPlane: number
  returnRays: number
}

/** Probe the recess mouth from 0.5 m outside the outer plane, at three heights, through every structural solid. */
export function recessReport(s: Scene, side: 'FRONT' | 'REAR', heights = [0.4, 1.2, 2.0]): RecessReport {
  const solids = [...structuralSolids(s.scene).values()]
  const E = EXPECTED_SHELL
  const [x0, x1] = side === 'FRONT' ? E.frontRecessX : E.rearRecessX
  const plane = side === 'FRONT' ? E.frontOuterPlaneZ : E.rearOuterPlaneZ
  const dir = side === 'FRONT' ? V(0, 0, 1) : V(0, 0, -1)
  const start = side === 'FRONT' ? plane - 0.5 : plane + 0.5
  const stated = side === 'FRONT' ? E.frontZone : E.rearZone
  let rays = 0
  let atOuterPlane = 0
  let nearer = 0
  let atBack = 0
  let shallowest = Infinity
  for (const y of heights) {
    const r = depthProbeReport(solids, { origin: V(x0 + 0.02, y, start), ea: V(x1 - x0 - 0.04, 0, 0), eb: V(0, 0.001, 0), dir, samples: [60, 1], planeTolerance: 0.5 + 1e-3 })
    rays += r.rays
    atOuterPlane += r.atPlane
    for (const d of r.firstHit) {
      const depth = d - 0.5
      shallowest = Math.min(shallowest, depth)
      if (depth < stated - 1e-3) nearer++
      if (Math.abs(depth - stated) <= 1e-3) atBack++
    }
  }
  // the returns beside the mouth
  const retX = side === 'FRONT' ? [[0, x0], [E.overallWidth - E.returnThickness, E.overallWidth]] : [[0, x0], [x1, E.mainWidth]]
  let returnRays = 0
  let returnAt = 0
  for (const [a, b] of retX) {
    const r = depthProbeReport(solids, { origin: V(a + 0.02, 1.2, start), ea: V(b - a - 0.04, 0, 0), eb: V(0, 0.001, 0), dir, samples: [6, 1], planeTolerance: 0.5 + 1e-3 })
    returnRays += r.rays
    returnAt += r.atPlane
  }
  return { side, statedDepth: stated, rays, atOuterPlane, shallowest, nearerThanStated: nearer, atBackPlane: atBack, returnRaysAtPlane: returnAt, returnRays }
}

// ---------------------------------------------------------------------------
// Openings
// ---------------------------------------------------------------------------

export type OpeningReport = {
  id: string
  found: boolean
  /** Wall material met by a ray through the opening's centre (0 for a real hole), across every leaf. */
  through: number
  /** 6 cm beside the near jamb and 8 cm above the head (near edge): the wall thickness. */
  beside: number
  above: number
  /** The fill's meshes are hosted by the wall and lie inside the hole. */
  fillParts: number
  fillHost: boolean
  fillInside: boolean
  /** For a raked head: the worst distance between the source head line and where material begins, over 11 stations. */
  headError: number
  leaves: number
}

/** True when the host wall runs along +axis, so the opening's near edge (offset side) is the low end of its world span. */
export function openingNearIsLow(model: CanonicalBuildingModel, e: ExpectedOpening): boolean {
  const w = model.walls.find((x) => x.id === e.wallId)!
  const alongX = e.facade === 'FRONT' || e.facade === 'REAR' || e.facade === 'GARAGE_NORTH'
  return alongX ? w.end.x > w.start.x : w.end.z > w.start.z
}

/** A ray across the host wall at world position (u along the wall's axis, y), from outside. */
function acrossWall(e: ExpectedOpening, u: number, y: number): { origin: OVec3; dir: OVec3 } {
  const alongX = e.facade === 'FRONT' || e.facade === 'REAR' || e.facade === 'GARAGE_NORTH'
  const outside = e.facePlane + e.outward * 1.0
  return alongX ? { origin: V(u, y, outside), dir: V(0, 0, -e.outward) } : { origin: V(outside, y, u), dir: V(-e.outward, 0, 0) }
}

export function openingReport(s: Scene, e: ExpectedOpening): OpeningReport {
  const o = s.model.openings.find((x) => x.id === e.id)
  if (!o) return { id: e.id, found: false, through: NaN, beside: NaN, above: NaN, fillParts: 0, fillHost: false, fillInside: false, headError: NaN, leaves: 0 }
  const leaves = openingLeaves(o)
  const leafSolids = leaves.map((l) => solidTriangles(s.scene, l.wallId))
  const total = (u: number, y: number): number => {
    const r = acrossWall(e, u, y)
    return leafSolids.reduce((sum, tris) => sum + materialLength(tris, r.origin, r.dir), 0)
  }
  const [u0, u1] = e.span
  const mid = (u0 + u1) / 2
  const midY = (e.sill + Math.min(e.headNear, e.headFar)) / 2
  const through = total(mid, midY)
  const beside = total(u0 - 0.06, midY)
  // Whether the opening's near edge (its wall-local offset side) is the low end of the world span: the host runs along +axis.
  const nearIsLow = openingNearIsLow(s.model, e)
  const headAtLowEdge = nearIsLow ? e.headNear : e.headFar
  const headAtHighEdge = nearIsLow ? e.headFar : e.headNear
  // 0.10 m in from the low end of the span the source head line (linear between the two printed heights) is:
  const headAtProbe = headAtLowEdge + (0.1 / (u1 - u0)) * (headAtHighEdge - headAtLowEdge)
  const above = total(u0 + 0.1, headAtProbe + 0.08)
  const fills = s.scene.meshes.filter((m) => m.openingId === e.id && !m.structural)
  const wallB = boundsOf(solidTriangles(s.scene, e.wallId))!
  const fillInside = fills
    .filter((m) => m.part !== 'DOOR_LEAF' && m.part !== 'DOOR_HANDLE')
    .every((m) => {
      const b = boundsOf(m.triangles)!
      return b.min.x >= wallB.min.x - 1e-9 && b.max.x <= wallB.max.x + 1e-9 && b.min.z >= wallB.min.z - 1e-9 && b.max.z <= wallB.max.z + 1e-9 && b.min.y >= e.sill - 1e-9 && b.max.y <= Math.max(e.headNear, e.headFar) + 1e-9
    })
  let headError = 0
  if (e.raked) {
    // The source head line, rebuilt from the printed heights alone, from the low end of the span to the high end.
    for (let k = 0; k <= 10; k++) {
      const f = 0.05 + (k / 10) * 0.9
      const u = u0 + f * (u1 - u0)
      const hLow = nearIsLow ? e.headNear : e.headFar
      const hHigh = nearIsLow ? e.headFar : e.headNear
      const h = hLow + f * (hHigh - hLow)
      // find where material begins along a vertical line just inside the outer face
      const r = acrossWall(e, u, 0)
      const alongX = e.facade === 'FRONT' || e.facade === 'REAR' || e.facade === 'GARAGE_NORTH'
      const probe = alongX ? V(u, e.sill - 1, e.facePlane - e.outward * (e.thickness / 2)) : V(e.facePlane - e.outward * (e.thickness / 2), e.sill - 1, u)
      void r
      const runs = materialRuns(leafSolids[0], probe, V(0, 1, 0)).filter((x) => x.t0 + e.sill - 1 > e.sill + 1e-6)
      const begins = runs.length > 0 ? runs[0].t0 + (e.sill - 1) : Infinity
      headError = Math.max(headError, Math.abs(begins - h))
    }
  }
  return { id: e.id, found: true, through, beside, above, fillParts: fills.length, fillHost: fills.length > 0 && fills.every((m) => m.hostWallId === e.wallId), fillInside, headError, leaves: leaves.length }
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

/** The room polygon on `levelId` containing the plan point, or undefined. */
export function roomAt(model: CanonicalBuildingModel, levelId: string, p: Vec2): string | undefined {
  const hits = model.rooms.filter((r) => r.levelId === levelId && pointInPolygon({ x: p.x, z: p.z }, r.polygon))
  return hits[0]?.id
}

/** The room 0.33 m inside the host wall's inner face at the opening's centre, found by point-in-polygon and nothing else. */
export function roomBehindOpening(model: CanonicalBuildingModel, e: ExpectedOpening): string | undefined {
  const wall = model.walls.find((w) => w.id === e.wallId)!
  const [u0, u1] = e.span
  const mid = (u0 + u1) / 2
  const alongX = e.facade === 'FRONT' || e.facade === 'REAR' || e.facade === 'GARAGE_NORTH'
  const inner = e.facePlane - e.outward * (e.thickness + 0.33)
  const p = alongX ? { x: mid, z: inner } : { x: inner, z: mid }
  return roomAt(model, wall.levelId, p)
}

/** For an interior door: the rooms 0.2 m either side of the host wall at the door's centre. */
export function roomsEitherSide(model: CanonicalBuildingModel, opening: Opening): [string | undefined, string | undefined] {
  const w = model.walls.find((x) => x.id === opening.wallId)!
  const L = Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z)
  const ux = (w.end.x - w.start.x) / L
  const uz = (w.end.z - w.start.z) / L
  const nx = uz
  const nz = -ux
  const a = opening.offset + opening.width / 2
  const cx = w.start.x + ux * a
  const cz = w.start.z + uz * a
  const outside = { x: cx + nx * 0.2, z: cz + nz * 0.2 }
  const inside = { x: cx - nx * (w.thickness + 0.2), z: cz - nz * (w.thickness + 0.2) }
  return [roomAt(model, w.levelId, outside), roomAt(model, w.levelId, inside)]
}

// ---------------------------------------------------------------------------
// Roof
// ---------------------------------------------------------------------------

export type RoofReport = {
  /** Pitches of the roof's major upward planes (area over 1 m²): the two slopes. */
  pitches: number[]
  /** The minor upward planes: with rooflights cut normal to the roof, their lower reveals face up at 90° − pitch. */
  minorPlanes: Array<{ pitchDeg: number; area: number }>
  ridgeY: number
  minZ: number
  maxZ: number
  minX: number
  maxX: number
  closed: boolean
  volume: number
  /** Daylight / overlap between the eave walls' tops and the roof underside, worst over probes on both faces. */
  worstGap: number
  worstOverlap: number
  /** Vertical roof thickness measured by a ray. */
  drop: number
}

export function roofReport(s: Scene): RoofReport {
  const roof = solidTriangles(s.scene, 'roof-main')
  const planes = upwardPlanes(roof)
  const b = boundsOf(roof)!
  let worstGap = 0
  let worstOverlap = 0
  for (const id of ['u-left', 'u-right', 'ret-west-front', 'ret-east-front', 'ret-west-rear', 'ret-east-rear']) {
    const wall = solidTriangles(s.scene, id)
    const wb = boundsOf(wall)!
    for (const fx of [0.02, 0.5, 0.98]) {
      for (const fz of [0.2, 0.5, 0.8]) {
        const x = wb.min.x + (wb.max.x - wb.min.x) * fx
        const z = wb.min.z + (wb.max.z - wb.min.z) * fz
        const w = materialRuns(wall, V(x, -1, z), V(0, 1, 0))
        const r = materialRuns(roof, V(x, -1, z), V(0, 1, 0))
        if (w.length === 0 || r.length === 0) continue
        const top = w[w.length - 1].t1
        const under = r[0].t0
        worstGap = Math.max(worstGap, under - top)
        worstOverlap = Math.max(worstOverlap, top - under)
      }
    }
  }
  const drop = materialLength(roof, V(2, 0, 2.5), V(0, 1, 0))
  const major = planes.filter((p) => p.area >= 1)
  const minor = planes.filter((p) => p.area < 1).map((p) => ({ pitchDeg: p.pitchDeg, area: p.area }))
  return { pitches: major.map((p) => p.pitchDeg), minorPlanes: minor, ridgeY: b.max.y, minZ: b.min.z, maxZ: b.max.z, minX: b.min.x, maxX: b.max.x, closed: manifoldReport(roof).closed, volume: meshVolume(roof), worstGap, worstOverlap, drop }
}

// ---------------------------------------------------------------------------
// Slabs, railings, overlaps, rings
// ---------------------------------------------------------------------------

export function railingReport(s: Scene, id: string): { run: [number, number]; coverage: number; longestGap: number; glassParts: number; top: number; base: number } {
  const r = s.model.railings.find((x) => x.id === id)!
  const infill = s.scene.meshes.filter((m) => m.objectId === id && m.part === 'RAILING_INFILL').map((m) => m.triangles)
  const all = s.scene.meshes.filter((m) => m.objectId === id).flatMap((m) => m.triangles)
  const b = boundsOf(all)!
  const y = (b.min.y + b.max.y) / 2
  const z = (b.min.z + b.max.z) / 2
  const c = lineCoverage(infill, V(r.start.x, y, z), V(r.end.x, y, z))
  return { run: [b.min.x, b.max.x], coverage: c.fraction, longestGap: c.longestGap, glassParts: infill.length, top: b.max.y, base: b.min.y }
}

export function pairwiseOverlaps(s: Scene, step = 0.1): string[] {
  const solids = structuralSolids(s.scene)
  const ids = [...solids.keys()]
  const bounds = new Map(ids.map((id) => [id, boundsOf(solids.get(id)!)!]))
  const found: string[] = []
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      if (!boxesOverlap(bounds.get(ids[i])!, bounds.get(ids[j])!)) continue
      const est = overlapEstimate(solids.get(ids[i])!, solids.get(ids[j])!, step)
      if (est.volume > 1e-6 || est.worstSharedLength > 1e-6) found.push(`${ids[i]}|${ids[j]}`)
    }
  }
  return found.sort()
}

/**
 * Ring closure of the three enclosures. The attic ring is probed on a variant
 * compiled without its three floor-to-head gable openings: no probe height
 * clears a 2.70 m glazing whose sill is the attic floor, so the topology
 * (corner ownership, contact, no overlap) is checked on its own and the
 * openings are proved separately by `openingReport`.
 */
export function ringReports(s: Scene) {
  const E = EXPECTED_SHELL
  const main = [{ x: 0, z: E.frontBackPlaneZ }, { x: E.mainWidth, z: E.frontBackPlaneZ }, { x: E.mainWidth, z: E.rearBackPlaneZ }, { x: 0, z: E.rearBackPlaneZ }]
  // The garage enclosure is closed by the main body's east wall (one 0.45 m leaf): its envelope runs from that wall's outer... west face at x 7.45,
  // and the front corner block at x 7.45..7.90 belongs to the main body's front wall, which is therefore probed with the garage walls.
  const garage = [{ x: E.mainWidth - E.wallThickness, z: E.frontBackPlaneZ }, { x: E.overallWidth, z: E.frontBackPlaneZ }, { x: E.overallWidth, z: E.frontBackPlaneZ + E.garageDepth }, { x: E.mainWidth - E.wallThickness, z: E.frontBackPlaneZ + E.garageDepth }]
  const gableIds = new Set(s.model.openings.filter((o) => o.head?.kind === 'RAKED').map((o) => o.id))
  const noGable = compileBuilding({ ...s.model, openings: s.model.openings.filter((o) => !gableIds.has(o.id)), windows: s.model.windows.filter((w) => !gableIds.has(w.openingId)) })
  const atticSolids = ['u-front', 'u-right', 'u-rear', 'u-left'].map((id) => ({ id, triangles: solidTriangles(noGable, id) }))
  return {
    ground: ringClosureReport(main, wallSolids(s, ['g-front', 'g-right', 'g-rear', 'g-left']), { heights: [0.3, 2.8], step: 0.1 }),
    attic: ringClosureReport(main, atticSolids, { heights: [3.3, 4.2], step: 0.1 }),
    garage: ringClosureReport(garage, wallSolids(s, ['gar-front', 'gar-right', 'gar-rear', 'g-right', 'g-front']), { heights: [0.3, 2.4], step: 0.1 }),
  }
}

/** Union material runs of a vertical ray through all structural solids. */
export const verticalRuns = (s: Scene, x: number, z: number) => unionMaterialRuns([...structuralSolids(s.scene).values()], V(x, -1, z), V(0, 1, 0)).map((r) => ({ y0: r.t0 - 1, y1: r.t1 - 1 }))

// ---------------------------------------------------------------------------
// STAGE BUILDAPP-01A: the stair, its void, the rooflight cut, the assemblies, the finish regions, the recess floors
// ---------------------------------------------------------------------------

export type StairReport = {
  found: boolean
  kind: string
  parts: string[]
  closed: boolean
  bounds: Box3 | null
  volume: number
  /** Tread tops met by vertical rays along the walking line (lower flight, winders at half width, upper flight), in walking order. */
  treadTops: number[]
  /** Differences between consecutive tread tops, the first from the floor: the measured riser heights. */
  riserHeights: number[]
  /** The first riser face, found by a low horizontal ray along the lower flight from the hall. */
  firstRiserX: number
  /** Where the arrival plate reaches: the highest emitted point over the last 0.02 m before the arrival line. */
  arrivalTop: number
  /** Material met by a vertical ray in the corner outside the fan (should be the winders) and in the void beside the stair (nothing). */
  cornerTop: number
}

/** The walking line of the Marcówki stair from the expected layout (half width from the newel side), one probe per tread. */
export function stairWalkingLine(): Vec2[] {
  const S = EXPECTED_STAIR
  const pts: Vec2[] = []
  const zMid = (S.southBand[0] + S.southBand[1]) / 2
  for (let k = 0; k < S.lowerRisers; k++) pts.push({ x: S.start.x + (k + 0.5) * S.lowerGoing, z: zMid })
  const newel = { x: S.cornerX, z: S.southBand[1] }
  for (let k = 0; k < S.winders; k++) {
    const th = ((k + 0.5) / S.winders) * (Math.PI / 2)
    // from the entering line's direction (−z from the newel) towards the exit direction (+x)
    pts.push({ x: newel.x + (S.width / 2) * Math.sin(th), z: newel.z - (S.width / 2) * Math.cos(th) })
  }
  const xMid = (S.eastBand[0] + S.eastBand[1]) / 2
  for (let k = 0; k < S.upperRisers - 1; k++) pts.push({ x: xMid, z: S.southBand[1] + (k + 0.5) * S.upperGoing })
  return pts
}

export function stairReport(s: Scene): StairReport {
  const st = s.model.stairs.find((x) => x.id === 'stair-main')
  const meshes = s.scene.meshes.filter((m) => m.objectId === 'stair-main')
  const tris = meshes.flatMap((m) => m.triangles)
  if (!st || tris.length === 0) return { found: false, kind: st?.kind ?? '', parts: [], closed: false, bounds: null, volume: 0, treadTops: [], riserHeights: [], firstRiserX: NaN, arrivalTop: NaN, cornerTop: NaN }
  const S = EXPECTED_STAIR
  const topAt = (p: Vec2): number => {
    const runs = materialRuns(tris, V(p.x, -1, p.z), V(0, 1, 0))
    return runs.length ? runs[runs.length - 1].t1 - 1 : NaN
  }
  const treadTops = stairWalkingLine().map(topAt)
  const riserHeights = treadTops.map((t, i) => (i === 0 ? t - S.rise * 0 : t - treadTops[i - 1]))
  const zMid = (S.southBand[0] + S.southBand[1]) / 2
  const first = materialRuns(tris, V(S.start.x - 1, 0.05, zMid), V(1, 0, 0))
  const firstRiserX = first.length ? S.start.x - 1 + first[0].t0 : NaN
  const arrivalTop = topAt({ x: (S.eastBand[0] + S.eastBand[1]) / 2, z: S.arrivalZ - 0.02 })
  const cornerTop = topAt({ x: S.cornerX + 0.85, z: S.southBand[0] + 0.15 })
  return { found: true, kind: st.kind, parts: [...new Set(meshes.map((m) => m.part))].sort(), closed: manifoldReport(tris).closed, bounds: boundsOf(tris), volume: meshVolume(tris), treadTops, riserHeights, firstRiserX, arrivalTop, cornerTop }
}

export type VoidReport = {
  closed: boolean
  volume: number
  holes: number
  holeArea: number
  /** Vertical rays on a 0.05 m grid over the stair shaft: inside the expected L the slab must be absent, outside it present at full thickness. */
  insideRays: number
  insideBlocked: number
  outsideRays: number
  outsideThin: number
  /** The void reaches the east inner face: slab material 1 cm west of the face inside the void's z range. */
  eastFaceOpen: boolean
}

export function slabVoidReport(s: Scene): VoidReport {
  const slab = solidTriangles(s.scene, 'slab-upper')
  const rec = s.model.slabs.find((x) => x.id === 'slab-upper')!
  const E = EXPECTED_SHELL
  const shaft = EXPECTED_STAIR.extent
  let insideRays = 0
  let insideBlocked = 0
  let outsideRays = 0
  let outsideThin = 0
  for (let x = shaft.minX + 0.025; x < shaft.maxX; x += 0.05) {
    for (let z = shaft.minZ + 0.025; z < shaft.maxZ; z += 0.05) {
      const inside = pointInPolygon({ x, z }, EXPECTED_STAIR_VOID)
      const len = materialLength(slab, V(x, 2.5, z), V(0, 1, 0))
      if (inside) {
        insideRays++
        if (len > 1e-9) insideBlocked++
      } else {
        outsideRays++
        if (Math.abs(len - E.slabThickness) > 1e-9) outsideThin++
      }
    }
  }
  const eastFaceOpen = materialLength(slab, V(shaft.maxX - 0.01, 2.5, (shaft.minZ + shaft.maxZ) / 2), V(0, 1, 0)) === 0
  return { closed: manifoldReport(slab).closed, volume: meshVolume(slab), holes: rec.holes?.length ?? 0, holeArea: (rec.holes ?? []).reduce((a, h) => a + polygonArea(h), 0), insideRays, insideBlocked, outsideRays, outsideThin, eastFaceOpen }
}

export type RooflightCutReport = {
  id: string
  mode: string
  /** Rays along the roof's own normal through a grid over the top outline: with a normal cut none meets roof material. */
  normalRays: number
  normalRaysBlocked: number
  /** Vertical ray through the outline centre: open either way. */
  centreOpen: boolean
  /** The underside outline's uphill offset from the top outline, measured by vertical rays across the uphill edge (0 for a vertical cut). */
  undersideShift: number
  expectedShift: number
}

export function rooflightCutReport(s: Scene, id: string): RooflightCutReport {
  const o = s.model.roofOpenings.find((x) => x.id === id)!
  const roofRec = s.model.roofs.find((r) => r.id === o.roofId)!
  const roof = solidTriangles(s.scene, o.roofId)
  const E = EXPECTED_SHELL
  const pitch = (E.pitchDeg * Math.PI) / 180
  const f = o.footprint
  const cx = (f.minX + f.maxX) / 2
  const cz = (f.minZ + f.maxZ) / 2
  // the slope's outward normal: the west slope rises towards +x, the east slope towards −x
  const uphill = cx < E.mainWidth / 2 ? 1 : -1
  const n = V(-uphill * Math.sin(pitch), Math.cos(pitch), 0)
  const topAt = (x: number): number => E.eaveTop + Math.tan(pitch) * (uphill === 1 ? x : E.mainWidth - x)
  let normalRays = 0
  let blocked = 0
  for (let i = 0; i < 12; i++) {
    for (let j = 0; j < 8; j++) {
      const x = f.minX + 0.02 + ((f.maxX - f.minX - 0.04) * (i + 0.5)) / 12
      const z = f.minZ + 0.02 + ((f.maxZ - f.minZ - 0.04) * (j + 0.5)) / 8
      const p = V(x, topAt(x), z)
      const origin = V(p.x + n.x, p.y + n.y, p.z + n.z)
      normalRays++
      if (materialLength(roof, origin, V(-n.x, -n.y, -n.z)) > 1e-9) blocked++
    }
  }
  const centreOpen = materialLength(roof, V(cx, 0, cz), V(0, 1, 0)) === 0
  // Uphill of the top outline's edge the plate is a wedge: the top surface has material, the underside is still
  // open, so a vertical ray reads less than the full drop until the underside outline ends. Bisect for where it
  // first reads the full drop; that distance IS the underside shift (0 for a vertical cut). Probes stay clear of
  // the edge itself, where a ray running exactly along a mesh edge has no well-defined material length.
  const edge = uphill === 1 ? f.maxX : f.minX
  const full = (d: number): boolean => materialLength(roof, V(edge + uphill * d, 0, cz), V(0, 1, 0)) >= E.roofVerticalDrop - 1e-9
  let lo = 0.004
  let hi = 0.4
  let shift = 0
  if (!full(lo) && full(hi)) {
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2
      if (full(mid)) hi = mid
      else lo = mid
    }
    shift = (lo + hi) / 2
  }
  const expected = Math.abs(roofOpeningUndersideShift(roofRec, o).dx)
  return { id, mode: o.cut ?? 'VERTICAL', normalRays, normalRaysBlocked: blocked, centreOpen, undersideShift: shift, expectedShift: expected }
}

export type AssemblyReport = {
  id: string
  found: boolean
  panels: string[]
  parts: string[]
  /** World span along the wall of the leaf / glass / panel pieces (x for front and garage-north walls). */
  leafSpan: [number, number] | null
  glassSpan: [number, number] | null
  panelSpan: [number, number] | null
  frameClosed: boolean
  /** Which side of the opening the glazed sidelight sits on, along +axis. */
  glassSide: 'LOW' | 'HIGH' | null
}

export function assemblyReport(s: Scene, doorId: string): AssemblyReport {
  const door = s.model.doors.find((d) => d.id === doorId)
  const meshes = s.scene.meshes.filter((m) => m.objectId === doorId)
  if (!door || meshes.length === 0) return { id: doorId, found: false, panels: [], parts: [], leafSpan: null, glassSpan: null, panelSpan: null, frameClosed: false, glassSide: null }
  const opening = s.model.openings.find((o) => o.id === door.openingId)!
  const wall = s.model.walls.find((w) => w.id === opening.wallId)!
  const alongX = Math.abs(wall.end.z - wall.start.z) < 1e-9
  const span = (part: string): [number, number] | null => {
    const t = meshes.filter((m) => m.part === part).flatMap((m) => m.triangles)
    if (t.length === 0) return null
    const b = boundsOf(t)!
    return alongX ? [b.min.x, b.max.x] : [b.min.z, b.max.z]
  }
  const leafSpan = span('DOOR_LEAF')
  const glassSpan = span('DOOR_GLASS')
  const frame = meshes.filter((m) => m.part === 'DOOR_FRAME').flatMap((m) => m.triangles)
  const openingMid = (() => {
    const L = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z)
    const u = { x: (wall.end.x - wall.start.x) / L, z: (wall.end.z - wall.start.z) / L }
    const a = opening.offset + opening.width / 2
    return alongX ? wall.start.x + u.x * a : wall.start.z + u.z * a
  })()
  const glassSide = glassSpan ? ((glassSpan[0] + glassSpan[1]) / 2 > openingMid ? 'HIGH' : 'LOW') : null
  return { id: doorId, found: true, panels: door.assembly?.panels.map((p) => p.kind) ?? [], parts: [...new Set(meshes.map((m) => m.part))].sort(), leafSpan, glassSpan, panelSpan: span('DOOR_PANEL'), frameClosed: manifoldReport(frame).closed, glassSide }
}

export type RegionReport = {
  id: string
  found: boolean
  hostOk: boolean
  structural: boolean
  part: string
  /** World span along the host's axis and up. */
  across: [number, number]
  up: [number, number]
  /** Extent across the wall normal: a skin, not a wall. */
  thickness: number
  /** Distance from the wall face to the skin's outer surface, measured by a ray along the normal at the band's centre. */
  standOff: number
  /** Rays along the wall normal through the centre of every listed opening: none may meet the region. */
  openingRays: number
  openingRaysHit: number
  /** For a band that runs to the roof: the region's top follows the wall top within 5 mm at three stations. */
  roofFollow: number
  volume: number
}

export function regionReport(s: Scene, e: ExpectedRegion): RegionReport {
  const rec = s.model.surfaceRegions.find((r) => r.id === e.id)
  const meshes = s.scene.meshes.filter((m) => m.objectId === e.id)
  const tris = meshes.flatMap((m) => m.triangles)
  const alongX = e.facade === 'FRONT' || e.facade === 'REAR'
  if (!rec || tris.length === 0) return { id: e.id, found: false, hostOk: false, structural: true, part: '', across: [NaN, NaN], up: [NaN, NaN], thickness: NaN, standOff: NaN, openingRays: 0, openingRaysHit: 0, roofFollow: NaN, volume: 0 }
  const b = boundsOf(tris)!
  const across: [number, number] = alongX ? [b.min.x, b.max.x] : [b.min.z, b.max.z]
  const thickness = alongX ? b.max.z - b.min.z : b.max.x - b.min.x
  const ray = (u: number, y: number): { origin: OVec3; dir: OVec3 } => {
    const outside = e.facePlane + e.outward * 0.5
    return alongX ? { origin: V(u, y, outside), dir: V(0, 0, -e.outward) } : { origin: V(outside, y, u), dir: V(-e.outward, 0, 0) }
  }
  // the stand-off from the wall face: the first station along the band that is not inside one of its openings
  const midY = e.upToRoof ? b.min.y + 0.3 : (b.min.y + b.max.y) / 2
  let standOff = NaN
  for (let k = 1; k < 40 && Number.isNaN(standOff); k++) {
    const u = across[0] + ((across[1] - across[0]) * k) / 40
    const rk = ray(u, midY)
    const runs = materialRuns(tris, rk.origin, rk.dir)
    if (runs.length > 0) standOff = 0.5 - runs[0].t0
  }
  let openingRays = 0
  let hit = 0
  for (const oid of e.openings) {
    const o = s.model.openings.find((x) => x.id === oid)!
    const w = s.model.walls.find((x) => x.id === o.wallId)!
    const L = Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z)
    const ux = (w.end.x - w.start.x) / L
    const uz = (w.end.z - w.start.z) / L
    const a = o.offset + o.width / 2
    const u = alongX ? w.start.x + ux * a : w.start.z + uz * a
    for (const fy of [0.25, 0.5, 0.75]) {
      const y = s.model.levels.find((l) => l.id === w.levelId)!.elevation + o.sill + fy * o.height
      const r = ray(u, y)
      openingRays++
      if (materialLength(tris, r.origin, r.dir) > 0) hit++
    }
  }
  let roofFollow = 0
  if (e.upToRoof) {
    const wall = solidTriangles(s.scene, e.hostId)
    for (const fu of [0.15, 0.5, 0.85]) {
      const u = across[0] + fu * (across[1] - across[0])
      const inFace = e.facePlane - e.outward * 0.05
      const probe = alongX ? V(u, -1, inFace) : V(inFace, -1, u)
      const wr = materialRuns(wall, probe, V(0, 1, 0))
      const skinProbe = alongX ? V(u, -1, e.facePlane + e.outward * 0.004) : V(e.facePlane + e.outward * 0.004, -1, u)
      const rr = materialRuns(tris, skinProbe, V(0, 1, 0))
      if (wr.length && rr.length) roofFollow = Math.max(roofFollow, Math.abs(wr[wr.length - 1].t1 - rr[rr.length - 1].t1))
    }
  }
  return { id: e.id, found: true, hostOk: meshes.every((m) => m.hostWallId === e.hostId && m.hostWallId === rec.hostId), structural: meshes.some((m) => m.structural), part: meshes[0].part, across, up: [b.min.y, b.max.y], thickness, standOff, openingRays, openingRaysHit: hit, roofFollow, volume: meshVolume(tris) }
}

export type OpeningDimensionReport = {
  id: string
  found: boolean
  /** The hole's span along the wall axis, found by a horizontal ray through the wall at mid height (world u). */
  span: [number, number]
  /** The hole's sill and head at its centre, found by a vertical ray through the wall. */
  sill: number
  head: number
  /** The head at 0.1 m from each end of the span: equal for a level head, different for a raked one. */
  headLow: number
  headHigh: number
  raked: boolean
  expectedSpan: [number, number]
  expectedSill: number
  expectedHead: [number, number]
  /** Worst difference between the measured and the expected figures. */
  worst: number
}

/** The dimensions of an opening as the wall's material shows them, from rays alone. */
export function openingDimensionReport(s: Scene, e: ExpectedOpening): OpeningDimensionReport {
  const o = s.model.openings.find((x) => x.id === e.id)
  const empty = { id: e.id, found: false, span: [NaN, NaN] as [number, number], sill: NaN, head: NaN, headLow: NaN, headHigh: NaN, raked: false, expectedSpan: e.span, expectedSill: e.sill, expectedHead: [e.headNear, e.headFar] as [number, number], worst: NaN }
  if (!o) return empty
  const wall = solidTriangles(s.scene, e.wallId)
  const alongX = e.facade === 'FRONT' || e.facade === 'REAR' || e.facade === 'GARAGE_NORTH'
  const inFace = e.facePlane - e.outward * (e.thickness / 2)
  const [u0, u1] = e.span
  const mid = (u0 + u1) / 2
  const midY = (e.sill + Math.min(e.headNear, e.headFar)) / 2
  // along the wall through its middle plane: material runs; the gap around the expected centre is the opening
  const along = alongX ? materialRuns(wall, V(-1, midY, inFace), V(1, 0, 0)) : materialRuns(wall, V(inFace, midY, -1), V(0, 0, 1))
  const runsU = along.map((r) => [r.t0 - 1, r.t1 - 1] as [number, number])
  let span: [number, number] = [NaN, NaN]
  for (let i = 0; i + 1 < runsU.length; i++) if (runsU[i][1] <= mid && runsU[i + 1][0] >= mid) span = [runsU[i][1], runsU[i + 1][0]]
  const vertical = (u: number): [number, number] => {
    const probe = alongX ? V(u, -1, inFace) : V(inFace, -1, u)
    const rs = materialRuns(wall, probe, V(0, 1, 0)).map((r) => [r.t0 - 1, r.t1 - 1] as [number, number])
    for (let i = 0; i + 1 < rs.length; i++) if (rs[i][1] <= midY && rs[i + 1][0] >= midY) return [rs[i][1], rs[i + 1][0]]
    // a floor-to-head opening: the material begins above the sill
    const first = rs.find((r) => r[0] > midY)
    return [e.sill, first ? first[0] : NaN]
  }
  const [sill, head] = vertical(mid)
  const [, headLow] = vertical(u0 + 0.1)
  const [, headHigh] = vertical(u1 - 0.1)
  const nearIsLow = openingNearIsLow(s.model, e)
  const expLow = nearIsLow ? e.headNear : e.headFar
  const expHigh = nearIsLow ? e.headFar : e.headNear
  const expHeadLow = expLow + (0.1 / (u1 - u0)) * (expHigh - expLow)
  const expHeadHigh = expHigh - (0.1 / (u1 - u0)) * (expHigh - expLow)
  // A station where no opening was found at all reads NaN; that is not "no error", it is the opening not being
  // where the source puts it, so it counts as an unbounded one. (NaN would silently pass every comparison.)
  const errs = [Math.abs(span[0] - u0), Math.abs(span[1] - u1), Math.abs(sill - e.sill), Math.abs(headLow - expHeadLow), Math.abs(headHigh - expHeadHigh)]
  const worst = errs.some((v) => Number.isNaN(v)) ? Infinity : Math.max(...errs)
  return { ...empty, found: true, span, sill, head, headLow, headHigh, raked: Math.abs(headLow - headHigh) > 1e-6, worst }
}

export { EXPECTED_OPENINGS, EXPECTED_ROOFLIGHT_CUT, EXPECTED_SHELL }
