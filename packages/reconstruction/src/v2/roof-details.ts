/**
 * Roof v2 details (§18): the attached body's roof from the section, chimneys
 * from the plans and the renders, rooflights from the renders.
 *
 * None of this is a convention. A flat roof's height is where the section
 * draws its slab; a parapet is the wall that continues above it; a chimney is
 * a solid block that stands on both storeys' plans in the same place and
 * rises above the roof line on a render; a rooflight is a patch in the roof
 * plane of a side render whose tone is not the covering's, of a size a
 * rooflight is. Each carries the views it was read from, and what it lacks.
 */
import { round6 } from '@buildapp/source-common'
import type { Raster } from '@buildapp/source-cv'
import type { CalloutReading, CalloutRingRecord } from '@buildapp/source-metrics'
import type { ElevationFrameV2, PlanFrameV2 } from './frame.js'
import { inkRuns, lumaAt, mergeRuns, toneClass, rgbAt } from './scan.js'
import type { SolidBlock } from './interior.js'

export type SectionFrame = {
  frameId: string
  /** Metres per pixel, and the pixel row of y = 0. */
  mpp: number
  zeroRow: number
  /** The pixel column of world x = 0, when the section is a cross-section along x (or z = 0 when along z). */
  originCol: number
  axis: 'X' | 'Z'
  yOf: (py: number) => number
  alongOf: (px: number) => number
  pxOf: (along: number) => number
  pyOf: (y: number) => number
}

/**
 * Register a section by its wall columns: the outermost long vertical
 * wall-thick bands are the outer faces of the body it cuts, and they are
 * matched to the envelope span whose length they fit.
 */
export function registerSection(raster: Raster, mppHint: number, zeroRow: number, spans: Array<{ axis: 'X' | 'Z'; from: number; to: number }>, frameId: string, ridgeY?: number): SectionFrame | undefined {
  let mpp = mppHint
  // Columns with long runs of dark ink: walls.
  const w = raster.width
  const h = raster.height
  const long: number[] = []
  for (let x = 0; x < w; x += 1) {
    let best = 0
    let run = 0
    for (let y = 0; y < h; y += 1) {
      if (lumaAt(raster, x, y) < 90) run += 1
      else run = 0
      if (run > best) best = run
    }
    if (best >= 1.8 / mpp) long.push(x)
  }
  if (long.length < 2) return undefined
  const runs = mergeRuns(long.map((x) => ({ from: x, to: x })), 2).filter((r) => r.to - r.from + 1 >= 0.15 / mpp)
  if (runs.length < 2) return undefined
  const left = runs[0].from
  const right = runs[runs.length - 1].to + 1
  const widthM = (right - left) * mpp
  const match = spans.map((s) => ({ s, err: Math.abs(s.to - s.from - widthM) })).sort((a, b) => a.err - b.err)[0]
  if (!match || match.err > 0.6) return undefined
  // The scale is the span the walls were matched to over the pixels between
  // them: a sheet is isotropic, and the ladder's own scale (fitted through a
  // few small labels) is kept only as the hint that chose the span.
  mpp = match.s.to - match.s.from > 0 ? (match.s.to - match.s.from) / (right - left) : mpp
  void ridgeY
  const originCol = left - match.s.from / mpp
  return {
    frameId,
    mpp,
    zeroRow,
    originCol: round6(originCol),
    axis: match.s.axis,
    yOf: (py) => round6((zeroRow - py) * mpp),
    alongOf: (px) => round6((px - originCol) * mpp),
    pxOf: (along) => round6(originCol + along / mpp),
    pyOf: (y) => round6(zeroRow - y / mpp),
  }
}

/** 005Y-N1: the largest disagreement between a section's wall-span scale and its two printed levels' scale. */
export const SECTION_TWO_ANCHOR_TOLERANCE = 0.05

/**
 * 005Y-N1: a section the metric reading could not scale by a ladder of levels (it read too few to check one) is
 * registered for the chimneys alone by two independent anchors: its wall columns matched to the plan's span (the
 * horizontal scale, `registerSection`) and two printed levels on their marker rules (the vertical scale). Taken only
 * when the two scales agree within `SECTION_TWO_ANCHOR_TOLERANCE`; y = 0 is then placed from the more confident level at
 * the walls' scale. Nothing else is read on a section registered this way.
 */
export function registerSectionByTwoAnchors(
  raster: Raster,
  levels: ReadonlyArray<{ value: number; row: number; confidence: number }>,
  spans: Array<{ axis: 'X' | 'Z'; from: number; to: number }>,
  frameId: string,
): { section: SectionFrame; why: string } | undefined {
  const ranked = [...levels].filter((l) => l.confidence >= 0.5).sort((a, b) => b.confidence - a.confidence)
  const a = ranked[0]
  const b = ranked.find((l) => Math.abs(l.value - (a?.value ?? 0)) >= 1 && Math.abs(l.row - (a?.row ?? 0)) >= 20)
  if (!a || !b) return undefined
  const hint = Math.abs(a.value - b.value) / Math.abs(a.row - b.row)
  const register = (zeroRow: number): SectionFrame | undefined => registerSection(raster, hint, zeroRow, spans, frameId) ?? registerSectionBySlab(raster, hint, zeroRow, spans, frameId)
  const first = register(a.row + a.value / hint)
  if (!first || Math.abs(first.mpp / hint - 1) > SECTION_TWO_ANCHOR_TOLERANCE) return undefined
  const section = register(a.row + a.value / first.mpp)
  if (!section) return undefined
  return { section, why: `the walls' outer faces give ${section.mpp.toFixed(6)} m/px against the plan's span, the printed levels ${a.value} and ${b.value} ${hint.toFixed(6)} m/px (${(Math.abs(section.mpp / hint - 1) * 100).toFixed(1)} % apart)` }
}

/**
 * 005Y-N1: the outer faces of a section's walls where no wall is drawn as one long column (a single storey cut through
 * its windows): the widest slab — rows of solid ink at least 0.12 m thick whose longest dark span is the same within
 * 3 px, at least 3 m long at the hint's scale — runs from outer face to outer face. A span joins dark runs across gaps
 * of up to 0.6 m (a watermark printed over the slab breaks it) and is at least 70 % ink. Its width is matched to the
 * plan's span as `registerSection` matches the walls'.
 */
function registerSectionBySlab(raster: Raster, mppHint: number, zeroRow: number, spans: Array<{ axis: 'X' | 'Z'; from: number; to: number }>, frameId: string): SectionFrame | undefined {
  const maxGap = Math.max(6, Math.round(0.6 / mppHint))
  const longest: Array<{ from: number; to: number }> = []
  for (let y = 0; y < raster.height; y += 1) {
    const runs: Array<{ from: number; to: number }> = []
    let start = -1
    for (let x = 0; x <= raster.width; x += 1) {
      const dark = x < raster.width && lumaAt(raster, x, y) < 90
      if (dark && start < 0) start = x
      if (!dark && start >= 0) {
        runs.push({ from: start, to: x - 1 })
        start = -1
      }
    }
    let best = { from: 0, to: -1 }
    for (let i = 0; i < runs.length; i += 1) {
      let ink = 0
      for (let j = i; j < runs.length; j += 1) {
        if (j > i && runs[j].from - runs[j - 1].to - 1 > maxGap) break
        ink += runs[j].to - runs[j].from + 1
        const span = { from: runs[i].from, to: runs[j].to }
        if (ink >= 0.7 * (span.to - span.from + 1) && span.to - span.from > best.to - best.from) best = span
      }
    }
    longest.push(best)
  }
  const minRun = 3 / mppHint
  const minRows = Math.max(3, Math.round(0.12 / mppHint))
  let slab: { from: number; to: number } | undefined
  for (let y = 0; y < longest.length; ) {
    const r = longest[y]
    if (r.to - r.from + 1 < minRun) {
      y += 1
      continue
    }
    let k = y + 1
    while (k < longest.length && Math.abs(longest[k].from - r.from) <= 3 && Math.abs(longest[k].to - r.to) <= 3) k += 1
    if (k - y >= minRows && (!slab || r.to - r.from > slab.to - slab.from)) slab = r
    y = k
  }
  if (!slab) return undefined
  const left = slab.from
  const right = slab.to + 1
  const widthM = (right - left) * mppHint
  const match = spans.map((sp) => ({ sp, err: Math.abs(sp.to - sp.from - widthM) })).sort((p, q) => p.err - q.err)[0]
  if (!match || match.err > 0.6) return undefined
  const mpp = (match.sp.to - match.sp.from) / (right - left)
  const originCol = left - match.sp.from / mpp
  return {
    frameId,
    mpp,
    zeroRow,
    originCol: round6(originCol),
    axis: match.sp.axis,
    yOf: (py) => round6((zeroRow - py) * mpp),
    alongOf: (px) => round6((px - originCol) * mpp),
    pxOf: (along) => round6(originCol + along / mpp),
    pyOf: (y) => round6(zeroRow - y / mpp),
  }
}

/** 005Y-N1: a stack on a section: at least this tall above the roof, its sides broken by no more than this many rows (a hatch line drawn across it). */
export const SECTION_STACK_MIN_M = 0.3
const SECTION_STACK_MAX_BREAK_ROWS = 2
/** 005Y-N1: a section's thin outline ink (stacks are drawn lighter than the cut). */
const SECTION_LINE_BELOW = 215

/**
 * 005Y-N1: a chimney stack the section draws above the roof over a plan block. Upward from where the roof meets the
 * block, a row is a stack's when it has outline ink on each side of the block's centre — within 0.3 m outside the
 * block's edges, the two at least half the block's width apart — and paper (at least 80 %) between them. The stack
 * stands when the longest run of such rows (broken by at most `SECTION_STACK_MAX_BREAK_ROWS`) starts within 0.15 m
 * above the roof line the section draws over the block's centre — which must lie within 1 m of the model's roof there —
 * and is at least `SECTION_STACK_MIN_M` tall; its top is the run's top row. Nothing under the drawn roof counts. The block's edges are the plan's;
 * the stack drawn on the section may be wider (its cladding), never elsewhere.
 */
