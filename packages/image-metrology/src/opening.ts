/**
 * Where an opening stops, measured against the wall beside it.
 *
 * §15's point, put to work. A rectangle detector run over a photo-realistic
 * elevation does not return windows. On the reference project's four renders
 * it returned thirty rectangles across four facades, of which the widest on
 * the front elevation was a 4.49 x 1.51 m band and the tallest a 0.80 x 4.08 m
 * sliver; the 2.75 x 2.25 m garage door was not among them, and asking which
 * of those rectangles was the garage door produced a 1.21 m tall garage door.
 *
 * So the opening's extent is not taken from a detector at all. It is measured,
 * and measured DIFFERENTIALLY: an opening is the stretch of a column band that
 * stops looking like the wall immediately either side of it. Comparing a strip
 * against its own neighbours rather than against an absolute threshold is what
 * makes this survive a render — the glass, the sky reflected in it, the render
 * tone, the sun and the shadow all move both strips together, and only a hole
 * in the wall moves one of them.
 *
 * It is also why the reference strips are NARROW and taken from immediately
 * beside the opening. Two metres away is a different material, a different
 * storey or a different building; ten centimetres away is the same wall in the
 * same light, which is the only fair comparison. Width is a trap here rather
 * than an advantage: a facade's piers are as narrow as the builder could make
 * them — the §20 test facade has 0.5 m of wall between a 2.4 m window and a
 * 4.7 m run of glazing — so a reference strip sized as a fraction of the
 * OPENING reaches straight through the pier into the next window and reports
 * the two of them as one four-metre hole.
 *
 * A row counts as inside the opening only when it differs from the wall on
 * BOTH sides, and each side is summarised by its median rather than its mean.
 * Both of those are about the same failure: the piers on a real facade are as
 * narrow as the builder could make them, so a strip beside one opening can
 * clip the next, and a rule that averaged the two sides together would read
 * the pier, the window and the glazing as one four-metre hole. A hole has wall
 * on both sides of it, by definition, so taking the smaller of the two
 * differences costs nothing on a real opening and refuses that outright.
 *
 * The two classes of row — wall-like and hole-like — are separated by Otsu's
 * threshold rather than by a level set from the quiet rows. The obvious
 * alternative, "the opening is what stands out of the median row", assumes
 * most of the search range is wall, and that is false exactly where it
 * matters: a tall window fills seventy per cent of its storey, which makes the
 * median row the WINDOW, puts the threshold above everything, and finds no
 * opening at all. On the reference project every ground-floor opening failed
 * that way. Otsu asks the other question — where do these rows fall into two
 * groups — which has an answer whichever group is larger.
 *
 * A split is always available, though, including for a blank wall, so the
 * separation has to earn its keep: the hole-like rows must differ from the
 * wall-like ones by more than the wall differs from itself, and by enough to
 * see.
 *
 * And the run has to STOP inside the searched range, with wall-like rows above
 * it and below it. A hole is bounded on all four sides — there is a lintel
 * over every structural opening and a sill or a threshold under it — whereas a
 * rendered panel beside a clad one differs from its neighbour all the way from
 * the ground to the eaves. Both are a strip that does not match the wall
 * either side of it, and only one of them is a window.
 *
 * What comes back is a proposal refined to an edge. The differential profile
 * says which rows the opening occupies to within a pixel or two; `refineEdge`
 * then puts the head and the sill on the actual drawn lines, sub-pixel, and
 * reports how sure it is of each. A caller that wants metres hands both to a
 * registered frame.
 */
import { round6 } from '@buildapp/source-common'
import type { Gray, Raster } from '@buildapp/source-cv'
import { toGray } from '@buildapp/source-cv'
import { median, robustSigma } from './linalg.js'
import { refineEdge } from './bounds.js'

export type OpeningExtent = {
  /** The two boundaries, in pixels along the searched axis, low first. */
  fromPx: number
  toPx: number
  fromSigmaPx: number
  toSigmaPx: number
  /** How strongly the band differed from its neighbours, on a 0..255 scale. */
  contrast: number
  /** What fraction of the searched range the opening occupies. */
  share: number
  /** Whether each boundary landed on a drawn edge, or only on the profile. */
  fromRefined: boolean
  toRefined: boolean
  why: string
}

