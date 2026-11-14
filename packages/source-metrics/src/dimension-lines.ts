/**
 * Finding the dimension lines themselves.
 *
 * A dimension chain is not a set of parallel lines that happen to be near each
 * other — that description also fits the strokes of the number printed above
 * it, which is exactly the mistake a generic parallel-line detector makes. A
 * dimension line is a specific, recognisable thing:
 *
 *   a LONG, THIN, STRAIGHT run of ink, crossed at intervals by SHORT MARKS.
 *
 * Both halves matter. The long thin run rules out text and hatching; the
 * crossing marks are what turn a line into a chain, because they are where the
 * draughtsman said one measurement ends and the next begins. Without them
 * there is a line with a number beside it and no way to know what the number
 * measures.
 *
 * The marks are ticks, slashes or arrowheads depending on the office that drew
 * the sheet, so they are detected by what they all have in common — locally,
 * the ink sticks out further from the line than the line is thick — rather
 * than by matching any one of those shapes.
 */
import { round6 } from '@buildapp/source-common'
import { maskAt, runsAlongCol, runsAlongRow } from '@buildapp/source-cv'
import type { Gray, Mask, Raster } from '@buildapp/source-cv'
import type { PixelRect } from '@buildapp/source-common'

/** 005D: the reader that measures each crossing mark against its line and classifies it. */
export const DIMENSION_TOPOLOGY_NAME = 'metrics.dimension-topology' as const
/** 1.1.0 (005I): a mark that is only label ink beside the line is `TEXT_INK` (`markLabelInk`); 1.2.0: a stroke reaching the line between labels is not (post-review A2), and only text running along the line is label ink. */
/** 1.3.0 (EXTERIOR-COMPLETE): collinear runs a drawing covers (a logo over the line) are joined (`joinOccludedLines`). */
/** 1.4.0 (EXTERIOR-COMPLETE, Zefiranty): an outline drawn across a line — a stroke that runs on past a tick on both sides and slants — is no mark on it (`CROSSING_OUTLINE`, REJECTED), nor is its twin. */
/** 1.5.0 (v3.53.12): a line hidden over long stretches by drawings laid over it (planting, a logo) — every visible piece holding fewer than two ticks of its own, its runs ending inside the cover rather than at a mark — is one line when it ends in a TICK at both ends (`joinCoveredRuns`). */
/** 1.6.0 (v3.53.13): a line joined across a cover keeps the stretches under it (`coveredPx`) — the provenance of the join, which binding weighs (`hiddenSplitExplains`); marks and ticks unchanged. */
export const DIMENSION_TOPOLOGY_VERSION = '1.6.0' as const

export type DimensionLineAxis = 'HORIZONTAL' | 'VERTICAL'

export type DimensionLine = {
  axis: DimensionLineAxis
  /** Where the line sits on the axis it does NOT run along. */
  baselinePx: number
  /** The line's extent along its own axis. */
  fromPx: number
  toPx: number
  thicknessPx: number
  /** Where the crossing marks are, along the line's own axis, ascending. Every candidate mark, whatever its class. */
  ticksPx: number[]
  /** How much ink the line itself is made of: a long dashed leader scores low, a drawn line high. */
  fill: number
  /**
   * 005D: what each crossing mark is, one per `ticksPx` entry, when the line was read with its grey
   * channel. Absent when only a mask was given: then every mark is what it always was, a tick.
   */
  marks?: DimensionMark[]
  /** 005D: the line's own ink against its paper, which every mark is measured against; null when it cannot be told. */
  reference?: { paper: number; line: number; contrast: number } | null
  /**
   * v3.53.13: where a line joined across drawings laid over it (`joinCoveredRuns`) runs under the cover, along its own
   * axis: the stretches no mark of it could be seen on. A tick hidden there would split the line, so a label the line
   * carries is weighed against that possibility (`hiddenSplitExplains`).
   */
  coveredPx?: Array<[number, number]>
}

/**
 * What a crossing mark is (BUILDPLAN-ANALYZER-005D).
 *
 * TICK          a mark the draughtsman drew: as dark as the line, a stroke, on both sides.
 * QUESTIONABLE  a mark that may be one — lighter than the line, one-sided, a near-duplicate of
 *               its neighbour, or unlike the chain's own end marks. It is never deleted: a span
 *               may run across it or stop at it, and the label decides which.
 * REJECTED      ink lighter than the line that is either a band (a watermark's edge, a grey fill,
 *               a shadow) or touches the line from one side only; or (EXTERIOR-COMPLETE) a drawn outline
 *               crossing the line — a stroke that runs on far past a tick on both sides and slants
 *               (a bay's arc, a splayed wall). It is not a measurement point.
 */
export type DimensionMarkClass = 'TICK' | 'QUESTIONABLE' | 'REJECTED'

export type DimensionMarkReason =
  | 'LIGHTER_THAN_LINE'
  | 'FAINT_SIDE'
  | 'ONE_SIDED'
  | 'WEDGE_NOT_STROKE'
  | 'COLOUR_MISMATCH'
  | 'DUPLICATE'
  | 'STYLE_MISMATCH'
  | 'NO_LINE_REFERENCE'
  | 'TEXT_INK'
  | 'CROSSING_OUTLINE'

export type DimensionMark = {
  atPx: number
  /** The positions along the line where the crossing was found, first and last. */
  hitFromPx: number
  hitToPx: number
  class: DimensionMarkClass
  reasons: DimensionMarkReason[]
  /** Peak and weak-side contrast in units of the line's own contrast; side support rows and widths, before and after the line. */
  peakContrast: number | null
  weakContrast: number | null
  supportRows: [number, number]
  rowsPerSide: number
  widthPx: [number, number]
  /** Whether each side narrows away from the line, as an arrowhead does. */
  narrows: [boolean, boolean]
  colourDiff: number
}

export type DimensionLineOptions = {
  /** Shortest run that can be a dimension line, in pixels. */
  minLengthPx?: number
  /** Thickest a dimension line may be. Above this it is a wall, a hatch or a border. */
  maxThicknessPx?: number
  /** How far either side of the line to look for crossing marks. */
  markReachPx?: number
  /** How far the ink must stick out, beyond the line's own thickness, to count as a mark. */
  markExcessPx?: number
  /** Gaps this small in a run are the line, not the end of it. */
  maxGapPx?: number
  /**
   * 005D: the raster the mask was made from. With it every mark is measured against the line it
   * sits on and classified; without it every mark is a tick, as it always was.
   */
  raster?: Raster
  /** The grey field the mask was made from (`inkChannel(raster)`); computed from `raster` when absent. */
  grey?: Gray
}

