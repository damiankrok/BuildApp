/**
 * HYPOTHESIS PIPELINE DEMONSTRATIONS on synthetic evidence (stage 03G §20).
 *
 * Each demo is a context model (a generic house, stated as DSL), a set of
 * semantic proposals such as detectors would produce — plan and elevation
 * readings, printed dimensions, perspective renders — and what the pipeline
 * must conclude. The proposals for the roof and dormer demos are read off a
 * synthetic diversity fixture (the "truth"), so the demo can check that the
 * pipeline states the same roof graph back from evidence alone. None of this
 * is a real project, and none of it is production recognition: it proves the
 * plumbing a detector will plug into.
 */
import { applyCommands, type BuildingCommand } from '@buildapp/commands'
import { createEmptyModel, roofPlaneTopAt, validateModel, type AssemblyKind, type CanonicalBuildingModel, type Vec2, type Vec3 } from '@buildapp/model'
import { compileBuilding, geometryClosureAudit } from '@buildapp/geometry'
import type { SemanticProposal } from '../proposals.js'
import { roofGraphsOf } from '../graphs/roof-graph.js'
import { MAT, doorIn, gableHouse, rect, round, synthetic, type Cmd } from '../fixtures/builders.js'
import { dormerHost, roofDormerGable, roofHip, roofIntersectingGables } from '../fixtures/roofs.js'
import { buildFixture } from '../fixtures/run.js'
import { applyPipeline, runPipeline } from './pipeline.js'
import type { Decision, Family, PipelineResult } from './types.js'

export type HypothesisDemo = {
  id: string
  title: string
  context: () => Cmd[]
  proposals: () => SemanticProposal[]
  expect: {
    decisions: Array<{ decision: Decision; family?: Family }>
    /** Assemblies the pipeline adds, by kind. */
    assemblies: Partial<Record<AssemblyKind, number>>
    /** At least this many recorded metric conflicts (a lower authority that disagreed and lost). */
    minConflicts?: number
    /** The roof graph the pipeline states must match this fixture's. */
    roofTruth?: string
  }
}

type P = Omit<SemanticProposal, 'confidence' | 'detector' | 'authority'> & Partial<Pick<SemanticProposal, 'confidence' | 'detector' | 'authority'>>
const technical = (p: P): SemanticProposal => ({ confidence: 0.9, detector: 'DETERMINISTIC_CV', authority: 'TECHNICAL_GEOMETRY', ...p }) as SemanticProposal
const printedValue = (id: string, frame: string, featureKey: string, quantity: string, value: number): SemanticProposal => ({ id, kind: 'PRINTED_DIMENSION', geometry: { type: 'VALUE', quantity, value }, confidence: 0.95, sourceFrameId: frame, detector: 'OCR', authority: 'PRINTED_DIMENSION', featureKey })
const render = (p: P): SemanticProposal => ({ confidence: 0.6, detector: 'VLM', authority: 'PERSPECTIVE', ...p }) as SemanticProposal
const v3 = (x: number, y: number, z: number): Vec3 => ({ x: round(x), y: round(y), z: round(z) })
const seg = (a: Vec3, b: Vec3, extra: { width?: number; depth?: number } = {}): SemanticProposal['geometry'] => ({ type: 'SEGMENT', start: a, end: b, ...extra })

const base = (): Cmd[] => [
  { type: 'createBuilding', id: 'building', evidence: synthetic('building') },
  { type: 'addEvidenceSource', id: 'src-synthetic-fixture', kind: 'DERIVATION', label: 'synthetic context (generic parameters, no project)' },
  { type: 'createLevel', id: 'level-0', index: 0, elevation: 0, height: 3, evidence: synthetic('level-0') },
]

