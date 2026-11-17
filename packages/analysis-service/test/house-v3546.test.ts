/**
 * v3.54.6 — from the source to the model handed back: the causes found on the saved answers of the v3.54.5 confirmation,
 * each with a counter-trial. The fixture is the hand-checked description of one house (MANUAL_DIAGNOSTIC, test path
 * only); every case damages or extends it in one named way. Pictures are synthetic rasters. No test calls a provider.
 */
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { encodeJpeg, startDecoders } from '@buildapp/source-package'
import type { Raster } from '@buildapp/source-package'
import { heightAgainstFigure, RESOLVE } from '../../reconstruction/src/house/resolve.js'
import { OPENING_FIT } from '../../reconstruction/src/house/program.js'
import { arbitrate, compileHouse, openingsAgainstElevation } from '../src/house/describe.js'
import type { CompiledHouse, LocalMeasure } from '../src/house/describe.js'
import { headCapFor } from '../src/house/build.js'
import { greyShare, housePictures, PICTURE_LIMITS, renditionKey } from '../src/house/pictures.js'
import type { HousePicture, PackageAsset } from '../src/house/pictures.js'
import { acceptedBinding, bindingDiffers, fileAcceptedStore } from '../src/house/accepted.js'
import { acceptCorrection } from '../src/house/review.js'

const ROOT = join(__dirname, '..', '..', '..')
const manual = (): Record<string, any> => JSON.parse(readFileSync(join(ROOT, 'research/source-to-model/v3544/manual/gracja.house.json'), 'utf8'))
const el = (doc: Record<string, any>, id: string): Record<string, any> => doc.observations.elevations.find((e: any) => e.id === id)
const check = (h: CompiledHouse, id: string) => h.document.verification.checks.find((c) => c.id === id)
const defects = (h: CompiledHouse, code: string) => h.document.verification.knownDefects.filter((k) => k.code === code)
const PUBLISHED = [{ key: 'building_height', value: 8.6, unit: 'm' }]
const GOOD_LOCAL: LocalMeasure = { widthM: 16.8, depthM: 10.1, heightAboveTerrainM: null, topAboveGroundFloorM: 8.1, groundAreaM2: 133, roofPlanes: 4 }

describe('v3.54.6 one definition of the building height', () => {
  it('cause: a page figure is the top above the terrain; without a terrain mark it implies a terrain, within a band', () => {
    // Pliszka: top +6.34 m above ±0,00 against a published 6,71 m — the terrain it implies is 0.37 m below ±0,00
    const r = heightAgainstFigure(6.34, { value: -0.3, basis: 'DEFAULT' }, 6.71, 0.35)
    expect(r.ok).toBe(true)
    expect(r.heightM).toBeNull()
    expect(r.says).toMatch(/no terrain mark/)
  })
  it('counter: a real conflict is not absorbed by the band — a figure 2.5 m above the top fails', () => {
    expect(heightAgainstFigure(6.3, { value: null, basis: 'DEFAULT' }, 8.8, 0.35).ok).toBe(false)
    // and a top ABOVE the figure (a terrain above ±0,00) beyond the tolerance fails as well
    expect(heightAgainstFigure(7.4, { value: null, basis: 'DEFAULT' }, 6.71, 0.35).ok).toBe(false)
  })
  it('a printed terrain makes it exact: the height is the top less the terrain', () => {
    const r = heightAgainstFigure(8.13, { value: -0.45, basis: 'PRINTED' }, 8.6, 0.35)
    expect(r.heightM).toBeCloseTo(8.58, 6)
    expect(r.ok).toBe(true)
    expect(heightAgainstFigure(8.13, { value: -0.45, basis: 'PRINTED' }, 9.4, 0.35).ok).toBe(false)
  })
  it('cause: a page figure the reader echoes on a PLAN picture is not a print of a section', () => {
    const doc = manual()
    doc.observations.levels = doc.observations.levels.filter((l: any) => l.meaning !== 'TOTAL_HEIGHT')
    doc.observations.levels.push({ id: 'echo', picture: 'plan0', literal: '6,71', valueM: 6.71, meaning: 'TOTAL_HEIGHT', origin: 'API' })
    const h = compileHouse(doc, 't')
    const printed = check(h, 'height-printed')
    expect(printed === undefined || printed.status !== 'FAIL').toBe(true)
    expect(check(h, 'height-published')?.status).toBe('PASS')
  })
  it('the same rule holds LOCAL and the description: LOCAL is not given a terrain convention the description is not', () => {
    const h = compileHouse(manual(), 't')
    const d = arbitrate(h, GOOD_LOCAL, PUBLISHED)
    const f = d.findings.find((x) => x.fact === 'building height above the terrain')
    expect(f?.source).toMatch(/one definition for both/)
    expect(f?.localOk).toBe(true)
    // a LOCAL 1.5 m too low is not saved by an added 0.3 m
    expect(arbitrate(h, { ...GOOD_LOCAL, topAboveGroundFloorM: 6.6 }, PUBLISHED).findings.find((x) => x.fact === 'building height above the terrain')?.localOk).toBe(false)
  })
})

