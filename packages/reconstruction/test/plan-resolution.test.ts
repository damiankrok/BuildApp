/**
 * The plan resolver (BUILDPLAN-ANALYZER-005A): when the first reading of a
 * plan stops, other readings of the SAME drawing are weighed — and only then.
 *
 * Synthetic plans at 5 cm/px (`plan.ts`), drawn to the shape of the failures
 * seen on real sheets: a covered terrace closed by line work against the
 * house, a scale the chain solver rewrote towards a misread overall
 * dimension. Nothing here names a real project or carries its figures.
 */
import { describe, expect, it } from 'vitest'
import type { CoordinateRegistration, MetricEvidence, MetricEvidenceSet } from '@buildapp/source-metrics'
import {
  ReconstructionFailure,
  acceptable,
  compareReadings,
  latticeScales,
  metricsAtScale,
  reconstructV2,
  sameBuilding,
  walledFirstRegions,
} from '../src/index.js'
import type { HypothesisScore, PlanDecomposition, RankedReading, SolverTraceEvent } from '../src/index.js'
import { WALL, chain, graphOf, metricsOf, planFrame, registration, sheet, walls } from './plan.js'
import { BLACK, drawLine } from '../../source-cv/test/draw.js'

const FRAME = 'frame-plan'
const frame = planFrame(FRAME, 'GROUND', { width: 460, height: 480 })
const onPlan = <T extends { frameId: string }>(x: T): T => ({ ...x, frameId: FRAME })

/**
 * An 18 × 6 m house with, on its north side, a 4 × 6 m walled room and beside
 * it a 6 × 6 m terrace closed by kerb lines only — inside the box the walls
 * span, as on a real sheet where the terrace fills a corner of the building.
 * The house and the room are 132 m²; the house, room and terrace 168 m².
 */
function houseWithTerrace(): ReturnType<typeof sheet> {
  const r = sheet(460, 480)
  walls(r, 40, 160, 400, 280, [{ side: 'S', from: 200, to: 247 }])
  walls(r, 120, 40, 200, 171)
  // the terrace: a kerb line on its two open sides, no wall band anywhere on them
  drawLine(r, 200, 42, 320, 42, BLACK)
  drawLine(r, 320, 42, 320, 160, BLACK)
  return r
}

function run(options: { publishedFootprintM2?: number; raster?: ReturnType<typeof sheet> }): { result?: ReturnType<typeof reconstructV2>; failure?: ReconstructionFailure; trace: SolverTraceEvent[] } {
  const trace: SolverTraceEvent[] = []
  const chains = [onPlan(chain('cx', 'HORIZONTAL', [40, 120, 200, 320, 400], { baselinePx: 20 })), onPlan(chain('cy', 'VERTICAL', [40, 160, 280], { baselinePx: 20 }))]
  try {
    const result = reconstructV2({
      label: 'fixture',
      slug: 'fixture',
      sourcePackageId: 'src-test',
      sourcePackageHash: 'd'.repeat(64),
      graph: graphOf([frame]),
      metrics: metricsOf(chains, [onPlan(registration())]),
      raster: () => options.raster ?? houseWithTerrace(),
      publishedAreas: options.publishedFootprintM2 === undefined ? undefined : [{ key: 'footprint_area', label: 'footprint', unit: 'm2', value: options.publishedFootprintM2 }],
      trace: (e) => trace.push(e),
    })
    return { result, trace }
  } catch (error) {
    if (error instanceof ReconstructionFailure) return { failure: error, trace }
    throw error
  }
}

