import { describe, expect, it } from 'vitest'
import { chainId, solveFrameChains, solveFrameMetric } from '../src/index.js'
import type { ChainTick, RawChain, TextOrientation, TextToken } from '../src/index.js'

/**
 * BUILDPLAN-ANALYZER-005D §40 and §30: label binding and value ambiguity, held to adversaries made
 * of hand-made tokens (the reader's own output shape, no drawing). Glyph ambiguity is what the
 * reader reports — a runner-up glyph and its score ratio — never a substitution table: no test
 * below, and nothing in the solver, knows which digits look alike.
 *
 * The cases are shaped like the defects 005D was opened for (an italic overall figure whose third
 * digit half-matches another, a figure whose second digit does) but the numbers are this file's
 * own; what is held is the contract, not a value.
 */

const H = 14

function token(text: string, box: { x0: number; y0: number; x1: number; y1: number }, orientation: TextOrientation, alts: Record<number, Array<{ char: string; ratio: number }>> = {}, height = H): TextToken {
  const n = text.length
  const vertical = orientation === 'ROTATED_CW' || orientation === 'ROTATED_CCW'
  return {
    text,
    score: 0.5,
    confidence: 0.6,
    box,
    shearDeg: 0,
    height,
    orientation,
    glyphs: [...text].map((char, i) => {
      const [f0, f1] = [i / n, (i + 1) / n]
      const gbox = vertical ? { x0: box.x0, x1: box.x1, y0: box.y0 + (box.y1 - box.y0) * f0, y1: box.y0 + (box.y1 - box.y0) * f1 } : { x0: box.x0 + (box.x1 - box.x0) * f0, x1: box.x0 + (box.x1 - box.x0) * f1, y0: box.y0, y1: box.y1 }
      return { char, score: 0.5, confidence: 0.6, alternatives: (alts[i] ?? []).map((a) => ({ char: a.char, score: 0.5 * a.ratio })), box: gbox, holes: { count: 0, cy: 0.5, areaFrac: 0 } }
    }),
  }
}
type Mark = number | { at: number; class: NonNullable<ChainTick['class']> }
const ticksOf = (marks: Mark[], baseline: number): ChainTick[] =>
  marks.map((m) => (typeof m === 'number' ? { atPx: m, baselinePx: baseline, observationId: '' } : { atPx: m.at, baselinePx: baseline, observationId: '', class: m.class, reasons: [] }))
const hChain = (y: number, marks: Mark[]): RawChain => ({ axis: 'HORIZONTAL', baselinePx: y, ticks: ticksOf(marks, y), observationIds: [] })
const vChain = (x: number, marks: Mark[]): RawChain => ({ axis: 'VERTICAL', baselinePx: x, ticks: ticksOf(marks, x), observationIds: [] })
const hLabel = (text: string, y: number, at: number, alts?: Record<number, Array<{ char: string; ratio: number }>>, height = H): TextToken => {
  const w = text.length * 9 * (height / H)
  return token(text, { x0: at - w / 2, x1: at + w / 2, y0: y - 5 - height, y1: y - 5 }, 'HORIZONTAL', alts, height)
}
const vLabel = (text: string, x: number, at: number, orientation: TextOrientation = 'ROTATED_CW', alts?: Record<number, Array<{ char: string; ratio: number }>>): TextToken => {
  const w = text.length * 9
  return token(text, { x0: x - 5 - H, x1: x - 5, y0: at - w / 2, y1: at + w / 2 }, orientation, alts)
}
const mid = (a: number, b: number): number => (a + b) / 2

const FRAME = 'frame-binding'
function solve(chains: RawChain[], tokens: TextToken[]) {
  const legacy = solveFrameChains(chains, tokens, { tolerancePx: 2.2 })
  const ids = chains.map((c) => chainId(FRAME, c.axis, c.baselinePx, c.ticks.map((t) => t.atPx)))
  const metric = solveFrameMetric({ frameId: FRAME, assetId: 'asset', chains, chainIds: ids, raw: tokens, legacyTokens: tokens, legacy, tolerancePx: 2.2 })
  const selected = metric.solution.hypotheses.find((h) => h.id === metric.solution.selectedHypothesisId)
  return { legacy, metric, solution: metric.solution, selected, ids }
}
const close = (a: number | undefined, b: number, rel = 0.005): boolean => a !== undefined && Math.abs(a / b - 1) <= rel

// An overall span of 556 px whose figure is printed 1055: as read, 1.8975 cm/px; its third glyph
// half-matches a 3 (as 1035, 1.8615 cm/px) — the two differ by 10 px over the span.
const SPAN: [number, number] = [100, 656]
const AMBIGUOUS_THIRD = { 2: [{ char: '3', ratio: 0.9 }] }

