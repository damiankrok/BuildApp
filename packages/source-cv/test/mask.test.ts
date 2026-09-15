import { describe, expect, it } from 'vitest'
import { connectedComponents, dilate, erode, inkMask, maskBounds, maskIoU, occupancyCols, occupancyRows, threshold, toGray } from '../src/index.js'
import { BLACK, fillRect, whiteRaster } from './draw.js'

const sheetWithRect = () => {
  const r = whiteRaster(50, 30)
  fillRect(r, 10, 5, 39, 24, BLACK)
  return inkMask(toGray(r))
}

/** CASE 8 of the stage brief: occupancy and profiles on a rectangle whose every number is known. */
describe('occupancy on a known rectangle', () => {
  const m = sheetWithRect()

  it('fills exactly the drawn rows and columns', () => {
    const rows = occupancyRows(m)
    expect(rows.length).toBe(30)
    expect(rows[4]).toBe(0)
    expect(rows[5]).toBeCloseTo(30 / 50, 6) // 30 inked columns of 50
    expect(rows[24]).toBeCloseTo(30 / 50, 6)
    expect(rows[25]).toBe(0)

    const cols = occupancyCols(m)
    expect(cols.length).toBe(50)
    expect(cols[9]).toBe(0)
    expect(cols[10]).toBeCloseTo(20 / 30, 6) // 20 inked rows of 30
    expect(cols[39]).toBeCloseTo(20 / 30, 6)
    expect(cols[40]).toBe(0)
  })

  it('reports the inclusive bounding box of the ink', () => {
    expect(maskBounds(m)).toEqual({ x0: 10, y0: 5, x1: 39, y1: 24 })
    expect(maskBounds({ width: 4, height: 4, data: new Uint8Array(16) })).toBeNull()
  })

  it('describes the rectangle as one solid component', () => {
    const comps = connectedComponents(m)
    expect(comps.length).toBe(1)
    expect(comps[0]).toEqual({
      id: 0,
      pixels: 600,
      bounds: { x0: 10, y0: 5, x1: 39, y1: 24 },
      centroid: { x: 24.5, y: 14.5 },
      fill: 1, // a filled rect fills its own inclusive bounding box exactly
    })
  })
})

describe('mask algebra', () => {
  it('thresholds on darkness, because ink is dark', () => {
    const r = whiteRaster(4, 1)
    fillRect(r, 0, 0, 1, 0, BLACK)
    const m = threshold(toGray(r), 128)
    expect(Array.from(m.data)).toEqual([1, 1, 0, 0])
  })

  it('scores intersection over union, and scores two empty masks as no evidence', () => {
    const a = sheetWithRect()
    expect(maskIoU(a, a)).toBe(1)
    const r = whiteRaster(50, 30)
    fillRect(r, 20, 5, 49, 24, BLACK) // shifted 10px right, same size
    const b = inkMask(toGray(r))
    // 20 of 30 columns overlap: IoU = (20*20)/(30*20 + 30*20 - 20*20)
    expect(maskIoU(a, b)).toBeCloseTo(400 / 800, 5)
    const empty = { width: 4, height: 4, data: new Uint8Array(16) }
    expect(maskIoU(empty, empty)).toBe(0)
  })

  it('grows and shrinks by a Chebyshev radius', () => {
    const r = whiteRaster(20, 20)
    fillRect(r, 9, 9, 10, 10, BLACK)
    const m = inkMask(toGray(r))
    const grown = dilate(m, 1)
    expect(maskBounds(grown)).toEqual({ x0: 8, y0: 8, x1: 11, y1: 11 })
    expect(maskBounds(erode(grown, 1))).toEqual({ x0: 9, y0: 9, x1: 10, y1: 10 })
    expect(erode(m, 2).data.some((v) => v === 1)).toBe(false)
  })

  it('numbers components by size and position, never by discovery order', () => {
    const r = whiteRaster(60, 60)
    // two blobs of identical size: the sort must fall through to position
    fillRect(r, 40, 5, 49, 14, BLACK) // discovered first by a raster scan
    fillRect(r, 5, 40, 14, 49, BLACK) // but is further right, so it is id 1
    const comps = connectedComponents(inkMask(toGray(r)))
    expect(comps.map((c) => c.id)).toEqual([0, 1])
    expect(comps[0].bounds).toEqual({ x0: 5, y0: 40, x1: 14, y1: 49 })
    expect(comps[1].bounds).toEqual({ x0: 40, y0: 5, x1: 49, y1: 14 })
  })

  it('honours minPixels and connectivity', () => {
    const r = whiteRaster(20, 20)
    fillRect(r, 2, 2, 3, 3, BLACK)
    fillRect(r, 4, 4, 5, 5, BLACK) // touches the first only at a corner
    fillRect(r, 15, 15, 15, 15, BLACK) // a single speck
    const m = inkMask(toGray(r))
    expect(connectedComponents(m, { connectivity: 8 }).length).toBe(2)
    expect(connectedComponents(m, { connectivity: 4 }).length).toBe(3)
    expect(connectedComponents(m, { connectivity: 4, minPixels: 2 }).length).toBe(2)
  })
})
