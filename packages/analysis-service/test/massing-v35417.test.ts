/**
 * v3.54.17 §8 — the body and roof mechanism on controlled houses whose source elevations are painted here and are the
 * independent truth. Tolerances were fixed before any result (MASSING_TOLERANCES, and below): the mass within 0.15 m in
 * plan and 0.25 m in height of the painted house, the roof's form and ridge direction exact. Every counter-trial has its
 * counterpart, and each counterpart executes on a compiled model.
 */
import { describe, expect, it } from 'vitest'
import { applyCommands } from '@buildapp/commands'
import type { BuildingCommand } from '@buildapp/commands'
import { compileBuilding } from '@buildapp/geometry'
import { createEmptyModel } from '@buildapp/model'
import type { CanonicalBuildingModel } from '@buildapp/model'
import { executeCorrections, modelRevision } from '../src/consult/correct/execute.js'
import type { BindPicture, BindView, CorrectionProposal, Side } from '../src/consult/correct/execute.js'
import { CAPABILITIES, capabilityPrompt, PATCH_OPERATIONS } from '../src/consult/correct/registry.js'
import { bodiesOf, bodyCommands, rectanglesOf, solveMassing } from '../src/consult/massing/massing.js'
import type { BodySpec, OutlineObservation, SilhouetteObservation } from '../src/consult/massing/massing.js'
import type { MassingObservations } from '../src/consult/massing/ops.js'

const PLAN_TOL = 0.15
const HEIGHT_TOL = 0.25
const MPP = 0.02
const ZERO = 400
const W = 960
const H = 440

type TrueBody = { id: string; minX: number; maxX: number; minZ: number; maxZ: number; eaves: number; ridge?: number; axis?: 'X' | 'Z' }
const MAIN: TrueBody = { id: 'main', minX: 0, maxX: 10, minZ: 0, maxZ: 8, eaves: 3.2, ridge: 6.0, axis: 'X' }
const GARAGE: TrueBody = { id: 'garage', minX: 10, maxX: 16, minZ: 0, maxZ: 6, eaves: 2.8 }
const TREE = { a0: 10.6, a1: 12.6, top: 4.5 }

/** Each side's drawing: along runs left to right as a viewer facing that side sees it. */
const ORIGIN: Record<Side, { a0: number; sign: 1 | -1; axis: 'x' | 'z'; depth: (b: TrueBody) => number }> = {
  FRONT: { a0: -1, sign: 1, axis: 'x', depth: (b) => b.minZ },
  RIGHT: { a0: -1, sign: 1, axis: 'z', depth: (b) => -b.maxX },
  REAR: { a0: 17, sign: -1, axis: 'x', depth: (b) => -b.maxZ },
  LEFT: { a0: 9, sign: -1, axis: 'z', depth: (b) => b.minX },
}
const col = (s: Side, a: number): number => (ORIGIN[s].sign === 1 ? (a - ORIGIN[s].a0) / MPP : (ORIGIN[s].a0 - a) / MPP)
const row = (y: number): number => ZERO - y / MPP
const span = (s: Side, b: TrueBody): [number, number] => (ORIGIN[s].axis === 'x' ? [b.minX, b.maxX] : [b.minZ, b.maxZ])
type Drawn = { walls: Array<{ body: string; poly: Array<[number, number]> }>; roofs: Array<{ body: string; poly: Array<[number, number]> }> }

function drawnOf(s: Side, bodies: TrueBody[]): Drawn {
  const out: Drawn = { walls: [], roofs: [] }
  for (const b of bodies) {
    const [lo, hi] = span(s, b)
    const c0 = Math.min(col(s, lo), col(s, hi))
    const c1 = Math.max(col(s, lo), col(s, hi))
    out.walls.push({ body: b.id, poly: [[c0, row(0)], [c1, row(0)], [c1, row(b.eaves)], [c0, row(b.eaves)]] })
    if (b.ridge && b.axis) {
      const along = (ORIGIN[s].axis === 'x') === (b.axis === 'X')
      out.roofs.push({ body: b.id, poly: along ? [[c0, row(b.eaves)], [c1, row(b.eaves)], [c1, row(b.ridge)], [c0, row(b.ridge)]] : [[c0, row(b.eaves)], [c1, row(b.eaves)], [(c0 + c1) / 2, row(b.ridge)]] })
    }
  }
  return out
}

