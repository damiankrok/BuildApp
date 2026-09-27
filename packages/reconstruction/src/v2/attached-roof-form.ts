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
  why: string
}

export type AttachedRoofForm =
  | { kind: 'GABLE'; ridgeAxis: 'X' | 'Z'; pitchDeg: number; pitchSource: 'STATED' | 'MEASURED'; measuredRiseM: number; expectedRiseM: number; readings: BodyTopReading[]; confidence: number; why: string }
  | { kind: 'FLAT'; readings: BodyTopReading[]; why: string }
  | { kind: 'UNREAD'; readings: BodyTopReading[]; why: string }

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
  debug?: (line: string) => void
}

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
    const found = topOffset(view, raster, mainTopProfile(input.mainRoof, alongAxis), sky)
    if (found) {
      // A view that disagrees with the main roof by more than a storey's slab is not registered well enough to read.
      if (Math.abs(found.offsetM) > 1.0) return undefined
      offset = found.offsetM
      anchored = `, heights re-anchored by ${(-offset).toFixed(2)} m on the main roof's top over ${found.samples} columns`
    }
  }
  const yAt = (row: number): number => view.yOf(row) - offset
  const background = (x: number, y: number): boolean => {
    const i = y * raster.width + x
    if (sky.data[i] === 1) return true
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
  const halfSpan = (ridgeAxis === 'Z' ? input.body.x1 - input.body.x0 : input.body.z1 - input.body.z0) / 2
  const rises = pitched.map((r) => r.riseM).sort((p, q) => p - q)
  const measuredRiseM = rises[Math.floor(rises.length / 2)]
  const peaked = pitched.filter((r) => r.profile === 'PEAKED')
  const views = pitched.map((r) => r.side.toLowerCase()).join(', ')
  if (input.statedPitchDeg !== undefined) {
    const expectedRiseM = input.eaveBuildUpM + halfSpan * Math.tan((input.statedPitchDeg * Math.PI) / 180)
    const tolerance = Math.max(0.35, 0.2 * expectedRiseM)
    if (Math.abs(measuredRiseM - expectedRiseM) <= tolerance) {
      return { kind: 'GABLE', ridgeAxis, pitchDeg: input.statedPitchDeg, pitchSource: 'STATED', measuredRiseM: round6(measuredRiseM), expectedRiseM: round6(expectedRiseM), readings, confidence: round6(Math.min(0.85, 0.55 + 0.1 * pitched.length + (peaked.length > 0 ? 0.1 : 0))), why: `the ${views} view${pitched.length === 1 ? '' : 's'} show the body's top ${measuredRiseM.toFixed(2)} m above its wall head, which a gable at the stated ${input.statedPitchDeg}° over its ${(2 * halfSpan).toFixed(2)} m span puts at ${expectedRiseM.toFixed(2)} m (within ${tolerance.toFixed(2)} m): a gable with its ridge along ${ridgeAxis}` }
    }
    if (peaked.length === 0) return { kind: 'UNREAD', readings, why: `the ${views} view${pitched.length === 1 ? '' : 's'} show the body's top a level ${measuredRiseM.toFixed(2)} m above its wall head, which a gable at the stated ${input.statedPitchDeg}° would put at ${expectedRiseM.toFixed(2)} m: neither a flat roof nor that gable, left open` }
  }
  if (peaked.length > 0) {
    const slopes = peaked.map((r) => r.slope ?? 0).sort((p, q) => p - q)
    const pitchDeg = Math.round(((Math.atan(slopes[Math.floor(slopes.length / 2)]) * 180) / Math.PI) * 2) / 2
    if (pitchDeg >= 15 && pitchDeg <= 60) {
      const expectedRiseM = input.eaveBuildUpM + halfSpan * Math.tan((pitchDeg * Math.PI) / 180)
      return { kind: 'GABLE', ridgeAxis, pitchDeg, pitchSource: 'MEASURED', measuredRiseM: round6(measuredRiseM), expectedRiseM: round6(expectedRiseM), readings, confidence: round6(Math.min(0.75, 0.5 + 0.1 * peaked.length)), why: `the ${peaked.map((r) => r.side.toLowerCase()).join(', ')} view${peaked.length === 1 ? '' : 's'} show a gable end over the body, ${pitchDeg}° each side, its apex ${measuredRiseM.toFixed(2)} m above the wall head: a gable with its ridge along ${ridgeAxis}, pitched as drawn` }
    }
  }
  return { kind: 'UNREAD', readings, why: `the top over the body stands ${measuredRiseM.toFixed(2)} m above its wall head without a pitch that explains it: left open` }
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
export function attachedGableLayout(body: PlanBox, ridgeAxis: 'X' | 'Z', pitchDeg: number, eaveY: number, main?: MainRoofForJoin): AttachedGableLayout {
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
      if (within && crosswise && mainTan > 1e-6 && ridgeY < main.ridgeY - 0.05 && Math.abs(eaveY - main.eaveY) <= 0.25) {
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
      if (join.kind === 'FREE') join = { kind: 'ABUTMENT', partySide, why: within && crosswise ? 'the ridge reaches the main roof above its eave or beyond its own height: the planes stop at the party line' : 'the ridge ends against the main body, whose roof does not slope away from the party line: the planes stop at the party line' }
    }
  }
  const partyMax = join.kind !== 'FREE' && join.partySide === 'MAX'
  const partyMin = join.kind !== 'FREE' && join.partySide === 'MIN'
  // The ridge ends where the valleys meet, else at the body's end.
  const ridgeEnd = valleyLow?.[1]
  const tRidgeLow = partyMin && ridgeEnd ? (ridgeAxis === 'Z' ? ridgeEnd.z : ridgeEnd.x) : t0
  const tRidgeHigh = partyMax && ridgeEnd ? (ridgeAxis === 'Z' ? ridgeEnd.z : ridgeEnd.x) : t1
  const planeLow: AttachedGablePlane = {
    key: 'LOW',
    boundary: [P(u0, tLow), P(uR, tRidgeLow), P(uR, tRidgeHigh), P(u0, tHigh)],
    downslope: D(-1),
    datum: W(u0, eaveY, t0),
  }
  const planeHigh: AttachedGablePlane = {
    key: 'HIGH',
    boundary: [P(uR, tRidgeLow), P(u1, tLow), P(u1, tHigh), P(uR, tRidgeHigh)],
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
  // A verge at every end of the ridge that is not a party end.
  const verges: AttachedGableLayout['verges'] = []
  if (!partyMin) verges.push({ key: 'LOW', start: P(u0, t0), end: P(uR, t0) }, { key: 'HIGH', start: P(uR, t0), end: P(u1, t0) })
  if (!partyMax) verges.push({ key: 'LOW', start: P(uR, t1), end: P(u0, t1) }, { key: 'HIGH', start: P(u1, t1), end: P(uR, t1) })
  return { ridgeAt: uR, ridgeY, planes: [planeLow, planeHigh], ridge: [P(uR, tRidgeLow), P(uR, tRidgeHigh)], eaves, verges, join }
}
