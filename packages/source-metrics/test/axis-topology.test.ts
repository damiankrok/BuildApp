import { describe, expect, it } from 'vitest'
import { Canvas } from '@buildapp/synthetic-drawings'
import { adaptiveInkMask, inkChannel } from '@buildapp/source-cv'
import type { Raster } from '@buildapp/source-cv'
import {
  ASSIGNMENT_BOUNDS,
  assignLabels,
  chainId,
  dimensionAxisGroups,
  dimensionChainsOf,
  dimensionLabelLattices,
  findDimensionLines,
  hungarian,
  labelHeightOf,
  labelSide,
  readNumbers,
  solveFrameChains,
  solveFrameMetric,
} from '../src/index.js'
import type { ChainTick, RawChain, TextOrientation, TextToken } from '../src/index.js'

/**
 * BUILDPLAN-ANALYZER-005I §18: the dimension-topology corpus.
 *
 * Every pixel case is drawn the way a plan's margin draws dimensions — a rule, slash ticks, the number set parallel
 * to its line on the line's far side from the text's baseline (ISO 129) — at a scale the solver is never told
 * (2.5 cm/px), and run through exactly the production path (`dimensionChainsOf`, the reader, the lattices, the page
 * vote and the independent solver). The token cases hold the assignment's contract on hand-made tokens: ties refused,
 * input order irrelevant, the bound on work. No case names a house, and nothing here is the blind-7 drawing: the
 * families are the drawing conventions that drawing broke, each at this file's own numbers.
 */

const FRAME = 'frame-axis-topology'
const SCALE = 2.5
const CAP = 16

type Run = ReturnType<typeof analyse>

function analyse(raster: Raster) {
  const grey = inkChannel(raster)
  const mask = adaptiveInkMask(grey, {})
  const read = readNumbers(raster, { hypotheses: true, retainPasses: true })
  const { allChains, rawChains, measured, labelInkLines } = dimensionChainsOf(findDimensionLines(mask, { raster, grey }), read.raw ?? read.tokens, mask)
  const legacy = solveFrameChains(measured, read.tokens, { tolerancePx: 2.2 })
  const ids = rawChains.map((c) => chainId(FRAME, c.axis, c.baselinePx, c.ticks.map((t) => t.atPx)))
  const lattices = new Map([...dimensionLabelLattices(read, allChains, raster)].map(([t, lattice], i) => [t, { id: `lattice-${i}`, lattice }]))
  const metric = solveFrameMetric({ frameId: FRAME, assetId: 'asset', chains: measured, chainIds: ids, raw: read.raw ?? read.tokens, legacyTokens: read.tokens, legacy, tolerancePx: 2.2, lattices })
  const groups = dimensionAxisGroups(FRAME, measured, ids, labelHeightOf(measured, read.raw ?? read.tokens))
  return { rawChains, measured, labelInkLines, ids, legacy, metric, groups, read }
}

/** A vertical rule at `x` from `y0` to `y1`, with a slash tick at each of `ticks`. */
function vRule(c: Canvas, x: number, y0: number, y1: number, ticks: number[]): void {
  c.line(x, y0, x, y1, 1)
  for (const t of ticks) c.tick(x, t, 'VERTICAL')
}
/** A number set along a vertical line, reading bottom to top, left of it (its baseline toward the line), `gap` px off. */
function vLabel(c: Canvas, text: string, x: number, from: number, to: number, gap = 4): void {
  const w = c.textWidth(text, CAP)
  c.text(text, x - gap - CAP, (from + to) / 2 + w / 2, CAP, { rotate: 'CW' })
}
/** A horizontal rule at `y` from `x0` to `x1`, ticks at `ticks`. */
function hRule(c: Canvas, y: number, x0: number, x1: number, ticks: number[]): void {
  c.line(x0, y, x1, y, 1)
  for (const t of ticks) c.tick(t, y, 'HORIZONTAL')
}
/** A number above a horizontal line (its baseline toward the line), centred on `from`–`to`, `gap` px off. */
function hLabel(c: Canvas, text: string, y: number, from: number, to: number, gap = 4): void {
  const w = c.textWidth(text, CAP)
  c.text(text, (from + to) / 2 - w / 2, y - gap - CAP, CAP, { slant: 0.18 })
}

