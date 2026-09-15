import { describe, expect, it } from 'vitest'
import { axisAlignedSegments, connectedComponents, dominantSlopes, houghSegments, inkMask, occupancyCols, occupancyRows, parallelFamilies, rectangleCandidates, silhouettePolyline, toGray } from '../src/index.js'
import type { Mask, Raster } from '../src/index.js'
import { BLACK, drawLine, drawRectOutline, fillRect, fillTriangle, whiteRaster } from './draw.js'

/**
 * CASE 7 of the stage brief: determinism.
 *
 * Everything above this package is content-addressed — a sealed source package
 * hashes what was seen — so "same bytes in, same bytes out" is not a nicety
 * here, it is the contract. Two kinds of failure are guarded:
 *
 *   1. A second run differing from the first (cached state, iteration order,
 *      a sort that is not a total order and so depends on the engine's
 *      sort stability).
 *   2. A result that depends on the order the INPUT was built in rather than
 *      on what the input contains. The classic leak is labelling connected
 *      components in raster-scan discovery order; here the blobs are drawn in
 *      two different orders and the answer must not move.
 */
const busySheet = (): Mask => {
  const r = whiteRaster(220, 170)
  drawRectOutline(r, 15, 15, 85, 65, BLACK, 1)
  drawRectOutline(r, 120, 15, 190, 65, BLACK, 5)
  for (let i = 0; i < 7; i++) fillRect(r, 20, 90 + i * 8, 100, 90 + i * 8, BLACK)
  drawLine(r, 120, 160, 165, 100, BLACK)
  drawLine(r, 165, 100, 210, 160, BLACK)
  fillTriangle(r, 30, 150, 60, 150, 45, 130, BLACK)
  return inkMask(toGray(r))
}

describe('every detector is a pure function of its input', () => {
  const m = busySheet()

  it('repeats connectedComponents exactly', () => {
    expect(connectedComponents(m)).toEqual(connectedComponents(m))
  })

  it('repeats axisAlignedSegments exactly', () => {
    expect(axisAlignedSegments(m)).toEqual(axisAlignedSegments(m))
  })

  it('repeats houghSegments exactly', () => {
    expect(houghSegments(m)).toEqual(houghSegments(m))
  })

  it('repeats parallelFamilies and dominantSlopes exactly', () => {
    const segs = axisAlignedSegments(m)
    expect(parallelFamilies(segs)).toEqual(parallelFamilies(segs))
    expect(dominantSlopes(houghSegments(m))).toEqual(dominantSlopes(houghSegments(m)))
  })

  it('repeats rectangleCandidates, profiles and occupancy exactly', () => {
    expect(rectangleCandidates(m)).toEqual(rectangleCandidates(m))
    expect(silhouettePolyline(m)).toEqual(silhouettePolyline(m))
    expect(occupancyRows(m)).toEqual(occupancyRows(m))
    expect(occupancyCols(m)).toEqual(occupancyCols(m))
  })

  it('produces a stable ordering rather than a merely repeatable one', () => {
    // support/pixels descending with positional tie-breaks: no two neighbours
    // may be out of order under the documented comparator.
    const comps = connectedComponents(m)
    for (let i = 1; i < comps.length; i++) {
      const prev = comps[i - 1]
      const cur = comps[i]
      expect(prev.pixels === cur.pixels ? prev.bounds.x0 <= cur.bounds.x0 : prev.pixels > cur.pixels).toBe(true)
      expect(cur.id).toBe(i)
    }
  })
})

describe('results do not depend on the order the drawing was built', () => {
  const shapes: Array<(r: Raster) => void> = [
    (r) => drawRectOutline(r, 20, 20, 70, 70, BLACK, 1),
    (r) => drawRectOutline(r, 120, 20, 170, 70, BLACK, 1),
    (r) => fillRect(r, 20, 100, 170, 101, BLACK),
    (r) => drawLine(r, 30, 160, 90, 120, BLACK),
  ]
  const build = (order: readonly number[]): Mask => {
    const r = whiteRaster(200, 180)
    for (const i of order) shapes[i](r)
    return inkMask(toGray(r))
  }
  const forward = build([0, 1, 2, 3])
  const backward = build([3, 2, 1, 0])

  it('builds the identical mask either way', () => {
    expect(Array.from(forward.data)).toEqual(Array.from(backward.data))
  })

  it('labels components identically, including ids', () => {
    expect(connectedComponents(forward)).toEqual(connectedComponents(backward))
  })

  it('detects identical segments, families and rectangles', () => {
    expect(axisAlignedSegments(forward)).toEqual(axisAlignedSegments(backward))
    expect(houghSegments(forward)).toEqual(houghSegments(backward))
    expect(parallelFamilies(axisAlignedSegments(forward))).toEqual(parallelFamilies(axisAlignedSegments(backward)))
    expect(rectangleCandidates(forward)).toEqual(rectangleCandidates(backward))
  })

  it('numbers two equal-sized blobs by position, though a raster scan meets one first', () => {
    const r = whiteRaster(120, 120)
    fillRect(r, 80, 10, 99, 29, BLACK) // reached first by the scan
    fillRect(r, 10, 80, 29, 99, BLACK) // but smaller x0, so it must be id 0
    const comps = connectedComponents(inkMask(toGray(r)))
    expect(comps.map((c) => c.pixels)).toEqual([400, 400])
    expect(comps[0].bounds.x0).toBe(10)
    expect(comps[1].bounds.x0).toBe(80)
  })
})
