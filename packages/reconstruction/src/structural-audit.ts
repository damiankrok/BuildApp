/**
 * §21: projecting the STRUCTURE back onto the drawings, before a wall is built.
 *
 * The gate beside this one asks whether the layout agrees with the numbers
 * other drawings state. This one asks the harder question: does the shape
 * LOOK like the thing that was drawn?
 *
 * A composition can satisfy every printed dimension and still be wrong in a
 * way anyone would see instantly — one body where the elevation shows two at
 * different heights, a ridge across the wrong span, a garage as tall as the
 * house. Those errors do not show up in a dimension check, because no chain
 * measures them. They show up the moment the massing is drawn against the
 * elevation it came from.
 *
 * So each mass is projected into every elevation that registers, as the block
 * it is: its extent along the view, and its height from the ground to
 * whatever stands on it. The silhouette they make together is compared with
 * the one the drawing traces, and — this is the part a dimension check cannot
 * do — the number of distinct HEIGHTS in the model's outline is compared with
 * whether the drawing's own outline steps at all.
 *
 * Nothing here knows which building it is looking at. It compares a model with
 * the drawings that model was read from.
 */
import { round6 } from '@buildapp/source-common'
import type { SourceCoordinateFrame, SourceObservation, SourceObservationGraph } from '@buildapp/source-observations'
import { registerElevations, silhouetteExtent, silhouettePolygon } from './views.js'
import type { BuildingSide, ElevationRegistration } from './views.js'
import { ringBounds } from './structural-layout.js'
import type { LayoutGateReason, MassHypothesis, RoofSupportHypothesis, StoreyLayoutHypothesis } from './structural-layout.js'

export type ProjectedMass = {
  massId: string
  /** Along the view, in metres from the left of the silhouette. */
  u0: number
  u1: number
  /** The top of this body as this view would see it: its ridge where a pitch faces the viewer, its eaves where the rake does. */
  topM: number
  /** How far the roof over it reaches past its walls, which is what a silhouette traces. */
  overhangM: number
  why: string
}

export type StructuralViewAudit = {
  frameId: string
  side: BuildingSide
  /** The bodies this view sees, left to right. */
  masses: ProjectedMass[]
  /**
   * What the model's outline measures, in metres, against what the drawing's
   * does — and the difference between them.
   *
   * Reported for a reader, never judged. The elevation's scale was FITTED to
   * this massing, so these two agree to a fraction of a millimetre whatever
   * the shape is, and a gate watching them would be watching its own
   * arithmetic. What is judged is `profile`.
   */
  projected: { widthM: number; heightM: number }
  observed: { widthM: number; heightM: number }
  widthResidualM: number
  heightResidualM: number
  /** How many distinct top heights the model shows in this view. One is a flat-topped box. */
  steps: number
  /** How much wider the traced outline is than the bodies under it. A few per cent is an eaves projection; metres is landscaping. */
  surplusM: number
  /**
   * The shape check: how far the model's top edge is from the drawn one,
   * sampled across the view, in metres.
   *
   * The scale is fitted to the massing, so the OVERALL width and height agree
   * by construction and prove nothing. What is not fitted, and what this
   * measures, is everything between the two ends — the triangle of a gable,
   * the step where a lower body meets a taller one, a flat top where the
   * drawing shows a ridge.
   */
  profile: { samples: number; rmsM: number; maxM: number } | undefined
  why: string
}

export type StructuralProjectionAudit = {
  views: StructuralViewAudit[]
  /** Elevations that could not be registered, and why: a view nobody could scale proves nothing either way. */
  refused: Array<{ frameId: string; why: string }>
  /** The worst SHAPE residual over the views that could be checked, in metres. */
  worstResidualM: number
  /** The most steps any view sees. A building of several bodies must step in at least one view. */
  steps: number
  reasons: LayoutGateReason[]
}

export type StructuralAuditOptions = {
  graph: SourceObservationGraph
  masses: readonly MassHypothesis[]
  roofs: readonly RoofSupportHypothesis[]
  storeys: readonly StoreyLayoutHypothesis[]
  /** How far a silhouette may be out and still count as the same shape, in metres. */
  toleranceM?: number
}