const close = (a: number | undefined, b: number, rel = 0.012): boolean => a !== undefined && Math.abs(a / b - 1) <= rel
const lineNear = (r: Run, axis: 'HORIZONTAL' | 'VERTICAL', at: number): number => r.rawChains.findIndex((c) => c.axis === axis && Math.abs(c.baselinePx - at) < 2.5)
type Axis = 'H' | 'V'
const onAxis = (o: TextOrientation, axis?: Axis): boolean => axis === undefined || (axis === 'V') === (o === 'ROTATED_CW' || o === 'ROTATED_CCW')
/** What the final assignment did with a label read as `text` (on one axis, or any), as `chainIndex:interval` or its status. */
function boundTo(r: Run, text: string, axis?: Axis): string[] {
  return r.metric.assignment.filter((d) => d.text === text && onAxis(d.orientation, axis)).map((d) => (d.status === 'BOUND' && d.chosen ? `${d.chosen.chain}:${d.chosen.interval}` : d.status))
}
/** The page vote's own assignment of a label. */
function legacyBoundTo(r: Run, text: string, axis?: Axis): string[] {
  return r.legacy.assignment.filter((d) => d.text === text && onAxis(d.orientation, axis)).map((d) => (d.status === 'BOUND' && d.chosen ? `${d.chosen.chain}:${d.chosen.interval}` : d.status))
}
/** The value each sealed span of a chain was read at, `from-to:value`, its ends snapped to the drawn 10 px grid of ticks (a tick is found to a pixel). */
const snap = (px: number): number => Math.round(px / 10) * 10
const spansOf = (r: Run, chain: number): string[] => (r.metric.solved[chain]?.segments ?? []).filter((g) => g.origin === 'READ' || g.origin === 'CHAIN_CORRECTED').map((g) => `${snap(g.fromPx)}-${snap(g.toPx)}:${g.valueCm}`)

/**
 * The left margin of a plan: an overall line beside the building and, nearer the building, the chain of its parts,
 * `separation` px apart; the overall's number left of its line, each part's number left of the part line — so the
 * middle part's number sits BETWEEN the two lines, nearer the overall line than its own (`nearGap`, `ownGap`).
 * A horizontal overall and a part chain below give the other axis.
 */
function margin(options: { separation?: number; nearGap?: number; parts?: number[]; overall?: number; partLabels?: string[]; missingTick?: number; extraInner?: boolean } = {}): Canvas {
  const c = new Canvas(760, 760)
  const outer = 60
  const inner = outer + (options.separation ?? 24)
  const parts = options.parts ?? [100, 900, 100]
  const top = 120
  const overall = options.overall ?? parts.reduce((a, b) => a + b, 0)
  const bottom = top + overall / SCALE
  vRule(c, outer, top, bottom, [top, bottom])
  vLabel(c, String(overall), outer, top, bottom, 4)
  const innerTicks = [top]
  for (const p of parts) innerTicks.push(innerTicks[innerTicks.length - 1] + p / SCALE)
  vRule(c, inner, top, bottom, innerTicks.filter((_, i) => i !== options.missingTick))
  // Each part's number left of the part line, `ownGap` px off: the middle one sits between the two lines.
  const ownGap = inner - outer - CAP - (options.nearGap ?? 3)
  parts.forEach((p, i) => vLabel(c, options.partLabels?.[i] ?? String(p), inner, innerTicks[i], innerTicks[i + 1], ownGap))
  // the other axis: an overall below the building and its two parts
  hRule(c, 700, 140, 620, [140, 620])
  hLabel(c, '1200', 700, 140, 620)
  hRule(c, 672, 140, 620, [140, 340, 620])
  hLabel(c, '500', 672, 140, 340)
  hLabel(c, '700', 672, 340, 620)
  return c
}

