import { describe, expect, it } from 'vitest'
import { textRegions } from '../src/metric-solution.js'
import type { TextOrientation, TextToken } from '../src/index.js'

/**
 * EXTERIOR-COMPLETE (Zefiranty G2 ver. 2, plan 83d37a0d4e): the overall "1452" and the "1142" of the chain beneath it
 * are printed one over the other, 24 px apart. The upright pass read them apart; the two rotated passes each read one
 * number ("212", "513") across both. Joined through those, the two labels became one text region — one ink read two
 * ways, which the solver counts as the witness of nothing — and the plan kept no scale. Pixel boxes as read there.
 */
const token = (text: string, orientation: TextOrientation, x0: number, y0: number, x1: number, y1: number): TextToken =>
  ({ text, orientation, box: { x0, y0, x1, y1 }, score: 0.5, confidence: 0.5, glyphs: [], shearDeg: 0, height: y1 - y0 }) as unknown as TextToken

describe('EXTERIOR-COMPLETE text regions: two labels one pass read apart stay two inks', () => {
  it('stacked labels bridged by rotated misreads: two regions, each with its own inverted reading', () => {
    const upper = token('1452', 'HORIZONTAL', 368, 38, 393, 51)
    const lower = token('1142', 'HORIZONTAL', 369, 62, 394, 74)
    const tokens = [upper, lower, token('1541', 'INVERTED', 368, 38, 393, 51), token('7111', 'INVERTED', 369, 62, 394, 74), token('212', 'ROTATED_CW', 373, 39, 393, 75), token('513', 'ROTATED_CCW', 374, 38, 395, 74)]
    const { regions, regionOf } = textRegions('frame', tokens)
    expect(regionOf.get(upper)).not.toBe(regionOf.get(lower))
    const texts = (t: TextToken): string[] => (regionOf.get(t)?.members ?? []).map((m) => m.text).sort()
    expect(texts(upper)).toContain('1541')
    expect(texts(lower)).toContain('7111')
    expect(texts(upper)).not.toContain('1142')
    expect(regions.length).toBe(2)
  })

  it('counter-case: one label read by every pass is one region', () => {
    const tokens = [token('1452', 'HORIZONTAL', 368, 38, 393, 51), token('1541', 'INVERTED', 368, 38, 393, 51), token('14', 'ROTATED_CW', 370, 36, 392, 52)]
    const { regions } = textRegions('frame', tokens)
    expect(regions.length).toBe(1)
    expect(regions[0].members.length).toBe(3)
  })
})
