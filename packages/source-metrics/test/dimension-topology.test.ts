import { describe, expect, it } from 'vitest'
import { Canvas } from '@buildapp/synthetic-drawings'
import { adaptiveInkMask, inkChannel } from '@buildapp/source-cv'
import type { Raster } from '@buildapp/source-cv'
import { chainId, chainsFromLines, dimensionLabelLattices, findDimensionLines, readNumbers, solveFrameChains, solveFrameMetric } from '../src/index.js'
import type { DimensionLine, DimensionObservation } from '../src/index.js'

/**
 * BUILDPLAN-ANALYZER-005D §39, §41–§43: dimension-chain topology on drawn sheets.
 *
 * Every case is drawn on a synthetic canvas the way a sheet draws dimensions — a rule, slash
 * ticks where a measurement ends, the number above the span it measures — at a scale the solver
 * is never told (2.5 cm/px: 1200 cm over 480 px). Then the whole metric path runs on the pixels:
 * ink mask, dimension lines with every crossing mark classified against the line it sits on,
 * the reader, the page vote and the independent solver. No case names a house; no expectation
 * depends on the value printed being convenient. What each case holds is the 005D contract:
 * a crossing line is not automatically a tick, one extra mark does not destroy a supported total,
 * real internal ticks stay, and a total that disagrees with its children is reported, not forced.
 */

const FRAME = 'frame-topology'
const SCALE = 2.5
const CAP = 16
const L = 100
const R = 580 // 1200 cm at 2.5 cm/px

type Run = ReturnType<typeof analyse>

function analyse(raster: Raster) {
  const grey = inkChannel(raster)
  const mask = adaptiveInkMask(grey, {})
  const lines = findDimensionLines(mask, { raster, grey })
  const chains = chainsFromLines(lines)
  const read = readNumbers(raster, { hypotheses: true, retainPasses: true })
  const legacy = solveFrameChains(chains, read.tokens, { tolerancePx: 2.2 })
  const ids = chains.map((c) => chainId(FRAME, c.axis, c.baselinePx, c.ticks.map((t) => t.atPx)))
  // 005E: the production path — every label on a dimension line is re-read as a numeric lattice.
  const lattices = new Map([...dimensionLabelLattices(read, chains, raster)].map(([t, lattice], i) => [t, { id: `lattice-${i}`, lattice }]))
  const metric = solveFrameMetric({ frameId: FRAME, assetId: 'asset', chains, chainIds: ids, raw: read.raw ?? read.tokens, legacyTokens: read.tokens, legacy, tolerancePx: 2.2, lattices })
  return { lines, chains, ids, legacy, metric, solution: metric.solution }
}
const run = (c: Canvas): Run => analyse(c.toRaster())

/** A rule from `x0` to `x1` at `y`, with a slash tick at each of `ticks`. */
function rule(c: Canvas, y: number, x0: number, x1: number, ticks: number[]): void {
  c.line(x0, y, x1, y, 1)
  for (const t of ticks) c.tick(t, y, 'HORIZONTAL')
}
/** A number centred over the span it measures, set above the line (or below it). */
function label(c: Canvas, text: string, from: number, to: number, y: number, side: 'ABOVE' | 'BELOW' = 'ABOVE'): void {
  const w = c.textWidth(text, CAP)
  c.text(text, (from + to) / 2 - w / 2, side === 'ABOVE' ? y - CAP - 5 : y + 5, CAP, { slant: 0.18 })
}
/** A lighter mark that crosses the line and widens on one side: what a leader end or a hatch boundary leaves. */
function wedge(c: Canvas, x: number, y: number, value = 165): void {
  for (let d = -2; d <= 10; d += 1) {
    const w = Math.max(1, Math.round(1 + d / 2))
    c.fill(x - w / 2, y + d, x + w / 2, y + d, value)
  }
}
const lineAt = (r: Run, y: number): DimensionLine => {
  const line = r.lines.find((l) => l.axis === 'HORIZONTAL' && Math.abs(l.baselinePx - y) < 2)
  if (!line) throw new Error(`no line at ${y}: ${r.lines.map((l) => `${l.axis[0]}${l.baselinePx}`).join(' ')}`)
  return line
}
const markAt = (line: DimensionLine, x: number) => (line.marks ?? []).find((m) => Math.abs(m.atPx - x) <= 3)
const primary = (r: Run, text: string): DimensionObservation[] => r.metric.observations.filter((o) => o.rawText === text && o.binding?.role === 'PRIMARY')
const spans = (r: Run, text: string): string[] => primary(r, text).map((o) => `${Math.round(o.fromPx)}-${Math.round(o.toPx)}`)
const selectedScale = (r: Run): number | undefined => r.solution.hypotheses.find((h) => h.id === r.solution.selectedHypothesisId)?.cmPerPixel
const near = (a: number | undefined, b: number, rel = 0.01): boolean => a !== undefined && Math.abs(a / b - 1) <= rel

