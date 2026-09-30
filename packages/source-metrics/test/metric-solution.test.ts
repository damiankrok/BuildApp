import { describe, expect, it } from 'vitest'
import { chainId, chainRelations, registerFrame, solveChain, solveFrameChains, solveFrameMetric } from '../src/index.js'
import type { RawChain, ScaleAnchorInput, TextOrientation, TextToken } from '../src/index.js'

/**
 * BUILDPLAN-ANALYZER-005B: the independent metric solver, held to adversaries
 * built from hand-made tokens (Reviewer B's T1–T10, `stage-reports/artifacts/
 * analyzer-005b/pre/scale-independence-review.md` §6). Every fixture is a
 * page the legacy pooled vote reads wrongly; each test states what the legacy
 * vote does with it, so a regression to that behaviour fails here.
 */

const H = 14

/** A token as the reader returns it: every glyph at score 0.5 and decidedness 0.6, with the runners-up given. */
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

/** A horizontal chain at `y` through `ticks`, and a label centred over each span, set above the line. */
function hChain(y: number, ticks: number[]): RawChain {
  return { axis: 'HORIZONTAL', baselinePx: y, ticks: ticks.map((atPx) => ({ atPx, baselinePx: y, observationId: '' })), observationIds: [] }
}
function vChain(x: number, ticks: number[]): RawChain {
  return { axis: 'VERTICAL', baselinePx: x, ticks: ticks.map((atPx) => ({ atPx, baselinePx: x, observationId: '' })), observationIds: [] }
}
const hLabel = (text: string, y: number, from: number, to: number, alts?: Record<number, Array<{ char: string; ratio: number }>>, at = (from + to) / 2): TextToken => {
  const w = text.length * 9
  return token(text, { x0: at - w / 2, x1: at + w / 2, y0: y - 5 - H, y1: y - 5 }, 'HORIZONTAL', alts)
}
const vLabel = (text: string, x: number, from: number, to: number, orientation: TextOrientation = 'ROTATED_CW', alts?: Record<number, Array<{ char: string; ratio: number }>>): TextToken => {
  const w = text.length * 9
  const c = (from + to) / 2
  return token(text, { x0: x - 5 - H, x1: x - 5, y0: c - w / 2, y1: c + w / 2 }, orientation, alts)
}

const FRAME = 'frame-synthetic'
const ids = (chains: readonly RawChain[]): string[] => chains.map((c) => chainId(FRAME, c.axis, c.baselinePx, c.ticks.map((t) => t.atPx)))

function solve(chains: RawChain[], legacyTokens: TextToken[], raw: TextToken[] = legacyTokens) {
  const legacy = solveFrameChains(chains, legacyTokens, { tolerancePx: 2.2 })
  const metric = solveFrameMetric({ frameId: FRAME, assetId: 'asset', chains, chainIds: ids(chains), raw: [...new Set([...legacyTokens, ...raw])], legacyTokens, legacy, tolerancePx: 2.2 })
  return { legacy, metric, solution: metric.solution }
}

// T1: a self-anchoring overall dimension with a substituted consensus. The drawing is at 2.00 cm/px.
const T1 = (): { chains: RawChain[]; tokens: TextToken[] } => {
  const chains = [vChain(700, [50, 500]), hChain(760, [100, 650]), hChain(300, [200, 260]), vChain(400, [100, 250]), hChain(500, [300, 390])]
  const tokens = [
    vLabel('006', 700, 50, 500, 'ROTATED_CCW', { 0: [{ char: '8', ratio: 0.7 }] }), // prints 900, read upside down
    hLabel('1100', 760, 100, 650),
    hLabel('101', 300, 200, 260, { 2: [{ char: '7', ratio: 0.7 }] }),
    vLabel('208', 400, 100, 250, 'ROTATED_CW', { 1: [{ char: '6', ratio: 0.7 }] }),
    hLabel('131', 500, 300, 390, { 1: [{ char: '6', ratio: 0.7 }] }),
  ]
  return { chains, tokens }
}

