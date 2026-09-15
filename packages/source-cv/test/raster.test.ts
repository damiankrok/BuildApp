import { describe, expect, it } from 'vitest'
import { cropGray, downscaleGray, grayAt, inkChannel, inkMask, percentile, saturationField, toGray } from '../src/index.js'
import { BLACK, CYAN, GREY30, RED, fillRect, whiteRaster } from './draw.js'

/**
 * CASE 6 of the stage brief: ink versus luma.
 *
 * This is the whole justification for `inkChannel` existing, so the test does
 * not merely assert "red is dark" — it asserts the AMBIGUITY that luma cannot
 * resolve and that the channel minimum can.
 */
describe('ink channel versus luma', () => {
  const sheet = whiteRaster(60, 40)
  fillRect(sheet, 5, 10, 54, 10, RED) // a saturated red dimension annotation
  fillRect(sheet, 5, 20, 54, 20, GREY30) // grey furniture hatching
  fillRect(sheet, 5, 30, 54, 30, CYAN) // a saturated cyan grid line
  const luma = toGray(sheet)
  const ink = inkChannel(sheet)

  it('cannot tell saturated red from neutral grey by luma alone', () => {
    // Rec. 601 luma of (255,0,0) is 0.299*255 = 76.2, and of (76,76,76) is 76.
    expect(grayAt(luma, 20, 10)).toBe(76)
    expect(grayAt(luma, 20, 20)).toBe(76)
    expect(Math.abs(grayAt(luma, 20, 10) - grayAt(luma, 20, 20))).toBeLessThanOrEqual(1)
  })

  it('separates them cleanly by channel minimum', () => {
    expect(grayAt(ink, 20, 10)).toBe(0)
    expect(grayAt(ink, 20, 20)).toBe(76)
    expect(grayAt(ink, 20, 20) - grayAt(ink, 20, 10)).toBeGreaterThanOrEqual(70)
  })

  it('keeps a saturated line dark that luma reports as nearly paper', () => {
    // cyan: luma 179 — above any sane ink threshold — but a channel minimum of 0.
    expect(grayAt(luma, 20, 30)).toBe(179)
    expect(grayAt(ink, 20, 30)).toBe(0)
    expect(grayAt(luma, 20, 30) - grayAt(ink, 20, 30)).toBe(179)
  })

  it('loses the cyan grid line through a luma mask and keeps it through an ink mask', () => {
    const fromLuma = inkMask(luma)
    const fromInk = inkMask(ink)
    const rowSet = (m: { width: number; data: Uint8Array }, y: number): number => {
      let c = 0
      for (let x = 0; x < m.width; x++) c += m.data[y * m.width + x]
      return c
    }
    expect(rowSet(fromLuma, 10)).toBe(50) // red survives either way
    expect(rowSet(fromLuma, 30)).toBe(0) // cyan does not survive luma
    expect(rowSet(fromInk, 30)).toBe(50) // but does survive the ink channel
  })

  it('reports chroma only where a colour decision was made', () => {
    const sat = saturationField(sheet)
    expect(grayAt(sat, 20, 10)).toBe(255)
    expect(grayAt(sat, 20, 20)).toBe(0)
    expect(grayAt(sat, 20, 30)).toBe(255)
    expect(grayAt(sat, 0, 0)).toBe(0)
  })
})

describe('field utilities', () => {
  it('reads percentiles exactly from the 256-bucket histogram', () => {
    const r = whiteRaster(10, 10)
    fillRect(r, 0, 0, 9, 1, BLACK) // 20 of 100 pixels are 0
    const g = toGray(r)
    expect(percentile(g, 0)).toBe(0)
    expect(percentile(g, 0.1)).toBe(0)
    expect(percentile(g, 0.5)).toBe(255)
    expect(percentile(g, 1)).toBe(255)
    // p outside [0,1] clamps rather than throwing
    expect(percentile(g, -3)).toBe(0)
    expect(percentile(g, 9)).toBe(255)
  })

  it('returns the same object when a downscale is not needed', () => {
    const g = toGray(whiteRaster(40, 30))
    expect(downscaleGray(g, 64)).toBe(g)
  })

  it('box-filters to a bounded long edge and preserves mean ink density', () => {
    const r = whiteRaster(80, 40)
    fillRect(r, 0, 0, 39, 39, BLACK) // exactly the left half is ink
    const small = downscaleGray(toGray(r), 20)
    expect(small.width).toBe(20)
    expect(small.height).toBe(10)
    expect(grayAt(small, 4, 5)).toBe(0)
    expect(grayAt(small, 15, 5)).toBe(255)
  })

  it('crops inclusively and clamps a rect that leaves the field', () => {
    const r = whiteRaster(20, 20)
    fillRect(r, 5, 5, 9, 9, BLACK)
    const g = toGray(r)
    const c = cropGray(g, { x0: 5, y0: 5, x1: 9, y1: 9 })
    expect(c.width).toBe(5)
    expect(c.height).toBe(5)
    expect(Array.from(c.data).every((v) => v === 0)).toBe(true)
    const off = cropGray(g, { x0: 100, y0: 100, x1: 200, y1: 200 })
    expect(off.width).toBe(1)
    expect(off.height).toBe(1)
  })

  it('clamps to the edge rather than wrapping or inventing a dark border', () => {
    const r = whiteRaster(8, 8)
    fillRect(r, 0, 0, 0, 0, BLACK)
    const g = toGray(r)
    expect(grayAt(g, -5, -5)).toBe(0)
    expect(grayAt(g, 100, 100)).toBe(255)
  })
})
