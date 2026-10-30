/**
 * N9-02A: every elevation registered on four separate, accountable axes — SIDE, ALONG, VERTICAL, SCALE — from source
 * evidence only, as a DIAGNOSTIC: nothing here feeds the solver, so no candidate, model or scene can change.
 *
 *   SIDE      which wall the view shows. The publisher's label; or ELIMINATION — the walls the other sheets are
 *             labelled with leave this one only one axis (FRONT/REAR or LEFT/RIGHT) or only one wall; or, where a
 *             vertical scale is known on its own, the drawn wall width against the plan's width and depth. Two
 *             unlabelled views on one axis keep the axis and say the hand is UNKNOWN: a mirrored view is worse than
 *             none.
 *   ALONG     pixel column → metres along the facade: the drawn wall band's two ends (read across several columns, so a
 *             door on the centre line does not hide it) on the walled span the plan's printed chains measure; or the
 *             solver's own registration where it made one. Direction comes from SIDE; without the hand only the span
 *             and scale are known (SPAN_ONLY). The band is refused where the view's outline is not the building (far
 *             shorter than the house on its sibling sheets) or where the opposite view's band disagrees.
 *   VERTICAL  pixel row → metres up: the printed ridge datum at the roof's apex — the plateau of the top outline over
 *             the walls (a front or rear view), or the intersection of its two slopes (a gable end) — never the top of
 *             a chimney (narrow spikes are left out), held against the drawn ground. No printed ridge: UNCHECKED, and
 *             ALONG still stands.
 *   SCALE     whether one scale serves both axes: VERIFIED_ISOTROPIC when the along scale puts the ground where the
 *             printed terrain datum says; ISOTROPY_PLAUSIBLE when no terrain is printed and the ground lands where a
 *             plinth can be; ALONG_ONLY / VERTICAL_ONLY when one axis alone is known; REFUSED when they disagree.
 *
 * Every anchor says where it comes from and whether it is shared with the model: the plan's walled span is the reading
 * the model is built from, so a width checked on a view registered by it is not an independent check of the model.
 * Labels, printed datums, the drawn apex and ground are. Nothing here reads the model's walls or openings to register.
 */
import { round6 } from '@buildapp/source-common'
import type { PixelRect } from '@buildapp/source-common'
import type { Raster } from '@buildapp/source-cv'
import type { SourceCoordinateFrame, SourceObservation } from '@buildapp/source-observations'
import { buildingExtent, skyMask } from '@buildapp/reconstruction'
import type { ElevationRegistrationV2, ViewAuditRecord, WorldFrameV2 } from '@buildapp/reconstruction'

export type Side = 'FRONT' | 'REAR' | 'LEFT' | 'RIGHT'
export type AxisState = 'REGISTERED' | 'SPAN_ONLY' | 'UNCHECKED' | 'REFUSED'
export type RegistrationClass = 'FULL' | 'ALONG_ONLY' | 'VERTICAL_ONLY' | 'UNREGISTERED'

export type Anchor = {
  kind: 'PUBLISHER_LABEL' | 'LABEL_ELIMINATION' | 'WALL_BAND_ENDS' | 'BUILT_BAND_ENDS' | 'PLAN_WALLED_SPAN' | 'SOLVER_REGISTRATION' | 'PRINTED_RIDGE_DATUM' | 'PRINTED_TERRAIN_DATUM' | 'DRAWN_APEX' | 'DRAWN_GROUND' | 'SIBLING_SHEETS'
  what: string
  /** Pixels on the sheet and/or metres, as the anchor states them. */
  px?: number | { x0: number; x1: number }
  m?: number
  /** False where the anchor is the same reading the model is built from (a width checked by it is not independent). */
  independentOfModel: boolean
}

export type Alternative = { id: string; value: string; measure: number | null; why: string }

export type ElevationAxes = {
  frameId: string
  assetId: string
  labelledView: string
  sizePx: { width: number; height: number }
  extent: PixelRect | null
  extentWhy: string
  side: { state: 'REGISTERED' | 'AXIS_ONLY' | 'UNKNOWN' | 'REFUSED'; value: Side | 'LEFT_OR_RIGHT' | 'FRONT_OR_REAR' | 'UNKNOWN'; basis: string; confidence: number; why: string; anchors: Anchor[]; alternatives: Alternative[] }
  along: { state: AxisState; mpp?: number; alongAtLeft?: number; alongSign?: 1 | -1; spanM?: number; bandPx?: { x0: number; x1: number; rows: number }; uncertaintyM?: number; why: string; anchors: Anchor[]; alternatives: Alternative[] }
  vertical: { state: AxisState; apexRow?: number; groundRow?: number; zeroRow?: number; groundY?: number; groundErrorM?: number; why: string; anchors: Anchor[]; alternatives: Alternative[] }
  scale: { state: 'VERIFIED_ISOTROPIC' | 'ISOTROPY_PLAUSIBLE' | 'ALONG_ONLY' | 'VERTICAL_ONLY' | 'REFUSED' | 'UNCHECKED'; mpp?: number; why: string }
  class: RegistrationClass
  /** What this view can now be checked for, by axis (slots, not checks: the comparison is R5/R6's). */
  checkable: { along: string[]; vertical: string[]; slots: number }
  /** The solver's own use of the view, for the before/after comparison. */
  solver: { use: string; side?: string; mpp?: number; openingHeights?: string }
  /** Where both registered it on the along axis: how far apart the two scales are (a consistency check, not evidence). */
  solverAgreement?: { mppRatio: number }
}

/** As the solver's wall-band registration: a band must hold this share of the silhouette's rows and span this share of its width. */
export const WALL_BAND_MIN_SHARE = 0.1
export const WALL_BAND_MIN_WIDTH = 0.4
/** The solver's own ground tolerance for a view hung from the ridge, against the printed terrain. */
export const GROUND_TOLERANCE_M = 0.3
/** Without a printed terrain the ground of a sound registration lies within a plinth below ±0.00 (the solver accepts 0.9). */
export const PLINTH_RANGE_M = { low: -0.9, high: 0.1 }
/** Opposite views of one wall pair, drawn on sheets of one size, must show one span to within this share. */
export const OPPOSITE_SPAN_AGREEMENT = 0.05
/** A traced outline less than this share of the house's height on its same-size sibling sheets is not the building. */
export const EXTENT_HEIGHT_MIN_SHARE = 0.6
/**
 * A band of built pixels (not sky, not vegetation) — walls of any finish, cladding, a garage door — is not taken on its
 * own: it may run on into a pergola or a fence. It is taken only where an independent scale of the same sheet set puts
 * the wall span at its width to within this share.
 */
export const SHEET_SCALE_AGREEMENT = 0.03
/** Spikes over the roof's outline narrower than this are chimneys, aerials or a tree top, never the ridge. */
export const NARROW_SPIKE_M = 1.5

const NEUTRAL_INK_CHROMA = 40

function rgb(r: Raster, x: number, y: number): [number, number, number] {
  const o = (Math.round(y) * r.width + Math.round(x)) * 4
  return [r.data[o], r.data[o + 1], r.data[o + 2]]
}

/**
 * The drawn wall bands across a silhouette, read on several columns. The solver reads one column, through the
 * silhouette's centre, and a door or a glazed bay on that column hides every band; five columns between 30 % and 70 %
 * of the width are read here, and runs whose ends agree within 3 px are one band.
 */
