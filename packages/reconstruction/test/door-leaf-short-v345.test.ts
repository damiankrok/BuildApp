/**
 * v3.45: a door's leaf drawn the frame's width short of its gap is the gap's own leaf (`doorLeafFound`). Synthetic
 * plan in the 005Y-N2 setting: a metre gap in a 0.4 m front wall at 0.025 m/px. Invented geometry only.
 *  - a leaf 0.82 of the gap, its arc to match: a door (it was not read before);
 *  - the full-width leaf: a door, as before;
 *  - a leaf 0.60 of the gap (a leaf beside a fixed light): not this test's — `drawnLeaves` reads it for wide gaps;
 *  - a short leaf with no arc: no door symbol.
 */
import { describe, expect, it } from 'vitest'
import { Canvas } from '@buildapp/synthetic-drawings'
import { doorLeafFound } from '../src/v2/openings-v2.js'
import type { WallHost } from '../src/v2/openings-v2.js'
import type { PlanFrameV2 } from '../src/v2/frame.js'

const MPP = 0.025
const plan = { frameId: 'p', mppX: MPP, mppY: MPP, toPixel: (x: number, z: number) => ({ x: 100 + x / MPP, y: 300 - z / MPP }), toWorld: (px: number, py: number) => ({ x: (px - 100) * MPP, z: (300 - py) * MPP }) } as unknown as PlanFrameV2
const T = 0.4
const host: WallHost = { massId: 'main', facade: 'FRONT', planeAt: 0, from: 0, to: 10, centreAt: T / 2, storeyIndex: 0, floorY: 0, storeyHeightM: 3 }
const gap: [number, number] = [4, 5]
const px = (x: number, z: number) => plan.toPixel(x, z)

function sheet(leafM: number, jamb: number, inward: 1 | -1, withArc = true) {
  const c = new Canvas(500, 500)
  c.fill(0, 0, 499, 499, 236)
  c.fill(px(0, T).x, px(0, T).y, px(gap[0], 0).x, px(gap[0], 0).y, 0)
  c.fill(px(gap[1], T).x, px(gap[1], T).y, px(10, 0).x, px(10, 0).y, 0)
  const towards = jamb === gap[0] ? 1 : -1
  const hingeX = jamb + towards * 0.03
  const a = px(hingeX, T / 2)
  const b = px(hingeX, T / 2 + inward * leafM)
  c.line(a.x, a.y, b.x, b.y, 2, 170)
  if (withArc)
    for (let deg = 0; deg <= 90; deg += 0.5) {
      const r = (deg * Math.PI) / 180
      const p = px(hingeX + towards * leafM * Math.cos(r), T / 2 + inward * leafM * Math.sin(r))
      c.plot(Math.round(p.x), Math.round(p.y), 150)
    }
  return c.toRaster()
}

describe('v3.45 a door leaf drawn short of its gap', () => {
  it('a leaf 0.82 of the gap with its arc is the gap’s door, which way it opens and where it hangs read', () => {
    expect(doorLeafFound(sheet(0.82, gap[1], 1), plan, host, gap, T)).toEqual({ swing: 'IN', hingeAt: 'HIGH' })
    expect(doorLeafFound(sheet(0.82, gap[0], -1), plan, host, gap, T)).toEqual({ swing: 'OUT', hingeAt: 'LOW' })
  })
  it('the full-width leaf reads as before', () => {
    expect(doorLeafFound(sheet(1.0, gap[1], 1), plan, host, gap, T)).toEqual({ swing: 'IN', hingeAt: 'HIGH' })
  })
  it('counter: a leaf 0.60 of the gap stands beside a fixed light, and is not the gap’s own leaf', () => {
    expect(doorLeafFound(sheet(0.6, gap[1], 1), plan, host, gap, T)).toBeUndefined()
  })
  it('counter: a short leaf with no arc is no door symbol', () => {
    expect(doorLeafFound(sheet(0.82, gap[1], 1, false), plan, host, gap, T)).toBeUndefined()
  })
})
