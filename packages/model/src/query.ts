/**
 * Read-only helpers over a CanonicalBuildingModel: lookups by id, wall frame
 * arithmetic, and the relations the rest of the system relies on.
 */
import type { PlanRect, Vec2, Vec3 } from './geometry-types.js'
import {
  COLLECTION_OF_KIND,
  OBJECT_COLLECTIONS,
  type CanonicalBuildingModel,
  type Door,
  type Level,
  type ObjectCollection,
  type Opening,
  type OpeningLeaf,
  type Roof,
  type RoofOpening,
  type Rooflight,
  type SemanticKind,
  type SemanticObject,
  type Wall,
  type WallJunction,
  type WallRing,
  type Window,
} from './schema.js'

export type Located = { kind: SemanticKind; collection: ObjectCollection | 'building'; object: SemanticObject }

/** Find any semantic object by id, with the collection it lives in. */
export function findObject(model: CanonicalBuildingModel, id: string): Located | undefined {
  if (model.building && model.building.id === id) {
    return { kind: 'building', collection: 'building', object: model.building }
  }
  for (const collection of OBJECT_COLLECTIONS) {
    const list = model[collection] as readonly SemanticObject[]
    const hit = list.find((o) => o.id === id)
    if (hit) return { kind: kindOfCollection(collection), collection, object: hit }
  }
  return undefined
}

export function kindOfCollection(c: ObjectCollection): Exclude<SemanticKind, 'building'> {
  for (const [kind, coll] of Object.entries(COLLECTION_OF_KIND)) {
    if (coll === c) return kind as Exclude<SemanticKind, 'building'>
  }
  throw new Error(`unknown collection ${c}`)
}

export const hasObject = (model: CanonicalBuildingModel, id: string): boolean => findObject(model, id) !== undefined

export const allObjectIds = (model: CanonicalBuildingModel): string[] => {
  const ids: string[] = []
  if (model.building) ids.push(model.building.id)
  for (const c of OBJECT_COLLECTIONS) for (const o of model[c] as readonly { id: string }[]) ids.push(o.id)
  return ids
}

export const levelById = (m: CanonicalBuildingModel, id: string): Level | undefined => m.levels.find((l) => l.id === id)
export const wallById = (m: CanonicalBuildingModel, id: string): Wall | undefined => m.walls.find((w) => w.id === id)
export const openingById = (m: CanonicalBuildingModel, id: string): Opening | undefined =>
  m.openings.find((o) => o.id === id)
export const roofById = (m: CanonicalBuildingModel, id: string): Roof | undefined => m.roofs.find((r) => r.id === id)
export const windowByOpening = (m: CanonicalBuildingModel, openingId: string): Window | undefined =>
  m.windows.find((w) => w.openingId === openingId)
export const doorByOpening = (m: CanonicalBuildingModel, openingId: string): Door | undefined =>
  m.doors.find((d) => d.openingId === openingId)
export const openingsOfWall = (m: CanonicalBuildingModel, wallId: string): Opening[] =>
  m.openings.filter((o) => o.wallId === wallId)
export const roofOpeningById = (m: CanonicalBuildingModel, id: string): RoofOpening | undefined =>
  m.roofOpenings.find((o) => o.id === id)
export const roofOpeningsOfRoof = (m: CanonicalBuildingModel, roofId: string): RoofOpening[] =>
  m.roofOpenings.filter((o) => o.roofId === roofId)
export const rooflightByOpening = (m: CanonicalBuildingModel, roofOpeningId: string): Rooflight | undefined =>
  m.rooflights.find((r) => r.roofOpeningId === roofOpeningId)

// ---------------------------------------------------------------------------
// Opening shape helpers
// ---------------------------------------------------------------------------

/** Height of the opening's head above the wall base at `a` along the host wall (linear across a raked head, clamped to the opening's span). */
export function openingHeadAt(o: Pick<Opening, 'offset' | 'width' | 'sill' | 'height' | 'head'>, a: number): number {
  if (!o.head || o.head.kind === 'LEVEL') return o.sill + o.height
  const f = Math.min(1, Math.max(0, (a - o.offset) / o.width))
  return o.sill + o.height + f * (o.head.heightFar - o.height)
}

/** The tallest and the lowest head height of the opening above the wall base. */
export const openingHeadRange = (o: Pick<Opening, 'sill' | 'height' | 'head'>): { min: number; max: number } => {
  const far = o.head?.kind === 'RAKED' ? o.head.heightFar : o.height
  return { min: o.sill + Math.min(o.height, far), max: o.sill + Math.max(o.height, far) }
}

/** True when the opening's head is not level. */
export const openingIsRaked = (o: Pick<Opening, 'head' | 'height'>): boolean => o.head?.kind === 'RAKED' && o.head.heightFar !== o.height

/** Every wall leaf an opening cuts: the host wall first, then the further leaves. */
export const openingLeaves = (o: Opening): OpeningLeaf[] => [{ wallId: o.wallId, offset: o.offset }, ...(o.leaves ?? [])]

/** The plan rectangle a roof covers, overhang included. */
export const roofCoveredRect = (r: Pick<Roof, 'footprint' | 'overhang'>): PlanRect => ({
  minX: r.footprint.minX - r.overhang,
  maxX: r.footprint.maxX + r.overhang,
  minZ: r.footprint.minZ - r.overhang,
  maxZ: r.footprint.maxZ + r.overhang,
})

