/**
 * v3.54.4 / v3.54.5 — what the COMPILED scene measures: the geometry a viewer shows, not the description that asked for it.
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
  /**
   * v3.54.5 — every hole cut in an exterior wall, as the scene holds it: the side it is seen from, where it begins along
   * that side (from the left end of the walls as a viewer outside sees them), how wide and tall it is, and its bottom
   * and top above ±0,00. Measured on the triangles, for any model in this frame — the described house and LOCAL alike.
   */
  openings: SceneOpening[]
}
export type SceneSide = 'FRONT' | 'RIGHT' | 'REAR' | 'LEFT'
export type SceneOpening = { id: string; kind: 'WINDOW' | 'DOOR' | 'UNKNOWN'; side: SceneSide | null; alongM: number | null; widthM: number; heightM: number; bottomY: number; topY: number }

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
  // the holes: an opening lies in the plane of its wall; the side it faces is the one with nothing of the house in front
  const wallBoxes = Object.entries(objects).filter(([id]) => (kinds.get(id) ?? '').startsWith('wall|') && !(kinds.get(id) ?? '').includes('INTERIOR'))
  const units = Object.entries(objects).filter(([id]) => /^(window|door)\|/i.test(kinds.get(id) ?? ''))
  const openings: SceneOpening[] = []
  for (const [id, b] of Object.entries(objects)) {
    if (!(kinds.get(id) ?? '').startsWith('opening|') || !walls) continue
    const dx = b.x1 - b.x0
    const dz = b.z1 - b.z0
    const cx = (b.x0 + b.x1) / 2
    const cy = (b.y0 + b.y1) / 2
    const cz = (b.z0 + b.z1) / 2
    // a hole of an EXTERIOR wall: one that lies in an exterior wall's own box (a model with an interior has doors in partitions too)
    if (!wallBoxes.some(([, w]) => cx >= w.x0 - 0.05 && cx <= w.x1 + 0.05 && cz >= w.z0 - 0.05 && cz <= w.z1 + 0.05 && cy >= w.y0 - 0.05 && cy <= w.y1 + 0.05)) continue
    const unit = units.find(([, u]) => cx >= u.x0 - 0.05 && cx <= u.x1 + 0.05 && cz >= u.z0 - 0.05 && cz <= u.z1 + 0.05 && cy >= u.y0 - 0.05 && cy <= u.y1 + 0.05)
    const kind = unit ? (/^door\|/i.test(kinds.get(unit[0]) ?? '') ? ('DOOR' as const) : ('WINDOW' as const)) : ('UNKNOWN' as const)
    const base = { id, kind, heightM: r3(b.y1 - b.y0), bottomY: b.y0, topY: b.y1 }
    // a wall that runs neither along x nor along z (a splayed bay) faces no one side
    // (its box is then as deep as it is wide; a hole in a straight wall is as deep as the wall is thick)
    if (Math.min(dx, dz) > 0.55 && Math.min(dx, dz) > 0.35 * Math.max(dx, dz)) {
      openings.push({ ...base, side: null, alongM: null, widthM: r3(Math.hypot(dx, dz)) })
      continue
    }
    const alongX = dx >= dz
    // how far the way is free in front of the hole, in the two directions across its wall
    const free = (dir: 1 | -1): number => {
      let d = Infinity
      for (const [wid, w] of wallBoxes) {
        if (alongX) {
          if (cx < w.x0 || cx > w.x1 || cy < w.y0 || cy > w.y1) continue
          const ahead = dir > 0 ? w.z0 - b.z1 : b.z0 - w.z1
          if (ahead > 0.25) d = Math.min(d, ahead)
        } else {
          if (cz < w.z0 || cz > w.z1 || cy < w.y0 || cy > w.y1) continue
          const ahead = dir > 0 ? w.x0 - b.x1 : b.x0 - w.x1
          if (ahead > 0.25) d = Math.min(d, ahead)
        }
        void wid
      }
      return d
    }
    const plus = free(1)
    const minus = free(-1)
    const out = plus === minus ? ((alongX ? cz - (walls.z0 + walls.z1) / 2 : cx - (walls.x0 + walls.x1) / 2) >= 0 ? 1 : -1) : plus > minus ? 1 : -1
    const side: SceneSide = alongX ? (out > 0 ? 'REAR' : 'FRONT') : out > 0 ? 'RIGHT' : 'LEFT'
    const alongM = side === 'FRONT' ? b.x0 - walls.x0 : side === 'REAR' ? walls.x1 - b.x1 : side === 'LEFT' ? walls.z1 - b.z1 : b.z0 - walls.z0
    openings.push({ ...base, side, alongM: r3(alongM), widthM: r3(alongX ? dx : dz) })
  }
  openings.sort((p, q) => (p.side ?? 'Z').localeCompare(q.side ?? 'Z') || (p.alongM ?? 0) - (q.alongM ?? 0) || p.bottomY - q.bottomY || p.id.localeCompare(q.id))
  const terrain = geometry?.terrainY.value
  return {
    exteriorWalls: walls ? { ...walls, widthM: r3(walls.x1 - walls.x0), depthM: r3(walls.z1 - walls.z0) } : null,
    roofTopY: roofs ? roofs.y1 : null,
    roofTopByBody,
    buildingTopY: all ? all.y1 : null,
    heightAboveTerrainM: roofs && terrain !== undefined && terrain !== null ? r3(roofs.y1 - terrain) : null,
    counts: { windows: count(/^window\|/i), doors: count(/^door\|/i), roofPlanes: count(/^roofPlane\|/i), walls: count(/^wall\|/i), meshes: bundle.scene.meshes.length },
    objects,
    openings,
  }
}
