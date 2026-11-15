/**
 * Plan resolver 1.7.0 (v3.54): a reading the walls witness, at the overall size ANOTHER copy of the same storey's plan
 * prints, is corroborated by that print (`PRINTED_OVERALL`).
 *
 * The failure it answers was measured on real sheets: the first reading of a plan stops, the published footprint that
 * refused it is spent, and the reading of the building at exactly its printed overall size stays unbuilt because the
 * other copy of the plan reads its walls badly, so `CROSS_COPY` cannot confirm it. Synthetic plans at 5 cm/px
 * (`plan.ts`); nothing here names a real project or carries its figures.
 */
import { describe, expect, it } from 'vitest'
import type { MetricEvidence, MetricEvidenceSet } from '@buildapp/source-metrics'
import { ReconstructionFailure, isPrintedLength, printedOverallOf, reconstructV2 } from '../src/index.js'
import type { SolverTraceEvent } from '../src/index.js'
import { chain, graphOf, metricsOf, planFrame, registration, sheet, walls } from './plan.js'
import { BLACK, drawLine } from '../../source-cv/test/draw.js'

const FRAME = 'frame-plan'
const COPY = 'frame-plan-copy'
const frame = planFrame(FRAME, 'GROUND', { width: 460, height: 480 })
// the same storey's other copy: the area-table print of the same sheet, ranked after the dimensioned one
const copy = { ...planFrame(COPY, 'GROUND', { width: 460, height: 480 }), roles: { ...planFrame(COPY, 'GROUND', { width: 460, height: 480 }).roles, annotation: 'AREA_TABLE' as const } }

/** An 18 × 6 m house, a 4 × 6 m walled room on its north side and a 6 × 6 m terrace closed by kerb lines (132 m² closed). */
function houseWithTerrace(): ReturnType<typeof sheet> {
  const r = sheet(460, 480)
  walls(r, 40, 160, 400, 280, [{ side: 'S', from: 200, to: 247 }])
  walls(r, 120, 40, 200, 171)
  drawLine(r, 200, 42, 320, 42, BLACK)
  drawLine(r, 320, 42, 320, 160, BLACK)
  return r
}

/** The other copy's walls read badly: only the small room comes through, so its own decomposition cannot confirm anything. */
function badCopy(): ReturnType<typeof sheet> {
  const r = sheet(460, 480)
  walls(r, 120, 40, 200, 171)
  return r
}

/** A printed length on the copy, as its recognition read it. */
function printedOn(frameId: string, chainId: string, cm: number, origin: MetricEvidence['origin'] = 'READ'): MetricEvidence {
  return { id: `ev-${chainId}-${cm}-${origin}`, kind: 'LINEAR_DIMENSION', value: cm, unit: 'cm', origin, rawText: String(cm), confidence: 0.5, frameId, assetId: `asset-${frameId}`, chainId, tokenIds: [], alternatives: [] } as never
}

/** The dimensioned copy's scale was measured on both axes from independent readings (ISOTROPY). */
const solution = { frameId: FRAME, assetId: `asset-${FRAME}`, cmPerPixelX: 5, cmPerPixelY: 5, anisotropy: 1, isotropy: 'MEASURED', relation: 'CONFIRMED', confidence: 'STRONG', independentWitnesses: 3, hypotheses: [], conflictingObservationIds: [], supportingObservationIds: [], rereadChainIds: [], orientationDecisions: [], counts: {}, legacy: {}, topology: {}, why: 'fixture' } as never

