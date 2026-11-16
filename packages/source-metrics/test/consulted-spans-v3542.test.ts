import { describe, expect, it } from 'vitest'
import { admitSpans, lengthCmOf, snapSpan } from '../src/consulted-spans.js'
import type { ConsultedSpan } from '../src/consulted-spans.js'

// v3.54.2 pilot counter-trials for whole consulted dimensions (SYNTHETIC drawings, written for the test).
const W = 400
const H = 300
/** A white sheet with a horizontal dimension line at y=40 from x=50 to x=350 (ticks at 50 and 350) and a vertical one at x=30 from y=60 to y=260. */
function sheet(): { width: number; height: number; data: Uint8ClampedArray } {
  const data = new Uint8ClampedArray(W * H).fill(255)
  const ink = (x: number, y: number): void => void (data[y * W + x] = 0)
  for (let x = 40; x <= 360; x += 1) ink(x, 40)
  for (const x of [50, 350]) for (let y = 28; y <= 52; y += 1) ink(x, y)
  for (let y = 50; y <= 270; y += 1) ink(30, y)
  for (const y of [60, 260]) for (let x = 18; x <= 42; x += 1) ink(x, y)
  return { width: W, height: H, data }
}
const span = (id: string, literal: string, unit: ConsultedSpan['unit'], from: [number, number], to: [number, number]): ConsultedSpan => ({ proposalId: id, frameId: 'f', literal, unit, from: { x: from[0], y: from[1] }, to: { x: to[0], y: to[1] }, consultant: { engine: 't', model: 't' } })

describe('v3.54.2 consulted whole dimensions (consulted-spans.ts)', () => {
  it('parses lengths by the analyzer’s rules: cm, decimal metres, feet-inches exactly; refuses the rest', () => {
    expect(lengthCmOf('690', 'cm')).toBe(690)
    expect(lengthCmOf('15,98', 'm')).toBe(1598)
    expect(lengthCmOf('47\'-1"', 'ft-in')).toBeCloseTo(1435.1, 6)
    expect(lengthCmOf("28'-0\"", 'ft-in')).toBeCloseTo(853.44, 6)
    expect(lengthCmOf("36'", 'ft-in')).toBeCloseTo(1097.28, 6)
    expect(lengthCmOf('47\'-13"', 'ft-in')).toBeUndefined()
    expect(lengthCmOf('6,90', 'cm')).toBeUndefined()
    expect(lengthCmOf('690', 'm')).toBeUndefined()
    expect(lengthCmOf('approx 690', 'cm')).toBeUndefined()
  })
  it('snaps both ends to the ticks within the search window, whatever the consultant’s few pixels of error', () => {
    const r = snapSpan(sheet(), span('a', '600', 'cm', [56, 41], [343, 39]))
    expect('snapped' in r && r.snapped).toMatchObject({ axis: 'X', fromPx: 50, toPx: 350, lengthPx: 300, cmPerPx: 2 })
  })
  it('counter-trials: an end with no stroke near it, a skewed span, a too-short span', () => {
    expect('refused' in snapSpan(sheet(), span('b', '600', 'cm', [100, 40], [350, 40])) && (snapSpan(sheet(), span('b', '600', 'cm', [100, 40], [350, 40])) as { refused: string }).refused).toMatch(/^SNAP_FAILED/)
    expect((snapSpan(sheet(), span('c', '600', 'cm', [50, 40], [350, 200])) as { refused: string }).refused).toMatch(/^NOT_AXIS_ALIGNED/)
    expect((snapSpan(sheet(), span('d', '60', 'cm', [50, 40], [80, 40])) as { refused: string }).refused).toMatch(/^TOO_SHORT/)
  })
  it('admits a scale only on two dimensions on different lines that agree; one alone, or a wrong digit, settles nothing', () => {
    const g = sheet()
    const x = snapSpan(g, span('x', '600', 'cm', [50, 40], [350, 40]))
    const y = snapSpan(g, span('y', '400', 'cm', [30, 60], [30, 260]))
    const yWrong = snapSpan(g, span('yw', '460', 'cm', [30, 60], [30, 260]))
    if (!('snapped' in x) || !('snapped' in y) || !('snapped' in yWrong)) throw new Error('snap')
    expect(admitSpans([x.snapped]).scale).toBeUndefined()
    expect(admitSpans([x.snapped]).why).toMatch(/^ONE_WITNESS/)
    const ok = admitSpans([x.snapped, y.snapped])
    expect(ok.scale).toMatchObject({ cmPerPixelX: 2, cmPerPixelY: 2 })
    expect(admitSpans([x.snapped, yWrong.snapped]).why).toMatch(/^NO_AGREEMENT/)
    // the same dimension given twice is one line, not two
    expect(admitSpans([x.snapped, { ...x.snapped, proposalId: 'x2' }]).scale).toBeUndefined()
    // a scale the plan's walls rule out is refused
    expect(admitSpans([x.snapped, y.snapped], () => false).why).toMatch(/^IMPLAUSIBLE/)
  })
})
