/**
 * BUILDPLAN-ANALYZER-005Y-N5 (C2): rooflight symbols whose eave edge is lost, and rooflights whose ring was not found,
 * on synthetic plans (no project, no source image).
 *  - a symbol whose eave edge lies on the tone under the knee wall is read from its upslope edge and its sides, the eave
 *    end where both sides' dashes stop (counterfactual: the same symbol with no sides is nothing);
 *  - along a row of read symbols, the same symbol with a callout bar inside and no ring is a rooflight; the symbol
 *    alone, the bar alone, or a plain tone band are nothing.
 */
import { describe, expect, it } from 'vitest'
import { Canvas } from '@buildapp/synthetic-drawings'
import { drawnRooflightSymbol, rowSymbolsWithoutRing } from '../src/v2/roof-details.js'

const MPP = 0.025
const plan = { toPixel: (x: number, z: number) => ({ x: 100 + x / MPP, y: 100 + z / MPP }), toWorld: (px: number, py: number) => ({ x: (px - 100) * MPP, z: (py - 100) * MPP }) }
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
/** The knee-wall tone from the eave (smaller y) to y = 290, then a symbol with no eave edge: sides 290..330, upslope edge at 330. */
function kneeWallSymbol(c: Canvas, x: number, opts: { sides?: boolean; bar?: boolean } = {}): void {
  dashed(c, x - 16, 330, x + 16, 330)
  if (opts.sides !== false) {
    dashed(c, x - 16, 290, x - 16, 330)
    dashed(c, x + 16, 290, x + 16, 330)
  }
  if (opts.bar) c.line(x - 8, 300, x + 8, 300, 1, 120)
}
function sheet(draw: (c: Canvas) => void) {
  const c = new Canvas(800, 600)
  c.fill(0, 250, 800, 289, 200)
  draw(c)
  return c.toRaster()
}

describe('005Y-N5 a symbol whose eave edge is lost in the knee-wall tone', () => {
  it('is read from its upslope edge and its sides, its eave end where the sides stop', () => {
    const s = drawnRooflightSymbol(sheet((c) => kneeWallSymbol(c, 300)), plan, ring, W, D, 'X', undefined, 1)
    expect(s?.method).toBe('UPSLOPE_EDGE_AND_SIDES')
    // eave end at y 290 (t = -10), upslope edge at y 330 (t = 30)
    expect(s?.edgesPx[0]).toBeGreaterThanOrEqual(-11)
    expect(s?.edgesPx[0]).toBeLessThanOrEqual(-9)
    expect(s?.edgesPx[1]).toBe(30)
  })
  it('counterfactual: the same upslope edge with no sides drawn is nothing', () => {
    expect(drawnRooflightSymbol(sheet((c) => kneeWallSymbol(c, 300, { sides: false })), plan, ring, W, D, 'X', undefined, 1)).toBeUndefined()
  })
  it('negative: without knowing which way is up the slope, only a whole rectangle is read', () => {
    expect(drawnRooflightSymbol(sheet((c) => kneeWallSymbol(c, 300)), plan, ring, W, D, 'X')).toBeUndefined()
  })
})

describe('005Y-N5 a rooflight whose ring was not found, along a row of read symbols', () => {
  const row = (taken: number[]) => ({ eaveAcross: plan.toWorld(0, 290).z, upslope: 1 as const, depthM: D, widthM: W, barAcross: plan.toWorld(0, 300).z, barHalfM: 0.25, alongFrom: plan.toWorld(150, 0).x, alongTo: plan.toWorld(750, 0).x, taken })
  it('is the row\'s symbol with a callout bar inside, away from the read rings', () => {
    const found = rowSymbolsWithoutRing(sheet((c) => { kneeWallSymbol(c, 300, { bar: true }); kneeWallSymbol(c, 500, { bar: true }) }), plan, 'X', row([plan.toWorld(300, 0).x]))
    expect(found.map((f) => Math.round(plan.toPixel(f.along, 0).x))).toEqual([500])
  })
  it('negative: the symbol without a bar, a bar without a symbol, or the tone band alone are nothing', () => {
    expect(rowSymbolsWithoutRing(sheet((c) => kneeWallSymbol(c, 500)), plan, 'X', row([]))).toEqual([])
    expect(rowSymbolsWithoutRing(sheet((c) => c.line(492, 300, 508, 300, 1, 120)), plan, 'X', row([]))).toEqual([])
    expect(rowSymbolsWithoutRing(sheet(() => undefined), plan, 'X', row([]))).toEqual([])
  })
})
