/**
 * Openings v2 (§14): every exterior opening as a cross-view feature.
 *
 * The PLAN gives the host wall, the order along it and the interval — a gap in
 * the wall band, read between the pieces of masonry either side of it. The
 * CALLOUT printed beside it gives the width and the height exactly. The
 * ELEVATION gives the sill, the head and the head's PROFILE: a rectangle, or a
 * head raked along the roof on a gable end. The family is a reading of the
 * plan symbol and the proportions, never of the sill alone. Every property
 * carries its own provenance; a property no view settles is named unresolved
 * rather than defaulted.
 */
import { round6 } from '@buildapp/source-common'
import type { PixelRect } from '@buildapp/source-common'
import type { Raster } from '@buildapp/source-cv'
import { verticalOpeningExtent } from '@buildapp/image-metrology'
import type { MetricEvidence } from '@buildapp/source-metrics'
import type { ElevationFrameV2, PlanFrameV2 } from './frame.js'
import { bandPieces, gapsBetween, inkFraction, mergeRuns } from './scan.js'
import type { ProvenanceStatus } from './graph.js'
import { CONVENTIONS } from '../solve.js'

export type Facade = 'FRONT' | 'REAR' | 'WEST' | 'EAST'
export type OpeningFamily = 'WINDOW' | 'DOOR' | 'GARAGE_DOOR' | 'GLAZED_DOOR' | 'MULTI_PANEL_GLAZING' | 'UNKNOWN'
export type HeadProfile = 'RECTANGULAR' | 'RAKED_SINGLE' | 'RAKED_DOUBLE' | 'POLYGONAL' | 'UNKNOWN'

export type WallHost = {
  massId: string
  facade: Facade
  /** The wall's outer face plane (z for FRONT/REAR, x for WEST/EAST) and its along extent in world metres. */
  planeAt: number
  from: number
  to: number
  /** The wall's centre line, for the plan scan. */
  centreAt: number
  storeyIndex: number
  /** Whether this wall is a gable end (perpendicular to the ridge) of a pitched roof, with the roof geometry to rake heads against. */
  gable?: { eaveY: number; pitchDeg: number; ridgeAlongAt: number; eaveAtLow: number; eaveAtHigh: number; buildUpVerticalM: number }
  /**
   * 005V: the top of a wall that runs under the eaves of the roof over it (a top storey's wall parallel to the ridge),
   * absolute: where the roof's underside meets the wall. Absent for gable ends and for walls with a storey above.
   */
  eaveTopY?: number
  floorY: number
  storeyHeightM: number
}

export type OpeningV2 = {
  id: string
  storeyIndex: number
  massId: string
  facade: Facade
  planeAt: number
  /** World interval along the wall (x for FRONT/REAR, z for WEST/EAST). */
  interval: [number, number]
  widthM: number
  sillY: number
  headY: number
  headFarY?: number
  /** Which end of the interval carries `headY` when raked: the tall edge. */
  tallEdge?: 'LOW' | 'HIGH'
  profile: HeadProfile
  family: OpeningFamily
  /** 005Y-N4 (C): the leaf as the plan draws it — which way it swings and at which end of the gap it hangs — when read. */
  leaf?: DrawnDoorLeaf
  callout?: { widthCm: number; heightCm: number; evidenceId: string; distanceM: number; heightCandidates?: Array<{ cm: number; score: number }>; resolvedBy?: string }
  elevation?: { frameId: string; sillY: number; headY: number; contrast: number; confidence: number }
  /** Mullion positions as fractions of the width, from stubs the plan draws inside the gap. */
  mullions: number[]
  planGap: { frameId: string; pixelRect: PixelRect }
  provenance: Record<'interval' | 'width' | 'sill' | 'head' | 'profile' | 'family', ProvenanceStatus>
  uncertaintyM: number
  unresolved: string[]
  confidence: number
  why: string
  /**
   * 005Y-N3 (H1): the other piece of a corner assembly — one glazing wrapping the corner of the body, its two pieces in
   * two perpendicular walls with no pier drawn between them (`cornerAssemblies`). Each piece stays an opening of its
   * own wall; the relation is what says they are one thing.
   */
  cornerWith?: string
}

export type OpeningOptions = { minWidthM?: number; maxWidthM?: number; calloutReachM?: number; stubMaxM?: number }
/** 005V: how far inward of a registered face that crosses no wall ink the wall is looked for … */
const WALL_SEARCH_INWARD_M = 0.5
/** … and how far outward. */
const WALL_SEARCH_OUTWARD_M = 0.15
/** 005V: the share of the wall's length a line found that way must cross as wall ink to be taken for the wall. */
const WALL_SEARCH_MIN_COVER = 0.3
/** 005V: how far below the eaves an assumed head stays. */
const EAVE_CLEARANCE_M = 0.05
/** 005V: the least window an assumed opening may be lowered to under the eaves; below it the gap is refused. */
const MIN_ASSUMED_WINDOW_M = 1.0
const DEFAULTS: Required<OpeningOptions> = { minWidthM: 0.5, maxWidthM: 6.5, calloutReachM: 2.0, stubMaxM: 0.3 }

/**
 * The readings a callout evidence supports for each half, best first.
 *
 * A ring callout carries them as alternatives tagged `width candidate` and
 * `height candidate`; a callout read as one OCR token carries one reading per
 * half, at the token's confidence.
 */
/** 005W-N1: below this recogniser confidence a callout's height does not stand over an elevation that contradicts it. */
export const WEAK_CALLOUT_CONFIDENCE = 0.3

/**
 * 005W-N1: whether a printed height is too weak a reading to stand over the elevation: read below
 * WEAK_CALLOUT_CONFIDENCE, more than 0.5 m off the elevation's extent, and none of the recogniser's height readings
 * within 0.2 m of it. A height read with confidence, or one the elevation could be a reading of, stands as before.
 */
export function weakPrintedHeight(confidence: number | undefined, printedM: number, drawnM: number, candidates: ReadonlyArray<{ cm: number }> | undefined): boolean {
  if (confidence === undefined || confidence >= WEAK_CALLOUT_CONFIDENCE) return false
  if (Math.abs(drawnM - printedM) <= 0.5) return false
  return !(candidates ?? []).some((c) => Math.abs(c.cm / 100 - drawnM) <= 0.2)
}

export function calloutCandidates(evidence: MetricEvidence): { widths: Array<{ cm: number; score: number }>; heights: Array<{ cm: number; score: number }> } | null {
  const widths = evidence.alternatives.filter((a) => a.why.startsWith('width candidate')).map((a) => ({ cm: a.value, score: a.confidence }))
  const heights = evidence.alternatives.filter((a) => a.why.startsWith('height candidate')).map((a) => ({ cm: a.value, score: a.confidence }))
  if (widths.length > 0 && heights.length > 0) return { widths, heights }
  const pair = calloutPair(evidence)
  if (!pair) return null
  return { widths: [{ cm: pair.widthCm, score: evidence.confidence }], heights: [{ cm: pair.heightCm, score: evidence.confidence }] }
}

/** `110/230` read as a width and a height in centimetres, from a callout evidence's raw text. */
export function calloutPair(evidence: MetricEvidence): { widthCm: number; heightCm: number } | null {
  const text = evidence.rawText.replace(/\s/g, '')
  const m = /^(\d{2,3})[/xX](\d{2,3})$/.exec(text)
  if (!m) return null
  const widthCm = Number(m[1])
  const heightCm = Number(m[2])
  if (widthCm >= 40 && widthCm <= 700 && heightCm >= 40 && heightCm <= 400) return { widthCm, heightCm }
  return null
}

