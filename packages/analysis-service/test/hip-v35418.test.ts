/**
 * v3.54.18 R2 — hip roofs, verge-only gable ends and the eaves at the wall.
 *
 * Controlled drawings (not a benchmark house): one 12 × 8 m body whose elevations are painted from stated true values, so
 * every assertion has a cause and a counter-trial. Three rules are held here:
 *  1. a roof drawn as a trapezoid on the sides along its ridge is a HIP — read, built as four planes, corrected and gated;
 *  2. a gable end drawn as its verge alone (two bars, no surface) is a gable end, not a slope;
 *  3. the eaves at the wall are where a gable-end view draws the wall corner; a view along the ridge draws its walls
 *     ending behind the fascia, lower by no more than an overhang hides.
 */
import { describe, expect, it } from 'vitest'
import { applyCommands } from '@buildapp/commands'
import type { BuildingCommand } from '@buildapp/commands'
import { compileBuilding, geometryClosureAudit } from '@buildapp/geometry'
import { createEmptyModel, validateModel } from '@buildapp/model'
import type { CanonicalBuildingModel } from '@buildapp/model'
import { executeCorrections, modelRevision, sideRidgeM } from '../src/consult/correct/execute.js'
import type { BindPicture, BindView, CorrectionProposal, Side } from '../src/consult/correct/execute.js'
import { capabilityPrompt } from '../src/consult/correct/registry.js'
import { bodiesOf, bodyCommands, HIP_PLANE_SIDES, hipPlaneCommands, hipSpecFrom, hipWallTopM, MINIATURE_CONVENTIONS, outlineWithFront, profileOver, solveMassing } from '../src/consult/massing/massing.js'
import type { BodySpec, OutlineObservation, RoofSpec, SilhouetteObservation } from '../src/consult/massing/massing.js'
import { orientationOf, roofProposalsFromSketches } from '../src/consult/massing/ops.js'

type Poly = Array<[number, number]>
const MPP = 0.02
const ZERO = 400
const W = 960
const H = 440
const RECT = { minX: 0, maxX: 12, minZ: 0, maxZ: 8 }
const SIDES: Side[] = ['FRONT', 'RIGHT', 'REAR', 'LEFT']
const ORIGIN: Record<Side, { a0: number; sign: 1 | -1; axis: 'x' | 'z' }> = { FRONT: { a0: -2, sign: 1, axis: 'x' }, RIGHT: { a0: -2, sign: 1, axis: 'z' }, REAR: { a0: 14, sign: -1, axis: 'x' }, LEFT: { a0: 10, sign: -1, axis: 'z' } }
const col = (s: Side, a: number): number => (ORIGIN[s].sign === 1 ? (a - ORIGIN[s].a0) / MPP : (ORIGIN[s].a0 - a) / MPP)
const row = (y: number): number => ZERO - y / MPP
const ext = (s: Side): [number, number] => (ORIGIN[s].axis === 'x' ? [RECT.minX, RECT.maxX] : [RECT.minZ, RECT.maxZ])
const SLAB = MINIATURE_CONVENTIONS.roofThicknessM

