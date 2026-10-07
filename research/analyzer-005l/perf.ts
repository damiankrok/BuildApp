/**
 * perf.ts — BUILDPLAN-ANALYZER-005L §33 cost of storey registration and support (RESEARCH ONLY).
 *
 *   npx vite-node research/analyzer-005l/perf.ts -- --out <json> [--repeat 3] [--only a,b]
 *
 * Runs unchanged at the starting code and at the stage's code (it touches only `readPlans`, `alignPlans` and
 * `composeStructuralLayout`, which both have). For every development row with more than one plan, on the row's sealed
 * evidence, each is timed `--repeat` times and the median kept:
 *
 *   read       `readPlans`: the plans' sheets, bands and decompositions (a fresh sheet cache each time);
 *   align      `alignPlans` for every plan other than the base, onto the base: candidate generation and scoring;
 *   layout     `composeStructuralLayout`, the production entry (a fresh sheet cache each time);
 *   rest       layout − read − align: everything else the layout decides, which at the stage's code includes the
 *              upper-region support scoring and the storey decision (`storeySupportOf` is not exported, so it is
 *              measured as what the layout costs beyond reading and aligning).
 *
 * The total analyzer time per row is the wall time of the development replay (`dev-matrix.mjs`), run the same way at
 * both commits.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { decodeImage, fileByteCache } from '@buildapp/source-package'
import type { SourcePackage } from '@buildapp/source-package'
import type { SourceObservationGraph } from '@buildapp/source-observations'
import type { MetricEvidenceSet } from '@buildapp/source-metrics'
import type { Raster } from '@buildapp/source-cv'
import { alignPlans, composeStructuralLayout, levelsFrom, readPlans } from '@buildapp/reconstruction'

const REPO = resolve(import.meta.dirname, '../..')
const arg = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}
type Row = { row: string; cache: string; inputs: { package: string; graph: string; metrics: string }; dropFrames?: string[] }
const rows = (JSON.parse(readFileSync(join(REPO, 'research/analyzer-005l/rows.json'), 'utf8')) as { rows: Row[] }).rows
const repeat = Number(arg('repeat', '3'))
const only = arg('only', '').split(',').filter(Boolean)
const p = (x: string): string => (x.startsWith('/') ? x : join(REPO, x))
const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
const timed = (f: () => unknown): number => {
  const t0 = performance.now()
  f()
  return performance.now() - t0
}
const round1 = (x: number): number => Math.round(x * 10) / 10

const out: Array<{ row: string; plans: number; candidates: number; readMs: number; alignMs: number; layoutMs: number; restMs: number }> = []
for (const row of rows) {
  if (only.length > 0 && !only.includes(row.row)) continue
  const pkg = JSON.parse(readFileSync(p(row.inputs.package), 'utf8')) as SourcePackage
  const graph = JSON.parse(readFileSync(p(row.inputs.graph), 'utf8')) as SourceObservationGraph
  const metrics = JSON.parse(readFileSync(p(row.inputs.metrics), 'utf8')) as MetricEvidenceSet
  const dropped = new Set(row.dropFrames ?? [])
  const keep = dropped.size > 0 ? (f: { id: string }): boolean => !dropped.has(f.id) : undefined
  const planCount = graph.coordinateFrames.filter((f) => f.roles.projection === 'ORTHOGRAPHIC_PLAN' && f.roles.document === 'FLOOR_PLAN' && (!keep || keep(f))).length
  if (planCount < 2) continue
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
  const section = graph.coordinateFrames.find((f) => f.roles.projection === 'ORTHOGRAPHIC_SECTION' && (!keep || keep(f)))
  const options = () => ({ slug: row.row, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph, metrics, raster: (f: { variantByteHash: string }) => rasters.get(f.variantByteHash), frameFilter: keep, levels: levelsFrom(metrics, section?.id), publishedAreas: pkg.publishedFacts, sheetCache: new Map() })
  const { draft } = composeStructuralLayout(options() as never)
  const base = draft.base
  const others = draft.plans.filter((x) => x !== base)
  let candidates = 0
  if (base) for (const o of others) candidates += alignPlans(base, o).considered.length
  const reads: number[] = []
  const aligns: number[] = []
  const layouts: number[] = []
  for (let k = 0; k < repeat; k += 1) {
    reads.push(timed(() => readPlans(options() as never)))
    aligns.push(timed(() => base && others.forEach((o) => alignPlans(base, o))))
    layouts.push(timed(() => composeStructuralLayout(options() as never)))
  }
  const r = { row: row.row, plans: planCount, candidates, readMs: round1(median(reads)), alignMs: round1(median(aligns)), layoutMs: round1(median(layouts)), restMs: 0 }
  r.restMs = round1(r.layoutMs - r.readMs - r.alignMs)
  out.push(r)
  process.stdout.write(`${row.row}: read ${r.readMs} ms, align ${r.alignMs} ms (${candidates} candidates), layout ${r.layoutMs} ms, rest ${r.restMs} ms\n`)
}
const med = (k: 'readMs' | 'alignMs' | 'layoutMs' | 'restMs'): number => round1(median(out.map((r) => r[k])))
writeFileSync(resolve(arg('out', 'perf.json')), `${JSON.stringify({ stage: 'BUILDPLAN-ANALYZER-005L', repeat, rows: out, median: { readMs: med('readMs'), alignMs: med('alignMs'), layoutMs: med('layoutMs'), restMs: med('restMs') } }, null, 1)}\n`)
