import { describe, expect, it } from 'vitest'
import { MODEL_FRAME } from '@buildapp/model'
import { FRONT_OUTER_PLANE_REF_Z, appToRef, createMarcowkiReferenceBuilding, q, refPlanToApp, refPolygonToApp, refRectToApp, refToApp, refZRangeToApp } from '../src/index.js'

describe('reference → BuildApp frame transform', () => {
  it('keeps x and y, mirrors z about the front outer plane, and inverts exactly', () => {
    expect(FRONT_OUTER_PLANE_REF_Z).toBe(13.6)
    expect(refToApp({ x: 1, y: 2, z: 3 })).toEqual({ x: 1, y: 2, z: 10.6 })
    expect(appToRef(refToApp({ x: 1.5, y: -0.32, z: 12.6 }))).toEqual({ x: 1.5, y: -0.32, z: 12.6 })
    expect(refPlanToApp({ x: 7.9, z: 0 })).toEqual({ x: 7.9, z: 13.6 })
  })

  it('maps the four characteristic depth planes as documented', () => {
    expect(q(refPlanToApp({ x: 0, z: 13.6 }).z)).toBe(0) // front outer projection plane
    expect(q(refPlanToApp({ x: 0, z: 12.6 }).z)).toBe(1) // front back wall plane
    expect(q(refPlanToApp({ x: 0, z: 0 }).z)).toBe(13.6) // rear back wall plane
    expect(q(refPlanToApp({ x: 0, z: -1 }).z)).toBe(14.6) // rear outer projection plane
    expect(refZRangeToApp(6.79, 8.77).map(q)).toEqual([4.83, 6.81])
    expect(refRectToApp({ minX: 7.9, maxX: 12.05, minZ: 5.1, maxZ: 12.6 })).toEqual({ minX: 7.9, maxX: 12.05, minZ: 1, maxZ: 8.5 })
  })

  it('a reference polygon keeps its x and its area; the winding reverses (one reflection: right-handed to left-handed)', () => {
    const ref: Array<[number, number]> = [[0, 0], [7.9, 0], [7.9, 12.6], [0, 12.6]]
    const app = refPolygonToApp(ref)
    expect(app).toEqual([{ x: 0, z: 13.6 }, { x: 7.9, z: 13.6 }, { x: 7.9, z: 1 }, { x: 0, z: 1 }])
    const area = (p: Array<{ x: number; z: number }>): number => p.reduce((s, a, i) => s + (a.x * p[(i + 1) % p.length].z - p[(i + 1) % p.length].x * a.z), 0) / 2
    expect(area(app)).toBeCloseTo(-area(ref.map(([x, z]) => ({ x, z }))), 12)
  })

  it('x orientation: the garage (east on the plans) is on the right of the front view, as the model frame defines right', () => {
    const m = createMarcowkiReferenceBuilding()
    expect(m.frame).toEqual(MODEL_FRAME)
    const garage = m.walls.find((w) => w.id === 'gar-right')!
    const west = m.walls.find((w) => w.id === 'g-left')!
    expect(Math.min(garage.start.x, garage.end.x)).toBeGreaterThan(Math.max(west.start.x, west.end.x))
    // the entrance is on the front wall at z = 1.00, the loggia glazing on the rear wall at z = 13.60
    expect(m.walls.find((w) => w.id === 'g-front')!.start.z).toBe(1)
    expect(m.walls.find((w) => w.id === 'g-rear')!.start.z).toBe(13.6)
    expect(m.openings.find((o) => o.id === 'og-front-entrance')!.wallId).toBe('g-front')
    expect(m.openings.find((o) => o.id === 'og-rear-living-glazing')!.wallId).toBe('g-rear')
  })
})
