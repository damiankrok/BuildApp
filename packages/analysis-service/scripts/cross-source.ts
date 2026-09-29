/**
 * `npm run analysis:cross-source -- --a <run dir> --b <run dir> [--labels "A,B"] [--out <dir>]`
 *
 * The same house on two sites? Each run directory is what `second-house.ts`
 * writes: `source-package.json` always, `model.json` when the run completed.
 * The comparison (`cross-source.ts` in `src/`) is evidence-first — printed
 * figures, rooms, roof, drawing coverage, and the compiled geometry's
 * fingerprint when both sides reconstructed — and never by title alone. It
 * writes `cross-source.json` and `cross-source.md` and prints the verdict.
 * Nothing here merges anything.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { stableJson } from '@buildapp/source-common'
import { SourcePackageSchema } from '@buildapp/source-package'
import { loadModel } from '@buildapp/model'
import { compileBuilding } from '@buildapp/geometry'
import { compareSources, comparableOf, comparisonMarkdown } from '../src/cross-source.js'
import type { SourceComparable } from '../src/cross-source.js'

const value = (argv: readonly string[], name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined
}

function comparableFromDir(dir: string): SourceComparable {
  const pkg = SourcePackageSchema.parse(JSON.parse(readFileSync(join(dir, 'source-package.json'), 'utf8')))
  const modelPath = join(dir, 'model.json')
  if (!existsSync(modelPath)) return comparableOf(pkg)
  const loaded = loadModel(readFileSync(modelPath, 'utf8'))
  if (!loaded.ok) return comparableOf(pkg)
  return comparableOf(pkg, { model: loaded.model, scene: compileBuilding(loaded.model) })
}

export function crossSource(argv: readonly string[], log: (line: string) => void = (l) => process.stdout.write(`${l}\n`)): string {
  const a = value(argv, 'a')
  const b = value(argv, 'b')
  if (!a || !b) throw new Error('give --a <run dir> and --b <run dir>')
  const labels = (value(argv, 'labels') ?? 'A,B').split(',') as [string, string]
  const out = value(argv, 'out') ?? join(process.cwd(), '.cache', 'cross-source')
  mkdirSync(out, { recursive: true })
  const comparison = compareSources(comparableFromDir(a), comparableFromDir(b))
  writeFileSync(join(out, 'cross-source.json'), `${stableJson({ ...comparison, sources: { [labels[0]]: a, [labels[1]]: b } })}\n`)
  const md = `# Cross-source comparison\n\n${labels[0]}: \`${a}\`\n${labels[1]}: \`${b}\`\n\n${comparisonMarkdown(comparison, labels)}\n`
  writeFileSync(join(out, 'cross-source.md'), md)
  log(md)
  return comparison.equivalence
}

if (!process.env.VITEST) {
  try {
    crossSource(process.argv.slice(2))
  } catch (error: unknown) {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
    process.exitCode = 1
  }
}
