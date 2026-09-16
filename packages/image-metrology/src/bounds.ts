/**
 * Finding the BUILDING in a picture of a building.
 *
 * This module exists because of a specific mistake. Asked for the outline of a
 * published elevation, an ink-silhouette extractor returns the outline of
 * everything drawn: the house, and also the lawn it stands on, the trees
 * behind it, the sky and the publisher's watermark. On a real elevation that
 * outline came out five metres wider than the house, and a registration fitted
 * to it is a registration of the landscaping.
 *
 * The distinguishing property is not colour, or position, or contrast. It is
 * STRAIGHTNESS. A building is made of edges that run straight for hundreds of
 * pixels; a tree has none, a cloud has none, a lawn has none. So the
 * architectural bounds come from the long straight rectilinear structure and
 * nothing else — which is why this works the same on a line drawing and on a
 * photo-realistic render, since both draw the building with straight edges and
 * neither draws the foliage with any.
 *
 * Straightness only works if "strong gradient" means an edge. The threshold
 * has to sit ABOVE THE IMAGE'S OWN NOISE, and a fixed one does not: on these
 * renders a threshold of 10/255 is below the JPEG noise floor, so nearly every
 * pixel counts as strong, foliage joins up into apparently continuous columns,
 * and a tree passes for a wall. That failure is scale-dependent — the same
 * drawing at 0.43x has a different noise floor — which is precisely the
 * scale-invariance §19 requires and a fixed threshold cannot give.
 *
 * So the threshold is derived from the picture: the median absolute gradient
 * plus four robust deviations of it. On these elevations that lands at 14/255
 * at full size and 21/255 at 0.43x, and at both the building's edges run for
 * hundreds of pixels while the trees collapse to runs of nine to twenty-seven.
 * A clean line drawing has no noise at all, so the floor below keeps it sane.
 *
 * Length is then the test, and CONTINUITY — the share of a line's strong
 * gradient belonging to its longest unbroken run — is carried alongside it,
 * both as a weight and as a weak floor, because it says how much of what is on
 * that line is the edge rather than clutter around it.
 *
 * Two further details earn their place, both learnt from the real drawings:
 *
 * The extent is taken from the ENDPOINTS of long horizontals as well as from
 * the positions of long verticals. A dark garage wall against dark trees
 * produces no vertical edge at all, but the garage's own roof line stops dead
 * at it, and the end of that line is where the building ends.
 *
 * But an endpoint that lands on the FRAME is not an endpoint of anything. The
 * ground line, the horizon and the paving run out of the picture; where they
 * stop is where the photographer cropped, not where the building is. So
 * endpoints within a border margin are dropped — from the candidate list only,
 * since the edge's other end may still be perfectly good evidence.
 *
 * And what is left has its STRAYS PEELED OFF, by distance rather than by rank.
 * This is the part that a percentile gets wrong. A building's extreme edges
 * are, by their nature, the ones with the least evidence behind them — the
 * dark garage wall at the right-hand end of this elevation is a single roof
 * line stopping dead, against twenty coincident edges around the front door —
 * so any rule that discards the least-supported few discards the building's
 * own corners and reports it several metres too narrow.
 *
 * What is left of the strays is dealt with by CONNECTEDNESS, not by rank. This
 * is the part a percentile gets wrong. A building's extreme edges are, by
 * their nature, the ones with the least evidence behind them — the dark garage
 * wall at the right-hand end of this elevation is a single roof line stopping
 * dead, against twenty coincident edges around the front door — so any rule
 * that discards the least-supported few discards the building's own corners
 * and reports it several metres too narrow.
 *
 * What separates a stray from that corner is that the building is CONNECTED
 * and a stray is not: walking in from the edge of the frame, the building's
 * own candidates come in an unbroken procession, and a patch of paving or a
 * treetop sits alone across a wide span of nothing. So candidates are peeled
 * off each end while the next one inward is further away than a fraction of
 * the frame — which drops the paving two hundred and sixty pixels out and
 * keeps the garage corner thirty-nine pixels out.
 *
 * Weight was tried here and rejected. Splitting the candidates into groups and
 * dropping the light ones at each end is the obvious way to deal with a
 * watermark, which is dense enough that peeling one candidate at a time never
 * touches it. But the lightest outlying group on a real elevation is the
 * chimney, and dropping it cost fifty-eight pixels of building on the front
 * elevation and a hundred and eleven on the side. A watermark that survives
 * this is a watermark that is opaque, rectilinear and the size of a wall —
 * which is to say, indistinguishable from an outbuilding, and cropping it off
 * would be a worse failure than keeping it.
 *
 * One thing this genuinely cannot find: the apex of a gable. It is where two
 * diagonals meet, so there is no long horizontal or vertical edge there at
 * all. `rect` reaches it only when something rectilinear — usually a chimney —
 * happens to stand as tall.
 */
