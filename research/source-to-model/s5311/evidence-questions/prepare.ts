/**
 * s5311 — prepare the evidence-question payloads, privately. Nothing is sent anywhere.
 *
 *   npx vite-node research/source-to-model/s5311/evidence-questions/prepare.ts -- \
 *     --sources <private sources.json> --out <private payload dir> [--fixtures-out <dir>]
 *
 * `sources.json` maps each sheet of questions.json to its sealed source package and byte cache:
 *   { "nigelle": { "package": "<dir with source-package.json and metric-evidence.json>", "cache": "<byte cache dir>" }, … }
 * The original is the variant whose sha256 is the sheet's sealed byteHash (found by its URL's cache key, else by hashing
 * the cache). It must decode to the sealed size. The payload directory gets the pictures (publisher's bytes: it must lie
 * outside the repository), one JSON per request, manifest.json and estimate.md. The three SYNTHETIC fixture files
 * (keys and answers only, no pictures) go to `--fixtures-out`, by default this folder's fixtures/.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { cacheKeyFor } from '@buildapp/source-package'
import { makeFixture, sha256 } from './harness.js'
import type { FixtureKind } from './harness.js'
import { estimateTable, loadSealedQuestions, writePayloads } from './runner.js'

const here = import.meta.dirname
const repoRoot = resolve(here, '../../../..')
const arg = (name: string, fallback?: string): string => {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0 || process.argv[i + 1] === undefined) {
    if (fallback !== undefined) return fallback
    throw new Error(`--${name} is required`)
  }
  return process.argv[i + 1]
}

function originalBytes(packageDir: string, cacheDir: string, byteHash: string): Uint8Array {
  const pkg = JSON.parse(readFileSync(join(packageDir, 'source-package.json'), 'utf8')) as { assets: Array<{ variants: Array<{ byteHash: string; url?: string }> }> }
  const variant = pkg.assets.flatMap((a) => a.variants).find((v) => v.byteHash === byteHash)
  if (!variant) throw new Error(`the package in ${packageDir} has no variant with byte hash ${byteHash.slice(0, 12)}`)
  if (variant.url) {
    const file = join(cacheDir, `${cacheKeyFor(variant.url)}.bin`)
    if (existsSync(file)) {
      const bytes = new Uint8Array(readFileSync(file))
      if (sha256(bytes) === byteHash) return bytes
    }
  }
  for (const name of readdirSync(cacheDir).filter((n) => n.endsWith('.bin'))) {
    const bytes = new Uint8Array(readFileSync(join(cacheDir, name)))
    if (sha256(bytes) === byteHash) return bytes
  }
  throw new Error(`no file in ${cacheDir} has sha256 ${byteHash.slice(0, 12)}`)
}

function main(): void {
  const questionsPath = resolve(arg('questions', join(here, 'questions.json')))
  const sealPath = resolve(arg('seal', join(here, 'questions.seal.json')))
  const { set, sha256: questionsSha256 } = loadSealedQuestions(questionsPath, sealPath)
  const sources = JSON.parse(readFileSync(resolve(arg('sources')), 'utf8')) as Record<string, { package: string; cache: string }>
  const originals: Record<string, Uint8Array> = {}
  const sheets: Record<string, { packageDir: string | null; metricEvidence: string | null }> = {}
  for (const [id, sheet] of Object.entries(set.sheets)) {
    const src = sources[id]
    if (!src) throw new Error(`sources.json names no package for sheet ${id}`)
    const pkg = JSON.parse(readFileSync(join(src.package, 'source-package.json'), 'utf8')) as { id: string; contentHash: string }
    if (pkg.id !== sheet.packageId || pkg.contentHash !== sheet.packageContentHash) throw new Error(`the package for ${id} is ${pkg.id} / ${pkg.contentHash.slice(0, 12)}, sealed as ${sheet.packageId} / ${String(sheet.packageContentHash).slice(0, 12)}`)
    originals[id] = originalBytes(src.package, src.cache, sheet.byteHash)
    const metric = join(src.package, 'metric-evidence.json')
    sheets[id] = { packageDir: resolve(src.package), metricEvidence: existsSync(metric) ? resolve(metric) : null }
  }
  const out = resolve(arg('out'))
  const { manifest, requests } = writePayloads({ set, questionsSha256, originals, sheets, out, repoRoot })
  const fixturesOut = resolve(arg('fixtures-out', join(here, 'fixtures')))
  mkdirSync(fixturesOut, { recursive: true })
  for (const kind of ['all-correct', 'wrong-hint', 'all-unknown'] as FixtureKind[]) writeFileSync(join(fixturesOut, `${kind}.json`), `${JSON.stringify(makeFixture(set, questionsSha256, requests, kind), null, 1)}\n`)
  console.log(`questions ${questionsSha256.slice(0, 12)} (sealed), ${manifest.requests.length} requests -> ${out}`)
  console.log(estimateTable(manifest.estimates))
}

main()
