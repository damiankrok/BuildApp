#!/usr/bin/env node
/**
 * oracle-config.mjs — BUILDPLAN-ANALYZER-005Q: point the wall-strip fixtures at a variant of the reconstruction module
 * (RESEARCH ONLY; never imported by production).
 *
 *   node research/analyzer-005q/variant.mjs setup --work <dir outside the repository>    (the frozen 005Q base, 04d5568)
 *   node research/analyzer-005q/synth/oracle-config.mjs --work <that dir>
 *
 * writes `<work>/oracle.config.mjs`, a Vite/Vitest config that resolves, for a process started at the repository root:
 *   - `@buildapp/reconstruction` and the source packages as the variant's own `vite.config.mjs` does (variant.mjs);
 *   - `../src/index.js` imported from `packages/reconstruction/test/` (the wall-strip tests and their helpers) to the
 *     variant's `packages/reconstruction/src/index.ts` — and nothing else of that name;
 * and, for vitest, runs `packages/reconstruction/test/wall-strip.test.ts` only. Then, from the repository root:
 *
 *   npx vite-node --config <work>/oracle.config.mjs research/analyzer-005q/synth/record.ts -- --format table [--fixtures a,b] [--transforms id,turn270]
 *       the variant's outcome on the fixtures, as `FROZEN` entries of wall-strip.test.ts (or `--format json`, outcomeOf)
 *   npx vite-node research/analyzer-005q/synth/record.ts -- --format json [--fixtures a,b]
 *       the same through the working tree (no config: the workspace's own module)
 *   npx vitest run --config <work>/oracle.config.mjs
 *       wall-strip.test.ts against the variant: on the frozen base every test where N1a fires fails, and the hard
 *       negatives (the frozen outcome asserted whole) pass
 *
 * The variant copy and the config it writes live outside the repository; nothing here names a machine path.
 */
import { existsSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO = resolve(import.meta.dirname, '../../..')
const arg = (n, f) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : f
}
if (!arg('work', '')) {
  process.stderr.write('usage: oracle-config.mjs --work <variant dir written by variant.mjs setup>\n')
  process.exit(2)
}
const work = resolve(arg('work', ''))
if (work.startsWith(REPO)) throw new Error('a variant copy lives outside the repository')
const index = join(work, 'packages/reconstruction/src/index.ts')
const base = join(work, 'vite.config.mjs')
if (!existsSync(index) || !existsSync(base)) throw new Error(`${work} is not a variant (run variant.mjs setup --work ${work} first)`)
const config = join(work, 'oracle.config.mjs')
writeFileSync(
  config,
  `// written by research/analyzer-005q/synth/oracle-config.mjs: the wall-strip fixtures against the variant at ${JSON.stringify(work)}
import variant from ${JSON.stringify(base)}
const REPO = ${JSON.stringify(REPO)}
const INDEX = ${JSON.stringify(index)}
const TESTS = REPO + '/packages/reconstruction/test/'
export default {
  root: REPO,
  resolve: { alias: variant.resolve.alias },
  plugins: [
    {
      name: 'wall-strip-oracle',
      enforce: 'pre',
      resolveId(id, importer) {
        if (id === '../src/index.js' && importer && importer.split('?')[0].startsWith(TESTS)) return INDEX
        return null
      },
    },
  ],
  test: {
    include: ['packages/reconstruction/test/wall-strip.test.ts'],
    environment: 'node',
    testTimeout: 120000,
    hookTimeout: 120000,
    setupFiles: [REPO + '/tests/setup/yield-between-tests.ts'],
  },
}
`,
)
process.stdout.write(`${config}\n`)
