import { describe, expect, it } from 'vitest'
import { createDemoBuilding } from '@buildapp/demo'
import { boundsOf } from '@buildapp/verification'
import { EditorStore } from '../src/index.js'

describe('EditorStore', () => {
  it('editing a property updates the canonical model first, then recompiles, then notifies', () => {
    const store = new EditorStore(createDemoBuilding())
    const notified: number[] = []
    store.subscribe((s) => notified.push(s.revision))
    const before = store.getSnapshot().scene
    const heightBefore = store.model.walls.find((w) => w.id === 'g-front')!.height
    store.trace.length = 0
    const r = store.setProperty('g-front', 'height', heightBefore + 0.5)
    expect(r.ok).toBe(true)
    expect(store.trace.map((t) => t.step)).toEqual(['command', 'model-updated', 'geometry-compiled', 'listeners-notified'])
    expect(store.model.walls.find((w) => w.id === 'g-front')!.height).toBe(heightBefore + 0.5)
    const after = store.getSnapshot().scene
    expect(after).not.toBe(before)
    const wallTris = after.meshes.filter((m) => m.solidId === 'g-front').flatMap((m) => m.triangles)
    expect(boundsOf(wallTris)!.max.y).toBeCloseTo(heightBefore + 0.5, 12)
    expect(notified).toEqual([1])
  })

  it('rejected edits leave model and geometry untouched and report the error', () => {
    const store = new EditorStore(createDemoBuilding())
    const scene = store.getSnapshot().scene
    const r = store.setProperty('op-gf-1', 'width', 30)
    expect(r.ok).toBe(false)
    expect(store.getSnapshot().scene).toBe(scene)
    expect(store.getSnapshot().lastError).toContain('OPENING_OUTSIDE_HOST')
    expect(store.trace[store.trace.length - 1].step).toBe('command-rejected')
  })

  it('undo and redo recompile geometry', () => {
    const store = new EditorStore(createDemoBuilding())
    const tri0 = store.getSnapshot().scene.stats.triangleCount
    store.execute({ type: 'removeFeature', targetId: 'chimney-1' })
    expect(store.getSnapshot().scene.meshes.some((m) => m.objectId === 'chimney-1')).toBe(false)
    expect(store.getSnapshot().canUndo).toBe(true)
    store.undo()
    expect(store.getSnapshot().scene.meshes.some((m) => m.objectId === 'chimney-1')).toBe(true)
    expect(store.getSnapshot().scene.stats.triangleCount).toBe(tri0)
    store.redo()
    expect(store.getSnapshot().scene.meshes.some((m) => m.objectId === 'chimney-1')).toBe(false)
  })

  it('selection, hide/show, isolate, storey isolation and roof toggle resolve per mesh', () => {
    const store = new EditorStore(createDemoBuilding())
    store.select('g-front')
    expect(store.getSnapshot().selection).toBe('g-front')
    store.select('nope')
    expect(store.getSnapshot().selection).toBe('g-front')

    store.hide('g-front')
    // hiding a wall hides its openings' reveals and fills too
    expect(store.visibleMeshes().some((m) => m.objectId === 'g-front' || m.hostWallId === 'g-front')).toBe(false)
    store.show('g-front')
    expect(store.visibleMeshes().some((m) => m.objectId === 'g-front')).toBe(true)

    store.setRoofsVisible(false)
    expect(store.visibleMeshes().some((m) => m.objectKind === 'roof')).toBe(false)
    store.setRoofsVisible(true)

    store.isolateLevel('upper')
    expect(store.visibleMeshes().every((m) => m.levelId === 'upper')).toBe(true)
    expect(store.visibleMeshes().length).toBeGreaterThan(0)
    store.isolateLevel(null)

    store.isolate('g-front')
    const vis = store.visibleMeshes()
    expect(vis.length).toBeGreaterThan(0)
    expect(vis.every((m) => m.objectId === 'g-front' || m.hostWallId === 'g-front')).toBe(true)
    expect(vis.some((m) => m.objectKind === 'door')).toBe(true)

    store.resetVisibility()
    expect(store.visibleMeshes().length).toBe(store.getSnapshot().scene.meshes.length)
  })

  it('save and load round-trip through the store', () => {
    const store = new EditorStore(createDemoBuilding())
    const json = store.saveJson()
    store.execute({ type: 'removeFeature', targetId: 'roof-main' })
    expect(store.model.roofs.some((r) => r.id === 'roof-main')).toBe(false)
    const r = store.loadJson(json)
    expect(r.ok).toBe(true)
    expect(store.model.roofs.some((r) => r.id === 'roof-main')).toBe(true)
    expect(store.saveJson()).toBe(json)
    expect(store.getSnapshot().canUndo).toBe(false)
    const bad = store.loadJson('{"schema":"nope"}')
    expect(bad.ok).toBe(false)
    expect(store.getSnapshot().lastError).toBeTruthy()
    expect(store.saveJson()).toBe(json)
  })

  it('describes objects with their host relations and builds a scene tree', () => {
    const store = new EditorStore(createDemoBuilding())
    const d = store.describe('win-gf-1')!
    expect(d).toMatchObject({ kind: 'window', openingId: 'op-gf-1', hostWallId: 'g-front', levelId: 'ground' })
    expect(d.properties.map((p) => p.key)).toContain('divisions')
    expect(store.describe('door-kitchen')!.properties.map((p) => p.key)).toContain('openAngle')
    expect(store.describe('roof-main')!.properties.map((p) => p.key)).toContain('pitchDeg')
    const tree = store.sceneTree()
    expect(tree[0].kind).toBe('building')
    const ground = tree[0].children.find((n) => n.id === 'ground')!
    const walls = ground.children.find((n) => n.kind === 'wall')!
    const front = walls.children.find((n) => n.id === 'g-front')!
    expect(front.children.map((n) => n.id)).toContain('op-entrance')
    expect(front.children.find((n) => n.id === 'op-entrance')!.children[0].id).toBe('door-entrance')
  })
})
