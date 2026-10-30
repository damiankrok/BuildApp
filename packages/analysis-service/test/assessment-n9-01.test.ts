/**
 * N9-01: the three-axis model assessment, on synthetic cases whose truth is known by construction. Each case breaks one
 * relation and leaves the others as they were; no house of the corpus is named and no threshold is fitted to one.
 *
 *   the synthetic plan of a storey is DRAWN from a model's own walls (bands in ink, openings as gaps with a thin
 *   glazing line, a pale watermark, dimension and furniture lines), so the model it was drawn from is true by
 *   construction, and each case then changes the drawing or the model in one place.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseModel } from '@buildapp/model'
import type { CanonicalBuildingModel, RoofPlane } from '@buildapp/model'
import { compileBuilding, geometryClosureAudit } from '@buildapp/geometry'
import type { Raster } from '@buildapp/source-cv'
import type { SourceViewResidual, ViewAuditRecord } from '@buildapp/reconstruction'
import { combineStatus, elevationRelation, planRelations, roofLayersRelation, sourceUncheckedOf, technicalValidityOf } from '../src/index.js'
import type { PlanSheetInput } from '../src/index.js'
import { bandQuad, wallAxes } from '../src/assessment/plan-geometry.js'

const root = join(__dirname, '..', '..', '..')
const demo = (): CanonicalBuildingModel => parseModel(readFileSync(join(root, 'packages/model/test/fixtures/demo-house-1.7.0.json'), 'utf8'))

// --- a synthetic plan sheet --------------------------------------------------

const MPP = 0.02
const W = 1100
const H = 700
const toPixel = (x: number, z: number, shift = 0): { x: number; y: number } => ({ x: 120 + (x + shift) / MPP, y: 60 + (10 - z) / MPP })

function blank(): Raster {
  const data = new Uint8ClampedArray(W * H * 4).fill(255)
  return { width: W, height: H, data }
}
function paint(r: Raster, x: number, y: number, v: number): void {
  const xi = Math.round(x)
  const yi = Math.round(y)
  if (xi < 0 || yi < 0 || xi >= r.width || yi >= r.height) return
  const o = (yi * r.width + xi) * 4
  r.data[o] = v
  r.data[o + 1] = v
  r.data[o + 2] = v
}
function fillQuad(r: Raster, quad: Array<{ x: number; z: number }>, v: number): void {
  const p = quad.map((q) => toPixel(q.x, q.z))
  const xs = p.map((a) => a.x)
  const ys = p.map((a) => a.y)
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y += 1) {
    for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x += 1) {
      let inside = false
      for (let i = 0, j = p.length - 1; i < p.length; j = i, i += 1) if (p[i].y > y !== p[j].y > y && x < ((p[j].x - p[i].x) * (y - p[i].y)) / (p[j].y - p[i].y) + p[i].x) inside = !inside
      if (inside) paint(r, x, y, v)
    }
  }
}
function line(r: Raster, a: { x: number; z: number }, b: { x: number; z: number }, v: number): void {
  const pa = toPixel(a.x, a.z)
  const pb = toPixel(b.x, b.z)
  const n = Math.ceil(Math.hypot(pb.x - pa.x, pb.y - pa.y))
  for (let i = 0; i <= n; i += 1) paint(r, pa.x + ((pb.x - pa.x) * i) / n, pa.y + ((pb.y - pa.y) * i) / n, v)
}

/** Draw the plan of one level the way a published plan is drawn, from a model's walls and openings. */
function drawPlan(model: CanonicalBuildingModel, levelId: string, opts: { skipWalls?: string[]; erase?: Array<{ wallId: string; from: number; to: number }>; thinWalls?: string[] } = {}): Raster {
  const r = blank()
  // a pale watermark across the sheet
  for (let y = 200; y < 420; y += 1) for (let x = 100; x < 1000; x += 1) paint(r, x, y, 236)
  for (const w of model.walls.filter((x) => x.levelId === levelId && !(opts.skipWalls ?? []).includes(x.id))) {
    if ((opts.thinWalls ?? []).includes(w.id)) {
      // a glazed wall: two thin lines, no band
      const { n } = wallAxes(w)
      line(r, w.start, w.end, 60)
      line(r, { x: w.start.x + n.x * w.thickness, z: w.start.z + n.z * w.thickness }, { x: w.end.x + n.x * w.thickness, z: w.end.z + n.z * w.thickness }, 60)
      continue
    }
    fillQuad(r, bandQuad(w), 25)
    const { u, n } = wallAxes(w)
    const gaps = [...model.openings.filter((o) => o.wallId === w.id).map((o) => [o.offset, o.offset + o.width, true] as const), ...(opts.erase ?? []).filter((e) => e.wallId === w.id).map((e) => [e.from, e.to, false] as const)]
    for (const [a0, a1, glazed] of gaps) {
      const q = [
        { x: w.start.x + u.x * a0 - n.x * 0.02, z: w.start.z + u.z * a0 - n.z * 0.02 },
        { x: w.start.x + u.x * a1 - n.x * 0.02, z: w.start.z + u.z * a1 - n.z * 0.02 },
        { x: w.start.x + u.x * a1 + n.x * (w.thickness + 0.02), z: w.start.z + u.z * a1 + n.z * (w.thickness + 0.02) },
        { x: w.start.x + u.x * a0 + n.x * (w.thickness + 0.02), z: w.start.z + u.z * a0 + n.z * (w.thickness + 0.02) },
      ]
      fillQuad(r, q, 255)
      // a window's glazing line along the middle of the gap; an erased stretch is open paper
      if (glazed) line(r, { x: w.start.x + u.x * a0 + n.x * (w.thickness / 2), z: w.start.z + u.z * a0 + n.z * (w.thickness / 2) }, { x: w.start.x + u.x * a1 + n.x * (w.thickness / 2), z: w.start.z + u.z * a1 + n.z * (w.thickness / 2) }, 90)
    }
  }
  // dimension lines outside, furniture inside: thin strokes
  line(r, { x: 0, z: -1.2 }, { x: 15, z: -1.2 }, 40)
  line(r, { x: 2, z: 5 }, { x: 4, z: 5 }, 70)
  line(r, { x: 2, z: 5 }, { x: 2, z: 6.5 }, 70)
  return r
}

