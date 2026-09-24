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
  callout?: { widthCm: number; heightCm: number; evidenceId: string; distanceM: number }
  elevation?: { frameId: string; sillY: number; headY: number; contrast: number; confidence: number }
  /** Mullion positions as fractions of the width, from stubs the plan draws inside the gap. */
  mullions: number[]
  planGap: { frameId: string; pixelRect: PixelRect }
  provenance: Record<'interval' | 'width' | 'sill' | 'head' | 'profile' | 'family', ProvenanceStatus>
  uncertaintyM: number
  unresolved: string[]
  confidence: number
  why: string
}

export type OpeningOptions = { minWidthM?: number; maxWidthM?: number; calloutReachM?: number; stubMaxM?: number }
const DEFAULTS: Required<OpeningOptions> = { minWidthM: 0.5, maxWidthM: 6.5, calloutReachM: 2.0, stubMaxM: 0.3 }

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
  const centrePx = along === 'X' ? plan.toPixel(0, host.centreAt).y : plan.toPixel(host.centreAt, 0).x
  const p0 = along === 'X' ? plan.toPixel(host.from, host.centreAt).x : plan.toPixel(host.centreAt, host.to).y
  const p1 = along === 'X' ? plan.toPixel(host.to, host.centreAt).x : plan.toPixel(host.centreAt, host.from).y
  const from = Math.min(p0, p1) + wallPx * 0.9
  const to = Math.max(p0, p1) - wallPx * 0.9
  // Solid where at least 60 % of the wall's thickness is ink across the centre line.
  const pieces = bandPieces(raster, along, centrePx, from, to, wallPx * 0.45, Math.max(2, Math.round(wallPx * 0.9 * 0.55)))
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
  /** Elevations that show this facade, with their rasters. */
  views: Array<{ view: ElevationFrameV2; raster: Raster }>
  /** A wider gap than this on the ground storey of an attached single-storey body reads as a vehicle door. */
  attachedSingleStorey: boolean
  index: number
}

