/**
 * The v2 analyzer, end to end (§11 passes A–N).
 *
 *  A  acquisition is upstream (the SourcePackage);          B  the atlas is the graph's frames;
 *  C  view registration: plans by chains / outer faces, renders by ridge datum, the section by its walls;
 *  D  observations: the graph plus the v2 raster readers;    E  metric evidence: the metric set plus v2 measurements;
 *  F  cross-view identity: the feature graph's relations;    G  topology: masses, recesses, returns, interior, stair, roof;
 *  H  metric solve: the readers' figures against printed ones;  I  secondary assemblies: fascias, verges, portal, balconies;
 *  J  DSL emission;  K  geometry: the sealed candidate's replay;  L  source-view verification;  M  repair;  N  quality.
 *
 * Everything here is generic. It knows drawings and buildings, and no project.
 */
import { round6, stableId } from '@buildapp/source-common'
import type { SourceCoordinateFrame, SourceObservationGraph } from '@buildapp/source-observations'
import type { MetricEvidenceSet } from '@buildapp/source-metrics'
import type { Mask, Raster } from '@buildapp/source-cv'
import type { CanonicalBuildingModel } from '@buildapp/model'
import { CONVENTIONS, SOLVER_NAME, levelsFrom, registerElevationFrames } from '../solve.js'
import { composeStructuralLayout } from '../structural.js'
import type { PublishedArea } from '../layout-gate.js'
import { ringBounds } from '../structural-layout.js'
import type { StructuralLayoutHypothesisSet } from '../structural-layout.js'
import { isWallStripZone, openFacesOf } from '../layout.js'
import type { PlanReading } from '../layout.js'
import { fitOpeningsToHosts, reconcileWallOverlaps, sealCandidate } from '../candidate.js'
import { cornerPocketSpecs } from './corner-pockets.js'
import { findPosts, PERGOLA_BEAM_ASSUMED, PERGOLA_HEIGHT_ASSUMED_M, pergolaFromPosts } from './pergola.js'
import { readCornerNotch } from './corner-recess.js'
import { balconyRect, balustradePath, doorSpanCandidates, BALCONY_SLAB_ASSUMED_M, BALUSTRADE_HEIGHT_ASSUMED_M, floorLevelDoorGroups, readBalconyOutline } from './projecting-balcony.js'
import { planReconcileTolerance, refusalDiagnostics, reportWallReconciliation } from './wall-reconciliation-report.js'
import type { WallReconciliationReport } from './wall-reconciliation-report.js'
import type { OpeningFit, ReconstructionCandidate, UnresolvedCandidate, SolverStep, PrimitiveTrace } from '../candidate.js'
import { HYPOTHESIS_SET_SCHEMA, HYPOTHESIS_SET_SCHEMA_VERSION } from '../hypotheses.js'
import type { PrimitiveHypothesisSet } from '../hypotheses.js'
import { hashArtifact } from '@buildapp/source-common'
import { elevationFrameFromV2, flipZ, outerWallFaces, planFrameByOuterFaces, planFrameBySameSheet, planFrameV2, registerElevationV2, worldFrameFrom } from './frame.js'
import type { ElevationFrameV2, ElevationRegistrationV2, PlanFrameV2, WorldFrameV2 } from './frame.js'
import { scanZoneForReturns } from './recesses.js'
import type { RecessTopology, ZoneSide } from './recesses.js'
import { readInterior } from './interior.js'
import type { InteriorReading, LabelToken } from './interior.js'
import { assembleStair, findTreadLadders, poolLadders } from './stair-topology.js'
import { FIRM_CALLOUT_CONFIDENCE, GARAGE_LABEL, commonHeadReading, cornerAssemblies, openCornerBand, elevationExtent, garageMouth, planGaps, readWallOpenings, viewGroundRefusals, wallAppearanceExtent } from './openings-v2.js'
import { lumaOf } from './openings-v2.js'
import type { OpeningV2, WallHost } from './openings-v2.js'
import { planeRoofLayout } from './plane-roof.js'
import type { RoofEnd } from './plane-roof.js'
import { hostRoofTopAt, readAttachedRoof, readEavesOverhang, readChimneys, readPlanRooflights, readRooflights, registerSection, registerSectionByTwoAnchors, sectionStackOver, withRecognisedHalves } from './roof-details.js'
import type { PlanRooflightReading, RooflightReading, SectionFrame } from './roof-details.js'
import { readFasciaBand, readRailing, readVergeMember } from './facade.js'
import type { FacadeAssemblyHypothesis, FacadeMember } from './facade.js'
import { skyMask, solvePerspectiveCamera } from './camera.js'
import { attachedGableLayout, readAttachedRoofForm } from './attached-roof-form.js'
import { decideSideOrientation, decideSidesByOpenings, gableApexRow, gableOutline, mainTopProfile, roofTopOverBand, sameSheetSideRegistration } from './side-orientation.js'
import type { PerspectiveCameraV2 } from './camera.js'
import { emitBuilding } from './emit.js'
import { fitStairToBoundingWalls, followStairSoffits } from './stair-fit.js'
import { ReconstructionFailure, planCounts } from '../failure.js'
import type { PlanDiagnosticsReport } from '../failure.js'
import { LAYOUT_REFUSAL_CODES, dimensionEvidenceOf, layoutRefused, layoutRejectionOf, planDiagnosticsOf, planFailureOf } from '../plan-diagnostics.js'
import { PLAN_RESOLVER_VERSION, challengeFirstReading, challengeRecord, firstReadingNeedsChallenge, resolutionRecord, resolvePlan, sourceConflictReviewFor, withdrawnRecord } from '../plan-resolution.js'
import type { SourceConflictReview } from '../plan-resolution.js'
import { metricSolutionFor, readTintedCallouts } from '@buildapp/source-metrics'
import type { ResolverProgress } from '../plan-resolution.js'
import type { PlanSheet } from '../layout.js'
import type { Checkpoint } from '@buildapp/source-common'
import type { StructuralPassOptions } from '../structural.js'
import { rectAt } from './building.js'
import type { PlaneRoofV2, BuildingV2, EndCondition, MassToneV2, MassV2, PocketV2, ReturnWallV2, TerraceV2 } from './building.js'
import { buildFacadeGraph, closeBalconies, closePortalHeads, closeRailings, closeTerraces, closeVerges, alignStackedReturns, snapReturnsToBodyFaces } from './assembly-closure.js'
import type { BalconyEnd, ClosureNote } from './assembly-closure.js'
import { drawnShareOf, readTerraceExtension, terracePolygon } from './terrace.js'
import { readFinishRuns, readMassTones, readReturnTones } from './tones.js'
import { featureGraphViolations, sealFeatureGraph } from './graph.js'
import type { ArchitecturalEvidenceGraph, FeatureFamily, FeatureGraphDraft, ProvenanceStatus, SolvedFeature, SourceSighting, ViewFamily } from './graph.js'
import { ledgerViolations, sealLedger } from './ledger.js'
import type { EvidenceConsumptionLedger, EvidenceConsumptionRecord } from './ledger.js'
import { qualityLevelOf, sealQualityReport } from './quality.js'
import { createSolverRecorder, emptySolverRecord, viewFamilyOf } from './solver-recorder.js'
import { readHouseStair } from './house-stair.js'
import type { FeatureQualityReport } from './quality.js'
import { repairFromResiduals, verifyAgainstViews } from './verify.js'
import type { RepairTrace, SourceViewResidual } from './verify.js'
import { dominantTone, lumaAt, neutralBands, topNeutralInkRow } from './scan.js'
import { approximateRidgeDatum } from './roof-datum.js'
import type { ApproximateRidge } from './roof-datum.js'

// 2.2.0 (005A): a plan the first reading refuses is re-read by the plan
// resolver before the run stops (PLAN_RESOLVER_VERSION names its readings).
// Accepted houses are read exactly as before.

export const SOLVER_V2_VERSION = '2.3.0' as const

/** 005L: two pieces of one storey's footprint nearer than a room's narrowest span (`minBodySpanM`, never under 1 m) meet. */
const PIECES_MEET_M = 1
/** 005L: an outer-face plan frame refines the layout's registration only within the agreement its own two axes need. */
const PLAN_FRAME_SCALE_AGREEMENT = 0.03

export type ReconstructionV2Options = {
  label: string
  slug: string
  sourcePackageId: string
  sourcePackageHash: string
  graph: SourceObservationGraph
  metrics: MetricEvidenceSet
  raster: (frame: SourceCoordinateFrame) => Raster | undefined
  publishedAreas?: readonly PublishedArea[]
  publishedRooms?: ReadonlyArray<{ storey: string; index: number; label: string; area: number }>
  frameFilter?: (frame: SourceCoordinateFrame) => boolean
  /** Diagnostic lines from the readers, for a developer watching a run; never part of the result. */
  debug?: (message: string) => void
  /** 005Y-N1: diagnostics only (FEATURE_DEBUG): candidate features and why each was kept or dropped. Write-only: the model is the same with it and without. */
  featureTrace?: (record: Record<string, unknown>) => void
  /** The model's id; defaults to `m-auto-v2-<slug>`. Two sealed candidates of one project side by side need two. */
  modelId?: string
  /**
   * Told when the solver enters each of its phases, for a caller reporting
   * progress. The solver is synchronous; this is a notification, and nothing
   * it does can reach the result.
   */
  onPhase?: (phase: ReconstructionV2Phase) => void
  /**
   * Told what each step of the solver established, as counts: the trace a
   * failure screen and a diagnostics bundle are built from. Deterministic;
   * nothing it receives can reach the result.
   */
  trace?: (event: SolverTraceEvent) => void
  /** Told as the plan resolver weighs each reading, when it runs. Nothing it does reaches the result. */
  resolverProgress?: ResolverProgress
  /** Told inside the solver's longer loops (plan copies, perspective cameras), for progress and cancellation. Write-only. */
  checkpoint?: Checkpoint
  /** 005K, experimental: the boundary's drawn-gap rule (`PlanDecompositionOptions.drawnGapRule`). OFF unless asked for; the product never asks. */
  drawnGapRule?: 'OFF' | 'ON'
}

/** One step of the solver, as the service's trace records it. */
export type SolverTraceEvent = {
  phase: ReconstructionV2Phase
  substage: string
  status: 'PASSED' | 'DEGRADED' | 'FAILED'
  counts: Record<string, number | string | boolean>
  reasonCode?: string
  detail?: string
}

/** The solver's phases, in the order it runs them. */
export type ReconstructionV2Phase = 'REGISTRATION' | 'TOPOLOGY' | 'METRICS' | 'MODEL'

export type ReconstructionV2Result = {
  layout: StructuralLayoutHypothesisSet
  building: BuildingV2
  candidate: ReconstructionCandidate
  model: CanonicalBuildingModel
  hypotheses: PrimitiveHypothesisSet
  featureGraph: ArchitecturalEvidenceGraph
  ledger: EvidenceConsumptionLedger
  quality: FeatureQualityReport
  residuals: SourceViewResidual[]
  repair: RepairTrace
  registrations: { plans: PlanFrameV2[]; elevations: ElevationRegistrationV2[]; section?: { frameId: string; mpp: number; originCol: number; zeroRow: number }; cameras: Array<{ frameId: string; solved: boolean; residualPx?: number; why: string; camera?: PerspectiveCameraV2 }> }
  world: WorldFrameV2
  steps: SolverStep[]
  unresolved: UnresolvedCandidate[]
  violations: { graph: string[]; ledger: string[] }
  /** Every decision the assembly closure took, with its reason. */
  closure: ClosureNote[]
  /** The plan decomposition, in the plans' own pixels: what the overlays and a diagnostics bundle are drawn from. */
  planDiagnostics: PlanDiagnosticsReport
  /** Every opening the model could not take as the drawings print it: shrunk, lowered, or not built, with why. */
  openingFits: OpeningFit[]
  /** 005T-N3: the main roof's ridge was not printed and was taken approximately (`roof-datum.ts`); absent otherwise. */
  roofDatum?: ApproximateRidge
  /** 005Y-N7 (A): walls the model refused as overlapping and what was done; absent when none overlapped. */
  wallReconciliation?: WallReconciliationReport
}


/** 005Y: the roof's details (rooflights on the renders, eaves on the section), as the progress shows them. */
const ROOF_DETAILS_SUBPHASE = { id: 'ROOF_DETAILS', label: 'reading the roof details' }
/** 005Y: an elevation whose registered ground lands farther than this from the terrain does not decide a roof's ends. */
const ROOF_END_VIEW_MAX_GROUND_ERROR_M = 0.3
/** 005Y: how far an end's outline may stray from a hip's line (as a share of its rise to the ridge, and of the pitch's slope) to be read as one. */
const ROOF_END_SLOPE_TOLERANCE = 0.15