/** The proposals a roof plan, a section and a render would give for one roof assembly of a truth model. */
function roofEvidence(truth: CanonicalBuildingModel, featureKey: string, pitchDeg: number): SemanticProposal[] {
  const roof = truth.assemblies.find((a) => a.kind === 'ROOF')
  if (!roof || roof.kind !== 'ROOF') return []
  const out: SemanticProposal[] = []
  roof.planeIds.forEach((id, i) => {
    const p = truth.roofPlanes.find((x) => x.id === id)
    if (!p) return
    out.push(technical({ id: `region-${i + 1}`, kind: 'ROOF_PLANE_REGION', geometry: { type: 'POLYGON', points: p.boundary.map((q) => v3(q.x, roofPlaneTopAt(p, q.x, q.z), q.z)) }, sourceFrameId: 'roof-plan', featureKey }))
  })
  const joins = truth.roofEdges.filter((e) => roof.edgeIds.includes(e.id) && (e.kind === 'RIDGE' || e.kind === 'HIP' || e.kind === 'VALLEY'))
  joins.forEach((e, i) => out.push(technical({ id: `line-${i + 1}`, kind: 'ROOF_LINE', geometry: seg(v3(e.start.x, e.start.y, e.start.z), v3(e.end.x, e.end.y, e.end.z)), sourceFrameId: 'roof-plan', featureKey })))
  out.push(printedValue('pitch-printed', 'section-a', featureKey, 'roof.pitchDeg', pitchDeg))
  // a render reads the pitch 3° steeper: perspective does not override the printed section
  out.push(render({ id: 'pitch-render', kind: 'PRINTED_DIMENSION', geometry: { type: 'VALUE', quantity: 'roof.pitchDeg', value: pitchDeg + 3 }, sourceFrameId: 'render-1', featureKey }))
  return out
}

export const demoRoofIntersecting: HypothesisDemo = {
  id: 'roof-intersecting',
  title: 'Intersecting gables stated from a roof plan, a section and a render',
  context: () => [...base(), { type: 'defineMaterial', id: MAT.roof, name: 'roof tiles', color: '#4a4541' }],
  proposals: () => roofEvidence(buildFixture(roofIntersectingGables), 'roof', 35),
  expect: { decisions: [{ decision: 'ACCEPTED', family: 'ROOF' }], assemblies: { ROOF: 1 }, minConflicts: 4, roofTruth: 'roof-intersecting-gables' },
}

export const demoRoofHip: HypothesisDemo = {
  id: 'roof-hip',
  title: 'Hip roof stated from a roof plan and a section',
  context: () => [...base(), { type: 'defineMaterial', id: MAT.roof, name: 'roof tiles', color: '#4a4541' }],
  proposals: () => roofEvidence(buildFixture(roofHip), 'roof', 30),
  expect: { decisions: [{ decision: 'ACCEPTED', family: 'ROOF' }], assemblies: { ROOF: 1 }, minConflicts: 4, roofTruth: 'roof-hip' },
}

export const demoDormer: HypothesisDemo = {
  id: 'dormer',
  title: 'Gable dormer: an interrupted slope, a front face, a ridge and a window, seen in two elevations and a render',
  context: () => dormerHost().commands,
  proposals: () => {
    const truth = buildFixture(roofDormerGable)
    const d = truth.assemblies.find((a) => a.kind === 'DORMER')
    if (!d || d.kind !== 'DORMER') return []
    const host = truth.roofPlanes.find((p) => p.id === d.hostPlaneIds[0])
    const cut = truth.roofOpenings.find((o) => o.id === d.cutOpeningId)
    const local = truth.assemblies.find((a) => a.id === d.localRoofAssemblyId)
    if (!host || !cut?.outline || !local || local.kind !== 'ROOF') return []
    const eaveY = truth.roofPlanes.find((p) => p.id === local.planeIds[0])?.datum.y ?? 0
    const ridge = truth.roofEdges.find((e) => local.edgeIds.includes(e.id) && e.kind === 'RIDGE')
    const win = truth.openings.find((o) => d.openingIds.includes(o.id))
    const front = truth.walls.find((w) => d.wallIds.includes(w.id))
    if (!ridge || !win || !front) return []
    const level = truth.levels.find((l) => l.id === front.levelId)?.elevation ?? 0
    const L = Math.hypot(front.end.x - front.start.x, front.end.z - front.start.z)
    const u = { x: (front.end.x - front.start.x) / L, z: (front.end.z - front.start.z) / L }
    const at = (s: number): Vec2 => ({ x: front.start.x + u.x * s, z: front.start.z + u.z * s })
    const baseY = level + front.baseOffset
    const w0 = at(win.offset)
    const w1 = at(win.offset + win.width)
    const k = 'dormer-1'
    return [
      technical({ id: 'dormer-cut', kind: 'ROOF_INTERRUPTION', geometry: { type: 'POLYGON', points: cut.outline.map((q) => v3(q.x, roofPlaneTopAt(host, q.x, q.z), q.z)) }, sourceFrameId: 'roof-plan', featureKey: k }),
      technical({ id: 'dormer-face-elev', kind: 'VERTICAL_FACADE', geometry: seg(v3(3.5, eaveY, 1.0), v3(5.5, eaveY, 1.0)), sourceFrameId: 'elevation-front', featureKey: k }),
      render({ id: 'dormer-face-render', kind: 'VERTICAL_FACADE', geometry: seg(v3(3.52, eaveY + 0.05, 1.0), v3(5.47, eaveY + 0.05, 1.0)), sourceFrameId: 'render-1', featureKey: k }),
      technical({ id: 'dormer-ridge', kind: 'ROOF_LINE', geometry: seg(v3(ridge.start.x, ridge.start.y, ridge.start.z), v3(ridge.end.x, ridge.end.y, ridge.end.z)), sourceFrameId: 'elevation-side', featureKey: k }),
      technical({ id: 'dormer-window', kind: 'OPENING', geometry: { type: 'POLYGON', points: [v3(w0.x, baseY + win.sill, w0.z), v3(w1.x, baseY + win.sill, w1.z), v3(w1.x, baseY + win.sill + win.height, w1.z), v3(w0.x, baseY + win.sill + win.height, w0.z)] }, sourceFrameId: 'elevation-front', featureKey: k }),
    ]
  },
  expect: { decisions: [{ decision: 'ACCEPTED', family: 'DORMER' }], assemblies: { DORMER: 1, ROOF: 1 } },
}

