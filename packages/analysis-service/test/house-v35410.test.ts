/**
 * v3.54.10 — one contract, the right windows, consistent elevations. Each case changes one thing: an answer's key order
 * or list order, a non-strict answer's JSON text, a printed callout, a glazing's divisions, a finish zone, a storey's
 * plan reading, a chimney seen from two sides. The house is the hand-checked description used by earlier stages
 * (MANUAL_DIAGNOSTIC, test path only); the plan readings are synthetic, drawn in that house's own frame. No test calls
 * a provider.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mergePlanLevel, parseHouseDocument, resolveHouse } from '@buildapp/reconstruction'
import { parseModel, serializeModel } from '@buildapp/model'
import { canonicalJson, conformAnswer, READING_CAPABILITIES, schemaFields, stableOpeningOrder } from '../src/house/contract.js'
import { READING_TOOLS, ask } from '../src/house/read.js'
import type { ReadingContext, ReadingRecord } from '../src/house/read.js'
import { compileHouse, extrasInput } from '../src/house/describe.js'
import { applyCorrection } from '../src/house/review.js'

const ROOT = join(__dirname, '..', '..', '..')
type Doc = Record<string, any>
const manual = (): Doc => JSON.parse(readFileSync(join(ROOT, 'research/source-to-model/v3544/manual/gracja.house.json'), 'utf8'))
const resolved = (doc: Doc) => {
  const p = parseHouseDocument(doc)
  if (!p.ok) throw new Error(`fixture rejected: ${JSON.stringify(p.issues).slice(0, 300)}`)
  const r = resolveHouse(p.document)
  if (!r.geometry) throw new Error('no geometry')
  return { ...r, geometry: r.geometry }
}
const front = (doc: Doc) => doc.observations.elevations.find((e: Doc) => e.id === 'el-front')
/** A storey reading in a synthetic pixel frame: px = (x·40, (11 − z)·40), front at the bottom; its outline is the house's own. */
const px = (x: number, z: number) => ({ x: Math.round(x * 400) / 10, y: Math.round((11 - z) * 400) / 10 })
function withStorey(doc: Doc, level: number, extra: Partial<Doc> = {}): Doc {
  const g = resolved(doc).geometry
  const outline = (g.outlines.find((o) => o.level === level)?.polygon ?? []).map((p) => px(p.x, p.z))
  doc.observations.storeys = [...(doc.observations.storeys ?? []), { id: `storey-${level}`, picture: `plan-${level}`, level, frontEdge: 'BOTTOM', outline, partitions: [], doors: [], rooms: [], stairs: [], voids: [], origin: 'MANUAL', ...extra }]
  return doc
}

