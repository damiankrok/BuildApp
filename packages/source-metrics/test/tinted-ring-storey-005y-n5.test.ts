/**
 * BUILDPLAN-ANALYZER-005Y-N5 (C5): a tinted callout ring is an opening's callout on a storey under no roof. Under the
 * roof a tinted ring is as often a roof window's (005Y-N1), so it stays out there; a storey with a floor plan of a storey
 * above it in the same package has no roof windows on its plan.
 */
import { describe, expect, it } from 'vitest'
import { storeyBelowAnother } from '../src/extract.js'

const plan = (storey: string, document = 'FLOOR_PLAN') => ({ roles: { document, storey } })

describe('005Y-N5 (C5) storeyBelowAnother', () => {
  it('a ground storey under an attic or an upper storey', () => {
    expect(storeyBelowAnother(plan('GROUND'), [plan('GROUND'), plan('ATTIC')])).toBe(true)
    expect(storeyBelowAnother(plan('GROUND'), [plan('GROUND'), plan('UPPER')])).toBe(true)
    expect(storeyBelowAnother(plan('BASEMENT'), [plan('BASEMENT'), plan('GROUND')])).toBe(true)
  })
  it('the top storey, a single-storey house, and storeys nobody named are under the roof or undecided', () => {
    expect(storeyBelowAnother(plan('ATTIC'), [plan('GROUND'), plan('ATTIC')])).toBe(false)
    expect(storeyBelowAnother(plan('GROUND'), [plan('GROUND'), plan('GROUND')])).toBe(false)
    expect(storeyBelowAnother(plan('UNKNOWN'), [plan('UNKNOWN'), plan('ATTIC')])).toBe(false)
    // a site plan is no storey above anything
    expect(storeyBelowAnother(plan('GROUND'), [plan('GROUND'), plan('ATTIC', 'SITE_PLAN')])).toBe(false)
  })
})
