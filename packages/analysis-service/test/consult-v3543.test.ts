import { describe, expect, it } from 'vitest'
import { bindRoofFeature, compareGeometry, reviewOutcome, roofFeatureId } from '../src/consult/geometry.js'
import type { CheckPicture, GeometryState } from '../src/consult/geometry.js'
import { compareRuns, outlineOf, outlineTolerancePx, scaleContradictionOf } from '../src/consult/consult-analysis.js'
import type { RoundRecord, RunState } from '../src/consult/consult-analysis.js'
import type { ProposedCorrection } from '../src/consult/contract.js'

// v3.54.3: the decisions of the correction loop, on hand-made inputs (no project's data, no network, no model).
const PICTURES: CheckPicture[] = [
  { n: 1, what: 'PLAN', frameId: 'f-plan', projection: 'ORTHOGRAPHIC_PLAN', width: 550, height: 550, label: 'plan' },
  { n: 2, what: 'ELEVATION', frameId: 'f-front', projection: 'ORTHOGRAPHIC_ELEVATION', width: 1280, height: 770, label: 'elevation' },
  { n: 3, what: 'ELEVATION', frameId: 'f-persp', projection: 'PERSPECTIVE', width: 1280, height: 770, label: 'a perspective captioned as an elevation' },
  { n: 4, what: 'MODEL_VIEWS', width: 1680, height: 400, label: 'SIDES' },
]
const P = (over: Partial<ProposedCorrection> = {}, feature: Partial<NonNullable<ProposedCorrection['feature']>> = {}): ProposedCorrection => ({
  proposalId: 'q1',
  baseRevision: 'rev1',
  operation: 'ROOF_FEATURE',
  targetId: 'front roof',
  proposed: { literal: 'a gable dormer over the entrance', unit: 'unknown' },
  feature: { kind: 'GABLE_DORMER', modelSide: 'FRONT', picture: 2, facade: { leftX: 320, rightX: 1090, eavesY: 505, ridgeY: 172 }, box: { x0: 590, y0: 268, x1: 825, y1: 400 }, front: 'FLUSH_WITH_FACADE', glazed: true, mirrored: false, ...feature },
  evidence: [{ sourceId: 'picture 2' }],
  justification: 'the front elevation shows a gabled dormer above the door; the model roof is plain',
  alternatives: [],
  uncertainty: 'LOW',
  expectedEffect: 'a dormer on the front slope',
  ...over,
})
const ctx = (over: Partial<Parameters<typeof bindRoofFeature>[1]> = {}): Parameters<typeof bindRoofFeature>[1] => ({ revision: 'rev1', pictures: PICTURES, registeredSides: new Map(), present: new Set(), seen: new Set(), ...over })