export function sectionStackOver(raster: Raster, section: SectionFrame, along: { from: number; to: number }, roofY: number): { topY: number; heightM: number } | undefined {
  const p0 = section.pxOf(along.from)
  const p1 = section.pxOf(along.to)
  const a = Math.min(p0, p1)
  const b = Math.max(p0, p1)
  if (b - a < 4) return undefined
  const centre = Math.round((a + b) / 2)
  const reach = 0.3 / section.mpp
  const lo = Math.max(0, Math.floor(a - reach))
  const hi = Math.min(raster.width - 1, Math.ceil(b + reach))
  const isInk = (x: number, y: number): boolean => lumaAt(raster, x, y) < SECTION_LINE_BELOW
  const stackRow = (y: number): boolean => {
    let left = -1
    for (let x = centre; x >= lo; x -= 1) if (isInk(x, y)) { left = x; break }
    let right = -1
    for (let x = centre + 1; x <= hi; x += 1) if (isInk(x, y)) { right = x; break }
    if (left < 0 || right < 0 || right - left < 0.5 * (b - a)) return false
    let paper = 0
    for (let x = left + 1; x < right; x += 1) if (!isInk(x, y)) paper += 1
    return paper >= 0.8 * Math.max(1, right - left - 1)
  }
  // The roof as the section draws it over the block's centre: the first thick cut line from the top. Only what stands
  // above it is a stack (an attic's struts and flues below it are not), and it must be the roof the model has there.
  let roofRow = -1
  for (let y = 0, run = 0; y < raster.height; y += 1) {
    run = lumaAt(raster, centre, y) < 90 ? run + 1 : 0
    if (run >= 3) {
      roofRow = y - 2
      break
    }
  }
  if (roofRow < 0 || Math.abs(section.yOf(roofRow) - roofY) > 1) return undefined
  const start = roofRow - 1
  const stop = Math.max(0, Math.round(section.pyOf(roofY + 4)))
  const leadIn = Math.round(0.15 / section.mpp)
  let best: { bottom: number; top: number } | undefined
  let runBottom = -1
  let misses = 0
  for (let y = start; y >= stop; y -= 1) {
    if (stackRow(y)) {
      if (runBottom < 0) runBottom = y
      misses = 0
      if (runBottom >= start - leadIn && (!best || runBottom - y > best.bottom - best.top)) best = { bottom: runBottom, top: y }
    } else if (runBottom >= 0 && misses < SECTION_STACK_MAX_BREAK_ROWS) misses += 1
    else {
      runBottom = -1
      misses = 0
    }
  }
  if (!best) return undefined
  const heightM = (best.bottom - best.top + 1) * section.mpp
  if (heightM < SECTION_STACK_MIN_M) return undefined
  return { topY: round6(section.yOf(best.top)), heightM: round6(heightM) }
}

export type AttachedRoofReading = {
  massId: string
  slabTopY: number
  slabSoffitY: number
  /** The top of the wall that continues above the slab, when one does. */
  parapetTopY?: number
  clearHeightM: number
  confidence: number
  why: string
}

/**
 * A flat roof over an attached body as the section draws it: the topmost
 * horizontal thick band across the body's span, and the wall that stands
 * above it at the outer end.
 */
export function readAttachedRoof(raster: Raster, section: SectionFrame, massId: string, span: { from: number; to: number }, floorY: number, maxY: number): AttachedRoofReading | undefined {
  const c0 = section.pxOf(span.from)
  const c1 = section.pxOf(span.to)
  const from = Math.min(c0, c1)
  const to = Math.max(c0, c1)
  // Sample columns through the middle 60 % of the span, avoiding the walls.
  const cols: number[] = []
  for (let f = 0.25; f <= 0.75; f += 0.1) cols.push(round6(from + (to - from) * f))
  const bands: Array<{ top: number; bottom: number }> = []
  const rowTop = section.pyOf(maxY)
  const rowBottom = section.pyOf(floorY + 0.3)
  for (const x of cols) {
    const runs = inkRuns(raster, 'Y', x, Math.min(rowTop, rowBottom), Math.max(rowTop, rowBottom), 100, Math.max(3, Math.round(0.12 / section.mpp)))
    // The highest run thick enough to be a slab.
    const slab = runs.filter((r) => (r.to - r.from + 1) * section.mpp >= 0.15 && (r.to - r.from + 1) * section.mpp <= 0.6).sort((a, b) => a.from - b.from)[0]
    if (slab) bands.push({ top: slab.from, bottom: slab.to })
  }
  if (bands.length < 3) return undefined
  const top = median(bands.map((b) => b.top))
  const bottom = median(bands.map((b) => b.bottom))
  const slabTopY = section.yOf(top)
  const slabSoffitY = section.yOf(bottom + 1)
  // Parapet: at the outer end wall's columns, does the wall continue above
  // the slab top? A hatched wall is read by the share of its columns that are
  // ink on each row, not by one pixel.
  const outerCol = Math.abs(c1 - section.pxOf(0)) > Math.abs(c0 - section.pxOf(0)) ? c1 : c0
  const inward = outerCol === c1 ? -1 : 1
  const wallCols: number[] = []
  for (let d = 0.03; d <= 0.4; d += 0.03) wallCols.push(Math.round(outerCol + (inward * d) / section.mpp))
  let parapetTopY: number | undefined
  let y = top - 1
  while (y > 0) {
    let dark = 0
    for (const x of wallCols) if (lumaAt(raster, x, y) < 130) dark += 1
    if (dark / wallCols.length < 0.35) break
    y -= 1
  }
  const above = (top - 1 - y) * section.mpp
  if (above >= 0.08) parapetTopY = section.yOf(y + 1)
  return {
    massId,
    slabTopY: round6(slabTopY),
    slabSoffitY: round6(slabSoffitY),
    parapetTopY: parapetTopY === undefined ? undefined : round6(parapetTopY),
    clearHeightM: round6(slabSoffitY - floorY),
    confidence: 0.75,
    why: `the section draws a ${((bottom - top + 1) * section.mpp).toFixed(2)} m slab with its top at ${slabTopY.toFixed(2)} over this body on ${bands.length} columns${parapetTopY !== undefined ? ` and its outer wall continues to ${parapetTopY.toFixed(2)}` : ''}`,
  }
}

/** 005Y: how far the main roof projects past the walls under its eaves, as a section across the ridge draws it. */
export type EavesReading = {
  overhangM: number
  sides: Array<{ face: 'LEFT' | 'RIGHT'; overhangM: number; columns: number; residualPx: number }>
  /** Metres per pixel of the section, from its outer walls matched to the span across the ridge. */
  mpp: number
  /** The pitch the section's roof lines draw, against the stated one. */
  drawnPitchDeg: [number, number]
  /** World y of the underside of the eaves' lip the reading implies, when the section's vertical datum is known. */
  lipUndersideY?: number
  /** A printed level on the section that marks that lip, when one does. */
  printedLipY?: number
  confidence: number
  why: string
}

/** The eaves projections a section may show: below the lower bound there is nothing to draw, above the upper it is no eaves. */
const EAVES_OVERHANG_M = { min: 0.12, max: 1.5 } as const
/** How far the two eaves of one roof may differ for one projection to stand for both. */
const EAVES_SIDES_AGREE_M = 0.3
/** How far the slope the section draws may differ from the stated pitch, in degrees, for the lines to be the roof's. */
const EAVES_PITCH_AGREE_DEG = 4
/** How far from the fitted roof line the roof's top ink may lie, in pixels, and still be that line. */
const EAVES_LINE_TOLERANCE_PX = 3
/** A printed level within this of the implied lip underside corroborates it. */
const EAVES_PRINTED_TOLERANCE_M = 0.15
/** The two outer walls of a section must span at least this share of the sheet's width to be the body's. */
const EAVES_MIN_SPAN_SHARE = 0.2

/** The topmost ink row of a column between two rows, or undefined. */
function topInk(raster: Raster, x: number, from: number, to: number): number | undefined {
  for (let y = Math.max(0, from); y <= Math.min(raster.height - 1, to); y += 1) if (lumaAt(raster, x, y) < 110) return y
  return undefined
}

/** The share of a slope's columns whose topmost ink must lie on its line for the line to be the roof's. */
const EAVES_MIN_LINE_SHARE = 0.35
/** The roof's apex must stand this close to the middle of the walls, as a share of their span, for them to be its outer walls. */
const EAVES_APEX_CENTRED_SHARE = 0.04

/**
 * The roof's top line over columns x0..x1 of a top-ink profile: the intercept the stated slope gathers most columns on
 * (a vote, so a chimney, a label or a rooflight above the slope does not move it), then the slope and intercept
 * refitted to those columns by least squares.
 */
function slopeLine(top: ReadonlyArray<number | undefined>, x0: number, x1: number, slope: number): { slope: number; intercept: number; share: number; residualPx: number } | undefined {
  const votes = new Map<number, number>()
  let n = 0
  for (let x = x0; x <= x1; x += 1) {
    const y = top[x]
    if (y === undefined) continue
    n += 1
    const c = Math.round(y - slope * x)
    for (let d = -1; d <= 1; d += 1) votes.set(c + d, (votes.get(c + d) ?? 0) + (d === 0 ? 2 : 1))
  }
  if (n < 6) return undefined
  const best = [...votes.entries()].sort((p, q) => q[1] - p[1] || p[0] - q[0])[0]
  if (!best) return undefined
  const on: Array<{ x: number; y: number }> = []
  for (let x = x0; x <= x1; x += 1) {
    const y = top[x]
    if (y !== undefined && Math.abs(y - (best[0] + slope * x)) <= EAVES_LINE_TOLERANCE_PX) on.push({ x, y })
  }
  if (on.length < Math.max(6, EAVES_MIN_LINE_SHARE * (x1 - x0 + 1))) return undefined
  const mx = on.reduce((acc, p) => acc + p.x, 0) / on.length
  const my = on.reduce((acc, p) => acc + p.y, 0) / on.length
  const sxx = on.reduce((acc, p) => acc + (p.x - mx) ** 2, 0)
  const fitted = sxx > 0 ? on.reduce((acc, p) => acc + (p.x - mx) * (p.y - my), 0) / sxx : slope
  const intercept = my - fitted * mx
  return { slope: fitted, intercept, share: on.length / (x1 - x0 + 1), residualPx: median(on.map((p) => Math.abs(p.y - (intercept + fitted * p.x)))) }
}

