/** v3.54.17 — the plan outline read's own checks: snapping to the plan's axes, and what it refuses. */
import { describe, expect, it } from 'vitest'
import { orthogonalise, squareOblique } from '../src/consult/plan-outline.js'

describe('v3.54.17 plan outline: orthogonal outlines only', () => {
  it('an L traced with a few pixels of jitter snaps to six axis-aligned corners', () => {
    const r = orthogonalise([[10, 10], [410, 12], [409, 210], [300, 211], [301, 310], [11, 309]])
    const key = (p: number[]): string => p.join(',')
    expect('outline' in r && r.outline.map(key).sort()).toEqual([[10.5, 11], [409.5, 11], [409.5, 210.5], [300.5, 210.5], [300.5, 309.5], [10.5, 309.5]].map(key).sort())
  })
  it('collinear corners are dropped (a rectangle traced with a mid-wall point is four corners)', () => {
    const r = orthogonalise([[0, 0], [100, 0], [200, 0], [200, 100], [0, 100]])
    expect('outline' in r && r.outline.length).toBe(4)
  })
  it('an oblique wall is beyond the supported form: refused, never snapped', () => {
    const r = orthogonalise([[0, 0], [200, 0], [200, 100], [100, 160], [0, 100]])
    expect('refused' in r && r.refused).toMatch(/off the plan's axes/)
  })
})

describe('v3.54.19 (plan-outline 1.5.0) a small oblique edge is squared to the corner outside it', () => {
  // a 400 × 300 house with a splayed bay on its left side: 30 px deep, 120 px along the wall, 30 px splays
  const bay: Array<[number, number]> = [[100, 100], [500, 100], [500, 400], [100, 400], [100, 310], [70, 280], [70, 220], [100, 190]]
  it('a bay window becomes its bounding step: eight axis-parallel corners, the bay kept on the outside', () => {
    const sq = squareOblique(bay)
    expect(sq.squared).toBe(2)
    expect(sq.outline).toContainEqual([70, 310])
    expect(sq.outline).toContainEqual([70, 190])
    const r = orthogonalise(bay)
    expect('outline' in r && r.outline.length).toBe(8)
    expect('outline' in r && r.squared?.edges).toBe(2)
    expect('outline' in r && Math.min(...r.outline.map((p) => p[0]))).toBe(70)
  })
  it('a chamfered corner becomes the square corner, whichever way round the outline is traced', () => {
    const chamfer: Array<[number, number]> = [[100, 100], [470, 100], [500, 130], [500, 400], [100, 400]]
    for (const o of [chamfer, [...chamfer].reverse()]) {
      const r = orthogonalise(o)
      expect('outline' in r && r.outline.length).toBe(4)
      expect('outline' in r && Math.max(...r.outline.map((p) => p[0]))).toBe(500)
      expect('outline' in r && Math.min(...r.outline.map((p) => p[1]))).toBe(100)
    }
  })
  it('counter-trials: an oblique wall that is a real part of the form is still refused; an orthogonal outline is untouched', () => {
    const r = orthogonalise([[0, 0], [200, 0], [200, 100], [100, 160], [0, 100]])
    expect('refused' in r && r.refused).toMatch(/off the plan's axes/)
    expect(squareOblique([[0, 0], [200, 0], [200, 100], [0, 100]]).squared).toBe(0)
    // many small splays that together change the outline too much are not a convention either
    const saw: Array<[number, number]> = [[0, 0], [400, 0], [400, 300], [360, 340], [320, 300], [280, 340], [240, 300], [200, 340], [160, 300], [120, 340], [80, 300], [40, 340], [0, 300]]
    expect('refused' in orthogonalise(saw)).toBe(true)
  })
})
