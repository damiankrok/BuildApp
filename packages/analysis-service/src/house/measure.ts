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
  /** v3.54.7 — the characteristic features each side shows, measured on the triangles by one ruler for any model (`sideFeatures`). */
  sides: SideFeatures[]
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
  // v3.54.7: the second half of a pointed glazing (cut as two raked halves beside a mullion, `<id>--b`) is one opening with its first
  const holes = { ...objects }
  for (const [id, b] of Object.entries(objects)) {
    if (!id.endsWith('--b') || !(kinds.get(id) ?? '').startsWith('opening|')) continue
    const base = id.slice(0, -3)
    const a = holes[base]
    if (!a) continue
    holes[base] = { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), z0: Math.min(a.z0, b.z0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1), z1: Math.max(a.z1, b.z1) } as typeof a
    delete holes[id]
  }
  const openings: SceneOpening[] = []
  for (const [id, b] of Object.entries(holes)) {
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
    sides: walls ? sideFeatures(bundle, walls, openings) : [],
  }
}

/**
 * v3.54.7 — what a side shows of the features that make a house recognisable, measured on the compiled triangles
 * alone (no id, no role of the program that built it), so that LOCAL and the described house are held against the same
 * elevation by the same ruler (D41):
 *   - a gable frame: trim (`ROOF_TRIM`) that RISES (a rake, not an eaves fascia) and stands within `FEATURE_RULER.frameBandM`
 *     of that side's outer plane;
 *   - balconies: how far each slab stands out of the side's outer plane (≤ `recessedM` = in a recess: a loggia) and how
 *     many free supports (structural members from the ground) stand under it;
 *   - openings whose head is not level: the top of the hole at its two jambs differs by more than `rakedM`.
 * Along a side is measured as for openings: from the left end of the walls as a viewer outside sees them.
 */
export type SideFeatures = {
  side: SceneSide
  frame: { pieces: number; alongFrom: number; alongTo: number; bottomY: number; topY: number; depthM: number } | null
  balconies: Array<{ id: string; alongFrom: number; alongTo: number; projectsM: number; recessed: boolean; posts: number }>
  shapedOpenings: Array<{ id: string; alongFrom: number; alongTo: number; leftTopY: number; rightTopY: number; peakY: number }>
}
export const FEATURE_RULER = { frameBandM: 1.6, frameRiseM: 1.0, recessedM: 0.15, rakedM: 0.25, postNearM: 0.4 } as const

