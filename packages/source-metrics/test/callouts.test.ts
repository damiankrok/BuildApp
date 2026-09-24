import { describe, expect, it } from 'vitest'
import { Canvas } from '@buildapp/synthetic-drawings'
import { readOpeningCallouts } from '../src/index.js'

/**
 * The ring callout reader, on rings it has never seen: the synthetic face,
 * not the reader's own prototypes, set at the size a published sheet prints
 * the symbol — a ring of about 13 px radius with seven-pixel digits.
 *
 * At that size no matcher tells a 3 from a 9 every time, and the reader does
 * not pretend to: each half is a short list of readings. The contract tested
 * here is that the printed pair is IN the lists, near the top, and that a
 * circle with no numbers in it does not become an opening.
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
  // The synthetic face is an 8-column bitmap; at nine rows it is as small as it stays legible.
  const cap = 9
  const w = upper.length * 5
  c.text(upper, cx - Math.round(w / 2), cy - 2 - cap, cap, { value: 60, letterGap: 1 })
  const w2 = lower.length * 5
  c.text(lower, cx - Math.round(w2 / 2), cy + 3, cap, { value: 60, letterGap: 1 })
}

describe('ring callouts', () => {
  it('reads the printed pair into each half’s candidate list', () => {
    const c = new Canvas(360, 200)
    // A wall and a leader, as on a sheet, so the ring is not alone on white.
    c.fill(20, 60, 340, 72, 0)
    c.line(90, 72, 90, 96, 1, 0)
    callout(c, 90, 110, '110', '230')
    c.line(230, 72, 230, 96, 1, 0)
    callout(c, 230, 110, '234', '303')
    const found = readOpeningCallouts(c.toRaster(), { frameId: 'test' })
    expect(found.length).toBeGreaterThanOrEqual(2)
    const near = (cx: number) => found.find((f) => Math.abs(f.circle.cx - cx) <= 3 && Math.abs(f.circle.cy - 110) <= 3)
    const a = near(90)
    const b = near(230)
    expect(a).toBeDefined()
    expect(b).toBeDefined()
    expect(a?.bar).not.toBeNull()
    expect(a?.widthCandidates.slice(0, 4).map((x) => x.value)).toContain(110)
    expect(a?.heightCandidates.slice(0, 4).map((x) => x.value)).toContain(230)
    expect(b?.widthCandidates.slice(0, 4).map((x) => x.value)).toContain(234)
    expect(b?.heightCandidates.slice(0, 4).map((x) => x.value)).toContain(303)
    // The best reading of each half is the printed one here; a sheet's own
    // seven-pixel digits are not always that kind, which is what the lists are for.
    expect(a?.widthCm).toBe(110)
    expect(b?.widthCm).toBe(234)
  })

  it('does not read an empty circle, or one without a bar, as a callout', () => {
    const c = new Canvas(200, 120)
    ring(c, 50, 60, 13)
    ring(c, 140, 60, 13)
    c.text('7', 137, 52, 9, { value: 60 })
    const found = readOpeningCallouts(c.toRaster(), { frameId: 'test' })
    for (const f of found) {
      expect(f.widthCm === null || f.heightCm === null || f.confidence < 0.2).toBe(true)
    }
  })
})
