/**
 * N7-COUNCIL-FIX-02 (research only, offline): what the production service reads for a few invented houses — the
 * exterior wall, each body's wall, the bodies, the rings and the outcome. Prints JSON; writes nothing.
 *   npx vite-node research/analyzer-n7-fix02/probe-synthetic.ts
 */
import { memoryByteCache } from '@buildapp/source-package'
import { ELMBRIDGE, HOLLOWAY, THINWALL, SLIVERTON, syntheticPublisher } from '@buildapp/synthetic-drawings'
import type { SyntheticHouse } from '@buildapp/synthetic-drawings'
import { runAnalysis } from '../../packages/analysis-service/src/index.js'
import { FIX02_HOUSES } from './houses.js'

const projects = Object.entries(FIX02_HOUSES).map(([code, house]) => ({ code, title: house.name, house }))
const publisher = syntheticPublisher({ projects })
for (const { code } of projects) {
  try {
    const { result, reconstruction } = await runAnalysis({ kind: 'URL', url: publisher.pageUrl(code) }, { adapters: [publisher.adapter], deps: publisher.deps, cache: memoryByteCache(), now: () => new Date('2026-01-01T00:00:00Z') })
    const rings = result.model.wallRings.map((r) => ({ id: r.id, t: result.model.walls.find((w) => w.id === r.wallIds[0])?.thickness }))
    console.log(JSON.stringify({ code, outcome: result.preview.outcome, T: reconstruction.building.wallThicknessM, house: reconstruction.wallThickness?.house && { m: reconstruction.wallThickness.house.m, source: reconstruction.wallThickness.house.source, faces: reconstruction.wallThickness.house.faces }, bodies: (reconstruction.wallThickness?.bodies ?? []).map((b) => ({ id: b.massId, m: b.reading.m })), masses: reconstruction.building.masses.map((m) => `${m.id} ${(m.x1 - m.x0).toFixed(2)}x${(m.z1 - m.z0).toFixed(2)} t=${m.wallThicknessM ?? '-'}`), rings, thin: reconstruction.thinBodies.map((t) => `${t.massId}:${t.decision.kind}`), preEmit: (reconstruction.preEmitRings ?? []).map((c) => `${c.massId}/${c.storeyIndex} ${c.kind} ${c.verdict}`), failures: result.preview.partial?.failures?.map((f) => f.message.slice(0, 90)) ?? [], interior: result.model.walls.filter((w) => w.kind === 'INTERIOR').length, openings: result.model.openings.length }))
  } catch (e) {
    console.log(JSON.stringify({ code, error: String(e).slice(0, 300) }))
  }
}
void ELMBRIDGE; void HOLLOWAY; void THINWALL; void SLIVERTON
