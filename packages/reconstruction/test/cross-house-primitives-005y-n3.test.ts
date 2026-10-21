/**
 * BUILDPLAN-ANALYZER-005Y-N3: the shared architectural primitives, on synthetic inputs (no project, no source image).
 *  - H1 `cornerAssemblies`: two openings in perpendicular walls ending at their shared corner, with no pier drawn in the
 *    corner square, are one glazing round the corner; a pier, or a piece stopping short of the corner, is not.
 *  - H4 `hostRoofTopAt`: a chimney stands on the highest roof covering its block — an attached body's pitched plane in
 *    the valley where it runs onto the main slope — and on the main roof's own profile where nothing covers the point.
 *  - H5 `commonHeadReading`: a weak printed height takes the storey's firmly read common head only when its own
 *    runner-up is that head; a firm reading, or a runner-up no other opening shares, stays as read.
 *  - H5 `viewGroundRefusals`: a view hung from a top row that is not the ridge puts the ground off; the printed terrain
 *    decides, and without it the views that agree must outnumber the one that does not.
 */
import { describe, expect, it } from 'vitest'
import { Canvas } from '@buildapp/synthetic-drawings'
import { commonHeadReading, cornerAssemblies, viewGroundRefusals } from '../src/v2/openings-v2.js'
import { hostRoofTopAt } from '../src/v2/roof-details.js'
import type { OpeningV2 } from '../src/v2/openings-v2.js'
import type { PlanFrameV2 } from '../src/v2/frame.js'

const MPP = 0.025
// world (x, z) → pixel (100 + x/mpp, 100 + z/mpp)
const plan = { frameId: 'p', mppX: MPP, mppY: MPP, toPixel: (x: number, z: number) => ({ x: 100 + x / MPP, y: 100 + z / MPP }), toWorld: (px: number, py: number) => ({ x: (px - 100) * MPP, z: (py - 100) * MPP }) } as unknown as PlanFrameV2
const T = 0.4
const rect = { x0: 0, z0: 0, x1: 8, z1: 6 }
const opening = (id: string, facade: OpeningV2['facade'], interval: [number, number]): OpeningV2 =>
  ({ id, storeyIndex: 0, massId: 'main', facade, planeAt: 0, interval, widthM: interval[1] - interval[0], sillY: 0.9, headY: 2.2, profile: 'RECTANGULAR', family: 'WINDOW', mullions: [], planGap: { frameId: 'p', pixelRect: { x0: 0, y0: 0, x1: 0, y1: 0 } }, provenance: { interval: 'SOURCE_DERIVED', width: 'SOURCE_DERIVED', sill: 'ASSUMED_FOR_RENDERING', head: 'ASSUMED_FOR_RENDERING', profile: 'SOURCE_DERIVED', family: 'ASSUMED_FOR_RENDERING' }, uncertaintyM: 0.06, unresolved: [], confidence: 0.5, why: 'test' }) as OpeningV2

function corner(pier: boolean) {
  const c = new Canvas(600, 600)
  c.fill(0, 0, 599, 599, 236)
  // thin glazing lines round the corner square at (0, 0)
  const p = plan.toPixel(0, 0)
  const q = plan.toPixel(T, T)
  c.line(p.x, p.y + 6, q.x + 40, p.y + 6, 1, 150)
  c.line(p.x + 6, p.y, p.x + 6, q.y + 40, 1, 150)
  if (pier) c.fill(p.x, p.y, q.x, q.y, 20)
  return c.toRaster()
}

describe('H1 — a corner assembly', () => {
  const front = opening('front', 'FRONT', [0.42, 2.6])
  const west = opening('west', 'WEST', [0.45, 1.6])
  it('is two pieces reaching the corner with no pier drawn between them', () => {
    const found = cornerAssemblies([front, west], rect, T, corner(false), plan)
    expect(found).toEqual([expect.objectContaining({ a: 'front', b: 'west', corner: { x: 0, z: 0 } })])
  })
  it('is not two openings either side of a pier', () => {
    expect(cornerAssemblies([front, west], rect, T, corner(true), plan)).toEqual([])
  })
  it('is not a piece that stops well short of the corner', () => {
    expect(cornerAssemblies([opening('front', 'FRONT', [1.4, 2.6]), west], rect, T, corner(false), plan)).toEqual([])
  })
  it('pairs only pieces on perpendicular walls of the same storey', () => {
    const upper = { ...west, storeyIndex: 1 }
    expect(cornerAssemblies([front, upper], rect, T, corner(false), plan)).toEqual([])
  })
})

