/**
 * §15's stripe test: a band of tone on a facade is a SURFACE until something
 * with depth backs it.
 *
 * A rendered elevation clad in horizontal boards shows a hundred thin bands
 * of two alternating tones. A reader that took each band for a member would
 * fill the model with a hundred fascias; the readers here must take none of
 * them, and the one thing they may return is a band anchored to the slab
 * level they were asked about, with its evidence written in `why`. The
 * positive control is the same reader on a plain wall with one dark band at
 * the slab level, which it must find where it is.
 */
import { describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-cv'
import { readFasciaBand, readRailing, readVergeMember, stripesToMembers } from '../src/v2/facade.js'
import type { FacadeMember } from '../src/v2/facade.js'
import { elevationFrameFromV2 } from '../src/v2/frame.js'
import type { ElevationFrameV2, ElevationRegistrationV2, WorldFrameV2 } from '../src/v2/frame.js'
import { toneClass, toneRuns } from '../src/v2/scan.js'

type Rgb = readonly [number, number, number]

const WIDTH = 800
const HEIGHT = 400
/** 600 px across the facade is 12 m: 0.02 m per pixel, 8 m of height in 400 rows. */
const MPP = 0.02
const EXTENT = { x0: 100, y0: 0, x1: 700, y1: HEIGHT }
const LIGHT: Rgb = [232, 232, 232]
const MID: Rgb = [150, 150, 150]
const DARK: Rgb = [40, 40, 40]

const WORLD: WorldFrameV2 = {
  envelope: { x0: 0, z0: 0, x1: 12, z1: 10 },
  walled: { x0: 0, z0: 1, x1: 12, z1: 9 },
  zFlip: 9,
  frontSide: 'SHEET_BOTTOM',
  why: 'a synthetic frame: a 12 m wide front with a metre of zone before it',
}

/** A hand-made registration of the whole raster as the front elevation, ground at the bottom row. */
const REGISTRATION: ElevationRegistrationV2 = {
  frameId: 'frame-stripes',
  assetId: 'asset-stripes',
  side: 'FRONT',
  sideConfidence: 1,
  sideWhy: 'the fixture states it',
  mpp: MPP,
  extent: EXTENT,
  alongAtLeft: 0,
  alongSign: 1,
  zeroRow: EXTENT.y1,
  spanM: 12,
  spanWhy: 'the fixture states it',
  bottomY: 0,
  anisotropyCheck: 0,
  confidence: 1,
  why: 'a hand-made registration: 600 px across is 12 m, one scale for both axes',
}

const view = (): ElevationFrameV2 => elevationFrameFromV2(REGISTRATION, WORLD)

function blank(rgb: Rgb): Raster {
  const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4)
  for (let i = 0; i < WIDTH * HEIGHT; i += 1) {
    data[i * 4] = rgb[0]
    data[i * 4 + 1] = rgb[1]
    data[i * 4 + 2] = rgb[2]
    data[i * 4 + 3] = 255
  }
  return { width: WIDTH, height: HEIGHT, data }
}

/** Paint rows `y0..y1` (inclusive) across the whole raster. */
function paintRows(r: Raster, y0: number, y1: number, rgb: Rgb): void {
  for (let y = y0; y <= y1; y += 1) {
    for (let x = 0; x < r.width; x += 1) {
      const o = (y * r.width + x) * 4
      r.data[o] = rgb[0]
      r.data[o + 1] = rgb[1]
      r.data[o + 2] = rgb[2]
      r.data[o + 3] = 255
    }
  }
}

/** A hundred alternating 4-px stripes of two tones across the whole facade. */
function stripedFacade(): Raster {
  const r = blank(LIGHT)
  const stripePx = HEIGHT / 100
  for (let i = 0; i < 100; i += 1) paintRows(r, i * stripePx, (i + 1) * stripePx - 1, i % 2 === 0 ? LIGHT : MID)
  return r
}

const MOUTH = { along0: 2, along1: 10 }
const SLAB_LEVELS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6]

/** A member's `why` names what was read: a band, how tall, on how many columns. */
const namesItsEvidence = (member: FacadeMember): void => {
  expect(member.why.length).toBeGreaterThan(20)
  expect(member.why).toMatch(/band/)
  expect(member.why).toMatch(/\d+ columns/)
  expect(member.frameIds).toEqual([REGISTRATION.frameId])
  expect(member.evidence).toBe('RENDER_BAND')
}

