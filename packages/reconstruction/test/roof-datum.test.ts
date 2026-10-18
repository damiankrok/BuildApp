/**
 * BUILDPLAN-ANALYZER-005T-N3: an approximate ridge for a specified gable without a printed one, and every case in
 * which it must not be taken (research/analyzer-005t-n3-roof/preregistration.md).
 */
import { describe, expect, it } from 'vitest'
import { approximateRidgeDatum } from '../src/index.js'
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

  it('no source pitch, or a hip / flat / unknown roof, is never answered as a gable', () => {
    expect(approximateRidgeDatum(base({ roof: { kind: 'GABLE', pitchDeg: 40, pitchAuthority: 'ASSUMED', ridgeAxis: 'X' } })).ok).toBe(false)
    expect(approximateRidgeDatum(base({ roof: { kind: 'GABLE', pitchDeg: undefined, pitchAuthority: 'PUBLISHED_SPECIFICATION', ridgeAxis: 'X' } })).ok).toBe(false)
    for (const kind of ['HIP', 'FLAT', 'UNKNOWN', 'MONO']) expect(approximateRidgeDatum(base({ roof: { kind, pitchDeg: 40, pitchAuthority: 'PUBLISHED_SPECIFICATION', ridgeAxis: 'X' } })).ok).toBe(false)
    expect(approximateRidgeDatum(base({ roof: undefined })).ok).toBe(false)
  })
})