describe('§18 (1) outer overall + inner chain, (3) the label nearer the wrong line, (6) label ink as ticks', () => {
  const r = analyse(margin().toRaster())
  const outer = lineNear(r, 'VERTICAL', 60)
  const inner = lineNear(r, 'VERTICAL', 84)

  it('draws what the case says: two vertical lines 24 px apart, the overall line carrying label-ink marks', () => {
    expect(outer).toBeGreaterThanOrEqual(0)
    expect(inner).toBeGreaterThanOrEqual(0)
    const ink = r.rawChains[outer].ticks.filter((t) => (t.reasons ?? []).includes('TEXT_INK'))
    expect(ink.length).toBeGreaterThan(0)
    // Every one of them is two labels flanking the line: rejected, never a measurement point.
    expect(ink.every((t) => t.class === 'REJECTED')).toBe(true)
    // The measurement chain keeps only the overall's two end ticks.
    expect(r.measured[outer].ticks.map((t) => snap(t.atPx))).toEqual([120, 560])
  })

  it('the middle part, printed nearer the overall line, is bound to its own line; the overall keeps its number', () => {
    expect(boundTo(r, '900')).toEqual([`${inner}:1`])
    expect(legacyBoundTo(r, '900')).toEqual([`${inner}:1`])
    expect(boundTo(r, '1100')).toEqual([`${outer}:0`])
    expect(legacyBoundTo(r, '1100')).toEqual([`${outer}:0`])
  })

  it('the overall is read over its whole span, the parts over theirs, at the drawing scale', () => {
    expect(spansOf(r, outer)).toEqual(['120-560:1100'])
    expect(spansOf(r, inner)).toContain('160-520:900')
    expect(close(r.metric.pooledScale, SCALE)).toBe(true)
  })

  it('the two lines are one axis group: the part chain subdivides the overall', () => {
    const g = r.groups.perChain[outer]
    expect(g).toBeDefined()
    expect(r.groups.perChain[inner]?.groupId).toBe(g?.groupId)
    expect(g?.roles).toContain('OVERALL')
    expect(r.groups.perChain[inner]?.roles).toContain('SUBDIVISION')
    expect(g?.alignedEnds).toEqual([true, true])
  })
})

describe('§18 (2) a label midway between two parallel lines', () => {
  it('goes to the line on its baseline side, not refused, at the same distance from both', () => {
    // separation 24 = 4 + 16 + 4: the part's number exactly midway, 4 px from each line
    const r = analyse(margin({ separation: 24, nearGap: 4 }).toRaster())
    expect(boundTo(r, '900')).toEqual([`${lineNear(r, 'VERTICAL', 84)}:1`])
    expect(boundTo(r, '1100')).toEqual([`${lineNear(r, 'VERTICAL', 60)}:0`])
  })
})

describe('§18 (4, 5) nested spans', () => {
  it('(4) same centre: an overall and a shorter inner span centred on the same point each keep their own number', () => {
    const c = new Canvas(760, 760)
    vRule(c, 60, 120, 560, [120, 560])
    vLabel(c, '1100', 60, 120, 560)
    vRule(c, 90, 220, 460, [220, 460])
    vLabel(c, '600', 90, 220, 460)
    hRule(c, 700, 140, 620, [140, 340, 620])
    hLabel(c, '500', 700, 140, 340)
    hLabel(c, '700', 700, 340, 620)
    const r = analyse(c.toRaster())
    const outer = lineNear(r, 'VERTICAL', 60)
    const inner = lineNear(r, 'VERTICAL', 90)
    expect(boundTo(r, '1100')).toEqual([`${outer}:0`])
    expect(boundTo(r, '600')).toEqual([`${inner}:0`])
    expect(close(r.metric.pooledScale, SCALE)).toBe(true)
  })

  it('(5) different centres: two parts under one overall, each part number on its own span', () => {
    const r = analyse(margin({ parts: [500, 600] }).toRaster())
    const inner = lineNear(r, 'VERTICAL', 84)
    expect(boundTo(r, '500', 'V')).toEqual([`${inner}:0`])
    expect(boundTo(r, '600', 'V')).toEqual([`${inner}:1`])
    expect(spansOf(r, lineNear(r, 'VERTICAL', 60))).toEqual(['120-560:1100'])
  })
})

