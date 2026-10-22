/**
 * N7-COUNCIL C. RESEARCH ONLY. An attached one-storey garage running the full depth of a two-storey house: what the
 * model builds (bodies, rings, roof planes, walls on the line between house and garage).
 *   npx vite-node research/analyzer-n7-council/C/probe-merge.ts
 */
import { memoryByteCache } from '@buildapp/source-package'
import { HOLLOWAY, syntheticPublisher } from '@buildapp/synthetic-drawings'
import type { SyntheticHouse } from '@buildapp/synthetic-drawings'
import { runAnalysis } from '../../../packages/analysis-service/src/index.js'

const garageDoor = [{ side: 'FRONT' as const, kind: 'DOOR' as const, at: 0.6, width: 2.4, height: 2.1, sill: 0, storey: 0 }]
const houses: Record<string, SyntheticHouse> = {
  'm-full': { ...HOLLOWAY, name: 'Full depth garage', chainsZ: [10.2], wings: [{ name: 'garage', width: 3.6, depth: 10.2, offsetZ: 0, storeys: 1, roof: 'FLAT', openings: garageDoor }] },
  'm-holloway': HOLLOWAY,
  'm-deep9': { ...HOLLOWAY, name: 'Garage 9m', chainsZ: [1.2, 9.0], wings: [{ name: 'garage', width: 3.6, depth: 9.0, offsetZ: 1.2, storeys: 1, roof: 'FLAT', openings: garageDoor }] },
  'm-wide6': { ...HOLLOWAY, name: 'Garage 6 wide', chainsX: [8.4, 6.0], wings: [{ name: 'garage', width: 6.0, depth: 8.0, offsetZ: 2.2, storeys: 1, roof: 'FLAT', openings: garageDoor }], chainsZ: [2.2, 8.0] },
}
const publisher = syntheticPublisher({ projects: Object.entries(houses).map(([code, house]) => ({ code, title: house.name, house })) })
for (const code of Object.keys(houses)) {
  const { result, reconstruction: r } = await runAnalysis({ kind: 'URL', url: publisher.pageUrl(code) }, { adapters: [publisher.adapter], deps: publisher.deps, cache: memoryByteCache(), now: () => new Date('2026-01-01T00:00:00Z') })
  const m = result.model
  console.log(`\n=== ${code}: bodies ${r.building.masses.map((x) => `${x.id} ${x.x0.toFixed(2)}..${x.x1.toFixed(2)}x${x.z0.toFixed(2)}..${x.z1.toFixed(2)} s${x.storeys.join(',')}${x.storeyRects ? ` sr${JSON.stringify(x.storeyRects.map((q) => [q.storey, q.x0, q.x1]))}` : ''}`).join(' | ')}`)
  console.log(`  gate ${r.layout.gate.status} ${r.layout.gate.reasons.map((g) => `${g.severity}:${g.code}`).join(',')}`)
  console.log(`  rings ${m.wallRings.map((w) => w.id).join(',')}; slabs ${m.slabs.map((s) => s.id).join(',')}; roofs ${(m as { roofs?: Array<{ id: string }> }).roofs?.map((x) => x.id).join(',') ?? '-'} planes ${(m as { roofPlanes?: Array<{ id: string }> }).roofPlanes?.length ?? '-'}`)
  console.log(`  mainRoof ${JSON.stringify(r.building.mainRoof ? { massId: r.building.mainRoof.massId, ridgeAxis: r.building.mainRoof.ridgeAxis, footprint: r.building.mainRoof.footprint } : null)}; attachedRoofs ${r.building.attachedRoofs.map((a) => a.massId).join(',')}`)
  const line = m.walls.filter((w) => Math.abs(w.start.x - 8.4) < 0.3 && Math.abs(w.end.x - 8.4) < 0.3)
  console.log(`  walls on x≈8.4: ${line.map((w) => `${w.id} ${w.kind} t${w.thickness}`).join(', ') || 'none'}; total walls ${m.walls.length}`)
}