/** Where the top of a mass is, in metres above the lowest storey's floor. */
function topOf(mass: MassHypothesis, roof: RoofSupportHypothesis | undefined, storeys: readonly StoreyLayoutHypothesis[], facing: 'PITCH' | 'RAKE'): { topM: number; why: string } {
  const eaves = roof?.eaveLevelM?.value
  const ridge = roof?.ridgeLevelM?.value
  if (roof?.kind === 'GABLE' || roof?.kind === 'MONOPITCH') {
    // A view that looks at the GABLE END sees the ridge; one that looks along
    // the ridge sees the eaves line and the ridge behind it, and the outline
    // is still the ridge. Both are the ridge, but the reason differs, and a
    // reader checking this wants the reason.
    if (ridge !== undefined) return { topM: ridge, why: facing === 'PITCH' ? 'the ridge, seen end on over the gable' : 'the ridge, seen along its length above the eaves' }
  }
  if (eaves !== undefined) return { topM: eaves, why: 'the top of its own walls, with a level roof over them' }
  const top = storeys
    .filter((s) => s.index >= mass.storeySpan.fromIndex && s.index <= mass.storeySpan.toIndex)
    .map((s) => (s.elevation?.value ?? 0) + (s.height?.value ?? 0))
    .sort((a, b) => b - a)[0]
  return { topM: top ?? 0, why: 'the top of the highest storey it reaches, with nothing stating a roof over it' }
}

const observationsOf = (graph: SourceObservationGraph, frame: SourceCoordinateFrame): SourceObservation[] => graph.observations.filter((o) => o.frameId === frame.id)

