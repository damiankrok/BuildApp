/**
 * v3.54.11 (D52) — the v3.54.10 checkpoint in the app: the H candidate after the final replay and the LOCAL model the
 * host delivered, each exactly the model of BuildPlan-V35410-Private.zip (SHA-256 of its canonical serialization) and
 * the scene built from it byte for byte as the ZIP holds it (content hashes below).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ASSET_DIR, sealedOwnerModel } from '../scripts/scenes.js'

type Mesh = { semanticGroup?: string; objectKind?: string; materialId?: string }
const asset = (key: string) => JSON.parse(readFileSync(join(ASSET_DIR, `${key}.scene.json`), 'utf8')) as { contentHash: string; scene: { meshes: Mesh[] } }
const H = '826085f562528b1666ea8a4e673c83e2ff446abd0b080dc719b191db2cee990a'
const L = '36f522a4eb21a4eedf34bb8fd60fd7c59e4460d251ad3443cc04c7a0ce93fc86'

describe('v3.54.11 the v3.54.10 checkpoint scenes', () => {
  it('refuse a model that is not the sealed one', () => {
    expect(() => sealedOwnerModel('marcowki-h-v35410', L, 'owner-v35410')).toThrow(/SHA-256/)
    expect(() => sealedOwnerModel('marcowki-local-v35410', H, 'owner-v35410')).toThrow(/SHA-256/)
  })
  it('the H candidate is the replay model: 15 rooms, 29 walls, no chimney, its finish zones; its scene is the ZIP scene', () => {
    const m = sealedOwnerModel('marcowki-h-v35410', H, 'owner-v35410')
    expect([m.rooms.length, m.walls.length, m.chimneys.length]).toEqual([15, 29, 0])
    expect(m.materials.some((x) => x.id === 'mat-zone-plaster-dark')).toBe(true)
    expect((m.surfaceRegions ?? []).filter((r) => String(r.materialId).startsWith('mat-zone-')).length).toBeGreaterThan(0)
    expect(asset('marcowki-h-v35410').contentHash).toBe('530a890050472e5150c8a5016faacaf8da83d776afd0252f960cd878f015dc4e')
  })
  it('the delivered LOCAL: 13 rooms, 40 walls, 2 chimneys; its scene is the scene the host served', () => {
    const m = sealedOwnerModel('marcowki-local-v35410', L, 'owner-v35410')
    expect([m.rooms.length, m.walls.length, m.chimneys.length]).toEqual([13, 40, 2])
    expect(asset('marcowki-local-v35410').contentHash).toBe('75f62f773a514dc007c437a984192aecb16ef77ea8aacce51306a56962c4ee45')
  })
  it('both are first in the app index, titled as the candidate and as the delivered model', () => {
    const index = JSON.parse(readFileSync(join(ASSET_DIR, 'index.json'), 'utf8')) as Array<{ key: string; title: string; subtitle: string; contentHash: string }>
    expect(index.slice(0, 2).map((e) => e.key)).toEqual(['marcowki-h-v35410', 'marcowki-local-v35410'])
    expect(index[0].title).toContain('kandydat')
    expect(index[0].subtitle).toContain('KANDYDAT')
    expect(index[1].title).toContain('LOCAL oddany')
  })
})