export function wallBands(r: Raster, extent: PixelRect, built?: (x: number, y: number) => boolean, sky?: { width: number; data: Uint8Array }): Array<{ x0: number; x1: number; rows: number; share: number; y0: number; y1: number; clipped: boolean }> {
  const h = extent.y1 - extent.y0
  const neutral = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= r.width || y >= r.height) return false
    if (built) return built(x, y)
    // the background is never wall: on a line drawing the white paper is as neutral as a white wall, and a band
    // that ran on through it would end at the next line drawn — the eaves — instead of at the walls
    if (sky && sky.data[y * sky.width + x] === 1) return false
    const [a, b, c] = rgb(r, x, y)
    return Math.max(a, b, c) - Math.min(a, b, c) < NEUTRAL_INK_CHROMA
  }
  const bands: Array<{ x0: number; x1: number; rows: Set<number>; clippedRows: number; y0: number; y1: number }> = []
  let n = 0
  for (let y = Math.round(extent.y0 + 0.15 * h); y <= Math.round(extent.y1 - 0.15 * h); y += 1) {
    n += 1
    for (const f of [0.3, 0.4, 0.5, 0.6, 0.7]) {
      const c = Math.round(extent.x0 + (extent.x1 - extent.x0) * f)
      if (!neutral(c, y)) continue
      let a = c
      while (a - 1 >= extent.x0 && neutral(a - 1, y)) a -= 1
      let b = c
      while (b + 1 <= extent.x1 && neutral(b + 1, y)) b += 1
      // a run stopped by the outline's edge while the same material goes on past it is cut by the outline, not by a wall end
      const cut = (a === extent.x0 && neutral(a - 1, y)) || (b === extent.x1 && neutral(b + 1, y))
      const band = bands.find((k) => Math.abs(k.x0 - a) <= 3 && Math.abs(k.x1 - b) <= 3)
      if (band) {
        if (!band.rows.has(y) && cut) band.clippedRows += 1
        band.rows.add(y)
        band.y0 = Math.min(band.y0, y)
        band.y1 = Math.max(band.y1, y)
      } else bands.push({ x0: a, x1: b, rows: new Set([y]), clippedRows: cut ? 1 : 0, y0: y, y1: y })
    }
  }
  return bands.map((k) => ({ x0: k.x0, x1: k.x1, rows: k.rows.size, share: n > 0 ? k.rows.size / n : 0, y0: k.y0, y1: k.y1, clipped: k.clippedRows * 2 > k.rows.size }))
}

/** The first row below the sky in each column, or undefined where the column never leaves the sky above `bottom`. */
function topProfile(mask: { width: number; data: Uint8Array }, x0: number, x1: number, bottom: number): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = []
  for (let x = Math.max(0, Math.round(x0)); x <= Math.min(mask.width - 1, Math.round(x1)); x += 1) {
    let y = 0
    while (y < bottom && mask.data[y * mask.width + x] === 1) y += 1
    if (y < bottom) out.push({ x, y })
  }
  return out
}

/** Theil–Sen line through points (median of pairwise slopes, then the median intercept). */
function theilSen(ps: ReadonlyArray<{ x: number; y: number }>): { a: number; b: number } | undefined {
  if (ps.length < 4) return undefined
  const step = Math.max(1, Math.floor(ps.length / 60))
  const s = ps.filter((_, i) => i % step === 0)
  const slopes: number[] = []
  for (let i = 0; i < s.length; i += 1) for (let j = i + 1; j < s.length; j += 1) if (s[j].x !== s[i].x) slopes.push((s[j].y - s[i].y) / (s[j].x - s[i].x))
  if (slopes.length === 0) return undefined
  slopes.sort((p, q) => p - q)
  const b = slopes[Math.floor(slopes.length / 2)]
  const icpt = s.map((p) => p.y - b * p.x).sort((p, q) => p - q)
  return { a: icpt[Math.floor(icpt.length / 2)], b }
}

/**
 * The roof's apex row over the walls, or why none can be stated. A front or rear view draws the ridge as a plateau of
 * the top outline across most of the walls; a gable end as two slopes meeting. Narrow spikes above either (chimneys,
 * aerials, a tree top) are left out by width, and when neither shape is found the apex is not guessed.
 */
export function apexOf(profile: ReadonlyArray<{ x: number; y: number }>, spikePx: number, tolPx: number): { row: number; method: 'RIDGE_PLATEAU' | 'GABLE_SLOPES'; excluded: number; why: string } | { row?: undefined; why: string } {
  if (profile.length < 10) return { why: 'too few columns of the roof outline stand against the sky' }
  const ys = profile.map((p) => p.y).sort((a, b) => a - b)
  const n = ys.length
  // plateau: the highest row band holding a third of the columns
  for (let i = 0; i < n; i += 1) {
    const t = ys[i]
    const within = ys.filter((y) => y >= t && y <= t + tolPx)
    if (within.length >= n / 3) {
      const above = profile.filter((p) => p.y < t)
      // what stands above the plateau must be narrow runs (chimneys), never a wide part of the roof
      let run = 0
      let widest = 0
      let last = -2
      for (const p of above) {
        run = p.x === last + 1 ? run + 1 : 1
        last = p.x
        widest = Math.max(widest, run)
      }
      if (widest > spikePx) break
      const row = within[Math.floor(within.length / 2)]
      return { row, method: 'RIDGE_PLATEAU', excluded: above.length, why: `the top outline is level over ${within.length} of ${n} columns at row ${row}${above.length > 0 ? `; ${above.length} columns above it stand in runs no wider than ${widest} px (chimneys or aerials), left out` : ''}` }
    }
    if (i > n / 3) break
  }
  // gable: two slopes, fitted robustly on either side of the highest third
  const high = profile.filter((p) => p.y <= ys[Math.floor(n * 0.1)])
  const xm = high.map((p) => p.x).sort((a, b) => a - b)[Math.floor(high.length / 2)]
  let left = profile.filter((p) => p.x < xm)
  let right = profile.filter((p) => p.x > xm)
  let fl = theilSen(left)
  let fr = theilSen(right)
  // two passes: drop what stands well above a slope (a chimney on it), refit
  for (let pass = 0; pass < 2 && fl && fr; pass += 1) {
    const l = fl
    const r = fr
    left = left.filter((p) => p.y >= l.a + l.b * p.x - tolPx)
    right = right.filter((p) => p.y >= r.a + r.b * p.x - tolPx)
    fl = theilSen(left)
    fr = theilSen(right)
  }
  if (!fl || !fr) return { why: 'the top outline is neither level nor two slopes' }
  // rows grow downwards: a left slope rising to the apex has a negative slope, a right one positive
  if (!(fl.b < -0.05 && fr.b > 0.05)) return { why: `the top outline is neither level over a third of the walls nor two slopes meeting (slopes ${round6(fl.b)} and ${round6(fr.b)} px/px)` }
  const x = (fr.a - fl.a) / (fl.b - fr.b)
  const row = fl.a + fl.b * x
  const x0 = profile[0].x
  const x1 = profile[profile.length - 1].x
  if (x < x0 || x > x1) return { why: `the two slopes meet at column ${round6(x)}, outside the walls (${x0}..${x1})` }
  const excluded = profile.length - left.length - right.length
  return { row: round6(row), method: 'GABLE_SLOPES', excluded, why: `two slopes (${round6(fl.b)} and ${round6(fr.b)} px/px) meet at column ${round6(x)}, row ${round6(row)}${excluded > 0 ? `; ${excluded} columns above them (a chimney on a slope, the apex cap) left out` : ''}` }
}