/** The crease line of a gable roof (`x = value` when the ridge runs along Z, `z = value` when it runs along X); none for a flat roof. */
export const roofCreaseLine = (r: Pick<Roof, 'kind' | 'footprint' | 'ridgeAxis'>): { axis: 'X' | 'Z'; value: number } | undefined => {
  if (r.kind !== 'GABLE') return undefined
  return r.ridgeAxis === 'X' ? { axis: 'Z', value: (r.footprint.minZ + r.footprint.maxZ) / 2 } : { axis: 'X', value: (r.footprint.minX + r.footprint.maxX) / 2 }
}
export const wallsOfLevel = (m: CanonicalBuildingModel, levelId: string): Wall[] =>
  m.walls.filter((w) => w.levelId === levelId)
export const junctionById = (m: CanonicalBuildingModel, id: string): WallJunction | undefined =>
  m.wallJunctions.find((j) => j.id === id)
export const ringById = (m: CanonicalBuildingModel, id: string): WallRing | undefined => m.wallRings.find((r) => r.id === id)
/** Every junction a wall takes part in, as owner, trimmed end or host. */
export const junctionsOfWall = (m: CanonicalBuildingModel, wallId: string): WallJunction[] =>
  m.wallJunctions.filter((j) => (j.kind === 'CORNER' ? j.a.wallId === wallId || j.b.wallId === wallId : j.wall.wallId === wallId || j.againstWallId === wallId))
export const ringsOfWall = (m: CanonicalBuildingModel, wallId: string): WallRing[] => m.wallRings.filter((r) => r.wallIds.includes(wallId))
export const ringsOfJunction = (m: CanonicalBuildingModel, junctionId: string): WallRing[] =>
  m.wallRings.filter((r) => r.junctionIds.includes(junctionId))

/** The level an object stands on, following Window/Door -> Opening -> Wall -> Level. */
export function levelIdOf(model: CanonicalBuildingModel, id: string): string | undefined {
  const hit = findObject(model, id)
  if (!hit) return undefined
  const o = hit.object as Record<string, unknown>
  if (hit.kind === 'level') return hit.object.id
  if (typeof o.levelId === 'string') return o.levelId
  if (hit.kind === 'opening') {
    const w = wallById(model, (hit.object as Opening).wallId)
    return w?.levelId
  }
  if (hit.kind === 'window' || hit.kind === 'door') {
    const op = openingById(model, (hit.object as Window | Door).openingId)
    if (!op) return undefined
    return wallById(model, op.wallId)?.levelId
  }
  if (hit.kind === 'wallJunction') {
    const j = hit.object as WallJunction
    return wallById(model, j.kind === 'CORNER' ? j.a.wallId : j.wall.wallId)?.levelId
  }
  if (hit.kind === 'roofOpening') return roofById(model, (hit.object as RoofOpening).roofId)?.levelId
  if (hit.kind === 'rooflight') {
    const ro = roofOpeningById(model, (hit.object as Rooflight).roofOpeningId)
    return ro ? roofById(model, ro.roofId)?.levelId : undefined
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Wall frame arithmetic
// ---------------------------------------------------------------------------

export type WallFrame = {
  /** World point of the wall origin: start, at the wall base, on the outer face. */
  origin: Vec3
  /** Unit vector along the wall (start -> end). */
  u: Vec3
  /** Unit vector up. */
  up: Vec3
  /** Outward normal, `up x u`. Material lies along -n from the outer face. */
  n: Vec3
  length: number
  /** World y of the wall base. */
  baseY: number
}

export const wallLength = (w: Pick<Wall, 'start' | 'end'>): number =>
  Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z)

/**
 * The wall's right-handed local triad in the model frame. `n = up x u` is the
 * outward normal — see `MODEL_FRAME.wallConvention`.
 */
export function wallFrame(wall: Wall, level: Pick<Level, 'elevation'>): WallFrame {
  const length = wallLength(wall)
  const ux = (wall.end.x - wall.start.x) / length
  const uz = (wall.end.z - wall.start.z) / length
  const u: Vec3 = { x: ux, y: 0, z: uz }
  const up: Vec3 = { x: 0, y: 1, z: 0 }
  // up x u = (up.y*u.z - up.z*u.y, up.z*u.x - up.x*u.z, up.x*u.y - up.y*u.x)
  const n: Vec3 = { x: up.y * u.z - up.z * u.y, y: up.z * u.x - up.x * u.z, z: up.x * u.y - up.y * u.x }
  const baseY = level.elevation + wall.baseOffset
  return { origin: { x: wall.start.x, y: baseY, z: wall.start.z }, u, up, n, length, baseY }
}

/** Wall-local (a along u, b up, c inward from the outer face) to world. */
export function wallPoint(f: WallFrame, a: number, b: number, c: number): Vec3 {
  return {
    x: f.origin.x + f.u.x * a + f.up.x * b - f.n.x * c,
    y: f.origin.y + f.u.y * a + f.up.y * b - f.n.y * c,
    z: f.origin.z + f.u.z * a + f.up.z * b - f.n.z * c,
  }
}

/** Plan-only version of `wallPoint`, for callers that need x/z at the base. */
export function wallPlanPoint(f: WallFrame, a: number, c: number): Vec2 {
  const p = wallPoint(f, a, 0, c)
  return { x: p.x, z: p.z }
}