describe('self-anchoring (T1): a correction may never witness the scale it was made to fit', () => {
  it('the legacy vote is the adversary: substitutions agree with each other on 1.79 cm/px and rewrite the overall dimension to join them', () => {
    const { chains, tokens } = T1()
    const legacy = solveFrameChains(chains, tokens, { tolerancePx: 2.2 })
    expect(legacy.pooledScale).toBeGreaterThan(1.77)
    expect(legacy.pooledScale).toBeLessThan(1.8)
    const corrected = legacy.solved.flatMap((s) => s.segments).filter((g) => g.origin === 'CHAIN_CORRECTED').map((g) => `${g.token?.text}->${g.text}`)
    expect(corrected).toContain('006->806')
  })

  it('the independent solver takes the scale the one reading as read states, and names it WEAK', () => {
    const { chains, tokens } = T1()
    const { solution, metric } = solve(chains, tokens)
    expect(metric.pooledScale).toBeCloseTo(2, 2)
    expect(solution.relation).toBe('REPLACED')
    expect(solution.confidence).toBe('WEAK')
    expect(solution.independentWitnesses).toBe(1)
    // The legacy scale's own anchors were all rewrites; the record says so.
    expect(solution.legacy.independentGroups).toBe(0)
    expect(solution.legacy.correctedAnchors).toBeGreaterThanOrEqual(3)
  })

  it('no rewritten reading is among the witnesses of the chosen scale, and a correction made at it is marked as depending on it', () => {
    const { chains, tokens } = T1()
    const { solution, metric } = solve(chains, tokens)
    const supporting = metric.observations.filter((o) => solution.supportingObservationIds.includes(o.id))
    expect(supporting.map((o) => o.rawText)).toEqual(['1100'])
    for (const s of metric.solved) for (const g of s.segments) if (g.origin === 'CHAIN_CORRECTED') expect(g.text).not.toBe(g.token?.text)
  })

  it('adding a misread that a substitution makes fit a wrong scale does not raise that scale’s support by one witness', () => {
    const { chains, tokens } = T1()
    const without = solve(chains, tokens).solution
    // A fourth short span, misread "201" for 161 at 90 px: "161" is one substitution away and fits 1.79.
    const more = [...chains, hChain(560, [300, 390])]
    const plus = [...tokens, hLabel('201', 560, 300, 390, { 0: [{ char: '1', ratio: 0.7 }], 1: [{ char: '6', ratio: 0.7 }] })]
    const withIt = solve(more, plus).solution
    const near179 = (s: typeof without): number => s.hypotheses.filter((h) => Math.abs(h.cmPerPixel / 1.79 - 1) < 0.02).reduce((a, h) => a + h.independentGroups, 0)
    expect(near179(withIt)).toBe(near179(without))
    expect(withIt.selectedHypothesisId && withIt.hypotheses.find((h) => h.id === withIt.selectedHypothesisId)?.cmPerPixel).toBeCloseTo(2, 2)
  })

  it('(T1b) the right-way reading of the same ink, decided by typography, makes both axes state 2.00: STRONG, isotropy measured', () => {
    const { chains, tokens } = T1()
    const upright = vLabel('900', 700, 50, 500, 'ROTATED_CW')
    const { solution, metric } = solve(chains, tokens, [...tokens, upright])
    expect(metric.pooledScale).toBeCloseTo(2, 2)
    expect(solution.isotropy).toBe('MEASURED')
    expect(solution.confidence).toBe('STRONG')
    const decision = solution.orientationDecisions.find((d) => d.axis === 'Y' && d.candidates.length === 2)
    expect(decision?.chosen).toBe('ROTATED_CW')
    expect(decision?.decidedBy).toBe('TYPOGRAPHY')
    // One piece of ink, however many ways it was read: the two readings share a text region.
    const regions = metric.observations.filter((o) => o.rawText === '900' || o.rawText === '006').map((o) => o.textRegionId)
    expect(new Set(regions).size).toBe(1)
  })
})

describe('T2′: a substitution may not outvote its own raw reading', () => {
  const fixture = (): { chains: RawChain[]; tokens: TextToken[] } => ({
    chains: [hChain(760, [60, 730]), vChain(820, [100, 142])],
    tokens: [hLabel('1407', 760, 60, 730, { 1: [{ char: '6', ratio: 0.66 }] }), vLabel('102', 820, 100, 142)],
  })

  it('the legacy vote takes the substitution 1607 through the cross-chain bonus', () => {
    const { chains, tokens } = fixture()
    expect(solveFrameChains(chains, tokens, { tolerancePx: 2.2 }).pooledScale).toBeCloseTo(2.3985, 3)
  })

  it('the independent solver takes 1407 as read, and the short reading that disagrees is rejected, not averaged', () => {
    const { chains, tokens } = fixture()
    const { metric, solution } = solve(chains, tokens)
    expect(metric.pooledScale).toBeCloseTo(2.1, 3)
    expect(solution.confidence).toBe('WEAK')
    const short = metric.observations.find((o) => o.rawText === '102')
    expect(short?.status).toBe('REJECTED')
  })
})

