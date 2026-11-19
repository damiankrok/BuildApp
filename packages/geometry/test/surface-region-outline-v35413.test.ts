/**
 * v3.54.13 — a finish region's real outline (model schema 1.9.0, `outline` inside `rect`): the skin follows the polygon
 * — a step between two widths, a raked edge — not its bounding rect; openings are still left out of it and the wall is
 * untouched. Without an outline the region is its rect, exactly as before.
 */
import { describe, expect, it } from 'vitest'
import { validateModel } from '@buildapp/model'
import type { BuildingCommand } from '@buildapp/commands'
import { manifoldReport, materialRuns } from '@buildapp/verification'
import { compileBuilding, objectTriangles, solidTriangles } from '../src/index.js'
import { V, withGround } from './helpers.js'

const house = (...extra: BuildingCommand[]) =>
  withGround(
    { type: 'defineMaterial', id: 'wood', name: 'timber', color: '#b07a4a' },
    // along +x from x = 0 to 8; outer face z = 0 (rays come from −z), inner face z = 0.4
    { type: 'createWall', id: 'w', levelId: 'ground', start: { x: 0, z: 0 }, end: { x: 8, z: 0 }, thickness: 0.4, height: 3 },
    ...extra,
  )
// is there skin at (a, b) on the outer face? a ray from the front at that point
const skinAt = (tris: ReturnType<typeof objectTriangles>, a: number, b: number): boolean => materialRuns(tris, V(a, b, -1), V(0, 0, 1)).length > 0

describe('v3.54.13 a finish region with an outline', () => {
  // an L: 1..3 wide up to 1.5 m, then 1..6 wide up to 2.8 m (a step between "storeys"), and a raked corner
  const outline = [
    { a: 1, b: 0 },
    { a: 3, b: 0 },
    { a: 3, b: 1.5 },
    { a: 6, b: 1.5 },
    { a: 6, b: 2.2 },
    { a: 5.4, b: 2.8 },
    { a: 1, b: 2.8 },
  ]
  const region: BuildingCommand = { type: 'createSurfaceRegion', id: 'r', hostId: 'w', face: 'OUTER', rect: { a0: 1, a1: 6, b0: 0, b1: 2.8 }, outline, materialId: 'wood' }

  it('the skin is the polygon: inside the step and under the rake there is skin, outside the polygon (but in its rect) none', () => {
    const m = house(region)
    expect(validateModel(m).issues).toEqual([])
    const scene = compileBuilding(m)
    expect(scene.diagnostics).toEqual([])
    const skin = objectTriangles(scene, 'r')
    expect(manifoldReport(skin)).toMatchObject({ closed: true, boundaryEdges: 0 })
    expect(skinAt(skin, 2, 0.5)).toBe(true)
    expect(skinAt(skin, 2, 2.5)).toBe(true)
    expect(skinAt(skin, 5, 2)).toBe(true)
    // in the rect, outside the polygon: below the step, and beyond the rake
    expect(skinAt(skin, 4.5, 0.7)).toBe(false)
    expect(skinAt(skin, 5.9, 2.7)).toBe(false)
    // outside the rect
    expect(skinAt(skin, 0.5, 1)).toBe(false)
    // the wall is untouched
    expect(solidTriangles(scene, 'w')).toEqual(solidTriangles(compileBuilding(house()), 'w'))
  })

  it('an opening inside the outline is left out of it; one across its edge only where they overlap', () => {
    const m = house(
      region,
      { type: 'cutOpening', id: 'o1', wallId: 'w', kind: 'WINDOW', offset: 1.5, width: 1, sill: 0.9, height: 1.2 } as BuildingCommand,
      { type: 'cutOpening', id: 'o2', wallId: 'w', kind: 'WINDOW', offset: 2.5, width: 1, sill: 0.3, height: 0.8 } as BuildingCommand,
    )
    expect(validateModel(m).issues).toEqual([])
    const skin = objectTriangles(compileBuilding(m), 'r')
    expect(manifoldReport(skin)).toMatchObject({ closed: true, boundaryEdges: 0 })
    expect(skinAt(skin, 2, 1.5)).toBe(false)
    expect(skinAt(skin, 2, 0.5)).toBe(true)
    // o2 straddles the step's corner: its part inside the polygon is a hole, its part outside stays bare wall
    expect(skinAt(skin, 2.8, 0.7)).toBe(false)
    expect(skinAt(skin, 3.3, 0.7)).toBe(false)
    expect(skinAt(skin, 2.7, 1.3)).toBe(true)
  })

  it('without an outline the region is its rect, compiled exactly as before', () => {
    const rect = house({ type: 'createSurfaceRegion', id: 'r', hostId: 'w', face: 'OUTER', rect: { a0: 1, a1: 6, b0: 0, b1: 2.8 }, materialId: 'wood' })
    const skin = objectTriangles(compileBuilding(rect), 'r')
    expect(skinAt(skin, 4.5, 0.7)).toBe(true)
    expect(rect.surfaceRegions[0]).not.toHaveProperty('outline')
  })

  it('validation: an outline leaving its rect, crossing itself, or on an end cap is refused', () => {
    const bad = (o: Array<{ a: number; b: number }>, face: 'OUTER' | 'START' = 'OUTER') => {
      const m = structuredClone(house(region))
      m.surfaceRegions[0].outline = o
      m.surfaceRegions[0].face = face
      if (face === 'START') m.surfaceRegions[0].rect = { a0: 0, a1: 0.4, b0: 0, b1: 2 }
      return validateModel(m).issues.map((i) => i.code)
    }
    expect(bad([{ a: 1, b: 0 }, { a: 7, b: 0 }, { a: 1, b: 2 }])).toContain('SURFACE_REGION_OUTLINE_INVALID')
    expect(bad([{ a: 1, b: 0 }, { a: 3, b: 2 }, { a: 3, b: 0 }, { a: 1, b: 2 }])).toContain('SURFACE_REGION_OUTLINE_INVALID')
    expect(bad([{ a: 0, b: 0 }, { a: 0.4, b: 0 }, { a: 0, b: 2 }], 'START')).toContain('SURFACE_REGION_OUTLINE_INVALID')
  })
})
