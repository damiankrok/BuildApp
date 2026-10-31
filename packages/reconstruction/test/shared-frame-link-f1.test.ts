/**
 * LINK-F1: the base plan's chain ladders kept in one frame with the sheet. A statement pins its grid lines only when it
 * is printed and agrees with the longer statements to within its own pixel uncertainty; otherwise it is kept as a
 * rejected anchor with its residual and every line stays where the drawing has it — so the bodies placed through the
 * ladder and the walls, gaps and openings the solver maps linearly off the same sheet agree to within that uncertainty.
 *
 * Invented sheets only: no house, no coordinates from a real drawing.
 */
import { describe, expect, it } from 'vitest'
import { LADDER_TICK_PX, axisLadder, sheetScale } from '../src/layout.js'
import type { AxisLadder } from '../src/layout.js'

type Seg = { from: number; to: number; cm: number; origin?: 'READ' | 'CHAIN_CORRECTED' | 'DERIVED' }
let evidenceSeq = 0
/** A horizontal chain and the evidence its segments cite. */
function chain(id: string, segs: readonly Seg[]): { chain: unknown; evidence: unknown[] } {
  const evidence = segs.map((s) => ({ id: `ev-${id}-${(evidenceSeq += 1)}`, unit: 'cm', value: s.cm, origin: s.origin ?? 'READ' }))
  return {
    chain: { id, axis: 'HORIZONTAL', segments: segs.map((s, i) => ({ fromPx: s.from, toPx: s.to, valueCm: s.cm, origin: s.origin ?? 'READ', evidenceId: evidence[i].id })) },
    evidence,
  }
}
const lines = (...px: number[]) => px.map((p) => ({ axis: 'X' as const, px: p }))
function ladderOf(gridPx: number[], chains: Array<{ chain: unknown; evidence: unknown[] }>, mpp = 0.025): AxisLadder {
  return axisLadder(lines(...gridPx) as never, chains.map((c) => c.chain) as never, chains.flatMap((c) => c.evidence) as never, 'X', mpp, gridPx[0], 6)
}
const metresAt = (l: AxisLadder, px: number[]) => px.map((p) => l.at(p))

