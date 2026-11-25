/**
 * v3.54.2 pilot, v3.54.3 full loop — the analyzer with a consultant: the transaction around `consultLabels` (metric
 * rounds, before the model is trusted) and around `checkModel` (geometry rounds, after it is built).
 *
 *   snapshot (the LOCAL run as it is) → problem (from the analyzer's own evidence) → consultation → validation →
 *   candidate (the same frozen package and graph, with the consulted readings) → recompute (the analyzer's own
 *   pipeline: metric layer, plan, model, compile) → compare properties → ACCEPT or ROLLBACK.
 *
 * The analyzer builds every model; the consultant's answers only change what named labels are read as. Variant R asks
 * and records, and never re-runs; C consumes. A failure of the consultant (transport, budget, no answer) leaves the
 * LOCAL result exactly as it was. No global house description is ever asked for on this path.
 */
import type { ConsultedLevel, ConsultedReading, ConsultedSpan, MetricEvidenceSet } from '@buildapp/source-metrics'
import type { PlanDiagnosticsReport } from '@buildapp/reconstruction'
import { decodeImage, startDecoders } from '@buildapp/source-package'
import type { SourcePackage } from '@buildapp/source-package'
import type { SourceObservationGraph } from '@buildapp/source-observations'
import { frameRasters } from '@buildapp/source-cv'
import { AnalysisError, toAnalysisError } from '../errors.js'
import { ANALYSIS_SERVICE_VERSION, runAnalysis } from '../run.js'
import type { AnalysisInput, AnalysisOptions, AnalysisRun } from '../run.js'
import { CONSULTANT_CONTRACT_VERSION, CONSULTANT_PROMPT_VERSION } from './contract.js'
import type { ConsultantReview } from './contract.js'
import type { RoofFeatureCorrection, RoofFeatureOutcome } from '@buildapp/reconstruction'
import { MAX_SIDE, overviewOf } from './tools.js'
import { DEFAULT_CONSULT_LIMITS, checkModel, consultBoundary, consultLabels, overviewScale, validateBoundary, validateProposals } from './loop.js'
import type { BoundaryVerdict, CheckSource, ConsultEvent, ConsultLimits, ConsultOutcome, ConsultSpend, ConsultantModel, ModelCheckResult, Price, ProposalVerdict } from './loop.js'
import { bindRoofFeature, compareGeometry, geometryStateOf, reviewOutcome } from './geometry.js'
import type { CheckPicture, GeometryDecision, GeometryVerdict } from './geometry.js'
import { renderModelViews } from './model-views.js'
import type { ModelViewPicture } from './model-views.js'
import type { ReviewObservation } from './contract.js'
import { labelProblemOf } from './problems.js'
import { compileBuilding } from '@buildapp/geometry'
import { METRIC_READ_PROMPT_VERSION, METRIC_RESOLVER_VERSION, METRIC_VERIFY_PROMPT_VERSION, localTableOf, measureBuilt, readDimensions, resolveMetric, verifyLocal } from './metric-read.js'
import type { BuiltMeasure, IndependentRead, LocalCheck, MetricFrame, MetricResolution } from './metric-read.js'
import { SKETCH_STEP_VERSION, judgeForm, readSketches, readUnregisteredSketches } from './sketch-step.js'
import { CHOOSE_VERSION } from './choose.js'
import type { ExchangeLog } from './exchange-log.js'
import { ACCEPTED_CONSULT_SCHEMA, ACCEPTED_CONSULT_VERSION, consultBinding, recordingModel, replayModel } from './accepted-consult.js'
import type { AcceptedConsultRevision, AcceptedConsultStore, ConsultReuse, RecordedAnswer } from './accepted-consult.js'
import { ELEVATION_SKETCH_PARSER_VERSION, ELEVATION_SKETCH_PROMPT_VERSION } from '../appearance/elevation-sketch.js'
import { SOLVER_V2_VERSION, planCounts } from '@buildapp/reconstruction'
import type { SketchReading } from './sketch-step.js'
import { usableGeometryFingerprint } from '../appearance/consumer.js'
import type { LabelProblem } from './problems.js'
import { createEmptyModel, serializeModel } from '@buildapp/model'
import { buildMobileSceneBundle, serializeBundle } from '@buildapp/mobile-scene'
import type { CanonicalBuildingModel } from '@buildapp/model'
import { sha256Hex } from '@buildapp/source-common'
import { renderStoreyCut } from './model-views.js'
import { CORRECTION_REGISTRY_VERSION } from './correct/registry.js'
import { sideOfWall, CORRECTION_EXECUTOR_VERSION, elementExists, executeCorrections, modelRevision, PLAN_SPAN_AGREE, planGapsOf, preferredView, registerFromSketch, sideOfFacade, sideOpeningSpans, sideRange, viewsOfRun } from './correct/execute.js'
import { CHIMNEY_FUSION_VERSION, fuseChimneys } from './correct/chimney-fusion.js'
import { MASSING_VERSION, OUTLINE_SIMPLIFICATION, STOREY_WALLS, bodiesOf, pointWithFront, roofRegionsOfModel, roofSystemOf, wallEndsPx } from './massing/massing.js'
import type { MassingHypothesis } from './massing/massing.js'
import { readSiteDimensions, SITE_DIMENSIONS_VERSION } from './site-dimensions.js'
import { FACADE_METRIC_VERSION, readFacadeMetric } from './facade-metric.js'
import { FORM_READ_VERSION, flatVolumesOf, formVerdict, readForm } from './form-read.js'
import { STRUCTURE_VERSION, agreeStructure, buildStructureOf, structureAgainstBody, wallToApex } from './structure.js'
import { mainBodyOf, readbackOpenings, readbackStructure, regionOfPlane } from './readback.js'
import type { BoundRoofs } from './readback.js'
import { FEATURE_MAP_VERSION, countFeaturesOf, featureMapOf, featureMapText, traceFeatures } from './feature-map.js'
import type { SourceFeature } from './feature-map.js'
import type { AgreedStructure, BuildStructure, StructureSide } from './structure.js'
import type { Raster } from '@buildapp/source-cv'
import type { FormRead } from './form-read.js'
import { outerFaceOutline, PLAN_SKELETON_VERSION, readPlanSkeleton } from './plan-skeleton.js'
import type { PlanSkeleton } from './plan-skeleton.js'
import { INTERIOR_OPS_VERSION, planGapsFromSkeleton, skeletonInModel } from './correct/interior.js'
import type { InteriorObservation } from './correct/interior.js'
import type { FusionRecord, SketchedStack } from './correct/chimney-fusion.js'
import { elementIndexOf } from './element-index.js'
import type { ElementIndex } from './element-index.js'
import { identityOf } from '../identity.js'
import type { BindPicture, BindView, CorrectionOutcome, CorrectionProposal, PatchRecord, PlanGap, PrintedWitness, Side, SketchAnchors, TransactionRecord } from './correct/execute.js'
import { SOURCE_GATE_VERSION } from './correct/source-gate.js'
import { SKETCH_PROPOSALS_VERSION, facadeAdoption, finishProposalsFromSketch, proposalsFromSketch } from './correct/from-sketch.js'
import { observationFates } from './correct/fates.js'
import type { ObservationFates } from './correct/fates.js'
import type { SketchProposalAccount } from './correct/from-sketch.js'
import { MASSING_OPS_VERSION, roofProposalsFromSketches } from './massing/ops.js'
import { outlineScale, OUTLINE_SCALE_AGREE, PLAN_OUTLINE_VERSION, readPlanOutline, scaleOutline } from './plan-outline.js'
import type { PlanSideOpening } from './plan-outline.js'
import { drawnStretches, PLAN_OPENINGS_VERSION, planSideInModel, SIDE_MARGIN, stretchAgreement } from './plan-openings.js'
import { massingRun } from './massing-result.js'
import type { PlanOutlineRead } from './plan-outline.js'
import type { MassingProposalAccount, OrientationHypothesis } from './massing/ops.js'
import { QUALITY_VERSION, qualityOf, reconcileLedger, settleDefects } from './correct/quality.js'
import type { DefectEntry, DefectResolution, ListedElements, QualitySummary } from './correct/quality.js'

/** v3.54.18: below this size an elevation picture is a thumbnail — too small for any element to be placed from it. */
export const MIN_SKETCH_FRAME_PX = { width: 240, height: 120 } as const

export type ConsultantWiring = {
  model: ConsultantModel
  price: Price
  spend?: ConsultSpend
  limits?: ConsultLimits
  /** At most this many rounds that may change the metric layer (two). */
  maxRounds?: number
  /** v3.54.3: at most this many rounds that may change the built geometry after the check (two); a last look reviews the last one. */
  maxGeometryRounds?: number
  /** v3.54.15 (research): also return LOCAL's own model, so a fact trace can compare the parameters before and after. */
  keepLocalModel?: boolean
  /** R: ask and record only. C: consume. */
  variant: 'R' | 'C'
  record?: (e: ConsultEvent) => void
  /** v3.54.3: the post-build check. ON by default: the analyzer renders its own neutral views (`model-views.ts`). */
  check?: 'ON' | 'OFF'
  /** Another renderer for the check's model views (research boards); absent: `renderModelViews` of the run's scene. */
  views?: (run: AnalysisRun) => ModelViewPicture[]
  /**
   * v3.54.14: the metric consultant (`metric-read.ts`) before the label rounds — an independent read of every storey's
   * plan and a section, a check of the analyzer's readings, the deterministic resolver, and a candidate the analyzer
   * rebuilds from what the resolver hands it. OFF by default. Its own transport may be another model than the rounds'.
   */
  metricRead?: 'ON' | 'OFF'
  metricModel?: ConsultantModel
  metricPrice?: Price
  /**
   * v3.54.14 (L-MS): the four automatic sketches (`sketch-step.ts`) on the model that stands after the metric step:
   * read, drawn, proportion-checked; a candidate the shape reader builds with them (form) and their finish zones, on
   * the same metric facts. OFF by default.
   */
  sketches?: 'ON' | 'OFF'
  sketchModel?: ConsultantModel
  sketchPrice?: Price
  /**
   * v3.54.14: the host's accepted revisions of consulted analyses (`accepted-consult.ts`). With one under this
   * analysis' binding, its stored answers stand in for every transport (no request, no reservation); without one, the
   * answers are recorded and kept when the analysis completes with no transport failure. `reanalyse` reads afresh.
   */
  accepted?: { store: AcceptedConsultStore; reanalyse?: boolean }
  /**
   * v3.54.16: the sketches' typed openings and chimneys handed to the correction executor as proposals (each judged
   * against the original picture). Default ON when sketches are read; OFF keeps them a reading only.
   */
  sketchCorrections?: 'ON' | 'OFF'
  /** v3.54.17: where LOCAL built no model, trace the plan outline and build the mass from it and the elevations (default ON with sketches). */
  massing?: 'ON' | 'OFF'
  /** v3.54.17: the plan outline read's own transport (default: the metric read's). */
  outlineModel?: ConsultantModel
  outlinePrice?: Price
  /**
   * v3.54.17 R2 (audit §6): the private exchange record (`exchange-log.ts`) — every request written before it is sent,
   * every answer as it is received, every reservation and settlement, the step processing reached and the first loss.
   * Written whatever the job's end; absent, nothing is recorded beyond the accepted revision (as before).
   */
  exchanges?: ExchangeLog
  /**
   * v3.54.17 R2 — CONTROLLED TEST ONLY (research and tests; the host never sets it): LOCAL runs as always, and then its
   * model is withheld, as if LOCAL had failed after reading the plan and its scale, so the path without a LOCAL model
   * runs on a package whose LOCAL builds. The result says so (reasonCode LOCAL_MODEL_WITHHELD_TEST); it is never an
   * organic result.
   */
  withholdLocalModel?: true
}

/** v3.54.14: what the sketch step read, accepted and changed (the rasters are not kept: they are redrawn from the sketches). */
export type SketchSummary = { reading: Omit<SketchReading, 'elevationSketches'>; form: { decision: 'ACCEPT' | 'ROLLBACK' | 'NOT_RUN'; why: string; measuredBefore?: BuiltMeasure; measuredAfter?: BuiltMeasure }; finish: { decision: 'ACCEPT' | 'ROLLBACK' | 'NOT_RUN'; why: string }; usd: number
  /** v3.54.16: the sketches' elements as proposals of the correction registry, and what the executor did with each. */
  semantic?: { version: string; decision: 'APPLIED' | 'NONE_KEPT' | 'NOT_RUN'; why: string; /** v3.54.18: per sketched elevation, whether its reading was adopted as a whole facade, on what counts. */ adoption?: Array<{ frameId: string; side?: string; drawn: number; supported: number; refuted: number; pending: number; decision: string; why: string; proposed: number }>; /** v3.54.18: the sketches' finish zones proposed as SET_FINISH (sides without regions). */ finishes?: { proposed: number; skipped: Array<{ sketchId: string; why: string }> }; /** v3.54.18: sides taken by the named miniature convention (source order), not read. */ sidesByConvention?: Array<{ frameId: string; side: string | null; basis: 'MINIATURE_CONVENTION_SOURCE_ORDER' }>; accounts: Array<{ frameId: string; side?: string; proposals: number; agreed: number; agreedIds?: Array<{ sketchId: string; modelId: string }>; skipped: Array<{ sketchId: string; why: string }> }>; /** v3.54.18: one row per element of every reading — what became of it (`buildapp.observation-fate` 1.0.0). */ fates?: ObservationFates; records: PatchRecord[]; transactions: TransactionRecord[]; /** v3.54.17: each sketch held against each body's roof (SET_ROOF proposals or why not), and the side assignment it was read under. */ massing?: MassingProposalAccount[]; orientation?: OrientationHypothesis; /** v3.54.17 R3: stacks of perpendicular sketches paired into one stack with both plan coordinates. */ chimneyFusion?: FusionRecord & { version: string } } }

/** v3.54.18: tolerances of the body arbitration, fixed before any result (a printed dimension, a published height). */
/** v3.54.18 R2: which source pictures get a frame changed (a content-disputed orthographic elevation keeps its frame): part of the accepted-revision key. */
export const SOURCE_FRAMES_RULE = 'frames2' as const
export const BODY_ARBITRATION = { version: '1.5.0', dimAgreeM: 0.3, dimAgreeShare: 0.04, heightAgreeM: 0.6, heightAgreeShare: 0.1 } as const
export type BodyEvidence = { bodies: number; registrations: Array<{ frameId: string; side: string; ok: boolean; code: string; why?: string }>; printed: Array<{ literal: string; valueM: number; modelM: number; agrees: boolean; /** arbitration 1.3.0: the traced outline's own extent, where the dimension agrees with it and the body leaves out only the small steps the massing's convention names */ outlineM?: number }>; height?: { publishedM: number; modelRidgeM: number; agrees: boolean }; /** v3.54.19: what the typed form of the house (form-read) says of this body's roofs. */ form?: { verdict: 'CONTRADICTS' | 'AGREES' | 'SILENT'; flatVolumes: number; reportedFlatVolumes: number; reportedMainRoof: string; reportedVolumes: number; /** arbitration 1.5.0: what the AGREED structure holds against this body's main volume (storeys, ridge direction) */ structure?: string[] }; contradictions: number; supports: number }
export type BodyArbitration = { version: string; local: BodyEvidence; /** LOCAL's body was judged with this many roof corrections from the same elevations applied (on a copy). */ localAfterRoofCorrections?: number; alternative?: BodyEvidence; massing?: { decision: string; why: string; usd: number }; /** 1.2.0: elevations that register on neither body, set aside on both sides. */ setAside?: { frames: string[]; why: string }; /** v3.54.21 review F1: LOCAL's form judged again on the ring where the source body's MAIN stands (one main-body rule for both bodies) */ localForm?: { main: string; before: string; after: string }; decision: 'LOCAL_STANDS' | 'REPLACED_BY_SOURCE_BODY'; why: string }

/** v3.54.17: the no-model path's delivery: a mass built from the source, or the anchors it lacks. */
export type MassingDelivery = {
  decision: 'BUILT' | 'NOT_BUILT' | 'NOT_RUN'
  why: string
  plan?: Omit<PlanOutlineRead, 'raw'> & { raw?: unknown }
  /** v3.54.19: the plan read on the sheet inside that outline (wall colour, outer faces, exterior gaps, partitions, interior doors). */
  skeleton?: PlanSkeleton
  records: PatchRecord[]
  transactions: TransactionRecord[]
  model?: CanonicalBuildingModel
  sceneText?: string
  sceneSha256?: string
  modelSha256?: string
  usd: number
  /**
   * v3.54.17 R2: whether the body was handed to the ordinary delivery (`massing-result.ts`): the result, model and scene
   * the host stores, and the revision the review looks at. Absent before v3.54.17 R2.
   */
  delivery?: { delivered: boolean; why: string; modelSha256?: string; sceneSha256?: string; revision?: string }
}

/** v3.54.16: one run of the correction executor: where it ran, on which revision, and every patch's and transaction's fate. */
export type CorrectionRun = { stage: string; baseRevision: string; revision: string; delivered: boolean; records: PatchRecord[]; transactions: TransactionRecord[]; why?: string }

/** v3.54.14: what the metric consultant read, checked, decided and what the analyzer built from it. */
export type MetricReadSummary = {
  promptVersions: { read: string; verify: string }
  resolverVersion: string
  model: string
  frames: Array<{ frameId: string; kind: MetricFrame['kind']; storey: string }>
  reads: IndependentRead[]
  checks: LocalCheck[]
  resolution: MetricResolution
  /** ACCEPT: the candidate is the model now; ROLLBACK / NO_CHANGE: LOCAL's stands; NOT_RUN: variant R or nothing handed. */
  decision: 'ACCEPT' | 'ROLLBACK' | 'NO_CHANGE' | 'NOT_RUN'
  why: string
  applied: { readings: Array<{ proposalId: string; status: string; why: string; valueCm?: number }>; spans: Array<{ proposalId: string; status: string; why: string; valueCm?: number }>; levels?: Array<{ proposalId: string; literal: string; status: string; why: string; valueM?: number }> }
  measured: { before?: BuiltMeasure; after?: BuiltMeasure }
  usd: number
}

/** One axis of the built wall outline against the consulted dimension that frames it, in the plan's own pixels. */
export type AxisOutline = {
  /** MATCHES: the outline ends where the dimension's ends are. SHORT: it stops inside them. BEYOND: it runs past them. */
  status: 'MATCHES' | 'SHORT' | 'BEYOND' | 'NOT_COMPARABLE'
  envelopePx?: [number, number]
  spanPx?: [number, number]
  spanM?: number
  /** Metres the outline lacks (SHORT) or adds (BEYOND) against the dimension, both ends together. */
  offM?: number
  why: string
}

export type RunState = {
  outcome: 'COMPLETED' | 'FAILED'
  code?: string
  reasonCode?: string | null
  stage?: string | null
  frameId?: string
  metric?: { relation: string; confidence: string; cmPerPixelX?: number; cmPerPixelY?: number }
  modelHash?: string
  masses?: number
  /**
   * v3.54.3: the built wall outline of the plan's storey (the analyzer's own envelope, outer wall faces, in the plan's
   * pixels) against the consulted whole dimensions that frame it — the same object, storey, axis and faces on both
   * sides of the comparison. Absent where nothing was consulted or no envelope was read.
   */
  outline?: { x: AxisOutline; y: AxisOutline }
}

export type RoundRecord = {
  round: number
  problem: Pick<LabelProblem, 'problemId' | 'frameId' | 'assetId'> & { labels: Array<{ labelId: string; box: unknown; lattices: unknown; binding?: unknown; why: string }> }
  consultation?: ConsultOutcome
  verdicts: ProposalVerdict[]
  readings: ConsultedReading[]
  spans?: ConsultedSpan[]
  before: RunState
  after?: RunState
  decision: 'ACCEPT' | 'ROLLBACK' | 'PARTIAL' | 'NO_CHANGE' | 'NOT_RUN' | 'CONSULTANT_FAILED'
  why: string
}

/** v3.54.3: the consultation of a plan whose scale is settled and whose walls close no box (CLASSIFY_BOUNDARY). */
export type BoundaryRound = {
  revision: string
  frameId: string
  status: string | null
  refused?: string
  observations: ReviewObservation[]
  verdicts: BoundaryVerdict[]
  sides: Array<'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT'>
  before: RunState
  after?: RunState
  decision: RoundRecord['decision']
  why: string
  usd: number
}

/** v3.54.3: one look at a built model, what it proposed, what the analyzer did with it, and the decision. */
export type GeometryRound = {
  round: number
  revision: string
  status: string | null
  refused?: string
  pictures: ModelCheckResult['pictures']
  observations: ReviewObservation[]
  /** The review of what the round before applied, feature by feature. */
  reviewed: Array<{ id: string; verdict: string; keep: boolean; note: string }>
  verdicts: GeometryVerdict[]
  corrections: RoofFeatureCorrection[]
  outcomes: RoofFeatureOutcome[]
  decision: GeometryDecision['decision'] | 'NOT_RUN' | 'REVIEW_ONLY' | 'CHECK_FAILED'
  why: string
  afterRevision?: string
  usd: number
  /** v3.54.16: the look's defects, and the registry operations the correction executor ran for it. */
  defects?: NonNullable<ConsultantReview['defects']>
  patches?: PatchRecord[]
  transactions?: TransactionRecord[]
}

/** v3.54.3: what the source check established, in the result an app consumes — findings open and corrected, by name. */
export type SourceCheckSummary = {
  schemaVersion: '1.0.0'
  /** CHECKED: the delivered revision was looked at. PARTLY: an earlier revision was, and it changed after. NOT_CHECKED: no look succeeded. */
  status: 'CHECKED' | 'PARTLY_CHECKED' | 'NOT_CHECKED'
  checkedRevision: string | null
  deliveredRevision: string | null
  reviewStatus: string | null
  looks: number
  findings: ReviewObservation[]
  corrections: Array<{ proposalId: string; operation: string; targetId: string; featureId?: string; state: 'APPLIED' | 'REFUSED_BY_ANALYZER' | 'HELD' | 'NO_CONSUMER' | 'REJECTED' | 'ROLLED_BACK' | 'NOT_APPLIED'; code?: string; review?: string; why: string }>
  checked: string[]
  notChecked: string[]
  outline?: RunState['outline']
  /**
   * Set when dimensions read with the consultant settle a scale the delivered model is NOT at, because the analyzer
   * could not compose the plan at that scale and the transaction kept the model before. The readings are right and
   * stay on the record; the model is an unreliable preview (its lengths are off by `ratio`), never a second truth.
   */
  scaleContradiction?: { modelCmPerPixel: number; consultedCmPerPixelX: number | null; consultedCmPerPixelY: number | null; ratio: number; refusal: string; dimensions: Array<{ literal: string; unit: string }> }
  /** Defects known and not corrected, each by code: what an app must show beside the model. */
  knownDefects: Array<{ code: string; what: string }>
  /** v3.54.16: the quality of the delivered revision, apart from CHECKED and from reuse (`correct/quality.ts`). */
  quality?: QualitySummary
  /** v3.54.16: every run of the correction executor (sketch channel, looks, rebinds) with each patch's and transaction's fate. */
  correctionRuns?: CorrectionRun[]
  /**
   * The model's quality, one axis at a time (never one grade): what ran, how the scale was settled, the outline against
   * the printed dimensions, the roof and the openings as the look found them, the interior (which no look certifies),
   * what may be measured, and how complete the look itself was.
   */
  axes: {
    run: 'COMPLETED'
    scale: { status: string; confidence: string | null; settledBy: 'CONSULTED_DIMENSIONS' | 'OWN_READINGS' | 'UNSETTLED' | 'CONTRADICTED' }
    outline: 'MATCHES' | 'MATCHES_WITHIN_A_WALL' | 'SHORT' | 'BEYOND' | 'NOT_COMPARED'
    roof: 'NO_DIFFERENCE_REPORTED' | 'CORRECTED_APPROXIMATE' | 'DIFFERENCE_OPEN' | 'NOT_CHECKED'
    openings: 'NO_DIFFERENCE_REPORTED' | 'DIFFERENCE_OPEN' | 'NOT_CHECKED'
    /** v3.54.16: REVIEWED_FROM_PLANS — the last look was shown each storey without its roof and lists the interior as checked. */
    interior: 'NOT_CHECKED' | 'REVIEWED_FROM_PLANS'
    quantities: string
    sourceCheck: SourceCheckSummary['status']
  }
}

/** v3.54.3: the consultation as the consumed result carries it: what was decided, round by round, without the pictures or the answers. */
export type ConsultationSummary = {
  schemaVersion: '1.0.0'
  contract: string
  prompt: string
  variant: 'R' | 'C'
  model: string
  usd: number
  /** The global house-description reader was never asked on this path. */
  globalDescription: 'DISABLED'
  local: { outcome: string; reasonCode: string | null; modelHash: string | null }
  metricRounds: Array<{ round: number; decision: string; why: string }>
  /** The outline consultation (CLASSIFY_BOUNDARY), when the plan closed no box at a settled scale. */
  boundary: { decision: string; why: string; sides: string[] } | null
  looks: Array<{ round: number; revision: string; status: string | null; decision: string; why: string }>
  roofFeatures: string[]
  /** v3.54.14: the metric consultant's outcome, when it ran (the full record is the analysis's `metricRead`). */
  metricRead?: { decision: string; why: string; corrected: number; agrees: number; unresolved: number; newSpans: number; usd: number }
  /** v3.54.14: the sketch step's outcome, when it ran (the full record is the analysis's `sketches`). */
  sketches?: { sides: string[]; form: string; finish: string; usd: number
    /** v3.54.18: per elevation reading — the side it was bound to and on what basis, and what the facade consumer did with it. */
    facades?: Array<{ frameId: string; label: string; side: string | null; sideBasis: string; adoption: string | null }>
    /** v3.54.18: the fate of every element the readings state, counted (`buildapp.observation-fate`; the rows are the analysis's own). */
    fates?: { version: string; built: number; verified: number; crossWitness: number; adopted: number; agrees: number; refusedBySource: number; undecided: number; noConsumer: number; notRegistered: number; other: number }
  }
  /** v3.54.18: LOCAL's body held against the sources (elevations registered, printed dimensions, published height). */
  bodyArbitration?: { decision: string; why: string; localContradictions: number; alternativeContradictions: number | null }
  /** v3.54.14: the accepted-revision rule on this path (`accepted-consult.ts`), when the host keeps a store. */
  accepted?: ConsultReuse
  /** v3.54.16: the quality of the delivered revision (never inferred from `accepted`) and the patches the executor kept. */
  quality?: { state: string; reasons: string[]; reviewCompleted: boolean; openKey: number; closedVerified: number }
  corrections?: { runs: number; committed: number; refused: number; registry: string }
}

export type ConsultedAnalysis = {
  /** v3.54.18: LOCAL's body held against the sources, and the body built from them when they contradict it. */
  bodyArbitration?: BodyArbitration
  /** v3.54.16 §7: the labelled elevations read when LOCAL built no model, UNCHECKED, with the anchors that are missing. */
  sketchesWithoutModel?: { sketches: SketchReading['sketches']; missingAnchors: string[]; usd: number; sides: Array<{ facade: string; frameId?: string; status: string; why: string }> }
  contract: string
  prompt: string
  variant: 'R' | 'C'
  /** The result the caller gets: the accepted run, or the LOCAL one. */
  run?: AnalysisRun
  error?: AnalysisError
  local: RunState
  /** v3.54.15: LOCAL's model, when the wiring asked to keep it (`keepLocalModel`). */
  localModel?: unknown
  final: RunState
  rounds: RoundRecord[]
  readings: ConsultedReading[]
  spans: ConsultedSpan[]
  usd: number
  /** v3.54.3: the outline consultation, when the plan closed no box at a settled scale. */
  boundary?: BoundaryRound
  /** v3.54.3: the looks at the built model and what each changed. */
  geometry: GeometryRound[]
  /** The roof features the delivered model holds from corrections. */
  roofFeatures: RoofFeatureCorrection[]
  sourceCheck?: SourceCheckSummary
  consultation?: ConsultationSummary
  /** v3.54.14: the metric consultant's record, when it ran. */
  metricRead?: MetricReadSummary
  /** v3.54.14: the sketch step's record, when it ran. */
  sketches?: SketchSummary
  /** Proof for the brief: the global house-description branch was never entered on this path. */
  globalDescription: 'DISABLED'
  /**
   * v3.54.17: where LOCAL built no model, the body and roof built from the plan outline and the elevations
   * (BUILD_MASSING on the empty model): the read, the executor's record, and — when committed — the model and its scene.
   */
  massing?: MassingDelivery
  /** the source body that did not replace LOCAL's (v3.54.21): on the record, not delivered */
  massingRejected?: MassingDelivery
  /** v3.54.21: the structure read as it left and came back — the exact pictures sent (PNG bytes), the texts beside them, the raw answer, the agreed structure and what the builder takes (a delivery shows the packet; nothing of it is logged) */
  structureRead?: { promptVersion: string; sent: Array<{ label: string; png: Uint8Array; width: number; height: number }>; sentText: string[]; raw: unknown; refused: string[]; agreed?: unknown; build?: unknown; features?: unknown }
}

const CONF_RANK: Record<string, number> = { INCONCLUSIVE: 0, WEAK: 1, SUPPORTED: 2, STRONG: 3 }

type Local = { run?: AnalysisRun; error?: AnalysisError; pkg?: SourcePackage; graph?: SourceObservationGraph; metrics?: MetricEvidenceSet; plans?: PlanDiagnosticsReport }

/** v3.54.16: how each run was made, so the correction executor's model can be delivered through the same run (`patchedModel`). */
const lineage = new WeakMap<Local, { input: AnalysisInput; options: AnalysisOptions }>()
/**
 * v3.54.17 R2: a run made of the body BUILD_MASSING built without LOCAL (`massing-result.ts`): the elevations' registrations
 * the executor binds through, and how a patched model of it is delivered again (the same envelope, never LOCAL's rebuild).
 */
/** v3.54.17 R2: an element index as the defect ledger reads it (id → type). */
const listedOf = (index: ElementIndex | undefined): ListedElements | undefined => (index ? new Map(index.elements.map((e) => [e.id, e.type])) : undefined)
/** v3.54.21: how many perspective pictures a model check is shown. */
export const CHECK_PERSPECTIVES = 2
/** v3.54.21: the pictures a structure read is asked of — fixed before any result. */
export const STRUCTURE_PICTURES = { minSidePx: 480, maxElevations: 6, maxPerspectives: 3, /** mean absolute difference of two 8 × 8 grey signatures (0–255) under which two pictures look the same */ sameLook: 6 } as const
/** An 8 × 8 grey signature of a picture (its mean brightness per cell): two sizes or crops of one rendering have nearly the same. */
export function pictureSignature(r: Raster): number[] {
  const out: number[] = []
  for (let gy = 0; gy < 8; gy += 1) for (let gx = 0; gx < 8; gx += 1) {
    let sum = 0
    let n = 0
    const [x0, x1, y0, y1] = [Math.floor((gx * r.width) / 8), Math.floor(((gx + 1) * r.width) / 8), Math.floor((gy * r.height) / 8), Math.floor(((gy + 1) * r.height) / 8)]
    const step = Math.max(1, Math.floor(Math.min(x1 - x0, y1 - y0) / 12))
    for (let y = y0; y < y1; y += step) for (let x = x0; x < x1; x += step) { const i = (y * r.width + x) * 4; sum += 0.299 * r.data[i] + 0.587 * r.data[i + 1] + 0.114 * r.data[i + 2]; n += 1 }
    out.push(n > 0 ? sum / n : 0)
  }
  return out
}
const massingOf = new WeakMap<Local, { views: BindView[]; rebuild: (model: CanonicalBuildingModel) => Local | undefined; /** the side of the plan sheet that is this body's front (a body built in the elevations' frame); absent: the sheet's foot */ planFront?: Side; /** v3.54.19: the plan skeleton in this body's frame (interior, exterior gaps) */ interior?: InteriorObservation; /** the sheet → model map as three mapped points of the plan frame: (0,0), (1000,0), (0,1000) px */ planMap?: PlanFrameOfModel; /** v3.54.21: the hypothesis the body was built from (its bodies, their roofs and fates, its cross gables) */ hypothesis?: MassingHypothesis; /** v3.54.21: the side drawings whose weak (LOCAL-only) labels a form-read/3 read overruled for this body — the side every later consumer takes for them */ weakSides?: Record<string, Side> }>()
/** v3.54.19: where the plan sheet lies in the delivered model's frame (an affine map stated by three points), for any overlay of the model on its plan. */
export type PlanFrameOfModel = { frameId: string; basis: 'OUTLINE_SCALE' | 'LOCAL_PLAN_REGISTRATION'; o: { x: number; z: number }; x1000: { x: number; z: number }; y1000: { x: number; z: number } }
async function attempt(input: AnalysisInput, options: AnalysisOptions): Promise<Local> {
  const l = await attemptRaw(input, options)
  lineage.set(l, { input, options })
  return l
}
async function attemptRaw(input: AnalysisInput, options: AnalysisOptions): Promise<Local> {
  try {
    const run = await runAnalysis(input, options)
    return { run, pkg: run.pkg, graph: run.graph, metrics: run.metrics, plans: run.planDiagnostics }
  } catch (error) {
    const e = error instanceof AnalysisError ? error : toAnalysisError(error)
    return { error: e, pkg: e.attachments?.pkg, graph: e.attachments?.graph, metrics: e.attachments?.metrics, plans: e.attachments?.plans }
  }
}

/**
 * How far an end of the built outline may lie from the end of the dimension that frames it and still be that end: one
 * wall of the sheet's own thickness (an overall dimension is drawn to a wall's face; which face, and a pixel of snap,
 * are what is uncertain), never less than 3 px. Fixed here, before any confirmation; it is not a share of the house.
 */
export const outlineTolerancePx = (wallPx: number): number => Math.max(3, wallPx)
/** A consulted dimension frames an axis of the outline when it is at least this share of the outline's length there. */
export const FRAMING_SHARE = 0.8

