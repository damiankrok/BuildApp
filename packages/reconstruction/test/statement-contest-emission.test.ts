/**
 * A withdrawn accusation through the production solver (BUILDPLAN-ANALYZER-005P, plan resolver 1.5.0).
 *
 * The first-success house (an 18 × 6 m body with a 4 × 6 m walled room, 5 cm/px, a STRONG confirmed scale) whose two
 * long chain spans the classic reader misread by a middle digit: 900 over 200 px and 540 over 120 px, which agree on
 * 4.5 cm/px on both axes — while the external reader read 1000 and 600 on the same ink. Plan resolver 1.4.0 accuses the
 * registration (OUTER_TOTALS), challenges the first reading, keeps it (nothing better is offered) and records an
 * AMBIGUOUS scale. 1.5.0 withdraws the accusation: no challenge runs, the withdrawal is traced (SOURCE_CONFLICT_REVIEW)
 * and the result carries an AMBIGUOUS gap naming the readers. The building is the same either way. Synthetic only.
 */
import { describe, expect, it } from 'vitest'
import type { DimensionChain, FrameMetricSolution, MetricEvidence, MetricEvidenceSet, NumericLatticeRecord, OcrToken } from '@buildapp/source-metrics'
import { reconstructV2 } from '../src/index.js'
import type { SolverTraceEvent } from '../src/index.js'
import { chain, graphOf, metricsOf, planFrame, registration, sheet, walls } from './plan.js'

const FRAME = 'frame-plan'
const frame = planFrame(FRAME, 'GROUND', { width: 460, height: 480 })
const onPlan = <T extends { frameId: string }>(x: T): T => ({ ...x, frameId: FRAME })

function house(): ReturnType<typeof sheet> {
  const r = sheet(460, 480)
  walls(r, 40, 160, 400, 280, [{ side: 'S', from: 200, to: 247 }])
  walls(r, 120, 40, 200, 171)
  return r
}

const strong: FrameMetricSolution = {
  frameId: FRAME,
  assetId: 'asset-test',
  relation: 'CONFIRMED',
  confidence: 'STRONG',
  cmPerPixelX: 5,
  cmPerPixelY: 5,
  anisotropy: 1,
  isotropy: 'ASSUMED',
  hypotheses: [],
  legacy: { cmPerPixel: 5, independentGroups: 1, independentWeight: 1, correctedAnchors: 0, readAnchors: 2 },
  independentWitnesses: 1,
  supportingObservationIds: [],
  conflictingObservationIds: [],
  orientationDecisions: [],
  rereadChainIds: [],
  counts: { textRegions: 0, observations: 0, hypotheses: 0 },
  why: 'a fixture',
}