describe('v3.54.3 binding: a proposal in picture pixels becomes shares of the side, with an id of the analyzer\'s', () => {
  it('binds a dormer: shares of the facade and of the rise, a stable id, FLUSH kept', () => {
    const r = bindRoofFeature(P(), ctx())
    expect(r.verdict.status).toBe('ACCEPTED')
    expect(r.correction).toMatchObject({ id: 'dormer-front-c50', kind: 'GABLE_DORMER', side: 'FRONT', front: 'FLUSH', glazed: true })
    expect(r.correction?.fromShare).toBeCloseTo((590 - 320) / 770, 3)
    expect(r.correction?.toShare).toBeCloseTo((825 - 320) / 770, 3)
    expect(r.correction?.eaveShare).toBeCloseTo((505 - 400) / 333, 3)
    expect(r.correction?.ridgeShare).toBeCloseTo((505 - 268) / 333, 3)
  })
  it('the id is the place, not the proposal: the same feature proposed again in other words has the same id', () => {
    expect(roofFeatureId('FRONT', 0.35, 0.655)).toBe('dormer-front-c50')
    expect(roofFeatureId('FRONT', 0.36, 0.66)).toBe('dormer-front-c50')
    const again = bindRoofFeature(P({ proposalId: 'q2' }), ctx({ present: new Set(['dormer-front-c50']) }))
    expect(again.verdict).toMatchObject({ status: 'REJECTED', code: 'ALREADY_PRESENT' })
  })
  it('a mirrored drawing is read the other way along the side', () => {
    const r = bindRoofFeature(P({}, { mirrored: true, box: { x0: 400, y0: 268, x1: 500, y1: 400 } }), ctx())
    expect(r.correction?.fromShare).toBeCloseTo(1 - (500 - 320) / 770, 3)
    expect(r.correction?.toShare).toBeCloseTo(1 - (400 - 320) / 770, 3)
  })
  it('counter-trials: stale revision, a repeated id, a picture that is no orthographic elevation, pixels off the picture', () => {
    expect(bindRoofFeature(P({ baseRevision: 'rev0' }), ctx()).verdict).toMatchObject({ status: 'REJECTED', code: 'STALE_REVISION' })
    const seen = new Set<string>()
    bindRoofFeature(P(), ctx({ seen }))
    expect(bindRoofFeature(P(), ctx({ seen })).verdict).toMatchObject({ status: 'REJECTED', code: 'DUPLICATE_PROPOSAL_ID' })
    // the model's own views and the plan are not what a feature is placed from
    expect(bindRoofFeature(P({}, { picture: 4 }), ctx()).verdict.code).toBe('NOT_AN_ELEVATION')
    expect(bindRoofFeature(P({}, { picture: 1 }), ctx()).verdict.code).toBe('NOT_AN_ELEVATION')
    // an ordinary gable seen in a perspective: shares of a perspective are not shares of a facade
    expect(bindRoofFeature(P({}, { picture: 3 }), ctx()).verdict.code).toBe('NOT_ORTHOGRAPHIC')
    expect(bindRoofFeature(P({}, { box: { x0: 590, y0: 268, x1: 2000, y1: 400 } }), ctx()).verdict.code).toBe('OUT_OF_PICTURE')
    // a feature below the eaves or beside the facade is not on this roof
    expect(bindRoofFeature(P({}, { box: { x0: 590, y0: 520, x1: 825, y1: 700 } }), ctx()).verdict.code).toBe('INCONSISTENT_GEOMETRY')
    expect(bindRoofFeature(P({}, { box: { x0: 100, y0: 268, x1: 250, y1: 400 } }), ctx()).verdict.code).toBe('INCONSISTENT_GEOMETRY')
    expect(bindRoofFeature(P({ feature: undefined }), ctx()).verdict.code).toBe('NO_FEATURE')
  })
  it('confidence is not evidence: a HIGH-uncertainty proposal is held, and a wrong feature is not passed by a LOW one', () => {
    expect(bindRoofFeature(P({ uncertainty: 'HIGH' }), ctx()).verdict).toMatchObject({ status: 'HELD', code: 'HIGH_UNCERTAINTY' })
    // LOW uncertainty does not carry a dormer onto a perspective, or a kind without a consumer into the model
    expect(bindRoofFeature(P({ uncertainty: 'LOW' }, { picture: 3 }), ctx()).correction).toBeUndefined()
    expect(bindRoofFeature(P({}, { kind: 'CROSS_GABLE' }), ctx()).verdict).toMatchObject({ status: 'CAPABILITY_MISSING', code: 'KIND_WITHOUT_CONSUMER' })
    expect(bindRoofFeature(P({}, { kind: 'CANOPY' }), ctx()).verdict.status).toBe('CAPABILITY_MISSING')
    expect(bindRoofFeature(P({ operation: 'OPENING', feature: undefined }), ctx()).verdict).toMatchObject({ status: 'CAPABILITY_MISSING', code: 'NO_CONSUMER' })
  })
  it('the analyzer\'s own registration of the picture is weighed: another side is a conflict, kept, not resolved by either', () => {
    const conflict = bindRoofFeature(P(), ctx({ registeredSides: new Map([['f-front', 'REAR']]) }))
    expect(conflict.verdict).toMatchObject({ status: 'HELD', code: 'VIEW_CONFLICT' })
    expect(conflict.correction).toBeUndefined()
    expect(bindRoofFeature(P(), ctx({ registeredSides: new Map([['f-front', 'FRONT']]) })).verdict.status).toBe('ACCEPTED')
  })
})

