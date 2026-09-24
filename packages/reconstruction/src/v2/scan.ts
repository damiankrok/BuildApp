/**
 * Raster scans for the v2 passes.
 *
 * Small, deterministic pixel readers over a decoded plan or render: ink runs
 * along a row or a column, the pieces of a wall band along a line, the ladder
 * of thin parallel strokes a stair draws, the colour classes of a render. They
 * know nothing about buildings; every threshold is stated in pixels of the
 * drawing's own wall thickness or in metres through a frame the caller owns.
 */
import type { Raster } from '@buildapp/source-cv'

export type Run = { from: number; to: number }

/** Luma at a pixel, 0..255; outside the raster reads as white. */
export function lumaAt(r: Raster, x: number, y: number): number {
  const xi = Math.round(x)
  const yi = Math.round(y)
  if (xi < 0 || yi < 0 || xi >= r.width || yi >= r.height) return 255
  const o = (yi * r.width + xi) * 4
  return 0.299 * r.data[o] + 0.587 * r.data[o + 1] + 0.114 * r.data[o + 2]
}

export function rgbAt(r: Raster, x: number, y: number): [number, number, number] {
  const xi = Math.round(x)
  const yi = Math.round(y)
  if (xi < 0 || yi < 0 || xi >= r.width || yi >= r.height) return [255, 255, 255]
  const o = (yi * r.width + xi) * 4
  return [r.data[o], r.data[o + 1], r.data[o + 2]]
}

/** Runs of pixels darker than `threshold` along one row (axis X) or one column (axis Y), within `[from, to]`. */
export function inkRuns(r: Raster, axis: 'X' | 'Y', at: number, from: number, to: number, threshold = 90, minRun = 1): Run[] {
  const out: Run[] = []
  let start: number | undefined
  const lo = Math.max(0, Math.floor(from))
  const hi = Math.min(axis === 'X' ? r.width - 1 : r.height - 1, Math.ceil(to))
  for (let i = lo; i <= hi + 1; i += 1) {
    const dark = i <= hi && (axis === 'X' ? lumaAt(r, i, at) : lumaAt(r, at, i)) < threshold
    if (dark && start === undefined) start = i
    if (!dark && start !== undefined) {
      if (i - start >= minRun) out.push({ from: start, to: i - 1 })
      start = undefined
    }
  }
  return out
}

/**
 * The pieces of a wall along a line: runs of ink at least `minThick` thick
 * ACROSS the line, sampled every pixel ALONG it. A wall band interrupted by a
 * door reads as two pieces with a gap between them.
 */
export function bandPieces(r: Raster, axis: 'X' | 'Y', linePx: number, from: number, to: number, halfThick: number, minThick: number, threshold = 90): Run[] {
  const solid: boolean[] = []
  const lo = Math.floor(from)
  const hi = Math.ceil(to)
  for (let i = lo; i <= hi; i += 1) {
    // Across the line: how many dark pixels within ±halfThick.
    let dark = 0
    for (let d = -Math.ceil(halfThick); d <= Math.ceil(halfThick); d += 1) {
      const l = axis === 'X' ? lumaAt(r, i, linePx + d) : lumaAt(r, linePx + d, i)
      if (l < threshold) dark += 1
    }
    solid.push(dark >= minThick)
  }
  const out: Run[] = []
  let start: number | undefined
  for (let k = 0; k <= solid.length; k += 1) {
    const s = k < solid.length && solid[k]
    if (s && start === undefined) start = lo + k
    if (!s && start !== undefined) {
      out.push({ from: start, to: lo + k - 1 })
      start = undefined
    }
  }
  return out
}

/** Merge runs separated by gaps of at most `maxGap`. */
export function mergeRuns(runs: readonly Run[], maxGap: number): Run[] {
  const sorted = [...runs].sort((a, b) => a.from - b.from)
  const out: Run[] = []
  for (const run of sorted) {
    const last = out[out.length - 1]
    if (last && run.from <= last.to + maxGap + 1) last.to = Math.max(last.to, run.to)
    else out.push({ ...run })
  }
  return out
}

/** Gaps between consecutive runs within `[from, to]`, at least `minGap` wide. */
export function gapsBetween(runs: readonly Run[], from: number, to: number, minGap: number): Run[] {
  const out: Run[] = []
  let cursor = from
  for (const run of [...runs].sort((a, b) => a.from - b.from)) {
    if (run.from - cursor >= minGap) out.push({ from: cursor, to: run.from - 1 })
    cursor = Math.max(cursor, run.to + 1)
  }
  if (to - cursor + 1 >= minGap) out.push({ from: cursor, to })
  return out
}

/**
 * Thin dark strokes crossing a scan line, the way a stair's tread lines cross
 * the walking line. A stroke is a run of at most `maxWidth` pixels that is at
 * least `contrast` darker than the LOCAL BACKGROUND — the upper quartile of a
 * window `reach` pixels wide around it — so a line drawn over a shaded floor
 * is found as readily as one drawn on white. Returns the centre of each.
 */
