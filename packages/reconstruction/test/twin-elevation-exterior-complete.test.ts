/**
 * EXTERIOR-COMPLETE: an elevation that draws a semi-detached unit beside its faded neighbour, and a door leaf with a
 * glazed strip.
 *
 * The first wrong decision on a twin house: the front and rear elevations draw both units — the unit in full contrast,
 * its mirror image washed out — so the silhouette spans twice the plan's width, fits no span, and the views were
 * refused. Every front and rear opening was then built from the plan at assumed heights and the rear balcony was never
 * tried. The second: the unit's front doors (a dark leaf with a narrow glazed strip and a long handle) read UNCLEAR on
 * their face (a large spread along each row) and were built as floor-length windows.
 */
import { describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-cv'
import { openingFace } from '../src/v2/opening-reading.js'
import { readTwinHalf } from '../src/v2/twin-elevation.js'

type Rgb = readonly [number, number, number]
function canvas(w: number, h: number, rgb: Rgb): Raster {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i += 1) data.set([rgb[0], rgb[1], rgb[2], 255], i * 4)
  return { width: w, height: h, data }
}
function rect(r: Raster, x0: number, y0: number, x1: number, y1: number, rgb: Rgb): void {
  for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) r.data.set([rgb[0], rgb[1], rgb[2], 255], (y * r.width + x) * 4)
}

/** A pair of units 300 px wide each on a 700 × 400 sheet: white walls, dark windows; one unit faded to light greys. */
function pair(fadedHalf: 'LEFT' | 'RIGHT' | 'NONE'): Raster {
  const r = canvas(700, 400, [255, 255, 255])
  rect(r, 50, 40, 650, 380, [236, 236, 236])
  for (const unit of [0, 1]) {
    const faded = (unit === 0 && fadedHalf === 'LEFT') || (unit === 1 && fadedHalf === 'RIGHT')
    const dark: Rgb = faded ? [200, 200, 202] : [52, 54, 58]
    const x = 50 + unit * 300
    rect(r, x + 40, 230, x + 100, 370, dark)
    rect(r, x + 160, 230, x + 220, 370, dark)
    rect(r, x + 40, 90, x + 100, 170, dark)
    rect(r, x + 160, 90, x + 220, 170, dark)
  }
  return r
}
const EXTENT = { x0: 50, y0: 40, x1: 650, y1: 380 }

describe('EXTERIOR-COMPLETE: a unit drawn beside its faded neighbour', () => {
  it('the half in full contrast is the unit: left or right, as drawn', () => {
    const right = readTwinHalf(pair('LEFT'), EXTENT)
    expect(right?.half).toBe('RIGHT')
    expect(right?.extent).toEqual({ x0: 350, y0: 40, x1: 650, y1: 380 })
    const left = readTwinHalf(pair('RIGHT'), EXTENT)
    expect(left?.half).toBe('LEFT')
    expect(left?.extent).toEqual({ x0: 50, y0: 40, x1: 350, y1: 380 })
  })
  it('two halves drawn alike are not split: which one is the unit the picture does not say', () => {
    expect(readTwinHalf(pair('NONE'), EXTENT)).toBeUndefined()
  })
})

describe('EXTERIOR-COMPLETE: a door leaf with a glazed strip and a handle', () => {
  const W = 120
  const H = 240
  it('a dark leaf whose strip and handle run down it unchanged is one opaque leaf', () => {
    const r = canvas(W, H, [62, 64, 68])
    rect(r, 20, 0, 34, H, [176, 180, 186]) // the glazed strip
    rect(r, 80, 40, 84, 200, [196, 198, 200]) // the long handle
    const f = openingFace(r, { x0: 0, y0: 0, x1: W - 1, y1: H - 1 })
    expect(f?.alongRowStd).toBeGreaterThan(6)
    expect(f?.kind).toBe('OPAQUE_PANEL')
  })
  it('neutral glass mirroring what stands before it changes down every column: no leaf', () => {
    const r = canvas(W, H, [150, 152, 156])
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) if ((x * 5 + y * 11) % 70 < 30) r.data.set([96, 98, 100, 255], (y * W + x) * 4)
    expect(openingFace(r, { x0: 0, y0: 0, x1: W - 1, y1: H - 1 })?.kind).not.toBe('OPAQUE_PANEL')
  })
})
