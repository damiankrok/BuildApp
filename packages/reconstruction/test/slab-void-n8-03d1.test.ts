/**
 * N8-03D1: a void in an upper floor as the storey's plan draws it (`readSlabVoids`), and the hole it makes in that
 * storey's slab (`emitBuilding` → `applyCommands` → `compileBuilding`), on a synthetic plan at 0.025 m/px (floor fill
 * 236, a void filled 197, as the ARCHON sheets draw them). Every case is invented.
 *  - a rectangular fill: read with its own corners, to a pixel, words printed in it notwithstanding;
 *  - an L-shaped fill: read as an L, not as its bounding box;
 *  - refused and named: a patch smaller than a person stands in, a strip narrower than 0.9 m, a hatched region, a
 *    tinted (coloured) region, a fill overlapping the stair hole, a fill with no
 *    storey below; a tone within a few grey levels of the floor (a tiled bathroom) is not looked at at all;
 *  - through the compiler: vertical rays through the void meet no slab triangle, rays through the floor beside it and
 *    elsewhere do; the stair hole stays open; the ground slab and the wing's slab are whole; a void past the slab's
 *    edge by less than the snap is taken to the edge.
 */
import { describe, expect, it } from 'vitest'
import { Canvas } from '@buildapp/synthetic-drawings'
import { applyCommands } from '@buildapp/commands'
import { createEmptyModel, validateModel } from '@buildapp/model'
import { compileBuilding } from '@buildapp/geometry'
import type { Triangle } from '@buildapp/geometry'
import { readSlabVoids } from '../src/v2/slab-void.js'
import type { SlabVoid } from '../src/v2/slab-void.js'
import type { PlanFrameV2 } from '../src/v2/frame.js'
import { emitBuilding } from '../src/index.js'
import type { BuildingV2, MassV2 } from '../src/index.js'

const MPP = 0.025
const plan = { frameId: 'p', mppX: MPP, mppY: MPP, toPixel: (x: number, z: number) => ({ x: 20 + x / MPP, y: 20 + (10 - z) / MPP }), toWorld: (px: number, py: number) => ({ x: (px - 20) * MPP, z: 10 - (py - 20) * MPP }) } as unknown as PlanFrameV2
const INTERIOR = [{ x0: 0.4, z0: 0.4, x1: 11.6, z1: 9.6 }]
const BELOW = [{ x0: 0, z0: 0, x1: 12, z1: 10 }]
const px = (x: number, z: number) => plan.toPixel(x, z)
/** fill the world rectangle [x0,x1]×[z0,z1] (exact pixel cover) */
const rect = (c: Canvas, x0: number, z0: number, x1: number, z1: number, v: number): void => {
  const a = px(x0, z1)
  const b = px(x1, z0)
  c.fill(a.x, a.y, b.x - 1, b.y - 1, v)
}
const sheet = (draw: (c: Canvas) => void): Canvas => {
  const c = new Canvas(560, 460)
  c.fill(0, 0, 559, 459, 255)
  rect(c, 0, 0, 12, 10, 30)
  rect(c, 0.4, 0.4, 11.6, 9.6, 236)
  draw(c)
  return c
}
/** words printed in a fill: a few strokes of dark ink */
const words = (c: Canvas, x: number, z: number): void => {
  for (let i = 0; i < 6; i++) {
    const p = px(x + i * 0.2, z)
    c.line(p.x, p.y, p.x + 4, p.y - 8, 1, 40)
  }
}
const read = (c: Canvas, options: Parameters<typeof readSlabVoids>[4] = { below: BELOW }) => readSlabVoids(c.toRaster(), plan, 1, INTERIOR, options)
const bbox = (v: SlabVoid) => ({ x0: Math.min(...v.polygon.map((p) => p.x)), x1: Math.max(...v.polygon.map((p) => p.x)), z0: Math.min(...v.polygon.map((p) => p.z)), z1: Math.max(...v.polygon.map((p) => p.z)) })

