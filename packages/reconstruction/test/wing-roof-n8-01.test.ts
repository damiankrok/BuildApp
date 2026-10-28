/**
 * N8-01, the pure pieces: a strip of ground that line work boxes in beside a set-back wing (`lineWorkStrips`), the
 * facade seam read from a corner block (`facadeSeams`' corner face), and the valleys of a wing whose ridge reaches the
 * main ridge with its eaves below the main eaves (`attachedGableLayout`). Grids and dimensions are invented.
 */
import { describe, expect, it } from 'vitest'
import { facadeSeams, lineWorkStrips } from '../src/plan-decomposition.js'
import type { CellClass, EdgeClosure, PlanCell } from '../src/plan-decomposition.js'
import type { Band } from '@buildapp/source-cv'
import { attachedGableLayout } from '../src/v2/attached-roof-form.js'
import type { MainRoofForJoin, PlanBox } from '../src/v2/attached-roof-form.js'

const WALL: EdgeClosure = { wall: 1, line: 1, opening: 0, closure: 1 }
const LINE: EdgeClosure = { wall: 0, line: 1, opening: 0, closure: 1 }
const NONE: EdgeClosure = { wall: 0, line: 0, opening: 0, closure: 0 }

/**
 * Cells on columns `xs` and rows `ys` (pixel lines); `classes` one string per row; `edge(ix, iy, side)` each edge's
 * closure (0 top, 1 right, 2 bottom, 3 left).
 */
function grid(xs: number[], ys: number[], classes: string[], edge: (ix: number, iy: number, side: number) => EdgeClosure): { cells: PlanCell[]; nx: number; ny: number } {
  const cells: PlanCell[] = []
  for (let iy = 0; iy < ys.length - 1; iy += 1)
    for (let ix = 0; ix < xs.length - 1; ix += 1) {
      const k = classes[iy][ix]
      const classification: CellClass = k === 'B' ? 'BUILT' : k === 'R' ? 'RECESS' : 'OUTSIDE'
      cells.push({ ix, iy, rect: { x0: xs[ix], y0: ys[iy], x1: xs[ix + 1], y1: ys[iy + 1] }, classification, edges: [edge(ix, iy, 0), edge(ix, iy, 1), edge(ix, iy, 2), edge(ix, iy, 3)], enclosed: k === 'B', interiorInk: 0, confidence: 0.9, why: '' })
    }
  return { cells, nx: xs.length - 1, ny: ys.length - 1 }
}

/**
 * A house (column 0, rows 0..2) and a set-back wing (column 1) whose front row is a 6 px strip boxed in by a paving line:
 * the wing's own front wall is the strip's top edge, the paving line its bottom edge, the plan's edge its right.
 */
const XS = [0, 100, 160]
const YS = [0, 40, 94, 100]
function wingPlan(over: (ix: number, iy: number, side: number) => EdgeClosure | undefined = () => undefined) {
  return grid(XS, YS, ['BB', 'BB', 'BB'], (ix, iy, side) => {
    const o = over(ix, iy, side)
    if (o) return o
    if (ix === 1 && iy === 2) return side === 0 ? WALL : side === 3 ? WALL : LINE
    if (ix === 1 && iy === 1 && side === 2) return WALL
    if (ix === 0 && side === 1) return WALL
    if (ix === 0 && (side === 3 || (side === 2 && iy === 2) || (side === 0 && iy === 0))) return WALL
    if (ix === 1 && (side === 1 || (side === 0 && iy === 0))) return WALL
    return NONE
  })
}
const MIN_SPAN = { x: 20, y: 20 }

