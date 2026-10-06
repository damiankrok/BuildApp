#!/usr/bin/env node
/**
 * constant-replay.mjs — BUILDPLAN-ANALYZER-005K: the CONSTANT control, replayed (RESEARCH ONLY).
 *
 *   node research/analyzer-005k/constant-replay.mjs setup --work <dir>
 *   ... then: npx vite-node --config <dir>/vite.config.mjs packages/analysis-service/scripts/second-house.ts -- ... --drawn-gap-rule ON
 *
 * The deliberate naive control (brief §18): EVERY eligible drawn weak gap — WEAK, two WALL jambs, drawn evidence — is an
 * OPENING (STRONG). It is never a candidate and never enters the repository's code: this writes, outside the
 * repository, a copy of `boundary-evidence.ts` whose ON branch upgrades on `wallJambs && drawn` instead of the rule's
 * full `eligible`, and a Vite config that swaps the copy in for one replay process only (005J's method).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO = resolve(import.meta.dirname, '../..')
const i = process.argv.indexOf('--work')
const work = resolve(i >= 0 ? process.argv[i + 1] : '/home/user/work005k/constant')
const RULE = "if (options.drawnGapRule === 'ON' && trace.drawnGapRule?.eligible) {"
const CONSTANT = "if (options.drawnGapRule === 'ON' && trace.drawnGapRule?.wallJambs === true && trace.drawnGapRule.drawn) { // 005K CONSTANT control (replay only)"

if (process.argv[2] !== 'setup') {
  process.stderr.write('usage: constant-replay.mjs setup --work <dir>\n')
  process.exit(2)
}
const source = readFileSync(join(REPO, 'packages/reconstruction/src/boundary-evidence.ts'), 'utf8')
if (source.split(RULE).length !== 2) throw new Error('the rule branch changed — update the control')
mkdirSync(work, { recursive: true })
const copy = join(work, 'boundary-evidence.constant.ts')
// the copy's relative imports are package imports, so it resolves from anywhere
writeFileSync(copy, source.replace(RULE, CONSTANT))
const pk = (p) => join(REPO, 'packages', p, 'src/index.ts')
writeFileSync(
  join(work, 'vite.config.mjs'),
  `export default { resolve: { alias: [\n  { find: /^\\.\\/boundary-evidence\\.js$/, replacement: '${copy}' },\n  { find: /^@buildapp\\/source-common$/, replacement: '${pk('source-common')}' },\n  { find: /^@buildapp\\/source-cv$/, replacement: '${pk('source-cv')}' },\n] } }\n`,
)
process.stdout.write(`wrote ${copy} and ${join(work, 'vite.config.mjs')}\n`)
