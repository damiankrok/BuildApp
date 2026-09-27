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
 * solver run, to replay a device that never received some drawings. The
 * script names no project and tells the analyzer nothing about what to expect.
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
import { SourcePackageSchema, archonAdapter, decodeImage, fileByteCache } from '@buildapp/source-package'
import type { SourcePackage } from '@buildapp/source-package'
import type { SourceObservationGraph } from '@buildapp/source-observations'
import type { MetricEvidenceSet } from '@buildapp/source-metrics'
import { PLAN_OVERLAY_LAYERS, isReconstructionFailure, levelsFrom, reconstructV2, renderPlanOverlay } from '@buildapp/reconstruction'
import type { PlanDiagnosticsReport, SolverTraceEvent } from '@buildapp/reconstruction'
import type { Raster } from '@buildapp/source-cv'
import { AnalysisError, PHASE_STAGE, diagnosticsBundle, encodePng, hashesOf, identityOf, runAnalysis, sourceSummaryOf, summaryOf, toAnalysisError } from '../src/index.js'
import type { AnalysisTrace } from '../src/index.js'
import { renderSceneSheet } from '../../mobile-scene/scripts/scene-sheet.js'
import { PNG } from 'pngjs'

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
    const events: SolverTraceEvent[] = []
    const entries: AnalysisTrace['entries'] = []
    try {
      const identity = identityOf(pkg, [archonAdapter])
      const r = reconstructV2({ label: identity.label, slug: identity.slug, modelId: identity.modelId, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph, metrics, raster: (f) => rasterOf(f.variantByteHash), frameFilter: dropped.size > 0 ? (f) => !dropped.has(f.id) : undefined, publishedAreas: pkg.publishedFacts, publishedRooms: pkg.publishedRooms, trace: (e) => events.push(e) })
      for (const e of events) entries.push({ stage: PHASE_STAGE[e.phase], substage: e.substage, status: e.status, startedAtMs: 0, durationMs: 0, counts: e.counts, ...(e.reasonCode ? { reasonCode: e.reasonCode } : {}), ...(e.detail ? { detail: e.detail } : {}) })
      write('analysis-trace.json', { schema: 'buildapp.analysis-trace', schemaVersion: '1.0.0', outcome: 'COMPLETED', entries })
      write('result-summary.json', { outcome: 'COMPLETED', modelHash: r.candidate.modelHash, commands: r.candidate.program.length, masses: r.building.masses.length, levels: levelsFrom(metrics, graph.coordinateFrames.find((f) => f.roles.projection === 'ORTHOGRAPHIC_SECTION')?.id) })
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
  try {
    const run = await runAnalysis(pkgIn ? { kind: 'PACKAGE', pkg: pkgIn, graph: graphIn } : { kind: 'URL', url: url as string }, {
      adapters: [archonAdapter],
      cache,
      offline: process.env.OFFLINE === '1',
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
    write('failure.json', e.failure())
    if (e.attachments?.trace) write('analysis-trace.json', e.attachments.trace)
    const bundle = e.attachments?.bundle ?? diagnosticsBundle({ outcome: 'FAILED', failure: e.failure(), trace: e.attachments?.trace ?? { schema: 'buildapp.analysis-trace', schemaVersion: '1.0.0', outcome: 'FAILED', entries: [] } })
    write('diagnostics.json', bundle.diagnostics)
    if (bundle.overlay) writeFileSync(join(out, bundle.overlay.name), bundle.overlay.png)
    if (e.attachments?.plans) {
      if (pkgIn) await loadRasters(pkgIn)
      writeOverlays(out, e.attachments.plans, rasterOf)
    }
    log(`failed: ${e.code} / ${e.failure().reasonCode ?? '-'} in ${e.failure().stage ?? '?'}: ${e.message}`)
    if (e.code === 'SOURCE_UNREACHABLE' && argv.includes('--tolerate-source-outage')) {
      log(`::warning::the publisher could not be reached (${e.message}); the analyzer was not exercised`)
      return 'SOURCE_OUTAGE'
    }
    return 'FAILED'
  }
}

/** What a replay of the same sealed evidence must reproduce. */
const SAME_AS_KEYS = ['candidateHash', 'modelHash', 'sceneContentHash', 'sceneSha256'] as const

if (!process.env.VITEST) {
  const argv = process.argv.slice(2)
  secondHouse(argv).then(
    (outcome) => {
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
