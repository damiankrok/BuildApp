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
