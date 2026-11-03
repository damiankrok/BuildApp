/**
 * SHAPE-LIVE-01: what the highest datum a reader managed to read off a section stands for.
 *
 * `levelsFrom` takes the highest printed datum for the ridge: a section of a pitched house marks its floors, the eaves
 * and the ridge, and the apex is the highest mark. That holds only when the apex mark WAS read. A section's
 * small italic labels are read selectively (precision before recall: a misread digit is refused, not forced), and when
 * the ridge's label is the one refused, the highest datum left is the eaves or the attic floor — and taking it for the
 * ridge puts the roof's apex at the eaves: an attic house comes out as a box with its roof sunk below its own walls.
 *
 * The section's own drawing tells the two apart without reading any more text. With two printed datums the sheet has a
 * vertical scale (their values over their rows); a roof is ink, drawn above the datum line, across much of the
 * building's width. A datum with the drawing's roof standing well above it over a wide part of the building is not
 * the building's top. A chimney is narrow and does not count. Whether the datum's row carries a slab — a dark band
 * across much of the building — is reported for the trace; either way the datum is the top of the walls below it and
 * never a storey of its own (`levelsFrom`).
 *
 * Nothing here is read off text and nothing is guessed: the rule only REFUSES the ridge reading. What the ridge is
 * then is left to the roof's own rules (`roof-datum.ts`: the printed knee wall, the pitch and the published height),
 * which say ASSUMED_FOR_RENDERING.
 */
import type { Raster } from '@buildapp/source-cv'
import { lumaAt } from './scan.js'

/** How far above the top datum (in metres, on the section's own scale) ink counts as standing above it. */
export const ABOVE_TOP_DATUM_M = 1.5
/** The share of the building's width that must carry ink that far above the top datum: a roof, not a chimney. */
export const ABOVE_TOP_DATUM_SHARE = 0.3
/** The share of the building's width a dark run on the datum's row must span to be a slab. */
const SLAB_SHARE = 0.4
/** Ink darker than this is drawing (walls, slabs, roof lines), not a watermark or a hatch. */
const DARK = 100
/** Two datums closer than this on the sheet give no scale. */
const MIN_ROW_SPAN_PX = 20

export type SectionDatum = { id: string; value: number; row: number }

export type TopDatumReading = {
  /** The section draws its roof well above the top datum: that datum is not the ridge. */
  belowDrawnRoof: boolean
  /** The top datum's row carries a slab (an attic or ceiling slab under the roof). Meaningful only with `belowDrawnRoof`. */
  onSlab: boolean
  /** Metres per pixel, from the two datums farthest apart on the sheet. */
  mPerPx: number
  /** The share of the building's width with ink at least ABOVE_TOP_DATUM_M above the top datum. */
  shareAbove: number
  why: string
}

/**
 * Reads, on the section's raster, whether its drawing stands above the highest of `datums`. Undefined when the sheet
 * gives no scale (fewer than two datums with distinct rows, or rows that contradict their values) or no building.
 */
export function readTopDatum(raster: Raster, datums: ReadonlyArray<SectionDatum>): TopDatumReading | undefined {
  if (datums.length < 2) return undefined
  const sorted = [...datums].sort((a, b) => a.value - b.value)
  const top = sorted[sorted.length - 1]
  const low = sorted[0]
  if (low.row - top.row < MIN_ROW_SPAN_PX || top.value - low.value <= 0) return undefined
  const mPerPx = (top.value - low.value) / (low.row - top.row)
  // every datum must sit on the scale the two extremes give: a marker placed off its line is no scale
  for (const d of sorted) {
    const predicted = low.row - (d.value - low.value) / mPerPx
    if (Math.abs(predicted - d.row) > Math.max(6, 0.08 * (low.row - top.row))) return undefined
  }
  // the building: the columns that carry dark ink between the top datum and the lowest floor (a terrain datum below
  // ±0.00 sits beside the building, on the ground line that runs the sheet's whole width)
  const floor = sorted.slice(0, -1).find((d) => d.value > -0.05) ?? low
  const y0 = Math.max(0, Math.round(top.row))
  const y1 = Math.min(raster.height - 1, Math.round(floor.row) - 2)
  if (y1 - y0 < MIN_ROW_SPAN_PX) return undefined
  const cols: number[] = []
  for (let x = 0; x < raster.width; x += 1) {
    let dark = 0
    for (let y = y0; y <= y1; y += 2) if (lumaAt(raster, x, y) < DARK) dark += 1
    if (dark >= 2) cols.push(x)
  }
  if (cols.length < 20) return undefined
  const x0 = cols[Math.floor(cols.length * 0.05)]
  const x1 = cols[Math.floor(cols.length * 0.95)]
  const width = x1 - x0 + 1
  if (width < 40) return undefined
  // ink well above the top datum, column by column across the building
  const ceilingRow = Math.round(top.row - ABOVE_TOP_DATUM_M / mPerPx)
  let above = 0
  if (ceilingRow > 0) {
    for (let x = x0; x <= x1; x += 1) {
      for (let y = 0; y <= ceilingRow; y += 1) {
        if (lumaAt(raster, x, y) < DARK) {
          above += 1
          break
        }
      }
    }
  }
  const shareAbove = above / width
  const belowDrawnRoof = shareAbove >= ABOVE_TOP_DATUM_SHARE
  // a slab on the datum's row: the longest dark run near that row, against the building's width
  let longest = 0
  for (let y = Math.round(top.row) - 3; y <= Math.round(top.row) + 8; y += 1) {
    let run = 0
    for (let x = x0; x <= x1; x += 1) {
      if (lumaAt(raster, x, y) < DARK) {
        run += 1
        if (run > longest) longest = run
      } else run = 0
    }
  }
  const onSlab = longest >= SLAB_SHARE * width
  const label = `${top.value >= 0 ? '+' : ''}${top.value.toFixed(2)}`
  const why = belowDrawnRoof
    ? `the section draws ink at least ${ABOVE_TOP_DATUM_M} m above its highest datum read (${label}, on the ${mPerPx.toFixed(4)} m/px its datums give) across ${(shareAbove * 100).toFixed(0)}% of the building's width: a roof stands above that datum, so it is not the ridge; ${onSlab ? 'a slab runs along its row: the slab under the roof, the top of the walls below it' : 'no slab runs along its row: an eave or a wall-head mark'}`
    : `nothing is drawn far above the highest datum read (${label}): ${(shareAbove * 100).toFixed(0)}% of the building's width carries ink ${ABOVE_TOP_DATUM_M} m above it`
  return { belowDrawnRoof, onSlab, mPerPx, shareAbove, why }
}

