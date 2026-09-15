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
import type { Mask } from '@buildapp/source-cv'

export type DimensionLineAxis = 'HORIZONTAL' | 'VERTICAL'

export type DimensionLine = {
  axis: DimensionLineAxis
  /** Where the line sits on the axis it does NOT run along. */
  baselinePx: number
  /** The line's extent along its own axis. */
  fromPx: number
  toPx: number
  thicknessPx: number
  /** Where the crossing marks are, along the line's own axis, ascending. */
  ticksPx: number[]
  /** How much ink the line itself is made of: a long dashed leader scores low, a drawn line high. */
  fill: number
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
}

const DEFAULTS: Required<DimensionLineOptions> = { minLengthPx: 40, maxThicknessPx: 3, markReachPx: 7, markExcessPx: 2, maxGapPx: 2 }

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
  return findStraightRuns(mask, options).filter((l) => l.ticksPx.length >= 2 && l.fill > 0.9)
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

      // Crossing marks: positions where the ink sticks out further than the
      // line is thick. Consecutive such positions are one mark.
      const excess = thickness + opt.markExcessPx
      const hits: number[] = []
      for (let a = Math.round(best.from); a <= Math.round(best.to); a += 1) {
        if (crossThickness(mask, axis, a, baseline, opt.markReachPx) < excess) continue
        if (!crosses(mask, axis, a, baseline, opt.markReachPx, thickness)) continue
        hits.push(a)
      }
      const ticks: number[] = []
      let run: number[] = []
      const flush = (): void => {
        if (run.length > 0) ticks.push(round6(run.reduce((x, y) => x + y, 0) / run.length))
        run = []
      }
      for (const h of hits) {
        if (run.length > 0 && h - run[run.length - 1] > 2) flush()
        run.push(h)
      }
      flush()

      let ink = 0
      for (let a = Math.round(best.from); a <= Math.round(best.to); a += 1) {
        const x = axis === 'HORIZONTAL' ? a : Math.round(baseline)
        const y = axis === 'HORIZONTAL' ? Math.round(baseline) : a
        if (maskAt(mask, x, y) === 1) ink += 1
      }

      out.push({
        axis,
        baselinePx: round6(baseline),
        fromPx: round6(best.from),
        toPx: round6(best.to),
        thicknessPx: thickness,
        ticksPx: ticks,
        fill: round6(ink / Math.max(1, best.to - best.from + 1)),
      })
    }
  }

  return out.sort((a, b) => a.axis.localeCompare(b.axis) || a.baselinePx - b.baselinePx || a.fromPx - b.fromPx)
}
