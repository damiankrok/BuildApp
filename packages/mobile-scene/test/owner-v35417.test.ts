/** v3.54.17 scenes: the host delivery, the DEV replay and the trial's first result come first, each labelled for what it is. */
import { describe, expect, it } from 'vitest'
import { SCENES } from '../scripts/scenes.js'

describe('v3.54.17 scenes', () => {
  // v3.54.18: after the eleven v3.54.18 scenes
  it('the three scenes follow v3.54.18\'s eleven: host delivery, DEV, trial', () => {
    expect(SCENES.slice(19, 22).map((s) => s.key)).toEqual(['alaska-host-v35417', 'alaska-dev-v35417', 'aurora-maxi-trial-v35417'])
    expect(SCENES[19].subtitle).toContain('ODDANY')
    expect(SCENES[20].subtitle).toContain('ROZWÓJ')
    expect(SCENES[21].subtitle).toContain('PRÓBA')
  })
  it('the host and DEV roofs are the gable the source draws, built from a model that had none', () => {
    for (const s of SCENES.slice(19, 21)) {
      const m = (s.build() as unknown as { model?: { roofs: Array<{ kind: string; ridgeAxis: string }> } }).model
      if (m) expect(m.roofs.some((r) => r.kind === 'GABLE' && r.ridgeAxis === 'X')).toBe(true)
    }
  })
})
