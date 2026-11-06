/**
 * BUILDPLAN-ANALYZER-005T-N3: an approximate ridge for a specified gable without a printed one, and every case in
 * which it must not be taken (research/analyzer-005t-n3-roof/preregistration.md).
 */
import { describe, expect, it } from 'vitest'
import { approximateRidgeDatum, printedTerrainOf } from '../src/index.js'
import type { ApproximateRidgeInput } from '../src/index.js'

const knee = (cm: number, tag = 'a') => ({ id: `metric-spec-knee-wall-linear-dimension-${tag}`, kind: 'LINEAR_DIMENSION', unit: 'cm', value: cm, association: { kind: 'PUBLISHED_SPECIFICATION' } })
const pitch = { id: 'metric-spec-roof-angle-a', kind: 'ANGLE', unit: 'deg', value: 40, association: { kind: 'PUBLISHED_SPECIFICATION' } }

/** The development house's facts, as the solver had them: 13.82 × 9.50 m, top floor 2.80 (convention), 40°, 115 cm, 8.68 m. */
const base = (over: Partial<ApproximateRidgeInput> = {}): ApproximateRidgeInput => ({
  printedRidgeY: undefined,
  roof: { kind: 'GABLE', pitchDeg: 40, pitchAuthority: 'PUBLISHED_SPECIFICATION', ridgeAxis: 'X' },
  body: { x0: 0, x1: 13.82, z0: 0, z1: 9.5 },
  topFloorY: 2.8,
  topFloorPrinted: false,
  metrics: { evidence: [knee(115), pitch] } as unknown as ApproximateRidgeInput['metrics'],
  publishedFacts: [{ key: 'building_height', value: 8.68, unit: 'm' }],
  ...over,
})

describe('005T-N3 approximate ridge datum', () => {
  it('the development house: R = 2.80 + 1.15 + 4.75·tan 40°, consistent with the published 8.68 m', () => {
    const r = approximateRidgeDatum(base())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.datum.ridgeY).toBeCloseTo(2.8 + 1.15 + 4.75 * Math.tan((40 * Math.PI) / 180), 5)
    expect(r.datum.eaveY).toBeCloseTo(3.95, 6)
    expect(r.datum.heightMarginM).toBeCloseTo(0.744, 3)
    expect(r.datum.why).toContain('not a printed one')
    expect(r.datum.why).toContain('conventional storey height')
  })

  it('precedence: a printed section ridge stands and the rule does nothing', () => {
    expect(approximateRidgeDatum(base({ printedRidgeY: 8.1 })).ok).toBe(false)
  })

  it('no published building height, or more than one, or an implausible one → no datum', () => {
    expect(approximateRidgeDatum(base({ publishedFacts: [] })).ok).toBe(false)
    expect(approximateRidgeDatum(base({ publishedFacts: [{ key: 'building_height', value: 8.68, unit: 'm' }, { key: 'building_height', value: 9.1, unit: 'm' }] })).ok).toBe(false)
    expect(approximateRidgeDatum(base({ publishedFacts: [{ key: 'building_height', value: 86.8, unit: 'm' }] })).ok).toBe(false)
  })

  it('a published height that contradicts the geometry → no datum', () => {
    // too low: the ridge would stand above the whole building
    expect(approximateRidgeDatum(base({ publishedFacts: [{ key: 'building_height', value: 7.5, unit: 'm' }] })).ok).toBe(false)
    // too high: more than terrain and build-up can explain
    expect(approximateRidgeDatum(base({ publishedFacts: [{ key: 'building_height', value: 10.5, unit: 'm' }] })).ok).toBe(false)
  })

  it('a printed terrain datum the height does not fit refuses; one it fits is accepted', () => {
    expect(approximateRidgeDatum(base({ printedTerrainY: -0.2 })).ok).toBe(false)
    expect(approximateRidgeDatum(base({ printedTerrainY: -0.6 })).ok).toBe(true)
  })

  it('the axis is never turned to fit: across the long span the same facts contradict the height', () => {
    expect(approximateRidgeDatum(base({ roof: { kind: 'GABLE', pitchDeg: 40, pitchAuthority: 'PUBLISHED_SPECIFICATION', ridgeAxis: 'Z' } })).ok).toBe(false)
  })

  it('knee wall missing, implausible or stated twice differently → no datum', () => {
    expect(approximateRidgeDatum(base({ metrics: { evidence: [pitch] } as unknown as ApproximateRidgeInput['metrics'] })).ok).toBe(false)
    expect(approximateRidgeDatum(base({ metrics: { evidence: [knee(15), pitch] } as unknown as ApproximateRidgeInput['metrics'] })).ok).toBe(false)
    expect(approximateRidgeDatum(base({ metrics: { evidence: [knee(115, 'a'), knee(90, 'b'), pitch] } as unknown as ApproximateRidgeInput['metrics'] })).ok).toBe(false)
  })

  it('no source pitch, or a flat / unknown / mono roof, is never answered', () => {
    expect(approximateRidgeDatum(base({ roof: { kind: 'GABLE', pitchDeg: 40, pitchAuthority: 'ASSUMED', ridgeAxis: 'X' } })).ok).toBe(false)
    expect(approximateRidgeDatum(base({ roof: { kind: 'GABLE', pitchDeg: undefined, pitchAuthority: 'PUBLISHED_SPECIFICATION', ridgeAxis: 'X' } })).ok).toBe(false)
    for (const kind of ['FLAT', 'UNKNOWN', 'MONO']) expect(approximateRidgeDatum(base({ roof: { kind, pitchDeg: 40, pitchAuthority: 'PUBLISHED_SPECIFICATION', ridgeAxis: 'X' } })).ok).toBe(false)
    expect(approximateRidgeDatum(base({ roof: undefined })).ok).toBe(false)
  })
})

