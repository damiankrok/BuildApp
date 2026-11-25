/**
 * v3.54.21 — form-read/3 (roof regions with their own numbers and joins), structure 2.0.0 (each property its own
 * standing), the feature map made from the sources before any model, and the trace of each feature to the delivered
 * model with the cause of everything that did not arrive. Controlled answers and controlled models; nothing names a house.
 */
import { describe, expect, it } from 'vitest'
import { applyCommands } from '@buildapp/commands'
import { createEmptyModel } from '@buildapp/model'
import { FORM_READ_PROMPT_VERSION, FORM_READ_SYSTEM, parseForm } from '../src/consult/form-read.js'
import { agreeStructure, buildStructureOf } from '../src/consult/structure.js'
import { countFeaturesOf, featureMapOf, featureMapText, traceFeatures } from '../src/consult/feature-map.js'
import { massingCommands, roofSystemOf } from '../src/consult/massing/massing.js'
import type { MassingHypothesis, RoofSpec } from '../src/consult/massing/massing.js'
import { readbackStructure } from '../src/consult/readback.js'
import { sideOfWall } from '../src/consult/correct/execute.js'

const V2 = { storeys: 'ONE_WITH_ATTIC', storeysBasis: 'SECTION', mainRoofKind: 'GABLE', mainRidgeAlong: 'FRONT', pitchDeg: 45, pitchStatus: 'PRINTED', eavesM: 2.65, eavesStatus: 'PRINTED', ridgeM: 7, ridgeStatus: 'PRINTED', parts: [{ what: 'GARAGE', where: 'FRONT', storeys: 'ONE', roof: { kind: 'GABLE', ridgeAlong: 'SIDE' }, lowerThanMain: true }], notVolumes: [{ what: 'RECESS', where: 'FRONT' }], pictures: [{ n: 1, shows: 'FRONT', roofSeenAs: 'SLOPE', entranceDoor: true, garageDoor: true }, { n: 2, shows: 'LEFT', roofSeenAs: 'GABLE_END', entranceDoor: false, garageDoor: false }], dormers: 0, chimneys: 1, roofWindows: 0 }
const roof = (o: Record<string, unknown>) => ({ part: null, kind: 'GABLE', ridgeAlong: 'SIDE', pitchDeg: null, pitchStatus: 'UNKNOWN', eavesM: null, eavesStatus: 'UNKNOWN', ridgeM: null, ridgeStatus: 'UNKNOWN', seenOn: 'NONE', fromShare: null, toShare: null, meets: 'NONE', join: 'NONE', ...o })
const V3 = { ...V2, notVolumes: [{ what: 'RECESS', where: 'FRONT', covered: 'MAIN_ROOF' }], perspectives: [{ n: 1, corner: 'FRONT_LEFT', mirrored: false }], roofs: [roof({ id: 'R1', of: 'MAIN', ridgeAlong: 'FRONT', pitchDeg: 45, pitchStatus: 'PRINTED', eavesM: 2.65, eavesStatus: 'PRINTED', ridgeM: 7, ridgeStatus: 'PRINTED' }), roof({ id: 'R2', of: 'PART', part: 1, pitchDeg: 30, pitchStatus: 'DERIVED', eavesM: 2.6, eavesStatus: 'ESTIMATED', ridgeM: 4.2, ridgeStatus: 'ESTIMATED', seenOn: 'FRONT', meets: 'R1', join: 'ABUTS_WALL' }), roof({ id: 'R3', of: 'CROSS', pitchDeg: 45, pitchStatus: 'ESTIMATED', seenOn: 'REAR', fromShare: 0.3, toShare: 0.6, meets: 'R1', join: 'VALLEY' })] }
const witnesses = { planStoreys: ['GROUND', 'ATTIC'], publishedPitchDeg: 45, buildingHeightM: 7.3, planParts: ['MAIN', 'GARAGE'], gableWalls: [{ frameId: 'f', side: 'FRONT' as const, wallToApex: false }, { frameId: 'l', side: 'LEFT' as const, wallToApex: true }] }