describe('T3: a registration keeps its one long anchor against five short ones that agree elsewhere', () => {
  it('weight first, count second', () => {
    const anchor = (id: string, axis: 'X' | 'Y', metres: number, px: number, weight: number): ScaleAnchorInput => ({ id, kind: 'CHAIN_SEGMENT', evidenceIds: [id], axis, pixelSpan: px, metricSpan: metres, weight })
    const anchors = [
      anchor('overall-x', 'X', 11, 550, 0.55),
      anchor('s1', 'X', 1.07, 60, 0.3),
      anchor('s2', 'X', 1.61, 90, 0.3),
      anchor('s3', 'X', 1.0, 56, 0.3),
      anchor('s4', 'X', 1.2, 67, 0.3),
      anchor('s5', 'X', 0.8, 45, 0.3),
      anchor('overall-y', 'Y', 9, 450, 0.55),
    ]
    const r = registerFrame({ frameId: FRAME, assetId: 'asset', variantByteHash: 'a'.repeat(64), plane: 'PLAN_XZ', anchors, originPx: { x: 0, y: 0 }, flipX: false, flipY: true, detail: 'T3' })
    expect(r?.metresPerPixelX).toBeCloseTo(0.02, 4)
    expect(r?.rejected.map((x) => x.id)).not.toContain('overall-x')
  })
})

describe('T4: the decision does not depend on the runners-up', () => {
  it('stripping every glyph alternative leaves the scale and the class unchanged', () => {
    const { chains, tokens } = T1()
    const upright = vLabel('900', 700, 50, 500, 'ROTATED_CW')
    const bare = (t: TextToken): TextToken => ({ ...t, glyphs: t.glyphs.map((g) => ({ ...g, alternatives: [] })) })
    const a = solve(chains, tokens, [...tokens, upright]).solution
    const b = solve(chains, tokens.map(bare), [...tokens, upright].map(bare)).solution
    expect(b.confidence).toBe(a.confidence)
    expect(b.cmPerPixelX).toBeCloseTo(a.cmPerPixelX ?? 0, 3)
    expect(b.cmPerPixelY).toBeCloseTo(a.cmPerPixelY ?? 0, 3)
  })
})

describe('T8: a leading zero is not a dimension', () => {
  it('a reading printed with a leading zero never witnesses a scale, however long its span', () => {
    const chains = [hChain(760, [100, 650]), vChain(700, [50, 500])]
    const tokens = [hLabel('1100', 760, 100, 650), vLabel('006', 700, 50, 500, 'ROTATED_CCW')]
    const { solution, metric } = solve(chains, tokens)
    const lz = metric.observations.find((o) => o.rawText === '006')
    expect(lz?.leadingZero).toBe(true)
    expect(solution.hypotheses.every((h) => h.cmPerPixel > 0.5 || h.independentGroups === 0)).toBe(true)
  })
})

describe('T10: a glyph no span is centred on may not evict the dimension that is', () => {
  it('the overall `1100` keeps its chain although a stray `14` sits nearer the line', () => {
    const chain = hChain(828, [83.5, 602.5])
    const stray = token('14', { x0: 535, x1: 563, y0: 800, y1: 820 }, 'HORIZONTAL')
    const overall = hLabel('1100', 828, 83.5, 602.5, undefined, 336.5)
    const { metric } = solve([chain], [stray, overall])
    expect(metric.observations.some((o) => o.rawText === '1100')).toBe(true)
    expect(metric.observations.some((o) => o.rawText === '14')).toBe(false)
  })
})

