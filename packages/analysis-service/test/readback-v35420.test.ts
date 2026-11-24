/**
 * v3.54.20 — what was built, read back from the model: an opening in its host wall's frame (the stretches of the wall add
 * up, the hand of the wall's start is stated), held against what the executor bound; the bodies beside the taken structure.
 * Controlled models through the kernel's own commands.
 */
import { describe, expect, it } from 'vitest'
import { applyCommands } from '@buildapp/commands'
import type { BuildingCommand } from '@buildapp/commands'
import { createEmptyModel } from '@buildapp/model'
import type { CanonicalBuildingModel } from '@buildapp/model'
import { READBACK_TOLERANCE_M, readbackOpenings, readbackStructure } from '../src/consult/readback.js'
import { CHIMNEY_WALL_CLEAR_M, clearOfWalls } from '../src/consult/correct/execute.js'

const house = (extra: BuildingCommand[] = []): CanonicalBuildingModel => {
  const r = applyCommands(createEmptyModel('m', 'control'), [
    { type: 'createBuilding', id: 'b', name: 'control' },
    { type: 'createLevel', id: 'l0', name: 'Ground', index: 0, elevation: 0, height: 2.8 },
    { type: 'createWallRing', id: 'ring-mass-main', levelId: 'l0', polygon: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 8 }, { x: 0, z: 8 }], thickness: 0.3, height: 2.8, baseOffset: 0, kind: 'EXTERIOR', cornerOwnership: 'ALTERNATE' },
    ...extra,
  ] as BuildingCommand[])
  if (r.failedAt !== undefined) throw new Error(`fixture: ${JSON.stringify(r.results[r.failedAt])}`)
  return r.model
}
const frontWall = (m: CanonicalBuildingModel): string => (m.walls.find((w) => Math.abs(w.start.z) < 1e-6 && Math.abs(w.end.z) < 1e-6) as CanonicalBuildingModel['walls'][number]).id

describe('v3.54.20 an opening read back from the delivered model', () => {
  it('stands in its host wall\'s frame: from the start corner, its width, to the end corner — the three add up to the wall', () => {
    const m0 = house()
    const wallId = frontWall(m0)
    const m = house([{ type: 'cutOpening', id: 'op-1', wallId, kind: 'WINDOW', offset: 2.5, width: 1.8, sill: 0.9, height: 1.5 }] as BuildingCommand[])
    const rb = readbackOpenings(m, [{ status: 'COMMITTED', operation: 'ADD_OPENING', origin: 'SKETCH', proposalId: 'p1', bound: { ids: ['op-1'], hostId: wallId, side: 'FRONT', values: { offset: 2.5, width: 1.8, sill: 0.9, height: 1.5 } } }])
    expect(rb.openings).toHaveLength(1)
    const o = rb.openings[0]
    expect([o.wallLengthM, o.fromStartM, o.widthM, o.toEndM]).toEqual([10, 2.5, 1.8, 5.7])
    expect(o.fromStartM + o.widthM + o.toEndM).toBeCloseTo(o.wallLengthM, 6)
    expect(Math.abs(o.sumErrorM)).toBeLessThanOrEqual(READBACK_TOLERANCE_M)
    expect([o.sillM, o.heightM, o.headM, o.sillAboveZeroM]).toEqual([0.9, 1.5, 2.4, 0.9])
    expect(o.agrees).toBe(true)
    expect(rb.counts).toMatchObject({ built: 1, bound: 1, agree: 1, differ: 0, unbound: 0, sumFailures: 0, outsideWall: 0 })
  })
  it('the hand of the wall\'s start is the one a person OUTSIDE sees: opposite walls of one house do not share it by accident', () => {
    const m = house()
    const front = m.walls.find((w) => Math.abs(w.start.z) < 1e-6 && Math.abs(w.end.z) < 1e-6) as CanonicalBuildingModel['walls'][number]
    const rear = m.walls.find((w) => Math.abs(w.start.z - 8) < 1e-6 && Math.abs(w.end.z - 8) < 1e-6) as CanonicalBuildingModel['walls'][number]
    const cut = (wallId: string, id: string): BuildingCommand => ({ type: 'cutOpening', id, wallId, kind: 'WINDOW', offset: 1, width: 1, sill: 0.9, height: 1.2 }) as BuildingCommand
    const rb = readbackOpenings(house([cut(front.id, 'f'), cut(rear.id, 'r')]), [])
    const hand = (id: string): string => (rb.openings.find((q) => q.id === id) as (typeof rb.openings)[number]).startIs
    // the front wall starts at x = 0 or x = 10; seen from outside the front, x = 0 is on the LEFT (the body's frame)
    expect(hand('f')).toBe(front.start.x < front.end.x ? 'LEFT' : 'RIGHT')
    // seen from outside the REAR, x = 0 is on the RIGHT
    expect(hand('r')).toBe(rear.start.x < rear.end.x ? 'RIGHT' : 'LEFT')
  })
  it('counter-trials: a built value that is not the bound one is named with its difference; an opening no record bound has no verdict', () => {
    const m0 = house()
    const wallId = frontWall(m0)
    const m = house([{ type: 'cutOpening', id: 'op-1', wallId, kind: 'DOOR', offset: 4, width: 1, sill: 0, height: 2.1 }, { type: 'cutOpening', id: 'op-2', wallId, kind: 'WINDOW', offset: 7, width: 1.2, sill: 0.9, height: 1.2 }] as BuildingCommand[])
    const rb = readbackOpenings(m, [{ status: 'COMMITTED', operation: 'ADD_OPENING', bound: { ids: ['op-1'], values: { offset: 4.3, width: 1, sill: 0, height: 2.1 } } }, { status: 'ROLLED_BACK', operation: 'ADD_OPENING', bound: { ids: ['op-2'], values: { offset: 7, width: 1.2, sill: 0.9, height: 1.2 } } }])
    const [a, b] = [rb.openings.find((q) => q.id === 'op-1'), rb.openings.find((q) => q.id === 'op-2')]
    expect(a?.agrees).toBe(false)
    expect(a?.delta?.offset).toBeCloseTo(-0.3, 6)
    expect(b?.agrees).toBeNull()
    expect(b?.bound).toBeUndefined()
    expect(rb.counts).toMatchObject({ built: 2, bound: 1, agree: 0, differ: 1, unbound: 1 })
  })
})