/**
 * 005Y: the main roof's eaves projection from a section that cuts across its ridge.
 *
 * The section's own scale comes from its outer walls matched to the body's span across the ridge; nothing about the
 * sheet's printed levels is needed. Walls are the long, thick vertical runs of ink; of every pair of them, the outer
 * walls are the widest pair over which the roof's two top lines — each found by a vote at the stated pitch over the
 * columns between a wall and the middle, then refitted — draw the stated pitch within a few degrees and meet over the
 * middle of the pair. A section along the ridge, a post beside the house, or a wall inside it does not pass. From
 * each outer wall face the line is then followed outward while the topmost ink stays on it; where it ends, the eaves
 * end. Both eaves must be read and agree, or nothing is returned: the projection is then unknown and the roof keeps
 * its edge at the walls. A horizontal line beside the house (a pergola, a terrace) leaves the sloping line within a
 * few columns and does not extend the reading.
 *
 * When the section's vertical datum is registered, a printed level that marks the lip the projection implies (its
 * underside, the roof's vertical thickness below the top) corroborates it; it is never the source of the number.
 */
export function readEavesOverhang(
  raster: Raster,
  spanAcrossRidgeM: number,
  roof: { pitchDeg: number; thicknessM: number },
  datum?: { zeroRow: number; mppY: number; printedLevels: readonly number[] },
  onDebug?: (message: string) => void,
): EavesReading | undefined {
  const slopeStated = Math.tan((roof.pitchDeg * Math.PI) / 180)
  if (!(slopeStated > 0.05) || !(spanAcrossRidgeM > 2)) return undefined
  const w = raster.width
  const h = raster.height
  // Columns whose longest dark run is long: walls (and posts, flues, partitions — the pairing sorts them out).
  const longest: number[] = []
  const top: Array<number | undefined> = []
  for (let x = 0; x < w; x += 1) {
    let best = 0
    let run = 0
    for (let y = 0; y < h; y += 1) {
      if (lumaAt(raster, x, y) < 90) run += 1
      else run = 0
      if (run > best) best = run
    }
    longest.push(best)
    top.push(topInk(raster, x, 0, h - 1))
  }
  const tallest = Math.max(...longest)
  if (tallest < 40) return undefined
  const cols: number[] = []
  for (let x = 0; x < w; x += 1) if (longest[x] >= Math.max(40, 0.25 * tallest)) cols.push(x)
  const runs = mergeRuns(cols.map((x) => ({ from: x, to: x })), 2).filter((r) => r.to - r.from + 1 >= 4)
  onDebug?.(`eaves wall candidates: ${runs.map((r) => `${r.from}..${r.to}`).join(' ')}`)
  type Pair = { left: number; right: number; lines: { LEFT: NonNullable<ReturnType<typeof slopeLine>>; RIGHT: NonNullable<ReturnType<typeof slopeLine>> }; drawn: [number, number] }
  let chosen: Pair | undefined
  for (let i = 0; i < runs.length; i += 1) {
    for (let j = runs.length - 1; j > i; j -= 1) {
      const left = runs[i].from
      const right = runs[j].to + 1
      if (right - left < EAVES_MIN_SPAN_SHARE * w || (chosen && right - left <= chosen.right - chosen.left)) continue
      const mid = (left + right) / 2
      const inset = Math.round(0.08 * (right - left))
      const l = slopeLine(top, left + 2, Math.round(mid) - inset, -slopeStated)
      const r = slopeLine(top, Math.round(mid) + inset, right - 2, slopeStated)
      if (!l || !r) continue
      const drawn: [number, number] = [round6((Math.atan(-l.slope) * 180) / Math.PI), round6((Math.atan(r.slope) * 180) / Math.PI)]
      if (drawn.some((d) => Math.abs(d - roof.pitchDeg) > EAVES_PITCH_AGREE_DEG)) continue
      const apexX = (r.intercept - l.intercept) / (l.slope - r.slope)
      if (Math.abs(apexX - mid) > EAVES_APEX_CENTRED_SHARE * (right - left)) continue
      chosen = { left, right, lines: { LEFT: l, RIGHT: r }, drawn }
    }
  }
  if (!chosen) return undefined
  const { left, right, lines, drawn } = chosen
  const mpp = spanAcrossRidgeM / (right - left)
  onDebug?.(`eaves walls ${left}..${right} at ${mpp.toFixed(5)} m/px, lines drawn at ${drawn.join('° / ')}° on ${(lines.LEFT.share * 100).toFixed(0)} % / ${(lines.RIGHT.share * 100).toFixed(0)} % of their columns`)
  const sides: EavesReading['sides'] = []
  for (const face of ['LEFT', 'RIGHT'] as const) {
    const line = lines[face]
    const dir = face === 'LEFT' ? -1 : 1
    const wallCol = face === 'LEFT' ? left : right - 1
    const gapCols = Math.max(2, Math.round(0.08 / mpp))
    const maxCols = Math.ceil((EAVES_OVERHANG_M.max + 0.3) / mpp)
    let last = -1
    let miss = 0
    let columns = 0
    for (let k = 1; k <= maxCols; k += 1) {
      const x = wallCol + dir * k
      const expected = line.intercept + line.slope * x
      // On the line: ink within the tolerance of it (a beam or a label just above does not hide the roof under it).
      const y = topInk(raster, x, Math.round(expected - EAVES_LINE_TOLERANCE_PX), Math.round(expected + EAVES_LINE_TOLERANCE_PX))
      if (y !== undefined) {
        last = k
        miss = 0
        columns += 1
      } else if (++miss > gapCols) break
    }
    onDebug?.(`eaves ${face}: followed ${last} columns (${columns} on the line)`)
    if (last < 0) return undefined
    sides.push({ face, overhangM: round6(last * mpp), columns, residualPx: round6(line.residualPx) })
  }
  const [a, b] = sides
  if (sides.some((x) => x.overhangM < EAVES_OVERHANG_M.min || x.overhangM > EAVES_OVERHANG_M.max)) return undefined
  if (Math.abs(a.overhangM - b.overhangM) > EAVES_SIDES_AGREE_M) return undefined
  // One projection for both eaves: the smaller, so neither eave is drawn past what the section shows.
  const overhangM = round6(Math.min(a.overhangM, b.overhangM))
  let lipUndersideY: number | undefined
  let printedLipY: number | undefined
  if (datum) {
    const drop = roof.thicknessM / Math.cos((roof.pitchDeg * Math.PI) / 180)
    const narrow = a.overhangM <= b.overhangM ? a : b
    const line = lines[narrow.face]
    const lipCol = narrow.face === 'LEFT' ? left - Math.round(narrow.overhangM / mpp) : right - 1 + Math.round(narrow.overhangM / mpp)
    lipUndersideY = round6((datum.zeroRow - (line.intercept + line.slope * lipCol)) * datum.mppY - drop)
    const lip = lipUndersideY
    printedLipY = datum.printedLevels.filter((v) => Math.abs(v - lip) <= EAVES_PRINTED_TOLERANCE_M).sort((p, q) => Math.abs(p - lip) - Math.abs(q - lip))[0]
  }
  return {
    overhangM,
    sides,
    mpp: round6(mpp),
    drawnPitchDeg: drawn,
    ...(lipUndersideY !== undefined ? { lipUndersideY } : {}),
    ...(printedLipY !== undefined ? { printedLipY } : {}),
    confidence: printedLipY !== undefined ? 0.85 : 0.7,
    why: `the section's roof lines (drawn at ${drawn[0].toFixed(1)}° and ${drawn[1].toFixed(1)}° against the stated ${roof.pitchDeg}°, meeting over the middle of the outer walls) run ${a.overhangM.toFixed(2)} m and ${b.overhangM.toFixed(2)} m past those walls (${a.columns} and ${b.columns} columns at ${mpp.toFixed(4)} m/px, the walls matched to the ${spanAcrossRidgeM.toFixed(2)} m span across the ridge)${lipUndersideY !== undefined ? `; the eaves' lip then sits at ${lipUndersideY.toFixed(2)}${printedLipY !== undefined ? `, where the section prints ${printedLipY >= 0 ? '+' : ''}${printedLipY.toFixed(2)}` : ', which no printed level marks'}` : ''}`,
  }
}

export type ChimneyReading = {
  id: string
  x0: number
  z0: number
  x1: number
  z1: number
  topY?: number
  storeysSeen: number[]
  renderFrames: string[]
  /** 005Y-N1: the section that draws its stack above the roof, when that is what confirms it. */
  sectionFrameId?: string
  confidence: number
  why: string
}

/**
 * Chimneys: solid blocks that stand on the same plan position on every storey
 * that has a plan, and rise above the roof line on a render whose columns
 * cover them.
 */
