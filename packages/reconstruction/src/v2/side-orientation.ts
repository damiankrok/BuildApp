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
import type { ElevationFrameV2 } from './frame.js'

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