describe('v3.54.3 acceptance by the corrected property: a roof correction needs no better scale', () => {
  const state = (over: Partial<GeometryState> = {}): GeometryState => ({ modelHash: 'm0', protected: { levels: 'L', slabs: 'S', exteriorWalls: 'W', openings: 'O', rooms: 'R' }, interiorWalls: 9, roofFeatures: [], previewFailures: 0, ...over })
  const asked = [{ id: 'dormer-front-c50', proposalId: 'g1:q1', kind: 'GABLE_DORMER' as const, side: 'FRONT' as const, fromShare: 0.35, toShare: 0.65, eaveShare: 0.3, ridgeShare: 0.7, front: 'FLUSH' as const, glazed: true, why: '' }]
  const applied = [{ id: 'dormer-front-c50', proposalId: 'g1:q1', status: 'APPLIED' as const, why: 'built' }]
  it('accepts when the analyzer built the feature and everything it was not about is byte for byte the same', () => {
    const d = compareGeometry(state(), state({ modelHash: 'm1', roofFeatures: ['dormer-front-c50'] }), asked, applied)
    expect(d).toMatchObject({ decision: 'ACCEPT', applied: ['dormer-front-c50'] })
  })
  it('rolls back a candidate that also moved a wall, an opening or a slab, or cost the model an object', () => {
    for (const k of ['levels', 'slabs', 'exteriorWalls', 'openings', 'rooms'] as const) {
      const after = state({ modelHash: 'm1', roofFeatures: ['dormer-front-c50'], protected: { ...state().protected, [k]: 'changed' } })
      expect(compareGeometry(state(), after, asked, applied).decision).toBe('ROLLBACK')
    }
    expect(compareGeometry(state(), state({ modelHash: 'm1', roofFeatures: ['dormer-front-c50'], previewFailures: 1 }), asked, applied).decision).toBe('ROLLBACK')
    expect(compareGeometry(state({ roofFeatures: ['dormer-rear-c20'] }), state({ modelHash: 'm1', roofFeatures: ['dormer-front-c50'] }), asked, applied).decision).toBe('ROLLBACK')
  })
  it('a correction the analyzer refused changes nothing; a candidate that did not build rolls back', () => {
    const refused = [{ id: 'dormer-front-c50', proposalId: 'g1:q1', status: 'REFUSED' as const, code: 'GABLE_END_SIDE' as const, why: 'gable end' }]
    expect(compareGeometry(state(), state(), asked, refused)).toMatchObject({ decision: 'NO_CHANGE', refused: [{ id: 'dormer-front-c50', code: 'GABLE_END_SIDE' }] })
    expect(compareGeometry(state(), undefined, asked, undefined, 'RECONSTRUCTION_FAILED/X').decision).toBe('ROLLBACK')
    // "applied" by the solver but dropped by the model's validator (not in the model): not a gain
    expect(compareGeometry(state(), state({ modelHash: 'm1' }), asked, applied).decision).toBe('NO_CHANGE')
  })
  it('the review of the rebuilt revision: wrong kind or not in the source takes it out; a misplaced one stays the source\'s feature', () => {
    const r = reviewOutcome(['a', 'b', 'c', 'd'], [{ id: 'a', verdict: 'MATCHES', note: '' }, { id: 'b', verdict: 'SHOULD_NOT_EXIST', note: 'the drawing shows a roof window' }, { id: 'c', verdict: 'WRONG_PLACE', note: 'too far left' }])
    expect(r.map((x) => [x.id, x.keep, x.verdict])).toEqual([['a', true, 'MATCHES'], ['b', false, 'SHOULD_NOT_EXIST'], ['c', true, 'WRONG_PLACE'], ['d', true, 'NOT_REVIEWED']])
  })
})