export function readChimneys(blocksByStorey: ReadonlyArray<{ storeyIndex: number; blocks: readonly SolidBlock[] }>, views: ReadonlyArray<{ view: ElevationFrameV2; raster: Raster }>, roofTopY: (x: number, z: number) => number, trace?: (record: Record<string, unknown>) => void): ChimneyReading[] {
  if (trace) for (const s of blocksByStorey) for (const b of s.blocks) trace({ kind: 'SOLID_BLOCK', storey: s.storeyIndex, rect: { x0: b.x0, z0: b.z0, x1: b.x1, z1: b.z1 } })
  const top = blocksByStorey.reduce((a, b) => (b.storeyIndex > a.storeyIndex ? b : a), blocksByStorey[0])
  if (!top) return []
  const out: ChimneyReading[] = []
  for (const block of top.blocks) {
    const cx = (block.x0 + block.x1) / 2
    const cz = (block.z0 + block.z1) / 2
    const storeysSeen = blocksByStorey.filter((s) => s.blocks.some((b) => Math.abs((b.x0 + b.x1) / 2 - cx) < 0.35 && Math.abs((b.z0 + b.z1) / 2 - cz) < 0.35)).map((s) => s.storeyIndex)
    // On a render of a facade: the column over the block's centre, above the roof plane.
    const renderFrames: string[] = []
    let topY: number | undefined
    for (const { view, raster } of views) {
      const along = view.side === 'FRONT' || view.side === 'REAR' ? cx : cz
      const px = view.pxOf(along)
      const roofY = roofTopY(cx, cz)
      const yStart = view.pyOf(roofY + 0.15)
      const yEnd = view.pyOf(roofY + 3.0)
      // Dark, neutral column straight up from the roof line.
      let y = yStart
      let count = 0
      while (y > yEnd) {
        const t = toneClass(rgbAt(raster, px, y))
        if (t === 'DARK' || t === 'MID') count += 1
        else break
        y -= 1
      }
      const heightM = count * view.registration.metresPerPixelV
      if (heightM >= 0.4) {
        renderFrames.push(view.registration.frameId)
        const yTop = view.yOf(y + 1)
        topY = topY === undefined ? yTop : (topY + yTop) / 2
      }
    }
    trace?.({ kind: 'CHIMNEY_BLOCK', storey: top.storeyIndex, rect: { x0: block.x0, z0: block.z0, x1: block.x1, z1: block.z1 }, storeysSeen, renderFrames, viewsTried: views.map((v) => v.view.registration.frameId), decision: storeysSeen.length < Math.min(2, blocksByStorey.length) && renderFrames.length === 0 ? 'REJECTED' : 'READ', reason: storeysSeen.length < Math.min(2, blocksByStorey.length) && renderFrames.length === 0 ? 'on one storey only and above the roof on no registered render' : undefined })
    if (storeysSeen.length < Math.min(2, blocksByStorey.length) && renderFrames.length === 0) continue
    out.push({
      id: `chimney-${out.length}`,
      x0: block.x0,
      z0: block.z0,
      x1: block.x1,
      z1: block.z1,
      topY: topY === undefined ? undefined : round6(topY),
      storeysSeen,
      renderFrames,
      confidence: round6(Math.min(0.9, 0.4 + 0.2 * storeysSeen.length + 0.15 * renderFrames.length)),
      why: `a ${(block.x1 - block.x0).toFixed(2)} × ${(block.z1 - block.z0).toFixed(2)} m solid block drawn on storey${storeysSeen.length === 1 ? '' : 's'} ${storeysSeen.join(', ')}${renderFrames.length > 0 ? `, standing ${topY?.toFixed(2)} m tall on ${renderFrames.length} render${renderFrames.length === 1 ? '' : 's'}` : ', not seen above the roof on any render'}`,
    })
  }
  return out
}

export type RooflightReading = {
  id: string
  slope: 'LOW' | 'HIGH'
  /** Along the ridge (z for a ridge along z), and up the slope in plan (x for a ridge along z). */
  alongFrom: number
  alongTo: number
  slopeFrom: number
  slopeTo: number
  yFrom: number
  yTo: number
  frameId: string
  confidence: number
  why: string
}

/**
 * Rooflights on a side render: patches in the roof plane that are markedly
 * LIGHTER than the covering around them — glass reflecting the sky against
 * tiles — of a rooflight's size, not touching the roof region's edges. A
 * chimney is darker than the covering and never qualifies; the caller also
 * removes patches that overlap a chimney's plan position.
 */
export function readRooflights(view: ElevationFrameV2, raster: Raster, roof: { eaveY: number; ridgeY: number; pitchDeg: number; eaveAlong: number; ridgeAlong: number; slope: 'LOW' | 'HIGH' }, walledAlong: { from: number; to: number }, onDebug?: (message: string) => void): RooflightReading[] {
  const yEave = view.pyOf(roof.eaveY + 0.15)
  const yRidge = view.pyOf(roof.ridgeY - 0.15)
  const top = Math.round(Math.min(yEave, yRidge))
  const bottom = Math.round(Math.max(yEave, yRidge))
  const c0 = view.pxOf(walledAlong.from)
  const c1 = view.pxOf(walledAlong.to)
  const left = Math.round(Math.min(c0, c1))
  const right = Math.round(Math.max(c0, c1))
  const W = right - left + 1
  const H = bottom - top + 1
  if (W <= 0 || H <= 0) return []
  const mpp = view.registration.metresPerPixelU
  const lumas: number[] = []
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) lumas.push(lumaAt(raster, left + x, top + y))
  const roofMedian = median(lumas)
  const out: RooflightReading[] = []
  // Glass reflecting the sky is far lighter than the covering, but how far
  // depends on the render: the patch is taken at the lowest step above the
  // covering at which it comes out as a filled rectangle on its own, rather
  // than merged with a lit strip of roof beside it.
  for (const step of [30, 50, 70]) {
  const threshold = roofMedian + step
  const mask = new Uint8Array(W * H)
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) mask[y * W + x] = lumaAt(raster, left + x, top + y) > threshold ? 1 : 0
  const seen = new Uint8Array(W * H)
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (seen[y * W + x] || !mask[y * W + x]) continue
      const stack = [[x, y]]
      seen[y * W + x] = 1
      let n = 0
      let x0 = x
      let x1 = x
      let y0 = y
      let y1 = y
      while (stack.length > 0) {
        const [cx, cy] = stack.pop() as [number, number]
        n += 1
        if (cx < x0) x0 = cx
        if (cx > x1) x1 = cx
        if (cy < y0) y0 = cy
        if (cy > y1) y1 = cy
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = cx + dx
          const ny = cy + dy
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny * W + nx] || !mask[ny * W + nx]) continue
          seen[ny * W + nx] = 1
          stack.push([nx, ny])
        }
      }
      const wM = (x1 - x0 + 1) * mpp
      const hM = (y1 - y0 + 1) * view.registration.metresPerPixelV
      const fill = n / ((x1 - x0 + 1) * (y1 - y0 + 1))
      if (n >= 12 && step === 30) onDebug?.(`${view.side} patch px ${left + x0}..${left + x1} × ${top + y0}..${top + y1}: ${wM.toFixed(2)} × ${hM.toFixed(2)} m, fill ${fill.toFixed(2)}, along ${view.alongOf(left + x0).toFixed(2)}..${view.alongOf(left + x1 + 1).toFixed(2)}, y ${view.yOf(top + y1 + 1).toFixed(2)}..${view.yOf(top + y0).toFixed(2)}${x0 === 0 || y0 === 0 || x1 === W - 1 || y1 === H - 1 ? ' (touches the region edge)' : ''}`)
      if (wM < 0.45 || wM > 1.8 || hM < 0.35 || hM > 1.8 || fill < 0.8) continue
      if (x0 === 0 || y0 === 0 || x1 === W - 1 || y1 === H - 1) continue
      // Already found at a lower step: the same glass.
      const a0px = view.alongOf(left + x0)
      const a1px = view.alongOf(left + x1 + 1)
      if (out.some((r) => Math.min(r.alongTo, Math.max(a0px, a1px)) - Math.max(r.alongFrom, Math.min(a0px, a1px)) > 0.1)) continue
      const a0 = view.alongOf(left + x0)
      const a1 = view.alongOf(left + x1 + 1)
      const yLow = view.yOf(top + y1 + 1)
      const yHigh = view.yOf(top + y0)
      const tan = Math.tan((roof.pitchDeg * Math.PI) / 180)
      const sFrom = (yLow - roof.eaveY) / tan
      const sTo = (yHigh - roof.eaveY) / tan
      const dir = roof.ridgeAlong > roof.eaveAlong ? 1 : -1
      out.push({
        id: `rooflight-${view.side.toLowerCase()}-${out.length}`,
        slope: roof.slope,
        alongFrom: round6(Math.min(a0, a1)),
        alongTo: round6(Math.max(a0, a1)),
        slopeFrom: round6(roof.eaveAlong + dir * Math.min(sFrom, sTo)),
        slopeTo: round6(roof.eaveAlong + dir * Math.max(sFrom, sTo)),
        yFrom: round6(yLow),
        yTo: round6(yHigh),
        frameId: view.registration.frameId,
        confidence: round6(Math.min(0.75, 0.45 + fill * 0.3)),
        why: `a ${wM.toFixed(2)} × ${hM.toFixed(2)} m patch ${Math.round(threshold - roofMedian)} luma lighter than the covering in the roof plane of the ${view.side.toLowerCase()} render (${Math.round(fill * 100)} % filled)`,
      })
    }
  }
  }
  out.sort((a, b) => a.alongFrom - b.alongFrom)
  return out.map((r, i) => ({ ...r, id: `rooflight-${view.side.toLowerCase()}-${i}` }))
}

const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** 005X: a rooflight the top storey's plan states: its callout, standing inside the storey under a slope. */
export type PlanRooflightReading = RooflightReading & { widthM: number; lengthM: number; calloutId: string; centre: { x: number; z: number } }

/** 005Y-N5 (C2): rings this close in distance from the eave stand in one row; symbols this close end at one eave line. */
const ROW_ACROSS_M = 0.05

/** The sizes a callout inside a roofed storey may state for a rooflight, in metres: outside them it is some other symbol. */
const ROOFLIGHT_WIDTH_M = { min: 0.3, max: 1.6 } as const
const ROOFLIGHT_LENGTH_M = { min: 0.4, max: 2.0 } as const

/**
 * 005Y-N1: a ring the metric reading's recogniser read (`calloutRings`, schema 1.9.0) reads what it read: the reading at
 * the same centre on the same frame (within `RING_MATCH_PX`) whose two halves both passed the recogniser's gate replaces
 * the template's halves. Every other ring is returned as it was. The ring's circle and bar are the finder's own.
 */
