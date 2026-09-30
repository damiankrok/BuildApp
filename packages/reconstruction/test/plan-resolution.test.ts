/**
 * The plan resolver (BUILDPLAN-ANALYZER-005A): when the first reading of a
 * plan stops, other readings of the SAME drawing are weighed — and only then.
 *
 * Synthetic plans at 5 cm/px (`plan.ts`), drawn to the shape of the failures
 * seen on real sheets: a covered terrace closed by line work against the
 * house, a chain that measures one room, a scale the chain solver rewrote
 * towards a misread long span. Nothing here names a real project or carries
 * its figures: the misread sheets use their own lengths and digits.
 */
import { describe, expect, it } from 'vitest'
import type { CoordinateRegistration, MetricEvidence, MetricEvidenceSet } from '@buildapp/source-metrics'
import { round6 } from '@buildapp/source-common'
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

function run(options: { publishedFootprintM2?: number; raster?: ReturnType<typeof sheet>; chains?: { cx: number[]; cy: number[] }; resolverProgress?: Parameters<typeof reconstructV2>[0]['resolverProgress'] }): { result?: ReturnType<typeof reconstructV2>; failure?: ReconstructionFailure; trace: SolverTraceEvent[] } {
  const trace: SolverTraceEvent[] = []
  const c = options.chains ?? { cx: [40, 120, 200, 320, 400], cy: [40, 160, 280] }
  const chains = [onPlan(chain('cx', 'HORIZONTAL', c.cx, { baselinePx: 20 })), onPlan(chain('cy', 'VERTICAL', c.cy, { baselinePx: 20 }))]
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
      ...(options.resolverProgress ? { resolverProgress: options.resolverProgress } : {}),
    })
    return { result, trace }
  } catch (error) {
    if (error instanceof ReconstructionFailure) return { failure: error, trace }
    throw error
  }
}

describe('a terrace line-closed against the house', () => {
  it('the first reading takes house and terrace as one body; a published house-only footprint refuses it, and having refused it does not also choose the replacement: the house alone is named, not built', () => {
    // 1.2.0. The drawing supports both buildings, and only the figure tells them apart: it
    // may veto a reading, but a figure that vetoes and then selects is a figure that builds
    // whatever it says (a decoy ×1.25 built a 198 m² house on a 164 m² development sheet).
    const { failure, trace } = run({ publishedFootprintM2: 132 })
    expect(failure?.code).toBe('PLAN_RESOLUTION_INCONCLUSIVE')
    const resolution = trace.find((e) => e.substage === 'PLAN_RESOLUTION')
    expect(resolution?.counts).toMatchObject({ outcome: 'INCONCLUSIVE', firstReading: 'PLAN_LAYOUT_REJECTED', publishedFigure: 'SPENT' })
    // the house alone was weighed and composed, and is named with what it lacks
    expect(failure?.message).toContain('walled-first tiling')
    expect(failure?.message).toContain('that figure already refused the first reading')
    expect(String(failure?.diagnostics.reading1)).toContain('UNKNOWN (the figure is spent)')
  })

  it('CONTROL: when the first reading holds, the resolver never runs', () => {
    const { result, trace } = run({ publishedFootprintM2: 168 })
    expect(result).toBeDefined()
    expect(trace.some((e) => e.substage === 'PLAN_RESOLUTION')).toBe(false)
    expect(result!.layout.gate.reasons.map((r) => r.code)).not.toContain('PLAN_RESOLVED_BY_HYPOTHESIS')
    expect(result!.candidate.solver.version).not.toContain('resolver')
    expect(result!.planDiagnostics.resolution).toBeUndefined()
  })

  it('a cancel while the readings are weighed or composed ends the run there: the abort comes out, and no model', () => {
    // The service turns each of these notifications into a checkpoint tick, and a tick is where a cancel lands.
    for (const at of [{ stage: 1, index: 2 }, { stage: 2, index: 1 }]) {
      const seen: string[] = []
      const cancelled = new DOMException('the analysis was cancelled', 'AbortError')
      let thrown: unknown
      try {
        run({
          publishedFootprintM2: 132,
          resolverProgress: (e) => {
            seen.push(`${e.stage}:${e.index}`)
            if (e.stage === at.stage && e.index === at.index) throw cancelled
          },
        })
      } catch (error) {
        thrown = error
      }
      expect(thrown).toBe(cancelled)
      expect(seen.at(-1)).toBe(`${at.stage}:${at.index}`)
    }
  })

  it('a published figure no reading of the drawing reaches is not chased: the first link is named, and the readings weighed are counted', () => {
    const { failure, trace } = run({ publishedFootprintM2: 40 })
    expect(failure?.code).toBe('PLAN_LAYOUT_REJECTED')
    expect(Number(failure?.diagnostics.readingsWeighed)).toBeGreaterThan(0)
    expect(trace.at(-1)).toMatchObject({ substage: 'PLAN_RESOLUTION', status: 'FAILED', reasonCode: 'PLAN_LAYOUT_REJECTED' })
    expect(failure?.plans?.resolution?.outcome).toBe('INCONCLUSIVE')
  })
})