describe('v3.54.10 one meaning for the data: conformance, key order, list order', () => {
  const tool = READING_TOOLS.DETAILS.input_schema
  const answer = { elevations: [{ picture: 1, openings: [{ id: 'o1', contour: 'FRAME', hiddenBelowY: null, hiddenBy: null, mullionsX: [10], transomsY: [], doorLeaves: 1 }], zones: [], chimneys: [] }], unknowns: [] }
  it('the same content in another key order conforms to the same value', () => {
    const reordered = JSON.parse(JSON.stringify({ unknowns: [], elevations: [{ chimneys: [], zones: [], openings: [{ doorLeaves: 1, transomsY: [], mullionsX: [10], hiddenBy: null, hiddenBelowY: null, contour: 'FRAME', id: 'o1' }], picture: 1 }] }))
    expect(JSON.stringify(conformAnswer(tool, reordered).value)).toBe(JSON.stringify(conformAnswer(tool, answer).value))
  })
  it('a non-strict answer\'s array as JSON text is migrated by the one named rule, at any depth, and recorded; other text is refused', () => {
    const c = conformAnswer(tool, { ...answer, elevations: JSON.stringify(answer.elevations) })
    expect(c.migrations).toEqual([{ path: '$.elevations', rule: 'JSON_TEXT@1' }])
    expect(c.value).toEqual(answer)
    const bad = conformAnswer(tool, { ...answer, elevations: 'two elevations, see above' })
    expect(bad.value).toBeUndefined()
  })
  it('an item of the wrong shape is removed and said; the rest stays; an unknown field is dropped (kept only for an older contract\'s replay)', () => {
    const c = conformAnswer(tool, { ...answer, elevations: [{ ...answer.elevations[0], openings: [answer.elevations[0].openings[0], { ...answer.elevations[0].openings[0], id: 'o2', contour: 'MAYBE' }] }], extra: 1 })
    expect((c.value as Doc).elevations[0].openings).toHaveLength(1)
    expect(c.issues.map((i) => i.code)).toEqual(expect.arrayContaining(['ENUM', 'ITEM_REJECTED', 'UNKNOWN_FIELD']))
    expect((c.value as Doc).extra).toBeUndefined()
    expect((conformAnswer(tool, { ...answer, extra: 1 }, { keepUnknown: true }).value as Doc).extra).toBe(1)
  })
  it('null only where the schema allows it', () => {
    expect(conformAnswer(tool, { ...answer, elevations: [{ ...answer.elevations[0], picture: null }] }).issues.some((i) => i.code === 'TYPE')).toBe(true)
  })
  it('ask keeps the raw answer exactly as given; the normalised answer is a different object (history is not rewritten)', async () => {
    const records: ReadingRecord[] = []
    const raw = { elevations: JSON.stringify(answer.elevations), unknowns: [] }
    const ctx: ReadingContext = { modelFor: () => ({ model: 'm', send: async () => ({ model: 'm', content: [{ type: 'tool_use', name: 'describe_details', input: raw }], usage: { inputTokens: 1, outputTokens: 1 } }) }) as never, price: { inputUsdPerMTok: 0, outputUsdPerMTok: 0 }, record: (r) => void records.push(r) }
    const out = await ask<Doc>(ctx, 'DETAILS', 0, 'x', [], READING_TOOLS.DETAILS)
    expect(out.elevations).toEqual(answer.elevations)
    expect(typeof (records[0].rawAnswer as Doc).elevations).toBe('string')
    expect(records[0].conform?.migrations).toEqual([{ path: '$.elevations', rule: 'JSON_TEXT@1' }])
    expect(records[0].contract).toBe('0.5.0')
    expect(records[0].fields).toEqual(schemaFields(READING_TOOLS.DETAILS.input_schema))
  })
  it('a permuted list of openings gets the same ids (the program\'s order, not the answer\'s)', () => {
    const os = [{ kind: 'WINDOW', level: 0, box: { x0: 300, y0: 10, x1: 340, y1: 60 } }, { kind: 'DOOR', level: 0, box: { x0: 100, y0: 10, x1: 140, y1: 90 } }, { kind: 'WINDOW', level: 1, box: { x0: 50, y0: 5, x1: 90, y1: 40 } }]
    const ids = (list: typeof os) => stableOpeningOrder(list).map((i) => JSON.stringify(list[i]))
    expect(ids([os[2], os[0], os[1]])).toEqual(ids(os))
  })
  it('a replay of a reading recorded before this contract keeps the id rule its reviews named ids by', () => {
    expect(extrasInput({ storeys: [], absent: [] }, [{ step: 'FACADES' } as ReadingRecord]).idRule).toBe('ANSWER_ORDER')
    expect(extrasInput({ storeys: [], absent: [] }, [{ step: 'FACADES', contract: '0.5.0' } as ReadingRecord]).idRule).toBe('STABLE')
  })
  it('every field the new steps ask for has a declared fate (consumer or NOTE_ONLY)', () => {
    for (const step of ['DETAILS', 'STOREY'] as const) {
      for (const f of schemaFields(READING_TOOLS[step].input_schema)) {
        const key = `${step}:${f}`
        const known = READING_CAPABILITIES[key] ?? Object.entries(READING_CAPABILITIES).find(([k]) => key.startsWith(k))?.[1]
        expect(known, key).toBeDefined()
      }
    }
  })
  it('canonical JSON ignores key order and keeps the order of a polygon', () => {
    expect(canonicalJson({ b: 1, a: [{ y: 1, x: 2 }, { x: 0, y: 0 }] })).toBe(canonicalJson({ a: [{ x: 2, y: 1 }, { y: 0, x: 0 }], b: 1 }))
    expect(canonicalJson({ p: [1, 2] })).not.toBe(canonicalJson({ p: [2, 1] }))
  })
})

