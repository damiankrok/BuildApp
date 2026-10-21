/**
 * BUILDPLAN-ANALYZER-005Y-N5 (C3): in a wall of a garage — a room the publisher's list names one, or a body holding a
 * vehicle door — an opening to the floor a door wide is its door; the lines across the gap are its frame. Outside a
 * garage the same gap stays what the plan symbol says (counterfactual), and a wide or raised one is not made a door.
 */
import { describe, expect, it } from 'vitest'
import type { MetricEvidence } from '@buildapp/source-metrics'
import { readWallOpenings } from '../src/index.js'
import type { OpeningReadingInput, PlanFrameV2, WallHost } from '../src/index.js'

const MPP = 0.02
const O = 20
const W = 560
const H = 260
const px = (x: number, z: number) => ({ x: O + x / MPP, y: O + z / MPP })

type Draw = { gap: [number, number]; swing?: boolean; glazing?: boolean }

/** A 10 m front wall, 0.40 m thick, with one gap; the room is behind it (z > 0.4). */
function planOf(d: Draw): { raster: OpeningReadingInput['planRaster']; plan: PlanFrameV2 } {
  const data = new Uint8ClampedArray(W * H * 4).fill(255)
  const ink = (x: number, y: number): void => {
    const xi = Math.round(x)
    const yi = Math.round(y)
    if (xi < 0 || yi < 0 || xi >= W || yi >= H) return
    const o = (yi * W + xi) * 4
    data[o] = data[o + 1] = data[o + 2] = 0
  }
  const a = px(0, 0)
  const b = px(10, 0.4)
  const g0 = px(d.gap[0], 0).x
  const g1 = px(d.gap[1], 0).x
  for (let y = a.y; y <= b.y; y += 1) for (let x = a.x; x <= b.x; x += 1) if (x < g0 || x > g1) ink(x, y)
  if (d.glazing) for (const z of [0.1, 0.2, 0.3]) for (let x = g0; x <= g1; x += 1) ink(x, px(0, z).y)
  if (d.swing) {
    const hinge = px(d.gap[0], 0.4)
    const r = (d.gap[1] - d.gap[0]) / MPP
    for (let t = 0; t <= 90; t += 0.5) ink(hinge.x + r * Math.cos((t * Math.PI) / 180), hinge.y + r * Math.sin((t * Math.PI) / 180))
    for (let k = 0; k <= r; k += 1) ink(hinge.x, hinge.y + k)
  }
  const plan: PlanFrameV2 = {
    frameId: 'frame-plan',
    assetId: 'asset-plan',
    storeyIndex: 0,
    mppX: MPP,
    mppY: MPP,
    originPx: { x: O, y: O },
    why: 'synthetic',
    toWorld: (x, y) => ({ x: (x - O) * MPP, z: (y - O) * MPP }),
    toPixel: (x, z) => px(x, z),
    wallPx: 0.2 / MPP,
  }
  return { raster: { width: W, height: H, data }, plan }
}

const host = (storeyIndex = 0): WallHost => ({ massId: 'm', facade: 'FRONT', planeAt: 0, from: 0, to: 10, centreAt: 0.2, storeyIndex, floorY: storeyIndex * 2.8, storeyHeightM: 2.8 })

const callout = (text: string, gap: [number, number]): MetricEvidence => {
  const c = px((gap[0] + gap[1]) / 2, 1.0)
  return { id: `callout-${text}`, kind: 'OPENING_CALLOUT', rawText: text, alternatives: [], confidence: 0.8, textBox: { x0: c.x - 10, y0: c.y - 5, x1: c.x + 10, y1: c.y + 5 } } as unknown as MetricEvidence
}

function read(d: Draw, opts: { storey?: number; attached?: boolean; callouts?: MetricEvidence[]; garageRooms?: OpeningReadingInput['garageRooms'] } = {}) {
  const { raster, plan } = planOf(d)
  const found = readWallOpenings({ plan, planRaster: raster, host: host(opts.storey ?? 0), wallThicknessM: 0.4, callouts: opts.callouts ?? [], views: [], attachedSingleStorey: opts.attached ?? false, index: 0, ...(opts.garageRooms ? { garageRooms: opts.garageRooms } : {}) })
  expect(found).toHaveLength(1)
  return found[0]
}

const garage = [{ bounds: { x0: 0, z0: 0, x1: 10, z1: 6 }, why: 'the body holds a vehicle door (test)' }]

describe('005Y-N5 a door in a garage wall', () => {
  it('a 1.0 m gap to the floor, printed 100/210, with lines across it, is the garage\'s door', () => {
    const o = read({ gap: [3, 4], glazing: true }, { callouts: [callout('100/210', [3, 4])], garageRooms: garage })
    expect(o.family).toBe('DOOR')
    expect(o.provenance.family).toBe('VISUAL_SEMANTIC')
    expect(o.unresolved.join(' ')).toMatch(/a door by its room/)
  })
  it('counterfactual: the same gap outside a garage stays a glazed opening to the floor', () => {
    expect(read({ gap: [3, 4], glazing: true }, { callouts: [callout('100/210', [3, 4])] }).family).toBe('WINDOW')
  })
  it('negative: a raised window in a garage wall stays a window', () => {
    expect(read({ gap: [3, 4], glazing: true }, { callouts: [callout('100/60', [3, 4])], garageRooms: garage }).family).toBe('WINDOW')
  })
})
