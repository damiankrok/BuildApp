/**
 * v3.53.12: an overall dimension line hidden over long stretches by drawings laid over it.
 *
 * The found cause, on a public plan: planting drawn as filled discs over the overall width line hides two stretches of
 * it, wider than the occlusion join bridges (40 px), and the run-finder ends the line at each disc's edge without any mark.
 * The pieces held one tick each (or none) and were dropped as runs with fewer than two marks: the line that states the
 * building's whole width never became a chain, and an interior row of room dimensions framed the width instead.
 *
 * Now collinear runs are one line when every gap between them is drawn over, the ends facing each gap carry no mark, the
 * joined line begins and ends in a TICK, the line's own runs draw most of it and no gap hides more than a quarter of it.
 * Every sheet here is drawn in the test; none is a drawing of any real building.
 */
import { describe, expect, it } from 'vitest'
import { adaptiveInkMask, inkChannel } from '@buildapp/source-cv'
import type { Raster } from '@buildapp/source-cv'
import { findDimensionLines } from '../src/dimension-lines.js'

const W = 760
const H = 160
const Y = 80
type RGB = [number, number, number]
const INK: RGB = [40, 40, 40] // one pen for the line and its ticks, as in the occluded-line test
const LINE: RGB = INK

function blank(): { r: Raster; put: (x: number, y: number, v: RGB) => void } {
  const data = new Uint8ClampedArray(W * H * 4).fill(255)
  const put = (x: number, y: number, v: RGB): void => {
    if (x < 0 || y < 0 || x >= W || y >= H) return
    const o = (y * W + x) * 4
    data[o] = v[0]
    data[o + 1] = v[1]
    data[o + 2] = v[2]
  }
  return { r: { width: W, height: H, data }, put }
}
const line = (put: (x: number, y: number, v: RGB) => void, from: number, to: number): void => {
  for (let x = from; x <= to; x += 1) put(x, Y, LINE)
}
/** A tick as the overall lines of a plan at this size draw it: a short stroke two pixels wide across the line. */
const slash = (put: (x: number, y: number, v: RGB) => void, at: number): void => {
  for (let d = -6; d <= 6; d += 1) for (const w of [0, 1]) put(at + w - Math.round(d / 4), Y - d, INK)
}
/** A filled disc (a tree as plans draw it): a flat mid grey laid over whatever is under it. */
const disc = (put: (x: number, y: number, v: RGB) => void, cx: number, cy: number, rad: number): void => {
  for (let y = cy - rad; y <= cy + rad; y += 1)
    for (let x = cx - rad; x <= cx + rad; x += 1) if (Math.hypot(x - cx, y - cy) <= rad) put(x, y, [190, 190, 190])
}
const linesOf = (r: Raster) => {
  const grey = inkChannel(r)
  return findDimensionLines(adaptiveInkMask(grey, {}), { raster: r, grey }).filter((l) => l.axis === 'HORIZONTAL' && Math.abs(l.baselinePx - Y) <= 1)
}
const spans = (r: Raster, from: number, to: number): boolean => linesOf(r).some((l) => l.ticksPx[0] <= from + 1 && l.ticksPx[l.ticksPx.length - 1] >= to - 1)

/** The overall line from tick 50 to tick 700, with two clumps of planting over it. */
function planted(): Raster {
  const { r, put } = blank()
  line(put, 30, 720)
  slash(put, 50)
  slash(put, 700)
  disc(put, 200, Y - 8, 50) // a tree about 100 px across
  for (const cx of [390, 450]) disc(put, cx, Y - 4, 38) // a clump about 135 px across
  return r
}

describe('v3.53.12: an overall line under planting drawn over it', () => {
  it('the cause: one line from the first tick to the last, no tick inside the planting', () => {
    const lines = linesOf(planted())
    const overall = lines.find((l) => l.ticksPx[0] <= 51 && l.ticksPx[l.ticksPx.length - 1] >= 699)
    expect(overall).toBeDefined()
    expect(overall?.ticksPx).toHaveLength(2)
    expect(overall?.marks?.map((m) => m.class)).toEqual(['TICK', 'TICK'])
  })

  it('counter-case: a gap of bare paper is never bridged', () => {
    const { r, put } = blank()
    line(put, 30, 300)
    line(put, 420, 720)
    slash(put, 50)
    slash(put, 700)
    expect(spans(r, 50, 700)).toBe(false)
  })

  it('counter-case: a tick facing the cover keeps two chains apart (the lines end there, they do not run into it)', () => {
    const { r, put } = blank()
    line(put, 30, 306)
    line(put, 394, 720)
    for (const t of [50, 300, 400, 700]) slash(put, t)
    disc(put, 350, Y - 4, 40)
    const lines = linesOf(r)
    expect(spans(r, 50, 700)).toBe(false)
    expect(lines.some((l) => l.ticksPx[0] <= 51 && l.ticksPx[l.ticksPx.length - 1] >= 299 && l.ticksPx[l.ticksPx.length - 1] <= 301)).toBe(true)
  })

  it('counter-case: two chains, each a dimension line in its own right, stay two across a wide drawing between them', () => {
    // (a gap under 40 px is the occlusion join's, unchanged here; this one is wider)
    const { r, put } = blank()
    line(put, 30, 330)
    line(put, 400, 720)
    for (const t of [50, 250, 450, 700]) slash(put, t)
    disc(put, 365, Y - 4, 46)
    const lines = linesOf(r)
    expect(spans(r, 50, 700)).toBe(false)
    expect(lines.some((l) => l.ticksPx.includes(250))).toBe(true)
    expect(lines.some((l) => l.ticksPx.includes(450))).toBe(true)
  })

  it('counter-case: a joined line that does not end in a tick is no dimension line (an outline, a leader)', () => {
    const { r, put } = blank()
    line(put, 30, 720)
    slash(put, 50) // one end only
    for (const cx of [380, 420, 460]) disc(put, cx, Y - 4, 26)
    expect(linesOf(r).some((l) => l.fromPx <= 60 && l.toPx >= 690)).toBe(false)
  })

  it('counter-case: a cover hiding more than a quarter of the line joins nothing', () => {
    const { r, put } = blank()
    line(put, 30, 720)
    slash(put, 50)
    slash(put, 700)
    for (let cx = 230; cx <= 470; cx += 40) disc(put, cx, Y - 4, 26) // about 290 px of 650
    expect(spans(r, 50, 700)).toBe(false)
  })

  it('control: a short interior room dimension, nothing over it, is found as before', () => {
    const { r, put } = blank()
    line(put, 244, 406)
    slash(put, 250)
    slash(put, 400)
    const lines = linesOf(r)
    expect(lines).toHaveLength(1)
    expect(lines[0].ticksPx).toEqual([250, 400])
  })

  it('control: a light watermark band across the line neither breaks it nor adds a tick', () => {
    const { r, put } = blank()
    for (let y = 0; y < H; y += 1) for (let x = 300 + y; x < 360 + y; x += 1) put(x, y, [238, 238, 238])
    line(put, 30, 720)
    slash(put, 50)
    slash(put, 700)
    const overall = linesOf(r).find((l) => l.ticksPx[0] <= 51 && l.ticksPx[l.ticksPx.length - 1] >= 699)
    expect(overall?.ticksPx).toHaveLength(2)
  })
})