function inPoly(poly: Array<[number, number]>, x: number, y: number): boolean {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if (poly[i][1] > y !== poly[j][1] > y && x < ((poly[j][0] - poly[i][0]) * (y - poly[i][1])) / (poly[j][1] - poly[i][1]) + poly[i][0]) c = !c
  return c
}

/** The painted elevation: sky, ground, render on the walls, a striped roof; far bodies first (a painter's order). */
function paint(s: Side, bodies: TrueBody[], tree = false): BindPicture['raster'] {
  const data = new Uint8ClampedArray(W * H * 4)
  let seed = 11 + s.length
  const rnd = (): number => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  const order = [...bodies].sort((a, b) => ORIGIN[s].depth(b) - ORIGIN[s].depth(a))
  const d = drawnOf(s, order)
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const n = Math.round((rnd() - 0.5) * 18)
    let c: [number, number, number] = y > ZERO ? [120 + n, 150 + n, 100 + n] : [225, 235, 245]
    for (const b of order) {
      const wall = d.walls.find((q) => q.body === b.id)
      const roof = d.roofs.find((q) => q.body === b.id)
      if (wall && inPoly(wall.poly, x, y)) c = [228 + n, 218 + n, 198 + n]
      if (roof && inPoly(roof.poly, x, y)) c = [92 + n, 92 + n, 98 + n + (x % 9 < 2 ? 25 : 0)]
    }
    if (tree && s === 'FRONT') {
      // an irregular crown and a trunk: not a wall
      const cx = (col('FRONT', TREE.a0) + col('FRONT', TREE.a1)) / 2
      const r = (col('FRONT', TREE.a1) - col('FRONT', TREE.a0)) / 2
      const cy = row(TREE.top) + r
      const wob = r * (0.8 + 0.2 * Math.sin(Math.atan2(y - cy, x - cx) * 7))
      if (Math.hypot(x - cx, y - cy) < wob) c = [60 + n, 110 + n, 55 + n]
      if (Math.abs(x - cx) < 6 && y > cy && y <= ZERO) c = [100 + n, 80 + n, 60 + n]
    }
    data.set([c[0], c[1], c[2], 255], (y * W + x) * 4)
  }
  return { width: W, height: H, data }
}

const frameOf = (s: Side): string => `frame-${s.toLowerCase()}`
const sha = (s: Side): string => (s.charCodeAt(0).toString(16) + 'f').repeat(32).slice(0, 64)
function pictures(bodies: TrueBody[], tree = false): BindPicture[] {
  return (['FRONT', 'RIGHT', 'REAR', 'LEFT'] as Side[]).map((s, i) => ({ n: i + 1, frameId: frameOf(s), projection: 'ORTHOGRAPHIC_ELEVATION', transform: { x0: 0, y0: 0, scale: 1 }, raster: paint(s, bodies, tree), sourceByteHash: sha(s) }))
}
/** What the sketch reader returns for each picture: wall zones and roof surfaces as drawn, the ground row. */
function silhouettes(bodies: TrueBody[], opts: { ground?: boolean } = {}): SilhouetteObservation[] {
  return (['FRONT', 'RIGHT', 'REAR', 'LEFT'] as Side[]).map((s) => {
    const d = drawnOf(s, bodies)
    return { observationId: `sk-${s}`, side: s, frameId: frameOf(s), sourceByteHash: sha(s), groundRow: opts.ground === false ? null : ZERO, walls: d.walls.map((w) => w.poly), roofs: d.roofs.map((r) => r.poly) }
  })
}
const outlineOf = (bodies: TrueBody[]): OutlineObservation => {
  // the plan outline as a ring (one rectangle, or an L of two joined rectangles sharing their front)
  const pts = bodies.length === 1
    ? [{ x: bodies[0].minX, z: bodies[0].minZ }, { x: bodies[0].maxX, z: bodies[0].minZ }, { x: bodies[0].maxX, z: bodies[0].maxZ }, { x: bodies[0].minX, z: bodies[0].maxZ }]
    : [{ x: 0, z: 0 }, { x: 16, z: 0 }, { x: 16, z: 6 }, { x: 10, z: 6 }, { x: 10, z: 8 }, { x: 0, z: 8 }]
  return { observationId: 'plan-outline', frameId: 'frame-plan', sourceByteHash: 'p'.repeat(64), outline: pts, by: 'CONTROL', fidelity: 'SOURCE_DERIVED', why: 'the controlled plan, read at its measured scale' }
}
const viewOf = (s: Side): BindView => ({ side: s, frameId: frameOf(s), projection: { mpp: MPP, alongAtPx0: ORIGIN[s].a0, alongSign: ORIGIN[s].sign, zeroRow: ZERO }, heights: true, origin: 'ANALYZER', alongErrorM: 0.04, heightErrorM: 0.06 })
const propose = (m: CanonicalBuildingModel, p: Partial<CorrectionProposal> & { operation: string }): CorrectionProposal => ({ proposalId: p.proposalId ?? `p-${Math.random().toString(36).slice(2, 8)}`, baseRevision: p.baseRevision ?? modelRevision(m), targetId: p.targetId ?? 'WHOLE', origin: 'CONTROL', uncertainty: 'LOW', ...p } as CorrectionProposal)
const empty = (): CanonicalBuildingModel => createEmptyModel('m-massing', 'controlled')
function build(cmds: BuildingCommand[]): CanonicalBuildingModel {
  const r = applyCommands(empty(), cmds)
  if (r.failedAt !== undefined) throw new Error(JSON.stringify(r.results[r.failedAt]).slice(0, 300))
  return r.model
}
const spec = (b: TrueBody, over: Partial<BodySpec['roof']> = {}): BodySpec => ({ id: `mass-${b.id}`, rect: { minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ }, roof: b.ridge ? { kind: 'GABLE', ridgeAxis: b.axis, pitchDeg: Math.round((Math.atan2(b.ridge - b.eaves, ((b.axis === 'X' ? b.maxZ - b.minZ : b.maxX - b.minX) / 2)) * 1800) / Math.PI) / 10, eavesM: b.eaves, ridgeM: b.ridge, ...over } : { kind: 'FLAT', eavesM: b.eaves, ...over }, provenance: {} })
const modelOf = (bodies: BodySpec[], extra: BuildingCommand[] = []): CanonicalBuildingModel => build([
  { type: 'createBuilding', id: 'building' },
  { type: 'createLevel', id: 'lvl-0', index: 0, elevation: 0, height: 6 },
  ...bodies.flatMap((b) => bodyCommands(b, 'lvl-0', 0, bodies.filter((q) => q !== b).map((q) => q.rect), 0.3)),
  ...extra,
] as BuildingCommand[])
const near = (a: number, b: number, t: number): boolean => Math.abs(a - b) <= t

