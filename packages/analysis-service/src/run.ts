/**
 * The link analysis, as one function.
 *
 *   URL ─► SourcePackage ─► observation graph ─► metric evidence ─► analyzer v2
 *       ─► ReconstructionCandidate + CanonicalBuildingModel ─► compiled scene
 *       ─► MobileSceneBundle ─► verified, hashed result
 *
 * There is one analyzer. The CLI (`reconstruct-v2.ts`), the analyzer HTTP API
 * and the tests all call `runAnalysis`; none of them has a pipeline of its
 * own, which is what makes "the CLI and the phone got the same building for
 * the same sealed input" a property of the code rather than a promise.
 *
 * This module knows no project and no publisher. The caller registers the
 * adapters it trusts and supplies the byte cache the run may use; the API gives
 * each job an empty cache of its own, so no job ever reads another's bytes.
 */
import { stableJson } from '@buildapp/source-common'
import { SourcePackageSchema, acquireSourcePackage, decodeImage, selectedVariant } from '@buildapp/source-package'
import type { FetchDeps, FetchPolicy, SourceAdapter, SourceByteCache, SourcePackage } from '@buildapp/source-package'
import { analyzeSourcePackage } from '@buildapp/source-analyzer'
import type { SourceObservationGraph } from '@buildapp/source-observations'
import { nullVisionReasoner } from '@buildapp/source-vision'
import type { VisionReasoner } from '@buildapp/source-vision'
import { extractMetricEvidence } from '@buildapp/source-metrics'
import type { MetricEvidenceSet } from '@buildapp/source-metrics'
import { SOLVER_V2_VERSION, reconstructV2, verifyReplay } from '@buildapp/reconstruction'
import type { ReconstructionV2Phase, ReconstructionV2Result } from '@buildapp/reconstruction'
import { serializeModel } from '@buildapp/model'
import { compileBuilding, geometryClosureAudit } from '@buildapp/geometry'
import type { ClosureReport } from '@buildapp/geometry'
import { buildMobileSceneBundle, loadBundle, serializeBundle, sha256 } from '@buildapp/mobile-scene'
import { AnalysisError, throwIfAborted, toAnalysisError } from './errors.js'
import { identityOf, validateAnalysisUrl } from './identity.js'
import type { AnalysisIdentity } from './identity.js'
import { anySignal } from './signals.js'
import { progressEvent } from './stages.js'
import type { AnalysisProgress, AnalysisStage } from './stages.js'
import type { LinkAnalysisResult, VisionMode } from './result.js'

export const ANALYSIS_SERVICE_VERSION = '1.0.0' as const

/** What to analyse: a live URL, or a package (and optionally its graph) sealed earlier. */
export type AnalysisInput = { kind: 'URL'; url: string } | { kind: 'PACKAGE'; pkg: SourcePackage; graph?: SourceObservationGraph }

export type AnalysisOptions = {
  /** The publishers this caller trusts. Nothing is fetched from a page none of them understands. */
  adapters: readonly SourceAdapter[]
  /** Where this run's fetched bytes live. The API gives every job an empty one of its own. */
  cache: SourceByteCache
  policy?: FetchPolicy
  /** The network seam. Tests put an in-memory publisher here; production leaves it empty. */
  deps?: FetchDeps
  offline?: boolean
  probeResolutionCandidates?: boolean
  /** A vision provider, server-side only. Absent: the deterministic analyzer alone, and the result says so. */
  vision?: VisionReasoner
  /** Override the derived identity. The CLI does, to reproduce a sealed candidate under its sealed name. */
  identity?: Partial<AnalysisIdentity>
  signal?: AbortSignal
  progress?: (event: AnalysisProgress) => void
  /** Diagnostic lines from the solver, for a developer; never part of the result. */
  debug?: (message: string) => void
  /** The clock, for the result's timestamps only; never reaches a hash. */
  now?: () => Date
  /** A monotonic clock in milliseconds, for `AnalysisRun.timings` only; never reaches a hash. */
  clock?: () => number
  jobId?: string
}