describe('§40 value ambiguity: a half-seen glyph is named, never resolved by a scale', () => {
  it('a lone overall figure is taken as read, its alternative recorded with the interval it implies, and it decides at most WEAK', () => {
    const { solution, metric, selected } = solve([hChain(700, SPAN)], [hLabel('1055', 700, mid(...SPAN), AMBIGUOUS_THIRD)])
    expect(close(selected?.cmPerPixel, 1055 / 556)).toBe(true)
    const obs = metric.observations.find((o) => o.rawText === '1055')
    expect(obs?.valueAlternatives?.map((a) => a.text)).toContain('1035')
    expect(solution.topology?.valueAmbiguity).toMatchObject({ rawText: '1055', alternatives: expect.arrayContaining(['1035']) })
    expect(solution.topology?.valueAmbiguity?.cmPerPixelLow).toBeCloseTo(1035 / 556, 4)
    expect(solution.topology?.valueAmbiguity?.cmPerPixelHigh).toBeCloseTo(1055 / 556, 4)
    expect(['WEAK', 'INCONCLUSIVE']).toContain(solution.confidence)
    // Nothing rewrote the figure: the only value bound to the span is the one read.
    expect(metric.observations.filter((o) => o.binding?.role === 'PRIMARY').map((o) => o.valueCm)).toEqual([1055])
  })

  it('with a spurious mark rejected under it, the figure is still bound to the whole span (not to the part the mark cuts off)', () => {
    const { metric, selected } = solve([hChain(700, [100, { at: 230, class: 'REJECTED' }, 656])], [hLabel('1055', 700, mid(...SPAN), AMBIGUOUS_THIRD)])
    const primary = metric.observations.filter((o) => o.binding?.role === 'PRIMARY')
    expect(primary.map((o) => [o.fromPx, o.toPx])).toEqual([[100, 656]])
    expect(primary[0].binding?.skipped).toEqual({ tick: 0, questionable: 0, rejected: 1 })
    expect(close(selected?.cmPerPixel, 1055 / 556)).toBe(true)
  })

  it('an ambiguous figure joined by two unambiguous readings, on the other axis and another chain, is SUPPORTED as read and no longer ambiguous', () => {
    const s = 1055 / 556
    const chains = [hChain(700, SPAN), vChain(760, [80, 80 + 700 / s]), hChain(300, [200, 200 + 500 / s])]
    const tokens = [hLabel('1055', 700, mid(...SPAN), AMBIGUOUS_THIRD), vLabel('700', 760, 80 + 350 / s), hLabel('500', 300, 200 + 250 / s)]
    const { solution, selected } = solve(chains, tokens)
    expect(close(selected?.cmPerPixel, s)).toBe(true)
    expect(selected?.independentGroups).toBe(3)
    expect(solution.topology?.valueAmbiguity).toBeUndefined()
    expect(['SUPPORTED', 'STRONG']).toContain(solution.confidence)
  })

  it('an ambiguous total over children that sum to it as read: the hierarchy agrees as read and the scale is corroborated', () => {
    const s = 1055 / 556
    const childAt = 100 + 400 / s
    const chains = [hChain(700, SPAN), hChain(735, [100, childAt, 656])]
    const tokens = [hLabel('1055', 700, mid(...SPAN), AMBIGUOUS_THIRD), hLabel('400', 735, mid(100, childAt)), hLabel('655', 735, mid(childAt, 656))]
    const { solution, metric, selected } = solve(chains, tokens)
    const total = metric.relations.find((r) => r.kind === 'TOTAL_OF')
    expect(total?.check).toBe('AGREES_AS_READ')
    expect(total?.sum).toMatchObject({ totalCm: 1055, partsCm: 1055 })
    expect(close(selected?.cmPerPixel, s)).toBe(true)
    expect(solution.topology?.valueAmbiguity).toBeUndefined()
    expect(solution.confidence).toBe('SUPPORTED')
  })

  it('an ink whose alternative fits the other scale decides nothing between them: the unambiguous reading does', () => {
    // 720 px printed 1601 (2.2236 cm/px), its second glyph half-matching an 8 (1801: 2.5014 cm/px);
    // the other axis states 2.5 unambiguously.
    const chains = [hChain(760, [60, 780]), vChain(820, [100, 420])]
    const tokens = [hLabel('1601', 760, 420, { 1: [{ char: '8', ratio: 0.8 }] }), vLabel('800', 820, 260)]
    const { solution, metric, selected } = solve(chains, tokens)
    const ambiguous = metric.observations.find((o) => o.rawText === '1601' && o.binding?.role === 'PRIMARY')
    expect(ambiguous).toBeDefined()
    expect(solution.topology?.neutralObservationIds).toContain(ambiguous?.id)
    expect(close(selected?.cmPerPixel, 2.5)).toBe(true)
    // The ambiguous ink is never counted for the scale it was not read at either.
    expect(selected?.witnessIds).not.toContain(ambiguous?.id)
    expect(['WEAK', 'INCONCLUSIVE']).toContain(solution.confidence)
  })

  it('stripping the alternatives makes the same ink a plain witness again: the decision moved only because the reader said it half-saw a glyph', () => {
    const chains = [hChain(760, [60, 780]), vChain(820, [100, 420])]
    const plain = solve(chains, [hLabel('1601', 760, 420), vLabel('800', 820, 260)])
    expect(plain.solution.topology?.neutralObservationIds ?? []).toEqual([])
    // Two overall readings on two axes at two scales: neither is corroborated, and the record says so.
    expect(plain.solution.confidence).not.toBe('SUPPORTED')
    expect(plain.solution.confidence).not.toBe('STRONG')
  })
})