/** Gaps in one wall of a body on one plan, with the stubs (mullions) drawn inside them. */
export function planGaps(raster: Raster, plan: PlanFrameV2, host: WallHost, wallThicknessM: number, options: OpeningOptions = {}): Array<{ interval: [number, number]; stubs: Array<[number, number]>; pixelRect: PixelRect }> {
  const opt = { ...DEFAULTS, ...options }
  const along = host.facade === 'FRONT' || host.facade === 'REAR' ? 'X' : 'Y'
  const mpp = (plan.mppX + plan.mppY) / 2
  const wallPx = wallThicknessM / mpp
  const registeredPx = along === 'X' ? plan.toPixel(0, host.centreAt).y : plan.toPixel(host.centreAt, 0).x
  const p0 = along === 'X' ? plan.toPixel(host.from, host.centreAt).x : plan.toPixel(host.centreAt, host.to).y
  const p1 = along === 'X' ? plan.toPixel(host.to, host.centreAt).x : plan.toPixel(host.centreAt, host.from).y
  const from = Math.min(p0, p1) + wallPx * 0.9
  const to = Math.max(p0, p1) - wallPx * 0.9
  // Solid where at least 60 % of the wall's thickness is ink across the centre line.
  const piecesAt = (c: number) => bandPieces(raster, along, c, from, to, wallPx * 0.45, Math.max(2, Math.round(wallPx * 0.9 * 0.55)))
  let centrePx = registeredPx
  let pieces = piecesAt(centrePx)
  // 005V: wall first. When the registered line crosses no wall ink at all — the face registered a few pixels off the
  // drawn band, or a wall drawn thicker than it was read — the wall's whole length would read as one gap and be
  // dropped, losing every opening in it. The line is then looked for in a narrow band about the registered face (up to
  // WALL_SEARCH_INWARD_M inward, WALL_SEARCH_OUTWARD_M outward): the line crossing the most wall ink is the wall. A line
  // that finds the wall is never moved.
  if (pieces.length === 0) {
    const inward = host.facade === 'FRONT' || host.facade === 'WEST' ? 1 : -1
    const towardInside = Math.sign((along === 'X' ? plan.toPixel(0, host.centreAt + inward).y : plan.toPixel(host.centreAt + inward, 0).x) - registeredPx) || 1
    const coverage = (ps: ReturnType<typeof piecesAt>): number => ps.reduce((a, q) => a + (q.to - q.from + 1), 0)
    let best = { c: registeredPx, ps: pieces, cover: 0 }
    for (let d = -Math.round(WALL_SEARCH_OUTWARD_M / mpp); d <= Math.round(WALL_SEARCH_INWARD_M / mpp); d += 1) {
      const c = registeredPx + towardInside * d
      const ps = piecesAt(c)
      const cover = coverage(ps)
      if (cover > best.cover) best = { c, ps, cover }
    }
    if (best.cover >= WALL_SEARCH_MIN_COVER * (to - from)) {
      centrePx = best.c
      pieces = best.ps
    }
  }
  const solid = mergeRuns(pieces, 2)
  const minGapPx = opt.minWidthM / mpp
  const gaps = gapsBetween(solid, from, to, minGapPx * 0.8)
  const toWorld = (px: number): number => (along === 'X' ? plan.toWorld(px, centrePx).x : plan.toWorld(centrePx, px).z)
  const out: Array<{ interval: [number, number]; stubs: Array<[number, number]>; pixelRect: PixelRect }> = []
  for (const g of gaps) {
    const a = toWorld(g.from)
    const b = toWorld(g.to + 1)
    const lo = Math.min(a, b)
    const hi = Math.max(a, b)
    if (hi - lo < opt.minWidthM || hi - lo > opt.maxWidthM) continue
    // Stubs: short solid pieces INSIDE the gap that the merge above did not see as wall (they are shorter than a mullion).
    const inside = pieces.filter((p) => p.from > g.from - 1 && p.to < g.to + 1 && (p.to - p.from + 1) * mpp <= opt.stubMaxM)
    const stubs: Array<[number, number]> = inside.map((p) => {
      const s0 = toWorld(p.from)
      const s1 = toWorld(p.to + 1)
      return [round6(Math.min(s0, s1)), round6(Math.max(s0, s1))]
    })
    const pixelRect: PixelRect = along === 'X' ? { x0: g.from, y0: centrePx - wallPx / 2, x1: g.to, y1: centrePx + wallPx / 2 } : { x0: centrePx - wallPx / 2, y0: g.from, x1: centrePx + wallPx / 2, y1: g.to }
    out.push({ interval: [round6(lo), round6(hi)], stubs, pixelRect })
  }
  return out
}

/**
 * A gap's vertical extent on a registered elevation of its facade, read as
 * the band of columns over the gap that differs from the wall beside it.
 */
export function elevationExtent(raster: Raster, view: ElevationFrameV2, interval: [number, number], floorY: number, storeyHeightM: number): { sillY: number; headY: number; contrast: number; share: number; why: string } | null {
  const c0 = view.pxOf(interval[0])
  const c1 = view.pxOf(interval[1])
  const from = Math.min(c0, c1)
  const to = Math.max(c0, c1)
  if (to - from < 4) return null
  const top = view.pyOf(floorY + storeyHeightM + 0.3)
  const bottom = view.pyOf(floorY - 0.05)
  const extent = verticalOpeningExtent(raster, { from, to }, { from: Math.min(top, bottom), to: Math.max(top, bottom) }, { minShare: 0.08 })
  if (!extent) return null
  const y0 = view.yOf(extent.toPx)
  const y1 = view.yOf(extent.fromPx)
  return { sillY: round6(Math.max(floorY, Math.min(y0, y1))), headY: round6(Math.max(y0, y1)), contrast: extent.contrast, share: extent.share, why: extent.why }
}

/** 005W: the narrowest stretch of solid wall whose appearance on an elevation is learnt (narrower is a pier or a jamb). */
const WALL_SAMPLE_MIN_M = 0.3
/** 005W: a sample row of a wall stretch this varied (sum of channel deviations) is not plain wall: occluded, a corner, a pipe. */
const WALL_SAMPLE_MAX_SPREAD = 24
/** 005W: a pixel within this distance (sum of channel differences) of a wall stretch's colour in its row looks like wall. */
const WALL_MATCH_MIN = 18
/** 005W: rows where at least this share of the opening's columns does not look like wall belong to the opening. */
const OPENING_ROW_SHARE = 0.5
/** 005W: rows of glass that happen to match the wall (a blind's slat, a reflection) are bridged up to this height. */
const OPENING_BRIDGE_M = 0.3
/** 005W: the wall read over an opening's head that closes it above. */
const OPENING_LINTEL_M = 0.1
/** 005W: a read sill this close to the storey floor is the floor (a threshold or a frame read as wall). */
const FLOOR_SNAP_M = 0.15

/**
 * 005W: a gap's vertical extent read as an OBJECT against the wall it is cut in. The plan says which stretches of this
 * wall are solid; on a registered elevation those stretches show what the wall looks like, row by row (plaster, a
 * cladding band, a plinth). A row of the opening's columns belongs to the opening where most of its pixels look like
 * none of them — glass, a blind, a reflection, a frame or a door leaf alike — so a striped blind or a reflected tree is
 * not mistaken for wall the way a mean-brightness contrast mistakes it. Short runs of wall-like rows inside the opening
 * (a slat, a transom) are bridged; the longest run in the storey is the opening, and only when wall closes it above.
 * Nothing is learnt where the plan gives no solid stretch wide enough to sample, or where no stretch shows plain wall.
 * The caller uses it only for a gap no callout prints a height for, and keeps the contrast reader's band wherever that
 * band is not contained in this one.
 */
export function wallAppearanceExtent(raster: Raster, view: ElevationFrameV2, interval: [number, number], solids: ReadonlyArray<[number, number]>, floorY: number, topY: number): { sillY: number; headY: number; contrast: number; share: number; why: string } | null {
  const mpp = Math.abs(view.yOf(0) - view.yOf(1))
  if (!(mpp > 0)) return null
  const col = (along: number): number => view.pxOf(along)
  const c0 = Math.min(col(interval[0]), col(interval[1]))
  const c1 = Math.max(col(interval[0]), col(interval[1]))
  const inset = Math.max(1, (c1 - c0) * 0.1)
  const from = Math.max(0, Math.round(c0 + inset))
  const to = Math.min(raster.width - 1, Math.round(c1 - inset))
  if (to - from < 3) return null
  const trim = Math.max(2, 0.05 / mpp)
  const samples: Array<[number, number]> = []
  for (const [a, b] of solids) {
    if (Math.abs(b - a) < WALL_SAMPLE_MIN_M) continue
    const s0 = Math.max(0, Math.round(Math.min(col(a), col(b)) + trim))
    const s1 = Math.min(raster.width - 1, Math.round(Math.max(col(a), col(b)) - trim))
    if (s1 > s0) samples.push([s0, s1])
  }
  if (samples.length === 0) return null
  const top = Math.max(0, Math.round(Math.min(view.pyOf(topY), view.pyOf(floorY))))
  const bottom = Math.min(raster.height - 1, Math.round(Math.max(view.pyOf(topY), view.pyOf(floorY))))
  if (bottom - top < 4) return null
  const d = raster.data
  const rgb = (x: number, y: number): [number, number, number] => {
    const o = (y * raster.width + x) * 4
    return [d[o], d[o + 1], d[o + 2]]
  }
  const median = (v: number[]): number => {
    const s = [...v].sort((p, q) => p - q)
    return s[s.length >> 1]
  }
  const share: number[] = []
  for (let y = top; y <= bottom; y += 1) {
    const walls: Array<{ c: [number, number, number]; tol: number }> = []
    for (const [s0, s1] of samples) {
      const px: Array<[number, number, number]> = []
      for (let x = s0; x <= s1; x += 1) px.push(rgb(x, y))
      const c: [number, number, number] = [median(px.map((p) => p[0])), median(px.map((p) => p[1])), median(px.map((p) => p[2]))]
      const spread = median(px.map((p) => Math.abs(p[0] - c[0]) + Math.abs(p[1] - c[1]) + Math.abs(p[2] - c[2])))
      if (spread <= WALL_SAMPLE_MAX_SPREAD) walls.push({ c, tol: Math.max(WALL_MATCH_MIN, 3 * spread) })
    }
    if (walls.length === 0) {
      // Nothing here shows the wall (a roof, the sky, an occluded stretch): the row is neither wall nor opening.
      share.push(Number.NaN)
      continue
    }
    let foreign = 0
    for (let x = from; x <= to; x += 1) {
      const p = rgb(x, y)
      if (!walls.some((w) => Math.abs(p[0] - w.c[0]) + Math.abs(p[1] - w.c[1]) + Math.abs(p[2] - w.c[2]) < w.tol)) foreign += 1
    }
    share.push(foreign / (to - from + 1))
  }
  const bridge = Math.round(OPENING_BRIDGE_M / mpp)
  let best: { a: number; b: number } | null = null
  let run: { a: number; b: number } | null = null
  for (let i = 0; i < share.length; i += 1) {
    if (Number.isNaN(share[i])) {
      run = null
      continue
    }
    if (share[i] < OPENING_ROW_SHARE) continue
    if (run && i - run.b <= bridge) run.b = i
    else run = { a: i, b: i }
    if (!best || run.b - run.a > best.b - best.a) best = { ...run }
  }
  if (!best) return null
  // The opening has wall over its head: rows that look like the wall, read as such, close it above. A run that leaves
  // the wall (into the roof, the sky, a gable no stretch samples) is not an opening's extent.
  const lintel = Math.max(2, Math.round(OPENING_LINTEL_M / mpp))
  const above = share.slice(Math.max(0, best.a - lintel), best.a)
  if (above.length < lintel || above.some((v) => Number.isNaN(v) || v >= OPENING_ROW_SHARE)) return null
  const inRun = share.slice(best.a, best.b + 1)
  const mean = inRun.reduce((p, q) => p + q, 0) / inRun.length
  if (mean < 0.6) return null
  const headY = view.yOf(top + best.a)
  const lowY = view.yOf(top + best.b + 1)
  // A run ending this close to the floor reaches it: the last rows are a threshold or a frame, not wall.
  const sill = Math.min(lowY, headY) - floorY <= FLOOR_SNAP_M ? floorY : Math.min(lowY, headY)
  return {
    sillY: round6(Math.max(floorY, sill)),
    headY: round6(Math.max(lowY, headY)),
    contrast: round6(Math.min(45, 100 * (mean - 0.5))),
    share: round6(mean),
    why: `rows ${top + best.a}..${top + best.b} unlike the wall's ${samples.length} solid stretch${samples.length === 1 ? '' : 'es'} on ${Math.round(mean * 100)} % of the opening's columns`,
  }
}

