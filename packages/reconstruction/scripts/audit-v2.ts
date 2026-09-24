/**
 * `npm run audit:analyzer-v2 [-- --artifacts <dir> --slug <slug>]`
 *
 * Reads the analyzer-v2 artifacts back off disk and holds them to what §24
 * says they are: a candidate that validates and replays to the model it was
 * sealed with, a layout the candidate names by hash, a feature graph and a
 * ledger whose invariants hold, a quality entry for every solved feature, no
 * provenance that could only have come from a benchmark, and the §29 block
 * conditions stated STRUCTURALLY — a roof that reaches the zones it has
 * recesses at, returns on every ground-storey recess, an interior with
 * partitions and rooms, assumptions that are named, members that were seen,
 * a repair loop that moved nothing the sources fixed, and a residuals file
 * that is not empty.
 *
 * Every check prints one line; any failure exits non-zero. Nothing here knows
 * a figure of any building: the checks are about the SHAPE of the artefacts.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { serializeModel } from '@buildapp/model'
import type { MetricEvidenceSet } from '@buildapp/source-metrics'
import type { SourceObservationGraph } from '@buildapp/source-observations'
import {
  ArchitecturalEvidenceGraphSchema,
  EvidenceConsumptionLedgerSchema,
  FeatureQualityReportSchema,
  MeasurementMethodSchema,
  ProvenanceStatusSchema,
  ReconstructionCandidateSchema,
  featureGraphViolations,
  ledgerViolations,
  verifyReplay,
} from '../src/index.js'
import type { ArchitecturalEvidenceGraph, BuildingV2, EvidenceConsumptionLedger, FeatureQualityReport, ReconstructionCandidate, RepairTrace, SourceViewResidual, StructuralLayoutHypothesisSet } from '../src/index.js'

const value = (argv: readonly string[], name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined
}

type Check = { name: string; ok: boolean; detail: string }
const checks: Check[] = []
const check = (name: string, ok: boolean, detail = ''): void => {
  checks.push({ name, ok, detail })
  process.stdout.write(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `: ${detail}` : ''}\n`)
}
const list = (items: readonly string[], max = 6): string => (items.length <= max ? items.join('; ') : `${items.slice(0, max).join('; ')}; … ${items.length - max} more`)

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T

/** Every value under a key named `provenance`, anywhere in a JSON tree. */
function provenanceValues(node: unknown, path: string, out: Array<{ path: string; value: string }>): void {
  if (Array.isArray(node)) {
    node.forEach((n, i) => provenanceValues(n, `${path}[${i}]`, out))
    return
  }
  if (!node || typeof node !== 'object') return
  for (const [key, v] of Object.entries(node as Record<string, unknown>)) {
    const here = path ? `${path}.${key}` : key
    if (key === 'provenance' || key === 'parameterProvenance') {
      if (typeof v === 'string') out.push({ path: here, value: v })
      else if (v && typeof v === 'object') for (const [k, s] of Object.entries(v as Record<string, unknown>)) if (typeof s === 'string') out.push({ path: `${here}.${k}`, value: s })
      continue
    }
    provenanceValues(v, here, out)
  }
}