const DEFAULTS: Required<Omit<DimensionLineOptions, 'raster' | 'grey'>> = { minLengthPx: 40, maxThicknessPx: 3, markReachPx: 7, markExcessPx: 2, maxGapPx: 2 }

/**
 * How far the ink reaches across the line at one position along it.
 *
 * The window is a few pixels wide along the line, not a single column, because
 * the marks a draughtsman uses are not all perpendicular. A 45-degree slash
 * crosses the rule at one point and leans away from it in both directions, so
 * looking straight up and down from that point finds the line and nothing
 * else. Widening the look to a couple of pixels catches the slash, the
 * perpendicular tick and the arrowhead with the same test — which is what
 * makes this a detector of MARKS rather than of one office's house style.
 */
function crossThickness(mask: Mask, axis: DimensionLineAxis, along: number, baseline: number, reach: number, spread = 2): number {
  let count = 0
  for (let d = -reach; d <= reach; d += 1) {
    let hit = 0
    for (let s = -spread; s <= spread && hit === 0; s += 1) {
      const x = axis === 'HORIZONTAL' ? along + s : baseline + d
      const y = axis === 'HORIZONTAL' ? baseline + d : along + s
      if (maskAt(mask, Math.round(x), Math.round(y)) === 1) hit = 1
    }
    count += hit
  }
  return count
}

/**
 * Whether the ink at one position CROSSES the line rather than merely touching
 * it from one side.
 *
 * This is the whole difference between a tick and the bottom of the number
 * printed above the line. A tick, a slash and an arrowhead all straddle the
 * line; a digit, a leader and a hatch all sit on one side of it. Testing for
 * ink on both sides at a distance the line's own thickness cannot reach costs
 * one extra lookup and removes every false chain division the text produces.
 */
function crosses(mask: Mask, axis: DimensionLineAxis, along: number, baseline: number, reach: number, thickness: number, spread = 2): boolean {
  const clear = Math.floor(thickness / 2) + 1
  let above = false
  let below = false
  for (let d = clear + 1; d <= reach; d += 1) {
    for (let s = -spread; s <= spread; s += 1) {
      const ax = axis === 'HORIZONTAL' ? along + s : baseline - d
      const ay = axis === 'HORIZONTAL' ? baseline - d : along + s
      const bx = axis === 'HORIZONTAL' ? along + s : baseline + d
      const by = axis === 'HORIZONTAL' ? baseline + d : along + s
      if (maskAt(mask, Math.round(ax), Math.round(ay)) === 1) above = true
      if (maskAt(mask, Math.round(bx), Math.round(by)) === 1) below = true
    }
  }
  return above && below
}

/**
 * Every dimension line in a mask, with its crossing marks.
 *
 * Lines are found one row (or column) at a time and then merged: a line two
 * pixels thick appears on two adjacent rows, and reporting it twice would
 * double every measurement taken from it.
 */
export function findDimensionLines(mask: Mask, options: DimensionLineOptions = {}): DimensionLine[] {
  // A chain needs at least two marks: one mark measures nothing, and a run
  // with none is a level line, a leader, a wall edge or a sheet border.
  return joinCoveredRuns(joinOccludedLines(findStraightRuns(mask, options), options.raster), options.raster, mask, options).filter((l) => l.ticksPx.length >= 2 && l.fill > 0.9)
}

/** EXTERIOR-COMPLETE: the widest gap a block drawn over a line may leave in it, and the paper's luma. */
export const OCCLUSION_MAX_GAP_PX = 40
const PAPER_LUMA = 230

/**
 * EXTERIOR-COMPLETE: one line under a block drawn over it. A sheet's logo, stamp or label box printed across a
 * dimension line hides a stretch of it; the run-finder then ends the line at the block's edge, and that edge — lighter
 * than the line, or of another colour — becomes a mark, so the label printed over the whole line is bound to a piece of
 * it and the sheet's scale comes out wrong. Two runs on the same baseline and thickness, whose gap is covered by drawn
 * (non-paper) pixels and whose facing marks are not ticks of the line, are one line: the facing marks are the block's
 * edges and are dropped. A gap of bare paper is a real end and is never bridged; a true tick at the gap keeps it apart.
 */
export function joinOccludedLines(lines: readonly DimensionLine[], raster: Raster | undefined): DimensionLine[] {
  if (!raster) return [...lines]
  const luma = (x: number, y: number): number => {
    const xi = Math.min(raster.width - 1, Math.max(0, Math.round(x)))
    const yi = Math.min(raster.height - 1, Math.max(0, Math.round(y)))
    const o = (yi * raster.width + xi) * 4
    return 0.299 * raster.data[o] + 0.587 * raster.data[o + 1] + 0.114 * raster.data[o + 2]
  }
  const sorted = [...lines].sort((a, b) => a.axis.localeCompare(b.axis) || a.baselinePx - b.baselinePx || a.fromPx - b.fromPx)
  const out: DimensionLine[] = []
  const markAt = (l: DimensionLine, at: number) => l.marks?.find((m) => Math.abs(m.atPx - at) < 0.5)
  for (const l of sorted) {
    const prev = out[out.length - 1]
    if (prev && prev.axis === l.axis && Math.abs(prev.baselinePx - l.baselinePx) <= 1 && Math.abs(prev.thicknessPx - l.thicknessPx) <= 1 && l.fromPx > prev.toPx && l.fromPx - prev.toPx <= OCCLUSION_MAX_GAP_PX && prev.ticksPx.length > 0 && l.ticksPx.length > 0) {
      const lastPrev = prev.ticksPx[prev.ticksPx.length - 1]
      const firstNext = l.ticksPx[0]
      const facingPrev = markAt(prev, lastPrev)
      const facingNext = markAt(l, firstNext)
      let covered = 0
      let n = 0
      for (let a = Math.ceil(prev.toPx) + 1; a < Math.floor(l.fromPx); a += 1) {
        n += 1
        if ((l.axis === 'HORIZONTAL' ? luma(a, l.baselinePx) : luma(l.baselinePx, a)) < PAPER_LUMA) covered += 1
      }
      const notTicks = !!facingPrev && facingPrev.class !== 'TICK' && !!facingNext && facingNext.class !== 'TICK'
      if (n > 0 && covered / n >= 0.8 && notTicks) {
        const keep = (m: { atPx: number }): boolean => Math.abs(m.atPx - lastPrev) >= 0.5 && Math.abs(m.atPx - firstNext) >= 0.5
        const len = l.toPx - prev.fromPx + 1
        out[out.length - 1] = {
          ...prev,
          toPx: l.toPx,
          ticksPx: [...prev.ticksPx.slice(0, -1), ...l.ticksPx.slice(1)],
          fill: round6(Math.min(1, (prev.fill * (prev.toPx - prev.fromPx + 1) + l.fill * (l.toPx - l.fromPx + 1) + covered) / len)),
          ...(prev.marks || l.marks ? { marks: [...(prev.marks ?? []).filter(keep), ...(l.marks ?? []).filter(keep)] } : {}),
          ...(prev.reference ? { reference: prev.reference } : {}),
        }
        continue
      }
    }
    out.push(l)
  }
  return out
}

