/**
 * v3.54.8 — API parameters to final geometry: each value the source gives reaches the built scene as that value, or is
 * held with its reason. Railing infill (glass stays glass, a convention is said), the frame's two legs ending where each
 * one ends, its band measured vertically and across the slope, one plate joined at the ridge, a leg standing on the
 * slab it carries, the portal band over an open front, the data boundary between the program and the scene, and the
 * review judged per corrected property and per revision. The fixture is the hand-checked description of one house
 * (MANUAL_DIAGNOSTIC, test path only), its main roof turned so its gable faces the front; every case changes it in one
 * named way. No test calls a provider.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseHouseDocument, resolveHouse } from '@buildapp/reconstruction'
import { compileHouse, deliveredQuality, RAILING_NOTE_PATTERNS } from '../src/house/describe.js'
import type { CompiledHouse } from '../src/house/describe.js'
import { checkProperties, neighboursKept, reviewHouse } from '../src/house/review.js'
import type { ReviewAnswer } from '../src/house/review.js'
import type { SceneMeasure } from '../src/house/measure.js'
import type { ReadingContext, ReadingRecord, Selection } from '../src/house/read.js'
import type { HousePicture } from '../src/house/pictures.js'
import type { Raster } from '@buildapp/source-package'

const ROOT = join(__dirname, '..', '..', '..')
type Doc = Record<string, any>
const el = (doc: Doc, id: string): Doc => doc.observations.elevations.find((e: Doc) => e.id === id)
const front = (h: CompiledHouse) => h.measured?.sides.find((x) => x.side === 'FRONT')
const notes = (h: CompiledHouse, code: string) => h.document.verification.knownDefects.filter((k) => k.code === code)
const held = (h: CompiledHouse, ref: RegExp) => h.document.verification.held.filter((x) => ref.test(x.ref))
const param = (h: CompiledHouse, path: string) => h.document.verification.parameters.find((p) => p.path === path)
const check = (h: CompiledHouse) => h.document.verification.checks.find((c) => c.id === 'facade-values-built')

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
// the front elevation: 0.0329 m/px, ground at row 298, the first floor (+3.04) at row ≈ 205.7; the main body spans
// columns 126–424 (1.02–10.84 m) and its front steps back 1.51 m from x 7.24 m
const FRAME = { id: 'frame', kind: 'GABLE_FRAME', box: { x0: 126, y0: 45, x1: 424, y1: 298 }, bodyId: 'main', bandPx: 10, legPx: 8 }
const TERRACE = { id: 'terrace', kind: 'BALCONY', box: { x0: 316, y0: 172, x1: 424, y1: 206 }, bodyId: 'main', posts: false }
/** Observations → agreed geometry (the production resolver), for a case that then sets one agreed value by hand. */
function resolved(doc: Doc): Doc {
  const p = parseHouseDocument(doc)
  if (!p.ok) throw new Error('fixture rejected')
  const r = resolveHouse(p.document)
  return { ...p.document, geometry: r.geometry, verification: r.verification }
}