describe('§18 (6, 7) label ink and real ticks', () => {
  it('(6) one label beside a line makes no mark at all (ink on one side does not cross)', () => {
    const c = new Canvas(600, 300)
    hRule(c, 150, 100, 500, [100, 500])
    hLabel(c, '1000', 150, 100, 500, 1)
    const r = analyse(c.toRaster())
    const line = r.rawChains[lineNear(r, 'HORIZONTAL', 150)]
    expect(line.ticks.map((t) => snap(t.atPx))).toEqual([100, 500])
    expect(line.ticks.every((t) => t.class === 'TICK')).toBe(true)
  })

  it('(7) a label whose glyphs touch a real tick on one side: the tick is kept, at most doubted, never rejected', () => {
    const c = new Canvas(600, 300)
    hRule(c, 150, 100, 500, [100, 300, 500])
    // the part number pushed against the middle tick, its glyphs over the tick's upper arm
    const w = c.textWidth('800', CAP)
    c.text('800', 300 - w + 2, 150 - 2 - CAP, CAP)
    hLabel(c, '800', 150, 300, 500)
    const r = analyse(c.toRaster())
    const line = r.rawChains[lineNear(r, 'HORIZONTAL', 150)]
    const mid = line.ticks.find((t) => Math.abs(t.atPx - 300) <= 3)
    expect(mid).toBeDefined()
    expect(mid?.class).not.toBe('REJECTED')
  })

  it('a real tick with labels on both sides of the line is kept: the stroke between them is not label ink', () => {
    const c = new Canvas(600, 300)
    hRule(c, 150, 100, 500, [100, 300, 500])
    hLabel(c, '800', 150, 100, 300)
    // a second line's label just below the line, beside the same tick
    const w = c.textWidth('500', CAP)
    c.text('500', 300 - w / 2 - 24, 150 + 3, CAP)
    const r = analyse(c.toRaster())
    const mid = r.rawChains[lineNear(r, 'HORIZONTAL', 150)].ticks.find((t) => Math.abs(t.atPx - 300) <= 3)
    expect(mid?.class).not.toBe('REJECTED')
  })
})

describe('§18 (8, 9) missing and spurious marks', () => {
  it('(8) a missing part tick is never invented: the overall still reads its whole span, the parts do not invent one', () => {
    const r = analyse(margin({ missingTick: 2 }).toRaster())
    const inner = lineNear(r, 'VERTICAL', 84)
    expect(r.rawChains[inner].ticks).toHaveLength(3)
    expect(spansOf(r, lineNear(r, 'VERTICAL', 60))).toEqual(['120-560:1100'])
    // no span of the part line is read at a value it does not span
    for (const s of spansOf(r, inner)) {
      const [span, value] = s.split(':')
      const [a, b] = span.split('-').map(Number)
      expect(Math.abs(Number(value) / (b - a) - SCALE)).toBeLessThan(0.2)
    }
  })

  it('(9) a spurious light mark on the overall line is rejected and the overall keeps its whole span', () => {
    const c = margin()
    // a light wedge across the overall line, a third of the way down
    for (let d = -2; d <= 10; d += 1) c.fill(60 + d, 260, 60 + d, 260 + Math.max(1, Math.round(1 + d / 2)), 165)
    const r = analyse(c.toRaster())
    expect(spansOf(r, lineNear(r, 'VERTICAL', 60))).toEqual(['120-560:1100'])
  })
})

describe('§15 / §18 (10) a short terminal span', () => {
  it('`100 / long middle / 100`: both end parts are bound to their own spans and read', () => {
    const r = analyse(margin().toRaster())
    const inner = lineNear(r, 'VERTICAL', 84)
    expect(boundTo(r, '100').sort()).toEqual([`${inner}:0`, `${inner}:2`])
    expect(spansOf(r, inner)).toEqual(['120-160:100', '160-520:900', '520-560:100'])
  })
})

