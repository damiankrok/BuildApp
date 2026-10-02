/**
 * A numeric-label corpus for measuring a digit reader (BUILDPLAN-ANALYZER-005E).
 *
 * The reader's templates are bitmaps (`@buildapp/source-metrics` font.ts) and the synthetic sheets
 * are printed in another bitmap font (`font.ts` here). Measuring a reader on text drawn in its own
 * templates measures nothing, so this corpus draws digits from a THIRD typeface: a stroke font, the
 * kind a CAD package exports — each digit a few polylines and arcs in a unit box, rendered at a
 * cap height, slant and pen width of the caller's choosing, with area-coverage anti-aliasing, an
 * optional blur, broken strokes and tight or touching kerning. Nothing here knows any house: the
 * values come from a seeded generator, and every specimen records exactly how it was drawn.
 *
 * Determinism: a specimen is a pure function of its parameters; the corpus is a pure function of
 * its seed (a 32-bit LCG, no clock, no Math.random).
 */
import type { Raster } from '@buildapp/source-cv'

type Pt = readonly [number, number]
/** One stroke: a polyline in glyph units (x right, y down; the cap height is 1). */
type Stroke = readonly Pt[]

/** Points on an elliptical arc, centre (cx, cy), radii (rx, ry), from angle a0 to a1 (degrees, 0 = right, 90 = down). */
const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, steps = 14): Pt[] => {
  const out: Pt[] = []
  for (let i = 0; i <= steps; i += 1) {
    const a = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180
    out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)])
  }
  return out
}

/**
 * The stroke font: ten digits in a box 0.56 wide and 1 tall (the one narrower). Plain, CAD-like
 * shapes — not the reader's templates and not the sheets' bitmap font.
 */
export const STROKE_DIGITS: Record<string, { width: number; strokes: Stroke[] }> = {
  '0': { width: 0.56, strokes: [arc(0.28, 0.5, 0.27, 0.49, 0, 360, 28)] },
  '1': { width: 0.36, strokes: [[[0.08, 0.2], [0.3, 0.01], [0.3, 1]]] },
  '2': { width: 0.56, strokes: [[...arc(0.28, 0.27, 0.26, 0.26, 190, 360, 10), ...arc(0.28, 0.27, 0.26, 0.26, 0, 40, 4), [0.02, 0.99], [0.56, 0.99]]] },
  '3': { width: 0.56, strokes: [[...arc(0.28, 0.25, 0.25, 0.24, 200, 450, 14)], [...arc(0.28, 0.73, 0.28, 0.26, 270, 520, 14)]] },
  '4': { width: 0.58, strokes: [[[0.44, 0.99], [0.44, 0.01], [0.01, 0.7], [0.58, 0.7]]] },
  '5': { width: 0.56, strokes: [[[0.52, 0.01], [0.1, 0.01], [0.06, 0.44], ...arc(0.28, 0.67, 0.27, 0.32, 230, 500, 16)]] },
  '6': { width: 0.56, strokes: [[...arc(0.33, 0.43, 0.27, 0.42, 280, 180, 10), ...arc(0.28, 0.7, 0.27, 0.29, 180, 540, 24)]] },
  '7': { width: 0.56, strokes: [[[0.01, 0.01], [0.56, 0.01], [0.2, 0.99]]] },
  '8': { width: 0.56, strokes: [arc(0.28, 0.25, 0.23, 0.24, 0, 360, 22), arc(0.28, 0.73, 0.27, 0.26, 0, 360, 24)] },
  '9': { width: 0.56, strokes: [[...arc(0.28, 0.3, 0.27, 0.29, 0, 360, 24), ...arc(0.23, 0.57, 0.27, 0.42, 0, 100, 10)]] },
}

/**
 * A second face, deliberately unlike the first where faces really differ: an open 4, a flat-topped
 * 3, a 1 with a foot, a squarer 0, straight-tailed 6 and 9, a 2 with a straight spine. Two faces
 * keep a calibration from fitting one designer's habits.
 */