describe('v3.54.8 the railing infill the source gives is the infill built', () => {
  const withTerrace = (fields: Doc): CompiledHouse => {
    const doc = gableFront()
    el(doc, 'el-front').features.push({ ...TERRACE, ...fields })
    return compileHouse(doc, 't')
  }
  it('cause: a glass railing read on the elevation is built as glass — not the kernel\'s bars (the v3.54.7 loss)', () => {
    const h = withTerrace({ railing: 'GLASS', railingFrom: 'READ' })
    const b = h.document.geometry?.balconies[0]
    expect(b?.railingInfill?.value).toBe('GLASS')
    expect(b?.railingInfill?.basis).toBe('READ')
    expect(front(h)?.railings?.[0]?.infill).toBe('GLASS')
    expect(notes(h, 'RAILING_INFILL_ASSUMED')).toHaveLength(0)
    expect(param(h, `geometry.balconies[${b?.id}].railingInfill`)?.consumer).toMatch(/infill GLASS/)
    expect(check(h)?.status).toBe('PASS')
  })
  it('cause: a glass railing named only in the note keeps its provenance (NOTE) and is built as glass', () => {
    const h = withTerrace({ railing: 'GLASS', railingFrom: 'NOTE', railingNote: 'glass railing' })
    expect(h.document.geometry?.balconies[0]?.railingInfill?.basis).toBe('NOTE')
    expect(front(h)?.railings?.[0]?.infill).toBe('GLASS')
  })
  it('counter: a real bar railing stays bars — the change is no rule "railings are glass"', () => {
    const h = withTerrace({ railing: 'BARS', railingFrom: 'READ' })
    expect(front(h)?.railings?.[0]?.infill).toBe('BARS')
    expect(notes(h, 'RAILING_INFILL_ASSUMED')).toHaveLength(0)
  })
  it('counter: an infill not read stays unknown in the agreed geometry; the drawn bars are a convention, said', () => {
    const h = withTerrace({})
    const b = h.document.geometry?.balconies[0]
    expect(b?.railingInfill?.value ?? null).toBeNull()
    expect(b?.railingInfill?.basis).toBe('UNKNOWN')
    expect(front(h)?.railings?.[0]?.infill).toBe('BARS')
    expect(notes(h, 'RAILING_INFILL_ASSUMED')).toHaveLength(1)
  })
  it('the note patterns: glazed or glass railings are glass, balusters are bars; glass doors behind a railing say nothing', () => {
    const kind = (note: string) => RAILING_NOTE_PATTERNS.find((p) => p.re.test(note))?.kind ?? null
    expect(kind('glass railing of the terrace')).toBe('GLASS')
    expect(kind('Glass-railed balcony')).toBe('GLASS')
    expect(kind('glazed balustrade')).toBe('GLASS')
    expect(kind('steel balusters')).toBe('BARS')
    expect(kind('a railing in front of glass doors')).toBeNull()
    expect(kind('glazing behind the balcony')).toBeNull()
  })
  it('a read top row is the railing\'s height; with none the default is said as DEFAULT, never as read', () => {
    const read = withTerrace({ railing: 'GLASS', railingFrom: 'READ', railingTopY: 176 })
    expect(read.document.geometry?.balconies[0]?.railingHeightM?.basis).toBe('DERIVED')
    expect(front(read)?.railings?.[0]?.topY).toBeCloseTo(3.04 + (read.document.geometry?.balconies[0]?.railingHeightM?.value ?? 0), 2)
    const none = withTerrace({ railing: 'GLASS', railingFrom: 'READ' })
    expect(none.document.geometry?.balconies[0]?.railingHeightM?.basis).toBe('DEFAULT')
  })
})

