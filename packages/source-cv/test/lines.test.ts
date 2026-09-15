import { describe, expect, it } from 'vitest'
import { angleDeltaDeg } from '@buildapp/source-common'
import { axisAlignedSegments, connectedComponents, dominantSlopes, houghSegments, inkMask, parallelFamilies, runsAlongCol, runsAlongRow, toGray } from '../src/index.js'
import type { Mask, Segment } from '../src/index.js'
import { BLACK, drawLine, drawRectOutline, fillRect, whiteRaster } from './draw.js'

const maskOf = (build: (r: ReturnType<typeof whiteRaster>) => void, w = 200, h = 150): Mask => {
  const r = whiteRaster(w, h)
  build(r)
  return inkMask(toGray(r))
}

describe('runs along a row and a column', () => {
  it('bridges gaps up to maxGap and drops runs below minRun', () => {
    const m = maskOf((r) => {
      fillRect(r, 2, 3, 6, 3, BLACK)
      fillRect(r, 8, 3, 12, 3, BLACK) // one unset pixel at x=7
      fillRect(r, 40, 3, 41, 3, BLACK) // only two pixels
    }, 60, 20)
    expect(runsAlongRow(m, 3, { maxGap: 2, minRun: 3 })).toEqual([{ x0: 2, x1: 12 }])
    expect(runsAlongRow(m, 3, { maxGap: 0, minRun: 3 })).toEqual([
      { x0: 2, x1: 6 },
      { x0: 8, x1: 12 },
    ])
    expect(runsAlongRow(m, 3, { maxGap: 0, minRun: 2 })).toHaveLength(3)
    expect(runsAlongRow(m, 4)).toEqual([])
  })

  it('answers for a row outside the mask rather than throwing', () => {
    const m = maskOf(() => undefined, 10, 10)
    expect(runsAlongRow(m, -1)).toEqual([])
    expect(runsAlongRow(m, 999)).toEqual([])
    expect(runsAlongCol(m, 999)).toEqual([])
  })

  it('transposes correctly for columns', () => {
    const m = maskOf((r) => fillRect(r, 5, 4, 5, 18, BLACK), 40, 40)
    expect(runsAlongCol(m, 5)).toEqual([{ y0: 4, y1: 18 }])
    expect(runsAlongCol(m, 6)).toEqual([])
  })
})

/**
 * CASE 3 of the stage brief: repeated stair lines.
 *
 * Nine evenly spaced parallels are not nine facts, they are one fact with a
 * rhythm, and `spacing` is that rhythm. The second half of this block is the
 * mutation guard: if grouping silently accepted everything, or if `spacing`
 * were computed from anything other than the members actually present,
 * removing five of the nine lines would not change the answer. It must.
 */
describe('repeated parallel lines (a stair flight)', () => {
  const stair = (step: number, count: number): Mask => maskOf((r) => {
    for (let i = 0; i < count; i++) fillRect(r, 30, 20 + i * step, 110, 20 + i * step, BLACK)
  }, 160, 120)

  it('finds one family of nine members with the true spacing', () => {
    const segs = axisAlignedSegments(stair(6, 9), { minLength: 20, maxThickness: 2 })
    expect(segs).toHaveLength(9)
    const families = parallelFamilies(segs)
    expect(families).toHaveLength(1)
    expect(families[0].members).toHaveLength(9)
    expect(families[0].angleDeg).toBe(0)
    expect(families[0].spacing).not.toBeNull()
    expect(Math.abs((families[0].spacing as number) - 6)).toBeLessThanOrEqual(1)
  })

  it('orders family members across the family, not by detection order', () => {
    const families = parallelFamilies(axisAlignedSegments(stair(6, 9), { minLength: 20, maxThickness: 2 }))
    expect(families[0].members.map((s) => s.a.y)).toEqual([20, 26, 32, 38, 44, 50, 56, 62, 68])
  })

  it('still reports a family when half the treads are missing, with fewer members', () => {
    const segs = axisAlignedSegments(stair(12, 5), { minLength: 20, maxThickness: 2 })
    const families = parallelFamilies(segs)
    expect(families).toHaveLength(1)
    expect(families[0].members.length).toBe(5)
    expect(families[0].members.length).toBeLessThan(9)
    expect(Math.abs((families[0].spacing as number) - 12)).toBeLessThanOrEqual(1)
  })

  it('reports no spacing for a family of two, because one gap is not a rhythm', () => {
    const segs = axisAlignedSegments(stair(6, 2), { minLength: 20, maxThickness: 2 })
    const families = parallelFamilies(segs)
    expect(families[0].members).toHaveLength(2)
    expect(families[0].spacing).toBeNull()
  })
})

