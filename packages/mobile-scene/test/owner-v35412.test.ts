/**
 * v3.54.12 — two scenes on top of the index: the H candidate with the exposed wall end caps finished (the same live
 * reading as v3.54.11, builder 0.8.0) and the LOCAL experiment on the OWNER's colour sketches (front and rear, MIXED 2
 * of 4) with the two experimental flags. Both sealed; neither is a delivered model.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ASSET_DIR, sealedOwnerModel } from '../scripts/scenes.js'

const H12 = '452165d13263b268ffaebd8c5f134cd96202f7fc36c2b8ea1f05274ac5e50fea'
const S12 = '1d5d7713bda542289c42ab4e8e4878931bc52c0c802e1e19ebd3318c052eb0f9'
const H11 = '35602721f8b82487b6beed21c854ba7188fdca0e504f9d2106eedbe97e02ee6a'

describe('v3.54.12 scenes', () => {
  it('are the sealed models and nothing else', () => {
    expect(() => sealedOwnerModel('marcowki-h-v35412', '0'.repeat(64), 'owner-v35412')).toThrow(/SHA-256/)
    expect(() => sealedOwnerModel('marcowki-local-szkice-v35412', '0'.repeat(64), 'owner-v35412')).toThrow(/SHA-256/)
  })
  it('H v3.54.12 differs from v3.54.11 only by six end-cap finishes', () => {
    const h12 = sealedOwnerModel('marcowki-h-v35412', H12, 'owner-v35412')
    const h11 = sealedOwnerModel('marcowki-h-v35411', H11, 'owner-v35411')
    const caps = h12.surfaceRegions.filter((r) => r.face === 'START' || r.face === 'END')
    expect(caps).toHaveLength(6)
    expect(h12.surfaceRegions.filter((r) => r.face === 'OUTER' || r.face === 'INNER')).toEqual(h11.surfaceRegions)
    expect({ ...h12, surfaceRegions: [] }).toEqual({ ...h11, surfaceRegions: [] })
    expect([h12.rooms.length, h12.walls.length, h12.chimneys.length]).toEqual([15, 29, 0])
  })
  it('the sketch experiment is LOCAL with two chimneys', () => {
    const s = sealedOwnerModel('marcowki-local-szkice-v35412', S12, 'owner-v35412')
    expect([s.rooms.length, s.walls.length, s.chimneys.length]).toEqual([13, 40, 2])
  })
  it('are listed first, the H candidate then the experiment, labelled as such', () => {
    const index = JSON.parse(readFileSync(join(ASSET_DIR, 'index.json'), 'utf8')) as Array<{ key: string; title: string; subtitle: string }>
    expect(index.slice(0, 2).map((e) => e.key)).toEqual(['marcowki-h-v35412', 'marcowki-local-szkice-v35412'])
    expect(index[0].subtitle).toContain('KANDYDAT')
    expect(index[1].subtitle).toContain('EKSPERYMENT')
  })
})
