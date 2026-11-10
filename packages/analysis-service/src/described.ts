/**
 * v3.53 — a house read as a whole from all of a page's sources, as an analysis result.
 *
 * The drawings' path (`run.ts`) builds every house from one floor plan's walled outline and its scale; a page whose
 * plan it cannot read ended with no model whatever its elevations and pictures showed. This path asks a reader
 * (`StructuredVision`, source-vision) for ONE description of the building over the page's plans, elevations, section
 * and exterior pictures together with the figures the page publishes, admits it deterministically
 * (`checkHouseDescription`), and builds it through the same BuildingV2 → emitter → validator → compiler as every other
 * model (`reconstructFromHouseDescription`). The result has the drawings path's shape, so every client reads it, and
 * says what it is in every place a client looks: its label, a LIMITING warning by code, `vision.mode`, an
 * `ASSUMED`/`VISUAL_SEMANTIC` status on every object, provisional scale and heights, and nothing it could not check
 * counted as checked. It is a recognisable candidate of the exterior — not a survey, and never USER_CONFIRMED.
 */
import { sha256Hex, stableJson } from '@buildapp/source-common'
import type { SourcePackage, SourceByteCache } from '@buildapp/source-package'
import { decodeImage, encodeJpeg, startDecoders } from '@buildapp/source-package'
import { resampleRaster } from '@buildapp/source-cv'
import type { Raster } from '@buildapp/source-cv'
import {
  HOUSE_DESCRIPTION_SYSTEM,
  HOUSE_DESCRIPTION_VERSION,
  HOUSE_TRIAGE_SCHEMA,
  HOUSE_TRIAGE_SYSTEM,
  HouseReaderUnavailable,
  buildHouseDescriptionPrompt,
  checkHouseDescription,
  houseDescriptionJsonSchema,
  houseTriagePrompt,
  parseHouseTriage,
  selectHousePictures,
} from '@buildapp/source-vision'
import type { HouseDescription, HouseDescriptionIssue, PictureKind, PublishedFigure, StructuredVision, StructuredVisionUsage, TriagedPicture } from '@buildapp/source-vision'
import { DESCRIBED_HOUSE_BUILDER_VERSION, DESCRIBED_HOUSE_LABEL, reconstructFromHouseDescription, sealCandidate } from '@buildapp/reconstruction'
import type { DescribedAdjustment, ReconstructionCandidate } from '@buildapp/reconstruction'
import { compileBuilding, geometryClosureAudit } from '@buildapp/geometry'
import { buildMobileSceneBundle, serializeBundle, sha256 } from '@buildapp/mobile-scene'
import { parseModel, serializeModel } from '@buildapp/model'
import type { BuildingCommand } from '@buildapp/commands'
import type { AnalysisIdentity } from './identity.js'
import type { LinkAnalysisResult } from './result.js'
import type { AnalysisWarning } from './warnings.js'
import type { ModelAssessment } from './assessment/types.js'
import { MODEL_ASSESSMENT_SCHEMA_VERSION } from './assessment/types.js'
import type { AnalysisStage } from './stages.js'

export const DESCRIBED_PATH_VERSION = '0.1.0'

export type DescribedPicture = { number: number; assetId: string; byteHash: string | null; kind: PictureKind; widthPx: number; heightPx: number }

export type HouseReading = {
  description: HouseDescription
  issues: HouseDescriptionIssue[]
  /** The pictures the description was asked over, as numbered in the request. */
  pictures: DescribedPicture[]
  /** Every picture of the page as it was sorted, by asset. */
  triage: Array<{ assetId: string; kind: PictureKind | null; duplicateOf: number }>
  usage: StructuredVisionUsage[]
  provider: StructuredVision['provider']
}

export class DescribedRefusal extends Error {
  constructor(
    readonly code: 'NO_USABLE_PICTURE' | 'READER_UNAVAILABLE' | 'DESCRIPTION_REFUSED' | 'MODEL_REFUSED',
    message: string,
    readonly issues: HouseDescriptionIssue[] = [],
  ) {
    super(message)
    this.name = 'DescribedRefusal'
  }
}

