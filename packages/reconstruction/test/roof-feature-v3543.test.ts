import { describe, expect, it } from 'vitest'
import { ROOF_FEATURE_BOUNDS, applyRoofFeatures, sideExtent } from '../src/v2/roof-feature.js'
import type { RoofFeatureCorrection } from '../src/v2/roof-feature.js'
import type { BuildingV2 } from '../src/v2/building.js'

// v3.54.3: the consumer of a ROOF_FEATURE correction, on SYNTHETIC buildings written for the test (no project's data).
const TAN40 = Math.tan((40 * Math.PI) / 180)
/** A 12 × 8 m house, ridge along x at z = 4, eaves at y = 4: the FRONT is the face at z = 0. */
function house(over: Partial<BuildingV2> = {}): BuildingV2 {
  return {
    label: 'synthetic',
    wallThicknessM: 0.4,
    slabThicknessM: 0.3,
    levels: [],
    masses: [{ id: 'main', role: 'MAIN', x0: 0, z0: 0, x1: 12, z1: 8, storeys: [0, 1], featureId: 'body-main', sourceMassId: 'm0' }],
    mainRoof: { massId: 'main', kind: 'GABLE', pitchDeg: 40, ridgeAxis: 'X', ridgeAt: 4, eaveY: 4, ridgeY: 4 + 4 * TAN40, footprint: { x0: 0, z0: 0, x1: 12, z1: 8 }, coversZones: false, coversZonesWhy: 'no zone', buildUpVerticalM: 0, thicknessM: 0.28, authority: 'PUBLISHED_SPECIFICATION', featureId: 'roof-main', provenance: 'SOURCE_DERIVED' },
    attachedRoofs: [],
    pitchedAttachedRoofs: [],
    recesses: [],
    returns: [],
    balconies: [],
    railings: [],
    portalHeads: [],
    verges: [],
    terraces: [],
    massTones: [],
    returnTones: [],
    facadeGraph: {} as BuildingV2['facadeGraph'],
    chimneys: [],
    rooflights: [],
    openings: [],
    sharedDoors: [],
    interior: [],
    assemblies: [],
    surfaceRegions: [],
    ...over,
  }
}
const dormer = (over: Partial<RoofFeatureCorrection> = {}): RoofFeatureCorrection => ({ id: 'dormer-front-c50', proposalId: 'p1', kind: 'GABLE_DORMER', side: 'FRONT', fromShare: 0.4, toShare: 0.6, eaveShare: 0.3, ridgeShare: 0.7, front: 'SET_BACK', glazed: true, why: 'synthetic', ...over })