/** Openings in one wall: plan gaps, then callouts, then the elevations. */
export function readWallOpenings(input: OpeningReadingInput, options: OpeningOptions = {}): OpeningV2[] {
  const opt = { ...DEFAULTS, ...options }
  const { plan, host } = input
  const gaps = planGaps(input.planRaster, plan, host, input.wallThicknessM, options)
  const out: OpeningV2[] = []
  const along = host.facade === 'FRONT' || host.facade === 'REAR' ? 'X' : 'Z'
  for (const gap of gaps) {
    const [lo, hi] = gap.interval
    const widthPlan = round6(hi - lo)
    const centre = (lo + hi) / 2
    const unresolved: string[] = []
    // --- the callout: nearest printed w/h within reach whose width agrees with the gap
    let callout: OpeningV2['callout']
    for (const ev of input.callouts) {
      if (!ev.textBox) continue
      const pair = calloutPair(ev)
      if (!pair) continue
      const cx = (ev.textBox.x0 + ev.textBox.x1) / 2
      const cy = (ev.textBox.y0 + ev.textBox.y1) / 2
      const w = plan.toWorld(cx, cy)
      const alongDistance = Math.abs((along === 'X' ? w.x : w.z) - centre)
      const acrossDistance = Math.abs((along === 'X' ? w.z : w.x) - host.centreAt)
      if (alongDistance > opt.calloutReachM || acrossDistance > opt.calloutReachM) continue
      if (Math.abs(pair.widthCm / 100 - widthPlan) > Math.max(0.2, widthPlan * 0.3)) continue
      const distance = round6(Math.hypot(alongDistance, acrossDistance))
      if (callout && callout.distanceM <= distance) continue
      callout = { widthCm: pair.widthCm, heightCm: pair.heightCm, evidenceId: ev.id, distanceM: distance }
    }
    // The interval: the plan gap, its width corrected to the printed one about the gap's centre.
    const widthM = callout ? round6(callout.widthCm / 100) : widthPlan
    const interval: [number, number] = callout ? [round6(centre - widthM / 2), round6(centre + widthM / 2)] : [lo, hi]
    // --- the elevations
    let elevation: OpeningV2['elevation']
    for (const { view, raster } of input.views) {
      const ext = elevationExtent(raster, view, interval, host.floorY, host.storeyHeightM)
      if (!ext) continue
      if (ext.headY - ext.sillY < 0.5) continue
      const confidence = round6(Math.min(0.85, 0.4 + ext.contrast / 100))
      if (!elevation || confidence > elevation.confidence) elevation = { frameId: view.registration.frameId, sillY: ext.sillY, headY: ext.headY, contrast: ext.contrast, confidence }
    }
    // --- sill and head
    let sillY: number
    let headY: number
    const prov: OpeningV2['provenance'] = { interval: 'SOURCE_DERIVED', width: callout ? 'SOURCE_EXACT' : 'SOURCE_DERIVED', sill: 'UNRESOLVED', head: 'UNRESOLVED', profile: 'SOURCE_DERIVED', family: 'VISUAL_SEMANTIC' }
    if (callout && elevation) {
      const h = callout.heightCm / 100
      const agree = Math.abs(elevation.headY - elevation.sillY - h) <= 0.2
      sillY = agree ? round6((elevation.sillY + Math.max(host.floorY, elevation.headY - h)) / 2) : elevation.sillY
      headY = round6(sillY + h)
      prov.sill = agree ? 'SOURCE_CORROBORATED' : 'IMAGE_METRIC_REGISTERED'
      prov.head = agree ? 'SOURCE_CORROBORATED' : 'SOURCE_EXACT'
      if (!agree) unresolved.push(`the elevation reads ${(elevation.headY - elevation.sillY).toFixed(2)} m tall against the printed ${h.toFixed(2)}`)
    } else if (callout) {
      const h = callout.heightCm / 100
      // A printed height with no elevation reading: a door-height opening reaches the floor, a shorter one takes a common head.
      sillY = h >= 1.95 ? host.floorY : round6(host.floorY + Math.max(0, 2.2 - h))
      headY = round6(sillY + h)
      prov.sill = h >= 1.95 ? 'SOURCE_DERIVED' : 'ASSUMED_FOR_RENDERING'
      prov.head = 'SOURCE_EXACT'
      if (h < 1.95) unresolved.push('sill height (no elevation reading; a common head is assumed)')
    } else if (elevation) {
      sillY = elevation.sillY
      headY = elevation.headY
      prov.sill = 'IMAGE_METRIC_REGISTERED'
      prov.head = 'IMAGE_METRIC_REGISTERED'
    } else {
      sillY = host.floorY
      headY = round6(host.floorY + 2.1)
      prov.sill = 'ASSUMED_FOR_RENDERING'
      prov.head = 'ASSUMED_FOR_RENDERING'
      unresolved.push('sill and head (no callout read and no elevation shows this wall)')
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
    const attachedVehicle = input.attachedSingleStorey && host.storeyIndex === 0 && widthM >= 2.2 && sillY - host.floorY < 0.1
    let family: OpeningFamily = 'UNKNOWN'
    const reachesFloor = sillY - host.floorY < 0.12
    if (attachedVehicle) family = 'GARAGE_DOOR'
    else if (reachesFloor && widthM >= 2.0) family = 'MULTI_PANEL_GLAZING'
    else {
      // The plan symbol decides between a door and a glazed opening: a window is
      // drawn with its glazing lines across the gap, a door leaves the gap empty
      // (and usually draws its leaf and swing beside it).
      const glazed = glazingDrawn(input.planRaster, plan, host, interval, input.wallThicknessM)
      if (reachesFloor && !glazed && widthM <= 1.3 && headY - sillY <= 2.35) family = 'DOOR'
      else if (reachesFloor && glazed && widthM >= 0.75 && widthM <= 2.0 && host.storeyIndex === 0 && !doorSwingDrawn(input.planRaster, plan, host, interval, input.wallThicknessM)) family = 'WINDOW'
      else if (reachesFloor && widthM > 1.3 && widthM < 2.0) family = 'GLAZED_DOOR'
      else if (reachesFloor && !glazed) family = 'DOOR'
      else family = 'WINDOW'
    }
    const mullions = gap.stubs.map(([s0, s1]) => round6(((s0 + s1) / 2 - interval[0]) / widthM)).filter((f) => f > 0.05 && f < 0.95)
    const confidence = round6(Math.min(0.92, 0.5 + (callout ? 0.2 : 0) + (elevation ? 0.15 : 0) + (callout && elevation && prov.head === 'SOURCE_CORROBORATED' ? 0.07 : 0)))
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
  return out
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

const lumaOf = (r: Raster, x: number, y: number): number => {
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
