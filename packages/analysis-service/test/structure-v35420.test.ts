/**
 * v3.54.20 — the structure read as a contract the builder executes: the typed answer and its own consistency, what it
 * says of a body's roofs, its agreement with independent witnesses, and the builder's use of what is agreed. Scripted
 * transport (no provider); controlled forms and outlines (not a benchmark house); every rule with its counter-trial.
 */
import { describe, expect, it } from 'vitest'
import { flatVolumesOf, formVerdict, parseForm, readForm } from '../src/consult/form-read.js'
import type { HouseForm } from '../src/consult/form-read.js'
import type { ConsultantModel } from '../src/consult/loop.js'
import { agreeStructure, buildStructureOf, structureAgainstBody, wallToApex } from '../src/consult/structure.js'
import { roofByStructure, solveMassing, wingOnSide } from '../src/consult/massing/massing.js'
import type { OutlineObservation, RoofSpec, SilhouetteObservation } from '../src/consult/massing/massing.js'

const raster = { width: 40, height: 30, data: new Uint8ClampedArray(40 * 30 * 4).fill(255) }
/** The wire answer (flat main fields), as the provider sends it. */
const wire = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  storeys: 'ONE', storeysBasis: 'ELEVATIONS', mainRoofKind: 'GABLE', mainRidgeAlong: 'FRONT', pitchDeg: 35, pitchStatus: 'PRINTED', eavesM: 2.8, eavesStatus: 'ESTIMATED', ridgeM: 6.4, ridgeStatus: 'PRINTED',
  parts: [], notVolumes: [{ what: 'PORCH', where: 'FRONT' }],
  pictures: [{ n: 1, shows: 'FRONT', roofSeenAs: 'SLOPE', entranceDoor: true, garageDoor: false }, { n: 2, shows: 'LEFT', roofSeenAs: 'GABLE_END', entranceDoor: false, garageDoor: false }],
  dormers: 0, chimneys: 1, roofWindows: 0, ...over,
})
const form = (over: Record<string, unknown> = {}): HouseForm => { const p = parseForm(wire(over), 4); if (!p.form) throw new Error(p.refused.join('; ')); return p.form }
const answering = (input: unknown): ConsultantModel => ({ id: 's', model: 'm', maxOutputTokens: 1600, send: async () => ({ content: [{ type: 'tool_use', id: 't', name: 'report_structure', input }], stopReason: 'tool_use', usage: { inputTokens: 10, outputTokens: 10 } }) } as unknown as ConsultantModel)
const ctx = (input: unknown) => ({ model: answering(input), price: { inputPerMTok: 1, outputPerMTok: 1 } as never })

describe('v3.54.20 the typed structure answer', () => {
  const pics = [{ caption: 'FRONT', raster }, { caption: 'SIDE', raster }]
  it('is taken as given, the 1.0.0 names derived from it', async () => {
    const r = await readForm(ctx({ ...wire(), note: 'x' }), pics as never, { facts: ['roof_pitch: 35 deg'] })
    expect(r.refused).toEqual([])
    expect(r.form?.main).toEqual({ roof: { kind: 'GABLE', ridgeAlong: 'FRONT' }, pitch: { deg: 35, status: 'PRINTED' }, eaves: { m: 2.8, status: 'ESTIMATED' }, ridge: { m: 6.4, status: 'PRINTED' } })
    expect(r.form?.mainRoof).toEqual({ kind: 'GABLE', ridgeAlong: 'FRONT', pitchDeg: 35 })
    expect(r.form?.volumes).toBe(1)
    expect(r.form?.entrance).toBe('FRONT')
    expect(r.form?.garageDoor).toBe('NONE')
  })
  it('a nested value sent as its own JSON text is the same answer', () => {
    const p = parseForm({ ...wire(), pictures: JSON.stringify(wire().pictures) }, 2)
    expect(p.refused).toEqual([])
    expect(p.form?.pictures).toHaveLength(2)
  })
  it('counter-trials: an answer that contradicts itself is refused by name — no form', () => {
    expect(parseForm(wire({ mainRoofKind: 'FLAT' }), 2).refused[0]).toMatch(/FLAT main roof with ridgeAlong FRONT/)
    expect(parseForm(wire({ eavesM: null }), 2).refused[0]).toMatch(/eaves without a number with status ESTIMATED/)
    expect(parseForm(wire({ pitchStatus: 'UNKNOWN' }), 2).refused[0]).toMatch(/pitch 35 with status UNKNOWN/)
    expect(parseForm(wire({ ridgeM: 2.5 }), 2).refused[0]).toMatch(/ridge \(2.5 m\) is not above the eaves/)
    expect(parseForm(wire(), 1).refused[0]).toMatch(/names pictures that were not given/)
    expect(parseForm(wire({ storeys: 'THREE' }), 2).refused[0]).toMatch(/malformed/)
    expect(parseForm(wire({ parts: [{ what: 'GARAGE', where: 'RIGHT', storeys: 'ONE', roof: { kind: 'GABLE', ridgeAlong: 'NONE' }, lowerThanMain: true }] }), 2).refused[0]).toMatch(/GABLE part 1 roof with ridgeAlong NONE/)
  })
})