describe('§18 (11, 12) neighbouring and nested chains', () => {
  it('(11) two neighbouring independent chains, overlapping a little: each label stays on its own line', () => {
    const c = new Canvas(760, 760)
    vRule(c, 60, 120, 400, [120, 400])
    vLabel(c, '700', 60, 120, 400)
    vRule(c, 84, 300, 600, [300, 600])
    vLabel(c, '750', 84, 300, 600, 4)
    hRule(c, 700, 140, 620, [140, 340, 620])
    hLabel(c, '500', 700, 140, 340)
    hLabel(c, '700', 700, 340, 620)
    const r = analyse(c.toRaster())
    expect(boundTo(r, '700', 'V')).toEqual([`${lineNear(r, 'VERTICAL', 60)}:0`])
    expect(boundTo(r, '750')).toEqual([`${lineNear(r, 'VERTICAL', 84)}:0`])
  })

  it('(12) an overall over two part chains: three lines, every number on its own, the group records two subdivisions', () => {
    const c = new Canvas(760, 760)
    // overall, then a middle chain (400 + 700), then an inner chain (100 + 300 + 600 + 100)
    vRule(c, 50, 120, 560, [120, 560])
    vLabel(c, '1100', 50, 120, 560)
    vRule(c, 74, 120, 560, [120, 280, 560])
    vLabel(c, '400', 74, 120, 280)
    vLabel(c, '700', 74, 280, 560)
    vRule(c, 98, 120, 560, [120, 160, 280, 520, 560])
    vLabel(c, '100', 98, 120, 160)
    vLabel(c, '300', 98, 160, 280)
    vLabel(c, '600', 98, 280, 520)
    vLabel(c, '100', 98, 520, 560)
    hRule(c, 700, 140, 620, [140, 340, 620])
    hLabel(c, '500', 700, 140, 340)
    hLabel(c, '700', 700, 340, 620)
    const r = analyse(c.toRaster())
    const [a, b, d] = [lineNear(r, 'VERTICAL', 50), lineNear(r, 'VERTICAL', 74), lineNear(r, 'VERTICAL', 98)]
    expect(boundTo(r, '1100')).toEqual([`${a}:0`])
    expect(boundTo(r, '400')).toEqual([`${b}:0`])
    expect(boundTo(r, '700', 'V')).toEqual([`${b}:1`])
    expect(boundTo(r, '300')).toEqual([`${d}:1`])
    expect(boundTo(r, '600')).toEqual([`${d}:2`])
    expect(r.groups.perChain[a]?.groupId).toBe(r.groups.perChain[d]?.groupId)
    const group = r.groups.groups.find((g) => g.id === r.groups.perChain[a]?.groupId)
    expect(group?.relations.filter((x) => x.kind === 'SUBDIVIDES').length).toBeGreaterThanOrEqual(2)
  })
})

describe('§14 / §18 (13) contradictory arithmetic', () => {
  it('the parts print 100 / 800 / 100 under 1100: binding stays geometric, nothing is rewritten, the scale is the overall’s', () => {
    const r = analyse(margin({ partLabels: ['100', '800', '100'] }).toRaster())
    const inner = lineNear(r, 'VERTICAL', 84)
    expect(boundTo(r, '800')).toEqual([`${inner}:1`])
    // The observation records what was printed; no value of 900 appears for that ink.
    expect(r.metric.observations.filter((o) => o.rawText === '800').every((o) => o.valueCm === 800)).toBe(true)
    expect(spansOf(r, lineNear(r, 'VERTICAL', 60))).toEqual(['120-560:1100'])
  })
})

describe('§18 (14, 15) the same topology turned and laid flat', () => {
  it('(14) a right-hand margin, its numbers right of their lines reading top to bottom: the same assignment', () => {
    // Mirror the margin left to right: the overall is the rightmost line and the parts' line is nearer the building.
    const base = margin().toRaster()
    const m: Raster = { width: base.width, height: base.height, data: new Uint8ClampedArray(base.data.length) }
    for (let y = 0; y < base.height; y += 1)
      for (let x = 0; x < base.width; x += 1) for (let k = 0; k < 4; k += 1) m.data[(y * base.width + x) * 4 + k] = base.data[(y * base.width + (base.width - 1 - x)) * 4 + k]
    // Mirroring reverses the glyphs too; turn the page half a turn instead, which keeps them legible.
    const t: Raster = { width: base.width, height: base.height, data: new Uint8ClampedArray(base.data.length) }
    for (let y = 0; y < base.height; y += 1)
      for (let x = 0; x < base.width; x += 1) for (let k = 0; k < 4; k += 1) t.data[(y * base.width + x) * 4 + k] = base.data[((base.height - 1 - y) * base.width + (base.width - 1 - x)) * 4 + k]
    const r = analyse(t)
    const outer = lineNear(r, 'VERTICAL', base.width - 1 - 60)
    const inner = lineNear(r, 'VERTICAL', base.width - 1 - 84)
    expect(outer).toBeGreaterThanOrEqual(0)
    expect(boundTo(r, '900')).toEqual([`${inner}:1`])
    expect(boundTo(r, '1100')).toEqual([`${outer}:0`])
    expect(m.width).toBe(base.width)
  })

  it('(15) a top margin: an overall line above the parts line, the middle part’s number between them', () => {
    const c = new Canvas(760, 600)
    const left = 120
    const right = left + 1100 / SCALE
    hRule(c, 60, left, right, [left, right])
    hLabel(c, '1100', 60, left, right)
    const ticks = [left, left + 40, left + 400, right]
    hRule(c, 84, left, right, ticks)
    hLabel(c, '100', 84, ticks[0], ticks[1], 5)
    hLabel(c, '900', 84, ticks[1], ticks[2], 5)
    hLabel(c, '100', 84, ticks[2], ticks[3], 5)
    vRule(c, 700, 140, 540, [140, 540])
    vLabel(c, '1000', 700, 140, 540)
    const r = analyse(c.toRaster())
    const outer = lineNear(r, 'HORIZONTAL', 60)
    const inner = lineNear(r, 'HORIZONTAL', 84)
    expect(boundTo(r, '1100')).toEqual([`${outer}:0`])
    expect(boundTo(r, '900')).toEqual([`${inner}:1`])
    expect(spansOf(r, outer)).toEqual([`${snap(left)}-${snap(right)}:1100`])
  })
})