export type OpeningExtentOptions = {
  /** How wide the wall strips beside the opening are, as a fraction of the band's width. */
  referenceFraction?: number
  /** And at least this many pixels, because a reveal is a few pixels wide on any raster. */
  minReferencePx?: number
  /** How far to stand off from the opening's edge before sampling, as a fraction of the band's width. */
  referenceSkip?: number
  /** How many robust deviations of the wall's own variation the two groups must be apart. */
  sigmas?: number
  /** And at least this much, on a 0..255 scale: below it, nothing is visibly different. */
  minContrast?: number
  /** An opening must occupy at least this share of the searched range to be believed. */
  minShare?: number
  /** And no more than this. */
  maxShare?: number
  /** How much wall must be left above and below it, as a share of the searched range. */
  minMargin?: number
}

const DEFAULTS: Required<OpeningExtentOptions> = { referenceFraction: 0.1, minReferencePx: 3, referenceSkip: 0.04, sigmas: 4, minContrast: 8, minShare: 0.06, maxShare: 0.96, minMargin: 0.02 }

/** Otsu's threshold: the split that leaves the two groups as tight as they can be. */
function otsu(values: readonly number[]): number {
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  if (!(hi > lo)) return hi + 1
  const bins = 64
  const hist = new Float64Array(bins)
  for (const v of values) hist[Math.min(bins - 1, Math.floor(((v - lo) / (hi - lo)) * bins))] += 1
  const total = values.length
  let sum = 0
  for (let i = 0; i < bins; i += 1) sum += i * hist[i]
  let weightLow = 0
  let sumLow = 0
  let best = { variance: -1, at: 0 }
  for (let i = 0; i < bins - 1; i += 1) {
    weightLow += hist[i]
    if (weightLow === 0) continue
    const weightHigh = total - weightLow
    if (weightHigh === 0) break
    sumLow += i * hist[i]
    const meanLow = sumLow / weightLow
    const meanHigh = (sum - sumLow) / weightHigh
    const variance = weightLow * weightHigh * (meanLow - meanHigh) ** 2
    if (variance > best.variance) best = { variance, at: i }
  }
  return lo + ((best.at + 1) / bins) * (hi - lo)
}

const grayOf = (source: Raster | Gray): Gray => (source.data.length === source.width * source.height * 4 ? toGray(source as Raster) : (source as Gray))

/**
 * The vertical extent of an opening whose columns are known.
 *
 * `band` is the opening's columns — from a plan gap, projected into this
 * image — and `within` is the range of rows it may occupy, normally the
 * storey. Everything else is measured.
 */
