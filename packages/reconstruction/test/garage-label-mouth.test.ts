/**
 * BUILDPLAN-ANALYZER-005U-N4: a garage's number from a reading the orientation vote set aside, and its one open side
 * as a vehicle door in any body.
 *
 * The page-wide orientation vote can discard a clean upright room number because the same ink, read another way up,
 * garbles into more glyphs with more summed merit. A set-aside reading may number a room only as the one reading of its
 * ink naming a published room, printed nowhere else on the storey, and not far off the published area. A room so
 * named a garage gives its one open side of the plan a vehicle door — in the main body too — with the kind derived and
 * the heights assumed. Synthetic sheets only; no drawing of any real building.
 */
import { describe, expect, it } from 'vitest'
import { garageMouth, readInterior, readWallOpenings } from '../src/index.js'
import type { LabelToken, OpeningReadingInput, PlanFrameV2, WallHost } from '../src/index.js'
import { BLACK, fillRect, whiteRaster } from '../../source-cv/test/draw.js'

// --- the label: a 12 × 9 m house at 2.5 cm/px, a garage 4 × 6 m in its front-east corner -----------------------
const MPP = 0.025
const OX = 40
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
  wallPx: 6,
}
const BODY = { x0: 0, z0: 0, x1: 12, z1: 9 }

function house() {
  const r = whiteRaster(560, 460)
  fillRect(r, px(0), py(9), px(12) - 1, py(9) + 11, BLACK)
  fillRect(r, px(0), py(0) - 11, px(12) - 1, py(0), BLACK)
  fillRect(r, px(0), py(9), px(0) + 11, py(0), BLACK)
  fillRect(r, px(12) - 12, py(9), px(12) - 1, py(0), BLACK)
  fillRect(r, px(8) - 6, py(6), px(8) + 5, py(0), BLACK)
  fillRect(r, px(8), py(6) - 3, px(12), py(6) + 2, BLACK)
  return r
}

/** A token centred on world (x, z), `h` px tall. */
const token = (text: string, x: number, z: number, opts: { setAside?: boolean; orientation?: string; h?: number } = {}): LabelToken => {
  const h = opts.h ?? 17
  return { text, box: { x0: px(x) - 5, y0: py(z) - h / 2, x1: px(x) + 5, y1: py(z) + h / 2 }, heightPx: h, confidence: 0.55, orientation: opts.orientation ?? 'HORIZONTAL', ...(opts.setAside ? { setAside: true } : {}) }
}
/** Small kept readings elsewhere: dimension text, setting the sheet's median height. */
const dimensions = [token('544', -1, -1, { h: 13 }), token('317', 5, -1, { h: 13 }), token('524', 10, -1, { h: 13 })]
const GARAGE_M2 = 19.8
const published = (garageM2 = GARAGE_M2) => [
  { number: '1', label: 'Salon', areaM2: 60 },
  { number: '3', label: 'Kuchnia', areaM2: 12 },
  { number: '8', label: 'Garaż', areaM2: garageM2 },
]
const garageOf = (reading: ReturnType<typeof readInterior>) => reading.rooms.find((r) => r.bounds.x0 > 7.9 && r.bounds.z1 < 6.1)