describe('v3.54.20 what the structure says of a body\'s roofs', () => {
  it('REPRODUCES the 1.0.0 loss: a gable built where a hip is reported is contradicted (1.0.0 answered AGREES)', () => {
    const hip = form({ mainRoofKind: 'HIP', pictures: [{ n: 1, shows: 'FRONT', roofSeenAs: 'HIP', entranceDoor: true, garageDoor: false }] })
    expect(formVerdict(hip, { flatVolumes: 0, pitchedKinds: ['GABLE'] })).toBe('CONTRADICTS')
    expect(formVerdict(hip, { flatVolumes: 0, pitchedKinds: ['HIP'] })).toBe('AGREES')
    expect(formVerdict(form(), { flatVolumes: 0, pitchedKinds: ['HIP'] })).toBe('CONTRADICTS')
  })
  it('flat boxes the structure does not report contradict; a reported flat garage does not; a body with no roof under a reported pitched one is contradicted', () => {
    expect(formVerdict(form(), { flatVolumes: 2, pitchedKinds: ['GABLE'] })).toBe('CONTRADICTS')
    expect(formVerdict(form(), { flatVolumes: 0, pitchedKinds: ['GABLE'] })).toBe('AGREES')
    const withGarage = form({ parts: [{ what: 'GARAGE', where: 'LEFT', storeys: 'ONE', roof: { kind: 'FLAT', ridgeAlong: 'NONE' }, lowerThanMain: true }] })
    expect(flatVolumesOf(withGarage)).toBe(1)
    expect(formVerdict(withGarage, { flatVolumes: 1, pitchedKinds: ['GABLE'] })).toBe('AGREES')
    expect(formVerdict(form(), { flatVolumes: 0, pitchedKinds: [] })).toBe('CONTRADICTS')
    expect(formVerdict(form({ mainRoofKind: 'MANSARD' }), { flatVolumes: 0, pitchedKinds: ['GABLE'] })).toBe('SILENT')
  })
})