export const RING_MATCH_PX = 2.5
export function withRecognisedHalves(callouts: ReadonlyArray<CalloutReading>, frameId: string, rings: ReadonlyArray<CalloutRingRecord> | undefined): CalloutReading[] {
  const own = (rings ?? []).filter((r) => r.frameId === frameId && r.accepted)
  return callouts.map((c) => {
    const r = own.find((k) => Math.hypot(k.centrePx.x - c.circle.cx, k.centrePx.y - c.circle.cy) <= RING_MATCH_PX)
    if (!r || r.width.valueCm === undefined || r.height.valueCm === undefined) return c
    // 005Y-N2: a half the gate took only because another ring on the same sheet reads the pair outright is that ring's
    // reading carried over — the same publisher's ink, not a second witness — and says so
    const lifted = [r.width, r.height].filter((h) => /on this sheet reads/.test(h.why))
    const how = lifted.length > 0 ? `supported by a sibling on the same sheet (${lifted.map((h) => h.why).join('; ')}), not an independent reading` : 'outright, both halves'
    return { ...c, upperText: r.width.text, lowerText: r.height.text, widthCm: r.width.valueCm, heightCm: r.height.valueCm, why: `${c.why}; the recogniser read ${r.width.text}/${r.height.text} (${r.id}), ${how}` }
  })
}

/**
 * 005X: rooflights from the plan of the storey under the roof. A plan states a rooflight the way it states a window: a
 * `width / length` callout, here standing inside the storey rather than beside a wall, on the part of the floor a slope
 * covers. Each callout read as a coherent pair, split by its bar, whose centre lies inside the storey's walls and whose
 * numbers are a rooflight's size, is one rooflight: along the ridge it is centred on the callout and as wide as the
 * callout says; up the slope it is centred on the callout too, its plan depth the stated length foreshortened by the
 * pitch. Where up the slope the publisher drew the symbol relative to the glass is not known, so that position stays
 * an uncertainty of the caller's record; the existence, the slope, the along-ridge place and the size are the plan's.
 */
export function readPlanRooflights(
  callouts: ReadonlyArray<CalloutReading>,
  plan: Pick<PlanFrameV2, 'toWorld' | 'frameId'>,
  body: { x0: number; z0: number; x1: number; z1: number },
  wallThicknessM: number,
  roof: { ridgeAxis: 'X' | 'Z'; ridgeAt: number; pitchDeg: number; eaveY: number },
  /** 005Y-N1: diagnostics only (FEATURE_DEBUG): every ring and what became of it. Write-only. */
  trace?: (record: Record<string, unknown>) => void,
  /** 005Y-N4 (A): the plan's raster, to find each rooflight's drawn symbol beside its ring (`drawnRooflightSymbol`). */
  raster?: Raster,
): PlanRooflightReading[] {
  const tan = Math.tan((roof.pitchDeg * Math.PI) / 180)
  const cos = Math.cos((roof.pitchDeg * Math.PI) / 180)
  const out: PlanRooflightReading[] = []
  type Read = { c: CalloutReading; base: Record<string, unknown> | undefined; widthM: number; lengthM: number; centre: { x: number; z: number }; along: number; ringAcross: number; upslope: 1 | -1; symbol: DrawnRooflightSymbol | undefined }
  const read: Read[] = []
  for (const c of callouts) {
    const base = trace ? { kind: 'ROOFLIGHT_RING', frameId: plan.frameId, calloutId: c.id, circle: c.circle, upperText: c.upperText, lowerText: c.lowerText, widthCm: c.widthCm, heightCm: c.heightCm, bar: !!c.bar, world: plan.toWorld(c.circle.cx, c.circle.cy) } : undefined
    const reject = (reason: string): void => {
      if (base) trace?.({ ...base, decision: 'REJECTED', reason })
    }
    if (c.widthCm === null || c.heightCm === null || !c.bar) {
      reject(!c.bar ? 'no bar' : 'the halves were not read as one coherent pair')
      continue
    }
    const widthM = c.widthCm / 100
    const lengthM = c.heightCm / 100
    if (widthM < ROOFLIGHT_WIDTH_M.min || widthM > ROOFLIGHT_WIDTH_M.max || lengthM < ROOFLIGHT_LENGTH_M.min || lengthM > ROOFLIGHT_LENGTH_M.max) {
      reject(`${c.widthCm}/${c.heightCm} is not a rooflight's size (width ${ROOFLIGHT_WIDTH_M.min}..${ROOFLIGHT_WIDTH_M.max} m, length ${ROOFLIGHT_LENGTH_M.min}..${ROOFLIGHT_LENGTH_M.max} m)`)
      continue
    }
    const centre = plan.toWorld(c.circle.cx, c.circle.cy)
    const inside = centre.x > body.x0 + wallThicknessM && centre.x < body.x1 - wallThicknessM && centre.z > body.z0 + wallThicknessM && centre.z < body.z1 - wallThicknessM
    if (!inside) {
      reject('its centre is not inside the storey walls')
      continue
    }
    const along = roof.ridgeAxis === 'X' ? centre.x : centre.z
    const ringAcross = roof.ridgeAxis === 'X' ? centre.z : centre.x
    // 005Y-N4 (A): up the slope the rooflight is where its symbol is drawn; the ring is printed near it, not on its centre
    // up the slope is toward the ridge: away from the eave of the slope the ring stands on
    const upslope: 1 | -1 = ringAcross < roof.ridgeAt ? 1 : -1
    const symbol = raster ? drawnRooflightSymbol(raster, plan as Pick<PlanFrameV2, 'toPixel' | 'toWorld'>, c.circle, widthM, lengthM * cos, roof.ridgeAxis, base ? (d) => trace?.({ kind: 'ROOFLIGHT_SYMBOL_DEBUG', calloutId: c.id, ...d }) : undefined, upslope) : undefined
    read.push({ c, base, widthM, lengthM, centre, along, ringAcross, upslope, symbol })
  }
  // 005Y-N5 (C2): rings of one row — one slope, one printed size, the same distance from the eave (within
  // `ROW_ACROSS_M`) — share the line their symbols stop at toward the eave. Where every symbol read in the row stops at
  // one eave line, a ring whose own symbol was not read takes that line, its depth the printed length's projection.
  const eaveEnd = (r: Read): number | undefined => (r.symbol ? (r.upslope > 0 ? r.symbol.acrossFrom : r.symbol.acrossTo) : undefined)
  const rowOf = (r: Read): Read[] => read.filter((x) => x.upslope === r.upslope && x.c.widthCm === r.c.widthCm && x.c.heightCm === r.c.heightCm && Math.abs(x.ringAcross - r.ringAcross) <= ROW_ACROSS_M)
  for (const r of read) {
    const { c, base, widthM, lengthM, centre, along, ringAcross, upslope, symbol } = r
    const reject = (reason: string): void => {
      if (base) trace?.({ ...base, decision: 'REJECTED', reason })
    }
    const row = symbol ? [] : rowOf(r)
    const ends = row.map(eaveEnd).filter((e): e is number => e !== undefined)
    const rowEave = ends.length > 0 && Math.max(...ends) - Math.min(...ends) <= ROW_ACROSS_M ? ends.reduce((a, b) => a + b, 0) / ends.length : undefined
    const across = symbol ? (symbol.acrossFrom + symbol.acrossTo) / 2 : rowEave !== undefined ? rowEave + (upslope * lengthM * cos) / 2 : ringAcross
    const slope: 'LOW' | 'HIGH' = across < roof.ridgeAt ? 'LOW' : 'HIGH'
    const eaveAlong = roof.ridgeAxis === 'X' ? (slope === 'LOW' ? body.z0 : body.z1) : slope === 'LOW' ? body.x0 : body.x1
    const depth = lengthM * cos
    // Up the slope: centred on the callout, kept between the wall plane and the ridge.
    const lo = slope === 'LOW' ? eaveAlong + 0.05 : roof.ridgeAt + 0.05
    const hi = slope === 'LOW' ? roof.ridgeAt - 0.05 : eaveAlong - 0.05
    if (hi - lo < depth) {
      reject('the slope is too short for its plan depth')
      continue
    }
    if (base) trace?.({ ...base, decision: 'READ', slope: across < roof.ridgeAt ? 'LOW' : 'HIGH', ringAcrossM: round6(ringAcross), symbol: symbol ?? null, acrossM: round6(across), residualM: round6(across - ringAcross), ...(rowEave !== undefined ? { rowEave: round6(rowEave), rowSymbols: ends.length } : {}) })
    const from = Math.min(Math.max(across - depth / 2, lo), hi - depth)
    const to = from + depth
    const heightAt = (a: number): number => roof.eaveY + Math.abs(a - eaveAlong) * tan
    out.push({
      id: '',
      slope,
      alongFrom: round6(along - widthM / 2),
      alongTo: round6(along + widthM / 2),
      slopeFrom: round6(from),
      slopeTo: round6(to),
      yFrom: round6(Math.min(heightAt(from), heightAt(to))),
      yTo: round6(Math.max(heightAt(from), heightAt(to))),
      frameId: plan.frameId,
      confidence: round6(Math.min(0.8, 0.4 + c.confidence * 0.6)),
      why: `a ${c.widthCm}/${c.heightCm} callout inside the storey under the roof, on the ${slope === 'LOW' ? 'lower-coordinate' : 'higher-coordinate'} slope at ${along.toFixed(2)} m along the ridge (${c.why})${symbol ? `; up the slope where its symbol is drawn: ${symbol.why}, ${(across - ringAcross).toFixed(2)} m from the ring` : rowEave !== undefined ? `; its own symbol not read, up the slope from the eave line where the ${ends.length} symbol(s) read in its row stop, ${(across - ringAcross).toFixed(2)} m from the ring` : '; up the slope at its ring (no single drawn symbol found beside it, none read in its row)'}`,
      widthM: round6(widthM),
      lengthM: round6(lengthM),
      calloutId: c.id,
      centre: { x: round6(centre.x), z: round6(centre.z) },
    })
  }
  // 005Y-N5 (C2): along each row whose symbols were read, a symbol of the same size on the same eave line with a callout
  // bar inside is a rooflight whose ring the ring finder missed (`rowSymbolsWithoutRing`)
  if (raster) {
    const seen = new Set<Read>()
    for (const r of read) {
      if (seen.has(r)) continue
      const row = rowOf(r)
      for (const x of row) seen.add(x)
      const ends = row.map(eaveEnd).filter((e): e is number => e !== undefined)
      if (ends.length === 0 || Math.max(...ends) - Math.min(...ends) > ROW_ACROSS_M) continue
      // the search follows the symbols as drawn: from where their sides stop toward the eave
      const drawnEnds = row.filter((x) => x.symbol).map((x) => (x.upslope > 0 ? (x.symbol as DrawnRooflightSymbol).drawnAcross[0] : (x.symbol as DrawnRooflightSymbol).drawnAcross[1]))
      const drawnEave = drawnEnds.reduce((a, b) => a + b, 0) / drawnEnds.length
      const bars = row.filter((x) => x.c.bar).map((x) => { const w = plan.toWorld(x.c.circle.cx, (x.c.bar as { y: number }).y); return roof.ridgeAxis === 'X' ? w.z : w.x })
      if (bars.length === 0) continue
      const eave = ends.reduce((a, b) => a + b, 0) / ends.length
      const barAcross = [...bars].sort((a, b) => a - b)[Math.floor(bars.length / 2)]
      const pp = plan as Pick<PlanFrameV2, 'toPixel' | 'toWorld'>
      const pxPerM = Math.hypot(pp.toPixel(1, 0).x - pp.toPixel(0, 0).x, pp.toPixel(1, 0).y - pp.toPixel(0, 0).y)
      const radiusM = Math.min(...row.map((x) => x.c.circle.radiusPx)) / pxPerM
      const alongLo = roof.ridgeAxis === 'X' ? body.x0 + wallThicknessM : body.z0 + wallThicknessM
      const alongHi = roof.ridgeAxis === 'X' ? body.x1 - wallThicknessM : body.z1 - wallThicknessM
      const drawnDepth = Math.abs(row.filter((x) => x.symbol).map((x) => (x.symbol as DrawnRooflightSymbol).drawnAcross).reduce((a, d) => a + (d[1] - d[0]), 0) / drawnEnds.length)
      const found = rowSymbolsWithoutRing(raster, plan as Pick<PlanFrameV2, 'toPixel' | 'toWorld'>, roof.ridgeAxis, { eaveAcross: drawnEave, upslope: r.upslope, depthM: drawnDepth, widthM: r.widthM, barAcross, barHalfM: radiusM * 0.7, alongFrom: alongLo, alongTo: alongHi, taken: read.filter((x) => x.upslope === r.upslope).map((x) => x.along) }, trace ? (d) => trace({ kind: 'ROW_SYMBOL_DEBUG', frameId: plan.frameId, slope: r.upslope, eave: round6(eave), barAcross: round6(barAcross), ...d }) : undefined)
      for (const f of found) {
        const across = eave + (r.upslope * r.lengthM * cos) / 2
        const slope: 'LOW' | 'HIGH' = across < roof.ridgeAt ? 'LOW' : 'HIGH'
        const eaveAlong = roof.ridgeAxis === 'X' ? (slope === 'LOW' ? body.z0 : body.z1) : slope === 'LOW' ? body.x0 : body.x1
        const depth = r.lengthM * cos
        const from = across - depth / 2
        const to = from + depth
        const heightAt = (a: number): number => roof.eaveY + Math.abs(a - eaveAlong) * tan
        const centre = roof.ridgeAxis === 'X' ? { x: f.along, z: barAcross } : { x: barAcross, z: f.along }
        trace?.({ kind: 'ROOFLIGHT_RING', frameId: plan.frameId, calloutId: `row-symbol-${f.along}`, decision: 'READ', method: 'ROW_SYMBOL_WITHOUT_RING', slope, along: f.along, acrossM: round6(across), rowEave: round6(eave), sidesCover: f.sidesCover, edgeCover: f.edgeCover, barCover: f.barCover })
        out.push({
          id: '',
          slope,
          alongFrom: round6(f.along - r.widthM / 2),
          alongTo: round6(f.along + r.widthM / 2),
          slopeFrom: round6(from),
          slopeTo: round6(to),
          yFrom: round6(Math.min(heightAt(from), heightAt(to))),
          yTo: round6(Math.max(heightAt(from), heightAt(to))),
          frameId: plan.frameId,
          confidence: 0.4,
          why: `no ring read here, but ${f.why}; its size is its row's printed ${r.c.widthCm}/${r.c.heightCm}, which the symbol matches`,
          widthM: round6(r.widthM),
          lengthM: round6(r.lengthM),
          calloutId: `row-symbol-${plan.frameId}-${f.along}`,
          centre: { x: round6(centre.x), z: round6(centre.z) },
        })
      }
    }
  }
  out.sort((a, b) => (a.slope === b.slope ? a.alongFrom - b.alongFrom : a.slope === 'LOW' ? -1 : 1))
  return out.map((r, i) => ({ ...r, id: `rooflight-plan-${r.slope === 'LOW' ? 'low' : 'high'}-${i}` }))
}

