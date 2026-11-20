/**
 * v3.54.15 — the scenes on top of the index: Ballina with its roof from the section's levels (the consultant's level
 * marks admitted by the drawing's own ladder), and the fresh public control Murcja as its first frozen result.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ASSET_DIR, sealedOwnerModel } from '../scripts/scenes.js'

const BALLINA = 'bce37b2b92fc53ef22ee946503186a7b90d9c3b6be50b4512b6c1f94ab959b43'
const MURCJA = '4f84df37a80d16088105f269e0fcc15a4e19ebbd7e4a2d908e3456dd3407b840'

describe('v3.54.15 scenes', () => {
  it('are the sealed models and nothing else', () => {
    expect(() => sealedOwnerModel('ballina-v35415', '0'.repeat(64), 'owner-v35415')).toThrow(/SHA-256/)
    expect(() => sealedOwnerModel('murcja-v35415', '0'.repeat(64), 'owner-v35415')).toThrow(/SHA-256/)
  })
  it('Ballina: the 13.65 × 8.15 outline kept, now under a 28° gable with its ridge at the section\'s 5.54', () => {
    const b = sealedOwnerModel('ballina-v35415', BALLINA, 'owner-v35415')
    const v35414 = sealedOwnerModel('ballina-v35414', '7d7b182030ac87cc1a6efc83e30d43717724979436ed746937e71d6f4d819c2d', 'owner-v35414')
    expect(v35414.roofs).toHaveLength(0)
    expect(b.roofs).toHaveLength(1)
    expect(b.roofs[0].pitchDeg).toBe(28)
    expect(b.levels).toHaveLength(1)
    expect(b.levels[0].height).toBeCloseTo(5.54, 6)
    expect(b.openings.length).toBe(v35414.openings.length)
    expect(b.surfaceRegions.length).toBeGreaterThan(0)
    // after the freeze (named): the entrance door stays a door — its sill was read inside the front view's ground error
    expect(b.openings.find((o) => o.id === 'opening-0-front-0-3')?.kind).toBe('DOOR')
  })
  it('Murcja: two storeys of 2.80 and 4.30 m (LOCAL alone read 12.72 m), not a tower', () => {
    const m = sealedOwnerModel('murcja-v35415', MURCJA, 'owner-v35415')
    expect(m.levels.map((l) => [l.elevation, l.height])).toEqual([[0, 2.8], [2.8, 4.3]])
    expect(m.roofs.length).toBeGreaterThan(0)
  })
  it('the two scenes follow v3.54.16\'s five: Ballina delivered, then the control labelled as such', () => {
    const index = JSON.parse(readFileSync(join(ASSET_DIR, 'index.json'), 'utf8')) as Array<{ key: string; subtitle: string }>
    expect(index.slice(8, 10).map((e) => e.key)).toEqual(['ballina-v35415', 'murcja-v35415'])
    expect(index[8].subtitle).toContain('ODDANY')
    expect(index[9].subtitle).toContain('KONTROLA')
  })
})
