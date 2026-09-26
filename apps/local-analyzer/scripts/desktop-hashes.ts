/**
 * The DESKTOP production pipeline's hashes for a synthetic fixture project:
 * `runAnalysis` from the TypeScript sources, in this Node process (22 in CI),
 * through the same in-memory publisher the device test's launcher uses. CI
 * passes these to the instrumentation test, which requires the phone to
 * produce exactly them.
 *
 *   npx vite-node apps/local-analyzer/scripts/desktop-hashes.ts -- [--project larchfield-lf01] [--out file.json]
 */
import { writeFileSync } from 'node:fs'
import { hashesOf, runAnalysis } from '@buildapp/analysis-service'
import { memoryByteCache } from '@buildapp/source-package'
import { FIXTURE_PROJECTS, fixturePageUrl, fixtureWiring } from '../fixture/fixture.js'

const argv = process.argv.slice(2)
const value = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const project = value('project') ?? FIXTURE_PROJECTS.larchfield
const wiring = fixtureWiring()
const run = await runAnalysis({ kind: 'URL', url: fixturePageUrl(project) }, { adapters: wiring.adapters, deps: wiring.deps, cache: memoryByteCache() })
const out = { runtime: process.version, project, url: fixturePageUrl(project), label: run.result.label, ...hashesOf(run.result), timings: run.timings }
const json = `${JSON.stringify(out, null, 2)}\n`
const file = value('out')
if (file) writeFileSync(file, json)
process.stdout.write(json)