/** A single-storey gable house with a front door and an entrance landing: the context the porch and step demos attach to. */
const houseWithDoor = (landing: boolean): Cmd[] => {
  const h = gableHouse({ W: 10, D: 8, H: 3.0, t: 0.3, pitchDeg: 35, overhang: 0.5, roofThickness: 0.25 })
  return [
    ...h.commands,
    ...doorIn(h.walls.front, 'door-front', 4.5, 1.0, 2.1, 'ENTRANCE'),
    ...(landing ? [{ type: 'createPlatform', id: 'landing-front', levelId: 'level-0', role: 'LANDING', polygon: rect(3.9, -1.6, 6.5, 0), topOffset: 0, thickness: 0.45, hostWallIds: [h.walls.front], materialId: MAT.paving, evidence: synthetic('landing') } as Cmd] : []),
  ]
}

export const demoPorchColumnsBeams: HypothesisDemo = {
  id: 'porch-columns-beams',
  title: 'Entrance canopy on two posts and a beam: plan, elevation, a printed canopy height, a render',
  context: () => houseWithDoor(true),
  proposals: () => {
    const k = 'porch'
    const post = (id: string, x: number, frame: string, top: number): SemanticProposal => technical({ id, kind: 'VERTICAL_MEMBER', geometry: seg(v3(x, 0, -1.45), v3(x, top, -1.45), { width: 0.12 }), sourceFrameId: frame, featureKey: k })
    return [
      post('post-w-plan', 4.2, 'plan-ground', 2.13),
      post('post-e-plan', 6.2, 'plan-ground', 2.13),
      post('post-w-elev', 4.2, 'elevation-front', 2.13),
      post('post-e-elev', 6.2, 'elevation-front', 2.13),
      render({ id: 'post-w-render', kind: 'VERTICAL_MEMBER', geometry: seg(v3(4.22, 0, -1.45), v3(4.22, 2.2, -1.45), { width: 0.12 }), sourceFrameId: 'render-1', featureKey: k }),
      technical({ id: 'beam-elev', kind: 'HORIZONTAL_MEMBER', geometry: seg(v3(4.14, 2.23, -1.45), v3(6.26, 2.23, -1.45), { width: 0.2, depth: 0.12 }), sourceFrameId: 'elevation-front', featureKey: k }),
      technical({ id: 'cover-elev', kind: 'COVER_SURFACE', geometry: { type: 'POLYGON', points: rect(3.8, -1.7, 6.6, 0).map((q) => v3(q.x, 2.45, q.z)) }, sourceFrameId: 'elevation-front', featureKey: k }),
      printedValue('cover-top-printed', 'section-b', k, 'cover.top', 2.45),
    ]
  },
  expect: { decisions: [{ decision: 'ACCEPTED', family: 'CANOPY' }], assemblies: { CANOPY: 1, ROOF: 1 } },
}

/** A house with a rear terrace deck: what a pergola stands on. */
const houseWithTerrace = (): Cmd[] => {
  const h = gableHouse({ W: 10, D: 8, H: 3.0, t: 0.3, pitchDeg: 35, overhang: 0.5, roofThickness: 0.25 })
  return [
    ...h.commands,
    { type: 'createTerrace', id: 'terrace-rear', levelId: 'level-0', polygon: rect(1, 8, 9, 12.4), topOffset: 0, thickness: 0.3, surface: 'DECK', edge: 'PLINTH', hostWallIds: [h.walls.rear], materialId: MAT.timber, evidence: synthetic('terrace') },
    ...doorIn(h.walls.rear, 'door-terrace', 4.3, 1.4, 2.2, 'TERRACE'),
  ]
}

