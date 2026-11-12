/**
 * v3.53.8 — what a delivered model may be measured for, kept apart from whether the run finished (`measurementOf`).
 *
 * A run that delivers a model is COMPLETED whatever it covers; coverage against the published footprint, the built scale
 * against the plan's own printed dimensions, and what follows for quantities are separate answers, each with a reason
 * and a consequence when it is not plainly usable. Numbers in, a record out: every figure here is invented.
 */
import { describe, expect, it } from 'vitest'
import { MEASUREMENT_SCHEMA_VERSION, SCALE_AGREES, measurementOf, measurementOfReconstruction } from '../src/index.js'

const strong = (cmPerPixelX: number) => ({ cmPerPixelX, confidence: 'STRONG' })

describe('v3.53.8: the measurement record', () => {
  it('a whole house at its printed scale: COMPLETED, MATCHES, MEASURED, usable in scope, no reasons', () => {
    const m = measurementOf({ builtM2: 120.4, publishedFootprintM2: 121, builtMetresPerPixel: 0.0201, metric: strong(2.0), completeness: 'COMPLETE' })
    expect(m.schemaVersion).toBe(MEASUREMENT_SCHEMA_VERSION)
    expect(m.run).toBe('COMPLETED')
    expect([m.coverage.status, m.scale.status, m.quantities]).toEqual(['MATCHES', 'MEASURED', 'USABLE_IN_SCOPE'])
    expect(m.reasons).toEqual([])
  })

  it('a model short of the published footprint is still a COMPLETED run, but its quantities are LIMITED and the record says why', () => {
    const m = measurementOf({ builtM2: 175.35, publishedFootprintM2: 255.91, builtMetresPerPixel: 0.0205, metric: strong(2.0), completeness: 'PARTIAL' })
    expect(m.run).toBe('COMPLETED')
    expect(m.coverage.status).toBe('SHORT')
    expect(m.coverage.share).toBeCloseTo(0.685202, 6)
    expect(m.quantities).toBe('LIMITED')
    expect(m.reasons.map((r) => r.code)).toEqual(['COVERAGE_SHORT', 'READING_PARTIAL'])
    expect(m.reasons[0].consequence).toMatch(/cover only the part that was read/)
  })

  it('a scale that departs from the printed dimensions makes quantities NOT_USABLE, whatever the coverage, and names the error', () => {
    // a model at 6.54 cm/px over a plan whose printed dimensions measure 5.14 cm/px: lengths 27 % long, areas 62 % large
    const m = measurementOf({ builtM2: 105, publishedFootprintM2: 99.16, builtMetresPerPixel: 0.0654, metric: strong(5.138), completeness: 'COMPLETE' })
    expect([m.coverage.status, m.scale.status, m.quantities]).toEqual(['MATCHES', 'DEPARTS', 'NOT_USABLE'])
    expect(m.scale.ratio).toBeCloseTo(1.272869, 5)
    expect(m.reasons[0]).toEqual({ code: 'SCALE_DEPARTS', consequence: expect.stringMatching(/27 % long and every area 62 % large/) })
  })

  it(`the scale agrees within ${SCALE_AGREES * 100} %: 2.5 % off is the same scale, 3.5 % off is not`, () => {
    expect(measurementOf({ builtM2: 100, publishedFootprintM2: 100, builtMetresPerPixel: 0.0205, metric: strong(2.0), completeness: 'COMPLETE' }).scale.status).toBe('MEASURED')
    expect(measurementOf({ builtM2: 100, publishedFootprintM2: 100, builtMetresPerPixel: 0.0207, metric: strong(2.0), completeness: 'COMPLETE' }).scale.status).toBe('DEPARTS')
  })

  it('weak metric evidence leaves the scale UNVERIFIED and the quantities LIMITED — never presented as measured', () => {
    const m = measurementOf({ builtM2: 181.7, publishedFootprintM2: 191.79, builtMetresPerPixel: 0.02, metric: { cmPerPixelX: 2.1, confidence: 'WEAK' }, completeness: 'COMPLETE' })
    expect([m.scale.status, m.scale.ratio, m.quantities]).toEqual(['UNVERIFIED', null, 'LIMITED'])
    expect(m.reasons.map((r) => r.code)).toEqual(['SCALE_UNVERIFIED'])
  })

  it('counter-case: no printed footprint and no metric evidence — nothing is inferred, both are NOT_ASSESSED', () => {
    const m = measurementOf({ builtM2: 90, completeness: 'COMPLETE' })
    expect([m.coverage.status, m.coverage.publishedM2, m.coverage.share, m.scale.status, m.quantities]).toEqual(['NOT_ASSESSED', null, null, 'NOT_ASSESSED', 'NOT_ASSESSED'])
  })

  it('counter-case: one figure there and the other missing is LIMITED, with the missing one named', () => {
    const m = measurementOf({ builtM2: 120, publishedFootprintM2: 121, completeness: 'COMPLETE' })
    expect(m.quantities).toBe('LIMITED')
    expect(m.reasons.map((r) => r.code)).toEqual(['SCALE_NOT_ASSESSED'])
  })

  it('serialises to plain JSON and back unchanged', () => {
    const m = measurementOf({ builtM2: 175.35, publishedFootprintM2: 255.91, builtMetresPerPixel: 0.0205, metric: strong(2.0), completeness: 'PARTIAL' })
    expect(JSON.parse(JSON.stringify(m))).toEqual(m)
  })

  it('of a reconstruction: the lowest storey’s own bodies only — technical pieces and upper storeys are not counted twice', () => {
    const r = {
      building: {
        masses: [
          { storeys: [0, 1], x0: 0, z0: 0, x1: 10, z1: 8 },
          { storeys: [0], x0: 10, z0: 2, x1: 14, z1: 8 },
          { storeys: [0], x0: 10, z0: 2, x1: 12, z1: 8, pieceOf: 'attached-0' },
          { storeys: [1], x0: 0, z0: 0, x1: 10, z1: 4 },
        ],
      },
      planDiagnostics: { selectedPlanFrameId: 'p0', plans: [{ frameId: 'p0', scale: { mppX: 0.02 }, metric: { cmPerPixelX: 2, confidence: 'STRONG' } }] },
    }
    const m = measurementOfReconstruction(r, [{ key: 'footprint_area', unit: 'm2', value: 104 }], 'COMPLETE')
    expect(m.coverage.builtM2).toBe(104)
    expect([m.coverage.status, m.scale.status, m.quantities]).toEqual(['MATCHES', 'MEASURED', 'USABLE_IN_SCOPE'])
  })
})
