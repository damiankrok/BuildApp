/**
 * v3.54.21 — the roof system on the body built from a read: one geometry of roofs, the description bound to the body its
 * own views draw, parameters agreed again after the last change, and a description executed whole or not at all. Every
 * case is a control drawn here from invented dimensions (40 px a metre, the ground at row 400); nothing names a house.
 */
import { describe, expect, it } from 'vitest'
import { applyCommands } from '@buildapp/commands'
import { compileBuilding } from '@buildapp/geometry'
import { createEmptyModel } from '@buildapp/model'
import { gableWallOver, massingCommands, roofSystemOf, settleRoof, solveMassing } from '../src/consult/massing/massing.js'
import { massingHypothesisOf } from '../src/consult/massing/ops.js'
import type { MassingHypothesis, OutlineObservation, RoofSpec, SilhouetteObservation } from '../src/consult/massing/massing.js'
import type { BuildStructure } from '../src/consult/structure.js'
import type { Poly } from '../src/consult/correct/source-gate.js'
import { readbackOpenings, readbackStructure } from '../src/consult/readback.js'

const px = (m: number): number => 20 + 40 * m
const row = (m: number): number => 400 - 40 * m
const box = (a: number, b: number, y0: number, y1: number): Poly => [[px(a), row(y0)], [px(b), row(y0)], [px(b), row(y1)], [px(a), row(y1)]]
const outlineOf = (pts: Array<[number, number]>): OutlineObservation => ({ observationId: 'o', frameId: 'plan', sourceByteHash: 'h', outline: pts.map(([x, z]) => ({ x, z })), by: 'CONTROL', fidelity: 'SOURCE_TRACED', why: 'control' })
const view = (side: SilhouetteObservation['side'], walls: Poly[], roofs: Poly[]): SilhouetteObservation => ({ observationId: side, side, frameId: side.toLowerCase(), sourceByteHash: 'h', groundRow: 400, walls, roofs })
const build = (h: MassingHypothesis) => {
  const cmds = massingCommands(h, createEmptyModel('m', 'control'))
  const r = applyCommands(createEmptyModel('m', 'control'), cmds)
  return { cmds, model: r.model, failedAt: r.failedAt, failure: r.failedAt !== undefined ? JSON.stringify(r.results[r.failedAt]).slice(0, 300) : undefined }
}

/** A 12 × 8 m house, eaves 3 m, ridge 7 m along X (45°): slopes on the front and rear, gable ends left and right. */
const HOUSE = outlineOf([[0, 0], [12, 0], [12, 8], [0, 8]])
const slope = (side: 'FRONT' | 'REAR', extraWalls: Poly[] = []): SilhouetteObservation => view(side, [box(0, 12, 0, 3), ...extraWalls], [box(0, 12, 3, 7)])
const gableEnd = (side: 'LEFT' | 'RIGHT'): SilhouetteObservation => view(side, [[[px(0), 400], [px(8), 400], [px(8), row(3)], [px(4), row(7)], [px(0), row(3)]]], [[[px(0), row(3)], [px(4), row(7.2)], [px(8), row(3)], [px(8), row(2.8)], [px(4), row(7)], [px(0), row(2.8)]]])
/** A gable wall drawn on the front over 4…8 m of the house: shoulders at 3 m, apex at 5 m (45° over half of 4 m). */
const CROSS_WALL: Poly = [[px(4), 400], [px(8), 400], [px(8), row(3)], [px(6), row(5)], [px(4), row(3)]]
const MAIN_X: BuildStructure = { fullStoreys: 1, mainRoof: 'GABLE', mainRidge: 'X', parts: [] }
const WITH_WING: BuildStructure = { ...MAIN_X, parts: [{ what: 'WING', where: 'FRONT', fullStoreys: 1, roof: 'GABLE', ridge: 'Z' }] }