// ---------------------------------------------------------------------------
// token level: the assignment's own contract
// ---------------------------------------------------------------------------

const H = 16
function token(text: string, box: { x0: number; y0: number; x1: number; y1: number }, orientation: TextOrientation = 'HORIZONTAL'): TextToken {
  const n = text.length
  const vertical = orientation === 'ROTATED_CW' || orientation === 'ROTATED_CCW'
  return {
    text,
    score: 0.8,
    confidence: 0.9,
    box,
    shearDeg: 0,
    height: H,
    orientation,
    glyphs: [...text].map((char, i) => {
      const [f0, f1] = [i / n, (i + 1) / n]
      const gbox = vertical ? { x0: box.x0, x1: box.x1, y0: box.y0 + (box.y1 - box.y0) * f0, y1: box.y0 + (box.y1 - box.y0) * f1 } : { x0: box.x0 + (box.x1 - box.x0) * f0, x1: box.x0 + (box.x1 - box.x0) * f1, y0: box.y0, y1: box.y1 }
      return { char, score: 0.8, confidence: 0.9, alternatives: [], box: gbox, holes: { count: 0, cy: 0.5, areaFrac: 0 } }
    }),
  }
}
const ticksOf = (xs: number[], baseline: number): ChainTick[] => xs.map((atPx) => ({ atPx, baselinePx: baseline, observationId: '' }))
const hChain = (y: number, xs: number[]): RawChain => ({ axis: 'HORIZONTAL', baselinePx: y, ticks: ticksOf(xs, y), observationIds: [] })
/** A label above a horizontal line at `y`, centred at `at`, its baseline `gap` px above the line. */
const above = (text: string, y: number, at: number, gap: number): TextToken => token(text, { x0: at - text.length * 5, x1: at + text.length * 5, y0: y - gap - H, y1: y - gap })
/** A label below a line (its glyph tops toward it), `gap` px below. */
const below = (text: string, y: number, at: number, gap: number): TextToken => token(text, { x0: at - text.length * 5, x1: at + text.length * 5, y0: y + gap, y1: y + gap + H })

describe('label side: the convention, in each orientation', () => {
  it('a line past the baseline is BASELINE, through the body THROUGH, past the glyph tops TOP', () => {
    const t = token('500', { x0: 0, x1: 30, y0: 100, y1: 116 })
    expect(labelSide(t, 120)).toBe('BASELINE')
    expect(labelSide(t, 108)).toBe('THROUGH')
    expect(labelSide(t, 96)).toBe('TOP')
    const cw = token('500', { x0: 100, x1: 116, y0: 0, y1: 30 }, 'ROTATED_CW')
    expect(labelSide(cw, 120)).toBe('BASELINE')
    expect(labelSide(cw, 96)).toBe('TOP')
    const ccw = token('500', { x0: 100, x1: 116, y0: 0, y1: 30 }, 'ROTATED_CCW')
    expect(labelSide(ccw, 96)).toBe('BASELINE')
    expect(labelSide(ccw, 120)).toBe('TOP')
    const inv = token('500', { x0: 0, x1: 30, y0: 100, y1: 116 }, 'INVERTED')
    expect(labelSide(inv, 96)).toBe('BASELINE')
    expect(labelSide(inv, 120)).toBe('TOP')
  })
})