describe('N8-03D1: a void in the floor, read from the plan’s fill', () => {
  it('a rectangle: its own corners to a pixel, the words in it notwithstanding', () => {
    const { voids, refused } = read(sheet((c) => (rect(c, 5.3, 6.2, 7.4, 9.6, 197), words(c, 5.6, 8))))
    expect(refused).toEqual([])
    expect(voids).toHaveLength(1)
    const v = voids[0] as SlabVoid
    expect(v.polygon).toHaveLength(4)
    const b = bbox(v)
    for (const [got, want] of [[b.x0, 5.3], [b.x1, 7.4], [b.z0, 6.2], [b.z1, 9.6]] as const) expect(Math.abs(got - want)).toBeLessThanOrEqual(MPP + 1e-9)
    // the area to a pixel along the perimeter
    expect(Math.abs(v.areaM2 - 2.1 * 3.4)).toBeLessThanOrEqual(2 * (2.1 + 3.4) * MPP)
    expect(v.uncertaintyM).toBe(MPP)
    expect(v.fill.lumaStd).toBeLessThan(1)
    expect(v.why).toMatch(/words themselves are not read/)
  })
  it('an L: six corners, the area of the L and not of its box', () => {
    const { voids } = read(sheet((c) => (rect(c, 2, 2, 6, 4, 197), rect(c, 2, 4, 4, 7, 197))))
    expect(voids).toHaveLength(1)
    const v = voids[0] as SlabVoid
    expect(v.polygon).toHaveLength(6)
    expect(v.areaM2).toBeCloseTo(4 * 2 + 2 * 3, 1)
    expect(v.polygon).toContainEqual({ x: 4, z: 7 })
  })
  it('refuses, naming why: small, narrow, hatched, overlapping the stair, nothing below', () => {
    // 1.1 × 1.25 m: a flue, a shaft
    const small = read(sheet((c) => rect(c, 2, 2, 3.1, 3.25, 197)))
    expect(small.voids).toEqual([])
    expect(small.refused[0]?.why).toMatch(/smaller than/)
    const strip = read(sheet((c) => rect(c, 2, 2, 2.6, 8, 197)))
    expect(strip.voids).toEqual([])
    expect(strip.refused[0]?.why).toMatch(/narrower than/)
    const hatched = read(sheet((c) => {
      rect(c, 2, 2, 5, 6, 197)
      for (let x = 2.1; x < 5; x += 0.1) rect(c, x, 2, x + 0.05, 6, 236)
    }))
    expect(hatched.voids).toEqual([])
    const stair = read(sheet((c) => rect(c, 5, 5, 8, 8, 197)), { below: BELOW, stairHole: { x0: 7.5, z0: 6, x1: 8.5, z1: 7.3 } })
    expect(stair.voids).toEqual([])
    expect(stair.refused[0]?.why).toMatch(/stair hole/)
    const nothingBelow = read(sheet((c) => rect(c, 5, 5, 8, 8, 197)), { below: [{ x0: 0, z0: 0, x1: 4, z1: 10 }] })
    expect(nothingBelow.voids).toEqual([])
    expect(nothingBelow.refused[0]?.why).toMatch(/no storey/)
  })
  it('does not look at a tile tone, a coloured fill or wall ink', () => {
    expect(read(sheet((c) => rect(c, 2, 2, 6, 6, 217)))).toEqual({ voids: [], refused: [] })
    expect(read(sheet((c) => rect(c, 2, 2, 6, 6, 90)))).toEqual({ voids: [], refused: [] })
    const r = sheet((c) => rect(c, 2, 2, 6, 6, 197)).toRaster()
    // tint the region: red channel up, blue down (a zoning colour, not a grey fill)
    for (let y = 0; y < r.height; y++)
      for (let x = 0; x < r.width; x++) {
        const o = (y * r.width + x) * 4
        if (r.data[o] === 197) (r.data[o] = 215, r.data[o + 2] = 175)
      }
    expect(readSlabVoids(r, plan, 1, INTERIOR, { below: BELOW })).toEqual({ voids: [], refused: [] })
  })
})

