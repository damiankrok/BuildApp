/**
 * v3.54.18 R2 scenes: the four houses whose result changed in the continuation round come first. Every model is the
 * sealed file (SHA-256 pinned in scenes.ts); the kept failures are labelled as such.
 */
import { describe, expect, it } from 'vitest'
import { compileBuilding, geometryClosureAudit } from '@buildapp/geometry'
import { SCENES } from '../scripts/scenes.js'

const KEYS = ['sakura-r2-v35418', 'alberto-r2-v35418', 'alaska-r2-v35418', 'ballina-r2-v35418']

describe('v3.54.18 R2 scenes', () => {
  it('the four R2 scenes come first, each labelled R2; the kept failures are named', () => {
    expect(SCENES.slice(52, 56).map((s) => s.key)).toEqual(KEYS)
    for (const s of SCENES.slice(52, 56)) expect(s.subtitle).toContain('R2')
    expect(SCENES[53].subtitle).toContain('NIEPOWODZENIA ZACHOWANE')
    expect(SCENES[54].subtitle).toContain('NIEPOWODZENIE ZACHOWANE')
  })
  it('the hip roof is four roof planes over level walls, with no parametric roof, and compiles closed', () => {
    const m = SCENES[52].build()
    expect(m.roofs).toHaveLength(0)
    expect(m.roofPlanes.map((p) => p.id).sort()).toEqual(['roof-mass-main-maxX', 'roof-mass-main-maxZ', 'roof-mass-main-minX', 'roof-mass-main-minZ'])
    expect(m.walls.every((w) => !w.topProfile)).toBe(true)
    const scene = compileBuilding(m)
    expect(geometryClosureAudit(m, scene).findings.filter((f) => f.severity === 'ERROR' && f.objects.some((o) => o.startsWith('roof-mass-main')))).toEqual([])
  })
  it('no R2 scene holds an opening the compiler does not cut', () => {
    for (const s of SCENES.slice(52, 56)) {
      const uncut = compileBuilding(s.build()).diagnostics.filter((d) => d.code === 'OPENING_ABOVE_WALL_TOP')
      expect(uncut.map((d) => d.objectId), s.key).toEqual([])
    }
  })
})
