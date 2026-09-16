/**
 * Putting an elevation into metres.
 *
 * A published elevation states no dimensions and no datums — it is a picture
 * of a wall — so the metric reader can say nothing about it, and correctly
 * refuses to. What it does have is a SILHOUETTE, and the silhouette's extent
 * is a length the plan already measured: the front of a house is as wide as
 * its footprint, and as tall as the section says it is.
 *
 * That is the cross-view registration this module performs, and it is worth
 * being precise about why it is legitimate where fitting a camera would not
 * be. It uses exactly two facts, both of them already established from printed
 * numbers: the footprint from the plan's dimension chains, and the total
 * height from the section's ladder of level datums. It fits exactly two
 * unknowns per view, both of them scales. It does not fit a position, a
 * rotation, a focal length or a principal point, because an orthographic sheet
 * has none of those to fit and pretending otherwise is how a reconstruction
 * starts explaining its own noise.
 *
 * Which wall an elevation SHOWS is a separate question, answered by the source
 * package's own view role where it states one and by the silhouette's own
 * proportions where it does not — and reported as unresolved where neither
 * settles it, because a mirrored elevation assigned to the wrong wall is worse
 * than no elevation at all.
 */
import { round6 } from '@buildapp/source-common'
import type { PixelRect } from '@buildapp/source-common'
import type { SourceCoordinateFrame, SourceObservation } from '@buildapp/source-observations'
import type { Raster } from '@buildapp/source-cv'
import { architecturalBounds } from '@buildapp/image-metrology'

export type BuildingSide = 'FRONT' | 'REAR' | 'LEFT' | 'RIGHT'

export type ElevationRegistration = {
  frameId: string
  assetId: string
  side: BuildingSide | undefined
  /** Why that side, in a sentence a reader can check. */
  sideWhy: string
  sideConfidence: number
  /** Metres per pixel along the wall, and up it. */
  metresPerPixelU: number
  metresPerPixelV: number
  /** The building's box in the frame's pixels: what both scales were fitted to. */
  extent: PixelRect
  /** Where that box came from — a traced silhouette, or an outline measured off the pixels. */
  extentWhy: string
  /** The metric length of the wall this view shows, and the height it was fitted against. */
  spanM: number
  heightM: number
  anisotropy: number
  /** The eaves projection this view measures: half the surplus silhouette width. */
  overhangM: number
  confidence: number
  why: string
}

/**
 * The drawing's outline as it was traced, points and all.
 *
 * The extent below throws the shape away, which is all a SCALE needs and
 * exactly what a shape check must not do: the step where a garage meets a
 * house, and the triangle of a gable end, live in these points and nowhere
 * else on the sheet.
 */
export function silhouettePolygon(observations: readonly SourceObservation[]): Array<{ x: number; y: number }> | undefined {
  const traced = observations.filter((o) => o.kind === 'SILHOUETTE').sort((a, b) => b.confidence - a.confidence)
  for (const o of traced) {
    const g = o.pixelGeometry
    if (g.type === 'POLYGON' && g.points.length >= 3) return g.points.map((p) => ({ x: p.x, y: p.y }))
  }
  return undefined
}