describe('orientation decisions from scale-free evidence', () => {
  it('two labels on one chain that agree one way up and not the other decide the chain (CHAIN_SELF_CONSISTENCY)', () => {
    const chains = [vChain(700, [50, 250, 500])]
    // 400 over 200 px and 500 over 250 px: 2.00 either way up only when read bottom to top.
    const cw = [vLabel('400', 700, 50, 250, 'ROTATED_CW'), vLabel('500', 700, 250, 500, 'ROTATED_CW')]
    const ccw = [vLabel('007', 700, 50, 250, 'ROTATED_CCW'), vLabel('009', 700, 250, 500, 'ROTATED_CCW')]
    const { solution } = solve(chains, ccw, [...cw, ...ccw])
    expect(solution.orientationDecisions[0].chosen).toBe('ROTATED_CW')
    expect(['CHAIN_SELF_CONSISTENCY', 'TYPOGRAPHY']).toContain(solution.orientationDecisions[0].decidedBy)
  })

  it('a sheet whose horizontal text is upside down is read upside down only when the inverted readings agree and the upright ones do not', () => {
    const chains = [hChain(760, [100, 400, 650]), hChain(100, [100, 650])]
    // 600 over 300, 500 over 250, 1100 over 550: 2.00. Upside down they read 009, 005, 0011.
    const inverted = [token('600', { x0: 236, x1: 263, y0: 765, y1: 779 }, 'INVERTED'), token('500', { x0: 511, x1: 538, y0: 765, y1: 779 }, 'INVERTED'), token('1100', { x0: 357, x1: 393, y0: 105, y1: 119 }, 'INVERTED')]
    const upright = [token('009', { x0: 236, x1: 263, y0: 765, y1: 779 }, 'HORIZONTAL'), token('005', { x0: 511, x1: 538, y0: 765, y1: 779 }, 'HORIZONTAL'), token('0011', { x0: 357, x1: 393, y0: 105, y1: 119 }, 'HORIZONTAL')]
    const { solution, metric } = solve(chains, upright, [...upright, ...inverted])
    expect(solution.orientationDecisions.every((d) => d.chosen === 'INVERTED')).toBe(true)
    expect(metric.pooledScale).toBeCloseTo(2, 2)
  })

  it('mirrored-looking values read the same either way up and decide nothing by themselves', () => {
    const chains = [vChain(700, [50, 454]), hChain(760, [100, 650])]
    // 808 over 404 px is 2.00 cm/px read either way up.
    const both = [vLabel('808', 700, 50, 454, 'ROTATED_CW'), vLabel('808', 700, 50, 454, 'ROTATED_CCW')]
    const { solution, metric } = solve(chains, [both[0], hLabel('1100', 760, 100, 650)], [...both, hLabel('1100', 760, 100, 650)])
    expect(metric.pooledScale).toBeCloseTo(2, 2)
    expect(solution.orientationDecisions.find((d) => d.axis === 'Y')?.decidedBy).not.toBe('TYPOGRAPHY')
  })
})

describe('the chain graph', () => {
  it('a total over exactly what a finer chain divides is its TOTAL_OF, with the sum recorded and not forced', () => {
    const total = hChain(100, [100, 650])
    const parts = hChain(140, [100, 400, 650])
    const solved = [solveChain(total, [], { fixedScale: 2 }), solveChain(parts, [], { fixedScale: 2 })]
    // With no labels at all nothing is derived, so no sum is recorded.
    const bare = chainRelations(FRAME, [total, parts], ['total', 'parts'], solved)
    expect(bare).toEqual([{ kind: 'TOTAL_OF', frameId: FRAME, fromChainId: 'total', toChainId: 'parts' }])
  })

  it('records a total that disagrees with its parts as disagreeing', () => {
    const total = hChain(100, [100, 650])
    const parts = hChain(140, [100, 400, 650])
    const t = [hLabel('1100', 100, 100, 650)]
    const p = [hLabel('600', 140, 100, 400), hLabel('600', 140, 400, 650)]
    const solved = [solveChain(total, solveFrameChains([total], t).tokensPerChain[0], { fixedScale: 2 }), solveChain(parts, solveFrameChains([parts], p).tokensPerChain[0], { fixedScale: 2.2, tolerancePx: 30 })]
    const [rel] = chainRelations(FRAME, [total, parts], ['total', 'parts'], solved)
    expect(rel.kind).toBe('TOTAL_OF')
    expect(rel.sum?.agrees).toBe(false)
    expect(rel.sum?.residualCm).toBeCloseTo(-100, 0)
  })
})

describe('determinism', () => {
  it('the same readings in another order give the same solution, byte for byte', () => {
    const { chains, tokens } = T1()
    const upright = vLabel('900', 700, 50, 500, 'ROTATED_CW')
    const a = solve(chains, tokens, [...tokens, upright])
    const b = solve(chains, tokens, [upright, ...[...tokens].reverse()])
    expect(JSON.stringify(b.solution)).toBe(JSON.stringify(a.solution))
    expect(JSON.stringify(b.metric.observations)).toBe(JSON.stringify(a.metric.observations))
  })
})
