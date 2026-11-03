/**
 * Broad tone of each body's walls, read off the registered renders.
 *
 * Not a texture and not a colour: a tone FAMILY — light, mid, dark — that
 * the styling layer maps onto its own controlled palette. A garage built in
 * dark render beside a white house reads as a different body at a glance,
 * and the model should say so; the exact RGB of a render, lit, shaded and
 * compressed, is not a fact about the building and is not kept.
 *
 * The chain is the one a person follows looking at the picture:
 *  1. a region mask — only the part of a facade that stands in the open:
 *     - the body's own outer face, not a wall set back in a recess (in
 *       shadow under the storey above, it reads dark whatever it is built of);
 *     - along the facade, only where this body is the one nearest the viewer
 *       (a garage in front of the house's east wall hides it);
 *     - clear of every opening on that facade, with a margin (glass is not
 *       the wall);
 *     - from 0.3 m above the floor to 0.3 m under the ground storey's top;
 *  2. exclusions — vegetation (green-dominant) and sky or glazing
 *     (blue-dominant) samples are what stands in front of or behind the
 *     wall, not the wall, and are dropped;
 *  3. each remaining sample's brightness RELATIVE to the render's own white
 *     point (a high percentile of the whole render), because a render is
 *     exposed and toned as a whole: the same anthracite reads at luma 84 on
 *     one render and 60 on another, but at about a third of that render's
 *     white on both;
 *  4. the robust median of those relative values over every view that sees
 *     the body — a band of another finish, a shadow or a drainpipe moves the
 *     median only when it covers half the face;
 *  5. a tone family from the median: LIGHT from 0.8 of white, DARK under
 *     0.45, MID between.
 */
import { round6 } from '@buildapp/source-common'
import type { Raster } from '@buildapp/source-cv'
import type { LevelV2, MassToneV2, MassV2, ReturnToneV2, ReturnWallV2 } from './building.js'
import type { ElevationFrameV2 } from './frame.js'
import type { OpeningV2 } from './openings-v2.js'
import type { RecessTopology } from './recesses.js'
import { EAVES_OVERHANG_M } from './roof-details.js'
import { rgbAt, toneClass } from './scan.js'

/** Relative brightness at or above which a finish reads light, and under which it reads dark. */
export const TONE_LIGHT_FROM = 0.8
export const TONE_DARK_UNDER = 0.45

export type ToneFamily = 'LIGHT' | 'MID' | 'DARK'

export const toneFamilyOf = (relative: number): ToneFamily => (relative >= TONE_LIGHT_FROM ? 'LIGHT' : relative < TONE_DARK_UNDER ? 'DARK' : 'MID')

/**
 * A render's white point: the 99th percentile of its luma over a coarse
 * grid. Paper, sky and the lightest render all sit near it; nothing a facade
 * is built of is brighter.
 */
export function whitePointOf(raster: Raster): number {
  const lumas: number[] = []
  const step = Math.max(1, Math.floor(Math.min(raster.width, raster.height) / 200))
  for (let y = 0; y < raster.height; y += step) {
    for (let x = 0; x < raster.width; x += step) {
      const [r, g, b] = rgbAt(raster, x, y)
      lumas.push((r + g + b) / 3)
    }
  }
  lumas.sort((a, b) => a - b)
  return Math.max(1, lumas[Math.min(lumas.length - 1, Math.floor(lumas.length * 0.99))] ?? 255)
}

/** One sample's brightness relative to the white point, or undefined when it is vegetation, sky or glass. */
function relativeSample(raster: Raster, px: number, py: number, white: number): number | undefined {
  const rgb = rgbAt(raster, px, py)
  const t = toneClass(rgb)
  if (t === 'GREEN' || t === 'COOL') return undefined
  return Math.min(1, (rgb[0] + rgb[1] + rgb[2]) / 3 / white)
}

const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length === 0 ? 0 : s.length % 2 === 1 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}

/** The family of the median, and the share of samples that fall in that family. */
function familyOf(rels: readonly number[]): { tone: ToneFamily; share: number; median: number } {
  const med = median(rels)
  const tone = toneFamilyOf(med)
  const share = rels.filter((r) => toneFamilyOf(r) === tone).length / Math.max(1, rels.length)
  return { tone, share: round6(share), median: round6(med) }
}

