/**
 * BUILDPLAN-ANALYZER-005U-N2: a cell no wider than a wall band, standing against drawn wall, is wall material — not
 * ground a body wraps — so it does not stop regions with no wall between them from closing into one body.
 *
 * Hand-built decompositions at 2 cm/px with 0.2 m walls (10 px): the sliver bound is max(0.5 m, 1.5 × 0.2 m) = 25 px.
 * No drawing of any real building.
 */
import { describe, expect, it } from 'vitest'
import { planBodies } from '../src/index.js'
import type { CellClass, EdgeClosure, PlanCell, PlanDecomposition, PlanRegion } from '../src/index.js'

const MPP = 0.02
const edge = (wall: number, opening = 0): EdgeClosure => ({ wall, line: 0, opening, closure: Math.min(1, wall + opening) })
/** Edges in order top, right, bottom, left. */
type Edges = [number, number, number, number]
const OPEN: Edges = [0, 0, 0, 0]

function grid(xs: number[], ys: number[], spec: (ix: number, iy: number) => { cls: CellClass; edges?: Edges; openings?: Edges }): PlanCell[] {
  const cells: PlanCell[] = []
  for (let iy = 0; iy < ys.length - 1; iy += 1) {
    for (let ix = 0; ix < xs.length - 1; ix += 1) {
      const s = spec(ix, iy)
      const w = s.edges ?? OPEN
      const o = s.openings ?? OPEN
      cells.push({
        ix,
        iy,
        rect: { x0: xs[ix], y0: ys[iy], x1: xs[ix + 1], y1: ys[iy + 1] },
        classification: s.cls,
        edges: [edge(w[0], o[0]), edge(w[1], o[1]), edge(w[2], o[2]), edge(w[3], o[3])],
        enclosed: s.cls !== 'OUTSIDE',
        interiorInk: 0,
        confidence: 0.9,
        why: '',
      })
    }
  }
  return cells
}

function region(id: string, cells: PlanCell[], members: Array<[number, number]>): PlanRegion {
  const own = cells.filter((c) => members.some(([ix, iy]) => c.ix === ix && c.iy === iy))
  const rect = {
    x0: Math.min(...own.map((c) => c.rect.x0)),
    y0: Math.min(...own.map((c) => c.rect.y0)),
    x1: Math.max(...own.map((c) => c.rect.x1)),
    y1: Math.max(...own.map((c) => c.rect.y1)),
  }
  return {
    id,
    classification: 'BUILT',
    rect,
    metric: { x0: rect.x0 * MPP, z0: rect.y0 * MPP, x1: rect.x1 * MPP, z1: rect.y1 * MPP },
    cells: own.map((c) => ({ ix: c.ix, iy: c.iy })),
    confidence: 0.9,
    why: '',
  }
}

function decomposition(cells: PlanCell[], regions: PlanRegion[], wallPx = 10): PlanDecomposition {
  return { frameId: 'synthetic', wallThickness: { px: wallPx, m: wallPx * MPP }, cells, regions } as unknown as PlanDecomposition
}

const box = (r: PlanRegion) => [r.rect.x0, r.rect.y0, r.rect.x1, r.rect.y1]

/**
 * One house 10 × 8 m (500 × 400 px). The main room band is the top 6 m; behind it two rooms with a partition between
 * them, whose core (0.4 m) the grid cut as its own cell, and along the back wall a 0.3 m strip the outline cut through
 * the wall's inner half. Only the partition and the back wall are drawn; the rooms open onto the main band.
 */
function splitHouse(opts: { sliverEdges?: Edges; partitionEdges?: Edges; backOpenings?: Edges; roomsWall?: number } = {}) {
  const xs = [0, 240, 260, 500]
  const ys = [0, 300, 385, 400]
  const roomsWall = opts.roomsWall ?? 0.1
  const cells = grid(xs, ys, (ix, iy) => {
    if (iy === 0) return { cls: 'BUILT', edges: [1, ix === 2 ? 1 : 0, ix === 1 ? 0 : roomsWall, ix === 0 ? 1 : 0] }
    if (iy === 1 && ix === 1) return { cls: 'OUTSIDE', edges: opts.partitionEdges ?? [0, 1, 0, 1] }
    if (iy === 1) return { cls: 'BUILT', edges: [roomsWall, 1, 0, 1] }
    if (ix === 2) return { cls: 'BUILT', edges: [0, 1, 1, 1] }
    return { cls: 'OUTSIDE', edges: opts.sliverEdges ?? [0, 0, 1, ix === 0 ? 1 : 0], openings: opts.backOpenings }
  })
  const regions = [
    region('main', cells, [[0, 0], [1, 0], [2, 0]]),
    region('left-room', cells, [[0, 1]]),
    region('right-room', cells, [[2, 1], [2, 2]]),
  ]
  return decomposition(cells, regions)
}

