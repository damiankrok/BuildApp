/**
 * Architecture tests: the rules that keep good geometry on the production
 * path and the layers apart. They read source files and exercise the real
 * packages, so a future change that breaks a boundary fails here by name.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createDemoBuilding, demoBuildingCommands } from '@buildapp/demo'
import { createEmptyModel, loadModel, serializeModel } from '@buildapp/model'
import { runCommands } from '@buildapp/commands'
import { compileBuilding, solidTriangles } from '@buildapp/geometry'
import { EditorStore } from '@buildapp/editor'
import { materialLength, meshVolume } from '@buildapp/verification'

const ROOT = resolve(import.meta.dirname, '../..')

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      if (name === 'node_modules' || name === 'dist' || name === 'test' || name === 'e2e') continue
      const p = join(d, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts')) out.push(p)
    }
  }
  walk(dir)
  return out
}

/** Every module specifier imported (value or type) by a file. */
function importsOf(file: string): { value: string[]; type: string[] } {
  const src = readFileSync(file, 'utf8')
  const value: string[] = []
  const type: string[] = []
  for (const m of src.matchAll(/^\s*import\s+(type\s+)?[^'"]*?from\s+['"]([^'"]+)['"]/gm)) (m[1] ? type : value).push(m[2])
  for (const m of src.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)) value.push(m[1])
  return { value, type }
}

const forbid = (dir: string, banned: RegExp, why: string): void => {
  for (const f of sourceFiles(dir)) {
    const { value, type } = importsOf(f)
    for (const spec of [...value, ...type]) {
      expect(banned.test(spec), `${f.replace(ROOT, '')} imports "${spec}" — ${why}`).toBe(false)
    }
  }
}

describe('layer boundaries', () => {
  it('the domain model has no Three.js, React, DOM or renderer dependency', () => {
    forbid(resolve(ROOT, 'packages/model/src'), /^(three|react|react-dom|@buildapp\/(geometry|editor|demo|commands|web))/, 'the model is the source of truth and depends on nothing above it')
    const pkg = JSON.parse(readFileSync(resolve(ROOT, 'packages/model/package.json'), 'utf8')) as { dependencies?: Record<string, string> }
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(['zod'])
  })

  it('the command layer depends on the model only', () => {
    forbid(resolve(ROOT, 'packages/commands/src'), /^(three|react|react-dom|@buildapp\/(geometry|editor|demo|web))/, 'commands operate on semantics only')
  })

  it('the geometry compiler has no React, Three.js or editor dependency', () => {
    forbid(resolve(ROOT, 'packages/geometry/src'), /^(three|react|react-dom|@buildapp\/(editor|demo|commands|web))/, 'the compiler is pure model -> triangles')
    const pkg = JSON.parse(readFileSync(resolve(ROOT, 'packages/geometry/package.json'), 'utf8')) as { dependencies?: Record<string, string> }
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(['@buildapp/model'])
  })

  it('the demo building imports no geometry or renderer code (it is commands, not meshes)', () => {
    forbid(resolve(ROOT, 'packages/demo/src'), /^(three|react|react-dom|@buildapp\/(geometry|editor|web))/, 'the demo is a command list')
    const src = readFileSync(resolve(ROOT, 'packages/demo/src/demo-house.ts'), 'utf8')
    expect(src).not.toMatch(/BufferGeometry|Mesh\b|triangles?/)
  })

  it('the verification oracles share no code with the compiler', () => {
    forbid(resolve(ROOT, 'packages/verification/src'), /^(@buildapp|three|react)/, 'oracles must be independent')
  })
})

describe('the single production path', () => {
  const web = resolve(ROOT, 'apps/web/src')

  it('the viewer never imports demo fixture data as render geometry', () => {
    for (const f of [resolve(web, 'viewport/scene-adapter.ts'), resolve(web, 'viewport/camera-presets.ts'), resolve(web, 'components/Viewport.tsx')]) {
      const { value, type } = importsOf(f)
      for (const spec of [...value, ...type]) expect(spec.startsWith('@buildapp/demo'), `${f} imports ${spec}`).toBe(false)
    }
    // the demo enters the app only as a CanonicalBuildingModel handed to the store
    for (const f of sourceFiles(web)) {
      const src = readFileSync(f, 'utf8')
      if (importsOf(f).value.some((s) => s.startsWith('@buildapp/demo'))) {
        expect(src).toMatch(/createDemoBuilding\(\)/)
        expect(src).not.toMatch(/demoBuildingCommands/)
      }
    }
  })

  it('the viewer receives compiled geometry from the model and does not compile or hand-build any', () => {
    for (const f of sourceFiles(web)) {
      const { value } = importsOf(f)
      // geometry package: types only in the UI; compilation happens in the editor store
      expect(value.some((s) => s.startsWith('@buildapp/geometry')), `${f} value-imports @buildapp/geometry`).toBe(false)
      const src = readFileSync(f, 'utf8')
      expect(src, `${f} calls the compiler directly`).not.toMatch(/compileBuilding\(/)
      expect(src, `${f} builds primitive geometry for building elements`).not.toMatch(/\b(BoxGeometry|PlaneGeometry|ExtrudeGeometry|ShapeGeometry|CylinderGeometry|LatheGeometry|PolyhedronGeometry)\b/)
    }
    const adapter = readFileSync(resolve(web, 'viewport/scene-adapter.ts'), 'utf8')
    expect(adapter).toMatch(/CompiledMesh/)
    expect(adapter).toMatch(/meshToObject/)
    const store = readFileSync(resolve(ROOT, 'packages/editor/src/store.ts'), 'utf8')
    expect(store).toMatch(/compileBuilding\(this\.session\.model\)/)
  })

  it('what the store hands the viewer is exactly the compiler output for the current model', () => {
    const store = new EditorStore(createDemoBuilding())
    expect(store.getSnapshot().scene).toEqual(compileBuilding(store.getSnapshot().model))
    store.setProperty('roof-main', 'pitchDeg', 42)
    expect(store.getSnapshot().scene).toEqual(compileBuilding(store.getSnapshot().model))
  })
})

describe('semantic guarantees', () => {
  it('a structural opening really removes wall material', () => {
    const m = runCommands(createEmptyModel('a', 'a'), [
      { type: 'createBuilding', id: 'b' },
      { type: 'createLevel', id: 'l', index: 0, elevation: 0, height: 3 },
      { type: 'createWall', id: 'w', levelId: 'l', start: { x: 0, z: 0 }, end: { x: 6, z: 0 }, thickness: 0.3, height: 3 },
    ])
    const solid = solidTriangles(compileBuilding(m), 'w')
    const cut = solidTriangles(compileBuilding(runCommands(m, [{ type: 'cutOpening', id: 'o', wallId: 'w', kind: 'WINDOW', offset: 2, sill: 1, width: 1, height: 1 }])), 'w')
    expect(meshVolume(solid) - meshVolume(cut)).toBeCloseTo(1 * 1 * 0.3, 9)
    expect(materialLength(solid, { x: 2.5, y: 1.5, z: -1 }, { x: 0, y: 0, z: 1 })).toBeCloseTo(0.3, 9)
    expect(materialLength(cut, { x: 2.5, y: 1.5, z: -1 }, { x: 0, y: 0, z: 1 })).toBe(0)
  })

  it('save/load preserves every semantic id', () => {
    const m = createDemoBuilding()
    const back = loadModel(serializeModel(m))
    expect(back.ok).toBe(true)
    if (!back.ok) return
    const ids = (x: typeof m): string[] => JSON.stringify(x).match(/"id":"[^"]+"/g)!.sort()
    expect(ids(back.model)).toEqual(ids(m))
  })

  it('doors and windows stay associated with their opening and host wall, in the model and in the compiled geometry', () => {
    const m = createDemoBuilding()
    const scene = compileBuilding(m)
    for (const fill of [...m.doors, ...m.windows]) {
      const opening = m.openings.find((o) => o.id === fill.openingId)!
      expect(opening, fill.id).toBeDefined()
      const wall = m.walls.find((w) => w.id === opening.wallId)!
      expect(wall, fill.id).toBeDefined()
      const meshes = scene.meshes.filter((x) => x.objectId === fill.id)
      expect(meshes.length, fill.id).toBeGreaterThan(0)
      for (const mesh of meshes) expect(mesh).toMatchObject({ hostWallId: wall.id, openingId: opening.id, levelId: wall.levelId })
    }
    // moving a wall moves its fills with it: the association is geometric, not just nominal
    const moved = compileBuilding(runCommands(m, [{ type: 'moveFeature', targetId: 'g-front', dz: -2 }]))
    const before = scene.meshes.find((x) => x.objectId === 'door-entrance' && x.part === 'DOOR_LEAF')!
    const after = moved.meshes.find((x) => x.objectId === 'door-entrance' && x.part === 'DOOR_LEAF')!
    expect(after.triangles[0].a.z).toBeCloseTo(before.triangles[0].a.z - 2, 9)
  })

  it('editing a wall property changes the canonical model first, then geometry is regenerated', () => {
    const store = new EditorStore(createDemoBuilding())
    store.trace.length = 0
    store.setProperty('g-front', 'thickness', 0.45)
    expect(store.trace.map((t) => t.step)).toEqual(['command', 'model-updated', 'geometry-compiled', 'listeners-notified'])
    expect(store.model.walls.find((w) => w.id === 'g-front')!.thickness).toBe(0.45)
    const tris = solidTriangles(store.getSnapshot().scene, 'g-front')
    expect(materialLength(tris, { x: 0.5, y: 0.3, z: -1 }, { x: 0, y: 0, z: 1 })).toBeCloseTo(0.45, 9)
  })

  it('the demo building is constructed through the Building DSL, not as meshes', () => {
    const commands = demoBuildingCommands()
    expect(commands.length).toBeGreaterThan(40)
    expect(commands.every((c) => typeof c.type === 'string' && !/mesh|geometry|triangle/i.test(c.type))).toBe(true)
    const replayed = runCommands(createEmptyModel('demo-house', 'BuildApp demo house', 'buildapp-demo'), commands)
    expect(serializeModel(replayed)).toBe(serializeModel(createDemoBuilding()))
  })
})
