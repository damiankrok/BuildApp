/**
 * Which of two unlabelled side elevations is which.
 *
 * A publisher may label both side elevations identically ("boczna"), and the
 * registration then assigns them to the two side walls in the order it meets
 * them — a coin toss that mirrors both views when it lands wrong: every
 * reading along a side view then lands at the far end of the house, and a
 * low wing is read where the main body's gable stands.
 *
 * Once the main roof is solved, the drawing can settle it. The main body's
 * top, seen from the side, has a known profile along the depth — a gable's
 * rake and apex when the ridge runs across the view, a level ridge line over
 * the body's own run when it runs along it — and that profile sits at one end
 * of the view or the other. The silhouette's top is measured column by column
 * against the sky in each orientation; the orientation whose top matches the
 * profile clearly better is taken. A building whose side profile is symmetric
 * gives no margin, and the assignment it had stands.
 */
import { round6 } from '@buildapp/source-common'
import type { Mask, Raster } from '@buildapp/source-cv'
import { skyMask } from './camera.js'
import type { ElevationFrameV2, ElevationRegistrationV2 } from './frame.js'

export type SideProfile = {
  /** The run along the view the profile is known over. */
  from: number
  to: number
  /** World y of the building's top at a coordinate along the view. */
  topAt: (along: number) => number
  /** No part of the building stands above this world y. */
  ceilingY: number
}

export type OrientationScore = { samples: number; medianErrorM: number }

const isGreen = (r: number, g: number, b: number): boolean => g - Math.max(r, b) >= 8

/**
 * The main roof's top seen on a view whose columns run along `alongAxis`: a
 * gable's rake and apex where the ridge runs across the view, a level ridge
 * line where it runs along it, over the roof's own run.
 */
export function mainTopProfile(roof: { ridgeAxis: 'X' | 'Z'; ridgeAt: number; ridgeY: number; pitchDeg: number; footprint: { x0: number; x1: number; z0: number; z1: number } }, alongAxis: 'X' | 'Z'): SideProfile {
  const tan = Math.tan((roof.pitchDeg * Math.PI) / 180)
  const [from, to] = alongAxis === 'X' ? [roof.footprint.x0, roof.footprint.x1] : [roof.footprint.z0, roof.footprint.z1]
  const acrossRidge = roof.ridgeAxis !== alongAxis
  return { from, to, topAt: (a) => (acrossRidge ? roof.ridgeY - Math.abs(a - roof.ridgeAt) * tan : roof.ridgeY), ceilingY: roof.ridgeY + 1.5 }
}

/** The silhouette's top minus the profile, in metres, at evenly spaced columns over the profile's run (clipped to ±2 m). */
export function topResiduals(view: ElevationFrameV2, raster: Raster, profile: SideProfile, mask: Mask): number[] {
  const out: number[] = []
  const N = 31
  const span = profile.to - profile.from
  for (let k = 0; k < N; k += 1) {
    const a = profile.from + span * (0.05 + (0.9 * k) / (N - 1))
    const px = Math.round(view.pxOf(a))
    if (px < 0 || px >= raster.width) continue
    const start = Math.max(0, Math.round(view.pyOf(profile.ceilingY)))
    let top: number | undefined
    for (let y = start; y < raster.height; y += 1) {
      const i = y * raster.width + px
      const o = i * 4
      if (mask.data[i] === 1 || isGreen(raster.data[o], raster.data[o + 1], raster.data[o + 2])) continue
      top = y
      break
    }
    if (top === undefined) continue
    out.push(Math.max(-2, Math.min(2, view.yOf(top) - profile.topAt(a))))
  }
  return out
}

const medianOf = (xs: readonly number[]): number => {
  const s = [...xs].sort((p, q) => p - q)
  return s[Math.floor(s.length / 2)]
}

/** How well a view's silhouette top matches the profile, read in this view's registration. */
export function scoreOrientation(view: ElevationFrameV2, raster: Raster, profile: SideProfile, mask: Mask): OrientationScore {
  const errors = topResiduals(view, raster, profile, mask).map(Math.abs)
  return { samples: errors.length, medianErrorM: errors.length === 0 ? Number.POSITIVE_INFINITY : round6(medianOf(errors)) }
}

