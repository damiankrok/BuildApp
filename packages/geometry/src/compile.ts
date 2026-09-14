/**
 * The geometry compiler entry point: CanonicalBuildingModel -> CompiledScene.
 *
 * This is the only production path from semantics to triangles. The viewer
 * draws what comes out of here and nothing else; the editor recompiles after
 * every model change. Nothing in this module knows about React or Three.js.
 *
 * Invalid models are not compiled: a `MODEL_INVALID` diagnostic per issue is
 * returned with no meshes. Callers that hold a valid model (every command
 * result is one) always get geometry.
 */
import {
  validateModel,
  wallFrame,
  wallPlanPoint,
  type CanonicalBuildingModel,
  type Level,
  type Roof,
  type Wall,
} from '@buildapp/model'
import { compileDoorFill, compileWindowFill } from './fills.js'
import { compileBalcony, compileChimney, compileRailing, compileRoomFloor, compileSlab, compileStairPlaceholder } from './features.js'
import { compileRoofTriangles, roofBreaksAlong, roofGeometry, type RoofGeometry } from './roof-compiler.js'
import { compileWall, type TopFunction } from './wall-compiler.js'
import { boundsOfTriangles, type Bounds, type CompileDiagnostic, type CompiledMesh, type CompiledScene } from './types.js'

const byId = <T extends { id: string }>(list: readonly T[]): T[] => [...list].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

export type WallTop = { top: TopFunction; breaks: number[]; diagnostics: CompileDiagnostic[] }

/** The top function of a wall: flat, an explicit polyline, or the underside of a roof. */
export function wallTopFunction(wall: Wall, level: Level, roofs: ReadonlyMap<string, { roof: Roof; geometry: RoofGeometry }>): WallTop {
  const profile = wall.topProfile
  if (!profile || profile.kind === 'FLAT') return { top: () => wall.height, breaks: [], diagnostics: [] }
  if (profile.kind === 'POLYLINE') {
    const pts = profile.points
    const top: TopFunction = (u) => {
      if (u <= pts[0].u) return pts[0].height
      const last = pts[pts.length - 1]
      if (u >= last.u) return last.height
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i]
        const b = pts[i + 1]
        if (u >= a.u && u <= b.u) {
          const span = b.u - a.u
          return span <= 1e-12 ? b.height : a.height + ((u - a.u) / span) * (b.height - a.height)
        }
      }
      return last.height
    }
    return { top, breaks: pts.map((p) => p.u), diagnostics: [] }
  }
  const entry = roofs.get(profile.roofId)
  if (!entry) {
    // Validation guarantees the roof exists; keep the wall flat if it somehow does not.
    return { top: () => wall.height, breaks: [], diagnostics: [] }
  }
  const g = entry.geometry
  const f = wallFrame(wall, level)
  const top: TopFunction = (u, c) => {
    const p = wallPlanPoint(f, u, c)
    if (!g.covers(p.x, p.z)) return wall.height
    return Math.min(wall.height, g.undersideAt(p.x, p.z) - f.baseY)
  }
  const breaks: number[] = []
  const diagnostics: CompileDiagnostic[] = []
  let uncovered = false
  for (const c of [0, wall.thickness]) {
    const p = wallPlanPoint(f, 0, c)
    breaks.push(...roofBreaksAlong(g, p, { x: f.u.x, z: f.u.z }, f.length))
    for (const u of [0, f.length, ...breaks]) {
      const q = wallPlanPoint(f, u, c)
      if (!g.covers(q.x, q.z)) uncovered = true
    }
  }
  if (uncovered) {
    diagnostics.push({
      code: 'WALL_NOT_UNDER_ROOF',
      severity: 'WARNING',
      message: `wall ${wall.id} follows roof ${profile.roofId} but is not entirely under it; outside the roof it keeps its nominal height`,
      objectId: wall.id,
    })
  }
  return { top, breaks, diagnostics }
}