/**
 * 005Y-N3 (H4): the top of the roof over a plan point — the roof a chimney there rises through. Every roof the solver
 * built that covers the point is weighed: the main roof inside its footprint, each plane of an attached body's pitched
 * roof inside its outline (a valley's planes run onto the main slope), each attached flat roof inside its footprint;
 * the highest covering surface is the one the stack stands on. Where none covers the point, `fallback` answers (the
 * main roof's own profile, as chimneys were read before).
 */
export function hostRoofTopAt(
  p: { x: number; z: number },
  roofs: {
    main?: { footprint: { x0: number; z0: number; x1: number; z1: number }; topAt: (x: number, z: number) => number }
    pitched: ReadonlyArray<{ pitchDeg: number; layout: { planes: ReadonlyArray<{ boundary: ReadonlyArray<{ x: number; z: number }>; downslope: { x: number; z: number }; datum: { x: number; y: number; z: number } }> } }>
    flat: ReadonlyArray<{ footprint: { x0: number; z0: number; x1: number; z1: number }; slabTopY: number; parapetTopY?: number }>
  },
  fallback: (x: number, z: number) => number,
): number {
  const within = (f: { x0: number; z0: number; x1: number; z1: number }): boolean => p.x >= f.x0 - 1e-6 && p.x <= f.x1 + 1e-6 && p.z >= f.z0 - 1e-6 && p.z <= f.z1 + 1e-6
  const tops: number[] = []
  if (roofs.main && within(roofs.main.footprint)) tops.push(roofs.main.topAt(p.x, p.z))
  for (const r of roofs.pitched) {
    const tan = Math.tan((r.pitchDeg * Math.PI) / 180)
    for (const pl of r.layout.planes) if (insidePlanPolygon(p, pl.boundary)) tops.push(pl.datum.y - tan * ((p.x - pl.datum.x) * pl.downslope.x + (p.z - pl.datum.z) * pl.downslope.z))
  }
  for (const r of roofs.flat) if (within(r.footprint)) tops.push(r.parapetTopY ?? r.slabTopY)
  return tops.length > 0 ? Math.max(...tops) : fallback(p.x, p.z)
}

/** 005Y-N3 (H4): a plan point inside a roof plane's outline (even-odd; a point on the outline counts as inside). */
function insidePlanPolygon(p: { x: number; z: number }, poly: ReadonlyArray<{ x: number; z: number }>): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    const cross = (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x)
    if (Math.abs(cross) < 1e-9 && p.x >= Math.min(a.x, b.x) - 1e-9 && p.x <= Math.max(a.x, b.x) + 1e-9 && p.z >= Math.min(a.z, b.z) - 1e-9 && p.z <= Math.max(a.z, b.z) + 1e-9) return true
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside
  }
  return inside
}

/** 005Y-N4 (A): a rooflight's drawn symbol — light lines darker than paper or floor fill, lighter than wall ink. */
const SYMBOL_LINE_LUMA = 215
const SYMBOL_WALL_LUMA = 70
/**
 * 005Y-N4 (A): furniture, hatching and strip edges also cross a rooflight's band. A rectangle is read only when it
 * stands out: its weaker edge and weaker side together beat every other candidate rectangle's by this much.
 */
const SYMBOL_MARGIN = 0.15
/** 005Y-N4 (A): a dashed edge covers this share of its length or more, and less than a solid line would. */
const DASHED_MIN_COVER = 0.25
const DASHED_MAX_COVER = 0.92
/** 005Y-N5 (C2): a symbol line is grey: its channels differ by no more than this (a dimension line is coloured). */
const SYMBOL_GREY_CHROMA = 40
/** 005Y-N5 (C2): a dashed side has gaps no longer than this (px); a longer gap is where the side ends. */
const SYMBOL_DASH_GAP_PX = 5
/** 005Y-N4 (A): the drawn depth may differ from the printed length's plan projection by this share (drawing tolerance). */
const SYMBOL_DEPTH_TOLERANCE = 0.2

export type DrawnRooflightSymbol = {
  acrossFrom: number
  acrossTo: number
  edgesPx: [number, number]
  cover: [number, number]
  sidesCover: [number, number]
  score: number
  runnerUp: number
  /** 005Y-N5: the whole rectangle read, or its upslope edge and sides with the eave edge at the printed depth. */
  method: 'RECTANGLE' | 'UPSLOPE_EDGE_AND_SIDES'
  /** 005Y-N5: the across range the symbol is drawn over (less than the window's where a wall cuts it). */
  drawnAcross: [number, number]
  why: string
}

/**
 * 005Y-N4 (A): the rooflight's own symbol on the plan, beside its callout ring. A plan draws a rooflight as a rectangle
 * of light (often dashed) lines — the window's width along the ridge, its length's plan projection up the slope — and
 * prints its size in a ring set somewhere inside or beside it, usually toward the eave. The ring says that a rooflight
 * is there, how big and where along the ridge; where up the slope it sits is the rectangle's. Two edges parallel to the
 * ridge, the plan depth apart (within `SYMBOL_DEPTH_TOLERANCE`), the ring between them, and both sides drawn at the
 * printed width. Of the candidates, the one whose weaker edge and weaker side are clearly the strongest
 * (`SYMBOL_MARGIN`), or nothing — two near-equal candidates are an ambiguity, left unread, and the ring's place stands.
 */