describe('v3.54.6 an elevation whose inner ends miss registers on its outer ends at the set\'s scale', () => {
  const shifted = (): Record<string, any> => {
    const doc = manual()
    const f = el(doc, 'el-front')
    // the garage's roof read for its wall: the main/garage end 50 px (about 1.5 m) off the plan's
    f.bodies.find((b: any) => b.bodyId === 'main').rightX = 474
    f.bodies.find((b: any) => b.bodyId === 'garage').leftX = 474
    return doc
  }
  it('cause: before, it did not register and everything on it was held', () => {
    const h = compileHouse(shifted(), 't')
    expect(check(h, 'elevation-el-front')?.status).toBe('PASS')
    expect(defects(h, 'ELEVATION_INNER_ENDS_OFF').some((k) => /el-front/.test(k.what) && /garage left|main right/.test(k.what))).toBe(true)
    expect(h.document.verification.views.find((v) => v.elevation === 'el-front')?.registered).toBe(true)
  })
  it('counter: outer ends at a scale off the set\'s are not registered', () => {
    const doc = shifted()
    el(doc, 'el-front').bodies.find((b: any) => b.bodyId === 'bay').leftX = 95 - 60
    const h = compileHouse(doc, 't')
    expect(check(h, 'elevation-el-front')?.status).toBe('FAIL')
    expect(check(h, 'elevation-el-front')?.measured).toMatch(/off the set's/)
  })
  it('counter: without another elevation registered on three or more ends there is no set scale, and nothing registers on two ends alone', () => {
    const doc = shifted()
    doc.observations.elevations = doc.observations.elevations.filter((e: any) => e.id === 'el-front')
    const h = compileHouse(doc, 't')
    expect(check(h, 'elevation-el-front')?.status).toBe('FAIL')
    expect(check(h, 'elevation-el-front')?.measured).toMatch(/no elevation of the set registers/)
  })
  it('counter: an elevation that registers on its own is not touched', () => {
    const h = compileHouse(manual(), 't')
    expect(defects(h, 'ELEVATION_INNER_ENDS_OFF')).toHaveLength(0)
    expect(RESOLVE.sharedScale).toBeLessThanOrEqual(0.03)
  })
})

describe('v3.54.6 a glazing whose head follows a gable', () => {
  it('cause: a head above its wall\'s top is lowered to it within the opening rule and said', () => {
    // Alaska: read 2.59 m high from a 2.33 m sill to 4.91 m; the gable wall stands 4.61 m over its width
    const r = headCapFor({ sill: 0, height: 4.911 }, 'opening x reaches 4.911 m above the base of wall w, whose top is only 4.561 m there; the opening was not cut and not clipped')
    expect(r?.ok).toBe(true)
    expect((r as { cap: { heightM: number } }).cap.heightM).toBeCloseTo(4.511, 6)
  })
  it('counter: a box that reaches far above its wall (a roof read as glazing) stays out, with the measure', () => {
    // Pliszka rear: 5.11 m read against a 2.84 m wall top — 2.3 m lower is not an approximation
    const r = headCapFor({ sill: 0, height: 5.109 }, 'opening y reaches 5.109 m above the base of wall w, whose top is only 2.842 m there; the opening was not cut and not clipped')
    expect(r?.ok).toBe(false)
    expect((r as { why: string }).why).toMatch(/more than the 0\.60 m/)
    expect(OPENING_FIT.approxM).toBe(0.6)
  })
  it('counter: a message without the kernel\'s measure gives no cap', () => {
    expect(headCapFor({ sill: 0, height: 2 }, 'something else')).toBeUndefined()
  })
  it('cause: a light over a door, as wide, with less than a lintel between them, is one opening', () => {
    const doc = manual()
    const f = el(doc, 'el-front')
    f.openings.push({ id: 'tl', kind: 'GLAZED_DOOR', box: { x0: 470, y0: 240, x1: 520, y1: 292 }, bodyId: 'garage', level: 0 })
    f.openings.push({ id: 'tu', kind: 'WINDOW', box: { x0: 471, y0: 222, x1: 519, y1: 237 }, bodyId: 'garage', level: 0 })
    const h = compileHouse(doc, 't')
    expect(defects(h, 'OPENING_TRANSOM').some((k) => /el-front\/tu stands over el-front\/tl/.test(k.what))).toBe(true)
    expect(h.document.geometry?.openings.filter((o) => o.refs.includes('el-front/tl') || o.refs.includes('el-front/tu'))).toHaveLength(1)
  })
  it('counter: with a lintel\'s height between them they stay two', () => {
    const doc = manual()
    const f = el(doc, 'el-front')
    f.openings.push({ id: 'tl', kind: 'GLAZED_DOOR', box: { x0: 470, y0: 250, x1: 520, y1: 292 }, bodyId: 'garage', level: 0 })
    f.openings.push({ id: 'tu', kind: 'WINDOW', box: { x0: 471, y0: 215, x1: 519, y1: 236 }, bodyId: 'garage', level: 0 })
    const h = compileHouse(doc, 't')
    expect(defects(h, 'OPENING_TRANSOM')).toHaveLength(0)
  })
})

describe('v3.54.6 which pictures are sent when the limit takes a choice', () => {
  beforeAll(async () => {
    await startDecoders()
  })
  const raster = (w: number, h: number, paint: (x: number, y: number) => [number, number, number]): Raster => {
    const data = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
      const [r, g, b] = paint(x, y)
      data.set([r, g, b, 255], (y * w + x) * 4)
    }
    return { width: w, height: h, data }
  }
  const drawing = (k: number, w = 420, h = 300): Raster => raster(w, h, (x, y) => ((x + k * 7) % 37 === 0 || (y + k * 3) % 41 === 0 ? [20, 20, 20] : [250, 250, 250]))
  const render = (k: number): Raster => raster(640, 420, (x, y) => [(40 + k * 9) % 256, (120 + x) % 256, (200 + y + k) % 256])
  const build = (items: Array<{ id: string; role?: string; url: string; r: Raster }>) => {
    const bytes = new Map<string, Uint8Array>()
    const assets: PackageAsset[] = items.map((it, i) => {
      const b = encodeJpeg(it.r, 85)
      bytes.set(it.url, b)
      return { id: it.id, roles: { document: it.role ?? 'UNKNOWN' }, variants: [{ url: it.url, byteHash: `h${i}`, decoded: { width: it.r.width, height: it.r.height } }] }
    })
    return { assets, source: { get: async (url: string) => (bytes.has(url) ? { bytes: bytes.get(url) as Uint8Array } : null) } }
  }
  it('a long file name is one picture in every size; a short one names nothing', () => {
    expect(renditionKey('https://cdn.example/1272x715/designs/1/2/dd30510ef143baeb5070a84c8b6ff068.jpg')).toBe(renditionKey('https://cdn.example/360x240/designs/1/2/dd30510ef143baeb5070a84c8b6ff068.jpg'))
    expect(renditionKey('https://cdn.example/a/image.jpg')).toBeUndefined()
  })
  it('a drawing is grey, a render is not', () => {
    expect(greyShare(drawing(1))).toBeGreaterThan(0.9)
    expect(greyShare(render(1))).toBeLessThan(0.3)
  })
  it('cause: renditions of one picture no longer fill the limit, and unclassified drawings go before renders', async () => {
    const items: Array<{ id: string; role?: string; url: string; r: Raster }> = [{ id: 'plan', role: 'FLOOR_PLAN', url: 'https://x/plan/aaaaaaaaaaaaaaaaaaaaaaaa.png', r: drawing(0, 600, 600) }]
    // 21 renders, each also in a smaller size under the same file name, and 4 small unlabelled elevations
    for (let k = 0; k < 21; k += 1) {
      const name = `render${k}`.padEnd(24, 'r')
      items.push({ id: `r${k}`, url: `https://x/1200/${name}.jpg`, r: render(k) })
      items.push({ id: `r${k}-small`, url: `https://x/736/${name}.jpg`, r: { ...render(k + 100), width: 640, height: 420 } })
    }
    for (let k = 0; k < 4; k += 1) items.push({ id: `el${k}`, url: `https://x/el/${`elevation${k}`.padEnd(24, 'e')}.jpg`, r: drawing(k + 1) })
    const { assets, source } = build(items)
    const { pictures, skipped } = await housePictures(assets, source)
    expect(pictures.length).toBe(PICTURE_LIMITS.maxPictures)
    expect(pictures.map((p) => p.assetId).slice(0, 5)).toEqual(['plan', 'el0', 'el1', 'el2', 'el3'].filter((x) => pictures.some((p) => p.assetId === x)).slice(0, 5))
    for (const k of [0, 1, 2, 3]) expect(pictures.some((p) => p.assetId === `el${k}`)).toBe(true)
    expect(skipped.filter((s) => s.code === 'SAME_PICTURE')).toHaveLength(21)
    expect(skipped.filter((s) => s.code === 'LIMIT').every((s) => /its role is not known/.test(s.why))).toBe(true)
  })
  it('counter: under the limit nothing is chosen — every picture is sent in the order of before', async () => {
    const items: Array<{ id: string; role?: string; url: string; r: Raster }> = [
      { id: 'plan', role: 'FLOOR_PLAN', url: 'https://x/plan/aaaaaaaaaaaaaaaaaaaaaaaa.png', r: drawing(0, 600, 600) },
      { id: 'big', url: 'https://x/1200/bbbbbbbbbbbbbbbbbbbbbbbb.jpg', r: render(1) },
      { id: 'big-small', url: 'https://x/736/bbbbbbbbbbbbbbbbbbbbbbbb.jpg', r: { ...render(2), width: 640, height: 420 } },
      { id: 'el', url: 'https://x/el/eeeeeeeeeeeeeeeeeeeeeeee.jpg', r: drawing(3) },
    ]
    const { assets, source } = build(items)
    const { pictures, skipped } = await housePictures(assets, source)
    expect(pictures.map((p) => p.assetId)).toEqual(['plan', 'big', 'big-small', 'el'])
    expect(skipped).toHaveLength(0)
  })
  it('counter: a package of interior renders and no elevation sends no render ahead of a drawing and invents no elevation', async () => {
    const items: Array<{ id: string; role?: string; url: string; r: Raster }> = [{ id: 'plan', role: 'FLOOR_PLAN', url: 'https://x/plan/aaaaaaaaaaaaaaaaaaaaaaaa.png', r: drawing(0, 600, 600) }]
    for (let k = 0; k < 30; k += 1) items.push({ id: `room${k}`, url: `https://x/r/${`room${k}`.padEnd(24, 'q')}.jpg`, r: render(k) })
    const { assets, source } = build(items)
    const { pictures, skipped } = await housePictures(assets, source)
    expect(pictures[0].assetId).toBe('plan')
    expect(pictures.every((p) => p.pageRole.document !== 'ELEVATION')).toBe(true)
    expect(skipped.filter((s) => s.code === 'LIMIT')).toHaveLength(31 - PICTURE_LIMITS.maxPictures)
  })
})