/** The drawing's outline, as a box. A polygon silhouette is reduced to its extent, which is all a scale needs. */
export function silhouetteExtent(observations: readonly SourceObservation[]): PixelRect | undefined {
  const boxOf = (o: SourceObservation): PixelRect | undefined => {
    const g = o.pixelGeometry
    const points = g.type === 'RECT' ? [{ x: g.rect.x0, y: g.rect.y0 }, { x: g.rect.x1, y: g.rect.y1 }] : g.type === 'POLYGON' || g.type === 'POLYLINE' ? g.points : g.type === 'SEGMENT' ? [g.a, g.b] : g.type === 'POINT' ? [g.point] : g.lines.flatMap((l) => [l.a, l.b])
    if (points.length === 0) return undefined
    return { x0: round6(Math.min(...points.map((p) => p.x))), y0: round6(Math.min(...points.map((p) => p.y))), x1: round6(Math.max(...points.map((p) => p.x))), y1: round6(Math.max(...points.map((p) => p.y))) }
  }
  // A SILHOUETTE traces the building; a MASS_REGION is the bounding box of
  // everything drawn, which on a real sheet includes a title block and a scale
  // bar. So the silhouette is preferred outright rather than intersected with
  // the mass region: intersecting two boxes that disagree about where the
  // building is produces a third box that is neither, and an elevation
  // registered against it reports a metre-and-a-half of anisotropy that does
  // not exist.
  const traced = observations.filter((o) => o.kind === 'SILHOUETTE').sort((a, b) => b.confidence - a.confidence)
  for (const o of traced) {
    const box = boxOf(o)
    if (box && box.x1 > box.x0 && box.y1 > box.y0) return box
  }
  const massed = observations.filter((o) => o.kind === 'MASS_REGION').sort((a, b) => b.confidence - a.confidence)
  for (const o of massed) {
    const box = boxOf(o)
    if (box && box.x1 > box.x0 && box.y1 > box.y0) return box
  }
  return undefined
}

/**
 * How big the building is in this picture, and which reading of that to trust.
 *
 * Two readings are available and they fail in opposite directions.
 *
 * The SILHOUETTE above is what an ink extractor traced. On a line drawing that
 * is the building. On a photo-realistic rendered elevation it is the building,
 * the lawn, the trees, the sky and the publisher's logo — and on the four
 * rendered elevations of the reference project it came back as the entire
 * frame, 1279 x 596 px, every time. An elevation registered against the whole
 * frame is registered against the sky: that building's ridge is 485 px tall in
 * a 596 px image, so every height read off those drawings came out 23% short.
 * That is most of the opening error the previous stage reported and could not
 * account for, and it was invisible because a silhouette that is wrong is
 * still a silhouette.
 *
 * The ARCHITECTURAL BOUNDS are the long straight rectilinear structure of the
 * picture, which finds a building in a render and is blind to foliage. But on
 * a technical line drawing the dimension chains are also long, straight and
 * rectilinear, so that reading can come out WIDER than the building where the
 * silhouette comes out narrower.
 *
 * So neither is preferred by decree. A silhouette covering essentially the
 * whole sheet has failed on its own terms — every drawing has margins — and
 * only then is the outline measured off the pixels instead.
 */
export type MeasuredExtent = {
  rect: PixelRect
  /** Whether the traced silhouette was believed, and so whether its polygon means anything. */
  traced: boolean
  why: string
}

const DEGENERATE_SILHOUETTE_COVERAGE = 0.85

export function buildingExtent(frame: SourceCoordinateFrame, observations: readonly SourceObservation[], raster?: Raster): MeasuredExtent | undefined {
  const traced = silhouetteExtent(observations)
  const sheet = frame.size.width * frame.size.height
  const coverage = traced && sheet > 0 ? ((traced.x1 - traced.x0) * (traced.y1 - traced.y0)) / sheet : 0
  if (traced && coverage < DEGENERATE_SILHOUETTE_COVERAGE) return { rect: traced, traced: true, why: 'the traced silhouette of the drawing' }
  const measured = raster ? architecturalBounds(raster) : null
  if (measured) {
    return {
      rect: measured.rect,
      traced: false,
      why: traced
        ? `the traced silhouette covers ${Math.round(coverage * 100)}% of the sheet, which is the sky and not a building, so the outline was measured from the pixels instead: ${measured.why}`
        : `nothing was traced on this drawing, so the outline was measured from the pixels: ${measured.why}`,
    }
  }
  if (traced) return { rect: traced, traced: true, why: `the traced silhouette, which covers ${Math.round(coverage * 100)}% of the sheet and may well be the sky; the pixels were not available to check it against` }
  return undefined
}

export type MassingFacts = {
  /** The footprint, in metres. */
  width: number
  depth: number
  /** Ground to the top of the highest thing the section measures. */
  totalHeight: number
}

