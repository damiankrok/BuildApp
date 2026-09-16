/**
 * §21: the audit is only worth having if it fires.
 *
 * Every test here takes a package whose elevations are real bytes, hands the
 * audit a massing that is WRONG in one specific way, and asks whether it says
 * so. A gate that passes everything is a gate that was never shut.
 */
import { describe, expect, it } from 'vitest'
import { auditStructuralProjection, rectangleRing } from '../src/index.js'
import type { MassHypothesis, RoofSupportHypothesis, StoreyLayoutHypothesis } from '../src/index.js'
import { HOLLOWAY } from '@buildapp/synthetic-drawings'
import { buildFixture, solve } from './pipeline.js'

const fixture = await buildFixture(HOLLOWAY)
const truth = solve(fixture)

const quantity = (value: number): NonNullable<RoofSupportHypothesis['eaveLevelM']> => ({ value, low: value - 0.05, high: value + 0.05, unit: 'm', basis: 'MEASURED', evidenceIds: [], why: 'the fixture states it' })

const mass = (id: string, x0: number, z0: number, x1: number, z1: number, storeys: [number, number]): MassHypothesis => ({
  id,
  role: 'MAIN',
  ring: rectangleRing(x0, z0, x1, z1),
  footprintRegionIds: [`footprint-${id}`],
  storeySpan: { fromIndex: storeys[0], toIndex: storeys[1], storeyIds: ['storey-0'] },
  facadePlaneIds: [],
  widthM: quantity(x1 - x0),
  depthM: quantity(z1 - z0),
  observationIds: [],
  evidenceIds: [],
  confidence: 0.9,
  why: 'a body this test made up',
})

const roof = (massId: string, kind: RoofSupportHypothesis['kind'], eaves: number, ridge: number, ridgeAxis?: 'X' | 'Z'): RoofSupportHypothesis => ({
  id: `roof-${massId}`,
  massId,
  kind,
  ring: rectangleRing(0, 0, 1, 1),
  ridgeAxis,
  eaveLevelM: quantity(eaves),
  ridgeLevelM: quantity(ridge),
  overhangM: quantity(0),
  adjacentRoofIds: [],
  authority: 'SECTION',
  observationIds: [],
  evidenceIds: [],
  confidence: 0.8,
  why: 'a roof this test made up',
})

const storeys: StoreyLayoutHypothesis[] = [
  { id: 'storey-0', index: 0, frameIds: [], footprintRegionIds: [], confidence: 0.9, why: 'the ground', elevation: quantity(0), height: quantity(2.7) },
  { id: 'storey-1', index: 1, frameIds: [], footprintRegionIds: [], confidence: 0.9, why: 'the upper', elevation: quantity(2.7), height: quantity(2.55) },
]

const codes = (result: ReturnType<typeof auditStructuralProjection>): string[] => result.reasons.map((r) => `${r.severity}:${r.code}`)

const garage = HOLLOWAY.wings![0]
const ridgeLevel = truth.layout.roofSupports.find((r) => r.massId === 'mass-0')!.ridgeLevelM!.value
const eaveLevel = truth.layout.roofSupports.find((r) => r.massId === 'mass-0')!.eaveLevelM!.value
const garageTop = truth.layout.roofSupports.find((r) => r.massId === 'mass-1')!.eaveLevelM!.value