describe('v3.54.17 registry: the body and roof operations are offered, dispatched and measured', () => {
  it('BUILD_MASSING, SET_ROOF and SET_OUTLINE have a consumer, a measure, fields and a prompt line', () => {
    for (const op of ['BUILD_MASSING', 'SET_ROOF', 'SET_OUTLINE'] as const) {
      expect(PATCH_OPERATIONS).toContain(op)
      expect(CAPABILITIES[op].consumer.length).toBeGreaterThan(20)
      expect(CAPABILITIES[op].measure.length).toBeGreaterThan(20)
      expect(capabilityPrompt()).toContain(`- ${op} —`)
    }
    expect(CAPABILITIES.SET_ROOF.params).toEqual(expect.arrayContaining(['roofKind', 'roofPolygon']))
  })
  it('an orthogonal outline splits into one or two rectangles; a U is beyond the supported scope', () => {
    expect(rectanglesOf(outlineOf([MAIN]).outline).splits).toHaveLength(1)
    expect(rectanglesOf(outlineOf([MAIN, GARAGE]).outline).splits).toHaveLength(2)
    expect(rectanglesOf([{ x: 0, z: 0 }, { x: 12, z: 0 }, { x: 12, z: 8 }, { x: 8, z: 8 }, { x: 8, z: 4 }, { x: 4, z: 4 }, { x: 4, z: 8 }, { x: 0, z: 8 }]).splits).toHaveLength(0)
  })
})

