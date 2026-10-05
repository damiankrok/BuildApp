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
import type { Checkpoint } from '@buildapp/source-common'
import { createCheckpoint } from './checkpoint.js'
import type { AnalysisPhaseId, AnalysisTelemetry, PhaseStats } from './checkpoint.js'
import { SourcePackageSchema, acquireSourcePackage, decodeImage, publishedSpecificationsHash, selectedVariant } from '@buildapp/source-package'
import type { FetchDeps, FetchPolicy, SourceAdapter, SourceByteCache, SourcePackage } from '@buildapp/source-package'
import { analyzeSourcePackage } from '@buildapp/source-analyzer'
import type { SourceObservationGraph } from '@buildapp/source-observations'
import { nullVisionReasoner } from '@buildapp/source-vision'
import type { VisionReasoner } from '@buildapp/source-vision'
import { extractMetricEvidenceAsync } from '@buildapp/source-metrics'
import type { LabelRecogniser, MetricEvidenceSet } from '@buildapp/source-metrics'
import { SOLVER_V2_VERSION, isReconstructionFailure, reconstructV2, verifyReplay } from '@buildapp/reconstruction'
import type { PlanDiagnosticsReport, ReconstructionV2Phase, ReconstructionV2Result } from '@buildapp/reconstruction'
import { serializeModel } from '@buildapp/model'
import { compileBuilding, geometryClosureAudit } from '@buildapp/geometry'
import type { ClosureReport } from '@buildapp/geometry'
import { buildMobileSceneBundle, loadBundle, serializeBundle, sha256 } from '@buildapp/mobile-scene'
import { AnalysisError, PHASE_STAGE as FAILURE_STAGE, RecogniserFailure, reconstructionError, recogniserFailureKind, throwIfAborted, toAnalysisError } from './errors.js'
import type { RecogniserFailureKind } from './errors.js'
import { TraceRecorder } from './trace.js'
import type { AnalysisTrace } from './trace.js'
import { diagnosticsBundle, lostPlanAddresses } from './diagnostics.js'
import { identityOf, validateAnalysisUrl } from './identity.js'
import type { AnalysisIdentity } from './identity.js'
import { anySignal } from './signals.js'
import { progressEvent } from './stages.js'
import type { AnalysisProgress, AnalysisStage } from './stages.js'
import type { LinkAnalysisResult, RecogniserSummary, VisionMode } from './result.js'
import { warningsOf } from './warnings.js'

export const ANALYSIS_SERVICE_VERSION = '1.1.0' as const

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
  /**
   * BUILDPLAN-ANALYZER-005H: an external numeric recogniser, heard as a second witness beside the numeric lattice on
   * every plan's dimension labels (`extractMetricEvidenceAsync`). Absent — the default — the lattice reads alone, and
   * the run is byte for byte what it was before 005H. The run releases it as soon as the printed dimensions are read,
   * before reconstruction begins, and the result says which recogniser read and what it decided.
   */
  recogniser?: LabelRecogniser
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
  /**
   * Telemetry (005A): the phase, its counts and a heartbeat, from inside the
   * long loops, at most once a second. Never reaches a result or a hash.
   */
  telemetry?: (event: AnalysisTelemetry) => void
  /** Asked from inside the long loops, at most every 200 ms: true cancels the run at the next loop boundary. */
  pollCancel?: () => boolean
  /** Resident memory, sampled with the telemetry for the performance record. */
  rss?: () => number
  /** What each phase cost, told once the run ends however it ends: the performance record. */
  onPhaseStats?: (stats: PhaseStats[]) => void
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
  /** What each step established, for this completed run. */
  trace: AnalysisTrace
  /** The plan decomposition, for overlays and a diagnostics bundle. */
  planDiagnostics: PlanDiagnosticsReport
  /** What each phase cost. Diagnostics only: never part of a result or a hash. */
  phases: PhaseStats[]
}

/** The solver's phases, as telemetry phases. */
const SOLVER_PHASE: Record<ReconstructionV2Phase, AnalysisPhaseId> = {
  REGISTRATION: 'REGISTER_VIEWS',
  TOPOLOGY: 'SOLVE_TOPOLOGY',
  METRICS: 'SOLVE_METRICS',
  MODEL: 'BUILD_MODEL',
}