/**
 * v3.53.12: the bounds of a line joined across drawings laid over it. `endPx`: how close to a run's end a mark has to be
 * for that end to be the mark's (a run that ends at its own tick or arrow ends there). `cover`: the share of each gap's
 * pixels on the baseline that must be drawn (darker than paper). `ownShare`: the share of the joined length the line's
 * own runs must draw. `gapShare`: the most of the joined length any one gap may hide.
 */
export const COVERED_RUN_BOUNDS = { endPx: 2, cover: 0.8, ownShare: 0.6, gapShare: 0.25 } as const

/**
 * v3.53.12: one line under drawings laid over it at several places. Planting, a logo or a hatch printed across an overall
 * dimension line can hide stretches of it wider than `joinOccludedLines` bridges, and where the cover is a filled shape
 * the run-finder ends the line at its edge without any mark — the pieces then hold one tick each (or none), and every
 * piece is dropped as a run with fewer than two marks: the line that states the building's whole width is gone before
 * any chain is formed.
 *
 * Only such a lost line is joined: every piece holds at most one tick of its own, so pieces that are dimension lines in
 * their own right are never merged into one chain (the ticks between them would be lost).
 * Collinear runs (same axis, baseline within a pixel, thickness within a pixel) are one line when every gap between them
 * is covered by drawn pixels on the baseline, the ends facing each gap carry no mark (the line runs INTO the cover, it
 * does not end at a tick there — a tick at a gap keeps the lines apart), the joined line begins and ends in a TICK, the
 * line's own runs draw most of its length and no gap hides more than a quarter of it. Otherwise the runs are left as they
 * were. A gap of bare paper is never bridged. Nothing about what lies over the line is assumed beyond its being drawn.
 */
export function joinCoveredRuns(lines: readonly DimensionLine[], raster: Raster | undefined, mask: Mask, options: DimensionLineOptions = {}): DimensionLine[] {
  if (!raster) return [...lines]
  const opt = { ...DEFAULTS, ...options }
  const grey = options.grey ?? inkChannelOf(raster)
  const B = COVERED_RUN_BOUNDS
  const luma = (x: number, y: number): number => {
    const xi = Math.min(raster.width - 1, Math.max(0, Math.round(x)))
    const yi = Math.min(raster.height - 1, Math.max(0, Math.round(y)))
    const o = (yi * raster.width + xi) * 4
    return 0.299 * raster.data[o] + 0.587 * raster.data[o + 1] + 0.114 * raster.data[o + 2]
  }
  const edgePx = opt.markReachPx + B.endPx
  // a run ends at a gap on its own mark when a tick lies at its end, or a mark classed TICK lies within the cover's edge band
  const markNear = (l: DimensionLine, at: number): boolean =>
    l.ticksPx.some((t) => Math.abs(t - at) <= B.endPx) || (l.marks ?? []).some((m) => Math.abs(m.atPx - at) <= edgePx && m.class === 'TICK')
  const coveredOf = (axis: DimensionLineAxis, baseline: number, from: number, to: number): { covered: number; n: number } => {
    let covered = 0
    let n = 0
    for (let a = Math.ceil(from) + 1; a < Math.floor(to); a += 1) {
      n += 1
      if ((axis === 'HORIZONTAL' ? luma(a, baseline) : luma(baseline, a)) < PAPER_LUMA) covered += 1
    }
    return { covered, n }
  }
  const sorted = [...lines].sort((a, b) => a.axis.localeCompare(b.axis) || a.baselinePx - b.baselinePx || a.fromPx - b.fromPx)
  const used = new Set<number>()
  const joined: DimensionLine[] = []
  for (let i = 0; i < sorted.length; i += 1) {
    if (used.has(i)) continue
    const group = [i]
    const gaps: Array<{ covered: number; n: number }> = []
    for (let j = i + 1; j < sorted.length; j += 1) {
      if (used.has(j)) continue
      const last = sorted[group[group.length - 1]]
      const c = sorted[j]
      if (c.axis !== last.axis || Math.abs(c.baselinePx - last.baselinePx) > 1 || Math.abs(c.thicknessPx - last.thicknessPx) > 1 || c.fromPx <= last.toPx) continue
      if (markNear(last, last.toPx) || markNear(c, c.fromPx)) break
      const g = coveredOf(c.axis, (c.baselinePx + last.baselinePx) / 2, last.toPx, c.fromPx)
      if (g.n === 0 || g.covered / g.n < B.cover) break
      group.push(j)
      gaps.push(g)
    }
    if (group.length < 2) continue
    const parts = group.map((k) => sorted[k])
    // only a line LOST to the cover is joined: every piece holds at most one tick of its own (hits in the edge band of an
    // end that faces a gap are the cover's, not the line's). Pieces that are dimension lines in their own right are left
    // as they are — joining them would merge two chains and drop the ticks between them.
    const ownTicks = (l: DimensionLine, k: number): number =>
      l.ticksPx.filter((t) => !((k > 0 && Math.abs(t - l.fromPx) <= edgePx) || (k < parts.length - 1 && Math.abs(t - l.toPx) <= edgePx))).length
    if (parts.some((l, k) => ownTicks(l, k) > 1)) continue
    const first = parts[0]
    const last = parts[parts.length - 1]
    const span = last.toPx - first.fromPx + 1
    const own = parts.reduce((t, l) => t + (l.toPx - l.fromPx + 1), 0)
    if (own / span < B.ownShare || gaps.some((g) => g.n / span > B.gapShare)) continue
    const ink = parts.reduce((t, l) => t + l.fill * (l.toPx - l.fromPx + 1), 0) + gaps.reduce((t, g) => t + g.covered, 0)
    const longest = parts.reduce((a, b) => (b.toPx - b.fromPx > a.toPx - a.fromPx ? b : a))
    // the marks of the joined line, measured against it over the stretches its own runs draw (never inside the cover)
    const found = crossingMarksOf(mask, longest.axis, longest.baselinePx, longest.thicknessPx, parts.map((l) => [Math.round(l.fromPx), Math.round(l.toPx)] as const), opt)
    // the cover's own edges are not marks of the line (as `joinOccludedLines` drops a block's edges): hits within the edge
    // band of an end that faces a gap are dropped before the marks are classified
    const facing = parts.flatMap((l, k) => [...(k > 0 ? [l.fromPx] : []), ...(k < parts.length - 1 ? [l.toPx] : [])])
    const keepHit = (h: readonly [number, number]): boolean => !facing.some((e) => Math.min(Math.abs(h[0] - e), Math.abs(h[1] - e)) <= edgePx)
    const hitRuns = found.hitRuns.filter(keepHit)
    const ticks = found.ticks.filter((_, k) => keepHit(found.hitRuns[k]))
    if (ticks.length < 2) continue
    const line: DimensionLine = { axis: first.axis, baselinePx: longest.baselinePx, fromPx: first.fromPx, toPx: last.toPx, thicknessPx: longest.thicknessPx, ticksPx: ticks, fill: round6(Math.min(1, ink / span)) }
    const classified = classifyMarks(line, hitRuns, mask, grey, raster, opt.markReachPx)
    const markAt = (at: number) => classified.marks.find((m) => Math.abs(m.atPx - at) < 0.5)
    if (![markAt(ticks[0]), markAt(ticks[ticks.length - 1])].every((m) => m?.class === 'TICK')) continue
    for (const k of group) used.add(k)
    joined.push({ ...line, marks: classified.marks, reference: classified.reference, coveredPx: parts.slice(1).map((l, k): [number, number] => [parts[k].toPx, l.fromPx]) })
  }
  if (joined.length === 0) return [...lines]
  return [...sorted.filter((_, k) => !used.has(k)), ...joined].sort((a, b) => a.axis.localeCompare(b.axis) || a.baselinePx - b.baselinePx || a.fromPx - b.fromPx)
}