describe('N8-01: ground boxed in by line work beside a set-back wing', () => {
  it('a strip narrower than a body, shut outside by a line only, in front of a wall and running out to the open, is ground', () => {
    const { cells, nx, ny } = wingPlan()
    const strips = lineWorkStrips(cells, nx, ny, MIN_SPAN)
    expect(strips.map((s) => [s.side, s.cells])).toEqual([['BOTTOM', [{ ix: 1, iy: 2 }]]])
    expect(cells.find((c) => c.ix === 1 && c.iy === 2)?.classification).toBe('OUTSIDE')
    // the house's own front row is untouched: its outside edge is wall
    expect(cells.find((c) => c.ix === 0 && c.iy === 2)?.classification).toBe('BUILT')
  })

  it('an outside edge that carries wall band, or an opening, is a facade: the strip stays built', () => {
    const walled = wingPlan((ix, iy, side) => (ix === 1 && iy === 2 && side === 2 ? { wall: 0.3, line: 1, opening: 0, closure: 1 } : undefined))
    expect(lineWorkStrips(walled.cells, walled.nx, walled.ny, MIN_SPAN)).toEqual([])
    const glazed = wingPlan((ix, iy, side) => (ix === 1 && iy === 2 && side === 2 ? { wall: 0, line: 1, opening: 0.6, closure: 1 } : undefined))
    expect(lineWorkStrips(glazed.cells, glazed.nx, glazed.ny, MIN_SPAN)).toEqual([])
  })

  it('a strip as deep as a body is not taken off (it may hold a room)', () => {
    const { cells, nx, ny } = wingPlan()
    expect(lineWorkStrips(cells, nx, ny, { x: 5, y: 5 })).toEqual([])
  })

  it('a strip with no wall along its inner edge is not in front of a face', () => {
    const { cells, nx, ny } = wingPlan((ix, iy, side) => (ix === 1 && iy === 2 && side === 0 ? LINE : ix === 1 && iy === 1 && side === 2 ? LINE : undefined))
    expect(lineWorkStrips(cells, nx, ny, MIN_SPAN)).toEqual([])
  })

  it('a strip the wall band or solid ink fills is the wall itself, not ground', () => {
    const { cells, nx, ny } = wingPlan()
    const band = { axis: 'HORIZONTAL', bounds: { x0: 100, y0: 94, x1: 160, y1: 100 } } as unknown as Band
    expect(lineWorkStrips(cells, nx, ny, MIN_SPAN, [band])).toEqual([])
  })

  it('a run shut by built cells at both ends is a notch in the facade, left to the recess reading', () => {
    // three columns: the strip is the middle one's front row, between two built front cells
    const { cells, nx, ny } = grid([0, 100, 160, 260], YS, ['BBB', 'BBB', 'BBB'], (ix, iy, side) => {
      if (ix === 1 && iy === 2) return side === 0 ? WALL : side === 2 ? LINE : WALL
      if (side === 2 && iy === 2) return WALL
      return side === 0 && iy === 0 ? WALL : (side === 3 && ix === 0) || (side === 1 && ix === 2) ? WALL : NONE
    })
    expect(lineWorkStrips(cells, nx, ny, MIN_SPAN)).toEqual([])
  })
})

describe('N8-01: a facade seam read from a corner block', () => {
  // the wing's strips gone, column 1's front and rear rows are outside: the house's east face shows there, as the end of
  // the front and rear walls (a corner block, no band along the face), and carries on between the house and the wing
  const thickness = (band: number) => (axis: 'X' | 'Y', line: number, k: number) => (axis === 'X' && line === 1 ? (k === 0 || k === 3 ? 0 : band) : 0)

  it('with no band of its own at the face, the wall carried on is weighed against the plan’s wall: a structural wall is a seam', () => {
    const { cells, nx, ny } = grid([0, 100, 160], [0, 6, 40, 94, 100], ['B.', 'BB', 'BB', 'B.'], (ix, iy, side) => {
      if (ix === 0 && side === 1) return iy === 0 || iy === 3 ? { wall: 0.6, line: 1, opening: 0, closure: 1 } : WALL
      if (ix === 1 && side === 3 && (iy === 1 || iy === 2)) return WALL
      if (ix === 1 && side === 1) return WALL
      return NONE
    })
    // before N8-01 (no plan wall given) the face with no band was skipped: no seam
    expect(facadeSeams(cells, nx, ny, { x: 20, y: 20 }, thickness(14)).v.size).toBe(0)
    // a 14 px wall against a 22 px plan wall clears half of it: the seam stands
    expect([...facadeSeams(cells, nx, ny, { x: 20, y: 20 }, thickness(14), 22).v].sort()).toEqual(['1:1', '1:2'])
    // a 6 px partition does not
    expect(facadeSeams(cells, nx, ny, { x: 20, y: 20 }, thickness(6), 22).v.size).toBe(0)
  })
})

