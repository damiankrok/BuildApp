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

/** 005D: the reader that measures each crossing mark against its line and classifies it. */
export const DIMENSION_TOPOLOGY_NAME = 'metrics.dimension-topology' as const
export const DIMENSION_TOPOLOGY_VERSION = '1.0.0' as const

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
}

/**
 * What a crossing mark is (BUILDPLAN-ANALYZER-005D).
 *
 * TICK          a mark the draughtsman drew: as dark as the line, a stroke, on both sides.
 * QUESTIONABLE  a mark that may be one — lighter than the line, one-sided, a near-duplicate of
 *               its neighbour, or unlike the chain's own end marks. It is never deleted: a span
 *               may run across it or stop at it, and the label decides which.
 * REJECTED      ink lighter than the line that is either a band (a watermark's edge, a grey fill,
 *               a shadow) or touches the line from one side only. It is not a measurement point.
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
  const rowOf = (d: number): number => Math.round(b + d)
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

  const marks: DimensionMark[] = drafts.map(({ _sides: _, ...m }) => {
    const has = (r: DimensionMarkReason): boolean => m.reasons.includes(r)
    const rejected = has('LIGHTER_THAN_LINE') && (has('WEDGE_NOT_STROKE') || has('ONE_SIDED'))
    const questionable = has('LIGHTER_THAN_LINE') || has('ONE_SIDED') || has('DUPLICATE') || has('STYLE_MISMATCH') || (has('WEDGE_NOT_STROKE') && has('COLOUR_MISMATCH'))
    return { ...m, class: rejected ? 'REJECTED' : questionable ? 'QUESTIONABLE' : 'TICK' }
  })
  return { marks, reference }
}
