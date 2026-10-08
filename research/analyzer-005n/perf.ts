/**
 * perf.ts — BUILDPLAN-ANALYZER-005N §32 cost of the compound-facade reading (RESEARCH ONLY).
 *
 *   npx vite-node [--config <dir>/vite.config.mjs] research/analyzer-005n/perf.ts -- --rows <rows.json> --out <json> [--repeat 3]
 *
 * Runs unchanged at the starting code and at the stage's code (it touches only `readPlans` and
 * `composeStructuralLayout`, which both have). For every development row, on the row's sealed evidence, each is timed
 * `--repeat` times and the median kept:
 *
 *   read      `readPlans`: every plan's sheet, bands and decomposition (`decomposePlan`, the boundary included), a
 *             fresh sheet cache each time;
 *   layout    `composeStructuralLayout`, the production entry (a fresh sheet cache each time);
 *   facade    at the stage's code only, under `perf-config.mjs` (a Vite alias that times `compoundSpanOf`): the time
 *             spent reading compound facade spans inside one `readPlans`, and how many spans were read.
 *
 * The total analyzer time per row is the wall time of the development replay (`dev-matrix.mjs`), run the same way at
 * both commits.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { decodeImage, fileByteCache } from '@buildapp/source-package'
import type { SourcePackage } from '@buildapp/source-package'
import type { SourceObservationGraph } from '@buildapp/source-observations'
import type { MetricEvidenceSet } from '@buildapp/source-metrics'
import type { Raster } from '@buildapp/source-cv'
import { composeStructuralLayout, levelsFrom, readPlans } from '@buildapp/reconstruction'

const arg = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}
type Row = { row: string; cache: string; inputs: { package: string; graph: string; metrics: string }; dropFrames?: string[] }
const rows = (JSON.parse(readFileSync(resolve(arg('rows', '')), 'utf8')) as { rows: Row[] }).rows
const repeat = Number(arg('repeat', '3'))
const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
const round1 = (x: number): number => Math.round(x * 10) / 10
const meter = (globalThis as { __compound005n?: { ms: number; spans: number } })
const out: Array<{ row: string; readMs: number; layoutMs: number; facadeMs: number | null; facadeSpans: number | null }> = []
for (const row of rows) {
  const pkg = JSON.parse(readFileSync(row.inputs.package, 'utf8')) as SourcePackage
  const graph = JSON.parse(readFileSync(row.inputs.graph, 'utf8')) as SourceObservationGraph
  const metrics = JSON.parse(readFileSync(row.inputs.metrics, 'utf8')) as MetricEvidenceSet
  const dropped = new Set(row.dropFrames ?? [])
  const keep = dropped.size > 0 ? (f: { id: string }): boolean => !dropped.has(f.id) : undefined
  const cache = fileByteCache(row.cache)
  const rasters = new Map<string, Raster | undefined>()
  for (const a of pkg.assets) for (const v of a.variants) {
    if (rasters.has(v.byteHash)) continue
    const got = await cache.get(v.url)
    try { rasters.set(v.byteHash, got ? decodeImage(got.bytes) : undefined) } catch { rasters.set(v.byteHash, undefined) }
  }
  const section = graph.coordinateFrames.find((f) => f.roles.projection === 'ORTHOGRAPHIC_SECTION')
  const base = { slug: row.row, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph, metrics, raster: (f: { variantByteHash: string }) => rasters.get(f.variantByteHash), ...(keep ? { frameFilter: keep } : {}) }
  const reads: number[] = []
  const layouts: number[] = []
  const facades: number[] = []
  let spans: number | null = null
  for (let k = 0; k < repeat; k += 1) {
    if (meter.__compound005n) meter.__compound005n = { ms: 0, spans: 0 }
    const t0 = performance.now()
    readPlans({ ...base, sheetCache: new Map() } as never)
    reads.push(performance.now() - t0)
    if (meter.__compound005n) {
      facades.push(meter.__compound005n.ms)
      spans = meter.__compound005n.spans
    }
    const t1 = performance.now()
    composeStructuralLayout({ ...base, levels: levelsFrom(metrics, section?.id), publishedAreas: pkg.publishedFacts, sheetCache: new Map() } as never)
    layouts.push(performance.now() - t1)
  }
  out.push({ row: row.row, readMs: round1(median(reads)), layoutMs: round1(median(layouts)), facadeMs: facades.length > 0 ? round1(median(facades)) : null, facadeSpans: spans })
  process.stdout.write(`${row.row} read ${round1(median(reads))} layout ${round1(median(layouts))}${facades.length > 0 ? ` facade ${round1(median(facades))} (${spans} spans)` : ''}\n`)
}
const med = (k: 'readMs' | 'layoutMs'): number => round1(median(out.map((r) => r[k])))
const fac = out.filter((r) => r.facadeMs !== null).map((r) => r.facadeMs as number)
writeFileSync(resolve(arg('out', '')), JSON.stringify({ stage: 'BUILDPLAN-ANALYZER-005N', repeat, rows: out, median: { readMs: med('readMs'), layoutMs: med('layoutMs'), ...(fac.length > 0 ? { facadeMs: round1(median(fac)), facadeMaxMs: round1(Math.max(...fac)) } : {}) } }, null, 1) + '\n')
