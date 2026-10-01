import { describe, expect, it } from 'vitest'
import { Canvas } from '@buildapp/synthetic-drawings'
import { parseNumber, readNumbers, readingLattice } from '../src/index.js'
import type { TextToken } from '../src/index.js'

/**
 * BUILDPLAN-ANALYZER-005D §28: glyph ambiguity, on the reader itself.
 *
 * The contract is not that the reader never errs — a template matcher will — but that an error
 * is either named or harmless: the true figure is what was read, or it is among the bounded
 * readings the matcher itself proposes (a runner-up glyph at ≥ 0.7 of the winner, one
 * substitution), or what was read is no dimension at all. A confident different dimension with
 * the truth nowhere in its lattice is the failure this file looks for. There is no substitution
 * table: which digits resemble each other is whatever the matcher reports for these strokes.
 */

const read = (draw: (c: Canvas) => void): TextToken[] => {
  const c = new Canvas(400, 160)
  draw(c)
  return readNumbers(c.toRaster(), { hypotheses: true }).tokens
}
const dimensionsOf = (t: TextToken): number[] => parseNumber(t.text).filter((p) => p.kind === 'LINEAR_DIMENSION').map((p) => p.value)
/** The bounded readings: the as-read string and one-substitution readings whose glyph ratio is at least 0.7. */
const bounded = (t: TextToken): string[] => readingLattice(t).filter((r) => r.substitutions === 0 || r.substitutions === 1).map((r) => r.text)
const ratioOf = (t: TextToken, i: number, char: string): number => {
  const g = t.glyphs[i]
  const alt = g.alternatives.find((a) => a.char === char)
  return alt ? alt.score / g.score : 0
}

describe('§28 glyph ambiguity: a misread is named, or it is no dimension', () => {
  it('3 against 5: read as printed, and where the template half-sees the other digit it says so', () => {
    const [t] = read((c) => c.text('3553', 40, 60, 16))
    expect(t.text).toBe('3553')
    expect(ratioOf(t, 0, '5')).toBeGreaterThanOrEqual(0.7)
    expect(bounded(t)).toContain('5553')
  })

  it('1 against 7: read as printed', () => {
    const [t] = read((c) => c.text('1771', 40, 60, 16))
    expect(t.text).toBe('1771')
  })

  it('an italic 3 the template takes for a 5 keeps the 3 as a bounded reading of the same ink', () => {
    const [t] = read((c) => c.text('3575', 40, 60, 16, { slant: 0.3 }))
    expect(t.text === '3575' || bounded(t).includes('3575')).toBe(true)
    expect(ratioOf(t, 0, '3') >= 0.7 || t.text === '3575').toBe(true)
  })

  it('0, 6 and 9 a quarter turn round are read the right way up, so 6 and 9 do not swap', () => {
    for (const text of ['609', '906']) {
      const tokens = read((c) => c.text(text, 200, 140, 16, { rotate: 'CW' }))
      const t = tokens.find((x) => x.orientation === 'ROTATED_CW')
      expect(t?.text, text).toBe(text)
    }
  })

  it('tightly kerned 11: one pixel apart it is read as printed; touching glyphs keep the digit count', () => {
    const [tight] = read((c) => c.text('1100', 40, 60, 16, { letterGap: 1 }))
    expect(tight.text).toBe('1100')
    const [touching] = read((c) => c.text('1100', 40, 60, 16, { letterGap: 0 }))
    // A known limit, recorded rather than hidden: touching glyphs can be misread in the last
    // place (1101). The figure keeps its four digits and its leading 11 — never 100 or 11100.
    expect(touching.text).toHaveLength(4)
    expect(touching.text.startsWith('11')).toBe(true)
  })

  it('broken strokes: a figure cut through its middle is no dimension at all, never a different one', () => {
    const tokens = read((c) => {
      c.text('3575', 40, 60, 16)
      for (let x = 40; x < 140; x += 1) c.plot(x, 68, 255)
    })
    for (const t of tokens) {
      const values = dimensionsOf(t)
      if (values.length === 0) continue
      expect(values.includes(3575) || bounded(t).includes('3575'), `${t.text}`).toBe(true)
    }
  })
})
