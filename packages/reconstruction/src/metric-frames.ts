/**
 * An elevation registration, as a metric image frame.
 *
 * `ElevationRegistration` is this pipeline's own shorthand: an extent, a
 * scale, and which wall the drawing shows. `MetricImageFrame` is the general
 * contract — anchors, residuals, a transform and an uncertainty — and the two
 * describe the same thing at different levels of detail.
 *
 * Converting between them is worth doing for one reason. The shorthand states
 * a scale and nothing about how well it is supported; the frame is fitted to
 * anchors, holds one back where it can, and reports what it missed by. Running
 * the registration through that fit does not change the number, and it does
 * make the number answerable — which is what the overlays draw and what an
 * `IMAGE_METRIC_REGISTERED` measurement has to be able to cite.
 */
import { registerOrthographic } from '@buildapp/image-metrology'
import type { MetricAnchor, MetricImageFrame } from '@buildapp/image-metrology'
import type { ElevationRegistration } from './views.js'

/**
 * Four anchors from a registration: the two ends of the wall it shows, and
 * the ground and the top of the building it was scaled against.
 *
 * These are REGISTRATION anchors and nothing measured from the frame may be
 * one of them — that is §5's whole point, and it is why an opening measured on
 * this frame is an independent reading of the drawing rather than a restatement
 * of the number the frame was built from.
 */
export function metricFrameOf(registration: ElevationRegistration, id?: string): MetricImageFrame {
  const extent = registration.extent
  const midV = (extent.y0 + extent.y1) / 2
  const midU = (extent.x0 + extent.x1) / 2
  // The silhouette runs past the wall by the eaves projection at each end, so
  // the wall's own ends are inside it by that much.
  const overhangPx = registration.overhangM / Math.max(1e-9, registration.metresPerPixelU)
  const anchor = (anchorId: string, u: number, v: number, metric: { x?: number; y?: number }, kind: string, why: string): MetricAnchor => ({
    id: anchorId,
    pixel: { u, v },
    metric,
    pixelSigma: 1,
    // The scale came from the section's ladder and the plan's chains, which
    // are printed numbers; what is uncertain is where the outline is, not what
    // it measures.
    metricSigma: 0.01,
    kind,
    evidenceIds: [],
    why,
  })
  const anchors: MetricAnchor[] = [
    anchor('wall-start', extent.x0 + overhangPx, midV, { x: 0 }, 'WALL_FACE', `the left-hand end of the ${String(registration.side).toLowerCase()} wall, inside the ${registration.overhangM} m the roof projects past it`),
    anchor('wall-end', extent.x1 - overhangPx, midV, { x: registration.spanM }, 'WALL_FACE', `the right-hand end of the same wall, ${registration.spanM} m along it`),
    anchor('ground', midU, extent.y1, { y: 0 }, 'DATUM', 'the ground line the outline stands on'),
    anchor('top', midU, extent.y0, { y: registration.heightM }, 'ROOF_TOP', `the top of the outline, which the section measures at ${registration.heightM} m`),
  ]
  const frame = registerOrthographic(
    {
      id: id ?? `metric-${registration.frameId}`,
      assetId: registration.assetId,
      sourceFrameId: registration.frameId,
      horizontalAxis: registration.side === 'LEFT' || registration.side === 'RIGHT' ? 'Z' : 'X',
      region: extent,
      anchors,
    },
    // A published raster is resized without much care, and this registration
    // deliberately fits one scale to the height and lets the width measure the
    // overhang, so the two axes are not expected to match to a per cent.
    { maxAnisotropy: 2.5, holdOut: false },
  )
  return frame
}
