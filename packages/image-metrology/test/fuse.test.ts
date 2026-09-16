import { describe, expect, it } from 'vitest'
import { EVIDENCE_AUTHORITY, fuseQuantity } from '../src/index.js'
import type { EvidenceAuthority, QuantityObservation } from '../src/index.js'

const say = (id: string, authority: EvidenceAuthority, valueM: number, uncertaintyM: number): QuantityObservation => ({
  id,
  sourceId: `${id}-drawing`,
  authority,
  valueM,
  uncertaintyM,
  why: `${authority} says ${valueM}`,
})

/** §13 and §24: one opening, several drawings, and what to believe. */
describe('fusing several measurements of one quantity', () => {
  it('says so when there is only one source', () => {
    const got = fuseQuantity([say('a', 'REGISTERED_TECHNICAL_DRAWING', 2.4, 0.04)])!
    expect(got.status).toBe('SINGLE_SOURCE')
    expect(got.valueM).toBeCloseTo(2.4, 6)
    expect(got.why).toContain('Nothing corroborates it')
  })

  it('is more certain of two sources that agree than of either alone', () => {
    const one = fuseQuantity([say('a', 'REGISTERED_TECHNICAL_DRAWING', 2.4, 0.04)])!
    const two = fuseQuantity([say('a', 'REGISTERED_TECHNICAL_DRAWING', 2.4, 0.04), say('b', 'REGISTERED_TECHNICAL_DRAWING', 2.42, 0.04)])!
    expect(two.status).toBe('AGREED')
    expect(two.uncertaintyM).toBeLessThan(one.uncertaintyM)
    expect(two.valueM).toBeCloseTo(2.41, 2)
  })

  it('§24: a printed dimension outranks any pile of inferred ones', () => {
    // Three drawings, all confident, all saying something else. The printed
    // number is the publisher stating the size of its own building.
    const got = fuseQuantity([
      say('printed', 'PRINTED_DIMENSION', 4.7, 0.01),
      say('elevation', 'REGISTERED_TECHNICAL_DRAWING', 4.55, 0.03),
      say('render', 'REGISTERED_PERSPECTIVE_PLANE', 4.4, 0.03),
      say('guess', 'VLM_ESTIMATE', 4.2, 0.05),
    ])!
    expect(Math.abs(got.valueM - 4.7)).toBeLessThan(0.02)
    expect(got.decidedBy).toBe('PRINTED_DIMENSION')
  })

  it('does not let a convention move an answer a drawing measured', () => {
    const got = fuseQuantity([say('measured', 'REGISTERED_TECHNICAL_DRAWING', 2.28, 0.03), say('usual', 'CONVENTION', 2.2, 0.2)])!
    expect(Math.abs(got.valueM - 2.28)).toBeLessThan(0.01)
    expect(got.decidedBy).toBe('REGISTERED_TECHNICAL_DRAWING')
  })

  it('lets a source that has found the wrong feature bend the answer, not break it', () => {
    // Four readings of a 4.70 m opening; one of them measured the wall.
    const got = fuseQuantity([
      say('a', 'REGISTERED_TECHNICAL_DRAWING', 4.7, 0.04),
      say('b', 'REGISTERED_TECHNICAL_DRAWING', 4.68, 0.04),
      say('c', 'REGISTERED_TECHNICAL_DRAWING', 4.72, 0.04),
      say('wrong', 'REGISTERED_TECHNICAL_DRAWING', 7.9, 0.04),
    ])!
    expect(Math.abs(got.valueM - 4.7)).toBeLessThan(0.1)
    expect(got.status).toBe('DISPUTED')
    expect(got.residuals.find((r) => r.id === 'wrong')?.inlier).toBe(false)
    expect(got.residuals.filter((r) => r.inlier).length).toBe(3)
  })

  it('names which source disagreed, and by how many of its own sigmas', () => {
    const got = fuseQuantity([
      say('a', 'REGISTERED_TECHNICAL_DRAWING', 2.3, 0.03),
      say('b', 'REGISTERED_TECHNICAL_DRAWING', 2.31, 0.03),
      say('odd', 'REGISTERED_TECHNICAL_DRAWING', 3.1, 0.03),
    ])!
    expect(got.why).toContain('odd-drawing')
    expect(got.why).toMatch(/× its own stated uncertainty/)
  })

  it('does not become more certain for having been measured twice and disagreed', () => {
    const agreeing = fuseQuantity([say('a', 'REGISTERED_TECHNICAL_DRAWING', 2.3, 0.03), say('b', 'REGISTERED_TECHNICAL_DRAWING', 2.31, 0.03)])!
    const arguing = fuseQuantity([say('a', 'REGISTERED_TECHNICAL_DRAWING', 2.3, 0.03), say('b', 'REGISTERED_TECHNICAL_DRAWING', 2.9, 0.03)])!
    expect(agreeing.uncertaintyM).toBeLessThan(0.03)
    // The spread between them is the honest bar, not the quadrature of two
    // error bars that have just been shown not to mean what they said.
    expect(arguing.uncertaintyM).toBeGreaterThan(0.25)
    expect(arguing.status).toBe('DISPUTED')
  })

  it('weighs a precise reading above a vague one of the same authority', () => {
    const got = fuseQuantity([say('sharp', 'REGISTERED_TECHNICAL_DRAWING', 2.4, 0.01), say('soft', 'REGISTERED_TECHNICAL_DRAWING', 2.8, 0.25)])!
    expect(Math.abs(got.valueM - 2.4)).toBeLessThan(0.1)
    expect(got.residuals.find((r) => r.id === 'sharp')!.weight).toBeGreaterThan(got.residuals.find((r) => r.id === 'soft')!.weight)
  })

  it('keeps §24 in order', () => {
    const order: EvidenceAuthority[] = ['PRINTED_DIMENSION', 'REGISTERED_TECHNICAL_DRAWING', 'CORROBORATED_PLAN_GAP', 'REGISTERED_PERSPECTIVE_PLANE', 'VLM_ESTIMATE', 'CONVENTION']
    for (let i = 1; i < order.length; i += 1) expect(EVIDENCE_AUTHORITY[order[i - 1]], order[i - 1]).toBeGreaterThan(EVIDENCE_AUTHORITY[order[i]])
  })

  it('is deterministic whatever order the sources arrive in', () => {
    const sources = [say('a', 'PRINTED_DIMENSION', 4.7, 0.01), say('b', 'REGISTERED_TECHNICAL_DRAWING', 4.6, 0.04), say('c', 'CONVENTION', 4.0, 0.3)]
    expect(JSON.stringify(fuseQuantity([...sources].reverse()))).toBe(JSON.stringify(fuseQuantity(sources)))
  })

  it('has nothing to say about nothing', () => {
    expect(fuseQuantity([])).toBeNull()
  })
})
