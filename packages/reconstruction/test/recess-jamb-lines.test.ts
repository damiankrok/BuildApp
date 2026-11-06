/**
 * EXTERIOR-COMPLETE E12 (Kostrzewy 4, plan 58cab67876): a shallow porch recess whose side returns are wall stubs no
 * longer than the recess is deep. Their bands are too short to be wall-to-wall and cover a few per cent of the sheet,
 * so the grid had no line on them; the recess took its sides from whatever dimension ticks fell nearest. On one
 * reading a room chain's tick put the recess's low side half a metre into the bathroom wall beside it; once a stroke on
 * that chain was (rightly) rejected, the next tick put it half a metre into the porch, and the door in the porch's back
 * wall fell outside the recess and was lost. The mouth on the facade is read from the jambs' ink and was right both
 * times; the recess's sides are on the jambs' inner faces.
 *
 * Synthetic plan (5 cm/px, 12 px walls, chains on the overall dimensions only, `compound-facade.test.ts`'s
 * conventions). Nothing here is a drawing of any real building.
 */
import { describe, expect, it } from 'vitest'
import { PlanDrawing, TRANSFORMS, runScene } from './transforms.js'
import type { Scene } from './transforms.js'

const FRONT = 268
/**
 * A 16 × 12 m house, outer faces x 40..359, y 40..279. The porch: mouth x 132..211 (4 m) between two return stubs
 * (x 120..131 and 212..223, rows 244..279), back wall rows 244..255 — 1.2 m deep, its returns 1.8 m long against 0.6 m
 * of thickness. In the back wall, from the low jamb: glazing x 132..147 (no wall band beside the low return at its
 * back end), a pier 148..167, a door 168..191 with its leaf on the axis, a pier 192..211.
 */
function porch(): PlanDrawing {
  const p = new PlanDrawing(460, 400).ring(40, 40, 359, 279)
  p.clear(132, FRONT, 211, 279)
  p.wall(120, 244, 131, 279) // low return stub
  p.wall(212, 244, 223, 279) // high return stub
  p.wall(148, 244, 211, 255) // pier + door wall + pier of the back wall
  p.clear(168, 244, 191, 255).line(168, 249, 191, 249) // the door, its leaf on the axis
  p.line(132, 247, 147, 247).line(132, 252, 147, 252) // glazing beside the low return
  p.wall(40, 150, 359, 161) // a partition behind, so the rooms behind the porch are enclosed
  return p
}
const scene = (p: PlanDrawing): Scene => ({ p, xs: [40, 360], ys: [40, 280], callouts: [] })

describe('EXTERIOR-COMPLETE E12: a recess whose returns are stubs takes its sides from its jambs', () => {
  it('the recess runs from jamb to jamb, the return stubs and the rooms beside them stay built (every orientation)', () => {
    for (const t of TRANSFORMS) {
      const r = runScene(scene(porch()), t)
      // inside the porch, right beside each jamb
      expect(r.classAt(135, 262), `${t}: beside the low jamb`).toBe('RECESS')
      expect(r.classAt(208, 262), `${t}: beside the high jamb`).toBe('RECESS')
      // the room beside the porch, in front of the low return: built, not part of the recess
      expect(r.builtAt(110, 262), `${t}: the room beside the low return`).toBe(true)
      expect(r.builtAt(232, 262), `${t}: the room beside the high return`).toBe(true)
    }
  })

  it('the grid gains a line on each jamb face that had none, and says why', () => {
    const r = runScene(scene(porch()), 'id')
    const jamb = r.d.linesX.filter((l) => /jamb of a recess mouth/.test(l.why))
    expect(jamb.length).toBeGreaterThan(0)
    for (const l of jamb) expect([132, 211.5, 212].some((x) => Math.abs(l.px - x) <= 1.5), `line at ${l.px}`).toBe(true)
  })
})
