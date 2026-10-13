/**
 * Statement contests and the source conflict's doubt policy (BUILDPLAN-ANALYZER-005P, plan resolver 1.5.0).
 *
 * A printed dimension is read by up to three confident readers of the same ink — the classic token, the numeric
 * lattice (when CLEAR or SUPPORTED) and the external recogniser (when the ensemble found it corroborating). They are
 * estimators of one crop, never witnesses of one another. When they disagree the statement is CONTESTED, and the
 * source-conflict test reads it by one rule: doubt never helps the accuser. A contested statement refutes the
 * registration only if none of its readings fits it, joins an accusation of another scale only if all of them fit
 * that scale, and states nothing it did not state before. Every other consumer reads as before.
 *
 * Hand-made evidence on a 460 × 480 px plan registered at 5 cm/px; no drawing, no real house.
 */
import { describe, expect, it } from 'vitest'
import type { DimensionChain, MetricEvidence, MetricEvidenceSet, NumericLatticeRecord, OcrToken } from '@buildapp/source-metrics'
import { metricsAtScale, sourceConflictOf, sourceConflictReview, statementContests } from '../src/index.js'
import { WALL, metricsOf, registration } from './plan.js'

const FRAME = 'frame-plan'
const JUDGE = { x0: 0, y0: 0, x1: 460, y1: 480 }
const REG = registration(FRAME) // 5 cm/px

type Ensemble = { decision: 'AGREES' | 'LEADS' | 'CONTESTS' | 'CONTESTS_COUNT' | 'NOT_CORROBORATING' | 'NO_VALUE' | 'NOT_COMPARABLE'; external: number; rival?: 'EXTERNAL' | 'LATTICE' }
type Reading = {
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
}

