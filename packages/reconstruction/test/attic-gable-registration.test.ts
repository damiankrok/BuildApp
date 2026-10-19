/**
 * BUILDPLAN-ANALYZER-005W-N1: the attic and its gables, registered across views.
 *
 * - a storey plan drawn at the base plan's sheet scale takes the base frame, moved onto its own faces;
 * - a chimney block a thin partition runs into keeps its compact core;
 * - the unlabelled side views are put on their walls by the plan's gaps, both views agreeing;
 * - a side view's ridge row comes from its gable outline, not from its silhouette's top (a chimney);
 * - a weakly read printed height does not stand over an elevation that contradicts it.
 *
 * Every raster here is drawn from invented dimensions; no drawing or render of any real building is used.
 */
import { describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-cv'
import { coreOfRegion, planFrameBySameSheet, weakPrintedHeight } from '../src/index.js'
import type { ElevationFrameV2, PlanFrameV2 } from '../src/index.js'
import type { PlanReading } from '../src/layout.js'
import { decideSidesByOpenings, gableApexRow, gableOutline } from '../src/v2/side-orientation.js'
import type { SideGap } from '../src/v2/side-orientation.js'

/** A white sheet with a black rectangular wall ring (outer faces x0..x1 × y0..y1, `t` px thick). */
function sheet(w: number, h: number, ring: { x0: number; y0: number; x1: number; y1: number }, t: number): Raster {
  const data = new Uint8ClampedArray(w * h * 4).fill(255)
  for (let y = ring.y0; y < ring.y1; y += 1)
    for (let x = ring.x0; x < ring.x1; x += 1) {
      const inWall = x < ring.x0 + t || x >= ring.x1 - t || y < ring.y0 + t || y >= ring.y1 - t
      if (!inWall) continue
      const o = (y * w + x) * 4
      data[o] = data[o + 1] = data[o + 2] = 20
    }
  return { width: w, height: h, data }
}

const reading = (id: string, extent: { x0: number; y0: number; x1: number; y1: number }): PlanReading => ({ frame: { id, assetId: `asset-${id}` }, wallPx: 10, extent }) as unknown as PlanReading

/** A base frame: 50 px/m on x, 48 px/m on z (anisotropic, as a chain registration may leave it), front face at row 450. */
function baseFrame(): PlanFrameV2 {
  const ox = 100
  const oy = 450
  return {
    frameId: 'base',
    assetId: 'asset-base',
    storeyIndex: 0,
    mppX: 0.02,
    mppY: 1 / 48,
    originPx: { x: ox, y: oy },
    toWorld: (px, py) => ({ x: (px - ox) * 0.02, z: (oy - py) / 48 }),
    toPixel: (x, z) => ({ x: ox + x / 0.02, y: oy - z * 48 }),
    why: 'a synthetic base frame',
    wallPx: 10,
  }
}

describe('005W-N1 same-sheet storey plan', () => {
  const baseRing = { x0: 100, y0: 50, x1: 600, y1: 450 }
  const base = { plan: reading('base', baseRing), frame: baseFrame(), raster: sheet(700, 520, baseRing, 10) }

  it('moves the base frame onto a storey drawn with the same outline elsewhere on its sheet', () => {
    const ring = { x0: 60, y0: 20, x1: 560, y1: 420 }
    const frame = planFrameBySameSheet(reading('attic', ring), 1, sheet(700, 520, ring, 10), base)
    expect(frame).toBeDefined()
    // the base plan's corners land on the storey's corners, the base's anisotropy kept
    expect(frame?.toPixel(0, 0)).toEqual({ x: 60, y: 420 })
    expect(frame?.toPixel(10, 400 / 48)).toEqual({ x: 560, y: 20 })
    expect(frame?.mppX).toBeCloseTo(0.02, 6)
    expect(frame?.mppY).toBeCloseTo(1 / 48, 6)
    const w = frame?.toWorld(310, 220)
    expect(w?.x).toBeCloseTo(5, 6)
    expect(w?.z).toBeCloseTo(200 / 48, 6)
  })

  it('refuses a storey whose outline differs from the base plan by more than 1 % on an axis', () => {
    const smaller = { x0: 60, y0: 20, x1: 540, y1: 420 } // 480 px against 500: an attic over part of the house
    expect(planFrameBySameSheet(reading('attic', smaller), 1, sheet(700, 520, smaller, 10), base)).toBeUndefined()
  })
})

describe('005W-N1 compact core of a block region', () => {
  it('drops a thin partition arm and keeps the block', () => {
    const W = 60
    const region: number[] = []
    for (let y = 30; y < 50; y += 1) for (let x = 10; x < 30; x += 1) region.push(y * W + x) // a 20 × 20 block
    for (let y = 0; y < 30; y += 1) for (let x = 24; x < 30; x += 1) region.push(y * W + x) // a 6 px partition into it
    const core = coreOfRegion(region, W, 15)
    expect(core).toHaveLength(1)
    expect(core[0]).toMatchObject({ minX: 10, maxX: 29, minY: 30, maxY: 49, n: 400 })
  })

  it('leaves only the crossing of two thin partitions, smaller than any block', () => {
    const W = 60
    const region: number[] = []
    for (let y = 0; y < 60; y += 1) for (let x = 27; x < 33; x += 1) region.push(y * W + x)
    for (let y = 27; y < 33; y += 1) for (let x = 0; x < 60; x += 1) if (x < 27 || x >= 33) region.push(y * W + x)
    const core = coreOfRegion(region, W, 15)
    expect(core).toHaveLength(1)
    expect(core[0]).toMatchObject({ minX: 27, maxX: 32, minY: 27, maxY: 32 })
  })
})

describe('005W-N1 side views placed by the openings', () => {
  const fakeView = (frameId: string, side: 'LEFT' | 'RIGHT'): ElevationFrameV2 => ({ registration: { frameId } as ElevationFrameV2['registration'], side, planeAt: 0, alongOf: (p) => p, pxOf: (a) => a, yOf: (p) => p, pyOf: (y) => y })
  const raster: Raster = { width: 1, height: 1, data: new Uint8ClampedArray(4) }
  const g = (a: number, b: number): SideGap => ({ interval: [a, b], floorY: 0, storeyHeightM: 2.8, solids: [], topY: 2.8 })
  const gaps = { LEFT: [g(1, 2), g(4, 5), g(6, 7)], RIGHT: [g(3, 4), g(5, 6)] }
  /** Each drawing truly shows one wall: view A the right wall, view B the left wall. */
  const truth: Record<string, 'LEFT' | 'RIGHT'> = { A: 'RIGHT', B: 'LEFT' }
  const read = (_: Raster, v: ElevationFrameV2, gap: SideGap): boolean => (truth[v.registration.frameId] === v.side ? true : gap.interval[0] === 4)

  it('swaps two views assigned the wrong way round when both prefer the other wall', () => {
    const d = decideSidesByOpenings([{ current: fakeView('A', 'LEFT'), swapped: fakeView('A', 'RIGHT'), raster }, { current: fakeView('B', 'RIGHT'), swapped: fakeView('B', 'LEFT'), raster }], (s) => gaps[s], read)
    expect(d.swap).toBe(true)
  })

  it('keeps the assignment when the views are already right', () => {
    const d = decideSidesByOpenings([{ current: fakeView('A', 'RIGHT'), swapped: fakeView('A', 'LEFT'), raster }, { current: fakeView('B', 'LEFT'), swapped: fakeView('B', 'RIGHT'), raster }], (s) => gaps[s], read)
    expect(d.swap).toBe(false)
  })

  it('keeps the assignment when one view disagrees', () => {
    // view B reads its assigned wall fully and the other not at all
    const halfRead = (_: Raster, v: ElevationFrameV2, gap: SideGap): boolean => (v.registration.frameId === 'B' ? v.side === 'RIGHT' : read(_, v, gap))
    const d = decideSidesByOpenings([{ current: fakeView('A', 'LEFT'), swapped: fakeView('A', 'RIGHT'), raster }, { current: fakeView('B', 'RIGHT'), swapped: fakeView('B', 'LEFT'), raster }], (s) => gaps[s], halfRead)
    expect(d.swap).toBe(false)
  })

  it('does not decide with fewer than two gaps on a side wall', () => {
    const d = decideSidesByOpenings([{ current: fakeView('A', 'LEFT'), swapped: fakeView('A', 'RIGHT'), raster }], (s) => (s === 'RIGHT' ? [g(3, 4)] : gaps.LEFT), () => true)
    expect(d.swap).toBe(false)
  })
})

describe('005W-N1 gable apex from the outline', () => {
  /** Sky everywhere but a 40° gable with its apex at row 100, column 300, and a chimney standing 30 rows over it. */
  function gableMask(apexRow: number, eaveRow: number): { width: number; height: number; data: Uint8Array } {
    const width = 600
    const height = 400
    const data = new Uint8Array(width * height).fill(1)
    const tan = Math.tan((40 * Math.PI) / 180)
    for (let y = apexRow; y < height; y += 1) {
      const half = y <= eaveRow ? (y - apexRow) / tan : (eaveRow - apexRow) / tan
      for (let x = Math.ceil(300 - half); x < 300 + half; x += 1) data[y * width + x] = 0
    }
    for (let y = apexRow - 30; y < apexRow + 40; y += 1) for (let x = 320; x < 345; x += 1) data[y * width + x] = 0
    return { width, height, data }
  }

  it('puts the apex at the outline, not at the chimney top', () => {
    const mask = gableMask(100, 300)
    // the silhouette's top is the chimney at row 70; the bands are read under it
    const outline = gableOutline(mask, 70, 300)
    const apex = gableApexRow(outline, 40)
    expect(apex).toBeDefined()
    expect(Math.abs((apex?.row ?? 0) - 100)).toBeLessThanOrEqual(2)
  })

  it('refuses an outline whose slope is not the stated pitch', () => {
    const outline = gableOutline(gableMask(100, 300), 70, 300)
    expect(gableApexRow(outline, 25)).toBeUndefined()
  })
})

describe('005W-N1 weak printed height', () => {
  it('lets the elevation stand over a weak reading it contradicts with no fitting candidate', () => {
    expect(weakPrintedHeight(0.24, 0.7, 2.32, [{ cm: 70 }, { cm: 170 }])).toBe(true)
  })
  it('keeps a printed height read with confidence', () => {
    expect(weakPrintedHeight(0.45, 0.7, 2.32, [{ cm: 70 }])).toBe(false)
  })
  it('keeps a printed height within half a metre of the elevation', () => {
    expect(weakPrintedHeight(0.2, 2.2, 2.32, [{ cm: 220 }])).toBe(false)
  })
  it('keeps a printed height where another of its readings fits the elevation', () => {
    expect(weakPrintedHeight(0.2, 0.7, 2.32, [{ cm: 70 }, { cm: 230 }])).toBe(false)
  })
})