describe('v3.54.17 §8 no model: plan + elevations → bodies + roofs → mesh, without a LOCAL run', () => {
  const truth = [MAIN, GARAGE]
  const pics = pictures(truth)
  const obs: MassingObservations = { outline: outlineOf(truth), silhouettes: silhouettes(truth) }

  it('the solver reads two bodies: the main gable along X, the garage flat, within the tolerances fixed before', () => {
    const h = solveMassing({ outline: obs.outline as OutlineObservation, silhouettes: obs.silhouettes })
    expect(h.status).toBe('BUILDABLE')
    const main = h.bodies.find((b) => b.rect.maxX - b.rect.minX > 9) as BodySpec
    const gar = h.bodies.find((b) => b !== main) as BodySpec
    expect(near(main.rect.minX, 0, PLAN_TOL) && near(main.rect.maxX, 10, PLAN_TOL) && near(main.rect.maxZ, 8, PLAN_TOL)).toBe(true)
    expect(near(gar.rect.minX, 10, PLAN_TOL) && near(gar.rect.maxX, 16, PLAN_TOL) && near(gar.rect.maxZ, 6, PLAN_TOL)).toBe(true)
    expect(main.roof).toMatchObject({ kind: 'GABLE', ridgeAxis: 'X' })
    expect(near(main.roof.eavesM, 3.2, HEIGHT_TOL) && near(main.roof.ridgeM as number, 6.0, HEIGHT_TOL)).toBe(true)
    expect(gar.roof.kind).toBe('FLAT')
    expect(near(gar.roof.eavesM, 2.8, HEIGHT_TOL)).toBe(true)
    // the registrations were made by the plan: the same scale the drawing was painted at
    for (const v of h.views) expect(near(v.projection.mpp, MPP, 0.0005)).toBe(true)
  })

  it('BUILD_MASSING on the empty model commits a compiled mesh with provenance on every body; nothing is SOURCE_EXACT', () => {
    const m = empty()
    const out = executeCorrections({ model: m, views: [], pictures: pics, proposals: [propose(m, { operation: 'BUILD_MASSING' })], massing: obs })
    expect(out.records[0].why).toBe('applied, compiled and measured')
    expect(out.records[0].status).toBe('COMMITTED')
    const bodies = bodiesOf(out.model)
    expect(bodies).toHaveLength(2)
    expect(out.model.roofs.map((r) => r.kind).sort()).toEqual(['FLAT', 'GABLE'])
    expect(out.model.roofs.find((r) => r.kind === 'GABLE')?.ridgeAxis).toBe('X')
    const scene = compileBuilding(out.model)
    expect(scene).toBeTruthy()
    expect(out.records[0].measure?.sourceVerified).toBe(true)
    for (const r of out.model.wallRings) expect(['SOURCE_DERIVED', 'UNRESOLVED', 'ASSUMED', 'GEOMETRIC_INFERRED']).toContain(r.evidence?.status ?? out.model.walls.find((w) => w.id === r.wallIds[0])?.evidence?.status)
    expect(JSON.stringify(out.model)).not.toContain('SOURCE_EXACT')
    expect(out.model.evidenceSources.map((s) => s.id)).toContain('src-frame-front')
    // the registrations it made are kept for what is placed through them next
    expect(out.views.filter((v) => v.origin === 'ASSIGNED').length).toBe(4)
  })

  it('counter-trial: a missing anchor (no ground line on any elevation) builds nothing and names the anchor', () => {
    const m = empty()
    const out = executeCorrections({ model: m, views: [], pictures: pics, proposals: [propose(m, { operation: 'BUILD_MASSING' })], massing: { outline: obs.outline, silhouettes: silhouettes(truth, { ground: false }) } })
    expect(out.records[0].status).toBe('NEEDS_EVIDENCE')
    expect(out.records[0].code).toBe('MASSING_MISSING_ANCHORS')
    expect(out.records[0].why).toContain('ELEVATION_SILHOUETTE')
    expect(out.revision).toBe(out.baseRevision)
    // and no outline at all is a missing outline, not a missing reader
    const none = executeCorrections({ model: m, views: [], pictures: pics, proposals: [propose(m, { operation: 'BUILD_MASSING', proposalId: 'p-none' })], massing: { silhouettes: obs.silhouettes } })
    expect(none.records[0].code).toBe('NO_OUTLINE')
  })

  it('counter-trial: one elevation only gives the mass, but its heights are TRACE_UNCERTAIN, never derived', () => {
    const h = solveMassing({ outline: obs.outline as OutlineObservation, silhouettes: obs.silhouettes.filter((s) => s.side === 'FRONT') })
    expect(h.status).toBe('BUILDABLE')
    for (const b of h.bodies) expect(b.provenance.height.fidelity).toBe('TRACE_UNCERTAIN')
  })
})

