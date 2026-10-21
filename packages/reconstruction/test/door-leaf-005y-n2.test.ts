/**
 * BUILDPLAN-ANALYZER-005Y-N2: a door's plan symbol read strictly (`doorLeafDrawn`). The gap is a metre wide in a front
 * wall 0.4 m thick, at 0.025 m/px. A door draws its leaf open from one jamb — a straight light line as long as the gap
 * is wide, then paper — and the arc it sweeps to the other jamb, on either face of the wall. Hatching, a cupboard's edge
 * running on past a leaf's length, a planter of shrubs, or an arc with no leaf make ink in front of the gap but not this
 * figure.
 */
import { describe, expect, it } from 'vitest'
import { Canvas } from '@buildapp/synthetic-drawings'
import { doorLeafDrawn } from '../src/v2/openings-v2.js'
import type { WallHost } from '../src/v2/openings-v2.js'
import type { PlanFrameV2 } from '../src/v2/frame.js'

const MPP = 0.025
// world x → column 100 + x / mpp; world z (into the building from the front face at z = 0) → row 300 − z / mpp
const plan = { frameId: 'p', mppX: MPP, mppY: MPP, toPixel: (x: number, z: number) => ({ x: 100 + x / MPP, y: 300 - z / MPP }), toWorld: (px: number, py: number) => ({ x: (px - 100) * MPP, z: (300 - py) * MPP }) } as unknown as PlanFrameV2
const T = 0.4
const host: WallHost = { massId: 'main', facade: 'FRONT', planeAt: 0, from: 0, to: 10, centreAt: T / 2, storeyIndex: 0, floorY: 0, storeyHeightM: 3 }
const gap: [number, number] = [4, 5]
const px = (x: number, z: number) => plan.toPixel(x, z)

function wall(c: Canvas): void {
  // the front wall, with the gap in it
  c.fill(px(0, T).x, px(0, T).y, px(gap[0], 0).x, px(gap[0], 0).y, 0)
  c.fill(px(gap[1], T).x, px(gap[1], T).y, px(10, 0).x, px(10, 0).y, 0)
}
function leaf(c: Canvas, inward: 1 | -1, length = 1): void {
  // hinged at the high jamb, mid-wall; a light grey line
  const z0 = T / 2
  const a = px(gap[1] - 0.03, z0)
  const b = px(gap[1] - 0.03, z0 + inward * length)
  c.line(a.x, a.y, b.x, b.y, 2, 170)
}
function arc(c: Canvas, inward: 1 | -1): void {
  for (let deg = 0; deg <= 90; deg += 0.5) {
    const r = (deg * Math.PI) / 180
    const p = px(gap[1] - 0.03 - Math.cos(r) * 1, T / 2 + inward * Math.sin(r) * 1)
    c.plot(Math.round(p.x), Math.round(p.y), 150)
  }
}
const read = (draw: (c: Canvas) => void): boolean => {
  const c = new Canvas(500, 500)
  c.fill(0, 0, 499, 499, 236) // a tinted floor
  wall(c)
  draw(c)
  return doorLeafDrawn(c.toRaster(), plan, host, gap, T)
}

describe('a door’s symbol beside a gap', () => {
  it('is a leaf as long as the gap is wide and the arc it sweeps — drawn in a light line over a tinted floor', () => {
    expect(read((c) => { leaf(c, 1); arc(c, 1) })).toBe(true)
  })
  it('is read on the face it is drawn on: a door opening out', () => {
    expect(read((c) => { leaf(c, -1); arc(c, -1) })).toBe(true)
  })
  it('is not an arc with no leaf, nor a leaf with no arc', () => {
    expect(read((c) => arc(c, 1))).toBe(false)
    expect(read((c) => leaf(c, 1))).toBe(false)
  })
  it('is not a cupboard’s edge running on past a leaf’s length, with an arc beside it', () => {
    expect(read((c) => { leaf(c, 1, 2.5); arc(c, 1) })).toBe(false)
  })
  it('is not a planter of shrubs outside the gap — a blot of ink round the jamb and along the arc', () => {
    expect(read((c) => { for (let x = 3.7; x <= 5.4; x += 0.25) for (let z = -0.1; z >= -1.3; z -= 0.25) { const p = px(x, z); for (let a = 0; a < 360; a += 4) for (let r = 0; r <= 5; r += 1) c.plot(Math.round(p.x + r * Math.cos((a * Math.PI) / 180)), Math.round(p.y + r * Math.sin((a * Math.PI) / 180)), 120) } })).toBe(false)
  })
  it('is not hatching', () => {
    expect(read((c) => { for (let k = -40; k < 80; k += 6) { const a = px(3.5 + k * MPP, T); const b = px(3.5 + k * MPP + 1.5, T + 1.5); c.line(a.x, a.y, b.x, b.y, 1, 120) } })).toBe(false)
  })
})
