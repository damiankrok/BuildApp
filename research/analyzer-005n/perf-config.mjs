#!/usr/bin/env node
/**
 * perf-config.mjs — BUILDPLAN-ANALYZER-005N (RESEARCH ONLY): writes, outside the repository, a wrapper that times
 * `compoundSpanOf` into a global meter and a Vite config that swaps it in for `./compound-facade.js` for one perf
 * process (005K's method). The production code is not touched.
 *
 *   node research/analyzer-005n/perf-config.mjs --work <dir>
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO = resolve(import.meta.dirname, '../..')
const i = process.argv.indexOf('--work')
const work = resolve(i >= 0 ? process.argv[i + 1] : '/home/user/work005n/perf')
if (work.startsWith(REPO)) throw new Error('the perf harness lives outside the repository')
mkdirSync(work, { recursive: true })
const real = join(REPO, 'packages/reconstruction/src/compound-facade.ts')
const wrapper = join(work, 'compound-facade.timed.ts')
writeFileSync(wrapper, `export * from '${real}'
import { compoundSpanOf as real } from '${real}'
const meter = globalThis as { __compound005n?: { ms: number; spans: number } }
meter.__compound005n = { ms: 0, spans: 0 }
export function compoundSpanOf(ctx: any, parent: any) {
  const t0 = performance.now()
  const s = real(ctx, parent)
  if (meter.__compound005n) { meter.__compound005n.ms += performance.now() - t0; if (s) meter.__compound005n.spans += 1 }
  return s
}
`)
const pk = (p) => join(REPO, 'packages', p, 'src/index.ts')
writeFileSync(join(work, 'vite.config.mjs'), `export default { resolve: { alias: [\n  { find: /^\\.\\/compound-facade\\.js$/, replacement: '${wrapper}' },\n  { find: /^@buildapp\\/source-common$/, replacement: '${pk('source-common')}' },\n  { find: /^@buildapp\\/source-cv$/, replacement: '${pk('source-cv')}' },\n] } }\n`)
process.stdout.write(`wrote ${wrapper}\n`)