describe('v3.54.8 the gable frame: two legs, one band, one plate joined at the ridge', () => {
  it('cause: each leg read on its own row ends at its own height — one row for both is ESTIMATED, not this leg\'s', () => {
    const doc = gableFront()
    el(doc, 'el-front').features.push({ ...FRAME, legLeftBottomY: 298, legRightBottomY: 205.7 })
    const r = resolved(doc)
    expect(r.geometry.frames[0].legLeftBottomY.basis).toBe('DERIVED')
    expect(r.geometry.frames[0].legRightBottomY.basis).toBe('DERIVED')
    // (the elevation registers its ±0 a few rows above its ground line: the two ends differ by the first floor's rise)
    expect(r.geometry.frames[0].legRightBottomY.value - r.geometry.frames[0].legLeftBottomY.value).toBeCloseTo(3.04, 1)
    const one = gableFront()
    el(one, 'el-front').features.push({ ...FRAME, legBottomY: 298 })
    const r1 = resolved(one)
    expect(r1.geometry.frames[0].legLeftBottomY.basis).toBe('ESTIMATED')
    expect(r1.geometry.frames[0].legRightBottomY.basis).toBe('ESTIMATED')
  })
  it('cause: the band is read vertically; across the slope it is that × cos(pitch), and the scene measures both', () => {
    const doc = gableFront()
    el(doc, 'el-front').features.push({ ...FRAME, legBottomY: 298 })
    const h = compileHouse(doc, 't')
    const f = h.document.geometry?.frames[0]
    expect(f?.bandPx).toBe(10)
    expect(f?.bandM.value).toBeCloseTo(10 * (f?.bandMPerPx ?? 0), 3)
    const m = front(h)?.frame
    expect(m?.bandVQ1).toBeCloseTo(f?.bandM.value ?? 0, 2)
    expect(m?.bandPerp).toBeCloseTo((m?.bandVQ1 ?? 0) * Math.cos(((m?.pitchDeg ?? 0) * Math.PI) / 180), 2)
  })
  it('cause: one plate, joined at the ridge — the apex is continuous, nothing stands above the roof, and the ruler finds the apex where the roof has it', () => {
    const doc = gableFront()
    el(doc, 'el-front').features.push({ ...FRAME, legBottomY: 298 })
    const h = compileHouse(doc, 't')
    const m = front(h)?.frame
    expect(m?.pieces).toBe(1)
    expect(m?.apexContinuous).toBe(true)
    expect(m?.protrusionM ?? 1).toBeLessThanOrEqual(0.01)
    expect(Math.abs((m?.apexAlong ?? 0) - ((m?.alongFrom ?? 0) + (m?.alongTo ?? 0)) / 2)).toBeLessThan(0.15)
  })
  it('a leg with nothing under it on the plan and nothing it could stand on is held (SOURCE_UNKNOWN), not drawn to the ground', () => {
    const doc = gableFront()
    el(doc, 'el-front').features.push({ ...FRAME, legBottomY: 298 })
    const h = compileHouse(doc, 't')
    // the main body's front steps back 1.51 m on the right: no ground under the right leg
    expect(held(h, /legRightBottomY$/)[0]?.code).toBe('SOURCE_UNKNOWN')
    expect(front(h)?.frame?.legLeftBottom).toBeCloseTo(param(h, 'geometry.frames[frame-main-front].legLeftBottomY')?.built ?? NaN, 1)
  })
  it('counter: a leg read to end at or above the band\'s inner edge is no leg: held as WRONG_READ, not built', () => {
    const doc = gableFront()
    el(doc, 'el-front').features.push({ ...FRAME, legLeftBottomY: 60, legRightBottomY: 298 })
    const h = compileHouse(doc, 't')
    expect(held(h, /legLeftBottomY$/)[0]?.code).toBe('WRONG_READ')
    expect(check(h)?.status === 'FAIL').toBe(false)
  })
  it('cause: a leg over an open front stands on the slab that reaches it; the slab is carried under the leg and the railing stops at its inner face', () => {
    const doc = gableFront()
    el(doc, 'el-front').features.push({ ...FRAME, legBottomY: 298 }, { ...TERRACE, railing: 'GLASS', railingFrom: 'READ' })
    const r = resolved(doc)
    // agreed by hand (the case's one change): the slab reaches the frame's plane, as a loggia under the leg does
    const b = r.geometry.balconies[0]
    b.rect.z0 = 0
    b.rect.x1 = 10.5
    const h = compileHouse(r, 't')
    expect(notes(h, 'FRAME_LEG_ON_SLAB')).toHaveLength(1)
    expect(front(h)?.frame?.legRightBottom).toBeCloseTo(3.04, 1)
    const slab = h.measured?.sides.find((s) => s.side === 'FRONT')?.balconies.find((x) => x.id === b.id)
    expect(slab?.alongTo ?? 0).toBeGreaterThan(10.8)
    const rail = front(h)?.railings?.[0]
    expect(rail?.alongTo ?? 99).toBeLessThanOrEqual(10.84 - 0.26 + 0.02)
    expect(rail?.infill).toBe('GLASS')
    expect(check(h)?.status).toBe('PASS')
  })
})

