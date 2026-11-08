/**
 * v3.51 C1b: the ground storey's clear height, bound to the section's geometry (ends on the ladder, span = value,
 * a physical band to the printed floor above), and the counter-cases: the wrong line, the wrong host, no floor above,
 * an eaves mark taken for a floor, and two readings that disagree.
 */
import { describe, expect, it } from 'vitest'
import type { MetricEvidence, MetricEvidenceSet } from '@buildapp/source-metrics'
import { decideGroundClearHeight } from '../src/v2/section-clear-height.js'
import { metricsOf } from './plan.js'

const F = 'frame-section'
const base = { frameId: F, assetId: 'asset-section', variantByteHash: 'a'.repeat(64), origin: 'READ', ocrTokenIds: [], observationIds: [], alternatives: [], confidence: 0.8, provenance: { name: 'test', detail: 'a fixture', extractor: 'DERIVED' } }
const datum = (value: number, row: number, i: number): MetricEvidence =>
  ({ ...base, id: `lvl-${i}`, kind: 'LEVEL_DATUM', value, unit: 'm', rawText: String(value), association: { kind: 'LEVEL_MARKER', score: 0.6, why: 'a fixture', observationIds: [] }, measuredGeometry: { type: 'SEGMENT', a: { x: 254, y: row }, b: { x: 256, y: row } } }) as MetricEvidence
const dim = (id: string, cm: number, x: number, top: number, bottom: number): MetricEvidence =>
  ({ ...base, id, kind: 'LINEAR_DIMENSION', value: cm, unit: 'cm', rawText: String(cm), association: { kind: 'DIMENSION_LINE', score: 0.9, why: 'a fixture', observationIds: [] }, measuredGeometry: { type: 'SEGMENT', a: { x, y: top }, b: { x, y: bottom } } }) as MetricEvidence
const set = (e: MetricEvidence[]): MetricEvidenceSet => ({ ...metricsOf([], []), evidence: e })
// a Marcówki-like ladder: ±0,00 on row 642, +3,06 on row 420 → 0.013784 m/px
const MPP = 3.06 / 222
const rowAt = (m: number): number => 642 - m / MPP
const ladder = [datum(0, 642, 0), datum(3.06, 420, 1), datum(7.95, rowAt(7.95), 2)]
const decide = (dims: MetricEvidence[], floors = [0, 3.06], basis = ['PRINTED', 'PRINTED'] as const) =>
  decideGroundClearHeight({ metrics: set([...ladder, ...dims]), sectionFrameId: F, floors, floorBasis: [...basis], groundAt: 0 })

describe('C1b: the ground storey clear height from the section', () => {
  it('272 from the ±0,00 row to a face below +3,06: accepted, band 0.34 m to the printed floor', () => {
    const d = decide([dim('h272', 272, 330, rowAt(2.72), 642)])
    expect(d.status).toBe('ACCEPTED')
    expect(d.accepted).toMatchObject({ clearHeightM: 2.72, evidenceId: 'h272' })
    expect(d.accepted?.bandM).toBeCloseTo(0.34, 6)
  })

  it('beside it the 252 from ±0,00 leaves 0.54 m: another ceiling, refused; the 266 and 130 over +3,06 have no floor above', () => {
    const d = decide([dim('h272', 272, 330, rowAt(2.72), 642), dim('h252', 252, 823, rowAt(2.52), 642), dim('h266', 266, 330, rowAt(3.06 + 2.66), 420), dim('h130', 130, 200, rowAt(3.06 + 1.3), 420)])
    expect(d.accepted?.evidenceId).toBe('h272')
    const why = Object.fromEntries(d.outcomes.map((o) => [o.candidate.evidenceId, o.rejected]))
    expect(why).toEqual({ h272: undefined, h252: 'BAND_NOT_PHYSICAL', h266: 'NO_PRINTED_FLOOR_ABOVE', h130: 'NO_PRINTED_FLOOR_ABOVE' })
  })

  it('counter — the wrong line: the right number on a segment whose span is not it (a chain line) is refused', () => {
    const d = decide([dim('h278', 278, 261, 518, 590)])
    expect(d.status).toBe('NONE')
    expect(d.outcomes[0].rejected).toBe('SPAN_DISAGREES_WITH_VALUE')
  })

  it('counter — the wrong host: a dimension that does not stand on a floor row (from the terrain) is not this relation', () => {
    const d = decide([dim('hT', 272, 330, rowAt(-0.32 + 2.72), rowAt(-0.32))])
    expect(d.outcomes[0].rejected).toBe('NOT_ON_A_FLOOR')
    expect(d.status).toBe('NONE')
  })

  it('counter — no floor above (a single storey): the clear height gives no band', () => {
    const d = decide([dim('h280', 280, 330, rowAt(2.8), 642)], [0], ['PRINTED'] as never)
    expect(d.status).toBe('NONE')
    expect(d.outcomes[0].rejected).toBe('NO_PRINTED_FLOOR_ABOVE')
  })

  it('counter — a floor above that only a convention puts there is not printed: no band', () => {
    const d = decide([dim('h272', 272, 330, rowAt(2.72), 642)], [0, 3.06], ['PRINTED', 'CONVENTION'] as never)
    expect(d.status).toBe('NONE')
  })

  it('counter — an eaves mark taken for the next floor (+2,93 over a 2,83 clear height) leaves 0.10 m: refused, not a slab', () => {
    const eavesLadder = [datum(0, 642, 0), datum(2.93, rowAt(2.93), 1), datum(7.2, rowAt(7.2), 2)]
    const d = decideGroundClearHeight({ metrics: set([...eavesLadder, dim('h283', 283, 870, rowAt(2.83), 642)]), sectionFrameId: F, floors: [0, 2.93], floorBasis: ['PRINTED', 'PRINTED'], groundAt: 0 })
    expect(d.status).toBe('NONE')
    expect(d.outcomes[0]).toMatchObject({ rejected: 'BAND_NOT_PHYSICAL' })
    expect(d.outcomes[0].bandM).toBeCloseTo(0.1, 6)
  })

  it('counter — conflict: two admissible readings that disagree are named and neither is applied', () => {
    const d = decide([dim('a', 272, 330, rowAt(2.72), 642), dim('b', 264, 500, rowAt(2.64), 642)])
    expect(d.status).toBe('AMBIGUOUS')
    expect(d.accepted).toBeUndefined()
    expect(d.outcomes.map((o) => o.rejected)).toEqual(['CONFLICTS_WITH_ANOTHER_READING', 'CONFLICTS_WITH_ANOTHER_READING'])
  })

  it('opposite of the conflict: the same value read twice (two variants) is one statement', () => {
    const d = decide([dim('a', 272, 330, rowAt(2.72), 642), dim('b', 272, 331, rowAt(2.72), 642)])
    expect(d.status).toBe('ACCEPTED')
    expect(d.accepted?.evidenceId).toBe('a')
  })

  it('a dimension on another frame is not the section\'s', () => {
    const other = { ...dim('x', 272, 330, rowAt(2.72), 642), frameId: 'frame-plan' } as MetricEvidence
    expect(decide([other]).status).toBe('NONE')
  })
})