describe('v3.54.20 the structure agreed with witnesses that are not the read', () => {
  const none = { planStoreys: ['GROUND'], gableWalls: [] }
  it('a hip no sketch contradicts is agreed; a hip against a sketched gable wall is DISPUTED and not taken (a wrong answer does not build)', () => {
    const hip = form({ mainRoofKind: 'HIP', mainRidgeAlong: 'FRONT', pictures: [{ n: 1, shows: 'FRONT', roofSeenAs: 'SLOPE', entranceDoor: true, garageDoor: false }, { n: 2, shows: 'LEFT', roofSeenAs: 'HIP', entranceDoor: false, garageDoor: false }] })
    const agreed = agreeStructure(hip, { planStoreys: ['GROUND'], gableWalls: [{ frameId: 'a', wallToApex: false }, { frameId: 'b', wallToApex: false }] })
    expect(agreed.mainRoof.standing).toBe('AGREED')
    expect(buildStructureOf(agreed).mainRoof).toBe('HIP')
    const disputed = agreeStructure(hip, { planStoreys: ['GROUND'], gableWalls: [{ frameId: 'a', wallToApex: true }, { frameId: 'b', wallToApex: false }] })
    expect(disputed.mainRoof.standing).toBe('DISPUTED')
    expect(buildStructureOf(disputed).mainRoof).toBeUndefined()
    // and an answer that reports a hip but sees a gable end on one of its own pictures
    expect(agreeStructure(form({ mainRoofKind: 'HIP' }), none).mainRoof.standing).toBe('DISPUTED')
  })
  it('two full storeys: agreed by an upper-floor plan, disputed where the page calls the upper level an attic, taken unwitnessed otherwise', () => {
    const two = form({ storeys: 'TWO', eavesM: 5.6, ridgeM: 8.7 })
    expect(agreeStructure(two, { planStoreys: ['GROUND', 'UPPER'], gableWalls: [] }).storeys.standing).toBe('AGREED')
    const d = agreeStructure(two, { planStoreys: ['GROUND', 'ATTIC'], gableWalls: [] })
    expect(d.storeys.standing).toBe('DISPUTED')
    expect(buildStructureOf(d).fullStoreys).toBeUndefined()
    expect(agreeStructure(two, none).storeys.standing).toBe('UNWITNESSED')
    expect(buildStructureOf(agreeStructure(two, none)).fullStoreys).toBe(2)
    expect(agreeStructure(form(), { planStoreys: ['GROUND', 'UPPER'], gableWalls: [] }).storeys.standing).toBe('DISPUTED')
  })
  it('the pitch and the ridge are held against the page; eaves that contradict the reported storeys are disputed', () => {
    const a = agreeStructure(form(), { ...none, publishedPitchDeg: 36, buildingHeightM: 6.9 })
    expect([a.pitchDeg.standing, a.ridgeM.standing]).toEqual(['AGREED', 'AGREED'])
    const b = agreeStructure(form(), { ...none, publishedPitchDeg: 25, buildingHeightM: 9 })
    expect([b.pitchDeg.standing, b.ridgeM.standing]).toEqual(['DISPUTED', 'DISPUTED'])
    expect(buildStructureOf(b).pitchDeg).toBeUndefined()
    expect(agreeStructure(form({ storeys: 'TWO', eavesM: 2.8 }), none).eavesM.standing).toBe('DISPUTED')
  })
  it('the ridge direction is held against the front sketch\'s wall; a ridge parallel to the front under a front gable wall is disputed', () => {
    const f = form()
    expect(agreeStructure(f, { planStoreys: ['GROUND'], gableWalls: [{ frameId: 'f', side: 'FRONT', wallToApex: false }] }).mainRidge.standing).toBe('AGREED')
    const d = agreeStructure(f, { planStoreys: ['GROUND'], gableWalls: [{ frameId: 'f', side: 'FRONT', wallToApex: true }] })
    expect(d.mainRidge.standing).toBe('DISPUTED')
    expect(buildStructureOf(d).mainRidge).toBeUndefined()
    expect(buildStructureOf(agreeStructure(f, none)).mainRidge).toBe('X')
  })
  it('a wall drawn up to the roof\'s top is a gable wall; a wall that ends at the eaves, or a narrow dormer wall, is not', () => {
    const roof = [[[0, 100], [100, 20], [200, 100]]] as Array<Array<[number, number]>>
    expect(wallToApex([[[10, 300], [190, 300], [190, 100], [100, 28], [10, 100]]], roof, 300)).toBe(true)
    expect(wallToApex([[[10, 300], [190, 300], [190, 100], [10, 100]]], roof, 300)).toBe(false)
    expect(wallToApex([[[10, 300], [190, 300], [190, 100], [10, 100]], [[90, 100], [110, 100], [110, 30], [90, 30]]], roof, 300)).toBe(false)
    expect(wallToApex([], roof, 300)).toBeUndefined()
  })
})