describe('a terrace line-closed against the house', () => {
  it('the first reading takes house and terrace as one body; against a published house-only footprint it is refused, and the walled-first reading resolves it', () => {
    const { result, trace } = run({ publishedFootprintM2: 132 })
    expect(result).toBeDefined()
    const resolution = trace.find((e) => e.substage === 'PLAN_RESOLUTION')
    expect(resolution).toMatchObject({ status: 'DEGRADED' })
    expect(String(resolution?.counts.firstReading)).toBe('PLAN_LAYOUT_REJECTED')
    expect(String(resolution?.counts.chosenDepartures)).toContain('MERGE')
    // the building is the house, and the result says it was chosen among readings
    const area = result!.layout.footprintRegions.filter((r) => r.kind === 'BUILT').reduce((a, r) => a + r.areaM2, 0)
    expect(area).toBeGreaterThan(132 * 0.94)
    expect(area).toBeLessThan(132 * 1.06)
    expect(result!.layout.gate.status).toBe('STRUCTURAL_LAYOUT_PARTIAL')
    expect(result!.layout.gate.reasons.map((r) => r.code)).toContain('PLAN_RESOLVED_BY_HYPOTHESIS')
    expect(result!.layout.alternatives.some((a) => a.what.includes('reading of the base plan'))).toBe(true)
    expect(result!.layout.unresolved.some((u) => u.what.includes('enclosed plan outside the walled bodies'))).toBe(true)
    expect(result!.planDiagnostics.resolution?.outcome).toBe('RESOLVED')
  })

  it('is deterministic: the same inputs resolve to the same model, byte for byte', () => {
    const a = run({ publishedFootprintM2: 132 }).result
    const b = run({ publishedFootprintM2: 132 }).result
    expect(a?.candidate.modelHash).toBe(b?.candidate.modelHash)
    expect(a?.layout.contentHash).toBe(b?.layout.contentHash)
  })

  it('CONTROL: when the first reading holds, the resolver never runs', () => {
    const { result, trace } = run({ publishedFootprintM2: 168 })
    expect(result).toBeDefined()
    expect(trace.some((e) => e.substage === 'PLAN_RESOLUTION')).toBe(false)
    expect(result!.layout.gate.reasons.map((r) => r.code)).not.toContain('PLAN_RESOLVED_BY_HYPOTHESIS')
    expect(result!.planDiagnostics.resolution).toBeUndefined()
  })

  it('a published figure no reading of the drawing reaches is not chased: the first link is named, and the readings weighed are counted', () => {
    const { failure, trace } = run({ publishedFootprintM2: 40 })
    expect(failure?.code).toBe('PLAN_LAYOUT_REJECTED')
    expect(Number(failure?.diagnostics.readingsWeighed)).toBeGreaterThan(0)
    expect(trace.at(-1)).toMatchObject({ substage: 'PLAN_RESOLUTION', status: 'FAILED', reasonCode: 'PLAN_LAYOUT_REJECTED' })
    expect(failure?.plans?.resolution?.outcome).toBe('INCONCLUSIVE')
  })
})

// ---------------------------------------------------------------------------

/** A hand-built decomposition: `cells[iy][ix]` as [class, top, right, bottom, left] wall shares, line work closing every edge. */
function grid(xs: number[], ys: number[], rows: Array<Array<['B' | 'O', number, number, number, number]>>): PlanDecomposition {
  const cells = rows.flatMap((row, iy) =>
    row.map(([cls, t, r, b, l], ix) => ({
      ix,
      iy,
      rect: { x0: xs[ix], y0: ys[iy], x1: xs[ix + 1], y1: ys[iy + 1] },
      classification: cls === 'B' ? ('BUILT' as const) : ('OUTSIDE' as const),
      edges: [t, r, b, l].map((wall) => ({ wall, line: 1, opening: 0, closure: 1 })) as PlanDecomposition['cells'][number]['edges'],
      enclosed: cls === 'B',
      interiorInk: 0,
      confidence: 0.9,
      why: 'fixture',
    })),
  )
  const line = (axis: 'X' | 'Y', px: number) => ({ axis, px, probesPx: [px], support: { chainIds: [], chainSpanPx: 0, printedChainIds: [], bandLength: 0, bandCoverage: 0, bandSpans: false }, confidence: 1, why: 'fixture' })
  return {
    frameId: 'f',
    wallThickness: { px: WALL, m: 0.3 },
    envelope: null,
    linesX: xs.map((x) => line('X', x)),
    linesY: ys.map((y) => line('Y', y)),
    cells,
    regions: [],
    extent: { x0: xs[0], y0: ys[0], x1: xs[xs.length - 1], y1: ys[ys.length - 1] },
    unresolved: [],
    wideOpenings: [],
    bays: [],
    hypotheses: [],
    chosenHypothesis: null,
  } as PlanDecomposition
}
const REG = { metresPerPixelX: 0.05, metresPerPixelY: 0.05, originPx: { x: 0, y: 0 } }

/**
 * An 18 × 6 m house with, on its north side, a 6 × 6 m room walled on three sides whose fourth
 * side is a 4 m gap between two short pieces of wall: nothing drawn across it. A room behind a
 * wide glazed wall or a garage door, or a loggia — the plan alone does not say, and the pocket
 * rule takes the loggia. The house and the room are 144 m²; the house alone 108 m².
 */