/** The true roof: the top surface at the wall face, the ridge, the hip run (0: a gable), the overhang — ridge along X. */
type True = { eaves: number; ridge: number; run: number; oh: number; wallDrawn?: Partial<Record<Side, number>>; vergeOnly?: boolean }
const HIP: True = { eaves: 3.4, ridge: 5.8, run: 4, oh: 0.5 }
const GABLE: True = { eaves: 3.4, ridge: 5.8, run: 0, oh: 0 }
const tanOf = (t: True): number => (t.ridge - t.eaves) / 4
const underOf = (t: True): number => SLAB / Math.cos(Math.atan(tanOf(t)))
/** What each elevation draws: the walls up to the soffit (or the stated drawn top), the roof with its fascia band. */
function drawn(s: Side, t: True): { walls: Poly[]; roofs: Poly[] } {
  const [lo, hi] = ext(s)
  const tan = tanOf(t)
  const fasciaTop = t.eaves - t.oh * tan
  const fasciaLow = fasciaTop - underOf(t)
  const wallTop = t.wallDrawn?.[s] ?? fasciaLow
  const c = (a: number): number => col(s, a)
  const walls: Poly[] = [[[c(lo), row(0)], [c(hi), row(0)], [c(hi), row(wallTop)], [c(lo), row(wallTop)]]]
  const alongRidge = ORIGIN[s].axis === 'x'
  if (alongRidge) {
    const ohEnd = t.run > 0 ? t.oh : 0
    return { walls, roofs: [[[c(lo - ohEnd), row(fasciaLow)], [c(hi + ohEnd), row(fasciaLow)], [c(hi + ohEnd), row(fasciaTop)], [c(hi - t.run), row(t.ridge)], [c(lo + t.run), row(t.ridge)], [c(lo - ohEnd), row(fasciaTop)]]] }
  }
  const mid = (lo + hi) / 2
  // a gable end drawn as its verge alone: two bars along the slopes, nothing between them
  if (t.vergeOnly) return { walls: [...walls, [[c(lo), row(wallTop)], [c(hi), row(wallTop)], [c(mid), row(t.ridge - 0.3)]]], roofs: [[[c(lo - t.oh), row(fasciaLow)], [c(mid), row(t.ridge - 0.25)], [c(hi + t.oh), row(fasciaLow)], [c(hi + t.oh), row(fasciaTop)], [c(mid), row(t.ridge)], [c(lo - t.oh), row(fasciaTop)]]] }
  return { walls, roofs: [[[c(lo - t.oh), row(fasciaLow)], [c(hi + t.oh), row(fasciaLow)], [c(hi + t.oh), row(fasciaTop)], [c(mid), row(t.ridge)], [c(lo - t.oh), row(fasciaTop)]]] }
}
function inPoly(poly: Poly, x: number, y: number): boolean {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if (poly[i][1] > y !== poly[j][1] > y && x < ((poly[j][0] - poly[i][0]) * (y - poly[i][1])) / (poly[j][1] - poly[i][1]) + poly[i][0]) c = !c
  return c
}
function paint(s: Side, t: True): BindPicture['raster'] {
  const data = new Uint8ClampedArray(W * H * 4)
  let seed = 7 + s.length
  const rnd = (): number => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  const d = drawn(s, t)
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const n = Math.round((rnd() - 0.5) * 18)
    let c: [number, number, number] = y > ZERO ? [120 + n, 150 + n, 100 + n] : [225, 235, 245]
    if (d.walls.some((q) => inPoly(q, x, y))) c = [228 + n, 218 + n, 198 + n]
    if (d.roofs.some((q) => inPoly(q, x, y))) c = [92 + n, 92 + n, 98 + n + (x % 9 < 2 ? 25 : 0)]
    data.set([c[0], c[1], c[2], 255], (y * W + x) * 4)
  }
  return { width: W, height: H, data }
}
const frameOf = (s: Side): string => `frame-${s.toLowerCase()}`
const sha = (s: Side): string => (s.charCodeAt(0).toString(16) + 'e').repeat(32).slice(0, 64)
const pictures = (t: True): BindPicture[] => SIDES.map((s, i) => ({ n: i + 1, frameId: frameOf(s), projection: 'ORTHOGRAPHIC_ELEVATION', transform: { x0: 0, y0: 0, scale: 1 }, raster: paint(s, t), sourceByteHash: sha(s) }))
const silhouettes = (t: True, sides: Side[] = SIDES): SilhouetteObservation[] => sides.map((s) => ({ observationId: `sk-${s}`, side: s, frameId: frameOf(s), sourceByteHash: sha(s), groundRow: ZERO, ...drawn(s, t) }))
const sketches = (t: True, sides: Side[] = SIDES): Array<{ facade: string; frameId: string; groundRow: number | null; walls: Poly[]; roofs: Poly[] }> => sides.map((s) => ({ facade: s, frameId: frameOf(s), groundRow: ZERO, ...drawn(s, t) }))
const sideOf = (f: string): Side | undefined => (SIDES.includes(f as Side) ? (f as Side) : undefined)
const OUTLINE: OutlineObservation = { observationId: 'plan-outline', frameId: 'frame-plan', sourceByteHash: 'p'.repeat(64), outline: [{ x: 0, z: 0 }, { x: 12, z: 0 }, { x: 12, z: 8 }, { x: 0, z: 8 }], by: 'CONTROL', fidelity: 'SOURCE_DERIVED', why: 'the controlled plan' }
const viewOf = (s: Side): BindView => ({ side: s, frameId: frameOf(s), projection: { mpp: MPP, alongAtPx0: ORIGIN[s].a0, alongSign: ORIGIN[s].sign, zeroRow: ZERO }, heights: true, origin: 'ANALYZER', alongErrorM: 0.04, heightErrorM: 0.06 })
const propose = (m: CanonicalBuildingModel, p: Partial<CorrectionProposal> & { operation: string }): CorrectionProposal => ({ proposalId: p.proposalId ?? `p-${Math.random().toString(36).slice(2, 8)}`, baseRevision: p.baseRevision ?? modelRevision(m), targetId: p.targetId ?? 'WHOLE', origin: 'CONTROL', uncertainty: 'LOW', ...p } as CorrectionProposal)
function build(cmds: BuildingCommand[]): CanonicalBuildingModel {
  const r = applyCommands(createEmptyModel('m-hip', 'controlled'), cmds)
  if (r.failedAt !== undefined) throw new Error(JSON.stringify(r.results[r.failedAt]).slice(0, 400))
  return r.model
}
const WINDOW: BuildingCommand[] = [{ type: 'cutOpening', id: 'w1', wallId: 'ring-mass-main-w0', kind: 'WINDOW', offset: 2, sill: 0.9, width: 1.5, height: 1.4 }, { type: 'placeWindow', id: 'w1-unit', openingId: 'w1' }] as BuildingCommand[]
const modelOf = (roof: RoofSpec, rect = RECT, extra: BuildingCommand[] = WINDOW): CanonicalBuildingModel => build([
  { type: 'createBuilding', id: 'building' },
  { type: 'createLevel', id: 'lvl-0', index: 0, elevation: 0, height: 6 },
  ...bodyCommands({ id: 'mass-main', rect, roof, provenance: {} } as BodySpec, 'lvl-0', 0, [], 0.3),
  ...extra,
] as BuildingCommand[])
const clean = (m: CanonicalBuildingModel): { valid: boolean; diagnostics: string[]; closure: string[] } => {
  const scene = compileBuilding(m)
  return { valid: validateModel(m).ok, diagnostics: scene.diagnostics.map((d) => d.code), closure: geometryClosureAudit(m, scene).findings.filter((f) => f.severity === 'ERROR').map((f) => f.code) }
}
const gableSpec: RoofSpec = { kind: 'GABLE', ridgeAxis: 'X', pitchDeg: 31, eavesM: 3.4, ridgeM: 5.8 }
const hipSpec: RoofSpec = { kind: 'HIP', ridgeAxis: 'X', pitchDeg: 31, eavesM: 3.4, ridgeM: 5.8, hipRunM: 4, overhangM: 0.5 }

