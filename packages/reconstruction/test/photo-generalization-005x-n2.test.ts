/**
 * BUILDPLAN-ANALYZER-005X-N2: one picture of houses that have no light band under their eaves.
 *
 * - a dark wall under a darker roof at dusk, a timber-clad wall and a grey wall in shade are read by the roof's own
 *   colour (GENERAL): a closed body, its eaves where the covering ends, the timber's boards no openings;
 * - a gable facing the camera, its eaves at the outline's corners and no eave line along the front, is read from the
 *   outline (SILHOUETTE): a coarse body whose ridge runs back from the picture, without openings;
 * - what a reading supports is said: openings read are DETAILS_SUPPORTED, a body without them COARSE_INDICATIVE;
 * - a picture with no house, and a house with no sky over it, are refused by name, never given a typical house;
 * - the same picture gives the same model.
 *
 * Every raster is drawn here from invented shapes and colours; no drawing, render or photograph of a real house is used.
 */
import { describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-cv'
import { readSingleImage, reconstructFromSingleImage } from '../src/index.js'

type RGB = [number, number, number]
function canvas(w: number, h: number, fill: (x: number, y: number) => RGB): Raster {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y += 1)
    for (let x = 0; x < w; x += 1) {
      const c = fill(x, y)
      const o = (y * w + x) * 4
      data[o] = c[0]
      data[o + 1] = c[1]
      data[o + 2] = c[2]
      data[o + 3] = 255
    }
  return { width: w, height: h, data }
}
const put = (r: Raster, x: number, y: number, c: RGB): void => {
  if (x < 0 || y < 0 || x >= r.width || y >= r.height) return
  const o = (Math.round(y) * r.width + Math.round(x)) * 4
  r.data[o] = c[0]
  r.data[o + 1] = c[1]
  r.data[o + 2] = c[2]
}
const rect = (r: Raster, x0: number, y0: number, x1: number, y1: number, c: RGB): void => {
  for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) put(r, x, y, c)
}
/** A dusk sky: pale lilac at the top, warmer towards the horizon. */
const dusk = (_x: number, y: number): RGB => [Math.round(175 + y * 0.12), Math.round(170 + y * 0.03), Math.round(205 - y * 0.05)]
const day = (): RGB => [150, 190, 235]
const GRASS: RGB = [60, 120, 40]
const GLASS: RGB = [30, 35, 45]

/**
 * A house seen from the front: a roof from row 70 (level between `ridge`, coming down to the eave at row 150 outside it)
 * over a wall to row 250, both of the colours given; the wall's colour per pixel from `wall`.
 */
function house(sky: (x: number, y: number) => RGB, roof: RGB, wall: (x: number, y: number) => RGB, ridge: [number, number] = [60, 340], x0 = 60, x1 = 340): Raster {
  const r = canvas(400, 300, sky)
  for (let x = x0; x < x1; x += 1) {
    const top = x < ridge[0] ? 150 - ((x - x0) / (ridge[0] - x0)) * 80 : x > ridge[1] ? 150 - ((x1 - x) / (x1 - ridge[1])) * 80 : 70
    // the covering's tile rows, lighter and darker by a few levels
    for (let y = Math.round(top); y < 150; y += 1) put(r, x, y, y % 7 === 0 ? [roof[0] + 14, roof[1] + 14, roof[2] + 14] : roof)
    for (let y = 150; y <= 250; y += 1) put(r, x, y, wall(x, y))
  }
  rect(r, 0, 252, 400, 300, GRASS)
  return r
}

