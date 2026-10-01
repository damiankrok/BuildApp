/**
 * The source conflict (BUILDPLAN-ANALYZER-005D, resolver 1.4.0, §31).
 *
 * A first reading that completed is challenged when the drawing itself contradicts the scale it
 * was registered at — decided from the drawing's readings as printed, never from a published
 * figure, which `sourceConflictOf` is not even given. Three triggers, each with its negative:
 *
 *   T1 AS_READ_REFUTATION  the registration contradicts most of the chain length as read, and a
 *                          scale the readings state contradicts substantially less of it;
 *   T2 PARTIAL_BINDING     an unconfirmed scale rests on a long reading whose label is centred on
 *                          a wider span it measures (the spurious-tick pattern);
 *   T3 OUTER_TOTALS        two long readings as printed, on both axes and on different chains,
 *                          agree on another scale and outweigh what supports the registration.
 *
 * Hand-made evidence on a 460 × 480 px plan at 5 cm/px; no drawing.
 */
import { describe, expect, it } from 'vitest'
import type { DimensionChain, DimensionObservation, FrameMetricSolution, MetricEvidence, MetricEvidenceSet, OcrToken } from '@buildapp/source-metrics'
import { ReconstructionFailure, reconstructV2, sourceConflictOf } from '../src/index.js'
import type { SolverTraceEvent } from '../src/index.js'
import { WALL, graphOf, metricsOf, planFrame, registration, sheet, walls } from './plan.js'

const FRAME = 'frame-plan'
const JUDGE = { x0: 0, y0: 0, x1: 460, y1: 480 }
const REG = registration(FRAME) // 5 cm/px

type Statement = { chain: string; axis: 'X' | 'Y'; px: number; cm: number; origin?: 'READ' | 'CHAIN_CORRECTED'; firstRead?: string }

function metricsWith(statements: readonly Statement[], extra: { solution?: FrameMetricSolution; observations?: DimensionObservation[] } = {}): MetricEvidenceSet {
  const evidence: MetricEvidence[] = []
  const tokens: OcrToken[] = []
  const chains: DimensionChain[] = statements.map((s, i) => {
    const id = `ev-${i}`
    const tokenId = `tok-${i}`
    const origin = s.origin ?? 'READ'
    tokens.push({ id: tokenId, frameId: FRAME, assetId: 'asset-test', text: s.firstRead ?? String(s.cm), box: { x0: 0, y0: 0, x1: 10, y1: 10 }, confidence: 0.6, score: 0.5, shearDeg: 0, heightPx: 14 } as OcrToken)
    evidence.push({
      id,
      kind: 'LINEAR_DIMENSION',
      frameId: FRAME,
      assetId: 'asset-test',
      variantByteHash: 'b'.repeat(64),
      value: s.cm,
      unit: 'cm',
      origin,
      rawText: s.firstRead ?? String(s.cm),
      pixelLength: s.px,
      association: { kind: 'DIMENSION_LINE', score: 0.9, why: 'a fixture', observationIds: [] },
      chainId: s.chain,
      ocrTokenIds: [tokenId],
      observationIds: [],
      alternatives: [],
      confidence: 0.9,
      provenance: { extractor: 'NUMERIC_OCR', name: 'fixture', detail: 'a fixture' },
    } as MetricEvidence)
    return {
      id: s.chain,
      frameId: FRAME,
      assetId: 'asset-test',
      axis: s.axis === 'X' ? 'HORIZONTAL' : 'VERTICAL',
      baselinePx: 20 + i * 30,
      ticksPx: [10, 10 + s.px],
      segments: [{ index: 0, fromPx: 10, toPx: 10 + s.px, pixelLength: s.px, valueCm: s.cm, origin, confidence: 0.9, evidenceId: id }],
      closes: true,
      observationIds: [],
      ocrTokenIds: [tokenId],
    } as DimensionChain
  })
  return {
    ...metricsOf(chains, [REG]),
    evidence,
    ocrTokens: tokens,
    ...(extra.solution ? { metricSolutions: [extra.solution] } : {}),
    ...(extra.observations ? { dimensionObservations: extra.observations } : {}),
  }
}