describe('v3.54.20 (massing 1.9.0+) the builder takes the agreed structure', () => {
  // a 9.4 × 10.1 m house with a 3.6 × 7.1 m garage stepping out on its right, 1.3 m in from the front and 1.7 m from the rear
  const HOUSE = [{ x: 0, z: 0 }, { x: 9.4, z: 0 }, { x: 9.4, z: 1.3 }, { x: 13, z: 1.3 }, { x: 13, z: 8.4 }, { x: 9.4, z: 8.4 }, { x: 9.4, z: 10.1 }, { x: 0, z: 10.1 }]
  it('a part reported on a side is the rectangle the outline steps out with there, and the outline is left without it', () => {
    const wg = wingOnSide(HOUSE, 'RIGHT') as NonNullable<ReturnType<typeof wingOnSide>>
    expect(wg.rect).toEqual({ minX: 9.4, maxX: 13, minZ: 1.3, maxZ: 8.4 })
    expect(wg.rest).toEqual([{ x: 0, z: 0 }, { x: 9.4, z: 0 }, { x: 9.4, z: 10.1 }, { x: 0, z: 10.1 }])
  })
  it('counter-trials: no step on the reported side, a step narrower than a body, a side that is one straight wall — no wing', () => {
    expect(wingOnSide(HOUSE, 'LEFT')).toBeUndefined()
    expect(wingOnSide(HOUSE, 'FRONT')).toBeUndefined()
    const BAY = [{ x: 0, z: 0 }, { x: 9.4, z: 0 }, { x: 9.4, z: 3 }, { x: 10.2, z: 3 }, { x: 10.2, z: 6 }, { x: 9.4, z: 6 }, { x: 9.4, z: 10 }, { x: 0, z: 10 }]
    expect(wingOnSide(BAY, 'RIGHT')).toBeUndefined()
    expect(wingOnSide([{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 8 }, { x: 0, z: 8 }], 'RIGHT')).toBeUndefined()
  })
  const rect = { minX: 0, maxX: 12, minZ: 0, maxZ: 10 }
  const gableZ: RoofSpec = { kind: 'GABLE', ridgeAxis: 'Z', pitchDeg: 29, eavesM: 3, ridgeM: 6.3 }
  it('REPRODUCES Fabia\'s loss on a control: a hip the silhouettes read as a gable end is built as a hip, its ridge along the longer side, the heights kept', () => {
    const r = roofByStructure(gableZ, { kind: 'HIP', full: 1, pitchDeg: 25 }, rect)
    expect(r.roof).toMatchObject({ kind: 'HIP', ridgeAxis: 'X', eavesM: 3, ridgeM: 6.3, hipRunM: 5 })
    expect(r.notes.join(' ')).toMatch(/DISPLAY_ASSUMPTION/)
  })
  it('a gable\'s ridge is turned to the agreed direction (the pitch follows the new span); nothing agreed, nothing changed', () => {
    const r = roofByStructure(gableZ, { kind: 'GABLE', axis: 'X' }, rect)
    expect(r.roof).toMatchObject({ kind: 'GABLE', ridgeAxis: 'X', eavesM: 3, ridgeM: 6.3 })
    expect(r.roof.pitchDeg).toBeCloseTo((Math.atan2(3.3, 5) * 180) / Math.PI, 1)
    expect(roofByStructure(gableZ, {}, rect)).toEqual({ roof: gableZ, notes: [] })
    expect(roofByStructure(gableZ, { kind: 'GABLE', axis: 'Z', full: 1 }, rect).notes).toEqual([])
  })
  it('REPRODUCES Skagen\'s loss on a control: walls one storey high under a roof over two full storeys are raised to where the agreed pitch from the drawn ridge puts them', () => {
    const low: RoofSpec = { kind: 'GABLE', ridgeAxis: 'X', pitchDeg: 48, eavesM: 3.2, ridgeM: 8.8 }
    const r = roofByStructure(low, { kind: 'GABLE', axis: 'X', full: 2, pitchDeg: 30 }, rect)
    expect(r.roof.eavesM).toBeCloseTo(8.8 - 5 * Math.tan(Math.PI / 6), 5)
    expect(r.roof.pitchDeg).toBe(30)
    expect(r.notes[0]).toMatch(/two full storeys/)
    // counter-trials: no pitch and only an ESTIMATED eaves — nothing to raise them to; a PRINTED eaves is taken
    expect(roofByStructure(low, { full: 2, eavesM: { m: 5.6, status: 'ESTIMATED' } }, rect).notes).toEqual([])
    expect(roofByStructure(low, { full: 2, eavesM: { m: 5.6, status: 'PRINTED' } }, rect).roof.eavesM).toBeGreaterThan(5.6)
    // walls already two storeys high are left alone
    expect(roofByStructure({ ...low, eavesM: 6 }, { full: 2, pitchDeg: 30 }, rect).notes).toEqual([])
  })
  it('a flat reading under a reported gable takes the drawn top as the ridge and the agreed pitch; without a pitch or a stated eaves it stays flat', () => {
    const flat: RoofSpec = { kind: 'FLAT', eavesM: 8.9 }
    const r = roofByStructure(flat, { kind: 'GABLE', axis: 'X', full: 2, pitchDeg: 30 }, rect)
    expect(r.roof).toMatchObject({ kind: 'GABLE', ridgeAxis: 'X', ridgeM: 8.9, pitchDeg: 30 })
    expect(roofByStructure(flat, { kind: 'GABLE', axis: 'X', full: 2 }, rect)).toEqual({ roof: flat, notes: [] })
    // a pitch that would leave the walls below two storeys is not taken
    expect(roofByStructure({ kind: 'FLAT', eavesM: 6 }, { kind: 'GABLE', axis: 'X', full: 2, pitchDeg: 45 }, rect).roof.kind).toBe('FLAT')
    // and a reported flat roof changes nothing of a pitched reading
    expect(roofByStructure(gableZ, { kind: 'FLAT' }, rect)).toEqual({ roof: gableZ, notes: [] })
  })
  it('end to end on a control: the same outline and elevations give one body without the structure, the house and its garage with it', () => {
    const outline: OutlineObservation = { observationId: 'o', frameId: 'plan', sourceByteHash: 'h', outline: HOUSE, by: 'CONTROL', fidelity: 'SOURCE_TRACED', why: 'control' }
    // front: the house's wall 6 m high under a slope to 8.9 m, the garage's 3 m under its own to 4.6 m (40 px a metre, ground at row 400)
    const px = (m: number): number => 20 + 40 * m
    const row = (m: number): number => 400 - 40 * m
    const front: SilhouetteObservation = { observationId: 'f', side: 'FRONT', frameId: 'front', sourceByteHash: 'h', groundRow: 400, walls: [[[px(0), 400], [px(9.4), 400], [px(9.4), row(6)], [px(0), row(6)]], [[px(9.4), 400], [px(13), 400], [px(13), row(3)], [px(9.4), row(3)]]], roofs: [[[px(-0.4), row(6)], [px(9.8), row(6)], [px(9.8), row(8.9)], [px(-0.4), row(8.9)]], [[px(9.4), row(3)], [px(13.4), row(3)], [px(13.4), row(4.6)], [px(9.4), row(4.6)]]] }
    const without = solveMassing({ outline, silhouettes: [front] })
    expect(without.bodies.map((b) => b.rect)).toEqual([{ minX: 0, maxX: 13, minZ: 0, maxZ: 10.1 }])
    const withIt = solveMassing({ outline, silhouettes: [front], structure: { fullStoreys: 2, mainRoof: 'GABLE', mainRidge: 'X', pitchDeg: 30, parts: [{ what: 'GARAGE', where: 'RIGHT', fullStoreys: 1, roof: 'GABLE', ridge: 'X' }] } })
    expect(withIt.bodies.map((b) => b.rect)).toEqual([{ minX: 0, maxX: 9.4, minZ: 0, maxZ: 10.1 }, { minX: 9.4, maxX: 13, minZ: 1.3, maxZ: 8.4 }])
    expect(withIt.alternatives.join(' | ')).toMatch(/STRUCTURE: the garage reported on the right stands where the outline steps out/)
  })
})

