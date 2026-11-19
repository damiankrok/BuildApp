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
import { overviewOf } from './tools.js'
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
import { SKETCH_STEP_VERSION, judgeForm, readSketches } from './sketch-step.js'
import { CHOOSE_VERSION } from './choose.js'
import { ACCEPTED_CONSULT_SCHEMA, ACCEPTED_CONSULT_VERSION, consultBinding, recordingModel, replayModel } from './accepted-consult.js'
import type { AcceptedConsultRevision, AcceptedConsultStore, ConsultReuse, RecordedAnswer } from './accepted-consult.js'
import { ELEVATION_SKETCH_PARSER_VERSION, ELEVATION_SKETCH_PROMPT_VERSION } from '../appearance/elevation-sketch.js'
import { SOLVER_V2_VERSION } from '@buildapp/reconstruction'
import type { SketchReading } from './sketch-step.js'
import { usableGeometryFingerprint } from '../appearance/consumer.js'
import type { LabelProblem } from './problems.js'

export type ConsultantWiring = {
  model: ConsultantModel
  price: Price
  spend?: ConsultSpend
  limits?: ConsultLimits
  /** At most this many rounds that may change the metric layer (two). */
  maxRounds?: number
  /** v3.54.3: at most this many rounds that may change the built geometry after the check (two); a last look reviews the last one. */
  maxGeometryRounds?: number
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
}

/** v3.54.14: what the sketch step read, accepted and changed (the rasters are not kept: they are redrawn from the sketches). */
export type SketchSummary = { reading: Omit<SketchReading, 'elevationSketches'>; form: { decision: 'ACCEPT' | 'ROLLBACK' | 'NOT_RUN'; why: string; measuredBefore?: BuiltMeasure; measuredAfter?: BuiltMeasure }; finish: { decision: 'ACCEPT' | 'ROLLBACK' | 'NOT_RUN'; why: string }; usd: number }

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
    interior: 'NOT_CHECKED'
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
  sketches?: { sides: string[]; form: string; finish: string; usd: number }
  /** v3.54.14: the accepted-revision rule on this path (`accepted-consult.ts`), when the host keeps a store. */
  accepted?: ConsultReuse
}

export type ConsultedAnalysis = {
  contract: string
  prompt: string
  variant: 'R' | 'C'
  /** The result the caller gets: the accepted run, or the LOCAL one. */
  run?: AnalysisRun
  error?: AnalysisError
  local: RunState
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
}

const CONF_RANK: Record<string, number> = { INCONCLUSIVE: 0, WEAK: 1, SUPPORTED: 2, STRONG: 3 }

type Local = { run?: AnalysisRun; error?: AnalysisError; pkg?: SourcePackage; graph?: SourceObservationGraph; metrics?: MetricEvidenceSet; plans?: PlanDiagnosticsReport }