/** Run the audit. */
export function auditStructuralProjection(options: StructuralAuditOptions): StructuralProjectionAudit {
  const tolerance = options.toleranceM ?? 0.6
  const { graph, masses, roofs, storeys } = options
  const reasons: LayoutGateReason[] = []
  if (masses.length === 0) {
    return { views: [], refused: [], worstResidualM: 0, steps: 0, reasons: [{ code: 'STRUCTURE_NOT_PROJECTED', what: 'there is no massing to project', severity: 'BLOCKING', itemIds: [], why: 'the pass found no body, so there is nothing to draw against the elevations' }] }
  }

  // The overall extent, which is what an elevation's scale is fitted against.
  const bounds = masses.map((m) => ringBounds(m.ring))
  const width = round6(Math.max(...bounds.map((b) => b.x1)) - Math.min(...bounds.map((b) => b.x0)))
  const depth = round6(Math.max(...bounds.map((b) => b.z1)) - Math.min(...bounds.map((b) => b.z0)))
  const tops = masses.map((mass) => topOf(mass, roofs.find((r) => r.massId === mass.id), storeys, 'PITCH').topM)
  const totalHeight = round6(Math.max(...tops))
  if (!(width > 0) || !(depth > 0) || !(totalHeight > 0)) {
    return { views: [], refused: [], worstResidualM: 0, steps: 0, reasons: [{ code: 'STRUCTURE_NOT_PROJECTED', what: 'the massing has no extent to project', severity: 'BLOCKING', itemIds: masses.map((m) => m.id), why: `the bodies measure ${width} by ${depth} m and stand ${totalHeight} m tall` }] }
  }

  const candidates: Array<{ frame: SourceCoordinateFrame; extent: { x0: number; y0: number; x1: number; y1: number } }> = []
  for (const frame of graph.coordinateFrames) {
    if (frame.roles.projection !== 'ORTHOGRAPHIC_ELEVATION') continue
    const extent = silhouetteExtent(observationsOf(graph, frame))
    if (!extent) continue
    candidates.push({ frame, extent })
  }
  const { registrations, refused } = registerElevations(candidates, { width, depth, totalHeight })

  const views: StructuralViewAudit[] = []
  for (const registration of registrations) {
    if (!registration.side) continue
    const frame = graph.coordinateFrames.find((f) => f.id === registration.frameId)
    const view = auditOneView(registration, masses, roofs, storeys, frame ? silhouettePolygon(observationsOf(graph, frame)) : undefined)
    views.push(view)
  }

  const measured = views.map((v) => v.profile?.maxM).filter((m): m is number => m !== undefined)
  const worst = measured.length === 0 ? 0 : round6(Math.max(...measured))
  const steps = views.length === 0 ? 0 : Math.max(...views.map((v) => v.steps))

  if (views.length === 0) {
    reasons.push({
      code: 'STRUCTURE_NOT_PROJECTED',
      what: 'no elevation could be registered, so the massing was never drawn against a drawing',
      severity: 'NOTED',
      itemIds: refused.map((r) => r.frameId),
      why: refused.length === 0 ? 'the package carries no elevation with a silhouette' : refused.map((r) => `${r.frameId}: ${r.why}`).join('; '),
    })
  } else {
    for (const view of views) {
      // The SHAPE is what is judged. The overall extents agree by
      // construction — the scale was fitted to them — so a gate that watched
      // those would be watching its own arithmetic.
      const off = view.profile?.maxM
      if (off === undefined) {
        reasons.push({
          code: 'STRUCTURE_SHAPE_NOT_CHECKED',
          what: `the shape could not be checked against the ${view.side.toLowerCase()} elevation`,
          severity: 'NOTED',
          itemIds: [view.frameId],
          why:
            view.surplusM > 0.5
              ? `the outline traced on it is ${view.surplusM.toFixed(2)} m wider than the bodies under it, so what was traced is the render's ground and planting as well as the building`
              : 'no silhouette polygon was extracted from this drawing; only its bounding box was, and a box has no shape to disagree with',
        })
        continue
      }
      if (off <= tolerance) continue
      reasons.push({
        code: 'STRUCTURE_SILHOUETTE_DISAGREES',
        what: `the massing drawn against the ${view.side.toLowerCase()} elevation stands up to ${off.toFixed(2)} m away from the outline that drawing traces`,
        severity: off > tolerance * 4 ? 'BLOCKING' : 'DEGRADING',
        itemIds: [view.frameId, ...view.masses.map((m) => m.massId)],
        why: `${view.profile?.samples ?? 0} samples across the view, ${(view.profile?.rmsM ?? 0).toFixed(2)} m rms: ${view.why}`,
      })
    }
    if (masses.length > 1 && steps < 2) {
      reasons.push({
        code: 'STRUCTURE_READS_AS_ONE_BLOCK',
        what: `the pass found ${masses.length} bodies and every elevation draws them at the same height, so the model would read as one block`,
        severity: 'DEGRADING',
        itemIds: masses.map((m) => m.id),
        why: 'two bodies at one height under one roof line are one body: whatever separates them on the plan does not survive into the shape',
      })
    }
    const checked = views.filter((v) => v.profile !== undefined)
    if (checked.length > 0 && checked.every((v) => (v.profile as { maxM: number }).maxM <= tolerance)) {
      reasons.push({
        code: 'STRUCTURE_PROJECTS',
        what: `the massing's outline lands within ${worst.toFixed(2)} m of the drawn one on all ${checked.length} elevation${checked.length === 1 ? '' : 's'} that could be checked`,
        severity: 'NOTED',
        itemIds: checked.map((v) => v.frameId),
        why: checked.map((v) => `${v.side.toLowerCase()} ${(v.profile as { maxM: number }).maxM.toFixed(2)} m worst, ${(v.profile as { rmsM: number }).rmsM.toFixed(2)} m rms`).join('; '),
      })
    }
  }

  return { views, refused, worstResidualM: worst, steps, reasons }
}

