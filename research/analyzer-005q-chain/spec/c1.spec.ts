/**
 * 005Q-CHAIN C1 INK-FIRST — unit specification of the ink rule (RESEARCH ONLY; run against a variant copy by
 * research/analyzer-005q-chain/spec/run-spec.mjs, never by `npm test`). The statement-level and anchor-level effects
 * are specified on the real development rows by gates.py (G2: no anchor cites CHAIN_CORRECTED or dependsOnScale
 * evidence; every INK_FIRST statement equals its lattice record's ensemble reading).
 */
import { describe, expect, it } from 'vitest'
// @ts-expect-error -- resolved by the variant config to the variant copy of @buildapp/source-metrics
import * as sm from '@buildapp/source-metrics'

const held = (ensemble: Record<string, unknown> | undefined) => ({ id: 'ocr-lattice-x', lattice: { asRead: '810', asReadValueCm: 810, ocrClass: 'AMBIGUOUS', ...(ensemble ? { ensemble } : {}) } })
const ens = (decision: string, asRead: string, ocrClass = 'SUPPORTED') => ({ decision, asRead, asReadValueCm: /^\d+$/.test(asRead) ? Number(asRead) : undefined, ocrClass, lattice: { asRead: '810', ocrClass: 'AMBIGUOUS' }, external: {}, why: '' })

describe('C1 ink: only a corroborated ensemble reading of the ink is a printed value', () => {
  it('LEADS / AGREES with CLEAR or SUPPORTED and a 2-5 digit integer is ink', () => {
    expect(sm.inkOfC1(held(ens('LEADS', '870')))).toMatchObject({ valueCm: 870, text: '870', decision: 'LEADS' })
    expect(sm.inkOfC1(held(ens('AGREES', '1385', 'CLEAR')))).toMatchObject({ valueCm: 1385, decision: 'AGREES' })
  })
  it('a single reader (no ensemble), an uncorroborated or a contested reading is not ink (missing is never agreement)', () => {
    expect(sm.inkOfC1(held(undefined))).toBeUndefined()
    expect(sm.inkOfC1(undefined)).toBeUndefined()
    for (const d of ['NOT_CORROBORATING', 'CONTESTS', 'CONTESTS_COUNT', 'NOT_COMPARABLE', 'NO_VALUE']) expect(sm.inkOfC1(held(ens(d, '541')))).toBeUndefined()
  })
  it('an ambiguous or low-quality class is not ink', () => {
    expect(sm.inkOfC1(held(ens('AGREES', '870', 'AMBIGUOUS')))).toBeUndefined()
    expect(sm.inkOfC1(held(ens('LEADS', '870', 'LOW_QUALITY')))).toBeUndefined()
  })
  it('a leading zero, a separator or a one-digit/six-digit reading is not a printed dimension', () => {
    for (const t of ['028', '0870', '87', '1,20', '8', '123456']) {
      const v = sm.inkOfC1(held(ens('LEADS', t)))
      if (t === '87') expect(v).toMatchObject({ valueCm: 87 })
      else expect(v).toBeUndefined()
    }
  })
  it('the rule reads no scale, chain or figure: its only input is the lattice record', () => {
    expect(sm.inkOfC1.length).toBe(1)
  })
})