describe('v3.54.3 roof feature: a dormer the model\'s own rule lays out, from shares of a side', () => {
  it('builds a gable dormer on the front slope: the main gable is restated as its two planes, the dormer stands in LOW', () => {
    const b = house()
    const r = applyRoofFeatures(b, [dormer()])
    expect(r.outcomes[0]).toMatchObject({ status: 'APPLIED', id: 'dormer-front-c50' })
    expect(r.building.mainRoof).toBeUndefined()
    expect(r.building.planeRoofs?.[0].layout.planes.map((p) => p.key).sort()).toEqual(['HIGH', 'LOW'])
    // the same roof: eaves and ridge where the gable had them
    expect(r.building.planeRoofs?.[0]).toMatchObject({ eaveY: 4, ridgeAxis: 'X', pitchDeg: 40 })
    expect(r.building.planeRoofs?.[0].ridgeY).toBeCloseTo(4 + 4 * TAN40, 5)
    const d = r.building.dormers?.[0]
    expect(d).toMatchObject({ id: 'dormer-front-c50', massId: 'main', planeKey: 'LOW', type: 'GABLE', provenance: 'VISUAL_SEMANTIC' })
    expect([d?.front.start.x, d?.front.end.x].sort((a, b) => (a as number) - (b as number))).toEqual([4.8, 7.2])
    expect(d?.eaveY).toBeCloseTo(4 + 0.3 * 4 * TAN40, 5)
    expect(d?.ridgeY).toBeCloseTo(4 + 0.7 * 4 * TAN40, 5)
    // the input is not mutated: a refused candidate leaves the model before as it was
    expect(b.mainRoof).toBeDefined()
    expect(b.dormers).toBeUndefined()
  })
  it('reads shares left to right AS THE SIDE IS SEEN: the rear runs against x, the right along z', () => {
    expect(sideExtent(house(), 'FRONT')).toEqual({ from: 0, to: 12 })
    expect(sideExtent(house(), 'REAR')).toEqual({ from: 12, to: 0 })
    // the wall under the roof's eaves is the host body's: a bay or a garage beside it does not stretch the side
    const withBay = house({ masses: [...house().masses, { id: 'bay', role: 'ATTACHED', x0: -0.9, z0: 2, x1: 0, z1: 5, storeys: [0], featureId: 'body-bay', sourceMassId: 'm1' }] })
    expect(sideExtent(withBay, 'FRONT', 'main')).toEqual({ from: 0, to: 12 })
    const r = applyRoofFeatures(house(), [dormer({ id: 'dormer-rear-c20', side: 'REAR', fromShare: 0.1, toShare: 0.3 })])
    const d = r.building.dormers?.[0]
    expect(d?.planeKey).toBe('HIGH')
    expect([d?.front.start.x, d?.front.end.x].sort((a, b) => (a as number) - (b as number))).toEqual([8.4, 10.8])
  })
  it('a flush front stands directly behind the storey\'s own wall, and says so (two walls never share a place)', () => {
    const r = applyRoofFeatures(house(), [dormer({ front: 'FLUSH' })])
    const d = r.building.dormers?.[0]
    expect(d?.front.start.z).toBeCloseTo(0.4 + ROOF_FEATURE_BOUNDS.flushInsetM, 6)
    expect(r.outcomes[0].built?.adjustments.join(' ')).toMatch(/behind the facade/)
  })
  it('counter-trials: each refusal is typed and leaves the building untouched', () => {
    const b = house()
    const code = (c: RoofFeatureCorrection, on: BuildingV2 = b): string | undefined => {
      const r = applyRoofFeatures(on, [c])
      expect(r.building).toBe(on)
      return r.outcomes[0].code
    }
    // a plain gable end is the gable itself, not a feature on a slope
    expect(code(dormer({ side: 'LEFT' }))).toBe('GABLE_END_SIDE')
    expect(code(dormer({ side: 'RIGHT' }))).toBe('GABLE_END_SIDE')
    // most of the eaves is the roof (a storey, a cross wing); a sliver is a vent
    expect(code(dormer({ fromShare: 0.1, toShare: 0.9 }))).toBe('OUT_OF_RANGE')
    expect(code(dormer({ fromShare: 0.5, toShare: 0.53 }))).toBe('OUT_OF_RANGE')
    // off the roof's end, eaves below the roof's, a ridge under its own eaves
    expect(code(dormer({ fromShare: -0.3, toShare: -0.1 }))).toBe('OUT_OF_RANGE')
    expect(code(dormer({ eaveShare: 0 }))).toBe('OUT_OF_RANGE')
    expect(code(dormer({ ridgeShare: 0.31 }))).toBe('OUT_OF_RANGE')
    // slopes no gable dormer has: a "dormer" 5 m wide rising 0.3 m
    expect(code(dormer({ fromShare: 0.3, toShare: 0.7, eaveShare: 0.3, ridgeShare: 0.36 }))).toBe('OUT_OF_RANGE')
    // a flat-roofed house holds no dormer
    expect(code(dormer(), house({ mainRoof: undefined }))).toBe('NO_PITCHED_HOST')
    // something bound to the gable as a gable: the limit of the representation, named
    expect(code(dormer(), house({ verges: [{}] as BuildingV2['verges'] }))).toBe('REPRESENTATION_LIMIT')
    // where a chimney already cuts the roof, neither reading is set aside here
    expect(code(dormer(), house({ chimneys: [{ id: 'chimney-0', x0: 5.5, x1: 6.1, z0: 1.2, z1: 1.8, featureId: 'c', provenance: 'SOURCE_DERIVED' }] as BuildingV2['chimneys'] }))).toBe('OVERLAPS')
  })
  it('is idempotent by id: the same correction twice builds one dormer', () => {
    const r = applyRoofFeatures(house(), [dormer(), dormer({ proposalId: 'p2' })])
    expect(r.outcomes.map((o) => o.status)).toEqual(['APPLIED', 'REFUSED'])
    expect(r.outcomes[1].code).toBe('DUPLICATE')
    expect(r.building.dormers).toHaveLength(1)
  })
  it('keeps a ridge under the host\'s and says what it moved; shed and flat dormers need no ridge', () => {
    const r = applyRoofFeatures(house(), [dormer({ ridgeShare: 1.05 })])
    expect(r.outcomes[0].status).toBe('APPLIED')
    expect(r.building.dormers?.[0].ridgeY).toBeCloseTo(4 + 4 * TAN40 - ROOF_FEATURE_BOUNDS.ridgeClearM, 5)
    expect(r.outcomes[0].built?.adjustments.join(' ')).toMatch(/ridge lowered/)
    const shed = applyRoofFeatures(house(), [dormer({ id: 'dormer-front-c50', kind: 'SHED_DORMER', ridgeShare: undefined })])
    expect(shed.building.dormers?.[0]).toMatchObject({ type: 'SHED' })
    expect(shed.building.dormers?.[0].shedPitchDeg).toBeLessThan(40)
  })
})
