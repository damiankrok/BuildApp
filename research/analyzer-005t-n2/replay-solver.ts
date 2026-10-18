/**
 * replay-solver.ts — 005T-N2: re-run ONLY the v2 solver on a sealed development row (graph + metric evidence), print
 * the solver's debug lines that match --grep, and either the model hash or the typed refusal with its diagnostics
 * (RESEARCH ONLY; never imported by production).
 *
 *   npx vite-node research/analyzer-005t-n2/replay-solver.ts -- \
 *        --run <dir with observation-graph.json.gz + metric-evidence.json.gz> --package <source-package.json> \
 *        --cache <byte cache dir> --out <dir outside the repo> [--grep <regex>]
 *
 * OFFLINE: rasters are decoded from already-cached bytes. Written outside Git: model.json and summary.json, numbers and
 * ids only; no pixel is written and none is shown to anyone.
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
const value = (name: string, fallback?: string): string => {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0 || i + 1 >= process.argv.length) {
    if (fallback !== undefined) return fallback
    throw new Error(`--${name} is required`)
  }
  return process.argv[i + 1]
}
const out = resolve(value('out'))
if (out === REPO || out.startsWith(`${REPO}/`)) throw new Error('REFUSED: replay outputs never go inside the repository')
mkdirSync(out, { recursive: true })
const run = resolve(value('run'))
const grep = new RegExp(value('grep', '^$'))
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
try {
  const r = reconstructV2({
    debug: (line) => {
      if (grep.test(line)) console.log(`debug ${line}`)
    },
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
  const modelText = serializeModel(r.model)
  writeFileSync(join(out, 'model.json'), modelText)
  const summary = { outcome: 'COMPLETED', modelSha256: createHash('sha256').update(modelText).digest('hex'), chimneys: r.model.chimneys.length, unresolved: r.unresolved.filter((u) => /chimney/i.test(u.what)).map((u) => ({ status: u.status, what: u.what, reason: u.reason })) }
  writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 1) + '\n')
  console.log(JSON.stringify(summary))
} catch (error) {
  const e = error as { code?: string; message?: string; diagnostics?: unknown }
  if (!e.code) throw error
  const summary = { outcome: 'REFUSED', code: e.code, message: e.message, diagnostics: e.diagnostics ?? null }
  writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 1) + '\n')
  console.log(JSON.stringify(summary))
}