const sheet = (storeyIndex: number, raster: Raster, shift = 0): PlanSheetInput => ({ frameId: `plan-${storeyIndex}`, assetId: `asset-${storeyIndex}`, storeyIndex, mppX: MPP, mppY: MPP, wallPx: 0.3 / MPP / 2, toPixel: (x, z) => toPixel(x, z, shift), raster })

const r3Of = (rel: ReturnType<typeof planRelations>['r3'], wallId: string) => rel.items.find((i) => i.objects.includes(wallId))

describe('R3/R4 on a plan drawn from the model itself', () => {
  const m = demo()
  const rel = planRelations(m, [sheet(0, drawPlan(m, 'ground')), sheet(1, drawPlan(m, 'upper'))])

  it('every wall stands on the drawn wall, through watermark, dimension and furniture lines: PASS', () => {
    expect(rel.r3.items.filter((i) => i.status !== 'PASS')).toEqual([])
    expect(rel.r3.status).toBe('PASS')
    expect(rel.storeys.every((s) => s.ink.corroborated)).toBe(true)
  })

  it('each storey’s drawn walls lie within the modelled storey: PASS, nothing drawn outside', () => {
    expect(rel.r4.items.map((i) => [i.objects[0], i.status, i.code])).toEqual([
      ['storey 0', 'PASS', 'OUTLINE_WITHIN_TOLERANCE'],
      ['storey 1', 'PASS', 'OUTLINE_WITHIN_TOLERANCE'],
    ])
  })
})

