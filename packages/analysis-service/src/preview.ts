/**
 * N7-P1: what a finished run's 3D preview is, said so a phone can show it next to the model.
 *
 * Two things a person needs before trusting what they see:
 *
 *   - **which drawing the walls came from** (`sourceBasisOf`): the plan the bodies were read from — its role, storey,
 *     annotation, the copy that was read and whether a larger one was offered, how many printed dimensions were read
 *     on it and how sure the plan's scale is. By hash and size only: no address, no pixel.
 *   - **whether the model is the whole reading or the last valid part of it** (`previewOf`): a model the validator
 *     refused at a later object is delivered as `PARTIAL_3D_PREVIEW`, with the refusal, everything not built and what
 *     IS built; and every number that is a convention for viewing (`HEIGHT_ASSUMED_FOR_PREVIEW`) or rests on a scale
 *     nothing independent confirms (`SCALE_NOT_VERIFIED`) is named as provisional.
 *
 * Nothing here decides anything about the building: it reads the solver's own records and the model it sealed.
 */
import type { CanonicalBuildingModel } from '@buildapp/model'
import type { ModelCompleteness, PartialPreviewReport, PlanDiagnosticsReport } from '@buildapp/reconstruction'
import type { SourcePackage } from '@buildapp/source-package'
import { selectedVariant } from '@buildapp/source-package'

/** The drawing the walls were reconstructed from. */
export type SourceBasis = {
  assetId: string
  /** FLOOR_PLAN read as an orthographic plan: never a render. */
  document: string
  projection: string
  storey: string
  annotation: string
  variant: { widthPx: number; heightPx: number; byteLength: number; mediaType: string; byteHash: string }
  /** How many copies of this drawing the page offered, and whether the one read is the largest of them. */
  variants: number
  largestOffered: boolean
  dimensions: { chains: number; segmentsRead: number; evidence: string }
  scale: {
    mppX: number | null
    mppY: number | null
    anchors: number
    rmsM: number | null
    /** STRONG / SUPPORTED / WEAK / INCONCLUSIVE, or NONE when the plan has no metric solution. */
    confidence: string
    relation: string
    independentWitnesses: number
    /** True only when independent printed dimensions support the scale (STRONG or SUPPORTED). */
    verified: boolean
  }
}

export type ProvisionalValue = {
  code: 'HEIGHT_ASSUMED_FOR_PREVIEW' | 'SCALE_NOT_VERIFIED' | 'APPROXIMATE_ROOF_DATUM'
  what: string
}

export type PartialPreviewSummary = {
  basis: PartialPreviewReport['basis']
  /** The refusal the run met first, which made the result partial. */
  failure: PartialPreviewReport['failures'][number]
  failures: PartialPreviewReport['failures']
  /** Objects the preview does not build (evidence records left out with them are not listed). */
  missing: Array<{ type: string; id?: string; cause: string; why: string }>
  checkpoint: PartialPreviewReport['checkpoint'] | null
  /** N7-FIX-01: every ring refused for its own walls overlapping, with the way back to the reading that made it. */
  ringCollisions?: NonNullable<PartialPreviewReport['ringCollisions']>
  /** N7-COUNCIL-FIX-03: bodies the plan draws walled that the model does not build, with the cause. */
  missingBodies?: NonNullable<PartialPreviewReport['missingBodies']>
  /** N7-FIX-04: BLOCKING reasons the chosen layout holds unresolved; the model built from it is kept. */
  layoutBlocking?: NonNullable<PartialPreviewReport['layoutBlocking']>
}

export type PreviewSummary = {
  /** COMPLETE: every object the solver emitted is built. PARTIAL_3D_PREVIEW: the last valid model before a refusal. */
  outcome: 'COMPLETE' | 'PARTIAL_3D_PREVIEW'
  /** What the model holds, counted off the sealed model. */
  built: { wallRings: number; walls: number; slabs: number; roofs: number; roofPlanes: number; openings: number; rooms: number; stairs: number }
  provisional: ProvisionalValue[]
  partial: PartialPreviewSummary | null
  /**
   * N7-FIX-04: completeness kept apart — against the accepted decomposition, what is unresolved, the conflicts, the
   * model — and one verdict: COMPLETE, COMPLETE_WITH_OPEN_QUESTIONS or PARTIAL. Absent from a run with no plan reading.
   */
  completeness?: ModelCompleteness
}

