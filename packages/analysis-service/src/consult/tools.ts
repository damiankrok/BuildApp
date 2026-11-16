/**
 * v3.54.2 pilot — the consultant's local tools. Everything they return is cut from the frozen bytes of this run's own
 * package, at the frame's pixel grid, with the transform back to it stated; nothing is fetched and nothing is computed
 * that the analyzer did not already hold. A tool result is data for the model, never an instruction to it.
 */
import type { Raster } from '@buildapp/source-cv'
import type { MetricEvidenceSet } from '@buildapp/source-metrics'
import { encodePng } from '../diagnostics.js'
import type { Region } from './contract.js'
import type { LabelItem, LabelProblem } from './problems.js'

/** The largest picture side sent (the provider resamples anything larger; we would rather choose the crop ourselves). */
export const MAX_SIDE = 1400
/** The most pixels of source a region may ask for (a larger area is not a region, it is the sheet). */
export const MAX_REGION_PX = 900 * 900

export type ToolImage = { png: Uint8Array; width: number; height: number; transform: { frameId: string; x0: number; y0: number; scale: number } }

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

/** A region of a frame raster, upscaled by a whole factor (nearest neighbour: no pixel is invented) to a readable size. */
export function cropOf(raster: Raster, frameId: string, region: Region, opts: { minSide?: number; maxScale?: number } = {}): ToolImage {
  const x0 = clamp(Math.floor(region.x0), 0, raster.width - 1)
  const y0 = clamp(Math.floor(region.y0), 0, raster.height - 1)
  const x1 = clamp(Math.ceil(region.x1), x0 + 1, raster.width)
  const y1 = clamp(Math.ceil(region.y1), y0 + 1, raster.height)
  const w = x1 - x0
  const h = y1 - y0
  const want = opts.minSide ?? 240
  const scale = clamp(Math.floor(Math.min(want / Math.min(w, h), MAX_SIDE / Math.max(w, h))), 1, opts.maxScale ?? 8)
  const out = new Uint8ClampedArray(w * scale * h * scale * 4)
  for (let y = 0; y < h * scale; y += 1) {
    const sy = y0 + Math.floor(y / scale)
    for (let x = 0; x < w * scale; x += 1) {
      const sx = x0 + Math.floor(x / scale)
      const si = (sy * raster.width + sx) * 4
      const di = (y * w * scale + x) * 4
      out[di] = raster.data[si]
      out[di + 1] = raster.data[si + 1]
      out[di + 2] = raster.data[si + 2]
      out[di + 3] = 255
    }
  }
  return { png: encodePng({ width: w * scale, height: h * scale, data: out }), width: w * scale, height: h * scale, transform: { frameId, x0, y0, scale } }
}

/** The whole frame with each asked label outlined (red), downscaled only if it is larger than `MAX_SIDE`. */
export function overviewOf(raster: Raster, frameId: string, labels: readonly LabelItem[]): ToolImage {
  const data = new Uint8ClampedArray(raster.data)
  const put = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= raster.width || y >= raster.height) return
    const i = (y * raster.width + x) * 4
    data[i] = 230
    data[i + 1] = 20
    data[i + 2] = 20
    data[i + 3] = 255
  }
  for (const l of labels) {
    const m = 3
    const [x0, y0, x1, y1] = [Math.floor(l.box.x0) - m, Math.floor(l.box.y0) - m, Math.ceil(l.box.x1) + m, Math.ceil(l.box.y1) + m]
    for (let x = x0; x <= x1; x += 1) {
      put(x, y0)
      put(x, y1)
    }
    for (let y = y0; y <= y1; y += 1) {
      put(x0, y)
      put(x1, y)
    }
  }
  const side = Math.max(raster.width, raster.height)
  if (side <= MAX_SIDE) return { png: encodePng({ width: raster.width, height: raster.height, data }), width: raster.width, height: raster.height, transform: { frameId, x0: 0, y0: 0, scale: 1 } }
  const k = Math.ceil(side / MAX_SIDE)
  const w = Math.floor(raster.width / k)
  const h = Math.floor(raster.height / k)
  const out = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y += 1)
    for (let x = 0; x < w; x += 1) {
      const si = (y * k * raster.width + x * k) * 4
      const di = (y * w + x) * 4
      out[di] = data[si]
      out[di + 1] = data[si + 1]
      out[di + 2] = data[si + 2]
      out[di + 3] = 255
    }
  return { png: encodePng({ width: w, height: h, data: out }), width: w, height: h, transform: { frameId, x0: 0, y0: 0, scale: 1 / k } }
}

