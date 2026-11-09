/**
 * The analyzer: a sealed SourcePackage in, a sealed SourceObservationGraph out.
 *
 * Everything this file does is routing. It decides which extractor a drawing
 * gets from the drawing's own ROLES — never from its filename, never from the
 * project it belongs to, and never from anything a particular publisher does.
 * Adding a publisher changes an adapter in the acquisition layer and changes
 * nothing here.
 *
 * The vision pass is optional by construction. With no provider, the graph is
 * everything the deterministic extractors found plus a named gap saying a
 * vision pass was not run; with one, the model's answers are added ALONGSIDE
 * the deterministic observations rather than in place of them, because the two
 * are good at different things and an answer that appears in both is worth
 * more than either. That is what §13's "do not rely only on a VLM" means in
 * code: the CV path runs first and runs unconditionally.
 */
import { NO_CHECKPOINT } from '@buildapp/source-common'
import { planReadingSize, resampleRaster } from '@buildapp/source-cv'
import type { Checkpoint } from '@buildapp/source-common'
import { ObservationGraphBuilder } from '@buildapp/source-observations'
import type { ExtractorHandle, SourceCoordinateFrame, SourceObservation, SourceObservationGraph } from '@buildapp/source-observations'
import { decodeImage, selectedVariant } from '@buildapp/source-package'
import type { SourceAsset, SourcePackage } from '@buildapp/source-package'
import { VisionResponseRejected, VisionUnavailable, applyVisionResponse, extractorNameFor, extractorVersionFor, readsAsFacade, tasksForRoles } from '@buildapp/source-vision'
import type { VisionContextFact, VisionReasoner, VisionTask, VisionTrace } from '@buildapp/source-vision'
import { prepareFromRaster } from './prepare.js'
import type { Prepared } from './prepare.js'
import { ELEVATION_EXTRACTORS, extractElevation } from './extractors/elevation.js'
import type { ElevationHandles, ElevationResult } from './extractors/elevation.js'
import { PLAN_EXTRACTORS, extractPlan } from './extractors/plan.js'
import type { PlanHandles, PlanResult } from './extractors/plan.js'
import { SECTION_EXTRACTORS, extractSection } from './extractors/section.js'
import type { SectionHandles, SectionResult } from './extractors/section.js'
import { IDENTITY_EXTRACTOR, relateAcrossViews } from './identity.js'
/** A sealed package whose recorded size is not its bytes': raised past the decode handler, which names undecodable drawings. */
class SealedSizeMismatch extends Error {}

import { CONTENT_HEAD, CONTENT_VETO, contentProbabilities, contentTensor, contentVerdict } from './content.js'
import type { ContentVerdict, ImageEmbedder } from './content.js'

/** Where the analyzer gets the bytes a package refers to. Offline by construction: it never fetches. */
export type ByteSource = (url: string) => Promise<{ bytes: Uint8Array; mediaType: string } | null>

export type AnalyzeOptions = {
  bytes: ByteSource
  /** Optional. With none, the graph is deterministic-CV only and says so. */
  vision?: VisionReasoner
  /** Restrict the vision passes to these tasks. Defaults to every task the document role supports. */
  visionTasks?: readonly VisionTask[]
  /** Called for every note a provider returns, alongside whatever trace the provider itself emits. */
  onTrace?: (trace: VisionTrace) => void
  /** Cap on assets analysed, for a quick run. */
  maxAssets?: number
  /**
   * Told which asset is about to be read, as `index` of `total`, and once more
   * with `index === total` when every asset has been. Progress reporting only:
   * nothing it returns or throws reaches the graph.
   */
  onAsset?: (index: number, total: number, assetId: string | null) => void
  /** Told at each asset and between the steps inside one, for progress and cancellation; nothing it does reaches the graph. */
  checkpoint?: Checkpoint
  /**
   * Keep each asset's prepared pixels on the result. Default true; a caller
   * that uses only the graph passes false, and every asset's masks and
   * segments are released as soon as its extractors are done with them.
   */
  retainPrepared?: boolean
  /**
   * SOURCE-01: the image encoder that reads what each picture shows (`content.ts`). With one, an asset whose pixels
   * surely show something its role's reader must not read (an interior sent to the exterior camera, a perspective
   * captioned as an elevation) is kept as a source and given to no reader. Without one, roles decide alone, as before.
   */
  content?: ImageEmbedder
  /** Cancels the content pass's worker. */
  signal?: AbortSignal
  /**
   * SHAPE-LIVE-01: told which picture is being looked at and what was found on it, as it happens. Write-only: nothing
   * it does reaches the graph; a listener that throws is ignored.
   */
  onSheet?: (e: SheetEvent) => void
}

