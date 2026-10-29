/**
 * N8-03D2: partitions, doors and rooms read off a plan (`readInterior`), on synthetic plans drawn from invented
 * dimensions at 50 px per metre — a house 10 × 8 m with 0.40 m walls and 0.12 m partitions. Every case is invented.
 *  - a door whose leaf is drawn shorter than its gap, at the end of a partition: read from its arc and its leaf, and the
 *    rooms either side are two; with no arc, or an arc and no leaf, the gap stays open and the rooms one;
 *  - a door between the faces of two parallel partitions whose ends meet along: read where its swing is drawn, never
 *    where it is not;
 *  - a door between a partition's end and the side of a solid block;
 *  - the jambs of one door where one piece is drawn thicker (a wardrobe's carcass along it): one line, one door;
 *  - the openings in the storey's slab: no room's floor; one a room surrounds is its hole, one against a wall is outside
 *    its outline;
 *  - a room number is an upright reading: a digit read rotated (a dimension's) numbers nothing;
 *  - through the commands and the compiler: a room with a hole validates, its floor marker leaves the hole open, and a
 *    hole outside the room is refused.
 */
import { describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-cv'
import { applyCommands } from '@buildapp/commands'
import { createEmptyModel, validateModel } from '@buildapp/model'
import { compileBuilding } from '@buildapp/geometry'
import type { Triangle } from '@buildapp/geometry'
import { readInterior } from '../src/index.js'
import type { LabelToken, PlanFrameV2 } from '../src/index.js'

const PPM = 50
const OX = 40
const OY = 40
const W = 620
const H = 520
const T = 0.4
const P = 0.12
const frame: PlanFrameV2 = {
  frameId: 'plan-1',
  assetId: 'asset-plan',
  storeyIndex: 1,
  mppX: 1 / PPM,
  mppY: 1 / PPM,
  originPx: { x: OX, y: OY },
  why: 'test',
  // as on the sheets: the plan's rows run down while z runs up (the front at the bottom)
  toWorld: (px, py) => ({ x: (px - OX) / PPM, z: 8 - (py - OY) / PPM }),
  toPixel: (x, z) => ({ x: OX + x * PPM, y: OY + (8 - z) * PPM }),
  wallPx: (T * PPM) / 2,
}
const body = { x0: 0, z0: 0, x1: 10, z1: 8 }
type Box = { x0: number; z0: number; x1: number; z1: number }
type Arc = { cx: number; cz: number; r: number; from: number; to: number }
function plan(boxes: Box[], arcs: Arc[] = []): Raster {
  const data = new Uint8ClampedArray(W * H * 4).fill(255)
  const put = (px: number, py: number, v: number): void => {
    if (px < 0 || py < 0 || px >= W || py >= H) return
    const o = (py * W + px) * 4
    data[o] = v
    data[o + 1] = v
    data[o + 2] = v
  }
  const all = [{ x0: 0, z0: 0, x1: 10, z1: T }, { x0: 0, z0: 8 - T, x1: 10, z1: 8 }, { x0: 0, z0: 0, x1: T, z1: 8 }, { x0: 10 - T, z0: 0, x1: 10, z1: 8 }, ...boxes]
  for (const b of all) {
    const top = frame.toPixel(b.x0, b.z1)
    const bottom = frame.toPixel(b.x1, b.z0)
    for (let py = Math.round(top.y); py < Math.round(bottom.y); py += 1) for (let px = Math.round(top.x); px < Math.round(bottom.x); px += 1) put(px, py, 30)
  }
  for (const a of arcs) {
    for (let d = a.from; d <= a.to; d += 0.5) {
      const p = frame.toPixel(a.cx + a.r * Math.cos((d * Math.PI) / 180), a.cz + a.r * Math.sin((d * Math.PI) / 180))
      put(Math.round(p.x), Math.round(p.y), 120)
    }
  }
  return { width: W, height: H, data }
}
/** a partition along x at z (from x0 to x1) or along z at x (from z0 to z1) */
const alongX = (z: number, x0: number, x1: number, t = P): Box => ({ x0, z0: z - t / 2, x1, z1: z + t / 2 })
const alongZ = (x: number, z0: number, z1: number, t = P): Box => ({ x0: x - t / 2, z0, x1: x + t / 2, z1 })
/** a one-pixel leaf drawn open from a hinge, along z (dz ±) or along x (dx ±) */
const leafZ = (x: number, z: number, length: number): Box => ({ x0: x, z0: Math.min(z, z + length), x1: x + 1 / PPM, z1: Math.max(z, z + length) })
const leafX = (x: number, z: number, length: number): Box => ({ x0: Math.min(x, x + length), z0: z, x1: Math.max(x, x + length), z1: z + 1 / PPM })

describe('N8-03D2: a door whose leaf is shorter than its gap', () => {
  // a partition along x at z 4 from the west wall to x 4, and one along z at x 5 from z 4 to the south wall: a 0.94 m
  // gap between the first's end and the second's face, its 0.75 m leaf hinged at the second, drawn open along +z
  const walls = [alongX(4, 0.4, 4), alongZ(5, 4, 7.6)]
  const hinge = { x: 4.9, z: 4.06 }
  const arc = { cx: hinge.x, cz: hinge.z, r: 0.75, from: 90, to: 180 }
  it('is read from its arc and its leaf, and closes the room', () => {
    const r = readInterior(plan([...walls, leafZ(hinge.x, hinge.z, 0.75)], [arc]), frame, body, T, 1)
    const door = r.doors.find((d) => d.wallAxis === 'X' && Math.abs(d.at - 4) < 0.1)
    expect(door?.why).toMatch(/0\.7\d m leaf, shorter than the gap/)
    expect(door?.from).toBeCloseTo(4, 1)
    expect(door?.to).toBeCloseTo(4.94, 1)
    expect(r.rooms).toHaveLength(2)
  })
  it('with no arc, or an arc and no leaf, the gap stays open: one room', () => {
    expect(readInterior(plan([...walls, leafZ(hinge.x, hinge.z, 0.75)]), frame, body, T, 1).rooms).toHaveLength(1)
    expect(readInterior(plan(walls, [arc]), frame, body, T, 1).rooms).toHaveLength(1)
  })
})

describe('N8-03D2: a door between the faces of two parallel partitions whose ends meet', () => {
  // along x at z 3 from the west wall to x 3.5, and along x at z 4.1 from x 3.25 to the east wall: a doorway square to
  // them between their faces (z 3.06..4.04) where they overlap along (x 3.25..3.5); the leaf hinged at the upper face,
  // drawn open along -x
  const walls = [alongX(3, 0.4, 3.5), alongX(4.1, 3.25, 9.6)]
  const hinge = { x: 3.38, z: 3.1 }
  it('is read where its swing is drawn, and the two sides are two rooms', () => {
    const r = readInterior(plan([...walls, leafX(hinge.x, hinge.z, -0.8)], [{ cx: hinge.x, cz: hinge.z, r: 0.8, from: 90, to: 180 }]), frame, body, T, 1)
    const door = r.doors.find((d) => d.wallAxis === 'Z')
    expect(door?.why).toMatch(/two parallel partitions whose ends meet/)
    expect(door?.from).toBeCloseTo(3.06, 1)
    expect(door?.to).toBeCloseTo(4.04, 1)
    expect(r.rooms).toHaveLength(2)
  })
  it('without a swing there is no door: the plan draws no wall there', () => {
    const r = readInterior(plan(walls), frame, body, T, 1)
    expect(r.doors.filter((d) => d.wallAxis === 'Z')).toEqual([])
    expect(r.rooms).toHaveLength(1)
  })
})

describe('N8-03D2: a door between a partition and the side of a solid block', () => {
  // a 0.6 × 0.6 m solid block against the north wall (x 6..6.6), a partition along z at x 7.6 from z 1 to the south
  // wall: a 0.94 m gap between the block's side and the partition's face, the leaf hinged at the block
  const boxes = [{ x0: 6, z0: 0.4, x1: 6.6, z1: 1 }, alongZ(7.6, 1, 7.6)]
  const hinge = { x: 6.64, z: 1.04 }
  it('is read, the block its far jamb', () => {
    const r = readInterior(plan([...boxes, leafZ(hinge.x, hinge.z, 0.75)], [{ cx: hinge.x, cz: hinge.z, r: 0.75, from: 0, to: 90 }]), frame, body, T, 1)
    expect(r.blocks.length).toBeGreaterThan(0)
    const door = r.doors.find((d) => /side of the solid block/.test(d.why))
    expect(door).toBeDefined()
    expect(r.rooms).toHaveLength(2)
  })
})

describe('N8-03D2: the jambs of one door, one of them drawn thicker', () => {
  // along x at z 5.08: a 0.12 m piece from the west wall to x 2, a 0.24 m piece (a carcass along it, z 5.02..5.26)
  // from x 2.9 to a partition along z at x 4; the thicker piece's centre is 0.06 m off the line, across the old
  // rounding bucket's edge
  it('pair across the door: one line, one door', () => {
    const r = readInterior(plan([alongX(5.08, 0.4, 2), { x0: 2.9, z0: 5.02, x1: 4, z1: 5.26 }, alongZ(4, 5.02, 7.6)]), frame, body, T, 1)
    const door = r.doors.find((d) => d.wallAxis === 'X' && d.from > 1.9 && d.to < 3)
    expect(door?.widthM).toBeCloseTo(0.9, 1)
    expect(r.rooms).toHaveLength(2)
  })
})

describe('N8-03D2: the openings in the storey’s slab are no room’s floor', () => {
  const island = [{ x: 5, z: 3 }, { x: 6, z: 3 }, { x: 6, z: 4 }, { x: 5, z: 4 }]
  const againstWall = [{ x: 1, z: 0.4 }, { x: 2, z: 0.4 }, { x: 2, z: 1.5 }, { x: 1, z: 1.5 }]
  const inside = (p: { x: number; z: number }, poly: ReadonlyArray<{ x: number; z: number }>): boolean => {
    let c = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if (poly[i].z > p.z !== poly[j].z > p.z && p.x < ((poly[j].x - poly[i].x) * (p.z - poly[i].z)) / (poly[j].z - poly[i].z) + poly[i].x) c = !c
    return c
  }
  it('an opening the room surrounds is its hole; one against a wall is outside its outline', () => {
    const r = readInterior(plan([]), frame, body, T, 1, [], [], { slabOpenings: [island, againstWall] })
    expect(r.rooms).toHaveLength(1)
    const room = r.rooms[0]
    expect(room.holes).toHaveLength(1)
    expect(room.holes?.[0]).toEqual(island)
    expect(room.areaM2).toBeCloseTo(9.2 * 7.2 - 1 - 1.1, 6)
    expect(inside({ x: 1.5, z: 1 }, room.polygon)).toBe(false)
    expect(inside({ x: 5.5, z: 3.5 }, room.polygon)).toBe(true)
    expect(inside({ x: 5.5, z: 3.5 }, room.holes?.[0] ?? [])).toBe(true)
  })
  it('without openings the room is the whole floor, as before', () => {
    const r = readInterior(plan([]), frame, body, T, 1)
    expect(r.rooms[0].holes).toBeUndefined()
    expect(r.rooms[0].areaM2).toBeCloseTo(9.2 * 7.2, 6)
  })
})

describe('N8-03D2: a room number is an upright reading', () => {
  const box = (x: number, z: number) => ({ x0: frame.toPixel(x, z).x - 6, y0: frame.toPixel(x, z).y - 12, x1: frame.toPixel(x, z).x + 6, y1: frame.toPixel(x, z).y + 12 })
  const token = (text: string, orientation: string): LabelToken => ({ text, box: box(3, 3), heightPx: 24, confidence: 0.8, orientation })
  const small = (x: number): LabelToken => ({ text: 'x', box: { x0: OX + x * PPM, y0: OY, x1: OX + x * PPM + 5, y1: OY + 10 }, heightPx: 10, confidence: 0.8, orientation: 'HORIZONTAL' })
  const published = [{ number: '3', label: 'Pokój', areaM2: 60 }]
  it('a digit read rotated numbers nothing; the same digit upright numbers its room', () => {
    const others = [small(1), small(2), small(4)]
    expect(readInterior(plan([]), frame, body, T, 1, [token('3', 'ROTATED_CW'), ...others], published).rooms[0].number).toBeUndefined()
    expect(readInterior(plan([]), frame, body, T, 1, [token('3', 'HORIZONTAL'), ...others], published).rooms[0].number).toBe('3')
  })
})

describe('N8-03D2: a room with a hole, applied and compiled (model 1.7.0)', () => {
  const outer = [{ x: 0, z: 0 }, { x: 6, z: 0 }, { x: 6, z: 4 }, { x: 0, z: 4 }]
  const hole = [{ x: 2, z: 1 }, { x: 3, z: 1 }, { x: 3, z: 2.5 }, { x: 2, z: 2.5 }]
  const build = (holes: Array<Array<{ x: number; z: number }>>) =>
    applyCommands(createEmptyModel('m', 'n8-03d2'), [
      { type: 'createBuilding', id: 'b', name: 'b' },
      { type: 'createLevel', id: 'lvl-1', index: 1, elevation: 2.8, height: 3 },
      { type: 'createRoom', id: 'room', levelId: 'lvl-1', polygon: outer, holes },
    ] as never)
  const hits = (tris: readonly Triangle[], x: number, z: number): boolean =>
    tris.some((t) => {
      const d = (a: { x: number; z: number }, b: { x: number; z: number }) => (b.x - a.x) * (z - a.z) - (b.z - a.z) * (x - a.x)
      const d1 = d(t.a, t.b)
      const d2 = d(t.b, t.c)
      const d3 = d(t.c, t.a)
      return (d1 > 0 && d2 > 0 && d3 > 0) || (d1 < 0 && d2 < 0 && d3 < 0)
    })
  it('validates, and its floor marker leaves the hole open', () => {
    const applied = build([hole])
    expect(validateModel(applied.model).ok).toBe(true)
    const floor = compileBuilding(applied.model).meshes.filter((m) => m.part === 'ROOM_FLOOR').flatMap((m) => m.triangles)
    expect(hits(floor, 2.5, 1.7)).toBe(false)
    for (const [x, z] of [[1.1, 0.7], [4.5, 3], [2.5, 3.2], [3.4, 1.7]]) expect(hits(floor, x, z)).toBe(true)
  })
  it('a hole outside the room is refused', () => {
    const out = validateModel({ ...build([]).model, rooms: [{ ...build([]).model.rooms[0], holes: [[{ x: 5, z: 3 }, { x: 7, z: 3 }, { x: 7, z: 5 }, { x: 5, z: 5 }]] }] })
    expect(out.ok).toBe(false)
    expect(out.issues.map((i) => i.code)).toContain('ROOM_HOLE_OUTSIDE')
  })
})
