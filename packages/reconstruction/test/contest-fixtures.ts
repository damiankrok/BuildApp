/**
 * Hand-made metric evidence with confident readers of the same ink (BUILDPLAN-ANALYZER-005P): the fixture builder of the
 * statement-contest suite, and its seeded plan generator, shared with the research script that freezes the 1.4.0
 * oracle (`research/analyzer-005p/conflict-oracle.ts`). No drawing, no real house.
 *
 * The ensemble records are built the way `ensembleOf` (source-metrics) builds them: the lattice keeps its own class, and
 * the record's own class is the decision's — CLEAR for AGREES, SUPPORTED for LEADS (whose reading is the external one),
 * AMBIGUOUS for CONTESTS and CONTESTS_COUNT, the lattice's own otherwise.
 */
import type { DimensionChain, FrameMetricSolution, MetricEvidence, MetricEvidenceSet, NumericLatticeRecord, OcrToken } from '@buildapp/source-metrics'
import { metricsOf, registration } from './plan.js'

export const FRAME = 'frame-plan'
export const JUDGE = { x0: 0, y0: 0, x1: 460, y1: 480 }
export const REG = registration(FRAME) // 5 cm/px

export type Decision = 'AGREES' | 'LEADS' | 'CONTESTS' | 'CONTESTS_COUNT' | 'NOT_CORROBORATING' | 'NO_VALUE' | 'NOT_COMPARABLE'
export type Ensemble = { decision: Decision; external: number; rival?: 'EXTERNAL' | 'LATTICE' }
export type Reading = {
  chain: string
  axis: 'X' | 'Y'
  px: number
  /** the statement's value (READ) or its corrected value (CHAIN_CORRECTED) */
  cm: number
  origin?: 'READ' | 'CHAIN_CORRECTED'
  /** the classic token's text (default: the value) */
  token?: string
  lattice?: { cm: number; cls?: 'CLEAR' | 'SUPPORTED' | 'AMBIGUOUS' | 'LOW_QUALITY' }
  ensemble?: Ensemble
  dependsOnScale?: boolean
  frameOfLattice?: string
  orientationOfLattice?: 'ROTATED_CW' | 'ROTATED_CCW'
  orientation?: 'ROTATED_CW' | 'ROTATED_CCW'
  /** the segment's start on its chain (default 10 px) */
  fromPx?: number
  /** the evidence id this segment carries (default ev-<index>): two segments may carry one statement */
  evidenceOf?: number
  /** a second lattice record for the same ink (a duplicated crop), sealed after the first */
  duplicateLattice?: { cm: number; cls?: 'CLEAR' | 'SUPPORTED' | 'AMBIGUOUS' }
}

const decisionClass = (d: Decision, own: string): string => (d === 'AGREES' ? 'CLEAR' : d === 'LEADS' ? 'SUPPORTED' : d === 'CONTESTS' || d === 'CONTESTS_COUNT' ? 'AMBIGUOUS' : own)

function latticeRecord(i: number, s: Reading, box: { x0: number; y0: number; x1: number; y1: number }, cm: number, cls: string, withEnsemble: boolean, suffix = ''): NumericLatticeRecord {
  const e = withEnsemble && s.ensemble ? s.ensemble : undefined
  return {
    id: `lat-${i}${suffix}`,
    frameId: s.frameOfLattice ?? FRAME,
    ...(s.orientationOfLattice ?? s.orientation ? { orientation: s.orientationOfLattice ?? s.orientation } : {}),
    box,
    asRead: String(cm),
    asReadValueCm: cm,
    ocrClass: cls,
    ...(e
      ? {
          ensemble: {
            decision: e.decision,
            external: { text: String(e.external), valueCm: e.external, posterior: 0.999, meanP: 0.999, stable: true, confident: true },
            lattice: { asRead: String(cm), valueCm: cm, ocrClass: cls },
            asRead: e.decision === 'LEADS' ? String(e.external) : String(cm),
            asReadValueCm: e.decision === 'LEADS' ? e.external : cm,
            ocrClass: decisionClass(e.decision, cls),
            ...(e.rival ? { rival: { text: String(e.rival === 'EXTERNAL' ? e.external : cm), valueCm: e.rival === 'EXTERNAL' ? e.external : cm, witness: e.rival } } : {}),
            why: 'a fixture',
          },
        }
      : {}),
  } as unknown as NumericLatticeRecord
}