/**
 * Crossing marks: positions where the ink sticks out further than the line is thick. Consecutive such positions are one
 * mark. Looked for only over the given stretches of the line (all of it, or — v3.53.12 — the stretches its own runs draw).
 */
function crossingMarksOf(mask: Mask, axis: DimensionLineAxis, baseline: number, thickness: number, stretches: ReadonlyArray<readonly [number, number]>, opt: { markReachPx: number; markExcessPx: number }): { ticks: number[]; hitRuns: Array<[number, number]> } {
  const excess = thickness + opt.markExcessPx
  const hits: number[] = []
  for (const [from, to] of stretches) {
    for (let a = from; a <= to; a += 1) {
      if (crossThickness(mask, axis, a, baseline, opt.markReachPx) < excess) continue
      if (!crosses(mask, axis, a, baseline, opt.markReachPx, thickness)) continue
      hits.push(a)
    }
  }
  const ticks: number[] = []
  const hitRuns: Array<[number, number]> = []
  let run: number[] = []
  const flush = (): void => {
    if (run.length > 0) {
      ticks.push(round6(run.reduce((x, y) => x + y, 0) / run.length))
      hitRuns.push([run[0], run[run.length - 1]])
    }
    run = []
  }
  for (const h of hits) {
    if (run.length > 0 && h - run[run.length - 1] > 2) flush()
    run.push(h)
  }
  flush()
  return { ticks, hitRuns }
}

/**
 * Every long, thin, straight run of ink, with whatever crosses it.
 *
 * Dimension lines are a subset of these — the ones with tick marks — and level
 * lines are another: a horizontal rule with a height printed above it and
 * nothing crossing it at all. Both are found the same way because they are the
 * same kind of thing on the page, and separating them by what crosses them is
 * both cheaper and more honest than two detectors that can disagree.
 */
export function findStraightRuns(mask: Mask, options: DimensionLineOptions = {}): DimensionLine[] {
  const opt = { ...DEFAULTS, ...options }
  const grey = options.grey ?? (options.raster ? inkChannelOf(options.raster) : undefined)
  const out: DimensionLine[] = []

  for (const axis of ['HORIZONTAL', 'VERTICAL'] as const) {
    const span = axis === 'HORIZONTAL' ? mask.height : mask.width
    type Candidate = { baseline: number; from: number; to: number }
    const candidates: Candidate[] = []
    for (let b = 0; b < span; b += 1) {
      const runs =
        axis === 'HORIZONTAL'
          ? runsAlongRow(mask, b, { maxGap: opt.maxGapPx, minRun: opt.minLengthPx }).map((r) => ({ from: r.x0, to: r.x1 }))
          : runsAlongCol(mask, b, { maxGap: opt.maxGapPx, minRun: opt.minLengthPx }).map((r) => ({ from: r.y0, to: r.y1 }))
      for (const run of runs) {
        // A run through a wall, a hatch or a filled region is not a line. Test
        // the middle rather than the ends, where ticks thicken it legitimately.
        const middle = (run.from + run.to) / 2
        if (crossThickness(mask, axis, middle, b, opt.maxThicknessPx + 1, 0) > opt.maxThicknessPx) continue
        candidates.push({ baseline: b, from: run.from, to: run.to })
      }
    }

    // Merge the rows of one line: same extent, adjacent baselines.
    const used = new Set<number>()
    for (let i = 0; i < candidates.length; i += 1) {
      if (used.has(i)) continue
      const group = [candidates[i]]
      used.add(i)
      for (let j = i + 1; j < candidates.length; j += 1) {
        if (used.has(j)) continue
        const c = candidates[j]
        const last = group[group.length - 1]
        if (c.baseline - last.baseline > 1) continue
        const overlap = Math.min(c.to, last.to) - Math.max(c.from, last.from)
        if (overlap < Math.min(c.to - c.from, last.to - last.from) * 0.6) continue
        group.push(c)
        used.add(j)
      }
      // The longest row of the group is the line; the group's size is its thickness.
      const best = group.reduce((a, b) => (b.to - b.from > a.to - a.from ? b : a))
      const baseline = group.reduce((a, c) => a + c.baseline, 0) / group.length
      const thickness = group.length

      const { ticks, hitRuns } = crossingMarksOf(mask, axis, baseline, thickness, [[Math.round(best.from), Math.round(best.to)]], opt)

      let ink = 0
      for (let a = Math.round(best.from); a <= Math.round(best.to); a += 1) {
        const x = axis === 'HORIZONTAL' ? a : Math.round(baseline)
        const y = axis === 'HORIZONTAL' ? Math.round(baseline) : a
        if (maskAt(mask, x, y) === 1) ink += 1
      }

      const line: DimensionLine = {
        axis,
        baselinePx: round6(baseline),
        fromPx: round6(best.from),
        toPx: round6(best.to),
        thicknessPx: thickness,
        ticksPx: ticks,
        fill: round6(ink / Math.max(1, best.to - best.from + 1)),
      }
      if (grey && ticks.length >= 2) {
        const classified = classifyMarks(line, hitRuns, mask, grey, options.raster, opt.markReachPx)
        line.marks = classified.marks
        line.reference = classified.reference
      }
      out.push(line)
    }
  }

  return out.sort((a, b) => a.axis.localeCompare(b.axis) || a.baselinePx - b.baselinePx || a.fromPx - b.fromPx)
}