describe('form-read/3', () => {
  it('keeps the first 40 characters of its system text (a recorded /2 answer is replayed for the same request)', () => {
    expect(FORM_READ_PROMPT_VERSION).toBe('form-read/3')
    expect(FORM_READ_SYSTEM.slice(0, 40)).toBe('You are given the sheets of ONE house pr')
  })
  it('a recorded /2 answer is still an answer: no roof region beyond the main roof and the parts is stated', () => {
    const p = parseForm(V2, 2)
    expect(p.refused).toEqual([])
    expect(p.form?.roofs).toBeUndefined()
    const a = agreeStructure(p.form as NonNullable<typeof p.form>, witnesses)
    expect(a.roofs).toEqual([])
    expect(buildStructureOf(a).parts[0]).toEqual({ what: 'GARAGE', where: 'FRONT', fullStoreys: 1, roof: 'GABLE', ridge: 'Z' })
  })
  it('a /3 answer states every roof region on its own; an answer that contradicts itself is refused by name', () => {
    expect(parseForm(V3, 2).refused).toEqual([])
    expect(parseForm({ ...V3, roofs: [...V3.roofs, roof({ id: 'R4', of: 'PART', part: 3 })] }, 2).refused[0]).toMatch(/roof R4 is the roof of part 3/)
    expect(parseForm({ ...V3, roofs: [...V3.roofs, roof({ id: 'R4', of: 'CROSS', meets: 'R9', join: 'VALLEY' })] }, 2).refused[0]).toMatch(/meets R9/)
    expect(parseForm({ ...V3, roofs: [V3.roofs[0], roof({ id: 'R2', of: 'PART', part: 1, pitchDeg: 30, pitchStatus: 'UNKNOWN' })] }, 2).refused[0]).toMatch(/roof R2 pitch 30 with status UNKNOWN/)
  })
})

