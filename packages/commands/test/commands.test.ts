import { describe, expect, it } from 'vitest'
import { createEmptyModel, serializeModel, wallLength, type CanonicalBuildingModel } from '@buildapp/model'
import { BuildingSession, COMMAND_TYPES, applyCommand, runCommands, type BuildingCommand } from '../src/index.js'

const base = (): CanonicalBuildingModel =>
  runCommands(createEmptyModel('t', 't'), [
    { type: 'createBuilding', id: 'b' },
    { type: 'createLevel', id: 'ground', index: 0, elevation: 0, height: 3 },
    { type: 'createWall', id: 'w1', levelId: 'ground', start: { x: 0, z: 0 }, end: { x: 8, z: 0 }, thickness: 0.3, height: 2.8 },
  ])

describe('Building DSL', () => {
  it('exposes the required first command set', () => {
    for (const t of [
      'createBuilding',
      'createLevel',
      'createRoom',
      'createWall',
      'createSlab',
      'createRoof',
      'cutOpening',
      'placeWindow',
      'placeDoor',
      'createBalcony',
      'createRailing',
      'placeChimney',
      'moveFeature',
      'resizeFeature',
      'setProperty',
      'addConstraint',
      'removeFeature',
    ]) {
      expect(COMMAND_TYPES).toContain(t)
    }
  })

  it('creates semantic objects with references Window -> Opening -> Wall -> Level', () => {
    const m = runCommands(base(), [
      { type: 'cutOpening', id: 'o1', wallId: 'w1', kind: 'WINDOW', offset: 1, sill: 0.9, width: 1.2, height: 1.4 },
      { type: 'placeWindow', id: 'win1', openingId: 'o1' },
      { type: 'cutOpening', id: 'o2', wallId: 'w1', kind: 'DOOR', offset: 4, sill: 0, width: 1, height: 2.1 },
      { type: 'placeDoor', id: 'd1', openingId: 'o2', hingeSide: 'RIGHT', openAngle: 30 },
    ])
    expect(m.windows[0]).toMatchObject({ id: 'win1', openingId: 'o1', frameWidth: 0.07, divisions: 1 })
    expect(m.openings.find((o) => o.id === 'o1')?.wallId).toBe('w1')
    expect(m.walls[0].levelId).toBe('ground')
    expect(m.doors[0]).toMatchObject({ id: 'd1', hingeSide: 'RIGHT', swing: 'IN', openAngle: 30 })
  })

  it('generates deterministic ids when none is given', () => {
    const m = runCommands(base(), [
      { type: 'createWall', levelId: 'ground', start: { x: 0, z: 8 }, end: { x: 8, z: 8 }, thickness: 0.3, height: 2.8 },
      { type: 'createWall', levelId: 'ground', start: { x: 0, z: 4 }, end: { x: 8, z: 4 }, thickness: 0.3, height: 2.8 },
    ])
    expect(m.walls.map((w) => w.id)).toEqual(['w1', 'wall-1', 'wall-2'])
    const again = runCommands(base(), [
      { type: 'createWall', levelId: 'ground', start: { x: 0, z: 8 }, end: { x: 8, z: 8 }, thickness: 0.3, height: 2.8 },
      { type: 'createWall', levelId: 'ground', start: { x: 0, z: 4 }, end: { x: 8, z: 4 }, thickness: 0.3, height: 2.8 },
    ])
    expect(serializeModel(again)).toBe(serializeModel(m))
  })

  it('rejects invalid references with useful errors and leaves the model untouched', () => {
    const m = base()
    const r1 = applyCommand(m, { type: 'cutOpening', wallId: 'ghost', kind: 'WINDOW', offset: 1, sill: 1, width: 1, height: 1 })
    expect(r1.ok).toBe(false)
    if (!r1.ok) expect(r1.errors[0]).toMatchObject({ code: 'UNKNOWN_WALL' })
    const r2 = applyCommand(m, { type: 'placeWindow', openingId: 'nope' })
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.errors[0].code).toBe('UNKNOWN_OPENING')
    const r3 = applyCommand(m, { type: 'createWall', levelId: 'attic', start: { x: 0, z: 0 }, end: { x: 1, z: 0 }, thickness: 0.2, height: 2 })
    expect(r3.ok).toBe(false)
    if (!r3.ok) expect(r3.errors[0].code).toBe('UNKNOWN_LEVEL')
    expect(m.openings).toHaveLength(0)
    expect(m.windows).toHaveLength(0)
  })

  it('rejects geometrically impossible openings', () => {
    const m = base()
    const outside = applyCommand(m, { type: 'cutOpening', wallId: 'w1', kind: 'DOOR', offset: 7.5, sill: 0, width: 1, height: 2 })
    expect(outside.ok).toBe(false)
    if (!outside.ok) expect(outside.errors[0].code).toBe('OPENING_OUTSIDE_HOST')
    const tall = applyCommand(m, { type: 'cutOpening', wallId: 'w1', kind: 'DOOR', offset: 2, sill: 0, width: 1, height: 3.5 })
    expect(tall.ok).toBe(false)
    if (!tall.ok) expect(tall.errors[0].code).toBe('OPENING_OUTSIDE_HOST')
    const negative = applyCommand(m, { type: 'createWall', levelId: 'ground', start: { x: 0, z: 1 }, end: { x: 1, z: 1 }, thickness: 0.2, height: -2 })
    expect(negative.ok).toBe(false)
    if (!negative.ok) expect(negative.errors[0].code).toBe('INVALID_COMMAND')
  })

  it('setProperty validates against the object schema and never changes ids', () => {
    const m = base()
    const ok = applyCommand(m, { type: 'setProperty', targetId: 'w1', property: 'height', value: 3.2 })
    expect(ok.ok).toBe(true)
    if (ok.ok) {
      expect(ok.model.walls[0].height).toBe(3.2)
      expect(ok.changedIds).toEqual(['w1'])
      expect(m.walls[0].height).toBe(2.8)
    }
    const bad = applyCommand(m, { type: 'setProperty', targetId: 'w1', property: 'height', value: 'tall' })
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.errors[0].code).toBe('INVALID_PROPERTY')
    const nested = applyCommand(m, { type: 'setProperty', targetId: 'w1', property: 'start.x', value: 1 })
    expect(nested.ok).toBe(true)
    if (nested.ok) expect(nested.model.walls[0].start).toEqual({ x: 1, z: 0 })
    const id = applyCommand(m, { type: 'setProperty', targetId: 'w1', property: 'id', value: 'w9' })
    expect(id.ok).toBe(false)
  })

  it('moves and resizes features semantically', () => {
    const m = runCommands(base(), [
      { type: 'cutOpening', id: 'o1', wallId: 'w1', kind: 'WINDOW', offset: 1, sill: 0.9, width: 1.2, height: 1.4 },
      { type: 'moveFeature', targetId: 'o1', dAlong: 0.5, dy: 0.1 },
      { type: 'resizeFeature', targetId: 'o1', width: 1.5 },
      { type: 'moveFeature', targetId: 'w1', dx: 1, dz: 2 },
      { type: 'resizeFeature', targetId: 'w1', length: 6, thickness: 0.4 },
    ])
    expect(m.openings[0]).toMatchObject({ offset: 1.5, sill: 1.0, width: 1.5 })
    expect(m.walls[0].start).toEqual({ x: 1, z: 2 })
    expect(wallLength(m.walls[0])).toBeCloseTo(6, 12)
    expect(m.walls[0].thickness).toBe(0.4)
    const bad = applyCommand(m, { type: 'resizeFeature', targetId: 'o1', thickness: 1 })
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.errors[0].code).toBe('UNSUPPORTED_RESIZE')
    // moving the opening past the wall end is refused, not clamped
    const off = applyCommand(m, { type: 'moveFeature', targetId: 'o1', dAlong: 10 })
    expect(off.ok).toBe(false)
  })

  it('removeFeature cascades through dependants and reports every removed id', () => {
    const m = runCommands(base(), [
      { type: 'cutOpening', id: 'o1', wallId: 'w1', kind: 'WINDOW', offset: 1, sill: 0.9, width: 1.2, height: 1.4 },
      { type: 'placeWindow', id: 'win1', openingId: 'o1' },
      { type: 'addConstraint', id: 'c1', kind: 'NOTE', targetIds: ['w1', 'o1'], note: 'x' },
    ])
    const noCascade = applyCommand(m, { type: 'removeFeature', targetId: 'w1', cascade: false })
    expect(noCascade.ok).toBe(false)
    if (!noCascade.ok) expect(noCascade.errors[0].code).toBe('DEPENDANTS_EXIST')
    const r = applyCommand(m, { type: 'removeFeature', targetId: 'w1' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.removedIds.sort()).toEqual(['c1', 'o1', 'w1', 'win1'])
    expect(r.model.walls).toHaveLength(0)
    expect(r.model.openings).toHaveLength(0)
    expect(r.model.windows).toHaveLength(0)
    expect(r.model.constraints).toHaveLength(0)
  })

  it('createRoof caps the named walls with a FOLLOW_ROOF profile, and removing the roof releases them', () => {
    const m = runCommands(base(), [
      { type: 'createRoof', id: 'r1', levelId: 'ground', kind: 'GABLE', footprint: { minX: 0, maxX: 8, minZ: 0, maxZ: 6 }, eaveOffset: 2.8, pitchDeg: 40, capWallIds: ['w1'] },
    ])
    expect(m.walls[0].topProfile).toEqual({ kind: 'FOLLOW_ROOF', roofId: 'r1' })
    const r = applyCommand(m, { type: 'removeFeature', targetId: 'r1' })
    expect(r.ok && r.model.walls[0].topProfile).toEqual({ kind: 'FLAT' })
  })

  it('commands can arrive as plain JSON and are validated before use', () => {
    const json = JSON.parse('{"type":"createLevel","id":"upper","index":1,"elevation":3,"height":3}') as BuildingCommand
    expect(applyCommand(base(), json).ok).toBe(true)
    const junk = JSON.parse('{"type":"createLevel","index":"one"}') as BuildingCommand
    const r = applyCommand(base(), junk)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors[0].code).toBe('INVALID_COMMAND')
  })
})

