import { describe, expect, it } from 'vitest'
import { chainId, metricCoherence, solveFrameChains, solveFrameMetric } from '../src/index.js'
import type { MetricEvidenceSet, RawChain, TextOrientation, TextToken } from '../src/index.js'

// v3.54.3 (one metric revision): an externally measured scale (two consulted whole dimensions that agree) is the frame's
// scale BEFORE its chains are read at the end, so nothing the result holds was corrected or derived at the scale it
// replaced. Hand-made tokens, as in metric-solution.test.ts; no project's data.
const H = 14
function token(text: string, box: { x0: number; y0: number; x1: number; y1: number }, orientation: TextOrientation): TextToken {
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
      return { char, score: 0.5, confidence: 0.6, alternatives: [], box: gbox, holes: { count: 0, cy: 0.5, areaFrac: 0 } }
    }),
  }
}
const hChain = (y: number, ticks: number[]): RawChain => ({ axis: 'HORIZONTAL', baselinePx: y, ticks: ticks.map((atPx) => ({ atPx, baselinePx: y, observationId: '' })), observationIds: [] })
const vChain = (x: number, ticks: number[]): RawChain => ({ axis: 'VERTICAL', baselinePx: x, ticks: ticks.map((atPx) => ({ atPx, baselinePx: x, observationId: '' })), observationIds: [] })
const hLabel = (text: string, y: number, from: number, to: number): TextToken => {
  const w = text.length * 9
  const at = (from + to) / 2
  return token(text, { x0: at - w / 2, x1: at + w / 2, y0: y - 5 - H, y1: y - 5 }, 'HORIZONTAL')
}
const vLabel = (text: string, x: number, from: number, to: number): TextToken => {
  const w = text.length * 9
  const c = (from + to) / 2
  return token(text, { x0: x - 5 - H, x1: x - 5, y0: c - w / 2, y1: c + w / 2 }, 'ROTATED_CW')
}
const FRAME = 'frame-synthetic'
const TOL = 2.2
const ids = (chains: readonly RawChain[]): string[] => chains.map((c) => chainId(FRAME, c.axis, c.baselinePx, c.ticks.map((t) => t.atPx)))

/** A sheet printed at 2.00 cm/px whose labels the reader took wrongly: its page vote lands near 3 cm/px on one chain. */
const misread = (): { chains: RawChain[]; tokens: TextToken[] } => {
  const chains = [hChain(760, [100, 400, 650]), vChain(700, [50, 300, 500]), hChain(300, [200, 320])]
  const tokens = [hLabel('900', 760, 100, 400), hLabel('750', 760, 400, 650), vLabel('1125', 700, 50, 300), hLabel('240', 300, 200, 320)]
  return { chains, tokens }
}
/** A sheet whose own readings settle 2.00 cm/px on both axes. */
const settled = (): { chains: RawChain[]; tokens: TextToken[] } => {
  const chains = [hChain(760, [100, 400, 650]), vChain(700, [50, 300, 500]), hChain(300, [200, 320])]
  const tokens = [hLabel('600', 760, 100, 400), hLabel('500', 760, 400, 650), vLabel('500', 700, 50, 300), vLabel('400', 700, 300, 500), hLabel('240', 300, 200, 320)]
  return { chains, tokens }
}
function solve(f: { chains: RawChain[]; tokens: TextToken[] }, external?: { cmPerPixelX?: number; cmPerPixelY?: number; why: string }) {
  const legacy = solveFrameChains(f.chains, f.tokens, { tolerancePx: TOL })
  return { legacy, metric: solveFrameMetric({ frameId: FRAME, assetId: 'asset', chains: f.chains, chainIds: ids(f.chains), raw: f.tokens, legacyTokens: f.tokens, legacy, tolerancePx: TOL, ...(external ? { external } : {}) }) }
}
/** The solved chains as a sealed set would hold them, for the property check. */
const asSet = (f: { chains: RawChain[] }, m: ReturnType<typeof solve>['metric']): Pick<MetricEvidenceSet, 'metricSolutions' | 'chains' | 'coordinateRegistrations'> => ({
  metricSolutions: [m.solution],
  coordinateRegistrations: [],
  chains: f.chains.map((c, i) => ({ id: ids(f.chains)[i], frameId: FRAME, assetId: 'asset', axis: c.axis, baselinePx: c.baselinePx, ticksPx: c.ticks.map((t) => t.atPx), segments: m.solved[i].segments.map((g) => ({ index: g.index, fromPx: g.fromPx, toPx: g.toPx, pixelLength: g.pixelLength, ...(g.valueCm !== undefined ? { valueCm: g.valueCm } : {}), origin: g.origin === 'UNRESOLVED' ? undefined : g.origin, confidence: g.confidence })), closes: false, observationIds: [], ocrTokenIds: [] })),
})