describe('§39 dimension topology on drawn chains', () => {
  it('(1) a clean total: two end ticks, the number centred, bound to the whole span, the scale it states', () => {
    const c = new Canvas(900, 300)
    rule(c, 150, L, R, [L, R])
    label(c, '1200', L, R, 150)
    const r = run(c)
    expect((lineAt(r, 150).marks ?? []).map((m) => m.class)).toEqual(['TICK', 'TICK'])
    expect(spans(r, '1200')).toEqual(['101-580'])
    expect(near(r.metric.pooledScale, SCALE)).toBe(true)
    // One ink, however many ways it was read (its upside-down "0071" is the same ink): one witness.
    expect(r.solution.independentWitnesses).toBe(1)
  })

  it('(2) a total over a child chain whose ticks are real: the total frames its children and agrees as read', () => {
    const c = new Canvas(900, 300)
    rule(c, 150, L, R, [L, 300, R])
    label(c, '500', L, 300, 150)
    label(c, '700', 300, R, 150)
    rule(c, 112, L, R, [L, R])
    label(c, '1200', L, R, 112)
    const r = run(c)
    expect((lineAt(r, 150).marks ?? []).every((m) => m.class === 'TICK')).toBe(true)
    const total = r.metric.relations.find((x) => x.kind === 'TOTAL_OF')
    expect(total?.check).toBe('AGREES_AS_READ')
    expect(total?.sum).toMatchObject({ totalCm: 1200, partsCm: 1200, agrees: true })
    expect(r.metric.relations.some((x) => x.kind === 'SEGMENT_OF')).toBe(true)
    expect(r.solution.confidence).toBe('SUPPORTED')
    expect(near(r.metric.pooledScale, SCALE)).toBe(true)
  })

  it('(3) one spurious mark — lighter than the line, on one side, widening — is rejected, and the total keeps its whole span', () => {
    const c = new Canvas(900, 300)
    rule(c, 150, L, R, [L, R])
    label(c, '1200', L, R, 150)
    wedge(c, 230, 150)
    const r = run(c)
    const mark = markAt(lineAt(r, 150), 230)
    expect(mark?.class).toBe('REJECTED')
    expect(mark?.reasons).toEqual(expect.arrayContaining(['LIGHTER_THAN_LINE', 'ONE_SIDED', 'WEDGE_NOT_STROKE']))
    expect(spans(r, '1200')).toEqual(['101-580'])
    expect(primary(r, '1200')[0].binding?.skipped).toEqual({ tick: 0, questionable: 0, rejected: 1 })
    // The page vote is the adversary: it splits the chain at the mark and puts 1200 on the part.
    expect(near(r.legacy.pooledScale, SCALE, 0.05)).toBe(false)
    expect(r.solution.relation).toBe('REPLACED')
    expect(near(r.metric.pooledScale, SCALE)).toBe(true)
    expect(r.solution.topology?.marks).toEqual({ tick: 2, questionable: 0, rejected: 1 })
    // Read again at the replaced scale with the marks' classes: one segment, as read — never split at the mark.
    const solved = r.metric.solved.find((c) => c.segments.some((g) => g.valueCm === 1200))
    expect(solved?.segments.map((g) => [g.valueCm, g.origin])).toEqual([[1200, 'READ']])
  })

  it('(4) two spurious marks are both rejected; the total is still bound to its outer ticks', () => {
    const c = new Canvas(900, 300)
    rule(c, 150, L, R, [L, R])
    label(c, '1200', L, R, 150)
    wedge(c, 230, 150)
    wedge(c, 470, 150)
    const r = run(c)
    expect(markAt(lineAt(r, 150), 230)?.class).toBe('REJECTED')
    expect(markAt(lineAt(r, 150), 470)?.class).toBe('REJECTED')
    expect(spans(r, '1200')).toEqual(['101-580'])
    expect(near(r.metric.pooledScale, SCALE)).toBe(true)
  })

  it('(5) a dark stroke crossing the line is kept as a mark (crossing lines are not deleted), but a centred total skips it', () => {
    const c = new Canvas(900, 300)
    rule(c, 150, L, R, [L, R])
    label(c, '1200', L, R, 150)
    c.line(230, 143, 230, 157, 1)
    const r = run(c)
    expect(markAt(lineAt(r, 150), 230)?.class).toBe('TICK')
    expect(spans(r, '1200')).toEqual(['101-580'])
    expect(primary(r, '1200')[0].binding?.skipped.tick).toBe(1)
    // The off-centre part is kept as a bounded alternative, never as the reading.
    const alternative = r.metric.observations.find((o) => o.rawText === '1200' && o.binding?.role === 'ALTERNATIVE')
    expect(alternative?.status).not.toBe('ACCEPTED')
    expect(near(r.metric.pooledScale, SCALE)).toBe(true)
  })

  it('(6) a text stroke crossing the line does not end the total printed over it', () => {
    const c = new Canvas(900, 300)
    rule(c, 150, L, R, [L, R])
    label(c, '1200', L, R, 150)
    c.text('88', 420, 141, CAP)
    const r = run(c)
    expect(spans(r, '1200')).toEqual(['101-580'])
    expect(near(r.metric.pooledScale, SCALE)).toBe(true)
  })

  it('(7) light hatching across the line yields doubted marks only — none of them is a tick, none ends the total', () => {
    const c = new Canvas(900, 300)
    rule(c, 150, L, R, [L, R])
    label(c, '1200', L, R, 150)
    for (let x = 150; x < 290; x += 9) c.line(x, 172, x + 24, 128, 1, 200)
    const r = run(c)
    const inner = (lineAt(r, 150).marks ?? []).filter((m) => m.atPx > L + 5 && m.atPx < R - 5)
    expect(inner.length).toBeGreaterThan(0)
    expect(inner.every((m) => m.class !== 'TICK')).toBe(true)
    expect(spans(r, '1200')).toEqual(['101-580'])
    expect(near(r.metric.pooledScale, SCALE)).toBe(true)
  })

  it('(8) a partial label near a total belongs to its own chain: bound to its own segment, never to the total line', () => {
    const c = new Canvas(900, 300)
    rule(c, 150, L, R, [L, 300, R])
    label(c, '500', L, 300, 150)
    rule(c, 112, L, R, [L, R])
    label(c, '1200', L, R, 112)
    const r = run(c)
    expect(spans(r, '500')).toEqual(['101-300'])
    expect(spans(r, '1200')).toEqual(['101-580'])
    // The unread child is not a value: the sum closes only through the derived part, and is recorded as such.
    const total = r.metric.relations.find((x) => x.kind === 'TOTAL_OF')
    expect(total?.check).toBe('AGREES_AFTER_CORRECTION')
    expect(r.solution.topology?.hierarchy?.agreesAsRead).toBe(0)
    expect(near(r.metric.pooledScale, SCALE)).toBe(true)
  })

  it('(9) a total centred across the whole line stays a total with real ticks beneath it', () => {
    const c = new Canvas(900, 300)
    rule(c, 150, L, R, [L, 250, 380, R])
    label(c, '1200', L, R, 150)
    const r = run(c)
    expect((lineAt(r, 150).marks ?? []).map((m) => m.class)).toEqual(['TICK', 'TICK', 'TICK', 'TICK'])
    expect(spans(r, '1200')).toEqual(['101-580'])
    expect(primary(r, '1200')[0].binding?.skipped.tick).toBe(2)
    expect(near(r.metric.pooledScale, SCALE)).toBe(true)
  })

  it('(9b) a total printed on the far side of a line that carries its children is not a second label for an interval: the children carry the scale, at lower confidence', () => {
    const c = new Canvas(900, 300)
    rule(c, 150, L, R, [L, 300, R])
    label(c, '500', L, 300, 150)
    label(c, '700', 300, R, 150)
    label(c, '1200', L, R, 150, 'BELOW')
    const r = run(c)
    expect(near(r.metric.pooledScale, SCALE)).toBe(true)
    expect(['WEAK', 'INCONCLUSIVE']).toContain(r.solution.confidence)
  })

  it('(10) a missing child tick is never invented: the off-centre labels measure nothing, and no vote is made of them', () => {
    const c = new Canvas(900, 300)
    rule(c, 150, L, R, [L, 300, R])
    label(c, '500', L, 300, 150)
    label(c, '400', 300, 460, 150)
    label(c, '300', 460, R, 150)
    const r = run(c)
    expect(lineAt(r, 150).ticksPx).toHaveLength(3)
    expect(r.metric.observations.filter((o) => o.rawText === '400').every((o) => o.binding?.role !== 'PRIMARY')).toBe(true)
    // 005D: the page vote handed the interval 300–580 to whichever of `400` and `300` its list reached first, read
    // `400` over it, rewrote the `500`, and nothing independent confirmed that vote (LEGACY_UNCONFIRMED / INCONCLUSIVE).
    // 005I: two labels tied for one interval are both refused (AMBIGUOUS), so neither reaches any vote; the scale is
    // the one the `500` states, and a single witness states it WEAKLY.
    expect(r.legacy.assignment.filter((d) => d.text === '400' || d.text === '300').map((d) => d.status)).toEqual(['AMBIGUOUS', 'AMBIGUOUS'])
    expect(near(r.metric.pooledScale, SCALE)).toBe(true)
    // post-review A10: pinned — the page vote's scale (the `500`'s) is confirmed by the one witness, weakly.
    expect(r.solution.relation).toBe('CONFIRMED')
    expect(r.solution.confidence).toBe('WEAK')
  })

  it('(11) duplicate ticks a few pixels apart are one mark: the span moves by a pixel, never splits', () => {
    for (const gap of [2, 4, 6]) {
      const c = new Canvas(900, 300)
      rule(c, 150, L, R, [L, L + gap, R])
      label(c, '1200', L, R, 150)
      const r = run(c)
      expect(lineAt(r, 150).ticksPx, `gap ${gap}`).toHaveLength(2)
      expect(primary(r, '1200')).toHaveLength(1)
      expect(near(r.metric.pooledScale, SCALE, 0.012), `gap ${gap}`).toBe(true)
    }
  })

  it('(12) a broken end tick still ends the span; one reduced to a stub on one side is no crossing, and the chain then states nothing', () => {
    const broken = new Canvas(900, 300)
    rule(broken, 150, L, R, [L])
    broken.line(R - 2, 154, R, 150, 1)
    broken.line(R + 1, 148, R + 2, 146, 1)
    label(broken, '1200', L, R, 150)
    const r = run(broken)
    expect(spans(r, '1200')).toEqual(['101-580'])
    expect(near(r.metric.pooledScale, SCALE)).toBe(true)

    const stub = new Canvas(900, 300)
    rule(stub, 150, L, R, [L])
    stub.line(R - 2, 154, R, 150, 1)
    label(stub, '1200', L, R, 150)
    const s = run(stub)
    expect(s.metric.pooledScale).toBeUndefined()
    expect(s.solution.relation).toBe('NO_SCALE')
  })

  it('(13) an extension line drawn a few pixels off the tick merges with it: one end, the scale within a pixel', () => {
    const c = new Canvas(900, 300)
    rule(c, 150, L, R, [L, R])
    c.line(R + 3, 120, R + 3, 165, 1)
    c.line(L, 120, L, 165, 1)
    label(c, '1200', L, R, 150)
    const r = run(c)
    expect(lineAt(r, 150).ticksPx).toHaveLength(2)
    expect(primary(r, '1200')).toHaveLength(1)
    expect(near(r.metric.pooledScale, SCALE, 0.006)).toBe(true)
  })

  it('(14) two hierarchy levels: the overall frames the middle line, and a middle segment frames the inner parts', () => {
    const c = new Canvas(900, 300)
    rule(c, 188, L, R, [L, 180, 300, R])
    label(c, '200', L, 180, 188)
    label(c, '300', 180, 300, 188)
    label(c, '700', 300, R, 188)
    rule(c, 150, L, R, [L, 300, R])
    label(c, '500', L, 300, 150)
    label(c, '700', 300, R, 150)
    rule(c, 112, L, R, [L, R])
    label(c, '1200', L, R, 112)
    const r = run(c)
    const totals = r.metric.relations.filter((x) => x.kind === 'TOTAL_OF')
    expect(totals.map((t) => [t.sum?.totalCm, t.sum?.partsCm, t.check]).sort()).toEqual([
      [1200, 1200, 'AGREES_AS_READ'],
      [500, 500, 'AGREES_AS_READ'],
    ])
    // The middle total is over part of the inner line: the record says which part.
    expect(totals.find((t) => t.sum?.totalCm === 500)?.span).toEqual({ fromPx: 100.5, toPx: 300 })
    expect(r.solution.topology?.hierarchy).toMatchObject({ totals: 2, agreesAsRead: 2, conflictsAsRead: 0 })
    expect(near(r.metric.pooledScale, SCALE)).toBe(true)
  })
})