export function reconstructV2(options: ReconstructionV2Options): ReconstructionV2Result {
  const { graph } = options
  // Replaced only when the plan resolver re-read the base plan at another scale (005A).
  let metrics = options.metrics
  options.onPhase?.('REGISTRATION')
  const keep = options.frameFilter
  const ctx = emptySolverRecord()
  const recorder = createSolverRecorder(ctx)
  const { step, gap, record, sighting, feature, relate } = recorder
  const frameById = new Map(graph.coordinateFrames.map((f) => [f.id, f]))


  // ---------------------------------------------------------------------------
  // A/B/C. composition (03R), world frame, registrations
  // ---------------------------------------------------------------------------
  const sectionFrame = graph.coordinateFrames.find((f) => f.roles.projection === 'ORTHOGRAPHIC_SECTION' && (keep ? keep(f) : true))
  const levels = levelsFrom(metrics, sectionFrame?.id)
  const structuralOptions: StructuralPassOptions = { slug: options.slug, sourcePackageId: options.sourcePackageId, sourcePackageHash: options.sourcePackageHash, graph, metrics, raster: options.raster, frameFilter: keep, levels, publishedAreas: options.publishedAreas, sheetCache: new Map<string, PlanSheet>(), ...(options.checkpoint ? { checkpoint: options.checkpoint } : {}), ...(options.drawnGapRule === 'ON' ? { drawnGapRule: 'ON' as const } : {}), ...(options.debug ? { debug: options.debug } : {}) }
  const incumbent = composeStructuralLayout(structuralOptions)
  let { draft, layout } = incumbent
  let planDiagnostics: PlanDiagnosticsReport = planDiagnosticsOf(draft, graph, metrics, layout)
  const trace = (event: SolverTraceEvent): void => options.trace?.(event)
  trace({ phase: 'REGISTRATION', substage: 'PLAN_READ', status: draft.plans.length > 0 ? 'PASSED' : 'FAILED', counts: { planFrames: planDiagnostics.planFrames, plansRead: draft.plans.length, plansSkipped: draft.skippedPlans.length, ...(planDiagnostics.selectedPlanFrameId ? { selectedPlanFrameId: planDiagnostics.selectedPlanFrameId } : {}) } })
  // --- 005B: a run that stops on a scale nothing independent supports says so -----
  // When the base plan's scale rests on no printed dimension read as printed, the
  // plan failure is a consequence and the missing metric truth is the cause.
  const metricStop = (failure: ReconstructionFailure): ReconstructionFailure => {
    const frameId = failure.plans?.selectedPlanFrameId ?? planDiagnostics.selectedPlanFrameId ?? draft.base?.frame.id
    const solution = frameId ? metricSolutionFor(metrics, frameId) : undefined
    if (!solution || solution.confidence !== 'INCONCLUSIVE') return failure
    const top = solution.hypotheses.slice(0, 3).map((h) => `${h.cmPerPixel} cm/px (${h.independentGroups} independent, ${h.plausible ? 'plausible' : 'ruled out by the walls'})`)
    // 005F: a plan that prints dimensions and a plan that prints none are different refusals (typed, and said so).
    const evidence = frameId !== undefined ? dimensionEvidenceOf(metrics, frameId) : { kind: 'NO_DIMENSION_EVIDENCE' as const, labels: 0, lines: 0 }
    const missing =
      evidence.kind === 'NO_DIMENSION_EVIDENCE'
        ? 'a dimension printed on the floor plan itself — it prints none'
        : `a reading of the printed dimensions that settles one scale — ${evidence.labels} dimension label${evidence.labels === 1 ? ' was' : 's were'} found on ${evidence.lines} dimension line${evidence.lines === 1 ? '' : 's'}, and as read they do not: an overall dimension read unambiguously, or two readings on different chains that agree`
    const message = `the floor plan's scale cannot be established: ${solution.why}. ${top.length > 0 ? `The scales its readings state are ${top.join('; ')}` : 'None of its readings states a scale'}; ${solution.conflictingObservationIds.length} printed reading${solution.conflictingObservationIds.length === 1 ? '' : 's'} contradict the one it was read at. What is missing: ${missing}. (${failure.message})`
    return new ReconstructionFailure('METRIC_RESOLUTION_INCONCLUSIVE', 'REGISTRATION', message, { ...(failure.diagnostics ?? {}), firstFailure: failure.code, dimensionEvidence: evidence.kind, dimensionLabels: evidence.labels, dimensionLines: evidence.lines, metricRelation: solution.relation, metricConfidence: solution.confidence, scaleHypotheses: solution.hypotheses.length, independentWitnesses: solution.independentWitnesses, conflictingReadings: solution.conflictingObservationIds.length, ...(solution.legacy.cmPerPixel !== undefined ? { legacyCmPerPx: solution.legacy.cmPerPixel } : {}), ...(top.length > 0 ? { topScales: top.join(' | ') } : {}) }, 'METRIC_RESOLUTION', failure.plans ?? planDiagnostics)
  }

  // --- 005C: a run that stops where the plan's outline itself is in question says so -----
  // Both jamb policies adopted an outline and they disagree by more than the AGREES band: the stop
  // names both and their support rather than the consequence either one led to. A scale nothing
  // supports is the deeper cause and keeps its own stop.
  const boundaryRecord = draft.base?.decomposition.boundary
  const boundaryStop = (failure: ReconstructionFailure): ReconstructionFailure => {
    const policies = boundaryRecord?.policies
    if (!policies?.disagree || failure.code === 'METRIC_RESOLUTION_INCONCLUSIVE') return failure
    const describe = (id: string, p: typeof policies.strict): string => `${id} ${p.areaM2.toFixed(1)} m² (perimeter ${p.support.perimeterM.toFixed(1)} m: ${Math.round((p.support.wallM / Math.max(1e-9, p.support.perimeterM)) * 100)}% wall, ${p.support.strongOpeningM.toFixed(1)} m drawn openings, ${p.support.weakOpeningM.toFixed(1)} m blank gaps bridged, ${p.support.unsupportedM.toFixed(1)} m unsupported)`
    const message = `the building's outline cannot be established: read with drawn openings only it is ${describe('B_STRICT', policies.strict)}; bridging blank door-sized gaps by what lies behind them it is ${describe('B_EXCLUSION', policies.exclusion)}. The two differ by more than 6 %, and nothing in the drawing prefers one. What is missing: a door or glazing drawn across the blank gaps, or a dimension chain that closes the outline. (${failure.message})`
    return new ReconstructionFailure('BOUNDARY_RESOLUTION_INCONCLUSIVE', 'REGISTRATION', message, { ...(failure.diagnostics ?? {}), firstFailure: failure.code, strictAreaM2: policies.strict.areaM2, exclusionAreaM2: policies.exclusion.areaM2, strictUnsupportedM: policies.strict.support.unsupportedM, exclusionUnsupportedM: policies.exclusion.support.unsupportedM, candidates: 'B_STRICT|B_EXCLUSION' }, 'BOUNDARY_RESOLUTION', failure.plans ?? planDiagnostics)
  }

  // --- 005A: when the first reading of the plan stops, weigh the others -------
  // A first reading that holds keeps the fast path only when its metric truth is
  // independently supported (005B, below): every house read on such evidence is
  // read the same way, byte for byte.
  // --- 005D (resolver 1.4.0): the drawing speaks before the published figure -----------------
  // A first reading that built a body and was refused only because it misses the published footprint is
  // first asked whether the drawing itself contradicts its scale (a source conflict, decided without the
  // figure). If it does, the readings the drawing states are weighed with the figure as verifier only:
  // replaced, refused by name (SOURCE_CONFLICT), or — when none is better supported by the drawing — left
  // to the path below, where the figure that refused it is spent.
  const footprintOnly = !!worldFrameFrom(draft) && layout.masses.length > 0 && layoutRefused(layout) && layout.gate.reasons.filter((g) => g.severity === 'BLOCKING' && LAYOUT_REFUSAL_CODES.has(g.code)).every((g) => g.code.startsWith('FOOTPRINT_AREA'))
  // 1.5.0: an accusation the doubt policy withdrew (statements it turned on are contested by their own readers) is
  // recorded — in the trace, and as an AMBIGUOUS gap the result carries — and decides nothing.
  const noteWithdrawn = (review: SourceConflictReview | null): void => {
    const w = review?.withdrawn
    if (!review || !w) return
    const record = withdrawnRecord(review)
    trace({ phase: 'REGISTRATION', substage: 'SOURCE_CONFLICT_REVIEW', status: 'PASSED', counts: record, detail: `an accusation of the registered scale was withdrawn because statements it turned on are contested by their own readers (${w.why})` })
    gap({
      what: 'the scale of the base plan (an accusation withdrawn)',
      reason: `the drawing's readings as printed would accuse the registered scale (${w.why}); the statements that accusation turned on are contested by their own readers (${String(record.doubted) || 'none named'}), and plan resolver ${PLAN_RESOLVER_VERSION} does not let a reading in doubt accuse: these statements neither accuse the registered scale nor confirm it`,
      status: 'AMBIGUOUS',
      observationIds: [],
      evidenceIds: [...new Set([...w.evidenceIds, ...w.doubted.map((d) => d.evidenceId)])].sort(),
    })
  }
  const earlyReview = footprintOnly ? sourceConflictReviewFor(structuralOptions, incumbent) : null
  noteWithdrawn(earlyReview)
  const earlyConflict = earlyReview?.conflict ?? null
  if (earlyConflict) {
    const outcome = challengeFirstReading(structuralOptions, incumbent, options.resolverProgress, { conflict: earlyConflict, footprintRefused: true })
    const record = challengeRecord(outcome, `the published footprint refused the first reading, and the drawing contradicts its scale: ${earlyConflict.why}`)
    if (outcome.kind === 'REPLACED') {
      draft = outcome.result.draft
      layout = outcome.result.layout
      metrics = outcome.metrics
      planDiagnostics = { ...planDiagnosticsOf(draft, graph, metrics, layout), challenge: record }
      trace({ phase: 'REGISTRATION', substage: 'METRIC_CHALLENGE', status: 'DEGRADED', counts: record, detail: outcome.why })
    } else if (outcome.kind === 'REFUSED') {
      const report = { ...planDiagnostics, challenge: record }
      const failure = new ReconstructionFailure('PLAN_RESOLUTION_INCONCLUSIVE', 'REGISTRATION', outcome.why, { ...planCounts(report), firstReading: 'FOOTPRINT_AREA_WRONG', why: 'SOURCE_CONFLICT', ...outcome.diagnostics }, 'PLAN_RESOLUTION', report)
      trace({ phase: 'REGISTRATION', substage: 'METRIC_CHALLENGE', status: 'FAILED', counts: record, reasonCode: failure.code, detail: outcome.why })
      throw metricStop(failure)
    } else {
      planDiagnostics = { ...planDiagnostics, challenge: record }
      trace({ phase: 'REGISTRATION', substage: 'METRIC_CHALLENGE', status: 'PASSED', counts: record, detail: outcome.why })
    }
  }
  if (!worldFrameFrom(draft) || layout.masses.length === 0 || layoutRefused(layout)) {
    const first = !worldFrameFrom(draft) || layout.masses.length === 0 ? planFailureOf(draft, layout, planDiagnostics) : layoutRejectionOf(layout, planDiagnostics)
    const resolution = resolvePlan(structuralOptions, incumbent, options.resolverProgress)
    const record: Record<string, number | string | boolean> = { ...resolutionRecord(resolution), firstReading: first.code }
    if (resolution.kind === 'RESOLVED') {
      draft = resolution.result.draft
      layout = resolution.result.layout
      metrics = resolution.metrics
      planDiagnostics = { ...planDiagnosticsOf(draft, graph, metrics, layout), resolution: record }
      trace({ phase: 'REGISTRATION', substage: 'PLAN_RESOLUTION', status: 'DEGRADED', counts: record, detail: `the first reading stopped with ${first.code}; ${String(record.chosen)}` })
    } else if (resolution.kind === 'INCONCLUSIVE' && resolution.why === 'NONE_HOLDS' && resolution.counts.compositions === 0) {
      // No other reading got as far as a whole composition: the first reading's own
      // missing link is still the best account of what stopped the run.
      const report = { ...planDiagnostics, resolution: record }
      const failure = new ReconstructionFailure(first.code, first.phase, `${first.message}; ${resolution.message}`, { ...first.diagnostics, readingsWeighed: resolution.counts.readings, distinctOutlines: resolution.counts.distinctOutlines, ...(resolution.diagnostics.bestReading !== undefined ? { bestReading: resolution.diagnostics.bestReading } : {}) }, first.substage, report)
      trace({ phase: 'REGISTRATION', substage: 'PLAN_RESOLUTION', status: 'FAILED', counts: record, reasonCode: failure.code, detail: resolution.message })
      throw boundaryStop(metricStop(failure))
    } else if (resolution.kind === 'INCONCLUSIVE') {
      const report = { ...planDiagnostics, resolution: record }
      const failure = new ReconstructionFailure('PLAN_RESOLUTION_INCONCLUSIVE', 'REGISTRATION', `${first.message} ${resolution.message}`, { ...planCounts(report), firstReading: first.code, ...resolution.diagnostics }, 'PLAN_RESOLUTION', report)
      trace({ phase: 'REGISTRATION', substage: 'PLAN_RESOLUTION', status: 'FAILED', counts: record, reasonCode: failure.code, detail: resolution.message })
      throw boundaryStop(metricStop(failure))
    } else {
      // Nothing but the first reading could be generated: its own failure stands.
      planDiagnostics = { ...planDiagnostics, resolution: record }
      trace({ phase: 'REGISTRATION', substage: 'PLAN_RESOLUTION', status: 'FAILED', counts: record, reasonCode: first.code, detail: 'no other reading of the plan could be generated' })
    }
  } else {
    // --- 005B: a first reading that completed on weak metric evidence is weighed --------
    // 005D: so is one whose scale the drawing itself contradicts (a source conflict), whatever its confidence.
    // A reading that already answered the drawing's own challenge above is not challenged a second time.
    const need = earlyConflict ? { challenge: false, why: '' } : firstReadingNeedsChallenge(metrics, incumbent)
    const lateReview = earlyConflict ? null : sourceConflictReviewFor(structuralOptions, incumbent)
    noteWithdrawn(lateReview)
    const conflict = lateReview?.conflict ?? null
    if (need.challenge || conflict) {
      const why = [need.challenge ? need.why : '', conflict ? `the drawing contradicts its scale: ${conflict.why}` : ''].filter(Boolean).join('; and ')
      const outcome = challengeFirstReading(structuralOptions, incumbent, options.resolverProgress, { conflict })
      const record = challengeRecord(outcome, why)
      if (outcome.kind === 'REFUSED') {
        const report = { ...planDiagnostics, challenge: record }
        const failure = new ReconstructionFailure('PLAN_RESOLUTION_INCONCLUSIVE', 'REGISTRATION', outcome.why, { ...planCounts(report), why: 'SOURCE_CONFLICT', ...outcome.diagnostics }, 'PLAN_RESOLUTION', report)
        trace({ phase: 'REGISTRATION', substage: 'METRIC_CHALLENGE', status: 'FAILED', counts: record, reasonCode: failure.code, detail: outcome.why })
        throw metricStop(failure)
      }
      if (outcome.kind === 'REPLACED') {
        draft = outcome.result.draft
        layout = outcome.result.layout
        metrics = outcome.metrics
      }
      planDiagnostics = { ...planDiagnosticsOf(draft, graph, metrics, layout), challenge: record }
      trace({ phase: 'REGISTRATION', substage: 'METRIC_CHALLENGE', status: outcome.kind === 'REPLACED' ? 'DEGRADED' : 'PASSED', counts: record, detail: `${why}; ${outcome.why}` })
      // A pass on a scale the drawing contradicted, kept because nothing it states is better supported, is never silent.
      if (outcome.kind === 'KEPT' && conflict) gap({ what: `the scale of the base plan`, reason: `the drawing contradicts the scale it was read at (${conflict.why}); no reading it states is better supported, so the first reading stands`, status: 'AMBIGUOUS', observationIds: [], evidenceIds: conflict.evidenceIds })
    }
  }
  const planCountsNow = planCounts(planDiagnostics)
  const world = worldFrameFrom(draft)
  if (!world || layout.masses.length === 0) {
    const failure = planFailureOf(draft, layout, planDiagnostics)
    trace({ phase: 'REGISTRATION', substage: failure.substage ?? 'PLAN_DECOMPOSITION', status: 'FAILED', counts: planCountsNow, reasonCode: failure.code, detail: failure.message })
    throw boundaryStop(metricStop(failure))
  }
  trace({ phase: 'REGISTRATION', substage: 'PLAN_DECOMPOSITION', status: 'PASSED', counts: planCountsNow })
  // The gate's verdict is part of what is sealed, and a BLOCKING one says the
  // reading is not of this building. Building it anyway only moves the
  // failure downstream, where it surfaces as a model the drawings never
  // described; stopping here names what is wrong.
  if (layoutRefused(layout)) {
    const failure = layoutRejectionOf(layout, planDiagnostics)
    trace({ phase: 'REGISTRATION', substage: 'STRUCTURAL_LAYOUT', status: 'FAILED', counts: { ...planCountsNow, gate: layout.gate.status }, reasonCode: failure.code, detail: failure.message })
    throw boundaryStop(metricStop(failure))
  }
  trace({ phase: 'REGISTRATION', substage: 'STRUCTURAL_LAYOUT', status: layout.gate.status === 'STRUCTURAL_LAYOUT_ACCEPTED' ? 'PASSED' : 'DEGRADED', counts: { masses: layout.masses.length, recesses: layout.recesses.length, roofs: layout.roofSupports.length, gate: layout.gate.status, gateReasons: layout.gate.reasons.filter((r) => r.severity !== 'NOTED').map((r) => `${r.severity}:${r.code}`).join(',') } })
  step({ stage: 'massing', what: 'the bodies the plans enclose, in the v2 frame', method: 'DISCRETE_SELECTION', detail: `${layout.masses.length} bodies; front outer plane at z = 0 (${world.why})`, inputs: draft.plans.length, outputs: layout.masses.length })
  for (const hole of layout.unresolved) gap({ what: hole.what, reason: hole.reason, status: hole.status === 'REFUSED' ? 'REFUSED' : hole.status, observationIds: [], evidenceIds: [] })

  const T = draft.base?.decomposition.wallThickness.m && draft.base.decomposition.wallThickness.m >= 0.15 && draft.base.decomposition.wallThickness.m <= 0.7 ? round6(draft.base.decomposition.wallThickness.m) : CONVENTIONS.wallThickness
  const slabT = levels.measured && levels.floors.length > 1 ? round6(Math.min(0.4, Math.max(0.2, levels.floors[1] - levels.floors[0] - 2.72))) : CONVENTIONS.slabThickness

  // Masses in the v2 frame.
  const v2Rect = (r: { x0: number; z0: number; x1: number; z1: number }): { x0: number; z0: number; x1: number; z1: number } => ({ x0: round6(r.x0), z0: round6(flipZ(world, r.z1)), x1: round6(r.x1), z1: round6(flipZ(world, r.z0)) })
  const pieces: MassV2[] = []
  const masses: MassV2[] = layout.masses.map((m) => {
    const b = ringBounds(m.ring)
    const z0 = flipZ(world, b.z1)
    const z1 = flipZ(world, b.z0)
    const id = m.role === 'MAIN' ? 'main' : `attached-${layout.masses.filter((x) => x.role !== 'MAIN').indexOf(m)}`
    const storeys: number[] = []
    for (let s = m.storeySpan.fromIndex; s <= m.storeySpan.toIndex; s += 1) storeys.push(s)
    // 005Q (N1): a body cut on a wall's inner face (the layout names the face it leaves open) is not SOURCE_EXACT
    const facesOpen = openFacesOf(m, layout.unresolved).map((g) => g.what)
    const exact = m.widthM.basis === 'MEASURED' && facesOpen.length === 0
    const featureId = feature('MASS', id, { width: { value: b.x1 - b.x0, low: m.widthM.low, high: m.widthM.high }, depth: { value: z1 - z0, low: m.depthM.low, high: m.depthM.high } }, [], exact ? 'SOURCE_EXACT' : 'SOURCE_DERIVED', m.why, { printed: exact, uncertaintyM: 0.02 })
    for (const e of m.evidenceIds) record({ evidenceId: e, evidenceKind: 'METRIC', what: 'a chain segment of the body', authority: 'HIGH', featureId, disposition: 'USED_IN_MODEL', reason: facesOpen.length > 0 ? `the body’s span, which ends on a wall’s inner face (unresolved: ${facesOpen.join('; ')})` : 'the body’s span', stage: 'TOPOLOGY' })
    // 005L: each storey's own footprint over this body, from the support relation: where the storey's walled region
    // stands on only part of the body, its walls are built there and not copied from the storey below. A storey whose
    // footprint over the body is in more than one piece keeps the largest as its own and builds each other piece as a
    // body of its own on that storey.
    const storeyRects: NonNullable<MassV2['storeyRects']> = []
    // the storey the body's own ring was measured on: its rectangle is the body (council A5L-4, B5L-6 — a storey below
    // it, a basement, keeps a footprint of its own like any other)
    const measuredOn = layout.footprintRegions.find((r) => r.id === m.footprintRegionIds[0])?.storeyId
    for (const s of storeys) {
      const storeyId = layout.storeys.find((x) => x.index === s)?.id
      const own = layout.footprintRegions.filter((r) => r.kind === 'BUILT' && r.storeyId === storeyId && m.footprintRegionIds.includes(r.id))
      if (storeyId === measuredOn || own.length === 0) continue
      const rects = own.map((r) => v2Rect(ringBounds(r.ring)))
      const first = rects[0]
      if (Math.abs(first.x0 - b.x0) > 1e-6 || Math.abs(first.x1 - b.x1) > 1e-6 || Math.abs(first.z0 - z0) > 1e-6 || Math.abs(first.z1 - z1) > 1e-6) storeyRects.push({ storey: s, ...first })
      // A piece that meets another of the same storey's pieces — an L, a T — is one space with it, and this emitter
      // builds rectangles with walls all round: two of them would put a wall the plan does not draw across the room,
      // with a door cut through it (council B5L-5). The largest is built and a meeting piece is named, not invented.
      const meets = (p: { x0: number; z0: number; x1: number; z1: number }, q: { x0: number; z0: number; x1: number; z1: number }): boolean => {
        const gapX = Math.max(p.x0 - q.x1, q.x0 - p.x1)
        const gapZ = Math.max(p.z0 - q.z1, q.z0 - p.z1)
        return (gapX < PIECES_MEET_M && gapZ < 0) || (gapZ < PIECES_MEET_M && gapX < 0)
      }
      const apart: typeof rects = []
      for (const r of rects.slice(1)) {
        if ([first, ...apart].some((q) => meets(r, q))) {
          gap({ what: `the part of storey ${s}'s footprint over ${id} at x ${r.x0.toFixed(2)}–${r.x1.toFixed(2)}, z ${r.z0.toFixed(2)}–${r.z1.toFixed(2)}`, reason: 'the storey stands on this body in more than one rectangle and they meet: it is one space of another shape, which is built here as its largest rectangle only', status: 'AMBIGUOUS', observationIds: [], evidenceIds: [] })
          continue
        }
        apart.push(r)
      }
      apart.forEach((r, k) => {
        const pid = `${id}-s${s}-${k + 1}`
        const pf = feature('MASS', pid, { width: { value: r.x1 - r.x0, low: r.x1 - r.x0 - 0.05, high: r.x1 - r.x0 + 0.05 }, depth: { value: r.z1 - r.z0, low: r.z1 - r.z0 - 0.05, high: r.z1 - r.z0 + 0.05 } }, [], 'SOURCE_DERIVED', `a separate piece of storey ${s}'s footprint over ${id}, from its own walled region on that storey's plan`, { uncertaintyM: 0.1 })
        pieces.push({ id: pid, role: 'ATTACHED', ...r, storeys: [s], featureId: pf, sourceMassId: m.id, pieceOf: id })
      })
    }
    return { id, role: m.role === 'MAIN' ? 'MAIN' : 'ATTACHED', x0: round6(b.x0), z0: round6(z0), x1: round6(b.x1), z1: round6(z1), storeys, featureId, sourceMassId: m.id, ...(storeyRects.length > 0 ? { storeyRects } : {}), ...(facesOpen.length > 0 ? { outerFacesOpen: facesOpen } : {}) }
  })
  masses.push(...pieces)
  const main = masses.find((m) => m.role === 'MAIN') ?? masses[0]
  const topStorey = Math.max(...main.storeys)

  // Levels.
  const ridgeY = levels.topDatum
  const levelsV2: BuildingV2['levels'] = []
  // 005L (council B5L-6): a storey's datum is found by its index from the ground floor's, not by its place in the
  // main body's list — a basement below the ground floor is not the ground floor's datum — and the levels are every
  // body's storeys, not the main body's alone: a basement under the garage is a level too.
  const groundAt = Math.max(0, levels.floors.findIndex((v) => Math.abs(v) < 0.05))
  const datumOf = (s: number): number => {
    const k = groundAt + s
    if (k >= 0 && k < levels.floors.length) return levels.floors[k]
    if (k < 0) return round6((levels.floors[0] ?? 0) - CONVENTIONS.storeyHeight * -k)
    return round6((levels.floors[levels.floors.length - 1] ?? 0) + CONVENTIONS.storeyHeight * (k - levels.floors.length + 1))
  }
  // 005T-N3: without a printed ridge, a gable the page specifies may take an approximate ridge from its printed knee
  // wall and pitch, checked against the published building height (`roof-datum.ts`). It feeds the roof and the top
  // storey only; the elevations stay registered on printed datums alone.
  const mainSupport = layout.roofSupports.find((r) => r.massId === main.sourceMassId)
  const approximateRidge = approximateRidgeDatum({
    printedRidgeY: ridgeY,
    roof: mainSupport ? { kind: mainSupport.kind, pitchDeg: mainSupport.pitchDeg?.value, pitchAuthority: mainSupport.authority, ridgeAxis: mainSupport.ridgeAxis } : undefined,
    body: main,
    topFloorY: datumOf(topStorey),
    topFloorPrinted: levels.measured && groundAt + topStorey < levels.floors.length,
    metrics,
    publishedFacts: options.publishedAreas ?? [],
    printedTerrainY: metrics.evidence.filter((e) => e.kind === 'LEVEL_DATUM' && e.value < 0 && e.value > -1.5).sort((a, b) => b.confidence - a.confidence)[0]?.value,
  })
  const roofDatum = approximateRidge.ok ? approximateRidge.datum : undefined
  const roofRidgeY = ridgeY ?? roofDatum?.ridgeY
  if (roofDatum) {
    gap({ what: 'the ridge height of the main roof', reason: `not printed: ${roofDatum.why}`, status: 'AMBIGUOUS', observationIds: [], evidenceIds: roofDatum.evidenceIds })
    step({ stage: 'roof', what: 'an approximate ridge datum from the knee wall, the pitch and the span', method: 'DIRECT', detail: roofDatum.why, inputs: roofDatum.evidenceIds.length + 1, outputs: 1 })
  }
  const levelStoreys = [...new Set(masses.flatMap((m) => m.storeys))].sort((a, b) => a - b)
  levelStoreys.forEach((index, i) => {
    const elevation = datumOf(index)
    // A storey's walls stop at the floor of the storey above. A section that prints one floor, the eaves and the
    // ridge states the TOP storey's wall height; when the plans show a storey over that floor, the eaves are that
    // storey's, and the one below it rises only to where the storey above begins.
    const above = i + 1 < levelStoreys.length ? datumOf(levelStoreys[i + 1]) : undefined
    const printed = levels.heights[groundAt + index] ?? CONVENTIONS.storeyHeight
    const stated = above !== undefined && printed > above - elevation + 1e-6 ? round6(above - elevation) : printed
    const pitched = layout.roofSupports.some((r) => r.massId === main.sourceMassId && r.kind !== 'FLAT' && r.kind !== 'UNKNOWN')
    const height = index === topStorey && pitched && roofRidgeY !== undefined && roofRidgeY > elevation + stated ? round6(roofRidgeY - elevation) : round6(stated)
    const featureId = feature('LEVEL', `level-${index}`, { elevation: { value: elevation, low: elevation - 0.02, high: elevation + 0.02 }, height: { value: stated, low: stated - 0.05, high: stated + 0.05 } }, sectionFrame ? [sighting(sectionFrame, `level datum of storey ${index}`, 0.9, [])] : [], levels.measured ? 'SOURCE_EXACT' : 'ASSUMED_FOR_RENDERING', levels.measured ? 'a printed level datum on the section' : 'a conventional storey height', { printed: levels.measured, unresolvedProperties: levels.measured ? [] : ['elevation', 'height'] })
    levelsV2.push({ index, id: `lvl-${i}`, elevation, height, wallTop: round6(elevation + stated), featureId })
  })
  for (const e of levels.evidenceIds) record({ evidenceId: e, evidenceKind: 'METRIC', what: 'a level datum', authority: 'HIGH', featureId: levelsV2[0]?.featureId, disposition: 'USED_IN_MODEL', reason: 'the storey levels and the ridge', stage: 'METRIC_SOLVE' })
  const levelOf = (index: number) => levelsV2.find((l) => l.index === index)

  // Plan frames per storey.
  const planFrames: PlanFrameV2[] = []
  const planByStorey = new Map<number, { plan: PlanReading; frame: PlanFrameV2; raster: Raster }>()
  // 005L (council B5L-2): the storey a plan is of is the layout's, which ranks the storeys the plans show — an attic
  // over an upper floor is storey 2, not 1.
  const storeyIndexOf = (plan: PlanReading): number => draft.storeys.find((x) => x.frameIds.includes(plan.frame.id))?.index ?? ({ BASEMENT: -1, GROUND: 0, UPPER: 1, ATTIC: 1, ROOF: 2 })[plan.storey] ?? 0
  for (const plan of draft.plans) {
    const raster = options.raster(plan.frame)
    if (!raster) continue
    const index = storeyIndexOf(plan)
    const isBase = draft.base?.frame.id === plan.frame.id
    let frame = isBase ? planFrameV2(plan, index, world, draft) : undefined
    let why = 'chain-registered base plan'
    if (!frame) {
      // The body this storey covers: the mass reaching it with the largest area.
      // 005L: what this storey's walls stand on is its own footprint, which need not be the whole of any body.
      const covers = masses.filter((m) => m.storeys.includes(index)).map((m) => rectAt(m, index)).sort((a, b) => (b.x1 - b.x0) * (b.z1 - b.z0) - (a.x1 - a.x0) * (a.z1 - a.z0))[0] ?? main
      const byFaces = planFrameByOuterFaces(plan, index, world, { x0: covers.x0, z0: covers.z0, x1: covers.x1, z1: covers.z1 }, raster)
      const aligned = planFrameV2(plan, index, world, draft)
      // 005L (council B5L-5): where the layout's registration rests on a scale the drawings state (both plans' chains,
      // or the scale both print), the outer faces refine it only where they agree with it in scale. Faces fitted to the
      // wrong rectangle — the whole of an L outline put on one leg of it — agree with themselves on both axes and are
      // still wrong by the L. A registration fitted from the walls alone states nothing the faces must yield to.
      const statedBasis = ['STATED', 'PRINTED_SCALE'].includes(draft.alignments.get(plan.frame.id)?.basis ?? '')
      const agrees = !aligned || !byFaces || !statedBasis || Math.abs(byFaces.mppX / aligned.mppX - 1) <= PLAN_FRAME_SCALE_AGREEMENT
      // 005W-N1: faces that fit no scale of their own, on a sheet drawn exactly like the base plan's, take the base frame.
      const baseEntry = draft.base ? planByStorey.get(storeyIndexOf(draft.plans.find((p) => p.frame.id === draft.base?.frame.id) ?? plan)) : undefined
      const sameSheet = !byFaces && !statedBasis && baseEntry && baseEntry.plan.frame.id !== plan.frame.id ? planFrameBySameSheet(plan, index, raster, baseEntry) : undefined
      frame = byFaces && agrees ? byFaces : sameSheet ?? aligned
      why = byFaces && agrees ? byFaces.why : sameSheet ? sameSheet.why : byFaces ? `its outer wall faces would put it at ${byFaces.mppX} m/px against the ${aligned?.mppX} m/px its registration onto the plan below states; the registration stands` : 'no outer faces found'
    }
    if (!frame) {
      gap({ what: `a registration for the storey ${index} plan`, reason: 'neither its chains, its outer faces nor an alignment onto the base plan fixed a scale for it', status: 'MISSING', observationIds: [], evidenceIds: [] })
      continue
    }
    planFrames.push(frame)
    planByStorey.set(index, { plan, frame, raster })
    step({ stage: 'registration', what: `storey ${index} plan registered`, method: 'DIRECT', detail: `${frame.mppX} m/px; ${why}`, inputs: 1, outputs: 1 })
  }

  trace({ phase: 'REGISTRATION', substage: 'PLAN_REGISTRATION', status: planFrames.length === draft.plans.length ? 'PASSED' : 'DEGRADED', counts: { plans: draft.plans.length, registered: planFrames.length }, ...(planFrames.length === draft.plans.length ? {} : { reasonCode: 'PLAN_STOREY_ALIGNMENT_FAILED' }) })

  // Elevation registrations (v2): silhouettes from the 03R extents, scales from the plan width and the ridge datum.
  const terrain = metrics.evidence.filter((e) => e.kind === 'LEVEL_DATUM' && e.value < 0 && e.value > -1.5).sort((a, b) => b.confidence - a.confidence)[0]?.value
  const { registrations: legacy, refused: legacyRefused } = registerElevationFrames(graph, { width: main.x1 - main.x0 + masses.filter((m) => m.id !== main.id).reduce((a, m) => a + Math.max(0, m.x1 - main.x1) + Math.max(0, main.x0 - m.x0), 0), depth: world.walled.z1 - world.walled.z0, totalHeight: ridgeY ?? levelsV2[levelsV2.length - 1].wallTop }, keep, options.raster)
  const elevations: ElevationRegistrationV2[] = []
  const views: Array<{ view: ElevationFrameV2; raster: Raster }> = []
  /** 005W: elevations registered on the walls' band alone (005V-N4): read for the openings of their facade, nothing else. */
  const openingOnlyViews: Array<{ view: ElevationFrameV2; raster: Raster; bandOnly: true }> = []
  /** 005W-N1: the band registrations behind those views, by frame, so a side decision can move them to the other wall. */
  const bandRegistrations = new Map<string, ElevationRegistrationV2>()
  /** 005W-N1: side views re-registered at the sheet scale of the front or rear, read in their place for the openings. */
  const openingViewOverrides = new Map<string, { view: ElevationFrameV2; raster: Raster; bandOnly: true }>()
  /** Sky masks of the elevation rasters, computed once per raster. */
  const skyMasks = new Map<Raster, Mask>()
  const sideEaves = layout.roofSupports.find((r) => r.massId === main.sourceMassId)?.overhangM?.value ?? 0
  // 005Y: the eaves projection the section draws, read before the renders are registered: a render's silhouette spans
  // the walls plus the eaves, and registering it on the walls alone misses it. The span across the ridge is the
  // layout's axis here; the roof (G1) reads it again on its own footprint when the renders decide the other axis.
  const sectionEaves = ((): ReturnType<typeof readEavesOverhang> => {
    const raster = sectionFrame ? options.raster(sectionFrame) : undefined
    const sup = layout.roofSupports.find((r) => r.massId === main.sourceMassId)
    if (!sectionFrame || !raster || !sup || !sup.pitchDeg || sup.kind === 'FLAT' || sup.kind === 'UNKNOWN') return undefined
    const across = (sup.ridgeAxis ?? 'Z') === 'X' ? main.z1 - main.z0 : main.x1 - main.x0
    return readEavesOverhang(raster, across, { pitchDeg: sup.pitchDeg.value, thicknessM: CONVENTIONS.roofThickness }, undefined, options.debug)
  })()
  for (const r of legacy) {
    if (!r.side) continue
    const frame = frameById.get(r.frameId)
    const raster = frame ? options.raster(frame) : undefined
    if (!frame || !raster || ridgeY === undefined) continue
    let reg = registerElevationV2({ id: r.frameId, assetId: r.assetId }, r.extent, r.side, r.sideConfidence, r.sideWhy, world, ridgeY, sideEaves, terrain, false, sectionEaves?.overhangM)
    options.debug?.(`elevation-registration ${r.side} ${r.frameId} extent ${r.extent.x0},${r.extent.y0}..${r.extent.x1},${r.extent.y1} ridge ${ridgeY} terrain ${terrain} -> ${reg ? `${reg.mpp} m/px ground ${reg.bottomY}` : 'none'}`)
    // 005V-N4: a silhouette that fits no span of the house may take in what stands beside it (a pergola) or a roof's
    // overhang. The walls are then looked for as a repeated band of neutral pixels across the silhouette, scaled by the
    // walled width alone; the apex stays the ridge datum, and only a band whose ground then lands on the terrain within
    // the same tolerance is taken (the one that lands nearest). The openings are not used to choose it.
    if (!reg) {
      // 005W: a view registered on the walls' band feeds the openings of its facade only. The roof, the rooflights,
      // the chimneys and the wall finish keep to views the silhouette registered: the band says where the walls are, not
      // where the roof's outline or the render's colours sit.
      // 005Y-N5 (C5): where the silhouette's top is not the roof's (a roof traced as background), the band is also tried
      // with the ridge datum on the top of what stands over it; the ground decides between the two, as between bands.
      let mask = skyMasks.get(raster)
      const walled = neutralBands(raster, r.extent)
        .filter((b) => b.share >= WALL_BAND_MIN_SHARE && b.x1 - b.x0 >= WALL_BAND_MIN_WIDTH * (r.extent.x1 - r.extent.x0))
        .flatMap((b) => {
          if (!mask) {
            mask = skyMask(raster)
            skyMasks.set(raster, mask)
          }
          const roofTop = roofTopOverBand(mask, r.extent.y0, r.extent.y1, b.x0, b.x1)
          return [{ y0: r.extent.y0, why: '' }, ...(roofTop ? [{ y0: roofTop.row, why: `; apex taken at row ${roofTop.row}: ${roofTop.why}` }] : [])].map((top) => ({ b, reg: registerElevationV2({ id: r.frameId, assetId: r.assetId }, { ...r.extent, x0: b.x0, x1: b.x1, y0: top.y0 }, r.side as 'FRONT' | 'REAR' | 'LEFT' | 'RIGHT', r.sideConfidence, `${r.sideWhy}; scaled on the walls' band, columns ${b.x0}..${b.x1} of the silhouette's ${r.extent.x0}..${r.extent.x1} (${b.rows} rows)${top.why}`, world, ridgeY, sideEaves, terrain, true) }))
        })
        .filter((c): c is { b: { x0: number; x1: number; rows: number; share: number; y0: number; y1: number }; reg: NonNullable<ReturnType<typeof registerElevationV2>> } => c.reg !== undefined)
        .sort((a, b) => a.reg.anisotropyCheck - b.reg.anisotropyCheck)
      options.debug?.(`wall-bands ${r.side} ${r.frameId} -> ${walled.map((c) => `${c.b.x0}..${c.b.x1}@${c.reg.extent.y0}:${c.reg.anisotropyCheck.toFixed(3)}`).join(' ')}`)
      const band = walled[0]?.reg
      if (band) {
        openingOnlyViews.push({ view: elevationFrameFromV2(band, world), raster, bandOnly: true })
        bandRegistrations.set(band.frameId, band)
        step({ stage: 'registration', what: `the ${r.side.toLowerCase()} elevation registered on its walls' band, for its openings only`, method: 'DIRECT', detail: `${band.mpp} m/px, ground at ${band.bottomY} (${band.spanWhy})`, inputs: 1, outputs: 1 })
        continue
      }
    }
    if (!reg) {
      gap({ what: `a v2 registration for the ${r.side.toLowerCase()} elevation`, reason: 'its silhouette fits neither the walled nor the characteristic span with the ridge at its apex', status: 'AMBIGUOUS', observationIds: [], evidenceIds: [] })
      continue
    }
    elevations.push(reg)
    views.push({ view: elevationFrameFromV2(reg, world), raster })
    for (const o of graph.observations.filter((x) => x.frameId === r.frameId && (x.kind === 'SILHOUETTE' || x.kind === 'MASS_REGION'))) record({ evidenceId: o.id, evidenceKind: 'OBSERVATION', what: `${o.kind} on the ${r.side.toLowerCase()} render`, authority: 'MEDIUM', disposition: 'USED_AS_CORROBORATION', reason: 'the silhouette the render was registered by; every feature read on the render rests on it', stage: 'REGISTRATION' })
  }
  // 005Y-N2: one house stands on one ground. A view registered on its walls' band takes its width from the band and its
  // height from the apex on the ridge datum; where its ground lands more than 0.3 m from where the house's other
  // registered views (at least two) put it — their median — the apex it was hung from is not the ridge, and its
  // heights are not read: the view is left out, and named.
  for (let i = openingOnlyViews.length - 1; i >= 0; i -= 1) {
    const own = bandRegistrations.get(openingOnlyViews[i].view.registration.frameId)
    if (!own) continue
    const others = [...elevations, ...[...bandRegistrations.values()].filter((b) => b.frameId !== own.frameId)].map((r) => r.bottomY).sort((a, b) => a - b)
    if (others.length < 2) continue
    const median = others.length % 2 === 1 ? others[(others.length - 1) / 2] : (others[others.length / 2 - 1] + others[others.length / 2]) / 2
    if (Math.abs(own.bottomY - median) <= 0.3) continue
    openingOnlyViews.splice(i, 1)
    bandRegistrations.delete(own.frameId)
    gap({ what: `the heights of the openings on the ${own.side.toLowerCase()} elevation`, reason: `registered on its walls' band, it puts the ground at ${own.bottomY.toFixed(2)} m where the house's other ${others.length} registered views put it at ${median.toFixed(2)} m: its apex is not on the ridge datum, and the view is not read`, status: 'REFUSED', observationIds: [], evidenceIds: [] })
  }
  // 005Y-N3 (H5): the same ground test for the views the silhouette registered. Hung from the ridge datum at the
  // silhouette's top row, a view whose top row is not the ridge (a gable's apex too narrow to start the silhouette)
  // puts the ground off. Near the apex its heights hold (a roof's outline, a chimney's top); low on the wall they are off
  // by the ground's error, so its openings' heights are not read: the printed callout and the convention stand there,
  // and the view is named. The ground is the printed terrain datum where the section gives one; without it, the views
  // that agree with each other, when they outnumber the ones that do not — a tie decides nothing.
  const openingHeightRefused = new Set<string>()
  for (const { frameId, reason } of viewGroundRefusals(elevations, [...bandRegistrations.values()], terrain)) {
    const own = elevations.find((e) => e.frameId === frameId)
    if (!own) continue
    openingHeightRefused.add(frameId)
    gap({ what: `the heights of the openings on the ${own.side.toLowerCase()} elevation`, reason: `registered on its silhouette from the ridge datum, ${reason}: its top row is not the ridge, and heights low on its walls are not read (its roof outline and chimneys, near the datum, still are)`, status: 'REFUSED', observationIds: [], evidenceIds: [] })
    options.featureTrace?.({ kind: 'VIEW_OPENING_HEIGHTS_REFUSED', frameId, side: own.side, groundY: own.bottomY, terrainY: terrain ?? null, decision: 'REFUSED', reason })
  }
  step({ stage: 'registration', what: 'renders registered on the ridge datum', method: 'DIRECT', detail: elevations.map((e) => `${e.side}: ${e.mpp} m/px, ground at ${e.bottomY} (${e.spanWhy})`).join('; ') || 'none', inputs: legacy.length, outputs: elevations.length })
  const viewsOf = (facade: 'FRONT' | 'REAR' | 'WEST' | 'EAST'): Array<{ view: ElevationFrameV2; raster: Raster }> => views.filter((v) => v.view.side === (facade === 'WEST' ? 'LEFT' : facade === 'EAST' ? 'RIGHT' : facade))
  if (ridgeY === undefined && legacy.length > 0) gap({ what: 'a registration for the elevations', reason: 'no ridge datum was read from a section, and the elevations are registered on it', status: 'MISSING', observationIds: [], evidenceIds: [] })
  trace({
    phase: 'REGISTRATION',
    substage: 'ELEVATION_REGISTRATION',
    status: elevations.length > 0 ? 'PASSED' : 'DEGRADED',
    counts: { elevationFrames: legacy.length, registered: elevations.length, ridgeDatum: ridgeY !== undefined },
    ...(elevations.length > 0 ? {} : { reasonCode: ridgeY === undefined ? 'VIEW_REGISTRATION_NO_ANCHORS' : 'ELEVATION_REGISTRATION_FAILED', detail: ridgeY === undefined ? 'no ridge datum was read, and the elevations are registered on it' : 'no elevation silhouette fitted the walled or the characteristic span' }),
  })

  options.onPhase?.('TOPOLOGY')
  // ---------------------------------------------------------------------------
  // G1. the main roof and whether it covers the zones
  // ---------------------------------------------------------------------------
  const support = layout.roofSupports.find((r) => r.massId === main.sourceMassId)
  let mainRoof: BuildingV2['mainRoof']
  if (support && support.kind !== 'FLAT' && support.kind !== 'UNKNOWN' && support.pitchDeg && roofRidgeY !== undefined) {
    const ridgeY = roofRidgeY
    // Which way the ridge runs is read off the renders: a gable end has an
    // apex at mid-span, a side view a flat top. A view votes only when the
    // difference is unmistakable; the layout's own axis stands when no view
    // does, or when the views disagree.
    const apexVotes: Array<{ side: string; peakM: number; gableEnd: boolean }> = []
    for (const v of views) {
      const extent = v.view.registration.extent
      // The topmost ink in a column: an outline on a line drawing, the roof
      // or a tree on a render. Trees only lower a peak, and a lowered peak
      // only withholds a vote. 005V: the ink is neutral (`topNeutralInkRow`): a render's sky is not.
      // Sampled on the main body's own span, so an attached body in the same
      // view does not move the apex column off the gable.
      const along = v.view.side === 'FRONT' || v.view.side === 'REAR' ? [main.x0, main.x1] : [main.z0, main.z1]
      const at = (f: number): number | undefined => {
        const x = Math.round(v.view.pxOf(along[0] + (along[1] - along[0]) * f))
        if (x < extent.x0 || x > extent.x1) return undefined
        const y = topNeutralInkRow(v.raster, x, Math.max(0, extent.y0 - 4), extent.y1)
        return y === undefined ? undefined : v.view.yOf(y)
      }
      const mid = at(0.5)
      const ends = [at(0.15), at(0.85)].filter((y): y is number => y !== undefined)
      if (mid === undefined || ends.length < 2) continue
      const peakM = round6(mid - Math.max(...ends))
      // 005Y: a gable end rises at the pitch across the whole span the view sees, so between 15 % and 50 % of it by
      // 0.35 of the span at the pitch. A hipped roof's eaves side rises too, but only by the hip's run, a trapezoid:
      // with a stated pitch, an apex well short of the full triangle is not a gable end.
      // (A measured pitch is a rise over the layout's span, which the views may turn; only a stated one checks a view.)
      const statedPitch = support.authority === 'PUBLISHED_SPECIFICATION' || support.authority === 'PRINTED_ANGLE'
      const fullRise = statedPitch && support.pitchDeg ? 0.35 * Math.abs(along[1] - along[0]) * Math.tan((support.pitchDeg.value * Math.PI) / 180) : 0
      apexVotes.push({ side: v.view.side, peakM, gableEnd: peakM > 0.6 && (fullRise === 0 || peakM >= 0.75 * fullRise) })
    }
    const endsFrontRear = apexVotes.filter((a) => (a.side === 'FRONT' || a.side === 'REAR') && a.gableEnd).length
    const endsSides = apexVotes.filter((a) => (a.side === 'LEFT' || a.side === 'RIGHT') && a.gableEnd).length
    const votedAxis: 'X' | 'Z' | undefined = endsFrontRear > 0 && endsSides === 0 ? 'Z' : endsSides > 0 && endsFrontRear === 0 ? 'X' : undefined
    const ridgeAxis: 'X' | 'Z' = votedAxis ?? support.ridgeAxis ?? 'Z'
    const ridgeAt = ridgeAxis === 'Z' ? round6((main.x0 + main.x1) / 2) : round6((main.z0 + main.z1) / 2)
    const halfSpan = ridgeAxis === 'Z' ? (main.x1 - main.x0) / 2 : (main.z1 - main.z0) / 2
    // A measured pitch is a rise over the layout's half span; if the views put
    // the ridge the other way, the rise stands and the pitch follows the true span.
    const printedPitch = support.authority === 'PUBLISHED_SPECIFICATION' || support.authority === 'PRINTED_ANGLE'
    const supportHalfSpan = (support.ridgeAxis ?? 'Z') === 'Z' ? (main.x1 - main.x0) / 2 : (main.z1 - main.z0) / 2
    const pitch = !printedPitch && support.ridgeAxis && support.ridgeAxis !== ridgeAxis ? round6((Math.atan((supportHalfSpan * Math.tan((support.pitchDeg.value * Math.PI) / 180)) / halfSpan) * 180) / Math.PI) : support.pitchDeg.value
    const axisWhy = votedAxis ? `the ${apexVotes.filter((a) => a.gableEnd).map((a) => a.side.toLowerCase()).join(' and ')} render${apexVotes.filter((a) => a.gableEnd).length === 1 ? ' shows' : 's show'} a gable apex (${apexVotes.map((a) => `${a.side.toLowerCase()} ${a.peakM >= 0 ? '+' : ''}${a.peakM.toFixed(2)}`).join(', ')})` : `no render shows an unmistakable apex (${apexVotes.map((a) => `${a.side.toLowerCase()} ${a.peakM.toFixed(2)}`).join(', ') || 'none registered'}); the layout's axis stands`
    const derivedEave = round6(ridgeY - halfSpan * Math.tan((pitch * Math.PI) / 180))
    const eaveY = derivedEave
    const sideViews = views.filter((v) => (ridgeAxis === 'Z' ? v.view.side === 'LEFT' || v.view.side === 'RIGHT' : v.view.side === 'FRONT' || v.view.side === 'REAR'))
    // 005Y: a span registered with the section's eaves is the walls plus the eaves: the eaves are not a zone.
    const zoneVotes = sideViews.map((v) => { const e = elevations.find((x) => x.frameId === v.view.registration.frameId); return (e?.spanM ?? 0) - 2 * (e?.eavesM ?? 0) })
    // What the side views have to exceed is the depth the BODIES already
    // explain, all of them: a wing projecting past the main body widens the
    // view by its own depth, and that is not the roof reaching a zone.
    const bodiesSpan = ridgeAxis === 'Z' ? Math.max(...masses.map((m) => m.z1)) - Math.min(...masses.map((m) => m.z0)) : Math.max(...masses.map((m) => m.x1)) - Math.min(...masses.map((m) => m.x0))
    const walledSpan = Math.max(ridgeAxis === 'Z' ? world.walled.z1 - world.walled.z0 : world.walled.x1 - world.walled.x0, bodiesSpan)
    const coversZones = zoneVotes.length > 0 && zoneVotes.every((s) => s > walledSpan + 0.2)
    const footprint = ridgeAxis === 'Z' ? { x0: main.x0, x1: main.x1, z0: coversZones ? world.envelope.z0 : main.z0, z1: coversZones ? world.envelope.z1 : main.z1 } : { x0: coversZones ? world.envelope.x0 : main.x0, x1: coversZones ? world.envelope.x1 : main.x1, z0: main.z0, z1: main.z1 }
    const sids = sideViews.map((v) => sighting(frameById.get(v.view.registration.frameId) as SourceCoordinateFrame, 'roof silhouette spanning the zones', 0.8))
    if (sectionFrame) sids.push(sighting(sectionFrame, 'roof pitch and ridge', 0.9))
    const featureId = feature('ROOF', 'roof-main', { pitchDeg: { value: pitch, low: pitch - 0.5, high: pitch + 0.5, unit: 'deg' }, ridgeY: { value: ridgeY, low: ridgeY - 0.02, high: ridgeY + 0.02 }, eaveY: { value: eaveY, low: eaveY - 0.05, high: eaveY + 0.05 }, extent: { value: footprint.z1 - footprint.z0, low: footprint.z1 - footprint.z0 - 0.1, high: footprint.z1 - footprint.z0 + 0.1 } }, sids, roofDatum ? 'SOURCE_DERIVED' : support.authority === 'PUBLISHED_SPECIFICATION' || support.authority === 'PRINTED_ANGLE' ? 'SOURCE_EXACT' : 'SOURCE_DERIVED', roofDatum ? `${support.why}; ${roofDatum.why}` : support.why, { printed: !roofDatum, uncertaintyM: roofDatum ? 0.3 : 0.05, parameterProvenance: { extent: coversZones ? 'SOURCE_CORROBORATED' : 'SOURCE_DERIVED', eaveY: roofDatum ? 'ASSUMED_FOR_RENDERING' : 'SOURCE_DERIVED', ...(roofDatum ? { ridgeY: 'ASSUMED_FOR_RENDERING' } : {}) } })
    mainRoof = { massId: main.id, kind: 'GABLE', pitchDeg: pitch, ridgeAxis, ridgeAt, eaveY, ridgeY, footprint, coversZones, coversZonesWhy: coversZones ? `both side renders span the characteristic depth at the ridge scale, so the roof reaches the outer planes` : 'the side renders span the walled depth only', buildUpVerticalM: round6(Math.max(0.15, eaveY - (levelOf(topStorey)?.wallTop ?? eaveY))), thicknessM: CONVENTIONS.roofThickness, authority: support.authority, featureId, provenance: roofDatum ? 'SOURCE_DERIVED' : support.authority === 'PUBLISHED_SPECIFICATION' || support.authority === 'PRINTED_ANGLE' ? 'SOURCE_EXACT' : 'SOURCE_DERIVED' }
    for (const e of support.evidenceIds) record({ evidenceId: e, evidenceKind: 'METRIC', what: 'the roof pitch statement', authority: 'HIGH', featureId, disposition: 'USED_IN_MODEL', reason: 'the main roof pitch', stage: 'METRIC_SOLVE' })
    step({ stage: 'roof', what: 'the main roof', method: 'DISCRETE_SELECTION', detail: `${pitch}° ${support.kind.toLowerCase()} ridge along ${ridgeAxis} (${axisWhy}), eave ${eaveY}, ${mainRoof.coversZonesWhy}`, inputs: sideViews.length, outputs: 1 })
    // 005Y: what stands at each end of the ridge. On an elevation of an eaves side, d metres in from an end wall a hip's
    // outline stands at the eaves plus d at the pitch (an eaves projection moves the lip out and down along the same
    // slope, so the outline there is unchanged), a gable's at the ridge. Every eaves-side view that sees the end must
    // say the same; a view that says neither, or the other, keeps the gable.
    const endVotes: Array<{ side: string; min: RoofEnd | 'UNCLEAR'; max: RoofEnd | 'UNCLEAR'; at: string }> = []
    const rise = ridgeY - eaveY
    const tanP = Math.tan((pitch * Math.PI) / 180)
    if (rise > 0.5) {
      for (const v of sideViews) {
        // Only a view whose silhouette landed on the terrain when it was registered can say where the ends are.
        const sound = elevations.find((e) => e.frameId === v.view.registration.frameId)
        if (!sound || sound.anisotropyCheck > ROOF_END_VIEW_MAX_GROUND_ERROR_M) {
          options.debug?.(`roof ends: ${v.view.side} not used, its ground lands ${sound ? sound.anisotropyCheck.toFixed(2) : '?'} m off the terrain`)
          continue
        }
        const extent = v.view.registration.extent
        const [a0, a1] = ridgeAxis === 'Z' ? [main.z0, main.z1] : [main.x0, main.x1]
        const classify = (end: 'min' | 'max'): { kind: RoofEnd | 'UNCLEAR'; at: string } => {
          const rs: number[] = []
          const hs: Array<{ d: number; y: number }> = []
          for (const k of [0.2, 0.35, 0.5]) {
            const d = halfSpan * k
            const along = end === 'min' ? a0 + d : a1 - d
            const x = Math.round(v.view.pxOf(along))
            if (x < extent.x0 || x > extent.x1) return { kind: 'UNCLEAR', at: 'outside the view' }
            const y = topNeutralInkRow(v.raster, x, Math.max(0, extent.y0 - 4), extent.y1)
            if (y === undefined) return { kind: 'UNCLEAR', at: 'no outline' }
            const hip = eaveY + d * tanP
            hs.push({ d, y: v.view.yOf(y) })
            rs.push((v.view.yOf(y) - hip) / Math.max(0.3, ridgeY - hip))
          }
          // The outline's own rise between the samples: a hip climbs at the pitch, a gable's ridge stays level.
          const rise = (hs[hs.length - 1].y - hs[0].y) / Math.max(1e-6, hs[hs.length - 1].d - hs[0].d)
          const climbs = Math.abs(rise - tanP) <= ROOF_END_SLOPE_TOLERANCE * tanP
          const level = Math.abs(rise) <= ROOF_END_SLOPE_TOLERANCE * tanP
          const at = `${rs.map((r) => r.toFixed(2)).join('/')} rising ${rise.toFixed(2)} against ${tanP.toFixed(2)}`
          return { kind: climbs && rs.every((r) => Math.abs(r) < ROOF_END_SLOPE_TOLERANCE) ? 'HIP' : level && rs.every((r) => Math.abs(r - 1) < 0.3) ? 'GABLE' : 'UNCLEAR', at }
        }
        const lo = classify('min')
        const hi = classify('max')
        endVotes.push({ side: v.view.side, min: lo.kind, max: hi.kind, at: `${lo.at} | ${hi.at}` })
      }
    }
    // A hipped roof the page states is hipped unless an elevation draws a gable at that end; any other roof is hipped
    // at an end only where every eaves-side view draws a hip there.
    const statedHip = support.kind === 'HIP'
    const endOf = (key: 'min' | 'max'): RoofEnd => (statedHip ? (endVotes.some((e) => e[key] === 'GABLE') ? 'GABLE' : 'HIP') : endVotes.length > 0 && endVotes.every((e) => e[key] === 'HIP') ? 'HIP' : 'GABLE')
    const ends = { min: endOf('min'), max: endOf('max') }
    if (statedHip && (ends.min === 'GABLE' || ends.max === 'GABLE')) gap({ what: 'the hipped ends of the main roof', reason: `the roof is stated as hipped, but an eaves-side elevation draws a gable at the ${ends.min === 'GABLE' ? 'lower' : 'upper'} end (${endVotes.map((e) => `${e.side.toLowerCase()} ${e.at}`).join('; ')}); that end is built as a gable`, status: 'AMBIGUOUS', observationIds: [], evidenceIds: [] })
    options.debug?.(`roof ends: ${JSON.stringify(endVotes)}`)
    if (ends.min === 'HIP' || ends.max === 'HIP') {
      const drawn = endVotes.length > 0 ? `the eaves-side elevations (${endVotes.map((e) => `${e.side.toLowerCase()}: outline over the ends at ${e.at} of the way from the hip's line to the ridge`).join('; ')})` : 'no eaves-side elevation was registered to check it'
      mainRoof.ends = { ...ends, why: `${statedHip ? `the page states a hipped roof (${support.why}); ${drawn}` : drawn} — ${ends.min === 'HIP' && ends.max === 'HIP' ? 'a hip at both ends of the ridge' : `a hip at the ${ends.min === 'HIP' ? 'lower' : 'upper'} end of the ridge only`}` }
      step({ stage: 'roof', what: 'the ends of the main roof, read on the eaves-side elevations', method: 'DISCRETE_SELECTION', detail: mainRoof.ends.why, inputs: sideViews.length, outputs: 1 })
    }
  } else {
    gap({ what: 'the main roof', reason: 'no pitched roof with a stated pitch and a ridge datum was inferred over the main body', status: 'MISSING', observationIds: [], evidenceIds: [] })
  }

  // ---------------------------------------------------------------------------
  // G1b. which unlabelled side view is which, now that the main body's profile is known
  // ---------------------------------------------------------------------------
  if (mainRoof && ridgeY !== undefined) {
    const roof = mainRoof
    const labelled = (frameId: string): boolean => {
      const v = frameById.get(frameId)?.roles.view as string | undefined
      return v === 'LEFT' || v === 'RIGHT' || v === 'SIDE_LEFT' || v === 'SIDE_RIGHT'
    }
    const sides = views.map((v, index) => ({ ...v, index })).filter((v) => (v.view.side === 'LEFT' || v.view.side === 'RIGHT') && !labelled(v.view.registration.frameId))
    const mirrored = sides.map((v) => {
      const reg = elevations.find((e) => e.frameId === v.view.registration.frameId)
      const other = v.view.side === 'LEFT' ? 'RIGHT' : 'LEFT'
      const again = reg ? registerElevationV2({ id: reg.frameId, assetId: reg.assetId }, reg.extent, other, reg.sideConfidence, `${reg.sideWhy}; mirrored to the ${other.toLowerCase()} wall by the main body's side profile`, world, ridgeY, sideEaves, terrain, false, sectionEaves?.overhangM) : undefined
      return again ? { v, reg: again, view: elevationFrameFromV2(again, world) } : undefined
    })
    const pairs = mirrored.filter((m): m is NonNullable<typeof m> => m !== undefined)
    if (sides.length > 0 && pairs.length === sides.length) {
      const profile = mainTopProfile(roof, 'Z')
      const decision = decideSideOrientation(pairs.map((m) => ({ current: m.v.view, mirrored: m.view, raster: m.v.raster })), profile, skyMasks, options.debug)
      if (decision.swap) {
        for (const m of pairs) {
          views[m.v.index] = { view: m.view, raster: m.v.raster }
          const at = elevations.findIndex((e) => e.frameId === m.reg.frameId)
          if (at >= 0) elevations[at] = m.reg
        }
      }
      step({ stage: 'registration', what: 'the unlabelled side views oriented by the main body’s profile', method: 'DISCRETE_SELECTION', detail: decision.why, inputs: sides.length, outputs: decision.swap ? sides.length : 0 })
    }
  }

  // ---------------------------------------------------------------------------
  // G1c. 005W-N1: which side wall each unlabelled side view shows, from the openings
  // ---------------------------------------------------------------------------
  // A symmetric gable fits its profile both ways, and a side view no silhouette registered is placed on the one wall
  // left. The plan's gaps in the two side walls are the objects both views must show: the views, silhouette- and
  // band-registered alike, are scored as assigned and all moved to the other wall, and swapped together only on a clear
  // reading (decideSidesByOpenings). Nothing else of a view changes: its scale, its ground and its use stay as they were.
  {
    const unlabelledSide = (frameId: string, side: string): boolean => (side === 'LEFT' || side === 'RIGHT') && frameById.get(frameId)?.roles.view === 'SIDE_UNSPECIFIED'
    const moved = (reg: ElevationRegistrationV2, walledOnly: boolean): ElevationRegistrationV2 | undefined => {
      const other = reg.side === 'LEFT' ? 'RIGHT' : 'LEFT'
      return ridgeY === undefined ? undefined : registerElevationV2({ id: reg.frameId, assetId: reg.assetId }, reg.extent, other, reg.sideConfidence, `${reg.sideWhy}; moved to the ${other.toLowerCase()} wall by the openings the plan draws in the side walls`, world, ridgeY, sideEaves, terrain, walledOnly, sectionEaves?.overhangM)
    }
    const silhouetteSides = views
      .map((v, index) => ({ v, index, reg: elevations.find((e) => e.frameId === v.view.registration.frameId) }))
      .filter((x) => unlabelledSide(x.v.view.registration.frameId, x.v.view.side) && x.reg)
      .map((x) => ({ ...x, again: moved(x.reg as ElevationRegistrationV2, false) }))
    const bandSides = openingOnlyViews
      .map((v, index) => ({ v, index, reg: bandRegistrations.get(v.view.registration.frameId) }))
      .filter((x) => unlabelledSide(x.v.view.registration.frameId, x.v.view.side) && x.reg)
      .map((x) => ({ ...x, again: moved(x.reg as ElevationRegistrationV2, true) }))
    // A side elevation the publisher labels a side, refused at registration because its silhouette (a pergola, a
    // terrace beside the house) fits no span, is the opposite side wall of the one silhouette-registered side view when
    // the two are drawn on one sheet scale: the main roof's gable outline spans the same pixels on both, in two bands of
    // rows. It then takes that view's scale and ground row, mirrored, with its own gable axis on the ridge; read for its
    // openings only, like any band-registered view (sameSheetSideRegistration).
    const sheetSides: Array<{ v: { view: ElevationFrameV2; raster: Raster; bandOnly: true }; index: number; again: ElevationRegistrationV2 | undefined }> = []
    const mate = silhouetteSides.length === 1 ? silhouetteSides[0] : undefined
    if (mate && mainRoof && ridgeY !== undefined && mainRoof.ridgeAxis === 'X') {
      const mateReg = mate.reg as ElevationRegistrationV2
      for (const r of legacyRefused) {
        const frame = frameById.get(r.frameId)
        const raster = frame ? options.raster(frame) : undefined
        if (!frame || !raster || frame.roles.view !== 'SIDE_UNSPECIFIED') continue
        let mask = skyMasks.get(raster)
        if (!mask) {
          mask = skyMask(raster)
          skyMasks.set(raster, mask)
        }
        let mateMask = skyMasks.get(mate.v.raster)
        if (!mateMask) {
          mateMask = skyMask(mate.v.raster)
          skyMasks.set(mate.v.raster, mateMask)
        }
        const apexRow = mate.v.view.pyOf(ridgeY)
        const eaveRow = mate.v.view.pyOf(mainRoof.eaveY)
        const outlineOf = (m: Mask): ReturnType<typeof gableOutline> => gableOutline(m, apexRow, eaveRow)
        // The mate's ground row is its silhouette's top put on the ridge; where its own gable outline places the apex,
        // that row is the ridge instead (gableApexRow), for both views of the sheet.
        const apex = gableApexRow(outlineOf(mateMask), mainRoof.pitchDeg)
        const sheetMate: ElevationRegistrationV2 = apex ? { ...mateReg, zeroRow: round6(apex.row + ridgeY / mateReg.mpp), why: `${mateReg.why}; ${apex.why}, which is the ridge datum` } : mateReg
        const built = (side: 'LEFT' | 'RIGHT') => sameSheetSideRegistration({ id: frame.id, assetId: frame.assetId }, side, sheetMate, mate.v.view, outlineOf(mateMask), outlineOf(mask), mainRoof.ridgeAt, r.why)
        const reg = built(mateReg.side === 'LEFT' ? 'RIGHT' : 'LEFT')
        options.debug?.(`same-sheet side ${frame.id}: ${reg ? reg.why : 'refused'}`)
        if (!reg) continue
        const v = { view: elevationFrameFromV2(reg, world), raster, bandOnly: true as const }
        openingOnlyViews.push(v)
        bandRegistrations.set(reg.frameId, reg)
        sheetSides.push({ v, index: openingOnlyViews.length - 1, again: built(reg.side === 'LEFT' ? 'RIGHT' : 'LEFT') })
      }
    }
    const all = [...silhouetteSides, ...bandSides, ...sheetSides]
    if (all.length > 0 && all.every((x) => x.again)) {
      const gapsOf = (side: 'LEFT' | 'RIGHT') =>
        main.storeys.flatMap((index) => {
          const entry = planByStorey.get(index)
          const l = levelOf(index)
          if (!entry || !l) return []
          const r = rectAt(main, index)
          const facade = side === 'LEFT' ? 'WEST' : 'EAST'
          const planeAt = facade === 'WEST' ? r.x0 : r.x1
          const inward = facade === 'WEST' ? 1 : -1
          const gable = mainRoof?.ridgeAxis === 'X' && index === topStorey
          const host: WallHost = { massId: main.id, facade, planeAt, from: r.z0, to: r.z1, centreAt: round6(planeAt + (inward * T) / 2), storeyIndex: index, floorY: l.elevation, storeyHeightM: gable ? round6((mainRoof as NonNullable<typeof mainRoof>).ridgeY - l.elevation) : l.height }
          const gaps = planGaps(entry.raster, entry.frame, host, T).map((g) => g.interval).sort((p, q) => p[0] - q[0])
          const solids: Array<[number, number]> = []
          let solidFrom = r.z0
          for (const g of gaps) {
            if (g[0] > solidFrom) solids.push([solidFrom, g[0]])
            solidFrom = Math.max(solidFrom, g[1])
          }
          if (r.z1 > solidFrom) solids.push([solidFrom, r.z1])
          const topY = gable ? round6((mainRoof as NonNullable<typeof mainRoof>).eaveY) : l.elevation + l.height
          return gaps.map((interval) => ({ interval, floorY: host.floorY, storeyHeightM: host.storeyHeightM, solids, topY }))
        })
      const decision = decideSidesByOpenings(
        all.map((x) => ({ current: x.v.view, swapped: elevationFrameFromV2(x.again as ElevationRegistrationV2, world), raster: x.v.raster })),
        gapsOf,
        (raster, view, g) => {
          const ext = elevationExtent(raster, view, g.interval, g.floorY, g.storeyHeightM) ?? wallAppearanceExtent(raster, view, g.interval, g.solids, g.floorY, g.topY)
          return !!ext && ext.headY - ext.sillY >= 0.5
        },
        options.debug,
      )
      if (decision.swap) {
        for (const x of silhouetteSides) {
          const again = x.again as ElevationRegistrationV2
          views[x.index] = { view: elevationFrameFromV2(again, world), raster: x.v.raster }
          const at = elevations.findIndex((e) => e.frameId === again.frameId)
          if (at >= 0) elevations[at] = again
        }
        for (const x of [...bandSides, ...sheetSides]) {
          const again = x.again as ElevationRegistrationV2
          openingOnlyViews[x.index] = { view: elevationFrameFromV2(again, world), raster: x.v.raster, bandOnly: true }
          bandRegistrations.set(again.frameId, again)
        }
      }
      step({ stage: 'registration', what: 'the unlabelled side views placed on their walls by the openings', method: 'DISCRETE_SELECTION', detail: decision.why, inputs: all.length, outputs: decision.swap ? all.length : 0 })
    }
    // For the openings, the side views of the sheet are read at the scale of a front or rear view of the same sheet: a
    // raster of the same size whose ridge row is the side view's gable apex (within 1 % of its height). The front and
    // rear scales come from the walled width; a side view's comes from its silhouette, which takes in eaves, chimneys
    // and terraces. Each keeps its gable axis on the ridge, and is read band-only, with the per-wall check.
    if (mate && sheetSides.length > 0 && mainRoof && ridgeY !== undefined) {
      const refs = [...bandRegistrations.values(), ...elevations].filter((r) => r.side === 'FRONT' || r.side === 'REAR')
      const baseEntry = [...planByStorey.values()].find((e) => e.plan.frame.id === draft.base?.frame.id)
      const baseFaces = baseEntry ? outerWallFaces(baseEntry.raster, baseEntry.plan.wallPx, baseEntry.plan.extent) : undefined
      const drawnMidZ = baseEntry && baseFaces ? round6((baseEntry.frame.toWorld(baseFaces.x0, baseFaces.y0).z + baseEntry.frame.toWorld(baseFaces.x0, baseFaces.y1).z) / 2) : undefined
      const sides = [{ view: views[mate.index].view, raster: views[mate.index].raster, reg: elevations.find((e) => e.frameId === views[mate.index].view.registration.frameId) }, ...sheetSides.map((x) => ({ view: openingOnlyViews[x.index].view, raster: openingOnlyViews[x.index].raster, reg: bandRegistrations.get(openingOnlyViews[x.index].view.registration.frameId) }))]
      for (const side of sides) {
        if (!side.reg) continue
        let mask = skyMasks.get(side.raster)
        if (!mask) {
          mask = skyMask(side.raster)
          skyMasks.set(side.raster, mask)
        }
        const outline = gableOutline(mask, side.view.pyOf(ridgeY), side.view.pyOf(mainRoof.eaveY))
        const apex = gableApexRow(outline, mainRoof.pitchDeg)
        if (!outline || !apex) continue
        const axis = (outline.bands[0].centre + outline.bands[1].centre) / 2
        const ref = refs.find((r) => {
          const f = frameById.get(r.frameId)
          const raster = f ? options.raster(f) : undefined
          const ridgeRow = r.zeroRow - ridgeY / r.mpp
          return !!raster && raster.width === side.raster.width && raster.height === side.raster.height && Math.abs(ridgeRow - apex.row) <= 0.01 * (r.zeroRow - ridgeRow)
        })
        if (!ref) continue
        const sign: 1 | -1 = side.reg.side === 'RIGHT' ? 1 : -1
        // Along the house the gable axis is the middle of the outline the base plan draws, where the plans measure from
        // (a symmetric gable's ridge); it stands only within 0.3 m of the roof's own ridge line.
        if (drawnMidZ === undefined || Math.abs(drawnMidZ - mainRoof.ridgeAt) > 0.3) continue
        const reg: ElevationRegistrationV2 = { ...side.reg, mpp: ref.mpp, zeroRow: round6(apex.row + ridgeY / ref.mpp), alongSign: sign, alongAtLeft: round6(drawnMidZ - sign * (axis - side.reg.extent.x0) * ref.mpp), spanWhy: `the sheet scale of ${ref.frameId} (${ref.side.toLowerCase()}), whose ridge row is this view's gable apex`, why: `${apex.why}; at the ${ref.mpp} m/px of the ${ref.side.toLowerCase()} view of the same sheet, with the gable axis at column ${axis.toFixed(1)} over the middle of the base plan's drawn outline, z ${drawnMidZ}` }
        openingViewOverrides.set(reg.frameId, { view: elevationFrameFromV2(reg, world), raster: side.raster, bandOnly: true })
        step({ stage: 'registration', what: `the ${reg.side.toLowerCase()} view at the sheet scale, for its openings`, method: 'DIRECT', detail: reg.why, inputs: 1, outputs: 1 })
      }
    }
  }

  // ---------------------------------------------------------------------------
  // G2. recesses and returns from the zones, per storey
  // ---------------------------------------------------------------------------
  // 005Q (N1): a zone the layout names as the building's own wall (an unresolved outer face) is no recess and no terrace
  const zoneRegions = layout.footprintRegions.filter((r) => r.kind === 'ZONE' && !isWallStripZone(r.id, layout.unresolved))
  const recesses: RecessTopology[] = []
  const returns: ReturnWallV2[] = []
  const sideOfZone = (id: string): ZoneSide | undefined => (id.endsWith('min_z') ? 'REAR' : id.endsWith('max_z') ? 'FRONT' : id.endsWith('min_x') ? 'WEST' : id.endsWith('max_x') ? 'EAST' : undefined)
  for (const zone of zoneRegions) {
    const side = sideOfZone(zone.id)
    if (!side) continue
    const zb = ringBounds(zone.ring)
    const zoneV2 = { x0: zb.x0, x1: zb.x1, z0: flipZ(world, zb.z1), z1: flipZ(world, zb.z0) }
    // Masses whose face lies on the zone's back plane.
    const backAt = side === 'FRONT' ? zoneV2.z1 : side === 'REAR' ? zoneV2.z0 : side === 'WEST' ? zoneV2.x1 : zoneV2.x0
    const mouthAt = side === 'FRONT' ? zoneV2.z0 : side === 'REAR' ? zoneV2.z1 : side === 'WEST' ? zoneV2.x0 : zoneV2.x1
    const onFace = masses.filter((m) => (side === 'FRONT' ? Math.abs(m.z0 - backAt) : side === 'REAR' ? Math.abs(m.z1 - backAt) : side === 'WEST' ? Math.abs(m.x0 - backAt) : Math.abs(m.x1 - backAt)) < 0.15)
    if (onFace.length === 0) continue
    for (const [index, entry] of planByStorey) {
      // 005L: a storey stands on this face only where its own footprint reaches it, not wherever its body does.
      const faceAt = (r: { x0: number; z0: number; x1: number; z1: number }): number => (side === 'FRONT' ? r.z0 : side === 'REAR' ? r.z1 : side === 'WEST' ? r.x0 : r.x1)
      const reaching = onFace.filter((m) => m.storeys.includes(index) && Math.abs(faceAt(rectAt(m, index)) - backAt) < 0.15).map((m) => ({ ...rectAt(m, index), featureId: m.featureId }))
      if (reaching.length === 0) continue
      const from = Math.min(...reaching.map((m) => (side === 'FRONT' || side === 'REAR' ? m.x0 : m.z0)))
      const to = Math.max(...reaching.map((m) => (side === 'FRONT' || side === 'REAR' ? m.x1 : m.z1)))
      // Another body standing in the zone (a wing projecting through it) owns
      // its stretch: the zone is only a zone beside it.
      const zoneBox = { x0: Math.min(zoneV2.x0, zoneV2.x1), x1: Math.max(zoneV2.x0, zoneV2.x1), z0: Math.min(zoneV2.z0, zoneV2.z1), z1: Math.max(zoneV2.z0, zoneV2.z1) }
      const occupied = masses
        .filter((m) => !onFace.includes(m) && m.storeys.includes(index))
        .map((m) => rectAt(m, index))
        .filter((m) => {
          const w = Math.max(0, Math.min(m.x1, zoneBox.x1) - Math.max(m.x0, zoneBox.x0))
          const d = Math.max(0, Math.min(m.z1, zoneBox.z1) - Math.max(m.z0, zoneBox.z0))
          return w * d >= 0.5 * (m.x1 - m.x0) * (m.z1 - m.z0)
        })
        .map((m) => (side === 'FRONT' || side === 'REAR' ? ([m.x0, m.x1] as const) : ([m.z0, m.z1] as const)))
      const topology = scanZoneForReturns(entry.raster, entry.frame, world, { side, from, to, backAt, mouthAt, ...(occupied.length > 0 ? { occupied } : {}) }, index)
      recesses.push(topology)
      const sid = sighting(entry.plan.frame, `${side.toLowerCase()} zone on the storey ${index} plan`, topology.confidence, [], undefined)
      const recessFeature = feature('RECESS', `recess-${side.toLowerCase()}-${index}`, { depth: { value: topology.depthM, low: topology.depthM - 0.05, high: topology.depthM + 0.05 }, mouthAt: { value: mouthAt, low: mouthAt - 0.05, high: mouthAt + 0.05 } }, [sid], topology.returns.length > 0 ? 'SOURCE_CORROBORATED' : 'SOURCE_DERIVED', topology.why, { storeyIndex: index, printed: true, uncertaintyM: 0.04, hostId: reaching[0].featureId })
      relate('HOSTED_BY', recessFeature, reaching[0].featureId, 'the recess opens through this body’s face')
      for (const e of zone.evidenceIds) record({ evidenceId: e, evidenceKind: 'METRIC', what: 'the zone’s printed depth', authority: 'HIGH', featureId: recessFeature, disposition: 'USED_IN_MODEL', reason: 'the recess depth', stage: 'TOPOLOGY' })
      topology.returns.forEach((r, i) => {
        const id = `return-${side.toLowerCase()}-${index}-${i}`
        // A return's outer face stands in the plane at the zone's outer end; it runs from the mouth to the wall face.
        const along = side === 'FRONT' || side === 'REAR' ? 'X' : 'Z'
        const outerAtLow = r.from <= from + 0.05
        const faceAt = outerAtLow ? r.from : r.to
        let start: { x: number; z: number }
        let end: { x: number; z: number }
        if (side === 'FRONT') {
          start = outerAtLow ? { x: faceAt, z: backAt } : { x: faceAt, z: mouthAt }
          end = outerAtLow ? { x: faceAt, z: mouthAt } : { x: faceAt, z: backAt }
        } else if (side === 'REAR') {
          start = outerAtLow ? { x: faceAt, z: mouthAt } : { x: faceAt, z: backAt }
          end = outerAtLow ? { x: faceAt, z: backAt } : { x: faceAt, z: mouthAt }
        } else if (side === 'WEST') {
          start = outerAtLow ? { x: mouthAt, z: faceAt } : { x: backAt, z: faceAt }
          end = outerAtLow ? { x: backAt, z: faceAt } : { x: mouthAt, z: faceAt }
        } else {
          start = outerAtLow ? { x: backAt, z: faceAt } : { x: mouthAt, z: faceAt }
          end = outerAtLow ? { x: mouthAt, z: faceAt } : { x: backAt, z: faceAt }
        }
        // A return in the middle of the zone (not at an outer end) has its material on the side away from the recess it closes; taken as the low side.
        void along
        const rsid = sighting(entry.plan.frame, `return wall ink in the ${side.toLowerCase()} zone`, r.support / r.scanLines, [], r.pixelRect)
        const returnFeature = feature('RETURN_WALL', id, { from: { value: r.from, low: r.from - 0.04, high: r.from + 0.04 }, to: { value: r.to, low: r.to - 0.04, high: r.to + 0.04 }, thickness: { value: r.thicknessM, low: r.thicknessM - 0.05, high: r.thicknessM + 0.05 } }, [rsid], 'SOURCE_DERIVED', `wall-thick ink on ${r.support} of ${r.scanLines} scan lines across the zone`, { storeyIndex: index, hostId: recessFeature, uncertaintyM: 0.04 })
        relate('PART_OF', returnFeature, recessFeature, 'a return of the recess')
        const occupied: [number, number] = outerAtLow ? [round6(faceAt), round6(faceAt + r.thicknessM)] : [round6(faceAt - r.thicknessM), round6(faceAt)]
        returns.push({ id, side, storeyIndex: index, start: { x: round6(start.x), z: round6(start.z) }, end: { x: round6(end.x), z: round6(end.z) }, thicknessM: r.thicknessM, alongInterval: occupied, recessId: topology.id, featureId: returnFeature, provenance: 'SOURCE_DERIVED', why: `a ${r.thicknessM.toFixed(2)} m return standing in the ${topology.depthM.toFixed(2)} m ${side.toLowerCase()} zone on the storey ${index} plan` })
      })
    }
  }
  step({ stage: 'recesses', what: 'recess topology from the zones', method: 'DISCRETE_SELECTION', detail: recesses.map((r) => `${r.side} storey ${r.storeyIndex}: ${r.returns.length} returns, open ${r.open.map((o) => `${o.from.toFixed(2)}..${o.to.toFixed(2)}`).join('/')}`).join('; ') || 'no zones', inputs: zoneRegions.length, outputs: recesses.length })

  // ---------------------------------------------------------------------------
  // G3. the stair: ladders on every plan, pooled
  // ---------------------------------------------------------------------------
  const rise = levelsV2.length > 1 ? round6(levelsV2[1].elevation - levelsV2[0].elevation) : 0
  const stair = readHouseStair({ graph, frameById, sectionFrame, planByStorey, body: { x0: main.x0, z0: main.z0, x1: main.x1, z1: main.z1 }, topStorey, levels: levelsV2 }, recorder)

  // ---------------------------------------------------------------------------
  // G4. interior per storey (with the stair as a barrier where it is not floor)
  // ---------------------------------------------------------------------------
  // 005Y-N2: the recesses the layout found that lie inside a body's rectangle on their storey: pockets in one of its faces
  // (`bayStripsOf`, or a pocket of the plan's decomposition the body's rectangle was cut over). A pocket has a return at
  // both ends and room for them inside the face; one reaching a corner is a notch in the outline, refused by name.
  type PocketSpec = { rec: (typeof layout.recesses)[number]; host: MassV2; region: (typeof layout.footprintRegions)[number]; index: number; rect: { x0: number; z0: number; x1: number; z1: number }; facade: 'FRONT' | 'REAR' | 'WEST' | 'EAST'; alongX: boolean; from: number; to: number; mouthAt: number; backAt: number; inward: number; refused?: string }
  function pocketsOf(recs: typeof layout.recesses): PocketSpec[] {
    const out: PocketSpec[] = []
    for (const rec of recs) {
      const host = masses.find((m) => m.sourceMassId === rec.massId && !m.pieceOf)
      const region = layout.footprintRegions.find((r) => r.id === rec.footprintRegionId)
      const index = layout.storeys.find((s) => rec.storeyIds.includes(s.id))?.index
      if (!host || !region || index === undefined || !host.storeys.includes(index)) continue
      const pr = v2Rect(ringBounds(region.ring))
      const m = rectAt(host, index)
      if (pr.x0 < m.x0 - 0.02 || pr.x1 > m.x1 + 0.02 || pr.z0 < m.z0 - 0.02 || pr.z1 > m.z1 + 0.02) continue
      const facade = Math.abs(pr.z0 - m.z0) < 0.05 ? 'FRONT' : Math.abs(pr.z1 - m.z1) < 0.05 ? 'REAR' : Math.abs(pr.x0 - m.x0) < 0.05 ? 'WEST' : Math.abs(pr.x1 - m.x1) < 0.05 ? 'EAST' : undefined
      if (!facade) continue
      const alongX = facade === 'FRONT' || facade === 'REAR'
      const [from, to] = alongX ? [pr.x0, pr.x1] : [pr.z0, pr.z1]
      const mouthAt = facade === 'FRONT' ? pr.z0 : facade === 'REAR' ? pr.z1 : facade === 'WEST' ? pr.x0 : pr.x1
      const backAt = facade === 'FRONT' ? pr.z1 : facade === 'REAR' ? pr.z0 : facade === 'WEST' ? pr.x1 : pr.x0
      const inward = facade === 'FRONT' || facade === 'WEST' ? 1 : -1
      // too shallow or too narrow to hold a back wall and two returns: a jog in the wall's ink, not a pocket
      if (Math.abs(backAt - mouthAt) <= T || to - from <= 2 * T) continue
      const [faceFrom, faceTo] = alongX ? [m.x0, m.x1] : [m.z0, m.z1]
      const refused = !rec.returns.low || !rec.returns.high ? 'a return wall is not found at one of its ends: not a pocket the body wraps' : from < faceFrom + T - 0.02 || to > faceTo - T + 0.02 ? 'it reaches a corner of the body: a notch in its outline, not a pocket in one face, and the body is built as its rectangle' : undefined
      out.push({ rec, host, region, index, rect: pr, facade, alongX, from, to, mouthAt, backAt, inward, ...(refused ? { refused } : {}) })
    }
    return out
  }
  const interior: InteriorReading[] = []
  const publishedRooms = options.publishedRooms ?? []
  for (const [index, entry] of planByStorey) {
    // Room labels are read from the page vote's tokens: the other passes' readings are raw evidence for the metric solver (005B).
    // 005U-N4: the readings the orientation vote discarded come along as set-aside candidates (`LabelToken.setAside`).
    const tokens: LabelToken[] = metrics.ocrTokens.filter((t) => t.frameId === entry.plan.frame.id).map((t) => ({ text: t.text, box: t.box, heightPx: t.heightPx, confidence: t.confidence, orientation: t.orientation, ...(t.pageVote === 'DISCARDED' ? { setAside: true } : {}) }))
    const storeyLabel = index === 0 ? 'GROUND' : index < 0 ? 'BASEMENT' : 'ATTIC'
    const rooms = publishedRooms.filter((r) => r.storey === storeyLabel || (index > 0 && r.storey === 'UPPER')).map((r) => ({ number: String(r.index), label: r.label, areaM2: r.area }))
    const barriers: Array<{ x0: number; z0: number; x1: number; z1: number }> = []
    if (stair) {
      const riserM = rise / Math.max(1, stair.hypothesis.risersTotal)
      let cumulative = 0
      stair.hypothesis.flights.forEach((f, i) => {
        const startRise = cumulative * riserM
        const endRise = (cumulative + f.risers) * riserM
        const rect = f.direction === 'PLUS_X' || f.direction === 'MINUS_X' ? { x0: Math.min(f.from, f.to), x1: Math.max(f.from, f.to), z0: f.band.from, z1: f.band.to } : { x0: f.band.from, x1: f.band.to, z0: Math.min(f.from, f.to), z1: Math.max(f.from, f.to) }
        const landing = stair.hypothesis.landings[i]
        if (index === 0 && startRise < 2.0) {
          barriers.push(rect)
          if (landing && endRise < 2.0) barriers.push(landing)
        }
        if (index > 0) {
          barriers.push(stair.slabHole)
        }
        cumulative += f.risers
      })
    }
    // 005Y-N2: a recess inside a body (a pocket in its face) is outside: no room floods into it through its back wall's door
    for (const p of pocketsOf(layout.recesses)) if (p.index === index && !p.refused) barriers.push(p.rect)
    const onStorey = masses.filter((x) => x.storeys.includes(index)).map((x) => rectAt(x, index))
    const labelArea = { x0: Math.min(...onStorey.map((r) => r.x0)), z0: Math.min(...onStorey.map((r) => r.z0)), x1: Math.max(...onStorey.map((r) => r.x1)), z1: Math.max(...onStorey.map((r) => r.z1)) }
    for (const m of masses.filter((x) => x.storeys.includes(index))) {
      const reading = readInterior(entry.raster, entry.frame, rectAt(m, index), T, index, tokens, rooms, { extraBarriers: barriers, labelArea, onDebug: options.debug ? (info) => options.debug?.(`interior ${m.id} storey ${index}: ${info.axis} band at px ${info.centrePx.toFixed(1)} (${info.axis === 'Z' ? 'x' : 'z'} ${(info.axis === 'Z' ? entry.frame.toWorld(info.centrePx, 0).x : entry.frame.toWorld(0, info.centrePx).z).toFixed(2)}), ${info.thick} px thick: ${info.runsPx.map((r) => `${(info.axis === 'Z' ? entry.frame.toWorld(0, r.to).z : entry.frame.toWorld(r.from, 0).x).toFixed(2)}..${(info.axis === 'Z' ? entry.frame.toWorld(0, r.from).z : entry.frame.toWorld(r.to, 0).x).toFixed(2)}`).join(', ')}`) : undefined })
      reading.walls = reading.walls.map((w) => ({ ...w, id: `${m.id}-${w.id}` }))
      reading.doors = reading.doors.map((d) => ({ ...d, id: `${m.id}-${d.id}`, betweenIds: [d.betweenIds[0].includes(':') ? d.betweenIds[0] : `${m.id}-${d.betweenIds[0]}`, d.betweenIds[1].includes(':') ? d.betweenIds[1] : `${m.id}-${d.betweenIds[1]}`] as [string, string] }))
      reading.rooms = reading.rooms.map((r) => ({ ...r, id: `${m.id}-${r.id}`, doorIds: r.doorIds.map((d) => `${m.id}-${d}`) }))
      reading.blocks = reading.blocks.map((b) => ({ ...b, id: `${m.id}-${b.id}` }))
      interior.push(reading)
      const sid = sighting(entry.plan.frame, `interior ink of ${m.id} on storey ${index}`, 0.7)
      for (const w of reading.walls) feature('INTERIOR_WALL', w.id, { at: { value: w.at, low: w.at - 0.04, high: w.at + 0.04 }, from: { value: w.from, low: w.from - 0.05, high: w.from + 0.05 }, to: { value: w.to, low: w.to - 0.05, high: w.to + 0.05 }, thickness: { value: w.thicknessM, low: w.thicknessM - 0.03, high: w.thicknessM + 0.03 } }, [sid], 'SOURCE_DERIVED', w.why, { storeyIndex: index, hostId: m.featureId, uncertaintyM: 0.05, confidence: w.confidence })
      for (const d of reading.doors) feature('INTERIOR_DOOR', d.id, { from: { value: d.from, low: d.from - 0.05, high: d.from + 0.05 }, width: { value: d.widthM, low: d.widthM - 0.08, high: d.widthM + 0.08 } }, [sid], 'SOURCE_DERIVED', d.why, { storeyIndex: index, uncertaintyM: 0.06, unresolvedProperties: ['height'], parameterProvenance: { height: 'ASSUMED_FOR_RENDERING' }, confidence: d.confidence })
      for (const r of reading.rooms) feature('ROOM', r.id, { area: { value: r.areaM2, low: r.areaM2 * 0.9, high: r.areaM2 * 1.1 } }, [sid], r.number && r.publishedAreaM2 ? 'SOURCE_CORROBORATED' : 'SOURCE_DERIVED', r.why, { storeyIndex: index, hostId: m.featureId, printed: !!r.publishedAreaM2, uncertaintyM: 0.06, unresolvedProperties: r.openPlan ? ['subdivision (open plan)'] : [], confidence: r.confidence })
      for (const u of reading.unresolved) gap({ what: u.what, reason: u.reason, status: 'AMBIGUOUS', observationIds: [], evidenceIds: [] })
    }
  }
  step({ stage: 'interior', what: 'partitions, doors and rooms', method: 'DISCRETE_SELECTION', detail: interior.map((i) => `storey ${i.storeyIndex}: ${i.walls.length} walls, ${i.doors.length} doors, ${i.rooms.length} rooms, ${i.blocks.length} blocks`).join('; '), inputs: planByStorey.size, outputs: interior.reduce((a, i) => a + i.rooms.length, 0) })

  trace({ phase: 'TOPOLOGY', substage: 'TOPOLOGY', status: mainRoof ? 'PASSED' : 'DEGRADED', counts: { masses: masses.length, mainRoof: !!mainRoof, recesses: recesses.length, returns: returns.length, partitions: interior.reduce((a, i) => a + i.walls.length, 0), rooms: interior.reduce((a, i) => a + i.rooms.length, 0), stair: stair ? stair.emit : 'none' }, ...(mainRoof ? {} : { detail: 'no pitched main roof was inferred' }) })
  options.onPhase?.('METRICS')
  // ---------------------------------------------------------------------------
  // G5/H. openings on every exterior wall, cross-view
  // ---------------------------------------------------------------------------
  const openings: OpeningV2[] = []
  /** 005W-N1: band-registered views some wall's gaps confirmed (readWallOpenings' per-wall check). */
  const acceptedBandViews = new Set<string>()
  const sharedDoors: BuildingV2['sharedDoors'] = []
  const isGableEnd = (m: MassV2, facade: 'FRONT' | 'REAR' | 'WEST' | 'EAST'): boolean => !!mainRoof && m.id === main.id && ((mainRoof.ridgeAxis === 'Z' && (facade === 'FRONT' || facade === 'REAR')) || (mainRoof.ridgeAxis === 'X' && (facade === 'WEST' || facade === 'EAST')))
  // 005U-N4: a garage room's one open side (`garageMouth`): the room is named a garage by a number read inside it
  // and the publisher's list, never by its area; two open sides, or none, and no gap is made a vehicle door.
  const vehicleMouths = new Map<string, { from: number; to: number; roomId: string; why: string }>()
  // 005Y-N5 (C3): the garage rooms the publisher's list names, for the doors in their walls
  const garageRooms: Array<{ massId: string; bounds: { x0: number; z0: number; x1: number; z1: number }; why: string }> = []
  const decomposition = draft.base?.decomposition
  for (const reading of interior) {
    const entry = planByStorey.get(reading.storeyIndex)
    if (!entry || !decomposition || decomposition.frameId !== entry.frame.frameId || reading.storeyIndex !== 0) continue
    for (const room of reading.rooms) {
      const mass = masses.find((x) => room.id.startsWith(`${x.id}-`))
      if (!mass) continue
      if (room.number && room.label && GARAGE_LABEL.test(room.label)) garageRooms.push({ massId: mass.id, bounds: room.bounds, why: `${room.id}, numbered ${room.number} = ${room.label} on the publisher's list` })
      const found = garageMouth(room, rectAt(mass, reading.storeyIndex), decomposition.wideOpenings, entry.frame, T)
      if (found.length === 1) {
        const [f] = found
        vehicleMouths.set(`${mass.id}:${f.facade}`, { from: f.from, to: f.to, roomId: room.id, why: `the one open side (${f.id}) of ${room.id}, numbered ${room.number} = ${room.label} on the publisher's list` })
      } else if (found.length > 1) {
        gap({ what: `the vehicle door of ${room.id}`, reason: `${found.length} open sides of the plan meet it (${found.map((f) => f.id).join(', ')}): none is chosen`, status: 'AMBIGUOUS', observationIds: [], evidenceIds: [] })
      }
    }
  }
  let hostIndex = 0
  // 005Y-N5 (C3): a body's garage: a room of it the publisher's list names a garage, or — where the room's number was
  // not read — the whole body, when a vehicle door was read in one of its walls
  const garagesOf = (m: MassV2, r: { x0: number; z0: number; x1: number; z1: number }): Array<{ bounds: { x0: number; z0: number; x1: number; z1: number }; why: string }> => {
    const named = garageRooms.filter((g) => g.massId === m.id)
    if (named.length > 0) return named
    const vehicle = openings.find((o) => o.massId === m.id && o.storeyIndex === 0 && o.family === 'GARAGE_DOOR')
    return vehicle ? [{ bounds: r, why: `the body ${m.id} holds a vehicle door (${vehicle.id})` }] : []
  }
  for (const m of masses) {
    for (const index of m.storeys) {
      const entry = planByStorey.get(index)
      const l = levelOf(index)
      if (!entry || !l) continue
      const callouts = metrics.evidence.filter((e) => e.kind === 'OPENING_CALLOUT' && e.frameId === entry.plan.frame.id)
      // 005L: this storey's own walls, which stand on its footprint over the body
      const r = rectAt(m, index)
      for (const facade of ['FRONT', 'EAST', 'REAR', 'WEST'] as const) {
        const planeAt = facade === 'FRONT' ? r.z0 : facade === 'REAR' ? r.z1 : facade === 'WEST' ? r.x0 : r.x1
        const inward = facade === 'FRONT' || facade === 'WEST' ? 1 : -1
        const from = facade === 'FRONT' || facade === 'REAR' ? r.x0 : r.z0
        const to = facade === 'FRONT' || facade === 'REAR' ? r.x1 : r.z1
        const gable = isGableEnd(m, facade) && index === topStorey && mainRoof ? { eaveY: mainRoof.eaveY, pitchDeg: mainRoof.pitchDeg, ridgeAlongAt: mainRoof.ridgeAt, eaveAtLow: from, eaveAtHigh: to, buildUpVerticalM: mainRoof.buildUpVerticalM } : undefined
        // 005V: a top-storey wall of the main body parallel to the ridge stops where the roof's underside meets it.
        const underEaves = !gable && mainRoof && m.id === main.id && index === topStorey ? round6(mainRoof.eaveY - mainRoof.thicknessM / Math.cos((mainRoof.pitchDeg * Math.PI) / 180)) : undefined
        const host: WallHost = { massId: m.id, facade, planeAt, from, to, centreAt: round6(planeAt + (inward * T) / 2), storeyIndex: index, ...(gable ? { gable } : {}), ...(underEaves !== undefined ? { eaveTopY: underEaves } : {}), floorY: l.elevation, storeyHeightM: gable ? round6(mainRoof!.ridgeY - l.elevation) : l.height }
        const found = readWallOpenings({ ...(options.featureTrace ? { trace: options.featureTrace } : {}), onBandViewAccepted: (frameId) => acceptedBandViews.add(frameId), plan: entry.frame, planRaster: entry.raster, host, wallThicknessM: T, callouts, views: [...viewsOf(facade).filter((v) => !openingHeightRefused.has(v.view.registration.frameId) || openingViewOverrides.has(v.view.registration.frameId)), ...openingOnlyViews.filter((v) => v.view.side === (facade === 'WEST' ? 'LEFT' : facade === 'EAST' ? 'RIGHT' : facade))].map((v) => openingViewOverrides.get(v.view.registration.frameId) ?? v), attachedSingleStorey: m.role === 'ATTACHED' && m.storeys.length === 1, onRefused: (r) => gap({ what: `the gap ${r.interval[0].toFixed(2)}..${r.interval[1].toFixed(2)} on the ${facade.toLowerCase()} wall of ${m.id}, storey ${index}`, reason: r.why, status: 'REFUSED', observationIds: [], evidenceIds: [] }), ...(vehicleMouths.has(`${m.id}:${facade}`) && index === 0 ? { vehicleMouth: vehicleMouths.get(`${m.id}:${facade}`) } : {}), ...(index === 0 ? { garageRooms: garagesOf(m, r) } : {}), index: hostIndex++ })
        for (const o of found) {
          // A gap on a face another body stands against is a door between the two bodies, not a facade opening.
          const other = masses.find((xm) => {
            if (xm.id === m.id || !xm.storeys.includes(index)) return false
            const x = rectAt(xm, index)
            return facade === 'EAST' ? Math.abs(x.x0 - r.x1) < 0.05 && o.interval[0] >= x.z0 - 0.05 && o.interval[1] <= x.z1 + 0.05 : facade === 'WEST' ? Math.abs(x.x1 - r.x0) < 0.05 && o.interval[0] >= x.z0 - 0.05 && o.interval[1] <= x.z1 + 0.05 : facade === 'FRONT' ? Math.abs(x.z1 - r.z0) < 0.05 && o.interval[0] >= x.x0 - 0.05 && o.interval[1] <= x.x1 + 0.05 : Math.abs(x.z0 - r.z1) < 0.05 && o.interval[0] >= x.x0 - 0.05 && o.interval[1] <= x.x1 + 0.05
          })
          if (other) {
            // built once: from the main body's side, and between two other bodies from the first of them (005C:
            // an outline frame's attached bodies meet each other, and their doors used to be dropped)
            if (m.role === 'MAIN' || (other.role !== 'MAIN' && m.id < other.id)) sharedDoors.push({ ...o, id: `shared-${o.id}`, family: 'DOOR', headY: round6(o.sillY + CONVENTIONS.doorHeight), otherMassId: other.id, why: `${o.why}; this face is shared with ${other.id}, so the gap is a doorway between the two bodies` })
            continue
          }
          openings.push(o)
        }
      }
      // 005Y-N3 (H1): one glazing wrapping a corner of this body on this storey: its two pieces are named one assembly
      const here = openings.filter((o) => o.massId === m.id && o.storeyIndex === index)
      for (const c of cornerAssemblies(here, r, T, entry.raster, entry.frame)) {
        const pa = openings.find((x) => x.id === c.a)
        const pb = openings.find((x) => x.id === c.b)
        // 005Y-N5: a pierless corner whose two pieces share one band is opened through the corner block
        const band = pa && pb ? openCornerBand(pa, pb) : { open: false, why: 'a piece is missing' }
        for (const [self, other] of [[c.a, c.b], [c.b, c.a]] as const) {
          const o = openings.find((x) => x.id === self)
          if (!o) continue
          o.cornerWith = other
          if (band.open) {
            const along = o.facade === 'FRONT' || o.facade === 'REAR' ? c.corner.x : c.corner.z
            o.openEnd = Math.abs(o.interval[0] - along) <= Math.abs(o.interval[1] - along) ? 'LOW' : 'HIGH'
          } else o.unresolved.push(`one glazing with ${other} round the corner (${c.corner.x.toFixed(2)}, ${c.corner.z.toFixed(2)}); the plan draws no pier there, but ${band.why}`)
        }
        options.featureTrace?.({ kind: 'CORNER_ASSEMBLY', massId: m.id, storey: index, a: c.a, b: c.b, corner: c.corner, pierInk: c.pierInk, decision: 'READ', open: band.open, why: `${c.why}; ${band.why}` })
        step({ stage: 'openings', what: `the corner assembly ${c.a} + ${c.b}`, method: 'DIRECT', detail: c.why, inputs: 2, outputs: 1 })
      }
    }
  }
  // 005Y-N3 (H5): a printed height the recogniser did not confirm (the lattice's reading alone), whose own runner-up is a
  // head the recogniser did read firmly on this storey while its first reading matches none, takes that common head:
  // openings of one storey share their heads more often than a weak digit is right. Named, both readings kept.
  const calloutConfidence = (id: string): number => metrics.evidence.find((e) => e.id === id)?.confidence ?? 0
  for (const o of openings) {
    const c = o.callout
    if (!c || o.elevation) continue
    const firm = new Set(openings.filter((x) => x !== o && x.storeyIndex === o.storeyIndex && x.callout && calloutConfidence(x.callout.evidenceId) >= FIRM_CALLOUT_CONFIDENCE).map((x) => x.callout?.heightCm as number))
    const commonCm = commonHeadReading(c, calloutConfidence(c.evidenceId), firm)
    const common = commonCm === undefined ? undefined : { cm: commonCm }
    const l = levelOf(o.storeyIndex)
    if (!common || !l) continue
    const h = common.cm / 100
    const sillY = h >= 1.95 ? l.elevation : round6(l.elevation + Math.max(0, 2.2 - h))
    o.unresolved.push(`the printed height reads ${c.heightCm} first and ${common.cm} second, the lattice's reading alone; ${common.cm} is the head the recogniser read firmly on other openings of this storey, and is taken`)
    o.why = `${o.why}; its printed height taken as ${common.cm}, the storey's common head, over a weak ${c.heightCm}`
    options.featureTrace?.({ kind: 'OPENING_COMMON_HEAD', id: o.id, from: c.heightCm, to: common.cm, firmHeadsOnStorey: [...firm].sort(), decision: 'CHANGED' })
    o.callout = { ...c, heightCm: common.cm, resolvedBy: 'COMMON_HEAD' }
    o.sillY = sillY
    o.headY = round6(sillY + h)
    o.provenance = { ...o.provenance, sill: h >= 1.95 ? 'SOURCE_DERIVED' : 'ASSUMED_FOR_RENDERING', head: 'SOURCE_DERIVED' }
  }
  // 005Y-N2: a recess the layout found inside a body (`bayStripsOf`, or any pocket lying within a body's rectangle): the
  // ring wall's gap over its mouth is a PASSAGE, not an opening to fill; two returns and a back wall close it, and the
  // back wall's own openings are read on its line in the plan.
  const pockets: NonNullable<BuildingV2['pockets']> = []
  for (const spec of pocketsOf(layout.recesses)) {
    const { rec, host, region, index, facade, alongX, from, to, mouthAt, backAt, inward } = spec
    const entry = planByStorey.get(index)
    const l = levelOf(index)
    if (!entry || !l) continue
    if (spec.refused) {
      gap({ what: `the recess ${rec.id} in ${host.id}'s ${facade.toLowerCase()} face`, reason: spec.refused, status: 'AMBIGUOUS', observationIds: [], evidenceIds: [] })
      continue
    }
    // the facade's gaps over the mouth are the mouth itself: taken off the openings, their elevation head kept
    const over = openings.filter((o) => o.massId === host.id && o.facade === facade && o.storeyIndex === index && Math.min(o.interval[1], to) - Math.max(o.interval[0], from) > 0.5 * Math.min(o.widthM, to - from))
    for (const o of over) openings.splice(openings.indexOf(o), 1)
    const read = over.find((o) => o.elevation && o.interval[1] - o.interval[0] >= 0.8 * (to - from))
    const wallTop = main.id === host.id && index === topStorey && mainRoof ? round6(mainRoof.eaveY - mainRoof.thicknessM / Math.cos((mainRoof.pitchDeg * Math.PI) / 180)) : round6(l.elevation + l.height)
    const assumedHead = round6(Math.min(l.elevation + l.height - slabT, wallTop - 0.2))
    const headY = read ? round6(Math.min(read.headY, wallTop - 0.2)) : assumedHead
    const id = `pocket-${host.id}-${index}-${pockets.length}`
    // each wall's face towards the pocket is where the plan's ink says: the recess's region may be cut on the walls'
    // faces or on their centre lines, as the grid fell. Across the line the region gives, at five places along it, the
    // dark run that line falls in or touches (within a wall) is the wall; its edge on the pocket's side is the face.
    const inkFace = (alongWall: 'X' | 'Z', at: number, span: [number, number], pocketSide: 1 | -1): number => {
      const faces: number[] = []
      const mppAcross = (entry.frame.mppX + entry.frame.mppY) / 2
      for (const f of [0.2, 0.35, 0.5, 0.65, 0.8]) {
        const s = span[0] + f * (span[1] - span[0])
        const darkAt = (c: number): boolean => {
          const p = alongWall === 'X' ? entry.frame.toPixel(s, c) : entry.frame.toPixel(c, s)
          return lumaOf(entry.raster, p.x, p.y) < 128
        }
        // walk from the region's line into the wall (away from the pocket) until ink, then on until paper
        let c = at - pocketSide * T
        if (!darkAt(at) && !darkAt(at - pocketSide * mppAcross)) {
          let found = false
          for (let d = 0; d <= T; d += mppAcross) if (darkAt(at - pocketSide * d)) { c = at - pocketSide * d; found = true; break }
          if (!found) continue
        } else c = at
        // from inside the wall, the face on the pocket's side
        let face = c
        for (let d = 0; d <= 1.5 * T; d += mppAcross) {
          if (!darkAt(c + pocketSide * d)) break
          face = c + pocketSide * d
        }
        faces.push(face)
      }
      if (faces.length < 3) return at
      faces.sort((a, b) => a - b)
      const median = faces[Math.floor(faces.length / 2)]
      return Math.abs(median - at) <= T ? round6(median) : at
    }
    const depthAxis: 'X' | 'Z' = alongX ? 'Z' : 'X'
    const lowFace = inkFace(depthAxis === 'Z' ? 'Z' : 'X', from, [Math.min(mouthAt, backAt), Math.max(mouthAt, backAt)], 1)
    const highFace = inkFace(depthAxis === 'Z' ? 'Z' : 'X', to, [Math.min(mouthAt, backAt), Math.max(mouthAt, backAt)], -1)
    const backFace = inkFace(alongX ? 'X' : 'Z', backAt, [lowFace, highFace], inward === 1 ? -1 : 1)
    void depthAxis
    // the walls, each by its face towards the pocket (a wall's line is a face, its material to the left of its run): the
    // returns outside the mouth, from the ring wall's inner face to the back wall's far face; the back wall between them
    const ring0 = mouthAt + inward * T
    const back1 = backFace + inward * T
    const at = (u: number, v: number): { x: number; z: number } => (alongX ? { x: round6(u), z: round6(v) } : { x: round6(v), z: round6(u) })
    const faced = (a: { x: number; z: number }, b: { x: number; z: number }, material: { x: number; z: number }): { start: { x: number; z: number }; end: { x: number; z: number } } => {
      const d = { x: b.x - a.x, z: b.z - a.z }
      return -d.z * material.x + d.x * material.z > 0 ? { start: a, end: b } : { start: b, end: a }
    }
    const lowDir = alongX ? { x: -1, z: 0 } : { x: 0, z: -1 }
    const highDir = alongX ? { x: 1, z: 0 } : { x: 0, z: 1 }
    const deepDir = alongX ? { x: 0, z: inward } : { x: inward, z: 0 }
    const walls: PocketV2['walls'] = [
      { id: `${id}-return-low`, role: 'RETURN', ...faced(at(lowFace, ring0), at(lowFace, back1), lowDir), thicknessM: T },
      { id: `${id}-return-high`, role: 'RETURN', ...faced(at(highFace, ring0), at(highFace, back1), highDir), thicknessM: T },
      { id: `${id}-back`, role: 'BACK', ...faced(at(lowFace, backFace), at(highFace, backFace), deepDir), thicknessM: T },
    ]
    const callouts = metrics.evidence.filter((e) => e.kind === 'OPENING_CALLOUT' && e.frameId === entry.plan.frame.id)
    const backHost: WallHost = { massId: host.id, facade, planeAt: round6(backFace), from: round6(lowFace), to: round6(highFace), centreAt: round6(backFace + (inward * T) / 2), storeyIndex: index, floorY: l.elevation, storeyHeightM: l.height, endsAtFaces: true }
    const backOpenings = readWallOpenings({ ...(options.featureTrace ? { trace: options.featureTrace } : {}), plan: entry.frame, planRaster: entry.raster, host: backHost, wallThicknessM: T, callouts, views: [], attachedSingleStorey: false, onRefused: (r) => gap({ what: `the gap ${r.interval[0].toFixed(2)}..${r.interval[1].toFixed(2)} on the back wall of the recess in ${host.id}'s ${facade.toLowerCase()} face`, reason: r.why, status: 'REFUSED', observationIds: [], evidenceIds: [] }), index: hostIndex++ }).map((o) => ({ ...o, id: `${id}-${o.id}` }))
    const why = `${rec.why}; its mouth ${lowFace.toFixed(2)}..${highFace.toFixed(2)} m between the returns' faces the plan's ink gives, on the ${facade.toLowerCase()} face is a passage${read ? `, its head read on the ${read.elevation?.frameId} elevation` : ', its head the storey\'s ceiling (assumed: the elevation does not read it)'}, and ${backOpenings.length} opening${backOpenings.length === 1 ? '' : 's'} stand in its back wall`
    const sid = sighting(entry.plan.frame, `a recess in the ${facade.toLowerCase()} face on the storey ${index} plan`, rec.confidence, [], region.pixelRect)
    const featureId = feature('RECESS', id, { depth: { value: Math.abs(backFace - mouthAt), low: Math.abs(backFace - mouthAt) - 0.05, high: Math.abs(backFace - mouthAt) + 0.05 }, width: { value: highFace - lowFace, low: highFace - lowFace - 0.05, high: highFace - lowFace + 0.05 }, headY: { value: headY, low: headY - 0.1, high: headY + 0.1 } }, [sid], 'SOURCE_DERIVED', why, { storeyIndex: index, hostId: host.featureId, uncertaintyM: 0.05, parameterProvenance: { headY: read ? 'IMAGE_METRIC_REGISTERED' : 'ASSUMED_FOR_RENDERING' } })
    relate('HOSTED_BY', featureId, host.featureId, 'the recess opens through this body’s face')
    for (const o of over) gap({ what: `the gap ${o.interval[0].toFixed(2)}..${o.interval[1].toFixed(2)} on the ${facade.toLowerCase()} wall of ${host.id}, storey ${index}`, reason: `it is the mouth of a recess (${id}): a passage, not a ${o.family.toLowerCase().replace(/_/g, ' ')}`, status: 'REFUSED', observationIds: [], evidenceIds: [] })
    pockets.push({ id, massId: host.id, facade, storeyIndex: index, from: round6(lowFace), to: round6(highFace), mouthAt: round6(mouthAt), backAt: round6(backFace), headY, headProvenance: read ? 'IMAGE_METRIC_REGISTERED' : 'ASSUMED_FOR_RENDERING', walls, backOpenings, featureId, why })
  }
  // 005Y-N7 (C): a covered terrace or porch cut out of a corner of a body (corner-recess.ts): two pockets, one in each
  // face, whose passages open through the corner, the two back walls the plan draws, and the post at the outer corner
  for (const host of masses.filter((m) => !m.pieceOf)) {
    for (const index of host.storeys) {
      const entry = planByStorey.get(index)
      const l = levelOf(index)
      if (!entry || !l) continue
      const body = rectAt(host, index)
      const rooms = interior.find((i) => i.storeyIndex === index)?.rooms ?? []
      const insideRoom = (r: { x0: number; z0: number; x1: number; z1: number }): boolean => rooms.some((room) => room.label !== undefined && (room.bounds.x0 + room.bounds.x1) / 2 > r.x0 && (room.bounds.x0 + room.bounds.x1) / 2 < r.x1 && (room.bounds.z0 + room.bounds.z1) / 2 > r.z0 && (room.bounds.z0 + room.bounds.z1) / 2 < r.z1)
      for (const zSide of ['FRONT', 'REAR'] as const) {
        for (const xSide of ['WEST', 'EAST'] as const) {
          const notch = readCornerNotch(entry.raster, entry.frame, body, T, xSide, zSide, insideRoom, (why) => options.debug?.(`corner-recess ${host.id} storey ${index}: ${why}`))
          if (!notch) continue
          // a corner already holding a pocket or a balcony is not read twice
          if (pockets.some((p) => p.massId === host.id && p.storeyIndex === index && (p.facade === xSide || p.facade === zSide))) continue
          const wallTop = main.id === host.id && index === topStorey && mainRoof ? round6(mainRoof.eaveY - mainRoof.thicknessM / Math.cos((mainRoof.pitchDeg * Math.PI) / 180)) : round6(l.elevation + l.height)
          const headY = round6(Math.min(l.elevation + l.height - slabT, wallTop - 0.2))
          const assembly = `corner-recess-${host.id}-${index}-${zSide.toLowerCase()}-${xSide.toLowerCase()}`
          const sid = sighting(entry.plan.frame, `a recess cut out of the ${zSide.toLowerCase()}-${xSide.toLowerCase()} corner on the storey ${index} plan`, 0.75)
          const featureId = feature('RECESS', assembly, { width: { value: notch.rect.x1 - notch.rect.x0, low: notch.rect.x1 - notch.rect.x0 - 0.05, high: notch.rect.x1 - notch.rect.x0 + 0.05 }, depth: { value: notch.rect.z1 - notch.rect.z0, low: notch.rect.z1 - notch.rect.z0 - 0.05, high: notch.rect.z1 - notch.rect.z0 + 0.05 }, headY: { value: headY, low: headY - 0.1, high: headY + 0.1 } }, [sid], 'SOURCE_DERIVED', notch.why, { storeyIndex: index, hostId: host.featureId, uncertaintyM: 0.05, parameterProvenance: { headY: 'ASSUMED_FOR_RENDERING' } })
          relate('HOSTED_BY', featureId, host.featureId, 'the recess is cut out of this body’s corner, under its roof')
          const callouts = metrics.evidence.filter((e) => e.kind === 'OPENING_CALLOUT' && e.frameId === entry.plan.frame.id)
          for (const spec of cornerPocketSpecs(notch, body, T)) {
            const { facade, from, to, mouthAt, backAt, openEnd, back } = spec
            // the facade's gaps over the mouth are the open side itself: taken off the openings, and named
            const over = openings.filter((o) => o.massId === host.id && o.facade === facade && o.storeyIndex === index && Math.min(o.interval[1], to) - Math.max(o.interval[0], from) > 0.5 * Math.min(o.widthM, to - from))
            for (const o of over) {
              openings.splice(openings.indexOf(o), 1)
              gap({ what: `the gap ${o.interval[0].toFixed(2)}..${o.interval[1].toFixed(2)} on the ${facade.toLowerCase()} wall of ${host.id}, storey ${index}`, reason: `it is the open side of ${assembly}: a passage, not a ${o.family.toLowerCase().replace(/_/g, ' ')}`, status: 'REFUSED', observationIds: [], evidenceIds: [] })
            }
            const id = `pocket-${host.id}-${index}-${pockets.length}`
            const backHost: WallHost = { massId: host.id, facade, planeAt: round6(back.faceAt), from: round6(back.from), to: round6(back.to), centreAt: round6(back.faceAt + (back.into * T) / 2), storeyIndex: index, floorY: l.elevation, storeyHeightM: l.height, endsAtFaces: true }
            const backOpenings = readWallOpenings({ ...(options.featureTrace ? { trace: options.featureTrace } : {}), plan: entry.frame, planRaster: entry.raster, host: backHost, wallThicknessM: T, callouts, views: [], attachedSingleStorey: false, onRefused: (r) => gap({ what: `the gap ${r.interval[0].toFixed(2)}..${r.interval[1].toFixed(2)} on the back wall of ${assembly}`, reason: r.why, status: 'REFUSED', observationIds: [], evidenceIds: [] }), index: hostIndex++ }).map((o) => ({ ...o, id: `${id}-${o.id}` }))
            const why = `${notch.why}; the ${facade.toLowerCase()} side ${from.toFixed(2)}..${to.toFixed(2)} is open through the corner under a head at the storey's ceiling (assumed: no elevation reads it), and ${backOpenings.length} opening${backOpenings.length === 1 ? '' : 's'} stand in the wall behind it`
            pockets.push({ id, massId: host.id, facade, storeyIndex: index, from, to, mouthAt, backAt, headY, headProvenance: 'ASSUMED_FOR_RENDERING', walls: [{ id: `${id}-back`, role: 'BACK', start: back.start, end: back.end, thicknessM: T }], backOpenings, openEnd, ...(spec.carriesPost && notch.post ? { post: notch.post } : {}), featureId, why })
          }
          step({ stage: 'pockets', what: `a recess cut out of a corner of ${host.id}, storey ${index}`, method: 'DIRECT', detail: notch.why, inputs: 2, outputs: 2 })
        }
      }
    }
  }
  step({ stage: 'pockets', what: 'recesses inside a body’s face', method: 'DISCRETE_SELECTION', detail: pockets.map((p) => `${p.facade} ${p.from.toFixed(2)}..${p.to.toFixed(2)}, ${Math.abs(p.backAt - p.mouthAt).toFixed(2)} m deep, ${p.backOpenings.length} back openings`).join('; ') || 'none', inputs: layout.recesses.length, outputs: pockets.length })
  for (const o of [...openings, ...sharedDoors]) {
    const entry = planByStorey.get(o.storeyIndex)
    const sids = entry ? [sighting(entry.plan.frame, `wall gap ${o.interval[0].toFixed(2)}..${o.interval[1].toFixed(2)} on the ${o.facade.toLowerCase()} wall`, 0.7, [], o.planGap.pixelRect)] : []
    if (o.elevation) {
      const f = frameById.get(o.elevation.frameId)
      if (f) sids.push(sighting(f, `opening extent on the ${o.facade.toLowerCase()} render`, o.elevation.confidence))
    }
    const printed = !!o.callout
    const mass = masses.find((m) => m.id === o.massId)
    feature('OPENING', o.id, { from: { value: o.interval[0], low: o.interval[0] - o.uncertaintyM, high: o.interval[0] + o.uncertaintyM }, width: { value: o.widthM, low: o.widthM - o.uncertaintyM, high: o.widthM + o.uncertaintyM }, sillY: { value: o.sillY, low: o.sillY - 0.1, high: o.sillY + 0.1 }, headY: { value: o.headY, low: o.headY - 0.1, high: o.headY + 0.1 } }, sids, o.provenance.head === 'SOURCE_CORROBORATED' ? 'SOURCE_CORROBORATED' : printed ? 'SOURCE_EXACT' : o.elevation ? 'IMAGE_METRIC_REGISTERED' : 'SOURCE_DERIVED', o.why, { storeyIndex: o.storeyIndex, hostId: mass?.featureId, printed, uncertaintyM: o.uncertaintyM, unresolvedProperties: o.unresolved, parameterProvenance: { sillY: o.provenance.sill, headY: o.provenance.head, width: o.provenance.width, profile: o.provenance.profile, family: o.provenance.family }, confidence: o.confidence })
    if (mass) relate('HOSTED_BY', `feat-${o.id}`, mass.featureId, `an opening in the ${o.facade.toLowerCase()} wall`)
    if (o.callout) record({ evidenceId: o.callout.evidenceId, evidenceKind: 'METRIC', what: `callout ${o.callout.widthCm}/${o.callout.heightCm}`, authority: 'HIGH', featureId: `feat-${o.id}`, disposition: 'USED_IN_MODEL', reason: 'the opening’s printed width and height', stage: 'METRIC_SOLVE' })
  }
  step({ stage: 'openings', what: 'openings cut from the plans, sized by callouts and elevations', method: 'DISCRETE_SELECTION', detail: `${openings.length} facade openings (${openings.filter((o) => o.callout).length} with a printed callout, ${openings.filter((o) => o.elevation).length} read on an elevation, ${openings.filter((o) => o.profile === 'RAKED_SINGLE').length} raked) and ${sharedDoors.length} doorway${sharedDoors.length === 1 ? '' : 's'} between bodies`, inputs: masses.length * 4, outputs: openings.length + sharedDoors.length })

  // ---------------------------------------------------------------------------
  // G6. roof details: attached roofs, chimneys, rooflights
  // ---------------------------------------------------------------------------
  const attachedRoofs: BuildingV2['attachedRoofs'] = []
  let sectionReg: ReturnType<typeof registerSection>
  if (sectionFrame) {
    const raster = options.raster(sectionFrame)
    const reg = metrics.coordinateRegistrations.find((r) => r.frameId === sectionFrame.id && r.plane === 'SECTION_HY')
    if (raster && reg) sectionReg = registerSection(raster, reg.metresPerPixelY, reg.originPx.y, [{ axis: 'X', from: world.envelope.x0, to: world.envelope.x1 }, { axis: 'Z', from: world.walled.z0, to: world.walled.z1 }], sectionFrame.id, ridgeY)
    options.debug?.(`section-registration ${sectionFrame.id} ladder ${reg ? `${reg.metresPerPixelY} m/px zero ${reg.originPx.y}` : 'none'} -> ${sectionReg ? `${sectionReg.mpp} m/px origin ${sectionReg.originCol} axis ${sectionReg.axis}` : 'none'}`)
    if (sectionReg) step({ stage: 'registration', what: 'section registered by its wall columns', method: 'DIRECT', detail: `${sectionReg.mpp.toFixed(6)} m/px, a cross-section along ${sectionReg.axis}`, inputs: 1, outputs: 1 })
    // 005Y: the main roof's eaves projection, where the section cuts across its ridge (its own walls give its scale).
    if (raster && mainRoof) {
      const f = mainRoof.footprint
      const across = mainRoof.ridgeAxis === 'X' ? f.z1 - f.z0 : f.x1 - f.x0
      const printed = metrics.evidence.filter((e) => e.kind === 'LEVEL_DATUM' && e.frameId === sectionFrame.id).map((e) => e.value)
      options.checkpoint?.tick({ subphase: ROOF_DETAILS_SUBPHASE })
      const eaves = readEavesOverhang(raster, across, { pitchDeg: mainRoof.pitchDeg, thicknessM: mainRoof.thicknessM }, reg ? { zeroRow: reg.originPx.y, mppY: reg.metresPerPixelY, printedLevels: printed } : undefined, options.debug)
      options.debug?.(`eaves: ${eaves ? eaves.why : 'no reading'}`)
      if (eaves) {
        mainRoof.eaves = { overhangM: eaves.overhangM, provenance: eaves.printedLipY !== undefined ? 'SOURCE_CORROBORATED' : 'IMAGE_METRIC_REGISTERED', why: eaves.why }
        step({ stage: 'roof-details', what: 'the eaves projection of the main roof, read on the section', method: 'DIRECT', detail: eaves.why, inputs: 1, outputs: 1 })
      } else gap({ what: 'the eaves projection of the main roof', reason: 'the section does not draw both eaves past the walls along a slope of the stated pitch, in agreement: the roof ends at the walls', status: 'AMBIGUOUS', observationIds: [], evidenceIds: [] })
    }
  }
  const pitchedAttachedRoofs: BuildingV2['pitchedAttachedRoofs'] = []
  for (const whole of masses.filter((x) => x.role === 'ATTACHED')) {
    const sup = layout.roofSupports.find((r) => r.massId === whole.sourceMassId)
    if (sup && sup.kind !== 'FLAT' && sup.kind !== 'UNKNOWN') continue
    const l = levelOf(Math.max(...whole.storeys))
    if (!l) continue
    // 005L (council B5L-4): the roof is over the top storey's own footprint. Where that storey stands on part of the
    // body only, the rest is covered by that storey's floor, the body's slab: a terrace, not a roof at the top's height.
    const m = { ...whole, ...rectAt(whole, Math.max(...whole.storeys)) }
    // The layout took this body's roof as flat by convention: the plans cannot
    // say otherwise. The elevations can, where they see the body against the sky.
    if (views.length > 0) {
      const mainWallTop = levelOf(topStorey)?.wallTop
      const stated = mainRoof && mainRoof.authority !== 'CONVENTION' ? mainRoof.pitchDeg : undefined
      const buildUp = mainRoof && mainWallTop !== undefined ? round6(Math.max(0, mainRoof.eaveY - mainWallTop)) : 0
      const occluders = [...masses.filter((x) => x.id !== m.id), ...(mainRoof ? [mainRoof.footprint] : [])]
      const form = readAttachedRoofForm({ views, body: m, wallTopY: l.wallTop, eaveBuildUpM: buildUp, statedPitchDeg: stated, occluders, ceilingY: (mainRoof?.ridgeY ?? l.wallTop) + 1.5, mainRoof, masks: skyMasks, debug: options.debug })
      step({ stage: 'roof-details', what: `the form of the roof over ${m.id}, read on the elevations`, method: 'DISCRETE_SELECTION', detail: `${form.kind}: ${form.why}${form.readings.length > 0 ? ` [${form.readings.map((r) => `${r.side.toLowerCase()} ${r.profile.toLowerCase()} ${r.riseM.toFixed(2)} m over ${r.samples} columns`).join('; ')}]` : ''}`, inputs: views.length, outputs: form.readings.length })
      if (form.kind === 'GABLE') {
        const eaveY = round6(l.wallTop + buildUp)
        const layoutOfRoof = attachedGableLayout(m, form.ridgeAxis, form.pitchDeg, eaveY, mainRoof)
        const sids = form.readings.filter((r) => r.profile !== 'LOW').map((r) => frameById.get(r.frameId)).filter((f): f is SourceCoordinateFrame => !!f).map((f) => sighting(f, `pitched roof over ${m.id}`, form.confidence))
        const pitchProvenance: ProvenanceStatus = form.pitchSource === 'STATED' ? 'SOURCE_DERIVED' : 'IMAGE_METRIC_REGISTERED'
        const featureId = feature('ATTACHED_ROOF', `roof-${m.id}`, { pitchDeg: { value: form.pitchDeg, low: form.pitchDeg - 1, high: form.pitchDeg + 1, unit: 'deg' }, eaveY: { value: eaveY, low: eaveY - 0.05, high: eaveY + 0.05 }, ridgeY: { value: layoutOfRoof.ridgeY, low: layoutOfRoof.ridgeY - 0.15, high: layoutOfRoof.ridgeY + 0.15 } }, sids, 'IMAGE_METRIC_REGISTERED', `${form.why}; ${layoutOfRoof.join.why}`, { hostId: m.featureId, uncertaintyM: 0.15, confidence: form.confidence, parameterProvenance: { pitchDeg: pitchProvenance, eaveY: 'SOURCE_DERIVED', ridgeY: 'SOURCE_DERIVED' } })
        relate('SUPPORTS', m.featureId, featureId, 'the body carries its roof')
        if (mainRoof && layoutOfRoof.join.kind === 'VALLEY') relate('MEETS_HOST', featureId, mainRoof.featureId, layoutOfRoof.join.why)
        pitchedAttachedRoofs.push({ massId: m.id, kind: 'GABLE', ridgeAxis: form.ridgeAxis, pitchDeg: form.pitchDeg, pitchSource: form.pitchSource, eaveY, ridgeY: layoutOfRoof.ridgeY, thicknessM: mainRoof?.thicknessM ?? CONVENTIONS.roofThickness, footprint: { x0: m.x0, z0: m.z0, x1: m.x1, z1: m.z1 }, layout: layoutOfRoof, form, featureId, provenance: 'IMAGE_METRIC_REGISTERED' })
        continue
      }
    }
    let reading: ReturnType<typeof readAttachedRoof>
    if (sectionReg && sectionFrame) {
      const raster = options.raster(sectionFrame)
      const span = sectionReg.axis === 'X' ? { from: m.x0, to: m.x1 } : { from: m.z0, to: m.z1 }
      if (raster) reading = readAttachedRoof(raster, sectionReg, m.id, span, l.elevation, l.wallTop + 1.5)
    }
    // Does the roof project over the zone in front of the body? The top storey plan draws its outline into the zone.
    const zoneInFront = recesses.find((r) => r.side === 'FRONT' && r.storeyIndex === topStorey)
    let projects = false
    const topPlan = planByStorey.get(topStorey)
    if (zoneInFront && topPlan && !m.storeys.includes(topStorey)) {
      // A drawn line near the zone's mouth across the body's width on the top storey's plan.
      const y = topPlan.frame.toPixel(m.x0, zoneInFront.mouthAt + 0.08).y
      const x0 = topPlan.frame.toPixel(m.x0 + 0.3, 0).x
      const x1 = topPlan.frame.toPixel(m.x1 - 0.3, 0).x
      let dark = 0
      let n = 0
      for (let px = Math.min(x0, x1); px <= Math.max(x0, x1); px += 1) {
        n += 1
        for (let dy = -5; dy <= 5; dy += 1) {
          const o = (Math.round(y + dy) * topPlan.raster.width + Math.round(px)) * 4
          const lum = 0.299 * topPlan.raster.data[o] + 0.587 * topPlan.raster.data[o + 1] + 0.114 * topPlan.raster.data[o + 2]
          if (lum < 205) {
            dark += 1
            break
          }
        }
      }
      projects = n > 0 && dark / n > 0.6
    }
    const slabTopY = reading ? reading.slabTopY : l.wallTop
    const slabSoffitY = reading ? reading.slabSoffitY : round6(l.wallTop - CONVENTIONS.roofThickness)
    const footprint = { x0: m.x0, x1: m.x1, z0: projects && zoneInFront ? zoneInFront.mouthAt : m.z0, z1: m.z1 }
    const sids = sectionFrame && reading ? [sighting(sectionFrame, `flat roof slab over ${m.id}`, reading.confidence)] : []
    if (projects && topPlan) sids.push(sighting(topPlan.plan.frame, `roof outline of ${m.id} reaching the zone`, 0.7))
    const featureId = feature('ATTACHED_ROOF', `roof-${m.id}`, { slabTopY: { value: slabTopY, low: slabTopY - 0.05, high: slabTopY + 0.05 }, ...(reading?.parapetTopY !== undefined ? { parapetTopY: { value: reading.parapetTopY, low: reading.parapetTopY - 0.05, high: reading.parapetTopY + 0.05 } } : {}) }, sids, reading ? 'SOURCE_EXACT' : 'ASSUMED_FOR_RENDERING', reading ? reading.why : 'no section draws this roof; its slab is taken at the storey top', { hostId: m.featureId, uncertaintyM: 0.04, unresolvedProperties: reading ? [] : ['slabTopY'], printed: !!reading })
    relate('SUPPORTS', m.featureId, featureId, 'the body carries its roof')
    attachedRoofs.push({ massId: m.id, reading, slabTopY, slabSoffitY, parapetTopY: reading?.parapetTopY, footprint, projectsOverZone: projects, featureId, provenance: reading ? 'SOURCE_EXACT' : 'ASSUMED_FOR_RENDERING' })
    if (reading) for (const e of levels.evidenceIds) record({ evidenceId: e, evidenceKind: 'METRIC', what: 'a level datum', authority: 'HIGH', disposition: 'USED_IN_MODEL', reason: 'the section scale the attached roof was read at', stage: 'METRIC_SOLVE' })
  }
  // Chimneys.
  const mainRoofTopY = (x: number, z: number): number => {
    if (!mainRoof) return levelsV2[levelsV2.length - 1].wallTop
    const tan = Math.tan((mainRoof.pitchDeg * Math.PI) / 180)
    const across = mainRoof.ridgeAxis === 'Z' ? x : z
    const half = mainRoof.ridgeAxis === 'Z' ? (main.x1 - main.x0) / 2 : (main.z1 - main.z0) / 2
    return mainRoof.ridgeY - Math.min(half, Math.abs(across - mainRoof.ridgeAt)) * tan
  }
  // 005Y-N3 (H4): a chimney rises through the roof over its block, which need not be the main one: a stack over a
  // garage's pitched roof, or in the valley where that roof runs into the main slope, stands on the highest roof
  // surface covering it there. Where no roof the solver built covers the point, the main roof's profile stands as before.
  const roofTopY = (x: number, z: number): number => hostRoofTopAt({ x, z }, { ...(mainRoof ? { main: { footprint: mainRoof.footprint, topAt: mainRoofTopY } } : {}), pitched: pitchedAttachedRoofs, flat: attachedRoofs }, mainRoofTopY)
  const chimneyViews = views.filter((v) => (mainRoof?.ridgeAxis === 'Z' ? v.view.side === 'FRONT' || v.view.side === 'REAR' : v.view.side === 'LEFT' || v.view.side === 'RIGHT'))
  // 005Y-N1: the section that confirms a chimney the plans show on one storey only: the ladder-registered one, or one
  // registered by two independent anchors for this alone (`registerSectionByTwoAnchors`).
  const chimneySection = ((): { section: SectionFrame; raster: Raster; why: string } | undefined => {
    const raster = sectionFrame ? options.raster(sectionFrame) : undefined
    if (!sectionFrame || !raster) return undefined
    if (sectionReg) return { section: sectionReg, raster, why: 'the section registered by its ladder of levels' }
    const levels = metrics.evidence
      .filter((e) => e.kind === 'LEVEL_DATUM' && e.frameId === sectionFrame.id && e.measuredGeometry?.type === 'SEGMENT')
      .map((e) => ({ value: e.value, row: (e.measuredGeometry as { a: { y: number } }).a.y, confidence: e.confidence }))
    // The walls' outer faces: the walled spans.
    const two = registerSectionByTwoAnchors(raster, levels, [{ axis: 'X', from: world.walled.x0, to: world.walled.x1 }, { axis: 'Z', from: world.walled.z0, to: world.walled.z1 }], sectionFrame.id)
    options.debug?.(`chimney-section ${two ? two.why : 'none'}`)
    return two ? { section: two.section, raster, why: two.why } : undefined
  })()
  // 005Y-N2 audit: every interior reading feeds the chimney reader — the filter that stood here (`masses.find(… || true)`)
  // always found a body and so kept every reading; it is gone, and nothing it passed is left out
  const chimneyReadings = readChimneys(interior.map((i) => ({ storeyIndex: i.storeyIndex, blocks: i.blocks })), chimneyViews, roofTopY, options.featureTrace).flatMap((c) => {
    if (c.renderFrames.length > 0 || c.storeysSeen.length >= 2) return [c]
    // 005Y-N1: a block on one storey only, above the roof on no registered render, stands when the section draws a stack
    // over it above the roof — the section is a drawing of the house, as the plans are.
    const s = chimneySection
    const stack = s ? sectionStackOver(s.raster, s.section, s.section.axis === 'X' ? { from: c.x0, to: c.x1 } : { from: c.z0, to: c.z1 }, roofTopY((c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2)) : undefined
    options.featureTrace?.({ kind: 'CHIMNEY_BLOCK', rect: { x0: c.x0, z0: c.z0, x1: c.x1, z1: c.z1 }, section: s ? { frameId: s.section.frameId, axis: s.section.axis, why: s.why } : null, stack: stack ?? null, decision: stack ? 'READ' : 'REJECTED', reason: stack ? `the section draws a stack ${stack.heightM} m above the roof over it` : `seen on one storey and above the roof on no registered render${s ? ', and the section draws no stack over it' : ', and no section is registered'}` })
    if (!stack || !s) return []
    return [{ ...c, topY: stack.topY, sectionFrameId: s.section.frameId, why: `${c.why}; the section draws its stack ${stack.heightM} m above the roof, to ${stack.topY.toFixed(2)} m` }]
  })
  const chimneys: BuildingV2['chimneys'] = chimneyReadings.map((c) => {
    const sids = c.storeysSeen.map((s) => planByStorey.get(s)).filter((e): e is NonNullable<typeof e> => !!e).map((e) => sighting(e.plan.frame, 'solid block of a chimney', 0.7, [], undefined))
    for (const f of c.renderFrames) {
      const frame = frameById.get(f)
      if (frame) sids.push(sighting(frame, 'chimney above the roof line', 0.7))
    }
    if (c.sectionFrameId && sectionFrame && sectionFrame.id === c.sectionFrameId) sids.push(sighting(sectionFrame, 'chimney stack above the roof on the section', 0.6))
    const featureId = feature('CHIMNEY', c.id, { x0: { value: c.x0, low: c.x0 - 0.06, high: c.x0 + 0.06 }, z0: { value: c.z0, low: c.z0 - 0.06, high: c.z0 + 0.06 }, ...(c.topY !== undefined ? { topY: { value: c.topY, low: c.topY - 0.1, high: c.topY + 0.1 } } : {}) }, sids, c.renderFrames.length > 0 ? 'SOURCE_CORROBORATED' : 'SOURCE_DERIVED', c.why, { uncertaintyM: 0.06, unresolvedProperties: c.topY === undefined ? ['topY'] : [], parameterProvenance: { topY: c.topY === undefined ? 'ASSUMED_FOR_RENDERING' : 'IMAGE_METRIC_REGISTERED' } })
    if (c.storeysSeen.length >= 2) relate('SAME_FEATURE_AS', sids[0], sids[1], 'the same block on both storeys’ plans')
    return { ...c, featureId, provenance: c.renderFrames.length > 0 ? 'SOURCE_CORROBORATED' : 'SOURCE_DERIVED' }
  })
  // Rooflights on the side renders.
  const rooflights: BuildingV2['rooflights'] = []
  const planRooflights: PlanRooflightReading[] = []
  const renderRooflights: Array<RooflightReading & { frameIds: string[] }> = []
  if (mainRoof) {
    // 005W-N1: a band-registered view stands for the roof only where its own facade's walls confirmed it: the plan's gaps
    // read on it as openings closed by wall above (readWallOpenings' per-wall check, at least two gaps).
    const confirmedBand = openingOnlyViews.filter((v) => acceptedBandViews.has(v.view.registration.frameId))
    for (const v of [...views, ...confirmedBand]) {
      const eaveSide = mainRoof.ridgeAxis === 'Z' ? (v.view.side === 'LEFT' ? 'LOW' : v.view.side === 'RIGHT' ? 'HIGH' : undefined) : v.view.side === 'FRONT' ? 'LOW' : v.view.side === 'REAR' ? 'HIGH' : undefined
      if (!eaveSide) continue
      const eaveAlong = mainRoof.ridgeAxis === 'Z' ? (eaveSide === 'LOW' ? main.x0 : main.x1) : eaveSide === 'LOW' ? main.z0 : main.z1
      const walledAlong = mainRoof.ridgeAxis === 'Z' ? { from: world.walled.z0, to: world.walled.z1 } : { from: world.walled.x0, to: world.walled.x1 }
      options.checkpoint?.tick({ subphase: ROOF_DETAILS_SUBPHASE })
      const found = readRooflights(v.view, v.raster, { eaveY: mainRoof.eaveY, ridgeY: mainRoof.ridgeY, pitchDeg: mainRoof.pitchDeg, eaveAlong, ridgeAlong: mainRoof.ridgeAt, slope: eaveSide }, walledAlong, options.debug)
      for (const r of found) {
        // Not a chimney: the patch does not overlap a chimney block's run along the ridge on this slope.
        const chimneyThere = chimneys.some((c) => {
          const along = mainRoof.ridgeAxis === 'Z' ? [c.z0, c.z1] : [c.x0, c.x1]
          const across = mainRoof.ridgeAxis === 'Z' ? (c.x0 + c.x1) / 2 : (c.z0 + c.z1) / 2
          const onThisSlope = eaveSide === 'LOW' ? across < mainRoof.ridgeAt : across > mainRoof.ridgeAt
          return onThisSlope && Math.min(along[1], r.alongTo) - Math.max(along[0], r.alongFrom) > -0.05
        })
        if (chimneyThere) continue
        renderRooflights.push({ ...r, frameIds: [r.frameId] })
      }
    }
    // 005X: the rooflights the plan of the storey under the main roof states. The plan says that a rooflight is there, on
    // which slope, where along the ridge and how big; a render only confirms it (or adds one the plan does not state, as
    // before). 005X-N2: the plan is read for them whether or not a render shows one — the plan is the ground, a render
    // only confirms (DEC-UNIVERSAL-OPENING-CORE-003); 005X-N1 had made the reading wait on a render's patch. Reading the
    // callout rings stays the costliest step of the run: the ring search is narrowed by a pooled test that cannot rule
    // out a ring the full test would find (`readTintedCallouts` prefilter), the reading of the candidates is not.
    const topEntry = mainRoof.kind === 'GABLE' ? planByStorey.get(topStorey) : undefined
    if (topEntry) {
      const r = rectAt(main, topStorey)
      const a = topEntry.frame.toPixel(r.x0, r.z1)
      const b = topEntry.frame.toPixel(r.x1, r.z0)
      const region = { x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) }
      const mpp = (topEntry.frame.mppX + topEntry.frame.mppY) / 2
      // 005Y-N1: a ring the metric reading's recogniser read reads what it read (`withRecognisedHalves`).
      const callouts = withRecognisedHalves(readTintedCallouts(topEntry.raster, { region, frameId: topEntry.frame.frameId, minRadiusPx: Math.max(6, 0.15 / mpp), maxRadiusPx: Math.max(10, 0.45 / mpp), requireBar: true, ...(options.checkpoint ? { checkpoint: options.checkpoint } : {}) }), topEntry.frame.frameId, metrics.calloutRings)
      for (const c of callouts) { const w = topEntry.frame.toWorld(c.circle.cx, c.circle.cy); options.debug?.(`plan-rooflight ring ${c.widthCm}/${c.heightCm} bar ${!!c.bar} at px ${c.circle.cx.toFixed(0)},${c.circle.cy.toFixed(0)} world ${w.x.toFixed(2)},${w.z.toFixed(2)} body ${r.x0},${r.z0}..${r.x1},${r.z1}`) }
      planRooflights.push(...readPlanRooflights(callouts, topEntry.frame, r, T, { ridgeAxis: mainRoof.ridgeAxis, ridgeAt: mainRoof.ridgeAt, pitchDeg: mainRoof.pitchDeg, eaveY: mainRoof.eaveY }, options.featureTrace, topEntry.raster))
      options.debug?.(`plan-rooflights ${callouts.length} rings, ${planRooflights.length} rooflights, ${renderRooflights.length} render patches`)
      step({ stage: 'roof-details', what: 'rooflights stated by the plan under the roof', method: 'DIRECT', detail: `${callouts.length} callout ring${callouts.length === 1 ? '' : 's'} inside the storey, ${planRooflights.length} read as rooflights`, inputs: callouts.length, outputs: planRooflights.length })
    }
    const overlapsAlong = (p: { alongFrom: number; alongTo: number }, q: { alongFrom: number; alongTo: number }): boolean => Math.min(p.alongTo, q.alongTo) - Math.max(p.alongFrom, q.alongFrom) > 0.5 * Math.min(p.alongTo - p.alongFrom, q.alongTo - q.alongFrom)
    const chimneyAt = (r: { alongFrom: number; alongTo: number; slopeFrom: number; slopeTo: number }): boolean =>
      chimneys.some((c) => {
        const along = mainRoof.ridgeAxis === 'Z' ? [c.z0, c.z1] : [c.x0, c.x1]
        const across = mainRoof.ridgeAxis === 'Z' ? [c.x0, c.x1] : [c.z0, c.z1]
        return Math.min(along[1], r.alongTo) - Math.max(along[0], r.alongFrom) > 0 && Math.min(across[1], Math.max(r.slopeFrom, r.slopeTo)) - Math.max(across[0], Math.min(r.slopeFrom, r.slopeTo)) > 0
      })
    // Plan rooflights, each confirmed where a render shows a patch on the same slope over the same stretch of ridge.
    for (const p of planRooflights) {
      if (chimneyAt(p)) continue
      const seen = renderRooflights.filter((r) => r.slope === p.slope && overlapsAlong(p, r))
      const sids = [sighting((topEntry as NonNullable<typeof topEntry>).plan.frame, 'a rooflight callout inside the storey under the roof', p.confidence)]
      for (const r of seen) {
        const frame = frameById.get(r.frameId)
        if (frame) sids.push(sighting(frame, 'a light patch in the roof plane over the same stretch of ridge', r.confidence))
      }
      const provenance: ProvenanceStatus = seen.length > 0 ? 'SOURCE_CORROBORATED' : 'SOURCE_DERIVED'
      const why = `${p.why}${seen.length > 0 ? `; a render shows it on the same slope (${seen.map((r) => r.id).join(', ')})` : '; no render confirms it (watermark, contrast or no registered view of that slope)'}`
      const featureId = feature('ROOFLIGHT', p.id, { along: { value: p.alongFrom, low: p.alongFrom - 0.1, high: p.alongFrom + 0.1 }, width: { value: p.widthM, low: p.widthM - 0.05, high: p.widthM + 0.05 }, length: { value: p.lengthM, low: p.lengthM - 0.05, high: p.lengthM + 0.05 } }, sids, provenance, why, { uncertaintyM: 0.1, unresolvedProperties: ['exact position up the slope'] })
      rooflights.push({ ...p, why, featureId, provenance })
    }
    // A patch no plan rooflight explains stays what it was: a rooflight read on a render alone.
    for (const r of renderRooflights) {
      if (rooflights.some((p) => p.slope === r.slope && overlapsAlong(p, r))) continue
      const frame = frameById.get(r.frameId)
      const sid = frame ? [sighting(frame, 'a light patch in the roof plane', r.confidence)] : []
      const widthM = round6(r.alongTo - r.alongFrom)
      const lengthM = round6(Math.hypot(r.slopeTo - r.slopeFrom, r.yTo - r.yFrom))
      const featureId = feature('ROOFLIGHT', r.id, { along: { value: r.alongFrom, low: r.alongFrom - 0.1, high: r.alongFrom + 0.1 }, width: { value: widthM, low: widthM - 0.1, high: widthM + 0.1 }, length: { value: lengthM, low: lengthM - 0.15, high: lengthM + 0.15 } }, sid, 'IMAGE_METRIC_REGISTERED', r.why, { uncertaintyM: 0.1, unresolvedProperties: ['exact position up the slope'] })
      rooflights.push({ ...r, featureId, provenance: 'IMAGE_METRIC_REGISTERED', widthM, lengthM })
    }
  }
  step({ stage: 'roof-details', what: 'attached roofs, chimneys, rooflights', method: 'DISCRETE_SELECTION', detail: `${attachedRoofs.length} attached roof${attachedRoofs.length === 1 ? '' : 's'} (${attachedRoofs.filter((r) => r.reading).length} from the section), ${chimneys.length} chimney${chimneys.length === 1 ? '' : 's'}, ${rooflights.length} rooflight${rooflights.length === 1 ? '' : 's'}`, inputs: views.length, outputs: attachedRoofs.length + chimneys.length + rooflights.length })

  // ---------------------------------------------------------------------------
  // I. secondary assemblies: verges, balconies with fascias, railings, portal heads, terraces
  // ---------------------------------------------------------------------------
  const verges: BuildingV2['verges'] = []
  const balconies: BuildingV2['balconies'] = []
  const railings: BuildingV2['railings'] = []
  const portalHeads: BuildingV2['portalHeads'] = []
  const assemblies: FacadeAssemblyHypothesis[] = []
  const members: FacadeMember[] = []
  if (mainRoof && mainRoof.ridgeAxis === 'Z') {
    for (const side of ['FRONT', 'REAR'] as const) {
      const recess = recesses.find((r) => r.side === side && r.storeyIndex === topStorey) ?? recesses.find((r) => r.side === side)
      for (const v of viewsOf(side)) {
        const member = readVergeMember(v.raster, v.view, { along0: main.x0, along1: main.x1, ridgeAlong: mainRoof.ridgeAt, eaveY: mainRoof.eaveY, ridgeY: mainRoof.ridgeY }, recess)
        if (!member) continue
        members.push(member)
        const frame = frameById.get(v.view.registration.frameId)
        const sids = frame ? [sighting(frame, 'verge band along the rake', member.confidence)] : []
        const featureId = feature('ROOF_MEMBER', member.id, { width: { value: member.widthM ?? 0.5, low: (member.widthM ?? 0.5) - 0.08, high: (member.widthM ?? 0.5) + 0.08 } }, sids, recess && recess.returns.length > 0 ? 'SOURCE_CORROBORATED' : 'IMAGE_METRIC_REGISTERED', member.why, { uncertaintyM: 0.06, unresolvedProperties: ['depth'], parameterProvenance: { depth: 'ASSUMED_FOR_RENDERING' } })
        verges.push({ id: member.id, side, planeAt: side === 'FRONT' ? world.envelope.z0 : world.envelope.z1, member, depthM: 0.3, featureId, provenance: recess && recess.returns.length > 0 ? 'SOURCE_CORROBORATED' : 'IMAGE_METRIC_REGISTERED' })
        // The assembly: returns + verge = the gable frame.
        const frameReturns = returns.filter((r) => r.side === side)
        if (frameReturns.length > 0) {
          const id = `assembly-gable-${side.toLowerCase()}`
          assemblies.push({ id, facadeId: side, kind: 'GABLE_FRAME', memberHypothesisIds: [featureId, ...frameReturns.map((r) => r.featureId)], planeOffsets: { [featureId]: 0, ...Object.fromEntries(frameReturns.map((r) => [r.featureId, 0])) }, evidenceIds: sids, continuityRelations: frameReturns.map((r) => ({ from: r.featureId, to: featureId, kind: 'CONTINUES_AS' as const })), confidence: round6(Math.min(member.confidence, 0.85)), why: `the returns of the ${side.toLowerCase()} recess continue as the verge band along the rakes in the same plane` })
          for (const r of frameReturns) relate('CONTINUES_AS', r.featureId, featureId, 'the return continues into the verge member')
          const fa = feature('FACADE_ASSEMBLY', id, {}, sids, 'SOURCE_CORROBORATED', assemblies[assemblies.length - 1].why, { unresolvedProperties: [] })
          for (const r of frameReturns) relate('PART_OF', r.featureId, fa, 'a member of the gable frame')
          relate('PART_OF', featureId, fa, 'a member of the gable frame')
        }
        break
      }
    }
  }
  // Balconies: an upper-storey recess with a slab across its open interval, read as a fascia at the floor level on the render.
  for (const recess of recesses.filter((r) => r.storeyIndex > 0)) {
    const l = levelOf(recess.storeyIndex)
    const lower = recesses.find((r) => r.side === recess.side && r.storeyIndex === recess.storeyIndex - 1)
    if (!l) continue
    for (const v of viewsOf(recess.side)) {
      for (const open of recess.open) {
        const fascia = readFasciaBand(v.raster, v.view, { along0: open.from, along1: open.to }, l.elevation, recess.mouthAt)
        if (!fascia) continue
        // Where along the mouth the fascia actually runs: the columns that carry the band.
        const extent = fasciaExtent(v.raster, v.view, open, fascia.y)
        if (!extent) continue
        members.push(fascia)
        const frame = frameById.get(v.view.registration.frameId)
        const sids = frame ? [sighting(frame, 'balcony fascia band', fascia.confidence)] : []
        const plan = planByStorey.get(recess.storeyIndex)
        if (plan) sids.push(sighting(plan.plan.frame, 'balcony floor in the zone', 0.6))
        const thickness = round6(fascia.y[1] - fascia.y[0])
        const topY = round6(Math.min(l.elevation + 0.05, fascia.y[1]))
        const id = `balcony-${recess.side.toLowerCase()}-${recess.storeyIndex}`
        const featureId = feature('BALCONY', id, { from: { value: extent.from, low: extent.from - 0.1, high: extent.from + 0.1 }, to: { value: extent.to, low: extent.to - 0.1, high: extent.to + 0.1 }, topY: { value: topY, low: topY - 0.05, high: topY + 0.05 }, thickness: { value: thickness, low: thickness - 0.08, high: thickness + 0.08 } }, sids, 'IMAGE_METRIC_REGISTERED', `${fascia.why}; the slab top is the storey floor`, { storeyIndex: recess.storeyIndex, uncertaintyM: 0.05, unresolvedProperties: ['slab section (fascia only)'] })
        const z0 = recess.side === 'FRONT' ? recess.mouthAt : recess.backAt
        const z1 = recess.side === 'FRONT' ? recess.backAt : recess.mouthAt
        balconies.push({ id, kind: 'BALCONY', side: recess.side, storeyIndex: recess.storeyIndex, x0: extent.from, z0: Math.min(z0, z1), x1: extent.to, z1: Math.max(z0, z1), topY, thicknessM: thickness, fascia, featureId, provenance: 'IMAGE_METRIC_REGISTERED', why: fascia.why })
        const rail = readRailing(v.raster, v.view, { along0: extent.from, along1: extent.to }, topY, recess.mouthAt)
        if (rail) {
          const rid = `railing-${recess.side.toLowerCase()}-${recess.storeyIndex}`
          const rf = feature('RAILING', rid, { height: { value: rail.y[1] - rail.y[0], low: rail.y[1] - rail.y[0] - 0.08, high: rail.y[1] - rail.y[0] + 0.08 } }, sids, 'IMAGE_METRIC_REGISTERED', rail.why, { storeyIndex: recess.storeyIndex, hostId: featureId, uncertaintyM: 0.05, unresolvedProperties: ['post spacing'] })
          relate('SUPPORTS', featureId, rf, 'the balustrade stands on the slab')
          const zr = recess.side === 'FRONT' ? recess.mouthAt + 0.05 : recess.mouthAt - 0.05
          railings.push({ id: rid, storeyIndex: recess.storeyIndex, start: { x: round6(extent.from + 0.05), z: round6(zr) }, end: { x: round6(extent.to - 0.05), z: round6(zr) }, baseY: topY, heightM: round6(rail.y[1] - rail.y[0]), featureId: rf, provenance: 'IMAGE_METRIC_REGISTERED', why: rail.why })
        }
        // A fascia that runs on past the balcony over an attached body's zone is that body's roof edge: the portal head.
        for (const m of masses.filter((x) => x.role === 'ATTACHED')) {
          const roof = attachedRoofs.find((r) => r.massId === m.id)
          if (!roof || !roof.projectsOverZone) continue
          // The head belongs to the side the roof projects towards: the zone in front of the body.
          if (recess.side !== 'FRONT' || portalHeads.some((h) => h.massId === m.id)) continue
          const across = fasciaExtent(v.raster, v.view, { from: m.x0, to: m.x1 }, fascia.y)
          if (!across || across.to - across.from < (m.x1 - m.x0) * 0.6) continue
          const pid = `portal-head-${m.id}`
          const pf = feature('FACADE_MEMBER', pid, { y0: { value: fascia.y[0], low: fascia.y[0] - 0.05, high: fascia.y[0] + 0.05 }, y1: { value: fascia.y[1], low: fascia.y[1] - 0.05, high: fascia.y[1] + 0.05 } }, sids, 'SOURCE_CORROBORATED', `the fascia band continues across ${m.id}’s zone at the same level: the projecting roof’s edge`, { uncertaintyM: 0.05 })
          relate('CONTINUES_AS', featureId, pf, 'the balcony fascia continues as the portal head')
          relate('SUPPORTS', m.featureId, pf, 'the attached body carries the head')
          portalHeads.push({ id: pid, massId: m.id, x0: m.x0, x1: m.x1, z0: roof.footprint.z0, z1: lower ? lower.backAt : roof.footprint.z0 + 1, y0: fascia.y[0], y1: fascia.y[1], continuesFromId: id, featureId: pf, provenance: 'SOURCE_CORROBORATED', why: `the roof of ${m.id} projects over its zone; its edge is the ${(fascia.y[1] - fascia.y[0]).toFixed(2)} m band` })
          assemblies.push({ id: `assembly-portal-${m.id}`, facadeId: recess.side, kind: 'PORTAL_FRAME', memberHypothesisIds: [pf, featureId, ...returns.filter((r) => r.side === recess.side && r.storeyIndex === 0).map((r) => r.featureId)], planeOffsets: {}, evidenceIds: sids, continuityRelations: [{ from: featureId, to: pf, kind: 'CONTINUES_AS' }], confidence: 0.7, why: 'the balcony fascia, the projecting roof edge and the ground-storey returns frame the portal' })
        }
        break
      }
    }
  }
  // 005Y-N7 (C): balconies that stand proud of the wall: the outline the plan of the storey draws beyond a face, in
  // front of floor-level doors, closed back to the face at both ends (projecting-balcony.ts)
  for (const [storey, plan] of [...planByStorey].sort(([a], [b]) => a - b)) {
    const l = levelOf(storey)
    if (storey === 0 || !l) continue
    for (const group of floorLevelDoorGroups(openings, storey, l.elevation).flatMap((g) => doorSpanCandidates(g, openings))) {
      if (balconies.some((b) => b.storeyIndex === storey && b.side === group.side)) continue
      const mass = masses.find((m) => m.id === group.massId)
      if (!mass) continue
      const wallSpan: [number, number] = group.side === 'FRONT' || group.side === 'REAR' ? [mass.x0, mass.x1] : [mass.z0, mass.z1]
      const outline = readBalconyOutline(plan.raster, plan.frame, group.side, group.planeAt, group.span, wallSpan, (why) => options.debug?.(`proud-balcony ${group.side} storey ${storey} doors ${group.span.join('..')} face ${group.planeAt}: ${why}`))
      if (!outline) continue
      const rect = balconyRect(group.side, group.planeAt, outline)
      const id = `balcony-${group.side.toLowerCase()}-${storey}-proud`
      const sids = [sighting(plan.plan.frame, 'balcony outline beyond the face', 0.75)]
      const featureId = feature('BALCONY', id, { from: { value: outline.from, low: outline.from - 0.05, high: outline.from + 0.05 }, to: { value: outline.to, low: outline.to - 0.05, high: outline.to + 0.05 }, reach: { value: outline.reach, low: outline.reach - 0.05, high: outline.reach + 0.05 } }, sids, 'SOURCE_DERIVED', `${outline.why}; it opens from ${group.openingIds.join(', ')}`, { storeyIndex: storey, uncertaintyM: 0.05, unresolvedProperties: ['slab thickness', 'balustrade height and infill'], parameterProvenance: { thickness: 'ASSUMED_FOR_RENDERING' } })
      balconies.push({ id, kind: 'BALCONY', side: group.side, storeyIndex: storey, ...rect, topY: l.elevation, thicknessM: BALCONY_SLAB_ASSUMED_M, projecting: true, featureId, provenance: 'SOURCE_DERIVED', why: `${outline.why}; the slab is ${BALCONY_SLAB_ASSUMED_M} m thick and its balustrade ${BALUSTRADE_HEIGHT_ASSUMED_M} m high for viewing (DISPLAY_ASSUMPTION: a plan draws neither)` })
      const path = balustradePath(group.side, group.planeAt, outline)
      const rid = `railing-${group.side.toLowerCase()}-${storey}-proud`
      const rf = feature('RAILING', rid, { height: { value: BALUSTRADE_HEIGHT_ASSUMED_M, low: 0.9, high: 1.2 } }, sids, 'SOURCE_DERIVED', 'the balustrade round the outline’s three free edges', { storeyIndex: storey, hostId: featureId, uncertaintyM: 0.05, unresolvedProperties: ['height (assumed)', 'infill'], parameterProvenance: { height: 'ASSUMED_FOR_RENDERING' } })
      relate('SUPPORTS', featureId, rf, 'the balustrade stands on the slab')
      relate('MEETS_HOST', featureId, mass.featureId, 'the slab projects from this body’s face at its floor')
      railings.push({ id: rid, storeyIndex: storey, start: path[0], end: path[path.length - 1], path, hostId: id, baseY: l.elevation, heightM: BALUSTRADE_HEIGHT_ASSUMED_M, featureId: rf, provenance: 'SOURCE_DERIVED', why: `round the three free edges of ${id}; ${BALUSTRADE_HEIGHT_ASSUMED_M} m high for viewing (DISPLAY_ASSUMPTION)` })
      step({ stage: 'facade', what: `a balcony standing proud of the ${group.side.toLowerCase()} face, storey ${storey}`, method: 'DIRECT', detail: outline.why, inputs: group.openingIds.length, outputs: 1 })
    }
  }
  // Terraces: the recess floors at the ground storey, and the outlined platform beyond the mouth where the plan draws one.
  const terraces: TerraceV2[] = []
  const groundPlan = planByStorey.get(0)
  for (const recess of recesses.filter((r) => r.storeyIndex === 0)) {
    const l = levelOf(0)
    if (!l) continue
    const ax = recess.side === 'FRONT' || recess.side === 'REAR'
    for (const open of recess.open) {
      const id = `terrace-${recess.side.toLowerCase()}-${Math.round(open.from * 100)}`
      const floorRect = ax ? { x0: open.from, x1: open.to, z0: Math.min(recess.mouthAt, recess.backAt), z1: Math.max(recess.mouthAt, recess.backAt) } : { x0: Math.min(recess.mouthAt, recess.backAt), x1: Math.max(recess.mouthAt, recess.backAt), z0: open.from, z1: open.to }
      // The platform beyond the mouth, across the recess's whole span (returns included).
      const ext = groundPlan ? readTerraceExtension(groundPlan.raster, groundPlan.frame, recess.side, recess.mouthAt, [recess.spanFrom, recess.spanTo]) : undefined
      // A platform that would run into another body is not this terrace's.
      const extClear = ext && !masses.some((m) => {
        const far = recess.mouthAt + (recess.side === 'FRONT' || recess.side === 'WEST' ? -1 : 1) * ext.reach
        const c0 = Math.min(recess.mouthAt, far)
        const c1 = Math.max(recess.mouthAt, far)
        return ax ? m.x0 < ext.to - 0.05 && m.x1 > ext.from + 0.05 && m.z0 < c1 - 0.05 && m.z1 > c0 + 0.05 : m.z0 < ext.to - 0.05 && m.z1 > ext.from + 0.05 && m.x0 < c1 - 0.05 && m.x1 > c0 + 0.05
      })
      const extension = ext && extClear ? ext : undefined
      const polygon = terracePolygon(recess.side, recess.mouthAt, recess.backAt, [open.from, open.to], extension)
      const drawn = groundPlan ? drawnShareOf(groundPlan.raster, groundPlan.frame, floorRect) : 0
      const plinth = terrain !== undefined ? round6(l.elevation - terrain) : 0.15
      const sids = groundPlan ? [sighting(groundPlan.plan.frame, extension ? 'the recess floor and the outlined platform beyond its mouth' : 'the recess floor', extension ? 0.8 : 0.6)] : []
      if (sectionFrame && terrain !== undefined) sids.push(sighting(sectionFrame, 'terrain datum', 0.8))
      const massIds = masses.filter((m) => m.storeys.includes(0) && (recess.side === 'FRONT' ? Math.abs(m.z0 - recess.backAt) < 0.1 && m.x0 < open.to && m.x1 > open.from : recess.side === 'REAR' ? Math.abs(m.z1 - recess.backAt) < 0.1 && m.x0 < open.to && m.x1 > open.from : recess.side === 'WEST' ? Math.abs(m.x0 - recess.backAt) < 0.1 && m.z0 < open.to && m.z1 > open.from : Math.abs(m.x1 - recess.backAt) < 0.1 && m.z0 < open.to && m.z1 > open.from)).map((m) => m.id)
      const provenance: ProvenanceStatus = 'SOURCE_DERIVED'
      const featureId = feature('TERRACE', id, { topY: { value: l.elevation, low: l.elevation - 0.02, high: l.elevation + 0.02 }, thickness: { value: plinth, low: plinth - 0.05, high: plinth + 0.05 }, ...(extension ? { reach: { value: extension.reach, low: extension.reach - 0.05, high: extension.reach + 0.05 } } : {}) }, sids, provenance, extension ? `the recess floor, continuing ${extension.reach.toFixed(2)} m past the mouth to the outline the plan draws (${extension.why})` : 'the recess floor at the threshold', { storeyIndex: 0, unresolvedProperties: terrain === undefined ? ['thickness (the terrain datum was not read)'] : [], parameterProvenance: { thickness: terrain === undefined ? 'ASSUMED_FOR_RENDERING' : 'SOURCE_DERIVED' } })
      terraces.push({ id, storeyIndex: 0, side: recess.side, polygon, topY: l.elevation, thicknessM: plinth, surface: extension || drawn >= 0.3 ? 'PAVED' : 'UNKNOWN', edge: plinth > 0.05 ? 'PLINTH' : 'FLUSH', massIds, ...(extension && groundPlan ? { extension: { from: extension.from, to: extension.to, reach: extension.reach, frameId: groundPlan.plan.frame.id, why: extension.why } } : {}), featureId, provenance, why: extension ? `the floor of the ${recess.side.toLowerCase()} recess and the platform the plan outlines beyond it` : `the floor of the ${recess.side.toLowerCase()} recess` })
      for (const m of massIds) relate('MEETS_HOST', featureId, masses.find((x) => x.id === m)?.featureId ?? m, 'the terrace lies against this body at its threshold')
    }
  }
  // 005Q (N1, review round 1): a platform the plan outlines beyond a wall strip would start from the wall's outer face,
  // which is unresolved; it is named, never built (no recess is read in the strip to carry it)
  if (groundPlan && levelOf(0)) {
    for (const zone of layout.footprintRegions.filter((r) => r.kind === 'ZONE' && isWallStripZone(r.id, layout.unresolved))) {
      const side = sideOfZone(zone.id)
      if (!side) continue
      const zb = ringBounds(zone.ring)
      const zoneV2 = { x0: zb.x0, x1: zb.x1, z0: flipZ(world, zb.z1), z1: flipZ(world, zb.z0) }
      const mouthAt = side === 'FRONT' ? zoneV2.z0 : side === 'REAR' ? zoneV2.z1 : side === 'WEST' ? zoneV2.x0 : zoneV2.x1
      const backAt = side === 'FRONT' ? zoneV2.z1 : side === 'REAR' ? zoneV2.z0 : side === 'WEST' ? zoneV2.x1 : zoneV2.x0
      // across the ground-storey bodies whose face stands on the strip's back, as the recess reading probes (review round 2)
      const standing = masses.filter((m) => m.storeys.includes(0) && (side === 'FRONT' ? Math.abs(m.z0 - backAt) : side === 'REAR' ? Math.abs(m.z1 - backAt) : side === 'WEST' ? Math.abs(m.x0 - backAt) : Math.abs(m.x1 - backAt)) < 0.15)
      if (standing.length === 0) continue
      const along = side === 'FRONT' || side === 'REAR'
      const span: [number, number] = [Math.min(...standing.map((m) => (along ? m.x0 : m.z0))), Math.max(...standing.map((m) => (along ? m.x1 : m.z1)))]
      const ext = readTerraceExtension(groundPlan.raster, groundPlan.frame, side, mouthAt, span)
      if (ext) gap({ what: `the platform the plan outlines beyond the ${side.toLowerCase()} wall`, reason: `an outline ${ext.reach.toFixed(2)} m out from the plan's extent (${ext.why}) lies beyond a wall the body was cut short of; it is not built: the wall's outer face it would start from is unresolved`, status: 'AMBIGUOUS', observationIds: [], evidenceIds: [] })
    }
  }
  // 005Y-N7 (C): a pergola beside the house: posts the ground plan draws as solid squares on the corners of a frame
  // against a face (pergola.ts); its height and beams are assumed for viewing, and named
  const pergolas: NonNullable<BuildingV2['pergolas']> = []
  const groundLevel = levelOf(0)
  const mainGround = masses.find((m) => m.role === 'MAIN' && m.storeys.includes(0))
  if (groundPlan && groundLevel && mainGround) {
    const body = rectAt(mainGround, 0)
    const posts = findPosts(groundPlan.raster, groundPlan.frame, body).filter((p) => !masses.some((m) => m.storeys.includes(0) && (p.x0 + p.x1) / 2 > rectAt(m, 0).x0 - 0.05 && (p.x0 + p.x1) / 2 < rectAt(m, 0).x1 + 0.05 && (p.z0 + p.z1) / 2 > rectAt(m, 0).z0 - 0.05 && (p.z0 + p.z1) / 2 < rectAt(m, 0).z1 + 0.05))
    options.debug?.(`pergola posts ${posts.map((p) => `${((p.x0 + p.x1) / 2).toFixed(2)},${((p.z0 + p.z1) / 2).toFixed(2)}`).join(' ')}`)
    const reading = pergolaFromPosts(posts, body)
    if (reading) {
      const id = `pergola-${reading.side.toLowerCase()}`
      const topY = round6(groundLevel.elevation + PERGOLA_HEIGHT_ASSUMED_M)
      const sids = [sighting(groundPlan.plan.frame, 'pergola posts outside the walls', 0.75)]
      const featureId = feature('PERGOLA', id, { width: { value: reading.rect.x1 - reading.rect.x0, low: reading.rect.x1 - reading.rect.x0 - 0.1, high: reading.rect.x1 - reading.rect.x0 + 0.1 }, depth: { value: reading.rect.z1 - reading.rect.z0, low: reading.rect.z1 - reading.rect.z0 - 0.1, high: reading.rect.z1 - reading.rect.z0 + 0.1 } }, sids, 'SOURCE_DERIVED', reading.why, { storeyIndex: 0, uncertaintyM: 0.1, unresolvedProperties: ['height (assumed)', 'beam section (assumed)', 'slats or roofing over the frame'], parameterProvenance: { height: 'ASSUMED_FOR_RENDERING' } })
      relate('MEETS_HOST', featureId, mainGround.featureId, `the frame stands against the ${reading.side.toLowerCase()} face`)
      pergolas.push({ id, side: reading.side, rect: reading.rect, posts: reading.posts, topY, featureId, why: `${reading.why}; ${PERGOLA_HEIGHT_ASSUMED_M} m high with ${PERGOLA_BEAM_ASSUMED.width} × ${PERGOLA_BEAM_ASSUMED.depth} m beams for viewing (DISPLAY_ASSUMPTION: a plan draws neither)` })
      step({ stage: 'facade', what: `a pergola against the ${reading.side.toLowerCase()} face`, method: 'DIRECT', detail: reading.why, inputs: posts.length, outputs: reading.posts.length })
    }
  }
  step({ stage: 'facade', what: 'verge members, balconies, railings, portal heads', method: 'DISCRETE_SELECTION', detail: `${verges.length} verge members, ${balconies.filter((b) => b.kind === 'BALCONY').length} balconies, ${railings.length} railings, ${portalHeads.length} portal heads, ${assemblies.length} assemblies`, inputs: views.length, outputs: verges.length + balconies.length + railings.length + portalHeads.length })
  // The stripe rule, recorded: every LINEAR_VOLUME_CANDIDATE that no member accounts for is a stripe.
  for (const o of graph.observations.filter((x) => x.kind === 'LINEAR_VOLUME_CANDIDATE')) {
    const frame = frameById.get(o.frameId)
    const v = views.find((x) => x.view.registration.frameId === o.frameId)
    if (!frame || !v) {
      record({ evidenceId: o.id, evidenceKind: 'OBSERVATION', what: 'a linear volume candidate on an unregistered view', authority: 'LOW', disposition: 'IGNORED_WITH_REASON', reason: 'the view carries no metric registration (a perspective, or an unassigned render)', stage: 'ASSEMBLY' })
      continue
    }
    const g = o.pixelGeometry
    const rect = g.type === 'RECT' ? g.rect : undefined
    const hit = rect && members.some((m) => m.frameIds.includes(o.frameId) && (() => { const y0 = v.view.yOf(rect.y1); const y1 = v.view.yOf(rect.y0); return Math.min(y1, m.y[1]) - Math.max(y0, m.y[0]) > 0.1 })())
    record({ evidenceId: o.id, evidenceKind: 'OBSERVATION', what: 'a linear volume candidate', authority: 'MEDIUM', disposition: hit ? 'USED_AS_CORROBORATION' : 'REJECTED_WITH_REASON', reason: hit ? 'it lies on a member the plan or a recess gives depth to' : 'no plan return, recess or slab level gives it depth: a stripe, not a volume', stage: 'ASSEMBLY' })
  }

  // ---------------------------------------------------------------------------
  // Perspective cameras (§17): attempted on every perspective view; used only when solved.
  // ---------------------------------------------------------------------------
  const cameras: ReconstructionV2Result['registrations']['cameras'] = []
  const solvedCameras: PerspectiveCameraV2[] = []
  const perspectives = graph.coordinateFrames.filter((f) => f.roles.projection === 'PERSPECTIVE' && (keep ? keep(f) : true))
  for (const [cameraIndex, frame] of perspectives.entries()) {
    options.checkpoint?.tick({ subphase: { id: 'CAMERAS', label: 'registering the renders' }, counters: { cameras: cameraIndex + 1, camerasTotal: perspectives.length } })
    const raster = options.raster(frame)
    if (!raster || !mainRoof) continue
    const cam = solvePerspectiveCamera(raster, frame.id, { x0: world.envelope.x0, x1: world.envelope.x1, z0: world.envelope.z0, z1: world.envelope.z1, eaveY: mainRoof.eaveY, ridgeY: mainRoof.ridgeY, ridgeAxis: mainRoof.ridgeAxis, ridgeAt: mainRoof.ridgeAt, groundY: 0, attached: [...attachedRoofs.map((r) => ({ x0: r.footprint.x0, x1: r.footprint.x1, z0: r.footprint.z0, z1: r.footprint.z1, topY: r.parapetTopY ?? r.slabTopY })), ...pitchedAttachedRoofs.map((r) => ({ ...r.footprint, topY: r.eaveY }))] })
    cameras.push({ frameId: frame.id, solved: !!cam, residualPx: cam?.residualPx.rms, why: cam ? cam.why : 'no camera hypothesis aligned enough silhouette corners with a plausible residual', ...(cam ? { camera: cam } : {}) })
    if (cam) {
      solvedCameras.push(cam)
      feature('CAMERA', `camera-${frame.id.slice(-10)}`, { residualPx: { value: cam.residualPx.rms, low: 0, high: cam.residualPx.max, unit: 'none' } }, [sighting(frame, 'silhouette corners of the perspective', cam.confidence)], 'IMAGE_METRIC_REGISTERED', cam.why)
    }
    for (const o of graph.observations.filter((x) => x.frameId === frame.id)) record({ evidenceId: o.id, evidenceKind: 'OBSERVATION', what: `${o.kind} on a perspective render`, authority: 'LOW', disposition: cam ? 'USED_AS_CORROBORATION' : 'IGNORED_WITH_REASON', reason: cam ? 'the perspective is registered; depth order was checked against it' : 'no camera could be solved for this render, so nothing on it can be placed', stage: 'REGISTRATION' })
  }
  step({ stage: 'camera', what: 'perspective cameras', method: solvedCameras.length > 0 ? 'BOUNDED_SEARCH' : 'REFUSED', detail: cameras.map((c) => `${c.frameId.slice(-12)}: ${c.solved ? `solved, ${c.residualPx?.toFixed(1)} px rms` : 'unsolved'}`).join('; ') || 'no perspective views', inputs: cameras.length, outputs: solvedCameras.length })

  // ---------------------------------------------------------------------------
  // Finish regions (colour, never geometry): the dominant tones of the recessed walls and the side bands.
  // ---------------------------------------------------------------------------
  // Broad tone of each body's walls, where they stand in the open on a registered render.
  const massTones: MassToneV2[] = readMassTones(masses, views, openings, recesses, levelsV2)
  const surfaceRegions: BuildingV2['surfaceRegions'] = []
  for (const recess of recesses.filter((r) => r.storeyIndex === 0)) {
    for (const v of viewsOf(recess.side)) {
      for (const open of recess.open) {
        const l = levelOf(0)
        if (!l) continue
        const alongX = recess.side === 'FRONT' || recess.side === 'REAR'
        const massOn = masses.find((m) => m.storeys.includes(0) && (recess.side === 'FRONT' ? Math.abs(m.z0 - recess.backAt) < 0.1 : recess.side === 'REAR' ? Math.abs(m.z1 - recess.backAt) < 0.1 : true) && open.from < (alongX ? m.x1 : m.z1) && open.to > (alongX ? m.x0 : m.z0))
        if (!massOn) continue
        const clipped: [number, number] = [Math.max(open.from, alongX ? massOn.x0 : massOn.z0), Math.min(open.to, alongX ? massOn.x1 : massOn.z1)]
        if (clipped[1] - clipped[0] < 0.5) continue
        // The recessed wall's finishes, run by run along it; its openings are glass, not wall.
        const skip = openings.filter((o) => o.facade === recess.side && o.storeyIndex === 0).map((o) => o.interval)
        const runs = readFinishRuns(v.view, v.raster, clipped, [l.elevation + 0.4, l.elevation + 2.0], skip)
        const bodyTone = massTones.find((t) => t.massId === massOn.id)?.tone
        for (const run of runs) {
          if (run.to - run.from < 0.5 || run.tone === 'LIGHT' || run.tone === bodyTone) continue
          const id = `finish-${recess.side.toLowerCase()}-${Math.round(run.from * 100)}`
          const featureId = feature('SURFACE_REGION', id, {}, [sighting(frameById.get(v.view.registration.frameId) as SourceCoordinateFrame, 'finish tone of the recessed wall', run.share)], 'VISUAL_SEMANTIC', `the recessed wall reads ${run.tone.toLowerCase()} from ${run.from.toFixed(2)} to ${run.to.toFixed(2)} (${Math.round(run.share * 100)} % of the columns' samples agree)`, { storeyIndex: 0 })
          surfaceRegions.push({ id, wallRef: { massId: massOn.id, storeyIndex: 0, side: recess.side }, along: [run.from, run.to], y: [l.elevation, l.elevation + l.height], tone: run.tone, featureId })
        }
      }
      break
    }
  }

  // ---------------------------------------------------------------------------
  // I2. assembly closure: how the members meet
  // ---------------------------------------------------------------------------
  const closureNotes: ClosureNote[] = []
  {
    const snapped = snapReturnsToBodyFaces(returns, masses)
    const stacked = alignStackedReturns(snapped.returns)
    returns.splice(0, returns.length, ...stacked.returns)
    const floors = closeTerraces(terraces, returns, recesses, masses)
    terraces.splice(0, terraces.length, ...floors.terraces)
    // A finish region on a recessed wall runs to the returns that bound the recess, wherever they now stand.
    for (const region of surfaceRegions) {
      const faces = returns.filter((r) => r.side === region.wallRef.side && r.storeyIndex === region.wallRef.storeyIndex).flatMap((r) => r.alongInterval)
      const snap = (a: number): number => faces.find((f) => Math.abs(f - a) <= 0.06) ?? a
      region.along = [round6(snap(region.along[0])), round6(snap(region.along[1]))]
    }
    closureNotes.push(...snapped.notes, ...stacked.notes, ...floors.notes)
    const plansForClosure = new Map([...planByStorey].map(([i, e]) => [i, { frame: e.frame, raster: e.raster, frameId: e.plan.frame.id }]))
    const bal = closeBalconies({ balconies, returns, recesses, levels: levelsV2, portalHeads, plans: plansForClosure, elevations: views })
    balconies.splice(0, balconies.length, ...bal.balconies)
    closureNotes.push(...bal.notes)
    const rails = closeRailings(railings, balconies, recesses, bal.ends)
    railings.splice(0, railings.length, ...rails.railings)
    closureNotes.push(...rails.notes)
    // A railing turning at a line the plan draws is read there too: the plan is a second source for it.
    for (const r of railings) {
      const b = balconies.find((x) => x.id === r.hostId)
      const e = b ? bal.ends.get(b.id) : undefined
      const solved = ctx.solved.find((x) => x.id === r.featureId)
      if (!e || !solved) continue
      for (const end of e) {
        if (!end.turns || !end.lineFrameId) continue
        const frame = frameById.get(end.lineFrameId)
        if (!frame) continue
        const sid = sighting(frame, `the balustrade drawn across the zone at ${end.at.toFixed(2)}`, 0.7)
        const hyp = ctx.hypotheses.find((h) => h.id === solved.hypothesisId)
        if (hyp) hyp.sightingIds.push(sid)
        solved.sourceCoverage = { ...solved.sourceCoverage, sightings: solved.sourceCoverage.sightings + 1, independentAssets: solved.sourceCoverage.independentAssets + 1, viewFamilies: [...new Set([...solved.sourceCoverage.viewFamilies, 'PLAN' as ViewFamily])] }
        solved.parameterProvenance = { ...solved.parameterProvenance, path: 'SOURCE_DERIVED' }
        solved.quality = qualityLevelOf(solved)
      }
      if (b) relate('SUPPORTS', b.featureId, r.featureId, 'the balustrade stands on the slab it guards')
      if ((r.path?.length ?? 2) > 2) relate('TURNS_AT', r.featureId, b?.featureId ?? r.featureId, 'the balustrade turns round the free end of the slab to the wall')
    }
    for (const b of balconies) {
      for (const end of b.ends ?? []) {
        const other = returns.find((x) => x.id === end.againstId) ?? portalHeads.find((x) => x.id === end.againstId)
        if (!other) continue
        relate(end.kind === 'MEETS' ? 'CONTINUES_AS' : end.kind === 'CARRIES' ? 'SUPPORTS' : 'TERMINATES_AT', b.featureId, other.featureId, end.why)
      }
    }
    const vg = closeVerges(verges, recesses, returns)
    verges.splice(0, verges.length, ...vg.verges)
    closureNotes.push(...vg.notes)
    for (const v of verges) {
      const solved = ctx.solved.find((x) => x.id === v.featureId)
      if (!solved || v.depthProvenance !== 'SOURCE_DERIVED') continue
      solved.parameters = { ...solved.parameters, depth: { value: round6(v.depthM), low: round6(v.depthM - 0.05), high: round6(v.depthM + 0.05), unit: 'm' } }
      solved.parameterProvenance = { ...solved.parameterProvenance, depth: 'SOURCE_DERIVED' }
      solved.unresolvedProperties = solved.unresolvedProperties.filter((p) => p !== 'depth')
      solved.quality = qualityLevelOf(solved)
    }
    const ph = closePortalHeads(portalHeads, balconies)
    portalHeads.splice(0, portalHeads.length, ...ph.portalHeads)
    closureNotes.push(...ph.notes)
  }
  // Broad tone of each body's walls, where they stand in the open on a registered render.
  const returnTones = readReturnTones(returns, views, levelsV2)
  for (const t of returnTones) closureNotes.push({ subject: t.returnId, what: `reads ${t.tone.toLowerCase()} (${Math.round(t.share * 100)} %)`, why: t.why })
  for (const t of massTones) {
    const m = masses.find((x) => x.id === t.massId)
    if (m) closureNotes.push({ subject: m.id, what: `walls read ${t.tone.toLowerCase()} (${Math.round(t.share * 100)} %)`, why: t.why })
  }
  const facadeGraph = buildFacadeGraph({ returns, verges, balconies, railings, portalHeads, terraces, recesses, levels: levelsV2, ends: new Map(balconies.filter((b) => b.ends).map((b) => [b.id, (b.ends as [EndCondition, EndCondition]).map((e) => ({ ...e, railStopAt: e.at, turns: false })) as [BalconyEnd, BalconyEnd]])), roofEaveY: mainRoof?.eaveY })
  step({ stage: 'facade', what: 'assembly closure: how the members meet', method: 'DISCRETE_SELECTION', detail: `${closureNotes.length} decisions; ${terraces.length} terrace${terraces.length === 1 ? '' : 's'}${terraces.some((t) => t.extension) ? ` (${terraces.filter((t) => t.extension).length} with a platform beyond the mouth)` : ''}; ${railings.filter((r) => (r.path?.length ?? 2) > 2).length} railing${railings.filter((r) => (r.path?.length ?? 2) > 2).length === 1 ? '' : 's'} turning; facade graph ${facadeGraph.nodes.length} nodes, ${facadeGraph.edges.length} edges`, inputs: balconies.length + railings.length + verges.length + portalHeads.length + returns.length, outputs: facadeGraph.edges.length })

  trace({ phase: 'METRICS', substage: 'METRICS', status: 'PASSED', counts: { openings: openings.length, sharedDoors: sharedDoors.length, balconies: balconies.length, terraces: terraces.length, railings: railings.length, chimneys: chimneys.length, rooflights: rooflights.length } })
  options.onPhase?.('MODEL')
  // ---------------------------------------------------------------------------
  // J. emit, K. seal, L. verify, M. repair, N. quality
  // ---------------------------------------------------------------------------
  // 005Y: a main roof hipped at an end is built as planes (`planeRoofLayout`), its eaves projection kept by laying the
  // planes out over the body grown by the projection with their eaves lowered along the slope. Only a roof nothing else
  // is bound to as a gable is rebuilt: a rooflight, a verge member or a roof meeting it keeps the gable and the hip is
  // named instead.
  let planeRoofs: PlaneRoofV2[] | undefined
  let builtMainRoof = mainRoof
  if (mainRoof?.ends) {
    // 005Y-N1: a chimney no longer holds the roof as a gable: its penetration is cut plumb in the plane it stands in (emit).
    const bound = [...(rooflights.some((r) => !r.planeId) ? ['rooflights'] : []), ...(verges.length > 0 ? ['verge boards'] : []), ...(pitchedAttachedRoofs.length > 0 ? ['attached pitched roofs'] : [])]
    if (bound.length > 0) gap({ what: 'the hipped ends of the main roof', reason: `${mainRoof.ends.why}, but ${bound.join(', ')} are bound to it as a gable; the gable is kept`, status: 'AMBIGUOUS', observationIds: [], evidenceIds: [] })
    else {
      const r = mainRoof
      const oh = r.eaves?.overhangM ?? 0
      const body = { x0: r.footprint.x0 - oh, x1: r.footprint.x1 + oh, z0: r.footprint.z0 - oh, z1: r.footprint.z1 + oh }
      const eaveY = round6(r.eaveY - oh * Math.tan((r.pitchDeg * Math.PI) / 180))
      const layout = planeRoofLayout(body, r.ridgeAxis, r.pitchDeg, eaveY, { min: r.ends!.min, max: r.ends!.max })
      planeRoofs = [{ massId: r.massId, ridgeAxis: r.ridgeAxis, pitchDeg: r.pitchDeg, eaveY, ridgeY: layout.ridgeY, ends: { min: r.ends!.min, max: r.ends!.max }, thicknessM: r.thicknessM, layout, featureId: r.featureId, provenance: r.provenance, why: `${r.pitchDeg}° roof on the authority of ${r.authority.toLowerCase().replace(/_/g, ' ')}; ${r.ends!.why}${r.eaves ? `; eaves ${oh.toFixed(2)} m past the walls on every side: ${r.eaves.why}` : ''}` }]
      builtMainRoof = undefined
    }
  }
  const building: BuildingV2 = { label: options.label, wallThicknessM: T, slabThicknessM: slabT, levels: levelsV2, masses, mainRoof: builtMainRoof, ...(planeRoofs ? { planeRoofs } : {}), attachedRoofs, pitchedAttachedRoofs, recesses, ...(pockets.length > 0 ? { pockets } : {}), ...(pergolas.length > 0 ? { pergolas } : {}), returns, balconies, railings, portalHeads, verges, terraces, massTones, returnTones, facadeGraph, chimneys, rooflights, openings, sharedDoors, interior, stair, assemblies, surfaceRegions, terrainY: terrain }
  const residualsBefore = verifyAgainstViews({ building, views })
  const repair = repairFromResiduals(building, residualsBefore, 2)
  const residuals = verifyAgainstViews({ building, views })
  step({ stage: 'verification', what: 'the model projected into the registered views', method: 'DIRECT', detail: `${residuals.length} residuals, ${residuals.filter((r) => !r.withinTolerance).length} outside tolerance after ${repair.iterations.length} repair round${repair.iterations.length === 1 ? '' : 's'} (${repair.iterations.reduce((a, i) => a + i.applied.length, 0)} applied, ${repair.iterations.reduce((a, i) => a + i.refused.length, 0)} refused)`, inputs: residualsBefore.length, outputs: residuals.length })
  for (const it of repair.iterations) for (const op of it.applied) ctx.traces.push({ objectId: op.featureId, kind: 'repair', hypothesisId: `hyp-${op.featureId}`, evidenceIds: [], observationIds: [], rejected: [], why: op.why })

  const emitted = emitBuilding(building, options.label, options.debug)
  const { dropped } = emitted
  // The wall topology plan (004A): what was fused, snapped, trimmed or split before
  // the partitions were emitted, and the joints that could not be resolved — each
  // of those a named hole, never an invalid wall.
  if (emitted.topology.decisions.length > 0) {
    const byKind: Record<string, number> = {}
    for (const d of emitted.topology.decisions) byKind[d.kind] = (byKind[d.kind] ?? 0) + 1
    step({ stage: 'emission', what: 'partition topology planned before emission', method: 'DIRECT', detail: Object.entries(byKind).sort().map(([k, n]) => `${n} ${k.toLowerCase().replace(/_/g, ' ')}`).join('; '), inputs: emitted.topology.decisions.length, outputs: emitted.topology.unresolved.length })
    trace({ phase: 'MODEL', substage: 'WALL_TOPOLOGY', status: emitted.topology.unresolved.length > 0 ? 'DEGRADED' : 'PASSED', counts: { decisions: emitted.topology.decisions.length, unresolvedJoints: emitted.topology.unresolved.length, ...Object.fromEntries(Object.entries(byKind).map(([k, n]) => [k.toLowerCase(), n])) } })
  }
  for (const u of emitted.topology.unresolved) gap({ what: u.what, reason: u.reason, status: 'AMBIGUOUS', observationIds: [], evidenceIds: [] })
  const modelId = (options.modelId ?? `m-auto-v2-${options.slug}`).replace(/[^A-Za-z0-9_.:-]+/g, '-')
  // The model's own validator decides what fits; only openings it refuses as
  // not fitting their host are shrunk or dropped, and each one is named.
  // 005Y-N7 (A): a program the model refuses only because two walls overlap is reconciled within the plan's own
  // uncertainty and fitted again; a program with no overlap takes exactly the path it always took.
  const firstFit = fitOpeningsToHosts(emitted.program, options.label, modelId)
  const reconciled = !firstFit.ok && firstFit.errors.every((e) => e.code === 'WALLS_OVERLAP') ? reconcileWallOverlaps(emitted.program, options.label, modelId, { toleranceM: planReconcileTolerance(planFrames) }) : undefined
  const refit = reconciled?.ok ? fitOpeningsToHosts(reconciled.program, options.label, modelId) : undefined
  const fit = reconciled && refit ? { ...refit, indexMap: reconciled.indexMap.map((k) => (k >= 0 ? refit.indexMap[k] : -1)) } : reconciled && !reconciled.ok ? { ...firstFit, ...reconciled, fits: [] } : firstFit
  const wallReconciliation = reconciled ? reportWallReconciliation(reconciled, step, gap, trace) : undefined
  if (!fit.ok) {
    // What the model refused, in enough detail to find the first wrong inference
    // (004A): the command's own id, the objects the validator named, the largest
    // measured violation, and the validator's sentence — which names walls and
    // metres and nothing about the machine.
    const objectIds = [...new Set(fit.errors.map((e) => e.objectId).filter((id): id is string => typeof id === 'string'))]
    const measured = fit.errors.map((e) => (e as { measured?: number }).measured).filter((m): m is number => typeof m === 'number')
    const otherWall = fit.errors.map((e) => /walls? (\S+) and (\S+) share/.exec(e.message ?? '')).find((m) => m)
    throw new ReconstructionFailure('MODEL_EMISSION_FAILED', 'MODEL', `the model refused command ${fit.failedAt} (${fit.command.type}): ${fit.errors.map((e) => e.code).join(', ')}`, {
      command: fit.command.type,
      codes: [...new Set(fit.errors.map((e) => e.code))].join(','),
      commandIndex: fit.failedAt,
      ...('id' in fit.command && typeof fit.command.id === 'string' ? { commandId: fit.command.id } : {}),
      ...(objectIds.length > 0 ? { objectIds: objectIds.join(',') } : {}),
      ...(otherWall ? { walls: `${otherWall[1]},${otherWall[2]}` } : {}),
      ...(measured.length > 0 ? { measured: Math.max(...measured) } : {}),
      ...(fit.errors[0]?.message ? { detail: fit.errors[0].message.slice(0, 200) } : {}),
      ...(reconciled && !reconciled.ok && reconciled.refusal ? refusalDiagnostics(reconciled.refusal) : {}),
    })
  }
  // 005Y-N4 (D): the stair against the walls that bound its shaft, not in them (a move within the reading's uncertainty)
  const stairFit = fitStairToBoundingWalls(fit.program, options.label, modelId)
  // 005Y-N4 (D): partitions under the flights stop at the flights' underside (nothing deleted)
  const soffits = followStairSoffits(stairFit.program, options.label, modelId)
  const program = soffits.program
  for (const w of soffits.walls) {
    step({ stage: 'emission', what: `the wall ${w.wallId} under the stair`, method: w.action === 'FOLLOWS_SOFFIT' ? 'DIRECT' : 'REFUSED', detail: w.why, inputs: 1, outputs: w.action === 'FOLLOWS_SOFFIT' ? 1 : 0 })
    if (w.action === 'REFUSED') gap({ what: `the wall ${w.wallId} where it meets ${w.stairId}`, reason: w.why, status: 'AMBIGUOUS', observationIds: [], evidenceIds: [] })
  }
  for (const f of stairFit.fits) {
    if (f.action !== 'NONE') step({ stage: 'emission', what: 'the stair fitted to the walls bounding its shaft', method: f.action === 'MOVED' ? 'DIRECT' : 'REFUSED', detail: f.why, inputs: f.bounding.length, outputs: f.action === 'MOVED' ? 1 : 0 })
    if (f.action === 'REFUSED') gap({ what: `the place of ${f.stairId} in its shaft`, reason: f.why, status: 'AMBIGUOUS', observationIds: [], evidenceIds: [] })
    if (f.inside.length > 0) gap({ what: `the walls under ${f.stairId}`, reason: `${f.inside.join(', ')} stand inside the stair's outline, deeper than a reading's uncertainty: walls under a flight or landing; they are kept, and where they rise through the flight it is named, not hidden`, status: 'AMBIGUOUS', observationIds: [], evidenceIds: [] })
  }
  const bindings = emitted.bindings.filter((b) => fit.indexMap[b.commandIndex] >= 0).map((b) => ({ ...b, commandIndex: fit.indexMap[b.commandIndex] }))
  for (const f of fit.fits) {
    gap({ what: `the opening ${f.openingId} as the drawings print it`, reason: f.why, status: f.action === 'DROPPED' ? 'REFUSED' : 'AMBIGUOUS', observationIds: [], evidenceIds: [] })
    const solved = ctx.solved.find((s) => s.id === `feat-${f.openingId}` || s.id === f.openingId)
    if (solved) solved.unresolvedProperties = [...solved.unresolvedProperties, f.action === 'DROPPED' ? f.why : `fitted to its host: ${f.why}`]
  }
  if (fit.fits.length > 0) step({ stage: 'emission', what: 'openings fitted to the walls that host them', method: 'DIRECT', detail: fit.fits.map((f) => `${f.openingId} ${f.action.toLowerCase()} (${f.code})`).join('; '), inputs: emitted.program.length, outputs: program.length })
  trace({ phase: 'MODEL', substage: 'EMISSION', status: fit.fits.length > 0 ? 'DEGRADED' : 'PASSED', counts: { commands: program.length, openingsFitted: fit.fits.filter((f) => f.action !== 'DROPPED').length, openingsDropped: fit.fits.filter((f) => f.action === 'DROPPED').length } })
  for (const d of dropped) {
    const solved = ctx.solved.find((s) => s.id === `feat-${d.featureId}`)
    if (!solved) continue
    solved.quality = 'L0'
    solved.provenance = 'UNRESOLVED'
    solved.unresolvedProperties = [...solved.unresolvedProperties, `not built: ${d.why}`]
  }
  const hypothesisSet: PrimitiveHypothesisSet = {
    schema: HYPOTHESIS_SET_SCHEMA,
    schemaVersion: HYPOTHESIS_SET_SCHEMA_VERSION,
    id: '',
    sourcePackageId: options.sourcePackageId,
    sourcePackageHash: options.sourcePackageHash,
    observationGraphId: graph.id,
    observationGraphHash: graph.contentHash,
    metricEvidenceId: metrics.id,
    metricEvidenceHash: metrics.contentHash,
    proposers: [{ name: 'analyzer-v2', version: SOLVER_V2_VERSION }],
    hypotheses: [],
    unresolved: [],
    fusion: { rawCandidates: 0, afterDuplicateSuppression: 0, afterClustering: 0, afterContinuityMerge: 0, accepted: 0, rejected: [] },
    contentHash: '',
  } as unknown as PrimitiveHypothesisSet
  const hypothesesHash = hashArtifact('buildapp.analyzer-v2-hypotheses', SOLVER_V2_VERSION, [{ label: 'features', unordered: ctx.hypotheses }])
  hypothesisSet.id = `hypotheses-v2-${hypothesesHash.slice(0, 16)}`
  hypothesisSet.contentHash = hypothesesHash

  // Traces: one per bound object.
  for (const b of bindings) {
    const solved = ctx.solved.find((s) => s.id === b.featureId || s.id === `feat-${b.featureId}`)
    if (!solved) continue
    const obs = solved.sourceCoverage.sightings > 0 ? ctx.sightings.filter((s) => ctx.hypotheses.find((h) => h.id === solved.hypothesisId)?.sightingIds.includes(s.id)).flatMap((s) => s.observationIds) : []
    ctx.traces.push({ objectId: b.objectId, kind: b.objectKind, hypothesisId: solved.hypothesisId, evidenceIds: [], observationIds: [...new Set(obs)], rejected: [], why: solved.why })
  }
  const { candidate, model } = sealCandidate(
    {
      schema: 'buildapp.reconstruction-candidate',
      schemaVersion: '1.1.0',
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
      modelId,
      label: options.label,
      // A resolved building also depends on the resolver's rules, so its version joins the solver's; a first
      // reading that held never met the resolver, and its candidate stays byte for byte what it was.
      solver: { name: `${SOLVER_NAME}.v2`, version: planDiagnostics.resolution ? `${SOLVER_V2_VERSION}+resolver.${PLAN_RESOLVER_VERSION}` : SOLVER_V2_VERSION },
      program,
      quantities: [],
      contradictions: [],
      unresolved: ctx.unresolved,
      traces: ctx.traces,
      steps: ctx.steps,
      residuals: { metricRmsM: round6(Math.sqrt(residuals.reduce((a, r) => a + r.residualM * r.residualM, 0) / Math.max(1, residuals.length))), metricMaxM: round6(residuals.reduce((a, r) => Math.max(a, Math.abs(r.residualM)), 0)), hard: ctx.solved.filter((s) => s.provenance === 'SOURCE_EXACT').length, soft: ctx.solved.filter((s) => s.provenance !== 'SOURCE_EXACT' && s.provenance !== 'UNRESOLVED').length, unresolved: ctx.solved.filter((s) => s.provenance === 'UNRESOLVED' || s.unresolvedProperties.length > 0).length },
    },
    options.slug,
  )

  // The remaining evidence, every id with a disposition.
  for (const o of graph.observations) {
    if (ctx.consumed.has(o.id)) continue
    const frame = frameById.get(o.frameId)
    const fam = frame ? viewFamilyOf(frame) : 'PAGE'
    let disposition: EvidenceConsumptionRecord['disposition'] = 'IGNORED_WITH_REASON'
    let reason = 'read for the record; the v2 passes read this drawing’s pixels directly'
    if (o.kind === 'WALL_BAND') { disposition = 'USED_AS_CORROBORATION'; reason = 'the plan’s wall bands corroborate the bodies and partitions the v2 pass read from the same raster' }
    else if (o.kind === 'OPENING_INTERVAL') { disposition = 'USED_AS_CORROBORATION'; reason = 'a gap the plan reader also found, or a doorway inside the body' }
    else if (o.kind === 'OPENING') { disposition = fam === 'ELEVATION' ? 'USED_AS_CORROBORATION' : 'IGNORED_WITH_REASON'; reason = fam === 'ELEVATION' ? 'a rectangle on a registered render; openings were placed from the plan gaps and sized on the render' : 'on a view without a metric registration' }
    else if (o.kind === 'ROOF_EDGE' || o.kind === 'RIDGE') { disposition = 'USED_AS_CORROBORATION'; reason = 'the roof line the render registration was checked against' }
    else if (o.kind === 'LOGGIA') { disposition = fam === 'ELEVATION' ? 'USED_AS_CORROBORATION' : 'IGNORED_WITH_REASON'; reason = fam === 'ELEVATION' ? 'a recess mouth on a render; the recess topology came from the plan zones' : 'on a view without a metric registration' }
    else if (o.kind === 'SURFACE_REGION' || o.kind === 'WALL_REGION') { disposition = 'IGNORED_WITH_REASON'; reason = 'colour, not geometry: finish regions are read from the registered renders directly' }
    else if (o.kind === 'PARALLEL_LINE_FAMILY') { disposition = 'IGNORED_WITH_REASON'; reason = 'dimension chains are read by the metric layer from the raster' }
    else if (o.kind === 'STAIR' || o.kind === 'STAIR_SYMBOL' || o.kind === 'POLYLINE') { disposition = 'USED_AS_CORROBORATION'; reason = 'a stair reading on a plan or section, corroborating the ladders' }
    else if (o.kind === 'LEVEL_DATUM') { disposition = 'USED_AS_CORROBORATION'; reason = 'the datum lines the metric ladder was fitted through' }
    record({ evidenceId: o.id, evidenceKind: 'OBSERVATION', what: `${o.kind} on ${fam.toLowerCase()} ${o.frameId.slice(-10)}`, authority: o.confidence >= 0.75 ? 'MEDIUM' : 'LOW', disposition, reason, stage: 'OBSERVATION' })
  }
  for (const e of metrics.evidence) {
    if (ctx.consumed.has(e.id)) continue
    const plan = planFrames.find((p) => p.frameId === e.frameId)
    let disposition: EvidenceConsumptionRecord['disposition'] = 'USED_AS_CORROBORATION'
    let reason = 'a printed figure on a registered drawing that corroborates the frame it was read through'
    if (e.kind === 'OPENING_CALLOUT') {
      // A ring the reader could not read as one coherent pair of numbers is
      // a circle on the sheet — furniture, a plant, a fitting — not a callout;
      // one it could read, that no wall gap of that width lies near, is a
      // callout of an opening this pass did not cut.
      const coherent = e.confidence >= 0.2
      disposition = coherent ? 'UNRESOLVED' : 'REJECTED_WITH_REASON'
      reason = coherent ? 'a printed opening callout that matched no wall gap of its width within reach' : `a ring read as "${e.rawText}" at no coherent confidence (${e.confidence}): a circle on the sheet, not a callout`
    }
    else if (e.kind === 'LINEAR_DIMENSION' && !plan) { disposition = 'IGNORED_WITH_REASON'; reason = 'a dimension on a drawing the v2 frame does not register (a variant, the section, the site plan)' }
    else if (e.kind === 'ANGLE') { disposition = 'USED_AS_CORROBORATION'; reason = 'an angle reading beside the printed pitch' }
    record({ evidenceId: e.id, evidenceKind: 'METRIC', what: `${e.kind} ${e.rawText} on ${e.frameId.slice(-10)}`, authority: e.confidence >= 0.6 ? 'HIGH' : 'MEDIUM', disposition, reason, stage: 'METRIC' })
  }
  for (const a of options.publishedAreas ?? []) {
    record({ evidenceId: `page:${a.key}`, evidenceKind: 'PAGE_FACT', what: `${a.label} ${a.value} ${a.unit}`, authority: 'HIGH', disposition: a.key.includes('footprint') ? 'USED_AS_CORROBORATION' : 'IGNORED_WITH_REASON', reason: a.key.includes('footprint') ? 'checked against the bodies’ area by the layout gate' : 'an aggregate: no geometry may be derived from it', stage: 'QUALITY' })
  }
  for (const r of publishedRooms) {
    const matched = interior.some((i) => i.rooms.some((x) => x.number === String(r.index) && x.label === r.label))
    record({ evidenceId: `page:room:${r.storey}:${r.index}`, evidenceKind: 'PAGE_ROOM', what: `${r.storey} ${r.index} ${r.label} ${r.area}`, authority: 'MEDIUM', disposition: matched ? 'USED_AS_CORROBORATION' : 'UNRESOLVED', reason: matched ? 'the room number was read inside a room polygon and the area compared' : 'no room polygon carries this number', stage: 'QUALITY' })
  }
  ctx.ledger = [...ctx.consumed.values()]

  const graphDraft: FeatureGraphDraft = { id: `feature-graph-${options.slug}`, sourcePackageHash: options.sourcePackageHash, observationGraphHash: graph.contentHash, metricEvidenceHash: metrics.contentHash, sightings: ctx.sightings, measurements: ctx.measurements, hypotheses: ctx.hypotheses, alternatives: ctx.alternatives, solved: ctx.solved, bindings: bindings.map((b) => ({ id: `bind-${b.objectId}`, solvedFeatureId: ctx.solved.find((s) => s.id === b.featureId || s.id === `feat-${b.featureId}`)?.id ?? `feat-${b.featureId}`, objectId: b.objectId, objectKind: b.objectKind, commandIndex: b.commandIndex })), relations: ctx.relations }
  const featureGraph = sealFeatureGraph(graphDraft)
  const ledger = sealLedger(`ledger-${options.slug}`, featureGraph.contentHash, ctx.ledger)
  const quality = sealQualityReport(`quality-${options.slug}`, featureGraph.contentHash, ctx.solved, (fid) => featureGraph.bindings.filter((b) => b.solvedFeatureId === fid).map((b) => b.objectId))
  const violations = { graph: featureGraphViolations(graphDraft), ledger: ledgerViolations(ctx.ledger, [...graph.observations.map((o) => o.id), ...metrics.evidence.map((e) => e.id)]) }
  step({ stage: 'quality', what: 'per-feature quality', method: 'DIRECT', detail: Object.entries(quality.summary).map(([fam, levels]) => `${fam} ${Object.entries(levels).map(([l, n]) => `${l}:${n}`).join('/')}`).join(', '), inputs: ctx.solved.length, outputs: quality.records.length })

  return { layout, building, candidate, model, hypotheses: hypothesisSet, featureGraph, ledger, quality, residuals, repair, registrations: { plans: planFrames, elevations, section: sectionReg ? { frameId: sectionReg.frameId, mpp: sectionReg.mpp, originCol: sectionReg.originCol, zeroRow: sectionReg.zeroRow } : undefined, cameras }, world, steps: ctx.steps, unresolved: ctx.unresolved, violations, closure: closureNotes, planDiagnostics, openingFits: fit.fits, ...(wallReconciliation ? { wallReconciliation } : {}), ...(roofDatum ? { roofDatum } : {}) }
}

