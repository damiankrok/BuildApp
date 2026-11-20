/**
 * v3.54.17 R3 (OWNER, 2026-11-20: "why is the roof not standing past the walls, why are there no chimneys") — the four
 * mechanisms on a controlled house painted here, the independent truth. Tolerances fixed before results.
 *
 * 1. The eaves seen on a side are where the main roof begins, not the tallest wall (a gable-walled storey's gable top).
 * 2. A source elevation is registered from its sketch (wall ends against the plan's side, the ground row drawn behind
 *    whatever stands in front of the house), only when the model's eaves land on the sketch's eaves row.
 * 3. The executor derives such registrations again on the working model, so a stack is placed through them.
 * 4. The roof's overhang is read on the source: verges end by end from an eaves view (the ridge lengthened), the eaves
 *    from a gable view (the roof's overhang); every refusal has its counterpart.
 * 5. One stack seen in two perpendicular views is one stack with both plan coordinates; two stacks of one height on one
 *    slope stay unpaired (named, not chosen).
 */
import { describe, expect, it } from 'vitest'
import { applyCommands } from '@buildapp/commands'
import type { BuildingCommand } from '@buildapp/commands'
import { createEmptyModel } from '@buildapp/model'
import type { CanonicalBuildingModel } from '@buildapp/model'
import { executeCorrections, modelRevision, preferredView, registerFromSketch, sideEavesM } from '../src/consult/correct/execute.js'
import type { BindPicture, BindView, CorrectionProposal, Side } from '../src/consult/correct/execute.js'
import { fuseChimneys } from '../src/consult/correct/chimney-fusion.js'
import { CAPABILITIES, capabilityPrompt, PATCH_OPERATIONS } from '../src/consult/correct/registry.js'
import { bodyCommands } from '../src/consult/massing/massing.js'
import type { BodySpec } from '../src/consult/massing/massing.js'

const MPP = 0.02
const ZERO = 400
const W = 960
const H = 440
// the true house: one gable body 10 × 8 m, eaves 3.2 m, ridge 6.0 m along X; its gable walls rise to the ridge
const HOUSE = { minX: 0, maxX: 10, minZ: 0, maxZ: 8, eaves: 3.2, ridge: 6.0 }
// stacks: one on the front slope, one behind the ridge (seen from the front), tops 7.0 m
const STACKS = [{ x0: 2.0, x1: 2.6, z0: 2.0, z1: 2.6, top: 7.0 }, { x0: 6.5, x1: 7.1, z0: 5.4, z1: 6.0, top: 7.0 }]

const ORIGIN: Record<Side, { a0: number; sign: 1 | -1; axis: 'x' | 'z' }> = {
  FRONT: { a0: -2, sign: 1, axis: 'x' },
  RIGHT: { a0: -2, sign: 1, axis: 'z' },
  REAR: { a0: 12, sign: -1, axis: 'x' },
  LEFT: { a0: 10, sign: -1, axis: 'z' },
}
const col = (s: Side, a: number): number => (ORIGIN[s].sign === 1 ? (a - ORIGIN[s].a0) / MPP : (ORIGIN[s].a0 - a) / MPP)
const row = (y: number): number => ZERO - y / MPP
const span = (s: Side): [number, number] => (ORIGIN[s].axis === 'x' ? [HOUSE.minX, HOUSE.maxX] : [HOUSE.minZ, HOUSE.maxZ])
const eavesView = (s: Side): boolean => ORIGIN[s].axis === 'x'

