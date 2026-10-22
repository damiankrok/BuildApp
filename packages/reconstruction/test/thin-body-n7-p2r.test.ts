/**
 * N7-P2R: an attached body read narrower than its own two walls, adjudicated on the plan's ink, its printed chains and
 * the elevations — never by name, never by widening or dropping it without evidence. Every plan here is drawn from
 * invented dimensions: a main body 8 m wide whose east wall (0.30 m) the band stands against, at 50 px per metre.
 */
import { describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-cv'
import type { DimensionChain } from '@buildapp/source-metrics'
import { adjudicateThinBody, thinBodies } from '../src/index.js'
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

/** Ink along x between `from` and `to` metres, for z 0..8, broken where `gaps` say (posts: short dashes). */
type Stroke = { from: number; to: number; dash?: number }
function plan(strokes: Stroke[]): Raster {
  const data = new Uint8ClampedArray(W * H * 4).fill(255)
  for (const s of strokes) {
    for (let py = OY; py < OY + 8 * PPM; py += 1) {
      const z = (py - OY) / PPM
      if (s.dash && Math.floor(z / s.dash) % 3 !== 0) continue
      for (let px = Math.round(OX + s.from * PPM); px < Math.round(OX + s.to * PPM); px += 1) {
        const o = (py * W + px) * 4
        data[o] = 30
        data[o + 1] = 30
        data[o + 2] = 30
      }
    }
  }
  return { width: W, height: H, data }
}

const mass = (id: string, role: 'MAIN' | 'ATTACHED', x0: number, x1: number): MassV2 => ({ id, role, x0, z0: 0, x1, z1: 8, storeys: [0], featureId: `f-${id}`, sourceMassId: `mass-${id}` })
const main = mass('main', 'MAIN', 0, 8)
const chain = (segments: Array<{ from: number; to: number; cm: number }>): DimensionChain =>
  ({ id: 'chain-h', frameId: 'plan-0', assetId: 'asset-plan', axis: 'HORIZONTAL', baselinePx: 10, ticksPx: [], segments: segments.map((s, i) => ({ index: i, fromPx: OX + s.from * PPM, toPx: OX + s.to * PPM, pixelLength: (s.to - s.from) * PPM, evidenceId: `e${i}`, valueCm: s.cm, confidence: 0.9 })), closes: true, observationIds: [], ocrTokenIds: [] }) as DimensionChain

/** A front view at the plan's scale: x along, the ground at row 500; sky above the drawn built extent. */
const frontView: ElevationFrameV2 = { registration: { frameId: 'front', assetId: 'a-front' } as ElevationFrameV2['registration'], side: 'FRONT', planeAt: 0, alongOf: (px) => (px - OX) / PPM, pxOf: (a) => OX + a * PPM, yOf: (py) => (500 - py) / PPM, pyOf: (y) => 500 - y * PPM }
const elevation = (builtTo: number): { raster: Raster; sky: { data: Uint8Array; width: number } } => {
  const sky = new Uint8Array(W * H)
  // N7-FIX-01 (E-1): the view draws what it shows — wall where it is built, pale sky elsewhere — so its outline can be read
  const data = new Uint8ClampedArray(W * H * 4)
  for (let py = 0; py < H; py += 1) {
    for (let px = 0; px < W; px += 1) {
      const isSky = frontView.alongOf(px) > builtTo || frontView.yOf(py) > 3
      if (isSky) sky[py * W + px] = 1
      const o = (py * W + px) * 4
      const rgb = isSky ? [170, 200, 235] : [225, 220, 210]
      data[o] = rgb[0]
      data[o + 1] = rgb[1]
      data[o + 2] = rgb[2]
      data[o + 3] = 255
    }
  }
  return { raster: { width: W, height: H, data }, sky: { data: sky, width: W } }
}

const input = (raster: Raster, band: MassV2, over: Partial<ThinBodyInput> = {}): ThinBodyInput => ({
  masses: [main, band],
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

describe('N7-P2R which bodies are thin', () => {
  it('only an attached body narrower than two walls', () => {
    expect(thinBodies([main, mass('a', 'ATTACHED', 8, 8.5), mass('b', 'ATTACHED', 8, 11)], T).map((t) => [t.mass.id, t.axis])).toEqual([['a', 'X']])
  })
})

describe('N7-P2R the readings of a thin band, each on its own drawing', () => {
  it('SHARED_WALL: the main body’s wall, interior, the band’s far wall — three walls of its own, no wall on the shared side', () => {
    const band = mass('band', 'ATTACHED', 8, 8.55)
    const r = adjudicateThinBody(band, 'X', input(plan([{ from: 7.7, to: 8 }, { from: 8.25, to: 8.55 }]), band))
    expect(r.shared).toEqual({ facade: 'WEST', withMassId: 'main' })
    expect(supported(r)).toEqual(['SHARED_WALL'])
    expect(r.decision).toMatchObject({ kind: 'SHARED_WALL', openSide: 'WEST' })
    expect(r.firstBad).toMatch(/^EMISSION/)
    // the area the ring's w1 and w3 would share, as the model reports it: (2T − 0.55) × (8 − 2T)
    expect(r.predictedOverlapM2).toBeCloseTo(0.05 * 7.4, 6)
  })

  it('DRAWN_THIN_WALLS: a wall of its own drawn against the main body’s, both long walls 0.15 m, interior between', () => {
    const band = mass('band', 'ATTACHED', 8, 8.55)
    const r = adjudicateThinBody(band, 'X', input(plan([{ from: 7.7, to: 8.15 }, { from: 8.4, to: 8.55 }]), band))
    expect(supported(r)).toEqual(['DRAWN_THIN_WALLS'])
    expect(r.decision.kind).toBe('DRAWN_THIN_WALLS')
    expect(r.decision.wallThicknessM).toBeCloseTo(0.15, 1)
  })

  it('SOLID_WALL: ink right across the band — a thickening of the wall, one wall of its width', () => {
    const band = mass('band', 'ATTACHED', 8, 8.4)
    const r = adjudicateThinBody(band, 'X', input(plan([{ from: 7.7, to: 8.4 }]), band))
    expect(supported(r)).toEqual(['SOLID_WALL'])
    expect(r.decision).toMatchObject({ kind: 'SOLID_WALL', wallThicknessM: 0.4 })
  })

  it('WIDEN: no wall at the read face, interior to a wall drawn 4 m out, and a printed chain from the shared face to it', () => {
    const band = mass('band', 'ATTACHED', 8, 8.45)
    const raster = plan([{ from: 7.7, to: 8 }, { from: 11.7, to: 12 }])
    const r = adjudicateThinBody(band, 'X', input(raster, band, { chains: [chain([{ from: 0, to: 8, cm: 800 }, { from: 8, to: 12, cm: 400 }])] }))
    expect(r.chains.map((c) => `${c.valueCm}:${c.role}`)).toEqual(['800:UNRELATED', '400:WIDENS'])
    expect(supported(r)).toEqual(['WIDEN'])
    expect(r.decision.kind).toBe('WIDEN')
    expect(r.decision.after?.x1).toBeCloseTo(12, 1)
    expect(r.firstBad).toMatch(/^PLAN_DECOMPOSITION/)
  })

  it('WIDEN on the elevation alone: the front view shows the widened part built', () => {
    const band = mass('band', 'ATTACHED', 8, 8.45)
    const e = elevation(12)
    const r = adjudicateThinBody(band, 'X', input(plan([{ from: 7.7, to: 8 }, { from: 11.7, to: 12 }]), band, { views: [{ view: frontView, raster: e.raster }], skyOf: () => e.sky }))
    expect(r.elevations.map((v) => v.verdict)).toEqual(['CORROBORATES'])
    expect(r.decision.kind).toBe('WIDEN')
  })
})

describe('N7-P2R the body is left to the partial preview when the source does not decide', () => {
  it('a wall drawn further out, but nothing printed and no view: not widened on the plan’s word alone', () => {
    const band = mass('band', 'ATTACHED', 8, 8.45)
    const r = adjudicateThinBody(band, 'X', input(plan([{ from: 7.7, to: 8 }, { from: 11.7, to: 12 }]), band))
    expect(r.hypotheses.find((h) => h.kind === 'WIDEN')?.status).toBe('NO_EVIDENCE')
    expect(r.decision.kind).toBe('KEEP_PARTIAL')
  })

  it('an elevation that shows nothing built over the widened part refutes the widening', () => {
    const band = mass('band', 'ATTACHED', 8, 8.45)
    const e = elevation(8.2)
    const r = adjudicateThinBody(band, 'X', input(plan([{ from: 7.7, to: 8 }, { from: 11.7, to: 12 }]), band, { chains: [chain([{ from: 8, to: 12, cm: 400 }])], views: [{ view: frontView, raster: e.raster }], skyOf: () => e.sky }))
    expect(r.hypotheses.find((h) => h.kind === 'WIDEN')?.status).toBe('REFUTED')
    expect(r.decision.kind).toBe('KEEP_PARTIAL')
  })

  it('a printed dimension ending on the band’s face that disagrees with the drawing is a conflict, whatever the drawing says', () => {
    const band = mass('band', 'ATTACHED', 8, 8.6)
    const r = adjudicateThinBody(band, 'X', input(plan([{ from: 7.7, to: 8 }, { from: 8.3, to: 8.6 }]), band, { chains: [chain([{ from: 5, to: 8.6, cm: 360 }])] }))
    expect(supported(r)).toContain('SHARED_WALL')
    expect(r.chains[0].role).toBe('CONFLICTS')
    expect(r.decision.kind).toBe('KEEP_PARTIAL')
    expect(r.firstBad).toMatch(/^SOURCE_CONFLICT/)
  })

  it('the shared-wall reading contradicted by the elevation: nothing built over the band', () => {
    const band = mass('band', 'ATTACHED', 8, 8.6)
    const e = elevation(8)
    const r = adjudicateThinBody(band, 'X', input(plan([{ from: 7.7, to: 8 }, { from: 8.3, to: 8.6 }]), band, { views: [{ view: frontView, raster: e.raster }], skyOf: () => e.sky }))
    expect(supported(r)).toEqual(['SHARED_WALL'])
    expect(r.decision.kind).toBe('KEEP_PARTIAL')
    expect(r.decision.why).toMatch(/elevation shows nothing built/)
  })

  it('a strip the plan draws nothing for: named a false strip, not removed', () => {
    const band = mass('band', 'ATTACHED', 8, 8.5)
    const r = adjudicateThinBody(band, 'X', input(plan([{ from: 7.7, to: 8 }]), band))
    expect(supported(r)).toEqual(['FALSE_STRIP'])
    expect(r.decision.kind).toBe('KEEP_PARTIAL')
  })

  it('a far face drawn as posts: named a canopy on posts, not built as walls', () => {
    const band = mass('band', 'ATTACHED', 8, 8.5)
    const r = adjudicateThinBody(band, 'X', input(plan([{ from: 7.7, to: 8 }, { from: 8.3, to: 8.5, dash: 0.6 }]), band))
    expect(supported(r)).toEqual(['CANOPY_ON_POSTS'])
    expect(r.decision.kind).toBe('KEEP_PARTIAL')
  })
})