/**
 * Which wall this elevation shows, and at what scale.
 *
 * Both questions are answered at once, because neither can be answered alone.
 *
 * The VERTICAL scale is the one to trust: the silhouette runs from the ground
 * to the ridge, and the section states both. The horizontal is not — a pitched
 * roof overhangs its gable ends, so the silhouette is WIDER than the wall
 * beneath it by twice the eaves projection, and registering that width against
 * the footprint reports ten per cent of anisotropy that is really a roof.
 *
 * So one scale is fitted, from the height, and the surplus width then MEASURES
 * the overhang instead of contaminating everything else. That also settles
 * which wall the drawing shows: with a real scale in hand, an elevation's
 * width in metres is either the footprint width plus a little, or the depth
 * plus a little, and "plus a little" is the only direction an overhang can go.
 */
export function registerElevations(frames: ReadonlyArray<{ frame: SourceCoordinateFrame; extent: PixelRect; extentWhy?: string }>, massing: MassingFacts): { registrations: ElevationRegistration[]; refused: Array<{ frameId: string; why: string }> } {
  const registrations: ElevationRegistration[] = []
  const refused: Array<{ frameId: string; why: string }> = []
  const taken = new Set<BuildingSide>()

  const measured = frames
    .map(({ frame, extent, extentWhy }) => {
      const pixelHeight = extent.y1 - extent.y0
      const pixelWidth = extent.x1 - extent.x0
      if (pixelHeight <= 0 || pixelWidth <= 0) return undefined
      const scale = massing.totalHeight / pixelHeight
      return { frame, extent, extentWhy, scale, widthM: round6(pixelWidth * scale) }
    })
    .filter((m): m is NonNullable<typeof m> => m !== undefined)
    // A labelled view first, so an unlabelled one cannot take its wall.
    .sort((a, b) => Number(labelled(b.frame)) - Number(labelled(a.frame)) || b.extent.x1 - b.extent.x0 - (a.extent.x1 - a.extent.x0) || a.frame.id.localeCompare(b.frame.id))

  for (const m of measured) {
    const chosen = chooseSide(m.frame, m.widthM, massing, taken)
    if (!chosen.side) {
      refused.push({ frameId: m.frame.id, why: chosen.why })
      continue
    }
    const spanM = chosen.side === 'LEFT' || chosen.side === 'RIGHT' ? massing.depth : massing.width
    const overhang = round6(Math.max(0, (m.widthM - spanM) / 2))
    taken.add(chosen.side)
    registrations.push({
      frameId: m.frame.id,
      assetId: m.frame.assetId,
      side: chosen.side,
      sideWhy: chosen.why,
      sideConfidence: chosen.confidence,
      metresPerPixelU: round6(m.scale),
      metresPerPixelV: round6(m.scale),
      extent: m.extent,
      extentWhy: m.extentWhy ?? 'the traced silhouette of the drawing',
      spanM: round6(spanM),
      heightM: round6(massing.totalHeight),
      anisotropy: 1,
      /** The eaves projection this view measures, half the surplus width. */
      overhangM: overhang,
      confidence: round6(Math.max(0.15, Math.min(0.9, chosen.confidence * 0.95))),
      why:
        `${round6(m.extent.y1 - m.extent.y0)} px tall is the ${round6(massing.totalHeight)} m the section measures, so the sheet is ${round6(m.scale)} m/px; ` +
        `at that scale the outline is ${m.widthM} m across a ${round6(spanM)} m wall, which puts the eaves ${overhang} m proud` +
        (m.extentWhy ? `; that outline is ${m.extentWhy}` : ''),
    })
  }
  return { registrations, refused: refused.sort((a, b) => a.frameId.localeCompare(b.frameId)) }
}

const labelled = (frame: SourceCoordinateFrame): boolean => frame.roles.view === 'FRONT' || frame.roles.view === 'REAR' || frame.roles.view === 'LEFT' || frame.roles.view === 'RIGHT'

