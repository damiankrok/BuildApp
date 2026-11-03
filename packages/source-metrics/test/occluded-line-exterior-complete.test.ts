/**
 * EXTERIOR-COMPLETE: a block printed over a dimension line (a sheet's logo, a stamp) hides a stretch of it; the line
 * under it is still one line, measured tick to tick, and the block's edges are not its ticks. A gap of bare paper is a
 * real end. Every sheet here is drawn in the test.
 */
import { describe, expect, it } from 'vitest'
import { adaptiveInkMask, inkChannel } from '@buildapp/source-cv'
import type { Raster } from '@buildapp/source-cv'
import { findDimensionLines } from '../src/dimension-lines.js'

const W = 700
const H = 80
const Y = 40
function sheet(block: boolean): Raster {
  const data = new Uint8ClampedArray(W * H * 4).fill(255)
  const put = (x: number, y: number, v: [number, number, number]): void => {
    const o = (y * W + x) * 4
    data[o] = v[0]
    data[o + 1] = v[1]
    data[o + 2] = v[2]
  }
  for (let x = 40; x <= 660; x += 1) put(x, Y, [40, 40, 40]) // the line
  for (const t of [50, 650]) for (let d = -6; d <= 6; d += 1) put(t + d, Y - d, [40, 40, 40]) // slash ticks at both ends
  if (block) {
    for (let y = Y - 25; y <= Y + 25; y += 1) for (let x = 400; x <= 460; x += 1) put(x, y, [175, 175, 175]) // a light grey square over it
  } else {
    for (let x = 400; x <= 460; x += 1) put(x, Y, [255, 255, 255]) // the line simply stops: two lines
  }
  return { width: W, height: H, data }
}
const linesOf = (r: Raster) => {
  const grey = inkChannel(r)
  return findDimensionLines(adaptiveInkMask(grey, {}), { raster: r, grey }).filter((l) => l.axis === 'HORIZONTAL' && Math.abs(l.baselinePx - Y) <= 1)
}

describe('a dimension line under a block printed over it', () => {
  it('is one line from tick to tick; the block edges are not ticks', () => {
    const lines = linesOf(sheet(true))
    expect(lines).toHaveLength(1)
    expect(lines[0].ticksPx[0]).toBeCloseTo(50, 0)
    expect(lines[0].ticksPx[lines[0].ticksPx.length - 1]).toBeCloseTo(650, 0)
    expect(lines[0].ticksPx.some((t) => t > 395 && t < 465)).toBe(false)
  })
  it('a gap of bare paper is never bridged', () => {
    const lines = linesOf(sheet(false))
    expect(lines.some((l) => l.fromPx <= 60 && l.toPx >= 640)).toBe(false)
  })
})