describe('§42 negative: real internal ticks stay', () => {
  it('a segmented chain with a label on every segment and no total remains segmented, every part read', () => {
    const c = new Canvas(900, 300)
    rule(c, 150, L, R, [L, 220, 380, R])
    label(c, '300', L, 220, 150)
    label(c, '400', 220, 380, 150)
    label(c, '500', 380, R, 150)
    const r = run(c)
    expect((lineAt(r, 150).marks ?? []).map((m) => m.class)).toEqual(['TICK', 'TICK', 'TICK', 'TICK'])
    const chain = r.metric.solved.find((s) => s.segments.length === 3)
    expect(chain?.segments.map((g) => [g.valueCm, g.origin])).toEqual([
      [300, 'READ'],
      [400, 'READ'],
      [500, 'READ'],
    ])
    expect(r.solution.independentWitnesses).toBe(3)
    expect(near(r.metric.pooledScale, SCALE)).toBe(true)
  })

  it('a spurious mark on one line does not make a real internal tick on another line doubtful', () => {
    const c = new Canvas(900, 360)
    rule(c, 150, L, R, [L, R])
    label(c, '1200', L, R, 150)
    wedge(c, 230, 150)
    rule(c, 260, 150, 450, [150, 270, 450])
    label(c, '300', 150, 270, 260)
    label(c, '450', 270, 450, 260)
    const r = run(c)
    expect((lineAt(r, 260).marks ?? []).map((m) => m.class)).toEqual(['TICK', 'TICK', 'TICK'])
    expect(markAt(lineAt(r, 150), 230)?.class).toBe('REJECTED')
    expect(r.solution.confidence).toBe('SUPPORTED')
    expect(near(r.metric.pooledScale, SCALE)).toBe(true)
  })
})

