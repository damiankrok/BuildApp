import { describe, expect, it } from 'vitest'
import { createEmptyModel, layoutStair, roofOpeningUndersideRect, serializeModel, type CanonicalBuildingModel } from '@buildapp/model'
import { COMMAND_TYPES, applyCommand, runCommands } from '../src/index.js'

const house = (): CanonicalBuildingModel =>
  runCommands(createEmptyModel('t', 't'), [
    { type: 'createBuilding', id: 'b' },
    { type: 'createLevel', id: 'ground', index: 0, elevation: 0, height: 3 },
    { type: 'createLevel', id: 'upper', index: 1, elevation: 3, height: 3 },
    { type: 'defineMaterial', id: 'timber', name: 'timber', color: '#8a6a3d' },
    { type: 'createWall', id: 'w', levelId: 'ground', start: { x: 0, z: 0 }, end: { x: 8, z: 0 }, thickness: 0.3, height: 3 },
    { type: 'createRoof', id: 'roof', levelId: 'upper', kind: 'GABLE', footprint: { minX: 0, maxX: 8, minZ: 0, maxZ: 6 }, eaveOffset: 0, pitchDeg: 40, ridgeAxis: 'Z', thickness: 0.2 },
  ])

describe('Building DSL — schema 1.3.0 primitives', () => {
  it('exposes createStair and createSurfaceRegion', () => {
    expect(COMMAND_TYPES).toContain('createStair')
    expect(COMMAND_TYPES).toContain('createSurfaceRegion')
  })

  it('createStair derives the footprint from the layout when none is given, keeps a stated one, and moves as one object', () => {
    const m = runCommands(house(), [
      { type: 'createStair', id: 'st', levelId: 'ground', toLevelId: 'upper', start: { x: 1, z: 2 }, direction: 'PLUS_X', width: 1, segments: [{ kind: 'FLIGHT', risers: 6, going: 0.27 }, { kind: 'WINDER', risers: 3, turn: 'LEFT', angleDeg: 90 }, { kind: 'FLIGHT', risers: 7, going: 0.27 }] },
    ])
    const st = m.stairs[0]
    expect(st.kind).toBe('FLIGHTS')
    if (st.kind !== 'FLIGHTS') return
    expect(st.footprint).toEqual({ minX: 1, maxX: 3.62, minZ: 1, maxZ: 3.62 })
    expect(st.waist).toBe(0.18)
    const lay = layoutStair(st, m.levels[0], m.levels[1])
    expect(lay.risers).toBe(16)
    expect(lay.riserHeight).toBeCloseTo(3 / 16, 12)
    const moved = runCommands(m, [{ type: 'moveFeature', targetId: 'st', dx: 0.5, dz: -0.25 }])
    const ms = moved.stairs[0]
    if (ms.kind !== 'FLIGHTS') throw new Error('flights')
    expect(ms.start).toEqual({ x: 1.5, z: 1.75 })
    expect(ms.footprint).toEqual({ minX: 1.5, maxX: 4.12, minZ: 0.75, maxZ: 3.37 })
    const stated = applyCommand(house(), { type: 'createStair', id: 'small', levelId: 'ground', toLevelId: 'upper', footprint: { minX: 1, maxX: 2, minZ: 1, maxZ: 2 }, start: { x: 1, z: 2 }, direction: 'PLUS_X', width: 1, segments: [{ kind: 'FLIGHT', risers: 10, going: 0.27 }] })
    expect(stated.ok).toBe(false)
    if (!stated.ok) expect(stated.errors.map((e) => e.code)).toContain('STAIR_OUTSIDE_FOOTPRINT')
    const noLevel = applyCommand(house(), { type: 'createStair', levelId: 'ground', toLevelId: 'attic', start: { x: 1, z: 2 }, direction: 'PLUS_X', width: 1, segments: [{ kind: 'FLIGHT', risers: 10, going: 0.27 }] })
    expect(noLevel.ok).toBe(false)
    if (!noLevel.ok) expect(noLevel.errors[0].code).toBe('UNKNOWN_LEVEL')
    // ids are deterministic, a stair takes a material, and the record round-trips
    const anon = runCommands(house(), [{ type: 'createStair', levelId: 'ground', toLevelId: 'upper', start: { x: 1, z: 2 }, direction: 'PLUS_X', width: 1, segments: [{ kind: 'FLIGHT', risers: 12, going: 0.25 }], materialId: 'timber' }])
    expect(anon.stairs[0].id).toBe('stair-1')
    expect(serializeModel(anon)).toContain('"kind": "FLIGHTS"')
    expect(applyCommand(anon, { type: 'assignMaterial', targetId: 'stair-1', materialId: null }).ok).toBe(true)
    // removing the material a stair uses clears the reference; removing a level removes the stairs that touch it
    const gone = runCommands(anon, [{ type: 'removeFeature', targetId: 'timber' }])
    const gs = gone.stairs[0]
    expect(gs.kind === 'FLIGHTS' && gs.materialId).toBeUndefined()
    expect(runCommands(anon, [{ type: 'removeFeature', targetId: 'upper' }]).stairs).toEqual([])
  })

  it('createSlab takes holes and cutRoofOpening a cut mode; both are ordinary editable properties', () => {
    const m = runCommands(house(), [
      { type: 'createSlab', id: 's', levelId: 'upper', polygon: [{ x: 0, z: 0 }, { x: 8, z: 0 }, { x: 8, z: 6 }, { x: 0, z: 6 }], holes: [[{ x: 1, z: 1 }, { x: 3, z: 1 }, { x: 3, z: 3 }, { x: 1, z: 3 }]], thickness: 0.3 },
      { type: 'cutRoofOpening', id: 'ro', roofId: 'roof', kind: 'ROOFLIGHT', footprint: { minX: 1, maxX: 2, minZ: 2, maxZ: 2.8 }, cut: 'NORMAL_TO_ROOF' },
    ])
    expect(m.slabs[0].holes).toHaveLength(1)
    expect(m.roofOpenings[0].cut).toBe('NORMAL_TO_ROOF')
    const shift = 0.2 * Math.sin((40 * Math.PI) / 180)
    expect(roofOpeningUndersideRect(m.roofs[0], m.roofOpenings[0]).minX).toBeCloseTo(1 + shift, 12)
    const filled = runCommands(m, [{ type: 'setProperty', targetId: 's', property: 'holes', value: [] }])
    expect(filled.slabs[0].holes).toEqual([])
    const vertical = runCommands(m, [{ type: 'setProperty', targetId: 'ro', property: 'cut', value: 'VERTICAL' }])
    expect(roofOpeningUndersideRect(vertical.roofs[0], vertical.roofOpenings[0])).toEqual(m.roofOpenings[0].footprint)
    const bad = applyCommand(m, { type: 'setProperty', targetId: 's', property: 'holes', value: [[{ x: 7, z: 5 }, { x: 9, z: 5 }, { x: 9, z: 7 }, { x: 7, z: 7 }]] })
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.errors.map((e) => e.code)).toContain('SLAB_HOLE_OUTSIDE')
  })

  it('placeDoor takes an assembly whose fractions must sum to one; createSurfaceRegion needs a wall host and an existing material', () => {
    const m = runCommands(house(), [
      { type: 'cutOpening', id: 'o', wallId: 'w', kind: 'DOOR', offset: 2, sill: 0, width: 1.05, height: 2.1 },
      { type: 'placeDoor', id: 'd', openingId: 'o', assembly: { panels: [{ kind: 'LEAF', fraction: 0.72, hinge: 'LEFT', glazing: 'NONE' }, { kind: 'GLAZED', fraction: 0.28 }], mullionWidth: 0.04 } },
      { type: 'createSurfaceRegion', id: 'r', hostId: 'w', rect: { a0: 0.5, a1: 1.5, b0: 0, b1: 2.5 }, materialId: 'timber' },
    ])
    expect(m.doors[0].assembly?.panels).toHaveLength(2)
    expect(m.surfaceRegions[0]).toMatchObject({ id: 'r', hostId: 'w', face: 'OUTER', materialId: 'timber' })
    const badSum = applyCommand(m, { type: 'placeDoor', openingId: 'o', assembly: { panels: [{ kind: 'LEAF', fraction: 0.5, hinge: 'LEFT', glazing: 'NONE' }], mullionWidth: 0.04 } })
    expect(badSum.ok).toBe(false)
    if (!badSum.ok) expect(badSum.errors.map((e) => e.code)).toContain('OPENING_FILLED_TWICE')
    const badFraction = applyCommand(runCommands(house(), [{ type: 'cutOpening', id: 'o2', wallId: 'w', kind: 'DOOR', offset: 5, sill: 0, width: 1, height: 2.1 }]), { type: 'placeDoor', openingId: 'o2', assembly: { panels: [{ kind: 'LEAF', fraction: 0.5, hinge: 'LEFT', glazing: 'NONE' }], mullionWidth: 0.04 } })
    expect(badFraction.ok).toBe(false)
    if (!badFraction.ok) expect(badFraction.errors.map((e) => e.code)).toContain('DOOR_ASSEMBLY_INVALID')
    const notWall = applyCommand(m, { type: 'createSurfaceRegion', hostId: 'roof', rect: { a0: 0, a1: 1, b0: 0, b1: 1 }, materialId: 'timber' })
    expect(notWall.ok).toBe(false)
    if (!notWall.ok) expect(notWall.errors[0].code).toBe('SURFACE_REGION_HOST_INVALID')
    const noMat = applyCommand(m, { type: 'createSurfaceRegion', hostId: 'w', rect: { a0: 0, a1: 1, b0: 0, b1: 1 }, materialId: 'brick' })
    expect(noMat.ok).toBe(false)
    if (!noMat.ok) expect(noMat.errors[0].code).toBe('UNKNOWN_MATERIAL')
    const outside = applyCommand(m, { type: 'createSurfaceRegion', hostId: 'w', rect: { a0: 0, a1: 9, b0: 0, b1: 1 }, materialId: 'timber' })
    expect(outside.ok).toBe(false)
    if (!outside.ok) expect(outside.errors[0].code).toBe('SURFACE_REGION_OUTSIDE_HOST')
    // cascades: the wall takes its regions, the material takes its regions, and the region is a material taker
    const wallGone = applyCommand(m, { type: 'removeFeature', targetId: 'w' })
    expect(wallGone.ok && wallGone.removedIds).toContain('r')
    const matGone = applyCommand(m, { type: 'removeFeature', targetId: 'timber' })
    expect(matGone.ok && matGone.removedIds).toContain('r')
    expect(applyCommand(m, { type: 'removeFeature', targetId: 'timber', cascade: false }).ok).toBe(false)
  })
})
