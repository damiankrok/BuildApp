/**
 * v3.54.17 — the basic mass of a house from source observations, before (and without) a LOCAL model.
 *
 * Observations, never a third description of the house: a plan OUTLINE in metres (from a plan frame whose scale the
 * analyzer measured, or from the walls of the model that stands), and each elevation's SILHOUETTE as the sketch reads
 * it (its ground row, wall zones and roof surfaces, in that elevation's own frame pixels). From them:
 *
 *   1. each elevation is registered BY THE PLAN — its building width in pixels against the outline's extent along that
 *      side gives metres per pixel; the vertical scale is the same (an orthographic elevation is drawn isotropic), and
 *      the ground row is the sketch's. A wrong roof in the model never enters this registration, so a roof can be
 *      corrected before any height of the model is trusted (no "no correction without registration" loop).
 *   2. the outline is split into at most two rectangles (the supported scope: a rectangle, or two joined bodies); where
 *      both splits of an L are possible, the one whose line an elevation's silhouette steps at is taken, else both are
 *      kept and the larger main body is named as the choice.
 *   3. per body, the elevations that face it give its eaves and ridge (or flat top) and its roof form: a gable END is a
 *      triangle on the sides across the ridge, the SLOPES a band on the sides along it; a flat roof rises nothing above
 *      its walls. A hip (a trapezoid on every side) or a form no elevation decides is named, never guessed.
 *
 * Every number keeps its provenance (SOURCE_DERIVED from a registered drawing, DISPLAY_ASSUMPTION for a miniature
 * convention such as the wall thickness or a parapet); what is missing is listed as the anchor it lacks.
 */
import type { BuildingCommand } from '@buildapp/commands'
import type { CanonicalBuildingModel, Wall } from '@buildapp/model'
import type { BindView, Projection, Side } from '../correct/execute.js'
import type { Poly } from '../correct/source-gate.js'

export const MASSING_VERSION = '1.0.0' as const

export type Rect = { minX: number; maxX: number; minZ: number; maxZ: number }
export type Fidelity = 'SOURCE_EXACT' | 'SOURCE_DERIVED' | 'SOURCE_TRACED' | 'DISPLAY_ASSUMPTION' | 'TRACE_UNCERTAIN'
export type Prov = { fidelity: Fidelity; source: string; why: string }

/** A plan outline in metres: x along the FRONT (left to right as the front elevation shows it), z from the front (0) back. */
export type OutlineObservation = { observationId: string; frameId: string; sourceByteHash: string; outline: ReadonlyArray<{ x: number; z: number }>; by: 'API_PLAN_OUTLINE' | 'MODEL_WALLS' | 'CONTROL'; fidelity: Fidelity; why: string }
/** One elevation as the sketch reads it, in its own frame pixels. */
export type SilhouetteObservation = { observationId: string; side: Side; frameId: string; sourceByteHash: string; groundRow: number | null; walls: Poly[]; roofs: Poly[]; silhouette?: Poly | null }

export type RoofForm = 'GABLE' | 'FLAT'
export type RoofSpec = { kind: RoofForm; ridgeAxis?: 'X' | 'Z'; pitchDeg?: number; eavesM: number; ridgeM?: number }
export type BodySpec = { id: string; rect: Rect; roof: RoofSpec; provenance: Record<string, Prov> }
export type MassingStatus = 'BUILDABLE' | 'INSUFFICIENT' | 'UNSUPPORTED_FORM'
export type MassingHypothesis = {
  version: string
  status: MassingStatus
  bodies: BodySpec[]
  /** The registrations made from the plan (one per elevation that could be registered), usable by the executor. */
  views: BindView[]
  /** Other readings kept beside the chosen one (an L split the elevations did not decide, a roof axis two views dispute). */
  alternatives: string[]
  /** Anchors without which the mass is not built (or a part of it is not): named, never filled in. */
  missing: Array<{ anchor: string; why: string }>
  /** What each elevation was used for, or why not. */
  views_used: Array<{ side: Side; frameId: string; used: boolean; why: string }>
  wallThicknessM: number
  why: string
}

/** Fixed before any result: the miniature's tolerances, from the drawings' resolution and the purpose of a recognisable mass. */
export const MASSING_TOLERANCES = {
  /** Two elevations agree on a height within this (metres), or this share of it. */
  heightAgreeM: 0.35,
  heightAgreeShare: 0.08,
  /** A roof rising less than this above its eaves is flat. */
  flatRiseM: 0.4,
  /** Width at the top of a roof surface over its width at the eaves: a triangle (a gable end) below, a band (slopes) above. */
  triangleBelow: 0.35,
  bandAbove: 0.6,
  /** A storey this low or a body this narrow is not a body. */
  minBodyM: 2.0,
  /** Below this share of an outline's area a rectangle is an offset in the line, not a second body. */
  minWingShare: 0.12,
} as const
/** Conventions of the miniature, named where they are used (never presented as read). */
export const MINIATURE_CONVENTIONS = { wallThicknessM: 0.3, parapetM: 0.3, flatRoofThicknessM: 0.2, roofThicknessM: 0.25 } as const

