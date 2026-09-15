/**
 * Straight lines: runs, axis-aligned strokes, Hough peaks and parallel families.
 *
 * A technical drawing is, almost entirely, a set of straight lines with
 * meaning attached to their ARRANGEMENT rather than to any one of them. Nine
 * parallel lines 280 mm apart are a stair; two lines meeting at a shared apex
 * are a roof; a chain of short parallels under a facade is a dimension string.
 * So the output of this file is not "edges" — it is finite segments with
 * endpoints, grouped into families, because every downstream decision (is this
 * repeated? is this parallel to that? how far apart?) needs endpoints and
 * needs groups.
 *
 * Two deliberate choices run through the whole file:
 *
 * ENDPOINTS, NOT INFINITE LINES. A Hough peak describes an infinite line and
 * says nothing about where the ink actually stops. Downstream, where a line
 * stops IS the measurement — it is the width of an opening, the run of a
 * flight, the eaves. So every peak is walked back to the pixels that voted for
 * it and cut into maximal finite runs.
 *
 * ANGLES ARE REFINED, NOT QUANTISED. A 1-degree Hough bin admits up to half a
 * degree of error, which over a 600-pixel line is a 5-pixel endpoint swing and
 * is larger than the difference this package is asked to detect ("are these
 * two families parallel?"). So each extracted segment is re-fitted by total
 * least squares to its own supporting pixels. TLS and not ordinary least
 * squares because OLS minimises vertical residuals and therefore degenerates
 * as a line approaches vertical, which in architectural drawings is not an
 * edge case but half the content.
 *
 * ENDPOINT ORDER is canonical everywhere: `a` is the lexicographically smaller
 * endpoint (`x`, then `y`). The same line always produces the same `Segment`,
 * which is what lets a caller hash one.
 */
import { angleDeltaDeg, round6, segmentAngleDeg, segmentLength } from '@buildapp/source-common'
import type { PixelPoint } from '@buildapp/source-common'
import type { Mask } from './mask.js'
import { maskAt } from './mask.js'

/**
 * A finite straight run of ink. `support` is the number of ink pixels that
 * back it — a segment with 400 supporting pixels over 400 pixels of length is
 * a solid line, one with 120 is a dashed or broken one, and the caller is
 * usually entitled to treat that ratio as a confidence.
 */
export type Segment = { a: PixelPoint; b: PixelPoint; angleDeg: number; length: number; support: number }

const DEG = Math.PI / 180

/** Order endpoints canonically: `a` before `b` by x, then y. */
function segmentOf(ax: number, ay: number, bx: number, by: number, support: number): Segment {
  const swap = bx < ax || (bx === ax && by < ay)
  const a: PixelPoint = swap ? { x: round6(bx), y: round6(by) } : { x: round6(ax), y: round6(ay) }
  const b: PixelPoint = swap ? { x: round6(ax), y: round6(ay) } : { x: round6(bx), y: round6(by) }
  return { a, b, angleDeg: segmentAngleDeg(a, b), length: segmentLength(a, b), support }
}

/** Deterministic total order over segments: nothing downstream may depend on detection order. */
const compareSegments = (p: Segment, q: Segment): number => p.angleDeg - q.angleDeg || p.a.y - q.a.y || p.a.x - q.a.x || p.b.y - q.b.y || p.b.x - q.b.x || q.support - p.support

/**
 * Maximal runs of ink along one row, tolerating gaps of up to `maxGap` unset
 * pixels. The gap tolerance is not noise-handling generosity: dashed lines,
 * hidden-detail lines and centre lines are DRAWN with gaps, and a hairline
 * that survived a JPEG at 60% quality has them too. `x0`/`x1` are inclusive
 * pixel indices, so a run covers `x1 - x0 + 1` pixels. A row outside the mask
 * yields no runs rather than throwing — callers sweep rows blindly.
 */
export function runsAlongRow(m: Mask, y: number, opts: { maxGap?: number; minRun?: number } = {}): Array<{ x0: number; x1: number }> {
  const maxGap = Math.max(0, Math.floor(opts.maxGap ?? 2))
  const minRun = Math.max(1, Math.floor(opts.minRun ?? 3))
  const out: Array<{ x0: number; x1: number }> = []
  if (!Number.isInteger(y) || y < 0 || y >= m.height) return out
  const base = y * m.width
  let start = -1
  let last = -1
  for (let x = 0; x < m.width; x++) {
    if (m.data[base + x] !== 1) continue
    if (start < 0) {
      start = x
      last = x
    } else if (x - last - 1 <= maxGap) {
      last = x
    } else {
      if (last - start + 1 >= minRun) out.push({ x0: start, x1: last })
      start = x
      last = x
    }
  }
  if (start >= 0 && last - start + 1 >= minRun) out.push({ x0: start, x1: last })
  return out
}

