/**
 * v3.53.13 (resolver 1.6.0): a scale the metric layer chose STRONG from independent readings is not traded for a rival it
 * weighed and found far weaker. The found cause, on a public plan: four independent readings stated the plan's scale;
 * one reading stated a rival a quarter larger; the first reading of the plan stopped, the resolver tried the rival, and
 * the published floor area — not any reading — chose it (each length 27 % too long). Synthetic solutions only.
 */
import { describe, expect, it } from 'vitest'
import type { CoordinateRegistration, FrameMetricSolution } from '@buildapp/source-metrics'
import { metricScales } from '../src/plan-resolution.js'

type Hyp = FrameMetricSolution['hypotheses'][number]
const hyp = (id: string, cmPerPixel: number, independentGroups: number, independentWeight: number): Hyp => ({
  id,
  cmPerPixel,
  witnessIds: [],
  groups: independentGroups,
  independentGroups,
  chains: independentGroups,
  independentAxes: ['X', 'Y'],
  weight: independentWeight,
  independentWeight,
  longestShare: 1,
  substantialWitnesses: independentGroups,
  majorWitnesses: 1,
  corroborated: independentGroups > 1,
  axesMeasured: independentGroups > 1,
  residualPx: 0.5,
  plausible: true,
  why: `${independentGroups} independent readings`,
})
const solution = (over: Partial<FrameMetricSolution>, hypotheses: Hyp[]): FrameMetricSolution =>
  ({ frameId: 'f', assetId: 'a', relation: 'REPLACED', confidence: 'STRONG', selectedHypothesisId: hypotheses[0].id, hypotheses, why: 'synthetic', ...over }) as unknown as FrameMetricSolution
const registration = (cmPerPx: number): CoordinateRegistration => ({ metresPerPixelX: cmPerPx / 100, metresPerPixelY: cmPerPx / 100 }) as unknown as CoordinateRegistration

describe('v3.53.13 a STRONG metric scale is not traded for a far weaker rival', () => {
  const strong = hyp('scale-3-13', 3.13, 4, 30)
  const weak = hyp('scale-3-98', 3.98, 1, 2.1) // 7 % of the selection's support

  it('cause: the rival with 7 % of the support is not offered to the resolver', () => {
    expect(metricScales(solution({}, [strong, weak]), registration(3.128)).map((s) => s.cmPerPx)).toEqual([])
  })

  it('counter-test: a rival with at least half the support is a contest the resolver may still try', () => {
    const contender = hyp('scale-3-98', 3.98, 2, 16)
    expect(metricScales(solution({}, [strong, contender]), registration(3.128)).map((s) => s.cmPerPx)).toEqual([3.98])
  })

  it('counter-test: an unsettled solution (INCONCLUSIVE or WEAK) offers its rivals as before', () => {
    expect(metricScales(solution({ confidence: 'INCONCLUSIVE', relation: 'LEGACY_UNCONFIRMED' }, [strong, weak]), registration(3.128)).map((s) => s.cmPerPx)).toEqual([3.13, 3.98].filter((v) => Math.abs(v / 3.128 - 1) > 0.03))
    expect(metricScales(solution({ confidence: 'WEAK' }, [strong, weak]), registration(3.128)).map((s) => s.cmPerPx)).toEqual([3.98])
  })

  it('counter-test: a STRONG selection the sheet was NOT registered at protects nothing (the registration is the doubt)', () => {
    // registered at 2.40 cm/px: the STRONG 3.13 and the rival are both offered, strongest first
    expect(metricScales(solution({}, [strong, weak]), registration(2.4)).map((s) => s.cmPerPx)).toEqual([3.13, 3.98])
  })
})
