/**
 * BUILDPLAN-ANALYZER-005U-N3: an interior wall as thick as the outer wall — a bearing wall, the fire wall between an
 * integral garage and the house — is a wall that divides rooms, not ink the flood fill runs through; against the outer
 * wall, the same thickness is the outer wall's own ink; and where two such walls cross there is no chimney.
 *
 * Hand-drawn sheets at 2.5 cm/px with a 0.30 m (12 px) outer wall; no drawing of any real building.
 */
import { describe, expect, it } from 'vitest'
import { readInterior } from '../src/index.js'
import type { PlanFrameV2 } from '../src/index.js'
import { BLACK, fillRect, whiteRaster } from '../../source-cv/test/draw.js'
import type { Raster } from '@buildapp/source-cv'

const MPP = 0.025
const T = 0.3
const WALL = 12
/** The house: 12 × 9 m, world x = 0 at sheet column 40, world z = 0 (the front) at sheet row 400. */
const OX = 40
const OY = 400
const BODY = { x0: 0, z0: 0, x1: 12, z1: 9 }
const px = (x: number): number => Math.round(OX + x / MPP)
const py = (z: number): number => Math.round(OY - z / MPP)

const frame: PlanFrameV2 = {
  frameId: 'synthetic-plan',
  assetId: 'synthetic',
  storeyIndex: 0,
  mppX: MPP,
  mppY: MPP,
  originPx: { x: OX, y: OY },
  why: 'a fixture',
  toWorld: (x, y) => ({ x: (x - OX) * MPP, z: (OY - y) * MPP }),
  toPixel: (x, z) => ({ x: OX + x / MPP, y: OY - z / MPP }),
  wallPx: WALL / 2,
}

/** The outer ring, its east wall drawn `eastPx` thick (inward), the rest 12 px. */
function house(eastPx = WALL): Raster {
  const r = whiteRaster(560, 460)
  fillRect(r, px(0), py(9), px(12) - 1, py(9) + WALL - 1, BLACK)
  fillRect(r, px(0), py(0) - WALL + 1, px(12) - 1, py(0), BLACK)
  fillRect(r, px(0), py(9), px(0) + WALL - 1, py(0), BLACK)
  fillRect(r, px(12) - eastPx, py(9), px(12) - 1, py(0), BLACK)
  return r
}

/** A vertical wall `thickPx` thick centred on world x, from z0 to z1. */
const wallZ = (r: Raster, x: number, z0: number, z1: number, thickPx: number): void =>
  fillRect(r, px(x) - Math.floor(thickPx / 2), py(z1), px(x) - Math.floor(thickPx / 2) + thickPx - 1, py(z0), BLACK)
/** A horizontal wall `thickPx` thick centred on world z, from x0 to x1. */
const wallX = (r: Raster, z: number, x0: number, x1: number, thickPx: number): void =>
  fillRect(r, px(x0), py(z) - Math.floor(thickPx / 2), px(x1), py(z) - Math.floor(thickPx / 2) + thickPx - 1, BLACK)

/** An integral garage 4 × 6 m in the front-east corner: its west wall as thick as the outer wall, a thin wall behind it. */
function integralGarage(westPx = WALL): Raster {
  const r = house()
  wallZ(r, 8, 0, 6, westPx)
  wallX(r, 6, 8, 12, 6)
  return r
}

/** The room whose polygon holds the point (an L-shaped room's bounds would hold the garage too). */
const roomAt = (reading: ReturnType<typeof readInterior>, x: number, z: number) =>
  reading.rooms.find((room) => {
    let inside = false
    const poly = room.polygon
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i]
      const b = poly[j]
      if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside
    }
    return inside
  })

describe('interior: wall-thick partitions (005U-N3)', () => {
  it('a garage behind a wall as thick as the outer wall is its own room, not part of the house', () => {
    const reading = readInterior(integralGarage(), frame, BODY, T, 0)
    const wall = reading.walls.find((w) => w.axis === 'Z' && Math.abs(w.at - 8) < 0.1)
    expect(wall).toBeDefined()
    expect(wall?.thicknessM).toBeCloseTo(0.3, 1)
    const garage = roomAt(reading, 10, 3)
    const house = roomAt(reading, 4, 4)
    expect(garage).toBeDefined()
    expect(garage?.id).not.toBe(house?.id)
    expect(garage?.bounds.x0).toBeGreaterThan(7.9)
    expect(garage?.bounds.z1).toBeLessThan(6.1)
  })

  it('the same garage behind a thin partition was always its own room (control)', () => {
    const reading = readInterior(integralGarage(6), frame, BODY, T, 0)
    expect(roomAt(reading, 10, 3)?.id).not.toBe(roomAt(reading, 4, 4)?.id)
  })

  it('a wall thicker than the outer wall is still not a partition', () => {
    const reading = readInterior(integralGarage(20), frame, BODY, T, 0)
    expect(reading.walls.some((w) => w.axis === 'Z' && Math.abs(w.at - 8) < 0.2)).toBe(false)
  })

  it('an outer wall drawn thicker than it was read leaves no second wall beside it', () => {
    // the east wall drawn 23 px (0.575 m) against a read 0.30 m: 11 px of it lie inside the inset interior
    const reading = readInterior(house(23), frame, BODY, T, 0)
    expect(reading.walls.filter((w) => w.axis === 'Z' && w.at > 11)).toEqual([])
    expect(reading.rooms).toHaveLength(1)
  })

  it('where two wall-thick partitions cross there is no solid block, so no chimney', () => {
    const r = house()
    wallZ(r, 6, 0.3, 8.7, WALL)
    wallX(r, 4.5, 0.3, 11.7, WALL)
    const reading = readInterior(r, frame, BODY, T, 0)
    expect(reading.blocks).toEqual([])
    expect(reading.rooms.length).toBeGreaterThanOrEqual(4)
  })

  it('a solid chimney block is still a block', () => {
    const r = house()
    fillRect(r, px(5), py(5), px(5.9), py(4.1), BLACK)
    const reading = readInterior(r, frame, BODY, T, 0)
    expect(reading.blocks).toHaveLength(1)
  })
})
