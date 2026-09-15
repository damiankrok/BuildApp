/**
 * Reading a section.
 *
 * A section is the one drawing that carries heights honestly: level datums,
 * the ridge, the eaves, the slab lines and the pitch angles are all in it,
 * measured rather than foreshortened. It is also the drawing on which a
 * staircase shows its rise, as a chain of alternating treads and risers.
 *
 * As everywhere in this layer, printed numbers are located and not read: the
 * lines are the observation, and what they are worth in metres is a question
 * for a stage that has a scale anchor.
 */
import { angleDeltaDeg, round6 } from '@buildapp/source-common'
import type { PixelPoint } from '@buildapp/source-common'
import { connectedComponents, dominantSlopes } from '@buildapp/source-cv'
import type { Segment } from '@buildapp/source-cv'
import type { ExtractorHandle, ObservationGraphBuilder, SourceCoordinateFrame, SourceObservation } from '@buildapp/source-observations'
import { scaleRect, scaleToFrame, workingSegments } from '../prepare.js'
import type { Prepared } from '../prepare.js'

export type SectionHandles = { levels: ExtractorHandle; roof: ExtractorHandle; stair: ExtractorHandle }

export const SECTION_EXTRACTORS: ReadonlyArray<{ key: keyof SectionHandles; name: string; version: string }> = [
  { key: 'levels', name: 'cv.section-levels', version: '1.0.0' },
  { key: 'roof', name: 'cv.section-roof', version: '1.0.0' },
  { key: 'stair', name: 'cv.section-stair', version: '1.0.0' },
]

export type SectionResult = { levels: SourceObservation[]; pitchLines: SourceObservation[]; ridge: SourceObservation | null; stairChain: SourceObservation | null }

const isHorizontal = (s: Segment): boolean => s.angleDeg < 2 || s.angleDeg > 178
const isVertical = (s: Segment): boolean => Math.abs(s.angleDeg - 90) < 2

/**
 * A staircase in section is a chain of short horizontals and verticals that
 * step monotonically. Found by walking: from the end of a tread, look for a
 * riser starting there, then a tread at the riser's other end, and so on.
 */
function stepChain(segments: readonly Segment[], tolerance: number): PixelPoint[] {
  const horizontals = segments.filter(isHorizontal)
  const verticals = segments.filter(isVertical)
  const near = (p: PixelPoint, q: PixelPoint): boolean => Math.hypot(p.x - q.x, p.y - q.y) <= tolerance
  let best: PixelPoint[] = []
  for (const seed of horizontals) {
    for (const startAtA of [true, false]) {
      const chain: PixelPoint[] = startAtA ? [seed.b, seed.a] : [seed.a, seed.b]
      const usedH = new Set<Segment>([seed])
      const usedV = new Set<Segment>()
      let head = chain[chain.length - 1]
      for (let step = 0; step < 40; step += 1) {
        const riser = verticals.find((v) => !usedV.has(v) && (near(v.a, head) || near(v.b, head)))
        if (!riser) break
        usedV.add(riser)
        head = near(riser.a, head) ? riser.b : riser.a
        chain.push(head)
        const tread = horizontals.find((h) => !usedH.has(h) && (near(h.a, head) || near(h.b, head)))
        if (!tread) break
        usedH.add(tread)
        head = near(tread.a, head) ? tread.b : tread.a
        chain.push(head)
      }
      if (chain.length > best.length) best = chain
    }
  }
  // Four points is a corner; a staircase needs several steps before the
  // pattern means anything.
  return best.length >= 9 ? best : []
}

