#!/usr/bin/env node
/**
 * variant.mjs — BUILDPLAN-ANALYZER-005R-ROUTER research variants (RESEARCH ONLY; never imported by production).
 *
 *   node research/analyzer-005r-router/variant.mjs setup --work <dir outside the repo> [--rev <sha>] [--patch <file> ...]
 *
 * A challenger is the base revision's `packages/source-analyzer/src` (git archive of --rev, default the 005R-ROUTER
 * base 8d41456) with zero or more research patches applied (`-p1`), aliased for a replay process by
 * `<work>/vite.config.mjs`. Every other package resolves to the working tree, which the freeze manifest pins.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO = resolve(import.meta.dirname, '../..')
const BASE = '8d414567e16e9a790bcf56cbebc10d778c6eb268'
const DEPS = ['source-common', 'source-cv', 'source-observations', 'source-package', 'source-vision']
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
if (!arg('work', '') || work === REPO || work.startsWith(REPO + '/')) throw new Error('a variant copy lives outside the repository')
const rev = arg('rev', BASE)
rmSync(work, { recursive: true, force: true })
mkdirSync(work, { recursive: true })
execFileSync('sh', ['-c', `git archive ${rev} packages/source-analyzer/src | tar -x -C '${work}'`], { cwd: REPO })
const patches = all('patch').map((p) => resolve(p))
for (const p of patches) execFileSync('patch', ['-p1', '--forward', '--batch', '-i', p], { cwd: work })
writeFileSync(
  join(work, 'vite.config.mjs'),
  `export default { resolve: { alias: [\n` +
    `  { find: /^@buildapp\\/source-analyzer$/, replacement: '${join(work, 'packages/source-analyzer/src/index.ts')}' },\n` +
    // the copy lives outside the repository, so its own imports cannot walk up to the workspace's node_modules
    DEPS.map((d) => `  { find: /^@buildapp\\/${d}$/, replacement: '${join(REPO, 'packages', d, 'src/index.ts')}' },\n`).join('') +
    `] } }\n`,
)
const sha = (b) => createHash('sha256').update(b).digest('hex')
writeFileSync(join(work, 'variant.json'), JSON.stringify({ rev, patches: patches.map((p) => ({ file: p, sha256: sha(readFileSync(p)) })) }, null, 1) + '\n')
process.stdout.write(`variant of ${rev} (+${patches.length} patch) at ${work}; config ${join(work, 'vite.config.mjs')}\n`)