/**
 * The built outline against the consulted dimensions, like with like: the analyzer's own envelope of the plan's storey
 * (outer wall faces, plan pixels) and each ADMITTED or AGREEING dimension as the analyzer measured it on the same sheet
 * (its two snapped ends). A dimension shorter than `FRAMING_SHARE` of the outline is a part and claims nothing about it.
 * Of the framing ones the longest is the whole: an outline that stops inside it lacks what it measures (SHORT), one
 * that runs past it holds what it does not (BEYOND).
 */
export function outlineOf(l: Local): RunState['outline'] | undefined {
  const frameId = l.plans?.selectedPlanFrameId
  const plan = l.plans?.plans.find((p) => p.frameId === frameId) as { envelope?: { x0: number; y0: number; x1: number; y1: number } | null; wallPx?: number } | undefined
  const spans = (l.metrics?.consultedSpans ?? []).filter((o) => o.frameId === frameId && (o.status === 'ADMITTED' || o.status === 'AGREES_ONLY') && o.axis !== undefined && o.fromPx !== undefined && o.toPx !== undefined && o.valueCm !== undefined)
  if (!plan?.envelope || spans.length === 0) return undefined
  const tol = outlineTolerancePx(plan.wallPx ?? 3)
  const axis = (a: 'X' | 'Y'): AxisOutline => {
    const env: [number, number] = a === 'X' ? [plan.envelope!.x0, plan.envelope!.x1] : [plan.envelope!.y0, plan.envelope!.y1]
    const framing = spans.filter((o) => o.axis === a && (o.toPx as number) - (o.fromPx as number) >= FRAMING_SHARE * (env[1] - env[0])).sort((p, q) => (q.toPx as number) - (q.fromPx as number) - ((p.toPx as number) - (p.fromPx as number)))
    const whole = framing[0]
    if (!whole) return { status: 'NOT_COMPARABLE', envelopePx: env, why: 'no consulted dimension frames this axis of the outline (a part of it claims nothing about the whole)' }
    const [from, to] = [whole.fromPx as number, whole.toPx as number]
    const cmPerPx = (whole.valueCm as number) / (to - from)
    const inside = Math.max(0, env[0] - from - tol) + Math.max(0, to - env[1] - tol)
    const past = Math.max(0, from - env[0] - tol) + Math.max(0, env[1] - to - tol)
    const base = { envelopePx: env, spanPx: [from, to] as [number, number], spanM: Math.round(whole.valueCm as number) / 100 }
    if (past > 0) return { status: 'BEYOND', ...base, offM: Math.round((past + tol) * cmPerPx) / 100, why: `the built outline runs ${env[0]}..${env[1]} px where the printed ${(whole.valueCm as number) / 100} m is drawn ${from}..${to} px: it holds about ${(((past + tol) * cmPerPx) / 100).toFixed(2)} m the dimension does not measure` }
    if (inside > 0) return { status: 'SHORT', ...base, offM: Math.round((inside + tol) * cmPerPx) / 100, why: `the built outline runs ${env[0]}..${env[1]} px where the printed ${(whole.valueCm as number) / 100} m is drawn ${from}..${to} px: about ${(((inside + tol) * cmPerPx) / 100).toFixed(2)} m of what the dimension measures is not built` }
    // inside the wall tolerance but off the ticks by more than the raster's own 3 px an end: the decision is the same
    // (which face a dimension is drawn to is uncertain), but the difference is real length and is said, not absorbed
    const slack = Math.max(0, Math.abs(env[0] - from) - 3) + Math.max(0, Math.abs(to - env[1]) - 3)
    if (slack > 0) return { status: 'MATCHES', ...base, offM: Math.round(slack * cmPerPx) / 100, why: `the built outline (${env[0]}..${env[1]} px) ends within a wall (${tol} px) of where the printed ${(whole.valueCm as number) / 100} m is drawn (${from}..${to} px), but not at its ticks: about ${((slack * cmPerPx) / 100).toFixed(2)} m of difference lies inside that tolerance` }
    return { status: 'MATCHES', ...base, why: `the built outline ends where the printed ${(whole.valueCm as number) / 100} m does, within the raster's 3 px` }
  }
  return { x: axis('X'), y: axis('Y') }
}

export function stateOf(l: Local): RunState {
  const frameId = l.plans?.selectedPlanFrameId ?? undefined
  const sol = frameId ? l.metrics?.metricSolutions?.find((s) => s.frameId === frameId) : undefined
  const metric = sol ? { relation: sol.relation, confidence: sol.confidence, ...(sol.cmPerPixelX !== undefined ? { cmPerPixelX: sol.cmPerPixelX } : {}), ...(sol.cmPerPixelY !== undefined ? { cmPerPixelY: sol.cmPerPixelY } : {}) } : undefined
  if (l.run) {
    const outline = outlineOf(l)
    return { outcome: 'COMPLETED', ...(frameId ? { frameId } : {}), ...(metric ? { metric } : {}), modelHash: l.run.reconstruction.candidate.modelHash, masses: l.run.reconstruction.building.masses.length, ...(outline ? { outline } : {}) }
  }
  const f = l.error?.failure()
  return { outcome: 'FAILED', code: f?.code, reasonCode: f?.reasonCode ?? null, stage: f?.stage ?? null, ...(frameId ? { frameId } : {}), ...(metric ? { metric } : {}) }
}

/** The built outline holds something a framing dimension does not measure: the reason, else undefined. */
export function outlineContradiction(s: RunState): string | undefined {
  const o = s.outline
  if (!o) return undefined
  for (const a of [o.x, o.y]) if (a.status === 'BEYOND') return `OUTLINE_BEYOND_DIMENSION: ${a.why}`
  return undefined
}

const OUTLINE_RANK: Record<AxisOutline['status'], number> = { BEYOND: 0, NOT_COMPARABLE: 1, SHORT: 1, MATCHES: 2 }
const outlineScore = (s: RunState): number => (s.outline ? OUTLINE_RANK[s.outline.x.status] + OUTLINE_RANK[s.outline.y.status] : 2)

/**
 * ACCEPT / ROLLBACK / PARTIAL of a metric candidate against the last good state. Three decisions kept apart (v3.54.3):
 *  - whether a reading is admitted as a fact of the source is the metric layer's (`consultedReadings`, `consultedSpans`
 *    in the evidence): a rollback here never takes an admitted reading off the record;
 *  - whether the candidate replaces the model: a refusal becomes a model only on a scale its readings settle AND with an
 *    outline that does not run past the dimension that frames it; a model replaces a model when its scale is better
 *    settled, or — at an equally settled scale — when its outline agrees better with the printed dimensions;
 *  - what the model may be measured for is said by `SourceCheckSummary` and the measurement, never by this decision:
 *    an outline SHORT of its dimension is delivered as a partial preview with the defect named, not hidden.
 */
export function compareRuns(before: RunState, after: RunState): { decision: RoundRecord['decision']; why: string } {
  const v = compareRunsScale(before, after)
  if (v.decision !== 'ACCEPT') return v
  const why = outlineContradiction(after)
  return why ? { decision: 'ROLLBACK', why: `${why}: the scale is right but the plan the analyzer composed on it is not the drawing's — kept the state before` } : v
}

function compareRunsScale(before: RunState, after: RunState): { decision: RoundRecord['decision']; why: string } {
  const rb = CONF_RANK[before.metric?.confidence ?? 'INCONCLUSIVE'] ?? 0
  const ra = CONF_RANK[after.metric?.confidence ?? 'INCONCLUSIVE'] ?? 0
  const verified = (s: RunState): boolean => (CONF_RANK[s.metric?.confidence ?? 'INCONCLUSIVE'] ?? 0) >= 2
  if (before.outcome === 'COMPLETED' && after.outcome === 'FAILED') return { decision: 'ROLLBACK', why: `the candidate refuses (${after.code}/${after.reasonCode}) where LOCAL built a model` }
  if (before.outcome === 'FAILED' && after.outcome === 'COMPLETED')
    return verified(after) ? { decision: 'ACCEPT', why: `a refusal (${before.reasonCode}) became a model on a scale its readings settle (${after.metric?.confidence})` } : { decision: 'ROLLBACK', why: `the candidate builds a model, but on a scale its readings do not settle (${after.metric?.confidence ?? 'none'}): the correction is not what made it` }
  if (before.outcome === 'FAILED' && after.outcome === 'FAILED') {
    if (ra > rb || (before.reasonCode !== after.reasonCode && verified(after) && !verified(before))) return { decision: 'PARTIAL', why: `still refused, but the scale moved from ${before.metric?.confidence ?? 'none'} to ${after.metric?.confidence ?? 'none'}; the refusal is now ${after.reasonCode}` }
    return { decision: 'NO_CHANGE', why: `still refused (${after.reasonCode}), the scale ${after.metric?.confidence ?? 'none'} as before` }
  }
  // both models
  // the same model, now on a scale its readings settle: the model is kept and its scale is verified (a measurement gain)
  if (before.modelHash === after.modelHash) return ra > rb && verified(after) ? { decision: 'ACCEPT', why: `the same model, byte for byte, now on a scale its readings settle (${before.metric?.confidence ?? 'none'} → ${after.metric?.confidence}): verified, not changed` } : { decision: 'NO_CHANGE', why: 'the same model, byte for byte' }
  if (ra > rb && verified(after)) return { decision: 'ACCEPT', why: `the model is now built on a scale its readings settle (${before.metric?.confidence ?? 'none'} → ${after.metric?.confidence})` }
  if (verified(before) && verified(after)) {
    const x0 = before.metric?.cmPerPixelX ?? 0
    const x1 = after.metric?.cmPerPixelX ?? 0
    if (x0 > 0 && Math.abs(Math.log(x1 / x0)) > 0.03) return { decision: 'ROLLBACK', why: `the candidate moves a scale that was already settled (${x0} → ${x1} cm/px): a consulted reading does not overrule settled evidence` }
    // v3.54.3: a geometry gain needs no scale gain — at an equally settled scale the candidate stands when its outline
    // agrees better with the printed dimensions that frame it
    if (outlineScore(after) > outlineScore(before)) return { decision: 'ACCEPT', why: `the same settled scale, and the outline now agrees better with the printed dimensions (x ${before.outline?.x.status ?? 'not compared'} → ${after.outline?.x.status}, y ${before.outline?.y.status ?? 'not compared'} → ${after.outline?.y.status})` }
  }
  if (ra < rb) return { decision: 'ROLLBACK', why: `the scale is less settled than before (${before.metric?.confidence} → ${after.metric?.confidence})` }
  return { decision: 'ROLLBACK', why: 'a different model with no better-settled scale and no outline that agrees better with the printed dimensions: kept the one before' }
}

/**
 * v3.54.14: ACCEPT / ROLLBACK of the metric consultant's candidate. Everything `compareRuns` accepts is accepted; besides,
 * at a scale no less settled and not moved when it was settled, with an outline the printed dimensions do not
 * contradict, a candidate stands when the metric layer APPLIED at least one reading (or ADMITTED a span) the resolver
 * handed it with a witness — a printed value the drawing corroborates may change the model at the same scale.
 */
export function compareMetricRead(before: RunState, after: RunState, applied: number): { decision: 'ACCEPT' | 'ROLLBACK' | 'NO_CHANGE'; why: string } {
  const v = compareRuns(before, after)
  if (v.decision === 'ACCEPT') return { decision: 'ACCEPT', why: v.why }
  if (before.outcome !== 'COMPLETED' || after.outcome !== 'COMPLETED') return { decision: v.decision === 'NO_CHANGE' ? 'NO_CHANGE' : 'ROLLBACK', why: v.why }
  if (before.modelHash === after.modelHash) return { decision: 'NO_CHANGE', why: 'the same model, byte for byte' }
  if (applied === 0) return { decision: 'ROLLBACK', why: 'the metric layer applied none of the readings handed to it: a changed model with no applied reading is not the correction' }
  const rb = CONF_RANK[before.metric?.confidence ?? 'INCONCLUSIVE'] ?? 0
  const ra = CONF_RANK[after.metric?.confidence ?? 'INCONCLUSIVE'] ?? 0
  if (ra < rb) return { decision: 'ROLLBACK', why: `the scale is less settled than before (${before.metric?.confidence} → ${after.metric?.confidence})` }
  const x0 = before.metric?.cmPerPixelX ?? 0
  const x1 = after.metric?.cmPerPixelX ?? 0
  if (rb >= 2 && x0 > 0 && Math.abs(Math.log(x1 / x0)) > 0.03) return { decision: 'ROLLBACK', why: `the candidate moves a settled scale (${x0} → ${x1} cm/px)` }
  const contra = outlineContradiction(after)
  if (contra) return { decision: 'ROLLBACK', why: contra }
  return { decision: 'ACCEPT', why: `${applied} printed reading(s) handed with a witness were applied by the metric layer; the scale ${before.metric?.confidence ?? 'none'} → ${after.metric?.confidence ?? 'none'}, the outline not contradicted` }
}

async function frameRaster(pkg: SourcePackage, graph: SourceObservationGraph, frameId: string, options: AnalysisOptions) {
  await startDecoders()
  const frame = graph.coordinateFrames.find((f) => f.id === frameId)
  if (!frame) return undefined
  const asset = pkg.assets.find((a) => a.id === frame.assetId)
  const variant = asset?.variants.find((v) => v.byteHash === frame.variantByteHash)
  if (!variant) return undefined
  const got = await options.cache.get(variant.url)
  if (!got) return undefined
  const rasters = frameRasters()
  rasters.set(variant.byteHash, decodeImage(got.bytes))
  rasters.useFrames(graph.coordinateFrames)
  return { raster: rasters.get(variant.byteHash), assetId: frame.assetId }
}

/** The source pictures a check is shown: the plan the model was built from, the other plans, the elevations, a section. */
async function checkSources(l: Local, options: AnalysisOptions, perspectives: ReadonlyArray<{ frameId: string; corner?: string; mirrored?: boolean }> = []): Promise<CheckSource[]> {
  const out: CheckSource[] = []
  if (!l.pkg || !l.graph) return out
  const add = async (frameId: string, what: CheckSource['what'], label: string): Promise<void> => {
    const f = l.graph?.coordinateFrames.find((x) => x.id === frameId)
    const fr = f ? await frameRaster(l.pkg as SourcePackage, l.graph as SourceObservationGraph, frameId, options) : undefined
    if (!f || !fr?.raster) return
    // the whole picture, downscaled by a whole factor only when it is larger than the provider would keep: the pixels
    // the consultant reports are then the pixels it was sent, and the transform back to the frame is stated
    out.push({ img: overviewOf(fr.raster, frameId, []), raster: fr.raster, what, frameId, projection: f.roles.projection, label, sourceByteHash: f.variantByteHash })
  }
  const base = l.plans?.selectedPlanFrameId ?? undefined
  // v3.54.18 R3: a body built in the elevations' frame has its front on another side of the plan sheet — said, not left to be guessed
  const pf = massingOf.get(l)?.planFront
  const where = pf === 'LEFT' ? 'at the LEFT of this sheet (the model is turned a quarter against the sheet: its FRONT is the sheet\'s left side, its RIGHT the sheet\'s foot, its LEFT the sheet\'s head)' : pf === 'RIGHT' ? 'at the RIGHT of this sheet (the model is turned a quarter against the sheet: its FRONT is the sheet\'s right side, its RIGHT the sheet\'s head, its LEFT the sheet\'s foot)' : 'at the bottom of this sheet'
  if (base) await add(base, 'PLAN', `the floor plan the model was built from (its lowest storey); the house FRONT is ${where}`)
  const otherPlans = (l.run?.reconstruction.registrations.plans ?? []).filter((p) => p.frameId !== base).slice(0, 2)
  for (const p of otherPlans) await add(p.frameId, 'PLAN', `another floor plan of the same house (storey index ${p.storeyIndex})`)
  // v3.54.16: the elevations the analyzer registered first, then the largest — never the page's thumbnails because they
  // come first in the package (a 120 px copy shows the reviewer nothing a correction could be placed from)
  const registered = new Set((l.run?.reconstruction.facadeAlignment.views ?? []).map((v) => v.frameId))
  const area = (f: { size?: { width: number; height: number } }): number => (f.size?.width ?? 0) * (f.size?.height ?? 0)
  // v3.54.21: and not a thumbnail at all where it fills a slot of six — a 120 × 38 px copy was sent beside the large one
  // on seven houses (its skip is recorded by the structure read's inventory, the same rule)
  const elevations = l.graph.coordinateFrames.filter((x) => x.roles.projection === 'ORTHOGRAPHIC_ELEVATION' && Math.max(x.size?.width ?? 0, x.size?.height ?? 0) >= STRUCTURE_PICTURES.minSidePx / 2).sort((a, b) => Number(registered.has(b.id)) - Number(registered.has(a.id)) || area(b) - area(a) || a.id.localeCompare(b.id))
  for (const f of elevations.slice(0, 6)) {
    const role = f.roles.view && f.roles.view !== 'NOT_APPLICABLE' && f.roles.view !== 'UNKNOWN' ? `; the publisher's caption says ${f.roles.view}` : ''
    await add(f.id, 'ELEVATION', `a publisher's elevation drawing${role} (which model side it shows is for you to establish)`)
  }
  // v3.54.21: the largest picture the page labels a section, and none that is a placeholder (a 32 × 32 px loading image
  // was shown to the reviewer as "the publisher's section drawing")
  const section = l.graph.coordinateFrames.filter((x) => x.roles.projection === 'ORTHOGRAPHIC_SECTION' && Math.max(x.size?.width ?? 0, x.size?.height ?? 0) >= STRUCTURE_PICTURES.minSidePx / 2).sort((a, b) => area(b) - area(a) || a.id.localeCompare(b.id))[0]
  if (section) await add(section.id, 'OTHER_SOURCE', "the publisher's section drawing")
  // v3.54.21: the perspective pictures the structure read was asked of, as a QUALITATIVE witness: how volumes and roofs
  // relate (a recess, a porch, the depth of a balcony, where two roofs meet) is often plainer there than on an elevation.
  // Nothing is placed or sized from one — its camera is not recovered — and the label says so, with the corner it looks at.
  // v3.54.21: of the perspectives the structure read was given, the reviewer gets those looking at DIFFERENT corners first
  // (the third of three renderings, the only one showing the rear terrace's glazed doors, was left out by frame order)
  const byCorner: Array<(typeof perspectives)[number]> = []
  for (const q of perspectives) if (!byCorner.some((p) => p.corner && p.corner !== 'OTHER' && p.corner === q.corner)) byCorner.push(q)
  for (const q of perspectives) if (!byCorner.includes(q)) byCorner.push(q)
  for (const q of byCorner.slice(0, CHECK_PERSPECTIVES)) await add(q.frameId, 'OTHER_SOURCE', `a PERSPECTIVE rendering of the finished house (not an elevation, not to scale${q.corner && q.corner !== 'OTHER' ? `; it looks at the house's ${q.corner.replace('_', '-')} — compare it with the model's axonometric from that corner` : ''}${q.mirrored ? '; it shows the house MIRRORED against the elevations' : ''}): use it only for how volumes and roofs relate — a recess, a porch, the eaves' run, where two roofs meet. A difference you see only here is a qualitative finding: name it, but never give a position or a size from this picture`)
  return out
}

/**
 * The service entrypoint: LOCAL first; then at most `maxRounds` metric consultations, each consumed (C) or only recorded
 * (R); then, on the model that stands, at most `maxGeometryRounds` checks that may change its geometry and a last look
 * that reviews it. Never throws because of the consultant: its failure is a record, and the result before it stands.
 */
/**
 * v3.54.17 R2: with an exchange record, every transport the path may use is wrapped innermost (before the accepted-revision
 * recorder) and the books beside it; the job's end and its first loss are written whether it returns or throws.
 */
export async function consultAnalysis(input: AnalysisInput, options: AnalysisOptions, wiring: ConsultantWiring): Promise<ConsultedAnalysis> {
  const log = wiring.exchanges
  if (!log) return consultAnalysisBody(input, options, wiring)
  const v = { contract: CONSULTANT_CONTRACT_VERSION, prompt: CONSULTANT_PROMPT_VERSION, executor: CORRECTION_EXECUTOR_VERSION, registry: CORRECTION_REGISTRY_VERSION }
  const wrapped: ConsultantWiring = {
    ...wiring,
    model: log.wrap(wiring.model, 'ROUNDS', v),
    ...(wiring.metricModel ? { metricModel: log.wrap(wiring.metricModel, 'METRIC', { ...v, read: METRIC_READ_PROMPT_VERSION, verify: METRIC_VERIFY_PROMPT_VERSION }) } : {}),
    ...(wiring.sketchModel ? { sketchModel: log.wrap(wiring.sketchModel, 'SKETCH', { ...v, sketch: ELEVATION_SKETCH_PROMPT_VERSION, parser: String(ELEVATION_SKETCH_PARSER_VERSION) }) } : {}),
    // without its own transport the outline read uses the metric read's (then the rounds'), recorded under that role and
    // with its step (PLAN_OUTLINE) in the request file
    ...(wiring.outlineModel ? { outlineModel: log.wrap(wiring.outlineModel, 'OUTLINE', { ...v, outline: PLAN_OUTLINE_VERSION }) } : {}),
    ...(wiring.spend ? { spend: log.wrapSpend(wiring.spend) } : {}),
  }
  try {
    const out = await consultAnalysisBody(input, options, wrapped)
    if (out.run) log.end('COMPLETED', { modelSha256: out.run.result.modelSha256, sceneSha256: out.run.result.sceneSha256 })
    else {
      const f = out.error?.failure()
      log.failed(log.current(), out.error ?? new Error('the consultation ended with neither a model nor a refusal'))
      log.end('FAILED', { code: f?.code ?? 'ANALYSIS_FAILED', reasonCode: f?.reasonCode ?? null })
    }
    return out
  } catch (e) {
    log.failed(log.current(), e)
    log.end(options.signal?.aborted ? 'CANCELLED' : 'FAILED')
    throw e
  }
}

