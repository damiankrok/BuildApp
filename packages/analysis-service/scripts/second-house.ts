/**
 * `npm run analysis:second-house -- --url <project url> --out <dir>`
 * `npm run analysis:second-house -- --package <pkg.json> --graph <graph.json> [--metrics <metrics.json>] --out <dir>`
 *
 * One project through the production pipeline, with everything a reviewer of
 * a generalization stage needs written beside it (BUILDAPP-03Y2G):
 *
 *   source-package.json  observation-graph.json  metric-evidence.json   the sealed inputs
 *   source-hashes.json                                                  what was read, by hash
 *   analysis-trace.json                                                 every step and what it established
 *   result-summary.json | failure.json                                  the outcome
 *   model.json                                                          the model, canonical (on completion)
 *   plan-diagnostics/digest.json, <frame>-<layer>.png                   the decomposition over the plan,
 *                                                                        one picture per question
 *   scene-views.png                                                     the building, from four cameras
 *   diagnostics.json, plan-overlay.png                                  on a failure: the phone's bundle
 *
 * With `--metrics`, the metric evidence is taken as given instead of being
 * read again, and the solver runs on it directly: that is how an earlier
 * reading (a pre-fix one, say) is put through today's solver to see what it
 * now says about it. `--drop-frames <id,id>` withholds frames from that
 * solver run, to replay a device that never received some drawings. With
 * `--decoy-footprint <factor>` the published footprint the solver is given is
 * multiplied by the factor: a replay that tests the figure never chooses the
 * drawing's scale (a decoy must be refused by name, never built to). The
 * script names no project and tells the analyzer nothing about what to expect.
 *
 * `--recogniser` (005H) reads every plan's dimension labels with the external
 * numeric recogniser as well (`@buildapp/numeric-recogniser-ort`), exactly as
 * the phone does: its worker bundled from this checkout, its model and
 * runtime verified against their pins, one worker per batch. Without it the
 * lattice reads alone, as every gate before 005H did.
 *
 * As a CI gate: `--expect COMPLETED` fails the command unless the run
 * completes; `--same-as <result-summary.json>` also requires the candidate,
 * model and scene hashes of an earlier run (a replay of sealed evidence must
 * reproduce it); `--tolerate-source-outage` turns a publisher that cannot be
 * reached into a warning, because the gate is on the analyzer, not the site.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { stableJson } from '@buildapp/source-common'
import { serializeModel } from '@buildapp/model'
import { SourcePackageSchema, archonAdapter, decodeImage, fileByteCache, genericProjectPageAdapter } from '@buildapp/source-package'
import type { SourcePackage } from '@buildapp/source-package'
import type { SourceObservationGraph } from '@buildapp/source-observations'
import type { MetricEvidenceSet } from '@buildapp/source-metrics'
import { PLAN_OVERLAY_LAYERS, isReconstructionFailure, levelsFrom, reconstructV2, renderPlanOverlay } from '@buildapp/reconstruction'
import type { PlanDiagnosticsReport, SolverTraceEvent } from '@buildapp/reconstruction'
import type { Raster } from '@buildapp/source-cv'
import { AnalysisError, PHASE_STAGE, diagnosticsBundle, encodePng, hashesOf, identityOf, runAnalysis, sourceSummaryOf, summaryOf, toAnalysisError } from '../src/index.js'
import type { AnalysisTelemetry, AnalysisTrace, PhaseStats } from '../src/index.js'
import { renderSceneSheet } from '../../mobile-scene/scripts/scene-sheet.js'
import { PNG } from 'pngjs'
import { execFileSync } from 'node:child_process'
import { basename } from 'node:path'
import { AXIS_TOPOLOGY_VERSION, METRIC_EVIDENCE_TOPOLOGY_SCHEMA_VERSION, METRIC_READER_VERSION, METRIC_SOLVER_VERSION, DIMENSION_TOPOLOGY_VERSION } from '@buildapp/source-metrics'
import { BOUNDARY_EVIDENCE_VERSION, PLAN_RESOLVER_VERSION, SOLVER_V2_VERSION } from '@buildapp/reconstruction'
import { GENERIC_ADAPTER_VERSION } from '@buildapp/source-package'
import { ANALYSIS_SERVICE_VERSION } from '../src/index.js'
import { EVIDENCE_PACK_VERSION } from '../../evidence-pack/src/index.js'
import { packRunDir } from '../../evidence-pack/scripts/run-dir.js'
import { pathToFileURL } from 'node:url'
import { workerRecogniser, workspaceAssetPaths } from '@buildapp/numeric-recogniser-ort'
import type { OrtRecogniser } from '@buildapp/numeric-recogniser-ort'
// @ts-expect-error — a plain ES module without type declarations
import { bundleRecogniserWorker } from '../../numeric-recogniser-ort/build.mjs'

const value = (argv: readonly string[], name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined
}

function writeOverlays(out: string, plans: PlanDiagnosticsReport, rasterOf: (hash: string) => Raster | undefined): string[] {
  const dir = join(out, 'plan-diagnostics')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'digest.json'), `${stableJson(plans)}\n`)
  const written: string[] = []
  for (const plan of plans.plans) {
    const raster = rasterOf(plan.variantByteHash)
    if (!raster) continue
    const slug = plan.frameId.replace(/^frame-/, '').slice(-32)
    for (const layer of PLAN_OVERLAY_LAYERS) {
      const name = `${slug}-${layer.toLowerCase()}.png`
      writeFileSync(join(dir, name), encodePng(renderPlanOverlay(raster, plan, layer)))
      written.push(name)
    }
  }
  return written
}

export async function secondHouse(argv: readonly string[], log: (line: string) => void = (l) => process.stdout.write(`${l}\n`)): Promise<'COMPLETED' | 'FAILED' | 'SOURCE_OUTAGE'> {
  const out = value(argv, 'out') ?? join(process.cwd(), '.cache', 'second-house')
  const cache = fileByteCache(value(argv, 'cache') ?? join(process.cwd(), '.cache', 'source-bytes'))
  mkdirSync(out, { recursive: true })
  const write = (name: string, data: unknown): void => writeFileSync(join(out, name), `${stableJson(data)}\n`)
  const url = value(argv, 'url')
  const packagePath = value(argv, 'package')
  const graphPath = value(argv, 'graph')
  const metricsPath = value(argv, 'metrics')
  const rasters = new Map<string, Raster | undefined>()
  const rasterOf = (hash: string): Raster | undefined => rasters.get(hash)
  const loadRasters = async (pkg: SourcePackage): Promise<void> => {
    for (const asset of pkg.assets) {
      for (const v of asset.variants) {
        if (rasters.has(v.byteHash)) continue
        const got = await cache.get(v.url)
        try {
          rasters.set(v.byteHash, got ? decodeImage(got.bytes) : undefined)
        } catch {
          rasters.set(v.byteHash, undefined)
        }
      }
    }
  }

  // --- the solver alone, on evidence taken as given ---------------------------
  if (metricsPath) {
    if (!packagePath || !graphPath) throw new Error('--metrics needs --package and --graph')
    const pkg = SourcePackageSchema.parse(JSON.parse(readFileSync(packagePath, 'utf8')))
    const graph = JSON.parse(readFileSync(graphPath, 'utf8')) as SourceObservationGraph
    const metrics = JSON.parse(readFileSync(metricsPath, 'utf8')) as MetricEvidenceSet
    await loadRasters(pkg)
    const dropped = new Set((value(argv, 'drop-frames') ?? '').split(',').filter(Boolean))
    const decoy = value(argv, 'decoy-footprint')
    const factor = decoy === undefined ? 1 : Number(decoy)
    if (!Number.isFinite(factor) || factor <= 0) throw new Error(`--decoy-footprint needs a positive factor, not ${decoy}`)
    const publishedAreas = factor === 1 ? pkg.publishedFacts : pkg.publishedFacts?.map((f) => (f.key === 'footprint_area' ? { ...f, value: Math.round(f.value * factor * 100) / 100 } : f))
    if (factor !== 1) log(`decoy: the published footprint is given as ${factor} × the publisher's`)
    // What the solver was given, beside what it made of it: the package (with any decoy figure as given) and the evidence.
    write('source-package.json', factor === 1 ? pkg : { ...pkg, publishedFacts: publishedAreas })
    write('metric-evidence.json', metrics)
    const events: SolverTraceEvent[] = []
    const entries: AnalysisTrace['entries'] = []
    try {
      const identity = identityOf(pkg, [archonAdapter, genericProjectPageAdapter])
      const r = reconstructV2({ label: identity.label, slug: identity.slug, modelId: identity.modelId, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph, metrics, raster: (f) => rasterOf(f.variantByteHash), frameFilter: dropped.size > 0 ? (f) => !dropped.has(f.id) : undefined, publishedAreas, publishedRooms: pkg.publishedRooms, trace: (e) => events.push(e) })
      for (const e of events) entries.push({ stage: PHASE_STAGE[e.phase], substage: e.substage, status: e.status, startedAtMs: 0, durationMs: 0, counts: e.counts, ...(e.reasonCode ? { reasonCode: e.reasonCode } : {}), ...(e.detail ? { detail: e.detail } : {}) })
      write('analysis-trace.json', { schema: 'buildapp.analysis-trace', schemaVersion: '1.0.0', outcome: 'COMPLETED', entries })
      write('result-summary.json', { outcome: 'COMPLETED', modelHash: r.candidate.modelHash, commands: r.candidate.program.length, masses: r.building.masses.length, levels: levelsFrom(metrics, graph.coordinateFrames.find((f) => f.roles.projection === 'ORTHOGRAPHIC_SECTION')?.id) })
      writeFileSync(join(out, 'model.json'), serializeModel(r.model))
      write('program.json', r.candidate.program)
      writeOverlays(out, r.planDiagnostics, rasterOf)
      log(`solver on the given evidence: completed, model ${r.candidate.modelHash.slice(0, 16)}`)
      return 'COMPLETED'
    } catch (error) {
      for (const e of events) entries.push({ stage: PHASE_STAGE[e.phase], substage: e.substage, status: e.status, startedAtMs: 0, durationMs: 0, counts: e.counts, ...(e.reasonCode ? { reasonCode: e.reasonCode } : {}), ...(e.detail ? { detail: e.detail } : {}) })
      const trace: AnalysisTrace = { schema: 'buildapp.analysis-trace', schemaVersion: '1.0.0', outcome: 'FAILED', entries }
      const e = toAnalysisError(error)
      write('analysis-trace.json', trace)
      write('failure.json', e.failure())
      if (isReconstructionFailure(error) && error.plans) writeOverlays(out, error.plans, rasterOf)
      log(`solver on the given evidence: ${e.code} / ${e.failure().reasonCode ?? '-'}: ${e.message}`)
      return 'FAILED'
    }
  }

  // --- the production pipeline --------------------------------------------------
  let pkgIn: SourcePackage | undefined
  let graphIn: SourceObservationGraph | undefined
  if (packagePath && existsSync(packagePath)) {
    pkgIn = SourcePackageSchema.parse(JSON.parse(readFileSync(packagePath, 'utf8')))
    graphIn = graphPath && existsSync(graphPath) ? (JSON.parse(readFileSync(graphPath, 'utf8')) as SourceObservationGraph) : undefined
  } else if (!url) throw new Error('give --url, or --package [--graph]')
  // The performance record (005A): what each phase cost and how long it went silent. Never hashed.
  const telemetry: AnalysisTelemetry[] = []
  let phases: PhaseStats[] = []
  // 005H: the external recogniser, as the phone runs it (a worker per batch), when asked for.
  let recogniser: OrtRecogniser | undefined
  if (argv.includes('--recogniser')) {
    const worker = join(process.cwd(), '.cache', 'numeric-recogniser-ort', 'ocr-worker.mjs')
    await bundleRecogniserWorker(worker)
    recogniser = workerRecogniser({ workerUrl: pathToFileURL(worker), paths: workspaceAssetPaths() })
  }
  const t0 = performance.now()
  const writePerformance = (): void => {
    write('performance.json', {
      node: process.version,
      arch: process.arch,
      totalMs: Math.round(performance.now() - t0),
      peakRssMB: Math.round(process.resourceUsage().maxRSS / 1024),
      maxTickGapMs: Math.max(0, ...phases.map((p) => p.maxTickGapMs)),
      telemetryEvents: telemetry.length,
      maxTelemetryGapMs: telemetry.reduce((m, e, i) => (i === 0 ? 0 : Math.max(m, e.elapsedMs - telemetry[i - 1].elapsedMs)), 0),
      phases,
      ...(recogniser ? { recogniser: { id: recogniser.id, batches: recogniser.stats() } } : {}),
    })
    if (process.env.TELEMETRY) writeFileSync(join(out, 'telemetry.ndjson'), telemetry.map((e) => JSON.stringify(e)).join('\n') + '\n')
  }
  try {
    const run = await runAnalysis(pkgIn ? { kind: 'PACKAGE', pkg: pkgIn, graph: graphIn } : { kind: 'URL', url: url as string }, {
      adapters: [archonAdapter, genericProjectPageAdapter],
      cache,
      offline: process.env.OFFLINE === '1',
      telemetry: (e) => telemetry.push(e),
      rss: () => process.memoryUsage.rss(),
      onPhaseStats: (s) => {
        phases = s
      },
      recogniser,
      // no identity override: the model is named from its package exactly as the
      // phone and the service name it, so their hashes can be compared with these
      progress: process.env.PROGRESS ? (e) => process.stderr.write(`  ${(e.progress * 100).toFixed(0).padStart(3)}% ${e.stage}${e.detail ? ` — ${e.detail}` : ''}\n`) : undefined,
    })
    await loadRasters(run.pkg)
    write('source-package.json', run.pkg)
    write('observation-graph.json', run.graph)
    write('metric-evidence.json', run.metrics)
    write('source-hashes.json', sourceSummaryOf(run.pkg))
    write('analysis-trace.json', run.trace)
    write('result-summary.json', { ...summaryOf(run.result), timings: run.timings })
    // the model itself, canonical, for the architecture exports (roof graph, assembly graph) of stage 03G
    writeFileSync(join(out, 'model.json'), serializeModel(run.result.model))
    writeOverlays(out, run.planDiagnostics, rasterOf)
    writeFileSync(join(out, 'scene-views.png'), PNG.sync.write(renderSceneSheet(run.result.scene)))
    writePerformance()
    for (const [k, h] of Object.entries(hashesOf(run.result))) log(`  ${k.padEnd(22)} ${h}`)
    log(`completed: ${run.result.counts.masses} masses, ${run.result.counts.openings} openings, ${run.result.counts.commands} commands, ${run.result.counts.meshes} meshes, ${run.timings.totalMs} ms`)
    const sameAs = value(argv, 'same-as')
    if (sameAs) {
      const earlier = JSON.parse(readFileSync(sameAs, 'utf8')) as Record<string, unknown>
      const now = summaryOf(run.result) as unknown as Record<string, unknown>
      const differ = SAME_AS_KEYS.filter((k) => earlier[k] !== now[k])
      for (const k of differ) log(`  ${k} differs: ${String(earlier[k])} before, ${String(now[k])} now`)
      if (differ.length > 0) return 'FAILED'
      log(`the same as ${sameAs}: ${SAME_AS_KEYS.join(', ')}`)
    }
    return 'COMPLETED'
  } catch (error) {
    const e = error instanceof AnalysisError ? error : toAnalysisError(error)
    writePerformance()
    write('failure.json', e.failure())
    if (e.attachments?.trace) write('analysis-trace.json', e.attachments.trace)
    // The sealed inputs a failed run had reached, so the solver can be replayed on them alone.
    if (e.attachments?.pkg) write('source-package.json', e.attachments.pkg)
    if (e.attachments?.graph) write('observation-graph.json', e.attachments.graph)
    if (e.attachments?.metrics) write('metric-evidence.json', e.attachments.metrics)
    const bundle = e.attachments?.bundle ?? diagnosticsBundle({ outcome: 'FAILED', failure: e.failure(), trace: e.attachments?.trace ?? { schema: 'buildapp.analysis-trace', schemaVersion: '1.0.0', outcome: 'FAILED', entries: [] } })
    write('diagnostics.json', bundle.diagnostics)
    if (bundle.overlay) writeFileSync(join(out, bundle.overlay.name), bundle.overlay.png)
    if (e.attachments?.plans) {
      if (pkgIn) await loadRasters(pkgIn)
      writeOverlays(out, e.attachments.plans, rasterOf)
    }
    log(`failed: ${e.code} / ${e.failure().reasonCode ?? '-'} in ${e.failure().stage ?? '?'}: ${e.message}`)
    // The raw cause of an unexpected failure, for the developer running this script; never part of any artifact.
    if (process.env.ANALYSIS_DEBUG && e.attachments?.cause) process.stderr.write(`cause: ${e.attachments.cause instanceof Error ? e.attachments.cause.stack : String(e.attachments.cause)}\n`)
    if (e.code === 'SOURCE_UNREACHABLE' && argv.includes('--tolerate-source-outage')) {
      log(`::warning::the publisher could not be reached (${e.message}); the analyzer was not exercised`)
      return 'SOURCE_OUTAGE'
    }
    return 'FAILED'
  }
}

/** What a replay of the same sealed evidence must reproduce. */
const SAME_AS_KEYS = ['candidateHash', 'modelHash', 'sceneContentHash', 'sceneSha256'] as const