export function verticalOpeningExtent(source: Raster | Gray, band: { from: number; to: number }, within: { from: number; to: number }, options: OpeningExtentOptions = {}): OpeningExtent | null {
  const opt = { ...DEFAULTS, ...options }
  const g = grayOf(source)
  const u0 = Math.max(1, Math.round(Math.min(band.from, band.to)))
  const u1 = Math.min(g.width - 2, Math.round(Math.max(band.from, band.to)))
  const v0 = Math.max(1, Math.round(Math.min(within.from, within.to)))
  const v1 = Math.min(g.height - 2, Math.round(Math.max(within.from, within.to)))
  if (u1 - u0 < 2 || v1 - v0 < 6) return null

  const width = u1 - u0
  const pad = Math.max(opt.minReferencePx, Math.round(width * opt.referenceFraction))
  const skip = Math.max(2, Math.round(width * opt.referenceSkip))
  // Inset the band itself: the reveal at each side of a hole belongs to
  // neither the hole nor the wall, and sampling it blurs the two together.
  const inset = Math.max(1, Math.round(width * 0.15))
  const inFrom = u0 + inset
  const inTo = u1 - inset
  if (inTo <= inFrom) return null

  // The median rather than the mean, for the same reason: two pixels of the
  // neighbouring window clipped into a six-pixel strip must not move it.
  const level = (from: number, to: number, v: number): number | null => {
    const a = Math.max(0, from)
    const b = Math.min(g.width - 1, to)
    if (b < a) return null
    const row: number[] = []
    for (let u = a; u <= b; u += 1) row.push(g.data[v * g.width + u])
    return median(row)
  }

  const profile: number[] = []
  for (let v = v0; v <= v1; v += 1) {
    const inside = level(inFrom, inTo, v)
    const left = level(u0 - skip - pad, u0 - skip, v)
    const right = level(u1 + skip, u1 + skip + pad, v)
    if (inside === null || (left === null && right === null)) {
      profile.push(0)
      continue
    }
    const fromLeft = left === null ? Number.POSITIVE_INFINITY : Math.abs(inside - left)
    const fromRight = right === null ? Number.POSITIVE_INFINITY : Math.abs(inside - right)
    // Different from the wall on BOTH sides, or it is not a hole.
    profile.push(Math.min(fromLeft, fromRight))
  }

  // Where these rows fall into two groups.
  const threshold = otsu(profile)
  const low = profile.filter((d) => d < threshold)
  const high = profile.filter((d) => d >= threshold)
  if (low.length === 0 || high.length === 0) return null
  const wall = median(low)
  const hole = median(high)
  const spread = robustSigma(low)
  // A split exists for a blank wall too. It only means something when the
  // hole-like rows differ from the wall-like ones by more than the wall
  // differs from itself, and by enough to be visible at all.
  if (hole - wall < Math.max(opt.minContrast, opt.sigmas * spread)) return null
  let best: { from: number; to: number } | null = null
  let run = -1
  for (let i = 0; i <= profile.length; i += 1) {
    const inside = i < profile.length && profile[i] >= threshold
    if (inside) {
      if (run < 0) run = i
      continue
    }
    if (run >= 0) {
      if (!best || i - run > best.to - best.from) best = { from: run, to: i - 1 }
      run = -1
    }
  }
  if (!best) return null

  const share = (best.to - best.from + 1) / profile.length
  if (share < opt.minShare || share > opt.maxShare) return null
  // Bounded above and below, or it is a different wall rather than a hole in
  // this one.
  const margin = Math.max(2, Math.round(profile.length * opt.minMargin))
  if (best.from < margin || best.to > profile.length - 1 - margin) return null
  const rawFrom = v0 + best.from
  const rawTo = v0 + best.to
  const contrast = round6(median(profile.slice(best.from, best.to + 1)))

  // The profile says which rows; the drawing says exactly where. A head and a
  // sill are drawn lines running the width of the opening, so each is refined
  // within the band and within a couple of pixels of where the profile put it.
  const reach = Math.max(2, Math.round((rawTo - rawFrom) * 0.12))
  const head = refineEdge(g, { axis: 'HORIZONTAL', nearPx: rawFrom, searchPx: reach, within: { from: inFrom, to: inTo }, minCoverageFraction: 0.4 })
  const sill = refineEdge(g, { axis: 'HORIZONTAL', nearPx: rawTo, searchPx: reach, within: { from: inFrom, to: inTo }, minCoverageFraction: 0.4 })
  const fromPx = head?.atPx ?? rawFrom
  const toPx = sill?.atPx ?? rawTo
  if (!(toPx > fromPx)) return null

  return {
    fromPx: round6(fromPx),
    toPx: round6(toPx),
    // Where nothing was refined, the profile's own row is the answer and it is
    // worth about the row it sits in, not a fraction of one.
    fromSigmaPx: round6(head?.sigmaPx ?? 1.5),
    toSigmaPx: round6(sill?.sigmaPx ?? 1.5),
    contrast,
    share: round6(share),
    fromRefined: head !== null,
    toRefined: sill !== null,
    why:
      `over ${inTo - inFrom} px of band against ${pad} px of wall ${skip} px either side, rows ${rawFrom} to ${rawTo} differ from the wall by ${contrast.toFixed(0)}/255 ` +
      `where the wall differs from itself by ${wall.toFixed(0)} ± ${spread.toFixed(1)}; ` +
      `${head ? `the head refines to ${fromPx.toFixed(2)}` : 'no drawn head was found, so the profile row stands'} and ` +
      `${sill ? `the sill to ${toPx.toFixed(2)}` : 'no drawn sill was found, so the profile row stands'}`,
  }
}

/**
 * The building's top edge, column by column.
 *
 * A registered elevation is an extent and a scale; this is the SHAPE inside
 * it. For each column of the picture it reports the first row, from the top,
 * where the picture stops being sky and stays that way — which on an elevation
 * is the ridge, the eaves, a chimney or the parapet of a garage, and is
 * therefore the one measurement that says which end of the drawing is which.
 *
 * That is what it is for. A drawing of a tall house beside a low garage
 * carries its own handedness in its profile, unmistakably and at every column,
 * where the openings carry it faintly and ambiguously: on the reference
 * project's front elevation, matching the plan's gaps against the drawing's
 * openings picks the wrong end, because the end with the windows is not the
 * end the plan is describing.
 *
 * "Stays that way" is the whole of the noise rejection. A branch against the
 * sky is a few rows deep and then sky again; a building is not.
 */
