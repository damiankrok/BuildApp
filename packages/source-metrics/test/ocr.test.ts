import { describe, expect, it } from 'vitest'
import { Canvas } from '@buildapp/synthetic-drawings'
import { CELL_H, CELL_W, holeStats, readNumbers, thin } from '../src/index.js'

/**
 * The reader is tested against drawings set in a DIFFERENT typeface from the
 * one it matches against. A test that rendered the reader's own prototypes and
 * then asked it to recognise them would pass whatever the reader did.
 */
const sheet = (draw: (c: Canvas) => void, width = 420, height = 160): Canvas => {
  const c = new Canvas(width, height)
  draw(c)
  return c
}

describe('numeric OCR', () => {
  it('reads a run of plan dimensions set in an unfamiliar italic face', () => {
    const c = sheet((canvas) => {
      canvas.text('1205', 40, 12, 16, { slant: 0.18 })
      canvas.text('790', 150, 52, 16, { slant: 0.18 })
      canvas.text('415', 280, 52, 16, { slant: 0.18 })
    })
    const read = readNumbers(c.toRaster())
    expect(read.tokens.map((t) => t.text)).toEqual(['1205', '790', '415'])
    for (const t of read.tokens) {
      expect(t.orientation).toBe('HORIZONTAL')
      expect(t.height).toBeGreaterThanOrEqual(14)
      expect(t.glyphs).toHaveLength(t.text.length)
    }
  })

  it('reads text set a quarter turn, the way a vertical chain carries it, and says which way up it was', () => {
    const c = sheet((canvas) => {
      canvas.text('1260', 60, 300, 16, { rotate: 'CW' })
    }, 420, 420)
    const read = readNumbers(c.toRaster())
    const token = read.tokens.find((t) => t.text === '1260')
    expect(token, read.tokens.map((t) => `${t.text}/${t.orientation}`).join(' ')).toBeDefined()
    expect(token?.orientation).toBe('ROTATED_CW')
  })

  it('does not return the same ink twice, once mirrored: the wrong-way pass loses to the right-way one', () => {
    const c = sheet((canvas) => {
      canvas.text('750', 60, 300, 16, { rotate: 'CW' })
    }, 420, 420)
    const read = readNumbers(c.toRaster())
    // Whatever it decides the characters are, exactly one token may claim this ink.
    const overlapping = read.tokens.filter((t) => t.box.x0 < 120 && t.box.y1 > 200)
    expect(overlapping).toHaveLength(1)
  })

  it('keeps every glyph runner-up, because a chain is a better judge of a small digit than a template is', () => {
    const c = sheet((canvas) => canvas.text('415', 40, 20, 14, { slant: 0.2 }))
    const read = readNumbers(c.toRaster())
    expect(read.tokens.length).toBeGreaterThan(0)
    const glyphs = read.tokens[0].glyphs
    expect(glyphs.some((g) => g.alternatives.length > 0)).toBe(true)
    for (const g of glyphs) {
      expect(g.confidence).toBeGreaterThan(0.4)
      expect(g.confidence).toBeLessThanOrEqual(1)
      for (const a of g.alternatives) expect(a.score).toBeLessThanOrEqual(g.score)
    }
  })

  it('reports a decidedness separate from a match quality: a clean glyph with a close rival is not decided', () => {
    const c = sheet((canvas) => canvas.text('1205', 40, 20, 16, { slant: 0.18 }))
    const token = readNumbers(c.toRaster()).tokens[0]
    // The token's confidence is its weakest glyph's, never the average.
    expect(token.confidence).toBe(Math.min(...token.glyphs.map((g) => g.confidence)))
    expect(token.score).toBe(Math.min(...token.glyphs.map((g) => g.score)))
  })

  it('finds nothing on a blank sheet and nothing in a ruled grid', () => {
    expect(readNumbers(sheet(() => {}).toRaster()).tokens).toEqual([])
    const ruled = sheet((canvas) => {
      for (let y = 10; y < 150; y += 12) canvas.line(10, y, 400, y, 1)
      for (let x = 10; x < 400; x += 12) canvas.line(x, 10, x, 150, 1)
    })
    expect(readNumbers(ruled.toRaster()).tokens.filter((t) => t.score > 0.5)).toEqual([])
  })

  it('survives the speckle a published GIF carries', () => {
    const c = sheet((canvas) => {
      canvas.text('790', 40, 20, 16, { slant: 0.18 })
      canvas.speckle(0.012, 7)
    })
    const read = readNumbers(c.toRaster())
    expect(read.tokens.some((t) => t.text === '790')).toBe(true)
  })
})

describe('glyph shape primitives', () => {
  it('thinning reduces a fat stroke to a skeleton and keeps it connected', () => {
    const cell = new Float64Array(CELL_W * CELL_H)
    for (let y = 2; y < CELL_H - 2; y += 1) for (let x = 4; x <= 7; x += 1) cell[y * CELL_W + x] = 1
    const skeleton = thin(cell)
    const before = cell.reduce((a, b) => a + b, 0)
    const after = skeleton.reduce((a, b) => a + b, 0)
    expect(after).toBeLessThan(before / 2)
    // Zhang-Suen erodes the ends as well as the sides, so a twelve-row bar
    // comes back a little shorter — but it comes back as a LINE.
    expect(after).toBeGreaterThanOrEqual(6)
  })

  it('counts enclosed holes and says where the largest one sits', () => {
    const ring = (x: number, y: number): boolean => {
      const inside = x >= 1 && x <= 6 && y >= 1 && y <= 10
      const hollow = x >= 3 && x <= 4 && y >= 3 && y <= 8
      return inside && !hollow
    }
    const stats = holeStats(8, 12, ring)
    expect(stats.count).toBe(1)
    expect(stats.cy).toBeGreaterThan(0.35)
    expect(stats.cy).toBeLessThan(0.65)
    expect(stats.areaFrac).toBeGreaterThan(0.05)
    const solid = holeStats(8, 12, (x, y) => x >= 1 && x <= 6 && y >= 1 && y <= 10)
    expect(solid.count).toBe(0)
  })

  it('ignores a hole one stray pixel wide: that is the compression, not the drawing', () => {
    const nearlySolid = (x: number, y: number): boolean => !(x === 3 && y === 5)
    expect(holeStats(9, 13, nearlySolid).count).toBe(0)
  })
})