// ---------------------------------------------------------------------------
// 005D: what each crossing mark is
// ---------------------------------------------------------------------------

/** The darkest of the three channels, as `inkChannel` makes it: a red line on white paper is ink. */
function inkChannelOf(r: Raster): Gray {
  const n = r.width * r.height
  const data = new Uint8ClampedArray(n)
  for (let i = 0; i < n; i += 1) data[i] = Math.min(r.data[i * 4], r.data[i * 4 + 1], r.data[i * 4 + 2])
  return { width: r.width, height: r.height, data }
}

const medianOf = (xs: readonly number[]): number => {
  if (xs.length === 0) return Number.NaN
  const s = [...xs].sort((a, b) => a - b)
  const n = s.length
  return n % 2 === 1 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2
}
const quantileOf = (xs: readonly number[], q: number): number => {
  if (xs.length === 0) return Number.NaN
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))]
}

/**
 * The thresholds of the mark classes, each in units of the line it is measured against
 * (005D pre-review A, measured on the base plans of nine houses: 2172 marks, 69 real exterior
 * ticks, none demoted; the round-3 watermark vertex rejected at 0.67 of its line's contrast).
 */
export const MARK_CLASS_BOUNDS = {
  /** The darkest crossing pixel must reach three quarters of the line's own contrast. Real ticks measured 0.77–3.19. */
  lighterThanLine: 0.75,
  /** The weaker side's median ink must reach half of it. */
  faintSide: 0.5,
  /** A side is supported when at least half of its rows carry ink. */
  oneSided: 0.5,
  /** A side wider than 2t + 2 px that does not narrow (an arrowhead does) is a band, not a stroke. */
  bandPerThickness: 2,
  bandPlusPx: 2,
  /** Neither the line nor the mark is neutral, and they differ by half the stronger chroma. */
  chroma: 20,
  /** A paper/line contrast under this, or fewer clean positions, leaves the darkness tests unasked. */
  minContrast: 24,
  minCleanPositions: 8,
  /**
   * EXTERIOR-COMPLETE: a stroke still traceable this many mark reaches out, on both sides, is longer than any
   * tick (a slash, an arrow, a witness line's overshoot all end within one reach — 6–7 px on the development
   * sheets, against 18–21 px for a garden chair's or a bay's outline drawn across the line) ...
   */
  outlineRunPerReach: 2,
  /** ... and one that keeps drifting along the line beyond the mark's reach — by this share of the stretch from one
   *  reach out to the run's end, on either side — is not a witness line (which stands square to the line, straight
   *  through it): it is an outline crossing it — a bay's arc, a splayed wall, a chair drawn over the line. */
  outlineSlant: 0.15,
} as const

/**
 * Measure and classify every crossing mark of one line (BUILDPLAN-ANALYZER-005D).
 *
 * The hit detection that found the marks is unchanged: it is shape-agnostic, which is right,
 * because offices draw slashes, ticks and arrows. What it lacked is any comparison with the line
 * the mark sits on: a watermark's edge, a grey fill and a plant symbol are all ink under an
 * adaptive mask, and all of them cross. So each mark is measured on the grey channel against the
 * line's own ink and paper, on each side of the line separately:
 *
 *   - how dark its darkest pixel is, and how dark the weaker side is, against the line's contrast;
 *   - how many of the side's rows carry ink (a tick crosses; a shadow touches);
 *   - how wide it is along the line (a stroke is thin; a band is not, unless it narrows like an
 *     arrowhead);
 *   - whether its colour differs from the line's (a planter on a black chain);
 *   - and, against its neighbours, whether it is a near-duplicate or unlike the chain's own ends.
 *
 * A mark is REJECTED only when it is lighter than the line AND a band or one-sided: neither alone
 * is enough (each alone demotes real ticks on the development houses). It is QUESTIONABLE when
 * any doubt holds, and a tick otherwise. Every reason is recorded, whatever the class.
 */
