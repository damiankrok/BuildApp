/**
 * 005Y-N7 (C): a balcony that stands proud of its face, read from the plan of the storey it opens from.
 *
 * Synthetic plans at 0.025 m/px: the west face of a body at x = 0 (pixel column 100), z running up the sheet from
 * row 500. What makes an outline a balcony — an edge in front of the doors, closed back to the face at both ends and
 * turning there — and what does not: the roof's overhang line running round the storey, a dimension chain, a line
 * with no returns, doors the outline is not in front of.
 */
import { describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-cv'
import type { PlanFrameV2 } from '../src/v2/frame.js'
import { balconyRect, balustradePath, floorLevelDoorGroups, readBalconyOutline } from '../src/v2/projecting-balcony.js'

const MPP = 0.025
const frame = { frameId: 'f', assetId: 'a', storeyIndex: 1, mppX: MPP, mppY: MPP, originPx: { x: 100, y: 500 }, why: 'synthetic', wallPx: 6, toWorld: (px: number, py: number) => ({ x: (px - 100) * MPP, z: (500 - py) * MPP }), toPixel: (x: number, z: number) => ({ x: 100 + x / MPP, y: 500 - z / MPP }) } as PlanFrameV2

type Sheet = { raster: Raster; line: (x0: number, z0: number, x1: number, z1: number) => Sheet; clear: (x: number, z: number, r: number) => Sheet }

/** A white sheet with the body's west wall band (x 0..0.3, z 0..9) drawn black. */
function sheet(): Sheet {
  const W = 600
  const H = 600
  const data = new Uint8ClampedArray(W * H * 4).fill(255)
  const set = (x: number, y: number, v: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return
    const o = (y * W + x) * 4
    data[o] = data[o + 1] = data[o + 2] = v
  }
  const raster = { width: W, height: H, data }
  const s: Sheet = {
    raster,
    // a 1 px line in world coordinates (axis-aligned)
    line: (x0, z0, x1, z1) => {
      const a = frame.toPixel(x0, z0)
      const b = frame.toPixel(x1, z1)
      for (let x = Math.round(Math.min(a.x, b.x)); x <= Math.round(Math.max(a.x, b.x)); x += 1) for (let y = Math.round(Math.min(a.y, b.y)); y <= Math.round(Math.max(a.y, b.y)); y += 1) set(x, y, 30)
      return s
    },
    // a callout circle printed over the drawing: white inside
    clear: (x, z, r) => {
      const c = frame.toPixel(x, z)
      for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) if (dx * dx + dy * dy <= r * r) set(Math.round(c.x) + dx, Math.round(c.y) + dy, 255)
      return s
    },
  }
  for (let x = 0; x <= 0.3; x += MPP) s.line(x, 0, x, 9)
  return s
}

/** The slab outline: a doubled edge 1.0 m out over z 2..6, closed back to the face at both ends. */
const outline = (s: Sheet): Sheet => s.line(-1.0, 2, -1.0, 6).line(-0.95, 2.05, -0.95, 5.95).line(-1.0, 2, 0, 2).line(-1.0, 6, 0, 6)
/** The roof's overhang drawn round the storey 0.65 m out, past both corners. */
const overhang = (s: Sheet): Sheet => s.line(-0.65, -0.8, -0.65, 9.8)

const read = (s: Sheet, doors: [number, number] = [2.6, 5.4]) => readBalconyOutline(s.raster, frame, 'WEST', 0, doors, [0, 9])

describe('a balcony standing proud of the face, from the plan', () => {
  it('the outline in front of the doors: its edge, its two ends', () => {
    const o = read(outline(sheet()))
    expect(o).toBeDefined()
    expect(o?.reach).toBeCloseTo(1.0, 1)
    expect(o?.from).toBeCloseTo(2, 1)
    expect(o?.to).toBeCloseTo(6, 1)
  })

  it('the roof’s overhang line nearer the face is passed over: it runs on past the outline’s ends', () => {
    const o = read(overhang(outline(sheet())))
    expect(o?.reach).toBeCloseTo(1.0, 1)
    expect(o?.why).toContain('nearer lines passed over')
  })

  it('a callout circle printed on the edge does not break it', () => {
    const o = read(outline(sheet()).clear(-1.0, 4, 10))
    expect(o?.reach).toBeCloseTo(1.0, 1)
  })

  it('negative: the overhang alone is not a balcony', () => {
    expect(read(overhang(sheet()))).toBeUndefined()
  })

  it('negative: a line parallel to the face that is not closed back to it (a dimension chain) is not a balcony', () => {
    expect(read(sheet().line(-1.0, 2, -1.0, 6))).toBeUndefined()
  })

  it('negative: doors the outline is not in front of have no balcony', () => {
    expect(read(outline(sheet()), [6.8, 8.2])).toBeUndefined()
  })

  it('the slab and its balustrade: face to edge, three free sides', () => {
    const o = read(outline(sheet()))
    if (!o) throw new Error('expected an outline')
    const r = balconyRect('WEST', 0, o)
    expect(r.x1).toBe(0)
    expect(r.x0).toBeCloseTo(-1.0, 1)
    const path = balustradePath('WEST', 0, o)
    expect(path).toHaveLength(4)
    expect(path[0].x).toBeCloseTo(-0.05, 6)
    expect(path[1].x).toBeCloseTo(-o.reach + 0.05, 6)
  })
})

describe('the doors a balcony is stepped onto from', () => {
  const opening = (id: string, facade: 'WEST' | 'EAST', interval: [number, number], sillY: number, headY: number) => ({ id, storeyIndex: 1, massId: 'main', facade, planeAt: facade === 'WEST' ? 0 : 10, interval, sillY, headY })
  it('floor-level openings of a storey, grouped by face; a window with a sill is not one', () => {
    const groups = floorLevelDoorGroups([opening('d1', 'WEST', [2.6, 3.4], 3.0, 5.2), opening('d2', 'WEST', [4.6, 5.4], 3.02, 5.2), opening('w1', 'EAST', [3, 4], 3.9, 5.2), opening('g0', 'WEST', [1, 2], 0, 2.1)], 1, 3.0)
    expect(groups).toEqual([{ side: 'WEST', massId: 'main', planeAt: 0, span: [2.6, 5.4], openingIds: ['d1', 'd2'] }])
  })
})
