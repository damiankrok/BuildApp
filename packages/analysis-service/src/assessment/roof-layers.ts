/**
 * N9-01 (B), relation R1: a roof standing inside another roof.
 *
 * Measured on the COMPILED geometry of the delivered model, over a plan grid: at each cell a vertical ray is cast and
 * every roof plate it meets is recorded with its top and underside (a plate is one compiled roof solid: a `Roof` or a
 * `RoofPlane`, never its trim). Two plates over one point are NOT a conflict by themselves — a porch roof under the
 * eaves, a garage under an overhang, a lower wing, a dormer's roof over its host are all legal. A cell is a conflict
 * only when all of these hold:
 *
 *   - the lower plate lies wholly under the upper one there (a vertical gap of more than `GAP_TOLERANCE_M`);
 *   - the cell is inside the walled storey the upper plate covers (its slabs and exterior wall bands, inset by the
 *     edge tolerance), so the lower plate is inside that building's volume and not under an overhang;
 *   - the lower plate's top stands above that storey's floor, so it is inside the storey's air volume and not
 *     under its floor;
 *   - the same holds at the four cells `EDGE_TOLERANCE_M` around it, so a shared eave, a valley or a step between two
 *     plates is not taken for an overlap by the grid.
 *
 * A double layer outside the upper plate's walls is recorded as LAYERED (legal). A double layer the rules cannot place
 * — inside the walls but under the storey's floor, or over a storey with no slab and no exterior wall — makes the
 * relation UNCHECKED with that reason, never CONFLICT. The relation knows no house: only plates, slabs, walls, levels.
 */
import { round6 } from '@buildapp/source-common'
import type { CanonicalBuildingModel } from '@buildapp/model'
import type { CompiledScene, Triangle } from '@buildapp/geometry'
import { combineStatus, countStatuses } from './types.js'
import type { RelationItem, RelationResult } from './types.js'
import { bandQuad, pointInPolygon } from './plan-geometry.js'

/** The plan grid the rays are cast on, metres. */
export const ROOF_GRID_M = 0.1
/** Two sampling steps: a shared edge or a crease is not an overlap. */
export const EDGE_TOLERANCE_M = 2 * ROOF_GRID_M
/** Plates whose surfaces meet within this vertical distance touch rather than stack. */
export const GAP_TOLERANCE_M = 0.05

type Plate = { id: string; levelId?: string; tris: Array<Triangle & { x0: number; x1: number; z0: number; z1: number }> }

function verticalHits(t: Triangle, x: number, z: number): number | undefined {
  // barycentric in plan, then the plane's y at (x, z)
  const d = (t.b.x - t.a.x) * (t.c.z - t.a.z) - (t.c.x - t.a.x) * (t.b.z - t.a.z)
  if (Math.abs(d) < 1e-12) return undefined
  const u = ((x - t.a.x) * (t.c.z - t.a.z) - (t.c.x - t.a.x) * (z - t.a.z)) / d
  const v = ((t.b.x - t.a.x) * (z - t.a.z) - (x - t.a.x) * (t.b.z - t.a.z)) / d
  if (u < 0 || v < 0 || u + v > 1) return undefined
  return t.a.y + u * (t.b.y - t.a.y) + v * (t.c.y - t.a.y)
}

/** Top and underside of one plate over a point, or undefined when the ray misses it. */
function span(p: Plate, x: number, z: number): { top: number; bottom: number } | undefined {
  let top = -Infinity
  let bottom = Infinity
  for (const t of p.tris) {
    if (x < t.x0 || x > t.x1 || z < t.z0 || z > t.z1) continue
    const y = verticalHits(t, x, z)
    if (y === undefined) continue
    if (y > top) top = y
    if (y < bottom) bottom = y
  }
  return top === -Infinity ? undefined : { top, bottom }
}

/** Is the point inside the walled storey of a level: on one of its slabs or exterior wall bands, `inset` in from every edge. */
function storeyFootprint(model: CanonicalBuildingModel, levelId: string): ((x: number, z: number, inset: number) => boolean) | undefined {
  const polys = [
    ...model.slabs.filter((s) => s.levelId === levelId).map((s) => s.polygon),
    ...model.walls.filter((w) => w.levelId === levelId && w.kind === 'EXTERIOR').map((w) => bandQuad(w)),
  ]
  if (polys.length === 0) return undefined
  const inside = (x: number, z: number): boolean => polys.some((p) => pointInPolygon(p, x, z))
  return (x, z, inset) => inside(x, z) && inside(x + inset, z) && inside(x - inset, z) && inside(x, z + inset) && inside(x, z - inset)
}

/** How a grid cell was classed, for a diagnostic board; the relation itself never needs it. */
export type RoofCellClass = 'ONE_LAYER' | 'NEAR_EDGE' | 'LAYERED' | 'UNDECIDED' | 'CONFLICT'