export function classifyMarks(line: DimensionLine, hitRuns: ReadonlyArray<[number, number]>, mask: Mask, grey: Gray, raster: Raster | undefined, reach: number): { marks: DimensionMark[]; reference: DimensionLine['reference'] } {
  const B = MARK_CLASS_BOUNDS
  const axis = line.axis
  const b = line.baselinePx
  const t = line.thicknessPx
  const spread = 2
  const clear = Math.floor(t / 2) + 1
  const rowsPerSide = reach - clear
  const G = (along: number, across: number): number => {
    const x = axis === 'HORIZONTAL' ? along : across
    const y = axis === 'HORIZONTAL' ? across : along
    if (x < 0 || y < 0 || x >= grey.width || y >= grey.height) return 255
    return grey.data[y * grey.width + x]
  }
  const M = (along: number, across: number): number => (axis === 'HORIZONTAL' ? maskAt(mask, along, across) : maskAt(mask, across, along))
  const chromaAt = (along: number, across: number): [number, number, number] => {
    const x = axis === 'HORIZONTAL' ? along : across
    const y = axis === 'HORIZONTAL' ? across : along
    if (!raster || x < 0 || y < 0 || x >= raster.width || y >= raster.height) return [0, 0, 0]
    const o = (y * raster.width + x) * 4
    const [r, g, bl] = [raster.data[o], raster.data[o + 1], raster.data[o + 2]]
    const i = (r + g + bl) / 3
    return [r - i, g - i, bl - i]
  }
  const meanChroma = (px: ReadonlyArray<[number, number]>): [number, number, number] => {
    const sum: [number, number, number] = [0, 0, 0]
    for (const [a, c] of px) {
      const v = chromaAt(a, c)
      sum[0] += v[0]
      sum[1] += v[1]
      sum[2] += v[2]
    }
    const n = Math.max(1, px.length)
    return [sum[0] / n, sum[1] / n, sum[2] / n]
  }
  const norm = (v: readonly number[]): number => Math.hypot(v[0], v[1], v[2])
  // Symmetric about the baseline (post-review A P1-1): on a line of even thickness the baseline sits on a
  // half pixel, and rounding both ways up put one side's rows a pixel nearer the line than the other's.
  const rowOf = (d: number): number => (d < 0 ? Math.floor(b + d) : Math.ceil(b + d))
  const from = Math.round(line.fromPx)
  const to = Math.round(line.toPx)

  // --- the line's own ink and paper, at positions no mark reaches -----------------
  const lineRows: number[] = []
  for (let y = Math.floor(b - t / 2); y <= Math.ceil(b + t / 2); y += 1) if (Math.abs(y - b) <= t / 2) lineRows.push(y)
  if (lineRows.length === 0) lineRows.push(Math.round(b))
  const nearMark = (a: number, margin: number): boolean => hitRuns.some(([h0, h1]) => a >= h0 - margin && a <= h1 + margin)
  const lineMins: number[] = []
  const paperSamples: number[] = []
  const linePx: Array<[number, number]> = []
  for (let a = from; a <= to; a += 1) {
    if (nearMark(a, reach)) continue
    let mn = 256
    let darkest = lineRows[0]
    for (const y of lineRows) {
      const v = G(a, y)
      if (v < mn) {
        mn = v
        darkest = y
      }
    }
    lineMins.push(mn)
    for (const d of [-14, -12, -10, 10, 12, 14]) paperSamples.push(G(a, rowOf(d)))
    if (M(a, darkest) === 1) linePx.push([a, darkest])
  }
  const paper = quantileOf(paperSamples, 0.9)
  const lineGrey = medianOf(lineMins)
  const contrast = paper - lineGrey
  const referenced = lineMins.length >= B.minCleanPositions && Number.isFinite(contrast) && contrast >= B.minContrast
  const reference = referenced ? { paper: round6(paper), line: round6(lineGrey), contrast: round6(contrast) } : null
  const lineChroma = meanChroma(linePx)

  // --- each mark, each side --------------------------------------------------------
  type Side = { rows: number; grey: number; greyMin: number; width: number; profile: number[] }
  const sideOf = (h0: number, h1: number, sign: number): Side => {
    const rows: Array<{ min: number; width: number }> = []
    for (let d = clear + 1; d <= reach; d += 1) {
      const y = rowOf(sign * d)
      let mn = 255
      let any = false
      for (let a = h0 - spread; a <= h1 + spread; a += 1) {
        if (M(a, y) !== 1) continue
        any = true
        mn = Math.min(mn, G(a, y))
      }
      if (!any) continue
      // The widest run of ink along the line, on this row, that touches the mark's window.
      let widest = 0
      let a = h0 - spread - 30
      while (a <= h1 + spread + 30) {
        if (M(a, y) !== 1) {
          a += 1
          continue
        }
        const s = a
        while (a <= h1 + spread + 30 && M(a, y) === 1) a += 1
        const e = a - 1
        if (e >= h0 - spread && s <= h1 + spread) widest = Math.max(widest, e - s + 1)
      }
      rows.push({ min: mn, width: widest })
    }
    return {
      rows: rows.length,
      grey: medianOf(rows.map((r) => r.min)),
      greyMin: rows.length > 0 ? Math.min(...rows.map((r) => r.min)) : 255,
      width: medianOf(rows.map((r) => r.width)),
      profile: rows.map((r) => r.width),
    }
  }
  const band = t * B.bandPerThickness + B.bandPlusPx
  const narrowing = (s: Side): boolean => s.profile.length >= 2 && s.profile[s.profile.length - 1] < s.profile[0] - 2 && s.profile[s.profile.length - 1] <= band

  // EXTERIOR-COMPLETE (Zefiranty): follow the stroke through a mark outward, one row at a time, to the nearest ink
  // within a pixel or two of where it was (one blank row is anti-aliasing, two are its end). A tick ends within its
  // reach; an outline drawn across the line runs on, on both sides, and — unlike a witness line — slants.
  const outlineRun = B.outlineRunPerReach * reach
  // The trace starts at the mark's own ink, wherever within its reach that is (two strokes meeting the line from
  // either side at one position are found as one mark), and then keeps to the stroke it found, recording where along
  // the line the stroke is at every step out.
  const traceOf = (h0: number, h1: number, sign: number): { run: number; at: Array<number | null> } => {
    const start = (h0 + h1) / 2
    let at: number | null = null
    let run = 0
    let gap = 0
    const path: Array<number | null> = []
    for (let d = clear + 1; d <= outlineRun && gap <= 1; d += 1) {
      const y = rowOf(sign * d)
      const centre: number = at ?? start
      const lo: number = at === null ? h0 - spread : Math.floor(at) - 2
      const hi: number = at === null ? h1 + spread : Math.ceil(at) + 2
      let best: number | null = null
      for (let a: number = lo; a <= hi; a += 1) if (M(a, y) === 1 && (best === null || Math.abs(a - centre) < Math.abs(best - centre))) best = a
      path[d] = best
      if (best === null) {
        if (at !== null) gap += 1
        else if (d >= reach) break
        continue
      }
      at = best
      run = d
      gap = 0
    }
    return { run, at: path }
  }
  // A side slants when the stroke drifts along the line from where it leaves the line: by `outlineSlant` of the distance
  // between its first traced row and one reach out, and again between one reach out and the run's end, the same way.
  // A witness line that a few pixels out runs into a neighbouring drawing's ink — a dashed diagonal, an arrowhead, an
  // extension line it hops onto — is square near the line and drifts only where it hopped; an outline slants from the
  // line on.
  const posAt = (t: { at: Array<number | null> }, d: number): number | undefined => {
    for (let k = d; k > clear; k -= 1) {
      const v = t.at[k]
      if (v !== null && v !== undefined) return v
    }
    return undefined
  }
  const slants = (t: { at: Array<number | null> }): boolean => {
    const first = t.at.findIndex((v) => v !== null && v !== undefined)
    if (first < 0 || first >= reach) return false
    const [p0, a, b] = [t.at[first] as number, posAt(t, reach), posAt(t, outlineRun)]
    if (a === undefined || b === undefined) return false
    const [near, far] = [a - p0, b - a]
    // ... and is still moving at its end: a window or a door drawn in a wall jogs sideways at its frame and then runs on
    // straight along the wall, parked on one position for the last stretch; an arc or a ring is never straight there.
    const tail = t.at.slice(Math.round(1.5 * reach), outlineRun + 1).filter((v): v is number => v !== null && v !== undefined)
    const moving = tail.length > 0 && Math.max(...tail) - Math.min(...tail) >= 1
    return Math.abs(near) >= B.outlineSlant * (reach - first) && Math.abs(far) >= B.outlineSlant * (outlineRun - reach) && Math.sign(near) === Math.sign(far) && moving
  }
  // A straight line through the mark — square to the line along its whole run on one side, and carrying on in line
  // with it for a reach on the other — is a witness line, whatever it meets further out (a neighbouring chain's
  // arrowhead, another line it hops onto): never an outline.
  const positions = (t: { at: Array<number | null> }, upTo: number): number[] => t.at.slice(0, upTo + 1).filter((v): v is number => v !== null && v !== undefined)
  const straightThrough = (a: { at: Array<number | null> }, b: { at: Array<number | null> }): boolean => {
    const along = positions(a, outlineRun)
    if (along.length === 0) return false
    const line = medianOf(along)
    if (along.some((v) => Math.abs(v - line) > 1)) return false
    const near = positions(b, reach)
    return near.length > 0 && near.every((v) => Math.abs(v - line) <= 1)
  }
  const crossingOutline = (h0: number, h1: number): boolean => {
    const [lo, hi] = [traceOf(h0, h1, -1), traceOf(h0, h1, 1)]
    if (lo.run < outlineRun || hi.run < outlineRun) return false
    if (straightThrough(lo, hi) || straightThrough(hi, lo)) return false
    return slants(lo) || slants(hi)
  }

  type Draft = DimensionMark & { _sides: [Side, Side] }
  const drafts: Draft[] = hitRuns.map(([h0, h1], i) => {
    const before = sideOf(h0, h1, -1)
    const after = sideOf(h0, h1, 1)
    const markPx: Array<[number, number]> = []
    for (const sign of [-1, 1]) {
      for (let d = clear + 1; d <= reach; d += 1) {
        const y = rowOf(sign * d)
        let mn = 256
        let at = -1
        for (let a = h0 - spread; a <= h1 + spread; a += 1) {
          if (M(a, y) === 1 && G(a, y) < mn) {
            mn = G(a, y)
            at = a
          }
        }
        if (at >= 0) markPx.push([at, y])
      }
    }
    const markChroma = meanChroma(markPx)
    const colourDiff = round6(norm([lineChroma[0] - markChroma[0], lineChroma[1] - markChroma[1], lineChroma[2] - markChroma[2]]))
    const strongest = Math.max(norm(lineChroma), norm(markChroma))
    const reasons: DimensionMarkReason[] = []
    let peak: number | null = null
    let weak: number | null = null
    if (!referenced) reasons.push('NO_LINE_REFERENCE')
    else {
      peak = round6(Math.max(paper - before.greyMin, paper - after.greyMin) / contrast)
      weak = round6(Math.min(paper - (Number.isFinite(before.grey) ? before.grey : 255), paper - (Number.isFinite(after.grey) ? after.grey : 255)) / contrast)
      if (peak < B.lighterThanLine) reasons.push('LIGHTER_THAN_LINE')
      if (weak < B.faintSide) reasons.push('FAINT_SIDE')
    }
    if (Math.min(before.rows, after.rows) < B.oneSided * rowsPerSide) reasons.push('ONE_SIDED')
    const wide = [before, after].some((s) => Number.isFinite(s.width) && s.width > band && !narrowing(s))
    if (wide) reasons.push('WEDGE_NOT_STROKE')
    if (raster && strongest >= B.chroma && colourDiff >= 0.5 * strongest) reasons.push('COLOUR_MISMATCH')
    if (crossingOutline(h0, h1)) reasons.push('CROSSING_OUTLINE')
    return {
      atPx: line.ticksPx[i],
      hitFromPx: h0,
      hitToPx: h1,
      class: 'TICK',
      reasons,
      peakContrast: peak,
      weakContrast: weak,
      supportRows: [before.rows, after.rows],
      rowsPerSide,
      widthPx: [Number.isFinite(before.width) ? round6(before.width) : 0, Number.isFinite(after.width) ? round6(after.width) : 0],
      narrows: [narrowing(before), narrowing(after)],
      colourDiff,
      _sides: [before, after],
    }
  })

  // --- against its neighbours ----------------------------------------------------------
  // Two marks a reach apart are one mark found twice (a slash and its stub, a tail beside text):
  // the weaker carries DUPLICATE. Neither may be a band: a wall face beside a tick is two things.
  const strength = (m: Draft): number[] => [m.reasons.length, -Math.min(...m.supportRows), -(m.peakContrast ?? 0)]
  const weaker = (a: Draft, c: Draft): Draft => {
    const [x, y] = [strength(a), strength(c)]
    for (let i = 0; i < x.length; i += 1) if (x[i] !== y[i]) return x[i] > y[i] ? a : c
    return c
  }
  for (let i = 0; i + 1 < drafts.length; i += 1) {
    const [a, c] = [drafts[i], drafts[i + 1]]
    if (c.atPx - a.atPx > reach + 1 || a.reasons.includes('WEDGE_NOT_STROKE') || c.reasons.includes('WEDGE_NOT_STROKE')) continue
    const w = weaker(a, c)
    if (!w.reasons.includes('DUPLICATE')) w.reasons.push('DUPLICATE')
    // One mark found twice is one ink: the twin of an outline's crossing is that crossing (where the outline runs
    // shallow across the line it is found at two positions, and only one of them traces it on).
    const twin = w === a ? c : a
    if (twin.reasons.includes('CROSSING_OUTLINE') && !w.reasons.includes('CROSSING_OUTLINE')) w.reasons.push('CROSSING_OUTLINE')
  }
  // An internal mark unlike the chain's own clean end marks: far lighter, or far wider.
  const ends = drafts.length > 2 ? [drafts[0], drafts[drafts.length - 1]].filter((e) => e.reasons.length === 0) : []
  if (ends.length > 0) {
    const endContrast = Math.max(...ends.map((e) => e.peakContrast ?? 0))
    const endWidth = Math.max(...ends.map((e) => Math.max(...e.widthPx)))
    for (const m of drafts.slice(1, -1)) {
      if (m.peakContrast === null) continue
      if (m.peakContrast < 0.5 * endContrast || Math.max(...m.widthPx) > 2 * endWidth + 2) m.reasons.push('STYLE_MISMATCH')
    }
  }

  const marks: DimensionMark[] = drafts.map(({ _sides: _, ...m }) => ({ ...m, class: markClassOf(m.reasons) }))
  return { marks, reference }
}