const r6 = (v: number): number => Math.round(v * 1e6) / 1e6
const along = (s: Side): 'x' | 'z' => (s === 'FRONT' || s === 'REAR' ? 'x' : 'z')
const signOf = (s: Side): 1 | -1 => (s === 'FRONT' || s === 'RIGHT' ? 1 : -1)
const pxRange = (polys: readonly Poly[]): { x0: number; x1: number } | undefined => {
  const xs = polys.flatMap((p) => p.map((q) => q[0]))
  return xs.length > 0 ? { x0: Math.min(...xs), x1: Math.max(...xs) } : undefined
}

export function rectOfOutline(outline: ReadonlyArray<{ x: number; z: number }>): Rect {
  return { minX: Math.min(...outline.map((p) => p.x)), maxX: Math.max(...outline.map((p) => p.x)), minZ: Math.min(...outline.map((p) => p.z)), maxZ: Math.max(...outline.map((p) => p.z)) }
}
export const area = (r: Rect): number => (r.maxX - r.minX) * (r.maxZ - r.minZ)
export const extentOn = (r: Rect, s: Side): { lo: number; hi: number } => (along(s) === 'x' ? { lo: r.minX, hi: r.maxX } : { lo: r.minZ, hi: r.maxZ })
/**
 * v3.54.17 R2 (audit §5): the stretches of a body on one side that no other body covers — where what is drawn there can
 * only be that body (in front of or behind another, a body's columns show the other's walls and roof). A body whose
 * stretch is wholly shared on a side is not read on that side: hidden, or not told apart, it is named, never measured.
 */
export function exclusiveStretches(rect: Rect, others: readonly Rect[], s: Side): Array<{ lo: number; hi: number }> {
  const e = extentOn(rect, s)
  let free: Array<{ lo: number; hi: number }> = [e]
  for (const o of others) {
    const c = extentOn(o, s)
    free = free.flatMap((f) => (c.hi <= f.lo + 1e-6 || c.lo >= f.hi - 1e-6 ? [f] : [...(c.lo > f.lo ? [{ lo: f.lo, hi: c.lo }] : []), ...(c.hi < f.hi ? [{ lo: c.hi, hi: f.hi }] : [])]))
  }
  return free.filter((f) => f.hi - f.lo > 1e-6)
}
/** The longest exclusive stretch, when it is long enough to read a roof over (≥ 1 m and ≥ a quarter of the body's stretch), 5 % in from its ends. */
export function readableStretch(rect: Rect, others: readonly Rect[], s: Side): { lo: number; hi: number } | undefined {
  const e = extentOn(rect, s)
  const best = exclusiveStretches(rect, others, s).sort((a, b) => b.hi - b.lo - (a.hi - a.lo))[0]
  if (!best || best.hi - best.lo < Math.max(1, 0.25 * (e.hi - e.lo))) return undefined
  // 5 % in from each end: the columns next to where another body's wall stands still catch its edge
  const inset = 0.05 * (best.hi - best.lo)
  return { lo: best.lo + inset, hi: best.hi - inset }
}

/**
 * 1. An elevation registered by the plan: its building's width in pixels against the outline's extent along that side.
 * The vertical scale is the horizontal one (isotropic drawing, DISPLAY_ASSUMPTION until two sides agree on a height).
 */
export function registerByPlan(obs: SilhouetteObservation, extent: { lo: number; hi: number }): { view: BindView; why: string } | { refused: string } {
  const px = pxRange(obs.walls.length > 0 ? obs.walls : obs.silhouette ? [obs.silhouette] : [])
  if (!px || px.x1 - px.x0 < 20) return { refused: `the ${obs.side.toLowerCase()} elevation draws no building width to register` }
  if (obs.groundRow === null || !Number.isFinite(obs.groundRow)) return { refused: `the ${obs.side.toLowerCase()} elevation names no ground row` }
  const span = extent.hi - extent.lo
  if (!(span > MASSING_TOLERANCES.minBodyM)) return { refused: `the outline is ${span.toFixed(2)} m along the ${obs.side.toLowerCase()} side` }
  const mpp = span / (px.x1 - px.x0)
  const sign = signOf(obs.side)
  const alongAtPx0 = sign === 1 ? extent.lo - mpp * px.x0 : extent.hi + mpp * px.x0
  const projection: Projection = { mpp: r6(mpp), alongAtPx0: r6(alongAtPx0), alongSign: sign, zeroRow: obs.groundRow }
  return { view: { side: obs.side, frameId: obs.frameId, projection, heights: true, origin: 'ASSIGNED', alongErrorM: r6(Math.max(0.05, 3 * mpp)), heightErrorM: r6(Math.max(0.1, 4 * mpp)) }, why: `${(px.x1 - px.x0).toFixed(0)} px of building against ${span.toFixed(2)} m of plan: ${(mpp * 100).toFixed(2)} cm/px, vertical the same (isotropic drawing), ground row ${obs.groundRow}` }
}

