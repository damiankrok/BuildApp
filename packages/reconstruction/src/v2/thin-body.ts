/**
 * N7-P2R: an attached body read narrower than its own two walls, adjudicated on the source before it is given up.
 *
 * A ring builds four walls of the house's thickness T inside its rectangle. A body narrower than 2T puts two of them —
 * w1 and w3, or w0 and w2 — in the same plan band, and the model refuses the ring (WALLS_OVERLAP). The refusal is where
 * the run stops, not where the reading went wrong. Several readings of the plan make such a body, and each says
 * something different about the house:
 *
 *   - WIDEN: the body is wider than read. The cells stopped short; the drawing has its far wall further out, with the
 *     body's interior between, and a printed chain or a registered elevation says so too.
 *   - SHARED_WALL: the width is right, and the plan draws ONE wall between the two bodies (the other body's) and the
 *     body's own far wall, with interior between them. Building a wall of its own on the shared side as well is what
 *     overlaps: the body is built with its other three walls.
 *   - DRAWN_THIN_WALLS: the plan draws the body's two long walls, each thinner than the house's T, with interior
 *     between: the ring is built at the thickness drawn, not at the house's.
 *   - SOLID_WALL: the band is ink right across — a thick wall or a wall's thickening, not an enclosed space: it is
 *     built as one wall of its drawn thickness.
 *   - CANOPY_ON_POSTS, FALSE_STRIP, RECESS_OF_MAIN: read and named, never built here: posts, a line the cells took for a
 *     wall, a piece of the main body.
 *
 * Every reading is tested on the drawing itself: the plan's ink across the band (a profile in metres, from the face it
 * shares outward), the printed chains that end on its faces, and the registered elevations that see it side on. A body
 * is changed only when exactly one of the buildable readings holds and nothing printed contradicts it; a printed
 * dimension that ends on the body's face and disagrees with the drawing is a conflict, and the body is left to the
 * partial preview (N7-P1) with every reading recorded. Pure: pixels and numbers in, a decision out.
 */
import { round6 } from '@buildapp/source-common'
import type { Raster } from '@buildapp/source-cv'
import type { DimensionChain } from '@buildapp/source-metrics'
import type { MassV2 } from './building.js'
import type { ElevationFrameV2, PlanFrameV2 } from './frame.js'

export type ThinBodyFacade = 'FRONT' | 'EAST' | 'REAR' | 'WEST'
export type ThinBodyHypothesisKind = 'WIDEN' | 'SHARED_WALL' | 'DRAWN_THIN_WALLS' | 'SOLID_WALL' | 'CANOPY_ON_POSTS' | 'FALSE_STRIP' | 'RECESS_OF_MAIN'
export type ThinBodyDecisionKind = 'WIDEN' | 'SHARED_WALL' | 'DRAWN_THIN_WALLS' | 'SOLID_WALL' | 'KEEP_PARTIAL'

export type ThinBodyRecord = {
  massId: string
  storeyIndex: number
  /** The axis across the band: X when the body is too narrow in x (its east and west walls collide). */
  narrowAxis: 'X' | 'Z'
  rectM: { x0: number; z0: number; x1: number; z1: number }
  rectPx?: { x0: number; y0: number; x1: number; y1: number }
  narrowM: number
  longM: number
  wallThicknessM: number
  /** The plan area the two colliding walls would share. */
  predictedOverlapM2: number
  planFrameId?: string
  /** How the body came to be: the layout's own account of it. */
  source: { why: string; widthBasis: string; evidenceIds: string[] }
  /** The face it shares with another body, and that body. */
  shared?: { facade: ThinBodyFacade; withMassId: string }
  /** The plan's ink across the band: share of the long-axis samples that are ink, binned outward from the shared face. */
  profile?: { samples: number; stepM: number; fromS: number; bands: Array<{ fromS: number; toS: number }>; solidShare: number; farEdgeInk: number }
  chains: Array<{ chainId: string; valueCm: number; from: number; to: number; role: 'CORROBORATES' | 'WIDENS' | 'CONFLICTS' | 'UNRELATED'; why: string }>
  elevations: Array<{ frameId: string; side: string; over: [number, number]; builtShare: number; verdict: 'CORROBORATES' | 'CONTRADICTS' | 'NOT_DECISIVE' }>
  hypotheses: Array<{ kind: ThinBodyHypothesisKind; status: 'SUPPORTED' | 'REFUTED' | 'NO_EVIDENCE'; why: string }>
  /** Where the reading that made the ring fail was taken. */
  firstBad: string
  decision: { kind: ThinBodyDecisionKind; why: string; before: { x0: number; z0: number; x1: number; z1: number }; after?: { x0: number; z0: number; x1: number; z1: number }; openSide?: ThinBodyFacade; wallThicknessM?: number }
}

