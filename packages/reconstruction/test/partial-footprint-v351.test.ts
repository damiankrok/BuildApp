/**
 * v3.51 ANY-LINK-3: a sound reading of PART of the building is kept as a partial preview (`v2/partial-footprint.ts`)
 * when the published footprint refused it and no other reading of the plan held — and only then. The whole path is
 * measured on real pages (research/source-to-model/ANYLINK-SET.json); here, on drawn sheets whose answer is known:
 * what is kept, and everything that must still be refused.
 */
import { describe, expect, it } from 'vitest'
import type { FrameMetricSolution } from '@buildapp/source-metrics'
import { layoutRefused } from '../src/plan-diagnostics.js'
import { composeStructuralLayout } from '../src/structural.js'
import type { StructuralPassOptions } from '../src/structural.js'
import { PARTIAL_FOOTPRINT_EXPLAINED_WITHIN, PARTIAL_FOOTPRINT_MIN_SHARE, openPartsOf, partialFootprint } from '../src/v2/partial-footprint.js'
import type { PartialFootprintRefusal } from '../src/v2/partial-footprint.js'
import { chain, graphOf, metricsOf, partition, planFrame, registration, sheet, walls } from './plan.js'

const FRAME = 'frame-plan'
const frame = planFrame(FRAME, 'GROUND', { width: 560, height: 460 })
const onPlan = <T extends { frameId: string }>(x: T): T => ({ ...x, frameId: FRAME })
const solution = (relation: FrameMetricSolution['relation']): FrameMetricSolution =>
  ({ frameId: FRAME, assetId: 'asset-test', relation, confidence: 'SUPPORTED', cmPerPixelX: 5, cmPerPixelY: 5, anisotropy: 1, isotropy: 'ASSUMED', hypotheses: [], legacy: { cmPerPixel: 5, independentGroups: 1, independentWeight: 1, correctedAnchors: 0, readAnchors: 2 }, independentWitnesses: 2, supportingObservationIds: [], conflictingObservationIds: [], orientationDecisions: [], rereadChainIds: [], counts: { textRegions: 0, observations: 0, hypotheses: 0 }, why: 'a fixture' }) as unknown as FrameMetricSolution

/**
 * An 18 × 12 m house (216 m² at the fixture's 5 cm/px) with a 6 m wide, 3 m deep loggia let into its south side: a
 * wide mouth with a pocket behind it, which the reading leaves open and records.
 */
const withLoggia = (): ReturnType<typeof sheet> => {
  const r = sheet(560, 460)
  walls(r, 100, 100, 460, 340, [{ side: 'S', from: 220, to: 340 }])
  partition(r, 214, 280, 226, 340)
  partition(r, 334, 280, 346, 340)
  partition(r, 214, 274, 346, 286)
  return r
}
/** An 18 × 10 m house (180 m²) with two free-standing walls of a porch in front of it: nothing the reading records as open. */
const withPorchWalls = (): ReturnType<typeof sheet> => {
  const r = sheet(560, 460)
  walls(r, 100, 100, 460, 300)
  partition(r, 200, 300, 212, 380)
  partition(r, 348, 300, 360, 380)
  return r
}

const optionsFor = (raster: ReturnType<typeof sheet>, publishedM2: number, south: number, extra: { relation?: FrameMetricSolution['relation']; anchors?: number } = {}): StructuralPassOptions => {
  const chains = [onPlan(chain('cx', 'HORIZONTAL', [100, 460], { baselinePx: 40 })), onPlan(chain('cy', 'VERTICAL', [100, south], { baselinePx: 40 }))]
  const reg = { ...onPlan(registration()), anchors: Array.from({ length: extra.anchors ?? 2 }, (_, i) => ({ id: `a${i}` })) } as unknown as ReturnType<typeof registration>
  const metrics = { ...metricsOf(chains, [reg]), metricSolutions: [solution(extra.relation ?? 'CONFIRMED')] }
  return { slug: 't', sourcePackageId: 'src-test', sourcePackageHash: 'd'.repeat(64), graph: graphOf([frame]), metrics, raster: () => raster, levels: { floors: [0], heights: [2.8], evidenceIds: [], measured: false }, publishedAreas: [{ key: 'footprint_area', label: 'footprint', unit: 'm2', value: publishedM2 }], sheetCache: new Map() } as unknown as StructuralPassOptions
}
const ask = (options: StructuralPassOptions) => {
  const incumbent = composeStructuralLayout(options)
  const refusals: PartialFootprintRefusal[] = []
  return { incumbent, refusals, outcome: partialFootprint(options, incumbent, refusals) }
}