/** The roof soffit height over a point on a gable-end wall. */
export function gableSoffitY(gable: NonNullable<WallHost['gable']>, along: number): number {
  const fromEave = Math.min(Math.abs(along - gable.eaveAtLow), Math.abs(along - gable.eaveAtHigh))
  const tan = Math.tan((gable.pitchDeg * Math.PI) / 180)
  return round6(gable.eaveY + fromEave * tan - gable.buildUpVerticalM)
}

export type OpeningReadingInput = {
  plan: PlanFrameV2
  planRaster: Raster
  host: WallHost
  wallThicknessM: number
  callouts: readonly MetricEvidence[]
  /**
   * Elevations that show this facade, with their rasters. 005W: `bandOnly` marks a view registered on the walls' band
   * alone (no silhouette fit): it is read only where the plan's gaps on this wall show as openings on it.
   */
  views: Array<{ view: ElevationFrameV2; raster: Raster; bandOnly?: boolean }>
  /** A wider gap than this on the ground storey of an attached single-storey body reads as a vehicle door. */
  attachedSingleStorey: boolean
  /**
   * 005U-N4: the one vehicle mouth bound to a garage room on this wall: a room the publisher's list names a garage
   * (by a number read inside it), meeting this outer wall, where the plan leaves exactly one side open. The gap that is
   * that mouth is a vehicle door in any body — integral garages stand in the main one — its kind derived from the
   * drawing, its heights assumed unless something reads them. Absent everywhere else.
   */
  vehicleMouth?: { from: number; to: number; roomId: string; why: string }
  /** 005V: a gap not built as an opening, and why — reported by the caller as a refusal, never dropped silently. */
  onRefused?: (refusal: { interval: [number, number]; why: string }) => void
  /** 005Y-N1: diagnostics only (FEATURE_DEBUG): every gap, every callout weighed for it and why, and what it became. Write-only. */
  trace?: (record: Record<string, unknown>) => void
  /** 005W-N1: told the frame of every band-registered view that passed this wall's check (its gaps read on it). */
  onBandViewAccepted?: (frameId: string) => void
  index: number
}

