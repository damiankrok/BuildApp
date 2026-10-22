/**
 * Council D, end to end through runAnalysis: invented HOLLOWAY variants whose one-storey wing is just over / under two
 * walls wide. Prints what thinBodies decided, what the reconciliation did, and what the preview refused.
 *   npx vite-node research/analyzer-n7-council/D/e2e-wing.ts -- --w=0.62,0.66
 */
import { memoryByteCache } from '@buildapp/source-package'
import { HOLLOWAY, syntheticPublisher } from '@buildapp/synthetic-drawings'
import type { SyntheticHouse } from '../../../packages/synthetic-drawings/src/house.js'
import { runAnalysis } from '../../../packages/analysis-service/src/index.js'
import { emitBuilding } from '../../../packages/reconstruction/src/v2/emit.js'
import { reconcileWallOverlaps } from '../../../packages/reconstruction/src/candidate.js'

const ws = (process.argv.find((a) => a.startsWith('--w='))?.slice(4) ?? '0.62').split(',').map(Number)
const houses = ws.map((w) => ({ code: `wing-${Math.round(w * 100)}`, title: `Wing ${w}`, house: { ...HOLLOWAY, name: `Council wing ${w}`, chainsX: [8.4, w], wings: [{ name: 'wing', width: w, depth: 6.0, offsetZ: 4.2, storeys: 1, roof: 'FLAT', openings: [] }] } as SyntheticHouse }))
const publisher = syntheticPublisher({ projects: houses })
for (const h of houses) {
  try {
    const { result, reconstruction } = await runAnalysis({ kind: 'URL', url: publisher.pageUrl(h.code) }, { adapters: [publisher.adapter], deps: publisher.deps, cache: memoryByteCache(), now: () => new Date('2026-01-01T00:00:00Z') })
    const b = reconstruction.building
    console.log(`== ${h.code}: outcome ${result.preview.outcome}  T ${b.wallThicknessM}`)
    console.log('  masses', JSON.stringify(b.masses.map((m) => ({ id: m.id, x: [m.x0, m.x1], z: [m.z0, m.z1], w: +(m.x1 - m.x0).toFixed(4), openSide: m.openSide, t: m.wallThicknessM }))))
    console.log('  thinBodies', JSON.stringify(reconstruction.thinBodies.map((t) => ({ id: t.massId, d: t.decision.kind, why: t.decision.why.slice(0, 160) }))))
    console.log('  failure', JSON.stringify(result.preview.partial?.failure ?? null))
    console.log('  reported reconciliation', JSON.stringify(reconstruction.wallReconciliation ? (reconstruction.wallReconciliation as { records?: Array<{ wallId: string; action: string; moveM: number }> }).records?.map((r) => `${r.wallId}:${r.action}:${r.moveM}`) : null))
    // replay the first attempt's reconciliation on the emitted program to see what the report dropped
    const prog = emitBuilding(b, 'x').program
    const rec = reconcileWallOverlaps(prog, 'x', 'm', { toleranceM: 3 * Math.max(...reconstruction.registrations.plans.map((p) => Math.max(p.mppX, p.mppY))) })
    console.log('  first-attempt reconciliation', JSON.stringify({ ok: rec.ok, records: rec.records.map((r) => `${r.wallId}<-${r.otherWallId}:${r.action}:${r.moveM}`), err: rec.ok ? null : rec.errors[0]?.message.slice(0, 120) }))
    console.log('  rings', result.model.wallRings.map((r) => r.id).join(','), 'walls', result.model.walls.length)
  } catch (e) {
    console.log(`== ${h.code}: THREW`, (e as Error).message.slice(0, 300))
  }
}
