/**
 * LINK-F1C: the wall-strip fixtures whose walls changed under LINK-F1B's one plan map, checked against the DRAWING, not
 * against a record the reader produced. Every expected value below is computed from the fixture's own pixels
 * (`wall-strip-plans.ts`): its outer faces at columns 60..660 and rows 60..420 and its chains at 5 cm/px, so world
 * x = (column − 60) × 0.05 and, for a body reaching the outer face, z = (420 − row) × 0.05. A drawn rectangle's faces are
 * its pixel edges (the last column + 1). Tolerance: one pixel at the chains' scale (TOL).
 */
import { describe, expect, it } from 'vitest'
import { reconstructV2 } from '../src/index.js'
import { FIXTURES, compileFixture } from './wall-strip-plans.js'

const PX = 0.05
const TOL = PX + 1e-9
const X = (col: number): number => (col - 60) * PX
const Z = (row: number): number => (420 - row) * PX
type W = { id: string; start: { x: number; z: number }; end: { x: number; z: number }; thickness: number }
const walls = (name: keyof typeof FIXTURES): W[] => compileFixture(reconstructV2, FIXTURES[name](), 'id').model.walls as W[]
/** A wall along z whose line is a face: the x band it occupies (its thickness on whichever side the drawn ink is). */
const xBand = (w: W, drawn: [number, number]): [number, number] => {
  const at = w.start.x
  const a: [number, number] = [at - w.thickness, at]
  const b: [number, number] = [at, at + w.thickness]
  const miss = (r: [number, number]) => Math.abs(r[0] - drawn[0]) + Math.abs(r[1] - drawn[1])
  return miss(a) <= miss(b) ? a : b
}

describe('LINK-F1C wall strip, against the drawing', () => {
  it('11. carport: its two side walls are returns exactly where they are drawn (columns 400..417 and 560..577), 5 m out (rows 421..520)', () => {
    const rs = walls('carport').filter((w) => w.id.startsWith('return-')).sort((a, b) => a.start.x - b.start.x)
    expect(rs).toHaveLength(2)
    for (const [w, cols] of [[rs[0], [400, 418]], [rs[1], [560, 578]]] as const) {
      const band = xBand(w, [X(cols[0]), X(cols[1])])
      expect(band[0]).toBeCloseTo(X(cols[0]), 1)
      expect(Math.abs(band[0] - X(cols[0]))).toBeLessThanOrEqual(TOL)
      expect(Math.abs(band[1] - X(cols[1]))).toBeLessThanOrEqual(TOL)
      expect(Math.abs(Math.abs(w.end.z - w.start.z) - (521 - 421) * PX)).toBeLessThanOrEqual(TOL)
    }
  })
  it('4. a 40 px pier in the strip (columns 300..339): the one return covers the pier as drawn', () => {
    const rs = walls('shortPier').filter((w) => w.id.startsWith('return-'))
    expect(rs).toHaveLength(1)
    const band = xBand(rs[0], [X(300), X(340)])
    expect(Math.abs(band[0] - X(300))).toBeLessThanOrEqual(TOL)
    expect(Math.abs(band[1] - X(340))).toBeLessThanOrEqual(TOL)
  })
  it('9. three 16 px posts in the strip (columns 60..75, 352..367, 645..660): three returns, each on its post', () => {
    const rs = walls('postsInStrip').filter((w) => w.id.startsWith('return-')).sort((a, b) => a.start.x - b.start.x)
    expect(rs).toHaveLength(3)
    for (const [w, cols] of [[rs[0], [60, 76]], [rs[1], [352, 368]], [rs[2], [645, 661]]] as const) {
      const band = xBand(w, [X(cols[0]), X(cols[1])])
      expect(Math.abs(band[0] - X(cols[0]))).toBeLessThanOrEqual(TOL)
      expect(Math.abs(band[1] - X(cols[1]))).toBeLessThanOrEqual(TOL)
    }
  })
  it('2. the partition (columns 300..307) stands inside its drawn band, in two pieces either side of the drawn doorway (rows 200..240)', () => {
    const ps = walls('outerOnly').filter((w) => w.id.includes('iwall')).sort((a, b) => Math.min(a.start.z, a.end.z) - Math.min(b.start.z, b.end.z))
    expect(ps).toHaveLength(2)
    for (const w of ps) {
      expect(w.start.x).toBeGreaterThanOrEqual(X(300) - PX)
      expect(w.start.x).toBeLessThanOrEqual(X(308) + PX)
    }
    const gap: [number, number] = [Math.max(ps[0].start.z, ps[0].end.z), Math.min(ps[1].start.z, ps[1].end.z)]
    expect(Math.abs(gap[0] - Z(241))).toBeLessThanOrEqual(TOL)
    expect(Math.abs(gap[1] - Z(200))).toBeLessThanOrEqual(TOL)
  })
})
