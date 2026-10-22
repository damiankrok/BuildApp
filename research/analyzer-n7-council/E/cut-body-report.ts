/**
 * Council E: when the partial preview (N7-P1) cuts a body, do the elevation reports (facadeAlignment, crossView
 * residuals) still describe it? Production solver on sealed corpus evidence, with the research-only `narrowMass`
 * misreading (as research/analyzer-005y-n7-p2r/corpus-demo.ts) and thin-body adjudication off, so a body is cut.
 * Prints nothing of the publisher's pixels; writes nothing.
 *   npx vite-node research/analyzer-n7-council/E/cut-body-report.ts -- --run <dir> --package <pkg> --cache <cache> --mass attached-0 --side WEST --keep 0.45 [--adjudicate]
 */
import { existsSync, readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join, resolve } from 'node:path'
import { SourcePackageSchema, archonAdapter, decodeImage, fileByteCache, genericProjectPageAdapter, selectedVariant } from '@buildapp/source-package'
import { reconstructV2 } from '@buildapp/reconstruction'
import { identityOf } from '../../../packages/analysis-service/src/identity.js'

const arg = (n: string, d?: string): string => { const i = process.argv.indexOf(`--${n}`); return i < 0 ? (d as string) : process.argv[i + 1] }
const run = resolve(arg('run'))
const pkg = SourcePackageSchema.parse(JSON.parse(readFileSync(arg('package'), 'utf8')))
const load = (name: string): unknown => JSON.parse(existsSync(join(run, `${name}.json`)) ? readFileSync(join(run, `${name}.json`), 'utf8') : gunzipSync(readFileSync(join(run, `${name}.json.gz`))).toString('utf8'))
const cache = fileByteCache(arg('cache'))
const rasters = new Map<string, ReturnType<typeof decodeImage>>()
for (const a of pkg.assets) { const v = selectedVariant(a); const got = await cache.get(v.url); if (got) try { rasters.set(v.byteHash, decodeImage(got.bytes)) } catch { /* left out, as the replay does */ } }
const id = identityOf(pkg, [archonAdapter, genericProjectPageAdapter])
const r = reconstructV2({ modelId: id.modelId, label: id.label, slug: id.slug, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph: load('observation-graph') as never, metrics: load('metric-evidence') as never, raster: (f: { variantByteHash: string }) => rasters.get(f.variantByteHash), publishedAreas: pkg.publishedFacts, publishedRooms: pkg.publishedRooms, diagnostics: process.argv.includes("--asread") ? {} : { narrowMass: { id: arg('mass', 'attached-0'), side: arg('side', 'WEST') as 'WEST', keepM: Number(arg('keep', '0.45')) }, skipThinBodies: !process.argv.includes('--adjudicate') } } as never)
const modelOpenings = new Set(r.model.openings.map((o: { id: string }) => o.id))
const modelWalls = new Set(r.model.walls.map((w: { id: string }) => w.id))
console.log('outcome', r.partialPreview ? 'PARTIAL' : 'COMPLETE', 'failure', JSON.stringify(r.partialPreview?.failures?.[0] ?? null).slice(0, 200))
console.log('skipped', (r.partialPreview?.skipped ?? []).map((s: { type: string; id: string }) => `${s.type}:${s.id}`).join(' '))
console.log('thinBodies', JSON.stringify(r.thinBodies.map((t) => ({ m: t.massId, d: t.decision.kind, el: t.elevations.map((e) => [e.side, e.builtShare, e.verdict]) }))))
console.log('openingCounts', JSON.stringify(r.openingCounts), 'model openings', modelOpenings.size)
const fa = r.facadeAlignment
const onCut = fa.comparisons.filter((c) => c.openingId && ![...modelOpenings].some((m) => m === c.openingId || m.startsWith(c.openingId) || c.openingId!.startsWith(m)))
console.log('facadeAlignment statusCounts', JSON.stringify(fa.statusCounts))
console.log(`comparisons naming an opening the final model does not hold: ${onCut.length}`, JSON.stringify(onCut.map((c) => [c.openingId, c.status, c.codes])))
console.log('model opening ids sample', [...modelOpenings].slice(0, 6).join(' '), '| comparison ids sample', fa.comparisons.filter((c) => c.openingId).slice(0, 6).map((c) => c.openingId).join(' '))
const cv = r.crossViewResiduals
console.log('crossView', JSON.stringify(cv.views.map((v: { side: string; verdict: string; withinTolerance: number; checks: number }) => [v.side, v.verdict, `${v.withinTolerance}/${v.checks}`])))
const resid = r.residuals as Array<{ featureId?: string; objectId?: string; kind?: string; withinTolerance: boolean }>
const masses = r.building.masses.map((m) => m.id)
console.log('building masses (what the reports describe)', masses.join(' '), '| model wallRings', r.model.wallRings.map((w: { id: string }) => w.id).join(' '), '| walls', modelWalls.size)
console.log('residual sample keys', resid[0] ? Object.keys(resid[0]).join(',') : 'none')
const byMass = resid.filter((x) => JSON.stringify(x).includes(arg('mass', 'attached-0')))
console.log(`residuals that name ${arg('mass', 'attached-0')}: ${byMass.length} (within tolerance ${byMass.filter((x) => x.withinTolerance).length})`)
for (const x of resid as Array<Record<string, unknown>>) console.log('  resid', x.frameId?.toString().slice(-10), x.kind, x.objectId, x.featureId, x.modelM, x.observedM, x.withinTolerance)
console.log('reconciliation', JSON.stringify(r.crossViewResiduals.reconciliation), 'applied', JSON.stringify(r.repair.iterations.flatMap((i: { applied: Array<{ featureId: string; why: string }> }) => i.applied.map((a) => `${a.featureId}: ${a.why.slice(0, 140)}`))))
for (const b of r.building.balconies as Array<Record<string, unknown>>) console.log('balcony', b.id, b.topY, b.thicknessM, String(b.why ?? '').slice(0, 220))