/** The transpose of `runsAlongRow`; `y0`/`y1` are inclusive. */
export function runsAlongCol(m: Mask, x: number, opts: { maxGap?: number; minRun?: number } = {}): Array<{ y0: number; y1: number }> {
  const maxGap = Math.max(0, Math.floor(opts.maxGap ?? 2))
  const minRun = Math.max(1, Math.floor(opts.minRun ?? 3))
  const out: Array<{ y0: number; y1: number }> = []
  if (!Number.isInteger(x) || x < 0 || x >= m.width) return out
  let start = -1
  let last = -1
  for (let y = 0; y < m.height; y++) {
    if (m.data[y * m.width + x] !== 1) continue
    if (start < 0) {
      start = y
      last = y
    } else if (y - last - 1 <= maxGap) {
      last = y
    } else {
      if (last - start + 1 >= minRun) out.push({ y0: start, y1: last })
      start = y
      last = y
    }
  }
  if (start >= 0 && last - start + 1 >= minRun) out.push({ y0: start, y1: last })
  return out
}

type AxisCluster = { lo: number; hi: number; iMin: number; iMax: number; support: number }

/**
 * Thickness of the stroke crossing sample `k`, measured ACROSS the run.
 *
 * Sampled at up to 64 positions and reduced by the median, never by the mean
 * and never at one point. A single sample lands on a corner (where two
 * perpendicular strokes cross, so the cross-section is the length of the other
 * stroke) or in a dash gap; a mean is dragged by exactly those outliers. The
 * median asks the right question: "along most of its length, is this thing
 * thin?". 64 samples is enough that the median is stable on any run long
 * enough to matter and cheap enough to run on every candidate.
 *
 * Positions where no ink is found contribute NO sample rather than a zero: a
 * gap is a missing measurement, not a measurement of zero thickness.
 */
function medianThickness(read: (i: number, k: number) => number, iMin: number, iMax: number, lo: number, hi: number, majorCount: number): number {
  const span = hi - lo
  const count = Math.min(64, span + 1)
  const ic = Math.round((iMin + iMax) / 2)
  const samples: number[] = []
  for (let s = 0; s < count; s++) {
    const k = count === 1 ? lo : lo + Math.round((s * span) / (count - 1))
    let found = -1
    for (let d = 0; d <= iMax - iMin; d++) {
      const up = ic - d
      const down = ic + d
      if (up >= iMin && read(up, k) === 1) {
        found = up
        break
      }
      if (down <= iMax && read(down, k) === 1) {
        found = down
        break
      }
    }
    if (found < 0) continue
    let t = 1
    for (let u = found - 1; u >= 0 && read(u, k) === 1; u--) t++
    for (let d = found + 1; d < majorCount && read(d, k) === 1; d++) t++
    samples.push(t)
  }
  if (samples.length === 0) return 0
  samples.sort((p, q) => p - q)
  const mid = samples.length >> 1
  return samples.length % 2 === 1 ? samples[mid] : (samples[mid - 1] + samples[mid]) / 2
}

