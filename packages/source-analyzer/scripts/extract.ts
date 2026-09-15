/**
 * `npm run observations:extract -- <package.json>`
 *
 * Reads a sealed SourcePackage, runs the extractors over the bytes in a cache,
 * and writes a sealed SourceObservationGraph. No network is touched: the whole
 * point of sealing a package is that everything after it replays offline.
 *
 * Flags:
 *   --cache <dir>       where the package's bytes are (required)
 *   --out <file>        where to write the sealed graph
 *   --overlays <dir>    write one debug SVG per analysed drawing
 *   --fixtures <dir>    replay recorded vision answers from here
 *   --live              use a live vision provider (needs ANTHROPIC_API_KEY)
 *   --record <dir>      with --live, write each accepted answer as a fixture
 *   --tasks a,b         restrict the vision passes to these tasks
 *   --max <n>           analyse at most n assets
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { SourcePackageSchema, fileByteCache, selectedVariant } from '@buildapp/source-package'
import type { SourcePackage } from '@buildapp/source-package'
import { anthropicVisionReasoner, fixtureVisionReasoner, nullVisionReasoner } from '@buildapp/source-vision'
import type { VisionReasoner, VisionTask, VisionTrace } from '@buildapp/source-vision'
import { analyzeSourcePackage, imageDataUri, overlaySvg } from '../src/index.js'
import type { AnalysisResult } from '../src/index.js'
import { loadFixtures, recordFixture } from './fixtures.js'

const value = (argv: readonly string[], name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined
}
const flag = (argv: readonly string[], name: string): boolean => argv.includes(`--${name}`)

export function summarize(pkg: SourcePackage, result: AnalysisResult): string {
  const g = result.graph
  const byKind = new Map<string, number>()
  for (const o of g.observations) byKind.set(o.kind, (byKind.get(o.kind) ?? 0) + 1)
  const byExtractor = new Map<string, number>()
  for (const o of g.observations) byExtractor.set(o.provenance.name, (byExtractor.get(o.provenance.name) ?? 0) + 1)
  const lines: string[] = []
  lines.push(`graph        ${g.id}`)
  lines.push(`package      ${g.sourcePackageId}  (${g.sourcePackageHash.slice(0, 12)})`)
  lines.push(`content hash ${g.contentHash}`)
  lines.push(`frames ${g.coordinateFrames.length}   observations ${g.observations.length}   relations ${g.relations.length}   conflicts ${g.conflicts.length}   gaps ${g.unresolved.length}`)
  lines.push('')
  lines.push('  by kind')
  for (const [kind, n] of [...byKind].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) lines.push(`    ${kind.padEnd(28)} ${String(n).padStart(4)}`)
  lines.push('')
  lines.push('  by extractor')
  for (const [name, n] of [...byExtractor].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) lines.push(`    ${name.padEnd(46)} ${String(n).padStart(4)}`)
  lines.push('')
  lines.push('  per drawing')
  for (const a of result.assets) {
    const own = g.observations.filter((o) => o.frameId === a.frame.id)
    lines.push(`    ${`${a.asset.roles.document}/${a.asset.roles.view}/${a.asset.roles.storey}`.padEnd(46)} ${String(own.length).padStart(4)}  ${a.frame.size.width}x${a.frame.size.height}`)
  }
  if (result.skipped.length > 0) {
    lines.push('')
    lines.push('  skipped')
    for (const s of result.skipped) lines.push(`    ${s.assetId.padEnd(60)} ${s.reason}`)
  }
  lines.push('')
  lines.push(`  vision: provider ${result.vision.provider ?? 'none'}, attempted ${result.vision.attempted}, accepted ${result.vision.accepted}, rejected ${result.vision.rejected.length}, unavailable ${result.vision.unavailable.length}`)
  for (const r of result.vision.rejected.slice(0, 8)) lines.push(`    REJECTED ${r.task} on ${r.assetId}: [${r.code}] ${r.message}`)
  for (const u of result.vision.unavailable.slice(0, 3)) lines.push(`    UNAVAILABLE ${u.task}: ${u.message}`)
  return lines.join('\n')
}

async function reasonerFor(argv: readonly string[], onTrace?: (trace: VisionTrace) => void): Promise<VisionReasoner> {
  if (flag(argv, 'live')) {
    const live = anthropicVisionReasoner({ model: value(argv, 'model'), onTrace })
    if (!live.available()) {
      process.stderr.write('--live was asked for but ANTHROPIC_API_KEY is not set; refusing to pretend a live call was made\n')
      process.exit(3)
    }
    return live
  }
  const dir = value(argv, 'fixtures')
  if (dir) return fixtureVisionReasoner(await loadFixtures(dir))
  return nullVisionReasoner('no --fixtures directory and no --live flag: this run is deterministic CV only')
}

export async function main(argv: readonly string[]): Promise<number> {
  const packagePath = argv.find((a) => a.endsWith('.json'))
  const cacheDir = value(argv, 'cache')
  if (!packagePath || !cacheDir) {
    process.stderr.write('usage: observations:extract -- <package.json> --cache <dir> [--out file] [--overlays dir] [--fixtures dir | --live] [--record dir]\n')
    return 2
  }
  const pkg = SourcePackageSchema.parse(JSON.parse(await readFile(packagePath, 'utf8')))
  const cache = fileByteCache(cacheDir)
  const recordDirEarly = value(argv, 'record')
  const traces: VisionTrace[] = []
  const vision = await reasonerFor(argv, (trace) => {
    traces.push(trace)
    if (recordDirEarly) void recordFixture(recordDirEarly, trace)
  })
  const tasks = value(argv, 'tasks')?.split(',') as VisionTask[] | undefined
  const result = await analyzeSourcePackage(pkg, {
    bytes: (url) => cache.get(url),
    vision: vision.provider.id === 'vision.none' ? undefined : vision,
    visionTasks: tasks,
    maxAssets: value(argv, 'max') ? Number(value(argv, 'max')) : undefined,
  })

  const out = value(argv, 'out')
  if (out) {
    await mkdir(dirname(out), { recursive: true })
    await writeFile(out, `${JSON.stringify(result.graph, null, 2)}\n`)
  }

  const overlays = value(argv, 'overlays')
  if (overlays) {
    await mkdir(overlays, { recursive: true })
    for (const analysis of result.assets) {
      const variant = selectedVariant(analysis.asset)
      const bytes = await cache.get(variant.url)
      const svg = overlaySvg(analysis.frame, result.graph.observations, {
        imageDataUri: bytes ? imageDataUri(bytes.bytes, bytes.mediaType) : undefined,
        title: `${analysis.asset.roles.document} / ${analysis.asset.roles.view} / ${analysis.asset.roles.storey} — ${analysis.asset.id}`,
      })
      const name = `${analysis.asset.roles.document.toLowerCase()}-${analysis.asset.roles.view.toLowerCase()}-${analysis.asset.roles.storey.toLowerCase()}-${analysis.frame.id.slice(-10)}.svg`
      await writeFile(join(overlays, name), svg)
    }
    process.stdout.write(`overlays written to ${overlays}\n`)
  }

  process.stdout.write(`${summarize(pkg, result)}\n`)
  if (out) process.stdout.write(`\nwritten to ${out}\n`)
  return 0
}

// Run directly: `vite-node <this file> -- <args>`. Under vitest the module is
// imported for its exports and must not run.
if (!process.env.VITEST) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err: Error) => {
      process.stderr.write(`${err.stack ?? err.message}\n`)
      process.exit(1)
    },
  )
}