/** The two long spans' statements: corrected to the drawing's own scale, first read with a middle digit misread. */
function metrics(options: { external: boolean }): MetricEvidenceSet {
  const cx = onPlan(chain('cx', 'HORIZONTAL', [40, 120, 200, 400], { baselinePx: 20 }))
  const cy = onPlan(chain('cy', 'VERTICAL', [40, 160, 280], { baselinePx: 20 }))
  const stated = [
    { c: cx, index: 2, token: '900', value: 1000 },
    { c: cy, index: 1, token: '540', value: 600 },
  ]
  const evidence: MetricEvidence[] = []
  const tokens: OcrToken[] = []
  const lattices: NumericLatticeRecord[] = []
  stated.forEach((s, i) => {
    const seg = s.c.segments[s.index]
    const box = { x0: 300 + 30 * i, y0: 400, x1: 320 + 30 * i, y1: 410 }
    tokens.push({ id: `tok-${i}`, frameId: FRAME, assetId: 'asset-test', text: s.token, box, confidence: 0.6, score: 0.5, shearDeg: 0, heightPx: 14 } as OcrToken)
    evidence.push({ id: `ev-${i}`, kind: 'LINEAR_DIMENSION', frameId: FRAME, assetId: 'asset-test', variantByteHash: 'b'.repeat(64), value: s.value, unit: 'cm', origin: 'CHAIN_CORRECTED', rawText: s.token, pixelLength: seg.pixelLength, association: { kind: 'DIMENSION_LINE', score: 0.9, why: 'a fixture', observationIds: [] }, chainId: s.c.id, ocrTokenIds: [`tok-${i}`], observationIds: [], alternatives: [], confidence: 0.9, provenance: { extractor: 'NUMERIC_OCR', name: 'fixture', detail: 'a fixture' } } as unknown as MetricEvidence)
    s.c.segments[s.index] = { ...seg, origin: 'CHAIN_CORRECTED', evidenceId: `ev-${i}` }
    const read = Number(s.token)
    lattices.push({
      id: `lat-${i}`,
      frameId: FRAME,
      box,
      asRead: s.token,
      asReadValueCm: read,
      ocrClass: 'CLEAR',
      ...(options.external
        ? { ensemble: { decision: 'CONTESTS', external: { text: String(s.value), valueCm: s.value, posterior: 0.999, meanP: 0.999, stable: true, confident: true }, lattice: { asRead: s.token, valueCm: read, ocrClass: 'CLEAR' }, asRead: s.token, asReadValueCm: read, ocrClass: 'AMBIGUOUS', rival: { text: String(s.value), valueCm: s.value, witness: 'EXTERNAL' }, why: 'a fixture' } }
        : {}),
    } as unknown as NumericLatticeRecord)
  })
  const chains: DimensionChain[] = [cx, cy]
  return { ...metricsOf(chains, [onPlan(registration())]), evidence, ocrTokens: tokens, numericLattices: lattices, metricSolutions: [strong] }
}

function run(external: boolean) {
  const trace: SolverTraceEvent[] = []
  const result = reconstructV2({ label: 'fixture', slug: 'fixture', sourcePackageId: 'src-test', sourcePackageHash: 'd'.repeat(64), graph: graphOf([frame]), metrics: metrics({ external }), raster: () => house(), trace: (e) => trace.push(e) })
  return { result, trace }
}

describe('a withdrawn accusation through the production solver', () => {
  const incumbent = run(false) // no external reading: every statement read as printed, as 1.4.0 read it
  const doubted = run(true)

  it('read as printed, the misreads accuse the registration: challenged, kept, the scale recorded AMBIGUOUS', () => {
    const c = incumbent.trace.find((e) => e.substage === 'METRIC_CHALLENGE')
    expect(c?.counts).toMatchObject({ outcome: 'KEPT', sourceConflict: 'OUTER_TOTALS' })
    expect(incumbent.trace.some((e) => e.substage === 'SOURCE_CONFLICT_REVIEW')).toBe(false)
    expect(incumbent.result.unresolved.map((u) => u.what)).toContain('the scale of the base plan')
  })

  it('with the external readings, the accusation is withdrawn: no challenge, a SOURCE_CONFLICT_REVIEW naming the readers', () => {
    expect(doubted.trace.some((e) => e.substage === 'METRIC_CHALLENGE')).toBe(false)
    const review = doubted.trace.find((e) => e.substage === 'SOURCE_CONFLICT_REVIEW')
    expect(review?.counts).toMatchObject({ withdrawnTriggers: 'OUTER_TOTALS', doubtedCount: 2, stillStanding: '' })
    expect(String(review?.counts.doubted)).toBe('ev-0=AS_PRINTED 900|LATTICE 900|EXTERNAL 1000; ev-1=AS_PRINTED 540|LATTICE 540|EXTERNAL 600')
  })

  it('the withdrawal is carried in the result as an AMBIGUOUS gap, not only in the trace', () => {
    const gap = doubted.result.unresolved.find((u) => u.what === 'the scale of the base plan (an accusation withdrawn)')
    expect(gap?.status).toBe('AMBIGUOUS')
    expect(gap?.evidenceIds).toEqual(['ev-0', 'ev-1'])
    expect(gap?.reason).toContain('EXTERNAL 1000')
  })

  it('it decides nothing: the building is the same as the incumbent’s', () => {
    expect(doubted.result.model).toEqual(incumbent.result.model)
    expect(doubted.result.building).toEqual(incumbent.result.building)
  })
})
