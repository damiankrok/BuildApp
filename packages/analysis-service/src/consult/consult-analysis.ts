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
import type { ConsultedReading, ConsultedSpan, MetricEvidenceSet } from '@buildapp/source-metrics'
import type { PlanDiagnosticsReport } from '@buildapp/reconstruction'
import { decodeImage, startDecoders } from '@buildapp/source-package'
import type { SourcePackage } from '@buildapp/source-package'
import type { SourceObservationGraph } from '@buildapp/source-observations'
import { frameRasters } from '@buildapp/source-cv'
import { AnalysisError, toAnalysisError } from '../errors.js'
import { runAnalysis } from '../run.js'
import type { AnalysisInput, AnalysisOptions, AnalysisRun } from '../run.js'
import { CONSULTANT_CONTRACT_VERSION, CONSULTANT_PROMPT_VERSION } from './contract.js'
import type { ConsultantReview } from './contract.js'
import type { RoofFeatureCorrection, RoofFeatureOutcome } from '@buildapp/reconstruction'
import { cropOf } from './tools.js'
import { DEFAULT_CONSULT_LIMITS, checkModel, consultLabels, overviewScale, validateProposals } from './loop.js'
import type { CheckSource, ConsultEvent, ConsultLimits, ConsultOutcome, ConsultSpend, ConsultantModel, ModelCheckResult, Price, ProposalVerdict } from './loop.js'
import { bindRoofFeature, compareGeometry, geometryStateOf, reviewOutcome } from './geometry.js'
import type { CheckPicture, GeometryDecision, GeometryVerdict } from './geometry.js'
import { renderModelViews } from './model-views.js'
import type { ModelViewPicture } from './model-views.js'
import type { ReviewObservation } from './contract.js'
import { labelProblemOf } from './problems.js'
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
  corrections: Array<{ proposalId: string; operation: string; targetId: string; featureId?: string; state: 'APPLIED' | 'REFUSED_BY_ANALYZER' | 'HELD' | 'NO_CONSUMER' | 'REJECTED' | 'ROLLED_BACK' | 'NOT_APPLIED'; review?: string; why: string }>
  checked: string[]
  notChecked: string[]
  outline?: RunState['outline']
  /** Defects known and not corrected, each by code: what an app must show beside the model. */
  knownDefects: Array<{ code: string; what: string }>
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
  /** v3.54.3: the looks at the built model and what each changed. */
  geometry: GeometryRound[]
  /** The roof features the delivered model holds from corrections. */
  roofFeatures: RoofFeatureCorrection[]
  sourceCheck?: SourceCheckSummary
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
    return { status: 'MATCHES', ...base, why: `the built outline ends where the printed ${(whole.valueCm as number) / 100} m does, within a wall (${tol} px)` }
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
  const whole = (r: { width: number; height: number }): { x0: number; y0: number; x1: number; y1: number } => ({ x0: 0, y0: 0, x1: r.width, y1: r.height })
  const add = async (frameId: string, what: CheckSource['what'], label: string): Promise<void> => {
    const f = l.graph?.coordinateFrames.find((x) => x.id === frameId)
    const fr = f ? await frameRaster(l.pkg as SourcePackage, l.graph as SourceObservationGraph, frameId, options) : undefined
    if (!f || !fr?.raster) return
    out.push({ img: cropOf(fr.raster, frameId, whole(fr.raster), { minSide: 1, maxScale: 1 }), raster: fr.raster, what, frameId, projection: f.roles.projection, label })
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
  const local = await attempt(input, { ...options, consulted: undefined, consultedSpans: undefined, crossAxisWitness: undefined, roofFeatures: undefined, reuseMetrics: undefined })
  const localState = stateOf(local)
  record({ at: now().toISOString(), kind: 'LOCAL', state: localState })
  let good: Local = local
  let goodState = localState
  const rounds: RoundRecord[] = []
  const readings: ConsultedReading[] = []
  const spans: ConsultedSpan[] = []
  const seen = new Set<string>()
  let usd = 0
  let basis: Local = local
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
    const candidate = await attempt({ kind: 'PACKAGE', pkg, graph }, { ...options, consulted: merged, consultedSpans: mergedSpans, crossAxisWitness: true, roofFeatures: undefined, reuseMetrics: undefined })
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

  // --- geometry: the model that stands against the source's plans and elevations; each look may change it ------------
  const geometry: GeometryRound[] = []
  const features: RoofFeatureCorrection[] = []
  const metricOn = good !== local
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
            const again = await attempt({ kind: 'PACKAGE', pkg, graph }, { ...options, consulted: readings, consultedSpans: spans, ...(metricOn ? { crossAxisWitness: true } : {}), reuseMetrics: good.metrics, roofFeatures: kept })
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
      const candidate = await attempt({ kind: 'PACKAGE', pkg, graph }, { ...options, consulted: readings, consultedSpans: spans, ...(metricOn ? { crossAxisWitness: true } : {}), reuseMetrics: good.metrics, roofFeatures: [...features, ...corrections] })
      const outcomes = candidate.run?.reconstruction.roofFeatures ?? []
      rec.outcomes = outcomes.filter((o) => corrections.some((c) => c.id === o.id))
      const afterG = candidate.run ? geometryStateOf(candidate.run, [...features, ...corrections].map((f) => f.id)) : undefined
      const decision = compareGeometry(beforeG, afterG, corrections, rec.outcomes, candidate.error ? `${candidate.error.failure().code}/${candidate.error.failure().reasonCode ?? ''}` : undefined)
      rec.decision = decision.decision
      rec.why = decision.why
      rec.afterRevision = candidate.run?.reconstruction.candidate.modelHash.slice(0, 12)
      record({ at: now().toISOString(), kind: 'GEOMETRY_ROUND', round: g, decision: rec.decision, why: rec.why, revision, afterRevision: rec.afterRevision, corrections, outcomes: rec.outcomes, before: beforeG, after: afterG ?? null })
      lastRefused = [...decision.refused.map((r) => ({ targetId: r.id, why: `${r.code ?? ''} ${r.why}`.trim() })), ...rec.verdicts.filter((x) => x.status === 'REJECTED' || x.status === 'HELD').map((x) => ({ targetId: x.targetId, why: `${x.code ?? x.status}: ${x.why}` }))]
      if (decision.decision !== 'ACCEPT') break
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
  const sourceCheck = (wiring.check ?? 'ON') === 'ON' && good.run ? sourceCheckOf(good, finalState, geometry, features, lastReview, lastCheckedRevision) : undefined
  // the result an app consumes says what was checked, what was corrected and what is known wrong — not only the trace
  if (good.run && sourceCheck) (good.run.result as { sourceCheck?: SourceCheckSummary }).sourceCheck = sourceCheck
  record({ at: now().toISOString(), kind: 'FINAL', local: localState, final: finalState, usd, readings, roofFeatures: features, sourceCheck: sourceCheck ?? null })
  return { contract: CONSULTANT_CONTRACT_VERSION, prompt: CONSULTANT_PROMPT_VERSION, variant: wiring.variant, ...(good.run ? { run: good.run } : {}), ...(good.error ? { error: good.error } : {}), local: localState, final: finalState, rounds, readings: good === local ? [] : readings, spans: good === local ? [] : spans, usd, geometry, roofFeatures: features, ...(sourceCheck ? { sourceCheck } : {}), globalDescription: 'DISABLED' }
}