function houseWithWideMouth(): ReturnType<typeof sheet> {
  const r = sheet(460, 480)
  walls(r, 40, 160, 400, 280, [{ side: 'S', from: 200, to: 247 }])
  walls(r, 120, 40, 240, 171, [{ side: 'N', from: 140, to: 220 }])
  return r
}

describe('a wide mouth: an opening in the wall, or the mouth of a pocket', () => {
  const runMouth = (publishedFootprintM2?: number) => {
    const trace: SolverTraceEvent[] = []
    const chains = [onPlan(chain('cx', 'HORIZONTAL', [40, 120, 240, 400], { baselinePx: 20 })), onPlan(chain('cy', 'VERTICAL', [40, 160, 280], { baselinePx: 20 }))]
    try {
      const result = reconstructV2({
        label: 'fixture',
        slug: 'fixture',
        sourcePackageId: 'src-test',
        sourcePackageHash: 'd'.repeat(64),
        graph: graphOf([frame]),
        metrics: metricsOf(chains, [onPlan(registration())]),
        raster: () => houseWithWideMouth(),
        publishedAreas: publishedFootprintM2 === undefined ? undefined : [{ key: 'footprint_area', label: 'footprint', unit: 'm2', value: publishedFootprintM2 }],
        trace: (e) => trace.push(e),
      })
      return { result, trace }
    } catch (error) {
      if (error instanceof ReconstructionFailure) return { failure: error, trace }
      throw error
    }
  }
  const area = (r: ReturnType<typeof reconstructV2>): number => r.building.masses.reduce((a, m) => a + (m.x1 - m.x0) * (m.z1 - m.z0), 0)

  it('the first reading takes the pocket; against a published footprint that counts the room, shutting the mouth resolves it', () => {
    const alone = runMouth()
    expect(alone.result).toBeDefined()
    expect(area(alone.result!)).toBeCloseTo(108, 0)
    const { result, trace } = runMouth(144)
    expect(result, trace.map((e) => e.detail ?? '').join('\n')).toBeDefined()
    expect(area(result!)).toBeCloseTo(144, 0)
    expect(result!.building.masses).toHaveLength(2)
    const resolution = (result!.planDiagnostics as { resolution?: Record<string, unknown> }).resolution
    expect(String(resolution?.chosenDepartures)).toContain('MOUTHS')
    expect(String(resolution?.chosen)).toContain('pocket mouths shut')
    expect(result!.layout.gate.reasons.some((g) => g.code === 'PLAN_RESOLVED_BY_HYPOTHESIS' && g.severity === 'DEGRADING')).toBe(true)
  })

  it('a published footprint of the house alone keeps the pocket: the first reading holds and nothing else is weighed', () => {
    const { result, trace } = runMouth(108)
    expect(area(result!)).toBeCloseTo(108, 0)
    expect(trace.some((e) => e.substage === 'PLAN_RESOLUTION')).toBe(false)
  })
})

describe('walled-first tiling', () => {
  it('keeps the walled house and demotes the terrace whose outer sides carry no wall', () => {
    // house (2 cells) walled all round; terrace (1 cell) walled only where it meets the house
    const d = grid([0, 100, 200, 300], [0, 100], [[['B', 1, 0, 1, 1], ['B', 1, 1, 1, 0], ['B', 0, 0, 0, 1]]])
    const { regions, demoted } = walledFirstRegions(d, REG, 0.35)
    expect(regions.map((r) => r.rect)).toEqual([{ x0: 0, y0: 0, x1: 200, y1: 100 }])
    expect(demoted).toEqual([{ ix: 2, iy: 0 }])
  })

  it('a side facing other built cells may be open: an annex joined by an open-plan side is still a body', () => {
    // main body (2×2) walled outside; annex (1 cell, bottom right) open towards the main body, walled outside
    const d = grid([0, 100, 200, 260], [0, 100, 200], [
      [['B', 1, 0, 0, 1], ['B', 1, 1, 0, 0], ['O', 0, 0, 0, 0]],
      [['B', 0, 0, 1, 1], ['B', 0, 0, 1, 0], ['B', 1, 1, 1, 0]],
    ])
    const { regions, demoted } = walledFirstRegions(d, REG, 0.35)
    expect(regions.map((r) => r.rect)).toEqual([{ x0: 0, y0: 0, x1: 200, y1: 200 }, { x0: 200, y0: 100, x1: 260, y1: 200 }])
    expect(demoted).toEqual([])
  })
})

// ---------------------------------------------------------------------------