describe('a cross gable with no step of the outline (the read says THAT, the drawing says WHERE)', () => {
  const silhouettes = [slope('FRONT', [CROSS_WALL]), slope('REAR'), gableEnd('LEFT'), gableEnd('RIGHT')]
  it('reads the gable wall drawn over a part of the stretch — and not a wall that spans the whole of it', () => {
    const reg = solveMassing({ outline: HOUSE, silhouettes }).views.find((v) => v.side === 'FRONT')
    expect(reg).toBeDefined()
    if (!reg) return
    const g = gableWallOver(reg, { lo: 0, hi: 12 }, [box(0, 12, 0, 3), CROSS_WALL], 400)
    expect(g?.lo).toBeCloseTo(4, 1)
    expect(g?.hi).toBeCloseTo(8, 1)
    expect(g?.shoulderM).toBeCloseTo(3, 1)
    expect(g?.apexM).toBeCloseTo(5, 1)
    expect(gableWallOver(reg, { lo: 0, hi: 12 }, [box(0, 12, 0, 3)], 400)).toBeUndefined()
    // the body's own gable end is not a second ridge
    expect(gableWallOver(reg, { lo: 4, hi: 8 }, [CROSS_WALL], 400)).toBeUndefined()
  })
  it('is built as a roof region of its own on the main body\'s walls: two planes, two valleys, the outline untouched', () => {
    const h = solveMassing({ outline: HOUSE, silhouettes, structure: WITH_WING })
    expect(h.status).toBe('BUILDABLE')
    expect(h.bodies).toHaveLength(1)
    expect(h.bodies[0].roof).toMatchObject({ kind: 'GABLE', ridgeAxis: 'X' })
    expect(h.crossRoofs).toHaveLength(1)
    const c = h.crossRoofs?.[0]
    expect(c).toMatchObject({ id: 'roof-mass-main-cross-front', over: 'mass-main', side: 'FRONT', ridgeAxis: 'Z' })
    expect(c?.rect.minX).toBeCloseTo(4, 1)
    expect(c?.rect.maxX).toBeCloseTo(8, 1)
    expect(c?.rect.maxZ).toBeCloseTo(4, 6)
    expect(c?.pitchDeg).toBeGreaterThan(43)
    expect(c?.pitchDeg).toBeLessThan(47)
    expect(h.bodies[0].fates?.some((f) => f.property === 'part' && f.fate === 'APPLIED')).toBe(true)
    const sol = roofSystemOf(h)
    expect(sol.relations).toHaveLength(1)
    expect(sol.relations[0].kind).toBe('CROSS_GABLE')
    expect(sol.creases.filter((q) => q.kind === 'VALLEY')).toHaveLength(2)
    const b = build(h)
    expect(b.failure).toBeUndefined()
    expect(b.model.wallRings).toHaveLength(1)
    expect(b.model.roofs).toHaveLength(0)
    expect(b.model.roofPlanes.map((p) => p.id).sort()).toEqual(['roof-mass-main-cross-front-maxX', 'roof-mass-main-cross-front-minX', 'roof-mass-main-maxZ', 'roof-mass-main-minZ'])
    expect(b.model.roofEdges.filter((e) => e.kind === 'VALLEY')).toHaveLength(2)
    expect(b.model.assemblies.find((a) => a.kind === 'ROOF')).toMatchObject({ classification: 'INTERSECTING' })
    // the front wall follows the cross gable's planes too (it rises into its gable); the rear wall only the main slope
    const front = b.model.walls.find((w) => w.id === 'ring-mass-main-w0')
    expect(front?.topProfile).toMatchObject({ kind: 'FOLLOW_ROOF_PLANES' })
    expect((front?.topProfile as { planeIds: string[] }).planeIds).toEqual(expect.arrayContaining(['roof-mass-main-cross-front-minX', 'roof-mass-main-cross-front-maxX', 'roof-mass-main-minZ']))
    const rear = b.model.walls.find((w) => w.id === 'ring-mass-main-w2')
    expect((rear?.topProfile as { planeIds: string[] }).planeIds).toEqual(['roof-mass-main-maxZ'])
    expect(() => compileBuilding(b.model)).not.toThrow()
  })
  it('counter-trial: without the read naming a part, a drawn gable wall alone builds no second ridge (one witness is not two)', () => {
    const h = solveMassing({ outline: HOUSE, silhouettes, structure: MAIN_X })
    expect(h.crossRoofs).toBeUndefined()
    const b = build(h)
    expect(b.model.roofs).toHaveLength(1)
    expect(b.model.roofPlanes).toHaveLength(0)
  })
})

describe('a description is executed whole or not at all', () => {
  // the drawings: one gable along Z (a gable wall on the whole front and rear, slopes on the sides)
  const frontGable = (side: 'FRONT' | 'REAR'): SilhouetteObservation => view(side, [[[px(0), 400], [px(12), 400], [px(12), row(3)], [px(6), row(9)], [px(0), row(3)]]], [[[px(0), row(3)], [px(6), row(9.2)], [px(12), row(3)], [px(12), row(2.8)], [px(6), row(9)], [px(0), row(2.8)]]])
  const sideSlope = (side: 'LEFT' | 'RIGHT'): SilhouetteObservation => view(side, [box(0, 8, 0, 3)], [box(0, 8, 3, 9)])
  const silhouettes = [frontGable('FRONT'), frontGable('REAR'), sideSlope('LEFT'), sideSlope('RIGHT')]
  it('the main ridge is not turned for a cross wing that cannot be built: the gable the drawings show stands, by name', () => {
    const h = solveMassing({ outline: HOUSE, silhouettes, structure: WITH_WING })
    expect(h.bodies[0].roof.ridgeAxis).toBe('Z')
    expect(h.crossRoofs).toBeUndefined()
    expect(h.bodies[0].fates?.find((f) => f.property === 'mainRidge')).toMatchObject({ fate: 'RETAINED_WITH_CONFLICT', taken: 'along X', built: 'along Z' })
    expect(h.bodies[0].fates?.find((f) => f.property === 'part')).toMatchObject({ fate: 'UNRESOLVED' })
    expect(h.alternatives.join('\n')).toMatch(/NOT turned for half of the description/)
  })
  it('counter-trial: the same read without the cross wing turns the ridge, as before', () => {
    const h = solveMassing({ outline: HOUSE, silhouettes, structure: MAIN_X })
    expect(h.bodies[0].roof.ridgeAxis).toBe('X')
  })
})