describe('v3.54.20 (massing 1.10.0) no body rises a storey above a one-storey main volume', () => {
  // an L: a 12 × 8 m house and a 5 × 5 m body stepping out of its rear (40 px a metre, ground at row 400)
  const L = [{ x: 0, z: 0 }, { x: 12, z: 0 }, { x: 12, z: 13 }, { x: 7, z: 13 }, { x: 7, z: 8 }, { x: 0, z: 8 }]
  const outline: OutlineObservation = { observationId: 'o', frameId: 'plan', sourceByteHash: 'h', outline: L, by: 'CONTROL', fidelity: 'SOURCE_TRACED', why: 'control' }
  const px = (m: number): number => 20 + 40 * m
  const row = (m: number): number => 400 - 40 * m
  // front: the house's wall 3 m under a slope to 6 m; rear: the rear body's gable wall sketched 5.6 m high under a sliver of roof
  const front: SilhouetteObservation = { observationId: 'f', side: 'FRONT', frameId: 'front', sourceByteHash: 'h', groundRow: 400, walls: [[[px(0), 400], [px(12), 400], [px(12), row(3)], [px(0), row(3)]]], roofs: [[[px(-0.4), row(3)], [px(12.4), row(3)], [px(12.4), row(6)], [px(-0.4), row(6)]]] }
  const rear: SilhouetteObservation = { observationId: 'r', side: 'REAR', frameId: 'rear', sourceByteHash: 'h', groundRow: 400, walls: [[[px(0), 400], [px(5), 400], [px(5), row(5.6)], [px(0), row(5.6)]], [[px(5), 400], [px(12), 400], [px(12), row(3)], [px(5), row(3)]]], roofs: [[[px(-0.3), row(5.6)], [px(5.3), row(5.6)], [px(5.3), row(6.2)], [px(-0.3), row(6.2)]], [[px(5), row(3)], [px(12.4), row(3)], [px(12.4), row(6)], [px(5), row(6)]]] }
  const second = (structure?: Parameters<typeof solveMassing>[0]['structure']) => solveMassing({ outline, silhouettes: [front, rear], ...(structure ? { structure } : {}) }).bodies[1]?.roof

  it('REPRODUCES Amarylis\'s loss on a control: a secondary body read with walls over 5 m is brought within one storey when the main volume is one storey', () => {
    expect(second()).toMatchObject({ pitchDeg: 13.5, eavesM: 5.6 })
    const r = second({ fullStoreys: 1, mainRoof: 'GABLE', pitchDeg: 30, parts: [] })
    expect(r).toMatchObject({ pitchDeg: 30, ridgeM: 6.2 })
    expect(r?.eavesM).toBeCloseTo(4.757, 2)
  })
  it('counter-trials: beside a two-storey main volume, or where the read reports a two-storey part, the body stays as its own elevations draw it', () => {
    expect(second({ fullStoreys: 2, mainRoof: 'GABLE', pitchDeg: 30, parts: [] })).toMatchObject({ pitchDeg: 13.5, eavesM: 5.6 })
    expect(second({ fullStoreys: 1, mainRoof: 'GABLE', pitchDeg: 30, parts: [{ what: 'WING', where: 'FRONT', fullStoreys: 2 }] })).toMatchObject({ pitchDeg: 13.5, eavesM: 5.6 })
  })
})