/**
 * How far this view's heights sit above the main roof's own top, as the
 * median over the roof's run: the registration puts the silhouette's top on
 * the ridge datum, and where the measured outline clipped a narrow apex every
 * height read on the view is lifted by the same amount. Undefined when too
 * few columns can be read.
 */
export function topOffset(view: ElevationFrameV2, raster: Raster, profile: SideProfile, mask: Mask): { offsetM: number; samples: number } | undefined {
  const r = topResiduals(view, raster, profile, mask)
  if (r.length < 10) return undefined
  return { offsetM: round6(medianOf(r)), samples: r.length }
}

/** How much better, in median metres, a view must fit mirrored before it counts as preferring it. */
const MARGIN_M = 0.25

export type OrientationDecision = { swap: boolean; current: number; mirrored: number; why: string }

/**
 * Decide, for a set of unlabelled side views together, whether their side
 * assignment should be swapped: every view that can be read must fit the
 * main body's profile better mirrored than as assigned, each by a clear
 * margin. A symmetric profile fits both ways equally and never swaps.
 */
export function decideSideOrientation(views: ReadonlyArray<{ current: ElevationFrameV2; mirrored: ElevationFrameV2; raster: Raster }>, profile: SideProfile, masks: Map<Raster, Mask>, debug?: (line: string) => void): OrientationDecision {
  let current = 0
  let mirrored = 0
  let read = 0
  let agree = 0
  for (const v of views) {
    let mask = masks.get(v.raster)
    if (!mask) {
      mask = skyMask(v.raster)
      masks.set(v.raster, mask)
    }
    const c = scoreOrientation(v.current, v.raster, profile, mask)
    const m = scoreOrientation(v.mirrored, v.raster, profile, mask)
    debug?.(`side orientation ${v.current.registration.frameId}: as assigned ${c.medianErrorM} m over ${c.samples}, mirrored ${m.medianErrorM} m over ${m.samples}`)
    if (c.samples < 10 || m.samples < 10) continue
    current += c.medianErrorM
    mirrored += m.medianErrorM
    read += 1
    if (m.medianErrorM + MARGIN_M <= c.medianErrorM) agree += 1
  }
  if (read === 0) return { swap: false, current, mirrored, why: 'no side view could be read against the sky: the assignment stands' }
  // Every view read must prefer the mirrored reading on its own, by a clear margin: two independent drawings agreeing is the evidence.
  const swap = agree === read
  const figures = `the main body's side profile fits ${current.toFixed(2)} m as assigned and ${mirrored.toFixed(2)} m mirrored (median error, summed over ${read} view${read === 1 ? '' : 's'}; ${agree} of ${read} prefer the mirrored reading by at least ${MARGIN_M} m)`
  return { swap, current: round6(current), mirrored: round6(mirrored), why: swap ? `${figures}: the two side views were assigned the wrong way round and are swapped` : `${figures}: the assignment stands` }
}

/** 005W-N1: the share of a wall's plan gaps one side assignment must read more than the other before it is taken. */
const OPENINGS_MARGIN = 1 / 3

/** One plan gap of a side wall, with what its storey's wall reading needs: the wall's solid stretches and its top. */
export type SideGap = { interval: [number, number]; floorY: number; storeyHeightM: number; solids: ReadonlyArray<[number, number]>; topY: number }

/**
 * 005W-N1: which side wall the unlabelled side views show, read from the openings. The plan says where each side wall
 * has its gaps; an elevation of that wall shows an opening over each of them. The views are scored together as
 * assigned and with every one of them moved to the other side wall (and so mirrored): the share of the assigned wall's
 * gaps that read as an opening of at least 0.5 m on the view. Swapped only where every view on its own reads the other
 * wall's gaps better than its assigned wall's, the swapped share is at least a half and beats the assigned one by a
 * third, and there are at least two gaps on each side to test: independent drawings agreeing is the evidence. The same gap being an opening on the plan and on the view is what makes
 * them one object; the elevation's own heights are read later, as for any view.
 */