describe('R3: one wall the drawing does not have', () => {
  it('a wall over blank paper (the garage’s contact drawn open) is a CONFLICT naming that wall, and only that wall', () => {
    const m = demo()
    // the drawing leaves the house’s right wall open along the garage (z 0..6): the model still closes it
    const rel = planRelations(m, [sheet(0, drawPlan(m, 'ground', { erase: [{ wallId: 'g-right', from: 0, to: 6.2 }] }))])
    const item = r3Of(rel.r3, 'g-right')
    expect(item?.status).toBe('CONFLICT')
    expect(item?.code).toBe('WALL_ON_BLANK_PAPER')
    expect(Number(item?.measured.blankM)).toBeGreaterThan(4)
    expect(rel.r3.items.filter((i) => i.status === 'CONFLICT').flatMap((i) => i.objects)).toEqual(['g-right'])
  })

  it('a whole wall missing from the drawing is a CONFLICT', () => {
    const m = demo()
    const rel = planRelations(m, [sheet(0, drawPlan(m, 'ground', { skipWalls: ['gar-rear'] }))])
    expect(r3Of(rel.r3, 'gar-rear')?.code).toBe('WALL_ON_BLANK_PAPER')
  })

  it('a drawn door gap the model does not open is named as an opening question, never a wall conflict', () => {
    const drawn = demo()
    const m = demo()
    m.openings = m.openings.filter((o) => o.id !== 'op-gf-1')
    const rel = planRelations(m, [sheet(0, drawPlan(drawn, 'ground'))])
    const item = r3Of(rel.r3, 'g-front')
    expect(item?.status).toBe('PASS')
    expect(rel.r3.counts.CONFLICT).toBe(0)
    expect(item?.why).toContain('g-front: 1.')
  })

  it('a wall drawn with thin lines only (glazing) is UNCHECKED, not CONFLICT', () => {
    const m = demo()
    const rel = planRelations(m, [sheet(0, drawPlan(m, 'ground', { thinWalls: ['gar-right'] }))])
    const item = r3Of(rel.r3, 'gar-right')
    expect(item?.status).toBe('UNCHECKED')
    expect(item?.code).toBe('THIN_LINES_ONLY')
    expect(rel.r3.status).toBe('UNCHECKED')
  })

  it('a frame that does not fit the model (shifted 1.5 m) is UNCHECKED for every wall and the outline, never CONFLICT', () => {
    const m = demo()
    const rel = planRelations(m, [sheet(0, drawPlan(m, 'ground'), 1.5)])
    expect(rel.r3.counts.CONFLICT).toBe(0)
    expect(rel.r4.counts.CONFLICT).toBe(0)
    expect(rel.r3.items.map((i) => i.code)).toEqual(['REGISTRATION_NOT_CORROBORATED', 'NO_REGISTERED_PLAN'])
    expect(rel.r4.items[0].code).toBe('REGISTRATION_NOT_CORROBORATED')
  })
})

describe('R4: the drawn storey against the modelled one', () => {
  it('a drawn wing the model does not build is a CONFLICT with its distance', () => {
    const drawn = demo()
    // the sheet draws a 4 m deep wing behind the garage; the model stops at the garage
    drawn.walls.push(
      { ...drawn.walls.find((w) => w.id === 'gar-right')!, id: 'x-1', start: { x: 15, z: 6 }, end: { x: 15, z: 10 } },
      { ...drawn.walls.find((w) => w.id === 'gar-right')!, id: 'x-2', start: { x: 15, z: 10 }, end: { x: 10, z: 10 } },
    )
    const m = demo()
    const rel = planRelations(m, [sheet(0, drawPlan(drawn, 'ground'))])
    const item = rel.r4.items[0]
    expect(item.status).toBe('CONFLICT')
    expect(item.code).toBe('DRAWN_WALLS_BEYOND_STOREY')
    expect(Number(item.measured.maxDrawnOutsideM)).toBeGreaterThan(3)
    expect(Number(item.measured.maxDrawnOutsideM)).toBeLessThan(4.5)
    // R3 has nothing against the model's own walls
    expect(rel.r3.counts.CONFLICT).toBe(0)
  })

  it('a registered upper plan with walls the model does not build is a missing storey: CONFLICT, never PASS', () => {
    const drawn = demo()
    const m = demo()
    m.walls = m.walls.filter((w) => w.levelId !== 'upper')
    m.openings = m.openings.filter((o) => m.walls.some((w) => w.id === o.wallId))
    const rel = planRelations(m, [sheet(0, drawPlan(drawn, 'ground')), sheet(1, drawPlan(drawn, 'upper'))])
    const item = rel.r4.items.find((i) => i.objects[0] === 'storey 1')
    expect(item?.status).toBe('CONFLICT')
    expect(item?.code).toBe('STOREY_DRAWN_NOT_MODELLED')
    expect(rel.r4.items.find((i) => i.objects[0] === 'storey 0')?.status).toBe('PASS')
  })

  it('a blank upper sheet with no modelled walls is UNCHECKED, not PASS', () => {
    const m = demo()
    m.walls = m.walls.filter((w) => w.levelId !== 'upper')
    m.openings = m.openings.filter((o) => m.walls.some((w) => w.id === o.wallId))
    const rel = planRelations(m, [sheet(0, drawPlan(m, 'ground')), sheet(1, blank())])
    expect(rel.r4.items.find((i) => i.objects[0] === 'storey 1')?.status).toBe('UNCHECKED')
  })

  it('a modelled storey with no registered plan is UNCHECKED and named', () => {
    const m = demo()
    const rel = planRelations(m, [sheet(0, drawPlan(m, 'ground'))])
    expect(rel.r3.items.find((i) => i.code === 'NO_REGISTERED_PLAN')?.objects).toEqual(['upper'])
    expect(rel.r3.status).toBe('UNCHECKED')
  })
})