describe('005U-N4 a garage number from a set-aside reading', () => {
  it('the one upright reading of the label that names a published room numbers the room, the rotated garble beside it notwithstanding', () => {
    const tokens = [...dimensions, token('8', 10, 3, { setAside: true }), token('/13', 10, 3, { orientation: 'ROTATED_CCW', h: 11 }), token('0', 10, 3, { setAside: true, orientation: 'INVERTED' })]
    const garage = garageOf(readInterior(house(), frame, BODY, 0.3, 0, tokens, published()))
    expect(garage?.number).toBe('8')
    expect(garage?.label).toBe('Garaż')
    expect(garage?.why).toMatch(/set aside/)
  })

  it('a label read as two published numbers alike is not chosen', () => {
    const tokens = [...dimensions, token('8', 10, 3, { setAside: true }), token('3', 10, 3, { setAside: true, orientation: 'ROTATED_CW' })]
    const reading = readInterior(house(), frame, BODY, 0.3, 0, tokens, published())
    expect(garageOf(reading)?.number).toBeUndefined()
    expect(reading.unresolved.some((u) => /8 or 3|3 or 8/.test(u.reason))).toBe(true)
  })

  it('a set-aside reading taken another way up is not a room number', () => {
    const tokens = [...dimensions, token('8', 10, 3, { setAside: true, orientation: 'ROTATED_CW' })]
    expect(garageOf(readInterior(house(), frame, BODY, 0.3, 0, tokens, published()))?.number).toBeUndefined()
  })

  it('the same number read on another label on the storey makes it one of two, and neither is taken', () => {
    const tokens = [...dimensions, token('8', 10, 3, { setAside: true }), token('8', 3, 4, { setAside: true, orientation: 'INVERTED' })]
    expect(garageOf(readInterior(house(), frame, BODY, 0.3, 0, tokens, published()))?.number).toBeUndefined()
  })

  it('a room far off the published area keeps no number from a set-aside reading', () => {
    const tokens = [...dimensions, token('8', 10, 3, { setAside: true })]
    expect(garageOf(readInterior(house(), frame, BODY, 0.3, 0, tokens, published(45)))?.number).toBeUndefined()
  })

  it('a number no published room on this storey carries is not taken (another storey, another edition)', () => {
    const tokens = [...dimensions, token('8', 10, 3, { setAside: true })]
    const other = published().filter((p) => p.number !== '8')
    expect(garageOf(readInterior(house(), frame, BODY, 0.3, 0, tokens, other))?.number).toBeUndefined()
    expect(garageOf(readInterior(house(), frame, BODY, 0.3, 0, tokens, []))?.number).toBeUndefined()
  })
})

// --- the mouth: which open side of the plan is the garage's ------------------------------------------------------
const room = (label: string | undefined, number: string | undefined = '8') => ({ number, label, bounds: { x0: 8.15, z0: 0.3, x1: 11.7, z1: 5.85 } })
/** A plan's open side along the front (sheet row 400) from world x to x. */
const openSide = (x0: number, x1: number, role = 'OPEN_SIDE') => ({ axis: 'Y' as const, linePx: OY, fromPx: px(x0), toPx: px(x1), decision: 'OPEN_SIDE', compound: { intervalId: `mouth-${x0}`, role } })

describe('005U-N4 the garage mouth', () => {
  it('a numbered garage with one open side along its face has that side as its mouth', () => {
    const found = garageMouth(room('Garaż'), BODY, [openSide(8.5, 11.5)], frame, 0.3)
    expect(found).toEqual([{ facade: 'FRONT', from: 8.5, to: 11.5, id: 'mouth-8.5' }])
  })

  it('two open sides meeting the garage are both returned, for the caller to leave unresolved', () => {
    const east = { axis: 'X' as const, linePx: px(12), fromPx: py(5), toPx: py(1), decision: 'OPEN_SIDE', compound: { intervalId: 'east', role: 'OPEN_SIDE' } }
    expect(garageMouth({ ...room('Garaż'), bounds: { ...room('Garaż').bounds, x1: 11.85 } }, BODY, [openSide(8.5, 11.5), east], frame, 0.3)).toHaveLength(2)
  })

  it('no garage, no mouth: an unnumbered room, a room of another name, a recess mouth, an open side elsewhere', () => {
    expect(garageMouth(room(undefined, undefined), BODY, [openSide(8.5, 11.5)], frame, 0.3)).toEqual([])
    expect(garageMouth(room('Salon'), BODY, [openSide(8.5, 11.5)], frame, 0.3)).toEqual([])
    expect(garageMouth(room('Garaż'), BODY, [openSide(8.5, 11.5, 'RECESS_MOUTH')], frame, 0.3)).toEqual([])
    expect(garageMouth(room('Garaż'), BODY, [openSide(1, 4)], frame, 0.3)).toEqual([])
  })
})

