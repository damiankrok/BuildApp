/**
 * v3.45: the roof pitch printed on a section (`40°`), read along the slope it labels and admitted only by that slope.
 *
 * Measured on 23 development sections before this reader: 0 of 22 legible pitch labels read, and 4 template readings
 * that were wrong (`15°`, `1°`, `33°`). The label is printed parallel to the roof edge, so an upright reader sees it at
 * 30–45° and cannot read it. A section is drawn at true aspect: the edge's drawn slope IS the pitch, which gives the
 * check a reading must pass.
 *
 * For each roof edge the section's observations measured (at least `MIN_EDGE_PX` long, 10–80° from horizontal), a strip
 * parallel to it on its upper side is resampled upright (`stripAlong`), the words of ink in it are cut, and the shipped
 * numeric recogniser reads each. A reading is heard when its unconstrained decode is one two-digit number with nothing but
 * a degree-like mark after it, at mean probability `MIN_MEAN_P`, the digit beam reading the same digits; it stands when
 * that number equals the edge's drawn slope within `SLOPE_TOLERANCE_DEG`. Nothing else is assumed: no typical pitch, no
 * other edge's angle.
 */
import type { PixelPoint, PixelRect } from '@buildapp/source-common'
import type { Gray } from '@buildapp/source-cv'
import { inkWords } from './level-marks.js'
import { labelCrop } from './recogniser.js'
import type { ExternalReading, LabelCrop } from './recogniser.js'

export const SECTION_ANGLES_NAME = 'metrics.section-angles' as const
export const SECTION_ANGLES_VERSION = '1.0.0' as const
export const MIN_EDGE_PX = 80
export const SLOPE_TOLERANCE_DEG = 1
/**
 * The unconstrained decode's mean probability a pitch reading needs. Lower than a level mark's (0.9): the degree mark
 * costs the decode its mean (correct `35°`, `40°`, `45º` read at 0.85–0.90 on DEV sections), and the drawn slope —
 * an independent witness no level mark has — must agree to the degree as well as the digit beam.
 */
export const MIN_ANGLE_MEAN_P = 0.8
/** The strip's reach across the edge, px (negative: below it): the pitch label stands on either side. */
export const STRIP = { fromPx: -50, toPx: 80 } as const
/** A label is beside an edge when its centre is within this of the edge's line and over its extent. */
export const BESIDE_PX = 90

export type RoofEdge = { id: string; a: PixelPoint; b: PixelPoint }
export type AngleLabel = { key: string; edge: RoofEdge; slopeDeg: number; box: PixelRect; corners: PixelPoint[]; besideSlopes: number[] }

/** The edge's drawn slope from horizontal, degrees (0–90), and the unit vector along it pointing right. */
export function edgeSlope(e: RoofEdge): { deg: number; ux: number; uy: number; length: number } {
  let dx = e.b.x - e.a.x
  let dy = e.b.y - e.a.y
  if (dx < 0) {
    dx = -dx
    dy = -dy
  }
  const length = Math.hypot(dx, dy)
  return { deg: Math.abs((Math.atan2(dy, dx) * 180) / Math.PI), ux: dx / Math.max(1e-9, length), uy: dy / Math.max(1e-9, length), length }
}

/**
 * The gray strip above an edge, resampled so the edge is horizontal at its bottom and text printed along it is upright:
 * column s is s px along the edge (left to right), row k is (STRIP.toPx − k) px above it. Bilinear; off-sheet is paper.
 */
export function stripAlong(gray: Gray, e: RoofEdge): { strip: Gray; toSheet: (s: number, k: number) => PixelPoint } {
  const { ux, uy, length } = edgeSlope(e)
  const a = e.b.x - e.a.x >= 0 ? e.a : e.b
  // the normal pointing up the sheet (rows decrease)
  const nx = uy
  const ny = -ux
  const W = Math.max(1, Math.round(length))
  const H = STRIP.toPx - STRIP.fromPx + 1
  const toSheet = (s: number, k: number): PixelPoint => {
    const o = STRIP.toPx - k
    return { x: a.x + ux * s + nx * o, y: a.y + uy * s + ny * o }
  }
  const at = (x: number, y: number): number => {
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const fx = x - x0
    const fy = y - y0
    const px = (xx: number, yy: number): number => (xx < 0 || yy < 0 || xx >= gray.width || yy >= gray.height ? 255 : gray.data[yy * gray.width + xx])
    return (1 - fy) * ((1 - fx) * px(x0, y0) + fx * px(x0 + 1, y0)) + fy * ((1 - fx) * px(x0, y0 + 1) + fx * px(x0 + 1, y0 + 1))
  }
  const data = new Uint8ClampedArray(W * H)
  for (let k = 0; k < H; k += 1)
    for (let s = 0; s < W; s += 1) {
      const p = toSheet(s, k)
      data[k * W + s] = Math.round(at(p.x, p.y))
    }
  return { strip: { width: W, height: H, data }, toSheet }
}

