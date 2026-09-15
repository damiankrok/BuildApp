/**
 * The whole reconstruction, end to end.
 *
 * Everything here is a consequence of the evidence it is given and of the
 * conventions declared in `solve.ts`. There are no project constants, no
 * publisher knowledge, and no reference geometry — the same code reconstructs
 * a synthetic fixture house and a published Polish catalogue project, and the
 * only thing that differs is what the drawings say.
 */
import { round6, stableId, hashArtifact } from '@buildapp/source-common'
import type { SourceCoordinateFrame, SourceObservationGraph } from '@buildapp/source-observations'
import type { MetricEvidenceSet } from '@buildapp/source-metrics'
import type { BuildingCommand } from '@buildapp/commands'
import type { CanonicalBuildingModel } from '@buildapp/model'
import { CONVENTIONS, SOLVER_NAME, SOLVER_VERSION, candidatesFrom, choosePlan, footprintFrom, levelsFrom, registerElevationFrames } from './solve.js'
import { detectContradictions, solveQuantity } from './constraints.js'
import type { Constraint, SolvedQuantity } from './constraints.js'
import { fuseCandidates } from './fusion.js'
import type { FusionCounts } from './fusion.js'
import { elevationMetric } from './views.js'
import type { BuildingSide, ElevationRegistration } from './views.js'
import { HYPOTHESIS_SET_SCHEMA, HYPOTHESIS_SET_SCHEMA_VERSION } from './hypotheses.js'
import type { HypothesisParameter, PrimitiveHypothesis, PrimitiveHypothesisSet, UnresolvedHypothesis } from './hypotheses.js'
import { sealCandidate } from './candidate.js'
import type { CandidateContradiction, PrimitiveTrace, ReconstructionCandidate, SolverStep, UnresolvedCandidate } from './candidate.js'

export type ReconstructionOptions = {
  label: string
  slug: string
  sourcePackageId: string
  sourcePackageHash: string
  graph: SourceObservationGraph
  metrics: MetricEvidenceSet
  /** Restrict to these frames: a mutation test removes a drawing this way. */
  frameFilter?: (frame: SourceCoordinateFrame) => boolean
}

export type ReconstructionResult = {
  hypotheses: PrimitiveHypothesisSet
  candidate: ReconstructionCandidate
  model: CanonicalBuildingModel
}

/**
 * Which wall of the ring each side is, and which way an elevation reads.
 *
 * The footprint is emitted anticlockwise from the origin corner, so the four
 * walls are always in the same order and their ids are `${ring}-w${i}`. An
 * elevation is drawn as seen from OUTSIDE, so its left-hand edge is the wall's
 * far end: `offset = length - u`. That single rule holds for all four walls
 * because each is traversed with the building on its left, and it is what the
 * projection audit checks — a mirrored elevation shows up there as every
 * opening on that facade being reflected about its centre.
 */
const WALL_INDEX: Record<BuildingSide, number> = { REAR: 0, RIGHT: 1, FRONT: 2, LEFT: 3 }

const MATERIALS = {
  wall: 'mat-wall',
  slab: 'mat-slab',
  roof: 'mat-roof',
  member: 'mat-member',
  glass: 'mat-glass',
} as const

