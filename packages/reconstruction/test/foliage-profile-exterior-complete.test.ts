/**
 * EXTERIOR-COMPLETE (Bakopy, disclosed DEV house): a house rendered before a stand of trees.
 *
 * FIRST_BAD: the profile walk read a body's top as the first pixel under the ceiling that was not sky (the flood from
 * the picture's top) nor green by `g − max(r, b) ≥ 8`. The crowns behind the roof are olive (157,163,63) and near-black
 * (0,2,0), their green barely above their red, and the sky seen through them is cut off from the flood: the walk stopped
 * on the crowns 0.9–1.4 m over the ridge, every view of an attached body was refused as misregistered (offset over
 * 1.0 m) and every attached roof was built flat. The front and rear renders' outlines, measured from straight edges,
 * lost the apex and a gable's far side against the crowns, and fitted no span.
 *
 * The rasters here are drawn with those measured colours: a dark tiled roof with a chimney under olive and near-black
 * crowns flecked with sky.
 */
import { describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-cv'
import { skyMask } from '../src/v2/camera.js'
import { elevationBackground, silhouetteOverBackground } from '../src/v2/elevation-background.js'
import { topOffset } from '../src/v2/side-orientation.js'
import type { ElevationFrameV2 } from '../src/v2/frame.js'
import { underMainRoof } from '../src/v2/attached-roof-form.js'
import type { AttachedRoofFormInput } from '../src/v2/attached-roof-form.js'

type Rgb = readonly [number, number, number]
function canvas(w: number, h: number, at: (x: number, y: number) => Rgb): Raster {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) data.set([...at(x, y), 255], (y * w + x) * 4)
  return { width: w, height: h, data }
}
const SKY: Rgb = [178, 215, 237]
/** A crown as rendered: olive leaves, near-black shadows, a fleck of sky between them. */
const crown = (x: number, y: number): Rgb => {
  const k = (x * 7 + y * 13 + ((x * y) % 5)) % 23
  return k < 8 ? [157, 163, 63] : k < 13 ? [66, 71, 17] : k < 17 ? [0, 2, 0] : k < 19 ? [192, 224, 237] : [100, 111, 43]
}
/** A dark tiled roof: a groove every 6 rows. */
const roof = (_x: number, y: number): Rgb => (y % 6 === 0 ? [80, 96, 110] : [105, 124, 144])
const CHIMNEY: Rgb = [112, 128, 139]

describe('EXTERIOR-COMPLETE: a roof before a stand of trees, seen from the side', () => {
  // 400 × 200 at 0.05 m per pixel: the ridge (a level line along the view) at row 80, y = 5.0 m; the crowns behind
  // it from row 10 down to the ridge; a chimney 1.0 m wide standing 1.0 m over the ridge at 9..10 m along
  const W = 400
  const H = 200
  const raster = canvas(W, H, (x, y) => {
    if (y >= 80) return roof(x, y)
    if (x >= 200 && x < 220 && y >= 60) return CHIMNEY
    return y >= 10 ? crown(x, y) : SKY
  })
  const view = { side: 'LEFT', registration: { frameId: 'side' }, pxOf: (a: number) => 20 + a / 0.05, pyOf: (y: number) => 180 - y / 0.05, yOf: (row: number) => (180 - row) * 0.05 } as unknown as ElevationFrameV2
  const profile = { from: 0, to: 18, topAt: () => 5.0, ceilingY: 9.5 }

  it('the walk reads the roof\'s top, not the crowns over it', () => {
    const found = topOffset(view, raster, profile, skyMask(raster))
    expect(found).toBeDefined()
    expect(Math.abs(found?.offsetM ?? 9)).toBeLessThanOrEqual(0.1)
  })
  it('the crowns and the sky between them are background; the dark roof and the chimney are not', () => {
    const bg = elevationBackground(raster, skyMask(raster))
    const at = (x: number, y: number) => bg.data[y * W + x]
    let crowns = 0
    let n = 0
    for (let y = 14; y < 74; y += 3) for (let x = 30; x < 190; x += 3) { n += 1; crowns += at(x, y) }
    expect(crowns / n).toBeGreaterThan(0.95)
    for (let x = 0; x < W; x += 1) expect(at(x, 82)).toBe(0)
    for (let y = 62; y < 80; y += 1) expect(at(210, y)).toBe(0)
  })
})

