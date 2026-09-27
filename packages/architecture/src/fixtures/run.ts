/**
 * Runs one architectural fixture through the whole production path and says
 * what held: its DSL program applies and replays to the same model, the
 * model validates and survives a serialize → parse round trip, the compiler
 * emits it without an error diagnostic, the closure audit finds no exterior
 * error and every declared relationship and roof join holds, and the model
 * carries the assemblies, primitives, roof classifications and relationships
 * the fixture expects.
 */
import { applyCommands } from '@buildapp/commands'
import { createEmptyModel, parseModel, serializeModel, validateModel, type AssemblyKind, type CanonicalBuildingModel, type RoofClassification } from '@buildapp/model'
import { compileBuilding, geometryClosureAudit, type ClosureReport, type CompiledScene } from '@buildapp/geometry'
import { sha256Hex } from '@buildapp/source-common'
import { primitiveCounts, type PrimitiveType } from '../registry/primitives.js'
import { roofGraphsOf, type RoofGraph } from '../graphs/roof-graph.js'
import type { ArchitecturalFixture } from './types.js'

export type FixtureRun = {
  id: string
  title: string
  capabilities: string[]
  ok: boolean
  failures: string[]
  commandCount: number
  modelHash: string
  replayDeterministic: boolean
  roundTrip: boolean
  validation: { errors: number; warnings: number; warningCodes: string[] }
  compile: { meshes: number; triangles: number; errors: string[]; warnings: string[] }
  closure: {
    exteriorErrors: number
    exteriorWarnings: number
    interiorFindings: number
    findings: Array<{ code: string; severity: string; objects: string[]; measure: number; unit: string }>
    architecture: ClosureReport['architecture']
  }
  assemblies: Partial<Record<AssemblyKind, number>>
  primitives: Partial<Record<PrimitiveType, number>>
  roofClassifications: RoofClassification[]
  derivedRoofClassifications: RoofClassification[]
  relationships: number
}

export type FixtureOutput = { run: FixtureRun; model: CanonicalBuildingModel; scene: CompiledScene; closure: ClosureReport; roofGraphs: RoofGraph[] }

const hashOf = (m: CanonicalBuildingModel): string => `sha256:${sha256Hex(serializeModel(m))}`

/** Build a fixture's model from its DSL program; throws with the failing command when one refuses. */
export function buildFixture(f: ArchitecturalFixture): CanonicalBuildingModel {
  const commands = f.commands()
  const r = applyCommands(createEmptyModel(`fixture-${f.id}`, f.title, 'buildapp-architecture-fixtures'), commands)
  if (r.failedAt !== undefined) {
    const res = r.results[r.failedAt]
    const errs = res && !res.ok ? res.errors.map((e) => `[${e.code}] ${e.message}`).join('; ') : '?'
    throw new Error(`${f.id}: command ${r.failedAt} (${commands[r.failedAt]?.type}) refused: ${errs}`)
  }
  return r.model
}