/**
 * Evidence mode (BUILDPLAN-ANALYZER-005D): `ANALYZER_EVIDENCE=1` or `--evidence <dir>`. OFF by default.
 *
 * The pack is built AFTER the run, from the files the run wrote, and the run never learns whether it
 * will be: nothing here reaches `runAnalysis` or the solver, so candidate ordering, heuristics,
 * timeouts, seeds and every hash are the same with it and without it (sealed by a test). Its own
 * cost is recorded apart from the run's (`evidence-performance.json`).
 */
export function evidenceDirOf(argv: readonly string[], out: string): string | undefined {
  const explicit = value(argv, 'evidence')
  if (explicit) return explicit
  return process.env.ANALYZER_EVIDENCE === '1' ? join(out, 'evidence-pack') : undefined
}

export const ANALYZER_VERSIONS: Record<string, string> = {
  'analysis-service': ANALYSIS_SERVICE_VERSION,
  'solver-v2': SOLVER_V2_VERSION,
  'metric-evidence-schema': METRIC_EVIDENCE_TOPOLOGY_SCHEMA_VERSION,
  'metrics.numeric-ocr': METRIC_READER_VERSION,
  'metrics.dimension-topology': DIMENSION_TOPOLOGY_VERSION,
  'metrics.axis-topology': AXIS_TOPOLOGY_VERSION,
  'metrics.independent-scale': METRIC_SOLVER_VERSION,
  'plan-resolver': PLAN_RESOLVER_VERSION,
  'boundary-evidence': BOUNDARY_EVIDENCE_VERSION,
  'generic-reader': GENERIC_ADAPTER_VERSION,
  'evidence-pack': EVIDENCE_PACK_VERSION,
}