describe('v3.54.18 R2 hip: four planes the kernel builds closed', () => {
  it('along X, along Z, with and without an overhang, and as a point: valid, compiled, no closure error, the window cut', () => {
    for (const roof of [hipSpec, { ...hipSpec, overhangM: undefined }, { ...hipSpec, hipRunM: 2.5 }] as RoofSpec[]) {
      const m = modelOf(roof)
      expect(m.roofs).toHaveLength(0)
      expect(m.roofPlanes.map((p) => p.id).sort()).toEqual(HIP_PLANE_SIDES.map((sd) => `roof-mass-main-${sd}`).sort())
      expect(clean(m)).toEqual({ valid: true, diagnostics: [], closure: [] })
      expect(sideRidgeM(m, 'FRONT')).toBeCloseTo(5.8, 2)
      // every wall ends level under the roof: the slab's vertical thickness under the top surface at its own face
      // (the hip ends at their own pitch — steeper where the hip run is shorter than half the span)
      for (const w of m.walls) expect(w.height).toBeCloseTo(hipWallTopM(roof, Math.abs(w.end.x - w.start.x) < 1e-6, 4), 3)
      expect(m.walls.every((w) => !w.topProfile)).toBe(true)
    }
    const z = modelOf({ ...hipSpec, ridgeAxis: 'Z', hipRunM: 4 }, { minX: 0, maxX: 8, minZ: 0, maxZ: 12 })
    expect(clean(z)).toEqual({ valid: true, diagnostics: [], closure: [] })
    const point = modelOf({ ...hipSpec, hipRunM: 6 })
    expect(clean(point)).toEqual({ valid: true, diagnostics: [], closure: [] })
    expect(point.roofPlanes.filter((p) => p.boundary.length === 3)).toHaveLength(4)
  })
  it('the planes are one body\'s roof: found over its ring, named by the plan side each drains to', () => {
    const b = bodiesOf(modelOf(hipSpec)).find((q) => q.id === 'ring-mass-main')
    expect(b?.planeIds.sort()).toEqual(['roof-mass-main-maxX', 'roof-mass-main-maxZ', 'roof-mass-main-minX', 'roof-mass-main-minZ'])
    const names = hipPlaneCommands('roof-a', 'lvl-0', RECT, { ...hipSpec, ridgeAxis: 'Z' }).map((c) => (c as { id?: string }).id)
    expect([...names].sort()).toEqual(['roof-a-maxX', 'roof-a-maxZ', 'roof-a-minX', 'roof-a-minZ'])
  })
})

