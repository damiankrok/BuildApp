import { describe, expect, it } from 'vitest'
import { inkMask, profileBottom, profileTop, rectangleCandidates, silhouettePolyline, simplifyPolyline, toGray } from '../src/index.js'
import type { Mask } from '../src/index.js'
import { BLACK, drawRectOutline, fillRect, fillTriangle, whiteRaster } from './draw.js'

const maskOf = (build: (r: ReturnType<typeof whiteRaster>) => void, w: number, h: number): Mask => {
  const r = whiteRaster(w, h)
  build(r)
  return inkMask(toGray(r))
}

/**
 * CASE 1 of the stage brief: a rectangle / an opening.
 *
 * The bounds must be exact, not approximate: an opening's rectangle IS the
 * measurement, and a candidate whose edges are a few pixels out is a
 * different window.
 */
describe('rectangle candidates (an opening)', () => {
  it('recovers a drawn outline with its exact bounds and near-total closure', () => {
    const m = maskOf((r) => drawRectOutline(r, 20, 15, 90, 60, BLACK, 1), 160, 120)
    const cands = rectangleCandidates(m)
    expect(cands.length).toBeGreaterThanOrEqual(1)
    expect(cands[0].rect).toEqual({ x0: 20, y0: 15, x1: 90, y1: 60 })
    expect(cands[0].closure).toBeGreaterThan(0.95)
    expect(cands[0].support).toBeGreaterThan(200)
  })

  it('still finds an opening whose sill is interrupted, and says so through closure', () => {
    const m = maskOf((r) => {
      drawRectOutline(r, 20, 15, 90, 60, BLACK, 1)
      fillRect(r, 41, 60, 54, 60, [255, 255, 255]) // a witness line crosses the sill
    }, 160, 120)
    const cands = rectangleCandidates(m)
    expect(cands[0].rect).toEqual({ x0: 20, y0: 15, x1: 90, y1: 60 })
    expect(cands[0].closure).toBeLessThan(1)
    expect(cands[0].closure).toBeGreaterThan(0.85)
  })

  it('never proposes an L of two walls at all: pairing needs two of an orientation', () => {
    const m = maskOf((r) => {
      fillRect(r, 20, 15, 90, 15, BLACK) // one horizontal
      fillRect(r, 20, 15, 20, 60, BLACK) // one vertical
    }, 160, 120)
    expect(rectangleCandidates(m, { minClosure: 0.6 })).toEqual([])
  })

  it('scores a U of three walls on closure, so the caller decides how much wall is enough', () => {
    const m = maskOf((r) => {
      fillRect(r, 20, 15, 20, 60, BLACK)
      fillRect(r, 90, 15, 90, 60, BLACK)
      fillRect(r, 20, 60, 90, 60, BLACK) // no head: three sides of four
    }, 160, 120)
    const loose = rectangleCandidates(m, { minClosure: 0.6 })
    expect(loose).toHaveLength(1)
    expect(loose[0].rect).toEqual({ x0: 20, y0: 15, x1: 90, y1: 60 })
    expect(loose[0].closure).toBeGreaterThan(0.65)
    expect(loose[0].closure).toBeLessThan(0.78) // the missing head shows up here and nowhere else
    expect(rectangleCandidates(m, { minClosure: 0.85 })).toEqual([])
  })

  it('ranks both real rectangles above the ones that merely straddle them', () => {
    const m = maskOf((r) => {
      drawRectOutline(r, 10, 10, 60, 50, BLACK, 1)
      drawRectOutline(r, 80, 10, 130, 50, BLACK, 1)
    }, 160, 120)
    const cands = rectangleCandidates(m)
    // pairing is cheap and over-proposes; ranking by closure is what sorts it out
    expect(cands.length).toBeGreaterThan(2)
    expect(cands.slice(0, 2).map((c) => c.rect)).toEqual([
      { x0: 10, y0: 10, x1: 60, y1: 50 },
      { x0: 80, y0: 10, x1: 130, y1: 50 },
    ])
    expect(cands[0].closure).toBe(1)
    expect(cands[1].closure).toBe(1)
    expect(cands[2].closure).toBeLessThan(1)
  })

  it('honours minSize, minClosure and maxCandidates', () => {
    const m = maskOf((r) => {
      drawRectOutline(r, 10, 10, 60, 50, BLACK, 1)
      drawRectOutline(r, 80, 10, 130, 50, BLACK, 1)
    }, 160, 120)
    expect(rectangleCandidates(m, { maxCandidates: 1 })).toHaveLength(1)
    expect(rectangleCandidates(m, { minSize: 200 })).toEqual([])
    expect(rectangleCandidates(m, { minClosure: 1.01 })).toEqual([])
  })
})

