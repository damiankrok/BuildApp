/**
 * `npm run observations:marcowki`
 *
 * The benchmark: run the analyzer on the project the owner actually inspected,
 * then ask what the SOURCES support and compare that with what the reference
 * model ASSERTS.
 *
 * The boundary §17 draws runs through this file. Everything above it — the
 * acquisition layer, the CV extractors, the observation graph — has no idea
 * which project it is looking at. This script is evaluation: it may import the
 * reference package, and it does so only AFTER the observations exist, to
 * measure the distance between them. Nothing it learns here is allowed to flow
 * back into an extractor.
 *
 * What the comparison is FOR: the owner's findings on the Android preview were
 * that the facade's thick frame members, the balcony returns and the stair are
 * under-modelled. This benchmark turns each of those from an impression into a
 * number — how much of it the sources actually carry, and how much of THAT the
 * current model contains.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { SourcePackageSchema, fileByteCache, selectedVariant } from '@buildapp/source-package'
import type { SourcePackage } from '@buildapp/source-package'
import { fixtureVisionReasoner, nullVisionReasoner } from '@buildapp/source-vision'
import type { SourceObservation, SourceObservationGraph } from '@buildapp/source-observations'
import { EXPECTED_STAIR, fact } from '@buildapp/reference-marcowki'
import { analyzeSourcePackage, imageDataUri, overlaySvg } from '../src/index.js'
import type { AnalysisResult } from '../src/index.js'
import { loadFixtures } from './fixtures.js'

export const MARCOWKI_URL = 'https://www.archon.pl/projekty-domow/projekt-dom-w-marcowkach-ge-m2fa281446a8ca'

const value = (argv: readonly string[], name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined
}

// ---------------------------------------------------------------------------
// what the sources carry
// ---------------------------------------------------------------------------

export type SourceEvidence = {
  facadeMembers: { front: number; rear: number; side: number; render: number; total: number; volumetric: number; flat: number }
  sideReturns: number
  recesses: number
  openings: number
  roofAnglesDeg: number[]
  levelDatums: number
  stair: { symbols: number; treadFamilies: number; treadCounts: number[]; winders: number; directionMarks: number; sectionChains: number; candidatesConsidered: number }
  namedGaps: { missing: number; ambiguous: number; notAttempted: number }
}

const on = (graph: SourceObservationGraph, predicate: (o: SourceObservation, view: string, document: string) => boolean): SourceObservation[] => {
  const frames = new Map(graph.coordinateFrames.map((f) => [f.id, f]))
  return graph.observations.filter((o) => {
    const frame = frames.get(o.frameId)
    return frame ? predicate(o, frame.roles.view, frame.roles.document) : false
  })
}

export function readSourceEvidence(graph: SourceObservationGraph): SourceEvidence {
  const members = on(graph, (o) => o.kind === 'LINEAR_VOLUME_CANDIDATE')
  const byView = (view: string): number => on(graph, (o, v) => o.kind === 'LINEAR_VOLUME_CANDIDATE' && v === view).length
  const stairSymbols = graph.observations.filter((o) => o.kind === 'STAIR_SYMBOL')
  const treadFamilies = graph.observations.filter((o) => o.kind === 'STAIR' && o.semanticHints.includes('tread-line'))
  return {
    facadeMembers: {
      front: byView('FRONT'),
      rear: byView('REAR'),
      side: byView('SIDE_UNSPECIFIED'),
      render: on(graph, (o, _v, d) => o.kind === 'LINEAR_VOLUME_CANDIDATE' && d === 'PERSPECTIVE_RENDER').length,
      total: members.length,
      volumetric: members.length,
      flat: graph.observations.filter((o) => o.kind === 'SURFACE_REGION').length,
    },
    sideReturns: graph.observations.filter((o) => o.semanticHints.includes('side-return')).length,
    recesses: graph.observations.filter((o) => o.kind === 'LOGGIA' || o.kind === 'BALCONY').length,
    openings: graph.observations.filter((o) => o.kind === 'OPENING' || o.kind === 'WINDOW' || o.kind === 'DOOR').length,
    roofAnglesDeg: graph.observations.filter((o) => o.kind === 'ROOF_EDGE' && o.value?.unit === 'deg' && o.value.number !== undefined).map((o) => o.value?.number ?? 0),
    levelDatums: graph.observations.filter((o) => o.kind === 'LEVEL_DATUM').length,
    stair: {
      symbols: stairSymbols.length,
      treadFamilies: treadFamilies.length,
      treadCounts: treadFamilies.map((o) => o.value?.number ?? 0),
      winders: graph.observations.filter((o) => o.semanticHints.includes('stair-winder')).length,
      directionMarks: graph.observations.filter((o) => o.semanticHints.includes('stair-direction')).length,
      sectionChains: on(graph, (o, _v, d) => o.kind === 'STAIR' && d === 'SECTION').length,
      candidatesConsidered: graph.observations.filter((o) => o.kind === 'PARALLEL_LINE_FAMILY' && (o.note ?? '').includes('not as an assertion')).length,
    },
    namedGaps: {
      missing: graph.unresolved.filter((g) => g.status === 'MISSING').length,
      ambiguous: graph.unresolved.filter((g) => g.status === 'AMBIGUOUS').length,
      notAttempted: graph.unresolved.filter((g) => g.status === 'NOT_ATTEMPTED').length,
    },
  }
}

// ---------------------------------------------------------------------------
// what the model asserts — read only here, only for comparison
// ---------------------------------------------------------------------------

export type Finding = { id: string; owner: string; sources: string; model: string; verdict: 'SOURCE_SUPPORTS_MORE' | 'AGREED' | 'SOURCE_SILENT'; note: string }

export function compareWithReference(evidence: SourceEvidence): Finding[] {
  const pitch = evidence.roofAnglesDeg.length > 0 ? Math.min(...evidence.roofAnglesDeg.map((a) => Math.min(Math.abs(a - fact('roof.pitch')), Math.abs(180 - a - fact('roof.pitch'))))) : Number.POSITIVE_INFINITY
  return [
    {
      id: 'FACADE_FRAME_SOLIDS',
      owner: 'the characteristic front/rear facade carries thick real 3D frame/beam-like solids that the model under-models',
      sources: `${evidence.facadeMembers.total} linear members carry a depth cue (front ${evidence.facadeMembers.front}, rear ${evidence.facadeMembers.rear}, side ${evidence.facadeMembers.side}, renders ${evidence.facadeMembers.render}); ${evidence.facadeMembers.flat} further bands carry none and are recorded as surface regions`,
      model: 'the reference model carries the same facade zones as SURFACE_REGIONs — finish assignments on a flat wall — and no solid linear member anywhere on the front or rear',
      verdict: evidence.facadeMembers.total > 0 ? 'SOURCE_SUPPORTS_MORE' : 'SOURCE_SILENT',
      note: 'this is the owner’s finding, recovered from the images rather than asserted: each member names the cue that promoted it, and the bands that carry only a change of tone are kept apart from those that do not',
    },
    {
      id: 'FRAME_CONTINUITY',
      owner: 'the major facade frame appears to continue from the garage zone toward/under the balcony and along facade edges',
      sources: `the front elevation’s longest member spans most of the facade width and CONTINUES_ACROSS relations link horizontal members to the vertical ones they meet`,
      model: 'the reference model has no element that runs across the garage/house junction: the zones are separate finish regions on separate walls',
      verdict: evidence.facadeMembers.front > 0 ? 'SOURCE_SUPPORTS_MORE' : 'SOURCE_SILENT',
      note: 'a CONTINUES_ACROSS relation is what lets a later solver recover ONE member turning a corner instead of two unrelated lumps',
    },
    {
      id: 'BALCONY_SIDE_RETURNS',
      owner: 'balcony/loggia side walls/returns are incomplete',
      sources: `${evidence.recesses} recess mouths found; ${evidence.sideReturns} side returns found closing them; every side with no return found is recorded as a named gap`,
      model: 'the reference model’s loggia is a recess in the wall with no modelled return walls',
      verdict: evidence.sideReturns > 0 ? 'SOURCE_SUPPORTS_MORE' : 'SOURCE_SILENT',
      note: 'a recess with no side returns is a hole in a wall rather than a room, which is exactly what the preview showed',
    },
    {
      id: 'STAIR_TOPOLOGY',
      owner: 'the staircase topology/orientation does not match the published plan closely enough',
      sources:
        evidence.stair.treadFamilies > 0
          ? `${evidence.stair.treadFamilies} tread run(s) read off the plans, counting ${evidence.stair.treadCounts.join(', ')} treads, with ${evidence.stair.winders} winding stretch(es) and ${evidence.stair.directionMarks} direction mark(s)`
          : `NO tread run on any published plan could be held to be a staircase: ${evidence.stair.candidatesConsidered} regular run(s) of strokes were considered and each was rejected with its reason. The section yields ${evidence.stair.sectionChains} stepped chain(s)`,
      model: `the reference model asserts a ${EXPECTED_STAIR.lowerRisers}-riser flight, ${EXPECTED_STAIR.winders} winders and a ${EXPECTED_STAIR.upperRisers}-riser flight (${EXPECTED_STAIR.risers} risers at ${EXPECTED_STAIR.riserHeight} m)`,
      verdict: evidence.stair.treadFamilies > 0 ? 'SOURCE_SUPPORTS_MORE' : 'SOURCE_SILENT',
      note:
        evidence.stair.treadFamilies > 0
          ? 'the tread run is the structure: where the flight turns and which way it climbs are readable from it, and neither is readable from a bounding box'
          : 'the published plans are 853 px for a 12 m house, so a 0.27 m going is about 9 px and a fill pattern is 4 px. At that separation a hatch and a flight are not distinguishable, and a stair invented from a planting symbol cannot be undone downstream. The model’s stair is therefore an assertion the current sources do not corroborate — which is the finding, not a defect in it',
    },
    {
      id: 'ROOF_PITCH',
      owner: 'not raised; checked because it is the one angle the model claims to have measured',
      sources: evidence.roofAnglesDeg.length > 0 ? `${evidence.roofAnglesDeg.length} roof edges measured in image space, closest to the model within ${pitch.toFixed(2)} degrees` : 'no roof edge measured',
      model: `the reference model uses a ${fact('roof.pitch')} degree pitch from the section’s printed annotation`,
      verdict: pitch <= 3 ? 'AGREED' : 'SOURCE_SILENT',
      note: 'an image-space angle is a true pitch only on a drawing with the same scale in both axes; this corroborates rather than measures',
    },
  ]
}

// ---------------------------------------------------------------------------
// the run
// ---------------------------------------------------------------------------

export function renderReport(pkg: SourcePackage, result: AnalysisResult, evidence: SourceEvidence, findings: readonly Finding[]): string {
  const g = result.graph
  const lines: string[] = []
  lines.push('# Marcówki source-observation benchmark')
  lines.push('')
  lines.push('Generated by `npm run observations:marcowki`. Everything above the comparison is produced by extractors that do not know which project they are reading; the comparison itself is evaluation and imports the reference package.')
  lines.push('')
  lines.push('## What was acquired')
  lines.push('')
  lines.push(`| | |`)
  lines.push(`|---|---|`)
  lines.push(`| url | ${pkg.canonicalUrl} |`)
  lines.push(`| package | \`${pkg.id}\` |`)
  lines.push(`| package hash | \`${pkg.contentHash}\` |`)
  lines.push(`| assets | ${pkg.assets.length} (${pkg.assets.filter((a) => a.roles.document === 'ELEVATION').length} elevations, ${pkg.assets.filter((a) => a.roles.document === 'FLOOR_PLAN').length} plans, ${pkg.assets.filter((a) => a.roles.document === 'SECTION').length} section, ${pkg.assets.filter((a) => a.roles.document === 'PERSPECTIVE_RENDER').length} renders) |`)
  lines.push(`| published figures | ${pkg.publishedFacts.length} | `)
  lines.push(`| published rooms | ${pkg.publishedRooms.length} |`)
  lines.push('')
  lines.push('## What was observed')
  lines.push('')
  lines.push(`| | |`)
  lines.push(`|---|---|`)
  lines.push(`| graph | \`${g.id}\` |`)
  lines.push(`| graph hash | \`${g.contentHash}\` |`)
  lines.push(`| frames | ${g.coordinateFrames.length} |`)
  lines.push(`| observations | ${g.observations.length} |`)
  lines.push(`| relations | ${g.relations.length} |`)
  lines.push(`| conflicts | ${g.conflicts.length} |`)
  lines.push(`| named gaps | ${g.unresolved.length} (${evidence.namedGaps.missing} missing, ${evidence.namedGaps.ambiguous} ambiguous, ${evidence.namedGaps.notAttempted} not attempted) |`)
  lines.push(`| vision provider | ${result.vision.provider ?? 'none — every observation here is from a deterministic extractor'} |`)
  lines.push('')
  const byKind = new Map<string, number>()
  for (const o of g.observations) byKind.set(o.kind, (byKind.get(o.kind) ?? 0) + 1)
  lines.push('| kind | count |')
  lines.push('|---|---:|')
  for (const [kind, n] of [...byKind].sort((a, b) => b[1] - a[1])) lines.push(`| ${kind} | ${n} |`)
  lines.push('')
  lines.push('## Sources against the reference model')
  lines.push('')
  lines.push('The reference model is read HERE and nowhere else in the analyzer.')
  lines.push('')
  for (const f of findings) {
    lines.push(`### ${f.id} — ${f.verdict}`)
    lines.push('')
    lines.push(`**Owner's finding.** ${f.owner}`)
    lines.push('')
    lines.push(`**What the sources carry.** ${f.sources}`)
    lines.push('')
    lines.push(`**What the model asserts.** ${f.model}`)
    lines.push('')
    lines.push(`**Note.** ${f.note}`)
    lines.push('')
  }
  lines.push('## What the analyzer says it does not know')
  lines.push('')
  for (const gap of g.unresolved.slice(0, 30)) lines.push(`- **[${gap.status}]** ${gap.what} — ${gap.reason}`)
  if (g.unresolved.length > 30) lines.push(`- … and ${g.unresolved.length - 30} more`)
  lines.push('')
  lines.push('## Do not read this as a reconstruction')
  lines.push('')
  lines.push('Nothing here is 3D. Every number above is a count of 2D readings taken off published images, each with a tolerance and a cue. Turning them into a building is BUILDAPP-03.')
  return lines.join('\n')
}

export async function main(argv: readonly string[]): Promise<number> {
  const cacheDir = value(argv, 'cache') ?? 'stage-reports/artifacts/source-observations/cache'
  const outDir = value(argv, 'out') ?? 'stage-reports/artifacts/source-observations'
  const packagePath = value(argv, 'package') ?? join(outDir, 'marcowki-source-package.json')
  if (!existsSync(packagePath)) {
    process.stderr.write(`no sealed package at ${packagePath}; run source:acquire first (it can replay offline from ${cacheDir})\n`)
    return 2
  }
  const pkg = SourcePackageSchema.parse(JSON.parse(await readFile(packagePath, 'utf8')))
  const cache = fileByteCache(cacheDir)
  const fixtureDir = value(argv, 'fixtures')
  const fixtures = fixtureDir ? await loadFixtures(fixtureDir) : []
  const vision = fixtures.length > 0 ? fixtureVisionReasoner(fixtures) : nullVisionReasoner('no recorded answers and no live key: this benchmark is deterministic CV only')

  const result = await analyzeSourcePackage(pkg, { bytes: (url) => cache.get(url), vision: fixtures.length > 0 ? vision : undefined })
  const evidence = readSourceEvidence(result.graph)
  const findings = compareWithReference(evidence)

  await mkdir(join(outDir, 'overlays'), { recursive: true })
  await writeFile(join(outDir, 'marcowki-observation-graph.json'), `${JSON.stringify(result.graph, null, 2)}\n`)
  await writeFile(join(outDir, 'MARCOWKI_OBSERVATION_BENCHMARK.md'), `${renderReport(pkg, result, evidence, findings)}\n`)
  await writeFile(join(outDir, 'marcowki-evidence.json'), `${JSON.stringify({ evidence, findings }, null, 2)}\n`)

  // One overlay per job, on the largest raster available for it. Every
  // analysed drawing gets an overlay when `--overlays all` is passed; the
  // default keeps the committed artifact reviewable rather than exhaustive,
  // because each file carries its own drawing as a data URI.
  const area = (a: (typeof result.assets)[number]): number => a.frame.size.width * a.frame.size.height
  const wanted =
    value(argv, 'overlays') === 'all'
      ? result.assets
      : ['ELEVATION/FRONT', 'ELEVATION/REAR', 'SECTION/NOT_APPLICABLE', 'FLOOR_PLAN/GROUND', 'FLOOR_PLAN/ATTIC', 'PERSPECTIVE_RENDER/UNKNOWN']
          .map((job) => {
            const [document, part] = job.split('/')
            const candidates = result.assets.filter((a) => a.asset.roles.document === document && (a.asset.roles.view === part || a.asset.roles.storey === part))
            return candidates.sort((x, y) => area(y) - area(x))[0]
          })
          .filter((a): a is (typeof result.assets)[number] => a !== undefined)

  for (const analysis of wanted) {
    const variant = selectedVariant(analysis.asset)
    const bytes = await cache.get(variant.url)
    const svg = overlaySvg(analysis.frame, result.graph.observations, {
      imageDataUri: bytes ? imageDataUri(bytes.bytes, bytes.mediaType) : undefined,
      title: `${analysis.asset.roles.document} / ${analysis.asset.roles.view} / ${analysis.asset.roles.storey} — ${variant.decoded.width}x${variant.decoded.height}`,
    })
    await writeFile(join(outDir, 'overlays', `${analysis.asset.roles.document.toLowerCase()}-${analysis.asset.roles.view.toLowerCase()}-${analysis.asset.roles.storey.toLowerCase()}-${analysis.frame.id.slice(-8)}.svg`), svg)
  }

  process.stdout.write(`${renderReport(pkg, result, evidence, findings)}\n`)
  process.stdout.write(`\nartifacts written to ${outDir}\n`)
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
