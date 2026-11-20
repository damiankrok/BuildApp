/**
 * v3.54.17 R2 (audit §3, P0) — the body built when LOCAL built no model (BUILD_MASSING on the empty model, from the plan
 * outline and the elevation sketches) delivered as an ordinary analysis: a real `LinkAnalysisResult` with its candidate,
 * model and scene through the shared envelope (`programmed-result.ts`), and an `AnalysisRun` the consultant path's review
 * loop looks at like any other — so the final look judges exactly the revision the phone gets.
 *
 * Nothing is rebuilt by the drawings' solver (that would put LOCAL's failure back in place of the new body). What the
 * result says is what BUILD_MASSING established: the outline SOURCE_TRACED at the analyzer's confirmed scale, heights
 * SOURCE_DERIVED from the registered sketches, the miniature's thicknesses DISPLAY_ASSUMPTION; no room and no opening is
 * built, so the interior is NOT_CHECKED (never PASS) and quantities are LIMITED at most.
 */
import { createEmptyModel, serializeModel } from '@buildapp/model'
import type { CanonicalBuildingModel } from '@buildapp/model'
import type { BuildingCommand } from '@buildapp/commands'
import { runCommands } from '@buildapp/commands'
import { sha256Hex, stableJson } from '@buildapp/source-common'
import type { SourcePackage } from '@buildapp/source-package'
import type { SourceObservationGraph } from '@buildapp/source-observations'
import type { MetricEvidenceSet } from '@buildapp/source-metrics'
import type { AnalysisIdentity } from '../identity.js'
import type { AnalysisRun } from '../run.js'
import type { AnalysisWarning } from '../warnings.js'
import { measurementOf } from '../measurement.js'
import { programmedResult } from '../programmed-result.js'
import type { ProgrammedUnchecked, ProgrammedUnresolved } from '../programmed-result.js'
import { MASSING_OPS_VERSION } from './massing/ops.js'
import { MINIATURE_CONVENTIONS } from './massing/massing.js'
import type { MassingHypothesis } from './massing/massing.js'
import { PLAN_OUTLINE_VERSION } from './plan-outline.js'
import type { PlanOutlineRead } from './plan-outline.js'
import { CORRECTION_EXECUTOR_VERSION } from './correct/execute.js'
import type { BindView, PatchRecord } from './correct/execute.js'

export const MASSING_RESULT_VERSION = '1.0.0' as const

export type MassingRunInput = {
  pkg: SourcePackage
  graph: SourceObservationGraph
  metrics?: MetricEvidenceSet
  plans?: AnalysisRun['planDiagnostics']
  identity: AnalysisIdentity
  sourceUrl: string
  jobId: string | null
  /** The committed BUILD_MASSING record (its commands are the program) and the model the executor built. */
  record: PatchRecord
  executorModel: CanonicalBuildingModel
  plan: Pick<PlanOutlineRead, 'frameId' | 'check' | 'observation' | 'version' | 'promptVersion'> & { scale?: { mPerPx: number; why: string } }
  localFailure: { code: string; reasonCode?: string | null }
  outlineModel: string
  sketches: { attempted: number; used: number; frameIds: string[] }
  /** The model delivered when registry patches stand on the program's (a later look's corrections). */
  delivered?: CanonicalBuildingModel
  startedAt: string
  now: () => Date
}

export type MassingRun = { run: AnalysisRun; views: BindView[]; base: CanonicalBuildingModel }

const WARN = (code: string, severity: AnalysisWarning['severity'], message: string): AnalysisWarning => ({ code, severity, message })
const shoelace = (p: ReadonlyArray<{ x: number; z: number }>): number => Math.abs(p.reduce((s, a, i) => s + a.x * p[(i + 1) % p.length].z - p[(i + 1) % p.length].x * a.z, 0)) / 2

/**
 * The program is the committed record's commands, from the empty model. They must rebuild the executor's model byte for
 * byte (under the executor's own empty model) — otherwise the record is not what was built and nothing is delivered.
 */
export function massingProgramOf(record: PatchRecord, executorModel: CanonicalBuildingModel): BuildingCommand[] | undefined {
  const program = record.commands ?? []
  if (program.length === 0) return undefined
  try {
    const again = runCommands(createEmptyModel(executorModel.id, executorModel.name ?? ''), program)
    return sha256Hex(serializeModel(again)) === sha256Hex(serializeModel(executorModel)) ? program : undefined
  } catch {
    return undefined
  }
}

