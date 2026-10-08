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
import type { CompoundFacadeDigest, PlanDiagnostics, PlanDiagnosticsReport, StoreyDigest } from './failure.js'
import type { BoundaryRecord, PlanDecomposition } from './plan-decomposition.js'
import type { CompoundFacadeSpan } from './compound-facade.js'
import type { OutlineSupport } from './boundary-outline.js'

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
      ...(p.extentProvenance ? { extentProvenance: p.extentProvenance } : {}),
      ...(p.extentRefused ? { extentRefused: p.extentRefused } : {}),
      ...(p.extentEndSpans ? { extentEndSpans: p.extentEndSpans } : {}),
      ...(p.extentRefutations ? { extentRefutations: p.extentRefutations } : {}),
      ...metricOf(metrics, p.frame.id),
      dimensionEvidence: dimensionEvidenceOf(metrics, p.frame.id),
      envelope: d.envelope ? rect(d.envelope.rect) : null,
      bands: p.bands.map((b) => ({ axis: b.axis === 'VERTICAL' ? ('V' as const) : ('H' as const), bounds: rect(b.bounds), thickness: round6(b.thickness) })),
      chains: metrics.chains
        .filter((c) => c.frameId === p.frame.id)
        .map((c) => ({ axis: c.axis === 'VERTICAL' ? ('V' as const) : ('H' as const), baselinePx: round6(c.baselinePx), ticksPx: c.ticksPx.map(round6), read: c.segments.filter((s) => s.origin === 'READ' || s.origin === 'CHAIN_CORRECTED').length })),
      linesX: d.linesX.map((l) => round6(l.px)),
      linesY: d.linesY.map((l) => round6(l.px)),
      cells: d.cells.map((c) => ({ ix: c.ix, iy: c.iy, rect: rect(c.rect), cls: c.classification === 'BUILT' ? ('B' as const) : c.classification === 'RECESS' ? ('R' as const) : ('O' as const), enclosed: c.enclosed })),
      regions: d.regions.filter((r) => r.classification !== 'OUTSIDE').map((r) => ({ id: r.id, cls: r.classification as 'BUILT' | 'RECESS', rect: rect(r.rect) })),
      // 005K: a wide opening's geometric identity in its frame (its line and ends), beside its decision
      wideOpenings: d.wideOpenings.map((w) => ({ id: `wide-${w.axis}-${Math.round(w.linePx)}-${Math.round(w.fromPx)}-${Math.round(w.toPx)}`, kind: w.kind, axis: w.axis, linePx: round6(w.linePx), fromPx: round6(w.fromPx), toPx: round6(w.toPx), widthM: w.widthM, decision: w.decision, score: w.score, why: w.why, ...(w.compound ? { compound: w.compound } : {}) })),
      // 005N: recorded only where a facade gap holds a separator, so every other plan digests as it did
      ...(d.compoundFacades && d.compoundFacades.length > 0 ? { compoundFacades: d.compoundFacades.map((s) => compoundOf(s, d)) } : {}),
      bays: d.bays.map((b) => ({ side: b.side, rect: rect(b.rect), mouth: b.mouth.decision })),
      hypotheses: d.hypotheses.map((h) => ({ id: h.id, builtCells: h.builtCells, closedOpenings: h.closedOpenings, score: h.score, chosen: d.chosenHypothesis === h.id, why: h.why })),
      ...(d.boundary ? { boundary: boundaryOf(d.boundary) } : {}),
      masses,
    }
  })
  // 005L (council E5L-6): every other storey's registration and support, numbers and ids only
  const storeys: StoreyDigest[] = draft.storeyRegistrations.map((r) => ({
    frameId: r.frameId,
    storeyIndex: r.storeyIndex,
    decision: r.decision,
    chosen: r.chosen ? { targetId: r.chosen.targetId, scale: round6(r.chosen.scale), offsetX: round6(r.chosen.offsetX), offsetY: round6(r.chosen.offsetY), score: round6(r.chosen.score), stated: r.chosen.stated } : null,
    margin: r.margin ?? null,
    resolution: r.resolution ?? null,
    scaleBasis: r.scaleBasis ? { basis: r.scaleBasis.basis, corroborated: r.scaleBasis.corroborated } : null,
    printedScale: r.printedScale ? { k: r.printedScale.k, outcome: r.printedScale.outcome } : null,
    held: r.held ? { by: r.held.by, standsElsewhere: r.held.standsElsewhere, overScore: round6(r.held.over.score) } : null,
    regions: r.regions.map((g) => ({ regionId: g.regionId, bounds: g.bounds, body: g.body, overhang: g.overhang, unsupportedM2: g.unsupportedM2, standsOn: r.relations.filter((x) => x.upperRegionId === g.regionId && x.supportStatus === 'SUPPORTS').map((x) => x.lowerMassId).sort() })),
    why: r.why,
  }))
  return { planFrames, selectedPlanFrameId: draft.base?.frame.id ?? null, plans, skipped: draft.skippedPlans.map((s) => ({ frameId: s.frameId, why: s.why })), ...(storeys.length > 0 ? { storeys } : {}) }
}

