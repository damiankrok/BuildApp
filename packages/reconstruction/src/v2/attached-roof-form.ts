/**
 * The form of the roof over an attached body, read off the elevations.
 *
 * Layout inference (`inferRoofSystems`) knows a body only from the plans, and
 * a plan cannot say whether the body under it carries a flat slab or a pitched
 * roof of its own: it takes the attached body as FLAT by convention and says
 * so. The registered elevations can say more. Where a view sees the body
 * against the sky — no other body and no other roof in the same columns —
 * the body's top can be walked up from inside its wall to the first run of
 * sky or vegetation, column by column, and the resulting profile has one of
 * three shapes:
 *
 *  - LOW: the top stops at the wall head (a slab, a parapet). A flat roof.
 *  - LEVEL: the top stands well above the wall head and is level across the
 *    body. A pitched roof seen side on, its ridge running along the view.
 *  - PEAKED: the top rises from the wall head at both ends to an apex over
 *    the middle. A gable end facing the view, its ridge running away from it.
 *
 * A LEVEL top on its own is also what a wall standing higher than the plans
 * say would look like, so it is taken as a roof only when its height matches
 * a roof at the stated pitch over the body's own half-span. A PEAKED top
 * carries its own pitch. Readings that disagree — a flat top in one view and
 * a pitched one in another, or two ridge directions — leave the form unread,
 * and the caller keeps its convention with the conflict on record.
 *
 * Nothing here knows a project: every threshold is in metres through the
 * view's own registration or a fraction of the body's own span.
 */
import { round6 } from '@buildapp/source-common'
import type { Mask, Raster } from '@buildapp/source-cv'
import { skyMask } from './camera.js'
import type { ElevationFrameV2 } from './frame.js'
import { mainTopProfile, topOffset } from './side-orientation.js'
import { elevationBackground } from './elevation-background.js'

export type PlanBox = { x0: number; x1: number; z0: number; z1: number }

export type BodyTopProfile = 'LOW' | 'LEVEL' | 'PEAKED' | 'IRREGULAR'

export type BodyTopReading = {
  frameId: string
  side: ElevationFrameV2['side']
  /** The world axis the view's columns run along. */
  alongAxis: 'X' | 'Z'
  profile: BodyTopProfile
  /** Columns read, and the share of the body's run they cover. */
  samples: number
  coverage: number
  /** How far the top stands above the wall head: the median for a level top, the apex for a peaked one. */
  riseM: number
  /** A peaked top's slope (rise per metre along), when it has one. */
  slope?: number
  residualM: number
  /**
   * v3.53.4: read on a view that looks down the main ridge and shows no gable of the main roof: the top over this body
   * stands on the same level line as the top over the main body. `riseM` is then the main ridge above the wall head,
   * by that identity and not by the view's metres.
   */
  atMainTop?: true
  why: string
}

/** v3.53.4: what `atMainTop` readings say of a body: a roof whose ridge crosses the main one at its height runs over it. */
export type CrossMainTop = { ridgeAxis: 'X' | 'Z'; frameIds: string[]; why: string }

export type AttachedRoofForm =
  | {
      kind: 'GABLE'
      ridgeAxis: 'X' | 'Z'
      pitchDeg: number
      pitchSource: 'STATED' | 'MEASURED'
      measuredRiseM: number
      expectedRiseM: number
      readings: BodyTopReading[]
      confidence: number
      why: string
      /**
       * N8-01: where the eaves were derived from the ridge the views read rather than taken at the wall head (a body
       * whose roof reaches the main ridge over an attic storey): the eaves' world y.
       */
      eaveY?: number
      crossMainTop?: CrossMainTop
    }
  | { kind: 'FLAT'; readings: BodyTopReading[]; why: string }
  /**
   * EXTERIOR-COMPLETE (Bakopy): the main roof runs on over the body — its top is level at the main ridge, along the
   * main ridge, and the body stands within the main roof's width at an end of its ridge. `footprint` is the main roof's
   * footprint carried over the body (the main roof's width across the ridge, out to the body's far end along it).
   */
  | { kind: 'UNDER_MAIN'; footprint: PlanBox; measuredRiseM: number; readings: BodyTopReading[]; why: string }
  | { kind: 'UNREAD'; readings: BodyTopReading[]; why: string; crossMainTop?: CrossMainTop }

export type AttachedRoofFormInput = {
  views: ReadonlyArray<{ view: ElevationFrameV2; raster: Raster }>
  body: PlanBox
  /** World y of the body's wall head. */
  wallTopY: number
  /** How far a pitched roof's top surface stands above the wall head at the eave. */
  eaveBuildUpM: number
  /** The pitch the source states for the roof, when it states one. */
  statedPitchDeg?: number
  /** Everything else that stands high in plan: the other bodies and the other roofs' footprints. */
  occluders: readonly PlanBox[]
  /** No part of the building stands above this world y. */
  ceilingY: number
  /**
   * The main roof, when there is one: each view's heights are re-anchored on
   * its measured top, so a registration whose outline clipped the apex does
   * not lift every height read on that view.
   */
  mainRoof?: MainRoofForJoin
  /** Sky masks already computed for these rasters. */
  masks?: Map<Raster, Mask>
  /**
   * N8-01: the floor of the body's top storey, world y, when that storey is the main body's top storey too: its roof
   * may then stand on knee walls under the main ridge, its eaves below the walls' head, as the main roof's do.
   */
  topStoreyFloorY?: number
  /**
   * v3.46: the views whose vertical registration was refused (their ground lands off the printed terrain): heights on
   * them are read only through an anchor in the same picture (the main roof's own line), never through the registration.
   */
  verticalRefused?: ReadonlySet<string>
  debug?: (line: string) => void
}

