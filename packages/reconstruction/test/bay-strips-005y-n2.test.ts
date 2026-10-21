/**
 * BUILDPLAN-ANALYZER-005Y-N2: a body's front reaching its outer face through strips too thin to be bodies
 * (`bayStripsOf`). A synthetic decomposition: a walled body on the top row, and below it, between the body's face and
 * the walls' face, two enclosed strips drawn shut across their outer face by line work (a window, a door between two
 * short piers) with a pocket between them that the flood fill reached, shut behind and at both ends — an entrance porch.
 *  - the body takes the strips and reaches the walls' face, and the pocket is a recess open at its mouth;
 *  - a pocket open behind, a stretch at a corner, a strip not shut across its face, or a strip as deep as a body of its
 *    own: nothing is taken, and the refusal is named.
 */
import { describe, expect, it } from 'vitest'
import { bayStripsOf, perimeterWallEvidence } from '../src/layout.js'
import type { WorldFrame } from '../src/layout.js'
import type { EdgeClosure, PlanCell, PlanDecomposition, PlanRegion } from '../src/plan-decomposition.js'

const e = (wall: number, closure: number): EdgeClosure => ({ wall, line: Math.max(0, closure - wall), opening: 0, closure })
const WALL = e(1, 1)
const LINE = e(0, 1)
const OPEN = e(0, 0)
const frame: WorldFrame = { metresPerPixelX: 0.05, metresPerPixelY: 0.05, originPx: { x: 0, y: 0 } }

type Spec = { pocketBack?: EdgeClosure; stripFace?: EdgeClosure; depthPx?: number; cornerStrip?: boolean }
function plan(spec: Spec = {}): { decomposition: PlanDecomposition; regions: PlanRegion[] } {
  const depth = spec.depthPx ?? 16
  const xs = [0, 100, 140, spec.cornerStrip ? 200 : 240, 240]
  const ys = [0, 200, 200 + depth]
  const cell = (ix: number, iy: number, classification: PlanCell['classification'], edges: PlanCell['edges']): PlanCell => ({ ix, iy, rect: { x0: xs[ix], x1: xs[ix + 1], y0: ys[iy], y1: ys[iy + 1] }, classification, edges, enclosed: classification === 'BUILT', interiorInk: 0, confidence: 0.8, why: 'test' })
  const face = spec.stripFace ?? LINE
  const cells: PlanCell[] = [
    // the body: walled on its top and sides; its bottom is the line it was cut on (the porch's back wall in the middle)
    cell(0, 0, 'BUILT', [WALL, LINE, LINE, WALL]),
    cell(1, 0, 'BUILT', [WALL, LINE, e(0.5, 1), LINE]),
    cell(2, 0, 'BUILT', [WALL, LINE, LINE, LINE]),
    cell(3, 0, 'BUILT', [WALL, WALL, LINE, LINE]),
    // the strips, the pocket between them, and (in one case) a corner stretch the flood fill reached
    cell(0, 1, 'BUILT', [LINE, LINE, face, WALL]),
    cell(1, 1, 'OUTSIDE', [spec.pocketBack ?? e(0.6, 1), LINE, OPEN, LINE]),
    cell(2, 1, 'BUILT', [LINE, spec.cornerStrip ? LINE : LINE, face, LINE]),
    cell(3, 1, spec.cornerStrip ? 'OUTSIDE' : 'BUILT', [LINE, WALL, spec.cornerStrip ? OPEN : face, LINE]),
  ]
  const region = (id: string, cs: Array<[number, number]>): PlanRegion => {
    const own = cells.filter((c) => cs.some(([x, y]) => c.ix === x && c.iy === y))
    const rect = { x0: Math.min(...own.map((c) => c.rect.x0)), x1: Math.max(...own.map((c) => c.rect.x1)), y0: Math.min(...own.map((c) => c.rect.y0)), y1: Math.max(...own.map((c) => c.rect.y1)) }
    return { id, classification: 'BUILT', rect, metric: { x0: rect.x0 * 0.05, z0: rect.y0 * 0.05, x1: rect.x1 * 0.05, z1: rect.y1 * 0.05 }, cells: cs.map(([ix, iy]) => ({ ix, iy })), confidence: 0.8, why: 'cells merged' }
  }
  const regions = [region('body', [[0, 0], [1, 0], [2, 0], [3, 0]]), region('strip-a', [[0, 1]]), region('strip-b', spec.cornerStrip ? [[2, 1]] : [[2, 1], [3, 1]])]
  const decomposition = { frameId: 'f', wallThickness: { px: 10, m: 0.5 }, envelope: { rect: { x0: 0, y0: 0, x1: 240, y1: 200 + depth }, metric: { x0: 0, z0: 0, x1: 12, z1: (200 + depth) * 0.05 }, bands: { vertical: 2, horizontal: 2 }, why: 'test' }, linesX: [], linesY: [], cells, regions, extent: { x0: 0, y0: 0, x1: 240, y1: 200 + depth }, unresolved: [], wideOpenings: [], bays: [], hypotheses: [], chosenHypothesis: null } as unknown as PlanDecomposition
  return { decomposition, regions }
}