function evidence(id: string, value: number, origin: 'READ' | 'CHAIN_CORRECTED' | 'DERIVED', tokenIds: string[] = [], alternatives: number[] = []): MetricEvidence {
  return {
    id,
    kind: 'LINEAR_DIMENSION',
    frameId: FRAME,
    assetId: 'asset-test',
    variantByteHash: 'b'.repeat(64),
    value,
    unit: 'cm',
    origin,
    rawText: String(value),
    confidence: 0.8,
    observationIds: [],
    ocrTokenIds: tokenIds,
    alternatives: alternatives.map((v) => ({ value: v, unit: 'cm', rawText: String(v), confidence: 0.2, why: 'fixture' })),
    provenance: { extractor: 'CHAIN_SOLVER', name: 'fixture', detail: 'fixture' },
  } as unknown as MetricEvidence
}

/** A sheet registered at 2.5 cm/px whose 720 px overall dimension the reader first read as "1601" (2.2236 cm/px), rewritten to "1801". */
function misreadSheet(extraRead: Array<{ px: number; cm: number }> = []): { metrics: MetricEvidenceSet; reg: CoordinateRegistration } {
  const reg: CoordinateRegistration = { ...registration(FRAME), metresPerPixelX: 0.025, metresPerPixelY: 0.025 }
  const overall = { ...onPlan(chain('overall', 'HORIZONTAL', [0, 720])), segments: [{ index: 0, fromPx: 0, toPx: 720, pixelLength: 720, valueCm: 1801, origin: 'CHAIN_CORRECTED' as const, confidence: 0.3, evidenceId: 'ev-overall' }] }
  const derivedChain = { ...onPlan(chain('inner', 'HORIZONTAL', [0, 100])), segments: [{ index: 0, fromPx: 0, toPx: 100, pixelLength: 100, valueCm: 250, origin: 'DERIVED' as const, confidence: 0.4, evidenceId: 'ev-derived' }] }
  const reads = extraRead.map((r, i) => ({ ...onPlan(chain(`read-${i}`, 'HORIZONTAL', [0, r.px])), segments: [{ index: 0, fromPx: 0, toPx: r.px, pixelLength: r.px, valueCm: r.cm, origin: 'READ' as const, confidence: 0.9, evidenceId: `ev-read-${i}` }] }))
  const metrics: MetricEvidenceSet = {
    ...metricsOf([overall, derivedChain, ...reads], [reg]),
    ocrTokens: [{ id: 'tok-overall', frameId: FRAME, assetId: 'asset-test', variantByteHash: 'b'.repeat(64), text: '1601', score: 0.8, confidence: 0.7, box: { x0: 0, y0: 0, x1: 10, y1: 10 }, heightPx: 10 } as unknown as MetricEvidenceSet['ocrTokens'][number]],
    evidence: [evidence('ev-overall', 1801, 'CHAIN_CORRECTED', ['tok-overall'], [1601, 1001]), evidence('ev-derived', 250, 'DERIVED'), ...extraRead.map((r, i) => evidence(`ev-read-${i}`, r.cm, 'READ'))],
  }
  return { metrics, reg }
}

describe('scale readings', () => {
  const EXTENT = { x0: 0, y0: 0, x1: 720, y1: 340 }

  it("a registration nothing printed supports is doubted: the reader's own first reading of the overall dimension implies another scale", () => {
    const { metrics, reg } = misreadSheet()
    const lattices = latticeScales(metrics, FRAME, reg, EXTENT, 8)
    expect(lattices.map((l) => l.cmPerPx)).toEqual([2.223611])
    expect(lattices[0].anchors.map((a) => a.evidenceId)).toEqual(['ev-overall'])
  })

  it('one misread span against longer read ones is a misreading, not a scale: no other scale is proposed', () => {
    const { metrics, reg } = misreadSheet([{ px: 400, cm: 1000 }, { px: 360, cm: 900 }])
    expect(latticeScales(metrics, FRAME, reg, EXTENT, 8)).toEqual([])
  })

  it('at the new scale a statement is kept, re-read from its first reading, or refuted; derived spans are derived again', () => {
    const { metrics } = misreadSheet([{ px: 400, cm: 1000 }])
    const at = metricsAtScale(metrics, FRAME, 2.223611, 8)
    const value = (id: string): number | undefined => at.view.evidence.find((e) => e.id === id)?.value
    expect(value('ev-overall')).toBe(1601)
    expect([...at.reread]).toEqual(['ev-overall'])
    // "1000" over 400 px is 2.5 cm/px, which no reading of it reconciles with 2.22: refuted, and dropped as a statement
    expect(value('ev-read-0')).toBe(0)
    expect([...at.refuted]).toEqual(['ev-read-0'])
    expect(value('ev-derived')).toBe(222.3611)
    expect(at.view.coordinateRegistrations[0].metresPerPixelX).toBe(0.022236)
    // the view keeps the identity of the evidence it re-reads
    expect(at.view.contentHash).toBe(metrics.contentHash)
    expect(at.refutedShare).toBeCloseTo(400 / 1120, 6)
  })
})