describe('a sound reading that covers less than the published footprint is kept as a part', () => {
  it('the first reading is refused by the figure alone, and records the open part beside its body', () => {
    const { incumbent } = ask(optionsFor(withLoggia(), 290, 340))
    expect(layoutRefused(incumbent.layout)).toBe(true)
    expect(incumbent.layout.gate.reasons.filter((r) => r.severity === 'BLOCKING').map((r) => r.code)).toEqual(['FOOTPRINT_AREA_WRONG'])
    expect(openPartsOf(incumbent)).toEqual([expect.objectContaining({ kind: 'POCKET_BEHIND_A_WIDE_MOUTH', areaM2: 18 })])
  })

  it('kept: the shortfall is named, still BLOCKING, and no longer a refusal', () => {
    const { outcome, refusals } = ask(optionsFor(withLoggia(), 290, 340))
    expect(refusals).toEqual([])
    expect(outcome?.builtM2).toBeCloseTo(216, 1)
    expect(outcome?.shortfallM2).toBeCloseTo(74, 1)
    expect(outcome?.shortfallShare).toBeCloseTo(74 / 290, 3)
    const blocking = outcome?.result.layout.gate.reasons.filter((r) => r.severity === 'BLOCKING') ?? []
    expect(blocking.map((r) => r.code)).toEqual(['FOOTPRINT_AREA_SHORT'])
    expect(blocking[0].why).toMatch(/of the published footprint is not in the model/)
    expect(outcome && layoutRefused(outcome.result.layout)).toBe(false)
    // the partial preview carries the reason: the verdict is not softened
    expect(outcome?.result.layout.gate.status).toBe('STRUCTURAL_LAYOUT_REJECTED')
    // the bodies are the first reading's own
    expect(outcome?.result.layout.masses.length).toBe(1)
  })
})

describe('everything else is still refused', () => {
  it('counter-case: a lowest storey LARGER than the figure is never excused — by the rule, or by the gate if asked', () => {
    const options = optionsFor(withLoggia(), 150, 340)
    const { outcome, refusals, incumbent } = ask(options)
    expect(layoutRefused(incumbent.layout)).toBe(true)
    expect(outcome).toBeUndefined()
    expect(refusals).toEqual(['LARGER_THAN_PUBLISHED'])
    const forced = composeStructuralLayout({ ...options, footprintShortfall: { why: 'a caller that should not have asked' } })
    expect(forced.layout.gate.reasons.filter((r) => r.severity === 'BLOCKING').map((r) => r.code)).toEqual(['FOOTPRINT_AREA_WRONG'])
  })

  it('counter-case: under two thirds of the published footprint, part of the house itself is missing', () => {
    const { outcome, refusals } = ask(optionsFor(withLoggia(), 216 / PARTIAL_FOOTPRINT_MIN_SHARE + 20, 340))
    expect(outcome).toBeUndefined()
    expect(refusals).toEqual(['TOO_LITTLE_OF_THE_FOOTPRINT'])
  })

  it('counter-case: a scale the drawing does not state — unconfirmed, or on fewer than two anchors', () => {
    for (const extra of [{ relation: 'LEGACY_UNCONFIRMED' as const }, { relation: 'NO_SCALE' as const }, { anchors: 1 }, { anchors: 0 }]) {
      const { outcome, refusals } = ask(optionsFor(withLoggia(), 290, 340, extra))
      expect(outcome).toBeUndefined()
      expect(refusals).toEqual(['SCALE_NOT_STATED_BY_THE_DRAWING'])
    }
  })

  it('counter-case: no open part drawn beside the bodies — the shortfall is unexplained', () => {
    const { outcome, refusals, incumbent } = ask(optionsFor(withPorchWalls(), 262, 300))
    expect(layoutRefused(incumbent.layout)).toBe(true)
    expect(openPartsOf(incumbent)).toEqual([])
    expect(outcome).toBeUndefined()
    expect(refusals).toEqual(['SHORTFALL_NOT_SHOWN_BY_THE_DRAWING'])
  })

  it('counter-case: an open part too small to be the rest of the footprint', () => {
    // 216 m² built + 18 m² shown = 234 m²; the figure asks for more than 234 / 0.8
    const { outcome, refusals } = ask(optionsFor(withLoggia(), Math.ceil(234 / (1 - PARTIAL_FOOTPRINT_EXPLAINED_WITHIN)) + 10, 340))
    expect(outcome).toBeUndefined()
    expect(refusals).toEqual(['SHORTFALL_NOT_SHOWN_BY_THE_DRAWING'])
  })

  it('counter-case: a reading the figure did not refuse is not this rule’s to touch', () => {
    const { outcome, refusals, incumbent } = ask(optionsFor(withLoggia(), 240, 340))
    expect(layoutRefused(incumbent.layout)).toBe(false)
    expect(outcome).toBeUndefined()
    expect(refusals).toEqual(['NOT_A_FOOTPRINT_REFUSAL'])
  })
})
