/**
 * Reading an elevation or a render.
 *
 * The order of work is the order a person reads a facade in: the outline
 * first, then the roof, then the holes in the wall, then the things standing
 * in front of the wall, then what is set back behind it. Each step produces
 * observations and, where the image supports it, relations that say how the
 * parts stand relative to one another — because "there is a beam here" and
 * "there is a beam here, standing proud of the wall, running on past the
 * corner" are different amounts of evidence, and the second is the one that
 * reconstructs as a solid rather than as a stripe.
 *
 * Nothing in here knows what building it is looking at.
 */
import { rectIoU, round6 } from '@buildapp/source-common'
import type { PixelPoint, PixelRect } from '@buildapp/source-common'
import { connectedComponents, dominantSlopes, profileTop, rectangleCandidates, simplifyPolyline } from '@buildapp/source-cv'
import type { Segment } from '@buildapp/source-cv'
import type { ExtractorHandle, ObservationGraphBuilder, SourceCoordinateFrame, SourceObservation } from '@buildapp/source-observations'
import { bandConfidence, linearBands } from '../depth.js'
import type { LinearBand } from '../depth.js'
import { scaleRect, scaleToFrame, workingSegments } from '../prepare.js'
import type { Prepared } from '../prepare.js'

export type ElevationHandles = {
  silhouette: ExtractorHandle
  roof: ExtractorHandle
  openings: ExtractorHandle
  volume: ExtractorHandle
  recess: ExtractorHandle
}

export const ELEVATION_EXTRACTORS: ReadonlyArray<{ key: keyof ElevationHandles; name: string; version: string }> = [
  { key: 'silhouette', name: 'cv.silhouette', version: '1.0.0' },
  { key: 'roof', name: 'cv.roof-lines', version: '1.0.0' },
  { key: 'openings', name: 'cv.openings', version: '1.0.0' },
  { key: 'volume', name: 'cv.linear-volume', version: '1.0.0' },
  { key: 'recess', name: 'cv.recess', version: '1.0.0' },
]

export type ElevationResult = {
  silhouette: SourceObservation | null
  mass: SourceObservation | null
  roofEdges: SourceObservation[]
  ridge: SourceObservation | null
  openings: SourceObservation[]
  linearVolumes: SourceObservation[]
  surfaceRegions: SourceObservation[]
  recesses: SourceObservation[]
  sideReturns: SourceObservation[]
}

const isAxis = (s: Segment): boolean => s.angleDeg < 4 || s.angleDeg > 176 || Math.abs(s.angleDeg - 90) < 4

const rectPolygon = (r: PixelRect): PixelPoint[] => [
  { x: r.x0, y: r.y0 },
  { x: r.x1, y: r.y0 },
  { x: r.x1, y: r.y1 },
  { x: r.x0, y: r.y1 },
]

const rectArea = (r: PixelRect): number => Math.max(0, r.x1 - r.x0) * Math.max(0, r.y1 - r.y0)

const contains = (outer: PixelRect, inner: PixelRect, slack = 2): boolean => inner.x0 >= outer.x0 - slack && inner.y0 >= outer.y0 - slack && inner.x1 <= outer.x1 + slack && inner.y1 <= outer.y1 + slack

/**
 * A vertical member standing at one end of a recess, INSIDE its mouth.
 *
 * "Inside" is the part that matters. The strip of wall just beyond a recess's
 * edge is adjacent to it and runs its full height, and without this test it
 * reads as a side return — which would report a closed recess on a facade
 * where the recess is open at that end, exactly the error this observation
 * exists to catch.
 */
function touchesEdge(band: PixelRect, recess: PixelRect, tolerance: number): 'LEFT' | 'RIGHT' | null {
  const vOverlap = Math.min(band.y1, recess.y1) - Math.max(band.y0, recess.y0)
  if (vOverlap < (recess.y1 - recess.y0) * 0.45) return null
  if (band.x0 < recess.x0 - tolerance || band.x1 > recess.x1 + tolerance) return null
  if (Math.abs(band.x0 - recess.x0) <= tolerance) return 'LEFT'
  if (Math.abs(band.x1 - recess.x1) <= tolerance) return 'RIGHT'
  return null
}

