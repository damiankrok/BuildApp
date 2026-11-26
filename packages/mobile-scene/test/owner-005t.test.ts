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
    // (v3.54.8: the owner's two v3.54.8 review scenes go before them; the 005T pair and the five earlier keep their order)
    // (v3.54.11: the v3.54.10 checkpoint pair goes first; everything after it keeps its order)
    // (v3.54.15: Ballina with its roof and the control Murcja go first; then v3.54.14's corrected Marcówki, Bakopy and Ballina)
    // (v3.54.16: Ballina delivered by the final host, the Murcja replay, the controlled test pair and the trial's first result go first)
    // (v3.54.18 R2: the four houses whose result changed in the continuation round go first)
    // (v3.54.18 R3: the four houses whose result changed in the second continuation round go first)
    expect(index.map((e) => e.key)).toEqual(['anna-v35421', 'debora-v35421', 'lyon-v35421', 'morwa-v35421', 'osika-v35421', 'mindelo-v35421', 'amarylis-v35421', 'amber-v35421', 'eliza-v35421', 'ametyst-v35421', 'skagen-v35421', 'aletta-v35421', 'alaska-v35421', 'aurora-v35421', 'ballina-v35421', 'alberto-v35421', 'medulin-v35421', 'jeziorko-v35421', 'sakura-v35421', 'g6-v35421', 'novara-v35421', 'jarzebina-v35421', 'oban-v35421', 'juliusz-v35421', 'fabia-v35421', 'pomarancza-v35421', 'rockville-v35421', 'basiaiadam-v35421', 'jarzab-v35421', 'debora-host-v35421', 'anna-host-v35421', 'amber-v35420', 'rockville-v35420', 'basiaiadam-v35420', 'jarzab-v35420', 'skagen-v35420', 'fabia-v35420', 'medulin-v35420', 'mindelo-v35420', 'eliza-v35420', 'amarylis-v35420', 'ametyst-v35420', 'aletta-v35420', 'juliusz-v35420', 'g6-v35420', 'oban-v35420', 'novara-v35420', 'jarzebina-v35420', 'pomarancza-v35420', 'alaska-v35420', 'aurora-v35420', 'ballina-v35420', 'alberto-v35420', 'sakura-v35420', 'jeziorko-v35420', 'skagen-host-v35420', 'amber-host-v35420', 'ametyst-v35419', 'skagen-v35419', 'fabia-v35419', 'pomarancza-v35419', 'oban-v35419', 'juliusz-v35419', 'amarylis-v35419', 'aletta-v35419', 'novara-v35419', 'jarzebina-v35419', 'eliza-v35419', 'alaska-v35419', 'aurora-v35419', 'ballina-v35419', 'alberto-v35419', 'sakura-v35419', 'medulin-v35419', 'mindelo-v35419', 'jeziorko-v35419', 'g6-v35419', 'alberto-host-v35419', 'oban-host-v35419', 'alaska-r3-v35418', 'g6-r3-v35418', 'aurora-r3-v35418', 'alberto-r3-v35418', 'sakura-r2-v35418', 'alberto-r2-v35418', 'alaska-r2-v35418', 'ballina-r2-v35418', 'ballina-host-v35418', 'layla-host-v35418', 'alaska-v35418', 'aurora-maxi-v35418', 'ballina-v35418', 'alberto-v35418', 'medulin-v35418', 'jeziorko-v35418', 'mindelo-blind-v35418', 'sakura-blind-v35418', 'g6-blind-v35418', 'alaska-host-v35417', 'alaska-dev-v35417', 'aurora-maxi-trial-v35417', 'ballina-v35416', 'murcja-v35416', 'ballina-test-after-v35416', 'ballina-test-before-v35416', 'alaska-trial-v35416', 'ballina-v35415', 'murcja-v35415', 'marcowki-c-v35414', 'bakopy-v35414', 'ballina-v35414', 'marcowki-c-v35413', 'marcowki-c-live-v35413', 'marcowki-h-v35412', 'marcowki-local-szkice-v35412', 'marcowki-h-v35411', 'marcowki-h-v35410', 'marcowki-local-v35410', 'marcowki-h-v3548', 'marcowki-local-v3548', 'jarzmianki-005t-visual', 'gozdzikowce-005t-visual', 'marcowki', 'marcowki-auto-v3', 'marcowki-auto', 'marcowki-auto-v2', 'demo'])
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