/**
 * EXTERIOR-COMPLETE: one reading per storey. A house rendered grey on the ground storey and white above is two finishes,
 * and the ground storey's tone painted on the whole body built a white attic in grey. Each storey is sampled in its own
 * band — from 0.3 m over its floor to 0.3 m under the lower of its top and the main roof's eave — with the same masks.
 * Under a pitched roof — the body's own: the main roof over the main body, an attached body's gable over that body — an
 * upper storey's band ends under that roof's eave on the gable ends, and on the eave sides (every side of a roof hipped
 * at an end) under the overhang's drop as well: the eaves hang past the wall and below the eave datum by the overhang
 * times the slope, over the knee wall, and what that strip shows is the roof's underside and edge, not the wall. The
 * overhang is the one the section reads, or the largest an eaves may have (`EAVES_OVERHANG_M.max`) when none was read:
 * a margin of what is sampled, never a dimension of the model. A knee wall under that drop is not read at all; a full
 * storey wall under a high eave is. A balcony on that storey
 * stands in front of the wall over its length — its railing, slab and shade are not the finish — and is masked as a
 * nearer body is; so is a lower body nearer the viewer whose pitched roof rises into the band.
 * The ground storey's entry carries no `storeyIndex`, as before; an upper storey's entry carries its index, and a
 * storey the renders do not show well enough gets none.
 */
export const MASS_TONE_MIN_BAND_M = 0.6

/** The pitched roof over one body: its eave datum, its ridge's axis, and whether it is hipped at an end. */
export type PitchedRoofOverBody = { massId: string; eaveY: number; ridgeY: number; ridgeAxis: 'X' | 'Z'; pitchDeg: number; overhangM?: number; hipped?: boolean }
/** A balcony slab on a storey, in plan, with the facade it stands on. */
export type BalconyInFront = { storeyIndex: number; side?: 'FRONT' | 'REAR' | 'WEST' | 'EAST'; x0: number; z0: number; x1: number; z1: number }
export type MassToneContext = { roofs?: readonly PitchedRoofOverBody[]; balconies?: readonly BalconyInFront[] }

export function readMassTones(masses: readonly MassV2[], views: ReadonlyArray<{ view: ElevationFrameV2; raster: Raster }>, openings: readonly OpeningV2[], recesses: readonly RecessTopology[], levels: readonly LevelV2[], context: MassToneContext = {}): MassToneV2[] {
  const roofOf = (massId: string): PitchedRoofOverBody | undefined => context.roofs?.find((r) => r.massId === massId)
  const out: MassToneV2[] = []
  const whites = views.map(({ raster }) => whitePointOf(raster))
  for (const m of masses) {
    const roof = roofOf(m.id)
    for (const storey of m.storeys) {
      const level = levels.find((l) => l.index === storey)
      if (!level) continue
      const y0 = level.elevation + 0.3
      // the ground storey keeps its band as it was read (its top at most 2.8 m over the floor)
      const top = level.elevation + Math.min(level.height, 2.8)
      const gableTop = (storey === 0 ? top : Math.min(top, roof?.eaveY ?? top)) - 0.3
      const eaveTop = storey === 0 || !roof ? gableTop : Math.min(top, roof.eaveY - (roof.overhangM ?? EAVES_OVERHANG_M.max) * Math.tan((roof.pitchDeg * Math.PI) / 180)) - 0.3
      if (gableTop - y0 < MASS_TONE_MIN_BAND_M) continue
      const rels: number[] = []
      const used: string[] = []
      views.forEach(({ view, raster }, vi) => {
        const white = whites[vi]
        const facade = view.side === 'LEFT' ? 'WEST' : view.side === 'RIGHT' ? 'EAST' : view.side
        const alongX = facade === 'FRONT' || facade === 'REAR'
        // an eave side of the body's roof (a hipped end is one too): the band ends under the overhang's drop
        const eaveSide = storey > 0 && roof !== undefined && (roof.hipped === true || (roof.ridgeAxis === 'X') === alongX)
        const y1 = eaveSide ? eaveTop : gableTop
        if (y1 - y0 < MASS_TONE_MIN_BAND_M) return
        // This body's face on that side, and whether another body stands nearer the viewer there at this storey.
        const faceAt = facade === 'FRONT' ? m.z0 : facade === 'REAR' ? m.z1 : facade === 'WEST' ? m.x0 : m.x1
        const span: [number, number] = alongX ? [m.x0, m.x1] : [m.z0, m.z1]
        const nearer = (a: number): boolean =>
          masses.some((o) => {
            // a lower body nearer the viewer hides this storey where its own pitched roof rises into the band
            if (o === m || !(o.storeys.includes(storey) || (roofOf(o.id)?.ridgeY ?? -Infinity) > y0)) return false
            const inSpan = alongX ? a > o.x0 && a < o.x1 : a > o.z0 && a < o.z1
            if (!inSpan) return false
            const oFace = facade === 'FRONT' ? o.z0 : facade === 'REAR' ? o.z1 : facade === 'WEST' ? o.x0 : o.x1
            return facade === 'FRONT' || facade === 'WEST' ? oFace < faceAt - 0.05 : oFace > faceAt + 0.05
          })
        // A recess on this side at this storey sets this face back over its open intervals.
        const recessed = (a: number): boolean => recesses.some((r) => r.storeyIndex === storey && r.side === facade && r.open.some((o) => a > o.from - 0.05 && a < o.to + 0.05))
        const inOpening = (a: number): boolean => openings.some((o) => o.facade === facade && o.storeyIndex === storey && o.massId === m.id && a > o.interval[0] - 0.15 && a < o.interval[1] + 0.15)
        const behindBalcony = (a: number): boolean => storey > 0 && (context.balconies ?? []).some((b) => b.storeyIndex === storey && b.side === facade && (alongX ? a > b.x0 - 0.15 && a < b.x1 + 0.15 : a > b.z0 - 0.15 && a < b.z1 + 0.15))
        let samples = 0
        const mpp = view.registration.metresPerPixelU
        for (let a = span[0] + 0.2; a <= span[1] - 0.2; a += mpp * 2) {
          if (nearer(a) || recessed(a) || inOpening(a) || behindBalcony(a)) continue
          const px = Math.round(view.pxOf(a))
          for (let y = y0; y <= y1; y += mpp * 2) {
            const py = Math.round(view.pyOf(y))
            const rel = relativeSample(raster, px, py, white)
            if (rel === undefined) continue
            rels.push(rel)
            samples += 1
          }
        }
        if (samples >= 50) used.push(view.side.toLowerCase())
      })
      if (rels.length < 100) continue
      const { tone, share, median: med } = familyOf(rels)
      const where = storey === 0 ? 'its open ground-storey faces' : `its open faces on storey ${storey}`
      out.push({ massId: m.id, ...(storey === 0 ? {} : { storeyIndex: storey }), tone, share, views: used.length, why: `the median of ${rels.length} samples of ${where} on the ${used.join(', ')} render${used.length === 1 ? '' : 's'} is ${Math.round(med * 100)} % of the render's white: ${tone.toLowerCase()} (${Math.round(share * 100)} % of the samples read ${tone.toLowerCase()})` })
    }
  }
  return out
}

