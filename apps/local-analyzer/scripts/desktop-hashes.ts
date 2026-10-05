/**
 * The DESKTOP production pipeline's hashes for a synthetic fixture project:
 * `runAnalysis` from the TypeScript sources, in this Node process (22 in CI),
 * through the same in-memory publisher the device test's launcher uses. CI
 * passes these to the instrumentation test, which requires the phone to
 * produce exactly them.
 *
 * 005H: with the external numeric recogniser, as the app's launcher runs it
 * (the same engine in-process here, its worker on the phone), and the OCR
 * parity self-test's corpus and output hashes beside the pipeline's.
 *
 *   npx vite-node apps/local-analyzer/scripts/desktop-hashes.ts -- [--project larchfield-lf01] [--out file.json]
 */
import { writeFileSync } from 'node:fs'
import { hashesOf, runAnalysis } from '@buildapp/analysis-service'
import { memoryByteCache } from '@buildapp/source-package'
import { inlineRecogniser, workspaceAssetPaths } from '@buildapp/numeric-recogniser-ort'
import { FIXTURE_PROJECTS, fixturePageUrl, fixtureWiring } from '../fixture/fixture.js'
import { ocrSelfTest } from '../src/self-test.js'

const argv = process.argv.slice(2)
const value = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const project = value('project') ?? FIXTURE_PROJECTS.larchfield
const wiring = fixtureWiring()
const recogniser = inlineRecogniser({ paths: workspaceAssetPaths() })
const run = await runAnalysis({ kind: 'URL', url: fixturePageUrl(project) }, { adapters: wiring.adapters, deps: wiring.deps, cache: memoryByteCache(), recogniser })
const selfTest = await ocrSelfTest(recogniser, { wasmPath: workspaceAssetPaths().wasm })
await recogniser.release()
const out = {
  runtime: process.version,
  project,
  url: fixturePageUrl(project),
  label: run.result.label,
  ...hashesOf(run.result),
  recogniser: run.result.recogniser ?? null,
  ocrSelfTest: { corpusSha256: selfTest.corpus.sha256, outputSha256: selfTest.outputSha256, exact: selfTest.exact, labels: selfTest.corpus.labels },
  timings: run.timings,
}
const json = `${JSON.stringify(out, null, 2)}\n`
const file = value('out')
if (file) writeFileSync(file, json)
process.stdout.write(json)
