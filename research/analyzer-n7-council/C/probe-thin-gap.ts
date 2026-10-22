/**
 * N7-COUNCIL C. RESEARCH ONLY. `thinBodies` (v2/thin-body.ts) looks at the body's measured rectangle only, and skips any
 * body that has `storeyRects`: a ring built from `rectAt(m, s)` narrower than 2T on some storey is never adjudicated.
 *   npx vite-node research/analyzer-n7-council/C/probe-thin-gap.ts
 */
import { rectAt, thinBodies } from '../../../packages/reconstruction/src/v2/index.js'
import type { MassV2 } from '../../../packages/reconstruction/src/v2/index.js'

const T = 0.3
const base = { role: 'ATTACHED' as const, featureId: 'f', sourceMassId: 'mass-2' }
const cases: Array<{ name: string; m: MassV2 }> = [
  { name: 'A thin measured body, no storeyRects (control)', m: { ...base, id: 'attached-1', x0: 8.4, x1: 8.85, z0: 0, z1: 2.7, storeys: [0] } as MassV2 },
  { name: 'B thin measured body (storey 0) that also has a storeyRect on storey 1', m: { ...base, id: 'attached-1', x0: 8.4, x1: 8.85, z0: 0, z1: 2.7, storeys: [0, 1], storeyRects: [{ storey: 1, x0: 8.4, x1: 8.85, z0: 0, z1: 2.0 }] } as MassV2 },
  { name: 'C wide measured body (storey 1), thin storeyRect on storey 0', m: { ...base, id: 'attached-1', x0: 8.4, x1: 12.0, z0: 0, z1: 2.7, storeys: [0, 1], storeyRects: [{ storey: 0, x0: 8.4, x1: 8.85, z0: 0, z1: 2.7 }] } as MassV2 },
  { name: 'D thin piece of a storey (pieceOf)', m: { ...base, id: 'attached-1-s0-1', x0: 8.4, x1: 8.85, z0: 0, z1: 2.7, storeys: [0], pieceOf: 'attached-1' } as MassV2 },
]
let gaps = 0
for (const { name, m } of cases) {
  const seen = thinBodies([m], T).length > 0
  const thin = m.storeys.filter((s) => { const r = rectAt(m, s); return Math.min(r.x1 - r.x0, r.z1 - r.z0) < 2 * T })
  const gap = thin.length > 0 && !seen
  if (gap) gaps += 1
  console.log(`${name}: rings thin on storeys [${thin.join(',')}], thinBodies ${seen ? 'ADJUDICATES' : 'SKIPS'}${gap ? '  <-- COVERAGE GAP' : ''}`)
}
if (gaps !== 3) throw new Error(`expected 3 coverage gaps, got ${gaps}`)
console.log('OK: 3 of 4 thin rings never reach adjudication')