/**
 * The tone of each return's outer face. A return stands in the facade's outer
 * plane, in the open, so the render shows its finish directly; returns of one
 * frame usually share it, but not always — the return that closes a garage
 * box is that box's render, not the gable frame's — so each is read on its
 * own, over its storey's band, clear of the storey's top and bottom.
 */
export function readReturnTones(returns: readonly ReturnWallV2[], views: ReadonlyArray<{ view: ElevationFrameV2; raster: Raster }>, levels: readonly LevelV2[]): ReturnToneV2[] {
  const out: ReturnToneV2[] = []
  for (const r of returns) {
    const view = views.find((v) => (v.view.side === 'LEFT' ? 'WEST' : v.view.side === 'RIGHT' ? 'EAST' : v.view.side) === r.side)
    const l = levels.find((x) => x.index === r.storeyIndex)
    if (!view || !l) continue
    const [a0, a1] = r.alongInterval
    if (a1 - a0 < 0.2) continue
    const white = whitePointOf(view.raster)
    const mpp = view.view.registration.metresPerPixelU
    const rels: number[] = []
    for (let a = a0 + 0.08; a <= a1 - 0.08; a += mpp) {
      const px = Math.round(view.view.pxOf(a))
      for (let y = l.elevation + 0.3; y <= l.elevation + Math.min(l.height, 2.6) - 0.3; y += mpp * 2) {
        const rel = relativeSample(view.raster, px, Math.round(view.view.pyOf(y)), white)
        if (rel !== undefined) rels.push(rel)
      }
    }
    if (rels.length < 30) continue
    const { tone, share, median: med } = familyOf(rels)
    out.push({ returnId: r.id, side: r.side, storeyIndex: r.storeyIndex, tone, share, why: `the median of ${rels.length} samples of its outer face on the ${view.view.side.toLowerCase()} render is ${Math.round(med * 100)} % of the render's white: ${tone.toLowerCase()}` })
  }
  return out
}

export type FinishRun = { from: number; to: number; tone: 'LIGHT' | 'MID' | 'DARK' | 'WARM'; share: number; samples: number }