/** Openings in one wall: plan gaps, then callouts, then the elevations. */
export function readWallOpenings(input: OpeningReadingInput, options: OpeningOptions = {}): OpeningV2[] {
  const opt = { ...DEFAULTS, ...options }
  const { plan, host } = input
  const gaps = planGaps(input.planRaster, plan, host, input.wallThicknessM, options)
  const out: OpeningV2[] = []
  const along = host.facade === 'FRONT' || host.facade === 'REAR' ? 'X' : 'Z'
  // 005W: the solid stretches of this wall, between its gaps — where an elevation shows what the wall looks like.
  const solids: Array<[number, number]> = []
  let solidFrom = Math.min(host.from, host.to)
  for (const g of [...gaps].sort((p, q) => p.interval[0] - q.interval[0])) {
    if (g.interval[0] > solidFrom) solids.push([solidFrom, g.interval[0]])
    solidFrom = Math.max(solidFrom, g.interval[1])
  }
  if (Math.max(host.from, host.to) > solidFrom) solids.push([solidFrom, Math.max(host.from, host.to)])
  // 005W: a view registered on the walls' band alone is a hypothesis about where this wall is on the render. It stands
  // only where most of the plan's gaps (at least two) read on it as openings closed by wall above — the gaps check the
  // registration; they never chose it. Otherwise the wall reads as if that view were not there.
  const wallTop = (interval: [number, number]): number => Math.min(host.floorY + host.storeyHeightM, host.eaveTopY ?? Number.POSITIVE_INFINITY, host.gable ? Math.max(gableSoffitY(host.gable, interval[0]), gableSoffitY(host.gable, interval[1])) : Number.POSITIVE_INFINITY)
  const views = input.views.filter((v) => {
    if (!v.bandOnly) return true
    const read = gaps.filter((g) => wallAppearanceExtent(v.raster, v.view, g.interval, solids, host.floorY, wallTop(g.interval)) !== null).length
    const accepted = gaps.length >= 2 && read >= Math.ceil((2 * gaps.length) / 3)
    if (accepted) input.onBandViewAccepted?.(v.view.registration.frameId)
    return accepted
  })
  for (const gap of gaps) {
    const [lo, hi] = gap.interval
    const widthPlan = round6(hi - lo)
    const centre = (lo + hi) / 2
    // 005V-N3: the drawn wall band the gap was read on, across the wall, in sheet pixels.
    const bandCentre = along === 'X' ? (gap.pixelRect.y0 + gap.pixelRect.y1) / 2 : (gap.pixelRect.x0 + gap.pixelRect.x1) / 2
    const unresolved: string[] = []
    // --- the callout: nearest printed w/h within reach with a width reading that agrees with the gap.
    // The gap's own width is the evidence that picks among the reader's width
    // candidates; the height candidates travel on for the elevation to pick among.
    let callout: OpeningV2['callout']
    const weighed: Array<Record<string, unknown>> = []
    for (const ev of input.callouts) {
      if (!ev.textBox) continue
      const cands = calloutCandidates(ev)
      if (!cands) continue
      const cx = (ev.textBox.x0 + ev.textBox.x1) / 2
      const cy = (ev.textBox.y0 + ev.textBox.y1) / 2
      const w = plan.toWorld(cx, cy)
      const alongDistance = Math.abs((along === 'X' ? w.x : w.z) - centre)
      const acrossDistance = Math.abs((along === 'X' ? w.z : w.x) - host.centreAt)
      if (alongDistance > opt.calloutReachM || acrossDistance > opt.calloutReachM) continue
      const seen = input.trace ? { evidenceId: ev.id, rawText: ev.rawText, px: [round6(cx), round6(cy)], confidence: ev.confidence, widths: cands.widths.slice(0, 3).map((c) => c.cm), heights: cands.heights.slice(0, 3).map((c) => c.cm), alongM: round6(alongDistance), acrossM: round6(acrossDistance) } : undefined
      if (ev.confidence < 0.2) {
        if (seen) weighed.push({ ...seen, decision: 'REJECTED', reason: `confidence ${ev.confidence} < 0.2` })
        continue
      }
      const agreeing = cands.widths.slice(0, 3).filter((c) => Math.abs(c.cm / 100 - widthPlan) <= Math.max(0.12, widthPlan * 0.12))
      if (agreeing.length === 0) {
        if (seen) weighed.push({ ...seen, decision: 'REJECTED', reason: `no width reading within 12 % of the ${widthPlan.toFixed(2)} m gap` })
        continue
      }
      if (seen) weighed.push({ ...seen, decision: 'AGREES' })
      const width = agreeing.reduce((best, c) => (c.score > best.score ? c : best), agreeing[0])
      const distance = round6(Math.hypot(alongDistance, acrossDistance))
      if (callout && callout.distanceM <= distance) continue
      callout = { widthCm: width.cm, heightCm: cands.heights[0].cm, evidenceId: ev.id, distanceM: distance, heightCandidates: cands.heights, ...(width !== cands.widths[0] ? { resolvedBy: `the ${widthPlan.toFixed(2)} m plan gap picked the width reading ${width.cm} over ${cands.widths[0].cm}` } : {}) }
    }
    // The interval: the plan gap, its width corrected to the printed one about the gap's centre.
    const widthM = callout ? round6(callout.widthCm / 100) : widthPlan
    const interval: [number, number] = callout ? [round6(centre - widthM / 2), round6(centre + widthM / 2)] : [lo, hi]
    // --- the elevations
    let elevation: OpeningV2['elevation']
    // 005W: where this wall ends above the floor: the storey, the eaves it runs under, or the rake over a gable end.
    const wallTopY = wallTop(interval)
    for (const { view, raster } of views) {
      // A printed callout fixes the height; the contrast reader's band only places it, as before 005W.
      const extNew = callout ? null : wallAppearanceExtent(raster, view, interval, solids, host.floorY, wallTopY)
      const extOld = elevationExtent(raster, view, interval, host.floorY, host.storeyHeightM)
      // The contrast reader stands where it read something the object reader does not contain; where it read nothing,
      // or only a part of the same opening (a blind's dark half), the object reader's whole extent replaces it.
      const ext = !extOld ? extNew : extNew && extNew.sillY <= extOld.sillY + 0.1 && extNew.headY >= extOld.headY - 0.1 ? extNew : extOld
      if (!ext) continue
      if (ext.headY - ext.sillY < 0.5) continue
      const confidence = round6(Math.min(0.85, 0.4 + ext.contrast / 100))
      if (!elevation || confidence > elevation.confidence) elevation = { frameId: view.registration.frameId, sillY: ext.sillY, headY: ext.headY, contrast: ext.contrast, confidence }
    }
    // --- sill and head
    let heightsAssumed = false
    let doorBySymbol = false
    let doorSwing = false
    let sillY: number
    let headY: number
    const prov: OpeningV2['provenance'] = { interval: 'SOURCE_DERIVED', width: callout ? 'SOURCE_EXACT' : 'SOURCE_DERIVED', sill: 'UNRESOLVED', head: 'UNRESOLVED', profile: 'SOURCE_DERIVED', family: 'VISUAL_SEMANTIC' }
    if (callout && elevation) {
      // The elevation's own height picks among the reader's height candidates
      // when the best one disagrees with it and another, nearly as good, does not.
      const drawn = elevation.headY - elevation.sillY
      if (Math.abs(drawn - callout.heightCm / 100) > 0.2 && callout.heightCandidates) {
        const top = callout.heightCandidates[0]?.score ?? 0
        const fitting = callout.heightCandidates.filter((c) => Math.abs(c.cm / 100 - drawn) <= 0.15 && c.score >= top * 0.7)
        if (fitting.length > 0) {
          // Among readings the matcher rates alike, the one the elevation is nearest to.
          const pick = fitting.reduce((best, c) => (Math.abs(c.cm / 100 - drawn) < Math.abs(best.cm / 100 - drawn) ? c : best), fitting[0])
          callout = { ...callout, heightCm: pick.cm, resolvedBy: `${callout.resolvedBy ? `${callout.resolvedBy}; ` : ''}the elevation's ${drawn.toFixed(2)} m picked the height reading ${pick.cm} over ${callout.heightCandidates[0].cm}` }
        }
      }
      const h = callout.heightCm / 100
      const agree = Math.abs(elevation.headY - elevation.sillY - h) <= 0.2
      if (agree) {
        sillY = round6((elevation.sillY + Math.max(host.floorY, elevation.headY - h)) / 2)
        headY = round6(sillY + h)
        prov.sill = 'SOURCE_CORROBORATED'
        prov.head = 'SOURCE_CORROBORATED'
      } else if (weakPrintedHeight(input.callouts.find((e) => e.id === callout?.evidenceId)?.confidence, h, elevation.headY - elevation.sillY, callout.heightCandidates)) {
        // 005W-N1: a height the recogniser read weakly, contradicted by the elevation by more than half a metre, with no
        // reading among its own candidates the elevation fits, is not printed evidence over the drawing: the elevation's
        // extent stands. The printed width, which the plan's gap agreed with, stays.
        sillY = elevation.sillY
        headY = elevation.headY
        prov.sill = 'IMAGE_METRIC_REGISTERED'
        prov.head = 'IMAGE_METRIC_REGISTERED'
        unresolved.push(`the printed height read ${h.toFixed(2)} m with confidence ${(input.callouts.find((e) => e.id === callout?.evidenceId)?.confidence ?? 0).toFixed(2)} against the elevation's ${(elevation.headY - elevation.sillY).toFixed(2)} m (${elevation.sillY.toFixed(2)}..${elevation.headY.toFixed(2)}), and none of its height readings fits the elevation: the elevation stands`)
      } else {
        // The printed height stands over a contrast band that contradicts it;
        // the band's sill is kept only where an opening of the printed height
        // starting there would still fit in the storey.
        const fits = elevation.sillY >= host.floorY - 0.05 && elevation.sillY + h <= host.floorY + host.storeyHeightM + 0.05
        if (h >= 1.95) {
          sillY = host.floorY
          prov.sill = 'SOURCE_DERIVED'
        } else if (fits) {
          sillY = elevation.sillY
          prov.sill = 'IMAGE_METRIC_REGISTERED'
        } else {
          sillY = round6(host.floorY + Math.max(0, 2.2 - h))
          prov.sill = 'ASSUMED_FOR_RENDERING'
        }
        headY = round6(sillY + h)
        prov.head = 'SOURCE_EXACT'
        unresolved.push(`the elevation reads ${(elevation.headY - elevation.sillY).toFixed(2)} m tall (${elevation.sillY.toFixed(2)}..${elevation.headY.toFixed(2)}) against the printed ${h.toFixed(2)}; the printed height stands`)
      }
    } else if (callout) {
      const h = callout.heightCm / 100
      // A printed height with no elevation reading: a door-height opening reaches the floor, a shorter one takes a common head.
      sillY = h >= 1.95 ? host.floorY : round6(host.floorY + Math.max(0, 2.2 - h))
      headY = round6(sillY + h)
      prov.sill = h >= 1.95 ? 'SOURCE_DERIVED' : 'ASSUMED_FOR_RENDERING'
      prov.head = 'SOURCE_EXACT'
      if (h < 1.95) unresolved.push('sill height (no elevation reading; a common head is assumed)')
      // Two readings the matcher cannot tell apart, and nothing else to tell them by.
      const rival = callout.heightCandidates?.slice(1).find((c) => c.score >= (callout?.heightCandidates?.[0].score ?? 0) - 0.02 && Math.abs(c.cm - (callout?.heightCm ?? 0)) >= 15)
      if (rival) {
        prov.head = 'UNRESOLVED'
        unresolved.push(`the printed height reads ${callout.heightCm} or ${rival.cm} alike, and no elevation shows this wall`)
      }
    } else if (elevation) {
      sillY = elevation.sillY
      headY = elevation.headY
      prov.sill = 'IMAGE_METRIC_REGISTERED'
      prov.head = 'IMAGE_METRIC_REGISTERED'
    } else {
      // 005U: nothing reads this opening's heights — no callout, no elevation. A sill the solver assumes is not evidence
      // of what the opening is: it used to be set at the floor and then read back as "reaches the floor", which made a
      // door, a glazed door, a multi-panel screen or a garage door of every unread gap (upper-storey doors with no
      // balcony, a vehicle door no source shows). Only the plan's own door symbol makes a door now; anything else is
      // drawn as a window at the conventional sill and head, and both the kind and the heights are named as assumed.
      // The plan's convention still stands where it is plausible: a gap a door's width with no glazing drawn across it
      // is a door on the ground storey (an entrance); above it, where an outside door needs a balcony, only a drawn
      // swing makes one. Never a garage door, a glazed door or a full-height screen: those need a height read.
      heightsAssumed = true
      doorSwing = doorSwingDrawn(input.planRaster, plan, host, interval, input.wallThicknessM)
      // 005Y-N3 (H1): glazing is either symbol — dark ink or the light lines a frame and glass are drawn with. A window's
      // narrow piece (the return of a corner window, drawn on light lines round the corner) is not an empty gap.
      doorBySymbol = widthM <= 1.3 && !glazingDrawn(input.planRaster, plan, host, interval, input.wallThicknessM) && !glazingLinesDrawn(input.planRaster, plan, host, interval, input.wallThicknessM, bandCentre) && (doorSwing || host.storeyIndex === 0)
      sillY = doorBySymbol ? host.floorY : round6(host.floorY + CONVENTIONS.windowSill)
      headY = round6(host.floorY + (doorBySymbol ? 2.1 : CONVENTIONS.openingHead))
      prov.sill = 'ASSUMED_FOR_RENDERING'
      prov.head = 'ASSUMED_FOR_RENDERING'
      unresolved.push('sill and head (no callout read and no elevation shows this wall)')
      if (!doorBySymbol) unresolved.push('kind (no callout, no elevation and no door symbol on the plan: drawn as a window, not read as one)')
      else if (!doorSwing) unresolved.push('kind (an empty ground-storey gap a door wide, read as a door by the plan convention; no swing drawn)')
    }
    // --- 005V: under the eaves. A head nothing read is a convention; where it would reach above the wall the roof
    // stops it at, it is lowered under the eaves while a window of at least MIN_ASSUMED_WINDOW_M remains. Below that
    // the gap holds no window the convention can draw — a knee wall, often with roof windows drawn above it on the
    // plan — and it is refused by name instead of emitted for the geometry to drop. A read height is never moved.
    if (heightsAssumed && host.eaveTopY !== undefined && headY > host.eaveTopY - EAVE_CLEARANCE_M) {
      const lowered = round6(host.eaveTopY - EAVE_CLEARANCE_M)
      if (lowered - sillY < MIN_ASSUMED_WINDOW_M) {
        input.onRefused?.({ interval: [lo, hi], why: `a ${widthPlan.toFixed(2)} m gap in the ${host.facade.toLowerCase()} wall of ${host.massId} on storey ${host.storeyIndex}, under the eaves: the wall stops ${(host.eaveTopY - host.floorY).toFixed(2)} m above the floor, too low for the assumed ${(headY - sillY).toFixed(2)} m window from ${(sillY - host.floorY).toFixed(2)} m (a knee wall; no callout or elevation reads an opening there) — not built` })
        input.trace?.({ kind: 'OPENING_GAP', id: null, frameId: plan.frameId, massId: host.massId, storey: host.storeyIndex, facade: host.facade, pixelRect: gap.pixelRect, intervalM: [round6(lo), round6(hi)], widthPlanM: widthPlan, callouts: weighed, decision: 'REFUSED', reason: 'under the eaves, too low for an assumed window' })
        continue
      }
      unresolved.push(`head lowered from ${(headY - host.floorY).toFixed(2)} to ${(lowered - host.floorY).toFixed(2)} m above the floor, under the eaves (assumed heights)`)
      headY = lowered
    }
    // --- profile: on a gable end, a head above the soffit at the far jamb is raked along the roof.
    let profile: HeadProfile = 'RECTANGULAR'
    let headFarY: number | undefined
    let tallEdge: OpeningV2['tallEdge']
    if (host.gable) {
      const soffitLow = gableSoffitY(host.gable, interval[0])
      const soffitHigh = gableSoffitY(host.gable, interval[1])
      const tall: 'LOW' | 'HIGH' = soffitLow >= soffitHigh ? 'LOW' : 'HIGH'
      const farSoffit = tall === 'LOW' ? soffitHigh : soffitLow
      if (headY > farSoffit + 0.05) {
        profile = 'RAKED_SINGLE'
        tallEdge = tall
        const tan = Math.tan((host.gable.pitchDeg * Math.PI) / 180)
        headFarY = round6(headY - widthM * tan)
        prov.profile = 'SOURCE_DERIVED'
        if (headFarY <= sillY + 0.3) unresolved.push('the raked head would meet the sill: the opening is narrower or lower than read')
      }
    }
    // --- family
    // 005U: a vehicle door, a door or a full-height screen needs a sill something READ; an assumed one decides nothing.
    const attachedVehicle = !heightsAssumed && input.attachedSingleStorey && host.storeyIndex === 0 && widthM >= 2.2 && sillY - host.floorY < 0.1
    // 005U-N4: the gap that is a garage room's one open side, with nothing drawn across it as glazing.
    const mouth = input.vehicleMouth
    const mouthGap =
      !!mouth &&
      host.storeyIndex === 0 &&
      Math.min(hi, mouth.to) - Math.max(lo, mouth.from) >= 0.8 * Math.max(widthPlan, mouth.to - mouth.from) &&
      !glazingDrawn(input.planRaster, plan, host, interval, input.wallThicknessM)
    let family: OpeningFamily = 'UNKNOWN'
    // 005Y-N4 (C): the drawn leaf, when its symbol is read; the callout rings printed on the plan hide what is under them
    let leaf: DrawnDoorLeaf | undefined
    const calloutBoxes: PixelBox[] = input.callouts.flatMap((e) => (e.textBox ? [{ x0: e.textBox.x0 - 2, y0: e.textBox.y0 - 2, x1: e.textBox.x1 + 2, y1: e.textBox.y1 + 2 }] : []))
    const reachesFloor = sillY - host.floorY < 0.12
    if (mouthGap && heightsAssumed && mouth) {
      family = 'GARAGE_DOOR'
      prov.family = 'SOURCE_DERIVED'
      sillY = host.floorY
      headY = round6(host.floorY + CONVENTIONS.openingHead)
      for (let k = unresolved.length - 1; k >= 0; k -= 1) if (unresolved[k].startsWith('kind (')) unresolved.splice(k, 1)
      unresolved.push(`a vehicle door: ${mouth.why}; its sill and head are assumed (${CONVENTIONS.openingHead} m) — no callout or elevation reads them`)
    } else if (mouthGap && !heightsAssumed && sillY - host.floorY < 0.1) family = 'GARAGE_DOOR'
    else if (heightsAssumed) {
      family = doorBySymbol ? 'DOOR' : 'WINDOW'
      prov.family = doorBySymbol ? (doorSwing ? 'SOURCE_DERIVED' : 'VISUAL_SEMANTIC') : 'ASSUMED_FOR_RENDERING'
    }
    else if (attachedVehicle) family = 'GARAGE_DOOR'
    else if (reachesFloor && widthM >= 2.0) family = 'MULTI_PANEL_GLAZING'
    else {
      // The plan symbol decides between a door and a glazed opening: a window is
      // drawn with its glazing lines across the gap, a door leaves the gap empty
      // (and usually draws its leaf and swing beside it).
      // 005W: with heights read off an elevation, the plan's light glazing symbol (005V-N3) counts as well as dark ink.
      const glazed = glazingDrawn(input.planRaster, plan, host, interval, input.wallThicknessM) || glazingLinesDrawn(input.planRaster, plan, host, interval, input.wallThicknessM, bandCentre)
      if (reachesFloor && !glazed && widthM <= 1.3 && headY - sillY <= 2.35) family = 'DOOR'
      // 005Y-N2: lines across the gap and a door's own symbol beside it — a leaf drawn open from one jamb, as long as the
      // gap is wide, and the arc it sweeps to the other — are a glazed leaf in a door, not a window to the floor. The
      // lines may be a threshold rather than glass: the leaf's glazing is named as read from them. On the ground storey
      // only: above it a floor-length glazing with no balcony in the model is a French window, drawn as before.
      else if (reachesFloor && glazed && host.storeyIndex === 0 && widthM >= 0.75 && widthM <= 1.3 && headY - sillY <= 2.35 && (leaf = doorLeafFound(input.planRaster, plan, host, interval, input.wallThicknessM, calloutBoxes, input.trace ? (d) => input.trace?.({ kind: 'DOOR_LEAF_DEBUG', interval: [round6(lo), round6(hi)], facade: host.facade, massId: host.massId, ...d }) : undefined)) !== undefined) {
        family = 'GLAZED_DOOR'
        prov.family = 'SOURCE_DERIVED'
        if (leaf.swing === 'OUT') unresolved.push('opens outward: its leaf and arc are drawn outside the wall')
        unresolved.push('the leaf’s glazing (lines across the gap beside a drawn leaf and swing: glass, or a threshold the plan draws the same way)')
      } else if (reachesFloor && glazed && widthM >= 0.75 && widthM <= 2.0 && host.storeyIndex === 0 && !doorSwingDrawn(input.planRaster, plan, host, interval, input.wallThicknessM)) family = 'WINDOW'
      else if (reachesFloor && widthM > 1.3 && widthM < 2.0) family = 'GLAZED_DOOR'
      else if (reachesFloor && !glazed) family = 'DOOR'
      else family = 'WINDOW'
    }
    const mullions = gap.stubs.map(([s0, s1]) => round6(((s0 + s1) / 2 - interval[0]) / widthM)).filter((f) => f > 0.05 && f < 0.95)
    const confidence = round6(Math.min(0.92, 0.5 + (callout ? 0.2 : 0) + (elevation ? 0.15 : 0) + (callout && elevation && prov.head === 'SOURCE_CORROBORATED' ? 0.07 : 0)))
    input.trace?.({ kind: 'OPENING_GAP', id: `opening-${host.storeyIndex}-${host.facade.toLowerCase()}-${input.index}-${out.length}`, frameId: plan.frameId, massId: host.massId, storey: host.storeyIndex, facade: host.facade, pixelRect: gap.pixelRect, intervalM: [round6(lo), round6(hi)], widthPlanM: widthPlan, callouts: weighed, callout: callout ? { widthCm: callout.widthCm, heightCm: callout.heightCm, evidenceId: callout.evidenceId } : null, elevation: elevation ? { frameId: elevation.frameId, sillY: elevation.sillY, headY: elevation.headY } : null, family, ...(leaf ? { leaf } : {}), provenanceFamily: prov.family, sillY: round6(sillY), headY: round6(headY), unresolved })
    out.push({
      id: `opening-${host.storeyIndex}-${host.facade.toLowerCase()}-${input.index}-${out.length}`,
      storeyIndex: host.storeyIndex,
      massId: host.massId,
      facade: host.facade,
      planeAt: host.planeAt,
      interval,
      widthM,
      sillY: round6(sillY),
      headY: round6(headY),
      headFarY,
      tallEdge,
      profile,
      family,
      ...(leaf ? { leaf } : {}),
      callout,
      elevation,
      mullions,
      planGap: { frameId: plan.frameId, pixelRect: gap.pixelRect },
      provenance: prov,
      uncertaintyM: callout ? 0.03 : 0.06,
      unresolved,
      confidence,
      why: `a ${widthPlan.toFixed(2)} m gap in the ${host.facade.toLowerCase()} wall of ${host.massId} on storey ${host.storeyIndex}${callout ? `, printed ${callout.widthCm}/${callout.heightCm}` : ', no callout read'}${elevation ? `, ${(elevation.headY - elevation.sillY).toFixed(2)} m tall on the elevation` : ', not read on an elevation'}${profile === 'RAKED_SINGLE' ? `; on a gable end its head rakes from ${headY.toFixed(2)} to ${headFarY?.toFixed(2)}` : ''}`,
    })
  }
  // 005W-N1: a gap nothing read — no callout, no elevation — beside one of the same width (within 0.05 m) on the same
  // wall and storey whose callout was read, is drawn like it: its sill, head and kind, named as assumed for rendering
  // with the sibling it follows. Only a rectangular head under the wall's top, and only from a printed sibling; nothing
  // is measured by it, and the kind it takes stays assumed.
  for (const o of out) {
    if (o.callout || o.elevation || o.provenance.sill !== 'ASSUMED_FOR_RENDERING' || o.provenance.head !== 'ASSUMED_FOR_RENDERING') continue
    const sibling = out.find((x) => x !== o && x.callout && x.provenance.head !== 'UNRESOLVED' && x.profile === 'RECTANGULAR' && Math.abs(x.widthM - o.widthM) <= 0.05)
    if (!sibling) continue
    if (host.gable && sibling.headY > Math.min(gableSoffitY(host.gable, o.interval[0]), gableSoffitY(host.gable, o.interval[1])) - 0.05) continue
    if (host.eaveTopY !== undefined && sibling.headY > host.eaveTopY - EAVE_CLEARANCE_M) continue
    o.sillY = sibling.sillY
    o.headY = sibling.headY
    o.family = sibling.family
    o.unresolved = [...o.unresolved.filter((u) => !u.startsWith('sill and head') && !u.startsWith('kind')), `sill, head and kind assumed from ${sibling.id}, the same ${o.widthM.toFixed(2)} m width on this wall, printed ${sibling.callout?.widthCm}/${sibling.callout?.heightCm}`]
    o.provenance = { ...o.provenance, family: 'VISUAL_SEMANTIC' }
    o.why = `${o.why}; drawn like ${sibling.id} (the same width on this wall, printed)`
  }
  return out
}

