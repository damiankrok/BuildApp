/**
 * v3.54.2 pilot — the analyzer with a consultant: the transaction around `consultLabels`.
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
import { cropOf } from './tools.js'
import { DEFAULT_CONSULT_LIMITS, checkModel, consultLabels, overviewScale, validateProposals } from './loop.js'
import type { ConsultEvent, ConsultLimits, ConsultOutcome, ConsultSpend, ConsultantModel, Price, ProposalVerdict } from './loop.js'
import { labelProblemOf } from './problems.js'
import type { LabelProblem } from './problems.js'

export type ConsultantWiring = {
  model: ConsultantModel
  price: Price
  spend?: ConsultSpend
  limits?: ConsultLimits
  /** At most this many rounds that may change the model (brief §6: two). */
  maxRounds?: number
  /** R: ask and record only. C: consume. */
  variant: 'R' | 'C'
  record?: (e: ConsultEvent) => void
  /** The model's views for the post-build check (4B); absent: no check. Rendering is the host's (it owns the renderer). */
  views?: (run: AnalysisRun) => { png: Uint8Array; width: number; height: number; labels: string }
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
   * v3.54.2 candidate 2: the built ground extent (m, model X along the sheet, Z down it) against the largest consulted
   * whole dimension the metric layer admitted or found agreeing, per axis. Absent where nothing was consulted.
   */
  extent?: { modelX: number; modelZ: number; printedX?: number; printedY?: number }
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
  /** The post-build check of the final model (4B), read-only: its proposals have no consumer in this pilot. */
  modelCheck?: { review?: ConsultantReview; refused?: string; usd: number; verdicts: ProposalVerdict[]; revision: string }
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

export function stateOf(l: Local): RunState {
  const frameId = l.plans?.selectedPlanFrameId ?? undefined
  const sol = frameId ? l.metrics?.metricSolutions?.find((s) => s.frameId === frameId) : undefined
  const metric = sol ? { relation: sol.relation, confidence: sol.confidence, ...(sol.cmPerPixelX !== undefined ? { cmPerPixelX: sol.cmPerPixelX } : {}), ...(sol.cmPerPixelY !== undefined ? { cmPerPixelY: sol.cmPerPixelY } : {}) } : undefined
  if (l.run) return { outcome: 'COMPLETED', ...(frameId ? { frameId } : {}), ...(metric ? { metric } : {}), modelHash: l.run.reconstruction.candidate.modelHash, masses: l.run.reconstruction.building.masses.length }
  const f = l.error?.failure()
  return { outcome: 'FAILED', code: f?.code, reasonCode: f?.reasonCode ?? null, stage: f?.stage ?? null, ...(frameId ? { frameId } : {}), ...(metric ? { metric } : {}) }
}

/** How far a built extent may be from the printed overall dimension that settled the scale (the size class NEAR is 10 %). */
export const EXTENT_TOLERANCE = 0.05

/** The built extent disagrees with a consulted overall dimension on some axis: the reason, else undefined. */
export function extentContradiction(s: RunState): string | undefined {
  const e = s.extent
  if (!e) return undefined
  const off = (built: number, printed?: number): number | undefined => (printed && printed > 0 ? Math.abs(built - printed) / printed : undefined)
  const dx = off(e.modelX, e.printedX)
  const dz = off(e.modelZ, e.printedY)
  if (dx !== undefined && dx > EXTENT_TOLERANCE) return `EXTENT_CONTRADICTS: the model is ${e.modelX.toFixed(2)} m along the sheet where the consulted overall dimension says ${(e.printedX as number).toFixed(2)} m (${Math.round(dx * 100)} %)`
  if (dz !== undefined && dz > EXTENT_TOLERANCE) return `EXTENT_CONTRADICTS: the model is ${e.modelZ.toFixed(2)} m down the sheet where the consulted overall dimension says ${(e.printedY as number).toFixed(2)} m (${Math.round(dz * 100)} %)`
  return undefined
}

/**
 * ACCEPT / ROLLBACK / PARTIAL of a candidate against the last good state (PROTOCOL_V3542 §4), and (candidate 2, after
 * the confirmation) no ACCEPT whose built extent contradicts the consulted overall dimensions that settled its scale.
 */
export function compareRuns(before: RunState, after: RunState): { decision: RoundRecord['decision']; why: string } {
  const v = compareRunsScale(before, after)
  if (v.decision !== 'ACCEPT') return v
  const why = extentContradiction(after)
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
  }
  if (ra < rb) return { decision: 'ROLLBACK', why: `the scale is less settled than before (${before.metric?.confidence} → ${after.metric?.confidence})` }
  return { decision: 'ROLLBACK', why: 'a different model with no better-settled scale: kept the one before' }
}

/** The lowest storey's slab extent (m) of a model: X along the sheet, Z down it. */
function groundExtent(run: AnalysisRun): { x: number; z: number } | undefined {
  const model = run.reconstruction.model as unknown as { levels?: Array<{ id: string; index: number }>; slabs?: Array<{ levelId?: string; polygon?: Array<{ x: number; z: number }> }> }
  const lowest = [...(model.levels ?? [])].sort((a, b) => a.index - b.index)[0]
  const pts = (model.slabs ?? []).filter((s) => s.levelId === lowest?.id).flatMap((s) => s.polygon ?? [])
  if (pts.length === 0) return undefined
  const xs = pts.map((p) => p.x)
  const zs = pts.map((p) => p.z)
  return { x: Math.max(...xs) - Math.min(...xs), z: Math.max(...zs) - Math.min(...zs) }
}

