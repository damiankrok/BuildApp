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
import { elevationAxes, solverClass } from './elevation-axes.js'
import type { ElevationAxes } from './elevation-axes.js'
import type { SourceObservation } from '@buildapp/source-observations'
import { MODEL_ASSESSMENT_SCHEMA_VERSION, combineStatus, countStatuses } from './types.js'
import type { ElevationRegistrationReport, ModelAssessment, RelationResult, SourceFidelity, ViewAxesSummary } from './types.js'

export * from './types.js'
export { technicalValidityOf } from './technical.js'
export { roofLayersRelation, ROOF_GRID_M, EDGE_TOLERANCE_M, GAP_TOLERANCE_M } from './roof-layers.js'
export type { RoofCellClass } from './roof-layers.js'
export { planRelations, readStoreyInk, storeyOutline, thickInk, storeyPolygons, REGISTRATION_SUPPORT_MIN } from './plan-ink.js'
export type { PlanRelations, PlanSheetInput, StoreyInk, StoreyOutline, WallInkReading } from './plan-ink.js'
export { elevationRelation, classifyResidual, emittedIds, DISAGREE_SHARE, STABLE_FEATURES } from './elevations.js'
export { sourceUncheckedOf } from './unchecked.js'
export { elevationAxes, solverClass, wallBands, apexOf, WALL_BAND_MIN_SHARE, WALL_BAND_MIN_WIDTH, GROUND_TOLERANCE_M, PLINTH_RANGE_M, OPPOSITE_SPAN_AGREEMENT, EXTENT_HEIGHT_MIN_SHARE, SHEET_SCALE_AGREEMENT, NARROW_SPIKE_M } from './elevation-axes.js'
export type { ElevationAxes, Anchor, AxisState, RegistrationClass } from './elevation-axes.js'
export { printedDatumsOf, terrainDatumOf } from './elevation-inputs.js'

export type AssessmentInput = {
  model: CanonicalBuildingModel
  scene: Pick<CompiledScene, 'meshes' | 'diagnostics'>
  closure: Pick<ClosureReport, 'findings'>
  reconstruction: Pick<ReconstructionV2Result, 'partialPreview' | 'modelCompleteness' | 'viewAudit' | 'residuals' | 'crossViewResiduals' | 'facadeAlignment' | 'registrations' | 'planDiagnostics' | 'heights' | 'world'> & { building: { openings: ReadonlyArray<{ id: string; facade: string }> } }
  frames: readonly SourceCoordinateFrame[]
  /** N9-02A: the observation graph's observations (the elevations' traced outlines) and the printed datums. */
  observations: readonly SourceObservation[]
  datums: { ridgeY?: number; terrainY?: number }
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
  const elevationRegistration = elevationRegistrationOf(input)
  const axesOf = new Map(elevationRegistration.views.map((v) => [v.frameId, summaryOfAxes(v)]))
  for (const i of relations.find((x) => x.id === 'R5_REGISTERED_ELEVATIONS')?.items ?? []) {
    const axes = i.source ? axesOf.get(i.source.frameId) : undefined
    if (axes) i.axes = axes
  }
  const sourceUnchecked = sourceUncheckedOf({
    frames: input.frames,
    viewAudit: r.viewAudit,
    registeredPlans: r.registrations.plans.map((p) => ({ frameId: p.frameId, storeyIndex: p.storeyIndex })),
    skippedPlans: r.planDiagnostics.skipped ?? [],
    ...(r.registrations.section ? { sectionFrameId: r.registrations.section.frameId } : {}),
    heightsMeasured: r.heights.measured,
    relations,
  })
  for (const i of sourceUnchecked.items) {
    const axes = i.kind === 'ELEVATION' && i.frameId ? axesOf.get(i.frameId) : undefined
    if (axes) i.registration = axes
  }
  const verdict = completeness?.verdict ?? 'NOT_ASSESSED'
  const items = relations.flatMap((x) => x.items)
  const summary = [
    technicalValidity.status === 'VALID' ? 'technically valid' : `${technicalValidity.errors} technical error${technicalValidity.errors === 1 ? '' : 's'}`,
    `reading completeness ${verdict}`,
    `source fidelity ${sourceFidelity.status}: ${items.filter((i) => i.status === 'CONFLICT').length} conflict(s), ${items.filter((i) => i.status === 'PASS').length} pass, ${items.filter((i) => i.status === 'UNCHECKED').length} unchecked`,
    `${sourceUnchecked.counts.total} source item(s) not compared`,
    `elevations: ${elevationRegistration.counts.after.FULL} full, ${elevationRegistration.counts.after.ALONG_ONLY} along only, ${elevationRegistration.counts.after.VERTICAL_ONLY} vertical only, ${elevationRegistration.counts.after.UNREGISTERED} unregistered`,
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
      elevationRegistration,
      summary,
    },
    plans,
  }
}

