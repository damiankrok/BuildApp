/**
 * The form of an attached body's roof, read off drawn elevations, and the
 * planes it is built of. Every picture here is drawn in the test from
 * invented dimensions: a sky, a main body with a gable, and an attached body
 * whose roof is flat, pitched seen side on, pitched seen end on, or a wall
 * standing too tall to be a roof at the stated pitch.
 */
import { describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-cv'
import { attachedGableLayout, readAttachedRoofForm } from '../src/v2/attached-roof-form.js'
import type { MainRoofForJoin, PlanBox } from '../src/v2/attached-roof-form.js'
import { decideSideOrientation, mainTopProfile } from '../src/v2/side-orientation.js'
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

/** A view whose columns run along `alongAxis` from `alongAtLeft` at pixel 40, `sign` per pixel. */
function frame(side: ElevationFrameV2['side'], alongAtLeft: number, sign: 1 | -1, shiftM = 0): ElevationFrameV2 {
  const x0 = 40
  return {
    registration: { frameId: `frame-${side.toLowerCase()}`, metresPerPixelU: 1 / PPM, metresPerPixelV: 1 / PPM } as ElevationFrameV2['registration'],
    side,
    planeAt: 0,
    alongOf: (px) => alongAtLeft + (sign * (px - x0)) / PPM,
    pxOf: (a) => x0 + sign * (a - alongAtLeft) * PPM,
    // `shiftM` lifts every height read on the view: a registration whose anchor clipped the apex.
    yOf: (py) => (GROUND_ROW - py) / PPM + shiftM,
    pyOf: (y) => GROUND_ROW - (y - shiftM) * PPM,
  }
}

/** Fill, in world metres through a view, the region under `top(a)` down to the ground, for `a` in [a0, a1]. */
function fillUnder(r: Raster, view: ElevationFrameV2, a0: number, a1: number, top: (a: number) => number, rgb: [number, number, number], from = 0): void {
  const p0 = Math.round(Math.min(view.pxOf(a0), view.pxOf(a1)))
  const p1 = Math.round(Math.max(view.pxOf(a0), view.pxOf(a1)))
  for (let px = p0; px <= p1; px += 1) {
    const a = view.alongOf(px)
    const yTop = Math.round(view.pyOf(top(a)))
    const yBottom = Math.round(view.pyOf(from))
    for (let py = Math.max(0, yTop); py <= Math.min(H - 1, yBottom); py += 1) {
      const o = (py * W + px) * 4
      r.data[o] = rgb[0]
      r.data[o + 1] = rgb[1]
      r.data[o + 2] = rgb[2]
    }
  }
}

// An invented house: a main body 12 m wide (x) and 8 m deep (z), from z = 5
// to 13, its ridge along x at 35°; an attached body 5 m wide, x 3..8, in
// front of it, z 0..5, one storey with its wall head at 3.0 m.
const PITCH = 35
const TAN = Math.tan((PITCH * Math.PI) / 180)
const MAIN_EAVE = 3.0
const MAIN: MainRoofForJoin = { ridgeAxis: 'X', ridgeAt: 9, eaveY: MAIN_EAVE, ridgeY: MAIN_EAVE + 4 * TAN, pitchDeg: PITCH, footprint: { x0: 0, x1: 12, z0: 5, z1: 13 } }
const BODY: PlanBox = { x0: 3, x1: 8, z0: 0, z1: 5 }
const WALL_TOP = 3.0

/** A side view (columns along z) of the main gable and the attached body with the given top. */
function sideView(bodyTop: (z: number) => number, shiftM = 0): { view: ElevationFrameV2; raster: Raster } {
  const view = frame('RIGHT', -1, 1, shiftM)
  const r = canvas()
  fillUnder(r, view, 5, 13, (z) => MAIN.ridgeY - Math.abs(z - MAIN.ridgeAt) * TAN, ROOF, MAIN_EAVE)
  fillUnder(r, view, 5, 13, () => MAIN_EAVE, WALL)
  fillUnder(r, view, 0, 5, bodyTop, ROOF, WALL_TOP)
  fillUnder(r, view, 0, 5, () => WALL_TOP, WALL)
  return { view, raster: r }
}

const input = (views: Array<{ view: ElevationFrameV2; raster: Raster }>) => ({
  views,
  body: BODY,
  wallTopY: WALL_TOP,
  eaveBuildUpM: 0,
  statedPitchDeg: PITCH as number | undefined,
  occluders: [{ x0: 0, x1: 12, z0: 5, z1: 13 }],
  ceilingY: MAIN.ridgeY + 1.5,
  mainRoof: MAIN,
})

describe('the form of an attached body’s roof, read on the elevations', () => {
  it('a flat top at the wall head reads FLAT', () => {
    const form = readAttachedRoofForm(input([sideView(() => WALL_TOP + 0.2)]))
    expect(form.kind).toBe('FLAT')
    expect(form.readings[0].profile).toBe('LOW')
  })

  it('a level top at the stated pitch’s height, seen side on, reads a GABLE with its ridge along the view', () => {
    const rise = 2.5 * TAN
    const form = readAttachedRoofForm(input([sideView(() => WALL_TOP + rise)]))
    expect(form.kind).toBe('GABLE')
    if (form.kind !== 'GABLE') return
    expect(form.ridgeAxis).toBe('Z')
    expect(form.pitchDeg).toBe(PITCH)
    expect(form.pitchSource).toBe('STATED')
    expect(Math.abs(form.measuredRiseM - rise)).toBeLessThan(0.1)
  })

  it('a registration that lifts every height is re-anchored on the main roof’s own top in the same view', () => {
    const rise = 2.5 * TAN
    const form = readAttachedRoofForm(input([sideView(() => WALL_TOP + rise, 0.6)]))
    expect(form.kind).toBe('GABLE')
    if (form.kind !== 'GABLE') return
    expect(Math.abs(form.measuredRiseM - rise)).toBeLessThan(0.1)
  })

  it('a level top far above what the stated pitch allows is left UNREAD, not called a roof', () => {
    const form = readAttachedRoofForm(input([sideView(() => WALL_TOP + 3.4)]))
    expect(form.kind).toBe('UNREAD')
  })

  it('a gable end facing the view reads a GABLE with its ridge running away from the view, pitched as drawn', () => {
    // The front view, columns along x, of a body standing beside the main body, so the view sees it against the sky.
    const body: PlanBox = { x0: 12, x1: 17, z0: 5, z1: 11 }
    const view = frame('FRONT', -1, 1)
    const r = canvas()
    fillUnder(r, view, 0, 12, () => MAIN.ridgeY, ROOF, MAIN_EAVE)
    fillUnder(r, view, 0, 12, () => MAIN_EAVE, WALL)
    fillUnder(r, view, 12, 17, (x) => WALL_TOP + Math.max(0, 2.5 - Math.abs(x - 14.5)) * Math.tan((30 * Math.PI) / 180), ROOF, WALL_TOP)
    fillUnder(r, view, 12, 17, () => WALL_TOP, WALL)
    const form = readAttachedRoofForm({ ...input([{ view, raster: r }]), statedPitchDeg: undefined, body, occluders: [{ x0: 0, x1: 12, z0: 5, z1: 13 }] })
    expect(form.kind).toBe('GABLE')
    if (form.kind !== 'GABLE') return
    expect(form.ridgeAxis).toBe('Z')
    expect(form.pitchSource).toBe('MEASURED')
    expect(Math.abs(form.pitchDeg - 30)).toBeLessThanOrEqual(2)
  })

  it('a flat top in one view and a pitched one in another is a conflict, left open', () => {
    const flat = sideView(() => WALL_TOP + 0.2)
    const pitched = sideView(() => WALL_TOP + 2.5 * TAN)
    const form = readAttachedRoofForm(input([flat, { ...pitched, view: { ...pitched.view, side: 'LEFT' } }]))
    expect(form.kind).toBe('UNREAD')
  })

  it('a view that sees the body only behind another body reads nothing', () => {
    const { view, raster } = sideView(() => WALL_TOP + 2.5 * TAN)
    const form = readAttachedRoofForm({ ...input([{ view, raster }]), occluders: [{ x0: 0, x1: 12, z0: -1, z1: 13 }] })
    expect(form.kind).toBe('UNREAD')
    expect(form.readings).toEqual([])
  })
})

describe('the planes of a gabled attached roof', () => {
  it('a ridge running into the main slope dies into it along two valleys, and the planes stop there', () => {
    const layout = attachedGableLayout(BODY, 'Z', PITCH, MAIN_EAVE, MAIN)
    expect(layout.join.kind).toBe('VALLEY')
    const ridgeY = MAIN_EAVE + 2.5 * TAN
    expect(layout.ridgeY).toBeCloseTo(ridgeY, 5)
    // The main slope rises from its eave at z = 5 at the same pitch: the ridge meets it 2.5 m up.
    expect(layout.ridge[0]).toEqual({ x: 5.5, z: 0 })
    expect(layout.ridge[1].x).toBeCloseTo(5.5, 6)
    expect(layout.ridge[1].z).toBeCloseTo(7.5, 5)
    if (layout.join.kind !== 'VALLEY') return
    for (const v of layout.join.valleys) {
      expect(v.start.z).toBeCloseTo(5, 6)
      expect(v.end.z).toBeCloseTo(7.5, 5)
    }
    // Verges only at the free gable end; both eaves free.
    expect(layout.verges.every((v) => v.start.z === 0 && v.end.z === 0)).toBe(true)
    expect(layout.eaves.map((e) => e.kind)).toEqual(['EAVE', 'EAVE'])
    // Every boundary point of each plane lies on or below the main roof's top where it overlaps the main footprint.
    const mainTop = (z: number): number => MAIN.eaveY + Math.max(0, z - 5) * TAN
    for (const p of layout.planes) {
      const topAt = (x: number): number => MAIN_EAVE + (p.key === 'LOW' ? x - 3 : 8 - x) * TAN
      for (const q of p.boundary) if (q.z > 5) expect(topAt(q.x)).toBeCloseTo(mainTop(q.z), 5)
    }
  })

  it('a ridge that would stand above the main ridge stops at the party line instead', () => {
    const wide: PlanBox = { x0: 0, x1: 12, z0: 0, z1: 5 }
    const layout = attachedGableLayout(wide, 'Z', 50, MAIN_EAVE, MAIN)
    expect(layout.join.kind).toBe('ABUTMENT')
    expect(Math.max(...layout.planes.flatMap((p) => p.boundary.map((q) => q.z)))).toBe(5)
  })

  it('a body beside the main body with its ridge parallel to the party wall abuts that wall along its eave', () => {
    const beside: PlanBox = { x0: 12, x1: 16, z0: 6, z1: 11 }
    const layout = attachedGableLayout(beside, 'Z', PITCH, 2.8, MAIN)
    expect(layout.join.kind).toBe('FREE')
    expect(layout.eaves.find((e) => e.key === 'LOW')?.kind).toBe('ABUTMENT')
    expect(layout.eaves.find((e) => e.key === 'HIGH')?.kind).toBe('EAVE')
    expect(layout.verges).toHaveLength(4)
  })
})

describe('which unlabelled side view is which', () => {
  const profile = mainTopProfile(MAIN, 'Z')

  it('a view assigned the wrong way round fits the main body’s profile better mirrored, and is swapped', () => {
    const { raster } = sideView(() => WALL_TOP + 0.2)
    const truth = frame('RIGHT', -1, 1)
    // The same picture read as the opposite wall: along runs the other way over the same pixels.
    const along0 = -1 + (W - 80) / PPM
    const wrong = frame('LEFT', along0, -1)
    const decision = decideSideOrientation([{ current: wrong, mirrored: truth, raster }], profile, new Map())
    expect(decision.swap).toBe(true)
    const kept = decideSideOrientation([{ current: truth, mirrored: wrong, raster }], profile, new Map())
    expect(kept.swap).toBe(false)
  })

  it('a symmetric side profile gives no margin, and the assignment stands', () => {
    const symmetric: MainRoofForJoin = { ...MAIN, footprint: { x0: 0, x1: 12, z0: 0, z1: 20 }, ridgeAt: 10 }
    const view = frame('RIGHT', -1, 1)
    const r = canvas()
    fillUnder(r, view, 0, 20, (z) => symmetric.ridgeY - Math.min(10, Math.abs(z - 10)) * TAN * 0.3, ROOF, MAIN_EAVE)
    fillUnder(r, view, 0, 20, () => MAIN_EAVE, WALL)
    const mirrored = frame('LEFT', -1 + 20 + 2 * 1, -1)
    const decision = decideSideOrientation([{ current: view, mirrored, raster: r }], mainTopProfile(symmetric, 'Z'), new Map())
    expect(decision.swap).toBe(false)
  })
})
