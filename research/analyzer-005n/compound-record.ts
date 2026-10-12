/**
 * compound-record.ts — BUILDPLAN-ANALYZER-005N development record of the compound reading (RESEARCH ONLY).
 *
 *   npx vite-node research/analyzer-005n/compound-record.ts -- --rows <rows.json> --out <json outside the repository>
 *
 * For every development row, on its sealed evidence: the production structural pass (`composeStructuralLayout`) and
 * its plan digest (`planDiagnosticsOf`), and from it every plan's compound facade spans — the plan digest's own
 * record, which a run that fails later (at emission) does not carry into its failure record or Evidence Pack. Numbers
 * and ids only.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { decodeImage, fileByteCache } from '@buildapp/source-package'
import type { SourcePackage } from '@buildapp/source-package'
import type { SourceObservationGraph } from '@buildapp/source-observations'
import type { MetricEvidenceSet } from '@buildapp/source-metrics'
import type { Raster } from '@buildapp/source-cv'
import { composeStructuralLayout, levelsFrom, planDiagnosticsOf } from '@buildapp/reconstruction'

const arg = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}
type Row = { row: string; set: string; cache: string; inputs: { package: string; graph: string; metrics: string }; dropFrames?: string[] }
const rows = (JSON.parse(readFileSync(resolve(arg('rows', '')), 'utf8')) as { rows: Row[] }).rows
const out: unknown[] = []
for (const row of rows) {
  const pkg = JSON.parse(readFileSync(row.inputs.package, 'utf8')) as SourcePackage
  const graph = JSON.parse(readFileSync(row.inputs.graph, 'utf8')) as SourceObservationGraph
  const metrics = JSON.parse(readFileSync(row.inputs.metrics, 'utf8')) as MetricEvidenceSet
  const dropped = new Set(row.dropFrames ?? [])
  const cache = fileByteCache(row.cache)
  const rasters = new Map<string, Raster | undefined>()
  for (const a of pkg.assets) for (const v of a.variants) {
    if (rasters.has(v.byteHash)) continue
    const got = await cache.get(v.url)
    try { rasters.set(v.byteHash, got ? decodeImage(got.bytes) : undefined) } catch { rasters.set(v.byteHash, undefined) }
  }
  const section = graph.coordinateFrames.find((f) => f.roles.projection === 'ORTHOGRAPHIC_SECTION')
  const pass = composeStructuralLayout({ slug: row.row, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph, metrics, raster: (f: { variantByteHash: string }) => rasters.get(f.variantByteHash), ...(dropped.size > 0 ? { frameFilter: (f: { id: string }) => !dropped.has(f.id) } : {}), levels: levelsFrom(metrics, section?.id), publishedAreas: pkg.publishedFacts, sheetCache: new Map() } as never)
  const digest = planDiagnosticsOf(pass.draft, graph, metrics, pass.layout)
  const plans = digest.plans
    .filter((p) => (p.compoundFacades ?? []).length > 0)
    .map((p) => ({ frameId: p.frameId, storey: p.storey, selected: p.frameId === digest.selectedPlanFrameId, boundaryAccepted: p.boundary?.accepted ?? null, spans: p.compoundFacades }))
  out.push({ row: row.row, set: row.set, selectedPlanFrameId: digest.selectedPlanFrameId, plans })
  process.stdout.write(`${row.row} ${plans.reduce((a, p) => a + (p.spans ?? []).filter((s) => s.intervals.length > 0).length, 0)} cut / ${plans.reduce((a, p) => a + (p.spans ?? []).filter((s) => s.intervals.length === 0).length, 0)} whole\n`)
}
writeFileSync(resolve(arg('out', '')), `${JSON.stringify({ stage: 'BUILDPLAN-ANALYZER-005N', rows: out }, null, 1)}\n`)