const rounded = (x0: number, y0: number, x1: number, y1: number, r: number): Pt[] => [
  ...arc(x1 - r, y0 + r, r, r, 270, 360, 4),
  ...arc(x1 - r, y1 - r, r, r, 0, 90, 4),
  ...arc(x0 + r, y1 - r, r, r, 90, 180, 4),
  ...arc(x0 + r, y0 + r, r, r, 180, 270, 4),
  [x1 - r, y0],
]
export const STROKE_DIGITS_B: Record<string, { width: number; strokes: Stroke[] }> = {
  '0': { width: 0.52, strokes: [rounded(0.01, 0.01, 0.51, 0.99, 0.2)] },
  '1': { width: 0.42, strokes: [[[0.06, 0.18], [0.24, 0.01], [0.24, 0.99]], [[0.04, 0.99], [0.42, 0.99]]] },
  '2': { width: 0.52, strokes: [[...arc(0.26, 0.25, 0.24, 0.24, 200, 360, 9), [0.5, 0.33], [0.02, 0.99], [0.52, 0.99]]] },
  '3': { width: 0.52, strokes: [[[0.03, 0.01], [0.5, 0.01], [0.22, 0.4], ...arc(0.26, 0.69, 0.26, 0.3, 270, 520, 14)]] },
  '4': { width: 0.58, strokes: [[[0.3, 0.01], [0.02, 0.68], [0.58, 0.68]], [[0.44, 0.3], [0.44, 0.99]]] },
  '5': { width: 0.52, strokes: [[[0.5, 0.01], [0.08, 0.01], [0.04, 0.46], ...arc(0.26, 0.68, 0.26, 0.31, 235, 500, 14)]] },
  '6': { width: 0.52, strokes: [[[0.42, 0.01], [0.04, 0.6], ...arc(0.26, 0.7, 0.25, 0.29, 180, 540, 22)]] },
  '7': { width: 0.52, strokes: [[[0.01, 0.01], [0.52, 0.01], [0.48, 0.12], [0.18, 0.99]]] },
  '8': { width: 0.52, strokes: [arc(0.26, 0.26, 0.21, 0.25, 0, 360, 20), arc(0.26, 0.73, 0.26, 0.26, 0, 360, 22)] },
  '9': { width: 0.52, strokes: [[...arc(0.26, 0.3, 0.25, 0.29, 0, 360, 22), [0.51, 0.3], [0.1, 0.99]]] },
}

export type LabelStyle = {
  /** Cap height, px. */
  capHeight: number
  /** Italic shear: columns per row of height, positive leans right. */
  slant: number
  /** Pen width, px. */
  pen: number
  /** Gap between glyph boxes, in cap heights (0 or negative: touching). */
  gap: number
  /** Gaussian blur sigma, px (0: none). */
  blur: number
  /** Paper and ink grey levels. */
  paper: number
  ink: number
  /** Breaks per glyph: short gaps cut out of the strokes (0: none). */
  breaks: number
  /** Seed for the breaks. */
  seed: number
  /** Which stroke face: A (round, closed 4) or B (open 4, flat-topped 3, footed 1). */
  face: 'A' | 'B'
  /**
   * 005F: a condensed face — every glyph's width times this (1: the face as drawn). Condensed dimension faces set four
   * digits at a pitch of 0.40–0.50 of the cap height, where the ordinary face sets them near 0.7.
   */
  condense?: number
}

export const DEFAULT_LABEL_STYLE: LabelStyle = { capHeight: 14, slant: 0.2, pen: 1.6, gap: 0.12, blur: 0, paper: 238, ink: 60, breaks: 0, seed: 1, face: 'A' }

