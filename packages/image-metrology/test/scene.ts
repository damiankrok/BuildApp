/**
 * Synthetic elevations with known metric truth, and the whole chain run over
 * them: find the building, refine its edges, register it against the two
 * dimensions a drawing would print, and measure the openings.
 *
 * Nothing here tells the chain the scale. It is derived from anchors that say
 * only "this pixel is the left wall face, which is at x = 0" and "this pixel
 * is the eaves, which is 6.5 m up" — exactly what a printed overall dimension
 * gives you — and everything else is measured.
 */
import type { Raster } from '@buildapp/source-cv'
import { architecturalBounds, measureHorizontal, measureVertical, refineEdge, registerOrthographic } from '../src/index.js'
import type { ImageMetricMeasurement, MetricAnchor, MetricImageFrame } from '../src/index.js'

export type Opening = { id: string; x0: number; x1: number; y0: number; y1: number; mullions?: number }
export type Scene = { widthM: number; heightM: number; gableM?: number; openings: Opening[] }

export type Painted = { raster: Raster; pxPerMU: number; pxPerMV: number; originU: number; groundV: number }

const set = (r: Raster, x: number, y: number, value: number): void => {
  if (x < 0 || y < 0 || x >= r.width || y >= r.height) return
  const i = (y * r.width + x) * 4
  r.data[i] = value
  r.data[i + 1] = value
  r.data[i + 2] = value
}

/** Render a scene at a stated scale, optionally squashed on one axis. */
export function paint(scene: Scene, pxPerM: number, options: { margin?: number; squash?: number; sky?: boolean } = {}): Painted {
  const margin = options.margin ?? 90
  const squash = options.squash ?? 1
  const pxPerMU = pxPerM
  const pxPerMV = pxPerM * squash
  const top = scene.heightM + (scene.gableM ?? 0)
  const width = Math.round(scene.widthM * pxPerMU + margin * 2)
  const height = Math.round(top * pxPerMV + margin * 2)
  const raster: Raster = { width, height, data: new Uint8ClampedArray(width * height * 4).fill(255) }
  const originU = margin
  const groundV = height - margin
  const U = (x: number): number => originU + x * pxPerMU
  const V = (y: number): number => groundV - y * pxPerMV

  // Sky, so the building is not the only thing with an edge in the picture.
  if (options.sky !== false) for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) set(raster, x, y, 252 - Math.round((y / height) * 14))

  const box = (x0: number, y0: number, x1: number, y1: number, value: number): void => {
    for (let v = Math.round(V(y1)); v <= Math.round(V(y0)); v += 1) for (let u = Math.round(U(x0)); u <= Math.round(U(x1)); u += 1) set(raster, u, v, value)
  }

  box(0, 0, scene.widthM, scene.heightM, 190)
  // A gable, drawn as the two rakes it is: no horizontal or vertical edge at
  // the apex, which is the honest shape of the problem. In a roof tone, so the
  // eaves below it is a real edge rather than a line between two equal greys.
  if (scene.gableM) {
    const mid = scene.widthM / 2
    for (let u = Math.round(U(0)); u <= Math.round(U(scene.widthM)); u += 1) {
      const x = (u - originU) / pxPerMU
      const y = scene.heightM + scene.gableM * (1 - Math.abs(x - mid) / mid)
      for (let v = Math.round(V(y)); v <= Math.round(V(scene.heightM)); v += 1) set(raster, u, v, 120)
    }
  }
  box(0, 0, scene.widthM, 0.35, 128)
  for (const o of scene.openings) {
    box(o.x0, o.y0, o.x1, o.y1, 52)
    // §7: mullions are inside the host cut. They must not change its width.
    for (let m = 1; m <= (o.mullions ?? 0); m += 1) {
      const at = o.x0 + ((o.x1 - o.x0) * m) / ((o.mullions ?? 0) + 1)
      box(at - 0.03, o.y0, at + 0.03, o.y1, 186)
    }
  }
  // Ground, running off both sides of the frame the way ground does.
  for (let u = 0; u < width; u += 1) for (let v = groundV; v <= groundV + 2 && v < height; v += 1) set(raster, u, v, 140)
  return { raster, pxPerMU, pxPerMV, originU, groundV }
}