const conflictOf = (m: MetricEvidenceSet) => sourceConflictOf(m, FRAME, REG, JUDGE, WALL)

const unconfirmed = (): FrameMetricSolution => ({
  frameId: FRAME,
  assetId: 'asset-test',
  relation: 'LEGACY_UNCONFIRMED',
  confidence: 'INCONCLUSIVE',
  cmPerPixelX: 5,
  cmPerPixelY: 5,
  anisotropy: 1,
  isotropy: 'ASSUMED',
  hypotheses: [],
  legacy: { cmPerPixel: 5, independentGroups: 0, independentWeight: 0, correctedAnchors: 0, readAnchors: 1 },
  independentWitnesses: 0,
  supportingObservationIds: [],
  conflictingObservationIds: [],
  orientationDecisions: [],
  rereadChainIds: [],
  counts: { textRegions: 1, observations: 1, hypotheses: 0 },
  why: 'a fixture',
})
const observation = (chainId: string, rawText: string, spanPx: number, role: 'PRIMARY' | 'ALTERNATIVE' = 'PRIMARY'): DimensionObservation =>
  ({
    id: `obs-${chainId}-${rawText}-${spanPx}`,
    frameId: FRAME,
    assetId: 'asset-test',
    chainId,
    textRegionId: `region-${rawText}`,
    orientation: 'HORIZONTAL',
    rawText,
    valueCm: Number(rawText),
    axis: 'X',
    fromPx: 10,
    toPx: 10 + spanPx,
    spanPx,
    impliedCmPerPx: Number(rawText) / spanPx,
    independence: 'INDEPENDENT',
    status: 'RAW',
    ocrScore: 0.5,
    ocrConfidence: 0.6,
    leadingZero: false,
    binding: { role, offsetShare: 0.01, questionableEnds: 0, skipped: { tick: 0, questionable: 0, rejected: 1 } },
  }) as DimensionObservation

describe('the drawing agrees with its registration: no conflict', () => {
  it('long readings on both axes stating the registered scale', () => {
    expect(conflictOf(metricsWith([{ chain: 'cx', axis: 'X', px: 400, cm: 2000 }, { chain: 'cy', axis: 'Y', px: 300, cm: 1500 }]))).toBeNull()
  })

  it('one misread long reading against three that state the registered scale is a misreading, not a conflict', () => {
    const m = metricsWith([
      { chain: 'cx', axis: 'X', px: 400, cm: 1600 },
      { chain: 'cx2', axis: 'X', px: 380, cm: 1900 },
      { chain: 'cy', axis: 'Y', px: 300, cm: 1500 },
      { chain: 'cy2', axis: 'Y', px: 320, cm: 1600 },
    ])
    expect(conflictOf(m)).toBeNull()
  })

  it('a value the chain solver corrected toward another scale is judged by what was first read, so it does not witness that scale', () => {
    // Corrected to 1600 (4 cm/px) from a first reading of 2000 (5 cm/px, the registration).
    const m = metricsWith([
      { chain: 'cx', axis: 'X', px: 400, cm: 1600, origin: 'CHAIN_CORRECTED', firstRead: '2000' },
      { chain: 'cy', axis: 'Y', px: 300, cm: 1200, origin: 'CHAIN_CORRECTED', firstRead: '1500' },
    ])
    expect(conflictOf(m)).toBeNull()
  })
})

describe('T1 AS_READ_REFUTATION', () => {
  it('the registration contradicts all the length read, and the scale the readings state contradicts none of it', () => {
    const m = metricsWith([
      { chain: 'cx', axis: 'X', px: 400, cm: 1600 },
      { chain: 'cx2', axis: 'X', px: 200, cm: 800 },
    ])
    const c = conflictOf(m)
    expect(c?.triggers).toEqual(['AS_READ_REFUTATION'])
    expect(c?.registrationRefuted).toBe(1)
    expect(c?.alternatives.some((a) => Math.abs(a.cmPerPx - 4) < 0.01 && a.refuted === 0)).toBe(true)
  })
})