function pergolaMembers(k: string): SemanticProposal[] {
  const out: SemanticProposal[] = []
  const posts: Array<[number, number]> = [
    [2, 9.2],
    [8, 9.2],
    [2, 11.8],
    [8, 11.8],
  ]
  posts.forEach(([x, z], i) => out.push(technical({ id: `pp-${i + 1}-plan`, kind: 'VERTICAL_MEMBER', geometry: seg(v3(x, 0, z), v3(x, 2.48, z), { width: 0.14 }), sourceFrameId: 'plan-garden', featureKey: k })))
  // the rear elevation sees the two posts nearest the house
  posts.slice(0, 2).forEach(([x, z], i) => out.push(technical({ id: `pp-${i + 1}-elev`, kind: 'VERTICAL_MEMBER', geometry: seg(v3(x, 0, z), v3(x, 2.48, z), { width: 0.14 }), sourceFrameId: 'elevation-rear', featureKey: k })))
  for (const [i, z] of [9.2, 11.8].entries()) out.push(technical({ id: `pb-${i + 1}`, kind: 'HORIZONTAL_MEMBER', geometry: seg(v3(1.7, 2.6, z), v3(8.3, 2.6, z), { width: 0.24, depth: 0.14 }), sourceFrameId: 'plan-garden', featureKey: k }))
  ;[2, 3.5, 5, 6.5, 8].forEach((x, i) => out.push(technical({ id: `pr-${i + 1}`, kind: 'HORIZONTAL_MEMBER', geometry: seg(v3(x, 2.8, 8.9), v3(x, 2.8, 12.1), { width: 0.16, depth: 0.08 }), sourceFrameId: 'plan-garden', featureKey: k })))
  return out
}

export const demoPergola: HypothesisDemo = {
  id: 'pergola',
  title: 'Pergola: repeated posts and members, open sky observed, a printed post height beating a render',
  context: houseWithTerrace,
  proposals: () => {
    const k = 'garden-frame'
    return [
      ...pergolaMembers(k),
      render({ id: 'sky-render', kind: 'NO_COVER_OBSERVED', geometry: { type: 'POLYGON', points: rect(2, 9.2, 8, 11.8).map((q) => v3(q.x, 2.9, q.z)) }, sourceFrameId: 'render-garden', featureKey: k }),
      render({ id: 'pp-1-render', kind: 'VERTICAL_MEMBER', geometry: seg(v3(2.03, 0, 9.2), v3(2.03, 2.8, 9.2), { width: 0.14 }), sourceFrameId: 'render-garden', featureKey: k }),
      printedValue('post-top-printed', 'section-garden', k, 'post.top', 2.48),
    ]
  },
  expect: { decisions: [{ decision: 'ACCEPTED', family: 'PERGOLA' }], assemblies: { PERGOLA: 1 }, minConflicts: 1 },
}

export const demoPergolaAmbiguous: HypothesisDemo = {
  id: 'pergola-ambiguous',
  title: 'The same frame with no observation of whether a cover spans it: kept unknown, not guessed',
  context: houseWithTerrace,
  proposals: () => pergolaMembers('garden-frame'),
  expect: { decisions: [{ decision: 'UNKNOWN' }], assemblies: { UNKNOWN: 1 } },
}

export const demoEntranceSteps: HypothesisDemo = {
  id: 'entrance-steps',
  title: 'Entrance steps: three nosings and a landing in plan and elevation, printed datums',
  context: () => houseWithDoor(false),
  proposals: () => {
    const k = 'entrance'
    const nosing = (i: number, frame: string): SemanticProposal => technical({ id: `nosing-${i}-${frame}`, kind: 'STEP_EDGE', geometry: seg(v3(4.2, -0.5 + i * 0.125, -2.2 + (i - 1) * 0.3), v3(6.0, -0.5 + i * 0.125, -2.2 + (i - 1) * 0.3)), sourceFrameId: frame, featureKey: k })
    return [
      nosing(1, 'plan-ground'),
      nosing(2, 'plan-ground'),
      nosing(3, 'plan-ground'),
      nosing(1, 'elevation-front'),
      nosing(3, 'elevation-front'),
      technical({ id: 'landing-plan', kind: 'LEVEL_SURFACE', geometry: { type: 'POLYGON', points: rect(4.0, -1.3, 6.2, 0).map((q) => v3(q.x, 0, q.z)) }, sourceFrameId: 'plan-ground', featureKey: k }),
      printedValue('landing-datum', 'elevation-front', k, 'landing.top', 0),
      printedValue('grade-datum', 'elevation-front', k, 'site.grade', -0.5),
    ]
  },
  expect: { decisions: [{ decision: 'ACCEPTED', family: 'EXTERIOR_STEPS' }], assemblies: { EXTERIOR_STAIR: 1, ENTRANCE: 1 } },
}