export function silhouetteTop(source: Raster | Gray, region: { x0: number; y0: number; x1: number; y1: number }, options: { runPx?: number; minContrast?: number } = {}): Array<number | null> {
  const g = grayOf(source)
  const x0 = Math.max(0, Math.round(region.x0))
  const x1 = Math.min(g.width - 1, Math.round(region.x1))
  const y0 = Math.max(0, Math.round(region.y0))
  const y1 = Math.min(g.height - 1, Math.round(region.y1))
  const run = options.runPx ?? Math.max(4, Math.round((y1 - y0) * 0.04))
  const out: Array<number | null> = []
  for (let x = x0; x <= x1; x += 1) {
    // The sky for THIS column, taken from the rows above the building rather
    // than from the page: a rendered sky is a gradient and is not one colour.
    const skyRows: number[] = []
    for (let y = y0; y < Math.min(y1, y0 + Math.max(3, run)); y += 1) skyRows.push(g.data[y * g.width + x])
    const sky = median(skyRows)
    const contrast = options.minContrast ?? 12
    let found: number | null = null
    for (let y = y0; y <= y1 - run; y += 1) {
      let held = true
      for (let k = 0; k < run; k += 1) {
        if (Math.abs(g.data[(y + k) * g.width + x] - sky) < contrast) {
          held = false
          break
        }
      }
      if (held) {
        found = y
        break
      }
    }
    out.push(found)
  }
  return out
}

/**
 * What kind of drawing this is, from the pixels rather than from a label.
 *
 * §10's question. A source package can say ELEVATION, and be right, about an
 * image that is a photo-realistic render of the building — trees, sky, glass
 * reflecting both — rather than a line drawing of it. Both are orthographic
 * elevations and both register perfectly well for scale and extent. They are
 * not remotely the same thing to READ: on a line drawing a rectangle detector
 * returns the openings, and on a render it returns bands of shadow and strips
 * of cladding that are every bit as crisp.
 *
 * The distinction is visible in one number. A line drawing is ink on paper:
 * most of the sheet is exactly one tone, and the drawing is the small
 * remainder. A render has no background tone at all — its sky is a gradient,
 * its walls are lit, and almost no two pixels match. Counting the share of the
 * picture that sits within a couple of levels of its single most common tone
 * separates the reference project's four renders from the fixture's line
 * drawings with nothing in between.
 *
 * This decides how much a LONE reading of the drawing is worth. It does not
 * decide whether to use the drawing at all: a render still states the
 * building's extent, and the extent is what a registration needs.
 */
export type DrawingCharacter = {
  kind: 'LINE_DRAWING' | 'RENDERED'
  /** The share of the region within a couple of levels of its most common tone. */
  flatShare: number
  /** How many tones cover half the picture. One or two is paper; dozens is a photograph. */
  tonesForHalf: number
  why: string
}

export function drawingCharacter(source: Raster | Gray, region?: { x0: number; y0: number; x1: number; y1: number }, options: { flatShare?: number } = {}): DrawingCharacter {
  const g = grayOf(source)
  const x0 = Math.max(0, Math.round(region?.x0 ?? 0))
  const y0 = Math.max(0, Math.round(region?.y0 ?? 0))
  const x1 = Math.min(g.width - 1, Math.round(region?.x1 ?? g.width - 1))
  const y1 = Math.min(g.height - 1, Math.round(region?.y1 ?? g.height - 1))
  const hist = new Float64Array(256)
  let n = 0
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      hist[g.data[y * g.width + x]] += 1
      n += 1
    }
  }
  if (n === 0) return { kind: 'RENDERED', flatShare: 0, tonesForHalf: 0, why: 'the region is empty' }
  let mode = 0
  for (let i = 1; i < 256; i += 1) if (hist[i] > hist[mode]) mode = i
  let flat = 0
  for (let i = Math.max(0, mode - 2); i <= Math.min(255, mode + 2); i += 1) flat += hist[i]
  const flatShare = round6(flat / n)
  const ordered = [...hist].map((count, tone) => ({ count, tone })).sort((a, b) => b.count - a.count)
  let running = 0
  let tonesForHalf = 0
  for (const { count } of ordered) {
    running += count
    tonesForHalf += 1
    if (running >= n / 2) break
  }
  const limit = options.flatShare ?? 0.6
  const kind = flatShare >= limit ? 'LINE_DRAWING' : 'RENDERED'
  return {
    kind,
    flatShare,
    tonesForHalf,
    why:
      `${Math.round(flatShare * 100)}% of this drawing is within two levels of its commonest tone and ${tonesForHalf} tone${tonesForHalf === 1 ? '' : 's'} cover half of it, ` +
      `which is ${kind === 'LINE_DRAWING' ? 'ink on paper' : 'a rendered picture rather than a line drawing'}`,
  }
}
