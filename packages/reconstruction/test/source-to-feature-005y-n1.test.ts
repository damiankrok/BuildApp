/**
 * BUILDPLAN-ANALYZER-005Y-N1: what the reconstruction does with the readings the 005Y-N1 trace showed it losing.
 *  - A tinted plan ring the metric reading's recogniser read reads what it read (`withRecognisedHalves`): only an
 *    accepted ring, on the same frame, at the same centre; every other ring is returned as it was.
 *  - A section the metric reading could not scale by its levels is registered for the chimneys by two independent
 *    anchors — the walls' outer faces against the plan's span, and two printed levels — or not at all
 *    (`registerSectionByTwoAnchors`); the slab is read through a watermark's gaps.
 *  - A chimney the plans show on one storey only stands when the section draws a stack above the roof line it draws
 *    over the block (`sectionStackOver`); lines under the roof, and a block with nothing above it, do not.
 */
import { describe, expect, it } from 'vitest'
import { Canvas } from '@buildapp/synthetic-drawings'
import type { CalloutReading, CalloutRingRecord } from '@buildapp/source-metrics'
import { registerSectionByTwoAnchors, sectionStackOver, withRecognisedHalves } from '../src/v2/roof-details.js'

const tinted = (cx: number, cy: number, upper: string, lower: string): CalloutReading => ({
  id: `t-${cx}-${cy}`,
  circle: { cx, cy, radiusPx: 12 },
  bar: { y: cy },
  widthCm: Number(upper) || null,
  heightCm: Number(lower) || null,
  upperText: upper,
  lowerText: lower,
  widthCandidates: [],
  heightCandidates: [],
  confidence: 0.3,
  box: { x0: cx - 12, y0: cy - 12, x1: cx + 12, y1: cy + 12 },
  why: 'a ring',
})
const half = (text: string, accepted = true) => ({ text, valueCm: Number(text), p: 0.999, meanP: 0.999, stable: true, glyphs: text.length, accepted, why: accepted ? 'ok' : 'no' })
const record = (frameId: string, x: number, y: number, w: string, h: string, accepted = true): CalloutRingRecord => ({
  id: `rec-${x}-${y}`,
  frameId,
  centrePx: { x, y },
  radiusPx: 12,
  barY: y,
  finders: ['TINTED'],
  template: { upperText: '211', lowerText: '140' },
  width: half(w, accepted),
  height: half(h, accepted),
  accepted,
})

describe('a tinted ring the recogniser read', () => {
  it('reads what the recogniser read — same frame, same centre, accepted — and every other ring is untouched', () => {
    const rings = [tinted(330, 198, '211', '140'), tinted(422, 198, '274', '140'), tinted(510, 198, '211', '140'), tinted(576, 198, '211', '100')]
    const records = [record('plan', 331, 199, '78', '140'), record('plan', 422, 202, '78', '140'), record('other', 510, 198, '78', '140'), record('plan', 576, 198, '78', '140', false)]
    const out = withRecognisedHalves(rings, 'plan', records)
    expect([out[0].widthCm, out[0].heightCm, out[0].upperText]).toEqual([78, 140, '78'])
    expect(out[0].why).toMatch(/the recogniser read 78\/140/)
    expect(out[1]).toEqual(rings[1]) // 4 px off: not the same ring
    expect(out[2]).toEqual(rings[2]) // another frame's ring
    expect(out[3]).toEqual(rings[3]) // not accepted
    expect(withRecognisedHalves(rings, 'plan', undefined)).toEqual(rings)
  })
})

/** A single-storey section, 12 m wide at 0.015 m/px: two slabs between outer faces at columns 100 and 900, a gable roof
 * line over them, a level rule at +7.20 and one at ±0.00, an attic strut under the roof, and a stack outline above the
 * roof over x = 8.7 m. A white watermark stroke breaks the ceiling slab. */
