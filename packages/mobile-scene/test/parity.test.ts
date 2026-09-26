/**
 * Mobile / web geometry parity.
 *
 * The oracle is the compiler itself, never a second table of expected
 * coordinates: this file compiles each model with `@buildapp/geometry` and
 * requires the bundle to agree with that output exactly. If mobile
 * serialization ever moved a triangle, rounded a coordinate, dropped a
 * diagnostic or re-parented an object, one of these fails.
 *
 * The exported assets on disk are checked too, so a stale
 * `apps/android/.../assets/scenes` cannot ship geometry that disagrees with
 * today's model.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createDemoBuilding } from '@buildapp/demo'
import { createMarcowkiReferenceBuilding } from '@buildapp/reference-marcowki'
import { compileBuilding, type CompiledScene } from '@buildapp/geometry'
import type { CanonicalBuildingModel } from '@buildapp/model'
import { ASSET_DIR, SCENES } from '../scripts/scenes.js'
import { buildMobileSceneBundle, loadBundle, serializeBundle, trianglesOf, type MobileSceneBundle } from '../src/index.js'

type Case = { name: string; model: CanonicalBuildingModel; scene: CompiledScene; bundle: MobileSceneBundle }

const cases: Case[] = [
  ['demo', createDemoBuilding()],
  ['marcowki', createMarcowkiReferenceBuilding()],
].map(([name, model]) => {
  const m = model as CanonicalBuildingModel
  const scene = compileBuilding(m)
  return { name: name as string, model: m, scene, bundle: buildMobileSceneBundle(m) }
})

/** objectId -> the geometry parts the compiler gave it. */
const partsByObject = (scene: CompiledScene): Map<string, string[]> => {
  const m = new Map<string, Set<string>>()
  for (const mesh of scene.meshes) {
    if (!m.has(mesh.objectId)) m.set(mesh.objectId, new Set())
    m.get(mesh.objectId)?.add(mesh.part)
  }
  return new Map([...m].map(([k, v]) => [k, [...v].sort()]))
}

/** objectId -> the levels the compiler put its meshes on. */
const levelsByObject = (scene: CompiledScene): Map<string, string[]> => {
  const m = new Map<string, Set<string>>()
  for (const mesh of scene.meshes) {
    if (!m.has(mesh.objectId)) m.set(mesh.objectId, new Set())
    if (mesh.levelId) m.get(mesh.objectId)?.add(mesh.levelId)
  }
  return new Map([...m].map(([k, v]) => [k, [...v].sort()]))
}