function axisSegments(m: Mask, horizontal: boolean, minLength: number, maxThickness: number, maxGap: number): Segment[] {
  const majorCount = horizontal ? m.height : m.width
  const read = horizontal ? (i: number, k: number): number => maskAt(m, k, i) : (i: number, k: number): number => maskAt(m, i, k)
  // A row contributes only when ITS OWN run is long enough. A line that is
  // long only after several rows are stitched together is not an axis-aligned
  // line, it is a staircase, and the Hough path is the honest way to find it.
  const minRun = Math.max(2, Math.floor(minLength) + 1)
  let active: AxisCluster[] = []
  const finished: AxisCluster[] = []

  for (let i = 0; i < majorCount; i++) {
    const runs = horizontal ? runsAlongRow(m, i, { maxGap, minRun }).map((r) => [r.x0, r.x1] as const) : runsAlongCol(m, i, { maxGap, minRun }).map((r) => [r.y0, r.y1] as const)
    const next: AxisCluster[] = []
    for (const [lo, hi] of runs) {
      let support = 0
      for (let k = lo; k <= hi; k++) support += read(i, k)
      // Attach to a cluster from the previous major index when the two
      // overlap by at least half of the shorter one: that is what makes a
      // 3-pixel-thick drawn line ONE segment on its centre line instead of
      // three stacked duplicates, while a genuinely different run starting in
      // the next row stays its own thing.
      let target: AxisCluster | null = null
      for (const c of active) {
        const ov = Math.min(hi, c.hi) - Math.max(lo, c.lo) + 1
        const shorter = Math.min(hi - lo + 1, c.hi - c.lo + 1)
        if (ov > 0 && ov * 2 >= shorter) {
          target = c
          break
        }
      }
      if (target) {
        target.lo = Math.min(target.lo, lo)
        target.hi = Math.max(target.hi, hi)
        target.iMax = i
        target.support += support
        if (!next.includes(target)) next.push(target)
      } else {
        next.push({ lo, hi, iMin: i, iMax: i, support })
      }
    }
    for (const c of active) if (!next.includes(c)) finished.push(c)
    active = next
  }
  for (const c of active) finished.push(c)

  const out: Segment[] = []
  for (const c of finished) {
    if (c.hi - c.lo < minLength) continue
    const thickness = medianThickness(read, c.iMin, c.iMax, c.lo, c.hi, majorCount)
    if (thickness > maxThickness) continue
    const ic = Math.round((c.iMin + c.iMax) / 2)
    out.push(horizontal ? segmentOf(c.lo, ic, c.hi, ic, c.support) : segmentOf(ic, c.lo, ic, c.hi, c.support))
  }
  return out
}

/**
 * Horizontal and vertical strokes that are THIN along most of their length.
 *
 * This is the cheap, exact half of line detection, and it carries the single
 * most important distinction in the package: a THIN long run is a drafting
 * artefact — a dimension line, a grid line, a stair nosing, the edge of an
 * opening — whereas a THICK long run is a BAND, which in an architectural
 * drawing is a thing with real width: a wall, a slab, a frame member. Both are
 * real, but they mean different things in three dimensions, and `maxThickness`
 * is where the caller says which one it is asking for. A band rejected here is
 * not lost: `connectedComponents` still reports it, with a `fill` and an
 * aspect ratio that identify it as a band.
 *
 * Defaults: `minLength` 8 px (below that, a run is as likely to be a glyph
 * stem as a line), `maxThickness` 3 px (a drawn line survives a 2x downscale
 * and antialiasing at 3; a wall band in any drawing worth analysing is
 * thicker), `maxGap` 1 px (axis-aligned runs are found exactly, so the gap
 * tolerance is only for compression damage — dashed line reconstruction is
 * `houghSegments`'s job, where the evidence is stronger).
 *
 * Ordering is by angle, then a.y, then a.x, so horizontals precede verticals
 * and both are in reading order.
 */
export function axisAlignedSegments(m: Mask, opts: { minLength?: number; maxThickness?: number; maxGap?: number } = {}): Segment[] {
  const minLength = Math.max(1, Math.floor(opts.minLength ?? 8))
  const maxThickness = Math.max(1, opts.maxThickness ?? 3)
  const maxGap = Math.max(0, Math.floor(opts.maxGap ?? 1))
  const out = [...axisSegments(m, true, minLength, maxThickness, maxGap), ...axisSegments(m, false, minLength, maxThickness, maxGap)]
  out.sort(compareSegments)
  return out
}

type Peak = { theta: number; rhoBin: number; support: number }

/** Total-least-squares line through a set of pixels, cut to the extent of those pixels. */
function fitSegment(xs: readonly number[], ys: readonly number[]): Segment | null {
  const n = xs.length
  if (n < 2) return null
  let mx = 0
  let my = 0
  for (let i = 0; i < n; i++) {
    mx += xs[i]
    my += ys[i]
  }
  mx /= n
  my /= n
  let sxx = 0
  let syy = 0
  let sxy = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx
    const dy = ys[i] - my
    sxx += dx * dx
    syy += dy * dy
    sxy += dx * dy
  }
  // Principal axis of the scatter: the eigenvector of the covariance matrix
  // with the larger eigenvalue, in closed form. Degenerate input (a perfectly
  // isotropic blob) gives atan2(0, 0) = 0, i.e. horizontal — deterministic,
  // and such input is rejected by length anyway.
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy)
  const dx = Math.cos(theta)
  const dy = Math.sin(theta)
  let tMin = Infinity
  let tMax = -Infinity
  for (let i = 0; i < n; i++) {
    const t = (xs[i] - mx) * dx + (ys[i] - my) * dy
    if (t < tMin) tMin = t
    if (t > tMax) tMax = t
  }
  return segmentOf(mx + tMin * dx, my + tMin * dy, mx + tMax * dx, my + tMax * dy, n)
}

