/**
 * BUILDPLAN-ANALYZER-005U: an assumed sill is not evidence of what an opening is.
 *
 * With no callout and no elevation, the reader used to SET the sill at the floor and then read that back as "reaches
 * the floor": every unread gap became a door, a glazed door, a multi-panel screen — or, on a single-storey attached
 * body, a garage door. The owner saw brown doors on upper storeys and a dark vehicle door no source shows. Now only the
 * plan's door symbol makes a door (a drawn swing; an empty door-wide gap on the ground storey); anything else is a window
 * placeholder whose kind and heights are named as assumed.
 * A printed height still decides as before. Synthetic plans only: a wall band with a gap, and the symbols drawn on it.
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
  if (d.glazing) for (let x = g0; x <= g1; x += 1) ink(x, px(0, 0.2).y)
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

function read(d: Draw, opts: { storey?: number; attached?: boolean; callouts?: MetricEvidence[] } = {}) {
  const { raster, plan } = planOf(d)
  const found = readWallOpenings({ plan, planRaster: raster, host: host(opts.storey ?? 0), wallThicknessM: 0.4, callouts: opts.callouts ?? [], views: [], attachedSingleStorey: opts.attached ?? false, index: 0 })
  expect(found).toHaveLength(1)
  return found[0]
}

describe('005U an assumed sill decides no opening kind', () => {
  it('an unread gap with no door symbol is a window placeholder, its kind and heights named as assumed', () => {
    const o = read({ gap: [3, 4] }, { storey: 1 })
    expect(o.family).toBe('WINDOW')
    expect(o.sillY).toBeCloseTo(2.8 + 0.9, 6)
    expect(o.provenance.sill).toBe('ASSUMED_FOR_RENDERING')
    expect(o.provenance.family).toBe('ASSUMED_FOR_RENDERING')
    expect(o.unresolved.join(' ')).toContain('drawn as a window, not read as one')
  })

  it('an unread gap with a door swing drawn on the plan stays a door: the symbol is evidence', () => {
    const o = read({ gap: [3, 4], swing: true })
    expect(o.family).toBe('DOOR')
    expect(o.sillY).toBe(0)
    expect(o.provenance.family).toBe('SOURCE_DERIVED')
  })

  it('an empty ground-storey gap a door wide is a door by the plan convention, named as such', () => {
    const o = read({ gap: [3, 4] })
    expect(o.family).toBe('DOOR')
    expect(o.provenance.family).toBe('VISUAL_SEMANTIC')
    expect(o.unresolved.join(' ')).toContain('plan convention')
  })

  it('negative: a wide unread gap on a single-storey attached body is never a garage door', () => {
    const o = read({ gap: [3, 6] }, { attached: true })
    expect(o.family).not.toBe('GARAGE_DOOR')
    expect(o.family).toBe('WINDOW')
  })

  it('negative: wide glazing drawn across an unread gap is a window, not a multi-panel door or a vehicle door', () => {
    const o = read({ gap: [3, 6], glazing: true }, { attached: true })
    expect(o.family).toBe('WINDOW')
  })

  it('a printed door height still decides: a balcony door / porte-fenêtre read as 100/220 reaches the floor', () => {
    const o = read({ gap: [3, 4] }, { storey: 1, callouts: [callout('100/220', [3, 4])] })
    expect(o.provenance.head).toBe('SOURCE_EXACT')
    expect(o.sillY).toBeCloseTo(2.8, 6)
    expect(['DOOR', 'GLAZED_DOOR']).toContain(o.family)
  })

  it('a printed wide height on an attached single-storey body still reads as a garage door', () => {
    const o = read({ gap: [3, 5.5] }, { attached: true, callouts: [callout('250/220', [3, 5.5])] })
    expect(o.family).toBe('GARAGE_DOOR')
  })
})