/**
 * Where the time of one run went, in milliseconds of a monotonic clock. The
 * phases partition the run: acquisition (fetching or reading the package),
 * observation (classification and reading the drawings, or replaying a
 * graph), metric extraction (decoding the rasters and reading the printed
 * numbers), reconstruction (the v2 solver up to the serialized model),
 * compile (scene compile and bundle export) and verification (replay, round
 * trip, closure audit). Diagnostics only: never part of a result or a hash.
 */
export type AnalysisTimings = {
  acquisitionMs: number
  observationMs: number
  metricExtractionMs: number
  reconstructionMs: number
  compileMs: number
  verificationMs: number
  totalMs: number
}

/** Everything one run produced: the result a client sees, and the internals a CLI writes as artifacts. */
export type AnalysisRun = {
  result: LinkAnalysisResult
  pkg: SourcePackage
  graph: SourceObservationGraph
  metrics: MetricEvidenceSet
  reconstruction: ReconstructionV2Result
  /** The exact bytes of the scene bundle a client downloads. */
  sceneText: string
  closure: ClosureReport
  timings: AnalysisTimings
}

const PHASE_STAGE: Record<ReconstructionV2Phase, AnalysisStage> = {
  REGISTRATION: 'REGISTERING_VIEWS',
  TOPOLOGY: 'SOLVING_TOPOLOGY',
  METRICS: 'SOLVING_METRICS',
  MODEL: 'BUILDING_MODEL',
}

const DRAWING_DOCUMENTS = new Set(['FLOOR_PLAN', 'ELEVATION', 'SECTION', 'SITE_PLAN', 'PERSPECTIVE_RENDER'])

/** A fetch that also stops when the run is cancelled. */
function cancellableDeps(deps: FetchDeps | undefined, signal: AbortSignal | undefined, onFetch: () => void): FetchDeps {
  const inner = deps?.fetchImpl ?? fetch
  const fetchImpl = ((input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    onFetch()
    const signals = [init?.signal, signal].filter((s): s is AbortSignal => !!s)
    return inner(input, { ...init, signal: signals.length > 0 ? anySignal(signals) : undefined })
  }) as typeof fetch
  return { ...deps, fetchImpl }
}

