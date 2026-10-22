/**
 * N7-COUNCIL B (research only, offline): for each body, its pixel edges on the base plan against every horizontal
 * (X-measuring) chain's ticks and read segments: is a SCALED span stated by a chain that the ladder did not use?
 */
import { existsSync, readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join, resolve } from 'node:path'
import { SourcePackageSchema, archonAdapter, decodeImage, fileByteCache, genericProjectPageAdapter, selectedVariant } from '@buildapp/source-package'
import { reconstructV2 } from '@buildapp/reconstruction'
import { identityOf } from '../../../packages/analysis-service/src/identity.js'

const value = (name: string): string => process.argv[process.argv.indexOf(`--${name}`) + 1]
const run = resolve(value('run'))
const pkg = SourcePackageSchema.parse(JSON.parse(readFileSync(value('package'), 'utf8')))
const load = (name: string): unknown => JSON.parse(existsSync(join(run, `${name}.json`)) ? readFileSync(join(run, `${name}.json`), 'utf8') : gunzipSync(readFileSync(join(run, `${name}.json.gz`))).toString('utf8'))
const graph = load('observation-graph') as never
const metrics = load('metric-evidence') as { evidence: Array<{ id: string; kind: string; frameId?: string; value: number; [k: string]: unknown }>; chains?: unknown[]; [k: string]: unknown }
const cache = fileByteCache(value('cache'))
const rasters = new Map<string, ReturnType<typeof decodeImage> | undefined>()
for (const asset of pkg.assets) {
  const variant = selectedVariant(asset)
  const got = await cache.get(variant.url)
  if (!got) continue
  try { rasters.set(variant.byteHash, decodeImage(got.bytes)) } catch { rasters.set(variant.byteHash, undefined) }
}
const identity = identityOf(pkg, [archonAdapter, genericProjectPageAdapter])
const r = reconstructV2({ modelId: identity.modelId, label: identity.label, slug: identity.slug, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph, metrics: metrics as never, raster: (frame: { variantByteHash: string }) => rasters.get(frame.variantByteHash), publishedAreas: pkg.publishedFacts, publishedRooms: pkg.publishedRooms })
const base = r.planDiagnostics.plans.find((p) => p.frameId === r.planDiagnostics.selectedPlanFrameId)!
const f = r.registrations.plans.find((p) => p.frameId === base.frameId)!
console.log('metric keys', Object.keys(metrics))
for (const m of r.building.masses) {
  const a = f.toPixel(m.x0, m.z0)
  const c = f.toPixel(m.x1, m.z1)
  console.log(`mass ${m.id} x ${m.x0}..${m.x1} -> px ${a.x.toFixed(1)}..${c.x.toFixed(1)} ; z ${m.z0}..${m.z1} -> py ${c.y.toFixed(1)}..${a.y.toFixed(1)}`)
}
for (const ch of base.chains) console.log(`chain ${ch.axis} baseline ${ch.baselinePx} read ${ch.read} ticks ${ch.ticksPx.map((t) => t.toFixed(0)).join(',')}`)
const dims = metrics.evidence.filter((e) => e.frameId === base.frameId && /DIMENSION|SEGMENT|CHAIN/.test(e.kind))
const kinds: Record<string, number> = {}
for (const e of metrics.evidence.filter((e) => e.frameId === base.frameId)) kinds[e.kind] = (kinds[e.kind] ?? 0) + 1
console.log('evidence kinds on base frame', kinds)
for (const e of dims.slice(0, 80)) console.log('ev', e.kind, e.value, JSON.stringify(Object.fromEntries(Object.entries(e).filter(([k]) => ['axis', 'fromPx', 'toPx', 'pixelSpan', 'span', 'association', 'origin', 'confidence', 'valueCm', 'segment'].includes(k)))).slice(0, 300))
