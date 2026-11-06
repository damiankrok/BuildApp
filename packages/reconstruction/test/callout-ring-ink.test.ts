/**
 * EXTERIOR-COMPLETE E12 (Zefiranty G2 ver. 2, ground plan 4c35b58f63): a garage door's "455/220" callout is printed
 * under the door, its top arc on the door line. Read across the line, the ring's arc and digits with the line made
 * wall-thick ink over 17 px — a "post" that split the 4.57 m door into two blank gaps between a wall and a post; the
 * outline stayed open there and the garage's front 2 m was read as outside. The boundary lines are read with a known
 * ring's outline and interior taken out, never where the ink is wall-thick. Synthetic mask; no drawing of any house.
 */
import { describe, expect, it } from 'vitest'
import { solidLayer, withoutCalloutRingInk } from '../src/index.js'

const W = 200
const H = 120
const at = (m: { data: Uint8Array }, x: number, y: number): number => m.data[y * W + x]

function sheet(): { width: number; height: number; data: Uint8Array } {
  const data = new Uint8Array(W * H)
  const set = (x: number, y: number): void => {
    if (x >= 0 && y >= 0 && x < W && y < H) data[y * W + x] = 1
  }
  for (let y = 40; y < 52; y += 1) for (let x = 0; x < 40; x += 1) set(x, y) // a 12 px wall, left of the door
  for (let y = 40; y < 52; y += 1) for (let x = 160; x < W; x += 1) set(x, y) // and right of it
  for (let x = 40; x < 160; x += 1) set(x, 51) // the door line along the wall's outer face
  // the callout ring under the door, its top touching the line: centre (100, 64), radius 12, a bar and some digits
  for (let k = 0; k < 360; k += 1) set(Math.round(100 + 12 * Math.cos((k * Math.PI) / 180)), Math.round(64 + 12 * Math.sin((k * Math.PI) / 180)))
  for (let x = 90; x <= 110; x += 1) set(x, 64)
  for (let y = 56; y <= 61; y += 1) for (const x of [94, 95, 100, 101, 106]) set(x, y)
  return { width: W, height: H, data }
}

describe('EXTERIOR-COMPLETE E12: a callout ring is not wall', () => {
  it('the ring’s outline and interior leave the line mask; the walls and the door line stay', () => {
    const mask = sheet()
    const solid = solidLayer(mask, 12)
    const out = withoutCalloutRingInk(mask, solid, [{ at: { x: 100, y: 64 }, radiusPx: 12 }])
    expect(at(out, 100, 76)).toBe(0) // the ring's bottom
    expect(at(out, 100, 64)).toBe(0) // its bar
    expect(at(out, 94, 58)).toBe(0) // a digit
    expect(at(out, 20, 45)).toBe(1) // the wall
    expect(at(out, 60, 51)).toBe(1) // the door line away from the ring
    expect(at(out, 130, 51)).toBe(1)
    expect(at(mask, 100, 76)).toBe(1) // the input is not changed
  })

  it('counter-case: a ring printed over a wall leaves the wall whole', () => {
    const mask = sheet()
    const solid = solidLayer(mask, 12)
    const out = withoutCalloutRingInk(mask, solid, [{ at: { x: 30, y: 46 }, radiusPx: 12 }])
    for (let x = 20; x < 40; x += 1) for (let y = 41; y < 51; y += 1) expect(at(out, x, y), `${x},${y}`).toBe(1)
  })
})
