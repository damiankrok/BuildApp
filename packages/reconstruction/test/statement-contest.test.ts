/**
 * Statement contests and the source conflict's doubt policy (BUILDPLAN-ANALYZER-005P, plan resolver 1.5.0).
 *
 * A printed dimension is read by up to three confident readers of the same ink — what plan resolution reads as printed,
 * the numeric lattice (its own class CLEAR or SUPPORTED) and the external recogniser (when the ensemble found it
 * corroborating). They are estimators of one crop, never witnesses of one another. When they disagree the statement is
 * CONTESTED, and the source-conflict test reads it by one rule — doubt never helps the accuser:
 *
 *   (1) it refutes the registration only if none of its readings fits it;
 *   (2) it spares an offered rival only if every reading fits the rival;
 *   (3) it joins an OUTER_TOTALS accusation only if every reading fits the accused scale;
 *   (4) it defends the registration against OUTER_TOTALS if one reading fits it;
 *
 * and it never states what the incumbent did not state. Every other consumer reads as before. Each clause has a fixture
 * that only that clause decides. Hand-made evidence on a 460 × 480 px plan registered at 5 cm/px; no drawing.
 */
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { MetricEvidenceSet } from '@buildapp/source-metrics'
import { metricsAtScale, sourceConflictAsPrinted, sourceConflictOf, sourceConflictReview, statementContests, withdrawnRecord } from '../src/index.js'
import { FRAME, JUDGE, REG, citing, generatePlans, metricsOfPlan, metricsWith, solutionOffering } from './contest-fixtures.js'
import type { Reading } from './contest-fixtures.js'
import { WALL } from './plan.js'

const conflictOf = (m: MetricEvidenceSet) => sourceConflictOf(m, FRAME, REG, JUDGE, WALL)
const reviewOf = (m: MetricEvidenceSet) => sourceConflictReview(m, FRAME, REG, JUDGE, WALL)
const contestOf = (m: MetricEvidenceSet, i: number) => statementContests(m)(m.evidence[i], m.ocrTokens[i])
const readersOf = (m: MetricEvidenceSet, i: number) => contestOf(m, i).readings.map((r) => r.reader)

// ---------------------------------------------------------------------------
// the contest: which confident readers read what
// ---------------------------------------------------------------------------

