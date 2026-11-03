/**
 * LINK-F1C: the contract's dictionaries (`Map<String, …>` on the phone) — their keys are data, the members themselves and
 * the type of their values are the contract. Invented answers only.
 */
import { describe, expect, it } from 'vitest'
import { dictionaryViolations, memberPaths } from './support/contract-shape.js'

const answer = (byFamily: unknown, extra: Record<string, unknown> = {}) => ({ result: { quality: { levels: { L0: 1, L1: 2, L2: 3 }, byFamily }, links: { scene: '/s' }, ...extra } })
const missing = (legacy: unknown, now: unknown): string[] => {
  const n = memberPaths(now)
  return [...memberPaths(legacy)].filter((p) => !n.has(p))
}

describe('LINK-F1C contract shape: dictionaries', () => {
  const legacy = answer({ OPENING: { L1: 20, L2: 18 }, INTERIOR_WALL: { L1: 3 } })

  it('a family with no feature reconstructed may have no entry: no member is missing', () => {
    expect(missing(legacy, answer({ OPENING: { L1: 20, L2: 18 } }))).toEqual([])
  })
  it('an empty dictionary is a dictionary, and a new key is no change of shape', () => {
    expect(missing(legacy, answer({}))).toEqual([])
    expect(dictionaryViolations(answer({}))).toEqual([])
    expect(dictionaryViolations(answer({ ROOF_MEMBER: { L0: 1 } }))).toEqual([])
  })
  it('the dictionary member itself stays required: an answer without it is missing a member', () => {
    const now = { result: { quality: { levels: { L0: 1, L1: 2, L2: 3 } }, links: { scene: '/s' } } }
    expect(missing(legacy, now)).toEqual(['$.result.quality.byFamily'])
  })
  it('the links keep their keys as members: the phone follows them', () => {
    expect(missing(legacy, answer({ OPENING: { L1: 1 } }, { links: { self: '/x' } }))).toEqual(['$.result.links.scene'])
  })
  it('a fixed member next to a dictionary is still required', () => {
    const now = { result: { quality: { byFamily: {} }, links: { scene: '/s' } } }
    expect(missing(legacy, now)).toEqual(['$.result.quality.levels', '$.result.quality.levels.L0', '$.result.quality.levels.L1', '$.result.quality.levels.L2'])
  })
  it('values of the wrong type are named: a family that is not a dictionary, a count that is not an integer', () => {
    expect(dictionaryViolations(answer({ OPENING: 20 }))).toEqual(['$.result.quality.byFamily'])
    expect(dictionaryViolations(answer({ OPENING: { L1: 2.5 } }))).toEqual(['$.result.quality.byFamily'])
    expect(dictionaryViolations(answer([]))).toEqual(['$.result.quality.byFamily'])
    expect(dictionaryViolations({ counts: { assetsByDocument: { FLOOR_PLAN: 'two' } } })).toEqual(['$.counts.assetsByDocument'])
    expect(dictionaryViolations(answer(null))).toEqual(['$.result.quality.byFamily'])
  })
})