/**
 * CASE 2 of the stage brief: a sloped roof.
 *
 * The endpoints are asserted as well as the angle: a Hough peak alone would
 * give a line of infinite extent, and "where the roof stops" is the number a
 * caller actually needs.
 */
describe('sloped lines (a roof pitch)', () => {
  // dy/dx = 84/100 -> 40.03 degrees; with y down, rising to the right folds to 139.97
  const LEFT_SLOPE = 139.9698
  const RIGHT_SLOPE = 40.0302
  const roof = maskOf((r) => {
    drawLine(r, 20, 120, 120, 36, BLACK)
    drawLine(r, 120, 36, 220, 120, BLACK)
  }, 240, 180)

  it('finds both slopes, once each, with refined angles', () => {
    const segs = houghSegments(roof, { minLength: 30 })
    // exactly two: one drawn line votes into several adjacent accumulator
    // cells, and near-duplicate suppression is what keeps that from being
    // reported as a family of five parallel roof edges.
    expect(segs).toHaveLength(2)
    const rising = segs.filter((s) => angleDeltaDeg(s.angleDeg, LEFT_SLOPE) <= 0.5)
    const falling = segs.filter((s) => angleDeltaDeg(s.angleDeg, RIGHT_SLOPE) <= 0.5)
    expect(rising).toHaveLength(1)
    expect(falling).toHaveLength(1)
  })

  it('refines the angle well inside the Hough bin it came from', () => {
    // A pitch chosen to fall HALFWAY BETWEEN two 1-degree bins: 70/82 is
    // 40.486 degrees, so the best any peak alone can say is 40 or 41 and it is
    // wrong by ~0.49 either way. The total-least-squares refit against the
    // supporting pixels is an order of magnitude better than that, which is
    // the whole reason it is there — and half a degree over a 600-pixel line
    // is a 5-pixel endpoint swing, which is larger than the decisions this
    // feeds.
    const midBin = maskOf((r) => {
      drawLine(r, 20, 120, 102, 50, BLACK)
      drawLine(r, 102, 50, 184, 120, BLACK)
    }, 210, 160)
    const truth = (Math.atan2(70, 82) * 180) / Math.PI // 40.486
    const segs = houghSegments(midBin, { minLength: 30 })
    expect(segs).toHaveLength(2)
    for (const s of segs) expect(angleDeltaDeg(s.angleDeg, s.angleDeg > 90 ? 180 - truth : truth)).toBeLessThan(0.15)
    // and the bin it came from would not have been good enough
    expect(angleDeltaDeg(Math.round(truth), truth)).toBeGreaterThan(0.4)
  })

  it('recovers endpoints, not just directions', () => {
    const segs = houghSegments(roof, { minLength: 30 })
    const falling = segs.filter((s) => angleDeltaDeg(s.angleDeg, RIGHT_SLOPE) <= 1).sort((p, q) => q.length - p.length)[0]
    expect(Math.abs(falling.a.x - 120)).toBeLessThanOrEqual(1)
    expect(Math.abs(falling.a.y - 36)).toBeLessThanOrEqual(1)
    expect(Math.abs(falling.b.x - 220)).toBeLessThanOrEqual(1)
    expect(Math.abs(falling.b.y - 120)).toBeLessThanOrEqual(1)
    expect(falling.length).toBeCloseTo(Math.hypot(100, 84), 0)
  })

  it('recovers the pitch as the dominant slope', () => {
    const slopes = dominantSlopes(houghSegments(roof, { minLength: 30 }))
    expect(slopes.length).toBeGreaterThanOrEqual(2)
    const topTwo = slopes.slice(0, 2).map((s) => s.angleDeg)
    expect(topTwo.some((a) => Math.abs(a - 40.03) <= 1.5)).toBe(true)
    expect(topTwo.some((a) => Math.abs(a - 139.97) <= 1.5)).toBe(true)
    expect(slopes[0].totalLength).toBeGreaterThan(100)
  })

  it('weights the histogram by length so short ticks cannot outvote a long edge', () => {
    const long: Segment = { a: { x: 0, y: 0 }, b: { x: 200, y: 0 }, angleDeg: 0, length: 200, support: 200 }
    const ticks: Segment[] = Array.from({ length: 10 }, (_, i) => ({ a: { x: i * 5, y: 10 }, b: { x: i * 5 + 3, y: 13 }, angleDeg: 45, length: 4.242641, support: 4 }))
    const slopes = dominantSlopes([...ticks, long])
    expect(slopes[0].angleDeg).toBe(0)
    expect(slopes[0].count).toBe(1)
    expect(slopes[1].count).toBe(10)
  })
})