// --- R1 -------------------------------------------------------------------------

const plane = (id: string, levelId: string, boundary: Array<{ x: number; z: number }>, y: number, pitchDeg = 0): RoofPlane => ({ id, levelId, boundary, datum: { x: boundary[0].x, y, z: boundary[0].z }, pitchDeg, downslope: { x: 0, z: -1 }, thickness: 0.2 })
const r1 = (m: CanonicalBuildingModel) => roofLayersRelation(m, compileBuilding(m))

describe('R1: a roof inside a roof, and the legal double layers', () => {
  it('the demo house (a garage roof under the main roof’s overhang) has one layer: PASS', () => {
    expect(r1(demo()).status).toBe('PASS')
  })

  it('a plate standing inside the upper storey under the main gable is a CONFLICT naming both plates', () => {
    const m = demo()
    m.roofPlanes.push(plane('inner-plate', 'upper', [{ x: 2, z: 2 }, { x: 6, z: 2 }, { x: 6, z: 5 }, { x: 2, z: 5 }], 6.4))
    const r = r1(m)
    const item = r.items.find((i) => i.status === 'CONFLICT')
    expect(r.status).toBe('CONFLICT')
    expect(item?.code).toBe('ROOF_INSIDE_ROOF')
    expect(item?.objects).toEqual(['roof-main', 'inner-plate'])
    expect(Number(item?.measured.doubleRoofM2)).toBeGreaterThan(8)
  })

  it('a porch roof under a deep overhang, outside the walls, is LAYERED and legal: PASS', () => {
    const m = demo()
    const main = m.roofs.find((x) => x.id === 'roof-main')!
    main.overhang = 1.2
    m.roofPlanes.push(plane('porch', 'ground', [{ x: 2, z: -1.4 }, { x: 8, z: -1.4 }, { x: 8, z: -0.05 }, { x: 2, z: -0.05 }], 2.7))
    const r = r1(m)
    expect(r.status).toBe('PASS')
    const porch = r.items.find((i) => i.objects.includes('porch'))
    expect(porch?.code).toBe('LAYERED_OUTSIDE_WALLS')
    expect(Number(porch?.measured.layeredM2)).toBeGreaterThan(3)
  })

  it('a lower wing roof beside the upper storey, under its eaves, is not a conflict', () => {
    const m = demo()
    m.roofPlanes.push(plane('wing', 'ground', [{ x: 10.05, z: 6.2 }, { x: 14, z: 6.2 }, { x: 14, z: 9 }, { x: 10.05, z: 9 }], 2.9))
    expect(r1(m).counts.CONFLICT).toBe(0)
  })
})

// --- R5 -------------------------------------------------------------------------

