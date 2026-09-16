import { describe, expect, it } from 'vitest'
import { runLengthBands } from '@buildapp/source-cv'
import { claddingField, groupFacadeOpenings, openingPair, planOpenings, rectangleRing, sameAssembly } from '../src/index.js'
import type { FacadeRect, MassHypothesis, MetricEvidence } from '../src/index.js'
import { WALL, mask, sheet, walls } from './plan.js'

const rect = (u0: number, v0: number, u1: number, v1: number): FacadeRect => ({ u0, v0, u1, v1 })
const piece = (u0: number, v0: number, u1: number, v1: number, id = `${u0}`): { rect: FacadeRect; source: string } => ({ rect: rect(u0, v0, u1, v1), source: id })

/** §12: nested rectangles inside one window assembly are one opening, and a mullion is not another opening. */
describe('grouping rectangles into openings', () => {
  it('takes a frame drawn inside its own reveal as one opening', () => {
    expect(sameAssembly(rect(1, 1, 3, 3), rect(1.1, 1.1, 2.9, 2.9)).joined).toBe(true)
  })

  it('takes two lights either side of a mullion as one window', () => {
    expect(sameAssembly(rect(1, 1, 2, 3), rect(2.1, 1, 3.1, 3)).joined).toBe(true)
  })

  it('does not take two windows a metre apart as one', () => {
    expect(sameAssembly(rect(1, 1, 2, 3), rect(3, 1, 4, 3)).joined).toBe(false)
  })

  it('does not swallow a window into a band that runs the whole facade', () => {
    // A 9.6 m band sitting on top of a 1.8 m window lines up with it and is
    // not a light of it.
    expect(sameAssembly(rect(4.2, 0.9, 6, 2.4), rect(0, 2.45, 9.6, 2.85)).joined).toBe(false)
  })

  it('merges a whole assembly transitively', () => {
    const { assemblies } = groupFacadeOpenings([piece(1, 1, 2, 3, 'a'), piece(2.1, 1, 3.1, 3, 'b'), piece(3.2, 1, 4.2, 3, 'c')])
    expect(assemblies.length).toBe(1)
    expect(assemblies[0].merged).toBe(3)
    expect(assemblies[0].rect).toEqual({ u0: 1, v0: 1, u1: 4.2, v1: 3 })
  })

  it('refuses a regular field of identical rectangles as cladding', () => {
    const boards = Array.from({ length: 8 }, (_, i) => piece(i * 0.4, 3, i * 0.4 + 0.3, 6, `board-${i}`))
    const { assemblies, cladding } = groupFacadeOpenings(boards)
    expect(cladding.length).toBe(8)
    expect(assemblies.length).toBe(0)
  })

  it('does not call three windows at a regular spacing cladding', () => {
    const windows = [piece(1, 1, 2.2, 3, 'w0'), piece(4, 1, 5.2, 3, 'w1'), piece(7, 1, 8.2, 3, 'w2')]
    expect(claddingField(windows).size).toBe(0)
  })

  it('§15: a hundred plausible stripes become no openings at all', () => {
    const stripes = Array.from({ length: 100 }, (_, i) => piece(i * 0.12, 0.5, i * 0.12 + 0.08, 5.5, `stripe-${i}`))
    const { assemblies, cladding } = groupFacadeOpenings(stripes)
    expect(cladding.length).toBe(100)
    expect(assemblies.length).toBe(0)
  })

  it('reads a callout as a width and a height in centimetres', () => {
    const base = { id: 'e', kind: 'OPENING_CALLOUT' } as unknown as MetricEvidence
    expect(openingPair({ ...base, rawText: '110/230' })).toEqual({ widthCm: 110, heightCm: 230 })
    expect(openingPair({ ...base, rawText: '275/205' })).toEqual({ widthCm: 275, heightCm: 205 })
    expect(openingPair({ ...base, rawText: '1205' })).toBeNull()
    expect(openingPair({ ...base, rawText: '10/20' })).toBeNull()
  })
})

