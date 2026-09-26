/**
 * `npm run reconstruct:v2 -- --url <project url>` (or `--package … --graph …`)
 *
 * The v2 production path, end to end: acquire the sources (or replay them from
 * the byte cache), read what was seen, read what was printed, run the v2
 * analyzer, seal the candidate and write every §24 artifact under
 * `stage-reports/artifacts/analyzer-v2/` (or `--out`).
 *
 * This script may name a URL because somebody has to; it tells the analyzer
 * nothing about what to expect there.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { stableJson } from '@buildapp/source-common'
import { archonAdapter, SourcePackageSchema, acquireSourcePackage, decodeImage, fileByteCache, selectedVariant } from '@buildapp/source-package'
import type { SourcePackage } from '@buildapp/source-package'
import { analyzeSourcePackage } from '@buildapp/source-analyzer'
import { nullVisionReasoner } from '@buildapp/source-vision'
import { extractMetricEvidence } from '@buildapp/source-metrics'
import { serializeModel } from '@buildapp/model'
import { reconstructV2, verifyReplay } from '../src/index.js'

const value = (argv: readonly string[], name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const url = value(argv, 'url')
  const packagePath = value(argv, 'package')
  const graphPath = value(argv, 'graph')
  const cacheDir = value(argv, 'cache') ?? join(process.cwd(), '.cache', 'source-bytes')
  const outDir = value(argv, 'out') ?? join(process.cwd(), 'stage-reports', 'artifacts', 'analyzer-v2')
  const slug = value(argv, 'slug') ?? 'candidate'
  const label = value(argv, 'label') ?? 'Automatic candidate v2'
  const modelId = value(argv, 'model-id')
  await mkdir(outDir, { recursive: true })
  const cache = fileByteCache(cacheDir)

  let pkg: SourcePackage
  if (packagePath && existsSync(packagePath)) {
    pkg = SourcePackageSchema.parse(JSON.parse(await readFile(packagePath, 'utf8')))
    process.stdout.write(`source package: replayed from ${packagePath}\n`)
  } else if (url) {
    pkg = await acquireSourcePackage(url, [archonAdapter], { cache })
    process.stdout.write(`source package: acquired from ${url}\n`)
  } else {
    throw new Error('give either --url or --package')
  }
  const bytesFor = async (assetUrl: string): Promise<{ bytes: Uint8Array; mediaType: string } | null> => cache.get(assetUrl)
  const graph = graphPath && existsSync(graphPath) ? JSON.parse(await readFile(graphPath, 'utf8')) : (await analyzeSourcePackage(pkg, { bytes: bytesFor, vision: nullVisionReasoner() })).graph
  process.stdout.write(`observations: ${graph.observations.length} on ${graph.coordinateFrames.length} frames (${graph.contentHash.slice(0, 16)})\n`)

  const rasterCache = new Map<string, ReturnType<typeof decodeImage> | undefined>()
  for (const asset of pkg.assets) {
    const variant = selectedVariant(asset)
    const fetched = await cache.get(variant.url)
    if (!fetched) continue
    try {
      rasterCache.set(variant.byteHash, decodeImage(fetched.bytes))
    } catch {
      rasterCache.set(variant.byteHash, undefined)
    }
  }
  const metrics = extractMetricEvidence({ sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph, slug, raster: (frame) => rasterCache.get(frame.variantByteHash), specifications: pkg.publishedSpecifications, pageHash: pkg.pageHash })
  process.stdout.write(`metric evidence: ${metrics.evidence.length} readings (${metrics.evidence.filter((e) => e.kind === 'OPENING_CALLOUT').length} callouts), ${metrics.chains.length} chains, ${metrics.coordinateRegistrations.length} registrations (${metrics.contentHash.slice(0, 16)})\n`)

  const result = reconstructV2({
    debug: process.env.V2_DEBUG ? (message) => process.stderr.write(`  · ${message}\n`) : undefined,
    ...(modelId ? { modelId } : {}),
    label,
    slug,
    sourcePackageId: pkg.id,
    sourcePackageHash: pkg.contentHash,
    graph,
    metrics,
    raster: (frame) => rasterCache.get(frame.variantByteHash),
    publishedAreas: pkg.publishedFacts,
    publishedRooms: pkg.publishedRooms,
  })
  const replay = verifyReplay(result.candidate)
  const b = result.building
  process.stdout.write(`v2 candidate: ${result.candidate.program.length} commands, model ${result.candidate.modelHash.slice(0, 16)}, replay ${replay.ok ? 'byte-identical' : `FAILED: ${replay.reason}`}\n`)
  process.stdout.write(`  ${b.masses.length} masses, ${b.recesses.length} recess readings, ${b.returns.length} returns, ${b.openings.length} openings (+${b.sharedDoors.length} shared), ${b.interior.reduce((a, i) => a + i.walls.length, 0)} partitions, ${b.interior.reduce((a, i) => a + i.doors.length, 0)} interior doors, ${b.interior.reduce((a, i) => a + i.rooms.length, 0)} rooms, stair ${b.stair ? b.stair.emit : 'none'}, ${b.chimneys.length} chimneys, ${b.rooflights.length} rooflights, ${b.balconies.length} balconies/terraces, ${b.railings.length} railings, ${b.verges.length} verges, ${b.portalHeads.length} portal heads\n`)
  for (const s of result.steps) process.stdout.write(`  [${s.stage}] ${s.method}: ${s.detail.slice(0, 220)}\n`)
  process.stdout.write(`  ${result.unresolved.length} named holes; ledger ${JSON.stringify(result.ledger.summary)}; graph violations ${result.violations.graph.length}, ledger violations ${result.violations.ledger.length}\n`)
  for (const v of result.violations.graph.slice(0, 8)) process.stdout.write(`    graph: ${v}\n`)
  for (const v of result.violations.ledger.slice(0, 8)) process.stdout.write(`    ledger: ${v}\n`)

  const write = async (name: string, data: unknown): Promise<void> => {
    await writeFile(join(outDir, name), `${stableJson(data)}\n`, 'utf8')
    process.stdout.write(`  wrote ${name}\n`)
  }
  await write(`${slug}-auto-v2.json`, result.candidate)
  await write(`${slug}-layout.json`, result.layout)
  await write(`${slug}-metrics.json`, metrics)
  await write(`${slug}-building.json`, result.building)
  await write('feature-lineage.json', result.featureGraph)
  await write('evidence-consumption.json', result.ledger)
  await write('feature-quality.json', result.quality)
  await write('source-view-residuals.json', { candidateHash: result.candidate.contentHash, residuals: result.residuals })
  await write('repair-trace.json', result.repair)
  await write('assembly-closure.json', { schema: 'buildapp.assembly-closure', schemaVersion: '1.0.0', candidateHash: result.candidate.contentHash, decisions: result.closure, facadeGraph: result.building.facadeGraph, terraces: result.building.terraces, massTones: result.building.massTones, frameTones: result.building.frameTones })
  await write('registrations.json', { ...result.registrations, plans: result.registrations.plans.map((p) => ({ frameId: p.frameId, assetId: p.assetId, storeyIndex: p.storeyIndex, mppX: p.mppX, mppY: p.mppY, originPx: p.originPx, wallPx: p.wallPx, why: p.why })), world: result.world })
  await write(`${slug}-hypotheses-v2.json`, result.hypotheses)
  await writeFile(join(outDir, `${slug}-model.json`), serializeModel(result.model), 'utf8')
  process.stdout.write(`  wrote ${slug}-model.json\n`)
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
})