describe('BuildingSession', () => {
  it('supports undo/redo and keeps a replayable log', () => {
    const s = new BuildingSession(base())
    const events: string[] = []
    s.subscribe((e) => events.push(e.type))
    s.execute({ type: 'setProperty', targetId: 'w1', property: 'height', value: 3.5 })
    s.execute({ type: 'cutOpening', id: 'o1', wallId: 'w1', kind: 'WINDOW', offset: 1, sill: 1, width: 1, height: 1 })
    expect(s.model.walls[0].height).toBe(3.5)
    expect(s.model.openings).toHaveLength(1)
    expect(s.log.map((e) => e.command.type)).toEqual(['setProperty', 'cutOpening'])
    expect(s.undo()).toBe(true)
    expect(s.model.openings).toHaveLength(0)
    expect(s.undo()).toBe(true)
    expect(s.model.walls[0].height).toBe(2.8)
    expect(s.canUndo).toBe(false)
    expect(s.redo()).toBe(true)
    expect(s.model.walls[0].height).toBe(3.5)
    expect(s.redo()).toBe(true)
    expect(s.model.openings).toHaveLength(1)
    expect(s.redo()).toBe(false)
    // a rejected command changes nothing and is not in the log
    const bad = s.execute({ type: 'placeWindow', openingId: 'ghost' })
    expect(bad.ok).toBe(false)
    expect(s.log).toHaveLength(2)
    expect(events).toEqual(['executed', 'executed', 'undo', 'undo', 'redo', 'redo', 'rejected'])
    // a new command after undo discards the redo branch
    s.undo()
    s.execute({ type: 'setModelName', name: 'renamed' })
    expect(s.canRedo).toBe(false)
  })
})
