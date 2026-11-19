/**
 * v3.54.11 — the repaired H: the same live reading as the v3.54.10 candidate, built by the code that binds a finish zone
 * to the portal band (D53). Sealed; its portal members carry the dark zone finish, the rest of the house is the
 * candidate's (15 rooms, 29 walls, no chimney).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ASSET_DIR, sealedOwnerModel } from '../scripts/scenes.js'

const H11 = '56c343b8424d5da8179a9acb715992ec746a38bd9ec931b6ce6cee13f61ace09'

describe('v3.54.11 the repaired H scene', () => {
  it('is the sealed model and nothing else', () => {
    expect(() => sealedOwnerModel('marcowki-h-v35411', '0'.repeat(64), 'owner-v35411')).toThrow(/SHA-256/)
  })
  it('its portal bands carry the zone finish; the checkpoint candidate\'s were the light member', () => {
    const fixed = sealedOwnerModel('marcowki-h-v35411', H11, 'owner-v35411')
    const before = sealedOwnerModel('marcowki-h-v35410', 'd8c2d422edfc88132fac650b870dd072e3ba872cf95b9745e75d0b9a1fb3243e', 'owner-v35410')
    const bands = (m: typeof fixed) => m.linearSolids.filter((x) => x.role === 'FASCIA' && x.id.startsWith('portal-')).map((x) => x.materialId)
    expect(new Set(bands(fixed))).toEqual(new Set(['mat-zone-plaster-dark']))
    expect(new Set(bands(before))).toEqual(new Set(['mat-member']))
    expect([fixed.rooms.length, fixed.walls.length, fixed.chimneys.length]).toEqual([15, 29, 0])
  })
  it('is listed after the two v3.54.12 scenes, as a candidate after the repair', () => {
    const index = JSON.parse(readFileSync(join(ASSET_DIR, 'index.json'), 'utf8')) as Array<{ key: string; title: string; subtitle: string }>
    expect(index[2].key).toBe('marcowki-h-v35411')
    expect(index[2].title).toContain('po naprawie')
    expect(index[2].subtitle).toContain('KANDYDAT')
  })
})
