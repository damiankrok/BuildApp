/**
 * Architecture tests for the reference boundary (STAGE BUILDAPP-01).
 *
 * The Marcówki reference is a specimen that flows through the generic
 * pipeline: commands → CanonicalBuildingModel → compiler → EditorStore →
 * viewport. These tests read the source tree and exercise the real packages
 * so a future shortcut — geometry imported into the viewer, a project branch
 * in a generic package, a hand-authored scene — fails here by name.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createEmptyModel, loadModel, serializeModel } from '@buildapp/model'
import { runCommands } from '@buildapp/commands'
import { compileBuilding, solidTriangles } from '@buildapp/geometry'
import { EditorStore } from '@buildapp/editor'
import { createDemoBuilding } from '@buildapp/demo'
import { MARCOWKI_CREATED_WITH, MARCOWKI_MODEL_ID, MARCOWKI_MODEL_NAME, createMarcowkiReferenceBuilding, marcowkiCommands } from '@buildapp/reference-marcowki'
import { boundsOf, materialLength, meshVolume } from '@buildapp/verification'

const ROOT = resolve(import.meta.dirname, '../..')

function sourceFiles(dir: string, opts: { includeTests?: boolean } = {}): string[] {
  const out: string[] = []
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      if (name === 'node_modules' || name === 'dist') continue
      if (!opts.includeTests && (name === 'test' || name === 'e2e')) continue
      const p = join(d, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(ts|tsx)$/.test(name) && (opts.includeTests || !name.endsWith('.test.ts'))) out.push(p)
    }
  }
  walk(dir)
  return out
}

function importsOf(file: string): string[] {
  const src = readFileSync(file, 'utf8')
  const specs: string[] = []
  for (const m of src.matchAll(/^\s*import\s+(?:type\s+)?[^'"]*?from\s+['"]([^'"]+)['"]/gm)) specs.push(m[1])
  for (const m of src.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)) specs.push(m[1])
  for (const m of src.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) specs.push(m[1])
  return specs
}

const rel = (f: string): string => f.replace(ROOT, '')

describe('the reference boundary', () => {
  it('1. the viewport and the editor store never import the reference package: it enters only as a model handed to the store', () => {
    const web = resolve(ROOT, 'apps/web/src')
    for (const f of [resolve(web, 'viewport/scene-adapter.ts'), resolve(web, 'viewport/camera-presets.ts'), resolve(web, 'components/Viewport.tsx'), resolve(web, 'components/Inspector.tsx'), resolve(web, 'components/Outliner.tsx'), resolve(web, 'components/StatusBar.tsx')]) {
      for (const spec of importsOf(f)) expect(spec.startsWith('@buildapp/reference-marcowki'), `${rel(f)} imports ${spec}`).toBe(false)
    }
    for (const f of sourceFiles(resolve(ROOT, 'packages/editor/src'))) {
      for (const spec of importsOf(f)) expect(spec.startsWith('@buildapp/reference-marcowki'), `${rel(f)} imports ${spec}`).toBe(false)
    }
    // where the web app does import it (the toolbar's model selector), it calls the factory and never touches the command list or geometry
    let importers = 0
    for (const f of sourceFiles(web)) {
      if (!importsOf(f).some((s) => s.startsWith('@buildapp/reference-marcowki'))) continue
      importers++
      const src = readFileSync(f, 'utf8')
      expect(src, rel(f)).toMatch(/createMarcowkiReferenceBuilding\(\)/)
      expect(src, rel(f)).not.toMatch(/marcowkiCommands|EXPECTED_|FACTS|MARCOWKI_LEDGER/)
    }
    expect(importers).toBe(1)
  })

  it('2. the generic packages neither import the reference nor branch on it: no project name in model, commands, geometry, editor, verification', () => {
    for (const pkg of ['model', 'commands', 'geometry', 'editor', 'verification']) {
      for (const f of sourceFiles(resolve(ROOT, `packages/${pkg}/src`))) {
        for (const spec of importsOf(f)) expect(spec.startsWith('@buildapp/reference-marcowki'), `${rel(f)} imports ${spec}`).toBe(false)
        const src = readFileSync(f, 'utf8')
        expect(src, `${rel(f)} mentions the reference project`).not.toMatch(/marc[oó]wk/i)
        expect(src, `${rel(f)} branches on a project id`).not.toMatch(/project\s*===|modelId\s*===\s*['"]|\.id\s*===\s*['"]marcowki/)
      }
    }
    // the demo is a specimen like the reference: it may name it in prose, but never imports it
    for (const f of sourceFiles(resolve(ROOT, 'packages/demo/src'))) for (const spec of importsOf(f)) expect(spec.startsWith('@buildapp/reference-marcowki'), `${rel(f)} imports ${spec}`).toBe(false)
    // and the web app's viewport code has no project branches either
    for (const f of sourceFiles(resolve(ROOT, 'apps/web/src/viewport'))) expect(readFileSync(f, 'utf8'), rel(f)).not.toMatch(/marc[oó]wk/i)
  })

  it('3. the reference package is evidence and commands only: no renderer, no compiler, no triangle lists', () => {
    const dir = resolve(ROOT, 'packages/reference-marcowki/src')
    for (const f of sourceFiles(dir)) {
      for (const spec of importsOf(f)) expect(/^(three|react|react-dom|@buildapp\/(geometry|editor|verification|web|demo))/.test(spec), `${rel(f)} imports ${spec}`).toBe(false)
      const src = readFileSync(f, 'utf8')
      expect(src, rel(f)).not.toMatch(/from 'three'|BufferGeometry|THREE\.|\bMesh\b|new Float32Array|\.glb|\.gltf/i)
      expect(src, rel(f)).not.toMatch(/triangles?\s*[:=]\s*\[/)
    }
    const pkg = JSON.parse(readFileSync(resolve(dir, '../package.json'), 'utf8')) as { dependencies?: Record<string, string> }
    expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual(['@buildapp/commands', '@buildapp/model'])
  })

  it('4. the reference model IS its command replay, and it is an ordinary model: it saves, reloads and compiles without the package', () => {
    const replayed = runCommands(createEmptyModel(MARCOWKI_MODEL_ID, MARCOWKI_MODEL_NAME, MARCOWKI_CREATED_WITH), marcowkiCommands())
    const json = serializeModel(createMarcowkiReferenceBuilding())
    expect(serializeModel(replayed)).toBe(json)
    const back = loadModel(json)
    expect(back.ok).toBe(true)
    if (!back.ok) return
    const fromFile = compileBuilding(back.model)
    expect(fromFile.diagnostics).toEqual([])
    expect(fromFile).toEqual(compileBuilding(createMarcowkiReferenceBuilding()))
    // the frozen fixture the model and geometry packages test against is this file
    expect(readFileSync(resolve(ROOT, 'packages/model/test/fixtures/marcowki-ge-1.4.0.json'), 'utf8')).toBe(json)
  })

  it('5. every generic primitive the stage added has a test that is not about Marcówki', () => {
    // "not about Marcówki": none of these files touches the reference package, its model id or its factory
    const REFERENCE = /@buildapp\/reference-marcowki|marcowki-ge|createMarcowkiReferenceBuilding|marcowkiCommands/
    const generic = readFileSync(resolve(ROOT, 'packages/geometry/test/openings-1.2.0.test.ts'), 'utf8')
    expect(generic).not.toMatch(REFERENCE)
    for (const feature of ['RAKED', 'leaves', 'ROOFLIGHT', 'PENETRATION', 'mullions']) expect(generic, feature).toContain(feature)
    const modelTests = readFileSync(resolve(ROOT, 'packages/model/test/openings-1.2.0.test.ts'), 'utf8')
    expect(modelTests).not.toMatch(REFERENCE)
    for (const code of ['OPENING_LEAF_NOT_PARALLEL', 'ROOF_OPENING_CROSSES_RIDGE', 'ROOF_OPENINGS_OVERLAP', 'ROOF_PENETRATION_MISMATCH', 'FILL_PROFILE_UNSUPPORTED']) expect(modelTests, code).toContain(code)
    const commandTests = readFileSync(resolve(ROOT, 'packages/commands/test/openings-1.2.0.test.ts'), 'utf8')
    expect(commandTests).not.toMatch(REFERENCE)
    for (const cmd of ['cutRoofOpening', 'placeRooflight', 'leaves', 'head']) expect(commandTests, cmd).toContain(cmd)
    // STAGE BUILDAPP-01A: the stair, slab holes, roof cut modes, door assemblies and surface regions have generic tests in every layer
    const geometry13 = readFileSync(resolve(ROOT, 'packages/geometry/test/fidelity-1.3.0.test.ts'), 'utf8')
    expect(geometry13).not.toMatch(REFERENCE)
    for (const feature of ['holes', 'WINDER', 'LANDING', 'NORMAL_TO_ROOF', 'assembly', 'GLAZED', 'createSurfaceRegion']) expect(geometry13, feature).toContain(feature)
    const commands13 = readFileSync(resolve(ROOT, 'packages/commands/test/fidelity-1.3.0.test.ts'), 'utf8')
    expect(commands13).not.toMatch(REFERENCE)
    for (const cmd of ['createStair', 'createSurfaceRegion', 'holes', 'cut', 'assembly']) expect(commands13, cmd).toContain(cmd)
    const editor13 = readFileSync(resolve(ROOT, 'packages/editor/test/fidelity-1.3.0.test.ts'), 'utf8')
    expect(editor13).not.toMatch(REFERENCE)
    for (const what of ['createSurfaceRegion', 'createStair', 'details']) expect(editor13, what).toContain(what)
    const migration = readFileSync(resolve(ROOT, 'packages/model/test/migration.test.ts'), 'utf8')
    expect(migration).not.toMatch(REFERENCE)
    expect(migration).toContain('1.3.0')
    // a slab with a hole in a plain building loses exactly the hole's area times its thickness
    const slabbed = runCommands(createEmptyModel('s', 's'), [
      { type: 'createBuilding', id: 'b' },
      { type: 'createLevel', id: 'l', index: 0, elevation: 0, height: 3 },
      { type: 'createSlab', id: 'plain', levelId: 'l', polygon: [{ x: 0, z: 0 }, { x: 6, z: 0 }, { x: 6, z: 4 }, { x: 0, z: 4 }], thickness: 0.25 },
      { type: 'createSlab', id: 'holed', levelId: 'l', polygon: [{ x: 10, z: 0 }, { x: 16, z: 0 }, { x: 16, z: 4 }, { x: 10, z: 4 }], holes: [[{ x: 11, z: 1 }, { x: 13, z: 1 }, { x: 13, z: 2 }, { x: 12, z: 2 }, { x: 12, z: 3 }, { x: 11, z: 3 }]], thickness: 0.25 },
    ])
    const slabScene = compileBuilding(slabbed)
    expect(meshVolume(solidTriangles(slabScene, 'plain')) - meshVolume(solidTriangles(slabScene, 'holed'))).toBeCloseTo((2 * 1 + 1 * 1) * 0.25, 9)
    // the primitives work on a building that is not the reference: a raked opening in a plain wall loses exactly its trapezoid
    const plain = runCommands(createEmptyModel('p', 'p'), [
      { type: 'createBuilding', id: 'b' },
      { type: 'createLevel', id: 'l', index: 0, elevation: 0, height: 4 },
      { type: 'createWall', id: 'w', levelId: 'l', start: { x: 0, z: 0 }, end: { x: 6, z: 0 }, thickness: 0.3, height: 4 },
    ])
    const full = meshVolume(solidTriangles(compileBuilding(plain), 'w'))
    const raked = meshVolume(solidTriangles(compileBuilding(runCommands(plain, [{ type: 'cutOpening', id: 'o', wallId: 'w', kind: 'WINDOW', offset: 2, sill: 0.5, width: 2, height: 1, head: { kind: 'RAKED', heightFar: 2 } }])), 'w'))
    expect(full - raked).toBeCloseTo(((1 + 2) / 2) * 2 * 0.3, 9)
  })

  it('6. the store compiles whatever model it holds through the one path: the reference replaces the demo in the same EditorStore', () => {
    const store = new EditorStore(createDemoBuilding())
    expect(store.getSnapshot().scene).toEqual(compileBuilding(store.getSnapshot().model))
    store.trace.length = 0
    store.replaceModel(createMarcowkiReferenceBuilding())
    expect(store.trace.map((t) => t.step)).toEqual(['command', 'model-updated', 'geometry-compiled', 'listeners-notified'])
    expect(store.getSnapshot().model.id).toBe(MARCOWKI_MODEL_ID)
    expect(store.getSnapshot().scene).toEqual(compileBuilding(store.getSnapshot().model))
    const b = boundsOf(store.getSnapshot().scene.meshes.filter((m) => m.structural).flatMap((m) => m.triangles))!
    expect(b.max.z - b.min.z).toBeCloseTo(14.6, 9)
    // an inspector edit on the reference goes through the same command path and regenerates geometry
    store.trace.length = 0
    store.setProperty('roof-main', 'pitchDeg', 45)
    expect(store.trace.map((t) => t.step)).toEqual(['command', 'model-updated', 'geometry-compiled', 'listeners-notified'])
    expect(store.getSnapshot().scene).toEqual(compileBuilding(store.getSnapshot().model))
    // the viewer's mesh list is the compiler output filtered by visibility, nothing added
    const shown = store.visibleMeshes()
    expect(shown.every((m) => store.getSnapshot().scene.meshes.includes(m))).toBe(true)
    // the store's source keeps the single compile call on the session model
    expect(readFileSync(resolve(ROOT, 'packages/editor/src/store.ts'), 'utf8')).toMatch(/compileBuilding\(this\.session\.model\)/)
    expect(materialLength(solidTriangles(store.getSnapshot().scene, 'g-front'), { x: 0.9, y: 1.2, z: -1 }, { x: 0, y: 0, z: 1 })).toBeCloseTo(0.45, 9)
  })

  it('7. the schema migrations change no geometry: the frozen 1.1.0, 1.2.0 and 1.3.0 demo files compile to exactly the current demo scene', () => {
    for (const [file, steps] of [
      ['demo-house-1.1.0.json', 3],
      ['demo-house-1.2.0.json', 2],
      ['demo-house-1.3.0.json', 1],
    ] as const) {
      const migrated = loadModel(readFileSync(resolve(ROOT, `packages/model/test/fixtures/${file}`), 'utf8'))
      expect(migrated.ok, file).toBe(true)
      if (!migrated.ok) return
      expect(migrated.issues.map((i) => i.code)).toEqual(Array(steps).fill('SCHEMA_MIGRATED'))
      expect(migrated.model.schemaVersion).toBe('1.4.0')
      expect(compileBuilding(migrated.model)).toEqual(compileBuilding(createDemoBuilding()))
    }
  })
})
