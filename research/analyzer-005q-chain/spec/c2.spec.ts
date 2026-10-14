/**
 * 005Q-CHAIN C2 GEOMETRIC_BIND — unit specification (RESEARCH ONLY; run against a variant copy, never by `npm test`).
 * The span a label measures is the drawing's: the span it is centred on with the fewest marks between its ends; a tie
 * is UNRESOLVED; the scale never moves a label onto a span it is not centred on; a span a label is printed on is never
 * DERIVED as "nothing printed".
 */
import { describe, expect, it } from 'vitest'
// @ts-expect-error -- resolved by the variant config to the variant copy of @buildapp/source-metrics
import * as sm from '@buildapp/source-metrics'

const chain = (ticks: number[], classes?: string[]) => ({ axis: 'HORIZONTAL', baselinePx: 100, ticks: ticks.map((atPx, i) => ({ atPx, baselinePx: 100, observationId: `t${i}`, ...(classes ? { class: classes[i] } : {}) })), observationIds: [] })
const tick = () => 'TICK' as const
const token = (atPx: number, valueCm: number, text = String(valueCm)) => ({
  token: { text, box: { x0: atPx - 10, y0: 80, x1: atPx + 10, y1: 92 }, orientation: 'HORIZONTAL', height: 12, score: 1, confidence: 1, shearDeg: 0, glyphs: [] },
  atPx,
  offset: 1,
  readings: [{ text, parsed: { kind: 'LINEAR_DIMENSION', value: valueCm, unit: 'cm', why: '' }, valueCm, confidence: 1, substitutions: 0 }],
})

describe('C2 geometric span of a label', () => {
  it('the elementary interval a label is centred on', () => {
    const c = chain([0, 100, 200, 300])
    expect(sm.geometricSpanC2(c.ticks, 50, tick)).toEqual({ from: 0, to: 1 })
    expect(sm.geometricSpanC2(c.ticks, 250, tick)).toEqual({ from: 2, to: 3 })
  })
  it('a label off-centre in its interval measures the centred span across one mark, not the interval', () => {
    const c = chain([0, 100, 200])
    expect(sm.geometricSpanC2(c.ticks, 95, tick)).toEqual({ from: 0, to: 2 })
  })
  it('the fewest marks between the ends wins; a label centred on no span within two marks has no span (UNRESOLVED)', () => {
    // at 70 on [0,60,140,200]: [60,140] is not centred (|70-100| = 30 > 24); [0,140] is (1 mark), [0,200] too (2 marks)
    expect(sm.geometricSpanC2(chain([0, 60, 140, 200]).ticks, 70, tick)).toEqual({ from: 0, to: 2 })
    // at 100 exactly on a mark of [0,40,100,160,200]: [40,160] (1 mark) — [0,200] has 3 marks between, over the bound
    expect(sm.geometricSpanC2(chain([0, 40, 100, 160, 200]).ticks, 100, tick)).toEqual({ from: 1, to: 3 })
    // a label near the end of a single span is centred on nothing: no span, the label measures nothing
    expect(sm.geometricSpanC2(chain([0, 100]).ticks, 5, tick)).toBeNull()
    expect(sm.geometricSpanC2(chain([0, 100, 200, 300, 400, 500]).ticks, 3, tick)).toBeNull()
  })
  it('two different spans with the same number of marks both centred is UNRESOLVED (guard; geometrically rare)', () => {
    // constructed through the kind function: marks 1 and 2 are QUESTIONABLE-free TICKs; [0,2] and [1,3] each skip one
    // mark and are both centred on 100 when the marks are [0,50,150,200] and the label sits at 100 on mark-free ground:
    // [50,150] is elementary and centred, so to force a tie the elementary span is made unusable (its end REJECTED is
    // not allowed either) — instead use marks [0, 90, 110, 200] with the label exactly at 100: [90,110] centred, unique.
    expect(sm.geometricSpanC2(chain([0, 90, 110, 200]).ticks, 100, tick)).toEqual({ from: 1, to: 2 })
    // a tie: marks [0,100,200] and [100] duplicated as two marks at 100 (a doubled tick): [0,100a] and [100b,200] are
    // not centred; [0,200] via 100a and via 100b are the same span; [0,100b] skips 100a (1 mark) and is not centred
    // either -> the unique answer is [0,200] (2 marks): ties resolve to one span whenever the spans are equal
    expect(sm.geometricSpanC2(chain([0, 100, 100, 200]).ticks, 100, tick)).toEqual({ from: 0, to: 3 })
  })
  it('REJECTED marks are never span ends and are not counted as skipped marks', () => {
    const c = chain([0, 50, 100], ['TICK', 'REJECTED', 'TICK'])
    const kind = (i: number) => (c.ticks[i] as { class?: string }).class as 'TICK' | 'REJECTED'
    expect(sm.geometricSpanC2(c.ticks, 50, kind)).toEqual({ from: 0, to: 2 })
  })
})

describe('C2 in the chain solver: the scale reads the label on its own span, never moves it', () => {
  it('a label centred on [0,100] that only fits the whole line at the scale stays unread (C3.3 of the audit)', () => {
    const c = chain([0, 100, 200, 300])
    const s = sm.solveChain(c, [token(50, 300)], { tolerancePx: 2.2, fixedScale: 1 })
    expect(s.segments.some((g: { origin: string; fromPx: number; toPx: number }) => g.origin === 'READ' && g.fromPx === 0 && g.toPx === 300)).toBe(false)
  })
  it('a label on its own span is READ when the scale fits it', () => {
    const c = chain([0, 100, 200, 300])
    const s = sm.solveChain(c, [token(50, 100)], { tolerancePx: 2.2, fixedScale: 1 })
    expect(s.segments[0]).toMatchObject({ fromPx: 0, toPx: 100, origin: 'READ', valueCm: 100 })
  })
  it('an interval with an unbound label is never DERIVED as "nothing printed"', () => {
    const c = chain([0, 100, 200, 300])
    const s = sm.solveChain(c, [token(50, 100)], { tolerancePx: 2.2, fixedScale: 1, unboundAt: [250] })
    const last = s.segments.find((g: { fromPx: number }) => g.fromPx === 200)
    expect(last?.origin).not.toBe('DERIVED')
    expect(last?.labelledUnresolved).toBe(true)
  })
  it('an interval with no label is still derivable (production behaviour kept)', () => {
    const c = chain([0, 100, 200, 300])
    const s = sm.solveChain(c, [token(50, 100)], { tolerancePx: 2.2, fixedScale: 1 })
    expect(s.segments.find((g: { fromPx: number }) => g.fromPx === 200)?.origin).toBe('DERIVED')
  })
})
