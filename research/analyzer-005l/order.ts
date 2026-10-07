/**
 * order.ts — BUILDPLAN-ANALYZER-005L order invariance of storey registration and support (RESEARCH ONLY).
 *
 *   npx vite-node research/analyzer-005l/order.ts -- --permutations 8 --out <json> [--only a,b]
 *
 * For every development row with more than one plan, the structural pass the solver runs first
 * (`composeStructuralLayout`, the production entry) is run on the row's sealed evidence once in the sealed order and
 * then under seeded shuffles of everything the registration and support enumerate upstream: the coordinate frames
 * (the plans, so the order of alignment targets and of upper plans), the metric evidence, the registrations, the
 * dimension observations and the published facts (family A: every storey decision — the chosen placement, the
 * regions, the relations, the decision itself — every mass's storey span and every footprint region must be equal,
 * byte for byte), and, apart, of the dimension chains alone (family B: an input of the decomposition grid, upstream of
 * the regions; the 005K debt, measured and reported, not repaired here).
 *
 * The order of the regions and of the masses inside the pass is fixed by the pass itself (both are sorted by id
 * before they are weighed) and is permuted by the synthetic fixture 16, not here.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { sha256Hex, stableJson } from '@buildapp/source-common'
import { decodeImage, fileByteCache } from '@buildapp/source-package'
import type { SourcePackage } from '@buildapp/source-package'
import type { SourceObservationGraph } from '@buildapp/source-observations'
import type { MetricEvidenceSet } from '@buildapp/source-metrics'
import type { Raster } from '@buildapp/source-cv'
import { composeStructuralLayout, levelsFrom } from '@buildapp/reconstruction'

const REPO = resolve(import.meta.dirname, '../..')
const arg = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}
type Row = { row: string; cache: string; inputs: { package: string; graph: string; metrics: string }; dropFrames?: string[] }
const rows = (JSON.parse(readFileSync(join(REPO, 'research/analyzer-005l/rows.json'), 'utf8')) as { rows: Row[] }).rows
const permutations = Number(arg('permutations', '8'))
const only = arg('only', '').split(',').filter(Boolean)
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

type RowReport = { row: string; plans: number; registrations: number; decisions: string[]; permutations: number; moved: number; movedWhat: string[]; chainOrder: { moved: number; movedWhat: string[]; regionsMoved: number } }
const report: RowReport[] = []
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
  /** Everything the storey registration and support decided, keyed so a difference names what moved. */
  const decided = (g: SourceObservationGraph, m: MetricEvidenceSet, facts: SourcePackage['publishedFacts']): Map<string, string> => {
    const section = g.coordinateFrames.find((f) => f.roles.projection === 'ORTHOGRAPHIC_SECTION' && (!keep || keep(f)))
    const { draft } = composeStructuralLayout({ slug: row.row, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph: g, metrics: m, raster: (f) => rasters.get(f.variantByteHash), frameFilter: keep, levels: levelsFrom(m, section?.id), publishedAreas: facts, sheetCache: new Map() })
    const out = new Map<string, string>()
    out.set('base', stableJson(draft.base?.frame.id ?? null, 0))
    for (const r of [...draft.storeyRegistrations].sort((a, b) => a.frameId.localeCompare(b.frameId))) {
      out.set(`decision:${r.frameId}`, stableJson({ decision: r.decision, chosen: r.chosen ?? null, rival: r.rival ?? null, margin: r.margin ?? null }, 0))
      out.set(`regions:${r.frameId}`, stableJson({ regions: r.regions, relations: r.relations }, 0))
    }
    for (const mass of [...draft.masses].sort((a, b) => a.id.localeCompare(b.id))) out.set(`span:${mass.id}`, stableJson({ ring: mass.ring, span: mass.storeySpan }, 0))
    out.set('footprints', stableJson([...draft.footprintRegions].sort((a, b) => a.id.localeCompare(b.id)).map((f) => ({ id: f.id, storeyId: f.storeyId, ring: f.ring })), 0))
    return out
  }
  const canonical = decided(graph, metrics, pkg.publishedFacts)
  const family = (chainsOnly: boolean): { moved: number; movedWhat: string[]; regionsMoved: number } => {
    let moved = 0
    let regionsMoved = 0
    const movedWhat = new Set<string>()
    for (let k = 0; k < permutations; k += 1) {
      const seed = `005L-order:${row.row}:${k}`
      const g = chainsOnly ? graph : { ...graph, coordinateFrames: shuffle(graph.coordinateFrames, `${seed}:frames`) }
      const m = chainsOnly
        ? { ...metrics, chains: shuffle(metrics.chains, `${seed}:chains`) }
        : {
            ...metrics,
            evidence: shuffle(metrics.evidence, `${seed}:evidence`),
            coordinateRegistrations: shuffle(metrics.coordinateRegistrations, `${seed}:registrations`),
            ...(metrics.dimensionObservations ? { dimensionObservations: shuffle(metrics.dimensionObservations, `${seed}:observations`) } : {}),
          }
      const facts = chainsOnly ? pkg.publishedFacts : shuffle(pkg.publishedFacts ?? [], `${seed}:facts`)
      const got = decided(g, m, facts)
      let differs = got.size !== canonical.size
      let regions = false
      for (const [key, text] of canonical) {
        if (got.get(key) === text) continue
        differs = true
        movedWhat.add(key)
        if (key.startsWith('regions:')) regions = true
      }
      for (const key of got.keys()) if (!canonical.has(key)) (differs = true), movedWhat.add(key)
      if (differs) moved += 1
      if (regions) regionsMoved += 1
    }
    return { moved, movedWhat: [...movedWhat].sort(), regionsMoved }
  }
  const a = family(false)
  const b = family(true)
  const decisions = [...canonical.entries()].filter(([k]) => k.startsWith('decision:')).map(([k, v]) => `${k.slice(9)}=${(JSON.parse(v) as { decision: string }).decision}`)
  report.push({ row: row.row, plans: planCount, registrations: decisions.length, decisions, permutations, moved: a.moved, movedWhat: a.movedWhat, chainOrder: b })
  process.stdout.write(`${row.row}: ${planCount} plans, ${decisions.length} storey decisions; frames/evidence/registrations/observations/facts: ${a.moved} of ${permutations} moved; chain order: ${b.moved} moved (${b.regionsMoved} with the regions moved)\n`)
}
writeFileSync(
  resolve(arg('out', 'order-invariance.json')),
  `${JSON.stringify(
    {
      stage: 'BUILDPLAN-ANALYZER-005L',
      method:
        'composeStructuralLayout (the production entry) on every development row with more than one plan, in the sealed order and under seeded shuffles. Family A shuffles the coordinate frames (the plans: the order of alignment targets and of upper plans), the metric evidence, the registrations, the dimension observations and the published facts; every storey decision (chosen placement, rival, margin, decision), every walled region and support relation, every mass storey span and every footprint region must be equal byte for byte. Family B shuffles the dimension chains alone, an input of the decomposition grid upstream of the regions (the 005K debt; measured, not repaired).',
      permutations,
      rows: report,
      rowsWithAMove: report.filter((r) => r.moved > 0).length,
      rowsWhereChainOrderMovesAStoreyDecision: report.filter((r) => r.chainOrder.movedWhat.some((w) => w.startsWith('decision:') || w.startsWith('span:') || w === 'footprints')).length,
      rowsWhereChainOrderMovesRegionsOnly: report.filter((r) => r.chainOrder.moved > 0 && r.chainOrder.movedWhat.every((w) => w.startsWith('regions:'))).length,
    },
    null,
    1,
  )}\n`,
)
