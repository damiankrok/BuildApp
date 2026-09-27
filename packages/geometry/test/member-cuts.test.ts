/**
 * Stated end cuts on a linear solid (schema 1.6.0): the plumb cut where two
 * verge boards meet at a gable apex. The member stays a closed solid whose
 * volume is the one the model states, and a member without cuts compiles
 * exactly as before.
 */
import { describe, expect, it } from 'vitest'
import { linearSolidCutIssue, linearSolidVolume, type LinearSolid } from '@buildapp/model'
import { manifoldReport, meshVolume } from '@buildapp/verification'
import { compileLinearSolid } from '../src/index.js'

const board = (over: Partial<LinearSolid> = {}): LinearSolid => ({
  id: 'b',
  levelId: 'l0',
  start: { x: 0, y: 3, z: 0 },
  end: { x: 0, y: 5, z: 3 },
  width: 0.22,
  depth: 0.04,
  materialId: 'm',
  ...over,
})

describe('a member with a stated end cut', () => {
  it('is closed, and holds the volume the model states', () => {
    // a plumb cut through the centreline's end keeps the centroid axis, so the volume
    const through = board({ endCut: { point: { x: 0, y: 5, z: 3 }, normal: { x: 0, y: 0, z: 1 } } })
    const tris = compileLinearSolid(through)
    expect(manifoldReport(tris).closed).toBe(true)
    expect(meshVolume(tris)).toBeCloseTo(linearSolidVolume(through), 9)
    expect(linearSolidVolume(through)).toBeCloseTo(linearSolidVolume(board()), 12)
    // every end corner lies in the cut plane
    const zs = tris.flatMap((t) => [t.a, t.b, t.c]).map((p) => p.z)
    expect(Math.max(...zs)).toBeCloseTo(3, 9)
    // a cut further back shortens the member
    const back = board({ endCut: { point: { x: 0, y: 5, z: 2.9 }, normal: { x: 0, y: 0, z: 1 } } })
    expect(meshVolume(compileLinearSolid(back))).toBeCloseTo(linearSolidVolume(back), 9)
    expect(linearSolidVolume(back)).toBeLessThan(linearSolidVolume(board()))
  })

  it('without cuts compiles exactly as a plain box', () => {
    expect(compileLinearSolid(board({ startCut: undefined, endCut: undefined }))).toEqual(compileLinearSolid(board()))
  })

  it('refuses a cut along the path, or one that is not a joint', () => {
    expect(linearSolidCutIssue(board({ endCut: { point: { x: 0, y: 5, z: 3 }, normal: { x: 1, y: 0, z: 0 } } }))).toMatch(/within 78°/)
    expect(linearSolidCutIssue(board({ endCut: { point: { x: 0, y: 3, z: 0 }, normal: { x: 0, y: 0, z: 1 } } }))).toMatch(/further than a joint|no length/)
    expect(linearSolidCutIssue(board())).toBeNull()
  })
})