/** N8-01: eaves derived from the ridge stand at least this far above the top storey's floor (a knee wall), or are not read. */
const ATTIC_EAVE_MIN_M = 0.3
/** A top within this of the wall head is a slab or a parapet, not a pitched roof. */
const LOW_MAX_M = 0.6
/** The fewest columns a view must read before its profile means anything. */
const MIN_SAMPLES = 12
/** The share of the body's run a view must see against the sky. */
const MIN_COVERAGE = 0.6
/** A peaked top rises at least this steeply. */
const MIN_PEAK_SLOPE = Math.tan((12 * Math.PI) / 180)
/** Background rows in a row that end the walk up a column. */
const BACKGROUND_RUN = 3

const isGreen = (r: number, g: number, b: number): boolean => g - Math.max(r, b) >= 8

/** v3.53.4: two top lines are one when their median rows differ by no more than this many metres (and two pixels). */
export const SAME_TOP_LINE_M = 0.15
/** … and each is level when at least this share of its columns stands on its line. */
export const SAME_TOP_LINE_SHARE = 0.75

/** The top of the body along one view, column by column, or undefined when the view cannot see it against the sky. */
export function readBodyTop(input: Omit<AttachedRoofFormInput, 'views'>, view: ElevationFrameV2, raster: Raster): BodyTopReading | undefined {
  const alongAxis: 'X' | 'Z' = view.side === 'FRONT' || view.side === 'REAR' ? 'X' : 'Z'
  const [a0, a1] = alongAxis === 'X' ? [input.body.x0, input.body.x1] : [input.body.z0, input.body.z1]
  const span = a1 - a0
  if (span <= 0.5) return undefined
  const margin = Math.max(0.15, span * 0.04)
  const hidden = (a: number): boolean => input.occluders.some((o) => (alongAxis === 'X' ? a >= o.x0 - 0.1 && a <= o.x1 + 0.1 : a >= o.z0 - 0.1 && a <= o.z1 + 0.1))
  let mask = input.masks?.get(raster)
  if (!mask) {
    mask = skyMask(raster)
    input.masks?.set(raster, mask)
  }
  const sky = mask
  // Heights on this view, re-anchored on the main roof's own top in the same picture.
  let offset = 0
  let anchored = ''
  if (input.mainRoof) {
    // N8-01: where this body stands against an end of the main roof's run along the view, its own roof stands behind
    // the main slope on that side, in the same columns, and is not the main roof's top: the profile is read over the
    // far half of the run only
    const profile = mainTopProfile(input.mainRoof, alongAxis)
    const f = input.mainRoof.footprint
    const [m0, m1] = alongAxis === 'X' ? [f.x0, f.x1] : [f.z0, f.z1]
    const [b0, b1] = alongAxis === 'X' ? [input.body.x0, input.body.x1] : [input.body.z0, input.body.z1]
    const mid = (m0 + m1) / 2
    const clipped = Math.abs(b0 - m1) <= 0.05 ? { ...profile, to: mid } : Math.abs(b1 - m0) <= 0.05 ? { ...profile, from: mid } : profile
    const found = topOffset(view, raster, clipped, sky)
    if (found) {
      // A view that disagrees with the main roof by more than a storey's slab is not registered well enough to read.
      if (Math.abs(found.offsetM) > 1.0) {
        // v3.53.4: … unless the view looks down the main ridge and what it shows instead of the main gable is one level
        // line over the main body and over this one: a roof crossing the main one, read in the picture's own rows
        return alongAxis !== input.mainRoof.ridgeAxis ? readTopWithMain(input, view, raster, sky, found.offsetM) : undefined
      }
      offset = found.offsetM
      anchored = `, heights re-anchored by ${(-offset).toFixed(2)} m on the main roof's own line (${found.support} of ${found.samples} columns)`
    }
  }
  // v3.46: a view whose vertical registration was refused (its ground lands off the printed terrain) measures nothing in
  // metres through that registration. Re-anchored on the main roof's own line in the same picture it can still measure;
  // without that anchor it gives no reading here — neither a flat top nor a pitched one: a refused registration is not
  // evidence of either.
  if (!anchored && input.verticalRefused?.has(view.registration.frameId)) {
    input.debug?.(`body top on the ${view.side.toLowerCase()} view (${view.registration.frameId}): its heights were refused against the printed terrain and no main roof line anchors them in the picture: not read`)
    return undefined
  }
  const yAt = (row: number): number => view.yOf(row) - offset
  // EXTERIOR-COMPLETE (Bakopy): trees behind the body and the sky seen through them are background too
  const behind = elevationBackground(raster, sky)
  const background = (x: number, y: number): boolean => {
    const i = y * raster.width + x
    if (behind.data[i] === 1) return true
    const o = i * 4
    return isGreen(raster.data[o], raster.data[o + 1], raster.data[o + 2])
  }
  const N = 41
  const samples: Array<{ a: number; h: number; px: number; top: number; start: number }> = []
  for (let k = 0; k < N; k += 1) {
    const a = a0 + margin + ((span - 2 * margin) * k) / (N - 1)
    if (hidden(a)) continue
    const px = Math.round(view.pxOf(a))
    if (px < 0 || px >= raster.width) continue
    const start = Math.round(view.pyOf(input.wallTopY - 0.3 + offset))
    const stop = Math.max(0, Math.round(view.pyOf(input.ceilingY + offset)))
    if (start < 0 || start >= raster.height || start <= stop) continue
    // The walk starts inside the wall: a column that shows background there does not show the body at all.
    if (background(px, start)) continue
    let run = 0
    let top: number | undefined
    for (let y = start - 1; y >= stop; y -= 1) {
      if (background(px, y)) {
        run += 1
        if (run >= BACKGROUND_RUN) {
          top = y + BACKGROUND_RUN
          break
        }
      } else run = 0
    }
    // A column still solid at the ceiling is a tree or the sheet's edge, not the body's top.
    if (top === undefined) continue
    samples.push({ a, h: yAt(top) - input.wallTopY, px, top, start })
  }
  const coverage = samples.length / N
  const side = view.side.toLowerCase()
  input.debug?.(`body top on the ${side} view (${view.registration.frameId}, offset ${offset}): ${samples.map((q) => `${q.a.toFixed(2)}@${q.px}:${q.start}->${q.top}=${q.h.toFixed(2)}`).join(' ')}`)
  if (samples.length < MIN_SAMPLES || coverage < MIN_COVERAGE) return undefined
  const hs = samples.map((s) => s.h).sort((p, q) => p - q)
  const median = hs[Math.floor(hs.length / 2)]
  const q90 = hs[Math.min(hs.length - 1, Math.floor(hs.length * 0.9))]
  const levelResidual = Math.sqrt(samples.reduce((acc, s) => acc + (s.h - median) ** 2, 0) / samples.length)
  // A symmetric tent over the body's middle: h = R − k·|a − c|.
  const c = (a0 + a1) / 2
  const ds = samples.map((s) => Math.abs(s.a - c))
  const md = ds.reduce((p, q) => p + q, 0) / ds.length
  const mh = samples.reduce((p, s) => p + s.h, 0) / samples.length
  const sxx = ds.reduce((p, d) => p + (d - md) ** 2, 0)
  const sxy = samples.reduce((p, s, i) => p + (ds[i] - md) * (s.h - mh), 0)
  const k = sxx > 1e-9 ? -sxy / sxx : 0
  const R = mh + k * md
  const tentResidual = Math.sqrt(samples.reduce((acc, s, i) => acc + (s.h - (R - k * ds[i])) ** 2, 0) / samples.length)
  const base = { frameId: view.registration.frameId, side: view.side, alongAxis, samples: samples.length, coverage: round6(coverage) }
  if (median <= LOW_MAX_M && q90 <= LOW_MAX_M + 0.3) {
    return { ...base, profile: 'LOW', riseM: round6(median), residualM: round6(levelResidual), why: `on the ${side} view the body's top stops ${median.toFixed(2)} m above its wall head across ${samples.length} columns${anchored}: a slab or a parapet` }
  }
  // The eaves of a gable end come down to the wall head: the tent reaches near zero at the body's ends.
  const eaveEnd = R - k * (span / 2)
  if (k >= MIN_PEAK_SLOPE && tentResidual <= 0.15 + 0.08 * R && tentResidual < 0.6 * levelResidual && Math.abs(eaveEnd) <= Math.max(0.45, 0.25 * R)) {
    return { ...base, profile: 'PEAKED', riseM: round6(R), slope: round6(k), residualM: round6(tentResidual), why: `on the ${side} view the body's top rises from its wall head to an apex ${R.toFixed(2)} m above it over the middle, ${((Math.atan(k) * 180) / Math.PI).toFixed(1)}° each side (residual ${tentResidual.toFixed(2)} m over ${samples.length} columns${anchored}): a gable end facing this view` }
  }
  if (levelResidual <= Math.max(0.12, 0.08 * median)) {
    return { ...base, profile: 'LEVEL', riseM: round6(median), residualM: round6(levelResidual), why: `on the ${side} view the body's top stands a level ${median.toFixed(2)} m above its wall head across ${samples.length} columns (residual ${levelResidual.toFixed(2)} m${anchored}): a ridge seen side on, or a wall standing higher than the plans say` }
  }
  return { ...base, profile: 'IRREGULAR', riseM: round6(median), residualM: round6(Math.min(levelResidual, tentResidual)), why: `on the ${side} view the body's top is neither level nor a gable (median ${median.toFixed(2)} m above the wall head, residual ${Math.min(levelResidual, tentResidual).toFixed(2)} m): not read` }
}

