/**
 * The whole reconstruction, end to end.
 *
 * The order is the stage's whole point. The building's COMPOSITION is settled
 * first — which bodies there are, how far up each one goes, what roof each one
 * carries — and only then is any of it turned into geometry. The version this
 * replaces went the other way round: it took the widest dimension on each axis,
 * drew one rectangle, and spent the rest of its work fitting numbers to an
 * object that was already the wrong shape.
 *
 * So: `composeStructuralLayout` reads the plans and returns a mass graph;
 * every wall ring, slab and roof here belongs to one of its masses; and the
 * layout's own verdict travels with the candidate, because a viewer showing a
 * partly-believed building has to be able to say so.
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
import type { Raster } from '@buildapp/source-cv'
import { CONVENTIONS, SOLVER_NAME, SOLVER_VERSION, candidatesFrom, levelsFrom, registerElevationFrames } from './solve.js'
import { composeStructuralLayout } from './structural.js'
import type { PublishedArea } from './layout-gate.js'
import { ringBounds } from './structural-layout.js'
import type { MassHypothesis, PlanSide, RoofSupportHypothesis, StructuralLayoutHypothesisSet } from './structural-layout.js'
import { detectContradictions, solveQuantity } from './constraints.js'
import type { Constraint, SolvedQuantity } from './constraints.js'
import { fuseCandidates } from './fusion.js'
import type { FusionCounts } from './fusion.js'
import { elevationMetric } from './views.js'
import type { BuildingSide, ElevationRegistration } from './views.js'
import { HYPOTHESIS_SET_SCHEMA, HYPOTHESIS_SET_SCHEMA_VERSION } from './hypotheses.js'
import type { HypothesisParameter, PrimitiveHypothesis, PrimitiveHypothesisSet, UnresolvedHypothesis } from './hypotheses.js'
import { CANDIDATE_SCHEMA_VERSION, sealCandidate } from './candidate.js'
import type { CandidateContradiction, PrimitiveTrace, ReconstructionCandidate, SolverStep, UnresolvedCandidate } from './candidate.js'

export type ReconstructionOptions = {
  label: string
  slug: string
  sourcePackageId: string
  sourcePackageHash: string
  graph: SourceObservationGraph
  metrics: MetricEvidenceSet
  /** Decoded pixels for a frame: the structural pass reads the plans themselves. */
  raster: (frame: SourceCoordinateFrame) => Raster | undefined
  /** Figures the publisher printed. Used by the layout gate to CHECK the result, never to derive it. */
  publishedAreas?: readonly PublishedArea[]
  /** Restrict to these frames: a mutation test removes a drawing this way. */
  frameFilter?: (frame: SourceCoordinateFrame) => boolean
}

