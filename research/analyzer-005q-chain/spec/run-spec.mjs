#!/usr/bin/env node
/**
 * run-spec.mjs — run one 005Q-CHAIN spec against a variant copy (RESEARCH ONLY).
 *   node research/analyzer-005q-chain/spec/run-spec.mjs --variant <dir with packages/source-metrics/src> --spec c1|c2
 * Writes a vitest config OUTSIDE the repository aliasing @buildapp/source-metrics to the variant copy, and runs only the
 * named spec. Exit code is vitest's.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
const REPO = resolve(import.meta.dirname, '../../..')
const arg = (n) => process.argv[process.argv.indexOf(`--${n}`) + 1]
const variant = resolve(arg('variant'))
const spec = arg('spec')
if (variant.startsWith(REPO + '/')) throw new Error('variant copies live outside the repository')
const dir = join(variant, '.spec')
mkdirSync(dir, { recursive: true })
const cfg = join(dir, `vitest.${spec}.config.mjs`)
writeFileSync(cfg, `export default { root: '${REPO}', resolve: { alias: [{ find: /^@buildapp\\/source-metrics$/, replacement: '${join(variant, 'packages/source-metrics/src/index.ts')}' }] }, test: { include: ['research/analyzer-005q-chain/spec/${spec}.spec.ts'], environment: 'node' } }\n`)
const r = spawnSync('npx', ['vitest', 'run', '--config', cfg], { cwd: REPO, stdio: 'inherit' })
process.exit(r.status ?? 1)