/** §12: the plan is where an opening's position and width come from. */
describe('openings read off a plan', () => {
  const mass = (x0: number, z0: number, x1: number, z1: number): MassHypothesis => ({
    id: 'mass-0',
    role: 'MAIN',
    ring: rectangleRing(x0, z0, x1, z1),
    footprintRegionIds: ['f'],
    storeySpan: { fromIndex: 0, toIndex: 0, storeyIds: ['storey-0'] },
    facadePlaneIds: [],
    widthM: { value: x1 - x0, low: x1 - x0, high: x1 - x0, unit: 'm', basis: 'MEASURED', evidenceIds: [], why: 'fixture' },
    depthM: { value: z1 - z0, low: z1 - z0, high: z1 - z0, unit: 'm', basis: 'MEASURED', evidenceIds: [], why: 'fixture' },
    observationIds: [],
    evidenceIds: [],
    confidence: 0.9,
    why: 'fixture',
  })

  // A plain ring with a 1.2 m doorway in its south wall and a 2 m window in
  // its north one, at a scale of 20 px to the metre.
  const PPM = 20
  const r = sheet(400, 400)
  walls(r, 40, 40, 279, 279, [
    { side: 'S', from: 100, to: 100 + 1.2 * PPM },
    { side: 'N', from: 160, to: 160 + 2 * PPM },
  ])
  const m = mask(r)
  const bands = runLengthBands(m, { minThickness: 6, maxThickness: 30, minLength: 20 })
  const toMetric = { x: (px: number) => (px - 40) / PPM, z: (px: number) => (px - 40) / PPM }
  const found = planOpenings(mass(0, 0, 11.95, 11.95), { x0: 40, y0: 40, x1: 280, y1: 280 }, bands, WALL, toMetric, [])

  it('finds the gaps the plan draws, on the right walls', () => {
    const south = found.filter((o) => o.side === 'MAX_Z')
    const north = found.filter((o) => o.side === 'MIN_Z')
    expect(south.length).toBe(1)
    expect(north.length).toBe(1)
  })

  it('measures their widths off the drawing', () => {
    // Within a couple of drawn pixels: the gap is measured between the wall
    // pieces either side of it, and a pixel of ink at each end is the reveal.
    expect(Math.abs((found.find((o) => o.side === 'MAX_Z')?.widthM ?? 0) - 1.2)).toBeLessThan(0.15)
    expect(Math.abs((found.find((o) => o.side === 'MIN_Z')?.widthM ?? 0) - 2)).toBeLessThan(0.15)
  })

  it('measures the offset the way the wall ring is traversed', () => {
    // The north wall runs from the origin corner, so its opening's offset is
    // measured from there: 160 px is 6 m along.
    expect(Math.abs((found.find((o) => o.side === 'MIN_Z')?.offsetM ?? 0) - 6)).toBeLessThan(0.15)
    // The south wall runs the other way, so the same drawing gives a different
    // offset — which is the whole reason the direction has to be stated.
    expect(Math.abs((found.find((o) => o.side === 'MAX_Z')?.offsetM ?? 0) - (11.95 - 3 - 1.2))).toBeLessThan(0.2)
  })

  it('finds nothing in a wall with no gap in it', () => {
    const solid = sheet(400, 400)
    walls(solid, 40, 40, 279, 279)
    const solidBands = runLengthBands(mask(solid), { minThickness: 6, maxThickness: 30, minLength: 20 })
    expect(planOpenings(mass(0, 0, 11.95, 11.95), { x0: 40, y0: 40, x1: 280, y1: 280 }, solidBands, WALL, toMetric, [])).toEqual([])
  })

  it('is deterministic', () => {
    expect(JSON.stringify(planOpenings(mass(0, 0, 11.95, 11.95), { x0: 40, y0: 40, x1: 280, y1: 280 }, bands, WALL, toMetric, []))).toBe(JSON.stringify(found))
  })
})
