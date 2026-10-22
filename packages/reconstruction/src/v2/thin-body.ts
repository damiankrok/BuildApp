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
  profile?: { samples: number; stepM: number; fromS: number; bands: Array<{ fromS: number; toS: number }>; solidShare: number; farEdgeInk: number; farWall?: FarWallReading }
  chains: Array<{ chainId: string; valueCm: number; from: number; to: number; role: 'CORROBORATES' | 'WIDENS' | 'CONFLICTS' | 'UNRELATED'; why: string }>
  elevations: Array<{ frameId: string; side: string; over: [number, number]; builtShare: number; verdict: 'CORROBORATES' | 'CONTRADICTS' | 'NOT_DECISIVE'; edges?: { far: number; top: number }; why?: string }>
  hypotheses: Array<{ kind: ThinBodyHypothesisKind; status: 'SUPPORTED' | 'REFUTED' | 'NO_EVIDENCE'; why: string }>
  /** Where the reading that made the ring fail was taken. */
  firstBad: string
  decision: { kind: ThinBodyDecisionKind; why: string; before: { x0: number; z0: number; x1: number; z1: number }; after?: { x0: number; z0: number; x1: number; z1: number }; openSide?: ThinBodyFacade; wallThicknessM?: number }
}

/** A band of ink across the plan, in metres outward from the shared face. */
type Band = { fromS: number; toS: number }

/**
 * N7-FIX-01 (F-R1): the body's far face read along its length, as a wall with openings or as something else. A plan
 * draws a window, a door or a gate as a gap between two pieces of masonry on the wall's line: a wall broken by two
 * 1 m windows is ink over less than 60 % of its length and is still a wall. A gap closes the wall only where the source
 * says it is an opening — the plan draws a line across it inside the wall's thickness (glazing, a sill) or a printed
 * chain measures it from jamb to jamb. A gap between posts says neither; posts are pieces about as long as they are
 * thick; a wall that stops is a gap reaching the body's end. None of those is closed here.
 */
export type FarWallReading = {
  /** The line read, in metres outward from the shared face. */
  fromS: number
  toS: number
  /** Share of the face's length that is masonry across the line's thickness. */
  pieceShare: number
  /** The masonry along the face and the gaps between, in metres from the body's along start. */
  pieces: Array<[number, number]>
  /** Each gap with what the source says of it: a line the plan draws across it (glazing, a sill), a chain that measures it. */
  gaps: Array<{ from: number; to: number; widthM: number; chainIds: string[]; drawnAcross: number }>
  holds: boolean
  why: string
}

/** Plan ink: darker than this luma. The same threshold the outer faces are found with. */
export const THIN_BODY_INK_LUMA = 90
/** A position is wall when this share of the samples along the band is ink there (openings break a wall) … */
export const BAND_INK_SHARE = 0.6
/** … and paper when no more than this share is. */
export const PAPER_INK_SHARE = 0.2
/** How far past the read face the drawn far wall of a body read too narrow is looked for. */
export const WIDEN_SEARCH_M = 8
/** N7-FIX-01: a gap between two pieces of a wall is an opening when it is this wide or wider and no wider than the second — the bounds the plan's openings are read with (`planGaps`). */
export const OPENING_MIN_M = 0.5
export const OPENING_MAX_M = 6.5
/** N7-FIX-01: a piece of masonry is a pier, not a post, when it runs along the wall at least this many times its thickness … */
export const PIER_LENGTH_PER_THICKNESS = 1.5
/** … and a face is a wall with openings only when its pieces carry this share of its length. */
export const WALL_PIECE_SHARE = 0.25
/** A gap is drawn as an opening when one line inside the wall's thickness runs across this share of it (glazing, a sill). */
export const OPENING_SYMBOL_SHARE = 0.8
/**
 * An elevation can corroborate a built extent only when at least this share of its storey band is not sky, and
 * contradicts it only at or under the second. N7-FIX-01 (E-1): not being sky is never enough on its own — a tree, a
 * hedge or a body standing behind is not sky either. A view corroborates only where it draws the body's own outline:
 * its far corner as a vertical edge at the column the plan puts it, and its top as a horizontal edge near the storey's
 * wall top, in columns no other body of the plan stands in.
 */