async function consultAnalysisBody(input: AnalysisInput, options: AnalysisOptions, wiring: ConsultantWiring): Promise<ConsultedAnalysis> {
  const startedAt = (options.now ?? (() => new Date()))().toISOString()
  const stage = (name: string, detail?: Record<string, unknown>): void => wiring.exchanges?.stage(name, detail)
  const record = wiring.record ?? (() => undefined)
  const now = options.now ?? (() => new Date())
  const limits = wiring.limits ?? DEFAULT_CONSULT_LIMITS
  const maxRounds = wiring.maxRounds ?? 2
  record({ at: now().toISOString(), kind: 'PATH', path: 'CONSULTANT', variant: wiring.variant, globalDescription: 'DISABLED', contract: CONSULTANT_CONTRACT_VERSION, prompt: CONSULTANT_PROMPT_VERSION, model: wiring.model.model })
  stage('LOCAL')
  let local = await attempt(input, { ...options, consulted: undefined, consultedSpans: undefined, crossAxisWitness: undefined, roofFeatures: undefined, reuseMetrics: undefined, glazedEnds: undefined })
  if (wiring.withholdLocalModel && local.run) {
    const r = local.run
    const withheld = new AnalysisError('ANALYSIS_FAILED', 'CONTROLLED TEST: LOCAL built a model and it was withheld, so the path without a LOCAL model runs (never an organic result)', { reasonCode: 'LOCAL_MODEL_WITHHELD_TEST', diagnostics: planCounts(r.planDiagnostics) })
    local = { error: withheld, pkg: r.pkg, graph: r.graph, metrics: r.metrics, plans: r.planDiagnostics }
    record({ at: now().toISOString(), kind: 'LOCAL_MODEL_WITHHELD_TEST', modelHash: r.reconstruction.candidate.modelHash })
  }
  const localState = stateOf(local)
  record({ at: now().toISOString(), kind: 'LOCAL', state: localState })
  // v3.54.14: an accepted revision of this binding answers every request; otherwise the answers are recorded
  const answers: RecordedAnswer[] = []
  const transportFailures = { count: 0 }
  const replayCounter = { replayed: 0, missing: 0 }
  let acceptedState: { key: string; binding: ReturnType<typeof consultBinding>['binding']; reused?: AcceptedConsultRevision; why?: 'NO_ACCEPTED_REVISION' | 'REANALYSIS_ASKED' } | undefined
  if (wiring.accepted && local.pkg) {
    const b = consultBinding({
      sourcePackageHash: local.pkg.contentHash,
      analyzer: `${ANALYSIS_SERVICE_VERSION}/${SOLVER_V2_VERSION}`,
      consultant: [CONSULTANT_CONTRACT_VERSION, CONSULTANT_PROMPT_VERSION, METRIC_READ_PROMPT_VERSION, METRIC_VERIFY_PROMPT_VERSION, METRIC_RESOLVER_VERSION, ELEVATION_SKETCH_PROMPT_VERSION, `parser${ELEVATION_SKETCH_PARSER_VERSION}`, SKETCH_STEP_VERSION, CHOOSE_VERSION, ACCEPTED_CONSULT_VERSION, `registry${CORRECTION_REGISTRY_VERSION}`, `executor${CORRECTION_EXECUTOR_VERSION}`, `gate${SOURCE_GATE_VERSION}`, `sketchProposals${SKETCH_PROPOSALS_VERSION}`, `quality${QUALITY_VERSION}`, `massing${MASSING_OPS_VERSION}`, `massingBody${MASSING_VERSION}`, `bodyArbitration${BODY_ARBITRATION.version}`, SOURCE_FRAMES_RULE, `outline${PLAN_OUTLINE_VERSION}`, `planOpenings${PLAN_OPENINGS_VERSION}`, `skeleton${PLAN_SKELETON_VERSION}`, `interior${INTERIOR_OPS_VERSION}`, `site${SITE_DIMENSIONS_VERSION}`, `facadeMetric${FACADE_METRIC_VERSION}`, `form${FORM_READ_VERSION}`, `structure${STRUCTURE_VERSION}`, `arbitration${BODY_ARBITRATION.version}`].join(','),
      models: { ROUNDS: wiring.model.model, ...(wiring.metricRead === 'ON' ? { METRIC: (wiring.metricModel ?? wiring.model).model } : {}), ...(wiring.sketches === 'ON' ? { SKETCH: (wiring.sketchModel ?? wiring.model).model } : {}) },
      settings: `strict=${wiring.model.strict === true || wiring.metricModel?.strict === true || wiring.sketchModel?.strict === true ? 'on' : 'off'};variant=${wiring.variant};metric=${wiring.metricRead ?? 'OFF'};sketches=${wiring.sketches ?? 'OFF'};rounds=${maxRounds};geometryRounds=${wiring.maxGeometryRounds ?? '-'};check=${wiring.check ?? 'ON'};sketchCorrections=${wiring.sketchCorrections ?? 'ON'}`,
    })
    const stored = wiring.accepted.reanalyse ? undefined : wiring.accepted.store.get(b.key)
    acceptedState = { key: b.key, binding: b.binding, ...(stored ? { reused: stored } : { why: wiring.accepted.reanalyse ? 'REANALYSIS_ASKED' as const : 'NO_ACCEPTED_REVISION' as const }) }
    const { spend: _unbooked, ...rest } = wiring
    void _unbooked
    wiring = stored
      ? { ...rest, model: replayModel(wiring.model, 'ROUNDS', stored.answers, replayCounter), ...(wiring.metricModel ? { metricModel: replayModel(wiring.metricModel, 'METRIC', stored.answers, replayCounter) } : {}), ...(wiring.sketchModel ? { sketchModel: replayModel(wiring.sketchModel, 'SKETCH', stored.answers, replayCounter) } : {}), ...(wiring.outlineModel ? { outlineModel: replayModel(wiring.outlineModel, 'OUTLINE', stored.answers, replayCounter) } : {}) }
      : { ...wiring, model: recordingModel(wiring.model, 'ROUNDS', answers, transportFailures), ...(wiring.metricModel ? { metricModel: recordingModel(wiring.metricModel, 'METRIC', answers, transportFailures) } : {}), ...(wiring.sketchModel ? { sketchModel: recordingModel(wiring.sketchModel, 'SKETCH', answers, transportFailures) } : {}), ...(wiring.outlineModel ? { outlineModel: recordingModel(wiring.outlineModel, 'OUTLINE', answers, transportFailures) } : {}) }
    record({ at: now().toISOString(), kind: 'ACCEPTED_REVISION', key: b.key, state: stored ? 'REUSED' : 'NEW_CANDIDATE', ...(stored ? { acceptedAt: stored.acceptedAt } : {}) })
  }
  let good: Local = local
  let goodState = localState
  const rounds: RoundRecord[] = []
  const readings: ConsultedReading[] = []
  const spans: ConsultedSpan[] = []
  // v3.54.15: printed level marks the metric consultant handed (admitted, or refused, by the section's own ladder)
  const levels: ConsultedLevel[] = []
  const seen = new Set<string>()
  let usd = 0
  let basis: Local = local
  // v3.54.14: the metric consultant, before the label rounds
  let metricRead: MetricReadSummary | undefined
  if (wiring.metricRead === 'ON' && local.pkg && local.graph && local.metrics) {
    stage('METRIC_READ')
    const mModel = wiring.metricModel ?? wiring.model
    const mPrice = wiring.metricPrice ?? wiring.price
    const frames: MetricFrame[] = []
    const addFrame = async (frameId: string, kind: MetricFrame['kind']): Promise<void> => {
      const f = local.graph?.coordinateFrames.find((x) => x.id === frameId)
      if (!f || frames.some((x) => x.frameId === frameId)) return
      const fr = await frameRaster(local.pkg as SourcePackage, local.graph as SourceObservationGraph, frameId, options)
      if (!fr?.raster) return
      const asset = local.pkg?.assets.find((a) => a.id === f.assetId)
      frames.push({ frameId, kind, storey: (['GROUND', 'UPPER', 'ATTIC', 'BASEMENT'].includes(String(f.roles.storey)) ? f.roles.storey : 'UNKNOWN') as MetricFrame['storey'], raster: fr.raster, caption: (asset?.caption ?? '').slice(0, 120) })
    }
    const base = local.plans?.selectedPlanFrameId ?? undefined
    if (base) await addFrame(base, 'PLAN')
    for (const pl of (local.run?.reconstruction.registrations.plans ?? []).filter((x) => x.frameId !== base).slice(0, 2)) await addFrame(pl.frameId, 'PLAN')
    // v3.54.21: never a placeholder as the section (a 32 × 32 px loading image was read for dimensions)
    const sections = local.graph.coordinateFrames.filter((x) => x.roles.projection === 'ORTHOGRAPHIC_SECTION' && Math.max(x.size?.width ?? 0, x.size?.height ?? 0) >= STRUCTURE_PICTURES.minSidePx / 2)
    const regSection = local.run?.reconstruction.registrations.section?.frameId
    const section = sections.find((x) => x.id === regSection) ?? sections[0]
    if (section) await addFrame(section.id, 'SECTION')
    const ctx = { model: mModel, price: mPrice, ...(wiring.spend ? { spend: wiring.spend } : {}), record: (e: { at: string; kind: string; [k: string]: unknown }) => record(e), ...(options.signal ? { signal: options.signal } : {}), now }
    const reads = await readDimensions(ctx, frames)
    const table = localTableOf(local.metrics, frames.map((f) => f.frameId))
    const checks = await verifyLocal(ctx, frames, table)
    const footprint = local.pkg.publishedFacts.find((f) => f.key === 'footprint_area' && f.unit === 'm2')?.value
    const resolution = resolveMetric({ metrics: local.metrics, table, reads, checks, consultant: { engine: `metric-consultant.${mModel.id}`, model: mModel.model }, ...(typeof footprint === 'number' ? { publishedFootprintM2: footprint } : {}) })
    const mUsd = [...reads, ...checks].reduce((a, r) => a + r.usd, 0)
    usd += mUsd
    const measuredBefore = local.run ? measureBuilt(local.run.reconstruction.model, compileBuilding(local.run.reconstruction.model)) : undefined
    metricRead = { promptVersions: { read: METRIC_READ_PROMPT_VERSION, verify: METRIC_VERIFY_PROMPT_VERSION }, resolverVersion: METRIC_RESOLVER_VERSION, model: mModel.model, frames: frames.map((f) => ({ frameId: f.frameId, kind: f.kind, storey: f.storey })), reads, checks, resolution, decision: 'NOT_RUN', why: '', applied: { readings: [], spans: [] }, measured: { ...(measuredBefore ? { before: measuredBefore } : {}) }, usd: Math.round(mUsd * 1e6) / 1e6 }
    if (wiring.variant === 'R') metricRead.why = 'variant R: read, checked and resolved; nothing handed to the analyzer'
    else if (resolution.readings.length === 0 && resolution.spans.length === 0 && (resolution.levels ?? []).length === 0) {
      metricRead.decision = 'NO_CHANGE'
      metricRead.why = 'the resolver handed the analyzer nothing: every API reading agreed, was unresolved without a witness, or had no label'
    } else {
      const candidate = await attempt({ kind: 'PACKAGE', pkg: local.pkg, graph: local.graph }, { ...options, consulted: resolution.readings, consultedSpans: resolution.spans, consultedLevels: resolution.levels ?? [], crossAxisWitness: true, roofFeatures: undefined, reuseMetrics: undefined, glazedEnds: undefined })
      const after = stateOf(candidate)
      const appliedR = (candidate.metrics?.consultedReadings ?? []).map((o) => ({ proposalId: o.proposalId, status: o.status, why: o.why, ...(o.valueCm !== undefined ? { valueCm: o.valueCm } : {}) }))
      const appliedS = (candidate.metrics?.consultedSpans ?? []).map((o) => ({ proposalId: o.proposalId, status: o.status, why: o.why, ...(o.valueCm !== undefined ? { valueCm: o.valueCm } : {}) }))
      // v3.54.15: each handed level's fate — admitted by the drawing (LEVEL_DATUM from the consultant), or refused with why
      const admittedLevels = (candidate.metrics?.evidence ?? []).filter((e) => e.kind === 'LEVEL_DATUM' && e.provenance.extractor === 'VISION_VALIDATED' && /metric-consultant|claude/.test(e.provenance.detail ?? '') )
      const refusedLevels = (candidate.metrics?.unresolved ?? []).filter((u) => u.id.startsWith('gap-consulted-levels') || /consultant's \d+ level mark/.test(u.what))
      const appliedL = (resolution.levels ?? []).map((l) => {
        const hit = admittedLevels.find((e) => e.frameId === l.frameId && e.textBox && Math.abs((e.textBox.x0 + e.textBox.x1) / 2 - (l.box.x0 + l.box.x1) / 2) < 30 && Math.abs((e.textBox.y0 + e.textBox.y1) / 2 - (l.box.y0 + l.box.y1) / 2) < 30)
        const gap = (candidate.metrics?.unresolved ?? []).find((u) => u.frameId === l.frameId && u.what.includes(`"${l.literal}"`)) ?? refusedLevels.find((u) => u.frameId === l.frameId)
        return { proposalId: l.proposalId, literal: l.literal, status: hit ? 'ADMITTED' : gap ? 'REFUSED' : 'NOT_CONSUMED', why: hit ? `admitted by the section's ladder as ${hit.value} m` : gap ? gap.reason : 'the section did not take it (the analyzer admitted levels of its own there, or the frame is not a section)', ...(hit && typeof hit.value === 'number' ? { valueM: hit.value } : {}) }
      })
      metricRead.applied = { readings: appliedR, spans: appliedS, levels: appliedL }
      const n = appliedR.filter((o) => o.status === 'APPLIED').length + appliedS.filter((o) => o.status === 'ADMITTED').length + appliedL.filter((o) => o.status === 'ADMITTED').length
      const v = compareMetricRead(goodState, after, n)
      metricRead.decision = v.decision
      metricRead.why = v.why
      if (candidate.run) metricRead.measured.after = measureBuilt(candidate.run.reconstruction.model, compileBuilding(candidate.run.reconstruction.model))
      record({ at: now().toISOString(), kind: 'METRIC_READ_ROUND', decision: v.decision, why: v.why, before: goodState, after })
      if (v.decision === 'ACCEPT') {
        good = candidate
        goodState = after
        basis = candidate
        readings.push(...resolution.readings)
        spans.push(...resolution.spans)
        levels.push(...(resolution.levels ?? []))
      }
    }
  }
  /**
   * v3.54.17 / v3.54.18: the body and roof from the plan outline and the elevation readings, without LOCAL's model or
   * registrations — one function for both uses: LOCAL built no model, or (v3.54.18) LOCAL built a body the sources
   * contradict. It builds and wraps the candidate; whether it stands is the caller's decision.
   */
  // v3.54.20: the STRUCTURE read — asked once of all the sheets (the sketched elevations, the ground-floor plan, a
  // section, the page's facts), agreed property by property with witnesses that are not this answer (structure.ts), and
  // taken by the body builder, by the arbitration and by the assignment of unlabelled elevations. Not asked with fewer
  // than two sketched elevations.
  type StructureMemo = { read: FormRead; frames: string[]; agreed?: AgreedStructure; build?: BuildStructure; /** v3.54.21: the house's features as the sources state them, fixed here — before any model is judged */ features?: SourceFeature[]; /** the perspective pictures it was asked of, with the corner the read says each looks at */ perspectives?: Array<{ frameId: string; corner?: string; mirrored?: boolean }> }
  let structureMemo: StructureMemo | undefined
  /** v3.54.21 review F5: the agreement of a memo made before the plan read named its parts, to run again (no request) when they come */
  let structureReagree: ((planParts: readonly string[]) => void) | undefined
  const structureOf = async (A: { pkg0: SourcePackage; graph0: SourceObservationGraph; sketches: SketchReading['sketches']; planRaster?: Raster; planFrameId?: string; planParts?: readonly string[] }): Promise<StructureMemo | undefined> => {
    if (structureMemo) {
      // the body arbitration asks first, before the plan read has named the plan's parts: when they come, the same answer
      // is agreed again with them as a witness (a garage the plan names is then witnessed, as on the path that asks later)
      if (A.planParts && structureReagree && structureMemo.read.form) {
        structureReagree(A.planParts)
        structureReagree = undefined
        record({ at: now().toISOString(), kind: 'STRUCTURE_AGREED_AGAIN', planParts: A.planParts, agreed: structureMemo.agreed ?? null, taken: structureMemo.build ?? null, features: structureMemo.features ?? [], why: `the plan read named its parts (${A.planParts.join(', ') || 'none'}) after the structure was first agreed without them: the same answer agreed again with them as a witness — no request` })
      }
      return structureMemo
    }
    const sketched = A.sketches.filter((x) => x.sketch)
    // v3.54.21: the read is asked of the publisher's ORIGINAL elevation pictures, chosen from the package — not of the list
    // of elevations a sketch succeeded on (a sketch is a view of the read and a witness of it, never the gate to it). Each
    // side's largest picture is sent once; a thumbnail (< 480 px) or a second copy of the same bytes is not; every choice
    // and every omission is recorded with its reason, and so is what the provider was actually sent (its pixels and factor).
    const images: Array<{ role: 'ELEVATION' | 'PLAN' | 'SECTION' | 'PERSPECTIVE'; n?: number; frameId: string; caption: string; sourceByteHash: string; sourcePx: [number, number]; sentPx: [number, number]; factor: number; origin: string }> = []
    const skipped: Array<{ role: string; frameId: string; px: [number, number]; why: string }> = []
    const sentOf = (r: Raster): { sentPx: [number, number]; factor: number } => { const f = Math.max(1, Math.max(r.width, r.height) / MAX_SIDE); return f === 1 ? { sentPx: [r.width, r.height], factor: 1 } : { sentPx: [Math.max(1, Math.round(r.width / f)), Math.max(1, Math.round(r.height / f))], factor: Math.round(f * 1000) / 1000 } }
    const originOf = (k: number): string => `the publisher's own picture, decoded and sent as PNG${k > 1 ? `, resampled by area to ${MAX_SIDE} px on its longer side (1 : ${k}; every source pixel weighs in)` : ' at its own resolution'}`
    const pxOf = (f: { size?: { width: number; height: number } }): [number, number] => [f.size?.width ?? 0, f.size?.height ?? 0]
    const sketchOf = new Map(sketched.map((x) => [x.frameId, x]))
    // the elevations a sketch was made of come first, in the sketches' own order (the numbering a recorded answer was given
    // stays the numbering it is replayed under); then the others, the largest first
    const sketchOrder = new Map(sketched.map((x, i) => [x.frameId, i]))
    const elevFrames = A.graph0.coordinateFrames.filter((f) => f.roles.projection === 'ORTHOGRAPHIC_ELEVATION').sort((a, b) => (sketchOrder.get(a.id) ?? 1e6) - (sketchOrder.get(b.id) ?? 1e6) || pxOf(b)[0] * pxOf(b)[1] - pxOf(a)[0] * pxOf(a)[1] || a.id.localeCompare(b.id))
    const pictures: Array<{ caption: string; raster: Raster; frameId: string }> = []
    const seenBytes = new Set<string>()
    const perView = new Map<string, number>()
    for (const f of elevFrames) {
      const px = pxOf(f)
      // the side the publisher's own caption names, where it names one; else what the sketch was told; else unspecified
      const own = f.roles.view && f.roles.view !== 'NOT_APPLICABLE' && f.roles.view !== 'UNKNOWN' && f.roles.view !== 'SIDE_UNSPECIFIED' ? f.roles.view : undefined
      const view = own ?? sketchOf.get(f.id)?.facade ?? 'SIDE_UNSPECIFIED'
      if (seenBytes.has(f.variantByteHash)) { skipped.push({ role: 'ELEVATION', frameId: f.id, px, why: 'the same bytes as a picture already chosen' }); continue }
      if (Math.max(px[0], px[1]) < STRUCTURE_PICTURES.minSidePx) { skipped.push({ role: 'ELEVATION', frameId: f.id, px, why: `a thumbnail (${px[0]} × ${px[1]} px): not an elevation a roof can be read from` }); continue }
      // one picture per captioned side; pictures whose caption does not tell the side apart are all kept (up to the limit)
      const cap = view === 'SIDE_UNSPECIFIED' ? 4 : 1
      if ((perView.get(view) ?? 0) >= cap) { skipped.push({ role: 'ELEVATION', frameId: f.id, px, why: `another picture captioned ${view} is already chosen (the larger, or the one a sketch was made of)` }); continue }
      if (pictures.length >= STRUCTURE_PICTURES.maxElevations) { skipped.push({ role: 'ELEVATION', frameId: f.id, px, why: `${STRUCTURE_PICTURES.maxElevations} elevation pictures are already chosen` }); continue }
      const r = await frameRaster(A.pkg0, A.graph0, f.id, options)
      if (!r?.raster) { skipped.push({ role: 'ELEVATION', frameId: f.id, px, why: 'its bytes are not in the cache: not decoded' }); continue }
      seenBytes.add(f.variantByteHash)
      perView.set(view, (perView.get(view) ?? 0) + 1)
      const caption = view === 'SIDE_UNSPECIFIED' ? 'SIDE (which side is not captioned)' : view
      pictures.push({ caption, raster: r.raster, frameId: f.id })
      images.push({ role: 'ELEVATION', n: pictures.length, frameId: f.id, caption, sourceByteHash: f.variantByteHash, sourcePx: [r.raster.width, r.raster.height], ...sentOf(r.raster), origin: originOf(sentOf(r.raster).factor) })
    }
    // perspective pictures: a qualitative witness (a recess, a porch, how two roofs meet) — the largest few, no two alike
    const perspectives: Array<{ caption: string; raster: Raster; frameId: string }> = []
    const signatures: number[][] = []
    const perspFrames = A.graph0.coordinateFrames.filter((f) => f.roles.projection === 'PERSPECTIVE').sort((a, b) => pxOf(b)[0] * pxOf(b)[1] - pxOf(a)[0] * pxOf(a)[1] || a.id.localeCompare(b.id))
    for (const f of perspFrames) {
      const px = pxOf(f)
      if (seenBytes.has(f.variantByteHash)) { skipped.push({ role: 'PERSPECTIVE', frameId: f.id, px, why: 'the same bytes as a picture already chosen' }); continue }
      if (Math.max(px[0], px[1]) < STRUCTURE_PICTURES.minSidePx) { skipped.push({ role: 'PERSPECTIVE', frameId: f.id, px, why: `a thumbnail (${px[0]} × ${px[1]} px)` }); continue }
      if (perspectives.length >= STRUCTURE_PICTURES.maxPerspectives) { skipped.push({ role: 'PERSPECTIVE', frameId: f.id, px, why: `${STRUCTURE_PICTURES.maxPerspectives} perspective pictures are already chosen (the largest, no two alike)` }); continue }
      const r = await frameRaster(A.pkg0, A.graph0, f.id, options)
      if (!r?.raster) { skipped.push({ role: 'PERSPECTIVE', frameId: f.id, px, why: 'its bytes are not in the cache: not decoded' }); continue }
      const sig = pictureSignature(r.raster)
      if (signatures.some((q) => q.reduce((t, v, i) => t + Math.abs(v - sig[i]), 0) / q.length < STRUCTURE_PICTURES.sameLook)) { skipped.push({ role: 'PERSPECTIVE', frameId: f.id, px, why: 'it looks the same as a perspective already chosen (another size or crop of it)' }); continue }
      signatures.push(sig)
      seenBytes.add(f.variantByteHash)
      perspectives.push({ caption: 'the publisher\'s rendering', raster: r.raster, frameId: f.id })
      images.push({ role: 'PERSPECTIVE', n: perspectives.length, frameId: f.id, caption: 'PERSPECTIVE (a rendering, not to scale)', sourceByteHash: f.variantByteHash, sourcePx: [r.raster.width, r.raster.height], ...sentOf(r.raster), origin: originOf(sentOf(r.raster).factor) })
    }
    // nothing to read a structure from: no elevation and no perspective (the plan alone gives a footprint, not a roof)
    if (pictures.length === 0 && perspectives.length === 0) return undefined
    const roleOf = (assetId: string): { document?: string; storey?: string } => ((A.pkg0.assets.find((q) => q.id === assetId) as { roles?: { document?: string; storey?: string } } | undefined)?.roles ?? {})
    let section: Raster | undefined
    let sectionFrame: (typeof A.graph0.coordinateFrames)[number] | undefined
    for (const f of A.graph0.coordinateFrames) {
      if (roleOf(f.assetId).document !== 'SECTION') continue
      const r = await frameRaster(A.pkg0, A.graph0, f.id, options)
      // a picture the page labels a section but which is a placeholder (a 32 × 32 px loading image was sent as the
      // house's section, and looked at by every stage): left out by its size, with the reason recorded
      if (r?.raster && Math.max(r.raster.width, r.raster.height) < STRUCTURE_PICTURES.minSidePx / 2) { skipped.push({ role: 'SECTION', frameId: f.id, px: [r.raster.width, r.raster.height], why: `a placeholder or thumbnail (${r.raster.width} × ${r.raster.height} px): not a section a height can be read from` }); continue }
      if (r?.raster && (!section || r.raster.width * r.raster.height > section.width * section.height)) { section = r.raster; sectionFrame = f }
    }
    if (section && sectionFrame) images.push({ role: 'SECTION', frameId: sectionFrame.id, caption: 'SECTION', sourceByteHash: sectionFrame.variantByteHash, sourcePx: [section.width, section.height], ...sentOf(section), origin: originOf(sentOf(section).factor) })
    if (A.planRaster) images.push({ role: 'PLAN', frameId: A.planFrameId ?? 'the plan the outline was read on', caption: 'GROUND-FLOOR PLAN', sourceByteHash: A.graph0.coordinateFrames.find((f) => f.id === A.planFrameId)?.variantByteHash ?? '', sourcePx: [A.planRaster.width, A.planRaster.height], ...sentOf(A.planRaster), origin: originOf(sentOf(A.planRaster).factor) })
    const missingSides = (['FRONT', 'REAR'] as const).filter((sd) => !pictures.some((q) => q.caption === sd))
    const planStoreys = [...new Set(A.pkg0.assets.map((q) => (q as { roles?: { document?: string; storey?: string } }).roles).filter((r) => r?.document === 'FLOOR_PLAN').map((r) => r?.storey ?? 'UNKNOWN'))]
    const facts = [...A.pkg0.publishedFacts.filter((q) => typeof q.value === 'number' || typeof q.value === 'string').map((q) => `${q.key}: ${String(q.value)}${q.unit && q.unit !== 'none' ? ` ${q.unit}` : ''}`), `floor plans published for: ${planStoreys.join(', ') || 'none'}`]
    stage('STRUCTURE_READ')
    const read = await readForm({ model: wiring.outlineModel ?? wiring.metricModel ?? wiring.model, price: wiring.outlinePrice ?? wiring.metricPrice ?? wiring.price, ...(wiring.spend ? { spend: wiring.spend } : {}), ...(options.signal ? { signal: options.signal } : {}) }, pictures, { ...(A.planRaster ? { plan: A.planRaster } : {}), ...(section ? { section } : {}), ...(perspectives.length > 0 ? { perspectives } : {}), facts })
    usd += read.usd
    // review F4: a picture number means the picture of the request that was ANSWERED. A replayed form-read/2 answer was
    // given every sketched frame, in sketch order — not this selection, which drops thumbnails and copies and adds
    // pictures no sketch was made of — so its numbers are read on that list
    const replayedOf2 = read.answeredBy?.contract === 'form-read/2' && !read.answeredBy.live
    const memo: StructureMemo = { read, frames: replayedOf2 ? sketched.map((x) => x.frameId) : pictures.map((p) => p.frameId), perspectives: perspectives.map((p, i) => { const q = read.form?.perspectives?.find((x) => x.n === i + 1); return { frameId: p.frameId, ...(q ? { corner: q.corner, mirrored: q.mirrored } : {}) } }) }
    const form = read.form
    const agree = (planParts?: readonly string[]): void => {
      if (!form) return
      const height = A.pkg0.publishedFacts.find((q) => q.key === 'building_height' && q.unit === 'm')?.value
      const pitch = A.pkg0.publishedFacts.find((q) => q.key === 'roof_pitch' && q.unit === 'deg')?.value
      const gableWalls = sketched.flatMap((x) => {
        const sk = x.sketch as NonNullable<typeof x.sketch>
        const up = wallToApex(sk.walls.map((q) => q.polygon as Array<[number, number]>), sk.roofs.map((q) => q.polygon as Array<[number, number]>), sk.groundRow)
        const side = sideOfFacade(x.facade)
        return up === undefined ? [] : [{ frameId: x.frameId, ...(side ? { side: side as StructureSide } : {}), wallToApex: up }]
      })
      memo.agreed = agreeStructure(form, { planStoreys, ...(typeof height === 'number' ? { buildingHeightM: height } : {}), ...(typeof pitch === 'number' ? { publishedPitchDeg: pitch } : {}), ...(planParts ? { planParts } : {}), gableWalls })
      memo.build = buildStructureOf(memo.agreed)
      memo.features = [...featureMapOf(memo.agreed, read.promptVersion, [...memo.frames, ...perspectives.map((p) => p.frameId)]), ...countFeaturesOf({ dormers: form.dormers, chimneys: form.chimneys, roofWindows: form.roofWindows }, read.promptVersion, memo.frames)]
    }
    agree(A.planParts)
    if (!A.planParts && form) structureReagree = agree
    record({ at: now().toISOString(), kind: 'STRUCTURE_READ', version: FORM_READ_VERSION, promptVersion: read.promptVersion, ...(read.answeredBy ? { answeredBy: { ...read.answeredBy, ...(read.answeredBy.unanswered ? { note: read.answeredBy.unanswered === 'REFUSED' ? `no answer: the provider refused it${read.answeredBy.live ? ' (billed)' : ''}; the images listed here are the ones sent` : read.answeredBy.unanswered === 'BUDGET_REFUSED' ? 'no answer: the books refused the request (a ceiling would be passed), nothing was sent; the images listed here are the ones this code chose' : 'no answer: the request did not complete; the images listed here are the ones this code chose' } : read.answeredBy.contract !== 'NONE' && !read.answeredBy.live ? { note: `a RECORDED answer (${read.answeredBy.contract}) replayed: it was given the pictures of the request it was recorded for; the images listed here are the ones this code chooses and would send` } : {}) } } : {}), structureVersion: STRUCTURE_VERSION, sheets: { elevations: pictures.map((p, i) => ({ n: i + 1, frameId: p.frameId, caption: p.caption })), perspectives: perspectives.map((p, i) => ({ n: i + 1, frameId: p.frameId })), plan: !!A.planRaster, section: !!section, facts }, images, skipped, missing: [...missingSides.map((sd) => `no elevation picture captioned ${sd} in the package`), ...(pictures.length < 4 ? [`${pictures.length} elevation picture(s) of four sides`] : []), ...(sketched.length < 2 ? [`${sketched.length} elevation sketch(es): the sketches' own witness of gable walls is ${sketched.length === 0 ? 'absent' : 'thin'} — the read is asked all the same`] : [])], form: read.form ?? null, raw: read.form ? undefined : read.raw, refused: read.refused, agreed: memo.agreed ?? null, taken: memo.build ?? null, usd: read.usd, why: 'the sheets are asked, as a whole, what volumes, storeys and roofs the house has; each property is held against witnesses that are not this answer, and only what is not disputed is taken' })
    if (memo.features) record({ at: now().toISOString(), kind: 'FEATURE_MAP', version: FEATURE_MAP_VERSION, features: memo.features, why: `${memo.features.length} feature(s) of the house as the sources state them, fixed before any model is judged (${memo.features.filter((q) => q.weight === 'KEY').length} KEY): the reviewer is handed this list, and each entry is followed to the delivered model` })
    structureMemo = memo
    return memo
  }
  const buildMassing = async (A: { pkg0: SourcePackage; graph0: SourceObservationGraph; sketches: SketchReading['sketches']; planFrame?: string; cmPerPx?: number; strong: boolean; diag: Record<string, unknown>; localFailure?: { code?: string; reasonCode?: string | null }; why: string }): Promise<{ delivery: MassingDelivery; built?: Local }> => {
    const { pkg0, graph0, planFrame, diag } = A
    let { cmPerPx, strong } = A
    // v3.54.18: where the analyzer's own plan scale is not settled, the plan's PRINTED overall dimensions give one — each
    // printed value over the length of its own dimension line (the metric read states both ends in the plan's pixels);
    // two lines must agree within 3 %, or no scale is taken from them. A printed number and its line, not an estimate.
    if (!(cmPerPx && strong) && planFrame) {
      const lines = (metricRead?.reads ?? []).filter((r) => r.frameId === planFrame).flatMap((r) => r.observations.filter((o) => o.kind === 'LENGTH' && o.scope === 'WHOLE_HOUSE' && o.status === 'PRINTED' && typeof o.value === 'number' && o.ends).map((o) => { const e = o.ends as NonNullable<typeof o.ends>; const px = Math.hypot(e.to[0] - e.from[0], e.to[1] - e.from[1]); return { literal: o.literal, mPerPx: px > 20 ? (o.value as number) / px : NaN } })).filter((q) => Number.isFinite(q.mPerPx))
      if (lines.length > 0) {
        const lo = Math.min(...lines.map((q) => q.mPerPx))
        const hi = Math.max(...lines.map((q) => q.mPerPx))
        if ((hi - lo) / hi <= 0.03) {
          cmPerPx = Math.round(((lo + hi) / 2) * 100 * 1e6) / 1e6
          strong = true
          diag.metricConfidence = 'PRINTED_DIMENSION_LINES'
          diag.metricRelation = `${lines.map((q) => `"${q.literal}"`).join(', ')} over their own dimension lines (${lines.length} line(s), spread ${(((hi - lo) / hi) * 100).toFixed(1)} %)`
          record({ at: now().toISOString(), kind: 'PLAN_SCALE_FROM_PRINTED_DIMENSIONS', frameId: planFrame, cmPerPx, lines })
        }
      }
    }
    let built: Local | undefined
    const delivery: MassingDelivery = { decision: 'NOT_RUN', why: '', records: [], transactions: [], usd: 0 }
    {
      const f = planFrame ? graph0.coordinateFrames.find((x) => x.id === planFrame) : undefined
      const fr = f ? await frameRaster(pkg0, graph0, f.id, options) : undefined
      if (!f || !fr?.raster) delivery.why = 'PLAN_OUTLINE: the analyzer selected no plan frame to trace (or its bytes could not be decoded)'
      else {
        const published = (pkg0.publishedFacts as Array<{ kind?: string; key?: string; value?: number }> | undefined)?.find((x) => (x.kind ?? x.key) === 'footprint_area')?.value
        const asset = pkg0.assets.find((a) => a.id === f.assetId)
        stage('PLAN_OUTLINE')
        const plan = await readPlanOutline({ model: wiring.outlineModel ?? wiring.metricModel ?? wiring.model, price: wiring.outlinePrice ?? wiring.metricPrice ?? wiring.price, ...(wiring.spend ? { spend: wiring.spend } : {}), ...(options.signal ? { signal: options.signal } : {}) }, { frameId: f.id, raster: fr.raster, caption: (asset?.caption ?? '').slice(0, 120), sourceByteHash: f.variantByteHash, ...(cmPerPx && strong ? { scale: { mPerPx: cmPerPx / 100, why: `${cmPerPx} cm/px, ${String(diag.metricConfidence)} / ${String(diag.metricRelation)} with ${String(diag.independentWitnesses ?? '?')} independent witnesses` } } : {}), ...(typeof published === 'number' ? { publishedFootprintM2: published } : {}) })
        usd += plan.usd
        delivery.usd += plan.usd
        delivery.plan = plan
        // (the skeleton reads the sheet along the outline AS TRACED — the wall's filled core — whichever outline the body takes)
        let tracedOutlinePx: Array<[number, number]> | undefined
        // v3.54.19: the plan's two printed overall dimensions decide between the outline as traced and the walls' outer
        // line. Where they disagree over the traced outline's two extents (more than the 3 % any pair is held to) and agree
        // over the outline moved onto the outermost wall line, the moved outline is the house's and the pair its scale.
        if (plan.outlinePx) {
          const pr = (metricRead?.reads ?? []).filter((r) => r.frameId === f.id).flatMap((r) => r.observations.filter((o) => o.kind === 'LENGTH' && o.scope === 'WHOLE_HOUSE' && o.reference === 'OUTER_FACE' && o.status === 'PRINTED' && typeof o.value === 'number'))
          const [pH, pV] = [pr.find((o) => o.axis === 'HORIZONTAL')?.value, pr.find((o) => o.axis === 'VERTICAL')?.value]
          if (typeof pH === 'number' && typeof pV === 'number') {
            const spreadOf = (o: ReadonlyArray<readonly [number, number]>): number => { const [w, h] = [Math.max(...o.map((q) => q[0])) - Math.min(...o.map((q) => q[0])), Math.max(...o.map((q) => q[1])) - Math.min(...o.map((q) => q[1]))]; const [sx, sy] = [pH / w, pV / h]; return Math.abs(sx - sy) / Math.max(sx, sy) }
            const before = spreadOf(plan.outlinePx)
            if (before > OUTLINE_SCALE_AGREE) {
              const outer = outerFaceOutline(fr.raster, plan.outlinePx)
              const after = outer ? spreadOf(outer.outline) : undefined
              const sc = outer && after !== undefined && after <= OUTLINE_SCALE_AGREE ? outlineScale(outer.outline, { horizontalM: pH, verticalM: pV }) : undefined
              record({ at: now().toISOString(), kind: 'PLAN_OUTLINE_ON_OUTER_LINE', frameId: f.id, taken: !!sc, printedM: [pH, pV], spreadTraced: Math.round(before * 1e4) / 1e4, spreadOuter: after !== undefined ? Math.round(after * 1e4) / 1e4 : null, moved: outer?.moved ?? [], why: sc ? `the printed ${pH} × ${pV} m disagree over the traced outline by ${(before * 100).toFixed(1)} % and agree over the walls' outer line within ${((after as number) * 100).toFixed(1)} %: the outline is taken on that line, at the scale the two dimensions give` : `the printed ${pH} × ${pV} m disagree over the traced outline by ${(before * 100).toFixed(1)} %${after !== undefined ? ` and over the walls' outer line by ${(after * 100).toFixed(1)} %` : '; no outer line found'}: the traced outline stands` })
              if (sc && outer) {
                tracedOutlinePx = plan.outlinePx
                plan.outlinePx = outer.outline
                cmPerPx = Math.round(sc.mPerPx * 100 * 1e6) / 1e6
                strong = true
                scaleOutline(plan, { frameId: f.id, sourceByteHash: f.variantByteHash, ...(typeof published === 'number' ? { publishedFootprintM2: published } : {}) }, { mPerPx: sc.mPerPx, why: `${cmPerPx} cm/px on the walls' outer line: ${sc.why}` })
              }
            }
          }
        }
        // v3.54.18 R3: a plan the analyzer measured no scale on is put in metres from its own traced outline — the two
        // overall dimensions over the outline's two extents (they must agree), or, as a hypothesis the published height has
        // to confirm on the built body, the published footprint area over the outline's area
        let scaleHypothesis: string | undefined
        if (!plan.observation && plan.outlinePx && !(cmPerPx && strong)) {
          const printedOn = (metricRead?.reads ?? []).filter((r) => r.frameId === f.id).flatMap((r) => r.observations.filter((o) => o.kind === 'LENGTH' && o.scope === 'WHOLE_HOUSE' && o.reference === 'OUTER_FACE' && o.status === 'PRINTED' && typeof o.value === 'number'))
          const fact = (key: string): number | undefined => { const v = pkg0.publishedFacts.find((x) => x.key === key && x.unit === 'm')?.value; return typeof v === 'number' ? v : undefined }
          const [pw, pl] = [fact('building_width'), fact('building_length')]
          // v3.54.19: a plan sheet with no dimension line of its own, on a page that states no length and width: the
          // SITE PLAN prints the building's two overall dimensions (one small request; taken only if both agree over the
          // outline's two extents, like any other pair)
          let site: [number, number] | undefined
          if (!(printedOn.some((o) => o.axis === 'HORIZONTAL') && printedOn.some((o) => o.axis === 'VERTICAL')) && !(pw !== undefined && pl !== undefined)) {
            const sf = graph0.coordinateFrames.filter((q) => String((q.roles as { document?: string }).document) === 'SITE_PLAN').sort((a, b) => (b.size?.width ?? 0) * (b.size?.height ?? 0) - (a.size?.width ?? 0) * (a.size?.height ?? 0))[0]
            const sr = sf ? await frameRaster(pkg0, graph0, sf.id, options) : undefined
            if (sf && sr?.raster && Math.min(sr.raster.width, sr.raster.height) >= 200) {
              stage('SITE_DIMENSIONS')
              const read = await readSiteDimensions({ model: wiring.outlineModel ?? wiring.metricModel ?? wiring.model, price: wiring.outlinePrice ?? wiring.metricPrice ?? wiring.price, ...(wiring.spend ? { spend: wiring.spend } : {}), ...(options.signal ? { signal: options.signal } : {}) }, { frameId: sf.id, raster: sr.raster, caption: (pkg0.assets.find((a) => a.id === sf.assetId)?.caption ?? '').slice(0, 120) })
              usd += read.usd
              delivery.usd += read.usd
              if (read.horizontalM !== undefined && read.verticalM !== undefined) site = [read.horizontalM, read.verticalM]
              record({ at: now().toISOString(), kind: 'SITE_DIMENSIONS', version: SITE_DIMENSIONS_VERSION, frameId: sf.id, horizontalM: read.horizontalM ?? null, verticalM: read.verticalM ?? null, literals: read.literals ?? null, refused: read.refused, usd: read.usd })
            }
          }
          const sc = outlineScale(plan.outlinePx, { ...(printedOn.find((o) => o.axis === 'HORIZONTAL') ? { horizontalM: printedOn.find((o) => o.axis === 'HORIZONTAL')?.value as number } : {}), ...(printedOn.find((o) => o.axis === 'VERTICAL') ? { verticalM: printedOn.find((o) => o.axis === 'VERTICAL')?.value as number } : {}), ...(pw !== undefined && pl !== undefined ? { overallM: [pw, pl] as [number, number] } : site ? { overallM: site, overallFrom: 'the building\'s two overall dimensions printed on the site plan' } : {}), ...(typeof published === 'number' ? { footprintM2: published } : {}) })
          if (sc) {
            cmPerPx = Math.round(sc.mPerPx * 100 * 1e6) / 1e6
            strong = sc.basis === 'OVERALL_DIMENSIONS'
            if (sc.basis === 'FOOTPRINT_AREA') scaleHypothesis = sc.why
            diag.metricConfidence = sc.basis === 'OVERALL_DIMENSIONS' ? 'OVERALL_DIMENSIONS_OVER_OUTLINE' : 'FOOTPRINT_AREA_OVER_OUTLINE (hypothesis)'
            diag.metricRelation = sc.why
            scaleOutline(plan, { frameId: f.id, sourceByteHash: f.variantByteHash, ...(typeof published === 'number' ? { publishedFootprintM2: published } : {}) }, { mPerPx: sc.mPerPx, why: `${cmPerPx} cm/px from the traced outline: ${sc.why}` })
            record({ at: now().toISOString(), kind: 'PLAN_SCALE_FROM_OUTLINE', frameId: f.id, cmPerPx, basis: sc.basis, why: sc.why })
          }
        }
        record({ at: now().toISOString(), kind: 'PLAN_OUTLINE', frameId: f.id, refused: plan.refused, check: plan.check ?? null, entrance: plan.entrance ?? null, openings: plan.openings ?? null, usd: plan.usd })
        if (!plan.observation) delivery.why = `the plan outline gives no outline in metres: ${plan.refused.join('; ') || 'no read'}${strong ? '' : '; PLAN_SCALE: the analyzer\'s plan scale is not STRONG/CONFIRMED'}`
        else {
          // v3.54.20: the structure is read BEFORE the body is solved, and an elevation the publisher did not caption with
          // a side takes the side the read saw on it — so the solver holds the house's heights against every elevation, not
          // against the captioned ones only (one house's eaves came from its front alone, the gable wall of a cross wing,
          // while both side elevations drew them three metres lower). A captioned side is never overridden; two pictures
          // the read puts on one side are both left out (it does not know).
          const structure = await structureOf({ pkg0, graph0, sketches: A.sketches, planRaster: fr.raster, planFrameId: plan.frameId, ...(plan.parts ? { planParts: plan.parts } : {}) })
          // v3.54.21 (NEW-H Anna II): a WEST / EAST that is only LOCAL's reading of pictures the publisher captions with the
          // same words ("side elevation" twice) is not a caption — the same weak label the registration's side decision
          // treats as a hypothesis. Its two side drawings went in mirrored: the garage's gable built as a cross gable on the
          // other side, a corner stub the compiler could not close, and a flat garage the structure contradicted
          const captionIn = (frameId: string): string => { const fr = graph0.coordinateFrames.find((q) => q.id === frameId); return (pkg0.assets.find((a) => a.id === fr?.assetId)?.caption ?? '').trim().toLowerCase() }
          const weakIn = (x: { facade: string; frameId: string }): boolean => (x.facade === 'EAST' || x.facade === 'WEST') && captionIn(x.frameId) !== '' && A.sketches.some((y) => y.frameId !== x.frameId && (y.facade === 'EAST' || y.facade === 'WEST' || y.facade === 'SIDE_UNSPECIFIED') && captionIn(y.frameId) === captionIn(x.frameId))
          const captionedStrong = new Set(A.sketches.filter((x) => !weakIn(x)).map((x) => sideOfFacade(x.facade)).filter(Boolean))
          const readSideAgainst = (frameId: string, taken: ReadonlySet<string | undefined>): Side | undefined => {
            const n = (structure?.frames ?? []).indexOf(frameId) + 1
            const sd = n > 0 ? structure?.agreed?.pictures.find((q) => q.n === n)?.shows : undefined
            if (!sd || sd === 'NONE' || taken.has(sd as Side)) return undefined
            return (structure?.agreed?.pictures ?? []).filter((q) => q.shows === sd).length === 1 ? (sd as Side) : undefined
          }
          const sidesByRead: Array<{ frameId: string; side: Side; weakLabel?: string }> = []
          // the weak labels give way to the read only when it puts every one of those pictures on its own side; otherwise
          // LOCAL's labels stay, as before, the convention of last resort
          const weak = A.sketches.filter((x) => x.sketch && weakIn(x))
          const weakRead = weak.map((x) => readSideAgainst(x.frameId, captionedStrong))
          // … and only a read that saw the publisher's originals and perspectives (form-read/3): a form-read/2 answer was
          // asked of the sketches alone, and its sides are the ones the audit found mirrored (Mindelo)
          const readDecidesWeak = structure?.read.answeredBy?.contract === 'form-read/3' && weak.length > 0 && weakRead.every((v) => v !== undefined) && new Set(weakRead).size === weak.length
          // the sides held once the weak labels are settled: the read's where it decides them, else the labels themselves —
          // a side a weak label keeps is not read onto another picture (two drawings on one side)
          const captioned = new Set<string | undefined>([...captionedStrong, ...(readDecidesWeak ? weakRead : A.sketches.filter((x) => weakIn(x)).map((x) => sideOfFacade(x.facade)))].filter(Boolean))
          const readSide = (frameId: string): Side | undefined => readSideAgainst(frameId, captioned)
          const silhouettes = A.sketches.flatMap((x) => {
            const isWeak = !!x.sketch && weakIn(x)
            const side = isWeak && readDecidesWeak ? weakRead[weak.indexOf(x)] : sideOfFacade(x.facade) ?? (x.sketch ? readSide(x.frameId) : undefined)
            if (side && (!sideOfFacade(x.facade) || (isWeak && readDecidesWeak))) sidesByRead.push({ frameId: x.frameId, side, ...(isWeak ? { weakLabel: x.facade } : {}) })
            const fx = graph0.coordinateFrames.find((q) => q.id === x.frameId)
            return side && x.sketch ? [{ observationId: `sk-${x.frameId.slice(-12)}`, side, frameId: x.frameId, sourceByteHash: fx?.variantByteHash ?? '', groundRow: x.sketch.groundRow ?? null, walls: x.sketch.walls.map((w) => w.polygon as Array<[number, number]>), roofs: x.sketch.roofs.map((r) => r.polygon as Array<[number, number]>) }] : []
          })
          const pictures: BindPicture[] = []
          for (const [i, x] of A.sketches.entries()) {
            const fx = graph0.coordinateFrames.find((q) => q.id === x.frameId)
            const r = fx ? await frameRaster(pkg0, graph0, fx.id, options) : undefined
            if (fx && r?.raster) pictures.push({ n: i + 1, frameId: fx.id, projection: String(fx.roles.projection), transform: { x0: 0, y0: 0, scale: 1 }, raster: r.raster, sourceByteHash: fx.variantByteHash })
          }
          // v3.54.19: what the plan draws inside that outline, read on the sheet (0 USD): the body that stands takes it.
          // The body itself keeps the TRACED outline: the skeleton moves its own copy onto the bands of the sheet's wall
          // colour to read between them, but that band is not always the wall's outer face (a sheet that draws the outer
          // layer of its walls in another tone has the printed overall dimension outside it — the first replay of this
          // stage put a body on the bands and lost 0.4 m of a house against its own printed dimensions).
          const skeleton = plan.outlinePx && cmPerPx ? readPlanSkeleton({ frameId: f.id, sourceByteHash: f.variantByteHash, raster: fr.raster, outlinePx: tracedOutlinePx ?? plan.outlinePx, mPerPx: cmPerPx / 100 }) : undefined
          if (skeleton) {
            delivery.skeleton = skeleton
            record({ at: now().toISOString(), kind: 'PLAN_SKELETON', version: PLAN_SKELETON_VERSION, frameId: f.id, ink: skeleton.ink, wallM: Math.round(skeleton.wallPx * skeleton.mPerPx * 100) / 100, walls: skeleton.walls.length, doors: skeleton.doors.length, gaps: skeleton.gaps.length, refused: skeleton.refused })
          }
          // the skeleton's partitions in the outline's own metres (x from its left edge, z up from its foot): where the
          // plan draws a wall across the body, two bodies in line meet there
          const planWalls = skeleton && plan.outlinePx && skeleton.refused.every((q) => !q.startsWith('WALL_STYLE') && !q.startsWith('EXTERIOR_BAND: no'))
            ? ((): Array<{ a: { x: number; z: number }; b: { x: number; z: number } }> => {
                const [x0, y1, sM] = [Math.min(...plan.outlinePx.map((q) => q[0])), Math.max(...plan.outlinePx.map((q) => q[1])), skeleton.mPerPx]
                const at = (px: number, py: number): { x: number; z: number } => ({ x: (px - x0) * sM, z: (y1 - py) * sM })
                return skeleton.walls.map((w) => (w.axis === 'H' ? { a: at(w.from, w.at), b: at(w.to, w.at) } : { a: at(w.at, w.from), b: at(w.at, w.to) }))
              })()
            : []
          stage('BUILD_MASSING')
          const heightFact = pkg0.publishedFacts.find((x) => x.key === 'building_height' && x.unit === 'm')?.value
          const pitchFact = pkg0.publishedFacts.find((x) => x.key === 'roof_pitch' && x.unit === 'deg')?.value
          const empty = createEmptyModel(`massing-${f.variantByteHash.slice(0, 12)}`, (asset?.caption ?? 'house').slice(0, 60))
          if (sidesByRead.length > 0) record({ at: now().toISOString(), kind: 'ELEVATION_SIDES_BY_STRUCTURE_READ', sides: sidesByRead, why: 'these elevations carry no side in their caption: the body is solved with them on the side the structure read saw (a read side, never a captioned one; the openings\' assignment is decided later by what registers)' })
          const out = executeCorrections({ model: empty, views: [], pictures, proposals: [{ proposalId: `massing-${f.variantByteHash.slice(0, 12)}`, baseRevision: modelRevision(empty), operation: 'BUILD_MASSING', targetId: 'WHOLE', origin: 'SKETCH', uncertainty: 'MEDIUM', justification: A.why }], massing: { outline: plan.observation, silhouettes, ...(plan.entrance?.side ? { entranceSide: plan.entrance.side } : {}), ...(planWalls.length > 0 ? { planWalls } : {}) }, facts: { ...(typeof pitchFact === 'number' ? { roofPitchDeg: pitchFact } : {}), ...(typeof heightFact === 'number' ? { buildingHeightM: heightFact } : {}), ...(structure?.build ? { structure: structure.build } : {}) } })
          delivery.records = out.records
          delivery.transactions = out.transactions
          const rec0 = out.records[0]
          // a scale that is only a hypothesis (footprint area over the outline) stands when something that does not come
          // from the plan confirms it: the page's building height against the ridge the elevations give at that scale
          const ridgeBuilt = rec0?.status === 'COMMITTED' && scaleHypothesis ? measureBuilt(out.model, compileBuilding(out.model)).ridge : undefined
          const confirmed = !scaleHypothesis || (typeof heightFact === 'number' && typeof ridgeBuilt === 'number' && Math.abs(ridgeBuilt - heightFact) <= Math.max(BODY_ARBITRATION.heightAgreeM, BODY_ARBITRATION.heightAgreeShare * heightFact))
          if (scaleHypothesis) record({ at: now().toISOString(), kind: 'PLAN_SCALE_HYPOTHESIS', confirmed, publishedHeightM: heightFact ?? null, ridgeM: ridgeBuilt ?? null, bodies: ((rec0?.massing as { hypothesis?: { bodies?: Array<{ id: string; rect: unknown; roof: unknown; provenance: { height?: { why: string } } }> } } | undefined)?.hypothesis?.bodies ?? []).map((q) => ({ id: q.id, rect: q.rect, roof: q.roof, height: q.provenance.height?.why ?? null })), why: confirmed ? `the scale from the footprint area puts the ridge at ${(ridgeBuilt as number).toFixed(2)} m, the page states ${heightFact} m: confirmed by a fact outside the plan` : `the scale from the footprint area is not confirmed (ridge ${ridgeBuilt?.toFixed(2) ?? 'not built'} m against the published ${heightFact ?? 'none'} m): no body is delivered on it` })
          if (rec0?.status === 'COMMITTED' && !confirmed) delivery.why = `BUILD_MASSING committed, but its plan scale is a hypothesis the published height does not confirm (${scaleHypothesis})`.slice(0, 600)
          if (rec0?.status === 'COMMITTED' && confirmed) {
            const scene = compileBuilding(out.model)
            const sceneText = serializeBundle(buildMobileSceneBundle(out.model, { scene }))
            delivery.decision = 'BUILT'
            delivery.model = out.model
            delivery.sceneText = sceneText
            delivery.sceneSha256 = sha256Hex(sceneText)
            delivery.modelSha256 = sha256Hex(serializeModel(out.model))
            delivery.why = `BUILD_MASSING committed on the empty model: ${rec0.measure?.why ?? ''}`.slice(0, 600)
            // v3.54.17 R2: the body becomes the analysis that stands — an ordinary result through the shared envelope,
            // delivered by the host and looked at by the review like any model (no rebuild by the drawings' solver)
            const identity = { ...identityOf(pkg0, options.adapters), ...options.identity }
            const failure = A.localFailure
            const build = (delivered?: CanonicalBuildingModel): Local | undefined => {
              const mr = massingRun({ pkg: pkg0, graph: graph0, ...(good.metrics ? { metrics: good.metrics } : {}), ...(good.plans ? { plans: good.plans } : {}), identity, sourceUrl: input.kind === 'URL' ? input.url : pkg0.canonicalUrl, jobId: options.jobId ?? null, record: rec0, executorModel: out.model, plan: { frameId: plan.frameId, version: plan.version, promptVersion: plan.promptVersion, ...(plan.check ? { check: plan.check } : {}), ...(plan.observation ? { observation: plan.observation } : {}), ...(cmPerPx && strong ? { scale: { mPerPx: cmPerPx / 100, why: `${cmPerPx} cm/px, ${String(diag.metricConfidence)} / ${String(diag.metricRelation)}` } } : {}) }, localFailure: { code: failure?.code ?? 'ANALYSIS_FAILED', reasonCode: failure?.reasonCode ?? null }, outlineModel: (wiring.outlineModel ?? wiring.metricModel ?? wiring.model).model, sketches: { attempted: A.sketches.length ?? 0, used: silhouettes.length, frameIds: silhouettes.map((x) => x.frameId) }, ...(delivered ? { delivered } : {}), startedAt, now })
              if (!mr) return undefined
              const l: Local = { run: mr.run, pkg: pkg0, graph: graph0, ...(good.metrics ? { metrics: good.metrics } : {}), ...(good.plans ? { plans: good.plans } : {}) }
              const planFront = (rec0.massing as { hypothesis?: { planFront?: Side } } | undefined)?.hypothesis?.planFront
              // the sheet → this body's frame: the outline's own metres (x from its left edge, z up from its foot), turned
              // with the outline where the body was built in the elevations' frame
              let interior: InteriorObservation | undefined
              if (skeleton && plan.observation && plan.outlinePx && skeleton.refused.every((q) => !q.startsWith('WALL_STYLE') && !q.startsWith('EXTERIOR_BAND: no'))) {
                const sM = skeleton.mPerPx
                const [minXpx, maxYpx] = [Math.min(...plan.outlinePx.map((q) => q[0])), Math.max(...plan.outlinePx.map((q) => q[1]))]
                const frameOutline = plan.observation.outline
                const toModel = (px: number, py: number): { x: number; z: number } => {
                  const p = { x: (px - minXpx) * sM, z: (maxYpx - py) * sM }
                  // the turn is the outline's: the point is turned as one more corner of it
                  return planFront ? pointWithFront(p, planFront, frameOutline) : p
                }
                interior = skeletonInModel(skeleton, toModel)
              }
              let planMap: PlanFrameOfModel | undefined
              if (plan.observation && plan.outlinePx && cmPerPx) {
                const sM = cmPerPx / 100
                const [minXpx, maxYpx] = [Math.min(...plan.outlinePx.map((q) => q[0])), Math.max(...plan.outlinePx.map((q) => q[1]))]
                const frameOutline = plan.observation.outline
                const at = (px: number, py: number): { x: number; z: number } => { const p = { x: (px - minXpx) * sM, z: (maxYpx - py) * sM }; return planFront ? pointWithFront(p, planFront, frameOutline) : p }
                planMap = { frameId: f.id, basis: 'OUTLINE_SCALE', o: at(0, 0), x1000: at(1000, 0), y1000: at(0, 1000) }
              }
              // (a registration made on a side the structure read named served the body's heights; which side that picture's
              // OPENINGS stand on is decided afterwards, like every unlabelled elevation's, by what registers and by the
              // plan's openings — so it is not carried as a held view)
              const hyp = (rec0.massing as { hypothesis?: MassingHypothesis } | undefined)?.hypothesis
              const weakSides = Object.fromEntries(sidesByRead.filter((q) => q.weakLabel).map((q) => [q.frameId, q.side])) as Record<string, Side>
              massingOf.set(l, { views: mr.views, rebuild: (m) => build(m), ...(planFront ? { planFront } : {}), ...(interior ? { interior } : {}), ...(planMap ? { planMap } : {}), ...(hyp ? { hypothesis: hyp } : {}), ...(Object.keys(weakSides).length > 0 ? { weakSides } : {}) })
              return l
            }
            const m0 = build()
            if (m0?.run) {
              built = m0
              delivery.delivery = { delivered: true, why: 'the body is the analysis that stands: result, model and scene through the shared envelope; the review looks at this revision', modelSha256: m0.run.result.modelSha256, sceneSha256: m0.run.result.sceneSha256, revision: modelRevision(m0.run.reconstruction.model) }
            } else delivery.delivery = { delivered: false, why: 'the committed record\'s commands do not rebuild the executor\'s model byte for byte: nothing is delivered' }
            record({ at: now().toISOString(), kind: 'MASSING_DELIVERED', ...delivery.delivery })
          } else {
            delivery.decision = 'NOT_BUILT'
            if (!(rec0?.status === 'COMMITTED' && !confirmed)) delivery.why = `${rec0?.status ?? 'NO_RECORD'} ${rec0?.code ?? ''}: ${rec0?.why ?? ''}`.slice(0, 600)
          }
          record({ at: now().toISOString(), kind: 'MASSING_WITHOUT_MODEL', decision: delivery.decision, why: delivery.why })
        }
      }
    }
    return { delivery, ...(built ? { built } : {}) }
  }
  // v3.54.14 (L-MS): the sketches, on the model that stands and its metric facts
  let sketchSummary: SketchSummary | undefined
  // v3.54.16 §7: no model — the labelled elevations are still read into observations, with the missing anchors named
  let unregisteredSketches: Awaited<ReturnType<typeof readUnregisteredSketches>> | undefined
  let massingDelivery: MassingDelivery | undefined
  /** v3.54.21: the body built from the sources that did NOT replace LOCAL's — kept on the record (its hypothesis, fates and model), so the cause of the refusal can be reproduced */
  let massingRejected: MassingDelivery | undefined
  /** The side the plan read marks the main entrance on (any plan outline read of this run, whether or not its body stands). */
  let planEntranceSide: Side | undefined
  /** v3.54.18 R3: the openings the plan read saw in the exterior walls, by the side of the PLAN (a second drawing's observation). */
  let planOpenings: PlanSideOpening[] | undefined
  if (wiring.sketches === 'ON' && !good.run && good.pkg && good.graph) {
    const pkg0 = good.pkg
    const graph0 = good.graph
    const missingAnchors = [
      ...(local.error ? [`LOCAL built no model (${local.error.failure().code}${local.error.failure().reasonCode ? `/${local.error.failure().reasonCode}` : ''})`] : []),
      'no elevation is registered to a side (no model to register it against)',
      ...((CONF_RANK[localState.metric?.confidence ?? 'INCONCLUSIVE'] ?? 0) >= 2 ? [] : ['the plan scale is not settled']),
      ...(graph0.coordinateFrames.some((f) => f.roles.projection === 'ORTHOGRAPHIC_SECTION') ? [] : ['the source has no section (no ridge or level datum)']),
    ]
    stage('SKETCHES_WITHOUT_MODEL')
    unregisteredSketches = await readUnregisteredSketches({
      frames: graph0.coordinateFrames.map((f) => ({ frameId: f.id, view: String(f.roles.view), projection: String(f.roles.projection), width: f.size?.width ?? 0, height: f.size?.height ?? 0 })),
      rasterOf: async (frameId) => {
        const f = graph0.coordinateFrames.find((x) => x.id === frameId)
        const fr = f ? await frameRaster(pkg0, graph0, frameId, options) : undefined
        if (!f || !fr?.raster) return undefined
        const asset = pkg0.assets.find((a) => a.id === f.assetId)
        return { raster: fr.raster, caption: (asset?.caption ?? '').slice(0, 120), sourceByteHash: f.variantByteHash }
      },
      ctx: { model: wiring.sketchModel ?? wiring.model, price: wiring.sketchPrice ?? wiring.price, ...(wiring.spend ? { spend: wiring.spend } : {}), ...(options.signal ? { signal: options.signal } : {}) },
      missingAnchors,
    })
    usd += unregisteredSketches.usd
    record({ at: now().toISOString(), kind: 'SKETCHES_WITHOUT_MODEL', sides: unregisteredSketches.sides, missingAnchors })
    // v3.54.17: the body and roof from the plan outline and these elevations, without LOCAL's model or registrations
    if ((wiring.massing ?? 'ON') === 'ON') {
      const diag = ((local.error?.failure() as { diagnostics?: Record<string, unknown> } | undefined)?.diagnostics ?? {}) as Record<string, unknown>
      const planFrame = typeof diag.selectedPlanFrameId === 'string' ? diag.selectedPlanFrameId : undefined
      const cmPerPx = typeof diag.scaleCmPerPx === 'number' ? diag.scaleCmPerPx : undefined
      const strong = diag.metricConfidence === 'STRONG' && diag.metricRelation === 'CONFIRMED'
      const mb = await buildMassing({ pkg0, graph0, sketches: unregisteredSketches.sketches, ...(planFrame ? { planFrame } : {}), ...(cmPerPx !== undefined ? { cmPerPx } : {}), strong, diag, ...(local.error ? { localFailure: local.error.failure() } : {}), why: 'LOCAL built no model; the plan outline and the elevations are read' })
      massingDelivery = mb.delivery
      planEntranceSide = mb.delivery.plan?.entrance?.side ?? planEntranceSide
      planOpenings = mb.delivery.plan?.openings ?? planOpenings
      if (mb.built?.run) {
        // a body built in the elevations' frame already has the entrance side as its front: the hint is spent
        if (massingOf.get(mb.built)?.planFront) planEntranceSide = undefined
        good = mb.built
        goodState = stateOf(mb.built)
        // v3.54.18: the elevations read without a model are the same typed readings as with one — they go on to the ONE
        // facade consumer (roof, overhang, stacks, openings, finishes), registered from their own anchors on this body.
        // A side the source did not state stays unstated (decided by evidence or by the named convention below).
        sketchSummary = { reading: { version: SKETCH_STEP_VERSION, printedLevels: [], sketches: unregisteredSketches.sketches.map((x) => (x.sideUnstated ? { ...x, facade: 'SIDE_UNSPECIFIED' as const } : x)), appearance: { observations: [], projections: {} }, usd: 0 }, form: { decision: 'NOT_RUN', why: 'the body was built from the plan outline (no LOCAL model for the shape reader)' }, finish: { decision: 'NOT_RUN', why: 'finishes go through the correction registry on this path (SET_FINISH)' }, usd: 0 }
      }
    }
  }
  // v3.54.17 R2: a body built without LOCAL had its elevations read already (without a model): they are not asked again
  if (wiring.sketches === 'ON' && good.run && good.pkg && good.graph && good.metrics && !massingOf.has(good)) {
    const run0 = good.run
    const pkg0 = good.pkg
    const graph0 = good.graph
    const metrics0 = good.metrics
    const rasterOf = async (frameId: string) => {
      const f = graph0.coordinateFrames.find((x) => x.id === frameId)
      const fr = f ? await frameRaster(pkg0, graph0, frameId, options) : undefined
      if (!f || !fr?.raster) return undefined
      const asset = pkg0.assets.find((a) => a.id === f.assetId)
      return { raster: fr.raster, caption: (asset?.caption ?? '').slice(0, 120), sourceByteHash: f.variantByteHash }
    }
    stage('SKETCHES')
    // v3.54.17 R3: every orthographic elevation of the source is read, registered or not (two "side" elevations the
    // analyzer could not tell apart were never sketched)
    const registeredFrames = new Set(run0.reconstruction.facadeAlignment.views.map((v) => v.frameId))
    // v3.54.18: a thumbnail of an elevation (the page's 120 px copy of a drawing it also gives large) is not read: nothing
    // can be placed from it, and it only adds an unlabelled "side" that is one of the labelled ones (Medulin: four of eight
    // sketches were such copies). The gate is legibility — the picture's own size — not a count per house.
    const candidates = (graph0.coordinateFrames ?? []).filter((f) => f.roles.projection === 'ORTHOGRAPHIC_ELEVATION' && f.roles.document === 'ELEVATION' && !registeredFrames.has(f.id))
    const legible = (f: (typeof candidates)[number]): boolean => (f.size?.width ?? 0) >= MIN_SKETCH_FRAME_PX.width && (f.size?.height ?? 0) >= MIN_SKETCH_FRAME_PX.height
    const thumbnails = candidates.filter((f) => !legible(f))
    if (thumbnails.length > 0) record({ at: now().toISOString(), kind: 'ELEVATION_THUMBNAILS_NOT_READ', frames: thumbnails.map((f) => ({ frameId: f.id, width: f.size?.width ?? 0, height: f.size?.height ?? 0 })), min: MIN_SKETCH_FRAME_PX })
    const unregistered = candidates.filter(legible).map((f) => ({ frameId: f.id }))
    // v3.54.18 R2: an elevation the local content classifier took for another orthographic drawing (a plain gable read as
    // a "section") is read here all the same — named, by the typed verdict of the source inspection, never by its prose
    const vetoedLocally = candidates.filter(legible).filter((f) => run0.result.sources?.sheets.find((x) => x.assetId === f.assetId)?.content?.decision === 'VETOED')
    if (vetoedLocally.length > 0) record({ at: now().toISOString(), kind: 'ELEVATION_READ_DESPITE_LOCAL_CONTENT_VETO', frames: vetoedLocally.map((f) => ({ frameId: f.id, assetId: f.assetId, localVerdict: run0.result.sources?.sheets.find((x) => x.assetId === f.assetId)?.content ?? null })), why: 'the publisher captions these elevations and their pixels are an orthographic drawing; the local facade readers did not read them, the elevation reading does (its proposals pass the same source gate)' })
    const reading = await readSketches({ metrics: metrics0, model: run0.reconstruction.model, views: run0.reconstruction.facadeAlignment.views.map((v) => ({ facade: v.facade, frameId: v.frameId, projection: v.projection })), unregistered, ...(metricRead ? { metricReads: metricRead.reads } : {}), rasterOf, ctx: { model: wiring.sketchModel ?? wiring.model, price: wiring.sketchPrice ?? wiring.price, ...(wiring.spend ? { spend: wiring.spend } : {}), ...(options.signal ? { signal: options.signal } : {}) } })
    usd += reading.usd
    const { elevationSketches, ...kept } = reading
    sketchSummary = { reading: kept, form: { decision: 'NOT_RUN', why: '' }, finish: { decision: 'NOT_RUN', why: '' }, usd: reading.usd }
    if (wiring.variant === 'R') sketchSummary.form.why = sketchSummary.finish.why = 'variant R: read and checked; nothing handed to the analyzer'
    else if (elevationSketches.length === 0 && reading.appearance.observations.length === 0) sketchSummary.form.why = sketchSummary.finish.why = 'no sketch passed the proportion check'
    else {
      const base = { ...options, ...(readings.length > 0 ? { consulted: readings } : {}), ...(spans.length > 0 ? { consultedSpans: spans } : {}), ...(levels.length > 0 ? { consultedLevels: levels } : {}), ...(readings.length + spans.length > 0 ? { crossAxisWitness: true } : {}), reuseMetrics: metrics0, roofFeatures: undefined, glazedEnds: undefined }
      const acceptedSides = reading.sketches.flatMap((s) => (s.check?.properties.finish === 'ACCEPTED' && s.facade !== 'SIDE_UNSPECIFIED' ? [s.facade] : []))
      // v3.54.15: with no sketch whose form passed, only the finish is tried (PARTIAL sketches)
      const withForm = elevationSketches.length > 0 ? await attempt({ kind: 'PACKAGE', pkg: pkg0, graph: graph0 }, { ...base, elevationSketches, appearance: reading.appearance, wallTonesFrom: { model: run0.reconstruction.model, acceptedSides } }) : undefined
      const j = withForm ? judgeForm(run0.reconstruction.model, withForm.run?.reconstruction.model, elevationSketches.length) : { decision: 'ROLLBACK' as const, why: 'no sketch passed the form check (finish only)', measuredBefore: undefined, measuredAfter: undefined }
      sketchSummary.form = { decision: withForm ? j.decision : 'NOT_RUN', why: j.why, ...(j.measuredBefore ? { measuredBefore: j.measuredBefore } : {}), ...(j.measuredAfter ? { measuredAfter: j.measuredAfter } : {}) }
      record({ at: now().toISOString(), kind: 'SKETCH_FORM', decision: sketchSummary.form.decision, why: j.why })
      if (withForm && j.decision === 'ACCEPT') {
        good = withForm
        goodState = stateOf(withForm)
        basis = withForm
        sketchSummary.finish = { decision: 'ACCEPT', why: 'the finish zones were applied in the same candidate' }
      } else {
        const finishOnly = await attempt({ kind: 'PACKAGE', pkg: pkg0, graph: graph0 }, { ...base, appearance: reading.appearance })
        const same = finishOnly.run && usableGeometryFingerprint(finishOnly.run.reconstruction.model) === usableGeometryFingerprint(run0.reconstruction.model)
        sketchSummary.finish = same ? { decision: 'ACCEPT', why: 'the finish zones applied on the model that stood; its usable geometry unchanged' } : { decision: 'ROLLBACK', why: 'the finish-only candidate did not reproduce the model that stood' }
        if (same) {
          good = finishOnly
          goodState = stateOf(finishOnly)
          basis = finishOnly
        }
      }
    }
  }
  for (let round = 1; round <= maxRounds; round += 1) {
    const { pkg, graph, metrics } = basis
    const frameId = basis.plans?.selectedPlanFrameId ?? undefined
    if (!pkg || !graph || !metrics || !frameId) {
      record({ at: now().toISOString(), kind: 'NO_PROBLEM', round, why: 'the run reached no plan frame with metric evidence' })
      break
    }
    const fr = await frameRaster(pkg, graph, frameId, options)
    const problem = fr?.raster ? labelProblemOf(metrics, frameId, fr.assetId) : undefined
    if (!problem || !fr?.raster) {
      record({ at: now().toISOString(), kind: 'NO_PROBLEM', round, frameId, why: fr?.raster ? 'no label of the selected plan is unsettled' : "the plan's picture could not be decoded from the run's bytes" })
      break
    }
    const baseRevision = metrics.contentHash.slice(0, 12)
    const before = stateOf(basis)
    const rec: RoundRecord = { round, problem: { problemId: problem.problemId, frameId: problem.frameId, assetId: problem.assetId, labels: problem.labels.map((l) => ({ labelId: l.labelId, box: l.box, lattices: l.lattices, ...(l.binding ? { binding: l.binding } : {}), why: l.why })) }, verdicts: [], readings: [], before, decision: 'NOT_RUN', why: '' }
    rounds.push(rec)
    record({ at: now().toISOString(), kind: 'PROBLEM', round, problem: rec.problem, baseRevision })
    let consultation: ConsultOutcome
    try {
      consultation = await consultLabels({ problem, metrics, raster: fr.raster, baseRevision, model: wiring.model, price: wiring.price, ...(wiring.spend ? { spend: wiring.spend } : {}), limits, record: (e) => record({ ...e, round }), ...(options.signal ? { signal: options.signal } : {}), now })
    } catch (e) {
      rec.decision = 'CONSULTANT_FAILED'
      rec.why = `${(e as Error).name}: ${(e as Error).message.slice(0, 300)} — the LOCAL result stands`
      record({ at: now().toISOString(), kind: 'ROUND', round, decision: rec.decision, why: rec.why })
      break
    }
    rec.consultation = consultation
    usd += consultation.usd
    const final = consultation.final?.review ?? consultation.literal.review
    if (!final) {
      rec.decision = 'CONSULTANT_FAILED'
      rec.why = `no usable review (${consultation.final?.refused ?? consultation.literal.refused ?? '?'}) — the LOCAL result stands`
      record({ at: now().toISOString(), kind: 'ROUND', round, decision: rec.decision, why: rec.why })
      break
    }
    // a proposal id is the consultant's within one conversation; each round is a new conversation, so the loop scopes it
    const scoped = final.proposedCorrections.map((p) => ({ ...p, proposalId: `r${round}:${p.proposalId}` }))
    const { readings: valid, spans: validSpans, verdicts } = validateProposals(problem, baseRevision, scoped, seen, { engine: `consultant.${wiring.model.id}`, model: wiring.model.model }, overviewScale({ raster: fr.raster }))
    rec.verdicts = verdicts
    record({ at: now().toISOString(), kind: 'VALIDATION', round, verdicts })
    // a later round's reading of a label replaces an earlier one only through its own lattice id; earlier ones stay
    const merged = [...readings.filter((r) => !valid.some((v) => v.latticeId === r.latticeId)), ...valid]
    const mergedSpans = [...spans, ...validSpans]
    rec.readings = valid
    rec.spans = validSpans
    if (wiring.variant === 'R') {
      rec.decision = 'NOT_RUN'
      rec.why = 'variant R: the proposals are recorded and never consumed'
      record({ at: now().toISOString(), kind: 'ROUND', round, decision: rec.decision, why: rec.why })
      break
    }
    if (valid.length === 0 && validSpans.length === 0) {
      rec.decision = 'NO_CHANGE'
      rec.why = 'no proposal passed validation: nothing to hand the analyzer'
      record({ at: now().toISOString(), kind: 'ROUND', round, decision: rec.decision, why: rec.why })
      break
    }
    // the candidate: the same frozen package and graph, the consulted readings, the solver's cross-axis rule
    const candidate = await attempt({ kind: 'PACKAGE', pkg, graph }, { ...options, consulted: merged, consultedSpans: mergedSpans, consultedLevels: levels, crossAxisWitness: true, roofFeatures: undefined, reuseMetrics: undefined, glazedEnds: undefined })
    const after = stateOf(candidate)
    rec.after = after
    const verdict = compareRuns(goodState, after)
    rec.decision = verdict.decision
    rec.why = verdict.why
    record({ at: now().toISOString(), kind: 'ROUND', round, decision: rec.decision, why: rec.why, before: goodState, after, applied: candidate.metrics?.consultedReadings ?? [], spans: candidate.metrics?.consultedSpans ?? [] })
    if (verdict.decision === 'ACCEPT') {
      good = candidate
      goodState = after
      readings.splice(0, readings.length, ...merged)
      spans.splice(0, spans.length, ...mergedSpans)
      basis = candidate
      // a model whose scale is now settled has no label problem left to ask about; the loop ends by itself
      continue
    }
    if (verdict.decision === 'PARTIAL') {
      // still refused, but further along: the readings stand for the next round's candidate; the result is LOCAL's
      readings.splice(0, readings.length, ...merged)
      spans.splice(0, spans.length, ...mergedSpans)
      basis = candidate
      continue
    }
    break
  }

  // --- outline: a plan at a settled scale whose walls close no box; what closes the building there? -----------------
  let boundary: BoundaryRound | undefined
  let glazedEnds: Array<{ frameId: string; side: 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT' }> = []
  const consultedOn = (): boolean => readings.length + spans.length > 0
  {
    const at = basis
    const st = stateOf(at)
    const frameId = at.plans?.selectedPlanFrameId ?? undefined
    const plan = at.plans?.plans.find((p) => p.frameId === frameId) as { envelope?: unknown; extent?: { x0: number; y0: number; x1: number; y1: number } | null } | undefined
    const settled = (CONF_RANK[st.metric?.confidence ?? 'INCONCLUSIVE'] ?? 0) >= 2
    if (!good.run && at.error && at.pkg && at.graph && at.metrics && frameId && plan && plan.envelope === null && plan.extent && settled && (wiring.check ?? 'ON') === 'ON') {
      const fr = await frameRaster(at.pkg, at.graph, frameId, options)
      if (fr?.raster) {
        const revision = at.metrics.contentHash.slice(0, 12)
        const rec: BoundaryRound = { revision, frameId, status: null, observations: [], verdicts: [], sides: [], before: st, decision: 'NOT_RUN', why: '', usd: 0 }
        boundary = rec
        record({ at: now().toISOString(), kind: 'BOUNDARY_PROBLEM', frameId, revision, extent: plan.extent, why: at.error.message.slice(0, 300) })
        try {
          const res = await consultBoundary({ frameId, lookedAt: plan.extent, analyzerWhy: at.error.message, raster: fr.raster, baseRevision: revision, model: wiring.model, price: wiring.price, ...(wiring.spend ? { spend: wiring.spend } : {}), limits, record: (e) => record({ ...e, round: 'boundary' }), ...(options.signal ? { signal: options.signal } : {}), now })
          usd += res.usd
          rec.usd = res.usd
          if (!res.review) {
            rec.decision = 'CONSULTANT_FAILED'
            rec.refused = res.refused ?? 'no review'
            rec.why = `no usable review (${rec.refused}) — the refusal stands`
          } else {
            rec.status = res.review.status
            rec.observations = res.review.observations
            // the consultant's pixels are the overview's; a region is only checked to lie on the sheet
            const v = validateBoundary(res.review.proposedCorrections.map((p) => ({ ...p, proposalId: `b:${p.proposalId}` })), revision, res.overview, seen)
            rec.verdicts = v.verdicts
            rec.sides = v.sides
            record({ at: now().toISOString(), kind: 'BOUNDARY_VALIDATION', revision, status: res.review.status, verdicts: v.verdicts, observations: rec.observations })
            if (wiring.variant === 'R') {
              rec.decision = 'NOT_RUN'
              rec.why = 'variant R: the classification is recorded and never consumed'
            } else if (v.sides.length === 0) {
              rec.decision = 'NO_CHANGE'
              rec.why = 'no side is classified as closed by glazing: the refusal stands, the classification stays on the record'
            } else {
              const ends = v.sides.map((side) => ({ frameId, side }))
              const candidate = await attempt({ kind: 'PACKAGE', pkg: at.pkg, graph: at.graph }, { ...options, ...(consultedOn() ? { consulted: readings, consultedSpans: spans, consultedLevels: levels, crossAxisWitness: true } : {}), reuseMetrics: at.metrics, glazedEnds: ends, roofFeatures: undefined })
              const after = stateOf(candidate)
              rec.after = after
              const verdict = compareRuns(goodState, after)
              rec.decision = verdict.decision
              rec.why = verdict.why
              if (verdict.decision === 'ACCEPT') {
                good = candidate
                goodState = after
                glazedEnds = ends
              }
            }
          }
        } catch (e) {
          rec.decision = 'CONSULTANT_FAILED'
          rec.why = `${(e as Error).name}: ${(e as Error).message.slice(0, 300)} — the refusal stands`
        }
        record({ at: now().toISOString(), kind: 'BOUNDARY_ROUND', decision: rec.decision, why: rec.why, sides: rec.sides, before: rec.before, after: rec.after ?? null })
      }
    }
  }

  // --- v3.54.16: the correction executor on the model that stands ------------------------------------------------------
  // `base` is the analyzer's own run the delivered model was patched from (undefined: `good` is unpatched); `committed`
  // are the proposals whose transactions were kept, in source terms, so a rebuilt base can take them again.
  let base: Local | undefined
  let committed: CorrectionProposal[] = []
  const correctionRuns: CorrectionRun[] = []
  const seenPatch = new Set<string>()
  let sourcesAll: CheckSource[] | undefined
  const sourcesOf = async (l: Local): Promise<CheckSource[]> => (sourcesAll ??= await checkSources(l, options, structureMemo?.perspectives ?? []))
  const picturesOf = (sources: readonly CheckSource[]): BindPicture[] => sources.flatMap((src, i) => (src.what === 'ELEVATION' && src.sourceByteHash ? [{ n: i + 1, frameId: src.frameId, projection: src.projection, transform: { x0: src.img.transform.x0, y0: src.img.transform.y0, scale: src.img.transform.scale }, raster: src.raster, sourceByteHash: src.sourceByteHash }] : []))
  // every registered elevation can be bound by its frame (a sketch's own frame), numbered only when the reviewer saw it
  let extraPictures: BindPicture[] | undefined
  // v3.54.17 R2: every id an element index has listed, with the last revision that held it (a later proposal naming a
  // vanished one is STALE_TARGET), and the index of the look that stands
  const listedAt = new Map<string, string>()
  let lookIndex: ElementIndex | undefined
  const allPicturesOf = async (l: Local): Promise<BindPicture[]> => {
    const shown = picturesOf(await sourcesOf(l))
    if (!extraPictures) {
      extraPictures = []
      for (const v of l.run?.reconstruction.facadeAlignment.views ?? []) {
        if (shown.some((p) => p.frameId === v.frameId) || !l.pkg || !l.graph) continue
        const f = l.graph.coordinateFrames.find((x) => x.id === v.frameId)
        const fr = f ? await frameRaster(l.pkg, l.graph, v.frameId, options) : undefined
        if (f && fr?.raster) extraPictures.push({ n: 0, frameId: f.id, projection: f.roles.projection, transform: { x0: 0, y0: 0, scale: 1 }, raster: fr.raster, sourceByteHash: f.variantByteHash })
      }
    }
    return [...shown, ...extraPictures]
  }
  // printed values someone other than a proposer read: the analyzer's level marks and the independent metric read
  // v3.54.16 audit A3: each witness keeps what the observation said — its role, its host, its frame and that frame's
  // source bytes; the analyzer's own level marks carry no role, so they never witness a parameter by number alone
  const witnessesOf = (l: Local): PrintedWitness[] => {
    const hashOf = (frameId: string | undefined): string | undefined => (frameId ? l.graph?.coordinateFrames.find((f) => f.id === frameId)?.variantByteHash : undefined)
    return [
      ...((l.metrics as { evidence?: Array<{ kind: string; value?: number; frameId?: string }> } | undefined)?.evidence ?? []).filter((e) => e.kind === 'LEVEL_DATUM' && typeof e.value === 'number').map((e) => ({ valueM: e.value as number, unit: 'm' as const, frameId: e.frameId ?? '', by: 'ANALYZER' as const, ...(hashOf(e.frameId) ? { sourceByteHash: hashOf(e.frameId) } : {}) })),
      ...(metricRead?.reads ?? []).flatMap((r) => r.observations.filter((o) => (o.kind === 'LEVEL' || o.kind === 'ANGLE') && typeof o.value === 'number').map((o) => ({ valueM: o.value as number, unit: o.kind === 'ANGLE' ? ('deg' as const) : ('m' as const), frameId: r.frameId, by: 'METRIC_READ' as const, literal: o.literal, ...(o.role ? { role: o.role } : {}), ...(o.hostHint ? { host: o.hostHint } : {}), ...(hashOf(r.frameId) ? { sourceByteHash: hashOf(r.frameId) } : {}), ...(o.id ? { observationId: o.id } : {}), box: { x0: o.labelBox[0], y0: o.labelBox[1], x1: o.labelBox[2], y1: o.labelBox[3] }, ...(o.reference ? { datum: o.reference } : {}) }))),
    ]
  }
  // v3.54.17 R3: every sketched elevation registered from its own sketch (wall ends against the plan's side, the ground
  // row drawn behind pots and bins, checked by the model's eaves) — a function of the model, so a moved outline
  // re-registers it; under a TURNED_90 hypothesis on the side the orientation reads, not the label's
  let sketchSideOf: Record<string, Side> | undefined
  // v3.54.18 R3: a source body's own registrations name each elevation on the side its label gave. Once a side is DECIDED
  // otherwise (an elevation whose caption does not state its side, placed by the plan's openings), the registration made
  // on the other side is not held any more — the elevation is registered afresh from its sketch on the decided side, so
  // its openings are not bound to one wall by one consumer and to the opposite wall by another.
  const massingViews = (l: Local): BindView[] | undefined => { const v = massingOf.get(l)?.views; return v ? v.filter((q) => !sketchSideOf?.[q.frameId] || sketchSideOf[q.frameId] === q.side) : undefined }
  const registrationsSeen = new Set<string>()
  const sketchAnchors = (): SketchAnchors[] =>
    (sketchSummary?.reading.sketches ?? []).flatMap((x) => {
      const sk = x.sketch
      const side = sketchSideOf?.[x.frameId] ?? sideOfFacade(x.facade)
      if (!sk || !side || typeof sk.groundRow !== 'number' || sk.walls.length === 0 || sk.roofs.length === 0) return []
      const pts = sk.walls.flatMap((w) => w.polygon as Array<[number, number]>)
      // massing 1.8.0: the walls' ends half-way up the storey (a plinth or a terrace wall running past the house is not its width)
      const ends = wallEndsPx(sk.walls.map((w) => w.polygon as Array<[number, number]>), sk.roofs.map((r) => r.polygon as Array<[number, number]>), sk.groundRow)
      const x0 = ends?.x0 ?? Math.min(...pts.map((q) => q[0]))
      const x1 = ends?.x1 ?? Math.max(...pts.map((q) => q[0]))
      // the eaves row is where the walls meet the roof at their outer corners (the top of the drawn walls there): not the
      // roof's lowest edge, which an overhang carries lower by its reach times the slope
      const near = Math.max(2, 0.02 * (x1 - x0))
      const ground = sk.groundRow
      const corners = pts.filter((q) => q[0] <= x0 + near || q[0] >= x1 - near).map((q) => q[1]).filter((y) => y < ground - 2)
      if (corners.length === 0) return []
      const ridgeY = Math.min(...sk.roofs.flatMap((r) => (r.polygon as Array<[number, number]>).map((q) => q[1])))
      return [{ frameId: x.frameId, side, wallLeftX: x0, wallRightX: x1, groundY: ground, eavesY: Math.min(...corners), ridgeY }]
    })
  const sketchViewsOf = (model: CanonicalBuildingModel, pictures: readonly BindPicture[], held: readonly BindView[]): BindView[] =>
    sketchAnchors().flatMap((a) => {
      const r = registerFromSketch({ model, views: [...held], pictures, witnesses: [] }, a)
      const key = `${modelRevision(model)}:${a.frameId}:${a.side}`
      if (!registrationsSeen.has(key)) {
        registrationsSeen.add(key)
        record({ at: now().toISOString(), kind: 'SKETCH_REGISTRATION', revision: modelRevision(model), frameId: a.frameId, side: a.side, anchors: a, ...('status' in r ? { status: r.status, code: r.code, why: r.why } : { status: 'REGISTERED', projection: r.view.projection, why: r.why }) })
      }
      return 'status' in r ? [] : [r.view]
    })
  // v3.54.18 (gate 1.3.0): what each sketched picture draws as openings, in that picture's own pixels — the gate's band
  // where the model's own (possibly wrong) openings leave no place free is the wall this reading calls plain
  const adoptedFrames = new Set<string>()
  const allSketches = (): SketchReading['sketches'] => sketchSummary?.reading.sketches ?? []
  const facadeClaims = (): Map<string, Array<{ x0: number; y0: number; x1: number; y1: number }>> =>
    new Map(allSketches().filter((x) => x.sketch).map((x) => [x.frameId, (x.sketch?.openings ?? []).map((o) => { const ps = o.polygon as Array<[number, number]>; return { x0: Math.min(...ps.map((q) => q[0])), y0: Math.min(...ps.map((q) => q[1])), x1: Math.max(...ps.map((q) => q[0])), y1: Math.max(...ps.map((q) => q[1])) } })]))
  // v3.54.18 R2: the plan gaps of a LOCAL body the arbitration replaced (a second drawing's witness for the elevation reading)
  let replacedPlanGaps: PlanGap[] = []
  /** v3.54.19: the plan skeleton read inside a LOCAL body that has no interior of its own (through LOCAL's plan registration). */
  let localInterior: InteriorObservation | undefined
  const executeOn = async (l: Local, proposals: readonly CorrectionProposal[], stage: string, seen: Set<string> = seenPatch): Promise<CorrectionOutcome | undefined> => {
    if (!l.run) return undefined
    const pictures = await allPicturesOf(l)
    const m0 = l.run.reconstruction.model
    const retiredIds = new Map([...listedAt].filter(([id]) => !elementExists(m0, id)))
    const held = viewsOfRun(l.run.reconstruction.facadeAlignment.views)
    const plans = (l.run.reconstruction.registrations.plans ?? []).map((q) => ({ frameId: q.frameId, toWorld: q.toWorld }))
    const pitch = (l.pkg ?? l.run.pkg)?.publishedFacts.find((f) => f.key === 'roof_pitch' && f.unit === 'deg')?.value
    // v3.54.21: the page's building height reaches every correction round (SET_ROOF holds a proposed ridge against it)
    const heightP = (l.pkg ?? l.run.pkg)?.publishedFacts.find((f) => f.key === 'building_height' && f.unit === 'm')?.value
    // v3.54.19: the plan skeleton of the body that stands: its exterior gaps witness an opening the elevation reading adds
    const interior = massingOf.get(l)?.interior ?? (massingOf.has(l) ? undefined : localInterior)
    const skeletonGaps = interior && massingOf.has(l) ? planGapsFromSkeleton(m0, interior) : []
    const gaps = [...replacedPlanGaps, ...skeletonGaps]
    const out = executeCorrections({ model: m0, claims: facadeClaims(), adopted: adoptedFrames, ...(gaps.length > 0 ? { planGaps: gaps } : {}), ...(interior ? { interior } : {}), views: massingViews(l) ?? held, derivedViews: (m: CanonicalBuildingModel, h: readonly BindView[]) => sketchViewsOf(m, pictures, h), ...(plans.length > 0 ? { plans } : {}), ...(typeof pitch === 'number' || typeof heightP === 'number' ? { facts: { ...(typeof pitch === 'number' ? { roofPitchDeg: pitch } : {}), ...(typeof heightP === 'number' ? { buildingHeightM: heightP } : {}) } } : {}), pictures, proposals, witnesses: witnessesOf(l), seen, ...(retiredIds.size > 0 ? { retiredIds } : {}) })
    correctionRuns.push({ stage, baseRevision: out.baseRevision, revision: out.revision, delivered: false, records: out.records, transactions: out.transactions })
    record({ at: now().toISOString(), kind: 'CORRECTIONS', stage, baseRevision: out.baseRevision, revision: out.revision, records: out.records.map((r) => ({ proposalId: r.proposalId, operation: r.operation, status: r.status, code: r.code ?? null })), transactions: out.transactions.map((t) => ({ txId: t.txId, decision: t.decision, why: t.why })) })
    return out
  }
  /** The executor's model delivered through the same run as its base (compile, assessment, scene); checked byte for byte. */
  const materialize = async (from: Local, model: CanonicalBuildingModel): Promise<Local | undefined> => {
    // v3.54.17 R2: a body built without LOCAL is delivered again through its own envelope with the patched model
    const mass = massingOf.get(from)
    if (mass) {
      const l = mass.rebuild(model)
      const ok = l?.run !== undefined && sha256Hex(serializeModel(l.run.reconstruction.model)) === sha256Hex(serializeModel(model))
      record({ at: now().toISOString(), kind: 'CORRECTIONS_DELIVERED', ok, via: 'MASSING_ENVELOPE', revision: l?.run ? modelRevision(l.run.reconstruction.model) : null })
      if (ok && correctionRuns.length > 0) correctionRuns[correctionRuns.length - 1].delivered = true
      return ok ? l : undefined
    }
    const lin = lineage.get(from)
    if (!lin || !from.run) return undefined
    const l = await attempt(lin.input, { ...lin.options, patchedModel: { baseSha256: sha256Hex(serializeModel(from.run.reconstruction.model)), model } })
    const ok = l.run !== undefined && sha256Hex(serializeModel(l.run.reconstruction.model)) === sha256Hex(serializeModel(model))
    record({ at: now().toISOString(), kind: 'CORRECTIONS_DELIVERED', ok, revision: l.run ? modelRevision(l.run.reconstruction.model) : null })
    if (ok && correctionRuns.length > 0) correctionRuns[correctionRuns.length - 1].delivered = true
    return ok ? l : undefined
  }
  /** The committed proposals taken again by a new base (a rebuild), each bound against it; those that no longer bind are named. */
  const rebase = async (newBase: Local, stage: string): Promise<Local> => {
    if (committed.length === 0 || !newBase.run) {
      base = undefined
      return newBase
    }
    const rev = modelRevision(newBase.run.reconstruction.model)
    const again = committed.map((p) => ({ ...p, proposalId: `${p.proposalId}@${rev}`, baseRevision: rev }))
    const out = await executeOn(newBase, again, stage, new Set())
    const kept = out ? out.records.filter((r) => r.status === 'COMMITTED').map((r) => r.proposalId) : []
    committed = committed.filter((p) => kept.includes(`${p.proposalId}@${rev}`))
    if (!out || kept.length === 0) {
      base = undefined
      return newBase
    }
    const m = await materialize(newBase, out.model)
    if (!m) {
      committed = []
      base = undefined
      return newBase
    }
    base = newBase
    return m
  }
  // --- v3.54.18: BODY ARBITRATION — LOCAL's body is a hypothesis too ---------------------------------------------------
  // Until v3.54.18 a body LOCAL built was the base every correction had to start from: when LOCAL split one house into
  // several masses, or drew it narrower and taller than its drawings (Medulin: a 7.83 m front for the plan's printed
  // 9.25 m, eaves at 5.5 m for the drawn 3 m), the elevations could not be registered on it, the printed outline was
  // refused ("not one body at the ends") and nothing could repair it — a good correction needed a good LOCAL first. Now
  // the body is held against what does not come from it: the labelled elevation readings (do their wall ends and eaves
  // register on it?), the plan's printed overall dimensions, the page's published building height. Only when that
  // evidence contradicts LOCAL's body is the other body built — from the plan outline and the elevations, the path a
  // house without a LOCAL model already takes — and it replaces LOCAL's only when the same evidence contradicts it less
  // and supports it at least as much. The interior LOCAL read does not move to the new body (named: NOT_CHECKED).
  let bodyArbitration: BodyArbitration | undefined
  if ((wiring.massing ?? 'ON') === 'ON' && (wiring.sketchCorrections ?? 'ON') === 'ON' && wiring.variant !== 'R' && sketchSummary && good.run && good.pkg && good.graph && !massingOf.has(good)) {
    const pkg0 = good.pkg
    const graph0 = good.graph
    const pics = await allPicturesOf(good)
    const printedDims = (metricRead?.reads ?? []).flatMap((r) => r.observations.filter((o) => o.kind === 'LENGTH' && o.scope === 'WHOLE_HOUSE' && o.reference === 'OUTER_FACE' && o.status === 'PRINTED' && typeof o.value === 'number' && (o.axis === 'HORIZONTAL' || o.axis === 'VERTICAL')).map((o) => ({ literal: o.literal, valueM: o.value as number, axis: o.axis as 'HORIZONTAL' | 'VERTICAL' })))
    const publishedHeight = pkg0.publishedFacts.find((f) => f.key === 'building_height' && f.unit === 'm')?.value
    const TURNED_FWD: Record<Side, Side> = { FRONT: 'RIGHT', RIGHT: 'REAR', REAR: 'LEFT', LEFT: 'FRONT' }
    const TURNED_BACK: Record<Side, Side> = { FRONT: 'LEFT', LEFT: 'REAR', REAR: 'RIGHT', RIGHT: 'FRONT' }
    const evidenceOf = (model: CanonicalBuildingModel, heldViews: readonly BindView[], planFront?: Side, traced?: ReadonlyArray<{ x: number; z: number }>): BodyEvidence => {
      // a body built a quarter turn against the plan sheet has the sheet's horizontal along its depth
      const quarterTurned = planFront === 'LEFT' || planFront === 'RIGHT'
      const built = measureBuilt(model, compileBuilding(model))
      const labelled = sketchAnchors().filter((a) => (sketchSummary?.reading.sketches ?? []).some((x) => x.frameId === a.frameId && x.facade !== 'SIDE_UNSPECIFIED'))
      const TURNED = planEntranceSide === 'LEFT' ? TURNED_BACK : TURNED_FWD
      const tryAll = (turn: boolean) => labelled.map((a) => { const r = registerFromSketch({ model, views: [...heldViews], pictures: pics, witnesses: [] }, turn ? { ...a, side: TURNED[a.side] } : a); return { frameId: a.frameId, side: turn ? TURNED[a.side] : a.side, ok: !('status' in r), code: 'status' in r ? r.code ?? r.status : 'REGISTERED', ...('status' in r ? { why: r.why.slice(0, 400) } : {}) } })
      const [asL, asT] = [tryAll(false), tryAll(true)]
      const regs = asT.filter((q) => q.ok).length > asL.filter((q) => q.ok).length ? asT : asL
      // arbitration 1.3.0: a printed dimension measures the SOURCE's outline. A body built from that outline with its small
      // steps left out by the massing's own named convention is shorter by those steps, not at another scale: where the
      // body's bounding rectangle keeps all but `OUTLINE_SIMPLIFICATION.totalShare` of the traced outline's, the dimension
      // is held against the traced extent (a body that dropped a wing does not pass: its rectangle is far smaller).
      const tx = traced && traced.length >= 4 ? { x: Math.max(...traced.map((p) => p.x)) - Math.min(...traced.map((p) => p.x)), z: Math.max(...traced.map((p) => p.z)) - Math.min(...traced.map((p) => p.z)) } : undefined
      const keepsOutline = tx !== undefined && Math.abs(tx.x * tx.z - built.outlineX * built.outlineZ) <= OUTLINE_SIMPLIFICATION.totalShare * tx.x * tx.z
      const dims = printedDims.map((d) => {
        const alongX = (d.axis === 'HORIZONTAL') !== quarterTurned
        const ext = alongX ? built.outlineX : built.outlineZ
        const tol = Math.max(BODY_ARBITRATION.dimAgreeM, BODY_ARBITRATION.dimAgreeShare * d.valueM)
        const own = Math.abs(ext - d.valueM) <= tol
        const src = tx && keepsOutline ? (alongX ? tx.x : tx.z) : undefined
        const bySource = !own && src !== undefined && Math.abs(src - d.valueM) <= tol
        return { literal: d.literal, valueM: d.valueM, modelM: Math.round(ext * 100) / 100, agrees: own || bySource, ...(bySource && src !== undefined ? { outlineM: Math.round(src * 100) / 100 } : {}) }
      })
      const height = typeof publishedHeight === 'number' && typeof built.ridge === 'number' ? { publishedM: publishedHeight, modelRidgeM: Math.round(built.ridge * 100) / 100, agrees: Math.abs(built.ridge - publishedHeight) <= Math.max(BODY_ARBITRATION.heightAgreeM, BODY_ARBITRATION.heightAgreeShare * publishedHeight) } : undefined
      const contradictions = regs.filter((q) => !q.ok).length + dims.filter((d) => !d.agrees).length + (height && !height.agrees ? 1 : 0)
      const supports = regs.filter((q) => q.ok).length + dims.filter((d) => d.agrees).length + (height?.agrees ? 1 : 0)
      return { bodies: bodiesOf(model).length, registrations: regs, printed: dims, ...(height ? { height } : {}), contradictions, supports }
    }
    // LOCAL's body is judged AFTER the roof correction it can take from the same elevations (a wrong eaves height that
    // SET_ROOF repairs is not a wrong body): the roof proposals are tried on a copy, through the same executor and gate
    const mL0 = good.run.reconstruction.model
    const heldL = viewsOfRun(good.run.reconstruction.facadeAlignment.views)
    const sketchInputs0 = sketchSummary.reading.sketches.filter((x) => x.sketch).map((x) => ({ facade: x.facade, frameId: x.frameId, groundRow: x.sketch?.groundRow ?? null, walls: (x.sketch?.walls ?? []).map((w) => w.polygon as Array<[number, number]>), roofs: (x.sketch?.roofs ?? []).map((r) => r.polygon as Array<[number, number]>) }))
    const roofs0 = roofProposalsFromSketches(sketchInputs0, mL0, heldL, modelRevision(mL0), sideOfFacade)
    const pitch0 = pkg0.publishedFacts.find((f) => f.key === 'roof_pitch' && f.unit === 'deg')?.value
    const height0 = pkg0.publishedFacts.find((f) => f.key === 'building_height' && f.unit === 'm')?.value
    const tried = roofs0.proposals.length > 0 ? executeCorrections({ model: mL0, views: heldL, derivedViews: (m: CanonicalBuildingModel, h: readonly BindView[]) => sketchViewsOf(m, pics, h), pictures: pics, proposals: roofs0.proposals.map((q) => ({ ...q, proposalId: `arb:${q.proposalId}` })), witnesses: witnessesOf(good), ...(typeof pitch0 === 'number' || typeof height0 === 'number' ? { facts: { ...(typeof pitch0 === 'number' ? { roofPitchDeg: pitch0 } : {}), ...(typeof height0 === 'number' ? { buildingHeightM: height0 } : {}) } } : {}), seen: new Set<string>() }) : undefined
    const roofFixed = (tried?.records ?? []).filter((r) => r.status === 'COMMITTED').length
    const localEv = evidenceOf(tried && roofFixed > 0 ? tried.model : mL0, heldL)
    // v3.54.19 (arbitration 1.2.0): the typed FORM of the house as one more witness. Asked only where it can say
    // something the other witnesses cannot: LOCAL's body is a pitched house with flat-roofed volumes beside it (LOCAL
    // builds a recessed front as a box of its own under a flat roof; elevations registered by wall ends and the printed
    // overall dimensions agree with such a body just as well). One request, all captioned elevations; no dimension taken.
    // v3.54.21: a roof stated in planes is the kind its planes make (two falls: a gable; three or four: a hip) — measured per
    // roof region by its planes' own directions. (Until now any plane meant "a hip": true while only hips were stated in
    // planes; a gable joined to another roof is stated in planes too.)
    const roofsOf = (model: CanonicalBuildingModel): { flatVolumes: number; pitchedKinds: string[] } => {
      const byRegion = new Map<string, Set<string>>()
      // (planes the drawings' solver names its own way are counted as before: a hip)
      const named = model.roofPlanes.filter((pl) => regionOfPlane(pl.id) !== pl.id)
      for (const pl of named) { const k = regionOfPlane(pl.id); byRegion.set(k, (byRegion.get(k) ?? new Set()).add(`${Math.round(pl.downslope.x)}:${Math.round(pl.downslope.z)}`)) }
      return { flatVolumes: model.roofs.filter((r) => r.kind === 'FLAT').length, pitchedKinds: [...model.roofs.filter((r) => r.kind !== 'FLAT').map((r) => r.kind as string), ...[...byRegion.values()].map((d) => (d.size >= 3 ? 'HIP' : 'GABLE')), ...(named.length < model.roofPlanes.length ? ['HIP'] : [])] }
    }
    const localRoofs = roofsOf(tried && roofFixed > 0 ? tried.model : mL0)
    // v3.54.20: the structure read is asked of every house with two sketched elevations — not only where LOCAL carries
    // flat boxes beside a pitched roof — and what it says of a body's roofs counts only where the agreed structure does
    // not dispute it (a hip the sketches' gable walls contradict is not held against anyone).
    let formRead: FormRead | undefined
    let agreedForm: AgreedStructure | undefined
    // arbitration 1.5.0: the agreed storeys and ridge direction are held against the body too (the host built a one-storey
    // LOCAL body with its ridge across where two storeys and a ridge along the front were agreed, and the roofs' kinds
    // alone answered AGREES). A roof kind the sketches dispute is still held against no one; the storeys still are.
    const withForm = (ev: BodyEvidence, roofs: { flatVolumes: number; pitchedKinds: string[] }, body: CanonicalBuildingModel, bound?: BoundRoofs, mainId?: string): void => {
      if (!formRead?.form) return
      const rb = readbackStructure(body, undefined, STOREY_WALLS)
      // v3.54.21: the main roof's description is held against the body the builder bound it to (by that body's own views),
      // not against the largest rectangle — the arbitration refused a body for carrying the cross wing's ridge on the
      // largest rectangle, exactly where the sources draw it
      const main = (mainId ? rb.bodies.find((q) => q.id === mainId) : undefined) ?? mainBodyOf(rb.bodies, bound)
      const against = agreedForm ? structureAgainstBody(agreedForm, main, STOREY_WALLS) : []
      if (agreedForm?.mainRoof.standing === 'DISPUTED' && against.length === 0) return
      const kinds = agreedForm?.mainRoof.standing === 'DISPUTED' ? 'SILENT' as const : formVerdict(formRead.form, roofs)
      const verdict = against.length > 0 ? 'CONTRADICTS' as const : kinds
      ev.form = { verdict, flatVolumes: roofs.flatVolumes, reportedFlatVolumes: flatVolumesOf(formRead.form), reportedMainRoof: formRead.form.mainRoof.kind, reportedVolumes: formRead.form.volumes, ...(against.length > 0 ? { structure: against } : {}) }
      if (verdict === 'CONTRADICTS') ev.contradictions += 1
      if (verdict === 'AGREES') ev.supports += 1
    }
    {
      const planId = good.plans?.selectedPlanFrameId
      const planR = planId ? await frameRaster(pkg0, graph0, planId, options) : undefined
      // review F5: the plan sent is named (its frame and bytes go into the inventory); its parts come later and agree again
      const st = await structureOf({ pkg0, graph0, sketches: sketchSummary.reading.sketches, ...(planR?.raster ? { planRaster: planR.raster, ...(planId ? { planFrameId: planId } : {}) } : {}) })
      if (st?.read.form) {
        formRead = st.read
        agreedForm = st.agreed
        withForm(localEv, localRoofs, tried && roofFixed > 0 ? tried.model : mL0)
      }
    }
    const arb: BodyArbitration = { version: BODY_ARBITRATION.version, local: localEv, ...(roofFixed > 0 ? { localAfterRoofCorrections: roofFixed } : {}), decision: 'LOCAL_STANDS', why: '' }
    bodyArbitration = arb
    if (localEv.contradictions === 0) arb.why = `nothing the sources state contradicts LOCAL's body (${localEv.supports} agreement(s): elevations registered, printed dimensions, published height${localEv.form ? ', the typed form' : ''})`
    else {
      stage('BODY_ARBITRATION')
      const st = goodState
      const conf = st.metric?.confidence ?? 'INCONCLUSIVE'
      const mb = await buildMassing({ pkg0, graph0, sketches: sketchSummary.reading.sketches, ...(good.plans?.selectedPlanFrameId ? { planFrame: good.plans.selectedPlanFrameId } : {}), ...(typeof st.metric?.cmPerPixelX === 'number' ? { cmPerPx: st.metric.cmPerPixelX } : {}), strong: (CONF_RANK[conf] ?? 0) >= 2, diag: { metricConfidence: conf, metricRelation: st.metric?.relation ?? '?' }, localFailure: { code: 'LOCAL_BODY_CONTRADICTED', reasonCode: 'BODY_ARBITRATION' }, why: `LOCAL's body is contradicted by ${localEv.contradictions} source statement(s); the plan outline and the elevations are read` })
      arb.massing = { decision: mb.delivery.decision, why: mb.delivery.why.slice(0, 400), usd: mb.delivery.usd }
      planEntranceSide = mb.delivery.plan?.entrance?.side ?? planEntranceSide
      planOpenings = mb.delivery.plan?.openings ?? planOpenings
      if (!mb.built?.run) arb.why = `LOCAL's body is contradicted (${localEv.contradictions}), but the other body could not be built (${mb.delivery.why.slice(0, 200)}): LOCAL's stands, the contradiction named`
      else {
        const altFront = massingOf.get(mb.built)?.planFront
        const altEv = evidenceOf(mb.built.run.reconstruction.model, massingViews(mb.built) ?? [], altFront, mb.delivery.plan?.observation?.outline)
        const altHyp = massingOf.get(mb.built)?.hypothesis
        withForm(altEv, roofsOf(mb.built.run.reconstruction.model), mb.built.run.reconstruction.model, altHyp ? { bodies: altHyp.bodies } : undefined)
        // review F1: one main-body rule for both bodies. LOCAL was judged before any binding existed, on its largest
        // rectangle; the source body on the body its builder bound the main roof to. Where those are different parts of
        // the house, LOCAL is judged again on its ring that stands where the source body's MAIN stands
        if (altHyp && localEv.form && formRead?.form) {
          const ringRect = (m: CanonicalBuildingModel, id: string): { minX: number; maxX: number; minZ: number; maxZ: number } | undefined => {
            const ring = m.wallRings.find((r) => r.id === id)
            const ws = ring ? m.walls.filter((w) => ring.wallIds.includes(w.id)) : []
            if (ws.length === 0) return undefined
            const xs = ws.flatMap((w) => [w.start.x, w.end.x])
            const zs = ws.flatMap((w) => [w.start.z, w.end.z])
            return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) }
          }
          const altModel = mb.built.run.reconstruction.model
          const localModel = tried && roofFixed > 0 ? tried.model : mL0
          const altMain = mainBodyOf(readbackStructure(altModel, undefined, STOREY_WALLS).bodies, { bodies: altHyp.bodies })
          const at = altMain ? ringRect(altModel, altMain.id) : undefined
          const localBodies = readbackStructure(localModel, undefined, STOREY_WALLS).bodies
          const largest = mainBodyOf(localBodies)
          const overlap = (a: NonNullable<typeof at>, b: NonNullable<typeof at>): number => Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)) * Math.max(0, Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ))
          const areaOf = (r: NonNullable<typeof at>): number => (r.maxX - r.minX) * (r.maxZ - r.minZ)
          // the LOCAL ring most of whose area (or of the source MAIN's) the two share; none such: the rule cannot be applied
          const there = at ? localBodies.map((q) => ({ q, r: ringRect(localModel, q.id) })).filter((x): x is { q: typeof x.q; r: NonNullable<typeof at> } => !!x.r).map((x) => ({ ...x, share: overlap(at, x.r) / Math.max(1e-9, Math.min(areaOf(at), areaOf(x.r))) })).filter((x) => x.share >= 0.5).sort((a, b) => b.share - a.share)[0] : undefined
          if (there && largest && there.q.id !== largest.id) {
            const before = localEv.form.verdict
            if (before === 'CONTRADICTS') localEv.contradictions -= 1
            if (before === 'AGREES') localEv.supports -= 1
            delete localEv.form
            withForm(localEv, localRoofs, localModel, undefined, there.q.id)
            const judged = (e: BodyEvidence): BodyEvidence['form'] => e.form
            arb.localForm = { main: there.q.id, before, after: judged(localEv)?.verdict ?? 'NOT_JUDGED' }
          }
        }
        if (arb.decision !== 'REPLACED_BY_SOURCE_BODY') massingRejected = mb.delivery
        arb.alternative = altEv
        // v3.54.18 arbitration 1.1.0: the body that replaces LOCAL's must itself be UNCONTRADICTED. One the same sources
        // contradict "less" is still a body they contradict — and it costs the interior and the plan's openings (Jeziorko,
        // cycle 4: 2 contradictions against LOCAL's 3 replaced a good model by a body the published height refuted)
        // v3.54.19 arbitration 1.2.0: a picture that registers on NEITHER body does not choose between them (an
        // elevation whose walls were read too wide fails any body at any scale): it is set aside on both sides, named.
        // What is left must still leave the other body uncontradicted — by every other picture, by the printed
        // dimensions and by the page's height — and LOCAL's contradicted.
        const failsBoth = altEv.registrations.filter((q) => !q.ok && localEv.registrations.some((l) => l.frameId === q.frameId && !l.ok)).map((q) => q.frameId)
        const [altC, localC] = [altEv.contradictions - failsBoth.length, localEv.contradictions - failsBoth.length]
        if (failsBoth.length > 0) arb.setAside = { frames: failsBoth, why: `${failsBoth.length} elevation(s) register on neither body: they do not choose between the two (LOCAL ${localC}, the other body ${altC} contradiction(s) without them)` }
        // v3.54.20 arbitration 1.4.0: the FORM decides between two bodies the pictures' rows contradict alike. Where the
        // agreed structure contradicts LOCAL's body (flat boxes it does not report, another roof kind) and agrees with
        // the other one, the other body stands even with a registration against it — as long as it is contradicted no
        // more than LOCAL's, its printed dimensions are no worse, and the page's height does not refute it (the Jeziorko
        // case of 1.1.0 stays refused: there the height did). A row a few decimetres off is a height to correct; flat
        // boxes beside a gable where the sheets show one house under one roof is another house.
        const printedOff = (e: BodyEvidence): number => e.printed.filter((q) => !q.agrees).length
        const formDecides = localEv.form?.verdict === 'CONTRADICTS' && altEv.form?.verdict === 'AGREES' && altC <= localC && printedOff(altEv) <= printedOff(localEv) && altEv.height?.agrees !== false
        if ((altC === 0 && altC < localC && altEv.supports >= localEv.supports) || formDecides) {
          arb.decision = 'REPLACED_BY_SOURCE_BODY'
          arb.why = altC === 0 ? `the sources contradict LOCAL's body ${localEv.contradictions} time(s) and support it ${localEv.supports}; the body built from the plan outline and the elevations: ${altEv.contradictions} and ${altEv.supports}${failsBoth.length > 0 ? ` (${failsBoth.length} elevation(s) that register on neither body set aside)` : ''}. The source body stands; LOCAL's interior is not carried over (NOT_CHECKED)` : `the agreed structure contradicts LOCAL's body (${localEv.form?.flatVolumes ?? 0} flat-roofed volume(s) against ${localEv.form?.reportedFlatVolumes ?? 0} reported, main roof reported ${localEv.form?.reportedMainRoof}) and agrees with the body built from the plan outline and the elevations; that body is contradicted no more than LOCAL's (${altC} against ${localC}${failsBoth.length > 0 ? `, ${failsBoth.length} elevation(s) that register on neither set aside` : ''}), its printed dimensions are no worse and the page's height does not refute it: the structure decides. The source body stands with its ${altC} contradiction(s) named; LOCAL's interior is not carried over (NOT_CHECKED)`
          massingDelivery = mb.delivery
          massingRejected = undefined
          // the plan gaps are stated on the plan's sides: on a body built turned against the sheet they are not carried (named)
          replacedPlanGaps = good.run && !altFront ? planGapsOf(good.run.reconstruction.model) : []
          if (altFront) { record({ at: now().toISOString(), kind: 'BODY_BUILT_IN_ELEVATION_FRAME', planFront: altFront, why: `the elevations draw the plan's sides a quarter turn from their labels: the body is built with the plan sheet's ${altFront.toLowerCase()} side as its front, so every elevation is read on the side its caption names; LOCAL's plan gaps (stated on the plan's sides) are not carried over` }); planEntranceSide = undefined }
          if (replacedPlanGaps.length > 0) record({ at: now().toISOString(), kind: 'PLAN_GAPS_KEPT_AS_WITNESS', gaps: replacedPlanGaps.length, sides: [...new Set(replacedPlanGaps.map((g) => g.side))], spans: replacedPlanGaps.map((g) => ({ side: g.side, a0: Math.round(g.a0 * 100) / 100, a1: Math.round(g.a1 * 100) / 100, storeyLo: Math.round(g.storeyLo * 100) / 100 })), why: 'the replaced LOCAL body traced these openings on the plan: where the elevation reading draws an opening of the same span on the same side and storey, two drawings agree (applied as a cross-witness, never source-verified)' })
          good = mb.built
          goodState = stateOf(mb.built)
          basis = mb.built
          sketchSummary = { ...sketchSummary, reading: { ...sketchSummary.reading, appearance: { observations: [], projections: {} } }, form: { decision: 'NOT_RUN', why: 'the body was replaced by the one built from the plan outline and the elevations' }, finish: { decision: 'NOT_RUN', why: 'finishes go through the correction registry on this body (SET_FINISH)' } }
        } else arb.why = `LOCAL's body is contradicted ${localEv.contradictions} time(s) (supported ${localEv.supports}), the other body ${altEv.contradictions} (supported ${altEv.supports}): ${altC > 0 ? 'the sources contradict the other body too — a contradicted body replaces nothing' : 'not clearly better'}; LOCAL's stands, both on the record`
      }
    }
    record({ at: now().toISOString(), kind: 'BODY_ARBITRATION', ...arb })
  }
  if ((wiring.sketchCorrections ?? 'ON') === 'ON' && wiring.variant !== 'R' && sketchSummary && good.run) {
    const run = good.run
    const rev = modelRevision(run.reconstruction.model)
    const held = massingViews(good) ?? viewsOfRun(run.reconstruction.facadeAlignment.views)
    // v3.54.17: the bodies' roofs first — a roof the sketches draw and the model lacks (or has wrong) is a SET_ROOF
    // (review W2: a weak-labelled side drawing the read placed for this body is read on THAT side by the roof proposals too)
    const facadeFor = (x: { facade: string; frameId: string }): string => { const sd = massingOf.get(good)?.weakSides?.[x.frameId]; return sd === 'RIGHT' ? 'EAST' : sd === 'LEFT' ? 'WEST' : x.facade }
    const sketchInputs = () => sketchSummary.reading.sketches.filter((x) => x.sketch).map((x) => ({ facade: facadeFor(x), frameId: x.frameId, groundRow: x.sketch?.groundRow ?? null, walls: (x.sketch?.walls ?? []).map((w) => w.polygon as Array<[number, number]>), roofs: (x.sketch?.roofs ?? []).map((r) => r.polygon as Array<[number, number]>) }))
    // v3.54.18 R2: what the plan read says of the main entrance decides WHICH quarter turn a turned set of elevations is
    const pageHeightM = (good.pkg ?? run.pkg)?.publishedFacts.find((f: { key: string; unit?: string }) => f.key === 'building_height' && f.unit === 'm')?.value
    const orientationHints = { ...(planEntranceSide ? { entranceSide: planEntranceSide } : {}), ...(typeof pageHeightM === 'number' ? { buildingHeightM: pageHeightM } : {}) }
    let roofs = roofProposalsFromSketches(sketchInputs(), run.reconstruction.model, held, rev, sideOfFacade, orientationHints)
    // v3.54.17 R2: ONE side mapping for every consumer of the sketches — under a TURNED_90 hypothesis the openings are not
    // bound through the analyzer's registrations made as labelled (that would bind them to the other side)
    const turnedSides = roofs.orientation.assignment === 'TURNED_90'
    // v3.54.17 R3: under TURNED_90 each elevation is registered (from its sketch) on the side the orientation reads, and its
    // openings and stacks are bound through that registration — no longer skipped
    sketchSideOf = turnedSides ? (roofs.orientation.sideOf as Record<string, Side> | undefined) : undefined
    // v3.54.21 (post-trial review W1/W2): the side drawings whose weak labels the structure read overruled when this body
    // was solved keep that side for their openings, stacks, finishes and roofs too — one side per picture for every
    // consumer, not the body on one wall and its windows on the mirrored one
    const weakSides = massingOf.get(good)?.weakSides
    if (!turnedSides && weakSides) {
      sketchSideOf = { ...(sketchSideOf ?? {}), ...weakSides }
    }
    // v3.54.17 R3: the elevations no caption tells apart ("side" twice): each is tried on every model side no other
    // elevation shows, all of them at once; a permutation is taken only when it is the only one that registers, or its
    // drawn openings support it by a clear margin (z ≥ 1 over the next) — otherwise they stay unassigned, by name
    const sidesByConvention = new Set<string>()
    const sideBasisOf = new Map<string, string>()
    if (!turnedSides) for (const frameId of Object.keys(weakSides ?? {})) sideBasisOf.set(frameId, 'STRUCTURE_READ_WEAK_LABEL')
    // v3.54.18 R3: a side the CAPTION does not state. Two pictures the publisher captions with the same words ("side
    // elevation" twice) are not told apart by the source; LOCAL's left/right for them is its own hypothesis, made in its
    // own frame. Such an elevation is assigned like an unlabelled one — by what registers, by the model's openings, by
    // the openings the PLAN draws on each side — and LOCAL's label is only the convention of last resort (named).
    const captionOf = (frameId: string): string => { const fr = good.graph?.coordinateFrames.find((q) => q.id === frameId); return (good.pkg?.assets.find((a) => a.id === fr?.assetId)?.caption ?? '').trim().toLowerCase() }
    const sideOnly = (x: { facade: string }): boolean => x.facade === 'EAST' || x.facade === 'WEST' || x.facade === 'SIDE_UNSPECIFIED'
    const weakSide = (x: { facade: string; frameId: string }): boolean => (x.facade === 'EAST' || x.facade === 'WEST') && captionOf(x.frameId) !== '' && (sketchSummary?.reading.sketches ?? []).some((y) => y.frameId !== x.frameId && sideOnly(y) && captionOf(y.frameId) === captionOf(x.frameId))
    const decideSides = async (model: CanonicalBuildingModel, heldViews: readonly BindView[], from: Local, final = false): Promise<void> => {
      const unlabelled = (sketchSummary?.reading.sketches ?? []).filter((x) => x.sketch && (x.facade === 'SIDE_UNSPECIFIED' || weakSide(x)) && !sketchSideOf?.[x.frameId])
      const taken = new Set((sketchSummary?.reading.sketches ?? []).filter((x) => (x.facade !== 'SIDE_UNSPECIFIED' && !weakSide(x)) || sketchSideOf?.[x.frameId]).map((x) => sketchSideOf?.[x.frameId] ?? sideOfFacade(x.facade)).filter((v): v is Side => !!v))
      const free = (['FRONT', 'RIGHT', 'REAR', 'LEFT'] as Side[]).filter((sd) => !taken.has(sd))
      const pics = unlabelled.length > 0 ? await allPicturesOf(from) : []
      const anchorsFor = (frameId: string, side: Side): SketchAnchors | undefined => { const sv = sketchSideOf; sketchSideOf = { ...(sv ?? {}), [frameId]: side }; const a = sketchAnchors().find((q) => q.frameId === frameId); sketchSideOf = sv; return a }
      // v3.54.18: an unlabelled picture that registers on NO free side is not an elevation of this house at this scale (a
      // perspective the page files among the elevations, a detail) — it is set aside by name instead of blocking the
      // others (Alaska: one such picture kept the fourth elevation from ever being assigned)
      const refusals: Array<{ frameId: string; side: Side; code: string; why: string }> = []
      const registersOn = (x: (typeof unlabelled)[number], sd: Side): boolean => { const a = anchorsFor(x.frameId, sd); const r = a ? registerFromSketch({ model, views: [...heldViews], pictures: pics, witnesses: [] }, a) : undefined; if (r && 'status' in r) refusals.push({ frameId: x.frameId, side: sd, code: r.code ?? r.status, why: (r.why ?? '').slice(0, 260) }); else if (!r) refusals.push({ frameId: x.frameId, side: sd, code: 'NO_ANCHORS', why: 'the reading draws no ground row, wall corner or roof to register it by' }); return !!r && !('status' in r) }
      const unspecified = unlabelled.filter((x) => free.some((sd) => registersOn(x, sd)))
      const setAside = unlabelled.filter((x) => !unspecified.includes(x))
      if (setAside.length > 0 && final) record({ at: now().toISOString(), kind: 'UNLABELLED_PICTURES_SET_ASIDE', frames: setAside.map((x) => x.frameId), free, refusals: refusals.filter((q) => setAside.some((x) => x.frameId === q.frameId)), why: 'registers on no free side of the model (wall ends, ground and eaves or ridge): not an elevation of this house at this scale — read, not used' })
      if (unspecified.length > 0 && unspecified.length <= free.length && unspecified.length <= 3) {
        const perms: Side[][] = unspecified.length === 1 ? free.map((f) => [f]) : unspecified.length === 2 ? free.flatMap((f1) => free.filter((f2) => f2 !== f1).map((f2) => [f1, f2])) : free.flatMap((f1) => free.filter((f2) => f2 !== f1).flatMap((f2) => free.filter((f3) => f3 !== f1 && f3 !== f2).map((f3) => [f1, f2, f3])))
        const scored = perms.map((perm) => {
          const regs = unspecified.map((x, i) => { const a = anchorsFor(x.frameId, perm[i]); return a ? registerFromSketch({ model, views: [...heldViews], pictures: pics, witnesses: [] }, a) : undefined })
          const ok = regs.every((r) => r && !('status' in r))
          // the plan's word: the openings the plan draws on the side each elevation would stand on, against the ones it draws
          const planFront = massingOf.get(from)?.planFront
          const plan = planOpenings ? unspecified.reduce((t, x, i) => t + stretchAgreement(planOpenings.filter((o) => planSideInModel(o.side, planFront) === perm[i]), drawnStretches(x.sketch as NonNullable<typeof x.sketch>)).score, 0) : null
          // v3.54.20: and the plan SHEET's word — the gaps the skeleton read in the exterior walls (pixels of the plan, not
          // an answer), as stretches of each side seen from outside
          const io = massingOf.get(from)?.interior
          const sheetGaps = io ? planGapsFromSkeleton(model, io) : []
          const gapStretches = (sd: Side): Array<{ u0: number; u1: number }> => { const rg = sideRange(model, sd); if (!rg || !(rg.hi - rg.lo > 0.5)) return []; const w = rg.hi - rg.lo; return sheetGaps.filter((g) => g.side === sd).map((g) => (sd === 'FRONT' || sd === 'RIGHT' ? { u0: (g.a0 - rg.lo) / w, u1: (g.a1 - rg.lo) / w } : { u0: (rg.hi - g.a1) / w, u1: (rg.hi - g.a0) / w })) }
          const sheet = sheetGaps.length > 0 ? unspecified.reduce((t, x, i) => t + stretchAgreement(gapStretches(perm[i]), drawnStretches(x.sketch as NonNullable<typeof x.sketch>)).score, 0) : null
          return { perm, ok, score: regs.reduce((t, r) => t + (r && !('status' in r) ? r.support ?? 0 : 0), 0), plan, sheet }
        }).filter((q) => q.ok).sort((a, b) => b.score - a.score)
        const bySupport = scored.length === 1 || (scored.length > 1 && scored[0].score - scored[1].score >= 1) ? scored[0] : undefined
        const planRanked = [...scored].filter((q) => q.plan !== null).sort((a, b) => (b.plan as number) - (a.plan as number))
        const byPlan = !bySupport && planRanked.length > 1 && (planRanked[0].plan as number) - (planRanked[1].plan as number) >= SIDE_MARGIN ? planRanked[0] : undefined
        // v3.54.20: the structure read was shown every elevation beside the plan and says which side each shows; where
        // the registrations and the plan's openings do not tell the assignments apart, its word is taken before the
        // source order — a read side, named as such (STRUCTURE_READ), on an assignment that registers
        const saidSide = (frameId: string): Side | undefined => { const n = (structureMemo?.frames ?? []).indexOf(frameId) + 1; const sd = n > 0 ? structureMemo?.agreed?.pictures.find((q) => q.n === n)?.shows : undefined; return sd && sd !== 'NONE' ? (sd as Side) : undefined }
        const sheetRanked = [...scored].filter((q) => q.sheet !== null).sort((a, b) => (b.sheet as number) - (a.sheet as number))
        const bySheet = !bySupport && !byPlan && sheetRanked.length > 1 && (sheetRanked[0].sheet as number) - (sheetRanked[1].sheet as number) >= SIDE_MARGIN ? sheetRanked[0] : undefined
        const byStructure = !bySupport && !byPlan && !bySheet && unspecified.every((x) => saidSide(x.frameId) !== undefined) ? scored.find((q) => q.perm.every((sd, i) => sd === saidSide(unspecified[i].frameId))) : undefined
        const decided = bySupport ?? byPlan ?? bySheet ?? byStructure
        // v3.54.18: where several assignments register and nothing tells them apart, the source's own order is taken as an
        // explicit MINIATURE CONVENTION (first unlabelled side elevation = LEFT when LEFT is free, the next free side after
        // it) — recorded as a convention, never as a read side: the sides keep their facades instead of none of them
        // being placed. Only on the last call (`final`), after evidence had every chance to decide.
        // (an elevation whose side only LOCAL named keeps that side as the convention; the others follow the source order)
        const localSaid = unspecified.map((x) => (weakSide(x) ? sideOfFacade(x.facade) : undefined))
        const byLocal = !decided && final && scored.length > 1 && localSaid.some((v) => v) ? scored.find((q) => q.perm.every((sd, i) => localSaid[i] === undefined || localSaid[i] === sd)) : undefined
        // v3.54.20: the source-order convention never puts a picture on a side the structure read contradicts (a rear
        // elevation that registers only as a side was placed on the LEFT, its openings with it): such a picture stays
        // unassigned, named — its openings can still be read by the typed list on the side the read saw
        const contradictsRead = (q: { perm: Side[] }): boolean => q.perm.some((sd, i) => { const said = saidSide(unspecified[i].frameId); return said !== undefined && said !== sd })
        const byOrder = byLocal ?? (!decided && final && scored.length > 1 ? scored.find((q) => !contradictsRead(q) && q.perm.every((sd, i) => sd === (['LEFT', 'RIGHT', 'REAR', 'FRONT'] as Side[]).filter((f) => free.includes(f))[i])) : undefined)
        const pick = decided ?? byOrder
        if (pick) for (const x of unspecified) sideBasisOf.set(x.frameId, byPlan && pick === byPlan ? 'PLAN_OPENINGS' : bySheet && pick === bySheet ? 'PLAN_SHEET_GAPS' : byStructure && pick === byStructure ? 'STRUCTURE_READ' : decided ? 'EVIDENCE' : byLocal ? 'CONVENTION_LOCAL_LABEL_NOT_IN_CAPTION' : 'MINIATURE_CONVENTION_SOURCE_ORDER')
        record({ at: now().toISOString(), kind: 'SIDE_OF_UNLABELLED_ELEVATIONS', frames: unspecified.map((x) => x.frameId), options: scored.map((q) => ({ sides: q.perm, support: Math.round(q.score * 100) / 100, ...(q.plan !== null ? { planOpenings: Math.round(q.plan * 100) / 100 } : {}), ...(q.sheet !== null ? { sheetGaps: Math.round(q.sheet * 100) / 100 } : {}) })), chosen: pick?.perm ?? null, basis: byPlan && pick === byPlan ? 'PLAN_OPENINGS' : bySheet && pick === bySheet ? 'PLAN_SHEET_GAPS' : byStructure && pick === byStructure ? 'STRUCTURE_READ' : decided ? 'EVIDENCE' : byLocal ? 'CONVENTION_LOCAL_LABEL_NOT_IN_CAPTION' : byOrder ? 'MINIATURE_CONVENTION_SOURCE_ORDER' : 'NONE', planOpeningsVersion: PLAN_OPENINGS_VERSION, why: byPlan && pick === byPlan ? `the openings the plan draws on each side agree with these elevations' own by a clear margin (${(planRanked[0].plan as number).toFixed(1)} against ${(planRanked[1].plan as number).toFixed(1)} net matched openings; the margin is ${SIDE_MARGIN})` : decided ? (scored.length === 1 ? 'the only assignment under which every one registers' : 'the drawn openings support it by a clear margin') : byOrder ? 'several assignments register and the drawings do not tell them apart: the source order is taken as a named miniature convention (the side is NOT read; mirrored sides are possible)' : scored.length === 0 ? 'no assignment registers them all' : 'two assignments register and the drawings do not tell them apart: left unassigned for now (named, not chosen)' })
        if (pick) sketchSideOf = { ...(sketchSideOf ?? {}), ...Object.fromEntries(unspecified.map((x, i) => [x.frameId, pick.perm[i]])) }
        if (byOrder) for (const x of unspecified) sidesByConvention.add(x.frameId)
      }
    }
    await decideSides(run.reconstruction.model, held, good)
    const sem: NonNullable<SketchSummary['semantic']> = { version: `${SKETCH_PROPOSALS_VERSION}+massing-${MASSING_OPS_VERSION}`, decision: 'NOT_RUN', why: '', accounts: [], records: [], transactions: [], massing: roofs.accounts, orientation: roofs.orientation }
    sketchSummary.semantic = sem
    // v3.54.17 R3: two phases. The bodies' roofs first: a wrong eaves height in the model (two full storeys where the
    // drawing has one and an attic) is what keeps every elevation from registering. Then, on the model that now stands,
    // each elevation is registered from its sketch and its openings and stacks are proposed and bound through it.
    let stood: Local = good
    const kept: CorrectionProposal[] = []
    let asked = 0
    const phase = async (stage: string, ps: CorrectionProposal[]): Promise<void> => {
      if (ps.length === 0) return
      asked += ps.length
      const out = await executeOn(stood, ps, stage)
      sem.records = [...sem.records, ...(out?.records ?? [])]
      sem.transactions = [...sem.transactions, ...(out?.transactions ?? [])]
      const ok = (out?.records ?? []).filter((r) => r.status === 'COMMITTED')
      // delivered on the run the sketches started from: a patched model is always laid on LOCAL's own rebuild
      const m = out && ok.length > 0 ? await materialize(good, out.model) : undefined
      if (m) {
        stood = m
        kept.push(...ps.filter((p) => ok.some((r) => r.proposalId === p.proposalId)))
      } else if (ok.length > 0) sem.why = 'the kept patches could not be delivered through the run (the base did not rebuild byte for byte)'
    }
    // v3.54.17 R3: first the outline against the plan's PRINTED overall dimensions (the metric read's whole-house, outer-face
    // lengths with their dimension lines): a wall face the trace missed makes every registration by the walls wrong too
    const mainWall = (() => {
      const bs = bodiesOf(run.reconstruction.model).sort((a, b) => (b.rect.maxX - b.rect.minX) * (b.rect.maxZ - b.rect.minZ) - (a.rect.maxX - a.rect.minX) * (a.rect.maxZ - a.rect.minZ))
      return bs[0]?.wallIds[0]
    })()
    const frameHash = new Map((good.graph?.coordinateFrames ?? []).map((f) => [f.id, f.variantByteHash]))
    const printed: CorrectionProposal[] = mainWall ? (metricRead?.reads ?? []).flatMap((r) => r.observations.filter((o) => o.kind === 'LENGTH' && o.scope === 'WHOLE_HOUSE' && o.reference === 'OUTER_FACE' && o.status === 'PRINTED' && typeof o.value === 'number' && o.ends).map((o) => ({ proposalId: `printed:${o.id}`, baseRevision: rev, operation: 'SET_OUTLINE', targetId: mainWall, patch: { printed: { valueM: o.value as number, literal: o.literal, planFrameId: r.frameId, from: (o.ends as NonNullable<typeof o.ends>).from, to: (o.ends as NonNullable<typeof o.ends>).to, sourceByteHash: frameHash.get(r.frameId) ?? '' } }, origin: 'METRIC' as const, uncertainty: 'LOW' as const, justification: `the plan prints "${o.literal}" as the house's overall ${o.axis === 'HORIZONTAL' ? 'width' : 'depth'} to the outer faces${o.hostHint ? ` (${o.hostHint})` : ''}` }))) : []
    record({ at: now().toISOString(), kind: 'PRINTED_OUTLINE', mainWall: mainWall ?? null, proposals: printed.map((x) => x.proposalId), dimensions: (metricRead?.reads ?? []).reduce((n, r) => n + r.observations.length, 0) })
    await phase('PRINTED_OUTLINE', printed)
    if (stood !== good && stood.run) roofs = roofProposalsFromSketches(sketchInputs(), stood.run.reconstruction.model, massingViews(stood) ?? viewsOfRun(stood.run.reconstruction.facadeAlignment.views), modelRevision(stood.run.reconstruction.model), sideOfFacade, orientationHints)
    sem.massing = roofs.accounts
    sem.orientation = roofs.orientation
    record({ at: now().toISOString(), kind: 'SKETCH_ROOFS', orientation: roofs.orientation.assignment, proposals: roofs.proposals.map((x) => x.proposalId), accounts: roofs.accounts.map((a) => ({ frameId: a.frameId, side: a.side ?? null, proposed: a.proposed.length, skipped: a.skipped.map((k) => k.why.slice(0, 220)) })) })
    await phase('SKETCH_ROOF', roofs.proposals)
    // v3.54.19: the interior the plan draws, inside the body that now stands (a body built from the sources had none;
    // one that replaced LOCAL's lost it). After the roofs: the partitions stay under the eaves that stand.
    {
      const mI = stood.run?.reconstruction.model
      const ground = mI ? [...mI.levels].sort((a, b) => a.elevation - b.elevation)[0] : undefined
      const bare = !!mI && !!ground && !mI.walls.some((w) => w.kind === 'INTERIOR' && w.levelId === ground.id)
      // a LOCAL body without partitions: the same reading, inside each of its ground-storey bodies, through LOCAL's own
      // registration of the plan sheet (its `PlanFrameV2`)
      if (bare && mI && ground && !massingOf.has(stood) && stood.run && stood.pkg && stood.graph) {
        const pf = stood.run.reconstruction.registrations.plans.find((q) => q.frameId === stood.plans?.selectedPlanFrameId) ?? stood.run.reconstruction.registrations.plans.find((q) => q.storeyIndex === 0)
        const fx = pf ? stood.graph.coordinateFrames.find((q) => q.id === pf.frameId) : undefined
        const fr = pf && fx ? await frameRaster(stood.pkg, stood.graph, pf.frameId, options) : undefined
        if (pf && fx && fr?.raster) {
          const parts: InteriorObservation[] = []
          const refusedAll: string[] = []
          for (const [k, b] of bodiesOf(mI).filter((q) => q.levelIds.includes(ground.id) && q.wallIds.length > 0).entries()) {
            const c = [pf.toPixel(b.rect.minX, b.rect.maxZ), pf.toPixel(b.rect.maxX, b.rect.maxZ), pf.toPixel(b.rect.maxX, b.rect.minZ), pf.toPixel(b.rect.minX, b.rect.minZ)]
            const sk = readPlanSkeleton({ frameId: pf.frameId, sourceByteHash: fx.variantByteHash, raster: fr.raster, outlinePx: c.map((q) => [q.x, q.y] as [number, number]), mPerPx: (pf.mppX + pf.mppY) / 2 })
            refusedAll.push(...sk.refused)
            if (sk.refused.some((q) => q.startsWith('WALL_STYLE') || q.startsWith('EXTERIOR_BAND: no'))) continue
            const o = skeletonInModel(sk, (px, py) => pf.toWorld(px, py))
            parts.push({ ...o, walls: o.walls.map((w) => ({ ...w, id: k > 0 ? `${w.id}-m${k}` : w.id })), doors: o.doors.map((d) => ({ ...d, id: k > 0 ? `${d.id}-m${k}` : d.id })) })
          }
          if (parts.length > 0) localInterior = { ...parts[0], walls: parts.flatMap((q) => q.walls), doors: parts.flatMap((q) => q.doors), gaps: [], why: `the ground-floor plan ${pf.frameId} read on the sheet in its own wall colour inside ${parts.length} body/bodies of the model LOCAL built without partitions: ${parts.reduce((t, q) => t + q.walls.length, 0)} partition piece(s), ${parts.reduce((t, q) => t + q.doors.length, 0)} interior door gap(s)` }
          record({ at: now().toISOString(), kind: 'PLAN_SKELETON', version: PLAN_SKELETON_VERSION, frameId: pf.frameId, basis: 'LOCAL_PLAN_REGISTRATION', bodies: parts.length, walls: localInterior?.walls.length ?? 0, doors: localInterior?.doors.length ?? 0, refused: refusedAll })
        }
      }
      const io = massingOf.get(stood)?.interior ?? (massingOf.has(stood) ? undefined : localInterior)
      if (io && mI && bare && io.walls.length > 0) {
        record({ at: now().toISOString(), kind: 'PLAN_INTERIOR', version: INTERIOR_OPS_VERSION, frameId: io.frameId, walls: io.walls.length, doors: io.doors.length, gaps: io.gaps.length, why: io.why })
        await phase('PLAN_INTERIOR', [{ proposalId: `interior:${io.frameId.slice(-12)}`, baseRevision: modelRevision(mI), operation: 'BUILD_INTERIOR', targetId: 'WHOLE', origin: 'PLAN', uncertainty: 'MEDIUM', justification: io.why }])
      }
    }
    // the heights the roof phase corrected may let an unlabelled elevation register now
    await decideSides((stood.run ?? run).reconstruction.model, massingViews(stood) ?? viewsOfRun((stood.run ?? run).reconstruction.facadeAlignment.views), stood, true)
    const m2 = stood.run?.reconstruction.model ?? run.reconstruction.model
    const held2 = massingViews(stood) ?? (stood.run ? viewsOfRun(stood.run.reconstruction.facadeAlignment.views) : held)
    const pictures2 = await allPicturesOf(stood)
    const views = [...held2, ...sketchViewsOf(m2, pictures2, held2)]
    const sketched = sketchSummary.reading.sketches.filter((x) => x.sketch)
    const accounts = sketched.map((x) => proposalsFromSketch(x.sketch as NonNullable<typeof x.sketch>, x.facade, m2, views, modelRevision(m2), sketchSideOf?.[x.frameId]))
    sem.accounts = accounts.map((a) => ({ frameId: a.frameId, ...(a.side ? { side: a.side } : {}), proposals: a.proposals.length, agreed: a.agreed.length, agreedIds: a.agreed.map((g) => ({ sketchId: g.sketchId, modelId: g.modelId })), skipped: a.skipped }))
    if (sidesByConvention.size > 0) sem.sidesByConvention = [...sidesByConvention].map((frameId) => ({ frameId, side: sketchSideOf?.[frameId] ?? null, basis: 'MINIATURE_CONVENTION_SOURCE_ORDER' as const }))
    // v3.54.17 R3: a stack seen from the eaves side and from a gable end is one stack with both coordinates
    const stacks: SketchedStack[] = sketched.flatMap((x) => {
      const sk = x.sketch as NonNullable<typeof x.sketch>
      const side = sketchSideOf?.[x.frameId] ?? sideOfFacade(x.facade)
      const view = side ? preferredView(views, x.frameId, side) : undefined
      if (!side || !view || sk.roofs.length === 0) return []
      const roofTopRow = Math.min(...sk.roofs.flatMap((r) => (r.polygon as Array<[number, number]>).map((q) => q[1])))
      return sk.elements.filter((e) => e.kind === 'CHIMNEY').map((e) => {
        const ps = e.polygon as Array<[number, number]>
        return { proposalId: `sk:${x.frameId.slice(-10)}:chimney:${e.id}`, frameId: x.frameId, side, view, roofTopRow, box: { x0: Math.min(...ps.map((q) => q[0])), y0: Math.min(...ps.map((q) => q[1])), x1: Math.max(...ps.map((q) => q[0])), y1: Math.max(...ps.map((q) => q[1])) } }
      })
    })
    const fusion = fuseChimneys(m2, stacks, accounts.flatMap((a) => a.proposals), pictures2)
    sem.chimneyFusion = { version: CHIMNEY_FUSION_VERSION, ...fusion.record }
    await phase('SKETCH', fusion.proposals)
    // v3.54.18: the openings again on the model that now stands, at most twice more. A correction is judged in the
    // order it is given: a window whose place was still taken by an opening corrected after it (OPENINGS_OVERLAP), or
    // whose band was still filled by phantoms removed after it, is proposed afresh from the same reading — pairing and
    // band recomputed on the new revision. What the source refused stays refused; a pass that keeps nothing ends it.
    for (let pass = 2; pass <= 3; pass += 1) {
      const before = stood
      if (!before.run || before === good) break
      const mN = before.run.reconstruction.model
      const heldN = massingViews(before) ?? viewsOfRun(before.run.reconstruction.facadeAlignment.views)
      const viewsN = [...heldN, ...sketchViewsOf(mN, await allPicturesOf(before), heldN)]
      const settled = new Map(sem.records.map((r) => [r.proposalId.replace(/@p\d$/, ''), r.status]))
      const again = sketched.flatMap((x) => proposalsFromSketch(x.sketch as NonNullable<typeof x.sketch>, x.facade, mN, viewsN, modelRevision(mN), sketchSideOf?.[x.frameId]).proposals)
        .filter((q) => (q.operation === 'ADD_OPENING' || q.operation === 'UPDATE_OPENING' || q.operation === 'REMOVE_OPENING') && !['REJECTED_BY_SOURCE', 'INVALID'].includes(settled.get(q.proposalId) ?? ''))
        .map((q) => ({ ...q, proposalId: `${q.proposalId}@p${pass}` }))
      if (again.length === 0) break
      await phase(`SKETCH_PASS_${pass}`, again)
      if (stood === before) break
    }
    // v3.54.18: facade adoption — where the picture supported most of a reading's openings and refuted none, what it
    // left undecided on that side follows the reading (applied, never marked source-verified)
    if (stood.run) {
      const mA = stood.run.reconstruction.model
      const heldA = massingViews(stood) ?? viewsOfRun(stood.run.reconstruction.facadeAlignment.views)
      const viewsA = [...heldA, ...sketchViewsOf(mA, await allPicturesOf(stood), heldA)]
      const fates = new Map<string, string>()
      for (const r of sem.records) {
        const parts = r.proposalId.replace(/@\w+$/, '').split(':')
        if (parts[0] !== 'sk') continue
        if (r.operation === 'REMOVE_OPENING') fates.set(`${parts[1]}|rem:${r.targetId}`, r.status)
        else if (r.operation === 'ADD_OPENING' || r.operation === 'UPDATE_OPENING') fates.set(`${parts[1]}|open:${parts.slice(3).join(':')}`, r.status === 'NEEDS_EVIDENCE' && (r.gate?.proposedZ ?? -1) >= 2 ? 'UNDECIDED_BUT_SUPPORTED' : r.status)
      }
      const ads = sketched.map((x) => facadeAdoption(x.sketch as NonNullable<typeof x.sketch>, x.facade, mA, viewsA, modelRevision(mA), (key) => fates.get(`${x.frameId.slice(-10)}|${key}`), sketchSideOf?.[x.frameId]))
      sem.adoption = ads.map(({ proposals, ...a }) => ({ ...a, proposed: proposals.length }))
      for (const a of ads) if (a.decision === 'ADOPTED') adoptedFrames.add(a.frameId)
      record({ at: now().toISOString(), kind: 'FACADE_ADOPTION', facades: sem.adoption })
      await phase('FACADE_ADOPT', ads.flatMap((a) => a.proposals))
    }
    // v3.54.18: the finish zones of every side whose walls carry none yet (always so on a body built without LOCAL; with
    // LOCAL, the sides its finish consumer did not reach) — through the same registry and the same registrations
    {
      const m3 = stood.run?.reconstruction.model ?? m2
      const held3 = massingViews(stood) ?? (stood.run ? viewsOfRun(stood.run.reconstruction.facadeAlignment.views) : held)
      const views3 = [...held3, ...sketchViewsOf(m3, await allPicturesOf(stood), held3)]
      const fin = sketched.map((x) => finishProposalsFromSketch(x.sketch as NonNullable<typeof x.sketch>, x.facade, m3, views3, modelRevision(m3), sketchSideOf?.[x.frameId]))
      sem.finishes = { proposed: fin.reduce((n, f) => n + f.proposals.length, 0), skipped: fin.flatMap((f) => f.skipped) }
      await phase('SKETCH_FINISH', fin.flatMap((f) => f.proposals))
    }
    // v3.54.19: PLAN GAPS THE MODEL DOES NOT COVER. The ground-floor plan draws a gap in an exterior wall (plan skeleton)
    // and after every elevation reading the model still has no opening there — the contour reading missed it, or its
    // registration could not place it. That side's elevation is then read once more as a list IN METRES along its known
    // width (`facade-metric.ts`); where that list puts a ground-storey opening on the gap's stretch, the opening is
    // built: span from the plan, kind and heights from the list. Two drawings, two readers; never source-verified.
    {
      const io = massingOf.get(stood)?.interior
      const mG = stood.run?.reconstruction.model
      if (io && mG && stood.pkg && stood.graph && io.gaps.length > 0) {
        const share = (a0: number, a1: number, b0: number, b1: number): number => (Math.min(a1, b1) - Math.max(a0, b0)) / Math.max(a1 - a0, b1 - b0, 1e-6)
        const gaps = planGapsFromSkeleton(mG, io)
        const uncovered = gaps.filter((g) => !sideOpeningSpans(mG, g.side).some((o) => o.b0 < g.storeyHi && share(o.a0, o.a1, g.a0, g.a1) >= 0.4))
        const proposals: CorrectionProposal[] = []
        const reads: Array<Record<string, unknown>> = []
        for (const side of (['FRONT', 'RIGHT', 'REAR', 'LEFT'] as Side[]).filter((sd) => uncovered.some((g) => g.side === sd))) {
          // v3.54.20: the typed list is read on the elevation's own picture across the side's width — it needs the side,
          // not a registration. Where no sketch is assigned to this side (its picture registered on no side of a body
          // whose heights are off), the side the structure read saw on that picture is taken: the plan's gaps on three
          // sides of one house stayed uncovered because none of its elevations could be asked.
          const assigned = new Set(sketched.map((q) => sketchSideOf?.[q.frameId] ?? sideOfFacade(q.facade)).filter(Boolean))
          const byStructureRead = (sd: Side): (typeof sketched)[number] | undefined => { if (assigned.has(sd)) return undefined; const n = structureMemo?.agreed?.pictures.find((q) => q.shows === sd)?.n; const fid = n ? structureMemo?.frames[n - 1] : undefined; return fid ? sketched.find((q) => q.frameId === fid && !(sketchSideOf?.[q.frameId] ?? sideOfFacade(q.facade))) : undefined }
          const x = sketched.find((q) => (sketchSideOf?.[q.frameId] ?? sideOfFacade(q.facade)) === side) ?? byStructureRead(side)
          const range = sideRange(mG, side)
          const fx = x ? stood.graph.coordinateFrames.find((q) => q.id === x.frameId) : undefined
          const fr = x && fx ? await frameRaster(stood.pkg, stood.graph, x.frameId, options) : undefined
          if (!x || !range || !fr?.raster) continue
          const widthM = range.hi - range.lo
          stage('FACADE_METRIC')
          const read = await readFacadeMetric({ model: wiring.outlineModel ?? wiring.metricModel ?? wiring.model, price: wiring.outlinePrice ?? wiring.metricPrice ?? wiring.price, ...(wiring.spend ? { spend: wiring.spend } : {}), ...(options.signal ? { signal: options.signal } : {}) }, { frameId: x.frameId, raster: fr.raster, side, widthM, caption: (stood.pkg.assets.find((a) => a.id === fx?.assetId)?.caption ?? '').slice(0, 120) })
          usd += read.usd
          // the list runs left to right as the picture shows the side: along the model's axis on the front and the right
          // side, against it on the rear and the left
          const alongOf = (leftM: number): number => (side === 'FRONT' || side === 'RIGHT' ? range.lo + leftM : range.hi - leftM)
          const listed = read.openings.filter((o) => o.storey === 'GROUND').map((o) => { const [p, q] = [alongOf(o.leftM), alongOf(o.leftM + o.widthM)]; return { o, a0: Math.min(p, q), a1: Math.max(p, q) } })
          const used = new Set<number>()
          for (const g of uncovered.filter((q) => q.side === side)) {
            const best = listed.map((l, i) => ({ l, i, v: share(l.a0, l.a1, g.a0, g.a1) })).filter((q) => !used.has(q.i)).sort((a, b) => b.v - a.v)[0]
            if (!best || best.v < PLAN_SPAN_AGREE) continue
            used.add(best.i)
            proposals.push({ proposalId: `plan-gap:${g.id}`, baseRevision: modelRevision(mG), operation: 'ADD_PLAN_OPENING', targetId: side, origin: 'PLAN', uncertainty: 'MEDIUM', planOpening: { side, a0: g.a0, a1: g.a1, kind: best.l.o.kind, sillM: best.l.o.sillM, heightM: best.l.o.heightM, gapId: g.id, frameId: x.frameId, share: Math.round(best.v * 1000) / 1000 }, justification: `the plan draws a gap at ${g.a0.toFixed(2)}..${g.a1.toFixed(2)} m of the ${side.toLowerCase()} wall; the elevation's metric list puts a ${best.l.o.kind.toLowerCase()} there` })
          }
          reads.push({ frameId: x.frameId, side, widthM: Math.round(widthM * 100) / 100, listed: read.openings.length, ground: listed.length, refused: read.refused, usd: read.usd })
        }
        record({ at: now().toISOString(), kind: 'PLAN_GAP_OPENINGS', version: FACADE_METRIC_VERSION, gaps: gaps.length, uncovered: uncovered.map((g) => ({ id: g.id, side: g.side, a0: g.a0, a1: g.a1 })), reads, proposals: proposals.map((q) => q.proposalId) })
        await phase('PLAN_GAP_OPENINGS', proposals)
      }
    }
    // v3.54.18: the fate of every element the readings state, on the model that now stands (agreements recomputed on it)
    {
      const mF = stood.run?.reconstruction.model ?? m2
      const heldF = massingViews(stood) ?? (stood.run ? viewsOfRun(stood.run.reconstruction.facadeAlignment.views) : held)
      const viewsF = [...heldF, ...sketchViewsOf(mF, await allPicturesOf(stood), heldF)]
      const accF = sketched.map((x) => proposalsFromSketch(x.sketch as NonNullable<typeof x.sketch>, x.facade, mF, viewsF, modelRevision(mF), sketchSideOf?.[x.frameId]))
      sem.fates = observationFates({
        sketches: sketchSummary.reading.sketches,
        records: sem.records,
        accounts: accF.map((a) => ({ frameId: a.frameId, ...(a.side ? { side: a.side } : {}), agreedIds: a.agreed.map((g) => ({ sketchId: g.sketchId, modelId: g.modelId })), skipped: [...a.skipped, ...(sem.accounts.find((q) => q.frameId === a.frameId)?.skipped ?? [])] })),
        sideBasis: (frameId) => (sideBasisOf.get(frameId) ?? (sidesByConvention.has(frameId) ? 'MINIATURE_CONVENTION_SOURCE_ORDER' : undefined)) ?? (sketched.find((x) => x.frameId === frameId)?.facade === 'SIDE_UNSPECIFIED' ? 'EVIDENCE' : turnedSides ? 'ORIENTATION_TURNED_90' : 'LABEL'),
        ...(sem.finishes ? { finishSkipped: sem.finishes.skipped } : {}),
      })
    }
    if (asked === 0) sem.why = 'every sketch element agrees with the model, or none has a registry operation'
    else if (kept.length > 0 && stood !== good) {
      base = good
      good = stood
      goodState = stateOf(stood)
      committed = kept
      sem.decision = 'APPLIED'
      sem.why = `${kept.length} of ${asked} sketch proposal(s) kept, each against the original elevation; revision ${rev} → ${modelRevision(m2)}${stood.run && modelRevision(stood.run.reconstruction.model) !== modelRevision(m2) ? ` → ${modelRevision(stood.run.reconstruction.model)}` : ''}`
    } else {
      sem.decision = 'NONE_KEPT'
      if (!sem.why) sem.why = `none of ${asked} sketch proposal(s) passed the source gate and the measure`
    }
  }

  // --- geometry: the model that stands against the source's plans and elevations; each look may change it ------------
  const geometry: GeometryRound[] = []
  const features: RoofFeatureCorrection[] = []
  const maxGeometry = wiring.maxGeometryRounds ?? 2
  const viewsOf = wiring.views ?? ((run: AnalysisRun): ModelViewPicture[] => renderModelViews(run.result.scene))
  // v3.54.16: each storey from above with nothing over it, so rooms and partitions can be held against the plans
  const storeysOf = (run: AnalysisRun): Array<{ png: Uint8Array; width: number; height: number; labels: string; name: string; sha256: string }> => {
    if (wiring.views) return []
    try {
      return [...run.reconstruction.model.levels].sort((a, b) => a.index - b.index).map((l) => {
        const c = renderStoreyCut(run.result.scene, l.id, l.elevation)
        return { png: c.png, width: c.width, height: c.height, sha256: c.sha256, name: `STOREY ${l.index}`, labels: `storey ${l.index} (${l.name ?? l.id}) of the model from above with nothing over it: walls cut at 1.2 m, rooms filled, front at the bottom as the plans are printed` }
      })
    } catch {
      return []
    }
  }
  let lastApplied: Array<{ id: string; what: string; kind: 'ROOF_FEATURE' | 'PATCH'; proposalId?: string; /** v3.54.21: where the patch came from (PLAN: the ground plan draws it) */ origin?: string; /** v3.54.21: the operation, and whether its built element was drawn back into the source and supported there */ operation?: string; sourceVerified?: boolean }> = []
  let lastRefused: Array<{ targetId: string; why: string }> = []
  let previous: { good: Local; state: RunState; features: RoofFeatureCorrection[] } | undefined
  const seenG = new Set<string>()
  let lastReview: ModelCheckResult | undefined
  let lastCheckedRevision: string | null = null
  const defectLedger: DefectEntry[] = []
  // v3.54.16 audit A1: explicit statements of later looks about earlier defects, and the revision each look judged
  const resolutions: DefectResolution[] = []
  const lookRevision = new Map<number, string>()
  const OPEN_NOW = new Set(['DISPUTED', 'APPLIED_REVIEW_DISAGREES', 'REJECTED_BY_SOURCE', 'NEEDS_EVIDENCE', 'UNSUPPORTED_OPERATION', 'NO_PROPOSAL', 'REFUSED', 'ROUND_LIMIT', 'APPLIED_NOT_REVIEWED'])
  let prevLook: { look: number; defects: NonNullable<ConsultantReview['defects']>; proposals: Array<{ proposalId: string; defectId?: string }>; records: PatchRecord[]; listed?: ListedElements } | undefined
  let lastLookNumber = 0
  let pendingAtLimit = 0
  let attemptedForKey = 0
  let committedForKey = 0
  // v3.54.16: the sketch channel's patches are what the first look reviews as applied — each is settled by that look
  const sketchKept = (sketchSummary?.semantic?.decision === 'APPLIED' ? sketchSummary.semantic.records : []).filter((r) => r.status === 'COMMITTED' && committed.some((p) => p.proposalId === r.proposalId))
  if (sketchKept.length > 0) {
    lastApplied = sketchKept.map((r) => ({ id: r.bound?.ids[0] ?? r.targetId, what: r.origin === 'PLAN' ? `${r.operation} on the ${(r.bound?.side ?? r.targetId).toLowerCase()} side (${r.bound?.ids[0] ?? r.targetId}), from a gap the ground-floor plan draws in that wall (its kind, sill and height from that side's elevation reading)` : `${r.operation} on the ${(r.bound?.side ?? r.targetId).toLowerCase()} side (${r.bound?.ids[0] ?? r.targetId}), from the sketch of that elevation`, kind: 'PATCH' as const, proposalId: r.proposalId, ...(r.origin ? { origin: r.origin } : {}), operation: r.operation, sourceVerified: (r.measure as { sourceVerified?: boolean | null } | undefined)?.sourceVerified === true }))
    prevLook = { look: 0, defects: sketchKept.map((r) => ({ id: `S:${r.proposalId.slice(-24)}`, about: `${r.operation} ${r.targetId} from the sketch of ${r.bound?.side ?? '?'}`, scope: (r.bound?.side ?? 'WHOLE') as 'FRONT', severity: 'MAJOR' as const, certainty: 'LIKELY' as const, operation: r.operation as 'ADD_OPENING' })), proposals: sketchKept.map((r) => ({ proposalId: r.proposalId, defectId: `S:${r.proposalId.slice(-24)}` })), records: sketchKept }
  }
  if ((wiring.check ?? 'ON') === 'ON' && good.run && good.pkg && good.graph) {
    const pkg = good.pkg
    const graph = good.graph
    const sources = await sourcesOf(good)
    for (let g = 1; g <= maxGeometry + 1 && sources.length > 0; g += 1) {
      const run = good.run as AnalysisRun
      const revision = modelRevision(run.reconstruction.model)
      stage(`REVIEW-${g}`, { revision })
      const rec: GeometryRound = { round: g, revision, status: null, pictures: [], observations: [], reviewed: [], verdicts: [], corrections: [], outcomes: [], decision: 'NOT_RUN', why: '', usd: 0 }
      geometry.push(rec)
      let res: ModelCheckResult
      try {
        const views = [...viewsOf(run), ...storeysOf(run)]
        // v3.54.17 R2: the editable elements of exactly this revision, by id, placed in the SIDES picture
        lookIndex = elementIndexOf(run.reconstruction.model, views.find((v) => v.name === 'SIDES') as ModelViewPicture | undefined)
        for (const e of lookIndex.elements) listedAt.set(e.id, revision)
        // A1: every earlier defect still open is listed by its id — the look restates it, resolves it, or leaves it open
        const settledOpen = reconcileLedger(defectLedger, resolutions, lookRevision, lastLookNumber).filter((d) => OPEN_NOW.has(d.settlement))
        const pendingOpen = prevLook ? prevLook.defects.filter((d) => !(prevLook?.proposals.some((x) => x.defectId === d.id && prevLook?.records.some((r) => r.status === 'COMMITTED' && (r.proposalId === x.proposalId || r.proposalId.endsWith(`:${x.proposalId}`)))) ?? false)).map((d) => ({ id: `L${prevLook?.look}:${d.id}`, about: d.about, scope: d.scope, severity: d.severity })) : []
        const openDefects = [...settledOpen.map((d) => ({ id: d.key, about: d.about, scope: d.scope, severity: d.severity })), ...pendingOpen].filter((d, i, a) => a.findIndex((x) => x.id === d.id) === i && !d.id.startsWith('L0:'))
        res = await checkModel({ baseRevision: revision, sources, views, ...(lastApplied.length > 0 ? { applied: lastApplied.map((a) => ({ id: a.id, what: a.what })) } : {}), ...(lastRefused.length > 0 ? { refused: lastRefused } : {}), ...(openDefects.length > 0 ? { openDefects } : {}), elements: lookIndex, ...(structureMemo?.features ? { featureMap: featureMapText(structureMemo.features) } : {}), model: wiring.model, price: wiring.price, ...(wiring.spend ? { spend: wiring.spend } : {}), limits, record: (e) => record({ ...e, round: `check-${g}` }), ...(options.signal ? { signal: options.signal } : {}), now })
      } catch (e) {
        rec.decision = 'CHECK_FAILED'
        rec.why = `${(e as Error).name}: ${(e as Error).message.slice(0, 300)} — the model before the look stands`
        record({ at: now().toISOString(), kind: 'MODEL_CHECK_FAILED', round: g, why: rec.why })
        break
      }
      usd += res.usd
      rec.usd = res.usd
      rec.pictures = res.pictures
      if (!res.review) {
        rec.decision = 'CHECK_FAILED'
        rec.refused = res.refused ?? 'no review'
        rec.why = `no usable review (${rec.refused}) — the model before the look stands`
        record({ at: now().toISOString(), kind: 'MODEL_CHECK_FAILED', round: g, why: rec.why })
        break
      }
      lastReview = res
      lastCheckedRevision = revision
      lastLookNumber = g
      lookRevision.set(g, revision)
      for (const r of res.review.resolved ?? []) resolutions.push({ look: g, revision, defectId: r.defectId, verdict: r.verdict, note: r.note, ...(r.supersededBy ? { supersededBy: r.supersededBy } : {}) })
      rec.status = res.review.status
      rec.observations = res.review.observations
      rec.defects = res.review.defects ?? []
      // the defects of the look before, settled by what THIS look says of the elements their patches built
      const reviewedNow = new Map((res.review.appliedReview ?? []).map((a) => [a.id, a.verdict as string]))
      if (prevLook) defectLedger.push(...settleDefects(prevLook.look, prevLook.defects, prevLook.proposals, prevLook.records, reviewedNow, revision, false, prevLook.listed))
      prevLook = undefined
      // what the look says of the features and patches the round before applied: one the source does not show is undone
      if (lastApplied.length > 0) {
        // v3.54.21: what a look's word alone does not take out — an element the ground plan draws, and an opening whose built
        // box the source gate measured in the elevation. Both against either verdict: WRONG_KIND disputes the kind or the
        // finish, not the hole (NEW-H Debora: a measured garage door taken out for its colour, "dark, the source timber");
        // the dispute stays open, and a change of kind or a removal goes through the source gate (UPDATE / REMOVE_OPENING)
        const held = new Map<string, { verdicts: ReadonlyArray<string>; why: string }>()
        for (const a of lastApplied) {
          if (a.kind !== 'PATCH') continue
          if (a.origin === 'PLAN') held.set(a.id, { verdicts: ['SHOULD_NOT_EXIST', 'WRONG_KIND'], why: 'the ground plan draws it' })
          else if (a.sourceVerified && a.operation === 'ADD_OPENING') held.set(a.id, { verdicts: ['SHOULD_NOT_EXIST', 'WRONG_KIND'], why: 'the source gate measured this opening in the elevation (its built box drawn back and supported)' })
          // a roof window: against SHOULD_NOT_EXIST only — no operation reaches a committed roof window afterwards (no update
          // or remove of roof openings), and its gate measures a framed element on the slope, not its kind (review F5)
          else if (a.sourceVerified && a.operation === 'ADD_ROOF_WINDOW') held.set(a.id, { verdicts: ['SHOULD_NOT_EXIST'], why: 'the source gate measured a framed element on the slope' })
        }
        rec.reviewed = reviewOutcome(lastApplied.map((a) => a.id), res.review.appliedReview, held)
        record({ at: now().toISOString(), kind: 'APPLIED_REVIEW', round: g, reviewed: rec.reviewed })
        const drop = rec.reviewed.filter((r) => !r.keep).map((r) => r.id)
        const dropFeatures = drop.filter((id) => lastApplied.some((a) => a.id === id && a.kind === 'ROOF_FEATURE'))
        const dropPatches = lastApplied.filter((a) => a.kind === 'PATCH' && drop.includes(a.id)).map((a) => a.proposalId)
        if (dropFeatures.length > 0 && previous) {
          const kept = features.filter((f) => !dropFeatures.includes(f.id))
          let back: Local | undefined
          if (kept.length === previous.features.length) back = previous.good
          else {
            const unpatched = base ?? good
            const lin = lineage.get(unpatched)
            const again = await attempt({ kind: 'PACKAGE', pkg, graph }, { ...(lin?.options ?? options), patchedModel: undefined, roofFeatures: kept })
            back = again.run ? await rebase(again, `UNDO-ROOF-${g}`) : previous.good
          }
          good = back
          goodState = stateOf(good)
          features.splice(0, features.length, ...(back === previous.good ? previous.features : kept))
          rec.decision = 'ROLLBACK'
          rec.why = `the look at revision ${revision} says ${dropFeatures.join(', ')} is not what the drawings show (${rec.reviewed.filter((r) => !r.keep).map((r) => `${r.verdict}: ${r.note}`).join('; ').slice(0, 300)}): taken out again`
          rec.afterRevision = good.run ? modelRevision(good.run.reconstruction.model) : undefined
          record({ at: now().toISOString(), kind: 'GEOMETRY_ROUND', round: g, decision: rec.decision, why: rec.why, afterRevision: rec.afterRevision })
          lastCheckedRevision = null
          break
        }
        if (dropPatches.length > 0) {
          committed = committed.filter((p) => !dropPatches.includes(p.proposalId))
          good = await rebase(base ?? good, `UNDO-${g}`)
          goodState = stateOf(good)
          rec.decision = 'ROLLBACK'
          rec.why = `the look at revision ${revision} says ${drop.join(', ')} is not what the drawings show: the patch(es) ${dropPatches.join(', ')} undone, the others re-applied`
          rec.afterRevision = good.run ? modelRevision(good.run.reconstruction.model) : undefined
          record({ at: now().toISOString(), kind: 'GEOMETRY_ROUND', round: g, decision: rec.decision, why: rec.why, afterRevision: rec.afterRevision })
          lastApplied = []
          lastCheckedRevision = null
          continue
        }
      }
      // new proposals: dormers to the roof-feature consumer; registry operations to the correction executor; ids scoped
      const pictures: CheckPicture[] = res.pictures
      const registeredSides = new Map(run.reconstruction.registrations.elevations.map((e) => [e.frameId, e.side as string]))
      const present = new Set((run.reconstruction.building.dormers ?? []).map((d) => d.id))
      const corrections: RoofFeatureCorrection[] = []
      const patchProposals: CorrectionProposal[] = []
      for (const p of res.review.proposedCorrections) {
        const id = `g${g}:${p.proposalId}`
        if (p.operation !== 'ROOF_FEATURE') {
          patchProposals.push({ proposalId: id, baseRevision: p.baseRevision, operation: p.operation, targetId: p.targetId, ...(p.defectId ? { defectId: p.defectId } : {}), ...(p.group ? { group: `g${g}:${p.group}` } : {}), ...(p.patch ? { patch: p.patch } : {}), uncertainty: p.uncertainty, justification: p.justification, origin: 'REVIEW' })
          continue
        }
        const bound = bindRoofFeature({ ...p, proposalId: id }, { revision, pictures, registeredSides, present, seen: seenG })
        if (bound.correction && corrections.some((c) => c.id === bound.correction?.id)) bound.verdict = { ...bound.verdict, status: 'REJECTED', code: 'ALREADY_PRESENT', why: `a second proposal for ${bound.correction.id} in one look` }
        else if (bound.correction) corrections.push(bound.correction)
        rec.verdicts.push(bound.verdict)
      }
      const keyDefects = new Set((res.review.defects ?? []).filter((d) => d.severity === 'KEY').map((d) => d.id))
      record({ at: now().toISOString(), kind: 'GEOMETRY_VALIDATION', round: g, revision, status: res.review.status, verdicts: rec.verdicts, patches: patchProposals.map((p) => p.proposalId), defects: res.review.defects ?? [], observations: rec.observations })
      if (g > maxGeometry) {
        rec.decision = 'REVIEW_ONLY'
        pendingAtLimit = corrections.length + patchProposals.length
        rec.why = `the last look: it reviews what was applied; ${pendingAtLimit} further proposal(s) are recorded and not applied (round limit ${maxGeometry})`
        for (const vv of rec.verdicts) if (vv.status === 'ACCEPTED') Object.assign(vv, { status: 'HELD', why: `${vv.why} — not applied: the round limit is reached` })
        defectLedger.push(...settleDefects(g, res.review.defects ?? [], [], [], undefined, undefined, true, listedOf(lookIndex)))
        record({ at: now().toISOString(), kind: 'GEOMETRY_ROUND', round: g, decision: rec.decision, why: rec.why })
        break
      }
      if (wiring.variant === 'R') {
        rec.decision = 'NOT_RUN'
        rec.why = 'variant R: the proposals are recorded and never consumed'
        defectLedger.push(...settleDefects(g, res.review.defects ?? [], [], [], undefined, undefined, false, listedOf(lookIndex)))
        record({ at: now().toISOString(), kind: 'GEOMETRY_ROUND', round: g, decision: rec.decision, why: rec.why })
        break
      }
      // registry operations, on the model that stands
      let appliedPatches: typeof lastApplied = []
      let patchOut: CorrectionOutcome | undefined
      if (patchProposals.length > 0) {
        patchOut = await executeOn(good, patchProposals, `LOOK-${g}`)
        rec.patches = patchOut?.records ?? []
        rec.transactions = patchOut?.transactions ?? []
        const kept = rec.patches.filter((r) => r.status === 'COMMITTED')
        attemptedForKey += patchProposals.filter((p) => p.defectId && keyDefects.has(p.defectId)).length
        if (patchOut && kept.length > 0) {
          const from = base ?? good
          const m = await materialize(from, patchOut.model)
          if (m) {
            base = from
            good = m
            goodState = stateOf(m)
            committed.push(...patchProposals.filter((p) => kept.some((r) => r.proposalId === p.proposalId)))
            committedForKey += patchProposals.filter((p) => p.defectId && keyDefects.has(p.defectId) && kept.some((r) => r.proposalId === p.proposalId)).length
            appliedPatches = kept.map((r) => ({ id: r.bound?.ids[0] ?? r.targetId, what: `${r.operation} on the ${(r.bound?.side ?? r.targetId).toLowerCase()} side (${r.bound?.ids[0] ?? r.targetId})`, kind: 'PATCH' as const, proposalId: r.proposalId, ...(r.origin ? { origin: r.origin } : {}), operation: r.operation, sourceVerified: (r.measure as { sourceVerified?: boolean | null } | undefined)?.sourceVerified === true }))
          } else for (const r of kept) Object.assign(r, { status: 'ROLLED_BACK', code: 'NOT_DELIVERED', why: `${r.why}; the patched model could not be delivered through the run (its base did not rebuild byte for byte)` })
        }
      }
      prevLook = { look: g, defects: res.review.defects ?? [], proposals: patchProposals.map((p) => ({ proposalId: p.proposalId, ...(p.defectId ? { defectId: p.defectId } : {}) })), records: rec.patches ?? [], listed: listedOf(lookIndex) }
      lastRefused = (rec.patches ?? []).filter((r) => r.status !== 'COMMITTED').map((r) => ({ targetId: r.targetId, why: `${r.operation} ${r.status}${r.code ? ` ${r.code}` : ''}: ${r.why}`.slice(0, 300) }))
      if (corrections.length === 0) {
        if (appliedPatches.length > 0) {
          rec.decision = 'ACCEPT'
          rec.why = `${appliedPatches.length} patch(es) applied through the correction executor (${appliedPatches.map((a) => a.id).join(', ')}); the next look reviews revision ${good.run ? modelRevision(good.run.reconstruction.model) : '?'}`
          rec.afterRevision = good.run ? modelRevision(good.run.reconstruction.model) : undefined
          lastApplied = appliedPatches
          lastCheckedRevision = null
          record({ at: now().toISOString(), kind: 'GEOMETRY_ROUND', round: g, decision: rec.decision, why: rec.why })
          continue
        }
        rec.decision = lastApplied.length > 0 ? 'REVIEW_ONLY' : 'NO_CHANGE'
        rec.why = lastApplied.length > 0 ? 'the look reviews what was applied and proposes nothing the analyzer can apply' : patchProposals.length > 0 ? `no proposal was kept (${(rec.patches ?? []).map((r) => `${r.proposalId} ${r.status}`).join(', ').slice(0, 300)}): the model stands, the findings stay on the record` : 'no proposal the analyzer can apply: the model stands, the findings stay on the record'
        record({ at: now().toISOString(), kind: 'GEOMETRY_ROUND', round: g, decision: rec.decision, why: rec.why })
        break
      }
      rec.corrections = corrections
      // v3.54.17 R2: a roof feature is built by the drawings' solver's rebuild, which a body built without LOCAL does not
      // have: refused by name (the registry patches of the same look still stand)
      if (massingOf.has(base ?? good)) {
        rec.decision = 'ROLLBACK'
        rec.why = `ROOF_FEATURE_NEEDS_LOCAL_REBUILD: ${corrections.length} roof feature(s) proposed; a model built without LOCAL takes registry patches only${appliedPatches.length > 0 ? `; ${appliedPatches.length} patch(es) applied through the correction executor` : ''}`
        lastRefused = [...lastRefused, ...corrections.map((c) => ({ targetId: c.id, why: 'ROOF_FEATURE_NEEDS_LOCAL_REBUILD: the roof feature is built by the drawings solver\'s rebuild, which this model (built without LOCAL) does not have' }))]
        lastApplied = appliedPatches
        rec.afterRevision = good.run ? modelRevision(good.run.reconstruction.model) : undefined
        record({ at: now().toISOString(), kind: 'GEOMETRY_ROUND', round: g, decision: rec.decision, why: rec.why })
        if (lastApplied.length > 0) {
          lastCheckedRevision = null
          continue
        }
        break
      }
      // dormers: the analyzer rebuilds the UNPATCHED run that stands with them (all its own inputs kept); the committed
      // patches are then bound again on the rebuilt model and delivered with it
      const unpatched = base ?? good
      const lin = lineage.get(unpatched)
      const beforeG = geometryStateOf(unpatched.run as AnalysisRun, features.map((f) => f.id))
      const candidate = await attempt({ kind: 'PACKAGE', pkg, graph }, { ...(lin?.options ?? options), patchedModel: undefined, roofFeatures: [...features, ...corrections] })
      const outcomes = candidate.run?.reconstruction.roofFeatures ?? []
      rec.outcomes = outcomes.filter((o) => corrections.some((c) => c.id === o.id))
      const afterG = candidate.run ? geometryStateOf(candidate.run, [...features, ...corrections].map((f) => f.id)) : undefined
      const decision = compareGeometry(beforeG, afterG, corrections, rec.outcomes, candidate.error ? `${candidate.error.failure().code}/${candidate.error.failure().reasonCode ?? ''}` : undefined)
      rec.decision = decision.decision
      rec.why = decision.why + (appliedPatches.length > 0 ? `; and ${appliedPatches.length} patch(es) applied through the correction executor` : '')
      lastRefused = [...lastRefused, ...decision.refused.map((r) => ({ targetId: r.id, why: `${r.code ?? ''} ${r.why}`.trim() })), ...rec.verdicts.filter((x) => x.status === 'REJECTED' || x.status === 'HELD').map((x) => ({ targetId: x.targetId, why: `${x.code ?? x.status}: ${x.why}` }))]
      if (decision.decision === 'ACCEPT') {
        previous = { good, state: goodState, features: [...features] }
        good = await rebase(candidate, `REBASE-${g}`)
        goodState = stateOf(good)
        const builtNow = corrections.filter((c) => decision.applied.includes(c.id))
        features.push(...builtNow)
        lastApplied = [...builtNow.map((c) => ({ id: c.id, what: `a ${c.kind.toLowerCase().replace(/_/g, ' ')} on the ${c.side.toLowerCase()} side, ${Math.round(c.fromShare * 100)}–${Math.round(c.toShare * 100)} % along it`, kind: 'ROOF_FEATURE' as const })), ...appliedPatches]
      } else lastApplied = appliedPatches
      rec.afterRevision = good.run ? modelRevision(good.run.reconstruction.model) : undefined
      record({ at: now().toISOString(), kind: 'GEOMETRY_ROUND', round: g, decision: rec.decision, why: rec.why, revision, afterRevision: rec.afterRevision, corrections, outcomes: rec.outcomes, before: beforeG, after: afterG ?? null })
      if (lastApplied.length > 0) {
        lastCheckedRevision = null
        continue
      }
      // a dormer the analyzer refused with a reason is new evidence: one more look, told why, while rounds remain
      if (decision.decision === 'NO_CHANGE' && decision.refused.length > 0 && g < maxGeometry) continue
      break
    }
  }
  // the last proposing look's defects, when no later look judged what it applied
  if (prevLook) defectLedger.push(...settleDefects(prevLook.look, prevLook.defects, prevLook.proposals, prevLook.records, undefined, undefined, false, prevLook.listed))
  stage('DELIVERY')
  const finalState = stateOf(good)
  const sourceCheck = (wiring.check ?? 'ON') === 'ON' && good.run ? sourceCheckOf(good, finalState, geometry, features, lastReview, lastCheckedRevision, rounds) : undefined
  if (sourceCheck) {
    const contradictions = sourceCheck.knownDefects.filter((k) => /^OUTLINE_(SHORT|BEYOND)|^SCALE_CONTRADICTED/.test(k.code)).length
    // A1: quality reads the defects as they stand after EVERY look, not the last look's list
    sourceCheck.quality = qualityOf({ looked: sourceCheck.looks > 0, checkedRevision: sourceCheck.checkedRevision, deliveredRevision: sourceCheck.deliveredRevision, lastStatus: sourceCheck.reviewStatus, defects: defectLedger.filter((d) => d.look === lastLookNumber), allDefects: defectLedger, resolutions, lookRevision, lastLook: lastLookNumber, measuredContradictions: contradictions, pendingAtLimit, attemptedForKey, committedForKey })
    const last = sourceCheck.quality.defects
    sourceCheck.correctionRuns = correctionRuns
    // v3.54.16 (after the freeze, named): the axes read the last look's defect ledger too — a difference reported with
    // no executable proposal (an UNSUPPORTED roof form, an opening on a view without heights) is still open on its axis
    const openOn = (f: (d: DefectEntry) => boolean): boolean => last.some((d) => OPEN_NOW.has(d.settlement) && f(d))
    if (openOn((d) => d.scope === 'ROOF' || d.family === 'ROOF_FORM' || d.operation === 'ROOF_FEATURE')) sourceCheck.axes.roof = 'DIFFERENCE_OPEN'
    if (openOn((d) => /OPENING/.test(d.operation))) sourceCheck.axes.openings = 'DIFFERENCE_OPEN'
    for (const d of last.filter((x) => x.settlement !== 'CLOSED_VERIFIED')) if (!sourceCheck.knownDefects.some((k) => k.what.startsWith(d.id))) sourceCheck.knownDefects.push({ code: `DEFECT_${d.settlement}`, what: `${d.id} (${d.severity}, ${d.scope}): ${d.about}`.slice(0, 400) })
  }
  // the result an app consumes says what was checked, what was corrected and what is known wrong — not only the trace
  if (good.run && sourceCheck) {
    ;(good.run.result as { sourceCheck?: SourceCheckSummary }).sourceCheck = sourceCheck
    // an outline that stops inside, or runs past, the printed dimension that frames it limits what may be measured off
    // the model: the measurement says so in its own terms, where every consumer already reads the result's limits
    const m = good.run.result.measurement
    if (m && (sourceCheck.axes.outline === 'SHORT' || sourceCheck.axes.outline === 'BEYOND' || sourceCheck.axes.outline === 'MATCHES_WITHIN_A_WALL')) {
      for (const d of sourceCheck.knownDefects.filter((k) => k.code.startsWith('OUTLINE_'))) if (!m.reasons.some((r) => r.code === d.code)) m.reasons.push({ code: d.code, consequence: `${d.what}; areas and lengths taken off the model are not the whole house's` })
      if (m.quantities === 'USABLE_IN_SCOPE') m.quantities = 'LIMITED'
    }
    // a model the drawing's own dimensions contradict is a preview: nothing may be measured off it
    const sc = sourceCheck.knownDefects.find((k) => k.code === 'SCALE_CONTRADICTED_BY_PRINTED_DIMENSIONS')
    if (m && sc) {
      if (!m.reasons.some((r) => r.code === sc.code)) m.reasons.push({ code: sc.code, consequence: sc.what })
      m.quantities = 'NOT_USABLE'
    }
  }
  // v3.54.14: what became of the accepted-revision rule; a fresh, complete, failure-free consultation is kept
  let accepted: ConsultReuse | undefined
  if (acceptedState && wiring.accepted) {
    const deliveredHash = good.run?.result.modelSha256 ?? ''
    if (acceptedState.reused) accepted = { state: 'REUSED', key: acceptedState.key, acceptedAt: acceptedState.reused.acceptedAt, sameGeometry: deliveredHash !== '' && deliveredHash === acceptedState.reused.modelHash, answersReplayed: replayCounter.replayed, missing: replayCounter.missing }
    else if (!good.run || finalState.outcome !== 'COMPLETED') accepted = { state: 'NOT_ACCEPTED', key: acceptedState.key, why: 'the analysis did not complete: nothing kept' }
    else if (transportFailures.count > 0) accepted = { state: 'NOT_ACCEPTED', key: acceptedState.key, why: `${transportFailures.count} request(s) failed in transport: a replay would not be this analysis` }
    else if (answers.length === 0) accepted = { state: 'NOT_ACCEPTED', key: acceptedState.key, why: 'no request was answered: nothing to keep' }
    else {
      const kept = wiring.accepted.store.put({ schema: ACCEPTED_CONSULT_SCHEMA, version: ACCEPTED_CONSULT_VERSION, key: acceptedState.key, binding: acceptedState.binding, acceptedAt: now().toISOString(), modelHash: deliveredHash, answers })
      accepted = kept ? { state: 'ACCEPTED_NOW', key: acceptedState.key, answers: answers.length } : { state: 'NEW_CANDIDATE', key: acceptedState.key, why: acceptedState.why ?? 'NO_ACCEPTED_REVISION' }
    }
    record({ at: now().toISOString(), kind: 'ACCEPTED_REVISION', ...accepted })
  }
  const consultation: ConsultationSummary = { schemaVersion: '1.0.0', contract: CONSULTANT_CONTRACT_VERSION, prompt: CONSULTANT_PROMPT_VERSION, variant: wiring.variant, model: wiring.model.model, usd: Math.round(usd * 1e6) / 1e6, globalDescription: 'DISABLED', local: { outcome: localState.outcome, reasonCode: localState.reasonCode ?? null, modelHash: localState.modelHash ?? null }, metricRounds: rounds.map((r) => ({ round: r.round, decision: r.decision, why: r.why })), boundary: boundary ? { decision: boundary.decision, why: boundary.why, sides: boundary.sides } : null, looks: geometry.map((g) => ({ round: g.round, revision: g.revision, status: g.status, decision: g.decision, why: g.why })), roofFeatures: features.map((f) => f.id), ...(metricRead ? { metricRead: { decision: metricRead.decision, why: metricRead.why, corrected: metricRead.resolution.decisions.filter((d) => d.decision === 'CORRECTED').length, agrees: metricRead.resolution.decisions.filter((d) => d.decision === 'AGREES').length, unresolved: metricRead.resolution.decisions.filter((d) => d.decision === 'UNRESOLVED').length, newSpans: metricRead.resolution.spans.length, usd: metricRead.usd } } : {}), ...(sketchSummary ? { sketches: { sides: sketchSummary.reading.sketches.map((x) => `${x.facade}:${x.check?.verdict ?? (x.failed ? 'FAILED' : 'NONE')}`), form: sketchSummary.form.decision, finish: sketchSummary.finish.decision, usd: sketchSummary.usd, ...(sketchSummary.semantic ? { facades: sketchSummary.reading.sketches.map((x) => { const sm = sketchSummary?.semantic; const acc = sm?.accounts.find((q) => q.frameId === x.frameId); return { frameId: x.frameId, label: x.facade, side: acc?.side ?? null, sideBasis: !acc?.side ? 'NOT_REGISTERED' : sm?.sidesByConvention?.some((q) => q.frameId === x.frameId) ? 'MINIATURE_CONVENTION_SOURCE_ORDER' : x.facade === 'SIDE_UNSPECIFIED' ? 'EVIDENCE' : sm?.orientation?.assignment === 'TURNED_90' ? 'ORIENTATION_TURNED_90' : 'LABEL', adoption: sm?.adoption?.find((q) => q.frameId === x.frameId)?.decision ?? null } }) } : {}), ...(sketchSummary.semantic?.fates ? { fates: (() => { const rows = sketchSummary?.semantic?.fates?.rows ?? []; const n = (f: (r: (typeof rows)[number]) => boolean): number => rows.filter(f).length; return { version: sketchSummary?.semantic?.fates?.version ?? '', built: n((r) => r.fate === 'BUILT'), verified: n((r) => r.fate === 'BUILT' && r.verification === 'SOURCE_VERIFIED'), crossWitness: n((r) => r.fate === 'BUILT' && r.verification === 'CROSS_WITNESS_PLAN'), adopted: n((r) => r.fate === 'BUILT' && r.verification === 'ADOPTED_WITH_FACADE'), agrees: n((r) => r.fate === 'AGREES_WITH_MODEL'), refusedBySource: n((r) => r.fate === 'REFUSED_BY_SOURCE'), undecided: n((r) => r.fate === 'UNDECIDED'), noConsumer: n((r) => r.fate === 'NO_CONSUMER'), notRegistered: n((r) => r.fate === 'NOT_REGISTERED'), other: n((r) => r.fate === 'NOT_BUILT' || r.fate === 'NOT_PROPOSED') } })() } : {}) } } : {}), ...(accepted ? { accepted } : {}), ...(sourceCheck?.quality ? { quality: { state: sourceCheck.quality.state, reasons: sourceCheck.quality.reasons, reviewCompleted: sourceCheck.quality.reviewCompleted, openKey: sourceCheck.quality.openKey, closedVerified: sourceCheck.quality.closedVerified } } : {}), ...(bodyArbitration ? { bodyArbitration: { decision: bodyArbitration.decision, why: bodyArbitration.why.slice(0, 400), localContradictions: bodyArbitration.local.contradictions, alternativeContradictions: bodyArbitration.alternative?.contradictions ?? null } } : {}), corrections: { runs: correctionRuns.length, committed: correctionRuns.reduce((a, r) => a + r.records.filter((x) => x.status === 'COMMITTED').length, 0), refused: correctionRuns.reduce((a, r) => a + r.records.filter((x) => x.status !== 'COMMITTED').length, 0), registry: CORRECTION_REGISTRY_VERSION } }
  if (good.run) (good.run.result as { consultation?: ConsultationSummary }).consultation = consultation
  // v3.54.18: openings the delivered model holds and the compiler does not cut (no viewer shows them) — named, never silent
  const uncutOpenings = good.run ? compileBuilding(good.run.reconstruction.model).diagnostics.filter((d) => d.severity === 'ERROR' && (d.code === 'OPENING_ABOVE_WALL_TOP' || d.code === 'OPENING_OPEN_END_UNSUPPORTED') && d.objectId).map((d) => ({ id: d.objectId as string, code: d.code })) : []
  if (uncutOpenings.length > 0) record({ at: now().toISOString(), kind: 'DELIVERED_OPENINGS_NOT_CUT', openings: uncutOpenings, why: 'the delivered model holds these openings and the compiler does not cut them (above the top of their wall, or run through a skewed end): no view shows them — a known defect of the delivered revision' })
  // v3.54.19: the fates were written on the model the sketch stage left; later looks may rebuild it. Each element a fate
  // says was BUILT (or agrees with) is looked up in the DELIVERED model, so that the trace cannot name an element that is
  // not there without saying so (the audit of v3.54.18 R3 found three such ids on one house)
  if (good.run && sketchSummary?.semantic?.fates) {
    const mD = good.run.reconstruction.model
    const rows = sketchSummary.semantic.fates.rows.filter((q) => (q.fate === 'BUILT' || q.fate === 'AGREES_WITH_MODEL') && (q.targetIds ?? []).length > 0)
    // an element a later operation removed to make room for its own (an opening displaced by the plan's) is named with what took its place
    const gaveWay = new Map<string, string>()
    for (const r of sketchSummary.semantic.records ?? []) for (const id of Object.keys((r.bound as { displaced?: Record<string, unknown> } | undefined)?.displaced ?? {})) gaveWay.set(id, `${r.operation} ${(r.bound?.ids ?? []).join(', ')}`)
    const missing = rows.flatMap((q) => (q.targetIds ?? []).filter((id) => !elementExists(mD, id)).map((id) => ({ id, fate: q.fate, ...(q.proposalId ? { proposalId: q.proposalId } : {}), ...(gaveWay.has(id) ? { gaveWayTo: gaveWay.get(id) as string } : {}) })))
    record({ at: now().toISOString(), kind: 'OBSERVATION_FATE_TARGETS', checked: rows.reduce((t, q) => t + (q.targetIds ?? []).length, 0), missing, why: missing.length === 0 ? 'every element a fate names as built or agreeing is in the delivered model' : `${missing.length} element(s) a fate names are not in the delivered model: built at the sketch stage and removed or replaced by a later look (named here, never silent)` })
  }
  // v3.54.20: what was BUILT, read back from the delivered model and held against what the executor bound (readback.ts):
  // every exterior opening in its host wall's own frame with the sum of the wall's stretches checked, and the bodies and
  // roofs beside what the agreed structure asked for. A measurement of the delivered model, not the record of a command.
  if (good.run) {
    const mD = good.run.reconstruction.model
    const ob = readbackOpenings(mD, (sketchSummary?.semantic?.records ?? []) as Parameters<typeof readbackOpenings>[1])
    record({ at: now().toISOString(), kind: 'OPENINGS_READBACK', version: ob.version, frame: ob.frame, counts: ob.counts, openings: ob.openings, why: `${ob.counts.built} exterior opening(s) in the delivered model: ${ob.counts.agree} as the executor bound them, ${ob.counts.differ} different, ${ob.counts.unbound} without a bound record (the analyzer's own); ${ob.counts.sumFailures} wall(s) whose stretches do not add up, ${ob.counts.outsideWall} opening(s) past a wall's end` })
    // v3.54.21: every roof the builder bound (its kind, ridge, pitch, eaves, ridge height), every relation the roof system
    // solved and every number taken for the main roof are measured on the delivered model — not four facts of the largest rectangle
    const hypD = massingOf.get(good)?.hypothesis
    const solH = hypD ? roofSystemOf(hypD) : undefined
    // review F3: the body's roof system as DELIVERED. A committed correction (a SET_ROOF, a roof-system re-solve) is
    // delivered by rebuilding the model, not the hypothesis: where the model's own system differs from the hypothesis's,
    // the system is measured on the model; where it cannot be recovered from the planes, the hypothesis's stands, named
    const fromModel = solH ? roofRegionsOfModel(mD) : undefined
    const sameRegions = (a: NonNullable<typeof solH>['regions'], b: NonNullable<typeof solH>['regions']): boolean => a.length === b.length && a.every((r) => { const q = b.find((x) => x.id === r.id); return !!q && q.kind === r.kind && q.ridgeAxis === r.ridgeAxis && Math.abs(q.eaveY - r.eaveY) < 1e-3 && Math.abs(q.ridgeY - r.ridgeY) < 1e-3 && Math.abs(q.pitchDeg - r.pitchDeg) < 1e-3 && (['x0', 'x1', 'z0', 'z1'] as const).every((k) => Math.abs(q.rect[k] - r.rect[k]) < 1e-3) })
    const corrected = !!solH && !!fromModel && 'solution' in fromModel && !sameRegions(solH.regions, fromModel.solution.regions)
    const solD = corrected && fromModel && 'solution' in fromModel ? fromModel.solution : solH
    const measuredOn = !solH ? undefined : corrected ? 'DELIVERED_MODEL' : fromModel && 'why' in fromModel ? `HYPOTHESIS (the delivered system is not recovered from its planes: ${fromModel.why})` : 'HYPOTHESIS (the delivered system is the solved one)'
    const boundD = hypD && solD ? { bodies: hypD.bodies, ...(hypD.crossRoofs ? { crossRoofs: hypD.crossRoofs } : {}), relations: solD.relations.map((q) => ({ a: q.a, b: q.b, kind: q.kind })) } : undefined
    const sb = readbackStructure(mD, structureMemo?.build, STOREY_WALLS, boundD)
    if (hypD && solD) record({ at: now().toISOString(), kind: 'ROOF_SYSTEM', version: solD.version, ...(measuredOn ? { measuredOn } : {}), ...(corrected && solH ? { solvedBeforeCorrection: { regions: solH.regions, relations: solH.relations, adjustments: solH.adjustments } } : {}), regions: solD.regions, relations: solD.relations, adjustments: solD.adjustments, violations: solD.violations, creases: solD.creases.map((q) => ({ id: q.id, kind: q.kind, planeIds: q.planeIds, regionIds: q.regionIds, start: q.start, end: q.end, startM: q.startY, endM: q.endY })), fates: hypD.bodies.flatMap((b) => (b.fates ?? []).map((f) => ({ bodyId: b.id, ...f }))), crossRoofs: hypD.crossRoofs ?? [], ...(hypD.roofBuildError ? { buildError: hypD.roofBuildError } : {}), why: `${hypD.roofBuildError ? `BUILD_ERROR — ${hypD.roofBuildError}. As solved: ` : ''}the roofs of the body as one system: ${solD.regions.length} region(s), ${solD.relations.map((q) => `${q.a} → ${q.b} ${q.kind}`).join('; ') || 'no two roofs meet'}; ${solD.creases.filter((q) => q.kind === 'VALLEY').length} valley(s) computed from the planes; ${solD.adjustments.length} adjustment(s) within the stated tolerances; ${solD.violations.length} violation(s)` })
    if (structureMemo?.agreed && structureMemo.features) {
      const tr = traceFeatures(structureMemo.features, { agreed: structureMemo.agreed, ...(structureMemo.build ? { taken: structureMemo.build } : {}), ...(hypD ? { bodies: hypD.bodies, ...(hypD.crossRoofs ? { crossRoofs: hypD.crossRoofs } : {}) } : {}), ...(solD ? { relations: solD.relations } : {}), readback: sb, model: mD, bodyBy: hypD ? 'SOURCE_BODY' : 'LOCAL', sideOfWall: (w) => sideOfWall(mD, w) })
      // an open KEY feature of the body or its roofs — by MEASUREMENT of the delivered model against the sources' own
      // statement — excludes full acceptance, whatever a look said: a reviewer's "verified" is not a source measure
      const keyOpen = tr.rows.filter((q) => q.feature.weight === 'KEY' && (q.result === 'NOT_BUILT' || q.result === 'BUILT_DIFFERENT') && q.cause !== 'DISPUTED_BY_WITNESS')
      if (keyOpen.length > 0 && sourceCheck?.quality && sourceCheck.quality.state === 'SOURCE_VERIFIED_IN_SCOPE') {
        const to = keyOpen.some((q) => q.cause === 'NO_CONSUMER' || q.cause === 'LOST_IN_BINDING') ? 'UNSUPPORTED_OPERATION' as const : 'NEEDS_EVIDENCE' as const
        sourceCheck.quality = { ...sourceCheck.quality, state: to, reasons: [to, ...sourceCheck.quality.reasons.filter((q) => q !== to && q !== 'SOURCE_VERIFIED_IN_SCOPE')], why: `${sourceCheck.quality.why}; ${keyOpen.length} KEY feature(s) the sources state are not in the delivered model by measurement (${keyOpen.map((q) => `${q.feature.id}: ${q.cause ?? q.result}`).join(', ')}): not verified, whatever the look found` }
        // v3.54.21 review F2: the served summary says what the gate decided — consultation.quality was copied before it
        consultation.quality = { state: sourceCheck.quality.state, reasons: sourceCheck.quality.reasons, reviewCompleted: sourceCheck.quality.reviewCompleted, openKey: sourceCheck.quality.openKey, closedVerified: sourceCheck.quality.closedVerified }
      }
      record({ at: now().toISOString(), kind: 'FEATURE_TRACE', version: tr.version, features: tr.features, keyOpen: keyOpen.map((q) => q.feature.id), byResult: tr.byResult, byCause: tr.byCause, rows: tr.rows, why: `${tr.features} source feature(s) followed to the delivered model: ${tr.byResult.BUILT_AS_STATED} built as stated, ${tr.byResult.BUILT_DIFFERENT} built differently, ${tr.byResult.NOT_BUILT} not built, ${tr.byResult.NOT_CHECKED} not checked — by cause: ${Object.entries(tr.byCause).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}` })
    } else record({ at: now().toISOString(), kind: 'FEATURE_TRACE', version: FEATURE_MAP_VERSION, features: 0, byResult: null, byCause: { NO_READ: 1 }, rows: [], why: `no feature map: ${structureMemo ? `the structure read gave no typed answer (${structureMemo.read.refused.join('; ').slice(0, 200)})` : 'the structure read was not asked (no elevation and no perspective picture in the package, or no consultant)'}` })
    record({ at: now().toISOString(), kind: 'STRUCTURE_READBACK', version: sb.version, taken: structureMemo?.build ?? null, bodies: sb.bodies, roofs: sb.roofs, joins: sb.joins, checks: sb.checks, why: structureMemo?.build ? `${sb.checks.filter((q) => q.agrees).length} of ${sb.checks.length} taken structure properties are in the delivered model${sb.checks.some((q) => !q.agrees) ? ` (not: ${sb.checks.filter((q) => !q.agrees).map((q) => `${q.property} taken ${q.taken}, built ${q.built}`).join('; ')})` : ''}` : 'no structure was taken (not read, refused, or fewer than two sketched elevations): the bodies are listed as built' })
  }
  // v3.54.19: where the plan sheet lies in the delivered model (three mapped points): any overlay of the model on its plan
  if (good.run) {
    const mm = massingOf.get(good)?.planMap
    const pf = mm ? undefined : (good.run.reconstruction.registrations.plans.find((q) => q.frameId === good.plans?.selectedPlanFrameId) ?? good.run.reconstruction.registrations.plans.find((q) => q.storeyIndex === 0))
    const planFrame: PlanFrameOfModel | undefined = mm ?? (pf ? { frameId: pf.frameId, basis: 'LOCAL_PLAN_REGISTRATION', o: pf.toWorld(0, 0), x1000: pf.toWorld(1000, 0), y1000: pf.toWorld(0, 1000) } : undefined)
    if (planFrame) record({ at: now().toISOString(), kind: 'PLAN_FRAME_OF_MODEL', ...planFrame })
  }
  record({ at: now().toISOString(), kind: 'FINAL', local: localState, final: finalState, usd, readings, roofFeatures: features, sourceCheck: sourceCheck ?? null })
  return { ...(bodyArbitration ? { bodyArbitration } : {}), contract: CONSULTANT_CONTRACT_VERSION, prompt: CONSULTANT_PROMPT_VERSION, variant: wiring.variant, ...(good.run ? { run: good.run } : {}), ...(good.error ? { error: good.error } : {}), local: localState, ...(wiring.keepLocalModel && local.run ? { localModel: local.run.reconstruction.model } : {}), final: finalState, rounds, readings: good === local ? [] : readings, spans: good === local ? [] : spans, usd, ...(boundary ? { boundary } : {}), geometry, roofFeatures: features, ...(sourceCheck ? { sourceCheck } : {}), consultation, ...(metricRead ? { metricRead } : {}), ...(sketchSummary ? { sketches: sketchSummary } : {}), ...(unregisteredSketches ? { sketchesWithoutModel: unregisteredSketches } : {}), ...(massingDelivery ? { massing: massingDelivery } : {}), ...(massingRejected ? { massingRejected } : {}), ...(structureMemo ? { structureRead: { promptVersion: structureMemo.read.promptVersion, sent: structureMemo.read.sent ?? [], sentText: structureMemo.read.sentText ?? [], raw: structureMemo.read.raw, refused: structureMemo.read.refused, ...(structureMemo.agreed ? { agreed: structureMemo.agreed } : {}), ...(structureMemo.build ? { build: structureMemo.build } : {}), ...(structureMemo.features ? { features: structureMemo.features } : {}) } } : {}), globalDescription: 'DISABLED' }
}

