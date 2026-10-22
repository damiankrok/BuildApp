/**
 * N7-COUNCIL B (research only, offline): dump per sealed corpus house the global wall thickness T and where it came
 * from, per-axis scales, each storey plan's registration, mass span bases (MEASURED/DERIVED/SCALED), body rects, the
 * narrowest body width vs 2T, levels and elevation registrations. Writes nothing; prints JSON to stdout.
 *   npx vite-node research/analyzer-n7-council/B/metric-probe.ts -- --run <dir> --package <pkg> --cache <cache>
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
const metrics = load('metric-evidence') as never
const cache = fileByteCache(value('cache'))
const rasters = new Map<string, ReturnType<typeof decodeImage> | undefined>()
for (const asset of pkg.assets) {
  const variant = selectedVariant(asset)
  const got = await cache.get(variant.url)
  if (!got) continue
  try { rasters.set(variant.byteHash, decodeImage(got.bytes)) } catch { rasters.set(variant.byteHash, undefined) }
}
const identity = identityOf(pkg, [archonAdapter, genericProjectPageAdapter])
const r = reconstructV2({ modelId: identity.modelId, label: identity.label, slug: identity.slug, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph, metrics, raster: (frame: { variantByteHash: string }) => rasters.get(frame.variantByteHash), publishedAreas: pkg.publishedFacts, publishedRooms: pkg.publishedRooms })
const b = r.building
const T = b.wallThicknessM
const base = r.planDiagnostics.plans.find((p) => p.frameId === r.planDiagnostics.selectedPlanFrameId)
const bandT = (base?.bands ?? []).map((x) => x.thickness)
const hist: Record<string, number> = {}
for (const t of bandT) hist[t] = (hist[t] ?? 0) + 1
const out = {
  T,
  basePlan: base ? { wallPx: base.wallPx, scale: base.scale, metric: base.metric, impliedTpx: base.scale ? T / Math.max(base.scale.mppX, base.scale.mppY) : null, bandThicknessHistogram: hist } : null,
  plans: r.registrations.plans.map((p) => ({ storey: p.storeyIndex, mppX: p.mppX, mppY: p.mppY, aniso: +(Math.max(p.mppX, p.mppY) / Math.min(p.mppX, p.mppY) - 1).toFixed(4), origin: p.originPx, why: p.why.slice(0, 220) })),
  storeys: r.planDiagnostics.storeys?.map((s) => ({ storey: s.storeyIndex, decision: s.decision, chosen: s.chosen, scaleBasis: s.scaleBasis, printed: s.printedScale })),
  layoutMasses: r.layout.masses.map((m) => ({ role: m.role, width: [m.widthM.value, m.widthM.basis], depth: [m.depthM.value, m.depthM.basis] })),
  masses: b.masses.map((m) => ({ id: m.id, role: m.role, rect: [m.x0, m.z0, m.x1, m.z1], w: +(m.x1 - m.x0).toFixed(3), d: +(m.z1 - m.z0).toFixed(3), storeys: m.storeys, storeyRects: m.storeyRects ?? null, pieceOf: m.pieceOf ?? null, ownT: m.wallThicknessM ?? null, narrowerThan2T: Math.min(m.x1 - m.x0, m.z1 - m.z0) < 2 * (m.wallThicknessM ?? T) })),
  levels: b.levels.map((l) => ({ i: l.index, el: l.elevation, h: l.height, top: l.wallTop })),
  heights: r.heights,
  slabT: b.slabThicknessM,
  roof: b.mainRoof ? { pitch: b.mainRoof.pitchDeg, eaveY: b.mainRoof.eaveY, ridgeY: b.mainRoof.ridgeY, prov: b.mainRoof.provenance, auth: b.mainRoof.authority } : null,
  roofDatum: r.roofDatum ?? null,
  section: r.registrations.section ?? null,
  elevations: r.registrations.elevations.map((e) => ({ side: e.side, mpp: e.mpp, spanM: e.spanM, bottomY: e.bottomY, aniso: e.anisotropyCheck, conf: e.confidence, spanWhy: e.spanWhy.slice(0, 160) })),
  regSteps: r.steps.filter((s) => s.stage === 'registration').map((s) => s.detail.slice(0, 200)),
}
console.log(JSON.stringify(out, null, 1))