/**
 * The finishes along one face, as runs: a recessed wall in timber for part of
 * its length and in dark render for the rest reads as two runs, not one
 * averaged tone. Each column of the face (between `y`) is classed on its own —
 * WARM when most of its samples are warm-hued (timber), otherwise the family
 * of its median brightness relative to the render's white — and neighbouring
 * columns of one class join into a run. Columns inside `skip` (the openings in
 * the face: glass is not the wall) are not read, and a run continues across
 * them when the same class stands on both sides. Runs shorter than `minRunM`
 * are absorbed by the longer neighbour: a drainpipe is not a finish.
 */
export function readFinishRuns(view: ElevationFrameV2, raster: Raster, along: [number, number], y: [number, number], skip: ReadonlyArray<[number, number]> = [], minRunM = 0.3): FinishRun[] {
  const white = whitePointOf(raster)
  const mpp = view.registration.metresPerPixelU
  const step = Math.max(mpp * 2, 0.02)
  type Col = { a: number; tone: FinishRun['tone']; share: number; n: number }
  const cols: Col[] = []
  for (let a = along[0] + step / 2; a < along[1]; a += step) {
    if (skip.some(([s0, s1]) => a > s0 - 0.05 && a < s1 + 0.05)) continue
    const px = Math.round(view.pxOf(a))
    const rels: number[] = []
    let warm = 0
    for (let yy = y[0]; yy <= y[1]; yy += mpp * 2) {
      const rgb = rgbAt(raster, px, Math.round(view.pyOf(yy)))
      const t = toneClass(rgb)
      if (t === 'GREEN' || t === 'COOL') continue
      if (t === 'WARM') warm += 1
      rels.push(Math.min(1, (rgb[0] + rgb[1] + rgb[2]) / 3 / white))
    }
    if (rels.length < 4) continue
    if (warm / rels.length > 0.5) {
      cols.push({ a, tone: 'WARM', share: warm / rels.length, n: rels.length })
      continue
    }
    const f = familyOf(rels)
    cols.push({ a, tone: f.tone, share: f.share, n: rels.length })
  }
  if (cols.length === 0) return []
  // A finish is what most columns within 0.2 m read: the joints of a boarded
  // wall, a downpipe or a shadow line are single columns and do not split it.
  const smoothed = cols.map((c) => {
    const votes = new Map<FinishRun['tone'], number>()
    for (const o of cols) if (Math.abs(o.a - c.a) <= 0.2) votes.set(o.tone, (votes.get(o.tone) ?? 0) + 1)
    const [tone] = [...votes].sort((p, q) => q[1] - p[1] || (p[0] === c.tone ? -1 : q[0] === c.tone ? 1 : 0))[0]
    return { ...c, tone }
  })
  cols.splice(0, cols.length, ...smoothed)
  // Join neighbouring columns of one class; a skipped stretch joins when both sides agree.
  let runs: FinishRun[] = []
  for (const c of cols) {
    const last = runs[runs.length - 1]
    if (last && last.tone === c.tone) {
      last.to = c.a + step / 2
      last.share = (last.share * last.samples + c.share * c.n) / (last.samples + c.n)
      last.samples += c.n
    } else {
      // Across a skipped stretch (an opening) between two finishes, the boundary is its middle.
      const from = last ? (c.a - step / 2 - last.to > step ? (last.to + c.a - step / 2) / 2 : last.to) : along[0]
      if (last) last.to = from
      runs.push({ from, to: c.a + step / 2, tone: c.tone, share: c.share, samples: c.n })
    }
  }
  // Absorb short runs into the longer neighbour, shortest first, until none is left.
  for (;;) {
    const i = runs.findIndex((r) => r.to - r.from < minRunM)
    if (i < 0 || runs.length === 1) break
    const prev = runs[i - 1]
    const next = runs[i + 1]
    const into = !prev ? next : !next ? prev : prev.to - prev.from >= next.to - next.from ? prev : next
    into.from = Math.min(into.from, runs[i].from)
    into.to = Math.max(into.to, runs[i].to)
    runs.splice(i, 1)
    // Neighbours that now agree become one run.
    const merged: FinishRun[] = []
    for (const r of runs) {
      const last = merged[merged.length - 1]
      if (last && last.tone === r.tone) {
        last.to = r.to
        last.samples += r.samples
      } else merged.push({ ...r })
    }
    runs = merged
  }
  runs[0].from = along[0]
  runs[runs.length - 1].to = along[1]
  return runs.map((r) => ({ ...r, from: round6(r.from), to: round6(r.to), share: round6(r.share) }))
}