const pxOfAlong = (p: Projection, a: number): number => (a - p.alongAtPx0) / (p.alongSign * p.mpp)
const yOfRow = (p: Projection, row: number): number => (p.zeroRow - row) * (p.mppV ?? p.mpp)

/** A polygon's covered rows on one pixel column (its lowest and highest edge crossings), or undefined off it. */
export function columnRange(poly: Poly, x: number): [number, number] | undefined {
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i < poly.length; i += 1) {
    const [ax, ay] = poly[i]
    const [bx, by] = poly[(i + 1) % poly.length]
    if ((ax - x) * (bx - x) > 0 || ax === bx) {
      if (ax === bx && Math.abs(ax - x) < 0.5) { lo = Math.min(lo, ay, by); hi = Math.max(hi, ay, by) }
      continue
    }
    const y = ay + ((by - ay) * (x - ax)) / (bx - ax)
    lo = Math.min(lo, y)
    hi = Math.max(hi, y)
  }
  return hi >= lo ? [lo, hi] : undefined
}
const COLUMNS = 48

/**
 * The part of one elevation over one body's stretch of its side: top, eaves and the roof's shape, read column by column
 * inside the stretch. `own` are the polygons attributed to this body on this side (see `attribute`).
 */
export function profileOver(view: BindView, a0: number, a1: number, own: { walls: Poly[]; roofs: Poly[] }): { topM: number; eavesM: number; shape: 'TRIANGLE' | 'BAND' | 'TRAPEZOID' | 'NONE'; why: string } | undefined {
  const p = view.projection
  const xs = [pxOfAlong(p, a0), pxOfAlong(p, a1)]
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const cols = Array.from({ length: COLUMNS }, (_, i) => x0 + ((i + 0.5) * (x1 - x0)) / COLUMNS)
  const cover = (polys: readonly Poly[], x: number): [number, number] | undefined => {
    let r: [number, number] | undefined
    for (const poly of polys) {
      const c = columnRange(poly, x)
      if (c) r = r ? [Math.min(r[0], c[0]), Math.max(r[1], c[1])] : c
    }
    return r
  }
  const roofCols = cols.map((x) => cover(own.roofs, x))
  const wallCols = cols.map((x) => cover(own.walls, x))
  const roofed = roofCols.filter((c): c is [number, number] => !!c)
  const walled = wallCols.filter((c): c is [number, number] => !!c)
  if (walled.length < COLUMNS / 3 && roofed.length < COLUMNS / 3) return undefined
  if (roofed.length < COLUMNS / 3) {
    const top = Math.min(...walled.map((c) => c[0]))
    return { topM: yOfRow(p, top), eavesM: yOfRow(p, top), shape: 'NONE', why: `no roof surface drawn over this stretch: the walls' top (row ${top.toFixed(0)}) is the top` }
  }
  const topRow = Math.min(...roofed.map((c) => c[0]))
  const eavesRow = Math.max(...roofed.map((c) => c[1]))
  const h = eavesRow - topRow
  const share = (row: number): number => roofCols.filter((c) => !!c && c[0] <= row && c[1] >= row).length
  const ratio = share(topRow + 0.1 * h) / Math.max(1, share(eavesRow - 0.1 * h))
  const shape = h < 2 ? 'BAND' : ratio < MASSING_TOLERANCES.triangleBelow ? 'TRIANGLE' : ratio > MASSING_TOLERANCES.bandAbove ? 'BAND' : 'TRAPEZOID'
  return { topM: yOfRow(p, topRow), eavesM: yOfRow(p, eavesRow), shape, why: `roof ${shape.toLowerCase()} from row ${topRow.toFixed(0)} to ${eavesRow.toFixed(0)} (width ratio ${ratio.toFixed(2)})` }
}

/**
 * Which drawn polygons belong to which body on one side. Bodies side by side on this side (disjoint stretches) share a
 * polygon that spans both, each reading its own columns of it; bodies one in front of the other (overlapping stretches)
 * take each polygon whole, by the stretch it matches best (intersection over union) — so a low wing in front never
 * inherits the taller roof behind it.
 */
