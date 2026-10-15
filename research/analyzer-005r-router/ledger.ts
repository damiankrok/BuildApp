/**
 * ledger.ts — BUILDPLAN-ANALYZER-005R-ROUTER solver replay that exposes the evidence ledger, the feature graph and the
 * perspective cameras (RESEARCH ONLY; never imported by production). Preregistration §4 P8.
 *
 *   npx vite-node research/analyzer-005r-router/ledger.ts -- --package <source-package.json> --cache <dir> \
 *        --run <a run-case.ts output dir> --out <file outside the repository>
 *
 * The product summary does not carry the reconstruction ledger, so this re-runs `reconstructV2` (the product solver,
 * unmodified) on the graph and metric evidence a run produced, with the same rasters, and writes the ledger, the
 * feature-graph hash, the camera registrations and the model hash. The model hash must equal the run's own.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'
import { stableJson } from '@buildapp/source-common'
import { SourcePackageSchema, archonAdapter, decodeImage, fileByteCache, genericProjectPageAdapter } from '@buildapp/source-package'
import type { SourceObservationGraph } from '@buildapp/source-observations'
import type { MetricEvidenceSet } from '@buildapp/source-metrics'
import type { Raster } from '@buildapp/source-cv'
import { reconstructV2 } from '@buildapp/reconstruction'
import { identityOf } from '../../packages/analysis-service/src/index.js'

const REPO = resolve(import.meta.dirname, '../..')
const argv = process.argv
const value = (name: string): string => {
  const i = argv.indexOf(`--${name}`)
  if (i < 0 || i + 1 >= argv.length) throw new Error(`--${name} is required`)
  return argv[i + 1]
}
const out = resolve(value('out'))
if (out.startsWith(`${REPO}/`)) throw new Error('REFUSED: replay outputs never go inside the repository')
const pkg = SourcePackageSchema.parse(JSON.parse(readFileSync(value('package'), 'utf8')))
const run = resolve(value('run'))
const graph = JSON.parse(gunzipSync(readFileSync(`${run}/observation-graph.json.gz`)).toString('utf8')) as SourceObservationGraph
const metrics = JSON.parse(gunzipSync(readFileSync(`${run}/metric-evidence.json.gz`)).toString('utf8')) as MetricEvidenceSet
const cache = fileByteCache(value('cache'))
const rasters = new Map<string, Raster | undefined>()
for (const asset of pkg.assets) {
  for (const v of asset.variants) {
    if (rasters.has(v.byteHash)) continue
    const got = await cache.get(v.url)
    rasters.set(v.byteHash, got ? decodeImage(got.bytes) : undefined)
  }
}
const identity = identityOf(pkg, [archonAdapter, genericProjectPageAdapter])
const r = reconstructV2({ label: identity.label, slug: identity.slug, modelId: identity.modelId, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph, metrics, raster: (f) => rasters.get(f.variantByteHash), publishedAreas: pkg.publishedFacts, publishedRooms: pkg.publishedRooms })
const perspective = new Set(graph.coordinateFrames.filter((f) => f.roles.projection === 'PERSPECTIVE').map((f) => f.id))
const onPerspective = new Set(graph.observations.filter((o) => perspective.has(o.frameId)).map((o) => o.id))
writeFileSync(
  out,
  gzipSync(
    `${stableJson({
      modelHash: r.candidate.modelHash,
      featureGraphHash: (r.featureGraph as { contentHash?: string }).contentHash ?? null,
      violations: r.violations,
      cameras: r.registrations.cameras.map((c) => ({ frameId: c.frameId, solved: c.solved, residualPx: c.residualPx ?? null })),
      perspectiveEvidenceIds: [...onPerspective].sort(),
      ledger: r.ledger,
    })}\n`,
    { level: 9 },
  ),
)
process.stdout.write(`ledger ${r.candidate.modelHash} cameras ${r.registrations.cameras.filter((c) => c.solved).length}/${r.registrations.cameras.length}\n`)
process.exit(0)