describe('T2 PARTIAL_BINDING', () => {
  // The registration rests on "1200" over 240 px (5 cm/px), but the label is centred on the 480 px span it measures.
  const statements: Statement[] = [{ chain: 'cx', axis: 'X', px: 240, cm: 1200 }]

  it('an unconfirmed scale resting on a long reading whose own label is centred on a wider span', () => {
    const c = conflictOf(metricsWith(statements, { solution: unconfirmed(), observations: [observation('cx', '1200', 440)] }))
    expect(c?.triggers).toContain('PARTIAL_BINDING')
    expect(c?.why).toContain('440 px')
  })

  it('not when the wider span is only an alternative binding of the label', () => {
    expect(conflictOf(metricsWith(statements, { solution: unconfirmed(), observations: [observation('cx', '1200', 440, 'ALTERNATIVE')] }))).toBeNull()
  })

  it('not when the wider span is too short to be decisive', () => {
    expect(conflictOf(metricsWith([{ chain: 'cx', axis: 'X', px: 120, cm: 600 }], { solution: unconfirmed(), observations: [observation('cx', '600', 140)] }))).toBeNull()
  })

  it('not when the scale was confirmed by independent readings', () => {
    const confirmed = { ...unconfirmed(), relation: 'CONFIRMED' as const, confidence: 'SUPPORTED' as const }
    expect(conflictOf(metricsWith(statements, { solution: confirmed, observations: [observation('cx', '1200', 440)] }))).toBeNull()
  })
})

describe('T3 OUTER_TOTALS', () => {
  it('two long readings as printed, on both axes and different chains, agree on another scale and outweigh the registration', () => {
    const m = metricsWith([
      { chain: 'cx', axis: 'X', px: 400, cm: 1600 },
      { chain: 'cy', axis: 'Y', px: 420, cm: 1680 },
      { chain: 'cx2', axis: 'X', px: 120, cm: 600 },
    ])
    expect(conflictOf(m)?.triggers).toContain('OUTER_TOTALS')
  })

  it('not on one axis alone', () => {
    const m = metricsWith([
      { chain: 'cx', axis: 'X', px: 400, cm: 1600 },
      { chain: 'cx2', axis: 'X', px: 420, cm: 1680 },
      { chain: 'cy', axis: 'Y', px: 300, cm: 1500 },
      { chain: 'cy2', axis: 'Y', px: 320, cm: 1600 },
    ])
    expect(conflictOf(m)?.triggers ?? []).not.toContain('OUTER_TOTALS')
  })

  it('not when what supports the registration is longer', () => {
    const m = metricsWith([
      { chain: 'cx', axis: 'X', px: 400, cm: 1600 },
      { chain: 'cy', axis: 'Y', px: 300, cm: 1200 },
      { chain: 'cx2', axis: 'X', px: 420, cm: 2100 },
      { chain: 'cy2', axis: 'Y', px: 440, cm: 2200 },
    ])
    expect(conflictOf(m)?.triggers ?? []).not.toContain('OUTER_TOTALS')
  })
})

// ---------------------------------------------------------------------------
// post-review (005D, C P0-1): the figure verifies the drawing's choice, never chooses among its scales
// ---------------------------------------------------------------------------