/**
 * v3.53.4 — the top over a body on a view that looks down the main ridge and does not show the main roof's gable where
 * the registration puts it. Such a view measures nothing in metres against the main roof; but it can still say, in its
 * own rows, that the top over this body and the top over the main body are one level line. That is a ridge running
 * along the view — across the main ridge — at the height of whatever tops the main body: a roof crossing the main one.
 * The columns are walked down from the top of the picture to the first rows that are not sky or trees; nothing is
 * taken from the vertical registration but the scale that turns the tolerance into rows.
 */
function readTopWithMain(input: Omit<AttachedRoofFormInput, 'views'>, view: ElevationFrameV2, raster: Raster, sky: Mask, mainOffsetM: number): BodyTopReading | undefined {
  const main = input.mainRoof
  if (!main) return undefined
  const alongAxis: 'X' | 'Z' = view.side === 'FRONT' || view.side === 'REAR' ? 'X' : 'Z'
  const [a0, a1] = alongAxis === 'X' ? [input.body.x0, input.body.x1] : [input.body.z0, input.body.z1]
  const [m0, m1] = alongAxis === 'X' ? [main.footprint.x0, main.footprint.x1] : [main.footprint.z0, main.footprint.z1]
  const behind = elevationBackground(raster, sky)
  const background = (x: number, y: number): boolean => {
    const i = y * raster.width + x
    if (behind.data[i] === 1) return true
    const o = i * 4
    return isGreen(raster.data[o], raster.data[o + 1], raster.data[o + 2])
  }
  const rowM = Math.abs(view.yOf(0) - view.yOf(1))
  if (!(rowM > 0)) return undefined
  const N = 41
  // as `readBodyTop` walks: up each column from inside the wall to the first run of sky or trees
  const start = Math.round(view.pyOf(input.wallTopY - 0.3))
  if (start <= 0 || start >= raster.height) return undefined
  const tops = (from: number, to: number): number[] => {
    const out: number[] = []
    const margin = Math.max(0.15, (to - from) * 0.04)
    for (let k = 0; k < N; k += 1) {
      const px = Math.round(view.pxOf(from + margin + ((to - from - 2 * margin) * k) / (N - 1)))
      if (px < 0 || px >= raster.width || background(px, start)) continue
      let run = 0
      for (let y = start - 1; y >= 0; y -= 1) {
        if (background(px, y)) {
          run += 1
          if (run >= BACKGROUND_RUN) {
            out.push(y + BACKGROUND_RUN)
            break
          }
        } else run = 0
      }
    }
    return out
  }
  const median = (xs: number[]): number => [...xs].sort((p, q) => p - q)[Math.floor(xs.length / 2)]
  const body = tops(a0, a1)
  const over = tops(m0, m1)
  const side = view.side.toLowerCase()
  if (body.length < MIN_SAMPLES || body.length / N < MIN_COVERAGE || over.length < MIN_SAMPLES || over.length / N < MIN_COVERAGE) return undefined
  const [bm, om] = [median(body), median(over)]
  const tol = Math.max(2, SAME_TOP_LINE_M / rowM)
  // level, each: three columns in four on its own line (a chimney or a tree's crown crosses the rest; a gable seen
  // end on keeps one column in ten within the tolerance of any one row)
  const onLine = (xs: number[], m: number): number => xs.filter((y) => Math.abs(y - m) <= tol).length / xs.length
  input.debug?.(`top with the main body on the ${side} view (${view.registration.frameId}): over the body row ${bm} (${Math.round(onLine(body, bm) * 100)}% of ${body.length} columns on it), over the main body row ${om} (${Math.round(onLine(over, om) * 100)}% of ${over.length}), ${rowM.toFixed(4)} m a row`)
  if (onLine(body, bm) < SAME_TOP_LINE_SHARE || onLine(over, om) < SAME_TOP_LINE_SHARE || Math.abs(bm - om) > tol) return undefined
  const residualM = round6(Math.sqrt(body.reduce((acc, y) => acc + ((Math.min(Math.abs(y - bm), tol)) * rowM) ** 2, 0) / body.length))
  return {
    frameId: view.registration.frameId,
    side: view.side,
    alongAxis,
    profile: 'LEVEL',
    samples: body.length,
    coverage: round6(body.length / N),
    riseM: round6(main.ridgeY - input.wallTopY),
    residualM,
    atMainTop: true,
    why: `the ${side} view looks down the main ridge and does not show the main roof's gable where it would stand (its line is ${Math.abs(mainOffsetM).toFixed(2)} m off); over the main body and over this one it shows one level top line (rows ${om} and ${bm}, ${body.length} columns): a ridge along the view, across the main one, at the height of what tops the main body`,
  }
}

