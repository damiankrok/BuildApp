/**
 * SOURCE-01 (research): reconstructV2 replayed on a sealed run (source package, observation graph, metric evidence)
 * and the byte cache; prints the model hash, every thin-body chain reading with its origin, and the perspective
 * cameras with the content verdict of their frames when one is present.
 *   npx vite-node research/analyzer-source-01/solver-probe.ts -- --run <dir> --cache <dir> [--json <file>]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join, resolve } from 'node:path'
import { SourcePackageSchema, archonAdapter, decodeImage, fileByteCache, genericProjectPageAdapter, selectedVariant } from '@buildapp/source-package'
import { reconstructV2 } from '@buildapp/reconstruction'
import { identityOf } from '../../packages/analysis-service/src/identity.js'

const args = process.argv.slice(2)
const value = (name: string): string | undefined => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : undefined)
const run = resolve(value('run') as string)
const pkg = SourcePackageSchema.parse(JSON.parse(readFileSync(join(run, 'source-package.json'), 'utf8')))
const load = (name: string): unknown => JSON.parse(existsSync(join(run, `${name}.json`)) ? readFileSync(join(run, `${name}.json`), 'utf8') : gunzipSync(readFileSync(join(run, `${name}.json.gz`))).toString('utf8'))
const cache = fileByteCache(value('cache') as string)
const rasters = new Map<string, ReturnType<typeof decodeImage> | undefined>()
for (const asset of pkg.assets) {
  const variant = selectedVariant(asset)
  const got = await cache.get(variant.url)
  if (got) try { rasters.set(variant.byteHash, decodeImage(got.bytes)) } catch { rasters.set(variant.byteHash, undefined) }
}
const identity = identityOf(pkg, [archonAdapter, genericProjectPageAdapter])
const r = reconstructV2({ modelId: identity.modelId, label: identity.label, slug: identity.slug, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph: load('observation-graph') as never, metrics: load('metric-evidence') as never, raster: (frame: { variantByteHash: string }) => rasters.get(frame.variantByteHash), publishedAreas: pkg.publishedFacts, publishedRooms: pkg.publishedRooms } as never) as unknown as Record<string, any>
const out = {
  modelHash: r.candidate?.modelHash,
  thinBodies: (r.thinBodies ?? []).map((b: any) => ({ massId: b.massId, decision: b.decision, chains: b.chains, hypotheses: b.hypotheses })),
  cameras: r.registrations.cameras.map((c: any) => ({ frameId: c.frameId, solved: c.solved, residualPx: c.residualPx })),
}
console.log(`modelHash ${out.modelHash}`)
for (const b of out.thinBodies) {
  console.log(`thin ${b.massId}: ${JSON.stringify(b.decision).slice(0, 220)}`)
  for (const c of b.chains) console.log(`   ${c.role.padEnd(12)} ${String(c.origin ?? '?').padEnd(16)} ${c.valueCm} cm  ${c.why.slice(0, 120)}`)
}
console.log(`cameras solved ${out.cameras.filter((c: any) => c.solved).length}/${out.cameras.length}`)
if (value('json')) writeFileSync(value('json') as string, `${JSON.stringify(out, null, 1)}\n`)
