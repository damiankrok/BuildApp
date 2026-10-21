/**
 * BUILDPLAN-ANALYZER-005Y-N5 (C1): a ring callout's width reading the recogniser's gate refused is accepted only where
 * the plan gap it labels measures the same width — the gap is the second, independent measurement. Its height half
 * leads only when it passed the gate itself.
 */
import { describe, expect, it } from 'vitest'
import type { MetricEvidence } from '@buildapp/source-metrics'
import { PLAN_CORROBORATED_WIDTH } from '@buildapp/source-metrics'
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

type Alt = { value: number; rawText: string; confidence: number; why: string }
const callout = (text: string, gap: [number, number], alternatives: Alt[]): MetricEvidence => {
  const c = px((gap[0] + gap[1]) / 2, 1.0)
  return { id: `callout-${text}`, kind: 'OPENING_CALLOUT', rawText: text, alternatives: alternatives.map((a) => ({ ...a, unit: 'cm' })), confidence: 0.8, textBox: { x0: c.x - 10, y0: c.y - 5, x1: c.x + 10, y1: c.y + 5 } } as unknown as MetricEvidence
}
// A grey ring the template misread as 700/40, whose lower half the recogniser read as 140 through the gate and whose
// upper half it read as 260 without passing it.
const greyRing = (gap: [number, number], refusedWidth = 260): MetricEvidence =>
  callout('700/140', gap, [
    { value: 140, rawText: '140', confidence: 0.996, why: 'height candidate: the recogniser read the lower half as 140 (p 0.996, mean 0.99, stable, 3 glyphs; the upper half was refused: not stable under the bracket)' },
    { value: 700, rawText: '700', confidence: 0.6, why: 'width candidate: the upper half read as 700 (match 0.6)' },
    { value: 40, rawText: '40', confidence: 0.6, why: 'height candidate: the lower half read as 40 (match 0.6)' },
    { value: refusedWidth, rawText: String(refusedWidth), confidence: 0.37, why: `width candidate: ${PLAN_CORROBORATED_WIDTH}: the recogniser read the upper half as ${refusedWidth} but the gate refused it (not stable under the bracket); usable only where the plan gap agrees` },
  ])

function read(d: Draw, opts: { storey?: number; attached?: boolean; callouts?: MetricEvidence[] } = {}) {
  const { raster, plan } = planOf(d)
  const found = readWallOpenings({ plan, planRaster: raster, host: host(opts.storey ?? 0), wallThicknessM: 0.4, callouts: opts.callouts ?? [], views: [], attachedSingleStorey: opts.attached ?? false, index: 0 })
  expect(found).toHaveLength(1)
  return found[0]
}

describe('005Y-N5 a refused width reading needs the plan gap to agree', () => {
  it('counterfactual: a 2.60 m gap takes the refused 260 over the template\'s 700, and the passed 140 as height', () => {
    const o = read({ gap: [3, 5.6] }, { callouts: [greyRing([3, 5.6])] })
    expect(o.callout?.widthCm).toBe(260)
    expect(o.callout?.heightCm).toBe(140)
    expect(o.callout?.widthCorroboratedByPlan).toBe(true)
    expect(o.provenance.width).toBe('SOURCE_CORROBORATED')
    expect(o.callout?.resolvedBy).toMatch(/corroborated the width reading 260 the recogniser's gate refused/)
  })
  it('negative: the same refused reading over a 2.20 m gap (18 % off) is not taken, and no callout labels the gap', () => {
    const o = read({ gap: [3, 5.2] }, { callouts: [greyRing([3, 5.2])] })
    expect(o.callout).toBeUndefined()
    expect(o.provenance.width).toBe('SOURCE_DERIVED')
  })
  it('a refused reading ranks under a reader\'s own candidate that also fits the gap', () => {
    const ring = greyRing([3, 5.6])
    const withOwn = { ...ring, alternatives: [...ring.alternatives, { value: 255, unit: 'cm', rawText: '255', confidence: 0.3, why: 'width candidate: the upper half read as 255 (match 0.3)' }] } as unknown as MetricEvidence
    // the reader's own first three are 700 and 255 here; 255 fits the 2.60 m gap and outranks the refused 260
    const o = read({ gap: [3, 5.6] }, { callouts: [withOwn] })
    expect(o.callout?.widthCm).toBe(255)
    expect(o.provenance.width).toBe('SOURCE_EXACT')
  })
  it('negative: a refused dropped-digit reading (26 for 260) cannot fit the gap it labels', () => {
    const o = read({ gap: [3, 5.6] }, { callouts: [greyRing([3, 5.6], 26)] })
    expect(o.callout).toBeUndefined()
  })
})