/** A band of ink across the plan, in metres outward from the shared face. */
type Band = { fromS: number; toS: number }

/** Plan ink: darker than this luma. The same threshold the outer faces are found with. */
export const THIN_BODY_INK_LUMA = 90
/** A position is wall when this share of the samples along the band is ink there (openings break a wall) … */
export const BAND_INK_SHARE = 0.6
/** … and paper when no more than this share is. */
export const PAPER_INK_SHARE = 0.2
/** How far past the read face the drawn far wall of a body read too narrow is looked for. */
export const WIDEN_SEARCH_M = 8
/** An elevation corroborates a built extent when this share of its storey band is not sky; contradicts at or under the second. */
export const ELEVATION_BUILT = 0.6
export const ELEVATION_EMPTY = 0.2

const facadeOfFace = (axis: 'X' | 'Z', low: boolean): ThinBodyFacade => (axis === 'X' ? (low ? 'WEST' : 'EAST') : low ? 'FRONT' : 'REAR')

export type ThinBodyInput = {
  masses: readonly MassV2[]
  wallThicknessM: number
  /** The layout's account of each body, by its 03R id. */
  sourceOf: (sourceMassId: string) => { why: string; widthBasis: string; evidenceIds: string[] } | undefined
  plan: (storeyIndex: number) => { frame: PlanFrameV2; raster: Raster } | undefined
  chains: readonly DimensionChain[]
  views: ReadonlyArray<{ view: ElevationFrameV2; raster: Raster }>
  /** The sky of an elevation raster (1 = sky). */
  skyOf: (raster: Raster) => { data: Uint8Array; width: number }
  levels: ReadonlyArray<{ index: number; elevation: number; wallTop: number }>
}

const overlap1 = (a0: number, a1: number, b0: number, b1: number): number => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))

/** The bodies that would be refused for their own walls overlapping: narrower than two walls on some axis. */
export function thinBodies(masses: readonly MassV2[], T: number): Array<{ mass: MassV2; axis: 'X' | 'Z' }> {
  const out: Array<{ mass: MassV2; axis: 'X' | 'Z' }> = []
  for (const m of masses) {
    if (m.role !== 'ATTACHED' || m.pieceOf || m.storeyRects?.length) continue
    const w = m.x1 - m.x0
    const d = m.z1 - m.z0
    if (Math.min(w, d) >= 2 * T - 1e-6) continue
    out.push({ mass: m, axis: w <= d ? 'X' : 'Z' })
  }
  return out
}

