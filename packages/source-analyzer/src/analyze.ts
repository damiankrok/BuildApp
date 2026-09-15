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
import { ObservationGraphBuilder } from '@buildapp/source-observations'
import type { ExtractorHandle, SourceCoordinateFrame, SourceObservation, SourceObservationGraph } from '@buildapp/source-observations'
import { selectedVariant } from '@buildapp/source-package'
import type { SourceAsset, SourcePackage } from '@buildapp/source-package'
import { VisionResponseRejected, VisionUnavailable, applyVisionResponse, extractorNameFor, extractorVersionFor, tasksForDocument } from '@buildapp/source-vision'
import type { VisionContextFact, VisionReasoner, VisionTask, VisionTrace } from '@buildapp/source-vision'
import { prepareRaster } from './prepare.js'
import type { Prepared } from './prepare.js'
import { ELEVATION_EXTRACTORS, extractElevation } from './extractors/elevation.js'
import type { ElevationHandles, ElevationResult } from './extractors/elevation.js'
import { PLAN_EXTRACTORS, extractPlan } from './extractors/plan.js'
import type { PlanHandles, PlanResult } from './extractors/plan.js'
import { SECTION_EXTRACTORS, extractSection } from './extractors/section.js'
import type { SectionHandles, SectionResult } from './extractors/section.js'
import { IDENTITY_EXTRACTOR, relateAcrossViews } from './identity.js'

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
}

export type AssetAnalysis = {
  asset: SourceAsset
  frame: SourceCoordinateFrame
  prepared: Prepared
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
  const traces: VisionTrace[] = []
  const vision: VisionOutcome = { provider: options.vision ? `${options.vision.provider.id}/${options.vision.provider.model}` : null, attempted: 0, accepted: 0, rejected: [], unavailable: [] }
  const contextFacts = contextFactsFor(pkg)

  // Deterministic order: a package's assets are already sorted by id, and the
  // graph must not depend on which drawing happened to be analysed first.
  const ordered = [...pkg.assets].sort((a, b) => a.id.localeCompare(b.id)).slice(0, options.maxAssets ?? pkg.assets.length)

  for (const asset of ordered) {
    const variant = selectedVariant(asset)
    const document = asset.roles.document
    if (document === 'CHROME' || document === 'UNKNOWN') {
      skipped.push({ assetId: asset.id, reason: `document role ${document}: not a drawing this analyzer reads` })
      continue
    }
    const fetched = await options.bytes(variant.url)
    if (!fetched) {
      builder.unresolved(`the bytes of asset ${asset.id}`, `no cached copy of ${variant.url} was available, so nothing could be read from it`, 'MISSING', asset.id)
      skipped.push({ assetId: asset.id, reason: 'bytes not available offline' })
      continue
    }

    let prepared: Prepared
    try {
      prepared = prepareRaster(fetched.bytes)
    } catch (err) {
      builder.unresolved(`the raster of asset ${asset.id}`, `the bytes could not be decoded: ${(err as Error).message}`, 'MISSING', asset.id)
      skipped.push({ assetId: asset.id, reason: `decode failed: ${(err as Error).message}` })
      continue
    }
    // The frame carries the size the BYTES have. A package whose recorded
    // decoded size disagrees with the pixels is a package that was sealed
    // wrong, and the analyzer is the wrong place to paper over it.
    if (prepared.size.width !== variant.decoded.width || prepared.size.height !== variant.decoded.height) {
      throw new Error(`asset ${asset.id} is sealed as ${variant.decoded.width}x${variant.decoded.height} but its bytes decode to ${prepared.size.width}x${prepared.size.height}`)
    }

    const frame = builder.declareFrame(asset.id, variant.byteHash, prepared.size, {
      document: asset.roles.document,
      storey: asset.roles.storey,
      annotation: asset.roles.annotation,
      view: asset.roles.view,
      projection: asset.roles.projection,
    })
    const before = builder.observationCount
    const analysis: AssetAnalysis = { asset, frame, prepared, observations: [], visionAttempted: false, visionAccepted: 0 }

    if (document === 'ELEVATION' || document === 'PERSPECTIVE_RENDER') {
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
    const tasks = tasksForDocument(document)
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

    analysis.observations = builder.snapshot().filter((o) => o.frameId === frame.id)
    if (builder.observationCount === before && !analysis.visionAttempted) {
      builder.unresolved(`any observation at all on asset ${asset.id}`, 'the extractors for this document role found nothing in the image', 'MISSING', asset.id)
    }
    assets.push(analysis)
  }

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

  return { graph: builder.seal(), assets, vision, traces, skipped }
}