export function compileBuilding(model: CanonicalBuildingModel): CompiledScene {
  const diagnostics: CompileDiagnostic[] = []
  const meshes: CompiledMesh[] = []
  const validation = validateModel(model)
  if (!validation.ok) {
    for (const i of validation.issues) {
      if (i.severity === 'ERROR') diagnostics.push({ code: 'MODEL_INVALID', severity: 'ERROR', message: `[${i.code}] ${i.message}`, objectId: i.objectId })
    }
    return { modelId: model.id, meshes, diagnostics, bounds: null, stats: { triangleCount: 0, meshCount: 0, objectCount: 0 } }
  }

  const levels = new Map(model.levels.map((l) => [l.id, l]))
  const levelOf = (id: string, objectId: string): Level | undefined => {
    const l = levels.get(id)
    if (!l) diagnostics.push({ code: 'UNKNOWN_LEVEL', severity: 'ERROR', message: `${objectId} refers to level ${id}`, objectId })
    return l
  }
  const materialOf = (o: { materialId?: string }): string | undefined => o.materialId

  // Roofs first: walls need their undersides.
  const roofs = new Map<string, { roof: Roof; geometry: RoofGeometry }>()
  for (const roof of byId(model.roofs)) {
    const level = levelOf(roof.levelId, roof.id)
    if (!level) continue
    roofs.set(roof.id, { roof, geometry: roofGeometry(roof, level) })
  }

  const openingsByWall = new Map<string, typeof model.openings>()
  for (const o of byId(model.openings)) openingsByWall.set(o.wallId, [...(openingsByWall.get(o.wallId) ?? []), o])
  const windowByOpening = new Map(model.windows.map((w) => [w.openingId, w]))
  const doorByOpening = new Map(model.doors.map((d) => [d.openingId, d]))

  for (const wall of byId(model.walls)) {
    const level = levelOf(wall.levelId, wall.id)
    if (!level) continue
    const openings = openingsByWall.get(wall.id) ?? []
    const wt = wallTopFunction(wall, level, roofs)
    diagnostics.push(...wt.diagnostics)
    const r = compileWall({ wall, level, openings, top: wt.top, topBreaks: wt.breaks })
    diagnostics.push(...r.diagnostics)
    if (r.wallTriangles.length === 0) continue
    meshes.push({
      objectId: wall.id,
      objectKind: 'wall',
      part: 'WALL',
      levelId: wall.levelId,
      solidId: wall.id,
      structural: true,
      materialId: materialOf(wall),
      triangles: r.wallTriangles,
    })
    for (const o of openings) {
      const reveal = r.reveals.get(o.id)
      if (!reveal) {
        if (windowByOpening.has(o.id) || doorByOpening.has(o.id)) {
          diagnostics.push({ code: 'FILL_WITHOUT_OPENING', severity: 'WARNING', message: `the fill of opening ${o.id} was skipped because the opening was not cut`, objectId: o.id })
        }
        continue
      }
      meshes.push({
        objectId: o.id,
        objectKind: 'opening',
        part: 'WALL_REVEAL',
        levelId: wall.levelId,
        solidId: wall.id,
        hostWallId: wall.id,
        openingId: o.id,
        structural: true,
        materialId: materialOf(wall),
        triangles: reveal,
      })
      const win = windowByOpening.get(o.id)
      if (win) {
        for (const piece of compileWindowFill(win, o, r.frame)) {
          meshes.push({
            objectId: win.id,
            objectKind: 'window',
            part: piece.part,
            levelId: wall.levelId,
            solidId: `${win.id}:${piece.part}`,
            hostWallId: wall.id,
            openingId: o.id,
            structural: false,
            materialId: materialOf(win),
            triangles: piece.triangles,
          })
        }
      }
      const door = doorByOpening.get(o.id)
      if (door) {
        for (const piece of compileDoorFill(door, o, r.frame).pieces) {
          meshes.push({
            objectId: door.id,
            objectKind: 'door',
            part: piece.part,
            levelId: wall.levelId,
            solidId: `${door.id}:${piece.part}`,
            hostWallId: wall.id,
            openingId: o.id,
            structural: false,
            materialId: materialOf(door),
            triangles: piece.triangles,
          })
        }
      }
    }
  }

  for (const slab of byId(model.slabs)) {
    const level = levelOf(slab.levelId, slab.id)
    if (!level) continue
    const tris = compileSlab(slab, level)
    if (!tris) {
      diagnostics.push({ code: 'POLYGON_NOT_TRIANGULATED', severity: 'ERROR', message: `slab ${slab.id}: polygon could not be triangulated`, objectId: slab.id })
      continue
    }
    meshes.push({ objectId: slab.id, objectKind: 'slab', part: 'SLAB', levelId: slab.levelId, solidId: slab.id, structural: true, materialId: materialOf(slab), triangles: tris })
  }

  for (const [id, { roof }] of [...roofs.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const level = levels.get(roof.levelId)!
    const { triangles } = compileRoofTriangles(roof, level)
    meshes.push({ objectId: id, objectKind: 'roof', part: 'ROOF', levelId: roof.levelId, solidId: id, structural: true, materialId: materialOf(roof), triangles })
  }

  for (const b of byId(model.balconies)) {
    const level = levelOf(b.levelId, b.id)
    if (!level) continue
    meshes.push({ objectId: b.id, objectKind: 'balcony', part: 'BALCONY', levelId: b.levelId, solidId: b.id, structural: true, materialId: materialOf(b), triangles: compileBalcony(b, level) })
  }

  for (const r of byId(model.railings)) {
    const level = levelOf(r.levelId, r.id)
    if (!level) continue
    for (const piece of compileRailing(r, level)) {
      meshes.push({ objectId: r.id, objectKind: 'railing', part: piece.part, levelId: r.levelId, solidId: `${r.id}:${piece.part}`, structural: false, materialId: materialOf(r), triangles: piece.triangles })
    }
  }

  for (const c of byId(model.chimneys)) {
    const level = levelOf(c.levelId, c.id)
    if (!level) continue
    meshes.push({ objectId: c.id, objectKind: 'chimney', part: 'CHIMNEY', levelId: c.levelId, solidId: c.id, structural: true, materialId: materialOf(c), triangles: compileChimney(c, level) })
  }

  for (const room of byId(model.rooms)) {
    const level = levelOf(room.levelId, room.id)
    if (!level) continue
    const tris = compileRoomFloor(room, level)
    if (!tris) {
      diagnostics.push({ code: 'POLYGON_NOT_TRIANGULATED', severity: 'ERROR', message: `room ${room.id}: polygon could not be triangulated`, objectId: room.id })
      continue
    }
    meshes.push({ objectId: room.id, objectKind: 'room', part: 'ROOM_FLOOR', levelId: room.levelId, solidId: room.id, structural: false, triangles: tris })
  }

  for (const s of byId(model.stairs)) {
    const level = levelOf(s.levelId, s.id)
    if (!level) continue
    meshes.push({ objectId: s.id, objectKind: 'stair', part: 'STAIR_PLACEHOLDER', levelId: s.levelId, solidId: s.id, structural: false, triangles: compileStairPlaceholder(s, level) })
  }

  let bounds: Bounds | null = null
  let triangleCount = 0
  const objects = new Set<string>()
  for (const m of meshes) {
    bounds = boundsOfTriangles(m.triangles, bounds ?? undefined)
    triangleCount += m.triangles.length
    objects.add(m.objectId)
  }
  return { modelId: model.id, meshes, diagnostics, bounds, stats: { triangleCount, meshCount: meshes.length, objectCount: objects.size } }
}

/** All triangles of one closed solid (e.g. a wall with its reveals). */
export const solidTriangles = (scene: CompiledScene, solidId: string) =>
  scene.meshes.filter((m) => m.solidId === solidId).flatMap((m) => m.triangles)

/** All triangles owned by one semantic object. */
export const objectTriangles = (scene: CompiledScene, objectId: string) =>
  scene.meshes.filter((m) => m.objectId === objectId).flatMap((m) => m.triangles)