const fit = (w: number, h: number, max: number): { width: number; height: number } => {
  const k = Math.min(1, max / Math.max(w, h))
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) }
}
const jpegOf = (raster: Raster, max: number, quality: number): { bytes: Uint8Array; width: number; height: number } => {
  const r = resampleRaster(raster, fit(raster.width, raster.height, max))
  return { bytes: encodeJpeg(r, quality), width: r.width, height: r.height }
}

export type ReadHooks = { signal?: AbortSignal; onStep?: (step: 'DECODING' | 'SORTING' | 'DESCRIBING' | 'ADMITTING', detail: string) => void; onPictures?: (sent: Array<DescribedPicture & { bytes: Uint8Array }>) => void }

/** The published figures a description is checked against and scaled by: numbers only. */
export const publishedFiguresOf = (pkg: SourcePackage): PublishedFigure[] => (pkg.publishedFacts ?? []).filter((f) => typeof f.value === 'number' && Number.isFinite(f.value)).map((f) => ({ key: f.key, label: f.label, raw: f.raw, value: f.value as number, unit: f.unit }))

/**
 * Sort the page's pictures, ask for one description over the chosen ones, admit it. The reader is told the pictures by
 * number and the published figures — no address, no title, no role a caption claimed, nothing a reference could ride in on.
 */
export async function readHouse(pkg: SourcePackage, cache: SourceByteCache, reader: StructuredVision, hooks: ReadHooks = {}): Promise<HouseReading> {
  if (!reader.available()) throw new DescribedRefusal('READER_UNAVAILABLE', 'no house reader is available on this host')
  await startDecoders()
  hooks.onStep?.('DECODING', `${pkg.assets.length} pictures`)
  const decoded: Array<{ number: number; assetId: string; byteHash: string | null; raster: Raster }> = []
  for (const asset of pkg.assets) {
    const v = asset.variants.find((x) => x.id === asset.selectedVariantId) ?? asset.variants[0]
    const hit = v ? await cache.get(v.url) : null
    if (!v || !hit) continue
    try {
      const raster = decodeImage(hit.bytes)
      if (Math.min(raster.width, raster.height) < 120) continue
      decoded.push({ number: decoded.length + 1, assetId: asset.id, byteHash: v.byteHash ?? null, raster })
    } catch {
      // a picture that does not decode is not shown to the reader; the drawings' path names such assets in its own result
    }
  }
  if (decoded.length === 0) throw new DescribedRefusal('NO_USABLE_PICTURE', 'none of the page’s pictures could be decoded')
  const usage: StructuredVisionUsage[] = []
  const ask = async (request: Parameters<StructuredVision['ask']>[0]): Promise<unknown> => {
    try {
      const r = await reader.ask({ ...request, ...(hooks.signal ? { signal: hooks.signal } : {}) })
      usage.push(r.usage)
      return r.output
    } catch (e) {
      if (e instanceof HouseReaderUnavailable) throw new DescribedRefusal('READER_UNAVAILABLE', `${e.reason}: ${e.message}`)
      throw e
    }
  }
  // --- sorting, forty small pictures at a time
  hooks.onStep?.('SORTING', `${decoded.length} pictures`)
  const triaged: TriagedPicture[] = []
  for (let i = 0; i < decoded.length; i += 40) {
    const batch = decoded.slice(i, i + 40)
    const raw = await ask({ purpose: 'HOUSE_TRIAGE', system: HOUSE_TRIAGE_SYSTEM, text: houseTriagePrompt(batch.length), pictures: batch.map((d) => ({ number: d.number, bytes: jpegOf(d.raster, 320, 70).bytes, mediaType: 'image/jpeg' })), schema: HOUSE_TRIAGE_SCHEMA })
    triaged.push(...parseHouseTriage(raw, new Set(batch.map((d) => d.number))))
  }
  const byNumber = new Map(decoded.map((d) => [d.number, d]))
  const chosen = selectHousePictures(triaged, (n) => (byNumber.get(n)?.raster.width ?? 0) * (byNumber.get(n)?.raster.height ?? 0))
  const triage = decoded.map((d) => ({ assetId: d.assetId, kind: triaged.find((t) => t.number === d.number)?.kind ?? null, duplicateOf: triaged.find((t) => t.number === d.number)?.duplicateOf ?? 0 }))
  if (chosen.length === 0) throw new DescribedRefusal('NO_USABLE_PICTURE', 'the page shows no plan, elevation, section or exterior picture of the building')
  // --- one description over the chosen pictures, renumbered 1..k
  const sent = chosen.map((c, i) => {
    const d = byNumber.get(c.number) as (typeof decoded)[number]
    const j = jpegOf(d.raster, c.kind === 'EXTERIOR_VIEW' ? 1100 : 1568, 88)
    return { number: i + 1, assetId: d.assetId, byteHash: d.byteHash, kind: c.kind, widthPx: j.width, heightPx: j.height, bytes: j.bytes }
  })
  hooks.onPictures?.(sent)
  hooks.onStep?.('DESCRIBING', `${sent.length} pictures`)
  const published = publishedFiguresOf(pkg)
  const raw = await ask({ purpose: 'HOUSE_DESCRIPTION', system: HOUSE_DESCRIPTION_SYSTEM, text: buildHouseDescriptionPrompt({ images: sent.map((s) => ({ number: s.number, widthPx: s.widthPx, heightPx: s.heightPx })), published }), pictures: sent.map((s) => ({ number: s.number, bytes: s.bytes, mediaType: 'image/jpeg' })), schema: houseDescriptionJsonSchema() })
  hooks.onStep?.('ADMITTING', 'checking the description against itself and the published figures')
  const checked = checkHouseDescription(raw, published)
  if (!checked.ok) throw new DescribedRefusal('DESCRIPTION_REFUSED', `the description cannot be built as stated: ${checked.issues.filter((i) => i.severity === 'REJECT').map((i) => `${i.code} ${i.detail}`).join('; ').slice(0, 400)}`, checked.issues)
  return { description: checked.description, issues: checked.issues, pictures: sent.map(({ bytes: _b, ...p }) => p), triage, usage, provider: reader.provider }
}

