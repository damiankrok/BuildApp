/**
 * v3.54.14 — the appearance consumer 1.1.0, cause by cause (the OWNER's phone screenshots of Marcówki):
 *  - a floor joint that does not fall on the 2 cm cell grid left a bare strip between the storeys' finishes;
 *  - the wall behind a balustrade (posts, rails, glass) and a balcony kept no finish where they stood in front of it;
 *  - a dark balcony band drawn a few pixels too high seeded a dark finish on the wall above, which then spread behind
 *    the balustrade.
 * And what must not change: a real boundary behind a balustrade stays unknown, a foreign wall in front is no occluder,
 * an opening behind the balustrade stays an opening, the usable geometry stays as it was.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyModel, validateModel } from '@buildapp/model'
import type { CanonicalBuildingModel, SurfaceRegion } from '@buildapp/model'
import { runCommands } from '@buildapp/commands'
import type { BuildingCommand } from '@buildapp/commands'
import { compileBuilding } from '@buildapp/geometry'
import { APPEARANCE_CONSUMER_VERSION, APPEARANCE_OBSERVATION_SCHEMA, APPEARANCE_OBSERVATION_VERSION, applyAppearance, parseAppearanceObservation } from '../src/appearance/index.js'
import type { AppearanceObservation } from '../src/appearance/index.js'

const H0 = 'b'.repeat(64)
const JOINT = 3.07 // a floor height in odd centimetres: off the 2 cm grid of the visibility map
const house = (...extra: BuildingCommand[]): CanonicalBuildingModel =>
  runCommands(createEmptyModel('t', 't'), [
    { type: 'createBuilding', id: 'b' },
    { type: 'createLevel', id: 'l0', index: 0, elevation: 0, height: JOINT },
    { type: 'createLevel', id: 'l1', index: 1, elevation: JOINT, height: 3 },
    { type: 'createWall', id: 'w0', levelId: 'l0', start: { x: 0, z: 0 }, end: { x: 8, z: 0 }, thickness: 0.4, height: JOINT },
    { type: 'createWall', id: 'w1', levelId: 'l1', start: { x: 0, z: 0 }, end: { x: 8, z: 0 }, thickness: 0.4, height: 3 },
    ...extra,
  ] as BuildingCommand[])
// a balcony on the upper storey in front of x 2..6 with a glass balustrade on its edge; a window behind the balustrade
const balcony: BuildingCommand[] = [
  { type: 'createBalcony', id: 'bal', levelId: 'l1', footprint: { minX: 2, maxX: 6, minZ: -1, maxZ: 0 }, thickness: 0.3 },
  { type: 'createRailing', id: 'rail', levelId: 'l1', start: { x: 2.05, z: -0.95 }, end: { x: 5.95, z: -0.95 }, height: 1, postSpacing: 1, infill: 'GLASS', hostId: 'bal' },
  { type: 'cutOpening', id: 'o2', wallId: 'w1', kind: 'WINDOW', offset: 3, width: 1, sill: 0.2, height: 1.5 },
] as BuildingCommand[]

// the source elevation itself: 1000 × 700 px, 0.01 m/px, x = 0 at px 100, ground at row 650
const proj = { alongAtPx0: -1, alongSign: 1, mpp: 0.01, zeroRow: 650 }
const px = (x: number, y: number): [number, number] => [x / 0.01 + 100, 650 - y / 0.01]
const box = (x0: number, y0: number, x1: number, y1: number): Array<[number, number]> => [px(x0, y0), px(x1, y0), px(x1, y1), px(x0, y1)]
const region = (regionId: string, cls: AppearanceObservation['regions'][number]['class'], outline: Array<[number, number]>) => ({ regionId, class: cls, outline, visibility: 'VISIBLE' as const, uncertaintyPx: 2 })
const obs = (regions: AppearanceObservation['regions'], residualPx?: number): AppearanceObservation => ({
  schema: APPEARANCE_OBSERVATION_SCHEMA,
  schemaVersion: APPEARANCE_OBSERVATION_VERSION,
  observationId: 'o-front',
  facade: 'FRONT',
  source: { sourceByteHash: H0, imageSha256: H0, imageWidth: 1000, imageHeight: 700, sourceWidth: 1000, sourceHeight: 700 },
  toSource: [[1, 0, 0], [0, 1, 0]],
  toSourceWhy: 'the source itself',
  ...(residualPx === undefined ? {} : { toSourceResidualPx: residualPx }),
  regions,
  producer: { kind: 'MANUAL_DIAGNOSTIC', version: 'test' },
})
const apply = (model: CanonicalBuildingModel, o: AppearanceObservation) => applyAppearance(model, [o], (f, h) => (f === 'FRONT' && h === H0 ? proj : undefined))
const poly = (r: SurfaceRegion) => r.outline ?? [{ a: r.rect.a0, b: r.rect.b0 }, { a: r.rect.a1, b: r.rect.b0 }, { a: r.rect.a1, b: r.rect.b1 }, { a: r.rect.a0, b: r.rect.b1 }]
const inside = (p: ReadonlyArray<{ a: number; b: number }>, a: number, b: number): boolean => {
  let c = false
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) if (p[i].b > b !== p[j].b > b && a < ((p[j].a - p[i].a) * (b - p[i].b)) / (p[j].b - p[i].b) + p[i].a) c = !c
  return c
}
const finishAt = (m: CanonicalBuildingModel, wallId: string, a: number, b: number): string | undefined => m.surfaceRegions.find((r) => r.hostId === wallId && r.face === 'OUTER' && inside(poly(r), a, b))?.materialId

// the OWNER's kind of drawing: timber on both storeys, the balustrade drawn as glass over the wall, the balcony band dark
// — drawn 8 cm too high, over the strip of wall between the deck and the glass, as a sketch registered with residuals does
const drawing = [
  region('timber', 'TIMBER', box(0, 0, 8, 6)),
  region('band', 'DARK_RENDER', box(2, JOINT - 0.3, 6, JOINT + 0.08)),
  region('glass', 'GLASS', box(2.05, JOINT + 0.08, 5.95, JOINT + 1)),
]

describe('v3.54.14 the appearance consumer 1.1.0', () => {
  it('is version 1.1.0 and reads an observation of contract 1.0.0 as well as 1.1.0', () => {
    expect(APPEARANCE_CONSUMER_VERSION).toBe('1.1.0')
    expect(APPEARANCE_OBSERVATION_VERSION).toBe('1.1.0')
    expect(parseAppearanceObservation({ ...obs(drawing), schemaVersion: '1.0.0' }).toSourceResidualPx).toBeUndefined()
    expect(() => parseAppearanceObservation({ ...obs(drawing), schemaVersion: '2.0.0' })).toThrow()
  })

  it('a floor joint off the cell grid: the upper finish starts at the joint, no bare strip between the storeys', () => {
    const r = apply(house(), obs([region('timber', 'TIMBER', box(0, 0, 8, 6))]))
    const t0 = r.model.surfaceRegions.find((x) => x.hostId === 'w0')
    const t1 = r.model.surfaceRegions.find((x) => x.hostId === 'w1')
    expect(t0?.rect.b1).toBeCloseTo(JOINT, 6)
    expect(t1?.rect.b0).toBeCloseTo(0, 6)
    // and at every point along the joint, 2 mm either side of it, both walls carry the timber
    for (let a = 0.1; a < 8; a += 0.37) {
      expect(finishAt(r.model, 'w0', a, JOINT - 0.002)).toBe('mat-timber')
      expect(finishAt(r.model, 'w1', a, 0.002)).toBe('mat-timber')
    }
    expect(r.fingerprintAfter).toBe(r.fingerprintBefore)
  })

  it('behind posts, rails and glass the wall keeps one timber finish, said to be inferred, not observed', () => {
    const r = apply(house(...balcony), obs(drawing, 8))
    expect(validateModel(r.model).issues.filter((i) => i.severity === 'ERROR')).toEqual([])
    const upper = r.model.surfaceRegions.filter((x) => x.hostId === 'w1')
    expect(upper.map((x) => x.materialId)).toEqual(['mat-timber'])
    // the wall behind each post, between the posts and under the rail: timber (and under the window's sill)
    expect(finishAt(r.model, 'w1', 3.5, 0.1)).toBe('mat-timber')
    for (const a of [2.05, 2.5, 4.5, 5.0, 5.5, 5.95]) for (const b of [0.05, 0.5, 0.97]) expect(finishAt(r.model, 'w1', a, b)).toBe('mat-timber')
    const inferred = r.traces[0].inferredUnderOcclusion.find((x) => x.hostId === 'w1')
    expect(inferred?.class).toBe('TIMBER')
    expect(inferred?.occluders).toEqual(expect.arrayContaining(['RAILING_INFILL', 'RAILING_POST', 'RAILING_RAIL']))
    expect(inferred?.cells ?? 0).toBeGreaterThan(1000)
    expect(inferred?.differentSides).toBe(0)
    expect(upper[0].evidence?.interpretation).toMatch(/inferred from the same wall's observed finish, not observed/)
    // the balustrade and the balcony keep their own materials: nothing of the finish is put on them
    const scene = compileBuilding(r.model)
    const before = compileBuilding(house(...balcony))
    for (const part of ['RAILING_POST', 'RAILING_RAIL', 'RAILING_INFILL', 'BALCONY']) {
      expect(scene.meshes.filter((m) => m.part === part).map((m) => m.materialId)).toEqual(before.meshes.filter((m) => m.part === part).map((m) => m.materialId))
    }
    expect(r.fingerprintAfter).toBe(r.fingerprintBefore)
  })

  it('the balcony band drawn within the registration residual seeds nothing on the wall; with no residual given, it does (the cause)', () => {
    const fixed = apply(house(...balcony), obs(drawing, 8))
    expect(fixed.model.surfaceRegions.some((x) => x.hostId === 'w1' && x.materialId === 'mat-render-dark')).toBe(false)
    expect(fixed.traces[0].seedBandM).toBeCloseTo(0.1, 6)
    expect(fixed.traces[0].skipped.some((x) => x.hostId === 'w1' && x.class === 'DARK_RENDER')).toBe(false)
    // counter-trial: the same drawing with no residual — the 8 cm of dark over the strip of wall under the glass seeds
    // dark parts on the upper wall (here small enough for the area floor to give them to the timber; on Marcówki they
    // spread behind the balustrade to 1.56 m²: the v3.54.13 defect, now a measured cause)
    const cause = apply(house(...balcony), obs(drawing))
    expect(cause.traces[0].seedBandM).toBeCloseTo(0.02, 6)
    expect(cause.traces[0].skipped.some((x) => x.hostId === 'w1' && x.class === 'DARK_RENDER')).toBe(true)
  })

  it('a real boundary behind a balustrade stays unknown: two finishes border the hidden strip, the trace and the evidence say so', () => {
    // a balustrade standing in front of the ground storey 1..2 m up; dark below 1.5 m, timber above, glass drawn over it
    const juliet = [{ type: 'createRailing', id: 'jr', levelId: 'l0', start: { x: 2, z: -0.3 }, end: { x: 6, z: -0.3 }, baseOffset: 1, height: 1, infill: 'GLASS', postSpacing: 1 }] as BuildingCommand[]
    const r = apply(house(...juliet), obs([region('timber', 'TIMBER', box(0, 1.5, 8, 6)), region('dark', 'DARK_RENDER', box(0, 0, 8, 1.5)), region('glass', 'GLASS', box(2, 1, 6, 2))]))
    const e = r.traces[0].inferredUnderOcclusion.filter((x) => x.hostId === 'w0')
    expect(e.reduce((s, x) => s + x.differentSides, 0)).toBeGreaterThan(500)
    expect(r.model.surfaceRegions.filter((x) => x.hostId === 'w0').map((x) => x.evidence?.interpretation ?? '').join(' ')).toMatch(/the boundary there is not known/)
  })

  it('a foreign wall in front is no occluder: the finish is not carried onto the wall behind it', () => {
    const r = apply(house({ type: 'createWall', id: 'wx', levelId: 'l0', start: { x: 2, z: -1.2 }, end: { x: 4, z: -1.2 }, thickness: 0.3, height: 2 } as BuildingCommand), obs([region('timber', 'TIMBER', box(0, 0, 8, 6))]))
    expect(r.traces[0].inferredUnderOcclusion.filter((x) => x.hostId === 'w0')).toEqual([])
    expect(finishAt(r.model, 'w0', 3, 1)).toBeUndefined()
    expect(finishAt(r.model, 'wx', 1, 1)).toBe('mat-timber')
  })

  it('an opening behind the balustrade stays an opening: no finish triangle is laid over it', () => {
    const r = apply(house(...balcony), obs(drawing, 8))
    const scene = compileBuilding(r.model)
    const skins = scene.meshes.filter((m) => m.part === 'SURFACE_REGION')
    expect(skins.length).toBeGreaterThan(0)
    for (const m of skins) {
      for (const t of m.triangles) {
        const cx = (t.a.x + t.b.x + t.c.x) / 3
        const cy = (t.a.y + t.b.y + t.c.y) / 3
        expect(cx > 3.02 && cx < 3.98 && cy > JOINT + 0.22 && cy < JOINT + 1.68).toBe(false)
      }
    }
    expect(scene.meshes.some((m) => m.part === 'WALL_REVEAL' && m.openingId === 'o2')).toBe(true)
  })
})
