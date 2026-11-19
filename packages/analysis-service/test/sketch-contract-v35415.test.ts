/**
 * v3.54.15 — the elevation answer's canonicalization (parser 3): object vs unambiguous tuple vs unknown form, the order
 * of the answer, a truncated answer, a refusal, a missing tool call, a zone that only repeats the roof. Every element
 * has a fate; nothing becomes an empty list without one.
 */
import { describe, expect, it } from 'vitest'
import { canonicalizeElevationAnswer } from '../src/appearance/elevation-sketch.js'

const pic = { width: 800, height: 400, scale: 1, sha256: 'a'.repeat(64) }
const run = (raw: unknown, stopReason?: string) => canonicalizeElevationAnswer({ raw, stopReason, frameId: 'F', picture: pic, frame: { width: 800, height: 400 }, model: 'm' })
const wallPoly = [[100, 200], [700, 200], [700, 380], [100, 380]]
const roofPoly = [[80, 200], [400, 40], [720, 200]]
const winPoly = [[300, 240], [380, 240], [380, 320], [300, 320]]
const objectAnswer = { groundRow: 380, silhouette: null, roofs: [{ polygon: roofPoly }], walls: [{ class: 'LIGHT_RENDER', polygon: wallPoly, host: 'main', visibility: 'VISIBLE' }], openings: [{ kind: 'WINDOW', polygon: winPoly, host: 'main' }], elements: [] }
const tupleAnswer = { groundRow: 380, silhouette: null, roofs: [roofPoly], walls: [['LIGHT_RENDER', wallPoly, 'main', 'VISIBLE']], openings: [['WINDOW', winPoly, 'main']], elements: [] }

describe('v3.54.15 the elevation answer contract', () => {
  it('an unambiguous tuple is the same statement as the object: the same canonical sketch, the form recorded NORMALIZED', () => {
    const a = run(objectAnswer)
    const b = run(tupleAnswer)
    expect(b.sketch?.walls).toEqual(a.sketch?.walls)
    expect(b.sketch?.openings).toEqual(a.sketch?.openings)
    expect(b.sketch?.roofs).toEqual(a.sketch?.roofs)
    expect(b.account.completeness).toBe('COMPLETE')
    expect(b.account.elements.find((e) => e.path === 'walls[0]')).toMatchObject({ form: 'TUPLE', fate: 'NORMALIZED' })
    expect(b.account.elements.find((e) => e.path === 'openings[0]')).toMatchObject({ form: 'TUPLE', fate: 'NORMALIZED' })
    expect(a.account.elements.find((e) => e.path === 'walls[0]')).toMatchObject({ form: 'OBJECT', fate: 'ACCEPTED' })
  })

  it('a tuple whose positions do not type-check, or an unknown shape, is REFUSED with its reason and makes the answer PARTIAL', () => {
    const swapped = { ...tupleAnswer, walls: [[wallPoly, 'LIGHT_RENDER', 'main', 'VISIBLE']] }
    const r = run(swapped)
    expect(r.sketch?.walls).toHaveLength(0)
    expect(r.account.elements.find((e) => e.path === 'walls[0]')).toMatchObject({ form: 'UNKNOWN', fate: 'REFUSED', reason: 'unknown form' })
    expect(r.account.completeness).toBe('PARTIAL')
    const odd = run({ ...objectAnswer, openings: ['WINDOW 300,240'] })
    expect(odd.account.completeness).toBe('PARTIAL')
    expect(odd.sketch?.openings).toHaveLength(0)
  })

  it('the order of the answer changes nothing; unknown top-level fields are named', () => {
    const two = { ...objectAnswer, openings: [...objectAnswer.openings, { kind: 'DOOR', polygon: [[500, 260], [560, 260], [560, 380], [500, 380]], host: 'main' }] }
    const rev = { ...two, openings: [...two.openings].reverse(), extra: 1 }
    expect(run(rev).sketch?.openings).toEqual(run(two).sketch?.openings)
    expect(run(rev).account.unknownFields).toEqual(['extra'])
  })

  it('a truncated answer is PARTIAL; a refusal and a missing tool call give no sketch, each with its reason', () => {
    expect(run(objectAnswer, 'max_tokens').account).toMatchObject({ response: 'TRUNCATED', completeness: 'PARTIAL' })
    expect(run(objectAnswer, 'refusal').failed).toMatch(/^REFUSED/)
    expect(run(undefined, 'end_turn').failed).toMatch(/^NO_TOOL_CALL/)
  })

  it('a wall zone that is the roof\'s own polygon is refused as a roof, without counting as lost form', () => {
    const r = run({ ...objectAnswer, walls: [...objectAnswer.walls, { class: 'DARK_RENDER', polygon: roofPoly, host: 'roof', visibility: 'VISIBLE' }] })
    expect(r.sketch?.walls).toHaveLength(1)
    expect(r.account.elements.find((e) => e.path === 'walls[1]')?.reason).toMatch(/roof's own polygon/)
    expect(r.account.completeness).toBe('COMPLETE')
  })
})