export function drawnRooflightSymbol(
  raster: Raster,
  plan: Pick<PlanFrameV2, 'toPixel' | 'toWorld'>,
  ring: { cx: number; cy: number; radiusPx: number },
  widthM: number,
  depthM: number,
  ridgeAxis: 'X' | 'Z',
  debug?: (record: Record<string, unknown>) => void,
  /** 005Y-N5: which way up the slope runs in the across coordinate (+1 toward larger values), when known. */
  upslope?: 1 | -1,
): DrawnRooflightSymbol | undefined {
  const c = plan.toWorld(ring.cx, ring.cy)
  const p0 = plan.toPixel(c.x, c.z)
  const pa = ridgeAxis === 'X' ? plan.toPixel(c.x + 1, c.z) : plan.toPixel(c.x, c.z + 1)
  const pc = ridgeAxis === 'X' ? plan.toPixel(c.x, c.z + 1) : plan.toPixel(c.x + 1, c.z)
  const along = { x: pa.x - p0.x, y: pa.y - p0.y }
  const acrossV = { x: pc.x - p0.x, y: pc.y - p0.y }
  const pxPerM = Math.hypot(acrossV.x, acrossV.y)
  const ua = { x: along.x / Math.hypot(along.x, along.y), y: along.y / Math.hypot(along.x, along.y) }
  const uc = { x: acrossV.x / pxPerM, y: acrossV.y / pxPerM }
  const widthPx = widthM * pxPerM
  const depthPx = depthM * pxPerM
  const t0 = ridgeAxis === 'X' ? c.z : c.x
  const at = (s: number, t: number): number => lumaAt(raster, Math.round(ring.cx + ua.x * s + uc.x * t), Math.round(ring.cy + ua.y * s + uc.y * t))
  // 005Y-N5: a symbol is drawn in grey; a coloured line (a dimension line, a room number) is not its edge
  const grey = (s: number, t: number): boolean => {
    const [r, g, b] = rgbAt(raster, Math.round(ring.cx + ua.x * s + uc.x * t), Math.round(ring.cy + ua.y * s + uc.y * t))
    return Math.max(r, g, b) - Math.min(r, g, b) <= SYMBOL_GREY_CHROMA
  }
  /** A side's line pixel: grey and darker than the pixels 2 px either side of it along the ridge (a tone band is no line). */
  const isLine = (s: number, t: number): boolean => {
    const l = at(s, t)
    return l >= SYMBOL_WALL_LUMA && l < SYMBOL_LINE_LUMA && grey(s, t) && l <= Math.min(at(s - 2, t), at(s + 2, t)) - ROW_SYMBOL_LINE_CONTRAST
  }
  /**
   * Share of light-line pixels along a segment (darker than paper, lighter than wall ink); a segment through wall ink
   * is no symbol edge. The ring and its text are not the symbol: pixels inside its disc are skipped.
   */
  const cover = (fixed: number, from: number, to: number, alongFixed: boolean): { share: number; wall: boolean } => {
    let line = 0
    let n = 0
    let wall = 0
    for (let v = Math.round(from); v <= Math.round(to); v += 1) {
      const [s0, t0] = alongFixed ? [fixed, v] : [v, fixed]
      const dx = ua.x * s0 + uc.x * t0
      const dy = ua.y * s0 + uc.y * t0
      if (Math.hypot(dx, dy) <= ring.radiusPx + 2) continue
      const l = at(s0, t0)
      if (l < SYMBOL_WALL_LUMA) wall += 1
      // 005Y-N5: a line pixel stands out from the paper or tone either side of it (a tone band is not a line)
      const [n1, n2] = alongFixed ? [at(s0 - 2, t0), at(s0 + 2, t0)] : [at(s0, t0 - 2), at(s0, t0 + 2)]
      if (l >= SYMBOL_WALL_LUMA && l < SYMBOL_LINE_LUMA && grey(s0, t0) && l <= Math.min(n1, n2) - ROW_SYMBOL_LINE_CONTRAST) line += 1
      n += 1
    }
    return { share: n >= 4 ? line / n : 0, wall: n > 0 && wall > 0.3 * n }
  }
  // the full printed width: a row through the ring keeps its pixels either side of the disc
  const half = widthPx / 2 - 1
  const search = Math.ceil(depthPx * (1 + SYMBOL_DEPTH_TOLERANCE) + ring.radiusPx)
  const rows: Array<{ t: number; share: number }> = []
  for (let t = -search; t <= search; t += 1) {
    const r = cover(t, -half, half, false)
    if (r.wall || r.share < DASHED_MIN_COVER || r.share > DASHED_MAX_COVER) continue
    rows.push({ t, share: r.share })
  }
  // one row per drawn line: the strongest of each run of adjacent rows
  const lines: Array<{ t: number; share: number }> = []
  for (const r of rows) {
    const last = lines[lines.length - 1]
    if (last && r.t - last.t <= 2) {
      if (r.share > last.share) lines[lines.length - 1] = r
    } else lines.push(r)
  }
  const pairs: DrawnRooflightSymbol[] = []
  for (let i = 0; i < lines.length; i += 1) {
    for (let j = i + 1; j < lines.length; j += 1) {
      const a = lines[i]
      const b = lines[j]
      const d = b.t - a.t
      if (Math.abs(d - depthPx) > SYMBOL_DEPTH_TOLERANCE * depthPx) continue
      // the ring's centre inside the rectangle, not merely its disc touching an edge
      if (a.t >= -2 || b.t <= 2) continue
      const left = cover(-widthPx / 2, a.t + 2, b.t - 2, true)
      const right = cover(widthPx / 2, a.t + 2, b.t - 2, true)
      // the sides at the printed width, looked for within a few pixels either way
      const side = (s0: number): number => Math.max(...[-3, -2, -1, 0, 1, 2, 3].map((k) => cover(s0 + k, a.t + 2, b.t - 2, true)).filter((r) => !r.wall).map((r) => r.share), 0)
      const ls = Math.max(left.wall ? 0 : left.share, side(-widthPx / 2))
      const rs = Math.max(right.wall ? 0 : right.share, side(widthPx / 2))
      debug?.({ pair: [a.t, b.t], ls: round6(ls), rs: round6(rs) })
      if (ls < DASHED_MIN_COVER || rs < DASHED_MIN_COVER) continue
      pairs.push({ acrossFrom: round6(t0 + a.t / pxPerM), acrossTo: round6(t0 + b.t / pxPerM), edgesPx: [a.t, b.t], cover: [round6(a.share), round6(b.share)], sidesCover: [round6(ls), round6(rs)], score: round6(Math.min(a.share, b.share) + Math.min(ls, rs)), runnerUp: 0, method: 'RECTANGLE', drawnAcross: [round6(t0 + a.t / pxPerM), round6(t0 + b.t / pxPerM)], why: `a rectangle of light lines ${(d / pxPerM).toFixed(2)} m deep (the printed length's plan projection ${depthM.toFixed(2)} m), ${(widthPx / pxPerM).toFixed(2)} m wide, the ring between its edges` })
    }
  }
  debug?.({ lines: lines.map((l) => [l.t, round6(l.share)]), depthPx: round6(depthPx), widthPx: round6(widthPx), pairs: pairs.length })
  const ranked = [...pairs].sort((p, q) => q.score - p.score || p.edgesPx[0] - q.edgesPx[0])
  const best = ranked[0]
  const runnerUp = ranked[1]?.score ?? 0
  if (best && best.score - runnerUp >= SYMBOL_MARGIN) return { ...best, method: 'RECTANGLE', runnerUp }
  if (best || upslope === undefined) return undefined
  // 005Y-N5 (C2): no full rectangle. The symbol's eave-side edge often lies on the edge of the shaded band under the
  // knee wall — a change of tone, not a line — while its upslope edge and its two sides are clean. Read those three:
  // one grey line up the slope from the ring, both sides drawn back from it toward the eave; where both sides' dashes
  // stop is the symbol's eave end, read from the drawing. Its depth must match the printed length's plan projection
  // (`SYMBOL_DEPTH_TOLERANCE`) and the ring must stand between its two ends.
  const open: DrawnRooflightSymbol[] = []
  for (const l of lines) {
    const t = l.t * upslope
    if (t < ring.radiusPx || t > depthPx * (1 + SYMBOL_DEPTH_TOLERANCE)) continue
    const eaveT = l.t - upslope * depthPx
    const [lo, hi] = [Math.min(l.t, eaveT), Math.max(l.t, eaveT)]
    const side = (s0: number): number => Math.max(...[-3, -2, -1, 0, 1, 2, 3].map((k) => cover(s0 + k, lo + 2, hi - 2, true)).filter((r) => !r.wall).map((r) => r.share), 0)
    const ls = side(-widthPx / 2)
    const rs = side(widthPx / 2)
    // where each side's dashes end toward the eave: the drawn eave end of the symbol, its own edge line lost or not
    const sideEnd = (s0: number): { end: number; atWall: boolean } | undefined => {
      // the side is found within 3 px of the printed width, then followed a pixel either way as it runs
      let k: number | undefined
      let last: number | undefined
      let gap = 0
      for (let step = 2; step <= depthPx * (1 + SYMBOL_DEPTH_TOLERANCE) + 4; step += 1) {
        const t = l.t - upslope * step
        const hit = (k === undefined ? [0, -1, 1, -2, 2, -3, 3] : [k, k - 1, k + 1]).find((d) => isLine(s0 + d, t))
        if (k === undefined && hit === undefined && step > 2 + SYMBOL_DASH_GAP_PX) break
        if (hit !== undefined) {
          k = hit
          last = t
          gap = 0
        } else if (k !== undefined && ++gap > SYMBOL_DASH_GAP_PX) break
      }
      if (last === undefined || k === undefined) return undefined
      // a side that stops on wall ink is cut by the wall: the plan draws the window only up to the wall's face
      const atWall = [1, 2, 3, 4].some((d) => at(s0 + (k as number), (last as number) - upslope * d) < SYMBOL_WALL_LUMA)
      return { end: last, atWall }
    }
    const endL = sideEnd(-widthPx / 2)
    const endR = sideEnd(widthPx / 2)
    const drawnEave = endL !== undefined && endR !== undefined ? (endL.end + endR.end) / 2 : undefined
    const drawnDepth = drawnEave === undefined ? 0 : Math.abs(l.t - drawnEave)
    const cutByWall = !!endL?.atWall && !!endR?.atWall && drawnDepth < depthPx
    debug?.({ upslopeEdge: l.t, ls: round6(ls), rs: round6(rs), sideEnds: [endL?.end ?? null, endR?.end ?? null], atWall: [endL?.atWall ?? null, endR?.atWall ?? null], drawnDepthPx: round6(drawnDepth) })
    if (ls < DASHED_MIN_COVER || rs < DASHED_MIN_COVER || drawnEave === undefined || endL === undefined || endR === undefined) continue
    if (Math.abs(endL.end - endR.end) > 3) continue
    if (!cutByWall && Math.abs(drawnDepth - depthPx) > SYMBOL_DEPTH_TOLERANCE * depthPx) continue
    // the ring between the symbol's two drawn ends
    if (drawnEave * upslope > 0) continue
    // where the wall cuts the symbol, the window runs on under the wall line: its eave end the printed depth below its upslope edge
    const windowEave = cutByWall ? l.t - upslope * depthPx : drawnEave
    const [dlo, dhi] = [Math.min(l.t, windowEave), Math.max(l.t, windowEave)]
    const from = round6(t0 + dlo / pxPerM)
    const to = round6(t0 + dhi / pxPerM)
    open.push({ acrossFrom: from, acrossTo: to, edgesPx: [Math.round(dlo), Math.round(dhi)], cover: upslope > 0 ? [0, round6(l.share)] : [round6(l.share), 0], sidesCover: [round6(ls), round6(rs)], score: round6(l.share + Math.min(ls, rs)), runnerUp: 0, method: 'UPSLOPE_EDGE_AND_SIDES', drawnAcross: [round6(t0 + Math.min(l.t, drawnEave) / pxPerM), round6(t0 + Math.max(l.t, drawnEave) / pxPerM)], why: `its upslope edge and both sides drawn ${(widthPx / pxPerM).toFixed(2)} m apart, ${(t / pxPerM).toFixed(2)} m up the slope from the ring; ${cutByWall ? `its sides cut by the wall's face ${(drawnDepth / pxPerM).toFixed(2)} m below it, the window running on under the wall line to the printed length's plan projection, ${depthM.toFixed(2)} m` : `its eave end where both sides' dashes stop, ${(drawnDepth / pxPerM).toFixed(2)} m below it (the printed length's plan projection is ${depthM.toFixed(2)} m)`}` })
  }
  const openRanked = [...open].sort((p, q) => q.score - p.score || p.edgesPx[0] - q.edgesPx[0])
  const top = openRanked[0]
  if (!top) return undefined
  const second = openRanked[1]?.score ?? 0
  if (top.score - second >= SYMBOL_MARGIN) return { ...top, runnerUp: second }
  // Lines close together up the slope whose sides all stop at one eave end are one symbol drawn with a doubled edge
  // (frame and sash, or a line and its shadow): the one whose depth is nearest the printed one stands for it. Eave ends
  // apart are two symbols — an ambiguity, left unread.
  const eaveOf = (o: DrawnRooflightSymbol): number => (upslope > 0 ? o.edgesPx[0] : o.edgesPx[1])
  if (open.some((o) => Math.abs(eaveOf(o) - eaveOf(top)) > 2)) return undefined
  const depthOf = (o: DrawnRooflightSymbol): number => Math.abs(o.edgesPx[1] - o.edgesPx[0])
  const nearest = [...open].sort((p, q) => Math.abs(depthOf(p) - depthPx) - Math.abs(depthOf(q) - depthPx) || p.edgesPx[0] - q.edgesPx[0])[0]
  return { ...nearest, runnerUp: second, why: `${nearest.why}; ${open.length} parallel lines up the slope share this eave end, the one nearest the printed depth taken` }
}