describe('v3.54.10 a printed callout sets the opening\'s rough size; the elevation\'s frame stays beside it', () => {
  // the front elevation's w2: a window at x 240..290 px; on the front wall it stands near 4.6 m from the left
  const atW2 = (literal: string, xm = 4.6): Doc => {
    const doc = withStorey(manual(), 0)
    doc.observations.labels = [{ id: 'label-0-1', picture: 'plan-0', level: 0, literal, at: px(xm, -0.4), wall: 'FRONT', kind: 'WINDOW', widthM: Number(literal.split('/')[0]) / 100, heightM: Number(literal.split('/')[1]) / 100, origin: 'MANUAL' }]
    return doc
  }
  const w2 = (doc: Doc) => resolved(doc).geometry.openings.find((o) => o.refs.includes('el-front/w2'))
  it('cause: the callout binds by where it is printed — width and height PRINTED, centred where the elevation shows it, frame kept', () => {
    const before = w2(manual())
    const o = w2(atW2('180/150'))
    expect(o?.widthM).toMatchObject({ value: 1.8, basis: 'PRINTED' })
    expect(o?.heightM).toMatchObject({ value: 1.5, basis: 'PRINTED' })
    expect(o?.frame?.widthM).toBeCloseTo(before?.widthM.value ?? 0, 6)
    const c0 = (before?.offsetM.value ?? 0) + (before?.widthM.value ?? 0) / 2
    expect((o?.offsetM.value ?? 0) + 0.9).toBeCloseTo(c0, 3)
    expect(o?.label?.literal).toBe('180/150')
  })
  it('cause: a raked glazing keeps the jamb at its high end (the full-height edge); its low end is where the narrower callout cuts', () => {
    const raked = (hl: number, hr: number) => {
      const doc = atW2('130/150')
      const plain = manual()
      for (const d of [doc, plain]) Object.assign(front(d).openings.find((o: Doc) => o.id === 'w2'), { headLeftY: hl, headRightY: hr, contour: 'FRAME' })
      return { before: w2(plain), o: w2(doc) }
    }
    const left = raked(222, 248)
    expect(left.before?.head?.kind).toBe('RAKED')
    expect(left.o?.widthM).toMatchObject({ value: 1.3, basis: 'PRINTED' })
    const end = (q: typeof left.o) => (q?.offsetM.value ?? 0) + (q?.widthM.value ?? 0)
    const highNear = (left.before?.heightM.value ?? 0) > (left.before?.head?.kind === 'RAKED' ? (left.before.head.heightFarM.value ?? 0) : 0)
    if (highNear) expect(left.o?.offsetM.value).toBeCloseTo(left.before?.offsetM.value ?? 0, 3)
    else expect(end(left.o)).toBeCloseTo(end(left.before), 3)
    // mirrored: the high end on the other side — the other jamb is kept
    const right = raked(248, 222)
    const highNearR = (right.before?.heightM.value ?? 0) > (right.before?.head?.kind === 'RAKED' ? (right.before.head.heightFarM.value ?? 0) : 0)
    expect(highNearR).toBe(!highNear)
    if (highNearR) expect(right.o?.offsetM.value).toBeCloseTo(right.before?.offsetM.value ?? 0, 3)
    else expect(end(right.o)).toBeCloseTo(end(right.before), 3)
  })
  it('counter: a callout printed where no opening stands is not forced onto a neighbour', () => {
    const r = resolved(atW2('180/150', 13.5))
    expect(r.geometry.openings.some((o) => o.label)).toBe(false)
    expect(r.verification.knownDefects.some((k) => k.code === 'LABEL_NOT_BOUND')).toBe(true)
  })
  it('counter: a callout far beyond what two definitions of one opening explain is a conflict, not a correction', () => {
    const r = resolved(atW2('400/150'))
    expect(r.geometry.openings.some((o) => o.label)).toBe(false)
    expect(r.verification.knownDefects.some((k) => k.code === 'LABEL_CONFLICT')).toBe(true)
  })
})

