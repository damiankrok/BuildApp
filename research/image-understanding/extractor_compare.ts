/**
 * IU-02 §7: the EXISTING production solver (reconstructV2, facade registration and the plan-free facade opening scan)
 * run twice on one development house — once on the publisher's elevation rasters, once with each elevation raster
 * replaced by its cleaned counterpart of the same size (iu2/clean.py: identity transform, only colours change).
 * The solver's code is not touched; only the `raster` callback differs. Everything else (sealed graph, metric
 * evidence, plans, sections) is the same bytes.
 *
 *   npx vite-node research/image-understanding/extractor_compare.ts -- --house <id> --run <dir> --package <json> \
 *        --cache <byte cache> --clean <json {assetId: clean png}> --out <json outside the repo>
 *
 * RESEARCH ONLY; production never imports it. OFFLINE: rasters come from cached bytes and local PNGs.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { join, resolve } from 'node:path'
import { serializeModel } from '@buildapp/model'
import { SourcePackageSchema, archonAdapter, decodeImage, fileByteCache, genericProjectPageAdapter, selectedVariant } from '@buildapp/source-package'
import { reconstructV2 } from '@buildapp/reconstruction'
import { identityOf } from '../../packages/analysis-service/src/identity.js'

const REPO = resolve(import.meta.dirname, '../..')
const arg = (name: string, fallback?: string): string => {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0 || i + 1 >= process.argv.length) {
    if (fallback !== undefined) return fallback
    throw new Error(`--${name} is required`)
  }
  return process.argv[i + 1]
}
const out = resolve(arg('out'))
if (out === REPO || out.startsWith(`${REPO}/`)) throw new Error('REFUSED: comparison outputs never go inside the repository')
const run = resolve(arg('run'))
const pkg = SourcePackageSchema.parse(JSON.parse(readFileSync(arg('package'), 'utf8')))
const load = (name: string): unknown => JSON.parse(existsSync(join(run, `${name}.json`)) ? readFileSync(join(run, `${name}.json`), 'utf8') : gunzipSync(readFileSync(join(run, `${name}.json.gz`))).toString('utf8'))
const graph = load('observation-graph') as never
const metrics = load('metric-evidence') as never
const cache = fileByteCache(arg('cache'))
const cleanMap: Record<string, string> = arg('clean', '') ? JSON.parse(readFileSync(arg('clean'), 'utf8')) : {}

type Raster = ReturnType<typeof decodeImage>
const rawRasters = new Map<string, Raster | undefined>()
const cleanRasters = new Map<string, Raster | undefined>()
const swapped: string[] = []
for (const asset of pkg.assets) {
  const variant = selectedVariant(asset)
  const got = await cache.get(variant.url)
  if (!got) continue
  let raw: Raster | undefined
  try {
    raw = decodeImage(got.bytes)
  } catch {
    raw = undefined
  }
  rawRasters.set(variant.byteHash, raw)
  const cleanPath = cleanMap[asset.id]
  if (cleanPath && raw) {
    const c = decodeImage(new Uint8Array(readFileSync(cleanPath)))
    if (c.width !== raw.width || c.height !== raw.height) throw new Error(`clean raster for ${asset.id} is ${c.width}x${c.height}, source ${raw.width}x${raw.height}: not the identity transform`)
    cleanRasters.set(variant.byteHash, c)
    swapped.push(asset.id)
  } else {
    cleanRasters.set(variant.byteHash, raw)
  }
}
const identity = identityOf(pkg, [archonAdapter, genericProjectPageAdapter])

function solve(rasters: Map<string, Raster | undefined>) {
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
  const fa = (r as unknown as { facadeAlignment: { views: unknown[]; readings: Array<Record<string, unknown>>; rejected: unknown[]; counts: unknown } }).facadeAlignment
  const modelText = serializeModel(r.model)
  return {
    modelSha256: createHash('sha256').update(modelText).digest('hex'),
    views: r.viewAudit,
    facadeViews: fa.views,
    readings: fa.readings.map((x) => ({ facade: x.facade, frameId: x.frameId, storeyIndex: x.storeyIndex, from: x.from, to: x.to, sillY: x.sillY, headY: x.headY, kind: x.kind, widthM: x.widthM })),
    rejected: fa.rejected.length,
    counts: fa.counts,
    openings: r.building.openings.map((o) => ({ facade: o.facade, storeyIndex: o.storeyIndex, interval: o.interval, sillY: o.sillY, headY: o.headY })),
  }
}
const t0 = Date.now()
const raw = solve(rawRasters)
const t1 = Date.now()
const clean = solve(cleanRasters)
writeFileSync(out, JSON.stringify({ house: arg('house'), swapped, raw, clean, seconds: { raw: (t1 - t0) / 1000, clean: (Date.now() - t1) / 1000 } }, null, 1) + '\n')
console.log(JSON.stringify({ house: arg('house'), swapped: swapped.length, rawReadings: raw.readings.length, cleanReadings: clean.readings.length, sameModel: raw.modelSha256 === clean.modelSha256 }))