describe('v3.54.3 outline against the dimension that frames it: the same object, axis and faces', () => {
  const local = (envelope: { x0: number; y0: number; x1: number; y1: number }, spans: Array<{ axis: 'X' | 'Y'; fromPx: number; toPx: number; valueCm: number; status?: string }>) =>
    ({ plans: { selectedPlanFrameId: 'f', plans: [{ frameId: 'f', envelope, wallPx: 10 }] }, metrics: { consultedSpans: spans.map((s, i) => ({ proposalId: `p${i}`, frameId: 'f', status: s.status ?? 'ADMITTED', why: '', lengthPx: s.toPx - s.fromPx, ...s })) } }) as unknown as Parameters<typeof outlineOf>[0]
  it('MATCHES within one wall; a part of the outline claims nothing about the whole', () => {
    const o = outlineOf(local({ x0: 32, y0: 168, x1: 873, y1: 743 }, [{ axis: 'X', fromPx: 32, toPx: 873, valueCm: 1402 }, { axis: 'Y', fromPx: 300, toPx: 500, valueCm: 333 }]))
    expect(o?.x.status).toBe('MATCHES')
    expect(o?.y.status).toBe('NOT_COMPARABLE')
    expect(outlineTolerancePx(10)).toBe(10)
    expect(outlineTolerancePx(1)).toBe(3)
  })
  it('inside the wall tolerance but off the ticks: still MATCHES for the decision, and the difference is stated in metres', () => {
    // half a wall in at each end (an outline on wall axes under a dimension to the outer faces)
    const o = outlineOf(local({ x0: 37, y0: 168, x1: 868, y1: 743 }, [{ axis: 'X', fromPx: 32, toPx: 873, valueCm: 1402 }]))
    expect(o?.x.status).toBe('MATCHES')
    expect(o?.x.offM).toBeCloseTo(((2 + 2) * 1402) / 841 / 100, 2)
    // at the ticks (within the raster's 3 px) nothing is stated
    expect(outlineOf(local({ x0: 34, y0: 168, x1: 871, y1: 743 }, [{ axis: 'X', fromPx: 32, toPx: 873, valueCm: 1402 }]))?.x.offM).toBeUndefined()
  })
  it('BEYOND: the outline holds what the overall dimension does not measure (a stoop taken in)', () => {
    const o = outlineOf(local({ x0: 32, y0: 168, x1: 873, y1: 837 }, [{ axis: 'Y', fromPx: 168, toPx: 743, valueCm: 957.58 }]))
    expect(o?.y.status).toBe('BEYOND')
    expect(o?.y.offM).toBeGreaterThan(1.4)
  })
  it('SHORT: of two framing dimensions the longest is the whole — a 0.9 m bay not built is a named lack, not a tolerance', () => {
    const o = outlineOf(local({ x0: 202, y0: 93, x1: 801, y1: 522 }, [{ axis: 'X', fromPx: 202, toPx: 801, valueCm: 1232 }, { axis: 'X', fromPx: 158, toPx: 801, valueCm: 1322 }, { axis: 'Y', fromPx: 93, toPx: 522, valueCm: 882 }]))
    expect(o?.x).toMatchObject({ status: 'SHORT', spanM: 13.22 })
    expect(o?.x.offM).toBeCloseTo(0.9, 1)
    expect(o?.y.status).toBe('MATCHES')
  })
  it('a refused dimension frames nothing', () => {
    expect(outlineOf(local({ x0: 0, y0: 0, x1: 100, y1: 100 }, [{ axis: 'X', fromPx: 0, toPx: 300, valueCm: 900, status: 'REFUSED' }]))).toBeUndefined()
  })
})

