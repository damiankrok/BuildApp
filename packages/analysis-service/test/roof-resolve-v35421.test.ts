/**
 * v3.54.21 — a correction of ONE roof of a roof system solves the WHOLE system again (ops 1.13.0).
 *
 * A control drawn here from invented dimensions (2 cm a pixel, the ground at row 400): a 12 × 8 m house, ridge along X,
 * with a 4 m wide wing on its front whose ridge runs into the main slope. The model holds the wing's ridge at 4.6 m; the
 * right elevation is painted with the wing's roof up to 5.2 m. Nothing names a house.
 */
import { describe, expect, it } from 'vitest'
import { applyCommands } from '@buildapp/commands'
import { compileBuilding } from '@buildapp/geometry'
import { createEmptyModel, validateModel } from '@buildapp/model'
import type { CanonicalBuildingModel } from '@buildapp/model'
import { executeCorrections, modelRevision } from '../src/consult/correct/execute.js'
import type { BindPicture, BindView, CorrectionProposal } from '../src/consult/correct/execute.js'
import { bodiesOf, massingCommands, roofRegionsOfModel } from '../src/consult/massing/massing.js'
import type { MassingHypothesis, RoofSpec } from '../src/consult/massing/massing.js'
import { readbackStructure } from '../src/consult/readback.js'

type Poly = Array<[number, number]>
const MPP = 0.02
const ZERO = 400
const W = 1000
const H = 440
// the RIGHT side: along z, from z = −7 at column 0
const A0 = -7
const col = (z: number): number => (z - A0) / MPP
const row = (y: number): number => ZERO - y / MPP

const body = (id: string, rect: MassingHypothesis['bodies'][number]['rect'], roof: RoofSpec): MassingHypothesis['bodies'][number] => ({ id, rect, roof, provenance: {} })
const hyp = (bodies: MassingHypothesis['bodies']): MassingHypothesis => ({ version: 't', status: 'BUILDABLE', bodies, views: [], alternatives: [], missing: [], views_used: [], wallThicknessM: 0.3, why: 'control' } as unknown as MassingHypothesis)
const MAIN = body('mass-main', { minX: 0, maxX: 12, minZ: 0, maxZ: 8 }, { kind: 'GABLE', ridgeAxis: 'X', pitchDeg: 31, eavesM: 3.4, ridgeM: 5.8 })
const WING = body('mass-wing-1', { minX: 4, maxX: 8, minZ: -5, maxZ: 0 }, { kind: 'GABLE', ridgeAxis: 'Z', pitchDeg: 31, eavesM: 3.4, ridgeM: 4.6 })
function modelOf(bodies: MassingHypothesis['bodies']): CanonicalBuildingModel {
  const r = applyCommands(createEmptyModel('m', 'control'), massingCommands(hyp(bodies), createEmptyModel('m', 'control')))
  if (r.failedAt !== undefined) throw new Error(JSON.stringify(r.results[r.failedAt]).slice(0, 400))
  return r.model
}

