/**
 * N8-03B (research only, offline): the solver's steps, unresolved gaps and opening traces of one sealed run, filtered
 * by a substring, so a glazing's chain (callout, elevation registration, family, fill) can be read in one place.
 *   npx vite-node research/analyzer-n8-03b/steps.ts -- --run <dir> --cache <dir> [--grep <text>]
 */
import { existsSync, readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join, resolve } from 'node:path'
import { SourcePackageSchema, archonAdapter, decodeImage, fileByteCache, genericProjectPageAdapter, selectedVariant } from '@buildapp/source-package'
import { reconstructV2 } from '@buildapp/reconstruction'
import { identityOf } from '../../packages/analysis-service/src/identity.js'

const value = (name: string): string | undefined => (process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : undefined)
const run = resolve(value('run') as string)
const grep = (value('grep') ?? '').toLowerCase()
const pkg = SourcePackageSchema.parse(JSON.parse(readFileSync(join(run, 'source-package.json'), 'utf8')))
const load = (name: string): unknown => JSON.parse(existsSync(join(run, `${name}.json`)) ? readFileSync(join(run, `${name}.json`), 'utf8') : gunzipSync(readFileSync(join(run, `${name}.json.gz`))).toString('utf8'))
const cache = fileByteCache(value('cache') as string)
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
const traces: Array<Record<string, unknown>> = []
const r = reconstructV2({ featureTrace: (t: Record<string, unknown>) => traces.push(t), modelId: identity.modelId, label: identity.label, slug: identity.slug, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph: load('observation-graph') as never, metrics: load('metric-evidence') as never, raster: (frame: { variantByteHash: string }) => rasters.get(frame.variantByteHash), publishedAreas: pkg.publishedFacts, publishedRooms: pkg.publishedRooms } as never)
const hit = (s: string): boolean => grep === '' || s.toLowerCase().includes(grep)
const steps = r.steps.map((s) => `${s.what}: ${s.detail}`).filter(hit)
const gaps = r.unresolved.map((u) => `${u.status}: ${u.what}: ${u.reason}`).filter(hit)
const tr = traces.filter((t) => hit(JSON.stringify(t)))
console.log(JSON.stringify({ steps, unresolved: gaps, traces: tr }, null, 1))
