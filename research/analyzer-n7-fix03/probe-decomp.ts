/**
 * N7-COUNCIL-FIX-03 (research only, offline): the base plan's decomposition for the invented cases — the grid in
 * metres, each cell's class (B built, R recess, . outside), the regions, the wide openings and their decisions, the
 * layout's masses, the model's rings and roofs, the outcome. Writes nothing.
 *   npx vite-node research/analyzer-n7-fix03/probe-decomp.ts [-- --only CODE]
 */
import { memoryByteCache } from '@buildapp/source-package'
import { syntheticPublisher } from '@buildapp/synthetic-drawings'
import { runAnalysis } from '../../packages/analysis-service/src/index.js'
import { FIX03_CASES } from './cases.js'

const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : undefined
const codes = Object.keys(FIX03_CASES).filter((c) => !only || only.split(',').includes(c))
const publisher = syntheticPublisher({ projects: codes.map((code) => ({ code, title: FIX03_CASES[code].name, house: FIX03_CASES[code] })) })
const f = (n: number): string => n.toFixed(2)
for (const code of codes) {
  console.log(`\n=== ${code}`)
  let out
  try {
    out = await runAnalysis({ kind: 'URL', url: publisher.pageUrl(code) }, { adapters: [publisher.adapter], deps: publisher.deps, cache: memoryByteCache(), now: () => new Date('2026-01-01T00:00:00Z') })
  } catch (e) {
    console.log(`  RUN FAILED ${(e as Error).message.slice(0, 300)}`)
    continue
  }
  const { result, reconstruction: r } = out
  const p = r.planDiagnostics.plans.find((x) => x.frameId === r.planDiagnostics.selectedPlanFrameId)
  if (p) {
    const mx = p.scale?.mppX ?? 1
    const my = p.scale?.mppY ?? 1
    const x0 = p.linesX[0]
    const y0 = p.linesY[0]
    console.log(`  linesX m ${p.linesX.map((v) => f((v - x0) * mx)).join(' ')}`)
    console.log(`  linesY m ${p.linesY.map((v) => f((v - y0) * my)).join(' ')}`)
    const nx = p.linesX.length - 1
    for (let iy = 0; iy < p.linesY.length - 1; iy += 1) console.log(`   ${Array.from({ length: nx }, (_, ix) => { const c = p.cells.find((q) => q.ix === ix && q.iy === iy); return c ? (c.cls === 'B' ? 'B' : c.cls === 'R' ? 'R' : '.') : '?' }).join('')}`)
    console.log(`  regions ${p.regions.map((g) => `${g.id} ${f((g.rect.x0 - x0) * mx)}..${f((g.rect.x1 - x0) * mx)}x${f((g.rect.y0 - y0) * my)}..${f((g.rect.y1 - y0) * my)}`).join(' | ')}`)
    for (const w of p.wideOpenings) console.log(`  wide ${w.axis} line ${f(w.axis === 'X' ? (w.linePx - x0) * mx : (w.linePx - y0) * my)} ${f(w.widthM)} m ${w.decision} ${w.score}: ${w.why.slice(0, 220)}`)
    console.log(`  hyp ${p.hypotheses.map((h) => `${h.id}${h.chosen ? '*' : ''} ${h.builtCells}`).join(', ')}${p.boundary ? ' boundary' : ''}`)
  }
  console.log(`  layout ${r.layout.masses.map((m) => `${m.id}/${m.role} ${f(m.widthM.value)}x${f(m.depthM.value)} s${m.storeySpan.fromIndex}..${m.storeySpan.toIndex}`).join(' | ')}; gate ${r.layout.gate.status} ${r.layout.gate.reasons.filter((x) => x.severity === "BLOCKING").map((x) => `${x.code}: ${x.what} [${x.why.slice(0, 900)}]`).join(" ; ")}`)
  console.log(`  v2 ${r.building.masses.map((m) => `${m.id} ${f(m.x0)}..${f(m.x1)}x${f(m.z0)}..${f(m.z1)} s${m.storeys.join(',')}${m.storeyRects ? ` sr${m.storeyRects.map((q) => `${q.storey}:${f(q.x1 - q.x0)}`).join(',')}` : ''}`).join(' | ')}`)
  console.log(`  model rings ${result.model.wallRings.map((x) => x.id).join(',')}; roofs ${result.model.roofs.map((x) => x.id).join(',')}; mainRoof ${r.building.mainRoof ? JSON.stringify(r.building.mainRoof.footprint) : 'none'}; outcome ${result.preview.outcome}`)
  for (const b of r.bodyRecovery.gateBays) console.log(`  gateBay ${b.decision} ${b.mouth.side} w${b.widthM} d${b.depthM} gap${b.gapM} jambs ${b.jambsM.join('/')} sides ${b.sideWalls.join('/')}`)
  const bc = r.bodyCompleteness
  if (bc) console.log(`  completeness drawn ${bc.drawnBuiltM2.toFixed(1)} m2, represented ${bc.representedM2.toFixed(1)} (${bc.coverage.toFixed(3)}); ${bc.areas.map((a) => `${a.id}:${a.decision}`).join(' ')}`)
  for (const a of bc?.areas ?? []) if (a.decision !== 'REPRESENTED' && a.decision !== 'JOINED') console.log(`    ${a.decision} ${a.id}: ${a.why.slice(0, 220)}`)

}