describe('v3.54.20 the bodies read back beside the taken structure', () => {
  it('a gable along X over one ring: its kind, ridge, wall top and ridge height are the model\'s; the taken structure is checked property by property', () => {
    const m0 = house()
    const m = house([{ type: 'createRoof', id: 'roof-mass-main', levelId: 'l0', kind: 'GABLE', footprint: { minX: 0, maxX: 10, minZ: 0, maxZ: 8 }, eaveOffset: 3, pitchDeg: 30, ridgeAxis: 'X', overhang: 0, thickness: 0.25, capWallIds: m0.walls.map((w) => w.id) }] as BuildingCommand[])
    const sb = readbackStructure(m, { fullStoreys: 1, mainRoof: 'GABLE', mainRidge: 'X', parts: [] }, { twoMinM: 4.4, oneMaxM: 4.6 })
    expect(sb.bodies).toHaveLength(1)
    expect(sb.bodies[0]).toMatchObject({ roof: 'GABLE', ridgeAxis: 'X', pitchDeg: 30, widthM: 10, depthM: 8 })
    expect(sb.bodies[0].ridgeM).toBeCloseTo(3 + 4 * Math.tan(Math.PI / 6), 2)
    expect(sb.checks.every((q) => q.agrees)).toBe(true)
    // counter-trial: the same model against a structure that asked for a hip, two storeys and a garage
    const bad = readbackStructure(m, { fullStoreys: 2, mainRoof: 'HIP', mainRidge: 'X', parts: [{ what: 'GARAGE', where: 'RIGHT' }] }, { twoMinM: 4.4, oneMaxM: 4.6 })
    expect(bad.checks.filter((q) => !q.agrees).map((q) => q.property).sort()).toEqual(['bodies', 'mainRoof.kind', 'storeys'])
  })
  it('a body with no roof is listed as such, and nothing is checked where no structure was taken', () => {
    const sb = readbackStructure(house(), undefined, { twoMinM: 4.4, oneMaxM: 4.6 })
    expect(sb.bodies).toEqual([{ id: 'ring-mass-main', widthM: 10, depthM: 8, roof: 'NONE' }])
    expect(sb.checks).toEqual([])
  })
})

describe('v3.54.20 a chimney stands inside the walls of its body', () => {
  it('REPRODUCES the loss: a stack whose face lies in the front wall\'s plane is slid just inside that wall, along the axis its elevation does not show', () => {
    const m = house()
    const f = clearOfWalls(m, { minX: 4, maxX: 4.6, minZ: 0, maxZ: 0.6 }, 'z')
    expect(f.minZ).toBeCloseTo(0.3 + CHIMNEY_WALL_CLEAR_M, 6)
    expect(f.maxZ - f.minZ).toBeCloseTo(0.6, 6)
    expect([f.minX, f.maxX]).toEqual([4, 4.6])
    const rear = clearOfWalls(m, { minX: 4, maxX: 4.6, minZ: 7.7, maxZ: 8.3 }, 'z')
    expect(rear.maxZ).toBeCloseTo(8 - 0.3 - CHIMNEY_WALL_CLEAR_M, 6)
  })
  it('counter-trials: a stack already inside is not moved; one over no body, or wider than the room between the walls, is left as drawn', () => {
    const m = house()
    const inside = { minX: 4, maxX: 4.6, minZ: 3, maxZ: 3.6 }
    expect(clearOfWalls(m, inside, 'z')).toEqual(inside)
    const away = { minX: 20, maxX: 20.6, minZ: 0, maxZ: 0.6 }
    expect(clearOfWalls(m, away, 'z')).toEqual(away)
    const wide = { minX: 4, maxX: 4.6, minZ: 0, maxZ: 7.9 }
    expect(clearOfWalls(m, wide, 'z')).toEqual(wide)
  })
})