describe.each(cases)('$name: the mobile bundle is the compiler output', ({ scene, bundle }) => {
  it('agrees on the model it describes', () => {
    expect(bundle.scene.modelId).toBe(scene.modelId)
  })

  it('agrees on mesh, triangle and object counts', () => {
    expect(bundle.scene.stats).toEqual(scene.stats)
    expect(bundle.scene.meshes.length).toBe(scene.meshes.length)
    expect(bundle.scene.meshes.reduce((s, m) => s + m.triangleCount, 0)).toBe(scene.stats.triangleCount)
    expect(new Set(bundle.scene.meshes.map((m) => m.objectId)).size).toBe(scene.stats.objectCount)
  })

  it('agrees on the scene bounds', () => {
    expect(bundle.scene.bounds).toEqual(scene.bounds)
  })

  it('agrees on every semantic object id', () => {
    expect(new Set(bundle.scene.meshes.map((m) => m.objectId))).toEqual(new Set(scene.meshes.map((m) => m.objectId)))
    expect(new Set(bundle.objects.map((o) => o.id))).toEqual(new Set(scene.meshes.map((m) => m.objectId)))
  })

  it('agrees on the geometry parts of every object', () => {
    expect(partsByObject({ ...scene, meshes: bundle.scene.meshes.map((m) => ({ ...m, triangles: [] })) } as unknown as CompiledScene)).toEqual(partsByObject(scene))
    for (const o of bundle.objects) expect(o.parts).toEqual(partsByObject(scene).get(o.id))
  })

  it('agrees on per-level ownership', () => {
    const fromBundle = new Map<string, Set<string>>()
    for (const mesh of bundle.scene.meshes) {
      if (!fromBundle.has(mesh.objectId)) fromBundle.set(mesh.objectId, new Set())
      if (mesh.levelId) fromBundle.get(mesh.objectId)?.add(mesh.levelId)
    }
    expect(new Map([...fromBundle].map(([k, v]) => [k, [...v].sort()]))).toEqual(levelsByObject(scene))
  })

  it('agrees on diagnostics', () => {
    expect(bundle.scene.diagnostics).toEqual(scene.diagnostics)
  })

  it('carries every mesh tag through unchanged, adding only the styling group', () => {
    for (let i = 0; i < scene.meshes.length; i++) {
      const a = scene.meshes[i]
      const b = bundle.scene.meshes[i]
      // `semanticGroup` is the one field the bundle adds to a compiled mesh;
      // semantics.test.ts holds it to `semanticGroupOf`. Everything else is
      // the compiler's own tag, untouched.
      expect(typeof b.semanticGroup).toBe('string')
      expect({ ...b, positions: undefined, triangleCount: undefined, semanticGroup: undefined }).toEqual({
        ...a,
        triangles: undefined,
        positions: undefined,
        triangleCount: undefined,
        semanticGroup: undefined,
      })
    }
  })

  it('changes not one triangle coordinate', () => {
    for (let i = 0; i < scene.meshes.length; i++) {
      expect(trianglesOf(bundle.scene.meshes[i]), `mesh ${i} (${scene.meshes[i].objectId} ${scene.meshes[i].part})`).toEqual(scene.meshes[i].triangles)
    }
  })

  it('survives the asset text with its coordinates intact', () => {
    const loaded = loadBundle(serializeBundle(bundle))
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    for (let i = 0; i < scene.meshes.length; i++) {
      expect(trianglesOf(loaded.bundle.scene.meshes[i])).toEqual(scene.meshes[i].triangles)
    }
  })
})

describe('the exported assets on disk', () => {
  const indexPath = join(ASSET_DIR, 'index.json')

  it('exist — run `npm run mobile:export-scenes`', () => {
    expect(existsSync(indexPath), `${indexPath} is missing`).toBe(true)
  })

  it('are today’s models, not a stale export', () => {
    if (!existsSync(indexPath)) return
    for (const spec of SCENES) {
      const fresh = buildMobileSceneBundle(spec.build())
      const onDisk = readFileSync(join(ASSET_DIR, `${spec.key}.scene.json`), 'utf8')
      expect(onDisk, `${spec.key}.scene.json is stale; rerun npm run mobile:export-scenes`).toBe(serializeBundle(fresh))
      const loaded = loadBundle(onDisk)
      expect(loaded.ok).toBe(true)
      if (loaded.ok) expect(loaded.bundle.contentHash).toBe(fresh.contentHash)
    }
  })

  it('are listed in an index the app can read', () => {
    if (!existsSync(indexPath)) return
    const index = JSON.parse(readFileSync(indexPath, 'utf8')) as { key: string; asset: string; contentHash: string; triangleCount: number }[]
    expect(index.map((e) => e.key)).toEqual(SCENES.map((s) => s.key))
    for (const entry of index) {
      const spec = SCENES.find((s) => s.key === entry.key)
      expect(spec).toBeDefined()
      if (!spec) continue
      const fresh = buildMobileSceneBundle(spec.build())
      expect(entry.contentHash).toBe(fresh.contentHash)
      expect(entry.triangleCount).toBe(fresh.scene.stats.triangleCount)
      expect(existsSync(join(ASSET_DIR, entry.asset))).toBe(true)
    }
  })
})
