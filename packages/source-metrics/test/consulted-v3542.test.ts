import { describe, expect, it } from 'vitest'
import { applyConsultedReadings, consultedOf } from '../src/consulted.js'
import type { EnsembledLattice } from '../src/ensemble.js'
import type { ExternalReading } from '../src/recogniser.js'

// v3.54.2 pilot: the consumer of a consultant's literal label reading. Only the fields consultedOf reads are filled.
const external = (text: string, p = 0.999, own = text): ExternalReading => ({ key: 'k', engine: 'ocr.test', modelSha256: '0'.repeat(64), runtime: 'test', topK: [{ text, p }], greedy: { text: own, meanP: p }, stable: true, variants: (['BASE', 'PAD2', 'TRIM1', 'SCALE90'] as const).map((variant) => ({ variant, top: text, p })) })
const lattice = (asRead: string, ocrClass: 'CLEAR' | 'SUPPORTED' | 'AMBIGUOUS' | 'LOW_QUALITY', ext?: { text: string; decision: string; corroborating: boolean }): EnsembledLattice =>
  ({
    asRead,
    asReadValueCm: /^[1-9]\d{1,3}$/.test(asRead) ? Number(asRead) : undefined,
    ocrClass,
    ...(ext
      ? {
          external: external(ext.text, ext.corroborating ? 0.999 : 0.5),
          ensemble: { decision: ext.decision, external: { text: ext.text, valueCm: Number(ext.text), posterior: ext.corroborating ? 0.999 : 0.5, meanP: ext.corroborating ? 0.999 : 0.5, stable: true, confident: ext.corroborating }, lattice: { asRead, ocrClass }, asRead, ...(/^[1-9]\d{1,3}$/.test(asRead) ? { asReadValueCm: Number(asRead) } : {}), ocrClass: 'AMBIGUOUS', why: 'test' },
        }
      : {}),
  }) as unknown as EnsembledLattice
const reading = (literal: string, latticeId = 'lat-1', proposalId = 'p1') => ({ proposalId, frameId: 'f1', latticeId, literal, consultant: { engine: 'test', model: 'test' } })

describe('v3.54.2 consulted readings (consulted.ts)', () => {
  it('a reading the lattice and a corroborating recogniser disagreed on, read as the recogniser read it: CLEAR, the lattice value a rival', () => {
    const r = consultedOf(lattice('640', 'SUPPORTED', { text: '690', decision: 'CONTESTS', corroborating: true }), reading('690'))
    expect('ensemble' in r).toBe(true)
    if (!('ensemble' in r)) return
    expect(r.ensemble.decision).toBe('CONSULTED')
    expect(r.ensemble.asRead).toBe('690')
    expect(r.ensemble.asReadValueCm).toBe(690)
    expect(r.ensemble.ocrClass).toBe('CLEAR')
    expect(r.ensemble.rival).toEqual({ text: '640', valueCm: 640, witness: 'LATTICE' })
    expect(r.ensemble.consulted?.prior.asRead).toBe('640')
  })
  it('a reading no confident reader made is SUPPORTED, never CLEAR (one reader is not a measurement)', () => {
    const r = consultedOf(lattice('640', 'AMBIGUOUS', { text: '641', decision: 'NOT_CORROBORATING', corroborating: false }), reading('690'))
    expect('ensemble' in r && r.ensemble.ocrClass).toBe('SUPPORTED')
  })
  it('a decimal-metre literal is parsed by the analyzer (15,98 -> 1598 cm); the consultant never supplies the number', () => {
    const r = consultedOf(lattice('413', 'LOW_QUALITY'), reading('15,98'))
    expect('ensemble' in r && r.ensemble.asReadValueCm).toBe(1598)
  })
  it('counter-trials: a feet-inch literal, text, a negative and an empty literal are refused, not interpreted', () => {
    for (const bad of ["47'-1\"", '15 m', '-690', '', '6 9 0', '1.2.3']) expect('refused' in consultedOf(lattice('640', 'SUPPORTED'), reading(bad))).toBe(true)
  })
  it('a wrong digit is applied as a reading only: the old value stays a full-strength rival (the chains decide)', () => {
    const r = consultedOf(lattice('640', 'SUPPORTED', { text: '690', decision: 'CONTESTS', corroborating: true }), reading('650'))
    expect('ensemble' in r && r.ensemble.ocrClass).toBe('SUPPORTED')
    expect('ensemble' in r && r.ensemble.rival?.valueCm).toBe(640)
  })
  it('a target the run does not hold is STALE_TARGET; a second reading of one label in one run is refused', () => {
    const held = [{ id: 'lat-1', lattice: lattice('640', 'SUPPORTED') }]
    const { updated, outcomes } = applyConsultedReadings('f1', held, [reading('690', 'lat-1', 'p1'), reading('691', 'lat-1', 'p2'), reading('600', 'lat-x', 'p3'), { ...reading('5', 'lat-1', 'p4'), frameId: 'f2' }])
    expect(updated.size).toBe(1)
    expect(outcomes.map((o) => [o.proposalId, o.status, o.why.split(':')[0]])).toEqual([
      ['p1', 'APPLIED', 'consulted (p1)'],
      ['p2', 'REFUSED', 'DUPLICATE_TARGET'],
      ['p3', 'REFUSED', 'STALE_TARGET'],
    ])
  })
})