export type DescribedRun = {
  basis: 'DESCRIPTION'
  result: LinkAnalysisResult
  sceneText: string
  pkg: SourcePackage
  reading: HouseReading
  adjustments: DescribedAdjustment[]
  refused: Array<{ type: string; id?: string; codes: string[]; message: string }>
  /** The drawings path's refusal this run stands in for, by code; null when the description was asked for outright. */
  after: { code: string; reasonCode: string | null } | null
  timings: { readMs: number; buildMs: number; totalMs: number }
}

const WARN = (code: string, severity: AnalysisWarning['severity'], message: string): AnalysisWarning => ({ code, severity, message })

/** The result of a described house, in the drawings path's contract. */
export function describedResult(input: { pkg: SourcePackage; identity: AnalysisIdentity; sourceUrl: string; jobId: string | null; reading: HouseReading; after: DescribedRun['after']; startedAt: string; now: () => Date }): Omit<DescribedRun, 'timings'> {
  const { pkg, identity, reading } = input
  const published = publishedFiguresOf(pkg)
  const built = reconstructFromHouseDescription(reading.description, identity.modelId, { published })
  if (!built.ok) throw new DescribedRefusal('MODEL_REFUSED', built.reason)
  const descriptionHash = sha256Hex(stableJson(reading.description))
  const figuresHash = sha256Hex(stableJson(published))
  const d = reading.description
  const unresolved = [
    ...d.unknowns.map((u, i) => ({ id: `described-unknown-${i + 1}`, what: u.slice(0, 200), reason: 'the sources do not let the reader tell', status: 'MISSING' as const, observationIds: [] })),
    ...d.hypotheticalSides.map((s) => ({ id: `described-side-${s.toLowerCase()}`, what: `the ${s.toLowerCase()} side`, reason: 'no picture of the page shows this side: what stands there is a hypothesis', status: 'NOT_ATTEMPTED' as const, observationIds: [] })),
    ...built.adjustments.filter((a) => a.code === 'OPENING_DROPPED' || a.code === 'FEATURE_DROPPED' || a.code === 'BODY_DROPPED' || a.code === 'ROOF_KIND_STOOD_IN').map((a, i) => ({ id: `described-adjustment-${i + 1}`, what: a.subject, reason: a.why.slice(0, 300), status: 'REFUSED' as const, observationIds: [] })),
    ...built.refused.map((r, i) => ({ id: `described-refused-${i + 1}`, what: r.id ?? r.type, reason: `the model refused it: ${r.codes.join(', ')}`, status: 'REFUSED' as const, observationIds: [] })),
  ]
  const { candidate, model } = sealCandidate(
    {
      schema: 'buildapp.reconstruction-candidate',
      schemaVersion: '1.1.0',
      label: identity.label,
      modelId: identity.modelId,
      sourcePackageId: pkg.id,
      sourcePackageHash: pkg.contentHash,
      // what this candidate was built from: the admitted description (its hash), and the page's published figures
      observationGraphId: `house-description-${HOUSE_DESCRIPTION_VERSION}`,
      observationGraphHash: descriptionHash,
      metricEvidenceId: 'published-figures',
      metricEvidenceHash: figuresHash,
      hypothesisSetId: `house-description-${HOUSE_DESCRIPTION_VERSION}`,
      hypothesisSetHash: descriptionHash,
      structuralLayoutId: 'described-bodies',
      structuralLayoutHash: sha256Hex(stableJson(d.bodies)),
      structuralStatus: 'STRUCTURAL_LAYOUT_PARTIAL',
      solver: { name: 'described-house', version: DESCRIBED_HOUSE_BUILDER_VERSION },
      program: built.program as BuildingCommand[],
      quantities: [],
      contradictions: [],
      unresolved,
      traces: [],
      steps: [],
      residuals: { metricRmsM: 0, metricMaxM: 0, hard: 0, soft: 0, unresolved: unresolved.length },
    } as unknown as Omit<ReconstructionCandidate, 'id' | 'contentHash' | 'modelHash'>,
    identity.slug,
  )
  const modelText = serializeModel(model)
  const scene = compileBuilding(parseModel(modelText) as never)
  const bundle = buildMobileSceneBundle(model, { scene })
  const sceneText = serializeBundle(bundle)
  const closure = geometryClosureAudit(model, scene)
  const compileErrors = scene.diagnostics.filter((x) => x.severity === 'ERROR')
  const exteriorErrors = closure.findings.filter((f) => f.scope === 'EXTERIOR' && f.severity === 'ERROR').length
  const b = built.building
  const printed = d.overall.basis === 'PRINTED_ON_DRAWING'
  const scaled = built.adjustments.find((a) => a.code === 'SCALED_TO_PUBLISHED_FIGURE' || a.code === 'BODIES_RESCALED_TO_OVERALL')
  const dropped = built.adjustments.filter((a) => a.code === 'OPENING_DROPPED' || a.code === 'FEATURE_DROPPED' || a.code === 'BODY_DROPPED')
  const standIns = built.adjustments.filter((a) => a.code === 'ROOF_KIND_STOOD_IN')
  const checkIssues = reading.issues.filter((i) => i.severity === 'WARN')
  const warningDetails: AnalysisWarning[] = [
    WARN('MODEL_FROM_SOURCE_DESCRIPTION', 'LIMITING', `This model was built from a description of the page's pictures read as a whole (${reading.pictures.length} pictures, by ${reading.provider.id} ${reading.provider.model}), not measured on its drawings${input.after ? `: the drawings could not be read (${input.after.reasonCode ?? input.after.code})` : ''}. It shows the building's bodies, roofs and openings as the sources show them; its dimensions are approximate.`),
    WARN(printed ? 'DESCRIBED_SCALE_PRINTED_UNVERIFIED' : 'DESCRIBED_SCALE_APPROXIMATE', 'LIMITING', printed ? `The overall size is the one the reader read printed on a drawing (${d.overall.printedWidthLabel} × ${d.overall.printedDepthLabel}); no deterministic reader confirmed it.` : `The overall size is ${d.overall.basis.toLowerCase().replace(/_/g, ' ')}${scaled ? `; ${scaled.why}` : ''}.`),
    WARN('DESCRIBED_HEIGHTS_APPROXIMATE', 'INFO', 'Storey, eaves and opening heights are the reader’s reading of the sources or a convention; none is a printed level confirmed on a section.'),
    ...d.hypotheticalSides.map((s) => WARN('DESCRIBED_SIDE_HYPOTHETICAL', 'LIMITING', `No picture shows the ${s.toLowerCase()} side: what stands there is a hypothesis.`)),
    ...checkIssues.map((i) => WARN(`DESCRIPTION_${i.code}`, i.code.startsWith('SIDE_') || i.code.includes('DISAGREES') ? 'LIMITING' : 'INFO', i.detail)),
    ...(dropped.length > 0 ? [WARN('DESCRIBED_ITEMS_NOT_BUILT', 'LIMITING', `${dropped.length} stated item(s) could not be built as stated: ${dropped.map((a) => `${a.subject} (${a.why})`).join('; ').slice(0, 600)}`)] : []),
    ...standIns.map((a) => WARN('DESCRIBED_ROOF_STAND_IN', 'LIMITING', `${a.subject}: ${a.why}`)),
    ...(built.refused.length > 0 ? [WARN('DESCRIBED_OBJECTS_REFUSED', 'LIMITING', `The model refused ${built.refused.length} object(s): ${built.refused.map((r) => `${r.id ?? r.type} (${r.codes.join(', ')})`).join('; ')}`)] : []),
    ...(compileErrors.length > 0 ? [WARN('COMPILER_ERRORS', 'LIMITING', `${compileErrors.length} object(s) did not compile: ${compileErrors.slice(0, 4).map((e) => e.code).join(', ')}`)] : []),
  ]
  const byDocument: Record<string, number> = {}
  for (const a of pkg.assets) byDocument[a.roles.document] = (byDocument[a.roles.document] ?? 0) + 1
  const technicalErrors = compileErrors.length + exteriorErrors + built.refused.length
  const uncheckedItems = reading.pictures.map((p) => ({ kind: (p.kind === 'FLOOR_PLAN' ? 'PLAN' : p.kind === 'ELEVATION' ? 'ELEVATION' : p.kind === 'SECTION' ? 'SECTION' : 'PERSPECTIVE') as 'PLAN' | 'ELEVATION' | 'SECTION' | 'PERSPECTIVE', extent: 'NONE' as const, what: `picture ${p.number} (${p.kind.toLowerCase().replace(/_/g, ' ')}), asset ${p.assetId}`, why: 'the model was described from this picture by a reader; no deterministic comparison of the model with it was made', couldCheck: 'a registration of this picture against the model, or a person looking' }))
  const byKind: Record<string, number> = {}
  for (const u of uncheckedItems) byKind[u.kind] = (byKind[u.kind] ?? 0) + 1
  const assessment: ModelAssessment = {
    schema: 'buildapp.model-assessment',
    schemaVersion: MODEL_ASSESSMENT_SCHEMA_VERSION,
    technicalValidity: {
      status: technicalErrors > 0 ? 'ERRORS' : 'VALID',
      errors: technicalErrors,
      warnings: scene.diagnostics.filter((x) => x.severity === 'WARNING').length,
      checks: [
        { check: 'PROGRAM_REFUSALS', errors: built.refused.length, warnings: 0, findings: built.refused.map((r) => ({ code: r.codes[0] ?? 'REFUSED', severity: 'ERROR' as const, ...(r.id ? { objectId: r.id } : {}), message: r.message })) },
        { check: 'COMPILER', errors: compileErrors.length, warnings: 0, findings: compileErrors.slice(0, 12).map((e) => ({ code: e.code, severity: 'ERROR' as const, message: e.message })) },
        { check: 'CLOSURE', errors: exteriorErrors, warnings: 0, findings: [] },
      ],
      note: 'technical validity of the described model: what the validator, the compiler and the joint audit say of it — not its agreement with the sources',
    },
    decompositionCompleteness: { verdict: 'NOT_ASSESSED', basis: 'ACCEPTED_DECOMPOSITION', meaning: 'no plan decomposition was accepted: the model is built from a description of the sources, whose own counts per side are in the warnings' },
    sourceFidelity: { status: 'UNCHECKED', relations: [], counts: { PASS: 0, CONFLICT: 0, UNCHECKED: uncheckedItems.length }, conflicts: [], meaning: 'nothing was compared deterministically: the description is the only link between the sources and this model' },
    sourceUnchecked: { items: uncheckedItems, counts: { total: uncheckedItems.length, byKind, none: uncheckedItems.length, partial: 0 } },
    previewAvailable: true,
    elevationRegistration: { views: [], counts: { before: { FULL: 0, ALONG_ONLY: 0, VERTICAL_ONLY: 0, UNREGISTERED: 0 }, after: { FULL: 0, ALONG_ONLY: 0, VERTICAL_ONLY: 0, UNREGISTERED: 0 } }, slots: { before: 0, after: 0 }, lost: [], datums: { ridgeY: null, terrainY: null }, scorecard: { views: [], totals: { potential: 0, executed: 0, independent: 0, rawObserved: 0 } } } as unknown as ModelAssessment['elevationRegistration'],
    summary: `Described from ${reading.pictures.length} pictures; ${technicalErrors} technical error(s); no source relation was checked deterministically.`,
  }
  const result: LinkAnalysisResult = {
    schema: 'buildapp.link-analysis-result',
    schemaVersion: '1.0.0',
    jobId: input.jobId,
    sourceUrl: input.sourceUrl,
    canonicalUrl: pkg.canonicalUrl,
    title: identity.title,
    label: `${identity.title} (${DESCRIBED_HOUSE_LABEL.toLowerCase()})`,
    modelId: identity.modelId,
    publisher: pkg.project.publisher,
    adapter: { id: pkg.adapter.id, version: pkg.adapter.version },
    sourcePackageId: pkg.id,
    sourcePackageHash: pkg.contentHash,
    observationGraphHash: descriptionHash,
    metricEvidenceHash: figuresHash,
    candidateHash: candidate.contentHash,
    modelHash: candidate.modelHash,
    modelSha256: sha256(modelText),
    sceneContentHash: bundle.contentHash,
    sceneSha256: sha256(sceneText),
    sceneBytes: Buffer.byteLength(sceneText, 'utf8'),
    counts: {
      assets: pkg.assets.length,
      assetsByDocument: byDocument,
      observations: d.openings.length + d.bodies.length + d.dormers.length + d.chimneys.length + d.rooflights.length + d.balconies.length + d.terraces.length + d.canopies.length,
      frames: reading.pictures.length,
      metricEvidence: published.length,
      callouts: 0,
      commands: candidate.program.length,
      masses: b.masses.length,
      openings: b.openings.length,
      rooms: 0,
      balconies: b.balconies.length,
      terraces: b.terraces.length,
      railings: b.railings.length,
      chimneys: b.chimneys.length,
      rooflights: b.rooflights.length,
      meshes: bundle.scene.meshes.length,
      triangles: bundle.scene.meshes.reduce((a, m) => a + m.positions.length / 9, 0),
    },
    // every described feature is topology read off appearance: none earns a metric level
    quality: { levels: { L0: b.masses.length + b.openings.length, L1: 0, L2: 0 }, byFamily: {} },
    unresolved: unresolved.map((u) => ({ what: u.what, reason: u.reason, status: u.status })),
    warnings: warningDetails.map((w) => w.message),
    warningDetails,
    preview: {
      outcome: built.refused.length > 0 ? 'PARTIAL_3D_PREVIEW' : 'COMPLETE',
      built: { wallRings: model.wallRings.length, walls: model.walls.length, slabs: model.slabs.length, roofs: model.roofs.length, roofPlanes: model.roofPlanes.length, openings: model.openings.length, rooms: model.rooms.length, stairs: model.stairs.length },
      provisional: [
        { code: 'SCALE_NOT_VERIFIED', what: `the overall size is ${d.overall.basis.toLowerCase().replace(/_/g, ' ')}; no printed dimension was confirmed on a drawing by a deterministic reader` },
        { code: 'HEIGHT_ASSUMED_FOR_PREVIEW', what: 'storey and eaves heights are described from the sources or conventional, for viewing' },
      ],
      partial: null,
    } as unknown as LinkAnalysisResult['preview'],
    sourceBasis: null,
    vision: { mode: 'LIVE_PROVIDER', provider: `${reading.provider.id}:${reading.provider.model}`, attempted: reading.usage.length, accepted: 1 },
    verification: { replay: 'BYTE_IDENTICAL', residuals: 0, residualsOutsideTolerance: 0, closure: { exteriorErrors, exteriorFindings: closure.metrics.exteriorFindingCount, interiorFindings: closure.metrics.interiorFindingCount } },
    assessment,
    analyzer: { service: `described-${DESCRIBED_PATH_VERSION}`, solver: `described-house-${DESCRIBED_HOUSE_BUILDER_VERSION}+description-${HOUSE_DESCRIPTION_VERSION}` },
    startedAt: input.startedAt,
    completedAt: input.now().toISOString(),
    candidate,
    model,
    scene: bundle,
  }
  return { basis: 'DESCRIPTION', result, sceneText, pkg, reading, adjustments: built.adjustments, refused: built.refused, after: input.after }
}

