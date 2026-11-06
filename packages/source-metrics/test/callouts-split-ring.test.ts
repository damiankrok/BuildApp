import { describe, expect, it } from 'vitest'
import { Canvas } from '@buildapp/synthetic-drawings'
import { readOpeningCallouts } from '../src/index.js'

/**
 * EXTERIOR-COMPLETE E12 (Zefiranty's "455/220" under a garage door line; Kostrzewy's "105/210" under a door leaf and its
 * arc): a callout ring touched along part of its outline by a long line. The search strips long runs, the touched arc
 * goes with them, and what was left was fitted by two smaller circles side by side on the bar, neither of which reads.
 * Unread, the ring's ink was a "post" splitting the garage door in two (the garage's front then read as outside) and an
 * obstacle beside a door leaf (the entrance then read as a window). Two callouts never overlap: such a pair is one ring.
 * Counter-case: two separate callouts side by side stay two.
 *
 * Synthetic rings (the face and sizes of `callouts.test.ts`), no drawing of any house.
 */
const ring = (c: Canvas, cx: number, cy: number, r: number, value = 40): void => {
  const steps = Math.round(2 * Math.PI * r * 2)
  for (let i = 0; i < steps; i += 1) {
    const a = (i / steps) * 2 * Math.PI
    c.plot(Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a)), value)
  }
}
const callout = (c: Canvas, cx: number, cy: number, upper: string, lower: string, r = 13): void => {
  ring(c, cx, cy, r)
  c.line(cx - r + 2, cy, cx + r - 2, cy, 1, 40)
  const cap = 9
  c.text(upper, cx - Math.round((upper.length * 5) / 2), cy - 2 - cap, cap, { value: 60, letterGap: 1 })
  c.text(lower, cx - Math.round((lower.length * 5) / 2), cy + 3, cap, { value: 60, letterGap: 1 })
}
const near = (rs: ReturnType<typeof readOpeningCallouts>, x: number, y: number) => rs.filter((r) => Math.hypot(r.circle.cx - x, r.circle.cy - y) <= 20)

describe('EXTERIOR-COMPLETE E12: a callout ring touched by a long line is one ring', () => {
  it('a wall line along the ring’s top (a garage door line on its outer face): one ring, its full radius, the printed pair in its lists', () => {
    const c = new Canvas(360, 200)
    c.fill(20, 80, 340, 96, 0) // the wall the door is in
    c.line(60, 96, 300, 96, 2, 0) // the door line on the outer face
    callout(c, 180, 110, '455', '220', 14) // its top arc lies on the line
    const found = near(readOpeningCallouts(c.toRaster()), 180, 110)
    expect(found).toHaveLength(1)
    expect(found[0].circle.radiusPx).toBeGreaterThanOrEqual(12)
    expect(found[0].widthCandidates.map((w) => w.value)).toContain(455)
  })

  it('counter-case: two separate callouts printed side by side stay two', () => {
    const c = new Canvas(360, 200)
    callout(c, 150, 110, '90', '150', 13)
    callout(c, 178, 110, '90', '150', 13) // touching, centres 28 px apart
    expect(near(readOpeningCallouts(c.toRaster()), 164, 110).length).toBe(2)
  })
})