function attribute(obs: SilhouetteObservation, view: BindView, stretches: ReadonlyArray<{ lo: number; hi: number }>): Array<{ walls: Poly[]; roofs: Poly[] }> {
  const p = view.projection
  const px = stretches.map((s) => {
    const a = pxOfAlong(p, s.lo)
    const b = pxOfAlong(p, s.hi)
    return { x0: Math.min(a, b), x1: Math.max(a, b) }
  })
  const overlapping = px.some((a, i) => px.some((b, j) => j > i && Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0.05 * Math.min(a.x1 - a.x0, b.x1 - b.x0)))
  const out = px.map(() => ({ walls: [] as Poly[], roofs: [] as Poly[] }))
  for (const [key, polys] of [['walls', obs.walls], ['roofs', obs.roofs]] as const) for (const poly of polys) {
    const r = pxRange([poly])
    if (!r) continue
    const inter = px.map((s) => Math.max(0, Math.min(s.x1, r.x1) - Math.max(s.x0, r.x0)))
    if (!overlapping) {
      px.forEach((s, i) => { if (inter[i] > 0.1 * (s.x1 - s.x0)) out[i][key].push(poly) })
      continue
    }
    const iou = px.map((s, i) => inter[i] / (Math.max(s.x1, r.x1) - Math.min(s.x0, r.x0)))
    const best = iou.indexOf(Math.max(...iou))
    if (iou[best] > 0.3) out[best][key].push(poly)
  }
  return out
}

/** 2. An orthogonal outline as one rectangle or two joined rectangles (both splits of an L). */
export function rectanglesOf(outline: ReadonlyArray<{ x: number; z: number }>): { splits: Rect[][]; why: string } {
  const pts = outline.filter((p, i) => {
    const a = outline[(i + outline.length - 1) % outline.length]
    const b = outline[(i + 1) % outline.length]
    return !((Math.abs(a.x - p.x) < 1e-6 && Math.abs(b.x - p.x) < 1e-6) || (Math.abs(a.z - p.z) < 1e-6 && Math.abs(b.z - p.z) < 1e-6))
  })
  const bb = rectOfOutline(pts)
  if (pts.length === 4) return { splits: [[bb]], why: 'a rectangle' }
  if (pts.length !== 6) return { splits: [], why: `an outline of ${pts.length} corners: beyond the supported scope (a rectangle or two joined bodies)` }
  // the L's notch: the bounding box's corner the outline does not reach; split along either line through the reflex vertex
  const inside = (x: number, z: number): boolean => {
    let c = false
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) if (pts[i].z > z !== pts[j].z > z && x < ((pts[j].x - pts[i].x) * (z - pts[i].z)) / (pts[j].z - pts[i].z) + pts[i].x) c = !c
    return c
  }
  const reflex = pts.find((p) => p.x > bb.minX + 1e-6 && p.x < bb.maxX - 1e-6 && p.z > bb.minZ + 1e-6 && p.z < bb.maxZ - 1e-6)
  if (!reflex) return { splits: [], why: 'an L whose inner corner could not be found' }
  const cut = (axis: 'x' | 'z'): Rect[] => {
    const parts = axis === 'x' ? [{ ...bb, maxX: reflex.x }, { ...bb, minX: reflex.x }] : [{ ...bb, maxZ: reflex.z }, { ...bb, minZ: reflex.z }]
    // each part, cut back to the outline: the side of the other line where the notch is, is outside
    return parts.map((r) => {
      const mx = (r.minX + r.maxX) / 2
      const mz = (r.minZ + r.maxZ) / 2
      if (inside(mx, mz) && inside(r.minX + 1e-3, r.minZ + 1e-3) && inside(r.maxX - 1e-3, r.maxZ - 1e-3) && inside(r.minX + 1e-3, r.maxZ - 1e-3) && inside(r.maxX - 1e-3, r.minZ + 1e-3)) return r
      return axis === 'x' ? (inside(mx, r.minZ + 1e-3) ? { ...r, maxZ: reflex.z } : { ...r, minZ: reflex.z }) : inside(r.minX + 1e-3, mz) ? { ...r, maxX: reflex.x } : { ...r, minX: reflex.x }
    })
  }
  return { splits: [cut('x'), cut('z')], why: 'an L: two joined rectangles, split at its inner corner either way' }
}

export type MassingInput = { outline: OutlineObservation; silhouettes: readonly SilhouetteObservation[]; wallThicknessM?: { value: number; prov: Prov } }

