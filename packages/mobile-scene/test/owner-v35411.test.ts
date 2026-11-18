/**
 * v3.54.11 — the repaired H: the same live reading as the v3.54.10 candidate, built by the code that binds a finish zone
 * to the portal band (D53). Sealed; its portal members carry the dark zone finish, the rest of the house is the
 * candidate's (15 rooms, 29 walls, no chimney).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ASSET_DIR, sealedOwnerModel } from '../scripts/scenes.js'

const H11 = '35602721f8b82487b6beed21c854ba7188fdca0e504f9d2106eedbe97e02ee6a'

describe('v3.54.11 the repaired H scene', () => {
  it('is the sealed model and nothing else', () => {
    expect(() => sealedOwnerModel('marcowki-h-v35411', '0'.repeat(64), 'owner-v35411')).toThrow(/SHA-256/)
  })
  it('its portal bands carry the zone finish; the checkpoint candidate\'s were the light member', () => {
    const fixed = sealedOwnerModel('marcowki-h-v35411', H11, 'owner-v35411')
    const before = sealedOwnerModel('marcowki-h-v35410', '826085f562528b1666ea8a4e673c83e2ff446abd0b080dc719b191db2cee990a', 'owner-v35410')
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
