/** v3.54.17 — the plan outline read's own checks: snapping to the plan's axes, and what it refuses. */
import { describe, expect, it } from 'vitest'
import { orthogonalise } from '../src/consult/plan-outline.js'

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
