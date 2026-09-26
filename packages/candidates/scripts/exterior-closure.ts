/**
 * `npm run audit:exterior` — the exterior closure evaluation of the automatic
 * candidate under review against the one it replaces (stage BUILDAPP-03Y §19–20).
 *
 * Inputs, every one by path or through the sealed-candidate registry (which
 * replays each program and refuses one that does not rebuild its sealed model):
 *   --candidate  the candidate under review            (default marcowki-auto-v3)
 *   --baseline   the candidate it replaces             (default marcowki-auto-v2)
 *   --truth      research/marcowki-v2/marcowki-source-truth-v2.json
 *   --building   stage-reports/artifacts/analyzer-v2/marcowki-building.json   (the analyzer's building for the candidate)
 *   --closure    stage-reports/artifacts/analyzer-v2/assembly-closure.json    (the analyzer's closure decisions)
 *   --out        stage-reports/artifacts/analyzer-v2                          (the evaluation, .json and .md)
 *   --reports    stage-reports/artifacts/exterior-closure                     (the full closure report of each candidate)
 *
 * What it does:
 *  1. Compiles both candidates on the production path and runs the geometry
 *     closure audit on each: every pair of structural solids, every railing
 *     end, every terrace, every member (§4, §20).
 *  2. Reads the truth set's exterior items and compares the candidate with
 *     each, per category (§19): MASSING, ROOF, ROOF_EDGE_CLOSURE,
 *     WALL_SLAB_JOINTS, GARAGE_JOIN, RECESS_RETURNS, BALCONY, RAILING,
 *     TERRACE, FACADE_ASSEMBLY, OPENINGS, CHIMNEYS, ROOFLIGHTS,
 *     MATERIAL_READABILITY. Each category is PASS / PARTIAL / FAIL with the
 *     expected and emitted features, the closure violations that fall in it,
 *     and what is uncertain. No aggregate score: the categories are the result.
 *  3. Exits 1 when the candidate under review carries an EXTERIOR closure
 *     ERROR, or its program no longer replays — the gate Core CI runs.
 *
 * The truth set is benchmark data: it is read here, after sealing, to judge
 * the candidate, and never reaches the analyzer (the architecture tests hold
 * that). Owner-review observations are the same kind of signal (§18): they
 * name what to look at, not a value to produce.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stableJson } from '@buildapp/source-common'
import type { CanonicalBuildingModel } from '@buildapp/model'
import { compileBuilding, geometryClosureAudit, type ClosureFinding, type ClosureReport, type CompiledScene } from '@buildapp/geometry'
import { buildMobileSceneBundle, relativeLuminance, ADJACENT_GROUPS, MIN_ADJACENT_LUMINANCE_GAP } from '@buildapp/mobile-scene'
import { modelOf, sealedCandidate, sourceViewResidualsOf } from '../src/index.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

const argValue = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback
}

// ---------------------------------------------------------------------------
// types
// ---------------------------------------------------------------------------

type Status = 'PASS' | 'PARTIAL' | 'FAIL'
type Check = { name: string; source: string; expected: unknown; emitted: unknown; delta?: number; tolerance?: number; ok: boolean; critical?: boolean }
type Category = {
  category: string
  status: Status
  ownerObservation?: string
  expected: string[]
  emitted: string[]
  checks: Check[]
  closureViolations: Array<Pick<ClosureFinding, 'code' | 'severity' | 'objects' | 'relation' | 'measure' | 'unit' | 'message'>>
  baselineClosureViolations: number
  uncertainty: string[]
  notes: string[]
}

type TruthItem = { id: string; kind: string; name: string; value: Record<string, unknown>; status: string; uncertainty?: { m?: number; deg?: number } }
type Dict = Record<string, unknown>
type Building = {
  masses: Array<{ id: string; x0: number; x1: number; z0: number; z1: number; storeys: number[] }>
  mainRoof?: { kind: string; pitchDeg: number; ridgeAt: number; ridgeAxis?: string; eaveY: number; ridgeY?: number; footprint: { x0: number; x1: number; z0: number; z1: number } }
  attachedRoofs: Array<{ massId: string; footprint: { x0: number; x1: number; z0: number; z1: number }; parapetTopY?: number; reading?: { slabTopY?: number } }>
  returns: Array<{ id: string; side: string; storeyIndex: number; alongInterval: [number, number]; thicknessM: number }>
  verges: Array<{ id: string; depthM: number; member?: { heightM?: number; widthM?: number } } & Dict>
  balconies: Array<{ id: string; kind: string; side?: string; storeyIndex: number; x0: number; x1: number; z0: number; z1: number; topY: number; thicknessM: number; ends?: Array<{ kind: string; at: number; againstId?: string }> }>
  railings: Array<{ id: string; storeyIndex: number; start: { x: number; z: number }; end: { x: number; z: number }; path?: Array<{ x: number; z: number }>; baseY: number; heightM: number; hostId?: string }>
  portalHeads: Array<{ id: string; x0: number; x1: number; y0: number; y1: number; continuesFromId?: string }>
  terraces: Array<{ id: string; side: string; polygon: Array<{ x: number; z: number }>; topY: number; thicknessM: number; surface: string; edge: string; extension?: Dict; provenance: string }>
  openings: Array<{ id: string; facade: string; storeyIndex: number; interval: [number, number]; sillY: number; headY: number; profile?: string; kind?: string }>
  chimneys: Array<{ id: string; x0: number; x1: number; z0: number; z1: number; topY: number }>
  rooflights: Array<{ id: string; slope: string } & Dict>
  massTones: Array<{ massId: string; tone: string; share: number }>
  returnTones: Array<{ returnId: string; side: string; storeyIndex: number; tone: string; share: number }>
  facadeGraph: { nodes: Array<{ id: string; kind: string }>; edges: Array<{ from: string; to: string; kind: string; gapM?: number }> }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const round = (v: number, d = 3): number => Math.round(v * 10 ** d) / 10 ** d
const check = (name: string, source: string, expected: number, emitted: number | undefined, tolerance: number, critical = false): Check => {
  const delta = emitted === undefined ? undefined : round(emitted - expected)
  return { name, source, expected, emitted: emitted === undefined ? null : round(emitted), ...(delta === undefined ? {} : { delta }), tolerance, ok: delta !== undefined && Math.abs(delta) <= tolerance, ...(critical ? { critical } : {}) }
}
const flag = (name: string, source: string, expected: unknown, emitted: unknown, ok: boolean, critical = false): Check => ({ name, source, expected, emitted, ok, ...(critical ? { critical } : {}) })

/** The closure findings that belong to one category, by the relation they measure and the objects they name. */
function findingsFor(category: string, report: ClosureReport, model: CanonicalBuildingModel): ClosureFinding[] {
  const ext = report.findings.filter((f) => f.scope === 'EXTERIOR')
  const isKind = (id: string, kind: 'balcony' | 'railing' | 'terrace' | 'chimney' | 'rooflight' | 'linear' | 'return'): boolean => {
    if (kind === 'balcony') return model.balconies.some((b) => b.id === id)
    if (kind === 'railing') return model.railings.some((r) => r.id === id)
    if (kind === 'terrace') return model.terraces.some((t) => t.id === id)
    if (kind === 'chimney') return model.chimneys.some((c) => c.id === id)
    if (kind === 'rooflight') return model.rooflights.some((r) => r.id === id)
    if (kind === 'linear') return model.linearSolids.some((l) => l.id === id)
    return /return/i.test(id)
  }
  switch (category) {
    case 'ROOF':
      return ext.filter((f) => f.relation === 'WALL<->ROOF')
    case 'ROOF_EDGE_CLOSURE':
      return ext.filter((f) => f.relation === 'TRIM<->ROOF' || (f.relation === 'FACADE_FRAME<->HOST_FACADE' && f.objects.some((o) => /verge|fascia/i.test(o))))
    case 'WALL_SLAB_JOINTS':
      return ext.filter((f) => f.relation === 'WALL<->SLAB' || f.relation === 'WALL<->WALL')
    case 'GARAGE_JOIN':
      return ext.filter((f) => f.relation === 'MAIN_MASS<->ATTACHED_MASS' || f.relation === 'PARAPET<->FLAT_ROOF')
    case 'RECESS_RETURNS':
      return ext.filter((f) => f.relation === 'WALL<->RETURN_WALL')
    case 'BALCONY':
      return ext.filter((f) => f.relation === 'BALCONY_SLAB<->WALL' || f.relation === 'BALCONY_SLAB<->FASCIA' || f.objects.some((o) => isKind(o, 'balcony')))
    case 'RAILING':
      return ext.filter((f) => f.relation === 'RAILING<->BALCONY' || f.objects.some((o) => isKind(o, 'railing')))
    case 'TERRACE':
      return ext.filter((f) => f.relation === 'TERRACE<->WALL' || f.relation === 'TERRACE<->EXTERIOR_FLOOR_DATUM' || f.objects.some((o) => isKind(o, 'terrace')))
    case 'FACADE_ASSEMBLY':
      return ext.filter((f) => f.relation === 'FACADE_FRAME<->HOST_FACADE' || f.objects.some((o) => isKind(o, 'linear')))
    case 'CHIMNEYS':
      return ext.filter((f) => f.objects.some((o) => isKind(o, 'chimney')))
    case 'ROOFLIGHTS':
      return ext.filter((f) => f.objects.some((o) => isKind(o, 'rooflight')))
    case 'MASSING':
      return ext.filter((f) => f.code === 'NON_MANIFOLD' || f.code === 'SLIVER_TRIANGLES')
    default:
      return []
  }
}