describe('v3.54.6 a side without a source says how far it was looked for', () => {
  it('NO_SOURCE names the pictures sent and those of unresolved role the limit left out', () => {
    const doc = manual()
    doc.source.missing = [{ what: '7 picture(s) of unresolved role not sent: more than the reading takes — whether one of them shows a side is not known', status: 'NOT_SENT' }]
    const h = compileHouse(doc, 't')
    const left = h.document.verification.views.find((v) => v.side === 'LEFT')
    expect(left?.state).toBe('NO_SOURCE')
    expect(left?.why).toMatch(/searched: 5 picture\(s\) sent; 7 of unresolved role not sent .* uncertain/)
  })
  it('cause: an elevation the page names that the limit cut is NOT_SENT, not NO_SOURCE', () => {
    const doc = manual()
    doc.source.missing = [{ what: 'elevation picture asset-abc: more than 24 pictures: not sent (a elevation the page names)', status: 'NOT_SENT' }]
    const h = compileHouse(doc, 't')
    expect(h.document.verification.views.find((v) => v.side === 'LEFT')?.state).toBe('NOT_SENT')
  })
})

describe('v3.54.6 a review operation without effect says why', () => {
  const house = (over: Record<string, unknown>): CompiledHouse => ({ document: { verification: { checks: [], held: [], views: [], openings: [], knownDefects: [] } }, compileErrors: [], failed: [], bundle: { scene: { meshes: [] } }, modelHash: 'same', ...over }) as unknown as CompiledHouse
  it('cause: an opening dropped with its refused host wall is HELD_BY_DEPENDENCY with that reason, not NOT_CONSUMED', () => {
    const after = house({ document: { verification: { checks: [], held: [], views: [], knownDefects: [], openings: [{ ref: 'el-p3/o1', fit: 'NOT_BUILT', why: 'its host wall w-main-5 was refused by the kernel (WALLS_OVERLAP)' }] } } })
    const r = acceptCorrection(house({}), after, 'ADD_OPENING', 'el-p3', ['el-p3/o1'])
    expect(r).toMatchObject({ ok: false, code: 'HELD_BY_DEPENDENCY' })
    expect((r as { why: string }).why).toMatch(/w-main-5/)
  })
  it('cause: what it says with no consumer is CAPABILITY_MISSING', () => {
    const r = acceptCorrection(house({}), house({}), 'SET_ROOF', undefined, [], ['eavesY', 'ridgeY'])
    expect(r).toMatchObject({ ok: false, code: 'CAPABILITY_MISSING' })
  })
  it('counter: a correction that reaches nothing for no named reason is still NOT_CONSUMED', () => {
    expect(acceptCorrection(house({}), house({}), 'SET_ROOF')).toMatchObject({ ok: false, code: 'NOT_CONSUMED' })
  })
})