export function roofLayersRelation(model: CanonicalBuildingModel, scene: Pick<CompiledScene, 'meshes'>, options: { onCell?: (x: number, z: number, cls: RoofCellClass) => void } = {}): RelationResult {
  const limits = [
    'compiled roof solids only: a roof the model does not build is not seen, and a roof drawn on the sheets but missing from the model is not R1’s question',
    `grid ${ROOF_GRID_M} m; overlaps within ${EDGE_TOLERANCE_M} m of a plate edge are not counted`,
  ]
  const plates = new Map<string, Plate>()
  for (const m of scene.meshes) {
    if (m.part !== 'ROOF' && m.part !== 'ROOF_PLANE') continue
    const p = plates.get(m.solidId) ?? { id: m.solidId, ...(m.levelId ? { levelId: m.levelId } : {}), tris: [] }
    for (const t of m.triangles) p.tris.push({ ...t, x0: Math.min(t.a.x, t.b.x, t.c.x), x1: Math.max(t.a.x, t.b.x, t.c.x), z0: Math.min(t.a.z, t.b.z, t.c.z), z1: Math.max(t.a.z, t.b.z, t.c.z) })
    plates.set(m.solidId, p)
  }
  const result = (items: RelationItem[]): RelationResult => ({ id: 'R1_ROOF_LAYERS', title: 'one roof layer inside each walled storey', direction: 'MODEL_INTERNAL', status: combineStatus(items), counts: countStatuses(items), items, limits })
  if (plates.size === 0) return result([{ status: 'UNCHECKED', objects: [], source: null, measured: { plates: 0 }, tolerance: {}, coverage: {}, code: 'NO_ROOF', why: 'the model builds no roof: nothing to compare', evidence: [] }])
  const list = [...plates.values()].sort((a, b) => (a.id < b.id ? -1 : 1))
  const box = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity }
  for (const p of list) for (const t of p.tris) {
    box.x0 = Math.min(box.x0, t.x0)
    box.x1 = Math.max(box.x1, t.x1)
    box.z0 = Math.min(box.z0, t.z0)
    box.z1 = Math.max(box.z1, t.z1)
  }
  const levels = new Map(model.levels.map((l) => [l.id, l]))
  const footprints = new Map<string, ReturnType<typeof storeyFootprint>>()
  const footprintOf = (levelId: string): ReturnType<typeof storeyFootprint> => {
    if (!footprints.has(levelId)) footprints.set(levelId, storeyFootprint(model, levelId))
    return footprints.get(levelId)
  }
  type Pair = { upper: string; lower: string; raw: number; conflict: number; layered: number; undecided: number; undecidedWhy: Set<string>; maxGapM: number }
  const pairs = new Map<string, Pair>()
  const cellArea = ROOF_GRID_M * ROOF_GRID_M
  const e = EDGE_TOLERANCE_M
  for (let x = box.x0 + ROOF_GRID_M / 2; x < box.x1; x += ROOF_GRID_M) {
    for (let z = box.z0 + ROOF_GRID_M / 2; z < box.z1; z += ROOF_GRID_M) {
      const over: Array<{ p: Plate; top: number; bottom: number }> = []
      for (const p of list) {
        const s = span(p, x, z)
        if (s) over.push({ p, ...s })
      }
      if (over.length < 2) {
        if (over.length === 1) options.onCell?.(x, z, 'ONE_LAYER')
        continue
      }
      over.sort((a, b) => b.top - a.top)
      let cls: RoofCellClass = 'NEAR_EDGE'
      const rank: Record<RoofCellClass, number> = { ONE_LAYER: 0, NEAR_EDGE: 1, LAYERED: 2, UNDECIDED: 3, CONFLICT: 4 }
      const mark = (c: RoofCellClass): void => {
        if (rank[c] > rank[cls]) cls = c
      }
      for (let i = 0; i < over.length; i += 1) {
        for (let j = i + 1; j < over.length; j += 1) {
          const A = over[i]
          const B = over[j]
          const key = `${A.p.id} over ${B.p.id}`
          const pair = pairs.get(key) ?? { upper: A.p.id, lower: B.p.id, raw: 0, conflict: 0, layered: 0, undecided: 0, undecidedWhy: new Set<string>(), maxGapM: 0 }
          pairs.set(key, pair)
          // every cell both plates cover, before any tolerance: the figure a plain ray count gives
          pair.raw += 1
          if (B.top > A.bottom - GAP_TOLERANCE_M) continue // touching or interpenetrating: the closure audit's question
          // the same two plates around the cell, so an edge or a crease is not an overlap
          const around = [[e, 0], [-e, 0], [0, e], [0, -e]].every(([dx, dz]) => {
            const a = span(A.p, x + dx, z + dz)
            const b = span(B.p, x + dx, z + dz)
            return !!a && !!b && b.top <= a.bottom - GAP_TOLERANCE_M
          })
          if (!around) continue
          const level = A.p.levelId ? levels.get(A.p.levelId) : undefined
          const inside = A.p.levelId ? footprintOf(A.p.levelId) : undefined
          if (!level || !inside) {
            pair.undecided += 1
            mark('UNDECIDED')
            pair.undecidedWhy.add(`the upper plate ${A.p.id} stands on ${A.p.levelId ? `level ${A.p.levelId}, which has no slab and no exterior wall` : 'no level'}: its walled storey is unknown`)
            continue
          }
          if (!inside(x, z, e)) {
            pair.layered += 1
            mark('LAYERED')
            continue
          }
          if (B.top <= level.elevation + GAP_TOLERANCE_M) {
            pair.undecided += 1
            mark('UNDECIDED')
            pair.undecidedWhy.add(`${B.p.id} lies inside the walls of ${level.id} but under its floor: whether that is a roof inside the storey below is not decidable from the roofs alone`)
            continue
          }
          pair.conflict += 1
          mark('CONFLICT')
          pair.maxGapM = Math.max(pair.maxGapM, A.bottom - B.top)
        }
      }
      options.onCell?.(x, z, cls)
    }
  }
  const items: RelationItem[] = []
  // pairs that overlap only within the edge tolerance (a shared edge, a crease, a strip narrower than two tolerances)
  // or within the gap tolerance are not weighed: their area is counted, not listed
  const edgeOnly = [...pairs.values()].filter((p) => p.conflict + p.undecided + p.layered === 0)
  for (const pair of [...pairs.values()].filter((p) => p.conflict + p.undecided + p.layered > 0).sort((a, b) => b.conflict - a.conflict || (a.upper + a.lower < b.upper + b.lower ? -1 : 1))) {
    const objects = [pair.upper, pair.lower]
    const level = levels.get(plates.get(pair.upper)?.levelId ?? '')
    if (pair.conflict > 0) {
      items.push({
        status: 'CONFLICT',
        objects,
        source: null,
        measured: { doubleRoofM2: round6(pair.conflict * cellArea), rawOverlapM2: round6(pair.raw * cellArea), maxGapM: round6(pair.maxGapM), layeredM2: round6(pair.layered * cellArea) },
        tolerance: { edgeM: e, gapM: GAP_TOLERANCE_M, gridM: ROOF_GRID_M },
        coverage: { storey: level?.id ?? '' },
        code: 'ROOF_INSIDE_ROOF',
        why: `${pair.lower} stands inside the walled storey ${level?.id ?? '?'} under ${pair.upper}, above that storey's floor, over ${round6(pair.conflict * cellArea)} m²: a roof inside the volume another roof covers`,
        evidence: ['compiled roof triangles of the delivered model', 'the storey footprint is its slabs and exterior wall bands', 'model-internal: no drawing is consulted'],
      })
    } else if (pair.undecided > 0) {
      items.push({ status: 'UNCHECKED', objects, source: null, measured: { undecidedM2: round6(pair.undecided * cellArea), rawOverlapM2: round6(pair.raw * cellArea), layeredM2: round6(pair.layered * cellArea) }, tolerance: { edgeM: e, gapM: GAP_TOLERANCE_M }, coverage: {}, code: 'LAYER_NOT_DECIDABLE', why: [...pair.undecidedWhy].join('; '), evidence: ['compiled roof triangles of the delivered model'] })
    } else {
      items.push({ status: 'PASS', objects, source: null, measured: { layeredM2: round6(pair.layered * cellArea), rawOverlapM2: round6(pair.raw * cellArea) }, tolerance: { edgeM: e, gapM: GAP_TOLERANCE_M }, coverage: {}, code: 'LAYERED_OUTSIDE_WALLS', why: `${pair.lower} lies under ${pair.upper} only outside the walls ${pair.upper} covers (an overhang over a lower roof): legal`, evidence: ['compiled roof triangles of the delivered model'] })
    }
  }
  if (items.length === 0) items.push({ status: 'PASS', objects: list.map((p) => p.id), source: null, measured: { plates: list.length, doubleRoofM2: 0, nearEdgeOverlapM2: round6(edgeOnly.reduce((a, p) => a + p.raw, 0) * cellArea) }, tolerance: { edgeM: e, gapM: GAP_TOLERANCE_M, gridM: ROOF_GRID_M }, coverage: {}, code: 'SINGLE_LAYER', why: `${list.length} roof plate${list.length === 1 ? '' : 's'}; no vertical ray meets two of them apart from their shared edges`, evidence: ['compiled roof triangles of the delivered model'] })
  return result(items)
}
