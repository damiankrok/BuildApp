/**
 * BUILDPLAN-ANALYZER-005Y-N4 (C): a door's leaf and arc read with a callout printed over them (`doorLeafFound`), on a
 * synthetic plan (the 005Y-N2 setting: a metre gap in a 0.4 m front wall at 0.025 m/px). A plan prints a door's size
 * in a ring beside it, often over its arc: what lies under the ring is unseen — neither ink nor paper. The leaf tells
 * which way the door opens (the side of the wall it is drawn on) and at which jamb it hangs.
 *  - an outward door with its arc half under a ring: OUT, hung at its jamb;
 *  - the same drawn inside, hung at the other jamb: IN, at that jamb;
 *  - a ring and a leaf with no arc beside them, or a ring over everything but the leaf: no door symbol;
 *  - nothing hidden: the strict 005Y-N2 reading, unchanged.
 */
import { describe, expect, it } from 'vitest'
import { Canvas } from '@buildapp/synthetic-drawings'
import { doorLeafFound } from '../src/v2/openings-v2.js'
import type { PixelBox, WallHost } from '../src/v2/openings-v2.js'
import type { PlanFrameV2 } from '../src/v2/frame.js'

const MPP = 0.025
const plan = { frameId: 'p', mppX: MPP, mppY: MPP, toPixel: (x: number, z: number) => ({ x: 100 + x / MPP, y: 300 - z / MPP }), toWorld: (px: number, py: number) => ({ x: (px - 100) * MPP, z: (300 - py) * MPP }) } as unknown as PlanFrameV2
const T = 0.4
const host: WallHost = { massId: 'main', facade: 'FRONT', planeAt: 0, from: 0, to: 10, centreAt: T / 2, storeyIndex: 0, floorY: 0, storeyHeightM: 3 }
const gap: [number, number] = [4, 5]
const px = (x: number, z: number) => plan.toPixel(x, z)

function wall(c: Canvas): void {
  c.fill(px(0, T).x, px(0, T).y, px(gap[0], 0).x, px(gap[0], 0).y, 0)
  c.fill(px(gap[1], T).x, px(gap[1], T).y, px(10, 0).x, px(10, 0).y, 0)
}
/** a leaf hung at `jamb`, drawn open to the side `inward` (+1 into the building), and the arc its tip sweeps */
function door(c: Canvas, jamb: number, inward: 1 | -1, withArc = true): void {
  const towards = jamb === gap[0] ? 1 : -1
  const hingeX = jamb + towards * 0.03
  const a = px(hingeX, T / 2)
  const b = px(hingeX, T / 2 + inward * 1)
  c.line(a.x, a.y, b.x, b.y, 2, 170)
  if (!withArc) return
  for (let deg = 0; deg <= 90; deg += 0.5) {
    const r = (deg * Math.PI) / 180
    const p = px(hingeX + towards * Math.cos(r), T / 2 + inward * Math.sin(r))
    c.plot(Math.round(p.x), Math.round(p.y), 150)
  }
}
/** a callout ring printed over the plan: its outline inked, its inside blank paper (the text aside) */
function ring(c: Canvas, cx: number, cz: number, rM: number): PixelBox {
  const p = px(cx, cz)
  const r = rM / MPP
  c.fill(p.x - r, p.y - r, p.x + r, p.y + r, 255)
  for (let deg = 0; deg < 360; deg += 1) c.plot(Math.round(p.x + r * Math.cos((deg * Math.PI) / 180)), Math.round(p.y + r * Math.sin((deg * Math.PI) / 180)), 60)
  return { x0: p.x - r - 2, y0: p.y - r - 2, x1: p.x + r + 2, y1: p.y + r + 2 }
}
const read = (draw: (c: Canvas) => PixelBox[], useBoxes = true) => {
  const c = new Canvas(500, 500)
  c.fill(0, 0, 499, 499, 236)
  wall(c)
  const boxes = draw(c)
  return doorLeafFound(c.toRaster(), plan, host, gap, T, useBoxes ? boxes : [])
}

describe('a door symbol under a printed callout', () => {
  it('is an outward door, hung at its jamb, with half its arc under the ring', () => {
    const drawn = (c: Canvas) => { door(c, gap[0], -1); return [ring(c, 4.75, -0.65, 0.38)] }
    expect(read(drawn)).toEqual({ swing: 'OUT', hingeAt: 'LOW' })
    // read without knowing the ring is printed over the arc, the hidden part is paper and the door is lost
    expect(read(drawn, false)).toBeUndefined()
  })
  it('is an inward door hung at the other jamb, the same way', () => {
    expect(read((c) => { door(c, gap[1], 1); return [ring(c, 4.25, 1.05, 0.38)] })).toEqual({ swing: 'IN', hingeAt: 'HIGH' })
  })
  it('is no door symbol where only a leaf and a ring are drawn', () => {
    expect(read((c) => { door(c, gap[0], -1, false); return [ring(c, 4.75, -0.65, 0.38)] })).toBeUndefined()
  })
  it('is no door symbol where the ring hides all but a sliver of the arc', () => {
    expect(read((c) => { door(c, gap[0], -1); return [ring(c, 4.6, -0.6, 0.62)] })).toBeUndefined()
  })
  it('reads a door with nothing printed over it as before', () => {
    expect(read((c) => { door(c, gap[1], 1); return [] })).toEqual({ swing: 'IN', hingeAt: 'HIGH' })
  })
})