/** A mark's class from its reasons (005D; CROSSING_OUTLINE, EXTERIOR-COMPLETE). */
function markClassOf(reasons: readonly DimensionMarkReason[]): DimensionMarkClass {
  const has = (r: DimensionMarkReason): boolean => reasons.includes(r)
  const rejected = (has('LIGHTER_THAN_LINE') && (has('WEDGE_NOT_STROKE') || has('ONE_SIDED'))) || has('CROSSING_OUTLINE')
  const questionable = has('LIGHTER_THAN_LINE') || has('ONE_SIDED') || has('DUPLICATE') || has('STYLE_MISMATCH') || (has('WEDGE_NOT_STROKE') && has('COLOUR_MISMATCH'))
  return rejected ? 'REJECTED' : questionable ? 'QUESTIONABLE' : 'TICK'
}

// ---------------------------------------------------------------------------
// 005I: label ink is not a tick
// ---------------------------------------------------------------------------

/** The ink of one printed label: its box and its glyphs' boxes, in the frame's pixels. */
/**
 * A printed label as ink: its box, its glyph boxes and the axis its text runs along (`textAxisOf` of the pass that read
 * it — the axis only, never which way up). A dimension's number is printed parallel to its line (ISO 129), so only a
 * label whose text runs along a line can be that line's label ink; text read across a line — often linework the reader
 * formed into a short token, a tick's own stroke among it — is not.
 */