export type ElevationAxesInput = {
  frames: readonly SourceCoordinateFrame[]
  observations: readonly SourceObservation[]
  raster: (frame: { variantByteHash: string }) => Raster | undefined
  world: Pick<WorldFrameV2, 'walled' | 'envelope'>
  /** The highest datum the section prints (the ridge), and the terrain datum, when printed. */
  ridgeY?: number
  terrainY?: number
  viewAudit: readonly ViewAuditRecord[]
  /** The solver's silhouette registrations (REGISTERED views). */
  solverRegistrations: readonly ElevationRegistrationV2[]
  /** Openings per facade, to count the slots a registered axis makes checkable. */
  openingsByFacade: Readonly<Record<Side, number>>
}

const OPPOSITE: Record<Side, Side> = { FRONT: 'REAR', REAR: 'FRONT', LEFT: 'RIGHT', RIGHT: 'LEFT' }
const isSide = (v: string): v is Side => v === 'FRONT' || v === 'REAR' || v === 'LEFT' || v === 'RIGHT'
const axisOf = (s: Side): 'FRONT_REAR' | 'SIDES' => (s === 'FRONT' || s === 'REAR' ? 'FRONT_REAR' : 'SIDES')

export function elevationAxes(input: ElevationAxesInput): ElevationAxes[] {
  const frames = input.frames.filter((f) => f.roles.document === 'ELEVATION')
  const audit = new Map(input.viewAudit.map((v) => [v.frameId, v]))
  const labelled = new Map(frames.filter((f) => isSide(f.roles.view)).map((f) => [f.id, f.roles.view as Side]))
  const prepared = frames.map((frame) => {
    const raster = input.raster(frame)
    const ext = buildingExtent(frame, input.observations.filter((o) => o.frameId === frame.id), raster)
    return { frame, raster, ext }
  })
  // sibling sheets: elevations of one size are taken to be drawn at one scale only where their outlines say so
  const heightsBySize = new Map<string, number[]>()
  for (const p of prepared) if (p.ext) heightsBySize.set(`${p.frame.size.width}x${p.frame.size.height}`, [...(heightsBySize.get(`${p.frame.size.width}x${p.frame.size.height}`) ?? []), p.ext.rect.y1 - p.ext.rect.y0])
  const median = (v: number[]): number => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]

  const out: ElevationAxes[] = []
  type Ctx = { raster: Raster; rect: PixelRect; solverReg?: ElevationRegistrationV2; band?: { x0: number; x1: number; rows: number }; axis?: 'FRONT_REAR' | 'SIDES'; extentPlausible: boolean }
  const ctx = new Map<string, Ctx>()
  const w = input.world.walled
  const e = input.world.envelope
  const spanOf = (ax: 'FRONT_REAR' | 'SIDES'): { a0: number; a1: number; what: string } => (ax === 'FRONT_REAR' ? { a0: w.x0, a1: w.x1, what: 'walled width' } : { a0: w.z0, a1: w.z1, what: 'walled depth' })
  // the spans a drawn wall band may be: the walled one, or the characteristic one (the envelope over recess zones)
  const spansOf = (ax: 'FRONT_REAR' | 'SIDES'): Array<{ a0: number; a1: number; what: string }> => {
    const walled = spanOf(ax)
    const env = ax === 'FRONT_REAR' ? { a0: e.x0, a1: e.x1, what: 'characteristic width' } : { a0: e.z0, a1: e.z1, what: 'characteristic depth' }
    return Math.abs((env.a1 - env.a0) / (walled.a1 - walled.a0) - 1) > SHEET_SCALE_AGREEMENT ? [walled, env] : [walled]
  }
  for (const { frame, raster, ext } of prepared) {
    const a = audit.get(frame.id)
    const solver = { use: a?.use ?? 'NOT_AUDITED', ...(a?.side ? { side: a.side } : {}), ...(a?.mpp !== undefined ? { mpp: a.mpp } : {}), ...(a?.openingHeights ? { openingHeights: a.openingHeights } : {}) }
    const base = { frameId: frame.id, assetId: frame.assetId, labelledView: frame.roles.view, sizePx: { width: frame.size.width, height: frame.size.height }, extent: ext?.rect ?? null, extentWhy: ext?.why ?? 'no outline was traced or measured', solver }
    const refuseAll = (why: string): ElevationAxes => ({
      ...base,
      side: { state: 'UNKNOWN', value: 'UNKNOWN', basis: 'NONE', confidence: 0, why, anchors: [], alternatives: [] },
      along: { state: 'UNCHECKED', why, anchors: [], alternatives: [] },
      vertical: { state: 'UNCHECKED', why, anchors: [], alternatives: [] },
      scale: { state: 'UNCHECKED', why },
      class: 'UNREGISTERED',
      checkable: { along: [], vertical: [], slots: 0 },
    })
    if (frame.roles.projection !== 'ORTHOGRAPHIC_ELEVATION') {
      out.push(refuseAll(`a ${frame.roles.projection.toLowerCase().replace(/_/g, ' ')} is not an orthographic elevation: no axis is registered on it`))
      continue
    }
    if (a?.use === 'DUPLICATE') {
      out.push(refuseAll('a second copy of a drawing already registered'))
      continue
    }
    if (!raster || !ext) {
      out.push(refuseAll(!raster ? 'its pixels are not available to this run' : 'no outline of the building was traced or measured on it'))
      continue
    }
    const rect = ext.rect
    const solverReg = input.solverRegistrations.find((r) => r.frameId === frame.id)

    // --- SIDE --------------------------------------------------------------------------------------------------
    let side: ElevationAxes['side']
    const own = labelled.get(frame.id)
    if (a?.use === 'REGISTERED' || a?.use === 'OPENINGS_ONLY' || a?.use === 'POSITIONS_ONLY') {
      // the solver's side, with its own basis (a label, the first reading, or moved by the plan's openings)
      side = { state: 'REGISTERED', value: a.side as Side, basis: `SOLVER_${a.sideBasis ?? 'FIRST_READING'}`, confidence: a.sideConfidence ?? 0, why: `the solver read it as the ${String(a.side).toLowerCase()} view (${a.sideBasis ?? 'first reading'})`, anchors: own ? [{ kind: 'PUBLISHER_LABEL', what: `labelled ${own}`, independentOfModel: true }] : [], alternatives: [] }
    } else if (own) {
      side = { state: 'REGISTERED', value: own, basis: 'PUBLISHER_LABEL', confidence: 0.9, why: `the publisher labels it the ${own.toLowerCase()} elevation`, anchors: [{ kind: 'PUBLISHER_LABEL', what: `labelled ${own}`, independentOfModel: true }], alternatives: [] }
    } else {
      const others = [...labelled.entries()].filter(([id]) => id !== frame.id).map(([, s]) => s)
      const free = (['FRONT', 'REAR', 'LEFT', 'RIGHT'] as const).filter((s) => !others.includes(s))
      const unlabelledPeers = frames.filter((f) => f.id !== frame.id && !labelled.has(f.id) && f.roles.projection === 'ORTHOGRAPHIC_ELEVATION' && audit.get(f.id)?.use !== 'DUPLICATE').length
      const anchors: Anchor[] = [{ kind: 'LABEL_ELIMINATION', what: `the other sheets are labelled ${others.join(', ') || 'nothing'}`, independentOfModel: true }]
      const alternatives: Alternative[] = (['FRONT', 'REAR', 'LEFT', 'RIGHT'] as const).filter((s) => !free.includes(s)).map((s) => ({ id: `side-${s}`, value: s, measure: null, why: `another sheet is labelled ${s}` }))
      if (free.length === 1) side = { state: 'REGISTERED', value: free[0], basis: 'LABEL_ELIMINATION', confidence: 0.7, why: `three other sheets are labelled ${others.join(', ')}: only the ${free[0].toLowerCase()} wall is left`, anchors, alternatives }
      else if (free.length === 2 && axisOf(free[0]) === axisOf(free[1])) {
        const sideAxis = axisOf(free[0]) === 'SIDES' ? 'LEFT_OR_RIGHT' : 'FRONT_OR_REAR'
        side = unlabelledPeers >= 1
          ? { state: 'AXIS_ONLY', value: sideAxis, basis: 'LABEL_ELIMINATION', confidence: 0.6, why: `the other sheets are labelled ${others.join(', ')}: this view shows the ${sideAxis === 'LEFT_OR_RIGHT' ? 'left or the right' : 'front or the rear'} wall, and with another unlabelled sheet on that axis which of the two is not stated — the hand is UNKNOWN`, anchors, alternatives }
          : { state: 'AXIS_ONLY', value: sideAxis, basis: 'LABEL_ELIMINATION', confidence: 0.6, why: `the other sheets are labelled ${others.join(', ')}: this view shows the ${sideAxis === 'LEFT_OR_RIGHT' ? 'left or the right' : 'front or the rear'} wall; which of the two is not stated`, anchors, alternatives }
      } else side = { state: 'UNKNOWN', value: 'UNKNOWN', basis: 'NONE', confidence: 0, why: `unlabelled, and the labels of the other sheets (${others.join(', ') || 'none'}) leave ${free.length} walls on both axes: no independent premise settles which wall it shows`, anchors, alternatives }
    }
    const sideValue = side.value
    const axis = isSide(sideValue) ? axisOf(sideValue) : sideValue === 'LEFT_OR_RIGHT' ? 'SIDES' : sideValue === 'FRONT_OR_REAR' ? 'FRONT_REAR' : undefined

    // --- ALONG -------------------------------------------------------------------------------------------------
    let along: ElevationAxes['along']
    const siblings = heightsBySize.get(`${frame.size.width}x${frame.size.height}`) ?? []
    const sibH = siblings.length >= 2 ? median(siblings) : undefined
    const extentPlausible = sibH === undefined || rect.y1 - rect.y0 >= EXTENT_HEIGHT_MIN_SHARE * sibH
    const sky = skyMask(raster)
    const bands = wallBands(raster, rect, undefined, sky).filter((b) => !b.clipped && b.share >= WALL_BAND_MIN_SHARE && b.x1 - b.x0 >= WALL_BAND_MIN_WIDTH * (rect.x1 - rect.x0)).sort((p, q) => q.rows - p.rows || q.x1 - q.x0 - (p.x1 - p.x0))
    const band = bands[0]
    if (a?.use === 'REGISTERED' || a?.use === 'OPENINGS_ONLY' || a?.use === 'POSITIONS_ONLY') {
      const span = isSide(sideValue) ? spanOf(axisOf(sideValue)) : undefined
      along = {
        state: 'REGISTERED',
        ...(a.mpp !== undefined ? { mpp: a.mpp } : {}),
        ...(solverReg ? { alongAtLeft: solverReg.alongAtLeft, alongSign: solverReg.alongSign } : {}),
        ...(a.spanM !== undefined ? { spanM: a.spanM } : {}),
        ...(a.mpp !== undefined ? { uncertaintyM: round6(2 * a.mpp) } : {}),
        why: `the solver's ${a.use.toLowerCase().replace('_', ' ')} registration: ${a.spanWhy ?? a.why}`.slice(0, 300),
        anchors: [{ kind: 'SOLVER_REGISTRATION', what: a.spanWhy ?? a.use, ...(a.mpp !== undefined ? { m: a.mpp } : {}), independentOfModel: false }, ...(span ? [{ kind: 'PLAN_WALLED_SPAN' as const, what: `the ${round6(span.a1 - span.a0)} m ${span.what} the plan measures`, m: round6(span.a1 - span.a0), independentOfModel: false }] : [])],
        alternatives: band && span ? [{ id: 'wall-band', value: `${band.x0}..${band.x1}`, measure: round6((span.a1 - span.a0) / (band.x1 - band.x0)), why: 'the multi-column wall band, for comparison' }] : [],
      }
      // a wall band that disagrees with the solver's registration is noted here; it contests it only where a second,
      // independent reading (the opposite view's band) agrees with it — see the contest pass below
    } else if (!axis) along = { state: 'UNCHECKED', why: 'the wall it shows is not known, so no span can be put on it', anchors: [], alternatives: band ? [{ id: 'wall-band', value: `${band.x0}..${band.x1}`, measure: null, why: 'a drawn wall band, with no span to put on it' }] : [] }
    else if (!extentPlausible) along = { state: 'REFUSED', why: `its outline is ${round6(rect.y1 - rect.y0)} px tall against ${round6(sibH ?? 0)} px for the house on its ${siblings.length - 1} same-size sibling sheets: the outline is not the building, so no band on it is the walls`, anchors: [{ kind: 'SIBLING_SHEETS', what: `median outline height ${round6(sibH ?? 0)} px on ${siblings.length} sheets of ${frame.size.width}×${frame.size.height}`, independentOfModel: true }], alternatives: [] }
    else if (!band) along = { state: 'UNCHECKED', why: 'no band of wall runs across its silhouette on any of five columns: the walls’ ends cannot be read', anchors: [], alternatives: [] }
    else if (spansOf(axis).length > 1) {
      const [a1, a2] = spansOf(axis)
      along = { state: 'UNCHECKED', why: `a wall band (columns ${band.x0}..${band.x1}) is drawn, but it may be the ${round6(a1.a1 - a1.a0)} m ${a1.what} or the ${round6(a2.a1 - a2.a0)} m ${a2.what}, and nothing on this sheet alone decides`, anchors: [{ kind: 'WALL_BAND_ENDS', what: `a band of wall over ${band.rows} rows`, px: { x0: band.x0, x1: band.x1 }, independentOfModel: true }], alternatives: [a1, a2].map((x, i) => ({ id: `span-${i}`, value: x.what, measure: round6((x.a1 - x.a0) / (band.x1 - band.x0)), why: 'the m/px this span would give' })) }
    } else {
      const span = spanOf(axis)
      const mpp = round6((span.a1 - span.a0) / (band.x1 - band.x0))
      const anchors: Anchor[] = [
        { kind: 'WALL_BAND_ENDS', what: `a band of wall over ${band.rows} rows, read across five columns`, px: { x0: band.x0, x1: band.x1 }, independentOfModel: true },
        { kind: 'PLAN_WALLED_SPAN', what: `the ${round6(span.a1 - span.a0)} m ${span.what} the plan's chains measure`, m: round6(span.a1 - span.a0), independentOfModel: false },
      ]
      if (isSide(sideValue)) {
        const sign: 1 | -1 = sideValue === 'FRONT' || sideValue === 'RIGHT' ? 1 : -1
        along = { state: 'REGISTERED', mpp, alongAtLeft: round6(sign === 1 ? span.a0 : span.a1), alongSign: sign, spanM: round6(span.a1 - span.a0), bandPx: { x0: band.x0, x1: band.x1, rows: band.rows }, uncertaintyM: round6(2 * mpp), why: `the wall band's ends (columns ${band.x0}..${band.x1}) are the ${round6(span.a1 - span.a0)} m ${span.what}: ${mpp} m/px`, anchors, alternatives: bands.slice(1, 4).map((b, i) => ({ id: `band-${i + 1}`, value: `${b.x0}..${b.x1}`, measure: round6((span.a1 - span.a0) / (b.x1 - b.x0)), why: `a band over ${b.rows} rows, fewer than the chosen ${band.rows}` })) }
      } else along = { state: 'SPAN_ONLY', mpp, spanM: round6(span.a1 - span.a0), bandPx: { x0: band.x0, x1: band.x1, rows: band.rows }, uncertaintyM: round6(2 * mpp), why: `the wall band's ends (columns ${band.x0}..${band.x1}) are the ${round6(span.a1 - span.a0)} m ${span.what}: ${mpp} m/px; the hand is unknown, so the span and scale stand and no position along the facade is read`, anchors, alternatives: [] }
    }

    ctx.set(frame.id, { raster, rect, solverReg, band, axis, extentPlausible })
    out.push({ ...base, side, along, vertical: { state: 'UNCHECKED', why: '', anchors: [], alternatives: [] }, scale: { state: 'UNCHECKED', why: '' }, class: 'UNREGISTERED', checkable: { along: [], vertical: [], slots: 0 } })
  }

  // the sheet scale: on sheets of one size, the views whose along scale stands agree on one m/px; a band of built
  // pixels on another sheet of that size is the walls where that scale puts the span at its width
  sheetScalePass(out, ctx, spansOf)
  // the solver's along registration is contested where this view's wall band disagrees with it by more than the
  // opposite-view agreement AND the opposite view's own band agrees with this one's: two band readings against one
  for (const v of out) {
    if (v.along.state !== 'REGISTERED' || !(v.solver.use === 'REGISTERED' || v.solver.use === 'OPENINGS_ONLY' || v.solver.use === 'POSITIONS_ONLY') || v.solver.mpp === undefined) continue
    const mine = v.along.alternatives.find((x) => x.id === 'wall-band')?.measure
    if (mine === undefined || mine === null || Math.abs(mine / v.solver.mpp - 1) <= OPPOSITE_SPAN_AGREEMENT) continue
    const ax = isSide(v.side.value) ? axisOf(v.side.value) : undefined
    const mate = out.find((o) => o !== v && o.sizePx.width === v.sizePx.width && o.sizePx.height === v.sizePx.height && isSide(o.side.value) && axisOf(o.side.value) === ax && o.along.alternatives.some((x) => x.id === 'wall-band' && x.measure !== null && Math.abs((x.measure as number) / mine - 1) <= OPPOSITE_SPAN_AGREEMENT))
    if (!mate) continue
    const theirs = mate.along.alternatives.find((x) => x.id === 'wall-band')?.measure as number
    // the sheet arbitrates: where other views of this sheet size stand at the solver's scale, the two bands are the outliers
    const others = out.filter((o) => o !== v && o !== mate && o.sizePx.width === v.sizePx.width && o.sizePx.height === v.sizePx.height && o.along.mpp !== undefined && (o.along.state === 'REGISTERED' || o.along.state === 'SPAN_ONLY'))
    const forSolver = others.filter((o) => Math.abs((o.along.mpp as number) / (v.solver.mpp as number) - 1) <= SHEET_SCALE_AGREEMENT)
    const forBands = others.filter((o) => Math.abs((o.along.mpp as number) / mine - 1) <= SHEET_SCALE_AGREEMENT)
    if (forSolver.length > forBands.length) {
      v.along.anchors.push({ kind: 'SIBLING_SHEETS', what: `its wall band and the opposite view's (${mine} and ${theirs} m/px) disagree with the solver's ${v.solver.mpp} m/px, but ${forSolver.length} other view(s) of this sheet size stand at the solver's scale: the bands are taken to be the outliers`, independentOfModel: true })
      continue
    }
    const { mpp: _m, alongAtLeft: _a, alongSign: _s, ...rest } = v.along
    v.along = { ...rest, state: 'UNCHECKED', why: `contested: the solver's registration gives ${v.solver.mpp} m/px, but this view's wall band gives ${mine} m/px (${round6((mine / v.solver.mpp - 1) * 100)} % apart) and the opposite view ${mate.frameId}'s band agrees with it (${theirs} m/px): two band readings against one, and neither scale is taken` }
  }
  // opposite views of one axis, on sheets of one size: their wall bands must show one span. Judged on the states as
  // they stand (a snapshot), so the order of the views decides nothing: where two disagree, a band the sheet scale
  // corroborates is kept and the other is not taken; where neither is corroborated, neither is.
  const standing = out.filter((v) => (v.along.state === 'REGISTERED' || v.along.state === 'SPAN_ONLY') && v.along.mpp !== undefined && v.along.bandPx && v.solver.use !== 'REGISTERED' && v.solver.use !== 'OPENINGS_ONLY' && v.solver.use !== 'POSITIONS_ONLY')
  const axisOfView = (v: ElevationAxes): string | undefined => (isSide(v.side.value) ? axisOf(v.side.value) : v.side.value === 'LEFT_OR_RIGHT' ? 'SIDES' : v.side.value === 'FRONT_OR_REAR' ? 'FRONT_REAR' : undefined)
  const corroborated = (v: ElevationAxes): boolean => v.along.anchors.some((x) => x.kind === 'SIBLING_SHEETS')
  const drop = new Map<ElevationAxes, string>()
  for (const v of standing) {
    for (const o of out) {
      if (o === v || o.sizePx.width !== v.sizePx.width || o.sizePx.height !== v.sizePx.height || axisOfView(o) !== axisOfView(v)) continue
      if ((o.along.state !== 'REGISTERED' && o.along.state !== 'SPAN_ONLY') || o.along.mpp === undefined || v.along.mpp === undefined) continue
      const ratio = v.along.mpp / o.along.mpp
      if (Math.abs(ratio - 1) <= OPPOSITE_SPAN_AGREEMENT) {
        v.along.anchors.push({ kind: 'SIBLING_SHEETS', what: `the opposite view ${o.frameId} shows the same span at ${o.along.mpp} m/px (${round6((ratio - 1) * 100)} %)`, independentOfModel: true })
        continue
      }
      v.along.alternatives.push({ id: `opposite-${o.frameId}`, value: `${o.along.mpp} m/px`, measure: round6(ratio), why: 'the opposite view on a sheet of the same size shows the span at another scale' })
      if (!corroborated(v) || corroborated(o)) drop.set(v, `the opposite view ${o.frameId}, on a sheet of the same size, puts the same span at ${o.along.mpp} m/px (${round6((ratio - 1) * 100)} % apart)${corroborated(o) && !corroborated(v) ? ', and its scale is the one the sheet set corroborates' : ': one of the two bands is not the walls, and neither is taken'}`)
    }
  }
  for (const [v, why] of drop) {
    const { mpp: _m, alongAtLeft: _a, alongSign: _s, ...rest } = v.along
    v.along = { ...rest, state: 'UNCHECKED', why: `${v.along.why}; but ${why}` }
  }
  // vertical and scale, once every along axis is settled
  const sheetRefOf = (v: ElevationAxes): number | undefined => {
    const m = out.filter((o) => o !== v && o.sizePx.width === v.sizePx.width && o.sizePx.height === v.sizePx.height && (o.solver.use === 'REGISTERED' || o.solver.use === 'OPENINGS_ONLY' || o.solver.use === 'POSITIONS_ONLY') && o.along.state === 'REGISTERED' && o.along.mpp !== undefined).map((o) => o.along.mpp as number).sort((a, b) => a - b)
    return m.length > 0 ? m[Math.floor(m.length / 2)] : undefined
  }
  for (const v of out) {
    const c = ctx.get(v.frameId)
    if (!c) continue
    const { raster, rect, solverReg } = c
    const a = audit.get(v.frameId)
    const along = v.along
    const band = c.band
    let vertical: ElevationAxes['vertical']
    let scale: ElevationAxes['scale']
    const groundRow = rect.y1
    const mppA = along.mpp
    if (a?.use === 'REGISTERED' && solverReg && along.state === 'REGISTERED') {
      const err = Math.abs(solverReg.bottomY - (input.terrainY ?? 0))
      // the same ground test as every other view: within 0.3 m of a printed terrain, else within a plinth below ±0.00
      const groundOk = input.terrainY !== undefined ? err <= GROUND_TOLERANCE_M : solverReg.bottomY >= PLINTH_RANGE_M.low && solverReg.bottomY <= PLINTH_RANGE_M.high
      const refusedHeights = a.openingHeights === 'REFUSED' || !groundOk
      vertical = refusedHeights
        ? { state: a.openingHeights === 'REFUSED' ? 'UNCHECKED' : 'REFUSED', zeroRow: solverReg.zeroRow, groundY: solverReg.bottomY, groundErrorM: round6(err), why: a.openingHeights === 'REFUSED' ? 'the solver hung it from the ridge datum but refused its low heights: its ground lands off the house’s other views' : `the solver hung it from the ridge datum, but its ground lands at ${solverReg.bottomY} m — ${input.terrainY !== undefined ? `${round6(err)} m from the printed terrain` : 'outside a plinth below ±0.00'} (the solver accepts 0.9 m): the apex is not the ridge, or one scale does not serve both axes`, anchors: [{ kind: 'PRINTED_RIDGE_DATUM', what: 'the section’s highest datum at the silhouette’s apex', ...(input.ridgeY !== undefined ? { m: input.ridgeY } : {}), independentOfModel: true }], alternatives: [] }
        : { state: 'REGISTERED', zeroRow: solverReg.zeroRow, groundY: solverReg.bottomY, groundErrorM: round6(err), why: `the solver hung it from the ridge datum at the silhouette's apex; its ground lands at ${solverReg.bottomY} m`, anchors: [{ kind: 'PRINTED_RIDGE_DATUM', what: 'the section’s highest datum at the silhouette’s apex', ...(input.ridgeY !== undefined ? { m: input.ridgeY } : {}), independentOfModel: true }, { kind: 'DRAWN_GROUND', what: 'the silhouette’s bottom row', px: rect.y1, independentOfModel: true }], alternatives: [] }
      scale = refusedHeights ? (a.openingHeights === 'REFUSED' ? { state: 'ALONG_ONLY', mpp: solverReg.mpp, why: 'one scale, from the span; its heights low on the wall are refused' } : { state: 'REFUSED', mpp: solverReg.mpp, why: 'the span’s scale does not put the ground where it can be' }) : { state: input.terrainY !== undefined ? 'VERIFIED_ISOTROPIC' : 'ISOTROPY_PLAUSIBLE', mpp: solverReg.mpp, why: `the span's scale puts the ground ${input.terrainY !== undefined ? `${round6(err)} m from the printed terrain` : `at ${solverReg.bottomY} m, within a plinth below ±0.00 (no terrain printed)`}` }
    } else if (input.ridgeY === undefined) {
      vertical = { state: 'UNCHECKED', why: 'no ridge datum is printed on a section: no height is hung on this view (its along axis stands on its own)', anchors: [], alternatives: [] }
      scale = mppA !== undefined ? { state: 'ALONG_ONLY', mpp: mppA, why: 'one scale, along the facade; no vertical datum to check it against' } : { state: 'UNCHECKED', why: 'neither axis has a scale' }
    } else {
      const mask = skyMask(raster)
      const cols = along.bandPx ?? band ?? { x0: rect.x0, x1: rect.x1 }
      const profile = topProfile(mask, cols.x0, cols.x1, groundRow)
      const spikePx = mppA !== undefined ? NARROW_SPIKE_M / mppA : 0.08 * (cols.x1 - cols.x0)
      const tolPx = mppA !== undefined ? 0.25 / mppA : 0.015 * (rect.y1 - rect.y0)
      const apex = apexOf(profile, spikePx, tolPx)
      if (apex.row === undefined) {
        vertical = { state: 'UNCHECKED', why: `the roof's apex is not stated: ${apex.why}`, anchors: [{ kind: 'PRINTED_RIDGE_DATUM', what: 'the section’s highest datum', m: input.ridgeY, independentOfModel: true }], alternatives: [] }
        scale = mppA !== undefined ? { state: 'ALONG_ONLY', mpp: mppA, why: 'one scale, along the facade; the apex the ridge datum hangs on is not stated' } : { state: 'UNCHECKED', why: 'neither axis has a scale' }
      } else if (mppA !== undefined) {
        const groundY = round6(input.ridgeY - (groundRow - apex.row) * mppA)
        const anchors: Anchor[] = [
          { kind: 'PRINTED_RIDGE_DATUM', what: 'the section’s highest datum', m: input.ridgeY, independentOfModel: true },
          { kind: 'DRAWN_APEX', what: `${apex.method.toLowerCase().replace('_', ' ')}: ${apex.why}`, px: apex.row, independentOfModel: true },
          { kind: 'DRAWN_GROUND', what: 'the building outline’s bottom row', px: groundRow, independentOfModel: true },
          ...(input.terrainY !== undefined ? [{ kind: 'PRINTED_TERRAIN_DATUM' as const, what: 'the section’s terrain datum', m: input.terrainY, independentOfModel: true }] : []),
        ]
        const ok = input.terrainY !== undefined ? Math.abs(groundY - input.terrainY) <= GROUND_TOLERANCE_M : groundY >= PLINTH_RANGE_M.low && groundY <= PLINTH_RANGE_M.high
        const err = input.terrainY !== undefined ? round6(Math.abs(groundY - input.terrainY)) : round6(groundY < PLINTH_RANGE_M.low ? PLINTH_RANGE_M.low - groundY : groundY > PLINTH_RANGE_M.high ? groundY - PLINTH_RANGE_M.high : 0)
        const zeroRow = round6(apex.row + input.ridgeY / mppA)
        vertical = ok
          ? { state: along.state === 'REGISTERED' || along.state === 'SPAN_ONLY' ? 'REGISTERED' : 'UNCHECKED', apexRow: apex.row, groundRow, zeroRow, groundY, groundErrorM: err, why: `the ridge datum ${input.ridgeY} m at the apex (row ${round6(apex.row)}) and the along scale put the drawn ground at ${groundY} m${input.terrainY !== undefined ? ` against the printed terrain ${input.terrainY} m` : ', within a plinth below ±0.00 (no terrain printed)'}`, anchors, alternatives: [] }
          : { state: 'REFUSED', apexRow: apex.row, groundRow, groundY, groundErrorM: err, why: `the ridge datum at the apex and the along scale put the drawn ground at ${groundY} m, ${err} m outside ${input.terrainY !== undefined ? `${GROUND_TOLERANCE_M} m of the printed terrain` : 'a plinth below ±0.00'}: the apex is not the ridge, or one scale does not serve both axes`, anchors, alternatives: [] }
        scale = ok ? { state: input.terrainY !== undefined ? 'VERIFIED_ISOTROPIC' : 'ISOTROPY_PLAUSIBLE', mpp: mppA, why: input.terrainY !== undefined ? 'the along scale puts the drawn ground on the printed terrain' : 'the along scale puts the drawn ground where a plinth can be; no terrain is printed to verify it' } : { state: 'REFUSED', mpp: mppA, why: vertical.why }
      } else if (input.terrainY !== undefined) {
        const mppV = round6((input.ridgeY - input.terrainY) / (groundRow - apex.row))
        // a scale up the wall alone is held to the sheet scale of the solver's registrations of this size, where any
        const ref = sheetRefOf(v)
        if (ref !== undefined && Math.abs(mppV / ref - 1) > OPPOSITE_SPAN_AGREEMENT) {
          vertical = { state: 'REFUSED', apexRow: apex.row, groundRow, why: `two printed datums on two drawn rows give ${mppV} m/px up the wall, ${round6((mppV / ref - 1) * 100)} % off the sheet scale ${ref} m/px of the solver's same-size registrations: the apex is not the ridge, the ground is not the terrain, or the sheet is not one scale — no height is read`, anchors: [{ kind: 'SIBLING_SHEETS', what: `sheet scale ${ref} m/px`, m: ref, independentOfModel: true }, { kind: 'DRAWN_APEX', what: apex.why, px: apex.row, independentOfModel: true }], alternatives: [] }
          scale = { state: 'REFUSED', mpp: mppV, why: vertical.why }
          v.vertical = vertical
          v.scale = scale
          continue
        }
        vertical = { state: 'REGISTERED', apexRow: apex.row, groundRow, zeroRow: round6(apex.row + input.ridgeY / mppV), groundY: input.terrainY, why: `two printed datums on two drawn rows: the ridge ${input.ridgeY} m at the apex (row ${round6(apex.row)}) and the terrain ${input.terrainY} m at the ground (row ${groundRow}): ${mppV} m/px up the wall`, anchors: [{ kind: 'PRINTED_RIDGE_DATUM', what: 'the section’s highest datum', m: input.ridgeY, independentOfModel: true }, { kind: 'PRINTED_TERRAIN_DATUM', what: 'the section’s terrain datum', m: input.terrainY, independentOfModel: true }, { kind: 'DRAWN_APEX', what: apex.why, px: apex.row, independentOfModel: true }, { kind: 'DRAWN_GROUND', what: 'the building outline’s bottom row', px: groundRow, independentOfModel: true }], alternatives: [] }
        scale = { state: 'VERTICAL_ONLY', mpp: mppV, why: 'one scale, up the wall, from two printed datums; nothing along the facade to check it against' }
      } else {
        vertical = { state: 'UNCHECKED', apexRow: apex.row, why: 'the apex is drawn, but with no along scale and no printed terrain there is one datum and no scale', anchors: [{ kind: 'DRAWN_APEX', what: apex.why, px: apex.row, independentOfModel: true }], alternatives: [] }
        scale = { state: 'UNCHECKED', why: 'neither axis has a scale' }
      }
    }
    v.vertical = vertical
    v.scale = scale
  }
  // classes and checkable slots
  for (const v of out) {
    const alongOk = v.along.state === 'REGISTERED'
    const spanOk = v.along.state === 'SPAN_ONLY'
    const vertOk = v.vertical.state === 'REGISTERED'
    v.class = alongOk && vertOk && isSide(v.side.value) ? 'FULL' : alongOk || spanOk ? 'ALONG_ONLY' : vertOk ? 'VERTICAL_ONLY' : 'UNREGISTERED'
    const facade = isSide(v.side.value) ? v.side.value : undefined
    const openings = facade ? input.openingsByFacade[facade] ?? 0 : 0
    if (alongOk) v.checkable.along = ['the facade’s width', 'its two wall ends', `the positions and widths of its ${openings} openings`]
    else if (spanOk) v.checkable.along = ['the facade’s width (the hand unknown: no position)']
    if (vertOk && facade) v.checkable.vertical = ['the eaves and the ridge', `the sills and heads of its ${openings} openings`]
    else if (vertOk) v.checkable.vertical = ['the eaves and the ridge (the facade unknown: no opening)']
    v.checkable.slots = (alongOk ? 3 + openings : spanOk ? 1 : 0) + (vertOk ? 2 + (facade ? 2 * openings : 0) : 0)
    if (v.solver.mpp !== undefined && v.along.alternatives.some((x) => x.id === 'wall-band' && x.measure !== null)) {
      const b = v.along.alternatives.find((x) => x.id === 'wall-band')
      if (b?.measure) v.solverAgreement = { mppRatio: round6(b.measure / v.solver.mpp) }
    }
  }
  void OPPOSITE
  return out.sort((p, q) => (p.frameId < q.frameId ? -1 : 1))
}