/** 005Y-N5 (C2): a found symbol's sides must be drawn over this share of the symbol's depth; its callout bar over this share of the disc. */
const ROW_SYMBOL_SIDE_COVER = 0.5
const ROW_SYMBOL_BAR_COVER = 0.6
/** 005Y-N5 (C2): a line pixel is this much darker (luma) than the pixels 2 px either side of it. */
const ROW_SYMBOL_LINE_CONTRAST = 15
/** 005Y-N5 (C2): a drawn symbol's depth as a share of the printed length's plan projection (publishers draw them short). */
const ROW_SYMBOL_DEPTH_RANGE = { min: 0.6, max: 1.2 } as const

export type RowSymbolWithoutRing = { along: number; sidesCover: [number, number]; edgeCover: number; barCover: number; why: string }

/**
 * 005Y-N5 (C2): rooflights a row's ring finder missed (a ring whose outline the watermark or tint swallows). Along a row
 * whose symbols were read, at one printed size and one eave line, a further rooflight is read only where two
 * independent marks agree: the same symbol — both sides of the printed width drawn from the row's eave line over the
 * printed depth, its upslope edge drawn across — and a callout's bar inside it at the row's bar position. Places within
 * a symbol's width of a read ring are not searched. The printed size of such a ring is not read; it is the row's, which
 * its symbol matches to the pixel. Returns positions along the ridge.
 */
export function rowSymbolsWithoutRing(
  raster: Raster,
  plan: Pick<PlanFrameV2, 'toPixel' | 'toWorld'>,
  ridgeAxis: 'X' | 'Z',
  row: { eaveAcross: number; upslope: 1 | -1; depthM: number; widthM: number; barAcross: number; barHalfM: number; alongFrom: number; alongTo: number; taken: readonly number[] },
  debug?: (record: Record<string, unknown>) => void,
): RowSymbolWithoutRing[] {
  const P = (along: number, across: number): { x: number; y: number } => (ridgeAxis === 'X' ? plan.toPixel(along, across) : plan.toPixel(across, along))
  const pxPerM = Math.hypot(P(row.alongFrom, row.eaveAcross + 1).x - P(row.alongFrom, row.eaveAcross).x, P(row.alongFrom, row.eaveAcross + 1).y - P(row.alongFrom, row.eaveAcross).y)
  const step = 1 / pxPerM
  const luma = (along: number, across: number): number => {
    const p = P(along, across)
    return lumaAt(raster, Math.round(p.x), Math.round(p.y))
  }
  /**
   * A grey line pixel: darker than the paper or tone 2 px either side of it, across the line's own direction, by
   * `ROW_SYMBOL_LINE_CONTRAST` — a tone band is not a line however grey it is.
   */
  const isLine = (along: number, across: number, lineAlongRidge: boolean): boolean => {
    const p = P(along, across)
    const l = luma(along, across)
    const [r, g, b] = rgbAt(raster, p.x, p.y)
    if (l < SYMBOL_WALL_LUMA || Math.max(r, g, b) - Math.min(r, g, b) > SYMBOL_GREY_CHROMA) return false
    const [n1, n2] = lineAlongRidge ? [luma(along, across - 2 * step), luma(along, across + 2 * step)] : [luma(along - 2 * step, across), luma(along + 2 * step, across)]
    return l <= Math.min(n1, n2) - ROW_SYMBOL_LINE_CONTRAST
  }
  /** Share of pixels of a world segment that are grey line, a few pixels either way across it taken at their best. */
  const cover = (fixedAlong: boolean, fixed: number, from: number, to: number): number => {
    let best = 0
    for (const k of [-2, -1, 0, 1, 2]) {
      let n = 0
      let hit = 0
      for (let v = Math.min(from, to) + 2 * step; v <= Math.max(from, to) - 2 * step; v += step) {
        n += 1
        if (fixedAlong ? isLine(fixed + k * step, v, false) : isLine(v, fixed + k * step, true)) hit += 1
      }
      best = Math.max(best, n > 0 ? hit / n : 0)
    }
    return best
  }
  // the drawn depth is the publisher's: searched between ROW_SYMBOL_DEPTH_RANGE of the printed length's projection
  const scored: Array<RowSymbolWithoutRing & { score: number }> = []
  for (let a = row.alongFrom + row.widthM / 2; a <= row.alongTo - row.widthM / 2; a += step) {
    if (row.taken.some((t) => Math.abs(t - a) < row.widthM)) continue
    const sure = row.eaveAcross + row.upslope * row.depthM * ROW_SYMBOL_DEPTH_RANGE.min
    const ls = cover(true, a - row.widthM / 2, row.eaveAcross, sure)
    const rs = cover(true, a + row.widthM / 2, row.eaveAcross, sure)
    if (debug && ls >= 0.3 && rs >= 0.3) debug({ along: round6(a), ls: round6(ls), rs: round6(rs), bar: round6(cover(false, row.barAcross, a - row.barHalfM, a + row.barHalfM)) })
    if (ls < ROW_SYMBOL_SIDE_COVER || rs < ROW_SYMBOL_SIDE_COVER) continue
    let edge = 0
    for (let d = ROW_SYMBOL_DEPTH_RANGE.min; d <= ROW_SYMBOL_DEPTH_RANGE.max; d += step / row.depthM) edge = Math.max(edge, cover(false, row.eaveAcross + row.upslope * row.depthM * d, a - row.widthM / 2, a + row.widthM / 2))
    if (edge < DASHED_MIN_COVER) continue
    const bar = cover(false, row.barAcross, a - row.barHalfM, a + row.barHalfM)
    if (bar < ROW_SYMBOL_BAR_COVER) continue
    scored.push({ along: round6(a), sidesCover: [round6(ls), round6(rs)], edgeCover: round6(edge), barCover: round6(bar), score: Math.min(ls, rs) + edge + bar, why: '' })
  }
  // one symbol per place: the best of each run of neighbouring positions
  const out: RowSymbolWithoutRing[] = []
  for (const c of [...scored].sort((p, q) => q.score - p.score || p.along - q.along)) {
    if (out.some((o) => Math.abs(o.along - c.along) < row.widthM)) continue
    out.push({ along: c.along, sidesCover: c.sidesCover, edgeCover: c.edgeCover, barCover: c.barCover, why: `the row's symbol drawn here — sides ${c.sidesCover.join('/')} of the printed depth, upslope edge ${c.edgeCover} — with a callout bar inside at the row's bar (${c.barCover}); the ring's outline itself not found` })
  }
  return out.sort((p, q) => p.along - q.along)
}
