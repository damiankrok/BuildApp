/**
 * `buildapp.mobile-scene-bundle@1.0.0` — the derived asset a native mobile
 * viewer loads.
 *
 * This format is DERIVED DATA ONLY. The CanonicalBuildingModel stays the
 * source of truth and `@buildapp/geometry` stays the only compiler; a bundle
 * is a re-encoding of one `CompiledScene` plus the semantic metadata a small
 * mobile inspector needs. Nothing may be authored here, and nothing in it may
 * contradict the compiler — `packages/mobile-scene/test/parity.test.ts` proves
 * agreement triangle by triangle.
 *
 * It is versioned separately from the model schema on purpose: the mobile
 * asset layout may change without touching the CanonicalBuildingModel, and a
 * model schema bump must not silently change what a phone reads.
 */
import type { Bounds, CompileDiagnostic, GeometryPart, Triangle } from '@buildapp/geometry'
import type { EvidenceStatus, SemanticKind } from '@buildapp/model'

export const MOBILE_SCENE_BUNDLE_SCHEMA = 'buildapp.mobile-scene-bundle'
export const MOBILE_SCENE_BUNDLE_VERSION = '1.0.0'

/**
 * One `CompiledMesh`, with its triangles flattened.
 *
 * `positions` holds 9 numbers per triangle — ax, ay, az, bx, by, bz, cx, cy,
 * cz — in the compiler's own triangle order, in the compiler's own world
 * frame (x right, y up, z into the building), with the compiler's own
 * winding. The flattening is lossless and carries no transform: a renderer
 * that needs another frame applies ONE documented conversion of its own.
 */
export type MobileMesh = {
  objectId: string
  objectKind: SemanticKind
  part: GeometryPart
  levelId?: string
  solidId: string
  hostWallId?: string
  hostRoofId?: string
  openingId?: string
  structural: boolean
  materialId?: string
  triangleCount: number
  positions: number[]
}

/** A `CompiledScene` with every mesh in the flattened form. */
export type MobileScene = {
  modelId: string
  meshes: MobileMesh[]
  diagnostics: CompileDiagnostic[]
  bounds: Bounds | null
  stats: { triangleCount: number; meshCount: number; objectCount: number }
}

/** A relationship worth showing in the inspector, already resolved to a label. */
export type MobileRelation = {
  /** What the target is to this object: "level", "hosting wall", "opening", … */
  role: string
  targetId: string
  targetLabel: string
}

/**
 * One inspector row. Producing these here is what keeps the mobile viewer from
 * having to learn the CanonicalBuildingModel schema: Kotlin renders
 * `label: value` and knows nothing about walls, sills or pitches.
 */
export type MobileFact = { label: string; value: string }

export type MobileEvidence = {
  status: EvidenceStatus
  source?: string
  locator?: string
  interpretation?: string
  confidence?: number
  note?: string
}

export type MobileObjectMetadata = {
  id: string
  kind: SemanticKind
  /** User-facing name: the object's own `name`, else a derived one. */
  label: string
  /** User-facing kind, e.g. "Window", "Exterior wall". */
  kindLabel: string
  name?: string
  levelId?: string
  levelLabel?: string
  materialId?: string
  materialLabel?: string
  relations: MobileRelation[]
  facts: MobileFact[]
  evidence?: MobileEvidence
  /** Geometry parts this object owns in the scene, sorted, deduplicated. */
  parts: GeometryPart[]
  triangleCount: number
  /** World bounds of this object's own triangles. */
  bounds: Bounds | null
}

/**
 * A storey, so the viewer can order and filter by level without reading the
 * model. `index` is the model's own ordering (ground = 0, attic above,
 * basements negative); the viewer needs it to say "lowest storey" generically.
 */
export type MobileLevel = {
  id: string
  label: string
  index: number
  /** Finished floor elevation, world y. */
  elevation: number
  /** Nominal storey height. */
  height: number
}

export type MobileMaterialMetadata = {
  id: string
  name: string
  /** `#rrggbb` */
  color: string
  opacity?: number
  note?: string
}

export type MobileSceneBundle = {
  schema: typeof MOBILE_SCENE_BUNDLE_SCHEMA
  schemaVersion: typeof MOBILE_SCENE_BUNDLE_VERSION
  generatedFrom: {
    modelId: string
    modelName: string
    modelSchema: string
    modelSchemaVersion: string
    /** Hash of the canonical model JSON: which exact model this was built from. */
    modelContentHash: string
  }
  scene: MobileScene
  /** Storeys, ordered by `index`. */
  levels: MobileLevel[]
  objects: MobileObjectMetadata[]
  materials: MobileMaterialMetadata[]
  /** sha256 of the canonical JSON of this bundle with `contentHash` removed. */
  contentHash: string
}

/** Rebuild the compiler's `Triangle[]` from a flattened mesh. Lossless. */
export function trianglesOf(mesh: MobileMesh): Triangle[] {
  const out: Triangle[] = []
  const p = mesh.positions
  for (let i = 0; i + 8 < p.length; i += 9) {
    out.push({
      a: { x: p[i], y: p[i + 1], z: p[i + 2] },
      b: { x: p[i + 3], y: p[i + 4], z: p[i + 5] },
      c: { x: p[i + 6], y: p[i + 7], z: p[i + 8] },
    })
  }
  return out
}
