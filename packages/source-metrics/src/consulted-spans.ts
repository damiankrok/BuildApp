/**
 * v3.54.2 pilot (off by default): a consultant's reading of a whole printed DIMENSION — its literal and the two ends of
 * the span it measures — for the dimensions the analyzer did not find as dimensions (no label read, a fragment of its
 * line, no line at all, a feet-inch label its digit readers cannot read).
 *
 * The consultant's coordinates are a pointer, never a measurement: each end is snapped to an ink stroke of the plan
 * itself (an extension line or a tick crossing the dimension line), so the pixel span is the analyzer's own. The value is
 * parsed by the analyzer (`dimensionValueOf`, and here feet-inches). A scale is admitted only when two consulted
 * dimensions on different lines agree within `DISTINCT_RATIO_SPANS` — the standard the resolver applies to its own
 * readings (two readings on different chains that agree) — and the plan's own plausibility check accepts it. It never
 * overrules a scale the analyzer's own readings settle (STRONG/SUPPORTED): there it can only confirm or be refused.
 */
import type { Gray } from '@buildapp/source-cv'
import { dimensionValueOf } from './numeric-lattice.js'

export const CONSULTED_SPANS_NAME = 'metrics.consulted-spans' as const
export const CONSULTED_SPANS_VERSION = '0.2.0' as const
/** Two scales within this log ratio are one scale (the metric solver's DISTINCT_RATIO). */
export const DISTINCT_RATIO_SPANS = 0.03
/** How far (px) from the consultant's end a stroke is looked for, and how long a stroke must be. */
// v3.54.2 stage C: ink < 200 — dimension ticks and extension lines are printed light grey on ARCHON sheets (first value 140 missed them)
// lineInk: a thin anti-aliased line at a low reading size is grey down to ~235; its continuity (not its ends) is read so
export const SNAP = { searchPx: 12, halfHeightPx: 12, minStrokePx: 9, ink: 200, lineInk: 235, minSpanPx: 60 } as const

export type Point = { x: number; y: number }
export type ConsultedSpan = {
  proposalId: string
  frameId: string
  literal: string
  unit: 'cm' | 'm' | 'mm' | 'ft-in'
  from: Point
  to: Point
  consultant: { engine: string; model: string; requestId?: string }
}
export type SnappedSpan = { proposalId: string; axis: 'X' | 'Y'; valueCm: number; fromPx: number; toPx: number; atPx: number; lengthPx: number; cmPerPx: number }
/** `axis`, `fromPx`, `toPx`, `atPx` (v3.54.3): where the analyzer measured the dimension on the plan — the two snapped ends and its line — so a consumer compares like with like. */
export type SpanOutcome = { proposalId: string; status: 'ADMITTED' | 'AGREES_ONLY' | 'REFUSED'; why: string; valueCm?: number; lengthPx?: number; cmPerPx?: number; axis?: 'X' | 'Y'; fromPx?: number; toPx?: number; atPx?: number }

