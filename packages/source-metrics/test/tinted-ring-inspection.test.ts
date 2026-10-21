/**
 * The cheap test of a found tinted ring, on invented greys: digits inside, a clear margin, and a bar across the
 * centre make a barred callout; an empty disc, a filled blob, or a line through the margin make none.
 */
import { describe, expect, it } from 'vitest'
import { inspectTintedRing, tintedRingHalves } from '../src/callouts.js'

const hit = { cx: 30, cy: 30, r: 12, share: 0.9, interior: 230, ring: 150, outside: 200 }
const paper = 230
const ink = 60
/** A grey field built from a list of inked predicates. */
const field = (...inked: Array<(x: number, y: number) => boolean>) => (x: number, y: number): number => (inked.some((f) => f(x, y)) ? ink : paper)
const bar = (x: number, y: number) => y === 30 && Math.abs(x - 30) <= 8
const digits = (x: number, y: number) => (Math.abs(y - 25) <= 2 || Math.abs(y - 35) <= 2) && Math.abs(x - 30) <= 3

describe('inspectTintedRing', () => {
  it('digits above and below a bar: a callout split at the bar', () => {
    expect(inspectTintedRing(field(bar, digits), hit)).toEqual({ bar: { y0: 30, y1: 30 } })
  })
  it('digits with no bar: a callout with no bar', () => {
    expect(inspectTintedRing(field(digits), hit)).toEqual({ bar: null })
  })
  it('an empty disc, a filled blob, or hatching through the margin is not a callout', () => {
    expect(inspectTintedRing(field(), hit)).toBeNull()
    expect(inspectTintedRing(field(() => true), hit)).toBeNull()
    expect(inspectTintedRing(field(digits, (x, y) => (x + y) % 3 === 0), hit)).toBeNull()
  })
})

describe('tintedRingHalves', () => {
  it('splits at the bar, the bar painted out, and darkness measured against the disc', () => {
    const { upper, lower } = tintedRingHalves(field(bar, digits), hit, { y0: 30, y1: 30 })
    expect(upper?.height).toBe(11)
    expect(lower?.height).toBe(11)
    expect(Math.min(...(upper?.data ?? []))).toBeLessThan(100)
    expect(Math.min(...(lower?.data ?? []))).toBeLessThan(100)
  })
})
