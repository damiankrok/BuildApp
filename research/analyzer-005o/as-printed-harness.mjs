#!/usr/bin/env node
/**
 * as-printed-harness.mjs — BUILDPLAN-ANALYZER-005O (RESEARCH ONLY; never imported by production).
 *
 *   node research/analyzer-005o/as-printed-harness.mjs setup --work <dir outside the repo>
 *   AS_PRINTED_VIEW_005O=<view.json> npx vite-node --config <dir>/vite.config.mjs packages/analysis-service/scripts/second-house.ts -- ...
 *
 * 005K/005N's method: a Vite config written outside the repository swaps, for one replay process, a copy of
 * `plan-resolution.ts` for the real module. The copy differs from the frozen file in exactly one place, the
 * "as printed" view of a statement (what `zeroSubstitution` and `asRead` return): when the environment names a view
 * file and the view has an entry for a statement's evidence id, the statement's readings are the view's two lists:
 * `zero` (what the frozen `zeroSubstitution` returns: readings made without a substitution) and `asRead` (what the
 * frozen `asRead` returns: those, less a READ value whose way up a scale chose). Empty lists = the statement states
 * nothing as printed. Everything else - registration, re-reading at another scale
 * (`metricsAtScale`, which keeps the reader's own first reading), scoring, the published-figure rules - is the frozen
 * code. Without the variable, or with an empty view, the copy behaves as the frozen file (checked by the M0 control).
 *
 * The patch is applied by exact text replacement and fails loudly if the frozen anchor text is not found.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO = resolve(import.meta.dirname, '../..')
const i = process.argv.indexOf('--work')
const work = resolve(i >= 0 ? process.argv[i + 1] : '/home/user/work005o/harness')
if (process.argv[2] !== 'setup') {
  process.stderr.write('usage: as-printed-harness.mjs setup --work <dir>\n')
  process.exit(2)
}
if (work.startsWith(REPO)) throw new Error('the harness lives outside the repository')
mkdirSync(work, { recursive: true })
const SRC = join(REPO, 'packages/reconstruction/src')
let text = readFileSync(join(SRC, 'plan-resolution.ts'), 'utf8')

const replace = (from, to) => {
  const n = text.split(from).length - 1
  if (n !== 1) throw new Error(`anchor found ${n} times: ${from.slice(0, 80)}`)
  text = text.replace(from, to)
}
// relative imports -> the frozen package's own files (one module instance with the rest of the package)
text = text.replace(/from '\.\/([a-z0-9/-]+)\.js'/g, (_, p) => `from '${join(SRC, p)}.ts'`)
replace(
  "type Statement = { evidence: MetricEvidence; axis: 'X' | 'Y'; pixelLength: number; firstReadCm?: number }",
  `type Statement = { evidence: MetricEvidence; axis: 'X' | 'Y'; pixelLength: number; firstReadCm?: number; printed?: { zero: number[]; asRead: number[] } }
// 005O research harness: the as-printed view under test (absent = the frozen behaviour).
import { readFileSync as __read005o } from 'node:fs'
const VIEW_005O: Record<string, { zero: number[]; asRead: number[] }> = process.env.AS_PRINTED_VIEW_005O ? JSON.parse(__read005o(process.env.AS_PRINTED_VIEW_005O, 'utf8')).view : {}`,
)
replace(
  "      out.push({ evidence, axis: chain.axis === 'HORIZONTAL' ? 'X' : 'Y', pixelLength: segment.pixelLength, firstReadCm })",
  "      out.push({ evidence, axis: chain.axis === 'HORIZONTAL' ? 'X' : 'Y', pixelLength: segment.pixelLength, firstReadCm, ...(Object.prototype.hasOwnProperty.call(VIEW_005O, evidence.id) ? { printed: VIEW_005O[evidence.id] } : {}) })",
)
replace(
  'const zeroSubstitution = (s: Statement): number[] => (s.evidence.origin',
  'const zeroSubstitution = (s: Statement): number[] => s.printed !== undefined ? [...s.printed.zero] : (s.evidence.origin',
)
replace(
  'const asRead = (s: Statement): number[] => (s.evidence.origin',
  'const asRead = (s: Statement): number[] => s.printed !== undefined ? [...s.printed.asRead] : (s.evidence.origin',
)
const patched = join(work, 'plan-resolution.as-printed.ts')
writeFileSync(patched, text)
const pk = (p) => join(REPO, 'packages', p, 'src/index.ts')
writeFileSync(
  join(work, 'vite.config.mjs'),
  `export default { resolve: { alias: [\n  { find: /^\\.\\.?\\/plan-resolution\\.js$/, replacement: '${patched}' },\n  { find: /^@buildapp\\/source-common$/, replacement: '${pk('source-common')}' },\n  { find: /^@buildapp\\/source-cv$/, replacement: '${pk('source-cv')}' },\n  { find: /^@buildapp\\/source-metrics$/, replacement: '${pk('source-metrics')}' },\n] } }\n`,
)
process.stdout.write(`wrote ${patched} and ${join(work, 'vite.config.mjs')}\n`)