describe('v3.54.20 the storeys rule takes the elevations\' own wall tops first, and never an estimated pitch', () => {
  const rect = { minX: 0, maxX: 9, minZ: 0, maxZ: 9 }
  const high: RoofSpec = { kind: 'GABLE', ridgeAxis: 'X', pitchDeg: 25, eavesM: 6.3, ridgeM: 8.4 }
  it('walls two storeys high under a roof over ONE storey are lowered to the wall top the other elevations draw within a storey', () => {
    const r = roofByStructure(high, { kind: 'GABLE', axis: 'X', full: 1, drawnTopsM: [6.1, 3.1, 3.0] }, rect)
    expect(r.notes[0]).toMatch(/the wall top 2 elevation\(s\) draw within the storey/)
    // the built wall top is one of the drawn ones (the lower median), the roof's top surface a slab above it
    expect(r.roof.eavesM).toBeGreaterThan(3.0)
    expect(r.roof.eavesM).toBeLessThan(3.6)
    expect(r.roof.ridgeM).toBe(8.4)
  })
  it('counter-trials: no elevation draws a wall top within the storey and no pitch is agreed — nothing is moved; an agreed pitch is the second choice', () => {
    expect(roofByStructure(high, { full: 1, drawnTopsM: [6.1, 5.9] }, rect).notes).toEqual([])
    const byPitch = roofByStructure(high, { full: 1, drawnTopsM: [6.1], pitchDeg: 45 }, rect)
    expect(byPitch.roof.eavesM).toBeCloseTo(8.4 - 4.5, 5)
  })
  it('the builder is given a pitch only when the page agrees with it or the read states it as printed or derived', () => {
    const est = form({ pitchDeg: 42, pitchStatus: 'ESTIMATED' })
    expect(buildStructureOf(agreeStructure(est, { planStoreys: ['GROUND'], gableWalls: [] })).pitchDeg).toBeUndefined()
    expect(buildStructureOf(agreeStructure(est, { planStoreys: ['GROUND'], gableWalls: [], publishedPitchDeg: 42 })).pitchDeg).toBe(42)
    expect(buildStructureOf(agreeStructure(form(), { planStoreys: ['GROUND'], gableWalls: [] })).pitchDeg).toBe(35)
  })
})