describe('§43 negative: a total that disagrees with its children', () => {
  const conflicting = (witness: boolean): Canvas => {
    const c = new Canvas(900, 360)
    rule(c, 150, L, R, [L, 300, R])
    label(c, '500', L, 300, 150)
    label(c, '700', 300, R, 150)
    rule(c, 112, L, R, [L, R])
    label(c, '1400', L, R, 112)
    if (witness) {
      rule(c, 300, 200, 520, [200, 520])
      label(c, '800', 200, 520, 300)
    }
    return c
  }

  it('is recorded as a conflict as read and, with nothing outside the pair to decide, leaves the scale INCONCLUSIVE — never forced consistent', () => {
    const r = run(conflicting(false))
    const conflict = r.metric.relations.find((x) => x.kind === 'CONFLICTS_WITH')
    expect(conflict?.sum).toMatchObject({ totalCm: 1400, partsCm: 1200, agrees: false })
    expect(r.solution.topology?.hierarchy).toMatchObject({ conflictsAsRead: 1, undecidedConflict: true })
    expect(r.solution.confidence).toBe('INCONCLUSIVE')
    // Neither side's reading is rewritten to agree with the other.
    for (const text of ['1400', '500', '700']) expect(r.metric.observations.some((o) => o.rawText === text && o.binding?.role === 'PRIMARY')).toBe(true)
  })

  it('an independent reading on another chain decides it, and the conflict stays on the record', () => {
    const r = run(conflicting(true))
    expect(r.metric.relations.some((x) => x.kind === 'CONFLICTS_WITH')).toBe(true)
    expect(r.solution.topology?.hierarchy?.undecidedConflict).toBeUndefined()
    expect(near(selectedScale(r), SCALE)).toBe(true)
    expect(r.solution.confidence).toBe('SUPPORTED')
    expect(r.metric.observations.find((o) => o.rawText === '1400' && o.binding?.role === 'PRIMARY')?.status).toBe('REJECTED')
  })
})

