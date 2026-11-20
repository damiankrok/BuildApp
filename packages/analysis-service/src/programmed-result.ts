/**
 * v3.54.17 R2 (audit §3): one envelope for a model that the drawings' solver did not build — the whole-house description
 * (`house/link.ts`) and the body built from the plan outline and the elevations when LOCAL built none (BUILD_MASSING,
 * `consult/massing-result.ts`). Both are a PROGRAM of the kernel's commands; this seals that program as the candidate,
 * compiles the delivered model, packs the scene the phone downloads, audits its joints and fills the same
 * `LinkAnalysisResult` the drawings' path delivers (`run.ts`), so `analysisFilesOf` serializes it the same way.
 *
 * What the producer knows and this does not is passed in: its provenance hashes, what it could not settle, its warnings,
 * its counts, its preview's provisional items and what of the sources was not held against the model. Nothing here is
 * claimed that the producer did not establish: the source fidelity of such a model is UNCHECKED by the drawings path's
 * pixel relations, and its room decomposition is NOT_ASSESSED.
 *
 * `delivered` is the model handed to the phone when it differs from the program's (registry patches on top of it); the
 * candidate keeps describing its base, as `run.ts` does with a patched model.
 */
import { compileBuilding, geometryClosureAudit } from '@buildapp/geometry'
import type { ClosureReport } from '@buildapp/geometry'
import { buildMobileSceneBundle, serializeBundle, sha256 } from '@buildapp/mobile-scene'
import { parseModel, serializeModel } from '@buildapp/model'
import type { CanonicalBuildingModel } from '@buildapp/model'
import type { BuildingCommand } from '@buildapp/commands'
import { sealCandidate } from '@buildapp/reconstruction'
import type { ReconstructionCandidate } from '@buildapp/reconstruction'
import type { SourcePackage } from '@buildapp/source-package'
import type { AnalysisIdentity } from './identity.js'
import type { LinkAnalysisResult } from './result.js'
import type { AnalysisWarning } from './warnings.js'
import { MODEL_ASSESSMENT_SCHEMA_VERSION } from './assessment/types.js'
import type { ModelAssessment } from './assessment/types.js'
import type { MeasurementAssessment } from './measurement.js'

export type ProgrammedUnresolved = { id: string; what: string; reason: string; status: 'NOT_ATTEMPTED' | 'REFUSED' | 'MISSING'; observationIds: string[] }
export type ProgrammedUnchecked = { kind: 'PLAN' | 'ELEVATION' | 'SECTION' | 'PERSPECTIVE'; extent: 'NONE'; assetId: string; reason: string }

export type ProgrammedResultInput = {
  pkg: SourcePackage
  identity: AnalysisIdentity
  sourceUrl: string
  jobId: string | null
  label: string
  program: BuildingCommand[]
  /** The model delivered when it is not the program's own (patches on top); absent: the program's model. */
  delivered?: CanonicalBuildingModel
  candidate: {
    observationGraphId: string
    observationGraphHash: string
    metricEvidenceId: string
    metricEvidenceHash: string
    hypothesisSetId: string
    hypothesisSetHash: string
    structuralLayoutId: string
    structuralLayoutHash: string
    solver: { name: string; version: string }
  }
  unresolved: ProgrammedUnresolved[]
  /** The kernel's refusals while the producer built (counted as technical errors). */
  kernelRefusals: ReadonlyArray<{ codes: string[]; id?: string | null; message: string }>
  warningDetails: AnalysisWarning[]
  counts: { observations: number; frames: number; metricEvidence: number; masses: number }
  quality: (model: CanonicalBuildingModel) => LinkAnalysisResult['quality']
  provisional: Array<{ code: string; what: string }>
  unchecked: ProgrammedUnchecked[]
  notes: { technical: string; decomposition: string; sourceFidelity: string; registration: string; summary: (technicalErrors: number) => string }
  residualsOutsideTolerance: number
  vision: LinkAnalysisResult['vision']
  analyzer: LinkAnalysisResult['analyzer']
  measurement?: MeasurementAssessment
  startedAt: string
  now: () => Date
}