/** Register a painted scene knowing only its two overall dimensions. */
export function registerScene(raster: Raster, scene: Scene, id = 'frame'): MetricImageFrame | null {
  const bounds = architecturalBounds(raster)
  if (!bounds) return null
  const band = { from: bounds.rect.y0 + (bounds.rect.y1 - bounds.rect.y0) * 0.45, to: bounds.rect.y1 - (bounds.rect.y1 - bounds.rect.y0) * 0.1 }
  const across = { from: bounds.rect.x0 + (bounds.rect.x1 - bounds.rect.x0) * 0.1, to: bounds.rect.x1 - (bounds.rect.x1 - bounds.rect.x0) * 0.1 }
  const left = refineEdge(raster, { axis: 'VERTICAL', nearPx: bounds.rect.x0, searchPx: 6, within: band })
  const right = refineEdge(raster, { axis: 'VERTICAL', nearPx: bounds.rect.x1, searchPx: 6, within: band })
  const ground = refineEdge(raster, { axis: 'HORIZONTAL', nearPx: bounds.rect.y1, searchPx: 6, within: across })
  const eaves = refineEdge(raster, { axis: 'HORIZONTAL', nearPx: bounds.rect.y0, searchPx: 6, within: across })
  if (!left || !right || !ground || !eaves) return null

  const anchor = (anchorId: string, edge: { atPx: number; sigmaPx: number }, at: number, metric: { x?: number; y?: number }, kind: string): MetricAnchor => ({
    id: anchorId,
    pixel: metric.x === undefined ? { u: at, v: edge.atPx } : { u: edge.atPx, v: at },
    metric,
    pixelSigma: edge.sigmaPx,
    // A printed overall dimension is exact to the millimetre it is printed to.
    metricSigma: 0.001,
    kind,
    evidenceIds: [`printed:${anchorId}`],
    why: 'a printed overall dimension',
  })
  const midV = (band.from + band.to) / 2
  const midU = (across.from + across.to) / 2
  return registerOrthographic({
    id,
    assetId: 'scene',
    horizontalAxis: 'X',
    region: bounds.rect,
    anchors: [
      anchor('wall-left', left, midV, { x: 0 }, 'WALL_FACE'),
      anchor('wall-right', right, midV, { x: scene.widthM }, 'WALL_FACE'),
      anchor('ground', ground, midU, { y: 0 }, 'DATUM'),
      anchor('eaves', eaves, midU, { y: scene.heightM }, 'EAVES'),
    ],
  })
}

/**
 * Measure one opening, given a PROPOSAL that is deliberately wrong.
 *
 * §15: a proposal is not geometry. The detector says "about here" and is
 * allowed to be a dozen pixels out; what comes back has to be where the reveal
 * actually is, or the whole idea does not work.
 */
export function measureOpening(
  raster: Raster,
  frame: MetricImageFrame,
  o: Opening,
  proposal: { u0: number; u1: number; v0: number; v1: number },
  searchPx: number,
): { width: ImageMetricMeasurement; height: ImageMetricMeasurement } | null {
  const inset = (proposal.v0 - proposal.v1) * 0.2
  const band = { from: proposal.v1 + inset, to: proposal.v0 - inset }
  const across = { from: proposal.u0 + (proposal.u1 - proposal.u0) * 0.2, to: proposal.u1 - (proposal.u1 - proposal.u0) * 0.2 }
  const l = refineEdge(raster, { axis: 'VERTICAL', nearPx: proposal.u0, searchPx, within: band, minCoverageFraction: 0.6 })
  const r = refineEdge(raster, { axis: 'VERTICAL', nearPx: proposal.u1, searchPx, within: band, minCoverageFraction: 0.6 })
  const head = refineEdge(raster, { axis: 'HORIZONTAL', nearPx: proposal.v1, searchPx, within: across, minCoverageFraction: 0.6 })
  const sill = refineEdge(raster, { axis: 'HORIZONTAL', nearPx: proposal.v0, searchPx, within: across, minCoverageFraction: 0.6 })
  if (!l || !r || !head || !sill) return null
  return {
    width: measureHorizontal(frame, { id: `${o.id}-w`, quantity: 'OPENING_WIDTH', from: l.atPx, to: r.atPx, fromSigmaPx: l.sigmaPx, toSigmaPx: r.sigmaPx, role: 'INDEPENDENT_MEASUREMENT' }),
    height: measureVertical(frame, { id: `${o.id}-h`, quantity: 'OPENING_HEIGHT', from: sill.atPx, to: head.atPx, fromSigmaPx: sill.sigmaPx, toSigmaPx: head.sigmaPx, role: 'INDEPENDENT_MEASUREMENT' }),
  }
}

export const medianOf = (values: readonly number[]): number => {
  const s = [...values].sort((a, b) => a - b)
  return s.length === 0 ? 0 : s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}