// ---------------------------------------------------------------------------
// §41 metamorphic: the same physical drawing, imaged differently
// ---------------------------------------------------------------------------

type Grey = (x: number, y: number) => number
const greyOf = (r: Raster): Grey => (x, y) => (x < 0 || y < 0 || x >= r.width || y >= r.height ? 255 : r.data[(y * r.width + x) * 4])
const build = (width: number, height: number, f: (x: number, y: number) => number): Raster => {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const o = (y * width + x) * 4
      const v = f(x, y)
      data[o] = v
      data[o + 1] = v
      data[o + 2] = v
      data[o + 3] = 255
    }
  }
  return { width, height, data }
}
const IMAGING: Record<string, { image: (r: Raster) => Raster; factor: number }> = {
  identity: { image: (r) => r, factor: 1 },
  'downscale 0.9': { image: (r) => downscale(r, 0.9), factor: 0.9 },
  'downscale 0.8': { image: (r) => downscale(r, 0.8), factor: 0.8 },
  'anti-aliasing': {
    image: (r) => {
      const g = greyOf(r)
      return build(r.width, r.height, (x, y) => {
        let s = 0
        for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) s += g(x + dx, y + dy) * (dx === 0 && dy === 0 ? 4 : dx === 0 || dy === 0 ? 2 : 1)
        return s / 16
      })
    },
    factor: 1,
  },
  'lower contrast': { image: (r) => build(r.width, r.height, (x, y) => 70 + greyOf(r)(x, y) * 0.7), factor: 1 },
  'erosion 1px': {
    image: (r) => {
      const g = greyOf(r)
      return build(r.width, r.height, (x, y) => Math.max(g(x, y), Math.min(g(x - 1, y), g(x + 1, y)), Math.min(g(x, y - 1), g(x, y + 1))))
    },
    factor: 1,
  },
  'dilation 1px': {
    image: (r) => {
      const g = greyOf(r)
      return build(r.width, r.height, (x, y) => Math.min(g(x, y), g(x + 1, y), g(x, y + 1)))
    },
    factor: 1,
  },
  'padding 40px': { image: (r) => build(r.width + 80, r.height + 80, (x, y) => greyOf(r)(x - 40, y - 40)), factor: 1 },
  'crop 30px': { image: (r) => build(r.width - 60, r.height - 60, (x, y) => greyOf(r)(x + 30, y + 30)), factor: 1 },
}
function downscale(r: Raster, f: number): Raster {
  const g = greyOf(r)
  return build(Math.round(r.width * f), Math.round(r.height * f), (x, y) => {
    const [x0, y0, x1, y1] = [x / f, y / f, (x + 1) / f, (y + 1) / f]
    let s = 0
    let n = 0
    for (let yy = Math.floor(y0); yy < Math.ceil(y1); yy += 1) {
      for (let xx = Math.floor(x0); xx < Math.ceil(x1); xx += 1) {
        const w = (Math.min(xx + 1, x1) - Math.max(xx, x0)) * (Math.min(yy + 1, y1) - Math.max(yy, y0))
        if (w <= 0) continue
        s += g(xx, yy) * w
        n += w
      }
    }
    return s / n
  })
}
/** The sheet every imaging is applied to: an overall chain with a spurious mark, and a two-part chain beside it. */
const sheet = (options: { crossing?: boolean; swapped?: boolean } = {}): Canvas => {
  const c = new Canvas(900, 360)
  const [yTotal, yParts] = options.swapped ? [260, 150] : [150, 260]
  rule(c, yTotal, L, R, [L, R])
  label(c, '1200', L, R, yTotal)
  wedge(c, 230, yTotal)
  rule(c, yParts, 150, 450, [150, 270, 450])
  label(c, '300', 150, 270, yParts)
  label(c, '450', 270, 450, yParts)
  if (options.crossing) c.line(400, 120, 420, 290, 1, 140)
  return c
}