/** SHAPE-LIVE-01: one step on one picture. */
export type SheetEvent =
  | { step: 'CONTENT_CHECK'; asset: SourceAsset }
  | { step: 'CONTENT_REFUSED'; asset: SourceAsset; verdict: ContentVerdict }
  | { step: 'READING_DRAWING'; asset: SourceAsset }
  /** `size`: the frame the observations are in — the sheet's reading size, which is not always its bytes' */
  | { step: 'DRAWING_READ'; asset: SourceAsset; observations: readonly SourceObservation[]; size: { width: number; height: number } }

export type AssetAnalysis = {
  asset: SourceAsset
  frame: SourceCoordinateFrame
  /** Absent when the caller asked for the pixels to be released (`retainPrepared: false`). */
  prepared?: Prepared
  elevation?: ElevationResult
  plan?: PlanResult
  section?: SectionResult
  observations: SourceObservation[]
  visionAttempted: boolean
  visionAccepted: number
}

/** What happened to the vision pass, as a fact rather than an impression. */
export type VisionOutcome = {
  provider: string | null
  /** Calls attempted, accepted, and refused with the reason each was refused for. */
  attempted: number
  accepted: number
  rejected: Array<{ task: VisionTask; assetId: string; code: string; message: string }>
  unavailable: Array<{ task: VisionTask; assetId: string; reason: string; message: string }>
}

export type AnalysisResult = {
  graph: SourceObservationGraph
  assets: AssetAnalysis[]
  vision: VisionOutcome
  traces: VisionTrace[]
  /** Assets the package holds that this analyzer had no extractor for. */
  skipped: Array<{ assetId: string; reason: string }>
  /** v3.51: the plan sheets read at a smaller size than their bytes have, and why (their typical wall, in their own pixels). */
  readingSizes: Array<{ assetId: string; decoded: { width: number; height: number }; readAt: { width: number; height: number }; typicalWallPx: number; reduction: number }>
  /** SOURCE-01: what each asset's pixels show and what was done with it, one per asset (NOT_CLASSIFIED without an encoder). */
  content: ContentVerdict[]
  /** The encoder and head that read them, or null when none ran. */
  contentClassifier: { id: string; modelSha256: string; headVersion: string } | null
}

const contextFactsFor = (pkg: SourcePackage): VisionContextFact[] => pkg.publishedFacts.map((f) => ({ label: f.label, value: f.value, unit: f.unit }))

