/**
 * N7-FIX-04 (research only, offline): the model built for each invented set-back case — the garage ring's walls and
 * every opening on them (width, offset), the house front wall's openings, and the partial preview's failures if any.
 *   npx vite-node research/analyzer-n7-fix04/probe-model.ts [-- --only CODE,CODE]
 */
import { memoryByteCache } from '@buildapp/source-package'
import { syntheticPublisher } from '@buildapp/synthetic-drawings'
import { runAnalysis } from '../../packages/analysis-service/src/index.js'
import { FIX04_CASES } from './cases.js'

const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : Object.keys(FIX04_CASES)
const publisher = syntheticPublisher({ projects: only.map((code) => ({ code, title: code, house: FIX04_CASES[code] })) })
const f = (n: number): string => n.toFixed(2)
for (const code of only) {
  const { result, reconstruction: r } = await runAnalysis({ kind: 'URL', url: publisher.pageUrl(code) }, { adapters: [publisher.adapter], deps: publisher.deps, cache: memoryByteCache(), now: () => new Date('2026-01-01T00:00:00Z') })
  const m = result.model
  console.log(`=== ${code} ${result.preview.outcome} walls ${m.walls.length} openings ${m.openings.length}`)
  for (const w of m.walls.filter((x) => x.id.startsWith('ring-attached') || x.id === 'ring-main-0-w0' || x.id === 'ring-main-0-w2')) {
    const ops = m.openings.filter((o) => o.wallId === w.id).map((o) => `${o.id} @${f(o.offset)} w${f(o.width)}`)
    console.log(`  ${w.id} ${f(w.start.x)},${f(w.start.z)} -> ${f(w.end.x)},${f(w.end.z)} t${f(w.thickness)} ${ops.join(' ')}`)
  }
  if (process.env.ALLW) console.log(`  all ${m.walls.map((w) => w.id).join(",")}`)
  for (const x of r.partialPreview?.failures ?? []) console.log(`  FAIL ${x.type} ${x.id} ${x.codes.join(',')}`)
}
