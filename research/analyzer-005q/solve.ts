/**
 * solve.ts — BUILDPLAN-ANALYZER-005Q solver-only replay (RESEARCH ONLY; never imported by production).
 *
 *   OFFLINE=1 npx vite-node [--config <variant>/vite.config.mjs] research/analyzer-005q/solve.ts -- \
 *     --package … --graph … --metrics … --cache … --out <dir> [--drop-frames a,b]
 *
 * The solver alone on sealed evidence, exactly as `packages/analysis-service/scripts/second-house.ts`'s `--metrics`
 * path (same calls, same files: analysis-trace.json, result-summary.json | failure.json, model.json, program.json,
 * plan-diagnostics/digest.json — validated byte for byte against it on the development rows), plus two research
 * sidecars that path does not write:
 *   unresolved.json   the run's typed gaps (`result.unresolved`: what, reason, status), [] on a refusal;
 *   provenance.json   every solved MASS feature's provenance and why, and the model's wall-ring evidence.
 * No overlay is drawn (they are publisher-derived pictures).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { stableJson } from '@buildapp/source-common'
import { serializeModel } from '@buildapp/model'
import { SourcePackageSchema, archonAdapter, decodeImage, fileByteCache, genericProjectPageAdapter } from '@buildapp/source-package'
import type { SourcePackage } from '@buildapp/source-package'
import type { SourceObservationGraph } from '@buildapp/source-observations'
import type { MetricEvidenceSet } from '@buildapp/source-metrics'
import { isReconstructionFailure, levelsFrom, reconstructV2 } from '@buildapp/reconstruction'
import type { SolverTraceEvent } from '@buildapp/reconstruction'
import type { Raster } from '@buildapp/source-cv'
import { PHASE_STAGE, identityOf, toAnalysisError } from '../../packages/analysis-service/src/index.js'
import type { AnalysisTrace } from '../../packages/analysis-service/src/index.js'

const argv = process.argv.slice(2)
const value = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const need = (name: string): string => {
  const v = value(name)
  if (!v) throw new Error(`--${name} is required`)
  return v
}
const out = need('out')
mkdirSync(join(out, 'plan-diagnostics'), { recursive: true })
const write = (name: string, data: unknown): void => writeFileSync(join(out, name), `${stableJson(data)}\n`)
const cache = fileByteCache(need('cache'))
const pkg = SourcePackageSchema.parse(JSON.parse(readFileSync(need('package'), 'utf8'))) as SourcePackage
const graph = JSON.parse(readFileSync(need('graph'), 'utf8')) as SourceObservationGraph
const metrics = JSON.parse(readFileSync(need('metrics'), 'utf8')) as MetricEvidenceSet
const rasters = new Map<string, Raster | undefined>()
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
const dropped = new Set((value('drop-frames') ?? '').split(',').filter(Boolean))
const events: SolverTraceEvent[] = []
const entries: AnalysisTrace['entries'] = []
const flush = (): void => {
  for (const e of events) entries.push({ stage: PHASE_STAGE[e.phase], substage: e.substage, status: e.status, startedAtMs: 0, durationMs: 0, counts: e.counts, ...(e.reasonCode ? { reasonCode: e.reasonCode } : {}), ...(e.detail ? { detail: e.detail } : {}) })
}
try {
  const identity = identityOf(pkg, [archonAdapter, genericProjectPageAdapter])
  const r = reconstructV2({ label: identity.label, slug: identity.slug, modelId: identity.modelId, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph, metrics, raster: (f) => rasters.get(f.variantByteHash), frameFilter: dropped.size > 0 ? (f) => !dropped.has(f.id) : undefined, publishedAreas: pkg.publishedFacts, publishedRooms: pkg.publishedRooms, trace: (e) => events.push(e) })
  flush()
  write('analysis-trace.json', { schema: 'buildapp.analysis-trace', schemaVersion: '1.0.0', outcome: 'COMPLETED', entries })
  write('result-summary.json', { outcome: 'COMPLETED', modelHash: r.candidate.modelHash, commands: r.candidate.program.length, masses: r.building.masses.length, levels: levelsFrom(metrics, graph.coordinateFrames.find((f) => f.roles.projection === 'ORTHOGRAPHIC_SECTION')?.id) })
  writeFileSync(join(out, 'model.json'), serializeModel(r.model))
  write('program.json', r.candidate.program)
  writeFileSync(join(out, 'plan-diagnostics', 'digest.json'), `${stableJson(r.planDiagnostics)}\n`)
  write('unresolved.json', r.unresolved.map((u) => ({ what: u.what, reason: u.reason, status: u.status })))
  write('provenance.json', {
    masses: r.featureGraph.solved.filter((s) => s.family === 'MASS').map((s) => ({ id: s.id, provenance: s.provenance, why: s.why })),
    wallRings: r.model.wallRings.map((w) => ({ id: w.id, status: w.evidence?.status ?? null, interpretation: w.evidence?.interpretation ?? null })),
  })
  process.stdout.write(`completed ${r.candidate.modelHash.slice(0, 16)}\n`)
} catch (error) {
  flush()
  const e = toAnalysisError(error)
  write('analysis-trace.json', { schema: 'buildapp.analysis-trace', schemaVersion: '1.0.0', outcome: 'FAILED', entries })
  write('failure.json', e.failure())
  if (isReconstructionFailure(error) && error.plans) writeFileSync(join(out, 'plan-diagnostics', 'digest.json'), `${stableJson(error.plans)}\n`)
  write('unresolved.json', [])
  process.stdout.write(`failed ${e.code}\n`)
}