describe('statementContests: the confident readers of one ink', () => {
  it('three readers reading the same value are one reading, not a contest and not three witnesses', () => {
    const c = contestOf(metricsWith([{ chain: 'cx', axis: 'X', px: 400, cm: 2000, lattice: { cm: 2000 }, ensemble: { decision: 'AGREES', external: 2000 } }]), 0)
    expect(c.readings.map((r) => r.reader)).toEqual(['AS_PRINTED', 'LATTICE', 'EXTERNAL'])
    expect(c.values).toEqual([2000])
    expect(c.contested).toBe(false)
  })

  it('the external reading counts only when the ensemble found it corroborating: AGREES, LEADS, CONTESTS with the external as rival', () => {
    const m = metricsWith([
      { chain: 'a', axis: 'X', px: 400, cm: 1800, origin: 'CHAIN_CORRECTED', token: '1800', lattice: { cm: 1800 }, ensemble: { decision: 'CONTESTS', external: 2000, rival: 'EXTERNAL' } },
      { chain: 'b', axis: 'X', px: 400, cm: 1800, lattice: { cm: 1800 }, ensemble: { decision: 'CONTESTS', external: 2000 } },
      { chain: 'c', axis: 'X', px: 400, cm: 1800, lattice: { cm: 1800 }, ensemble: { decision: 'CONTESTS_COUNT', external: 20000 } },
      { chain: 'd', axis: 'X', px: 400, cm: 1800, lattice: { cm: 1800 }, ensemble: { decision: 'NOT_CORROBORATING', external: 2000 } },
      { chain: 'e', axis: 'X', px: 400, cm: 1800, lattice: { cm: 1800 }, ensemble: { decision: 'NO_VALUE', external: 2000 } },
      { chain: 'f', axis: 'X', px: 400, cm: 1800, lattice: { cm: 1800 }, ensemble: { decision: 'NOT_COMPARABLE', external: 2000 } },
    ])
    expect(contestOf(m, 0).values).toEqual([1800, 2000])
    for (const i of [1, 2, 3, 4, 5]) {
      expect(readersOf(m, i), `${i}`).toEqual(['AS_PRINTED', 'LATTICE'])
      expect(contestOf(m, i).contested, `${i}`).toBe(false)
    }
  })

  it('a LEADS record over an unconfident lattice gives the external reading only: the lattice’s own class decides, not the ensemble’s', () => {
    // as `ensembleOf` seals it: the lattice's own class AMBIGUOUS, the record's class SUPPORTED, its reading the external one
    const m = metricsWith([{ chain: 'a', axis: 'X', px: 400, cm: 2000, lattice: { cm: 1800, cls: 'AMBIGUOUS' }, ensemble: { decision: 'LEADS', external: 2000, rival: 'LATTICE' } }])
    expect(readersOf(m, 0)).toEqual(['AS_PRINTED', 'EXTERNAL'])
    expect(contestOf(m, 0).contested).toBe(false)
  })

  it('the lattice is joined on the same frame, box and orientation only', () => {
    const m = metricsWith([
      { chain: 'a', axis: 'X', px: 400, cm: 1800, lattice: { cm: 2000 }, frameOfLattice: 'frame-other-copy' },
      { chain: 'b', axis: 'X', px: 400, cm: 1800, lattice: { cm: 2000 }, orientationOfLattice: 'ROTATED_CW' },
      { chain: 'c', axis: 'Y', px: 400, cm: 1800, orientation: 'ROTATED_CW', lattice: { cm: 2000 } },
    ])
    expect(readersOf(m, 0)).toEqual(['AS_PRINTED'])
    expect(readersOf(m, 1)).toEqual(['AS_PRINTED']) // a reading of the same box turned another way is another reading
    expect(readersOf(m, 2)).toEqual(['AS_PRINTED', 'LATTICE']) // the same turn joins
  })

  it('a token text that is no dimension (a leading zero: read upside down) is no reading', () => {
    const m = metricsWith([{ chain: 'a', axis: 'X', px: 400, cm: 1000, origin: 'CHAIN_CORRECTED', token: '0081', lattice: { cm: 1800 } }])
    expect(readersOf(m, 0)).toEqual(['LATTICE'])
    expect(contestOf(m, 0).contested).toBe(false)
  })

  it('a duplicated crop (two lattice records for one ink) is joined as sealed: the later record', () => {
    const m = metricsWith([{ chain: 'a', axis: 'X', px: 400, cm: 1800, lattice: { cm: 1800 }, duplicateLattice: { cm: 2000 } }])
    expect(contestOf(m, 0).readings).toEqual([
      { reader: 'AS_PRINTED', valueCm: 1800 },
      { reader: 'LATTICE', valueCm: 2000 },
    ])
  })
})

