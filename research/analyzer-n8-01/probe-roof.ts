/**
 * N8-01 (research only, offline): one sealed run replayed through this checkout's solver, printing the solver steps,
 * the layout's roof supports and masses, the view audit and the main roof, so the roof decision can be traced to the
 * observations it stood on. Rasters come from the byte cache; nothing is written.
 *   npx vite-node research/analyzer-n8-01/probe-roof.ts -- --run <dir> --cache <dir> [--debug]
 */
import { existsSync, readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join, resolve } from 'node:path'
import { SourcePackageSchema, archonAdapter, decodeImage, fileByteCache, genericProjectPageAdapter, selectedVariant } from '@buildapp/source-package'
import { reconstructV2 } from '@buildapp/reconstruction'
import { identityOf } from '../../packages/analysis-service/src/identity.js'

const value = (name: string): string => process.argv[process.argv.indexOf(`--${name}`) + 1]
const run = resolve(value('run'))
const pkg = SourcePackageSchema.parse(JSON.parse(readFileSync(join(run, 'source-package.json'), 'utf8')))
const load = (name: string): unknown => JSON.parse(existsSync(join(run, `${name}.json`)) ? readFileSync(join(run, `${name}.json`), 'utf8') : gunzipSync(readFileSync(join(run, `${name}.json.gz`))).toString('utf8'))
const cache = fileByteCache(value('cache'))
const rasters = new Map<string, ReturnType<typeof decodeImage> | undefined>()
for (const asset of pkg.assets) {
  const variant = selectedVariant(asset)
  const got = await cache.get(variant.url)
  if (!got) continue
  try { rasters.set(variant.byteHash, decodeImage(got.bytes)) } catch { rasters.set(variant.byteHash, undefined) }
}
const debug = process.argv.includes('--debug') ? (s: string) => console.error(`debug ${s}`) : undefined
const identity = identityOf(pkg, [archonAdapter, genericProjectPageAdapter])
const r = reconstructV2({ modelId: identity.modelId, label: identity.label, slug: identity.slug, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph: load('observation-graph') as never, metrics: load('metric-evidence') as never, raster: (frame: { variantByteHash: string }) => rasters.get(frame.variantByteHash), publishedAreas: pkg.publishedFacts, publishedRooms: pkg.publishedRooms, ...(debug ? { debug } : {}) } as never)
console.log(JSON.stringify({
  steps: r.steps.filter((s) => ['roof', 'registration', 'layout', 'storey', 'topology'].includes(s.stage) || /roof|ridge|storey|gable/i.test(s.what)).map((s) => `${s.stage} | ${s.what} | ${s.detail}`),
  roofSupports: r.layout.roofSupports,
  layoutMasses: r.layout.masses.map((m) => ({ id: m.id, role: m.role, w: m.widthM.value, d: m.depthM.value, storeys: m.storeySpan })),
  mainRoof: r.building.mainRoof,
  attachedRoofs: (r.building as { attachedRoofs?: unknown }).attachedRoofs,
  masses: r.building.masses,
  viewAudit: r.viewAudit,
  unresolved: r.unresolved.map((u) => `${u.what}: ${u.reason}`),
  footprintRegions: r.layout.footprintRegions.map((f) => ({ id: f.id, kind: f.kind, storey: f.storeyId, ring: f.ring.points })),
  layoutMassRegions: r.layout.masses.map((m) => ({ id: m.id, regions: m.footprintRegionIds })),
}, null, 1))