describe('§40 label binding adversaries', () => {
  it('a label between two segments (centred on the tick that divides them) measures nothing', () => {
    const { metric, solution } = solve([hChain(700, [100, 300, 700])], [hLabel('400', 700, 300)])
    const obs = metric.observations.filter((o) => o.rawText === '400')
    expect(obs.length).toBeGreaterThan(0)
    expect(obs.every((o) => o.binding?.role !== 'PRIMARY')).toBe(true)
    expect(solution.independentWitnesses).toBe(0)
  })

  it('a nearby unrelated numeral (a logo, a sheet number) neither binds to the total nor displaces it', () => {
    const chains = [hChain(700, SPAN)]
    const tokens = [hLabel('1055', 700, mid(...SPAN)), hLabel('22', 690, 630, undefined, 30)]
    const { metric, selected } = solve(chains, tokens)
    const primary = metric.observations.filter((o) => o.binding?.role === 'PRIMARY')
    expect(primary.map((o) => o.rawText)).toEqual(['1055'])
    expect(close(selected?.cmPerPixel, 1055 / 556)).toBe(true)
  })

  it('a rotated label on a vertical chain is bound across a rejected mark the same way', () => {
    const chains = [vChain(820, [100, { at: 260, class: 'REJECTED' }, 656])]
    const { metric, selected } = solve(chains, [vLabel('1055', 820, mid(...SPAN), 'ROTATED_CW')])
    const primary = metric.observations.filter((o) => o.binding?.role === 'PRIMARY' && o.rawText === '1055')
    expect(primary.map((o) => [o.fromPx, o.toPx, o.axis])).toEqual([[100, 656, 'Y']])
    expect(close(selected?.cmPerPixel, 1055 / 556)).toBe(true)
  })

  it('a questionable mark may end a span only as a doubted end: the binding says how many ends it doubts', () => {
    const chains = [hChain(700, [100, { at: 656, class: 'QUESTIONABLE' }])]
    const { metric } = solve(chains, [hLabel('1055', 700, mid(...SPAN))])
    const primary = metric.observations.find((o) => o.binding?.role === 'PRIMARY')
    expect(primary?.binding?.questionableEnds).toBe(1)
  })

  it('a rejected mark never ends a span, even where a label is centred on the part it cuts off', () => {
    const chains = [hChain(700, [100, { at: 400, class: 'REJECTED' }, 656])]
    const { metric } = solve(chains, [hLabel('600', 700, 250)])
    expect(metric.observations.filter((o) => o.toPx === 400 || o.fromPx === 400)).toEqual([])
  })
})

describe('§30 independence: one ink is one witness', () => {
  it('a total and the off-centre part of it, bound from the same ink, are one witness', () => {
    const chains = [hChain(700, [100, 230, 656])]
    const { metric, solution } = solve(chains, [hLabel('1055', 700, mid(...SPAN))])
    const ofInk = metric.observations.filter((o) => o.rawText === '1055')
    expect(ofInk.map((o) => o.binding?.role).sort()).toEqual(['ALTERNATIVE', 'PRIMARY'])
    expect(new Set(ofInk.map((o) => o.textRegionId)).size).toBe(1)
    expect(solution.hypotheses.reduce((a, h) => a + h.independentGroups, 0)).toBe(1)
    expect(solution.independentWitnesses).toBe(1)
  })

  it('one label between two copies of the same chain is counted once, not once per copy', () => {
    const chains = [hChain(700, SPAN), hChain(712, SPAN)]
    const { solution, metric } = solve(chains, [hLabel('1055', 706 + 5 + H / 2, mid(...SPAN))])
    expect(metric.relations.some((r) => r.kind === 'PARALLEL_COPY_OF')).toBe(true)
    expect(solution.hypotheses.reduce((a, h) => a + h.independentGroups, 0)).toBeLessThanOrEqual(1)
  })

  it('the same ink read both ways up is one region and at most one witness', () => {
    const chains = [hChain(700, SPAN)]
    const upright = hLabel('1055', 700, mid(...SPAN))
    const inverted = { ...upright, text: '5501', orientation: 'INVERTED' as const, glyphs: [...upright.glyphs].reverse().map((g, i) => ({ ...g, char: '5501'[i] })) }
    const { metric, solution } = solve(chains, [upright, inverted])
    expect(new Set(metric.observations.map((o) => o.textRegionId)).size).toBe(1)
    expect(solution.independentWitnesses).toBeLessThanOrEqual(1)
  })
})