function main(): void {
  const argv = process.argv.slice(2)
  const artifacts = resolve(value(argv, 'artifacts') ?? 'stage-reports/artifacts/analyzer-v2')
  const slug = value(argv, 'slug') ?? 'marcowki'
  const observationGraphPath = resolve(value(argv, 'graph') ?? join('stage-reports', 'artifacts', 'source-observations', `${slug}-observation-graph.json`))
  const at = (name: string): string => join(artifacts, name)
  process.stdout.write(`auditing ${artifacts} (slug ${slug})\n`)

  const required = [`${slug}-auto-v2.json`, `${slug}-layout.json`, `${slug}-building.json`, `${slug}-metrics.json`, 'feature-lineage.json', 'evidence-consumption.json', 'feature-quality.json', 'source-view-residuals.json', 'repair-trace.json']
  const missing = required.filter((n) => !existsSync(at(n)))
  check('every §24 artifact is on disk', missing.length === 0, missing.length > 0 ? `missing ${missing.join(', ')}` : `${required.length} files`)
  if (missing.length > 0) return

  const candidate = readJson<ReconstructionCandidate>(at(`${slug}-auto-v2.json`))
  const layout = readJson<StructuralLayoutHypothesisSet>(at(`${slug}-layout.json`))
  const building = readJson<BuildingV2>(at(`${slug}-building.json`))
  const metrics = readJson<MetricEvidenceSet>(at(`${slug}-metrics.json`))
  const graph = readJson<ArchitecturalEvidenceGraph>(at('feature-lineage.json'))
  const ledger = readJson<EvidenceConsumptionLedger>(at('evidence-consumption.json'))
  const quality = readJson<FeatureQualityReport>(at('feature-quality.json'))
  const residualsFile = readJson<{ candidateHash: string; residuals: SourceViewResidual[] }>(at('source-view-residuals.json'))
  const repair = readJson<RepairTrace>(at('repair-trace.json'))
  const observationGraph = existsSync(observationGraphPath) ? readJson<SourceObservationGraph>(observationGraphPath) : undefined

  // --- the candidate ---------------------------------------------------------
  const parsed = ReconstructionCandidateSchema.safeParse(candidate)
  check('the candidate validates against ReconstructionCandidateSchema', parsed.success, parsed.success ? `${candidate.program.length} commands, solver ${candidate.solver.name}@${candidate.solver.version}` : list(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)))
  const replay = verifyReplay(candidate)
  check('the candidate replays byte-identical to the model it was sealed with', replay.ok, replay.ok ? `model ${candidate.modelHash.slice(0, 16)}` : replay.reason)
  const modelPath = at(`${slug}-model.json`)
  if (replay.ok && existsSync(modelPath)) {
    const onDisk = readFileSync(modelPath, 'utf8')
    check(`the committed ${slug}-model.json is the replayed model, byte for byte`, onDisk === serializeModel(replay.model), onDisk === serializeModel(replay.model) ? `${onDisk.length} bytes` : 'the file on disk differs from what the program builds')
  }
  check("the layout's contentHash is the candidate's structuralLayoutHash", layout.contentHash === candidate.structuralLayoutHash && layout.id === candidate.structuralLayoutId, layout.contentHash === candidate.structuralLayoutHash ? `${layout.contentHash.slice(0, 16)}, ${candidate.structuralStatus}` : `layout ${layout.contentHash.slice(0, 16)} vs candidate ${candidate.structuralLayoutHash.slice(0, 16)}`)
  const hashLinks: string[] = []
  if (candidate.metricEvidenceHash !== metrics.contentHash) hashLinks.push(`candidate.metricEvidenceHash ≠ ${slug}-metrics.json`)
  if (graph.metricEvidenceHash !== metrics.contentHash) hashLinks.push(`feature graph metricEvidenceHash ≠ ${slug}-metrics.json`)
  if (observationGraph) {
    if (candidate.observationGraphHash !== observationGraph.contentHash) hashLinks.push('candidate.observationGraphHash ≠ the observation graph')
    if (graph.observationGraphHash !== observationGraph.contentHash) hashLinks.push('feature graph observationGraphHash ≠ the observation graph')
    if (metrics.observationGraphHash !== observationGraph.contentHash) hashLinks.push('metrics.observationGraphHash ≠ the observation graph')
  }
  if (ledger.featureGraphHash !== graph.contentHash) hashLinks.push('ledger.featureGraphHash ≠ feature-lineage.json')
  if (quality.featureGraphHash !== graph.contentHash) hashLinks.push('quality.featureGraphHash ≠ feature-lineage.json')
  if (residualsFile.candidateHash !== candidate.contentHash) hashLinks.push('residuals.candidateHash ≠ the candidate')
  check('every artifact names the exact inputs it was made from', hashLinks.length === 0, hashLinks.length === 0 ? `${observationGraph ? 'observation graph, ' : ''}metrics, feature graph, ledger, quality and residuals all chain by hash` : list(hashLinks))

  // --- the feature graph, the ledger, the quality report --------------------
  const graphParsed = ArchitecturalEvidenceGraphSchema.safeParse(graph)
  check('the feature graph validates against its schema', graphParsed.success, graphParsed.success ? `${graph.sightings.length} sightings, ${graph.hypotheses.length} hypotheses, ${graph.solved.length} solved, ${graph.bindings.length} bindings, ${graph.relations.length} relations` : list(graphParsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)))
  const graphViolations = featureGraphViolations(graph)
  check('featureGraphViolations(graph) is empty', graphViolations.length === 0, graphViolations.length === 0 ? '' : list(graphViolations))

  const ledgerParsed = EvidenceConsumptionLedgerSchema.safeParse(ledger)
  check('the ledger validates against its schema', ledgerParsed.success, ledgerParsed.success ? `${ledger.records.length} records` : list(ledgerParsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)))
  const expectedIds = [...(observationGraph ? observationGraph.observations.map((o) => o.id) : []), ...metrics.evidence.map((e) => e.id)]
  const ledgerV = ledgerViolations(ledger.records, expectedIds)
  check(`ledgerViolations(ledger, ${observationGraph ? 'every observation and metric evidence id' : 'every metric evidence id; the observation graph is not on disk'}) is empty`, ledgerV.length === 0, ledgerV.length === 0 ? `${expectedIds.length} expected ids all dispositioned once` : list(ledgerV))
  const solvedIds = new Set(graph.solved.map((s) => s.id))
  const usedInModel = ledger.records.filter((r) => r.disposition === 'USED_IN_MODEL')
  const usedUnknown = usedInModel.filter((r) => !r.featureId || !solvedIds.has(r.featureId))
  check('every USED_IN_MODEL record names a solved feature of the graph', usedUnknown.length === 0, usedUnknown.length === 0 ? `${usedInModel.length} records` : list(usedUnknown.map((r) => `${r.evidenceId} → ${r.featureId ?? 'nothing'}`)))

  const qualityParsed = FeatureQualityReportSchema.safeParse(quality)
  check('the quality report validates against its schema', qualityParsed.success, qualityParsed.success ? `${quality.records.length} records` : list(qualityParsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)))
  const qualityIds = new Set(quality.records.map((r) => r.featureId))
  const withoutQuality = [...solvedIds].filter((id) => !qualityIds.has(id))
  const withoutFeature = [...qualityIds].filter((id) => !solvedIds.has(id))
  check('every solved feature has a quality entry, and every quality entry a solved feature', withoutQuality.length === 0 && withoutFeature.length === 0, withoutQuality.length === 0 && withoutFeature.length === 0 ? `${solvedIds.size} features` : list([...withoutQuality.map((id) => `${id} has no quality entry`), ...withoutFeature.map((id) => `${id} is graded but never solved`)]))

  // --- provenance vocabulary ---------------------------------------------------
  const BENCHMARK_KIND = /REFERENCE|BENCHMARK|GOLD|TRUTH|MARC/i
  const provenanceOffenders: string[] = []
  for (const s of graph.solved) {
    if (!ProvenanceStatusSchema.safeParse(s.provenance).success || BENCHMARK_KIND.test(s.provenance)) provenanceOffenders.push(`${s.id}: ${s.provenance}`)
    for (const [k, p] of Object.entries(s.parameterProvenance)) if (!ProvenanceStatusSchema.safeParse(p).success || BENCHMARK_KIND.test(p)) provenanceOffenders.push(`${s.id}.${k}: ${p}`)
  }
  for (const m of graph.measurements) if (!MeasurementMethodSchema.safeParse(m.method).success || BENCHMARK_KIND.test(m.method)) provenanceOffenders.push(`measurement ${m.id}: ${m.method}`)
  const buildingProvenance: Array<{ path: string; value: string }> = []
  provenanceValues(building, '', buildingProvenance)
  for (const p of buildingProvenance) if (!ProvenanceStatusSchema.safeParse(p.value).success || BENCHMARK_KIND.test(p.value)) provenanceOffenders.push(`building.${p.path}: ${p.value}`)
  check('no feature carries a reference or benchmark provenance', provenanceOffenders.length === 0, provenanceOffenders.length === 0 ? `${graph.solved.length} features, ${graph.measurements.length} measurements and ${buildingProvenance.length} building fields all in the source vocabulary` : list(provenanceOffenders))

  // --- §29 block conditions, structurally --------------------------------------
  const roof = building.mainRoof
  check('§29 a main roof was solved', roof !== undefined, roof ? `${roof.kind} over ${roof.massId}, ridge along ${roof.ridgeAxis}` : 'building.mainRoof is missing')
  if (roof) {
    const endSides: Array<BuildingV2['recesses'][number]['side']> = roof.ridgeAxis === 'Z' ? ['FRONT', 'REAR'] : ['WEST', 'EAST']
    const recessesAtEnds = building.recesses.filter((r) => endSides.includes(r.side))
    check("§29 the main roof covers the zones when recesses stand at the roof's ends", recessesAtEnds.length === 0 || roof.coversZones, recessesAtEnds.length === 0 ? `no recess at the ${endSides.join('/').toLowerCase()} ends; nothing to cover` : roof.coversZones ? `${recessesAtEnds.length} recesses at the ${endSides.join('/').toLowerCase()} ends, coversZones = true (${roof.coversZonesWhy})` : `${recessesAtEnds.length} recesses at the ${endSides.join('/').toLowerCase()} ends but coversZones = false (${roof.coversZonesWhy})`)
  }
  const groundIndex = building.levels.length > 0 ? Math.min(...building.levels.map((l) => l.index)) : 0
  const groundRecesses = building.recesses.filter((r) => r.storeyIndex === groundIndex)
  const groundWithoutReturns = groundRecesses.filter((r) => r.returns.length === 0 || !building.returns.some((w) => w.recessId === r.id && w.storeyIndex === groundIndex))
  check('§29 every ground-storey recess has return walls', groundRecesses.length > 0 && groundWithoutReturns.length === 0, groundRecesses.length === 0 ? 'no recess was read on the ground storey' : groundWithoutReturns.length === 0 ? groundRecesses.map((r) => `${r.side.toLowerCase()} ${r.returns.length} returns`).join(', ') : list(groundWithoutReturns.map((r) => `${r.id} (${r.side.toLowerCase()}) has ${r.returns.length} returns read and ${building.returns.filter((w) => w.recessId === r.id).length} emitted`)))
  const partitions = building.interior.reduce((a, i) => a + i.walls.length, 0)
  const rooms = building.interior.reduce((a, i) => a + i.rooms.length, 0)
  const doors = building.interior.reduce((a, i) => a + i.doors.length, 0)
  const storeyWithBoth = building.interior.some((i) => i.walls.length > 0 && i.rooms.length >= 2)
  check('§29 the interior has partitions and rooms', storeyWithBoth, `${partitions} partitions, ${doors} interior doors, ${rooms} rooms on ${building.interior.length} storey readings${storeyWithBoth ? '' : '; no storey has both partitions and at least two rooms'}`)
  const ASSUMED = new Set(['UNRESOLVED', 'ASSUMED_FOR_RENDERING'])
  const openings = [...building.openings, ...building.sharedDoors]
  const unnamed = openings.filter((o) => (ASSUMED.has(o.provenance.head) || ASSUMED.has(o.provenance.sill)) && o.unresolved.length === 0)
  const assumedCount = openings.filter((o) => ASSUMED.has(o.provenance.head) || ASSUMED.has(o.provenance.sill)).length
  check('§29 every opening with an assumed or unresolved sill or head names it in `unresolved`', unnamed.length === 0, unnamed.length === 0 ? `${assumedCount} of ${openings.length} openings assume something, all of them say so` : list(unnamed.map((o) => `${o.id} (head ${o.provenance.head}, sill ${o.provenance.sill})`)))
  const hypothesisById = new Map(graph.hypotheses.map((h) => [h.id, h]))
  const members = graph.solved.filter((s) => s.family === 'FACADE_MEMBER' || s.family === 'ROOF_MEMBER')
  const unseen = members.filter((s) => (hypothesisById.get(s.hypothesisId)?.sightingIds.length ?? 0) === 0 && s.sourceCoverage.sightings === 0)
  check('§29 every facade and roof member was sighted at least once', unseen.length === 0, unseen.length === 0 ? `${members.length} members` : list(unseen.map((s) => `${s.id} (${s.family})`)))
  const PROPERTY: Record<string, 'sill' | 'head'> = { sillY: 'sill', headY: 'head', headFarY: 'head' }
  const repairOffenders: string[] = []
  let appliedCount = 0
  for (const it of repair.iterations) {
    for (const op of it.applied) {
      appliedCount += 1
      const opening = openings.find((o) => o.id === op.featureId)
      const solved = graph.solved.find((s) => s.id === op.featureId || s.id === `feat-${op.featureId}`)
      for (const key of Object.keys(op.before)) {
        if (op.before[key] === op.after[key]) continue
        const property = PROPERTY[key]
        if (!opening) {
          repairOffenders.push(`${op.kind} on ${op.featureId}.${key}: no such opening in the building`)
          continue
        }
        const provenance = property ? opening.provenance[property] : undefined
        if (provenance === 'SOURCE_EXACT') repairOffenders.push(`${op.kind} moved ${op.featureId}.${key} from ${op.before[key]} to ${op.after[key]} although its ${property} is SOURCE_EXACT`)
        if (solved && solved.parameterProvenance[key] === 'SOURCE_EXACT') repairOffenders.push(`${op.kind} moved ${op.featureId}.${key} although the graph records ${key} as SOURCE_EXACT`)
      }
    }
  }
  const refusedCount = repair.iterations.reduce((a, i) => a + i.refused.length, 0)
  check('§29 the repair loop changed no SOURCE_EXACT property', repairOffenders.length === 0, repairOffenders.length === 0 ? `${appliedCount} applied, ${refusedCount} refused over ${repair.iterations.length} round${repair.iterations.length === 1 ? '' : 's'}, converged ${repair.converged}` : list(repairOffenders))
  const residuals = residualsFile.residuals
  check('§29 the source-view residuals file is not empty', residuals.length > 0, `${residuals.length} residuals, ${residuals.filter((r) => !r.withinTolerance).length} outside tolerance`)

  // --- summary ---------------------------------------------------------------
  const levels = ['L0', 'L1', 'L2'] as const
  process.stdout.write('\nfeatures per family per quality level\n')
  process.stdout.write(`  ${'family'.padEnd(18)}${levels.map((l) => l.padStart(5)).join('')}${'total'.padStart(7)}\n`)
  const families = Object.keys(quality.summary).sort()
  const totals: Record<string, number> = { L0: 0, L1: 0, L2: 0 }
  for (const family of families) {
    const row = quality.summary[family]
    const total = levels.reduce((a, l) => a + (row[l] ?? 0), 0)
    for (const l of levels) totals[l] += row[l] ?? 0
    process.stdout.write(`  ${family.padEnd(18)}${levels.map((l) => String(row[l] ?? 0).padStart(5)).join('')}${String(total).padStart(7)}\n`)
  }
  process.stdout.write(`  ${'all'.padEnd(18)}${levels.map((l) => String(totals[l]).padStart(5)).join('')}${String(quality.records.length).padStart(7)}\n`)
  process.stdout.write('\nledger dispositions\n')
  for (const [disposition, n] of Object.entries(ledger.summary).sort((a, b) => b[1] - a[1])) process.stdout.write(`  ${disposition.padEnd(22)}${String(n).padStart(6)}\n`)
  process.stdout.write(`  ${'total'.padEnd(22)}${String(ledger.records.length).padStart(6)}\n`)
  process.stdout.write('\nsource-view residuals\n')
  process.stdout.write(`  ${'kind'.padEnd(18)}${'within'.padStart(8)}${'outside'.padStart(9)}\n`)
  for (const kind of [...new Set(residuals.map((r) => r.kind))].sort()) {
    const ofKind = residuals.filter((r) => r.kind === kind)
    process.stdout.write(`  ${kind.padEnd(18)}${String(ofKind.filter((r) => r.withinTolerance).length).padStart(8)}${String(ofKind.filter((r) => !r.withinTolerance).length).padStart(9)}\n`)
  }
  process.stdout.write(`  ${'all'.padEnd(18)}${String(residuals.filter((r) => r.withinTolerance).length).padStart(8)}${String(residuals.filter((r) => !r.withinTolerance).length).padStart(9)}\n`)
}

try {
  main()
} catch (error: unknown) {
  process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`)
  process.exitCode = 1
}
const failed = checks.filter((c) => !c.ok)
process.stdout.write(`\n${checks.length - failed.length} of ${checks.length} checks passed${failed.length > 0 ? `; ${failed.length} FAILED: ${failed.map((c) => c.name).join(' | ')}` : ''}\n`)
if (failed.length > 0) process.exitCode = 1