/** The pitch labels to read: words of ink in each long roof edge's strip, with their crops. */
export function angleLabels(gray: Gray, edges: readonly RoofEdge[]): { labels: AngleLabel[]; crops: LabelCrop[] } {
  const labels: AngleLabel[] = []
  const crops: LabelCrop[] = []
  for (const e of edges) {
    const sl = edgeSlope(e)
    if (sl.length < MIN_EDGE_PX || sl.deg < 10 || sl.deg > 80) continue
    const { strip, toSheet } = stripAlong(gray, e)
    const edgeRow = STRIP.toPx
    for (const w of inkWords(strip)) {
      // a word the edge's own ink runs through is no label
      if (w.y0 <= edgeRow + 1 && w.y1 >= edgeRow - 1) continue
      const corners = [toSheet(w.x0, w.y0), toSheet(w.x1, w.y0), toSheet(w.x1, w.y1), toSheet(w.x0, w.y1)]
      const box = { x0: Math.min(...corners.map((c) => c.x)), x1: Math.max(...corners.map((c) => c.x)), y0: Math.min(...corners.map((c) => c.y)), y1: Math.max(...corners.map((c) => c.y)) }
      // the same label seen from two parallel edges of one roof is one label
      if (labels.some((l) => Math.min(l.box.x1, box.x1) - Math.max(l.box.x0, box.x0) > 0 && Math.min(l.box.y1, box.y1) - Math.max(l.box.y0, box.y0) > 0)) continue
      const key = `A${labels.length}`
      // every long roof edge the label stands beside (centre within BESIDE_PX of its line, over its extent)
      const cx = (box.x0 + box.x1) / 2
      const cy = (box.y0 + box.y1) / 2
      const besideSlopes = edges
        .filter((f) => {
          const fs = edgeSlope(f)
          if (fs.length < MIN_EDGE_PX || fs.deg < 10 || fs.deg > 80) return false
          const fa = f.b.x - f.a.x >= 0 ? f.a : f.b
          const along = (cx - fa.x) * fs.ux + (cy - fa.y) * fs.uy
          const across = Math.abs(-(cx - fa.x) * fs.uy + (cy - fa.y) * fs.ux)
          return along >= -10 && along <= fs.length + 10 && across <= BESIDE_PX
        })
        .map((f) => edgeSlope(f).deg)
      labels.push({ key, edge: e, slopeDeg: sl.deg, box, corners, besideSlopes })
      crops.push(labelCrop(key, strip, w))
    }
  }
  return { labels, crops }
}

const ANGLE = /^\D{0,2}?(\d{2})\s?([°º˚o0]?)\D{0,2}$/

export type AngleVerdict = { label: AngleLabel; value?: number; text?: string; why: string }

/** What each recogniser reading of a pitch label says, and whether the slope it labels admits it. */
export function judgeAngles(labels: readonly AngleLabel[], readings: readonly ExternalReading[]): AngleVerdict[] {
  const byKey = new Map(readings.map((r) => [r.key, r]))
  return labels.map((label) => {
    const r = byKey.get(label.key)
    if (!r) return { label, why: 'the recogniser returned nothing for the label' }
    const m = r.greedy.text.trim().match(ANGLE)
    if (!m) return { label, why: `"${r.greedy.text}" is not one two-digit number with a degree mark` }
    if (r.greedy.meanP < MIN_ANGLE_MEAN_P) return { label, why: `read "${r.greedy.text}" at mean probability ${r.greedy.meanP}, under ${MIN_ANGLE_MEAN_P}` }
    const digits = m[1]
    if (!r.topK.slice(0, 2).some((k) => k.text === digits || k.text === `${digits}0`)) return { label, why: `the digit beam reads ${r.topK.slice(0, 2).map((k) => k.text).join(' or ')}, not ${digits}` }
    const value = Number(digits)
    const slopes = label.besideSlopes.length > 0 ? label.besideSlopes : [label.slopeDeg]
    const match = slopes.find((d) => Math.abs(value - d) <= SLOPE_TOLERANCE_DEG)
    if (match === undefined) return { label, why: `reads ${value}° beside edges drawn at ${slopes.map((d) => d.toFixed(1)).join(', ')}°: the drawing refuses it` }
    return { label, value, text: `${digits}°`, why: `read "${r.greedy.text}" (mean ${r.greedy.meanP}) beside an edge drawn at ${match.toFixed(1)}°` }
  })
}
