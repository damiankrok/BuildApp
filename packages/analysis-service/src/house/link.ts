/**
 * v3.54.4 pilot — one link through LOCAL and through the whole-house description, and the house that stands.
 *
 *   LOCAL (the drawings' path, unchanged)  ──┐
 *                                            ├─ arbitrate on source facts ─→ one accepted model, scene and summary
 *   reading → house document → resolve/build ┘      + the house document (observations, geometry, verification)
 *
 * The reader is asked without being shown LOCAL's result. LOCAL may fail (a page whose plan scale it cannot establish):
 * the description is then the only model. LOCAL stays wherever it meets the source facts the description meets. The
 * house document is kept either way — it says what was read, what was agreed, what was held and which house stood.
 */
import { compileBuilding, geometryClosureAudit } from '@buildapp/geometry'
import { buildMobileSceneBundle, serializeBundle, sha256 } from '@buildapp/mobile-scene'
import { parseModel, serializeModel } from '@buildapp/model'
import type { CanonicalBuildingModel } from '@buildapp/model'
import type { BuildingCommand } from '@buildapp/commands'
import { HOUSE_BUILDER_LABEL, HOUSE_BUILDER_VERSION, HOUSE_RESOLVER_VERSION, sealCandidate } from '@buildapp/reconstruction'
import type { ReconstructionCandidate } from '@buildapp/reconstruction'
import { sha256Hex, stableJson } from '@buildapp/source-common'
import type { SourcePackage } from '@buildapp/source-package'
import { AnalysisError } from '../errors.js'
import { identityOf } from '../identity.js'
import type { AnalysisIdentity } from '../identity.js'
import { runAnalysis } from '../run.js'
import type { AnalysisInput, AnalysisOptions, AnalysisRun } from '../run.js'
import type { LinkAnalysisResult } from '../result.js'
import type { AnalysisWarning } from '../warnings.js'
import { MODEL_ASSESSMENT_SCHEMA_VERSION } from '../assessment/types.js'
import type { ModelAssessment } from '../assessment/types.js'
import { programmedResult } from '../programmed-result.js'
import { arbitrate, compileHouse, documentFromReading, extrasInput, planFactsForFacades } from './describe.js'
import type { Arbitration, CompiledHouse, LocalMeasure } from './describe.js'
import { deliveredQuality } from './describe.js'
import { measureScene } from './measure.js'
import { housePictures } from './pictures.js'
import { acceptedBinding, bindingDiffers } from './accepted.js'
import type { AcceptedReuse, AcceptedRevision, AcceptedRevisionStore } from './accepted.js'
import { HOUSE_READING_CONTRACT, HOUSE_READING_VERSION, ReadingFailed, readExtras, readFacades, readInventory, readPlan } from './read.js'
import type { ReadingContext, ReadingRecord } from './read.js'
import { reviewHouse } from './review.js'
import { interiorSourceOf } from './interior-source.js'
import type { DefectRecord, ReviewPair, ReviewRound, Supplement } from './review.js'
import type { Proposal } from './review.js'

export const HOUSE_PATH_VERSION = '0.8.0'
export type HouseDescriber = Pick<ReadingContext, 'modelFor' | 'price' | 'spend'> & {
  review?: boolean
  /** v3.54.6 (D39): the host's accepted revisions; with one under this analysis' binding, its answers are replayed. */
  accepted?: AcceptedRevisionStore
  /** v3.54.6: a re-analysis asked for — read afresh as a separate candidate, the accepted revision kept. */
  reanalyse?: boolean
}
export type HouseLinkOutcome = {
  /** The accepted run's result and scene, in the drawings path's contract; absent when neither path gave a model. */
  run?: Pick<AnalysisRun, 'result' | 'sceneText'>
  /** The house document as text, when the reading reached one. */
  houseText?: string
  /** v3.54.5: LOCAL's model, kept as the superseded revision when the described exterior stands and LOCAL held an interior. */
  supersededLocalText?: string
  decision: Arbitration
  local: { built: boolean; code?: string }
  described: { status: 'BUILT' | 'NOT_RESOLVED' | 'PARSE_REJECTED' | 'NOT_READ'; why?: string; modelHash?: string }
  records: ReadingRecord[]
  proposals: Proposal[]
  /** v3.54.7: the review as data — its defects (with regions measured before and after), the source/render pairs by hash, the targeted re-readings. */
  review?: { defects: DefectRecord[]; pairs: ReviewPair[]; supplements: Supplement[] }
  /** v3.54.6 (D39): whether an accepted revision was reused, a new candidate read beside it, or this one accepted now. */
  reuse?: AcceptedReuse
  error?: AnalysisError
}

