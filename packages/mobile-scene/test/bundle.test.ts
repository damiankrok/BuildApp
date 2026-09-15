/**
 * The bundle is derived data with a content address. These tests hold that
 * line: the same model always produces the same bytes, the hash actually
 * covers the content, and a damaged asset is reported rather than loaded.
 */
import { describe, expect, it } from 'vitest'
import { createDemoBuilding } from '@buildapp/demo'
import { createMarcowkiReferenceBuilding } from '@buildapp/reference-marcowki'
import { compileBuilding } from '@buildapp/geometry'
import { OBJECT_COLLECTIONS, type CanonicalBuildingModel } from '@buildapp/model'
import { buildMobileSceneBundle, bundleContentHash, loadBundle, serializeBundle, trianglesOf } from '../src/index.js'

const demo = createDemoBuilding()
const marcowki = createMarcowkiReferenceBuilding()

/** The same model with every collection in the opposite order. */
function reversedCollections(model: CanonicalBuildingModel): CanonicalBuildingModel {
  const out = { ...model } as unknown as Record<string, unknown>
  for (const c of OBJECT_COLLECTIONS) out[c] = [...(model[c] as readonly unknown[])].reverse()
  return out as unknown as CanonicalBuildingModel
}

describe('mobile scene bundle', () => {
  it('states its own schema and the model it came from', () => {
    const bundle = buildMobileSceneBundle(marcowki)
    expect(bundle.schema).toBe('buildapp.mobile-scene-bundle')
    expect(bundle.schemaVersion).toBe('1.0.0')
    expect(bundle.generatedFrom.modelId).toBe(marcowki.id)
    expect(bundle.generatedFrom.modelSchemaVersion).toBe('1.3.0')
    expect(bundle.generatedFrom.modelContentHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('serializes byte for byte the same on a rebuild', () => {
    for (const build of [createDemoBuilding, createMarcowkiReferenceBuilding]) {
      const a = serializeBundle(buildMobileSceneBundle(build()))
      const b = serializeBundle(buildMobileSceneBundle(build()))
      expect(a).toBe(b)
    }
  })

  it('hashes the same whatever order the model collections are in', () => {
    for (const model of [demo, marcowki]) {
      expect(buildMobileSceneBundle(reversedCollections(model)).contentHash).toBe(buildMobileSceneBundle(model).contentHash)
    }
  })

  it('hashes the same whatever order the scenes are exported in', () => {
    const forwards = [buildMobileSceneBundle(demo).contentHash, buildMobileSceneBundle(marcowki).contentHash]
    const backwards = [buildMobileSceneBundle(marcowki).contentHash, buildMobileSceneBundle(demo).contentHash].reverse()
    expect(forwards).toEqual(backwards)
  })

  it('gives different models different hashes', () => {
    expect(buildMobileSceneBundle(demo).contentHash).not.toBe(buildMobileSceneBundle(marcowki).contentHash)
  })

  it('covers the content: moving one coordinate changes the hash', () => {
    const bundle = buildMobileSceneBundle(demo)
    expect(bundleContentHash(bundle)).toBe(bundle.contentHash)
    const tampered = structuredClone(bundle)
    tampered.scene.meshes[0].positions[0] += 0.001
    expect(bundleContentHash(tampered)).not.toBe(tampered.contentHash)
  })

  it('covers the metadata too: renaming an object changes the hash', () => {
    const bundle = buildMobileSceneBundle(demo)
    const tampered = structuredClone(bundle)
    tampered.objects[0].label = `${tampered.objects[0].label} (edited)`
    expect(bundleContentHash(tampered)).not.toBe(tampered.contentHash)
  })

  it('round-trips through the asset text', () => {
    const bundle = buildMobileSceneBundle(marcowki)
    const loaded = loadBundle(serializeBundle(bundle))
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.bundle.contentHash).toBe(bundle.contentHash)
    expect(loaded.bundle.scene.stats).toEqual(bundle.scene.stats)
  })

  it('reports a corrupt asset instead of loading it', () => {
    const text = serializeBundle(buildMobileSceneBundle(demo))

    const notJson = loadBundle('{ this is not json')
    expect(notJson).toMatchObject({ ok: false })
    expect(notJson.ok === false && notJson.error).toMatch(/not JSON/)

    const truncated = loadBundle(text.slice(0, Math.floor(text.length / 2)))
    expect(truncated.ok).toBe(false)

    const wrongSchema = loadBundle(JSON.stringify({ ...JSON.parse(text), schema: 'something.else' }))
    expect(wrongSchema.ok === false && wrongSchema.error).toMatch(/unknown schema/)

    const wrongVersion = loadBundle(JSON.stringify({ ...JSON.parse(text), schemaVersion: '9.9.9' }))
    expect(wrongVersion.ok === false && wrongVersion.error).toMatch(/unsupported bundle version/)

    const damaged = JSON.parse(text) as ReturnType<typeof buildMobileSceneBundle>
    damaged.scene.meshes[3].positions[2] += 0.5
    const hashMismatch = loadBundle(JSON.stringify(damaged))
    expect(hashMismatch.ok === false && hashMismatch.error).toMatch(/content hash mismatch/)

    const noMeshes = loadBundle(JSON.stringify({ ...JSON.parse(text), scene: {} }))
    expect(noMeshes.ok === false && noMeshes.error).toMatch(/no scene meshes/)
  })

  it('flattens triangles losslessly, nine numbers each', () => {
    const scene = compileBuilding(marcowki)
    const bundle = buildMobileSceneBundle(marcowki, { scene })
    for (let i = 0; i < scene.meshes.length; i++) {
      const mesh = bundle.scene.meshes[i]
      expect(mesh.positions.length).toBe(mesh.triangleCount * 9)
      expect(trianglesOf(mesh)).toEqual(scene.meshes[i].triangles)
    }
  })
})

describe('mobile object metadata', () => {
  const bundle = buildMobileSceneBundle(marcowki)
  const byId = new Map(bundle.objects.map((o) => [o.id, o]))

  it('describes every object that owns geometry, and only those', () => {
    const drawn = new Set(bundle.scene.meshes.map((m) => m.objectId))
    expect(new Set(bundle.objects.map((o) => o.id))).toEqual(drawn)
    expect(bundle.objects.length).toBe(bundle.scene.stats.objectCount)
  })

  it('is sorted by id, so the asset does not depend on discovery order', () => {
    expect(bundle.objects.map((o) => o.id)).toEqual([...bundle.objects.map((o) => o.id)].sort())
    expect(bundle.materials.map((m) => m.id)).toEqual([...bundle.materials.map((m) => m.id)].sort())
  })

  it('gives a window the inspector rows a phone needs, without the schema', () => {
    const window = bundle.objects.find((o) => o.kind === 'window')
    expect(window).toBeDefined()
    if (!window) return
    expect(window.kindLabel).toBe('Window')
    expect(window.label.length).toBeGreaterThan(0)
    expect(window.levelId).toBeDefined()
    expect(window.parts).toContain('WINDOW_GLASS')
    expect(window.parts).toContain('WINDOW_FRAME')
    expect(window.relations.map((r) => r.role)).toContain('hosting wall')
    const labels = window.facts.map((f) => f.label)
    expect(labels).toContain('Opening size')
    expect(labels).toContain('Sill')
    for (const f of window.facts) expect(f.value).not.toBe('')
  })

  it('gives the staircase its real flight facts', () => {
    const stair = bundle.objects.find((o) => o.kind === 'stair')
    expect(stair).toBeDefined()
    if (!stair) return
    expect(stair.parts).toContain('STAIR_STEP')
    const facts = new Map(stair.facts.map((f) => [f.label, f.value]))
    expect(facts.get('Type')).toBe('Real flights')
    expect(Number(facts.get('Risers'))).toBeGreaterThan(1)
    expect(facts.get('Riser height')).toMatch(/ m$/)
    expect(stair.relations.map((r) => r.role)).toContain('arrives at storey')
  })

  it('carries level, material and bounds for a wall', () => {
    const wall = bundle.objects.find((o) => o.kind === 'wall')
    expect(wall).toBeDefined()
    if (!wall) return
    expect(wall.levelLabel).toBeDefined()
    expect(wall.bounds).not.toBeNull()
    expect(wall.triangleCount).toBeGreaterThan(0)
    const facts = new Map(wall.facts.map((f) => [f.label, f.value]))
    expect(facts.get('Thickness')).toMatch(/ m$/)
    expect(facts.get('Length')).toMatch(/ m$/)
  })

  it('resolves the storey of objects whose own schema has none', () => {
    for (const kind of ['window', 'door', 'rooflight'] as const) {
      const object = bundle.objects.find((o) => o.kind === kind)
      if (!object) continue
      expect(object.levelId, `${kind} should inherit a storey from its host`).toBeDefined()
      expect(object.levelLabel).toBeDefined()
    }
  })

  it('keeps evidence where the model carries it', () => {
    const withEvidence = bundle.objects.filter((o) => o.evidence)
    expect(withEvidence.length).toBeGreaterThan(0)
    for (const o of withEvidence) expect(typeof o.evidence?.status).toBe('string')
  })

  it('lists the storeys in model order, so the viewer can filter generically', () => {
    expect(bundle.levels.map((l) => l.index)).toEqual([...bundle.levels.map((l) => l.index)].sort((a, b) => a - b))
    expect(bundle.levels.length).toBe(marcowki.levels.length)
    for (const level of bundle.levels) {
      const source = marcowki.levels.find((l) => l.id === level.id)
      expect(source).toBeDefined()
      expect(level.elevation).toBe(source?.elevation)
      expect(level.height).toBe(source?.height)
      expect(level.label.length).toBeGreaterThan(0)
    }
    const levelIds = new Set(bundle.levels.map((l) => l.id))
    for (const o of bundle.objects) if (o.levelId) expect(levelIds.has(o.levelId), `${o.id} is on unknown level ${o.levelId}`).toBe(true)
  })

  it('names every material a mesh refers to', () => {
    const used = new Set(bundle.scene.meshes.map((m) => m.materialId).filter((x): x is string => !!x))
    const known = new Set(bundle.materials.map((m) => m.id))
    for (const id of used) expect(known.has(id), `material ${id} is used by a mesh but not described`).toBe(true)
    for (const m of bundle.materials) expect(m.color).toMatch(/^#[0-9a-fA-F]{6}$/)
  })

  it('points relations at objects, not at dangling ids', () => {
    const modelIds = new Set<string>()
    for (const c of OBJECT_COLLECTIONS) for (const o of marcowki[c] as readonly { id: string }[]) modelIds.add(o.id)
    if (marcowki.building) modelIds.add(marcowki.building.id)
    for (const o of bundle.objects) {
      for (const r of o.relations) {
        expect(modelIds.has(r.targetId), `${o.id} relates to unknown ${r.targetId}`).toBe(true)
        expect(r.targetLabel.length).toBeGreaterThan(0)
      }
    }
    expect(byId.size).toBe(bundle.objects.length)
  })
})