/** A body further than this outside the main roof's width, or this far from an end of its ridge, is not under it (m). */
export const UNDER_MAIN_REACH_M = 0.3

/** Whether a body with a level top along `ridgeAxis` stands where the main roof can run on over it, and the roof's reach. */
export function underMainRoof(input: AttachedRoofFormInput, ridgeAxis: 'X' | 'Z', riseM: number, tolerance: number): { footprint: PlanBox; why: string } | undefined {
  const main = input.mainRoof
  if (!main || main.ridgeAxis !== ridgeAxis) return undefined
  if (Math.abs(input.wallTopY + riseM - main.ridgeY) > tolerance) return undefined
  const f = main.footprint
  const b = input.body
  const R = UNDER_MAIN_REACH_M
  const [a0, a1, ba0, ba1] = ridgeAxis === 'Z' ? [f.x0, f.x1, b.x0, b.x1] : [f.z0, f.z1, b.z0, b.z1]
  if (ba0 < a0 - R || ba1 > a1 + R) return undefined
  const [r0, r1, br0, br1] = ridgeAxis === 'Z' ? [f.z0, f.z1, b.z0, b.z1] : [f.x0, f.x1, b.x0, b.x1]
  const before = Math.abs(br1 - r0) <= R && br0 < r0
  const after = Math.abs(br0 - r1) <= R && br1 > r1
  if (!before && !after) return undefined
  const lo = before ? Math.min(r0, br0) : r0
  const hi = after ? Math.max(r1, br1) : r1
  const footprint = ridgeAxis === 'Z' ? { x0: f.x0, x1: f.x1, z0: lo, z1: hi } : { x0: lo, x1: hi, z0: f.z0, z1: f.z1 }
  return { footprint, why: `the body stands within the main roof's width (${a0.toFixed(2)}..${a1.toFixed(2)} across its ridge) against the ${before ? 'low' : 'high'} end of its ridge` }
}

