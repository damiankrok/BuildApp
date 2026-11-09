/**
 * v3.51 C2: one admission policy for a later correction of an opening's sill/head — the same proposal for the same
 * opening meets the same answer from the facade alignment and from the residual repair; a door stays on its own access
 * surface (its floor, a step, a split-level floor — never the building's ±0,00); and the final feature record tells the
 * accepted decision from what the program applied.
 */
import { describe, expect, it } from 'vitest'
import { admitHeightCorrections } from '../src/v2/opening-correction.js'
import type { CorrectionSubject } from '../src/v2/opening-correction.js'
import { repairFromResiduals } from '../src/v2/verify.js'
import type { SourceViewResidual } from '../src/v2/verify.js'
import type { BuildingV2 } from '../src/v2/building.js'
import { finalOpeningRecord } from '../src/v2/opening-final.js'

const subject = (over: Partial<CorrectionSubject> = {}): CorrectionSubject => ({ family: 'DOOR', sillY: 0, headY: 2.1, provenance: { sill: 'ASSUMED_FOR_RENDERING', head: 'ASSUMED_FOR_RENDERING' }, accessY: 0, wallTopY: 2.8, ...over })

describe('C2: the admission policy', () => {
  it('a door on its own floor is not lifted to a sill a scan read at 0.70 m', () => {
    expect(admitHeightCorrections(subject(), { sill: 0.7 }).sill).toEqual({ admitted: false, refusal: 'DOOR_OFF_ITS_ACCESS' })
  })
  it('an upper-storey door: its floor is its storey\'s (+3.06), not ±0,00 — 3.06 stands, 3.76 is refused, 0 is below its floor', () => {
    const o = subject({ sillY: 3.06, headY: 5.16, accessY: 3.06, wallTopY: 5.8 })
    expect(admitHeightCorrections(o, { sill: 3.76 }).sill).toEqual({ admitted: false, refusal: 'DOOR_OFF_ITS_ACCESS' })
    expect(admitHeightCorrections({ ...o, sillY: 3.3 }, { sill: 3.06 }).sill).toEqual({ admitted: true })
    expect(admitHeightCorrections(o, { sill: 2.5 }).sill).toEqual({ admitted: false, refusal: 'BELOW_ITS_FLOOR' })
  })
  it('a door on a source-supported step (access 0.15 m above the floor) keeps the step: 0.15 admitted, not forced to 0', () => {
    const o = subject({ sillY: 0, accessY: 0.15 })
    expect(admitHeightCorrections(o, { sill: 0.15 }).sill).toEqual({ admitted: true })
    expect(admitHeightCorrections({ ...o, sillY: 0.15 }, { sill: 0 }).sill).toEqual({ admitted: false, refusal: 'BELOW_ITS_FLOOR' })
  })
  it('a split level: the door of the lower part stands on that part\'s floor (2.42), under the storey\'s 2.93', () => {
    const o = subject({ sillY: 2.93, headY: 5.03, accessY: 2.42, wallTopY: 5.6 })
    expect(admitHeightCorrections(o, { sill: 2.42 }).sill).toEqual({ admitted: true })
    expect(admitHeightCorrections(o, { sill: 3.2 }).sill).toEqual({ admitted: false, refusal: 'DOOR_OFF_ITS_ACCESS' })
  })
  it('opposite: an ordinary window\'s assumed sill may move to what the view reads', () => {
    expect(admitHeightCorrections(subject({ family: 'WINDOW', sillY: 0.9, headY: 2.2 }), { sill: 0.7 }).sill).toEqual({ admitted: true })
  })
  it('a printed value, a printed height and a value already read stand', () => {
    expect(admitHeightCorrections(subject({ family: 'WINDOW', sillY: 0.9, provenance: { sill: 'SOURCE_EXACT', head: 'ASSUMED_FOR_RENDERING' } }), { sill: 0.7 }).sill).toEqual({ admitted: false, refusal: 'PRINTED_VALUE_STANDS' })
    expect(admitHeightCorrections(subject({ family: 'WINDOW', sillY: 0.9, provenance: { sill: 'ASSUMED_FOR_RENDERING', head: 'SOURCE_EXACT' } }), { sill: 0.7 }).sill).toEqual({ admitted: false, refusal: 'PRINTED_HEIGHT_STANDS' })
    expect(admitHeightCorrections(subject({ family: 'WINDOW', sillY: 0.9, provenance: { sill: 'IMAGE_METRIC_REGISTERED', head: 'ASSUMED_FOR_RENDERING' } }), { sill: 0.7 }).sill).toEqual({ admitted: false, refusal: 'ALREADY_READ' })
  })
  it('what the rules leave must fit the wall together, or nothing is applied', () => {
    const w = subject({ family: 'WINDOW', sillY: 0.9, headY: 2.2 })
    expect(admitHeightCorrections(w, { sill: 1.0, head: 2.9 })).toEqual({ sill: { admitted: false, refusal: 'DOES_NOT_FIT_WALL' }, head: { admitted: false, refusal: 'DOES_NOT_FIT_WALL' } })
    expect(admitHeightCorrections(w, { sill: 1.0, head: 2.4 })).toEqual({ sill: { admitted: true }, head: { admitted: true } })
  })
})