export function decideSidesByOpenings(
  views: ReadonlyArray<{ current: ElevationFrameV2; swapped: ElevationFrameV2; raster: Raster }>,
  gapsOf: (side: 'LEFT' | 'RIGHT') => readonly SideGap[],
  read: (raster: Raster, view: ElevationFrameV2, gap: SideGap) => boolean,
  debug?: (line: string) => void,
): { swap: boolean; current: number; swapped: number; why: string } {
  const sideOf = (v: ElevationFrameV2): 'LEFT' | 'RIGHT' => (v.side === 'LEFT' ? 'LEFT' : 'RIGHT')
  let currentRead = 0
  let currentTotal = 0
  let swappedRead = 0
  let swappedTotal = 0
  let preferSwapped = 0
  for (const v of views) {
    const asAssigned = gapsOf(sideOf(v.current))
    const asSwapped = gapsOf(sideOf(v.swapped))
    const c = asAssigned.filter((g) => read(v.raster, v.current, g)).length
    const s = asSwapped.filter((g) => read(v.raster, v.swapped, g)).length
    debug?.(`side openings ${v.current.registration.frameId}: as assigned (${v.current.side}) ${c} of ${asAssigned.length} gaps read, swapped (${v.swapped.side}) ${s} of ${asSwapped.length}`)
    if (asAssigned.length < 2 || asSwapped.length < 2) return { swap: false, current: 0, swapped: 0, why: 'a side wall has fewer than two plan gaps to test the views against: the assignment stands' }
    currentRead += c
    currentTotal += asAssigned.length
    swappedRead += s
    swappedTotal += asSwapped.length
    if (s / asSwapped.length > c / asAssigned.length) preferSwapped += 1
  }
  if (views.length === 0) return { swap: false, current: 0, swapped: 0, why: 'no unlabelled side view: nothing to decide' }
  const current = round6(currentRead / currentTotal)
  const swapped = round6(swappedRead / swappedTotal)
  const swap = preferSwapped === views.length && swapped >= 0.5 && swapped - current >= OPENINGS_MARGIN - 1e-9
  const figures = `the plan's side-wall gaps read as openings on ${currentRead} of ${currentTotal} as assigned and ${swappedRead} of ${swappedTotal} with the side views swapped`
  return { swap, current, swapped, why: swap ? `${figures}: the side views show the other walls and are swapped` : `${figures}: the assignment stands` }
}

/** 005W-N1: how closely two side views' gable outlines must agree in width, per band of rows, to be one sheet scale. */
export const SAME_SHEET_OUTLINE_TOLERANCE = 0.02

/**
 * The rows of the main roof's gable, as shares of the way from the apex down to the eaves, the outline is read on:
 * the lower half, under the chimneys that stand above the roof near the ridge and widen its outline there.
 */
const OUTLINE_BANDS: ReadonlyArray<readonly [number, number]> = [
  [0.5, 0.7],
  [0.75, 0.95],
]

export type GableOutline = { bands: Array<{ width: number; centre: number; rows: number; row: number }> }

/**
 * 005W-N1: the main roof's gable outline on a side view, between the apex row and the eaves row: on each row of a band,
 * the first and the last pixel that is not sky; per band, the median width and centre. A band where fewer than five
 * rows have sky on both sides is not read.
 */
export function gableOutline(mask: Mask, apexRow: number, eaveRow: number): GableOutline | undefined {
  const bands: GableOutline['bands'] = []
  for (const [a, b] of OUTLINE_BANDS) {
    const widths: number[] = []
    const centres: number[] = []
    const ys: number[] = []
    for (let y = Math.round(apexRow + a * (eaveRow - apexRow)); y <= Math.round(apexRow + b * (eaveRow - apexRow)); y += 1) {
      if (y < 0 || y >= mask.height) continue
      let x0 = -1
      let x1 = -1
      for (let x = 0; x < mask.width; x += 1) if (mask.data[y * mask.width + x] === 0) { x0 = x; break }
      for (let x = mask.width - 1; x >= 0; x -= 1) if (mask.data[y * mask.width + x] === 0) { x1 = x; break }
      if (x0 <= 0 || x1 >= mask.width - 1 || x1 <= x0) continue
      widths.push(x1 + 1 - x0)
      centres.push((x0 + x1 + 1) / 2)
      ys.push(y)
    }
    if (widths.length < 5) return undefined
    bands.push({ width: medianOf(widths), centre: medianOf(centres), rows: widths.length, row: medianOf(ys) })
  }
  return { bands }
}