import { round6 } from '@buildapp/source-common'
import type { PixelRect } from '@buildapp/source-common'
import type { Gray, Raster } from '@buildapp/source-cv'
import { toGray } from '@buildapp/source-cv'

export type StraightEdge = {
  /** Where it sits on the axis it is perpendicular to. */
  atPx: number
  /** How far it runs, in pixels. */
  lengthPx: number
  /** The extent it covers along its own direction. */
  fromPx: number
  toPx: number
  /** Mean contrast across it, on a 0..255 gradient. */
  strength: number
  /** 0..1: the share of this line's strong gradient that belongs to the run. */
  continuity: number
}

export type ArchitecturalBounds = {
  /** The building's body: robust, trimmed, and what a registration should be seeded from. */
  rect: PixelRect
  /**
   * The untrimmed extremes of the same evidence.
   *
   * Kept separately because the two coordinates a trim throws away are often
   * the two most useful ones: the topmost is a gable apex and the bottommost
   * is the ground line, and both are anchors.
   */
  extremes: PixelRect
  verticals: StraightEdge[]
  horizontals: StraightEdge[]
  /** 0..1: how much of the claimed rectangle's perimeter is backed by a long straight edge. */
  support: number
  why: string
}

export type BoundsOptions = {
  /** An edge must run at least this fraction of the image to count as architecture. */
  minRunFraction?: number
  /** The floor under the derived gradient threshold, for a noiseless drawing where the derivation gives zero. */
  minStrength?: number
  /** How many robust deviations above the median gradient the threshold sits. */
  noiseSigmas?: number
  /** And this much of its line's strong gradient must belong to the run itself. */
  minContinuity?: number
  /** A clear span this much of the frame wide separates one thing in the picture from another. */
  maxGapFraction?: number
  /** An endpoint this close to the frame was cut by the frame, not by the building. */
  borderFraction?: number
}

const DEFAULTS: Required<BoundsOptions> = { minRunFraction: 0.15, minStrength: 10, noiseSigmas: 4, minContinuity: 0.4, maxGapFraction: 0.05, borderFraction: 0.01 }

const grayOf = (source: Raster | Gray): Gray => (source.data.length === source.width * source.height * 4 ? toGray(source as Raster) : (source as Gray))

/** A candidate coordinate, and how much straight edge stands behind it. */
type Candidate = { at: number; weight: number }

/**
 * Walk in from one end of the sorted candidates, stepping over anything
 * separated from the rest by more than `maxGap`, and report where the
 * unbroken procession starts.
 */
function peel(sorted: readonly Candidate[], maxGap: number, end: 'LOW' | 'HIGH'): number {
  if (end === 'LOW') {
    let i = 0
    while (i + 1 < sorted.length && sorted[i + 1].at - sorted[i].at > maxGap) i += 1
    return sorted[i].at
  }
  let i = sorted.length - 1
  while (i > 0 && sorted[i].at - sorted[i - 1].at > maxGap) i -= 1
  return sorted[i].at
}

/**
 * What counts as an edge in THIS picture.
 *
 * A histogram of |gradient| over the whole image is overwhelmingly noise: on
 * these renders its median is 1 to 3 out of 255. Real edges are the far tail.
 * Putting the threshold at the median plus a few robust deviations therefore
 * separates the two wherever the line is drawn, and does it without anyone
 * choosing a number for a particular image.
 *
 * The floor matters as much as the derivation. A synthetic line drawing is
 * black ink on white paper with no noise whatsoever, its median gradient and
 * deviation are both zero, and a purely derived threshold would be zero too —
 * which would make every pixel an edge.
 */
export function gradientThreshold(source: Raster | Gray, options: BoundsOptions = {}): number {
  const opt = { ...DEFAULTS, ...options }
  const g = grayOf(source)
  const hist = new Float64Array(256)
  let n = 0
  for (let y = 1; y < g.height - 1; y += 1) {
    for (let x = 1; x < g.width - 1; x += 1) {
      hist[Math.min(255, Math.abs(g.data[y * g.width + x + 1] - g.data[y * g.width + x - 1]))] += 1
      hist[Math.min(255, Math.abs(g.data[(y + 1) * g.width + x] - g.data[(y - 1) * g.width + x]))] += 1
      n += 2
    }
  }
  if (n === 0) return opt.minStrength
  const half = (counts: Float64Array): number => {
    let seen = 0
    for (let i = 0; i < 256; i += 1) {
      seen += counts[i]
      if (seen >= n / 2) return i
    }
    return 255
  }
  const median = half(hist)
  const deviations = new Float64Array(256)
  for (let i = 0; i < 256; i += 1) deviations[Math.abs(i - median)] += hist[i]
  const mad = half(deviations)
  return Math.max(opt.minStrength, median + opt.noiseSigmas * 1.4826 * mad)
}

