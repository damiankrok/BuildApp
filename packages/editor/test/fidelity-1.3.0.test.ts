import { describe, expect, it } from 'vitest'
import { createEmptyModel } from '@buildapp/model'
import { runCommands } from '@buildapp/commands'
import { EditorStore } from '../src/index.js'

const house = () =>
  runCommands(createEmptyModel('t', 't'), [
    { type: 'createBuilding', id: 'b' },
    { type: 'createLevel', id: 'ground', index: 0, elevation: 0, height: 3 },
    { type: 'createLevel', id: 'upper', index: 1, elevation: 3, height: 3 },
    { type: 'defineMaterial', id: 'timber', name: 'timber', color: '#8a6a3d' },
    { type: 'createWall', id: 'w', levelId: 'ground', start: { x: 0, z: 0 }, end: { x: 8, z: 0 }, thickness: 0.3, height: 3 },
    { type: 'cutOpening', id: 'o', wallId: 'w', kind: 'DOOR', offset: 2, sill: 0, width: 1.05, height: 2.1 },
    { type: 'placeDoor', id: 'd', openingId: 'o', assembly: { panels: [{ kind: 'LEAF', fraction: 0.72, hinge: 'LEFT', glazing: 'NONE' }, { kind: 'GLAZED', fraction: 0.28 }], mullionWidth: 0.04 } },
    { type: 'createSurfaceRegion', id: 'r', hostId: 'w', rect: { a0: 4, a1: 6, b0: 0, b1: 2.5 }, materialId: 'timber' },
    { type: 'createRoof', id: 'roof', levelId: 'upper', kind: 'GABLE', footprint: { minX: 0, maxX: 8, minZ: 0, maxZ: 6 }, eaveOffset: 0, pitchDeg: 40, ridgeAxis: 'Z', thickness: 0.2 },
    { type: 'cutRoofOpening', id: 'ro', roofId: 'roof', kind: 'ROOFLIGHT', footprint: { minX: 1, maxX: 2, minZ: 2, maxZ: 2.8 }, cut: 'NORMAL_TO_ROOF' },
    { type: 'createSlab', id: 's', levelId: 'upper', polygon: [{ x: 0.3, z: 0.3 }, { x: 7.7, z: 0.3 }, { x: 7.7, z: 5.7 }, { x: 0.3, z: 5.7 }], holes: [[{ x: 1, z: 2 }, { x: 3.7, z: 2 }, { x: 3.7, z: 3 }, { x: 1, z: 3 }]], thickness: 0.25 },
    { type: 'createStair', id: 'st', levelId: 'ground', toLevelId: 'upper', start: { x: 1, z: 3 }, direction: 'PLUS_X', width: 1, segments: [{ kind: 'FLIGHT', risers: 10, going: 0.27 }] },
  ])

describe('EditorStore — schema 1.3.0 objects', () => {
  it('describes the composition of stairs, slabs, roof openings, doors and regions, with selectable references', () => {
    const store = new EditorStore(house())
    const stair = store.describe('st')!
    expect(stair.details.map((d) => d.label)).toEqual(expect.arrayContaining(['kind', 'to level', 'rise', 'risers', 'width', 'start', 'segment 1', 'steps extent', 'slab void']))
    expect(stair.details.find((d) => d.label === 'risers')!.value).toBe('10 × 0.300 m')
    expect(stair.details.find((d) => d.label === 'slab void')!.ref).toBe('s')
    expect(stair.properties.map((p) => p.key)).toEqual(['name', 'width', 'baseOffset', 'topOffset', 'waist'])
    const slab = store.describe('s')!
    expect(slab.details.find((d) => d.label === 'holes')!.value).toContain('1, 2.700 m² removed')
    expect(slab.details.find((d) => d.label === 'stair through')!.ref).toBe('st')
    const ro = store.describe('ro')!
    expect(ro.details.find((d) => d.label === 'cut')!.value).toBe('NORMAL_TO_ROOF')
    expect(ro.details.find((d) => d.label === 'underside outline')!.value).toContain('shifted')
    expect(ro.properties.find((p) => p.key === 'cut')!.options).toEqual(['VERTICAL', 'NORMAL_TO_ROOF'])
    const door = store.describe('d')!
    expect(door.details.find((d) => d.label === 'panel 2')!.value).toContain('GLAZED')
    const region = store.describe('r')!
    expect(region.host).toEqual({ id: 'w', kind: 'wall', relation: 'finish on' })
    expect(region.details.find((d) => d.label === 'material')!.value).toContain('timber')
    expect(region.properties.find((p) => p.key === 'materialId')!.options).toEqual(['timber'])
    expect(store.describe('w')!.details.find((d) => d.label === 'finish region')!.ref).toBe('r')
    // the tree lists the region under its wall; the family of the wall includes it; hiding the wall hides it
    const wallNode = store.sceneTree()[0].children[0].children.find((n) => n.label.startsWith('Walls'))!.children.find((n) => n.id === 'w')!
    expect(wallNode.children.map((c) => c.id)).toEqual(['o', 'r'])
    expect(store.familyOf('w').has('r')).toBe(true)
    store.hide('w')
    expect(store.isObjectVisible('r')).toBe(false)
    store.show('w')
    expect(store.isObjectVisible('r')).toBe(true)
  })

  it('frames a selected object and unframes; editing a cut mode goes through the command path', () => {
    const store = new EditorStore(house())
    store.select('st')
    const nonce = store.getSnapshot().viewNonce
    store.frame()
    expect(store.getSnapshot().focus).toBe('st')
    expect(store.getSnapshot().viewNonce).toBe(nonce + 1)
    store.frame(null)
    expect(store.getSnapshot().focus).toBeNull()
    store.frame('nope')
    expect(store.getSnapshot().focus).toBeNull()
    store.trace.length = 0
    expect(store.setProperty('ro', 'cut', 'VERTICAL').ok).toBe(true)
    expect(store.trace.map((t) => t.step)).toEqual(['command', 'model-updated', 'geometry-compiled', 'listeners-notified'])
    expect(store.describe('ro')!.details.find((d) => d.label === 'cut')!.value).toBe('VERTICAL')
    // removing the focused object drops the focus
    store.frame('st')
    store.execute({ type: 'removeFeature', targetId: 'st' })
    expect(store.getSnapshot().focus).toBeNull()
  })
})