const view = (frameId: string, use: ViewAuditRecord['use'], side: ViewAuditRecord['side'] = 'FRONT'): ViewAuditRecord => ({ frameId, assetId: `a-${frameId}`, document: 'ELEVATION', projection: 'ORTHOGRAPHIC_ELEVATION', labelledView: side ?? 'FRONT', sizePx: { width: 800, height: 400 }, use, ...(side ? { side } : {}), mpp: 0.02, why: use === 'NOT_REGISTERED' ? 'no ridge datum' : 'registered', lost: use === 'NOT_REGISTERED' ? ['the facade’s openings and silhouette'] : [] })
const res = (frameId: string, featureId: string, within: boolean, residualM: number, why = 'edge'): SourceViewResidual => ({ featureId, objectId: featureId, frameId, kind: 'OPENING_HEAD', modelM: 2, observedM: 2 - residualM, residualM, toleranceM: 0.15, withinTolerance: within, why })
const emptyAlign = { views: [], readings: [], rejected: [], comparisons: [], corrections: [], unregistered: [], counts: {} as never, statusCounts: {} as never }

describe('R5: registered elevations', () => {
  const m = demo()
  const run = (residuals: SourceViewResidual[], views: ViewAuditRecord[]) =>
    elevationRelation({ model: m, viewAudit: views, residuals, crossView: { views: views.filter((v) => v.use === 'REGISTERED').map((v) => ({ frameId: v.frameId, side: v.side ?? 'FRONT', checks: 0, withinTolerance: 0, kinds: [], verdict: 'UNCHECKED' as const })), reconciliation: { iterations: 0, applied: 0, refused: 0, converged: true, residualsBefore: 0, residualsAfter: 0 } }, facadeAlignment: emptyAlign, openings: m.openings.map((o) => ({ id: o.id, facade: 'FRONT' })) })

  it('a registered view whose observed checks disagree on several features is a CONFLICT, whatever the completeness verdict', () => {
    const r = run([res('e1', 'op-gf-1', false, 0.6), res('e1', 'op-gf-2', false, -0.5), res('e1', 'op-entrance', true, 0.02), res('e1', 'op-uf-1', false, 0.4)], [view('e1', 'REGISTERED')])
    expect(r.status).toBe('CONFLICT')
    expect(r.items[0].code).toBe('ELEVATION_DISAGREES')
    expect(r.items[0].objects).toEqual(['op-gf-1', 'op-gf-2', 'op-uf-1'])
  })

  it('agreement is PASS but says it is model-anchored; a single disagreement is not a stable conflict', () => {
    const agree = run([res('e1', 'op-gf-1', true, 0.02), res('e1', 'op-gf-2', true, -0.01)], [view('e1', 'REGISTERED')])
    expect(agree.items[0].status).toBe('PASS')
    expect(agree.items[0].evidence[0]).toContain('MODEL_ANCHORED')
    const one = run([res('e1', 'op-gf-1', false, 0.6), res('e1', 'op-gf-2', true, 0.01)], [view('e1', 'REGISTERED')])
    expect(one.items[0].status).toBe('UNCHECKED')
    expect(one.items[0].code).toBe('DISAGREEMENT_NOT_STABLE')
  })

  it('“not observed” is not a disagreement, and a check on an object the model does not contain is not counted', () => {
    const r = run([res('e1', 'op-gf-1', false, 0, 'no image edge within reach — not observed'), res('e1', 'gone', false, 0.9), res('e1', 'gone-too', false, 0.8)], [view('e1', 'REGISTERED')])
    expect(r.items[0].status).toBe('UNCHECKED')
    expect(r.items[0].code).toBe('NOTHING_OBSERVED')
    expect(r.items[0].measured.notEmitted).toBe(2)
  })

  it('an unregistered view is UNCHECKED (never PASS, never a default CONFLICT) and enters the unchecked budget', () => {
    const r = run([], [view('e2', 'NOT_REGISTERED', 'REAR')])
    expect(r.items[0].status).toBe('UNCHECKED')
    expect(r.items[0].code).toBe('VIEW_NOT_REGISTERED')
    const budget = sourceUncheckedOf({ frames: [{ id: 'e2', assetId: 'a-e2', variantByteHash: '0'.repeat(64), size: { width: 800, height: 400 }, roles: { document: 'ELEVATION', storey: 'NONE', annotation: 'NONE', view: 'REAR', projection: 'ORTHOGRAPHIC_ELEVATION' } }], viewAudit: [view('e2', 'NOT_REGISTERED', 'REAR')], registeredPlans: [], skippedPlans: [], heightsMeasured: false, relations: [r] })
    expect(budget.items).toHaveLength(1)
    expect(budget.items[0]).toMatchObject({ kind: 'ELEVATION', frameId: 'e2', extent: 'NONE', axes: { along: 'NONE', height: 'NONE' } })
  })
})

