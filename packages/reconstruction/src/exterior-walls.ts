/**
 * N7-COUNCIL-FIX-02 (Council B-1/B-2): the thickness of a body's EXTERIOR walls, read from the bands that draw its
 * outer faces.
 *
 * The plan's dominant band thickness (`bandWallThickness`, a length-weighted median of every band inside the extent)
 * is a fine measure of how heavily the sheet is drawn, and the decomposition keeps using it for its pixel tolerances.
 * It is not the thickness of the outer wall: a house drawn with 0.43 m outer walls and 0.12–0.25 m partitions has more
 * partition than facade, and the median lands on a partition (Council B-1: 0.30 m against 0.43 m faces). Here only
 * the bands lying ON a body's outer faces vote, a face another body stands against does not, and the answer says
 * where it came from: read off the faces, estimated from all bands, or the convention when the plan gives neither.
 */
import { round6 } from '@buildapp/source-common'
import type { PixelRect } from '@buildapp/source-common'
import type { Band } from '@buildapp/source-cv'

export type WallThicknessSource = 'EXTERIOR_FACE_BANDS' | 'ALL_BANDS_ESTIMATE' | 'CONVENTION'

export type FaceThicknessReading = {
  side: 'W' | 'E' | 'N' | 'S'
  bands: number
  /** Along the face, metres of band that voted. */
  lengthM: number
  /** Length-weighted median thickness of those bands, m. */
  thicknessM: number
}

export type WallThicknessReading = {
  m: number
  source: WallThicknessSource
  /** Metres of outer-face band behind the value (0 for an estimate). */
  supportM: number
  /** Metres of outer face not shared with another body. */
  exposedM: number
  faces: FaceThicknessReading[]
  why: string
}

/** Thinner or thicker than this is not an outer wall of a house: a line, or a hatched slab of something else. */
export const EXTERIOR_WALL_MIN_M = 0.12
export const EXTERIOR_WALL_MAX_M = 0.8
/** A face reading needs this many metres of band, and this share of the exposed perimeter, to stand. */
const MIN_SUPPORT_M = 1.0
const MIN_SUPPORT_SHARE = 0.3
const MIN_BANDS = 2

type Side = FaceThicknessReading['side']

const overlap1 = (a0: number, a1: number, b0: number, b1: number): number => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))

function weightedMedian(items: ReadonlyArray<{ t: number; w: number }>): number {
  const s = items.filter((x) => x.w > 0).sort((a, b) => a.t - b.t)
  const total = s.reduce((a, b) => a + b.w, 0)
  let run = 0
  for (const e of s) {
    run += e.w
    if (run >= total / 2) return e.t
  }
  return s.length > 0 ? s[s.length - 1].t : 0
}

/** Is `side` of `rect` faced, within `gapPx`, by another body's opposite side over most of its length? */
function sharedSide(rect: PixelRect, side: Side, others: readonly PixelRect[], gapPx: number): boolean {
  const vertical = side === 'W' || side === 'E'
  const line = side === 'W' ? rect.x0 : side === 'E' ? rect.x1 : side === 'N' ? rect.y0 : rect.y1
  const [s0, s1] = vertical ? [rect.y0, rect.y1] : [rect.x0, rect.x1]
  return others.some((o) => {
    const opposite = side === 'W' ? o.x1 : side === 'E' ? o.x0 : side === 'N' ? o.y1 : o.y0
    const [o0, o1] = vertical ? [o.y0, o.y1] : [o.x0, o.x1]
    return Math.abs(opposite - line) <= gapPx && overlap1(s0, s1, o0, o1) > 0.5 * (s1 - s0)
  })
}

/**
 * The exterior wall thickness of the body drawn at `rect` (pixels of the plan), from the bands on its outer faces.
 *
 * A band is on a face when it runs along that face, the face line falls within the band (its outer edge or its axis:
 * a body cut on the chains' outer faces and one cut on wall axes both qualify), most of its run lies along the face,
 * and it is a wall rather than a mark (≥ 2.5 of its own thicknesses long). Faces another body stands against are left
 * out: what is drawn there is the other body's wall, or a party wall. `null` when the faces do not carry enough band
 * to say anything.
 */