describe('§41 metamorphic: one physical drawing, imaged differently', () => {
  const base = analyse(sheet().toRaster())

  it('the reference imaging reads the overall and both parts at one scale, and rejects the spurious mark', () => {
    expect(base.solution.confidence).toBe('SUPPORTED')
    expect(near(base.metric.pooledScale, SCALE)).toBe(true)
    expect(base.lines.flatMap((l) => l.marks ?? []).filter((m) => m.class === 'REJECTED')).toHaveLength(1)
  })

  /**
   * The imagings whose scale the reader cannot recover, declared, not hidden. None since 005E: under a 3×3 blur the 005D
   * reader read the overall `1200` as `1100` with no bounded alternative holding the true digit, and a wrong scale was
   * adopted at WEAK. The lattice reads it `1700`, AMBIGUOUS, and the part label `700` (printed 300), AMBIGUOUS too —
   * and their own best alternatives, `1200` and `300`, agree on the true scale; a deciding set of coin tosses whose
   * alternatives state another scale replaces nothing (post-review C P1), so no scale is adopted and the clause holds.
   * The set stays, so a reader limit found later is declared here and not hidden.
   */
  const READER_LIMITS = new Set<string>([])

  for (const [name, { image, factor }] of Object.entries(IMAGING)) {
    it(`${name}: the same physical topology, or no lines at all`, () => {
      const r = analyse(image(sheet().toRaster()))
      for (const line of r.lines) {
        const ms = line.marks ?? []
        if (ms.length === 0) continue
        expect(ms[0].class, `${name}: first mark of ${line.baselinePx}`).not.toBe('REJECTED')
        expect(ms[ms.length - 1].class, `${name}: last mark of ${line.baselinePx}`).not.toBe('REJECTED')
      }
      const shift = name === 'padding 40px' ? 40 : name === 'crop 30px' ? -30 : 0
      for (const m of r.lines.flatMap((l) => l.marks ?? []).filter((m) => Math.abs(m.atPx - 230 * factor - shift) <= 3)) expect(m.class, `${name}: spurious mark`).not.toBe('TICK')
    })

    // Scale: the physical scale (in this imaging's pixels), or no decision at all. A wrong scale may never be
    // adopted, at any confidence (post-review D P0-1): if it is not right, the solution neither replaces nor adds
    // a scale, and says it is INCONCLUSIVE.
    const scaleClause = (): void => {
      const r = analyse(image(sheet().toRaster()))
      const right = near(r.metric.pooledScale, SCALE / factor, 0.015)
      if (right) return
      const said = `${name}: ${r.metric.pooledScale} ${r.solution.relation}/${r.solution.confidence}`
      expect(['REPLACED', 'ADDED'], said).not.toContain(r.solution.relation)
      expect(r.solution.confidence, said).toBe('INCONCLUSIVE')
    }
    if (READER_LIMITS.has(name)) it.fails(`${name}: KNOWN READER LIMIT — the scale clause fails (the overall is misread with no bounded alternative)`, scaleClause)
    else it(`${name}: the same scale, or no scale adopted`, scaleClause)
  }

  it('an extra non-semantic crossing line changes nothing that was decided', () => {
    const r = analyse(sheet({ crossing: true }).toRaster())
    expect(r.solution.confidence).toBe(base.solution.confidence)
    expect(r.metric.pooledScale).toBe(base.metric.pooledScale)
    expect(r.lines.flatMap((l) => l.marks ?? []).filter((m) => m.class === 'REJECTED')).toHaveLength(1)
  })

  it('reordered equivalent copies: the same chains in another order on the sheet decide the same scale', () => {
    const r = analyse(sheet({ swapped: true }).toRaster())
    expect(r.solution.confidence).toBe(base.solution.confidence)
    expect(r.metric.pooledScale).toBe(base.metric.pooledScale)
    expect(r.solution.relation).toBe(base.solution.relation)
  })
})
