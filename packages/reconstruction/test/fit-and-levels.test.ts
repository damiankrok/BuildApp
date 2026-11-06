/**
 * Two small generic pieces of BUILDAPP-03Y2G:
 *
 *  - openings the model refuses as not fitting their host are fitted by the
 *    model's own rules — narrowed out of a corner's junction zone, lowered
 *    under the wall's top — and named; one that cannot be kept at a useful
 *    size is dropped with the commands that describe it; so is one the model
 *    has no place for (it overlaps an opening already cut, or its host wall
 *    is absent: 005A); any other refusal is returned as the failure it is;
 *  - a section's heights are measured from ±0.00, so a missed ±0.00 does not
 *    make the terrain the ground floor.
 */
import { describe, expect, it } from 'vitest'
import type { BuildingCommand } from '@buildapp/commands'
import type { MetricEvidence, MetricEvidenceSet } from '@buildapp/source-metrics'
import { fitOpeningsToHosts, levelsFrom } from '../src/index.js'
import { metricsOf } from './plan.js'

/** A 10 × 8 m ring on one 2.8 m storey, 0.4 m walls: wall w0 runs along x from (0,0) to (10,0). */
const shell = (): BuildingCommand[] => [
  { type: 'createBuilding', id: 'b', name: 'fixture' },
  { type: 'createLevel', id: 'l0', name: 'Ground', index: 0, elevation: 0, height: 2.8 },
  { type: 'createWallRing', id: 'ring', levelId: 'l0', polygon: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 8 }, { x: 0, z: 8 }], thickness: 0.4, height: 2.8, baseOffset: 0, kind: 'EXTERIOR', cornerOwnership: 'ALTERNATE' },
] as BuildingCommand[]

const cut = (id: string, offset: number, width: number, height: number, sill = 0.9): BuildingCommand => ({ type: 'cutOpening', id, wallId: 'ring-w1', kind: 'WINDOW', offset, sill, width, height }) as BuildingCommand