describe('v3.54.20 (structure 1.1.0, arbitration 1.5.0) the agreed structure is held against a body as it stands', () => {
  const W = { twoMinM: 4.4, oneMaxM: 4.6 }
  const agreed = (over: Record<string, unknown>, x: Parameters<typeof agreeStructure>[1]) => agreeStructure(form(over), x)
  // the page publishes an upper-floor plan; the front sketch's wall ends at the eaves (a ridge along the front)
  const two = agreed({ storeys: 'TWO', storeysBasis: 'SECTION' }, { planStoreys: ['GROUND', 'UPPER'], gableWalls: [{ frameId: 'f', side: 'FRONT', wallToApex: false }, { frameId: 'l', side: 'LEFT', wallToApex: true }] })

  it('REPRODUCES the host\'s loss on a control: a one-storey body with its ridge across, where two storeys and a ridge along the front are agreed, is contradicted on both counts', () => {
    expect(two.storeys.standing).toBe('AGREED')
    expect(two.mainRidge.standing).toBe('AGREED')
    const held = structureAgainstBody(two, { roof: 'GABLE', ridgeAxis: 'Z', wallTopM: 3.07 }, W)
    expect(held).toHaveLength(2)
    expect(held[0]).toMatch(/two full storeys are agreed \(PLAN_STOREYS\), the body's walls end at 3\.07 m/)
    expect(held[1]).toMatch(/the ridge parallel to the front is agreed/)
  })
  it('counter-trials: a body that has them is held to nothing; a property on the read alone is held against no body; a hip has no ridge direction to hold', () => {
    expect(structureAgainstBody(two, { roof: 'GABLE', ridgeAxis: 'X', wallTopM: 5.7 }, W)).toEqual([])
    const alone = agreed({ storeys: 'TWO', storeysBasis: 'ELEVATIONS' }, { planStoreys: [], gableWalls: [] })
    expect(alone.storeys.standing).toBe('UNWITNESSED')
    expect(structureAgainstBody(alone, { roof: 'GABLE', ridgeAxis: 'Z', wallTopM: 3.07 }, W)).toEqual([])
    expect(structureAgainstBody(two, { roof: 'HIP', ridgeAxis: 'Z', wallTopM: 5.7 }, W)).toEqual([])
    expect(structureAgainstBody(two, undefined, W)).toEqual([])
  })
  it('one storey agreed: walls two storeys high are held against the body, an attic\'s knee wall is not', () => {
    const one = agreed({}, { planStoreys: ['GROUND'], gableWalls: [] })
    expect(structureAgainstBody(one, { roof: 'GABLE', ridgeAxis: 'X', wallTopM: 5.9 }, W)).toHaveLength(1)
    expect(structureAgainstBody(one, { roof: 'GABLE', ridgeAxis: 'X', wallTopM: 4.1 }, W)).toEqual([])
  })
})