/**
 * The longest unbroken run of strong gradient along each line of the image,
 * and how much of that line's gradient the run accounts for.
 *
 * Unbroken is the whole point. A tree trunk produces a strong gradient down a
 * long column too, but in fragments — bark, leaves, sky between branches — and
 * its longest CONTINUOUS piece is a fraction of the gradient on the column. A
 * wall edge is continuous for its whole height and there is nothing else on
 * the column at all.
 */
function longestRuns(g: Gray, axis: 'VERTICAL' | 'HORIZONTAL', minStrength: number, minRun: number, minContinuity: number): StraightEdge[] {
  const out: StraightEdge[] = []
  const across = axis === 'VERTICAL' ? g.width : g.height
  const along = axis === 'VERTICAL' ? g.height : g.width
  const gradient = (at: number, t: number): number =>
    axis === 'VERTICAL'
      ? Math.abs(g.data[t * g.width + at + 1] - g.data[t * g.width + at - 1])
      : Math.abs(g.data[(at + 1) * g.width + t] - g.data[(at - 1) * g.width + t])
  for (let at = 1; at < across - 1; at += 1) {
    let best: { length: number; from: number; sum: number } | null = null
    let from = -1
    let sum = 0
    let total = 0
    for (let t = 1; t <= along - 1; t += 1) {
      const strong = t < along - 1 && gradient(at, t) >= minStrength
      if (strong) {
        if (from < 0) {
          from = t
          sum = 0
        }
        sum += gradient(at, t)
        total += 1
        continue
      }
      if (from >= 0) {
        const length = t - from
        if (length >= minRun && (!best || length > best.length)) best = { length, from, sum }
        from = -1
      }
    }
    if (!best) continue
    const continuity = best.length / Math.max(1, total)
    if (continuity < minContinuity) continue
    out.push({ atPx: at, lengthPx: best.length, fromPx: best.from, toPx: best.from + best.length - 1, strength: round6(best.sum / best.length), continuity: round6(continuity) })
  }
  return out
}

/** Long straight vertical edges: columns whose horizontal gradient runs unbroken down the image. */
export const verticalEdges = (source: Raster | Gray, options: BoundsOptions = {}): StraightEdge[] => {
  const opt = { ...DEFAULTS, ...options }
  const g = grayOf(source)
  return longestRuns(g, 'VERTICAL', gradientThreshold(g, opt), Math.max(8, Math.round(g.height * opt.minRunFraction)), opt.minContinuity)
}

/** And the transpose. */
export const horizontalEdges = (source: Raster | Gray, options: BoundsOptions = {}): StraightEdge[] => {
  const opt = { ...DEFAULTS, ...options }
  const g = grayOf(source)
  return longestRuns(g, 'HORIZONTAL', gradientThreshold(g, opt), Math.max(8, Math.round(g.width * opt.minRunFraction)), opt.minContinuity)
}