describe('openings fitted to the walls that host them', () => {
  it('a program the model accepts comes back unchanged, index for index', () => {
    const program = [...shell(), cut('o1', 3, 1.2, 1.4)]
    const fit = fitOpeningsToHosts(program, 'fixture', 'm-fixture')
    expect(fit.ok).toBe(true)
    expect(fit.program).toEqual(program)
    expect(fit.fits).toEqual([])
    expect(fit.indexMap).toEqual(program.map((_, i) => i))
  })

  it('an opening printed taller than the storey the model assumes is lowered under the wall’s top, and named', () => {
    const fit = fitOpeningsToHosts([...shell(), cut('tall', 3, 1.2, 2.9, 0)], 'fixture', 'm-fixture')
    expect(fit.ok).toBe(true)
    expect(fit.fits).toHaveLength(1)
    expect(fit.fits[0]).toMatchObject({ openingId: 'tall', action: 'LOWERED', code: 'OPENING_OUTSIDE_HOST' })
    const fitted = fit.program.find((c) => c.type === 'cutOpening') as Extract<BuildingCommand, { type: 'cutOpening' }>
    expect(fitted.height).toBeLessThanOrEqual(2.7 + 1e-9)
  })

  it('an opening reaching into a corner’s junction zone is narrowed out of it', () => {
    const fit = fitOpeningsToHosts([...shell(), cut('corner', 0.1, 2, 1.4)], 'fixture', 'm-fixture')
    expect(fit.ok).toBe(true)
    expect(fit.fits[0]?.action).toBe('SHRUNK')
    const fitted = fit.program.find((c) => c.type === 'cutOpening') as Extract<BuildingCommand, { type: 'cutOpening' }>
    expect(fitted.width).toBeLessThan(2)
    expect(fitted.offset).toBeGreaterThan(0.1)
  })

  it('an opening that cannot be kept at a useful size is dropped with its window and its evidence', () => {
    const program = [
      ...shell(),
      cut('sliver', 0.05, 0.5, 1.2),
      { type: 'placeWindow', id: 'sliver-unit', openingId: 'sliver' },
      { type: 'setEvidence', targetId: 'sliver', evidence: { status: 'SOURCE_DERIVED', interpretation: 'a test' } },
      cut('kept', 4, 1.2, 1.4),
    ] as BuildingCommand[]
    const fit = fitOpeningsToHosts(program, 'fixture', 'm-fixture')
    expect(fit.ok).toBe(true)
    expect(fit.fits).toEqual([expect.objectContaining({ openingId: 'sliver', action: 'DROPPED' })])
    expect(fit.program.some((c) => JSON.stringify(c).includes('sliver'))).toBe(false)
    expect(fit.program.some((c) => c.type === 'cutOpening' && c.id === 'kept')).toBe(true)
    // the dropped commands map nowhere; the rest keep their order
    expect(fit.indexMap.filter((i) => i < 0)).toHaveLength(3)
  })

  it('an opening overlapping one already cut is not built, with its window and evidence, and the run goes on (005A)', () => {
    const program = [
      ...shell(),
      cut('big', 1, 3, 1.4),
      cut('clash', 2, 1, 1.2),
      { type: 'placeWindow', id: 'clash-unit', openingId: 'clash' },
      { type: 'setEvidence', targetId: 'clash', evidence: { status: 'SOURCE_DERIVED', interpretation: 'a test' } },
      cut('after', 6, 1.2, 1.4),
    ] as BuildingCommand[]
    const fit = fitOpeningsToHosts(program, 'fixture', 'm-fixture')
    expect(fit.ok).toBe(true)
    expect(fit.fits).toEqual([expect.objectContaining({ openingId: 'clash', action: 'DROPPED', code: 'OPENINGS_OVERLAP' })])
    expect(fit.fits[0].why).toMatch(/^not built: it overlaps an opening already cut in the same wall/)
    expect(fit.program.some((c) => JSON.stringify(c).includes('clash'))).toBe(false)
    // the first reading of the wall is kept, and so is everything after the refused one
    expect(fit.program.filter((c) => c.type === 'cutOpening').map((c) => (c as { id: string }).id)).toEqual(['big', 'after'])
  })

  it('an opening whose host wall is not in the model is not built, and says so', () => {
    const orphan = { type: 'cutOpening', id: 'orphan', wallId: 'no-such-wall', kind: 'WINDOW', offset: 1, sill: 0.9, width: 1, height: 1.2 } as BuildingCommand
    const fit = fitOpeningsToHosts([...shell(), orphan], 'fixture', 'm-fixture')
    expect(fit.ok).toBe(true)
    expect(fit.fits).toEqual([expect.objectContaining({ openingId: 'orphan', action: 'DROPPED', code: 'UNKNOWN_WALL' })])
    expect(fit.fits[0].why).toMatch(/a wall it names is not in the model/)
  })

  it('an opening the model will not pass through the further wall it names is not built, and says so', () => {
    const through = { type: 'cutOpening', id: 'through', wallId: 'ring-w1', kind: 'DOOR', offset: 3, sill: 0, width: 1, height: 2.1, leaves: [{ wallId: 'ring-w1', offset: 3 }] } as BuildingCommand
    const fit = fitOpeningsToHosts([...shell(), through], 'fixture', 'm-fixture')
    expect(fit.ok).toBe(true)
    expect(fit.fits).toEqual([expect.objectContaining({ openingId: 'through', action: 'DROPPED', code: 'OPENING_LEAF_INVALID' })])
  })

  it('a refusal that is not about an opening (a wall overlapping another) is returned as the failure it is', () => {
    const program = [
      ...shell(),
      { type: 'createWall', id: 'dup', levelId: 'l0', start: { x: 0, z: 0 }, end: { x: 10, z: 0 }, thickness: 0.4, height: 2.8, baseOffset: 0, kind: 'EXTERIOR' },
    ] as BuildingCommand[]
    const fit = fitOpeningsToHosts(program, 'fixture', 'm-fixture')
    expect(fit.ok).toBe(false)
    if (!fit.ok) expect(fit.errors.map((e) => e.code)).toContain('WALLS_OVERLAP')
  })
})

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

describe('the ladder of heights is measured from ±0.00', () => {
  it('a section whose ±0.00 was not read, but whose terrain, eaves and ridge were: floor at 0, eaves and ridge above it', () => {
    const levels = levelsFrom(withDatums([-0.32, 3.24, 5.7]), 'frame-section')
    expect(levels).toMatchObject({ floors: [0], heights: [3.24], eaves: 3.24, topDatum: 5.7, measured: true })
  })

  it('a two-storey section with ±0.00 read is unchanged by the rule', () => {
    const levels = levelsFrom(withDatums([0, 3.06, 4.67, 7.95]), 'frame-section')
    expect(levels).toMatchObject({ floors: [0, 3.06], eaves: 4.67, topDatum: 7.95, measured: true })
  })

  it('a deep negative level is a basement, not terrain', () => {
    const levels = levelsFrom(withDatums([-2.6, 0, 2.8, 5.1]), 'frame-section')
    expect(levels.floors).toEqual([-2.6, 0])
  })

  it('terrain alone states no storey', () => {
    expect(levelsFrom(withDatums([-0.32]), 'frame-section').measured).toBe(false)
  })
})