function auditOneView(registration: ElevationRegistration, masses: readonly MassHypothesis[], roofs: readonly RoofSupportHypothesis[], storeys: readonly StoreyLayoutHypothesis[], drawn: Array<{ x: number; y: number }> | undefined): StructuralViewAudit {
  const side = registration.side as BuildingSide
  const alongX = side === 'FRONT' || side === 'REAR'
  const bounds = masses.map((mass) => ({ mass, b: ringBounds(mass.ring) }))
  const lo = Math.min(...bounds.map(({ b }) => (alongX ? b.x0 : b.z0)))
  const hi = Math.max(...bounds.map(({ b }) => (alongX ? b.x1 : b.z1)))

  const projected: ProjectedMass[] = bounds
    .map(({ mass, b }) => {
      const roof = roofs.find((r) => r.massId === mass.id)
      // A gable's ridge runs along one axis; a view looking ACROSS that axis
      // sees the gable end, and one looking along it sees the rake.
      const facing: 'PITCH' | 'RAKE' = roof?.ridgeAxis === undefined ? 'RAKE' : (roof.ridgeAxis === 'X') === alongX ? 'RAKE' : 'PITCH'
      const { topM, why } = topOf(mass, roof, storeys, facing)
      // A view from the far side sees the same bodies mirrored, so the
      // left-to-right order is taken from the side the drawing looks from.
      const near = alongX ? b.x0 : b.z0
      const far = alongX ? b.x1 : b.z1
      const u0 = side === 'REAR' || side === 'LEFT' ? round6(hi - far) : round6(near - lo)
      const u1 = side === 'REAR' || side === 'LEFT' ? round6(hi - near) : round6(far - lo)
      return { massId: mass.id, u0, u1, topM: round6(topM), overhangM: round6(roof?.overhangM?.value ?? 0), why }
    })
    .sort((a, b) => a.u0 - b.u0 || a.massId.localeCompare(b.massId))

  const widthM = round6(Math.max(...projected.map((p) => p.u1)) - Math.min(...projected.map((p) => p.u0)))
  const heightM = round6(Math.max(...projected.map((p) => p.topM)))
  const observedWidth = round6((registration.extent.x1 - registration.extent.x0) * registration.metresPerPixelU)
  const observedHeight = round6((registration.extent.y1 - registration.extent.y0) * registration.metresPerPixelV)
  // A shape check is only worth running against an outline that IS the
  // building's. An eaves projection is a few per cent of a facade; an outline
  // half as wide again as the building it is supposed to trace has caught the
  // ground, the planting and the driveway with it, which is what happens when
  // the "elevation" a publisher ships is a photo-realistic render. Comparing a
  // roofline with that measures the landscaping.
  const surplus = round6(registration.overhangM * 2)
  const traceable = surplus <= widthM * 0.25
  const profile = traceable ? compareProfiles(registration, projected, roofs, alongX, drawn) : undefined
  // The drawing's outline includes the eaves the registration measured, so the
  // width it is compared against is the walls plus that overhang: a model that
  // matched the silhouette exactly would be one whose walls were two eaves too
  // wide.
  const expectedWidth = round6(widthM + registration.overhangM * 2)
  const steps = new Set(projected.map((p) => p.topM.toFixed(2))).size

  return {
    frameId: registration.frameId,
    side,
    masses: projected,
    projected: { widthM: expectedWidth, heightM },
    observed: { widthM: observedWidth, heightM: observedHeight },
    widthResidualM: round6(Math.abs(expectedWidth - observedWidth)),
    heightResidualM: round6(Math.abs(heightM - observedHeight)),
    steps,
    surplusM: surplus,
    profile,
    why:
      `${projected.length} ${projected.length === 1 ? 'body' : 'bodies'} at ${steps} ${steps === 1 ? 'height' : 'heights'} — ` +
      projected.map((p) => `${p.massId} ${p.u0.toFixed(2)}–${p.u1.toFixed(2)} m to ${p.topM.toFixed(2)} m (${p.why})`).join('; '),
  }
}

/**
 * The model's top edge against the drawn one, sampled across the view.
 *
 * Both profiles are functions of the same u: how high the building is at that
 * distance along the view. The model's comes from the bodies and the roofs
 * over them; the drawing's comes from the traced outline. Where they disagree
 * is where the shape is wrong, and the disagreement is in metres because that
 * is the unit a reader can judge.
 */
