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
import type { FrameToneV2, LevelV2, MassToneV2, MassV2, ReturnWallV2 } from './building.js'
import type { ElevationFrameV2 } from './frame.js'
import type { OpeningV2 } from './openings-v2.js'
import type { RecessTopology } from './recesses.js'
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

export function readMassTones(masses: readonly MassV2[], views: ReadonlyArray<{ view: ElevationFrameV2; raster: Raster }>, openings: readonly OpeningV2[], recesses: readonly RecessTopology[], levels: readonly LevelV2[]): MassToneV2[] {
  const out: MassToneV2[] = []
  const ground = levels.find((l) => l.index === 0)
  if (!ground) return out
  for (const m of masses) {
    if (!m.storeys.includes(0)) continue
    const rels: number[] = []
    let viewsUsed = 0
    const used: string[] = []
    for (const { view, raster } of views) {
      const white = whitePointOf(raster)
      const facade = view.side === 'LEFT' ? 'WEST' : view.side === 'RIGHT' ? 'EAST' : view.side
      const alongX = facade === 'FRONT' || facade === 'REAR'
      // This body's face on that side, and whether another body stands nearer the viewer there.
      const faceAt = facade === 'FRONT' ? m.z0 : facade === 'REAR' ? m.z1 : facade === 'WEST' ? m.x0 : m.x1
      const span: [number, number] = alongX ? [m.x0, m.x1] : [m.z0, m.z1]
      const nearer = (a: number): boolean =>
        masses.some((o) => {
          if (o === m || !o.storeys.includes(0)) return false
          const inSpan = alongX ? a > o.x0 && a < o.x1 : a > o.z0 && a < o.z1
          if (!inSpan) return false
          const oFace = facade === 'FRONT' ? o.z0 : facade === 'REAR' ? o.z1 : facade === 'WEST' ? o.x0 : o.x1
          return facade === 'FRONT' || facade === 'WEST' ? oFace < faceAt - 0.05 : oFace > faceAt + 0.05
        })
      // A recess on this side at the ground storey sets this face back over its open intervals.
      const recessed = (a: number): boolean => recesses.some((r) => r.storeyIndex === 0 && r.side === facade && r.open.some((o) => a > o.from - 0.05 && a < o.to + 0.05))
      const inOpening = (a: number): boolean => openings.some((o) => o.facade === facade && o.storeyIndex === 0 && o.massId === m.id && a > o.interval[0] - 0.15 && a < o.interval[1] + 0.15)
      const y0 = ground.elevation + 0.3
      const y1 = ground.elevation + Math.min(ground.height, 2.8) - 0.3
      let samples = 0
      const mpp = view.registration.metresPerPixelU
      for (let a = span[0] + 0.2; a <= span[1] - 0.2; a += mpp * 2) {
        if (nearer(a) || recessed(a) || inOpening(a)) continue
        const px = Math.round(view.pxOf(a))
        for (let y = y0; y <= y1; y += mpp * 2) {
          const py = Math.round(view.pyOf(y))
          const rel = relativeSample(raster, px, py, white)
          if (rel === undefined) continue
          rels.push(rel)
          samples += 1
        }
      }
      if (samples >= 50) {
        viewsUsed += 1
        used.push(view.side.toLowerCase())
      }
    }
    if (rels.length < 100) continue
    const { tone, share, median: med } = familyOf(rels)
    out.push({ massId: m.id, tone, share, views: viewsUsed, why: `the median of ${rels.length} samples of its open ground-storey faces on the ${used.join(', ')} render${used.length === 1 ? '' : 's'} is ${Math.round(med * 100)} % of the render's white: ${tone.toLowerCase()} (${Math.round(share * 100)} % of the samples read ${tone.toLowerCase()})` })
  }
  return out
}

/**
 * The tone of each gable frame's returns: their outer faces stand in the
 * facade's outer plane, in the open, so the render shows their finish
 * directly. The frame is one member family — returns and the verge that
 * continues them — and takes one tone.
 */
export function readFrameTones(returns: readonly ReturnWallV2[], views: ReadonlyArray<{ view: ElevationFrameV2; raster: Raster }>, levels: readonly LevelV2[]): FrameToneV2[] {
  const out: FrameToneV2[] = []
  for (const side of ['FRONT', 'REAR', 'WEST', 'EAST'] as const) {
    const frame = returns.filter((r) => r.side === side)
    if (frame.length === 0) continue
    const view = views.find((v) => (v.view.side === 'LEFT' ? 'WEST' : v.view.side === 'RIGHT' ? 'EAST' : v.view.side) === side)
    if (!view) continue
    const rels: number[] = []
    const white = whitePointOf(view.raster)
    const mpp = view.view.registration.metresPerPixelU
    for (const r of frame) {
      const l = levels.find((x) => x.index === r.storeyIndex)
      if (!l) continue
      const [a0, a1] = r.alongInterval
      if (a1 - a0 < 0.2) continue
      for (let a = a0 + 0.08; a <= a1 - 0.08; a += mpp) {
        const px = Math.round(view.view.pxOf(a))
        for (let y = l.elevation + 0.3; y <= l.elevation + Math.min(l.height, 2.6) - 0.3; y += mpp * 2) {
          const rel = relativeSample(view.raster, px, Math.round(view.view.pyOf(y)), white)
          if (rel !== undefined) rels.push(rel)
        }
      }
    }
    if (rels.length < 60) continue
    const { tone, share, median: med } = familyOf(rels)
    out.push({ side, tone, share, why: `the median of ${rels.length} samples of the ${side.toLowerCase()} returns' outer faces on the ${view.view.side.toLowerCase()} render is ${Math.round(med * 100)} % of the render's white: ${tone.toLowerCase()}` })
  }
  return out
}