/** True when `q` is the same physical line as one already accepted. */
function duplicateOf(kept: readonly Segment[], q: Segment): boolean {
  for (const s of kept) {
    if (angleDeltaDeg(s.angleDeg, q.angleDeg) > 2) continue
    const ux = s.b.x - s.a.x
    const uy = s.b.y - s.a.y
    const len = Math.hypot(ux, uy)
    if (len <= 0) continue
    const nx = -uy / len
    const ny = ux / len
    const mqx = (q.a.x + q.b.x) / 2
    const mqy = (q.a.y + q.b.y) / 2
    if (Math.abs((mqx - s.a.x) * nx + (mqy - s.a.y) * ny) > 3) continue
    const ex = ux / len
    const ey = uy / len
    const ta = (q.a.x - s.a.x) * ex + (q.a.y - s.a.y) * ey
    const tb = (q.b.x - s.a.x) * ex + (q.b.y - s.a.y) * ey
    const overlap = Math.min(len, Math.max(ta, tb)) - Math.max(0, Math.min(ta, tb))
    if (overlap > 0.5 * Math.min(len, q.length)) return true
  }
  return false
}

/**
 * Hough line detection with finite segment extraction and a TLS refit.
 *
 * The accumulator is the textbook one — rho = x cos(theta) + y sin(theta),
 * theta in [0, 180) so that a line and its reverse are the same cell, rho
 * binned at one pixel — and the interesting parts are everything around it:
 *
 * PEAK SELECTION IS TOTALLY ORDERED. Cells are kept when they beat their
 * 3x3 neighbourhood (ties broken by cell index, so exactly one of a plateau
 * survives and always the same one), then sorted by support descending, rho,
 * theta. There is no "pick the top N by whatever order the scan produced".
 *
 * EXTRACTION IS FINITE. For each peak, the ink pixels within 1.5 px of the
 * line are gathered, sorted along it, and cut wherever the spacing exceeds
 * `maxGap`. 1.5 px, not 0.5: rho is quantised to a whole pixel and a
 * rasterised diagonal deviates up to half a pixel from its own ideal line, so
 * a tighter window drops the ends of exactly the long diagonals that matter.
 *
 * THE ANGLE IS REFITTED. See the file header: a half-bin of angular error is
 * bigger than the decisions this feeds.
 *
 * NEAR-DUPLICATES ARE MERGED. One drawn line votes into several adjacent
 * cells; without suppression a single roof edge arrives as five segments and
 * `parallelFamilies` reports a family that is really one line. A candidate is
 * dropped when it is within 2 degrees and 3 px of an already-accepted segment
 * and overlaps more than half of it.
 *
 * COST is O(ink pixels x angle bins) for the accumulator plus
 * O(peaks x ink pixels) for extraction. At the defaults that is 180 passes
 * over the ink; on a 4000 x 3000 scan with 5% ink that is ~100M operations and
 * several seconds. Downscale first (`downscaleGray` to 1200-2000 px) unless
 * you have measured otherwise.
 */