describe('v3.54.17 §8 wrong roof: a flat base roof corrected to the gable the elevation draws', () => {
  const truth = [MAIN]
  const pics = pictures(truth)
  const front = silhouettes(truth).find((s) => s.side === 'FRONT') as SilhouetteObservation
  const right = silhouettes(truth).find((s) => s.side === 'RIGHT') as SilhouetteObservation
  const window: BuildingCommand[] = [{ type: 'cutOpening', id: 'win-1', wallId: 'ring-mass-main-w0', kind: 'WINDOW', offset: 2, sill: 0.9, width: 1.2, height: 1.2 } as BuildingCommand, { type: 'placeWindow', id: 'win-1-unit', openingId: 'win-1' } as BuildingCommand]
  const wrong = (): CanonicalBuildingModel => modelOf([spec(MAIN, { kind: 'FLAT', eavesM: 3.2, ridgeAxis: undefined, ridgeM: undefined, pitchDeg: undefined })], window)
  const views = (['FRONT', 'RIGHT', 'REAR', 'LEFT'] as Side[]).map(viewOf)

  it('SET_ROOF from the front elevation: GABLE along X, the walls follow it, the window and every id kept', () => {
    const m = wrong()
    expect(m.roofs[0].kind).toBe('FLAT')
    const p = propose(m, { operation: 'SET_ROOF', targetId: 'roof-mass-main', frameId: frameOf('FRONT'), patch: { roofKind: 'GABLE', roofPolygon: front.roofs[0] as Array<[number, number]> } })
    const out = executeCorrections({ model: m, views, pictures: pics, proposals: [p] })
    expect(out.records[0].why).toBe('applied, compiled and measured')
    const roof = out.model.roofs.find((r) => r.id === 'roof-mass-main')
    expect(roof).toMatchObject({ kind: 'GABLE', ridgeAxis: 'X' })
    expect(near((roof?.eaveOffset ?? 0), 3.2, HEIGHT_TOL)).toBe(true)
    const ridge = (roof?.eaveOffset ?? 0) + Math.tan(((roof?.pitchDeg ?? 0) * Math.PI) / 180) * 4
    expect(near(ridge, 6.0, HEIGHT_TOL)).toBe(true)
    for (const w of out.model.walls) expect(w.topProfile?.kind).toBe('FOLLOW_ROOF')
    expect(out.model.openings.map((o) => o.id)).toEqual(['win-1'])
    expect(out.model.walls.map((w) => w.id)).toEqual(m.walls.map((w) => w.id))
    expect(out.records[0].measure?.sourceVerified).toBe(true)
    expect(out.transactions[0].collateral).toEqual([])
  })

  it('the same correction read on the gable-end elevation (a triangle) gives the same ridge direction', () => {
    const m = wrong()
    const out = executeCorrections({ model: m, views, pictures: pics, proposals: [propose(m, { operation: 'SET_ROOF', targetId: 'roof-mass-main', frameId: frameOf('RIGHT'), patch: { roofKind: 'GABLE', roofPolygon: right.roofs[0] as Array<[number, number]> } })] })
    expect(out.records[0].status).toBe('COMMITTED')
    expect(out.model.roofs[0].ridgeAxis).toBe('X')
  })

  it('counter-trial: a bad proposal against a good roof (flat; or the ridge turned) is refused by the source', () => {
    const good = modelOf([spec(MAIN)], window)
    const flatBand: Array<[number, number]> = [[col('FRONT', 0), row(3.2)], [col('FRONT', 10), row(3.2)], [col('FRONT', 10), row(3.45)], [col('FRONT', 0), row(3.45)]]
    const flat = executeCorrections({ model: good, views, pictures: pics, proposals: [propose(good, { operation: 'SET_ROOF', targetId: 'roof-mass-main', frameId: frameOf('FRONT'), patch: { roofKind: 'FLAT', roofPolygon: flatBand } })] })
    expect(flat.records[0].status).not.toBe('COMMITTED')
    expect(flat.revision).toBe(flat.baseRevision)
    const turned: Array<[number, number]> = [[col('FRONT', 0), row(3.2)], [col('FRONT', 10), row(3.2)], [col('FRONT', 5), row(6.0)]]
    const t = executeCorrections({ model: good, views, pictures: pics, proposals: [propose(good, { operation: 'SET_ROOF', targetId: 'roof-mass-main', frameId: frameOf('FRONT'), patch: { roofKind: 'GABLE', roofPolygon: turned } })] })
    expect(t.records[0].status).toBe('REJECTED_BY_SOURCE')
    expect(t.revision).toBe(t.baseRevision)
  })

  it('a dependant that cannot follow refuses the whole patch: a window rising above the drawn eaves', () => {
    const m = modelOf([spec(MAIN, { kind: 'FLAT', eavesM: 4.4, ridgeAxis: undefined, ridgeM: undefined, pitchDeg: undefined })], [{ type: 'cutOpening', id: 'win-hi', wallId: 'ring-mass-main-w0', kind: 'WINDOW', offset: 2, sill: 2.4, width: 1.2, height: 1.4 } as BuildingCommand])
    const out = executeCorrections({ model: m, views, pictures: pics, proposals: [propose(m, { operation: 'SET_ROOF', targetId: 'roof-mass-main', frameId: frameOf('FRONT'), patch: { roofKind: 'GABLE', roofPolygon: front.roofs[0] as Array<[number, number]> } })] })
    expect(out.records[0].code).toBe('OPENING_ABOVE_EAVES')
    expect(out.revision).toBe(out.baseRevision)
  })
})