// --- technical validity --------------------------------------------------------------

describe('technical validity is about the model alone', () => {
  const tech = (m: CanonicalBuildingModel) => {
    const scene = compileBuilding(m)
    return technicalValidityOf({ model: m, scene, closure: geometryClosureAudit(m, scene), refusals: [], replay: 'BYTE_IDENTICAL' })
  }

  it('the demo house is VALID, and says that is not agreement with the drawings', () => {
    const t = tech(demo())
    expect(t.status).toBe('VALID')
    expect(t.note).toContain('not agreement with the drawings')
  })

  it('a scene with a compiler ERROR is ERRORS, named under COMPILER; a warning stays a warning', () => {
    const m = demo()
    const t = technicalValidityOf({ model: m, scene: { diagnostics: [{ code: 'OPENING_ABOVE_WALL_TOP', severity: 'ERROR', message: 'not cut', objectId: 'op-gf-1' }, { code: 'FILL_WITHOUT_OPENING', severity: 'WARNING', message: 'skipped' }] }, closure: { findings: [{ code: 'GAP', severity: 'WARNING', scope: 'EXTERIOR', objects: ['g-front', 'g-left'], measure: 0.01, unit: 'm', message: 'gap' }] }, refusals: [], replay: 'BYTE_IDENTICAL' })
    expect(t.status).toBe('ERRORS')
    expect(t.errors).toBe(1)
    expect(t.warnings).toBe(2)
    expect(t.checks.find((c) => c.check === 'COMPILER')?.findings[0]).toMatchObject({ code: 'OPENING_ABOVE_WALL_TOP', severity: 'ERROR', objectId: 'op-gf-1' })
    expect(t.checks.find((c) => c.check === 'CLOSURE')).toMatchObject({ errors: 0, warnings: 1 })
  })

  it('an invalid model is ERRORS under MODEL_VALIDATION and COMPILER', () => {
    const m = demo()
    const o = m.openings.find((x) => x.id === 'op-gf-1')!
    o.sill = 2.2
    o.height = 1.5
    const t = tech(m)
    expect(t.status).toBe('ERRORS')
    expect(t.checks.find((c) => c.check === 'MODEL_VALIDATION')?.errors).toBeGreaterThan(0)
  })

  it('the two 005T owner scenes carry their 8 and 1 compiler errors into the technical axis (geometry unchanged)', () => {
    for (const [file, errors] of [['gozdzikowce-005t-visual.model.json', 1], ['jarzmianki-005t-visual.model.json', 8]] as const) {
      const text = readFileSync(join(root, 'packages/candidates/src/owner-005t', file), 'utf8')
      const t = tech(parseModel(text))
      const compiler = t.checks.find((c) => c.check === 'COMPILER')
      expect([file, compiler?.errors, compiler?.findings.every((f) => f.code === 'OPENING_ABOVE_WALL_TOP' || f.severity !== 'ERROR')]).toEqual([file, errors, true])
      expect(t.status).toBe('ERRORS')
    }
  })

  it('a CONFLICT on the source axis does not touch the technical one, and vice versa', () => {
    const m = demo()
    m.roofPlanes.push(plane('inner-plate', 'upper', [{ x: 2, z: 2 }, { x: 6, z: 2 }, { x: 6, z: 5 }, { x: 2, z: 5 }], 6.4))
    expect(r1(m).status).toBe('CONFLICT')
    expect(combineStatus([{ status: 'PASS' }, { status: 'UNCHECKED' }])).toBe('UNCHECKED')
  })
})