export type DescribedProgress = { stage: AnalysisStage; detail: string }

/** A sealed package to a described result: read, admit, build, compile, seal. */
export async function runDescribedAnalysis(input: { pkg: SourcePackage; cache: SourceByteCache; reader: StructuredVision; identity: AnalysisIdentity; sourceUrl?: string; jobId?: string | null; after?: DescribedRun['after']; now?: () => Date; clock?: () => number; signal?: AbortSignal; onProgress?: (p: DescribedProgress) => void; onPictures?: ReadHooks['onPictures'] }): Promise<DescribedRun> {
  const now = input.now ?? (() => new Date())
  const clock = input.clock ?? (() => performance.now())
  const startedAt = now().toISOString()
  const t0 = clock()
  const stageOf = { DECODING: 'CLASSIFYING_SOURCES', SORTING: 'CLASSIFYING_SOURCES', DESCRIBING: 'EXTRACTING_OBSERVATIONS', ADMITTING: 'SOLVING_TOPOLOGY' } as const
  const reading = await readHouse(input.pkg, input.cache, input.reader, { ...(input.signal ? { signal: input.signal } : {}), onStep: (step, detail) => input.onProgress?.({ stage: stageOf[step], detail: `${step.toLowerCase()}: ${detail}` }), ...(input.onPictures ? { onPictures: input.onPictures } : {}) })
  const t1 = clock()
  input.onProgress?.({ stage: 'BUILDING_MODEL', detail: 'building the described house' })
  const out = describedResult({ pkg: input.pkg, identity: input.identity, sourceUrl: input.sourceUrl ?? input.pkg.canonicalUrl, jobId: input.jobId ?? null, reading, after: input.after ?? null, startedAt, now })
  const t2 = clock()
  return { ...out, timings: { readMs: Math.round(t1 - t0), buildMs: Math.round(t2 - t1), totalMs: Math.round(t2 - t0) } }
}
