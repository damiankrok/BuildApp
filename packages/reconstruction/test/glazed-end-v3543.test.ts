import { describe, expect, it } from 'vitest'
import { glazedEndClosure } from '../src/plan-decomposition.js'
import type { Band } from '@buildapp/source-cv'
import type { DimensionChain } from '@buildapp/source-metrics'

// v3.54.3 CLASSIFY_BOUNDARY consumer on SYNTHETIC bands and chains (written for the test): two long side walls, one
// cross wall at the bottom, and a read vertical dimension chain from that wall to where the (glazed) far end is.
const W = 10
const band = (axis: 'VERTICAL' | 'HORIZONTAL', axisPx: number, from: number, to: number): Band =>
  ({ axis, axisPx, thickness: W, length: to - from, bounds: axis === 'VERTICAL' ? { x0: axisPx - W / 2, x1: axisPx + W / 2, y0: from, y1: to } : { x0: from, x1: to, y0: axisPx - W / 2, y1: axisPx + W / 2 } }) as unknown as Band
const chain = (ticks: [number, number], origin: 'READ' | 'DERIVED' = 'READ'): DimensionChain =>
  ({ id: 'chain-v', frameId: 'f', assetId: 'a', axis: 'VERTICAL', baselinePx: 20, ticksPx: ticks, segments: [{ index: 0, fromPx: ticks[0], toPx: ticks[1], pixelLength: ticks[1] - ticks[0], valueCm: 1350, origin, confidence: 0.9 }], closes: true, observationIds: [], ocrTokenIds: [] }) as DimensionChain
// side walls at x = 100 and x = 400 running y 100..700; the only cross wall at y = 700; the box is degenerate across y
const long = [band('VERTICAL', 100, 100, 700), band('VERTICAL', 400, 100, 700), band('HORIZONTAL', 700, 95, 405)]
const degenerate = { x0: 95, y0: 695, x1: 405, y1: 705 }

describe('v3.54.3 a fully glazed end is closed only on a side a correction classified, and only where the drawing says so', () => {
  it('closes at the far tick of a read chain both side walls run along, on the classified side', () => {
    expect(glazedEndClosure(long, [chain([100, 700])], degenerate, W, ['TOP'])).toMatchObject({ y0: 100, y1: 705 })
  })
  it('counter-trials: another side classified, no side, a chain that is not read, a side wall that stops short', () => {
    expect(glazedEndClosure(long, [chain([100, 700])], degenerate, W, ['BOTTOM', 'LEFT', 'RIGHT'])).toEqual(degenerate)
    expect(glazedEndClosure(long, [chain([100, 700])], degenerate, W, [])).toEqual(degenerate)
    expect(glazedEndClosure(long, [chain([100, 700], 'DERIVED')], degenerate, W, ['TOP'])).toEqual(degenerate)
    // an open porch: one side wall returns only a third of the way (a loggia's return), so nothing is closed
    const porch = [band('VERTICAL', 100, 100, 700), band('VERTICAL', 400, 500, 700), band('HORIZONTAL', 700, 95, 405)]
    expect(glazedEndClosure(porch, [chain([100, 700])], degenerate, W, ['TOP'])).toEqual(degenerate)
  })
})
