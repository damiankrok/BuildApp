/**
 * EXTERIOR-COMPLETE: the upper storey's French windows an elevation reads behind a balustrade — glazing whose sill it
 * puts at the balustrade's top and whose head stands at a door's height — are the candidates the plan's balcony
 * outline is looked for in front of. Heights alone cannot tell them from a window whose head is as high, so they are
 * candidates only: the plan's outline in front of them and a balustrade on the elevation confirm them (the solver).
 * A door already at the floor is the incumbent pass's; a sill above any balustrade, or a head below a door's, is not.
 */
import { describe, expect, it } from 'vitest'
import { behindBalustradeGroups, floorLevelDoorGroups, BEHIND_BALUSTRADE_SILL_MAX_M } from '../src/v2/projecting-balcony.js'

const FLOOR = 2.8
const o = (id: string, from: number, to: number, sill: number, head: number, facade: 'FRONT' | 'REAR' = 'REAR') => ({ id, storeyIndex: 1, massId: 'main', facade, planeAt: 8, interval: [from, to] as [number, number], sillY: FLOOR + sill, headY: FLOOR + head })

describe('French windows behind a balustrade', () => {
  it('glazing read from the balustrade top to a door head is a candidate; a low-headed window, or a door at the floor, is not', () => {
    const openings = [o('french-a', 1, 2.8, 0.82, 2.87), o('french-b', 4, 5.1, 0.76, 2.81), o('window', 7, 8.8, 0.9, 1.9), o('door', 10, 11, 0, 2.1)]
    const groups = behindBalustradeGroups(openings, 1, FLOOR)
    expect(groups).toHaveLength(1)
    expect(groups[0].openingIds).toEqual(['french-a', 'french-b'])
    expect(groups[0].span).toEqual([1, 5.1])
    // the floor-level door stays the incumbent pass's
    expect(floorLevelDoorGroups(openings, 1, FLOOR).flatMap((g) => g.openingIds)).toEqual(['door'])
  })
  it('a sill above any balustrade is a window, however tall it is', () => {
    expect(behindBalustradeGroups([o('high', 1, 2, BEHIND_BALUSTRADE_SILL_MAX_M + 0.1, 2.9)], 1, FLOOR)).toHaveLength(0)
  })
  it('each face is grouped on its own, and another storey is not read', () => {
    const groups = behindBalustradeGroups([o('rear', 1, 2, 0.8, 2.6), o('front', 1, 2, 0.8, 2.6, 'FRONT'), { ...o('ground', 1, 2, 0.8, 2.6), storeyIndex: 0 }], 1, FLOOR)
    expect(groups.map((g) => g.side).sort()).toEqual(['FRONT', 'REAR'])
  })
})
