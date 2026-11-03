/**
 * EXTERIOR-COMPLETE: a recessed entrance with nothing standing in its mouth. Its jambs' walls turn inward and a set-back
 * wall closes it behind them, with the entrance door in that wall — a porch under the floor or the roof above, whose
 * outer edge the plan draws as one line across the mouth. Before, a mouth with no wall-thick ink inside it was "one
 * gap", the line across it made it an opening in a wall that carries on, and the porch was built over as a room with a
 * 4 m window. Synthetic plans as `compound-facade.test.ts` draws them (5 cm/px, 0.6 m walls); nothing here is a drawing
 * of a real building.
 */
import { describe, expect, it } from 'vitest'
import { WALL } from './plan.js'
import { PlanDrawing, TRANSFORMS, runScene } from './transforms.js'
import type { Scene } from './transforms.js'
import type { CompoundFacadeSpan, PlanDecomposition } from '../src/index.js'

const W = 460
const H = 400
const FRONT = 268
const house = (): PlanDrawing => new PlanDrawing(W, H).ring(40, 40, 359, 279)
const returnAt = (p: PlanDrawing, x: number, top: number): PlanDrawing => p.wall(x, top, x + WALL - 1, 279)
const wallH = (p: PlanDrawing, a: number, b: number, y: number): PlanDrawing => p.wall(a, y, b, y + WALL - 1)
const doorH = (p: PlanDrawing, a: number, b: number, y: number): PlanDrawing => p.clear(a, y, b, y + WALL - 1).line(a, y + 5, b, y + 5)
const scene = (p: PlanDrawing): Scene => ({ p, xs: [40, 360], ys: [40, 280], callouts: [] })
const spansOf = (d: PlanDecomposition): CompoundFacadeSpan[] => (d.compoundFacades ?? []).filter((s) => s.intervals.length > 0)

/**
 * A 4 m mouth x 140..219; its returns at 128 and 220 run on from the facade as the hall's walls (up to row 150), and a
 * set-back wall at rows 244..255 holding a 1 m door, 1.6 m behind the mouth's face (an entrance porch, 0.6 m clear), closes the porch from the hall behind it.
 */
function porch(opts: { backWall?: boolean; edgeLine?: boolean } = {}): PlanDrawing {
  const p = house()
  p.clear(140, FRONT, 219, 279)
  if (opts.backWall !== false) {
    returnAt(p, 128, 150)
    returnAt(p, 220, 150)
    wallH(p, 128, 231, 244)
    doorH(p, 170, 189, 244)
    wallH(p, 128, 231, 150)
    doorH(p, 160, 179, 150)
  }
  // the edge of the floor (or roof) over the porch, drawn as one line across the mouth at the outer face
  if (opts.edgeLine !== false) p.line(140, 276, 219, 276)
  return p
}

describe('EXTERIOR-COMPLETE — a recessed entrance with an empty mouth', () => {
  it('returns at both jambs and a set-back wall: one RECESS_MOUTH interval, the porch outside, the hall built (every orientation)', () => {
    for (const t of TRANSFORMS) {
      const r = runScene(scene(porch()), t)
      const spans = spansOf(r.d)
      expect(spans, t).toHaveLength(1)
      expect(spans[0].intervals.map((i) => i.role), t).toEqual(['RECESS_MOUTH'])
      expect(spans[0].separators.filter((s) => s.accepted), t).toHaveLength(0)
      expect(r.builtAt(180, 262), `${t}: the porch`).toBe(false)
      expect(r.builtAt(180, 200), `${t}: the hall behind the door`).toBe(true)
    }
  })

  it('without the drawn edge across the mouth it is the same recess', () => {
    const r = runScene(scene(porch({ edgeLine: false })), 'id')
    expect(spansOf(r.d)[0]?.intervals.map((i) => i.role)).toEqual(['RECESS_MOUTH'])
    expect(r.builtAt(180, 262)).toBe(false)
  })

  it('with no returns and no set-back wall the gap stays the one gap the incumbent reads: no recess is made up', () => {
    for (const t of TRANSFORMS) {
      const r = runScene(scene(porch({ backWall: false })), t)
      expect(spansOf(r.d), t).toHaveLength(0)
      expect(r.builtAt(180, 262), `${t}: behind the line across the gap`).toBe(true)
    }
  })
})