export function runFixture(f: ArchitecturalFixture): FixtureOutput {
  const failures: string[] = []
  const commands = f.commands()
  const model = buildFixture(f)
  const again = buildFixture(f)
  const hash = hashOf(model)
  const replayDeterministic = hashOf(again) === hash && JSON.stringify(f.commands()) === JSON.stringify(commands)
  if (!replayDeterministic) failures.push('DSL replay is not deterministic')
  const v = validateModel(model)
  const errors = v.issues.filter((i) => i.severity === 'ERROR')
  const warnings = v.issues.filter((i) => i.severity === 'WARNING')
  if (!v.ok) failures.push(`model invalid: ${errors.map((e) => `[${e.code}] ${e.message}`).join('; ')}`)
  if (warnings.length > 0) failures.push(`validation warnings: ${warnings.map((e) => `[${e.code}] ${e.message}`).join('; ')}`)
  const roundTrip = hashOf(parseModel(serializeModel(model))) === hash
  if (!roundTrip) failures.push('serialize → parse round trip changed the model')
  const scene = compileBuilding(model)
  const cErrors = scene.diagnostics.filter((d) => d.severity === 'ERROR').map((d) => `[${d.code}] ${d.objectId ?? ''} ${d.message}`)
  const cWarnings = scene.diagnostics.filter((d) => d.severity === 'WARNING').map((d) => `[${d.code}] ${d.objectId ?? ''} ${d.message}`)
  if (cErrors.length > 0) failures.push(`compile errors: ${cErrors.join('; ')}`)
  if (cWarnings.length > 0) failures.push(`compile warnings: ${cWarnings.join('; ')}`)
  const closure = geometryClosureAudit(model, scene)
  const exterior = closure.findings.filter((x) => x.scope === 'EXTERIOR')
  const exteriorErrors = exterior.filter((x) => x.severity === 'ERROR')
  const exteriorWarnings = exterior.filter((x) => x.severity === 'WARNING')
  if (exteriorErrors.length > 0) failures.push(`closure errors: ${exteriorErrors.map((x) => `${x.code} ${x.objects.join('×')} ${x.measure}${x.unit}`).join('; ')}`)
  if (exteriorWarnings.length > 0) failures.push(`closure warnings: ${exteriorWarnings.map((x) => `${x.code} ${x.objects.join('×')} ${x.measure}${x.unit}`).join('; ')}`)
  const arch = closure.architecture
  if (arch && arch.relationshipsSatisfied !== arch.relationshipsChecked) failures.push(`relationships: ${arch.relationshipsSatisfied}/${arch.relationshipsChecked} satisfied`)
  if (arch && arch.roofJoinsClosed !== arch.roofJoinsChecked) failures.push(`roof joins: ${arch.roofJoinsClosed}/${arch.roofJoinsChecked} closed`)

  const assemblies: Partial<Record<AssemblyKind, number>> = {}
  for (const a of model.assemblies) assemblies[a.kind] = (assemblies[a.kind] ?? 0) + 1
  const primitives = primitiveCounts(model)
  for (const [kind, n] of Object.entries(f.expect.assemblies)) if ((assemblies[kind as AssemblyKind] ?? 0) !== n) failures.push(`expected ${n} ${kind} assemblies, found ${assemblies[kind as AssemblyKind] ?? 0}`)
  for (const kind of Object.keys(assemblies)) if (!(kind in f.expect.assemblies)) failures.push(`unexpected ${kind} assembly`)
  for (const [type, n] of Object.entries(f.expect.primitives)) if ((primitives[type as PrimitiveType] ?? 0) !== n) failures.push(`expected ${n} ${type}, found ${primitives[type as PrimitiveType] ?? 0}`)
  const roofGraphs = roofGraphsOf(model)
  const planeGraphs = roofGraphs.filter((g) => g.source === 'ROOF_ASSEMBLY')
  const roofClassifications = planeGraphs.map((g) => g.classification)
  const derivedRoofClassifications = planeGraphs.map((g) => g.derivedClassification)
  if (f.expect.roofClassifications && JSON.stringify(roofClassifications) !== JSON.stringify(f.expect.roofClassifications)) failures.push(`roof classifications ${roofClassifications.join(',')} ≠ expected ${f.expect.roofClassifications.join(',')}`)
  planeGraphs.forEach((g) => {
    if (g.classification !== g.derivedClassification) failures.push(`roof ${g.id} is stated ${g.classification} but its plane graph reads ${g.derivedClassification}`)
  })
  if (model.relationships.length < f.expect.minRelationships) failures.push(`expected ≥ ${f.expect.minRelationships} relationships, found ${model.relationships.length}`)

  const run: FixtureRun = {
    id: f.id,
    title: f.title,
    capabilities: [...f.capabilities],
    ok: failures.length === 0,
    failures,
    commandCount: commands.length,
    modelHash: hash,
    replayDeterministic,
    roundTrip,
    validation: { errors: errors.length, warnings: warnings.length, warningCodes: warnings.map((w) => w.code) },
    compile: { meshes: scene.stats.meshCount, triangles: scene.stats.triangleCount, errors: cErrors, warnings: cWarnings },
    closure: {
      exteriorErrors: exteriorErrors.length,
      exteriorWarnings: exteriorWarnings.length,
      interiorFindings: closure.findings.length - exterior.length,
      findings: closure.findings.map((x) => ({ code: x.code, severity: x.severity, objects: x.objects, measure: x.measure, unit: x.unit })),
      architecture: arch,
    },
    assemblies,
    primitives,
    roofClassifications,
    derivedRoofClassifications,
    relationships: model.relationships.length,
  }
  return { run, model, scene, closure, roofGraphs }
}