export function houghSegments(m: Mask, opts: { angleStepDeg?: number; minSupport?: number; maxGap?: number; minLength?: number; maxSegments?: number } = {}): Segment[] {
  const angleStepDeg = Math.max(0.1, opts.angleStepDeg ?? 1)
  const minSupport = Math.max(2, Math.floor(opts.minSupport ?? 20))
  const maxGap = Math.max(1, opts.maxGap ?? 3)
  const minLength = Math.max(1, opts.minLength ?? 20)
  const maxSegments = Math.max(1, Math.floor(opts.maxSegments ?? 400))

  const px: number[] = []
  const py: number[] = []
  for (let y = 0; y < m.height; y++) {
    const base = y * m.width
    for (let x = 0; x < m.width; x++) if (m.data[base + x] === 1) {
      px.push(x)
      py.push(y)
    }
  }
  const n = px.length
  if (n === 0) return []

  const thetaCount = Math.max(1, Math.round(180 / angleStepDeg))
  const step = 180 / thetaCount
  const cos = new Float64Array(thetaCount)
  const sin = new Float64Array(thetaCount)
  for (let t = 0; t < thetaCount; t++) {
    const a = t * step * DEG
    cos[t] = Math.cos(a)
    sin[t] = Math.sin(a)
  }
  const rhoOffset = Math.ceil(Math.hypot(m.width, m.height)) + 1
  const rhoCount = 2 * rhoOffset + 1
  const acc = new Int32Array(thetaCount * rhoCount)
  for (let i = 0; i < n; i++) {
    const x = px[i]
    const y = py[i]
    for (let t = 0; t < thetaCount; t++) {
      const r = Math.round(x * cos[t] + y * sin[t]) + rhoOffset
      if (r >= 0 && r < rhoCount) acc[t * rhoCount + r]++
    }
  }

  const peaks: Peak[] = []
  for (let t = 0; t < thetaCount; t++) {
    for (let r = 0; r < rhoCount; r++) {
      const idx = t * rhoCount + r
      const v = acc[idx]
      if (v < minSupport) continue
      let isPeak = true
      for (let dt = -1; dt <= 1 && isPeak; dt++) {
        const tt = t + dt
        if (tt < 0 || tt >= thetaCount) continue
        for (let dr = -1; dr <= 1; dr++) {
          const rr = r + dr
          if (rr < 0 || rr >= rhoCount || (dt === 0 && dr === 0)) continue
          const nIdx = tt * rhoCount + rr
          const nv = acc[nIdx]
          // strictly greater than earlier cells, at least equal to later ones:
          // exactly one cell of a plateau survives, always the same one.
          if (nv > v || (nv === v && nIdx < idx)) {
            isPeak = false
            break
          }
        }
      }
      if (isPeak) peaks.push({ theta: t, rhoBin: r, support: v })
    }
  }
  peaks.sort((p, q) => q.support - p.support || p.rhoBin - q.rhoBin || p.theta - q.theta)

  const kept: Segment[] = []
  // Four candidate peaks per wanted segment: enough that suppression and the
  // length filter still leave a full result, bounded so a noisy mask cannot
  // turn extraction into an O(peaks x pixels) blow-up.
  const peakBudget = Math.min(peaks.length, maxSegments * 4)
  const order: number[] = []
  const xs: number[] = []
  const ys: number[] = []
  for (let p = 0; p < peakBudget; p++) {
    const peak = peaks[p]
    const c = cos[peak.theta]
    const s = sin[peak.theta]
    const rho = peak.rhoBin - rhoOffset
    order.length = 0
    for (let i = 0; i < n; i++) {
      const d = px[i] * c + py[i] * s - rho
      if (d <= 1.5 && d >= -1.5) order.push(i)
    }
    if (order.length < 2) continue
    // parameter along the line; ties broken by pixel index, which is raster
    // order, so the sort is total and stable in effect.
    const u = new Float64Array(order.length)
    for (let k = 0; k < order.length; k++) u[k] = -px[order[k]] * s + py[order[k]] * c
    const byU = order.map((_, k) => k).sort((i, j) => u[i] - u[j] || order[i] - order[j])
    let runStart = 0
    for (let k = 1; k <= byU.length; k++) {
      const broken = k === byU.length || u[byU[k]] - u[byU[k - 1]] > maxGap
      if (!broken) continue
      const runLen = k - runStart
      if (runLen >= 2 && u[byU[k - 1]] - u[byU[runStart]] >= minLength) {
        xs.length = 0
        ys.length = 0
        for (let q = runStart; q < k; q++) {
          xs.push(px[order[byU[q]]])
          ys.push(py[order[byU[q]]])
        }
        const seg = fitSegment(xs, ys)
        if (seg && seg.length >= minLength && !duplicateOf(kept, seg)) kept.push(seg)
      }
      runStart = k
    }
    if (kept.length >= maxSegments * 2) break
  }

  kept.sort((p, q) => q.support - p.support || p.angleDeg - q.angleDeg || p.a.x - q.a.x || p.a.y - q.a.y || p.b.x - q.b.x || p.b.y - q.b.y)
  return kept.slice(0, maxSegments)
}

