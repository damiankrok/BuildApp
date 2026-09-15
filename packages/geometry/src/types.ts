/**
 * Output contract of the geometry compiler.
 *
 * Every triangle the viewer ever draws is inside a `CompiledMesh`, and every
 * mesh names the semantic object it belongs to. That is the trace from
 * rendered geometry back to the CanonicalBuildingModel: a picked mesh resolves
 * to `objectId` without parsing any name.
 *
 * Coordinates are the model's world frame (x right, y up, z into the
 * building). Triangles are wound so that `(b - a) x (c - a)` points out of the
 * material; a renderer working in a right-handed frame mirrors z and swaps b/c.
 */
import type { SemanticKind } from '@buildapp/model'

export type Vec3 = { x: number; y: number; z: number }
export type Triangle = { a: Vec3; b: Vec3; c: Vec3 }

export type GeometryPart =
  | 'WALL'
  | 'WALL_REVEAL'
  | 'WINDOW_FRAME'
  | 'WINDOW_GLASS'
  | 'WINDOW_MULLION'
  | 'DOOR_FRAME'
  | 'DOOR_LEAF'
  | 'DOOR_HANDLE'
  | 'SLAB'
  | 'ROOF'
  | 'ROOF_REVEAL'
  | 'ROOFLIGHT_FRAME'
  | 'ROOFLIGHT_GLASS'
  | 'BALCONY'
  | 'RAILING_POST'
  | 'RAILING_RAIL'
  | 'RAILING_INFILL'
  | 'CHIMNEY'
  | 'ROOM_FLOOR'
  | 'STAIR_PLACEHOLDER'

export type CompiledMesh = {
  /** The semantic object this geometry belongs to; what selection resolves to. */
  objectId: string
  objectKind: SemanticKind
  part: GeometryPart
  /** The level the object stands on, for storey isolation. */
  levelId?: string
  /**
   * The closed solid these triangles are part of. Wall faces and the reveals
   * lining that wall's openings share the wall's id here, so `solidId` groups
   * exactly the triangles a closed-surface oracle should see together.
   */
  solidId: string
  /** For reveals and fills: the wall that hosts the opening (for a multi-leaf opening, the leaf this reveal lines). */
  hostWallId?: string
  /** For roof reveals and rooflight fills: the roof that hosts the roof opening. */
  hostRoofId?: string
  /** For reveals and fills: the opening (a wall opening or a roof opening). */
  openingId?: string
  /** Structural solids take part in duplicate-volume checks; markers and glazing do not. */
  structural: boolean
  materialId?: string
  triangles: Triangle[]
}

export type CompileDiagnosticCode =
  | 'MODEL_INVALID'
  | 'UNKNOWN_LEVEL'
  | 'WALL_TOP_BELOW_BASE'
  | 'WALL_CONSUMED'
  | 'WALL_NOT_UNDER_ROOF'
  | 'OPENING_ABOVE_WALL_TOP'
  | 'OPENING_NOT_CUT'
  | 'FILL_WITHOUT_OPENING'
  | 'POLYGON_NOT_TRIANGULATED'
  | 'ROOF_OPENING_NOT_CUT'

export type CompileDiagnostic = {
  code: CompileDiagnosticCode
  severity: 'ERROR' | 'WARNING'
  message: string
  objectId?: string
}

export type Bounds = { min: Vec3; max: Vec3 }

export type CompiledScene = {
  modelId: string
  meshes: CompiledMesh[]
  diagnostics: CompileDiagnostic[]
  bounds: Bounds | null
  stats: { triangleCount: number; meshCount: number; objectCount: number }
}

export const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z })
export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
export const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })
export const scale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s })
export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z
export const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x })
export const length = (a: Vec3): number => Math.hypot(a.x, a.y, a.z)
export const normalize = (a: Vec3): Vec3 => {
  const l = length(a)
  return l > 0 ? scale(a, 1 / l) : a
}

/** Formula normal `(b - a) x (c - a)` of a triangle, not normalised. */
export const triangleNormal = (t: Triangle): Vec3 => cross(sub(t.b, t.a), sub(t.c, t.a))

export function boundsOfTriangles(tris: readonly Triangle[], into?: Bounds): Bounds | null {
  let b = into ?? null
  for (const t of tris) {
    for (const p of [t.a, t.b, t.c]) {
      if (!b) b = { min: { ...p }, max: { ...p } }
      else {
        b.min.x = Math.min(b.min.x, p.x)
        b.min.y = Math.min(b.min.y, p.y)
        b.min.z = Math.min(b.min.z, p.z)
        b.max.x = Math.max(b.max.x, p.x)
        b.max.y = Math.max(b.max.y, p.y)
        b.max.z = Math.max(b.max.z, p.z)
      }
    }
  }
  return b
}