describe('v3.54.3 the metric transaction: outline in place of a share of the house', () => {
  const failed: RunState = { outcome: 'FAILED', code: 'RECONSTRUCTION_FAILED', reasonCode: 'X', metric: { relation: 'R', confidence: 'INCONCLUSIVE' } }
  const ax = (status: 'MATCHES' | 'SHORT' | 'BEYOND' | 'NOT_COMPARABLE') => ({ status, why: status })
  const built = (x: Parameters<typeof ax>[0], y: Parameters<typeof ax>[0], hash = 'm', confidence = 'SUPPORTED'): RunState => ({ outcome: 'COMPLETED', modelHash: hash, metric: { relation: 'R', confidence, cmPerPixelX: 1.6 }, outline: { x: ax(x), y: ax(y) } })
  it('a refusal that becomes a model running past its framing dimension is rolled back (the false acceptance of v3.54.2)', () => {
    const v = compareRuns(failed, built('MATCHES', 'BEYOND'))
    expect(v.decision).toBe('ROLLBACK')
    expect(v.why).toMatch(/^OUTLINE_BEYOND_DIMENSION/)
  })
  it('a model whose outline matches, or is SHORT of, its dimension is accepted: the lack is named in the result, not hidden by a threshold', () => {
    expect(compareRuns(failed, built('MATCHES', 'MATCHES')).decision).toBe('ACCEPT')
    expect(compareRuns(failed, built('SHORT', 'MATCHES')).decision).toBe('ACCEPT')
    expect(compareRuns(failed, built('NOT_COMPARABLE', 'NOT_COMPARABLE')).decision).toBe('ACCEPT')
  })
  it('a geometry gain needs no scale gain: at the same settled scale a better outline is accepted, no gain is not', () => {
    expect(compareRuns(built('MATCHES', 'BEYOND', 'a'), built('MATCHES', 'MATCHES', 'b')).decision).toBe('ACCEPT')
    expect(compareRuns(built('MATCHES', 'MATCHES', 'a'), built('MATCHES', 'MATCHES', 'b')).decision).toBe('ROLLBACK')
    expect(compareRuns(built('MATCHES', 'MATCHES', 'a'), built('MATCHES', 'BEYOND', 'b')).decision).toBe('ROLLBACK')
    // a settled scale is still protected against a consulted reading that moves it
    const moved: RunState = { ...built('MATCHES', 'MATCHES', 'b'), metric: { relation: 'R', confidence: 'SUPPORTED', cmPerPixelX: 1.9 } }
    expect(compareRuns(built('MATCHES', 'BEYOND', 'a'), moved).decision).toBe('ROLLBACK')
  })
})

describe('v3.54.3 CLASSIFY_BOUNDARY: only a sure glazed wall on a named side closes anything', () => {
  const B = (over: Partial<ProposedCorrection> = {}, boundary: Partial<NonNullable<ProposedCorrection['boundary']>> = {}): ProposedCorrection => ({
    proposalId: 'b1',
    baseRevision: 'rev1',
    operation: 'CLASSIFY_BOUNDARY',
    targetId: 'TOP',
    proposed: { literal: 'GLAZED_WALL', unit: 'unknown' },
    boundary: { side: 'TOP', class: 'GLAZED_WALL', region: { x0: 100, y0: 40, x1: 400, y1: 60 }, ...boundary },
    evidence: [{ sourceId: 'picture 1' }],
    justification: 'thin triple lines between posts across the whole gable, no thick wall',
    alternatives: [],
    uncertainty: 'LOW',
    expectedEffect: 'the outline closes on the top side',
    ...over,
  })
  const pic = { width: 600, height: 800 }
  it('accepts a glazed side; an OPEN side, a solid wall or an unsure one closes nothing (a covered terrace is not a room)', async () => {
    const { validateBoundary } = await import('../src/consult/loop.js')
    expect(validateBoundary([B()], 'rev1', pic, new Set())).toMatchObject({ sides: ['TOP'], verdicts: [{ status: 'ACCEPTED' }] })
    for (const cls of ['OPEN', 'SOLID_WALL', 'NOT_BUILDING', 'UNSURE'] as const) {
      const r = validateBoundary([B({}, { class: cls })], 'rev1', pic, new Set())
      expect(r.sides).toEqual([])
      expect(r.verdicts[0]).toMatchObject({ status: 'REJECTED', code: 'NOT_A_CLOSURE' })
    }
  })
  it('counter-trials: stale revision, a repeated id, a side given twice, a region off the sheet, HIGH uncertainty, another operation', async () => {
    const { validateBoundary } = await import('../src/consult/loop.js')
    expect(validateBoundary([B({ baseRevision: 'rev0' })], 'rev1', pic, new Set()).verdicts[0].code).toBe('STALE_REVISION')
    const seen = new Set<string>()
    validateBoundary([B()], 'rev1', pic, seen)
    expect(validateBoundary([B()], 'rev1', pic, seen).verdicts[0].code).toBe('DUPLICATE_PROPOSAL_ID')
    expect(validateBoundary([B(), B({ proposalId: 'b2' })], 'rev1', pic, new Set()).verdicts.map((v) => v.code)).toEqual([undefined, 'DUPLICATE_TARGET'])
    expect(validateBoundary([B({}, { region: { x0: 100, y0: 40, x1: 900, y1: 60 } })], 'rev1', pic, new Set()).verdicts[0].code).toBe('OUT_OF_PICTURE')
    expect(validateBoundary([B({ uncertainty: 'HIGH' })], 'rev1', pic, new Set())).toMatchObject({ sides: [], verdicts: [{ status: 'HELD' }] })
    expect(validateBoundary([B({ operation: 'OUTLINE_REGION' })], 'rev1', pic, new Set()).verdicts[0].status).toBe('CAPABILITY_MISSING')
    expect(validateBoundary([B({ boundary: undefined })], 'rev1', pic, new Set()).verdicts[0].code).toBe('NO_BOUNDARY')
  })
})

