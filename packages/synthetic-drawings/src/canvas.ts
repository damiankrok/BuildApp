/**
 * A drawing surface, in ink.
 *
 * Just enough to draw what a published sheet actually contains: straight
 * lines, rectangles, hatched solids, slash tick marks and text at a size and
 * slant of the caller's choosing. Everything is plotted into an 8-bit grey
 * raster, because that is what the reader takes in, and nothing anti-aliases,
 * because a published vector sheet exported to a GIF does not either.
 */
import type { Raster } from '@buildapp/source-cv'
import { SYNTHETIC_GLYPHS, SYNTHETIC_GLYPH_ROWS } from './font.js'

export class Canvas {
  readonly width: number
  readonly height: number
  private readonly data: Uint8ClampedArray

  constructor(width: number, height: number, background = 255) {
    this.width = width
    this.height = height
    this.data = new Uint8ClampedArray(width * height).fill(background)
  }

  plot(x: number, y: number, value = 0): void {
    const px = Math.round(x)
    const py = Math.round(y)
    if (px < 0 || py < 0 || px >= this.width || py >= this.height) return
    this.data[py * this.width + px] = value
  }

  /** A straight line of a given thickness, by Bresenham with a square pen. */
  line(x0: number, y0: number, x1: number, y1: number, thickness = 1, value = 0): void {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) * 2)
    const half = (thickness - 1) / 2
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps
      const x = x0 + (x1 - x0) * t
      const y = y0 + (y1 - y0) * t
      for (let dy = -half; dy <= half; dy += 1) for (let dx = -half; dx <= half; dx += 1) this.plot(x + dx, y + dy, value)
    }
  }

  rect(x0: number, y0: number, x1: number, y1: number, thickness = 1, value = 0): void {
    this.line(x0, y0, x1, y0, thickness, value)
    this.line(x1, y0, x1, y1, thickness, value)
    this.line(x1, y1, x0, y1, thickness, value)
    this.line(x0, y1, x0, y0, thickness, value)
  }

  fill(x0: number, y0: number, x1: number, y1: number, value = 0): void {
    for (let y = Math.round(Math.min(y0, y1)); y <= Math.round(Math.max(y0, y1)); y += 1) for (let x = Math.round(Math.min(x0, x1)); x <= Math.round(Math.max(x0, x1)); x += 1) this.plot(x, y, value)
  }

  /**
   * Text, at a cap height in pixels, optionally slanted and optionally turned
   * a quarter turn the way a vertical dimension is set.
   *
   * Returns the box it occupied, so a caller can place a dimension line under
   * what it just wrote instead of guessing.
   */
  text(chars: string, x: number, y: number, capHeight: number, options: { slant?: number; rotate?: 'NONE' | 'CW'; value?: number; letterGap?: number } = {}): { x0: number; y0: number; x1: number; y1: number } {
    const slant = options.slant ?? 0
    const value = options.value ?? 0
    const scale = capHeight / SYNTHETIC_GLYPH_ROWS
    const gap = options.letterGap ?? Math.max(1, Math.round(capHeight * 0.12))
    let cursor = 0
    const marks: Array<{ u: number; v: number }> = []
    for (const char of chars) {
      const glyph = SYNTHETIC_GLYPHS[char]
      if (!glyph) continue
      const cols = glyph[0].length
      for (let row = 0; row < glyph.length; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          if (glyph[row][col] !== '#') continue
          // One source pixel becomes a scale x scale block, so a glyph drawn at
          // 13 pixels has strokes of the thickness a real sheet prints.
          for (let sy = 0; sy < Math.ceil(scale); sy += 1) {
            for (let sx = 0; sx < Math.ceil(scale); sx += 1) {
              const v = row * scale + sy
              const u = cursor + col * scale + sx
              marks.push({ u: u + (SYNTHETIC_GLYPH_ROWS * scale - v) * slant, v })
            }
          }
        }
      }
      cursor += cols * scale + gap
    }
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (const m of marks) {
      // Turned a quarter turn CLOCKWISE means the text reads bottom to top with
      // the tops of the characters facing LEFT — which is how every vertical
      // dimension on a plan is set, and which the reader recovers by turning
      // the page the same way.
      const px = options.rotate === 'CW' ? x + m.v : x + m.u
      const py = options.rotate === 'CW' ? y - m.u : y + m.v
      this.plot(px, py, value)
      x0 = Math.min(x0, Math.round(px))
      y0 = Math.min(y0, Math.round(py))
      x1 = Math.max(x1, Math.round(px))
      y1 = Math.max(y1, Math.round(py))
    }
    return { x0, y0, x1, y1 }
  }

  /** How wide a run of text will be, before drawing it. */
  textWidth(chars: string, capHeight: number, letterGap?: number): number {
    const scale = capHeight / SYNTHETIC_GLYPH_ROWS
    const gap = letterGap ?? Math.max(1, Math.round(capHeight * 0.12))
    let width = 0
    for (const char of chars) {
      const glyph = SYNTHETIC_GLYPHS[char]
      if (!glyph) continue
      width += glyph[0].length * scale + gap
    }
    return Math.max(0, width - gap)
  }

  /** The 45-degree slash a draughtsman puts where one dimension ends and the next begins. */
  tick(x: number, y: number, axis: 'HORIZONTAL' | 'VERTICAL', size = 4, value = 0): void {
    if (axis === 'HORIZONTAL') this.line(x - size / 2, y + size, x + size / 2, y - size, 1, value)
    else this.line(x + size, y - size / 2, x - size, y + size / 2, 1, value)
  }

  /** Gaussian-free speckle: the compression noise a published GIF carries, with a fixed seed so a fixture stays a fixture. */
  speckle(amount: number, seed = 1): void {
    let state = seed >>> 0
    const next = (): number => {
      state = (state * 1664525 + 1013904223) >>> 0
      return state / 4294967296
    }
    for (let i = 0; i < this.data.length; i += 1) {
      if (next() > amount) continue
      this.data[i] = Math.max(0, Math.min(255, this.data[i] + (next() < 0.5 ? -28 : 28)))
    }
  }

  /** The grey field, as the analyzer's rasters are shaped: one byte per channel, four channels. */
  toRaster(): Raster {
    const out = new Uint8ClampedArray(this.width * this.height * 4)
    for (let i = 0; i < this.data.length; i += 1) {
      const v = this.data[i]
      out[i * 4] = v
      out[i * 4 + 1] = v
      out[i * 4 + 2] = v
      out[i * 4 + 3] = 255
    }
    return { width: this.width, height: this.height, data: out }
  }
}