const PHASE_STAGE: Record<ReconstructionV2Phase, AnalysisStage> = {
  REGISTRATION: FAILURE_STAGE.REGISTRATION,
  TOPOLOGY: FAILURE_STAGE.TOPOLOGY,
  METRICS: FAILURE_STAGE.METRICS,
  MODEL: FAILURE_STAGE.MODEL,
}

const DRAWING_DOCUMENTS = new Set(['FLOOR_PLAN', 'ELEVATION', 'SECTION', 'SITE_PLAN', 'PERSPECTIVE_RENDER'])
/** The documents a building is reconstructed from. A render is a picture of the house, not a drawing of it. */
const TECHNICAL_DOCUMENTS = new Set(['FLOOR_PLAN', 'ELEVATION', 'SECTION', 'SITE_PLAN'])

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
  let current: AnalysisStage = 'ACQUIRING_SOURCE'
  const trace = new TraceRecorder(clock, t0)
  const report = (stage: AnalysisStage, fraction = 0, detail?: string): void => {
    current = stage
    const event = progressEvent(stage, fraction, detail)
    // monotone by construction; a report that would move the bar back is dropped
    if (event.progress < last) return
    last = event.progress
    options.progress?.(event)
  }
  // The loops' ticks become telemetry here; nothing recorded is read back by the computation.
  const checkpoint = createCheckpoint({ clock, now, signal, pollCancel: options.pollCancel, emit: options.telemetry, overall: () => Math.max(0, last), rss: options.rss })
  // While the run awaits the network or the disk the loops are not ticking; a timer says so.
  // 005H: while a recogniser batch runs, the work is in its worker: the heartbeat says COMPUTE, not IO_WAIT.
  let externalBusy = false
  const heartbeat = options.telemetry ? setInterval(() => checkpoint.idle(externalBusy ? 'COMPUTE' : 'IO_WAIT'), 1000) : undefined
  heartbeat?.unref?.()
  // What the run has so far, for a failure's diagnostics bundle.
  let pkgSoFar: SourcePackage | undefined
  let routeKind: 'SPECIALIST' | 'GENERIC' | 'SEALED' = 'SEALED'
  let graphSoFar: SourceObservationGraph | undefined
  let metricsSoFar: MetricEvidenceSet | undefined
  const rasterCache = new Map<string, ReturnType<typeof decodeImage> | undefined>()

  try {
    // --- ACQUIRING_SOURCE ---------------------------------------------------
    report('ACQUIRING_SOURCE', 0, input.kind === 'URL' ? 'fetching the project page' : 'reading a sealed source package')
    checkpoint.phase('ACQUIRE_PAGE')
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
        checkpoint,
        onRoute: (route) => {
          checkpoint.phase('ACQUIRE_ASSETS')
          routeKind = route.kind
          report('ACQUIRING_SOURCE', 0.1, route.kind === 'SPECIALIST' ? `read by the ${route.adapter.id} reader` : `inspected as a project page (confidence ${route.classification.confidence})`)
        },
        deps: cancellableDeps(options.deps, signal, () => {
          fetched += 1
          report('ACQUIRING_SOURCE', 0, `${fetched} address${fetched === 1 ? '' : 'es'} fetched`)
        }),
      })
    } else {
      pkg = SourcePackageSchema.parse(input.pkg)
      sourceUrl = pkg.canonicalUrl
    }
    pkgSoFar = pkg
    throwIfAborted(signal)
    const acquisitionMs = lap()
    {
      const failureCodes: Record<string, number> = {}
      for (const f of pkg.failures) failureCodes[`failed_${f.code}`] = (failureCodes[`failed_${f.code}`] ?? 0) + 1
      trace.record('ACQUIRING_SOURCE', input.kind === 'URL' ? 'FETCH' : 'SEALED_PACKAGE', 'PASSED', { route: routeKind, adapter: pkg.adapter.id, assets: pkg.assets.length, variants: pkg.assets.reduce((a, x) => a + x.variants.length, 0), addressesNotUsed: pkg.failures.length, planAddressesLost: lostPlanAddresses(pkg).length, ...failureCodes })
    }

    // --- CLASSIFYING_SOURCES ------------------------------------------------
    // The roles were claimed during acquisition; this is where they are counted,
    // and where a page with nothing to read stops before any drawing is read.
    report('CLASSIFYING_SOURCES', 0)
    checkpoint.phase('CLASSIFY', { total: pkg.assets.length })
    const byDocument: Record<string, number> = {}
    for (const a of pkg.assets) byDocument[a.roles.document] = (byDocument[a.roles.document] ?? 0) + 1
    const drawings = pkg.assets.filter((a) => DRAWING_DOCUMENTS.has(a.roles.document)).length
    if ((byDocument.FLOOR_PLAN ?? 0) === 0 && (byDocument.ELEVATION ?? 0) === 0) {
      // No technical drawing at all (renders are pictures, not drawings), or drawings but
      // neither of the two a building is reconstructed from. The first is a page without
      // drawings; the second is a project whose page is incomplete for this purpose, and
      // it is said as that, not as "no drawings".
      const technical = pkg.assets.filter((a) => TECHNICAL_DOCUMENTS.has(a.roles.document)).length
      const incomplete = technical > 0
      const message = incomplete ? 'the page exposes no floor plan and no elevation; a building cannot be reconstructed from the rest' : 'the page exposes no plan, elevation or section this analyzer reads'
      const code = incomplete ? 'SOURCE_INCOMPLETE' : 'NO_DRAWINGS'
      trace.record('CLASSIFYING_SOURCES', 'ROLES', 'FAILED', { drawings, ...byDocument }, { reasonCode: code, detail: message })
      throw new AnalysisError(code, message, { reasonCode: 'PLAN_NOT_FOUND', stage: 'CLASSIFYING_SOURCES', substage: 'ROLES', title: incomplete ? 'The project page has no floor plan' : 'No drawings to read', diagnostics: { drawings, ...byDocument } })
    }
    trace.record('CLASSIFYING_SOURCES', 'ROLES', 'PASSED', { drawings, ...byDocument })
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
      checkpoint.phase('OBSERVE_ASSETS', { total: pkg.assets.length })
      const vision = options.vision ?? nullVisionReasoner()
      const analysis = await analyzeSourcePackage(pkg, {
        bytes: bytesFor,
        vision,
        checkpoint,
        // only the graph is used from here on: release each drawing's masks as soon as it is read
        retainPrepared: false,
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
    graphSoFar = graph
    throwIfAborted(signal)
    const observationMs = lap()
    trace.record('EXTRACTING_OBSERVATIONS', 'OBSERVATIONS', 'PASSED', { frames: graph.coordinateFrames.length, observations: graph.observations.length, relations: graph.relations.length, vision: visionMode })
    report('EXTRACTING_OBSERVATIONS', 0.65, 'reading printed dimensions and callouts')

    checkpoint.phase('DECODE_RASTERS', { total: pkg.assets.length })
    for (const [index, asset] of pkg.assets.entries()) {
      checkpoint.tick({ done: index, assetIndex: index + 1, assetTotal: pkg.assets.length })
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
    // The metric pass is most of a run and reads one frame at a time: the stage's bar moves
    // with the frames (from where the drawings left it to the end of the stage), and the
    // telemetry says which frame and what inside it.
    checkpoint.phase('METRIC_FRAMES')
    const metricCheckpoint: Checkpoint = {
      phase: (id, o) => checkpoint.phase(id, o),
      tick: (w) => {
        if (w?.done !== undefined && w.total) report('EXTRACTING_OBSERVATIONS', 0.65 + 0.35 * (w.done / w.total), `frame ${w.done + 1} of ${w.total}`)
        checkpoint.tick(w)
      },
    }
    // 005H: the external recogniser reads each plan's labels in one batch, under its own sub-phase; whatever happens,
    // it is released here — its worker and its memory gone — before the solver starts.
    let recogniserMs = 0
    let releaseFailure: RecogniserFailureKind | undefined
    const reader = options.recogniser
    // The recogniser as the reading sees it: timed, marked busy, and a failure of its own named as such.
    const timed: LabelRecogniser | undefined = reader && {
      id: reader.id,
      model: reader.model,
      runtime: reader.runtime,
      ...(reader.runtimeSha256 ? { runtimeSha256: reader.runtimeSha256 } : {}),
      recognise: async (crops, o) => {
        const started = clock()
        externalBusy = true
        try {
          return await reader.recognise(crops, o)
        } catch (error) {
          if (signal?.aborted || (error as { name?: unknown } | null)?.name === 'AbortError') throw error
          throw new RecogniserFailure(error)
        } finally {
          externalBusy = false
          recogniserMs += clock() - started
        }
      },
    }
    let metrics: MetricEvidenceSet
    try {
      metrics = await extractMetricEvidenceAsync({
        checkpoint: metricCheckpoint,
        sourcePackageId: pkg.id,
        sourcePackageHash: pkg.contentHash,
        graph,
        slug: identity.slug,
        raster,
        specifications: pkg.publishedSpecifications,
        specificationHash: publishedSpecificationsHash(pkg.publishedSpecifications),
        recogniser: timed,
        signal,
        onRecognise: (e) => checkpoint.tick({ subphase: { id: 'OCR_EXTERNAL', label: 'recognising dimension labels' }, counters: { label: e.done, labelsTotal: e.total } }),
      })
    } finally {
      // released here whatever happened; a failure to release is recorded, never put in place of the run's own error
      try {
        await reader?.release?.()
      } catch (error) {
        releaseFailure = recogniserFailureKind(error)
      }
    }
    metricsSoFar = metrics
    throwIfAborted(signal)
    const metricExtractionMs = lap()
    const recogniser = reader ? { ...recogniserSummaryOf(reader, metrics, Math.round(recogniserMs)), ...(releaseFailure ? { releaseFailure } : {}) } : undefined
    trace.record('EXTRACTING_OBSERVATIONS', 'METRIC_EVIDENCE', 'PASSED', {
      evidence: metrics.evidence.length,
      chains: metrics.chains.length,
      registrations: metrics.coordinateRegistrations.length,
      callouts: metrics.evidence.filter((e) => e.kind === 'OPENING_CALLOUT').length,
      levelDatums: metrics.evidence.filter((e) => e.kind === 'LEVEL_DATUM').length,
      scalesRefused: metrics.unresolved.filter((u) => u.id.startsWith('gap-scale-implausible')).length,
      undecodable: metrics.unresolved.filter((u) => u.id.startsWith('gap-undecodable')).length,
      ...(recogniser ? { externalReadings: recogniser.crops, externalCorroborating: recogniser.corroborating, externalDisagreements: recogniser.disagreements } : {}),
    })

    // --- REGISTERING_VIEWS … BUILDING_MODEL (the solver reports its own phases)
    let resolving = false
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
      onPhase: (phase) => {
        report(PHASE_STAGE[phase], 0)
        checkpoint.phase(SOLVER_PHASE[phase])
      },
      checkpoint,
      resolverProgress: (e) => {
        if (!resolving) {
          resolving = true
          checkpoint.phase('PLAN_RESOLUTION')
        }
        checkpoint.tick({ done: e.index, total: e.total, candidateIndex: e.index, candidateTotal: e.total, subphase: e.stage === 1 ? { id: 'READINGS', label: 'weighing a reading of the plan' } : { id: 'COMPOSITIONS', label: 'composing a reading in full' } })
      },
      trace: (e) => trace.record(PHASE_STAGE[e.phase], e.substage, e.status, e.counts, { reasonCode: e.reasonCode, detail: e.detail }),
    })
    throwIfAborted(signal)
    const model = reconstruction.model
    const modelText = serializeModel(model)
    const reconstructionMs = lap()
    trace.record('BUILDING_MODEL', 'SEAL', 'PASSED', { commands: reconstruction.candidate.program.length, masses: reconstruction.building.masses.length, unresolved: reconstruction.unresolved.length })
    report('BUILDING_MODEL', 1)

    // --- COMPILING_SCENE ----------------------------------------------------
    report('COMPILING_SCENE', 0)
    checkpoint.phase('COMPILE_SCENE')
    let scene: ReturnType<typeof compileBuilding>
    try {
      scene = compileBuilding(model)
    } catch {
      trace.record('COMPILING_SCENE', 'COMPILE', 'FAILED', {}, { reasonCode: 'SCENE_COMPILE_FAILED' })
      throw reconstructionError('SCENE_COMPILE_FAILED', 'COMPILING_SCENE', 'COMPILE', 'the geometry compiler could not compile the model the analyzer built')
    }
    report('COMPILING_SCENE', 0.6, `${scene.meshes.length} meshes`)
    const bundle = buildMobileSceneBundle(model, { scene })
    const sceneText = serializeBundle(bundle)
    throwIfAborted(signal)
    const compileMs = lap()
    trace.record('COMPILING_SCENE', 'COMPILE', 'PASSED', { meshes: scene.meshes.length, sceneBytes: Buffer.byteLength(sceneText, 'utf8') })

    // --- VERIFYING ----------------------------------------------------------
    report('VERIFYING', 0)
    checkpoint.phase('VERIFY')
    const replay = verifyReplay(reconstruction.candidate)
    if (!replay.ok) {
      trace.record('VERIFYING', 'REPLAY', 'FAILED', {}, { reasonCode: 'VERIFY_REPLAY_FAILED' })
      throw reconstructionError('VERIFY_REPLAY_FAILED', 'VERIFYING', 'REPLAY', 'the sealed candidate does not replay to the model it describes')
    }
    const reloaded = loadBundle(sceneText)
    if (!reloaded.ok || reloaded.bundle.contentHash !== bundle.contentHash) {
      trace.record('VERIFYING', 'ROUND_TRIP', 'FAILED', {}, { reasonCode: 'VERIFY_REPLAY_FAILED' })
      throw reconstructionError('VERIFY_REPLAY_FAILED', 'VERIFYING', 'ROUND_TRIP', 'the scene bundle does not survive its own round trip')
    }
    trace.record('VERIFYING', 'REPLAY', 'PASSED', { commands: reconstruction.candidate.program.length })
    report('VERIFYING', 0.3, 'replay byte-identical; checking joints')
    let closure: ClosureReport
    try {
      closure = geometryClosureAudit(model, scene)
    } catch {
      trace.record('VERIFYING', 'CLOSURE', 'FAILED', {}, { reasonCode: 'VERIFY_CLOSURE_FAILED' })
      throw reconstructionError('VERIFY_CLOSURE_FAILED', 'VERIFYING', 'CLOSURE', 'the joint audit could not be run over the compiled scene')
    }
    {
      const exteriorErrorsNow = closure.findings.filter((f) => f.scope === 'EXTERIOR' && f.severity === 'ERROR').length
      trace.record('VERIFYING', 'CLOSURE', exteriorErrorsNow === 0 ? 'PASSED' : 'DEGRADED', { exteriorErrors: exteriorErrorsNow, exteriorFindings: closure.metrics.exteriorFindingCount, interiorFindings: closure.metrics.interiorFindingCount })
    }
    report('VERIFYING', 1)

    const b = reconstruction.building
    const levels: Record<string, number> = { L0: 0, L1: 0, L2: 0 }
    for (const r of reconstruction.quality.records) levels[r.level] = (levels[r.level] ?? 0) + 1
    const outside = reconstruction.residuals.filter((r) => !r.withinTolerance).length
    const exteriorErrors = closure.findings.filter((f) => f.scope === 'EXTERIOR' && f.severity === 'ERROR').length
    const warningDetails = warningsOf({
      visionMode,
      failures: pkg.failures,
      residuals: reconstruction.residuals.length,
      residualsOutside: outside,
      exteriorJointErrors: exteriorErrors,
      graphViolations: reconstruction.violations.graph.length,
      ledgerViolations: reconstruction.violations.ledger.length,
      layoutReasons: reconstruction.layout.gate.reasons,
      openingFits: reconstruction.openingFits,
      metric: reconstruction.planDiagnostics.plans.find((p) => p.frameId === reconstruction.planDiagnostics.selectedPlanFrameId)?.metric,
      extentWeak: reconstruction.planDiagnostics.plans.find((p) => p.frameId === reconstruction.planDiagnostics.selectedPlanFrameId)?.extentWeak,
    })

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
      warnings: warningDetails.map((w) => w.message),
      warningDetails,
      vision: { mode: visionMode, provider: visionProvider, attempted: visionAttempted, accepted: visionAccepted },
      ...(recogniser ? { recogniser } : {}),
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
    // The last lap closes at the same instant as the total, so the six phases partition it: the
    // summary is verification's last step, not time no phase owns.
    const verificationMs = lap()
    const timings: AnalysisTimings = { acquisitionMs, observationMs, metricExtractionMs, reconstructionMs, compileMs, verificationMs, totalMs: Math.round(mark - t0) }
    checkpoint.end()
    return { result, pkg, graph, metrics, reconstruction, sceneText, closure, timings, trace: trace.finish('COMPLETED'), planDiagnostics: reconstruction.planDiagnostics, phases: checkpoint.stats() }
  } catch (error) {
    checkpoint.end()
    const mapped = toAnalysisError(error, signal, { stage: current })
    // Every failure says which stage it happened in, whoever raised it.
    const e = mapped.detail.stage ? mapped : new AnalysisError(mapped.code, mapped.message, { ...mapped.detail, stage: current })
    const cancelled = e.code === 'CANCELLED' || e.code === 'TIMEOUT'
    // The step that stopped the run is in the trace whoever threw: the
    // solver records its own; anything else is recorded here.
    if (!trace.hasFailure()) trace.record(e.detail.stage ?? current, e.detail.substage ?? (cancelled ? 'CANCELLED' : 'UNEXPECTED'), cancelled ? 'CANCELLED' : 'FAILED', {}, { ...(e.detail.reasonCode ? { reasonCode: e.detail.reasonCode } : { reasonCode: e.code }), detail: e.message })
    const finished = trace.finish(cancelled ? 'CANCELLED' : 'FAILED')
    const plans = isReconstructionFailure(error) ? error.plans : undefined
    let bundle
    try {
      bundle = diagnosticsBundle({ outcome: finished.outcome, failure: e.failure(), pkg: pkgSoFar, plans, trace: finished, rasterOf: (hash) => rasterCache.get(hash) })
    } catch {
      bundle = undefined
    }
    // The sealed inputs the run had reached, so a failure in the solver can be replayed
    // on them alone (`second-house.ts --metrics`) without reading the drawings again.
    e.attachments = { trace: finished, ...(bundle ? { bundle } : {}), ...(plans ? { plans } : {}), ...(pkgSoFar ? { pkg: pkgSoFar } : {}), ...(graphSoFar ? { graph: graphSoFar } : {}), ...(metricsSoFar ? { metrics: metricsSoFar } : {}), ...(e.code === 'ANALYSIS_FAILED' ? { cause: error } : {}) }
    throw e
  } finally {
    if (heartbeat) clearInterval(heartbeat)
    options.onPhaseStats?.(checkpoint.stats())
  }
}