function metricsWith(readings: readonly Reading[], strip: { external?: boolean } = {}): MetricEvidenceSet {
  const evidence: MetricEvidence[] = []
  const tokens: OcrToken[] = []
  const lattices: NumericLatticeRecord[] = []
  const chains: DimensionChain[] = readings.map((s, i) => {
    const id = `ev-${i}`
    const tokenId = `tok-${i}`
    const origin = s.origin ?? 'READ'
    const text = s.token ?? String(s.cm)
    const box = { x0: 20 * i, y0: 0, x1: 20 * i + 18, y1: 10 }
    tokens.push({ id: tokenId, frameId: FRAME, assetId: 'asset-test', text, box, confidence: 0.6, score: 0.5, shearDeg: 0, heightPx: 14 } as OcrToken)
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
      const cls = s.lattice.cls ?? 'CLEAR'
      const e = s.ensemble && !strip.external
      lattices.push({
        id: `lat-${i}`,
        frameId: s.frameOfLattice ?? FRAME,
        ...(s.orientationOfLattice ? { orientation: s.orientationOfLattice } : {}),
        box,
        asRead: String(s.lattice.cm),
        asReadValueCm: s.lattice.cm,
        ocrClass: cls,
        ...(e
          ? {
              ensemble: {
                decision: s.ensemble!.decision,
                external: { text: String(s.ensemble!.external), valueCm: s.ensemble!.external, posterior: 0.999, meanP: 0.999, stable: true, confident: true },
                lattice: { asRead: String(s.lattice.cm), valueCm: s.lattice.cm, ocrClass: cls },
                asRead: String(s.lattice.cm),
                ocrClass: cls,
                ...(s.ensemble!.rival ? { rival: { text: String(s.ensemble!.rival === 'EXTERNAL' ? s.ensemble!.external : s.lattice.cm), valueCm: s.ensemble!.rival === 'EXTERNAL' ? s.ensemble!.external : s.lattice.cm, witness: s.ensemble!.rival } } : {}),
                why: 'a fixture',
              },
            }
          : {}),
      } as unknown as NumericLatticeRecord)
    }
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
  return { ...metricsOf(chains, [REG]), evidence, ocrTokens: tokens, numericLattices: lattices }
}

const conflictOf = (m: MetricEvidenceSet) => sourceConflictOf(m, FRAME, REG, JUDGE, WALL)
const reviewOf = (m: MetricEvidenceSet) => sourceConflictReview(m, FRAME, REG, JUDGE, WALL)
const contestOf = (m: MetricEvidenceSet, i: number) => statementContests(m)(m.evidence[i], m.ocrTokens[i])

// ---------------------------------------------------------------------------
// the contest: which confident readers read what
// ---------------------------------------------------------------------------

describe('statementContests: the confident readers of one ink', () => {
  it('three readers reading the same value are one reading, not a contest and not three witnesses', () => {
    const c = contestOf(metricsWith([{ chain: 'cx', axis: 'X', px: 400, cm: 2000, lattice: { cm: 2000 }, ensemble: { decision: 'AGREES', external: 2000 } }]), 0)
    expect(c.readings.map((r) => r.reader)).toEqual(['TOKEN', 'LATTICE', 'EXTERNAL'])
    expect(c.values).toEqual([2000])
    expect(c.contested).toBe(false)
  })

  it('the external reading counts only when the ensemble found it corroborating: CONTESTS with the external as rival, LEADS, AGREES', () => {
    const m = metricsWith([
      { chain: 'a', axis: 'X', px: 400, cm: 1800, origin: 'CHAIN_CORRECTED', token: '1800', lattice: { cm: 1800 }, ensemble: { decision: 'CONTESTS', external: 2000, rival: 'EXTERNAL' } },
      { chain: 'b', axis: 'X', px: 400, cm: 1800, lattice: { cm: 1800 }, ensemble: { decision: 'CONTESTS', external: 2000 } },
      { chain: 'c', axis: 'X', px: 400, cm: 1800, lattice: { cm: 1800 }, ensemble: { decision: 'CONTESTS_COUNT', external: 20000 } },
      { chain: 'd', axis: 'X', px: 400, cm: 1800, lattice: { cm: 1800, cls: 'AMBIGUOUS' }, ensemble: { decision: 'LEADS', external: 2000, rival: 'LATTICE' } },
      { chain: 'e', axis: 'X', px: 400, cm: 1800, lattice: { cm: 1800 }, ensemble: { decision: 'NOT_CORROBORATING', external: 2000 } },
    ])
    expect(contestOf(m, 0).values).toEqual([1800, 2000])
    expect(contestOf(m, 1).contested).toBe(false) // a CONTESTS without an external rival: the reading is in doubt, the external is no candidate
    expect(contestOf(m, 2).contested).toBe(false)
    expect(contestOf(m, 3).readings.map((r) => r.reader)).toEqual(['TOKEN', 'EXTERNAL']) // an AMBIGUOUS lattice is not a confident reader
    expect(contestOf(m, 3).contested).toBe(true)
    expect(contestOf(m, 4).contested).toBe(false)
  })

  it('the lattice is joined on the same frame, box and orientation only', () => {
    const m = metricsWith([
      { chain: 'a', axis: 'X', px: 400, cm: 1800, lattice: { cm: 2000 }, frameOfLattice: 'frame-other-copy' },
      { chain: 'b', axis: 'X', px: 400, cm: 1800, lattice: { cm: 2000 }, orientationOfLattice: 'ROTATED_CW' },
    ])
    expect(contestOf(m, 0).readings.map((r) => r.reader)).toEqual(['TOKEN'])
    expect(contestOf(m, 1).readings.map((r) => r.reader)).toEqual(['TOKEN'])
  })

  it('a token text that is no dimension (a leading zero: read upside down) is no TOKEN reading', () => {
    const m = metricsWith([{ chain: 'a', axis: 'X', px: 400, cm: 1000, origin: 'CHAIN_CORRECTED', token: '0081', lattice: { cm: 1800 } }])
    expect(contestOf(m, 0).readings.map((r) => r.reader)).toEqual(['LATTICE'])
    expect(contestOf(m, 0).contested).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// the source conflict under doubt
// ---------------------------------------------------------------------------

// The glogownikach pattern: the classic reader misreads both long totals (a middle digit), the misreads agree on a
// second scale (4.5 cm/px), and the external reader read both correctly (5 cm/px, the registration).
const misreadTotals = (): Reading[] => [
  { chain: 'cx', axis: 'X', px: 400, cm: 2000, origin: 'CHAIN_CORRECTED', token: '1800', lattice: { cm: 1800 }, ensemble: { decision: 'CONTESTS', external: 2000, rival: 'EXTERNAL' } },
  { chain: 'cy', axis: 'Y', px: 300, cm: 1500, origin: 'CHAIN_CORRECTED', token: '1350', lattice: { cm: 1350, cls: 'AMBIGUOUS' }, ensemble: { decision: 'LEADS', external: 1500, rival: 'LATTICE' } },
]

describe('doubt never helps the accuser', () => {
  it('two long totals the classic reader misread, read correctly by the external reader, accuse nothing (failed under 1.4.0)', () => {
    expect(conflictOf(metricsWith(misreadTotals()))).toBeNull()
  })

  it('the plan turned a quarter (axes swapped) or mirrored (statements in reverse order) gives the same answer', () => {
    const turned = misreadTotals().map((s) => ({ ...s, axis: s.axis === 'X' ? ('Y' as const) : ('X' as const) }))
    const mirrored = [...misreadTotals()].reverse()
    for (const readings of [turned, mirrored]) {
      expect(conflictOf(metricsWith(readings))).toBeNull()
      expect(reviewOf(metricsWith(readings)).withdrawn?.triggers).toEqual(['AS_READ_REFUTATION', 'OUTER_TOTALS'])
      expect(conflictOf(metricsWith(readings, { external: true }))?.triggers).toEqual(['AS_READ_REFUTATION', 'OUTER_TOTALS'])
    }
  })

  it('an empty sheet accuses nothing and withdraws nothing', () => {
    expect(reviewOf(metricsWith([]))).toEqual({ conflict: null, withdrawn: null })
  })

  it('the withdrawn accusation is recorded with the readers that disagreed', () => {
    const r = reviewOf(metricsWith(misreadTotals()))
    expect(r.conflict).toBeNull()
    expect(r.withdrawn?.triggers).toEqual(['AS_READ_REFUTATION', 'OUTER_TOTALS'])
    expect(r.withdrawn?.doubted.map((d) => d.evidenceId)).toEqual(['ev-0', 'ev-1'])
    expect(r.withdrawn?.doubted[0].readings).toEqual([
      { reader: 'TOKEN', valueCm: 1800 },
      { reader: 'LATTICE', valueCm: 1800 },
      { reader: 'EXTERNAL', valueCm: 2000 },
    ])
  })

  it('without the external reading the same misreads accuse exactly as 1.4.0 did: no value is conjured', () => {
    const stripped = metricsWith(misreadTotals(), { external: true })
    const c = conflictOf(stripped)
    expect(c?.triggers).toEqual(['AS_READ_REFUTATION', 'OUTER_TOTALS'])
    expect(c?.registrationRefuted).toBe(1)
    expect(c?.doubted).toEqual([])
    expect(reviewOf(stripped).withdrawn).toBeNull()
  })

  it('a contest between readings that fit the same scale changes nothing: a correct accusation stands (the 1600/1601 pattern)', () => {
    // Registered at 5 cm/px; the drawing states 4 cm/px on both axes. The classic reader read 1601, the others 1600.
    const m = metricsWith([
      { chain: 'cx', axis: 'X', px: 400, cm: 1601, lattice: { cm: 1600 }, ensemble: { decision: 'AGREES', external: 1600 } },
      { chain: 'cy', axis: 'Y', px: 300, cm: 1200 },
    ])
    const r = reviewOf(m)
    expect(r.conflict?.triggers).toContain('OUTER_TOTALS')
    expect(r.withdrawn).toBeNull()
    expect(r.conflict?.doubted.map((d) => d.evidenceId)).toEqual(['ev-0'])
  })

  it('an accusation by uncontested readings on both axes stands beside a contested one', () => {
    const m = metricsWith([
      { chain: 'cx', axis: 'X', px: 400, cm: 1800 },
      { chain: 'cy', axis: 'Y', px: 300, cm: 1350 },
      { chain: 'cx2', axis: 'X', px: 200, cm: 900, lattice: { cm: 900 }, ensemble: { decision: 'CONTESTS', external: 1000, rival: 'EXTERNAL' } },
    ])
    expect(conflictOf(m)?.triggers).toContain('OUTER_TOTALS')
  })

  it('two disagreeing dimension lines whose readers agree are not doubted: the conflict is 1.4.0s', () => {
    const plain = [
      { chain: 'cx', axis: 'X' as const, px: 400, cm: 1600 },
      { chain: 'cy', axis: 'Y' as const, px: 420, cm: 1680 },
      { chain: 'cx2', axis: 'X' as const, px: 120, cm: 600 },
    ]
    const withReaders = plain.map((s) => ({ ...s, lattice: { cm: s.cm }, ensemble: { decision: 'AGREES' as const, external: s.cm } }))
    expect(conflictOf(metricsWith(withReaders))).toEqual(conflictOf(metricsWith(plain)))
    expect(conflictOf(metricsWith(plain))?.triggers).toContain('OUTER_TOTALS')
  })
})

describe('a contest never states what the incumbent did not state', () => {
  it('a READ whose way up another axis chose (dependsOnScale) states nothing, whatever its readers', () => {
    const m = metricsWith([
      { chain: 'cx', axis: 'X', px: 400, cm: 1600, dependsOnScale: true, lattice: { cm: 1600 }, ensemble: { decision: 'CONTESTS', external: 2000, rival: 'EXTERNAL' } },
      { chain: 'cy', axis: 'Y', px: 300, cm: 1200, dependsOnScale: true, lattice: { cm: 1200 }, ensemble: { decision: 'CONTESTS', external: 1500, rival: 'EXTERNAL' } },
    ])
    const r = reviewOf(m)
    expect(r).toEqual({ conflict: null, withdrawn: null })
  })

  it('a statement that states nothing does not defend the registration either: an uncontested accusation stands beside it', () => {
    // Two uncontested long readings state 4.5 cm/px on both axes. Two long READs whose way up another axis chose state
    // nothing as printed; their readers fit the registration (5 cm/px), which must not make them its defenders.
    const m = metricsWith([
      { chain: 'cx', axis: 'X', px: 400, cm: 1800 },
      { chain: 'cy', axis: 'Y', px: 300, cm: 1350 },
      { chain: 'dx', axis: 'X', px: 400, cm: 2000, dependsOnScale: true, lattice: { cm: 1800 }, ensemble: { decision: 'CONTESTS', external: 2000, rival: 'EXTERNAL' } },
      { chain: 'dy', axis: 'Y', px: 450, cm: 2250, dependsOnScale: true, lattice: { cm: 2025 }, ensemble: { decision: 'CONTESTS', external: 2250, rival: 'EXTERNAL' } },
    ])
    expect(conflictOf(m)?.triggers).toContain('OUTER_TOTALS')
    expect(reviewOf(m).withdrawn).toBeNull()
  })

  it('a corrected value whose token reads the value states nothing, and its readers do not make it state', () => {
    const m = metricsWith([
      { chain: 'cx', axis: 'X', px: 400, cm: 1600, origin: 'CHAIN_CORRECTED', token: '1600', lattice: { cm: 1800 }, ensemble: { decision: 'CONTESTS', external: 1600, rival: 'EXTERNAL' } },
      { chain: 'cy', axis: 'Y', px: 300, cm: 1200, origin: 'CHAIN_CORRECTED', token: '1200', lattice: { cm: 1350 }, ensemble: { decision: 'CONTESTS', external: 1200, rival: 'EXTERNAL' } },
    ])
    expect(reviewOf(m)).toEqual({ conflict: null, withdrawn: null })
  })

  it('the readers of a statement on another copy of the plan do not reach this one', () => {
    const misread = misreadTotals().map((s) => ({ ...s, frameOfLattice: 'frame-other-copy' }))
    expect(conflictOf(metricsWith(misread))?.triggers).toEqual(['AS_READ_REFUTATION', 'OUTER_TOTALS'])
  })

  it('the ranking still reads every statement as printed: a reading at another scale is refuted as before', () => {
    const m = metricsWith(misreadTotals())
    const stripped = metricsWith(misreadTotals(), { external: true })
    expect(metricsAtScale(m, FRAME, 5, WALL / 2).refutedShare).toBe(metricsAtScale(stripped, FRAME, 5, WALL / 2).refutedShare)
    expect(metricsAtScale(m, FRAME, 4.5, WALL / 2).refutedShare).toBe(0)
    expect(metricsAtScale(m, FRAME, 5, WALL / 2).refutedShare).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// the guarantee: under doubt, an accusation can be withdrawn, never made
// ---------------------------------------------------------------------------

/** A small seeded generator (mulberry32): the same cases on every run and device. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('the doubt policy is monotone', () => {
  it('on 2000 generated plans, every trigger raised under doubt is raised as printed, and the registration is never refuted more', () => {
    const next = rng(5050)
    const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)]
    let withdrawn = 0
    for (let n = 0; n < 2000; n += 1) {
      const count = 1 + Math.floor(next() * 5)
      const readings: Reading[] = []
      for (let i = 0; i < count; i += 1) {
        const axis = pick(['X', 'Y'] as const)
        const px = 40 + Math.floor(next() * 400)
        const scale = pick([4, 4.5, 5, 5, 5.5, 6])
        const cm = Math.round(px * scale)
        const other = Math.round(px * pick([4, 4.5, 5, 5.5]))
        const origin = pick(['READ', 'CHAIN_CORRECTED'] as const)
        const lattice = next() < 0.7 ? { cm: next() < 0.6 ? cm : other, cls: pick(['CLEAR', 'SUPPORTED', 'AMBIGUOUS'] as const) } : undefined
        const ensemble = lattice && next() < 0.7 ? { decision: pick(['AGREES', 'LEADS', 'CONTESTS', 'CONTESTS_COUNT', 'NOT_CORROBORATING'] as const), external: next() < 0.5 ? cm : other, rival: pick(['EXTERNAL', 'LATTICE', undefined] as const) } : undefined
        readings.push({ chain: `c${pick([0, 1, 2, 3])}`, axis, px, cm: origin === 'CHAIN_CORRECTED' ? Math.round(px * 5) : cm, origin, token: String(cm), ...(lattice ? { lattice } : {}), ...(ensemble ? { ensemble: ensemble as Ensemble } : {}) })
      }
      const m = metricsWith(readings)
      const r = reviewOf(m)
      const asPrinted = [...(r.conflict?.triggers ?? []), ...(r.withdrawn?.triggers ?? [])]
      const stripped = conflictOf(metricsWith(readings.map(({ lattice, ensemble, ...rest }) => rest)))
      // the 1.4.0 test (every statement read as printed) is what a set with no confident rival reads
      expect(new Set(asPrinted), `${n}`).toEqual(new Set(stripped?.triggers ?? []))
      for (const t of r.conflict?.triggers ?? []) expect(stripped?.triggers ?? [], `${n}`).toContain(t)
      if (r.conflict && stripped) expect(r.conflict.registrationRefuted, `${n}`).toBeLessThanOrEqual(stripped.registrationRefuted)
      if (r.withdrawn) withdrawn += 1
    }
    expect(withdrawn).toBeGreaterThan(20) // the generator reaches the case the policy exists for
  })
})
