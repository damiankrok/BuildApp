/**
 * N9-01 (E), relation R5: each elevation, as a source↔model state the owner can read.
 *
 * The residuals `verifyAgainstViews` already measures on every silhouette-registered view are split by what they are:
 *
 *   OBSERVED_WITHIN   an image edge found within the feature's own tolerance of the model
 *   OBSERVED_OUTSIDE  an image edge found, farther than that tolerance
 *   NOT_OBSERVED      no image edge within reach: nothing was compared (the verifier records it as "not observed")
 *   NOT_EMITTED       the check was made on an opening the delivered model does not contain (the verifier runs before
 *                     emission): it says nothing about the model the owner sees
 *
 * A view CONFLICTS when its observed checks disagree stably: at least two features outside tolerance, and at least the
 * share the cross-view summary already calls DISAGREES (a third of what was observed). It PASSES only when every
 * observed check agrees — and that agreement is MODEL-ANCHORED: every check looks for the edge near where the model puts
 * it, so an edge found there is not an independent confirmation, and the item says so. One isolated disagreement, or
 * nothing observed, is UNCHECKED (named with its share). A view that is not silhouette-registered is UNCHECKED with what its registration
 * reached (openings only, positions only, nothing); it is never PASS and never a default CONFLICT.
 *
 * The plan-free facade alignment (`alignFacades`) is attached as evidence — its readings are located by the plan's
 * intervals, so a match there is not independent either — and decides nothing here.
 *
 * N9-02R: every check declares the axes it needs, and is counted only where the shared adjudication of the view
 * (`elevationRegistration`, `validityOf`) holds those axes valid:
 *
 *   a height (sill, head, roof edge, fascia band, verge)   ALONG to place its column, VERTICAL to read its row
 *   a position along the facade (a return's free face)     ALONG; a VERTICAL that is not disputed places its row
 *   the building's width                                   CIRCULAR on a view registered by the plan's span: the
 *                                                          transform was made by setting the wall ends to that span,
 *                                                          so the width checks the registration, never the model
 *
 * A check whose axis is DISPUTED is not evidence for or against the model: the view is UNCHECKED
 * (REGISTRATION_DISPUTED) with the raw residuals, the solver's hypothesis and the contradicting measurement kept. A check
 * on a valid axis keeps its weight, and a view with valid axes keeps a genuine conflict.
 */
import { round6 } from '@buildapp/source-common'
import type { CanonicalBuildingModel } from '@buildapp/model'
import type { FacadeAlignmentReport, ReconstructionV2Result, SourceViewResidual, ViewAuditRecord } from '@buildapp/reconstruction'
import { combineStatus, countStatuses } from './types.js'
import type { CheckRecord, RelationItem, RelationResult } from './types.js'
import type { AxisValidity } from './elevation-axes.js'

/** The adjudication of one view's axes, as `elevationRegistration` gives it. */
export type ViewAdjudication = { along: AxisValidity; vertical: AxisValidity; hand: 'KNOWN' | 'UNKNOWN'; why: { along: string; vertical: string }; class: string; alongAnchorsShared: boolean }

const HEIGHT_KINDS = new Set(['OPENING_SILL', 'OPENING_HEAD', 'ROOF_EDGE', 'BAND_TOP', 'BAND_SOFFIT', 'VERGE_UNDERSIDE', 'RECESS_PLANE', 'MEMBER_EDGE'])