/** 005N: one compound facade span, with each interval's final decision and the cells behind its mouth. */
function compoundOf(s: CompoundFacadeSpan, d: PlanDecomposition): CompoundFacadeDigest {
  const final = new Map(d.wideOpenings.filter((w) => w.compound).map((w) => [w.compound?.intervalId, w]))
  const behind = (from: number, to: number): CompoundFacadeDigest['intervals'][number]['behind'] =>
    d.cells
      .filter((c) => {
        const [a, b] = s.axis === 'Y' ? [c.rect.x0, c.rect.x1] : [c.rect.y0, c.rect.y1]
        const edge = s.axis === 'Y' ? (s.inward < 0 ? c.rect.y1 : c.rect.y0) : s.inward < 0 ? c.rect.x1 : c.rect.x0
        return Math.abs(edge - s.linePx) <= 1 && Math.min(b, to) - Math.max(a, from) > 0
      })
      .map((c) => ({ ix: c.ix, iy: c.iy, cls: c.classification === 'BUILT' ? ('B' as const) : c.classification === 'RECESS' ? ('R' as const) : ('O' as const) }))
  return {
    id: s.id,
    axis: s.axis,
    linePx: s.linePx,
    fromPx: s.fromPx,
    toPx: s.toPx,
    inkFromPx: s.inkFromPx,
    inkToPx: s.inkToPx,
    widthM: s.widthM,
    inward: s.inward,
    separators: s.separators.map((x) => ({ id: x.id, fromPx: x.fromPx, toPx: x.toPx, axisPx: x.axisPx, inkKind: x.inkKind, returnM: x.returnM, accepted: x.accepted, kind: x.kind, why: x.why })),
    intervals: s.intervals.map((i) => {
      const w = final.get(i.id)
      return {
        id: i.id,
        fromPx: i.fromPx,
        toPx: i.toPx,
        widthM: i.widthM,
        bounds: [...i.bounds],
        role: i.role,
        signature: i.signature,
        infill: i.evidence.infill,
        infillRunsPast: i.infillRunsPast,
        jambInk: i.jambInk,
        ...(i.evidence.callout ? { callout: { id: i.evidence.callout.id, widthCm: i.evidence.callout.widthCm } } : {}),
        ...(w?.evidence.pocketM2 !== undefined ? { pocketM2: w.evidence.pocketM2 } : {}),
        ...(i.recess ? { recess: i.recess } : {}),
        decision: w?.decision ?? 'UNRESOLVED',
        behind: behind(i.fromPx, i.toPx),
        why: w?.why ?? i.why,
      }
    }),
    why: s.why,
  }
}

/** The opening-aware boundary (005C), as the digest carries it: what was found, adopted and named. */
function boundaryOf(b: BoundaryRecord): NonNullable<PlanDiagnostics['boundary']> {
  const support = (s: OutlineSupport) => ({ areaM2: s.areaM2, perimeterM: s.perimeterM, wallM: s.wallM, strongOpeningM: s.strongOpeningM, weakOpeningM: s.weakOpeningM, unsupportedM: s.unsupportedM, gapsBridged: s.gapsBridged, maxBridgedGapM: s.maxBridgedGapM })
  return {
    accepted: b.accepted,
    gaps: { ...b.gaps },
    bridged: { ...b.bridged },
    candidates: b.candidates.map((c) => ({ id: c.id, cells: c.cells, ...support(c.support) })),
    extensions: b.extensions.map((e) => ({ cells: e.cells.length, areaM2: e.areaM2, continuesAcrossM: e.continuesAcrossM, accepted: e.accepted })),
    policies: { strictAreaM2: b.policies.strict.areaM2, strictAccepted: b.policies.strict.accepted, exclusionAreaM2: b.policies.exclusion.areaM2, exclusionAccepted: b.policies.exclusion.accepted, disagree: b.policies.disagree },
    bodies: b.bodies.map((x) => ({ relation: x.relation, built: x.built, enclosed: x.enclosed, areaM2: x.areaM2, rect: rect(x.rect), junctionWallShare: x.junction.wallShare, sideWallShare: x.sides.wallShare, ...(x.mouth ? { mouthM: x.mouth.widthM } : {}) })),
    shutGarageMouths: b.shutGarageMouths,
    // 005F: recorded only where there is something to say, so a plan with none digests as it did.
    ...(b.extentConflicts.length > 0 ? { extentConflicts: b.extentConflicts.map((c) => ({ side: c.side, strength: c.strength, chainIds: c.chainIds, extentPx: c.extentPx, boxPx: c.boxPx, gapM: c.gapM, gapWalls: c.gapWalls, stretches: c.stretches, ...(c.stretchesOmitted ? { stretchesOmitted: c.stretchesOmitted } : {}), decision: c.decision, why: c.why })) } : {}),
    ...(b.completions.length > 0 ? { completions: b.completions.map((p) => ({ kind: p.kind, decision: p.decision, reason: p.reason, rectBefore: rect(p.rectBefore), areaBeforeM2: p.areaBeforeM2, rect: rect(p.rect), areaM2: p.areaM2, junction: p.junction, sides: p.sides, evidence: p.evidence, weakGaps: p.weakGaps, ...(p.side ? { side: p.side } : {}) })) } : {}),
    ...(b.completionsUnjudged > 0 ? { completionsUnjudged: b.completionsUnjudged } : {}),
    ...(b.box && (b.extentConflicts.length > 0 || b.completions.length > 0) ? { box: rect(b.box) } : {}),
    why: b.why,
    decompositionId: b.decompositionId,
    mpp: b.mpp,
    drawnGapRule: b.drawnGapRule,
    gapEvidence: b.gapEvidence,
    ...(b.gapEvidenceOmitted > 0 ? { gapEvidenceOmitted: b.gapEvidenceOmitted } : {}),
  }
}

