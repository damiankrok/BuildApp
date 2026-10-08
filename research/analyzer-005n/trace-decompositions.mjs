#!/usr/bin/env node
/**
 * trace-decompositions.mjs — BUILDPLAN-ANALYZER-005N baseline forensics (RESEARCH ONLY; never imported by production).
 *
 *   node research/analyzer-005n/trace-decompositions.mjs setup --work <dir>
 *   TRACE_005N_OUT=<file.ndjson> npx vite-node --config <dir>/vite.config.mjs packages/analysis-service/scripts/second-house.ts -- ...
 *
 * 005K's method: a Vite config, written outside the repository, swaps a wrapper in for `./plan-decomposition.js` for
 * one replay process. The wrapper re-exports the real module and, for every `decomposePlan` call of every reading the
 * pipeline and the resolver weigh, appends one record: the reading's frame, extent, scale, wall thickness, envelope,
 * grid, wide openings, bays, regions, the boundary record's bodies and acceptance, and (re-read with the real
 * `boundaryExtension`) every wall line's pieces and gaps. Numbers and ids only; no pixel leaves the process.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO = resolve(import.meta.dirname, '../..')
const i = process.argv.indexOf('--work')
const work = resolve(i >= 0 ? process.argv[i + 1] : '/home/user/work005n/trace')
if (process.argv[2] !== 'setup') {
  process.stderr.write('usage: trace-decompositions.mjs setup --work <dir>\n')
  process.exit(2)
}
if (work.startsWith(REPO)) throw new Error('the trace harness lives outside the repository')
mkdirSync(work, { recursive: true })
const real = join(REPO, 'packages/reconstruction/src/plan-decomposition.ts')
const wrapper = join(work, 'plan-decomposition.trace.ts')
const record = join(REPO, 'research/analyzer-005n/trace-record.ts')
writeFileSync(
  wrapper,
  `export * from '${real}'
import { decomposePlan as realDecompose } from '${real}'
import { traceRecord } from '${record}'
import { appendFileSync } from 'node:fs'
const OUT = process.env.TRACE_005N_OUT
const seen = new Set<string>()
export function decomposePlan(mask: any, chains: any, bands: any, registration: any, extent: any, options: any = {}) {
  const d = realDecompose(mask, chains, bands, registration, extent, options)
  if (!OUT) return d
  try {
    const rec = traceRecord(mask, chains, bands, registration, extent, options, d)
    if (seen.has(rec.key as string)) return d
    seen.add(rec.key as string)
    appendFileSync(OUT, JSON.stringify(rec) + '\\n')
  } catch (e) {
    appendFileSync(OUT, JSON.stringify({ error: String(e) }) + '\\n')
  }
  return d
}
`,
)
const pk = (p) => join(REPO, 'packages', p, 'src/index.ts')
writeFileSync(
  join(work, 'vite.config.mjs'),
  `export default { resolve: { alias: [\n  { find: /^\\.\\/plan-decomposition\\.js$/, replacement: '${wrapper}' },\n  { find: /^@buildapp\\/source-common$/, replacement: '${pk('source-common')}' },\n  { find: /^@buildapp\\/source-cv$/, replacement: '${pk('source-cv')}' },\n] } }\n`,
)
process.stdout.write(`wrote ${wrapper} and ${join(work, 'vite.config.mjs')}\n`)