type Over = { left: number; right: number }
/** The drawn walls and roof of a side (the roof standing `over` past the walls at each end, as seen from outside). */
function drawn(s: Side, over: Over): { walls: Array<[number, number]>; roof: Array<[number, number]> } {
  const [lo, hi] = span(s)
  const c0 = Math.min(col(s, lo), col(s, hi))
  const c1 = Math.max(col(s, lo), col(s, hi))
  const r0 = c0 - over.left / MPP
  const r1 = c1 + over.right / MPP
  const walls: Array<[number, number]> = eavesView(s) ? [[c0, row(0)], [c1, row(0)], [c1, row(HOUSE.eaves)], [c0, row(HOUSE.eaves)]] : [[c0, row(0)], [c1, row(0)], [c1, row(HOUSE.eaves)], [(c0 + c1) / 2, row(HOUSE.ridge)], [c0, row(HOUSE.eaves)]]
  const roof: Array<[number, number]> = eavesView(s) ? [[r0, row(HOUSE.eaves)], [r1, row(HOUSE.eaves)], [r1, row(HOUSE.ridge)], [r0, row(HOUSE.ridge)]] : [[r0, row(HOUSE.eaves)], [r1, row(HOUSE.eaves)], [(c0 + c1) / 2, row(HOUSE.ridge)]]
  return { walls, roof }
}
/** A stack's drawn box on a side (its foot where it meets the roof as seen; the ridge hides a stack behind it). */
function stackBox(s: Side, k: number): { x0: number; y0: number; x1: number; y1: number } {
  const st = STACKS[k]
  const [a0, a1] = ORIGIN[s].axis === 'x' ? [st.x0, st.x1] : [st.z0, st.z1]
  const c0 = Math.min(col(s, a0), col(s, a1))
  const c1 = Math.max(col(s, a0), col(s, a1))
  const tan = (HOUSE.ridge - HOUSE.eaves) / 4
  const footY = eavesView(s) ? (s === 'FRONT' ? (st.z1 <= 4 ? HOUSE.eaves + st.z1 * tan : HOUSE.ridge) : (st.z0 >= 4 ? HOUSE.eaves + (8 - st.z0) * tan : HOUSE.ridge)) : HOUSE.eaves + (4 - Math.abs((st.z0 + st.z1) / 2 - 4)) * tan
  return { x0: c0, x1: c1, y0: row(st.top), y1: row(footY) }
}
function inPoly(poly: Array<[number, number]>, x: number, y: number): boolean {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if (poly[i][1] > y !== poly[j][1] > y && x < ((poly[j][0] - poly[i][0]) * (y - poly[i][1])) / (poly[j][1] - poly[i][1]) + poly[i][0]) c = !c
  return c
}
/** The painted elevation: sky, ground, pots and bins hiding the foot of the walls, render, a striped roof, dark stacks. */
function paint(s: Side, over: Over): BindPicture['raster'] {
  const data = new Uint8ClampedArray(W * H * 4)
  let seed = 7 + s.length
  const rnd = (): number => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  const d = drawn(s, over)
  const boxes = STACKS.map((_, k) => stackBox(s, k))
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const n = Math.round((rnd() - 0.5) * 18)
    let c: [number, number, number] = y > ZERO ? [120 + n, 150 + n, 100 + n] : [225, 235, 245]
    if (inPoly(d.walls, x, y)) c = [228 + n, 218 + n, 198 + n]
    if (inPoly(d.roof, x, y)) c = [92 + n, 92 + n, 98 + n + (x % 9 < 2 ? 25 : 0)]
    for (const b of boxes) if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) c = [40 + n, 38 + n, 36 + n]
    // pots and bins in front of the house: they hide the drawn ground under the walls (what fails the analyzer's own check)
    if (y > ZERO - 30 && y <= ZERO + 6 && (x % 140) < 50) c = [60 + n, 90 + n, 50 + n]
    data.set([c[0], c[1], c[2], 255], (y * W + x) * 4)
  }
  return { width: W, height: H, data }
}
const frameOf = (s: Side): string => `frame-${s.toLowerCase()}`
const sha = (s: Side): string => (s.charCodeAt(0).toString(16) + 'e').repeat(32).slice(0, 64)
const SIDES: Side[] = ['FRONT', 'RIGHT', 'REAR', 'LEFT']
function pictures(over: Partial<Record<Side, Over>> = {}): BindPicture[] {
  return SIDES.map((s, i) => ({ n: i + 1, frameId: frameOf(s), projection: 'ORTHOGRAPHIC_ELEVATION', transform: { x0: 0, y0: 0, scale: 1 }, raster: paint(s, over[s] ?? { left: 0, right: 0 }), sourceByteHash: sha(s) }))
}
/** The analyzer's own registration: placed, but its vertical failed its check (the pots hide the drawn ground). */
const analyzerView = (s: Side, heights = false): BindView => ({ side: s, frameId: frameOf(s), projection: { mpp: MPP * 0.77, alongAtPx0: ORIGIN[s].a0, alongSign: ORIGIN[s].sign, zeroRow: ZERO }, heights, origin: 'ANALYZER', alongErrorM: 0.04, heightErrorM: 0.5 })
const anchors = (s: Side, over: Over = { left: 0, right: 0 }, eavesM = HOUSE.eaves) => {
  const d = drawn(s, over)
  return { frameId: frameOf(s), side: s, wallLeftX: Math.min(...d.walls.map((q) => q[0])), wallRightX: Math.max(...d.walls.map((q) => q[0])), groundY: ZERO, eavesY: row(eavesM) }
}
const empty = (): CanonicalBuildingModel => createEmptyModel('m-r3', 'controlled')
const spec: BodySpec = { id: 'mass-main', rect: { minX: HOUSE.minX, maxX: HOUSE.maxX, minZ: HOUSE.minZ, maxZ: HOUSE.maxZ }, roof: { kind: 'GABLE', ridgeAxis: 'X', pitchDeg: Math.round((Math.atan2(HOUSE.ridge - HOUSE.eaves, 4) * 1800) / Math.PI) / 10, eavesM: HOUSE.eaves, ridgeM: HOUSE.ridge }, provenance: {} }
function house(): CanonicalBuildingModel {
  const r = applyCommands(empty(), [{ type: 'createBuilding', id: 'building' }, { type: 'createLevel', id: 'lvl-0', index: 0, elevation: 0, height: 6 }, ...bodyCommands(spec, 'lvl-0', 0, [], 0.3)] as BuildingCommand[])
  if (r.failedAt !== undefined) throw new Error(JSON.stringify(r.results[r.failedAt]).slice(0, 300))
  return r.model
}
const propose = (m: CanonicalBuildingModel, p: Partial<CorrectionProposal> & { operation: string }): CorrectionProposal => ({ proposalId: p.proposalId ?? `p-${p.operation}-${String(p.frameId ?? '')}`, baseRevision: modelRevision(m), targetId: p.targetId ?? 'WHOLE', origin: 'CONTROL', uncertainty: 'LOW', ...p }) as CorrectionProposal
const roofId = (m: CanonicalBuildingModel): string => m.roofs[0].id

