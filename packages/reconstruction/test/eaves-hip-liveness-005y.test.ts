/**
 * BUILDPLAN-ANALYZER-005Y: the eaves projection read on a section, and the tinted-callout search keeping the run alive.
 *
 * The section is drawn here from an invented body (walls, a slab, two roof lines at a stated pitch running past the
 * walls by a known projection); no drawing of a real project is used. The callout sheet is the synthetic house of
 * 005X-N2.
 */
import { describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-cv'
import { readTintedCallouts } from '@buildapp/source-metrics'
import { IVYBANK, renderGroundPlan } from '@buildapp/synthetic-drawings'
import type { SyntheticHouse } from '@buildapp/synthetic-drawings'
import { readEavesOverhang } from '../src/v2/roof-details.js'

type Section = { spanM: number; pitchDeg: number; overhangM: [number, number]; pergola?: boolean; mpp?: number }

/** A section across the ridge: two outer walls, a floor, and the roof's top line from each eave lip to the apex. */
function drawSection(s: Section): Raster {
  const mpp = s.mpp ?? 0.015
  const width = 1100
  const height = 800
  const data = new Uint8ClampedArray(width * height * 4).fill(255)
  const ink = (x: number, y: number): void => {
    const xi = Math.round(x)
    const yi = Math.round(y)
    if (xi < 0 || yi < 0 || xi >= width || yi >= height) return
    const o = (yi * width + xi) * 4
    data[o] = 20
    data[o + 1] = 20
    data[o + 2] = 20
  }
  const wallPx = Math.round(0.3 / mpp)
  const left = Math.round((width - s.spanM / mpp) / 2)
  const right = left + Math.round(s.spanM / mpp)
  const ground = 700
  const eaveRow = ground - Math.round(3.2 / mpp)
  // the outer walls, full height to the eaves, and the floor slab
  for (let y = eaveRow; y <= ground; y += 1) for (let k = 0; k < wallPx; k += 1) {
    ink(left + k, y)
    ink(right - 1 - k, y)
  }
  for (let x = left; x < right; x += 1) for (let k = 0; k < 12; k += 1) ink(x, ground - k)
  // the roof's top line and a thickness under it, from each lip to the apex
  const tan = Math.tan((s.pitchDeg * Math.PI) / 180)
  const mid = (left + right) / 2
  const lipL = left - Math.round(s.overhangM[0] / mpp)
  const lipR = right - 1 + Math.round(s.overhangM[1] / mpp)
  for (let x = lipL; x <= lipR; x += 1) {
    const yTop = eaveRow - (x < mid ? x - left : right - 1 - x) * tan
    for (let k = 0; k < 14; k += 1) ink(x, yTop + k)
  }
  // a pergola beside the house: a horizontal beam level with the wall top and its post
  if (s.pergola) {
    for (let x = left - 260; x < left; x += 1) for (let k = 0; k < 6; k += 1) ink(x, eaveRow + 40 + k)
    for (let y = eaveRow + 40; y <= ground; y += 1) for (let k = 0; k < 6; k += 1) ink(left - 260 + k, y)
  }
  return { width, height, data } as Raster
}

describe('005Y eaves projection from a section', () => {
  it('reads the projection both eaves draw past the walls, at the scale of the span across the ridge', () => {
    const r = readEavesOverhang(drawSection({ spanM: 9.5, pitchDeg: 40, overhangM: [0.9, 0.9] }), 9.5, { pitchDeg: 40, thicknessM: 0.28 })
    expect(r).toBeDefined()
    expect(r?.overhangM).toBeCloseTo(0.9, 1)
    expect(r?.drawnPitchDeg[0]).toBeCloseTo(40, 0)
  })

  it('takes the smaller of two unequal eaves, and nothing when they disagree too much', () => {
    expect(readEavesOverhang(drawSection({ spanM: 9.5, pitchDeg: 40, overhangM: [0.7, 0.9] }), 9.5, { pitchDeg: 40, thicknessM: 0.28 })?.overhangM).toBeCloseTo(0.7, 1)
    expect(readEavesOverhang(drawSection({ spanM: 9.5, pitchDeg: 40, overhangM: [0.2, 1.2] }), 9.5, { pitchDeg: 40, thicknessM: 0.28 })).toBeUndefined()
  })

  it('reads no projection where the roof stops at the walls, and none at a pitch the section does not draw', () => {
    expect(readEavesOverhang(drawSection({ spanM: 9.5, pitchDeg: 40, overhangM: [0, 0] }), 9.5, { pitchDeg: 40, thicknessM: 0.28 })).toBeUndefined()
    expect(readEavesOverhang(drawSection({ spanM: 9.5, pitchDeg: 40, overhangM: [0.9, 0.9] }), 9.5, { pitchDeg: 30, thicknessM: 0.28 })).toBeUndefined()
  })

  it('a pergola beside the house neither widens the walls nor extends the eaves', () => {
    const r = readEavesOverhang(drawSection({ spanM: 9.5, pitchDeg: 40, overhangM: [0.9, 0.9], pergola: true }), 9.5, { pitchDeg: 40, thicknessM: 0.28 })
    expect(r?.overhangM).toBeCloseTo(0.9, 1)
    expect(r?.mpp).toBeCloseTo(0.015, 3)
  })
})

const STATED: SyntheticHouse = {
  ...IVYBANK,
  name: 'Juniper',
  rooflights: [
    { slope: 'LOW', along: 1.4, width: 0.78, y: 0.5, height: 1.18, stated: { widthCm: 78, lengthCm: 118 }, onElevations: false },
    { slope: 'HIGH', along: 3.6, width: 0.66, y: 0.5, height: 0.98, stated: { widthCm: 66, lengthCm: 98 }, onElevations: false },
  ],
}

describe('005Y liveness inside the tinted-callout search', () => {
  it('ticks through the search and the reading, and reads exactly what it reads without a checkpoint', () => {
    const sheet = renderGroundPlan(STATED, { pixelsPerMetre: 60, storey: 1 }).toRaster()
    const options = { minRadiusPx: 9, maxRadiusPx: 27, requireBar: true }
    const subphases = new Map<string, number>()
    const ticking = readTintedCallouts(sheet, {
      ...options,
      checkpoint: {
        phase: () => undefined,
        tick: (u) => {
          const id = u?.subphase?.id ?? '-'
          subphases.set(id, (subphases.get(id) ?? 0) + 1)
        },
      },
    })
    const quiet = readTintedCallouts(sheet, options)
    expect(JSON.stringify(ticking)).toBe(JSON.stringify(quiet))
    // a tick for every row of the coarse search (and of the prefilter), and one per place read
    expect(subphases.get('TINTED_CALLOUT_SEARCH') ?? 0).toBeGreaterThan(sheet.height / 2)
    expect(subphases.get('TINTED_CALLOUT_RINGS') ?? 0).toBeGreaterThan(0)
  }, 60_000)
})