describe('structure 2.0.0: each property of each roof has its own standing', () => {
  const a = agreeStructure(parseForm(V3, 2).form as never, witnesses)
  it('a garage the plan names does not witness its roof\'s pitch, eaves or join', () => {
    expect(a.parts[0].standing).toBe('AGREED')
    const r2 = a.roofs.find((r) => r.id === 'R2')
    expect([r2?.pitchDeg.standing, r2?.eavesM.standing, r2?.join.standing]).toEqual(['UNWITNESSED', 'UNWITNESSED', 'UNWITNESSED'])
  })
  it('the part carries its OWN numbers to the builder (not the main roof\'s); an estimated pitch is not taken', () => {
    const b = buildStructureOf(a)
    expect(b.parts[0]).toMatchObject({ pitchDeg: 30, eavesM: { m: 2.6, status: 'ESTIMATED' }, ridgeM: { m: 4.2, status: 'ESTIMATED' }, join: 'ABUTS_WALL', roofId: 'R2' })
    expect(b.pitchDeg).toBe(45)
    expect(b.cross).toEqual([{ id: 'R3', side: 'REAR', ridge: 'Z', span: { fromShare: 0.3, toShare: 0.6 }, pitchDeg: 45, pitchStatus: 'ESTIMATED' }])
  })
  it('counter-trials: a statement the read\'s own heights contradict is disputed — that property only', () => {
    const valley = agreeStructure(parseForm({ ...V3, roofs: [V3.roofs[0], roof({ id: 'R2', of: 'PART', part: 1, ridgeM: 2.4, ridgeStatus: 'ESTIMATED', eavesM: 2.0, eavesStatus: 'ESTIMATED', seenOn: 'FRONT', meets: 'R1', join: 'VALLEY' })] }, 2).form as never, witnesses)
    const r2 = valley.roofs[0]
    expect(r2.join.standing).toBe('DISPUTED')
    expect(r2.join.why).toMatch(/not above that roof's eaves/)
    expect(r2.kind.standing).toBe('UNWITNESSED')
    expect(buildStructureOf(valley).parts[0].join).toBeUndefined()
    const wrongKind = agreeStructure(parseForm({ ...V3, roofs: [V3.roofs[0], roof({ id: 'R2', of: 'PART', part: 1, kind: 'HIP', seenOn: 'FRONT', meets: 'R1', join: 'NONE' })] }, 2).form as never, witnesses)
    expect(wrongKind.roofs[0].kind.standing).toBe('DISPUTED')
  })
})

describe('the feature map is made from the sources alone, and each feature is followed to the delivered model', () => {
  const form = parseForm(V3, 2).form as NonNullable<ReturnType<typeof parseForm>['form']>
  const a = agreeStructure(form, witnesses)
  const taken = buildStructureOf(a)
  const map = [...featureMapOf(a, FORM_READ_PROMPT_VERSION, ['f', 'l']), ...countFeaturesOf({ dormers: 0, chimneys: 1, roofWindows: 0 }, FORM_READ_PROMPT_VERSION, ['f', 'l'])]
  it('lists what the sources state — storeys, every roof and join, parts, things that are not volumes, doors, counts — and nothing of a model', () => {
    expect(map.map((f) => f.id)).toEqual(['F-STOREYS', 'F-R1-KIND', 'F-R1-RIDGE', 'F-R1-PITCH', 'F-R1-EAVES', 'F-R1-RIDGE-H', 'F-PART-1', 'F-R2', 'F-R2-JOIN', 'F-R3', 'F-R3-JOIN', 'F-NV-1', 'F-ENTRANCE', 'F-GARAGE-DOOR', 'F-DORMERS', 'F-CHIMNEYS', 'F-ROOF-WINDOWS'])
    const text = featureMapText(map)
    expect(text).toMatch(/before any model was built/)
    expect(text).toMatch(/F-R3 \[KEY\] a second ridge on the main walls, its gable on the rear from 0.3 to 0.6 of the width/)
    expect(text).not.toMatch(/ring-|mass-|roof-mass/)
  })
  const body = (id: string, rect: MassingHypothesis['bodies'][number]['rect'], r: RoofSpec, fates: MassingHypothesis['bodies'][number]['fates'] = []): MassingHypothesis['bodies'][number] => ({ id, rect, roof: r, provenance: {}, fates })
  const h: MassingHypothesis = { version: 't', status: 'BUILDABLE', views: [], alternatives: [], missing: [], views_used: [], wallThicknessM: 0.3, why: 'control', bodies: [
    body('mass-main', { minX: 0, maxX: 12, minZ: 0, maxZ: 8 }, { kind: 'GABLE', ridgeAxis: 'X', pitchDeg: 45, eavesM: 3, ridgeM: 7 }, [{ property: 'pitchDeg', fate: 'APPLIED', taken: '45°', built: '45.0°', residual: 0, why: 'agrees' }]),
    body('mass-wing-1', { minX: 4, maxX: 8, minZ: -5, maxZ: 0 }, { kind: 'GABLE', ridgeAxis: 'Z', pitchDeg: 45, eavesM: 3, ridgeM: 5 }, [{ property: 'join', fate: 'RETAINED_WITH_CONFLICT', taken: 'ABUTS_WALL with the main roof (R2)', built: 'VALLEY', why: 'the heights the elevations give make it VALLEY' }, { property: 'pitchDeg', fate: 'RETAINED_WITH_CONFLICT', taken: '30° (the pitch the structure read states for this part\'s own roof (R2))', built: '45.0°', residual: 15, why: 'both held' }]),
  ] }
  const r = applyCommands(createEmptyModel('m', 'control'), massingCommands(h, createEmptyModel('m', 'control')))
  const sol = roofSystemOf(h)
  const rb = readbackStructure(r.model, taken, { twoMinM: 4.4, oneMaxM: 4.6 }, { bodies: h.bodies, relations: sol.relations })
  const tr = traceFeatures(map, { agreed: a, taken, bodies: h.bodies, relations: sol.relations, readback: rb, model: r.model, bodyBy: 'SOURCE_BODY', sideOfWall: (w) => sideOfWall(r.model, w) })
  const row = (id: string) => tr.rows.find((q) => q.feature.id === id)
  it('a feature that arrived is measured on its element; one that did not names where it was lost', () => {
    expect(r.failedAt).toBeUndefined()
    expect(row('F-R1-KIND')).toMatchObject({ result: 'BUILT_AS_STATED', measure: { built: 'GABLE' } })
    expect(row('F-R1-PITCH')).toMatchObject({ result: 'BUILT_AS_STATED' })
    expect(row('F-PART-1')).toMatchObject({ result: 'BUILT_AS_STATED' })
    // the read said "ends against a wall"; the heights make a valley: the geometry stands and the conflict is on the record
    expect(row('F-R2-JOIN')).toMatchObject({ result: 'BUILT_DIFFERENT', cause: 'CONFLICT_WITH_DRAWING', measure: { built: expect.stringMatching(/^VALLEY; in the model: 2 VALLEY edge/) } })
    expect(row('F-R2')).toMatchObject({ result: 'BUILT_DIFFERENT', cause: 'CONFLICT_WITH_DRAWING' })
    // a cross roof the read states and nothing could place: lost in binding, by name — never silently
    expect(row('F-R3')).toMatchObject({ result: 'NOT_BUILT', cause: 'LOST_IN_BINDING' })
    // a recess has no consumer: a missing function, with its effect on the miniature
    expect(row('F-NV-1')).toMatchObject({ result: 'NOT_BUILT', cause: 'NO_CONSUMER' })
    expect(row('F-NV-1')?.why).toMatch(/plain wall/)
    // doors come from the elevation readings: the control has none
    expect(row('F-ENTRANCE')).toMatchObject({ result: 'NOT_BUILT', cause: 'NOT_ASKED' })
    expect(row('F-CHIMNEYS')).toMatchObject({ result: 'NOT_BUILT' })
    expect(row('F-DORMERS')).toMatchObject({ result: 'BUILT_AS_STATED' })
    expect(tr.byCause.NO_CONSUMER).toBe(1)
    expect(tr.features).toBe(map.length)
  })
  it('counter-trials: a disputed statement is a gate, not an omission; where the drawings\' own model stands the read built nothing', () => {
    const disputed = agreeStructure({ ...form, mainRoof: { ...form.mainRoof, kind: 'HIP' }, main: { ...form.main, roof: { ...form.main.roof, kind: 'HIP' } } } as never, witnesses)
    expect(disputed.mainRoof.standing).toBe('DISPUTED')
    const t2 = traceFeatures(featureMapOf(disputed, FORM_READ_PROMPT_VERSION, []), { agreed: disputed, taken: buildStructureOf(disputed), bodies: h.bodies, readback: rb, model: r.model, bodyBy: 'SOURCE_BODY', sideOfWall: (w) => sideOfWall(r.model, w) })
    expect(t2.rows.find((q) => q.feature.id === 'F-R1-KIND')).toMatchObject({ result: 'NOT_BUILT', cause: 'DISPUTED_BY_WITNESS' })
    const local = traceFeatures(map, { agreed: a, taken, readback: rb, model: r.model, bodyBy: 'LOCAL', sideOfWall: (w) => sideOfWall(r.model, w) })
    expect(local.rows.find((q) => q.feature.id === 'F-PART-1')).toMatchObject({ result: 'NOT_CHECKED', cause: 'NOT_ASKED' })
    expect(local.rows.find((q) => q.feature.id === 'F-R3')).toMatchObject({ cause: 'NOT_ASKED' })
  })
})

describe('v3.54.21: an element the ground plan draws is not taken out on a look\'s word', () => {
  it('WRONG_KIND / SHOULD_NOT_EXIST keep a plan-drawn patch (the disagreement stays open), and still take out a sketch-only one', async () => {
    const { reviewOutcome } = await import('../src/consult/geometry.js')
    const review = [
      { id: 'op-plan-rear-1', verdict: 'WRONG_KIND' as const, note: 'glazed door doubtful' },
      { id: 'op-fix-front-2', verdict: 'WRONG_KIND' as const, note: 'a window, not a door' },
      { id: 'op-plan-front-3', verdict: 'SHOULD_NOT_EXIST' as const, note: 'not drawn' },
      { id: 'op-fix-left-4', verdict: 'MATCHES' as const, note: 'ok' },
    ]
    const out = reviewOutcome(['op-plan-rear-1', 'op-fix-front-2', 'op-plan-front-3', 'op-fix-left-4'], review as never, new Set(['op-plan-rear-1', 'op-plan-front-3']))
    expect(out.map((o) => [o.id, o.keep])).toEqual([['op-plan-rear-1', true], ['op-fix-front-2', false], ['op-plan-front-3', true], ['op-fix-left-4', true]])
    expect(out[0].verdict).toBe('WRONG_KIND')
    expect(out[0].note).toMatch(/kept: the ground plan draws it/)
    // counter-trial: without the plan's witness the same verdicts take both out, as before
    expect(reviewOutcome(['op-plan-rear-1', 'op-plan-front-3'], review as never).map((o) => o.keep)).toEqual([false, false])
  })
})

describe('v3.54.21: an opening the source gate measured is not taken out on a look\'s word', () => {
  it('held against SHOULD_NOT_EXIST and WRONG_KIND (the kind or the finish, not the hole); an unmeasured one goes as before', async () => {
    const { reviewOutcome } = await import('../src/consult/geometry.js')
    const held = new Map([['op-fix-front-1', { verdicts: ['SHOULD_NOT_EXIST', 'WRONG_KIND'], why: 'the source gate measured this opening in the elevation' }]])
    const review = [
      { id: 'op-fix-front-1', verdict: 'SHOULD_NOT_EXIST' as const, note: 'the drawing shows three, the model four' },
      { id: 'op-fix-front-2', verdict: 'SHOULD_NOT_EXIST' as const, note: 'not drawn' },
    ]
    const out = reviewOutcome(['op-fix-front-1', 'op-fix-front-2'], review as never, held)
    expect(out.map((o) => o.keep)).toEqual([true, false])
    expect(out[0].note).toMatch(/kept: the source gate measured/)
    // NEW-H Debora: a measured garage door the look calls WRONG_KIND for its colour stays, the dispute open
    const kind = reviewOutcome(['op-fix-front-1'], [{ id: 'op-fix-front-1', verdict: 'WRONG_KIND', note: 'garage door finish dark, source timber' }] as never, held)[0]
    expect(kind.keep).toBe(true)
    expect(kind.verdict).toBe('WRONG_KIND')
    expect(kind.note).toMatch(/kept: the source gate measured/)
    // a sketch-only opening of the wrong kind still goes
    expect(reviewOutcome(['op-fix-front-2'], [{ id: 'op-fix-front-2', verdict: 'WRONG_KIND', note: 'a window, not a door' }] as never, held)[0].keep).toBe(false)
  })
})
