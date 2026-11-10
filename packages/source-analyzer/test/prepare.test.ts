/**
 * The working-resolution twins of a prepared sheet keep their identity.
 *
 * The stair reader tells treads apart from the other strokes by identity, so a
 * getter that mapped the thin strokes afresh on every read would hand it new
 * objects the second time — but only on a sheet large enough to be downscaled,
 * which no development sheet is.
 */
import { describe, expect, it } from 'vitest'
import { workingSegments } from '../src/prepare.js'
import type { Prepared } from '../src/prepare.js'

const segment = (x: number) => ({ a: { x, y: 0 }, b: { x, y: 40 }, angleDeg: 90, length: 40, support: 40 })

describe('workingSegments', () => {
  for (const scale of [1, 2]) {
    it(`reads the thin strokes once and keeps them at scale ${scale}`, () => {
      let computed = 0
      const prepared = {
        scale,
        axisSegments: [segment(0)],
        allSegments: [segment(0)],
        get thinSegments() {
          computed += 1
          return [segment(4), segment(8)]
        },
      } as unknown as Prepared
      const working = workingSegments(prepared)
      expect(computed).toBe(0)
      const first = working.thin
      expect(working.thin).toBe(first)
      expect(working.thin[1]).toBe(first[1])
      expect(computed).toBe(1)
      expect(first[1].a.x).toBe(8 / scale)
    })
  }
})

// v3.51 (found by the ANY-LINK control sample): a section served as a 120 × 34 px thumbnail stopped the whole analysis —
// the ridge, a fitted stroke's end, lay a pixel above the picture, which on 34 px is outside the frame's 2 % margin,
// and the observation graph refuses to be sealed with an observation outside its own frame.
describe('a fitted stroke’s end is on the image it was found on', () => {
  it('a point on the image is returned as it is; a point past an edge is brought onto it', async () => {
    const { ontoFrame } = await import('../src/prepare.js')
    const inside = { x: 57.9, y: 0.4 }
    expect(ontoFrame(inside, { width: 120, height: 34 })).toBe(inside)
    // within the frame's own tolerance (2 %) a point stays exactly as measured: nothing a working run read changes
    const withinTolerance = { x: 400, y: -0.9 }
    expect(ontoFrame(withinTolerance, { width: 900, height: 600 })).toBe(withinTolerance)
    expect(ontoFrame({ x: 57.9, y: -0.92 }, { width: 120, height: 34 })).toEqual({ x: 57.9, y: 0 })
    expect(ontoFrame({ x: 121.3, y: 35 }, { width: 120, height: 34 })).toEqual({ x: 120, y: 34 })
  })

  it('a thumbnail of a section whose pitch lines meet at its top edge is analysed, its ridge on the picture', async () => {
    const { BLACK, line, sheet } = await import('./draw.js')
    const { analyseScene } = await import('./scene.js')
    for (const [w, h] of [[120, 34], [118, 32]] as const) {
      const r = sheet(w, h)
      line(r, 10, h - 4, w - 10, h - 4, BLACK, 1)
      line(r, 10, h - 14, w - 10, h - 14, BLACK, 1)
      line(r, 10, h - 4, w / 2, 0, BLACK, 2)
      line(r, w - 10, h - 4, w / 2, 0, BLACK, 2)
      const out = await analyseScene([{ slug: `section-thumb-${w}`, raster: r, roles: { document: 'SECTION' } }])
      const ridges = out.graph.observations.filter((o) => o.kind === 'RIDGE')
      expect(ridges.length).toBe(1)
      const g = ridges[0].pixelGeometry
      expect(g.type === 'POINT' && g.point.y >= 0 && g.point.y <= h && g.point.x >= 0 && g.point.x <= w).toBe(true)
    }
  })
})