const WARN = (code: string, severity: AnalysisWarning['severity'], message: string): AnalysisWarning => ({ code, severity, message })

function localMeasure(run: AnalysisRun): LocalMeasure | undefined {
  const model = run.result.model
  const m = measureScene(buildMobileSceneBundle(model, { scene: compileBuilding(parseModel(serializeModel(model)) as never) }))
  if (!m.exteriorWalls) return undefined
  const groundLevel = [...model.levels].sort((p, q) => p.elevation - q.elevation).find((l) => l.elevation >= -0.01)?.id
  const ground = model.slabs.filter((s) => s.levelId === groundLevel)
  const shoelace = (p: ReadonlyArray<{ x: number; z: number }>): number => Math.abs(p.reduce((s, a, i) => s + a.x * p[(i + 1) % p.length].z - p[(i + 1) % p.length].x * a.z, 0)) / 2
  return { widthM: m.exteriorWalls.widthM, depthM: m.exteriorWalls.depthM, heightAboveTerrainM: null, topAboveGroundFloorM: m.roofTopY ?? m.buildingTopY, groundAreaM2: ground.length ? ground.reduce((s, x) => s + shoelace(x.polygon), 0) : null, roofPlanes: model.roofPlanes.length + model.roofs.length, groundPolygons: ground.map((x) => x.polygon.map((p) => ({ x: p.x, z: p.z }))), levelElevations: model.levels.map((l) => l.elevation), rooms: (model as unknown as { rooms?: unknown[] }).rooms?.length ?? 0, interiorWalls: model.walls.filter((w) => (w as unknown as { kind?: string }).kind === 'INTERIOR').length, openings: m.openings, sides: m.sides }
}