function run(printed: MetricEvidence[]): { result?: ReturnType<typeof reconstructV2>; failure?: ReconstructionFailure; trace: SolverTraceEvent[] } {
  const trace: SolverTraceEvent[] = []
  const chains = [
    { ...chain('cx', 'HORIZONTAL', [40, 120, 200, 320, 400], { baselinePx: 20 }), frameId: FRAME },
    { ...chain('cy', 'VERTICAL', [40, 160, 280], { baselinePx: 20 }), frameId: FRAME },
    // the copy's own overall lines, where its labels are read; their ticks are not this test's subject
    { ...chain('kx', 'HORIZONTAL', [40, 400], { baselinePx: 20 }), frameId: COPY },
    { ...chain('ky', 'VERTICAL', [40, 280], { baselinePx: 20 }), frameId: COPY },
  ]
  const metrics: MetricEvidenceSet = { ...metricsOf(chains, [registration(FRAME), registration(COPY)]), evidence: printed, metricSolutions: [solution] } as never
  try {
    const result = reconstructV2({
      label: 'fixture',
      slug: 'fixture',
      sourcePackageId: 'src-test',
      sourcePackageHash: 'd'.repeat(64),
      graph: graphOf([frame, copy]),
      metrics,
      raster: (f) => (f.id === COPY ? badCopy() : houseWithTerrace()),
      publishedAreas: [{ key: 'footprint_area', label: 'footprint', unit: 'm2', value: 132 }],
      trace: (e) => trace.push(e),
    })
    return { result, trace }
  } catch (error) {
    if (error instanceof ReconstructionFailure) return { failure: error, trace }
    throw error
  }
}

const groundArea = (r: ReturnType<typeof reconstructV2>): number => {
  const ground = r.building.levels[0]
  return r.building.masses.filter((m) => m.levelId === undefined || m.levelId === ground?.id).reduce((a, m) => a + (m.x1 - m.x0) * (m.z1 - m.z0), 0)
}

describe('a reading at the overall size the other copy prints (plan resolver 1.7.0)', () => {
  it('the longest dimension each copy prints on each axis, read as printed — never a corrected or derived value, never another frame', () => {
    const evidence = [printedOn(COPY, 'kx', 1800), printedOn(COPY, 'kx', 640), printedOn(COPY, 'ky', 1200), printedOn(COPY, 'kx', 2400, 'CHAIN_CORRECTED'), printedOn(FRAME, 'cx', 2000)]
    const metrics = { ...metricsOf([{ ...chain('kx', 'HORIZONTAL', [0, 1]), frameId: COPY }, { ...chain('ky', 'VERTICAL', [0, 1]), frameId: COPY }, { ...chain('cx', 'HORIZONTAL', [0, 1]), frameId: FRAME }], []), evidence } as never
    expect(printedOverallOf(metrics, new Set([COPY]))).toEqual(new Map([[COPY, { X: 1800, Y: 1200 }]]))
    expect(isPrintedLength(18.04, 1800)).toBe(true)
    expect(isPrintedLength(18.3, 1800)).toBe(false)
    expect(isPrintedLength(18, undefined)).toBe(false)
  })

  it('CAUSE: the first reading takes the terrace; the spent figure cannot choose; the house at the size the other copy prints is built', () => {
    const { result, failure } = run([printedOn(COPY, 'kx', 1800), printedOn(COPY, 'ky', 1200)])
    expect(failure?.message).toBeUndefined()
    expect(result).toBeDefined()
    if (!result) return
    expect(groundArea(result)).toBeCloseTo(132, 0)
  })

  it('COUNTER: the other copy prints another size — nothing confirms the house, and it is named, not built', () => {
    const { result, failure } = run([printedOn(COPY, 'kx', 1500), printedOn(COPY, 'ky', 1200)])
    expect(result).toBeUndefined()
    expect(failure).toBeDefined()
  })

  it('COUNTER: one axis printed is not the size of the building', () => {
    const { result } = run([printedOn(COPY, 'kx', 1800)])
    expect(result).toBeUndefined()
  })

  it('COUNTER: a value the chain corrected is not a print', () => {
    const { result } = run([printedOn(COPY, 'kx', 1800, 'CHAIN_CORRECTED'), printedOn(COPY, 'ky', 1200, 'CHAIN_CORRECTED')])
    expect(result).toBeUndefined()
  })
})