describe('v3.54.8 the portal band over an open front', () => {
  const PORTAL = { id: 'portal', kind: 'PORTAL_BAND', box: { x0: 316, y0: 205, x1: 603, y1: 228 }, bodyId: 'main' }
  it('cause: a portal band read is one band from its soffit to its top along the side, measured continuous', () => {
    const doc = gableFront()
    el(doc, 'el-front').features.push(PORTAL)
    const h = compileHouse(doc, 't')
    const p = h.document.geometry?.portals[0]
    expect((p?.topY.value ?? 0) - (p?.soffitY.value ?? 0)).toBeCloseTo((228 - 205) * 0.03295, 1)
    expect(p?.soffitY.basis).toBe('DERIVED')
    expect(h.built?.fitted.some((c) => (c as { id?: string }).id?.startsWith(`${p?.id}-`))).toBe(true)
    expect(check(h)?.status).toBe('PASS')
  })
  it('a band read across a stretch where the plan has wall stands only over the open front — no second solid in the wall', () => {
    const doc = gableFront()
    // read from the main body's flush front (columns 126–316, the plan's wall at z = 0) across to the garage
    el(doc, 'el-front').features.push({ ...PORTAL, box: { ...PORTAL.box, x0: 140 } })
    const h = compileHouse(doc, 't')
    const p = h.document.geometry?.portals[0]
    const solids = (h.built?.fitted ?? []).filter((c) => (c as { id?: string }).id?.startsWith(`${p?.id}-`)) as unknown as Array<{ start: { x: number }; end: { x: number } }>
    expect(solids.length).toBeGreaterThan(0)
    // the main body's front stands at z = 0 up to x 7.24 m: the band begins where the front opens
    expect(Math.min(...solids.flatMap((c) => [c.start.x, c.end.x]))).toBeGreaterThan(7.1)
  })
  it('counter: a "band" with its soffit below a door head is not a head over an open front — held', () => {
    const doc = gableFront()
    el(doc, 'el-front').features.push({ ...PORTAL, box: { ...PORTAL.box, y0: 250, y1: 270 } })
    const h = compileHouse(doc, 't')
    expect(h.document.geometry?.portals).toEqual([])
    expect(h.document.verification.held.some((x) => x.ref.endsWith('/portal') && x.code === 'PARSE_REJECTED')).toBe(true)
  })
})

describe('v3.54.8 a balcony read clear of the wall keeps its railing', () => {
  it('cause: no edge on the house — the nearest edge is the house side, three are railed, and it is said', () => {
    const doc = gableFront()
    el(doc, 'el-front').features.push({ ...TERRACE, railing: 'GLASS', railingFrom: 'READ' })
    const r = resolved(doc)
    Object.assign(r.geometry.balconies[0].rect, { x0: 7.6, z1: 1.2 }) // 0.31 m short of the wall behind it, clear of the step
    const h = compileHouse(r, 't')
    expect(notes(h, 'BALCONY_OFF_THE_WALL')).toHaveLength(1)
    expect(front(h)?.railings?.[0]?.infill).toBe('GLASS')
  })
})

