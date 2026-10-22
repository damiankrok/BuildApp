/**
 * Council D, end to end through runAnalysis: invented houses whose upper storey stands on the body in a strip narrower
 * than two walls (a storeyRect < 2T). Invented dimensions; a reconstruction of nothing.
 *   npx vite-node research/analyzer-n7-council/D/e2e-storeyrect.ts
 */
import { memoryByteCache } from '@buildapp/source-package'
import { REDMIRE, syntheticPublisher } from '@buildapp/synthetic-drawings'
import type { SyntheticHouse } from '../../../packages/synthetic-drawings/src/house.js'
import { runAnalysis } from '../../../packages/analysis-service/src/index.js'

const depths = (process.argv.find((a) => a.startsWith('--d='))?.slice(4) ?? '0.4').split(',').map(Number)
const houses = depths.map((d) => ({ code: `strip-${Math.round(d * 100)}`, title: `Strip ${d}`, house: { ...REDMIRE, name: `Council strip ${d}`, recesses: [], upperInset: { minZ: Math.round((8.1 - d) * 100) / 100 }, upperChainsZ: [d], upperChainsX: [4.5, 6.0] } as SyntheticHouse }))
const publisher = syntheticPublisher({ projects: houses })
for (const code of houses.map((h) => h.code)) {
  try {
    const { result, reconstruction } = await runAnalysis({ kind: 'URL', url: publisher.pageUrl(code) }, { adapters: [publisher.adapter], deps: publisher.deps, cache: memoryByteCache(), now: () => new Date('2026-01-01T00:00:00Z') })
    const b = reconstruction.building
    console.log(`== ${code}: outcome ${result.preview.outcome}`)
    console.log('  T', b.wallThicknessM, 'masses', JSON.stringify(b.masses.map((m) => ({ id: m.id, role: m.role, x: [m.x0, m.x1], z: [m.z0, m.z1], storeys: m.storeys, storeyRects: m.storeyRects, pieceOf: m.pieceOf }))))
    console.log('  thinBodies', JSON.stringify(reconstruction.thinBodies.map((t) => ({ id: t.massId, d: t.decision.kind }))))
    console.log('  failure', JSON.stringify(result.preview.partial?.failure ?? null))
    console.log('  rings', result.model.wallRings.map((r) => r.id).join(','), 'slabs', result.model.slabs.map((s) => s.id).join(','), 'walls', result.model.walls.length, 'openings', result.model.openings.length)
    console.log('  skipped', JSON.stringify((reconstruction.partialPreview?.skipped ?? []).map((s) => `${s.commandIndex}:${s.id}:${s.cause}`)))
  } catch (e) {
    console.log(`== ${code}: THREW`, (e as Error).message.slice(0, 400))
  }
}
