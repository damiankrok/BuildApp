/**
 * N9-01: the model assessment of one run — three axes, computed on the model the run delivers and its compiled scene,
 * never on the solver's pre-emission building. See `types.ts` for what each axis means and does not mean.
 */
import type { CanonicalBuildingModel } from '@buildapp/model'
import type { ClosureReport, CompiledScene } from '@buildapp/geometry'
import type { ModelCompleteness, ReconstructionV2Result } from '@buildapp/reconstruction'
import type { Raster } from '@buildapp/source-cv'
import type { SourceCoordinateFrame } from '@buildapp/source-observations'
import { technicalValidityOf } from './technical.js'
import { roofLayersRelation } from './roof-layers.js'
import { planRelations } from './plan-ink.js'
import type { PlanRelations, PlanSheetInput } from './plan-ink.js'
import { elevationRelation } from './elevations.js'
import { sourceUncheckedOf } from './unchecked.js'
import { MODEL_ASSESSMENT_SCHEMA_VERSION, combineStatus, countStatuses } from './types.js'
import type { ModelAssessment, RelationResult, SourceFidelity } from './types.js'

export * from './types.js'
export { technicalValidityOf } from './technical.js'
export { roofLayersRelation, ROOF_GRID_M, EDGE_TOLERANCE_M, GAP_TOLERANCE_M } from './roof-layers.js'
export type { RoofCellClass } from './roof-layers.js'
export { planRelations, readStoreyInk, storeyOutline, thickInk, storeyPolygons, REGISTRATION_SUPPORT_MIN } from './plan-ink.js'
export type { PlanRelations, PlanSheetInput, StoreyInk, StoreyOutline, WallInkReading } from './plan-ink.js'
export { elevationRelation, classifyResidual, emittedIds, DISAGREE_SHARE, STABLE_FEATURES } from './elevations.js'
export { sourceUncheckedOf } from './unchecked.js'

export type AssessmentInput = {
  model: CanonicalBuildingModel
  scene: Pick<CompiledScene, 'meshes' | 'diagnostics'>
  closure: Pick<ClosureReport, 'findings'>
  reconstruction: Pick<ReconstructionV2Result, 'partialPreview' | 'modelCompleteness' | 'viewAudit' | 'residuals' | 'crossViewResiduals' | 'facadeAlignment' | 'registrations' | 'planDiagnostics' | 'heights'> & { building: { openings: ReadonlyArray<{ id: string; facade: string }> } }
  frames: readonly SourceCoordinateFrame[]
  raster: (frame: { variantByteHash: string }) => Raster | undefined
}

const DECOMPOSITION_MEANING = 'completeness of the reading: how much of the analyzer’s own accepted decomposition the model holds — not agreement with the drawings'
const FIDELITY_MEANING = 'relations between the delivered model and the drawings; UNCHECKED is not PASS, and a CONFLICT does not withdraw the model'

export function assessModelDetailed(input: AssessmentInput, options: { keepMasks?: boolean } = {}): { assessment: ModelAssessment; plans: PlanRelations } {
  const { model, reconstruction: r } = input
  const technicalValidity = technicalValidityOf({ model, scene: input.scene, closure: input.closure, refusals: r.partialPreview?.failures ?? [], replay: 'BYTE_IDENTICAL' })
  const completeness: ModelCompleteness | undefined = r.modelCompleteness
  const frameById = new Map(input.frames.map((f) => [f.id, f]))
  const sheets: PlanSheetInput[] = r.registrations.plans.map((p) => {
    const frame = frameById.get(p.frameId)
    return { frameId: p.frameId, assetId: p.assetId, storeyIndex: p.storeyIndex, mppX: p.mppX, mppY: p.mppY, wallPx: p.wallPx, toPixel: p.toPixel, raster: frame ? input.raster(frame) : undefined }
  })
  const plans = planRelations(model, sheets, options)
  const relations: RelationResult[] = [
    roofLayersRelation(model, input.scene),
    plans.r3,
    plans.r4,
    elevationRelation({ model, viewAudit: r.viewAudit, residuals: r.residuals, crossView: r.crossViewResiduals, facadeAlignment: r.facadeAlignment, openings: r.building.openings }),
  ]
  const conflicts = relations.flatMap((rel) => rel.items.filter((i) => i.status === 'CONFLICT').map((i) => `${rel.id}: ${i.why}`))
  const sourceFidelity: SourceFidelity = { status: combineStatus(relations), relations, counts: countStatuses(relations), conflicts, meaning: FIDELITY_MEANING }
  const sourceUnchecked = sourceUncheckedOf({
    frames: input.frames,
    viewAudit: r.viewAudit,
    registeredPlans: r.registrations.plans.map((p) => ({ frameId: p.frameId, storeyIndex: p.storeyIndex })),
    skippedPlans: r.planDiagnostics.skipped ?? [],
    ...(r.registrations.section ? { sectionFrameId: r.registrations.section.frameId } : {}),
    heightsMeasured: r.heights.measured,
    relations,
  })
  const verdict = completeness?.verdict ?? 'NOT_ASSESSED'
  const items = relations.flatMap((x) => x.items)
  const summary = [
    technicalValidity.status === 'VALID' ? 'technically valid' : `${technicalValidity.errors} technical error${technicalValidity.errors === 1 ? '' : 's'}`,
    `reading completeness ${verdict}`,
    `source fidelity ${sourceFidelity.status}: ${items.filter((i) => i.status === 'CONFLICT').length} conflict(s), ${items.filter((i) => i.status === 'PASS').length} pass, ${items.filter((i) => i.status === 'UNCHECKED').length} unchecked`,
    `${sourceUnchecked.counts.total} source item(s) not compared`,
    'the 3D model is shown in every case',
  ].join('; ')
  return {
    assessment: {
      schema: 'buildapp.model-assessment',
      schemaVersion: MODEL_ASSESSMENT_SCHEMA_VERSION,
      technicalValidity,
      decompositionCompleteness: { verdict, basis: 'ACCEPTED_DECOMPOSITION', meaning: DECOMPOSITION_MEANING },
      sourceFidelity,
      sourceUnchecked,
      previewAvailable: true,
      summary,
    },
    plans,
  }
}

export function assessModel(input: AssessmentInput): ModelAssessment {
  return assessModelDetailed(input).assessment
}