/** The building's own rectangle, and the extremes of the evidence it was taken from. */
export function architecturalBounds(source: Raster | Gray, options: BoundsOptions = {}): ArchitecturalBounds | null {
  const opt = { ...DEFAULTS, ...options }
  const g = grayOf(source)
  const threshold = gradientThreshold(g, opt)
  const verticals = verticalEdges(g, opt)
  const horizontals = horizontalEdges(g, opt)
  if (verticals.length < 2 && horizontals.length < 2) return null

  const border = Math.max(2, Math.round(Math.min(g.width, g.height) * opt.borderFraction))
  const inX = (u: number): boolean => u >= border && u <= g.width - 1 - border
  const inY = (v: number): boolean => v >= border && v <= g.height - 1 - border

  // Where the building could be, horizontally: on any long vertical edge, and
  // at either end of any long horizontal one — weighted by how far the edge
  // that vouches for it runs, and only where the frame is not what stopped it.
  // How much an edge's opinion is worth: how far it runs, and how much of its
  // own line belongs to it. Deliberately NOT how hard it is drawn. Weighting
  // by contrast is the obvious next idea and it is wrong here: on a rendered
  // elevation the building's weakest edges are the ones that matter most — the
  // dark garage wall against dark trees — while the foliage is drawn in hard
  // black against bright sky. Trying it cost fifty-eight pixels on the front
  // elevation and a hundred and eleven on the side.
  const weigh = (e: StraightEdge, along: number): number => (e.lengthPx / along) * e.continuity
  const xs: Candidate[] = [
    ...verticals.filter((e) => inX(e.atPx)).map((e) => ({ at: e.atPx, weight: weigh(e, g.height) })),
    ...horizontals.flatMap((e) => [e.fromPx, e.toPx].filter(inX).map((at) => ({ at, weight: weigh(e, g.width) }))),
  ].sort((a, b) => a.at - b.at)
  const ys: Candidate[] = [
    ...horizontals.filter((e) => inY(e.atPx)).map((e) => ({ at: e.atPx, weight: weigh(e, g.width) })),
    ...verticals.flatMap((e) => [e.fromPx, e.toPx].filter(inY).map((at) => ({ at, weight: weigh(e, g.height) }))),
  ].sort((a, b) => a.at - b.at)
  if (xs.length < 2 || ys.length < 2) return null

  const gapX = g.width * opt.maxGapFraction
  const gapY = g.height * opt.maxGapFraction
  const rect: PixelRect = {
    x0: round6(peel(xs, gapX, 'LOW')),
    y0: round6(peel(ys, gapY, 'LOW')),
    x1: round6(peel(xs, gapX, 'HIGH')),
    y1: round6(peel(ys, gapY, 'HIGH')),
  }
  const extremes: PixelRect = { x0: round6(xs[0].at), y0: round6(ys[0].at), x1: round6(xs[xs.length - 1].at), y1: round6(ys[ys.length - 1].at) }
  if (!(rect.x1 > rect.x0) || !(rect.y1 > rect.y0)) return null

  const spanX = rect.x1 - rect.x0
  const spanY = rect.y1 - rect.y0
  const near = Math.max(2, Math.min(spanX, spanY) * 0.01)
  const reach = (edges: readonly StraightEdge[], at: number, span: number): number =>
    edges.filter((e) => Math.abs(e.atPx - at) <= near).reduce((a, e) => Math.max(a, e.lengthPx / span), 0)
  const support = round6(Math.min(1, (reach(verticals, rect.x0, spanY) + reach(verticals, rect.x1, spanY) + reach(horizontals, rect.y0, spanX) + reach(horizontals, rect.y1, spanX)) / 4))

  return {
    rect,
    extremes,
    verticals: [...verticals].sort((a, b) => b.lengthPx - a.lengthPx).slice(0, 48),
    horizontals: [...horizontals].sort((a, b) => b.lengthPx - a.lengthPx).slice(0, 48),
    support,
    why:
      `${verticals.length} verticals and ${horizontals.length} horizontals run straight for at least ` +
      `${Math.round(g.height * opt.minRunFraction)} and ${Math.round(g.width * opt.minRunFraction)} px above a derived ${threshold.toFixed(1)}/255 gradient; ` +
      `discarding endpoints within ${border} px of the frame and peeling strays more than ${Math.round(gapX)} × ${Math.round(gapY)} px clear of ` +
      `the ${xs.length} horizontal and ${ys.length} vertical candidates leaves ${Math.round(spanX)} × ${Math.round(spanY)} px ` +
      `(untrimmed ${Math.round(extremes.x1 - extremes.x0)} × ${Math.round(extremes.y1 - extremes.y0)}), ${Math.round(support * 100)}% of the perimeter on a straight edge`,
  }
}

/**
 * Refine an expected line to the straight edge nearest it.
 *
 * §6's job, and the one that makes the whole package honest: a detector only
 * has to say "the wall is about here", and this says where it actually is, to
 * a fraction of a pixel. The sub-pixel step is a gradient-weighted centroid
 * across the edge, which is what turns a five-pixel guess into a nine-
 * centimetre measurement on a 17 mm-per-pixel drawing.
 *
 * Lines are ranked by COVERAGE — how much of the search window they are drawn
 * across, counting every segment long enough to be drawn on purpose — and not
 * by their longest unbroken run. Finding the building wants the unbroken run,
 * because that is what a tree has none of. Refining a line that is already
 * known to be there wants coverage, because §7's mullions break the head of a
 * window into four pieces and none of them is long. A head covered 99% by four
 * segments is the head; insisting on one run of 60% finds nothing at all, and
 * a run of glazing is exactly the opening whose width matters most.
 */
export type RefinedEdge = {
  atPx: number
  sigmaPx: number
  /** How much of the search window the edge is drawn across, in pixels. */
  lengthPx: number
  /** In how many pieces. More than one is a mullion, a downpipe or a balcony. */
  segments: number
  strength: number
  why: string
}