type MeshLike = { objectId?: string; objectKind?: string; semanticGroup?: string; positions: number[] }
export function sideFeatures(bundle: MobileSceneBundle, W: Bounds, openings: readonly SceneOpening[]): SideFeatures[] {
  const meshes = bundle.scene.meshes as unknown as MeshLike[]
  const boxOf = (ps: number[]): Bounds => {
    const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity }
    for (let i = 0; i + 2 < ps.length; i += 3) {
      b.x0 = Math.min(b.x0, ps[i])
      b.x1 = Math.max(b.x1, ps[i])
      b.y0 = Math.min(b.y0, ps[i + 1])
      b.y1 = Math.max(b.y1, ps[i + 1])
      b.z0 = Math.min(b.z0, ps[i + 2])
      b.z1 = Math.max(b.z1, ps[i + 2])
    }
    return b
  }
  const SIDES: SceneSide[] = ['FRONT', 'RIGHT', 'REAR', 'LEFT']
  // along the side (from its left end seen from outside), and how far out of its outer plane (positive = outside)
  const along = (side: SceneSide, x: number, z: number): number => (side === 'FRONT' ? x - W.x0 : side === 'REAR' ? W.x1 - x : side === 'LEFT' ? W.z1 - z : z - W.z0)
  const outOf = (side: SceneSide, b: Bounds): { near: number; far: number } =>
    side === 'FRONT' ? { near: W.z0 - b.z1, far: W.z0 - b.z0 } : side === 'REAR' ? { near: b.z0 - W.z1, far: b.z1 - W.z1 } : side === 'LEFT' ? { near: W.x0 - b.x1, far: W.x0 - b.x0 } : { near: b.x0 - W.x1, far: b.x1 - W.x1 }
  const span = (side: SceneSide, b: Bounds): [number, number] => {
    const a = [along(side, b.x0, b.z0), along(side, b.x1, b.z1)].sort((p, q) => p - q)
    return [r3(a[0]), r3(a[1])]
  }
  const trims = meshes.filter((m) => m.semanticGroup === 'ROOF_TRIM').map((m) => boxOf(m.positions))
  const balconies = new Map<string, Bounds>()
  for (const m of meshes) {
    if (m.objectKind !== 'balcony' || !m.objectId) continue
    const b = boxOf(m.positions)
    const a = balconies.get(m.objectId)
    balconies.set(m.objectId, a ? { x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1), y0: Math.min(a.y0, b.y0), y1: Math.max(a.y1, b.y1), z0: Math.min(a.z0, b.z0), z1: Math.max(a.z1, b.z1) } : b)
  }
  const members = meshes.filter((m) => m.semanticGroup === 'STRUCTURAL_MEMBER' || m.objectKind === 'column').map((m) => boxOf(m.positions))
  const holeMeshes = new Map<string, number[]>()
  // the second half of a pointed glazing (`<id>--b`) is one hole with its first, as `measureScene` counts it
  for (const m of meshes) if (m.objectKind === 'opening' && m.objectId) {
    const id = m.objectId.endsWith('--b') ? m.objectId.slice(0, -3) : m.objectId
    holeMeshes.set(id, [...(holeMeshes.get(id) ?? []), ...m.positions])
  }
  return SIDES.map((side) => {
    const alongX = side === 'FRONT' || side === 'REAR'
    // a frame: rising trim close to this side's outer plane, lying across the side (not along a rake of another side)
    const mine = trims.filter((b) => {
      const o = outOf(side, b)
      const across = alongX ? b.x1 - b.x0 : b.z1 - b.z0
      const deep = alongX ? b.z1 - b.z0 : b.x1 - b.x0
      return b.y1 - b.y0 >= FEATURE_RULER.frameRiseM && o.far >= -FEATURE_RULER.frameBandM && o.near <= 0.6 && across > deep
    })
    const frame = mine.length
      ? (() => {
          const ss = mine.map((b) => span(side, b))
          return { pieces: mine.length, alongFrom: Math.min(...ss.map((x) => x[0])), alongTo: Math.max(...ss.map((x) => x[1])), bottomY: r3(Math.min(...mine.map((b) => b.y0))), topY: r3(Math.max(...mine.map((b) => b.y1))), depthM: r3(Math.max(...mine.map((b) => (alongX ? b.z1 - b.z0 : b.x1 - b.x0)))) }
        })()
      : null
    const bal: SideFeatures['balconies'] = []
    for (const [id, b] of balconies) {
      const o = outOf(side, b)
      const deep = alongX ? b.z1 - b.z0 : b.x1 - b.x0
      // a balcony belongs to the side whose outer plane it reaches (within its own depth)
      if (o.far < -0.05 || o.far > deep + 3 || o.near < -deep - 0.05) continue
      const other = SIDES.filter((x) => x !== side).some((x) => outOf(x, b).far > o.far + 0.05)
      if (other) continue
      const [a0, a1] = span(side, b)
      const posts = members.filter((m) => {
        const [p0, p1] = span(side, m)
        return m.y0 <= 0.2 && m.y1 >= b.y0 - 0.3 && p1 >= a0 - FEATURE_RULER.postNearM && p0 <= a1 + FEATURE_RULER.postNearM && outOf(side, m).far > -0.05 && outOf(side, m).near <= Math.max(0, o.far) + FEATURE_RULER.postNearM
      }).length
      bal.push({ id, alongFrom: a0, alongTo: a1, projectsM: r3(Math.max(0, o.far)), recessed: o.far <= FEATURE_RULER.recessedM, posts })
    }
    const shaped: SideFeatures['shapedOpenings'] = []
    for (const op of openings.filter((x) => x.side === side && x.alongM !== null)) {
      const ps = holeMeshes.get(op.id)
      if (!ps) continue
      const a0 = op.alongM as number
      const a1 = a0 + op.widthM
      const tol = Math.max(0.05, op.widthM * 0.08)
      let left = -Infinity
      let right = -Infinity
      for (let i = 0; i + 2 < ps.length; i += 3) {
        const a = along(side, ps[i], ps[i + 2])
        if (a <= a0 + tol) left = Math.max(left, ps[i + 1])
        if (a >= a1 - tol) right = Math.max(right, ps[i + 1])
      }
      const peak = op.topY
      if (Number.isFinite(left) && Number.isFinite(right) && (Math.abs(left - right) > FEATURE_RULER.rakedM || peak - Math.max(left, right) > FEATURE_RULER.rakedM)) shaped.push({ id: op.id, alongFrom: r3(a0), alongTo: r3(a1), leftTopY: r3(left), rightTopY: r3(right), peakY: r3(peak) })
    }
    void alongX
    return { side, frame, balconies: bal.sort((p, q) => p.alongFrom - q.alongFrom), shapedOpenings: shaped }
  })
}