/**
 * What a plan prints to take a scale from (005F): no dimension at all, or dimensions that were found and read but do
 * not settle one scale. The two are different refusals — the first asks for a dimension, the second for a reading of
 * the ones printed — and saying the first when the second holds tells a person the drawing lacks what it has.
 * Counted on what could witness a scale (005F post-review D5F-1): a label bound as the PRIMARY reading of its line and
 * read better than LOW_QUALITY, and the legacy chains. Dimensions are found when the frame keeps a legacy chain, or at
 * least two such labels on two different lines — the least a scale needs; a stray token bound to some line is not a
 * dimension the drawing prints.
 */
export type DimensionEvidence = { kind: 'NO_DIMENSION_EVIDENCE' | 'DIMENSION_EVIDENCE_INCONCLUSIVE'; labels: number; lines: number }

export function dimensionEvidenceOf(metrics: MetricEvidenceSet, frameId: string): DimensionEvidence {
  const witnessing = (metrics.dimensionObservations ?? []).filter((o) => o.frameId === frameId && (o.binding === undefined || o.binding.role === 'PRIMARY') && o.ocr?.ocrClass !== 'LOW_QUALITY')
  const labels = new Set(witnessing.map((o) => o.textRegionId)).size
  const legacy = metrics.chains.filter((c) => c.frameId === frameId)
  const labelLines = new Set(witnessing.map((o) => o.chainId)).size
  const lines = new Set([...witnessing.map((o) => o.chainId), ...legacy.map((c) => c.id)]).size
  return { kind: legacy.length > 0 || (labels >= 2 && labelLines >= 2) ? 'DIMENSION_EVIDENCE_INCONCLUSIVE' : 'NO_DIMENSION_EVIDENCE', labels, lines }
}

/** The frame's independent metric solution (005B), as the digest carries it. */
function metricOf(metrics: MetricEvidenceSet, frameId: string): { metric?: PlanDiagnostics['metric'] } {
  const s = metrics.metricSolutions?.find((m) => m.frameId === frameId)
  if (!s) return {}
  return {
    metric: {
      relation: s.relation,
      confidence: s.confidence,
      isotropy: s.isotropy,
      independentWitnesses: s.independentWitnesses,
      ...(s.cmPerPixelX !== undefined ? { cmPerPixelX: s.cmPerPixelX } : {}),
      ...(s.cmPerPixelY !== undefined ? { cmPerPixelY: s.cmPerPixelY } : {}),
      ...(s.legacy.cmPerPixel !== undefined ? { legacyCmPerPixel: s.legacy.cmPerPixel } : {}),
    },
  }
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
  if (!base.registration)
    return fail(
      'PLAN_NO_DIMENSION_FRAME',
      'PLAN_READ',
      plan.dimensionEvidence?.kind === 'NO_DIMENSION_EVIDENCE'
        ? `${sheet} prints no dimension chain, so nothing on it states a scale`
        : plan.chains.length === 0
          ? `${sheet} prints ${plan.dimensionEvidence?.labels ?? 0} dimension label${plan.dimensionEvidence?.labels === 1 ? '' : 's'} on ${plan.dimensionEvidence?.lines ?? 0} dimension line${plan.dimensionEvidence?.lines === 1 ? '' : 's'}, but as read they state no scale its other readings agree with`
          : `${sheet} states no usable scale: none of its dimension chains was read at a scale that makes its walls a thickness a wall can have`,
    )
  if (base.bands.length === 0) return fail('PLAN_NO_WALL_BANDS', 'PLAN_DECOMPOSITION', `no wall-thick ink was found on ${sheet}`)
  if (!base.decomposition.envelope) return fail('PLAN_NO_WALLED_ENVELOPE', 'PLAN_DECOMPOSITION', `${plan.bands.length} wall bands were found on ${sheet}, but the long ones inside the frame its dimension chains and walls draw do not span a box on both axes, so they enclose nothing`)
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
