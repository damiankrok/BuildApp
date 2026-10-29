/**
 * N9-00 (research only, offline, read-only): source coverage of one sealed run: the views by role and how each was used, the metric evidence by kind and association, the model's objects by evidence status, the verdicts. Adapted from the N8-03D2 interior reading probe (partitions, door gaps, blocks, rooms) of every storey of one
 * sealed run as the production solver makes it, with the partition bands it looked at (its debug hook), the frames
 * (pixel ↔ world) of each storey and every room polygon. Prints JSON; nothing is written.
 *   npx vite-node research/analyzer-n9-00/coverage-probe.ts -- --run <dir> --cache <dir>
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
const r = reconstructV2({ modelId: identity.modelId, label: identity.label, slug: identity.slug, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph: load('observation-graph') as never, metrics: load('metric-evidence') as never, raster: (frame: { variantByteHash: string }) => rasters.get(frame.variantByteHash), publishedAreas: pkg.publishedFacts, publishedRooms: pkg.publishedRooms } as never) as unknown as Record<string, unknown>
const count = (xs: readonly unknown[], key: (x: never) => string): Record<string, number> => xs.reduce<Record<string, number>>((a, x) => ((a[key(x as never)] = (a[key(x as never)] ?? 0) + 1), a), {})
const graph = load('observation-graph') as { coordinateFrames: Array<{ id: string; assetId: string; roles: { document: string; projection: string; view: string } }> }
const metrics = load('metric-evidence') as { evidence: Array<{ kind: string; association?: { kind: string }; confidence?: number }>; unresolved?: unknown[]; conflicts?: unknown[]; ocrTokens?: Array<{ pageVote?: string }> }
const model = r.model as Record<string, unknown>
const objects = Object.entries(model).filter(([, v]) => Array.isArray(v) && (v as unknown[]).length > 0 && typeof (v as unknown[])[0] === 'object' && (v as Array<Record<string, unknown>>)[0] !== null && 'id' in (v as Array<Record<string, unknown>>)[0]) as Array<[string, Array<{ id: string; evidence?: { status?: string } }>]>
const unresolved = (r.unresolved ?? []) as Array<{ status?: string; what?: string }>
const steps = (r.steps ?? []) as Array<{ method?: string; stage?: string; what?: string }>
console.log(JSON.stringify({
  assets: count(pkg.assets, (a: { kind?: string; role?: string }) => String(a.role ?? a.kind)),
  frames: count(graph.coordinateFrames, (f: { roles: { document: string; projection: string } }) => `${f.roles.document}/${f.roles.projection}`),
  viewAudit: (r.viewAudit as Array<{ frameId: string; document: string; projection: string; labelledView: string; use: string; side?: string; openingHeights?: string; why: string }>).map((v) => ({ frameId: v.frameId, document: v.document, projection: v.projection, labelled: v.labelledView, use: v.use, side: v.side, openingHeights: v.openingHeights, why: v.why.slice(0, 220) })),
  plansRead: ((r.registrations as { plans: unknown[] }).plans ?? []).length,
  sectionRegistered: !!(r.registrations as { section?: unknown }).section,
  metricEvidence: { total: metrics.evidence.length, byKind: count(metrics.evidence, (e: { kind: string }) => e.kind), byAssociation: count(metrics.evidence, (e: { kind: string; association?: { kind: string } }) => `${e.kind}:${e.association?.kind ?? 'NONE'}`), unresolved: (metrics.unresolved ?? []).length, conflicts: (metrics.conflicts ?? []).length, ocrTokens: count(metrics.ocrTokens ?? [], (t: { pageVote?: string }) => String(t.pageVote)) },
  openingCounts: r.openingCounts,
  modelObjects: Object.fromEntries(objects.map(([k, v]) => [k, { n: v.length, byStatus: count(v, (o: { evidence?: { status?: string } }) => o.evidence?.status ?? 'NO_EVIDENCE') }])),
  unresolvedByStatus: count(unresolved, (u: { status?: string }) => String(u.status)),
  refusedSteps: steps.filter((s) => s.method === 'REFUSED').length,
  modelCompleteness: r.modelCompleteness,
  bodyCompleteness: r.bodyCompleteness,
  quality: r.quality,
  crossViewResiduals: r.crossViewResiduals,
  facadeAlignment: r.facadeAlignment,
}, null, 1))
