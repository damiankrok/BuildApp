/**
 * Turning a validated provider answer into observations.
 *
 * This is the boundary §3 is about. Above it, a provider's answer is a JSON
 * document full of normalized points. Below it, the only thing that exists is
 * a `SourceObservation` on a known frame, carrying the provider's name and
 * version. Nothing in this file can produce a wall, a solid, a mesh or a
 * command, because the builder it writes through has no vocabulary for one.
 *
 * Two adjustments are made here and both are recorded rather than hidden:
 *
 *  - normalized coordinates become pixels on the frame's DECODED size, so a
 *    later stage reads the same units from a model's answer as from a CV
 *    extractor's;
 *  - positional uncertainty is floored at one pixel. A vision model's
 *    coordinates are an estimate; letting one claim to be exact would let a
 *    solver weight a guess like a measurement. When the floor bites, the
 *    provenance says so.
 */
import { round6 } from '@buildapp/source-common'
import type { ObservationGraphBuilder, ExtractorHandle, PixelGeometry, SourceCoordinateFrame, SourceObservation } from '@buildapp/source-observations'
import type { VisionGeometry, VisionObservationResponse, VisionProviderInfo, VisionTask } from './schema.js'

/** The smallest positional tolerance a vision model's answer may carry, in pixels. */
export const MIN_VISION_POSITION_PX = 1

const px = (p: readonly [number, number], size: { width: number; height: number }): { x: number; y: number } => ({ x: round6(p[0] * size.width), y: round6(p[1] * size.height) })

/** Convert a provider's normalized shape into the frame's pixel grid. */
export function toPixelGeometry(g: VisionGeometry, size: { width: number; height: number }): PixelGeometry {
  const pts = g.points.map((p) => px(p, size))
  switch (g.type) {
    case 'POINT':
      return { type: 'POINT', point: pts[0] }
    case 'SEGMENT':
      return { type: 'SEGMENT', a: pts[0], b: pts[1] }
    case 'POLYLINE':
      return { type: 'POLYLINE', points: pts }
    case 'POLYGON':
      return { type: 'POLYGON', points: pts }
    case 'RECT':
      return { type: 'RECT', rect: { x0: Math.min(pts[0].x, pts[1].x), y0: Math.min(pts[0].y, pts[1].y), x1: Math.max(pts[0].x, pts[1].x), y1: Math.max(pts[0].y, pts[1].y) } }
    case 'LINE_FAMILY': {
      const lines: Array<{ a: { x: number; y: number }; b: { x: number; y: number } }> = []
      for (let i = 0; i + 1 < pts.length; i += 2) lines.push({ a: pts[i], b: pts[i + 1] })
      return { type: 'LINE_FAMILY', lines }
    }
  }
}

export type AppliedVision = {
  observations: SourceObservation[]
  relations: number
  /** Observations whose stated tolerance was raised to the floor. */
  flooredUncertainty: number
}

/**
 * Write one validated response onto a builder. The caller supplies the frame,
 * so a provider can never choose which drawing its answer lands on.
 */
export function applyVisionResponse(builder: ObservationGraphBuilder, extractor: ExtractorHandle, frame: SourceCoordinateFrame, response: VisionObservationResponse, provider: VisionProviderInfo, task: VisionTask): AppliedVision {
  if (frame.variantByteHash !== response.assetByteHash) throw new Error(`refusing to apply a ${task} answer about bytes ${response.assetByteHash.slice(0, 12)} to frame ${frame.id}, which is bytes ${frame.variantByteHash.slice(0, 12)}`)

  const larger = Math.max(frame.size.width, frame.size.height)
  let flooredUncertainty = 0
  const observations = response.observations.map((o) => {
    const stated = o.positionUncertaintyNorm * larger
    const positionPx = Math.max(MIN_VISION_POSITION_PX, round6(stated))
    if (positionPx > stated) flooredUncertainty += 1
    const detail = `${provider.id}/${provider.model} on ${task}: ${o.evidence}${positionPx > stated ? ` [tolerance raised to the ${MIN_VISION_POSITION_PX}px floor from ${round6(stated)}px]` : ''}`
    return builder.observe(extractor, {
      frame,
      kind: o.kind,
      pixelGeometry: toPixelGeometry(o.geometry, frame.size),
      semanticHints: o.semanticHints,
      ...(o.value ? { value: o.value } : {}),
      depthLayer: o.depthLayer ?? 'UNKNOWN',
      confidence: o.confidence,
      uncertainty: { positionPx, ...(o.angleUncertaintyDeg !== undefined ? { angleDeg: o.angleUncertaintyDeg } : {}), reason: 'estimated by a vision model from the raster alone' },
      detail,
      alternatives: (o.alternatives ?? []).map((alt) => ({
        why: alt.why,
        confidence: alt.confidence,
        ...(alt.geometry ? { pixelGeometry: toPixelGeometry(alt.geometry, frame.size) } : {}),
        ...(alt.count !== undefined ? { count: alt.count } : {}),
      })),
    })
  })

  let relations = 0
  for (const r of response.relations) {
    const from = observations[r.from]
    const to = observations[r.to]
    // A provider's two entries can collapse to one observation when they are
    // identical readings; a relation between them then says nothing.
    if (!from || !to || from.id === to.id) continue
    builder.relate(extractor, { kind: r.kind, from, to, confidence: r.confidence, why: r.why, detail: `${provider.id}/${provider.model} on ${task}: ${r.why}` })
    relations += 1
  }

  for (const gap of response.notFound ?? []) builder.unresolved(gap, `${provider.id}/${provider.model} looked for this on ${task} and did not find it`, 'MISSING', frame.assetId)

  return { observations, relations, flooredUncertainty }
}
