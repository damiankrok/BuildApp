/**
 * N7-COUNCIL C. RESEARCH ONLY. Wing / notch / second-wing variants of invented fixtures, with the base plan's regions
 * and every unresolved item dumped, to find where a body is lost or merged.
 *   npx vite-node research/analyzer-n7-council/C/probe-wings.ts [-- --only CODE]
 */
import { memoryByteCache } from '@buildapp/source-package'
import { HOLLOWAY, SLIVERTON_DIMENSIONED, syntheticPublisher } from '@buildapp/synthetic-drawings'
import type { SyntheticHouse } from '@buildapp/synthetic-drawings'
import { rectAt } from '../../../packages/reconstruction/src/v2/index.js'
import { runAnalysis } from '../../../packages/analysis-service/src/index.js'

const garageDoor = [{ side: 'FRONT' as const, kind: 'DOOR' as const, at: 0.6, width: 2.4, height: 2.1, sill: 0, storey: 0 }]
const twoWings = (name: string, gap: number, s0: number, s1: number, w1 = 3.6, extra: Partial<SyntheticHouse> = {}): SyntheticHouse => {
  const d0 = 5.0
  const d1 = 12.0 - d0 - gap
  return { ...HOLLOWAY, name, depth: 12.0, chainsZ: gap > 0 ? [d0, gap, d1] : [d0, d1], chainsX: [8.4, 3.6], upperChainsX: s0 > 1 ? [8.4, 3.6] : [8.4], upperChainsZ: s0 > 1 ? [d0, 12 - d0] : [4.2, 7.8], wings: [
    { name: 'wing', width: 3.6, depth: d0, offsetZ: 0, storeys: s0, roof: 'FLAT', openings: [] },
    { name: 'garage', width: w1, depth: d1, offsetZ: d0 + gap, storeys: s1, roof: 'FLAT', openings: garageDoor },
  ], ...extra }
}
const cases: Array<{ code: string; house: SyntheticHouse; bodies: number }> = [
  { code: 'w-gap1-21', house: twoWings('Gap1 21', 1.0, 2, 1), bodies: 3 },
  { code: 'w-gap2-21', house: twoWings('Gap2 21', 2.0, 2, 1), bodies: 3 },
  { code: 'w-gap1-11', house: twoWings('Gap1 11', 1.0, 1, 1), bodies: 3 },
  { code: 'w-gap2-11', house: twoWings('Gap2 11', 2.0, 1, 1), bodies: 3 },
  { code: 'w-gap3-11', house: twoWings('Gap3 11', 3.0, 1, 1), bodies: 3 },
  { code: 'w-gap0-11', house: twoWings('Gap0 11', 0, 1, 1), bodies: 3 },
  { code: 'w-gap1-21-nodoor', house: (() => { const h = twoWings('Gap1 21 nodoor', 1.0, 2, 1); return { ...h, wings: h.wings!.map((w) => ({ ...w, openings: [] })) } })(), bodies: 3 },
  { code: 'w-gap1-11-nodoor', house: (() => { const h = twoWings('Gap1 11 nodoor', 1.0, 1, 1); return { ...h, wings: h.wings!.map((w) => ({ ...w, openings: [] })) } })(), bodies: 3 },
  { code: 'w-fulldepth-garage', house: { ...HOLLOWAY, name: 'Full depth garage', chainsZ: [10.2], wings: [{ name: 'garage', width: 3.6, depth: 10.2, offsetZ: 0, storeys: 1, roof: 'FLAT', openings: garageDoor }] }, bodies: 2 },
  { code: 'w-sliver2storey-d', house: { ...SLIVERTON_DIMENSIONED, name: 'Sliver2 dim', upperChainsX: [8.85], upperChainsZ: [4.2, 6.0], wings: [{ name: 'sliver', width: 0.45, depth: 6.0, offsetZ: 4.2, storeys: 2, roof: 'FLAT', openings: [] }] }, bodies: 2 },
  { code: 'w-sliver-second', house: { ...HOLLOWAY, name: 'Sliver second', depth: 12.0, chainsZ: [3.0, 5.0, 4.0], chainsX: [8.4, 3.6], upperChainsX: [8.4], upperChainsZ: [4.2, 7.8], wings: [
    { name: 'store', width: 3.6, depth: 3.0, offsetZ: 0, storeys: 1, roof: 'FLAT', openings: [] },
    { name: 'sliver', width: 0.45, depth: 4.0, offsetZ: 8.0, storeys: 1, roof: 'FLAT', openings: [] },
  ] }, bodies: 3 },
]
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : undefined
const chosen = cases.filter((c) => !only || c.code === only)
const publisher = syntheticPublisher({ projects: chosen.map((c) => ({ code: c.code, title: c.house.name, house: c.house })) })
const f = (n: number): string => n.toFixed(2)
const flags: string[] = []
for (const c of chosen) {
  console.log(`\n=== ${c.code} (${c.house.wings?.map((w) => `${w.name} ${w.width}x${w.depth}@z${w.offsetZ} s${w.storeys}`).join('; ')})`)
  let out
  try {
    out = await runAnalysis({ kind: 'URL', url: publisher.pageUrl(c.code) }, { adapters: [publisher.adapter], deps: publisher.deps, cache: memoryByteCache(), now: () => new Date('2026-01-01T00:00:00Z') })
  } catch (e) {
    console.log(`  RUN FAILED ${(e as Error).message.slice(0, 300)}`)
    flags.push(`${c.code}: run failed`)
    continue
  }
  const { result, reconstruction: r } = out
  const T = r.building.wallThicknessM
  console.log(`  layout: ${r.layout.masses.map((m) => `${m.id}/${m.role} ${f(m.widthM.value)}x${f(m.depthM.value)} s${m.storeySpan.fromIndex}..${m.storeySpan.toIndex}`).join(' | ')}`)
  console.log(`  regions: ${r.layout.footprintRegions.map((x) => `${x.id}[${x.kind}] ${(() => { const xs = x.ring.points.map((p) => p.x); const zs = x.ring.points.map((p) => p.z); return `${f(Math.min(...xs))}..${f(Math.max(...xs))}x${f(Math.min(...zs))}..${f(Math.max(...zs))}` })()}`).join(' | ')}`)
  for (const m of r.building.masses) console.log(`  v2 ${m.id}${m.pieceOf ? ` pieceOf ${m.pieceOf}` : ''}${m.storeyRects ? ' storeyRects' : ''}${m.openSide ? ` open ${m.openSide}` : ''}: ${m.storeys.map((s) => { const q = rectAt(m, s); return `s${s} ${f(q.x0)}..${f(q.x1)}x${f(q.z0)}..${f(q.z1)}${Math.min(q.x1 - q.x0, q.z1 - q.z0) < 2 * (m.wallThicknessM ?? T) ? '!THIN' : ''}` }).join(' ')}`)
  for (const t of r.thinBodies) console.log(`  thin ${t.massId} ${t.narrowAxis} ${f(t.narrowM)} ${t.decision.kind}`)
  console.log(`  preview ${result.preview.outcome} ${result.preview.partial ? JSON.stringify(result.preview.partial.failure).slice(0, 200) : ''}; rings ${result.model.wallRings.map((x) => x.id).join(',')}`)
  for (const u of r.unresolved) if (process.argv.includes('--all') || !/stair|interior|opening|window|door|roof|elevation|view|gap .* on the|chimney|room/i.test(u.what)) console.log(`  gap[${u.status}]: ${u.what.slice(0, 130)} — ${u.reason.slice(0, 170)}`)
  for (const sd of r.planDiagnostics.storeys ?? []) console.log(`  storey ${sd.storeyIndex}: ${sd.decision}; ${sd.why.slice(0, 200)}; regions ${sd.regions.map((g) => `${g.regionId} body=${g.body} ${g.overhang} on[${g.standsOn.join(',')}]`).join(' ; ')}`)
  const bodies = r.building.masses.filter((m) => !m.pieceOf).length
  if (bodies !== c.bodies) flags.push(`${c.code}: ${bodies} bodies (expected ${c.bodies})`)
}
console.log(`\nFLAGS:\n${flags.map((x) => `  - ${x}`).join('\n')}`)
