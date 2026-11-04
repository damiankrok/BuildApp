/**
 * EXTERIOR-COMPLETE (Zefiranty G2 ver. 2): a hipped main roof the page states was kept a gable because its four plan
 * rooflights were read against the gable's two slopes and nothing re-homed them (two of them stand where the hips' end
 * planes are). A rooflight whose whole plan footprint lies in one plane of the hipped layout is in that plane — a side
 * slope only when it is the side it was read on; one across a hip's line has no home and holds the gable. Invented
 * body; no drawing.
 */
import { describe, expect, it } from 'vitest'
import { planeRoofLayout, rooflightPlaneKey } from '../src/index.js'

// 11.42 m across a ridge along z, 12.32 m along it; 38°; both ends hipped: the hips run in 5.71 m from each end.
const layout = planeRoofLayout({ x0: 2.2, x1: 13.62, z0: 2, z1: 14.32 }, 'Z', 38, 3.7, { min: 'HIP', max: 'HIP' })
const light = (slope: 'LOW' | 'HIGH', along: [number, number], across: [number, number]) => ({ slope, alongFrom: along[0], alongTo: along[1], slopeFrom: across[0], slopeTo: across[1] })

describe('EXTERIOR-COMPLETE a rooflight in a hipped roof', () => {
  it('mid-slope, clear of both hips: in the slope it was read on', () => {
    expect(rooflightPlaneKey(layout, 'Z', light('LOW', [7.6, 8.4], [4.0, 4.9]))).toBe('LOW')
    expect(rooflightPlaneKey(layout, 'Z', light('HIGH', [7.6, 8.4], [10.9, 11.8]))).toBe('HIGH')
  })

  it('near an eave close to an end, still inside the trapezoid the hip leaves the slope', () => {
    // 0.6 m in from the low eave (x 2.2), the slope spans z 2.6 .. 13.72 there
    expect(rooflightPlaneKey(layout, 'Z', light('LOW', [3.0, 3.8], [2.4, 2.8]))).toBe('LOW')
  })

  it('counter-case: across a hip line it has no home, and the gable is kept', () => {
    // 3 m in from the low eave the slope starts at z 5.0; a light from 4.5 to 5.3 straddles the hip
    expect(rooflightPlaneKey(layout, 'Z', light('LOW', [4.5, 5.3], [5.0, 5.4]))).toBeUndefined()
  })

  it('wholly in an end plane: in that plane, whichever side of the ridge line it was read on', () => {
    expect(rooflightPlaneKey(layout, 'Z', light('LOW', [2.6, 3.2], [7.0, 7.6]))).toBe('END_MIN')
    expect(rooflightPlaneKey(layout, 'Z', light('HIGH', [13.2, 13.9], [8.4, 9.0]))).toBe('END_MAX')
  })

  it('counter-case: in the other side slope than it was read on, it has no home', () => {
    expect(rooflightPlaneKey(layout, 'Z', light('HIGH', [7.6, 8.4], [4.0, 4.9]))).toBeUndefined()
  })

  it('a ridge along x reads along as x and up the slope as z', () => {
    const turned = planeRoofLayout({ x0: 2, x1: 14.32, z0: 2.2, z1: 13.62 }, 'X', 38, 3.7, { min: 'HIP', max: 'HIP' })
    expect(rooflightPlaneKey(turned, 'X', light('LOW', [7.6, 8.4], [4.0, 4.9]))).toBe('LOW')
  })
})
