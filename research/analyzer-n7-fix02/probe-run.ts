/**
 * N7-COUNCIL-FIX-02 (research only, offline): the exterior wall readings of one sealed run — the house's faces and
 * every body's — printed as JSON. Rasters come from the byte cache; nothing is written.
 *   npx vite-node research/analyzer-n7-fix02/probe-run.ts -- --run <dir> --cache <dir>
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
const identity = identityOf(pkg, [archonAdapter, genericProjectPageAdapter])
const r = reconstructV2({ modelId: identity.modelId, label: identity.label, slug: identity.slug, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph: load('observation-graph') as never, metrics: load('metric-evidence') as never, raster: (frame: { variantByteHash: string }) => rasters.get(frame.variantByteHash), publishedAreas: pkg.publishedFacts, publishedRooms: pkg.publishedRooms })
const base = r.planDiagnostics.plans.find((p) => p.frameId === r.planDiagnostics.selectedPlanFrameId)
console.log(JSON.stringify({ T: r.building.wallThicknessM, drawnBandM: base?.wallThickness?.m, wallThickness: r.wallThickness, masses: r.building.masses.map((m) => ({ id: m.id, w: +(m.x1 - m.x0).toFixed(3), d: +(m.z1 - m.z0).toFixed(3), t: m.wallThicknessM })), thin: r.thinBodies.map((t) => `${t.massId}:${t.decision.kind}`), preEmit: r.preEmitRings.map((c) => `${c.massId}/${c.storeyIndex} ${c.kind} ${c.verdict} ${c.widthM}`) }, null, 1))