/**
 * Which wall an elevation shows.
 *
 * The publisher's own label is believed where there is one — "elewacja
 * frontowa" is a statement about the building, not an inference about pixels.
 * Otherwise the measured width decides: it must exceed the wall it shows, by
 * the overhang, and a width SHORTER than a wall cannot be that wall at all.
 */
function chooseSide(frame: SourceCoordinateFrame, widthM: number, massing: MassingFacts, taken: ReadonlySet<BuildingSide>): { side: BuildingSide | undefined; why: string; confidence: number } {
  const declared = frame.roles.view
  if (declared === 'FRONT' || declared === 'REAR' || declared === 'LEFT' || declared === 'RIGHT') {
    if (!taken.has(declared)) return { side: declared, why: `the publisher labels this drawing the ${declared.toLowerCase()} elevation`, confidence: 0.9 }
  }
  const options: Array<{ pair: BuildingSide[]; span: number; label: string }> = [
    { pair: ['FRONT', 'REAR'], span: massing.width, label: 'the footprint width' },
    { pair: ['LEFT', 'RIGHT'], span: massing.depth, label: 'the footprint depth' },
  ]
  const scored = options
    // An elevation cannot be narrower than the wall it shows: a roof only ever
    // adds width. A small shortfall is the silhouette missing a render pixel;
    // a large one means this is the other axis.
    .map((o) => ({ ...o, surplus: widthM - o.span }))
    .filter((o) => o.surplus > -Math.max(0.25, o.span * 0.04))
    .sort((a, b) => a.surplus - b.surplus)
  if (scored.length === 0) return { side: undefined, why: `the silhouette is ${widthM} m across, shorter than either wall of a ${massing.width} by ${massing.depth} m building`, confidence: 0 }
  const best = scored[0]
  const free = best.pair.filter((s) => !taken.has(s))
  const why = `the silhouette is ${widthM} m across, which is ${round6(best.surplus)} m more than ${best.label} — the overhang of a roof, on the only axis it can be`
  if (free.length === 0) return { side: undefined, why: `${why}, but both walls on that axis are already assigned`, confidence: 0 }
  if (free.length === 2) return { side: free[0], why: `${why}; which of the two it is cannot be told from the drawing, so it takes the first free one`, confidence: 0.4 }
  return { side: free[0], why: `${why}, and it is the only wall on that axis not already assigned`, confidence: 0.65 }
}

/**
 * Where a pixel on a registered elevation lands: along the WALL from the end
 * the wall itself starts at, and up from the ground.
 *
 * Two corrections are folded in here rather than left to every caller.
 *
 * The first is the overhang. The silhouette's left edge is the eaves, not the
 * wall, so `u` is measured from the wall beneath it — otherwise every opening
 * on the facade is shifted outward by half a metre and nothing says why.
 *
 * The second is handedness, and it is the one that is easy to get backwards.
 * The ring is traversed anticlockwise with the building on the left of travel,
 * and an elevation is drawn from OUTSIDE. Work through any of the four walls
 * and the same thing falls out: the left-hand edge of the drawing is the end
 * the wall STARTS at, so `u` runs the same way the wall's own offset does, and
 * no reflection is needed anywhere. Getting this wrong mirrors every facade —
 * the model still builds, every opening is the right size, and the front door
 * is at the wrong end of the house.
 */
export const elevationMetric = (registration: ElevationRegistration, x: number, y: number): { u: number; v: number } => ({
  u: round6((x - registration.extent.x0) * registration.metresPerPixelU - registration.overhangM),
  v: round6((registration.extent.y1 - y) * registration.metresPerPixelV),
})

/** And back: where on the drawing a known point of the wall is. */
export const elevationPixel = (registration: ElevationRegistration, u: number, v: number): { x: number; y: number } => ({
  x: round6(registration.extent.x0 + (u + registration.overhangM) / Math.max(1e-9, registration.metresPerPixelU)),
  y: round6(registration.extent.y1 - v / Math.max(1e-9, registration.metresPerPixelV)),
})