describe('the published figure never chooses among the scales the drawing states', () => {
  // The first-success house (5 cm/px registered) whose readings as printed state two scales: 4.0 cm/px
  // contradicts a third of the chain length as read, 4.6 cm/px two thirds, the registration all of it.
  const house = (): ReturnType<typeof sheet> => {
    const r = sheet(460, 480)
    walls(r, 40, 160, 400, 280, [{ side: 'S', from: 200, to: 247 }])
    walls(r, 120, 40, 200, 171)
    return r
  }
  const frame = planFrame(FRAME, 'GROUND', { width: 460, height: 480 })
  const stated = (): MetricEvidenceSet => {
    const at = (chain: string, axis: 'X' | 'Y', from: number, to: number, cm: number) => ({ chain, axis, px: to - from, cm, from })
    const m = metricsWith([at('cx', 'X', 40, 120, 320), at('cx', 'X', 120, 200, 368), at('cx', 'X', 200, 400, 800), at('cy', 'Y', 40, 160, 480), at('cy', 'Y', 160, 280, 552)].map((s) => ({ chain: s.chain, axis: s.axis, px: s.px, cm: s.cm })))
    // one chain per axis, its segments laid end to end from the house's corner
    const byChain = new Map<string, DimensionChain>()
    for (const c of m.chains) {
      const key = c.axis
      const prev = byChain.get(key)
      const from = prev ? prev.ticksPx[prev.ticksPx.length - 1] : 40
      const seg = { ...c.segments[0], fromPx: from, toPx: from + c.segments[0].pixelLength }
      byChain.set(key, prev ? { ...prev, ticksPx: [...prev.ticksPx, seg.toPx], segments: [...prev.segments, { ...seg, index: prev.segments.length }] } : { ...c, id: key === 'HORIZONTAL' ? 'cx' : 'cy', baselinePx: 20, ticksPx: [from, seg.toPx], segments: [seg] })
    }
    const hypotheses = [
      { id: 'scale-a', cmPerPixel: 4.0, independentGroups: 3, independentWeight: 3 },
      { id: 'scale-b', cmPerPixel: 4.6, independentGroups: 2, independentWeight: 2 },
    ].map((h) => ({ witnessIds: [], groups: 1, chains: 1, independentAxes: ['X'], weight: 1, longestShare: 0.5, substantialWitnesses: 1, majorWitnesses: 1, corroborated: false, axesMeasured: false, residualPx: 0, plausible: true, why: 'a fixture', ...h }))
    return { ...m, schemaVersion: '1.3.0', chains: [...byChain.values()], metricSolutions: [{ ...unconfirmed(), hypotheses, counts: { textRegions: 0, observations: 0, hypotheses: 2 } } as FrameMetricSolution] }
  }
  const run = (published: number) => {
    const trace: SolverTraceEvent[] = []
    let completed = false
    try {
      reconstructV2({ label: 'fixture', slug: 'fixture', sourcePackageId: 'src-test', sourcePackageHash: 'd'.repeat(64), graph: graphOf([frame]), metrics: stated(), raster: () => house(), publishedAreas: [{ key: 'footprint_area', label: 'footprint', unit: 'm2', value: published }], trace: (e) => trace.push(e) })
      completed = true
    } catch (error) {
      if (!(error instanceof ReconstructionFailure)) throw error
    }
    const challenges = trace.filter((e) => e.substage === 'METRIC_CHALLENGE').map((e) => e.counts as Record<string, number | string>)
    return { completed, challenges }
  }

  it('sweeping the figure across every reading the drawing states builds one scale or none', () => {
    const built = new Set<number>()
    for (const published of [70, 85, 92, 100, 106, 112, 120, 140, 160]) {
      const { completed, challenges } = run(published)
      // one challenge, never a second one on the reading the first already answered
      expect(challenges, `${published}`).toHaveLength(1)
      expect(challenges[0].sourceConflict, `${published}`).toBeTruthy()
      if (completed) {
        expect(challenges[0].outcome).toBe('REPLACED')
        expect(challenges[0].publishedFigure).toBe('VERIFIED')
        built.add(Number(challenges[0].chosenCmPerPx))
      } else expect(challenges[0].outcome, `${published}`).toBe('REFUSED')
    }
    // the drawing's own choice (the scale that contradicts least of what was printed), and only that
    expect([...built]).toEqual([4])
  })
})