describe('v3.54.6 the choice holds both models against the same elevations', () => {
  const read = [{ a0: 1, a1: 2 }, { a0: 4, a1: 5.2 }, { a0: 8, a1: 9 }]
  const hole = (along: number, w: number) => ({ id: 'h', kind: 'WINDOW' as const, side: 'FRONT' as const, alongM: along, widthM: w, heightM: 1.2, bottomY: 0.9, topY: 2.1 })
  it('the holes at the read places meet the side; extra holes and missing ones do not', () => {
    expect(openingsAgainstElevation(read, [hole(1, 1), hole(4, 1.2), hole(8, 1)]).ok).toBe(true)
    // LOCAL's false openings: three right, four more the elevation does not show
    expect(openingsAgainstElevation(read, [hole(1, 1), hole(4, 1.2), hole(8, 1), hole(10, 1), hole(11.5, 1), hole(13, 1), hole(14.5, 1)]).ok).toBe(false)
    expect(openingsAgainstElevation(read, [hole(1, 1)]).ok).toBe(false)
  })
  it('counter: a correct LOCAL is kept against the described house built from the same reading', () => {
    const h = compileHouse(manual(), 't')
    const d = arbitrate(h, { ...GOOD_LOCAL, openings: h.measured?.openings ?? [] }, PUBLISHED)
    expect(d.findings.some((f) => /openings on the front side/.test(f.fact) && f.localOk)).toBe(true)
    expect(d.accepted).toBe('LOCAL')
  })
  it('cause: a LOCAL whose holes are not where the elevations show them contradicts the source', () => {
    const h = compileHouse(manual(), 't')
    const moved = (h.measured?.openings ?? []).map((o) => ({ ...o, alongM: o.alongM === null ? null : o.alongM + 2.5 }))
    const d = arbitrate(h, { ...GOOD_LOCAL, openings: moved }, PUBLISHED)
    expect(d.findings.some((f) => /openings on the front side/.test(f.fact) && !f.localOk && f.describedOk)).toBe(true)
    expect(d.accepted).toBe('DESCRIBED')
  })
  it('counter: LOCAL with no measured holes is not compared on openings — said, not counted as zero', () => {
    const h = compileHouse(manual(), 't')
    const d = arbitrate(h, GOOD_LOCAL, PUBLISHED)
    expect(d.findings.some((f) => /openings on the/.test(f.fact))).toBe(false)
    expect(d.unknown.join(' ')).toMatch(/holes were not measured/)
  })
  it('an elevation that does not register gives no positions to compare: not assessable, said', () => {
    const doc = manual()
    el(doc, 'el-front').bodies = []
    const h = compileHouse(doc, 't')
    expect(check(h, 'elevation-el-front')?.status).toBe('FAIL')
    const d = arbitrate(h, { ...GOOD_LOCAL, openings: [] }, PUBLISHED)
    expect(d.findings.some((f) => /openings on the front side/.test(f.fact))).toBe(false)
  })
})

