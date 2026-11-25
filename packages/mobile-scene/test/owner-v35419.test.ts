/**
 * v3.54.19 — the stage's 22 scenes: the final models (freeze 2) of the 20 houses, the second held-out sample first, then
 * the two models the host served from the final revision. Sealed bytes; failures named, never labelled as deliveries.
 */
import { describe, expect, it } from 'vitest'
import { compileBuilding } from '@buildapp/geometry'
import { SCENES } from '../scripts/scenes.js'

const ORDER = ['ametyst-v35419', 'skagen-v35419', 'fabia-v35419', 'pomarancza-v35419', 'oban-v35419', 'juliusz-v35419', 'amarylis-v35419', 'aletta-v35419', 'novara-v35419', 'jarzebina-v35419', 'eliza-v35419', 'alaska-v35419', 'aurora-v35419', 'ballina-v35419', 'alberto-v35419', 'sakura-v35419', 'medulin-v35419', 'mindelo-v35419', 'jeziorko-v35419', 'g6-v35419', 'alberto-host-v35419', 'oban-host-v35419']

describe('v3.54.19 scenes', () => {
  it('come first, the held-out NEW-F four leading, the two host models last', () => {
    expect(SCENES.slice(26, 48).map((s) => s.key)).toEqual(ORDER)
    for (const s of SCENES.slice(26, 30)) expect(s.title).toContain('NEW-F (próba odłożona)')
    for (const s of SCENES.slice(30, 33)) expect(s.title).toContain('rozwojowy')
    for (const s of SCENES.slice(46, 48)) expect(s.title).toContain('z hosta na finalnej rewizji')
  })

  it('a failed or lossy result says so in its own subtitle', () => {
    const sub = (key: string): string => SCENES.find((s) => s.key === key)?.subtitle ?? ''
    expect(sub('skagen-v35419')).toContain('NIEUDANY')
    expect(sub('fabia-v35419')).toContain('NIEUDANY DACH')
    expect(sub('amarylis-v35419')).toContain('UTRACONE')
    expect(sub('eliza-v35419')).toContain('NIEUDANY')
  })

  it('every scene builds from its sealed bytes and compiles; interior walls are counted from the model, not claimed', () => {
    for (const s of SCENES.slice(26, 48)) {
      const m = s.build()
      expect(compileBuilding(m).meshes.length, s.key).toBeGreaterThan(0)
      const interior = m.walls.filter((w) => w.kind === 'INTERIOR').length
      if (!s.key.includes('-host-')) expect(s.subtitle, s.key).toContain(`ściany wewnętrzne z rzutu: ${interior},`)
    }
  })
})