// ---------------------------------------------------------------------------

const score = (over: Partial<HypothesisScore> = {}): HypothesisScore => ({
  hard: [],
  gateRefusals: [],
  footprint: { areaM2: 100, publishedM2: 100, residual: 0, bucket: 'AGREES' },
  refutedShare: 0,
  wallCoverage: 1,
  corroborations: [],
  outlineKey: 'a',
  masses: 1,
  bodies: [{ x0: 0, z0: 0, x1: 10, z1: 10 }],
  wallM: 0.3,
  ...over,
})
const reading = (id: string, s: HypothesisScore, departures: string[] = ['MERGE'], stage: 1 | 2 = 2): RankedReading => ({
  hypothesis: { id, frameId: 'f', annotation: 'DIMENSIONED', extent: 'CHAIN_RECT', scale: { kind: 'REGISTRATION' }, merge: 'WALLED_FIRST', faces: 'AS_GRIDDED', mouths: 'AS_DECIDED', departures },
  score: s,
  stage,
})

describe('ranking and acceptance', () => {
  it('ranks on buckets: a hard violation, then a gate refusal, then the footprint bucket — never the residual inside a bucket', () => {
    const agrees = reading('a', score({ footprint: { areaM2: 104, publishedM2: 100, residual: 0.04, bucket: 'AGREES' } }))
    const closer = reading('b', score({ footprint: { areaM2: 100.5, publishedM2: 100, residual: 0.005, bucket: 'AGREES' } }), ['MERGE', 'FACES'])
    const near = reading('c', score({ footprint: { areaM2: 110, publishedM2: 100, residual: 0.1, bucket: 'NEAR' } }))
    const hard = reading('d', score({ hard: ['MASS_OVERLAP'] }))
    const sorted = [hard, near, closer, agrees].sort(compareReadings).map((r) => r.hypothesis.id)
    // the closer residual does not win: fewer departures does
    expect(sorted).toEqual(['a', 'b', 'c', 'd'])
  })

  it('accepts AGREES; NEAR only with a corroboration; no published figure only with two; never WRONG, never a stage-1 reading', () => {
    expect(acceptable(reading('a', score()))).toBe(true)
    expect(acceptable(reading('a', score(), ['MERGE'], 1))).toBe(false)
    expect(acceptable(reading('n', score({ footprint: { areaM2: 110, publishedM2: 100, residual: 0.1, bucket: 'NEAR' } })))).toBe(false)
    expect(acceptable(reading('n', score({ footprint: { areaM2: 110, publishedM2: 100, residual: 0.1, bucket: 'NEAR' }, corroborations: ['WALL_COVERAGE'] })))).toBe(true)
    expect(acceptable(reading('u', score({ footprint: { areaM2: 110, bucket: 'UNKNOWN' }, corroborations: ['WALL_COVERAGE'] })))).toBe(false)
    expect(acceptable(reading('u', score({ footprint: { areaM2: 110, bucket: 'UNKNOWN' }, corroborations: ['WALL_COVERAGE', 'ISOTROPY'] })))).toBe(true)
    expect(acceptable(reading('w', score({ footprint: { areaM2: 150, publishedM2: 100, residual: 0.5, bucket: 'WRONG' }, corroborations: ['WALL_COVERAGE', 'ISOTROPY', 'CROSS_COPY'] })))).toBe(false)
    expect(acceptable(reading('g', score({ gateRefusals: ['MASS_OVERLAP'] })))).toBe(false)
  })

  it('a body read on its wall axes and on its outer faces is one building; a body a metre larger is another', () => {
    const axes = score()
    const faces = score({ bodies: [{ x0: 0, z0: 0, x1: 10.3, z1: 10.3 }] })
    const larger = score({ bodies: [{ x0: 0, z0: 0, x1: 11, z1: 10 }] })
    expect(sameBuilding(axes, faces)).toBe(true)
    expect(sameBuilding(axes, larger)).toBe(false)
    expect(sameBuilding(axes, score({ bodies: [...axes.bodies, { x0: 10, z0: 0, x1: 12, z1: 3 }] }))).toBe(false)
  })
})
