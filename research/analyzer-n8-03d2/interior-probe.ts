/**
 * N8-03D2 (research only, offline): the interior reading (partitions, door gaps, blocks, rooms) of every storey of one
 * sealed run as the production solver makes it, with the partition bands it looked at (its debug hook), the frames
 * (pixel ↔ world) of each storey and every room polygon. Prints JSON; nothing is written.
 *   npx vite-node research/analyzer-n8-03d2/interior-probe.ts -- --run <dir> --cache <dir>
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
const debug: string[] = []
const r = reconstructV2({ debug: (m: string) => { if (m.startsWith('interior ')) debug.push(m) }, modelId: identity.modelId, label: identity.label, slug: identity.slug, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph: load('observation-graph') as never, metrics: load('metric-evidence') as never, raster: (frame: { variantByteHash: string }) => rasters.get(frame.variantByteHash), publishedAreas: pkg.publishedFacts, publishedRooms: pkg.publishedRooms } as never)
const b = r.building as unknown as { interior: Array<{ storeyIndex: number; frameId: string; walls: unknown[]; doors: unknown[]; blocks: unknown[]; rooms: unknown[]; unresolved: unknown[] }>; masses: unknown[]; slabVoids?: unknown[]; stair?: { slabHole: unknown } }
console.log(JSON.stringify({ publishedRooms: pkg.publishedRooms, masses: b.masses, slabVoids: b.slabVoids ?? [], stairHole: b.stair?.slabHole, interior: b.interior, debug, steps: r.steps.filter((s) => s.stage === 'interior').map((s) => `${s.what}: ${s.detail}`) }, null, 1))