function compareProfiles(
  registration: ElevationRegistration,
  projected: readonly ProjectedMass[],
  roofs: readonly RoofSupportHypothesis[],
  alongX: boolean,
  drawn: Array<{ x: number; y: number }> | undefined,
): { samples: number; rmsM: number; maxM: number } | undefined {
  if (!drawn || drawn.length < 3) return undefined
  const u0 = Math.min(...projected.map((p) => p.u0))
  const u1 = Math.max(...projected.map((p) => p.u1))
  if (!(u1 > u0)) return undefined

  // Where the drawing's outline is at a given x, in pixels: the topmost edge
  // crossing that column. A polygon traced round a building has exactly one
  // top edge over any column of it.
  const topPxAt = (x: number): number | undefined => {
    let best: number | undefined
    for (let i = 0; i < drawn.length; i += 1) {
      const a = drawn[i]
      const b = drawn[(i + 1) % drawn.length]
      const lo = Math.min(a.x, b.x)
      const hi = Math.max(a.x, b.x)
      if (x < lo || x > hi || hi === lo) continue
      const y = a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x)
      if (best === undefined || y < best) best = y
    }
    return best
  }

  // And where the MODEL's is: the tallest body covering that point, with a
  // gable drawn as the triangle it is.
  const modelTopAt = (u: number): number | undefined => {
    let best: number | undefined
    for (const mass of projected) {
      // A silhouette traces the ROOF, and a roof reaches past the walls it
      // sits on. Over the strip where a house's eaves oversail the garage
      // beside it, the outline is the house's, and a profile built from wall
      // extents alone reports the garage's roof there and a two-and-a-half
      // metre error with it.
      if (u < mass.u0 - mass.overhangM || u > mass.u1 + mass.overhangM) continue
      const roof = roofs.find((r) => r.massId === mass.massId)
      let top = mass.topM
      const eaves = roof?.eaveLevelM?.value
      const ridge = roof?.ridgeLevelM?.value
      const facesPitch = roof?.ridgeAxis !== undefined && (roof.ridgeAxis === 'X') !== alongX
      if (facesPitch && roof?.kind === 'GABLE' && eaves !== undefined && ridge !== undefined && ridge > eaves) {
        const half = (mass.u1 - mass.u0) / 2
        // Past the wall the rake carries on level: the verge is at the eaves.
        const fromEnd = Math.min(Math.max(0, u - mass.u0), Math.max(0, mass.u1 - u))
        top = eaves + (ridge - eaves) * (half <= 0 ? 1 : Math.min(1, fromEnd / half))
      } else if (facesPitch && roof?.kind === 'MONOPITCH' && eaves !== undefined && ridge !== undefined) {
        top = eaves + (ridge - eaves) * Math.min(1, Math.max(0, (u - mass.u0) / Math.max(1e-9, mass.u1 - mass.u0)))
      }
      if (best === undefined || top > best) best = top
    }
    return best
  }

  const groundPx = registration.extent.y1
  const residuals: number[] = []
  const samples = 48
  // How far sideways the two profiles may be out of step before a difference
  // between them counts as a difference in SHAPE.
  //
  // The registration measures the eaves projection as HALF THE SURPLUS width,
  // which is right when the roof oversails both ends equally and wrong by a
  // whole overhang when it oversails one — which is what happens the moment a
  // pitched house stands beside a flat-roofed garage. So the assumed shift can
  // be out by one overhang, and where a body's face actually is is good to
  // about a wall thickness. Each sample is allowed to find its match within
  // that. A model whose step is in the wrong PLACE by metres, or which has no
  // step at all, is nowhere near this window and still fails.
  const slack = registration.overhangM * 1.5 + 0.35
  const steps = 16
  for (let i = 0; i <= samples; i += 1) {
    const u = u0 + ((u1 - u0) * i) / samples
    const model = modelTopAt(u)
    if (model === undefined) continue
    let best: number | undefined
    for (let k = -steps; k <= steps; k += 1) {
      const px = registration.extent.x0 + (u - u0 + registration.overhangM + (slack * k) / steps) / Math.max(1e-9, registration.metresPerPixelU)
      const y = topPxAt(px)
      if (y === undefined) continue
      const residual = Math.abs(model - (groundPx - y) * registration.metresPerPixelV)
      if (best === undefined || residual < best) best = residual
    }
    if (best !== undefined) residuals.push(best)
  }
  if (residuals.length === 0) return undefined
  return {
    samples: residuals.length,
    rmsM: round6(Math.sqrt(residuals.reduce((a, r) => a + r * r, 0) / residuals.length)),
    maxM: round6(Math.max(...residuals)),
  }
}