describe('v3.54.17 §8 two bodies: two ridges are two facts, not a dispute', () => {
  const GABLED: TrueBody = { ...GARAGE, ridge: 4.6, axis: 'Z' }
  it('a main gable along X and a garage gable along Z are both read and both built, each with its own heights', () => {
    const truth = [MAIN, GABLED]
    const h = solveMassing({ outline: outlineOf(truth), silhouettes: silhouettes(truth) })
    expect(h.status).toBe('BUILDABLE')
    expect(h.missing).toEqual([])
    const main = h.bodies.find((b) => b.id === 'mass-main') as BodySpec
    const gar = h.bodies.find((b) => b.id !== 'mass-main') as BodySpec
    expect(main.roof).toMatchObject({ kind: 'GABLE', ridgeAxis: 'X' })
    expect(gar.roof).toMatchObject({ kind: 'GABLE', ridgeAxis: 'Z' })
    expect(near(main.roof.ridgeM as number, 6.0, HEIGHT_TOL) && near(gar.roof.ridgeM as number, 4.6, HEIGHT_TOL)).toBe(true)
    const m = empty()
    const out = executeCorrections({ model: m, views: [], pictures: pictures(truth), proposals: [propose(m, { operation: 'BUILD_MASSING' })], massing: { outline: outlineOf(truth), silhouettes: silhouettes(truth) } })
    expect(out.records[0].status).toBe('COMMITTED')
    expect(out.model.roofs.map((r) => r.ridgeAxis).sort()).toEqual(['X', 'Z'])
  })
  it('an equal pitch printed over the garage does not re-pitch the main roof (the resolver); over the main body it does', () => {
    const m = modelOf([spec(MAIN), spec(GABLED)])
    const pitch = m.roofs.find((r) => r.id === 'roof-mass-main')?.pitchDeg as number
    const w = (x: number) => ({ valueM: 40, unit: 'deg' as const, frameId: frameOf('FRONT'), by: 'METRIC_READ' as const, role: 'ROOF_PITCH', literal: '40°', sourceByteHash: sha('FRONT'), box: { x0: col('FRONT', x) - 15, x1: col('FRONT', x) + 15, y0: row(5) - 6, y1: row(5) + 6 } })
    const p = propose(m, { operation: 'SET_PARAMETER', targetId: 'roof-mass-main', patch: { property: 'ROOF_PITCH', value: 40, unit: 'deg', literal: '40°' } })
    const wrong = executeCorrections({ model: m, views: [viewOf('FRONT')], pictures: [], proposals: [p], witnesses: [w(13)] })
    expect(wrong.records[0].code).toBe('HOST_NOT_BOUND')
    expect(wrong.model.roofs.find((r) => r.id === 'roof-mass-main')?.pitchDeg).toBe(pitch)
    const right = executeCorrections({ model: m, views: [viewOf('FRONT')], pictures: [], proposals: [{ ...p, proposalId: 'p-r' }], witnesses: [w(5)] })
    expect(right.records[0].status).toBe('COMMITTED')
  })
})