/**
 * 005H: what the external recogniser read and what the ensemble rule made of it, counted off the sealed evidence (so
 * the counts are the evidence's), with the time its batches took (diagnostics; never in a hash).
 */
export function recogniserSummaryOf(recogniser: Pick<LabelRecogniser, 'id' | 'model' | 'runtime' | 'runtimeSha256'>, metrics: MetricEvidenceSet, ms: number): RecogniserSummary {
  const read = (metrics.numericLattices ?? []).filter((l) => l.external)
  const decisions: Record<string, number> = {}
  for (const l of read) if (l.ensemble) decisions[l.ensemble.decision] = (decisions[l.ensemble.decision] ?? 0) + 1
  const count = (...ds: string[]): number => ds.reduce((a, d) => a + (decisions[d] ?? 0), 0)
  return {
    id: recogniser.id,
    modelSha256: recogniser.model.sha256,
    runtime: recogniser.runtime,
    ...(recogniser.runtimeSha256 ? { runtimeSha256: recogniser.runtimeSha256 } : {}),
    crops: read.length,
    stable: read.filter((l) => l.external?.stable).length,
    confident: read.filter((l) => l.ensemble?.external.confident).length,
    // corroborating: confident, stable and the model's own reading — what may agree as CLEAR or lead (red team A7)
    corroborating: read.filter((l) => l.ensemble?.external.confident && l.ensemble.external.stable && l.external?.greedy.text === l.ensemble.external.text).length,
    agrees: count('AGREES'),
    // disagreements with the lattice's own reading; a reading that led over none is counted apart
    disagreements: count('CONTESTS', 'CONTESTS_COUNT'),
    leads: count('LEADS'),
    decisions: Object.fromEntries(Object.entries(decisions).sort(([a], [b]) => (a < b ? -1 : 1))),
    ms,
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
