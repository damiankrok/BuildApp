/**
 * v3.51 ANY-LINK: the size a plan sheet is READ at.
 *
 * The plan readers look for walls through windows stated in pixels — a wall is some six to forty pixels thick, a
 * partition about half an outer wall, a tolerance three pixels. Those windows were measured on the sheets publishers
 * commonly serve, where a house fills a sheet under a thousand pixels across and its walls come out ten to twenty-five
 * pixels thick. A sheet drawn finer (a vector plan rendered at 1700 px, a 1900 px scan: walls forty to fifty pixels
 * thick) falls outside every window at once: the survey never sees the outer walls, the partitions are taken for the
 * walls, and the outline that results is a part of the plan. Read at 853 px the same sheet gives the house.
 *
 * So a plan sheet whose walls are thicker, in pixels, than the range the readers were measured on is read at a
 * smaller size: the one at which its typical wall has the thickness typical of that range. The measure is taken from
 * the sheet itself with a window that scales with the sheet (so a thick wall on a large sheet is seen at all), and the
 * rule is stated in pixels of wall, never in pixels of sheet: a large sheet showing a large site at a coarse scale is
 * left alone.
 *
 * The frame of such a sheet carries the reading size, and every reader, mark and overlay works in that frame; the
 * picture is resampled to it (`resampleRaster`) wherever its pixels are asked for. Sheets inside the range — every
 * sheet the readers were measured on — keep their own size, so nothing about them changes.
 */
import type { PixelSize } from '@buildapp/source-common'
import { bandThicknessQuantile, runLengthBands } from './bands.js'
import { adaptiveInkMask } from './mask.js'
import { inkChannel } from './raster.js'
import type { Raster } from './raster.js'

/** The survey's window as shares of the sheet's long side, so it sees a thick wall on a fine sheet. */
export const READING_SURVEY_MAX_THICKNESS_SHARE = 0.08
export const READING_SURVEY_MIN_LENGTH_SHARE = 0.03
export const READING_SURVEY_MIN_THICKNESS_PX = 6
/**
 * The typical wall (length-weighted median band thickness) of the sheets the plan readers were measured on runs from
 * about 7 px to 27 px; a sheet above this is finer than any of them.
 */
export const READING_MAX_TYPICAL_WALL_PX = 30
/** The typical wall such a sheet is brought to: the middle of the measured range. */
export const READING_TARGET_TYPICAL_WALL_PX = 16
/** A sheet is never read under this long side: below it the digits and the partitions are gone. */
export const READING_MIN_LONG_SIDE_PX = 600

export type ReadingSize = { size: PixelSize; typicalWallPx: number; reduction: number }

/** The sheet's typical wall thickness in its own pixels: the length-weighted median of its bands, surveyed sheet-relative. */
export function typicalWallPx(raster: Raster): number {
  const long = Math.max(raster.width, raster.height)
  const mask = adaptiveInkMask(inkChannel(raster), {})
  const bands = runLengthBands(mask, { minThickness: READING_SURVEY_MIN_THICKNESS_PX, maxThickness: Math.max(READING_SURVEY_MIN_THICKNESS_PX + 1, Math.round(long * READING_SURVEY_MAX_THICKNESS_SHARE)), minLength: Math.max(8, Math.round(long * READING_SURVEY_MIN_LENGTH_SHARE)) })
  return bandThicknessQuantile(bands, 0.5, 0)
}

/** The size a plan sheet is read at: its own, unless its walls are thicker than the measured range. */
export function planReadingSize(raster: Raster): ReadingSize {
  const own: PixelSize = { width: raster.width, height: raster.height }
  const wall = typicalWallPx(raster)
  if (!(wall > READING_MAX_TYPICAL_WALL_PX)) return { size: own, typicalWallPx: wall, reduction: 1 }
  const long = Math.max(raster.width, raster.height)
  const reduction = Math.min(wall / READING_TARGET_TYPICAL_WALL_PX, long / READING_MIN_LONG_SIDE_PX)
  if (!(reduction > 1)) return { size: own, typicalWallPx: wall, reduction: 1 }
  return { size: { width: Math.max(1, Math.round(raster.width / reduction)), height: Math.max(1, Math.round(raster.height / reduction)) }, typicalWallPx: wall, reduction: Math.round(reduction * 1e6) / 1e6 }
}

