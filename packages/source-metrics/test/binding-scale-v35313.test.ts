/**
 * v3.53.13: an ink the page vote was solved from, and a label on a line joined across a cover. Every token and every
 * chain here is made in the test; none is a drawing of any real building. (Where a wide mark crosses its line was
 * studied as a separate variant and not adopted: on the regression it moved 6 879 marks in 161 of 162 houses.)
 *
 * 1. A page vote with no reading of its own, solved by correcting every span to one value — the overall dimension's
 *    own half-seen alternative among them: the overall dimension, read as printed, was neutralised because that
 *    alternative fits the vote. It is the ink agreeing with itself, not a second witness. The ink now counts; but the
 *    ink alone against its own other reading replaces nothing — two readings of one ink, too weak either way.
 * 2. A line joined across planting can hide a tick under it: a label centred as well on a part such a hidden tick would
 *    cut off is that part's number as much as the whole's. It stays a candidate and states no whole span.
 */
import { describe, expect, it } from 'vitest'
import { chainId, hiddenSplitExplains, solveFrameChains, solveFrameMetric } from '../src/index.js'
import type { RawChain, TextOrientation, TextToken } from '../src/index.js'

// --- 1. an ink the vote was solved from -------------------------------------------------------------------------------

const H = 14
function token(text: string, box: { x0: number; y0: number; x1: number; y1: number }, orientation: TextOrientation, alts: Record<number, Array<{ char: string; ratio: number }>> = {}): TextToken {
  const n = text.length
  const vertical = orientation === 'ROTATED_CW' || orientation === 'ROTATED_CCW'
  return {
    text,
    score: 0.5,
    confidence: 0.6,
    box,
    shearDeg: 0,
    height: H,
    orientation,
    glyphs: [...text].map((char, i) => {
      const f0 = i / n
      const f1 = (i + 1) / n
      const gbox = vertical ? { x0: box.x0, x1: box.x1, y0: box.y0 + (box.y1 - box.y0) * f0, y1: box.y0 + (box.y1 - box.y0) * f1 } : { x0: box.x0 + (box.x1 - box.x0) * f0, x1: box.x0 + (box.x1 - box.x0) * f1, y0: box.y0, y1: box.y1 }
      return { char, score: 0.5, confidence: 0.6, alternatives: (alts[i] ?? []).map((a) => ({ char: a.char, score: 0.5 * a.ratio })), box: gbox, holes: { count: 0, cy: 0.5, areaFrac: 0 } }
    }),
  }
}
const hChain = (y: number, ticks: number[]): RawChain => ({ axis: 'HORIZONTAL', baselinePx: y, ticks: ticks.map((atPx) => ({ atPx, baselinePx: y, observationId: '' })), observationIds: [] })
const vChain = (x: number, ticks: number[]): RawChain => ({ axis: 'VERTICAL', baselinePx: x, ticks: ticks.map((atPx) => ({ atPx, baselinePx: x, observationId: '' })), observationIds: [] })
const hLabel = (text: string, y: number, from: number, to: number, alts?: Record<number, Array<{ char: string; ratio: number }>>, at = (from + to) / 2): TextToken => {
  const w = text.length * 9
  return token(text, { x0: at - w / 2, x1: at + w / 2, y0: y - 5 - H, y1: y - 5 }, 'HORIZONTAL', alts)
}
const vLabel = (text: string, x: number, from: number, to: number, alts?: Record<number, Array<{ char: string; ratio: number }>>): TextToken => {
  const w = text.length * 9
  const c = (from + to) / 2
  return token(text, { x0: x - 5 - H, x1: x - 5, y0: c - w / 2, y1: c + w / 2 }, 'ROTATED_CW', alts)
}
const FRAME = 'frame-synthetic'
function solve(chains: RawChain[], tokens: TextToken[]) {
  const legacy = solveFrameChains(chains, tokens, { tolerancePx: 2.2 })
  const ids = chains.map((c) => chainId(FRAME, c.axis, c.baselinePx, c.ticks.map((t) => t.atPx)))
  const metric = solveFrameMetric({ frameId: FRAME, assetId: 'asset', chains, chainIds: ids, raw: tokens, legacyTokens: tokens, legacy, tolerancePx: 2.2 })
  return { legacy, solution: metric.solution, observations: metric.observations }
}

/**
 * Drawn at 2.2425 cm/px. The overall height reads 1350 over 602 px, its second glyph half-seen as a 1 (1150 → 1.91 cm/px).
 * The three short spans are printed misread so that one glyph each makes them agree with 1.91: the vote corrects them
 * and the overall's own alternative to 1.91 and has no reading of its own.
 */
const selfVote = (extra: { chains: RawChain[]; tokens: TextToken[] } = { chains: [], tokens: [] }) => {
  const chains = [vChain(60, [100, 702]), hChain(300, [200, 260]), vChain(400, [120, 200]), hChain(500, [300, 390]), ...extra.chains]
  const tokens = [
    vLabel('1350', 60, 100, 702, { 1: [{ char: '1', ratio: 0.9 }] }),
    hLabel('174', 300, 200, 260, { 1: [{ char: '1', ratio: 0.7 }] }),
    vLabel('193', 400, 120, 200, { 1: [{ char: '5', ratio: 0.7 }] }),
    hLabel('112', 500, 300, 390, { 1: [{ char: '7', ratio: 0.7 }] }),
    ...extra.tokens,
  ]
  return solve(chains, tokens)
}

