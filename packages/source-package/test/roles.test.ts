import { describe, expect, it } from 'vitest'
import { UNKNOWN_ROLES, isAnalysable, mergeRoleClaims, normalizeRoles, projectionForDocument, storeyApplies, viewApplies, type RoleClaim, type SourceRoles } from '../src/index.js'

/**
 * The rule these tests exist to protect: an unresolved dimension stays
 * UNKNOWN. A guessed class is worse than an honest UNKNOWN, because a later
 * stage cannot tell the two apart and a wrong storey or a wrong side silently
 * poisons every measurement taken off that drawing.
 */
const claim = (partial: Partial<RoleClaim> & { confidence: number; signal: string }): RoleClaim => ({ detail: 'test claim', ...partial })

describe('mergeRoleClaims — confidence decides, and a tie that disagrees decides nothing', () => {
  it('lets the most confident claim win a dimension and keeps the losing claim as evidence', () => {
    const merged = mergeRoleClaims([
      claim({ storey: 'GROUND', confidence: 0.92, signal: 'url-slug', detail: '"parter" is the ground storey' }),
      claim({ storey: 'ATTIC', confidence: 0.6, signal: 'caption', detail: 'the alt text mentions the attic' }),
    ])
    expect(merged.roles.storey).toBe('GROUND')
    // the weaker claim is not discarded: a wrong classification must be arguable with, not
    // merely disbelievable, so both claims stay in the evidence
    expect(merged.evidence.filter((e) => e.dimension === 'storey').map((e) => e.confidence)).toEqual([0.92, 0.6])
  })

  it('leaves a dimension UNKNOWN when two EQUALLY confident claims disagree, and records the conflict as evidence', () => {
    // Two signals of identical strength saying different things is not information about
    // which is right; resolving it by whichever happened to be first would make the answer
    // depend on discovery order and would look identical to a confident classification.
    const merged = mergeRoleClaims([
      claim({ view: 'SIDE_LEFT', confidence: 0.9, signal: 'url-slug', detail: 'slug says left' }),
      claim({ view: 'SIDE_RIGHT', confidence: 0.9, signal: 'caption', detail: 'caption says right' }),
    ])
    expect(merged.roles.view).toBe('UNKNOWN')
    const conflict = merged.evidence.find((e) => e.signal === 'conflict')
    expect(conflict).toBeDefined()
    expect(conflict?.dimension).toBe('view')
    expect(conflict?.confidence).toBe(0.9)
    // the detail names BOTH candidates, so a human can adjudicate what the code would not
    expect(conflict?.detail).toContain('SIDE_LEFT')
    expect(conflict?.detail).toContain('SIDE_RIGHT')
    expect(conflict?.detail).toContain('left UNKNOWN')
    // the two disagreeing claims survive alongside the conflict note
    expect(merged.evidence.filter((e) => e.dimension === 'view')).toHaveLength(3)
  })

  it('does not treat two equally confident claims that AGREE as a conflict', () => {
    // corroboration is the normal case: the filename and the caption both say "elevation"
    const merged = mergeRoleClaims([
      claim({ document: 'ELEVATION', confidence: 0.9, signal: 'url-slug' }),
      claim({ document: 'ELEVATION', confidence: 0.9, signal: 'caption' }),
    ])
    expect(merged.roles.document).toBe('ELEVATION')
    expect(merged.evidence.some((e) => e.signal === 'conflict')).toBe(false)
  })

  it('resolves each dimension on its own, so a conflict about one cannot silence another', () => {
    // the publisher labels both side elevations identically, yet still tells us they are
    // elevations: the view dimension is the only thing in doubt
    const merged = mergeRoleClaims([
      claim({ document: 'ELEVATION', view: 'SIDE_LEFT', confidence: 0.9, signal: 'url-slug' }),
      claim({ document: 'ELEVATION', view: 'SIDE_RIGHT', confidence: 0.9, signal: 'endpoint' }),
    ])
    expect(merged.roles.document).toBe('ELEVATION')
    expect(merged.roles.view).toBe('UNKNOWN')
  })

  it('claims nothing for a dimension nobody claimed, and orders its evidence by content rather than by discovery order', () => {
    expect(mergeRoleClaims([]).roles).toEqual(UNKNOWN_ROLES)
    const forwards = mergeRoleClaims([
      claim({ document: 'SECTION', confidence: 0.92, signal: 'url-slug', detail: 'a' }),
      claim({ storey: 'ATTIC', confidence: 0.8, signal: 'endpoint', detail: 'b' }),
    ])
    const backwards = mergeRoleClaims([
      claim({ storey: 'ATTIC', confidence: 0.8, signal: 'endpoint', detail: 'b' }),
      claim({ document: 'SECTION', confidence: 0.92, signal: 'url-slug', detail: 'a' }),
    ])
    // the evidence list is content and is hashed nowhere, but it must still be stable to read
    expect(forwards.evidence).toEqual(backwards.evidence)
    expect(forwards.roles.annotation).toBe('UNKNOWN')
    expect(forwards.roles.view).toBe('UNKNOWN')
  })
})