// ---------------------------------------------------------------------------
// the source conflict under doubt: each clause alone
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

  it('without the external reading the same misreads accuse exactly as 1.4.0 did: no value is conjured', () => {
    const stripped = metricsWith(misreadTotals(), { stripExternal: true })
    const c = conflictOf(stripped)
    expect(c?.triggers).toEqual(['AS_READ_REFUTATION', 'OUTER_TOTALS'])
    expect(c?.registrationRefuted).toBe(1)
    expect(c?.doubted).toEqual([])
    expect(reviewOf(stripped).withdrawn).toBeNull()
  })

  it('clause 1 alone: the registration is refuted by a contested statement only if none of its readings fits it', () => {
    // X 1600/400 px refutes 5 cm/px; Y 460 px reads 1840 (4 cm/px) by the token and 2300 (5 cm/px) by the external reader.
    const readings: Reading[] = [
      { chain: 'cx', axis: 'X', px: 400, cm: 1600 },
      { chain: 'cy', axis: 'Y', px: 460, cm: 1840, lattice: { cm: 1840 }, ensemble: { decision: 'CONTESTS', external: 2300, rival: 'EXTERNAL' } },
    ]
    // As printed the registration is refuted on all 860 px and the rival 4 cm/px on none: T1. Under doubt the registration
    // is refuted on 400/860 = 0.465 < 0.5 by clause 1 — even though, were clause 1 read as printed (1.0), the rival's
    // clause-2 share (460/860 = 0.535) would still be better by 0.25 and T1 would stand. Clause 1 alone withdraws it.
    expect(conflictOf(metricsWith(readings, { stripExternal: true }))?.triggers).toContain('AS_READ_REFUTATION')
    const r = reviewOf(metricsWith(readings))
    expect(r.conflict?.triggers ?? []).not.toContain('AS_READ_REFUTATION')
    expect(r.withdrawn?.triggers).toContain('AS_READ_REFUTATION')
  })

  it('clause 1, exactly: one contested statement whose external reading fits lowers the registration’s refuted share by its own length', () => {
    // X 1600/400 and Y 1200/300 state 4 cm/px; a short X 50 px reads 300 (6 cm/px) by the token and 250 (5 cm/px) externally.
    const readings: Reading[] = [
      { chain: 'cx', axis: 'X', px: 400, cm: 1600 },
      { chain: 'cy', axis: 'Y', px: 300, cm: 1200 },
      { chain: 'cs', axis: 'X', px: 50, cm: 300, lattice: { cm: 300 }, ensemble: { decision: 'CONTESTS', external: 250, rival: 'EXTERNAL' } },
    ]
    const m = metricsWith(readings)
    expect(conflictOf(metricsWith(readings, { stripExternal: true }))?.registrationRefuted).toBe(1)
    expect(conflictOf(m)?.registrationRefuted).toBe(0.933333)
    expect(conflictOf(m)?.shareMovedBy?.map((d) => d.evidenceId)).toEqual(['ev-2']) // the statement that moved it is named // 700/750: the 50 px statement no longer refutes
    expect(reviewOf(m).withdrawn).toBeNull() // the triggers stand; only the share moved
  })

  it('clause 2 alone: a rival is spared by a contested statement only if every reading fits it', () => {
    // X 100 px 400 (4 cm/px); Y 450 px reads 1800 (4 cm/px) by the token, 1950 (4.33 cm/px) externally: neither fits 5.
    const m = metricsWith([
      { chain: 'cx', axis: 'X', px: 100, cm: 400 },
      { chain: 'cy', axis: 'Y', px: 450, cm: 1800, lattice: { cm: 1800 }, ensemble: { decision: 'CONTESTS', external: 1950, rival: 'EXTERNAL' } },
    ])
    const r = reviewOf(m)
    // every reading refutes the registration (refuted 1 under both readings), so only clause 2 can withdraw T1: the rival
    // 4 cm/px is refuted by the Y statement's 1950 (450/550 = 0.818 > 1 - 0.25)
    expect(r.conflict).toBeNull()
    expect(r.withdrawn?.triggers).toEqual(['AS_READ_REFUTATION'])
    expect(r.withdrawn?.doubted.map((d) => d.evidenceId)).toEqual(['ev-1'])
  })

  it('clause 3 alone: a contested statement joins an OUTER_TOTALS accusation only if every reading fits the accused scale', () => {
    // a metric solution offers no rival (T1 cannot fire); the token misreads agree on 4.5 cm/px, the external readings on 4.25
    const m = metricsWith(
      [
        { chain: 'cx', axis: 'X', px: 400, cm: 1800, lattice: { cm: 1800 }, ensemble: { decision: 'CONTESTS', external: 1700, rival: 'EXTERNAL' } },
        { chain: 'cy', axis: 'Y', px: 300, cm: 1350, lattice: { cm: 1350 }, ensemble: { decision: 'CONTESTS', external: 1275, rival: 'EXTERNAL' } },
      ],
      { solution: solutionOffering([]) },
    )
    const r = reviewOf(m)
    expect(r.conflict).toBeNull()
    expect(r.withdrawn?.triggers).toEqual(['OUTER_TOTALS'])
    expect(r.withdrawn?.doubted.map((d) => d.evidenceId)).toEqual(['ev-0', 'ev-1'])
  })

  it('clause 4 alone: a contested statement defends the registration if one reading fits it', () => {
    // two uncontested long readings accuse 4 cm/px (700 px); two long statements read 3.33 cm/px by the token and 5 cm/px
    // externally (900 px): as printed they neither accuse nor defend; under doubt they defend, and 700 < 900
    const m = metricsWith(
      [
        { chain: 'cx', axis: 'X', px: 400, cm: 1600 },
        { chain: 'cy', axis: 'Y', px: 300, cm: 1200 },
        { chain: 'dx', axis: 'X', px: 450, cm: 1500, lattice: { cm: 1500 }, ensemble: { decision: 'CONTESTS', external: 2250, rival: 'EXTERNAL' } },
        { chain: 'dy', axis: 'Y', px: 450, cm: 1500, lattice: { cm: 1500 }, ensemble: { decision: 'CONTESTS', external: 2250, rival: 'EXTERNAL' } },
      ],
      { solution: solutionOffering([]) },
    )
    const r = reviewOf(m)
    expect(r.conflict?.triggers ?? []).not.toContain('OUTER_TOTALS')
    expect(r.withdrawn?.triggers).toEqual(['OUTER_TOTALS'])
    // the statements that turned it are the defenders, not the accusers
    expect(r.withdrawn?.evidenceIds).toEqual(['ev-0', 'ev-1'])
    expect(r.withdrawn?.doubted.map((d) => d.evidenceId)).toEqual(['ev-2', 'ev-3'])
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

  it('two disagreeing dimension lines whose readers agree are not doubted: the conflict is 1.4.0’s', () => {
    const plain: Reading[] = [
      { chain: 'cx', axis: 'X', px: 400, cm: 1600 },
      { chain: 'cy', axis: 'Y', px: 420, cm: 1680 },
      { chain: 'cx2', axis: 'X', px: 120, cm: 600 },
    ]
    const withReaders = plain.map((s) => ({ ...s, lattice: { cm: s.cm }, ensemble: { decision: 'AGREES' as const, external: s.cm } }))
    expect(conflictOf(metricsWith(withReaders))).toEqual(conflictOf(metricsWith(plain)))
    expect(conflictOf(metricsWith(plain))?.triggers).toContain('OUTER_TOTALS')
  })

  it('the plan turned a quarter (axes swapped) gives the same answer (a mirror changes no span length, which is all the test reads)', () => {
    const turned = misreadTotals().map((s) => ({ ...s, axis: s.axis === 'X' ? ('Y' as const) : ('X' as const) }))
    for (const readings of [turned]) {
      expect(conflictOf(metricsWith(readings))).toBeNull()
      expect(reviewOf(metricsWith(readings)).withdrawn?.triggers).toEqual(['AS_READ_REFUTATION', 'OUTER_TOTALS'])
      expect(conflictOf(metricsWith(readings, { stripExternal: true }))?.triggers).toEqual(['AS_READ_REFUTATION', 'OUTER_TOTALS'])
    }
  })

  it('an empty sheet accuses nothing and withdraws nothing', () => {
    expect(reviewOf(metricsWith([]))).toEqual({ conflict: null, withdrawn: null })
  })
})

