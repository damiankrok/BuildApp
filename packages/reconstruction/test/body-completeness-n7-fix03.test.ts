/**
 * N7-COUNCIL-FIX-03, the pure pieces: the facade seams a built rectangle may not cross (C-1), and the weighing of every
 * walled area of the plan against the bodies the model stands on it (§4). Grids are invented; nothing is read.
 */
import { describe, expect, it } from 'vitest'
import { facadeSeams } from '../src/plan-decomposition.js'
import type { CellClass, EdgeClosure, PlanCell, PlanDecomposition, PlanRegion } from '../src/plan-decomposition.js'
import { bodyCompleteness } from '../src/v2/body-completeness.js'
import { rectangleRing } from '../src/structural-layout.js'

const WALL: EdgeClosure = { wall: 1, line: 1, opening: 0, closure: 1 }
const NONE: EdgeClosure = { wall: 0, line: 0, opening: 0, closure: 0 }
const DOOR: EdgeClosure = { wall: 0.6, line: 0.6, opening: 0.4, closure: 1 }

/** A grid of 10 px cells; `edge(ix, iy, side)` gives each edge's closure (0 top, 1 right, 2 bottom, 3 left). */
function grid(classes: string[], edge: (ix: number, iy: number, side: number) => EdgeClosure): { cells: PlanCell[]; nx: number; ny: number } {
  const ny = classes.length
  const nx = classes[0].length
  const cells: PlanCell[] = []
  for (let iy = 0; iy < ny; iy += 1)
    for (let ix = 0; ix < nx; ix += 1) {
      const k = classes[iy][ix]
      const classification: CellClass = k === 'B' ? 'BUILT' : k === 'R' ? 'RECESS' : 'OUTSIDE'
      cells.push({ ix, iy, rect: { x0: ix * 10, y0: iy * 10, x1: ix * 10 + 10, y1: iy * 10 + 10 }, classification, edges: [edge(ix, iy, 0), edge(ix, iy, 1), edge(ix, iy, 2), edge(ix, iy, 3)], enclosed: k === 'B', interiorInk: 0, confidence: 0.9, why: '' })
    }
  return { cells, nx, ny }
}

describe('N7-COUNCIL-FIX-03 (C-1): facade seams', () => {
  it('a wall that carries the house face on past a garage is a seam; the house interior is not', () => {
    // column 2 is a garage set back one row from the house's front (row 0 outside there); line x=2 is the house's
    // east face, walled all the way down; line x=1 is a partition with a door, inside the house
    const { cells, nx, ny } = grid(['BB.', 'BBB', 'BBB'], (ix, _iy, side) => (side === 3 && ix === 2) || (side === 1 && ix === 1) ? WALL : (side === 3 && ix === 1) || (side === 1 && ix === 0) ? DOOR : NONE)
    const seams = facadeSeams(cells, nx, ny)
    expect([...seams.v].sort()).toEqual(['2:1', '2:2'])
    expect([...seams.h]).toEqual([])
  })

  it('a line with no outside face anywhere along it is never a seam (a spine wall of one house)', () => {
    const { cells, nx, ny } = grid(['BBB', 'BBB'], (ix, _iy, side) => (side === 3 && ix === 1) || (side === 1 && ix === 0) ? WALL : NONE)
    expect(facadeSeams(cells, nx, ny).v.size).toBe(0)
  })

  it('the face carried on as a line with no wall band (a glazed screen, a balustrade) is not a seam', () => {
    const thin: EdgeClosure = { wall: 0.1, line: 1, opening: 0, closure: 1 }
    const { cells, nx, ny } = grid(['BB.', 'BBB'], (ix, _iy, side) => (side === 3 && ix === 2) || (side === 1 && ix === 1) ? thin : NONE)
    expect(facadeSeams(cells, nx, ny).v.size).toBe(0)
  })
})