export type LabelInk = { box: PixelRect; glyphs: readonly PixelRect[]; axis: 'HORIZONTAL' | 'VERTICAL' }

/**
 * Where label ink makes a crossing mark (BUILDPLAN-ANALYZER-005I).
 *
 * The hit test finds a mark wherever ink sits on BOTH sides of a line within a few pixels of it. Two labels printed
 * on either side of one line — a margin with an overall line and a chain of parts beside it, the overall's number on
 * one side and a part's number on the other — pass that test with no stroke crossing the line at all: blind round 7
 * (005H) read two "ticks" inside a label's extent and cut an overall dimension into three unread pieces there.
 *
 * So each mark's crossing ink is traced to where it came from. On each side of the line, the ink the hit test saw is
 * LABEL INK when it lies inside the glyph boxes of a printed label that sits wholly on that side (a label is beside
 * its line, never across it: a mark read as a glyph of a token that straddles the line is a mark, not a label):
 *
 *   - both sides label ink: nothing crosses the line. REJECTED, `TEXT_INK` — never a measurement point, never a
 *     chain break, kept on the record;
 *   - one side label ink: the label may hide a real tick's other half, or a witness line ends against the label.
 *     The mark is at most QUESTIONABLE, `TEXT_INK`: the uncertainty is kept, not resolved.
 *
 * Only labels printed along the line count (`LabelInk.axis`, post-review: on a sheet whose reader forms short tokens
 * out of linework, a token read across a horizontal line had a real tick's stroke inside its box).
 *
 * Real linework crossing text is not erased: a side whose ink is not (all but a tenth) inside label glyphs is
 * evidence of a stroke, and the mark keeps its class. Nor is a stroke the labels happen to cover: label ink beside a
 * line leaves a gap between the line and the glyphs, a stroke crossing the line does not — ink outside every glyph in
 * the `contactRows` rows next to the line, within the hit run, is a stroke reaching the line, and that side is not
 * label ink (post-review A2). Image only: label boxes, never what a label reads.
 */
export const LABEL_INK_BOUNDS = { glyphPadPx: 1, labelShare: 0.9, spread: 2, contactRows: 2 } as const

export function markLabelInk(lines: readonly DimensionLine[], labels: readonly LabelInk[], mask: Mask, options: { markReachPx?: number } = {}): DimensionLine[] {
  const reach = options.markReachPx ?? DEFAULTS.markReachPx
  const B = LABEL_INK_BOUNDS
  return lines.map((line) => {
    if (!line.marks || line.marks.length === 0) return line
    const horizontal = line.axis === 'HORIZONTAL'
    const b = line.baselinePx
    const t = line.thicknessPx
    const clear = Math.floor(t / 2) + 1
    const rowOf = (d: number): number => (d < 0 ? Math.floor(b + d) : Math.ceil(b + d))
    const acrossOf = (r: PixelRect): [number, number] => (horizontal ? [r.y0, r.y1] : [r.x0, r.x1])
    const alongOf = (r: PixelRect): [number, number] => (horizontal ? [r.x0, r.x1] : [r.y0, r.y1])
    // The side of the line a box lies wholly on, or 0 when it reaches the line.
    const sideOfBox = (r: PixelRect): -1 | 0 | 1 => {
      const [lo, hi] = acrossOf(r)
      if (hi < b - t / 2) return -1
      if (lo > b + t / 2) return 1
      return 0
    }
    const glyphs: Array<{ box: PixelRect; side: -1 | 1 }> = []
    for (const label of labels) {
      if (label.axis !== line.axis) continue
      const side = sideOfBox(label.box)
      if (side === 0) continue
      const [lo, hi] = acrossOf(label.box)
      if (Math.min(Math.abs(lo - b), Math.abs(hi - b)) > reach + B.glyphPadPx) continue
      const [a0, a1] = alongOf(label.box)
      if (a1 < line.fromPx - reach || a0 > line.toPx + reach) continue
      for (const g of label.glyphs) if (sideOfBox(g) === side) glyphs.push({ box: g, side })
    }
    if (glyphs.length === 0) return line
    // EXTERIOR-COMPLETE: a stroke traced on into a label printed against the line ran into the label's glyphs, not along
    // an outline: a mark within a label's span keeps no CROSSING_OUTLINE (its glyphs are judged below, as text).
    const underLabel = (m: DimensionMark): boolean => glyphs.some((g) => {
      const [a0, a1] = alongOf(g.box)
      return m.hitToPx >= a0 - reach && m.hitFromPx <= a1 + reach
    })
    const unOutlined = (m: DimensionMark): DimensionMark => {
      if (!m.reasons.includes('CROSSING_OUTLINE') || !underLabel(m)) return m
      const reasons = m.reasons.filter((r) => r !== 'CROSSING_OUTLINE')
      return { ...m, reasons, class: markClassOf(reasons) }
    }
    const inGlyph = (x: number, y: number, side: -1 | 1): boolean =>
      glyphs.some((g) => g.side === side && x >= g.box.x0 - B.glyphPadPx && x <= g.box.x1 + B.glyphPadPx && y >= g.box.y0 - B.glyphPadPx && y <= g.box.y1 + B.glyphPadPx)
    const marks = line.marks.map(unOutlined).map((m): DimensionMark => {
      const textSide = (sign: -1 | 1): boolean => {
        let ink = 0
        let text = 0
        for (let d = clear + 1; d <= reach; d += 1) {
          const across = rowOf(sign * d)
          for (let a = Math.round(m.hitFromPx) - B.spread; a <= Math.round(m.hitToPx) + B.spread; a += 1) {
            const [x, y] = horizontal ? [a, across] : [across, a]
            if (maskAt(mask, x, y) !== 1) continue
            const glyph = inGlyph(x, y, sign)
            // A stroke reaching the line: ink outside every glyph, next to the line, inside the hit run.
            if (!glyph && d <= clear + B.contactRows && a >= Math.round(m.hitFromPx) && a <= Math.round(m.hitToPx)) return false
            ink += 1
            if (glyph) text += 1
          }
        }
        return ink > 0 && text >= B.labelShare * ink
      }
      const before = textSide(-1)
      const after = textSide(1)
      if (!before && !after) return m
      const reasons: DimensionMarkReason[] = m.reasons.includes('TEXT_INK') ? [...m.reasons] : [...m.reasons, 'TEXT_INK']
      if (before && after) return { ...m, class: 'REJECTED', reasons }
      return { ...m, class: m.class === 'TICK' ? 'QUESTIONABLE' : m.class, reasons }
    })
    return { ...line, marks }
  })
}