describe('v3.54.3 a kept model the drawing contradicts is a preview, and the result says so', () => {
  const kept: RunState = { outcome: 'COMPLETED', modelHash: 'm', metric: { relation: 'LEGACY_UNCONFIRMED', confidence: 'INCONCLUSIVE', cmPerPixelX: 5.268, cmPerPixelY: 5.268 } } as RunState
  const refusedAt = (x: number, confidence: string): RunState => ({ outcome: 'FAILED', code: 'RECONSTRUCTION_FAILED', reasonCode: 'PLAN_LAYOUT_REJECTED', metric: { relation: 'REPLACED', confidence, cmPerPixelX: x, cmPerPixelY: x } }) as RunState
  const round = (after: RunState, decision: RoundRecord['decision'] = 'ROLLBACK'): RoundRecord => ({ round: 1, decision, why: '', after, spans: [{ proposalId: 'p', frameId: 'f', literal: '15,98', unit: 'm', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }] }) as unknown as RoundRecord

  it('a rolled-back round whose readings settle another scale: the kept model is named contradicted, with the dimensions', () => {
    const c = scaleContradictionOf([round(refusedAt(4.6, 'SUPPORTED'))], kept)
    expect(c).toMatchObject({ modelCmPerPixel: 5.268, consultedCmPerPixelX: 4.6, refusal: 'RECONSTRUCTION_FAILED/PLAN_LAYOUT_REJECTED', dimensions: [{ literal: '15,98', unit: 'm' }] })
    expect(c?.ratio).toBeCloseTo(1.145, 3)
  })
  it('counter-trials: readings that settle nothing, the same scale within 3 %, a model whose own scale is settled, an accepted round', () => {
    expect(scaleContradictionOf([round(refusedAt(4.6, 'INCONCLUSIVE'))], kept)).toBeUndefined()
    expect(scaleContradictionOf([round(refusedAt(5.2, 'SUPPORTED'))], kept)).toBeUndefined()
    expect(scaleContradictionOf([round(refusedAt(4.6, 'SUPPORTED'))], { ...kept, metric: { ...kept.metric, confidence: 'STRONG' } } as RunState)).toBeUndefined()
    expect(scaleContradictionOf([round(refusedAt(4.6, 'SUPPORTED'), 'PARTIAL')], kept)).toBeUndefined()
    expect(scaleContradictionOf([], kept)).toBeUndefined()
  })
})
