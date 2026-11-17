/**
 * v3.54.4 — what the COMPILED scene measures: the geometry a viewer shows, not the description that asked for it.
 *
 * Extents of the exterior walls, the top of every roof plane, the top of the whole building, and the bounds of every
 * object by its id — read off the triangles of the scene bundle. A check of a built house compares these numbers with
 * the source's, so that a parameter that was accepted and then lost on the way to the mesh is seen as lost.
 */
import type { MobileSceneBundle } from '@buildapp/mobile-scene'
import type { HouseGeometry } from '@buildapp/reconstruction'

export type Bounds = { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }
export type SceneMeasure = {
  exteriorWalls: (Bounds & { widthM: number; depthM: number }) | null
  roofTopY: number | null
  roofTopByBody: Record<string, number>
  buildingTopY: number | null
  /** ridge − terrain, when the document gives the terrain. */
  heightAboveTerrainM: number | null
  counts: { windows: number; doors: number; roofPlanes: number; walls: number; meshes: number }
  objects: Record<string, Bounds>
}

const r3 = (v: number): number => Math.round(v * 1000) / 1000

export function measureScene(bundle: MobileSceneBundle, geometry?: HouseGeometry): SceneMeasure {
  const objects: Record<string, Bounds> = {}
  const kinds = new Map<string, string>()
  for (const m of bundle.scene.meshes as unknown as Array<{ objectId?: string; objectKind?: string; semanticGroup?: string; positions: number[] }>) {
    const id = m.objectId ?? '?'
    kinds.set(id, `${m.objectKind ?? ''}|${m.semanticGroup ?? ''}`)
    const b = objects[id] ?? { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity }
    for (let i = 0; i + 2 < m.positions.length; i += 3) {
      b.x0 = Math.min(b.x0, m.positions[i])
      b.x1 = Math.max(b.x1, m.positions[i])
      b.y0 = Math.min(b.y0, m.positions[i + 1])
      b.y1 = Math.max(b.y1, m.positions[i + 1])
      b.z0 = Math.min(b.z0, m.positions[i + 2])
      b.z1 = Math.max(b.z1, m.positions[i + 2])
    }
    objects[id] = b
  }
  for (const b of Object.values(objects)) for (const k of Object.keys(b) as Array<keyof Bounds>) b[k] = r3(b[k])
  const of = (test: (kind: string, id: string) => boolean): Bounds | null => {
    const bs = Object.entries(objects).filter(([id]) => test(kinds.get(id) ?? '', id)).map(([, b]) => b)
    if (bs.length === 0) return null
    return { x0: Math.min(...bs.map((b) => b.x0)), x1: Math.max(...bs.map((b) => b.x1)), y0: Math.min(...bs.map((b) => b.y0)), y1: Math.max(...bs.map((b) => b.y1)), z0: Math.min(...bs.map((b) => b.z0)), z1: Math.max(...bs.map((b) => b.z1)) }
  }
  const walls = of((k) => k.startsWith('wall|') && !k.includes('INTERIOR'))
  const roofs = of((k) => /^roof/i.test(k))
  const all = of(() => true)
  const roofTopByBody: Record<string, number> = {}
  for (const body of geometry?.bodies ?? []) {
    const b = of((k, id) => /^roof/i.test(k) && id.startsWith(`roof-${body.id}-`))
    if (b) roofTopByBody[body.id] = b.y1
  }
  const count = (re: RegExp): number => [...kinds.entries()].filter(([, k]) => re.test(k)).length
  const terrain = geometry?.terrainY.value
  return {
    exteriorWalls: walls ? { ...walls, widthM: r3(walls.x1 - walls.x0), depthM: r3(walls.z1 - walls.z0) } : null,
    roofTopY: roofs ? roofs.y1 : null,
    roofTopByBody,
    buildingTopY: all ? all.y1 : null,
    heightAboveTerrainM: roofs && terrain !== undefined && terrain !== null ? r3(roofs.y1 - terrain) : null,
    counts: { windows: count(/^window\|/i), doors: count(/^door\|/i), roofPlanes: count(/^roofPlane\|/i), walls: count(/^wall\|/i), meshes: bundle.scene.meshes.length },
    objects,
  }
}
