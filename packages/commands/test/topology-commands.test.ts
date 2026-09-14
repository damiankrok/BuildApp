import { describe, expect, it } from 'vitest'
import { createEmptyModel, resolveWallTopology, serializeModel, type CanonicalBuildingModel } from '@buildapp/model'
import { applyCommand, runCommands, type BuildingCommand } from '../src/index.js'

const base = (): CanonicalBuildingModel =>
  runCommands(createEmptyModel('t', 't'), [
    { type: 'createBuilding', id: 'b' },
    { type: 'createLevel', id: 'ground', index: 0, elevation: 0, height: 3 },
  ])

const RECT = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 8 }, { x: 0, z: 8 }]

describe('createWallRing', () => {
  it('creates one wall per edge on the natural footprint, one corner per vertex and a ring record, with deterministic ids', () => {
    const m = runCommands(base(), [{ type: 'createWallRing', id: 'r', levelId: 'ground', polygon: RECT, thickness: 0.3, height: 3 }])
    expect(m.walls.map((w) => w.id)).toEqual(['r-w0', 'r-w1', 'r-w2', 'r-w3'])
    expect(m.wallJunctions.map((j) => j.id)).toEqual(['r-j0', 'r-j1', 'r-j2', 'r-j3'])
    expect(m.wallRings).toEqual([{ id: 'r', levelId: 'ground', wallIds: ['r-w0', 'r-w1', 'r-w2', 'r-w3'], junctionIds: ['r-j0', 'r-j1', 'r-j2', 'r-j3'] }])
    // the walls are untrimmed: their endpoints are the footprint corners
    expect(m.walls.map((w) => [w.start, w.end])).toEqual([
      [RECT[0], RECT[1]],
      [RECT[1], RECT[2]],
      [RECT[2], RECT[3]],
      [RECT[3], RECT[0]],
    ])
    // ALTERNATE ownership: front and rear own the corners
    expect(m.wallJunctions.map((j) => (j.kind === 'CORNER' ? j.owner : ''))).toEqual(['r-w0', 'r-w0', 'r-w2', 'r-w2'])
    expect(m.wallJunctions[1]).toMatchObject({ kind: 'CORNER', a: { wallId: 'r-w0', end: 'END' }, b: { wallId: 'r-w1', end: 'START' }, tolerance: 0.001 })
    const t = resolveWallTopology(m)
    expect(t.issues).toEqual([])
    expect(t.extents.get('r-w1')!.start.outer).toBe(0.3)
    expect(t.extents.get('r-w1')!.end.outer).toBe(7.7)
    // without a ring id the ids are still deterministic
    const anon = runCommands(base(), [{ type: 'createWallRing', levelId: 'ground', polygon: RECT, thickness: 0.3, height: 3 }])
    expect(anon.wallRings[0].id).toBe('ring-1')
    expect(anon.walls[0].id).toBe('ring-1-w0')
    expect(serializeModel(anon)).toBe(serializeModel(runCommands(base(), [{ type: 'createWallRing', levelId: 'ground', polygon: RECT, thickness: 0.3, height: 3 }])))
  })

  it('per-edge overrides name walls and change their height, thickness and material; ownership policies are honoured', () => {
    const m = runCommands(base(), [
      { type: 'defineMaterial', id: 'brick', name: 'brick', color: '#aa5533' },
      {
        type: 'createWallRing',
        id: 'r',
        levelId: 'ground',
        polygon: RECT,
        thickness: 0.3,
        height: 3,
        cornerOwnership: 'PRECEDING',
        walls: [{ id: 'front', name: 'Front' }, { id: 'right', height: 6, thickness: 0.5 }, { id: 'rear', materialId: 'brick' }, { id: 'left' }],
      },
    ])
    expect(m.walls.map((w) => w.id)).toEqual(['front', 'right', 'rear', 'left'])
    expect(m.walls[0].name).toBe('Front')
    expect(m.walls[1]).toMatchObject({ height: 6, thickness: 0.5 })
    expect(m.walls[2].materialId).toBe('brick')
    expect(m.wallJunctions.map((j) => (j.kind === 'CORNER' ? j.owner : ''))).toEqual(['left', 'front', 'right', 'rear'])
    const following = runCommands(base(), [{ type: 'createWallRing', id: 'r', levelId: 'ground', polygon: RECT, thickness: 0.3, height: 3, cornerOwnership: 'FOLLOWING' }])
    expect(following.wallJunctions.map((j) => (j.kind === 'CORNER' ? j.owner : ''))).toEqual(['r-w0', 'r-w1', 'r-w2', 'r-w3'])
  })

  it('a clockwise footprint is traversed the other way round so material lies inside, overrides following their edges', () => {
    const cw = [RECT[0], RECT[3], RECT[2], RECT[1]]
    const m = runCommands(base(), [
      { type: 'createWallRing', id: 'r', levelId: 'ground', polygon: cw, thickness: 0.3, height: 3, walls: [{ id: 'e0' }, { id: 'e1' }, { id: 'e2' }, { id: 'e3' }] },
    ])
    // clockwise edge 0 was (0,0)->(0,8); it is now the wall from (0,8) to (0,0)
    const e0 = m.walls.find((w) => w.id === 'e0')!
    expect([e0.start, e0.end]).toEqual([{ x: 0, z: 8 }, { x: 0, z: 0 }])
    const e3 = m.walls.find((w) => w.id === 'e3')!
    expect([e3.start, e3.end]).toEqual([{ x: 0, z: 0 }, { x: 10, z: 0 }])
    expect(resolveWallTopology(m).issues).toEqual([])
  })

  it('refuses a degenerate footprint', () => {
    const bow = applyCommand(base(), { type: 'createWallRing', levelId: 'ground', polygon: [{ x: 0, z: 0 }, { x: 2, z: 2 }, { x: 2, z: 0 }, { x: 0, z: 2 }], thickness: 0.3, height: 3 })
    expect(bow.ok).toBe(false)
    if (!bow.ok) expect(bow.errors[0].code).toBe('RING_DEGENERATE')
    const flat = applyCommand(base(), { type: 'createWallRing', levelId: 'ground', polygon: [{ x: 0, z: 0 }, { x: 5, z: 0 }, { x: 10, z: 0 }], thickness: 0.3, height: 3 })
    expect(flat.ok).toBe(false)
  })

  it('arrives as JSON like any other command', () => {
    const json = JSON.parse('{"type":"createWallRing","id":"r","levelId":"ground","polygon":[{"x":0,"z":0},{"x":6,"z":0},{"x":6,"z":4},{"x":0,"z":4}],"thickness":0.25,"height":2.8}') as BuildingCommand
    const r = applyCommand(base(), json)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.createdIds).toHaveLength(9)
  })
})

