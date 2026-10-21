/**
 * BUILDPLAN-ANALYZER-005Y-N5 (C1): a wall band read as the wall's own body (`wallBodyPieces`), on synthetic strips.
 * A plan may draw a wall in a flat dark grey fill (another material, a wall under a watermark) and a few pixels off the
 * registered line; the thin-ink test about the line alone (`bandPieces`) then reads a gap where the wall stands.
 *  - counterfactual: a grey wall 8 px off the line is a gap to `bandPieces`, solid to `wallBodyPieces`;
 *  - negative: two thin glazing lines, a textured blot (foliage, a symbol) and a light floor fill stay a gap.
 */
import { describe, expect, it } from 'vitest'
import { Canvas } from '@buildapp/synthetic-drawings'
import { bandPieces, wallBodyPieces } from '../src/v2/scan.js'

const W = 16 // wall thickness in pixels
const LINE = 100 // the registered centre line (rows)
function strip(draw: (c: Canvas) => void) {
  const c = new Canvas(300, 200)
  draw(c)
  return c.toRaster()
}
const covered = (runs: Array<{ from: number; to: number }>, a: number, b: number): boolean => runs.some((r) => r.from <= a && r.to >= b)

describe('a wall band read as the wall itself', () => {
  it('is solid where a flat grey wall lies a few pixels off the registered line (bandPieces reads a gap there)', () => {
    const r = strip((c) => c.fill(50, LINE - 8 - W / 2, 250, LINE - 8 + W / 2, 93))
    expect(covered(bandPieces(r, 'X', LINE, 60, 240, W * 0.45, Math.round(W * 0.9 * 0.55)), 80, 220)).toBe(false)
    expect(covered(wallBodyPieces(r, 'X', LINE, 60, 240, W * 0.75, W / 2), 80, 220)).toBe(true)
  })
  it('stays a gap over two thin glazing lines, a light floor fill, and a textured blot beside the wall', () => {
    const r = strip((c) => {
      c.line(80, LINE - 3, 220, LINE - 3, 1, 150)
      c.line(80, LINE + 3, 220, LINE + 3, 1, 150)
      c.fill(80, LINE + 5, 220, LINE + 20, 200)
      for (let x = 80; x < 220; x += 3) for (let y = LINE - 14; y < LINE - 4; y += 2) c.plot(x + (y % 4 === 0 ? 1 : 0), y, 20)
    })
    expect(wallBodyPieces(r, 'X', LINE, 60, 240, W * 0.75, W / 2)).toEqual([])
  })
})
