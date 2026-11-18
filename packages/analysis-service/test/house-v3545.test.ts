/**
 * v3.54.5 — complete facades, exact openings, and the choice between LOCAL and the described house.
 *
 * Cause tests (each fails on the v3.54.4 code and passes here) and counter-trials. The fixture is the hand-checked
 * description of one house (MANUAL_DIAGNOSTIC, test path only); every case damages or extends it in one named way.
 * No test calls a provider: the transports are fakes. No reference answer and no house name reaches production code.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fitOpening, OPENING_FIT } from '../../reconstruction/src/house/program.js'
import { arbitrate, compileHouse, supportedRidge } from '../src/house/describe.js'
import type { LocalMeasure } from '../src/house/describe.js'
import { ELEVATION_TOOL, READING_TOOLS, ask, readFacades, slimFacadesTool, strictTool } from '../src/house/read.js'
import type { FacadesAnswer, PlanAnswer, ReadingContext, ReadingRecord, Selection } from '../src/house/read.js'
import type { HousePicture } from '../src/house/pictures.js'
import { applyCorrection, reviewHouse } from '../src/house/review.js'
import { ConsultantUnavailable } from '../src/consult/loop.js'

const ROOT = join(__dirname, '..', '..', '..')
const manual = (): Record<string, any> => JSON.parse(readFileSync(join(ROOT, 'research/source-to-model/v3544/manual/gracja.house.json'), 'utf8'))
const front = (doc: Record<string, any>): Record<string, any> => doc.observations.elevations.find((e: any) => e.id === 'el-front')
const PUBLISHED = [{ key: 'building_height', value: 8.6, unit: 'm' }]
const GOOD_LOCAL: LocalMeasure = { widthM: 16.8, depthM: 10.1, heightAboveTerrainM: 8.55, topAboveGroundFloorM: 8.1, groundAreaM2: 133, roofPlanes: 4 }
const held = (h: ReturnType<typeof compileHouse>, ref: string): { code: string; why: string } | undefined => h.document.verification.held.find((x) => x.ref === ref || x.ref === `geometry.openings[${ref}]`)

describe('v3.54.5 an opening is not cut narrower to make it fit', () => {
  it('cause: an opening that would lose half its width is refused, not halved', () => {
    // v3.54.4 cut a 1.11 m window 0.56 m wide in a wall with 0.62 m of clear length, and said ACCEPTED
    const r = fitOpening({ from: 0.28, to: 1.39, lo: 0.42, hi: 1.04, u: 0.1, printed: false })
    expect(r.ok).toBe(false)
    expect((r as { why: string }).why).toMatch(/not cut narrower/)
  })
  it('inside the clear stretch it is cut exactly as agreed', () => {
    expect(fitOpening({ from: 1, to: 2.2, lo: 0.42, hi: 5, u: 0.1, printed: false })).toMatchObject({ ok: true, from: 1, to: 2.2, fit: 'EXACT' })
  })
  it('a move within the reading\'s uncertainty is an adjustment that keeps the width', () => {
    const r = fitOpening({ from: 0.35, to: 1.55, lo: 0.42, hi: 5, u: 0.1, printed: false }) as { ok: true; from: number; to: number; fit: string }
    expect(r.fit).toBe('ADJUSTED')
    expect(r.to - r.from).toBeCloseTo(1.2, 6)
  })
  it('cause: beyond the uncertainty the edge at the corner is trimmed and the other edge is NOT moved (a moved opening used to land on its neighbour)', () => {
    const r = fitOpening({ from: 6.494, to: 9.299, lo: 0.42, hi: 9.0, u: 0.1, printed: false }) as { ok: true; from: number; to: number; fit: string; note: string }
    expect(r.ok).toBe(true)
    expect(r.from).toBe(6.494)
    expect(r.to).toBe(9.0)
    expect(r.fit).toBe('APPROXIMATED')
    expect(r.note).toMatch(/approximate/)
  })
  it('a printed width is never trimmed', () => {
    expect(fitOpening({ from: 0.2, to: 1.4, lo: 0.42, hi: 1.3, u: 0.05, printed: true }).ok).toBe(false)
    const moved = fitOpening({ from: 0.2, to: 1.0, lo: 0.42, hi: 3, u: 0.05, printed: true }) as { ok: true; from: number; to: number; fit: string }
    expect(moved.to - moved.from).toBeCloseTo(0.8, 6)
    expect(moved.fit).toBe('APPROXIMATED')
  })
  it('the bound of an approximation is stated, not open', () => {
    expect(OPENING_FIT.approxShare).toBeLessThanOrEqual(0.25)
  })
})

describe('v3.54.5 one opening, two openings, the same opening twice', () => {
  it('two panels: boxes at one height with less than a mullion between them are ONE opening with two panes', () => {
    const doc = manual()
    // a second sash right beside w2 (3 px = 0.10 m at this scale is the limit; 2 px is a mullion)
    front(doc).openings.push({ id: 'w2b', kind: 'WINDOW', box: { x0: 292, y0: 222, x1: 318, y1: 260 }, level: 0 })
    const h = compileHouse(doc, 't')
    const one = h.document.geometry?.openings.find((o) => o.refs.includes('el-front/w2') && o.refs.includes('el-front/w2b'))
    expect(one, 'the two boxes are one opening').toBeDefined()
    expect(one?.panes).toBe(2)
    expect(h.document.geometry?.openings.filter((o) => o.refs.some((r) => r.startsWith('el-front/'))).length).toBe(6)
  })
  it('two openings with a pier between them stay two', () => {
    const doc = manual()
    front(doc).openings.push({ id: 'w2c', kind: 'WINDOW', box: { x0: 300, y0: 222, x1: 316, y1: 260 }, level: 0 })
    const h = compileHouse(doc, 't')
    expect(h.document.geometry?.openings.filter((o) => o.refs.some((r) => r.startsWith('el-front/'))).length).toBe(7)
  })
  it('a duplicate: two readings of one place are not two holes — one is cut, the other kept as an open conflict', () => {
    const doc = manual()
    front(doc).openings.push({ id: 'w1dup', kind: 'WINDOW', box: { x0: 156, y0: 226, x1: 192, y1: 262 }, level: 0 })
    const h = compileHouse(doc, 't')
    const records = h.document.verification.openings.filter((o) => o.ref === 'el-front/w1' || o.ref === 'el-front/w1dup')
    expect(records.map((o) => o.fit === 'NOT_BUILT').sort()).toEqual([false, true])
    expect(h.document.verification.held.some((x) => x.code === 'CONFLICT_OPEN' && /two readings of one place/.test(x.why))).toBe(true)
  })
  it('the wrong storey: an opening read above the top of its wall is held as depending on what is not built, and its side is not called built', () => {
    const doc = manual()
    front(doc).openings.push({ id: 'high', kind: 'WINDOW', box: { x0: 150, y0: 150, x1: 190, y1: 190 }, level: 1 })
    const h = compileHouse(doc, 't')
    const rec = h.document.verification.openings.find((o) => o.ref === 'el-front/high')
    expect(rec?.fit).toBe('NOT_BUILT')
    const view = h.document.verification.views.find((v) => v.side === 'FRONT')
    expect(view?.state).toBe('READ_COMPLETE')
    expect(view?.build).toBe('BUILT_PARTIAL')
  })
  it('every hole the program cut is a hole of that size in the compiled scene, on the side it was read on', () => {
    const h = compileHouse(manual(), 't')
    expect(h.document.verification.checks.find((c) => c.id === 'openings-cut')?.status).toBe('PASS')
    for (const o of h.document.verification.openings.filter((x) => x.fit !== 'NOT_BUILT')) {
      expect(o.cut?.widthM).toBeCloseTo(o.built?.widthM ?? -1, 1)
      expect(o.side).toBe(o.ref?.startsWith('el-front/') ? 'FRONT' : 'REAR')
    }
  })
})

describe('v3.54.5 every side of the house is accounted for', () => {
  it('no source: a side no published elevation shows is NO_SOURCE — not a failure of the reading, and not a blind wall', () => {
    const h = compileHouse(manual(), 't')
    const v = h.document.verification
    expect(v.views.map((x) => `${x.side}:${x.state}`)).toEqual(['FRONT:READ_COMPLETE', 'RIGHT:NO_SOURCE', 'REAR:READ_COMPLETE', 'LEFT:NO_SOURCE'])
    expect(v.status?.sources).toBe('READ_COMPLETE')
    expect(v.status?.exterior).toBe('PARTIAL')
  })
  it('cause: an elevation that was sent and not described is SENT_NOT_ANSWERED, and the house is not called read', () => {
    const doc = manual()
    doc.source.pictures.push({ id: 'side-a', role: 'ELEVATION', widthPx: 700, heightPx: 400 })
    doc.source.views = [{ picture: 'side-a', role: 'ELEVATION', asked: 2, answer: 'ASKED_NOT_ANSWERED', why: 'asked for alone as well; no entry came back' }]
    const v = compileHouse(doc, 't').document.verification
    expect(v.views.filter((x) => x.state === 'SENT_NOT_ANSWERED').length).toBeGreaterThanOrEqual(1)
    expect(v.status?.sources).toBe('READ_PARTIAL')
    expect(v.quantities).not.toBe('USABLE_IN_SCOPE')
  })
  it('a blind wall: an empty list is PARTIAL until the reader SAID the side has no opening', () => {
    const silent = manual()
    front(silent).openings = []
    front(silent).features = []
    expect(compileHouse(silent, 't').document.verification.views.find((x) => x.side === 'FRONT')?.state).toBe('PARTIAL')
    const said = manual()
    front(said).openings = []
    front(said).features = []
    front(said).blind = true
    const view = compileHouse(said, 't').document.verification.views.find((x) => x.side === 'FRONT')
    expect(view?.state).toBe('READ_COMPLETE')
    expect(view?.build).toBe('NOTHING_TO_BUILD')
  })
  it('four records of one side are one side: the second picture read as FRONT is not built from', () => {
    const doc = manual()
    doc.source.pictures.push({ id: 'front2', role: 'ELEVATION', widthPx: 700, heightPx: 400 })
    doc.observations.elevations.push({ ...JSON.parse(JSON.stringify(front(doc))), id: 'el-front2', picture: 'front2' })
    const h = compileHouse(doc, 't')
    const v = h.document.verification
    expect(v.views.filter((x) => x.state === 'READ_COMPLETE').length).toBe(2)
    expect(v.knownDefects.some((d) => d.code === 'SIDE_CLAIMED_TWICE')).toBe(true)
    expect(h.document.geometry?.openings.filter((o) => o.refs.some((r) => r.startsWith('el-front2/'))).length).toBe(0)
    expect(v.held.filter((x) => x.ref.startsWith('el-front2/') && x.code === 'CONFLICT_OPEN').length).toBeGreaterThan(4)
  })
  it('a mirrored elevation is still held (it is not tried on the other sides, where a mirror fits)', () => {
    const doc = manual()
    for (const b of front(doc).bodies) [b.leftX, b.rightX] = [700 - b.rightX, 700 - b.leftX]
    const h = compileHouse(doc, 't')
    expect(h.document.verification.views.find((x) => x.side === 'FRONT')?.registered).toBe(false)
    expect(h.document.geometry?.openings.filter((o) => o.refs.some((r) => r.startsWith('el-front/'))).length).toBe(0)
  })
  it('the vertical datum is said: which anchors gave ±0,00 on each picture', () => {
    const t = compileHouse(manual(), 't').document.verification.views.find((x) => x.side === 'FRONT')?.transform
    expect(t?.zeroHow).toMatch(/anchors/)
    expect(Math.abs((t?.zeroRowPx ?? 0) - (t?.groundRowPx ?? 0)) * (t?.mPerPx ?? 0)).toBeLessThan(0.6)
  })
})

describe('v3.54.5 the reader: the program accounts for the elevations it sent', () => {
  const raster = { width: 320, height: 200, data: new Uint8ClampedArray(320 * 200 * 4).fill(255) }
  const pic = (n: number): HousePicture => ({ n, id: `p${n}`, assetId: `a${n}`, caption: '', pageRole: { document: 'UNKNOWN', storey: 'UNKNOWN', view: 'UNKNOWN' }, width: 320, height: 200, byteHash: `h${n}`, raster })
  const selection: Selection = { ground: pic(1), upperPlans: [], sections: [], elevations: [pic(2), pic(3), pic(4)], views: [], notThisHouse: [] }
  const plan = { front: { planEdge: 'BOTTOM', how: '' }, dimensions: [], whole: [], bodies: [{ id: 'main', role: 'MAIN', storeys: [0], polygon: [], note: '' }], openZones: [], unknowns: [] } as unknown as PlanAnswer
  const entry = (picture: number, side: string): FacadesAnswer['elevations'][number] => ({ picture, side: side as 'FRONT', sideHow: '', mirrored: false, groundY: 180, blind: false, limits: 'NONE', bodies: [{ bodyId: 'main', leftX: 20, rightX: 300, eavesY: 60, ridgeY: 10 }], openings: [{ kind: 'WINDOW', box: { x0: 100, y0: 100, x1: 140, y1: 140 }, bodyId: 'main', level: 0 }], features: [] })
  const ctxOf = (answers: Array<unknown | Error>, records: ReadingRecord[] = []): ReadingContext & { calls: number; tools: string[] } => {
    const ctx = {
      calls: 0,
      tools: [] as string[],
      price: { inputUsdPerMTok: 2, outputUsdPerMTok: 10 },
      record: (r: ReadingRecord) => void records.push(r),
      modelFor: () => ({
        id: 'fake',
        model: 'fake',
        maxOutputTokens: 1,
        send: async (req: { tools: Array<{ name: string }> }) => {
          const a = answers[ctx.calls]
          ctx.calls += 1
          ctx.tools.push(req.tools[0].name)
          if (a instanceof Error) throw a
          return { content: [{ type: 'tool_use', name: req.tools[0].name, input: a }] as never, usage: { inputTokens: 5, outputTokens: 5 }, model: 'fake', latencyMs: 1 }
        },
      }),
    }
    return ctx as never
  }
  it('cause: one of three elevations described — each of the others is asked for alone, with the one-elevation tool', async () => {
    const ctx = ctxOf([{ levels: [], roofs: [], elevations: [entry(2, 'FRONT')], unknowns: [] }, entry(2, 'LEFT'), entry(2, 'REAR')])
    const r = await readFacades(ctx, selection, plan, '', [])
    expect(ctx.calls).toBe(3)
    expect(ctx.tools).toEqual(['describe_facades', 'describe_elevation', 'describe_elevation'])
    expect(r.answer.elevations.map((e) => `${e.picture}:${e.side}`)).toEqual(['2:FRONT', '3:LEFT', '4:REAR'])
    expect(r.coverage.map((c) => `${c.pictureId}:${c.answer}:${c.readIn}`)).toEqual(['p2:DESCRIBED:FACADES', 'p3:DESCRIBED:FACADES-1', 'p4:DESCRIBED:FACADES-2'])
  })
  it('four entries for one picture count once: the other pictures are still asked for', async () => {
    const ctx = ctxOf([{ levels: [], roofs: [], elevations: [entry(2, 'FRONT'), entry(2, 'REAR'), entry(2, 'LEFT'), entry(2, 'RIGHT')], unknowns: [] }, entry(2, 'LEFT'), entry(2, 'REAR')])
    const r = await readFacades(ctx, selection, plan, '', [])
    expect(ctx.calls).toBe(3)
    expect(r.coverage.every((c) => c.answer === 'DESCRIBED')).toBe(true)
  })
  it('a picture still undescribed after its own request is ASKED_NOT_ANSWERED: the reading is not called complete, and no third request is sent for it', async () => {
    const ctx = ctxOf([{ levels: [], roofs: [], elevations: [entry(2, 'FRONT'), entry(3, 'LEFT')], unknowns: [] }, new ConsultantUnavailable('TIMEOUT', 'timed out'), new ConsultantUnavailable('TIMEOUT', 'timed out')])
    const r = await readFacades(ctx, selection, plan, '', [])
    expect(r.coverage[2]).toMatchObject({ pictureId: 'p4', answer: 'ASKED_NOT_ANSWERED' })
    expect(ctx.calls).toBe(3) // the first reading, the follow-up, its one transport retry
  })
  it('cause: an entry with nothing on it, not said to be blind, is a partial answer — asked for again, and replaced only by one that says more', async () => {
    const hollow = { ...entry(3, 'LEFT'), openings: [] }
    const blind = { ...entry(4, 'REAR'), openings: [], blind: true }
    const ctx = ctxOf([{ levels: [], roofs: [], elevations: [entry(2, 'FRONT'), hollow, blind], unknowns: [] }, entry(2, 'LEFT')])
    const r = await readFacades(ctx, selection, plan, '', [])
    expect(ctx.calls).toBe(2) // the hollow one is asked again; the side SAID to be blind is not
    expect(r.answer.elevations.find((e) => e.picture === 3)?.openings.length).toBe(1)
    expect(r.coverage[1]).toMatchObject({ answer: 'DESCRIBED', readIn: 'FACADES-1' })
    const again = ctxOf([{ levels: [], roofs: [], elevations: [entry(2, 'FRONT'), hollow, blind], unknowns: [] }, { ...entry(2, 'LEFT'), openings: [] }])
    const r2 = await readFacades(again, selection, plan, '', [])
    expect(r2.coverage[1].why).toMatch(/twice/)
  })
  it('a recorded reading is replayed as it is: no follow-up is invented for it', async () => {
    const recorded: ReadingRecord = { step: 'FACADES', model: 'fake', usage: { inputTokens: 1, outputTokens: 1 }, pictures: [{ id: 'p1', assetId: 'a1', sentWidth: 1, sentHeight: 1, sha256: '' }, { id: 'p2', assetId: 'a2', sentWidth: 1, sentHeight: 1, sha256: '' }, { id: 'p3', assetId: 'a3', sentWidth: 1, sentHeight: 1, sha256: '' }, { id: 'p4', assetId: 'a4', sentWidth: 1, sentHeight: 1, sha256: '' }], promptSha256: '', answer: { levels: [], roofs: [], elevations: [entry(2, 'FRONT')], unknowns: [] } }
    const ctx = { ...ctxOf([]), replayOnly: true, replay: (_s: string, round: number) => (round === 0 ? recorded : undefined) } as never as ReadingContext & { calls: number }
    const r = await readFacades(ctx, selection, plan, '', [])
    expect(r.coverage.map((c) => c.answer)).toEqual(['DESCRIBED', 'REPLAY_WITHOUT_FOLLOW_UP', 'REPLAY_WITHOUT_FOLLOW_UP'])
  })
  it('a grammar the provider refuses is replaced once by the smaller tool; the refusal is not billed twice', async () => {
    const ctx = ctxOf([Object.assign(new ConsultantUnavailable('REJECTED_UNBILLED', 'HTTP 400: The compiled grammar is too large'), {}), { levels: [], roofs: [], elevations: [], unknowns: [] }])
    const a = await ask<FacadesAnswer>(ctx, 'FACADES', 0, 'x', [], READING_TOOLS.FACADES, [], true, slimFacadesTool(READING_TOOLS.FACADES))
    expect(a.elevations).toEqual([])
    expect(ctx.calls).toBe(2)
  })
  it('the one-elevation tool is the facade entry without the picture number, and small', () => {
    const t = strictTool(ELEVATION_TOOL) as { input_schema: { properties: Record<string, unknown> } }
    expect(Object.keys(t.input_schema.properties)).not.toContain('picture')
    expect(Object.keys(t.input_schema.properties)).toContain('blind')
    expect(JSON.stringify(t).length).toBeLessThan(JSON.stringify(strictTool(READING_TOOLS.FACADES)).length * 0.8)
  })
})

describe('v3.54.5 which house stands', () => {
  const described = compileHouse(manual(), 't')
  it('cause: a LOCAL model ten metres too tall is replaced on the section\'s ridge mark — with NO height published on the page', () => {
    expect(supportedRidge(described.document)?.valueM).toBeCloseTo(8.13, 2)
    const tall: LocalMeasure = { ...GOOD_LOCAL, heightAboveTerrainM: null, topAboveGroundFloorM: 18.11 }
    const d = arbitrate(described, tall, [])
    expect(d.accepted).toBe('DESCRIBED')
    expect(d.code).toBe('DESCRIBED_MEETS_SOURCE_LOCAL_CONTRADICTS')
    expect(d.findings.find((f) => f.fact === 'top of the roof above ±0,00')).toMatchObject({ localOk: false, describedOk: true })
    expect(d.partial).toBe(false)
  })
  it('counter: a LOCAL model that meets the mark is kept, with or without a published height', () => {
    expect(arbitrate(described, { ...GOOD_LOCAL, heightAboveTerrainM: null }, []).code).toBe('LOCAL_MEETS_SOURCE')
    expect(arbitrate(described, GOOD_LOCAL, PUBLISHED).accepted).toBe('LOCAL')
  })
  it('counter: the ridge above ±0,00 and the height above the terrain are two quantities — a LOCAL wrong in one alone is told which', () => {
    const d = arbitrate(described, { ...GOOD_LOCAL, heightAboveTerrainM: 12 }, PUBLISHED)
    expect(d.accepted).toBe('DESCRIBED')
    expect(d.findings.find((f) => f.fact === 'building height above the terrain')?.localOk).toBe(false)
    expect(d.findings.find((f) => f.fact === 'top of the roof above ±0,00')?.localOk).toBe(true)
  })
  it('counter: a wrong HIGH number from the reader is not a fact — a ridge the printed pitch cannot make over the plan fails the description itself', () => {
    const doc = manual()
    Object.assign(doc.observations.levels.find((l: any) => l.id === 'lv-ridge'), { literal: '+18,13', valueM: 18.13 })
    doc.observations.levels = doc.observations.levels.filter((l: any) => l.id !== 'lv-total')
    doc.observations.published = doc.observations.published.filter((p: any) => p.key !== 'building_height')
    const h = compileHouse(doc, 't')
    expect(h.document.verification.checks.find((c) => c.id === 'ridge-roof')?.status).toBe('FAIL')
    expect(supportedRidge(h.document)).toBeUndefined()
    const d = arbitrate(h, GOOD_LOCAL, [])
    expect(d.accepted).toBe('LOCAL')
    expect(d.code).toBe('DESCRIBED_REJECTED_LOCAL_KEPT')
  })
  it('counter: a really tall house is not refused for being tall — the check is against its own storeys, pitch and span', () => {
    const h = compileHouse(manual(), 't')
    expect(h.document.verification.checks.find((c) => c.id === 'ridge-roof')?.status).not.toBe('FAIL')
    const doc = manual()
    Object.assign(doc.observations.levels.find((l: any) => l.id === 'lv-ridge'), { literal: '+11,00', valueM: 11 })
    doc.observations.levels.push({ id: 'lv-second', picture: 'section', literal: '+5,90', valueM: 5.9, meaning: 'UPPER_FLOOR', level: 2, origin: 'MANUAL' })
    for (const o of doc.observations.outlines) if (o.what === 'BODY' && o.role === 'MAIN') o.storeys = [0, 1, 2]
    expect(compileHouse(doc, 't').document.verification.checks.find((c) => c.id === 'ridge-roof')?.status).not.toBe('FAIL')
  })
  it('counter: the level of the top slab is not the ridge — a mark not called a ridge gives no ridge fact', () => {
    const doc = manual()
    doc.observations.levels.find((l: any) => l.id === 'lv-ridge').meaning = 'OTHER'
    const h = compileHouse(doc, 't')
    expect(supportedRidge(h.document)).toBeUndefined()
    expect(arbitrate(h, { ...GOOD_LOCAL, heightAboveTerrainM: null, topAboveGroundFloorM: 18.11 }, []).findings.some((f) => f.fact === 'top of the roof above ±0,00')).toBe(false)
  })
  it('counter: an unreadable section — no level mark at all — leaves a LOCAL model that meets the printed dimensions in place', () => {
    const doc = manual()
    doc.observations.levels = []
    doc.observations.published = []
    const d = arbitrate(compileHouse(doc, 't'), { ...GOOD_LOCAL, heightAboveTerrainM: null, topAboveGroundFloorM: 18.11 }, [])
    expect(d.accepted).toBe('LOCAL')
    expect(d.code).toBe('LOCAL_MEETS_SOURCE')
  })
  it('a missing upper storey: a printed floor level whose plan is published is a fact LOCAL is held against', () => {
    const d = arbitrate(described, { ...GOOD_LOCAL, levelElevations: [0] }, PUBLISHED)
    expect(d.findings.find((f) => f.fact.startsWith('floor level of storey 1'))).toMatchObject({ localOk: false })
    expect(d.accepted).toBe('DESCRIBED')
    expect(arbitrate(described, { ...GOOD_LOCAL, levelElevations: [0, 3.05] }, PUBLISHED).accepted).toBe('LOCAL')
  })
  it('an unsupported detail does not decide: it is listed as unknown and the house that meets the source still stands', () => {
    const doc = manual()
    front(doc).features.push({ id: 'pergola', kind: 'OTHER', box: { x0: 10, y0: 10, x1: 40, y1: 40 } })
    const h = compileHouse(doc, 't')
    const d = arbitrate(h, { ...GOOD_LOCAL, topAboveGroundFloorM: 18.11, heightAboveTerrainM: 18.5 }, PUBLISHED)
    expect(d.accepted).toBe('DESCRIBED')
    expect(d.unknown.join(' ')).toMatch(/CAPABILITY_MISSING/)
  })
  it('both flawed: a rejected description does not make a contradicting LOCAL correct — it stands as a PARTIAL preview with its contradiction named', () => {
    const doc = manual()
    doc.observations.dimensions = []
    doc.observations.published = []
    const d = arbitrate(compileHouse(doc, 't'), { ...GOOD_LOCAL, heightAboveTerrainM: 18.4 }, PUBLISHED)
    expect(d.accepted).toBe('LOCAL')
    expect(d.code).toBe('DESCRIBED_REJECTED_LOCAL_CONTRADICTS')
    expect(d.partial).toBe(true)
    expect(d.contradictions.join(' ')).toMatch(/building height/)
  })
  it('an interior is not lost silently: what LOCAL held is said, and nothing is said to be removed when LOCAL stands', () => {
    const replaced = arbitrate(described, { ...GOOD_LOCAL, topAboveGroundFloorM: 18.11, heightAboveTerrainM: 18.5, rooms: 7, interiorWalls: 9 }, PUBLISHED)
    expect(replaced.interior).toMatch(/7 room\(s\) and 9 interior wall\(s\).*NOT (carried|placed).*superseded/)
    expect(arbitrate(described, GOOD_LOCAL, PUBLISHED).interior).toMatch(/nothing is removed/)
  })
})

describe('v3.54.5 corrections are transactions', () => {
  const elevations = [{ picture: { id: 'front' }, scale: 1 }, { picture: { id: 'rear' }, scale: 1 }] as never
  const before = compileHouse(manual(), 't')
  // a new opening that lies over w2 as it was read, and w2 narrowed so that the two stand side by side
  const addBeside = { op: 'ADD_OPENING', why: 'a second window beside it', picture: 1, kind: 'WINDOW', box: { x0: 268, y0: 222, x1: 300, y1: 260 }, bodyId: 'main', level: 0 }
  const narrow = { op: 'ADD_OPENING', why: 'it ends before the next one starts', picture: 1, id: 'w2', kind: 'WINDOW', box: { x0: 226, y0: 222, x1: 258, y1: 260 }, bodyId: 'main', level: 0 }
  // the review sends a 700 px elevation enlarged twice: a box in an answer is in the pixels of what was sent
  const sentBox = (c: any): any => (c.box ? { ...c, box: { x0: c.box.x0 * 2, y0: c.box.y0 * 2, x1: c.box.x1 * 2, y1: c.box.y1 * 2 } } : c)
  const review = async (given: unknown[], docIn = manual()): Promise<Awaited<ReturnType<typeof reviewHouse>>> => {
    const corrections = given.map(sentBox)
    let n = 0
    const send = async (): Promise<never> => {
      n += 1
      const { createHash } = await import('node:crypto')
      const revision = createHash('sha256').update(JSON.stringify(docIn.observations, (k, v) => (k === 'readIn' ? undefined : v))).digest('hex').slice(0, 12)
      return { content: [{ type: 'tool_use', name: 'review_model', input: n === 1 ? { revision, verdict: 'DIFFERS', differences: [], corrections } : { revision: 'x', verdict: 'MATCHES', differences: [], corrections: [] } }], usage: { inputTokens: 1, outputTokens: 1 }, model: 'fake', latencyMs: 1 } as never
    }
    const ctx: ReadingContext = { modelFor: () => ({ id: 'fake', model: 'fake', maxOutputTokens: 1, send }), price: { inputUsdPerMTok: 2, outputUsdPerMTok: 10 }, record: () => undefined }
    const raster = { width: 700, height: 400, data: new Uint8ClampedArray(700 * 400 * 4).fill(255) }
    const pic = (n: number, id: string): HousePicture => ({ n, id, assetId: id, caption: '', pageRole: { document: 'ELEVATION', storey: 'UNKNOWN', view: 'UNKNOWN' }, width: 700, height: 400, byteHash: id, raster })
    return reviewHouse({ ctx, selection: { ground: pic(1, 'plan0'), upperPlans: [], sections: [], elevations: [pic(2, 'front'), pic(3, 'rear')], views: [], notThisHouse: [] }, facadesSent: [], observationsDocument: docIn, compiled: compileHouse(JSON.parse(JSON.stringify(docIn)), 't'), modelId: 't' })
  }
  it('cause: the first step of a correct pair, judged alone, is refused for a clash the second step removes', () => {
    const alone = applyCorrection(manual(), addBeside as never, elevations) as { doc: unknown }
    const after = compileHouse(JSON.parse(JSON.stringify(alone.doc)), 't')
    expect(after.document.verification.held.some((x) => x.code === 'CONFLICT_OPEN')).toBe(true)
    expect(after.measured?.counts.windows).toBe(before.measured?.counts.windows)
  })
  it('a labelled group is applied whole: both stand, the house gains the window, and both carry the group and the revisions', async () => {
    const r = await review([{ ...addBeside, group: 'pair' }, { ...narrow, group: 'pair' }])
    const mine = r.proposals.filter((p) => p.group === 'pair')
    expect(mine.map((p) => `${p.state} ${p.code ?? ''} ${p.effect}`).join(' | ')).not.toMatch(/REJECTED/)
    expect(mine.map((p) => p.state)).toEqual(['APPLIED', 'APPLIED'])
    expect(new Set(mine.map((p) => p.baseRevision)).size).toBe(1)
    expect(mine.every((p) => p.revision && p.revision !== p.baseRevision)).toBe(true)
    expect(r.compiled.measured?.counts.windows).toBe((before.measured?.counts.windows ?? 0) + 1)
  })
  it('without a label, in the wrong order: the step refused alone is judged again after the other was applied', async () => {
    const r = await review([addBeside, narrow])
    expect(r.proposals.filter((p) => p.state === 'APPLIED').length).toBe(2)
    expect(r.compiled.measured?.counts.windows).toBe((before.measured?.counts.windows ?? 0) + 1)
  })
  it('a group with one member that names nothing is refused whole and leaves nothing behind (rollback)', async () => {
    const r = await review([{ ...narrow, group: 'bad' }, { op: 'REMOVE_OPENING', why: 'x', picture: 1, id: 'no-such', group: 'bad' }])
    expect(r.proposals.filter((p) => p.group === 'bad').map((p) => p.state)).toEqual(['REJECTED', 'REJECTED'])
    expect(r.compiled.modelHash).toBe(before.modelHash)
  })
  it('a retry of an addition does not make a second window', () => {
    const add = { op: 'ADD_OPENING', why: 'x', picture: 2, kind: 'WINDOW', box: { x0: 480, y0: 232, x1: 510, y1: 262 }, bodyId: 'main', level: 0 }
    const once = applyCorrection(manual(), add as never, elevations) as { doc: any }
    const twice = applyCorrection(once.doc, { ...add, box: { x0: 481, y0: 233, x1: 511, y1: 263 } } as never, elevations) as { doc: any; subject: string }
    const n = (d: any): number => d.observations.elevations.find((e: any) => e.id === 'el-rear').openings.length
    expect(n(once.doc)).toBe(n(manual()) + 1)
    expect(n(twice.doc)).toBe(n(once.doc))
    expect(twice.subject).toMatch(/same place/)
  })
})