/** The columns of a render across which a band of the given rows carries dark tone: the band's along extent. */
function fasciaExtent(raster: Raster, view: ElevationFrameV2, span: { from: number; to: number }, y: [number, number]): { from: number; to: number } | undefined {
  const rowTop = Math.round(view.pyOf(y[1] - 0.05))
  const rowBottom = Math.round(view.pyOf(y[0] + 0.05))
  const px0 = Math.round(view.pxOf(span.from))
  const px1 = Math.round(view.pxOf(span.to))
  const cols: boolean[] = []
  const lo = Math.min(px0, px1)
  const hi = Math.max(px0, px1)
  for (let px = lo; px <= hi; px += 1) {
    let dark = 0
    let n = 0
    for (let py = Math.min(rowTop, rowBottom); py <= Math.max(rowTop, rowBottom); py += 2) {
      const o = (py * raster.width + px) * 4
      if (o < 0 || o + 2 >= raster.data.length) continue
      const l = 0.299 * raster.data[o] + 0.587 * raster.data[o + 1] + 0.114 * raster.data[o + 2]
      n += 1
      if (l < 150) dark += 1
    }
    cols.push(n > 0 && dark / n >= 0.6)
  }
  // The longest run of dark columns.
  let best: [number, number] | undefined
  let start: number | undefined
  for (let i = 0; i <= cols.length; i += 1) {
    const v = i < cols.length && cols[i]
    if (v && start === undefined) start = i
    if (!v && start !== undefined) {
      if (!best || i - start > best[1] - best[0]) best = [start, i - 1]
      start = undefined
    }
  }
  if (!best) return undefined
  const a = view.alongOf(lo + best[0])
  const b = view.alongOf(lo + best[1] + 1)
  if (Math.abs(b - a) < 0.8) return undefined
  return { from: round6(Math.min(a, b)), to: round6(Math.max(a, b)) }
}

/** 005V-N4: a band of the elevation is a candidate for the walls only when it repeats on this share of the rows … */
const WALL_BAND_MIN_SHARE = 0.1
/** … and spans this share of the silhouette's width. */
const WALL_BAND_MIN_WIDTH = 0.4