/**
 * The sheet scale, and the bands it admits. On sheets of one size, the views whose along scale already stands
 * (neutral wall bands, the solver's registrations) give a reference m/px — the median of those that agree with it to
 * `SHEET_SCALE_AGREEMENT`. On a view of that size whose along axis is still open (never one refused as not the
 * building), every band — neutral or built (not sky, not vegetation) — is held against the plan's spans at that scale:
 * one within `SHEET_SCALE_AGREEMENT` is the walls, on its own sheet's ends. Where the wall the view shows is unknown,
 * the band may settle the axis, but only if it fits one span and no band fits the other.
 */
function sheetScalePass(out: ElevationAxes[], ctx: Map<string, { raster: Raster; rect: PixelRect; band?: { x0: number; x1: number; rows: number }; axis?: 'FRONT_REAR' | 'SIDES'; extentPlausible: boolean }>, spansOf: (ax: 'FRONT_REAR' | 'SIDES') => Array<{ a0: number; a1: number; what: string }>): void {
  const groups = new Map<string, ElevationAxes[]>()
  for (const v of out) if (ctx.has(v.frameId)) groups.set(`${v.sizePx.width}x${v.sizePx.height}`, [...(groups.get(`${v.sizePx.width}x${v.sizePx.height}`) ?? []), v])
  const bySolver = (v: ElevationAxes): boolean => v.solver.use === 'REGISTERED' || v.solver.use === 'OPENINGS_ONLY' || v.solver.use === 'POSITIONS_ONLY'
  for (const views of groups.values()) {
    // the reference: the solver's registrations of this sheet size where there are any (registered before any model),
    // else at least two of this stage's own bands that agree
    const solverScaled = views.filter((v) => bySolver(v) && v.along.mpp !== undefined)
    const ownScaled = views.filter((v) => !bySolver(v) && (v.along.state === 'REGISTERED' || v.along.state === 'SPAN_ONLY') && v.along.mpp !== undefined)
    const pool = solverScaled.length > 0 ? solverScaled : ownScaled
    if (pool.length === 0) continue
    const mpps = pool.map((v) => v.along.mpp as number).sort((a, b) => a - b)
    const mid = mpps[Math.floor(mpps.length / 2)]
    const agreeing = pool.filter((v) => Math.abs((v.along.mpp as number) / mid - 1) <= SHEET_SCALE_AGREEMENT)
    if (solverScaled.length === 0 && agreeing.length < 2) continue
    const refMpps = agreeing.map((v) => v.along.mpp as number).sort((a, b) => a - b)
    const ref = refMpps[Math.floor(refMpps.length / 2)]
    // this stage's own bands are held to that reference: one that puts its span at another scale is not the walls
    for (const v of ownScaled) {
      if (agreeing.includes(v)) {
        if (solverScaled.length > 0) v.along.anchors.push({ kind: 'SIBLING_SHEETS', what: `agrees with the sheet scale ${ref} m/px of the solver's ${agreeing.length} same-size registration(s) to ${round6(((v.along.mpp as number) / ref - 1) * 100)} %`, m: ref, independentOfModel: true })
        continue
      }
      v.along.alternatives.push({ id: 'own-band', value: `${v.along.mpp} m/px`, measure: round6((v.along.mpp as number) / ref - 1), why: `its band puts its span at ${v.along.mpp} m/px against the sheet scale ${ref} m/px of ${agreeing.length} same-size view(s): not the walls` })
      const { mpp: _m, alongAtLeft: _a, alongSign: _s, ...rest } = v.along
      v.along = { ...rest, state: 'UNCHECKED', why: `${v.along.why}; refused: that is ${round6(((v.along.mpp as number) / ref - 1) * 100)} % off the sheet scale ${ref} m/px of its same-size sibling views` }
    }
    for (const v of views) {
      if (v.along.state !== 'UNCHECKED') continue
      const c = ctx.get(v.frameId)
      if (!c || !c.extentPlausible) continue
      const mask = skyMask(c.raster)
      const built = (x: number, y: number): boolean => {
        if (mask.data[y * c.raster.width + x] === 1) return false
        const [r, g, b] = rgb(c.raster, x, y)
        return g - Math.max(r, b) < 8
      }
      const fit = (b: { x1: number; x0: number; share: number; clipped: boolean }): boolean => !b.clipped && b.share >= WALL_BAND_MIN_SHARE && b.x1 - b.x0 >= WALL_BAND_MIN_WIDTH * (c.rect.x1 - c.rect.x0)
      const candidates = [...wallBands(c.raster, c.rect, undefined, mask).filter(fit).map((b) => ({ ...b, kind: 'WALL_BAND_ENDS' as const })), ...wallBands(c.raster, c.rect, built).filter(fit).map((b) => ({ ...b, kind: 'BUILT_BAND_ENDS' as const }))]
      const axes: Array<'FRONT_REAR' | 'SIDES'> = c.axis ? [c.axis] : ['FRONT_REAR', 'SIDES']
      const scored = candidates.flatMap((b) => axes.flatMap((ax) => spansOf(ax).map((span) => {
        const dev = ((b.x1 - b.x0) * ref) / (span.a1 - span.a0) - 1
        return { b, ax, span, dev }
      })))
      const within = scored.filter((x) => Math.abs(x.dev) <= SHEET_SCALE_AGREEMENT).sort((p, q) => Math.abs(p.dev) - Math.abs(q.dev) || q.b.rows - p.b.rows)
      const best = within[0]
      if (!best) {
        v.along.alternatives.push(...scored.slice(0, 4).map((x, i) => ({ id: `sheet-${i}`, value: `${x.b.kind} ${x.b.x0}..${x.b.x1} as the ${x.span.what}`, measure: round6(x.dev), why: `at the sheet scale ${ref} m/px it is ${round6(x.dev * 100)} % off the span` })))
        continue
      }
      if (!c.axis && within.some((x) => x.ax !== best.ax)) {
        v.along.alternatives.push(...within.slice(0, 4).map((x, i) => ({ id: `sheet-${i}`, value: `${x.b.x0}..${x.b.x1} as the ${x.span.what}`, measure: round6(x.dev), why: 'a band fits a span on either axis: the axis is not settled' })))
        continue
      }
      const px = best.b.x1 - best.b.x0
      const mpp = round6((best.span.a1 - best.span.a0) / px)
      const anchors: Anchor[] = [
        { kind: best.b.kind, what: `a band of ${best.b.kind === 'WALL_BAND_ENDS' ? 'neutral wall' : 'built pixels (not sky, not vegetation)'} over ${best.b.rows} rows`, px: { x0: best.b.x0, x1: best.b.x1 }, independentOfModel: true },
        { kind: 'PLAN_WALLED_SPAN', what: `the ${round6(best.span.a1 - best.span.a0)} m ${best.span.what} the plan's chains measure`, m: round6(best.span.a1 - best.span.a0), independentOfModel: false },
        { kind: 'SIBLING_SHEETS', what: `the sheet scale ${ref} m/px of ${agreeing.length} same-size view${agreeing.length === 1 ? '' : 's'} (${agreeing.map((x) => x.frameId).join(', ')}) puts that span at this band's width to ${round6(best.dev * 100)} %`, m: ref, independentOfModel: true },
      ]
      if (!c.axis) {
        const value = best.ax === 'SIDES' ? 'LEFT_OR_RIGHT' : 'FRONT_OR_REAR'
        v.side = { ...v.side, state: 'AXIS_ONLY', value, basis: 'WIDTH_AT_SHEET_SCALE', confidence: 0.5, why: `${v.side.why}; at the sheet scale its band fits the ${best.span.what} and no band fits the other span: the ${value === 'LEFT_OR_RIGHT' ? 'left or the right' : 'front or the rear'} wall, hand unknown`, anchors: [...v.side.anchors, anchors[2]] }
        c.axis = best.ax
      }
      const sideValue = v.side.value
      const isWall = sideValue === 'FRONT' || sideValue === 'REAR' || sideValue === 'LEFT' || sideValue === 'RIGHT'
      const sign: 1 | -1 = sideValue === 'FRONT' || sideValue === 'RIGHT' ? 1 : -1
      v.along = isWall
        ? { state: 'REGISTERED', mpp, alongAtLeft: round6(sign === 1 ? best.span.a0 : best.span.a1), alongSign: sign, spanM: round6(best.span.a1 - best.span.a0), bandPx: { x0: best.b.x0, x1: best.b.x1, rows: best.b.rows }, uncertaintyM: round6(2 * mpp), why: `the band's ends (columns ${best.b.x0}..${best.b.x1}) are the ${round6(best.span.a1 - best.span.a0)} m ${best.span.what}, as the sheet scale of its sibling views says (${round6(best.dev * 100)} %): ${mpp} m/px`, anchors, alternatives: within.slice(1, 4).map((x, i) => ({ id: `sheet-${i + 1}`, value: `${x.b.x0}..${x.b.x1}`, measure: round6(x.dev), why: 'another band within the agreement, farther from the span' })) }
        : { state: 'SPAN_ONLY', mpp, spanM: round6(best.span.a1 - best.span.a0), bandPx: { x0: best.b.x0, x1: best.b.x1, rows: best.b.rows }, uncertaintyM: round6(2 * mpp), why: `the band's ends (columns ${best.b.x0}..${best.b.x1}) are the ${round6(best.span.a1 - best.span.a0)} m ${best.span.what} at the sheet scale of its sibling views (${round6(best.dev * 100)} %): ${mpp} m/px; the hand is unknown, so no position along the facade is read`, anchors, alternatives: [] }
      c.band = { x0: best.b.x0, x1: best.b.x1, rows: best.b.rows }
    }
  }
}

/** The solver's use of a view, as a class on the same four rungs (the BEFORE of N9-02A). */
export function solverClass(use: string, openingHeights?: string): RegistrationClass {
  if (use === 'REGISTERED') return openingHeights === 'REFUSED' ? 'ALONG_ONLY' : 'FULL'
  if (use === 'OPENINGS_ONLY' || use === 'POSITIONS_ONLY') return 'ALONG_ONLY'
  return 'UNREGISTERED'
}
