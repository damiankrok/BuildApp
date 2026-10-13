#!/usr/bin/env node
/**
 * variant.mjs — BUILDPLAN-ANALYZER-005Q research variants (RESEARCH ONLY; never imported by production).
 *
 *   node research/analyzer-005q/variant.mjs setup --work <dir outside the repo> [--rev <sha>] [--patch <file.patch> ...]
 *
 * A challenger is the base revision's `packages/reconstruction/src` (git archive of --rev, default the 005Q base
 * 04d5568) with zero or more research patches applied (`research/analyzer-005q/candidates/*.patch`), aliased for the
 * replay process by `<work>/vite.config.mjs`. Every other package resolves to the working tree, which the stage never
 * changes outside packages/reconstruction (freeze manifest). The copy lives outside the repository.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO = resolve(import.meta.dirname, '../..')
const arg = (n, f) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : f
}
const all = (n) => process.argv.flatMap((a, i) => (a === `--${n}` ? [process.argv[i + 1]] : []))
if (process.argv[2] !== 'setup') {
  process.stderr.write('usage: variant.mjs setup --work <dir> [--rev <sha>] [--patch <file> ...]\n')
  process.exit(2)
}
const work = resolve(arg('work', ''))
if (!arg('work', '') || work.startsWith(REPO)) throw new Error('a variant copy lives outside the repository')
const rev = arg('rev', '04d5568a4a36d2b850998f2848d06e2179218872')
rmSync(work, { recursive: true, force: true })
mkdirSync(work, { recursive: true })
execFileSync('sh', ['-c', `git archive ${rev} packages/reconstruction/src | tar -x -C '${work}'`], { cwd: REPO })
for (const p of all('patch')) execFileSync('patch', ['-p1', '--forward', '--batch', '-i', resolve(p)], { cwd: work })
const pk = (p) => join(REPO, 'packages', p, 'src/index.ts')
writeFileSync(
  join(work, 'vite.config.mjs'),
  `export default { resolve: { alias: [\n  { find: /^@buildapp\\/reconstruction$/, replacement: '${join(work, 'packages/reconstruction/src/index.ts')}' },\n  { find: /^@buildapp\\/source-common$/, replacement: '${pk('source-common')}' },\n  { find: /^@buildapp\\/source-cv$/, replacement: '${pk('source-cv')}' },\n  { find: /^@buildapp\\/source-metrics$/, replacement: '${pk('source-metrics')}' },\n] } }\n`,
)
process.stdout.write(`variant of ${rev} (+${all('patch').length} patch) at ${work}; config ${join(work, 'vite.config.mjs')}\n`)
