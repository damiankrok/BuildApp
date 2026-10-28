/**
 * N8-03D1 (research only, offline): the slab voids `readSlabVoids` reads on each upper storey of one sealed run,
 * through the storey frames the production solver registers (taken from its plan diagnostics hook), with every tinted
 * region it looked at and refused. Prints JSON; nothing is written.
 *   npx vite-node research/analyzer-n8-03d1/void-probe.ts -- --run <dir> --cache <dir>
 */
import { existsSync, readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join, resolve } from 'node:path'
import { SourcePackageSchema, archonAdapter, decodeImage, fileByteCache, genericProjectPageAdapter, selectedVariant } from '@buildapp/source-package'
import { reconstructV2 } from '@buildapp/reconstruction'
import { identityOf } from '../../packages/analysis-service/src/identity.js'

const value = (name: string): string | undefined => (process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : undefined)
const run = resolve(value('run') as string)
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
const r = reconstructV2({ featureTrace: (t: Record<string, unknown>) => { if (String(t.kind).startsWith('SLAB_VOID')) traces.push(t) }, modelId: identity.modelId, label: identity.label, slug: identity.slug, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph: load('observation-graph') as never, metrics: load('metric-evidence') as never, raster: (frame: { variantByteHash: string }) => rasters.get(frame.variantByteHash), publishedAreas: pkg.publishedFacts, publishedRooms: pkg.publishedRooms } as never)
const b = r.building as unknown as { slabVoids?: unknown; stair?: { slabHole: unknown } }
console.log(JSON.stringify({ voids: b.slabVoids ?? [], stairHole: b.stair?.slabHole, traces, steps: r.steps.filter((s) => /void/i.test(s.what)).map((s) => `${s.what}: ${s.detail}`), unresolved: r.unresolved.filter((u) => /void/i.test(u.what)).map((u) => `${u.status}: ${u.what}: ${u.reason}`) }, null, 1))