// --- through the emitter, the commands and the compiler ---------------------------------------------------------
const T = 0.4
const mass = (id: string, role: 'MAIN' | 'ATTACHED', x0: number, z0: number, x1: number, z1: number, storeys: number[]): MassV2 => ({ id, role, x0, z0, x1, z1, storeys, featureId: `f-${id}`, sourceMassId: `src-${id}` })
const STAIR = { x0: 7.5, z0: 6, x1: 8.5, z1: 7.3 }
function building(slabVoids: SlabVoid[]): BuildingV2 {
  return {
    label: 'n8-03d1',
    wallThicknessM: T,
    slabThicknessM: 0.25,
    levels: [0, 1].map((i) => ({ index: i, id: `lvl-${i}`, elevation: i * 2.8, height: i === 0 ? 2.8 : 4, wallTop: i * 2.8 + 2.6, featureId: `f-lvl-${i}` })),
    masses: [mass('main', 'MAIN', 0, 0, 12, 10, [0, 1]), mass('attached-0', 'ATTACHED', 12, 0, 16, 6, [0])],
    attachedRoofs: [],
    pitchedAttachedRoofs: [],
    recesses: [],
    returns: [],
    balconies: [],
    railings: [],
    portalHeads: [],
    verges: [],
    terraces: [],
    massTones: [],
    returnTones: [],
    facadeGraph: { nodes: [], edges: [] },
    chimneys: [],
    rooflights: [],
    openings: [],
    sharedDoors: [],
    interior: [],
    slabVoids,
    stair: { hypothesis: { shaft: STAIR, why: 'test' } as never, emit: 'PLACEHOLDER', fromLevel: 0, toLevel: 1, slabHole: STAIR, featureId: 'f-stair', provenance: 'SOURCE_DERIVED' },
    assemblies: [],
    surfaceRegions: [],
  }
}
function rayHits(tris: readonly Triangle[], x: number, z: number): boolean {
  const d = (a: { x: number; z: number }, b: { x: number; z: number }, p: { x: number; z: number }) => (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x)
  return tris.some((t) => {
    if (Math.abs(d(t.a, t.b, t.c)) < 1e-12) return false
    const d1 = d(t.a, t.b, { x, z })
    const d2 = d(t.b, t.c, { x, z })
    const d3 = d(t.c, t.a, { x, z })
    return (d1 > 0 && d2 > 0 && d3 > 0) || (d1 < 0 && d2 < 0 && d3 < 0)
  })
}

describe('N8-03D1: the void cut from the slab, emitted, applied and compiled', () => {
  // the fill drawn to the back wall's inner line, read 0.05 m short of it (the drawn line's own width)
  const v = read(sheet((c) => rect(c, 5.3, 6.2, 7.4, 9.55, 197))).voids
  const applied = applyCommands(createEmptyModel('m', 'n8-03d1'), emitBuilding(building(v), 'n8-03d1').program)
  const model = applied.model
  const scene = compileBuilding(model)
  const tris = (id: string) => scene.meshes.filter((m) => m.part === 'SLAB' && m.objectId === id).flatMap((m) => m.triangles)
  it('the model is valid and the upper slab carries the stair hole and the void, taken to its edge', () => {
    expect(validateModel(model).ok).toBe(true)
    const upper = model.slabs.find((s) => s.id === 'slab-main-1')
    expect(upper?.holes).toHaveLength(2)
    expect(Math.max(...(upper?.holes?.[1] ?? []).map((p) => p.z))).toBeCloseTo(10 - T, 6)
    expect(model.slabs.filter((s) => s.id !== 'slab-main-1').every((s) => !s.holes || s.holes.length === 0)).toBe(true)
  })
  it('rays: through the void and the stair hole nothing; beside them and elsewhere the slab', () => {
    const upper = tris('slab-main-1')
    for (const [x, z] of [[5.4, 6.3], [6.3, 8], [7.3, 9.5], [8, 6.6]]) expect(rayHits(upper, x, z)).toBe(false)
    for (const [x, z] of [[5.15, 8], [7.55, 8], [6.3, 6.05], [2, 2], [10, 8], [8, 5.8], [8, 7.5]]) expect(rayHits(upper, x, z)).toBe(true)
    for (const [x, z] of [[6.3, 8], [8, 6.6], [2, 2]]) expect(rayHits(tris('slab-main-0'), x, z)).toBe(true)
    expect(rayHits(tris('slab-attached-0-0'), 14.3, 2.1)).toBe(true)
  })
  it('no void read: the slab as before, the stair hole alone', () => {
    const before = applyCommands(createEmptyModel('m', 'n8-03d1'), emitBuilding(building([]), 'n8-03d1').program).model
    expect(before.slabs.find((s) => s.id === 'slab-main-1')?.holes).toHaveLength(1)
  })
})