describe('v3.54.3 one metric revision: an external scale is the scale the chains are read at', () => {
  const ext = { cmPerPixelX: 2, cmPerPixelY: 2, why: 'consulted dimensions: two on different lines agree' }
  it('before: without it the misread sheet keeps dependents of its own (wrong) scale', () => {
    const f = misread()
    const { metric } = solve(f)
    expect(['INCONCLUSIVE', 'WEAK']).toContain(metric.solution.confidence)
    expect(metric.external).toBeUndefined()
  })
  it('applied where the frame settles nothing: REPLACED, SUPPORTED, both axes at it, and every dependent value is a value AT it', () => {
    const f = misread()
    const { metric } = solve(f, ext)
    expect(metric.external).toMatchObject({ applied: true })
    expect(metric.solution).toMatchObject({ relation: 'REPLACED', confidence: 'SUPPORTED', cmPerPixelX: 2, cmPerPixelY: 2 })
    expect(metric.solution.why).toMatch(/^consulted dimensions/)
    expect(metric.solution.selectedHypothesisId).toBeUndefined()
    const report = metricCoherence(asSet(f, metric))
    expect(report.violations).toEqual([])
    // nothing derived or corrected carries the replaced scale: no segment values 300 px at 900 cm unless it is READ
    for (const s of metric.solved) for (const g of s.segments) if (g.valueCm !== undefined && g.origin !== 'READ') expect(Math.abs(g.valueCm / 2 - g.pixelLength)).toBeLessThanOrEqual(TOL + g.pixelLength * 0.005)
  })
  it('the property check sees a mixed revision: the legacy chains under the replaced solution violate it', () => {
    const f = misread()
    const { legacy, metric } = solve(f, ext)
    const mixed = asSet(f, { ...metric, solved: legacy.solved })
    const stale = metricCoherence(mixed)
    // the page vote derived or corrected at least one value at its own scale; under the new solution that is a violation
    const legacyDependents = legacy.solved.flatMap((s) => s.segments).filter((g) => g.valueCm !== undefined && g.origin !== 'READ').length
    if (legacyDependents > 0) expect(stale.violations.length).toBeGreaterThan(0)
    expect(metricCoherence(asSet(f, metric)).violations).toEqual([])
  })
  it('never over a scale the frame\'s own readings settle: not applied, and the result is byte for byte the result without it', () => {
    const f = settled()
    const plain = solve(f).metric
    expect(['STRONG', 'SUPPORTED']).toContain(plain.solution.confidence)
    const withExt = solve(f, { cmPerPixelX: 3, cmPerPixelY: 3, why: 'consulted dimensions that contradict' }).metric
    expect(withExt.external).toMatchObject({ applied: false, localConfidence: plain.solution.confidence })
    expect(withExt.solution).toEqual(plain.solution)
    expect(withExt.solved).toEqual(plain.solved)
  })
  it('one axis measured: the other is read at the same scale and isotropy is ASSUMED, not MEASURED', () => {
    const { metric } = solve(misread(), { cmPerPixelX: 2, why: 'consulted dimensions' })
    expect(metric.solution).toMatchObject({ cmPerPixelX: 2, cmPerPixelY: 2, isotropy: 'ASSUMED' })
  })
})