export function massingRun(input: MassingRunInput): MassingRun | undefined {
  const program = massingProgramOf(input.record, input.executorModel)
  if (!program) return undefined
  const hyp = (input.record.massing as { hypothesis?: MassingHypothesis } | undefined)?.hypothesis
  const bodies = hyp?.bodies ?? []
  const views = hyp?.views ?? []
  const outline = input.plan.observation?.outline ?? []
  const outlineM2 = Math.round(shoelace(outline) * 100) / 100
  const published = input.plan.check?.publishedM2
  const unresolved: ProgrammedUnresolved[] = [
    { id: 'massing-local', what: 'the drawings solver (LOCAL)', reason: `LOCAL built no model (${input.localFailure.code}${input.localFailure.reasonCode ? `/${input.localFailure.reasonCode}` : ''}); this body was built without it`, status: 'REFUSED', observationIds: [] },
    ...(hyp?.missing ?? []).map((m, i) => ({ id: `massing-missing-${i + 1}`, what: m.anchor, reason: m.why.slice(0, 300), status: 'MISSING' as const, observationIds: [] })),
    ...(hyp?.alternatives ?? []).map((a, i) => ({ id: `massing-alternative-${i + 1}`, what: 'another reading of the body', reason: a.slice(0, 300), status: 'NOT_ATTEMPTED' as const, observationIds: [] })),
    { id: 'massing-interior', what: 'the interior (rooms, partitions, stairs, storeys inside)', reason: 'NOT_CHECKED: the plan outline and the elevations give the exterior only; nothing inside was read or built', status: 'NOT_ATTEMPTED', observationIds: [] },
  ]
  const openings = (input.delivered ?? input.executorModel).openings.length
  const scaleWhy = input.plan.scale?.why ?? 'the analyzer\'s plan scale'
  const warningDetails: AnalysisWarning[] = [
    WARN('MODEL_FROM_PLAN_OUTLINE_AND_ELEVATIONS', 'LIMITING', `LOCAL built no model (${input.localFailure.code}${input.localFailure.reasonCode ? `/${input.localFailure.reasonCode}` : ''}). This exterior was built from the plan's outline (read by ${input.outlineModel}, SOURCE_TRACED, at ${scaleWhy}) and ${input.sketches.used} of ${input.sketches.attempted} elevation sketch(es) registered by the plan's width (BUILD_MASSING ${MASSING_OPS_VERSION}): ${bodies.length} body/bodies; heights are read off the sketches (SOURCE_DERIVED).`.slice(0, 700)),
    WARN('MASSING_CONVENTIONS', 'INFO', `Miniature conventions, not read from the source (DISPLAY_ASSUMPTION): wall ${MINIATURE_CONVENTIONS.wallThicknessM} m, parapet ${MINIATURE_CONVENTIONS.parapetM} m, flat roof ${MINIATURE_CONVENTIONS.flatRoofThicknessM} m, pitched roof ${MINIATURE_CONVENTIONS.roofThicknessM} m.`),
    WARN('MASSING_INTERIOR_NOT_CHECKED', 'LIMITING', 'The interior is NOT_CHECKED: no room, partition, stair or upper floor was read or built; nothing about it is a PASS.'),
    ...(openings === 0 ? [WARN('MASSING_OPENINGS_NOT_BUILT', 'LIMITING', 'No window or door is built: the body is walls and roofs; openings are left to the review of this revision.')] : []),
    ...(typeof published === 'number' ? [WARN('MASSING_OUTLINE_AREA', 'INFO', `The traced outline is ${outlineM2} m² against the published footprint ${published} m² (${input.plan.check?.share !== undefined ? `${Math.round(input.plan.check.share * 1000) / 10} %` : '—'}): a check of the trace, never a scale anchor (the definitions of the two areas may differ).`)] : []),
    WARN('MASSING_QUANTITIES_LIMITED', 'LIMITING', 'Quantities from this model: LIMITED. Lengths and areas of the outline are traced at the plan scale; heights come from sketches; the interior is not built. It is a model for viewing the exterior mass, not a bill of quantities.'),
  ]
  const frames = new Set([input.plan.frameId, ...input.sketches.frameIds])
  const unchecked: ProgrammedUnchecked[] = [...frames].flatMap((id) => {
    const f = input.graph.coordinateFrames.find((x) => x.id === id)
    if (!f) return []
    const kind = f.roles.projection === 'ORTHOGRAPHIC_ELEVATION' ? 'ELEVATION' : f.roles.projection === 'ORTHOGRAPHIC_SECTION' ? 'SECTION' : f.roles.projection === 'ORTHOGRAPHIC_PLAN' ? 'PLAN' : 'PERSPECTIVE'
    return [{ kind, extent: 'NONE', assetId: f.assetId, reason: id === input.plan.frameId ? 'its outline was traced for the body; the drawings path\'s pixel relations were not run on this model' : 'sketched for the body\'s silhouette; the drawings path\'s pixel relations were not run on this model' } as ProgrammedUnchecked]
  })
  const cmPerPx = input.plan.scale ? input.plan.scale.mPerPx * 100 : undefined
  const measurement = measurementOf({ builtM2: outlineM2, ...(typeof published === 'number' ? { publishedFootprintM2: published } : {}), ...(input.plan.scale ? { builtMetresPerPixel: input.plan.scale.mPerPx } : {}), ...(cmPerPx ? { metric: { cmPerPixelX: cmPerPx, confidence: 'STRONG' } } : {}), completeness: 'EXTERIOR_ONLY', completenessWhy: 'a body from the plan outline and the elevations: no interior' })
  measurement.reasons.push({ code: 'INTERIOR_NOT_CHECKED', consequence: 'no room or partition is built: no interior quantity may be taken off this model' })
  if (measurement.quantities === 'USABLE_IN_SCOPE' || measurement.quantities === 'NOT_ASSESSED') measurement.quantities = 'LIMITED'
  const out = programmedResult({
    pkg: input.pkg,
    identity: input.identity,
    sourceUrl: input.sourceUrl,
    jobId: input.jobId,
    label: `${input.identity.title} (body from the plan outline and elevations)`,
    program,
    ...(input.delivered ? { delivered: input.delivered } : {}),
    candidate: {
      observationGraphId: input.graph.id,
      observationGraphHash: input.graph.contentHash,
      metricEvidenceId: `plan-outline-${PLAN_OUTLINE_VERSION}`,
      metricEvidenceHash: sha256Hex(stableJson({ outline: input.plan.observation ?? null, scale: input.plan.scale ?? null, metrics: input.metrics?.contentHash ?? null })),
      hypothesisSetId: 'massing-hypothesis',
      hypothesisSetHash: sha256Hex(stableJson(hyp ?? null)),
      structuralLayoutId: 'massing-bodies',
      structuralLayoutHash: sha256Hex(stableJson(bodies)),
      solver: { name: 'massing', version: `${MASSING_OPS_VERSION}+executor-${CORRECTION_EXECUTOR_VERSION}+result-${MASSING_RESULT_VERSION}` },
    },
    unresolved,
    kernelRefusals: [],
    warningDetails,
    counts: { observations: 1 + input.sketches.used, frames: frames.size, metricEvidence: input.metrics?.evidence.length ?? 0, masses: bodies.length },
    quality: () => ({ levels: { L0: bodies.length, L1: 0, L2: 0 }, byFamily: {} }),
    provisional: [
      { code: 'EXTERIOR_ONLY', what: 'the interior is not built: walls and roofs of the exterior mass only' },
      { code: 'MINIATURE_CONVENTIONS', what: `wall, parapet and roof thicknesses are conventions (${MINIATURE_CONVENTIONS.wallThicknessM} / ${MINIATURE_CONVENTIONS.parapetM} / ${MINIATURE_CONVENTIONS.roofThicknessM} m)` },
      ...bodies.map((b) => ({ code: 'BODY', what: `${b.id}: ${b.roof.kind}${b.roof.pitchDeg !== undefined ? ` ${Math.round(b.roof.pitchDeg)}°` : ''}, eaves ${b.roof.eavesM} m${b.roof.ridgeM !== undefined ? `, ridge ${b.roof.ridgeM} m` : ''}` })),
    ],
    unchecked,
    notes: {
      technical: 'technical validity of the body built without LOCAL: what the validator, the compiler and the joint audit say of it',
      decomposition: 'no room decomposition: the body is its exterior (interior NOT_CHECKED)',
      sourceFidelity: 'the body was built from the traced outline and the registered sketches; the review of this revision against the source pictures is in sourceCheck; the drawings path\'s pixel relations were not run',
      registration: `the elevations were registered by the plan's width (${views.length} view(s)); vertical = horizontal scale (DISPLAY_ASSUMPTION, checked by the views' agreement)`,
      summary: (e) => `Body from the plan outline and elevations: ${bodies.length} body/bodies, ${e} technical error(s), interior NOT_CHECKED.`,
    },
    residualsOutsideTolerance: 0,
    vision: { mode: 'LIVE_PROVIDER', provider: `anthropic-messages:${input.outlineModel}`, attempted: 1 + input.sketches.attempted, accepted: 1 + input.sketches.used },
    analyzer: { service: `massing-${MASSING_RESULT_VERSION}`, solver: `massing-ops-${MASSING_OPS_VERSION}+plan-outline-${PLAN_OUTLINE_VERSION}+executor-${CORRECTION_EXECUTOR_VERSION}` },
    measurement,
    startedAt: input.startedAt,
    now: input.now,
  })
  const model = out.result.model
  // the run the consultant path reads: the result, its sources, and the reconstruction's few members the loop uses
  // (model, candidate, bodies); no registration of the drawings' solver exists for it, and none is pretended
  const reconstruction = { model, candidate: out.candidate, building: { masses: bodies.map((b) => ({ id: b.id })), dormers: [] }, facadeAlignment: { views: [] }, registrations: { plans: [], cameras: [], elevations: views.map((v) => ({ frameId: v.frameId, side: v.side })) }, roofFeatures: [], partialPreview: undefined } as unknown as AnalysisRun['reconstruction']
  const run = { result: out.result, pkg: input.pkg, graph: input.graph, metrics: input.metrics, reconstruction, sceneText: out.sceneText, closure: out.closure, timings: {}, trace: { steps: [] }, planDiagnostics: input.plans ?? { plans: [], selectedPlanFrameId: input.plan.frameId }, phases: [] } as unknown as AnalysisRun
  return { run, views, base: out.base }
}