/**
 * The same house and room, with no terrace, where the only chain read on one axis measures the
 * room alone — the pattern that refused a development house on the phone, drawn fresh. The first
 * reading's extent is a strip with no walled envelope in it: it stops on the drawing, not on the
 * figure, so the figure is still free to choose among the other readings.
 */
function houseWithRoom(): ReturnType<typeof sheet> {
  const r = sheet(460, 480)
  walls(r, 40, 160, 400, 280, [{ side: 'S', from: 200, to: 247 }])
  walls(r, 120, 40, 200, 171)
  return r
}
const ROOM_CHAIN = { cx: [120, 200], cy: [40, 160, 280] }

describe('a chain that measures one room', () => {
  it('the first reading stops on the drawing; the wall-ink extent reads the house, and a published footprint it meets chooses it', () => {
    const { result, trace } = run({ publishedFootprintM2: 132, raster: houseWithRoom(), chains: ROOM_CHAIN })
    expect(result, trace.map((e) => e.detail ?? '').join('\n')).toBeDefined()
    const record = result!.planDiagnostics.resolution
    expect(record).toMatchObject({ outcome: 'RESOLVED', firstReading: 'PLAN_NO_WALLED_ENVELOPE', publishedFigure: 'SCORED', chosenBucket: 'AGREES', chosenMasses: 2, chosenCorroborations: '' })
    expect(String(record?.chosenDepartures)).toContain('EXTENT')
    expect(Number(record?.chosenAreaM2)).toBeGreaterThan(132 * 0.94)
    expect(Math.abs(Number(record?.chosenResidualPct))).toBeLessThanOrEqual(6)
    expect(result!.layout.gate.status).toBe('STRUCTURAL_LAYOUT_PARTIAL')
    expect(result!.layout.gate.reasons.map((r) => r.code)).toContain('PLAN_RESOLVED_BY_HYPOTHESIS')
    expect(result!.layout.alternatives.some((a) => a.what.includes('reading of the base plan'))).toBe(true)
    // the resolver's rules are part of what made this candidate
    expect(result!.candidate.solver.version).toMatch(/^\d+\.\d+\.\d+\+resolver\.\d+\.\d+\.\d+$/)
  })

  it('is deterministic: the same inputs resolve to the same model, byte for byte', () => {
    const a = run({ publishedFootprintM2: 132, raster: houseWithRoom(), chains: ROOM_CHAIN }).result
    const b = run({ publishedFootprintM2: 132, raster: houseWithRoom(), chains: ROOM_CHAIN }).result
    expect(a?.candidate.modelHash).toBeDefined()
    expect(a?.candidate.modelHash).toBe(b?.candidate.modelHash)
    expect(a?.layout.contentHash).toBe(b?.layout.contentHash)
  })

  it('with nothing published, the wall coverage the reading has is no witness: it is named, not built', () => {
    const { failure, trace } = run({ raster: houseWithRoom(), chains: ROOM_CHAIN })
    expect(failure?.code).toBe('PLAN_RESOLUTION_INCONCLUSIVE')
    expect(trace.find((e) => e.substage === 'PLAN_RESOLUTION')?.counts).toMatchObject({ publishedFigure: 'NONE' })
    expect(failure?.message).toContain('has no published footprint to check against and too little else to confirm it')
  })

  it('a figure no reading meets is not chased: the first link is named', () => {
    const { failure } = run({ publishedFootprintM2: 168, raster: houseWithRoom(), chains: ROOM_CHAIN })
    expect(failure?.code).toBe('PLAN_NO_WALLED_ENVELOPE')
    expect(failure?.plans?.resolution?.outcome).toBe('INCONCLUSIVE')
  })
})