/** The axes a check needs, and whether those axes hold on this view. */
export function checkValidity(kind: string, adj: ViewAdjudication): { requires: Array<'SIDE' | 'ALONG' | 'VERTICAL'>; validity: CheckRecord['validity']; why: string } {
  if (kind === 'SILHOUETTE_WIDTH') {
    if (adj.alongAnchorsShared) return { requires: ['ALONG'], validity: 'CIRCULAR', why: 'the view was registered by setting its wall ends to the plan’s span: the width checks that registration, not the model' }
    return adj.along === 'VALID' || adj.along === 'SPAN_ONLY' ? { requires: ['ALONG'], validity: 'VALID', why: 'the width on a scale anchored apart from the model' } : { requires: ['ALONG'], validity: adj.along === 'DISPUTED' ? 'DISPUTED' : 'UNAVAILABLE', why: `ALONG ${adj.along}: ${adj.why.along}` }
  }
  if (HEIGHT_KINDS.has(kind)) {
    if (adj.along !== 'VALID') return { requires: ['SIDE', 'ALONG', 'VERTICAL'], validity: adj.along === 'DISPUTED' ? 'DISPUTED' : 'UNAVAILABLE', why: `ALONG ${adj.along} (the column it is read on is not placed): ${adj.why.along}` }
    if (adj.vertical !== 'VALID') return { requires: ['SIDE', 'ALONG', 'VERTICAL'], validity: adj.vertical === 'DISPUTED' ? 'DISPUTED' : 'UNAVAILABLE', why: `VERTICAL ${adj.vertical}: ${adj.why.vertical}` }
    return { requires: ['SIDE', 'ALONG', 'VERTICAL'], validity: 'VALID', why: 'both axes valid' }
  }
  // a position along the facade
  if (adj.along !== 'VALID') return { requires: ['SIDE', 'ALONG'], validity: adj.along === 'DISPUTED' ? 'DISPUTED' : 'UNAVAILABLE', why: `ALONG ${adj.along}: ${adj.why.along}` }
  if (adj.vertical === 'DISPUTED') return { requires: ['SIDE', 'ALONG', 'VERTICAL'], validity: 'DISPUTED', why: `the row it is read on is placed by a disputed VERTICAL: ${adj.why.vertical}` }
  return { requires: ['SIDE', 'ALONG'], validity: 'VALID', why: 'ALONG valid' }
}

/** The share of observed checks outside tolerance the cross-view summary already calls DISAGREES. */
export const DISAGREE_SHARE = 1 / 3
/** A disagreement is stable when at least this many features stand outside tolerance on the view. */
export const STABLE_FEATURES = 2

export type ResidualClass = 'OBSERVED_WITHIN' | 'OBSERVED_OUTSIDE' | 'NOT_OBSERVED' | 'NOT_EMITTED'

export function classifyResidual(r: SourceViewResidual, emitted: ReadonlySet<string>): ResidualClass {
  // only an opening can be dropped at emission; a roof edge or a silhouette names the solver's feature, not a model id
  if ((r.kind === 'OPENING_SILL' || r.kind === 'OPENING_HEAD') && r.objectId && !emitted.has(r.objectId)) return 'NOT_EMITTED'
  if (!r.withinTolerance && /not observed/.test(r.why)) return 'NOT_OBSERVED'
  return r.withinTolerance ? 'OBSERVED_WITHIN' : 'OBSERVED_OUTSIDE'
}

const FACADE_OF_SIDE: Record<string, string> = { FRONT: 'FRONT', REAR: 'REAR', LEFT: 'WEST', RIGHT: 'EAST' }

/** Every id the delivered model holds, of any kind. */
export function emittedIds(model: CanonicalBuildingModel): Set<string> {
  const ids = new Set<string>()
  for (const v of Object.values(model)) if (Array.isArray(v)) for (const o of v) if (o && typeof o === 'object' && typeof (o as { id?: unknown }).id === 'string') ids.add((o as { id: string }).id)
  return ids
}