/** Adjudicate one thin body on the source. */
export function adjudicateThinBody(mass: MassV2, axis: 'X' | 'Z', input: ThinBodyInput): ThinBodyRecord {
  const T = input.wallThicknessM
  const storey = Math.min(...mass.storeys)
  const lo = axis === 'X' ? mass.x0 : mass.z0
  const hi = axis === 'X' ? mass.x1 : mass.z1
  const along0 = axis === 'X' ? mass.z0 : mass.x0
  const along1 = axis === 'X' ? mass.z1 : mass.x1
  const narrow = round6(hi - lo)
  const long = round6(along1 - along0)
  const tol = Math.max(0.12, 0.5 * T)
  const rect = { x0: mass.x0, z0: mass.z0, x1: mass.x1, z1: mass.z1 }
  const others = input.masses.filter((m) => m.id !== mass.id && m.storeys.some((s) => mass.storeys.includes(s)))
  // the face it shares: another body's opposite face within tolerance, overlapping along the band
  const otherAlong = (m: MassV2): [number, number] => (axis === 'X' ? [m.z0, m.z1] : [m.x0, m.x1])
  const atLow = others.find((m) => Math.abs((axis === 'X' ? m.x1 : m.z1) - lo) <= tol && overlap1(...otherAlong(m), along0, along1) > 0.5 * long)
  const atHigh = others.find((m) => Math.abs((axis === 'X' ? m.x0 : m.z0) - hi) <= tol && overlap1(...otherAlong(m), along0, along1) > 0.5 * long)
  const sharedLow = atLow ? true : atHigh ? false : undefined
  const near = sharedLow === false ? hi : lo
  const dir = sharedLow === false ? -1 : 1
  const worldOf = (s: number): number => near + dir * s
  const record: ThinBodyRecord = {
    massId: mass.id,
    storeyIndex: storey,
    narrowAxis: axis,
    rectM: rect,
    narrowM: narrow,
    longM: long,
    wallThicknessM: T,
    predictedOverlapM2: round6(Math.max(0, 2 * T - narrow) * Math.max(0, long - 2 * T)),
    source: input.sourceOf(mass.sourceMassId) ?? { why: 'not recorded', widthBasis: 'UNKNOWN', evidenceIds: [] },
    ...(sharedLow !== undefined ? { shared: { facade: facadeOfFace(axis, sharedLow), withMassId: (sharedLow ? atLow : atHigh)!.id } } : {}),
    chains: [],
    elevations: [],
    hypotheses: [],
    firstBad: 'UNDETERMINED',
    decision: { kind: 'KEEP_PARTIAL', why: '', before: rect },
  }
  const plan = input.plan(storey)
  if (!plan) {
    record.decision.why = 'no registered plan of the storey the body was read on: nothing to adjudicate it against'
    record.hypotheses.push(...(['WIDEN', 'SHARED_WALL', 'DRAWN_THIN_WALLS', 'SOLID_WALL', 'CANOPY_ON_POSTS', 'FALSE_STRIP', 'RECESS_OF_MAIN'] as const).map((kind) => ({ kind, status: 'NO_EVIDENCE' as const, why: 'no plan' })))
    return record
  }
  const { frame, raster } = plan
  record.planFrameId = frame.frameId
  const p0 = frame.toPixel(mass.x0, mass.z0)
  const p1 = frame.toPixel(mass.x1, mass.z1)
  record.rectPx = { x0: round6(Math.min(p0.x, p1.x)), y0: round6(Math.min(p0.y, p1.y)), x1: round6(Math.max(p0.x, p1.x)), y1: round6(Math.max(p0.y, p1.y)) }

  // --- the profile: the share of samples along the band that are ink, outward from the shared face ---------------
  const mpp = axis === 'X' ? frame.mppX : frame.mppY
  const step = round6(Math.max(0.01, mpp / 2))
  const fromS = -(T + 0.3)
  const toS = narrow + WIDEN_SEARCH_M
  const inner0 = along0 + Math.min(T + 0.15, long / 4)
  const inner1 = along1 - Math.min(T + 0.15, long / 4)
  const nSamples = 21
  const alongs = Array.from({ length: nSamples }, (_, k) => inner0 + ((inner1 - inner0) * (k + 0.5)) / nSamples)
  const ink = (x: number, z: number): boolean => {
    const p = frame.toPixel(x, z)
    const px = Math.round(p.x)
    const py = Math.round(p.y)
    if (px < 0 || py < 0 || px >= raster.width || py >= raster.height) return false
    const o = (py * raster.width + px) * 4
    return 0.299 * raster.data[o] + 0.587 * raster.data[o + 1] + 0.114 * raster.data[o + 2] < THIN_BODY_INK_LUMA
  }
  const bins = Math.ceil((toS - fromS) / step)
  const share = new Float64Array(bins)
  for (let i = 0; i < bins; i += 1) {
    const c = worldOf(fromS + (i + 0.5) * step)
    let n = 0
    for (const a of alongs) if (axis === 'X' ? ink(c, a) : ink(a, c)) n += 1
    share[i] = n / alongs.length
  }
  const sOf = (i: number): number => round6(fromS + i * step)
  const bands: Band[] = []
  for (let i = 0; i < bins; i += 1) {
    if (share[i] < BAND_INK_SHARE) continue
    let j = i
    while (j + 1 < bins && share[j + 1] >= BAND_INK_SHARE) j += 1
    if ((j - i + 1) * step >= 0.04) bands.push({ fromS: sOf(i), toS: sOf(j + 1) })
    i = j
  }
  const meanOver = (s0: number, s1: number): number => {
    const i0 = Math.max(0, Math.floor((s0 - fromS) / step))
    const i1 = Math.min(bins - 1, Math.ceil((s1 - fromS) / step) - 1)
    if (i1 < i0) return 0
    let t = 0
    for (let i = i0; i <= i1; i += 1) t += share[i]
    return t / (i1 - i0 + 1)
  }
  const inkShareOver = (s0: number, s1: number): number => {
    const i0 = Math.max(0, Math.floor((s0 - fromS) / step))
    const i1 = Math.min(bins - 1, Math.ceil((s1 - fromS) / step) - 1)
    if (i1 < i0) return 0
    let t = 0
    for (let i = i0; i <= i1; i += 1) if (share[i] >= BAND_INK_SHARE) t += 1
    return t / (i1 - i0 + 1)
  }
  const solidShare = round6(inkShareOver(0, narrow))
  const farEdgeInk = round6(meanOver(narrow - Math.min(0.3, narrow / 2), narrow))
  record.profile = { samples: alongs.length, stepM: step, fromS: round6(fromS), bands, solidShare, farEdgeInk }

  const farBand = bands.find((b) => Math.abs(b.toS - narrow) <= tol && b.fromS > 0.02)
  // the band across the shared face: one wall's thickness is the other body's wall alone (its face read a little off);
  // more is that wall and one of the band's own drawn against it
  const nearBand = bands.find((b) => b.fromS <= tol && b.toS >= -tol && b !== farBand)
  const nearOwn = nearBand ? round6(nearBand.toS - nearBand.fromS - T) : 0
  const sharedFaceS = nearBand ? (nearOwn > 0.4 * T ? round6(nearBand.toS - nearOwn) : nearBand.toS) : 0
  const nearInner = nearBand && nearOwn > 0.4 * T && nearBand.toS < narrow - 0.05 ? { fromS: sharedFaceS, toS: nearBand.toS } : undefined
  const beyond = bands.find((b) => b.fromS > narrow + 0.05)
  const paperBetween = (s0: number, s1: number): boolean => s1 - s0 >= 0.05 && meanOver(s0, s1) <= PAPER_INK_SHARE

  // --- printed chains on the band's axis: what they say about its width ----------------------------------------------
  const otherFaces = others.flatMap((m) => (axis === 'X' ? [m.x0, m.x1] : [m.z0, m.z1]))
  for (const c of input.chains) {
    if (c.frameId !== frame.frameId || c.axis !== (axis === 'X' ? 'HORIZONTAL' : 'VERTICAL')) continue
    for (const seg of c.segments) {
      if (seg.valueCm === undefined || !seg.evidenceId) continue
      const at = (px: number): number => (axis === 'X' ? frame.toWorld(px, frame.originPx.y).x : frame.toWorld(frame.originPx.x, px).z)
      const a = round6(Math.min(at(seg.fromPx), at(seg.toPx)))
      const b = round6(Math.max(at(seg.fromPx), at(seg.toPx)))
      const value = seg.valueCm / 100
      const nearEnd = Math.abs(a - near) <= tol ? a : Math.abs(b - near) <= tol ? b : undefined
      const farFace = near + dir * narrow
      const farEnd = Math.abs(a - farFace) <= tol ? a : Math.abs(b - farFace) <= tol ? b : undefined
      if (nearEnd === undefined && farEnd === undefined) continue
      if (nearEnd !== undefined && farEnd !== undefined) {
        record.chains.push({ chainId: c.id, valueCm: seg.valueCm, from: a, to: b, role: Math.abs(value - narrow) <= tol ? 'CORROBORATES' : 'CONFLICTS', why: `ends on both faces of the band and prints ${seg.valueCm} cm against the ${narrow.toFixed(2)} m read` })
        continue
      }
      const other = nearEnd !== undefined ? (nearEnd === a ? b : a) : farEnd === a ? b : a
      const otherS = dir * (other - near)
      if (otherFaces.some((f) => Math.abs(f - other) <= tol)) {
        record.chains.push({ chainId: c.id, valueCm: seg.valueCm, from: a, to: b, role: 'UNRELATED', why: 'its other end is another body’s face: it measures more than this body' })
        continue
      }
      // a segment from the shared face outward, past the read far face, to a wall the plan draws there: the body is wider
      const onBand = bands.find((x) => Math.abs(x.toS - otherS) <= tol)
      if (nearEnd !== undefined && otherS > narrow + tol && onBand) {
        record.chains.push({ chainId: c.id, valueCm: seg.valueCm, from: a, to: b, role: 'WIDENS', why: `runs from the shared face to a wall the plan draws ${otherS.toFixed(2)} m out, printed ${seg.valueCm} cm` })
        continue
      }
      if (Math.abs(value - narrow) > tol) record.chains.push({ chainId: c.id, valueCm: seg.valueCm, from: a, to: b, role: 'CONFLICTS', why: `ends on the band's ${nearEnd !== undefined ? 'shared' : 'far'} face and prints ${seg.valueCm} cm, but its other end (${other.toFixed(2)} m) is on no wall the plan draws: the drawing and its dimension disagree` })
    }
  }
  const conflicts = record.chains.filter((c) => c.role === 'CONFLICTS')
  const widens = record.chains.find((c) => c.role === 'WIDENS')

  // --- elevations that see the band side on ----------------------------------------------------------------------
  const top = Math.min(...mass.storeys.map((s) => input.levels.find((l) => l.index === s)?.wallTop ?? Infinity))
  const floor = input.levels.find((l) => l.index === storey)?.elevation ?? 0
  const viewsSeeing = input.views.filter((v) => (axis === 'X' ? v.view.side === 'FRONT' || v.view.side === 'REAR' : v.view.side === 'LEFT' || v.view.side === 'RIGHT'))
  const elevationOver = (s0: number, s1: number): ThinBodyRecord['elevations'] => {
    const w0 = Math.min(worldOf(s0), worldOf(s1))
    const w1 = Math.max(worldOf(s0), worldOf(s1))
    const out: ThinBodyRecord['elevations'] = []
    if (!Number.isFinite(top) || top - floor < 0.8) return out
    for (const v of viewsSeeing) {
      const sky = input.skyOf(v.raster)
      const c0 = Math.round(Math.min(v.view.pxOf(w0), v.view.pxOf(w1)))
      const c1 = Math.round(Math.max(v.view.pxOf(w0), v.view.pxOf(w1)))
      const r0 = Math.round(v.view.pyOf(top - 0.3))
      const r1 = Math.round(v.view.pyOf(floor + 0.3))
      let n = 0
      let built = 0
      for (let y = Math.max(0, r0); y <= Math.min(v.raster.height - 1, r1); y += 1) {
        for (let x = Math.max(0, c0 + 1); x <= Math.min(v.raster.width - 1, c1 - 1); x += 1) {
          n += 1
          if (!sky.data[y * sky.width + x]) built += 1
        }
      }
      if (n < 20) continue
      const builtShare = round6(built / n)
      out.push({ frameId: v.view.registration.frameId, side: v.view.side, over: [round6(w0), round6(w1)], builtShare, verdict: builtShare >= ELEVATION_BUILT ? 'CORROBORATES' : builtShare <= ELEVATION_EMPTY ? 'CONTRADICTS' : 'NOT_DECISIVE' })
    }
    return out
  }

  // --- the readings ---------------------------------------------------------------------------------------------
  const H = (kind: ThinBodyHypothesisKind, status: 'SUPPORTED' | 'REFUTED' | 'NO_EVIDENCE', why: string): void => {
    record.hypotheses.push({ kind, status, why })
  }
  const shared = sharedLow !== undefined
  // WIDEN: no wall where the read far face is; paper beyond it; a wall drawn further out; corroborated in print or in view
  let widenTo: number | undefined
  if (!shared) H('WIDEN', 'NO_EVIDENCE', 'the band shares no face with another body: there is no side it could have stopped short on')
  else if (farBand) H('WIDEN', 'REFUTED', `the plan draws a wall at the read far face (${farBand.fromS.toFixed(2)}..${farBand.toS.toFixed(2)} m out): the body ends there`)
  else if (!beyond) H('WIDEN', 'REFUTED', `no wall is drawn within ${WIDEN_SEARCH_M} m beyond the read far face`)
  else if (!paperBetween(narrow, beyond.fromS)) H('WIDEN', 'REFUTED', `between the read far face and the next wall drawn (${beyond.fromS.toFixed(2)} m out) the plan is not paper: not one interior`)
  else {
    const target = widens ? Math.min(beyond.toS + tol, Math.max(beyond.toS - tol, widens.valueCm / 100)) : beyond.toS
    const widened = { x0: rect.x0, z0: rect.z0, x1: rect.x1, z1: rect.z1 }
    if (axis === 'X') {
      if (dir > 0) widened.x1 = round6(near + target)
      else widened.x0 = round6(near - target)
    } else if (dir > 0) widened.z1 = round6(near + target)
    else widened.z0 = round6(near - target)
    const collides = others.find((m) => overlap1(m.x0, m.x1, widened.x0, widened.x1) > 0.05 && overlap1(m.z0, m.z1, widened.z0, widened.z1) > 0.05)
    const views = elevationOver(narrow, target)
    record.elevations.push(...views)
    if (collides) H('WIDEN', 'REFUTED', `widened to ${target.toFixed(2)} m it would stand in ${collides.id}`)
    else if (views.some((v) => v.verdict === 'CONTRADICTS')) H('WIDEN', 'REFUTED', `the ${views.filter((v) => v.verdict === 'CONTRADICTS').map((v) => v.side.toLowerCase()).join(' and ')} elevation shows nothing built over the widened part`)
    else if (!widens && !views.some((v) => v.verdict === 'CORROBORATES')) H('WIDEN', 'NO_EVIDENCE', `the plan draws a wall ${beyond.toS.toFixed(2)} m out with paper between, but no printed chain measures it and no registered elevation shows it built`)
    else {
      widenTo = target
      H('WIDEN', 'SUPPORTED', `the read far face has no wall; the plan draws one ${beyond.fromS.toFixed(2)}..${beyond.toS.toFixed(2)} m out with the body's interior between${widens ? `, and a printed ${widens.valueCm} cm chain runs from the shared face to it` : ''}${views.some((v) => v.verdict === 'CORROBORATES') ? `; the ${views.filter((v) => v.verdict === 'CORROBORATES').map((v) => v.side.toLowerCase()).join(' and ')} elevation shows it built` : ''}`)
    }
  }
  // SHARED_WALL: the far wall drawn at the read face, interior between it and the other body's wall, no second wall of its own
  if (!shared) H('SHARED_WALL', 'NO_EVIDENCE', 'the band shares no face with another body')
  else if (!farBand) H('SHARED_WALL', 'REFUTED', 'no wall is drawn at the read far face')
  else if (nearInner) H('SHARED_WALL', 'REFUTED', `the plan draws a wall of the band's own on the shared side (${nearInner.fromS.toFixed(2)}..${nearInner.toS.toFixed(2)} m)`)
  else if (narrow - T < 0.05) H('SHARED_WALL', 'REFUTED', `${narrow.toFixed(2)} m leaves no interior behind one ${T.toFixed(2)} m wall`)
  else if (!paperBetween(Math.max(0.03, sharedFaceS + 0.02), farBand.fromS)) H('SHARED_WALL', 'REFUTED', 'between the shared wall and the far wall the plan is not paper')
  else H('SHARED_WALL', 'SUPPORTED', `the plan draws one wall between the bodies${nearBand ? ` (${nearBand.fromS.toFixed(2)}..${nearBand.toS.toFixed(2)} m, one wall's thickness)` : ''} and the band's far wall ${farBand.fromS.toFixed(2)}..${farBand.toS.toFixed(2)} m out, with paper between: the body has three walls of its own`)
  // DRAWN_THIN_WALLS: both long walls drawn inside the band, each thinner than T, with interior between
  let drawnT: number | undefined
  if (!nearInner || !farBand) H('DRAWN_THIN_WALLS', 'REFUTED', !nearInner ? 'no wall of the band’s own is drawn on its shared side' : 'no wall is drawn at the read far face')
  else {
    const tn = nearInner.toS - nearInner.fromS
    const tf = farBand.toS - farBand.fromS
    const t = round6(Math.max(tn, tf))
    if (t >= 0.85 * T || t < 0.05) H('DRAWN_THIN_WALLS', 'REFUTED', `the walls are drawn ${tn.toFixed(2)} and ${tf.toFixed(2)} m thick: not thinner than the house's ${T.toFixed(2)} m`)
    else if (!paperBetween(nearInner.toS, farBand.fromS) || farBand.fromS - nearInner.toS < 0.1) H('DRAWN_THIN_WALLS', 'REFUTED', 'no interior is drawn between the two walls')
    else {
      drawnT = t
      H('DRAWN_THIN_WALLS', 'SUPPORTED', `both long walls are drawn inside the band, ${tn.toFixed(2)} and ${tf.toFixed(2)} m thick, with interior between`)
    }
  }
  // SOLID_WALL: ink right across the band
  if (solidShare >= 0.85) H('SOLID_WALL', 'SUPPORTED', `${(solidShare * 100).toFixed(0)} % of the band is drawn as wall across its width: a thick wall, not an enclosed space`)
  else H('SOLID_WALL', 'REFUTED', `only ${(solidShare * 100).toFixed(0)} % of the band is drawn as wall across its width`)
  // never built here, but named
  if (!farBand && farEdgeInk > 0.05 && farEdgeInk < 0.45 && !beyond) H('CANOPY_ON_POSTS', 'SUPPORTED', `the far face is drawn intermittently (${(farEdgeInk * 100).toFixed(0)} % ink): posts or a parapet, not a wall — not built by this pass`)
  else H('CANOPY_ON_POSTS', 'REFUTED', farBand ? 'the far face is a continuous drawn wall' : 'no intermittent ink at the far face')
  if (!farBand && !beyond && farEdgeInk <= 0.05) H('FALSE_STRIP', 'SUPPORTED', 'the plan draws nothing at the read far face nor beyond it: a strip the cells took for a body — not removed by this pass')
  else H('FALSE_STRIP', 'REFUTED', 'the plan draws a wall at or beyond the read far face')
  const inside = others.find((m) => m.role === 'MAIN' && overlap1(m.x0, m.x1, rect.x0, rect.x1) > 0.5 * (rect.x1 - rect.x0) && overlap1(m.z0, m.z1, rect.z0, rect.z1) > 0.5 * (rect.z1 - rect.z0))
  H('RECESS_OF_MAIN', inside ? 'SUPPORTED' : 'REFUTED', inside ? `it lies inside ${inside.id}` : 'it stands outside the main body’s walls')

  // --- the decision -------------------------------------------------------------------------------------------------
  const buildable = record.hypotheses.filter((h) => h.status === 'SUPPORTED' && (h.kind === 'WIDEN' || h.kind === 'SHARED_WALL' || h.kind === 'DRAWN_THIN_WALLS' || h.kind === 'SOLID_WALL'))
  if (conflicts.length > 0) {
    record.decision.why = `printed and drawn disagree: ${conflicts.map((c) => `${c.valueCm} cm (${c.why})`).join('; ')} — the body is left to the partial preview`
    record.firstBad = 'SOURCE_CONFLICT: a printed dimension on the band contradicts its drawn width'
    return record
  }
  if (buildable.length !== 1) {
    record.decision.why = buildable.length === 0 ? 'no buildable reading holds on the drawing — the body is left to the partial preview' : `${buildable.map((h) => h.kind).join(' and ')} both hold: the drawing does not decide between them — the body is left to the partial preview`
    return record
  }
  const pick = buildable[0].kind
  // an elevation that sees the band and shows nothing built there stops any reading that builds it
  if (pick !== 'WIDEN') record.elevations.push(...elevationOver(0, narrow))
  const against = record.elevations.filter((e) => e.verdict === 'CONTRADICTS')
  if (pick !== 'WIDEN' && against.length > 0) {
    record.decision.why = `${pick} holds on the plan, but the ${against.map((e) => e.side.toLowerCase()).join(' and ')} elevation shows nothing built over the band — the body is left to the partial preview`
    return record
  }
  if (pick === 'WIDEN' && widenTo !== undefined) {
    const after = { ...rect }
    if (axis === 'X') {
      if (dir > 0) after.x1 = round6(near + widenTo)
      else after.x0 = round6(near - widenTo)
    } else if (dir > 0) after.z1 = round6(near + widenTo)
    else after.z0 = round6(near - widenTo)
    record.firstBad = `PLAN_DECOMPOSITION: the body's width was read as ${narrow.toFixed(2)} m (${record.source.widthBasis.toLowerCase()}), stopping at a face the plan draws no wall on`
    record.decision = { kind: 'WIDEN', why: `${buildable[0].why}: widened to ${widenTo.toFixed(2)} m`, before: rect, after }
  } else if (pick === 'SHARED_WALL' && record.shared) {
    record.firstBad = 'EMISSION: a ring builds a wall of its own on the side the plan draws one wall for both bodies; at this width that wall meets the far one'
    record.decision = { kind: 'SHARED_WALL', why: buildable[0].why, before: rect, after: rect, openSide: record.shared.facade }
  } else if (pick === 'DRAWN_THIN_WALLS' && drawnT !== undefined) {
    record.firstBad = `EMISSION: the house's ${T.toFixed(2)} m wall was given to a body the plan draws with ${drawnT.toFixed(2)} m walls`
    record.decision = { kind: 'DRAWN_THIN_WALLS', why: buildable[0].why, before: rect, after: rect, wallThicknessM: drawnT }
  } else if (pick === 'SOLID_WALL') {
    record.firstBad = 'STRUCTURAL_LAYOUT: a band the plan draws solid was read as an enclosed body'
    record.decision = { kind: 'SOLID_WALL', why: buildable[0].why, before: rect, after: rect, wallThicknessM: narrow }
  } else record.decision.why = `${pick} holds but cannot be built here`
  return record
}