describe('normalizeRoles — NOT_APPLICABLE and UNKNOWN are different answers', () => {
  const rolesOf = (partial: Partial<SourceRoles>): SourceRoles => ({ ...UNKNOWN_ROLES, ...partial })

  it('marks a dimension NOT_APPLICABLE when it cannot apply, and leaves it UNKNOWN when it applies but was not determined', () => {
    // An elevation has no storey — that is a fact about elevations, not a gap in the data.
    // Which side it looks from IS a question about this elevation, and it was not answered,
    // so it stays UNKNOWN: a consumer must be able to tell "no such thing" from "not read".
    const elevation = normalizeRoles(rolesOf({ document: 'ELEVATION' }))
    expect(elevation.storey).toBe('NOT_APPLICABLE')
    expect(elevation.view).toBe('UNKNOWN')
    expect(elevation.projection).toBe('ORTHOGRAPHIC_ELEVATION')

    // and the mirror image: a plan has a storey (unread here) and no viewing direction
    const plan = normalizeRoles(rolesOf({ document: 'FLOOR_PLAN' }))
    expect(plan.storey).toBe('UNKNOWN')
    expect(plan.view).toBe('NOT_APPLICABLE')
    expect(plan.projection).toBe('ORTHOGRAPHIC_PLAN')

    // a section has neither a storey nor a viewing direction
    const section = normalizeRoles(rolesOf({ document: 'SECTION' }))
    expect(section.storey).toBe('NOT_APPLICABLE')
    expect(section.view).toBe('NOT_APPLICABLE')
    expect(section.projection).toBe('ORTHOGRAPHIC_SECTION')
  })

  it('fills nothing at all when the document role itself is UNKNOWN', () => {
    // without knowing what the drawing IS, nothing can be said about which of its
    // dimensions are inapplicable; inventing NOT_APPLICABLE here would be a guess
    expect(normalizeRoles(UNKNOWN_ROLES)).toEqual(UNKNOWN_ROLES)
  })

  it('never overwrites a dimension an adapter did determine', () => {
    const attic = normalizeRoles(rolesOf({ document: 'FLOOR_PLAN', storey: 'ATTIC', annotation: 'AREA_TABLE' }))
    expect(attic.storey).toBe('ATTIC')
    expect(attic.annotation).toBe('AREA_TABLE')
    // a render that an adapter knows to be an orthographic view keeps that over the default
    const odd = normalizeRoles(rolesOf({ document: 'PERSPECTIVE_RENDER', projection: 'ORTHOGRAPHIC_ELEVATION' }))
    expect(odd.projection).toBe('ORTHOGRAPHIC_ELEVATION')
  })

  it('agrees with the predicates the fill is derived from, so the two cannot drift apart', () => {
    expect(storeyApplies('FLOOR_PLAN')).toBe(true)
    expect(storeyApplies('SITE_PLAN')).toBe(true)
    expect(storeyApplies('ELEVATION')).toBe(false)
    expect(viewApplies('ELEVATION')).toBe(true)
    expect(viewApplies('PERSPECTIVE_RENDER')).toBe(true)
    expect(viewApplies('FLOOR_PLAN')).toBe(false)
    expect(projectionForDocument('PERSPECTIVE_RENDER')).toBe('PERSPECTIVE')
    expect(projectionForDocument('CHROME')).toBe('UNKNOWN')
  })

  it('calls an asset analysable only when a measuring stage could actually use it', () => {
    // CHROME is a known role and still useless to measure; an unknown projection means
    // nobody can say what a pixel distance on the asset would even mean
    expect(isAnalysable(normalizeRoles({ ...UNKNOWN_ROLES, document: 'SECTION' }))).toBe(true)
    expect(isAnalysable(normalizeRoles({ ...UNKNOWN_ROLES, document: 'CHROME' }))).toBe(false)
    expect(isAnalysable(UNKNOWN_ROLES)).toBe(false)
  })
})
