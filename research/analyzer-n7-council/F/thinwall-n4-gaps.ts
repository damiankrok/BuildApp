import { memoryByteCache } from '@buildapp/source-package'
import { THINWALL, syntheticPublisher } from '@buildapp/synthetic-drawings'
import { runAnalysis } from '../../../packages/analysis-service/src/index.js'
const n = 4
const openings = Array.from({ length: n }, (_, k) => ({ side: 'RIGHT' as const, kind: 'WINDOW' as const, at: 0.4 + k * (5.2 / n), width: Math.min(1.0, 5.2 / n - 0.3), height: 1.2, sill: 0.9, storey: 0 }))
const house = { ...THINWALL, name: 'Thinwall-win4', wings: [{ ...THINWALL.wings![0], openings }] }
const publisher = syntheticPublisher({ projects: [{ code: 'tw-win4', title: 'Thinwall win4', house }] })
const { result } = await runAnalysis({ kind: 'URL', url: publisher.pageUrl('tw-win4') }, { adapters: [publisher.adapter], deps: publisher.deps, cache: memoryByteCache(), now: () => new Date('2026-01-01T00:00:00Z') })
const r = result as any
console.log('outcome', r.preview.outcome, 'unresolved', r.unresolved.length)
for (const u of r.unresolved) console.log(' -', u.what.slice(0, 110), '|', u.reason.slice(0, 90))