export function reconstruct(options: ReconstructionOptions): ReconstructionResult {
  const { graph, metrics } = options
  const keep = options.frameFilter
  const steps: SolverStep[] = []
  const constraints: Constraint[] = []
  const quantities: SolvedQuantity[] = []
  const hypotheses: PrimitiveHypothesis[] = []
  const unresolvedHypotheses: UnresolvedHypothesis[] = []
  const unresolved: UnresolvedCandidate[] = []
  const traces: PrimitiveTrace[] = []
  const program: BuildingCommand[] = []

  const step = (s: Omit<SolverStep, 'index'>): void => {
    steps.push({ ...s, index: steps.length })
  }
  const gap = (u: Omit<UnresolvedCandidate, 'id'>): void => {
    unresolved.push({ ...u, id: stableId('gap', u.what.slice(0, 40).replace(/[^a-z0-9]+/gi, '-'), { what: u.what, status: u.status }) })
  }
  const constrain = (c: Omit<Constraint, 'id'>): Constraint => {
    const constraint: Constraint = { ...c, id: stableId('constraint', `${c.subject.hypothesisId}-${c.subject.parameter}`, { subject: c.subject, class: c.class, value: c.value ?? null, evidenceIds: [...c.evidenceIds].sort() }) }
    constraints.push(constraint)
    return constraint
  }
  const settle = (hypothesisId: string, parameter: string, prior?: { value: number; low: number; high: number }): SolvedQuantity => {
    const solved = solveQuantity({ hypothesisId, parameter }, constraints, prior)
    quantities.push(solved)
    return solved
  }
  const parameterOf = (solved: SolvedQuantity, unit: HypothesisParameter['unit'], basis: HypothesisParameter['basis'], evidenceIds: string[]): HypothesisParameter => ({
    name: solved.subject.parameter,
    value: solved.value,
    low: solved.low,
    high: solved.high,
    unit,
    basis,
    evidenceIds,
    why: solved.why,
  })

  // -------------------------------------------------------------------------
  // 1. massing
  // -------------------------------------------------------------------------
  const plan = choosePlan(graph, metrics, keep)
  const massId = 'hyp-mass'
  if (!plan) {
    step({ stage: 'massing', what: 'a registered ground plan to measure the building from', method: 'REFUSED', detail: 'no plan on this package registered against a consistent scale', inputs: metrics.coordinateRegistrations.length, outputs: 0 })
    gap({ what: 'the building footprint', reason: 'no ground plan registered against a consistent scale, so nothing states how large the building is', status: 'MISSING', observationIds: [], evidenceIds: [] })
    unresolvedHypotheses.push({ id: 'unres-mass', kind: 'BUILDING_MASS', what: 'the building mass', reason: 'no registered ground plan', status: 'MISSING', observationIds: [] })
  } else {
    const footprint = footprintFrom(metrics, plan.frame.id)
    const axes: Array<['width' | 'depth', (typeof footprint)['width']]> = [
      ['width', footprint.width],
      ['depth', footprint.depth],
    ]
    for (const [name, found] of axes) {
      if (found) {
        constrain({
          class: found.hard ? 'HARD' : 'SOFT',
          subject: { hypothesisId: massId, parameter: name },
          value: found.value,
          tolerance: found.hard ? 0.01 : 0.15,
          weight: found.hard ? 1 : 0.6,
          unit: 'm',
          evidenceIds: found.evidenceIds,
          observationIds: [],
          why: `${found.why}, on ${plan.frame.assetId}`,
        })
      } else {
        gap({ what: `the building's ${name}`, reason: `no dimension chain on the ground plan measures the ${name}`, status: 'MISSING', observationIds: [], evidenceIds: [] })
      }
    }
    step({ stage: 'massing', what: 'the footprint, from the plan chains', method: 'DISCRETE_SELECTION', detail: `${plan.frame.assetId} at ${plan.registration.metresPerPixelX} m/px, ${plan.registration.anchors.length} anchors, rms ${plan.registration.residual.rmsM} m`, inputs: metrics.chains.filter((c) => c.frameId === plan.frame.id).length, outputs: axes.filter(([, f]) => f !== undefined).length, residual: plan.registration.residual.rmsM })
  }

  const widthQ = settle(massId, 'width', { value: 10, low: 6, high: 20 })
  const depthQ = settle(massId, 'depth', { value: 8, low: 5, high: 16 })

  // -------------------------------------------------------------------------
  // 2. levels
  // -------------------------------------------------------------------------
  const sectionFrame = graph.coordinateFrames.find((f) => f.roles.projection === 'ORTHOGRAPHIC_SECTION' && (keep ? keep(f) : true))
  const levels = levelsFrom(metrics, sectionFrame?.id)
  step({
    stage: 'levels',
    what: 'the storeys, from the section ladder',
    method: levels.measured ? 'DIRECT' : 'REFUSED',
    detail: levels.measured ? `${levels.floors.length} floor datums and a top datum at ${levels.topDatum} m` : 'no section printed two level datums that a ladder could fit',
    inputs: levels.evidenceIds.length,
    outputs: levels.floors.length,
  })
  if (!levels.measured) {
    gap({ what: 'the storey heights', reason: 'no section on this package prints two level datums that agree on a vertical scale; a domestic storey height is assumed', status: 'MISSING', observationIds: [], evidenceIds: [] })
  }
  levels.heights.forEach((height, i) => {
    const id = `hyp-level-${i}`
    constrain({
      class: levels.measured && i + 1 < levels.floors.length ? 'HARD' : 'SOFT',
      subject: { hypothesisId: id, parameter: 'height' },
      value: height,
      tolerance: levels.measured ? 0.02 : 0.6,
      weight: levels.measured ? 1 : 0.3,
      unit: 'm',
      evidenceIds: levels.evidenceIds,
      observationIds: [],
      why: levels.measured && i + 1 < levels.floors.length ? `two printed level datums ${height} m apart` : 'the top storey is not closed by a datum above it, so it takes the height of the storey below',
    })
  })
  const levelHeights = levels.heights.map((_, i) => settle(`hyp-level-${i}`, 'height', { value: CONVENTIONS.storeyHeight, low: 2.2, high: 3.6 }))
  const wallTop = levels.floors[0] + levelHeights.reduce((a, q) => a + q.value, 0)
  const totalHeight = levels.topDatum !== undefined && levels.topDatum > wallTop ? levels.topDatum : round6(wallTop + Math.max(0.5, (depthQ.value / 2) * Math.tan((30 * Math.PI) / 180)))

  // -------------------------------------------------------------------------
  // 3. views
  // -------------------------------------------------------------------------
  const massing = { width: widthQ.value, depth: depthQ.value, totalHeight }
  const { registrations, refused } = registerElevationFrames(graph, massing, keep)
  step({ stage: 'views', what: 'elevations registered against the massing', method: 'DIRECT', detail: registrations.map((r) => `${r.side}: ${r.metresPerPixelU} m/px across, ${r.metresPerPixelV} up, anisotropy ${r.anisotropy}`).join('; ') || 'none', inputs: graph.coordinateFrames.filter((f) => f.roles.projection === 'ORTHOGRAPHIC_ELEVATION').length, outputs: registrations.length })
  for (const r of refused) gap({ what: `a metric registration for elevation ${r.frameId}`, reason: r.why, status: 'AMBIGUOUS', observationIds: [], evidenceIds: [] })
  for (const r of registrations) {
    if (r.sideConfidence >= 0.6) continue
    gap({ what: `which wall the elevation on ${r.assetId} shows`, reason: `${r.sideWhy}; it was placed on the ${r.side} and the placement is not certain`, status: 'AMBIGUOUS', observationIds: [], evidenceIds: [] })
  }

  // -------------------------------------------------------------------------
  // 4. openings and facade solids
  // -------------------------------------------------------------------------
  const openingCandidates = candidatesFrom(graph, registrations, ['OPENING', 'WINDOW', 'DOOR'])
  const openingFusion = fuseCandidates(openingCandidates, { duplicateIoU: 0.4, clusterIoU: 0.4, continuityGap: 0, minConfidence: 0.5 })
  const memberCandidates = candidatesFrom(graph, registrations, ['LINEAR_VOLUME_CANDIDATE'])
  const memberFusion = fuseCandidates(memberCandidates, { minConfidence: 0.45 })
  const fusion: FusionCounts = {
    rawCandidates: openingFusion.counts.rawCandidates + memberFusion.counts.rawCandidates,
    afterDuplicateSuppression: openingFusion.counts.afterDuplicateSuppression + memberFusion.counts.afterDuplicateSuppression,
    afterClustering: openingFusion.counts.afterClustering + memberFusion.counts.afterClustering,
    afterContinuityMerge: openingFusion.counts.afterContinuityMerge + memberFusion.counts.afterContinuityMerge,
    accepted: openingFusion.fused.length + memberFusion.fused.length,
    rejected: [...openingFusion.counts.rejected, ...memberFusion.counts.rejected].reduce<FusionCounts['rejected']>((acc, r) => {
      const held = acc.find((x) => x.why === r.why)
      if (held) held.count += r.count
      else acc.push({ ...r })
      return acc
    }, []).sort((a, b) => b.count - a.count || a.why.localeCompare(b.why)),
  }
  step({ stage: 'fusion', what: 'source sightings reduced to members', method: 'DISCRETE_SELECTION', detail: `${fusion.rawCandidates} sightings -> ${fusion.accepted} members; ${fusion.rejected.map((r) => `${r.count} ${r.why}`).join(', ')}`, inputs: fusion.rawCandidates, outputs: fusion.accepted })

  // -------------------------------------------------------------------------
  // 5. the program
  // -------------------------------------------------------------------------
  program.push(
    { type: 'setModelName', name: options.label },
    { type: 'createBuilding', id: 'bld-auto', name: options.label },
    { type: 'defineMaterial', id: MATERIALS.wall, name: 'Rendered wall', color: '#e8e4dc' },
    { type: 'defineMaterial', id: MATERIALS.slab, name: 'Concrete slab', color: '#c9c6c0' },
    { type: 'defineMaterial', id: MATERIALS.roof, name: 'Roof covering', color: '#5a5550' },
    { type: 'defineMaterial', id: MATERIALS.member, name: 'Facade member', color: '#b0aaa0' },
    { type: 'defineMaterial', id: MATERIALS.glass, name: 'Glazing', color: '#9fc3d8', opacity: 0.35 },
  )

  const W = widthQ.value
  const D = depthQ.value
  const footprintPolygon = [
    { x: 0, z: 0 },
    { x: round6(W), z: 0 },
    { x: round6(W), z: round6(D) },
    { x: 0, z: round6(D) },
  ]

  // Wall thickness: measured where the plan measures it, assumed where it does not.
  const thicknessEvidence = metrics.evidence.filter((e) => e.kind === 'LINEAR_DIMENSION' && e.frameId === plan?.frame.id && e.value >= 15 && e.value <= 60 && e.origin !== 'DERIVED')
  if (thicknessEvidence.length > 0) {
    const best = thicknessEvidence.sort((a, b) => b.confidence - a.confidence)[0]
    constrain({ class: 'SOFT', subject: { hypothesisId: massId, parameter: 'wallThickness' }, value: round6(best.value / 100), tolerance: 0.06, weight: 0.5, unit: 'm', evidenceIds: [best.id], observationIds: [], why: `a ${best.value} cm dimension on the plan, the right size for an external wall` })
  } else {
    gap({ what: 'the external wall thickness', reason: 'no dimension on the plan measures a wall; a domestic external wall is assumed', status: 'MISSING', observationIds: [], evidenceIds: [] })
  }
  const thicknessQ = settle(massId, 'wallThickness', { value: CONVENTIONS.wallThickness, low: 0.25, high: 0.5 })

  let elevation = round6(levels.floors[0])
  const levelIds: string[] = []
  const ringIds: string[] = []
  levelHeights.forEach((heightQ, i) => {
    const levelId = `lvl-${i}`
    const ringId = `ring-${i}`
    levelIds.push(levelId)
    ringIds.push(ringId)
    program.push({ type: 'createLevel', id: levelId, name: i === 0 ? 'Ground' : `Level ${i}`, index: i, elevation, height: heightQ.value })
    program.push({ type: 'createSlab', id: `slab-${i}`, levelId, polygon: footprintPolygon, topOffset: 0, thickness: CONVENTIONS.slabThickness, materialId: MATERIALS.slab })
    program.push({
      type: 'createWallRing',
      id: ringId,
      levelId,
      polygon: footprintPolygon,
      thickness: thicknessQ.value,
      height: heightQ.value,
      baseOffset: 0,
      kind: 'EXTERIOR',
      cornerOwnership: 'ALTERNATE',
      materialId: MATERIALS.wall,
    })
    hypotheses.push({
      id: `hyp-ring-${i}`,
      kind: 'WALL_RING',
      parentId: massId,
      parameters: [parameterOf(heightQ, 'm', levels.measured ? 'MEASURED' : 'ASSUMED', levels.evidenceIds), parameterOf(thicknessQ, 'm', thicknessEvidence.length > 0 ? 'SCALED' : 'ASSUMED', thicknessQ.constraintIds)],
      sightings: [],
      rivalIds: [],
      observationIds: [],
      evidenceIds: levels.evidenceIds,
      viewSupport: plan ? 1 : 0,
      confidence: round6(levels.measured ? 0.8 : 0.4),
      provenance: { rule: 'ring-from-footprint', detail: 'the footprint the plan chains measure, extruded to the storey height the section states', merged: 0 },
    })
    traces.push({ objectId: ringId, kind: 'wallRing', hypothesisId: `hyp-ring-${i}`, evidenceIds: [...new Set([...widthQ.constraintIds, ...depthQ.constraintIds, ...levels.evidenceIds])], observationIds: [], rejected: [], why: `footprint ${W} by ${D} m from the plan chains, ${heightQ.value} m high from the section datums` })
    elevation = round6(elevation + heightQ.value)
  })

  // -------------------------------------------------------------------------
  // the roof
  // -------------------------------------------------------------------------
  const topLevelId = levelIds[levelIds.length - 1]
  const eaves = round6(levels.floors[0] + levelHeights.reduce((a, q) => a + q.value, 0))
  const rise = round6(Math.max(0.3, totalHeight - eaves))
  // The ridge runs along the LONGER axis: a gable at each short end is what a
  // rectangular house is roofed with, and the span the pitch is measured
  // across is therefore the shorter one.
  const ridgeAxis: 'X' | 'Z' = W >= D ? 'X' : 'Z'
  const span = ridgeAxis === 'X' ? D : W
  const derivedPitch = round6((Math.atan(rise / Math.max(0.5, span / 2)) * 180) / Math.PI)
  constrain({ class: 'SOFT', subject: { hypothesisId: 'hyp-roof', parameter: 'pitchDeg' }, value: derivedPitch, tolerance: 3, weight: 0.8, unit: 'deg', evidenceIds: levels.evidenceIds, observationIds: [], why: `the ridge stands ${rise} m above the eaves over a ${round6(span / 2)} m half-span` })
  const printedPitch = metrics.evidence.filter((e) => e.kind === 'ANGLE' && e.association.kind === 'ANGLE_MARKER' && e.value >= 10 && e.value <= 60).sort((a, b) => b.confidence - a.confidence)[0]
  if (printedPitch) {
    constrain({ class: 'SOFT', subject: { hypothesisId: 'hyp-roof', parameter: 'pitchDeg' }, value: printedPitch.value, tolerance: 2, weight: printedPitch.confidence, unit: 'deg', evidenceIds: [printedPitch.id], observationIds: printedPitch.observationIds, why: `a ${printedPitch.value} degree angle printed against a sloping edge` })
  } else {
    gap({ what: 'a printed roof pitch', reason: 'no legible angle on any sheet is attached to a sloping edge; the pitch is derived from the ridge height and the span instead', status: 'MISSING', observationIds: [], evidenceIds: [] })
  }
  const pitchQ = settle('hyp-roof', 'pitchDeg', { value: 30, low: 15, high: 50 })
  // The eaves projection each registered elevation measured: the surplus of
  // the silhouette over the wall it shows. Several views measuring the same
  // roof is exactly what a soft constraint is for.
  for (const r of registrations) {
    if (r.overhangM <= 0.02 || r.overhangM > 1.6) continue
    constrain({ class: 'SOFT', subject: { hypothesisId: 'hyp-roof', parameter: 'overhang' }, value: r.overhangM, tolerance: 0.2, weight: r.confidence, unit: 'm', evidenceIds: [], observationIds: [], why: `the ${String(r.side).toLowerCase()} elevation's silhouette runs ${r.overhangM} m past the wall beneath it` })
  }
  const overhangQ = settle('hyp-roof', 'overhang', { value: CONVENTIONS.roofOverhang, low: 0.2, high: 1.2 })
  step({ stage: 'roof', what: 'the pitch', method: printedPitch ? 'WEIGHTED_LEAST_SQUARES' : 'DIRECT', detail: `${pitchQ.value} degrees (${pitchQ.class.toLowerCase()}), ridge ${rise} m above eaves over ${round6(span / 2)} m`, inputs: printedPitch ? 2 : 1, outputs: 1, residual: pitchQ.residual })
  program.push({
    type: 'createRoof',
    id: 'roof-main',
    levelId: topLevelId,
    kind: 'GABLE',
    footprint: { minX: 0, minZ: 0, maxX: round6(W), maxZ: round6(D) },
    eaveOffset: 0,
    pitchDeg: pitchQ.value,
    ridgeAxis,
    overhang: overhangQ.value,
    thickness: CONVENTIONS.roofThickness,
    materialId: MATERIALS.roof,
    capWallIds: [0, 1, 2, 3].map((i) => `${ringIds[ringIds.length - 1]}-w${i}`),
  })
  hypotheses.push({
    id: 'hyp-roof',
    kind: 'ROOF_SYSTEM',
    parentId: massId,
    parameters: [parameterOf(pitchQ, 'deg', printedPitch ? 'MEASURED' : 'DERIVED', pitchQ.constraintIds)],
    sightings: [],
    rivalIds: [],
    observationIds: graph.observations.filter((o) => o.kind === 'RIDGE' || o.kind === 'ROOF_EDGE').map((o) => o.id).slice(0, 24),
    evidenceIds: levels.evidenceIds,
    viewSupport: registrations.length,
    confidence: 0.6,
    provenance: { rule: 'roof-from-ridge-and-span', detail: `ridge ${rise} m above the eaves, span ${span} m, pitch ${pitchQ.value} degrees`, merged: 0 },
  })
  traces.push({ objectId: 'roof-main', kind: 'roof', hypothesisId: 'hyp-roof', evidenceIds: levels.evidenceIds, observationIds: [], rejected: [], why: `a gable along ${ridgeAxis}, pitched ${pitchQ.value} degrees to put the ridge at ${totalHeight} m` })
  if (overhangQ.class === 'UNRESOLVED') gap({ what: 'the roof overhang', placeholderId: 'roof-main', reason: 'no elevation silhouette runs past its wall by a plausible eaves projection; a domestic overhang is assumed', status: 'MISSING', observationIds: [], evidenceIds: [] })

  // -------------------------------------------------------------------------
  // openings
  // -------------------------------------------------------------------------
  let openingCount = 0
  const occupied = new Map<string, Array<{ id: string; from: number; to: number; sill: number; height: number }>>()
  // Biggest first: where two detections of one hole disagree, the one that
  // explains more of the facade is the one to keep.
  for (const fused of [...openingFusion.fused].sort((a, b) => (b.box.x1 - b.box.x0) * (b.box.y1 - b.box.y0) - (a.box.x1 - a.box.x0) * (a.box.y1 - a.box.y0) || a.id.localeCompare(b.id))) {
    const payload = fused.members[0].payload
    if (!payload) continue
    const { side, registration } = payload
    const level = levelForBox(fused.box, registration, levels.floors, levelHeights.map((q) => q.value))
    if (level === undefined) {
      gap({ what: `an opening on the ${side.toLowerCase()} facade`, reason: 'the opening spans a floor line, so no single storey owns it', status: 'AMBIGUOUS', observationIds: fused.observationIds, evidenceIds: [] })
      continue
    }
    const a = elevationMetric(registration, fused.box.x0, fused.box.y1)
    const b = elevationMetric(registration, fused.box.x1, fused.box.y0)
    const width = round6(Math.abs(b.u - a.u))
    const height = round6(Math.abs(b.v - a.v))
    // A hole smaller than a hand or larger than the wall is a detection, not
    // an opening.
    const wallLength = side === 'LEFT' || side === 'RIGHT' ? D : W
    if (width < 0.35 || height < 0.35 || width > wallLength * 0.9 || height > 3.2) continue
    const floor = levels.floors[level] ?? 0
    const storeyHeight = levelHeights[level].value
    const sill = round6(Math.max(0, Math.min(a.v, b.v) - floor))
    const offset = round6(Math.max(0, Math.min(wallLength - width, Math.min(a.u, b.u))))
    // An opening has to fit the wall it is cut in. One that does not is not an
    // opening the solver has understood — a loggia mouth read as a window, a
    // shadow under an eaves, a reveal line that ran into the roof — and
    // forcing it in would either fail the build or silently deform the facade.
    if (sill + height > storeyHeight - 0.05 || offset + width > wallLength - 0.05) {
      gap({
        what: `an opening ${width} by ${height} m on the ${side.toLowerCase()} facade`,
        reason: `it does not fit the ${round6(wallLength)} by ${storeyHeight} m wall it was measured against (offset ${offset}, sill ${sill}), so whatever the detector saw there is not a window`,
        status: 'AMBIGUOUS',
        observationIds: fused.observationIds,
        evidenceIds: [],
      })
      continue
    }
    const wallId = `${ringIds[level]}-w${WALL_INDEX[side]}`
    // Two openings cannot occupy the same piece of wall. Where fusion has left
    // two detections overlapping, the second is not a second window — it is
    // the same window found twice at slightly different extents, or a reveal
    // line read as a hole. Cutting both would fail the build; picking the
    // larger silently would hide the disagreement, so the loser is recorded.
    const claimed = occupied.get(wallId) ?? []
    const clash = claimed.find((c) => offset < c.to - 0.02 && offset + width > c.from + 0.02 && Math.abs(sill - c.sill) < Math.max(height, c.height))
    if (clash) {
      gap({
        what: `a second opening ${width} by ${height} m at ${offset} m along the ${side.toLowerCase()} wall`,
        reason: `it overlaps ${clash.id}, which already occupies ${round6(clash.from)} to ${round6(clash.to)} m of that wall; two detections of one hole, or two readings that disagree`,
        status: 'AMBIGUOUS',
        observationIds: fused.observationIds,
        evidenceIds: [],
      })
      continue
    }
    const id = `opening-${openingCount}`
    const kind = sill <= 0.12 && height >= 1.7 ? 'DOOR' : 'WINDOW'
    claimed.push({ id, from: offset, to: round6(offset + width), sill, height })
    occupied.set(wallId, claimed)
    program.push({ type: 'cutOpening', id, wallId, kind, offset, sill, width, height })
    if (kind === 'WINDOW') program.push({ type: 'placeWindow', id: `${id}-w`, openingId: id, materialId: MATERIALS.glass })
    else program.push({ type: 'placeDoor', id: `${id}-d`, openingId: id, materialId: MATERIALS.wall })
    const hypothesisId = `hyp-${id}`
    hypotheses.push({
      id: hypothesisId,
      kind: kind === 'DOOR' ? 'DOOR' : 'WINDOW',
      parentId: `hyp-ring-${level}`,
      parameters: [
        { name: 'width', value: width, low: round6(width * 0.94), high: round6(width * 1.06), unit: 'm', basis: 'SCALED', evidenceIds: [], why: `${round6(fused.box.x1 - fused.box.x0)} px on a facade registered at ${registration.metresPerPixelU} m/px` },
        { name: 'height', value: height, low: round6(height * 0.94), high: round6(height * 1.06), unit: 'm', basis: 'SCALED', evidenceIds: [], why: `${round6(fused.box.y1 - fused.box.y0)} px up a facade registered at ${registration.metresPerPixelV} m/px` },
        { name: 'sill', value: sill, low: round6(Math.max(0, sill - 0.12)), high: round6(sill + 0.12), unit: 'm', basis: 'SCALED', evidenceIds: [], why: 'measured from the storey floor the opening sits above' },
      ],
      sightings: fused.members.map((m) => ({ frameId: m.frameId, box: m.box, observationIds: m.observationIds, confidence: m.confidence, depthLayer: m.depthLayer })),
      rivalIds: [],
      observationIds: fused.observationIds,
      evidenceIds: [],
      viewSupport: fused.viewSupport,
      confidence: fused.confidence,
      provenance: { rule: 'opening-from-elevation', detail: fused.trace.join('; '), merged: fused.members.length },
    })
    traces.push({ objectId: id, kind: kind.toLowerCase(), hypothesisId, evidenceIds: [], observationIds: fused.observationIds, rejected: [], why: `${width} by ${height} m at ${offset} m along the ${side.toLowerCase()} wall, sill ${sill} m; ${fused.trace[0]}` })
    openingCount += 1
  }
  step({ stage: 'openings', what: 'openings cut from registered elevations', method: 'DISCRETE_SELECTION', detail: `${openingFusion.counts.rawCandidates} sightings -> ${openingCount} openings`, inputs: openingFusion.counts.rawCandidates, outputs: openingCount })

  // -------------------------------------------------------------------------
  // facade linear solids
  // -------------------------------------------------------------------------
  let memberCount = 0
  for (const fused of memberFusion.fused) {
    const payload = fused.members[0].payload
    if (!payload) continue
    const { side, registration } = payload
    // Only a member a view can see standing PROUD of the wall becomes a solid.
    // A flat coloured band with no depth evidence is a surface region, and
    // calling it a solid is exactly the invention this layer exists to avoid.
    if (fused.depthLayer !== 'PROUD_OF_WALL' && fused.depthLayer !== 'FRONT') {
      gap({ what: `a linear member on the ${side.toLowerCase()} facade`, reason: `no view says whether it stands proud of the wall (${fused.depthLayer.toLowerCase().replace(/_/g, ' ')}), so it is not built as a solid`, status: 'AMBIGUOUS', observationIds: fused.observationIds, evidenceIds: [] })
      continue
    }
    const a = elevationMetric(registration, fused.box.x0, fused.box.y1)
    const b = elevationMetric(registration, fused.box.x1, fused.box.y0)
    const horizontal = fused.orientation === 'HORIZONTAL'
    const length = round6(horizontal ? Math.abs(b.u - a.u) : Math.abs(b.v - a.v))
    const width = round6(horizontal ? Math.abs(b.v - a.v) : Math.abs(b.u - a.u))
    if (length < 0.8 || width < 0.08 || width > 1.2) continue
    const wallLength = side === 'LEFT' || side === 'RIGHT' ? D : W
    const level = 0
    const uStart = round6(Math.max(0, Math.min(a.u, b.u)))
    const yLow = round6(Math.min(a.v, b.v))
    const yHigh = round6(Math.max(a.v, b.v))
    const id = `solid-${memberCount}`
    // Depth is the one thing an elevation cannot measure. Where a view that CAN
    // see depth says it stands proud, the amount is still unmeasured, so it
    // takes the member's own visible width as its depth — a square section —
    // and says so.
    const depth = round6(Math.min(0.45, Math.max(0.12, width)))
    const { start, end } = memberEnds(side, W, D, thicknessQ.value, uStart, length, horizontal, yLow, yHigh, width)
    program.push({ type: 'createLinearSolid', id, levelId: levelIds[level], hostId: `${ringIds[level]}-w${WALL_INDEX[side]}`, start, end, width: horizontal ? width : width, depth, materialId: MATERIALS.member })
    const hypothesisId = `hyp-${id}`
    hypotheses.push({
      id: hypothesisId,
      kind: 'LINEAR_SOLID',
      parentId: `hyp-ring-${level}`,
      parameters: [
        { name: 'length', value: length, low: round6(length * 0.92), high: round6(length * 1.08), unit: 'm', basis: 'SCALED', evidenceIds: [], why: `${round6(fused.box.x1 - fused.box.x0)} px on a facade registered at ${registration.metresPerPixelU} m/px` },
        { name: 'width', value: width, low: round6(width * 0.85), high: round6(width * 1.15), unit: 'm', basis: 'SCALED', evidenceIds: [], why: 'the member as it is seen in elevation' },
        { name: 'depth', value: depth, low: 0.1, high: 0.5, unit: 'm', basis: 'ASSUMED', evidenceIds: [], why: `a view that can see depth says it stands ${fused.depthLayer.toLowerCase().replace(/_/g, ' ')}, but nothing measures how far` },
      ],
      sightings: fused.members.map((m) => ({ frameId: m.frameId, box: m.box, observationIds: m.observationIds, confidence: m.confidence, depthLayer: m.depthLayer })),
      rivalIds: [],
      observationIds: fused.observationIds,
      evidenceIds: [],
      viewSupport: fused.viewSupport,
      confidence: fused.confidence,
      provenance: { rule: 'linear-solid-from-depth-cue', detail: fused.trace.join('; '), merged: fused.members.length },
    })
    traces.push({ objectId: id, kind: 'linearSolid', hypothesisId, evidenceIds: [], observationIds: fused.observationIds, rejected: [], why: `${length} m long, ${width} m in elevation, standing ${depth} m proud of the ${side.toLowerCase()} wall; ${fused.trace.join('; ')}` })
    gap({ what: `how far the ${side.toLowerCase()} facade member ${id} stands proud of the wall`, placeholderId: id, reason: 'no view measures the projection; the member is built square in section and the depth is unresolved', status: 'AMBIGUOUS', observationIds: fused.observationIds, evidenceIds: [] })
    memberCount += 1
  }
  step({ stage: 'facade', what: 'linear solids from corroborated depth cues', method: 'DISCRETE_SELECTION', detail: `${memberFusion.counts.rawCandidates} sightings -> ${memberCount} solids`, inputs: memberFusion.counts.rawCandidates, outputs: memberCount })

  // -------------------------------------------------------------------------
  // the stair: refused rather than invented
  // -------------------------------------------------------------------------
  const stairObservations = graph.observations.filter((o) => o.kind === 'STAIR' || o.kind === 'STAIR_SYMBOL')
  if (levelIds.length > 1) {
    step({ stage: 'stair', what: 'a stair between the storeys', method: 'REFUSED', detail: `${stairObservations.length} stair observations, none of which fixes a going, a rise or a landing`, inputs: stairObservations.length, outputs: 0 })
    gap({
      what: 'the stair between the storeys',
      reason:
        stairObservations.length === 0
          ? 'no drawing on this package yields a stair the solver can measure'
          : `${stairObservations.length} stair symbols were observed, but none of them fixes a going, a rise, a width or a landing; a stair built from that would be a guess dressed as a measurement`,
      status: 'REFUSED',
      observationIds: stairObservations.map((o) => o.id),
      evidenceIds: [],
    })
  }

  // -------------------------------------------------------------------------
  // seal
  // -------------------------------------------------------------------------
  const contradictionRecords: CandidateContradiction[] = detectContradictions(constraints).map((c) => ({
    id: c.id,
    hypothesisId: c.subject.hypothesisId,
    parameter: c.subject.parameter,
    values: c.values,
    unit: c.unit,
    gap: c.gap,
    constraintIds: c.constraintIds,
    why: c.why,
  }))

  hypotheses.unshift({
    id: massId,
    kind: 'BUILDING_MASS',
    parameters: [parameterOf(widthQ, 'm', widthQ.class === 'HARD' ? 'MEASURED' : 'DERIVED', widthQ.constraintIds), parameterOf(depthQ, 'm', depthQ.class === 'HARD' ? 'MEASURED' : 'DERIVED', depthQ.constraintIds), parameterOf(thicknessQ, 'm', thicknessEvidence.length > 0 ? 'SCALED' : 'ASSUMED', thicknessQ.constraintIds)],
    sightings: [],
    rivalIds: [],
    observationIds: [],
    evidenceIds: [...widthQ.constraintIds, ...depthQ.constraintIds],
    viewSupport: plan ? 1 : 0,
    confidence: round6(widthQ.class === 'HARD' && depthQ.class === 'HARD' ? 0.9 : 0.5),
    provenance: { rule: 'mass-from-plan-chains', detail: plan ? `${plan.frame.assetId}, ${plan.registration.anchors.length} anchors` : 'no registered plan', merged: 0 },
  })

  const soft = quantities.filter((q) => q.class === 'SOFT')
  const residuals = {
    metricRmsM: round6(soft.length === 0 ? 0 : Math.sqrt(soft.filter((q) => q.unit === 'm').reduce((a, q) => a + q.residual ** 2, 0) / Math.max(1, soft.filter((q) => q.unit === 'm').length))),
    metricMaxM: round6(Math.max(0, ...soft.filter((q) => q.unit === 'm').map((q) => Math.abs(q.residual)))),
    hard: quantities.filter((q) => q.class === 'HARD').length,
    soft: soft.length,
    unresolved: quantities.filter((q) => q.class === 'UNRESOLVED').length,
  }

  const hypothesisSet = sealHypotheses({
    schema: HYPOTHESIS_SET_SCHEMA,
    schemaVersion: HYPOTHESIS_SET_SCHEMA_VERSION,
    sourcePackageId: options.sourcePackageId,
    sourcePackageHash: options.sourcePackageHash,
    observationGraphId: graph.id,
    observationGraphHash: graph.contentHash,
    metricEvidenceId: metrics.id,
    metricEvidenceHash: metrics.contentHash,
    proposers: [
      { name: 'reconstruction.massing', version: SOLVER_VERSION },
      { name: 'reconstruction.fusion', version: SOLVER_VERSION },
      { name: 'reconstruction.facade', version: SOLVER_VERSION },
    ],
    hypotheses: hypotheses.sort((a, b) => a.id.localeCompare(b.id)),
    unresolved: unresolvedHypotheses.sort((a, b) => a.id.localeCompare(b.id)),
    fusion,
  }, options.slug)

  const { candidate, model } = sealCandidate(
    {
      schema: 'buildapp.reconstruction-candidate',
      schemaVersion: '1.0.0',
      label: options.label,
      modelId: `m-auto-${options.slug}`,
      sourcePackageId: options.sourcePackageId,
      sourcePackageHash: options.sourcePackageHash,
      observationGraphId: graph.id,
      observationGraphHash: graph.contentHash,
      metricEvidenceId: metrics.id,
      metricEvidenceHash: metrics.contentHash,
      hypothesisSetId: hypothesisSet.id,
      hypothesisSetHash: hypothesisSet.contentHash,
      solver: { name: SOLVER_NAME, version: SOLVER_VERSION },
      program,
      quantities: quantities.map((q) => ({ hypothesisId: q.subject.hypothesisId, parameter: q.subject.parameter, value: q.value, unit: q.unit, class: q.class, low: q.low, high: q.high, residual: q.residual, constraintIds: q.constraintIds, why: q.why })),
      contradictions: contradictionRecords,
      unresolved: unresolved.sort((a, b) => a.id.localeCompare(b.id)),
      traces: traces.sort((a, b) => a.objectId.localeCompare(b.objectId)),
      steps,
      residuals,
    },
    options.slug,
  )

  return { hypotheses: hypothesisSet, candidate, model }
}