/** What the looks established, for the result: the delivered revision, the findings still open, each correction's fate. */
export function sourceCheckOf(good: Local, state: RunState, geometry: readonly GeometryRound[], features: readonly RoofFeatureCorrection[], last: ModelCheckResult | undefined, checkedRevision: string | null): SourceCheckSummary {
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
      corrections.push({ proposalId: v.proposalId, operation: v.operation, targetId: v.targetId, ...(v.featureId ? { featureId: v.featureId } : {}), state, ...(review && kept ? { review: review.verdict } : {}), why: state === 'REFUSED_BY_ANALYZER' ? `${outcome?.code ?? ''}: ${outcome?.why ?? ''}` : v.why })
    }
  }
  const knownDefects: SourceCheckSummary['knownDefects'] = []
  for (const a of state.outline ? [state.outline.x, state.outline.y] : []) if (a.status === 'SHORT' || a.status === 'BEYOND') knownDefects.push({ code: a.status === 'SHORT' ? 'OUTLINE_SHORT_OF_PRINTED_DIMENSION' : 'OUTLINE_BEYOND_PRINTED_DIMENSION', what: a.why })
  // a finding of the last look that no applied correction answers is open; the app shows it beside the model
  const lastLook = [...looked].reverse()[0]
  if (lastLook && lastLook.status === 'ISSUE_FOUND') for (const c of corrections.filter((c) => c.state !== 'APPLIED' && geometry.some((g) => g === lastLook && g.verdicts.some((v) => v.proposalId === c.proposalId)))) knownDefects.push({ code: `SOURCE_DIFFERENCE_${c.state}`, what: `${c.operation} ${c.targetId}: ${c.why}`.slice(0, 400) })
  for (const f of features) knownDefects.push({ code: 'ROOF_FEATURE_APPROXIMATE', what: `${f.id} is placed from shares of an elevation picture: a visual approximation, not a measurement; no quantity may be taken from it` })
  return {
    schemaVersion: '1.0.0',
    status: looked.length === 0 ? 'NOT_CHECKED' : checkedRevision !== null && checkedRevision === delivered ? 'CHECKED' : 'PARTLY_CHECKED',
    checkedRevision,
    deliveredRevision: delivered,
    reviewStatus: last?.review?.status ?? null,
    looks: looked.length,
    findings: last?.review?.observations ?? [],
    corrections,
    checked: last?.review?.checked ?? [],
    notChecked: last?.review?.notChecked ?? [],
    ...(state.outline ? { outline: state.outline } : {}),
    knownDefects,
  }
}