/**
 * 005Y-N2: a door's plan symbol beside a gap, read strictly, on the face it is drawn on (a door opens in or out): a leaf
 * drawn open — a thin straight run of ink square to the wall, from the wall's face at one jamb, as long as the gap is wide and
 * ending there (paper on its line past 1.1 of the width) — and the arc it sweeps from its tip to the other jamb, inked
 * on most of its length about a pivot in the wall's thickness, where the frame stands. Ink is read against the paper
 * or the room's fill in front of the gap, not a fixed grey: a leaf is often a light line over a tinted floor. Hatching,
 * furniture, a cupboard's edge or a label make ink in the square in front of the gap but not this figure; the
 * ink-fraction test (`doorSwingDrawn`) cannot tell them apart. Leaf and arc are lines — paper a hand's breadth to either
 * side — where a planter's shrubs, a hatched floor or a filled symbol are blots.
 */
export function doorLeafDrawn(raster: Raster, plan: PlanFrameV2, host: WallHost, interval: [number, number], wallThicknessM: number, occluders: readonly PixelBox[] = []): boolean {
  return doorLeafFound(raster, plan, host, interval, wallThicknessM, occluders) !== undefined
}

/** 005Y-N4 (C): a pixel rectangle printed over the drawing (a callout's ring): what lies under it is not seen. */
export type PixelBox = { x0: number; y0: number; x1: number; y1: number }
/** 005Y-N4 (C): a drawn leaf and its arc: which way it opens (IN: into the body) and at which end of the gap it hangs. */
export type DrawnDoorLeaf = { swing: 'IN' | 'OUT'; hingeAt: 'LOW' | 'HIGH' }