/** Which storey an elevation box belongs to: the one whose band it sits mostly inside. */
function levelForBox(box: { y0: number; y1: number }, registration: ElevationRegistration, floors: readonly number[], heights: readonly number[]): number | undefined {
  const low = elevationMetric(registration, 0, box.y1).v
  const high = elevationMetric(registration, 0, box.y0).v
  let best: { index: number; overlap: number } | undefined
  for (let i = 0; i < heights.length; i += 1) {
    const floor = floors[i] ?? (floors[0] ?? 0) + heights.slice(0, i).reduce((a, h) => a + h, 0)
    const ceiling = floor + heights[i]
    const overlap = Math.min(high, ceiling) - Math.max(low, floor)
    if (overlap <= 0) continue
    if (!best || overlap > best.overlap) best = { index: i, overlap }
  }
  if (!best) return undefined
  // A box that straddles a floor line belongs to neither storey.
  if (best.overlap < (high - low) * 0.7) return undefined
  return best.index
}

/**
 * Where a facade member's two ends sit in the model's coordinates.
 *
 * `uStart` is measured along the wall from the end the wall starts at, so each
 * side maps it straight onto the axis its wall runs along — the same
 * anticlockwise traversal the ring was emitted with, and the same one
 * `elevationMetric` assumes.
 */