/**
 * 005W-N1: a side view registered as the opposite wall of a silhouette-registered side view drawn on the same sheet.
 * Both must show the main gable at one scale and one height: its outline the same width (within 2 %) in each of two
 * bands of rows, both centred on one column per view (within 1 % of the width), and the mate's own gable axis must land
 * on the ridge (within 0.3 m). The view then takes the mate's scale and ground row, runs the other way along the house,
 * and puts its gable axis on the ridge. Undefined where any of this does not hold.
 */
export function sameSheetSideRegistration(
  frame: { id: string; assetId: string },
  side: 'LEFT' | 'RIGHT',
  mate: ElevationRegistrationV2,
  mateView: ElevationFrameV2,
  mateOutline: GableOutline | undefined,
  outline: GableOutline | undefined,
  ridgeAt: number,
  refusedWhy: string,
): ElevationRegistrationV2 | undefined {
  if (!mateOutline || !outline) return undefined
  for (let i = 0; i < OUTLINE_BANDS.length; i += 1) if (!(Math.abs(outline.bands[i].width / mateOutline.bands[i].width - 1) <= SAME_SHEET_OUTLINE_TOLERANCE)) return undefined
  const axisOf = (o: GableOutline): number | undefined => (Math.abs(o.bands[0].centre - o.bands[1].centre) <= 0.01 * o.bands[1].width ? (o.bands[0].centre + o.bands[1].centre) / 2 : undefined)
  const mateAxis = axisOf(mateOutline)
  const axis = axisOf(outline)
  if (mateAxis === undefined || axis === undefined) return undefined
  if (!(Math.abs(mateView.alongOf(mateAxis) - ridgeAt) <= 0.3)) return undefined
  const alongSign: 1 | -1 = side === 'RIGHT' ? 1 : -1
  const extent = { x0: Math.round(axis - (mate.extent.x1 - mateAxis)), y0: mate.extent.y0, x1: Math.round(axis + (mateAxis - mate.extent.x0)), y1: mate.extent.y1 }
  const widths = outline.bands.map((b, i) => `${b.width} against ${mateOutline.bands[i].width} px`).join(', ')
  return {
    ...mate,
    frameId: frame.id,
    assetId: frame.assetId,
    side,
    sideConfidence: 0.4,
    sideWhy: `the publisher labels this drawing a side elevation, refused at registration (${refusedWhy}); it shows the main gable at the scale of the ${mate.side.toLowerCase()} view, so it is taken as the opposite side wall`,
    extent,
    alongAtLeft: round6(ridgeAt - alongSign * (axis - extent.x0) * mate.mpp),
    alongSign,
    spanWhy: `the sheet scale of ${mate.frameId}: the gable outline spans ${widths} in two bands of rows`,
    confidence: round6(Math.min(mate.confidence, 0.4)),
    why: `the gable outline is ${widths} wide on the ${mate.side.toLowerCase()} view's rows: one sheet scale, ${mate.mpp} m/px and its ground row ${mate.zeroRow}; the gable axis at column ${axis.toFixed(1)} is the ridge at ${ridgeAt}`,
  }
}

/**
 * 005W-N1: the row of the gable's apex on a side view, from its outline: the roof's two edges run at the pitch, so the
 * outline's half-width grows by 1 / tan(pitch) a row, and the apex is where the two bands' line meets zero width.
 * Undefined unless the outline's own slope between the two bands is the stated pitch within 10 % — chimneys, a
 * dormer or a hip in the bands break it. A silhouette's top row is a chimney's top as often as the ridge.
 */
export function gableApexRow(outline: GableOutline | undefined, pitchDeg: number): { row: number; why: string } | undefined {
  if (!outline || outline.bands.length < 2) return undefined
  const [a, b] = outline.bands
  const tan = Math.tan((pitchDeg * Math.PI) / 180)
  const slope = (b.row - a.row) / ((b.width - a.width) / 2)
  if (!(Math.abs(slope / tan - 1) <= 0.1)) return undefined
  const row = round6(((a.row - (a.width / 2) * tan) + (b.row - (b.width / 2) * tan)) / 2)
  return { row, why: `the gable outline widens ${(b.width - a.width).toFixed(0)} px over ${(b.row - a.row).toFixed(0)} rows (slope ${slope.toFixed(3)} against tan ${pitchDeg}° = ${tan.toFixed(3)}), so its apex is at row ${row.toFixed(1)}` }
}

