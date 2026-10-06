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
  labelCandidates,
  labelHeightOf,
  labelSide,
  markLabelInk,
  readNumbers,
  sideConventionOf,
  solveFrameChains,
  solveFrameMetric,
} from '../src/index.js'
import type { ChainTick, DimensionLine, RawChain, TextOrientation, TextToken } from '../src/index.js'

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

describe('§11 a real tick the labels cover on both sides (post-review A2)', () => {
  it('a stroke reaching the line between two labels is not label ink: kept, at most doubted, and measured', () => {
    let checked = 0
    for (const gap of [3, 4]) {
      const c = new Canvas(600, 300)
      hRule(c, 150, 100, 500, [100, 300, 500])
      const w = c.textWidth('800', CAP)
      c.text('800', 300 - w / 2, 150 - gap - CAP, CAP)
      c.text('500', 300 - w / 2, 150 + gap, CAP)
      const r = analyse(c.toRaster())
      const i = lineNear(r, 'HORIZONTAL', 150)
      if (i < 0) continue // at 3 px the labels swallow the line for the line finder: nothing to classify
      const mid = r.rawChains[i].ticks.find((t) => Math.abs(t.atPx - 300) <= 3)
      expect(mid?.class).not.toBe('REJECTED')
      expect(r.measured[i].ticks.some((t) => Math.abs(t.atPx - 300) <= 3)).toBe(true)
      checked += 1
    }
    expect(checked).toBeGreaterThan(0)
  })
})

describe('§11 text read across a line is not its label ink (post-review)', () => {
  it('a real tick under a parallel label and beside text running across the line keeps its place on the chain', () => {
    const c = new Canvas(600, 300)
    hRule(c, 150, 100, 500, [100, 300, 500])
    const w = c.textWidth('800', CAP)
    c.text('800', 300 - w / 2, 150 - 3 - CAP, CAP)
    // below the line, text running down the page across it — the kind of short token a reader forms from linework
    c.text('11', 300 - CAP / 2, 150 + 2 + c.textWidth('11', CAP), CAP, { rotate: 'CW' })
    const r = analyse(c.toRaster())
    const i = lineNear(r, 'HORIZONTAL', 150)
    expect(i).toBeGreaterThanOrEqual(0)
    const mid = r.rawChains[i].ticks.find((t) => Math.abs(t.atPx - 300) <= 3)
    expect(mid?.class).not.toBe('REJECTED')
    expect(r.measured[i].ticks.some((t) => Math.abs(t.atPx - 300) <= 3)).toBe(true)
  })
})

