/**
 * The structural pass's reading of the plans, as a digest and as a verdict.
 *
 * The digest is what a developer needs to see a decomposition: every band,
 * grid line, cell, region, wide opening and mass, in the plan's own pixels,
 * so the overlays can be drawn over the drawing it came from. The verdict is
 * the FIRST thing the pass failed to establish, in the order the pass
 * establishes them — a plan, its pixels, its scale, its walls, an envelope, a
 * grid, an enclosed cell, a walled region, a mass — because the first missing
 * link is the one worth fixing, and everything after it is a consequence.
 */
import { round6 } from '@buildapp/source-common'
import type { MetricEvidenceSet } from '@buildapp/source-metrics'
import type { SourceObservationGraph } from '@buildapp/source-observations'
import type { StructuralLayoutDraft } from './layout.js'
import type { StructuralLayoutHypothesisSet } from './structural-layout.js'
import { ReconstructionFailure, planCounts } from './failure.js'
import type { PlanDiagnostics, PlanDiagnosticsReport } from './failure.js'

const rect = (r: { x0: number; y0: number; x1: number; y1: number }): { x0: number; y0: number; x1: number; y1: number } => ({ x0: round6(r.x0), y0: round6(r.y0), x1: round6(r.x1), y1: round6(r.y1) })

/** The digest of every plan the structural pass read, and of every one it could not. */
export function planDiagnosticsOf(draft: StructuralLayoutDraft, graph: SourceObservationGraph, metrics: MetricEvidenceSet, layout?: StructuralLayoutHypothesisSet): PlanDiagnosticsReport {
  const planFrames = graph.coordinateFrames.filter((f) => f.roles.projection === 'ORTHOGRAPHIC_PLAN' && f.roles.document === 'FLOOR_PLAN').length
  const plans: PlanDiagnostics[] = draft.plans.map((p) => {
    const d = p.decomposition
    const isBase = draft.base?.frame.id === p.frame.id
    const regionRect = new Map(draft.footprintRegions.map((r) => [r.id, r.pixelRect]))
    const masses = isBase
      ? (layout?.masses ?? draft.masses).map((m) => {
          const own = m.footprintRegionIds.map((id) => regionRect.get(id)).find((r) => r !== undefined)
          return own ? { id: m.id, rect: rect(own) } : undefined
        }).filter((m): m is { id: string; rect: { x0: number; y0: number; x1: number; y1: number } } => m !== undefined)
      : []
    return {
      frameId: p.frame.id,
      assetId: p.frame.assetId,
      storey: p.storey,
      annotation: p.frame.roles.annotation,
      sizePx: { width: p.frame.size.width, height: p.frame.size.height },
      variantByteHash: p.frame.variantByteHash,
      scale: p.registration ? { mppX: round6(p.registration.metresPerPixelX), mppY: round6(p.registration.metresPerPixelY), anchors: p.registration.anchors.length, rmsM: round6(p.registration.residual.rmsM) } : null,
      wallPx: round6(p.wallPx),
      extent: rect(p.extent),
      extentWeak: p.extentWeak,
      envelope: d.envelope ? rect(d.envelope.rect) : null,
      bands: p.bands.map((b) => ({ axis: b.axis === 'VERTICAL' ? ('V' as const) : ('H' as const), bounds: rect(b.bounds), thickness: round6(b.thickness) })),
      chains: metrics.chains
        .filter((c) => c.frameId === p.frame.id)
        .map((c) => ({ axis: c.axis === 'VERTICAL' ? ('V' as const) : ('H' as const), baselinePx: round6(c.baselinePx), ticksPx: c.ticksPx.map(round6), read: c.segments.filter((s) => s.origin === 'READ' || s.origin === 'CHAIN_CORRECTED').length })),
      linesX: d.linesX.map((l) => round6(l.px)),
      linesY: d.linesY.map((l) => round6(l.px)),
      cells: d.cells.map((c) => ({ ix: c.ix, iy: c.iy, rect: rect(c.rect), cls: c.classification === 'BUILT' ? ('B' as const) : c.classification === 'RECESS' ? ('R' as const) : ('O' as const), enclosed: c.enclosed })),
      regions: d.regions.filter((r) => r.classification !== 'OUTSIDE').map((r) => ({ id: r.id, cls: r.classification as 'BUILT' | 'RECESS', rect: rect(r.rect) })),
      wideOpenings: d.wideOpenings.map((w) => ({ kind: w.kind, axis: w.axis, linePx: round6(w.linePx), fromPx: round6(w.fromPx), toPx: round6(w.toPx), widthM: w.widthM, decision: w.decision, score: w.score, why: w.why })),
      bays: d.bays.map((b) => ({ side: b.side, rect: rect(b.rect), mouth: b.mouth.decision })),
      hypotheses: d.hypotheses.map((h) => ({ id: h.id, builtCells: h.builtCells, closedOpenings: h.closedOpenings, score: h.score, chosen: d.chosenHypothesis === h.id, why: h.why })),
      masses,
    }
  })
  return { planFrames, selectedPlanFrameId: draft.base?.frame.id ?? null, plans, skipped: draft.skippedPlans.map((s) => ({ frameId: s.frameId, why: s.why })) }
}

/**
 * The first link the structural pass could not make, as a failure.
 *
 * Called only when there is no mass or no world frame to register against;
 * the codes are tried in the order the pass needs them.
 */
