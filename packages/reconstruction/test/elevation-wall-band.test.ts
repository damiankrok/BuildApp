/**
 * BUILDPLAN-ANALYZER-005V-N4 (research patch): an elevation silhouette that takes in a pergola beside the house and a
 * roof wider than the walls is scaled on the walls' own band. Synthetic renders only; no drawing of any real building.
 */
import { describe, expect, it } from 'vitest'
import { neutralBands, registerElevationV2 } from '../src/index.js'
import type { WorldFrameV2 } from '../src/index.js'

const W = 900
const H = 520
/** Sky; a grey roof x 140..760 rows 60..240; a white-and-grey wall x 200..700 rows 240..460; a beige pergola x 40..190 rows 300..460. */
function render(opts: { wall?: boolean; pergola?: boolean } = {}) {
  const data = new Uint8ClampedArray(W * H * 4)
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      let c: [number, number, number] = [110, 170, 230]
      if (x >= 140 && x <= 760 && y >= 60 && y < 240) c = [80, 80, 82]
      if ((opts.wall ?? true) && x >= 200 && x <= 700 && y >= 240 && y <= 460) c = y < 300 ? [235, 235, 235] : [150, 150, 152]
      if ((opts.pergola ?? true) && x >= 40 && x <= 190 && y >= 300 && y <= 460 && (x % 30 < 6 || y < 312)) c = [205, 170, 130]
      const o = (y * W + x) * 4
      data[o] = c[0]
      data[o + 1] = c[1]
      data[o + 2] = c[2]
      data[o + 3] = 255
    }
  }
  return { width: W, height: H, data }
}
const extent = { x0: 40, y0: 60, x1: 760, y1: 460 }
const world: WorldFrameV2 = { envelope: { x0: 0, z0: 0, x1: 10, z1: 8 }, walled: { x0: 0, z0: 0, x1: 10, z1: 8 }, zFlip: 8, frontSide: 'SHEET_BOTTOM', why: 'synthetic' }
// 10 m of wall over 501 px: 0.01996 m/px; 400 px of silhouette is 7.98 m; the ridge datum 7.98 puts the ground at 0.
const RIDGE = 7.98

describe('005V-N4 the walls band of an elevation (005W: adopted, for the openings only)', () => {
  it('the wall under the roof is a repeated neutral band of its own, the pergola beside it is not neutral and breaks no band', () => {
    const bands = neutralBands(render(), extent)
    const wall = bands.find((b) => Math.abs(b.x0 - 200) <= 1 && Math.abs(b.x1 - 700) <= 1)
    const roof = bands.find((b) => Math.abs(b.x0 - 140) <= 1 && Math.abs(b.x1 - 760) <= 1)
    expect(wall).toBeDefined()
    expect(roof).toBeDefined()
    expect(bands.some((b) => b.x0 < 140)).toBe(false)
  })

  it('the silhouette span (pergola + roof) fails the vertical check; the walls band, scaled by the walled width, passes it', () => {
    expect(registerElevationV2({ id: 'f', assetId: 'a' }, extent, 'FRONT', 0.9, 'synthetic', world, RIDGE, 0, 0)).toBeUndefined()
    const reg = registerElevationV2({ id: 'f', assetId: 'a' }, { ...extent, x0: 200, x1: 700 }, 'FRONT', 0.9, 'synthetic', world, RIDGE, 0, 0, true)
    expect(reg).toBeDefined()
    expect(reg?.mpp).toBeCloseTo(10 / 500, 4)
    expect(Math.abs(reg?.bottomY ?? 9)).toBeLessThan(0.1)
    expect(reg?.alongAtLeft).toBe(0)
  })

  it('the roof band scaled by the walled width is refused: the ground lands far off the terrain', () => {
    expect(registerElevationV2({ id: 'f', assetId: 'a' }, { ...extent, x0: 140, x1: 760 }, 'FRONT', 0.9, 'synthetic', world, RIDGE, 0, 0, true)).toBeUndefined()
  })

  it('no wall drawn under the roof (a gable seen roof-only, or a cut sheet): no band the width of a wall', () => {
    const bands = neutralBands(render({ wall: false }), extent)
    expect(bands.some((b) => Math.abs(b.x0 - 200) <= 1 && Math.abs(b.x1 - 700) <= 1)).toBe(false)
  })
})