function section(withStack: boolean): { raster: ReturnType<Canvas['toRaster']>; mpp: number } {
  const mpp = 0.015
  const c = new Canvas(1000, 700)
  const row = (y: number): number => Math.round(600 - y / mpp)
  // floor slab 0..-0.3 m, ceiling slab 3.0..3.3 m, outer walls 0.3 m
  c.fill(100, row(0), 900, row(-0.3), 0)
  c.fill(100, row(3.3), 900, row(3.0), 0)
  c.fill(100, row(3.0), 120, row(2.0), 0)
  c.fill(880, row(3.0), 900, row(2.0), 0)
  for (let x = 400; x < 430; x += 1) for (let y = row(3.3); y <= row(3.0); y += 1) c.plot(x, y, 255) // watermark gap
  // roof: ridge at 6 m over x = 6 m (column 500), eaves at 3.3 m over the faces; a 4 px cut line
  for (let x = 100; x <= 900; x += 1) {
    const yM = 3.3 + (6 - 3.3) * (1 - Math.abs(x - 500) / 400)
    for (let t = 0; t < 4; t += 1) c.plot(x, row(yM) + t, 0)
  }
  // a strut under the roof at x = 3 m (column 300): two light lines, paper between
  for (let y = row(4.6); y <= row(3.3); y += 1) {
    c.plot(290, y, 170)
    c.plot(310, y, 170)
  }
  // the level rules
  c.line(560, row(7.2), 620, row(7.2), 1, 0)
  c.line(560, row(0), 620, row(0), 1, 0)
  if (withStack) {
    // a stack over x = 8.55..8.85 m (columns 670..690), outline drawn from below the roof to 1 m above it
    const roofAt = 3.3 + 2.7 * (1 - Math.abs(680 - 500) / 400)
    for (let y = row(roofAt + 1.0); y <= row(roofAt - 0.5); y += 1) {
      c.plot(666, y, 170)
      c.plot(694, y, 170)
    }
    c.line(666, row(roofAt + 1.0), 694, row(roofAt + 1.0), 1, 170)
  }
  return { raster: c.toRaster(), mpp }
}

describe('a section registered by two anchors, and a stack on it', () => {
  const levels = [
    { value: 7.2, row: Math.round(600 - 7.2 / 0.015), confidence: 0.96 },
    { value: 0, row: 600, confidence: 0.64 },
    { value: 2.95, row: 400, confidence: 0.2 },
  ]
  const spans = [{ axis: 'X' as const, from: 0, to: 12 }, { axis: 'Z' as const, from: 0, to: 9 }]

  it('registers on the slab through the watermark, when the walls and the levels agree', () => {
    const { raster } = section(true)
    const two = registerSectionByTwoAnchors(raster, levels, spans, 'sec')
    expect(two).toBeDefined()
    expect(two?.section.axis).toBe('X')
    expect(two?.section.mpp).toBeCloseTo(0.015, 3)
    expect(two?.section.pxOf(0)).toBeCloseTo(100, 0)
  })

  it('refuses when the levels contradict the walls, or only one level is read confidently', () => {
    const { raster } = section(true)
    expect(registerSectionByTwoAnchors(raster, [{ ...levels[0], value: 8.2 }, levels[1]], spans, 'sec')).toBeUndefined()
    expect(registerSectionByTwoAnchors(raster, [levels[0], levels[2]], spans, 'sec')).toBeUndefined()
  })

  it('reads the stack over the block above the roof line, and nothing over a block with none — not the strut under the roof', () => {
    const { raster } = section(true)
    const s = registerSectionByTwoAnchors(raster, levels, spans, 'sec')?.section
    expect(s).toBeDefined()
    if (!s) return
    const roofOver = (x: number): number => 3.3 + 2.7 * (1 - Math.abs(x - 6) / 6)
    const stack = sectionStackOver(raster, s, { from: 8.6, to: 8.8 }, roofOver(8.7))
    expect(stack).toBeDefined()
    expect(stack?.heightM).toBeGreaterThan(0.8)
    expect(sectionStackOver(raster, s, { from: 2.85, to: 3.15 }, roofOver(3))).toBeUndefined()
    const bare = section(false)
    const s2 = registerSectionByTwoAnchors(bare.raster, levels, spans, 'sec')?.section
    expect(s2 && sectionStackOver(bare.raster, s2, { from: 8.6, to: 8.8 }, roofOver(8.7))).toBeUndefined()
  })

  it('does not take a stack where the model’s roof is far from the roof the section draws', () => {
    const { raster } = section(true)
    const s = registerSectionByTwoAnchors(raster, levels, spans, 'sec')?.section
    if (!s) throw new Error('unregistered')
    expect(sectionStackOver(raster, s, { from: 8.6, to: 8.8 }, 2.0)).toBeUndefined()
  })
})
