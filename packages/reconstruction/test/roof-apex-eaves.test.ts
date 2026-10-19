/**
 * BUILDPLAN-ANALYZER-005V: wall first, then the roof, then the openings under it.
 *
 * (1) The roof-apex vote reads the topmost INK of a column; on a render, a blue sky is darker than paper, and read as
 *     ink it put every column's top at the frame's edge — no render with a sky could vote, and a layout guess decided
 *     which way the ridge runs. Ink is neutral now.
 * (2) An opening whose heights nothing read is a convention; under the eaves it is lowered while a real window remains,
 *     and refused by name when only a knee wall is left — never emitted for the geometry to drop silently.
 * Synthetic rasters only; no drawing of any real building.
 */
import { describe, expect, it } from 'vitest'
import type { MetricEvidence } from '@buildapp/source-metrics'
import { lumaAt, readWallOpenings, topNeutralInkRow } from '../src/index.js'
import type { OpeningReadingInput, PlanFrameV2, WallHost } from '../src/index.js'

// --- (1) the apex column scan on a render with a sky ---------------------------------------------------------------
function render(): OpeningReadingInput['planRaster'] {
  const W = 200
  const H = 200
  const data = new Uint8ClampedArray(W * H * 4)
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const o = (y * W + x) * 4
      // sky: a mid blue, darker than paper (luma ≈ 159) and saturated
      let c: [number, number, number] = [110, 170, 230]
      // a grey gable: apex at (100, 50), eaves at row 150 on columns 20 and 180
      const roofTop = 50 + Math.abs(x - 100)
      if (x >= 20 && x <= 180 && y >= roofTop) c = [90, 90, 92]
      data[o] = c[0]
      data[o + 1] = c[1]
      data[o + 2] = c[2]
      data[o + 3] = 255
    }
  }
  return { width: W, height: H, data }
}

describe('005V roof apex: a render sky is not ink', () => {
  it('the topmost neutral ink in a column is the roof, so the gable apex stands above its eaves', () => {
    const r = render()
    expect(lumaAt(r, 100, 10)).toBeLessThan(200) // the sky would pass a luma-only test
    expect(topNeutralInkRow(r, 100, 0, 199)).toBe(50)
    expect(topNeutralInkRow(r, 30, 0, 199)).toBe(120)
    expect(topNeutralInkRow(r, 170, 0, 199)).toBe(120)
  })

  it('a column with only sky has no ink at all', () => {
    expect(topNeutralInkRow(render(), 5, 0, 199)).toBeUndefined()
  })
})

// --- (2) assumed openings under the eaves --------------------------------------------------------------------------
const MPP = 0.02
const O = 20
const OY = 400
const W = 560
const H = 460
const px = (x: number, z: number) => ({ x: O + x / MPP, y: OY + z / MPP })
function wallWithGap(gap: [number, number]): { raster: OpeningReadingInput['planRaster']; plan: PlanFrameV2 } {
  const data = new Uint8ClampedArray(W * H * 4).fill(255)
  const a = px(0, 0)
  const b = px(10, 0.4)
  const g0 = px(gap[0], 0).x
  const g1 = px(gap[1], 0).x
  for (let y = a.y; y <= b.y; y += 1) {
    for (let x = a.x; x <= b.x; x += 1) {
      if (x >= g0 && x <= g1) continue
      const o = (Math.round(y) * W + Math.round(x)) * 4
      data[o] = data[o + 1] = data[o + 2] = 0
    }
  }
  const plan: PlanFrameV2 = { frameId: 'frame-plan', assetId: 'asset-plan', storeyIndex: 1, mppX: MPP, mppY: MPP, originPx: { x: O, y: OY }, why: 'synthetic', toWorld: (x, y) => ({ x: (x - O) * MPP, z: (y - OY) * MPP }), toPixel: (x, z) => px(x, z), wallPx: 0.2 / MPP }
  return { raster: { width: W, height: H, data }, plan }
}
const FLOOR = 2.8
const host = (eaveTopAboveFloor?: number): WallHost => ({ massId: 'main', facade: 'FRONT', planeAt: 0, from: 0, to: 10, centreAt: 0.2, storeyIndex: 1, floorY: FLOOR, storeyHeightM: 5.36, ...(eaveTopAboveFloor !== undefined ? { eaveTopY: FLOOR + eaveTopAboveFloor } : {}) })
const callout = (text: string, gap: [number, number]): MetricEvidence => {
  const c = px((gap[0] + gap[1]) / 2, 1.0)
  return { id: `callout-${text}`, kind: 'OPENING_CALLOUT', rawText: text, alternatives: [], confidence: 0.8, textBox: { x0: c.x - 10, y0: c.y - 5, x1: c.x + 10, y1: c.y + 5 } } as unknown as MetricEvidence
}
function read(eaveTop: number | undefined, callouts: MetricEvidence[] = []) {
  const { raster, plan } = wallWithGap([3, 4.2])
  const refused: Array<{ interval: [number, number]; why: string }> = []
  const found = readWallOpenings({ plan, planRaster: raster, host: host(eaveTop), wallThicknessM: 0.4, callouts, views: [], attachedSingleStorey: false, onRefused: (r) => refused.push(r), index: 0 })
  return { found, refused }
}

