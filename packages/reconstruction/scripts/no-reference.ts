/**
 * `npm run reconstruct:no-reference`
 *
 * §16's proof, executed rather than argued: move the reference package out of
 * the tree, run the whole candidate path, and put it back.
 *
 * The architecture tests already read every production source and fail on an
 * import of `@buildapp/reference-*`. This does the same thing from the other
 * end — if anything in the path reaches for the reference at RUN time, through
 * a dynamic import, a lazy require, or a JSON file read off disk, the module
 * simply will not be there and the run fails loudly.
 *
 * The move is restored in a `finally`, and the script refuses to start if a
 * previous run left the tree in a half-moved state.
 */
import { existsSync, renameSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '../../..')
const REFERENCE = join(ROOT, 'packages/reference-marcowki')
const HIDDEN = join(ROOT, 'packages/.reference-marcowki.hidden')

function main(): void {
  if (existsSync(HIDDEN)) throw new Error(`${HIDDEN} already exists: a previous run did not restore the tree, and this script will not guess which copy is current`)
  if (!existsSync(REFERENCE)) throw new Error(`${REFERENCE} is not there to hide`)

  process.stdout.write('hiding packages/reference-marcowki\n')
  renameSync(REFERENCE, HIDDEN)
  let code = 1
  try {
    const args = process.argv.slice(2)
    const result = spawnSync(
      'npx',
      [
        'vite-node',
        'packages/reconstruction/scripts/reconstruct.ts',
        '--',
        ...(args.length > 0
          ? args
          : [
              '--package',
              'stage-reports/artifacts/source-observations/marcowki-source-package.json',
              '--graph',
              'stage-reports/artifacts/source-observations/marcowki-observation-graph.json',
              '--slug',
              'no-reference',
              '--label',
              'Candidate built with no reference package present',
              '--out',
              join(ROOT, '.cache', 'no-reference'),
            ]),
      ],
      { cwd: ROOT, stdio: 'inherit', encoding: 'utf8' },
    )
    code = result.status ?? 1
  } finally {
    renameSync(HIDDEN, REFERENCE)
    process.stdout.write('restored packages/reference-marcowki\n')
  }
  if (code !== 0) throw new Error(`the candidate path failed with the reference package absent (exit ${code})`)
  process.stdout.write('\nthe candidate was produced with no reference package in the tree\n')
}

try {
  main()
} catch (error: unknown) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