/** A label's crop: its box with a margin of one and a half label heights, upscaled to be read. */
export function labelCropOf(raster: Raster, label: LabelItem): ToolImage {
  // the reader's box can miss a glyph (a leading 1, a decimal comma): the margin is generous along the text's run
  const w = label.box.x1 - label.box.x0
  const h = label.box.y1 - label.box.y0
  const short = Math.max(6, Math.min(w, h))
  const long = Math.max(w, h)
  const along = Math.max(12, Math.round(2 * short + 0.6 * long))
  const across = Math.max(10, Math.round(1.5 * short))
  const [mx, my] = w >= h ? [along, across] : [across, along]
  return cropOf(raster, label.frameId, { x0: label.box.x0 - mx, y0: label.box.y0 - my, x1: label.box.x1 + mx, y1: label.box.y1 + my }, { minSide: 220 })
}

/**
 * `get_measurement_context`: what the analyzer holds about a label — its readings by each reader and way up, the span
 * a reading is bound to and the scale each reading would state, the other labels on that line, and the scales the frame
 * weighed. Given only AFTER the consultant has stated its own literal reading (brief §4A).
 */
export function measurementContextOf(metrics: MetricEvidenceSet, problem: LabelProblem, labelId: string): Record<string, unknown> | undefined {
  const label = problem.labels.find((l) => l.labelId === labelId)
  if (!label) return undefined
  const ids = new Set(label.lattices.map((l) => l.latticeId))
  const lat = (metrics.numericLattices ?? []).filter((l) => ids.has(l.id))
  const obs = (metrics.dimensionObservations ?? []).filter((o) => o.ocr && ids.has(o.ocr.latticeId as string))
  const chainIds = new Set(obs.map((o) => o.chainId))
  const others = (metrics.dimensionObservations ?? []).filter((o) => chainIds.has(o.chainId) && !(o.ocr && ids.has(o.ocr.latticeId as string)) && o.binding?.role === 'PRIMARY')
  const solution = (metrics.metricSolutions ?? []).find((s) => s.frameId === problem.frameId)
  return {
    labelId,
    readings: lat.map((l) => ({
      wayUp: l.orientation,
      latticeAsRead: l.asRead,
      latticeClass: l.ocrClass,
      latticeAlternatives: l.sequences.slice(0, 5).map((q) => q.text),
      recogniser: l.external ? { top: l.external.topK[0]?.text ?? '', posterior: l.external.topK[0]?.p ?? 0, ownAnswer: l.external.greedy.text } : null,
      readAs: l.ensemble?.asRead ?? l.asRead,
      decision: l.ensemble?.decision ?? null,
    })),
    boundSpans: obs.map((o) => ({ value: o.rawText, axis: o.axis, spanPx: o.spanPx, role: o.binding?.role ?? null, impliedCmPerPx: o.impliedCmPerPx })),
    otherLabelsOnTheSameLines: others.slice(0, 12).map((o) => ({ value: o.rawText, axis: o.axis, spanPx: o.spanPx, impliedCmPerPx: o.impliedCmPerPx })),
    scalesWeighed: (solution?.hypotheses ?? []).map((h) => ({ cmPerPx: h.cmPerPixel, independentReadings: h.independentGroups, why: h.why })),
  }
}
