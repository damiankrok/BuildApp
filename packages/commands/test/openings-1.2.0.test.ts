import { describe, expect, it } from 'vitest'
import { createEmptyModel, serializeModel, type CanonicalBuildingModel } from '@buildapp/model'
import { COMMAND_TYPES, applyCommand, runCommands } from '../src/index.js'

/** Two parallel walls back to back, a gable roof and a chimney. */
const base = (): CanonicalBuildingModel =>
  runCommands(createEmptyModel('t', 't'), [
    { type: 'createBuilding', id: 'b' },
    { type: 'createLevel', id: 'ground', index: 0, elevation: 0, height: 3 },
    { type: 'createWall', id: 'outer', levelId: 'ground', start: { x: 0, z: 0 }, end: { x: 8, z: 0 }, thickness: 0.3, height: 5 },
    { type: 'createWall', id: 'inner', levelId: 'ground', start: { x: 8, z: 0.45 }, end: { x: 0, z: 0.45 }, thickness: 0.15, height: 5, kind: 'INTERIOR' },
    { type: 'createRoof', id: 'roof', levelId: 'ground', kind: 'GABLE', footprint: { minX: 0, maxX: 8, minZ: 0, maxZ: 6 }, eaveOffset: 3, pitchDeg: 40, ridgeAxis: 'Z', thickness: 0.2 },
    { type: 'placeChimney', id: 'ch', levelId: 'ground', footprint: { minX: 5, maxX: 5.6, minZ: 2, maxZ: 2.6 }, height: 7 },
  ])

