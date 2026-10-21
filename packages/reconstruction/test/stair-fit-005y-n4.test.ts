/**
 * BUILDPLAN-ANALYZER-005Y-N4 (D): a stair in its shaft, on synthetic stairs (no project, no source image).
 *  - a landing climbed onto over its edge riser starts on that riser line: a U stair is two widths plus the
 *    goings between its riser lines deep, not a going more;
 *  - a stair running a few centimetres into the walls beside its flights stands against them; a wall the treads walk
 *    into (under a flight's start or arrival) is under the stair, not beside it; walls closer than the stair is wide
 *    by more than a contact residual leave it where it was read and name the conflict;
 *  - a partition under a flight stops at the flight's underside, stepped as the compiler builds it; one crossing the
 *    lowest steps is a conflict, and one the stair only grazes keeps its top.
 */
import { describe, expect, it } from 'vitest'
import { runCommands } from '@buildapp/commands'
import type { BuildingCommand } from '@buildapp/commands'
import { createEmptyModel, layoutStair } from '@buildapp/model'
import { compileBuilding, geometryClosureAudit } from '@buildapp/geometry'
import { fitStairToBoundingWalls, followStairSoffits, stairSnap, underStairProfile, STAIR_SNAP_MAX_M } from '../src/v2/stair-fit.js'

const G = 0.26
const W = 1
const head: BuildingCommand[] = [
  { type: 'createBuilding', id: 'b' },
  { type: 'createLevel', id: 'ground', index: 0, elevation: 0, height: 3.06 },
  { type: 'createLevel', id: 'upper', index: 1, elevation: 3.06, height: 2.7 },
]
// a U stair: 5 risers +x, a left-turning landing, 7 risers +z, a left-turning landing, 5 risers −x
const uStair = (onRiser: boolean, start = { x: 1, z: 1 }): BuildingCommand => ({
  type: 'createStair', id: 'st', levelId: 'ground', toLevelId: 'upper', start, direction: 'PLUS_X', width: W, waist: 0.15,
  segments: [
    { kind: 'FLIGHT', risers: 5, going: G },
    { kind: 'LANDING', length: W, turn: 'LEFT', ...(onRiser ? { onRiser: true as const } : {}) },
    { kind: 'FLIGHT', risers: 7, going: G },
    { kind: 'LANDING', length: W, turn: 'LEFT', ...(onRiser ? { onRiser: true as const } : {}) },
    { kind: 'FLIGHT', risers: 5, going: G },
  ],
})
const extentOf = (program: BuildingCommand[]) => {
  const m = runCommands(createEmptyModel('t', 't'), program)
  const s = m.stairs[0]
  if (s.kind !== 'FLIGHTS') throw new Error('not a flight stair')
  return layoutStair(s, m.levels[0], m.levels[1])
}

describe('a landing climbed onto over its edge riser', () => {
  it('starts on that riser line: the U is two widths and six goings deep, seventeen risers all the same', () => {
    const on = extentOf([...head, uStair(true)])
    const off = extentOf([...head, uStair(false)])
    const depth = (l: typeof on) => (l.extent ? l.extent.maxZ - l.extent.minZ : NaN)
    expect(depth(on)).toBeCloseTo(2 * W + 6 * G, 6)
    expect(depth(off)).toBeCloseTo(2 * W + 7 * G, 6)
    expect(on.risers).toBe(17)
    expect(on.riserHeight).toBeCloseTo(3.06 / 17, 9)
    // the riser onto each landing has no tread of its own; the arrival riser has none either
    expect(on.steps.filter((s) => s.tread === null).map((s) => s.riser)).toEqual([5, 12, 17])
  })
})

