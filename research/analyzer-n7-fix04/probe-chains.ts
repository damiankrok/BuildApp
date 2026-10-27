/**
 * N7-FIX-04 (research only, offline): the dimension chains the plan of each invented case reads — every segment's
 * pixels, value and origin — and the layout's ladder of the base plan. Writes nothing.
 *   npx vite-node research/analyzer-n7-fix04/probe-chains.ts -- --only CODE
 */
import { memoryByteCache } from '@buildapp/source-package'
import { syntheticPublisher } from '@buildapp/synthetic-drawings'
import { runAnalysis } from '../../packages/analysis-service/src/index.js'
import { FIX04_CASES } from './cases.js'

const only = process.argv[process.argv.indexOf('--only') + 1]
const publisher = syntheticPublisher({ projects: [{ code: only, title: only, house: FIX04_CASES[only] }] })
const out = await runAnalysis({ kind: 'URL', url: publisher.pageUrl(only) }, { adapters: [publisher.adapter], deps: publisher.deps, cache: memoryByteCache(), now: () => new Date('2026-01-01T00:00:00Z') })
const sel = out.reconstruction.planDiagnostics.selectedPlanFrameId
for (const c of out.metrics.chains.filter((x) => x.frameId === sel)) console.log(`${c.id} ${c.axis} ticks ${c.ticksPx.map((t) => t.toFixed(1)).join(',')} | ${c.segments.map((s) => `${s.fromPx.toFixed(1)}-${s.toPx.toFixed(1)}:${s.valueCm ?? '?'}/${s.origin}`).join(' ')}`)
