/**
 * 005Y-N7 (C): a covered terrace cut out of a corner of a body, read from the plan — and the corners that are not one.
 *
 * Synthetic plans at 0.025 m/px of a 10 × 8 m body with 0.4 m walls. The rear-west corner is open 2.6 m along the rear
 * face and 4.7 m along the west face. Behind it: two back walls (a recess), nothing (a corner window), or a room the
 * plan labels.
 */
import { describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-cv'
import type { PlanFrameV2 } from '../src/v2/frame.js'
import { readCornerNotch } from '../src/v2/corner-recess.js'
import { cornerPocketSpecs } from '../src/v2/corner-pockets.js'

const MPP = 0.025
const T = 0.4
const frame = { frameId: 'f', assetId: 'a', storeyIndex: 0, mppX: MPP, mppY: MPP, originPx: { x: 100, y: 500 }, why: 'synthetic', wallPx: 8, toWorld: (px: number, py: number) => ({ x: (px - 100) * MPP, z: (500 - py) * MPP }), toPixel: (x: number, z: number) => ({ x: 100 + x / MPP, y: 500 - z / MPP }) } as PlanFrameV2
const body = { x0: 0, z0: 0, x1: 10, z1: 8 }

type Rect = { x0: number; z0: number; x1: number; z1: number }

function draw(solid: Rect[], clear: Rect[] = []): Raster {
  const W = 700
  const H = 600
  const data = new Uint8ClampedArray(W * H * 4).fill(255)
  const paint = (r: Rect, v: number) => {
    const a = frame.toPixel(r.x0, r.z0)
    const b = frame.toPixel(r.x1, r.z1)
    for (let x = Math.round(Math.min(a.x, b.x)); x <= Math.round(Math.max(a.x, b.x)); x += 1)
      for (let y = Math.round(Math.min(a.y, b.y)); y <= Math.round(Math.max(a.y, b.y)); y += 1) {
        const o = (y * W + x) * 4
        data[o] = data[o + 1] = data[o + 2] = v
      }
  }
  for (const r of solid) paint(r, 20)
  for (const r of clear) paint(r, 255)
  return { width: W, height: H, data }
}

/** The ring's four bands. */
const ring: Rect[] = [
  { x0: 0, z0: 0, x1: 10, z1: T },
  { x0: 0, z0: 8 - T, x1: 10, z1: 8 },
  { x0: 0, z0: 0, x1: T, z1: 8 },
  { x0: 10 - T, z0: 0, x1: 10, z1: 8 },
]
/** The open stretches of the rear-west corner, leaving the corner block (a post). */
const openings: Rect[] = [
  { x0: T, z0: 8 - T, x1: 2.6, z1: 8 },
  { x0: 0, z0: 3.3, x1: T, z1: 8 - T },
]
/** The recess's back walls: one along z at x 2.6, one along x at z 3.3 (mostly a wide door). */
const backWalls: Rect[] = [
  { x0: 2.6, z0: 2.9, x1: 3.0, z1: 8 },
  { x0: T, z0: 2.9, x1: 0.7, z1: 3.3 },
]

const noRoom = () => false
const read = (raster: Raster, insideRoom: (r: Rect) => boolean = noRoom) => readCornerNotch(raster, frame, body, T, 'WEST', 'REAR', insideRoom)

describe('a recess cut out of a corner of a body', () => {
  it('the open corner with its back walls: the notch, and the post at the corner', () => {
    const n = read(draw([...ring, ...backWalls], openings))
    expect(n).toBeDefined()
    expect(n?.rect.x0).toBe(0)
    expect(n?.rect.x1).toBeCloseTo(2.6, 1)
    expect(n?.rect.z0).toBeCloseTo(3.3, 1)
    expect(n?.rect.z1).toBe(8)
    expect(n?.post).toBeDefined()
  })

  it('becomes two pockets whose passages open through the corner, their back walls meeting at the inner corner', () => {
    const n = read(draw([...ring, ...backWalls], openings))
    if (!n) throw new Error('expected a notch')
    const [rear, west] = cornerPocketSpecs(n, body, T)
    expect(rear).toMatchObject({ facade: 'REAR', from: 0, openEnd: 'LOW', mouthAt: 8, carriesPost: true })
    expect(west).toMatchObject({ facade: 'WEST', to: 8, openEnd: 'HIGH', mouthAt: 0, carriesPost: false })
    // the back wall along x stops at the face of the back wall along z, which runs on past the inner corner
    expect(Math.max(rear.back.start.x, rear.back.end.x)).toBeCloseTo(west.back.start.x, 6)
    expect(Math.min(west.back.start.z, west.back.end.z)).toBeCloseTo(rear.back.faceAt - T, 1)
  })

  it('negative: the same open corner with nothing behind it is a corner window', () => {
    expect(read(draw(ring, openings))).toBeUndefined()
  })

  it('negative: with a room the plan labels inside, it is glazing round a room', () => {
    expect(read(draw([...ring, ...backWalls], openings), () => true)).toBeUndefined()
  })

  it('negative: a closed corner', () => {
    expect(read(draw(ring))).toBeUndefined()
  })
})