describe('EXTERIOR-COMPLETE: the outline of a render set before trees', () => {
  // 500 × 260: trees on both sides down to the ground, a gable house 100..400 with its apex at row 60, its walls from
  // row 150 to the ground at row 240, a chimney over the left slope reaching row 40, a paved strip along the ground
  const W = 500
  const H = 260
  const apexX = 250
  const apexY = 60
  const raster = canvas(W, H, (x, y) => {
    if (y >= 236 && y < 246 && x >= 40 && x < 460) return [150, 150, 150]
    if (y >= 246) return [96, 140, 60]
    if (x >= 100 && x < 400) {
      const rake = apexY + Math.abs(x - apexX) * 0.6
      if (y >= 150) return [180, 182, 186]
      if (y >= rake) return roof(x, y)
      if (x >= 180 && x < 196 && y >= 40) return CHIMNEY
    }
    return x < 70 || x >= 430 || y >= 30 ? crown(x, y) : SKY
  })
  it('spans the house from wall to wall, its top the apex, the chimney and the paving left out', () => {
    const s = silhouetteOverBackground(raster, skyMask(raster), 240)
    expect(s).toBeDefined()
    expect(Math.abs((s?.extent.x0 ?? 0) - 100)).toBeLessThanOrEqual(3)
    expect(Math.abs((s?.extent.x1 ?? 0) - 400)).toBeLessThanOrEqual(3)
    expect(Math.abs((s?.extent.y0 ?? 0) - apexY)).toBeLessThanOrEqual(3)
    expect(s?.extent.y1).toBe(240)
    expect(s?.why).toMatch(/chimney/)
  })
})

describe('EXTERIOR-COMPLETE: a body the main roof runs on over', () => {
  const main = { ridgeAxis: 'Z' as const, ridgeAt: 4.35, eaveY: 3.14, ridgeY: 6.18, pitchDeg: 35, footprint: { x0: 0, x1: 8.7, z0: 6.25, z1: 21.25 } }
  const input = (body: { x0: number; x1: number; z0: number; z1: number }): AttachedRoofFormInput => ({ views: [], body, wallTopY: 3.27, eaveBuildUpM: 0, occluders: [], ceilingY: 7.7, mainRoof: main })
  it('a body within the main roof\'s width at an end of its ridge, its top level at the ridge: the roof runs on over it', () => {
    const under = underMainRoof(input({ x0: 0, x1: 6.82, z0: 0, z1: 6.25 }), 'Z', 2.91, 0.48)
    expect(under?.footprint).toEqual({ x0: 0, x1: 8.7, z0: 0, z1: 21.25 })
  })
  it('not when the top is lower than the ridge, the body wider than the roof, beside its ridge, or the level runs across it', () => {
    expect(underMainRoof(input({ x0: 0, x1: 6.82, z0: 0, z1: 6.25 }), 'Z', 2.0, 0.48)).toBeUndefined()
    expect(underMainRoof(input({ x0: 0, x1: 10.5, z0: 0, z1: 6.25 }), 'Z', 2.91, 0.48)).toBeUndefined()
    expect(underMainRoof(input({ x0: 8.7, x1: 14.9, z0: 6.25, z1: 14.85 }), 'Z', 2.91, 0.48)).toBeUndefined()
    expect(underMainRoof(input({ x0: 0, x1: 6.82, z0: 0, z1: 6.25 }), 'X', 2.91, 0.48)).toBeUndefined()
  })
})