/** What the right elevation draws: the main gable end over z 0…8, the wing's walls and its slope as a band over z −5…0 up to `wingRidge`. */
function drawnRight(wingRidge: number): { walls: Poly[]; roofs: Poly[]; wing: Poly } {
  const wing: Poly = [[col(-5), row(3.1)], [col(0), row(3.1)], [col(0), row(wingRidge)], [col(-5), row(wingRidge)]]
  return {
    walls: [[[col(0), row(0)], [col(8), row(0)], [col(8), row(3.1)], [col(0), row(3.1)]], [[col(-5), row(0)], [col(0), row(0)], [col(0), row(3.1)], [col(-5), row(3.1)]]],
    roofs: [[[col(0), row(3.1)], [col(8), row(3.1)], [col(8), row(3.4)], [col(4), row(5.8)], [col(0), row(3.4)]], wing],
    wing,
  }
}
function inPoly(poly: Poly, x: number, y: number): boolean {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if (poly[i][1] > y !== poly[j][1] > y && x < ((poly[j][0] - poly[i][0]) * (y - poly[i][1])) / (poly[j][1] - poly[i][1]) + poly[i][0]) c = !c
  return c
}
function paint(wingRidge: number): BindPicture['raster'] {
  const data = new Uint8ClampedArray(W * H * 4)
  let seed = 11
  const rnd = (): number => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  const d = drawnRight(wingRidge)
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const n = Math.round((rnd() - 0.5) * 18)
    let c: [number, number, number] = y > ZERO ? [120 + n, 150 + n, 100 + n] : [225, 235, 245]
    if (d.walls.some((q) => inPoly(q, x, y))) c = [228 + n, 218 + n, 198 + n]
    if (d.roofs.some((q) => inPoly(q, x, y))) c = [92 + n, 92 + n, 98 + n + (x % 9 < 2 ? 25 : 0)]
    data.set([c[0], c[1], c[2], 255], (y * W + x) * 4)
  }
  return { width: W, height: H, data }
}
const FRAME = 'frame-right'
const picture = (wingRidge: number): BindPicture => ({ n: 1, frameId: FRAME, projection: 'ORTHOGRAPHIC_ELEVATION', transform: { x0: 0, y0: 0, scale: 1 }, raster: paint(wingRidge), sourceByteHash: 'ab'.repeat(32) })
const VIEW: BindView = { side: 'RIGHT', frameId: FRAME, projection: { mpp: MPP, alongAtPx0: A0, alongSign: 1, zeroRow: ZERO }, heights: true, origin: 'ANALYZER', alongErrorM: 0.04, heightErrorM: 0.06 }
const propose = (m: CanonicalBuildingModel, p: Partial<CorrectionProposal> & { operation: string }): CorrectionProposal => ({ proposalId: 'p-1', baseRevision: modelRevision(m), targetId: 'WHOLE', origin: 'CONTROL', uncertainty: 'LOW', ...p } as CorrectionProposal)
/** the reviewer names a roof of the system by one of its planes (an id of the element index) */
const wingPlane = (m: CanonicalBuildingModel): string => (m.roofPlanes.find((p) => p.id.startsWith('roof-mass-wing-1-')) as { id: string }).id
const valleys = (m: CanonicalBuildingModel) => m.roofEdges.filter((e) => e.kind === 'VALLEY')

