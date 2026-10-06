/**
 * order.ts — BUILDPLAN-ANALYZER-005K §27 order invariance on the development sheets (RESEARCH ONLY).
 *
 *   npx vite-node research/analyzer-005k/order.ts -- --permutations 12 --mode OFF|ON --out <json>
 *
 * For every development row, the plans the layout pass reads (`readPlans`, the production entry) are read once in the
 * sealed order and then under seeded shuffles of everything the pass enumerates: the coordinate frames (copies), the
 * metric evidence (callouts), the dimension observations and the registrations (family A: every read plan's reading
 * identity, gap records and decisions must be identical, byte for byte), and, apart, of the dimension chains alone
 * (family B: an input of the decomposition grid, upstream of the boundary; measured and reported).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { sha256Hex, stableJson } from '@buildapp/source-common'
import { decodeImage, fileByteCache } from '@buildapp/source-package'
import type { SourcePackage } from '@buildapp/source-package'
import type { SourceObservationGraph } from '@buildapp/source-observations'
import type { MetricEvidenceSet } from '@buildapp/source-metrics'
import type { Raster } from '@buildapp/source-cv'
import { readPlans } from '@buildapp/reconstruction'

const REPO = resolve(import.meta.dirname, '../..')
const arg = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}
type Row = { row: string; cache: string; inputs: { package: string; graph: string; metrics: string }; dropDimensionedGroundFrames?: string }
const rows = (JSON.parse(readFileSync(join(REPO, 'research/analyzer-005k/dev-rows.json'), 'utf8')) as { rows: Row[] }).rows
const permutations = Number(arg('permutations', '12'))
const mode = arg('mode', 'OFF') === 'ON' ? 'ON' : 'OFF'
const p = (x: string): string => (x.startsWith('/') ? x : join(REPO, x))

/** A seeded Fisher–Yates shuffle (sha256 stream): reproducible, and independent of the array's own order. */
function shuffle<T>(items: readonly T[], seed: string): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Number(BigInt(`0x${sha256Hex(`${seed}:${i}`).slice(0, 12)}`) % BigInt(i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const report: Array<{ row: string; plans: number; records: number; permutations: number; moved: number; movedPlans: string[]; chainOrder: { moved: number; movedPlans: string[]; gridMoved: number } }> = []
for (const row of rows) {
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
  const read = (g: SourceObservationGraph, m: MetricEvidenceSet): Map<string, string> => {
    const { plans } = readPlans({ slug: row.row, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph: g, metrics: m, raster: (f) => rasters.get(f.variantByteHash), sheetCache: new Map(), ...(mode === 'ON' ? { drawnGapRule: 'ON' as const } : {}) })
    return new Map(plans.map((plan) => [plan.frame.id, stableJson({ id: plan.decomposition.boundary?.decompositionId ?? null, gaps: plan.decomposition.boundary?.gapEvidence ?? [] }, 0)]))
  }
  const canonical = read(graph, metrics)
  // family A: what the boundary and its records enumerate — copies, callouts, observations, registrations
  // family B: the order of the dimension chains alone — an input of the decomposition's grid (`gridLines`), upstream
  const family = (chainsOnly: boolean): { moved: number; movedPlans: string[]; gridMoved: number } => {
    let moved = 0
    let gridMoved = 0
    const movedPlans = new Set<string>()
    for (let k = 0; k < permutations; k += 1) {
      const seed = `005K-order:${row.row}:${k}`
      const g = chainsOnly ? graph : { ...graph, coordinateFrames: shuffle(graph.coordinateFrames, `${seed}:frames`) }
      const m = chainsOnly
        ? { ...metrics, chains: shuffle(metrics.chains, `${seed}:chains`) }
        : {
            ...metrics,
            evidence: shuffle(metrics.evidence, `${seed}:evidence`),
            coordinateRegistrations: shuffle(metrics.coordinateRegistrations, `${seed}:registrations`),
            ...(metrics.dimensionObservations ? { dimensionObservations: shuffle(metrics.dimensionObservations, `${seed}:observations`) } : {}),
          }
      const got = read(g, m)
      let differs = got.size !== canonical.size
      let grid = false
      for (const [frame, text] of canonical) {
        const other = got.get(frame)
        if (other !== text) {
          differs = true
          movedPlans.add(frame)
          if ((JSON.parse(text) as { id: string }).id !== (other ? (JSON.parse(other) as { id: string }).id : null)) grid = true
        }
      }
      if (differs) moved += 1
      if (grid) gridMoved += 1
    }
    return { moved, movedPlans: [...movedPlans], gridMoved }
  }
  const a = family(false)
  const b = family(true)
  const records = [...canonical.values()].reduce((s, t) => s + (JSON.parse(t) as { gaps: unknown[] }).gaps.length, 0)
  report.push({ row: row.row, plans: canonical.size, records, permutations, moved: a.moved, movedPlans: a.movedPlans, chainOrder: b })
  process.stdout.write(`${row.row}: ${canonical.size} plans, ${records} records; copies/callouts/observations/registrations: ${a.moved} of ${permutations} moved; chain order: ${b.moved} moved (${b.gridMoved} with the reading's grid moved)\n`)
}
writeFileSync(
  resolve(arg('out', 'order-invariance.json')),
  `${JSON.stringify({ stage: 'BUILDPLAN-ANALYZER-005K', mode, method: 'readPlans (the production entry) on every development row, in the sealed order and under seeded shuffles. Family A shuffles what the boundary and its records enumerate: the coordinate frames (copies), the metric evidence (callouts), the dimension observations and the registrations. Family B shuffles the dimension chains alone, an input of the decomposition grid upstream of the boundary. A plan moves when its decompositionId or any gap record differs, byte for byte; a grid move is a changed decompositionId', permutations, rows: report, rowsWithAMove: report.filter((r) => r.moved > 0).length, rowsWhereChainOrderMovesTheGrid: report.filter((r) => r.chainOrder.gridMoved > 0).length, rowsWhereChainOrderMovesRecordsOnAnUnchangedGrid: report.filter((r) => r.chainOrder.moved > r.chainOrder.gridMoved).length, totalRecords: report.reduce((a, r) => a + r.records, 0) }, null, 1)}\n`,
)
