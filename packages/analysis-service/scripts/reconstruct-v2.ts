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
import { archonAdapter, fileByteCache } from '@buildapp/source-package'
import { serializeModel } from '@buildapp/model'
import { hashesOf, runAnalysis } from '@buildapp/analysis-service'
import type { AnalysisInput, AnalysisRun } from '@buildapp/analysis-service'

const value = (argv: readonly string[], name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined
}

/**
 * A thin adapter: read the flags, call the one pipeline, write its artifacts.
 * There is no analysis in this file — `runAnalysis` is the same function the
 * analyzer HTTP API calls for every job.
 */
export async function cli(argv: readonly string[], log: (line: string) => void = (line) => process.stdout.write(line)): Promise<AnalysisRun> {
  const url = value(argv, 'url')
  const packagePath = value(argv, 'package')
  const graphPath = value(argv, 'graph')
  const cacheDir = value(argv, 'cache') ?? join(process.cwd(), '.cache', 'source-bytes')
  const outDir = value(argv, 'out') ?? join(process.cwd(), 'stage-reports', 'artifacts', 'analyzer-v2')
  const slug = value(argv, 'slug') ?? 'candidate'
  const label = value(argv, 'label') ?? 'Automatic candidate v2'
  const modelId = value(argv, 'model-id')
  await mkdir(outDir, { recursive: true })

  let input: AnalysisInput
  if (packagePath && existsSync(packagePath)) {
    const pkg = JSON.parse(await readFile(packagePath, 'utf8'))
    const graph = graphPath && existsSync(graphPath) ? JSON.parse(await readFile(graphPath, 'utf8')) : undefined
    input = { kind: 'PACKAGE', pkg, graph }
    log(`source package: replayed from ${packagePath}${graph ? ` with the graph ${graphPath}` : ''}\n`)
  } else if (url) {
    input = { kind: 'URL', url }
    log(`source package: acquiring ${url}\n`)
  } else {
    throw new Error('give either --url or --package')
  }

  const run = await runAnalysis(input, {
    adapters: [archonAdapter],
    cache: fileByteCache(cacheDir),
    identity: { slug, label, ...(modelId ? { modelId } : { modelId: `m-auto-v2-${slug}` }) },
    debug: process.env.V2_DEBUG ? (message) => process.stderr.write(`  · ${message}\n`) : undefined,
    progress: process.env.V2_PROGRESS ? (e) => process.stderr.write(`  ${(e.progress * 100).toFixed(0).padStart(3)}% ${e.stage}${e.detail ? ` — ${e.detail}` : ''}\n`) : undefined,
  })
  const { result: summary, graph, metrics, reconstruction: result } = run
  log(`observations: ${graph.observations.length} on ${graph.coordinateFrames.length} frames (${graph.contentHash.slice(0, 16)})\n`)
  log(`metric evidence: ${metrics.evidence.length} readings (${metrics.evidence.filter((e) => e.kind === 'OPENING_CALLOUT').length} callouts), ${metrics.chains.length} chains, ${metrics.coordinateRegistrations.length} registrations (${metrics.contentHash.slice(0, 16)})\n`)
  const b = result.building
  log(`v2 candidate: ${result.candidate.program.length} commands, model ${result.candidate.modelHash.slice(0, 16)}, replay ${summary.verification.replay.toLowerCase().replace('_', '-')}\n`)
  log(`  ${b.masses.length} masses, ${b.recesses.length} recess readings, ${b.returns.length} returns, ${b.openings.length} openings (+${b.sharedDoors.length} shared), ${b.interior.reduce((a, i) => a + i.walls.length, 0)} partitions, ${b.interior.reduce((a, i) => a + i.doors.length, 0)} interior doors, ${b.interior.reduce((a, i) => a + i.rooms.length, 0)} rooms, stair ${b.stair ? b.stair.emit : 'none'}, ${b.chimneys.length} chimneys, ${b.rooflights.length} rooflights, ${b.balconies.length} balconies/terraces, ${b.railings.length} railings, ${b.verges.length} verges, ${b.portalHeads.length} portal heads\n`)
  for (const s of result.steps) log(`  [${s.stage}] ${s.method}: ${s.detail.slice(0, 220)}\n`)
  log(`  ${result.unresolved.length} named holes; ledger ${JSON.stringify(result.ledger.summary)}; graph violations ${result.violations.graph.length}, ledger violations ${result.violations.ledger.length}\n`)
  for (const v of result.violations.graph.slice(0, 8)) log(`    graph: ${v}\n`)
  for (const v of result.violations.ledger.slice(0, 8)) log(`    ledger: ${v}\n`)
  for (const [k, h] of Object.entries(hashesOf(summary))) log(`  ${k.padEnd(22)} ${h}\n`)

  const write = async (name: string, data: unknown): Promise<void> => {
    await writeFile(join(outDir, name), `${stableJson(data)}\n`, 'utf8')
    log(`  wrote ${name}\n`)
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
  await write('assembly-closure.json', { schema: 'buildapp.assembly-closure', schemaVersion: '1.0.0', candidateHash: result.candidate.contentHash, decisions: result.closure, facadeGraph: result.building.facadeGraph, terraces: result.building.terraces, massTones: result.building.massTones, returnTones: result.building.returnTones })
  await write('registrations.json', { ...result.registrations, plans: result.registrations.plans.map((p) => ({ frameId: p.frameId, assetId: p.assetId, storeyIndex: p.storeyIndex, mppX: p.mppX, mppY: p.mppY, originPx: p.originPx, wallPx: p.wallPx, why: p.why })), world: result.world })
  await write(`${slug}-hypotheses-v2.json`, result.hypotheses)
  await writeFile(join(outDir, `${slug}-model.json`), serializeModel(result.model), 'utf8')
  log(`  wrote ${slug}-model.json\n`)
  return run
}

// Run directly: `vite-node <this file> -- <args>`. Under vitest the module is
// imported for `cli` and must not run.
if (!process.env.VITEST) {
  cli(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
    process.exitCode = 1
  })
}
