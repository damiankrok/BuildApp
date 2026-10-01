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
import { sourceConflictOf } from '../src/index.js'
import { WALL, metricsOf, registration } from './plan.js'

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
