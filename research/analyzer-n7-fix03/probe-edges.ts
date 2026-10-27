/**
 * N7-COUNCIL-FIX-03 (research only): the base plan's cells and the closure of every cell edge (wall / line / opening
 * / closure), read again with the production `readPlans` on the same graph and metrics a run produced.
 *   npx vite-node research/analyzer-n7-fix03/probe-edges.ts -- --only CODE
 */
import { decodeImage, memoryByteCache, selectedVariant } from '@buildapp/source-package'
import { syntheticPublisher } from '@buildapp/synthetic-drawings'
import { readPlans } from '@buildapp/reconstruction'
import { runAnalysis } from '../../packages/analysis-service/src/index.js'
import { FIX03_CASES } from './cases.js'
const code = process.argv[process.argv.indexOf('--only') + 1]
const publisher = syntheticPublisher({ projects: [{ code, title: code, house: FIX03_CASES[code] }] })
const cache = memoryByteCache()
const run = await runAnalysis({ kind: 'URL', url: publisher.pageUrl(code) }, { adapters: [publisher.adapter], deps: publisher.deps, cache, now: () => new Date('2026-01-01T00:00:00Z') })
const rasters = new Map<string, ReturnType<typeof decodeImage>>()
for (const a of run.pkg.assets) {
  const v = selectedVariant(a)
  const got = await cache.get(v.url)
  if (got) rasters.set(v.byteHash, decodeImage(got.bytes))
}
const { plans } = readPlans({ graph: run.graph, metrics: run.metrics, raster: (f: { variantByteHash: string }) => rasters.get(f.variantByteHash) } as never)
const base = plans.find((p) => p.frame.id === run.reconstruction.planDiagnostics.selectedPlanFrameId) ?? plans[0]
const d = base.decomposition
const mx = base.registration?.metresPerPixelX ?? 1
const my = base.registration?.metresPerPixelY ?? 1
const f = (n: number): string => n.toFixed(2)
console.log(`frame ${base.frame.id} wallPx ${base.wallPx} linesX px ${d.linesX.map((l) => f(l.px)).join(' ')} (m ${d.linesX.map((l) => f((l.px - d.linesX[0].px) * mx)).join(' ')})`)
console.log(`linesY px ${d.linesY.map((l) => `${f(l.px)}[probes ${l.probesPx.map(f).join(",")} merged ${(l.mergedPx ?? []).map(f).join(",")}]`).join(' ')} (m ${d.linesY.map((l) => f((l.px - d.linesY[0].px) * my)).join(' ')})`)
for (const c of d.cells) console.log(`cell ${c.ix},${c.iy} ${c.classification} enclosed ${c.enclosed} edges T/R/B/L ${c.edges.map((e) => `w${f(e.wall)} l${f(e.line)} o${f(e.opening)} c${f(e.closure)}`).join(' | ')}`)
for (const w of d.wideOpenings) console.log(`wide ${w.axis} ${f(w.linePx)} ${f(w.fromPx)}..${f(w.toPx)} ${f(w.widthM)} ${w.decision}: ${w.why.slice(0, 160)}`)
console.log(`regions ${d.regions.map((r) => `${r.id} cells ${r.cells.length}`).join(' | ')}; hyp ${d.chosenHypothesis}`)
const near = (process.argv.includes('--bands') ? Number(process.argv[process.argv.indexOf('--bands') + 1]) : NaN)
if (!Number.isNaN(near)) for (const b of base.bands) if (Math.abs((b.bounds.y0 + b.bounds.y1) / 2 - near) < 30 || Math.abs((b.bounds.x0 + b.bounds.x1) / 2 - near) < 30) console.log(`band ${b.axis} ${JSON.stringify(b.bounds)} t${b.thickness} len${b.length} axisPx ${b.axisPx}`)