describe('v3.54.17 §8 outline change: a wing or a longer body enters the model; a tree does not', () => {
  it('BUILD_MASSING on a model with the main body only adds the missing garage and leaves the main body untouched', () => {
    const truth = [MAIN, GARAGE]
    const m = modelOf([spec(MAIN)])
    const out = executeCorrections({ model: m, views: [], pictures: pictures(truth), proposals: [propose(m, { operation: 'BUILD_MASSING' })], massing: { outline: outlineOf(truth), silhouettes: silhouettes(truth) } })
    expect(out.records[0].why).toBe('applied, compiled and measured')
    expect(bodiesOf(out.model)).toHaveLength(2)
    expect(out.transactions[0].collateral).toEqual([])
    for (const w of m.walls) expect(out.model.walls.find((q) => q.id === w.id)).toEqual(w)
  })

  it('SET_OUTLINE lengthens a body the model has too short: walls, the rear wall\'s window offset and the roof footprint follow', () => {
    const truth = [MAIN]
    const short = { ...MAIN, maxX: 8.4 }
    const m = modelOf([spec(short)], [{ type: 'cutOpening', id: 'rear-win', wallId: 'ring-mass-main-w2', kind: 'WINDOW', offset: 1.0, sill: 0.9, width: 1.2, height: 1.2 } as BuildingCommand, { type: 'cutOpening', id: 'front-win', wallId: 'ring-mass-main-w0', kind: 'WINDOW', offset: 1.0, sill: 0.9, width: 1.2, height: 1.2 } as BuildingCommand])
    const p = propose(m, { operation: 'SET_OUTLINE', targetId: 'ring-mass-main', frameId: frameOf('FRONT'), patch: { wallLeftX: col('FRONT', 0), wallRightX: col('FRONT', 10) } })
    const out = executeCorrections({ model: m, views: [viewOf('FRONT')], pictures: pictures(truth), proposals: [p] })
    expect(out.records[0].why).toBe('applied, compiled and measured')
    const b = bodiesOf(out.model)[0]
    expect(near(b.rect.maxX, 10, 0.01)).toBe(true)
    expect(out.model.roofs[0].footprint.maxX).toBeCloseTo(10, 3)
    // the front window measured from the unmoved start; the rear one from a start that moved 1.6 m
    expect(out.model.openings.find((o) => o.id === 'front-win')?.offset).toBeCloseTo(1.0, 6)
    expect(out.model.openings.find((o) => o.id === 'rear-win')?.offset).toBeCloseTo(2.6, 6)
  })

  it('counter-trial: the same body lengthened to a tree beside it is not supported by the source', () => {
    const m = modelOf([spec(MAIN)])
    const p = propose(m, { operation: 'SET_OUTLINE', targetId: 'ring-mass-main', frameId: frameOf('FRONT'), patch: { wallLeftX: col('FRONT', 0), wallRightX: col('FRONT', TREE.a1) } })
    const out = executeCorrections({ model: m, views: [viewOf('FRONT')], pictures: pictures([MAIN], true), proposals: [p] })
    expect(out.records[0].status).not.toBe('COMMITTED')
    expect(out.revision).toBe(out.baseRevision)
  })
})