describe('v3.54.6 (D39) an accepted revision is kept under its binding', () => {
  const pic = (byteHash: string, document = 'ELEVATION') => ({ byteHash, pageRole: { document, view: 'FRONT', storey: 'NOT_APPLICABLE' } }) as unknown as HousePicture
  const base = { adapterId: 'archon.pl', externalId: 'x1', pictures: [pic('a'), pic('b', 'FLOOR_PLAN')], published: [{ key: 'building_height', value: 8 }], reader: 'r@1', resolver: '0.3.0', builder: '0.2.0', model: 'm', review: true }
  it('the same source, pictures, versions and settings give the same key, in any picture order', () => {
    expect(acceptedBinding(base).key).toBe(acceptedBinding({ ...base, pictures: [...base.pictures].reverse() }).key)
  })
  it('each thing that changes the house built from the answers changes the key, and is named', () => {
    const k = acceptedBinding(base)
    for (const [over, field] of [[{ pictures: [pic('a'), pic('c', 'FLOOR_PLAN')] }, 'pictures'], [{ pictures: [pic('a', 'SECTION'), pic('b', 'FLOOR_PLAN')] }, 'pictures'], [{ resolver: '0.4.0' }, 'resolver'], [{ builder: '0.3.0' }, 'builder'], [{ review: false }, 'settings'], [{ externalId: 'x2' }, 'variant'], [{ published: [] }, 'pictures']] as const) {
      const o = acceptedBinding({ ...base, ...(over as object) })
      expect(o.key).not.toBe(k.key)
      expect(bindingDiffers(k.binding, o.binding)).toEqual([field])
    }
  })
  it('a revision once accepted is never replaced; a store holds no address, path or key', () => {
    const dir = mkdtempSync(join(tmpdir(), 'accepted-'))
    const store = fileAcceptedStore(dir)
    const { key, binding } = acceptedBinding(base)
    const rev = { schema: 'buildapp.accepted-house-revision' as const, version: '1.0.0' as const, key, binding, acceptedAt: '2026-11-17T00:00:00.000Z', modelHash: 'h1', records: [] }
    expect(store.put(rev)).toBe(true)
    expect(store.put({ ...rev, modelHash: 'h2' })).toBe(false)
    expect(fileAcceptedStore(dir).get(key)?.modelHash).toBe('h1')
    expect(fileAcceptedStore(dir).forVariant(binding.variant).map((r) => r.key)).toEqual([key])
    expect(readdirSync(dir).every((f) => /^(variant-)?[0-9a-f]{32}\.json$/.test(f))).toBe(true)
    expect(fileAcceptedStore(dir).get('../etc/passwd')).toBeUndefined()
  })
})
