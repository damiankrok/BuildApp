/**
 * E13 (Aurory): which way the main ridge runs when the layout's rise test and the registered views disagree. Invented
 * values: a 12 × 9.2 m body, a stated 40° gable; the front and rear views measure a flat top over their middle.
 */
import { describe, expect, it } from 'vitest'
import { decideRidgeAxis } from '../src/v2/ridge-axis.js'

const flat = (side: string, peakM = -0.01) => ({ side, peakM, gableEnd: false })
const base = { statedPitchDeg: 40, hip: false, spanX: 12, spanZ: 9.2 }

describe('decideRidgeAxis', () => {
  it('views that see eaves sides where the layout\'s axis would show gable ends overturn the layout (Aurory)', () => {
    const d = decideRidgeAxis({ ...base, apexVotes: [flat('FRONT'), flat('REAR')], layoutAxis: 'Z' })
    expect(d.ridgeAxis).toBe('X')
    expect(d.overturned).toBe(true)
    expect(d.fittedAxis?.why).toMatch(/fits a ridge along X/)
  })
  it('the same, the body turned: side views flat over a layout axis along X give Z', () => {
    const d = decideRidgeAxis({ ...base, spanX: 9.2, spanZ: 12, apexVotes: [flat('LEFT'), flat('RIGHT')], layoutAxis: 'X' })
    expect(d.ridgeAxis).toBe('Z')
    expect(d.overturned).toBe(true)
  })
  it('one registered view is enough when it contradicts outright', () => {
    expect(decideRidgeAxis({ ...base, apexVotes: [flat('REAR', 0.05)], layoutAxis: 'Z' }).ridgeAxis).toBe('X')
  })
  it('counter: views that agree with the layout keep it, and are not called an overturn', () => {
    const d = decideRidgeAxis({ ...base, apexVotes: [flat('FRONT'), flat('REAR')], layoutAxis: 'X' })
    expect(d.ridgeAxis).toBe('X')
    expect(d.overturned).toBe(false)
  })
  it('counter: a gable end seen on the front votes Z whatever the layout says', () => {
    const d = decideRidgeAxis({ ...base, apexVotes: [{ side: 'FRONT', peakM: 3.4, gableEnd: true }], layoutAxis: 'X' })
    expect(d.ridgeAxis).toBe('Z')
    expect(d.votedAxis).toBe('Z')
  })
  it('counter: a view that rises part way fits neither axis, and the layout stands', () => {
    const d = decideRidgeAxis({ ...base, apexVotes: [flat('FRONT', 1.2)], layoutAxis: 'Z' })
    expect(d.ridgeAxis).toBe('Z')
    expect(d.overturned).toBe(false)
  })
  it('counter: on a small, shallow roof a gable end would rise under a metre, and a flat view does not overturn', () => {
    const d = decideRidgeAxis({ statedPitchDeg: 15, hip: false, spanX: 5, spanZ: 4, apexVotes: [flat('FRONT')], layoutAxis: 'Z' })
    expect(d.ridgeAxis).toBe('Z')
    expect(d.overturned).toBe(false)
  })
  it('counter: without a stated pitch nothing is predicted, and the layout stands', () => {
    expect(decideRidgeAxis({ ...base, statedPitchDeg: undefined, apexVotes: [flat('FRONT'), flat('REAR')], layoutAxis: 'Z' }).ridgeAxis).toBe('Z')
  })
  it('without a layout axis the fitted axis is taken, as before', () => {
    expect(decideRidgeAxis({ ...base, apexVotes: [flat('FRONT'), flat('REAR')] }).ridgeAxis).toBe('X')
  })
  it('counter: a hipped roof\'s eaves side rises by the hip\'s run, which fits the other axis but is no outright contradiction', () => {
    // hip run on the long side: (min(6, 4.6) − min(1.8, 4.6)) × tan 40 = 2.35 m; a gable end would show 3.52 m
    const d = decideRidgeAxis({ ...base, hip: true, apexVotes: [flat('FRONT', 2.3), flat('REAR', 2.4)], layoutAxis: 'Z' })
    expect(d.fittedAxis?.axis).toBe('X')
    expect(d.ridgeAxis).toBe('Z')
    expect(d.overturned).toBe(false)
  })

  // v3.45 (Willa Maja): a 17.22 × 7.80 m hipped body at a stated 22°; its one voting view rises 1.00 m, which fits
  // neither axis (a hip's run would show 0.53 m, an end 2.43 m), and the layout states no axis
  const maja = { statedPitchDeg: 22, hip: true, spanX: 17.22, spanZ: 7.8 }
  it('v3.45: where nothing decides, a roof falling four ways at one pitch has its ridge along the longer side', () => {
    const d = decideRidgeAxis({ ...maja, apexVotes: [flat('REAR', 1.0)] })
    expect(d.fittedAxis).toBeUndefined()
    expect(d.ridgeAxis).toBe('X')
    expect(d.fallback).toMatchObject({ axis: 'X', geometric: true })
  })
  it('v3.45: the same body turned gives Z; with no view at all the geometry still decides', () => {
    expect(decideRidgeAxis({ ...maja, spanX: 7.8, spanZ: 17.22, apexVotes: [flat('LEFT', 1.0)] }).ridgeAxis).toBe('Z')
    expect(decideRidgeAxis({ ...maja, apexVotes: [] }).ridgeAxis).toBe('X')
  })
  it('counter: a gable roof or a square hipped body has no geometric axis: the convention stands and is named', () => {
    const g = decideRidgeAxis({ ...maja, hip: false, apexVotes: [flat('REAR', 1.0)] })
    expect(g.ridgeAxis).toBe('Z')
    expect(g.fallback).toMatchObject({ geometric: false })
    expect(decideRidgeAxis({ ...maja, spanX: 10, spanZ: 10, apexVotes: [] }).fallback).toMatchObject({ axis: 'Z', geometric: false })
  })
  it('counter: a layout axis, a fit or a voted gable end is never replaced by the geometric fallback', () => {
    expect(decideRidgeAxis({ ...maja, apexVotes: [flat('REAR', 1.0)], layoutAxis: 'Z' }).ridgeAxis).toBe('Z')
    expect(decideRidgeAxis({ ...maja, apexVotes: [{ side: 'FRONT', peakM: 2.4, gableEnd: true }] }).ridgeAxis).toBe('Z')
    expect(decideRidgeAxis({ ...maja, apexVotes: [flat('REAR', 1.0)], layoutAxis: 'Z' }).fallback).toBeUndefined()
  })
})
