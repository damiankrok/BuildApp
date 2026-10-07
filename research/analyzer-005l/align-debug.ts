/**
 * align-debug.ts — BUILDPLAN-ANALYZER-005L (RESEARCH ONLY): every alignment candidate of one row's upper plans, for a
 * developer comparing two placements. Numbers only.
 *
 *   npx vite-node research/analyzer-005l/align-debug.ts -- --row A03 [--near 1.0]
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { decodeImage, fileByteCache } from '@buildapp/source-package'
import type { SourcePackage } from '@buildapp/source-package'
import type { SourceObservationGraph } from '@buildapp/source-observations'
import type { MetricEvidenceSet } from '@buildapp/source-metrics'
import type { Raster } from '@buildapp/source-cv'
import { alignPlans, chooseBasePlan, outerWallAxes, readPlans } from '@buildapp/reconstruction'

const REPO = resolve(import.meta.dirname, '../..')
const arg = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}
type Row = { row: string; cache: string; inputs: { package: string; graph: string; metrics: string }; dropFrames?: string[] }
const row = (JSON.parse(readFileSync(join(REPO, 'research/analyzer-005l/rows.json'), 'utf8')) as { rows: Row[] }).rows.find((r) => r.row === arg('row', 'A03'))
if (!row) throw new Error('no row')
const p = (x: string): string => (x.startsWith('/') ? x : join(REPO, x))
const pkg = JSON.parse(readFileSync(p(row.inputs.package), 'utf8')) as SourcePackage
const graph = JSON.parse(readFileSync(p(row.inputs.graph), 'utf8')) as SourceObservationGraph
const metrics = JSON.parse(readFileSync(p(row.inputs.metrics), 'utf8')) as MetricEvidenceSet
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
const base = chooseBasePlan(plans)!
const near = Number(arg('near', '1'))
for (const other of plans.filter((x) => x !== base)) {
  const { considered } = alignPlans(base, other)
  const long = (pl: typeof base, axis: 'VERTICAL' | 'HORIZONTAL') => pl.bands.filter((b) => b.axis === axis && b.length >= pl.wallPx * 2.5)

  console.log(other.storey, 'other outer x', outerWallAxes(long(other, 'VERTICAL'), other.wallPx), 'y', outerWallAxes(long(other, 'HORIZONTAL'), other.wallPx))
  for (const c of considered.slice(0, 6)) console.log('top', c.scale, c.offsetX, c.offsetY, c.agreement, c.score, c.why)
  for (const c of considered.filter((c) => Math.abs(c.scale - near) < 0.06).slice(0, 6)) console.log('near', c.scale, c.offsetX, c.offsetY, c.agreement, c.score, c.why)
}