const FT_IN = /^(\d{1,3})\s*['′]\s*-?\s*(?:(\d{1,2}(?:\.\d+)?|\d{1,2}\s+\d\/\d)\s*(?:["″]|''))?$/

/** A printed length in centimetres, by the analyzer's own rules: cm / decimal metres via `dimensionValueOf`, feet-inches exactly. */
export function lengthCmOf(literal: string, unit: ConsultedSpan['unit']): number | undefined {
  const t = literal.trim()
  if (unit === 'ft-in') {
    const m = FT_IN.exec(t)
    if (!m) return undefined
    const inchText = (m[2] ?? '0').trim()
    const inches = inchText.includes('/') ? (([w, f]) => Number(w) + (([n, d]) => Number(n) / Number(d))(f.split('/')))(inchText.split(/\s+/)) : Number(inchText)
    if (!(inches < 12)) return undefined
    return Math.round((Number(m[1]) * 12 + inches) * 2.54 * 1e4) / 1e4
  }
  if (!/^[0-9]{1,5}([.,][0-9]{1,3})?$/.test(t)) return undefined
  const decimal = /[.,]/.test(t)
  if ((unit === 'cm' && decimal) || (unit === 'm' && !decimal)) return undefined
  if (unit === 'mm') return decimal ? undefined : Number(t) / 10
  return dimensionValueOf(t)
}

/** The strongest stroke across the dimension line near `at` (a column for a horizontal span, a row for a vertical one). */
function strokeNear(gray: Gray, axis: 'X' | 'Y', at: number, line: number): { pos: number; length: number } | undefined {
  let best: { pos: number; length: number } | undefined
  for (let d = -SNAP.searchPx; d <= SNAP.searchPx; d += 1) {
    const p = Math.round(at + d)
    let run = 0
    let longest = 0
    for (let o = -SNAP.halfHeightPx; o <= SNAP.halfHeightPx; o += 1) {
      const q = Math.round(line + o)
      const [x, y] = axis === 'X' ? [p, q] : [q, p]
      const dark = x >= 0 && y >= 0 && x < gray.width && y < gray.height && gray.data[y * gray.width + x] < SNAP.ink
      run = dark ? run + 1 : 0
      longest = Math.max(longest, run)
    }
    if (longest >= SNAP.minStrokePx && (!best || longest > best.length || (longest === best.length && Math.abs(p - at) < Math.abs(best.pos - at)))) best = { pos: p, length: longest }
  }
  return best
}

/**
 * Where the dimension line itself ends near `at` (fallback when its ends carry dots or arrows but no stroke across):
 * the outermost ink pixel on the line (±1 px) within the search window whose inward neighbourhood is line ink. `inward`
 * is +1 for the first end (the line runs on towards larger coordinates) and −1 for the second.
 */
function lineEndNear(gray: Gray, axis: 'X' | 'Y', at: number, line: number, inward: 1 | -1): number | undefined {
  const inkAt = (p: number): boolean => {
    for (let o = -1; o <= 1; o += 1) {
      const q = Math.round(line + o)
      const [x, y] = axis === 'X' ? [p, q] : [q, p]
      if (x >= 0 && y >= 0 && x < gray.width && y < gray.height && gray.data[y * gray.width + x] < SNAP.lineInk) return true
    }
    return false
  }
  let best: number | undefined
  for (let d = -SNAP.searchPx; d <= SNAP.searchPx; d += 1) {
    const p = Math.round(at + d)
    if (!inkAt(p)) continue
    let inward8 = 0
    for (let k = 1; k <= 8; k += 1) if (inkAt(p + inward * k)) inward8 += 1
    let outward3 = 0
    for (let k = 1; k <= 3; k += 1) if (inkAt(p - inward * k)) outward3 += 1
    if (inward8 >= 7 && outward3 === 0 && (best === undefined || Math.abs(p - at) < Math.abs(best - at))) best = p
  }
  return best
}

/** One consulted dimension measured on the plan: parsed, axis-aligned, both ends on strokes (or, failing that, on the line's own ends). */
export function snapSpan(gray: Gray, span: ConsultedSpan): { snapped: SnappedSpan } | { refused: string } {
  const valueCm = lengthCmOf(span.literal, span.unit)
  if (valueCm === undefined || !(valueCm > 0)) return { refused: `UNPARSEABLE: "${span.literal}" in ${span.unit}` }
  const dx = Math.abs(span.to.x - span.from.x)
  const dy = Math.abs(span.to.y - span.from.y)
  const axis: 'X' | 'Y' | undefined = dx >= 4 * dy ? 'X' : dy >= 4 * dx ? 'Y' : undefined
  if (!axis) return { refused: 'NOT_AXIS_ALIGNED: a printed dimension runs along one axis of the sheet' }
  const [a, b] = axis === 'X' ? [Math.min(span.from.x, span.to.x), Math.max(span.from.x, span.to.x)] : [Math.min(span.from.y, span.to.y), Math.max(span.from.y, span.to.y)]
  const line = axis === 'X' ? (span.from.y + span.to.y) / 2 : (span.from.x + span.to.x) / 2
  if (b - a < SNAP.minSpanPx) return { refused: `TOO_SHORT: ${Math.round(b - a)} px; a span shorter than ${SNAP.minSpanPx} px states no scale worth checking` }
  const e0 = strokeNear(gray, axis, a, line)?.pos ?? lineEndNear(gray, axis, a, line, 1)
  const e1 = strokeNear(gray, axis, b, line)?.pos ?? lineEndNear(gray, axis, b, line, -1)
  if (e0 === undefined || e1 === undefined) return { refused: `SNAP_FAILED: no ink stroke across the line, and no end of a line, within ${SNAP.searchPx} px of the ${e0 === undefined ? 'first' : 'second'} end` }
  const s0 = { pos: e0 }
  const s1 = { pos: e1 }
  const lengthPx = s1.pos - s0.pos
  if (lengthPx < SNAP.minSpanPx) return { refused: 'SNAP_FAILED: the snapped ends collapse onto one stroke' }
  return { snapped: { proposalId: span.proposalId, axis, valueCm, fromPx: s0.pos, toPx: s1.pos, atPx: Math.round(line), lengthPx, cmPerPx: Math.round((valueCm / lengthPx) * 1e6) / 1e6 } }
}

/**
 * What a frame's consulted dimensions settle: the largest set of snapped spans on different lines whose scales agree
 * within DISTINCT_RATIO_SPANS (at least two), passing the plan's plausibility; or nothing, with why.
 */
export function admitSpans(snapped: readonly SnappedSpan[], plausible?: (cmPerPx: number) => boolean): { scale?: { cmPerPixelX?: number; cmPerPixelY?: number; members: SnappedSpan[] }; why: string } {
  if (snapped.length < 2) return { why: `ONE_WITNESS: ${snapped.length} consulted dimension measured; a scale needs two on different lines that agree` }
  let best: SnappedSpan[] = []
  for (const seed of snapped) {
    const group = snapped.filter((s) => Math.abs(Math.log(s.cmPerPx / seed.cmPerPx)) < DISTINCT_RATIO_SPANS)
    // different lines: distinct axis, or the same axis on a line at least 20 px away
    const lines = new Set(group.map((s) => `${s.axis}:${Math.round(s.atPx / 20)}`))
    if (lines.size >= 2 && group.length > best.length) best = group
  }
  if (best.length < 2) return { why: `NO_AGREEMENT: the consulted dimensions state ${snapped.map((s) => `${s.cmPerPx} cm/px (${s.axis})`).join(', ')}; no two on different lines agree within ${DISTINCT_RATIO_SPANS * 100} %` }
  const mean = (xs: number[]): number | undefined => (xs.length ? Math.round((xs.reduce((a, v) => a + v, 0) / xs.length) * 1e6) / 1e6 : undefined)
  const x = mean(best.filter((s) => s.axis === 'X').map((s) => s.cmPerPx))
  const y = mean(best.filter((s) => s.axis === 'Y').map((s) => s.cmPerPx))
  const any = (x ?? y) as number
  if (plausible && !plausible(any)) return { why: `IMPLAUSIBLE: ${any} cm/px makes the plan's walls a thickness no wall has` }
  return { scale: { ...(x !== undefined ? { cmPerPixelX: x } : {}), ...(y !== undefined ? { cmPerPixelY: y } : {}), members: best }, why: `${best.length} consulted dimensions on different lines agree: ${best.map((s) => `${s.valueCm} cm / ${s.lengthPx} px (${s.axis})`).join(', ')}` }
}