/** What the looks established, for the result: the delivered revision, the findings still open, each correction's fate. */
/**
 * A settled scale the analyzer could not build on. A metric round that was rolled back because its candidate refused
 * still read the drawing's dimensions; when those settle a scale more than 3 % from the one the kept model is drawn at
 * — and that model's own scale was never settled — the model is contradicted by the drawing, and the result says so.
 */
export function scaleContradictionOf(rounds: readonly RoundRecord[], delivered: RunState): SourceCheckSummary['scaleContradiction'] {
  if (delivered.outcome !== 'COMPLETED' || (CONF_RANK[delivered.metric?.confidence ?? 'INCONCLUSIVE'] ?? 0) >= 2) return undefined
  const mine = delivered.metric?.cmPerPixelX ?? delivered.metric?.cmPerPixelY
  if (!mine || !(mine > 0)) return undefined
  for (const r of [...rounds].reverse()) {
    const after = r.after
    if (r.decision !== 'ROLLBACK' || !after || after.outcome === 'COMPLETED' || (CONF_RANK[after.metric?.confidence ?? 'INCONCLUSIVE'] ?? 0) < 2) continue
    const xs = [after.metric?.cmPerPixelX, after.metric?.cmPerPixelY].filter((v): v is number => typeof v === 'number' && v > 0)
    if (xs.length === 0) continue
    const consulted = xs.reduce((a, b) => a + b, 0) / xs.length
    const ratio = mine / consulted
    if (Math.abs(Math.log(ratio)) <= 0.03) continue
    return { modelCmPerPixel: mine, consultedCmPerPixelX: after.metric?.cmPerPixelX ?? null, consultedCmPerPixelY: after.metric?.cmPerPixelY ?? null, ratio: Math.round(ratio * 1000) / 1000, refusal: `${after.code ?? ''}/${after.reasonCode ?? ''}`, dimensions: (r.spans ?? []).map((sp) => ({ literal: sp.literal, unit: sp.unit })) }
  }
  return undefined
}