export function planFailureOf(draft: StructuralLayoutDraft, layout: StructuralLayoutHypothesisSet, report: PlanDiagnosticsReport): ReconstructionFailure {
  const counts = planCounts(report)
  const fail = (code: ConstructorParameters<typeof ReconstructionFailure>[0], substage: string, message: string): ReconstructionFailure => new ReconstructionFailure(code, 'REGISTRATION', message, counts, substage, report)
  if (report.planFrames === 0) return fail('PLAN_NOT_FOUND', 'PLAN_READ', 'the project page exposes no floor plan, and the building’s body is read from its plans')
  if (draft.plans.length === 0) {
    const undecodable = draft.skippedPlans.filter((s) => s.code === 'NOT_DECODABLE').length
    if (undecodable === draft.skippedPlans.length) return fail('PLAN_NOT_DECODABLE', 'PLAN_READ', `${report.planFrames} floor plan${report.planFrames === 1 ? ' was' : 's were'} found and none could be decoded`)
    const anyBands = draft.skippedPlans.some((s) => (s.longBands ?? 0) > 0)
    return anyBands
      ? fail('PLAN_NO_WALLED_ENVELOPE', 'PLAN_READ', `${report.planFrames} floor plan${report.planFrames === 1 ? '' : 's'} read; walls were drawn along one axis only and no dimension chain framed them`)
      : fail('PLAN_NO_WALL_BANDS', 'PLAN_READ', `${report.planFrames} floor plan${report.planFrames === 1 ? '' : 's'} read; no wall-thick ink and no readable dimension chain was found on any of them`)
  }
  const base = draft.base
  const plan = report.plans.find((p) => p.frameId === base?.frame.id)
  if (!base || !plan) return fail('PLAN_NO_MASSES', 'PLAN_READ', 'no plan was chosen to take the building’s coordinates from')
  const sheet = `the ${plan.sizePx.width}×${plan.sizePx.height} px floor plan`
  if (!base.registration) return fail('PLAN_NO_DIMENSION_FRAME', 'PLAN_READ', `${sheet} states no usable scale: none of its dimension chains was read at a scale that makes its walls a thickness a wall can have`)
  if (base.bands.length === 0) return fail('PLAN_NO_WALL_BANDS', 'PLAN_DECOMPOSITION', `no wall-thick ink was found on ${sheet}`)
  if (!base.decomposition.envelope) return fail('PLAN_NO_WALLED_ENVELOPE', 'PLAN_DECOMPOSITION', `${plan.bands.length} wall bands were found on ${sheet}, but not along both axes, so they enclose nothing`)
  if (plan.linesX.length < 2 || plan.linesY.length < 2) return fail('PLAN_GRID_EMPTY', 'PLAN_DECOMPOSITION', `neither the chains nor the walls of ${sheet} support two grid lines on each axis (${plan.linesX.length} × ${plan.linesY.length})`)
  const enclosed = plan.cells.filter((c) => c.enclosed).length
  if (enclosed === 0) return fail('PLAN_NO_ENCLOSED_CELLS', 'PLAN_DECOMPOSITION', `the analyzer read ${sheet} — ${plan.bands.length} wall bands, a ${plan.linesX.length} × ${plan.linesY.length} structural grid — but could reach every one of its ${plan.cells.length} cells from outside: no closed building footprint`)
  const accepted = draft.footprintRegions.filter((r) => r.kind === 'BUILT' && r.frameId === base.frame.id).length
  if (accepted === 0) return fail('PLAN_NO_BUILT_REGIONS', 'PLAN_DECOMPOSITION', `${enclosed} cells of ${sheet} are enclosed, but every region they make is bounded by line work rather than wall, so none of them is a building`)
  return fail('PLAN_NO_MASSES', 'STRUCTURAL_LAYOUT', `${accepted} walled region${accepted === 1 ? '' : 's'} of ${sheet} ${accepted === 1 ? 'was' : 'were'} found, but no building mass could be made from ${accepted === 1 ? 'it' : 'them'}${layout.masses.length > 0 ? ' that places the front of the building' : ''}`)
}

/**
 * The gate reasons that say the PLAN READING is not of this building: its
 * footprint against the one the publisher prints, two bodies in one place, no
 * body or no storey at all. These stop the run.
 *
 * The gate's other BLOCKING reasons compare the massing with how an elevation
 * was traced — a corroboration whose own tracing can be the thing that is
 * wrong — and are carried as a degraded layout rather than a refusal.
 */
export const LAYOUT_REFUSAL_CODES: ReadonlySet<string> = new Set(['FOOTPRINT_AREA_WRONG', 'MASS_OVERLAP', 'NO_MASS', 'NO_STOREY'])

/** Whether the gate's verdict refuses the reading outright. */
export const layoutRefused = (layout: StructuralLayoutHypothesisSet): boolean => layout.gate.reasons.some((r) => r.severity === 'BLOCKING' && LAYOUT_REFUSAL_CODES.has(r.code))

/** A layout the gate refused, as the failure it is: the reading contradicts the sources. */
export function layoutRejectionOf(layout: StructuralLayoutHypothesisSet, report: PlanDiagnosticsReport): ReconstructionFailure {
  const blocking = layout.gate.reasons.filter((r) => r.severity === 'BLOCKING' && LAYOUT_REFUSAL_CODES.has(r.code))
  const counts = { ...planCounts(report), gateBlocking: blocking.map((r) => r.code).join(',') }
  const first = blocking[0]
  return new ReconstructionFailure(
    'PLAN_LAYOUT_REJECTED',
    'REGISTRATION',
    first ? `${first.what} — ${first.why}` : 'the structural layout was rejected by its own gate',
    counts,
    'STRUCTURAL_LAYOUT',
    report,
  )
}