/** The plan the bodies were read from, or null when the run read none. */
export function sourceBasisOf(pkg: SourcePackage, plans: PlanDiagnosticsReport): SourceBasis | null {
  const plan = plans.plans.find((p) => p.frameId === plans.selectedPlanFrameId)
  if (!plan) return null
  const asset = pkg.assets.find((a) => a.id === plan.assetId)
  if (!asset) return null
  const v = selectedVariant(asset)
  const area = (w: { decoded: { width: number; height: number } }): number => w.decoded.width * w.decoded.height
  const m = plan.metric
  return {
    assetId: asset.id,
    document: asset.roles.document,
    projection: asset.roles.projection,
    storey: asset.roles.storey,
    annotation: asset.roles.annotation,
    variant: { widthPx: v.decoded.width, heightPx: v.decoded.height, byteLength: v.byteLength, mediaType: v.mediaType, byteHash: v.byteHash },
    variants: asset.variants.length,
    largestOffered: asset.variants.every((x) => area(x) <= area(v)),
    dimensions: { chains: plan.chains.length, segmentsRead: plan.chains.reduce((a, c) => a + c.read, 0), evidence: plan.dimensionEvidence?.kind ?? 'DIMENSION_EVIDENCE_READ' },
    scale: {
      mppX: plan.scale?.mppX ?? null,
      mppY: plan.scale?.mppY ?? null,
      anchors: plan.scale?.anchors ?? 0,
      rmsM: plan.scale?.rmsM ?? null,
      confidence: m?.confidence ?? 'NONE',
      relation: m?.relation ?? 'NO_SCALE',
      independentWitnesses: m?.independentWitnesses ?? 0,
      verified: !!plan.scale && (m?.confidence === 'STRONG' || m?.confidence === 'SUPPORTED') && m.relation !== 'NO_SCALE',
    },
  }
}

export function previewOf(input: {
  model: CanonicalBuildingModel
  partial?: PartialPreviewReport
  heights: { measured: boolean; assumedStoreyHeightM?: number }
  source: SourceBasis | null
  approximateRoofDatum?: { ridgeY: number }
  completeness?: ModelCompleteness
}): PreviewSummary {
  const { model, partial } = input
  const provisional: ProvisionalValue[] = []
  if (!input.heights.measured) provisional.push({ code: 'HEIGHT_ASSUMED_FOR_PREVIEW', what: `no section prints the storey levels: every storey is drawn ${(input.heights.assumedStoreyHeightM ?? 0).toFixed(2)} m tall, for viewing only` })
  if (!input.source?.scale.verified) provisional.push({ code: 'SCALE_NOT_VERIFIED', what: input.source ? `the plan's scale (${input.source.scale.confidence.toLowerCase()}, ${input.source.scale.independentWitnesses} independent printed dimension${input.source.scale.independentWitnesses === 1 ? '' : 's'}) is not confirmed: the model shows proportions, its lengths are not for costing` : 'no plan scale was read: the model shows proportions only' })
  if (input.approximateRoofDatum) provisional.push({ code: 'APPROXIMATE_ROOF_DATUM', what: `the ridge is not printed: drawn at an approximate ${input.approximateRoofDatum.ridgeY.toFixed(2)} m, for viewing only` })
  return {
    outcome: partial ? 'PARTIAL_3D_PREVIEW' : 'COMPLETE',
    built: { wallRings: model.wallRings.length, walls: model.walls.length, slabs: model.slabs.length, roofs: model.roofs.length, roofPlanes: model.roofPlanes.length, openings: model.openings.length, rooms: model.rooms.length, stairs: model.stairs.length },
    provisional,
    partial: partial
      ? {
          basis: partial.basis,
          failure: partial.failures[0],
          failures: partial.failures,
          missing: partial.skipped.filter((s) => s.type !== 'setEvidence').map((s) => ({ type: s.type, ...(s.id ? { id: s.id } : {}), cause: s.cause, why: s.why })),
          checkpoint: partial.checkpoint ?? null,
          ...(partial.ringCollisions ? { ringCollisions: partial.ringCollisions } : {}),
          ...(partial.missingBodies ? { missingBodies: partial.missingBodies } : {}),
          ...(partial.layoutBlocking ? { layoutBlocking: partial.layoutBlocking } : {}),
        }
      : null,
    ...(input.completeness ? { completeness: input.completeness } : {}),
  }
}