/**
 * 005Y-N4 (C): `doorLeafDrawn`, telling which side of the wall the leaf and its arc are drawn on and at which jamb the
 * leaf hangs. A callout printed over the arc (as a door's own size often is, beside it) hides it: samples under an
 * `occluders` box are unseen, neither ink nor paper, and the arc is judged on what is seen: at least half of it, or a
 * third of it inked nearly throughout. With nothing hidden the test is `doorLeafDrawn`'s, unchanged.
 */
export function doorLeafFound(raster: Raster, plan: PlanFrameV2, host: WallHost, interval: [number, number], wallThicknessM: number, occluders: readonly PixelBox[] = [], debug?: (record: Record<string, unknown>) => void): DrawnDoorLeaf | undefined {
  const w = interval[1] - interval[0]
  const into = host.facade === 'FRONT' || host.facade === 'WEST' ? 1 : -1
  const alongX = host.facade === 'FRONT' || host.facade === 'REAR'
  const step = (plan.mppX + plan.mppY) / 2
  const hidden = (p: { x: number; y: number }): boolean => occluders.some((b) => p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1)
  let found: DrawnDoorLeaf | undefined
  ;[into, -into].some((inward) => {
    const inner = host.centreAt + (inward * wallThicknessM) / 2
    const at = (along: number, depth: number): { x: number; y: number } => (alongX ? plan.toPixel(along, inner + inward * depth) : plan.toPixel(inner + inward * depth, along))
    const ground: number[] = []
    for (let u = 0.1; u <= 0.9; u += 0.1) {
      for (let v = 0.1; v <= 0.9; v += 0.1) {
        const p = at(interval[0] + u * w, v * w)
        ground.push(lumaOf(raster, Math.round(p.x), Math.round(p.y)))
      }
    }
    ground.sort((a, b) => a - b)
    const paper = ground[Math.floor(ground.length / 2)]
    const dark = (p: { x: number; y: number }): boolean => {
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if (lumaOf(raster, Math.round(p.x) + dx, Math.round(p.y) + dy) < paper - 35) return true
      return false
    }
    const share = (from: number, to: number, along: number): number => {
      let k = 0
      let n = 0
      for (let d = from; d <= to; d += step) {
        if (hidden(at(along, d))) continue
        n += 1
        if (dark(at(along, d))) k += 1
      }
      return n === 0 ? 0 : k / n
    }
    // a leaf is a line: paper a hand's breadth from it on the gap's side, away from the wall (on its other side a
    // partition may run along it; a row of shrubs in a planter, a hatched or filled area, is ink on both)
    const thinLeaf = (along: number, towards: 1 | -1): number => {
      let k = 0
      let n = 0
      for (let d = 0.2 * w; d <= 0.9 * w; d += step) {
        if (!dark(at(along, d)) || hidden(at(along + towards * 0.1, d))) continue
        n += 1
        if (!dark(at(along + towards * 0.1, d))) k += 1
      }
      return n === 0 ? 0 : k / n
    }
    for (const [hinge, towards, hingeAt] of [[interval[0], 1, 'LOW'], [interval[1], -1, 'HIGH']] as const) {
      // the leaf, at an offset from the jamb up to a leaf's thickness
      let leafAt: number | undefined
      for (let off = 0; off <= 0.12 && leafAt === undefined; off += step) {
        const along = hinge + towards * off
        if (share(0, 0.9 * w, along) >= 0.8 && share(1.1 * w, 1.3 * w, along) <= 0.3 && thinLeaf(along, towards) >= 0.7) leafAt = along
      }
      debug?.({ inward, hingeAt, leafAt: leafAt === undefined ? null : round6(leafAt), leafShares: [0, 0.03, 0.06, 0.09, 0.12].map((off) => { const al = hinge + towards * off; return [round6(share(0, 0.9 * w, al)), round6(share(1.1 * w, 1.3 * w, al)), round6(thinLeaf(al, towards))] }) })
      if (leafAt === undefined) continue
      // the arc, its radius the gap's width, inked from 6° to 84° off the wall — reaching the far jamb and the leaf's
      // tip — and a line, paper a hand's breadth inside and outside it, from 30° on (nearer the wall it runs into the
      // wall's own ink), about one pivot in the wall's thickness
      let arc = false
      for (let pivot = -wallThicknessM; pivot <= 0.1 * w && !arc; pivot += step) {
        let inked = 0
        let n = 0
        let thin = 0
        let m = 0
        let samples = 0
        for (let deg = 6; deg <= 84; deg += 3) {
          const a = (deg * Math.PI) / 180
          const on = (r: number): boolean => dark(at(leafAt + towards * r * Math.cos(a), pivot + r * Math.sin(a)))
          samples += 1
          if (hidden(at(leafAt + towards * w * Math.cos(a), pivot + w * Math.sin(a)))) continue
          n += 1
          if (!on(w)) continue
          inked += 1
          if (deg < 30) continue
          m += 1
          if (!on(w - 0.1) && !on(w + 0.1)) thin += 1
        }
        // unhidden, the arc as before; partly under a callout, a third of it seen and inked nearly throughout
        const seenEnough = (n >= samples / 2 && inked / n >= 0.6) || (n < samples && n >= samples / 3 && inked / n >= 0.9)
        arc = seenEnough && m > 0 && thin / m >= 0.5
        if (debug && inked > 0) debug({ inward, hingeAt, pivot: round6(pivot), samples, seen: n, inked, thin, m })
      }
      if (arc) {
        found = { swing: inward === into ? 'IN' : 'OUT', hingeAt }
        return true
      }
    }
    return false
  })
  return found
}