describe('createWall with inline junctions and createWallJunction', () => {
  const ring = (): CanonicalBuildingModel =>
    runCommands(base(), [{ type: 'createWallRing', id: 'r', levelId: 'ground', polygon: RECT, thickness: 0.3, height: 3, walls: [{ id: 'front' }, { id: 'right' }, { id: 'rear' }, { id: 'left' }] }])

  it('a partition stated from footprint line to footprint line enters with its T-junctions in one step', () => {
    const m = runCommands(ring(), [
      {
        type: 'createWall',
        id: 'p',
        levelId: 'ground',
        start: { x: 6, z: 8 },
        end: { x: 6, z: 0 },
        thickness: 0.12,
        height: 2.75,
        kind: 'INTERIOR',
        startJunction: { kind: 'T', againstWallId: 'rear' },
        endJunction: { kind: 'T', againstWallId: 'front' },
      },
    ])
    expect(m.wallJunctions.map((j) => j.id)).toContain('p-j-start')
    expect(m.wallJunctions.map((j) => j.id)).toContain('p-j-end')
    const t = resolveWallTopology(m)
    expect(t.issues).toEqual([])
    expect(t.extents.get('p')).toEqual({ start: { outer: 0.3, inner: 0.3 }, end: { outer: 7.7, inner: 7.7 } })
    // without the junctions the same wall is refused as an undeclared overlap
    const bare = applyCommand(ring(), { type: 'createWall', id: 'p', levelId: 'ground', start: { x: 6, z: 8 }, end: { x: 6, z: 0 }, thickness: 0.12, height: 2.75, kind: 'INTERIOR' })
    expect(bare.ok).toBe(false)
    if (!bare.ok) expect(bare.errors.map((e) => e.code)).toEqual(['WALLS_OVERLAP', 'WALLS_OVERLAP'])
  })

  it('an inline CORNER names the other wall end and who owns the corner', () => {
    const m = runCommands(base(), [
      { type: 'createWall', id: 'wa', levelId: 'ground', start: { x: 0, z: 0 }, end: { x: 10, z: 0 }, thickness: 0.3, height: 3 },
      { type: 'createWall', id: 'wb', levelId: 'ground', start: { x: 10, z: 0 }, end: { x: 10, z: 8 }, thickness: 0.3, height: 3, startJunction: { kind: 'CORNER', with: { wallId: 'wa', end: 'END' }, owner: 'OTHER', id: 'ab' } },
    ])
    expect(m.wallJunctions[0]).toEqual({ id: 'ab', kind: 'CORNER', a: { wallId: 'wb', end: 'START' }, b: { wallId: 'wa', end: 'END' }, owner: 'wa', tolerance: 0.001 })
    expect(resolveWallTopology(m).extents.get('wb')!.start.outer).toBe(0.3)
  })

  it('createWallJunction declares topology on walls that are already consistent, and validates its own shape', () => {
    // pre-trimmed walls (BUILDAPP-00 style) are valid without a junction; the junction makes the ownership explicit
    const m = runCommands(base(), [
      { type: 'createWall', id: 'wa', levelId: 'ground', start: { x: 0, z: 0 }, end: { x: 10, z: 0 }, thickness: 0.3, height: 3 },
      { type: 'createWall', id: 'wb', levelId: 'ground', start: { x: 10, z: 0.3 }, end: { x: 10, z: 8 }, thickness: 0.3, height: 3 },
      { type: 'createWallJunction', id: 'j', kind: 'CORNER', a: { wallId: 'wa', end: 'END' }, b: { wallId: 'wb', end: 'START' } },
    ])
    expect(m.wallJunctions[0]).toMatchObject({ owner: 'wa' })
    expect(resolveWallTopology(m).extents.get('wb')!.start).toEqual({ outer: 0, inner: 0 })
    const missing = applyCommand(m, { type: 'createWallJunction', kind: 'CORNER', a: { wallId: 'wa', end: 'START' } })
    expect(missing.ok).toBe(false)
    if (!missing.ok) expect(missing.errors[0].code).toBe('INVALID_COMMAND')
    const mixed = applyCommand(m, { type: 'createWallJunction', kind: 'T', wall: { wallId: 'wb', end: 'END' }, againstWallId: 'wa', owner: 'wa' })
    expect(mixed.ok).toBe(false)
    const dangling = applyCommand(m, { type: 'createWallJunction', kind: 'BUTT', wall: { wallId: 'wb', end: 'END' }, againstWallId: 'ghost' })
    expect(dangling.ok).toBe(false)
    if (!dangling.ok) expect(dangling.errors[0].code).toBe('UNKNOWN_WALL')
  })

  it('a corner junction whose walls gap or overshoot is refused with the measurement', () => {
    const m = runCommands(base(), [
      { type: 'createWall', id: 'wa', levelId: 'ground', start: { x: 0, z: 0 }, end: { x: 10, z: 0 }, thickness: 0.3, height: 3 },
      { type: 'createWall', id: 'wb', levelId: 'ground', start: { x: 10, z: 1 }, end: { x: 10, z: 8 }, thickness: 0.3, height: 3 },
    ])
    const r = applyCommand(m, { type: 'createWallJunction', kind: 'CORNER', a: { wallId: 'wa', end: 'END' }, b: { wallId: 'wb', end: 'START' } })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors[0].code).toBe('JUNCTION_GAP')
      expect(r.errors[0].message).toContain('0.700 m short')
    }
  })
})

