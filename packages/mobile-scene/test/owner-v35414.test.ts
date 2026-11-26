/**
 * v3.54.14 — the scenes on top of the index: Marcówki with the OWNER's three phone defects fixed (the v3.54.13
 * geometry unchanged, only finish outlines differ), and the DEV house Bakopy as the analyzer delivered it with the metric
 * consultant and the automatic sketches.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
// v3.54.18: the eleven v3.54.18 scenes are listed first — every position below moved down by 11
import { describe, expect, it } from 'vitest'
import { ASSET_DIR, sealedOwnerModel } from '../scripts/scenes.js'
import { usableGeometryFingerprint } from '../../analysis-service/src/appearance/index.js'

const M = 'a66428c88135d1ad2d30678943acd0ea4746d4d2977b96a9b37d16f48759a0f5'
const B = '1813e748c435df6c3b648b847e2df49ab62a0e5acd8bf0658a6dc9a8456edfd9'

describe('v3.54.14 scenes', () => {
  it('are the sealed models and nothing else', () => {
    expect(() => sealedOwnerModel('marcowki-c-v35414', '0'.repeat(64), 'owner-v35414')).toThrow(/SHA-256/)
    expect(() => sealedOwnerModel('bakopy-v35414', '0'.repeat(64), 'owner-v35414')).toThrow(/SHA-256/)
  })
  it('Marcówki keeps the v3.54.13 geometry and ids; the finish runs on behind the balcony and the balustrade', () => {
    const m = sealedOwnerModel('marcowki-c-v35414', M, 'owner-v35414')
    const before = sealedOwnerModel('marcowki-c-v35413', 'a56676b9bf0249ba14534aa5135c7326ac8877827a76c571a34ecb735b0b3e68', 'owner-v35413')
    expect(usableGeometryFingerprint(m)).toBe(usableGeometryFingerprint(before))
    expect(usableGeometryFingerprint(m).slice(0, 16)).toBe('0e493584fb4f7203')
    expect(m.openings.find((o) => o.id === 'opening-0-front-8-0')?.height).toBe(2.2)
    expect(m.schemaVersion).toBe('1.9.0')
    expect(m.surfaceRegions.length).toBeGreaterThan(0)
    expect(JSON.stringify(m.surfaceRegions)).not.toBe(JSON.stringify(before.surfaceRegions))
  })
  it('Ballina: the settled outline 13.65 × 8.15, one storey, no roof (named, not invented)', () => {
    const b = sealedOwnerModel('ballina-v35414', '7d7b182030ac87cc1a6efc83e30d43717724979436ed746937e71d6f4d819c2d', 'owner-v35414')
    expect(b.levels).toHaveLength(1)
    expect(b.roofs).toHaveLength(0)
    expect(b.openings.length).toBe(16)
  })
  it('Bakopy: one storey, a chimney from the sketches, timber finishes, the front walls at their tone before the sketches', () => {
    const b = sealedOwnerModel('bakopy-v35414', B, 'owner-v35414')
    expect(b.levels).toHaveLength(1)
    expect(b.chimneys.length).toBeGreaterThanOrEqual(1)
    expect(b.walls.find((w) => w.id === 'ring-attached-1-0-w0')?.materialId).toBe('mat-render-dark')
    expect(b.surfaceRegions.some((r) => r.materialId === 'mat-timber')).toBe(true)
  })
  it('the three scenes come first: the two delivered, then Ballina labelled as partial', () => {
    const index = JSON.parse(readFileSync(join(ASSET_DIR, 'index.json'), 'utf8')) as Array<{ key: string; title: string; subtitle: string }>
    expect(index.slice(108, 111).map((e) => e.key)).toEqual(['marcowki-c-v35414', 'bakopy-v35414', 'ballina-v35414'])
    expect(index[108].subtitle).toContain('ODDANY')
    expect(index[109].subtitle).toContain('ODDANY')
    expect(index[110].subtitle).toContain('CZĘŚCIOWY')
  })
})
