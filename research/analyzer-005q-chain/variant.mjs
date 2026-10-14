#!/usr/bin/env node
/**
 * variant.mjs — BUILDPLAN-ANALYZER-005Q-CHAIN research variants (RESEARCH ONLY; never imported by production).
 *
 *   node research/analyzer-005q-chain/variant.mjs setup --work <dir outside the repo> [--rev <sha>] [--patch <file.patch> ...]
 *
 * A challenger is the base revision's `packages/source-metrics/src` and `packages/reconstruction/src` (git archive of
 * --rev, default the 005Q-CHAIN base cd0c513) with zero or more research patches applied (`-p1`, paths relative to the
 * repository root, e.g. `packages/source-metrics/src/extract.ts`), aliased for the replay process by
 * `<work>/vite.config.mjs`. Every other package resolves to the working tree, which the stage never changes (freeze
 * manifest). The recogniser worker imports only TYPES from source-metrics, so the swap cannot reach the OCR model.
 * The copy lives outside the repository; nothing here is imported by production.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO = resolve(import.meta.dirname, '../..')
const BASE = 'cd0c513bcbbb5a00dc7115c887daada1800f9172'
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
execFileSync('sh', ['-c', `git archive ${rev} packages/source-metrics/src packages/reconstruction/src | tar -x -C '${work}'`], { cwd: REPO })
const patches = all('patch').map((p) => resolve(p))
for (const p of patches) execFileSync('patch', ['-p1', '--forward', '--batch', '-i', p], { cwd: work })
const pk = (p) => join(REPO, 'packages', p, 'src/index.ts')
writeFileSync(
  join(work, 'vite.config.mjs'),
  `export default { resolve: { alias: [\n` +
    `  { find: /^@buildapp\\/source-metrics$/, replacement: '${join(work, 'packages/source-metrics/src/index.ts')}' },\n` +
    `  { find: /^@buildapp\\/reconstruction$/, replacement: '${join(work, 'packages/reconstruction/src/index.ts')}' },\n` +
    `  { find: /^@buildapp\\/source-common$/, replacement: '${pk('source-common')}' },\n` +
    `  { find: /^@buildapp\\/source-cv$/, replacement: '${pk('source-cv')}' },\n` +
    `] } }\n`,
)
const sha = (b) => createHash('sha256').update(b).digest('hex')
writeFileSync(join(work, 'variant.json'), JSON.stringify({ rev, patches: patches.map((p) => ({ file: p, sha256: sha(readFileSync(p)) })) }, null, 1) + '\n')
process.stdout.write(`variant of ${rev} (+${patches.length} patch) at ${work}; config ${join(work, 'vite.config.mjs')}\n`)
