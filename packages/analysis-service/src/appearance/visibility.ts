/**
 * v3.54.13 — what a compiled scene shows from one side, cell by cell: an orthographic z-buffer of the scene's meshes
 * onto the facade plane (along the facade, up), each cell holding the mesh nearest the viewer. It says which surface a
 * point of an elevation lands on — the set-back wall behind a frame, the frame itself, a balustrade, the glass of an
 * opening — so a finish is given to the surface that is actually seen there, never to whatever wall stands behind it.
 */
import type { CompiledMesh, CompiledScene } from '@buildapp/geometry'

export type Facade = 'FRONT' | 'REAR' | 'EAST' | 'WEST'

/** The facade's axes in the model's world: `along` as the elevations read it, and depth growing away from the viewer. */
export function facadeAxes(facade: Facade): { along: (x: number, z: number) => number; depth: (x: number, z: number) => number; toViewer: { x: number; z: number } } {
  switch (facade) {
    case 'FRONT':
      return { along: (x) => x, depth: (_x, z) => z, toViewer: { x: 0, z: -1 } }
    case 'REAR':
      return { along: (x) => x, depth: (_x, z) => -z, toViewer: { x: 0, z: 1 } }
    case 'EAST':
      return { along: (_x, z) => z, depth: (x) => -x, toViewer: { x: 1, z: 0 } }
    case 'WEST':
      return { along: (_x, z) => z, depth: (x) => x, toViewer: { x: -1, z: 0 } }
  }
}

export type VisibilityMap = {
  facade: Facade
  /** Cell size in metres. */
  cellM: number
  /** Along and height of cell (0, 0)'s lower-left corner; cell (i, j) spans along a0 + i·cell, height y1 − (j+1)·cell (j down). */
  a0: number
  y1: number
  w: number
  h: number
  /** Index into `meshes` of the nearest mesh per cell, −1 where nothing is seen. */
  mesh: Int32Array
  meshes: CompiledMesh[]
}

/**
 * The parts that are never a surface a finish is seen on: rooms are inside, regions are what the consumer replaces, and
 * a balustrade's glass infill is seen through (the wall behind it is what carries the finish).
 */
const IGNORED = new Set(['ROOM_FLOOR', 'SURFACE_REGION', 'RAILING_INFILL'])

export function visibilityMap(scene: CompiledScene, facade: Facade, cellM = 0.02, options: { withRegions?: boolean } = {}): VisibilityMap {
  const ax = facadeAxes(facade)
  const meshes = scene.meshes.filter((m) => !IGNORED.has(m.part) || (options.withRegions === true && m.part === 'SURFACE_REGION'))
  let a0 = Infinity
  let a1 = -Infinity
  let y0 = Infinity
  let y1 = -Infinity
  for (const m of meshes) for (const t of m.triangles) for (const p of [t.a, t.b, t.c]) {
    const a = ax.along(p.x, p.z)
    a0 = Math.min(a0, a)
    a1 = Math.max(a1, a)
    y0 = Math.min(y0, p.y)
    y1 = Math.max(y1, p.y)
  }
  a0 -= cellM
  y1 += cellM
  const w = Math.max(1, Math.ceil((a1 - a0) / cellM) + 2)
  const h = Math.max(1, Math.ceil((y1 - y0) / cellM) + 2)
  const depth = new Float64Array(w * h).fill(Infinity)
  const mesh = new Int32Array(w * h).fill(-1)
  meshes.forEach((m, mi) => {
    for (const t of m.triangles) {
      const P = [t.a, t.b, t.c].map((p) => ({ u: (ax.along(p.x, p.z) - a0) / cellM, v: (y1 - p.y) / cellM, d: ax.depth(p.x, p.z) }))
      const den = (P[1].v - P[2].v) * (P[0].u - P[2].u) + (P[2].u - P[1].u) * (P[0].v - P[2].v)
      if (Math.abs(den) < 1e-12) continue // seen edge-on
      const iu0 = Math.max(0, Math.floor(Math.min(P[0].u, P[1].u, P[2].u)))
      const iu1 = Math.min(w - 1, Math.ceil(Math.max(P[0].u, P[1].u, P[2].u)))
      const iv0 = Math.max(0, Math.floor(Math.min(P[0].v, P[1].v, P[2].v)))
      const iv1 = Math.min(h - 1, Math.ceil(Math.max(P[0].v, P[1].v, P[2].v)))
      for (let j = iv0; j <= iv1; j++) {
        for (let i = iu0; i <= iu1; i++) {
          const u = i + 0.5
          const v = j + 0.5
          const l0 = ((P[1].v - P[2].v) * (u - P[2].u) + (P[2].u - P[1].u) * (v - P[2].v)) / den
          const l1 = ((P[2].v - P[0].v) * (u - P[2].u) + (P[0].u - P[2].u) * (v - P[2].v)) / den
          const l2 = 1 - l0 - l1
          if (l0 < -1e-9 || l1 < -1e-9 || l2 < -1e-9) continue
          const d = l0 * P[0].d + l1 * P[1].d + l2 * P[2].d
          const k = j * w + i
          // nearer wins; on a tie (coplanar faces) the earlier mesh stays: the order is the compiler's, deterministic
          if (d < depth[k] - 1e-6) {
            depth[k] = d
            mesh[k] = mi
          }
        }
      }
    }
  })
  return { facade, cellM, a0, y1, w, h, mesh, meshes }
}

/** Cell indices → elevation metres (along, up) of the cell's centre, and back. */
export const cellToElevation = (v: VisibilityMap, i: number, j: number): { along: number; y: number } => ({ along: v.a0 + (i + 0.5) * v.cellM, y: v.y1 - (j + 0.5) * v.cellM })
export const elevationToCell = (v: VisibilityMap, along: number, y: number): [number, number] => [(along - v.a0) / v.cellM, (v.y1 - y) / v.cellM]