/**
 * CASE 4 of the stage brief: a gable profile.
 *
 * The polyline is asserted EXACTLY, three vertices and no more. That is the
 * point of the silhouette: a 24 000-pixel house becomes three numbers, one of
 * which is the apex a roof solver needs.
 */
describe('silhouette of a gabled house', () => {
  const house = maskOf((r) => {
    fillRect(r, 40, 90, 160, 150, BLACK) // body
    fillTriangle(r, 40, 90, 160, 90, 100, 30, BLACK) // roof
  }, 200, 160)

  it('reads the skyline, with -1 where the sheet is blank', () => {
    const top = profileTop(house)
    expect(top[39]).toBe(-1)
    expect(top[40]).toBe(90) // eaves, left
    expect(top[100]).toBe(30) // apex
    expect(top[160]).toBe(90) // eaves, right
    expect(top[161]).toBe(-1)
    expect(top[70]).toBe(60) // exactly on the 45-degree roof line
  })

  it('reads the ground line from below', () => {
    const bottom = profileBottom(house)
    expect(bottom[100]).toBe(150)
    expect(bottom[39]).toBe(-1)
  })

  it('reduces the roof to two slopes and an apex', () => {
    const poly = silhouettePolyline(house)
    expect(poly).toEqual([
      { x: 40, y: 90 },
      { x: 100, y: 30 },
      { x: 160, y: 90 },
    ])
  })

  it('keeps the apex under a looser tolerance and loses it under an absurd one', () => {
    expect(silhouettePolyline(house, { simplifyTolerance: 8 })).toHaveLength(3)
    expect(silhouettePolyline(house, { simplifyTolerance: 1000 })).toHaveLength(2)
  })
})

describe('polyline simplification', () => {
  it('drops collinear points and keeps corners deeper than the tolerance', () => {
    const line = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
    ]
    expect(simplifyPolyline(line, 1)).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ])
    const bent = [
      { x: 0, y: 0 },
      { x: 5, y: 3 },
      { x: 10, y: 0 },
    ]
    expect(simplifyPolyline(bent, 1)).toHaveLength(3)
    expect(simplifyPolyline(bent, 4)).toHaveLength(2)
  })

  it('passes through degenerate inputs untouched', () => {
    expect(simplifyPolyline([], 2)).toEqual([])
    expect(simplifyPolyline([{ x: 1, y: 2 }], 2)).toEqual([{ x: 1, y: 2 }])
  })

  it('does not overflow the stack on a point-per-column polyline', () => {
    // A zigzag under a tight tolerance is the worst case for RDP: every point
    // is a corner and every split peels off one point, so a recursive
    // implementation recurses once per column. One point per column is the
    // natural shape of a silhouette, so this is not a contrived input.
    const wide = Array.from({ length: 12000 }, (_, i) => ({ x: i, y: i % 2 }))
    expect(simplifyPolyline(wide, 0.1)).toHaveLength(12000)
  })

  it('returns nothing for an empty mask', () => {
    expect(silhouettePolyline(maskOf(() => undefined, 20, 20))).toEqual([])
  })
})