describe('a description is bound to the body its own views draw, not to the largest rectangle', () => {
  // three bodies in line along X: a 6 × 13 m middle body between two 6 × 8 m ones; the middle one stands 2.5 m out at
  // the front and the rear. The drawings: a gable on the front and rear over the middle body (ridge along Z, eaves 5 m,
  // ridge 8 m), lower roofs either side (ridge along X, eaves 3 m, ridge 7 m).
  const outline = outlineOf([[0, 2.5], [6, 2.5], [6, 0], [12, 0], [12, 2.5], [18, 2.5], [18, 10.5], [12, 10.5], [12, 13], [6, 13], [6, 10.5], [0, 10.5]])
  const long = (side: 'FRONT' | 'REAR'): SilhouetteObservation => {
    const f = (x: number): number => (side === 'FRONT' ? x : 18 - x)
    const span = (a: number, b: number): [number, number] => [Math.min(f(a), f(b)), Math.max(f(a), f(b))]
    const [m0, m1] = span(6, 12)
    const [l0, l1] = span(0, 6)
    const [r0, r1] = span(12, 18)
    return view(side, [box(l0, l1, 0, 3), box(r0, r1, 0, 3), [[px(m0), 400], [px(m1), 400], [px(m1), row(5)], [px((m0 + m1) / 2), row(8)], [px(m0), row(5)]]], [box(l0, l1, 3, 7), box(r0, r1, 3, 7), [[px(m0), row(5)], [px((m0 + m1) / 2), row(8.2)], [px(m1), row(5)], [px(m1), row(4.8)], [px((m0 + m1) / 2), row(8)], [px(m0), row(4.8)]]])
  }
  // an end view: the side body's gable end in front, the middle body's wall and slope behind it
  const end = (side: 'LEFT' | 'RIGHT'): SilhouetteObservation => view(side, [box(0, 13, 0, 5), [[px(2.5), 400], [px(10.5), 400], [px(10.5), row(3)], [px(6.5), row(7)], [px(2.5), row(3)]]], [box(0, 13, 5, 8), [[px(2.5), row(3)], [px(6.5), row(7.2)], [px(10.5), row(3)], [px(10.5), row(2.8)], [px(6.5), row(7)], [px(2.5), row(2.8)]]])
  const silhouettes = [long('FRONT'), long('REAR'), end('LEFT'), end('RIGHT')]
  it('the middle body keeps the ridge its four views draw and takes the reported wing\'s description; the side roofs run into it', () => {
    const base = solveMassing({ outline, silhouettes })
    expect(base.bodies).toHaveLength(3)
    expect(base.bodies[0].roof.ridgeAxis).toBe('Z')
    const h = solveMassing({ outline, silhouettes, structure: WITH_WING })
    expect(h.bodies[0].roof.ridgeAxis).toBe('Z')
    expect(h.alternatives.join('\n')).toMatch(/is the body whose own elevations draw that ridge/)
    expect(h.bodies[0].fates?.some((f) => f.property === 'part' && f.fate === 'APPLIED')).toBe(true)
    const sol = roofSystemOf(h)
    const valleys = sol.relations.filter((r) => r.kind === 'VALLEY')
    expect(valleys.map((r) => r.b)).toEqual(['roof-mass-main', 'roof-mass-main'])
    const b = build(h)
    expect(b.failure).toBeUndefined()
    expect(b.model.roofEdges.filter((e) => e.kind === 'VALLEY')).toHaveLength(4)
    expect(() => compileBuilding(b.model)).not.toThrow()
  })
  it('the same second ridge stated as a CROSS roof (form-read/3 names no part under it): it is that body\'s roof, with its own pitch — not a cross gable on another body\'s walls', () => {
    // seen on the front, from a third to two thirds of the building's width: the middle body's own stretch
    const CROSS: BuildStructure = { ...MAIN_X, parts: [], cross: [{ id: 'R2', side: 'FRONT', ridge: 'Z', span: { fromShare: 0.3, toShare: 0.7 }, pitchDeg: 45, ridgeM: { m: 8, status: 'PRINTED' } }] }
    const h = solveMassing({ outline, silhouettes, structure: CROSS })
    expect(h.bodies[0].roof.ridgeAxis).toBe('Z')
    expect(h.bodies[0].describes).toBe('PART')
    expect(h.crossRoofs ?? []).toHaveLength(0)
    expect(h.bodies[0].fates?.find((f) => f.property === 'part')?.taken).toMatch(/CROSS_ROOF@FRONT ridge Z/)
    expect(h.bodies.filter((b) => b.describes === 'MAIN')).toHaveLength(1)
    expect(roofSystemOf(h).relations.filter((r) => r.kind === 'VALLEY')).toHaveLength(2)
  })
  it('counter-trial: a cross roof stated over another stretch of the front is not this body\'s roof (its span does not cover the body)', () => {
    const ELSEWHERE: BuildStructure = { ...MAIN_X, parts: [], cross: [{ id: 'R2', side: 'FRONT', ridge: 'Z', span: { fromShare: 0.72, toShare: 0.98 }, pitchDeg: 45 }] }
    const h = solveMassing({ outline, silhouettes, structure: ELSEWHERE })
    expect(h.bodies[0].describes).not.toBe('PART')
    expect(h.alternatives.join('\n')).not.toMatch(/is the body whose own elevations draw that ridge/)
  })
})

