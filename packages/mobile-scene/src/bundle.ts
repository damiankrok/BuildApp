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
import { bundleStyling, semanticGroupOf, TONE_HINTABLE_GROUPS, toneOfColor, type ObjectFacts, type SemanticGroup, type ToneHints } from './semantics.js'
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
export function flattenMesh(mesh: CompiledMesh, semanticGroup: SemanticGroup): MobileMesh {
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
    semanticGroup,
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

/**
 * Each exterior wall's role in the facade (see `ObjectFacts.finish`).
 *
 * - MEMBER: an exterior wall that belongs to no wall ring, in a model that
 *   has rings — a return, a fin, a jamb standing out of a body's envelope
 *   to frame a recess. A body's envelope is its ring; what stands outside it
 *   frames it.
 * - PRIMARY: a ring wall carrying the building's dominant exterior finish,
 *   the material covering the largest ring-wall area (length × height,
 *   openings not subtracted: a finish is chosen for a wall, not for what is
 *   left of it).
 * - SECONDARY: a ring wall in any other finish — a garage in dark render
 *   beside a white house.
 * Nothing here reads a colour or a name. A model without rings has no
 * members; its walls are PRIMARY or SECONDARY by finish alone.
 */
export function wallFinishes(model: CanonicalBuildingModel): Map<string, NonNullable<ObjectFacts['finish']>> {
  const inRing = new Set(model.wallRings.flatMap((r) => r.wallIds))
  const hasRings = inRing.size > 0
  const exterior = model.walls.filter((w) => w.kind === 'EXTERIOR')
  const body = exterior.filter((w) => !hasRings || inRing.has(w.id))
  const area = new Map<string, number>()
  for (const w of body) {
    if (!w.materialId) continue
    const length = Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z)
    area.set(w.materialId, (area.get(w.materialId) ?? 0) + length * w.height)
  }
  const dominant = [...area].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0]
  const out = new Map<string, NonNullable<ObjectFacts['finish']>>()
  for (const w of exterior) {
    if (hasRings && !inRing.has(w.id)) out.set(w.id, 'MEMBER')
    else if (w.materialId === undefined || w.materialId === dominant) out.set(w.id, 'PRIMARY')
    else out.set(w.id, 'SECONDARY')
  }
  return out
}

/**
 * The facts `semanticGroupOf` may read about one object: its own `kind`
 * field where its schema has one, read off the model and nothing else. A
 * door has no kind, so its assembly is read as one word — PANEL when every
 * panel is a solid panel. Mass roles are not in the CanonicalBuildingModel,
 * so `massRole` is never set here; an exterior wall's `finish` is, from
 * `finishes` (see `wallFinishes`).
 */
export function objectFactsOf(model: CanonicalBuildingModel, objectId: string, finishes?: ReadonlyMap<string, NonNullable<ObjectFacts['finish']>>): ObjectFacts | undefined {
  const hit = findObject(model, objectId)
  if (!hit) return undefined
  const o = hit.object as unknown as Record<string, unknown>
  switch (hit.kind) {
    case 'wall': {
      const finish = finishes?.get(objectId)
      return finish ? { wallKind: String(o.kind), finish } : { wallKind: String(o.kind) }
    }
    case 'roof':
      return { roofKind: String(o.kind) }
    case 'balcony':
    case 'stair':
      return { kind: String(o.kind) }
    case 'railing':
      return { kind: String(o.infill) }
    case 'door': {
      const panels = (o.assembly as { panels?: { kind: string }[] } | undefined)?.panels ?? []
      return panels.length > 0 && panels.every((p) => p.kind === 'PANEL') ? { kind: 'PANEL' } : undefined
    }
    default:
      return undefined
  }
}

/** The compiled scene, re-encoded. Mesh order is the compiler's own. */
export function flattenScene(scene: CompiledScene, model: CanonicalBuildingModel): MobileScene {
  const materialName = new Map(model.materials.map((m) => [m.id, m.name]))
  const facts = new Map<string, ObjectFacts | undefined>()
  const finishes = wallFinishes(model)
  const factsOf = (objectId: string): ObjectFacts | undefined => {
    if (!facts.has(objectId)) facts.set(objectId, objectFactsOf(model, objectId, finishes))
    return facts.get(objectId)
  }
  return {
    modelId: scene.modelId,
    meshes: scene.meshes.map((mesh) =>
      flattenMesh(
        mesh,
        semanticGroupOf({
          objectKind: mesh.objectKind,
          part: mesh.part,
          materialId: mesh.materialId,
          materialName: mesh.materialId ? materialName.get(mesh.materialId) : undefined,
          objectFacts: factsOf(mesh.objectId),
        }),
      ),
    ),
    diagnostics: scene.diagnostics,
    bounds: scene.bounds,
    stats: scene.stats,
  }
}

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
  /**
   * Tone hints for the palette, per semantic group. When absent, they are
   * read off the model's own finishes (`toneHintsOf`): a reconstruction that
   * read a grey-rendered garage on the render gave its walls a grey render,
   * and the palette puts the secondary walls on its grey rung.
   */
  toneHints?: ToneHints
}

/**
 * Tone hints from the model's own finishes: for each hintable group, the
 * tone family of the material covering most of its triangles. The chain is
 * render → tone family (the reconstruction) → model material → tone family
 * → palette rung (here); no colour from a render reaches the screen.
 */
export function toneHintsOf(scene: MobileScene, model: CanonicalBuildingModel): ToneHints {
  const colorOf = new Map(model.materials.map((m) => [m.id, m.color]))
  const counts = new Map<SemanticGroup, Map<string, number>>()
  for (const mesh of scene.meshes) {
    if (!TONE_HINTABLE_GROUPS.includes(mesh.semanticGroup) || !mesh.materialId || !colorOf.has(mesh.materialId)) continue
    const c = counts.get(mesh.semanticGroup) ?? new Map<string, number>()
    c.set(mesh.materialId, (c.get(mesh.materialId) ?? 0) + mesh.triangleCount)
    counts.set(mesh.semanticGroup, c)
  }
  const hints: ToneHints = {}
  for (const group of TONE_HINTABLE_GROUPS) {
    const c = counts.get(group)
    if (!c) continue
    const [material] = [...c].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]
    hints[group] = toneOfColor(colorOf.get(material) as string)
  }
  return hints
}

/**
 * Build the bundle for a model. The model is compiled here on the real
 * production path; passing `scene` is only an optimisation and must be the
 * compilation of this same model.
 */
export function buildMobileSceneBundle(model: CanonicalBuildingModel, options: BuildBundleOptions = {}): MobileSceneBundle {
  const scene = options.scene ?? compileBuilding(model)
  const flat = flattenScene(scene, model)
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
    scene: flat,
    levels: levelMetadata(model),
    objects: objectMetadata(model, scene),
    materials: materialMetadata(model),
    styling: bundleStyling(options.toneHints ?? toneHintsOf(flat, model)),
    contentHash: '',
  }
  bundle.contentHash = bundleContentHash(bundle)
  return bundle
}
