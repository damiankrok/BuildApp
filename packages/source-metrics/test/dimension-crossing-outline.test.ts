import { describe, expect, it } from 'vitest'
import { Canvas } from '@buildapp/synthetic-drawings'
import { adaptiveInkMask, inkChannel } from '@buildapp/source-cv'
import type { Raster } from '@buildapp/source-cv'
import { chainId, chainsFromLines, dimensionLabelLattices, findDimensionLines, readNumbers, solveFrameChains, solveFrameMetric } from '../src/index.js'
import type { DimensionLine, DimensionObservation } from '../src/index.js'

/**
 * EXTERIOR-COMPLETE (Zefiranty G2 ver. 2, plan 83d37a0d4e): a rounded rear bay is drawn as a double arc that crosses
 * both of the plan's top dimension lines. Every crossing was found as a mark and kept as a TICK, so the overall
 * "1452", printed inside the arc, bound to the arc's own interval (~131 px, ~11 cm/px) and the "1142" beneath it
 * likewise: the sheet stated no scale and the plan resolution was inconclusive. A tick ends within its reach; the
 * arc runs on, on both sides of the line, and slants. A witness line also runs on, but square to the line: it
 * stays a mark.
 */
const FRAME = 'frame-crossing-outline'
const SCALE = 2.5
const CAP = 16
const L = 100
const R = 580 // 1200 cm at 2.5 cm/px

function analyse(raster: Raster) {
  const grey = inkChannel(raster)
  const mask = adaptiveInkMask(grey, {})
  const lines = findDimensionLines(mask, { raster, grey })
  const chains = chainsFromLines(lines)
  const read = readNumbers(raster, { hypotheses: true, retainPasses: true })
  const legacy = solveFrameChains(chains, read.tokens, { tolerancePx: 2.2 })
  const ids = chains.map((c) => chainId(FRAME, c.axis, c.baselinePx, c.ticks.map((t) => t.atPx)))
  const lattices = new Map([...dimensionLabelLattices(read, chains, raster)].map(([t, lattice], i) => [t, { id: `lattice-${i}`, lattice }]))
  const metric = solveFrameMetric({ frameId: FRAME, assetId: 'asset', chains, chainIds: ids, raw: read.raw ?? read.tokens, legacyTokens: read.tokens, legacy, tolerancePx: 2.2, lattices })
  return { lines, metric }
}
type Run = ReturnType<typeof analyse>

function rule(c: Canvas, y: number, x0: number, x1: number, ticks: number[]): void {
  c.line(x0, y, x1, y, 1)
  for (const t of ticks) c.tick(t, y, 'HORIZONTAL')
}
function label(c: Canvas, text: string, from: number, to: number, y: number): void {
  const w = c.textWidth(text, CAP)
  c.text(text, (from + to) / 2 - w / 2, y - CAP - 5, CAP, { slant: 0.18 })
}
/** The upper half of a circle as short chords, its ends running on straight down: a rounded bay's wall line. */
function bay(c: Canvas, cx: number, cy: number, r: number, downTo: number): void {
  const n = 96
  for (let i = 0; i < n; i += 1) {
    const a0 = (Math.PI * i) / n
    const a1 = (Math.PI * (i + 1)) / n
    c.line(cx + r * Math.cos(a0), cy - r * Math.sin(a0), cx + r * Math.cos(a1), cy - r * Math.sin(a1), 1)
  }
  c.line(cx - r, cy, cx - r, downTo, 1)
  c.line(cx + r, cy, cx + r, downTo, 1)
}
/** The overall over a 200 | 800 | 200 chain, as the plan prints them. */
function sheet(c: Canvas): void {
  rule(c, 112, L, R, [L, R])
  label(c, '1200', L, R, 112)
  rule(c, 150, L, R, [L, 180, 500, R])
  label(c, '200', L, 180, 150)
  label(c, '800', 180, 500, 150)
  label(c, '200', 500, R, 150)
}
const lineAt = (r: Run, y: number): DimensionLine => {
  const line = r.lines.find((l) => l.axis === 'HORIZONTAL' && Math.abs(l.baselinePx - y) < 2)
  if (!line) throw new Error(`no line at ${y}`)
  return line
}
const marksNear = (line: DimensionLine, x: number) => (line.marks ?? []).filter((m) => Math.abs(m.atPx - x) <= 3)
const primary = (r: Run, text: string): DimensionObservation[] => r.metric.observations.filter((o) => o.rawText === text && o.binding?.role === 'PRIMARY')
const spans = (r: Run, text: string): string[] => primary(r, text).map((o) => `${Math.round(o.fromPx)}-${Math.round(o.toPx)}`)
const near = (a: number | undefined, b: number, rel = 0.01): boolean => a !== undefined && Math.abs(a / b - 1) <= rel