describe('N7-COUNCIL-FIX-03 (§4): every walled area against the model', () => {
  const frame = { metresPerPixelX: 0.1, metresPerPixelY: 0.1, originPx: { x: 0, y: 0 } }
  const { cells } = grid(['BB', 'BB'], (ix, iy, side) => ((side === 3 && ix === 0) || (side === 1 && ix === 1) || (side === 0 && iy === 0) || (side === 2 && iy === 1) ? WALL : NONE))
  const region = (id: string, ix0: number, ix1: number): PlanRegion => ({ id, classification: 'BUILT', rect: { x0: ix0 * 10, y0: 0, x1: ix1 * 10 + 10, y1: 20 }, metric: { x0: ix0, z0: 0, x1: ix1 + 1, z1: 2 }, cells: [0, 1].flatMap((iy) => Array.from({ length: ix1 - ix0 + 1 }, (_, k) => ({ ix: ix0 + k, iy }))), confidence: 0.9, why: '' })
  const decomposition = (regions: PlanRegion[]): PlanDecomposition => ({ frameId: 'f', wallThickness: { px: 2, m: 0.2 }, envelope: null, linesX: [0, 10, 20].map((px) => ({ axis: 'X', px, probesPx: [px], support: { chainIds: [], chainSpanPx: 0, printedChainIds: [], bandLength: 0, bandCoverage: 0, spansWall: false }, confidence: 1 }) as unknown as PlanDecomposition['linesX'][number]), linesY: [0, 10, 20].map((px) => ({ axis: 'Y', px, probesPx: [px], support: { chainIds: [], chainSpanPx: 0, printedChainIds: [], bandLength: 0, bandCoverage: 0, spansWall: false }, confidence: 1 }) as unknown as PlanDecomposition['linesY'][number]), cells, regions, extent: { x0: 0, y0: 0, x1: 20, y1: 20 }, unresolved: [], wideOpenings: [], bays: [], hypotheses: [], chosenHypothesis: null })

  it('a drawn region no body stands on is MISSING, with its cause, and the coverage says how much of the plan the model holds', () => {
    const d = decomposition([region('house', 0, 0), region('garage', 1, 1)])
    const out = bodyCompleteness({ decomposition: d, frame, built: [{ id: 'mass-0', ring: rectangleRing(0, 0, 1, 2) }], dropped: [], gaps: [] })
    expect(out.areas.map((a) => [a.id, a.decision])).toEqual([['house', 'REPRESENTED'], ['garage', 'MISSING']])
    expect(out.missing[0].cause).toContain('no body of the layout stands on it')
    expect(out.coverage).toBe(0.5)
  })

  it('a region left out on the record (a strip the layout named) is OMITTED, not missing', () => {
    const d = decomposition([region('house', 0, 0), region('garage', 1, 1)])
    const out = bodyCompleteness({ decomposition: d, frame, built: [{ id: 'mass-0', ring: rectangleRing(0, 0, 1, 2) }], dropped: [], gaps: [{ id: 'gap-sliver-garage', what: 'whether the strip is part of the building', reason: 'a wall thick' }] })
    expect(out.areas.map((a) => a.decision)).toEqual(['REPRESENTED', 'OMITTED'])
    expect(out.missing).toEqual([])
  })

  it('a body the layout found and the model did not carry is MISSING, the step named', () => {
    const d = decomposition([region('house', 0, 0), region('garage', 1, 1)])
    const out = bodyCompleteness({ decomposition: d, frame, built: [{ id: 'mass-0', ring: rectangleRing(0, 0, 1, 2) }], dropped: [{ id: 'mass-1', ring: rectangleRing(1, 0, 2, 2), why: 'it is not carried into the model', deliberate: false }], gaps: [] })
    expect(out.missing.map((a) => a.cause)).toEqual(['the body mass-1 on it was not built: it is not carried into the model'])
  })

  it('two regions one body stands on are JOINED, and nothing is missing', () => {
    const d = decomposition([region('a', 0, 0), region('b', 1, 1)])
    const out = bodyCompleteness({ decomposition: d, frame, built: [{ id: 'mass-0', ring: rectangleRing(0, 0, 2, 2) }], dropped: [], gaps: [] })
    expect(out.areas.map((a) => a.decision)).toEqual(['JOINED', 'JOINED'])
    expect(out.coverage).toBe(1)
  })
})
