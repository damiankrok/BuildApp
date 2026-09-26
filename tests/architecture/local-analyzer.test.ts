/**
 * Architecture tests for the analyzer on the phone (BUILDAPP-03Y2).
 *
 * The danger this stage introduces is a SECOND analyzer: a "mobile" variant
 * that starts as a copy and drifts, a Kotlin solver, a geometry kernel on the
 * phone, or a bundle that quietly carries the answer for the one house the
 * analyzer was tuned on. These tests read what the APK actually ships — the
 * bundle esbuild makes from `apps/local-analyzer`, exactly as the Android
 * build makes it — and the Kotlin and Gradle sources, and fail by name.
 *
 *  1. The local analyzer is the production pipeline: `runAnalysis`, bundled
 *     from the same packages the analyzer API bundles, with nothing of its own
 *     between the link and the scene.
 *  2–4. No reference model, no benchmark or research gold, no sealed candidate,
 *     no fixture, and no string naming the tuned-on project in the bundle.
 *  5. No second geometry kernel: the phone's Kotlin passes bytes and hashes;
 *     the building comes from the one compiler, in the bundle.
 *  6. The model is still made DSL → CanonicalBuildingModel → compiler.
 *  7. (Local and desktop replay agree: apps/local-analyzer/test/program.test.ts.)
 *  8. (Cancel removes the scratch: local.test.ts, program.test.ts, the Kotlin
 *     LocalAnalysisTest and the device test.)
 *  + No secret and no vision provider in the APK; the test-only launcher never
 *    reaches the app's own assets; the Node 18 runtime is not asked for an API
 *    it lacks.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { build } from 'esbuild'
import { beforeAll, describe, expect, it } from 'vitest'

const ROOT = resolve(import.meta.dirname, '../..')
const LOCAL = resolve(ROOT, 'apps/local-analyzer')
const ANDROID = resolve(ROOT, 'apps/android')
const KOTLIN_MAIN = resolve(ANDROID, 'app/src/main/java/com/buildplan/preview')

const FORBIDDEN_MODULE = /packages\/(candidates|reference-[^/]+|synthetic-drawings|demo|editor|verification)\/|(^|\/)research\/|stage-reports\/|tests\/(benchmark|architecture)\/|apps\/(analyzer-api|web|android)\/|apps\/local-analyzer\/(test|scripts|fixture)\//
const PROJECT_WORDS = /marc[oó]wk|m2fa281446a8ca/i
const PIPELINE_STEPS = ['acquireSourcePackage(', 'analyzeSourcePackage(', 'extractMetricEvidence(', 'reconstructV2(', 'compileBuilding(', 'buildMobileSceneBundle(']

function filesUnder(dir: string, ext: RegExp): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      if (name === 'node_modules' || name === 'dist') continue
      const p = join(d, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (ext.test(name)) out.push(p)
    }
  }
  walk(dir)
  return out.sort()
}

const codeOf = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, ' ')
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')

let inputs: string[] = []
let bundled = ''
let bytesByInput: Record<string, number> = {}

beforeAll(async () => {
  // the SAME build options apps/local-analyzer/build.mjs uses for analyzer.mjs
  const result = await build({
    entryPoints: [join(LOCAL, 'src/analyzer.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node18',
    write: false,
    metafile: true,
    outfile: '/virtual-out/analyzer.mjs',
    logLevel: 'silent',
  })
  inputs = Object.keys(result.metafile.inputs).map((p) => relative(ROOT, resolve(ROOT, p)))
  bundled = result.outputFiles.map((f) => f.text).join('\n')
  bytesByInput = Object.fromEntries(Object.entries(Object.values(result.metafile.outputs)[0].inputs).map(([p, v]) => [relative(ROOT, resolve(ROOT, p)), v.bytesInOutput]))
}, 120_000)

describe('1. the analyzer the APK ships is the production pipeline', () => {
  it('is bundled from the analysis service, the analyzer v2, the DSL, the model, the compiler and the scene bundle', () => {
    for (const pkg of ['analysis-service', 'source-package', 'source-analyzer', 'source-metrics', 'reconstruction', 'commands', 'model', 'geometry', 'mobile-scene']) {
      expect(inputs.some((p) => p.includes(`packages/${pkg}/src/`)), `${pkg} is part of the local analyzer`).toBe(true)
    }
  })

  it('the local entry calls runAnalysis and no pipeline step of its own', () => {
    const local = readFileSync(join(LOCAL, 'src/local.ts'), 'utf8')
    expect(local).toMatch(/runAnalysis\(/)
    for (const file of filesUnder(join(LOCAL, 'src'), /\.ts$/)) {
      const code = codeOf(readFileSync(file, 'utf8'))
      for (const step of PIPELINE_STEPS) expect(code.includes(step), `${relative(ROOT, file)} calls ${step} itself`).toBe(false)
    }
  })

  it('carries no module of its own beyond the thin entry, program and wiring', () => {
    const own = inputs.filter((p) => p.startsWith('apps/local-analyzer/')).sort()
    expect(own).toEqual(['apps/local-analyzer/src/analyzer.ts', 'apps/local-analyzer/src/local.ts', 'apps/local-analyzer/src/memory.ts', 'apps/local-analyzer/src/program.ts', 'apps/local-analyzer/src/wiring.ts'])
    // and those are small: the analyzer is everything else
    const ownBytes = own.reduce((a, p) => a + (bytesByInput[p] ?? 0), 0)
    const total = Object.values(bytesByInput).reduce((a, b) => a + b, 0)
    expect(ownBytes / total).toBeLessThan(0.02)
  })

  it('registers the production publishers and no vision provider', () => {
    const wiring = codeOf(readFileSync(join(LOCAL, 'src/wiring.ts'), 'utf8'))
    expect(wiring).toMatch(/archonAdapter/)
    expect(wiring).not.toMatch(/synthetic|fixture|candidates|reference|vision|anthropic/i)
    expect(readFileSync(join(LOCAL, 'runtime/main.mjs'), 'utf8')).toMatch(/localWiring\(\)/)
  })
})

describe('2–4. no truth, no benchmark, no project in what the phone runs', () => {
  it('contains no reference, candidate, benchmark, research, fixture, app or stage-artefact module', () => {
    expect(inputs.filter((p) => FORBIDDEN_MODULE.test(p))).toEqual([])
    expect(inputs.filter((p) => p.endsWith('.json') && !p.includes('node_modules'))).toEqual([])
  })

  it('names no project: not the house it was tuned on, not its code', () => {
    expect([...new Set(bundled.match(new RegExp(PROJECT_WORDS.source, 'gi')) ?? [])]).toEqual([])
    for (const file of [...filesUnder(join(LOCAL, 'src'), /\.ts$/), join(LOCAL, 'runtime/main.mjs')]) {
      expect(PROJECT_WORDS.test(readFileSync(file, 'utf8')), `${relative(ROOT, file)} names a project`).toBe(false)
    }
  })

  it('declares no specimen package as a runtime dependency', () => {
    const deps = Object.keys((JSON.parse(readFileSync(join(LOCAL, 'package.json'), 'utf8')) as { dependencies?: Record<string, string> }).dependencies ?? {})
    expect(deps.filter((d) => /candidates|reference-|synthetic-drawings|demo|editor|benchmark/.test(d))).toEqual([])
  })
})

describe('no secret, no provider key, no vision SDK in the APK', () => {
  it('the bundle reads no provider key and carries none of the vision SDK', () => {
    expect(bundled).not.toMatch(/ANTHROPIC_API_KEY|x-api-key|sk-ant-/)
    const sdkBytes = Object.entries(bytesByInput).filter(([p]) => p.includes('@anthropic-ai/sdk')).reduce((a, [, b]) => a + b, 0)
    expect(sdkBytes).toBe(0)
  })
})

describe('5–6. the phone runs no second geometry kernel; the model comes from the DSL', () => {
  const localKotlin = filesUnder(join(KOTLIN_MAIN, 'analyzer/local'), /\.kt$/)

  it('has Kotlin sources for the local analyzer to check', () => {
    expect(localKotlin.length).toBeGreaterThan(0)
  })

  it('the Kotlin around the runtime builds nothing: no geometry, no solver, no drawing decoded', () => {
    for (const file of localKotlin) {
      const code = codeOf(readFileSync(file, 'utf8'))
      for (const forbidden of ['Bitmap', 'BitmapFactory', 'ImageDecoder', 'FloatArray', 'Mesh', 'Wall', 'Roof', 'Opening', 'triangulate', 'extrude', 'compileBuilding', 'reconstruct', 'solve']) {
        expect(new RegExp(`\\b${forbidden}\\b`).test(code), `${relative(ROOT, file)} mentions ${forbidden}`).toBe(false)
      }
    }
  })

  it('the only native code is the bridge to node::Start', () => {
    const cpp = filesUnder(join(ANDROID, 'app/src/main/cpp'), /\.(c|cc|cpp|h|hpp)$/).map((f) => relative(ROOT, f))
    expect(cpp).toEqual(['apps/android/app/src/main/cpp/node_bridge.cpp'])
    const code = readFileSync(join(ANDROID, 'app/src/main/cpp/node_bridge.cpp'), 'utf8')
    expect(code).toMatch(/node::Start/)
    expect(code).not.toMatch(/\b(mesh|wall|roof|solver|geometry)\b/i)
  })

  it('the model is made by replaying the Building DSL and compiled by the one compiler', () => {
    // the pipeline in the bundle: DSL commands → CanonicalBuildingModel → compileBuilding → scene bundle
    expect(inputs.some((p) => p.startsWith('packages/commands/src/'))).toBe(true)
    expect(bundled).toMatch(/function compileBuilding\(/)
    expect(bundled).toMatch(/function verifyReplay\(/)
    expect(bundled).toMatch(/function buildMobileSceneBundle\(/)
  })
})

describe('the Android build ships exactly this bundle, and the fixture only in the test APK', () => {
  const gradle = readFileSync(join(ANDROID, 'app/build.gradle.kts'), 'utf8')

  it('bundles apps/local-analyzer/build.mjs into the app assets at build time; nothing is committed', () => {
    expect(gradle).toMatch(/apps\/local-analyzer\/build\.mjs/)
    expect(gradle).toMatch(/variant\.sources\.assets\?\.addGeneratedSourceDirectory\(bundleLocalAnalyzer/)
    expect(filesUnder(join(ANDROID, 'app/src/main/assets'), /\.(m?js|cjs)$/)).toEqual([])
  })

  it('adds the synthetic-publisher launcher to the instrumentation test APK only', () => {
    expect(gradle).toMatch(/variant\.androidTest\?\.sources\?\.assets\?\.addGeneratedSourceDirectory\(bundleLocalAnalyzerFixture/)
    expect(gradle).not.toMatch(/variant\.sources\.assets\?\.addGeneratedSourceDirectory\(bundleLocalAnalyzerFixture/)
  })

  it('pins the embedded runtime: nodejs-mobile 18.20.4, integrity-checked, fetched not committed', () => {
    const fetch = readFileSync(join(ANDROID, 'tools/fetch-nodejs-mobile.mjs'), 'utf8')
    expect(fetch).toMatch(/nodeVersion: '18\.20\.4'/)
    expect(fetch).toMatch(/integrity: 'sha512-/)
    expect(fetch).toMatch(/sha256: '[0-9a-f]{64}'/)
    expect(readFileSync(join(ROOT, '.gitignore'), 'utf8')).toMatch(/^apps\/android\/third_party\/$/m)
  })

  it('runs the analyzer in a separate, non-exported process', () => {
    const manifest = readFileSync(join(ANDROID, 'app/src/main/AndroidManifest.xml'), 'utf8')
    expect(manifest).toMatch(/android:name="\.analyzer\.local\.LocalAnalyzerService"\s+android:exported="false"\s+android:process=":analyzer"/)
  })
})

describe('the Node 18 runtime is not asked for an API it lacks', () => {
  // APIs newer than Node 18.20 that the production packages must not call directly
  const NEWER = ['AbortSignal.any', 'Object.groupBy', 'Map.groupBy', 'Promise.withResolvers', 'Array.fromAsync', '.toSorted(', '.toReversed(', '.toSpliced(', 'import.meta.dirname', 'import.meta.filename']
  const production = ['analysis-service', 'source-common', 'source-cv', 'source-package', 'source-observations', 'source-analyzer', 'source-vision', 'source-metrics', 'image-metrology', 'reconstruction', 'commands', 'model', 'geometry', 'mobile-scene']
    .flatMap((p) => filesUnder(join(ROOT, 'packages', p, 'src'), /\.ts$/))
    .concat(filesUnder(join(LOCAL, 'src'), /\.ts$/))
    .filter((f) => !/\.test\.ts$/.test(f))

  it('calls none of them outside the one shim that checks for them', () => {
    const offenders: string[] = []
    for (const file of production) {
      if (file.endsWith('analysis-service/src/signals.ts')) continue
      const code = codeOf(readFileSync(file, 'utf8'))
      for (const api of NEWER) if (code.includes(api)) offenders.push(`${relative(ROOT, file)}: ${api}`)
    }
    expect(offenders).toEqual([])
  })
})
