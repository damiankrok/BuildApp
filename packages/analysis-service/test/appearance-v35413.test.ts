/**
 * v3.54.13 — the appearance observation, the local sketch reader and the consumer, on synthetic inputs (no house
 * named): one source outline is split among the surfaces the model shows (both storeys share its boundary; a member in
 * front keeps its own material), the usable geometry is untouched, the order of the regions changes nothing, a shade
 * of timber stays timber, and the per-property arbitration keeps a corroborated height an auxiliary picture cannot
 * replace.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyModel, validateModel } from '@buildapp/model'
import type { CanonicalBuildingModel } from '@buildapp/model'
import { runCommands } from '@buildapp/commands'
import type { BuildingCommand } from '@buildapp/commands'
import { compileBuilding } from '@buildapp/geometry'
import { APPEARANCE_OBSERVATION_SCHEMA, APPEARANCE_OBSERVATION_VERSION, applyAppearance, arbitrateOpenings, components, fillHoles, grid, nameClusters, readSketch, traceOuter, usableGeometryFingerprint } from '../src/appearance/index.js'
import type { AppearanceObservation } from '../src/appearance/index.js'

const H0 = 'a'.repeat(64)
// two storeys of one front wall (outer face z = 0, facing −z), a frame member standing in front of it, a window
const house = (...extra: BuildingCommand[]): CanonicalBuildingModel =>
  runCommands(createEmptyModel('t', 't'), [
    { type: 'createBuilding', id: 'b' },
    { type: 'createLevel', id: 'l0', index: 0, elevation: 0, height: 3 },
    { type: 'createLevel', id: 'l1', index: 1, elevation: 3, height: 3 },
    { type: 'defineMaterial', id: 'mat-member', name: 'member', color: '#eeeeee' },
    { type: 'createWall', id: 'w0', levelId: 'l0', start: { x: 0, z: 0 }, end: { x: 8, z: 0 }, thickness: 0.4, height: 3 },
    { type: 'createWall', id: 'w1', levelId: 'l1', start: { x: 0, z: 0 }, end: { x: 8, z: 0 }, thickness: 0.4, height: 3 },
    { type: 'createLinearSolid', id: 'leg', levelId: 'l0', start: { x: 0.25, y: 0, z: -0.3 }, end: { x: 0.25, y: 6, z: -0.3 }, width: 0.5, depth: 0.4, materialId: 'mat-member' },
    { type: 'cutOpening', id: 'o1', wallId: 'w0', kind: 'WINDOW', offset: 2, width: 1, sill: 0.9, height: 1.2 },
    ...extra,
  ] as BuildingCommand[])

// the source elevation: 1000 × 700 px, 0.01 m/px, x = 0 at px 100, ground at row 650 — the image IS the source
const proj = { alongAtPx0: -1, alongSign: 1, mpp: 0.01, zeroRow: 650 }
const px = (x: number, y: number): [number, number] => [x / 0.01 + 100, 650 - y / 0.01]
const obs = (regions: AppearanceObservation['regions'], id = 'o-front'): AppearanceObservation => ({
  schema: APPEARANCE_OBSERVATION_SCHEMA,
  schemaVersion: APPEARANCE_OBSERVATION_VERSION,
  observationId: id,
  facade: 'FRONT',
  source: { sourceByteHash: H0, imageSha256: H0, imageWidth: 1000, imageHeight: 700, sourceWidth: 1000, sourceHeight: 700 },
  toSource: [[1, 0, 0], [0, 1, 0]],
  toSourceWhy: 'the source itself',
  regions,
  producer: { kind: 'MANUAL_DIAGNOSTIC', version: 'test' },
})
// timber from the ground to a raked top across both storeys, x 0..5 (under the member at x 0..0.5 too); dark beyond
const timber = { regionId: 'r-timber', class: 'TIMBER' as const, outline: [px(0, 0), px(5, 0), px(5, 4), px(2.5, 5.5), px(0, 4.5)], visibility: 'VISIBLE' as const, uncertaintyPx: 2 }
const dark = { regionId: 'r-dark', class: 'DARK_RENDER' as const, outline: [px(5, 0), px(8, 0), px(8, 3), px(5, 3)], visibility: 'VISIBLE' as const, uncertaintyPx: 2 }
const run = (regions: AppearanceObservation['regions']) => applyAppearance(house(), [obs(regions)], (f, h) => (f === 'FRONT' && h === H0 ? proj : undefined))

describe('v3.54.13 the appearance consumer', () => {
  it('one source outline becomes finish outlines on both storeys, meeting on the floor line; the member in front keeps its material', () => {
    const r = run([timber, dark])
    expect(validateModel(r.model).issues.filter((i) => i.severity === 'ERROR')).toEqual([])
    const regs = r.model.surfaceRegions
    const t0 = regs.find((x) => x.hostId === 'w0' && x.materialId === 'mat-timber')
    const t1 = regs.find((x) => x.hostId === 'w1' && x.materialId === 'mat-timber')
    expect(t0?.outline && t1?.outline).toBeTruthy()
    // the ground storey's part reaches the floor line where the upper part starts, along the same run
    expect(t0?.rect.b1).toBeCloseTo(3, 1)
    expect(t1?.rect.b0).toBeCloseTo(0, 1)
    expect(t0?.rect.a1).toBeCloseTo(5, 1)
    expect(t1?.rect.a1).toBeCloseTo(5, 1)
    // the raked top: the upper part is 1.5 m tall at x = 0.5 and 2.5 m at its apex
    expect(t1?.rect.b1).toBeCloseTo(2.5, 1)
    // the timber stops at the member in front (x 0..0.5): it is not painted onto the member
    expect(t0?.rect.a0).toBeGreaterThan(0.45)
    expect(regs.find((x) => x.hostId === 'w0' && x.materialId === 'mat-render-dark')?.rect.a0).toBeCloseTo(5, 1)
    // colour, never geometry
    expect(r.fingerprintAfter).toBe(r.fingerprintBefore)
    expect(usableGeometryFingerprint(r.model)).toBe(usableGeometryFingerprint(house()))
    // and the scene compiles clean, the window still cut through the finish
    expect(compileBuilding(r.model).diagnostics).toEqual([])
  })

  it('the order of the regions and of the keys changes nothing', () => {
    const a = run([timber, dark])
    const b = run([{ ...dark }, { uncertaintyPx: 2, visibility: 'VISIBLE', outline: timber.outline, class: 'TIMBER', regionId: 'r-timber' }])
    expect(b.model).toEqual(a.model)
  })

  it('an unregistered elevation is refused, never guessed', () => {
    expect(() => applyAppearance(house(), [obs([timber])], () => undefined)).toThrow(/not registered/)
  })

  it('a finish region the base had on a covered face is replaced, and the trace says so', () => {
    const base = house({ type: 'createSurfaceRegion', id: 'old', hostId: 'w0', face: 'OUTER', rect: { a0: 0, a1: 8, b0: 0, b1: 3 }, materialId: 'mat-member' })
    const r = applyAppearance(base, [obs([timber, dark])], () => proj)
    expect(r.model.surfaceRegions.some((x) => x.id === 'old')).toBe(false)
    expect(r.traces[0].removed.map((x) => x.regionId)).toEqual(['old'])
  })
})

describe('v3.54.13 the sketch reader', () => {
  // a flat drawing: white background, a light frame, a timber field, a dark field, a glass pane, black 2 px lines
  const draw = (timberRGB: [number, number, number]) => {
    const W = 200
    const Hh = 120
    const data = new Uint8ClampedArray(W * Hh * 4)
    const put = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => {
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data.set([...c, 255], 4 * (y * W + x))
    }
    put(0, 0, W, Hh, [255, 255, 255])
    put(20, 10, 180, 110, [236, 233, 228])
    put(30, 20, 100, 110, timberRGB)
    put(100, 20, 170, 110, [74, 74, 74])
    put(45, 40, 70, 80, [190, 205, 212])
    for (const x of [30, 100, 170]) put(x - 1, 20, x + 1, 110, [40, 40, 40])
    put(30, 19, 170, 21, [40, 40, 40])
    return { width: W, height: Hh, data }
  }
  it('names the drawing\'s colours by family, and its lines go to the finishes either side', () => {
    const r = readSketch(draw([210, 160, 100]), { minAreaPx: 100 })
    const classes = new Set(r.regions.map((x) => x.class))
    expect(classes).toEqual(new Set(['TIMBER', 'DARK_RENDER', 'LIGHT_RENDER', 'GLASS']))
    const t = r.regions.find((x) => x.class === 'TIMBER')
    const xs = t?.outline.map((p) => p[0]) ?? []
    // the timber field is 30..100 with its lines split down the middle
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(28)
    expect(Math.max(...xs)).toBeLessThanOrEqual(102)
  })
  it('another shade of timber is still timber; a timber turned blue is not', () => {
    expect(readSketch(draw([190, 120, 70]), { minAreaPx: 100 }).regions.some((x) => x.class === 'TIMBER')).toBe(true)
    expect(nameClusters([[100, 160, 210]], [1])[0].class).not.toBe('TIMBER')
  })
})

describe('v3.54.13 masks', () => {
  it('traces a hole-filled component as one simple rectilinear loop', () => {
    const g = grid(6, 5)
    for (const [i, j] of [[1, 1], [2, 1], [3, 1], [1, 2], [3, 2], [1, 3], [2, 3], [3, 3], [4, 3]]) g.data[j * 6 + i] = 1
    const [c] = components(fillHoles(g))
    const loop = traceOuter(c)
    // an L-ish outline: 3×3 block plus one cell: 6 corners
    expect(loop).toHaveLength(6)
    const area = Math.abs(loop.reduce((s, p, k) => s + p[0] * loop[(k + 1) % loop.length][1] - loop[(k + 1) % loop.length][0] * p[1], 0)) / 2
    expect(area).toBe(10)
  })
})

describe('v3.54.13 per-property arbitration', () => {
  const withOpening = (height: number, status: string): CanonicalBuildingModel => {
    const m = house()
    m.openings = m.openings.map((o) => ({ ...o, height, evidence: { status: 'SOURCE_DERIVED', properties: { height: status, sill: 'SOURCE_DERIVED', width: 'SOURCE_EXACT', offset: 'SOURCE_DERIVED' } } }) as never)
    return m
  }
  const src = (h: string) => ({ packageId: 'p', assets: { plan: 'p1', front: h } })
  it('a corroborated height is RETAINED against an unresolved one read with an auxiliary front; the trace names it', () => {
    const base = withOpening(1.2, 'SOURCE_CORROBORATED')
    const cand = withOpening(1.5, 'UNRESOLVED')
    const r = arbitrateOpenings(base, cand, { base: src('orig'), candidate: src('sketch'), auxiliary: [{ assetId: 'front', facade: 'FRONT', originalByteHash: 'orig', auxiliaryByteHash: 'sketch' }] })
    expect(r.witness.ok).toBe(true)
    expect(r.model.openings[0].height).toBe(1.2)
    expect(r.records.find((x) => x.property === 'height')).toMatchObject({ decision: 'RETAINED', base: 1.2, candidate: 1.5, applied: 1.2 })
  })
  it('a base read on another revision of the original is not a witness: UNRESOLVED, the candidate stands', () => {
    const r = arbitrateOpenings(withOpening(1.2, 'SOURCE_CORROBORATED'), withOpening(1.5, 'UNRESOLVED'), { base: src('older-orig'), candidate: src('sketch'), auxiliary: [{ assetId: 'front', facade: 'FRONT', originalByteHash: 'orig', auxiliaryByteHash: 'sketch' }] })
    expect(r.witness.ok).toBe(false)
    expect(r.model.openings[0].height).toBe(1.5)
    expect(r.records.find((x) => x.property === 'height')?.decision).toBe('UNRESOLVED')
  })
  it('a printed source fact (SOURCE_EXACT) the base lacked CORRECTS it', () => {
    const r = arbitrateOpenings(withOpening(1.2, 'SOURCE_DERIVED'), withOpening(1.5, 'SOURCE_EXACT'), { base: src('orig'), candidate: src('sketch'), auxiliary: [{ assetId: 'front', facade: 'FRONT', originalByteHash: 'orig', auxiliaryByteHash: 'sketch' }] })
    expect(r.records.find((x) => x.property === 'height')?.decision).toBe('CORRECTED')
    expect(r.model.openings[0].height).toBe(1.5)
  })
})