describe('editing topology', () => {
  const house = (): CanonicalBuildingModel =>
    runCommands(base(), [
      { type: 'createWallRing', id: 'r', levelId: 'ground', polygon: RECT, thickness: 0.3, height: 3, walls: [{ id: 'front' }, { id: 'right' }, { id: 'rear' }, { id: 'left' }] },
      { type: 'createWall', id: 'p', levelId: 'ground', start: { x: 6, z: 8 }, end: { x: 6, z: 0 }, thickness: 0.12, height: 2.75, kind: 'INTERIOR', startJunction: { kind: 'T', againstWallId: 'rear' }, endJunction: { kind: 'T', againstWallId: 'front' } },
      { type: 'cutOpening', id: 'o', wallId: 'right', kind: 'WINDOW', offset: 2, sill: 0.9, width: 1.2, height: 1.4 },
    ])

  it('changing a wall thickness re-resolves the junctions; the ring stays closed', () => {
    const m = runCommands(house(), [{ type: 'setProperty', targetId: 'front', property: 'thickness', value: 0.5 }])
    const t = resolveWallTopology(m)
    expect(t.issues).toEqual([])
    expect(t.extents.get('right')!.start.outer).toBe(0.5)
    expect(t.extents.get('left')!.end.outer).toBeCloseTo(7.5, 12)
    expect(t.extents.get('p')!.end.outer).toBeCloseTo(7.5, 12)
  })

  it('changing a corner owner moves the corner block to the other wall', () => {
    const m = runCommands(house(), [{ type: 'setProperty', targetId: 'r-j1', property: 'owner', value: 'right' }])
    const t = resolveWallTopology(m)
    expect(t.extents.get('front')!.end.outer).toBeCloseTo(9.7, 12)
    expect(t.extents.get('right')!.start.outer).toBe(0)
    const bad = applyCommand(house(), { type: 'setProperty', targetId: 'r-j1', property: 'owner', value: 'rear' })
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.errors[0].code).toBe('JUNCTION_OWNER_NOT_PARTICIPANT')
  })

  it('moving or lengthening a ring wall on its own is refused (its corners would gap), not silently repaired', () => {
    const moved = applyCommand(house(), { type: 'moveFeature', targetId: 'front', dz: -1 })
    expect(moved.ok).toBe(false)
    if (!moved.ok) expect(moved.errors.map((e) => e.code)).toContain('JUNCTION_GAP')
    const longer = applyCommand(house(), { type: 'resizeFeature', targetId: 'front', length: 12 })
    expect(longer.ok).toBe(false)
    if (!longer.ok) expect(longer.errors.map((e) => e.code)).toContain('JUNCTION_OVERSHOOT')
    const unsupported = applyCommand(house(), { type: 'moveFeature', targetId: 'r-j1', dx: 1 })
    expect(unsupported.ok).toBe(false)
    if (!unsupported.ok) expect(unsupported.errors[0].code).toBe('UNSUPPORTED_TARGET')
  })

  it('an opening cannot move into a consumed junction zone', () => {
    const r = applyCommand(house(), { type: 'moveFeature', targetId: 'o', dAlong: -1.8 })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors[0].code).toBe('OPENING_IN_JUNCTION_ZONE')
      expect(r.errors[0].message).toContain('0.100 m into a consumed junction zone')
    }
    expect(applyCommand(house(), { type: 'moveFeature', targetId: 'o', dAlong: -1.65 }).ok).toBe(true)
  })

  it('removing a wall cascades to its junctions and rings; removing a corner alone is refused because the walls would overlap', () => {
    const r = applyCommand(house(), { type: 'removeFeature', targetId: 'right' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.removedIds.sort()).toEqual(['o', 'r', 'r-j1', 'r-j2', 'right'])
      expect(r.model.wallRings).toHaveLength(0)
      expect(r.model.wallJunctions.map((j) => j.id).sort()).toEqual(['p-j-end', 'p-j-start', 'r-j0', 'r-j3'])
    }
    const j = applyCommand(house(), { type: 'removeFeature', targetId: 'r-j1' })
    expect(j.ok).toBe(false)
    if (!j.ok) expect(j.errors[0].code).toBe('WALLS_OVERLAP')
    const noCascade = applyCommand(house(), { type: 'removeFeature', targetId: 'r-j1', cascade: false })
    expect(noCascade.ok).toBe(false)
    if (!noCascade.ok) expect(noCascade.errors[0].code).toBe('DEPENDANTS_EXIST')
    // the ring record itself is only a grouping: removing it keeps walls and junctions
    const ring = applyCommand(house(), { type: 'removeFeature', targetId: 'r' })
    expect(ring.ok).toBe(true)
    if (ring.ok) expect(ring.model.wallJunctions).toHaveLength(6)
  })
})