describe('v3.54.8 the review: per property, per revision', () => {
  const M = (frame: Doc | null, railings: Doc[] = [], openings: Doc[] = []): SceneMeasure => ({ sides: [{ side: 'FRONT', frame, balconies: [], shapedOpenings: [], railings }], openings } as unknown as SceneMeasure)
  const F = { mPerPx: 0.02, alongAtPx0: 0, zeroRowPx: 500 }
  it('a frame correction is IMPROVED only in the properties it set: a good box with the wrong band is not', () => {
    const c = { op: 'SET_FEATURE', why: '', kind: 'GABLE_FRAME', bandPx: 40, legLeftBottomY: 500, legRightBottomY: 347 }
    const before = M({ bandVQ1: 1.0, legLeftBottom: 4.8, legRightBottom: 4.8 })
    const good = checkProperties(c, F, 'FRONT', before, M({ bandVQ1: 0.8, legLeftBottom: 0, legRightBottom: 3.06 }))
    expect(good.every((p) => p.state === 'IMPROVED')).toBe(true)
    // the extent right (frame present) but the band as wide as before and one leg still short of its row
    const bad = checkProperties(c, F, 'FRONT', before, M({ bandVQ1: 1.0, legLeftBottom: 0, legRightBottom: 4.8 }))
    expect(bad.find((p) => p.property === 'frame band (vertical)')?.state).toBe('NOT_IMPROVED')
    expect(bad.find((p) => p.property === 'frame right leg end')?.state).toBe('NOT_IMPROVED')
  })
  it('a railing correction to glass is IMPROVED only when the built infill is glass', () => {
    const c = { op: 'SET_FEATURE', why: '', kind: 'BALCONY', box: { x0: 100, y0: 300, x1: 300, y1: 340 }, railing: 'GLASS' }
    const bars = M(null, [{ id: 'r', alongFrom: 2, alongTo: 6, infill: 'BARS', topY: 4.1, bottomY: 3 }])
    const glass = M(null, [{ id: 'r', alongFrom: 2, alongTo: 6, infill: 'GLASS', topY: 4.1, bottomY: 3 }])
    expect(checkProperties(c, F, 'FRONT', bars, bars)[0].state).toBe('NOT_IMPROVED')
    expect(checkProperties(c, F, 'FRONT', bars, glass)[0].state).toBe('IMPROVED')
  })
  it('neighbour protection: a correction that moves another side\'s holes is not kept', () => {
    const o = (side: string, a: number) => ({ id: `${side}${a}`, side, alongM: a })
    expect(neighboursKept(M(null, [], [o('REAR', 1)]), M(null, [], [o('REAR', 1.02)]), 'FRONT').ok).toBe(true)
    expect(neighboursKept(M(null, [], [o('REAR', 1)]), M(null, [], [o('REAR', 1.6)]), 'FRONT').ok).toBe(false)
    // a hole gained on another side is no neighbour lost (a side reassigned brings its openings with it)
    expect(neighboursKept(M(null, [], []), M(null, [], [o('REAR', 1), o('REAR', 3)]), 'FRONT').ok).toBe(true)
  })
  it('a recorded answer about another revision is STALE_DEPENDENCY: nothing applied, and the round log says the answer is older than the house', async () => {
    const raster = (w: number, h: number): Raster => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4).fill(240) })
    const pic = (id: string, n: number): HousePicture => ({ n, id, assetId: `a-${id}`, caption: '', pageRole: { document: 'ELEVATION', storey: '', view: '' }, width: 700, height: 304, byteHash: `h-${id}`, raster: raster(700, 304) })
    const selection: Selection = { ground: pic('plan0', 1), upperPlans: [], sections: [], elevations: [pic('front', 4), pic('rear', 5)], views: [], notThisHouse: [] }
    const answer: ReviewAnswer = { revision: 'aaaaaaaaaaaa', verdict: 'DIFFERS', differences: [], defects: [], corrections: [{ op: 'SET_FEATURE', why: 'frame', picture: 1, id: 'frame', kind: 'GABLE_FRAME', box: FRAME.box, bodyId: 'main', bandPx: 10, legPx: 8 }] }
    const ctx: ReadingContext = {
      modelFor: () => ({ model: 'none', send: async () => { throw new Error('no provider in tests') } }) as never,
      price: { inputUsdPerMTok: 0, outputUsdPerMTok: 0 },
      replayOnly: true,
      replay: (_s, round): ReadingRecord | undefined => (round === 1 ? { step: 'REVIEW', round, model: 'none', usage: { inputTokens: 0, outputTokens: 0 }, pictures: selection.elevations.map((p) => ({ id: p.id, assetId: p.assetId, sentWidth: p.width, sentHeight: p.height, sha256: '' })), promptSha256: '', answer } : undefined),
      record: () => {},
    }
    const doc = gableFront()
    const compiled = compileHouse(JSON.parse(JSON.stringify(doc)), 't')
    const r = await reviewHouse({ ctx, selection, facadesSent: [], observationsDocument: doc, compiled, modelId: 't' })
    expect(r.proposals[0]?.code).toBe('STALE_DEPENDENCY')
    expect(r.compiled.modelHash).toBe(compiled.modelHash)
    expect(r.roundLog[0]?.stale).toBe(true)
    expect(r.roundLog[0]?.staleWhy).toMatch(/recorded answer/)
    expect(r.roundLog[0]?.inputModelHash).toBe(compiled.modelHash)
  })
  it('a round that applies a correction logs the model it was shown and the model it made — two hashes, two revisions', async () => {
    const raster = (w: number, h: number): Raster => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4).fill(240) })
    const pic = (id: string, n: number): HousePicture => ({ n, id, assetId: `a-${id}`, caption: '', pageRole: { document: 'ELEVATION', storey: '', view: '' }, width: 700, height: 304, byteHash: `h-${id}`, raster: raster(700, 304) })
    const selection: Selection = { ground: pic('plan0', 1), upperPlans: [], sections: [], elevations: [pic('front', 4), pic('rear', 5)], views: [], notThisHouse: [] }
    const doc = gableFront()
    const { createHash } = await import('node:crypto')
    const revision = createHash('sha256').update(JSON.stringify(doc.observations, (k, v) => (k === 'readIn' ? undefined : v))).digest('hex').slice(0, 12)
    const answer: ReviewAnswer = { revision, verdict: 'DIFFERS', differences: [], defects: [{ id: 'd1', side: 'FRONT', picture: 1, box: { x0: 120, y0: 40, x1: 430, y1: 300 }, feature: 'GABLE_FRAME', meaning: 'MISSING', weight: 'KEY', evidence: 'a band along both rakes', fix: 'CORRECTION', corrections: [0] }], corrections: [{ op: 'SET_FEATURE', why: 'frame', picture: 1, id: 'frame', kind: 'GABLE_FRAME', box: FRAME.box, bodyId: 'main', bandPx: 10, legPx: 8 }] }
    const ctx: ReadingContext = {
      modelFor: () => ({ model: 'none', send: async () => { throw new Error('no provider in tests') } }) as never,
      price: { inputUsdPerMTok: 0, outputUsdPerMTok: 0 },
      replayOnly: true,
      replay: (_s, round): ReadingRecord | undefined => (round === 1 ? { step: 'REVIEW', round, model: 'none', usage: { inputTokens: 0, outputTokens: 0 }, pictures: selection.elevations.map((p) => ({ id: p.id, assetId: p.assetId, sentWidth: p.width, sentHeight: p.height, sha256: '' })), promptSha256: '', answer } : undefined),
      record: () => {},
    }
    const compiled = compileHouse(JSON.parse(JSON.stringify(doc)), 't')
    const r = await reviewHouse({ ctx, selection, facadesSent: [], observationsDocument: doc, compiled, modelId: 't' })
    const first = r.roundLog[0]
    expect(first?.applied).toBe(1)
    expect(first?.inputModelHash).toBe(compiled.modelHash)
    expect(first?.outputModelHash).toBe(r.compiled.modelHash)
    expect(first?.inputModelHash).not.toBe(first?.outputModelHash)
    expect(first?.baseRevision).toBe(revision)
    expect(first?.outputRevision).not.toBe(revision)
    expect(first?.renderSha256.length).toBeGreaterThan(0)
  })
})