/** Thin glazing lines drawn across the gap within the wall's thickness: a window or a glazed screen. */
function glazingDrawn(raster: Raster, plan: PlanFrameV2, host: WallHost, interval: [number, number], wallThicknessM: number): boolean {
  const along = host.facade === 'FRONT' || host.facade === 'REAR' ? 'X' : 'Y'
  const mpp = (plan.mppX + plan.mppY) / 2
  const half = (wallThicknessM * 0.45) / mpp
  const a0 = along === 'X' ? plan.toPixel(interval[0] + 0.1, host.centreAt) : plan.toPixel(host.centreAt, interval[1] - 0.1)
  const a1 = along === 'X' ? plan.toPixel(interval[1] - 0.1, host.centreAt) : plan.toPixel(host.centreAt, interval[0] + 0.1)
  const from = Math.round(Math.min(a0.x, a1.x, a0.y, a1.y) === Math.min(a0.x, a1.x) && along === 'X' ? Math.min(a0.x, a1.x) : Math.min(a0.y, a1.y))
  const to = Math.round(along === 'X' ? Math.max(a0.x, a1.x) : Math.max(a0.y, a1.y))
  const centre = along === 'X' ? a0.y : a0.x
  let withInk = 0
  let n = 0
  for (let i = from; i <= to; i += 1) {
    let dark = 0
    for (let d = -Math.ceil(half); d <= Math.ceil(half); d += 1) {
      const l = along === 'X' ? lumaOf(raster, i, centre + d) : lumaOf(raster, centre + d, i)
      if (l < 160) dark += 1
    }
    n += 1
    if (dark >= 1 && dark <= Math.max(2, half * 0.6)) withInk += 1
  }
  return n > 0 && withInk / n >= 0.6
}

/** 005V-N3: a thin glazing line is darker than a floor fill or the paper, lighter than wall ink allows for. */
const GLAZING_LINE_LUMA = 215
/** 005V-N3: how far either side of the drawn band's centre the glazing lines are looked for. */
const GLAZING_WINDOW_M = 0.25

/**
 * 005V-N3: the light glazing symbol. Many plans draw a window's frame and glass as thin grey lines across the gap,
 * lighter than wall ink (and than the dark-ink test above), between the room's floor fill and the paper outside. A
 * door's gap carries at most one such line — the threshold where the floor fill meets the paper — so a column with
 * two or more distinct thin lines across the drawn wall band is glazed, and the gap is glazed where most of its columns
 * are. The band is the drawn one (`bandCentrePx`, where the gap was read), not the registered face. 005W: consulted
 * only for a gap whose heights an elevation read; the span runs along the wall (x for a front or rear wall, y for a
 * side one).
 */
function glazingLinesDrawn(raster: Raster, plan: PlanFrameV2, host: WallHost, interval: [number, number], wallThicknessM: number, bandCentrePx: number): boolean {
  const along = host.facade === 'FRONT' || host.facade === 'REAR' ? 'X' : 'Y'
  const mpp = (plan.mppX + plan.mppY) / 2
  const half = Math.max((wallThicknessM * 0.45) / mpp, GLAZING_WINDOW_M / mpp)
  const a0 = along === 'X' ? plan.toPixel(interval[0] + 0.1, host.centreAt) : plan.toPixel(host.centreAt, interval[1] - 0.1)
  const a1 = along === 'X' ? plan.toPixel(interval[1] - 0.1, host.centreAt) : plan.toPixel(host.centreAt, interval[0] + 0.1)
  const from = Math.round(along === 'X' ? Math.min(a0.x, a1.x) : Math.min(a0.y, a1.y))
  const to = Math.round(along === 'X' ? Math.max(a0.x, a1.x) : Math.max(a0.y, a1.y))
  let glazed = 0
  let n = 0
  for (let i = from; i <= to; i += 1) {
    let lines = 0
    let inLine = false
    for (let d = -Math.ceil(half); d <= Math.ceil(half); d += 1) {
      const l = along === 'X' ? lumaOf(raster, i, bandCentrePx + d) : lumaOf(raster, bandCentrePx + d, i)
      const line = l < GLAZING_LINE_LUMA
      if (line && !inLine) lines += 1
      inLine = line
    }
    n += 1
    if (lines >= 2) glazed += 1
  }
  return n > 0 && glazed / n >= 0.6
}

export const lumaOf = (r: Raster, x: number, y: number): number => {
  const xi = Math.round(x)
  const yi = Math.round(y)
  if (xi < 0 || yi < 0 || xi >= r.width || yi >= r.height) return 255
  const o = (yi * r.width + xi) * 4
  return 0.299 * r.data[o] + 0.587 * r.data[o + 1] + 0.114 * r.data[o + 2]
}

/** A quarter-circle swing arc drawn inside the room beside the gap: a door. */
function doorSwingDrawn(raster: Raster, plan: PlanFrameV2, host: WallHost, interval: [number, number], wallThicknessM: number): boolean {
  // Sample the square inside the wall over the gap: an arc adds a little thin ink to an otherwise empty square.
  const w = interval[1] - interval[0]
  const inward = host.facade === 'FRONT' ? 1 : host.facade === 'REAR' ? -1 : host.facade === 'WEST' ? 1 : -1
  const along = host.facade === 'FRONT' || host.facade === 'REAR' ? 'X' : 'Z'
  const a0 = along === 'X' ? { x: interval[0], z: host.centreAt + inward * wallThicknessM * 0.6 } : { x: host.centreAt + inward * wallThicknessM * 0.6, z: interval[0] }
  const a1 = along === 'X' ? { x: interval[1], z: host.centreAt + inward * (wallThicknessM * 0.6 + w) } : { x: host.centreAt + inward * (wallThicknessM * 0.6 + w), z: interval[1] }
  const p = plan.toPixel(a0.x, a0.z)
  const q = plan.toPixel(a1.x, a1.z)
  const f = inkFraction(raster, Math.min(p.x, q.x), Math.min(p.y, q.y), Math.max(p.x, q.x), Math.max(p.y, q.y), 140)
  return f > 0.02 && f < 0.25
}

/** 005U-N4: a room the publisher's list names a garage (the name, in the languages the sources print). */
export const GARAGE_LABEL = /gara[zżg]/i

/**
 * 005U-N4: the open sides of the plan that bound a garage room on an outer wall.
 *
 * The room is a garage only by a number read inside it naming a published garage — never by its area. A side counts
 * when the plan's decomposition decided the wall stops there (an open side, not the mouth of a recess), on one of the
 * body's outer faces, along the room's own face, for at least 80 % of its width. The caller takes a vehicle door from
 * exactly one; several are a question, none is nothing.
 */