describe('EXTERIOR-COMPLETE: an outline drawn across a dimension line is not a mark on it', () => {
  it('a rounded bay crossing both top lines: its crossings are REJECTED, the overall keeps its ends and the sheet its scale', () => {
    const c = new Canvas(900, 320)
    sheet(c)
    bay(c, 340, 190, 115, 280)
    bay(c, 340, 190, 105, 280)
    const r = run(c)
    // Where each arc crosses the overall's line (78 px above the centre) and the chain's (40 px above).
    for (const [y, xs] of [
      [112, [340 - 84, 340 - 70, 340 + 70, 340 + 84]],
      [150, [340 - 108, 340 - 97, 340 + 97, 340 + 108]],
    ] as const) {
      for (const x of xs) {
        const found = marksNear(lineAt(r, y), x)
        expect(found.length, `a mark at ${x} on ${y}`).toBeGreaterThan(0)
        for (const m of found) {
          expect(m.class).toBe('REJECTED')
          expect(m.reasons).toContain('CROSSING_OUTLINE')
        }
      }
    }
    // Nothing between the two arcs is a tick either: where the outer arc meets the line from above and the inner one
    // from below at the same position, that is one more crossing, not a mark.
    for (const y of [112, 150]) expect((lineAt(r, y).marks ?? []).filter((m) => m.atPx > L + 3 && m.atPx < R - 3 && (y === 112 || ![180, 500].some((x) => Math.abs(m.atPx - x) <= 3))).map((m) => m.class).filter((c) => c === 'TICK')).toEqual([])
    // The real ticks are untouched.
    for (const x of [L, R]) expect(marksNear(lineAt(r, 112), x).map((m) => m.class)).toEqual(['TICK'])
    for (const x of [L, 180, 500, R]) expect(marksNear(lineAt(r, 150), x).map((m) => m.class)).toEqual(['TICK'])
    expect(spans(r, '1200')).toEqual(['101-580'])
    expect(spans(r, '800')).toEqual(['180-500'])
    expect(near(r.metric.pooledScale, SCALE)).toBe(true)
  })

  it('a splayed wall crossing the line at a slant is not a mark either', () => {
    const c = new Canvas(900, 320)
    sheet(c)
    c.line(300, 60, 360, 240, 1)
    const r = run(c)
    const at = 300 + (60 * (112 - 60)) / 180
    expect(marksNear(lineAt(r, 112), at).map((m) => m.class)).toEqual(['REJECTED'])
    expect(spans(r, '1200')).toEqual(['101-580'])
    expect(near(r.metric.pooledScale, SCALE)).toBe(true)
  })

  it('garden chairs drawn over the chain (small closed outlines cutting the line): not marks, the chain keeps its parts', () => {
    const c = new Canvas(900, 320)
    sheet(c)
    // two chairs, rings of radius 20 (0.5 m at the sheet scale) the line cuts nearly through, either side of the 800's middle
    for (const [cx, cy] of [
      [300, 148],
      [380, 152],
    ] as const) {
      const n = 48
      for (let i = 0; i < n; i += 1) {
        const a0 = (2 * Math.PI * i) / n
        const a1 = (2 * Math.PI * (i + 1)) / n
        c.line(cx + 20 * Math.cos(a0), cy + 20 * Math.sin(a0), cx + 20 * Math.cos(a1), cy + 20 * Math.sin(a1), 1)
      }
    }
    const r = run(c)
    for (const x of [300 - 20, 300 + 20, 380 - 20, 380 + 20]) for (const m of marksNear(lineAt(r, 150), x)) expect(m.class, `mark at ${m.atPx}`).toBe('REJECTED')
    expect(spans(r, '800')).toEqual(['180-500'])
    expect(near(r.metric.pooledScale, SCALE)).toBe(true)
  })

  it('counter-case: a witness line square to the lines, running on through the inner one, stays a mark', () => {
    const c = new Canvas(900, 320)
    sheet(c)
    // The extension line of the 500 tick, drawn from the building up past both lines.
    c.line(500, 100, 500, 240, 1)
    const r = run(c)
    expect(marksNear(lineAt(r, 150), 500).map((m) => m.class)).toEqual(['TICK'])
    expect(marksNear(lineAt(r, 150), 500)[0].reasons).not.toContain('CROSSING_OUTLINE')
    expect(spans(r, '800')).toEqual(['180-500'])
    expect(near(r.metric.pooledScale, SCALE)).toBe(true)
  })

  it('counter-case: a window jamb drawn across the chain, jogging a few pixels at its frame and then running on straight, stays a mark', () => {
    const c = new Canvas(900, 320)
    sheet(c)
    // below the line the jamb runs straight down; above it, it steps 4 px aside over 6 px and then runs straight up
    c.line(500, 150, 500, 210, 1)
    c.line(500, 150, 504, 144, 1)
    c.line(504, 144, 504, 90, 1)
    const r = run(c)
    expect(marksNear(lineAt(r, 150), 500).map((m) => m.class)).not.toContain('REJECTED')
    const [span] = primary(r, '800')
    expect(Math.abs(span.toPx - 500)).toBeLessThanOrEqual(1.5)
    expect(near(r.metric.pooledScale, SCALE)).toBe(true)
  })

  it('counter-case: a tick on an extension line that runs long on one side only (from the building) stays a tick', () => {
    const c = new Canvas(900, 320)
    sheet(c)
    c.line(180, 154, 180, 260, 1)
    c.line(500, 154, 500, 260, 1)
    const r = run(c)
    for (const x of [L, 180, 500, R]) expect(marksNear(lineAt(r, 150), x).map((m) => m.class)).toEqual(['TICK'])
    // The extension line and its slash are one end (within a pixel, as in the topology suite's case 13).
    const [span] = primary(r, '800')
    expect(Math.abs(span.fromPx - 180)).toBeLessThanOrEqual(1.5)
    expect(Math.abs(span.toPx - 500)).toBeLessThanOrEqual(1.5)
    expect(near(r.metric.pooledScale, SCALE)).toBe(true)
  })
})

const run = (c: Canvas): Run => analyse(c.toRaster())
