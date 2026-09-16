import { describe, expect, it } from 'vitest'
import { inkMask, runLengthBands, toGray } from '../src/index.js'
import { BLACK, drawLine, fillRect, whiteRaster } from './draw.js'

/**
 * The distinction this file exists for: a WALL is a long run that is also
 * THICK, and everything else drawn on a plan is one or the other but not both.
 */
describe('bands separate walls from line work', () => {
  it('finds a thick run and ignores a thin one of the same length', () => {
    const r = whiteRaster(200, 80)
    fillRect(r, 20, 20, 179, 31, BLACK) // a 12 px wall
    drawLine(r, 20, 60, 179, 60, BLACK) // a 1 px line
    const bands = runLengthBands(inkMask(toGray(r)), { minThickness: 6, maxThickness: 30, minLength: 40 })
    expect(bands.length).toBe(1)
    expect(bands[0].axis).toBe('HORIZONTAL')
    expect(bands[0].thickness).toBe(12)
    expect(bands[0].axisPx).toBeCloseTo(25.5, 6)
    expect(bands[0].bounds).toEqual({ x0: 20, y0: 20, x1: 179, y1: 31 })
  })

  it('ignores a blob too thick to be a wall', () => {
    const r = whiteRaster(200, 200)
    fillRect(r, 20, 20, 179, 170, BLACK)
    expect(runLengthBands(inkMask(toGray(r)), { minThickness: 6, maxThickness: 30, minLength: 40 })).toEqual([])
  })

  it('carries a wall across the openings in it, and counts the pieces', () => {
    const r = whiteRaster(300, 60)
    fillRect(r, 10, 20, 89, 31, BLACK)
    fillRect(r, 120, 20, 199, 31, BLACK) // a 30 px doorway
    fillRect(r, 230, 20, 289, 31, BLACK) // a 30 px window
    const bands = runLengthBands(inkMask(toGray(r)), { minThickness: 6, maxThickness: 30, minLength: 40 })
    expect(bands.length).toBe(1)
    expect(bands[0].pieces).toBe(3)
    expect(bands[0].bounds.x0).toBe(10)
    expect(bands[0].bounds.x1).toBe(289)
    expect(bands[0].fill).toBeLessThan(1)
  })

  it('does not carry a wall across a gap wider than the wall either side of it', () => {
    const r = whiteRaster(300, 60)
    fillRect(r, 10, 20, 59, 31, BLACK)
    fillRect(r, 250, 20, 289, 31, BLACK)
    const bands = runLengthBands(inkMask(toGray(r)), { minThickness: 6, maxThickness: 30, minLength: 40 })
    expect(bands.length).toBe(2)
    expect(bands.map((b) => b.bounds.x0)).toEqual([10, 250])
  })

  it('reads both axes of a closed rectangular ring as four walls', () => {
    const r = whiteRaster(220, 180)
    fillRect(r, 20, 20, 199, 31, BLACK)
    fillRect(r, 20, 148, 199, 159, BLACK)
    fillRect(r, 20, 20, 31, 159, BLACK)
    fillRect(r, 188, 20, 199, 159, BLACK)
    const bands = runLengthBands(inkMask(toGray(r)), { minThickness: 6, maxThickness: 30, minLength: 40 })
    expect(bands.filter((b) => b.axis === 'HORIZONTAL').map((b) => Math.round(b.axisPx))).toEqual([26, 154])
    expect(bands.filter((b) => b.axis === 'VERTICAL').map((b) => Math.round(b.axisPx))).toEqual([26, 194])
  })

  it('is deterministic', () => {
    const r = whiteRaster(220, 180)
    fillRect(r, 20, 20, 199, 31, BLACK)
    fillRect(r, 20, 20, 31, 159, BLACK)
    const m = inkMask(toGray(r))
    expect(JSON.stringify(runLengthBands(m))).toBe(JSON.stringify(runLengthBands(m)))
  })
})