export const ELEVATION_BUILT = 0.6
export const ELEVATION_EMPTY = 0.2
/** N7-FIX-01: an outline edge is drawn when this share of its rows (or columns) changes colour by at least the second across it (sum of the three channels' differences). */
export const ELEVATION_EDGE_SHARE = 0.6
export const ELEVATION_EDGE_STEP = 30

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

/** The colour step between two pixels: the sum of the channels' differences (a wall against a pale sky differs in hue more than in luma). */
const stepBetween = (r: Raster, xa: number, ya: number, xb: number, yb: number): number => {
  const a = (ya * r.width + xa) * 4
  const b = (yb * r.width + xb) * 4
  return Math.abs(r.data[a] - r.data[b]) + Math.abs(r.data[a + 1] - r.data[b + 1]) + Math.abs(r.data[a + 2] - r.data[b + 2])
}

/**
 * N7-FIX-01 (E-1): how much of a body's own outline an elevation draws over an extent — the share of the storey band's
 * rows with a vertical edge at the far corner's column (searched within 0.15 m of it), and the share of the extent's
 * columns with a horizontal edge near the wall top (from 0.4 m under it to 0.8 m over: a parapet or an eave).
 */
export function outlineEdges(raster: Raster, view: ElevationFrameV2, farAlong: number, topY: number, floorY: number, c0: number, c1: number): { far: number; top: number } {
  const W = raster.width
  const H = raster.height
  const mpp = Math.abs(view.pxOf(1) - view.pxOf(0)) > 0 ? 1 / Math.abs(view.pxOf(1) - view.pxOf(0)) : 0.02
  const rTop = Math.max(1, Math.round(Math.min(view.pyOf(topY - 0.3), view.pyOf(floorY + 0.3))))
  const rBot = Math.min(H - 2, Math.round(Math.max(view.pyOf(topY - 0.3), view.pyOf(floorY + 0.3))))
  const cf = Math.round(view.pxOf(farAlong))
  const reach = Math.max(3, Math.round(0.15 / mpp))
  let far = 0
  for (let x = Math.max(1, cf - reach); x <= Math.min(W - 2, cf + reach); x += 1) {
    let n = 0
    let e = 0
    for (let y = rTop; y <= rBot; y += 1) {
      n += 1
      if (stepBetween(raster, x + 1, y, x - 1, y) >= ELEVATION_EDGE_STEP) e += 1
    }
    if (n > 0) far = Math.max(far, e / n)
  }
  const ya = Math.max(1, Math.round(Math.min(view.pyOf(topY - 0.4), view.pyOf(topY + 0.8))))
  const yb = Math.min(H - 2, Math.round(Math.max(view.pyOf(topY - 0.4), view.pyOf(topY + 0.8))))
  const x0 = Math.max(0, c0 + 1)
  const x1 = Math.min(W - 1, c1 - 1)
  let topShare = 0
  for (let y = ya; y <= yb; y += 1) {
    let n = 0
    let e = 0
    for (let x = x0; x <= x1; x += 1) {
      n += 1
      if (stepBetween(raster, x, y + 1, x, y - 1) >= ELEVATION_EDGE_STEP) e += 1
    }
    if (n > 0) topShare = Math.max(topShare, e / n)
  }
  return { far: round6(far), top: round6(topShare) }
}

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

  // --- N7-FIX-01 (F-R1): a far face that is no continuous band is read along its whole length --------------------
  // Openings break a wall: two 1 m windows in a 6 m wall leave ink over less than 60 % of the samples, and the band
  // test above sees no wall. The face is read again as the plan draws an opening: masonry pieces on one line, the gaps
  // between them opening-sized, the pieces piers rather than posts, and the line reaching both ends of the body.
  const readFarWall = (): FarWallReading | undefined => {
    const mppAlong = axis === 'X' ? frame.mppY : frame.mppX
    const da = Math.max(0.01, mppAlong)
    const nAlong = Math.max(8, Math.floor(long / da))
    const alongAt = (k: number): number => along0 + ((k + 0.5) * long) / nAlong
    const inkAt = (s: number, a: number): boolean => (axis === 'X' ? ink(worldOf(s), a) : ink(a, worldOf(s)))
    // the line: bins near the read far face that carry ink over a fair share of the whole length
    const s0 = Math.max(0.02, narrow - Math.min(0.5, 0.8 * narrow))
    const s1 = narrow + tol
    const cov: Array<{ s: number; c: number }> = []
    for (let s = s0; s < s1; s += step) {
      let n = 0
      for (let k = 0; k < nAlong; k += 1) if (inkAt(s + step / 2, alongAt(k))) n += 1
      cov.push({ s, c: n / nAlong })
    }
    const runs: Band[] = []
    for (let i = 0; i < cov.length; i += 1) {
      if (cov[i].c < 0.5 * WALL_PIECE_SHARE) continue
      let j = i
      while (j + 1 < cov.length && cov[j + 1].c >= 0.5 * WALL_PIECE_SHARE) j += 1
      runs.push({ fromS: round6(cov[i].s), toS: round6(cov[j].s + step) })
      i = j
    }
    const line = runs.filter((r) => Math.abs(r.toS - narrow) <= tol && r.fromS > 0.02).sort((a, b) => Math.abs(a.toS - narrow) - Math.abs(b.toS - narrow))[0]
    if (!line) return undefined
    const tf = round6(line.toS - line.fromS)
    // masonry along the line: a position is solid where most of the line's thickness is ink there
    const across = Math.max(2, Math.round(tf / step))
    const solid: boolean[] = []
    for (let k = 0; k < nAlong; k += 1) {
      let n = 0
      for (let q = 0; q < across; q += 1) if (inkAt(line.fromS + ((q + 0.5) * tf) / across, alongAt(k))) n += 1
      solid.push(n / across >= BAND_INK_SHARE)
    }
    const at = (k: number): number => round6((k * long) / nAlong)
    const pieces: Array<[number, number]> = []
    for (let k = 0; k < nAlong; k += 1) {
      if (!solid[k]) continue
      let j = k
      while (j + 1 < nAlong && solid[j + 1]) j += 1
      const prev = pieces[pieces.length - 1]
      // a pixel's break in a drawn wall is the drawing, not a gap
      if (prev && at(k) - prev[1] <= 2 * (long / nAlong)) prev[1] = at(j + 1)
      else pieces.push([at(k), at(j + 1)])
      k = j
    }
    const pieceShare = round6(pieces.reduce((a, p) => a + p[1] - p[0], 0) / long)
    const gaps: FarWallReading['gaps'] = []
    for (let i = 0; i + 1 < pieces.length; i += 1) {
      const from = pieces[i][1]
      const to = pieces[i + 1][0]
      // a printed chain segment whose two ends fall on this gap's jambs measures it
      const wFrom = along0 + from
      const wTo = along0 + to
      const chainIds: string[] = []
      for (const c of input.chains) {
        if (c.frameId !== frame.frameId || c.axis !== (axis === 'X' ? 'VERTICAL' : 'HORIZONTAL')) continue
        for (const seg of c.segments) {
          if (seg.valueCm === undefined) continue
          const w = (px: number): number => (axis === 'X' ? frame.toWorld(frame.originPx.x, px).z : frame.toWorld(px, frame.originPx.y).x)
          const a = Math.min(w(seg.fromPx), w(seg.toPx))
          const b = Math.max(w(seg.fromPx), w(seg.toPx))
          if (Math.abs(a - wFrom) <= tol && Math.abs(b - wTo) <= tol && Math.abs(seg.valueCm / 100 - (to - from)) <= tol) chainIds.push(c.id)
        }
      }
      // a line drawn across the gap inside the wall's thickness (or just either side of it): glazing or a sill, the
      // symbol a plan draws an opening with — the best share of the gap's length one line of the band covers
      const nInner = Math.max(4, Math.round((to - from) / da))
      const inner = Array.from({ length: nInner }, (_, k) => along0 + from + ((to - from) * (k + 0.5)) / nInner).filter((a) => a > along0 + from + da && a < along0 + to - da)
      let drawnAcross = 0
      for (let sAt = line.fromS - 0.5 * tf; sAt <= line.toS + 0.5 * tf; sAt += Math.min(step, mppAlong)) {
        if (inner.length === 0) break
        let n = 0
        for (const a of inner) if (inkAt(sAt, a)) n += 1
        drawnAcross = Math.max(drawnAcross, n / inner.length)
      }
      gaps.push({ from: round6(from), to: round6(to), widthM: round6(to - from), chainIds, drawnAcross: round6(drawnAcross) })
    }
    const endTol = Math.max(tf, 0.1) + 2 * (long / nAlong)
    const reachesEnds = pieces.length > 0 && pieces[0][0] <= endTol && pieces[pieces.length - 1][1] >= long - endTol
    const posts = pieces.slice(1, -1).filter((p) => p[1] - p[0] < PIER_LENGTH_PER_THICKNESS * tf)
    const unsized = gaps.filter((g) => g.widthM < OPENING_MIN_M || g.widthM > OPENING_MAX_M)
    const base = { fromS: line.fromS, toS: line.toS, pieceShare, pieces, gaps }
    const no = (why: string): FarWallReading => ({ ...base, holds: false, why })
    if (tf < 0.04) return no(`the line at the far face is ${tf.toFixed(2)} m thick: a line, not a wall`)
    if (gaps.length === 0) return no('no gap between pieces of masonry on the far face')
    if (!reachesEnds) return no(`the masonry on the far face does not reach both ends of the body (${pieces.length > 0 ? `${pieces[0][0].toFixed(2)}..${pieces[pieces.length - 1][1].toFixed(2)} of ${long.toFixed(2)} m` : 'none'}): a wall that stops, not a wall with openings`)
    if (unsized.length > 0) return no(`${unsized.map((g) => `${g.widthM.toFixed(2)} m`).join(', ')} between pieces: no opening is ${OPENING_MIN_M}–${OPENING_MAX_M} m`)
    if (posts.length > 0) return no(`${posts.length} piece${posts.length === 1 ? ' is' : 's are'} shorter than ${PIER_LENGTH_PER_THICKNESS}× the ${tf.toFixed(2)} m line's thickness: posts, not piers`)
    if (pieceShare < WALL_PIECE_SHARE) return no(`masonry carries ${(pieceShare * 100).toFixed(0)} % of the face, under ${(WALL_PIECE_SHARE * 100).toFixed(0)} %`)
    const unexplained = gaps.filter((g) => g.drawnAcross < OPENING_SYMBOL_SHARE && g.chainIds.length === 0)
    if (unexplained.length > 0) return no(`${unexplained.length} of ${gaps.length} gap${gaps.length === 1 ? '' : 's'} (${unexplained.map((g) => `${g.widthM.toFixed(2)} m`).join(', ')}) carr${unexplained.length === 1 ? 'ies' : 'y'} no opening symbol across it and no printed chain measures ${unexplained.length === 1 ? 'it' : 'them'}: the drawing does not say ${unexplained.length === 1 ? 'it is an opening' : 'they are openings'}`)
    const drawn = gaps.filter((g) => g.drawnAcross >= OPENING_SYMBOL_SHARE).length
    const measured = gaps.filter((g) => g.chainIds.length > 0).length
    return { ...base, holds: true, why: `the far face is a ${tf.toFixed(2)} m wall broken by ${gaps.length} opening${gaps.length === 1 ? '' : 's'} (${gaps.map((g) => `${g.widthM.toFixed(2)} m`).join(', ')}) between piers, reaching both ends of the body; masonry over ${(pieceShare * 100).toFixed(0)} % of it; ${drawn} drawn with a line across, ${measured} measured by a printed chain` }
  }
  const continuousFar = bands.find((b) => Math.abs(b.toS - narrow) <= tol && b.fromS > 0.02)
  // read always, for the record (the ink before and after openings); it decides only where the band test found no wall
  const farWall = readFarWall()
  if (farWall) record.profile.farWall = farWall
  const farBand = continuousFar ?? (farWall?.holds ? { fromS: farWall.fromS, toS: farWall.toS } : undefined)
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
    const wFar = worldOf(s1)
    const out: ThinBodyRecord['elevations'] = []
    if (!Number.isFinite(top) || top - floor < 0.8) return out
    // N7-FIX-01 (E-1): a body the plan puts in the same columns, in front of or behind the extent, is seen there too
    const occluder = others.find((m) => overlap1(...(axis === 'X' ? ([m.x0, m.x1] as const) : ([m.z0, m.z1] as const)), w0, w1) > 0.1)
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
      const edges = outlineEdges(v.raster, v.view, wFar, top, floor, c0, c1)
      const entry = { frameId: v.view.registration.frameId, side: v.view.side, over: [round6(w0), round6(w1)] as [number, number], builtShare, edges }
      if (occluder) out.push({ ...entry, verdict: 'NOT_DECISIVE', why: `${occluder.id} stands in the same columns of the plan: the view cannot tell which body it shows` })
      else if (builtShare >= ELEVATION_BUILT && edges.far >= ELEVATION_EDGE_SHARE && edges.top >= ELEVATION_EDGE_SHARE) out.push({ ...entry, verdict: 'CORROBORATES', why: `the body's far corner and its top are drawn where the plan puts them (${(edges.far * 100).toFixed(0)} % and ${(edges.top * 100).toFixed(0)} % edge)` })
      else if (builtShare <= ELEVATION_EMPTY && edges.far < 0.5 * ELEVATION_EDGE_SHARE) out.push({ ...entry, verdict: 'CONTRADICTS', why: `${((1 - builtShare) * 100).toFixed(0)} % of the storey band over the extent is sky and no corner is drawn` })
      else out.push({ ...entry, verdict: 'NOT_DECISIVE', why: builtShare >= ELEVATION_BUILT ? `not sky, but the outline of a body is not drawn there (far corner ${(edges.far * 100).toFixed(0)} %, top ${(edges.top * 100).toFixed(0)} % edge): a tree, a hedge or something behind is not sky either` : `${(builtShare * 100).toFixed(0)} % of the band is not sky: neither built nor empty` })
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
  if (!farBand && farEdgeInk > 0.05 && farEdgeInk < 0.45 && !beyond) H('CANOPY_ON_POSTS', 'SUPPORTED', `the far face is drawn intermittently (${(farEdgeInk * 100).toFixed(0)} % ink)${farWall ? ` and is no wall with openings (${farWall.why})` : ''}: posts or a parapet, not a wall — not built by this pass`)
  else H('CANOPY_ON_POSTS', 'REFUTED', continuousFar ? 'the far face is a continuous drawn wall' : farWall?.holds ? farWall.why : 'no intermittent ink at the far face')
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

