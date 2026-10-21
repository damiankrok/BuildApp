/**
 * The upper-slab hole over a stair, on invented two-flight stairs: only the flights that end within head room of the
 * upper floor open the slab; with none, the shaft does.
 */
import { describe, expect, it } from 'vitest'
import { stairSlabHole } from '../src/v2/house-stair.js'
import type { StairTopologyHypothesis } from '../src/v2/stair-topology.js'

const stair = (risers: [number, number]): StairTopologyHypothesis => ({
  id: 's', storeyIndex: 0, shaft: { x0: 0, z0: 0, x1: 2, z1: 4 }, widthM: 1, start: { x: 0.5, z: 0 },
  flights: [
    { direction: 'PLUS_Z', from: 0, to: 2, band: { from: 0, to: 1 }, risers: risers[0] },
    { direction: 'MINUS_Z', from: 4, to: 2, band: { from: 1, to: 2 }, risers: risers[1] },
  ] as never,
  landings: [{ x0: 0, z0: 2, x1: 2, z1: 4 }] as never,
  winderRegions: [], turnKind: 'U', risersTotal: risers[0] + risers[1], riserCountInterval: { low: 16, high: 18 },
  directionEvidence: 'ARROW', confidence: 1, unresolved: [], why: '',
})

describe('stairSlabHole', () => {
  it('a low first flight keeps the slab; the second, ending at the upper floor, opens it', () => {
    expect(stairSlabHole(stair([4, 13]), 2.89, 2.89)).toEqual({ x0: 1, z0: 2, x1: 2, z1: 4 })
  })
  it('a first flight already within head room opens the slab over it and its landing too', () => {
    expect(stairSlabHole(stair([12, 5]), 2.89, 2.89)).toEqual({ x0: 0, z0: 0, x1: 2, z1: 4 })
  })
  it('head room is measured against the upper floor level, not the rise, when the ground is not at zero', () => {
    // the upper floor at 5.0 m: the top of the climb (2.89 m from zero) is still 2.11 m below it, so only the shaft
    expect(stairSlabHole(stair([4, 13]), 2.89, 5.0)).toEqual({ x0: 0, z0: 0, x1: 2, z1: 4 })
  })
})
