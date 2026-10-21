/** The one-line run of a stair's segments, on invented stairs. */
import { describe, expect, it } from 'vitest'
import { stairSegmentSummary } from '../src/describe.js'

describe('stairSegmentSummary', () => {
  it('names flights by risers, winders by risers, turn and angle, landings by length and turn', () => {
    expect(stairSegmentSummary([{ kind: 'FLIGHT', risers: 4 }, { kind: 'WINDER', risers: 3, turn: 'LEFT', angleDeg: 90 }, { kind: 'FLIGHT', risers: 10 }])).toBe('flight 4, winder 3 left 90°, flight 10')
    expect(stairSegmentSummary([{ kind: 'FLIGHT', risers: 8 }, { kind: 'LANDING', length: 0.9, turn: 'RIGHT' }, { kind: 'FLIGHT', risers: 9 }])).toMatch(/^flight 8, landing .+ right, flight 9$/)
  })
  it('a straight landing says no turn', () => {
    expect(stairSegmentSummary([{ kind: 'LANDING', length: 1.2, turn: 'NONE' }])).not.toMatch(/none/)
  })
})
