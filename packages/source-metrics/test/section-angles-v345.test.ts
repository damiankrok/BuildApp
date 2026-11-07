/** v3.45: the roof pitch printed along a section's slope, admitted by the slope. Invented sheets and readings. */
import { describe, expect, it } from 'vitest'
import type { Gray } from '@buildapp/source-cv'
import { angleLabels, edgeSlope, judgeAngles, stripAlong } from '../src/index.js'
import type { AngleLabel, ExternalReading } from '../src/index.js'

const paper = (w: number, h: number): Gray => ({ width: w, height: h, data: new Uint8ClampedArray(w * h).fill(255) })
const ink = (g: Gray, x: number, y: number): void => {
  const xi = Math.round(x), yi = Math.round(y)
  if (xi >= 0 && yi >= 0 && xi < g.width && yi < g.height) g.data[yi * g.width + xi] = 20
}
/** A roof edge from (100,400) rising at `deg`, and three glyph blocks printed along it `above` px over it. */
function slopedSheet(deg: number, above = 20) {
  const g = paper(700, 500)
  const r = (deg * Math.PI) / 180
  const ux = Math.cos(r), uy = -Math.sin(r)
  const a = { x: 100, y: 400 }, b = { x: 100 + 400 * ux, y: 400 + 400 * uy }
  for (let s = 0; s <= 400; s += 0.5) for (let t = -1; t <= 1; t += 0.5) ink(g, a.x + ux * s + uy * t, a.y + uy * s - ux * t)
  const nx = uy, ny = -ux
  for (const s0 of [180, 190, 200]) for (let s = s0; s < s0 + 6; s += 0.5) for (let o = above; o < above + 14; o += 0.5) ink(g, a.x + ux * s + nx * o, a.y + uy * s + ny * o)
  return { g, edge: { id: 'e', a, b } }
}
const reading = (key: string, greedy: string, meanP: number, top: string[]): ExternalReading => ({ key, engine: 'fixture', modelSha256: '0'.repeat(64), runtime: 'fixture', topK: top.map((text, i) => ({ text, p: i ? 0.3 : 0.6 })), greedy: { text: greedy, meanP }, stable: true, variants: [] })
const label = (slopeDeg: number, besideSlopes: number[] = [slopeDeg]): AngleLabel => ({ key: 'A0', edge: { id: 'e', a: { x: 0, y: 0 }, b: { x: 1, y: 1 } }, slopeDeg, box: { x0: 0, x1: 10, y0: 0, y1: 10 }, corners: [], besideSlopes })

describe('the pitch label along its slope', () => {
  it('measures the drawn slope whichever end the edge starts from', () => {
    expect(edgeSlope({ id: 'e', a: { x: 0, y: 100 }, b: { x: 100, y: 16.09 } }).deg).toBeCloseTo(40, 0)
    expect(edgeSlope({ id: 'e', a: { x: 100, y: 16.09 }, b: { x: 0, y: 100 } }).deg).toBeCloseTo(40, 0)
  })
  for (const deg of [30, 40, 45]) {
    it(`finds the word printed along a ${deg}° edge, upright in its strip`, () => {
      const { g, edge } = slopedSheet(deg)
      const { strip } = stripAlong(g, edge)
      let darkAbove = 0
      for (let k = 0; k < 60; k += 1) for (let s = 0; s < strip.width; s += 1) if (strip.data[k * strip.width + s] < 170) darkAbove += 1
      expect(darkAbove).toBeGreaterThan(0)
      const { labels, crops } = angleLabels(g, [edge])
      expect(labels).toHaveLength(1)
      expect(crops).toHaveLength(1)
      expect(labels[0].slopeDeg).toBeCloseTo(deg, 0)
    })
  }
  it('a reading stands only where the drawn slope is the number it reads', () => {
    const v = judgeAngles([label(40.0)], [reading('A0', '40°', 0.88, ['40', '400'])])
    expect(v[0].value).toBe(40)
    expect(judgeAngles([label(37.2)], [reading('A0', '40°', 0.95, ['40'])])[0].value).toBeUndefined()
    expect(judgeAngles([label(37.2, [37.2, 40.1])], [reading('A0', '40°', 0.95, ['40'])])[0].value).toBe(40)
  })
  it('refuses: a level beside the roof, a low mean, a digit beam reading other digits', () => {
    expect(judgeAngles([label(40)], [reading('A0', '+8,95', 0.99, ['895'])])[0].value).toBeUndefined()
    expect(judgeAngles([label(40)], [reading('A0', '40°', 0.6, ['40'])])[0].value).toBeUndefined()
    expect(judgeAngles([label(40)], [reading('A0', '40°', 0.95, ['48', '43'])])[0].value).toBeUndefined()
  })
})