export type ProgrammedResult = { result: LinkAnalysisResult; sceneText: string; candidate: ReconstructionCandidate; base: CanonicalBuildingModel; closure: ClosureReport }

export function programmedResult(input: ProgrammedResultInput): ProgrammedResult {
  const { pkg, identity } = input
  const { candidate, model: base } = sealCandidate(
    {
      schema: 'buildapp.reconstruction-candidate',
      schemaVersion: '1.1.0',
      label: identity.label,
      modelId: identity.modelId,
      sourcePackageId: pkg.id,
      sourcePackageHash: pkg.contentHash,
      observationGraphId: input.candidate.observationGraphId,
      observationGraphHash: input.candidate.observationGraphHash,
      metricEvidenceId: input.candidate.metricEvidenceId,
      metricEvidenceHash: input.candidate.metricEvidenceHash,
      hypothesisSetId: input.candidate.hypothesisSetId,
      hypothesisSetHash: input.candidate.hypothesisSetHash,
      structuralLayoutId: input.candidate.structuralLayoutId,
      structuralLayoutHash: input.candidate.structuralLayoutHash,
      structuralStatus: 'STRUCTURAL_LAYOUT_PARTIAL',
      solver: input.candidate.solver,
      program: input.program,
      quantities: [],
      contradictions: [],
      unresolved: input.unresolved,
      traces: [],
      steps: [],
      residuals: { metricRmsM: 0, metricMaxM: 0, hard: 0, soft: 0, unresolved: input.unresolved.length },
    } as unknown as Omit<ReconstructionCandidate, 'id' | 'contentHash' | 'modelHash'>,
    identity.slug,
  )
  const model = input.delivered ?? base
  const modelText = serializeModel(model)
  const scene = compileBuilding(parseModel(modelText) as never)
  const bundle = buildMobileSceneBundle(model, { scene })
  const sceneText = serializeBundle(bundle)
  const closure = geometryClosureAudit(model, scene)
  const compileErrors = scene.diagnostics.filter((x) => x.severity === 'ERROR')
  const exteriorErrors = closure.findings.filter((f) => f.scope === 'EXTERIOR' && f.severity === 'ERROR').length
  const byDocument: Record<string, number> = {}
  for (const a of pkg.assets) byDocument[a.roles.document] = (byDocument[a.roles.document] ?? 0) + 1
  const technicalErrors = compileErrors.length + exteriorErrors + input.kernelRefusals.length
  const byKind: Record<string, number> = {}
  for (const u of input.unchecked) byKind[u.kind] = (byKind[u.kind] ?? 0) + 1
  const assessment = {
    schema: 'buildapp.model-assessment',
    schemaVersion: MODEL_ASSESSMENT_SCHEMA_VERSION,
    technicalValidity: {
      status: technicalErrors > 0 ? 'ERRORS' : 'VALID',
      errors: technicalErrors,
      warnings: scene.diagnostics.filter((x) => x.severity === 'WARNING').length,
      checks: [
        { check: 'PROGRAM_REFUSALS', errors: input.kernelRefusals.length, warnings: 0, findings: input.kernelRefusals.slice(0, 12).map((r) => ({ code: r.codes[0] ?? 'REFUSED', severity: 'ERROR' as const, ...(r.id ? { objectId: r.id } : {}), message: r.message })) },
        { check: 'COMPILER', errors: compileErrors.length, warnings: 0, findings: compileErrors.slice(0, 12).map((e) => ({ code: e.code, severity: 'ERROR' as const, message: String((e as { message?: string }).message ?? '') })) },
        { check: 'CLOSURE', errors: exteriorErrors, warnings: 0, findings: [] },
      ],
      note: input.notes.technical,
    },
    decompositionCompleteness: { verdict: 'NOT_ASSESSED', basis: 'ACCEPTED_DECOMPOSITION', meaning: input.notes.decomposition },
    sourceFidelity: { status: 'UNCHECKED', relations: [], counts: { PASS: 0, CONFLICT: 0, UNCHECKED: input.unchecked.length }, conflicts: [], meaning: input.notes.sourceFidelity },
    sourceUnchecked: { items: input.unchecked, counts: { total: input.unchecked.length, byKind, none: input.unchecked.length, partial: 0 } },
    previewAvailable: true,
    elevationRegistration: { views: [], counts: { before: { FULL: 0, ALONG_ONLY: 0, VERTICAL_ONLY: 0, UNREGISTERED: 0 }, after: { FULL: 0, ALONG_ONLY: 0, VERTICAL_ONLY: 0, UNREGISTERED: 0 } }, slots: { before: 0, after: 0 }, lost: [], datums: { ridgeY: null, topFloorY: null }, note: input.notes.registration },
    summary: input.notes.summary(technicalErrors),
  } as unknown as ModelAssessment
  const result: LinkAnalysisResult = {
    schema: 'buildapp.link-analysis-result',
    schemaVersion: '1.0.0',
    jobId: input.jobId,
    sourceUrl: input.sourceUrl,
    canonicalUrl: pkg.canonicalUrl,
    title: identity.title,
    label: input.label,
    modelId: identity.modelId,
    publisher: pkg.project.publisher,
    adapter: { id: pkg.adapter.id, version: pkg.adapter.version },
    sourcePackageId: pkg.id,
    sourcePackageHash: pkg.contentHash,
    observationGraphHash: input.candidate.observationGraphHash,
    metricEvidenceHash: candidate.metricEvidenceHash,
    candidateHash: candidate.contentHash,
    modelHash: candidate.modelHash,
    modelSha256: sha256(modelText),
    sceneContentHash: bundle.contentHash,
    sceneSha256: sha256(sceneText),
    sceneBytes: Buffer.byteLength(sceneText, 'utf8'),
    counts: {
      assets: pkg.assets.length,
      assetsByDocument: byDocument,
      observations: input.counts.observations,
      frames: input.counts.frames,
      metricEvidence: input.counts.metricEvidence,
      callouts: 0,
      commands: candidate.program.length,
      masses: input.counts.masses,
      openings: model.openings.length,
      rooms: 0,
      balconies: model.balconies.length,
      terraces: 0,
      railings: model.railings.length,
      chimneys: model.chimneys.length,
      rooflights: model.rooflights.length,
      meshes: bundle.scene.meshes.length,
      triangles: bundle.scene.meshes.reduce((a, m) => a + m.positions.length / 9, 0),
    },
    quality: input.quality(model),
    unresolved: input.unresolved.map((u) => ({ what: u.what, reason: u.reason, status: u.status })),
    warnings: input.warningDetails.map((w) => w.message),
    warningDetails: input.warningDetails,
    preview: {
      outcome: input.kernelRefusals.length > 0 || compileErrors.length > 0 ? 'PARTIAL_3D_PREVIEW' : 'COMPLETE',
      built: { wallRings: model.wallRings.length, walls: model.walls.length, slabs: model.slabs.length, roofs: model.roofs.length, roofPlanes: model.roofPlanes.length, openings: model.openings.length, rooms: 0 },
      provisional: input.provisional,
      partial: null,
    } as unknown as LinkAnalysisResult['preview'],
    sourceBasis: null,
    vision: input.vision,
    verification: { replay: 'BYTE_IDENTICAL', residuals: 0, residualsOutsideTolerance: input.residualsOutsideTolerance, closure: { exteriorErrors, exteriorFindings: closure.metrics.exteriorFindingCount, interiorFindings: closure.metrics.interiorFindingCount } },
    assessment,
    ...(input.measurement ? { measurement: input.measurement } : {}),
    analyzer: input.analyzer,
    startedAt: input.startedAt,
    completedAt: input.now().toISOString(),
    candidate,
    model,
    scene: bundle,
  }
  return { result, sceneText, candidate, base, closure }
}