describe('N1a: a reading the registration’s own solution cites cannot vouch for it', () => {
  // The mirror of glogownikach (review round 2, G2-1): the classic token is right (1350/300 px, 4.5 cm/px, like the
  // uncontested X 1800/400 px), and the external reading 1500 — which the registered scale's own solution cites as a
  // witness — is wrong. The registration may not clear itself with its own witness: the accusation stands, as in 1.4.0.
  const mirror = (): Reading[] => [
    { chain: 'cx', axis: 'X', px: 400, cm: 1800 },
    { chain: 'cy', axis: 'Y', px: 300, cm: 1350, lattice: { cm: 1350, cls: 'AMBIGUOUS' }, ensemble: { decision: 'LEADS', external: 1500, rival: 'LATTICE' } },
  ]

  it('uncited, the doubt withdraws the accusation (N1)', () => {
    expect(reviewOf(metricsWith(mirror())).withdrawn?.triggers).toContain('OUTER_TOTALS')
  })

  it('cited by the registration’s solution, the reading is set aside: the accusation stands, nothing is withdrawn', () => {
    const m = citing(metricsWith(mirror()), [{ statement: 1, valueCm: 1500 }])
    const r = reviewOf(m)
    expect(r.conflict?.triggers).toContain('OUTER_TOTALS')
    expect(r.withdrawn).toBeNull()
    expect(r.conflict).toEqual(sourceConflictAsPrinted(m, FRAME, REG, JUDGE, WALL)) // exactly the 1.4.0 accusation
  })

  it('the glogownikach pattern: one accuser’s external reading cited (870), the other’s not (541) — still only one accuser, still withdrawn', () => {
    const m = citing(metricsWith(misreadTotals()), [{ statement: 1, valueCm: 1500 }])
    const r = reviewOf(m)
    expect(r.conflict?.triggers ?? []).not.toContain('OUTER_TOTALS')
    expect(r.withdrawn?.triggers).toContain('OUTER_TOTALS')
    // ev-1's only rival reading is cited, so for the test it is uncontested and accuses: the withdrawal turned on ev-0 alone
    expect(r.withdrawn?.doubted.map((d) => d.evidenceId)).toEqual(['ev-0'])
  })

  it('a citation of another value of the same ink does not set the reading aside', () => {
    const m = citing(metricsWith(mirror()), [{ statement: 1, valueCm: 1350 }])
    expect(reviewOf(m).withdrawn?.triggers).toContain('OUTER_TOTALS')
  })
})