/** Decide the form of the roof over one attached body from every view that sees it against the sky. */
export function readAttachedRoofForm(input: AttachedRoofFormInput): AttachedRoofForm {
  const readings = input.views.map(({ view, raster }) => readBodyTop(input, view, raster)).filter((r): r is BodyTopReading => !!r)
  if (readings.length === 0) return { kind: 'UNREAD', readings, why: 'no registered view sees this body against the sky' }
  const low = readings.filter((r) => r.profile === 'LOW')
  const pitched = readings.filter((r) => r.profile === 'LEVEL' || r.profile === 'PEAKED')
  if (pitched.length === 0) {
    if (low.length > 0 && low.length === readings.length) return { kind: 'FLAT', readings, why: `every view that sees the body against the sky shows its top at the wall head (${low.map((r) => r.side.toLowerCase()).join(', ')})` }
    return { kind: 'UNREAD', readings, why: 'the views that see the body show neither a flat top nor a pitched one' }
  }
  if (low.length > 0) return { kind: 'UNREAD', readings, why: `the ${low.map((r) => r.side.toLowerCase()).join(', ')} view${low.length === 1 ? '' : 's'} show a flat top and the ${pitched.map((r) => r.side.toLowerCase()).join(', ')} a pitched one: the conflict is left open` }
  // A level top runs along the ridge; a peaked one looks down it.
  const axisOf = (r: BodyTopReading): 'X' | 'Z' => (r.profile === 'LEVEL' ? r.alongAxis : r.alongAxis === 'X' ? 'Z' : 'X')
  const axes = [...new Set(pitched.map(axisOf))]
  if (axes.length > 1) return { kind: 'UNREAD', readings, why: 'the views read two ridge directions over the body: left open' }
  const ridgeAxis = axes[0]
  const crossing = pitched.filter((r) => r.atMainTop)
  const crossMainTop: CrossMainTop | undefined = crossing.length > 0 ? { ridgeAxis, frameIds: crossing.map((r) => r.frameId), why: crossing.map((r) => r.why).join('; ') } : undefined
  const halfSpan = (ridgeAxis === 'Z' ? input.body.x1 - input.body.x0 : input.body.z1 - input.body.z0) / 2
  const rises = pitched.map((r) => r.riseM).sort((p, q) => p - q)
  const measuredRiseM = rises[Math.floor(rises.length / 2)]
  const peaked = pitched.filter((r) => r.profile === 'PEAKED')
  const views = pitched.map((r) => r.side.toLowerCase()).join(', ')
  if (input.statedPitchDeg !== undefined) {
    const expectedRiseM = input.eaveBuildUpM + halfSpan * Math.tan((input.statedPitchDeg * Math.PI) / 180)
    const tolerance = Math.max(0.35, 0.2 * expectedRiseM)
    if (Math.abs(measuredRiseM - expectedRiseM) <= tolerance) {
      return { kind: 'GABLE', ...(crossMainTop ? { crossMainTop } : {}), ridgeAxis, pitchDeg: input.statedPitchDeg, pitchSource: 'STATED', measuredRiseM: round6(measuredRiseM), expectedRiseM: round6(expectedRiseM), readings, confidence: round6(Math.min(0.85, 0.55 + 0.1 * pitched.length + (peaked.length > 0 ? 0.1 : 0))), why: `the ${views} view${pitched.length === 1 ? '' : 's'} show the body's top ${measuredRiseM.toFixed(2)} m above its wall head, which a gable at the stated ${input.statedPitchDeg}° over its ${(2 * halfSpan).toFixed(2)} m span puts at ${expectedRiseM.toFixed(2)} m (within ${tolerance.toFixed(2)} m): a gable with its ridge along ${ridgeAxis}` }
    }
    // N8-01: a level top at the main ridge over a body that reaches the main top storey is a gable of its own reaching
    // that ridge, its eaves where the stated pitch from the ridge meets its walls — derived as the main roof's are —
    // when they fall on the walls of that storey, above its floor and no higher than their head
    if (peaked.length === 0 && input.mainRoof && input.topStoreyFloorY !== undefined) {
      const readY = input.wallTopY + measuredRiseM
      const atRidge = Math.abs(readY - input.mainRoof.ridgeY) <= tolerance
      // the views say the top is the main ridge; the ridge's height is the one the source prints, not the pixels'
      const topY = input.mainRoof.ridgeY
      // the eaves' top surface, as the main roof's eaveY: the ridge less the stated pitch over the half span
      const eaveY = topY - halfSpan * Math.tan((input.statedPitchDeg * Math.PI) / 180)
      if (atRidge && eaveY >= input.topStoreyFloorY + ATTIC_EAVE_MIN_M && eaveY <= input.wallTopY + input.eaveBuildUpM + 0.05) {
        return {
          kind: 'GABLE',
          ...(crossMainTop ? { crossMainTop } : {}),
          ridgeAxis,
          pitchDeg: input.statedPitchDeg,
          pitchSource: 'STATED',
          measuredRiseM: round6(measuredRiseM),
          expectedRiseM: round6(expectedRiseM),
          readings,
          confidence: round6(Math.min(0.75, 0.45 + 0.1 * pitched.length)),
          why: `the ${views} view${pitched.length === 1 ? '' : 's'} show the body's top level at ${readY.toFixed(2)} m, the main ridge (${input.mainRoof.ridgeY.toFixed(2)} m, within ${tolerance.toFixed(2)} m): a gable of its own along ${ridgeAxis} reaching that ridge, at the stated ${input.statedPitchDeg}° over its ${(2 * halfSpan).toFixed(2)} m span, its eaves derived at ${eaveY.toFixed(2)} m — ${(eaveY - input.topStoreyFloorY).toFixed(2)} m above its top storey's floor, on knee walls, as the main roof's`,
          eaveY: round6(eaveY),
        }
      }
    }
    // EXTERIOR-COMPLETE (Bakopy): a level top at the main ridge, running along the main ridge, over a body standing
    // within the main roof's width at an end of its ridge, is the main roof running on over the body — one roof over
    // the body and whatever stands open beside it under that width (a covered approach), not a roof of the body's own
    const under = peaked.length === 0 ? underMainRoof(input, ridgeAxis, measuredRiseM, tolerance) : undefined
    if (under) return { kind: 'UNDER_MAIN', footprint: under.footprint, measuredRiseM: round6(measuredRiseM), readings, why: `the ${views} view${pitched.length === 1 ? '' : 's'} show the body's top level at ${(input.wallTopY + measuredRiseM).toFixed(2)} m, the main ridge (${input.mainRoof?.ridgeY.toFixed(2)} m, within ${tolerance.toFixed(2)} m), running along it, and ${under.why}: the main roof runs on over the body` }
    if (peaked.length === 0) return { kind: 'UNREAD', ...(crossMainTop ? { crossMainTop } : {}), readings, why: `the ${views} view${pitched.length === 1 ? '' : 's'} show the body's top a level ${measuredRiseM.toFixed(2)} m above its wall head, which a gable at the stated ${input.statedPitchDeg}° would put at ${expectedRiseM.toFixed(2)} m: neither a flat roof nor that gable, left open` }
  }
  if (peaked.length > 0) {
    const slopes = peaked.map((r) => r.slope ?? 0).sort((p, q) => p - q)
    const pitchDeg = Math.round(((Math.atan(slopes[Math.floor(slopes.length / 2)]) * 180) / Math.PI) * 2) / 2
    if (pitchDeg >= 15 && pitchDeg <= 60) {
      const expectedRiseM = input.eaveBuildUpM + halfSpan * Math.tan((pitchDeg * Math.PI) / 180)
      return { kind: 'GABLE', ...(crossMainTop ? { crossMainTop } : {}), ridgeAxis, pitchDeg, pitchSource: 'MEASURED', measuredRiseM: round6(measuredRiseM), expectedRiseM: round6(expectedRiseM), readings, confidence: round6(Math.min(0.75, 0.5 + 0.1 * peaked.length)), why: `the ${peaked.map((r) => r.side.toLowerCase()).join(', ')} view${peaked.length === 1 ? '' : 's'} show a gable end over the body, ${pitchDeg}° each side, its apex ${measuredRiseM.toFixed(2)} m above the wall head: a gable with its ridge along ${ridgeAxis}, pitched as drawn` }
    }
  }
  return { kind: 'UNREAD', ...(crossMainTop ? { crossMainTop } : {}), readings, why: `the top over the body stands ${measuredRiseM.toFixed(2)} m above its wall head without a pitch that explains it: left open` }
}

