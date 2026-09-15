import { describe, expect, it } from 'vitest'
import { createEmptyModel, openingHeadAt, openingHeadRange, openingIsRaked, validateModel, type CanonicalBuildingModel } from '../src/index.js'

/** A house with two parallel walls (a cavity stated as two leaves), a gable roof and a chimney. */
function house(): CanonicalBuildingModel {
  const m = createEmptyModel('m', 'raked and roof openings')
  m.building = { id: 'b' }
  m.levels.push({ id: 'ground', buildingId: 'b', index: 0, elevation: 0, height: 3 })
  m.walls.push({ id: 'outer', levelId: 'ground', start: { x: 0, z: 0 }, end: { x: 8, z: 0 }, thickness: 0.3, height: 5, baseOffset: 0, kind: 'EXTERIOR' })
  m.walls.push({ id: 'inner', levelId: 'ground', start: { x: 0, z: 0.3 }, end: { x: 8, z: 0.3 }, thickness: 0.15, height: 5, baseOffset: 0, kind: 'INTERIOR' })
  m.walls.push({ id: 'side', levelId: 'ground', start: { x: 10, z: 2 }, end: { x: 10, z: 6 }, thickness: 0.3, height: 3, baseOffset: 0, kind: 'EXTERIOR' })
  m.roofs.push({ id: 'roof', levelId: 'ground', kind: 'GABLE', footprint: { minX: 0, maxX: 8, minZ: 0, maxZ: 6 }, eaveOffset: 3, pitchDeg: 40, ridgeAxis: 'Z', overhang: 0, thickness: 0.2 })
  m.chimneys.push({ id: 'ch', levelId: 'ground', footprint: { minX: 5, maxX: 5.6, minZ: 2, maxZ: 2.6 }, baseOffset: 0, height: 7 })
  return m
}

const codes = (m: unknown): string[] => validateModel(m).issues.map((i) => i.code)

describe('raked-head openings (schema 1.2.0)', () => {
  it('a raked head is a trapezoid: the head height varies linearly across the opening', () => {
    const o = { id: 'o', wallId: 'outer', kind: 'WINDOW' as const, offset: 2, sill: 0.5, width: 2, height: 3, head: { kind: 'RAKED' as const, heightFar: 1 } }
    expect(openingIsRaked(o)).toBe(true)
    expect(openingHeadAt(o, 2)).toBeCloseTo(3.5, 12)
    expect(openingHeadAt(o, 4)).toBeCloseTo(1.5, 12)
    expect(openingHeadAt(o, 3)).toBeCloseTo(2.5, 12)
    expect(openingHeadAt(o, -5)).toBeCloseTo(3.5, 12)
    expect(openingHeadRange(o)).toEqual({ min: 1.5, max: 3.5 })
    expect(openingIsRaked({ ...o, head: { kind: 'LEVEL' } })).toBe(false)
    expect(openingHeadAt({ ...o, head: undefined }, 3)).toBe(3.5)
  })

  it('validates a raked opening against its host using its tallest edge and refuses a door in it', () => {
    const m = house()
    m.openings.push({ id: 'o', wallId: 'outer', kind: 'WINDOW', offset: 2, sill: 0, width: 2, height: 3, head: { kind: 'RAKED', heightFar: 1 } })
    expect(codes(m)).toEqual([])
    m.openings[0].head = { kind: 'RAKED', heightFar: 5.2 }
    expect(codes(m)).toContain('OPENING_OUTSIDE_HOST')
    m.openings[0].head = { kind: 'RAKED', heightFar: 1 }
    m.doors.push({ id: 'd', openingId: 'o', hingeSide: 'LEFT', swing: 'IN', openAngle: 0, leafThickness: 0.04, frameWidth: 0.06, frameDepth: 0.1, frameInset: 0.1 })
    m.openings[0].kind = 'DOOR'
    expect(codes(m)).toContain('FILL_PROFILE_UNSUPPORTED')
  })

  it('a window frame must leave glazing at the lowest edge of a raked opening; mullion fractions must increase', () => {
    const m = house()
    m.openings.push({ id: 'o', wallId: 'outer', kind: 'WINDOW', offset: 2, sill: 0, width: 2, height: 3, head: { kind: 'RAKED', heightFar: 0.3 } })
    m.windows.push({ id: 'w', openingId: 'o', frameWidth: 0.2, frameDepth: 0.08, frameInset: 0.1, glassThickness: 0.02, divisions: 1 })
    expect(codes(m)).toContain('FILL_TOO_LARGE')
    m.windows[0].frameWidth = 0.05
    expect(codes(m)).toEqual([])
    m.windows[0].mullions = [0.3, 0.3]
    expect(codes(m)).toContain('SCHEMA')
    m.windows[0].mullions = [0.3, 0.7]
    expect(codes(m)).toEqual([])
  })
})