describe('LINK-F1 ladder: which statements pin the frame', () => {
  // An 800 px plan at 0.025 m/px: the overall 20.00 m lands on both outer lines.
  const grid = [100, 300, 500, 900]
  const overall = () => chain('overall', [{ from: 100, to: 900, cm: 2000 }])

  it('a long, landed overall dimension beats a short noisy span: the short one is rejected, the line stays at its pixels', () => {
    // 200 px is 5.00 m at the sheet's scale; a weak reading says 5.40 m (16 px off) over the same two lines.
    const l = ladderOf(grid, [overall(), chain('short', [{ from: 100, to: 300, cm: 540, origin: 'CHAIN_CORRECTED' }])])
    expect(l.at(900)).toBe(20)
    expect(l.at(300)).toBeCloseTo(5, 6)
    const rejected = l.anchors.find((a) => a.disposition === 'REJECTED_RESIDUAL')
    expect(rejected).toMatchObject({ fromPx: 100, toPx: 300, metres: 5.4 })
    expect(rejected?.residualPx).toBeCloseTo(16, 3)
  })

  it('a small closure error within the pixel uncertainty is honoured exactly: the printed number wins', () => {
    // 5.03 m over 200 px is 1.2 px off the overall's scale: within two tick localisations.
    const l = ladderOf(grid, [overall(), chain('room', [{ from: 100, to: 300, cm: 503 }])])
    expect(l.at(300)).toBe(5.03)
    expect(l.anchors.filter((a) => a.disposition === 'PINNED')).toHaveLength(2)
    expect(2 * LADDER_TICK_PX).toBe(2)
  })

  it('a statement whose tick sits off the line implies that line less certainly: its own miss widens what it may disagree by', () => {
    // the chain's middle tick is at 297, 3 px off line 300; 4.92 m (−3.2 px at the overall's scale) still pins, the
    // same statement landing on the line is rejected
    const off = ladderOf(grid, [overall(), chain('off', [{ from: 100, to: 297, cm: 492 }, { from: 297, to: 500, cm: 508 }])])
    const anchor = off.anchors.find((a) => a.fromPx === 100 && a.toPx === 300)
    expect(anchor?.disposition).toBe('PINNED')
    expect(anchor?.allowedPx).toBeCloseTo(2 * LADDER_TICK_PX + 3 + 0.2, 6)
    const on = ladderOf(grid, [overall(), chain('on', [{ from: 100, to: 300, cm: 492 }, { from: 300, to: 500, cm: 508 }])])
    expect(on.anchors.find((a) => a.fromPx === 100 && a.toPx === 300)?.disposition).toBe('REJECTED_RESIDUAL')
  })

  it('a wrong digit or a tick matched to the wrong line is a conflict of measure, named, never a bent frame', () => {
    // "514" read for 554 between lines 500 and 900? 400 px is 10.00 m; 5.14 m is wildly off and is rejected.
    const l = ladderOf(grid, [overall(), chain('misread', [{ from: 500, to: 900, cm: 514 }])])
    expect(l.at(500)).toBeCloseTo(10, 6)
    expect(l.anchors.find((a) => a.chainIds.includes('misread'))?.disposition).toBe('REJECTED_RESIDUAL')
  })

  it('the first (longest) statement sets the scale, even where the sheet was fitted otherwise; the rest are weighed against it', () => {
    // a sheet whose fitted scale is half the chains' (a fixture's 0.026 m/px against 5 cm/px chains, say)
    const l = ladderOf(grid, [overall(), chain('room', [{ from: 100, to: 300, cm: 503 }])], 0.0125)
    expect(l.anchors[0]).toMatchObject({ disposition: 'PINNED', metres: 20 })
    expect(l.at(900)).toBe(20)
    expect(l.at(300)).toBe(5.03)
  })

  it('a span summed over a DERIVED segment (nothing printed) pins nothing; the printed pieces still can', () => {
    // the chain's own scale 0.0262 m/px filled the blanks: 5.24 m over 200 px; the printed 5.00 m sits on the pixels
    const c = chain('detail', [
      { from: 100, to: 300, cm: 524, origin: 'DERIVED' },
      { from: 300, to: 500, cm: 500 },
    ])
    const l = ladderOf(grid, [overall(), c])
    expect(l.anchors.filter((a) => a.disposition === 'NOT_PRINTED').map((a) => [a.fromPx, a.toPx])).toEqual([
      [100, 500],
      [100, 300],
    ])
    expect(l.at(300)).toBeCloseTo(5, 6)
    expect(l.at(500)).toBeCloseTo(10, 6)
  })

  it('with nothing stated (a sheet with no chains, or chains of another sheet) the frame is the sheet’s scale, unbent', () => {
    const l = ladderOf(grid, [])
    expect(l.anchors).toEqual([])
    expect(metresAt(l, grid)).toEqual([0, 5, 10, 20])
  })

  it('keeps the topology: one tick between two lines a wall apart never collapses the wall, and the metres rise with the pixels', () => {
    // two band edges 9.5 px apart (a wall), a derived chain whose tick sits between them, within tolerance of both
    const g = [100, 441.5, 451, 900]
    const l = ladderOf(g, [chain('ov', [{ from: 100, to: 900, cm: 2000 }]), chain('d', [{ from: 100, to: 446, cm: 865, origin: 'DERIVED' }])])
    const m = metresAt(l, g)
    expect(m[2] - m[1]).toBeCloseTo(9.5 * 0.025, 6)
    for (let i = 1; i < m.length; i += 1) expect(m[i]).toBeGreaterThan(m[i - 1])
  })

  it('lines nothing measured, beyond the fixed ones, keep the sheet’s scale (the strip outside the walls is not rescaled)', () => {
    const g = [100, 237, 1000]
    const l = ladderOf(g, [chain('s', [{ from: 100, to: 237, cm: 344 }])])
    expect(l.at(237)).toBe(3.44)
    expect(l.at(1000)).toBeCloseTo(3.44 + 763 * 0.025, 6)
  })

  it('is deterministic and does not depend on the order the chains or their evidence arrive in', () => {
    const cs = [overall(), chain('a', [{ from: 100, to: 300, cm: 503 }]), chain('b', [{ from: 300, to: 500, cm: 540, origin: 'CHAIN_CORRECTED' }]), chain('c', [{ from: 500, to: 900, cm: 1000, origin: 'DERIVED' }])]
    const one = ladderOf(grid, cs)
    const two = axisLadder(lines(...grid) as never, [...cs].reverse().map((c) => c.chain) as never, cs.flatMap((c) => c.evidence).reverse() as never, 'X', 0.025, 100, 6)
    expect(metresAt(two, grid)).toEqual(metresAt(one, grid))
    expect(two.anchors).toEqual(one.anchors)
  })
})

describe('LINK-F1 sheetScale: one sheet, one scale unless the anchors prove a stretch', () => {
  const anchor = (axis: 'X' | 'Y', pixelSpan: number) => ({ axis, pixelSpan }) as never
  it('two short anchors on one axis prove no 1 % stretch: the sheet takes the long axis’s scale', () => {
    // 10.5 m over 517 px on X; 0.55 m / 28.5 px and 0.77 m / 38 px on Y — the Y "scale" is its pixel rounding
    const s = sheetScale({ metresPerPixelX: 0.02031, metresPerPixelY: 0.020108, anchors: [anchor('X', 517), anchor('Y', 28.5), anchor('Y', 38)] })
    expect(s.isotropic).toBe(true)
    expect(s.mppX).toBe(s.mppY)
    expect(s.mppX).toBeCloseTo(0.02031, 4)
  })
  it('long anchors on both axes that differ by more than both can locate keep their own scales', () => {
    const s = sheetScale({ metresPerPixelX: 0.025, metresPerPixelY: 0.02575, anchors: [anchor('X', 600), anchor('Y', 500)] })
    expect(s).toMatchObject({ isotropic: false, mppX: 0.025, mppY: 0.02575 })
  })
  it('a sheet measured on one axis is left as the registration scaled it', () => {
    expect(sheetScale({ metresPerPixelX: 0.02, metresPerPixelY: 0.02, anchors: [anchor('X', 300)] })).toMatchObject({ mppX: 0.02, mppY: 0.02 })
  })
})