describe('a withdrawn accusation is named, with the readers it turned on', () => {
  it('an OUTER_TOTALS withdrawal does not name a short contested statement, which that trigger never reads', () => {
    // clause 3 withdraws T3; a short (60 px < 0.25 × 460) contested X statement flips its verdict against the registration,
    // and T1 does not fire as printed (a metric solution offers no rival): it is not one of the statements T3 turned on
    const m = metricsWith(
      [
        { chain: 'cx', axis: 'X', px: 400, cm: 1800, lattice: { cm: 1800 }, ensemble: { decision: 'CONTESTS', external: 1700, rival: 'EXTERNAL' } },
        { chain: 'cy', axis: 'Y', px: 300, cm: 1350, lattice: { cm: 1350 }, ensemble: { decision: 'CONTESTS', external: 1275, rival: 'EXTERNAL' } },
        { chain: 'cs', axis: 'X', px: 60, cm: 360, lattice: { cm: 360 }, ensemble: { decision: 'CONTESTS', external: 300, rival: 'EXTERNAL' } },
      ],
      { solution: solutionOffering([]) },
    )
    const r = reviewOf(m)
    expect(r.withdrawn?.triggers).toEqual(['OUTER_TOTALS'])
    expect(r.withdrawn?.doubted.map((d) => d.evidenceId)).toEqual(['ev-0', 'ev-1'])
  })

  it('the record names the withdrawn triggers, their reasons only, and every contested statement whose verdict the doubt changed', () => {
    const r = reviewOf(metricsWith(misreadTotals()))
    expect(r.conflict).toBeNull()
    expect(r.withdrawn?.triggers).toEqual(['AS_READ_REFUTATION', 'OUTER_TOTALS'])
    expect(r.withdrawn?.doubted.map((d) => d.evidenceId)).toEqual(['ev-0', 'ev-1'])
    expect(r.withdrawn?.doubted[0].readings).toEqual([
      { reader: 'AS_PRINTED', valueCm: 1800 },
      { reader: 'LATTICE', valueCm: 1800 },
      { reader: 'EXTERNAL', valueCm: 2000 },
    ])
    const record = withdrawnRecord(r)
    expect(record).toMatchObject({ resolverVersion: '1.5.0', statementContest: '1.0.0', withdrawnTriggers: 'AS_READ_REFUTATION,OUTER_TOTALS', withdrawnEvidenceCount: 2, doubtedCount: 2, stillStanding: '' })
    expect(String(record.doubted)).toBe('ev-0=AS_PRINTED 1800|LATTICE 1800|EXTERNAL 2000; ev-1=AS_PRINTED 1350|EXTERNAL 1500')
  })

  it('a partial withdrawal names only the withdrawn triggers’ reasons and statements, and what still stands', () => {
    // every partial withdrawal among the seeded plans (one trigger withdrawn, another standing)
    const partial = generatePlans(5050, 2000)
      .map((p) => reviewOf(metricsOfPlan(p)))
      .filter((r) => r.withdrawn && r.conflict)
    expect(partial.length).toBeGreaterThan(5)
    for (const r of partial) {
      const standing = r.conflict?.triggers ?? []
      for (const t of r.withdrawn?.triggers ?? []) expect(standing).not.toContain(t)
      for (const reason of (r.conflict?.why ?? '').split('; ')) expect(r.withdrawn?.why).not.toContain(reason)
      expect(withdrawnRecord(r).stillStanding).toBe(standing.join(','))
    }
  })

  it('one statement carried by two segments is named once', () => {
    const m = metricsWith([...misreadTotals(), { chain: 'cx-copy', axis: 'X', px: 400, cm: 2000, origin: 'CHAIN_CORRECTED', token: '1800', evidenceOf: 0 }])
    expect(reviewOf(m).withdrawn?.doubted.map((d) => d.evidenceId)).toEqual(['ev-0', 'ev-1'])
  })
})