describe('multi-leaf openings (schema 1.2.0)', () => {
  it('one opening cuts every leaf it names; each leaf is checked in its own wall', () => {
    const m = house()
    m.openings.push({ id: 'p', wallId: 'outer', kind: 'DOOR', offset: 3, sill: 0, width: 1, height: 2.1, leaves: [{ wallId: 'inner', offset: 3 }] })
    expect(codes(m)).toEqual([])
    m.openings[0].leaves = [{ wallId: 'inner', offset: 7.5 }]
    expect(codes(m)).toContain('OPENING_OUTSIDE_HOST')
    m.openings[0].leaves = [{ wallId: 'ghost', offset: 3 }]
    expect(codes(m)).toContain('UNKNOWN_WALL')
    m.openings[0].leaves = [{ wallId: 'outer', offset: 3 }]
    expect(codes(m)).toContain('OPENING_LEAF_INVALID')
    m.openings[0].leaves = [{ wallId: 'side', offset: 1 }]
    expect(codes(m)).toContain('OPENING_LEAF_NOT_PARALLEL')
    m.levels.push({ id: 'upper', buildingId: 'b', index: 1, elevation: 3, height: 3 })
    m.walls.push({ id: 'up', levelId: 'upper', start: { x: 0, z: 0.3 }, end: { x: 8, z: 0.3 }, thickness: 0.15, height: 3, baseOffset: 2.1, kind: 'INTERIOR' })
    m.openings[0].leaves = [{ wallId: 'up', offset: 3 }]
    expect(codes(m)).toContain('OPENING_LEAF_LEVEL_MISMATCH')
  })

  it('a leaf cut takes part in the per-wall overlap check', () => {
    const m = house()
    m.openings.push({ id: 'p', wallId: 'outer', kind: 'DOOR', offset: 3, sill: 0, width: 1, height: 2.1, leaves: [{ wallId: 'inner', offset: 3 }] })
    m.openings.push({ id: 'q', wallId: 'inner', kind: 'WINDOW', offset: 3.5, sill: 1, width: 1, height: 1 })
    expect(codes(m)).toContain('OPENINGS_OVERLAP')
  })
})

describe('roof openings and rooflights (schema 1.2.0)', () => {
  it('a rooflight opening inside one slope validates; outside the roof, across the ridge or overlapping is refused by name', () => {
    const m = house()
    m.roofOpenings.push({ id: 'ro', roofId: 'roof', kind: 'ROOFLIGHT', footprint: { minX: 1, maxX: 1.8, minZ: 2, maxZ: 3 } })
    m.rooflights.push({ id: 'rl', roofOpeningId: 'ro', frameWidth: 0.07, glassThickness: 0.02 })
    expect(codes(m)).toEqual([])
    m.roofOpenings[0].footprint = { minX: 3.5, maxX: 4.5, minZ: 2, maxZ: 3 }
    expect(codes(m)).toContain('ROOF_OPENING_CROSSES_RIDGE')
    m.roofOpenings[0].footprint = { minX: 7.5, maxX: 8.5, minZ: 2, maxZ: 3 }
    expect(codes(m)).toContain('ROOF_OPENING_OUTSIDE_HOST')
    m.roofOpenings[0].footprint = { minX: 1, maxX: 1.8, minZ: 2, maxZ: 3 }
    m.roofOpenings.push({ id: 'ro2', roofId: 'roof', kind: 'ROOFLIGHT', footprint: { minX: 1.5, maxX: 2.3, minZ: 2.5, maxZ: 3.5 } })
    expect(codes(m)).toContain('ROOF_OPENINGS_OVERLAP')
    m.roofOpenings.pop()
    m.roofOpenings[0].roofId = 'nope'
    expect(codes(m)).toContain('UNKNOWN_ROOF')
    m.roofOpenings[0].roofId = 'roof'
    m.rooflights[0].roofOpeningId = 'ghost'
    expect(codes(m)).toContain('UNKNOWN_ROOF_OPENING')
    m.rooflights[0].roofOpeningId = 'ro'
    m.rooflights.push({ id: 'rl2', roofOpeningId: 'ro', frameWidth: 0.07, glassThickness: 0.02 })
    expect(codes(m)).toContain('ROOF_OPENING_FILLED_TWICE')
    m.rooflights.pop()
    m.rooflights[0].frameWidth = 0.4
    expect(codes(m)).toContain('FILL_TOO_LARGE')
  })

  it('a penetration names the chimney that passes through it and must contain its footprint', () => {
    const m = house()
    m.roofOpenings.push({ id: 'pen', roofId: 'roof', kind: 'PENETRATION', footprint: { minX: 5, maxX: 5.6, minZ: 2, maxZ: 2.6 }, throughId: 'ch' })
    expect(codes(m)).toEqual([])
    m.roofOpenings[0].footprint = { minX: 5, maxX: 5.5, minZ: 2, maxZ: 2.6 }
    expect(codes(m)).toContain('ROOF_PENETRATION_MISMATCH')
    m.roofOpenings[0].footprint = { minX: 5, maxX: 5.6, minZ: 2, maxZ: 2.6 }
    m.roofOpenings[0].throughId = 'outer'
    expect(codes(m)).toContain('ROOF_PENETRATION_MISMATCH')
    m.roofOpenings[0].throughId = 'nobody'
    expect(codes(m)).toContain('UNKNOWN_TARGET')
    m.roofOpenings[0].throughId = 'ch'
    m.roofOpenings[0].kind = 'ROOFLIGHT'
    expect(codes(m)).toContain('ROOF_PENETRATION_MISMATCH')
    m.rooflights.push({ id: 'rl', roofOpeningId: 'pen', frameWidth: 0.07, glassThickness: 0.02 })
    m.roofOpenings[0].kind = 'PENETRATION'
    expect(codes(m)).toContain('FILL_KIND_MISMATCH')
  })
})
