/**
 * v3.51 C1a: each storey property carries its own authority. A level bundle the section measured (two printed datums)
 * can still hold a storey height nothing prints: the 2.80 m convention between ±0,00 and the ridge, or the storey below
 * repeated for a top storey no datum closes. Those are assumptions, and a feature holding one does not earn L2.
 * The old code returned the bundle's `measured: true` alone, and every LEVEL feature took SOURCE_EXACT/L2 from it.
 */
import { describe, expect, it } from 'vitest'
import type { MetricEvidence, MetricEvidenceSet } from '@buildapp/source-metrics'
import { levelsFrom } from '../src/index.js'
import { qualityLevelOf } from '../src/v2/quality.js'
import { metricsOf } from './plan.js'

const datum = (value: number, i: number): MetricEvidence =>
  ({
    id: `metric-level-${i}`,
    kind: 'LEVEL_DATUM',
    frameId: 'frame-section',
    assetId: 'asset-section',
    variantByteHash: 'a'.repeat(64),
    value,
    unit: 'm',
    origin: 'READ',
    rawText: String(value),
    association: { kind: 'LEVEL_MARKER', score: 0.6, why: 'a fixture', observationIds: [] },
    ocrTokenIds: [],
    observationIds: [],
    alternatives: [],
    confidence: 0.8,
    provenance: { name: 'test', detail: 'a fixture', extractor: 'DERIVED' },
  }) as MetricEvidence
const withDatums = (values: number[]): MetricEvidenceSet => ({ ...metricsOf([], []), evidence: values.map(datum) })

describe('C1a: two printed datums do not make the convention between them printed', () => {
  it('±0,00 and a ridge +8,55 only: the storey height is the 2.80 m convention, named as one', () => {
    const l = levelsFrom(withDatums([0, 8.55]), 'frame-section')
    expect(l.measured).toBe(true)
    expect(l.floors).toEqual([0])
    expect(l.heights).toEqual([2.8])
    expect(l.floorBasis).toEqual(['PRINTED'])
    expect(l.heightBasis).toEqual(['CONVENTION'])
  })

  it('opposite: floors, eaves and ridge printed: every height is a difference of printed datums (derived, not printed)', () => {
    const l = levelsFrom(withDatums([0, 3.06, 4.67, 7.95]), 'frame-section')
    expect(l.floors).toEqual([0, 3.06])
    expect(l.heights).toEqual([3.06, 1.61])
    expect(l.heightBasis).toEqual(['PRINTED_DIFFERENCE', 'PRINTED_DIFFERENCE'])
  })

  it('three datums: the mark below the ridge is the eaves and closes the ground storey (derived)', () => {
    const l = levelsFrom(withDatums([0, 2.96, 8.29]), 'frame-section')
    expect(l.heightBasis).toEqual(['PRINTED_DIFFERENCE'])
  })

  it('a top storey no eaves mark closes (the mark below the ridge is a floor over a slab) repeats the storey below, and says so', () => {
    const placed = (value: number, i: number, row: number): MetricEvidence => ({ ...datum(value, i), measuredGeometry: { type: 'SEGMENT', a: { x: 799, y: row }, b: { x: 801, y: row } } }) as MetricEvidence
    const goz: MetricEvidenceSet = { ...metricsOf([], []), evidence: [placed(-0.32, 0, 660), placed(0, 1, 641), placed(2.96, 2, 453), placed(8.36, 3, 104)] }
    const slabAt296 = (datums: Array<{ value: number }>) => ({ belowDrawnRoof: false, onSlab: Math.abs(Math.max(...datums.map((d) => d.value)) - 2.96) < 1e-6, why: 'a fixture' })
    const l = levelsFrom(goz, 'frame-section', slabAt296, 2)
    expect(l.floors).toEqual([0, 2.96])
    expect(l.heights).toEqual([2.96, 2.96])
    expect(l.heightBasis).toEqual(['PRINTED_DIFFERENCE', 'REPEATED_BELOW'])
  })

  it('a ±0,00 put in where its mark was not read is the datum zero, not a reading', () => {
    const l = levelsFrom(withDatums([-0.32, 3.24, 5.7]), 'frame-section')
    expect(l.floors[0]).toBe(0)
    expect(l.floorBasis[0]).toBe('DATUM_ZERO')
  })

  it('no section: every value a convention', () => {
    const l = levelsFrom(withDatums([]), 'frame-section')
    expect(l).toMatchObject({ measured: false, floorBasis: ['CONVENTION'], heightBasis: ['CONVENTION'] })
  })
})

describe('C1a: a feature with an assumed parameter is not L2', () => {
  const level = (parameterProvenance: Record<string, 'SOURCE_EXACT' | 'SOURCE_DERIVED' | 'ASSUMED_FOR_RENDERING'>) => ({
    provenance: 'SOURCE_EXACT' as const,
    sourceCoverage: { viewFamilies: [], sightings: 1, independentAssets: 1, printed: true },
    parameters: { elevation: { value: 0, low: -0.02, high: 0.02 }, height: { value: 2.8, low: 2.75, high: 2.85 } },
    unresolvedProperties: [],
    parameterProvenance,
  })
  it('printed elevation, conventional height: L1', () => {
    expect(qualityLevelOf(level({ elevation: 'SOURCE_EXACT', height: 'ASSUMED_FOR_RENDERING' }))).toBe('L1')
  })
  it('opposite: printed elevation, derived height: L2', () => {
    expect(qualityLevelOf(level({ elevation: 'SOURCE_EXACT', height: 'SOURCE_DERIVED' }))).toBe('L2')
  })
  it('a provenance entry for a parameter the feature does not have does not demote it', () => {
    expect(qualityLevelOf(level({ elevation: 'SOURCE_EXACT', height: 'SOURCE_DERIVED', thickness: 'ASSUMED_FOR_RENDERING' }))).toBe('L2')
  })
})
