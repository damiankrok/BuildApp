/**
 * v3.54.18 R3 scenes: the four houses whose result changed in the second continuation round come first. Every model is
 * the sealed file (SHA-256 pinned in scenes.ts); the kept failures are labelled as such.
 */
import { describe, expect, it } from 'vitest'
import { compileBuilding } from '@buildapp/geometry'
import { SCENES } from '../scripts/scenes.js'

const KEYS = ['alaska-r3-v35418', 'g6-r3-v35418', 'aurora-r3-v35418', 'alberto-r3-v35418']

describe('v3.54.18 R3 scenes', () => {
  it('the four R3 scenes come first, each labelled R3; the kept failures are named', () => {
    expect(SCENES.slice(22, 26).map((s) => s.key)).toEqual(KEYS)
    for (const s of SCENES.slice(22, 26)) expect(s.subtitle).toContain('R3')
    for (const i of [23, 24, 25]) expect(SCENES[i].subtitle).toContain('NIEPOWODZENIA ZACHOWANE')
  })
  it('Alaska stands with its entrance gable as the front: the body is narrower than deep and the front wall holds the door', () => {
    const m = SCENES[22].build()
    const xs = m.walls.flatMap((w) => [w.start.x, w.end.x])
    const zs = m.walls.flatMap((w) => [w.start.z, w.end.z])
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(Math.max(...zs) - Math.min(...zs))
    const front = m.walls.filter((w) => w.start.z === 0 && w.end.z === 0).map((w) => w.id)
    expect(m.doors.some((d) => front.includes(m.openings.find((o) => o.id === d.openingId)?.wallId ?? ''))).toBe(true)
    expect(m.roofs[0].ridgeAxis).toBe('Z')
  })
  it('G6 is roofed by four hip planes; no R3 scene holds an opening the compiler does not cut', () => {
    expect(SCENES[23].build().roofPlanes).toHaveLength(4)
    for (const s of SCENES.slice(22, 26)) {
      const uncut = compileBuilding(s.build()).diagnostics.filter((d) => d.code === 'OPENING_ABOVE_WALL_TOP')
      expect(uncut.map((d) => d.objectId), s.key).toEqual([])
    }
  })
})