describe('v3.54.8 the tools the provider is sent are schemas it takes', () => {
  it('no enum holds a value its declared type does not (the provider refused `railing` with null in its enum, unbilled)', async () => {
    const { READING_TOOLS } = await import('../src/house/read.js')
    const { REVIEW_TOOL, SUPPLEMENT_TOOL } = await import('../src/house/review.js')
    const bad: string[] = []
    const walk = (n: unknown, at: string): void => {
      if (Array.isArray(n)) return n.forEach((x, i) => walk(x, `${at}[${i}]`))
      if (!n || typeof n !== 'object') return
      const o = n as { type?: string | string[]; enum?: unknown[] }
      if (Array.isArray(o.enum)) {
        const types = Array.isArray(o.type) ? o.type : o.type ? [o.type] : []
        for (const v of o.enum) if (types.length && !types.includes(v === null ? 'null' : typeof v === 'number' ? (Number.isInteger(v) && types.includes('integer') ? 'integer' : 'number') : typeof v)) bad.push(`${at}: ${JSON.stringify(v)}`)
        if (o.enum.includes(null)) bad.push(`${at}: null in an enum`)
      }
      for (const [k, v] of Object.entries(n)) walk(v, `${at}.${k}`)
    }
    for (const [k, t] of Object.entries(READING_TOOLS)) walk(t, k)
    walk(REVIEW_TOOL, 'REVIEW')
    walk(SUPPLEMENT_TOOL, 'SUPPLEMENT')
    expect(bad).toEqual([])
  })
})

describe('v3.54.8 the quality status says what was not checked, and why', () => {
  it('a refused description\'s readings are named as not held — never as "nothing was read"', () => {
    const base = { accepted: 'LOCAL', findings: [], unknown: [] } as unknown as Parameters<typeof deliveredQuality>[0]
    const refused = deliveredQuality({ ...base, code: 'DESCRIBED_REJECTED_LOCAL_KEPT' } as never)
    expect(refused.status).toBe('FEATURES_NOT_CHECKED')
    expect(refused.why).toMatch(/failed its own source checks/)
    const plain = deliveredQuality({ ...base, code: 'LOCAL_MEETS_SOURCE' } as never)
    expect(plain.why).toMatch(/no characteristic feature was read/)
  })
})