export function thinStrokesAlong(r: Raster, axis: 'X' | 'Y', at: number, from: number, to: number, options: { dark?: number; contrast?: number; reach?: number; maxWidth?: number } = {}): number[] {
  const dark = options.dark ?? 215
  const contrast = options.contrast ?? 18
  const reach = options.reach ?? 6
  const maxWidth = options.maxWidth ?? 4
  const lo = Math.floor(from)
  const hi = Math.ceil(to)
  if (hi < lo) return []
  const values: number[] = []
  for (let i = lo; i <= hi; i += 1) values.push(axis === 'X' ? lumaAt(r, i, at) : lumaAt(r, at, i))
  const n = values.length
  // Local background: the 75th percentile of the window.
  const background = new Float64Array(n)
  for (let k = 0; k < n; k += 1) {
    const w: number[] = []
    for (let d = -reach; d <= reach; d += 1) {
      const j = k + d
      if (j >= 0 && j < n) w.push(values[j])
    }
    w.sort((a, b) => a - b)
    background[k] = w[Math.min(w.length - 1, Math.floor(w.length * 0.75))]
  }
  const centres: number[] = []
  let k = 0
  while (k < n) {
    const isStroke = values[k] < dark && values[k] <= background[k] - contrast
    if (isStroke) {
      let j = k
      while (j + 1 < n && values[j + 1] < dark && values[j + 1] <= background[j + 1] - contrast) j += 1
      const width = j - k + 1
      if (width <= maxWidth) centres.push(lo + (k + j) / 2)
      k = j + 1
    } else k += 1
  }
  return centres
}

/** Mean luma of a rectangle. */
export function meanLuma(r: Raster, x0: number, y0: number, x1: number, y1: number): number {
  let sum = 0
  let n = 0
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(r.height - 1, Math.ceil(y1)); y += 1) {
    for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(r.width - 1, Math.ceil(x1)); x += 1) {
      sum += lumaAt(r, x, y)
      n += 1
    }
  }
  return n === 0 ? 255 : sum / n
}

/** Fraction of pixels in a rectangle darker than `threshold`. */
export function inkFraction(r: Raster, x0: number, y0: number, x1: number, y1: number, threshold = 90): number {
  let dark = 0
  let n = 0
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(r.height - 1, Math.ceil(y1)); y += 1) {
    for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(r.width - 1, Math.ceil(x1)); x += 1) {
      if (lumaAt(r, x, y) < threshold) dark += 1
      n += 1
    }
  }
  return n === 0 ? 0 : dark / n
}

/**
 * Material classes of a rendered elevation pixel. Rendering-agnostic in the
 * sense that it names tones, not materials: a light neutral, a dark neutral,
 * a mid neutral, a warm (timber-like) tone, a cool (glass/sky-like) tone,
 * vegetation, or other.
 */
export type ToneClass = 'LIGHT' | 'DARK' | 'MID' | 'WARM' | 'COOL' | 'GREEN' | 'OTHER'

export function toneClass(rgb: readonly [number, number, number]): ToneClass {
  const [r, g, b] = rgb
  const L = (r + g + b) / 3
  const mx = Math.max(r, g, b)
  const mn = Math.min(r, g, b)
  const sat = mx === 0 ? 0 : (mx - mn) / mx
  if (g > r + 10 && g > b + 10) return 'GREEN'
  if (L > 200 && sat < 0.12) return 'LIGHT'
  if (L < 75 && sat < 0.25) return 'DARK'
  if (r > g + 15 && g > b + 5 && L > 90) return 'WARM'
  if (b > r + 15 && L > 90) return 'COOL'
  if (L >= 75 && L < 200 && sat < 0.2) return 'MID'
  return 'OTHER'
}

/** Runs of one tone class along a row (axis X) or a column (axis Y). */
export function toneRuns(r: Raster, axis: 'X' | 'Y', at: number, from: number, to: number): Array<Run & { tone: ToneClass }> {
  const out: Array<Run & { tone: ToneClass }> = []
  let start: number | undefined
  let current: ToneClass | undefined
  const lo = Math.max(0, Math.floor(from))
  const hi = Math.min(axis === 'X' ? r.width - 1 : r.height - 1, Math.ceil(to))
  for (let i = lo; i <= hi; i += 1) {
    const tone = toneClass(axis === 'X' ? rgbAt(r, i, at) : rgbAt(r, at, i))
    if (tone !== current) {
      if (current !== undefined && start !== undefined) out.push({ from: start, to: i - 1, tone: current })
      current = tone
      start = i
    }
  }
  if (current !== undefined && start !== undefined) out.push({ from: start, to: hi, tone: current })
  return out
}

/** The dominant tone class in a rectangle, with its share. */
export function dominantTone(r: Raster, x0: number, y0: number, x1: number, y1: number, step = 1): { tone: ToneClass; share: number } {
  const counts = new Map<ToneClass, number>()
  let n = 0
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(r.height - 1, Math.ceil(y1)); y += step) {
    for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(r.width - 1, Math.ceil(x1)); x += step) {
      const t = toneClass(rgbAt(r, x, y))
      counts.set(t, (counts.get(t) ?? 0) + 1)
      n += 1
    }
  }
  let best: ToneClass = 'OTHER'
  let bestN = -1
  for (const [t, c] of counts) if (c > bestN) { best = t; bestN = c }
  return { tone: best, share: n === 0 ? 0 : bestN / n }
}

/** Median of a list. */
export const median = (xs: readonly number[]): number => {
  if (xs.length === 0) return Number.NaN
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Cluster sorted values that lie within `tolerance` of the running cluster mean. */
export function cluster1d(values: readonly number[], tolerance: number): Array<{ centre: number; members: number[] }> {
  const sorted = [...values].sort((a, b) => a - b)
  const out: Array<{ centre: number; members: number[] }> = []
  for (const v of sorted) {
    const last = out[out.length - 1]
    if (last && Math.abs(v - last.centre) <= tolerance) {
      last.members.push(v)
      last.centre = last.members.reduce((a, b) => a + b, 0) / last.members.length
    } else out.push({ centre: v, members: [v] })
  }
  return out
}