describe('Building DSL — schema 1.2.0 primitives', () => {
  it('exposes the roof-opening commands', () => {
    expect(COMMAND_TYPES).toContain('cutRoofOpening')
    expect(COMMAND_TYPES).toContain('placeRooflight')
  })

  it('cutOpening takes a raked head and further leaves; placeWindow takes mullion fractions', () => {
    const m = runCommands(base(), [
      { type: 'cutOpening', id: 'g', wallId: 'outer', kind: 'WINDOW', offset: 2, sill: 0, width: 2, height: 3, head: { kind: 'RAKED', heightFar: 1.2 } },
      { type: 'placeWindow', id: 'w', openingId: 'g', mullions: [0.4] },
      { type: 'cutOpening', id: 'p', wallId: 'outer', kind: 'DOOR', offset: 5, sill: 0, width: 1, height: 2.1, leaves: [{ wallId: 'inner', offset: 2 }] },
      { type: 'placeDoor', id: 'd', openingId: 'p' },
    ])
    expect(m.openings.find((o) => o.id === 'g')!.head).toEqual({ kind: 'RAKED', heightFar: 1.2 })
    expect(m.windows[0].mullions).toEqual([0.4])
    expect(m.openings.find((o) => o.id === 'p')!.leaves).toEqual([{ wallId: 'inner', offset: 2 }])
    // the inner wall runs the other way, so the leaf offset 2 puts the passage at x 5..6 on both walls
    const rejected = applyCommand(m, { type: 'placeDoor', openingId: 'g' })
    expect(rejected.ok).toBe(false)
    if (!rejected.ok) expect(rejected.errors.map((e) => e.code)).toContain('FILL_KIND_MISMATCH')
    const notParallel = applyCommand(m, { type: 'cutOpening', wallId: 'outer', kind: 'DOOR', offset: 1, sill: 0, width: 0.8, height: 2, leaves: [{ wallId: 'ghost', offset: 1 }] })
    expect(notParallel.ok).toBe(false)
    if (!notParallel.ok) expect(notParallel.errors[0].code).toBe('UNKNOWN_WALL')
  })

  it('moving a multi-leaf opening moves every leaf so the passage stays aligned, whichever way the leaf wall runs', () => {
    const m = runCommands(base(), [
      { type: 'cutOpening', id: 'p', wallId: 'outer', kind: 'DOOR', offset: 5, sill: 0, width: 1, height: 2.1, leaves: [{ wallId: 'inner', offset: 2 }] },
      { type: 'moveFeature', targetId: 'p', dAlong: 0.5 },
    ])
    const p = m.openings[0]
    expect(p.offset).toBe(5.5)
    // the inner wall runs -x, so the same world shift is -0.5 along it
    expect(p.leaves![0].offset).toBeCloseTo(1.5, 12)
  })

  it('cutRoofOpening and placeRooflight create referenced objects; a penetration names its chimney', () => {
    const m = runCommands(base(), [
      { type: 'cutRoofOpening', id: 'rl-op', roofId: 'roof', kind: 'ROOFLIGHT', footprint: { minX: 1, maxX: 1.78, minZ: 2, maxZ: 3.2 } },
      { type: 'placeRooflight', id: 'rl', roofOpeningId: 'rl-op' },
      { type: 'cutRoofOpening', id: 'pen', roofId: 'roof', kind: 'PENETRATION', footprint: { minX: 5, maxX: 5.6, minZ: 2, maxZ: 2.6 }, throughId: 'ch' },
    ])
    expect(m.roofOpenings.map((o) => o.id)).toEqual(['rl-op', 'pen'])
    expect(m.rooflights[0]).toMatchObject({ id: 'rl', roofOpeningId: 'rl-op', frameWidth: 0.07, glassThickness: 0.024 })
    expect(m.roofOpenings[1].throughId).toBe('ch')
    const bad = applyCommand(m, { type: 'cutRoofOpening', roofId: 'roof', kind: 'ROOFLIGHT', footprint: { minX: 3.5, maxX: 4.5, minZ: 4, maxZ: 5 } })
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.errors[0].code).toBe('ROOF_OPENING_CROSSES_RIDGE')
    const twice = applyCommand(m, { type: 'placeRooflight', roofOpeningId: 'rl-op' })
    expect(twice.ok).toBe(false)
    if (!twice.ok) expect(twice.errors[0].code).toBe('ROOF_OPENING_FILLED_TWICE')
    // ids are deterministic and the model round-trips
    const anon = runCommands(base(), [{ type: 'cutRoofOpening', roofId: 'roof', kind: 'ROOFLIGHT', footprint: { minX: 1, maxX: 1.78, minZ: 2, maxZ: 3.2 } }, { type: 'placeRooflight', roofOpeningId: 'roof-opening-1' }])
    expect(anon.roofOpenings[0].id).toBe('roof-opening-1')
    expect(anon.rooflights[0].id).toBe('rooflight-1')
    expect(serializeModel(anon)).toContain('"schemaVersion": "1.3.0"')
  })

  it('removal cascades roof -> roof openings -> rooflights and chimney -> its penetration; a leaf wall removal keeps the opening', () => {
    const m = runCommands(base(), [
      { type: 'cutRoofOpening', id: 'rl-op', roofId: 'roof', kind: 'ROOFLIGHT', footprint: { minX: 1, maxX: 1.78, minZ: 2, maxZ: 3.2 } },
      { type: 'placeRooflight', id: 'rl', roofOpeningId: 'rl-op' },
      { type: 'cutRoofOpening', id: 'pen', roofId: 'roof', kind: 'PENETRATION', footprint: { minX: 5, maxX: 5.6, minZ: 2, maxZ: 2.6 }, throughId: 'ch' },
      { type: 'cutOpening', id: 'p', wallId: 'outer', kind: 'DOOR', offset: 5, sill: 0, width: 1, height: 2.1, leaves: [{ wallId: 'inner', offset: 2 }] },
    ])
    const r = applyCommand(m, { type: 'removeFeature', targetId: 'roof' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.removedIds.sort()).toEqual(['pen', 'rl', 'rl-op', 'roof'])
      expect(r.model.roofOpenings).toEqual([])
      expect(r.model.rooflights).toEqual([])
    }
    const c = applyCommand(m, { type: 'removeFeature', targetId: 'ch' })
    expect(c.ok).toBe(true)
    if (c.ok) expect(c.removedIds.sort()).toEqual(['ch', 'pen'])
    const noCascade = applyCommand(m, { type: 'removeFeature', targetId: 'rl-op', cascade: false })
    expect(noCascade.ok).toBe(false)
    const leaf = applyCommand(m, { type: 'removeFeature', targetId: 'inner' })
    expect(leaf.ok).toBe(true)
    if (leaf.ok) {
      expect(leaf.model.openings[0].leaves).toBeUndefined()
      expect(leaf.changedIds).toContain('p')
    }
  })
})
