/**
 * BUILDPLAN-OWNER-005T: the two development houses shipped for the owner's visual review are the sealed models the
 * stage reports measured — pinned by SHA-256 — and their bundles are real 3D scenes: walls, a roof, openings and
 * object ids, surviving their round trip, written to the assets exactly as the exporter derives them.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ASSET_DIR, SCENES, sealedOwnerModel } from '../scripts/scenes.js'
import { buildMobileSceneBundle, loadBundle, serializeBundle } from '../src/index.js'

const OWNER = [
  { key: 'jarzmianki-005t-visual', modelId: 'm-analysis-m60124f28f071a', meshes: 107 },
  { key: 'gozdzikowce-005t-visual', modelId: 'm-analysis-m79923e950094d', meshes: 162 },
]

describe('005T owner visual scenes', () => {
  it('are listed first, in the app index, and the five earlier scenes keep their order', () => {
    const index = JSON.parse(readFileSync(join(ASSET_DIR, 'index.json'), 'utf8')) as Array<{ key: string; subtitle: string; modelId: string }>
    expect(index.map((e) => e.key)).toEqual(['jarzmianki-005t-visual', 'gozdzikowce-005t-visual', 'marcowki', 'marcowki-auto-v3', 'marcowki-auto', 'marcowki-auto-v2', 'demo'])
    for (const o of OWNER) {
      const entry = index.find((e) => e.key === o.key)
      expect(entry?.subtitle).toContain('MODEL ORIENTACYJNY')
      expect(entry?.modelId).toBe(o.modelId)
    }
  })

  it('refuse a model that is not the sealed one', () => {
    expect(() => sealedOwnerModel('jarzmianki-005t-visual', '0'.repeat(64))).toThrow(/SHA-256/)
  })

  for (const o of OWNER) {
    it(`${o.key}: a real scene with walls, a gable roof, openings and its own edition`, () => {
      const spec = SCENES.find((s) => s.key === o.key)
      expect(spec).toBeDefined()
      if (!spec) return
      const model = spec.build()
      expect(model.id).toBe(o.modelId)
      expect(model.roofs.some((r) => r.kind === 'GABLE' && r.pitchDeg === 40)).toBe(true)
      expect(model.openings.length).toBeGreaterThan(0)
      const text = serializeBundle(buildMobileSceneBundle(model))
      expect(readFileSync(join(ASSET_DIR, `${o.key}.scene.json`), 'utf8')).toBe(text)
      const back = loadBundle(text)
      expect(back.ok).toBe(true)
      if (!back.ok) return
      expect(back.bundle.scene.meshes.length).toBe(o.meshes)
      const ids = new Set(back.bundle.scene.meshes.map((m) => m.objectId))
      expect(ids.has('roof-main')).toBe(true)
      expect([...ids].some((id) => model.walls.some((w) => w.id === id))).toBe(true)
      expect([...ids].some((id) => model.windows.some((w) => w.id === id))).toBe(true)
    })
  }

  it('the two houses are different editions with different scenes', () => {
    const [a, b] = OWNER.map((o) => buildMobileSceneBundle((SCENES.find((s) => s.key === o.key) as (typeof SCENES)[number]).build()))
    expect(a.contentHash).not.toBe(b.contentHash)
    expect(a.generatedFrom.modelId).not.toBe(b.generatedFrom.modelId)
  })
})