describe('planBodies: wall material inside a body box (005U-N2)', () => {
  it('one walled house split by its wall cores closes into one body', () => {
    const bodies = planBodies(splitHouse())
    expect(bodies).toHaveLength(1)
    expect(box(bodies[0])).toEqual([0, 0, 500, 400])
    expect(bodies[0].metric).toEqual({ x0: 0, z0: 0, x1: 10, z1: 8 })
    expect(bodies[0].why).toMatch(/^3 built regions with no wall drawn between them, making one body/)
  })

  it('a window or door in the wall the sliver stands against still counts as that wall', () => {
    const bodies = planBodies(splitHouse({ sliverEdges: [0, 0, 0.3, 0], backOpenings: [0, 0, 0.6, 0] }))
    expect(bodies).toHaveLength(1)
  })

  it('without a wall thickness the rule stays silent and the regions stay apart', () => {
    const d = splitHouse()
    const bodies = planBodies({ ...d, wallThickness: { px: 0, m: 0 } })
    expect(bodies.map((b) => b.id).sort()).toEqual(['left-room', 'main', 'right-room'])
  })

  it('a narrow strip with no wall drawn on it is ground, not wall: the regions stay apart', () => {
    const bodies = planBodies(splitHouse({ sliverEdges: OPEN, partitionEdges: OPEN }))
    expect(bodies.length).toBeGreaterThan(1)
  })

  it('a real attached body behind a drawn wall is never joined, however its box is filled', () => {
    // the rooms band is walled off from the main band along its whole side: a garage behind the house
    const bodies = planBodies(splitHouse({ roomsWall: 1 }))
    expect(bodies.map((b) => b.id).sort()).toEqual(['left-room', 'main', 'right-room'])
  })

  it('the notch of an L is ground a metre and more across: the L is not filled into a box', () => {
    // main 10 × 6 m; a wing 5.2 × 2 m on the right behind it, open onto it; left of the wing a 4.8 × 2 m notch, walled
    const xs = [0, 240, 500]
    const ys = [0, 300, 400]
    const cells = grid(xs, ys, (ix, iy) => {
      if (iy === 0) return { cls: 'BUILT', edges: [1, ix === 1 ? 1 : 0, ix === 0 ? 1 : 0.1, ix === 0 ? 1 : 0] }
      if (ix === 0) return { cls: 'OUTSIDE', edges: [1, 1, 0, 0] }
      return { cls: 'BUILT', edges: [0.1, 1, 1, 1] }
    })
    const bodies = planBodies(decomposition(cells, [region('main', cells, [[0, 0], [1, 0]]), region('wing', cells, [[1, 1]])]))
    expect(bodies.map((b) => b.id).sort()).toEqual(['main', 'wing'])
  })

  it('a recess of a few decimetres more than the sliver bound is not absorbed', () => {
    // the same house with the back strip 0.6 m deep (30 px > 25 px): a set-back, not wall
    const xs = [0, 240, 260, 500]
    const ys = [0, 300, 370, 400]
    const cells = grid(xs, ys, (ix, iy) => {
      if (iy === 0) return { cls: 'BUILT', edges: [1, ix === 2 ? 1 : 0, ix === 1 ? 0 : 0.1, ix === 0 ? 1 : 0] }
      if (iy === 1 && ix === 1) return { cls: 'OUTSIDE', edges: [0, 1, 0, 1] }
      if (iy === 1) return { cls: 'BUILT', edges: [0.1, 1, ix === 0 ? 1 : 0, 1] }
      if (ix === 2) return { cls: 'BUILT', edges: [0, 1, 1, 1] }
      return { cls: 'OUTSIDE', edges: [1, 0, 0, ix === 0 ? 0 : 0] }
    })
    const regions = [region('main', cells, [[0, 0], [1, 0], [2, 0]]), region('left-room', cells, [[0, 1]]), region('right-room', cells, [[2, 1], [2, 2]])]
    expect(planBodies(decomposition(cells, regions)).length).toBeGreaterThan(1)
  })
})
