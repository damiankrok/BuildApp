/**
 * walls-explained.ts — BUILDPLAN-ANALYZER-005L (RESEARCH ONLY): for each development row's plans of other storeys, how
 * much of the plan's long wall lies on or inside the walled bodies its decomposition found. Numbers only.
 *
 *   npx vite-node research/analyzer-005l/walls-explained.ts -- [--only a,b]
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { decodeImage, fileByteCache } from '@buildapp/source-package'
import type { SourcePackage } from '@buildapp/source-package'
import type { SourceObservationGraph } from '@buildapp/source-observations'
import type { MetricEvidenceSet } from '@buildapp/source-metrics'
import type { Raster } from '@buildapp/source-cv'
import { chooseBasePlan, planBodies, readPlans } from '@buildapp/reconstruction'

const REPO = resolve(import.meta.dirname, '../..')
const arg = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}
type Row = { row: string; cache: string; inputs: { package: string; graph: string; metrics: string }; dropFrames?: string[] }
const rows = (JSON.parse(readFileSync(join(REPO, 'research/analyzer-005l/rows.json'), 'utf8')) as { rows: Row[] }).rows
const only = arg('only', '')
for (const row of rows) {
  if (only && !only.split(',').includes(row.row)) continue
  const pkg = JSON.parse(readFileSync(row.inputs.package, 'utf8')) as SourcePackage
  const graph = JSON.parse(readFileSync(row.inputs.graph, 'utf8')) as SourceObservationGraph
  const metrics = JSON.parse(readFileSync(row.inputs.metrics, 'utf8')) as MetricEvidenceSet
  const cache = fileByteCache(row.cache)
  const rasters = new Map<string, Raster | undefined>()
  for (const a of pkg.assets) for (const v of a.variants) {
    if (rasters.has(v.byteHash)) continue
    const got = await cache.get(v.url)
    try {
      rasters.set(v.byteHash, got ? decodeImage(got.bytes) : undefined)
    } catch {
      rasters.set(v.byteHash, undefined)
    }
  }
  const { plans } = readPlans({ slug: row.row, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph, metrics, raster: (f) => rasters.get(f.variantByteHash), sheetCache: new Map() })
  if (plans.length < 2) continue
  const base = chooseBasePlan(plans)
  for (const p of plans) {
    if (p === base) continue
    const bodies = planBodies(p.decomposition).map((r) => r.rect)
    const long = (axis: 'VERTICAL' | 'HORIZONTAL') => {
      const bs = p.bands.filter((b) => b.axis === axis && b.length >= p.wallPx * 2.5)
      const longest = Math.max(0, ...bs.map((b) => b.length))
      return bs.filter((b) => b.length >= 0.25 * longest)
    }
    const major = [...long('VERTICAL'), ...long('HORIZONTAL')]
    const total = major.reduce((a, b) => a + b.length, 0)
    const pad = p.wallPx
    const inside = major.reduce((a, b) => {
      const r = b.bounds
      const ok = bodies.some((q) => r.x0 >= q.x0 - pad && r.x1 <= q.x1 + pad && r.y0 >= q.y0 - pad && r.y1 <= q.y1 + pad)
      return a + (ok ? b.length : 0)
    }, 0)
    const bodyArea = bodies.reduce((a, q) => a + (q.x1 - q.x0) * (q.y1 - q.y0), 0)
    const env = p.decomposition.envelope?.rect
    console.log(`${row.row.padEnd(20)} ${p.storey.padEnd(8)} majorWalls=${major.length} explained=${(inside / Math.max(1, total)).toFixed(2)} bodies=${bodies.length} bodyAreaShareOfEnvelope=${env ? (bodyArea / ((env.x1 - env.x0) * (env.y1 - env.y0))).toFixed(2) : '-'}`)
  }
}