function memberEnds(
  side: BuildingSide,
  W: number,
  D: number,
  thickness: number,
  uStart: number,
  length: number,
  horizontal: boolean,
  yLow: number,
  yHigh: number,
  width: number,
): { start: { x: number; y: number; z: number }; end: { x: number; y: number; z: number } } {
  // The member sits on the OUTER face of its wall, standing proud of it.
  const outer = thickness / 2
  const y = horizontal ? round6((yLow + yHigh) / 2) : 0
  const mid = uStart + width / 2
  if (side === 'FRONT') {
    // w2 runs from (W, D) to (0, D): u increases as x falls.
    const z = round6(D + outer)
    return horizontal
      ? { start: { x: round6(W - uStart), y, z }, end: { x: round6(W - uStart - length), y, z } }
      : { start: { x: round6(W - mid), y: yLow, z }, end: { x: round6(W - mid), y: yHigh, z } }
  }
  if (side === 'REAR') {
    // w0 runs from (0, 0) to (W, 0): u increases with x.
    const z = round6(-outer)
    return horizontal
      ? { start: { x: round6(uStart), y, z }, end: { x: round6(uStart + length), y, z } }
      : { start: { x: round6(mid), y: yLow, z }, end: { x: round6(mid), y: yHigh, z } }
  }
  if (side === 'RIGHT') {
    // w1 runs from (W, 0) to (W, D): u increases with z.
    const x = round6(W + outer)
    return horizontal
      ? { start: { x, y, z: round6(uStart) }, end: { x, y, z: round6(uStart + length) } }
      : { start: { x, y: yLow, z: round6(mid) }, end: { x, y: yHigh, z: round6(mid) } }
  }
  // w3 runs from (0, D) to (0, 0): u increases as z falls.
  const x = round6(-outer)
  return horizontal
    ? { start: { x, y, z: round6(D - uStart) }, end: { x, y, z: round6(D - uStart - length) } }
    : { start: { x, y: yLow, z: round6(D - mid) }, end: { x, y: yHigh, z: round6(D - mid) } }
}