export function refineEdge(
  source: Raster | Gray,
  options: {
    axis: 'VERTICAL' | 'HORIZONTAL'
    nearPx: number
    searchPx: number
    within?: { from: number; to: number }
    minStrength?: number
    /** How much of the window the edge must be drawn across, counting all its pieces. */
    minCoverageFraction?: number
    /** And how short a piece has to be before it is noise rather than a piece. */
    minSegmentFraction?: number
  },
): RefinedEdge | null {
  const g = grayOf(source)
  const minStrength = options.minStrength ?? 8
  const along = options.axis === 'VERTICAL' ? g.height : g.width
  const across = options.axis === 'VERTICAL' ? g.width : g.height
  const from = Math.max(1, Math.floor(options.within?.from ?? 1))
  const to = Math.min(along - 2, Math.ceil(options.within?.to ?? along - 2))
  const window = Math.max(1, to - from)
  const minCoverage = Math.max(4, window * (options.minCoverageFraction ?? 0.5))
  const minSegment = Math.max(3, window * (options.minSegmentFraction ?? 0.04))
  const gradient = (at: number, t: number): number =>
    options.axis === 'VERTICAL' ? Math.abs(g.data[t * g.width + at + 1] - g.data[t * g.width + at - 1]) : Math.abs(g.data[(at + 1) * g.width + t] - g.data[(at - 1) * g.width + t])

  const lo = Math.max(1, Math.round(options.nearPx - options.searchPx))
  const hi = Math.min(across - 2, Math.round(options.nearPx + options.searchPx))
  let best: { at: number; covered: number; segments: number; sum: number } | null = null
  for (let at = lo; at <= hi; at += 1) {
    let run = 0
    let sum = 0
    let covered = 0
    let segments = 0
    let total = 0
    const close = (): void => {
      if (run >= minSegment) {
        covered += run
        segments += 1
        total += sum
      }
      run = 0
      sum = 0
    }
    for (let t = from; t <= to; t += 1) {
      if (gradient(at, t) >= minStrength) {
        run += 1
        sum += gradient(at, t)
      } else close()
    }
    close()
    if (covered < minCoverage) continue
    // Most covered first, then hardest drawn: a wall edge beats a shadow
    // beside it because it is drawn further, not because it is darker.
    if (!best || covered > best.covered || (covered === best.covered && total > best.sum)) best = { at, covered, segments, sum: total }
  }
  if (!best) return null

  // Sub-pixel: the gradient's centre of mass across the edge, over the three
  // columns either side. An edge drawn with antialiasing sits between pixels,
  // and rounding it to one costs half a pixel of accuracy for nothing.
  const lo3 = Math.max(1, best.at - 3)
  const hi3 = Math.min(across - 2, best.at + 3)
  const profile: number[] = []
  let weight = 0
  let moment = 0
  for (let at = lo3; at <= hi3; at += 1) {
    let sum = 0
    for (let t = from; t <= to; t += 1) sum += gradient(at, t)
    profile.push(sum)
    weight += sum
    moment += sum * at
  }
  const centre = weight > 0 ? moment / weight : best.at
  // How sure, from the edge itself rather than from a rule of thumb: the
  // centroid of a profile of spread s over n independent rows is good to
  // s/sqrt(n). A crisp edge is half a pixel wide and runs three hundred rows,
  // which is why a five-pixel proposal becomes a nine-centimetre measurement.
  // The floor is the systematic part — antialiasing that is not symmetric,
  // ringing around a compressed edge — which no amount of length averages out.
  let spread = 0
  if (weight > 0) {
    for (let i = 0; i < profile.length; i += 1) spread += profile[i] * (lo3 + i - centre) ** 2
    spread = Math.sqrt(spread / weight)
  }
  const sigma = Math.max(0.25, Math.min(3, spread / Math.sqrt(Math.max(1, best.covered))))
  return {
    atPx: round6(centre),
    sigmaPx: round6(sigma),
    lengthPx: best.covered,
    segments: best.segments,
    strength: round6(best.sum / Math.max(1, best.covered)),
    why:
      `the straightest ${options.axis.toLowerCase()} edge within ${options.searchPx} px of ${Math.round(options.nearPx)} is drawn across ${best.covered} of ${window} px` +
      `${best.segments > 1 ? ` in ${best.segments} pieces` : ''} at ${(best.sum / Math.max(1, best.covered)).toFixed(0)}/255 contrast, centred at ${centre.toFixed(2)} px with a profile ${spread.toFixed(2)} px wide`,
  }
}