describe('005X-N2 a front without a light band under its eaves', () => {
  it('reads a dark wall under a darker roof at dusk by the roof\'s own colour, and closes it', () => {
    const r = house(dusk, [28, 30, 40], () => [78, 78, 84])
    rect(r, 120, 175, 170, 225, [210, 170, 110]) // a lit window
    const result = reconstructFromSingleImage(r, 'm-dark-dusk')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.reading.mode).toBe('GENERAL')
    // the eaves where the covering ends, not halfway up it or down the wall
    expect(Math.abs(result.reading.wall.eave[0] - 150)).toBeLessThanOrEqual(6)
    expect(Math.abs(result.reading.wall.eave[1] - 150)).toBeLessThanOrEqual(6)
    expect(result.fits.every((f) => f.action !== 'REFUSED')).toBe(true)
  })

  it('reads a timber-clad wall without taking its boards for openings', () => {
    const boards = (x: number): RGB => (x % 9 === 0 ? [120, 70, 35] : [185, 120, 70])
    const r = house(day, [70, 72, 78], (x) => boards(x))
    rect(r, 180, 170, 230, 220, GLASS)
    const result = reconstructFromSingleImage(r, 'm-timber')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.reading.mode).toBe('GENERAL')
    expect(Math.abs(result.reading.wall.eave[0] - 150)).toBeLessThanOrEqual(6)
    // the one window, and no board read as a door or a window
    expect(result.reading.openings.length).toBeLessThanOrEqual(1)
  })

  it('reads a grey wall in shade, no neutral band anywhere, as a closed body', () => {
    const r = house(day, [150, 60, 45], () => [112, 114, 118])
    const result = reconstructFromSingleImage(r, 'm-shade')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(['NEUTRAL_BAND', 'GENERAL']).toContain(result.reading.mode)
    expect(Math.abs(result.reading.wall.eave[0] - 150)).toBeLessThanOrEqual(6)
  })
})

describe('005X-N2 a gable facing the camera, read from the outline', () => {
  /** A white gable frame round a timber face, a dark lower wing beside it, at dusk. */
  function frontGable(): Raster {
    const r = canvas(400, 300, dusk)
    const apex = { x: 150, y: 40 }
    for (let x = 60; x <= 240; x += 1) {
      const top = apex.y + Math.abs(x - apex.x) * (110 / 90)
      for (let y = Math.round(top); y <= 250; y += 1) put(r, x, y, y < top + 8 || x < 68 || x > 232 ? [235, 235, 238] : x % 7 === 0 ? [130, 85, 45] : [190, 130, 75])
    }
    rect(r, 240, 175, 360, 251, [60, 60, 66]) // a flat-roofed wing
    rect(r, 0, 252, 400, 300, GRASS)
    return r
  }

  it('builds a coarse body whose ridge runs back from the picture, and no openings', () => {
    const result = reconstructFromSingleImage(frontGable(), 'm-front-gable')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.reading.mode).toBe('SILHOUETTE')
    expect(result.reading.quality).toBe('COARSE_INDICATIVE')
    expect(result.reading.segments[0].ridgeAxis).toBe('Z')
    expect(result.reading.openings).toHaveLength(0)
    expect(result.reading.rooflights).toHaveLength(0)
    const model = JSON.parse(result.modelJson)
    expect(model.roofPlanes.length).toBeGreaterThanOrEqual(2)
    expect(model.openings ?? []).toHaveLength(0)
  })

  it('gives the same model for the same picture', () => {
    const a = reconstructFromSingleImage(frontGable(), 'm-same')
    const b = reconstructFromSingleImage(frontGable(), 'm-same')
    expect(a.ok && b.ok && a.modelJson === b.modelJson).toBe(true)
  })
})

describe('005X-N2 what a reading claims, and what it refuses', () => {
  it('says DETAILS_SUPPORTED only where openings were read', () => {
    const withWindow = house(day, [150, 60, 45], () => [245, 244, 240])
    rect(withWindow, 120, 175, 170, 225, GLASS)
    const a = readSingleImage(withWindow)
    expect(a.ok && a.quality).toBe('DETAILS_SUPPORTED')
    const blank = readSingleImage(house(day, [28, 30, 40], () => [78, 78, 84]))
    expect(blank.ok && blank.openings.length === 0 && blank.quality).toBe('COARSE_INDICATIVE')
  })

  it('refuses a picture with no house in it, by name', () => {
    const r = canvas(400, 300, (x, y) => (y < 170 ? day() : GRASS))
    for (let k = 0; k < 6; k += 1) for (let y = 120; y < 200; y += 1) for (let x = 30 + k * 60; x < 60 + k * 60; x += 1) if ((x - (45 + k * 60)) ** 2 + (y - 160) ** 2 < 900) put(r, x, y, [40, 100 + k * 5, 35])
    const result = readSingleImage(r)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason.length).toBeGreaterThan(10)
  })

  it('refuses a house with no sky over it rather than guess its roof', () => {
    const r = canvas(400, 300, () => [88, 92, 86])
    rect(r, 40, 60, 360, 260, [200, 196, 190])
    rect(r, 120, 120, 170, 180, GLASS)
    const result = readSingleImage(r)
    expect(result.ok).toBe(false)
  })
})
