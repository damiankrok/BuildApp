/**
 * The second band pass's window, on invented surveys: centred on the measured wall thickness, widened only by walls
 * that run the length of the building.
 */
import { describe, expect, it } from 'vitest'
import { wallBandWindow } from '../src/layout.js'

describe('wallBandWindow', () => {
  it('a sheet of partitions: the window spans 0.45–1.9 of the wall thickness', () => {
    expect(wallBandWindow([{ length: 400, thickness: 10 }, { length: 300, thickness: 11 }], 10, 60)).toEqual({ minThickness: 5, maxThickness: 19, minLength: 16 })
  })
  it('an outer wall running the building’s length a hair over 1.9 partitions widens the window to hold it', () => {
    const survey = [{ length: 500, thickness: 22 }, { length: 200, thickness: 11 }, { length: 180, thickness: 11 }]
    expect(wallBandWindow(survey, 11, 60).maxThickness).toBe(23)
  })
  it('a short thick blot (a chimney) does not widen it', () => {
    const survey = [{ length: 500, thickness: 11 }, { length: 40, thickness: 35 }]
    expect(wallBandWindow(survey, 11, 60).maxThickness).toBe(21)
  })
  it('the caller’s ceiling still holds, and a tiny raster keeps a usable floor', () => {
    expect(wallBandWindow([{ length: 500, thickness: 80 }], 11, 30).maxThickness).toBe(30)
    expect(wallBandWindow([], 2, 60)).toEqual({ minThickness: 3, maxThickness: 6, minLength: 8 })
  })
})