export async function runAnalysis(input: AnalysisInput, options: AnalysisOptions): Promise<AnalysisRun> {
  const now = options.now ?? (() => new Date())
  const clock = options.clock ?? (() => performance.now())
  const startedAt = now().toISOString()
  const t0 = clock()
  let mark = t0
  const lap = (): number => {
    const t = clock()
    const ms = t - mark
    mark = t
    return Math.round(ms)
  }
  const { signal } = options
  let last = -1
  const report = (stage: AnalysisStage, fraction = 0, detail?: string): void => {
    const event = progressEvent(stage, fraction, detail)
    // monotone by construction; a report that would move the bar back is dropped
    if (event.progress < last) return
    last = event.progress
    options.progress?.(event)
  }

  try {
    // --- ACQUIRING_SOURCE ---------------------------------------------------
    report('ACQUIRING_SOURCE', 0, input.kind === 'URL' ? 'fetching the project page' : 'reading a sealed source package')
    throwIfAborted(signal)
    let pkg: SourcePackage
    let sourceUrl: string
    if (input.kind === 'URL') {
      const url = validateAnalysisUrl(input.url, options.adapters)
      sourceUrl = url.toString()
      let fetched = 0
      pkg = await acquireSourcePackage(sourceUrl, options.adapters, {
        cache: options.cache,
        policy: options.policy,
        offline: options.offline,
        probeResolutionCandidates: options.probeResolutionCandidates,
        deps: cancellableDeps(options.deps, signal, () => {
          fetched += 1
          report('ACQUIRING_SOURCE', 0, `${fetched} address${fetched === 1 ? '' : 'es'} fetched`)
        }),
      })
    } else {
      pkg = SourcePackageSchema.parse(input.pkg)
      sourceUrl = pkg.canonicalUrl
    }
    throwIfAborted(signal)
    const acquisitionMs = lap()

    // --- CLASSIFYING_SOURCES ------------------------------------------------
    // The roles were claimed during acquisition; this is where they are counted,
    // and where a page with nothing to read stops before any drawing is read.
    report('CLASSIFYING_SOURCES', 0)
    const byDocument: Record<string, number> = {}
    for (const a of pkg.assets) byDocument[a.roles.document] = (byDocument[a.roles.document] ?? 0) + 1
    const drawings = pkg.assets.filter((a) => DRAWING_DOCUMENTS.has(a.roles.document)).length
    if ((byDocument.FLOOR_PLAN ?? 0) === 0 && (byDocument.ELEVATION ?? 0) === 0) {
      throw new AnalysisError('NO_DRAWINGS', drawings === 0 ? 'the page exposes no plan, elevation or section this analyzer reads' : 'the page exposes no floor plan and no elevation; a building cannot be reconstructed from the rest')
    }
    report('CLASSIFYING_SOURCES', 1, `${drawings} drawing${drawings === 1 ? '' : 's'} of ${pkg.assets.length} assets`)
    throwIfAborted(signal)

    // --- EXTRACTING_OBSERVATIONS --------------------------------------------
    const bytesFor = async (assetUrl: string): Promise<{ bytes: Uint8Array; mediaType: string } | null> => {
      throwIfAborted(signal)
      return options.cache.get(assetUrl)
    }
    let graph: SourceObservationGraph
    let visionMode: VisionMode
    let visionProvider: string | null = null
    let visionAttempted = 0
    let visionAccepted = 0
    if (input.kind === 'PACKAGE' && input.graph) {
      graph = input.graph
      visionMode = 'REPLAYED_GRAPH'
      report('EXTRACTING_OBSERVATIONS', 0.65, 'observation graph replayed')
    } else {
      report('EXTRACTING_OBSERVATIONS', 0)
      const vision = options.vision ?? nullVisionReasoner()
      const analysis = await analyzeSourcePackage(pkg, {
        bytes: bytesFor,
        vision,
        // reading the drawings is about two thirds of this stage, the printed dimensions the rest
        onAsset: (index, total) => report('EXTRACTING_OBSERVATIONS', total === 0 ? 0.65 : (0.65 * index) / total, index < total ? `drawing ${index + 1} of ${total}` : undefined),
      })
      graph = analysis.graph
      const live = vision.provider.id !== 'vision.none' && vision.available() && analysis.vision.attempted > 0
      // a request the null provider declined is not an attempt worth reporting
      visionAttempted = live ? analysis.vision.attempted : 0
      visionAccepted = live ? analysis.vision.accepted : 0
      visionMode = live ? 'LIVE_PROVIDER' : 'DETERMINISTIC_ONLY'
      visionProvider = live ? `${vision.provider.id}/${vision.provider.model}` : null
    }
    throwIfAborted(signal)
    const observationMs = lap()
    report('EXTRACTING_OBSERVATIONS', 0.65, 'reading printed dimensions and callouts')

    const rasterCache = new Map<string, ReturnType<typeof decodeImage> | undefined>()
    for (const asset of pkg.assets) {
      const variant = selectedVariant(asset)
      const fetched = await bytesFor(variant.url)
      if (!fetched) continue
      try {
        rasterCache.set(variant.byteHash, decodeImage(fetched.bytes))
      } catch {
        rasterCache.set(variant.byteHash, undefined)
      }
    }
    const identity: AnalysisIdentity = { ...identityOf(pkg, options.adapters), ...options.identity }
    const raster = (frame: { variantByteHash: string }): ReturnType<typeof decodeImage> | undefined => rasterCache.get(frame.variantByteHash)
    const metrics = extractMetricEvidence({ sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph, slug: identity.slug, raster, specifications: pkg.publishedSpecifications, pageHash: pkg.pageHash })
    throwIfAborted(signal)
    const metricExtractionMs = lap()

    // --- REGISTERING_VIEWS … BUILDING_MODEL (the solver reports its own phases)
    const reconstruction = reconstructV2({
      debug: options.debug,
      modelId: identity.modelId,
      label: identity.label,
      slug: identity.slug,
      sourcePackageId: pkg.id,
      sourcePackageHash: pkg.contentHash,
      graph,
      metrics,
      raster,
      publishedAreas: pkg.publishedFacts,
      publishedRooms: pkg.publishedRooms,
      onPhase: (phase) => report(PHASE_STAGE[phase], 0),
    })
    throwIfAborted(signal)
    const model = reconstruction.model
    const modelText = serializeModel(model)
    const reconstructionMs = lap()
    report('BUILDING_MODEL', 1)

    // --- COMPILING_SCENE ----------------------------------------------------
    report('COMPILING_SCENE', 0)
    const scene = compileBuilding(model)
    report('COMPILING_SCENE', 0.6, `${scene.meshes.length} meshes`)
    const bundle = buildMobileSceneBundle(model, { scene })
    const sceneText = serializeBundle(bundle)
    throwIfAborted(signal)
    const compileMs = lap()

    // --- VERIFYING ----------------------------------------------------------
    report('VERIFYING', 0)
    const replay = verifyReplay(reconstruction.candidate)
    if (!replay.ok) throw new AnalysisError('ANALYSIS_FAILED', 'the sealed candidate does not replay to the model it describes')
    const reloaded = loadBundle(sceneText)
    if (!reloaded.ok || reloaded.bundle.contentHash !== bundle.contentHash) throw new AnalysisError('ANALYSIS_FAILED', 'the scene bundle does not survive its own round trip')
    report('VERIFYING', 0.3, 'replay byte-identical; checking joints')
    const closure = geometryClosureAudit(model, scene)
    const verificationMs = lap()
    report('VERIFYING', 1)

    const b = reconstruction.building
    const levels: Record<string, number> = { L0: 0, L1: 0, L2: 0 }
    for (const r of reconstruction.quality.records) levels[r.level] = (levels[r.level] ?? 0) + 1
    const outside = reconstruction.residuals.filter((r) => !r.withinTolerance).length
    const exteriorErrors = closure.findings.filter((f) => f.scope === 'EXTERIOR' && f.severity === 'ERROR').length
    const failuresByCode = new Map<string, number>()
    for (const f of pkg.failures) failuresByCode.set(f.code, (failuresByCode.get(f.code) ?? 0) + 1)

    const warnings: string[] = []
    if (visionMode !== 'LIVE_PROVIDER') warnings.push(visionMode === 'REPLAYED_GRAPH' ? 'the observation graph was replayed from a sealed run' : 'no vision provider ran; every observation is from the deterministic analyzer')
    for (const [code, n] of [...failuresByCode].sort()) warnings.push(`${n} source address${n === 1 ? '' : 'es'} not used (${code.toLowerCase().replace(/_/g, ' ')})`)
    if (outside > 0) warnings.push(`${outside} of ${reconstruction.residuals.length} source-view checks outside tolerance`)
    if (exteriorErrors > 0) warnings.push(`${exteriorErrors} exterior joint finding${exteriorErrors === 1 ? '' : 's'} in the closure audit`)
    if (reconstruction.violations.graph.length + reconstruction.violations.ledger.length > 0) warnings.push(`${reconstruction.violations.graph.length} feature-graph and ${reconstruction.violations.ledger.length} ledger invariant violations`)

    const result: LinkAnalysisResult = {
      schema: 'buildapp.link-analysis-result',
      schemaVersion: '1.0.0',
      jobId: options.jobId ?? null,
      sourceUrl,
      canonicalUrl: pkg.canonicalUrl,
      title: identity.title,
      label: identity.label,
      modelId: identity.modelId,
      publisher: pkg.project.publisher,
      adapter: { id: pkg.adapter.id, version: pkg.adapter.version },
      sourcePackageId: pkg.id,
      sourcePackageHash: pkg.contentHash,
      observationGraphHash: graph.contentHash,
      metricEvidenceHash: metrics.contentHash,
      candidateHash: reconstruction.candidate.contentHash,
      modelHash: reconstruction.candidate.modelHash,
      modelSha256: sha256(modelText),
      sceneContentHash: bundle.contentHash,
      sceneSha256: sha256(sceneText),
      sceneBytes: Buffer.byteLength(sceneText, 'utf8'),
      counts: {
        assets: pkg.assets.length,
        assetsByDocument: byDocument,
        observations: graph.observations.length,
        frames: graph.coordinateFrames.length,
        metricEvidence: metrics.evidence.length,
        callouts: metrics.evidence.filter((e) => e.kind === 'OPENING_CALLOUT').length,
        commands: reconstruction.candidate.program.length,
        masses: b.masses.length,
        openings: b.openings.length + b.sharedDoors.length,
        rooms: b.interior.reduce((a, i) => a + i.rooms.length, 0),
        balconies: b.balconies.length,
        terraces: b.terraces.length,
        railings: b.railings.length,
        chimneys: b.chimneys.length,
        rooflights: b.rooflights.length,
        meshes: bundle.scene.meshes.length,
        triangles: bundle.scene.meshes.reduce((a, m) => a + m.positions.length / 9, 0),
      },
      quality: { levels: levels as LinkAnalysisResult['quality']['levels'], byFamily: reconstruction.quality.summary },
      unresolved: reconstruction.unresolved.map((u) => ({ what: u.what, reason: u.reason, status: u.status })),
      warnings,
      vision: { mode: visionMode, provider: visionProvider, attempted: visionAttempted, accepted: visionAccepted },
      verification: {
        replay: 'BYTE_IDENTICAL',
        residuals: reconstruction.residuals.length,
        residualsOutsideTolerance: outside,
        closure: { exteriorErrors, exteriorFindings: closure.metrics.exteriorFindingCount, interiorFindings: closure.metrics.interiorFindingCount },
      },
      analyzer: { service: ANALYSIS_SERVICE_VERSION, solver: SOLVER_V2_VERSION },
      startedAt,
      completedAt: now().toISOString(),
      candidate: reconstruction.candidate,
      model,
      scene: bundle,
    }
    const timings: AnalysisTimings = { acquisitionMs, observationMs, metricExtractionMs, reconstructionMs, compileMs, verificationMs, totalMs: Math.round(clock() - t0) }
    return { result, pkg, graph, metrics, reconstruction, sceneText, closure, timings }
  } catch (error) {
    throw toAnalysisError(error, signal)
  }
}

/** The service's front door for a URL, in the shape the API and the brief name. */
export async function runLinkAnalysis(request: { url: string; jobId: string; options: AnalysisOptions; signal?: AbortSignal; progress?: (event: AnalysisProgress) => void }): Promise<LinkAnalysisResult> {
  const run = await runAnalysis({ kind: 'URL', url: request.url }, { ...request.options, jobId: request.jobId, signal: request.signal ?? request.options.signal, progress: request.progress ?? request.options.progress })
  return run.result
}

/** The hashes that identify what a run produced; equal for equal sealed inputs, whoever ran it. */
export const hashesOf = (result: LinkAnalysisResult): Record<string, string> => ({
  sourcePackageHash: result.sourcePackageHash,
  observationGraphHash: result.observationGraphHash,
  metricEvidenceHash: result.metricEvidenceHash,
  candidateHash: result.candidateHash,
  modelHash: result.modelHash,
  sceneContentHash: result.sceneContentHash,
  sceneSha256: result.sceneSha256,
})

export const stableResultJson = (value: unknown): string => stableJson(value)
