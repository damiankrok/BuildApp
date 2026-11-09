/**
 * v3.51 ANY-LINK: the size a plan sheet is read at (`reading-size.ts`). A sheet whose walls are thicker in pixels than
 * the range the plan readers were measured on is read smaller; a sheet inside the range — every sheet they were
 * measured on — keeps its own size, whatever its size in pixels.
 */
import { describe, expect, it } from 'vitest'
import { READING_MAX_TYPICAL_WALL_PX, READING_MIN_LONG_SIDE_PX, READING_TARGET_TYPICAL_WALL_PX, frameRasters, planReadingSize, resampleRaster, typicalWallPx } from '../src/index.js'
import type { Raster } from '../src/index.js'
import { BLACK, fillRect, whiteRaster } from './draw.js'

/** A house of two rooms: an outer ring `wall` px thick and one partition, on a sheet `k` times 800×600. */
const house = (k: number, wall: number): Raster => {
  const r = whiteRaster(800 * k, 600 * k)
  const [x0, y0, x1, y1] = [100 * k, 100 * k, 700 * k, 500 * k]
  fillRect(r, x0, y0, x1, y0 + wall - 1, BLACK)
  fillRect(r, x0, y1 - wall + 1, x1, y1, BLACK)
  fillRect(r, x0, y0, x0 + wall - 1, y1, BLACK)
  fillRect(r, x1 - wall + 1, y0, x1, y1, BLACK)
  fillRect(r, 400 * k, y0, 400 * k + wall - 1, y1, BLACK)
  return r
}

describe('the size a plan sheet is read at', () => {
  it('a sheet whose walls are in the measured range keeps its own size', () => {
    const r = house(1, 12)
    expect(typicalWallPx(r)).toBe(12)
    expect(planReadingSize(r)).toEqual({ size: { width: 800, height: 600 }, typicalWallPx: 12, reduction: 1 })
    // the thickest wall the readers were measured on is still inside it
    expect(planReadingSize(house(1, 27)).reduction).toBe(1)
  })

  it('a sheet drawn finer, its walls thicker than the range, is read at the size where they are typical', () => {
    const r = house(3, 36)
    const reading = planReadingSize(r)
    expect(reading.typicalWallPx).toBe(36)
    expect(reading.reduction).toBe(36 / READING_TARGET_TYPICAL_WALL_PX)
    expect(reading.size).toEqual({ width: Math.round(2400 / 2.25), height: Math.round(1800 / 2.25) })
    // and there its walls measure what the range's do
    const wall = typicalWallPx(resampleRaster(r, reading.size))
    expect(wall).toBeGreaterThanOrEqual(READING_TARGET_TYPICAL_WALL_PX - 2)
    expect(wall).toBeLessThanOrEqual(READING_TARGET_TYPICAL_WALL_PX + 2)
  })

  it('counter-case: a large sheet with walls of ordinary thickness is left alone — the rule is about walls, not sheets', () => {
    const r = house(3, 12)
    expect(typicalWallPx(r)).toBeLessThanOrEqual(READING_MAX_TYPICAL_WALL_PX)
    expect(planReadingSize(r).size).toEqual({ width: 2400, height: 1800 })
  })

  it('counter-case: a sheet with no wall to measure is left alone', () => {
    expect(planReadingSize(whiteRaster(2000, 1500))).toEqual({ size: { width: 2000, height: 1500 }, typicalWallPx: 0, reduction: 1 })
  })

  it('never reads a sheet under the size at which its digits and partitions are gone', () => {
    // walls 60 px on an 800×600 sheet ask for a reduction of 3.75; the long side stops at the floor
    const reading = planReadingSize(house(1, 60))
    expect(Math.max(reading.size.width, reading.size.height)).toBe(READING_MIN_LONG_SIDE_PX)
  })
})

describe('resampling a picture to its reading size', () => {
  it('is the identity at the picture’s own size', () => {
    const r = house(1, 12)
    expect(resampleRaster(r, { width: 800, height: 600 })).toBe(r)
  })

  it('averages the area each output pixel covers, exactly', () => {
    const r = whiteRaster(4, 2)
    fillRect(r, 0, 0, 1, 1, BLACK)
    fillRect(r, 2, 0, 2, 1, BLACK)
    const half = resampleRaster(r, { width: 2, height: 1 })
    expect(Array.from(half.data)).toEqual([0, 0, 0, 255, 128, 128, 128, 255])
    // a fractional step: three source columns under each of two output columns of a 3-wide strip
    const strip = whiteRaster(3, 1)
    fillRect(strip, 0, 0, 0, 0, BLACK)
    expect(Array.from(resampleRaster(strip, { width: 2, height: 1 }).data.filter((_, i) => i % 4 === 0))).toEqual([85, 255])
  })

  it('gives the same raster for the same picture, every time', () => {
    const r = house(3, 36)
    const a = resampleRaster(r, { width: 1067, height: 800 })
    const b = resampleRaster(r, { width: 1067, height: 800 })
    expect(Buffer.from(a.data).equals(Buffer.from(b.data))).toBe(true)
  })
})

describe('the pictures a run hands its readers', () => {
  it('are at their frame’s size once the frames are known, and as decoded otherwise', () => {
    const rasters = frameRasters()
    const big = house(3, 36)
    const plain = house(1, 12)
    rasters.set('a'.repeat(64), big)
    rasters.set('b'.repeat(64), plain)
    rasters.set('c'.repeat(64), undefined)
    expect(rasters.get('a'.repeat(64))).toBe(big)
    rasters.useFrames([{ variantByteHash: 'a'.repeat(64), size: { width: 1067, height: 800 } }, { variantByteHash: 'b'.repeat(64), size: { width: 800, height: 600 } }])
    const read = rasters.get('a'.repeat(64))
    expect({ width: read?.width, height: read?.height }).toEqual({ width: 1067, height: 800 })
    expect(rasters.get('a'.repeat(64))).toBe(read)
    expect(rasters.get('b'.repeat(64))).toBe(plain)
    expect(rasters.get('c'.repeat(64))).toBeUndefined()
    expect(rasters.has('c'.repeat(64))).toBe(true)
    expect(rasters.has('d'.repeat(64))).toBe(false)
  })
})
