/**
 * v3.54.18 scenes: the host deliveries first, then the six development houses, then the three blind first results —
 * each labelled for what it is, the failures included. Every model is the sealed file (SHA-256 pinned in scenes.ts).
 */
import { describe, expect, it } from 'vitest'
import { compileBuilding } from '@buildapp/geometry'
import { SCENES } from '../scripts/scenes.js'

const KEYS = ['ballina-host-v35418', 'layla-host-v35418', 'alaska-v35418', 'aurora-maxi-v35418', 'ballina-v35418', 'alberto-v35418', 'medulin-v35418', 'jeziorko-v35418', 'mindelo-blind-v35418', 'sakura-blind-v35418', 'g6-blind-v35418']

describe('v3.54.18 scenes', () => {
  it('the eleven scenes follow the four of R2: host, development, blind', () => {
    expect(SCENES.slice(30, 41).map((s) => s.key)).toEqual(KEYS)
    expect(SCENES[30].subtitle).toContain('ODDANY')
    expect(SCENES[31].subtitle).toContain('ODDANY')
    for (const i of [32, 33, 34]) expect(SCENES[i].subtitle).toContain('ROZWÓJ')
    for (const i of [35, 36, 37]) expect(SCENES[i].subtitle).toContain('NOWY DOM')
    for (const i of [38, 39, 40]) expect(SCENES[i].subtitle).toContain('PRÓBA ŚLEPA')
  })
  it('a kept failure is labelled as one, never as a delivery', () => {
    expect(SCENES[36].subtitle).toContain('NIEPOWODZENIE ZACHOWANE')
    expect(SCENES[40].subtitle).toContain('NIEPOWODZENIE ZACHOWANE')
    expect(SCENES[35].subtitle).toContain('NIEUŻYTECZNA')
  })
  it('no v3.54.18 scene holds an opening the compiler does not cut (the loss found in cycle 4)', () => {
    for (const s of SCENES.slice(30, 41)) {
      const uncut = compileBuilding(s.build()).diagnostics.filter((d) => d.code === 'OPENING_ABOVE_WALL_TOP')
      expect(uncut.map((d) => d.objectId), s.key).toEqual([])
    }
  })
})
