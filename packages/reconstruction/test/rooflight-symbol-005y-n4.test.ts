/**
 * BUILDPLAN-ANALYZER-005Y-N4 (A): a rooflight's drawn symbol beside its callout ring, on synthetic plans (no project,
 * no source image). The ring says a rooflight is there and how big; where up the slope it sits is its rectangle's.
 *  - a dashed rectangle of the printed size with the ring inside it, toward one end, is read, and its middle is not
 *    the ring's centre;
 *  - two equally good rectangles (a twin drawn beside it) are an ambiguity, left unread;
 *  - no rectangle, a solid one (furniture), or one the ring is not inside, is nothing.
 */
import { describe, expect, it } from 'vitest'
import { Canvas } from '@buildapp/synthetic-drawings'
import { drawnRooflightSymbol } from '../src/v2/roof-details.js'

const MPP = 0.025
const plan = { toPixel: (x: number, z: number) => ({ x: 100 + x / MPP, y: 100 + z / MPP }), toWorld: (px: number, py: number) => ({ x: (px - 100) * MPP, z: (py - 100) * MPP }) }
// a 0.78 m wide window, its length's plan projection 1.0 m: 31.2 × 40 px
const W = 0.78
const D = 1.0
const ring = { cx: 300, cy: 300, radiusPx: 12 }

function dashed(c: Canvas, x0: number, y0: number, x1: number, y1: number): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
  for (let i = 0; i < n; i += 6) {
    const a = i / n
    const b = Math.min(1, (i + 3) / n)
    c.line(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a, x0 + (x1 - x0) * b, y0 + (y1 - y0) * b, 1, 150)
  }
}
function rectangle(c: Canvas, x0: number, y0: number, x1: number, y1: number, solid = false): void {
  if (solid) return c.rect(x0, y0, x1, y1, 1, 150)
  dashed(c, x0, y0, x1, y0)
  dashed(c, x0, y1, x1, y1)
  dashed(c, x0, y0, x0, y1)
  dashed(c, x1, y0, x1, y1)
}
function sheet(draw: (c: Canvas) => void) {
  const c = new Canvas(600, 600)
  draw(c)
  return c.toRaster()
}
// the ridge along x: the rectangle's width along x, its depth along y (z)
const symbolFrom = (r: ReturnType<typeof sheet>) => drawnRooflightSymbol(r, plan, ring, W, D, 'X')

describe('a rooflight symbol beside its ring', () => {
  it('is the dashed rectangle the ring sits in, its middle up the slope from the ring', () => {
    const s = symbolFrom(sheet((c) => rectangle(c, 284, 290, 316, 330)))
    expect(s).toBeDefined()
    expect(s?.edgesPx).toEqual([-10, 30])
    const middleZ = ((s?.acrossFrom ?? 0) + (s?.acrossTo ?? 0)) / 2
    expect(middleZ - plan.toWorld(ring.cx, ring.cy).z).toBeCloseTo(0.25, 1)
  })
  it('is no single rectangle when a twin is drawn the other way, as good', () => {
    expect(symbolFrom(sheet((c) => { rectangle(c, 284, 290, 316, 330); rectangle(c, 284, 270, 316, 310) }))).toBeUndefined()
  })
  it('is nothing without a drawn rectangle, with a solid one, or with one the ring is not inside', () => {
    expect(symbolFrom(sheet(() => undefined))).toBeUndefined()
    expect(symbolFrom(sheet((c) => rectangle(c, 284, 290, 316, 330, true)))).toBeUndefined()
    expect(symbolFrom(sheet((c) => rectangle(c, 284, 312, 316, 352)))).toBeUndefined()
  })
})