/**
 * CASE 5 of the stage brief: a thick frame versus a thin outline.
 *
 * This is the distinction between A DRAFTING LINE and A REAL 3D MEMBER, and
 * it is the single most consequential classification this package makes: the
 * thin one says "an opening is here", the thick one says "something is built
 * here, and it has a width". So it is asserted from both sides — the thin one
 * survives the thinness filter and the thick one does not, while the thick one
 * is emphatically NOT lost, it is reported by `connectedComponents` with a
 * fill that identifies it as a band.
 */
describe('a thick frame is a band, a thin outline is a line', () => {
  const sheet = maskOf((r) => {
    drawRectOutline(r, 10, 10, 80, 70, BLACK, 1) // a drafting line
    drawRectOutline(r, 110, 10, 180, 70, BLACK, 8) // a built frame member
  }, 200, 140)

  it('keeps the thin outline and rejects the thick band at maxThickness 3', () => {
    const segs = axisAlignedSegments(sheet, { minLength: 20, maxThickness: 3 })
    expect(segs).toHaveLength(4) // exactly the four sides of the thin rectangle
    expect(segs.every((s) => s.b.x <= 80)).toBe(true) // nothing from the right-hand frame
  })

  it('accepts the same band once the caller says a band is what it wants', () => {
    const segs = axisAlignedSegments(sheet, { minLength: 20, maxThickness: 10 })
    expect(segs).toHaveLength(8)
    expect(segs.filter((s) => s.a.x >= 100)).toHaveLength(4)
    // the rejection at maxThickness 3 was about thickness, not about visibility
  })

  it('never loses the band: it is a component whose fill says "band", not "line"', () => {
    const comps = connectedComponents(sheet)
    expect(comps).toHaveLength(2)
    const band = comps[0]
    const outline = comps[1]
    expect(band.pixels).toBe(1856)
    expect(outline.pixels).toBe(260)

    // The two bounding boxes are the SAME SIZE, so bounds alone cannot tell
    // them apart. Fill can, and by a wide margin.
    const size = (c: typeof band) => [c.bounds.x1 - c.bounds.x0, c.bounds.y1 - c.bounds.y0]
    expect(size(band)).toEqual(size(outline))
    expect(band.fill).toBeGreaterThan(0.4)
    expect(outline.fill).toBeLessThan(0.1)
    expect(band.fill / outline.fill).toBeGreaterThan(4)
  })
})