export function extractSection(builder: ObservationGraphBuilder, frame: SourceCoordinateFrame, prepared: Prepared, handles: SectionHandles): SectionResult {
  const { mask, scale } = prepared
  const working = workingSegments(prepared)
  const larger = Math.max(prepared.size.width, prepared.size.height)
  const result: SectionResult = { levels: [], pitchLines: [], ridge: null, stairChain: null }

  const components = connectedComponents(mask, { minPixels: Math.max(40, Math.round(mask.width * mask.height * 0.0004)) })
  const body = components.length > 0 ? components.reduce((a, c) => (c.pixels > a.pixels ? c : a)) : null
  const bodyRect = body ? body.bounds : { x0: 0, y0: 0, x1: prepared.workingSize.width - 1, y1: prepared.workingSize.height - 1 }
  const bodyWidth = bodyRect.x1 - bodyRect.x0

  // ---- level datums -------------------------------------------------------
  const longHorizontals = working.all.filter((s) => isHorizontal(s) && s.length >= bodyWidth * 0.35).sort((a, b) => a.a.y - b.a.y)
  const takenY: number[] = []
  for (const s of longHorizontals) {
    const y = (s.a.y + s.b.y) / 2
    if (takenY.some((t) => Math.abs(t - y) < Math.max(2, prepared.workingSize.height * 0.006))) continue
    takenY.push(y)
    result.levels.push(
      builder.observe(handles.levels, {
        frame,
        kind: 'LEVEL_DATUM',
        pixelGeometry: { type: 'SEGMENT', a: scaleToFrame(s.a, scale), b: scaleToFrame(s.b, scale) },
        semanticHints: ['level-datum'],
        confidence: round6(Math.min(0.8, 0.4 + (s.length / bodyWidth) * 0.4)),
        uncertainty: { positionPx: round6(Math.max(1, larger * 0.003)), angleDeg: 0.5, reason: 'a long horizontal in a section is usually a level line, but a slab soffit or a ceiling reads the same' },
        detail: `a horizontal line ${round6(s.length * scale)}px long, ${round6((s.length / bodyWidth) * 100)}% of the section's width`,
      }),
    )
    if (result.levels.length >= 24) break
  }
  builder.unresolved('the printed level values on this section', 'this extractor reads geometry only; no OCR is performed, so the datum lines are located but not valued', 'NOT_ATTEMPTED', frame.assetId)

  // ---- the roof -----------------------------------------------------------
  const sloped = working.all.filter((s) => !isHorizontal(s) && !isVertical(s) && s.length >= bodyWidth * 0.08)
  for (const slope of dominantSlopes(sloped, { minLength: bodyWidth * 0.08 }).slice(0, 4)) {
    const best = sloped.filter((s) => angleDeltaDeg(s.angleDeg, slope.angleDeg) <= 2.5).sort((a, b) => b.length - a.length)[0]
    if (!best) continue
    result.pitchLines.push(
      builder.observe(handles.roof, {
        frame,
        kind: 'ROOF_EDGE',
        pixelGeometry: { type: 'SEGMENT', a: scaleToFrame(best.a, scale), b: scaleToFrame(best.b, scale) },
        semanticHints: ['gable'],
        value: { unit: 'deg', number: round6(slope.angleDeg) },
        confidence: 0.7,
        uncertainty: { positionPx: round6(Math.max(1, larger * 0.003)), angleDeg: 1, reason: 'the pitch is measured in image space; it is a true angle only if the section is drawn to a uniform scale in both axes' },
        detail: `a pitch line at ${round6(slope.angleDeg)} degrees in image space, backed by ${round6(slope.totalLength * scale)}px of stroke`,
      }),
    )
  }
  if (result.pitchLines.length >= 2) {
    const apex = sloped.flatMap((s) => [s.a, s.b]).reduce((a, p) => (p.y < a.y ? p : a))
    result.ridge = builder.observe(handles.roof, {
      frame,
      kind: 'RIDGE',
      pixelGeometry: { type: 'POINT', point: scaleToFrame(apex, scale) },
      semanticHints: ['ridge'],
      confidence: 0.65,
      uncertainty: { positionPx: round6(Math.max(2, larger * 0.005)) },
      detail: 'the highest endpoint of the section’s pitch lines',
    })
    for (const line of result.pitchLines) builder.relate(handles.roof, { kind: 'SPANS_BETWEEN', from: line, to: result.ridge, confidence: 0.55, why: 'this pitch line runs to the highest point of the roof in section' })
  }

  // ---- the stair in section ----------------------------------------------
  const chain = stepChain(
    working.all.filter((s) => s.length <= prepared.workingSize.width * 0.12),
    Math.max(3, prepared.workingSize.width * 0.008),
  )
  if (chain.length >= 9) {
    result.stairChain = builder.observe(handles.stair, {
      frame,
      kind: 'STAIR',
      pixelGeometry: { type: 'POLYLINE', points: chain.map((p) => scaleToFrame(p, scale)) },
      semanticHints: ['stair-flight'],
      value: { unit: 'count', number: Math.floor((chain.length - 1) / 2) },
      confidence: 0.62,
      uncertainty: { positionPx: round6(Math.max(2, larger * 0.005)), angleDeg: 2, reason: 'the chain follows drawn treads and risers; a landing interrupts it and the run may continue beyond' },
      detail: `a chain of ${Math.floor((chain.length - 1) / 2)} alternating tread and riser strokes: the stair where the section cuts it`,
    })
  } else {
    builder.unresolved('the stair where this section cuts it', 'no chain of alternating tread and riser strokes was found', 'MISSING', frame.assetId)
  }

  // Keep the body extent on the record: everything above is positioned within it.
  builder.observe(handles.levels, {
    frame,
    kind: 'MASS_REGION',
    pixelGeometry: { type: 'RECT', rect: scaleRect(bodyRect, scale) },
    semanticHints: ['unknown'],
    depthLayer: 'HOST_PLANE',
    confidence: 0.7,
    uncertainty: { positionPx: round6(Math.max(1, larger * 0.005)) },
    detail: 'the bounding box of the section’s largest connected component',
  })

  return result
}
