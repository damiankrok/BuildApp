/**
 * v3.51 ANY-LINK-3 (found by the ANY-LINK control sample): a reading that stands on a scale nothing on the drawing
 * confirmed, with the published building's proportions at another size, is contradicted by the page's two published
 * dimensions (`extentContradiction`) — and they are then asked for the scale. A confirmed scale, one side that
 * differs, or two different factors are no contradiction.
 */
import { describe, expect, it } from 'vitest'
import type { FrameMetricSolution, MetricConfidence } from '@buildapp/source-metrics'
import { ReconstructionFailure, reconstructV2 } from '../src/index.js'
import type { SolverTraceEvent } from '../src/index.js'
import { composeStructuralLayout } from '../src/structural.js'
import type { StructuralPassOptions } from '../src/structural.js'
import { extentContradiction } from '../src/v2/published-scale.js'
import type { chain } from './plan.js'
import { graphOf, metricsOf, planFrame, registration, sheet, walls } from './plan.js'

const FRAME = 'frame-plan'
const frame = planFrame(FRAME, 'GROUND', { width: 460, height: 480 })
const onPlan = <T extends { frameId: string }>(x: T): T => ({ ...x, frameId: FRAME })

/** An 18 × 12 m house at the fixture's registered 5 cm/px. */
function house(): ReturnType<typeof sheet> {
  const r = sheet(460, 480)
  walls(r, 40, 160, 400, 400, [{ side: 'S', from: 200, to: 247 }])
  return r
}
const solution = (relation: FrameMetricSolution['relation'], confidence: MetricConfidence): FrameMetricSolution =>
  ({ frameId: FRAME, assetId: 'asset-test', relation, confidence, cmPerPixelX: 5, cmPerPixelY: 5, anisotropy: 1, isotropy: 'ASSUMED', hypotheses: [], legacy: { cmPerPixel: 5, independentGroups: 1, independentWeight: 1, correctedAnchors: 0, readAnchors: 2 }, independentWitnesses: 1, supportingObservationIds: [], conflictingObservationIds: [], orientationDecisions: [], rereadChainIds: [], counts: { textRegions: 0, observations: 0, hypotheses: 0 }, why: 'a fixture' }) as unknown as FrameMetricSolution
/** No dimension is printed on the sheet: its registered scale is a legacy estimate nothing confirms. */
const chains = (): ReturnType<typeof chain>[] => []

describe('whether two published dimensions contradict a reading’s size', () => {
  const options = { slug: 't', sourcePackageId: 'src-test', sourcePackageHash: 'd'.repeat(64), graph: graphOf([frame]), metrics: metricsOf(chains(), [onPlan(registration())]), raster: () => house(), levels: { floors: [0], heights: [2.8], evidenceIds: [], measured: false }, sheetCache: new Map() } as unknown as StructuralPassOptions
  const reading = composeStructuralLayout(options)

  it('the same shape at another size is a contradiction, whichever way round the page gives the figures', () => {
    for (const [a, b] of [[15, 10], [10, 15]] as const) {
      const c = extentContradiction(reading, a, b)
      expect(c?.publishedM).toEqual([15, 10])
      // read off the walls' faces, with no printed dimension: 18 m by 12 m to within a wall
      expect(c?.outlineM[0]).toBeGreaterThan(17)
      expect(c?.outlineM[0]).toBeLessThan(18.5)
      expect(c?.factor).toBeGreaterThan(1.12)
      expect(c?.factor).toBeLessThan(1.22)
    }
    expect(extentContradiction(reading, 22.5, 15)?.factor).toBeCloseTo(0.8, 1)
  })

  it('counter-cases: figures that agree; one side that differs; two factors; opposite directions; no figures', () => {
    expect(extentContradiction(reading, 18, 12)).toBeUndefined()
    expect(extentContradiction(reading, 17.2, 11.6)).toBeUndefined()
    // one side short: a part that was not read, not a wrong scale
    expect(extentContradiction(reading, 18, 9)).toBeUndefined()
    // both off, by different factors: the figures describe something else
    expect(extentContradiction(reading, 15, 7.5)).toBeUndefined()
    // one larger, one smaller
    expect(extentContradiction(reading, 22, 9)).toBeUndefined()
    expect(extentContradiction(reading, 0, 0)).toBeUndefined()
  })
})

function run(options: { solution: FrameMetricSolution; widthM?: number; lengthM?: number }) {
  const trace: SolverTraceEvent[] = []
  const metrics = { ...metricsOf(chains(), [onPlan(registration())]), metricSolutions: [options.solution] }
  const published = [...(options.widthM !== undefined ? [{ key: 'building_width', label: 'width', unit: 'm', value: options.widthM }] : []), ...(options.lengthM !== undefined ? [{ key: 'building_length', label: 'length', unit: 'm', value: options.lengthM }] : [])]
  try {
    const result = reconstructV2({ label: 'fixture', slug: 'fixture', sourcePackageId: 'src-test', sourcePackageHash: 'd'.repeat(64), graph: graphOf([frame]), metrics, raster: () => house(), publishedAreas: published, trace: (e) => trace.push(e) })
    return { result, trace }
  } catch (error) {
    if (error instanceof ReconstructionFailure) return { failure: error, trace }
    throw error
  }
}
const asked = (trace: readonly SolverTraceEvent[]) => trace.filter((e) => e.substage === 'PUBLISHED_EXTENT_SCALE' || e.substage === 'PUBLISHED_EXTENT_CONTRADICTION')
const widthOf = (r: ReturnType<typeof run>): number => {
  const xs = (r.result?.model.walls ?? []).flatMap((w) => [w.start.x, w.end.x])
  return xs.length > 0 ? Math.max(...xs) - Math.min(...xs) : 0
}

describe('an unconfirmed scale the published dimensions contradict gives way to them', () => {
  it('the reading is re-scaled to the published dimensions, as an approximation named as one', () => {
    const r = run({ solution: solution('LEGACY_UNCONFIRMED', 'WEAK'), widthM: 15, lengthM: 10 })
    expect(r.failure).toBeUndefined()
    const events = asked(r.trace)
    expect(events.map((e) => e.substage)).toEqual(['PUBLISHED_EXTENT_SCALE'])
    expect(Math.abs(widthOf(r) / 15 - 1)).toBeLessThan(0.04)
    expect(r.result?.unresolved.some((u) => u.what === 'the scale of the base plan' && u.status === 'AMBIGUOUS')).toBe(true)
  })

  it('counter-case: a scale the drawing’s own dimensions confirm is not put to the figures', () => {
    const r = run({ solution: solution('CONFIRMED', 'SUPPORTED'), widthM: 15, lengthM: 10 })
    expect(asked(r.trace)).toEqual([])
    expect(widthOf(r)).toBeGreaterThan(17)
  })

  it('counter-case: figures that agree with the reading, or only one figure, change nothing', () => {
    for (const figures of [{ widthM: 18, lengthM: 12 }, { widthM: 15 }, {}]) {
      const r = run({ solution: solution('LEGACY_UNCONFIRMED', 'WEAK'), ...figures })
      expect(asked(r.trace)).toEqual([])
      expect(widthOf(r)).toBeGreaterThan(17)
    }
  })
})
