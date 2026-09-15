/**
 * Independent measurements of the compiled Marcówki scene, shared by the
 * regression tests and the audit script. Everything here reads emitted
 * triangles through `@buildapp/verification` and plan polygons through the
 * model's records; nothing asks the compiler where it put anything.
 */
import { openingLeaves, type CanonicalBuildingModel, type Opening, type Vec2 } from '@buildapp/model'
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
  type OTri,
  type OVec3,
} from '@buildapp/verification'
import { EXPECTED_OPENINGS, EXPECTED_SHELL, createMarcowkiReferenceBuilding, type ExpectedOpening } from '../src/index.js'

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
  pitches: number[]
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
  return { pitches: planes.map((p) => p.pitchDeg), ridgeY: b.max.y, minZ: b.min.z, maxZ: b.max.z, minX: b.min.x, maxX: b.max.x, closed: manifoldReport(roof).closed, volume: meshVolume(roof), worstGap, worstOverlap, drop }
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

export { EXPECTED_OPENINGS, EXPECTED_SHELL }