describe('v3.54.10 divisions, hidden ends and finish zones reach the program', () => {
  it('cause: profiles read between the panes of a glazed door are its panels — not round(width / 0.9)', () => {
    const doc = manual()
    const d1 = front(doc).openings.find((o: Doc) => o.id === 'd1')
    Object.assign(d1, { kind: 'GLAZED_DOOR', mullionsX: [339], contour: 'FRAME' })
    const h = compileHouse(doc, 'v35410-div')
    const id = h.document.geometry?.openings.find((q) => q.refs.includes('el-front/d1'))?.id
    const door = (h.built?.program ?? []).find((c) => c.type === 'placeDoor' && (c as Doc).openingId === id) as Doc | undefined
    const plain = compileHouse(manual(), 'v35410-div-plain')
    const before = (plain.built?.program ?? []).find((c) => c.type === 'placeDoor' && (c as Doc).openingId === plain.document.geometry?.openings.find((q) => q.refs.includes('el-front/d1'))?.id) as Doc | undefined
    expect(before?.assembly?.panels).toBeUndefined()
    expect(door?.assembly.panels.map((p: Doc) => p.fraction).reduce((a: number, b: number) => a + b, 0)).toBeCloseTo(1, 6)
    expect(door?.assembly.panels).toHaveLength(2)
  })
  it('counter: with no divisions read, the convention is used and said as one', () => {
    const h = compileHouse(manual(), 'v35410-div0')
    expect(h.document.verification.parameters.some((p) => /divisions/.test(p.path) && /by convention/.test(String(p.consumer)))).toBe(true)
  })
  it('a finish zone becomes surface regions on the walls it spans, in the style profile\'s colour; outline, openings and rooms do not change', () => {
    const plain = compileHouse(manual(), 'v35410-z')
    const doc = manual()
    front(doc).zones = [{ id: 'z1', material: 'WOOD', tone: 'WARM', box: { x0: 126, y0: 160, x1: 230, y1: 298 }, bodyId: 'main', certainty: 'LIKELY' }]
    const h = compileHouse(doc, 'v35410-z')
    const regions = (h.built?.program ?? []).filter((c) => c.type === 'createSurfaceRegion') as Doc[]
    expect(regions.length).toBeGreaterThan(0)
    expect((h.built?.program ?? []).some((c) => c.type === 'defineMaterial' && (c as Doc).id === 'mat-zone-wood-warm')).toBe(true)
    const shape = (x: typeof h) => JSON.stringify({ o: x.document.geometry?.outlines, op: x.document.geometry?.openings.map((q) => [q.id, q.hostWall, q.offsetM.value, q.widthM.value]) })
    expect(shape(h)).toBe(shape(plain))
    expect(h.compileErrors).toEqual([])
  })
  it('cause: two zones of different finish over one stretch of a wall: the stretch is drawn by neither and said; same finish may overlap', () => {
    const two = (m2: string) => {
      const doc = manual()
      front(doc).zones = [
        { id: 'z1', material: 'WOOD', tone: 'WARM', box: { x0: 126, y0: 160, x1: 260, y1: 298 }, bodyId: 'main', certainty: 'LIKELY' },
        { id: 'z2', material: m2, tone: m2 === 'WOOD' ? 'WARM' : 'DARK', box: { x0: 200, y0: 160, x1: 330, y1: 298 }, bodyId: 'main', certainty: 'LIKELY' },
      ]
      return resolved(doc)
    }
    const r = two('PLASTER')
    expect(r.verification.knownDefects.some((k) => k.code === 'ZONE_OVERLAP')).toBe(true)
    const byWall = new Map<string, Array<{ a0: number; a1: number; m: string }>>()
    for (const z of r.geometry.zones) byWall.set(`${z.hostWall}/${z.level}`, [...(byWall.get(`${z.hostWall}/${z.level}`) ?? []), { a0: Math.min(z.a0, z.a1), a1: Math.max(z.a0, z.a1), m: `${z.material}-${z.tone}` }])
    for (const list of byWall.values()) for (const p of list) for (const q of list) if (p !== q && p.m !== q.m) expect(Math.min(p.a1, q.a1) - Math.max(p.a0, q.a0)).toBeLessThan(0.1)
    expect(two('WOOD').verification.knownDefects.some((k) => k.code === 'ZONE_OVERLAP')).toBe(false)
  })
  it('a zone assignment survives save and load: the model written and read back keeps its regions and their materials', () => {
    const doc = manual()
    front(doc).zones = [{ id: 'z1', material: 'WOOD', tone: 'WARM', box: { x0: 126, y0: 160, x1: 230, y1: 298 }, bodyId: 'main', certainty: 'LIKELY' }]
    const h = compileHouse(doc, 'v35410-z-save')
    expect(h.modelJson).toBeDefined()
    const once = parseModel(h.modelJson as string)
    const again = parseModel(serializeModel(once))
    const zones = (m: typeof once) => (m.surfaceRegions ?? []).filter((r) => String(r.materialId).startsWith('mat-zone-')).map((r) => [r.id, r.hostId, r.materialId, JSON.stringify(r.rect)])
    expect(zones(once).length).toBeGreaterThan(0)
    expect(zones(again)).toEqual(zones(once))
    expect(again.materials.find((m) => m.id === 'mat-zone-wood-warm')).toEqual(once.materials.find((m) => m.id === 'mat-zone-wood-warm'))
    // and the house document written and read back keeps the zone it was built from
    const reread = parseHouseDocument(JSON.parse(JSON.stringify(h.document)))
    expect(reread.ok).toBe(true)
    if (reread.ok) expect(reread.document.geometry?.zones).toEqual(h.document.geometry?.zones)
  })
  it('counter: a zone the reader was not sure of (a shadow, a reflection) is not drawn', () => {
    const doc = manual()
    front(doc).zones = [{ id: 'z1', material: 'PLASTER', tone: 'DARK', box: { x0: 126, y0: 160, x1: 230, y1: 298 }, certainty: 'UNSURE' }]
    const r = resolved(doc)
    expect(r.geometry.zones).toHaveLength(0)
    expect(r.verification.held.some((x) => x.ref === 'el-front/z1')).toBe(true)
  })
})

