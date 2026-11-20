/**
 * v3.54.12 — two scenes on top of the index: the H candidate with the exposed wall end caps finished (the same live
 * reading as v3.54.11, builder 0.8.0) and the LOCAL experiment on the OWNER's colour sketches (front and rear, MIXED 2
 * of 4) with the two experimental flags. Both sealed; neither is a delivered model.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ASSET_DIR, sealedOwnerModel } from '../scripts/scenes.js'

const H12 = '28c2b99bc7d0c1c6dd2c15765f4bc780b4f8ca6b12b7fa83c43bc98a7ec70bf4'
const S12 = '21e77523aebe7aa5c7293d2c1e6c92eacc8ce4cc93c78fc5dba04ea750f68a65'
const H11 = '56c343b8424d5da8179a9acb715992ec746a38bd9ec931b6ce6cee13f61ace09'

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
  it('are listed after the v3.54.13 scenes, the H candidate then the experiment, labelled as such', () => {
    const index = JSON.parse(readFileSync(join(ASSET_DIR, 'index.json'), 'utf8')) as Array<{ key: string; title: string; subtitle: string }>
    expect(index.slice(15, 17).map((e) => e.key)).toEqual(['marcowki-h-v35412', 'marcowki-local-szkice-v35412'])
    expect(index[15].subtitle).toContain('KANDYDAT')
    expect(index[16].subtitle).toContain('EKSPERYMENT')
  })
})
