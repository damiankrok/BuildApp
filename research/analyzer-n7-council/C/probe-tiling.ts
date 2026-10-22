/**
 * N7-COUNCIL C. RESEARCH ONLY. Largest-first tiling (`plan-decomposition.ts` mergeRegions) on invented houses whose
 * attached garage is deep enough that main+garage is the largest rectangle: the house's own leftover becomes a strip
 * "body". Prints layout masses, v2 masses per storey (rectAt), thin-body decisions, gate, preview, first refusal.
 *   npx vite-node research/analyzer-n7-council/C/probe-tiling.ts [-- --only CODE]
 */
import { memoryByteCache } from '@buildapp/source-package'
import { HOLLOWAY, syntheticPublisher } from '@buildapp/synthetic-drawings'
import type { SyntheticHouse } from '@buildapp/synthetic-drawings'
import { rectAt } from '../../../packages/reconstruction/src/v2/index.js'
import { runAnalysis } from '../../../packages/analysis-service/src/index.js'

const door = [{ side: 'FRONT' as const, kind: 'DOOR' as const, at: 0.6, width: 2.4, height: 2.1, sill: 0, storey: 0 }]
const g = (depth: number, offsetZ: number, width = 3.6) => ({ name: 'garage', width, depth, offsetZ, storeys: 1, roof: 'FLAT' as const, openings: door })
const houses: Record<string, SyntheticHouse> = {
  'gb-setback-door': { ...HOLLOWAY, name: 'Setback door', chainsZ: [3.9, 6.0, 0.3], wings: [g(6.0, 3.9)] },
  'gb-setback-nodoor': { ...HOLLOWAY, name: 'Setback nodoor', chainsZ: [3.9, 6.0, 0.3], wings: [{ ...g(6.0, 3.9), openings: [] }] },
  'gb-setback-door1': { ...HOLLOWAY, name: 'Setback door 1m', chainsZ: [3.9, 6.0, 0.3], wings: [{ ...g(6.0, 3.9), openings: [{ ...door[0], at: 1.2, width: 1.0 }] }] },
  'gb-flush-door': { ...HOLLOWAY, name: 'Flush door', wings: [g(6.0, 4.2)] },
  't-strip045': { ...HOLLOWAY, name: 'Strip 045', chainsZ: [0.45, 9.75], wings: [g(9.75, 0.45)] },
  't-strip030-rear': { ...HOLLOWAY, name: 'Strip 030 rear', chainsZ: [9.9, 0.3], wings: [g(9.9, 0)] },
  't-strip120': { ...HOLLOWAY, name: 'Strip 120', chainsZ: [1.2, 9.0], wings: [g(9.0, 1.2)] },
  't-two-strip': { ...HOLLOWAY, name: 'Two and strip', depth: 12.0, upperChainsZ: [4.2, 7.8], chainsZ: [1.5, 1.5, 8.6, 0.4], wings: [
    { name: 'store', width: 3.6, depth: 1.5, offsetZ: 0, storeys: 1, roof: 'FLAT', openings: [] }, g(8.6, 3.0)] },
  't-two-strip-b': { ...HOLLOWAY, name: 'Two and strip b', depth: 12.0, upperChainsZ: [4.2, 7.8], chainsZ: [0.5, 8.9, 1.0, 1.6], wings: [
    g(8.9, 0.5), { name: 'store', width: 3.6, depth: 1.6, offsetZ: 10.4, storeys: 1, roof: 'FLAT', openings: [] }] },
}
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : undefined
const codes = Object.keys(houses).filter((c) => !only || c === only)
const publisher = syntheticPublisher({ projects: codes.map((code) => ({ code, title: houses[code].name, house: houses[code] })) })
const f = (n: number): string => n.toFixed(2)
for (const code of codes) {
  console.log(`\n=== ${code}`)
  let out
  try {
    out = await runAnalysis({ kind: 'URL', url: publisher.pageUrl(code) }, { adapters: [publisher.adapter], deps: publisher.deps, cache: memoryByteCache(), now: () => new Date('2026-01-01T00:00:00Z') })
  } catch (e) {
    console.log(`  RUN FAILED ${(e as Error).message.slice(0, 400)}`)
    continue
  }
  const { result, reconstruction: r } = out
  const T = r.building.wallThicknessM
  console.log(`  T ${f(T)}; layout ${r.layout.masses.map((m) => `${m.id}/${m.role} ${f(m.widthM.value)}x${f(m.depthM.value)} s${m.storeySpan.fromIndex}..${m.storeySpan.toIndex}`).join(' | ')}`)
  console.log(`  gate ${r.layout.gate.status}: ${r.layout.gate.reasons.filter((x) => x.severity !== 'NOTED').map((x) => `${x.severity}:${x.code}`).join(',')}`)
  for (const m of r.building.masses) console.log(`  v2 ${m.id}${m.pieceOf ? ` pieceOf ${m.pieceOf}` : ''}${m.storeyRects ? ' storeyRects' : ''}${m.openSide ? ` open ${m.openSide}` : ''}${m.wallThicknessM ? ` t${m.wallThicknessM}` : ''}: ${m.storeys.map((s) => { const q = rectAt(m, s); return `s${s} ${f(q.x0)}..${f(q.x1)}x${f(q.z0)}..${f(q.z1)}${Math.min(q.x1 - q.x0, q.z1 - q.z0) < 2 * (m.wallThicknessM ?? T) ? '!THIN' : ''}` }).join(' ')}`)
  for (const t of r.thinBodies) console.log(`  thin ${t.massId} ${t.narrowAxis} ${f(t.narrowM)} -> ${t.decision.kind}; ${t.hypotheses.filter((h) => h.status === 'SUPPORTED').map((h) => h.kind).join(',')}; ${t.decision.why.slice(0, 150)}`)
  console.log(`  preview ${result.preview.outcome} ${result.preview.partial ? JSON.stringify(result.preview.partial.failure).slice(0, 260) : ''}`)
  if (process.argv.includes('--gaps')) for (const u of r.unresolved) if (!/stair|interior|opening|window|door|elevation|view|chimney|room|pitch|ridge|eaves/i.test(u.what)) console.log(`  gap[${u.status}] ${u.what.slice(0, 140)} — ${u.reason.slice(0, 200)}`)
  if (process.argv.includes('--gaps')) console.log(`  regions ${r.layout.footprintRegions.map((x) => { const xs = x.ring.points.map((p) => p.x); const zs = x.ring.points.map((p) => p.z); return `${x.id}[${x.kind}] ${f(Math.min(...xs))}..${f(Math.max(...xs))}x${f(Math.min(...zs))}..${f(Math.max(...zs))}` }).join(' | ')}`)
  console.log(`  rings ${result.model.wallRings.map((x) => x.id).join(',')}; mainRoof ${r.building.mainRoof ? `${r.building.mainRoof.massId} ${JSON.stringify(r.building.mainRoof.footprint)}` : 'none'}`)
}