/** 3. The mass the observations support, or exactly what they lack. */
export function solveMassing(input: MassingInput): MassingHypothesis {
  const t = input.wallThicknessM?.value ?? MINIATURE_CONVENTIONS.wallThicknessM
  const base = { version: MASSING_VERSION, alternatives: [] as string[], missing: [] as MassingHypothesis['missing'], views_used: [] as MassingHypothesis['views_used'], wallThicknessM: t }
  const bb = rectOfOutline(input.outline.outline)
  const views: BindView[] = []
  const byView = new Map<Side, { obs: SilhouetteObservation; view: BindView }>()
  for (const s of input.silhouettes) {
    const reg = registerByPlan(s, extentOn(bb, s.side))
    if ('refused' in reg) {
      base.views_used.push({ side: s.side, frameId: s.frameId, used: false, why: reg.refused })
      continue
    }
    views.push(reg.view)
    byView.set(s.side, { obs: s, view: reg.view })
    base.views_used.push({ side: s.side, frameId: s.frameId, used: true, why: reg.why })
  }
  if (byView.size === 0) return { ...base, status: 'INSUFFICIENT', bodies: [], views, missing: [{ anchor: 'ELEVATION_SILHOUETTE', why: 'no elevation could be registered by the plan: no height and no roof form can be read' }], why: 'the outline alone gives a footprint, not a mass' }
  const split = rectanglesOf(input.outline.outline)
  if (split.splits.length === 0) return { ...base, status: 'UNSUPPORTED_FORM', bodies: [], views, missing: [{ anchor: 'SUPPORTED_OUTLINE', why: split.why }], why: split.why }
  // choose the split whose line an elevation steps at: a body boundary is a jump of the drawn top AT that line (a gable's
  // slope runs through it continuously); the top is read just either side of the line, on every view that shows it
  const stepAt = (rects: Rect[]): number => {
    if (rects.length < 2) return 0
    const [ra, rb] = rects
    const line: { axis: 'x' | 'z'; at: number } | undefined = Math.abs(ra.maxX - rb.minX) < 1e-6 || Math.abs(rb.maxX - ra.minX) < 1e-6 ? { axis: 'x', at: Math.abs(ra.maxX - rb.minX) < 1e-6 ? ra.maxX : rb.maxX } : Math.abs(ra.maxZ - rb.minZ) < 1e-6 || Math.abs(rb.maxZ - ra.minZ) < 1e-6 ? { axis: 'z', at: Math.abs(ra.maxZ - rb.minZ) < 1e-6 ? ra.maxZ : rb.maxZ } : undefined
    if (!line) return 0
    let score = 0
    for (const { obs, view } of byView.values()) {
      if (along(obs.side) !== line.axis) continue
      const p = view.projection
      const d = Math.max(0.1, 3 * p.mpp)
      const topAt = (a: number): number | undefined => {
        const x = pxOfAlong(p, a)
        const rows = [...obs.walls, ...obs.roofs].map((q) => columnRange(q, x)?.[0]).filter((v): v is number => v !== undefined)
        return rows.length > 0 ? yOfRow(p, Math.min(...rows)) : undefined
      }
      const l = topAt(line.at - d)
      const r = topAt(line.at + d)
      if (l !== undefined && r !== undefined && Math.abs(l - r) > MASSING_TOLERANCES.heightAgreeM) score += 1
    }
    return score
  }
  let rects = split.splits[0]
  if (split.splits.length > 1) {
    const sc = split.splits.map(stepAt)
    const best = sc[0] === sc[1] ? (Math.max(...split.splits[0].map(area)) >= Math.max(...split.splits[1].map(area)) ? 0 : 1) : sc[0] > sc[1] ? 0 : 1
    rects = split.splits[best]
    if (sc[0] === sc[1]) base.alternatives.push(`the L splits either way; no elevation steps at either line (${sc[0]} / ${sc[1]}): the split with the larger main body is taken, the other kept as an alternative`)
    else base.alternatives.push(`the L's other split (${sc[1 - best]} elevation steps against ${sc[best]}) is kept as an alternative`)
  }
  const total = area(bb)
  rects = rects.filter((r) => area(r) >= MASSING_TOLERANCES.minWingShare * total && r.maxX - r.minX >= MASSING_TOLERANCES.minBodyM && r.maxZ - r.minZ >= MASSING_TOLERANCES.minBodyM)
  rects.sort((a, b) => area(b) - area(a))
  const bodies: BodySpec[] = []
  for (const [i, rect] of rects.entries()) {
    const id = i === 0 ? 'mass-main' : `mass-wing-${i}`
    const reads: Array<{ side: Side; p: NonNullable<ReturnType<typeof profileOver>> }> = []
    for (const { obs, view } of byView.values()) {
      const e = extentOn(rect, obs.side)
      // a body hidden behind another on this side (its whole stretch inside the other's, and further back) is not read there
      const other = rects.find((r) => r !== rect)
      if (other) {
        const eo = extentOn(other, obs.side)
        const depth = (r: Rect): number => (obs.side === 'FRONT' ? r.minZ : obs.side === 'REAR' ? -r.maxZ : obs.side === 'LEFT' ? r.minX : -r.maxX)
        if (eo.lo <= e.lo + 0.05 && eo.hi >= e.hi - 0.05 && depth(other) < depth(rect) - 0.05) continue
      }
      const p = profileOver(view, e.lo, e.hi, attribute(obs, view, rects.map((r) => extentOn(r, obs.side)))[i])
      if (p) reads.push({ side: obs.side, p })
    }
    if (reads.length === 0) {
      base.missing.push({ anchor: `HEIGHT:${id}`, why: `no registered elevation shows ${id}` })
      continue
    }
    const median = (v: number[]): number => [...v].sort((a, b) => a - b)[Math.floor((v.length - 1) / 2)]
    const top = median(reads.map((r) => r.p.topM))
    const eaves = median(reads.map((r) => r.p.eavesM))
    const spread = Math.max(...reads.map((r) => r.p.eavesM)) - Math.min(...reads.map((r) => r.p.eavesM))
    const agree = reads.length >= 2 && spread <= Math.max(MASSING_TOLERANCES.heightAgreeM, MASSING_TOLERANCES.heightAgreeShare * eaves)
    const hProv: Prov = { fidelity: agree ? 'SOURCE_DERIVED' : 'TRACE_UNCERTAIN', source: reads.map((r) => r.side).join('+'), why: `${reads.length} registered elevation(s) give eaves ${reads.map((r) => r.p.eavesM.toFixed(2)).join(' / ')} m and top ${reads.map((r) => r.p.topM.toFixed(2)).join(' / ')} m${agree ? ' (they agree)' : reads.length < 2 ? ' (one view: the vertical scale is the horizontal one, unconfirmed)' : ` (they disagree by ${spread.toFixed(2)} m)`}` }
    if (eaves < MASSING_TOLERANCES.minBodyM) {
      base.missing.push({ anchor: `HEIGHT:${id}`, why: `the elevations put ${id}'s eaves at ${eaves.toFixed(2)} m: not a storey` })
      continue
    }
    const rise = top - eaves
    let roof: RoofSpec
    let roofProv: Prov
    if (rise < MASSING_TOLERANCES.flatRiseM || reads.every((r) => r.p.shape === 'NONE')) {
      roof = { kind: 'FLAT', eavesM: r6(top) }
      roofProv = { fidelity: hProv.fidelity, source: hProv.source, why: `nothing rises more than ${MASSING_TOLERANCES.flatRiseM} m above the walls: a flat roof, its parapet at ${top.toFixed(2)} m (the plate ${MINIATURE_CONVENTIONS.parapetM} m below: DISPLAY_ASSUMPTION)` }
    } else {
      // the axis: slopes (a band) are seen on the sides along the ridge, the gable end (a triangle) on the sides across it
      const vote = { X: 0, Z: 0 }
      for (const r of reads) {
        if (r.p.shape === 'BAND') vote[along(r.side) === 'x' ? 'X' : 'Z'] += 1
        if (r.p.shape === 'TRIANGLE') vote[along(r.side) === 'x' ? 'Z' : 'X'] += 1
      }
      const trapezoids = reads.filter((r) => r.p.shape === 'TRAPEZOID').length
      if (vote.X === vote.Z) {
        base.missing.push({ anchor: `ROOF_AXIS:${id}`, why: trapezoids > 0 && vote.X === 0 ? `every elevation of ${id} shows a trapezoid: a hip roof, beyond the supported scope (gable or flat)` : `the elevations do not decide ${id}'s ridge direction (X ${vote.X} / Z ${vote.Z})` })
        if (vote.X === 0) continue
        base.alternatives.push(`${id}: ridge along X or Z (${vote.X} views each); X is taken`)
      }
      const axis: 'X' | 'Z' = vote.X >= vote.Z ? 'X' : 'Z'
      const span = axis === 'X' ? rect.maxZ - rect.minZ : rect.maxX - rect.minX
      const pitch = (Math.atan2(rise, span / 2) * 180) / Math.PI
      roof = { kind: 'GABLE', ridgeAxis: axis, pitchDeg: Math.round(pitch * 10) / 10, eavesM: r6(eaves), ridgeM: r6(top) }
      roofProv = { fidelity: vote.X !== vote.Z && hProv.fidelity === 'SOURCE_DERIVED' ? 'SOURCE_DERIVED' : 'TRACE_UNCERTAIN', source: reads.map((r) => `${r.side}:${r.p.shape}`).join(' '), why: `ridge along ${axis} (slopes seen on the sides along it, the gable end across it); pitch ${roof.pitchDeg}° from a ${rise.toFixed(2)} m rise over half of ${span.toFixed(2)} m` }
    }
    bodies.push({ id, rect: { minX: r6(rect.minX), maxX: r6(rect.maxX), minZ: r6(rect.minZ), maxZ: r6(rect.maxZ) }, roof, provenance: { outline: { fidelity: input.outline.fidelity, source: input.outline.by, why: input.outline.why }, height: hProv, roof: roofProv, wallThickness: input.wallThicknessM?.prov ?? { fidelity: 'DISPLAY_ASSUMPTION', source: 'MINIATURE', why: `${MINIATURE_CONVENTIONS.wallThicknessM} m: no wall thickness was measured` } } })
  }
  if (bodies.length === 0) return { ...base, status: 'INSUFFICIENT', bodies, views, why: `no body has its height and roof read (${base.missing.map((m) => m.anchor).join(', ')})` }
  return { ...base, status: 'BUILDABLE', bodies, views, why: `${bodies.length} body/bodies: ${bodies.map((b) => `${b.id} ${(b.rect.maxX - b.rect.minX).toFixed(2)} × ${(b.rect.maxZ - b.rect.minZ).toFixed(2)} m, ${b.roof.kind}${b.roof.ridgeAxis ? ` along ${b.roof.ridgeAxis}` : ''} eaves ${b.roof.eavesM.toFixed(2)}${b.roof.ridgeM ? ` ridge ${b.roof.ridgeM.toFixed(2)}` : ''}`).join('; ')}` }
}