/** 005Y-N5 (C5): the share of a wall band's columns that must have more than sky directly over the silhouette's top. */
export const ROOF_TOP_MIN_COVERED_SHARE = 0.5
/** 005Y-N5 (C5): … rising over it by at least this share of the silhouette's height (a ridge cap or a chimney is less). */
export const ROOF_TOP_MIN_RISE_SHARE = 0.1
/** 005Y-N5 (C5): the two widths (shares of the band) at which a pointed roof top's outline is measured to find where it closes. */
export const ROOF_TOP_POINTED_SHARE: readonly [number, number] = [0.2, 0.5]

/**
 * 005Y-N5 (C5): the top of what stands over a wall band, where a silhouette's top row is not it. A traced silhouette
 * may stop at the eaves line — the roof read as background — and putting the ridge datum on that row scales the view by
 * whatever band happens to land its ground. Over the band's columns, each column climbs from the silhouette's top
 * while the pixels above are not the sky connected to the sheet's top (`skyMask`), and the roof's outline is the widest
 * run of columns standing up to each row. A top that runs flat (a ridge seen lengthwise) is the row where the outline
 * reaches a fifth of the band at once, so a chimney does not lift it; a top that narrows to a point (a hip or a gable
 * seen end on) is where its outline closes, carried on from the rows where it is a fifth and half the band wide — never
 * above what is drawn there. Nothing is returned
 * where most of those columns (`ROOF_TOP_MIN_COVERED_SHARE`) do not rise over the silhouette's top by a tenth of its
 * height (`ROOF_TOP_MIN_RISE_SHARE`: the top is the ridge already, with only its cap and the chimneys over it), or where the climb reaches the sheet's edge (a tree or the
 * frame, not a roof).
 */
export function roofTopOverBand(mask: Mask, topRow: number, bottomRow: number, x0: number, x1: number): { row: number; why: string } | undefined {
  const top = Math.round(topRow)
  const tops: number[] = []
  for (let x = Math.max(0, Math.round(x0)); x <= Math.min(mask.width - 1, Math.round(x1)); x += 1) {
    let y = top
    while (y - 1 >= 0 && mask.data[(y - 1) * mask.width + x] === 0) y -= 1
    tops.push(y)
  }
  if (tops.length === 0) return undefined
  // Over a ridge only the chimneys (and the ridge cap) rise into the sky; over an eaves line the roof does, on most of
  // the band, and by a good part of the silhouette's own height.
  const rise = ROOF_TOP_MIN_RISE_SHARE * (bottomRow - topRow)
  const covered = tops.filter((y) => top - y >= rise).length / tops.length
  if (covered < ROOF_TOP_MIN_COVERED_SHARE) return undefined
  const highest = Math.min(...tops)
  // The widest run of columns standing up to a row: the roof's outline there.
  const widest = (y: number): number => {
    let best = 0
    let run = 0
    for (const t of tops) {
      run = t <= y ? run + 1 : 0
      best = Math.max(best, run)
    }
    return best
  }
  const firstRow = (share: number): number | undefined => {
    for (let y = highest; y < top; y += 1) if (widest(y) >= share * tops.length) return y
    return undefined
  }
  const why = (row: number, how: string): string => `the silhouette's top row ${top} has the roof over it on ${Math.round(covered * 100)} % of the band's ${tops.length} columns; ${how}, row ${row}`
  const r0 = firstRow(ROOF_TOP_POINTED_SHARE[0])
  if (r0 === undefined || r0 <= 0 || r0 >= top - 2) return undefined
  const w0 = widest(r0)
  // A top seen lengthwise (a ridge) is flat: the outline reaches a fifth of the band in one row, over nothing wider than
  // a chimney.
  if (widest(r0 - 1) < w0 / 2) return { row: r0, why: why(r0, `its top runs flat across ${w0} columns at`) }
  // A top seen end on (a hip or a gable end) narrows to a point, which a chimney may stand on: its apex is where the
  // outline's two widths, carried on at their own slope, close — never above what is drawn there.
  const r1 = firstRow(ROOF_TOP_POINTED_SHARE[1])
  if (r1 === undefined || r1 <= r0) return undefined
  const slope = (widest(r1) - w0) / (r1 - r0)
  if (!(slope > 0)) return undefined
  const row = round6(Math.max(highest, r0 - w0 / slope))
  return { row, why: why(row, `its outline narrows ${slope.toFixed(2)} columns a row from ${w0} at row ${r0} and closes at`) }
}
