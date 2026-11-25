/**
 * v3.54.20 — the stage's 26 scenes: the delivered code's models of the held-out sample NEW-G (four houses) and of the 20
 * developmental houses, then the two models the host served live. Sealed bytes; failures and regressions named.
 */
import { describe, expect, it } from 'vitest'
import { compileBuilding } from '@buildapp/geometry'
import { SCENES } from '../scripts/scenes.js'

const ORDER = ['amber', 'rockville', 'basiaiadam', 'jarzab', 'skagen', 'fabia', 'medulin', 'mindelo', 'eliza', 'amarylis', 'ametyst', 'aletta', 'juliusz', 'g6', 'oban', 'novara', 'jarzebina', 'pomarancza', 'alaska', 'aurora', 'ballina', 'alberto', 'sakura', 'jeziorko'].map((h) => `${h}-v35420`).concat(['skagen-host-v35420', 'amber-host-v35420'])

describe('v3.54.20 scenes', () => {
  it('come first, the held-out NEW-G four leading, the two host models last', () => {
    expect(SCENES.slice(0, 26).map((s) => s.key)).toEqual(ORDER)
    for (const s of SCENES.slice(0, 4)) expect(s.title).toContain('NEW-G (próba odłożona)')
    for (const s of SCENES.slice(4, 24)) expect(s.title).toContain('DEV')
    for (const s of SCENES.slice(24, 26)) expect(s.title).toContain('z hosta')
  })

  it('a failed, lossy or regressed result says so in its own title or subtitle', () => {
    const of = (key: string): string => { const s = SCENES.find((q) => q.key === key); return `${s?.title} ${s?.subtitle}` }
    expect(of('basiaiadam-v35420')).toContain('NIEUDANY')
    expect(of('rockville-v35420')).toContain('NIEUDANE ZEWNĘTRZE')
    expect(of('ametyst-v35420')).toContain('REGRES')
    expect(of('amarylis-v35420')).toContain('UTRACONE')
    expect(of('medulin-v35420')).toContain('UTRACONE')
    expect(of('g6-v35420')).toContain('UTRACONE')
    expect(of('eliza-v35420')).toContain('NIEUDANY UKŁAD')
  })

  it('every scene builds from its sealed bytes and compiles; interior walls are counted from the model, not claimed', () => {
    for (const s of SCENES.slice(0, 26)) {
      const m = s.build()
      expect(compileBuilding(m).meshes.length, s.key).toBeGreaterThan(0)
      const interior = m.walls.filter((w) => w.kind === 'INTERIOR').length
      expect(s.subtitle, s.key).toContain(s.key.includes('-host-') ? `ściany wewnętrzne: ${interior};` : `ściany wewnętrzne z rzutu: ${interior},`)
    }
  })

  it('the structure the stage agreed is in the sealed models: two storeys and a garage wing, a hip, a cross-gabled rear wing', () => {
    const model = (key: string) => (SCENES.find((s) => s.key === key) as (typeof SCENES)[number]).build()
    const skagen = model('skagen-v35420')
    expect(skagen.wallRings).toHaveLength(2)
    expect(Math.max(...skagen.walls.filter((w) => w.kind === 'EXTERIOR').map((w) => w.height))).toBeGreaterThan(4.4)
    expect(model('skagen-host-v35420').wallRings).toHaveLength(2)
    expect(model('fabia-v35420').roofPlanes).toHaveLength(4)
    expect(model('amber-v35420').roofs.map((r) => r.ridgeAxis).sort()).toEqual(['X', 'Z'])
  })
})
