/** v3.45: a callout ring re-fitted to its own stroke. Invented rings; no publisher image. */
import { describe, expect, it } from 'vitest'
import type { Gray } from '@buildapp/source-cv'
import { refineRingCircle, ringHalfCrops } from '../src/index.js'

/** A paper sheet with a 1.5 px ring of radius r at (cx, cy), a bar across it, and two "digit" blocks per half. */
function sheet(cx: number, cy: number, r: number, w = 120, h = 120): Gray {
  const data = new Uint8ClampedArray(w * h).fill(255)
  for (let y = 0; y < h; y += 1)
    for (let x = 0; x < w; x += 1) {
      const d = Math.hypot(x - cx, y - cy)
      if (Math.abs(d - r) <= 0.75) data[y * w + x] = 30
      if (Math.abs(y - cy) <= 0.5 && d < r) data[y * w + x] = 30
    }
  for (const [dx, dy] of [[-5, -6], [2, -6], [-5, 3], [2, 3]]) for (let y = 0; y < 4; y += 1) for (let x = 0; x < 3; x += 1) data[(cy + dy + y) * w + cx + dx + x] = 20
  return { width: w, height: h, data }
}

describe('refineRingCircle', () => {
  it('a circle found small and off centre (an inner contour) is re-fitted to the ring', () => {
    const g = sheet(60, 60, 12)
    const f = refineRingCircle(g, { cx: 63, cy: 61, radiusPx: 9 })
    expect(Math.abs(f.cx - 60)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(f.cy - 60)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(f.radiusPx - 12)).toBeLessThanOrEqual(0.5)
  })
  it('a ring found where it is stays where it is', () => {
    const g = sheet(60, 60, 12)
    const f = refineRingCircle(g, { cx: 60, cy: 60, radiusPx: 12 })
    expect(f).toEqual({ cx: 60, cy: 60, radiusPx: 12 })
  })
  it('the re-fitted circle cuts the halves without clipping the digits the small circle clipped', () => {
    const g = sheet(60, 60, 12)
    const small = ringHalfCrops(g, { cx: 63, cy: 61, radiusPx: 9 }, 60, 's')
    const fitted = ringHalfCrops(g, refineRingCircle(g, { cx: 63, cy: 61, radiusPx: 9 }), 60, 'f')
    expect(fitted.upper?.glyphs).toBe(2)
    expect(fitted.lower?.glyphs).toBe(2)
    expect((small.upper?.glyphs ?? 0) + (small.lower?.glyphs ?? 0)).toBeLessThan(4)
  })
})