describe('v3.54.17 R3 — the eaves of a side are where the main roof begins', () => {
  it('on a gable-walled storey: 3.2 m (the roof), not the gable walls\' 6.0 m top', () => {
    const m = house()
    expect(Math.max(...m.walls.filter((w) => w.kind === 'EXTERIOR').map((w) => w.height))).toBeGreaterThan(5.5)
    for (const s of SIDES) expect(sideEavesM(m, s)).toBeCloseTo(HOUSE.eaves, 6)
  })
})

describe('v3.54.17 R3 — a source elevation registered from its sketch, checked by the eaves', () => {
  const m = house()
  const pics = pictures()
  it('the sketch\'s wall ends and ground row register every side at the drawing\'s scale, heights from the ground', () => {
    for (const s of SIDES) {
      const r = registerFromSketch({ model: m, views: [analyzerView(s)], pictures: pics, witnesses: [] }, anchors(s))
      expect('view' in r, JSON.stringify(r)).toBe(true)
      if ('view' in r) {
        expect(r.view.origin).toBe('SKETCH')
        expect(r.view.heights).toBe(true)
        expect(r.view.projection.mpp).toBeCloseTo(MPP, 4)
        expect(r.view.projection.zeroRow).toBe(ZERO)
      }
    }
  })
  it('counter-trial: a sketch whose eaves row is not the model\'s (another storey) is refused as the other axis', () => {
    const r = registerFromSketch({ model: m, views: [], pictures: pics, witnesses: [] }, anchors('FRONT', { left: 0, right: 0 }, 5.6))
    expect('status' in r && r.code).toBe('AXIS_MISMATCH')
  })
  it('counter-trial: the gable drawing registered as the eaves side (wrong width) is refused', () => {
    // the RIGHT drawing's wall ends (8 m) named as the FRONT (10 m): at the scale that gives, the eaves miss
    const a = { ...anchors('RIGHT'), frameId: frameOf('RIGHT'), side: 'FRONT' as Side }
    const r = registerFromSketch({ model: m, views: [], pictures: pics, witnesses: [] }, a)
    expect('status' in r).toBe(true)
  })
  it('an overhang hiding the walls\' top: the eaves row misses, the ridge lands on the drawn roof\'s top — registered by the ridge', () => {
    // the drawn walls stop 0.6 m below the model's eaves (soffit and fascia in front of them), the roof's top is the ridge
    const a = { ...anchors('FRONT', { left: 0, right: 0 }, HOUSE.eaves - 0.6), ridgeY: row(HOUSE.ridge) }
    const r = registerFromSketch({ model: m, views: [], pictures: pics, witnesses: [] }, a)
    expect('view' in r, JSON.stringify(r)).toBe(true)
    if ('view' in r) expect(r.why).toContain('ridge')
    // counter-trial: the ridge misses too (a drawing of another house or another scale) — refused
    const wrong = registerFromSketch({ model: m, views: [], pictures: pics, witnesses: [] }, { ...a, ridgeY: row(HOUSE.ridge + 1.2) })
    expect('status' in wrong && wrong.code).toBe('AXIS_MISMATCH')
  })
  it('the analyzer\'s registration outranks the sketch\'s only when its own vertical check passed', () => {
    const sk = registerFromSketch({ model: m, views: [], pictures: pics, witnesses: [] }, anchors('FRONT'))
    if (!('view' in sk)) throw new Error('not registered')
    expect(preferredView([analyzerView('FRONT', false), sk.view], frameOf('FRONT'))?.origin).toBe('SKETCH')
    expect(preferredView([analyzerView('FRONT', true), sk.view], frameOf('FRONT'))?.origin).toBe('ANALYZER')
  })
})