// ---------------------------------------------------------------------------
// The planes of a gabled attached roof, and where they meet the main roof
// ---------------------------------------------------------------------------

export type Vec2 = { x: number; z: number }

export type MainRoofForJoin = { ridgeAxis: 'X' | 'Z'; ridgeAt: number; eaveY: number; ridgeY: number; pitchDeg: number; footprint: PlanBox }

export type AttachedGablePlane = { key: 'LOW' | 'HIGH'; boundary: Vec2[]; downslope: Vec2; datum: { x: number; y: number; z: number } }

export type AttachedGableLayout = {
  ridgeAt: number
  ridgeY: number
  planes: [AttachedGablePlane, AttachedGablePlane]
  /** The ridge, in plan, from the free gable end to where it stops. */
  ridge: [Vec2, Vec2]
  /** Each plane's eave, in plan: free, or an ABUTMENT where it runs along the main body's wall. */
  eaves: Array<{ key: 'LOW' | 'HIGH'; kind: 'EAVE' | 'ABUTMENT'; start: Vec2; end: Vec2 }>
  verges: Array<{ key: 'LOW' | 'HIGH'; start: Vec2; end: Vec2 }>
  /**
   * How the ridge ends at the body's party side: running on into the main
   * roof's slope and dying into it along two valleys, or stopping at the
   * party line against the main body.
   */
  join: { kind: 'VALLEY'; partySide: 'MIN' | 'MAX'; valleys: Array<{ key: 'LOW' | 'HIGH'; start: Vec2; end: Vec2 }>; why: string } | { kind: 'ABUTMENT'; partySide: 'MIN' | 'MAX'; why: string } | { kind: 'FREE'; why: string }
}

/**
 * The two planes of a gable over `body`, ridge along `ridgeAxis`, top surface
 * at `eaveY` along the eaves. When the body stands against the main body at
 * one end of its ridge and the main roof's slope rises away from that party
 * line, the planes run on over the main slope to the line where the two top
 * surfaces meet — two valleys and a ridge that dies into the slope, the way
 * an intersecting gable is built — and stop there, so neither surface shows
 * through the other. Otherwise they stop at the party line.
 */