export function garageMouth(
  room: { number?: string; label?: string; bounds: { x0: number; z0: number; x1: number; z1: number } },
  body: { x0: number; z0: number; x1: number; z1: number },
  wideOpenings: ReadonlyArray<{ axis: 'X' | 'Y'; linePx: number; fromPx: number; toPx: number; decision: string; compound?: { intervalId: string; role: string } }>,
  plan: Pick<PlanFrameV2, 'toWorld'>,
  wallThicknessM: number,
): Array<{ facade: 'FRONT' | 'REAR' | 'WEST' | 'EAST'; from: number; to: number; id: string }> {
  if (!room.number || !room.label || !GARAGE_LABEL.test(room.label)) return []
  const reach = wallThicknessM + 0.2
  const out: Array<{ facade: 'FRONT' | 'REAR' | 'WEST' | 'EAST'; from: number; to: number; id: string }> = []
  for (const w of wideOpenings) {
    if (w.decision !== 'OPEN_SIDE' || w.compound?.role === 'RECESS_MOUTH') continue
    const a = w.axis === 'Y' ? plan.toWorld(w.fromPx, w.linePx) : plan.toWorld(w.linePx, w.fromPx)
    const b = w.axis === 'Y' ? plan.toWorld(w.toPx, w.linePx) : plan.toWorld(w.linePx, w.toPx)
    const from = w.axis === 'Y' ? Math.min(a.x, b.x) : Math.min(a.z, b.z)
    const to = w.axis === 'Y' ? Math.max(a.x, b.x) : Math.max(a.z, b.z)
    const at = w.axis === 'Y' ? a.z : a.x
    const facade = w.axis === 'Y' ? (Math.abs(at - body.z0) <= reach ? 'FRONT' : Math.abs(at - body.z1) <= reach ? 'REAR' : undefined) : Math.abs(at - body.x0) <= reach ? 'WEST' : Math.abs(at - body.x1) <= reach ? 'EAST' : undefined
    if (!facade) continue
    const roomFace = facade === 'FRONT' ? room.bounds.z0 : facade === 'REAR' ? room.bounds.z1 : facade === 'WEST' ? room.bounds.x0 : room.bounds.x1
    if (Math.abs(roomFace - at) > reach) continue
    const roomFrom = w.axis === 'Y' ? room.bounds.x0 : room.bounds.z0
    const roomTo = w.axis === 'Y' ? room.bounds.x1 : room.bounds.z1
    if (Math.min(to, roomTo) - Math.max(from, roomFrom) < 0.8 * (to - from)) continue
    out.push({ facade, from: round6(from), to: round6(to), id: w.compound?.intervalId ?? `${w.axis}-${w.linePx}-${w.fromPx}-${w.toPx}` })
  }
  return out
}

/** 005Y-N3 (H1): how far past the corner square a piece of a corner assembly may stop: a frame's width. */
const CORNER_REACH_EXTRA_M = 0.25
/** 005Y-N3 (H1): the share of the corner square in wall ink above which the plan draws a pier there. */
const CORNER_PIER_INK = 0.35
/** 005Y-N3 (H1): wall ink is drawn darker than this; glazing lines, floor fill and paper are lighter. */
const CORNER_WALL_INK_LUMA = 100

export type CornerAssembly = { a: string; b: string; corner: { x: number; z: number }; pierInk: number; why: string }

/**
 * 005Y-N3 (H1): corner assemblies among one body's openings on one storey. Two openings in perpendicular walls whose
 * ends both reach the corner they share — each stops within the other wall's thickness of the outer corner, plus a
 * frame — are one glazing wrapping the corner when the plan draws no pier in the corner square (its share of wall ink
 * stays under `CORNER_PIER_INK`). A corner whose square is wall ink holds two openings near a pier, not one assembly.
 *
 * Nothing about the openings changes: each keeps its own wall, interval, heights and kind. A door is never made a
 * window here (or the reverse) — what each piece is stays decided by its own evidence.
 */
export function cornerAssemblies(openings: readonly OpeningV2[], rect: { x0: number; z0: number; x1: number; z1: number }, wallThicknessM: number, raster: Raster, plan: PlanFrameV2): CornerAssembly[] {
  const out: CornerAssembly[] = []
  const reach = wallThicknessM + CORNER_REACH_EXTRA_M
  const used = new Set<string>()
  const alongX = openings.filter((o) => o.facade === 'FRONT' || o.facade === 'REAR')
  const alongZ = openings.filter((o) => o.facade === 'WEST' || o.facade === 'EAST')
  for (const a of alongX) {
    for (const b of alongZ) {
      if (a.massId !== b.massId || a.storeyIndex !== b.storeyIndex || used.has(a.id) || used.has(b.id)) continue
      const x = b.facade === 'WEST' ? rect.x0 : rect.x1
      const z = a.facade === 'FRONT' ? rect.z0 : rect.z1
      const aEnd = Math.min(Math.abs(a.interval[0] - x), Math.abs(a.interval[1] - x))
      const bEnd = Math.min(Math.abs(b.interval[0] - z), Math.abs(b.interval[1] - z))
      if (aEnd > reach || bEnd > reach) continue
      const sx = b.facade === 'WEST' ? 1 : -1
      const sz = a.facade === 'FRONT' ? 1 : -1
      const p = plan.toPixel(x, z)
      const q = plan.toPixel(x + sx * wallThicknessM, z + sz * wallThicknessM)
      const pierInk = round6(inkFraction(raster, Math.min(p.x, q.x), Math.min(p.y, q.y), Math.max(p.x, q.x), Math.max(p.y, q.y), CORNER_WALL_INK_LUMA))
      if (pierInk > CORNER_PIER_INK) continue
      used.add(a.id)
      used.add(b.id)
      out.push({ a: a.id, b: b.id, corner: { x: round6(x), z: round6(z) }, pierInk, why: `${a.id} (${a.facade.toLowerCase()}) stops ${aEnd.toFixed(2)} m and ${b.id} (${b.facade.toLowerCase()}) ${bEnd.toFixed(2)} m from the corner (${x.toFixed(2)}, ${z.toFixed(2)}), and the plan draws no pier between them (${(pierInk * 100).toFixed(0)} % wall ink in the corner square): one glazing round the corner` })
    }
  }
  return out
}

/** 005Y-N3 (H5): a callout the recogniser read at this confidence or above is a firm reading of its printed size. */
export const FIRM_CALLOUT_CONFIDENCE = 0.9

/**
 * 005Y-N3 (H5): the storey's common head over a weak printed height. A printed height the recogniser did not confirm
 * (the callout below `FIRM_CALLOUT_CONFIDENCE`: the lattice's reading alone), whose first reading matches no head the
 * recogniser read firmly on the storey's other openings while its second or third does, takes that head: openings of
 * one storey share their heads more often than a weak digit is right. Returns the height to take, or nothing.
 */
export function commonHeadReading(callout: { heightCm: number; heightCandidates?: ReadonlyArray<{ cm: number; score: number }> }, calloutConfidence: number, firmHeadsCm: ReadonlySet<number>): number | undefined {
  if (calloutConfidence >= FIRM_CALLOUT_CONFIDENCE || !callout.heightCandidates || callout.heightCandidates.length < 2) return undefined
  if (firmHeadsCm.has(callout.heightCm)) return undefined
  return callout.heightCandidates.slice(1, 3).find((h) => firmHeadsCm.has(h.cm))?.cm
}

/** 005Y-N3 (H5): two registrations of one house whose grounds lie this close agree on it (the band test's tolerance). */
export const GROUND_AGREEMENT_M = 0.3

/**
 * 005Y-N3 (H5): the views whose ground is off — hung from the ridge datum at a top row that is not the ridge. The ground
 * is the printed terrain datum where the section gives one; without it, the views that agree with each other, when
 * they outnumber the ones that do not (a tie decides nothing). Returns each refused view with the reason.
 */
export function viewGroundRefusals(views: ReadonlyArray<{ frameId: string; bottomY: number }>, others: ReadonlyArray<{ bottomY: number }>, terrainY: number | undefined): Array<{ frameId: string; reason: string }> {
  const grounds = [...views, ...others]
  const agreeing = (y: number): number => grounds.filter((g) => Math.abs(g.bottomY - y) <= GROUND_AGREEMENT_M).length
  const out: Array<{ frameId: string; reason: string }> = []
  for (const own of views) {
    if (terrainY !== undefined) {
      if (Math.abs(own.bottomY - terrainY) > GROUND_AGREEMENT_M) out.push({ frameId: own.frameId, reason: `it puts the ground at ${own.bottomY.toFixed(2)} m where the section prints the terrain at ${terrainY.toFixed(2)} m` })
      continue
    }
    const mine = agreeing(own.bottomY)
    const best = grounds.filter((g) => Math.abs(g.bottomY - own.bottomY) > GROUND_AGREEMENT_M).reduce<{ y: number; n: number } | undefined>((acc, g) => {
      const n = agreeing(g.bottomY)
      return !acc || n > acc.n ? { y: g.bottomY, n } : acc
    }, undefined)
    if (best && best.n >= 2 && best.n > mine) out.push({ frameId: own.frameId, reason: `it puts the ground at ${own.bottomY.toFixed(2)} m where ${best.n} of the house's other registered views agree on ${best.y.toFixed(2)} m` })
  }
  return out
}
