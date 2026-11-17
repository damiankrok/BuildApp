/**
 * v3.54.7 — elevation fidelity and a repair that is verified: the gable frame, the recess and its loggia, the outline
 * step built as a return, the raked glazing; the review's defects as data, a correction judged by the region it was
 * about, the host before the opening, the targeted re-reading, and the choice and quality status held to the
 * characteristic features. The fixture is the hand-checked description of one house (MANUAL_DIAGNOSTIC, test path
 * only), with its main roof turned so that its gable faces the front; every case changes it in one named way.
 * Pictures are synthetic rasters. No test calls a provider.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-package'
import { outlineSteps, straightenJogs } from '../../reconstruction/src/house/steps.js'
import { arbitrate, claimMet, compileHouse, deliveredQuality, featureClaims } from '../src/house/describe.js'
import type { CompiledHouse, LocalMeasure } from '../src/house/describe.js'
import { judgeDefect, regionMeasure, reviewHouse } from '../src/house/review.js'
import type { ReviewAnswer } from '../src/house/review.js'
import type { ReadingContext, ReadingRecord, Selection } from '../src/house/read.js'
import type { HousePicture } from '../src/house/pictures.js'
import { renderSideInFrame } from '../src/consult/model-views.js'

const ROOT = join(__dirname, '..', '..', '..')
type Doc = Record<string, any>
const el = (doc: Doc, id: string): Doc => doc.observations.elevations.find((e: Doc) => e.id === id)
const held = (h: CompiledHouse, code: string) => h.document.verification.held.filter((x) => x.code === code)
const defects = (h: CompiledHouse, code: string) => h.document.verification.knownDefects.filter((k) => k.code === code)
const side = (h: CompiledHouse, s: string) => h.measured?.sides.find((x) => x.side === s)

/** The fixture with its main roof turned: a gable end on the front and the rear, nothing on it yet. */
function gableFront(): Doc {
  const doc: Doc = JSON.parse(readFileSync(join(ROOT, 'research/source-to-model/v3544/manual/gracja.house.json'), 'utf8'))
  const o = doc.observations
  o.roofs.find((r: Doc) => r.bodyId === 'main').ridge = 'FRONT_TO_BACK'
  for (const e of o.elevations) {
    e.features = []
    e.openings = e.openings.filter((x: Doc) => x.id !== 'bd1')
    e.bodies.find((x: Doc) => x.bodyId === 'main').eavesY = null
  }
  return doc
}
const FRAME = { id: 'frame', kind: 'GABLE_FRAME', box: { x0: 126, y0: 45, x1: 424, y1: 298 }, bodyId: 'main', bandPx: 10, legPx: 8, legBottomY: 298 }
/** A recess in the main body's front face between two returns ~0.6 m wide and ~0.8 m deep (both outlines). */
function withRecess(doc: Doc): Doc {
  const cut = (poly: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> => {
    const i = poly.findIndex((p) => p.x === 955 && p.y === 1387)
    return [...poly.slice(0, i + 1), { x: 925, y: 1387 }, { x: 925, y: 1347 }, { x: 455, y: 1347 }, { x: 455, y: 1387 }, ...poly.slice(i + 1)]
  }
  for (const ol of doc.observations.outlines.filter((x: Doc) => x.id === 'ol-main' || x.id === 'ol-whole')) ol.polygon = cut(ol.polygon)
  return doc
}

describe('v3.54.7 an outline step narrower than two walls is a return, not a ring of walls', () => {
  it('cause: a 0.65 m wide, 1 m deep tooth with a 0.45 m wall is one step, cut back to the recessed line', () => {
    const poly = [{ x: 0, z: 0 }, { x: 0.65, z: 0 }, { x: 0.65, z: 1 }, { x: 7.25, z: 1 }, { x: 7.25, z: 0 }, { x: 7.9, z: 0 }, { x: 7.9, z: 12.6 }, { x: 0, z: 12.6 }]
    const r = outlineSteps(poly, 0.45)
    expect(r.steps).toHaveLength(2)
    for (const s of r.steps) {
      expect(s.widthM).toBeCloseTo(0.65, 6)
      expect(s.depthM).toBeCloseTo(1, 6)
    }
    // the ring runs along the recessed line: a rectangle from z = 1
    expect(Math.min(...r.core.map((p) => p.z))).toBeCloseTo(1, 6)
    expect(r.core).toHaveLength(4)
  })
  it('counter: a protrusion wide enough for a room between two walls is a wing, not a step', () => {
    const poly = [{ x: 0, z: 0 }, { x: 2.5, z: 0 }, { x: 2.5, z: 1 }, { x: 7.9, z: 1 }, { x: 7.9, z: 12.6 }, { x: 0, z: 12.6 }]
    expect(outlineSteps(poly, 0.45).steps).toHaveLength(0)
  })
  it('counter: a deeper protrusion is a wing whatever its width', () => {
    const poly = [{ x: 0, z: 0 }, { x: 0.65, z: 0 }, { x: 0.65, z: 4 }, { x: 7.9, z: 4 }, { x: 7.9, z: 12.6 }, { x: 0, z: 12.6 }]
    expect(outlineSteps(poly, 0.45).steps).toHaveLength(0)
  })
  it('cause: a jog shallower than the wall is straightened onto the longer stretch, and said', () => {
    const poly = [{ x: 0, z: 0 }, { x: 8, z: 0 }, { x: 8, z: 5 }, { x: 8.36, z: 5 }, { x: 8.36, z: 12 }, { x: 0, z: 12 }]
    const r = straightenJogs(poly, 0.45)
    expect(r.jogs).toHaveLength(1)
    expect(r.jogs[0].offsetM).toBeCloseTo(0.36, 6)
    expect(r.poly).toHaveLength(4)
    expect(Math.max(...r.poly.map((p) => p.x))).toBeCloseTo(8.36, 6)
  })
  it('counter: a jog whose moved stretch another body stands on stays (the neighbour would lose its wall)', () => {
    const poly = [{ x: 0, z: 0 }, { x: 8, z: 0 }, { x: 8, z: 5 }, { x: 8.36, z: 5 }, { x: 8.36, z: 12 }, { x: 0, z: 12 }]
    // a garage along x = 8 from z = 0 to 5: the stretch that would move
    expect(straightenJogs(poly, 0.45, (q) => Math.abs(q.x - 8) < 0.05 && q.z <= 5.05).jogs).toHaveLength(0)
  })
  it('counter: a jog deeper than the wall stays', () => {
    const poly = [{ x: 0, z: 0 }, { x: 8, z: 0 }, { x: 8, z: 5 }, { x: 8.6, z: 5 }, { x: 8.6, z: 12 }, { x: 0, z: 12 }]
    expect(straightenJogs(poly, 0.45).jogs).toHaveLength(0)
  })
})

describe('v3.54.7 the gable frame is its own element built from what the elevation shows', () => {
  it('cause: a frame read on the front gable is built as verge members in the outer plane; the ruler sees it on that side only', () => {
    const doc = gableFront()
    el(doc, 'el-front').features.push(FRAME)
    const h = compileHouse(doc, 't')
    expect(h.failed).toEqual([])
    expect(h.compileErrors).toEqual([])
    expect(h.document.geometry?.frames).toHaveLength(1)
    expect(h.document.geometry?.frames[0].bandM.basis).toBe('DERIVED')
    // (v3.54.8: one plate in the outer plane — band along both rakes, joined at the ridge, legs down to what they
    // stand on — replaces the two verge members of v3.54.7, which crossed at the ridge and had no legs)
    const plate = h.built?.fitted.filter((c) => (c as { role?: string }).role === 'GABLE_FRAME') ?? []
    expect(plate).toHaveLength(1)
    expect(side(h, 'FRONT')?.frame).not.toBeNull()
    expect(side(h, 'REAR')?.frame).toBeNull()
    // the band stands on the walls, not on the eaves' overhang: it begins at the body's own front face
    expect(side(h, 'FRONT')?.frame?.alongFrom).toBeGreaterThanOrEqual(1.0)
    // its depth is not on the elevation: an assumption, said
    expect(defects(h, 'FRAME_DEPTH_ASSUMED')).toHaveLength(1)
  })
  it('counter: a plain gable (no frame read) has no frame — a roof edge is not a frame', () => {
    const h = compileHouse(gableFront(), 't')
    expect(h.document.geometry?.frames).toEqual([])
    expect(h.measured?.sides.every((s) => s.frame === null)).toBe(true)
  })
  it('counter: a frame without the thickness of its band is not invented', () => {
    const doc = gableFront()
    const { bandPx: _b, ...noBand } = FRAME
    void _b
    el(doc, 'el-front').features.push(noBand)
    const h = compileHouse(doc, 't')
    expect(h.document.geometry?.frames).toEqual([])
    expect(held(h, 'SOURCE_UNKNOWN').some((x) => /frame/i.test(`${x.ref} ${x.why}`))).toBe(true)
  })
  it('wrong side: a frame read on an elevation whose body shows no gable to it is held, not built on another side', () => {
    const doc: Doc = JSON.parse(readFileSync(join(ROOT, 'research/source-to-model/v3544/manual/gracja.house.json'), 'utf8'))
    el(doc, 'el-front').features = [FRAME]
    const h = compileHouse(doc, 't')
    expect(h.document.geometry?.frames).toEqual([])
    expect(h.measured?.sides.every((s) => s.frame === null)).toBe(true)
  })
})

describe('v3.54.7 a recessed loggia is a recess, not a balcony on posts', () => {
  const LOGGIA = { id: 'loggia', kind: 'LOGGIA', box: { x0: 146, y0: 150, x1: 404, y1: 200 }, bodyId: 'main' }
  it('cause: a loggia read over a recess of the outline is a slab in the recess without supports', () => {
    const doc = withRecess(gableFront())
    el(doc, 'el-front').features.push(LOGGIA)
    const h = compileHouse(doc, 't')
    expect(h.failed).toEqual([])
    const b = side(h, 'FRONT')?.balconies ?? []
    expect(b).toHaveLength(1)
    expect(b[0].recessed).toBe(true)
    expect(b[0].posts).toBe(0)
  })
  it('cause: a BALCONY read over the same recess is the same loggia: no posts, no projection, said', () => {
    const doc = withRecess(gableFront())
    el(doc, 'el-front').features.push({ ...LOGGIA, id: 'bal', kind: 'BALCONY' })
    const h = compileHouse(doc, 't')
    const b = side(h, 'FRONT')?.balconies ?? []
    expect(b[0]?.recessed).toBe(true)
    expect(b[0]?.posts).toBe(0)
    expect(defects(h, 'BALCONY_IN_RECESS').length).toBeGreaterThan(0)
  })
  it('counter: a loggia read where the outline has no recess is held, not carved into the house', () => {
    const doc = gableFront()
    el(doc, 'el-front').features.push(LOGGIA)
    const h = compileHouse(doc, 't')
    expect(side(h, 'FRONT')?.balconies).toEqual([])
    expect(held(h, 'SOURCE_UNKNOWN').some((x) => /loggia/i.test(`${x.ref} ${x.why}`))).toBe(true)
  })
  it('the returns of the recess are walls of their own depth, and the long wall beside them is not refused', () => {
    const doc = withRecess(gableFront())
    const h = compileHouse(doc, 't')
    expect(h.built?.kernelRefusals).toEqual([])
    const piers = (h.built?.fitted ?? []).filter((c) => /-ret-/.test(String((c as { id?: string }).id)))
    expect(piers).toHaveLength(2)
  })
})

describe('v3.54.7 a glazing whose head follows the roof is cut with that head', () => {
  // in the left half of the front gable (its right half lies on a face set back from it): the head rises to the right
  const GLAZING = { id: 'gl', kind: 'WINDOW', box: { x0: 190, y0: 110, x1: 260, y1: 200 }, level: 1, headLeftY: 150, headRightY: 110 }
  it('cause: rows of the top edge at both sides make a raked hole; the scene measures it raked and the cut check agrees', () => {
    const doc = gableFront()
    el(doc, 'el-front').openings.push(GLAZING)
    const h = compileHouse(doc, 't')
    const o = h.document.geometry?.openings.find((x) => x.refs.includes('el-front/gl'))
    expect(o?.head?.kind).toBe('RAKED')
    expect(h.compileErrors).toEqual([])
    expect(side(h, 'FRONT')?.shapedOpenings.length).toBe(1)
    expect(h.document.verification.checks.find((c) => c.id === 'openings-cut')?.status).toBe('PASS')
  })
  it('counter: the same box without head rows is a level rectangle — and above its gable wall it is not cut', () => {
    const doc = gableFront()
    const { headLeftY: _l, headRightY: _r, ...plain } = GLAZING
    void _l
    void _r
    el(doc, 'el-front').openings.push(plain)
    const h = compileHouse(doc, 't')
    expect(side(h, 'FRONT')?.shapedOpenings).toEqual([])
  })
  it('counter: a head the box does not hold (above its top) is not taken; the opening keeps a level head and says so', () => {
    const doc = gableFront()
    el(doc, 'el-front').openings.push({ ...GLAZING, headLeftY: 20, headRightY: 60 })
    const h = compileHouse(doc, 't')
    const o = h.document.geometry?.openings.find((x) => x.refs.includes('el-front/gl'))
    expect(o?.head).toBeUndefined()
    expect(defects(h, 'OPENING_HEAD_INCONSISTENT').length).toBeGreaterThan(0)
  })
})

describe('v3.54.7 a triangle glazing and a glazed door under a raked head', () => {
  it('cause: a head that runs down to the sill (a triangle) keeps its slope; its sharp corner is cut at the minimum side, said', () => {
    const doc = gableFront()
    el(doc, 'el-front').openings.push({ id: 'gl', kind: 'WINDOW', box: { x0: 190, y0: 110, x1: 260, y1: 200 }, level: 1, headLeftY: 199, headRightY: 110 })
    const h = compileHouse(doc, 't')
    const o = h.document.geometry?.openings.find((x) => x.refs.includes('el-front/gl'))
    expect(o?.head?.kind).toBe('RAKED')
    expect(o?.heightM.value).toBeCloseTo(0.3, 6)
    expect(defects(h, 'OPENING_HEAD_CORNER_CUT')).toHaveLength(1)
    expect(side(h, 'FRONT')?.shapedOpenings.length).toBe(1)
  })
  it('cause: a glazed door under a raked head is filled with fixed glazing (a leaf takes a level head only) — no kernel refusal', () => {
    const doc = gableFront()
    el(doc, 'el-front').openings.push({ id: 'gl', kind: 'GLAZED_DOOR', box: { x0: 190, y0: 110, x1: 260, y1: 200 }, level: 1, headLeftY: 150, headRightY: 110 })
    const h = compileHouse(doc, 't')
    expect(h.built?.kernelRefusals).toEqual([])
    expect(side(h, 'FRONT')?.shapedOpenings.length).toBe(1)
  })
})

describe('v3.54.7 the source and the model of one side in one frame', () => {
  it('a registered side is drawn so that a pixel of the elevation is the same place of the model', () => {
    const h = compileHouse(gableFront(), 't')
    const view = h.document.verification.views.find((v) => v.elevation === 'el-front')
    const tf = view?.transform
    expect(view?.registered).toBe(true)
    if (!tf || !h.bundle || !h.measured?.exteriorWalls) throw new Error('no frame')
    const r = renderSideInFrame(h.bundle, 'FRONT', h.measured.exteriorWalls, { width: 700, height: 304, mPerPx: tf.mPerPx, alongAtPx0: tf.alongAtPx0, zeroRowPx: tf.zeroRowPx ?? tf.groundRowPx })
    expect(r.width).toBe(700)
    expect(r.height).toBe(304)
    expect(r.sha256).toMatch(/^[0-9a-f]{64}$/)
    // the same scene in the same frame is the same picture
    expect(renderSideInFrame(h.bundle, 'FRONT', h.measured.exteriorWalls, { width: 700, height: 304, mPerPx: tf.mPerPx, alongAtPx0: tf.alongAtPx0, zeroRowPx: tf.zeroRowPx ?? tf.groundRowPx }).sha256).toBe(r.sha256)
  })
})

describe('v3.54.7 a defect is judged on its region, not on a changed hash', () => {
  const none = { frame: false, framePieces: 0, balconies: [], shaped: [], holes: [] }
  it('a frame MISSING is improved only when the region gains a frame', () => {
    expect(judgeDefect({ feature: 'GABLE_FRAME', meaning: 'MISSING' }, none, { ...none, frame: true, framePieces: 2 })).toBe('IMPROVED')
    expect(judgeDefect({ feature: 'GABLE_FRAME', meaning: 'MISSING' }, none, { ...none, holes: ['x'] })).toBe('UNCHANGED')
  })
  it('a balcony on posts that is a loggia improves when the posts go and the slab is in the plane', () => {
    const before = { ...none, balconies: [{ id: 'b', recessed: false, posts: 2, projectsM: 1.2 }] }
    expect(judgeDefect({ feature: 'LOGGIA_OR_RECESS', meaning: 'WRONG_KIND' }, before, { ...none, balconies: [{ id: 'b', recessed: true, posts: 0, projectsM: 0 }] })).toBe('IMPROVED')
    expect(judgeDefect({ feature: 'SUPPORTS', meaning: 'EXTRA' }, before, before)).toBe('UNCHANGED')
  })
  it('what the ruler cannot see is NOT_MEASURABLE, never IMPROVED', () => {
    expect(judgeDefect({ feature: 'BAND', meaning: 'MISSING' }, none, none)).toBe('NOT_MEASURABLE')
    // a frame or a glazing of the wrong size or shape: its presence does not say whether its shape got better
    expect(judgeDefect({ feature: 'GABLE_FRAME', meaning: 'WRONG_SIZE' }, { ...none, frame: true }, { ...none, frame: true })).toBe('NOT_MEASURABLE')
    expect(judgeDefect({ feature: 'GLAZING_SHAPE', meaning: 'WRONG_SHAPE' }, { ...none, shaped: ['a'] }, { ...none, shaped: ['a'] })).toBe('NOT_MEASURABLE')
    expect(judgeDefect({ feature: 'GABLE_FRAME', meaning: 'MISSING' }, null, none)).toBe('NOT_MEASURABLE')
  })
  it('incomplete input: a defect without a region measures its whole side', () => {
    const doc = gableFront()
    el(doc, 'el-front').features.push(FRAME)
    const h = compileHouse(doc, 't')
    expect(regionMeasure(h.measured, 'FRONT', null)?.frame).toBe(true)
    expect(regionMeasure(h.measured, 'FRONT', { alongFrom: 20, alongTo: 30, yFrom: 0, yTo: 9 })?.frame).toBe(false)
  })
})

describe('v3.54.7 the review loop: addressed corrections, the host first, a re-reading after an empty DIFFERS', () => {
  const raster = (w: number, h: number): Raster => {
    const data = new Uint8ClampedArray(w * h * 4).fill(240)
    return { width: w, height: h, data }
  }
  const pic = (id: string, n: number): HousePicture => ({ n, id, assetId: `a-${id}`, caption: '', pageRole: { document: 'ELEVATION', storey: '', view: '' }, width: 700, height: 304, byteHash: `h-${id}`, raster: raster(700, 304) })
  const selection: Selection = { ground: pic('plan0', 1), upperPlans: [], sections: [], elevations: [pic('front', 4), pic('rear', 5)], views: [], notThisHouse: [] }
  // the recorded answers stand in for the provider, keyed by step and round; they name the pictures of the request
  const ctxWith = (answers: Record<number, unknown>): ReadingContext & { asked: number[] } => {
    const asked: number[] = []
    return {
      asked,
      modelFor: () => ({ model: 'none', send: async () => { throw new Error('no provider in tests') } }) as never,
      price: { inputUsdPerMTok: 0, outputUsdPerMTok: 0 },
      replayOnly: true,
      replay: (_s, round): ReadingRecord | undefined => {
        asked.push(round)
        if (!(round in answers)) return undefined
        const pictures = round >= 10 ? [selection.elevations[0]] : selection.elevations
        return { step: 'REVIEW', round, model: 'none', usage: { inputTokens: 0, outputTokens: 0 }, pictures: pictures.map((p) => ({ id: p.id, assetId: p.assetId, sentWidth: p.width, sentHeight: p.height, sha256: '' })), promptSha256: '', answer: answers[round] }
      },
      record: () => {},
    }
  }
  const revisionOf = async (doc: Doc): Promise<string> => {
    const { createHash } = await import('node:crypto')
    return createHash('sha256').update(JSON.stringify(doc.observations, (k, v) => (k === 'readIn' ? undefined : v))).digest('hex').slice(0, 12)
  }
  const frameDefect = { id: 'd1', side: 'FRONT', picture: 1, box: { x0: 120, y0: 40, x1: 430, y1: 300 }, feature: 'GABLE_FRAME', meaning: 'MISSING', weight: 'KEY' as const, evidence: 'a white band along both rakes', fix: 'CORRECTION' as const }

  it('cause: the correction that answers a frame defect is applied and the region measures a frame after it', async () => {
    const doc = gableFront()
    const compiled = compileHouse(JSON.parse(JSON.stringify(doc)), 't')
    const answer: ReviewAnswer = { revision: await revisionOf(doc), verdict: 'DIFFERS', differences: [], defects: [{ ...frameDefect, corrections: [0] }], corrections: [{ op: 'SET_FEATURE', why: 'frame', picture: 1, id: 'frame', kind: 'GABLE_FRAME', box: FRAME.box, bodyId: 'main', bandPx: 10, legPx: 8 }] }
    const r = await reviewHouse({ ctx: ctxWith({ 1: answer }), selection, facadesSent: [], observationsDocument: doc, compiled, modelId: 't' })
    expect(r.proposals.find((p) => p.op === 'SET_FEATURE')?.state).toBe('APPLIED')
    expect(r.defects[0].state).toBe('IMPROVED')
    expect(r.defects[0].before?.frame).toBe(false)
    expect(r.defects[0].after?.frame).toBe(true)
    expect(r.pairs.filter((p) => p.registered).length).toBeGreaterThanOrEqual(1)
    expect(r.pairs[0].renderSha256).toMatch(/^[0-9a-f]{64}$/)
  })
  it('a frame said MISSING where the scene ruler measures one is recorded as MEASURED_PRESENT: not repaired again, not open', async () => {
    const doc = gableFront()
    el(doc, 'el-front').features.push(FRAME)
    const compiled = compileHouse(JSON.parse(JSON.stringify(doc)), 't')
    const answer: ReviewAnswer = { revision: await revisionOf(doc), verdict: 'DIFFERS', differences: [], defects: [{ ...frameDefect, fix: 'UNRESOLVED' }], corrections: [] }
    const ctx = ctxWith({ 1: answer })
    const r = await reviewHouse({ ctx, selection, facadesSent: [], observationsDocument: doc, compiled, modelId: 't' })
    expect(r.defects[0].state).toBe('MEASURED_PRESENT')
    expect(r.supplements).toEqual([])
    expect(ctx.asked).not.toContain(11)
  })
  it('a frame correction without a box takes the gable of the body it names on that elevation', async () => {
    const doc = gableFront()
    const compiled = compileHouse(JSON.parse(JSON.stringify(doc)), 't')
    const answer: ReviewAnswer = { revision: await revisionOf(doc), verdict: 'DIFFERS', differences: [], defects: [{ ...frameDefect, corrections: [0] }], corrections: [{ op: 'SET_FEATURE', why: 'frame', picture: 1, id: 'frame', kind: 'GABLE_FRAME', bodyId: 'main', bandPx: 10, legPx: 8 }] }
    const r = await reviewHouse({ ctx: ctxWith({ 1: answer }), selection, facadesSent: [], observationsDocument: doc, compiled, modelId: 't' })
    expect(r.proposals.find((p) => p.op === 'SET_FEATURE')?.state).toBe('APPLIED')
    expect(r.defects[0].state).toBe('IMPROVED')
  })
  it('counter: a correction that changes the model but not the defect\'s region is refused as NO_IMPROVEMENT', async () => {
    const doc = gableFront()
    const compiled = compileHouse(JSON.parse(JSON.stringify(doc)), 't')
    const answer: ReviewAnswer = { revision: await revisionOf(doc), verdict: 'DIFFERS', differences: [], defects: [{ ...frameDefect, corrections: [0] }], corrections: [{ op: 'REMOVE_OPENING', why: 'not the frame', picture: 1, id: 'w1' }] }
    const r = await reviewHouse({ ctx: ctxWith({ 1: answer }), selection, facadesSent: [], observationsDocument: doc, compiled, modelId: 't' })
    const p = r.proposals.find((x) => x.op === 'REMOVE_OPENING')
    expect(p?.state).toBe('REJECTED')
    expect(p?.code).toBe('NO_IMPROVEMENT')
    expect(r.compiled.modelHash).toBe(compiled.modelHash)
  })
  it('cause: DIFFERS with a KEY defect and no correction asks the elevation again for that feature; the re-reading is applied when it improves the region', async () => {
    const doc = gableFront()
    const compiled = compileHouse(JSON.parse(JSON.stringify(doc)), 't')
    const answer: ReviewAnswer = { revision: await revisionOf(doc), verdict: 'DIFFERS', differences: [], defects: [{ ...frameDefect, fix: 'UNRESOLVED' }], corrections: [] }
    const ctx = ctxWith({ 1: answer, 11: { features: [FRAME], heads: [] } })
    const r = await reviewHouse({ ctx, selection, facadesSent: [], observationsDocument: doc, compiled, modelId: 't' })
    expect(ctx.asked).toContain(11)
    expect(r.supplements[0]?.answer).toBe('APPLIED')
    expect(r.defects[0].state).toBe('IMPROVED')
    expect(r.compiled.document.geometry?.frames).toHaveLength(1)
  })
  it('counter: a re-reading that adds nothing changes nothing and leaves the defect open', async () => {
    const doc = gableFront()
    const compiled = compileHouse(JSON.parse(JSON.stringify(doc)), 't')
    const answer: ReviewAnswer = { revision: await revisionOf(doc), verdict: 'DIFFERS', differences: [], defects: [{ ...frameDefect, fix: 'UNRESOLVED' }], corrections: [] }
    const r = await reviewHouse({ ctx: ctxWith({ 1: answer, 11: { features: [], heads: [] } }), selection, facadesSent: [], observationsDocument: doc, compiled, modelId: 't' })
    expect(r.supplements[0]?.answer).toBe('NOTHING_NEW')
    expect(r.defects[0].state).toBe('SUPPLEMENT_ASKED')
    expect(r.compiled.modelHash).toBe(compiled.modelHash)
  })
  it('cause: an opening not cut because it stood above its wall is not added to that wall again: HOST_FIRST', async () => {
    const doc = gableFront()
    // a rectangle reaching above the front gable's wall: the builder does not cut it
    el(doc, 'el-front').openings.push({ id: 'gl', kind: 'WINDOW', box: { x0: 150, y0: 60, x1: 260, y1: 200 }, level: 1 })
    const compiled = compileHouse(JSON.parse(JSON.stringify(doc)), 't')
    const notCut = compiled.document.verification.openings?.find((x) => x.ref === 'el-front/gl')
    expect(notCut?.fit).toBe('NOT_BUILT')
    const answer: ReviewAnswer = { revision: await revisionOf(doc), verdict: 'DIFFERS', differences: [], corrections: [{ op: 'ADD_OPENING', why: 'the gable glazing', picture: 1, id: 'gl', kind: 'WINDOW', box: { x0: 150, y0: 62, x1: 260, y1: 200 } }] }
    const r = await reviewHouse({ ctx: ctxWith({ 1: answer }), selection, facadesSent: [], observationsDocument: doc, compiled, modelId: 't' })
    expect(r.proposals.find((p) => p.op === 'ADD_OPENING')?.code).toBe('HOST_FIRST')
  })
})

describe('v3.54.7 (D41) the choice and the delivered quality hold both models to the characteristic features', () => {
  const PUBLISHED = [{ key: 'building_height', value: 8.6, unit: 'm' }]
  const framed = (): CompiledHouse => {
    const doc = gableFront()
    el(doc, 'el-front').features.push(FRAME)
    return compileHouse(doc, 't')
  }
  const localOf = (h: CompiledHouse, frame: boolean): LocalMeasure => {
    const m = h.measured
    if (!m?.exteriorWalls) throw new Error('not measured')
    return { widthM: m.exteriorWalls.widthM, depthM: m.exteriorWalls.depthM, heightAboveTerrainM: null, topAboveGroundFloorM: m.roofTopY, groundAreaM2: null, roofPlanes: 4, openings: m.openings, sides: m.sides.map((s) => ({ ...s, frame: frame ? s.frame : null })) }
  }
  it('a frame read on the source is a claim; LOCAL without a frame there contradicts it, by the same ruler', () => {
    const h = framed()
    const claims = featureClaims(h.document)
    expect(claims).toEqual([expect.objectContaining({ side: 'FRONT', feature: 'GABLE_FRAME' })])
    expect(claimMet(claims[0], h.measured?.sides)?.ok).toBe(true)
    const d = arbitrate(h, localOf(h, false), PUBLISHED)
    const f = d.findings.find((x) => x.featureSide === 'FRONT')
    expect(f?.localOk).toBe(false)
    expect(f?.describedOk).toBe(true)
    expect(d.accepted).toBe('DESCRIBED')
    expect(deliveredQuality(d).status).toBe('FEATURES_CHECKED')
  })
  it('counter: a plain source (no frame read, no defect) claims nothing, and its quality is FEATURES_NOT_CHECKED — not correct', () => {
    const h = compileHouse(gableFront(), 't')
    expect(featureClaims(h.document)).toEqual([])
    const d = arbitrate(h, localOf(h, false), PUBLISHED)
    expect(d.findings.some((x) => x.featureSide)).toBe(false)
    expect(deliveredQuality(d).status).toBe('FEATURES_NOT_CHECKED')
  })
  it('LOCAL is protected: a frame LOCAL built, which the description neither reads nor denies, keeps LOCAL against a plain description', () => {
    const h = compileHouse(gableFront(), 't')
    const d = arbitrate(h, localOf(framed(), true), PUBLISHED)
    const f = d.findings.find((x) => x.featureSide === 'FRONT')
    expect(f?.fact).toMatch(/LOCAL's, unconfirmed/)
    expect(f?.localOk).toBe(true)
    expect(f?.describedOk).toBe(false)
    expect(d.accepted).toBe('LOCAL')
  })
  it('counter: the same frame in the description as well is no finding — LOCAL is not protected against a description that has it', () => {
    const h = framed()
    const d = arbitrate(h, localOf(framed(), true), PUBLISHED)
    expect(d.findings.filter((x) => /unconfirmed/.test(x.fact))).toEqual([])
  })
  it('a KEY defect the review left open binds the described house: FEATURES_PARTIAL, named', () => {
    const h = compileHouse(gableFront(), 't')
    const open = [{ id: 'd1', side: 'FRONT', feature: 'GABLE_FRAME', meaning: 'MISSING', weight: 'KEY', state: 'NOT_IMPROVED', round: 1 }]
    const d = arbitrate(h, localOf(framed(), true), PUBLISHED, { defects: open })
    // the defect says the source shows a frame: LOCAL has it, the described house does not
    const f = d.findings.find((x) => x.featureSide === 'FRONT')
    expect(f?.localOk).toBe(true)
    expect(f?.describedOk).toBe(false)
    expect(d.accepted).toBe('LOCAL')
    const q = deliveredQuality(d, open)
    expect(q.status).toBe('FEATURES_CHECKED')
    const qd = deliveredQuality({ ...d, accepted: 'DESCRIBED' }, open)
    expect(qd.status).toBe('FEATURES_PARTIAL')
    expect(qd.sides[0].openDefects[0]).toMatch(/d1 GABLE_FRAME MISSING/)
  })
})
