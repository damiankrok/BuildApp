/**
 * §22. The picture, with everything the registration believes drawn on it.
 *
 * A `MetricImageFrame` is a transform, a list of anchors and a set of
 * residuals, and a list of residuals is exactly the wrong way to find out that
 * an anchor is on a downpipe. So every registered image gets an SVG with the
 * drawing underneath and the registration on top: where each anchor is and
 * how far the fit missed it, which one was held back as the independent
 * check, a metric grid ruled across the picture in the drawing's own metres,
 * and every measurement taken from it with its error bar.
 *
 * The grid is the part worth opening a file for. A registration that is a few
 * per cent out looks perfectly convincing as a number and is obvious the
 * moment its one-metre ticks are laid over a building whose storeys are three
 * metres: they drift. Nothing else here is as quick to disbelieve.
 */
import type { ImageMetricMeasurement, MetricImageFrame } from './frame.js'
import { toPixel } from './frame.js'

export type OverlayOptions = {
  /** The drawing itself, as anything an `<image href>` accepts — normally a data URI. */
  imageHref?: string
  width: number
  height: number
  measurements?: readonly ImageMetricMeasurement[]
  /** Metres between the fine ticks; every fifth is drawn heavier. */
  gridM?: number
  title?: string
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const n = (v: number): string => (Number.isFinite(v) ? v.toFixed(2) : '0')

/** One registered image, drawn. */
export function registrationOverlay(frame: MetricImageFrame, options: OverlayOptions): string {
  const grid = options.gridM ?? 0.5
  const parts: string[] = []
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${options.width}" height="${options.height}" viewBox="0 0 ${options.width} ${options.height}" font-family="ui-monospace, monospace">`)
  parts.push(`<title>${esc(options.title ?? frame.id)}</title>`)
  if (options.imageHref) parts.push(`<image href="${esc(options.imageHref)}" x="0" y="0" width="${options.width}" height="${options.height}"/>`)
  parts.push(`<rect x="0" y="0" width="${options.width}" height="${options.height}" fill="#ffffff" fill-opacity="${options.imageHref ? 0 : 1}"/>`)

  // The region the registration speaks for. Outside it, nothing.
  const r = frame.region
  parts.push(`<rect x="${n(r.x0)}" y="${n(r.y0)}" width="${n(r.x1 - r.x0)}" height="${n(r.y1 - r.y0)}" fill="none" stroke="#0f766e" stroke-width="1.5" stroke-dasharray="6 4"/>`)

  if (frame.transform.kind === 'ORTHOGRAPHIC_AFFINE') {
    // A metric grid, in the drawing's own metres. Where the registration is
    // wrong these drift visibly across the building.
    const corners = [toPixel(frame, 0, 0), toPixel(frame, 1, 0), toPixel(frame, 0, 1)]
    if (corners.every((p) => Number.isFinite(p.u) && Number.isFinite(p.v))) {
      const span = (from: { u: number; v: number }, to: { u: number; v: number }): number => Math.hypot(to.u - from.u, to.v - from.v)
      const perMetreU = span(corners[0], corners[1])
      const perMetreV = span(corners[0], corners[2])
      const ticks: string[] = []
      if (perMetreU > 1) {
        for (let m = -40; m <= 80; m += grid) {
          const a = toPixel(frame, m, -20)
          const b = toPixel(frame, m, 40)
          if (!Number.isFinite(a.u)) continue
          const heavy = Math.abs(m % (grid * 2)) < 1e-6
          ticks.push(`<line x1="${n(a.u)}" y1="${n(a.v)}" x2="${n(b.u)}" y2="${n(b.v)}" stroke="#0ea5e9" stroke-opacity="${heavy ? 0.5 : 0.22}" stroke-width="${heavy ? 1 : 0.6}"/>`)
        }
      }
      if (perMetreV > 1) {
        for (let m = -10; m <= 40; m += grid) {
          const a = toPixel(frame, -40, m)
          const b = toPixel(frame, 80, m)
          if (!Number.isFinite(a.u)) continue
          const heavy = Math.abs(m % (grid * 2)) < 1e-6
          ticks.push(`<line x1="${n(a.u)}" y1="${n(a.v)}" x2="${n(b.u)}" y2="${n(b.v)}" stroke="#0ea5e9" stroke-opacity="${heavy ? 0.5 : 0.22}" stroke-width="${heavy ? 1 : 0.6}"/>`)
        }
      }
      parts.push(`<g clip-path="url(#region)">${ticks.join('')}</g>`)
      parts.push(`<clipPath id="region"><rect x="${n(r.x0)}" y="${n(r.y0)}" width="${n(r.x1 - r.x0)}" height="${n(r.y1 - r.y0)}"/></clipPath>`)
    }
  }

  // The anchors, and how far the fit missed each of them.
  const held = new Set(frame.independentCheckAnchorIds)
  for (const anchor of frame.anchors) {
    const residual = frame.residuals.find((x) => x.anchorId === anchor.id)
    const missed = Math.max(Math.abs(residual?.residualXM ?? 0), Math.abs(residual?.residualYM ?? 0))
    const colour = held.has(anchor.id) ? '#c026d3' : residual?.inlier === false ? '#dc2626' : '#16a34a'
    parts.push(`<g>`)
    parts.push(`<circle cx="${n(anchor.pixel.u)}" cy="${n(anchor.pixel.v)}" r="5" fill="none" stroke="${colour}" stroke-width="2"/>`)
    parts.push(`<circle cx="${n(anchor.pixel.u)}" cy="${n(anchor.pixel.v)}" r="1.5" fill="${colour}"/>`)
    const label = `${anchor.id} ${anchor.metric.x !== undefined ? `x=${anchor.metric.x}` : ''}${anchor.metric.y !== undefined ? ` y=${anchor.metric.y}` : ''} ±${missed.toFixed(3)} m`
    parts.push(`<title>${esc(`${label} — ${residual?.why ?? anchor.why}`)}</title>`)
    parts.push(`<text x="${n(anchor.pixel.u + 8)}" y="${n(anchor.pixel.v - 8)}" font-size="11" fill="${colour}" stroke="#ffffff" stroke-width="3" paint-order="stroke">${esc(label)}</text>`)
    parts.push(`</g>`)
  }

  // Every measurement taken from this frame, where it was read and what it came to.
  for (const m of options.measurements ?? []) {
    if (m.frameId !== frame.id) continue
    const horizontal = m.pixel.u !== undefined
    const interval = m.pixel.u ?? m.pixel.v
    if (!interval) continue
    const across = horizontal ? (r.y0 + r.y1) / 2 : (r.x0 + r.x1) / 2
    const a = horizontal ? { u: interval.from, v: across } : { u: across, v: interval.from }
    const b = horizontal ? { u: interval.to, v: across } : { u: across, v: interval.to }
    const tick = 9
    parts.push(`<g stroke="#b45309" stroke-width="2" fill="none">`)
    parts.push(`<line x1="${n(a.u)}" y1="${n(a.v)}" x2="${n(b.u)}" y2="${n(b.v)}"/>`)
    if (horizontal) {
      parts.push(`<line x1="${n(a.u)}" y1="${n(a.v - tick)}" x2="${n(a.u)}" y2="${n(a.v + tick)}"/>`)
      parts.push(`<line x1="${n(b.u)}" y1="${n(b.v - tick)}" x2="${n(b.u)}" y2="${n(b.v + tick)}"/>`)
    } else {
      parts.push(`<line x1="${n(a.u - tick)}" y1="${n(a.v)}" x2="${n(a.u + tick)}" y2="${n(a.v)}"/>`)
      parts.push(`<line x1="${n(b.u - tick)}" y1="${n(b.v)}" x2="${n(b.u + tick)}" y2="${n(b.v)}"/>`)
    }
    parts.push(`<title>${esc(`${m.quantity}: ${m.why}`)}</title>`)
    parts.push(`</g>`)
    parts.push(
      `<text x="${n((a.u + b.u) / 2)}" y="${n((a.v + b.v) / 2 - 12)}" font-size="12" text-anchor="middle" fill="#b45309" stroke="#ffffff" stroke-width="3" paint-order="stroke">${esc(`${m.valueM.toFixed(3)} ± ${m.uncertaintyM.toFixed(3)} m`)}</text>`,
    )
  }

  const status = frame.status === 'METRIC_FRAME_VALID' ? '#16a34a' : frame.status === 'METRIC_FRAME_PARTIAL' ? '#b45309' : '#dc2626'
  const lines = [
    `${frame.id} — ${frame.projection}, ${frame.status}`,
    frame.transform.kind === 'ORTHOGRAPHIC_AFFINE'
      ? `${(frame.transform.metresPerPixelU * 1000).toFixed(2)} × ${(frame.transform.metresPerPixelV * 1000).toFixed(2)} mm/px, anisotropy ${frame.transform.anisotropy.toFixed(3)}`
      : frame.transform.kind,
    `rms ${frame.metricResidualM.toFixed(3)} m, worst ${frame.uncertainty.anchorMaxM.toFixed(3)} m, grid ${grid} m`,
    frame.why,
  ]
  parts.push(`<rect x="8" y="8" width="${Math.min(options.width - 16, 760)}" height="${18 * lines.length + 12}" fill="#ffffff" fill-opacity="0.86" stroke="${status}" stroke-width="2"/>`)
  lines.forEach((line, i) => parts.push(`<text x="16" y="${28 + i * 18}" font-size="12" fill="#0f172a">${esc(line.slice(0, 150))}</text>`))
  parts.push('</svg>')
  return parts.join('\n')
}