function statusOf(c: Omit<Category, 'status'>): Status {
  if (c.closureViolations.some((f) => f.severity === 'ERROR')) return 'FAIL'
  if (c.checks.some((k) => !k.ok && k.critical)) return 'FAIL'
  if (c.checks.some((k) => !k.ok) || c.closureViolations.length > 0) return 'PARTIAL'
  return 'PASS'
}

const brief = (f: ClosureFinding) => ({ code: f.code, severity: f.severity, objects: f.objects, relation: f.relation, measure: f.measure, unit: f.unit, message: f.message })

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function main(): void {
  const candidateId = argValue('candidate', 'marcowki-auto-v3')
  const baselineId = argValue('baseline', 'marcowki-auto-v2')
  const truthPath = resolve(ROOT, argValue('truth', 'research/marcowki-v2/marcowki-source-truth-v2.json'))
  const buildingPath = resolve(ROOT, argValue('building', 'stage-reports/artifacts/analyzer-v2/marcowki-building.json'))
  const closurePath = resolve(ROOT, argValue('closure', 'stage-reports/artifacts/analyzer-v2/assembly-closure.json'))
  const outDir = resolve(ROOT, argValue('out', 'stage-reports/artifacts/analyzer-v2'))
  const reportsDir = resolve(ROOT, argValue('reports', 'stage-reports/artifacts/exterior-closure'))

  const sealed = sealedCandidate(candidateId)
  if (!sealed) throw new Error(`no sealed candidate ${candidateId}`)
  // modelOf replays the sealed program and refuses one that does not rebuild its model.
  const model = modelOf(candidateId)
  const baseline = modelOf(baselineId)
  const truth = JSON.parse(readFileSync(truthPath, 'utf8')) as { items: TruthItem[] }
  const building = JSON.parse(readFileSync(buildingPath, 'utf8')) as Building
  const closure = JSON.parse(readFileSync(closurePath, 'utf8')) as { candidateHash: string; decisions: Array<{ subject: string; what: string; why: string }> }
  if (closure.candidateHash !== sealed.candidate.contentHash) throw new Error(`${closurePath} was written for candidate ${closure.candidateHash.slice(0, 16)}, not the sealed ${candidateId} (${sealed.candidate.contentHash.slice(0, 16)}): re-run the analyzer and re-seal`)

  const T = (id: string): TruthItem => {
    const t = truth.items.find((x) => x.id === id)
    if (!t) throw new Error(`truth item ${id} missing`)
    return t
  }
  const V = (id: string): Dict => T(id).value

  const sceneOf = (m: CanonicalBuildingModel): CompiledScene => compileBuilding(m)
  const scene = sceneOf(model)
  const baseScene = sceneOf(baseline)
  const report = geometryClosureAudit(model, scene)
  const baseReport = geometryClosureAudit(baseline, baseScene)
  mkdirSync(reportsDir, { recursive: true })
  writeFileSync(join(reportsDir, `closure-${candidateId}.json`), `${stableJson(report)}\n`, 'utf8')
  writeFileSync(join(reportsDir, `closure-${baselineId}.json`), `${stableJson(baseReport)}\n`, 'utf8')

  const categories: Category[] = []
  const add = (c: Omit<Category, 'status' | 'closureViolations' | 'baselineClosureViolations'>): void => {
    const closureViolations = findingsFor(c.category, report, model).map(brief)
    const baselineClosureViolations = findingsFor(c.category, baseReport, baseline).length
    const full = { ...c, closureViolations, baselineClosureViolations }
    categories.push({ ...full, status: statusOf(full) })
  }

  const main = building.masses.find((m) => m.id === 'main') ?? building.masses[0]
  const attached = building.masses.find((m) => m !== main)
  const levels = [...model.levels].sort((a, b) => a.index - b.index)

  // MASSING ------------------------------------------------------------------
  {
    const tm = V('T2-MASS-MAIN') as { x: [number, number]; z: [number, number] }
    const tg = V('T2-MASS-GARAGE') as { x: [number, number]; z: [number, number] }
    add({
      category: 'MASSING',
      expected: ['main body x 0..7.90 z 1.00..13.60, two storeys', 'garage x 7.90..12.05 z 1.00..8.50, one storey'],
      emitted: building.masses.map((m) => `${m.id} x ${m.x0.toFixed(2)}..${m.x1.toFixed(2)} z ${m.z0.toFixed(2)}..${m.z1.toFixed(2)} storeys ${m.storeys.join(',')}`),
      checks: [
        check('main x1', 'T2-MASS-MAIN', tm.x[1], main?.x1, 0.05, true),
        check('main z0', 'T2-MASS-MAIN', tm.z[0], main?.z0, 0.05, true),
        check('main z1', 'T2-MASS-MAIN', tm.z[1], main?.z1, 0.05, true),
        check('garage x1', 'T2-MASS-GARAGE', tg.x[1], attached?.x1, 0.05, true),
        check('garage z1', 'T2-MASS-GARAGE', tg.z[1], attached?.z1, 0.05, true),
        flag('mass count', 'T2-MASS-STOREY_COVERAGE', 2, building.masses.length, building.masses.length === 2, true),
        flag('closed solids', 'closure audit', 0, report.metrics.nonManifoldSolidCount, report.metrics.nonManifoldSolidCount === 0),
      ],
      uncertainty: [],
      notes: ['unchanged from Auto v2: this stage did not move the massing'],
    })
  }

  // ROOF ---------------------------------------------------------------------
  {
    const tr = V('T2-ROOF-MAIN') as { pitchDeg: number; ridgeX: number; eaveY: number; ridgeY: number }
    const te = V('T2-ROOF-EXTENT') as { z: [number, number] }
    const tg = V('T2-ROOF-GARAGE') as { slabTopY: number; parapetTopY: number }
    const r = building.mainRoof
    const g = building.attachedRoofs[0]
    add({
      category: 'ROOF',
      expected: ['main gable, 40°, ridge along z at x 3.95, eave 4.67, over z 0..14.60', 'garage flat roof, slab top 2.88, parapet 3.09'],
      emitted: [r ? `main ${r.kind} ${r.pitchDeg}° ridge at ${r.ridgeAt} eave ${r.eaveY.toFixed(2)} z ${r.footprint.z0.toFixed(2)}..${r.footprint.z1.toFixed(2)}` : 'no main roof', g ? `garage flat, slab top ${g.reading?.slabTopY?.toFixed(2)} parapet ${g.parapetTopY?.toFixed(2)}` : 'no garage roof'],
      checks: [
        check('pitch', 'T2-ROOF-MAIN', tr.pitchDeg, r?.pitchDeg, 1, true),
        check('ridge x', 'T2-ROOF-MAIN', tr.ridgeX, r?.ridgeAt, 0.05),
        check('eave y', 'T2-ROOF-MAIN', tr.eaveY, r?.eaveY, 0.1),
        check('roof z0', 'T2-ROOF-EXTENT', te.z[0], r?.footprint.z0, 0.05, true),
        check('roof z1', 'T2-ROOF-EXTENT', te.z[1], r?.footprint.z1, 0.05, true),
        check('garage slab top', 'T2-ROOF-GARAGE', tg.slabTopY, g?.reading?.slabTopY, 0.05),
        check('garage parapet top', 'T2-ROOF-GARAGE', tg.parapetTopY, g?.parapetTopY, 0.05),
      ],
      uncertainty: [T('T2-UNRES-GARAGE-ROOF-FALL').name],
      notes: ['unchanged from Auto v2 in shape; the plate now bears into its walls (plate insets) instead of standing in the plane of their outer faces'],
    })
  }

  // ROOF_EDGE_CLOSURE ----------------------------------------------------------
  {
    const tv = V('T2-ROOF-VERGE-MEMBER') as { verticalExtentM: number; perpendicularWidthM: number }
    const roofMain = model.roofs.find((x) => x.kind === 'GABLE')
    const verge = roofMain?.edgeMembers?.verge
    const trims = scene.meshes.filter((m) => m.part === 'ROOF_TRIM')
    const pitch = ((roofMain?.pitchDeg ?? 40) * Math.PI) / 180
    const vergeEnds = verge?.ends ?? []
    const flatRoof = model.roofs.find((x) => x.kind === 'FLAT')
    add({
      category: 'ROOF_EDGE_CLOSURE',
      ownerObservation: 'jagged roof edge; verge and fascia do not close the roof',
      expected: ['a verge member along both rakes of both gables, continuous with the returns (T2-ROOF-VERGE-MEMBER, continuousWithReturns)', 'the garage roof edge over the portal as one fascia with the balcony band (T2-PORTAL-HEAD)'],
      emitted: [
        `main roof edge members: verge on ${vergeEnds.map((e) => e.side).join(', ') || 'both ends'} (${vergeEnds.map((e) => `${e.side} ${e.width.toFixed(2)} × ${e.depth.toFixed(2)} m`).join('; ')})`,
        `${trims.length} ROOF_TRIM meshes compiled with the roofs`,
        flatRoof?.edgeMembers?.fascia ? `garage roof fascia on ${flatRoof.edgeMembers.fascia.sides.join(', ')}: ${flatRoof.edgeMembers.fascia.height.toFixed(2)} m tall, ${flatRoof.edgeMembers.fascia.depth.toFixed(2)} m deep` : 'no garage fascia',
      ],
      checks: [
        flag('verge members compiled with the roof', 'T2-ROOF-VERGE-MEMBER', true, trims.length > 0 && !!verge, trims.length > 0 && !!verge, true),
        flag('verge on both gables', 'T2-ASSEMBLY-FRONT-GABLE-FRAME / T2-ASSEMBLY-REAR-GABLE-FRAME', 2, vergeEnds.length || (verge ? 2 : 0), (vergeEnds.length || (verge ? 2 : 0)) === 2, true),
        ...vergeEnds.map((e) => check(`verge ${e.side} vertical extent`, 'T2-ROOF-VERGE-MEMBER', tv.verticalExtentM, e.width, 0.08)),
        ...vergeEnds.map((e) => check(`verge ${e.side} width across the rake`, 'T2-ROOF-VERGE-MEMBER', tv.perpendicularWidthM, e.width * Math.cos(pitch), 0.08)),
        flag('garage fascia continues the balcony band', 'T2-PORTAL-HEAD', true, !!flatRoof?.edgeMembers?.fascia, !!flatRoof?.edgeMembers?.fascia),
        flag('no trim–roof intersections or duplicate faces', 'closure audit', 0, findingsFor('ROOF_EDGE_CLOSURE', report, model).length, findingsFor('ROOF_EDGE_CLOSURE', report, model).length === 0, true),
      ],
      uncertainty: [T('T2-UNRES-VERGE-DEPTH').name + ' — modelled as the depth of the zone the frame returns stand in'],
      notes: [],
    })
  }

  // WALL_SLAB_JOINTS -------------------------------------------------------------
  {
    const wallSlab = report.contacts.filter((c) => c.relation === 'WALL<->SLAB')
    add({
      category: 'WALL_SLAB_JOINTS',
      ownerObservation: 'penetrations and wall / slab / roof intersections',
      expected: ['upper floor plates bear into the walls under them without an edge in the plane of any facade', 'walls meet at their declared corners and junctions'],
      emitted: [`${wallSlab.length} wall–slab bearings, largest shared volume ${Math.max(0, ...wallSlab.map((c) => c.volumeM3)).toFixed(3)} m³ (within each wall's thickness × plate thickness × run)`, `coplanar duplicate faces: ${report.metrics.coplanarDuplicateCount} (${report.metrics.coplanarDuplicateAreaM2} m²)`],
      checks: [
        flag('exterior intersections', 'closure audit', 0, report.findings.filter((f) => f.scope === 'EXTERIOR' && f.code === 'INTERSECTION').length, report.findings.filter((f) => f.scope === 'EXTERIOR' && f.code === 'INTERSECTION').length === 0, true),
        flag('faces drawn twice in one plane', 'closure audit', 0, report.metrics.coplanarDuplicateCount, report.metrics.coplanarDuplicateCount === 0, true),
      ],
      uncertainty: [],
      notes: [`interior: ${report.metrics.interiorFindingCount} findings (the stair against its walls, partitions trimmed 15 mm short of what they meet) — out of this stage's scope, recorded for BUILDAPP-03Z`],
    })
  }

  // GARAGE_JOIN ------------------------------------------------------------------
  {
    const tg = V('T2-MASS-GARAGE') as { sharedWallX: number }
    add({
      category: 'GARAGE_JOIN',
      expected: [`the garage stands against the main body along x ${tg.sharedWallX}`, 'its flat roof bears into its walls; the parapet rises past the plate'],
      emitted: [attached ? `${attached.id} against main along x ${attached.x0.toFixed(2)}` : 'no attached body', `${report.contacts.filter((c) => c.relation === 'PARAPET<->FLAT_ROOF').length} parapet–plate bearings`],
      checks: [check('party face', 'T2-MASS-GARAGE', tg.sharedWallX, attached?.x0, 0.05, true), flag('no party-face or parapet defects', 'closure audit', 0, findingsFor('GARAGE_JOIN', report, model).length, findingsFor('GARAGE_JOIN', report, model).length === 0, true)],
      uncertainty: [],
      notes: [],
    })
  }

  // RECESS_RETURNS -----------------------------------------------------------------
  {
    const tf = V('T2-RECESS-FRONT-GROUND') as { returns: { west: [number, number]; garageEast: [number, number] } }
    const ta = V('T2-RECESS-FRONT-ATTIC') as { returns: { west: [number, number]; east: [number, number] } }
    const rr = (side: string, storey: number, low: boolean) => building.returns.find((r) => r.side === side && r.storeyIndex === storey && (low ? r.alongInterval[0] < 1 : r.alongInterval[1] > 7))
    const stackedSteps = building.returns.filter((lo) => building.returns.some((up) => up.side === lo.side && up.storeyIndex === lo.storeyIndex + 1 && Math.abs(up.alongInterval[0] - lo.alongInterval[0]) < 1e-6 && Math.abs(up.alongInterval[1] - lo.alongInterval[1]) > 1e-6 && up.alongInterval[1] < 2))
    add({
      category: 'RECESS_RETURNS',
      expected: ['front: west return 0..0.61 on both storeys, garage east return 11.42..12.05, attic east return 7.26..7.90', 'rear: returns at both ends of the loggia'],
      emitted: building.returns.map((r) => `${r.id} ${r.side} storey ${r.storeyIndex} ${r.alongInterval[0].toFixed(3)}..${r.alongInterval[1].toFixed(3)}`),
      checks: [
        check('front ground west return free face', 'T2-RECESS-FRONT-GROUND', tf.returns.west[1], rr('FRONT', 0, true)?.alongInterval[1], 0.06),
        check('front attic west return free face', 'T2-RECESS-FRONT-ATTIC', ta.returns.west[1], rr('FRONT', 1, true)?.alongInterval[1], 0.06),
        check('front attic east return free face', 'T2-RECESS-FRONT-ATTIC', ta.returns.east[0], rr('FRONT', 1, false)?.alongInterval[0], 0.06),
        check('garage east return free face', 'T2-RECESS-FRONT-GROUND', tf.returns.garageEast[0], building.returns.find((r) => r.side === 'FRONT' && r.storeyIndex === 0 && r.alongInterval[1] > 11)?.alongInterval[0], 0.06),
        flag('stacked returns share one face (no step between storeys)', 'closure', 0, stackedSteps.length, stackedSteps.length === 0),
      ],
      uncertainty: [],
      notes: closure.decisions.filter((d) => /return/.test(d.subject)).map((d) => `${d.subject}: ${d.what} — ${d.why}`),
    })
  }

  // BALCONY ---------------------------------------------------------------------------
  {
    const tf = V('T2-BALCONY-FRONT') as { x: [number, number]; topY: number; fasciaSoffitY: number }
    const tr = V('T2-BALCONY-REAR') as { x: [number, number]; topY: number; fasciaSoffitY: number }
    const bf = building.balconies.find((b) => b.kind === 'BALCONY' && b.side === 'FRONT')
    const br = building.balconies.find((b) => b.kind === 'BALCONY' && b.side === 'REAR')
    add({
      category: 'BALCONY',
      ownerObservation: 'the balcony is wrong: its short side does not terminate at the building',
      expected: ['front slab x 3.25..7.90 at 3.06, running under the attic east return to meet the portal head', 'rear slab x 0.61..7.29 at 3.06 between the loggia returns'],
      emitted: [bf, br].filter(Boolean).map((b) => `${b?.id} x ${b?.x0.toFixed(3)}..${b?.x1.toFixed(3)} top ${b?.topY.toFixed(3)} soffit ${((b?.topY ?? 0) - (b?.thicknessM ?? 0)).toFixed(3)}; ends ${(b?.ends ?? []).map((e) => `${e.kind}${e.againstId ? ` ${e.againstId}` : ''} at ${e.at.toFixed(3)}`).join(' / ')}`),
      checks: [
        check('front x0', 'T2-BALCONY-FRONT', tf.x[0], bf?.x0, 0.08),
        check('front x1', 'T2-BALCONY-FRONT', tf.x[1], bf?.x1, 0.03, true),
        check('front top', 'T2-BALCONY-FRONT', tf.topY, bf?.topY, 0.02, true),
        check('front soffit', 'T2-BALCONY-FRONT', tf.fasciaSoffitY, bf ? bf.topY - bf.thicknessM : undefined, 0.06),
        check('rear x0', 'T2-BALCONY-REAR', tr.x[0], br?.x0, 0.06),
        check('rear x1', 'T2-BALCONY-REAR', tr.x[1], br?.x1, 0.06),
        check('rear top', 'T2-BALCONY-REAR', tr.topY, br?.topY, 0.02, true),
        check('rear soffit', 'T2-BALCONY-REAR', tr.fasciaSoffitY, br ? br.topY - br.thicknessM : undefined, 0.06),
        flag('every slab end terminates (wall, carried return, portal, or a drawn free end)', 'owner review', true, [bf, br].every((b) => (b?.ends ?? []).length === 2), [bf, br].every((b) => (b?.ends ?? []).length === 2), true),
      ],
      uncertainty: [T('T2-UNRES-FRONT-FASCIA-SECTION').name],
      notes: closure.decisions.filter((d) => /balcony/.test(d.subject)).map((d) => `${d.subject}: ${d.what} — ${d.why}`),
    })
  }

  // RAILING ---------------------------------------------------------------------------
  {
    const tf = V('T2-RAILING-FRONT') as { x: [number, number]; z: number; heightM: number; infill: string }
    const tr = V('T2-RAILING-REAR') as { x: [number, number]; z: number; heightM: number }
    const rf = building.railings.find((r) => r.hostId && building.balconies.find((b) => b.id === r.hostId)?.side === 'FRONT')
    const rr = building.railings.find((r) => r.hostId && building.balconies.find((b) => b.id === r.hostId)?.side === 'REAR')
    const along = (r: typeof rf): [number, number] | undefined => {
      if (!r) return undefined
      const pts = r.path ?? [r.start, r.end]
      const run = pts.filter((p, i) => i > 0 && Math.abs(p.z - pts[i - 1].z) < 1e-6).length > 0 ? pts : pts
      const xs = run.map((p) => p.x)
      return [Math.min(...xs), Math.max(...xs)]
    }
    const turns = (r: typeof rf): number => Math.max(0, (r?.path?.length ?? 2) - 2)
    add({
      category: 'RAILING',
      ownerObservation: 'the railing should turn and return to the building at the balcony’s short side',
      expected: ['front glass balustrade x 3.30..7.26 at z 0.05, 0.87 m, turning back to the wall at its free west end where the plan draws it', 'rear glass balustrade x 0.64..7.26 between the loggia returns'],
      emitted: [rf, rr].filter(Boolean).map((r) => `${r?.id}: ${(r?.path ?? [r?.start, r?.end]).map((p) => `(${p?.x.toFixed(2)}, ${p?.z.toFixed(2)})`).join(' → ')}, ${r?.heightM.toFixed(2)} m, ${turns(r)} turn${turns(r) === 1 ? '' : 's'}`),
      checks: [
        check('front run x0', 'T2-RAILING-FRONT', tf.x[0], along(rf)?.[0], 0.08),
        check('front run x1', 'T2-RAILING-FRONT', tf.x[1], along(rf)?.[1], 0.08),
        check('front height', 'T2-RAILING-FRONT', tf.heightM, rf?.heightM, 0.06),
        flag('front turns back to the wall at the plan-drawn free end', 'owner review + plan', 1, turns(rf), turns(rf) === 1, true),
        check('rear run x0', 'T2-RAILING-REAR', tr.x[0], along(rr)?.[0], 0.08),
        check('rear run x1', 'T2-RAILING-REAR', tr.x[1], along(rr)?.[1], 0.08),
        check('rear height', 'T2-RAILING-REAR', tr.heightM, rr?.heightM, 0.06),
        flag('free railing ends', 'closure audit', 0, report.metrics.railingFreeEndCount, report.metrics.railingFreeEndCount === 0, true),
        check('largest end-to-wall distance', 'closure audit', 0, report.metrics.railingEndDistanceMaxM, 0.06),
      ],
      uncertainty: [],
      notes: closure.decisions.filter((d) => /railing/.test(d.subject)).map((d) => `${d.subject}: ${d.what} — ${d.why}`),
    })
  }

  // TERRACE ---------------------------------------------------------------------------
  {
    const tf = V('T2-RECESS-FRONT-GROUND') as { x: [number, number]; mouthZ: number; backZ: number }
    const front = building.terraces.find((t) => t.side === 'FRONT')
    const rear = building.terraces.find((t) => t.side === 'REAR')
    const ext = (t: typeof front, axis: 'x' | 'z'): [number, number] | undefined => (t ? [Math.min(...t.polygon.map((p) => p[axis])), Math.max(...t.polygon.map((p) => p[axis]))] : undefined)
    add({
      category: 'TERRACE',
      ownerObservation: 'the terrace is weak',
      expected: ['a first-class terrace on the floor of the front portal recess, x 0.61..11.42, z 0..1.00, at the finished floor', 'the rear loggia floor as a terrace, and any platform the plan outlines beyond it (no truth item: reported as read)'],
      emitted: building.terraces.map((t) => `${t.id}: ${t.polygon.length}-gon x ${ext(t, 'x')?.map((v) => v.toFixed(2)).join('..')} z ${ext(t, 'z')?.map((v) => v.toFixed(2)).join('..')}, top ${t.topY.toFixed(2)}, ${t.thicknessM} m ${t.edge.toLowerCase()}, ${t.surface.toLowerCase()} (${t.provenance})`),
      checks: [
        flag('first-class terraces in the model', 'owner review', '≥ 2', model.terraces.length, model.terraces.length >= 2, true),
        check('front terrace x0', 'T2-RECESS-FRONT-GROUND', tf.x[0], ext(front, 'x')?.[0], 0.06),
        check('front terrace x1', 'T2-RECESS-FRONT-GROUND', tf.x[1], ext(front, 'x')?.[1], 0.06),
        check('front terrace z1 (back wall)', 'T2-RECESS-FRONT-GROUND', tf.backZ, ext(front, 'z')?.[1], 0.03),
        check('terrace top on the floor datum', 'closure audit', 0, report.metrics.terraceAlignmentResidualM, 0.02, true),
        flag('rear terrace present', 'plan', true, !!rear, !!rear),
      ],
      uncertainty: ['the terrain datum under the platform is not read: the plinth thickness is assumed for rendering', rear?.extension ? `the rear platform's outline (reach ${(rear.extension.reach as number).toFixed(2)} m) is read off the plan; the truth set has no item for it` : ''].filter(Boolean),
      notes: closure.decisions.filter((d) => /terrace/.test(d.subject)).map((d) => `${d.subject}: ${d.what}`),
    })
  }

  // FACADE_ASSEMBLY ---------------------------------------------------------------------
  {
    const tb = V('T2-FACADE-FRONT-BAND') as { x: [number, number]; y: [number, number] }
    const bf = building.balconies.find((b) => b.kind === 'BALCONY' && b.side === 'FRONT')
    const ph = building.portalHeads[0]
    const bandX: [number, number] | undefined = bf && ph ? [bf.x0, ph.x1] : undefined
    const edges = building.facadeGraph.edges
    const kinds = new Map<string, number>()
    for (const e of edges) kinds.set(e.kind, (kinds.get(e.kind) ?? 0) + 1)
    const gaps = edges.filter((e) => (e.gapM ?? 0) > 0.01)
    add({
      category: 'FACADE_ASSEMBLY',
      ownerObservation: 'facade bands and frames are incomplete; elements merge visually',
      expected: ['the front band: balcony fascia and portal head as one band, x 3.25..12.05, y 2.28..3.07', 'both gable frames: returns continuing into the verge members'],
      emitted: [`front band ${bandX ? `${bandX[0].toFixed(2)}..${bandX[1].toFixed(2)}` : 'broken'}: balcony top ${bf?.topY.toFixed(3)} / portal top ${ph?.y1.toFixed(3)}, balcony soffit ${bf ? (bf.topY - bf.thicknessM).toFixed(3) : '—'} / portal soffit ${ph?.y0.toFixed(3)}`, `facade graph: ${building.facadeGraph.nodes.length} members, ${edges.length} relations (${[...kinds].map(([k, n]) => `${n} ${k}`).join(', ')})`],
      checks: [
        check('band x0', 'T2-FACADE-FRONT-BAND', tb.x[0], bandX?.[0], 0.08),
        check('band x1', 'T2-FACADE-FRONT-BAND', tb.x[1], bandX?.[1], 0.03, true),
        flag('balcony and portal meet end to end', 'T2-FACADE-FRONT-BAND', 0, bf && ph ? round(Math.abs(ph.x0 - bf.x1)) : null, !!bf && !!ph && Math.abs(ph.x0 - bf.x1) < 1e-6, true),
        flag('one top line', 'T2-FACADE-FRONT-BAND', 0, bf && ph ? round(Math.abs(ph.y1 - bf.topY)) : null, !!bf && !!ph && Math.abs(ph.y1 - bf.topY) < 1e-6),
        check('band soffit', 'T2-FACADE-FRONT-BAND', tb.y[0], ph?.y0, 0.06),
        check('band top', 'T2-FACADE-FRONT-BAND', tb.y[1], ph?.y1, 0.03),
        flag('members continuing each other with a gap', 'facade graph', 0, gaps.length, gaps.length === 0, true),
        flag('returns continue into the verges', 'T2-ASSEMBLY-*-GABLE-FRAME', 4, edges.filter((e) => e.kind === 'CONTINUES_TO' && /verge/.test(e.to)).length, edges.filter((e) => e.kind === 'CONTINUES_TO' && /verge/.test(e.to)).length >= 4),
      ],
      uncertainty: [],
      notes: ['material regions of the facade (the dark portal walls, side bands and rear gable panel of T2-MAT-DARK-*) are not modelled as regions in this candidate: see MATERIAL_READABILITY'],
    })
  }

  // OPENINGS ------------------------------------------------------------------------
  {
    const truthOpenings = truth.items.filter((t) => t.kind === 'OPENING' && (t.value as { facade?: string }).facade !== 'INTERIOR')
    const matched: string[] = []
    const missing: string[] = []
    for (const t of truthOpenings) {
      const v = t.value as { facade: string; storey: number; interval: [number, number] }
      const hit = building.openings.find((o) => o.facade === v.facade && o.storeyIndex === v.storey && Math.abs(o.interval[0] - v.interval[0]) <= 0.1 && Math.abs(o.interval[1] - v.interval[1]) <= 0.1)
      ;(hit ? matched : missing).push(`${t.id} ${t.name}`)
    }
    const residuals = sourceViewResidualsOf(candidateId)?.residuals ?? []
    const outOfTolerance = residuals.filter((r) => (r.kind === 'OPENING_SILL' || r.kind === 'OPENING_HEAD') && !r.withinTolerance)
    const baseResiduals = sourceViewResidualsOf(baselineId)?.residuals ?? []
    const baseOut = baseResiduals.filter((r) => (r.kind === 'OPENING_SILL' || r.kind === 'OPENING_HEAD') && !r.withinTolerance)
    add({
      category: 'OPENINGS',
      expected: truthOpenings.map((t) => `${t.id} ${t.name}`),
      emitted: [`${building.openings.length} exterior openings, ${building.openings.filter((o) => o.profile && o.profile !== 'RECTANGULAR').length} with a non-rectangular profile`],
      checks: [
        flag('truth openings matched within 0.10 m', 'T2-OPEN-*', truthOpenings.length, matched.length, missing.length === 0),
        flag('source-view sill / head residuals out of tolerance', 'source-view residuals', 0, outOfTolerance.length, outOfTolerance.length === 0),
        flag('no regression against the baseline', 'source-view residuals', baseOut.length, outOfTolerance.length, outOfTolerance.length <= baseOut.length, true),
      ],
      uncertainty: missing.map((m) => `not matched: ${m}`),
      notes: [`unchanged by this stage. ${outOfTolerance.length} sill/head readings on the renders disagree with the model where glazing stands behind a balustrade or under a balcony — the same ${baseOut.length} as Auto v2`],
    })
  }

  // CHIMNEYS -------------------------------------------------------------------------
  {
    const tc = [T('T2-CHIMNEY-1'), T('T2-CHIMNEY-2')].map((t) => t.value as { x: [number, number]; z: [number, number]; topY: number })
    const nearest = (t: { x: [number, number]; z: [number, number] }) => building.chimneys.slice().sort((a, b) => Math.hypot((a.x0 + a.x1) / 2 - (t.x[0] + t.x[1]) / 2, (a.z0 + a.z1) / 2 - (t.z[0] + t.z[1]) / 2) - Math.hypot((b.x0 + b.x1) / 2 - (t.x[0] + t.x[1]) / 2, (b.z0 + b.z1) / 2 - (t.z[0] + t.z[1]) / 2))[0]
    add({
      category: 'CHIMNEYS',
      expected: ['two stacks on the east slope, top 7.86'],
      emitted: building.chimneys.map((c) => `${c.id} x ${c.x0.toFixed(2)}..${c.x1.toFixed(2)} z ${c.z0.toFixed(2)}..${c.z1.toFixed(2)} top ${c.topY.toFixed(2)}`),
      checks: tc.flatMap((t, i) => {
        const c = nearest(t)
        return [check(`chimney ${i + 1} centre x`, `T2-CHIMNEY-${i + 1}`, (t.x[0] + t.x[1]) / 2, c ? (c.x0 + c.x1) / 2 : undefined, 0.1), check(`chimney ${i + 1} centre z`, `T2-CHIMNEY-${i + 1}`, (t.z[0] + t.z[1]) / 2, c ? (c.z0 + c.z1) / 2 : undefined, 0.3), check(`chimney ${i + 1} top`, `T2-CHIMNEY-${i + 1}`, t.topY, c?.topY, 0.1)]
      }),
      uncertainty: [T('T2-UNRES-CHIMNEY-DEPTH').name],
      notes: ['unchanged by this stage; each stack passes through the roof it pierces (an intended penetration)'],
    })
  }

  // ROOFLIGHTS -----------------------------------------------------------------------
  {
    const tl = truth.items.filter((t) => t.kind === 'ROOFLIGHT')
    add({
      category: 'ROOFLIGHTS',
      expected: tl.map((t) => `${t.id} ${t.name}`),
      emitted: building.rooflights.map((r) => `${r.id} (${r.slope})`),
      checks: [flag('rooflight count', 'T2-ROOFLIGHT-*', tl.length, building.rooflights.length, building.rooflights.length === tl.length), flag('in the model', 'model', tl.length, model.rooflights.length, model.rooflights.length === tl.length)],
      uncertainty: [T('T2-UNRES-ROOFLIGHT-SILL').name],
      notes: ['unchanged by this stage'],
    })
  }

  // MATERIAL_READABILITY ---------------------------------------------------------------
  {
    const bundle = buildMobileSceneBundle(model, { scene })
    const g = bundle.styling.groups
    const used = new Set(bundle.scene.meshes.map((m) => m.semanticGroup))
    const tooClose = ADJACENT_GROUPS.filter(([a, b]) => used.has(a) && used.has(b) && Math.abs(relativeLuminance(g[a].color) - relativeLuminance(g[b].color)) < MIN_ADJACENT_LUMINANCE_GAP)
    const tone = (id: string) => building.massTones.find((t) => t.massId === id)
    // The attached body's own exterior walls: those standing inside its footprint.
    const inAttached = (p: { x: number; z: number }): boolean => !!attached && p.x >= attached.x0 - 0.05 && p.x <= attached.x1 + 0.05 && p.z >= attached.z0 - 0.05 && p.z <= attached.z1 + 0.05
    const garageWallIds = new Set(model.walls.filter((w) => w.kind === 'EXTERIOR' && inAttached(w.start) && inAttached(w.end) && !(Math.abs(w.start.x - (attached?.x0 ?? NaN)) < 0.05 && Math.abs(w.end.x - (attached?.x0 ?? NaN)) < 0.05)).map((w) => w.id))
    const garageWalls = new Set(bundle.scene.meshes.filter((m) => m.part === 'WALL' && garageWallIds.has(m.objectId)).map((m) => m.semanticGroup))
    // The recessed walls' finish regions against the truth set's material regions (their extents are in the items' names).
    const matOf = (id: string): string | undefined => model.materials.find((m) => m.id === id)?.name
    const regions = model.surfaceRegions.map((r) => {
      const host = model.walls.find((w) => w.id === r.hostId)
      const L = host ? Math.hypot(host.end.x - host.start.x, host.end.z - host.start.z) : 0
      // along the facade in world x for front/rear hosts: the host's start is at a = 0 when it runs +x, at a = L when it runs -x.
      const runsPlusX = host ? host.end.x >= host.start.x : true
      const x0 = host ? (runsPlusX ? host.start.x + r.rect.a0 : host.start.x - r.rect.a1) : NaN
      const x1 = host ? (runsPlusX ? host.start.x + r.rect.a1 : host.start.x - r.rect.a0) : NaN
      const side = host && Math.abs(host.start.z - host.end.z) < 1e-6 ? (host.start.z < 7 ? 'FRONT' : 'REAR') : 'SIDE'
      void L
      return { id: r.id, side, x0, x1, material: matOf(r.materialId ?? '') ?? r.materialId ?? '' }
    })
    const region = (side: string, finish: RegExp) => regions.find((r) => r.side === side && finish.test(r.material))
    const frontTimber = region('FRONT', /timber/i)
    const frontDark = region('FRONT', /dark/i)
    const rearTimber = region('REAR', /timber/i)
    const regionChecks: Check[] = [
      check('front timber region x0', 'T2-MAT-TIMBER-FRONT (x 0.61..3.25)', 0.61, frontTimber?.x0, 0.06),
      check('front timber region x1', 'T2-MAT-TIMBER-FRONT (x 0.61..3.25)', 3.25, frontTimber?.x1, 0.08),
      check('front dark portal wall x0', 'T2-MAT-DARK-FRONT (x 3.25..11.42)', 3.25, frontDark?.x0, 0.08),
      check('front dark portal wall x1 (the main body’s part)', 'T2-MAT-DARK-FRONT (x 3.25..11.42)', 7.9, frontDark?.x1, 0.03),
      flag('rear timber either side of the glazing', 'T2-MAT-TIMBER-REAR (x 0.61..2.25 and 6.95..7.29)', 'x 0.61..7.29 less the glazing', rearTimber ? `x ${rearTimber.x0.toFixed(2)}..${rearTimber.x1.toFixed(2)}` : null, !!rearTimber && rearTimber.x0 <= 0.61 + 0.06 && rearTimber.x1 >= 7.29 - 0.06),
    ]
    add({
      category: 'MATERIAL_READABILITY',
      ownerObservation: 'elements merge visually; the style should be a clean, minimal architectural graphic',
      expected: ['white render on the main body and the frame (T2-MAT-WHITE-SHELL)', 'anthracite render on the garage box and the portal band (T2-MAT-DARK-FRONT, T2-ASSEMBLY-GARAGE-BOX)', 'grey roof (T2-MAT-ROOF)', 'timber cladding on the recessed front and rear walls (T2-MAT-TIMBER-*)'],
      emitted: [
        `main body reads ${tone(main?.id ?? '')?.tone ?? '—'}, ${attached?.id ?? 'attached'} reads ${tone(attached?.id ?? '')?.tone ?? '—'}; returns ${building.returnTones.map((t) => `${t.returnId} ${t.tone}`).join(', ')}`,
        `garage walls drawn as ${[...garageWalls].join(', ')}; tone hints ${JSON.stringify(bundle.styling.toneHints ?? {})}`,
        `${used.size} semantic groups in use; ${tooClose.length} adjacent pairs closer than the palette's luminance gap`,
        ...regions.map((r) => `${r.id}: ${r.material} on the ${r.side.toLowerCase()} recessed wall, x ${r.x0.toFixed(2)}..${r.x1.toFixed(2)}`),
      ],
      checks: [
        flag('main body light', 'T2-MAT-WHITE-SHELL', 'LIGHT', tone(main?.id ?? '')?.tone, tone(main?.id ?? '')?.tone === 'LIGHT'),
        flag('garage dark', 'T2-MAT-DARK-FRONT', 'DARK', tone(attached?.id ?? '')?.tone, tone(attached?.id ?? '')?.tone === 'DARK', true),
        // The gable frames' returns are white; the return that closes the garage box is the box's anthracite.
        ...(() => {
          const onGarage = (id: string): boolean => {
            const r = building.returns.find((x) => x.id === id)
            return !!r && !!attached && r.storeyIndex === 0 && r.alongInterval[0] >= attached.x0 - 0.05
          }
          const frame = building.returnTones.filter((t) => !onGarage(t.returnId))
          const box = building.returnTones.filter((t) => onGarage(t.returnId))
          return [
            flag('gable-frame returns light', 'T2-MAT-WHITE-SHELL', 'LIGHT', frame.map((t) => `${t.returnId} ${t.tone}`), frame.length > 0 && frame.every((t) => t.tone === 'LIGHT')),
            flag('garage-box return dark', 'T2-ASSEMBLY-GARAGE-BOX (dark render on all faces)', 'DARK', box.map((t) => `${t.returnId} ${t.tone}`), box.length > 0 && box.every((t) => t.tone === 'DARK')),
          ]
        })(),
        flag('garage a distinct secondary body', 'styling', 'WALL_SECONDARY', [...garageWalls], garageWalls.size === 1 && garageWalls.has('WALL_SECONDARY'), true),
        flag('adjacent groups apart', 'styling', 0, tooClose.length, tooClose.length === 0, true),
        ...regionChecks,
        flag('finish regions not read: ground-storey side bands, rear gable panel, attic timber panel', 'T2-MAT-DARK-SIDE-BANDS / T2-MAT-DARK-REAR-GABLE / T2-MAT-TIMBER-FRONT (gable)', 'modelled as regions', 'not read by the analyzer', false),
      ],
      uncertainty: ['a tone is a family (light / mid / dark) read against each render’s own white point, not a colour'],
      notes: ['the architectural palette assigns every colour; the model’s finishes only move a group to another rung of that palette'],
    })
  }

  // ---------------------------------------------------------------------------
  const summary = Object.fromEntries(categories.map((c) => [c.category, c.status]))
  const counts = { PASS: categories.filter((c) => c.status === 'PASS').length, PARTIAL: categories.filter((c) => c.status === 'PARTIAL').length, FAIL: categories.filter((c) => c.status === 'FAIL').length }
  const metricRow = (r: ClosureReport) => ({
    intersectionCount: r.findings.filter((f) => f.code === 'INTERSECTION' && f.scope === 'EXTERIOR').length,
    intersectionVolumeM3: round(r.findings.filter((f) => f.code === 'INTERSECTION' && f.scope === 'EXTERIOR').reduce((a, f) => a + f.measure, 0), 4),
    exposedGapCount: r.findings.filter((f) => f.code === 'GAP' && f.scope === 'EXTERIOR').length,
    coplanarDuplicateCount: r.findings.filter((f) => f.code === 'COPLANAR_DUPLICATE' && f.scope === 'EXTERIOR').length,
    coplanarDuplicateAreaM2: round(r.findings.filter((f) => f.code === 'COPLANAR_DUPLICATE' && f.scope === 'EXTERIOR').reduce((a, f) => a + f.measure, 0), 4),
    sliverTriangleCount: r.metrics.sliverTriangleCount,
    nonManifoldSolidCount: r.metrics.nonManifoldSolidCount,
    disconnectedMemberCount: r.metrics.disconnectedMemberCount,
    railingFreeEndCount: r.metrics.railingFreeEndCount,
    railingEndDistanceMaxM: r.metrics.railingEndDistanceMaxM,
    terraceAlignmentResidualM: r.metrics.terraceAlignmentResidualM,
    exteriorFindingCount: r.metrics.exteriorFindingCount,
    interiorFindingCount: r.metrics.interiorFindingCount,
  })
  // §17: the exterior against the source views — every residual the verifier
  // measured on the registered elevations, by view and by what was measured.
  const svr = sourceViewResidualsOf(candidateId)?.residuals ?? []
  const baseSvr = sourceViewResidualsOf(baselineId)?.residuals ?? []
  const byKind = (rs: typeof svr) => {
    const out: Record<string, { measured: number; within: number; notObserved: number; worstM: number }> = {}
    for (const r of rs) {
      const k = (out[r.kind] ??= { measured: 0, within: 0, notObserved: 0, worstM: 0 })
      k.measured += 1
      if (r.withinTolerance) k.within += 1
      if (/not observed/.test(r.why)) k.notObserved += 1
      else k.worstM = Math.max(k.worstM, Math.abs(r.residualM))
    }
    for (const k of Object.values(out)) k.worstM = round(k.worstM)
    return out
  }
  const sourceViewAudit = {
    method: 'the model projected into each registered elevation; each model edge compared with the nearest tone edge within reach; a model edge with none is "not observed", never agreement',
    measures: { OPENING_SILL: 'opening sill', OPENING_HEAD: 'opening head', ROOF_EDGE: 'roof outline', BAND_TOP: 'balcony / portal fascia top', BAND_SOFFIT: 'balcony / portal fascia soffit', RETURN_FACE: 'recess return free face', VERGE_UNDERSIDE: 'verge board underside', SILHOUETTE_WIDTH: 'ground-storey silhouette width (mass split and returns)' },
    candidate: byKind(svr),
    baseline: byKind(baseSvr),
    outOfTolerance: svr.filter((r) => !r.withinTolerance).map((r) => ({ kind: r.kind, object: r.objectId ?? r.featureId, frameId: r.frameId, modelM: r.modelM, observedM: r.observedM, residualM: r.residualM, toleranceM: r.toleranceM, why: r.why })),
    notMeasured: ['terraces: they lie at the ground line, under the elevations’ plinth band; their outline is read on the plan and meets the returns and the building’s corners by construction', 'the perspective renders: registered for depth order only (analyzer v2); no metric residuals are taken on them'],
  }

  const out = {
    schema: 'buildapp.exterior-closure-evaluation',
    schemaVersion: '1.0.0',
    candidate: { id: candidateId, contentHash: sealed.candidate.contentHash, modelHash: sealed.candidate.modelHash },
    baseline: { id: baselineId, contentHash: sealedCandidate(baselineId)?.candidate.contentHash },
    method: 'closure audit of both candidates compiled on the production path; per-category comparison with the sealed truth v2 exterior items; no aggregate score',
    summary,
    counts,
    sourceViewAudit,
    cleanliness: { [candidateId]: metricRow(report), [baselineId]: metricRow(baseReport), definitions: { scope: 'EXTERIOR findings only unless named interior', exposedGap: 'two solids the model says meet, 3 mm to 10 cm apart', coplanarDuplicate: 'face area drawn twice in one plane facing the same way and not enclosed by a third solid', intersection: 'volume shared beyond what the relation allows (a bearing may share its wall thickness × plate thickness × run)' } },
    categories,
  }
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'marcowki-exterior-closure-evaluation.json'), `${stableJson(out)}\n`, 'utf8')

  // A short human summary beside it.
  const md: string[] = [
    `# Exterior closure evaluation — ${candidateId} against ${baselineId}`,
    '',
    'Generated by `npm run audit:exterior`. No aggregate score: each category stands on its own.',
    '',
    '| Category | Status | Closure violations (baseline) | Failed checks |',
    '|---|---|---|---|',
    ...categories.map((c) => `| ${c.category} | ${c.status} | ${c.closureViolations.length} (${c.baselineClosureViolations}) | ${c.checks.filter((k) => !k.ok).map((k) => k.name).join('; ') || '—'} |`),
    '',
    '## Source-view exterior audit (§17)',
    '',
    '| Measured | candidate: within / measured (not observed) | baseline |',
    '|---|---|---|',
    ...Object.entries(sourceViewAudit.candidate).map(([k, v]) => `| ${(sourceViewAudit.measures as Record<string, string>)[k] ?? k} | ${v.within} / ${v.measured} (${v.notObserved}) | ${sourceViewAudit.baseline[k] ? `${sourceViewAudit.baseline[k].within} / ${sourceViewAudit.baseline[k].measured}` : '—'} |`),
    '',
    '## Cleanliness (exterior)',
    '',
    `| Metric | ${baselineId} | ${candidateId} |`,
    '|---|---|---|',
    ...Object.keys(metricRow(report)).map((k) => `| ${k} | ${(metricRow(baseReport) as Record<string, number>)[k]} | ${(metricRow(report) as Record<string, number>)[k]} |`),
    '',
  ]
  writeFileSync(join(outDir, 'marcowki-exterior-closure-evaluation.md'), md.join('\n'), 'utf8')

  process.stdout.write(`exterior closure: ${candidateId} vs ${baselineId}\n`)
  for (const c of categories) process.stdout.write(`  ${c.category.padEnd(22)} ${c.status.padEnd(8)} violations ${c.closureViolations.length} (baseline ${c.baselineClosureViolations})${c.checks.some((k) => !k.ok) ? `; failed: ${c.checks.filter((k) => !k.ok).map((k) => k.name).join('; ')}` : ''}\n`)
  process.stdout.write(`  exterior findings: ${report.metrics.exteriorFindingCount} (baseline ${baseReport.metrics.exteriorFindingCount}); interior ${report.metrics.interiorFindingCount}\n`)
  const errors = report.findings.filter((f) => f.scope === 'EXTERIOR' && f.severity === 'ERROR')
  if (errors.length > 0) {
    for (const f of errors) process.stderr.write(`  EXTERIOR ${f.code}: ${f.message}\n`)
    process.exitCode = 1
  }
  if (!existsSync(join(outDir, 'marcowki-exterior-closure-evaluation.json'))) process.exitCode = 1
}

main()