describe('drawing the massing against the elevations it came from', () => {
  it('passes the composition the pipeline actually found', () => {
    const audit = auditStructuralProjection({ graph: fixture.graph, masses: truth.layout.masses, roofs: truth.layout.roofSupports, storeys: truth.layout.storeys })
    expect(audit.views.length).toBe(4)
    expect(codes(audit)).toContain('NOTED:STRUCTURE_PROJECTS')
    expect(audit.worstResidualM).toBeLessThan(0.2)
    expect(audit.steps).toBe(2)
  })

  it('refuses the one-box reading of a building that has a garage', () => {
    // The failure this whole stage exists to end: one mass over the bounding
    // rectangle, one roof over all of it.
    const box = mass('one-box', 0, 0, HOLLOWAY.width + garage.width, HOLLOWAY.depth, [0, 1])
    const audit = auditStructuralProjection({ graph: fixture.graph, masses: [box], roofs: [roof('one-box', 'GABLE', eaveLevel, ridgeLevel, 'Z')], storeys })
    expect(codes(audit).filter((c) => c.includes('STRUCTURE_SILHOUETTE_DISAGREES')).length).toBeGreaterThan(0)
    expect(audit.worstResidualM).toBeGreaterThan(2)
    expect(audit.steps).toBe(1)
  })

  it('refuses two bodies drawn at the same height', () => {
    // §23's recognizability, as a shape rather than a picture: two bodies that
    // stand at one height read as one body, whatever the plan says.
    const masses = [mass('house', 0, 0, HOLLOWAY.width, HOLLOWAY.depth, [0, 1]), mass('garage', HOLLOWAY.width, garage.offsetZ, HOLLOWAY.width + garage.width, garage.offsetZ + garage.depth, [0, 0])]
    const audit = auditStructuralProjection({
      graph: fixture.graph,
      masses,
      roofs: [roof('house', 'GABLE', eaveLevel, ridgeLevel, 'Z'), roof('garage', 'FLAT', ridgeLevel, ridgeLevel)],
      storeys,
    })
    expect(codes(audit)).toContain('DEGRADING:STRUCTURE_READS_AS_ONE_BLOCK')
    expect(audit.steps).toBe(1)
  })

  it('refuses a garage put on the wrong side of the house', () => {
    const masses = [mass('house', garage.width, 0, garage.width + HOLLOWAY.width, HOLLOWAY.depth, [0, 1]), mass('garage', 0, garage.offsetZ, garage.width, garage.offsetZ + garage.depth, [0, 0])]
    const audit = auditStructuralProjection({
      graph: fixture.graph,
      masses,
      roofs: [roof('house', 'GABLE', eaveLevel, ridgeLevel, 'Z'), roof('garage', 'FLAT', garageTop, garageTop)],
      storeys,
    })
    expect(codes(audit).filter((c) => c.includes('STRUCTURE_SILHOUETTE_DISAGREES')).length).toBeGreaterThan(0)
    expect(audit.worstResidualM).toBeGreaterThan(2)
  })

  it('refuses a ridge run the wrong way', () => {
    // A gable seen end on is a triangle and seen along its length is a
    // rectangle. Swap the two and every elevation disagrees.
    const audit = auditStructuralProjection({
      graph: fixture.graph,
      masses: truth.layout.masses,
      roofs: truth.layout.roofSupports.map((r) => (r.massId === 'mass-0' ? { ...r, ridgeAxis: r.ridgeAxis === 'X' ? ('Z' as const) : ('X' as const) } : r)),
      storeys: truth.layout.storeys,
    })
    expect(codes(audit).filter((c) => c.includes('STRUCTURE_SILHOUETTE_DISAGREES')).length).toBeGreaterThan(0)
    expect(audit.worstResidualM).toBeGreaterThan(1)
  })

  it('says so rather than passing when there is nothing to draw against', () => {
    const audit = auditStructuralProjection({ graph: { ...fixture.graph, coordinateFrames: [], observations: [] }, masses: truth.layout.masses, roofs: truth.layout.roofSupports, storeys: truth.layout.storeys })
    expect(codes(audit)).toContain('NOTED:STRUCTURE_NOT_PROJECTED')
    expect(audit.views).toHaveLength(0)
  })

  it('and blocks outright when there is no massing at all', () => {
    const audit = auditStructuralProjection({ graph: fixture.graph, masses: [], roofs: [], storeys })
    expect(codes(audit)).toContain('BLOCKING:STRUCTURE_NOT_PROJECTED')
  })
})