describe('v3.54.17 R3 — stacks are placed through the registration the executor derives on the working model', () => {
  it('through the analyzer\'s view without heights: VIEW_WITHOUT_HEIGHTS; with the derived sketch view: committed at the drawn top', () => {
    const m = house()
    const pics = pictures()
    const p = propose(m, { operation: 'ADD_CHIMNEY', targetId: 'FRONT', frameId: frameOf('FRONT'), patch: { box: stackBox('FRONT', 0) } })
    const before = executeCorrections({ model: m, views: [analyzerView('FRONT')], pictures: pics, proposals: [p] })
    expect(before.records[0].code).toBe('VIEW_WITHOUT_HEIGHTS')
    const derived = (model: CanonicalBuildingModel, held: readonly BindView[]): BindView[] => SIDES.flatMap((s) => { const r = registerFromSketch({ model, views: [...held], pictures: pics, witnesses: [] }, anchors(s)); return 'view' in r ? [r.view] : [] })
    const after = executeCorrections({ model: m, views: [analyzerView('FRONT')], pictures: pics, proposals: [{ ...p, proposalId: 'again' }], derivedViews: derived })
    expect(after.records[0].status, after.records[0].why).toBe('COMMITTED')
    const c = after.model.chimneys[0]
    const base = after.model.levels.find((l) => l.id === c.levelId)?.elevation ?? 0
    expect(Math.abs(base + c.baseOffset + c.height - STACKS[0].top)).toBeLessThanOrEqual(0.1)
  })
})

describe('v3.54.17 R3 — the roof\'s overhang read on the source (SET_ROOF_OVERHANG)', () => {
  it('is in the registry with a consumer, a measure and a prompt line', () => {
    expect(PATCH_OPERATIONS).toContain('SET_ROOF_OVERHANG')
    expect(CAPABILITIES.SET_ROOF_OVERHANG.params).toEqual(expect.arrayContaining(['roofLeftX', 'roofRightX', 'wallLeftX', 'wallRightX']))
    expect(capabilityPrompt()).toContain('- SET_ROOF_OVERHANG —')
  })
  const run = (m: CanonicalBuildingModel, s: Side, over: Over, patchOver: Partial<{ roofLeftX: number; roofRightX: number; wallLeftX: number; wallRightX: number }> = {}) => {
    const pics = pictures({ [s]: over })
    const d = drawn(s, over)
    const sk = registerFromSketch({ model: m, views: [], pictures: pics, witnesses: [] }, anchors(s, over))
    if (!('view' in sk)) throw new Error(JSON.stringify(sk))
    const patch = { roofLeftX: Math.min(...d.roof.map((q) => q[0])), roofRightX: Math.max(...d.roof.map((q) => q[0])), wallLeftX: Math.min(...d.walls.map((q) => q[0])), wallRightX: Math.max(...d.walls.map((q) => q[0])), ...patchOver }
    return executeCorrections({ model: m, views: [sk.view], pictures: pics, proposals: [propose(m, { proposalId: `oh-${s}`, operation: 'SET_ROOF_OVERHANG', targetId: roofId(m), frameId: frameOf(s), patch })] })
  }
  it('an eaves view gives the verges end by end: the ridge lengthened 0.6 m at the left end and 0.4 m at the right', () => {
    const m = house()
    const out = run(m, 'FRONT', { left: 0.6, right: 0.4 })
    expect(out.records[0].status, out.records[0].why).toBe('COMMITTED')
    const f = out.model.roofs[0].footprint
    expect(f.minX).toBeCloseTo(-0.6, 2)
    expect(f.maxX).toBeCloseTo(10.4, 2)
    expect([f.minZ, f.maxZ]).toEqual([0, 8])
    // the rear sees the same verges mirrored: nothing more to change
    const again = run(out.model, 'REAR', { left: 0.4, right: 0.6 })
    expect(again.records[0].status).toBe('NO_EFFECT')
  })
  it('a gable view gives the eaves overhang (one value for the roof)', () => {
    const m = house()
    const out = run(m, 'RIGHT', { left: 0.5, right: 0.5 })
    expect(out.records[0].status, out.records[0].why).toBe('COMMITTED')
    expect(out.model.roofs[0].overhang).toBeCloseTo(0.5, 2)
  })
  it('counter-trials: narrower than the walls, more than 1 m, two different eaves, walls that are not the side\'s', () => {
    const m = house()
    expect(run(m, 'FRONT', { left: -0.4, right: -0.4 }).records[0].code).toBe('ROOF_NARROWER_THAN_WALLS')
    expect(run(m, 'FRONT', { left: 1.4, right: 0.3 }).records[0].code).toBe('IMPLAUSIBLE_OVERHANG')
    expect(run(m, 'RIGHT', { left: 0.1, right: 0.7 }).records[0].code).toBe('ASYMMETRIC_OVERHANG')
    const d = drawn('FRONT', { left: 0.5, right: 0.5 })
    expect(run(m, 'FRONT', { left: 0.5, right: 0.5 }, { wallLeftX: Math.min(...d.walls.map((q) => q[0])) + 1 / MPP }).records[0].code).toBe('WALLS_NOT_THE_SIDE')
  })
})

