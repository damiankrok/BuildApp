/**
 * `npm run -s evidence:pack -- --run <run dir> --out <pack dir> [--id <run id>] [--git-sha <sha>]`
 *
 * Build an Evidence Pack from a run directory `analysis:second-house` wrote, after the fact. The
 * run is never touched; the pack is a function of its files.
 */
import { basename } from 'node:path'
import { packRunDir } from './run-dir.js'

const value = (argv: readonly string[], name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined
}
const argv = process.argv.slice(2)
const run = value(argv, 'run')
const out = value(argv, 'out')
if (!run || !out) {
  process.stderr.write('usage: evidence:pack -- --run <run dir> --out <pack dir> [--id <run id>] [--git-sha <sha>]\n')
  process.exit(2)
}
const { pack, ms } = packRunDir(run, out, value(argv, 'id') ?? basename(run), { gitSha: value(argv, 'git-sha') })
process.stdout.write(`evidence pack ${pack.manifest.runId}: ${pack.manifest.files.length} files, ${pack.timeline.length} decisions, ${pack.manifest.result}${pack.manifest.failureCode ? ` ${pack.manifest.failureCode}` : ''} — ${ms} ms → ${out}\n`)