describe('a hundred stripes on a facade are a surface, not a hundred members', () => {
  it('the picture is what the test says it is: two tones, a hundred runs down every column', () => {
    expect(toneClass(LIGHT)).toBe('LIGHT')
    expect(toneClass(MID)).toBe('MID')
    expect(toneClass(DARK)).toBe('DARK')
    const runs = toneRuns(stripedFacade(), 'Y', 400, 0, HEIGHT - 1)
    expect(runs).toHaveLength(100)
    expect(new Set(runs.map((r) => r.tone))).toEqual(new Set(['LIGHT', 'MID']))
  })

  it('stripesToMembers backs no stripe without depth evidence, and only the ones at a slab level with it', () => {
    const v = view()
    const runs = toneRuns(stripedFacade(), 'Y', 400, 0, HEIGHT - 1)
    const stripes = runs.map((r) => ({ y: [v.yOf(r.to + 1), v.yOf(r.from)] as [number, number], along: [0, 12] as [number, number] }))
    expect(stripes).toHaveLength(100)
    expect(stripesToMembers(stripes, [])).toEqual([])
    for (const level of [1.5, 3, 4.5]) {
      const backed = stripesToMembers(stripes, [{ y: [level - 0.1, level + 0.1], kind: 'SLAB_LEVEL' }])
      // a slab is a fraction of a metre: it backs the few stripes it overlaps, not the field
      expect(backed.length, `slab at ${level} m`).toBeGreaterThan(0)
      expect(backed.length, `slab at ${level} m`).toBeLessThanOrEqual(6)
      for (const i of backed) {
        expect(stripes[i].y[1], `stripe ${i} is below the slab at ${level} m`).toBeGreaterThanOrEqual(level - 0.1 - 0.05)
        expect(stripes[i].y[0], `stripe ${i} is above the slab at ${level} m`).toBeLessThanOrEqual(level + 0.1 + 0.05)
      }
    }
    const allThree = stripesToMembers(stripes, [1.5, 3, 4.5].map((level) => ({ y: [level - 0.1, level + 0.1] as [number, number], kind: 'SLAB_LEVEL' as const })))
    expect(allThree.length).toBeLessThanOrEqual(18)
    expect(allThree.length).toBeLessThan(stripes.length / 5)
  })

  it('the fascia and railing readers return nothing, or one band anchored to the slab level they were asked about', () => {
    const v = view()
    const raster = stripedFacade()
    const fascias: FacadeMember[] = []
    const railings: FacadeMember[] = []
    for (const level of SLAB_LEVELS) {
      const fascia = readFasciaBand(raster, v, MOUTH, level, v.planeAt)
      if (fascia) {
        expect(fascia.kind).toBe('FASCIA_BAND')
        // its top is within the reader's own reach of the slab level it was given
        expect(Math.abs(fascia.y[1] - level), `fascia for the slab at ${level} m sits at ${fascia.y[0]}..${fascia.y[1]}`).toBeLessThanOrEqual(0.4)
        expect(fascia.y[1] - fascia.y[0]).toBeGreaterThanOrEqual(0.25)
        namesItsEvidence(fascia)
        fascias.push(fascia)
      }
      const railing = readRailing(raster, v, MOUTH, level, v.planeAt)
      if (railing) {
        expect(railing.kind).toBe('RAILING')
        // a railing stands ON the slab it was asked about, never on a stripe of its own choosing
        expect(railing.y[0]).toBe(level)
        expect(railing.y[1] - railing.y[0]).toBeGreaterThanOrEqual(0.5)
        expect(railing.y[1] - railing.y[0]).toBeLessThanOrEqual(1.4)
        namesItsEvidence(railing)
        railings.push(railing)
      }
    }
    // never one member per stripe: at most one per slab level asked about
    expect(fascias.length).toBeLessThanOrEqual(SLAB_LEVELS.length)
    expect(railings.length).toBeLessThanOrEqual(SLAB_LEVELS.length)
    expect(fascias.length + railings.length).toBeLessThan(100 / 4)
    // and a thin stripe is never a fascia: nothing here is a quarter of a metre thick
    expect(fascias).toEqual([])
  })

  it('the verge reader finds at most one member along a striped gable, and says what it read', () => {
    const v = view()
    const raster = stripedFacade()
    const member = readVergeMember(raster, v, { along0: 0, along1: 12, ridgeAlong: 6, eaveY: 5, ridgeY: 7.5 }, undefined)
    if (member) {
      expect(member.kind).toBe('VERGE_MEMBER')
      expect(member.why).toMatch(/band/)
      expect(member.why).toMatch(/columns/)
      expect(member.frameIds).toEqual([REGISTRATION.frameId])
    }
    // a 4-px stripe is 0.08 m: far too thin for a verge board, so nothing is read here
    expect(member).toBeUndefined()
  })
})

describe('positive control: one dark band at the slab level of a plain wall', () => {
  const SLAB_Y = 3
  const v = view()
  // the band's top just above the slab level, its bottom 0.36 m below that
  const topRow = Math.round(v.pyOf(SLAB_Y + 0.05))
  const bottomRow = topRow + 17
  const expectedTop = v.yOf(topRow)
  const expectedBottom = v.yOf(bottomRow + 1)
  const wall = (): Raster => {
    const r = blank(LIGHT)
    paintRows(r, topRow, bottomRow, DARK)
    return r
  }

  it('is found by readFasciaBand at the right height', () => {
    const fascia = readFasciaBand(wall(), v, MOUTH, SLAB_Y, v.planeAt)
    expect(fascia).toBeDefined()
    if (!fascia) return
    expect(fascia.kind).toBe('FASCIA_BAND')
    expect(Math.abs(fascia.y[1] - expectedTop)).toBeLessThanOrEqual(0.05)
    expect(Math.abs(fascia.y[0] - expectedBottom)).toBeLessThanOrEqual(0.05)
    expect(Math.abs(fascia.y[1] - SLAB_Y)).toBeLessThanOrEqual(0.05)
    expect(fascia.along).toEqual([MOUTH.along0, MOUTH.along1])
    expect(fascia.planeAt).toBe(v.planeAt)
    namesItsEvidence(fascia)
    expect(fascia.why).toMatch(/dark tone/)
  })

  it('and is not returned for a slab level it does not sit at', () => {
    const raster = wall()
    expect(readFasciaBand(raster, v, MOUTH, SLAB_Y + 1.5, v.planeAt)).toBeUndefined()
    expect(readFasciaBand(raster, v, MOUTH, SLAB_Y - 1.5, v.planeAt)).toBeUndefined()
  })

  it('and a plain wall with no band yields nothing at any level', () => {
    const raster = blank(LIGHT)
    for (const level of SLAB_LEVELS) {
      expect(readFasciaBand(raster, v, MOUTH, level, v.planeAt), `slab at ${level} m`).toBeUndefined()
      expect(readRailing(raster, v, MOUTH, level, v.planeAt), `slab at ${level} m`).toBeUndefined()
    }
  })
})