describe('v3.54.18 R2 reading: the drawn roof\'s form', () => {
  it('a trapezoid on the side along the ridge gives the ridge ends; the hip end is a triangle', () => {
    const f = profileOver(viewOf('FRONT'), 0, 12, drawn('FRONT', HIP))
    expect(f?.shape).toBe('TRAPEZOID')
    expect(f?.ridge?.lo).toBeCloseTo(4, 1)
    expect(f?.ridge?.hi).toBeCloseTo(8, 1)
    expect(f?.drawn?.lo).toBeCloseTo(-0.5, 1)
    expect(profileOver(viewOf('RIGHT'), 0, 8, drawn('RIGHT', HIP))?.shape).toBe('TRIANGLE')
  })
  it('a hip with a short ridge is still a hip: a level top of a metre or more is a ridge, not a gable end\'s point; counter-trial: a point', () => {
    const short = profileOver(viewOf('FRONT'), 0, 12, drawn('FRONT', { ...HIP, run: 5 }))
    expect(short?.shape).toBe('TRAPEZOID')
    expect((short?.ridge?.hi ?? 0) - (short?.ridge?.lo ?? 0)).toBeCloseTo(2, 1)
    expect(profileOver(viewOf('FRONT'), 0, 12, drawn('FRONT', { ...HIP, run: 6 }))?.shape).toBe('TRIANGLE')
  })
  it('a gable end drawn as its verge alone is a triangle (was: a band, by counted columns); counter-trial: a filled slope stays a band', () => {
    const verge = profileOver(viewOf('RIGHT'), 0, 8, { walls: [], roofs: drawn('RIGHT', { ...GABLE, oh: 0.6, vergeOnly: true }).roofs })
    expect(verge?.hollow).toBe(true)
    expect(verge?.shape).toBe('TRIANGLE')
    const slope = profileOver(viewOf('FRONT'), 0, 12, drawn('FRONT', GABLE))
    expect(slope?.hollow).toBeUndefined()
    expect(slope?.shape).toBe('BAND')
    expect(profileOver(viewOf('RIGHT'), 0, 8, drawn('RIGHT', GABLE))?.shape).toBe('TRIANGLE')
  })
})