describe('a body’s front reaching its outer face through thin strips', () => {
  it('is a precondition of the fixture that the body is walled and the strips are not', () => {
    const { decomposition, regions } = plan()
    expect(perimeterWallEvidence(regions[0], decomposition, frame).fraction).toBeGreaterThanOrEqual(0.35)
    expect(perimeterWallEvidence(regions[1], decomposition, frame).fraction).toBeLessThan(0.35)
    expect(perimeterWallEvidence(regions[2], decomposition, frame).fraction).toBeLessThan(0.35)
  })

  it('takes the strips into the body to the walls’ face, and names the pocket between them a recess', () => {
    const { decomposition, regions } = plan()
    const out = bayStripsOf(regions, decomposition, frame, 1.2)
    expect(out.regions.map((r) => r.id)).toEqual(['body'])
    expect(out.regions[0].rect).toEqual({ x0: 0, x1: 240, y0: 0, y1: 216 })
    expect(out.regions[0].cells).toHaveLength(7)
    expect(out.pockets).toEqual([expect.objectContaining({ bodyRegionId: 'body', side: 'MAX_Z', rect: { x0: 100, x1: 140, y0: 200, y1: 216 } })])
  })

  it('takes nothing when the pocket is open behind', () => {
    const { decomposition, regions } = plan({ pocketBack: OPEN })
    const out = bayStripsOf(regions, decomposition, frame, 1.2)
    expect(out.regions.map((r) => r.id)).toEqual(['body', 'strip-a', 'strip-b'])
    expect(out.pockets).toEqual([])
    expect(out.traces.join(' ')).toMatch(/not shut along the body's face behind it/)
  })

  it('takes nothing when a stretch at a corner is left: a notch, not a recess', () => {
    const { decomposition, regions } = plan({ cornerStrip: true })
    const out = bayStripsOf(regions, decomposition, frame, 1.2)
    expect(out.pockets).toEqual([])
    expect(out.traces.join(' ')).toMatch(/notch at a corner/)
  })

  it('takes nothing when a strip is not shut across its outer face', () => {
    const { decomposition, regions } = plan({ stripFace: OPEN })
    const out = bayStripsOf(regions, decomposition, frame, 1.2)
    expect(out.pockets).toEqual([])
    expect(out.traces.join(' ')).toMatch(/not shut along its outer face/)
  })

  it('leaves strips as deep as a body of their own to be weighed as bodies', () => {
    const { decomposition, regions } = plan({ depthPx: 30 })
    const out = bayStripsOf(regions, decomposition, frame, 1.2)
    expect(out.regions.map((r) => r.id)).toEqual(['body', 'strip-a', 'strip-b'])
    expect(out.traces).toEqual([])
  })
})