// E13 (Zefiranty G2: ±0,00, +2,42 over the garage, +2,93 over the house, +8,55): a split level is one storey
describe('a split level on the section', () => {
  const placedDatum = (value: number, i: number, x: number, row: number): MetricEvidence => ({ ...datum(value, i), measuredGeometry: { type: 'SEGMENT', a: { x: x - 1, y: row }, b: { x: x + 1, y: row } } }) as MetricEvidence
  const at = (marks: Array<[number, number, number]>): MetricEvidenceSet => ({ ...metricsOf([], []), evidence: marks.map(([v, x, row], i) => placedDatum(v, i, x, row)) })
  const zef: Array<[number, number, number]> = [[-0.47, 382, 204], [0, 268, 197], [2.42, 94, 157], [2.93, 257, 150], [8.55, 203, 54]]
  const slabUnder = (slabs: number[]) => (datums: Array<{ value: number }>) => {
    const top = Math.max(...datums.map((d) => d.value))
    return { belowDrawnRoof: false, onSlab: slabs.some((s) => Math.abs(s - top) < 1e-6), why: 'a fixture' }
  }
  it('two upper floor marks within 1.2 m, the higher over a slab: one storey, the main body\'s floor nearer the ridge mark, neither the eaves', () => {
    const l = levelsFrom(at(zef), 'frame-section', slabUnder([2.93]), 2)
    expect(l.floors).toEqual([0, 2.93])
    expect(l.eaves).toBeUndefined()
    expect(l.topDatum).toBe(8.55)
    expect(l.splitLevel?.other).toBe(2.42)
  })
  it('mirrored on the sheet: the lower mark nearer the ridge is the main body\'s', () => {
    const mirrored = zef.map(([v, x, row]) => [v, v === 2.42 ? 210 : v === 2.93 ? 380 : x, row] as [number, number, number])
    expect(levelsFrom(at(mirrored), 'frame-section', slabUnder([2.93]), 2).floors).toEqual([0, 2.42])
  })
  it('without a ±0,00 read, the slab test still sees the building: its zero row comes from the other marks\' ladder', () => {
    const noZero = zef.filter(([v]) => v !== 0)
    let seen: Array<{ value: number; row: number }> = []
    const l = levelsFrom(at(noZero), 'frame-section', (datums) => {
      seen = datums
      return slabUnder([2.93])(datums)
    }, 2)
    expect(l.floors).toEqual([0, 2.93])
    expect(seen.some((d) => d.value === 0 && Math.abs(d.row - 197) < 4)).toBe(true)
  })
  it('a single upper floor mark below the ridge, over a slab (the eaves mark unread): a floor, not the eaves', () => {
    const goz: Array<[number, number, number]> = [[-0.32, 50, 660], [0, 800, 641], [2.96, 790, 453], [8.36, 680, 104]]
    const l = levelsFrom(at(goz), 'frame-section', slabUnder([2.96]), 2)
    expect(l.floors).toEqual([0, 2.96])
    expect(l.eaves).toBeUndefined()
    // counter: the same mark not over a slab is the eaves
    expect(levelsFrom(at(goz), 'frame-section', slabUnder([]), 2).eaves).toBe(2.96)
  })
  it('counter: a slab under the roof where the plans show no storey on it — a bungalow\'s ceiling, an upper storey\'s — is the walls\' head, never a storey', () => {
    const bungalow: Array<[number, number, number]> = [[-0.32, 50, 660], [0, 800, 641], [2.96, 790, 453], [8.36, 680, 104]]
    const one = levelsFrom(at(bungalow), 'frame-section', slabUnder([2.96]), 1)
    expect(one.floors).toEqual([0])
    expect(one.eaves).toBe(2.96)
    const twoStorey: Array<[number, number, number]> = [[0, 800, 641], [2.75, 790, 470], [5.4, 790, 300], [8.9, 680, 80]]
    const two = levelsFrom(at(twoStorey), 'frame-section', slabUnder([5.4]), 2)
    expect(two.floors).toEqual([0, 2.75])
    expect(two.eaves).toBe(5.4)
    // and without the plans' count nothing is promoted
    expect(levelsFrom(at(bungalow), 'frame-section', slabUnder([2.96])).eaves).toBe(2.96)
  })
  it('counter: the mark below the ridge not on a slab is the eaves, as before', () => {
    const l = levelsFrom(at(zef), 'frame-section', slabUnder([]), 2)
    expect(l.eaves).toBe(2.93)
    expect(l.floors).toEqual([0, 2.42])
    expect(l.splitLevel).toBeUndefined()
  })
  it('counter: two marks further apart than 1.2 m are a floor and the eaves; without a section raster nothing changes', () => {
    const apart: Array<[number, number, number]> = [[0, 268, 197], [2.8, 94, 150], [4.3, 257, 120], [8.55, 203, 54]]
    expect(levelsFrom(at(apart), 'frame-section', slabUnder([])).eaves).toBe(4.3)
    expect(levelsFrom(at(apart), 'frame-section', slabUnder([])).splitLevel).toBeUndefined()
    expect(levelsFrom(at(zef), 'frame-section').eaves).toBe(2.93)
  })
})
