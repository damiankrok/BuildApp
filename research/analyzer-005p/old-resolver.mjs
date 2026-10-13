#!/usr/bin/env node
/**
 * old-resolver.mjs — BUILDPLAN-ANALYZER-005P (RESEARCH ONLY; never imported by production).
 *
 *   node research/analyzer-005p/old-resolver.mjs setup --work <dir outside the repo> [--rev 5906afa]
 *   OFFLINE=1 npx vite-node --config <dir>/vite.config.mjs packages/analysis-service/scripts/second-house.ts -- --package … --graph … --metrics … --cache … --out …
 *
 * The incumbent analyzer for blind round 11's OLD run (holdout/README.md § Round 11, step 5): the 005P production change
 * touches `packages/reconstruction/src` only, so the incumbent is the current tree with that one directory taken from
 * the start revision (`git archive`) and aliased for the replay process. Validated byte-for-byte against the incumbent
 * replays (005O M0 = 005P P0-frozen) on development cases before the freeze.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO = resolve(import.meta.dirname, '../..')
const arg = (n, f) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : f
}
if (process.argv[2] !== 'setup') {
  process.stderr.write('usage: old-resolver.mjs setup --work <dir> [--rev <sha>]\n')
  process.exit(2)
}
const work = resolve(arg('work', '/home/user/work005p/old-5906afa'))
const rev = arg('rev', '5906afa8aad2286e80a733e83ca2c45fb274a23b')
if (work.startsWith(REPO)) throw new Error('the incumbent copy lives outside the repository')
// production outside packages/reconstruction/src must be the start revision's, or this is not the incumbent
const changed = execFileSync('git', ['diff', '--name-only', rev, 'HEAD', '--', 'packages', 'apps'], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean)
const outside = changed.filter((f) => !f.startsWith('packages/reconstruction/src/') && !f.startsWith('packages/reconstruction/test/'))
if (outside.length > 0) throw new Error(`production changed outside packages/reconstruction/src since ${rev}: ${outside.join(', ')}`)
rmSync(work, { recursive: true, force: true })
mkdirSync(work, { recursive: true })
execFileSync('sh', ['-c', `git archive ${rev} packages/reconstruction/src | tar -x -C '${work}'`], { cwd: REPO })
const pk = (p) => join(REPO, 'packages', p, 'src/index.ts')
writeFileSync(
  join(work, 'vite.config.mjs'),
  `export default { resolve: { alias: [\n  { find: /^@buildapp\\/reconstruction$/, replacement: '${join(work, 'packages/reconstruction/src/index.ts')}' },\n  { find: /^@buildapp\\/source-common$/, replacement: '${pk('source-common')}' },\n  { find: /^@buildapp\\/source-cv$/, replacement: '${pk('source-cv')}' },\n  { find: /^@buildapp\\/source-metrics$/, replacement: '${pk('source-metrics')}' },\n] } }\n`,
)
process.stdout.write(`incumbent reconstruction of ${rev} at ${work}; config ${join(work, 'vite.config.mjs')}\n`)
