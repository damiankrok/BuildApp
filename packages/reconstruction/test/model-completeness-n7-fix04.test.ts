/**
 * N7-FIX-04, the pure pieces of an honest completeness: the walls the plan draws that nothing in the reading accounts
 * for (a check that does not start from the decomposition), and the one verdict over the four questions kept apart.
 * Grids are invented; nothing is read.
 */
import { describe, expect, it } from 'vitest'
import type { CellClass, EdgeClosure, PlanCell, PlanDecomposition, PlanRegion } from '../src/plan-decomposition.js'
import { bodyCompleteness, modelCompleteness } from '../src/v2/body-completeness.js'
import { rectangleRing } from '../src/structural-layout.js'

const WALL: EdgeClosure = { wall: 1, line: 1, opening: 0, closure: 1 }
const NONE: EdgeClosure = { wall: 0, line: 0, opening: 0, closure: 0 }

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

describe('N7-FIX-04 (C): what the reading does not account for', () => {
  const frame = { metresPerPixelX: 0.1, metresPerPixelY: 0.1, originPx: { x: 0, y: 0 } }
  const { cells } = grid(['BB', 'BB'], (ix, iy, side) => ((side === 3 && ix === 0) || (side === 1 && ix === 1) || (side === 0 && iy === 0) || (side === 2 && iy === 1) ? WALL : NONE))
  const region = (id: string, ix0: number, ix1: number): PlanRegion => ({ id, classification: 'BUILT', rect: { x0: ix0 * 10, y0: 0, x1: ix1 * 10 + 10, y1: 20 }, metric: { x0: ix0, z0: 0, x1: ix1 + 1, z1: 2 }, cells: [0, 1].flatMap((iy) => Array.from({ length: ix1 - ix0 + 1 }, (_, k) => ({ ix: ix0 + k, iy }))), confidence: 0.9, why: '' })
  const decomposition = (regions: PlanRegion[]): PlanDecomposition => ({ frameId: 'f', wallThickness: { px: 2, m: 0.2 }, envelope: null, linesX: [0, 10, 20].map((px) => ({ axis: 'X', px, probesPx: [px], support: { chainIds: [], chainSpanPx: 0, printedChainIds: [], bandLength: 0, bandCoverage: 0, spansWall: false }, confidence: 1 }) as unknown as PlanDecomposition['linesX'][number]), linesY: [0, 10, 20].map((px) => ({ axis: 'Y', px, probesPx: [px], support: { chainIds: [], chainSpanPx: 0, printedChainIds: [], bandLength: 0, bandCoverage: 0, spansWall: false }, confidence: 1 }) as unknown as PlanDecomposition['linesY'][number]), cells, regions, extent: { x0: 0, y0: 0, x1: 20, y1: 20 }, unresolved: [], wideOpenings: [], bays: [], hypotheses: [], chosenHypothesis: null })

  const house = (): PlanDecomposition => ({ ...decomposition([region('house', 0, 1)]), extent: { x0: 0, y0: 0, x1: 60, y1: 40 } })
  const band = (x0: number, y0: number, x1: number, y1: number, axis: 'HORIZONTAL' | 'VERTICAL') => ({ bounds: { x0, y0, x1, y1 }, axis, thickness: 3 })

  it('a 2 m wall drawn 3 m beside the only body is an unexplained wall, though the decomposition is 100% represented', () => {
    const out = bodyCompleteness({ decomposition: house(), frame, built: [{ id: 'mass-0', ring: rectangleRing(0, 0, 2, 2) }], dropped: [], gaps: [], bands: [band(48, 0, 51, 20, 'VERTICAL')] })
    expect(out.coverage).toBe(1)
    expect(out.unexplainedWalls).toHaveLength(1)
    expect(out.unexplainedWalls[0].lengthM).toBeCloseTo(2, 6)
    const v = modelCompleteness({ body: out, gateReasons: [], modelRefusals: 0 })
    expect(v.verdict).toBe('COMPLETE_WITH_OPEN_QUESTIONS')
    expect(v.why).toContain('no body or named area accounts for')
  })

  it("the body's own outer walls, drawn just outside its footprint, and a wall shorter than a metre, are not unexplained", () => {
    const out = bodyCompleteness({ decomposition: house(), frame, built: [{ id: 'mass-0', ring: rectangleRing(0, 0, 2, 2) }], dropped: [], gaps: [], bands: [band(20, 0, 23, 20, 'VERTICAL'), band(0, 20, 20, 23, 'HORIZONTAL'), band(48, 0, 51, 8, 'VERTICAL')] })
    expect(out.unexplainedWalls).toEqual([])
  })

  it('a wall outside the plan’s dimensioned extent (a title block, a north arrow) is not the reading’s to explain', () => {
    const out = bodyCompleteness({ decomposition: house(), frame, built: [{ id: 'mass-0', ring: rectangleRing(0, 0, 2, 2) }], dropped: [], gaps: [], bands: [band(80, 0, 83, 30, 'VERTICAL')] })
    expect(out.unexplainedWalls).toEqual([])
  })
})

describe('N7-FIX-04 (B/C): one verdict, four questions', () => {
  const body = { drawnBuiltM2: 4, representedM2: 4, coverage: 1, areas: [], missing: [], unexplainedWalls: [] }
  it('nothing missing, refused, blocking, unresolved or degrading: COMPLETE', () => {
    expect(modelCompleteness({ body, gateReasons: [{ code: 'STRUCTURE_PROJECTS', severity: 'NOTED', what: 'fits' }], modelRefusals: 0 }).verdict).toBe('COMPLETE')
  })
  it('a BLOCKING reason on the chosen layout makes it PARTIAL, whatever the coverage says', () => {
    const v = modelCompleteness({ body, gateReasons: [{ code: 'STRUCTURE_SILHOUETTE_DISAGREES', severity: 'BLOCKING', what: '2.46 m off the rear elevation' }], modelRefusals: 0 })
    expect(v.verdict).toBe('PARTIAL')
    expect(v.decomposition.coverage).toBe(1)
    expect(v.conflicts.blocking.map((b) => b.code)).toEqual(['STRUCTURE_SILHOUETTE_DISAGREES'])
  })
  it('an object the model refused makes it PARTIAL; a degrading conflict alone leaves open questions', () => {
    expect(modelCompleteness({ body, gateReasons: [], modelRefusals: 1 }).verdict).toBe('PARTIAL')
    expect(modelCompleteness({ body, gateReasons: [{ code: 'ROOF_EVIDENCE_DISAGREES', severity: 'DEGRADING', what: 'x' }], modelRefusals: 0 }).verdict).toBe('COMPLETE_WITH_OPEN_QUESTIONS')
  })
})