export type DrawnApex = { ridgeY: number; row: number; column: number; supportLeft: number; supportRight: number; why: string }

/** The share of the building's width each flank of the drawn roof must support, at the stated pitch. */
const FLANK_SUPPORT_SHARE = 0.1

/**
 * The apex of the roof the section DRAWS, on the vertical scale its printed datums give: where the two flanks of the
 * roof's top line, each drawn at the stated pitch, meet. Each column of the building's top outline says where a flank
 * through it at that pitch would cross the sheet's left edge (`row + x·tan`, `row − x·tan`); the flanks are the two
 * intercepts most columns agree on, so a chimney, a label over the apex or a flat part are outvoted, not averaged in.
 * Undefined when the sheet gives no scale, or a flank is not drawn over enough of the building to be one.
 */
export function readDrawnApex(raster: Raster, datums: ReadonlyArray<SectionDatum>, pitchDeg: number): DrawnApex | undefined {
  const top = readTopDatum(raster, datums)
  if (!top || !top.belowDrawnRoof || !(pitchDeg > 5 && pitchDeg < 70)) return undefined
  const sorted = [...datums].sort((a, b) => a.value - b.value)
  const low = sorted[0]
  const zeroRow = low.row + low.value / top.mPerPx
  const floor = sorted.slice(0, -1).find((d) => d.value > -0.05) ?? low
  const highest = sorted[sorted.length - 1]
  const y0 = Math.max(0, Math.round(highest.row))
  const y1 = Math.min(raster.height - 1, Math.round(floor.row) - 2)
  const cols: number[] = []
  for (let x = 0; x < raster.width; x += 1) {
    let dark = 0
    for (let y = y0; y <= y1; y += 2) if (lumaAt(raster, x, y) < DARK) dark += 1
    if (dark >= 2) cols.push(x)
  }
  if (cols.length < 20) return undefined
  const x0 = cols[Math.floor(cols.length * 0.05)]
  const x1 = cols[Math.floor(cols.length * 0.95)]
  const width = x1 - x0 + 1
  const tan = Math.tan((pitchDeg * Math.PI) / 180)
  const left = new Map<number, number>()
  const right = new Map<number, number>()
  const bin = (v: number): number => Math.round(v / 2)
  for (let x = x0; x <= x1; x += 1) {
    let row: number | undefined
    for (let y = 0; y < highest.row; y += 1) {
      if (lumaAt(raster, x, y) < DARK) {
        row = y
        break
      }
    }
    if (row === undefined) continue
    const l = bin(row + (x - x0) * tan)
    const r = bin(row - (x - x0) * tan)
    left.set(l, (left.get(l) ?? 0) + 1)
    right.set(r, (right.get(r) ?? 0) + 1)
  }
  // a flank is the best pair of neighbouring bins: a line drawn at the pitch, give or take a pixel
  const mode = (m: Map<number, number>): { at: number; n: number } => {
    let best = { at: 0, n: 0 }
    for (const [k, n] of m) {
      const both = n + (m.get(k + 1) ?? 0)
      if (both > best.n) best = { at: k + ((m.get(k + 1) ?? 0) > 0 ? 0.5 : 0), n: both }
    }
    return { at: best.at * 2, n: best.n }
  }
  const L = mode(left)
  const R = mode(right)
  if (L.n < FLANK_SUPPORT_SHARE * width || R.n < FLANK_SUPPORT_SHARE * width) return undefined
  // L: row = L.at − u·tan, R: row = R.at + u·tan (u = x − x0) → they meet at u = (L.at − R.at) / (2·tan)
  const u = (L.at - R.at) / (2 * tan)
  const row = L.at - u * tan
  const column = Math.round(x0 + u)
  if (column <= x0 || column >= x1 || row <= 0) return undefined
  const ridgeY = Math.round((zeroRow - row) * top.mPerPx * 1000) / 1000
  const label = `${highest.value >= 0 ? '+' : ''}${highest.value.toFixed(2)}`
  if (!(ridgeY > highest.value + ABOVE_TOP_DATUM_M)) return undefined
  const why = `the ridge's label was not read; the section draws its roof's two flanks at the stated ${pitchDeg}° (${L.n} and ${R.n} of the building's ${width} columns agree on each), meeting at row ${row.toFixed(0)}, which the sheet's datums (up to ${label}, ${top.mPerPx.toFixed(4)} m/px) put at ${ridgeY.toFixed(2)} m — measured on the drawing, not printed`
  return { ridgeY, row, column, supportLeft: L.n, supportRight: R.n, why }
}