/** A rectangle's sides shared with another body (a party line): where a flat plate runs to the face and bears nothing more. */
function partySides(rect: Rect, others: readonly Rect[]): { minX: boolean; maxX: boolean; minZ: boolean; maxZ: boolean } {
  const touch = (a: number, b: number): boolean => Math.abs(a - b) < 1e-3
  const overlapZ = (o: Rect): boolean => Math.min(o.maxZ, rect.maxZ) - Math.max(o.minZ, rect.minZ) > 0.1
  const overlapX = (o: Rect): boolean => Math.min(o.maxX, rect.maxX) - Math.max(o.minX, rect.minX) > 0.1
  return {
    minX: others.some((o) => touch(o.maxX, rect.minX) && overlapZ(o)),
    maxX: others.some((o) => touch(o.minX, rect.maxX) && overlapZ(o)),
    minZ: others.some((o) => touch(o.maxZ, rect.minZ) && overlapX(o)),
    maxZ: others.some((o) => touch(o.minZ, rect.maxZ) && overlapX(o)),
  }
}

/** The ring and the roof of one body, by the kernel's own commands (the same convention LOCAL emits). */
export function bodyCommands(b: BodySpec, levelId: string, levelElevation: number, others: readonly Rect[], t: number): BuildingCommand[] {
  const r = b.rect
  const ring = `ring-${b.id}`
  const polygon = [{ x: r.minX, z: r.minZ }, { x: r.maxX, z: r.minZ }, { x: r.maxX, z: r.maxZ }, { x: r.minX, z: r.maxZ }]
  const walls = [0, 1, 2, 3].map((i) => `${ring}-w${i}`)
  if (b.roof.kind === 'GABLE') {
    const ridge = (b.roof.ridgeM ?? b.roof.eavesM) - levelElevation
    return [
      { type: 'createWallRing', id: ring, levelId, polygon, thickness: t, height: r6(ridge), baseOffset: 0, kind: 'EXTERIOR', cornerOwnership: 'ALTERNATE' },
      { type: 'createRoof', id: `roof-${b.id}`, levelId, kind: 'GABLE', footprint: { ...r }, eaveOffset: r6(b.roof.eavesM - levelElevation), pitchDeg: b.roof.pitchDeg ?? 30, ridgeAxis: b.roof.ridgeAxis ?? 'X', overhang: 0, thickness: MINIATURE_CONVENTIONS.roofThicknessM, capWallIds: walls },
    ] as BuildingCommand[]
  }
  // a flat roof as the elevation draws it: the walls' top is the parapet's; the plate lies a parapet below it
  const top = b.roof.eavesM - levelElevation
  const party = partySides(r, others)
  const half = r6(t / 2)
  return [
    { type: 'createWallRing', id: ring, levelId, polygon, thickness: t, height: r6(top), baseOffset: 0, kind: 'EXTERIOR', cornerOwnership: 'ALTERNATE' },
    { type: 'createRoof', id: `roof-${b.id}`, levelId, kind: 'FLAT', footprint: { ...r }, eaveOffset: r6(top - MINIATURE_CONVENTIONS.parapetM), pitchDeg: 0, ridgeAxis: 'X', overhang: 0, thickness: MINIATURE_CONVENTIONS.flatRoofThicknessM, plateInset: { minX: party.minX ? 0 : half, maxX: party.maxX ? 0 : half, minZ: party.minZ ? 0 : half, maxZ: party.maxZ ? 0 : half } },
  ] as BuildingCommand[]
}

