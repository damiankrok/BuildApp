/**
 * N7-COUNCIL-FIX-03 (research only, offline): one sealed run replayed through the solver of this checkout — its bodies,
 * the decomposition's built regions, the FIX-03 corrections (seam splits, gate bays) and the completeness record —
 * printed as JSON. Rasters come from the byte cache; nothing is written.
 *   npx vite-node research/analyzer-n7-fix03/probe-house.ts -- --run <dir> --cache <dir>
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
  try { rasters.set(variant.byteHash, decodeImage(got.bytes)) } catch (e) { console.error(`undecodable ${variant.url}: ${(e as Error).message}`); rasters.set(variant.byteHash, undefined) }
}
const identity = identityOf(pkg, [archonAdapter, genericProjectPageAdapter])
const r = reconstructV2({ modelId: identity.modelId, label: identity.label, slug: identity.slug, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph: load('observation-graph') as never, metrics: load('metric-evidence') as never, raster: (frame: { variantByteHash: string }) => rasters.get(frame.variantByteHash), publishedAreas: pkg.publishedFacts, publishedRooms: pkg.publishedRooms })
const f = (n: number): number => +n.toFixed(2)
console.log(JSON.stringify({
  masses: r.building.masses.map((m) => `${m.id} x ${f(m.x0)}..${f(m.x1)} z ${f(m.z0)}..${f(m.z1)} s${m.storeys.join(',')}${m.storeyRects ? ` sr ${m.storeyRects.map((q) => `${q.storey}:${f(q.x0)}..${f(q.x1)}x${f(q.z0)}..${f(q.z1)}`).join(' ')}` : ''}`),
  layout: r.layout.masses.map((m) => `${m.id}/${m.role} ${f(m.widthM.value)}x${f(m.depthM.value)} s${m.storeySpan.fromIndex}..${m.storeySpan.toIndex}`),
  gate: `${r.layout.gate.status} ${r.layout.gate.reasons.filter((x) => x.severity !== 'NOTED').map((x) => `${x.severity}:${x.code}`).join(',')}`,
  mainRoof: r.building.mainRoof?.footprint,
  regions: (() => { const b = r.planDiagnostics.plans.find((p) => p.frameId === r.planDiagnostics.selectedPlanFrameId); return b?.regions.map((g) => `${g.id} ${JSON.stringify(g.rect)}`) })(),
  recesses: r.layout.recesses.map((x) => `${x.id} ${x.why.slice(0, 160)}`),
  recovery: (r as { bodyRecovery?: unknown }).bodyRecovery,
  frame: r.planDiagnostics.selectedPlanFrameId,
  modelCompleteness: (r as { modelCompleteness?: unknown }).modelCompleteness,
  unexplainedWalls: (r as { bodyCompleteness?: { unexplainedWalls: unknown } }).bodyCompleteness?.unexplainedWalls,
  completeness: (r as { bodyCompleteness?: never }).bodyCompleteness && { drawn: r.bodyCompleteness.drawnBuiltM2, represented: r.bodyCompleteness.representedM2, coverage: r.bodyCompleteness.coverage, areas: r.bodyCompleteness.areas.map((a) => `${a.id} ${a.decision} ${f(a.areaM2)}m2 [${a.massIds.join(',')}] ${a.decision === 'REPRESENTED' || a.decision === 'JOINED' ? '' : a.why.slice(0, 300)}`) },
  partial: r.partialPreview && { failures: r.partialPreview.failures.map((x) => `${x.type} ${x.id} ${x.codes.join(',')}`) },
}, null, 1))