export function elevationRelation(input: {
  model: CanonicalBuildingModel
  viewAudit: readonly ViewAuditRecord[]
  residuals: readonly SourceViewResidual[]
  crossView: ReconstructionV2Result['crossViewResiduals']
  facadeAlignment: FacadeAlignmentReport
  /** Building openings with their facade, to say how much of each facade was checked. */
  openings: ReadonlyArray<{ id: string; facade: string }>
  /** N9-02R: the shared adjudication of each view's axes; without it (a run older than N9-02R) the solver's own use decides. */
  adjudication?: ReadonlyMap<string, ViewAdjudication>
}): RelationResult {
  const emitted = emittedIds(input.model)
  const items: RelationItem[] = []
  const registered = new Set(input.crossView.views.map((v) => v.frameId))
  for (const v of input.viewAudit.filter((x) => x.document === 'ELEVATION')) {
    const source = { frameId: v.frameId, assetId: v.assetId, document: v.document, ...(v.side ? { side: v.side } : {}) }
    const facade = v.side ? FACADE_OF_SIDE[v.side] : undefined
    const alignView = input.facadeAlignment.views.find((x) => x.frameId === v.frameId)
    const comparisons = alignView ? input.facadeAlignment.comparisons.filter((c) => c.facade === alignView.facade) : []
    const alignEvidence = alignView
      ? [`facade alignment on this view (evidence only, plan-located): ${['CONFIRMED_MATCH', 'CONFLICT', 'NOT_OBSERVED'].map((s) => `${comparisons.filter((c) => c.status === s).length} ${s}`).join(', ')}, ${comparisons.filter((c) => c.codes.includes('MISSING_IN_MODEL')).length} MISSING_IN_MODEL`]
      : []
    if (v.use === 'DUPLICATE') continue
    if (v.use !== 'REGISTERED' || !registered.has(v.frameId)) {
      const reach = v.use === 'OPENINGS_ONLY' ? 'registered on its wall band: read for its facade’s openings, never compared for silhouette or heights' : v.use === 'POSITIONS_ONLY' ? 'registered on its wall band’s ends without a ridge datum: positions along the facade only' : 'not registered: nothing on it was compared'
      const adj = input.adjudication?.get(v.frameId)
      const axesSaid = adj ? `; its source axes: ${adj.class} (ALONG ${adj.along}, VERTICAL ${adj.vertical}) — R5 compares only views the solver measured residuals on, so no comparison is executed here` : ''
      items.push({ status: 'UNCHECKED', objects: [v.frameId], source, measured: { use: v.use }, tolerance: {}, coverage: { silhouette: 'NONE', heights: v.use === 'OPENINGS_ONLY' && v.openingHeights === 'READ' ? 'OPENINGS_ONLY' : 'NONE', executed: 0 }, code: v.use === 'NOT_REGISTERED' ? 'VIEW_NOT_REGISTERED' : 'VIEW_PARTLY_REGISTERED', why: `${v.side ?? v.labelledView} elevation ${v.frameId}: ${reach}${v.why ? ` (${v.why.slice(0, 200)})` : ''}${axesSaid}`, evidence: [...alignEvidence, ...v.lost.map((l) => `lost: ${l}`)] })
      continue
    }
    const all = input.residuals.filter((r) => r.frameId === v.frameId)
    const adj = input.adjudication?.get(v.frameId)
    // every check with what it needs and whether the adjudicated axes hold it
    const records: CheckRecord[] = all.map((r) => {
      const c = classifyResidual(r, emitted)
      const need = adj ? checkValidity(r.kind, adj) : { requires: [] as Array<'SIDE' | 'ALONG' | 'VERTICAL'>, validity: 'VALID' as const, why: 'no adjudication: the solver’s registration is taken as it is' }
      return { kind: r.kind, featureId: r.featureId, ...(r.objectId ? { objectId: r.objectId } : {}), requires: need.requires, transform: 'SOLVER_REGISTRATION', sharedWithModel: true, modelAnchored: true, validity: need.validity, why: need.why, observed: c === 'OBSERVED_WITHIN' || c === 'OBSERVED_OUTSIDE', emitted: c !== 'NOT_EMITTED', withinTolerance: r.withinTolerance, residualM: round6(r.residualM), toleranceM: round6(r.toleranceM) }
    })
    const validSet = new Set(all.filter((_, i) => records[i].validity === 'VALID'))
    const mine = all.filter((r) => validSet.has(r))
    const rawCls = all.map((r) => classifyResidual(r, emitted))
    const rawObserved = rawCls.filter((c) => c === 'OBSERVED_WITHIN' || c === 'OBSERVED_OUTSIDE').length
    const rawOutside = rawCls.filter((c) => c === 'OBSERVED_OUTSIDE').length
    const excluded = { DISPUTED: records.filter((x) => x.validity === 'DISPUTED' && x.observed).length, UNAVAILABLE: records.filter((x) => x.validity === 'UNAVAILABLE' && x.observed).length, CIRCULAR: records.filter((x) => x.validity === 'CIRCULAR' && x.observed).length }
    const rawWorst = all.map((r, i) => ({ r, c: rawCls[i] })).filter((x) => x.c === 'OBSERVED_OUTSIDE').sort((a, b) => Math.abs(b.r.residualM) - Math.abs(a.r.residualM)).slice(0, 3).map((x) => `${x.r.kind} ${round6(x.r.residualM)} m`).join('; ')
    const cls = mine.map((r) => ({ r, c: classifyResidual(r, emitted) }))
    const by = (c: ResidualClass) => cls.filter((x) => x.c === c)
    const within = by('OBSERVED_WITHIN')
    const outside = by('OBSERVED_OUTSIDE')
    const observed = within.length + outside.length
    const outsideFeatures = new Set(outside.map((x) => x.r.featureId))
    const facadeOpenings = facade ? input.openings.filter((o) => o.facade === facade && emitted.has(o.id)) : []
    const checkedOpenings = new Set(cls.filter((x) => x.c === 'OBSERVED_WITHIN' || x.c === 'OBSERVED_OUTSIDE').map((x) => x.r.objectId))
    const kinds = [...new Set(cls.filter((x) => x.c.startsWith('OBSERVED')).map((x) => x.r.kind))].sort()
    const worst = [...outside].sort((a, b) => Math.abs(b.r.residualM) - Math.abs(a.r.residualM)).slice(0, 5)
    const measured: Record<string, number | string> = {
      rawChecks: all.length,
      rawObserved,
      rawOutsideTolerance: rawOutside,
      ...(rawWorst ? { rawWorst } : {}),
      excludedDisputed: excluded.DISPUTED,
      excludedUnavailable: excluded.UNAVAILABLE,
      excludedCircular: excluded.CIRCULAR,
      ...(adj ? { along: adj.along, vertical: adj.vertical, hand: adj.hand } : {}),
      ...(adj?.along === 'DISPUTED' ? { alongDispute: adj.why.along.slice(0, 300) } : {}),
      ...(adj?.vertical === 'DISPUTED' ? { verticalDispute: adj.why.vertical.slice(0, 300) } : {}),
      ...(v.mpp !== undefined ? { solverMpp: v.mpp } : {}),
      checks: mine.length,
      observed,
      withinTolerance: within.length,
      outsideTolerance: outside.length,
      notObserved: by('NOT_OBSERVED').length,
      notEmitted: by('NOT_EMITTED').length,
      outsideFeatures: outsideFeatures.size,
      worst: worst.map((x) => `${x.r.kind} ${x.r.featureId} ${round6(x.r.residualM)} m (tol ${round6(x.r.toleranceM)})`).join('; '),
    }
    const tolerance = { perCheck: 'each feature’s own source uncertainty (openings +0.1 m, roof edge 0.25 m)', disagreeShare: round6(DISAGREE_SHARE), stableFeatures: STABLE_FEATURES }
    const coverage = { kindsObserved: kinds.join(', ') || 'none', facadeOpenings: facadeOpenings.length, facadeOpeningsChecked: facadeOpenings.filter((o) => checkedOpenings.has(o.id)).length, mpp: v.mpp ?? 0, executed: observed, independent: 0 }
    const evidence = ['every check searches the view near the model’s prediction (MODEL_ANCHORED): an edge found there is not an independent confirmation', ...alignEvidence, ...(by('NOT_EMITTED').length > 0 ? [`${by('NOT_EMITTED').length} check(s) were made on objects the delivered model does not contain and are not counted`] : [])]
    const label = `${v.side} elevation ${v.frameId}`
    const base = { source, measured, tolerance, coverage, checks: records, ...(adj ? { adjudication: { along: adj.along, vertical: adj.vertical, hand: adj.hand } } : {}) }
    if (observed === 0 && (excluded.DISPUTED > 0 || adj?.along === 'DISPUTED')) {
      items.push({ status: 'UNCHECKED', objects: [v.frameId], ...base, code: 'REGISTRATION_DISPUTED', why: `${label}: its ${adj?.along === 'DISPUTED' ? 'along' : 'vertical'} registration is disputed (${(adj?.along === 'DISPUTED' ? adj.why.along : adj?.why.vertical ?? '').slice(0, 220)}): the ${rawObserved} residual(s) measured in it (${rawOutside} outside tolerance${rawWorst ? `, worst ${rawWorst.split('; ')[0]}` : ''}) are kept, but are not evidence about the model`, evidence: ['the raw residuals and the solver’s hypothesis are kept on this item (checks, measured.raw*); none is counted as a conflict or a pass', ...alignEvidence] })
      continue
    }
    if (observed === 0 && excluded.UNAVAILABLE + excluded.CIRCULAR > 0) {
      items.push({ status: 'UNCHECKED', objects: [v.frameId], ...base, code: excluded.UNAVAILABLE > 0 ? 'AXIS_UNAVAILABLE' : 'ONLY_REGISTRATION_SELF_CHECKS', why: `${label}: no check stands on valid axes — ${excluded.UNAVAILABLE} need an axis that is not registered${excluded.CIRCULAR > 0 ? `, ${excluded.CIRCULAR} only check the registration itself (the width the view was registered by)` : ''}`, evidence: [...alignEvidence] })
      continue
    }
    if (observed > 0 && outsideFeatures.size >= STABLE_FEATURES && outside.length / observed >= DISAGREE_SHARE) {
      items.push({ status: 'CONFLICT', objects: [...outsideFeatures].sort(), ...base, code: 'ELEVATION_DISAGREES', why: `${label}: ${outside.length} of ${observed} observed checks on ${outsideFeatures.size} features stand outside tolerance (worst ${worst[0] ? `${worst[0].r.kind} ${round6(worst[0].r.residualM)} m` : '—'}): the registered view and the model disagree`, evidence })
    } else if (observed > 0 && outside.length === 0) {
      items.push({ status: 'PASS', objects: [v.frameId], ...base, code: 'ELEVATION_AGREES_MODEL_ANCHORED', why: `${label}: all ${observed} observed checks within tolerance (${kinds.join(', ')}); ${coverage.facadeOpenings - coverage.facadeOpeningsChecked} of ${coverage.facadeOpenings} facade openings not checked`, evidence })
    } else {
      items.push({ status: 'UNCHECKED', objects: [v.frameId], ...base, code: observed === 0 ? 'NOTHING_OBSERVED' : 'DISAGREEMENT_NOT_STABLE', why: observed === 0 ? `${label}: registered, but no check found an image edge to compare (${by('NOT_OBSERVED').length} not observed)` : `${label}: ${outside.length} of ${observed} observed checks outside tolerance on ${outsideFeatures.size} feature${outsideFeatures.size === 1 ? '' : 's'} — ${outsideFeatures.size < STABLE_FEATURES ? 'one feature only' : `under the third (${round6(outside.length / observed)}) the cross-view summary calls DISAGREES`}: named, not a stable disagreement`, evidence })
    }
  }
  if (items.length === 0) items.push({ status: 'UNCHECKED', objects: [], source: null, measured: {}, tolerance: {}, coverage: {}, code: 'NO_ELEVATION', why: 'the source package has no elevation: nothing to compare', evidence: [] })
  return {
    id: 'R5_REGISTERED_ELEVATIONS',
    title: 'registered elevations agree with the model',
    direction: 'SOURCE_AND_MODEL',
    status: combineStatus(items),
    counts: countStatuses(items),
    items,
    limits: ['only silhouette-registered views are compared; every check is anchored on the model’s prediction', 'an opening the view draws and the model lacks is not measured here (facade alignment lists it as evidence)', 'no new registration is attempted: a view without a ridge datum stays UNCHECKED', 'N9-02R: a check counts only on axes the shared adjudication holds valid; a disputed registration makes the view UNCHECKED with its raw residuals kept'],
  }
}