/**
 * N7-FIX-01: a body the plan draws in a zone the decomposition left open — walls of its own at both ends and a far
 * face of masonry, with interior between — that no mass was made of. The decomposition reads a cell as open when its
 * far wall is too broken to close the cell (four windows in a 6 m wall of 0.15 m): the body never becomes a mass, never
 * reaches `adjudicateThinBody`, and the zone is read as an empty strip. Not built here: named, with what the plan draws.
 */
export type ZoneBodyTrace = {
  side: ThinBodyFacade
  storeyIndex: number
  /** The body's extent along the face it stands against, and across the zone, in world metres. */
  from: number
  to: number
  depthM: number
  /** The drawn thickness of its end walls and of its far face. */
  endWallsM: [number, number]
  farWallM: number
  /** Share of the far face that is masonry. */
  farPieceShare: number
  why: string
}

/** The least thickness a line must have to be taken for one of a body's own walls here (a balustrade is drawn thinner). */
export const ZONE_BODY_WALL_MIN_M = 0.06

export function bodyDrawnInZone(raster: Raster, frame: PlanFrameV2, zone: { side: ThinBodyFacade; backAt: number; mouthAt: number; from: number; to: number }, storeyIndex: number): ZoneBodyTrace | undefined {
  const across = zone.side === 'EAST' || zone.side === 'WEST' ? 'X' : 'Z'
  const depth = Math.abs(zone.mouthAt - zone.backAt)
  const dir = Math.sign(zone.mouthAt - zone.backAt) || 1
  if (depth < 0.2 || zone.to - zone.from < 1) return undefined
  const ink = (s: number, a: number): boolean => {
    const c = zone.backAt + dir * s
    const p = across === 'X' ? frame.toPixel(c, a) : frame.toPixel(a, c)
    const px = Math.round(p.x)
    const py = Math.round(p.y)
    if (px < 0 || py < 0 || px >= raster.width || py >= raster.height) return false
    const o = (py * raster.width + px) * 4
    return 0.299 * raster.data[o] + 0.587 * raster.data[o + 1] + 0.114 * raster.data[o + 2] < THIN_BODY_INK_LUMA
  }
  const da = Math.max(0.01, across === 'X' ? frame.mppY : frame.mppX)
  const ds = Math.max(0.01, across === 'X' ? frame.mppX : frame.mppY)
  const nA = Math.max(8, Math.floor((zone.to - zone.from) / da))
  const aAt = (k: number): number => zone.from + ((k + 0.5) * (zone.to - zone.from)) / nA
  const nS = Math.max(6, Math.floor((0.9 * depth) / ds))
  const sSamples = Array.from({ length: nS }, (_, k) => 0.05 * depth + ((k + 0.5) * 0.9 * depth) / nS)
  // end walls: positions along the face where ink runs right across the zone
  const crosses: boolean[] = []
  for (let k = 0; k < nA; k += 1) {
    let n = 0
    for (const s of sSamples) if (ink(s, aAt(k))) n += 1
    crosses.push(n / sSamples.length >= 0.8)
  }
  const ends: Array<[number, number]> = []
  for (let k = 0; k < nA; k += 1) {
    if (!crosses[k]) continue
    let j = k
    while (j + 1 < nA && crosses[j + 1]) j += 1
    const a0 = zone.from + (k * (zone.to - zone.from)) / nA
    const a1 = zone.from + ((j + 1) * (zone.to - zone.from)) / nA
    if (a1 - a0 >= ZONE_BODY_WALL_MIN_M) ends.push([round6(a0), round6(a1)])
    k = j
  }
  for (let i = 0; i + 1 < ends.length; i += 1) {
    const lo = ends[i][1]
    const hi = ends[i + 1][0]
    if (hi - lo < 1) continue
    const nInner = Math.max(8, Math.floor((hi - lo) / da))
    const inner = Array.from({ length: nInner }, (_, k) => lo + ((k + 0.5) * (hi - lo)) / nInner)
    const coverAt = (s: number): number => inner.filter((a) => ink(s, a)).length / inner.length
    // the far face: the run of rows at the zone's mouth whose ink covers a fair share of the stretch
    const rows: Array<{ s: number; c: number }> = []
    for (let s = Math.max(0, depth - 0.4); s <= depth + 0.5 * ds; s += ds) rows.push({ s, c: coverAt(s) })
    let best: { s0: number; s1: number; c: number } | undefined
    for (let r = 0; r < rows.length; r += 1) {
      if (rows[r].c < WALL_PIECE_SHARE) continue
      let j = r
      let c = rows[r].c
      while (j + 1 < rows.length && rows[j + 1].c >= WALL_PIECE_SHARE) {
        j += 1
        c = Math.max(c, rows[j].c)
      }
      if (!best || rows[j].s + ds - rows[r].s > best.s1 - best.s0) best = { s0: rows[r].s, s1: rows[j].s + ds, c }
      r = j
    }
    if (!best || best.s1 - best.s0 < ZONE_BODY_WALL_MIN_M) continue
    // interior: paper between the face it stands against and the far face
    const mid = coverAt(Math.max(0.05 * depth, (best.s0 + Math.min(0.15, best.s0 / 2)) / 2))
    if (mid > PAPER_INK_SHARE) continue
    const farWallM = round6(best.s1 - best.s0)
    return {
      side: zone.side,
      storeyIndex,
      from: lo,
      to: hi,
      depthM: round6(depth),
      endWallsM: [round6(ends[i][1] - ends[i][0]), round6(ends[i + 1][1] - ends[i + 1][0])],
      farWallM,
      farPieceShare: round6(best.c),
      why: `the plan draws walls of its own across the ${depth.toFixed(2)} m zone at both ends (${(ends[i][1] - ends[i][0]).toFixed(2)} and ${(ends[i + 1][1] - ends[i + 1][0]).toFixed(2)} m) and a ${farWallM.toFixed(2)} m far face with masonry over ${(best.c * 100).toFixed(0)} % of it, paper between: an enclosed body ${(hi - lo).toFixed(2)} m long the decomposition left open`,
    }
  }
  return undefined
}
