/**
 * v3.46: an attached body's roof form is not erased by a view whose heights cannot be trusted.
 *
 * Every picture is drawn here from invented dimensions (the same invented house as attached-roof-form.test.ts): a main
 * gable 12 × 8 m, ridge along x at 35°, and an attached body x 3..8, z 0..5 with its wall head at 3.0 m. Two failures
 * found on a development elevation are reproduced: something standing behind the main slope (tree crowns the
 * background model did not take, a chimney) moved the plain median anchor; and a view whose registration was refused
 * could still be read through that registration. Paired with the opposite cases: a real flat roof stays flat, a view
 * that cannot be anchored gives no reading at all rather than a flat one.
 */
import { describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-cv'
import { readAttachedRoofForm } from '../src/v2/attached-roof-form.js'
import type { MainRoofForJoin, PlanBox } from '../src/v2/attached-roof-form.js'
import { topLineOffset } from '../src/v2/side-orientation.js'
import type { ElevationFrameV2 } from '../src/v2/frame.js'

const PPM = 40
const W = 900
const H = 420
const GROUND_ROW = 380
const SKY: [number, number, number] = [150, 190, 235]
const WALL: [number, number, number] = [70, 70, 72]
const ROOF: [number, number, number] = [60, 58, 55]
// a dark, grey-brown mass: neither sky nor plant-coloured (what the background model misses)
const OCCLUDER: [number, number, number] = [45, 40, 38]

function canvas(): Raster {
  const data = new Uint8ClampedArray(W * H * 4)
  for (let i = 0; i < W * H; i += 1) {
    data.set([SKY[0], SKY[1], SKY[2], 255], i * 4)
  }
  return { width: W, height: H, data }
}

function frame(shiftM = 0): ElevationFrameV2 {
  const x0 = 40
  const alongAtLeft = -1
  return {
    registration: { frameId: 'frame-right', metresPerPixelU: 1 / PPM, metresPerPixelV: 1 / PPM } as ElevationFrameV2['registration'],
    side: 'RIGHT',
    planeAt: 0,
    alongOf: (px) => alongAtLeft + (px - x0) / PPM,
    pxOf: (a) => x0 + (a - alongAtLeft) * PPM,
    yOf: (py) => (GROUND_ROW - py) / PPM + shiftM,
    pyOf: (y) => GROUND_ROW - (y - shiftM) * PPM,
  }
}

function fillUnder(r: Raster, view: ElevationFrameV2, a0: number, a1: number, top: (a: number) => number, rgb: [number, number, number], from = 0): void {
  const p0 = Math.round(Math.min(view.pxOf(a0), view.pxOf(a1)))
  const p1 = Math.round(Math.max(view.pxOf(a0), view.pxOf(a1)))
  for (let px = p0; px <= p1; px += 1) {
    const a = view.alongOf(px)
    const yTop = Math.round(view.pyOf(top(a)))
    const yBottom = Math.round(view.pyOf(from))
    for (let py = Math.max(0, yTop); py <= Math.min(H - 1, yBottom); py += 1) r.data.set(rgb, (py * W + px) * 4)
  }
}

const PITCH = 35
const TAN = Math.tan((PITCH * Math.PI) / 180)
const MAIN_EAVE = 3.0
const MAIN: MainRoofForJoin = { ridgeAxis: 'X', ridgeAt: 9, eaveY: MAIN_EAVE, ridgeY: MAIN_EAVE + 4 * TAN, pitchDeg: PITCH, footprint: { x0: 0, x1: 12, z0: 5, z1: 13 } }
const BODY: PlanBox = { x0: 3, x1: 8, z0: 0, z1: 5 }
const WALL_TOP = 3.0
const RISE = 2.5 * TAN

/** The right side view of the main gable and the attached body; optionally a dark mass behind the main slope's far half. */
function view(bodyTop: (z: number) => number, opts: { shiftM?: number; occluded?: [number, number] } = {}): { view: ElevationFrameV2; raster: Raster } {
  const v = frame(opts.shiftM ?? 0)
  const r = canvas()
  if (opts.occluded) fillUnder(r, v, opts.occluded[0], opts.occluded[1], () => MAIN.ridgeY + 0.3, OCCLUDER, MAIN_EAVE)
  fillUnder(r, v, 5, 13, (z) => MAIN.ridgeY - Math.abs(z - MAIN.ridgeAt) * TAN, ROOF, MAIN_EAVE)
  fillUnder(r, v, 5, 13, () => MAIN_EAVE, WALL)
  fillUnder(r, v, 0, 5, bodyTop, ROOF, WALL_TOP)
  fillUnder(r, v, 0, 5, () => WALL_TOP, WALL)
  return { view: v, raster: r }
}

const input = (views: Array<{ view: ElevationFrameV2; raster: Raster }>, extra: Partial<Parameters<typeof readAttachedRoofForm>[0]> = {}) => ({
  views,
  body: BODY,
  wallTopY: WALL_TOP,
  eaveBuildUpM: 0,
  statedPitchDeg: PITCH as number | undefined,
  occluders: [{ x0: 0, x1: 12, z0: 5, z1: 13 }],
  ceilingY: MAIN.ridgeY + 1.5,
  mainRoof: MAIN,
  ...extra,
})

// the main slope's far half (z 9..13, read from 9.2 to 12.8) is two-thirds covered from z 10.4 on
const BEHIND: [number, number] = [10.4, 13.4]

describe('v3.46: the main roof line that anchors a view’s heights', () => {
  it('residuals with no occluder give their plain median', () => {
    const r = [0.02, -0.03, 0.01, 0.0, 0.04, -0.01, 0.03, 0.02, -0.02, 0.01, 0.0, 0.02]
    expect(topLineOffset(r)?.offsetM).toBeCloseTo(0.01, 2)
  })

  it('columns raised by something behind the roof do not move the anchor: the lowest line that holds a fair share does', () => {
    // the development case's shape: eight columns on the slope (+0.06..+0.09), eight on crowns and a chimney (+0.5..+1.1)
    const r = [0.06, 0.08, 0.07, 0.09, 0.06, 0.08, 0.09, 0.07, 0.73, 0.48, 1.01, 1.0, 0.95, 0.9, 1.1, 0.62]
    const line = topLineOffset(r)
    expect(line?.offsetM).toBeCloseTo(0.08, 2)
    expect(line?.support).toBe(8)
  })

  it('a scatter with no line holding a fair share anchors nothing', () => {
    expect(topLineOffset([0, 0.5, 1.0, 1.5, 2.0, -0.5, -1.0, -1.5, 0.25, 0.75, 1.25, 1.75])).toBeUndefined()
  })
})

describe('v3.46: a pitched attached roof is not erased by an untrustworthy view', () => {
  it('a mass behind the main slope over two-thirds of its far half no longer refuses the view: the gable reads (failed before v3.46)', () => {
    const form = readAttachedRoofForm(input([view(() => WALL_TOP + RISE, { shiftM: 0.6, occluded: BEHIND })]))
    expect(form.kind).toBe('GABLE')
    if (form.kind !== 'GABLE') return
    expect(Math.abs(form.measuredRiseM - RISE)).toBeLessThan(0.1)
  })

  it('opposite: a real flat roof behind the same mass stays FLAT — the anchor never lifts a slab into a roof', () => {
    const form = readAttachedRoofForm(input([view(() => WALL_TOP + 0.2, { shiftM: 0.6, occluded: BEHIND })]))
    expect(form.kind).toBe('FLAT')
  })

  it('a refused view with the main roof line to anchor it still reads, flat or pitched', () => {
    const refused = new Set(['frame-right'])
    expect(readAttachedRoofForm(input([view(() => WALL_TOP + RISE, { shiftM: 0.6 })], { verticalRefused: refused })).kind).toBe('GABLE')
    expect(readAttachedRoofForm(input([view(() => WALL_TOP + 0.2, { shiftM: 0.6 })], { verticalRefused: refused })).kind).toBe('FLAT')
  })

  it('a refused view with nothing in the picture to anchor it gives no reading — not a flat roof', () => {
    const refused = new Set(['frame-right'])
    // no main roof to anchor on, and the registration shifted by 0.6 m: read through it, the slab would look like a low top
    const flat = readAttachedRoofForm(input([view(() => WALL_TOP + 0.2, { shiftM: 0.6 })], { verticalRefused: refused, mainRoof: undefined }))
    expect(flat.kind).toBe('UNREAD')
    expect(flat.readings).toHaveLength(0)
    // opposite: the same view not refused is read through its registration as before
    expect(readAttachedRoofForm(input([view(() => WALL_TOP + 0.2)], { mainRoof: undefined })).kind).toBe('FLAT')
  })
})