describe('v3.54.10 fault injection: a contour read wrong is said, never presented as the rough opening', () => {
  const w2 = (doc: Doc) => resolved(doc).geometry.openings.find((o) => o.refs.includes('el-front/w2'))
  const withContour = (contour: string): Doc => {
    const doc = manual()
    Object.assign(front(doc).openings.find((o: Doc) => o.id === 'w2'), { contour })
    return doc
  }
  it('glass traced as if it were the rough opening: the hole is one frame profile wider each side, ESTIMATED and said', () => {
    const frame = w2(withContour('FRAME'))
    const glass = w2(withContour('GLASS'))
    expect((glass?.widthM.value ?? 0) - (frame?.widthM.value ?? 0)).toBeCloseTo(0.14, 3)
    expect((frame?.offsetM.value ?? 0) - (glass?.offsetM.value ?? 0)).toBeCloseTo(0.07, 3)
    expect(glass?.widthM.basis).toBe('ESTIMATED')
    expect(frame?.widthM.basis).not.toBe('ESTIMATED')
    expect(resolved(withContour('GLASS')).verification.knownDefects.some((k) => k.code === 'OPENING_GLASS_CONTOUR')).toBe(true)
  })
  it('a box traced round only what is exposed (a shadow or railing at the low end): the low end is ESTIMATED, not seen', () => {
    const doc = withContour('EXPOSED')
    Object.assign(front(doc).openings.find((o: Doc) => o.id === 'w2'), { headLeftY: 222, headRightY: 258 })
    const r = resolved(doc)
    const o = r.geometry.openings.find((q) => q.refs.includes('el-front/w2'))
    const ends = [o?.heightM.basis, o?.head?.kind === 'RAKED' ? o.head.heightFarM.basis : undefined]
    expect(ends).toContain('ESTIMATED')
    expect(r.verification.knownDefects.some((k) => k.code === 'OPENING_HEAD_END_HIDDEN')).toBe(true)
  })
  it('a door read with one leaf where the source shows two keeps what was read (one panel) — the count is not invented', () => {
    const doc = manual()
    Object.assign(front(doc).openings.find((o: Doc) => o.id === 'd1'), { kind: 'GLAZED_DOOR', mullionsX: [], doorLeaves: 1, contour: 'FRAME' })
    const h = compileHouse(doc, 'v35410-leaf')
    const id = h.document.geometry?.openings.find((q) => q.refs.includes('el-front/d1'))?.id
    const door = (h.built?.program ?? []).find((c) => c.type === 'placeDoor' && (c as Doc).openingId === id) as Doc | undefined
    expect(door?.assembly.panels).toHaveLength(1)
  })
})

