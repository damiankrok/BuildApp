/**
 * v3.54.8 — the owner's review scenes: the house described from the API's reading after its review and the LOCAL model
 * the final host delivered, each the sealed model (SHA-256 of its canonical serialization) and nothing else.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ASSET_DIR, sealedOwnerModel } from '../scripts/scenes.js'

const scene = (key: string) => JSON.parse(readFileSync(join(ASSET_DIR, `${key}.scene.json`), 'utf8')) as { scene: { meshes: Array<{ semanticGroup?: string; objectKind?: string; part?: string }> } }

describe('v3.54.8 owner review scenes', () => {
  it('refuse a model that is not the sealed one', () => {
    expect(() => sealedOwnerModel('marcowki-h-v3548', '0'.repeat(64), 'owner-v3548')).toThrow(/SHA-256/)
  })
  it('the described house carries its gable frame plate and glass railings', () => {
    const m = scene('marcowki-h-v3548').scene.meshes
    expect(m.some((x) => x.semanticGroup === 'FACADE_FRAME')).toBe(true)
    expect(m.some((x) => x.objectKind === 'railing' && x.part === 'RAILING_INFILL' && x.semanticGroup === 'WINDOW_GLASS')).toBe(true)
  })
  it('both are in the app index, marked as a candidate and as the delivered model', () => {
    const index = JSON.parse(readFileSync(join(ASSET_DIR, 'index.json'), 'utf8')) as Array<{ key: string; subtitle: string }>
    // v3.54.11: right after the v3.54.10 checkpoint pair
    const at = index.findIndex((e) => e.key === 'marcowki-h-v3548')
    expect(index.slice(at, at + 2).map((e) => e.key)).toEqual(['marcowki-h-v3548', 'marcowki-local-v3548'])
    expect(index[at].subtitle).toContain('KANDYDAT')
    expect(index[at + 1].subtitle).toContain('oddany')
  })
})
