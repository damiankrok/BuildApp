/**
 * v3.53.8 — a line the rectangles were cut on to tile one enclosed space (`seamOpenShare`).
 *
 * An L-shaped house whose fill keeps every cell is tiled into two rectangles; the line between them runs through the
 * kitchen and the hall, where the plan draws no wall. Read as a contact of two bodies with too little wall drawn on it,
 * it used to build a wall each side and cut the rooms it crosses in two. The share says how much of the line has built
 * cells on both sides and, of that, how much carries no wall (neither wall ink nor a door between pieces of wall).
 * Hand-built cells, 100 px each — no drawing of any real plan.
 */
import { describe, expect, it } from 'vitest'
import { SEAM_MIN_BUILT, SEAM_MIN_OPEN, SEAM_STRIP_MAX_M, seamOpenShare } from '../src/index.js'
import type { PlanCell, PlanDecomposition } from '../src/index.js'

type Edge = PlanCell['edges'][number]
const shut: Edge = { wall: 1, line: 0, opening: 0, closure: 1 }
const none: Edge = { wall: 0, line: 0, opening: 0, closure: 0 }
const door: Edge = { wall: 0.3, line: 0, opening: 0.7, closure: 1 }
const lineOnly: Edge = { wall: 0, line: 1, opening: 0, closure: 1 }

/** A 3 × 2 grid of 100 px cells; `east` sets the edges between column 1 and column 2 (the seam), row by row. */
function grid(east: [Edge, Edge], classes: Partial<Record<string, PlanCell['classification']>> = {}): PlanDecomposition {
  const cells: PlanCell[] = []
  for (let iy = 0; iy < 2; iy += 1)
    for (let ix = 0; ix < 3; ix += 1) {
      const edges: Edge[] = [none, none, none, none]
      if (ix === 1) edges[1] = east[iy]
      if (ix === 2) edges[3] = east[iy]
      cells.push({ ix, iy, rect: { x0: ix * 100, y0: iy * 100, x1: ix * 100 + 100, y1: iy * 100 + 100 }, classification: classes[`${ix}:${iy}`] ?? 'BUILT', edges, enclosed: true, interiorInk: 0, confidence: 0.9, why: 'test' } as PlanCell)
    }
  // 100 px cells at 2 cm/px: 2 m each
  return { cells, wallThickness: { px: 20, m: 0.4 } } as unknown as PlanDecomposition
}
// the main body: columns 0–1; the wing: column 2
const main = [{ x0: 0, y0: 0, x1: 200, y1: 200 }]
const wing = [{ x0: 200, y0: 0, x1: 300, y1: 200 }]

describe('v3.53.8: how much of a seam between two bodies is one space', () => {
  it('a seam with no wall anywhere along it, built on both sides: wholly one space', () => {
    expect(seamOpenShare(grid([none, none]), main, wing)).toEqual({ builtShare: 1, openShare: 1 })
  })

  it('a wall drawn on half of it: half open — at the threshold, still one space by the rule', () => {
    const s = seamOpenShare(grid([shut, none]), main, wing)
    expect(s).toEqual({ builtShare: 1, openShare: 0.5 })
    expect((s?.openShare ?? 0) >= SEAM_MIN_OPEN).toBe(true)
  })

  it('a door between pieces of wall is wall for this purpose: a door in a wall is not an open seam', () => {
    expect(seamOpenShare(grid([door, door]), main, wing)?.openShare).toBe(0)
  })

  it('line work alone is no wall: a thin line on the seam leaves it open', () => {
    expect(seamOpenShare(grid([lineOnly, lineOnly]), main, wing)?.openShare).toBe(1)
  })

  it('counter-case: where one side is ground the seam is no interior — the built share falls below the rule', () => {
    const s = seamOpenShare(grid([none, none], { '2:0': 'OUTSIDE', '2:1': 'OUTSIDE' }), main, wing)
    expect(s?.builtShare).toBe(0)
    expect((s?.builtShare ?? 0) >= SEAM_MIN_BUILT).toBe(false)
  })

  it(`counter-case: a strip no deeper than ${SEAM_STRIP_MAX_M} m along the seam, walled on its far edge, is the other space's lining — the wall behind it parts the spaces`, () => {
    // the found case: a garage's built-in cupboards along its back wall; the seam is the cupboards' face, the house's wall stands behind them
    const d = grid([none, none])
    const cells = (d as unknown as { cells: PlanCell[] }).cells
    for (const c of cells.filter((x) => x.ix === 1)) {
      c.rect = { ...c.rect, x0: 150 } // column 1 is 50 px = 1.0 m deep from the seam
      c.edges[3] = shut // and walled on its far (west) edge
    }
    expect(seamOpenShare(d, main, wing)?.openShare).toBe(0)
    // the same strip without the wall behind it is open floor
    for (const c of cells.filter((x) => x.ix === 1)) c.edges[3] = none
    expect(seamOpenShare(d, main, wing)?.openShare).toBe(1)
    // and a deeper row walled on its far edge is a room of its own side, not a lining
    for (const c of cells.filter((x) => x.ix === 1)) { c.rect = { ...c.rect, x0: 100 }; c.edges[3] = shut }
    expect(seamOpenShare(d, main, wing)?.openShare).toBe(1)
  })

  it('counter-case: two bodies that do not touch have no seam', () => {
    expect(seamOpenShare(grid([none, none]), [{ x0: 0, y0: 0, x1: 100, y1: 200 }], wing)).toBeNull()
  })
})