/** BUILD_MASSING: the whole mass from nothing (no model, or no exterior walls): one level, one ring and one roof per body. */
export function massingCommands(h: MassingHypothesis, model: CanonicalBuildingModel): BuildingCommand[] {
  const top = Math.max(...h.bodies.map((b) => (b.roof.kind === 'GABLE' ? b.roof.ridgeM ?? b.roof.eavesM : b.roof.eavesM)))
  const cmds: BuildingCommand[] = []
  if (!model.building) cmds.push({ type: 'createBuilding', id: 'building', name: 'massing' } as BuildingCommand)
  const levelId = model.levels[0]?.id ?? 'lvl-0'
  if (model.levels.length === 0) cmds.push({ type: 'createLevel', id: levelId, name: 'Massing', index: 0, elevation: 0, height: r6(top) } as BuildingCommand)
  const rects = h.bodies.map((b) => b.rect)
  for (const b of h.bodies) cmds.push(...bodyCommands(b, levelId, model.levels[0]?.elevation ?? 0, rects.filter((r) => r !== b.rect), h.wallThicknessM))
  return cmds
}

/** The bodies of a model as the kernel holds them: each exterior wall ring with the roofs and planes that stand over it. */
export type ModelBody = { id: string; ringIds: string[]; levelIds: string[]; wallIds: string[]; rect: Rect; roofIds: string[]; planeIds: string[] }
export function bodiesOf(m: CanonicalBuildingModel): ModelBody[] {
  const wallById = new Map(m.walls.map((w) => [w.id, w]))
  const rings = m.wallRings.map((r) => ({ id: r.id, levelId: r.levelId, walls: r.wallIds.map((id) => wallById.get(id)).filter((w): w is Wall => !!w && w.kind === 'EXTERIOR') })).filter((r) => r.walls.length > 0)
  const rectOf = (ws: Wall[]): Rect => ({ minX: Math.min(...ws.flatMap((w) => [w.start.x, w.end.x])), maxX: Math.max(...ws.flatMap((w) => [w.start.x, w.end.x])), minZ: Math.min(...ws.flatMap((w) => [w.start.z, w.end.z])), maxZ: Math.max(...ws.flatMap((w) => [w.start.z, w.end.z])) })
  // rings of different storeys over one footprint are one body
  const bodies: ModelBody[] = []
  for (const r of rings) {
    const rect = rectOf(r.walls)
    const same = bodies.find((b) => Math.abs(b.rect.minX - rect.minX) < 0.15 && Math.abs(b.rect.maxX - rect.maxX) < 0.15 && Math.abs(b.rect.minZ - rect.minZ) < 0.15 && Math.abs(b.rect.maxZ - rect.maxZ) < 0.15)
    if (same) {
      same.ringIds.push(r.id)
      same.levelIds.push(r.levelId)
      same.wallIds.push(...r.walls.map((w) => w.id))
    } else bodies.push({ id: r.id, ringIds: [r.id], levelIds: [r.levelId], wallIds: r.walls.map((w) => w.id), rect, roofIds: [], planeIds: [] })
  }
  const contains = (b: Rect, x: number, z: number): boolean => x >= b.minX - 0.05 && x <= b.maxX + 0.05 && z >= b.minZ - 0.05 && z <= b.maxZ + 0.05
  const smallest = (x: number, z: number): ModelBody | undefined => bodies.filter((b) => contains(b.rect, x, z)).sort((a, b) => area(a.rect) - area(b.rect))[0]
  // a roof or a group of touching planes over no ring is a body of its own (a model of roofs without walls still has
  // its bodies counted, not its roofs)
  const orphans: Array<{ rect: Rect; roofIds: string[]; planeIds: string[] }> = []
  const touches = (a: Rect, b: Rect): boolean => a.minX <= b.maxX + 0.05 && b.minX <= a.maxX + 0.05 && a.minZ <= b.maxZ + 0.05 && b.minZ <= a.maxZ + 0.05
  const adopt = (rect: Rect, roofId?: string, planeId?: string): void => {
    const o = planeId ? orphans.find((x) => x.planeIds.length > 0 && touches(x.rect, rect)) : undefined
    if (o) {
      o.rect = { minX: Math.min(o.rect.minX, rect.minX), maxX: Math.max(o.rect.maxX, rect.maxX), minZ: Math.min(o.rect.minZ, rect.minZ), maxZ: Math.max(o.rect.maxZ, rect.maxZ) }
      if (planeId) o.planeIds.push(planeId)
      return
    }
    orphans.push({ rect, roofIds: roofId ? [roofId] : [], planeIds: planeId ? [planeId] : [] })
  }
  for (const roof of m.roofs) {
    const b = smallest((roof.footprint.minX + roof.footprint.maxX) / 2, (roof.footprint.minZ + roof.footprint.maxZ) / 2)
    if (b) b.roofIds.push(roof.id)
    else adopt({ ...roof.footprint }, roof.id)
  }
  for (const pl of m.roofPlanes) {
    const pts = pl.boundary
    if (pts.length === 0) continue
    const b = smallest(pts.reduce((a, p) => a + p.x, 0) / pts.length, pts.reduce((a, p) => a + p.z, 0) / pts.length)
    if (b) b.planeIds.push(pl.id)
    else adopt({ minX: Math.min(...pts.map((p) => p.x)), maxX: Math.max(...pts.map((p) => p.x)), minZ: Math.min(...pts.map((p) => p.z)), maxZ: Math.max(...pts.map((p) => p.z)) }, undefined, pl.id)
  }
  for (const [i, o] of orphans.entries()) bodies.push({ id: `roofed-${i}`, ringIds: [], levelIds: [], wallIds: [], rect: o.rect, roofIds: o.roofIds, planeIds: o.planeIds })
  return bodies
}