describe('v3.54.10 the interior read from a storey\'s plan is merged into an import without removing it', () => {
  const local = { level: 1, walls: [{ id: 'L-w1', a: { x: 0, z: 3 }, b: { x: 6, z: 3 }, thickness: 0.12 }], doors: [], rooms: [{ id: 'L-r1', polygon: [{ x: 0, z: 0 }, { x: 6, z: 0 }, { x: 6, z: 3 }, { x: 0, z: 3 }] }], stairs: [], voids: [], dropped: [] }
  it('cause: a partition the import lacks is added, butted on the import\'s partition; the room it splits keeps the imported id for its larger part', () => {
    const plan = { level: 1, walls: [{ id: 'p1', a: { x: 4, z: 0.2 }, b: { x: 4, z: 3 }, thickness: 0.12 }], doors: [], rooms: [{ id: 'pa', polygon: [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 3 }, { x: 0, z: 3 }], usage: 'Room' }, { id: 'pb', polygon: [{ x: 4, z: 0 }, { x: 6, z: 0 }, { x: 6, z: 3 }, { x: 4, z: 3 }], usage: 'Wardrobe' }], stairs: [], voids: [], dropped: [] }
    const m = mergePlanLevel(local as never, plan as never, new Set())
    expect(m.level.walls.map((w) => w.id)).toEqual(['L-w1', 'plan-p1'])
    expect(m.level.walls[1].b.z).toBeCloseTo(3 - 0.06 - 0.002, 4)
    expect(m.level.rooms.map((r) => r.id)).toEqual(['L-r1', 'L-r1-pb'])
    expect(m.level.origin).toBe('LOCAL+PLAN')
  })
  it('counter: the same partition read on the plan is not built twice; an open zone adds no wall', () => {
    const plan = { level: 1, walls: [{ id: 'p1', a: { x: 0.1, z: 3.05 }, b: { x: 5.9, z: 3.05 }, thickness: 0.12 }], doors: [], rooms: [{ id: 'pa', polygon: local.rooms[0].polygon }], stairs: [], voids: [], dropped: [] }
    const m = mergePlanLevel(local as never, plan as never, new Set(['pa']))
    expect(m.level.walls).toHaveLength(1)
    expect(m.added.walls).toBe(0)
  })
  it('a storey plan registered on the house adds its partition and doors through the normal resolver and builder', () => {
    const doc = withStorey(manual(), 0, { partitions: [{ id: 'p0-w1', a: px(1.42, 2.5), b: px(6.0, 2.5), thicknessPx: 4.8 }], doors: [{ id: 'p0-d1', at: px(3.0, 2.5), widthPx: 32 }], rooms: [{ id: 'p0-r1', polygon: [px(1.42, 0.4), px(6, 0.4), px(6, 2.5), px(1.42, 2.5)], name: 'Kitchen', open: false }] })
    const h = compileHouse(doc, 'v35410-storey')
    const lv = h.document.geometry?.interior.levels.find((l) => l.level === 0)
    expect(lv?.origin).toBe('PLAN')
    expect(lv?.walls).toHaveLength(1)
    expect(lv?.doors).toHaveLength(1)
    expect(h.document.geometry?.interior.read?.[0]).toMatchObject({ level: 0, status: 'PLACED' })
    expect((h.built?.model as unknown as { walls: Doc[] }).walls.filter((w) => w.kind === 'INTERIOR')).toHaveLength(1)
  })
})

describe('v3.54.10 typed review corrections for zones and opening details', () => {
  const sent = [{ picture: { id: 'front' }, scale: 1 }] as never
  it('SET_ZONE adds a zone the resolver consumes; REMOVE_ZONE removes it; SET_OPENING_DETAIL sets the divisions', () => {
    const doc = manual()
    front(doc).picture = 'front'
    const a = applyCorrection(doc, { op: 'SET_ZONE', why: 'dark band', picture: 1, box: { x0: 126, y0: 200, x1: 424, y1: 230 }, material: 'PLASTER', tone: 'DARK' }, sent) as { doc: Doc }
    expect(front(a.doc).zones).toHaveLength(1)
    expect(resolved(a.doc).geometry.zones.length).toBeGreaterThan(0)
    const b = applyCorrection(a.doc, { op: 'REMOVE_ZONE', why: 'shadow', picture: 1, id: front(a.doc).zones[0].id }, sent) as { doc: Doc }
    expect(front(b.doc).zones).toHaveLength(0)
    const c = applyCorrection(doc, { op: 'SET_OPENING_DETAIL', why: 'two panes', picture: 1, id: 'w2', mullionsX: [265] }, sent) as { doc: Doc }
    expect(front(c.doc).openings.find((o: Doc) => o.id === 'w2').mullionsX).toEqual([265])
  })
})