describe('v3.54.18 R2 the solver: a hip from the plan and the elevations', () => {
  it('reads the hip: ridge along X, the hip run, the pitch from the fascia over the overhang, the top surface at the wall', () => {
    const h = solveMassing({ outline: OUTLINE, silhouettes: silhouettes(HIP) })
    expect(h.status).toBe('BUILDABLE')
    const r = h.bodies[0].roof
    expect(r.kind).toBe('HIP')
    expect(r.ridgeAxis).toBe('X')
    expect(r.hipRunM).toBeCloseTo(4, 1)
    expect(r.overhangM).toBeCloseTo(0.5, 1)
    expect(r.ridgeM).toBeCloseTo(5.8, 1)
    expect(Math.abs((r.pitchDeg as number) - 31) <= 0.6).toBe(true)
    expect(Math.abs(r.eavesM - 3.4) <= 0.08).toBe(true)
  })
  it('counter-trial: read from the wall face (no overhang drawn past the walls) the same edge gives a steeper roof — the overhang is what makes the pitch', () => {
    const steep = hipSpecFrom({ axis: 'X', span: 8, length: 12, topM: 5.8, lowM: 2.81, runM: 4, reachM: 0 })
    const drawnPitch = hipSpecFrom({ axis: 'X', span: 8, length: 12, topM: 5.8, lowM: 2.81, runM: 4, reachM: 0.5 })
    expect((steep.pitchDeg as number) - (drawnPitch.pitchDeg as number)).toBeGreaterThan(2.5)
    expect(Math.abs((drawnPitch.pitchDeg as number) - 31) <= 0.3).toBe(true)
  })
  it('counter-trial: the same house drawn as a gable is a gable (bands along the ridge), with no hip named', () => {
    const h = solveMassing({ outline: OUTLINE, silhouettes: silhouettes(GABLE) })
    expect(h.bodies[0].roof.kind).toBe('GABLE')
    expect(h.bodies[0].roof.hipRunM).toBeUndefined()
    expect(h.alternatives.join(' ')).not.toMatch(/hip/)
  })
  it('gable ends drawn as verges decide the ridge direction (was a tie of four bands, X taken by default)', () => {
    const t: True = { ...GABLE, oh: 0.6, vergeOnly: true }
    // the ridge along Z would be the default's wrong answer: turn the house so the true ridge runs along Z
    const turned = silhouettes(t).map((s) => ({ ...s, side: ({ FRONT: 'RIGHT', RIGHT: 'REAR', REAR: 'LEFT', LEFT: 'FRONT' } as Record<Side, Side>)[s.side] }))
    const h = solveMassing({ outline: { ...OUTLINE, outline: [{ x: 0, z: 0 }, { x: 8, z: 0 }, { x: 8, z: 12 }, { x: 0, z: 12 }] }, silhouettes: turned })
    expect(h.missing.map((x) => x.anchor)).toEqual([])
    expect(h.bodies[0].roof.ridgeAxis).toBe('Z')
  })
})

describe('v3.54.18 R2 the eaves at the wall: the gable end shows it, the eaves side hides it', () => {
  // the wall plate under the roof at 3.11 m; the sides along the ridge draw their walls up to a boxed soffit at 2.70 m
  const boxed: True = { ...GABLE, oh: 0, wallDrawn: { FRONT: 2.7, REAR: 2.7, RIGHT: 3.11, LEFT: 3.11 } }
  it('the gable-end wall corner is taken: the built wall ends at the plate and the pitch is the drawn one', () => {
    const h = solveMassing({ outline: OUTLINE, silhouettes: silhouettes(boxed) })
    const r = h.bodies[0].roof
    expect(r.kind).toBe('GABLE')
    expect(Math.abs(r.eavesM - 3.4) <= 0.06).toBe(true)
    expect(Math.abs((r.pitchDeg as number) - 31) <= 0.6).toBe(true)
    expect(h.bodies[0].provenance.height.why).toMatch(/gable-end view/)
  })
  it('counter-trial: an eaves side that draws its walls HIGHER than the gable end contradicts it — the median stands, unconfirmed', () => {
    const h = solveMassing({ outline: OUTLINE, silhouettes: silhouettes({ ...boxed, wallDrawn: { FRONT: 3.9, REAR: 3.9, RIGHT: 3.11, LEFT: 3.11 } }) })
    expect(h.bodies[0].provenance.height.fidelity).toBe('TRACE_UNCERTAIN')
    expect(h.bodies[0].provenance.height.why).not.toMatch(/gable-end view/)
  })
  it('counter-trial: walls drawn lower than any overhang could hide are not explained away either', () => {
    const h = solveMassing({ outline: OUTLINE, silhouettes: silhouettes({ ...boxed, wallDrawn: { FRONT: 2.0, REAR: 2.0, RIGHT: 3.11, LEFT: 3.11 } }) })
    expect(h.bodies[0].provenance.height.why).not.toMatch(/gable-end view/)
  })
  it('the orientation hypothesis reads the same physics: such views agree as labelled; beyond an overhang\'s fall they do not', () => {
    const m = modelOf(gableSpec)
    expect(orientationOf(sketches(boxed), m, sideOf).assignment).toBe('AS_LABELLED')
    expect(orientationOf(sketches(boxed), m, sideOf).confirmed).toEqual(['ring-mass-main'])
    const far = orientationOf(sketches({ ...boxed, wallDrawn: { FRONT: 1.6, REAR: 1.6, RIGHT: 3.11, LEFT: 3.11 } }), m, sideOf)
    expect(far.perBody?.[0].agreesLabelled).toBe(false)
  })
})

