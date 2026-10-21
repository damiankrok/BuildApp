/**
 * The base plan's frame scale against its drawn outer faces, on invented sheets: a stated overall dimension runs from
 * outer face to outer face, so a registration that lays it several pixels past a drawn face is rescaled, and one that
 * lands within a pixel or so is left alone.
 */
import { describe, expect, it } from 'vitest'
import { faceToFaceMetresPerPixel, outerFacesAlong } from '../src/v2/frame.js'

const hBand = (y0: number, y1: number, length = 400) => ({ axis: 'HORIZONTAL' as const, bounds: { x0: 0, y0, x1: length - 1, y1 }, length })
const vBand = (x0: number, x1: number, length = 400) => ({ axis: 'VERTICAL' as const, bounds: { x0, y0: 0, x1, y1: length - 1 }, length })
/** A ladder that states `metres` between the extent's ends and runs at `mpp` elsewhere. */
const ladder = (from: number, to: number, metres: number) => (px: number) => (px <= from ? 0 : px >= to ? metres : ((px - from) / (to - from)) * metres)

describe('outerFacesAlong', () => {
  it('takes the outer edges of the long wall bands at each end; inclusive bounds end one pixel later', () => {
    expect(outerFacesAlong([hBand(149, 170), hBand(536, 556)], 'Y', 149, 557)).toEqual({ from: 149, to: 557 })
    expect(outerFacesAlong([vBand(229, 249), vBand(724, 744)], 'X', 228, 745)).toEqual({ from: 229, to: 745 })
  })
  it('a chain that stops on a wall’s inner face is no face-to-face statement: the outer face is a wall away', () => {
    expect(outerFacesAlong([hBand(60, 80), hBand(413, 420)], 'Y', 60, 413)).toBeUndefined()
  })
  it('a short band (a chimney, a pier) is no face, and an end with no wall band near it gives nothing', () => {
    expect(outerFacesAlong([hBand(149, 170), hBand(536, 556, 40)], 'Y', 149, 557)).toBeUndefined()
    expect(outerFacesAlong([hBand(149, 170), hBand(400, 420)], 'Y', 149, 557)).toBeUndefined()
  })
})

describe('faceToFaceMetresPerPixel', () => {
  it('a registration that ends 8.30 m five pixels past the drawn face is rescaled to the faces', () => {
    const mpp = faceToFaceMetresPerPixel(ladder(149, 557, 8.3), 149, 557, { from: 149, to: 557 }, 0.020108)
    expect(mpp).toBeCloseTo(8.3 / 408, 9)
  })
  it('a registration within a pixel of the faces stands, byte for byte', () => {
    expect(faceToFaceMetresPerPixel(ladder(167.5, 479.5, 8.5), 167.5, 479.5, { from: 168, to: 476 }, 0.02752)).toBe(0.02752)
  })
  it('nothing stated, no faces, or a rescale beyond 3 % leaves the sheet scale', () => {
    expect(faceToFaceMetresPerPixel(undefined, 0, 400, { from: 0, to: 400 }, 0.02)).toBe(0.02)
    expect(faceToFaceMetresPerPixel(ladder(0, 400, 8.0), 0, 400, undefined, 0.0201)).toBe(0.0201)
    expect(faceToFaceMetresPerPixel(ladder(0, 400, 9.0), 0, 400, { from: 0, to: 400 }, 0.02)).toBe(0.02)
  })
})
