/**
 * `npm run architecture:artifacts -- [--out <dir>] [--rarytasy <model.json>]`
 *
 * The stage 03G review record, written to `stage-reports/artifacts/architectural-assemblies`
 * (or `--out`):
 *
 *   capability-registry.json / .md   the capability registry, and the primitive,
 *                                    assembly and relationship registries it rests on
 *   fixture-results.json / .md       the seventeen synthetic diversity fixtures, each
 *                                    through validation, DSL replay, round trip,
 *                                    compile and the closure audit
 *   demos.json / .md                 the hypothesis pipeline demonstrations
 *   roof-graphs/<id>.json / .svg     the roof graph of every fixture, demo and
 *                                    regression project
 *   assembly-graphs/<id>.txt / .json the assembly tree and graph of the same
 *   regression-summary.json / .md    Marcówki (the sealed auto v3 candidate) and,
 *                                    with --rarytasy, the second house's live model
 *
 * Exits 1 when a fixture or a demo fails: the gate CI runs.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stableJson } from '@buildapp/source-common'
import { loadModel, serializeModel, type CanonicalBuildingModel } from '@buildapp/model'
import { compileBuilding, geometryClosureAudit } from '@buildapp/geometry'
import { modelOf } from '@buildapp/candidates'
import { ASSEMBLY_REGISTRY, CAPABILITY_REGISTRY, PRIMITIVE_REGISTRY, RELATIONSHIP_REGISTRY, assemblyGraph, assemblyTree, primitiveCounts, roofGraphSvg, roofGraphsOf } from '../src/index.js'
import { ALL_DEMOS, ALL_FIXTURES, runDemo, runFixture } from '../src/fixtures/index.js'
import { sha256Hex } from '@buildapp/source-common'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined
}
const out = resolve(ROOT, arg('out') ?? 'stage-reports/artifacts/architectural-assemblies')
for (const d of ['', 'roof-graphs', 'assembly-graphs']) mkdirSync(join(out, d), { recursive: true })
const json = (name: string, data: unknown): void => writeFileSync(join(out, name), `${stableJson(data)}\n`)
const text = (name: string, data: string): void => writeFileSync(join(out, name), data.endsWith('\n') ? data : `${data}\n`)
const cell = (s: unknown): string => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ')

function graphs(id: string, title: string, m: CanonicalBuildingModel): { roofGraphs: number; classifications: string[] } {
  const rg = roofGraphsOf(m)
  json(`roof-graphs/${id}.json`, { schema: 'buildapp.roof-graph', schemaVersion: '1.0.0', modelId: m.id, modelSchemaVersion: m.schemaVersion, roofs: rg })
  text(`roof-graphs/${id}.svg`, roofGraphSvg(title, rg))
  text(`assembly-graphs/${id}.txt`, assemblyTree(m))
  json(`assembly-graphs/${id}.json`, { schema: 'buildapp.assembly-graph', schemaVersion: '1.0.0', modelId: m.id, ...assemblyGraph(m) })
  return { roofGraphs: rg.length, classifications: rg.map((g) => `${g.id}: ${g.classification}${g.classification !== g.derivedClassification ? ` (graph reads ${g.derivedClassification})` : ''} [${g.source}]`) }
}

// --- registries
json('capability-registry.json', { schema: 'buildapp.architecture-registries', schemaVersion: '1.0.0', capabilities: CAPABILITY_REGISTRY, primitives: PRIMITIVE_REGISTRY, assemblies: ASSEMBLY_REGISTRY, relationships: RELATIONSHIP_REGISTRY })
text(
  'capability-registry.md',
  [
    '# Capability registry (stage 03G)',
    '',
    'Status: what the model, DSL, compiler and closure audit can represent and prove. Recognition: what produces it from real sources today — `ANALYZER_V2` (the production analyzer), `SYNTHETIC_PIPELINE` (the hypothesis pipeline, demonstrated on synthetic evidence only), `NONE`.',
    '',
    '| capability | status | recognition | required evidence | exclusions | emits | fixtures | demos | known gaps |',
    '|---|---|---|---|---|---|---|---|---|',
    ...CAPABILITY_REGISTRY.map((c) => `| ${c.key} | ${c.status} | ${c.recognition} | ${cell(c.evidenceRequirements.filter((r) => r.required).map((r) => `${r.description} (≥${r.minCount}${r.crossView ? ', two frames' : ''})`).join('; '))} | ${cell(c.exclusions.join(', ') || '—')} | ${cell(c.emittedSemanticTypes.join(', '))} | ${cell(c.fixtures.join(', ') || '—')} | ${cell(c.demos.join(', ') || '—')} | ${cell(c.knownGaps.join('; ') || '—')} |`),
    '',
  ].join('\n'),
)

// --- fixtures
let failed = 0
const fixtureRuns = ALL_FIXTURES.map((f) => {
  const { run, model } = runFixture(f)
  if (!run.ok) failed += 1
  return { ...run, graphs: graphs(`fixture-${f.id}`, f.title, model) }
})
json('fixture-results.json', { schema: 'buildapp.architecture-fixture-results', schemaVersion: '1.0.0', fixtures: fixtureRuns })
text(
  'fixture-results.md',
  [
    '# Synthetic architectural diversity fixtures',
    '',
    '| fixture | result | capabilities | assemblies | relationships | replay | round trip | triangles | closure (ext. errors / warnings) | relationships held | roof joins closed | roofs |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...fixtureRuns.map((r) => `| ${r.id} | ${r.ok ? 'PASS' : `FAIL: ${cell(r.failures.join('; '))}`} | ${r.capabilities.join(', ')} | ${cell(Object.entries(r.assemblies).map(([k, n]) => `${k}×${n}`).join(', '))} | ${r.relationships} | ${r.replayDeterministic ? 'same hash' : 'DIFFERS'} | ${r.roundTrip ? 'same hash' : 'DIFFERS'} | ${r.compile.triangles} | ${r.closure.exteriorErrors} / ${r.closure.exteriorWarnings} | ${r.closure.architecture ? `${r.closure.architecture.relationshipsSatisfied}/${r.closure.architecture.relationshipsChecked}` : '—'} | ${r.closure.architecture ? `${r.closure.architecture.roofJoinsClosed}/${r.closure.architecture.roofJoinsChecked}` : '—'} | ${cell(r.roofClassifications.join(', '))} |`),
    '',
  ].join('\n'),
)

// --- demos
const demoRuns = ALL_DEMOS.map((d) => {
  const r = runDemo(d)
  if (!r.ok) failed += 1
  const { model, result, ...rest } = r
  graphs(`demo-${d.id}`, d.title, model)
  return { ...rest, quantities: result.quantities.length, groups: result.groups.length }
})
json('demos.json', { schema: 'buildapp.architecture-demos', schemaVersion: '1.0.0', note: 'synthetic evidence only: the plumbing a detector plugs into, not production recognition', demos: demoRuns })
text(
  'demos.md',
  [
    '# Hypothesis pipeline demonstrations (synthetic evidence)',
    '',
    'observation → hypothesis → fusion → topology → metric solve → Building DSL. The evidence is synthetic; this is not production recognition.',
    '',
    '| demo | result | proposals | decisions | added assemblies | DSL commands | conflicts recorded | closure errors | roof graph = truth |',
    '|---|---|---|---|---|---|---|---|---|',
    ...demoRuns.map((r) => `| ${r.id} | ${r.ok ? 'PASS' : `FAIL: ${cell(r.failures.join('; '))}`} | ${r.proposals} | ${cell(r.hypotheses.map((h) => `${h.decision}${h.family ? ` ${h.family}` : ''} (${h.confidence})`).join(', '))} | ${cell(Object.entries(r.addedAssemblies).map(([k, n]) => `${k}×${n}`).join(', '))} | ${r.commands} | ${r.conflicts.length} | ${r.closureErrors} | ${r.roofTruth ? (r.roofTruth.match ? `yes (${r.roofTruth.fixture})` : 'NO') : '—'} |`),
    '',
    ...demoRuns.flatMap((r) => [`## ${r.id}`, '', r.title, '', ...r.hypotheses.flatMap((h) => [`- ${h.id} ${h.decision}${h.family ? ` ${h.family}` : ''}: ${h.reasons.join('; ')}`, ...h.alternatives.map((a) => `  - or ${a.kind} (${a.confidence}): ${a.why}`)]), ...r.conflicts.map((c) => `- conflict ${c.key}: kept ${c.kept}, lost ${c.lost} — ${c.why}`), '']),
  ].join('\n'),
)

// --- regressions
type Regression = { project: string; source: string; modelId: string; schemaVersion: string; modelHash: string; primitives: Record<string, number>; assemblies: number; relationships: number; graphs: ReturnType<typeof graphs>; closure: { exteriorErrors: number; findings: number }; note: string }
const regressions: Regression[] = []
const regression = (project: string, source: string, m: CanonicalBuildingModel, note: string): void => {
  const scene = compileBuilding(m)
  const closure = geometryClosureAudit(m, scene)
  regressions.push({
    project,
    source,
    modelId: m.id,
    schemaVersion: m.schemaVersion,
    modelHash: sha256Hex(serializeModel(m)),
    primitives: primitiveCounts(m) as Record<string, number>,
    assemblies: m.assemblies.length,
    relationships: m.relationships.length,
    graphs: graphs(`regression-${project}`, `${project} (${source})`, m),
    closure: { exteriorErrors: closure.findings.filter((f) => f.scope === 'EXTERIOR' && f.severity === 'ERROR').length, findings: closure.findings.length },
    note,
  })
}
regression('marcowki-auto-v3', 'sealed candidate marcowki-auto-v3', modelOf('marcowki-auto-v3'), 'the production analyzer emits the legacy rectangular Roof; its plane graph is derived (LEGACY_ROOF), the model holds no assemblies yet')
const rarytasy = arg('rarytasy')
if (rarytasy && existsSync(rarytasy)) {
  const r = loadModel(readFileSync(rarytasy, 'utf8'))
  if (r.ok) regression('rarytasy', `live run model ${rarytasy}`, r.model, 'the second regression house, live through the production pipeline')
  else console.error(`--rarytasy ${rarytasy}: not a valid model`)
} else if (rarytasy) console.log(`::warning::no Rarytasy model at ${rarytasy}; its regression graphs are not written`)
json('regression-summary.json', { schema: 'buildapp.architecture-regressions', schemaVersion: '1.0.0', regressions })
text(
  'regression-summary.md',
  [
    '# Real-project regressions',
    '',
    '| project | source | schema | model hash | roofs | primitives | assemblies | relationships | closure exterior errors | note |',
    '|---|---|---|---|---|---|---|---|---|---|',
    ...regressions.map((r) => `| ${r.project} | ${cell(r.source)} | ${r.schemaVersion} | ${r.modelHash.slice(0, 16)} | ${cell(r.graphs.classifications.join('; '))} | ${cell(Object.entries(r.primitives).map(([k, n]) => `${k} ${n}`).join(', '))} | ${r.assemblies} | ${r.relationships} | ${r.closure.exteriorErrors} | ${cell(r.note)} |`),
    '',
  ].join('\n'),
)
text(
  'README.md',
  [
    '# architectural-assemblies (stage 03G)',
    '',
    `- ${fixtureRuns.filter((r) => r.ok).length}/${fixtureRuns.length} synthetic diversity fixtures pass (fixture-results.md)`,
    `- ${demoRuns.filter((r) => r.ok).length}/${demoRuns.length} hypothesis pipeline demonstrations pass (demos.md) — synthetic evidence only`,
    `- ${CAPABILITY_REGISTRY.length} capabilities: ${['SUPPORTED', 'PARTIAL', 'UNKNOWN'].map((s) => `${CAPABILITY_REGISTRY.filter((c) => c.status === s).length} ${s}`).join(', ')} (capability-registry.md)`,
    `- regression projects: ${regressions.map((r) => r.project).join(', ')} (regression-summary.md)`,
    '- roof graphs: roof-graphs/*.json and *.svg; assembly trees and graphs: assembly-graphs/*.txt and *.json',
    '',
  ].join('\n'),
)
console.log(`architectural-assemblies → ${out}: fixtures ${fixtureRuns.filter((r) => r.ok).length}/${fixtureRuns.length}, demos ${demoRuns.filter((r) => r.ok).length}/${demoRuns.length}, regressions ${regressions.map((r) => r.project).join(', ')}`)
if (failed > 0) process.exit(1)