/**
 * A set of segments that share a direction.
 *
 * `spacing` is the median perpendicular gap between members that are adjacent
 * once they are ordered across the family, and it is the number that turns
 * geometry into a reading: a family of nine parallels 24 px apart in a section
 * is a flight of stairs whose rise is one ninth of the storey; a family of
 * two is just two lines. That is why `spacing` is null below three members —
 * with two you get exactly one gap, which is a distance, not a rhythm, and
 * reporting it as a "median spacing" would invite a caller to trust a sample
 * of one.
 */
export type LineFamily = { angleDeg: number; members: Segment[]; spacing: number | null }

/**
 * Group segments into parallel families.
 *
 * Grouping is seed-anchored, not chained: a segment joins a family when it is
 * within `angleToleranceDeg` of the family's FIRST member, never of its
 * nearest one. Chained (single-linkage) grouping lets a fan of segments each
 * 1.5 degrees from the last end up 30 degrees wide and still be called
 * "parallel"; anchoring bounds every family's angular width by the tolerance
 * the caller asked for (by twice it, in the one case where two groups are
 * merged across the 0/180 wrap).
 *
 * Angles are modulo 180, so the wrap at 0/180 is closed explicitly after the
 * linear pass: a family at 179.5 degrees and one at 0.5 are the same family.
 * The reported `angleDeg` is a length-weighted circular mean taken on doubled
 * angles, which is the only mean that is correct across that wrap; longer
 * members dominate it because a 400-pixel line measures its own direction far
 * better than a 12-pixel one does.
 *
 * Note for callers: members are NOT de-duplicated by position. Two coincident
 * segments contribute a near-zero gap and will pull `spacing` down; feed this
 * the output of `houghSegments` (already suppressed) or of
 * `axisAlignedSegments` (one segment per stroke) rather than a raw edge list.
 */
export function parallelFamilies(segments: readonly Segment[], opts: { angleToleranceDeg?: number; minMembers?: number } = {}): LineFamily[] {
  const tol = Math.max(0, opts.angleToleranceDeg ?? 2)
  const minMembers = Math.max(1, Math.floor(opts.minMembers ?? 2))
  if (segments.length === 0) return []

  const sorted = [...segments].sort((p, q) => p.angleDeg - q.angleDeg || p.a.x - q.a.x || p.a.y - q.a.y || p.b.x - q.b.x || p.b.y - q.b.y)
  const groups: Segment[][] = []
  for (const seg of sorted) {
    const current = groups[groups.length - 1]
    if (current && angleDeltaDeg(seg.angleDeg, current[0].angleDeg) <= tol) current.push(seg)
    else groups.push([seg])
  }
  // close the 0/180 wrap
  if (groups.length > 1) {
    const first = groups[0]
    const last = groups[groups.length - 1]
    if (angleDeltaDeg(first[0].angleDeg, last[0].angleDeg) <= tol) {
      groups.pop()
      for (const s of last) first.push(s)
    }
  }

  const families: LineFamily[] = []
  for (const members of groups) {
    if (members.length < minMembers) continue
    let sumSin = 0
    let sumCos = 0
    for (const s of members) {
      const w = Math.max(s.length, 1e-9)
      sumSin += w * Math.sin(2 * s.angleDeg * DEG)
      sumCos += w * Math.cos(2 * s.angleDeg * DEG)
    }
    const mean = sumSin === 0 && sumCos === 0 ? members[0].angleDeg : (((0.5 * Math.atan2(sumSin, sumCos)) / DEG) % 180 + 180) % 180
    const nx = -Math.sin(mean * DEG)
    const ny = Math.cos(mean * DEG)
    const withOffset = members.map((s) => ({ s, off: ((s.a.x + s.b.x) / 2) * nx + ((s.a.y + s.b.y) / 2) * ny }))
    withOffset.sort((p, q) => p.off - q.off || p.s.a.x - q.s.a.x || p.s.a.y - q.s.a.y)
    let spacing: number | null = null
    if (withOffset.length >= 3) {
      const gaps: number[] = []
      for (let i = 1; i < withOffset.length; i++) gaps.push(withOffset[i].off - withOffset[i - 1].off)
      gaps.sort((p, q) => p - q)
      const mid = gaps.length >> 1
      spacing = round6(gaps.length % 2 === 1 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2)
    }
    families.push({ angleDeg: round6(mean), members: withOffset.map((w) => w.s), spacing })
  }
  families.sort((p, q) => q.members.length - p.members.length || p.angleDeg - q.angleDeg)
  return families
}