describe('v3.54.17 §8 independence and data quality', () => {
  const truth = [MAIN]
  const pics = pictures(truth)
  const front = silhouettes(truth).find((s) => s.side === 'FRONT') as SilhouetteObservation
  const wrong = (): CanonicalBuildingModel => modelOf([spec({ ...MAIN, maxX: 8.4 }, { kind: 'FLAT', eavesM: 3.2, ridgeAxis: undefined, ridgeM: undefined, pitchDeg: undefined })])

  it('a good SET_ROOF and a bad SET_OUTLINE are settled separately; in one group they roll back together', () => {
    const m = modelOf([spec(MAIN, { kind: 'FLAT', eavesM: 3.2, ridgeAxis: undefined, ridgeM: undefined, pitchDeg: undefined })])
    const roof = propose(m, { operation: 'SET_ROOF', proposalId: 'roof', targetId: 'roof-mass-main', frameId: frameOf('FRONT'), patch: { roofKind: 'GABLE', roofPolygon: front.roofs[0] as Array<[number, number]> } })
    const bad = propose(m, { operation: 'SET_OUTLINE', proposalId: 'bad', targetId: 'ring-mass-main', frameId: frameOf('FRONT'), patch: { wallLeftX: col('FRONT', 0), wallRightX: col('FRONT', 13) } })
    const alone = executeCorrections({ model: m, views: [viewOf('FRONT')], pictures: pics, proposals: [roof, bad] })
    expect(alone.records.find((r) => r.proposalId === 'roof')?.status).toBe('COMMITTED')
    expect(alone.records.find((r) => r.proposalId === 'bad')?.status).not.toBe('COMMITTED')
    const grouped = executeCorrections({ model: m, views: [viewOf('FRONT')], pictures: pics, proposals: [{ ...roof, proposalId: 'roof-g', group: 'g1' }, { ...bad, proposalId: 'bad-g', group: 'g1' }] })
    expect(grouped.records.find((r) => r.proposalId === 'roof-g')?.status).toBe('GROUP_ROLLED_BACK')
    expect(grouped.revision).toBe(grouped.baseRevision)
  })

  it('outline and roof in one group (dependent): both stand, and every id the model had survives', () => {
    const m = wrong()
    const outline = propose(m, { operation: 'SET_OUTLINE', proposalId: 'o', group: 'body', targetId: 'ring-mass-main', frameId: frameOf('FRONT'), patch: { wallLeftX: col('FRONT', 0), wallRightX: col('FRONT', 10) } })
    const roof = propose(m, { operation: 'SET_ROOF', proposalId: 'r', group: 'body', targetId: 'roof-mass-main', frameId: frameOf('FRONT'), patch: { roofKind: 'GABLE', roofPolygon: front.roofs[0] as Array<[number, number]> } })
    const out = executeCorrections({ model: m, views: [viewOf('FRONT')], pictures: pics, proposals: [outline, roof] })
    expect(out.records.map((r) => r.status)).toEqual(['COMMITTED', 'COMMITTED'])
    const ids = (x: CanonicalBuildingModel): string[] => [...x.walls, ...x.roofs, ...x.wallRings, ...x.wallJunctions].map((o) => o.id).sort()
    expect(ids(out.model)).toEqual(ids(m))
  })

  it('a stale baseRevision never closes anything; a hip drawn on the front is named UNSUPPORTED, not guessed', () => {
    const m = wrong()
    const stale = executeCorrections({ model: m, views: [viewOf('FRONT')], pictures: pics, proposals: [propose(m, { operation: 'SET_ROOF', baseRevision: 'deadbeef0000', targetId: 'roof-mass-main', frameId: frameOf('FRONT'), patch: { roofKind: 'GABLE', roofPolygon: front.roofs[0] as Array<[number, number]> } })] })
    expect(stale.records[0].status).toBe('STALE_REVISION')
    const hip: Array<[number, number]> = [[col('FRONT', 0), row(3.2)], [col('FRONT', 8.4), row(3.2)], [col('FRONT', 6), row(6)], [col('FRONT', 2.4), row(6)]]
    const h = executeCorrections({ model: m, views: [viewOf('FRONT')], pictures: pics, proposals: [propose(m, { operation: 'SET_ROOF', targetId: 'roof-mass-main', frameId: frameOf('FRONT'), patch: { roofKind: 'GABLE', roofPolygon: hip } })] })
    expect(h.records[0].code).toBe('HIP_ROOF')
  })
})

describe('v3.54.17 §6 orientation apart from the vertical: elevations labelled on the turned sides', () => {
  it('the turned labels are found by the heights the views agree on; the roof proposal is read under them and executes', async () => {
    const { orientationOf, roofProposalsFromSketches } = await import('../src/consult/massing/ops.js')
    const truth = [MAIN]
    const sk = silhouettes(truth)
    // the source labels each drawing one side further round than the model's sides (its FRONT draws the model's RIGHT)
    const relabel: Record<Side, Side> = { RIGHT: 'FRONT', REAR: 'RIGHT', LEFT: 'REAR', FRONT: 'LEFT' }
    const sketches = sk.map((s) => ({ facade: relabel[s.side], frameId: s.frameId, groundRow: s.groundRow, walls: s.walls, roofs: s.roofs }))
    const m = modelOf([spec(MAIN, { kind: 'FLAT', eavesM: 3.2, ridgeAxis: undefined, ridgeM: undefined, pitchDeg: undefined })])
    const side = (f: string): Side | undefined => (['FRONT', 'RIGHT', 'REAR', 'LEFT'].includes(f) ? (f as Side) : undefined)
    const o = orientationOf(sketches, m, side)
    expect(o.assignment).toBe('TURNED_90')
    // and as labelled correctly, the same drawings agree as labelled
    expect(orientationOf(sk.map((s) => ({ facade: s.side, frameId: s.frameId, groundRow: s.groundRow, walls: s.walls, roofs: s.roofs })), m, side).assignment).toBe('AS_LABELLED')
    const { proposals } = roofProposalsFromSketches(sketches, m, [], modelRevision(m), side)
    expect(proposals).toHaveLength(1)
    const out = executeCorrections({ model: m, views: [], pictures: pictures(truth), proposals })
    expect(out.records[0].status).toBe('COMMITTED')
    expect(out.model.roofs[0]).toMatchObject({ kind: 'GABLE', ridgeAxis: 'X' })
  })
})
