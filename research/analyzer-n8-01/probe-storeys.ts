/**
 * N8-02A (research only, offline): how each storey plan of a sealed run is scaled and placed onto the base plan — the
 * layout's storey records and alignments, the plan readings' own scales, and the v2 frames — through this checkout.
 *   npx vite-node research/analyzer-n8-01/probe-storeys.ts -- --run <dir> --cache <dir> [--debug]
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
  if (got) try { rasters.set(variant.byteHash, decodeImage(got.bytes)) } catch { rasters.set(variant.byteHash, undefined) }
}
const debug = process.argv.includes('--debug') ? (s: string) => console.error(`debug ${s}`) : undefined
const metrics = load('metric-evidence') as { coordinateRegistrations: Array<Record<string, unknown>> }
const identity = identityOf(pkg, [archonAdapter, genericProjectPageAdapter])
const r = reconstructV2({ modelId: identity.modelId, label: identity.label, slug: identity.slug, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph: load('observation-graph') as never, metrics: metrics as never, raster: (frame: { variantByteHash: string }) => rasters.get(frame.variantByteHash), publishedAreas: pkg.publishedFacts, publishedRooms: pkg.publishedRooms, ...(debug ? { debug } : {}) } as never)
const L = r.layout as unknown as Record<string, unknown>
console.log(JSON.stringify({
  metricPlanRegistrations: metrics.coordinateRegistrations.filter((c) => c.plane === 'PLAN_XZ').map((c) => ({ frameId: c.frameId, mppX: c.metresPerPixelX, mppY: c.metresPerPixelY, originPx: c.originPx, confidence: c.confidence, anchors: (c.anchors as Array<Record<string, unknown>>).map((a) => `${a.axis} ${a.kind} ${a.metricSpan}m/${a.pixelSpan}px res ${a.residualM} w ${a.weight} [${(a.evidenceIds as string[]).join(',')}]`), provenance: c.provenance })),
  storeys: L.storeys,
  v2Frames: r.registrations.plans.map((p) => ({ frameId: (p as unknown as { frameId: string }).frameId, storey: (p as unknown as { storeyIndex: number }).storeyIndex, mppX: p.mppX, mppY: p.mppY })),
  masses: r.building.masses,
  steps: r.steps.filter((s) => s.stage === 'registration' || /storey/.test(s.what)).map((s) => `${s.stage} | ${s.what} | ${s.detail}`),
  unresolved: r.unresolved.map((u) => `${u.what}: ${u.reason}`).filter((u) => /storey|attic|scale|registr|align/i.test(u)),
  conflicts: (L.conflicts as Array<Record<string, unknown>>).map((c) => `${c.kind}: ${c.what}`),
}, null, 1))
