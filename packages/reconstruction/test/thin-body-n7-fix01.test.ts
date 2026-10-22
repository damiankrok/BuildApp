/**
 * N7-FIX-01: a thin body's far wall read with its openings (Council F-R1), and an elevation that corroborates a body
 * only by drawing its outline (Council E-1). Every plan and view here is drawn from invented dimensions: a main body
 * 8 m wide whose east wall (0.30 m) a 0.55 m band stands against, its own walls 0.15 m, at 50 px per metre.
 */
import { describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-cv'
import type { DimensionChain } from '@buildapp/source-metrics'
import { adjudicateThinBody, skyMask } from '../src/index.js'
import type { ElevationFrameV2, MassV2, PlanFrameV2, ThinBodyInput } from '../src/index.js'

const PPM = 50
const OX = 40
const OY = 40
const T = 0.3
const W = 900
const H = 600

const frame: PlanFrameV2 = {
  frameId: 'plan-0',
  assetId: 'asset-plan',
  storeyIndex: 0,
  mppX: 1 / PPM,
  mppY: 1 / PPM,
  originPx: { x: OX, y: OY },
  why: 'test',
  toWorld: (px, py) => ({ x: (px - OX) / PPM, z: (py - OY) / PPM }),
  toPixel: (x, z) => ({ x: OX + x * PPM, y: OY + z * PPM }),
  wallPx: (T * PPM) / 2,
}

/** A plan sheet: paper, with ink rectangles and one-pixel lines stated in metres. */
class Sheet {
  readonly data = new Uint8ClampedArray(W * H * 4).fill(255)
  fill(x0: number, z0: number, x1: number, z1: number, ink = true): this {
    for (let py = Math.round(OY + z0 * PPM); py < Math.round(OY + z1 * PPM); py += 1) {
      for (let px = Math.round(OX + x0 * PPM); px < Math.round(OX + x1 * PPM); px += 1) {
        const o = (py * W + px) * 4
        const v = ink ? 30 : 255
        this.data[o] = v
        this.data[o + 1] = v
        this.data[o + 2] = v
      }
    }
    return this
  }
  /** A line along z at x, one pixel wide. */
  lineZ(x: number, z0: number, z1: number): this {
    return this.fill(x, z0, x + 1 / PPM, z1)
  }
  get raster(): Raster {
    return { width: W, height: H, data: this.data }
  }
}

/** The main body's east wall and a band 8.00..8.55 drawn with walls of its own: ends, the wall against the house, the far wall. */
function band(): Sheet {
  return new Sheet().fill(7.7, 0, 8.0, 8).fill(8.0, 0, 8.55, 0.15).fill(8.0, 7.85, 8.55, 8).fill(8.0, 0, 8.15, 8).fill(8.4, 0, 8.55, 8)
}
/** Three 1.4 m openings in the far wall; a window draws its glazing lines across the gap. */
const OPENINGS: Array<[number, number]> = [
  [1.0, 2.4],
  [3.3, 4.7],
  [5.6, 7.0],
]
function withOpenings(sheet: Sheet, glazing: boolean): Sheet {
  for (const [z0, z1] of OPENINGS) {
    sheet.fill(8.4, z0, 8.55, z1, false)
    if (glazing) sheet.lineZ(8.45, z0, z1).lineZ(8.5, z0, z1)
  }
  return sheet
}

const mass = (id: string, role: 'MAIN' | 'ATTACHED', x0: number, x1: number, z0 = 0, z1 = 8): MassV2 => ({ id, role, x0, z0, x1, z1, storeys: [0], featureId: `f-${id}`, sourceMassId: `mass-${id}` })
const main = mass('main', 'MAIN', 0, 8)
const thin = mass('band', 'ATTACHED', 8, 8.55)
const chain = (id: string, axis: 'HORIZONTAL' | 'VERTICAL', segments: Array<{ from: number; to: number; cm: number }>): DimensionChain =>
  ({ id, frameId: 'plan-0', assetId: 'asset-plan', axis, baselinePx: 10, ticksPx: [], segments: segments.map((s, i) => ({ index: i, fromPx: (axis === 'HORIZONTAL' ? OX : OY) + s.from * PPM, toPx: (axis === 'HORIZONTAL' ? OX : OY) + s.to * PPM, pixelLength: (s.to - s.from) * PPM, evidenceId: `${id}-e${i}`, valueCm: s.cm, confidence: 0.9 })), closes: true, observationIds: [], ocrTokenIds: [] }) as DimensionChain

const input = (raster: Raster, over: Partial<ThinBodyInput> = {}): ThinBodyInput => ({
  masses: [main, thin],
  wallThicknessM: T,
  sourceOf: () => ({ why: 'a region of the base plan enclosed by its own walls', widthBasis: 'SCALED', evidenceIds: [] }),
  plan: () => ({ frame, raster }),
  chains: [],
  views: [],
  skyOf: () => ({ data: new Uint8Array(W * H), width: W }),
  levels: [{ index: 0, elevation: 0, wallTop: 2.8 }],
  ...over,
})
const supported = (r: ReturnType<typeof adjudicateThinBody>): string[] => r.hypotheses.filter((h) => h.status === 'SUPPORTED').map((h) => h.kind)

describe('N7-FIX-01 (F-R1) a far wall with openings is still a wall', () => {
  it('control: the far wall whole is a continuous band, and the band test alone decides', () => {
    const r = adjudicateThinBody({ ...thin }, 'X', input(band().raster))
    expect(r.decision.kind).toBe('DRAWN_THIN_WALLS')
    expect(r.hypotheses.find((h) => h.kind === 'CANOPY_ON_POSTS')?.why).toBe('the far face is a continuous drawn wall')
    // the along-face reading is still recorded: one piece end to end, nothing to close
    expect(r.profile?.farWall?.pieceShare).toBeGreaterThan(0.95)
    expect(r.profile?.farWall?.gaps).toEqual([])
  })

  it('three windows drawn with their glazing: the masonry is under 60 % of the face, the wall is read with its openings', () => {
    const r = adjudicateThinBody({ ...thin }, 'X', input(withOpenings(band(), true).raster))
    const fw = r.profile?.farWall
    expect(fw?.holds).toBe(true)
    expect(fw?.pieceShare).toBeLessThan(0.6)
    expect(fw?.gaps.map((g) => g.widthM)).toEqual([expect.closeTo(1.4, 1), expect.closeTo(1.4, 1), expect.closeTo(1.4, 1)])
    for (const g of fw?.gaps ?? []) expect(g.drawnAcross).toBeGreaterThanOrEqual(0.8)
    expect(supported(r)).toEqual(['DRAWN_THIN_WALLS'])
    expect(r.hypotheses.find((h) => h.kind === 'CANOPY_ON_POSTS')).toMatchObject({ status: 'REFUTED', why: expect.stringMatching(/wall broken by 3 openings/) })
    expect(r.decision.kind).toBe('DRAWN_THIN_WALLS')
    expect(r.decision.wallThicknessM).toBeCloseTo(0.15, 1)
  })

  it('the same gaps drawn bare: the drawing does not say they are openings, and they are not closed', () => {
    const r = adjudicateThinBody({ ...thin }, 'X', input(withOpenings(band(), false).raster))
    expect(r.profile?.farWall?.holds).toBe(false)
    expect(r.profile?.farWall?.why).toMatch(/no opening symbol across it and no printed chain/)
    expect(r.decision.kind).toBe('KEEP_PARTIAL')
  })

  it('the same bare gaps, each measured jamb to jamb by a printed chain: openings', () => {
    const c = chain('chain-v', 'VERTICAL', [
      { from: 0, to: 1.0, cm: 100 },
      { from: 1.0, to: 2.4, cm: 140 },
      { from: 2.4, to: 3.3, cm: 90 },
      { from: 3.3, to: 4.7, cm: 140 },
      { from: 4.7, to: 5.6, cm: 90 },
      { from: 5.6, to: 7.0, cm: 140 },
      { from: 7.0, to: 8.0, cm: 100 },
    ])
    const r = adjudicateThinBody({ ...thin }, 'X', input(withOpenings(band(), false).raster, { chains: [c] }))
    expect(r.profile?.farWall?.holds).toBe(true)
    expect(r.profile?.farWall?.gaps.every((g) => g.chainIds.includes('chain-v'))).toBe(true)
    expect(r.decision.kind).toBe('DRAWN_THIN_WALLS')
  })

  it('negative — a canopy on posts: square posts with nothing drawn between are no wall', () => {
    const sheet = new Sheet().fill(7.7, 0, 8.0, 8).fill(8.0, 0, 8.15, 8)
    for (const z of [0, 2, 4, 6, 7.85]) sheet.fill(8.4, z, 8.55, z + 0.15)
    const r = adjudicateThinBody({ ...thin }, 'X', input(sheet.raster))
    expect(r.profile?.farWall?.holds).not.toBe(true)
    expect(r.decision.kind).toBe('KEEP_PARTIAL')
    expect(supported(r)).toContain('CANOPY_ON_POSTS')
  })

  it('negative — a wall that stops: the far wall runs half the body and nothing is drawn after it', () => {
    const sheet = new Sheet().fill(7.7, 0, 8.0, 8).fill(8.0, 0, 8.55, 0.15).fill(8.0, 0, 8.15, 8).fill(8.4, 0, 8.55, 4)
    const r = adjudicateThinBody({ ...thin }, 'X', input(sheet.raster))
    expect(r.profile?.farWall?.holds).not.toBe(true)
    expect(r.decision.kind).toBe('KEEP_PARTIAL')
  })

  it('negative — a printed width that contradicts the drawing (a misread label) still wins over a wall with openings', () => {
    const misread = chain('chain-h', 'HORIZONTAL', [{ from: 8.0, to: 8.55, cm: 85 }])
    const r = adjudicateThinBody({ ...thin }, 'X', input(withOpenings(band(), true).raster, { chains: [misread] }))
    expect(r.profile?.farWall?.holds).toBe(true)
    expect(r.chains.map((c) => c.role)).toEqual(['CONFLICTS'])
    expect(r.decision.kind).toBe('KEEP_PARTIAL')
    expect(r.firstBad).toMatch(/^SOURCE_CONFLICT/)
  })
})

// ---------------------------------------------------------------------------------------------------------------------
// E-1: a render that sees the band side on. Pale sky, grass, the main body (x 0..8, 0..2.8 m) under its roof band.
// ---------------------------------------------------------------------------------------------------------------------
const GROUND = 500
const frontView: ElevationFrameV2 = { registration: { frameId: 'front', assetId: 'a-front' } as ElevationFrameV2['registration'], side: 'FRONT', planeAt: 0, alongOf: (px) => (px - OX) / PPM, pxOf: (a) => OX + a * PPM, yOf: (py) => (GROUND - py) / PPM, pyOf: (y) => GROUND - y * PPM }
type Paint = { x0: number; x1: number; y0: number; y1: number; rgb: [number, number, number] }
function render(extras: Paint[]): Raster {
  const data = new Uint8ClampedArray(W * H * 4)
  for (let py = 0; py < H; py += 1) {
    for (let px = 0; px < W; px += 1) {
      const o = (py * W + px) * 4
      const c = py >= GROUND ? [110, 140, 80] : [150 + Math.round((py / H) * 40), 185 + Math.round((py / H) * 30), 235]
      data[o] = c[0]
      data[o + 1] = c[1]
      data[o + 2] = c[2]
      data[o + 3] = 255
    }
  }
  for (const p of [{ x0: 0, x1: 8, y0: 0, y1: 2.8, rgb: [232, 228, 220] } as Paint, { x0: -0.5, x1: 8.5, y0: 2.8, y1: 3.4, rgb: [120, 60, 50] } as Paint, ...extras]) {
    for (let py = Math.round(frontView.pyOf(p.y1)); py < Math.round(frontView.pyOf(p.y0)); py += 1) {
      for (let px = Math.round(frontView.pxOf(p.x0)); px < Math.round(frontView.pxOf(p.x1)); px += 1) {
        const o = (py * W + px) * 4
        data[o] = p.rgb[0]
        data[o + 1] = p.rgb[1]
        data[o + 2] = p.rgb[2]
      }
    }
  }
  return { width: W, height: H, data }
}
/** A band read 0.45 m wide whose plan draws its far wall 4 m out, paper between: WIDEN rests on the elevation alone. */
const widenPlan = new Sheet().fill(7.7, 0, 8.0, 8).fill(11.7, 0, 12.0, 8).raster
const sliver = mass('band', 'ATTACHED', 8, 8.45)
const seen = (raster: Raster, masses: MassV2[] = [main, sliver]) => adjudicateThinBody({ ...sliver }, 'X', input(widenPlan, { masses, views: [{ view: frontView, raster }], skyOf: (r) => skyMask(r) }))

describe('N7-FIX-01 (E-1) an elevation corroborates a body only by drawing its outline', () => {
  it('control: a wall built over 8..12 m — its far corner and top drawn — corroborates, and the body is widened', () => {
    const r = seen(render([{ x0: 8, x1: 12, y0: 0, y1: 2.8, rgb: [225, 220, 210] }]))
    expect(r.elevations.map((e) => e.verdict)).toEqual(['CORROBORATES'])
    expect(r.decision.kind).toBe('WIDEN')
  })

  it('negative — trees over the widened part: not sky, but no outline of a body: not decisive, not widened', () => {
    const r = seen(render([{ x0: 8.2, x1: 12, y0: 0, y1: 4.2, rgb: [60, 105, 50] }]))
    expect(r.elevations.map((e) => e.verdict)).toEqual(['NOT_DECISIVE'])
    expect(r.elevations[0].builtShare).toBeGreaterThanOrEqual(0.6)
    expect(r.decision.kind).toBe('KEEP_PARTIAL')
  })

  it('negative — a hedge 1.6 m tall: neither built nor empty, not decisive', () => {
    const r = seen(render([{ x0: 8, x1: 12, y0: 0, y1: 1.6, rgb: [90, 90, 95] }]))
    expect(r.elevations.map((e) => e.verdict)).toEqual(['NOT_DECISIVE'])
    expect(r.decision.kind).toBe('KEEP_PARTIAL')
  })

  it('negative — a body standing behind in the same columns: the view cannot tell which body it shows', () => {
    const behind = mass('garage', 'ATTACHED', 8, 12, 9, 15)
    const r = seen(render([{ x0: 8, x1: 12, y0: 0, y1: 2.8, rgb: [225, 220, 210] }]), [main, sliver, behind])
    expect(r.elevations.map((e) => e.verdict)).toEqual(['NOT_DECISIVE'])
    expect(r.elevations[0].why).toMatch(/garage stands in the same columns/)
    expect(r.decision.kind).toBe('KEEP_PARTIAL')
  })

  it('open sky over the widened part with no corner drawn contradicts the widening', () => {
    const r = seen(render([]))
    expect(r.elevations.map((e) => e.verdict)).toEqual(['CONTRADICTS'])
    expect(r.hypotheses.find((h) => h.kind === 'WIDEN')?.status).toBe('REFUTED')
  })
})