const lcg = (seed: number): (() => number) => {
  let state = seed >>> 0 || 1
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

/** Distance from p to segment ab. */
const segDist = (px: number, py: number, ax: number, ay: number, bx: number, by: number): number => {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  const t = len2 <= 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

export type RenderedLabel = { raster: Raster; box: { x0: number; y0: number; x1: number; y1: number }; text: string; style: LabelStyle; glyphBoxes: Array<{ x0: number; x1: number }> }

/**
 * Draw `text` (digits only) as a label on a page of its own: at least `page` pixels, so the reader
 * sees a label at the size a sheet prints it (it bounds a glyph's height by the page's), the label
 * at (`margin`, `margin`). The ink is area coverage of a round pen along the strokes (4×4 samples a
 * pixel), so a 1.2 px pen at 12 px is a grey stroke, as a rasterised vector sheet prints it.
 */
export function renderLabel(text: string, style: Partial<LabelStyle> = {}, margin = 24, page: { width: number; height: number } = { width: 420, height: 140 }): RenderedLabel {
  const s: LabelStyle = { ...DEFAULT_LABEL_STYLE, ...style }
  const h = s.capHeight
  const rnd = lcg(s.seed)
  // Lay the glyphs out in pixel units, upright first.
  const segments: Array<[number, number, number, number]> = []
  const glyphBoxes: Array<{ x0: number; x1: number }> = []
  let cursor = 0
  const cx = s.condense ?? 1
  for (const ch of text) {
    const g = (s.face === 'B' ? STROKE_DIGITS_B : STROKE_DIGITS)[ch]
    if (!g) throw new Error(`no stroke glyph for ${ch}`)
    for (const stroke of g.strokes) {
      for (let i = 0; i + 1 < stroke.length; i += 1) {
        const [ax, ay] = stroke[i]
        const [bx, by] = stroke[i + 1]
        segments.push([cursor + ax * h * cx, ay * h, cursor + bx * h * cx, by * h])
      }
    }
    glyphBoxes.push({ x0: cursor, x1: cursor + g.width * h * cx })
    cursor += g.width * h * cx + s.gap * h
  }
  const width = cursor - s.gap * h
  // Breaks: short stretches of a stroke with no ink, at seeded places.
  const gaps: Array<[number, number, number]> = []
  for (let k = 0; k < Math.round(s.breaks * text.length); k += 1) {
    const seg = segments[Math.floor(rnd() * segments.length)]
    const t = rnd()
    gaps.push([seg[0] + (seg[2] - seg[0]) * t, seg[1] + (seg[3] - seg[1]) * t, Math.max(0.9, s.pen * 0.9)])
  }
  // Italic: x' = x + (h - y)·slant, about the baseline.
  const shear = (x: number, y: number): [number, number] => [x + (h - y) * s.slant, y]
  const sheared = segments.map(([ax, ay, bx, by]) => [...shear(ax, ay), ...shear(bx, by)] as [number, number, number, number])
  const gapsSheared = gaps.map(([x, y, r]) => [...shear(x, y), r] as [number, number, number])
  const lean = Math.max(0, h * s.slant)
  const W = Math.max(page.width, Math.ceil(width + lean + 2 * margin + s.pen))
  const H = Math.max(page.height, Math.ceil(h + 2 * margin + s.pen))
  const ox = margin + s.pen / 2
  const oy = margin + s.pen / 2
  const cover = new Float64Array(W * H)
  const r = s.pen / 2
  const N = 4
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      let hit = 0
      for (let sy = 0; sy < N; sy += 1) {
        for (let sx = 0; sx < N; sx += 1) {
          const px = x + (sx + 0.5) / N - ox
          const py = y + (sy + 0.5) / N - oy
          if (px < -s.pen || py < -s.pen || px > width + lean + s.pen || py > h + s.pen) continue
          let on = false
          for (const [ax, ay, bx, by] of sheared) {
            if (segDist(px, py, ax, ay, bx, by) <= r) {
              on = true
              break
            }
          }
          if (on && gapsSheared.some(([gx, gy, gr]) => Math.hypot(px - gx, py - gy) <= gr)) on = false
          if (on) hit += 1
        }
      }
      cover[y * W + x] = hit / (N * N)
    }
  }
  const blurred = s.blur > 0 ? gaussian(cover, W, H, s.blur) : cover
  const data = new Uint8ClampedArray(W * H * 4)
  for (let i = 0; i < W * H; i += 1) {
    const v = Math.round(s.paper - blurred[i] * (s.paper - s.ink))
    data[i * 4] = v
    data[i * 4 + 1] = v
    data[i * 4 + 2] = v
    data[i * 4 + 3] = 255
  }
  return {
    raster: { width: W, height: H, data },
    box: { x0: Math.floor(ox - s.pen), y0: Math.floor(oy - s.pen), x1: Math.ceil(ox + width + lean + s.pen), y1: Math.ceil(oy + h + s.pen) },
    text,
    style: s,
    glyphBoxes: glyphBoxes.map((b) => ({ x0: ox + b.x0, x1: ox + b.x1 + lean })),
  }
}

/** A separable Gaussian, clamped at the edges. */
function gaussian(field: Float64Array, W: number, H: number, sigma: number): Float64Array {
  const rad = Math.max(1, Math.ceil(sigma * 2.5))
  const k: number[] = []
  let sum = 0
  for (let i = -rad; i <= rad; i += 1) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma))
    k.push(v)
    sum += v
  }
  for (let i = 0; i < k.length; i += 1) k[i] /= sum
  const tmp = new Float64Array(W * H)
  const out = new Float64Array(W * H)
  for (let y = 0; y < H; y += 1)
    for (let x = 0; x < W; x += 1) {
      let a = 0
      for (let i = -rad; i <= rad; i += 1) a += k[i + rad] * field[y * W + Math.min(W - 1, Math.max(0, x + i))]
      tmp[y * W + x] = a
    }
  for (let y = 0; y < H; y += 1)
    for (let x = 0; x < W; x += 1) {
      let a = 0
      for (let i = -rad; i <= rad; i += 1) a += k[i + rad] * tmp[Math.min(H - 1, Math.max(0, y + i)) * W + x]
      out[y * W + x] = a
    }
  return out
}

