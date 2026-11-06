/**
 * EXTERIOR-COMPLETE E12 (Muraje, ground plan 18a0a3cc89): the body cut on a front wall's AXIS leaves the wall's outer
 * half between it and the plan's extent. The 005Q rule named a strip as the building's own wall only when the whole
 * band lay inside it (both faces on the strip's edges), so this half-wall strip was a zone — or not, by half a pixel:
 * with the grid line at 672.75 px the strip was 12.25 px, under the half-wall minimum (12.5 px), and there was no
 * zone; at 672 px it was 13 px, a zone, and a 0.20 m "recess" with two 1.25 m returns, a paved floor, a balcony slab
 * and a railing was built inside the front wall's own outer half. A strip is that wall when the band's outer face is
 * on the strip's outer edge and the band reaches the strip's inner edge (on it, or past it), the strip no deeper than
 * the band. Counter-cases: a band clear of the outer edge (a terrace kerb in front of a set-back wall) and a strip
 * deeper than the band (a real zone in front of the wall) are not the wall.
 *
 * Made-up readings on `wall-strip-unit.test.ts`'s reduced `PlanReading` (no house, no published figure).
 */
import { describe, expect, it } from 'vitest'
import { wallStripsOf } from '../src/layout.js'
import type { PlanReading } from '../src/layout.js'

type Rect = { x0: number; y0: number; x1: number; y1: number }
type BandSpec = { axis: 'HORIZONTAL' | 'VERTICAL'; bounds: Rect }
const H_ = (x0: number, y0: number, x1: number, y1: number): BandSpec => ({ axis: 'HORIZONTAL', bounds: { x0, y0, x1, y1 } })
const V_ = (x0: number, y0: number, x1: number, y1: number): BandSpec => ({ axis: 'VERTICAL', bounds: { x0, y0, x1, y1 } })

function reading(bands: BandSpec[], extent: Rect): PlanReading {
  const bs = bands.map((b) => {
    const across = b.axis === 'HORIZONTAL' ? b.bounds.y1 - b.bounds.y0 : b.bounds.x1 - b.bounds.x0
    const along = b.axis === 'HORIZONTAL' ? b.bounds.x1 - b.bounds.x0 : b.bounds.y1 - b.bounds.y0
    const axisPx = b.axis === 'HORIZONTAL' ? (b.bounds.y0 + b.bounds.y1) / 2 : (b.bounds.x0 + b.bounds.x1) / 2
    return { axis: b.axis, bounds: { ...b.bounds }, thickness: across, length: along, fill: 1, axisPx, pieces: 1, segments: [] }
  })
  return { frame: { id: 'frame-unit' }, wallPx: 25, decomposition: { wallThickness: { px: 25 } }, extent, bands: bs, registration: { metresPerPixelX: 0.0155, metresPerPixelY: 0.0155 } } as unknown as PlanReading
}

// a 660 × 476 px house, 25 px walls; the front wall (rows 660..685) runs along the left 45 % of the front
const SIDE_WALLS = [V_(108, 209, 133, 685), V_(743, 209, 768, 685), H_(108, 209, 768, 234)]
const EXTENT: Rect = { x0: 108, y0: 209, x1: 768, y1: 685 }
const sidesOf = (bands: BandSpec[], envelope: Rect): string[] => wallStripsOf(reading(bands, EXTENT), envelope).map((s) => s.side).sort()

describe('EXTERIOR-COMPLETE E12: a strip that is a wall band’s outer half is that wall', () => {
  it('the envelope on the front band’s axis (672): the 13 px strip is the front wall, not a zone', () => {
    expect(sidesOf([...SIDE_WALLS, H_(108, 660, 405, 685)], { x0: 108, y0: 209, x1: 768, y1: 672 })).toEqual(['MAX_Z'])
  })

  it('the same half a pixel either side of the half-wall minimum: the same answer', () => {
    // 672.75 leaves 12.25 px, under half a wall: no strip at all, so nothing to name; 672.25 leaves 12.75 px: the wall
    expect(sidesOf([...SIDE_WALLS, H_(108, 660, 405, 685)], { x0: 108, y0: 209, x1: 768, y1: 672.75 })).toEqual([])
    expect(sidesOf([...SIDE_WALLS, H_(108, 660, 405, 685)], { x0: 108, y0: 209, x1: 768, y1: 672.25 })).toEqual(['MAX_Z'])
  })

  it('as 005Q drew it — the envelope on the band’s inner face — still the wall', () => {
    expect(sidesOf([...SIDE_WALLS, H_(108, 660, 405, 685)], { x0: 108, y0: 209, x1: 768, y1: 660 })).toEqual(['MAX_Z'])
  })

  it('counter-case: a band clear of the extent’s edge (a kerb 12 px inside it) is not the wall', () => {
    expect(sidesOf([...SIDE_WALLS, H_(108, 648, 405, 673)], { x0: 108, y0: 209, x1: 768, y1: 660 })).toEqual([])
  })

  it('counter-case: a strip deeper than the band (a zone 40 px in front of a set-back wall) is not the wall', () => {
    expect(sidesOf([...SIDE_WALLS, H_(108, 660, 405, 685)], { x0: 108, y0: 209, x1: 768, y1: 630 })).toEqual([])
  })
})