describe('C2: the residual repair meets the same policy', () => {
  const building = (openings: unknown[]): BuildingV2 => ({ levels: [{ index: 0, id: 'lvl-0', elevation: 0, height: 2.8, wallTop: 2.8, featureId: 'f0' }, { index: 1, id: 'lvl-1', elevation: 3.06, height: 2.8, wallTop: 5.86, featureId: 'f1' }], openings }) as unknown as BuildingV2
  const opening = (over: Record<string, unknown>) => ({ id: 'o1', storeyIndex: 0, family: 'DOOR', sillY: 0, headY: 2.1, provenance: { sill: 'ASSUMED_FOR_RENDERING', head: 'ASSUMED_FOR_RENDERING' }, unresolved: [], profile: 'LEVEL', ...over })
  const residual = (kind: 'OPENING_SILL' | 'OPENING_HEAD', modelM: number, observedM: number): SourceViewResidual => ({ featureId: 'o1', objectId: 'o1', frameId: 'f', kind, modelM, observedM, residualM: modelM - observedM, toleranceM: 0.1, withinTolerance: false, why: 'a fixture' }) as SourceViewResidual
  it('the same candidate the alignment refuses is refused here, by the same code', () => {
    const o = opening({})
    const policy = admitHeightCorrections({ family: 'DOOR', sillY: 0, headY: 2.1, provenance: { sill: 'ASSUMED_FOR_RENDERING', head: 'ASSUMED_FOR_RENDERING' }, accessY: 0, wallTopY: 2.8 }, { sill: 0.7 }).sill
    const t = repairFromResiduals(building([o]), [residual('OPENING_SILL', 0, 0.7)], 1)
    expect(policy).toEqual({ admitted: false, refusal: 'DOOR_OFF_ITS_ACCESS' })
    expect(t.iterations[0].refused.map((r) => r.code)).toEqual(['DOOR_OFF_ITS_ACCESS'])
    expect(o.sillY).toBe(0)
  })
  it('an upper-storey window\'s sill is never clamped to the building\'s ±0,00: a reading under its own floor is refused', () => {
    const o = opening({ storeyIndex: 1, family: 'WINDOW', sillY: 3.96, headY: 5.26 })
    const t = repairFromResiduals(building([o]), [residual('OPENING_SILL', 3.96, 2.9)], 1)
    expect(t.iterations[0].refused.map((r) => r.code)).toEqual(['BELOW_ITS_FLOOR'])
    expect(o.sillY).toBe(3.96)
  })
  it('opposite: an ordinary window\'s assumed sill is repaired to the view\'s reading', () => {
    const o = opening({ family: 'WINDOW', sillY: 0.9, headY: 2.2 })
    repairFromResiduals(building([o]), [residual('OPENING_SILL', 0.9, 0.7)], 1)
    expect(o.sillY).toBe(0.7)
    expect(o.provenance.sill).toBe('IMAGE_METRIC_REGISTERED')
  })
  it('the wording of a note changes nothing: the same repair with every note reworded', () => {
    const a = opening({ family: 'WINDOW', sillY: 0.9, headY: 2.2, unresolved: ['sill and head assumed'] })
    const b = opening({ family: 'WINDOW', sillY: 0.9, headY: 2.2, unresolved: ['parapet i nadproże przyjęte umownie'] })
    repairFromResiduals(building([a]), [residual('OPENING_SILL', 0.9, 0.7)], 1)
    repairFromResiduals(building([b]), [residual('OPENING_SILL', 0.9, 0.7)], 1)
    expect([a.sillY, a.headY, a.family, a.provenance]).toEqual([b.sillY, b.headY, b.family, b.provenance])
  })
})