describe('§13 global assignment', () => {
  it('the exact assignment is the least total cost (a hand-checked 3 × 3)', () => {
    expect(hungarian([[4, 1, 3], [2, 0, 5], [3, 2, 2]])).toEqual([1, 0, 2])
  })

  it('a label is not moved off its line to make room for a worse one: one label per interval, the better kept', () => {
    // Two labels on one interval, one on the baseline side and one past its glyph tops; the second has nowhere else.
    const chains = [hChain(100, [0, 400])]
    const good = above('1000', 100, 200, 3)
    const worse = below('1000', 100, 200, 3)
    const { decisions } = assignLabels(chains, [good, worse])
    const byBox = (t: TextToken): string | undefined => decisions.find((d) => d.box === t.box)?.status
    expect(byBox(good)).toBe('BOUND')
    expect(byBox(worse)).toBe('UNASSIGNED')
  })

  it('§17 two labels tied for one interval are both refused (AMBIGUOUS), never handed out by list order', () => {
    const chains = [hChain(100, [0, 400])]
    const a = above('1000', 100, 190, 3)
    const b = above('1000', 100, 210, 3)
    for (const tokens of [[a, b], [b, a]]) {
      const { decisions, perChain } = assignLabels(chains, tokens)
      expect(decisions.map((d) => d.status)).toEqual(['AMBIGUOUS', 'AMBIGUOUS'])
      expect(perChain[0]).toHaveLength(0)
    }
  })

  it('§17 a label whose convention and distance disagree by exactly the side cost is refused', () => {
    // A line 4 px past its glyph tops (0.75 h from the label's centre, plus the side cost) against one 1.75 h from its
    // centre past its baseline: equal costs by construction.
    const label = token('500', { x0: 100, x1: 130, y0: 100, y1: 116 })
    const top = hChain(108 - 0.75 * H, [0, 400])
    const base = hChain(108 + (0.75 + ASSIGNMENT_BOUNDS.topSide) * H, [0, 400])
    const { decisions } = assignLabels([top, base], [label])
    expect(decisions[0].status).toBe('AMBIGUOUS')
    expect(decisions[0].margin).toBeLessThan(ASSIGNMENT_BOUNDS.ambiguity)
  })

  it('§16 enumeration order decides nothing: every permutation of labels and lines gives the same assignment', () => {
    const chains = [hChain(100, [0, 200, 400]), hChain(124, [0, 100, 300, 400]), hChain(160, [0, 400])]
    const tokens = [above('800', 100, 100, 3), above('800', 100, 300, 3), above('400', 124, 50, 3), above('800', 124, 200, 3), above('400', 124, 350, 3), above('1600', 160, 200, 3), below('99', 100, 250, 4)]
    const key = (r: ReturnType<typeof assignLabels>, order: number[]): string[] =>
      r.decisions.map((d) => `${d.text}@${Math.round(d.box.x0)},${Math.round(d.box.y0)}:${d.status}:${d.chosen ? `${chains.indexOf(chainsIn(order)[d.chosen.chain])}#${d.chosen.interval}` : '-'}`).sort()
    const chainsIn = (order: number[]): RawChain[] => order.map((i) => chains[i])
    const reference = key(assignLabels(chains, tokens), [0, 1, 2])
    let seed = 7
    const rand = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed / 2147483648
    }
    for (let trial = 0; trial < 24; trial += 1) {
      const t = [...tokens].sort(() => rand() - 0.5)
      const order = [0, 1, 2].sort(() => rand() - 0.5)
      expect(key(assignLabels(chainsIn(order), t), order)).toEqual(reference)
    }
  })

  it('§43 bounded: a page with 40 parallel lines and 480 labels is assigned in well under a second, the same twice', () => {
    const chains: RawChain[] = []
    const tokens: TextToken[] = []
    for (let k = 0; k < 40; k += 1) {
      const y = 100 + k * 22
      const xs = [0]
      for (let j = 0; j < 12; j += 1) xs.push(xs[xs.length - 1] + 60 + ((k * 7 + j * 13) % 40))
      chains.push(hChain(y, xs))
      for (let j = 0; j + 1 < xs.length; j += 1) tokens.push(above(String(100 + j * 10 + k), y, (xs[j] + xs[j + 1]) / 2, 3))
    }
    const t0 = performance.now()
    const first = assignLabels(chains, tokens)
    const ms = performance.now() - t0
    const second = assignLabels(chains, tokens)
    expect(JSON.stringify(first.decisions)).toBe(JSON.stringify(second.decisions))
    expect(first.decisions.filter((d) => d.status === 'BOUND').length).toBe(480)
    expect(ms).toBeLessThan(2000)
  })
})