describe('v3.53.13 an ink is not neutralised by a vote solved from the ink itself', () => {
  const read690 = { chains: [hChain(40, [100, 407.5])], tokens: [hLabel('690', 40, 100, 407.5)] }

  it('cause: with a second, independent overall reading on the other axis, the overall height counts and the scale stands on both', () => {
    const { legacy, solution } = selfVote(read690)
    expect(legacy.pooledScale).toBeCloseTo(1.9103, 3)
    expect(legacy.solved.flatMap((s) => s.segments).some((g) => g.token?.text === '1350' && g.origin === 'CHAIN_CORRECTED')).toBe(true)
    expect(solution.legacy.independentGroups).toBe(0)
    expect(solution.topology?.neutralObservationIds ?? []).toHaveLength(0)
    expect(solution.relation).toBe('REPLACED')
    expect(solution.confidence).toBe('STRONG')
    expect(solution.cmPerPixelY).toBeCloseTo(2.2425, 3)
  })

  it('counter-test: the overall ink alone — its two readings, one of them the vote — replaces nothing; the record names the contest', () => {
    const { solution } = selfVote()
    expect(solution.relation).toBe('LEGACY_UNCONFIRMED')
    expect(solution.confidence).toBe('INCONCLUSIVE')
    expect(solution.why).toMatch(/two readings of the same ink/)
  })

  it('counter-test: a vote with a reading of its own keeps neutralising the ink whose alternative fits it', () => {
    // a span read as printed at 1.91 cm/px: 191 over 100 px — the vote now stands on an ink of its own
    const { solution } = selfVote({ chains: [hChain(600, [100, 200])], tokens: [hLabel('191', 600, 100, 200)] })
    expect(solution.legacy.independentGroups).toBeGreaterThanOrEqual(1)
    expect(solution.relation).not.toBe('REPLACED')
    expect(solution.cmPerPixelY).toBeCloseTo(1.9103, 3)
  })

  it('counter-test: a true 1150 (read as printed, the drawing at 1.91 cm/px) is kept, with a second reading that agrees', () => {
    const chains = [vChain(60, [100, 702]), hChain(600, [100, 300])]
    const tokens = [vLabel('1150', 60, 100, 702, { 1: [{ char: '3', ratio: 0.9 }] }), hLabel('382', 600, 100, 300)]
    const { solution } = solve(chains, tokens)
    expect(solution.cmPerPixelY).toBeCloseTo(1.9103, 3)
    expect(solution.cmPerPixelX).toBeCloseTo(1.91, 2)
  })

  it('counter-test: a true 640 beside the overall height: the two readings state two scales, and nothing is replaced', () => {
    // the width really prints 640 over 307.5 px (2.08 cm/px): it does not join the height's 2.24
    const { solution } = selfVote({ chains: [hChain(40, [100, 407.5])], tokens: [hLabel('640', 40, 100, 407.5)] })
    expect(solution.relation).not.toBe('REPLACED')
  })
})

// --- 2. a label on a line joined across a cover -----------------------------------------------------------------------

const joined = (coveredPx: Array<[number, number]>): RawChain => ({ ...hChain(40, [0, 600]), coveredPx })
const span = { from: 0, to: 1, px: 600, offsetShare: 0, questionableEnds: 0, skipped: { tick: 0, questionable: 0, rejected: 0 } }

describe('v3.53.13 a label a hidden tick would make a part number states no whole span', () => {
  it('an overall label at the middle of a line joined across two plantings keeps the whole span', () => {
    expect(hiddenSplitExplains(joined([[90, 150], [260, 390]]), 300.5, { ...span, offsetShare: 0.001 }, 20)).toBe(false)
  })

  it('a label centred as well on a part two hidden ticks (one under each planting) cut off is that part number', () => {
    expect(hiddenSplitExplains(joined([[100, 140], [460, 500]]), 300, span, 20)).toBe(true)
  })

  it('a label centred on a part one hidden tick cuts off, as well as on the whole, is that part number', () => {
    // whole span 0..600 with the label at 330 (offset 0.05); a tick hidden at 60 makes the part 60..600, centred at 330
    expect(hiddenSplitExplains(joined([[40, 80]]), 330, { ...span, offsetShare: 0.05 }, 20)).toBe(true)
  })

  it('counter-test: two ticks under one planting make no part (some of the line must show)', () => {
    expect(hiddenSplitExplains(joined([[250, 350]]), 300, span, 20)).toBe(false)
  })

  it('counter-test: a line drawn whole carries no such doubt', () => {
    expect(hiddenSplitExplains(hChain(40, [0, 600]), 300, span, 20)).toBe(false)
  })

  it('through the solver: the label is AMBIGUOUS on the joined line and PRIMARY on the same line drawn whole; it is never a witness', () => {
    const tokens = [hLabel('1200', 40, 0, 600), vLabel('900', 700, 0, 400)]
    const lineWhole = hChain(40, [0, 600])
    const lineJoined: RawChain = { ...lineWhole, coveredPx: [[100, 140], [460, 500]] }
    const roleOf = (c: RawChain) => solve([c, vChain(700, [0, 400])], tokens).observations.find((o) => o.rawText === '1200' && o.spanPx === 600)?.binding?.role
    expect(roleOf(lineWhole)).toBe('PRIMARY')
    expect(roleOf(lineJoined)).toBe('AMBIGUOUS')
    const { solution } = solve([lineJoined, vChain(700, [0, 400])], tokens)
    expect(solution.supportingObservationIds.some((id) => id.includes('1200'))).toBe(false)
  })
})
