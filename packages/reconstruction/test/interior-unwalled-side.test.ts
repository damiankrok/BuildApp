/**
 * BUILDPLAN-ANALYZER-005V-N2: a body registered beyond its drawing. Where a side of the body stands on no drawn wall,
 * the drawn outer wall lies inside the interior, as thick as the partitions 005U-N3 admits; there the registration is
 * uncertain and only partitions thinner than the outer wall are read. A body standing on its drawn walls is untouched,
 * and a real wall-thick partition in it (a garage's fire wall) is still read.
 *
 * Hand-drawn sheets at 2.5 cm/px with a 0.30 m (12 px) outer wall; no drawing of any real building.
 */
import { describe, expect, it } from 'vitest'
import { UNWALLED_SIDE_COVER, readInterior } from '../src/index.js'
import type { PlanFrameV2 } from '../src/index.js'
import { BLACK, fillRect, whiteRaster } from '../../source-cv/test/draw.js'
import type { Raster } from '@buildapp/source-cv'

const MPP = 0.025
const T = 0.3
const WALL = 12
const OX = 200
const OY = 400
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

/** The drawn house: outer faces x 0..12 m, z 0..9 m, 12 px walls; an integral garage's 12 px fire wall at x 8 (z 0..6) and a thin wall behind it. */
function sheet(garage: boolean, thinAt4 = false): Raster {
  const r = whiteRaster(1000, 460)
  fillRect(r, px(0), py(9), px(12) - 1, py(9) + WALL - 1, BLACK)
  fillRect(r, px(0), py(0) - WALL + 1, px(12) - 1, py(0), BLACK)
  fillRect(r, px(0), py(9), px(0) + WALL - 1, py(0), BLACK)
  fillRect(r, px(12) - WALL, py(9), px(12) - 1, py(0), BLACK)
  if (garage) {
    fillRect(r, px(8) - WALL / 2, py(6), px(8) + WALL / 2 - 1, py(0), BLACK)
    fillRect(r, px(8), py(6) - 3, px(12), py(6) + 2, BLACK)
  }
  // a 6 px partition across the whole depth at x 4, meeting the drawn front and rear walls
  if (thinAt4) fillRect(r, px(4) - 3, py(9), px(4) + 2, py(0), BLACK)
  return r
}
const ON_ITS_WALLS = { x0: 0, z0: 0, x1: 12, z1: 9 }
/** The same drawing under a body registered 6 m past the drawn east wall (the 005Q fixtures' mis-scale, in one direction). */
const PAST_EAST = { x0: 0, z0: 0, x1: 18, z1: 9 }
/** ... and 6 m past the drawn west wall. */
const PAST_WEST = { x0: -6, z0: 0, x1: 12, z1: 9 }

const wallAt = (reading: ReturnType<typeof readInterior>, x: number) => reading.walls.filter((w) => w.axis === 'Z' && Math.abs(w.at - x) < 0.25)
const uncertain = (reading: ReturnType<typeof readInterior>) => reading.unresolved.filter((u) => u.what.startsWith('wall-thick partitions'))

describe('005V-N2 interior: a body registered beyond its drawn walls', () => {
  it('positive: a body standing on its drawn walls reads the garage fire wall as thick as the outer wall, and says nothing of its registration', () => {
    const reading = readInterior(sheet(true), frame, ON_ITS_WALLS, T, 0)
    expect(wallAt(reading, 8)).toHaveLength(1)
    expect(wallAt(reading, 8)[0].thicknessM).toBeCloseTo(0.3, 1)
    expect(uncertain(reading)).toEqual([])
  })

  it('negative: past the drawn east wall, that wall (inside the interior now) is no partition, and the east side is named', () => {
    const reading = readInterior(sheet(false), frame, PAST_EAST, T, 0)
    expect(wallAt(reading, 11.85)).toEqual([])
    expect(uncertain(reading)).toHaveLength(1)
    expect(uncertain(reading)[0].reason).toMatch(/along its east side/)
  })

  it('mirrored: past the drawn west wall, the same, on the west side', () => {
    const reading = readInterior(sheet(false), frame, PAST_WEST, T, 0)
    expect(wallAt(reading, 0.15)).toEqual([])
    expect(uncertain(reading)[0].reason).toMatch(/along its west side/)
  })

  it('under an uncertain registration a thick wall is not read at all, while a partition thinner than the outer wall still is', () => {
    const reading = readInterior(sheet(true, true), frame, PAST_EAST, T, 0)
    expect(wallAt(reading, 8)).toEqual([])
    expect(wallAt(reading, 4)).toHaveLength(1)
    expect(wallAt(reading, 4)[0].thicknessM).toBeCloseTo(0.15, 1)
  })

  it('the bound is one position in twenty along a side', () => {
    expect(UNWALLED_SIDE_COVER).toBe(0.05)
  })
})