/**
 * The picture at another size, each output pixel the mean of the source pixels it covers (area averaging, exact for
 * fractional coverage). Deterministic integer arithmetic on the way out: the same bytes give the same raster on every
 * runtime. Used to bring a sheet to its reading size; the identity when the size is the raster's own.
 */
export function resampleRaster(raster: Raster, size: PixelSize): Raster {
  if (size.width === raster.width && size.height === raster.height) return raster
  const { width: W, height: H } = size
  const out = new Uint8ClampedArray(W * H * 4)
  const sx = raster.width / W
  const sy = raster.height / H
  const acc = [0, 0, 0, 0]
  for (let y = 0; y < H; y += 1) {
    const y0 = y * sy
    const y1 = Math.min(raster.height, (y + 1) * sy)
    for (let x = 0; x < W; x += 1) {
      const x0 = x * sx
      const x1 = Math.min(raster.width, (x + 1) * sx)
      acc[0] = acc[1] = acc[2] = acc[3] = 0
      let weight = 0
      for (let v = Math.floor(y0); v < y1; v += 1) {
        const wy = Math.min(v + 1, y1) - Math.max(v, y0)
        if (!(wy > 0)) continue
        for (let u = Math.floor(x0); u < x1; u += 1) {
          const wx = Math.min(u + 1, x1) - Math.max(u, x0)
          if (!(wx > 0)) continue
          const w = wx * wy
          const i = (v * raster.width + u) * 4
          acc[0] += raster.data[i] * w
          acc[1] += raster.data[i + 1] * w
          acc[2] += raster.data[i + 2] * w
          acc[3] += raster.data[i + 3] * w
          weight += w
        }
      }
      const o = (y * W + x) * 4
      if (weight > 0) {
        out[o] = Math.round(acc[0] / weight)
        out[o + 1] = Math.round(acc[1] / weight)
        out[o + 2] = Math.round(acc[2] / weight)
        out[o + 3] = Math.round(acc[3] / weight)
      }
    }
  }
  return { width: W, height: H, data: out }
}

/**
 * The pictures a run hands its readers, each at its frame's size. A picture is stored as decoded; once the frames are
 * known, asking for one whose frame is a reading size gives it resampled to that size (once). A picture with no frame,
 * or whose frame is its own size, is given as it is.
 */
export type FrameRasters = {
  set(variantByteHash: string, raster: Raster | undefined): void
  has(variantByteHash: string): boolean
  useFrames(frames: ReadonlyArray<{ variantByteHash: string; size: PixelSize }>): void
  get(variantByteHash: string): Raster | undefined
}

export function frameRasters(): FrameRasters {
  const decoded = new Map<string, Raster | undefined>()
  const sizes = new Map<string, PixelSize>()
  const atSize = new Map<string, Raster>()
  return {
    set(hash, raster) {
      decoded.set(hash, raster)
      atSize.delete(hash)
    },
    has: (hash) => decoded.has(hash),
    useFrames(frames) {
      for (const f of frames) sizes.set(f.variantByteHash, f.size)
      atSize.clear()
    },
    get(hash) {
      const raster = decoded.get(hash)
      const size = sizes.get(hash)
      if (!raster || !size || (size.width === raster.width && size.height === raster.height)) return raster
      let fitted = atSize.get(hash)
      if (!fitted) {
        fitted = resampleRaster(raster, size)
        atSize.set(hash, fitted)
      }
      return fitted
    },
  }
}
