/**
 * v3.54.12 — `verticalFromDatums` (experimental flag, default off): an elevation whose silhouette misses the terrain
 * datum by more than 0.3 m under one scale (a redrawn elevation with other proportions) gets a separate vertical scale
 * from the ridge and terrain datums, bounded to 15 %; along the facade nothing changes. Off, or within 0.3 m, the
 * registration is exactly as before.
 */
import { describe, expect, it } from 'vitest'
import { elevationFrameFromV2, registerElevationV2 } from '../src/index.js'
import type { WorldFrameV2 } from '../src/index.js'

const world: WorldFrameV2 = { envelope: { x0: 0, z0: 0, x1: 12, z1: 14 }, walled: { x0: 0, z0: 0, x1: 12, z1: 14 }, zFlip: 14, frontSide: 'SHEET_BOTTOM', why: 'synthetic' }
const RIDGE = 8
const TERRAIN = -0.3
// 1200 px across = 12 m: 0.01 m/px. A faithful drawing is 830 px tall (ridge 8 to terrain −0.3).
const faithful = { x0: 100, y0: 100, x1: 1300, y1: 930 }
// a redrawing 8 % taller than its width says: 896 px tall
const taller = { x0: 100, y0: 100, x1: 1300, y1: 996 }
const reg = (extent: typeof faithful, flag: boolean) => registerElevationV2({ id: 'f', assetId: 'a' }, extent, 'FRONT', 0.9, 'synthetic', world, RIDGE, 0, TERRAIN, false, undefined, flag)

describe('v3.54.12 a separate vertical scale from the ridge and terrain datums (flag)', () => {
  it('off: one scale as before, and the ground lands where the width puts it', () => {
    const r = reg(taller, false)
    expect(r?.mppV).toBeUndefined()
    expect(r?.mpp).toBeCloseTo(0.01, 9)
    expect(r?.bottomY).toBeCloseTo(RIDGE - 896 * 0.01, 6)
    expect(elevationFrameFromV2(r!, world).registration.anisotropy).toBe(1)
  })
  it('on, ground missed by more than 0.3 m: the apex is the ridge and the bottom the terrain; along unchanged', () => {
    const r = reg(taller, true)
    expect(r?.mppV).toBeCloseTo((RIDGE - TERRAIN) / 896, 6)
    expect(r?.mpp).toBeCloseTo(0.01, 9)
    expect(r?.why).toContain('VERTICAL_FROM_DATUMS')
    const v = elevationFrameFromV2(r!, world)
    expect(v.yOf(taller.y0)).toBeCloseTo(RIDGE, 3)
    expect(v.yOf(taller.y1)).toBeCloseTo(TERRAIN, 3)
    // positions along the facade are the width's, as without the flag
    const off = elevationFrameFromV2(reg(taller, false)!, world)
    expect(v.alongOf(700)).toBe(off.alongOf(700))
    expect(v.registration.metresPerPixelV).toBeCloseTo(r!.mppV!, 9)
  })
  it('on, a faithful drawing (ground within 0.3 m): exactly the registration without the flag', () => {
    expect(reg(faithful, true)).toEqual(reg(faithful, false))
  })
  it('the 0.9 m ground gate still comes first: a drawing too far off (24 % taller) is not registered, flag or not', () => {
    const far = { x0: 100, y0: 100, x1: 1300, y1: 1100 }
    expect(reg(far, false)).toBeUndefined()
    expect(reg(far, true)).toBeUndefined()
  })
})