export async function analyzeSourcePackage(pkg: SourcePackage, options: AnalyzeOptions): Promise<AnalysisResult> {
  const builder = new ObservationGraphBuilder(pkg.id, pkg.contentHash)
  const handleFor = new Map<string, ExtractorHandle>()
  const declare = (name: string, version: string, kind: Parameters<ObservationGraphBuilder['declareExtractor']>[2]): ExtractorHandle => {
    const existing = handleFor.get(name)
    if (existing) return existing
    const handle = builder.declareExtractor(name, version, kind)
    handleFor.set(name, handle)
    return handle
  }

  const assets: AssetAnalysis[] = []
  const skipped: AnalysisResult['skipped'] = []
  const readingSizes: AnalysisResult['readingSizes'] = []
  const traces: VisionTrace[] = []
  const vision: VisionOutcome = { provider: options.vision ? `${options.vision.provider.id}/${options.vision.provider.model}` : null, attempted: 0, accepted: 0, rejected: [], unavailable: [] }
  const contextFacts = contextFactsFor(pkg)

  // Deterministic order: a package's assets are already sorted by id, and the
  // graph must not depend on which drawing happened to be analysed first.
  const ordered = [...pkg.assets].sort((a, b) => a.id.localeCompare(b.id)).slice(0, options.maxAssets ?? pkg.assets.length)

  const checkpoint = options.checkpoint ?? NO_CHECKPOINT
  const tell = (e: SheetEvent): void => {
    try {
      options.onSheet?.(e)
    } catch (err) {
      // the preview is write-only; a cancellation still cancels
      if ((err as { name?: unknown }).name === 'AbortError') throw err
    }
  }

  // ---- SOURCE-01: what each picture shows, before any reader sees it ------
  const verdicts = new Map<string, ContentVerdict>()
  if (options.content) {
    const ids: string[] = []
    const tensors: Float32Array[] = []
    for (const asset of ordered) {
      checkpoint.tick({ subphase: { id: 'CONTENT', label: 'what each picture shows' } })
      tell({ step: 'CONTENT_CHECK', asset })
      const fetched = await options.bytes(selectedVariant(asset).url)
      if (!fetched) continue
      try {
        tensors.push(contentTensor(decodeImage(fetched.bytes)))
        ids.push(asset.id)
      } catch (err) {
        if ((err as { name?: unknown }).name === 'AbortError') throw err
        // an undecodable picture is named by the reader that would have read it, below
      }
    }
    const embeddings = await options.content.embed(tensors, options.signal)
    for (const [i, id] of ids.entries()) {
      const asset = ordered.find((a) => a.id === id) as SourceAsset
      const v = contentVerdict(id, asset.roles, contentProbabilities(embeddings[i]))
      verdicts.set(id, v)
      if (v.decision === 'VETOED') tell({ step: 'CONTENT_REFUSED', asset, verdict: v })
    }
  }
  const content = ordered.map((a) => verdicts.get(a.id) ?? contentVerdict(a.id, a.roles, undefined))

  // ---- v3.51 ANY-LINK: a page whose words name no floor plan is read by what its pictures show ------
  // The roles come from the words around each picture. A publisher that captions nothing leaves every drawing
  // UNKNOWN, and the run used to stop with "no drawings" beside a gallery full of them. Only then — no picture is
  // captioned a floor plan — a picture the words leave UNKNOWN takes the role its pixels show, when they show an
  // orthographic drawing with the certainty the content veto itself asks (CONTENT_VETO.minOther). A page that
  // captions its plans is never touched; a promoted role says nothing of the storey or the side, which stay unknown.
  const promoted = new Map<string, SourceAsset['roles']>()
  if (options.content && !ordered.some((a) => a.roles.document === 'FLOOR_PLAN')) {
    for (const a of ordered) {
      const v = verdicts.get(a.id)
      if (a.roles.document !== 'UNKNOWN' || !v || v.projection !== 'ORTHOGRAPHIC' || v.topProbability < CONTENT_VETO.minOther) continue
      if (v.top === 'FLOOR_PLAN') promoted.set(a.id, { ...a.roles, document: 'FLOOR_PLAN', projection: 'ORTHOGRAPHIC_PLAN', view: 'NOT_APPLICABLE' })
      else if (v.top === 'ELEVATION') promoted.set(a.id, { ...a.roles, document: 'ELEVATION', projection: 'ORTHOGRAPHIC_ELEVATION', storey: 'NOT_APPLICABLE', view: a.roles.view === 'UNKNOWN' ? 'SIDE_UNSPECIFIED' : a.roles.view })
      else if (v.top === 'SECTION') promoted.set(a.id, { ...a.roles, document: 'SECTION', projection: 'ORTHOGRAPHIC_SECTION', storey: 'NOT_APPLICABLE', view: 'NOT_APPLICABLE' })
    }
  }
  const rolesOf = (a: SourceAsset): SourceAsset['roles'] => promoted.get(a.id) ?? a.roles

  for (const [index, asset] of ordered.entries()) {
    options.onAsset?.(index, ordered.length, asset.id)
    const roles = rolesOf(asset)
    checkpoint.tick({ done: index, total: ordered.length, assetIndex: index + 1, assetTotal: ordered.length, subphase: { id: roles.document, label: roles.document.toLowerCase().replace(/_/g, ' ') } })
    const variant = selectedVariant(asset)
    const document = roles.document
    if (promoted.has(asset.id)) builder.unresolved(`the role of asset ${asset.id}`, `the page's words name no floor plan; this picture is read as a ${document.toLowerCase().replace(/_/g, ' ')} because its pixels show one (${verdicts.get(asset.id)?.why ?? 'content'}); its storey or side is not known`, 'AMBIGUOUS', asset.id)
    if (document === 'CHROME' || document === 'UNKNOWN') {
      skipped.push({ assetId: asset.id, reason: `document role ${document}: not a drawing this analyzer reads` })
      continue
    }
    const verdict = verdicts.get(asset.id)
    if (verdict?.decision === 'VETOED') {
      builder.unresolved(`the ${document.toLowerCase().replace(/_/g, ' ')} reading of asset ${asset.id}`, verdict.why, 'NOT_ATTEMPTED', asset.id)
      skipped.push({ assetId: asset.id, reason: `content: ${verdict.why}` })
      continue
    }
    const fetched = await options.bytes(variant.url)
    if (!fetched) {
      builder.unresolved(`the bytes of asset ${asset.id}`, `no cached copy of ${variant.url} was available, so nothing could be read from it`, 'MISSING', asset.id)
      skipped.push({ assetId: asset.id, reason: 'bytes not available offline' })
      continue
    }

    let prepared: Prepared
    // v3.51: a plan sheet drawn finer than the readers' measured range is read at a smaller size (source-cv/reading-size.ts)
    let reading: ReturnType<typeof planReadingSize> | undefined
    try {
      const decoded = decodeImage(fetched.bytes)
      // The package records the size the BYTES have. A package whose recorded decoded size disagrees with the pixels
      // is a package that was sealed wrong, and the analyzer is the wrong place to paper over it.
      if (decoded.width !== variant.decoded.width || decoded.height !== variant.decoded.height) {
        throw new SealedSizeMismatch(`asset ${asset.id} is sealed as ${variant.decoded.width}x${variant.decoded.height} but its bytes decode to ${decoded.width}x${decoded.height}`)
      }
      if (document === 'FLOOR_PLAN') reading = planReadingSize(decoded)
      prepared = prepareFromRaster(reading && reading.reduction > 1 ? resampleRaster(decoded, reading.size) : decoded, { checkpoint })
    } catch (err) {
      if (err instanceof SealedSizeMismatch) throw new Error(err.message)
      // a cancellation is not an undecodable drawing
      if ((err as { name?: unknown }).name === 'AbortError') throw err
      builder.unresolved(`the raster of asset ${asset.id}`, `the bytes could not be decoded: ${(err as Error).message}`, 'MISSING', asset.id)
      skipped.push({ assetId: asset.id, reason: `decode failed: ${(err as Error).message}` })
      continue
    }
    // The frame carries the size the sheet is READ at: the bytes' own, or a plan's reading size.
    if (reading && reading.reduction > 1) readingSizes.push({ assetId: asset.id, decoded: { ...variant.decoded }, readAt: { ...reading.size }, typicalWallPx: reading.typicalWallPx, reduction: reading.reduction })

    const frame = builder.declareFrame(asset.id, variant.byteHash, prepared.size, {
      document: roles.document,
      storey: roles.storey,
      annotation: roles.annotation,
      view: roles.view,
      projection: roles.projection,
    })
    const before = builder.observationCount
    tell({ step: 'READING_DRAWING', asset })
    const analysis: AssetAnalysis = { asset, frame, prepared, observations: [], visionAttempted: false, visionAccepted: 0 }

    // The facade readers, deterministic and vision alike, read an ORTHOGRAPHIC facade: an outline, a ridge,
    // rectangles in the wall plane. Every reader of what they write (the metric layer, cross-view identity,
    // elevation registration) reads orthographic frames only, so on a perspective picture, an interior or an
    // exterior one alike, they could only write claims about the facade that nothing can measure. Such a frame is
    // still declared, because a perspective camera is solved from its raster, and it is refused by name instead of
    // being read as a facade (`readsAsFacade`).
    const perspectiveRefused = document === 'PERSPECTIVE_RENDER' && !readsAsFacade(roles)
    if (perspectiveRefused) {
      builder.unresolved(`facade observations on the perspective render ${asset.id}`, `the facade extractors and the facade vision task read orthographic views only and this picture's projection is ${roles.projection}, so nothing on it was read as a facade`, 'NOT_ATTEMPTED', asset.id)
      skipped.push({ assetId: asset.id, reason: `facade extractors not run: projection ${roles.projection} is not orthographic` })
    } else if (document === 'ELEVATION' || document === 'PERSPECTIVE_RENDER') {
      const handles = Object.fromEntries(ELEVATION_EXTRACTORS.map((e) => [e.key, declare(e.name, e.version, 'DETERMINISTIC_CV')])) as ElevationHandles
      analysis.elevation = extractElevation(builder, frame, prepared, handles)
    } else if (document === 'FLOOR_PLAN') {
      const handles = Object.fromEntries(PLAN_EXTRACTORS.map((e) => [e.key, declare(e.name, e.version, 'DETERMINISTIC_CV')])) as PlanHandles
      analysis.plan = extractPlan(builder, frame, prepared, handles)
    } else if (document === 'SECTION') {
      const handles = Object.fromEntries(SECTION_EXTRACTORS.map((e) => [e.key, declare(e.name, e.version, 'DETERMINISTIC_CV')])) as SectionHandles
      analysis.section = extractSection(builder, frame, prepared, handles)
    } else {
      builder.unresolved(`observations on the ${document.toLowerCase().replace(/_/g, ' ')} ${asset.id}`, 'this analyzer has no extractor for this document role yet', 'NOT_ATTEMPTED', asset.id)
      skipped.push({ assetId: asset.id, reason: `no extractor for document role ${document}` })
    }

    // ---- the vision pass, alongside and never instead ---------------------
    const tasks = tasksForRoles(roles)
      .map((t) => t.task)
      .filter((t) => options.visionTasks === undefined || options.visionTasks.includes(t))
    for (const task of tasks) {
      if (!options.vision) {
        builder.unresolved(`a ${task.toLowerCase().replace(/_/g, ' ')} vision pass on asset ${asset.id}`, 'no vision provider was configured for this run, so only the deterministic extractors were applied', 'NOT_ATTEMPTED', asset.id)
        continue
      }
      analysis.visionAttempted = true
      vision.attempted += 1
      const provider = options.vision.provider
      const request = {
        task,
        asset: { assetId: asset.id, byteHash: variant.byteHash, mediaType: fetched.mediaType, bytes: fetched.bytes },
        roles: { document: asset.roles.document, storey: asset.roles.storey, annotation: asset.roles.annotation, view: asset.roles.view, projection: asset.roles.projection },
        size: prepared.size,
        contextFacts,
      }
      try {
        const response = await options.vision.analyze(request)
        const handle = declare(extractorNameFor(provider, task), extractorVersionFor(provider), 'VISION_MODEL')
        const applied = applyVisionResponse(builder, handle, frame, response, provider, task)
        vision.accepted += 1
        analysis.visionAccepted += applied.observations.length
        for (const note of response.notes ?? []) {
          const trace: VisionTrace = { provider, task, assetId: asset.id, assetByteHash: variant.byteHash, accepted: true, rawResponse: note }
          traces.push(trace)
          options.onTrace?.(trace)
        }
      } catch (err) {
        if (err instanceof VisionResponseRejected) {
          vision.rejected.push({ task, assetId: asset.id, code: err.code, message: err.message })
          builder.unresolved(`a ${task.toLowerCase().replace(/_/g, ' ')} vision pass on asset ${asset.id}`, `the provider's answer was refused (${err.code}): ${err.message}`, 'MISSING', asset.id)
        } else if (err instanceof VisionUnavailable) {
          vision.unavailable.push({ task, assetId: asset.id, reason: err.reason, message: err.message })
          builder.unresolved(`a ${task.toLowerCase().replace(/_/g, ' ')} vision pass on asset ${asset.id}`, `no provider could answer (${err.reason}): ${err.message}`, 'NOT_ATTEMPTED', asset.id)
        } else {
          throw err
        }
      }
    }

    checkpoint.tick()
    if (options.retainPrepared === false) delete analysis.prepared
    analysis.observations = builder.snapshot().filter((o) => o.frameId === frame.id)
    tell({ step: 'DRAWING_READ', asset, observations: analysis.observations, size: prepared.size })
    if (builder.observationCount === before && !analysis.visionAttempted && !perspectiveRefused) {
      builder.unresolved(`any observation at all on asset ${asset.id}`, 'the extractors for this document role found nothing in the image', 'MISSING', asset.id)
    }
    assets.push(analysis)
  }
  options.onAsset?.(ordered.length, ordered.length, null)

  // ---- what two views say about one another -------------------------------
  if (assets.length > 1) {
    const handle = declare(IDENTITY_EXTRACTOR.name, IDENTITY_EXTRACTOR.version, 'DERIVED')
    relateAcrossViews(
      builder,
      handle,
      assets.map((a) => ({ frame: a.frame, observations: a.observations })),
    )
  }

  if (!options.vision) builder.unresolved('a vision pass over this package', 'no vision provider was configured for this run; every observation in this graph is from a deterministic extractor', 'NOT_ATTEMPTED')

  return { graph: builder.seal(), assets, vision, traces, skipped, readingSizes, content, contentClassifier: options.content ? { id: options.content.id, modelSha256: options.content.modelSha256, headVersion: CONTENT_HEAD.version } : null }
}