describe('the walls beside a stair', () => {
  // a quarter turn: a flight walking +x over x 0..1, a landing at x 1..2, a flight walking +z up x 1..2
  const extent = { minX: 0, maxX: 2, minZ: 0, maxZ: 4 }
  const cells = [
    { box: { minX: 0, maxX: 1, minZ: 0, maxZ: 1 }, travel: 'x' as const },
    { box: { minX: 1, maxX: 2, minZ: 0, maxZ: 1 }, travel: null },
    { box: { minX: 1, maxX: 2, minZ: 1, maxZ: 4 }, travel: 'z' as const },
  ]
  // a straight flight walking +x over x 0..3, z 0..1
  const straight = { extent: { minX: 0, maxX: 3, minZ: 0, maxZ: 1 }, cells: [{ box: { minX: 0, maxX: 3, minZ: 0, maxZ: 1 }, travel: 'x' as const }] }
  it('move it off the wall it runs into beside a flight, by that much', () => {
    const fit = stairSnap('st', extent, [{ id: 'side', box: { minX: 1.95, maxX: 2.3, minZ: -1, maxZ: 5 } }], cells)
    expect(fit).toMatchObject({ action: 'MOVED', dx: -0.05, dz: 0, bounding: ['side'] })
  })
  it('do not include a wall the treads walk into: it is under the stair', () => {
    const fit = stairSnap('st', extent, [{ id: 'under', box: { minX: 1.2, maxX: 1.8, minZ: 3.95, maxZ: 4.3 } }], cells)
    expect(fit).toMatchObject({ action: 'NONE', inside: ['under'] })
  })
  it('leave it in place, named, when walls on both sides leave less room than it takes', () => {
    const fit = stairSnap('st', straight.extent, [
      { id: 'near', box: { minX: -1, maxX: 4, minZ: -0.3, maxZ: 0.06 } },
      { id: 'far', box: { minX: -1, maxX: 4, minZ: 0.94, maxZ: 1.3 } },
    ], straight.cells)
    expect(fit.action).toBe('REFUSED')
  })
  it('split a contact residual between two sides, and say so', () => {
    const fit = stairSnap('st', straight.extent, [
      { id: 'near', box: { minX: -1, maxX: 4, minZ: -0.3, maxZ: 0.015 } },
      { id: 'far', box: { minX: -1, maxX: 4, minZ: 0.99, maxZ: 1.3 } },
    ], straight.cells)
    expect(fit.action).toBe('MOVED')
    expect(fit.dz).toBeCloseTo(0.0025, 6)
    expect(fit.why).toMatch(/less than the stair takes/)
  })
  it('never move it further than a reading’s uncertainty', () => {
    const fit = stairSnap('st', straight.extent, [{ id: 'deep', box: { minX: -1, maxX: 4, minZ: -0.3, maxZ: STAIR_SNAP_MAX_M + 0.05 } }], straight.cells)
    expect(fit.action).toBe('NONE')
    expect(fit.inside).toEqual(['deep'])
  })
})

describe('a partition under a flight', () => {
  const wall = { start: { x: 0, z: 2 }, end: { x: 3, z: 2 }, thickness: 0.12, height: 2.7, base: 0 }
  const body = { minX: 0, maxX: 3, minZ: 2, maxZ: 2.12 }
  it('stops at the underside of the cells above it, stepped', () => {
    const profile = underStairProfile(wall, body, [
      { box: { minX: 1, maxX: 1.5, minZ: 1.5, maxZ: 2.5 }, bottom: 1.2 },
      { box: { minX: 1.5, maxX: 2, minZ: 1.5, maxZ: 2.5 }, bottom: 1.4 },
    ])
    expect(profile).toEqual([
      { u: 0, height: 2.7 }, { u: 1, height: 2.7 },
      { u: 1, height: 1.2 }, { u: 1.5, height: 1.2 },
      { u: 1.5, height: 1.4 }, { u: 2, height: 1.4 },
      { u: 2, height: 2.7 }, { u: 3, height: 2.7 },
    ])
  })
  it('is a conflict, not a wall under the stair, where it crosses the lowest steps', () => {
    expect(underStairProfile(wall, body, [{ box: { minX: 1, maxX: 1.5, minZ: 1.5, maxZ: 2.5 }, bottom: 0.1 }])).toBe('TOO_LOW')
  })
  it('keeps its top where the stair only grazes its face', () => {
    expect(underStairProfile(wall, body, [{ box: { minX: 1, maxX: 1.5, minZ: 1, maxZ: 2.02 }, bottom: 1.2 }])).toBeNull()
  })
})

describe('a U stair in a shaft, end to end through the compiler', () => {
  // the shaft: a wall beside the first flight 6 cm into it, a partition across under the middle flight
  const program: BuildingCommand[] = [
    ...head,
    uStair(true),
    { type: 'createWall', id: 'beside', levelId: 'ground', start: { x: 0.5, z: -0.14 }, end: { x: 3.5, z: -0.14 }, thickness: 0.2, height: 3.06, kind: 'INTERIOR' },
    { type: 'createWall', id: 'under', levelId: 'ground', start: { x: 2.04, z: 3.2 }, end: { x: 3.04, z: 3.2 }, thickness: 0.12, height: 3.06, kind: 'INTERIOR' },
  ]
  it('stands against the wall beside it, the partition under it stops at its underside, and nothing intersects', () => {
    const before = geometryClosureAudit(runCommands(createEmptyModel('t', 't'), program), compileBuilding(runCommands(createEmptyModel('t', 't'), program)))
    expect(before.findings.filter((f) => f.code === 'INTERSECTION').length).toBeGreaterThan(0)
    const fitted = fitStairToBoundingWalls(program, 't', 't')
    const soffit = followStairSoffits(fitted.program, 't', 't')
    const m = runCommands(createEmptyModel('t', 't'), soffit.program)
    const after = geometryClosureAudit(m, compileBuilding(m))
    expect(after.findings.filter((f) => f.code === 'INTERSECTION')).toEqual([])
    expect(soffit.walls).toEqual([expect.objectContaining({ wallId: 'under', action: 'FOLLOWS_SOFFIT' })])
    expect(m.walls.find((w) => w.id === 'beside')?.topProfile).toBeUndefined()
  })
})
