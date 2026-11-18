/**
 * v3.54.12 — a finish on a wall's end cap (`face` START / END): the face across the thickness where the wall's
 * material stops. Optional and additive: OUTER / INNER regions compile exactly as before.
 */
import { describe, expect, it } from 'vitest'
import { validateModel } from '@buildapp/model'
import type { BuildingCommand } from '@buildapp/commands'
import { manifoldReport, materialRuns } from '@buildapp/verification'
import { compileBuilding, objectTriangles, solidTriangles } from '../src/index.js'
import { V, withGround } from './helpers.js'

const house = (...extra: BuildingCommand[]) =>
  withGround(
    { type: 'defineMaterial', id: 'dark', name: 'dark render', color: '#3a3a3c' },
    // along +x from x = 0 to 8; outer face z = 0, inner face z = 0.4; both ends free
    { type: 'createWall', id: 'w', levelId: 'ground', start: { x: 0, z: 0 }, end: { x: 8, z: 0 }, thickness: 0.4, height: 3 },
    ...extra,
  )
const codes = (m: unknown): string[] => validateModel(m).issues.map((i) => i.code)

describe('v3.54.12 a finish region on a wall end cap', () => {
  it('START: a 2 mm skin 3 mm clear of the start cap, across the given part of the thickness, up to the given height', () => {
    const m = house({ type: 'createSurfaceRegion', id: 'cap', hostId: 'w', face: 'START', rect: { a0: 0, a1: 0.4, b0: 0, b1: 2 }, materialId: 'dark' })
    expect(validateModel(m).issues).toEqual([])
    const scene = compileBuilding(m)
    expect(scene.diagnostics).toEqual([])
    const skin = objectTriangles(scene, 'cap')
    expect(manifoldReport(skin)).toMatchObject({ closed: true, boundaryEdges: 0, duplicateEdges: 0 })
    expect(scene.meshes.find((x) => x.objectId === 'cap')).toMatchObject({ part: 'SURFACE_REGION', hostWallId: 'w', structural: false, materialId: 'dark' })
    // a ray from the west towards the cap (x = 0) meets the skin first, 3 mm clear of the cap, then the wall
    const runs = materialRuns(skin, V(-1, 1, 0.2), V(1, 0, 0))
    expect(runs).toHaveLength(1)
    expect(runs[0].t1 - runs[0].t0).toBeCloseTo(0.002, 9)
    expect(1 - runs[0].t1).toBeCloseTo(0.003, 9)
    expect(materialRuns(solidTriangles(scene, 'w'), V(-1, 1, 0.2), V(1, 0, 0))[0].t0).toBeCloseTo(1, 9)
    // nothing above the region's top, nothing outside the thickness
    expect(materialRuns(skin, V(-1, 2.5, 0.2), V(1, 0, 0))).toHaveLength(0)
    expect(materialRuns(skin, V(-1, 1, 0.6), V(1, 0, 0))).toHaveLength(0)
    // the wall is untouched by its cap's finish
    expect(solidTriangles(scene, 'w')).toEqual(solidTriangles(compileBuilding(house()), 'w'))
  })

  it('END and a part of the thickness: the skin is on the end cap and only across that part', () => {
    const m = house({ type: 'createSurfaceRegion', id: 'cap', hostId: 'w', face: 'END', rect: { a0: 0.1, a1: 0.3, b0: 0.5, b1: 2.5 }, materialId: 'dark' })
    const skin = objectTriangles(compileBuilding(m), 'cap')
    const runs = materialRuns(skin, V(9, 1, 0.2), V(-1, 0, 0))
    expect(runs).toHaveLength(1)
    expect(1 - runs[0].t1).toBeCloseTo(0.003, 9)
    expect(materialRuns(skin, V(9, 1, 0.05), V(-1, 0, 0))).toHaveLength(0)
    expect(materialRuns(skin, V(9, 0.3, 0.2), V(-1, 0, 0))).toHaveLength(0)
  })

  it('validation: on a cap `a` runs across the thickness (a rect wider than it is outside the host); OUTER keeps the length', () => {
    expect(() => house({ type: 'createSurfaceRegion', id: 'cap', hostId: 'w', face: 'START', rect: { a0: 0, a1: 0.6, b0: 0, b1: 2 }, materialId: 'dark' })).toThrow(/SURFACE_REGION_OUTSIDE_HOST/)
    const wide = structuredClone(house({ type: 'createSurfaceRegion', id: 'cap', hostId: 'w', face: 'START', rect: { a0: 0, a1: 0.4, b0: 0, b1: 2 }, materialId: 'dark' }))
    wide.surfaceRegions[0].rect.a1 = 0.6
    expect(codes(wide)).toContain('SURFACE_REGION_OUTSIDE_HOST')
    const face = house({ type: 'createSurfaceRegion', id: 'r', hostId: 'w', face: 'OUTER', rect: { a0: 0, a1: 6, b0: 0, b1: 2 }, materialId: 'dark' })
    expect(validateModel(face).issues).toEqual([])
    // the command's default stays OUTER
    const dflt = house({ type: 'createSurfaceRegion', id: 'r', hostId: 'w', rect: { a0: 0, a1: 6, b0: 0, b1: 2 }, materialId: 'dark' } as BuildingCommand)
    expect(dflt.surfaceRegions[0].face).toBe('OUTER')
  })
})