export function sourceCheckOf(good: Local, state: RunState, geometry: readonly GeometryRound[], features: readonly RoofFeatureCorrection[], last: ModelCheckResult | undefined, checkedRevision: string | null, rounds: readonly RoundRecord[] = []): SourceCheckSummary {
  // v3.54.16: a revision is the model's own bytes (patches and finishes included), not the solver's candidate hash
  const delivered = good.run ? modelRevision(good.run.reconstruction.model) : null
  const looked = geometry.filter((g) => g.status !== null)
  const corrections: SourceCheckSummary['corrections'] = []
  for (const g of geometry) {
    for (const v of g.verdicts) {
      const outcome = g.outcomes.find((o) => o.id === v.featureId)
      const kept = v.featureId !== undefined && features.some((f) => f.id === v.featureId && f.proposalId === v.proposalId)
      const review = geometry.flatMap((x) => x.reviewed).find((r) => r.id === v.featureId)
      const state: SourceCheckSummary['corrections'][number]['state'] =
        v.status === 'CAPABILITY_MISSING' ? 'NO_CONSUMER' : v.status === 'HELD' ? 'HELD' : v.status === 'REJECTED' ? 'REJECTED' : kept ? 'APPLIED' : outcome?.status === 'REFUSED' ? 'REFUSED_BY_ANALYZER' : outcome?.status === 'APPLIED' ? 'ROLLED_BACK' : 'NOT_APPLIED'
      corrections.push({ proposalId: v.proposalId, operation: v.operation, targetId: v.targetId, ...(v.featureId ? { featureId: v.featureId } : {}), state, ...(v.code ? { code: v.code } : {}), ...(review && kept ? { review: review.verdict } : {}), why: state === 'REFUSED_BY_ANALYZER' ? `${outcome?.code ?? ''}: ${outcome?.why ?? ''}` : v.why })
    }
  }
  // v3.54.16: the registry operations of each look, by their executor record
  for (const g of geometry) for (const r of g.patches ?? []) corrections.push({ proposalId: r.proposalId, operation: r.operation, targetId: r.targetId, ...(r.bound?.ids[0] ? { featureId: r.bound.ids[0] } : {}), state: r.status === 'COMMITTED' ? 'APPLIED' : r.status === 'UNSUPPORTED_OPERATION' ? 'NO_CONSUMER' : r.status === 'HELD' || r.status === 'NEEDS_EVIDENCE' ? 'HELD' : r.status === 'ROLLED_BACK' || r.status === 'GROUP_ROLLED_BACK' || r.status === 'NO_EFFECT' ? 'ROLLED_BACK' : 'REJECTED', ...(r.code ? { code: r.code } : {}), why: r.why })
  const knownDefects: SourceCheckSummary['knownDefects'] = []
  for (const a of state.outline ? [state.outline.x, state.outline.y] : []) if (a.status === 'SHORT' || a.status === 'BEYOND') knownDefects.push({ code: a.status === 'SHORT' ? 'OUTLINE_SHORT_OF_PRINTED_DIMENSION' : 'OUTLINE_BEYOND_PRINTED_DIMENSION', what: a.why })
  for (const a of state.outline ? [state.outline.x, state.outline.y] : []) if (a.status === 'MATCHES' && (a.offM ?? 0) > 0) knownDefects.push({ code: 'OUTLINE_WITHIN_A_WALL_OF_PRINTED_DIMENSION', what: a.why })
  // a finding of the last look that no applied correction answers is open; the app shows it beside the model
  const lastLook = [...looked].reverse()[0]
  if (lastLook && lastLook.status === 'ISSUE_FOUND') for (const c of corrections.filter((c) => c.state !== 'APPLIED' && geometry.some((g) => g === lastLook && g.verdicts.some((v) => v.proposalId === c.proposalId)))) knownDefects.push({ code: `SOURCE_DIFFERENCE_${c.state}`, what: `${c.operation} ${c.targetId}: ${c.why}`.slice(0, 400) })
  const contradiction = scaleContradictionOf(rounds, state)
  if (contradiction) knownDefects.push({ code: 'SCALE_CONTRADICTED_BY_PRINTED_DIMENSIONS', what: `this model is drawn at ${contradiction.modelCmPerPixel} cm/px, but the drawing's printed dimensions (${contradiction.dimensions.map((d) => `${d.literal} ${d.unit}`).join(', ') || 'read with the consultant'}) settle ${[contradiction.consultedCmPerPixelX, contradiction.consultedCmPerPixelY].filter((v) => v !== null).join(' / ')} cm/px: its lengths are ${Math.round(Math.abs(contradiction.ratio - 1) * 100)} % ${contradiction.ratio > 1 ? 'too long' : 'too short'}. The analyzer could not compose the plan at the printed scale (${contradiction.refusal}), so this is the earlier model kept as an unreliable preview; no quantity may be taken from it` })
  for (const f of features) knownDefects.push({ code: 'ROOF_FEATURE_APPROXIMATE', what: `${f.id} is placed from shares of an elevation picture: a visual approximation, not a measurement; no quantity may be taken from it` })
  const status: SourceCheckSummary['status'] = looked.length === 0 ? 'NOT_CHECKED' : checkedRevision !== null && checkedRevision === delivered ? 'CHECKED' : 'PARTLY_CHECKED'
  // a difference the consultant reported and no applied correction answers stays open — also when its proposal was
  // inadmissible (a stale revision, the wrong kind of picture): the finding may be right though the proposal could not
  // be used. Only a repeat of something already answered leaves nothing open.
  const ANSWERED = new Set(['ALREADY_PRESENT', 'DUPLICATE_PROPOSAL_ID'])
  const open = (ops: string[]): boolean => corrections.some((c) => ops.includes(c.operation) && c.state !== 'APPLIED' && !(c.state === 'REJECTED' && ANSWERED.has(c.code ?? '')))
  const sts = state.outline ? [state.outline.x, state.outline.y] : []
  const worst: SourceCheckSummary['axes']['outline'] = sts.some((a) => a.status === 'BEYOND') ? 'BEYOND' : sts.some((a) => a.status === 'SHORT') ? 'SHORT' : sts.some((a) => a.status === 'MATCHES' && (a.offM ?? 0) > 0) ? 'MATCHES_WITHIN_A_WALL' : sts.some((a) => a.status === 'MATCHES') ? 'MATCHES' : 'NOT_COMPARED'
  const m = good.run?.result.measurement
  const consultedScale = (good.metrics?.consultedSpans ?? []).some((o) => o.frameId === state.frameId && o.status === 'ADMITTED')
  const settled = (CONF_RANK[state.metric?.confidence ?? 'INCONCLUSIVE'] ?? 0) >= 2
  const axes: SourceCheckSummary['axes'] = {
    run: 'COMPLETED',
    scale: { status: contradiction ? 'CONTRADICTED' : (m?.scale.status ?? 'NOT_ASSESSED'), confidence: state.metric?.confidence ?? null, settledBy: contradiction ? 'CONTRADICTED' : !settled ? 'UNSETTLED' : consultedScale ? 'CONSULTED_DIMENSIONS' : 'OWN_READINGS' },
    outline: worst,
    roof: looked.length === 0 ? 'NOT_CHECKED' : open(['ROOF_FEATURE', 'ROOF_FORM']) ? 'DIFFERENCE_OPEN' : features.length > 0 ? 'CORRECTED_APPROXIMATE' : 'NO_DIFFERENCE_REPORTED',
    openings: looked.length === 0 ? 'NOT_CHECKED' : open(['OPENING', 'MISSING_ELEMENT', 'ASSIGN_VIEW', 'ADD_OPENING', 'UPDATE_OPENING', 'REMOVE_OPENING']) ? 'DIFFERENCE_OPEN' : 'NO_DIFFERENCE_REPORTED',
    interior: looked.length > 0 && (last?.pictures ?? []).some((p) => p.label.startsWith('STOREY')) && (last?.review?.checked ?? []).some((c) => /interior|room|partition|storey|wnętrz|pomieszcz/i.test(c)) ? 'REVIEWED_FROM_PLANS' : 'NOT_CHECKED',
    quantities: contradiction ? 'NOT_USABLE' : worst === 'SHORT' || worst === 'BEYOND' || worst === 'MATCHES_WITHIN_A_WALL' ? (m?.quantities === 'NOT_USABLE' ? 'NOT_USABLE' : 'LIMITED') : (m?.quantities ?? 'NOT_ASSESSED'),
    sourceCheck: status,
  }
  return {
    schemaVersion: '1.0.0',
    status,
    checkedRevision,
    deliveredRevision: delivered,
    reviewStatus: last?.review?.status ?? null,
    looks: looked.length,
    findings: last?.review?.observations ?? [],
    corrections,
    checked: last?.review?.checked ?? [],
    notChecked: last?.review?.notChecked ?? [],
    ...(state.outline ? { outline: state.outline } : {}),
    ...(contradiction ? { scaleContradiction: contradiction } : {}),
    knownDefects,
    axes,
  }
}