/** Seal the hypothesis set: content hash, then an id derived from it. */
export function sealHypotheses(draft: Omit<PrimitiveHypothesisSet, 'id' | 'contentHash'>, slug: string): PrimitiveHypothesisSet {
  const contentHash = hashArtifact(HYPOTHESIS_SET_SCHEMA, HYPOTHESIS_SET_SCHEMA_VERSION, [
    { label: 'package', ordered: { id: draft.sourcePackageId, hash: draft.sourcePackageHash } },
    { label: 'observations', ordered: { id: draft.observationGraphId, hash: draft.observationGraphHash } },
    { label: 'metrics', ordered: { id: draft.metricEvidenceId, hash: draft.metricEvidenceHash } },
    { label: 'proposers', unordered: draft.proposers },
    {
      label: 'hypotheses',
      unordered: draft.hypotheses.map((h) => ({
        kind: h.kind,
        parentId: h.parentId ?? null,
        parameters: h.parameters.map((p) => ({ name: p.name, value: p.value, low: p.low, high: p.high, unit: p.unit, basis: p.basis, evidenceIds: [...p.evidenceIds].sort() })),
        sightings: h.sightings.map((s) => ({ frameId: s.frameId, box: s.box, confidence: s.confidence, depthLayer: s.depthLayer })),
        observationIds: [...h.observationIds].sort(),
        evidenceIds: [...h.evidenceIds].sort(),
        viewSupport: h.viewSupport,
        confidence: h.confidence,
        rule: h.provenance.rule,
        merged: h.provenance.merged,
      })),
    },
    { label: 'unresolved', unordered: draft.unresolved.map((u) => ({ kind: u.kind, what: u.what, status: u.status })) },
    { label: 'fusion', ordered: draft.fusion },
  ])
  return { ...draft, id: `hypotheses-${slug}-${contentHash.slice(0, 16)}`, contentHash }
}