export const demoUnknown: HypothesisDemo = {
  id: 'unknown',
  title: 'A raised panel on the front slope seen in two renders: an unknown assembly with its alternatives',
  context: () => gableHouse({ W: 10, D: 8, H: 3.0, t: 0.3, pitchDeg: 35, overhang: 0.5, roofThickness: 0.25 }).commands,
  proposals: () => {
    const t = Math.tan((35 * Math.PI) / 180)
    const top = (z: number): number => 3.0 + 0.25 / Math.cos((35 * Math.PI) / 180) + z * t
    const p = (x: number, z: number, lift: number): Vec3 => v3(x, top(z) + lift, z)
    const k = 'slope-panel'
    return [
      render({ id: 'panel-a', kind: 'UNCLASSIFIED_GEOMETRY', geometry: { type: 'POLYGON', points: [p(6.5, 1.0, 0.15), p(8.0, 1.0, 0.15), p(8.0, 2.2, 0.15), p(6.5, 2.2, 0.15)] }, sourceFrameId: 'render-a', featureKey: k, confidence: 0.4 }),
      render({ id: 'panel-b', kind: 'UNCLASSIFIED_GEOMETRY', geometry: { type: 'POLYGON', points: [p(6.52, 1.02, 0.15), p(7.98, 1.02, 0.15), p(7.98, 2.18, 0.15), p(6.52, 2.18, 0.15)] }, sourceFrameId: 'render-b', featureKey: k, confidence: 0.4 }),
      render({ id: 'panel-edge-b', kind: 'ROOF_LINE', geometry: seg(p(6.5, 2.2, 0.15), p(8.0, 2.2, 0.15)), sourceFrameId: 'render-b', featureKey: k, confidence: 0.35 }),
    ]
  },
  expect: { decisions: [{ decision: 'UNKNOWN' }], assemblies: { UNKNOWN: 1 } },
}

export const ALL_DEMOS: readonly HypothesisDemo[] = [demoRoofIntersecting, demoRoofHip, demoDormer, demoPorchColumnsBeams, demoPergola, demoPergolaAmbiguous, demoEntranceSteps, demoUnknown]

export type DemoRun = {
  id: string
  title: string
  ok: boolean
  failures: string[]
  proposals: number
  hypotheses: Array<{ id: string; decision: Decision; family?: string; confidence: number; reasons: string[]; alternatives: Array<{ kind: string; confidence: number; why: string }> }>
  addedAssemblies: Partial<Record<AssemblyKind, number>>
  commands: number
  conflicts: Array<{ key: string; kept: string; lost: string; why: string }>
  closureErrors: number
  roofTruth?: { fixture: string; match: boolean; stated: string; derived: string }
  log: PipelineResult['log']
}

const modelFrom = (commands: readonly BuildingCommand[]): CanonicalBuildingModel => {
  const r = applyCommands(createEmptyModel('demo-context', 'hypothesis demo context', 'buildapp-architecture-demos'), commands)
  if (r.failedAt !== undefined) throw new Error(`demo context command ${r.failedAt} refused`)
  return r.model
}