export function extractElevation(builder: ObservationGraphBuilder, frame: SourceCoordinateFrame, prepared: Prepared, handles: ElevationHandles): ElevationResult {
  const { mask, luma, scale } = prepared
  const working = workingSegments(prepared)
  const larger = Math.max(prepared.size.width, prepared.size.height)
  const result: ElevationResult = { silhouette: null, mass: null, roofEdges: [], ridge: null, openings: [], linearVolumes: [], surfaceRegions: [], recesses: [], sideReturns: [] }

  // ---- 1. the outline -----------------------------------------------------
  const components = connectedComponents(mask, { minPixels: Math.max(40, Math.round(mask.width * mask.height * 0.0004)) })
  const body = components.length > 0 ? components.reduce((a, c) => (c.pixels > a.pixels ? c : a)) : null
  const bodyRect = body ? scaleRect(body.bounds, scale) : null

  const top = profileTop(mask)
  const profilePoints: PixelPoint[] = []
  for (let x = 0; x < top.length; x += 1) if (top[x] >= 0) profilePoints.push({ x, y: top[x] })
  const simplified = simplifyPolyline(profilePoints, Math.max(1.5, prepared.workingSize.width * 0.004)).map((p) => scaleToFrame(p, scale))

  if (simplified.length >= 2 && bodyRect) {
    result.silhouette = builder.observe(handles.silhouette, {
      frame,
      kind: 'SILHOUETTE',
      pixelGeometry: { type: 'POLYGON', points: [...simplified, { x: simplified[simplified.length - 1].x, y: bodyRect.y1 }, { x: simplified[0].x, y: bodyRect.y1 }] },
      semanticHints: ['unknown'],
      confidence: 0.75,
      uncertainty: { positionPx: round6(Math.max(1, larger * 0.004)), angleDeg: 2, reason: 'the profile follows the topmost ink in each column, so foreground planting or a neighbouring element raises it' },
      detail: `the topmost ink in each column of the largest connected component (${body?.pixels ?? 0}px), simplified to ${simplified.length} vertices`,
    })
    result.mass = builder.observe(handles.silhouette, {
      frame,
      kind: 'MASS_REGION',
      pixelGeometry: { type: 'RECT', rect: bodyRect },
      semanticHints: ['unknown'],
      depthLayer: 'HOST_PLANE',
      confidence: 0.7,
      uncertainty: { positionPx: round6(Math.max(1, larger * 0.006)) },
      detail: `the bounding box of the drawing's largest connected component: the extent everything else on this view is measured against`,
    })
  }

  // ---- 2. the roof --------------------------------------------------------
  const sloped = working.all.filter((s) => !isAxis(s) && s.length >= prepared.workingSize.width * 0.06)
  const slopes = dominantSlopes(sloped, { minLength: prepared.workingSize.width * 0.06 })
  // A roof edge is genuinely sloped. The near-horizontal and near-vertical
  // buckets are the building's own lines — a floor band, a window head, a
  // corner — and calling them roof edges puts a pitch of four degrees into the
  // record for a forty-degree roof.
  const roofSlopes = slopes.filter((s) => Math.abs(s.angleDeg - 90) > 12 && s.angleDeg > 10 && s.angleDeg < 170).slice(0, 4)
  for (const slope of roofSlopes) {
    const members = sloped.filter((s) => Math.abs(s.angleDeg - slope.angleDeg) <= 2.5).sort((a, b) => b.length - a.length)
    const best = members[0]
    if (!best) continue
    result.roofEdges.push(
      builder.observe(handles.roof, {
        frame,
        kind: 'ROOF_EDGE',
        pixelGeometry: { type: 'SEGMENT', a: scaleToFrame(best.a, scale), b: scaleToFrame(best.b, scale) },
        semanticHints: ['verge'],
        value: { unit: 'deg', number: round6(slope.angleDeg) },
        confidence: round6(Math.min(0.85, 0.45 + Math.min(0.4, slope.totalLength / (prepared.workingSize.width * 2)))),
        uncertainty: { positionPx: round6(Math.max(1, larger * 0.004)), angleDeg: 1.5, reason: 'the angle is a length-weighted mean over the strokes in this slope bucket' },
        detail: `${members.length} stroke(s) totalling ${round6(slope.totalLength * scale)}px lie at ${round6(slope.angleDeg)} degrees in image space; the longest is reported`,
      }),
    )
  }
  // The apex of the profile: the highest point of the silhouette. A ridge on a
  // gable, the top of a hip on a hipped roof, and neither on a flat one — so
  // it is reported as a point with an explicit hint, not as a roof form.
  if (simplified.length >= 3 && roofSlopes.length >= 2) {
    const apex = simplified.reduce((a, p) => (p.y < a.y ? p : a))
    result.ridge = builder.observe(handles.roof, {
      frame,
      kind: 'RIDGE',
      pixelGeometry: { type: 'POINT', point: apex },
      semanticHints: ['ridge'],
      confidence: 0.6,
      uncertainty: { positionPx: round6(Math.max(2, larger * 0.006)), reason: 'the highest point of the outline, which a chimney or an aerial would also produce' },
      detail: `the highest vertex of the outline, where ${roofSlopes.length} distinct slope directions were also found`,
    })
    for (const edge of result.roofEdges) builder.relate(handles.roof, { kind: 'SPANS_BETWEEN', from: edge, to: result.ridge, confidence: 0.5, why: 'this sloped edge runs to the highest point of the outline' })
  }

  // Rectangles come from the EDGE mask: a window filled with a dark glass
  // tone is one solid blob of ink, and its outline — the thing that makes it a
  // rectangle — only exists as a tone boundary.
  const rects = rectangleCandidates(prepared.edges, { minSize: Math.max(6, Math.round(prepared.workingSize.width * 0.015)), minClosure: 0.72, maxCandidates: 120 })

  const bands = linearBands(luma, working.all.filter(isAxis), { maxBands: 48 })

  // ---- 3. what is set back behind it --------------------------------------
  // A recess reads as a region of the facade darker than the wall around it,
  // bounded by its own edges. Balconies and loggias are the usual case.
  //
  // Read BEFORE the openings, because the mouth of a recess and the wall
  // between its returns are both closed rectangles and the bigger structure is
  // the one that explains the smaller.
  const wallTone = bodyRect ? medianRegionTone(prepared, bodyRect) : -1
  for (const cand of rects.filter((c) => c.closure >= 0.8).sort((a, b) => rectArea(b.rect) - rectArea(a.rect)).slice(0, 40)) {
    const rect = scaleRect(cand.rect, scale)
    if (!bodyRect || !contains(bodyRect, rect)) continue
    if (rectIoU(bodyRect, rect) > 0.7) continue
    const area = rectArea(rect)
    if (area < larger * larger * 0.004) continue
    // A recess is a ROOM-shaped hole, not a stripe: a band of a darker
    // material is a surface, and the aspect is what tells them apart.
    const width = rect.x1 - rect.x0
    const height = rect.y1 - rect.y0
    const aspect = width / Math.max(1e-6, height)
    if (aspect < 0.25 || aspect > 4 || Math.min(width, height) < larger * 0.06) continue
    const inside = medianRegionTone(prepared, { x0: rect.x0 + 2, y0: rect.y0 + 2, x1: rect.x1 - 2, y1: rect.y1 - 2 })
    if (wallTone < 0 || inside < 0 || wallTone - inside < 16) continue
    if (result.recesses.some((r) => r.pixelGeometry.type === 'RECT' && rectIoU(r.pixelGeometry.rect, rect) > 0.3)) continue
    const recess = builder.observe(handles.recess, {
      frame,
      kind: 'LOGGIA',
      pixelGeometry: { type: 'RECT', rect },
      semanticHints: ['recess-mouth'],
      depthLayer: 'RECESSED',
      confidence: 0.55,
      uncertainty: { positionPx: round6(Math.max(2, larger * 0.006)), reason: 'the darker region is read as a recess; deep shading or a dark material would look the same on this view alone' },
      detail: `a closed region ${round6(wallTone - inside)} tone levels darker than the surrounding wall: the mouth of a recess`,
      alternatives: [{ why: 'it could be a flat panel of a dark material rather than a recess', confidence: 0.3 }],
    })
    result.recesses.push(recess)
    if (result.mass) builder.relate(handles.recess, { kind: 'RECESSED_BEHIND', from: recess, to: result.mass, confidence: 0.55, why: 'the region is consistently darker than the wall plane around it' })

    // The side walls that close the recess at its ends. Their absence is the
    // difference between a modelled loggia and a hole in a wall, so when a
    // side has none, the gap is named rather than passed over.
    const sides = new Set<'LEFT' | 'RIGHT'>()
    for (const band of bands) {
      if (band.orientation !== 'VERTICAL') continue
      const bandRect = scaleRect(band.rect, scale)
      const side = touchesEdge(bandRect, rect, Math.max(4, larger * 0.012))
      if (!side || sides.has(side)) continue
      sides.add(side)
      const observation = builder.observe(handles.recess, {
        frame,
        kind: band.volumetric ? 'LINEAR_VOLUME_CANDIDATE' : 'WALL_REGION',
        pixelGeometry: { type: 'RECT', rect: bandRect },
        semanticHints: ['side-return'],
        depthLayer: 'PROUD_OF_WALL',
        confidence: band.volumetric ? bandConfidence(band) : 0.45,
        uncertainty: { positionPx: round6(Math.max(2, larger * 0.006)), angleDeg: 2, reason: 'read from the elevation alone; its depth into the recess is not measurable here' },
        detail: `a vertical member on the ${side.toLowerCase()} edge of the recess, closing it at that end${band.cues.length > 0 ? ` (${band.cues.map((c) => c.cue).join(', ')})` : ''}`,
      })
      result.sideReturns.push(observation)
      builder.relate(handles.recess, { kind: 'INSIDE_RECESS', from: observation, to: recess, confidence: 0.55, why: `it runs the full height of the recess along its ${side.toLowerCase()} edge` })
    }
    for (const side of ['LEFT', 'RIGHT'] as const) {
      if (!sides.has(side)) {
        builder.unresolved(`the ${side.toLowerCase()} side wall of the recess at (${rect.x0}, ${rect.y0})-(${rect.x1}, ${rect.y1})`, 'no vertical member was found closing this end of the recess on this view; it may be hidden by the viewing angle or absent', 'MISSING', frame.assetId)
      }
    }
  }

  // ---- 4. the holes in the wall ------------------------------------------
  const keptOpenings: PixelRect[] = []
  // `rectangleCandidates` deliberately over-proposes: besides each real
  // rectangle it offers the ones that straddle two of them. Ranking by how
  // much of the perimeter is actually backed by ink, and refusing anything
  // that swallows a rectangle already taken, is what turns that list into a
  // set of openings.
  for (const cand of rects.filter((c) => c.closure >= 0.85).sort((a, b) => b.closure - a.closure || rectArea(a.rect) - rectArea(b.rect))) {
    const rect = scaleRect(cand.rect, scale)
    if (bodyRect && !contains(bodyRect, rect)) continue
    if (bodyRect && rectIoU(bodyRect, rect) > 0.7) continue
    const area = rectArea(rect)
    if (area < larger * larger * 0.0004 || area > larger * larger * 0.12) continue
    // A hole in a wall is not thirty times longer than it is tall. A closed
    // rectangle that extreme is a band, and belongs to the member reader.
    const aspect = (rect.x1 - rect.x0) / Math.max(1e-6, rect.y1 - rect.y0)
    if (aspect < 0.12 || aspect > 8) continue
    if (keptOpenings.some((k) => rectIoU(k, rect) > 0.25 || contains(rect, k, 2))) continue
    // A recess's own mouth is not a hole in the wall; the windows inside it are.
    if (result.recesses.some((r) => r.pixelGeometry.type === 'RECT' && rectIoU(r.pixelGeometry.rect, rect) > 0.5)) continue
    keptOpenings.push(rect)
    result.openings.push(
      builder.observe(handles.openings, {
        frame,
        kind: 'OPENING',
        pixelGeometry: { type: 'RECT', rect },
        semanticHints: ['reveal'],
        confidence: round6(Math.min(0.85, 0.35 + cand.closure * 0.5)),
        uncertainty: { positionPx: round6(Math.max(1, larger * 0.004)), reason: 'the rectangle is fitted to the drawn outline, which may be the frame rather than the structural opening' },
        detail: `a closed rectangle with ${round6(cand.closure * 100)}% of its perimeter backed by ink`,
      }),
    )
    if (result.openings.length >= 40) break
  }

  // ---- 5. what stands in front of the wall --------------------------------
  const volumetric: Array<{ band: LinearBand; observation: SourceObservation }> = []
  for (const band of bands) {
    const rect = scaleRect(band.rect, scale)
    if (bodyRect && !contains(bodyRect, rect, larger * 0.02)) continue
    if (keptOpenings.some((k) => rectIoU(k, rect) > 0.6)) continue
    const horizontal = band.orientation === 'HORIZONTAL'
    const cueList = band.cues.map((c) => `${c.cue} (${c.detail})`).join('; ')
    if (band.volumetric) {
      const observation = builder.observe(handles.volume, {
        frame,
        kind: 'LINEAR_VOLUME_CANDIDATE',
        pixelGeometry: { type: 'RECT', rect },
        semanticHints: horizontal ? ['beam'] : ['column'],
        value: { unit: 'px', number: round6(band.thickness * scale) },
        depthLayer: 'PROUD_OF_WALL',
        confidence: bandConfidence(band),
        uncertainty: { positionPx: round6(Math.max(1.5, larger * 0.005)), angleDeg: 2, reason: 'the member reads as solid, but the image gives no measure of how deep it is' },
        detail: `a ${round6(band.length * scale)}x${round6(band.thickness * scale)}px ${horizontal ? 'horizontal' : 'vertical'} member with depth cues: ${cueList}`,
        alternatives: [{ why: 'it could be a flat band of a different material, if every depth cue here is a drafting convention rather than a rendered solid', confidence: round6(Math.max(0.1, 1 - bandConfidence(band) - 0.15)) }],
      })
      result.linearVolumes.push(observation)
      volumetric.push({ band, observation })
      if (result.mass) builder.relate(handles.volume, { kind: 'PROUD_OF', from: observation, to: result.mass, confidence: bandConfidence(band), why: `depth cues on this member (${band.cues.map((c) => c.cue).join(', ')}) put it in front of the wall plane` })
    } else {
      result.surfaceRegions.push(
        builder.observe(handles.volume, {
          frame,
          kind: 'SURFACE_REGION',
          pixelGeometry: { type: 'RECT', rect },
          semanticHints: ['cladding'],
          depthLayer: band.cues.length > 0 ? 'HOST_PLANE' : 'UNKNOWN',
          confidence: 0.45,
          uncertainty: { positionPx: round6(Math.max(1.5, larger * 0.005)), angleDeg: 2, reason: 'the image shows a change of surface and no evidence of depth' },
          detail: `a ${round6(band.length * scale)}x${round6(band.thickness * scale)}px ${horizontal ? 'horizontal' : 'vertical'} band with no depth cue${band.cues.length > 0 ? `; only ${cueList}` : ' at all'} — a change of surface, not a solid`,
        }),
      )
    }
  }

  // A horizontal member whose end meets a vertical member is a FRAME rather
  // than two unrelated pieces. That is what lets a later stage recover one
  // continuous element running from a garage opening along the facade and
  // under a balcony, instead of three separate lumps.
  for (const h of volumetric.filter((v) => v.band.orientation === 'HORIZONTAL')) {
    for (const v of volumetric.filter((x) => x.band.orientation === 'VERTICAL')) {
      const hr = h.band.rect
      const vr = v.band.rect
      const meetsX = Math.min(Math.abs(vr.x0 - hr.x0), Math.abs(vr.x1 - hr.x0), Math.abs(vr.x0 - hr.x1), Math.abs(vr.x1 - hr.x1)) <= Math.max(6, h.band.thickness * 1.5)
      const meetsY = vr.y0 <= hr.y1 + h.band.thickness && vr.y1 >= hr.y0 - h.band.thickness
      if (!meetsX || !meetsY) continue
      builder.relate(handles.volume, { kind: 'CONTINUES_ACROSS', from: h.observation, to: v.observation, confidence: 0.6, why: 'a horizontal member ends where a vertical one of similar depth begins: they read as one frame turning a corner' })
      builder.relate(handles.volume, { kind: 'SUPPORTS', from: v.observation, to: h.observation, confidence: 0.5, why: 'the vertical member meets the horizontal one at its end' })
    }
  }

  return result
}

function medianRegionTone(prepared: Prepared, rect: PixelRect): number {
  const k = 1 / prepared.scale
  const g = prepared.luma
  const x0 = Math.max(0, Math.round(rect.x0 * k))
  const y0 = Math.max(0, Math.round(rect.y0 * k))
  const x1 = Math.min(g.width - 1, Math.round(rect.x1 * k))
  const y1 = Math.min(g.height - 1, Math.round(rect.y1 * k))
  if (x1 < x0 || y1 < y0) return -1
  const samples: number[] = []
  const stepX = Math.max(1, Math.floor((x1 - x0 + 1) / 120))
  const stepY = Math.max(1, Math.floor((y1 - y0 + 1) / 120))
  for (let y = y0; y <= y1; y += stepY) for (let x = x0; x <= x1; x += stepX) samples.push(g.data[y * g.width + x])
  if (samples.length === 0) return -1
  samples.sort((a, b) => a - b)
  return samples[samples.length >> 1]
}

export { rectPolygon }