async function attempt(input: AnalysisInput, options: AnalysisOptions): Promise<Local> {
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
async function checkSources(l: Local, options: AnalysisOptions): Promise<CheckSource[]> {
  const out: CheckSource[] = []
  if (!l.pkg || !l.graph) return out
  const add = async (frameId: string, what: CheckSource['what'], label: string): Promise<void> => {
    const f = l.graph?.coordinateFrames.find((x) => x.id === frameId)
    const fr = f ? await frameRaster(l.pkg as SourcePackage, l.graph as SourceObservationGraph, frameId, options) : undefined
    if (!f || !fr?.raster) return
    // the whole picture, downscaled by a whole factor only when it is larger than the provider would keep: the pixels
    // the consultant reports are then the pixels it was sent, and the transform back to the frame is stated
    out.push({ img: overviewOf(fr.raster, frameId, []), raster: fr.raster, what, frameId, projection: f.roles.projection, label })
  }
  const base = l.plans?.selectedPlanFrameId ?? undefined
  if (base) await add(base, 'PLAN', 'the floor plan the model was built from (its lowest storey); the house FRONT is at the bottom of this sheet')
  const otherPlans = (l.run?.reconstruction.registrations.plans ?? []).filter((p) => p.frameId !== base).slice(0, 2)
  for (const p of otherPlans) await add(p.frameId, 'PLAN', `another floor plan of the same house (storey index ${p.storeyIndex})`)
  for (const f of l.graph.coordinateFrames.filter((x) => x.roles.projection === 'ORTHOGRAPHIC_ELEVATION').slice(0, 6)) {
    const role = f.roles.view && f.roles.view !== 'NOT_APPLICABLE' && f.roles.view !== 'UNKNOWN' ? `; the publisher's caption says ${f.roles.view}` : ''
    await add(f.id, 'ELEVATION', `a publisher's elevation drawing${role} (which model side it shows is for you to establish)`)
  }
  const section = l.graph.coordinateFrames.find((x) => x.roles.projection === 'ORTHOGRAPHIC_SECTION')
  if (section) await add(section.id, 'OTHER_SOURCE', "the publisher's section drawing")
  return out
}

/**
 * The service entrypoint: LOCAL first; then at most `maxRounds` metric consultations, each consumed (C) or only recorded
 * (R); then, on the model that stands, at most `maxGeometryRounds` checks that may change its geometry and a last look
 * that reviews it. Never throws because of the consultant: its failure is a record, and the result before it stands.
 */
export async function consultAnalysis(input: AnalysisInput, options: AnalysisOptions, wiring: ConsultantWiring): Promise<ConsultedAnalysis> {
  const record = wiring.record ?? (() => undefined)
  const now = options.now ?? (() => new Date())
  const limits = wiring.limits ?? DEFAULT_CONSULT_LIMITS
  const maxRounds = wiring.maxRounds ?? 2
  record({ at: now().toISOString(), kind: 'PATH', path: 'CONSULTANT', variant: wiring.variant, globalDescription: 'DISABLED', contract: CONSULTANT_CONTRACT_VERSION, prompt: CONSULTANT_PROMPT_VERSION, model: wiring.model.model })
  const local = await attempt(input, { ...options, consulted: undefined, consultedSpans: undefined, crossAxisWitness: undefined, roofFeatures: undefined, reuseMetrics: undefined, glazedEnds: undefined })
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
      consultant: [CONSULTANT_CONTRACT_VERSION, CONSULTANT_PROMPT_VERSION, METRIC_READ_PROMPT_VERSION, METRIC_VERIFY_PROMPT_VERSION, METRIC_RESOLVER_VERSION, ELEVATION_SKETCH_PROMPT_VERSION, `parser${ELEVATION_SKETCH_PARSER_VERSION}`, SKETCH_STEP_VERSION, CHOOSE_VERSION, ACCEPTED_CONSULT_VERSION].join(','),
      models: { ROUNDS: wiring.model.model, ...(wiring.metricRead === 'ON' ? { METRIC: (wiring.metricModel ?? wiring.model).model } : {}), ...(wiring.sketches === 'ON' ? { SKETCH: (wiring.sketchModel ?? wiring.model).model } : {}) },
      settings: `strict=${wiring.model.strict === true || wiring.metricModel?.strict === true || wiring.sketchModel?.strict === true ? 'on' : 'off'};variant=${wiring.variant};metric=${wiring.metricRead ?? 'OFF'};sketches=${wiring.sketches ?? 'OFF'};rounds=${maxRounds};geometryRounds=${wiring.maxGeometryRounds ?? '-'};check=${wiring.check ?? 'ON'}`,
    })
    const stored = wiring.accepted.reanalyse ? undefined : wiring.accepted.store.get(b.key)
    acceptedState = { key: b.key, binding: b.binding, ...(stored ? { reused: stored } : { why: wiring.accepted.reanalyse ? 'REANALYSIS_ASKED' as const : 'NO_ACCEPTED_REVISION' as const }) }
    const { spend: _unbooked, ...rest } = wiring
    void _unbooked
    wiring = stored
      ? { ...rest, model: replayModel(wiring.model, 'ROUNDS', stored.answers, replayCounter), ...(wiring.metricModel ? { metricModel: replayModel(wiring.metricModel, 'METRIC', stored.answers, replayCounter) } : {}), ...(wiring.sketchModel ? { sketchModel: replayModel(wiring.sketchModel, 'SKETCH', stored.answers, replayCounter) } : {}) }
      : { ...wiring, model: recordingModel(wiring.model, 'ROUNDS', answers, transportFailures), ...(wiring.metricModel ? { metricModel: recordingModel(wiring.metricModel, 'METRIC', answers, transportFailures) } : {}), ...(wiring.sketchModel ? { sketchModel: recordingModel(wiring.sketchModel, 'SKETCH', answers, transportFailures) } : {}) }
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
    const sections = local.graph.coordinateFrames.filter((x) => x.roles.projection === 'ORTHOGRAPHIC_SECTION')
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
  // v3.54.14 (L-MS): the sketches, on the model that stands and its metric facts
  let sketchSummary: SketchSummary | undefined
  if (wiring.sketches === 'ON' && good.run && good.pkg && good.graph && good.metrics) {
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
    const reading = await readSketches({ metrics: metrics0, model: run0.reconstruction.model, views: run0.reconstruction.facadeAlignment.views.map((v) => ({ facade: v.facade, frameId: v.frameId, projection: v.projection })), ...(metricRead ? { metricReads: metricRead.reads } : {}), rasterOf, ctx: { model: wiring.sketchModel ?? wiring.model, price: wiring.sketchPrice ?? wiring.price, ...(wiring.spend ? { spend: wiring.spend } : {}), ...(options.signal ? { signal: options.signal } : {}) } })
    usd += reading.usd
    const { elevationSketches, ...kept } = reading
    sketchSummary = { reading: kept, form: { decision: 'NOT_RUN', why: '' }, finish: { decision: 'NOT_RUN', why: '' }, usd: reading.usd }
    if (wiring.variant === 'R') sketchSummary.form.why = sketchSummary.finish.why = 'variant R: read and checked; nothing handed to the analyzer'
    else if (elevationSketches.length === 0 && reading.appearance.observations.length === 0) sketchSummary.form.why = sketchSummary.finish.why = 'no sketch passed the proportion check'
    else {
      const base = { ...options, ...(readings.length > 0 ? { consulted: readings } : {}), ...(spans.length > 0 ? { consultedSpans: spans } : {}), ...(levels.length > 0 ? { consultedLevels: levels } : {}), ...(readings.length + spans.length > 0 ? { crossAxisWitness: true } : {}), reuseMetrics: metrics0, roofFeatures: undefined, glazedEnds: undefined }
      const acceptedSides = reading.sketches.filter((s) => s.check?.properties.finish === 'ACCEPTED').map((s) => s.facade)
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

  // --- geometry: the model that stands against the source's plans and elevations; each look may change it ------------
  const geometry: GeometryRound[] = []
  const features: RoofFeatureCorrection[] = []
  const metricOn = consultedOn()
  const maxGeometry = wiring.maxGeometryRounds ?? 2
  const viewsOf = wiring.views ?? ((run: AnalysisRun): ModelViewPicture[] => renderModelViews(run.result.scene))
  let lastApplied: Array<{ id: string; what: string }> = []
  let lastRefused: Array<{ targetId: string; why: string }> = []
  let previous: { good: Local; state: RunState; features: RoofFeatureCorrection[] } | undefined
  const seenG = new Set<string>()
  let lastReview: ModelCheckResult | undefined
  let lastCheckedRevision: string | null = null
  if ((wiring.check ?? 'ON') === 'ON' && good.run && good.pkg && good.graph) {
    const pkg = good.pkg
    const graph = good.graph
    const sources = await checkSources(good, options)
    for (let g = 1; g <= maxGeometry + 1 && sources.length > 0; g += 1) {
      const run = good.run as AnalysisRun
      const revision = run.reconstruction.candidate.modelHash.slice(0, 12)
      const rec: GeometryRound = { round: g, revision, status: null, pictures: [], observations: [], reviewed: [], verdicts: [], corrections: [], outcomes: [], decision: 'NOT_RUN', why: '', usd: 0 }
      geometry.push(rec)
      let res: ModelCheckResult
      try {
        const views = viewsOf(run)
        res = await checkModel({ baseRevision: revision, sources, views, ...(lastApplied.length > 0 ? { applied: lastApplied } : {}), ...(lastRefused.length > 0 ? { refused: lastRefused } : {}), model: wiring.model, price: wiring.price, ...(wiring.spend ? { spend: wiring.spend } : {}), limits, record: (e) => record({ ...e, round: `check-${g}` }), ...(options.signal ? { signal: options.signal } : {}), now })
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
      rec.status = res.review.status
      rec.observations = res.review.observations
      // what the look says of the features the round before built: one the source does not show is taken out again
      if (lastApplied.length > 0) {
        rec.reviewed = reviewOutcome(lastApplied.map((a) => a.id), res.review.appliedReview)
        const drop = rec.reviewed.filter((r) => !r.keep).map((r) => r.id)
        record({ at: now().toISOString(), kind: 'APPLIED_REVIEW', round: g, reviewed: rec.reviewed })
        if (drop.length > 0 && previous) {
          const kept = features.filter((f) => !drop.includes(f.id))
          let back: Local | undefined
          if (kept.length === previous.features.length) back = previous.good
          else {
            const again = await attempt({ kind: 'PACKAGE', pkg, graph }, { ...options, consulted: readings, consultedSpans: spans, consultedLevels: levels, ...(metricOn ? { crossAxisWitness: true } : {}), reuseMetrics: good.metrics, roofFeatures: kept, ...(glazedEnds.length > 0 ? { glazedEnds } : {}) })
            back = again.run ? again : previous.good
          }
          good = back
          goodState = stateOf(good)
          features.splice(0, features.length, ...(back === previous.good ? previous.features : kept))
          rec.decision = 'ROLLBACK'
          rec.why = `the look at revision ${revision} says ${drop.join(', ')} is not what the drawings show (${rec.reviewed.filter((r) => !r.keep).map((r) => `${r.verdict}: ${r.note}`).join('; ').slice(0, 300)}): taken out again`
          rec.afterRevision = good.run?.reconstruction.candidate.modelHash.slice(0, 12)
          record({ at: now().toISOString(), kind: 'GEOMETRY_ROUND', round: g, decision: rec.decision, why: rec.why, afterRevision: rec.afterRevision })
          // the model the consultant looked at is no longer the one delivered
          lastCheckedRevision = null
          break
        }
      }
      // new proposals: validated and bound by the analyzer; ids are the consultant's within one look, so the loop scopes them
      const pictures: CheckPicture[] = res.pictures
      const registeredSides = new Map(run.reconstruction.registrations.elevations.map((e) => [e.frameId, e.side as string]))
      const present = new Set((run.reconstruction.building.dormers ?? []).map((d) => d.id))
      const corrections: RoofFeatureCorrection[] = []
      for (const p of res.review.proposedCorrections) {
        const bound = bindRoofFeature({ ...p, proposalId: `g${g}:${p.proposalId}` }, { revision, pictures, registeredSides, present, seen: seenG })
        if (bound.correction && corrections.some((c) => c.id === bound.correction?.id)) bound.verdict = { ...bound.verdict, status: 'REJECTED', code: 'ALREADY_PRESENT', why: `a second proposal for ${bound.correction.id} in one look` }
        else if (bound.correction) corrections.push(bound.correction)
        rec.verdicts.push(bound.verdict)
      }
      record({ at: now().toISOString(), kind: 'GEOMETRY_VALIDATION', round: g, revision, status: res.review.status, verdicts: rec.verdicts, observations: rec.observations })
      if (g > maxGeometry) {
        rec.decision = 'REVIEW_ONLY'
        rec.why = `the last look: it reviews what was applied; ${corrections.length} further proposal(s) are recorded and not applied (round limit ${maxGeometry})`
        for (const vv of rec.verdicts) if (vv.status === 'ACCEPTED') Object.assign(vv, { status: 'HELD', why: `${vv.why} — not applied: the round limit is reached` })
        record({ at: now().toISOString(), kind: 'GEOMETRY_ROUND', round: g, decision: rec.decision, why: rec.why })
        break
      }
      if (wiring.variant === 'R') {
        rec.decision = 'NOT_RUN'
        rec.why = 'variant R: the proposals are recorded and never consumed'
        record({ at: now().toISOString(), kind: 'GEOMETRY_ROUND', round: g, decision: rec.decision, why: rec.why })
        break
      }
      if (corrections.length === 0) {
        rec.decision = lastApplied.length > 0 ? 'REVIEW_ONLY' : 'NO_CHANGE'
        rec.why = lastApplied.length > 0 ? 'the look reviews what was applied and proposes nothing the analyzer can apply' : 'no proposal the analyzer can apply: the model stands, the findings stay on the record'
        record({ at: now().toISOString(), kind: 'GEOMETRY_ROUND', round: g, decision: rec.decision, why: rec.why })
        break
      }
      rec.corrections = corrections
      // the candidate: the same package, graph and metric revision; the analyzer rebuilds with the features so far and these
      const beforeG = geometryStateOf(run, features.map((f) => f.id))
      const candidate = await attempt({ kind: 'PACKAGE', pkg, graph }, { ...options, consulted: readings, consultedSpans: spans, consultedLevels: levels, ...(metricOn ? { crossAxisWitness: true } : {}), reuseMetrics: good.metrics, roofFeatures: [...features, ...corrections], ...(glazedEnds.length > 0 ? { glazedEnds } : {}) })
      const outcomes = candidate.run?.reconstruction.roofFeatures ?? []
      rec.outcomes = outcomes.filter((o) => corrections.some((c) => c.id === o.id))
      const afterG = candidate.run ? geometryStateOf(candidate.run, [...features, ...corrections].map((f) => f.id)) : undefined
      const decision = compareGeometry(beforeG, afterG, corrections, rec.outcomes, candidate.error ? `${candidate.error.failure().code}/${candidate.error.failure().reasonCode ?? ''}` : undefined)
      rec.decision = decision.decision
      rec.why = decision.why
      rec.afterRevision = candidate.run?.reconstruction.candidate.modelHash.slice(0, 12)
      record({ at: now().toISOString(), kind: 'GEOMETRY_ROUND', round: g, decision: rec.decision, why: rec.why, revision, afterRevision: rec.afterRevision, corrections, outcomes: rec.outcomes, before: beforeG, after: afterG ?? null })
      lastRefused = [...decision.refused.map((r) => ({ targetId: r.id, why: `${r.code ?? ''} ${r.why}`.trim() })), ...rec.verdicts.filter((x) => x.status === 'REJECTED' || x.status === 'HELD').map((x) => ({ targetId: x.targetId, why: `${x.code ?? x.status}: ${x.why}` }))]
      if (decision.decision !== 'ACCEPT') {
        // a correction the analyzer refused with a reason is new evidence for the consultant: one more look, told why,
        // while rounds remain; anything else (a rollback, nothing built and nothing said) ends the looks
        if (decision.decision === 'NO_CHANGE' && decision.refused.length > 0 && g < maxGeometry) continue
        break
      }
      previous = { good, state: goodState, features: [...features] }
      good = candidate
      goodState = stateOf(candidate)
      const builtNow = corrections.filter((c) => decision.applied.includes(c.id))
      features.push(...builtNow)
      lastApplied = builtNow.map((c) => ({ id: c.id, what: `a ${c.kind.toLowerCase().replace(/_/g, ' ')} on the ${c.side.toLowerCase()} side, ${Math.round(c.fromShare * 100)}–${Math.round(c.toShare * 100)} % along it` }))
      // the delivered revision has not been looked at yet: the next look is of exactly this revision
      lastCheckedRevision = null
    }
  }
  const finalState = stateOf(good)
  const sourceCheck = (wiring.check ?? 'ON') === 'ON' && good.run ? sourceCheckOf(good, finalState, geometry, features, lastReview, lastCheckedRevision, rounds) : undefined
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
    const deliveredHash = good.run?.reconstruction.candidate.modelHash ?? ''
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
  const consultation: ConsultationSummary = { schemaVersion: '1.0.0', contract: CONSULTANT_CONTRACT_VERSION, prompt: CONSULTANT_PROMPT_VERSION, variant: wiring.variant, model: wiring.model.model, usd: Math.round(usd * 1e6) / 1e6, globalDescription: 'DISABLED', local: { outcome: localState.outcome, reasonCode: localState.reasonCode ?? null, modelHash: localState.modelHash ?? null }, metricRounds: rounds.map((r) => ({ round: r.round, decision: r.decision, why: r.why })), boundary: boundary ? { decision: boundary.decision, why: boundary.why, sides: boundary.sides } : null, looks: geometry.map((g) => ({ round: g.round, revision: g.revision, status: g.status, decision: g.decision, why: g.why })), roofFeatures: features.map((f) => f.id), ...(metricRead ? { metricRead: { decision: metricRead.decision, why: metricRead.why, corrected: metricRead.resolution.decisions.filter((d) => d.decision === 'CORRECTED').length, agrees: metricRead.resolution.decisions.filter((d) => d.decision === 'AGREES').length, unresolved: metricRead.resolution.decisions.filter((d) => d.decision === 'UNRESOLVED').length, newSpans: metricRead.resolution.spans.length, usd: metricRead.usd } } : {}), ...(sketchSummary ? { sketches: { sides: sketchSummary.reading.sketches.map((x) => `${x.facade}:${x.check?.verdict ?? (x.failed ? 'FAILED' : 'NONE')}`), form: sketchSummary.form.decision, finish: sketchSummary.finish.decision, usd: sketchSummary.usd } } : {}), ...(accepted ? { accepted } : {}) }
  if (good.run) (good.run.result as { consultation?: ConsultationSummary }).consultation = consultation
  record({ at: now().toISOString(), kind: 'FINAL', local: localState, final: finalState, usd, readings, roofFeatures: features, sourceCheck: sourceCheck ?? null })
  return { contract: CONSULTANT_CONTRACT_VERSION, prompt: CONSULTANT_PROMPT_VERSION, variant: wiring.variant, ...(good.run ? { run: good.run } : {}), ...(good.error ? { error: good.error } : {}), local: localState, final: finalState, rounds, readings: good === local ? [] : readings, spans: good === local ? [] : spans, usd, ...(boundary ? { boundary } : {}), geometry, roofFeatures: features, ...(sourceCheck ? { sourceCheck } : {}), consultation, ...(metricRead ? { metricRead } : {}), ...(sketchSummary ? { sketches: sketchSummary } : {}), globalDescription: 'DISABLED' }
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
  const delivered = good.run?.reconstruction.candidate.modelHash.slice(0, 12) ?? null
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
    openings: looked.length === 0 ? 'NOT_CHECKED' : open(['OPENING', 'MISSING_ELEMENT', 'ASSIGN_VIEW']) ? 'DIFFERENCE_OPEN' : 'NO_DIFFERENCE_REPORTED',
    interior: 'NOT_CHECKED',
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
