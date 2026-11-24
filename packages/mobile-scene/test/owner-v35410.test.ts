/**
 * v3.54.11 (D52) — the v3.54.10 checkpoint in the app: the H candidate after the final replay and the LOCAL model the
 * host delivered, each exactly the model of BuildPlan-V35410-Private.zip (SHA-256 of its canonical serialization) and
 * the scene built from it byte for byte as the ZIP holds it (content hashes below).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
// v3.54.18: the eleven v3.54.18 scenes are listed first — every position below moved down by 11
import { describe, expect, it } from 'vitest'
import { ASSET_DIR, sealedOwnerModel } from '../scripts/scenes.js'

type Mesh = { semanticGroup?: string; objectKind?: string; materialId?: string }
const asset = (key: string) => JSON.parse(readFileSync(join(ASSET_DIR, `${key}.scene.json`), 'utf8')) as { contentHash: string; scene: { meshes: Mesh[] } }
const H = 'd8c2d422edfc88132fac650b870dd072e3ba872cf95b9745e75d0b9a1fb3243e'
const L = 'b68f41e18efdefaa2c8dc18301938c6d81bea799a92f6085c43674961ac39626'

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
    expect(asset('marcowki-h-v35410').contentHash).toBe('b2a7bcab9ffd81115d943e076d88d8aeb5d487923e8189149978badc1082891a')
  })
  it('the delivered LOCAL: 13 rooms, 40 walls, 2 chimneys; its scene is the scene the host served', () => {
    const m = sealedOwnerModel('marcowki-local-v35410', L, 'owner-v35410')
    expect([m.rooms.length, m.walls.length, m.chimneys.length]).toEqual([13, 40, 2])
    expect(asset('marcowki-local-v35410').contentHash).toBe('8a37c476325b82d6a9a43b08c185d49d4b48bb825f04279f871901d38fa1b4fe')
  })
  it('both are in the app index after the repaired H, titled as the candidate and as the delivered model', () => {
    const index = JSON.parse(readFileSync(join(ASSET_DIR, 'index.json'), 'utf8')) as Array<{ key: string; title: string; subtitle: string; contentHash: string }>
    // after the two v3.54.13 scenes, the two v3.54.12 scenes and the repaired H, the two checkpoints in their order
    expect(index.slice(37, 39).map((e) => e.key)).toEqual(['marcowki-h-v35410', 'marcowki-local-v35410'])
    expect(index[37].title).toContain('kandydat')
    expect(index[37].subtitle).toContain('KANDYDAT')
    expect(index[38].title).toContain('LOCAL oddany')
  })
})