export function exteriorFaceThickness(bands: readonly Band[], rect: PixelRect, others: readonly PixelRect[], mppX: number, mppY: number, wallPx: number): Omit<WallThicknessReading, 'source' | 'why'> | null {
  const sides: Side[] = ['W', 'E', 'N', 'S']
  const faces: FaceThicknessReading[] = []
  const votes: Array<{ t: number; w: number }> = []
  let exposedM = 0
  for (const side of sides) {
    const vertical = side === 'W' || side === 'E'
    const faceLenM = vertical ? (rect.y1 - rect.y0) * mppY : (rect.x1 - rect.x0) * mppX
    if (sharedSide(rect, side, others, Math.max(3, wallPx * 1.5))) continue
    exposedM += faceLenM
    const line = side === 'W' ? rect.x0 : side === 'E' ? rect.x1 : side === 'N' ? rect.y0 : rect.y1
    const [s0, s1] = vertical ? [rect.y0, rect.y1] : [rect.x0, rect.x1]
    const on = bands.filter((b) => {
      if ((b.axis === 'VERTICAL') !== vertical) return false
      if (b.length < b.thickness * 2.5) return false
      const tol = Math.max(2, 0.35 * b.thickness)
      const [a0, a1] = vertical ? [b.bounds.x0, b.bounds.x1] : [b.bounds.y0, b.bounds.y1]
      if (line < a0 - tol || line > a1 + tol) return false
      const [r0, r1] = vertical ? [b.bounds.y0, b.bounds.y1] : [b.bounds.x0, b.bounds.x1]
      return overlap1(r0, r1, s0, s1) >= 0.5 * Math.max(1, r1 - r0)
    })
    if (on.length === 0) continue
    // a band's thickness at the larger of the two scales, as the plan's drawn wall has always been converted: under an
    // anisotropic registration the ring is inset by one thickness on both axes, and the smaller scale would leave a
    // sliver of the wall band inside it to be read as a partition
    const items = on.map((b) => ({ t: b.thickness * Math.max(mppX, mppY), w: overlap1(vertical ? b.bounds.y0 : b.bounds.x0, vertical ? b.bounds.y1 : b.bounds.x1, s0, s1) * (vertical ? mppY : mppX) }))
    votes.push(...items)
    faces.push({ side, bands: on.length, lengthM: round6(items.reduce((a, b) => a + b.w, 0)), thicknessM: round6(weightedMedian(items)) })
  }
  const supportM = votes.reduce((a, b) => a + b.w, 0)
  // two bands, or one that draws at least half of what is exposed (a body's long far wall): one stray band is not a reading
  if ((votes.length < MIN_BANDS && supportM < 0.5 * exposedM) || supportM < Math.max(MIN_SUPPORT_M, MIN_SUPPORT_SHARE * exposedM)) return null
  const m = weightedMedian(votes)
  if (m < EXTERIOR_WALL_MIN_M || m > EXTERIOR_WALL_MAX_M) return null
  return { m: round6(m), supportM: round6(supportM), exposedM: round6(exposedM), faces }
}

/**
 * The house's exterior wall thickness: the outer faces when they carry enough band, else the old all-band median
 * (an estimate, said so), else the convention.
 */
export function houseWallThickness(bands: readonly Band[], rect: PixelRect, mppX: number, mppY: number, wallPx: number, allBandsM: number, conventionM: number): WallThicknessReading {
  const read = exteriorFaceThickness(bands, rect, [], mppX, mppY, wallPx)
  if (read) {
    return { ...read, source: 'EXTERIOR_FACE_BANDS', why: `read off ${read.faces.length} outer face${read.faces.length === 1 ? '' : 's'} (${read.faces.map((f) => `${f.side} ${f.thicknessM.toFixed(2)} m over ${f.lengthM.toFixed(1)} m`).join(', ')}), ${read.supportM.toFixed(1)} m of band in all` }
  }
  if (allBandsM >= 0.15 && allBandsM <= 0.7) {
    return { m: round6(allBandsM), source: 'ALL_BANDS_ESTIMATE', supportM: 0, exposedM: 0, faces: [], why: `ESTIMATE: the outer faces do not carry enough wall band to read; the length-weighted median of every band on the plan (${allBandsM.toFixed(2)} m), which partitions pull down` }
  }
  return { m: conventionM, source: 'CONVENTION', supportM: 0, exposedM: 0, faces: [], why: `ESTIMATE: no outer face and no band median the plan supports; the ${conventionM.toFixed(2)} m convention` }
}

/**
 * One body's exterior walls, when its own faces say they are not the house's: a garage or wing drawn with thinner (or
 * thicker) outer walls. `undefined` when the body carries the house's walls, or its faces do not say, or say different
 * things.
 */
export function bodyWallThickness(bands: readonly Band[], rect: PixelRect, others: readonly PixelRect[], mppX: number, mppY: number, wallPx: number, house: WallThicknessReading): WallThicknessReading | undefined {
  const read = exteriorFaceThickness(bands, rect, others, mppX, mppY, wallPx)
  if (!read) return undefined
  // a body's own wall is one its faces agree on: a garage whose east face reads 0.63 m and north face 0.45 m is not
  // "a 0.63 m garage" — one face carries something else along the wall (a shaft, cladding, a merged band) — and it keeps
  // the house's wall. Every face of a metre or more within a fifth of the value (a single long face is enough: it must
  // already draw half of what is exposed, `exteriorFaceThickness`).
  const faces = read.faces.filter((f) => f.lengthM >= 1)
  if (faces.some((f) => Math.abs(f.thicknessM - read.m) > Math.max(0.04, 0.2 * read.m))) return undefined
  const differs = Math.abs(read.m - house.m) > Math.max(0.04, 0.15 * house.m)
  if (!differs) return undefined
  return { ...read, source: 'EXTERIOR_FACE_BANDS', why: `its own outer faces are drawn ${read.m.toFixed(2)} m (${read.faces.map((f) => `${f.side} ${f.thicknessM.toFixed(2)} m over ${f.lengthM.toFixed(1)} m`).join(', ')}), not the house's ${house.m.toFixed(2)} m` }
}

/** The minimum a body must span to hold its own two walls and a room between them. */
export const minBodySpanM = (wallM: number): number => Math.max(1, 2 * wallM + 0.2)
