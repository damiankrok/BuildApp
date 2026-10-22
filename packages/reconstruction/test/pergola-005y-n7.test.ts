/**
 * 005Y-N7 (C): a pergola from the posts the ground plan draws — and the squares that are not one.
 */
import { describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-cv'
import type { PlanFrameV2 } from '../src/v2/frame.js'
import { findPosts, pergolaBeams, pergolaFromPosts } from '../src/v2/pergola.js'

const MPP = 0.025
const frame = { frameId: 'f', assetId: 'a', storeyIndex: 0, mppX: MPP, mppY: MPP, originPx: { x: 300, y: 500 }, why: 'synthetic', wallPx: 8, toWorld: (px: number, py: number) => ({ x: (px - 300) * MPP, z: (500 - py) * MPP }), toPixel: (x: number, z: number) => ({ x: 300 + x / MPP, y: 500 - z / MPP }) } as PlanFrameV2
const body = { x0: 0, z0: 0, x1: 10, z1: 8 }

/** A sheet with the body drawn solid and squares of `size` m at the given centres. */
function sheet(squares: Array<[number, number]>, size = 0.2): Raster {
  const W = 800
  const H = 600
  const data = new Uint8ClampedArray(W * H * 4).fill(255)
  const fill = (x0: number, z0: number, x1: number, z1: number) => {
    const a = frame.toPixel(x0, z0)
    const b = frame.toPixel(x1, z1)
    for (let x = Math.round(Math.min(a.x, b.x)); x < Math.round(Math.max(a.x, b.x)); x += 1)
      for (let y = Math.round(Math.min(a.y, b.y)); y < Math.round(Math.max(a.y, b.y)); y += 1) {
        const o = (y * W + x) * 4
        data[o] = data[o + 1] = data[o + 2] = 10
      }
  }
  fill(body.x0, body.z0, body.x1, body.z1)
  for (const [x, z] of squares) fill(x - size / 2, z - size / 2, x + size / 2, z + size / 2)
  return { width: W, height: H, data }
}

describe('a pergola from the posts on the ground plan', () => {
  it('four posts on a frame against the west face', () => {
    const posts = findPosts(sheet([[-3.3, 7.3], [-0.2, 7.3], [-3.3, 2.0], [-0.2, 2.0]]), frame, body)
    expect(posts).toHaveLength(4)
    const p = pergolaFromPosts(posts, body)
    expect(p?.side).toBe('WEST')
    expect(p?.rect.x0).toBeCloseTo(-3.3, 1)
    expect(p?.rect.z1).toBeCloseTo(7.3, 1)
    if (!p) throw new Error('expected a pergola')
    expect(pergolaBeams(p.rect, 2.5)).toHaveLength(4)
  })

  it('three posts are enough when the fourth corner is open', () => {
    expect(pergolaFromPosts(findPosts(sheet([[-3.3, 7.3], [-0.2, 7.3], [-3.3, 2.0]]), frame, body), body)?.side).toBe('WEST')
  })

  it('negative: posts in one line (a fence, a gate) make no frame', () => {
    expect(pergolaFromPosts(findPosts(sheet([[-3.3, 7.3], [-3.3, 5.0], [-3.3, 2.0]]), frame, body), body)).toBeUndefined()
  })

  it('negative: a frame standing away from every face is not the house’s', () => {
    expect(pergolaFromPosts(findPosts(sheet([[-5.5, 7.3], [-2.5, 7.3], [-5.5, 2.0], [-2.5, 2.0]]), frame, body), body)).toBeUndefined()
  })

  it('negative: squares too large to be posts (a wall stub, a chimney block) are not posts', () => {
    expect(findPosts(sheet([[-3.3, 7.3], [-0.2, 7.3], [-3.3, 2.0]], 0.6), frame, body)).toEqual([])
  })
})
