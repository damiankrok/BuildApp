/** N7-FIX-01 research: where THINWALL + n windows loses (or keeps) the wing, layout level. */
import { memoryByteCache } from '@buildapp/source-package'
import { THINWALL, syntheticPublisher } from '@buildapp/synthetic-drawings'
import { runAnalysis } from '../../packages/analysis-service/src/index.js'
const n = Number(process.argv.find((a) => a.startsWith('--n='))?.slice(4) ?? 2)
const openings = Array.from({ length: n }, (_, k) => ({ side: 'RIGHT' as const, kind: 'WINDOW' as const, at: 0.4 + k * (5.2 / n), width: Math.min(1.0, 5.2 / n - 0.3), height: 1.2, sill: 0.9, storey: 0 }))
const house = { ...THINWALL, name: 'Thinwall-win', wings: [{ ...THINWALL.wings![0], openings }] }
const publisher = syntheticPublisher({ projects: [{ code: 'tw-win', title: 'Thinwall win', house }] })
const { reconstruction } = await runAnalysis({ kind: 'URL', url: publisher.pageUrl('tw-win') }, { adapters: [publisher.adapter], deps: publisher.deps, cache: memoryByteCache(), now: () => new Date('2026-01-01T00:00:00Z') })
const L = (reconstruction as any).layout
console.log('masses', L.masses.map((m: any) => `${m.id} ${m.role} ${JSON.stringify(m.bounds ?? m.rect ?? '')} why=${String(m.why).slice(0, 120)}`))
console.log('regions', L.footprintRegions.map((r: any) => `${r.id} ${r.kind}`))
console.log('unresolved', L.unresolved.map((u: any) => `${u.what} | ${String(u.reason).slice(0, 140)}`))
console.log('gate', JSON.stringify(L.gate.reasons.map((g: any) => `${g.code}:${g.severity}`)))
for (const t of (L.traces ?? []).slice(0, 80)) { const s = JSON.stringify(t); if (/attach|wing|region|cell|outline|boundary|completion/i.test(s)) console.log('trace', s.slice(0, 300)) }
const B = (reconstruction as any).building
console.log('building keys', Object.keys(B))
console.log('recesses', JSON.stringify(B.recesses?.map((r: any) => ({ side: r.side, depth: r.depthM, returns: r.returns?.length, why: String(r.why).slice(0, 200) }))))
console.log('returns', JSON.stringify(B.returns))
const Lz = L.footprintRegions.find((r: any) => r.kind === 'ZONE')
if (Lz) console.log('zone', JSON.stringify(Lz).slice(0, 600))