describe('v3.54.17 R3 — one stack seen in two perpendicular views is one stack', () => {
  const m = house()
  const pics = pictures()
  const view = (s: Side): BindView => {
    const r = registerFromSketch({ model: m, views: [], pictures: pics, witnesses: [] }, anchors(s))
    if (!('view' in r)) throw new Error('not registered')
    return r.view
  }
  const stack = (s: Side, k: number) => ({ proposalId: `sk:${s}:chimney:${k}`, frameId: frameOf(s), side: s, view: view(s), box: stackBox(s, k), roofTopRow: row(HOUSE.ridge) })
  const prop = (s: Side, k: number): CorrectionProposal => propose(m, { proposalId: `sk:${s}:chimney:${k}`, operation: 'ADD_CHIMNEY', targetId: s, frameId: frameOf(s), patch: { box: stackBox(s, k) } })
  it('front (eaves view) and right (gable view) pair by top and slope: each proposal takes the other view as its depth; two stacks built', () => {
    const stacks = [stack('FRONT', 0), stack('FRONT', 1), stack('RIGHT', 0), stack('RIGHT', 1)]
    const f = fuseChimneys(m, stacks, stacks.map((x) => prop(x.side, Number(x.proposalId.slice(-1)))), pics)
    expect(f.record.fused.length).toBe(2)
    expect(f.record.fused.map((x) => x.why).join(' ')).toContain('behind the ridge')
    const derived = (model: CanonicalBuildingModel, held: readonly BindView[]): BindView[] => SIDES.flatMap((s) => { const r = registerFromSketch({ model, views: [...held], pictures: pics, witnesses: [] }, anchors(s)); return 'view' in r ? [r.view] : [] })
    const out = executeCorrections({ model: m, views: [], pictures: pics, proposals: f.proposals, derivedViews: derived })
    expect(out.model.chimneys.length, JSON.stringify(out.records.map((r) => [r.proposalId, r.status, r.code]))).toBe(2)
    for (const st of STACKS) {
      const c = out.model.chimneys.find((x) => Math.abs((x.footprint.minX + x.footprint.maxX) / 2 - (st.x0 + st.x1) / 2) < 0.2)
      expect(c, JSON.stringify(out.model.chimneys.map((x) => x.footprint))).toBeDefined()
      if (c) expect(Math.abs((c.footprint.minZ + c.footprint.maxZ) / 2 - (st.z0 + st.z1) / 2)).toBeLessThanOrEqual(0.3)
    }
  })
  it('counter-trial: two stacks of one height on one slope in the gable view are not paired (named, left single-view)', () => {
    // the right view's second stack moved onto the front slope beside the first: which is which is not told
    const twin = { ...stack('RIGHT', 0), proposalId: 'sk:RIGHT:chimney:twin', box: { ...stackBox('RIGHT', 0), x0: stackBox('RIGHT', 0).x0 + 25, x1: stackBox('RIGHT', 0).x1 + 25 } }
    const stacks = [stack('FRONT', 0), stack('RIGHT', 0), twin]
    const f = fuseChimneys(m, stacks, [prop('FRONT', 0), prop('RIGHT', 0)], pics)
    expect(f.record.fused.length).toBe(0)
    expect(f.record.left[0].why).toContain('two stacks of one height')
  })
})