describe('H4 — the roof a chimney stands on', () => {
  // main gable over z 6..15, ridge along x at z 10.5, eave 3.2, 30°; a garage gable plane rising toward x = 5 runs onto it
  const tan30 = Math.tan(Math.PI / 6)
  const mainTop = (_x: number, z: number) => 3.2 + (4.5 - Math.min(4.5, Math.abs(z - 10.5))) * tan30
  const roofs = {
    main: { footprint: { x0: 0, z0: 6, x1: 17, z1: 15 }, topAt: mainTop },
    pitched: [{ pitchDeg: 40, layout: { planes: [{ boundary: [{ x: 5, z: 0 }, { x: 8, z: 0 }, { x: 8, z: 6.2 }, { x: 5, z: 9.3 }], downslope: { x: 1, z: 0 }, datum: { x: 8, y: 3.2, z: 0 } }] } }],
    flat: [],
  }
  it('is the higher of the two where the garage plane runs over the main slope', () => {
    const y = hostRoofTopAt({ x: 6.2, z: 6.8 }, roofs, mainTop)
    expect(y).toBeCloseTo(3.2 + 1.8 * Math.tan((40 * Math.PI) / 180), 6)
    expect(y).toBeGreaterThan(mainTop(6.2, 6.8))
  })
  it('is the main roof where only the main roof covers the point', () => {
    expect(hostRoofTopAt({ x: 12, z: 10 }, roofs, mainTop)).toBeCloseTo(mainTop(12, 10), 9)
  })
  it('is a flat roof’s top over a flat-roofed body, and the main profile where nothing covers the point', () => {
    const flatOnly = { pitched: [], flat: [{ footprint: { x0: 0, z0: 0, x1: 4, z1: 4 }, slabTopY: 2.9, parapetTopY: 3.1 }] }
    expect(hostRoofTopAt({ x: 2, z: 2 }, flatOnly, mainTop)).toBe(3.1)
    expect(hostRoofTopAt({ x: 20, z: 20 }, flatOnly, () => 7)).toBe(7)
  })
})

describe('H5 — the storey’s common head over a weak printed height', () => {
  const firm = new Set([210, 230, 140])
  it('takes the runner-up when it is a firm head and the first reading is none', () => {
    expect(commonHeadReading({ heightCm: 290, heightCandidates: [{ cm: 290, score: 0.68 }, { cm: 230, score: 0.65 }, { cm: 240, score: 0.64 }] }, 0.64, firm)).toBe(230)
  })
  it('leaves a firm reading as read', () => {
    expect(commonHeadReading({ heightCm: 290, heightCandidates: [{ cm: 290, score: 0.99 }, { cm: 230, score: 0.6 }] }, 0.99, firm)).toBeUndefined()
  })
  it('leaves a weak reading whose runner-up no other opening shares', () => {
    expect(commonHeadReading({ heightCm: 275, heightCandidates: [{ cm: 275, score: 0.58 }, { cm: 225, score: 0.5 }, { cm: 224, score: 0.49 }] }, 0.58, firm)).toBeUndefined()
  })
  it('leaves a weak reading that already is a common head', () => {
    expect(commonHeadReading({ heightCm: 230, heightCandidates: [{ cm: 230, score: 0.64 }, { cm: 290, score: 0.6 }] }, 0.64, firm)).toBeUndefined()
  })
})

describe('H5 — a view whose ground is off', () => {
  const views = [
    { frameId: 'front', bottomY: -0.37 },
    { frameId: 'rear', bottomY: -0.4 },
    { frameId: 'left', bottomY: 0.46 },
    { frameId: 'right', bottomY: 0.2 },
  ]
  it('is any view off the printed terrain', () => {
    expect(viewGroundRefusals(views, [], -0.32).map((r) => r.frameId)).toEqual(['left', 'right'])
  })
  it('without a terrain, is a view the others outnumber — and a tie refuses nothing', () => {
    expect(viewGroundRefusals(views, [], undefined)).toEqual([])
    expect(viewGroundRefusals([...views.slice(0, 3), { frameId: 'right', bottomY: -0.35 }], [], undefined).map((r) => r.frameId)).toEqual(['left'])
  })
})
