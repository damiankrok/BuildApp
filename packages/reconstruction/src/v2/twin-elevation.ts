/**
 * EXTERIOR-COMPLETE: an elevation that draws the pair a unit belongs to.
 *
 * A semi-detached unit's elevations are often drawn with the neighbouring unit beside it, washed out: the unit in full
 * contrast, its mirror image faded to a few greys. The silhouette then spans both units, fits no span of the house the
 * plan draws, and the view was refused — its openings never read, the plan's gaps built at assumed heights.
 *
 * The reading is the one a person makes at a glance: split the silhouette at its middle (a pair of mirrored units meets
 * there) and compare the two halves' contrast over the walls (the lower part of the silhouette, sky and vegetation
 * left out). When one half is drawn with less than `TWIN_FADED_CONTRAST_RATIO` of the other's luma spread, that half
 * is the neighbour and the other the unit; the caller registers the unit's half exactly as it would a silhouette, and
 * only a half that then fits a span of the house is taken. Two halves drawn alike are not split: which one is the unit
 * the picture does not say (named, not chosen).
 */
import { round6 } from '@buildapp/source-common'
import type { Raster } from '@buildapp/source-cv'
import { rgbAt, toneClass } from './scan.js'

/** A half drawn with less than this share of the other half's luma spread is the faded neighbour. */
export const TWIN_FADED_CONTRAST_RATIO = 0.5
/** The walls: from this share of the silhouette's height (measured from its top) down to its bottom. */
export const TWIN_WALL_BAND_FROM = 0.45
/** At least this many wall samples in each half for the comparison to be made. */
export const TWIN_MIN_SAMPLES = 400

export type PixelExtent = { x0: number; y0: number; x1: number; y1: number }
export type TwinHalfReading = { extent: PixelExtent; half: 'LEFT' | 'RIGHT'; spreads: [number, number]; why: string }

function spreadOf(raster: Raster, x0: number, x1: number, y0: number, y1: number): { spread: number; samples: number } {
  const lumas: number[] = []
  const step = Math.max(1, Math.round((x1 - x0) / 200))
  for (let y = Math.round(y0); y < Math.round(y1); y += step) {
    for (let x = Math.round(x0); x < Math.round(x1); x += step) {
      if (x < 0 || y < 0 || x >= raster.width || y >= raster.height) continue
      const rgb = rgbAt(raster, x, y)
      const t = toneClass(rgb)
      if (t === 'GREEN' || t === 'COOL') continue
      lumas.push((rgb[0] + rgb[1] + rgb[2]) / 3)
    }
  }
  if (lumas.length === 0) return { spread: 0, samples: 0 }
  const mean = lumas.reduce((a, b) => a + b, 0) / lumas.length
  const spread = Math.sqrt(lumas.reduce((a, b) => a + (b - mean) * (b - mean), 0) / lumas.length)
  return { spread, samples: lumas.length }
}

export function readTwinHalf(raster: Raster, extent: PixelExtent): TwinHalfReading | undefined {
  const mid = Math.round((extent.x0 + extent.x1) / 2)
  const yTop = extent.y0 + (extent.y1 - extent.y0) * TWIN_WALL_BAND_FROM
  const inset = Math.max(2, Math.round((extent.x1 - extent.x0) * 0.01))
  const left = spreadOf(raster, extent.x0 + inset, mid - inset, yTop, extent.y1 - inset)
  const right = spreadOf(raster, mid + inset, extent.x1 - inset, yTop, extent.y1 - inset)
  if (left.samples < TWIN_MIN_SAMPLES || right.samples < TWIN_MIN_SAMPLES) return undefined
  const strong = left.spread >= right.spread ? 'LEFT' : 'RIGHT'
  const [s, w] = strong === 'LEFT' ? [left.spread, right.spread] : [right.spread, left.spread]
  if (s <= 0 || w >= TWIN_FADED_CONTRAST_RATIO * s) return undefined
  const half = strong === 'LEFT' ? { x0: extent.x0, y0: extent.y0, x1: mid, y1: extent.y1 } : { x0: mid, y0: extent.y0, x1: extent.x1, y1: extent.y1 }
  return {
    extent: half,
    half: strong,
    spreads: [round6(left.spread), round6(right.spread)],
    why: `the silhouette draws a pair: its ${strong.toLowerCase()} half is drawn in full contrast (luma spread ${s.toFixed(0)}) and the other faded (${w.toFixed(0)}, under ${Math.round(TWIN_FADED_CONTRAST_RATIO * 100)} %): the unit is the ${strong.toLowerCase()} half, its neighbour the other`,
  }
}