/** The described house in the drawings path's result contract: sealed candidate, model, scene, what is known of it. */
export function houseResult(input: { pkg: SourcePackage; identity: AnalysisIdentity; sourceUrl: string; jobId: string | null; compiled: CompiledHouse; decision: Arbitration; records: ReadingRecord[]; readerModel: string; startedAt: string; now: () => Date }): Pick<AnalysisRun, 'result' | 'sceneText'> {
  const { pkg, identity, compiled } = input
  const built = compiled.built
  if (!built || !compiled.document.geometry) throw new AnalysisError('ANALYSIS_FAILED', 'the described house has no built model')
  const doc = compiled.document
  const g = compiled.document.geometry
  const v = doc.verification
  const observationsHash = sha256Hex(stableJson(doc.observations))
  const geometryHash = sha256Hex(stableJson(g))
  const unresolved = [
    ...v.held.map((h, i) => ({ id: `house-held-${i + 1}`, what: h.ref, reason: `${h.code}: ${h.why}`.slice(0, 300), status: (h.code === 'CAPABILITY_MISSING' || h.code === 'SOURCE_UNKNOWN' ? 'NOT_ATTEMPTED' : 'REFUSED') as 'NOT_ATTEMPTED' | 'REFUSED', observationIds: [] })),
    ...doc.observations.unknowns.map((u, i) => ({ id: `house-unknown-${i + 1}`, what: u.slice(0, 200), reason: 'the sources do not let the reader tell', status: 'MISSING' as const, observationIds: [] })),
  ]
  const passed = v.checks.filter((c) => c.status === 'PASS').length
  const failedChecks = v.checks.filter((c) => c.status === 'FAIL')
  const warningDetails: AnalysisWarning[] = [
    WARN('MODEL_FROM_WHOLE_HOUSE_DESCRIPTION', 'LIMITING', `This exterior was built from a description of the page's drawings read as a whole (${input.records.length} reading step(s), by ${input.readerModel}); the program checked it against the printed dimensions, levels and elevations (${passed} checks passed, ${failedChecks.length} failed) and built only what it could place. ${(() => { const gi = doc.geometry?.interior; return gi && (gi.status === 'BUILT' || gi.status === 'PARTIAL') ? `The interior comes from LOCAL's reading of the plans, placed through a checked transform (${gi.status}).` : 'The interior is not built.' })()}`),
    WARN('HOUSE_DECISION', input.decision.partial ? 'LIMITING' : 'INFO', `Which model stands (${input.decision.code}${input.decision.partial ? ', a PARTIAL preview' : ''}): ${input.decision.why}`.slice(0, 600)),
    ...(v.status ? [WARN('HOUSE_STATUS', v.status.exterior === 'COMPLETE_IN_SCOPE' ? 'INFO' : 'LIMITING', `Sources: ${v.status.sources}. Built geometry: ${v.status.geometry}. Exterior: ${v.status.exterior}.${v.status.missing.length ? ` Not accounted for: ${v.status.missing.slice(0, 6).join(' | ')}` : ''}`.slice(0, 700))] : []),
    WARN('HOUSE_INTERIOR', 'INFO', input.decision.interior.slice(0, 400)),
    ...(failedChecks.length > 0 ? [WARN('HOUSE_CHECKS_FAILED', 'LIMITING', failedChecks.map((c) => `${c.what}: ${c.measured}`).join('; ').slice(0, 600))] : []),
    ...(v.held.length > 0 ? [WARN('HOUSE_ITEMS_NOT_BUILT', 'LIMITING', `${v.held.length} item(s) read on the sources were not built: ${v.held.slice(0, 6).map((h) => `${h.ref} (${h.code})`).join('; ')}${v.held.length > 6 ? '; …' : ''}`)] : []),
    ...v.knownDefects.slice(0, 8).map((d) => WARN(`HOUSE_${d.code}`, 'INFO', d.what.slice(0, 300))),
    ...(v.quantities !== 'USABLE_IN_SCOPE' ? [WARN('HOUSE_QUANTITIES_LIMITED', 'LIMITING', `Quantities from this model: ${v.quantities}. It is a model for viewing the exterior, not a bill of quantities.`)] : []),
  ]
  const pictures = doc.source.pictures.filter((p) => p.thisHouse !== false)
  const uncheckedItems = pictures.map((p) => ({ kind: (p.role === 'PLAN' ? 'PLAN' : p.role === 'ELEVATION' ? 'ELEVATION' : p.role === 'SECTION' ? 'SECTION' : 'PERSPECTIVE') as 'PLAN' | 'ELEVATION' | 'SECTION' | 'PERSPECTIVE', extent: 'NONE' as const, assetId: p.assetId ?? p.id, reason: 'read by the whole-house reader; checked by the resolver against printed dimensions and against the other pictures, not pixel by pixel' }))
  // v3.54.17 R2: the envelope is shared with the body built without LOCAL (`programmed-result.ts`)
  const out = programmedResult({
    pkg,
    identity,
    sourceUrl: input.sourceUrl,
    jobId: input.jobId,
    label: `${identity.title} (${HOUSE_BUILDER_LABEL.toLowerCase()})`,
    program: built.fitted as BuildingCommand[],
    candidate: {
      observationGraphId: `${HOUSE_READING_CONTRACT}-${HOUSE_READING_VERSION}`,
      observationGraphHash: observationsHash,
      metricEvidenceId: 'house-document-dimensions',
      metricEvidenceHash: sha256Hex(stableJson({ dimensions: doc.observations.dimensions, levels: doc.observations.levels, published: doc.observations.published })),
      hypothesisSetId: 'house-document-geometry',
      hypothesisSetHash: geometryHash,
      structuralLayoutId: 'house-document-bodies',
      structuralLayoutHash: sha256Hex(stableJson(g.bodies)),
      solver: { name: 'house-document', version: `${HOUSE_RESOLVER_VERSION}+builder-${HOUSE_BUILDER_VERSION}` },
    },
    unresolved,
    kernelRefusals: built.kernelRefusals,
    warningDetails,
    counts: { observations: doc.observations.dimensions.length + doc.observations.levels.length + doc.observations.outlines.length + doc.observations.elevations.reduce((s, e) => s + e.bodies.length + e.openings.length + e.features.length, 0), frames: pictures.length, metricEvidence: doc.observations.dimensions.length + doc.observations.levels.length, masses: g.bodies.length },
    quality: (model) => ({ levels: { L0: g.bodies.length + model.openings.length, L1: 0, L2: 0 }, byFamily: {} }),
    provisional: [...((): Array<{ code: string; what: string }> => { const gi = doc.geometry?.interior; return gi && (gi.status === 'BUILT' || gi.status === 'PARTIAL') ? [{ code: 'INTERIOR_FROM_LOCAL', what: `the interior is LOCAL's, placed through a checked transform (${gi.status}): ${String(gi.note ?? '').slice(0, 160)}` }] : [{ code: 'EXTERIOR_ONLY', what: 'the interior is not built: walls, roofs and openings of the exterior only' }] })(), ...v.knownDefects.slice(0, 6).map((d) => ({ code: d.code, what: d.what.slice(0, 200) }))],
    unchecked: uncheckedItems,
    notes: {
      technical: 'technical validity of the described house: what the validator, the compiler and the joint audit say of it',
      decomposition: 'no room decomposition: the described house is its exterior',
      sourceFidelity: `the house document's own checks stand in the warnings (${passed} passed, ${failedChecks.length} failed); the drawings path's pixel relations were not run on this model`,
      registration: 'the house document registers its elevations to its plan itself (verification.checks)',
      summary: (technicalErrors) => `Described exterior: ${passed} source checks passed, ${failedChecks.length} failed, ${v.held.length} item(s) not built, ${technicalErrors} technical error(s).`,
    },
    residualsOutsideTolerance: failedChecks.length,
    vision: { mode: 'LIVE_PROVIDER', provider: `anthropic-messages:${input.readerModel}`, attempted: input.records.length, accepted: 1 },
    analyzer: { service: `house-${HOUSE_PATH_VERSION}`, solver: `house-document-${HOUSE_RESOLVER_VERSION}+builder-${HOUSE_BUILDER_VERSION}+reading-${HOUSE_READING_VERSION}` },
    startedAt: input.startedAt,
    now: input.now,
  })
  return { result: out.result, sceneText: out.sceneText }
}

/** One link: LOCAL, the whole-house description, and the decision. Never throws for a failed reading: LOCAL then stands. */
export async function describeLink(input: AnalysisInput, options: AnalysisOptions, describer: HouseDescriber): Promise<HouseLinkOutcome> {
  const now = options.now ?? (() => new Date())
  const startedAt = now().toISOString()
  const records: ReadingRecord[] = []
  let proposals: Proposal[] = []
  let reviewOut: { defects: DefectRecord[]; pairs: ReviewPair[]; supplements: Supplement[]; roundLog?: ReviewRound[] } = { defects: [], pairs: [], supplements: [] }
  let localRun: AnalysisRun | undefined
  let localError: AnalysisError | undefined
  let pkg: SourcePackage | undefined
  try {
    localRun = await runAnalysis(input, options)
    pkg = localRun.pkg
  } catch (e) {
    if (options.signal?.aborted || !(e instanceof AnalysisError)) throw e
    localError = e
    pkg = e.attachments?.pkg
  }
  const local = { built: !!localRun, ...(localError ? { code: localError.detail.reasonCode ?? localError.code } : {}) }
  const none = (why: string, status: HouseLinkOutcome['described']['status']): HouseLinkOutcome => ({ ...(localRun ? { run: localRun } : {}), decision: { accepted: localRun ? 'LOCAL' : 'NONE', why, findings: [], code: localRun ? 'DESCRIBED_REJECTED_LOCAL_KEPT' : 'NO_MODEL', partial: false, contradictions: [], unknown: [], interior: localRun ? 'LOCAL stands with whatever interior it has: nothing is removed' : 'no model stands' }, local, described: { status, why }, records, proposals, ...(localError && !localRun ? { error: localError } : {}) })
  if (!pkg) return none('no source package was sealed: nothing to read', 'NOT_READ')
  const published = (pkg.publishedFacts ?? []).filter((f) => typeof f.value === 'number' && Number.isFinite(f.value)).map((f) => ({ key: f.key, value: f.value as number, unit: String(f.unit ?? ''), ...(f.raw ? { raw: String(f.raw) } : {}) }))
  const ctx: ReadingContext = { modelFor: describer.modelFor, price: describer.price, ...(describer.spend ? { spend: describer.spend } : {}), record: (r) => void records.push(r), ...(options.signal ? { signal: options.signal } : {}) }
  const identity = { ...identityOf(pkg, options.adapters), ...options.identity }
  let compiled: CompiledHouse
  let reused: AcceptedRevision | undefined
  let reuse: AcceptedReuse | undefined
  let bindingKey: string | undefined
  let bindingNow: AcceptedRevision['binding'] | undefined
  try {
    const { pictures, skipped } = await housePictures(pkg.assets as never, options.cache)
    const notSent = skipped
    // v3.54.6 (D39): an accepted revision under this binding is replayed — the same answers, the same house, no request
    if (describer.accepted) {
      const b = acceptedBinding({ adapterId: pkg.adapter.id, externalId: pkg.project.externalId ?? pkg.canonicalUrl, pictures, published, reader: `${HOUSE_READING_CONTRACT}@${HOUSE_READING_VERSION}`, resolver: HOUSE_RESOLVER_VERSION, builder: HOUSE_BUILDER_VERSION, model: ctx.modelFor('PLAN').model, review: describer.review !== false })
      bindingKey = b.key
      bindingNow = b.binding
      const hit = describer.reanalyse ? undefined : describer.accepted.get(b.key)
      if (hit) {
        reused = hit
        ctx.replay = (step, round) => hit.records.find((r) => r.step === step && (r.round ?? 0) === (round ?? 0))
        ctx.replayOnly = true
      } else {
        const previous = describer.accepted.forVariant(b.binding.variant).slice(-1)[0]
        reuse = { state: 'NEW_CANDIDATE', key: b.key, why: describer.reanalyse ? 'REANALYSIS_ASKED' : previous ? 'BINDING_DIFFERS' : 'NO_ACCEPTED_REVISION', differs: previous ? bindingDiffers(previous.binding, b.binding) : [], ...(previous ? { previous: previous.key } : {}) }
      }
    }
    const inventory = await readInventory(ctx, pictures, `publisher: ${pkg.project.publisher}`)
    if (!inventory.selection) return none(inventory.why ?? 'no ground-floor plan among the pictures', 'NOT_READ')
    const selection = inventory.selection
    const plan = await readPlan(ctx, selection, published)
    // v3.54.9: LOCAL's interior goes into the document as a source; the resolver places it only through a checked transform
    const interiorSource = localRun ? interiorSourceOf(localRun.result.model, serializeModel(localRun.result.model)) : undefined
    const base = { id: `h-${identity.slug}`.slice(0, 80), project: pkg.project.name, sourcePackageHash: pkg.contentHash, model: ctx.modelFor('PLAN').model, selection, planSent: plan.sent, published, at: startedAt.slice(0, 10), skipped: notSent, ...(interiorSource ? { interiorSource } : {}) }
    if (selection.elevations.length + selection.sections.length > 0) {
      const planOnly = compileHouse(documentFromReading({ ...base, answers: { plan: plan.answer } }).document, identity.modelId)
      const bodiesInMetres = planOnly.document.geometry ? planFactsForFacades(planOnly.document.geometry) : ''
      const facades = await readFacades(ctx, selection, plan.answer, bodiesInMetres, published)
      // v3.54.10: DETAILS and one STOREY reading per plan (an accepted revision recorded before them says they were not read)
      const extras = await readExtras(ctx, selection, facades, plan.answer.bodies.map((b) => b.id))
      const ex = extrasInput(extras, records)
      const converted = documentFromReading({ ...base, facadesSent: facades.sent, coverage: facades.coverage, ...(ex.detailsSent ? { detailsSent: ex.detailsSent } : {}), idRule: ex.idRule, notRead: ex.notRead, answers: { inventory: inventory.answer, plan: plan.answer, facades: facades.answer, ...ex.answers } })
      compiled = compileHouse(JSON.parse(JSON.stringify(converted.document)), identity.modelId)
      if (describer.review !== false && compiled.bundle) {
        const reviewed = await reviewHouse({ ctx, selection, facadesSent: facades.sent, observationsDocument: converted.document, compiled, modelId: identity.modelId })
        compiled = reviewed.compiled
        proposals = reviewed.proposals
        reviewOut = { defects: reviewed.defects, pairs: reviewed.pairs, supplements: reviewed.supplements, roundLog: reviewed.roundLog }
      }
    } else compiled = compileHouse(documentFromReading({ ...base, answers: { inventory: inventory.answer, plan: plan.answer } }).document, identity.modelId)
  } catch (e) {
    if (options.signal?.aborted) throw e
    return none(e instanceof ReadingFailed ? `${e.code}: ${e.message.slice(0, 200)}` : `the reading failed: ${String((e as Error)?.message ?? e).slice(0, 200)}`, 'NOT_READ')
  }
  const decision = arbitrate(compiled, localRun ? localMeasure(localRun) : undefined, published, { defects: reviewOut.defects })
  decision.quality = deliveredQuality(decision, reviewOut.defects)
  // the model handed back, whichever it is (the described house, or LOCAL kept): what the revision is held to
  const deliveredHash = decision.accepted === 'DESCRIBED' ? compiled.modelHash : decision.accepted === 'LOCAL' && localRun ? sha256Hex(serializeModel(localRun.result.model)) : undefined
  if (reused) reuse = { state: 'REUSED', key: reused.key, acceptedAt: reused.acceptedAt, sameGeometry: deliveredHash === reused.modelHash, ...(reused.quality ? { sameQuality: reused.quality === decision.quality.status } : {}) }
  // the house handed back is the accepted revision of its binding (a partial preview stays one, and says so); an earlier
  // revision is never replaced, and a re-analysis asked for stays a candidate beside it
  else if (describer.accepted && bindingKey && bindingNow && !describer.reanalyse && deliveredHash && !describer.accepted.get(bindingKey)) {
    if (describer.accepted.put({ schema: 'buildapp.accepted-house-revision', version: '1.0.0', key: bindingKey, binding: bindingNow, acceptedAt: now().toISOString(), modelHash: deliveredHash, quality: decision.quality.status, records })) reuse = { state: 'ACCEPTED_NOW', key: bindingKey, ...(reuse?.state === 'NEW_CANDIDATE' && reuse.previous ? { differs: reuse.differs, previous: reuse.previous } : {}) }
  }
  const describedStatus = compiled.rejected ? 'PARSE_REJECTED' : compiled.bundle ? 'BUILT' : 'NOT_RESOLVED'
  // which house stood is part of the document, whichever it was
  const doc = compiled.document
  if (!compiled.rejected) {
    doc.verification.knownDefects.push({ code: `ACCEPTED_${decision.accepted}`, what: `${decision.code}${decision.partial ? ' (PARTIAL PREVIEW)' : ''}: ${decision.why}`.slice(0, 500) })
    if (reuse) doc.verification.knownDefects.push({ code: `REVISION_${reuse.state}`, what: (reuse.state === 'REUSED' ? `the accepted revision ${reuse.key} (${reuse.acceptedAt}) was replayed: no request; ${reuse.sameGeometry ? 'the same model' : 'A DIFFERENT MODEL — the replay does not reproduce it'}${reuse.sameQuality === false ? '; A DIFFERENT QUALITY STATUS than when it was accepted' : reuse.sameQuality ? '; the same quality status' : ''}` : reuse.state === 'ACCEPTED_NOW' ? `this reading is the accepted revision ${reuse.key}${reuse.previous ? ` of its binding; ${(reuse.differs ?? []).join(', ')} differ from ${reuse.previous}, which is kept` : ''}` : `a new candidate ${reuse.key} (${reuse.why}${reuse.differs.length ? `: ${reuse.differs.join(', ')} differ from ${reuse.previous}` : ''}); the earlier revision is kept`).slice(0, 400) })
    if (decision.accepted === 'DESCRIBED') doc.verification.knownDefects.push({ code: 'INTERIOR', what: decision.interior.slice(0, 400) })
    // v3.54.7 (D40): what of the form reached the user, and every important defect of the review still open on it
    doc.verification.knownDefects.push({ code: `QUALITY_${decision.quality.status}`, what: `${decision.quality.why}${decision.quality.sides.length ? ` — ${decision.quality.sides.map((x) => `${x.side}: ${[x.met.length ? `${x.met.length} met` : '', x.failing.length ? `failing ${x.failing.join('; ')}` : '', x.openDefects.length ? `open ${x.openDefects.join('; ')}` : ''].filter(Boolean).join(', ')}`).join(' | ')}` : ''}`.slice(0, 900) })
  }
  const houseText = compiled.rejected ? undefined : `${JSON.stringify(doc)}\n`
  const described = { status: describedStatus as HouseLinkOutcome['described']['status'], ...(compiled.modelHash ? { modelHash: compiled.modelHash } : {}), ...(compiled.rejected ? { why: compiled.rejected.slice(0, 3).join('; ') } : {}) }
  // v3.54.6 (D38): the revision handed back is measured again — the model whose facts the choice compared, and no other
  const deliveredCheck = (which: 'DESCRIBED' | 'LOCAL', model: CanonicalBuildingModel, measuredModelHash: string): NonNullable<Arbitration['delivered']> => {
    const text = serializeModel(model)
    const modelHash = sha256Hex(text)
    const m = measureScene(buildMobileSceneBundle(model, { scene: compileBuilding(parseModel(text) as never) }))
    return { which, modelHash, measuredModelHash, same: modelHash === measuredModelHash, widthM: m.exteriorWalls?.widthM ?? null, depthM: m.exteriorWalls?.depthM ?? null, topM: m.roofTopY ?? m.buildingTopY }
  }
  if (decision.accepted === 'LOCAL' && localRun) decision.delivered = deliveredCheck('LOCAL', localRun.result.model, sha256Hex(serializeModel(localRun.result.model)))
  if (decision.accepted === 'DESCRIBED') {
    const run = houseResult({ pkg, identity, sourceUrl: input.kind === 'URL' ? input.url : pkg.canonicalUrl, jobId: options.jobId ?? null, compiled, decision, records, readerModel: ctx.modelFor('PLAN').model, startedAt, now })
    // LOCAL's rooms and interior walls are not attached to another outline unchecked, and they are not thrown away
    const lm = localRun ? localMeasure(localRun) : undefined
    const supersededLocalText = localRun && lm && (lm.rooms ?? 0) + (lm.interiorWalls ?? 0) > 0 ? serializeModel(localRun.result.model) : undefined
    decision.delivered = deliveredCheck('DESCRIBED', run.result.model, compiled.modelHash ?? '')
    if (!decision.delivered.same) doc.verification.knownDefects.push({ code: 'DELIVERED_DIFFERS', what: `the model handed back (${decision.delivered.modelHash.slice(0, 12)}) is not the one the choice measured (${(compiled.modelHash ?? '').slice(0, 12)})` })
    return { run, ...(houseText ? { houseText } : {}), ...(supersededLocalText ? { supersededLocalText } : {}), decision, local, described, records, proposals, review: reviewOut, ...(reuse ? { reuse } : {}) }
  }
  return { ...(localRun ? { run: localRun } : {}), ...(houseText ? { houseText } : {}), decision, local, described, records, proposals, review: reviewOut, ...(reuse ? { reuse } : {}), ...(localError && !localRun ? { error: localError } : {}) }
}
