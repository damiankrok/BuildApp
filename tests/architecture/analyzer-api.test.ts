/**
 * Architecture tests for the in-app link analyzer (BUILDAPP-03Y1).
 *
 *  1. **One analyzer.** The CLI and the API both call `runAnalysis`; neither
 *     carries a pipeline of its own.
 *  2. **The service cannot reach the answer.** What the production API runs
 *     is decided by esbuild, not by a reading of import lines: the test
 *     bundles the server and the worker exactly as `build.mjs` does and checks
 *     every module that went in. No reference model, no sealed candidate, no
 *     benchmark, no research note, no synthetic fixture, no stage artefact —
 *     and no string that names the one project the analyzer has been tuned on.
 *  3. **No secret, no truth, no project in the service's own source.**
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { build } from 'esbuild'
import { beforeAll, describe, expect, it } from 'vitest'

const ROOT = resolve(import.meta.dirname, '../..')
const API = resolve(ROOT, 'apps/analyzer-api')
const SERVICE = resolve(ROOT, 'packages/analysis-service')

const FORBIDDEN_MODULE = /packages\/(candidates|reference-[^/]+|synthetic-drawings|demo|editor|verification)\/|(^|\/)research\/|stage-reports\/|tests\/(benchmark|architecture)\/|apps\/analyzer-api\/(test|scripts)\//
// the house the analyzer was tuned on, by name (with or without the accent) and by its publisher code
const PROJECT_WORDS = /marc[oó]wk|m2fa281446a8ca/i

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  const walk = (d: string): void => {
    for (const entry of readdirSync(d)) {
      if (entry === 'node_modules' || entry === 'dist') continue
      const full = join(d, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (/\.(ts|mjs)$/.test(entry)) out.push(full)
    }
  }
  walk(dir)
  return out.sort()
}

let inputs: string[] = []
let bundled = ''

beforeAll(async () => {
  const result = await build({
    entryPoints: { server: join(API, 'src/main.ts'), worker: join(API, 'src/worker.ts') },
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    write: false,
    metafile: true,
    outdir: '/virtual-out',
    logLevel: 'silent',
  })
  inputs = Object.keys(result.metafile.inputs).map((p) => relative(ROOT, resolve(ROOT, p)))
  bundled = result.outputFiles.map((f) => f.text).join('\n')
}, 120_000)

describe('the production analyzer service, as bundled', () => {
  it('is built from the one pipeline: the analysis service, the analyzer v2, the compiler and the scene bundle', () => {
    for (const pkg of ['analysis-service', 'reconstruction', 'source-package', 'source-analyzer', 'source-metrics', 'geometry', 'mobile-scene', 'model']) {
      expect(
        inputs.some((p) => p.includes(`packages/${pkg}/src/`)),
        `${pkg} is part of the service`,
      ).toBe(true)
    }
  })

  it('contains no reference, candidate, benchmark, research, fixture or stage-artefact module', () => {
    const offenders = inputs.filter((p) => FORBIDDEN_MODULE.test(p))
    expect(offenders).toEqual([])
    expect(inputs.filter((p) => p.endsWith('.json') && !p.includes('node_modules'))).toEqual([])
  })

  it('names no project: not the house it was tuned on, not its code, not a sealed model id', () => {
    const hits = [...new Set(bundled.match(new RegExp(PROJECT_WORDS.source, 'gi')) ?? [])]
    expect(hits).toEqual([])
  })

  it('registers publishers, not projects: the only adapter wired in production is a publisher adapter', () => {
    const wiring = readFileSync(join(API, 'src/wiring.ts'), 'utf8')
    expect(wiring).toMatch(/archonAdapter/)
    expect(wiring).not.toMatch(/synthetic|fixture|candidates|reference/i)
  })
})

describe('the service source itself', () => {
  const files = [...sourceFiles(join(API, 'src')), ...sourceFiles(join(SERVICE, 'src'))]

  it('imports no specimen package and reaches under no research or artefact directory', () => {
    const offenders: string[] = []
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      for (const m of text.matchAll(/from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
        const spec = m[1] ?? m[2]
        if (/@buildapp\/(candidates|reference-|synthetic-drawings|demo|editor|verification)/.test(spec) || /research|stage-reports|benchmark/.test(spec)) offenders.push(`${relative(ROOT, file)} imports ${spec}`)
      }
      if (PROJECT_WORDS.test(text)) offenders.push(`${relative(ROOT, file)} names a project`)
    }
    expect(offenders).toEqual([])
  })

  it('declares no specimen package as a runtime dependency', () => {
    for (const manifest of [join(API, 'package.json'), join(SERVICE, 'package.json')]) {
      const deps = Object.keys((JSON.parse(readFileSync(manifest, 'utf8')) as { dependencies?: Record<string, string> }).dependencies ?? {})
      expect(deps.filter((d) => /candidates|reference-|synthetic-drawings|demo|editor/.test(d)), manifest).toEqual([])
    }
  })

  it('never returns a secret: no environment variable is read into a response', () => {
    const http = readFileSync(join(API, 'src/http.ts'), 'utf8')
    expect(http).not.toMatch(/process\.env/)
    // the one provider key is read by the provider, on the server, and nowhere else in the service
    for (const file of files) expect(readFileSync(file, 'utf8'), relative(ROOT, file)).not.toMatch(/ANTHROPIC_API_KEY/)
  })

  it('the CLI is an adapter over runAnalysis, not a second pipeline', () => {
    const cli = readFileSync(join(SERVICE, 'scripts/reconstruct-v2.ts'), 'utf8')
    expect(cli).toMatch(/runAnalysis\(/)
    for (const step of ['acquireSourcePackage(', 'analyzeSourcePackage(', 'extractMetricEvidence(', 'reconstructV2(', 'compileBuilding(', 'buildMobileSceneBundle(']) {
      expect(cli.includes(step), `the CLI calls ${step} itself`).toBe(false)
    }
    const executor = readFileSync(join(API, 'src/executor.ts'), 'utf8')
    expect(executor).toMatch(/runAnalysis\(/)
    for (const step of ['acquireSourcePackage(', 'analyzeSourcePackage(', 'reconstructV2(']) expect(executor.includes(step), `the API calls ${step} itself`).toBe(false)
  })
})
