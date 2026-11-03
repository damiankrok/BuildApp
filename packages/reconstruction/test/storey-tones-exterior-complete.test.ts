/**
 * EXTERIOR-COMPLETE: a body's finish is read storey by storey.
 *
 * The first wrong decision: the ground storey's tone, sampled on its open faces, was painted on every storey of the
 * body, so a house rendered grey below and white above was built grey to the ridge. The front elevation here is that
 * house: a grey ground storey (0..2.8 m), a white attic storey above it up to the eave at 4.6 m, and a dark roof above
 * the eave. The ground storey must read MID, the attic LIGHT, and the roof must never be sampled as the attic's wall.
 * On an eave side the overhang hangs over the attic's band, so the attic is read on the gable ends only.
 */
import { describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-cv'
import type { LevelV2, MassV2 } from '../src/v2/building.js'
import type { ElevationFrameV2 } from '../src/v2/frame.js'
import { readMassTones } from '../src/v2/tones.js'

type Rgb = readonly [number, number, number]
const W = 700
const H = 500
/** 0.02 m per pixel; along 0..12 m from column 50; the ground at row 450. */
const MPP = 0.02
const X0 = 50
const GROUND_ROW = 450

const view = (): ElevationFrameV2 =>
  ({
    registration: { metresPerPixelU: MPP },
    side: 'FRONT',
    planeAt: 0,
    alongOf: (px: number) => (px - X0) * MPP,
    pxOf: (a: number) => X0 + a / MPP,
    yOf: (py: number) => (GROUND_ROW - py) * MPP,
    pyOf: (y: number) => GROUND_ROW - y / MPP,
  }) as unknown as ElevationFrameV2

function raster(bands: ReadonlyArray<{ from: number; to: number; rgb: Rgb }>): Raster {
  const data = new Uint8ClampedArray(W * H * 4)
  for (let py = 0; py < H; py += 1) {
    const y = (GROUND_ROW - py) * MPP
    // the paper (and the render's white point) above and around everything
    const band = bands.find((b) => y >= b.from && y < b.to)
    for (let px = 0; px < W; px += 1) {
      const rgb: Rgb = band && px >= X0 && px <= X0 + 12 / MPP ? band.rgb : [250, 250, 250]
      const o = (py * W + px) * 4
      data[o] = rgb[0]
      data[o + 1] = rgb[1]
      data[o + 2] = rgb[2]
      data[o + 3] = 255
    }
  }
  return { width: W, height: H, data }
}

const MASS: MassV2 = { id: 'main', role: 'MAIN', x0: 0, z0: 0, x1: 12, z1: 9, storeys: [0, 1], featureId: 'f-main', sourceMassId: 'm' }
const LEVELS: LevelV2[] = [
  { index: 0, id: 'lvl-0', elevation: 0, height: 2.8, wallTop: 2.8, featureId: 'f-l0' },
  { index: 1, id: 'lvl-1', elevation: 3.1, height: 2.6, wallTop: 5.7, featureId: 'f-l1' },
]
const GREY: Rgb = [150, 148, 145]
const WHITE: Rgb = [236, 234, 230]
const ROOF: Rgb = [70, 68, 66]
/** The ridge runs front to back: the front elevation is a gable end. */
const GABLE_FRONT = (eaveY: number, hipped = false) => ({ roofs: [{ massId: 'main', eaveY, ridgeY: 8, ridgeAxis: 'Z' as const, pitchDeg: 40, hipped }] })

describe('EXTERIOR-COMPLETE: the finish of each storey is its own reading', () => {
  it('a grey ground storey under a white attic: MID below, LIGHT above, the roof over the eave never sampled', () => {
    const r = raster([
      { from: 0, to: 3.1, rgb: GREY },
      { from: 3.1, to: 4.6, rgb: WHITE },
      { from: 4.6, to: 8, rgb: ROOF },
    ])
    const tones = readMassTones([MASS], [{ view: view(), raster: r }], [], [], LEVELS, GABLE_FRONT(4.6))
    const ground = tones.find((t) => t.storeyIndex === undefined)
    const attic = tones.find((t) => t.storeyIndex === 1)
    expect(ground?.tone).toBe('MID')
    expect(attic?.tone).toBe('LIGHT')
    expect(attic?.share).toBe(1)
  })

  it('without the eave the attic band would reach into the roof: the eave is what keeps it on the wall', () => {
    const r = raster([
      { from: 0, to: 3.1, rgb: GREY },
      { from: 3.1, to: 4.0, rgb: WHITE },
      { from: 4.0, to: 8, rgb: ROOF },
    ])
    const withEave = readMassTones([MASS], [{ view: view(), raster: r }], [], [], LEVELS, GABLE_FRONT(4.0))
    // the band under the eave is 3.4..3.7 m: too thin to read, so the attic has no reading of its own
    expect(withEave.find((t) => t.storeyIndex === 1)).toBeUndefined()
    const withoutEave = readMassTones([MASS], [{ view: view(), raster: r }], [], [], LEVELS)
    expect(withoutEave.find((t) => t.storeyIndex === 1)?.tone).not.toBe('LIGHT')
  })

  it('one finish over both storeys reads the same on both', () => {
    const r = raster([
      { from: 0, to: 4.6, rgb: WHITE },
      { from: 4.6, to: 8, rgb: ROOF },
    ])
    const tones = readMassTones([MASS], [{ view: view(), raster: r }], [], [], LEVELS, GABLE_FRONT(4.6))
    expect(tones.map((t) => [t.storeyIndex ?? 0, t.tone])).toEqual([
      [0, 'LIGHT'],
      [1, 'LIGHT'],
    ])
  })

  it('on an eave side a knee wall under the overhang is not read at all: the overhang over its band is not its wall', () => {
    const r = raster([
      { from: 0, to: 3.1, rgb: GREY },
      { from: 3.1, to: 4.6, rgb: WHITE },
      { from: 4.6, to: 8, rgb: ROOF },
    ])
    const tones = readMassTones([MASS], [{ view: view(), raster: r }], [], [], LEVELS, { roofs: [{ massId: 'main', eaveY: 4.6, ridgeY: 8, ridgeAxis: 'X', pitchDeg: 40 }] })
    expect(tones.find((t) => t.storeyIndex === undefined)?.tone).toBe('MID')
    expect(tones.find((t) => t.storeyIndex === 1)).toBeUndefined()
    // and a roof hipped at its ends has no gable end to read it on
    const hipped = readMassTones([MASS], [{ view: view(), raster: r }], [], [], LEVELS, GABLE_FRONT(4.6, true))
    expect(hipped.find((t) => t.storeyIndex === 1)).toBeUndefined()
  })

  it('a balcony across the gable is not the gable: its length is masked, the wall beside it is read', () => {
    // a white gable with a dark railing across 2..10 m of it at the attic storey
    const r = raster([
      { from: 0, to: 3.1, rgb: GREY },
      { from: 3.1, to: 4.6, rgb: WHITE },
      { from: 4.6, to: 8, rgb: ROOF },
    ])
    for (let py = Math.round(GROUND_ROW - 4.4 / MPP); py <= GROUND_ROW - 3.1 / MPP; py += 1) {
      for (let px = X0 + 2 / MPP; px <= X0 + 10 / MPP; px += 1) {
        const o = (py * W + px) * 4
        r.data[o] = 60
        r.data[o + 1] = 60
        r.data[o + 2] = 62
      }
    }
    const bare = readMassTones([MASS], [{ view: view(), raster: r }], [], [], LEVELS, GABLE_FRONT(4.6))
    expect(bare.find((t) => t.storeyIndex === 1)?.tone).toBe('DARK')
    const masked = readMassTones([MASS], [{ view: view(), raster: r }], [], [], LEVELS, { ...GABLE_FRONT(4.6), balconies: [{ storeyIndex: 1, side: 'FRONT', x0: 2, z0: -1.2, x1: 10, z1: 0 }] })
    expect(masked.find((t) => t.storeyIndex === 1)?.tone).toBe('LIGHT')
  })

  it('a lower body in front whose roof rises into the attic band hides that part of the gable', () => {
    // a single-storey garage before the east half of the front, its pitched roof (dark) reaching 4.4 m
    const r = raster([
      { from: 0, to: 3.1, rgb: GREY },
      { from: 3.1, to: 4.6, rgb: WHITE },
      { from: 4.6, to: 8, rgb: ROOF },
    ])
    for (let py = Math.round(GROUND_ROW - 4.4 / MPP); py <= GROUND_ROW - 3.1 / MPP; py += 1) {
      for (let px = X0 + 5 / MPP; px <= X0 + 12 / MPP; px += 1) {
        const o = (py * W + px) * 4
        r.data[o] = 60
        r.data[o + 1] = 60
        r.data[o + 2] = 62
      }
    }
    const garage: MassV2 = { id: 'garage', role: 'ATTACHED', x0: 5, z0: -6, x1: 12, z1: 0, storeys: [0], featureId: 'f-g', sourceMassId: 'g' }
    const flat = readMassTones([MASS, garage], [{ view: view(), raster: r }], [], [], LEVELS, GABLE_FRONT(4.6))
    expect(flat.find((t) => t.massId === 'main' && t.storeyIndex === 1)?.tone).toBe('DARK')
    const pitched = readMassTones([MASS, garage], [{ view: view(), raster: r }], [], [], LEVELS, { roofs: [...GABLE_FRONT(4.6).roofs, { massId: 'garage', eaveY: 2.8, ridgeY: 4.4, ridgeAxis: 'X', pitchDeg: 30 }] })
    expect(pitched.find((t) => t.massId === 'main' && t.storeyIndex === 1)?.tone).toBe('LIGHT')
  })

  it('on an eave side a full storey under a high eave is read, under the overhang\'s drop', () => {
    // a white ground storey, a grey upper storey to an eave at 6.0 m, the roof above (ridge along the front)
    const tall: LevelV2[] = [LEVELS[0], { index: 1, id: 'lvl-1', elevation: 3.1, height: 2.8, wallTop: 5.9, featureId: 'f-l1' }]
    const r = raster([
      { from: 0, to: 3.1, rgb: WHITE },
      { from: 3.1, to: 6.0, rgb: GREY },
      { from: 6.0, to: 9, rgb: ROOF },
    ])
    const tones = readMassTones([MASS], [{ view: view(), raster: r }], [], [], tall, { roofs: [{ massId: 'main', eaveY: 6.0, ridgeY: 9, ridgeAxis: 'X', pitchDeg: 35 }] })
    expect(tones.find((t) => t.storeyIndex === undefined)?.tone).toBe('LIGHT')
    expect(tones.find((t) => t.storeyIndex === 1)?.tone).toBe('MID')
  })
})