// --- the family: the mouth's gap in the main body ---------------------------------------------------------------
const OM = 0.02
const O = 20
/** The wall sits low on the sheet (row 400 and down), as a plan's front wall does. */
const OYW = 400
const W = 560
const H = 460
const opx = (x: number, z: number) => ({ x: O + x / OM, y: OYW + z / OM })
function wallWithGap(gap: [number, number], glazing = false): { raster: OpeningReadingInput['planRaster']; plan: PlanFrameV2 } {
  const data = new Uint8ClampedArray(W * H * 4).fill(255)
  const ink = (x: number, y: number): void => {
    const o = (Math.round(y) * W + Math.round(x)) * 4
    data[o] = data[o + 1] = data[o + 2] = 0
  }
  const a = opx(0, 0)
  const b = opx(10, 0.4)
  const g0 = opx(gap[0], 0).x
  const g1 = opx(gap[1], 0).x
  for (let y = a.y; y <= b.y; y += 1) for (let x = a.x; x <= b.x; x += 1) if (x < g0 || x > g1) ink(x, y)
  if (glazing) for (let x = g0; x <= g1; x += 1) ink(x, opx(0, 0.2).y)
  const plan: PlanFrameV2 = { frameId: 'frame-plan', assetId: 'asset-plan', storeyIndex: 0, mppX: OM, mppY: OM, originPx: { x: O, y: OYW }, why: 'synthetic', toWorld: (x, y) => ({ x: (x - O) * OM, z: (y - OYW) * OM }), toPixel: (x, z) => opx(x, z), wallPx: 0.2 / OM }
  return { raster: { width: W, height: H, data }, plan }
}
const host = (storeyIndex = 0): WallHost => ({ massId: 'main', facade: 'FRONT', planeAt: 0, from: 0, to: 10, centreAt: 0.2, storeyIndex, floorY: storeyIndex * 2.8, storeyHeightM: 2.8 })
const MOUTH = { from: 5, to: 8.2, roomId: 'main-room-0-1', why: 'the one open side of main-room-0-1, numbered 8 = Garaż' }
function opening(opts: { mouth?: typeof MOUTH; glazing?: boolean; storey?: number }) {
  const { raster, plan } = wallWithGap([5, 8.2], opts.glazing)
  const found = readWallOpenings({ plan, planRaster: raster, host: host(opts.storey ?? 0), wallThicknessM: 0.4, callouts: [], views: [], attachedSingleStorey: false, ...(opts.mouth ? { vehicleMouth: opts.mouth } : {}), index: 0 })
  expect(found).toHaveLength(1)
  return found[0]
}

describe('005U-N4 a garage mouth in the main body is a vehicle door', () => {
  it('the gap that is the garage mouth is a vehicle door: kind derived, heights assumed, width the plan gap', () => {
    const o = opening({ mouth: MOUTH })
    expect(o.family).toBe('GARAGE_DOOR')
    expect(o.provenance.family).toBe('SOURCE_DERIVED')
    expect(o.sillY).toBe(0)
    expect(o.headY).toBeCloseTo(2.2, 6)
    expect(o.provenance.sill).toBe('ASSUMED_FOR_RENDERING')
    expect(o.provenance.head).toBe('ASSUMED_FOR_RENDERING')
    expect(o.provenance.width).toBe('SOURCE_DERIVED')
    expect(o.unresolved.some((u) => u.startsWith('a vehicle door'))).toBe(true)
  })

  it('the same wide gap with no garage bound to it stays a window placeholder', () => {
    expect(opening({}).family).toBe('WINDOW')
  })

  it('glazing drawn across the mouth makes it no vehicle door', () => {
    expect(opening({ mouth: MOUTH, glazing: true }).family).not.toBe('GARAGE_DOOR')
  })

  it('above the ground storey no mouth is a vehicle door', () => {
    expect(opening({ mouth: MOUTH, storey: 1 }).family).not.toBe('GARAGE_DOOR')
  })
})