/** How a specimen was drawn, by name: the corpus's strata. */
export type CorpusStratum = 'CLEAN' | 'ITALIC' | 'SMALL' | 'ANTIALIASED_THIN' | 'BLURRED' | 'BROKEN' | 'TOUCHING' | 'TIGHT' | 'HEAVY' | 'LIGHT_INK'

export type CorpusSpecimen = { id: string; text: string; stratum: CorpusStratum; style: LabelStyle }

/**
 * The corpus: `perStratum` labels in each stratum, 3, 4 and 5 digits in turn, every digit used.
 * Values come from the seed; a 5-digit value is a reader test, not a dimension (`parseNumber` takes
 * 2–4). The `calibration` and `heldBack` corpora are the same generator on two disjoint seeds.
 */
export function digitCorpus(seed: number, perStratum = 24): CorpusSpecimen[] {
  const rnd = lcg(seed)
  const pick = (lo: number, hi: number): number => lo + rnd() * (hi - lo)
  const out: CorpusSpecimen[] = []
  const strata: Array<[CorpusStratum, () => Partial<LabelStyle>]> = [
    ['CLEAN', () => ({ capHeight: Math.round(pick(14, 18)), slant: 0, pen: pick(1.5, 2), gap: pick(0.14, 0.22) })],
    ['ITALIC', () => ({ capHeight: Math.round(pick(13, 17)), slant: pick(0.15, 0.32), pen: pick(1.3, 1.9), gap: pick(0.1, 0.18) })],
    ['SMALL', () => ({ capHeight: Math.round(pick(12, 13.9)), slant: pick(0, 0.25), pen: pick(1.1, 1.5), gap: pick(0.1, 0.18) })],
    ['ANTIALIASED_THIN', () => ({ capHeight: Math.round(pick(12, 16)), slant: pick(0, 0.25), pen: pick(0.8, 1.1), gap: pick(0.1, 0.18) })],
    ['BLURRED', () => ({ capHeight: Math.round(pick(13, 17)), slant: pick(0, 0.25), pen: pick(1.3, 1.8), gap: pick(0.12, 0.2), blur: pick(0.5, 0.9) })],
    ['BROKEN', () => ({ capHeight: Math.round(pick(13, 17)), slant: pick(0, 0.25), pen: pick(1.3, 1.8), gap: pick(0.12, 0.2), breaks: pick(0.4, 0.8) })],
    ['TOUCHING', () => ({ capHeight: Math.round(pick(12, 17)), slant: pick(0.12, 0.3), pen: pick(1.4, 1.9), gap: pick(-0.04, 0.02) })],
    ['TIGHT', () => ({ capHeight: Math.round(pick(12, 17)), slant: pick(0, 0.25), pen: pick(1.3, 1.8), gap: pick(0.04, 0.08) })],
    ['HEAVY', () => ({ capHeight: Math.round(pick(13, 17)), slant: pick(0, 0.25), pen: pick(2.1, 2.6), gap: pick(0.14, 0.22) })],
    ['LIGHT_INK', () => ({ capHeight: Math.round(pick(13, 17)), slant: pick(0, 0.25), pen: pick(1.3, 1.8), gap: pick(0.12, 0.2), ink: Math.round(pick(120, 150)), paper: Math.round(pick(228, 245)) })],
  ]
  for (const [stratum, style] of strata) {
    for (let i = 0; i < perStratum; i += 1) {
      const digits = 3 + (i % 3)
      // The first digit of a dimension is never 0; every other position is uniform over 0–9.
      let text = String(1 + Math.floor(rnd() * 9))
      for (let d = 1; d < digits; d += 1) text += String(Math.floor(rnd() * 10))
      const st = style()
      out.push({ id: `${stratum.toLowerCase()}-${seed}-${i}`, text, stratum, style: { ...DEFAULT_LABEL_STYLE, ...st, seed: Math.floor(rnd() * 1e9), face: i % 2 === 0 ? 'A' : 'B' } })
    }
  }
  return out
}

/** The two disjoint corpora a calibration is fitted on and checked against. */
export const CORPUS_SEEDS = { calibration: 5001, heldBack: 9017 } as const