describe('a contest never states what the incumbent did not state', () => {
  it('a READ whose way up another axis chose (dependsOnScale) states nothing, whatever its readers', () => {
    const m = metricsWith([
      { chain: 'cx', axis: 'X', px: 400, cm: 1600, dependsOnScale: true, lattice: { cm: 1600 }, ensemble: { decision: 'CONTESTS', external: 2000, rival: 'EXTERNAL' } },
      { chain: 'cy', axis: 'Y', px: 300, cm: 1200, dependsOnScale: true, lattice: { cm: 1200 }, ensemble: { decision: 'CONTESTS', external: 1500, rival: 'EXTERNAL' } },
    ])
    expect(reviewOf(m)).toEqual({ conflict: null, withdrawn: null })
  })

  it('a statement that states nothing does not defend the registration either: an uncontested accusation stands beside it', () => {
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
    const stripped = metricsWith(misreadTotals(), { stripExternal: true })
    expect(metricsAtScale(m, FRAME, 5, WALL / 2).refutedShare).toBe(metricsAtScale(stripped, FRAME, 5, WALL / 2).refutedShare)
    expect(metricsAtScale(m, FRAME, 4.5, WALL / 2).refutedShare).toBe(0)
    expect(metricsAtScale(m, FRAME, 5, WALL / 2).refutedShare).toBe(1)
  })

  it('the offered rivals are the incumbent’s: a metric solution’s hypotheses, whatever the contest', () => {
    const solution = solutionOffering([4.5])
    const c = conflictOf(metricsWith(misreadTotals(), { solution, stripExternal: true }))
    expect(c?.alternatives.map((a) => a.cmPerPx)).toEqual([4.5])
    const r = reviewOf(metricsWith(misreadTotals(), { solution }))
    expect(r.conflict).toBeNull()
    expect(r.withdrawn?.triggers).toEqual(['AS_READ_REFUTATION', 'OUTER_TOTALS'])
  })
})

// ---------------------------------------------------------------------------
// the guarantee, against the incumbent's own code: an accusation can be withdrawn, never made
// ---------------------------------------------------------------------------

describe('the doubt policy is monotone against plan resolver 1.4.0 itself', () => {
  // The oracle is the start revision's sourceConflictOf (5906afa) run on these same plans and frozen
  // (research/analyzer-005p/conflict-oracle.ts): not 1.5.0's own as-printed mode.
  const oracle = JSON.parse(readFileSync(new URL('./fixtures/conflict-oracle-1.4.0.json', import.meta.url), 'utf8')) as {
    seed: number
    count: number
    plansSha256: string
    results: Array<{ triggers: string[]; registrationRefuted: number } | null>
  }
  const plans = generatePlans(oracle.seed, oracle.count)

  it('the plans are the oracle’s', () => {
    expect(createHash('sha256').update(JSON.stringify(plans)).digest('hex')).toBe(oracle.plansSha256)
  })

  it('on 2000 generated plans: as printed is 1.4.0; under doubt no trigger 1.4.0 lacks and no larger refuted share; the withdrawal is reached', () => {
    let withdrawn = 0
    let metricPath = 0
    plans.forEach((p, n) => {
      const r = reviewOf(metricsOfPlan(p))
      const old = oracle.results[n]
      const asPrinted = [...(r.conflict?.triggers ?? []), ...(r.withdrawn?.triggers ?? [])]
      expect(new Set(asPrinted), `${n}`).toEqual(new Set(old?.triggers ?? []))
      // the as-printed test is 1.4.0's, object for object (triggers in order, reasons, ids, shares, rivals)
      const printed = sourceConflictAsPrinted(metricsOfPlan(p), FRAME, REG, JUDGE, WALL)
      expect(printed === null ? null : { triggers: printed.triggers, why: printed.why, evidenceIds: printed.evidenceIds, registrationRefuted: printed.registrationRefuted, alternatives: printed.alternatives }, `${n}`).toEqual(old)
      for (const t of r.conflict?.triggers ?? []) expect(old?.triggers ?? [], `${n}`).toContain(t)
      if (r.conflict && old) expect(r.conflict.registrationRefuted, `${n}`).toBeLessThanOrEqual(old.registrationRefuted)
      if (r.withdrawn) withdrawn += 1
      if (r.withdrawn && p.solutionScales) metricPath += 1
    })
    expect(withdrawn).toBeGreaterThan(100) // the generator reaches the case the policy exists for
    expect(metricPath).toBeGreaterThan(10) // and the metric-solution path of the offered rivals
  })
})