describe('an unlabelled plan beside a labelled ground plan (post-Council A)', () => {
  // A larger copy with no storey claim — an upper floor at a fragment index the adapter could not place —
  // draws one room. Read as the ground floor, it would be the largest copy and the building would be that room.
  const OTHER = 'frame-unlabelled'
  const unlabelled = { ...planFrame(OTHER, 'GROUND', { width: 600, height: 600 }), roles: { ...planFrame(OTHER, 'GROUND', { width: 600, height: 600 }).roles, storey: 'UNKNOWN' as const } }
  const oneRoom = (): ReturnType<typeof sheet> => {
    const r = sheet(600, 600)
    walls(r, 100, 100, 300, 300, [{ side: 'S', from: 180, to: 227 }])
    return r
  }
  const runWith = (frames: typeof frame[]) =>
    reconstructV2({
      label: 'fixture',
      slug: 'fixture',
      sourcePackageId: 'src-test',
      sourcePackageHash: 'd'.repeat(64),
      graph: graphOf(frames),
      metrics: metricsOf(
        [
          onPlan(chain('cx', 'HORIZONTAL', [40, 120, 200, 320, 400], { baselinePx: 20 })),
          onPlan(chain('cy', 'VERTICAL', [40, 160, 280], { baselinePx: 20 })),
          chain('ox', 'HORIZONTAL', [100, 300], { baselinePx: 20, frameId: OTHER }),
          chain('oy', 'VERTICAL', [100, 300], { baselinePx: 20, frameId: OTHER }),
        ],
        frames.map((f) => registration(f.id)),
      ),
      raster: (f) => (f.id === OTHER ? oneRoom() : houseWithRoom()),
    })

  it('is not read as the ground floor: the labelled plan gives the building, and the unplaced plan is a named hole', () => {
    const result = runWith([frame, unlabelled])
    expect(result.building.masses).toHaveLength(2)
    expect(result.planDiagnostics.selectedPlanFrameId).toBe(FRAME)
    expect(result.unresolved.some((u) => u.what === 'which storey an unlabelled floor plan draws')).toBe(true)
  })

  it('alone, an unlabelled plan is still the ground floor', () => {
    const result = runWith([unlabelled])
    expect(result.building.masses).toHaveLength(1)
    expect(result.planDiagnostics.selectedPlanFrameId).toBe(OTHER)
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

  it('the first reading takes the pocket; against a published footprint that counts the room, the shut mouth is generated and weighed — and named, not built, because the figure that refused the pocket cannot also choose', () => {
    const alone = runMouth()
    expect(alone.result).toBeDefined()
    expect(area(alone.result!)).toBeCloseTo(108, 0)
    const { failure, trace } = runMouth(144)
    expect(failure?.code).toBe('PLAN_RESOLUTION_INCONCLUSIVE')
    expect(trace.find((e) => e.substage === 'PLAN_RESOLUTION')?.counts).toMatchObject({ publishedFigure: 'SPENT' })
    // the reading with the mouth shut exists, is composed, and meets the figure — which is not enough
    expect(failure?.message).toContain('pocket mouths shut: 2 bodies, 144.0 m²')
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
/**
 * A sheet registered on a misread long span: the reader took one digit wrong, the sheet was
 * registered on the misreading, and the chain solver then "corrected" the span TOWARD that
 * registration. Two of them — different axis, length and digit — so neither sheet's numbers
 * are the rule.
 */
type Misread = { axis: 'HORIZONTAL' | 'VERTICAL'; spanPx: number; firstReadCm: number; correctedCm: number; alternatives: number[]; extent: { x0: number; y0: number; x1: number; y1: number } }
const WIDTH_MISREAD: Misread = { axis: 'HORIZONTAL', spanPx: 560, firstReadCm: 1372, correctedCm: 1872, alternatives: [1372, 1872], extent: { x0: 0, y0: 0, x1: 560, y1: 300 } }
const DEPTH_MISREAD: Misread = { axis: 'VERTICAL', spanPx: 480, firstReadCm: 1296, correctedCm: 1796, alternatives: [1296, 1796], extent: { x0: 0, y0: 0, x1: 400, y1: 480 } }

function misreadSheet(m: Misread, extraRead: Array<{ px: number; cm: number }> = []): { metrics: MetricEvidenceSet; reg: CoordinateRegistration } {
  const mpp = round6(m.correctedCm / m.spanPx / 100)
  const reg: CoordinateRegistration = { ...registration(FRAME), metresPerPixelX: mpp, metresPerPixelY: mpp }
  const overall = { ...onPlan(chain('overall', m.axis, [0, m.spanPx])), segments: [{ index: 0, fromPx: 0, toPx: m.spanPx, pixelLength: m.spanPx, valueCm: m.correctedCm, origin: 'CHAIN_CORRECTED' as const, confidence: 0.3, evidenceId: 'ev-overall' }] }
  const derivedChain = { ...onPlan(chain('inner', 'HORIZONTAL', [0, 100])), segments: [{ index: 0, fromPx: 0, toPx: 100, pixelLength: 100, valueCm: round6(100 * mpp * 100), origin: 'DERIVED' as const, confidence: 0.4, evidenceId: 'ev-derived' }] }
  const reads = extraRead.map((r, i) => ({ ...onPlan(chain(`read-${i}`, m.axis, [0, r.px])), segments: [{ index: 0, fromPx: 0, toPx: r.px, pixelLength: r.px, valueCm: r.cm, origin: 'READ' as const, confidence: 0.9, evidenceId: `ev-read-${i}` }] }))
  const metrics: MetricEvidenceSet = {
    ...metricsOf([overall, derivedChain, ...reads], [reg]),
    ocrTokens: [{ id: 'tok-overall', frameId: FRAME, assetId: 'asset-test', variantByteHash: 'b'.repeat(64), text: String(m.firstReadCm), score: 0.8, confidence: 0.7, box: { x0: 0, y0: 0, x1: 10, y1: 10 }, heightPx: 10 } as unknown as MetricEvidenceSet['ocrTokens'][number]],
    evidence: [evidence('ev-overall', m.correctedCm, 'CHAIN_CORRECTED', ['tok-overall'], m.alternatives), evidence('ev-derived', round6(100 * mpp * 100), 'DERIVED'), ...extraRead.map((r, i) => evidence(`ev-read-${i}`, r.cm, 'READ'))],
  }
  return { metrics, reg }
}

describe('scale readings', () => {
  it("a registration nothing printed supports is doubted: the reader's own first reading of the long span implies another scale, on either axis", () => {
    for (const m of [WIDTH_MISREAD, DEPTH_MISREAD]) {
      const { metrics, reg } = misreadSheet(m)
      const lattices = latticeScales(metrics, FRAME, reg, m.extent, 8)
      expect(lattices.map((l) => l.cmPerPx)).toEqual([round6(m.firstReadCm / m.spanPx)])
      expect(lattices[0].anchors.map((a) => [a.evidenceId, a.axis])).toEqual([['ev-overall', m.axis === 'HORIZONTAL' ? 'X' : 'Y']])
    }
  })

  it('one misread span against longer read ones is a misreading, not a scale: no other scale is proposed', () => {
    // two read spans that agree with the registration outweigh the one first reading that does not
    const { metrics, reg } = misreadSheet(WIDTH_MISREAD, [{ px: 400, cm: 1337 }, { px: 360, cm: 1203 }])
    expect(latticeScales(metrics, FRAME, reg, WIDTH_MISREAD.extent, 8)).toEqual([])
  })

  it('at the new scale a statement is kept, re-read from its first reading, or refuted; derived spans are derived again', () => {
    const { metrics } = misreadSheet(WIDTH_MISREAD, [{ px: 400, cm: 1337 }])
    const scale = round6(1372 / 560)
    const at = metricsAtScale(metrics, FRAME, scale, 8)
    const value = (id: string): number | undefined => at.view.evidence.find((e) => e.id === id)?.value
    expect(value('ev-overall')).toBe(1372)
    expect([...at.reread]).toEqual(['ev-overall'])
    // "1337" over 400 px is the old scale, which no reading of it reconciles with the new one: refuted, and dropped as a statement
    expect(value('ev-read-0')).toBe(0)
    expect([...at.refuted]).toEqual(['ev-read-0'])
    expect(value('ev-derived')).toBe(round6(100 * scale))
    expect(at.view.coordinateRegistrations[0].metresPerPixelX).toBe(round6(scale / 100))
    // the view keeps the identity of the evidence it re-reads
    expect(at.view.contentHash).toBe(metrics.contentHash)
    expect(at.refutedShare).toBeCloseTo(400 / 960, 6)
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
    expect(acceptable(reading('n', score({ footprint: { areaM2: 110, publishedM2: 100, residual: 0.1, bucket: 'NEAR' }, corroborations: ['CROSS_COPY'] })))).toBe(true)
    expect(acceptable(reading('u', score({ footprint: { areaM2: 110, bucket: 'UNKNOWN' }, corroborations: ['CROSS_COPY'] })))).toBe(false)
    expect(acceptable(reading('u', score({ footprint: { areaM2: 110, bucket: 'UNKNOWN' }, corroborations: ['CROSS_COPY', 'ISOTROPY'] })))).toBe(true)
    // a high wall coverage alone accepts nothing: it ranks, it does not witness
    expect(acceptable(reading('c', score({ footprint: { areaM2: 110, bucket: 'UNKNOWN' }, wallCoverage: 1 })))).toBe(false)
    expect(acceptable(reading('w', score({ footprint: { areaM2: 150, publishedM2: 100, residual: 0.5, bucket: 'WRONG' }, corroborations: ['ISOTROPY', 'CROSS_COPY'] })))).toBe(false)
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