describe('C2 composition: accepted → corrected later → emitted/fitted/refused → the final record', () => {
  const accepted = { id: 'o1', interval: [2, 3.2] as [number, number], widthM: 1.2, sillY: 0.9, headY: 2.2, family: 'WINDOW', uncertaintyM: 0.05, provenance: { width: 'SOURCE_EXACT' as const, sill: 'ASSUMED_FOR_RENDERING' as const, head: 'ASSUMED_FOR_RENDERING' as const, profile: 'SOURCE_DERIVED' as const, family: 'SOURCE_DERIVED' as const } }
  it('a sill repaired after the feature was first written is what the final record holds, with its new provenance', () => {
    const later = { ...accepted, sillY: 0.7, provenance: { ...accepted.provenance, sill: 'IMAGE_METRIC_REGISTERED' as const } }
    const r = finalOpeningRecord(later, 0, { kind: 'WINDOW', sill: 0.7, width: 1.2, height: 1.5 }, undefined)
    expect(r.parameters.sillY.value).toBe(0.7)
    expect(r.parameterProvenance.sillY).toBe('IMAGE_METRIC_REGISTERED')
    expect(r.application).toEqual({ state: 'AS_ACCEPTED', acceptedKind: 'WINDOW', applied: { width: 1.2, sillY: 0.7, headY: 2.2, kind: 'WINDOW' } })
  })
  it('a width the host wall could not hold: the accepted (printed) width stays, the applied one is beside it with the reason\'s code', () => {
    const r = finalOpeningRecord(accepted, 0, { kind: 'WINDOW', sill: 0.9, width: 1.0, height: 1.3 }, { action: 'SHRUNK', code: 'OPENING_OUT_OF_WALL' })
    expect(r.parameters.width.value).toBe(1.2)
    expect(r.parameterProvenance.width).toBe('SOURCE_EXACT')
    expect(r.application).toEqual({ state: 'FITTED', acceptedKind: 'WINDOW', reasonCode: 'OPENING_OUT_OF_WALL', applied: { width: 1, sillY: 0.9, headY: 2.2, kind: 'WINDOW' } })
  })
  it('an opening the program does not build is NOT_BUILT, its accepted decision kept', () => {
    const r = finalOpeningRecord(accepted, 0, undefined, { action: 'DROPPED', code: 'OPENING_OVERLAP' })
    expect(r.application).toEqual({ state: 'NOT_BUILT', acceptedKind: 'WINDOW', reasonCode: 'OPENING_OVERLAP' })
    expect(r.parameters.width.value).toBe(1.2)
  })
  it('an upper storey: the applied values are in the building\'s frame (level elevation + the cut\'s own sill)', () => {
    const up = { ...accepted, sillY: 3.96, headY: 5.26 }
    expect(finalOpeningRecord(up, 3.06, { kind: 'WINDOW', sill: 0.9, width: 1.2, height: 1.3 }, undefined).application.state).toBe('AS_ACCEPTED')
  })
})
