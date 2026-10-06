/**
 * perf.ts — BUILDPLAN-ANALYZER-005K rule cost (RESEARCH ONLY; never imported by production).
 *
 *   npx vite-node research/analyzer-005k/perf.ts -- --rows <a,b,...> --repeat 3 --mode OFF|ON --out <json>
 *
 * For each development row (dev-rows.json), in this process:
 *   - the solver on the row's sealed evidence (`reconstructV2`), `--repeat` times after one warm-up, median wall time;
 *   - every plan the layout reads, its boundary re-read once with the drawn-gap rule as asked, and the record builder
 *     (`gapEvidenceRecords`) timed alone over the reading's own walls and outline, 20 times, median;
 *   - the size of the records as the digest serialises them;
 *   - the process's peak RSS at the end.
 * Run once with the current sources and once with the pre-005K sources swapped in (see perf.sh): the difference is
 * what the trace, the records and the rule cost.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { stableJson } from '@buildapp/source-common'
import { decodeImage, fileByteCache } from '@buildapp/source-package'
import type { SourcePackage } from '@buildapp/source-package'
import type { SourceObservationGraph } from '@buildapp/source-observations'
import type { MetricEvidenceSet } from '@buildapp/source-metrics'
import type { Raster } from '@buildapp/source-cv'
import * as R from '@buildapp/reconstruction'

const REPO = resolve(import.meta.dirname, '../..')
const argv = process.argv
const arg = (name: string, fallback: string): string => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : fallback
}
type Row = { row: string; cache: string; inputs: { package: string; graph: string; metrics: string }; dropDimensionedGroundFrames?: string }
const rows = (JSON.parse(readFileSync(join(REPO, 'research/analyzer-005k/dev-rows.json'), 'utf8')) as { rows: Row[] }).rows
const only = arg('rows', '').split(',').filter(Boolean)
const repeat = Number(arg('repeat', '3'))
const mode = arg('mode', 'OFF') === 'ON' ? 'ON' : 'OFF'
const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
const p = (x: string): string => (x.startsWith('/') ? x : join(REPO, x))
// the record builder exists only in the 005K sources
const records = (R as unknown as { gapEvidenceRecords?: typeof R.gapEvidenceRecords }).gapEvidenceRecords

const out: unknown[] = []
for (const row of rows.filter((r) => only.length === 0 || only.includes(r.row))) {
  if (row.dropDimensionedGroundFrames) continue
  const pkg = JSON.parse(readFileSync(p(row.inputs.package), 'utf8')) as SourcePackage
  const graph = JSON.parse(readFileSync(p(row.inputs.graph), 'utf8')) as SourceObservationGraph
  const metrics = JSON.parse(readFileSync(p(row.inputs.metrics), 'utf8')) as MetricEvidenceSet
  const cache = fileByteCache(row.cache)
  const rasters = new Map<string, Raster | undefined>()
  for (const a of pkg.assets) {
    for (const v of a.variants) {
      if (rasters.has(v.byteHash)) continue
      const got = await cache.get(v.url)
      try {
        rasters.set(v.byteHash, got ? decodeImage(got.bytes) : undefined)
      } catch {
        rasters.set(v.byteHash, undefined)
      }
    }
  }
  const raster = (f: { variantByteHash: string }) => rasters.get(f.variantByteHash)
  const solve = (): string => {
    try {
      const r = R.reconstructV2({ label: row.row, slug: row.row, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph, metrics, raster, publishedAreas: pkg.publishedFacts, publishedRooms: pkg.publishedRooms, ...(mode === 'ON' ? ({ drawnGapRule: 'ON' } as object) : {}) })
      return r.candidate.modelHash
    } catch (e) {
      return `FAILED ${(e as { code?: string }).code ?? ''}`
    }
  }
  solve()
  const times: number[] = []
  let result = ''
  for (let i = 0; i < repeat; i += 1) {
    const t0 = performance.now()
    result = solve()
    times.push(performance.now() - t0)
  }
  // the record builder alone, on each plan the layout reads
  const builder: Array<{ frameId: string; records: number; ms: number; bytes: number }> = []
  if (records) {
    const { plans } = R.readPlans({ slug: row.row, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph, metrics, raster, sheetCache: new Map() })
    for (const plan of plans) {
      if (!plan.registration) continue
      const chains = metrics.chains.filter((c) => c.frameId === plan.frame.id)
      const options = { callouts: R.planCallouts(metrics, plan.frame.id), sheetWallPx: plan.wallPx, ...(mode === 'ON' ? { drawnGapRule: 'ON' as const } : {}) }
      const incumbent = R.decomposePlan(plan.mask, chains, plan.bands, plan.registration, plan.extent, { ...options, openingAware: false })
      const ext = R.boundaryExtension(plan.mask, plan.bands, plan.registration, plan.extent, incumbent, options, chains)
      const input = { mask: plan.mask, wallsX: ext.walls.x, wallsY: ext.walls.y, mppX: plan.registration.metresPerPixelX, mppY: plan.registration.metresPerPixelY, wallPx: plan.wallPx, decompositionId: ext.record.decompositionId, outline: ext.outline, drawnGapRule: mode as 'OFF' | 'ON' }
      const ts: number[] = []
      let n = 0
      for (let i = 0; i < 20; i += 1) {
        const t0 = performance.now()
        n = records(input).records.length
        ts.push(performance.now() - t0)
      }
      builder.push({ frameId: plan.frame.id, records: n, ms: Math.round(median(ts) * 1000) / 1000, bytes: Buffer.byteLength(stableJson(ext.record.gapEvidence), 'utf8') })
    }
  }
  out.push({ row: row.row, mode, solverMs: { median: Math.round(median(times)), all: times.map((t) => Math.round(t)) }, result, builder })
  process.stdout.write(`${row.row} ${mode} solver ${Math.round(median(times))} ms ${builder.map((b) => `${b.records} rec ${b.ms} ms ${b.bytes} B`).join(' | ')}\n`)
}
writeFileSync(resolve(arg('out', 'perf.json')), `${JSON.stringify({ node: process.version, mode, peakRssMB: Math.round(process.resourceUsage().maxRSS / 1024), rows: out }, null, 1)}\n`)
