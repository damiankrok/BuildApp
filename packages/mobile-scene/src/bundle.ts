/**
 * CanonicalBuildingModel -> MobileSceneBundle.
 *
 * The one job here is re-encoding, never authoring: geometry comes from
 * `compileBuilding` and nothing else, semantics come from the model, and the
 * bundle adds no fact the model did not already state. That is why the mobile
 * viewer can stay a viewer — there is no second kernel for it to disagree
 * with.
 */
import { compileBuilding, boundsOfTriangles, type Bounds, type CompiledMesh, type CompiledScene, type GeometryPart } from '@buildapp/geometry'
import { findObject, serializeModel, type CanonicalBuildingModel, type SemanticKind } from '@buildapp/model'
import { describeObject, kindLabel, labelOf, levelIdOf, materialIdOf } from './describe.js'
import { bundleContentHash, sha256 } from './serialize.js'
import {
  MOBILE_SCENE_BUNDLE_SCHEMA,
  MOBILE_SCENE_BUNDLE_VERSION,
  type MobileEvidence,
  type MobileMaterialMetadata,
  type MobileLevel,
  type MobileMesh,
  type MobileObjectMetadata,
  type MobileScene,
  type MobileSceneBundle,
} from './types.js'

const byId = <T extends { id: string }>(list: readonly T[]): T[] => [...list].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

/** Flatten one compiled mesh. No transform, no rounding: the same numbers. */
export function flattenMesh(mesh: CompiledMesh): MobileMesh {
  const positions = new Array<number>(mesh.triangles.length * 9)
  let i = 0
  for (const t of mesh.triangles) {
    positions[i++] = t.a.x
    positions[i++] = t.a.y
    positions[i++] = t.a.z
    positions[i++] = t.b.x
    positions[i++] = t.b.y
    positions[i++] = t.b.z
    positions[i++] = t.c.x
    positions[i++] = t.c.y
    positions[i++] = t.c.z
  }
  return {
    objectId: mesh.objectId,
    objectKind: mesh.objectKind,
    part: mesh.part,
    levelId: mesh.levelId,
    solidId: mesh.solidId,
    hostWallId: mesh.hostWallId,
    hostRoofId: mesh.hostRoofId,
    openingId: mesh.openingId,
    structural: mesh.structural,
    materialId: mesh.materialId,
    triangleCount: mesh.triangles.length,
    positions,
  }
}

/** The compiled scene, re-encoded. Mesh order is the compiler's own. */
export const flattenScene = (scene: CompiledScene): MobileScene => ({
  modelId: scene.modelId,
  meshes: scene.meshes.map(flattenMesh),
  diagnostics: scene.diagnostics,
  bounds: scene.bounds,
  stats: scene.stats,
})

/**
 * Metadata for every semantic object that owns geometry in the scene.
 *
 * Objects with no triangles are left out: the inspector only ever opens from a
 * pick, and a bundle that carried the whole model would be teaching the phone
 * the schema by the back door.
 */
function objectMetadata(model: CanonicalBuildingModel, scene: CompiledScene): MobileObjectMetadata[] {
  const geometry = new Map<string, { parts: Set<GeometryPart>; triangleCount: number; bounds: Bounds | null }>()
  for (const mesh of scene.meshes) {
    let entry = geometry.get(mesh.objectId)
    if (!entry) {
      entry = { parts: new Set(), triangleCount: 0, bounds: null }
      geometry.set(mesh.objectId, entry)
    }
    entry.parts.add(mesh.part)
    entry.triangleCount += mesh.triangles.length
    entry.bounds = boundsOfTriangles(mesh.triangles, entry.bounds ?? undefined)
  }

  const materialName = new Map(model.materials.map((m) => [m.id, m.name]))
  const levelName = new Map(model.levels.map((l) => [l.id, labelOf(model, l.id)]))

  const out: MobileObjectMetadata[] = []
  for (const [id, g] of geometry) {
    const hit = findObject(model, id)
    if (!hit) continue
    const kind: SemanticKind = hit.kind
    const object = hit.object
    const { relations, facts } = describeObject(model, kind, object)
    const levelId = levelIdOf(object) ?? meshLevelOf(scene, id)
    const materialId = materialIdOf(object)
    const evidence = (object as { evidence?: MobileEvidence }).evidence
    out.push({
      id,
      kind,
      label: labelOf(model, id),
      kindLabel: kindLabel(kind),
      name: (object as { name?: string }).name,
      levelId,
      levelLabel: levelId ? levelName.get(levelId) : undefined,
      materialId,
      materialLabel: materialId ? materialName.get(materialId) : undefined,
      relations,
      facts,
      evidence: evidence
        ? {
            status: evidence.status,
            source: evidence.source,
            locator: evidence.locator,
            interpretation: evidence.interpretation,
            confidence: evidence.confidence,
            note: evidence.note,
          }
        : undefined,
      parts: [...g.parts].sort(),
      triangleCount: g.triangleCount,
      bounds: g.bounds,
    })
  }
  return byId(out)
}

/**
 * The storey a geometry-owning object sits on when its own schema does not say
 * so (a window belongs to an opening, which belongs to a wall, which has the
 * level). The compiler already resolved that chain onto every mesh.
 */
function meshLevelOf(scene: CompiledScene, objectId: string): string | undefined {
  for (const mesh of scene.meshes) if (mesh.objectId === objectId && mesh.levelId) return mesh.levelId
  return undefined
}

/** Storeys in model order. Ordering is content: it decides "lowest storey". */
const levelMetadata = (model: CanonicalBuildingModel): MobileLevel[] =>
  [...model.levels]
    .sort((a, b) => (a.index !== b.index ? a.index - b.index : a.id < b.id ? -1 : 1))
    .map((l) => ({ id: l.id, label: labelOf(model, l.id), index: l.index, elevation: l.elevation, height: l.height }))

const materialMetadata = (model: CanonicalBuildingModel): MobileMaterialMetadata[] =>
  byId(model.materials).map((m) => ({ id: m.id, name: m.name, color: m.color, opacity: m.opacity, note: m.note }))

export type BuildBundleOptions = {
  /** A scene already compiled from this model, to avoid compiling twice. */
  scene?: CompiledScene
}

/**
 * Build the bundle for a model. The model is compiled here on the real
 * production path; passing `scene` is only an optimisation and must be the
 * compilation of this same model.
 */
export function buildMobileSceneBundle(model: CanonicalBuildingModel, options: BuildBundleOptions = {}): MobileSceneBundle {
  const scene = options.scene ?? compileBuilding(model)
  const bundle: MobileSceneBundle = {
    schema: MOBILE_SCENE_BUNDLE_SCHEMA,
    schemaVersion: MOBILE_SCENE_BUNDLE_VERSION,
    generatedFrom: {
      modelId: model.id,
      modelName: model.name,
      modelSchema: model.schema,
      modelSchemaVersion: model.schemaVersion,
      modelContentHash: sha256(serializeModel(model)),
    },
    scene: flattenScene(scene),
    levels: levelMetadata(model),
    objects: objectMetadata(model, scene),
    materials: materialMetadata(model),
    contentHash: '',
  }
  bundle.contentHash = bundleContentHash(bundle)
  return bundle
}