export function attachedGableLayout(body: PlanBox, ridgeAxis: 'X' | 'Z', pitchDeg: number, eaveY: number, main?: MainRoofForJoin, options: { anyEaves?: boolean } = {}): AttachedGableLayout {
  // v3.53 (`anyEaves`): the two surfaces are joined along their line of intersection whatever the two eaves' heights —
  // eaves above the main ones start their valleys up the main slope, eaves below them abut the main wall up to the main
  // eave and run over the slope from there — as long as this ridge stays under the main one. Off (the drawings' path),
  // the join is made only for eaves level with the main ones, or lower eaves under a ridge at the main ridge's height.
  const anyEaves = options.anyEaves === true
  const tan = Math.tan((pitchDeg * Math.PI) / 180)
  // Local frame: `u` across the ridge, `t` along it.
  const [u0, u1] = ridgeAxis === 'Z' ? [body.x0, body.x1] : [body.z0, body.z1]
  const [t0, t1] = ridgeAxis === 'Z' ? [body.z0, body.z1] : [body.x0, body.x1]
  const uR = round6((u0 + u1) / 2)
  const ridgeY = round6(eaveY + (uR - u0) * tan)
  const P = (u: number, t: number): Vec2 => (ridgeAxis === 'Z' ? { x: round6(u), z: round6(t) } : { x: round6(t), z: round6(u) })
  const D = (du: number): Vec2 => (ridgeAxis === 'Z' ? { x: du, z: 0 } : { x: 0, z: du })
  const W = (u: number, y: number, t: number) => (ridgeAxis === 'Z' ? { x: round6(u), y: round6(y), z: round6(t) } : { x: round6(t), y: round6(y), z: round6(u) })
  // Which end of the ridge stands against the main body, if either.
  let join: AttachedGableLayout['join'] = { kind: 'FREE', why: 'the body stands clear of the main roof at both ends of its ridge' }
  let tLow = t0
  let tHigh = t1
  let valleyLow: [Vec2, Vec2] | undefined
  let valleyHigh: [Vec2, Vec2] | undefined
  /** N8-01: how far in from each eave the valleys start when this roof's eaves are below the main roof's (0 otherwise). */
  let lowerEaveRun = 0
  if (main) {
    const f = main.footprint
    const [mt0, mt1] = ridgeAxis === 'Z' ? [f.z0, f.z1] : [f.x0, f.x1]
    const [mu0, mu1] = ridgeAxis === 'Z' ? [f.x0, f.x1] : [f.z0, f.z1]
    const partySide: 'MIN' | 'MAX' | undefined = Math.abs(t1 - mt0) <= 0.05 ? 'MAX' : Math.abs(t0 - mt1) <= 0.05 ? 'MIN' : undefined
    if (partySide) {
      const within = u0 >= mu0 - 0.05 && u1 <= mu1 + 0.05
      const crosswise = main.ridgeAxis !== ridgeAxis
      const mainTan = Math.tan((main.pitchDeg * Math.PI) / 180)
      const partyAt = partySide === 'MAX' ? t1 : t0
      const s = partySide === 'MAX' ? 1 : -1
      const toRidge = Math.abs(main.ridgeAt - partyAt)
      if (within && crosswise && mainTan > 1e-6 && ridgeY < main.ridgeY - 0.05 && (anyEaves ? eaveY >= main.eaveY - 0.25 : Math.abs(eaveY - main.eaveY) <= 0.25)) {
        const meet = (y: number): number => partyAt + s * Math.max(0, (y - main.eaveY) / mainTan)
        const tR = meet(ridgeY)
        const tE = meet(eaveY)
        if (Math.abs(tR - partyAt) < toRidge) {
          if (partySide === 'MAX') tHigh = tE
          else tLow = tE
          valleyLow = [P(u0, tE), P(uR, tR)]
          valleyHigh = [P(u1, tE), P(uR, tR)]
          join = { kind: 'VALLEY', partySide, valleys: [{ key: 'LOW', start: valleyLow[0], end: valleyLow[1] }, { key: 'HIGH', start: valleyHigh[0], end: valleyHigh[1] }], why: `the ridge runs into the main roof's slope, which rises from the party line at ${main.pitchDeg}°; the two top surfaces meet ${Math.abs(tR - partyAt).toFixed(2)} m up it, and the planes stop on that line: two valleys` }
        }
      }
      // N8-01: a wing whose ridge reaches the main ridge and whose eaves stand lower than the main eaves (a wider span at
      // the same pitch). Its planes run on over the main slope until the two surfaces meet: from where each plane has
      // risen to the main eave's height at the party line, up to the point where the two ridges meet. Below that height
      // the plane meets the main body's wall at the party line (an abutment, under the main eave).
      const lowerEave = main.eaveY - eaveY
      const run = lowerEave / tan
      if (join.kind === 'FREE' && within && crosswise && mainTan > 1e-6 && (anyEaves ? ridgeY < main.ridgeY + 0.05 && ridgeY > main.eaveY + 0.1 : Math.abs(ridgeY - main.ridgeY) <= 0.05) && lowerEave > 0.25 && run < uR - u0 - 0.05) {
        const tR = partyAt + s * (anyEaves ? Math.min(toRidge, Math.max(0, (ridgeY - main.eaveY) / mainTan)) : toRidge)
        if (partySide === 'MAX') tHigh = partyAt
        else tLow = partyAt
        lowerEaveRun = run
        valleyLow = [P(u0 + run, partyAt), P(uR, tR)]
        valleyHigh = [P(u1 - run, partyAt), P(uR, tR)]
        join = { kind: 'VALLEY', partySide, valleys: [{ key: 'LOW', start: valleyLow[0], end: valleyLow[1] }, { key: 'HIGH', start: valleyHigh[0], end: valleyHigh[1] }], why: `the ridge runs into the main roof at the main ridge's height, its eaves ${lowerEave.toFixed(2)} m below the main eaves: the planes run over the main slope from where they rise to the main eave's height at the party line, ${run.toFixed(2)} m in from each eave, to where the two ridges meet, ${toRidge.toFixed(2)} m up it: two valleys; below that height each plane meets the main body's wall` }
      }
      if (join.kind === 'FREE') join = { kind: 'ABUTMENT', partySide, why: within && crosswise ? 'the ridge reaches the main roof above its eave or beyond its own height: the planes stop at the party line' : 'the ridge ends against the main body, whose roof does not slope away from the party line: the planes stop at the party line' }
    }
  }
  const partyMax = join.kind !== 'FREE' && join.partySide === 'MAX'
  const partyMin = join.kind !== 'FREE' && join.partySide === 'MIN'
  // The ridge ends where the valleys meet, else at the body's end.
  const ridgeEnd = valleyLow?.[1]
  const tRidgeLow = partyMin && ridgeEnd ? (ridgeAxis === 'Z' ? ridgeEnd.z : ridgeEnd.x) : t0
  const tRidgeHigh = partyMax && ridgeEnd ? (ridgeAxis === 'Z' ? ridgeEnd.z : ridgeEnd.x) : t1
  // N8-01: with the eaves below the main ones the party side of each plane steps: along the party line from the eave to
  // where the valley starts, then up the valley
  const stepLow = lowerEaveRun > 0 ? (partyMin ? [P(u0 + lowerEaveRun, tLow)] : [P(u0 + lowerEaveRun, tHigh)]) : []
  const stepHigh = lowerEaveRun > 0 ? (partyMin ? [P(u1 - lowerEaveRun, tLow)] : [P(u1 - lowerEaveRun, tHigh)]) : []
  const planeLow: AttachedGablePlane = {
    key: 'LOW',
    boundary: partyMin ? [P(u0, tLow), ...stepLow, P(uR, tRidgeLow), P(uR, tRidgeHigh), P(u0, tHigh)] : [P(u0, tLow), P(uR, tRidgeLow), P(uR, tRidgeHigh), ...stepLow, P(u0, tHigh)],
    downslope: D(-1),
    datum: W(u0, eaveY, t0),
  }
  const planeHigh: AttachedGablePlane = {
    key: 'HIGH',
    boundary: partyMin ? [P(uR, tRidgeLow), ...stepHigh, P(u1, tLow), P(u1, tHigh), P(uR, tRidgeHigh)] : [P(uR, tRidgeLow), P(u1, tLow), P(u1, tHigh), ...stepHigh, P(uR, tRidgeHigh)],
    downslope: D(1),
    datum: W(u1, eaveY, t0),
  }
  // An eave that runs along the main body's wall is not free: the plane meets the wall rising past it.
  const alongMain = (u: number): boolean => {
    if (!main) return false
    const f = main.footprint
    const [mu0, mu1] = ridgeAxis === 'Z' ? [f.x0, f.x1] : [f.z0, f.z1]
    const [mt0, mt1] = ridgeAxis === 'Z' ? [f.z0, f.z1] : [f.x0, f.x1]
    return (Math.abs(u - mu0) <= 0.05 || Math.abs(u - mu1) <= 0.05) && Math.min(t1, mt1) - Math.max(t0, mt0) > 0.5
  }
  const eaves: AttachedGableLayout['eaves'] = [
    { key: 'LOW', kind: alongMain(u0) ? 'ABUTMENT' : 'EAVE', start: P(u0, tLow), end: P(u0, tHigh) },
    { key: 'HIGH', kind: alongMain(u1) ? 'ABUTMENT' : 'EAVE', start: P(u1, tLow), end: P(u1, tHigh) },
  ]
  // N8-01: where the eaves are below the main ones, each plane meets the main body's wall along the party line
  if (lowerEaveRun > 0) {
    const tParty = partyMin ? tLow : tHigh
    eaves.push({ key: 'LOW', kind: 'ABUTMENT', start: P(u0, tParty), end: P(u0 + lowerEaveRun, tParty) }, { key: 'HIGH', kind: 'ABUTMENT', start: P(u1 - lowerEaveRun, tParty), end: P(u1, tParty) })
  }
  // A verge at every end of the ridge that is not a party end.
  const verges: AttachedGableLayout['verges'] = []
  if (!partyMin) verges.push({ key: 'LOW', start: P(u0, t0), end: P(uR, t0) }, { key: 'HIGH', start: P(uR, t0), end: P(u1, t0) })
  if (!partyMax) verges.push({ key: 'LOW', start: P(uR, t1), end: P(u0, t1) }, { key: 'HIGH', start: P(u1, t1), end: P(uR, t1) })
  return { ridgeAt: uR, ridgeY, planes: [planeLow, planeHigh], ridge: [P(uR, tRidgeLow), P(uR, tRidgeHigh)], eaves, verges, join }
}
