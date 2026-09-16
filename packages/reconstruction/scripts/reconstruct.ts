/**
 * `npm run reconstruct -- --url <project url>`
 *
 * The production path, end to end: acquire the sources (or replay them from
 * the byte cache), read what was seen, read what was printed, solve, seal, and
 * write the artifacts out.
 *
 * The boundary §2 draws runs through this file and no lower. Everything this
 * script CALLS is generic — the acquisition layer, the analyzer, the metric
 * reader, the solver — and none of it knows which project it is looking at.
 * This script may name a URL because somebody has to; it may not tell the
 * solver anything about what it expects to find there, and it does not.
 *
 * Evaluation against a reference model is a separate script, run afterwards,
 * on the sealed candidate.
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
import { auditProjection, reconstruct, registerElevationFrames, verifyReplay } from '../src/index.js'

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
  const outDir = value(argv, 'out') ?? join(process.cwd(), 'stage-reports', 'artifacts', 'reconstruction')
  const slug = value(argv, 'slug') ?? 'candidate'
  const label = value(argv, 'label') ?? 'Automatic candidate'
  await mkdir(outDir, { recursive: true })
  const cache = fileByteCache(cacheDir)

  // --- the source package ---
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

  // --- the observation graph ---
  const graph = graphPath && existsSync(graphPath) ? JSON.parse(await readFile(graphPath, 'utf8')) : (await analyzeSourcePackage(pkg, { bytes: bytesFor, vision: nullVisionReasoner() })).graph
  process.stdout.write(`observations: ${graph.observations.length} on ${graph.coordinateFrames.length} frames (${graph.contentHash.slice(0, 16)})\n`)

  // --- metric evidence, read from the same sealed bytes ---
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
  const metrics = extractMetricEvidence({
    sourcePackageId: pkg.id,
    sourcePackageHash: pkg.contentHash,
    graph,
    slug,
    raster: (frame) => rasterCache.get(frame.variantByteHash),
    specifications: pkg.publishedSpecifications,
    pageHash: pkg.pageHash,
  })
  process.stdout.write(`metric evidence: ${metrics.evidence.length} readings, ${metrics.chains.length} chains, ${metrics.coordinateRegistrations.length} registrations (${metrics.contentHash.slice(0, 16)})\n`)

  // --- the candidate ---
  const { layout, hypotheses, candidate, model } = reconstruct({
    label,
    slug,
    sourcePackageId: pkg.id,
    sourcePackageHash: pkg.contentHash,
    graph,
    metrics,
    raster: (frame) => rasterCache.get(frame.variantByteHash),
    publishedAreas: pkg.publishedFacts,
  })
  const replay = verifyReplay(candidate)
  process.stdout.write(`structural layout: ${layout.masses.length} masses, ${layout.roofSupports.length} roofs, ${layout.storeys.length} storeys, gate ${layout.gate.status} (${layout.contentHash.slice(0, 16)})\n`)
  for (const mass of layout.masses) process.stdout.write(`  ${mass.id} ${mass.role} ${mass.widthM.value} x ${mass.depthM.value} m, storeys ${mass.storeySpan.fromIndex}..${mass.storeySpan.toIndex}\n`)
  for (const roof of layout.roofSupports) process.stdout.write(`  ${roof.id} ${roof.kind}${roof.pitchDeg ? ` ${roof.pitchDeg.value} deg` : ''}${roof.ridgeAxis ? ` ridge ${roof.ridgeAxis}` : ''} [${roof.authority}]\n`)
  for (const reason of layout.gate.reasons) process.stdout.write(`  [${reason.severity}] ${reason.code}: ${reason.what}\n`)
  process.stdout.write(`hypotheses: ${hypotheses.hypotheses.length} (${hypotheses.contentHash.slice(0, 16)})\n`)
  process.stdout.write(`candidate: ${candidate.program.length} commands, model ${candidate.modelHash.slice(0, 16)}, replay ${replay.ok ? 'byte-identical' : `FAILED: ${replay.reason}`}\n`)
  process.stdout.write(`  ${candidate.residuals.hard} hard, ${candidate.residuals.soft} soft, ${candidate.residuals.unresolved} unresolved quantities; ${candidate.unresolved.length} named holes; ${candidate.contradictions.length} contradictions\n`)

  // --- projection audit ---
  const massing = {
    width: candidate.quantities.find((q) => q.parameter === 'width')?.value ?? 0,
    depth: candidate.quantities.find((q) => q.parameter === 'depth')?.value ?? 0,
    totalHeight: model.levels.reduce((a, l) => Math.max(a, l.elevation + l.height), 0) + (model.roofs[0] ? Math.max(0, 0) : 0),
  }
  const heights = model.levels.reduce((a, l) => Math.max(a, l.elevation + l.height), 0)
  const ridge = model.roofs[0] ? heights + (Math.tan(((model.roofs[0].pitchDeg ?? 0) * Math.PI) / 180) * (model.roofs[0].ridgeAxis === 'X' ? massing.depth : massing.width)) / 2 : heights
  const { registrations } = registerElevationFrames(graph, { ...massing, totalHeight: ridge })
  const audit = auditProjection(model, graph, registrations, candidate.contentHash)
  process.stdout.write(`projection audit: ${audit.summary.matched}/${audit.summary.objects} openings land on an observation, mean overlap ${audit.summary.iouMean}, centres ${audit.summary.centreRmsM} m rms, ${audit.summary.unexplained} observed openings unexplained\n`)

  // --- artifacts ---
  const write = async (name: string, data: unknown): Promise<void> => {
    await writeFile(join(outDir, name), `${stableJson(data)}\n`, 'utf8')
    process.stdout.write(`  wrote ${name}\n`)
  }
  await write(`${slug}-metrics.json`, metrics)
  await write(`${slug}-layout.json`, layout)
  await write(`${slug}-hypotheses.json`, hypotheses)
  await write(`${slug}-candidate.json`, candidate)
  await write(`${slug}-dsl.json`, { schema: 'buildapp.reconstruction-dsl', candidateId: candidate.id, candidateHash: candidate.contentHash, modelHash: candidate.modelHash, program: candidate.program })
  await write(`${slug}-projection-audit.json`, audit)
  await writeFile(join(outDir, `${slug}-model.json`), serializeModel(model), 'utf8')
  process.stdout.write(`  wrote ${slug}-model.json\n`)
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
})