/** Run one demo: context → pipeline → apply → validate → compile → closure audit, and hold the result to the demo's expectations. */
export function runDemo(d: HypothesisDemo): DemoRun & { model: CanonicalBuildingModel; result: PipelineResult } {
  const failures: string[] = []
  const context = modelFrom(d.context())
  const result = runPipeline({ proposals: d.proposals(), context })
  const again = runPipeline({ proposals: d.proposals(), context })
  if (JSON.stringify(again.commands) !== JSON.stringify(result.commands)) failures.push('the pipeline is not deterministic')
  let model = context
  try {
    model = applyPipeline(context, result)
  } catch (e) {
    failures.push((e as Error).message)
  }
  const v = validateModel(model)
  if (!v.ok) failures.push(`model invalid: ${v.issues.filter((i) => i.severity === 'ERROR').map((i) => `[${i.code}] ${i.message}`).join('; ')}`)
  const warnings = v.issues.filter((i) => i.severity === 'WARNING')
  if (warnings.length > 0) failures.push(`validation warnings: ${warnings.map((i) => `[${i.code}] ${i.message}`).join('; ')}`)
  const scene = compileBuilding(model)
  const cerr = scene.diagnostics.filter((x) => x.severity === 'ERROR')
  if (cerr.length > 0) failures.push(`compile errors: ${cerr.map((x) => x.message).join('; ')}`)
  const closure = geometryClosureAudit(model, scene)
  const closureErrors = closure.findings.filter((f) => f.scope === 'EXTERIOR' && f.severity !== 'INFO')
  if (closureErrors.length > 0) failures.push(`closure: ${closureErrors.map((f) => `${f.code} ${f.objects.join('×')} ${f.measure}${f.unit}`).join('; ')}`)
  const decisions = result.hypotheses.map((h) => ({ decision: h.decision, ...(h.family ? { family: h.family } : {}) }))
  if (JSON.stringify(decisions) !== JSON.stringify(d.expect.decisions)) failures.push(`decisions ${JSON.stringify(decisions)} ≠ expected ${JSON.stringify(d.expect.decisions)}`)
  const before = new Set(context.assemblies.map((a) => a.id))
  const addedAssemblies: Partial<Record<AssemblyKind, number>> = {}
  for (const a of model.assemblies) if (!before.has(a.id)) addedAssemblies[a.kind] = (addedAssemblies[a.kind] ?? 0) + 1
  if (JSON.stringify(Object.entries(addedAssemblies).sort()) !== JSON.stringify(Object.entries(d.expect.assemblies).sort())) failures.push(`added assemblies ${JSON.stringify(addedAssemblies)} ≠ expected ${JSON.stringify(d.expect.assemblies)}`)
  const conflicts = result.quantities.flatMap((q) => q.conflicts.map((c) => ({ key: q.key, kept: `${c.kept.value} (${c.kept.authority}, ${c.kept.sourceId})`, lost: `${c.lost.value} (${c.lost.authority}, ${c.lost.sourceId})`, why: c.why })))
  if (d.expect.minConflicts !== undefined && conflicts.length < d.expect.minConflicts) failures.push(`expected ≥ ${d.expect.minConflicts} recorded conflicts, found ${conflicts.length}`)
  let roofTruth: DemoRun['roofTruth']
  if (d.expect.roofTruth) {
    const fixture = [roofHip, roofIntersectingGables].find((f) => f.id === d.expect.roofTruth)
    const truth = fixture ? roofGraphsOf(buildFixture(fixture)).find((g) => g.source === 'ROOF_ASSEMBLY') : undefined
    const mine = roofGraphsOf(model).find((g) => g.source === 'ROOF_ASSEMBLY' && !before.has(g.id))
    const shape = (g: NonNullable<typeof truth>): string =>
      JSON.stringify({
        planes: g.planes.map((p) => ({ pitch: Math.round(p.pitchDeg * 1e4) / 1e4, down: p.downslope, area: Math.round(p.planArea * 1e4) / 1e4 })).sort((a, b) => a.area - b.area || a.down.x - b.down.x || a.down.z - b.down.z),
        ridges: g.ridges.length,
        hips: g.hips.length,
        valleys: g.valleys.length,
        eaves: g.eaves.length,
        verges: g.verges.length,
      })
    const match = !!truth && !!mine && shape(truth) === shape(mine) && truth.classification === mine.classification
    if (!match) failures.push(`the stated roof graph does not match ${d.expect.roofTruth}: ${mine ? shape(mine) : 'none'} vs ${truth ? shape(truth) : 'none'}`)
    roofTruth = { fixture: d.expect.roofTruth, match, stated: mine?.classification ?? 'none', derived: mine?.derivedClassification ?? 'none' }
  }
  return {
    id: d.id,
    title: d.title,
    ok: failures.length === 0,
    failures,
    proposals: result.proposals.length,
    hypotheses: result.hypotheses.map((h) => ({ id: h.id, decision: h.decision, ...(h.family ? { family: h.family } : {}), confidence: h.confidence, reasons: h.reasons, alternatives: h.alternatives })),
    addedAssemblies,
    commands: result.commands.length,
    conflicts,
    closureErrors: closureErrors.length,
    ...(roofTruth ? { roofTruth } : {}),
    log: result.log,
    model,
    result,
  }
}