describe('pitch, eaves and ridge are agreed again after the last change (settleRoof)', () => {
  const narrow = { minX: 0, maxX: 3.3852, minZ: 0, maxZ: 11.718 }
  it('heights read across a long span and turned over a short one are not built at 72° and not clipped to a limit: the ridge follows this body\'s own eaves', () => {
    const turned: RoofSpec = { kind: 'HIP', ridgeAxis: 'Z', pitchDeg: 72, eavesM: 3.298924, ridgeM: 8.511048, hipRunM: 1.6926 }
    const r = settleRoof(turned, narrow, { pitch: { deg: 22, from: 'a fallback', binding: false }, eavesHeld: false, drawnEavesM: 2.96, topOwn: false })
    expect(r.roof.pitchDeg).toBeCloseTo(22, 1)
    expect(r.roof.eavesM).toBeCloseTo(3.298924, 6)
    expect(r.roof.ridgeM).toBeCloseTo(3.298924 + 1.6926 * Math.tan((22 * Math.PI) / 180), 4)
    expect(r.notes[0]).toMatch(/not one roof's/)
    expect(r.fates.find((f) => f.property === 'ridgeM')).toMatchObject({ fate: 'REJECTED' })
  })
  it('with no pitch stated from outside, a roof outside a roof\'s range is left as read and named unresolved (nothing is invented)', () => {
    const turned: RoofSpec = { kind: 'GABLE', ridgeAxis: 'Z', pitchDeg: 72, eavesM: 3.3, ridgeM: 8.5 }
    const r = settleRoof(turned, narrow, { eavesHeld: false, drawnEavesM: 3, topOwn: false })
    expect(r.roof.ridgeM).toBe(8.5)
    expect(r.fates[0]).toMatchObject({ property: 'pitchDeg', fate: 'UNRESOLVED' })
  })
  it('a lower roof does not take the main roof\'s pitch while its own heights make a roof', () => {
    const garage: RoofSpec = { kind: 'GABLE', ridgeAxis: 'X', pitchDeg: 20.6, eavesM: 3.42, ridgeM: 4.92 }
    const r = settleRoof(garage, { minX: 0, maxX: 6, minZ: 0, maxZ: 8 }, { pitch: { deg: 35, from: 'a fallback', binding: false }, eavesHeld: false, drawnEavesM: 3.2, topOwn: true })
    expect(r.roof).toBe(garage)
    expect(r.fates).toEqual([])
  })
  it('a cross wing whose top is its own and witnessed, its eaves only a lower bound: the eaves follow from the ridge at the stated pitch', () => {
    const wing: RoofSpec = { kind: 'GABLE', ridgeAxis: 'Z', pitchDeg: 57.7, eavesM: 3.55, ridgeM: 8.31 }
    const rect = { minX: 6.05, maxX: 12.07, minZ: 0.42, maxZ: 9.59 }
    const r = settleRoof(wing, rect, { pitch: { deg: 42, from: 'stated', binding: true }, eavesHeld: false, drawnEavesM: 3.08, topOwn: true, topWitnessM: 8.49 })
    expect(r.roof.pitchDeg).toBeCloseTo(42, 1)
    expect(r.roof.ridgeM).toBe(8.31)
    expect(r.roof.eavesM).toBeCloseTo(8.31 - 3.01 * Math.tan((42 * Math.PI) / 180), 3)
    // counter-trials: the eaves held by two views, or the top not witnessed from outside — the drawing stands, the conflict is kept
    for (const w of [{ eavesHeld: true, topWitnessM: 8.49 }, { eavesHeld: false }]) {
      const k = settleRoof(wing, rect, { pitch: { deg: 42, from: 'stated', binding: true }, drawnEavesM: 3.08, topOwn: true, ...w })
      expect(k.roof.eavesM).toBe(3.55)
      expect(k.fates.find((f) => f.property === 'pitchDeg')).toMatchObject({ fate: 'RETAINED_WITH_CONFLICT' })
    }
  })
  it('a stated ridge and wall top are measured against what is built, each with its own fate and residual', () => {
    const main: RoofSpec = { kind: 'GABLE', ridgeAxis: 'X', pitchDeg: 35.2, eavesM: 5.4, ridgeM: 8.285 }
    const r = settleRoof(main, { minX: 0, maxX: 10, minZ: 0, maxZ: 8.18 }, { pitch: { deg: 31, from: 'stated', binding: true }, eavesHeld: true, drawnEavesM: 5.1, topOwn: true, statedRidge: { m: 6.45, status: 'PRINTED' } })
    expect(r.fates.find((f) => f.property === 'ridgeM')).toMatchObject({ fate: 'RETAINED_WITH_CONFLICT' })
    expect(r.fates.find((f) => f.property === 'ridgeM')?.residual).toBeCloseTo(1.835, 3)
    // 35.2° built against 31° stated: within what a registration reads — nothing moved, the difference kept
    expect(r.fates.find((f) => f.property === 'pitchDeg')).toMatchObject({ fate: 'RETAINED_WITH_CONFLICT' })
    expect(r.roof).toBe(main)
  })
})

describe('one roof geometry through the kernel: a valley, and the correct absence of one', () => {
  const body = (id: string, rect: MassingHypothesis['bodies'][number]['rect'], roof: RoofSpec): MassingHypothesis['bodies'][number] => ({ id, rect, roof, provenance: {} })
  const hyp = (bodies: MassingHypothesis['bodies'], extra: Partial<MassingHypothesis> = {}): MassingHypothesis => ({ version: 't', status: 'BUILDABLE', bodies, views: [], alternatives: [], missing: [], views_used: [], wallThicknessM: 0.3, why: 'control', ...extra })
  const main = body('mass-main', { minX: 0, maxX: 12, minZ: 0, maxZ: 8 }, { kind: 'GABLE', ridgeAxis: 'X', pitchDeg: 45, eavesM: 3, ridgeM: 7 })
  const wing = (eavesM: number, ridgeM: number) => body('mass-wing-1', { minX: 4, maxX: 8, minZ: -5, maxZ: 0 }, { kind: 'GABLE', ridgeAxis: 'Z', pitchDeg: 45, eavesM, ridgeM })
  it('a wing whose ridge runs into the main slope: planes, two VALLEY edges and one ROOF assembly, accepted and compiled by the kernel', () => {
    const b = build(hyp([main, wing(3, 5)]))
    expect(b.failure).toBeUndefined()
    expect(b.model.roofs).toHaveLength(0)
    expect(b.model.roofPlanes).toHaveLength(4)
    expect(b.model.roofEdges.filter((e) => e.kind === 'VALLEY')).toHaveLength(2)
    expect(b.model.roofEdges.filter((e) => e.kind === 'RIDGE')).toHaveLength(2)
    for (const v of b.model.roofEdges.filter((e) => e.kind === 'VALLEY')) expect([v.start.y, v.end.y].sort()).toEqual([3, 5])
    expect(b.model.assemblies.filter((a) => a.kind === 'ROOF')).toHaveLength(1)
    const c = compileBuilding(b.model) as { diagnostics?: Array<{ severity?: string }> }
    expect((c.diagnostics ?? []).filter((d) => d.severity === 'ERROR')).toEqual([])
  })
  it('wing eaves below the main eaves: the main wall under the abutment follows only the planes that stand over it', () => {
    const b = build(hyp([main, body('mass-wing-1', { minX: 2, maxX: 10, minZ: -5, maxZ: 0 }, { kind: 'GABLE', ridgeAxis: 'Z', pitchDeg: 45, eavesM: 2, ridgeM: 6 })]))
    expect(b.failure).toBeUndefined()
    const party = b.model.walls.find((w) => w.id === 'ring-mass-main-w0')
    const ids = (party?.topProfile as { planeIds: string[] }).planeIds
    // the wing's pieces over its own walls only touch this wall's face: they are not over it
    expect(ids).toEqual(['roof-mass-main-minZ', 'roof-mass-wing-1-maxX-1', 'roof-mass-wing-1-minX-1'])
    expect(b.model.roofEdges.filter((e) => e.kind === 'ABUTMENT')).toHaveLength(2)
  })
  it('counter-trial: a low garage against a two-storey wall keeps the two roofs as they were built before (no plane, no valley)', () => {
    const tall = body('mass-main', main.rect, { kind: 'GABLE', ridgeAxis: 'X', pitchDeg: 45, eavesM: 6, ridgeM: 10 })
    const b = build(hyp([tall, wing(2.8, 4.8)]))
    expect(b.failure).toBeUndefined()
    expect(b.model.roofs.map((r) => r.id).sort()).toEqual(['roof-mass-main', 'roof-mass-wing-1'])
    expect(b.model.roofPlanes).toHaveLength(0)
    expect(b.model.roofEdges).toHaveLength(0)
  })
  it('counter-trial: roofs the source shows apart are not joined, whatever their heights', () => {
    const b = build(hyp([main, wing(3, 5)], { separateRoofs: [['mass-main', 'mass-wing-1']] }))
    expect(b.model.roofs).toHaveLength(2)
    expect(b.model.roofPlanes).toHaveLength(0)
  })
  it('a single body is built exactly as before this stage (the same commands)', () => {
    const cmds = massingCommands(hyp([main]), createEmptyModel('m', 'control'))
    expect(cmds.filter((c) => c.type === 'createRoof')).toHaveLength(1)
    expect(cmds.some((c) => c.type === 'createRoofPlane' || c.type === 'createAssembly' || c.type === 'connectRoofPlanes')).toBe(false)
  })
})

describe('readback 1.1.0: every bound roof and every taken number is measured on the model', () => {
  const body = (id: string, rect: MassingHypothesis['bodies'][number]['rect'], roof: RoofSpec): MassingHypothesis['bodies'][number] => ({ id, rect, roof, provenance: {} })
  const hyp = (bodies: MassingHypothesis['bodies'], extra: Partial<MassingHypothesis> = {}): MassingHypothesis => ({ version: 't', status: 'BUILDABLE', bodies, views: [], alternatives: [], missing: [], views_used: [], wallThicknessM: 0.3, why: 'control', ...extra })
  const main = body('mass-main', { minX: 0, maxX: 12, minZ: 0, maxZ: 8 }, { kind: 'GABLE', ridgeAxis: 'X', pitchDeg: 45, eavesM: 3, ridgeM: 7 })
  const wing = body('mass-wing-1', { minX: 4, maxX: 8, minZ: -5, maxZ: 0 }, { kind: 'GABLE', ridgeAxis: 'Z', pitchDeg: 45, eavesM: 3, ridgeM: 5 })
  const walls = { twoMinM: 4.4, oneMaxM: 4.6 }
  const boundOf = (h: MassingHypothesis) => ({ bodies: h.bodies, ...(h.crossRoofs ? { crossRoofs: h.crossRoofs } : {}), relations: roofSystemOf(h).relations.map((q) => ({ a: q.a, b: q.b, kind: q.kind })) })
  it('the audit\'s probe: a taken pitch, eaves and ridge of 1° / 100 m / 200 m no longer leave every check passing', () => {
    const h = hyp([main])
    const m = build(h).model
    const good = readbackStructure(m, { fullStoreys: 1, mainRoof: 'GABLE', mainRidge: 'X', pitchDeg: 45, eavesM: { m: 2.65, status: 'PRINTED' }, ridgeM: { m: 7, status: 'PRINTED' }, parts: [] }, walls, boundOf(h))
    expect(good.checks.filter((c) => !c.agrees)).toEqual([])
    expect(good.checks.map((c) => c.property)).toEqual(expect.arrayContaining(['mainRoof.pitchDeg', 'mainRoof.ridgeM', 'mainRoof.eavesM', 'roof-mass-main.form', 'roof-mass-main.pitchDeg', 'roof-mass-main.ridgeM']))
    const bad = readbackStructure(m, { fullStoreys: 1, mainRoof: 'GABLE', mainRidge: 'X', pitchDeg: 1, eavesM: { m: 100, status: 'PRINTED' }, ridgeM: { m: 200, status: 'PRINTED' }, parts: [] }, walls, boundOf(h))
    const failed = bad.checks.filter((c) => !c.agrees).map((c) => c.property)
    expect(failed).toEqual(expect.arrayContaining(['mainRoof.pitchDeg', 'mainRoof.ridgeM', 'mainRoof.eavesM']))
    expect(bad.checks.find((c) => c.property === 'mainRoof.pitchDeg')?.residual).toBeCloseTo(44, 0)
  })
  it('a roof system is read as its regions and joins: both roofs measured from their planes, two valleys between them', () => {
    const h = hyp([main, wing])
    const rb = readbackStructure(build(h).model, { mainRoof: 'GABLE', mainRidge: 'X', parts: [{ what: 'WING', where: 'FRONT' }] }, walls, boundOf(h))
    expect(rb.roofs.map((r) => [r.id, r.stated, r.roof, r.ridgeAxis, r.pitchDeg, r.eavesM, r.ridgeM])).toEqual([['roof-mass-main', 'PLANES', 'GABLE', 'X', 45, 3, 7], ['roof-mass-wing-1', 'PLANES', 'GABLE', 'Z', 45, 3, 5]])
    expect(rb.joins.filter((j) => j.kind === 'VALLEY')).toHaveLength(2)
    expect(rb.checks.find((c) => c.property === 'join roof-mass-wing-1 → roof-mass-main')).toMatchObject({ agrees: true })
    expect(rb.checks.filter((c) => !c.agrees)).toEqual([])
  })
  it('counter-trials: a model whose wing roof was built apart fails the join it was solved with; an abutment is checked as NO valley', () => {
    const joined = hyp([main, wing])
    const apart = build(hyp([main, wing], { separateRoofs: [['mass-main', 'mass-wing-1']] })).model
    const rb = readbackStructure(apart, undefined, walls, boundOf(joined))
    expect(rb.checks.find((c) => c.property === 'join roof-mass-wing-1 → roof-mass-main')).toMatchObject({ agrees: false, built: '0 VALLEY edge(s)' })
    const tall = body('mass-main', main.rect, { kind: 'GABLE', ridgeAxis: 'X', pitchDeg: 45, eavesM: 6, ridgeM: 10 })
    const low = body('mass-wing-1', wing.rect, { kind: 'GABLE', ridgeAxis: 'Z', pitchDeg: 45, eavesM: 2.8, ridgeM: 4.8 })
    const ab = hyp([tall, low])
    const rb2 = readbackStructure(build(ab).model, undefined, walls, boundOf(ab))
    expect(rb2.checks.find((c) => c.property.startsWith('join '))).toMatchObject({ taken: 'ABUTMENT: no valley', agrees: true })
    expect(rb2.roofs.every((r) => r.stated === 'ROOF')).toBe(true)
  })
  it('a hip\'s kind, ridge direction and pitch are measured from its four planes (not inferred from the rectangle)', () => {
    const h = hyp([body('mass-main', { minX: 0, maxX: 8, minZ: 0, maxZ: 12 }, { kind: 'HIP', ridgeAxis: 'Z', pitchDeg: 45, eavesM: 3, ridgeM: 7, hipRunM: 4 })])
    const rb = readbackStructure(build(h).model, { mainRoof: 'HIP', mainRidge: 'Z', parts: [] }, walls, boundOf(h))
    expect(rb.roofs[0]).toMatchObject({ roof: 'HIP', ridgeAxis: 'Z', pitchDeg: 45, ridgeM: 7 })
    expect(rb.checks.find((c) => c.property === 'mainRoof.ridge')).toMatchObject({ taken: 'Z', built: 'Z', agrees: true })
  })
  it('the hand of a wall\'s start on an L-shaped ring: the two walls of the notch are named like every other wall of that winding', () => {
    const r = applyCommands(createEmptyModel('m', 'control'), [
      { type: 'createBuilding', id: 'b', name: 'control' },
      { type: 'createLevel', id: 'l0', name: 'Ground', index: 0, elevation: 0, height: 2.8 },
      { type: 'createWallRing', id: 'ring-l', levelId: 'l0', polygon: [{ x: 0, z: 0 }, { x: 12, z: 0 }, { x: 12, z: 2 }, { x: 2, z: 2 }, { x: 2, z: 12 }, { x: 0, z: 12 }], thickness: 0.3, height: 2.8, baseOffset: 0, kind: 'EXTERIOR', cornerOwnership: 'ALTERNATE' },
    ] as never)
    expect(r.failedAt).toBeUndefined()
    const cuts = r.model.walls.map((w, i) => ({ type: 'cutOpening', id: `o${i}`, wallId: w.id, kind: 'WINDOW', offset: 0.5, width: 0.6, sill: 0.9, height: 1.0 }))
    const m = applyCommands(r.model, cuts as never).model
    const rb = readbackOpenings(m, [])
    expect(rb.openings).toHaveLength(6)
    // one winding, one hand — the notch's walls included (1.0.0 named them RIGHT against the centroid of all walls)
    expect(new Set(rb.openings.map((o) => o.startIs)).size).toBe(1)
    expect(rb.openings[0].startIs).toBe('LEFT')
  })
})

describe('ops 1.13.0: the reading whose elevations share one scale decides which side is the front', () => {
  // the 12 × 8 m house of this file: slopes drawn 12 m wide, gable ends 8 m wide, all at 40 px a metre
  const said = (side: SilhouetteObservation['side'], v: SilhouetteObservation): SilhouetteObservation => ({ ...v, side, observationId: side, frameId: side.toLowerCase() })
  it('captions a quarter turn off: the views read as labelled are at two scales, turned they are at one — the body is built turned, by name', () => {
    const { h, turn } = massingHypothesisOf({ outline: HOUSE, silhouettes: [said('LEFT', slope('FRONT')), said('RIGHT', slope('REAR')), said('FRONT', gableEnd('LEFT')), said('REAR', gableEnd('RIGHT'))] }, undefined, true)
    expect(turn).toBe(true)
    expect(h.status).toBe('BUILDABLE')
    const r = h.bodies[0].rect
    expect([Math.round(r.maxX - r.minX), Math.round(r.maxZ - r.minZ)]).toEqual([8, 12])
    expect(h.alternatives.some((a) => /share one scale is taken \(turned by 90°\)/.test(a))).toBe(true)
  })
  it('counter-trial: the same drawings under their right captions stay as labelled, for the same reason', () => {
    const { h, turn } = massingHypothesisOf({ outline: HOUSE, silhouettes: [slope('FRONT'), slope('REAR'), gableEnd('LEFT'), gableEnd('RIGHT')] }, undefined, true)
    expect(turn).toBe(false)
    const r = h.bodies[0].rect
    expect([Math.round(r.maxX - r.minX), Math.round(r.maxZ - r.minZ)]).toEqual([12, 8])
    expect(h.alternatives.some((a) => /share one scale is taken \(as labelled\)/.test(a))).toBe(true)
  })
  it('counter-trial: a near-square house gives the scales nothing to decide (both readings alike) — the earlier rule stands', () => {
    const SQUARE = outlineOf([[0, 0], [10, 0], [10, 9.6], [0, 9.6]])
    const sl = (side: 'FRONT' | 'REAR'): SilhouetteObservation => view(side, [box(0, 10, 0, 3)], [box(0, 10, 3, 7)])
    const ge = (side: 'LEFT' | 'RIGHT'): SilhouetteObservation => view(side, [[[px(0), 400], [px(9.6), 400], [px(9.6), row(3)], [px(4.8), row(7)], [px(0), row(3)]]], [[[px(0), row(3)], [px(4.8), row(7.2)], [px(9.6), row(3)], [px(9.6), row(2.8)], [px(4.8), row(7)], [px(0), row(2.8)]]])
    const { h } = massingHypothesisOf({ outline: SQUARE, silhouettes: [sl('FRONT'), sl('REAR'), ge('LEFT'), ge('RIGHT')] }, undefined, true)
    expect(h.alternatives.some((a) => /no decision: both alike/.test(a))).toBe(true)
  })
})

describe('massing 1.13.0: one set of elevations is at one scale', () => {
  // the 12 × 8 m house of this file; each gable end ALSO draws a post of a covered terrace 1.5–2 m beyond its wall
  // (open gap between): registered by its drawn walls' width, a gable-end view comes out at 0.02 m/px against 0.025
  const POST: Poly = box(9.5, 10, 0, 2.6)
  const withPost = (side: 'LEFT' | 'RIGHT'): SilhouetteObservation => { const v = gableEnd(side); return { ...v, walls: [...v.walls, POST] } }
  it('the views draw the top at one height in pixels: the side views\' heights are read at the set\'s scale, the ridge is the drawn 7 m', () => {
    const h = solveMassing({ outline: HOUSE, silhouettes: [slope('FRONT'), slope('REAR'), withPost('LEFT'), withPost('RIGHT')] })
    const plain = solveMassing({ outline: HOUSE, silhouettes: [slope('FRONT'), slope('REAR'), gableEnd('LEFT'), gableEnd('RIGHT')] })
    expect(h.status).toBe('BUILDABLE')
    // the same body as without the posts (the top read at 0.02 m/px would be 20 % lower on the two end views)
    expect(h.bodies[0].roof.ridgeM).toBeCloseTo(plain.bodies[0].roof.ridgeM as number, 2)
    expect(Math.abs(h.bodies[0].roof.eavesM - plain.bodies[0].roof.eavesM)).toBeLessThan(0.1)
    expect(h.bodies[0].rect).toEqual(plain.bodies[0].rect)
    expect(h.alternatives.join('\n')).toMatch(/ONE_SCALE: the (left|right) elevation draws the house's top/)
  })
  it('counter-trial: without the posts nothing is reconciled and the body is the same', () => {
    const h = solveMassing({ outline: HOUSE, silhouettes: [slope('FRONT'), slope('REAR'), gableEnd('LEFT'), gableEnd('RIGHT')] })
    expect(h.bodies[0].roof.ridgeM).toBeCloseTo(7.1, 1)
    expect(h.alternatives.join('\n')).not.toMatch(/ONE_SCALE/)
  })
  it('counter-trial: drawings that disagree on the top in pixels are not forced to one scale', () => {
    const tall = (side: 'LEFT' | 'RIGHT'): SilhouetteObservation => { const v = withPost(side); return { ...v, roofs: v.roofs.map((p) => p.map(([x, y]) => [x, y < row(5) ? y - 60 : y] as [number, number])) } }
    const h = solveMassing({ outline: HOUSE, silhouettes: [slope('FRONT'), slope('REAR'), tall('LEFT'), tall('RIGHT')] })
    expect(h.alternatives.join('\n')).not.toMatch(/ONE_SCALE: the/)
  })
})

describe('massing 1.13.0: stated numbers the roof cannot take are named, not built', () => {
  it('a binding pitch outside 8–62° is REJECTED and the drawn heights stand', () => {
    const roof: RoofSpec = { kind: 'GABLE', ridgeAxis: 'X', pitchDeg: 38.7, eavesM: 3, ridgeM: 7 }
    for (const deg of [5, 0, 70]) {
      const s = settleRoof(roof, { minX: 0, maxX: 10, minZ: 0, maxZ: 8 }, { pitch: { deg, from: 'a control', binding: true }, eavesHeld: true, drawnEavesM: 3, topOwn: false })
      expect([s.roof.eavesM, s.roof.ridgeM]).toEqual([3, 7])
      expect(s.fates.find((f) => f.property === 'pitchDeg')?.fate).toBe('REJECTED')
    }
  })
  it('counter-trial: a binding pitch in range still settles the roof', () => {
    const roof: RoofSpec = { kind: 'GABLE', ridgeAxis: 'X', pitchDeg: 38.7, eavesM: 3, ridgeM: 7 }
    const s = settleRoof(roof, { minX: 0, maxX: 10, minZ: 0, maxZ: 8 }, { pitch: { deg: 25, from: 'a control', binding: true }, eavesHeld: true, drawnEavesM: 3, topOwn: false })
    expect(s.roof.ridgeM).toBeCloseTo(3 + 4 * Math.tan((25 * Math.PI) / 180), 3)
  })
})

describe('massing 1.13.0: a gable wall of another body is not a second ridge on the main body', () => {
  // the 12 × 8 m house with a 4 m wide, 5 m deep wing in front of it (x 4…8): the front elevation draws the wing's own
  // gable wall (shoulders 3 m, apex 5 m) over 4…8 m — exactly where a cross gable of the main body would be drawn
  const T_OUTLINE = outlineOf([[0, 0], [4, 0], [4, -5], [8, -5], [8, 0], [12, 0], [12, 8], [0, 8]])
  const side = (s: 'LEFT' | 'RIGHT'): SilhouetteObservation => view(s, [box(-5, 8, 0, 3), [[px(0), 400], [px(8), 400], [px(8), row(3)], [px(4), row(7)], [px(0), row(3)]]], [box(-5, 0, 3, 5), [[px(0), row(3)], [px(4), row(7.2)], [px(8), row(3)], [px(8), row(2.8)], [px(4), row(7)], [px(0), row(2.8)]]])
  const sil = [slope('FRONT', [CROSS_WALL]), slope('REAR'), gableEnd('LEFT'), gableEnd('RIGHT')]
  it('a CROSS roof the read reports on that side is refused by name: it is the wing\'s own gable; no cross gable over the main slope', () => {
    const CROSS_FRONT: BuildStructure = { ...MAIN_X, parts: [], cross: [{ id: 'R9', side: 'FRONT', ridge: 'Z', pitchDeg: 45 }] }
    const h = solveMassing({ outline: T_OUTLINE, silhouettes: sil, structure: CROSS_FRONT })
    expect(h.status).toBe('BUILDABLE')
    expect(h.crossRoofs ?? []).toHaveLength(0)
    expect(h.alternatives.join('\n')).toMatch(/that body's own gable/)
  })
  it('counter-trial: on the plain rectangle the same read and drawing build the cross gable', () => {
    const CROSS_FRONT: BuildStructure = { ...MAIN_X, parts: [], cross: [{ id: 'R9', side: 'FRONT', ridge: 'Z', pitchDeg: 45 }] }
    const h = solveMassing({ outline: HOUSE, silhouettes: sil, structure: CROSS_FRONT })
    expect((h.crossRoofs ?? []).map((c) => c.side)).toEqual(['FRONT'])
  })
  void side
})