const gitShaOf = (): string | undefined => {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || undefined
  } catch {
    return undefined
  }
}

export function writeEvidencePack(argv: readonly string[], out: string, log: (line: string) => void): void {
  const dir = evidenceDirOf(argv, out)
  if (!dir) return
  const { pack, ms } = packRunDir(out, dir, value(argv, 'evidence-id') ?? basename(out), { gitSha: gitShaOf(), versions: ANALYZER_VERSIONS })
  writeFileSync(join(out, 'evidence-performance.json'), `${stableJson({ evidencePackMs: ms, files: pack.manifest.files.length, decisions: pack.timeline.length })}\n`)
  log(`evidence pack: ${pack.manifest.files.length} files, ${pack.timeline.length} decisions, ${ms} ms → ${dir}`)
}

if (!process.env.VITEST) {
  const argv = process.argv.slice(2)
  secondHouse(argv).then(
    (outcome) => {
      try {
        writeEvidencePack(argv, value(argv, 'out') ?? join(process.cwd(), '.cache', 'second-house'), (l) => process.stdout.write(`${l}\n`))
      } catch (error) {
        // The pack is observational: failing to write it changes nothing the run decided, and is reported, not hidden.
        process.stdout.write(`::warning::evidence pack not written: ${error instanceof Error ? error.message : String(error)}\n`)
      }
      // --expect COMPLETED makes a failure fail the command (a CI gate); without it the outcome is reported, not judged.
      const expected = value(argv, 'expect')
      if (expected && expected !== outcome && outcome !== 'SOURCE_OUTAGE') process.exitCode = 1
    },
    (error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
      process.exitCode = 2
    },
  )
}
