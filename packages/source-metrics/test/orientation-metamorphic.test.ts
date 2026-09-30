/**
 * Orientation hypotheses, metamorphically (BUILDPLAN-ANALYZER-005B).
 *
 * The same drawing turned a quarter, a half and three quarters of a turn is
 * the same drawing. Whichever way up the page is, the raw readings must hold
 * the number printed on it, read the right way up, and must say which way up
 * that was. And asking for the hypotheses never changes what the legacy page
 * vote returns: the raw readings are kept beside it, never instead of it.
 */
import { describe, expect, it } from 'vitest'
import { Canvas } from '@buildapp/synthetic-drawings'
import type { Raster } from '@buildapp/source-cv'
import { oppositeOrientation, readNumbers, textAngleOf, textAxisOf } from '../src/index.js'
import type { TextOrientation } from '../src/index.js'

/** The page turned `quarters` quarter turns clockwise. */
function turn(r: Raster, quarters: 0 | 1 | 2 | 3): Raster {
  if (quarters === 0) return r
  const w = quarters % 2 === 1 ? r.height : r.width
  const h = quarters % 2 === 1 ? r.width : r.height
  const out = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < r.height; y += 1) {
    for (let x = 0; x < r.width; x += 1) {
      const [nx, ny] = quarters === 1 ? [r.height - 1 - y, x] : quarters === 2 ? [r.width - 1 - x, r.height - 1 - y] : [y, r.width - 1 - x]
      const from = (y * r.width + x) * 4
      const to = (ny * w + nx) * 4
      for (let k = 0; k < 4; k += 1) out[to + k] = r.data[from + k]
    }
  }
  return { width: w, height: h, data: out }
}

/** A dimension printed upright, the way a horizontal chain carries it. */
const page = (): Raster => {
  const c = new Canvas(360, 360)
  c.text('1260', 130, 170, 18)
  return c.toRaster()
}

/** Which way up upright text reads once the page is turned: a quarter clockwise sets it the way a CW pass reads it back. */
const expected: Record<0 | 1 | 2 | 3, TextOrientation> = { 0: 'HORIZONTAL', 1: 'ROTATED_CCW', 2: 'INVERTED', 3: 'ROTATED_CW' }

describe('the raw readings hold the printed number whichever way up the page is', () => {
  for (const quarters of [0, 1, 2, 3] as const) {
    it(`page turned ${quarters * 90}°: "1260" is among the raw readings, read ${expected[quarters]}`, () => {
      const read = readNumbers(turn(page(), quarters), { hypotheses: true })
      const raw = read.raw ?? []
      const hit = raw.find((t) => t.text === '1260')
      expect(hit, raw.map((t) => `${t.text}/${t.orientation}`).join(' ')).toBeDefined()
      expect(hit?.orientation).toBe(expected[quarters])
    })
  }

  it('the inverted reading of an upside-down label is the label, and its leading-zero shadow is not', () => {
    const read = readNumbers(turn(page(), 2), { hypotheses: true })
    const texts = (read.raw ?? []).map((t) => t.text)
    expect(texts).toContain('1260')
    // What the upright pass makes of the same ink is kept too — raw is never destroyed — but it is not "1260".
    const upright = (read.raw ?? []).filter((t) => t.orientation === 'HORIZONTAL').map((t) => t.text)
    expect(upright).not.toContain('1260')
  })
})

describe('asking for the hypotheses leaves the legacy page vote alone', () => {
  for (const quarters of [0, 1, 2, 3] as const) {
    it(`page turned ${quarters * 90}°: the vote's tokens are the same with and without hypotheses`, () => {
      const r = turn(page(), quarters)
      const plain = readNumbers(r)
      const withHypotheses = readNumbers(r, { hypotheses: true })
      const key = (t: { text: string; orientation: string; box: unknown }) => `${t.text}|${t.orientation}|${JSON.stringify(t.box)}`
      expect(withHypotheses.tokens.map(key)).toEqual(plain.tokens.map(key))
      expect(plain.raw).toBeUndefined()
      // Every vote token is one of the raw readings: the vote chooses among them, it never adds one.
      const raw = new Set((withHypotheses.raw ?? []).map(key))
      for (const t of withHypotheses.tokens) expect(raw.has(key(t))).toBe(true)
    })
  }
})

describe('orientation algebra', () => {
  it('pairs every orientation with the one a half turn away, on the same axis', () => {
    for (const o of ['HORIZONTAL', 'ROTATED_CW', 'INVERTED', 'ROTATED_CCW'] as const) {
      expect(oppositeOrientation(oppositeOrientation(o))).toBe(o)
      expect(textAxisOf(oppositeOrientation(o))).toBe(textAxisOf(o))
      expect((textAngleOf(oppositeOrientation(o)) - textAngleOf(o) + 360) % 360).toBe(180)
    }
  })
})