/**
 * EXTERIOR-COMPLETE (Zefiranty G2 ver. 2): a hipped main roof the page specifies (38°, knee wall 90 cm, 9.02 m) whose
 * only section is too small for its level marks to be read had no ridge and so no roof at all: the rule answered
 * gables only. A hip pitched alike on every side rises over half its body's shorter span — geometry, whichever way a
 * ridge would run — and the published height checks it exactly as it checks a gable.
 */
describe('EXTERIOR-COMPLETE approximate ridge datum for a hip', () => {
  const hip = (ridgeAxis?: 'X' | 'Z', over: Partial<ApproximateRidgeInput> = {}) => base({ roof: { kind: 'HIP', pitchDeg: 40, pitchAuthority: 'PUBLISHED_SPECIFICATION', ridgeAxis }, ...over })

  it('over 13.82 × 9.50 m it rises over half the shorter span: the same ridge as the gable across it', () => {
    for (const axis of ['X', 'Z', undefined] as const) {
      const r = approximateRidgeDatum(hip(axis))
      expect(r.ok, `ridge axis ${axis}`).toBe(true)
      if (!r.ok) continue
      expect(r.datum.halfSpanM).toBeCloseTo(4.75, 6)
      expect(r.datum.ridgeY).toBeCloseTo(2.8 + 1.15 + 4.75 * Math.tan((40 * Math.PI) / 180), 5)
      expect(r.datum.why).toContain('a hip rises over half its shorter span')
    }
  })

  it('counter-case: a published height the hip contradicts refuses it, as it refuses a gable', () => {
    expect(approximateRidgeDatum(hip('X', { publishedFacts: [{ key: 'building_height', value: 7.5, unit: 'm' }] })).ok).toBe(false)
    expect(approximateRidgeDatum(hip('X', { publishedFacts: [{ key: 'building_height', value: 10.5, unit: 'm' }] })).ok).toBe(false)
    expect(approximateRidgeDatum(hip('X', { printedTerrainY: -0.2 })).ok).toBe(false)
  })

  it('counter-case: a hip with no printed knee wall or no source pitch gets no datum', () => {
    expect(approximateRidgeDatum(hip('X', { metrics: { evidence: [pitch] } as unknown as ApproximateRidgeInput['metrics'] })).ok).toBe(false)
    expect(approximateRidgeDatum(base({ roof: { kind: 'HIP', pitchDeg: 40, pitchAuthority: 'ASSUMED' } })).ok).toBe(false)
  })
})

// E13 (Azalie: −0,57 on the lowered floor under the stair, −0,32 on the ground outside, the page's 8.02 m over −0,32)
describe('printedTerrainOf', () => {
  const marks = (vs: number[], confidence = 0.7) => vs.map((value) => ({ value, confidence }))
  const height = (value: number) => [{ key: 'building_height', value, unit: 'm' }]
  it('of two marks below ±0,00, the one the published height is measured from', () => {
    const t = printedTerrainOf(marks([-0.57, -0.32, 0, 2.96, 3.73, 7.7]), height(8.02))
    expect(t?.value).toBe(-0.32)
    expect(t?.why).toMatch(/published building height 8.02/)
    // the order of the marks or a more confident sunk floor does not move it
    expect(printedTerrainOf([{ value: -0.32, confidence: 0.6 }, { value: -0.57, confidence: 0.9 }, { value: 7.7, confidence: 0.9 }], height(8.02))?.value).toBe(-0.32)
  })
  it('counter: one mark, no published height, or no single mark meeting it: the most confident mark, as before', () => {
    expect(printedTerrainOf(marks([-0.47, 0, 8.55]), height(9.02))?.value).toBe(-0.47)
    expect(printedTerrainOf([{ value: -0.57, confidence: 0.9 }, { value: -0.32, confidence: 0.6 }, { value: 7.7, confidence: 0.9 }], [])?.value).toBe(-0.57)
    expect(printedTerrainOf([{ value: -0.57, confidence: 0.9 }, { value: -0.32, confidence: 0.6 }, { value: 7.7, confidence: 0.9 }], height(9.5))?.value).toBe(-0.57)
    expect(printedTerrainOf(marks([0, 2.8, 7.7]), height(8.02))).toBeUndefined()
  })
})
