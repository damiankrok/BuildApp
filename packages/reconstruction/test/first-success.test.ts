/**
 * The confidence-aware first success (BUILDPLAN-ANALYZER-005B, resolver 1.3.0).
 *
 * A first reading that completes keeps the fast path only when its base
 * plan's scale was chosen or confirmed by independent readings (at least
 * SUPPORTED) and its frame came from its dimension chains. Otherwise its
 * metric alternatives are weighed, and whatever the outcome, the weakness is
 * named. A plan that cannot be read on an INCONCLUSIVE scale stops with the
 * typed METRIC_RESOLUTION_INCONCLUSIVE. Synthetic plans only.
 */
import { describe, expect, it } from 'vitest'
import type { FrameMetricSolution, MetricConfidence } from '@buildapp/source-metrics'
import { ReconstructionFailure, reconstructV2 } from '../src/index.js'
import type { SolverTraceEvent } from '../src/index.js'
import { chain, graphOf, metricsOf, planFrame, registration, sheet, walls } from './plan.js'

const FRAME = 'frame-plan'
const frame = planFrame(FRAME, 'GROUND', { width: 460, height: 480 })
const onPlan = <T extends { frameId: string }>(x: T): T => ({ ...x, frameId: FRAME })

/** An 18 × 6 m house with a 4 × 6 m walled room on its north side (132 m²), as in the resolver suite. */
function house(): ReturnType<typeof sheet> {
  const r = sheet(460, 480)
  walls(r, 40, 160, 400, 280, [{ side: 'S', from: 200, to: 247 }])
  walls(r, 120, 40, 200, 171)
  return r
}

const solution = (relation: FrameMetricSolution['relation'], confidence: MetricConfidence): FrameMetricSolution => ({
  frameId: FRAME,
  assetId: 'asset-test',
  relation,
  confidence,
  cmPerPixelX: 5,
  cmPerPixelY: 5,
  anisotropy: 1,
  isotropy: 'ASSUMED',
  hypotheses: [],
  legacy: { cmPerPixel: 5, independentGroups: confidence === 'INCONCLUSIVE' ? 0 : 1, independentWeight: confidence === 'INCONCLUSIVE' ? 0 : 1, correctedAnchors: 0, readAnchors: 2 },
  independentWitnesses: confidence === 'INCONCLUSIVE' ? 0 : 1,
  supportingObservationIds: [],
  conflictingObservationIds: [],
  orientationDecisions: [],
  rereadChainIds: [],
  counts: { textRegions: 0, observations: 0, hypotheses: 0 },
  why: 'a fixture',
})

function run(options: { solution?: FrameMetricSolution; chains?: { cx: number[]; cy: number[] }; publishedFootprintM2?: number }) {
  const trace: SolverTraceEvent[] = []
  const c = options.chains ?? { cx: [40, 120, 200, 400], cy: [40, 160, 280] }
  const chains = [onPlan(chain('cx', 'HORIZONTAL', c.cx, { baselinePx: 20 })), onPlan(chain('cy', 'VERTICAL', c.cy, { baselinePx: 20 }))]
  const metrics = { ...metricsOf(chains, [onPlan(registration())]), ...(options.solution ? { metricSolutions: [options.solution] } : {}) }
  try {
    const result = reconstructV2({
      label: 'fixture',
      slug: 'fixture',
      sourcePackageId: 'src-test',
      sourcePackageHash: 'd'.repeat(64),
      graph: graphOf([frame]),
      metrics,
      raster: () => house(),
      publishedAreas: options.publishedFootprintM2 === undefined ? undefined : [{ key: 'footprint_area', label: 'footprint', unit: 'm2', value: options.publishedFootprintM2 }],
      trace: (e) => trace.push(e),
    })
    return { result, trace }
  } catch (error) {
    if (error instanceof ReconstructionFailure) return { failure: error, trace }
    throw error
  }
}

const challenge = (trace: readonly SolverTraceEvent[]) => trace.find((e) => e.substage === 'METRIC_CHALLENGE')

describe('the first success is confidence-aware', () => {
  it('a base scale confirmed as STRONG keeps the fast path: no challenge', () => {
    const { result, trace } = run({ solution: solution('CONFIRMED', 'STRONG') })
    expect(result).toBeDefined()
    expect(challenge(trace)).toBeUndefined()
  })

  it('a WEAK base scale is challenged, and the trigger names why', () => {
    const { result, trace } = run({ solution: solution('LEGACY_UNCONFIRMED', 'WEAK') })
    expect(result).toBeDefined()
    const c = challenge(trace)
    expect(c).toBeDefined()
    expect(String(c?.counts?.trigger)).toContain('WEAK')
    // nothing better is offered, so the first reading stands — named, not silently accepted
    expect(c?.counts?.outcome).toBe('KEPT')
    expect(result?.planDiagnostics.plans.find((p) => p.frameId === FRAME)?.metric?.confidence).toBe('WEAK')
  })

  it('evidence sealed before the metric schema 1.2.0 (no solution) keeps the fast path, as it always had', () => {
    const { result, trace } = run({})
    expect(result).toBeDefined()
    expect(challenge(trace)).toBeUndefined()
  })
})

describe('an honest metric stop', () => {
  // The only read chains measure one room: the first reading stops on the drawing.
  const ROOM = { cx: [120, 200], cy: [40, 160, 280] }

  it('when the plan cannot be read and its base scale is INCONCLUSIVE, the stop is METRIC_RESOLUTION_INCONCLUSIVE and says what was weighed', () => {
    const { failure } = run({ solution: solution('LEGACY_UNCONFIRMED', 'INCONCLUSIVE'), chains: ROOM })
    expect(failure?.code).toBe('METRIC_RESOLUTION_INCONCLUSIVE')
    expect(failure?.diagnostics).toMatchObject({ metricRelation: 'LEGACY_UNCONFIRMED', metricConfidence: 'INCONCLUSIVE' })
  })

  it('CONTROL: the same plan on a SUPPORTED scale stops with the resolver’s own reason, not a metric one', () => {
    const { failure } = run({ solution: solution('CONFIRMED', 'SUPPORTED'), chains: ROOM })
    expect(failure).toBeDefined()
    expect(failure?.code).not.toBe('METRIC_RESOLUTION_INCONCLUSIVE')
  })
})
