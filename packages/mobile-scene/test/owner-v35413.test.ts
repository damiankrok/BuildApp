/**
 * v3.54.13 — two scenes on top of the index: the delivered miniature (the LOCAL geometry read on the original sources,
 * finishes from outlines: front and rear from the OWNER's sketches, the sides from the API reading) and the experiment (the same geometry, finishes from the API reading of
 * the four original elevations). Both sealed; their usable geometry is the v3.54.11 LOCAL A's, only finishes differ.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ASSET_DIR, sealedOwnerModel } from '../scripts/scenes.js'
import { usableGeometryFingerprint } from '../../analysis-service/src/appearance/index.js'

const C = 'a56676b9bf0249ba14534aa5135c7326ac8877827a76c571a34ecb735b0b3e68'
const L = '8a6c0cfe4b1f4bde50e6dea164ef79cfb2d9e6fdd78e847e2465636079701014'
// the A run's model as the v3.54.10 checkpoint delivered it is the same reading's geometry (LOCAL on the originals)
const A_FINGERPRINT = '0e493584fb4f7203'

describe('v3.54.13 scenes', () => {
  it('are the sealed models and nothing else', () => {
    expect(() => sealedOwnerModel('marcowki-c-v35413', '0'.repeat(64), 'owner-v35413')).toThrow(/SHA-256/)
    expect(() => sealedOwnerModel('marcowki-c-live-v35413', '0'.repeat(64), 'owner-v35413')).toThrow(/SHA-256/)
  })
  it('both keep the base geometry and ids; only finish outlines differ', () => {
    const c = sealedOwnerModel('marcowki-c-v35413', C, 'owner-v35413')
    const l = sealedOwnerModel('marcowki-c-live-v35413', L, 'owner-v35413')
    expect(usableGeometryFingerprint(c).slice(0, 16)).toBe(A_FINGERPRINT)
    expect(usableGeometryFingerprint(l).slice(0, 16)).toBe(A_FINGERPRINT)
    expect([c.rooms.length, c.walls.length, c.chimneys.length]).toEqual([13, 40, 2])
    // the gate keeps its corrected height
    expect(c.openings.find((o) => o.id === 'opening-0-front-8-0')?.height).toBe(2.2)
    // the front upper-storey timber is one outline reaching the gable, not a rect
    const up = c.surfaceRegions.find((r) => r.hostId === 'ring-main-1-w0' && r.materialId === 'mat-timber')
    expect(up?.outline?.length).toBeGreaterThan(10)
    expect(c.schemaVersion).toBe('1.9.0')
    // the sides, which have no sketch, take the reading's outlines (the dark block of the west ground storey)
    expect(c.surfaceRegions.some((r) => r.id.startsWith('appearance-west-') && r.materialId === 'mat-render-dark')).toBe(true)
  })
  it('the scenes draw the outlines as finish skins, listed first, labelled as delivered and as an experiment', () => {
    const index = JSON.parse(readFileSync(join(ASSET_DIR, 'index.json'), 'utf8')) as Array<{ key: string; title: string; subtitle: string }>
    expect(index.slice(3, 5).map((e) => e.key)).toEqual(['marcowki-c-v35413', 'marcowki-c-live-v35413'])
    expect(index[3].subtitle).toContain('ODDANY')
    expect(index[4].subtitle).toContain('EKSPERYMENT')
    const scene = JSON.parse(readFileSync(join(ASSET_DIR, 'marcowki-c-v35413.scene.json'), 'utf8')) as { scene: { meshes: Array<{ objectId: string }> } }
    expect(scene.scene.meshes.some((m) => m.objectId === 'appearance-front-ring-main-1-w0-timber-0')).toBe(true)
  })
})