describe('N8-01: a wing reaching the main ridge with its eaves below the main eaves', () => {
  // the main body 0..7.75 × 0..10.45, ridge along z at x 3.875, 45°, eaves 4.645, ridge 8.52; the wing against its east
  // face, 7.75..11.6 × 0.7..9.65, ridge along x: at 45° over 8.95 m from the same ridge its eaves are at 4.045
  const MAIN: MainRoofForJoin = { ridgeAxis: 'Z', ridgeAt: 3.875, eaveY: 4.645, ridgeY: 8.52, pitchDeg: 45, footprint: { x0: 0, x1: 7.75, z0: 0, z1: 10.45 } }
  const WING: PlanBox = { x0: 7.75, x1: 11.6, z0: 0.7, z1: 9.65 }

  it('two valleys from where each plane reaches the main eave at the party line to where the ridges meet', () => {
    const layout = attachedGableLayout(WING, 'X', 45, 4.045, MAIN)
    expect(layout.ridgeY).toBeCloseTo(8.52, 6)
    expect(layout.join.kind).toBe('VALLEY')
    if (layout.join.kind !== 'VALLEY') return
    expect(layout.join.partySide).toBe('MIN')
    const [low, high] = layout.join.valleys
    expect(low.start.x).toBeCloseTo(7.75, 6)
    expect(low.start.z).toBeCloseTo(1.3, 6)
    expect(low.end.x).toBeCloseTo(3.875, 6)
    expect(low.end.z).toBeCloseTo(5.175, 6)
    expect(high.start.z).toBeCloseTo(9.05, 6)
    // the ridge runs from the free gable end to the main ridge
    expect(layout.ridge.map((p) => p.x).sort((a, b) => a - b)).toEqual([3.875, 11.6])
    // each plane steps along the party line before the valley: five corners
    expect(layout.planes.map((p) => p.boundary.length)).toEqual([5, 5])
    // below the main eave each plane meets the main body's wall
    expect(layout.eaves.filter((e) => e.kind === 'ABUTMENT').map((e) => [e.key, e.start.z, e.end.z])).toEqual([
      ['LOW', 0.7, 1.3],
      ['HIGH', 9.05, 9.65],
    ])
    // one verge pair, at the free end only
    expect(layout.verges.every((v) => v.start.x === 11.6 || v.end.x === 11.6)).toBe(true)
  })

  it('every corner of a plane lies on the plane: the valley points stand at the main roof’s own height there', () => {
    const layout = attachedGableLayout(WING, 'X', 45, 4.045, MAIN)
    const mainTop = (x: number): number => MAIN.ridgeY - Math.abs(x - MAIN.ridgeAt)
    if (layout.join.kind !== 'VALLEY') throw new Error('no valley')
    for (const v of layout.join.valleys)
      for (const p of [v.start, v.end]) {
        const wingTop = 4.045 + Math.min(p.z - WING.z0, WING.z1 - p.z)
        expect(wingTop).toBeCloseTo(mainTop(p.x), 6)
      }
  })

  it('a wing with eaves level with the main ones keeps the valley it always had', () => {
    const narrow: PlanBox = { x0: 7.75, x1: 11.6, z0: 2, z1: 8 }
    const layout = attachedGableLayout(narrow, 'X', 45, 4.645, MAIN)
    expect(layout.join.kind).toBe('VALLEY')
    expect(layout.planes.map((p) => p.boundary.length)).toEqual([4, 4])
    expect(layout.eaves.filter((e) => e.kind === 'ABUTMENT')).toEqual([])
  })

  it('a wing whose ridge would stand above the main ridge is not run into it', () => {
    const layout = attachedGableLayout(WING, 'X', 45, 4.645, MAIN)
    expect(layout.join.kind).toBe('ABUTMENT')
  })
})
