/**
 * replay-reconstruct.ts — 005S-N1 technical openings: re-run ONLY the v2 solver on a sealed development row
 * (RESEARCH ONLY; never imported by production).
 *
 *   npx vite-node research/analyzer-005s-openings/replay-reconstruct.ts -- \
 *        --run <work005r-n1/runs/N1v/<case>> --package <source-package.json> --cache <byte cache dir> --out <dir outside the repo>
 *
 * The observation graph and the metric evidence are the ones the N1 development replay sealed (so OCR is not re-run),
 * the rasters are decoded from the already-cached bytes (OFFLINE: the cache is read, never fetched), and the working
 * tree's `reconstructV2` builds the model. Written outside Git: model.json, openings.json (numbers and ids only) and
 * steps.json. No pixel is written and none is shown to anyone.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { join, resolve } from 'node:path'
import { serializeModel } from '@buildapp/model'
import { SourcePackageSchema, archonAdapter, decodeImage, fileByteCache, genericProjectPageAdapter, selectedVariant } from '@buildapp/source-package'
import { reconstructV2 } from '@buildapp/reconstruction'
import { identityOf } from '../../packages/analysis-service/src/identity.js'

const REPO = resolve(import.meta.dirname, '../..')
const value = (name: string): string => {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0 || i + 1 >= process.argv.length) throw new Error(`--${name} is required`)
  return process.argv[i + 1]
}
const out = resolve(value('out'))
if (out === REPO || out.startsWith(`${REPO}/`)) throw new Error('REFUSED: replay outputs never go inside the repository')
mkdirSync(out, { recursive: true })
const run = resolve(value('run'))
const pkg = SourcePackageSchema.parse(JSON.parse(readFileSync(value('package'), 'utf8')))
if (!['www.archon.pl', 'www.projektydomownowoczesnych.pl'].includes(new URL(pkg.canonicalUrl).host)) throw new Error('REFUSED: publisher not screened USABLE_FOR_LOCAL_RESEARCH')
const graph = JSON.parse(gunzipSync(readFileSync(join(run, 'observation-graph.json.gz'))).toString('utf8'))
const metrics = JSON.parse(gunzipSync(readFileSync(join(run, 'metric-evidence.json.gz'))).toString('utf8'))
const cache = fileByteCache(value('cache'))
const rasters = new Map<string, ReturnType<typeof decodeImage> | undefined>()
for (const asset of pkg.assets) {
  const variant = selectedVariant(asset)
  const got = await cache.get(variant.url)
  if (!got) continue
  try {
    rasters.set(variant.byteHash, decodeImage(got.bytes))
  } catch {
    rasters.set(variant.byteHash, undefined)
  }
}
const identity = identityOf(pkg, [archonAdapter, genericProjectPageAdapter])
const t0 = performance.now()
const r = reconstructV2({
  modelId: identity.modelId,
  label: identity.label,
  slug: identity.slug,
  sourcePackageId: pkg.id,
  sourcePackageHash: pkg.contentHash,
  graph,
  metrics,
  raster: (frame: { variantByteHash: string }) => rasters.get(frame.variantByteHash),
  publishedAreas: pkg.publishedFacts,
  publishedRooms: pkg.publishedRooms,
})
const ms = Math.round(performance.now() - t0)
const modelText = serializeModel(r.model)
writeFileSync(join(out, 'model.json'), modelText)
const exteriorOpenings = r.model.openings
  .filter((o) => !o.wallId.includes('-iwall'))
  .map((o) => ({ id: o.id, wallId: o.wallId, kind: o.kind, offset: o.offset, width: o.width, sill: o.sill, height: o.height, status: o.evidence?.status, properties: o.evidence?.properties ?? {} }))
writeFileSync(join(out, 'openings.json'), JSON.stringify(exteriorOpenings, null, 1) + '\n')
writeFileSync(join(out, 'steps.json'), JSON.stringify({ steps: r.candidate.steps, unresolved: r.unresolved.map((u) => ({ status: u.status, what: u.what, reason: u.reason })) }, null, 1) + '\n')
const summary = { modelSha256: createHash('sha256').update(modelText).digest('hex'), openings: exteriorOpenings.length, reconstructMs: ms }
writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 1) + '\n')
console.log(JSON.stringify(summary))