export function metricsWith(readings: readonly Reading[], options: { stripExternal?: boolean; solution?: FrameMetricSolution } = {}): MetricEvidenceSet {
  const evidence: MetricEvidence[] = []
  const tokens: OcrToken[] = []
  const lattices: NumericLatticeRecord[] = []
  const chains: DimensionChain[] = readings.map((s, i) => {
    const owner = s.evidenceOf ?? i
    const id = `ev-${owner}`
    const tokenId = `tok-${owner}`
    const origin = s.origin ?? 'READ'
    const text = s.token ?? String(s.cm)
    const box = { x0: 20 * owner, y0: 0, x1: 20 * owner + 18, y1: 10 }
    if (owner === i) {
      tokens.push({ id: tokenId, frameId: FRAME, assetId: 'asset-test', text, box, confidence: 0.6, score: 0.5, shearDeg: 0, heightPx: 14, ...(s.orientation ? { orientation: s.orientation } : {}) } as OcrToken)
      evidence.push({
        id,
        kind: 'LINEAR_DIMENSION',
        frameId: FRAME,
        assetId: 'asset-test',
        variantByteHash: 'b'.repeat(64),
        value: s.cm,
        unit: 'cm',
        origin,
        rawText: text,
        pixelLength: s.px,
        association: { kind: 'DIMENSION_LINE', score: 0.9, why: 'a fixture', observationIds: [] },
        chainId: s.chain,
        ocrTokenIds: [tokenId],
        observationIds: [],
        alternatives: [],
        confidence: 0.9,
        ...(s.dependsOnScale ? { derivation: { dependsOnScale: true } } : {}),
        provenance: { extractor: 'NUMERIC_OCR', name: 'fixture', detail: 'a fixture' },
      } as unknown as MetricEvidence)
      if (s.lattice) {
        lattices.push(latticeRecord(i, s, box, s.lattice.cm, s.lattice.cls ?? 'CLEAR', !options.stripExternal))
        if (s.duplicateLattice) lattices.push(latticeRecord(i, { ...s, ensemble: undefined }, box, s.duplicateLattice.cm, s.duplicateLattice.cls ?? 'CLEAR', false, '-dup'))
      }
    }
    const from = s.fromPx ?? 10
    return {
      id: s.chain,
      frameId: FRAME,
      assetId: 'asset-test',
      axis: s.axis === 'X' ? 'HORIZONTAL' : 'VERTICAL',
      baselinePx: 20 + i * 30,
      ticksPx: [from, from + s.px],
      segments: [{ index: 0, fromPx: from, toPx: from + s.px, pixelLength: s.px, valueCm: s.cm, origin, confidence: 0.9, evidenceId: id }],
      closes: true,
      observationIds: [],
      ocrTokenIds: [tokenId],
    } as DimensionChain
  })
  return { ...metricsOf(chains, [REG]), evidence, ocrTokens: tokens, numericLattices: lattices, ...(options.solution ? { metricSolutions: [options.solution] } : {}) }
}

/** A metric solution for the fixture frame offering the given scales as plausible, independently witnessed hypotheses. */
export function solutionOffering(scales: readonly number[]): FrameMetricSolution {
  return {
    frameId: FRAME,
    assetId: 'asset-test',
    relation: 'LEGACY_UNCONFIRMED',
    confidence: 'WEAK',
    cmPerPixelX: 5,
    cmPerPixelY: 5,
    anisotropy: 1,
    isotropy: 'ASSUMED',
    hypotheses: scales.map((cmPerPixel, k) => ({ id: `scale-${k}`, cmPerPixel, independentGroups: 1, independentWeight: 1, witnessIds: [], groups: 1, chains: 1, independentAxes: ['X'], weight: 1, longestShare: 0.5, substantialWitnesses: 1, majorWitnesses: 1, corroborated: false, axesMeasured: false, residualPx: 0, plausible: true, why: 'a fixture' })),
    legacy: { cmPerPixel: 5, independentGroups: 0, independentWeight: 0, correctedAnchors: 0, readAnchors: 1 },
    independentWitnesses: 0,
    supportingObservationIds: [],
    conflictingObservationIds: [],
    orientationDecisions: [],
    rereadChainIds: [],
    counts: { textRegions: 0, observations: 0, hypotheses: scales.length },
    why: 'a fixture',
  } as unknown as FrameMetricSolution
}

/** A small seeded generator (mulberry32): the same plans on every run and device. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type GeneratedPlan = { readings: Reading[]; solutionScales?: number[] }

/** `count` seeded plans: statements of random length, scale, origin and readers; a third with a metric solution. */
export function generatePlans(seed: number, count: number): GeneratedPlan[] {
  const next = rng(seed)
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)]
  const plans: GeneratedPlan[] = []
  for (let n = 0; n < count; n += 1) {
    const size = 1 + Math.floor(next() * 5)
    const readings: Reading[] = []
    for (let i = 0; i < size; i += 1) {
      const axis = pick(['X', 'Y'] as const)
      const px = 40 + Math.floor(next() * 400)
      const scale = pick([4, 4.5, 5, 5, 5.5, 6])
      const cm = Math.round(px * scale)
      const other = Math.round(px * pick([4, 4.5, 5, 5.5]))
      const origin = pick(['READ', 'CHAIN_CORRECTED'] as const)
      const lattice = next() < 0.7 ? { cm: next() < 0.6 ? cm : other, cls: pick(['CLEAR', 'SUPPORTED', 'AMBIGUOUS'] as const) } : undefined
      const ensemble = lattice && next() < 0.7 ? { decision: pick(['AGREES', 'LEADS', 'CONTESTS', 'CONTESTS_COUNT', 'NOT_CORROBORATING', 'NOT_COMPARABLE'] as const), external: next() < 0.5 ? cm : other, rival: pick(['EXTERNAL', 'LATTICE', undefined] as const) } : undefined
      readings.push({ chain: `c${pick([0, 1, 2, 3])}`, axis, px, cm: origin === 'CHAIN_CORRECTED' ? Math.round(px * 5) : cm, origin, token: String(cm), ...(lattice ? { lattice } : {}), ...(ensemble ? { ensemble: ensemble as Ensemble } : {}) })
    }
    const solutionScales = next() < 1 / 3 ? [pick([4, 4.5, 5.5, 6]), pick([4, 4.5, 5.5, 6])] : undefined
    plans.push({ readings, ...(solutionScales ? { solutionScales } : {}) })
  }
  return plans
}

export const metricsOfPlan = (p: GeneratedPlan, options: { stripExternal?: boolean } = {}): MetricEvidenceSet =>
  metricsWith(p.readings, { ...options, ...(p.solutionScales ? { solution: solutionOffering(p.solutionScales) } : {}) })
