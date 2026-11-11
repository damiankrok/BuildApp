/**
 * v3.53.4 — a roof crossing the main one, read on the view that looks down the main ridge (`readTopWithMain` in
 * `attached-roof-form.ts`). Every picture is drawn here from invented dimensions.
 *
 * The house: a main body 12 m long (x) and 8 m deep (z 5..13), its ridge along x at 35°, and a one-storey body on each
 * side of it across the ridge, x 0..8 (z 0..5 and z 13..17). Where those two carry one roof through the main one — a
 * second ridge along z at the main ridge's height — the view from the side shows no main gable at all: one level top
 * line from end to end. The reader used to drop that view (the main roof "is not where the registration puts it"), and
 * with it the only evidence of the crossing roof; the bodies were then given flat roofs by convention.
 */
import { describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-cv'
import { readAttachedRoofForm } from '../src/v2/attached-roof-form.js'
import type { MainRoofForJoin, PlanBox } from '../src/v2/attached-roof-form.js'
import type { ElevationFrameV2 } from '../src/v2/frame.js'

const PPM = 40
const W = 900
const H = 420
const GROUND_ROW = 380
const SKY: [number, number, number] = [150, 190, 235]
const WALL: [number, number, number] = [70, 70, 72]
const ROOF: [number, number, number] = [60, 58, 55]

function canvas(): Raster {
  const data = new Uint8ClampedArray(W * H * 4)
  for (let i = 0; i < W * H; i += 1) {
    data[i * 4] = SKY[0]
    data[i * 4 + 1] = SKY[1]
    data[i * 4 + 2] = SKY[2]
    data[i * 4 + 3] = 255
  }
  return { width: W, height: H, data }
}

/** A side view: columns run along z from −1 m at pixel 40. */
function side(): ElevationFrameV2 {
  return {
    registration: { frameId: 'frame-right', metresPerPixelU: 1 / PPM, metresPerPixelV: 1 / PPM } as ElevationFrameV2['registration'],
    side: 'RIGHT',
    planeAt: 0,
    alongOf: (px) => -1 + (px - 40) / PPM,
    pxOf: (a) => 40 + (a + 1) * PPM,
    yOf: (py) => (GROUND_ROW - py) / PPM,
    pyOf: (y) => GROUND_ROW - y * PPM,
  }
}

function fillUnder(r: Raster, view: ElevationFrameV2, a0: number, a1: number, top: (a: number) => number, rgb: [number, number, number], from = 0): void {
  for (let px = Math.round(view.pxOf(a0)); px <= Math.round(view.pxOf(a1)); px += 1) {
    const yTop = Math.round(view.pyOf(top(view.alongOf(px))))
    const yBottom = Math.round(view.pyOf(from))
    for (let py = Math.max(0, yTop); py <= Math.min(H - 1, yBottom); py += 1) {
      const o = (py * W + px) * 4
      r.data[o] = rgb[0]
      r.data[o + 1] = rgb[1]
      r.data[o + 2] = rgb[2]
    }
  }
}

const PITCH = 35
const TAN = Math.tan((PITCH * Math.PI) / 180)
const EAVE = 3.0
const RIDGE = EAVE + 4 * TAN
const MAIN: MainRoofForJoin = { ridgeAxis: 'X', ridgeAt: 9, eaveY: EAVE, ridgeY: RIDGE, pitchDeg: PITCH, footprint: { x0: 0, x1: 12, z0: 5, z1: 13 } }
const FRONT_BODY: PlanBox = { x0: 0, x1: 8, z0: 0, z1: 5 }
const REAR_BODY: PlanBox = { x0: 0, x1: 8, z0: 13, z1: 17 }

/** The side view with the given top line over each of the three stretches along z. */
function view(tops: { front: (z: number) => number; main: (z: number) => number; rear: (z: number) => number }): { view: ElevationFrameV2; raster: Raster } {
  const v = side()
  const r = canvas()
  fillUnder(r, v, 0, 5, tops.front, ROOF, EAVE)
  fillUnder(r, v, 5, 13, tops.main, ROOF, EAVE)
  fillUnder(r, v, 13, 17, tops.rear, ROOF, EAVE)
  fillUnder(r, v, 0, 17, () => EAVE, WALL)
  return { view: v, raster: r }
}
const gable = (z: number): number => RIDGE - Math.abs(z - 9) * TAN
const level = (): number => RIDGE
const flat = (): number => EAVE + 0.2

const formOf = (views: Array<{ view: ElevationFrameV2; raster: Raster }>, body: PlanBox, other: PlanBox) =>
  readAttachedRoofForm({ views, body, wallTopY: EAVE, eaveBuildUpM: 0, statedPitchDeg: PITCH, occluders: [other, MAIN.footprint], ceilingY: RIDGE + 1.5, mainRoof: MAIN })

describe('a roof crossing the main one (v3.53.4)', () => {
  it('one level top line over the main body and over a body beside it, on the view down the main ridge, is a ridge across the main one at its height', () => {
    const v = view({ front: level, main: level, rear: level })
    for (const [body, other] of [[FRONT_BODY, REAR_BODY], [REAR_BODY, FRONT_BODY]] as const) {
      const form = formOf([v], body, other)
      expect(form.kind === 'GABLE' || form.kind === 'UNREAD').toBe(true)
      if (form.kind !== 'GABLE' && form.kind !== 'UNREAD') continue
      expect(form.crossMainTop?.ridgeAxis).toBe('Z')
      expect(form.crossMainTop?.frameIds).toEqual(['frame-right'])
      const reading = form.readings.find((r) => r.atMainTop)
      expect(reading?.profile).toBe('LEVEL')
      // the height is the main ridge's, by identity with the main body's top line, not by the view's metres
      expect(reading?.riseM).toBeCloseTo(RIDGE - EAVE, 6)
    }
  })

  it('counter-case: the view shows the main gable and a flat body beside it — a flat roof, and no crossing roof', () => {
    const form = formOf([view({ front: flat, main: gable, rear: flat })], FRONT_BODY, REAR_BODY)
    expect(form.kind).toBe('FLAT')
    expect('crossMainTop' in form).toBe(false)
  })

  it('counter-case: a level line over the main body alone, the body beside it low — nothing crosses over that body', () => {
    const form = formOf([view({ front: flat, main: level, rear: level })], FRONT_BODY, REAR_BODY)
    expect(form.kind).toBe('UNREAD')
    expect(form.kind === 'UNREAD' ? form.crossMainTop : 'x').toBeUndefined()
    expect(form.readings.some((r) => r.atMainTop)).toBe(false)
  })

  it('counter-case: a level top over the body below the main body’s line — a lower roof of its own, not the crossing one', () => {
    const lower = (): number => RIDGE - 1.2
    const form = formOf([view({ front: lower, main: level, rear: level })], FRONT_BODY, REAR_BODY)
    expect(form.readings.some((r) => r.atMainTop)).toBe(false)
    expect(form.kind === 'GABLE' || form.kind === 'UNREAD' ? form.crossMainTop : undefined).toBeUndefined()
  })

  it('counter-case: a gable end over the body on that view is not a level line', () => {
    const peak = (z: number): number => EAVE + Math.max(0, 2.5 - Math.abs(z - 2.5)) * TAN
    const form = formOf([view({ front: peak, main: level, rear: level })], FRONT_BODY, REAR_BODY)
    expect(form.readings.some((r) => r.atMainTop)).toBe(false)
  })
})