export function assessModel(input: AssessmentInput): ModelAssessment {
  return assessModelDetailed(input).assessment
}

const CLASSES = ['FULL', 'ALONG_ONLY', 'VERTICAL_ONLY', 'UNREGISTERED'] as const
const RANK: Record<(typeof CLASSES)[number], number> = { UNREGISTERED: 0, VERTICAL_ONLY: 1, ALONG_ONLY: 1, FULL: 2 }

export function summaryOfAxes(v: ElevationAxes): ViewAxesSummary {
  return { class: v.class, side: `${v.side.state} ${v.side.value}`, along: v.along.state, vertical: v.vertical.state, scale: v.scale.state }
}

/** N9-02A: the four-axis registration of every elevation, with the before (the solver's use) and after counts. */
export function elevationRegistrationOf(input: Pick<AssessmentInput, 'model' | 'reconstruction' | 'frames' | 'raster' | 'observations' | 'datums'>): ElevationRegistrationReport {
  const r = input.reconstruction
  const emitted = new Set(input.model.openings.map((o) => o.id))
  const byFacade = { FRONT: 0, REAR: 0, LEFT: 0, RIGHT: 0 }
  for (const o of r.building.openings) if (emitted.has(o.id)) byFacade[o.facade === 'WEST' ? 'LEFT' : o.facade === 'EAST' ? 'RIGHT' : (o.facade as 'FRONT' | 'REAR')] += 1
  const views = elevationAxes({ frames: input.frames, observations: input.observations, raster: input.raster, world: r.world, ...input.datums, viewAudit: r.viewAudit, solverRegistrations: r.registrations.elevations, openingsByFacade: byFacade })
  const counted = views.filter((v) => v.solver.use !== 'DUPLICATE' && v.frameId)
  const tally = (cls: (v: ElevationAxes) => (typeof CLASSES)[number]): Record<(typeof CLASSES)[number], number> => Object.fromEntries(CLASSES.map((c) => [c, counted.filter((v) => cls(v) === c).length])) as Record<(typeof CLASSES)[number], number>
  const beforeOf = (v: ElevationAxes): (typeof CLASSES)[number] => solverClass(v.solver.use, v.solver.openingHeights)
  const slotsBefore = counted.reduce((a, v) => {
    const b = beforeOf(v)
    const facade = v.solver.side as keyof typeof byFacade | undefined
    const n = facade ? byFacade[facade] ?? 0 : 0
    return a + (b === 'FULL' ? 3 + n + 2 + 2 * n : b === 'ALONG_ONLY' ? 3 + n : 0)
  }, 0)
  const lost = counted
    .filter((v) => RANK[beforeOf(v)] > RANK[v.class] || (beforeOf(v) === 'ALONG_ONLY' && v.class === 'VERTICAL_ONLY'))
    .map((v) => ({ frameId: v.frameId, before: beforeOf(v), after: v.class, why: v.along.state !== 'REGISTERED' && v.along.state !== 'SPAN_ONLY' ? `ALONG: ${v.along.why}` : `VERTICAL: ${v.vertical.why}` }))
  return {
    views,
    counts: { before: tally(beforeOf), after: tally((v) => v.class) },
    slots: { before: slotsBefore, after: counted.reduce((a, v) => a + v.checkable.slots, 0) },
    lost,
    datums: { ridgeY: input.datums.ridgeY ?? null, terrainY: input.datums.terrainY ?? null },
  }
}