describe('§11 label ink is text along the line (post-review)', () => {
  // A horizontal line at y = 50 with one mark at x = 100; ink 3–8 px above and below it at the mark (two glyph blocks).
  const W = 200
  const mask = { width: W, height: 100, data: new Uint8Array(W * 100) }
  for (let x = 20; x <= 180; x += 1) mask.data[50 * W + x] = 1
  for (const [y0, y1] of [[42, 47], [53, 58]]) for (let y = y0; y <= y1; y += 1) for (let x = 96; x <= 104; x += 1) mask.data[y * W + x] = 1
  const line: DimensionLine = {
    axis: 'HORIZONTAL',
    baselinePx: 50,
    fromPx: 20,
    toPx: 180,
    thicknessPx: 1,
    ticksPx: [100],
    fill: 1,
    marks: [{ atPx: 100, hitFromPx: 96, hitToPx: 104, class: 'TICK', reasons: [], peakContrast: 1, weakContrast: 1, supportRows: [5, 5], rowsPerSide: 5, widthPx: [9, 9], narrows: [false, false], colourDiff: 0 }],
  }
  const block = (y0: number, y1: number) => ({ box: { x0: 94, x1: 106, y0, y1 }, glyphs: [{ x0: 94, x1: 99, y0, y1 }, { x0: 100, x1: 106, y0, y1 }] })
  it('two numerals printed along the line on either side of it: label ink, rejected', () => {
    const out = markLabelInk([line], [{ ...block(40, 47), axis: 'HORIZONTAL' }, { ...block(53, 62), axis: 'HORIZONTAL' }], mask)
    expect(out[0].marks?.[0]).toMatchObject({ class: 'REJECTED', reasons: ['TEXT_INK'] })
  })
  it('the same ink, the lower block read as text running across the line: that side is not label ink', () => {
    const out = markLabelInk([line], [{ ...block(40, 47), axis: 'HORIZONTAL' }, { ...block(53, 62), axis: 'VERTICAL' }], mask)
    expect(out[0].marks?.[0].class).not.toBe('REJECTED')
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

/**
 * Post-review E2 / A5: the same topology at other lettering, separations, scales and values, and under the other side
 * convention. `sheet` draws a margin of an overall line and its parts `sepH` label heights apart — on the LEFT of the
 * building (overall outermost) or on the RIGHT (overall outermost again, so under ISO its number sits between the two
 * lines) — numbers printed `gap` = a quarter of a label height off their lines, on the ISO side (above / left) or the
 * OTHER (below / right); a dimension line under the building for the other axis; and, with `anchors`, a far margin of
 * uncontested labels printed the same way, as a real sheet has.
 */
type Convention = 'ISO' | 'OTHER'
function sheet(o: { cap: number; sepH: number; scale: number; parts: number[]; convention: Convention; side?: 'LEFT' | 'RIGHT'; anchors?: number; drop?: number[] }): { canvas: Canvas; outer: number; inner: number; total: number } {
  const total = o.parts.reduce((a, b) => a + b, 0)
  const length = total / o.scale
  const W = 900
  const top = 120
  const bottom = top + length
  const c = new Canvas(W, Math.ceil(bottom + 260))
  const cap = o.cap
  const gap = Math.max(2, Math.round(cap / 4))
  const sep = Math.round(o.sepH * cap)
  const [outer, inner] = o.side === 'RIGHT' ? [W - 100, W - 100 - sep] : [60, 60 + sep]
  const vText = (text: string, x: number, from: number, to: number): void => {
    const w = c.textWidth(text, cap)
    c.text(text, o.convention === 'ISO' ? x - gap - cap : x + gap, (from + to) / 2 + w / 2, cap, { rotate: 'CW' })
  }
  const hText = (text: string, y: number, from: number, to: number): void => {
    const w = c.textWidth(text, cap)
    c.text(text, (from + to) / 2 - w / 2, o.convention === 'ISO' ? y - gap - cap : y + gap, cap, { slant: 0.18 })
  }
  vRule(c, outer, top, bottom, [top, bottom])
  vText(String(total), outer, top, bottom)
  const ticks = [top]
  for (const p of o.parts) ticks.push(ticks[ticks.length - 1] + p / o.scale)
  vRule(c, inner, top, bottom, ticks)
  o.parts.forEach((p, i) => {
    if (!(o.drop ?? []).includes(i)) vText(String(p), inner, ticks[i], ticks[i + 1])
  })
  const n = o.anchors ?? 2
  const [x0, x1] = [o.side === 'RIGHT' ? 160 : 200, (o.side === 'RIGHT' ? 160 : 200) + 1200 / o.scale]
  const yb = bottom + 120
  const step = (x1 - x0) / n
  hRule(c, yb, x0, x1, Array.from({ length: n + 1 }, (_, k) => x0 + k * step))
  for (let k = 0; k < n; k += 1) hText(String(1200 / n), yb, x0 + k * step, x0 + (k + 1) * step)
  if (o.anchors) {
    const far = o.side === 'RIGHT' ? 60 : W - 80
    const s2 = length / o.anchors
    vRule(c, far, top, bottom, Array.from({ length: o.anchors + 1 }, (_, k) => top + k * s2))
    for (let k = 0; k < o.anchors; k += 1) vText(String(Math.round(total / o.anchors)), far, top + k * s2, top + (k + 1) * s2)
  }
  return { canvas: c, outer, inner, total }
}
/** What the final assignment made of a vertical label: `O:i` / `I:i` (outer / inner line, interval) or its status. */
function sheetBindings(r: Run, outer: number, inner: number, text: string): string[] {
  const [o, i] = [lineNear(r, 'VERTICAL', outer), lineNear(r, 'VERTICAL', inner)]
  return r.metric.assignment
    .filter((d) => d.text === text && onAxis(d.orientation, 'V'))
    .map((d) => (d.status === 'BOUND' && d.chosen ? `${d.chosen.chain === o ? 'O' : d.chosen.chain === i ? 'I' : `#${d.chosen.chain}`}:${d.chosen.interval}` : d.status))
    .sort()
}

describe('§18 (16) the same margin at other lettering, separations, scales and values (post-review E2)', () => {
  const values = [
    [300, 600, 450],
    [250, 850, 250],
    [120, 1000, 120],
  ]
  const scales = [2.0, 2.5, 3.2]
  let k = 0
  for (const cap of [13, 16, 22]) {
    for (const sepH of [1.5, 2.5, 3.8]) {
      const parts = values[(k + Math.floor(k / 3)) % 3]
      const scale = scales[k % 3]
      k += 1
      it(`cap ${cap} px, lines ${sepH} label heights apart, ${parts.join(' / ')} at ${scale} cm/px: every number on its own line`, () => {
        const { canvas, outer, inner, total } = sheet({ cap, sepH, scale, parts, convention: 'ISO' })
        const r = analyse(canvas.toRaster())
        // The overall line holds exactly one number, and it is the ink printed beside it — the overall's, whatever the
        // reader made of its digits (at 22 px the lattice reads `1240` as `1210`: an OCR matter, not a topology one).
        const o = lineNear(r, 'VERTICAL', outer)
        const onOuter = r.metric.assignment.filter((d) => d.status === 'BOUND' && d.chosen?.chain === o)
        expect(onOuter).toHaveLength(1)
        const gap = Math.max(2, Math.round(cap / 4))
        expect(onOuter[0].box.x1).toBeLessThanOrEqual(outer - gap + 2)
        expect(onOuter[0].box.x0).toBeGreaterThanOrEqual(outer - gap - cap - 3)
        if (onOuter[0].text === String(total)) expect(sheetBindings(r, outer, inner, String(total))).toEqual(['O:0'])
        // A part's number is on its own interval of the part line, or (unread at this lettering) nowhere — never on the overall.
        parts.forEach((p, i) => {
          const own = parts.map((q, j) => (q === p ? `I:${j}` : null)).filter((x): x is string => x !== null)
          for (const b of sheetBindings(r, outer, inner, String(p))) expect(own).toContain(b)
        })
        expect(close(r.metric.pooledScale, scale)).toBe(true)
      })
    }
  }
})

describe('§18 (17–19) the side convention is the sheet’s (post-review E1 / A5)', () => {
  it('(17) the other convention, stated by the sheet: numbers right of / below their lines — the same assignment', () => {
    for (const cap of [13, 16, 22]) {
      const { canvas, outer, inner } = sheet({ cap, sepH: 1.5, scale: 2.5, parts: [250, 850, 250], convention: 'OTHER', anchors: 4 })
      const r = analyse(canvas.toRaster())
      expect(r.metric.assignmentConventions.VERTICAL).toMatchObject({ side: 'AFTER', basis: 'STATED' })
      expect(sheetBindings(r, outer, inner, '1350')).toEqual(['O:0'])
      expect(sheetBindings(r, outer, inner, '850')).toEqual(['I:1'])
      expect(sheetBindings(r, outer, inner, '250')).toEqual(['I:0', 'I:2'])
    }
  })

  it('(18) an ISO right-hand margin: the overall’s own number sits between the two lines and is still the overall’s', () => {
    const { canvas, outer, inner } = sheet({ cap: 16, sepH: 1.5, scale: 2.5, parts: [250, 850, 250], convention: 'ISO', side: 'RIGHT' })
    const r = analyse(canvas.toRaster())
    expect(sheetBindings(r, outer, inner, '1350')).toEqual(['O:0'])
    expect(sheetBindings(r, outer, inner, '850')).toEqual(['I:1'])
    expect(sheetBindings(r, outer, inner, '250')).toEqual(['I:0', 'I:2'])
  })

  it('(19) the other convention on a sparse sheet, the middle part unread: the overall’s number is never handed to the part line', () => {
    const { canvas, outer, inner } = sheet({ cap: 16, sepH: 1.5, scale: 2.5, parts: [250, 850, 250], convention: 'OTHER', drop: [1] })
    const r = analyse(canvas.toRaster())
    // Two uncontested numbers right of their line contradict ISO; no side is preferred, and a tie is refused.
    expect(r.metric.assignmentConventions.VERTICAL).toMatchObject({ side: null, basis: 'CONTRADICTED' })
    for (const b of sheetBindings(r, outer, inner, '1350')) expect(['O:0', 'AMBIGUOUS']).toContain(b)
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

describe('label side: where the ink lies on the page, whichever way up it was read', () => {
  it('above / left of a line is BEFORE, across it ACROSS, below / right of it AFTER — in every orientation', () => {
    for (const o of ['HORIZONTAL', 'INVERTED'] as const) {
      const t = token('500', { x0: 0, x1: 30, y0: 100, y1: 116 }, o)
      expect(labelSide(t.box, 'HORIZONTAL', 120)).toBe('BEFORE')
      expect(labelSide(t.box, 'HORIZONTAL', 108)).toBe('ACROSS')
      expect(labelSide(t.box, 'HORIZONTAL', 96)).toBe('AFTER')
    }
    for (const o of ['ROTATED_CW', 'ROTATED_CCW'] as const) {
      const t = token('500', { x0: 100, x1: 116, y0: 0, y1: 30 }, o)
      expect(labelSide(t.box, 'VERTICAL', 120)).toBe('BEFORE')
      expect(labelSide(t.box, 'VERTICAL', 108)).toBe('ACROSS')
      expect(labelSide(t.box, 'VERTICAL', 96)).toBe('AFTER')
    }
  })
})

const vChainT = (x: number, ys: number[]): RawChain => ({ axis: 'VERTICAL', baselinePx: x, ticks: ys.map((atPx) => ({ atPx, baselinePx: x, observationId: '' })), observationIds: [] })
/** A vertical label `gap` px left (or right) of a line at `x`, centred on `from`–`to`, read as `orientation`. */
const beside = (text: string, x: number, from: number, to: number, gap: number, where: 'LEFT' | 'RIGHT', orientation: TextOrientation = 'ROTATED_CW'): TextToken =>
  token(text, { x0: where === 'LEFT' ? x - gap - H : x + gap, x1: where === 'LEFT' ? x - gap : x + gap + H, y0: (from + to) / 2 - text.length * 5, y1: (from + to) / 2 + text.length * 5 }, orientation)
const decisionsOf = (chains: RawChain[], tokens: TextToken[]): string[] =>
  assignLabels(chains, tokens).decisions.map((d) => `${d.text}@${Math.round(d.box.y0)}:${d.status}:${d.chosen ? `${d.chosen.chain}#${d.chosen.interval}` : '-'}`).sort()

describe('the side convention is read from the sheet (post-review E1 / A5)', () => {
  // The margin of case (1) at token level: overall at x 60 (120–560), parts at x 84 (120 / 160 / 520 / 560).
  const margin2 = (): RawChain[] => [vChainT(60, [120, 560]), vChainT(84, [120, 160, 520, 560])]

  it('which way up a label was read changes nothing: ISO labels read bottom to top or top to bottom bind alike', () => {
    for (const unread of [[] as string[], ['1100']]) {
      const make = (o: TextOrientation): TextToken[] =>
        [beside('1100', 60, 120, 560, 4, 'LEFT', o), beside('100', 84, 120, 160, 4, 'LEFT', o), beside('900', 84, 160, 520, 4, 'LEFT', o), beside('100', 84, 520, 560, 4, 'LEFT', o)].filter((t) => !unread.includes(t.text))
      const cw = decisionsOf(margin2(), make('ROTATED_CW'))
      expect(decisionsOf(margin2(), make('ROTATED_CCW'))).toEqual(cw)
      // the parts on the part line, whatever is unread
      expect(cw.filter((d) => d.startsWith('900@'))).toEqual([expect.stringMatching(/:BOUND:1#1$/)])
    }
  })

  it('labels printed right of their lines on a sheet that says nothing else: the overall’s number is never handed to the part line', () => {
    // Middle part unread: the overall's number is between the lines, 4 px from each. ISO would send it to the part line.
    const tokens = [beside('1100', 60, 120, 560, 4, 'RIGHT'), beside('100', 84, 120, 160, 4, 'RIGHT'), beside('100', 84, 520, 560, 4, 'RIGHT')]
    const r = assignLabels(margin2(), tokens)
    expect(r.conventions.VERTICAL).toMatchObject({ side: null, basis: 'CONTRADICTED' })
    const overall = r.decisions.find((d) => d.text === '1100')
    expect(overall?.status === 'BOUND' ? overall.chosen : overall?.status).not.toEqual({ chain: 1, interval: 1 })
  })

  it('a sheet whose uncontested labels all sit right of their lines states that convention, and it binds as ISO does on an ISO sheet', () => {
    const far = [vChainT(300, [120, 230, 340, 450, 560])]
    const anchors = [0, 1, 2, 3].map((k) => beside('275', 300, 120 + k * 110, 230 + k * 110, 4, 'RIGHT'))
    const tokens = [beside('1100', 60, 120, 560, 4, 'RIGHT'), beside('100', 84, 120, 160, 4, 'RIGHT'), beside('100', 84, 520, 560, 4, 'RIGHT'), ...anchors]
    const r = assignLabels([...margin2(), ...far], tokens)
    expect(r.conventions.VERTICAL).toMatchObject({ side: 'AFTER', basis: 'STATED' })
    expect(r.decisions.find((d) => d.text === '1100')).toMatchObject({ status: 'BOUND', chosen: { chain: 0, interval: 0 } })
  })

  it('an in-line label (the line runs through it) costs nothing for its side and is its line’s, beside a neighbour', () => {
    const across = token('500', { x0: 185, x1: 215, y0: 92, y1: 108 })
    expect(labelSide(across.box, 'HORIZONTAL', 100)).toBe('ACROSS')
    const r = assignLabels([hChain(100, [0, 400]), hChain(118, [0, 400])], [across])
    expect(r.decisions[0]).toMatchObject({ status: 'BOUND', chosen: { chain: 0, interval: 0 } })
    expect(r.decisions[0].candidates.find((c) => c.chain === 0)).toMatchObject({ side: 'ACROSS', againstConvention: false })
  })

  it('the rule: stated by four to one, contradicted by two against, otherwise ISO stands — with or without anchors for it', () => {
    expect(sideConventionOf({ before: 0, across: 0, after: 0 })).toMatchObject({ side: 'BEFORE', basis: 'SILENT' })
    expect(sideConventionOf({ before: 3, across: 1, after: 1 })).toMatchObject({ side: 'BEFORE', basis: 'CONSISTENT' })
    expect(sideConventionOf({ before: 8, across: 0, after: 2 })).toMatchObject({ side: 'BEFORE', basis: 'STATED' })
    expect(sideConventionOf({ before: 1, across: 0, after: 1 })).toMatchObject({ side: 'BEFORE', basis: 'CONSISTENT' })
    expect(sideConventionOf({ before: 2, across: 0, after: 2 })).toMatchObject({ side: null, basis: 'CONTRADICTED' })
    expect(sideConventionOf({ before: 1, across: 0, after: 3 })).toMatchObject({ side: null, basis: 'CONTRADICTED' })
    expect(sideConventionOf({ before: 1, across: 0, after: 4 })).toMatchObject({ side: 'AFTER', basis: 'STATED' })
  })
})

describe('the record says what was decided (post-review A3 / A6 / A9 / E9)', () => {
  it('a refused label names no line: AMBIGUOUS carries every candidate and no `chosen`', () => {
    const chains = [hChain(100, [0, 400])]
    const { decisions } = assignLabels(chains, [above('1000', 100, 190, 3), above('1000', 100, 210, 3)])
    expect(decisions.every((d) => d.status === 'AMBIGUOUS' && d.chosen === undefined && d.candidates.length === 1)).toBe(true)
  })

  it('`centred` is recorded as found even where it costs nothing (the page vote)', () => {
    const chains = [hChain(100, [0, 100, 400])]
    const off = above('300', 100, 380, 3) // near the end of the 100–400 interval: no span is centred on it
    const { decisions } = assignLabels(chains, [off])
    expect(decisions[0].candidates[0].centred).toBe(false)
    expect(decisions[0].candidates[0].cost).toBeLessThan(ASSIGNMENT_BOUNDS.uncentred)
  })

  it('of two tokens with one geometry and reading, the same one is kept whichever comes first', () => {
    const chains = [hChain(100, [0, 400])]
    const a = above('1000', 100, 200, 3)
    const b = { ...above('1000', 100, 200, 3), height: 20 }
    const pick = (ts: TextToken[]): number | undefined => assignLabels(chains, ts).decisions[0]?.candidates[0]?.offset
    expect(pick([a, b])).toBe(pick([b, a]))
  })
})

describe('axis groups: a line ends where its first and last ticks are (post-review A4 / E4)', () => {
  it('a neighbour’s interior mark, or its doubted end, does not align an end; its own tick end does', () => {
    const parts = vChainT(84, [120, 160, 520, 560])
    const interior = vChainT(60, [100, 120, 580]) // a mark at 120, but the line runs on past it
    expect(dimensionAxisGroups('f', [interior, parts], ['a', 'b'], 16).perChain[1]?.alignedEnds).toEqual([false, false])
    const ends = vChainT(60, [120, 560])
    expect(dimensionAxisGroups('f', [ends, parts], ['a', 'b'], 16).perChain[1]?.alignedEnds).toEqual([true, true])
    const doubted: RawChain = { ...ends, ticks: ends.ticks.map((t) => (t.atPx === 560 ? { ...t, class: 'QUESTIONABLE' as const, reasons: ['TEXT_INK' as const] } : t)) }
    expect(dimensionAxisGroups('f', [{ ...doubted, ticks: [...doubted.ticks, { atPx: 600, baselinePx: 60, observationId: '' }] }, parts], ['a', 'b'], 16).perChain[1]?.alignedEnds).toEqual([true, false])
  })

  it('post-review D4: relations and roles do not depend on the order the lines come in', () => {
    // B and C have the same ends and no interior mark in common: each CONTAINS the other within tolerance. A spans
    // both; D is a part line subdividing A.
    const lines: Record<string, RawChain> = { A: hChain(100, [0, 400]), B: hChain(120, [0, 150, 400]), C: hChain(140, [0, 260, 400]), D: hChain(160, [0, 200, 400]) }
    const permutations = (xs: string[]): string[][] => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p])))
    const key = (order: string[]): string => {
      const r = dimensionAxisGroups('f', order.map((k) => lines[k]), order, 14)
      return JSON.stringify({
        relations: r.groups.flatMap((g) => g.relations.map((x) => `${order[x.a]} ${x.kind} ${order[x.b]} ${x.alignedEnds.join('/')}`)),
        roles: Object.fromEntries(order.map((k, i) => [k, r.perChain[i]?.roles]).sort()),
        aligned: Object.fromEntries(order.map((k, i) => [k, r.perChain[i]?.alignedEnds]).sort()),
      })
    }
    const all = permutations(['A', 'B', 'C', 'D'])
    expect(all.length).toBe(24)
    const reference = key(all[0])
    for (const order of all) expect(key(order)).toBe(reference)
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
    const base = hChain(108 + (0.75 + ASSIGNMENT_BOUNDS.againstConvention) * H, [0, 400])
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

  it('§43 post-review D2: one neighbourhood beyond the exact bound is solved once (bounded); beyond the work bound it is a recorded gap', () => {
    // Two lines 24 px apart, marks staggered by half an interval, two numbers per interval of the upper line between
    // them: numbers 2k and 2k+1 compete for the upper line's interval k, numbers 2k+1 and 2k+2 for the lower line's —
    // so every number is in one neighbourhood.
    const sheet = (n: number): { chains: RawChain[]; tokens: TextToken[] } => {
      const half = Math.ceil(n / 2)
      const a = Array.from({ length: half + 1 }, (_, k) => k * 20)
      const b = Array.from({ length: half + 1 }, (_, k) => 10 + k * 20)
      const tokens = Array.from({ length: n }, (_, i) => {
        const along = 5 + Math.floor(i / 2) * 20 + (i % 2) * 10
        return token('100', { x0: along - 2, x1: along + 2, y0: 104, y1: 120 })
      })
      return { chains: [hChain(100, a), hChain(124, b)], tokens }
    }
    const work = (n: number): number => {
      const slots = new Set(sheet(n).tokens.flatMap((t) => labelCandidates(sheet(n).chains, t).map((c) => `${c.chain}:${c.interval}`))).size
      return n * n * (slots + n)
    }
    const boundedN = ASSIGNMENT_BOUNDS.componentLabels + 24
    const bounded = sheet(boundedN)
    const t0 = performance.now()
    const r1 = assignLabels(bounded.chains, bounded.tokens)
    expect(performance.now() - t0).toBeLessThan(5000)
    expect(r1.stats).toMatchObject({ neighbourhoods: 1, largest: boundedN, exact: 0, bounded: 1, unsolved: 0 })
    expect(r1.decisions.some((d) => d.bounded)).toBe(true)
    let cappedN = boundedN
    while (work(cappedN) <= ASSIGNMENT_BOUNDS.solveWork) cappedN += 50
    const capped = sheet(cappedN)
    const ticks: number[] = []
    const t1 = performance.now()
    const r2 = assignLabels(capped.chains, capped.tokens, { checkpoint: { phase: () => undefined, tick: (p) => ticks.push(p?.counters?.neighbourhood ?? -1) } })
    expect(performance.now() - t1).toBeLessThan(5000)
    expect(r2.stats).toMatchObject({ neighbourhoods: 1, largest: cappedN, unsolved: 1, exact: 0, bounded: 0 })
    expect(r2.decisions.every((d) => d.status === 'UNASSIGNED' && d.bounded === true && d.chosen === undefined)).toBe(true)
    expect(r2.perChain.every((list) => list.length === 0)).toBe(true)
    // one heartbeat per neighbourhood, before its solve
    expect(ticks).toEqual([1])
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