export type ReconstructionResult = {
  layout: StructuralLayoutHypothesisSet
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
  // 1. the building's composition
  // -------------------------------------------------------------------------
  const sectionFrame = graph.coordinateFrames.find((f) => f.roles.projection === 'ORTHOGRAPHIC_SECTION' && (keep ? keep(f) : true))
  const levels = levelsFrom(metrics, sectionFrame?.id)
  const { draft: layoutDraft, layout } = composeStructuralLayout({
    slug: options.slug,
    sourcePackageId: options.sourcePackageId,
    sourcePackageHash: options.sourcePackageHash,
    graph,
    metrics,
    raster: options.raster,
    frameFilter: keep,
    levels,
    publishedAreas: options.publishedAreas,
  })
  const masses = layout.masses
  step({
    stage: 'massing',
    what: 'the building, decomposed into the bodies its plans enclose',
    method: masses.length === 0 ? 'REFUSED' : 'DISCRETE_SELECTION',
    detail:
      masses.length === 0
        ? 'no plan on this package could be decomposed into anything enclosed by walls'
        : `${masses.length} ${masses.length === 1 ? 'body' : 'bodies'}: ${masses.map((m) => `${m.id} ${m.widthM.value.toFixed(2)}\u00d7${m.depthM.value.toFixed(2)} m on storeys ${m.storeySpan.fromIndex}..${m.storeySpan.toIndex} (${m.role.toLowerCase()})`).join('; ')}; gate ${layout.gate.status}`,
    inputs: layoutDraft.plans.length,
    outputs: masses.length,
  })
  for (const hole of layout.unresolved) {
    gap({ what: hole.what, reason: hole.reason, status: hole.status === 'REFUSED' ? 'REFUSED' : hole.status, observationIds: [], evidenceIds: [] })
  }
  if (masses.length === 0) {
    unresolvedHypotheses.push({ id: 'unres-mass', kind: 'BUILDING_MASS', what: 'the building mass', reason: 'no plan decomposed into a walled region', status: 'MISSING', observationIds: [] })
  }
  for (const reason of layout.gate.reasons) {
    if (reason.severity === 'NOTED') continue
    step({ stage: 'massing', what: reason.what, method: reason.severity === 'BLOCKING' ? 'REFUSED' : 'DISCRETE_SELECTION', detail: reason.why, inputs: 1, outputs: reason.severity === 'BLOCKING' ? 0 : 1 })
  }

  // The overall envelope, which is diagnostic — it registers the elevations —
  // and is never itself built.
  const massBounds = masses.map((m) => ringBounds(m.ring))
  const envelope = {
    x0: massBounds.length > 0 ? Math.min(...massBounds.map((b) => b.x0)) : 0,
    z0: massBounds.length > 0 ? Math.min(...massBounds.map((b) => b.z0)) : 0,
    x1: massBounds.length > 0 ? Math.max(...massBounds.map((b) => b.x1)) : 0,
    z1: massBounds.length > 0 ? Math.max(...massBounds.map((b) => b.z1)) : 0,
  }
  const W = round6(envelope.x1 - envelope.x0)
  const D = round6(envelope.z1 - envelope.z0)
  const footprintEvidenceIds = [...new Set(masses.flatMap((m) => m.evidenceIds))].sort()

  // -------------------------------------------------------------------------
  // 2. levels
  // -------------------------------------------------------------------------
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
  const totalHeight = levels.topDatum !== undefined && levels.topDatum > wallTop ? levels.topDatum : round6(wallTop + Math.max(0.5, (D / 2) * Math.tan((30 * Math.PI) / 180)))

  // -------------------------------------------------------------------------
  // 3. views
  // -------------------------------------------------------------------------
  const massing = { width: W, depth: D, totalHeight }
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

  // Wall thickness: measured where the plans measure it, and the plan
  // decomposition measures it on every sheet it reads — the median thickness
  // of the bands it found walls in. A printed dimension beats that, and a
  // convention is used only where there is neither.
  const drawnWall = layoutDraft.base?.decomposition.wallThickness.m
  if (drawnWall !== undefined && drawnWall >= 0.15 && drawnWall <= 0.7) {
    constrain({ class: 'SOFT', subject: { hypothesisId: 'hyp-building', parameter: 'wallThickness' }, value: round6(drawnWall), tolerance: 0.08, weight: 0.5, unit: 'm', evidenceIds: [], observationIds: [], why: `the plan draws its walls ${layoutDraft.base?.decomposition.wallThickness.px} px thick, which is ${drawnWall.toFixed(3)} m at this sheet's scale` })
  }
  const thicknessEvidence = metrics.evidence.filter((e) => e.kind === 'LINEAR_DIMENSION' && e.value >= 15 && e.value <= 60 && (e.association.kind === 'PUBLISHED_SPECIFICATION' || (e.frameId === layoutDraft.base?.frame.id && e.origin !== 'DERIVED')))
  if (thicknessEvidence.length > 0) {
    const best = thicknessEvidence.sort((a, b) => b.confidence - a.confidence)[0]
    constrain({ class: 'SOFT', subject: { hypothesisId: 'hyp-building', parameter: 'wallThickness' }, value: round6(best.value / 100), tolerance: 0.06, weight: 0.6, unit: 'm', evidenceIds: [best.id], observationIds: [], why: `a ${best.value} cm dimension, the right size for an external wall: ${best.association.why}` })
  } else if (drawnWall === undefined) {
    gap({ what: 'the external wall thickness', reason: 'no dimension measures a wall and no plan drew one thick enough to measure; a domestic external wall is assumed', status: 'MISSING', observationIds: [], evidenceIds: [] })
  }
  const thicknessQ = settle('hyp-building', 'wallThickness', { value: CONVENTIONS.wallThickness, low: 0.2, high: 0.55 })

  // --- one level per storey the layout found, shared by every mass ---------
  const storeyIndices = layout.storeys.map((s) => s.index).sort((a, b) => a - b)
  const levelIdOf = new Map<number, string>()
  const levelHeightOf = new Map<number, number>()
  const levelElevationOf = new Map<number, number>()
  storeyIndices.forEach((index, i) => {
    const storey = layout.storeys.find((s) => s.index === index)
    const height = storey?.height?.value ?? levelHeights[i]?.value ?? CONVENTIONS.storeyHeight
    const elevation = storey?.elevation?.value ?? round6(levels.floors[0] + levelHeights.slice(0, i).reduce((a, q) => a + q.value, 0))
    const levelId = `lvl-${i}`
    levelIdOf.set(index, levelId)
    levelHeightOf.set(index, round6(height))
    levelElevationOf.set(index, round6(elevation))
    program.push({ type: 'createLevel', id: levelId, name: i === 0 ? 'Ground' : `Level ${i}`, index: i, elevation: round6(elevation), height: round6(height) })
  })

  // --- one slab, one ring per storey, per MASS -----------------------------
  const ringIdOf = new Map<string, string>()
  for (const mass of masses) {
    const b = ringBounds(mass.ring)
    const polygon = [
      { x: round6(b.x0), z: round6(b.z0) },
      { x: round6(b.x1), z: round6(b.z0) },
      { x: round6(b.x1), z: round6(b.z1) },
      { x: round6(b.x0), z: round6(b.z1) },
    ]
    // §19: the TOPOLOGY was chosen discretely, by the plan decomposition, and
    // is not up for renegotiation here. What the solver does with it is
    // metric: each body's own two spans are constrained by the chains that
    // measured them, and settled the same way every other number is.
    const massHypothesisId = `hyp-${mass.id}`
    for (const [name, q] of [['width', mass.widthM], ['depth', mass.depthM]] as const) {
      // HARD only when a chain STATED the span and the readings it cites were
      // actually read. A span derived from a scale is a good number; it is not
      // a statement, and a candidate that cannot tell them apart cannot say
      // which of its dimensions it would defend.
      const cited = q.evidenceIds.map((id) => metrics.evidence.find((e) => e.id === id)).filter((e): e is NonNullable<typeof e> => e !== undefined)
      const trustworthy = cited.length > 0 && cited.every((e) => (e.origin === 'READ' || e.origin === 'CHAIN_CORRECTED') && e.confidence >= 0.45)
      constrain({
        class: q.basis === 'MEASURED' && trustworthy ? 'HARD' : 'SOFT',
        subject: { hypothesisId: massHypothesisId, parameter: name },
        value: q.value,
        tolerance: q.basis === 'MEASURED' && trustworthy ? 0.01 : 0.12,
        weight: q.basis === 'MEASURED' && trustworthy ? 1 : 0.6,
        unit: 'm',
        evidenceIds: q.evidenceIds,
        observationIds: [],
        why: q.why,
      })
    }
    const massWidthQ = settle(massHypothesisId, 'width', { value: mass.widthM.value, low: mass.widthM.low, high: mass.widthM.high })
    const massDepthQ = settle(massHypothesisId, 'depth', { value: mass.depthM.value, low: mass.depthM.low, high: mass.depthM.high })
    hypotheses.push({
      id: massHypothesisId,
      kind: 'BUILDING_MASS',
      parameters: [
        parameterOf(massWidthQ, 'm', massWidthQ.class === 'HARD' ? 'MEASURED' : 'DERIVED', massWidthQ.constraintIds),
        parameterOf(massDepthQ, 'm', massDepthQ.class === 'HARD' ? 'MEASURED' : 'DERIVED', massDepthQ.constraintIds),
      ],
      sightings: [],
      rivalIds: masses.filter((m) => m.id !== mass.id).map((m) => `hyp-${m.id}`),
      observationIds: mass.observationIds,
      evidenceIds: mass.evidenceIds,
      viewSupport: mass.storeySpan.storeyIds.length,
      confidence: mass.confidence,
      provenance: { rule: 'mass-from-plan-decomposition', detail: mass.why, merged: mass.footprintRegionIds.length },
    })
    for (const index of storeyIndices) {
      if (index < mass.storeySpan.fromIndex || index > mass.storeySpan.toIndex) continue
      const levelId = levelIdOf.get(index)
      if (!levelId) continue
      const height = levelHeightOf.get(index) ?? CONVENTIONS.storeyHeight
      const ringId = `ring-${mass.id}-${index}`
      if (index === mass.storeySpan.fromIndex) ringIdOf.set(mass.id, ringId)
      ringIdOf.set(`${mass.id}@${index}`, ringId)
      program.push({ type: 'createSlab', id: `slab-${mass.id}-${index}`, levelId, polygon, topOffset: 0, thickness: CONVENTIONS.slabThickness, materialId: MATERIALS.slab })
      program.push({
        type: 'createWallRing',
        id: ringId,
        levelId,
        polygon,
        thickness: thicknessQ.value,
        height,
        baseOffset: 0,
        kind: 'EXTERIOR',
        cornerOwnership: 'ALTERNATE',
        materialId: MATERIALS.wall,
      })
      hypotheses.push({
        id: `hyp-ring-${mass.id}-${index}`,
        kind: 'WALL_RING',
        parentId: `hyp-${mass.id}`,
        parameters: [
          { name: 'height', value: height, low: round6(height - 0.05), high: round6(height + 0.05), unit: 'm', basis: levels.measured ? 'MEASURED' : 'ASSUMED', evidenceIds: levels.evidenceIds, why: levels.measured ? 'the gap between two printed level datums' : 'a conventional storey height' },
          parameterOf(thicknessQ, 'm', thicknessEvidence.length > 0 || drawnWall !== undefined ? 'SCALED' : 'ASSUMED', thicknessQ.constraintIds),
        ],
        sightings: [],
        rivalIds: [],
        observationIds: [],
        evidenceIds: [...new Set([...mass.evidenceIds, ...levels.evidenceIds])].sort(),
        viewSupport: 1,
        confidence: round6(Math.min(mass.confidence, levels.measured ? 0.85 : 0.5)),
        provenance: { rule: 'ring-from-mass', detail: `${mass.id} on storey ${index}`, merged: 0 },
      })
      traces.push({
        objectId: ringId,
        kind: 'wallRing',
        hypothesisId: `hyp-ring-${mass.id}-${index}`,
        evidenceIds: [...new Set([...mass.evidenceIds, ...levels.evidenceIds])].sort(),
        observationIds: [],
        rejected: [],
        why: `${mass.widthM.value} by ${mass.depthM.value} m from the plan's own walls, ${height} m high from the section datums, on storey ${index}`,
      })
    }
  }

  // -------------------------------------------------------------------------
  // the roofs: one per mass, over that mass's own footprint
  // -------------------------------------------------------------------------
  const overhangByRoof = new Map<string, number>()
  for (const roof of layout.roofSupports) {
    const mass = masses.find((m) => m.id === roof.massId)
    if (!mass) continue
    const topIndex = mass.storeySpan.toIndex
    const levelId = levelIdOf.get(topIndex)
    if (!levelId) continue
    const b = ringBounds(mass.ring)
    const storeyHeight = levelHeightOf.get(topIndex) ?? CONVENTIONS.storeyHeight
    // The eaves projection each registered elevation measured, unless the
    // publisher has already said there are none: a stated fact is not a
    // starting point for a fit.
    const statedOverhang = roof.overhangM
    const hypothesisId = `hyp-${roof.id}`
    if (statedOverhang && statedOverhang.basis === 'MEASURED') {
      constrain({ class: 'HARD', subject: { hypothesisId, parameter: 'overhang' }, value: statedOverhang.value, tolerance: 0.02, weight: 1, unit: 'm', evidenceIds: statedOverhang.evidenceIds, observationIds: [], why: statedOverhang.why })
    } else {
      for (const r of registrations) {
        if (r.overhangM <= 0.02 || r.overhangM > 1.6) continue
        constrain({ class: 'SOFT', subject: { hypothesisId, parameter: 'overhang' }, value: r.overhangM, tolerance: 0.2, weight: r.confidence, unit: 'm', evidenceIds: [], observationIds: [], why: `the ${String(r.side).toLowerCase()} elevation's silhouette runs ${r.overhangM} m past the wall beneath it` })
      }
    }
    const overhangQ = settle(hypothesisId, 'overhang', { value: roof.kind === 'FLAT' ? 0 : CONVENTIONS.roofOverhang, low: 0, high: 1.2 })
    overhangByRoof.set(roof.id, overhangQ.value)
    if (roof.pitchDeg) {
      constrain({
        class: roof.authority === 'PUBLISHED_SPECIFICATION' || roof.authority === 'PRINTED_ANGLE' ? 'HARD' : 'SOFT',
        subject: { hypothesisId, parameter: 'pitchDeg' },
        value: roof.pitchDeg.value,
        tolerance: roof.authority === 'PUBLISHED_SPECIFICATION' || roof.authority === 'PRINTED_ANGLE' ? 0.01 : 2.5,
        weight: 1,
        unit: 'deg',
        evidenceIds: roof.pitchDeg.evidenceIds,
        observationIds: [],
        why: roof.pitchDeg.why,
      })
    }
    const pitchQ = settle(hypothesisId, 'pitchDeg', { value: roof.kind === 'FLAT' ? 0 : 30, low: 0, high: 60 })
    const kind = roof.kind === 'UNKNOWN' ? 'FLAT' : roof.kind === 'MONOPITCH' ? 'GABLE' : roof.kind
    program.push({
      type: 'createRoof',
      id: roof.id,
      levelId,
      // The DSL builds gables and flats. A hipped roof is emitted as a gable
      // at the same pitch and the difference is named as a hole rather than
      // silently smoothed away.
      kind: kind === 'FLAT' ? 'FLAT' : 'GABLE',
      footprint: { minX: round6(b.x0), minZ: round6(b.z0), maxX: round6(b.x1), maxZ: round6(b.z1) },
      eaveOffset: round6(storeyHeight),
      pitchDeg: kind === 'FLAT' ? 0 : pitchQ.value,
      ridgeAxis: roof.ridgeAxis ?? (b.z1 - b.z0 >= b.x1 - b.x0 ? 'Z' : 'X'),
      overhang: overhangQ.value,
      thickness: CONVENTIONS.roofThickness,
      materialId: MATERIALS.roof,
      capWallIds: [0, 1, 2, 3].map((i) => `${ringIdOf.get(`${mass.id}@${topIndex}`) ?? ''}-w${i}`).filter((w) => !w.startsWith('-')),
    })
    hypotheses.push({
      id: hypothesisId,
      kind: 'ROOF_SYSTEM',
      parentId: `hyp-${mass.id}`,
      parameters: [parameterOf(pitchQ, 'deg', roof.authority === 'CONVENTION' ? 'ASSUMED' : roof.authority === 'PUBLISHED_SPECIFICATION' || roof.authority === 'PRINTED_ANGLE' ? 'MEASURED' : 'DERIVED', pitchQ.constraintIds), parameterOf(overhangQ, 'm', statedOverhang?.basis === 'MEASURED' ? 'MEASURED' : 'ASSUMED', overhangQ.constraintIds)],
      sightings: [],
      rivalIds: [],
      observationIds: roof.observationIds,
      evidenceIds: roof.evidenceIds,
      viewSupport: registrations.length,
      confidence: roof.confidence,
      provenance: { rule: `roof-${roof.authority.toLowerCase()}`, detail: roof.why, merged: 0 },
    })
    traces.push({ objectId: roof.id, kind: 'roof', hypothesisId, evidenceIds: roof.evidenceIds, observationIds: roof.observationIds, rejected: [], why: roof.why })
    if (kind === 'HIP') gap({ what: `the hips of the roof over ${mass.id}`, placeholderId: roof.id, reason: 'the sources describe a roof falling four ways and the geometry layer builds gables and flats, so it is built as a gable at the same pitch', status: 'MISSING', observationIds: [], evidenceIds: [] })
    step({ stage: 'roof', what: `the roof over ${mass.id}`, method: roof.authority === 'CONVENTION' ? 'REFUSED' : 'DISCRETE_SELECTION', detail: `${kind.toLowerCase()}${kind === 'FLAT' ? '' : ` at ${pitchQ.value}° with its ridge along ${roof.ridgeAxis ?? '?'}`}, on the authority of ${roof.authority.toLowerCase().replace(/_/g, ' ')}`, inputs: roof.evidenceIds.length, outputs: 1, residual: pitchQ.residual })
  }

  // -------------------------------------------------------------------------
  // openings
  // -------------------------------------------------------------------------
  /**
   * Where along a facade a point in an elevation lands, and on which body.
   *
   * An elevation shows the whole building, so a position along it has to be
   * resolved to ONE mass before it can become a hole in a wall. The mapping is
   * the same anticlockwise traversal the rings were emitted with, taken over
   * the building's envelope rather than over any one body, and then the body
   * whose own face is on that side at that position is looked up.
   */
  const SIDE_TO_PLAN: Record<BuildingSide, PlanSide> = { REAR: 'MIN_Z', RIGHT: 'MAX_X', FRONT: 'MAX_Z', LEFT: 'MIN_X' }
  const facadeAt = (side: BuildingSide, u: number, storeyIndex: number): { mass: MassHypothesis; wallId: string; offset: number; wallLength: number } | undefined => {
    const world = side === 'FRONT' ? envelope.x1 - u : side === 'REAR' ? envelope.x0 + u : side === 'RIGHT' ? envelope.z0 + u : envelope.z1 - u
    const planSide = SIDE_TO_PLAN[side]
    const along = side === 'FRONT' || side === 'REAR' ? 'X' : 'Z'
    const candidates = masses
      .filter((m) => storeyIndex >= m.storeySpan.fromIndex && storeyIndex <= m.storeySpan.toIndex)
      .map((m) => ({ m, b: ringBounds(m.ring) }))
      .filter(({ b }) => (along === 'X' ? world >= b.x0 - 0.01 && world <= b.x1 + 0.01 : world >= b.z0 - 0.01 && world <= b.z1 + 0.01))
      .filter(({ m }) => layout.facadePlanes.some((f) => f.massId === m.id && f.side === planSide && f.exterior))
    if (candidates.length === 0) return undefined
    // Where two bodies are both on this side at this position, the one whose
    // face is further out is the one a viewer sees.
    const picked = candidates.sort((a, b2) => {
      const outer = (x: { b: ReturnType<typeof ringBounds> }): number => (planSide === 'MAX_Z' ? x.b.z1 : planSide === 'MIN_Z' ? -x.b.z0 : planSide === 'MAX_X' ? x.b.x1 : -x.b.x0)
      return outer(b2) - outer(a) || a.m.id.localeCompare(b2.m.id)
    })[0]
    const b = picked.b
    const wallIndex = WALL_INDEX[side]
    const ringId = ringIdOf.get(`${picked.m.id}@${storeyIndex}`)
    if (!ringId) return undefined
    const offset = side === 'FRONT' ? b.x1 - world : side === 'REAR' ? world - b.x0 : side === 'RIGHT' ? world - b.z0 : b.z1 - world
    const wallLength = along === 'X' ? b.x1 - b.x0 : b.z1 - b.z0
    return { mass: picked.m, wallId: `${ringId}-w${wallIndex}`, offset: round6(offset), wallLength: round6(wallLength) }
  }

  const storeyOrder = storeyIndices
  const floorsByStorey = storeyOrder.map((i) => levelElevationOf.get(i) ?? 0)
  const heightsByStorey = storeyOrder.map((i) => levelHeightOf.get(i) ?? CONVENTIONS.storeyHeight)

  let openingCount = 0
  const occupied = new Map<string, Array<{ id: string; from: number; to: number; sill: number; height: number }>>()
  // Biggest first: where two detections of one hole disagree, the one that
  // explains more of the facade is the one to keep.
  for (const fused of [...openingFusion.fused].sort((a, b) => (b.box.x1 - b.box.x0) * (b.box.y1 - b.box.y0) - (a.box.x1 - a.box.x0) * (a.box.y1 - a.box.y0) || a.id.localeCompare(b.id))) {
    const payload = fused.members[0].payload
    if (!payload) continue
    const { side, registration } = payload
    const slot = levelForBox(fused.box, registration, floorsByStorey, heightsByStorey)
    if (slot === undefined) {
      gap({ what: `an opening on the ${side.toLowerCase()} facade`, reason: 'the opening spans a floor line, so no single storey owns it', status: 'AMBIGUOUS', observationIds: fused.observationIds, evidenceIds: [] })
      continue
    }
    const storeyIndex = storeyOrder[slot]
    const a = elevationMetric(registration, fused.box.x0, fused.box.y1)
    const b = elevationMetric(registration, fused.box.x1, fused.box.y0)
    const width = round6(Math.abs(b.u - a.u))
    const height = round6(Math.abs(b.v - a.v))
    if (width < 0.35 || height < 0.35 || height > 3.2) continue
    const uLow = Math.min(a.u, b.u)
    const host = facadeAt(side, uLow + width / 2, storeyIndex)
    if (!host) {
      gap({
        what: `an opening ${width} by ${height} m on the ${side.toLowerCase()} facade`,
        reason: `nothing stands on that facade at ${round6(uLow + width / 2)} m along it on storey ${storeyIndex}: the detection falls outside every body the plans found`,
        status: 'AMBIGUOUS',
        observationIds: fused.observationIds,
        evidenceIds: [],
      })
      continue
    }
    const floor = floorsByStorey[slot] ?? 0
    const storeyHeight = heightsByStorey[slot]
    const sill = round6(Math.max(0, Math.min(a.v, b.v) - floor))
    // The opening's own offset along its host wall, from the same point the
    // ring starts at, with the edge of the detection rather than its centre.
    // No clamping. An opening that does not fit where it was measured is not
    // an opening that needs nudging into place — it is a detection the solver
    // has not understood, and sliding it along the wall until it fits would
    // turn a visible failure into an invisible one.
    const offset = round6(host.offset - width / 2)
    if (width > host.wallLength * 0.92) {
      gap({ what: `an opening ${width} m wide on the ${side.toLowerCase()} facade`, reason: `the wall it was measured against is only ${host.wallLength} m long, so whatever was detected spans more than one body`, status: 'AMBIGUOUS', observationIds: fused.observationIds, evidenceIds: [] })
      continue
    }
    if (offset < 0.05 || sill + height > storeyHeight - 0.05 || offset + width > host.wallLength - 0.05) {
      gap({
        what: `an opening ${width} by ${height} m on the ${side.toLowerCase()} facade`,
        reason: `it does not fit the ${host.wallLength} by ${storeyHeight} m wall it was measured against (offset ${offset}, sill ${sill}), so whatever the detector saw there is not a window`,
        status: 'AMBIGUOUS',
        observationIds: fused.observationIds,
        evidenceIds: [],
      })
      continue
    }
    const claimed = occupied.get(host.wallId) ?? []
    const clash = claimed.find((c) => offset < c.to - 0.02 && offset + width > c.from + 0.02 && Math.abs(sill - c.sill) < Math.max(height, c.height))
    if (clash) {
      gap({
        what: `a second opening ${width} by ${height} m at ${offset} m along the ${side.toLowerCase()} wall of ${host.mass.id}`,
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
    occupied.set(host.wallId, claimed)
    program.push({ type: 'cutOpening', id, wallId: host.wallId, kind, offset, sill, width, height })
    if (kind === 'WINDOW') program.push({ type: 'placeWindow', id: `${id}-w`, openingId: id, materialId: MATERIALS.glass })
    else program.push({ type: 'placeDoor', id: `${id}-d`, openingId: id, materialId: MATERIALS.wall })
    const hypothesisId = `hyp-${id}`
    hypotheses.push({
      id: hypothesisId,
      kind: kind === 'DOOR' ? 'DOOR' : 'WINDOW',
      parentId: `hyp-ring-${host.mass.id}-${storeyIndex}`,
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
    traces.push({ objectId: id, kind: kind.toLowerCase(), hypothesisId, evidenceIds: [], observationIds: fused.observationIds, rejected: [], why: `${width} by ${height} m at ${offset} m along the ${side.toLowerCase()} wall of ${host.mass.id}, sill ${sill} m; ${fused.trace[0]}` })
    openingCount += 1
  }
  step({ stage: 'openings', what: 'openings cut from registered elevations', method: 'DISCRETE_SELECTION', detail: `${openingFusion.counts.rawCandidates} sightings -> ${openingCount} openings`, inputs: openingFusion.counts.rawCandidates, outputs: openingCount })

  // -------------------------------------------------------------------------
  // facade linear solids
  // -------------------------------------------------------------------------
  let memberCount = 0
  let memberRefused = 0
  for (const fused of memberFusion.fused) {
    const payload = fused.members[0].payload
    if (!payload) continue
    const { side, registration } = payload
    // §14. A linear solid is a claim that something has DEPTH, and an
    // elevation cannot see depth. So one of three things has to be true before
    // anything is built: two independent technical views agree it is there; or
    // one does and a view that can see depth says it stands proud; or a single
    // view carries an explicit depth cue of its own. A tone band on one
    // drawing is a stripe of paint until something says otherwise, and the
    // hundred stripes of a clad facade are exactly that.
    const proud = fused.depthLayer === 'PROUD_OF_WALL' || fused.depthLayer === 'FRONT'
    const corroborated = fused.viewSupport >= 2
    const qualifies = (corroborated && proud) || (corroborated && fused.confidence >= 0.75) || (proud && fused.confidence >= 0.8)
    if (!qualifies) {
      memberRefused += 1
      if (memberRefused <= 24) {
        gap({
          what: `a linear member on the ${side.toLowerCase()} facade`,
          reason: `seen on ${fused.viewSupport} view${fused.viewSupport === 1 ? '' : 's'} at ${fused.confidence} confidence, depth ${fused.depthLayer.toLowerCase().replace(/_/g, ' ')}: not enough to say anything stands proud of the wall there`,
          status: 'AMBIGUOUS',
          observationIds: fused.observationIds,
          evidenceIds: [],
        })
      }
      continue
    }
    const a = elevationMetric(registration, fused.box.x0, fused.box.y1)
    const b = elevationMetric(registration, fused.box.x1, fused.box.y0)
    const horizontal = fused.orientation === 'HORIZONTAL'
    const length = round6(horizontal ? Math.abs(b.u - a.u) : Math.abs(b.v - a.v))
    const width = round6(horizontal ? Math.abs(b.v - a.v) : Math.abs(b.u - a.u))
    if (length < 0.8 || width < 0.08 || width > 1.2) continue
    const uStart = round6(Math.max(0, Math.min(a.u, b.u)))
    const yLow = round6(Math.min(a.v, b.v))
    const yHigh = round6(Math.max(a.v, b.v))
    const storeyIndex = storeyOrder[0]
    const host = facadeAt(side, horizontal ? uStart + length / 2 : uStart + width / 2, storeyIndex)
    if (!host) {
      memberRefused += 1
      continue
    }
    const id = `solid-${memberCount}`
    const depth = round6(Math.min(0.45, Math.max(0.12, width)))
    const hb = ringBounds(host.mass.ring)
    const { start, end } = memberEnds(side, hb, thicknessQ.value, host.offset - (horizontal ? length / 2 : width / 2), length, horizontal, yLow, yHigh, width)
    program.push({ type: 'createLinearSolid', id, levelId: levelIdOf.get(storeyIndex) ?? 'lvl-0', hostId: host.wallId, start, end, width, depth, materialId: MATERIALS.member })
    const hypothesisId = `hyp-${id}`
    hypotheses.push({
      id: hypothesisId,
      kind: 'LINEAR_SOLID',
      parentId: `hyp-ring-${host.mass.id}-${storeyIndex}`,
      parameters: [
        { name: 'length', value: length, low: round6(length * 0.92), high: round6(length * 1.08), unit: 'm', basis: 'SCALED', evidenceIds: [], why: `${round6(fused.box.x1 - fused.box.x0)} px on a facade registered at ${registration.metresPerPixelU} m/px` },
        { name: 'width', value: width, low: round6(width * 0.85), high: round6(width * 1.15), unit: 'm', basis: 'SCALED', evidenceIds: [], why: 'the member as it is seen in elevation' },
        { name: 'depth', value: depth, low: 0.1, high: 0.5, unit: 'm', basis: 'ASSUMED', evidenceIds: [], why: `${fused.viewSupport} views and a ${fused.depthLayer.toLowerCase().replace(/_/g, ' ')} depth cue say it stands proud, but nothing measures how far` },
      ],
      sightings: fused.members.map((m) => ({ frameId: m.frameId, box: m.box, observationIds: m.observationIds, confidence: m.confidence, depthLayer: m.depthLayer })),
      rivalIds: [],
      observationIds: fused.observationIds,
      evidenceIds: [],
      viewSupport: fused.viewSupport,
      confidence: fused.confidence,
      provenance: { rule: 'linear-solid-from-corroborated-depth', detail: fused.trace.join('; '), merged: fused.members.length },
    })
    traces.push({ objectId: id, kind: 'linearSolid', hypothesisId, evidenceIds: [], observationIds: fused.observationIds, rejected: [], why: `${length} m long, ${width} m in elevation, standing ${depth} m proud of the ${side.toLowerCase()} wall of ${host.mass.id}; ${fused.trace.join('; ')}` })
    gap({ what: `how far the ${side.toLowerCase()} facade member ${id} stands proud of the wall`, placeholderId: id, reason: 'no view measures the projection; the member is built square in section and the depth is unresolved', status: 'AMBIGUOUS', observationIds: fused.observationIds, evidenceIds: [] })
    memberCount += 1
  }
  step({ stage: 'facade', what: 'linear solids from corroborated depth cues', method: 'DISCRETE_SELECTION', detail: `${memberFusion.counts.rawCandidates} sightings -> ${memberCount} solids; ${memberRefused} refused for want of depth evidence`, inputs: memberFusion.counts.rawCandidates, outputs: memberCount })

  // -------------------------------------------------------------------------
  // the stair: refused rather than invented
  // -------------------------------------------------------------------------
  const stairObservations = graph.observations.filter((o) => o.kind === 'STAIR' || o.kind === 'STAIR_SYMBOL')
  if (storeyIndices.length > 1) {
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
      { name: 'reconstruction.structural-layout', version: SOLVER_VERSION },
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
      schemaVersion: CANDIDATE_SCHEMA_VERSION,
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
      structuralLayoutId: layout.id,
      structuralLayoutHash: layout.contentHash,
      structuralStatus: layout.gate.status,
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

  return { layout, hypotheses: hypothesisSet, candidate, model }
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
  bounds: { x0: number; z0: number; x1: number; z1: number },
  thickness: number,
  uStart: number,
  length: number,
  horizontal: boolean,
  yLow: number,
  yHigh: number,
  width: number,
): { start: { x: number; y: number; z: number }; end: { x: number; y: number; z: number } } {
  // The member sits on the OUTER face of its wall, standing proud of it.
  // `uStart` is measured along that wall from the corner the ring starts at,
  // so each side maps it straight onto the axis its wall runs along.
  const outer = thickness / 2
  const y = horizontal ? round6((yLow + yHigh) / 2) : 0
  const mid = uStart + width / 2
  if (side === 'FRONT') {
    // w2 runs from (x1, z1) to (x0, z1): u increases as x falls.
    const z = round6(bounds.z1 + outer)
    return horizontal
      ? { start: { x: round6(bounds.x1 - uStart), y, z }, end: { x: round6(bounds.x1 - uStart - length), y, z } }
      : { start: { x: round6(bounds.x1 - mid), y: yLow, z }, end: { x: round6(bounds.x1 - mid), y: yHigh, z } }
  }
  if (side === 'REAR') {
    // w0 runs from (x0, z0) to (x1, z0): u increases with x.
    const z = round6(bounds.z0 - outer)
    return horizontal
      ? { start: { x: round6(bounds.x0 + uStart), y, z }, end: { x: round6(bounds.x0 + uStart + length), y, z } }
      : { start: { x: round6(bounds.x0 + mid), y: yLow, z }, end: { x: round6(bounds.x0 + mid), y: yHigh, z } }
  }
  if (side === 'RIGHT') {
    // w1 runs from (x1, z0) to (x1, z1): u increases with z.
    const x = round6(bounds.x1 + outer)
    return horizontal
      ? { start: { x, y, z: round6(bounds.z0 + uStart) }, end: { x, y, z: round6(bounds.z0 + uStart + length) } }
      : { start: { x, y: yLow, z: round6(bounds.z0 + mid) }, end: { x, y: yHigh, z: round6(bounds.z0 + mid) } }
  }
  // w3 runs from (x0, z1) to (x0, z0): u increases as z falls.
  const x = round6(bounds.x0 - outer)
  return horizontal
    ? { start: { x, y, z: round6(bounds.z1 - uStart) }, end: { x, y, z: round6(bounds.z1 - uStart - length) } }
    : { start: { x, y: yLow, z: round6(bounds.z1 - mid) }, end: { x, y: yHigh, z: round6(bounds.z1 - mid) } }
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