/** The largest consulted whole dimension per sheet axis that the metric layer admitted or found agreeing (m). */
function consultedOverall(metrics: MetricEvidenceSet | undefined, spans: readonly ConsultedSpan[]): { x?: number; y?: number } {
  const out: { x?: number; y?: number } = {}
  for (const o of metrics?.consultedSpans ?? []) {
    if ((o.status !== 'ADMITTED' && o.status !== 'AGREES_ONLY') || o.valueCm === undefined) continue
    const sp = spans.find((s) => s.proposalId === o.proposalId)
    if (!sp) continue
    const axis = Math.abs(sp.to.x - sp.from.x) >= Math.abs(sp.to.y - sp.from.y) ? 'x' : 'y'
    out[axis] = Math.max(out[axis] ?? 0, o.valueCm / 100)
  }
  return out
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

/**
 * The service entrypoint of the pilot: LOCAL first, then at most `maxRounds` consultations, each consumed (C) or only
 * recorded (R). Never throws because of the consultant: its failure is a round record, and the LOCAL result stands.
 */
export async function consultAnalysis(input: AnalysisInput, options: AnalysisOptions, wiring: ConsultantWiring): Promise<ConsultedAnalysis> {
  const record = wiring.record ?? (() => undefined)
  const now = options.now ?? (() => new Date())
  const limits = wiring.limits ?? DEFAULT_CONSULT_LIMITS
  const maxRounds = wiring.maxRounds ?? 2
  record({ at: now().toISOString(), kind: 'PATH', path: 'CONSULTANT', variant: wiring.variant, globalDescription: 'DISABLED', contract: CONSULTANT_CONTRACT_VERSION, prompt: CONSULTANT_PROMPT_VERSION, model: wiring.model.model })
  const local = await attempt(input, { ...options, consulted: undefined, consultedSpans: undefined, crossAxisWitness: undefined })
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
    const candidate = await attempt({ kind: 'PACKAGE', pkg, graph }, { ...options, consulted: merged, consultedSpans: mergedSpans, crossAxisWitness: true })
    const after = stateOf(candidate)
    if (candidate.run) {
      const g = groundExtent(candidate.run)
      const printed = consultedOverall(candidate.metrics, mergedSpans)
      if (g && (printed.x !== undefined || printed.y !== undefined)) after.extent = { modelX: g.x, modelZ: g.z, ...(printed.x !== undefined ? { printedX: printed.x } : {}), ...(printed.y !== undefined ? { printedY: printed.y } : {}) }
    }
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
  // 4B: the final model against the source's plan and elevations, read-only
  let modelCheck: ConsultedAnalysis['modelCheck']
  if (wiring.views && good.run && good.pkg && good.graph) {
    try {
      const frameId = good.plans?.selectedPlanFrameId ?? undefined
      const fr = frameId ? await frameRaster(good.pkg, good.graph, frameId, options) : undefined
      if (fr?.raster && frameId) {
        const plan = cropOf(fr.raster, frameId, { x0: 0, y0: 0, x1: fr.raster.width, y1: fr.raster.height }, { minSide: 1, maxScale: 1 })
        const elevations: Array<{ img: ReturnType<typeof cropOf>; label: string }> = []
        for (const f of good.graph.coordinateFrames.filter((x) => x.roles.projection === 'ORTHOGRAPHIC_ELEVATION').slice(0, 6)) {
          const er = await frameRaster(good.pkg, good.graph, f.id, options)
          if (er?.raster) elevations.push({ img: cropOf(er.raster, f.id, { x0: 0, y0: 0, x1: er.raster.width, y1: er.raster.height }, { minSide: 1, maxScale: 1 }), label: `elevation sheet ${elevations.length + 1}${f.roles.view && f.roles.view !== 'NOT_APPLICABLE' && f.roles.view !== 'UNKNOWN' ? `, the publisher's role says ${f.roles.view}` : ''}` })
        }
        const revision = good.run.reconstruction.candidate.modelHash.slice(0, 12)
        const v = wiring.views(good.run)
        const res = await checkModel({ baseRevision: revision, plan, elevations, views: v, model: wiring.model, price: wiring.price, ...(wiring.spend ? { spend: wiring.spend } : {}), limits, record: (e) => record({ ...e, round: 'model-check' }), ...(options.signal ? { signal: options.signal } : {}), now })
        usd += res.usd
        const verdicts: ProposalVerdict[] = (res.review?.proposedCorrections ?? []).map((p) => ({ proposalId: p.proposalId, targetId: p.targetId, literal: p.proposed?.literal ?? '', status: 'CAPABILITY_MISSING', why: `${p.operation}: no consumer in the analyzer for this correction family in the pilot` }))
        modelCheck = { ...(res.review ? { review: res.review } : {}), ...(res.refused ? { refused: res.refused } : {}), usd: res.usd, verdicts, revision }
        record({ at: now().toISOString(), kind: 'MODEL_CHECK', revision, status: res.review?.status ?? null, verdicts })
      }
    } catch (e) {
      modelCheck = { refused: `${(e as Error).name}: ${(e as Error).message.slice(0, 300)}`, usd: 0, verdicts: [], revision: '' }
      record({ at: now().toISOString(), kind: 'MODEL_CHECK_FAILED', why: modelCheck.refused })
    }
  }
  const finalState = stateOf(good)
  record({ at: now().toISOString(), kind: 'FINAL', local: localState, final: finalState, usd, readings })
  return { contract: CONSULTANT_CONTRACT_VERSION, prompt: CONSULTANT_PROMPT_VERSION, variant: wiring.variant, ...(good.run ? { run: good.run } : {}), ...(good.error ? { error: good.error } : {}), local: localState, final: finalState, rounds, readings: good === local ? [] : readings, spans: good === local ? [] : spans, usd, ...(modelCheck ? { modelCheck } : {}), globalDescription: 'DISABLED' }
}
