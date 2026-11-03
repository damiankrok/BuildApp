/**
 * LINK-F1C: on a wall that runs between the faces of the walls it abuts (a pocket's back wall, a party wall's span), a
 * gap the plan draws up to such a face keeps OPENING_END_JAMB_M of its own wall there: the model cannot say "the other
 * wall is the jamb" (an opening leaves wall on both sides), and a sliver under a millimetre put its reveal into the other
 * wall's face (Cieszynianki). The source edge on the other side is kept as read; the narrowing is stated.
 */
import { describe, expect, it } from 'vitest'
import { OPENING_END_JAMB_M, endJambs } from '../src/v2/openings-v2.js'

describe('LINK-F1C endJambs', () => {
  const span: [number, number] = [0.458783, 2.593031]
  it('a gap read up to a face (0.12 mm short of it, the map’s rounding) keeps the jamb there and its other edge as read', () => {
    const r = endJambs([0.6, 2.592910], span)!
    expect(r.interval).toEqual([0.6, 2.543031])
    expect(r.why).toMatch(/high end; the model keeps a 0\.05 m jamb/)
  })
  it('a gap read up to both faces keeps a jamb at each', () => {
    const r = endJambs([0.458783, 2.593031], span)!
    expect(r.interval).toEqual([0.508783, 2.543031])
    expect(r.why).toMatch(/low and high ends/)
  })
  it('a gap clear of both faces by the jamb or more is the source’s, untouched', () => {
    expect(endJambs([0.6, 2.4], span)).toBeUndefined()
    expect(endJambs([span[0] + OPENING_END_JAMB_M, span[1] - OPENING_END_JAMB_M], span)).toBeUndefined()
  })
  it('a printed width that reaches a face is kept: the opening moves off the face by what the jamb needs', () => {
    // the Rarytasy shared-wall door: printed 100 about a 0.91 m drawn gap, its high edge 0.043 m short of the jamb
    const r = endJambs([7.373814, 8.373814], [2.344277, 8.38088], true)!
    expect(r.interval[1] - r.interval[0]).toBeCloseTo(1, 9)
    expect(r.interval[1]).toBeCloseTo(8.38088 - OPENING_END_JAMB_M, 6)
    expect(r.why).toMatch(/printed width kept/)
  })
  it('a printed width with no room to move (both ends at a face) is taken in, and says so', () => {
    const r = endJambs([0.46, 2.59], span, true)!
    expect(r.interval).toEqual([0.508783, 2.543031])
    expect(r.why).toMatch(/off the width read/)
  })
  it('a gap narrower than two jambs at a face is not turned inside out', () => {
    expect(endJambs([0.46, 0.5], [0.458783, 0.55])).toBeUndefined()
  })
})