describe('v3.54.18 R2 BUILD_MASSING and SET_ROOF: the hip through the executor and the source gate', () => {
  it('BUILD_MASSING on the empty model builds the hip body: four planes with evidence, level walls, compiled closed', () => {
    const out = executeCorrections({ model: createEmptyModel('m-hip', 'controlled'), views: [], pictures: pictures(HIP), proposals: [propose(createEmptyModel('m-hip', 'controlled'), { operation: 'BUILD_MASSING' })], massing: { outline: OUTLINE, silhouettes: silhouettes(HIP) } })
    expect(out.records[0].status).toBe('COMMITTED')
    expect(out.model.roofPlanes).toHaveLength(4)
    expect(out.model.roofPlanes.every((p) => p.evidence && p.materialId === MINIATURE_CONVENTIONS.roofMaterialId)).toBe(true)
    expect(clean(out.model).closure).toEqual([])
  })
  it('SET_ROOF HIP on a gable model whose elevation draws a hip: the roof becomes four planes, walls level, the window and ids kept', () => {
    const m = modelOf(gableSpec)
    const front = drawn('FRONT', HIP).roofs[0]
    const out = executeCorrections({ model: m, views: SIDES.map(viewOf), pictures: pictures(HIP), proposals: [propose(m, { operation: 'SET_ROOF', targetId: 'roof-mass-main', frameId: frameOf('FRONT'), patch: { roofKind: 'HIP', roofPolygon: front } })] })
    expect(out.records[0].status).toBe('COMMITTED')
    expect(out.model.roofs).toHaveLength(0)
    expect(out.model.roofPlanes.map((p) => p.id).sort()).toEqual(HIP_PLANE_SIDES.map((sd) => `roof-mass-main-${sd}`).sort())
    expect(out.model.openings.map((o) => o.id)).toEqual(['w1'])
    expect(out.model.walls.map((w) => w.id).sort()).toEqual(m.walls.map((w) => w.id).sort())
    expect(out.model.walls.every((w) => !w.topProfile)).toBe(true)
    expect(clean(out.model)).toEqual({ valid: true, diagnostics: [], closure: [] })
    expect(out.records[0].bound?.values?.hipRunM as number).toBeCloseTo(4, 1)
  })
  it('counter-trial: HIP proposed where the picture draws a gable is refused — by the drawn shape, and by the source when a trapezoid is claimed', () => {
    const m = modelOf(gableSpec)
    const band = drawn('FRONT', GABLE).roofs[0]
    const byShape = executeCorrections({ model: m, views: SIDES.map(viewOf), pictures: pictures(GABLE), proposals: [propose(m, { operation: 'SET_ROOF', targetId: 'roof-mass-main', frameId: frameOf('FRONT'), patch: { roofKind: 'HIP', roofPolygon: band } })] })
    expect(byShape.records[0].code).toBe('KIND_CONTRADICTS_SHAPE')
    const claimed = executeCorrections({ model: m, views: SIDES.map(viewOf), pictures: pictures(GABLE), proposals: [propose(m, { operation: 'SET_ROOF', targetId: 'roof-mass-main', frameId: frameOf('FRONT'), patch: { roofKind: 'HIP', roofPolygon: drawn('FRONT', HIP).roofs[0] } })] })
    expect(claimed.records[0].status).not.toBe('COMMITTED')
    expect(claimed.model.roofs).toHaveLength(1)
    expect(claimed.model.roofPlanes).toHaveLength(0)
  })
  it('a hip end alone does not state the hip run: named, nothing built; a GABLE proposed over a drawn trapezoid is named a hip', () => {
    const m = modelOf(gableSpec)
    const end = executeCorrections({ model: m, views: SIDES.map(viewOf), pictures: pictures(HIP), proposals: [propose(m, { operation: 'SET_ROOF', targetId: 'roof-mass-main', frameId: frameOf('RIGHT'), patch: { roofKind: 'HIP', roofPolygon: drawn('RIGHT', HIP).roofs[0] } })] })
    expect(end.records[0].code).toBe('HIP_RUN_NOT_SEEN')
    const gable = executeCorrections({ model: m, views: SIDES.map(viewOf), pictures: pictures(HIP), proposals: [propose(m, { operation: 'SET_ROOF', targetId: 'roof-mass-main', frameId: frameOf('FRONT'), patch: { roofKind: 'GABLE', roofPolygon: drawn('FRONT', HIP).roofs[0] } })] })
    expect(gable.records[0].code).toBe('HIP_ROOF')
  })
  it('the sketches propose it: one SET_ROOF HIP from a side along the ridge on a gable model; on the hip model nothing (a hip end\'s triangle is not a gable)', () => {
    const g = modelOf(gableSpec)
    const fromGable = roofProposalsFromSketches(sketches(HIP), g, SIDES.map(viewOf), modelRevision(g), sideOf)
    expect(fromGable.proposals).toHaveLength(1)
    expect(fromGable.proposals[0].patch?.roofKind).toBe('HIP')
    expect(['FRONT', 'REAR']).toContain(fromGable.proposals[0].patch?.side)
    const out = executeCorrections({ model: g, views: SIDES.map(viewOf), pictures: pictures(HIP), proposals: fromGable.proposals })
    expect(out.records[0].status).toBe('COMMITTED')
    const again = roofProposalsFromSketches(sketches(HIP), out.model, SIDES.map(viewOf), modelRevision(out.model), sideOf)
    expect(again.proposals).toEqual([])
  })
  it('a turn is evidenced only by views on both axes: opposite sides that disagree on a height are read as labelled, never turned', () => {
    // front and rear read the wall top 0.5 m apart (two ground rows): turned onto the 8 m side the same two readings shrink
    // under the tolerance in metres — the artefact that turned a garage's sides
    const m = modelOf(gableSpec)
    const apart = sketches({ ...GABLE, wallDrawn: { FRONT: 3.11, REAR: 2.6 } }, ['FRONT', 'REAR'])
    const o = orientationOf(apart, m, sideOf)
    expect(o.perBody?.[0].agreesLabelled).toBe(false)
    expect(o.perBody?.[0].agreesTurned).toBeNull()
    expect(o.assignment).toBe('AS_LABELLED')
    expect(o.confirmed).toEqual([])
  })
  it('which quarter turn: the plan\'s main entrance decides the end the front elevation draws; unmarked, the first turn is a named convention', () => {
    // each drawing carries the label of the side a quarter turn before it: labelled FRONT is the drawing of the 8 m end
    const turnedLabels = SIDES.map((s) => ({ ...sketches(GABLE, [({ FRONT: 'RIGHT', RIGHT: 'REAR', REAR: 'LEFT', LEFT: 'FRONT' } as Record<Side, Side>)[s]])[0], facade: s, frameId: frameOf(s) }))
    const m = modelOf(gableSpec)
    const plain = orientationOf(turnedLabels, m, sideOf)
    expect(plain.assignment).toBe('TURNED_90')
    expect(plain.turn).toBe('FRONT_ON_RIGHT')
    expect(plain.why).toMatch(/convention/)
    const left = orientationOf(turnedLabels, m, sideOf, { entranceSide: 'LEFT' })
    expect(left.assignment).toBe('TURNED_90')
    expect(left.turn).toBe('FRONT_ON_LEFT')
    expect(left.sideOf?.[frameOf('FRONT')]).toBe('LEFT')
    expect(left.sideOf?.[frameOf('RIGHT')]).toBe('FRONT')
    expect(orientationOf(turnedLabels, m, sideOf, { entranceSide: 'RIGHT' }).sideOf?.[frameOf('FRONT')]).toBe('RIGHT')
    // counter-trials: an entrance marked where neither turn puts the front decides nothing; and the hint never turns
    // elevations whose heights agree as labelled
    const odd = orientationOf(turnedLabels, m, sideOf, { entranceSide: 'REAR' })
    expect(odd.turn).toBe('FRONT_ON_RIGHT')
    expect(odd.why).toMatch(/neither quarter turn/)
    expect(orientationOf(sketches(GABLE), m, sideOf, { entranceSide: 'LEFT' }).assignment).toBe('AS_LABELLED')
  })
  it('a body built from elevations drawn a quarter turn from the plan is built in THEIR frame: the entrance side is the model\'s front, every elevation read as labelled', () => {
    // the plan: 12 (x) by 8 (z), ridge along x; the elevation the publisher calls FRONT draws the plan's LEFT end (8 m)
    const back: Record<Side, Side> = { FRONT: 'LEFT', LEFT: 'REAR', REAR: 'RIGHT', RIGHT: 'FRONT' }
    const labelled = SIDES.map((s) => ({ ...silhouettes(GABLE, [back[s]])[0], side: s, frameId: frameOf(s), observationId: `sk-${s}` }))
    const empty = createEmptyModel('m-turn', 'controlled')
    const run = (entranceSide?: Side) => executeCorrections({ model: empty, views: [], pictures: [], proposals: [propose(empty, { operation: 'BUILD_MASSING' })], massing: { outline: OUTLINE, silhouettes: labelled, ...(entranceSide ? { entranceSide } : {}) } })
    const left = run('LEFT')
    expect(left.records[0].status).toBe('COMMITTED')
    const hyp = (left.records[0].massing as { hypothesis: { planFront?: Side; views: Array<{ side: Side; frameId: string }>; alternatives: string[] } }).hypothesis
    expect(hyp.planFront).toBe('LEFT')
    // the views keep the sides their captions name: no turned mapping is carried on
    expect(hyp.views.map((v) => [v.frameId, v.side])).toEqual(SIDES.map((s) => [frameOf(s), s]))
    const b = bodiesOf(left.model)[0]
    expect([b.rect.maxX - b.rect.minX, b.rect.maxZ - b.rect.minZ].map((v) => Math.round(v))).toEqual([8, 12])
    expect(left.model.roofs[0].ridgeAxis).toBe('Z')
    const sk = SIDES.map((s) => ({ ...sketches(GABLE, [back[s]])[0], facade: s, frameId: frameOf(s) }))
    expect(orientationOf(sk, left.model, sideOf).assignment).toBe('AS_LABELLED')
    // unmarked, the first turn is a convention and is named so
    const plain = run()
    const hp = (plain.records[0].massing as { hypothesis: { planFront?: Side; alternatives: string[] } }).hypothesis
    expect(hp.planFront).toBe('RIGHT')
    expect(hp.alternatives.join(' ')).toMatch(/convention/)
    // counter-trial: elevations drawn as the plan labels them leave the body in the plan's frame
    const straight = executeCorrections({ model: empty, views: [], pictures: [], proposals: [propose(empty, { operation: 'BUILD_MASSING' })], massing: { outline: OUTLINE, silhouettes: silhouettes(GABLE), entranceSide: 'LEFT' } })
    expect((straight.records[0].massing as { hypothesis: { planFront?: Side } }).hypothesis.planFront).toBeUndefined()
    const sb = bodiesOf(straight.model)[0]
    expect([sb.rect.maxX - sb.rect.minX, sb.rect.maxZ - sb.rect.minZ].map((v) => Math.round(v))).toEqual([12, 8])
  })
  it('the quarter turn of an outline is rigid, never a mirror: its signed area keeps its sign, and the sheet\'s foot lands on the right hand of its left side', () => {
    const L = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 4 }, { x: 6, z: 4 }, { x: 6, z: 8 }, { x: 0, z: 8 }]
    const signed = (o: Array<{ x: number; z: number }>): number => o.reduce((a, p, i) => a + p.x * o[(i + 1) % o.length].z - o[(i + 1) % o.length].x * p.z, 0) / 2
    for (const front of ['LEFT', 'RIGHT', 'REAR'] as Side[]) expect(signed(outlineWithFront(L, front))).toBeCloseTo(signed(L), 6)
    // the notch stands at the sheet's head-right corner (x 6..10, z 4..8): facing the sheet's LEFT side it is far and to the left
    const t = outlineWithFront(L, 'LEFT')
    expect(Math.max(...t.map((p) => p.z))).toBe(10)
    // (far-left corner cut away, far-right corner kept; a mirror would cut the far-right one)
    expect(t.some((p) => p.x === 0 && p.z === 10)).toBe(false)
    expect(t.some((p) => p.x === 8 && p.z === 10)).toBe(true)
    expect(t.some((p) => p.x === 4 && p.z === 10)).toBe(true)
  })
  it('the registry offers it', () => {
    expect(capabilityPrompt()).toMatch(/roofKind \(GABLE, HIP or FLAT\)/)
  })
})