describe('ops 1.13.0: a correction of one roof of a roof system solves the whole system again', () => {
  it('the regions of a model are measured back from its planes and proved by solving them again', () => {
    const m = modelOf([MAIN, WING])
    const rec = roofRegionsOfModel(m)
    if ('why' in rec) throw new Error(rec.why)
    expect(rec.regions.map((r) => [r.id, r.kind, r.ridgeAxis, Math.round(r.eaveY * 1e4) / 1e4, Math.round(r.ridgeY * 1e4) / 1e4])).toEqual([['roof-mass-main', 'GABLE', 'X', 3.4, 5.8], ['roof-mass-wing-1', 'GABLE', 'Z', 3.4, 4.6]])
    // a wing plane that runs on over the main slope is the wing's, by its name
    const wing = bodiesOf(m).find((b) => b.id === 'ring-mass-wing-1')
    expect(wing?.planeIds.every((id) => id.startsWith('roof-mass-wing-1-'))).toBe(true)
    expect(wing?.planeIds.length).toBe(m.roofPlanes.filter((p) => p.id.startsWith('roof-mass-wing-1-')).length)
  })
  it('the wing drawn higher than the model holds it: the wing is raised, the valleys are computed again, nothing else is lost', () => {
    const m = modelOf([MAIN, WING])
    expect(valleys(m).map((v) => Math.round(Math.max(v.start.y, v.end.y) * 1e4) / 1e4)).toEqual([4.6, 4.6])
    const d = drawnRight(5.2)
    const out = executeCorrections({ model: m, views: [VIEW], pictures: [picture(5.2)], proposals: [propose(m, { operation: 'SET_ROOF', targetId: wingPlane(m), frameId: FRAME, patch: { roofKind: 'GABLE', roofPolygon: d.wing, wallTopY: row(3.1) } })] })
    expect(out.records[0].status, JSON.stringify(out.records[0]).slice(0, 600)).toBe('COMMITTED')
    const rec = roofRegionsOfModel(out.model)
    if ('why' in rec) throw new Error(rec.why)
    const wing = rec.solution.regions.find((r) => r.id === 'roof-mass-wing-1')
    expect(wing?.ridgeY).toBeCloseTo(5.2, 1)
    expect(wing?.ridgeAxis).toBe('Z')
    // the valleys end where the wing's new ridge meets the main slope — both planes at one height there
    expect(valleys(out.model)).toHaveLength(2)
    for (const v of valleys(out.model)) expect(Math.max(v.start.y, v.end.y)).toBeCloseTo(wing?.ridgeY as number, 2)
    expect(out.model.assemblies.filter((a) => a.kind === 'ROOF')).toHaveLength(1)
    expect(out.model.walls.map((w) => w.id).sort()).toEqual(m.walls.map((w) => w.id).sort())
    expect(out.model.roofs).toHaveLength(0)
    expect(validateModel(out.model).ok).toBe(true)
    expect(compileBuilding(out.model).diagnostics.filter((x) => (x as { severity?: string }).severity === 'ERROR')).toEqual([])
    const rb = readbackStructure(out.model, undefined, { twoMinM: 4.6, oneMaxM: 4.2 })
    expect(rb.joins.filter((j) => j.kind === 'VALLEY')).toHaveLength(2)
  })
  it('counter-trial: the same proposal where the picture draws the wing as the model holds it changes nothing (the source decides)', () => {
    const m = modelOf([MAIN, WING])
    const out = executeCorrections({ model: m, views: [VIEW], pictures: [picture(4.6)], proposals: [propose(m, { operation: 'SET_ROOF', targetId: wingPlane(m), frameId: FRAME, patch: { roofKind: 'GABLE', roofPolygon: drawnRight(5.2).wing, wallTopY: row(3.1) } })] })
    // (the gate's own answer: the picture supports the model, or does not decide — never the proposal)
    expect(['SOURCE_SUPPORTS_MODEL', 'SOURCE_UNDECIDED']).toContain(out.records[0].code)
    expect(modelRevision(out.model)).toBe(modelRevision(m))
  })
  it('counter-trial: a wing proposed above the main ridge is not forced into the system (the solver names it, nothing is built)', () => {
    const m = modelOf([MAIN, WING])
    const tall = drawnRight(6.6)
    const out = executeCorrections({ model: m, views: [VIEW], pictures: [picture(6.6)], proposals: [propose(m, { operation: 'SET_ROOF', targetId: wingPlane(m), frameId: FRAME, patch: { roofKind: 'GABLE', roofPolygon: tall.wing, wallTopY: row(3.1) } })] })
    expect(out.records[0].status).not.toBe('COMMITTED')
    expect(modelRevision(out.model)).toBe(modelRevision(m))
    expect(out.records[0].code, JSON.stringify(out.records[0]).slice(0, 500)).toBe('ROOF_SYSTEM_MEMBERSHIP_CHANGES')
  })
})

describe('ops 1.13.0: the kernel is asked before the roof system is proposed', () => {
  it('massingCommands with { apart } states every roof alone, exactly as a body builder without the system would', () => {
    const empty = createEmptyModel('m', 'control')
    const apart = massingCommands(hyp([MAIN, WING]), empty, { apart: true })
    expect(apart.filter((c) => c.type === 'createRoofPlane')).toHaveLength(0)
    expect(apart.filter((c) => c.type === 'createRoof')).toHaveLength(2)
    expect(apart.some((c) => c.type === 'createAssembly')).toBe(false)
    const r = applyCommands(empty, apart)
    expect(r.failedAt).toBeUndefined()
    expect(validateModel(r.model).ok).toBe(true)
  })
})