describe('005V assumed openings under the eaves', () => {
  it('a gap in a knee wall too low for the assumed window is refused by name, not emitted', () => {
    const { found, refused } = read(1.63)
    expect(found).toEqual([])
    expect(refused).toHaveLength(1)
    expect(refused[0].why).toMatch(/knee wall/)
  })

  it('a head a few centimetres above the eaves is lowered under them and the window kept, its heights still assumed', () => {
    const { found, refused } = read(2.171)
    expect(refused).toEqual([])
    expect(found).toHaveLength(1)
    expect(found[0].headY).toBeCloseTo(FLOOR + 2.171 - 0.05, 6)
    expect(found[0].sillY).toBeCloseTo(FLOOR + 0.9, 6)
    expect(found[0].provenance.head).toBe('ASSUMED_FOR_RENDERING')
    expect(found[0].unresolved.some((u) => u.startsWith('head lowered'))).toBe(true)
  })

  it('a wall with no roof over it is not touched: the conventional window stands', () => {
    const { found } = read(undefined)
    expect(found).toHaveLength(1)
    expect(found[0].headY).toBeCloseTo(FLOOR + 2.2, 6)
  })

  it('heights a callout reads are never moved or refused by the eaves rule', () => {
    const { found, refused } = read(1.63, [callout('120/220', [3, 4.2])])
    expect(refused).toEqual([])
    expect(found).toHaveLength(1)
    expect(found[0].headY - found[0].sillY).toBeCloseTo(2.2, 6)
  })
})

// --- (3) wall first: a registered face a few pixels off the drawn wall -------------------------------------------
/** The wall drawn from world z = zInk0 to zInk1, while the host registers its centre at 0.2. */
function offsetWall(zInk0: number, zInk1: number, gap: [number, number]): { raster: OpeningReadingInput['planRaster']; plan: PlanFrameV2 } {
  const { plan } = wallWithGap(gap)
  const data = new Uint8ClampedArray(W * H * 4).fill(255)
  const g0 = px(gap[0], 0).x
  const g1 = px(gap[1], 0).x
  for (let y = px(0, zInk0).y; y <= px(0, zInk1).y; y += 1) {
    for (let x = px(0, 0).x; x <= px(10, 0).x; x += 1) {
      if (x >= g0 && x <= g1) continue
      const o = (Math.round(y) * W + Math.round(x)) * 4
      data[o] = data[o + 1] = data[o + 2] = 0
    }
  }
  return { raster: { width: W, height: H, data }, plan }
}
function readOffset(zInk0: number, zInk1: number) {
  const { raster, plan } = offsetWall(zInk0, zInk1, [3, 4.2])
  return readWallOpenings({ plan, planRaster: raster, host: { ...host(), storeyIndex: 0, floorY: 0, storeyHeightM: 2.8 }, wallThicknessM: 0.15, callouts: [], views: [], attachedSingleStorey: false, index: 0 })
}

describe('005V wall first: the opening is read on the wall that is drawn', () => {
  it('a face registered just outside the drawn band still finds the wall, and the gap in it', () => {
    // Drawn 0.42 m thick from z = 0.32 inward, while the face reads 0.15 m centred on 0.2: the registered line misses the ink.
    const found = readOffset(0.32, 0.74)
    expect(found).toHaveLength(1)
    expect(found[0].interval[0]).toBeCloseTo(3, 1)
    expect(found[0].interval[1]).toBeCloseTo(4.2, 1)
  })

  it('a wall the registered line crosses is read where it was registered (no search)', () => {
    expect(readOffset(0, 0.4)).toHaveLength(1)
  })

  it('mirrored left to right, the search finds the same wall and the mirrored gap (no side is preferred)', () => {
    const { raster, plan } = offsetWall(0.32, 0.74, [3, 4.2])
    const data = new Uint8ClampedArray(raster.data.length)
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) for (let k = 0; k < 4; k += 1) data[(y * W + x) * 4 + k] = raster.data[(y * W + (W - 1 - x)) * 4 + k]
    // world x' = 10 − x, pixel column X' = W − 1 − X: the same house drawn the other way round
    const mirrored: PlanFrameV2 = { ...plan, toPixel: (x, z) => ({ x: W - 1 - px(10 - x, z).x, y: px(10 - x, z).y }), toWorld: (x, y) => ({ x: 10 - plan.toWorld(W - 1 - x, y).x, z: plan.toWorld(W - 1 - x, y).z }) }
    const found = readWallOpenings({ plan: mirrored, planRaster: { width: W, height: H, data }, host: { ...host(), storeyIndex: 0, floorY: 0, storeyHeightM: 2.8 }, wallThicknessM: 0.15, callouts: [], views: [], attachedSingleStorey: false, index: 0 })
    expect(found).toHaveLength(1)
    expect(found[0].interval[0]).toBeCloseTo(10 - 4.2, 1)
    expect(found[0].interval[1]).toBeCloseTo(10 - 3, 1)
  })

  it('no wall within the narrow band: nothing is read, the face is not moved onto distant ink', () => {
    expect(readOffset(1.6, 2.0)).toEqual([])
  })
})
