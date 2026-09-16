import { describe, expect, it } from 'vitest'
import { measureHorizontal, measureVertical, registerOrthographic, toMetric, toPixel } from '../src/index.js'
import type { MetricImageFrame, OrthographicTransform, MetricAnchor } from '../src/index.js'

/** Narrow to the affine transform, failing loudly if the frame is not one. */
function affine(frame: MetricImageFrame): OrthographicTransform {
  expect(frame.transform.kind).toBe('ORTHOGRAPHIC_AFFINE')
  return frame.transform as OrthographicTransform
}

/** A drawing at 120 px to the metre, with x = 0 at u = 100 and y = 0 at v = 880. */
const PPM = 120
const U0 = 100
const V0 = 880
const u = (x: number): number => U0 + x * PPM
const v = (y: number): number => V0 - y * PPM

const anchor = (id: string, x: number | undefined, y: number | undefined, metricSigma = 0.005): MetricAnchor => ({
  id,
  pixel: { u: x === undefined ? 600 : u(x), v: y === undefined ? 500 : v(y) },
  metric: { x, y },
  pixelSigma: 0.5,
  metricSigma,
  kind: x === undefined ? 'DATUM' : 'WALL_FACE',
  evidenceIds: [],
  why: 'fixture',
})

const register = (anchors: readonly MetricAnchor[], options = {}) =>
  registerOrthographic({ id: 'frame-0', assetId: 'asset-0', horizontalAxis: 'X', region: { x0: 0, y0: 0, x1: 1400, y1: 1000 }, anchors }, options)

const CLEAN: MetricAnchor[] = [anchor('a-left', 0, undefined), anchor('b-right', 10, undefined), anchor('c-ground', undefined, 0), anchor('d-eaves', undefined, 6.5)]

describe('registering an orthographic elevation', () => {
  it('recovers the scale and the offset the drawing was made at', () => {
    const f = register(CLEAN)
    expect(f.status).toBe('METRIC_FRAME_VALID')
    expect(affine(f).metresPerPixelU).toBeCloseTo(1 / PPM, 9)
    expect(affine(f).metresPerPixelV).toBeCloseTo(1 / PPM, 9)
    expect(affine(f).anisotropy).toBeCloseTo(1, 6)
    // The drawing is upright, so there is no cross term to find — and a
    // solver left to fit one anyway returns a spurious value that explains
    // every anchor exactly and gets the scale badly wrong.
    expect(affine(f).bx).toBe(0)
    expect(affine(f).ay).toBe(0)
  })

  it('maps a pixel to metres and back', () => {
    const f = register(CLEAN)
    const p = toMetric(f, u(3.75), v(2.5))
    expect(p.x).toBeCloseTo(3.75, 4)
    expect(p.y).toBeCloseTo(2.5, 4)
    const back = toPixel(f, 3.75, 2.5)
    expect(back.u).toBeCloseTo(u(3.75), 3)
    expect(back.v).toBeCloseTo(v(2.5), 3)
  })

  it('does not let a height depend on where along the facade it was measured', () => {
    // Two height anchors read off opposite ends of the drawing. A fit that
    // drops the wrong term explains their height difference by their
    // horizontal separation, and then every height it reports is a function
    // of where on the facade you ask.
    const skewed: MetricAnchor[] = [
      anchor('a-left', 0, undefined),
      anchor('b-right', 10, undefined),
      { ...anchor('c-ground', undefined, 0), pixel: { u: u(0.5), v: v(0) } },
      { ...anchor('d-eaves', undefined, 6.5), pixel: { u: u(9.5), v: v(6.5) } },
    ]
    const f = register(skewed)
    expect(affine(f).ay).toBeCloseTo(0, 9)
    expect(toMetric(f, u(0.5), v(3)).y).toBeCloseTo(3, 4)
    expect(toMetric(f, u(9.5), v(3)).y).toBeCloseTo(3, 4)
  })

  it('refuses rather than guesses when an axis has one anchor', () => {
    const f = register([anchor('a-left', 0, undefined), anchor('c-ground', undefined, 0), anchor('d-eaves', undefined, 6.5)])
    expect(f.status).toBe('METRIC_FRAME_INVALID')
    expect(f.why).toContain('a scale needs two')
  })

  it('refuses a fit whose two axes are nothing like the same scale', () => {
    const f = register([anchor('a-left', 0, undefined), anchor('b-right', 10, undefined), anchor('c-ground', undefined, 0), { ...anchor('d-eaves', undefined, 6.5), pixel: { u: 600, v: v(2.0) } }])
    expect(f.status).toBe('METRIC_FRAME_INVALID')
    expect(f.why).toContain('one orthographic plane')
  })
})

/** §5: a fit always explains what it was fitted to. */
describe('checking a registration against a coordinate it never saw', () => {
  const many: MetricAnchor[] = [anchor('h0', 0, undefined), anchor('h1', 3.2, undefined), anchor('h2', 6.4, undefined), anchor('h3', 10, undefined), anchor('v0', undefined, 0), anchor('v1', undefined, 2.4), anchor('v2', undefined, 4.1), anchor('v3', undefined, 6.5)]

  it('holds one anchor per axis back and says which', () => {
    const f = register(many)
    expect(f.independentCheckAnchorIds.length).toBe(2)
    expect(f.status).toBe('METRIC_FRAME_VALID')
    for (const id of f.independentCheckAnchorIds) {
      const r = f.residuals.find((x) => x.anchorId === id)
      expect(r?.why).toContain('held out of the fit')
      expect(Math.abs(r?.residualXM ?? r?.residualYM ?? 1)).toBeLessThan(0.01)
    }
  })

  it('never holds back an endpoint, which would make the check an extrapolation', () => {
    const f = register(many)
    expect(f.independentCheckAnchorIds).not.toContain('h0')
    expect(f.independentCheckAnchorIds).not.toContain('h3')
    expect(f.independentCheckAnchorIds).not.toContain('v0')
    expect(f.independentCheckAnchorIds).not.toContain('v3')
  })

  it('§21: an anchor put fifteen pixels off is reported, not absorbed', () => {
    const moved = many.map((a) => (a.id === 'h1' ? { ...a, pixel: { u: a.pixel.u + 15, v: a.pixel.v } } : a))
    expect(register(many).metricResidualM).toBeLessThan(0.001)
    const f = register(moved)
    // 15 px is 0.125 m on this drawing. It must show up as a number: a
    // registration that swallows it is one nobody can audit.
    expect(f.metricResidualM).toBeGreaterThan(0.02)
    expect(f.residuals.find((r) => r.anchorId === 'h1')?.residualXM ?? 0).not.toBeCloseTo(0, 2)
  })

  it('§21: and it fails the gate of a drawing held to a tighter tolerance', () => {
    const moved = many.map((a) => (a.id === 'h1' ? { ...a, pixel: { u: a.pixel.u + 15, v: a.pixel.v } } : a))
    // At the default quarter-metre this drawing is still within what it is
    // believed to, and saying so is honest. Held to five centimetres — what a
    // technical elevation should manage — the same anchors are rejected.
    expect(register(moved).status).toBe('METRIC_FRAME_VALID')
    expect(register(moved, { toleranceM: 0.05 }).status).not.toBe('METRIC_FRAME_VALID')
    expect(register(many, { toleranceM: 0.05 }).status).toBe('METRIC_FRAME_VALID')
  })

  it('lets one badly placed anchor bend the fit rather than break it', () => {
    // A metre out — an anchor put on the wrong edge entirely. The robust
    // weighting must keep the scale the other three agree on.
    const wrong = many.map((a) => (a.id === 'h1' ? { ...a, pixel: { u: a.pixel.u + PPM, v: a.pixel.v } } : a))
    const f = register(wrong)
    expect(affine(f).metresPerPixelU).toBeCloseTo(1 / PPM, 4)
    expect(f.status).not.toBe('METRIC_FRAME_VALID')
  })

  it('is less sure of a scale fixed over a short span than a long one', () => {
    const wide = register([anchor('h0', 0, undefined, 0.02), anchor('h1', 10, undefined, 0.02), anchor('v0', undefined, 0), anchor('v1', undefined, 6.5)])
    const narrow = register([anchor('h0', 4.6, undefined, 0.02), anchor('h1', 5.4, undefined, 0.02), anchor('v0', undefined, 0), anchor('v1', undefined, 6.5)])
    // With the same residual in metres, a scale pinned over 10 m is worth far
    // more than the same one pinned over 0.8 m.
    expect(affine(narrow).scaleSigmaU).toBeGreaterThanOrEqual(affine(wide).scaleSigmaU)
  })

  it('is deterministic whatever order the anchors arrive in', () => {
    const a = register(many)
    const b = register([...many].reverse())
    expect(JSON.stringify(b)).toBe(JSON.stringify(a))
  })
})

/** §9: the error bar has to be computed, not asserted. */
describe('what a measurement off a registered image is worth', () => {
  const frame = register(CLEAN)

  it('measures a width the drawing states', () => {
    const m = measureHorizontal(frame, { id: 'm-0', quantity: 'OPENING_WIDTH', from: u(2.1), to: u(4.5) })
    expect(m.valueM).toBeCloseTo(2.4, 3)
  })

  it('measures a height the same way', () => {
    const m = measureVertical(frame, { id: 'm-1', quantity: 'OPENING_HEIGHT', from: v(0.9), to: v(2.3) })
    expect(m.valueM).toBeCloseTo(1.4, 3)
  })

  it('turns a five-pixel edge into a six-centimetre error bar, and says which part is which', () => {
    const m = measureHorizontal(frame, { id: 'm-2', quantity: 'OPENING_WIDTH', from: u(2.1), to: u(4.5), fromSigmaPx: 5, toSigmaPx: 5 })
    // Two edges each good to 5 px at 8.3 mm per pixel: 59 mm in quadrature.
    // This is the arithmetic of §9 — a pixel is a known number of millimetres,
    // so an error bar is computed rather than asserted.
    expect(m.uncertaintyParts.edgesM).toBeCloseTo(Math.hypot(5 / PPM, 5 / PPM), 4)
    expect(m.uncertaintyM).toBeGreaterThanOrEqual(m.uncertaintyParts.edgesM)
    expect(m.uncertaintyM).toBeLessThan(0.1)
    // A synthetic drawing registered against exact anchors genuinely has no
    // scale or registration error, and claiming one would be as wrong as
    // hiding it.
    expect(m.uncertaintyParts.scaleM).toBe(0)
    expect(m.uncertaintyParts.registrationM).toBe(0)
  })

  it('is more sure of a crisp edge than a soft one', () => {
    const crisp = measureHorizontal(frame, { id: 'm-3', quantity: 'W', from: u(2.1), to: u(4.5), fromSigmaPx: 0.3, toSigmaPx: 0.3 })
    const soft = measureHorizontal(frame, { id: 'm-4', quantity: 'W', from: u(2.1), to: u(4.5), fromSigmaPx: 6, toSigmaPx: 6 })
    expect(crisp.uncertaintyM).toBeLessThan(soft.uncertaintyM)
    expect(crisp.confidence).toBeGreaterThan(soft.confidence)
  })

  it('charges a longer measurement more for the same scale error', () => {
    // A third anchor that disagrees with the other two by two centimetres:
    // its pixel is where 5.00 m is, its label says 5.02 m.
    const disagrees: MetricAnchor = { ...anchor('h2', 5.02, undefined, 0.05), pixel: { u: u(5.0), v: 500 } }
    const shaky = register([anchor('h0', 0, undefined, 0.05), anchor('h1', 10, undefined, 0.05), disagrees, anchor('v0', undefined, 0), anchor('v1', undefined, 6.5)])
    const short = measureHorizontal(shaky, { id: 'm-5', quantity: 'W', from: u(1), to: u(2) })
    const long = measureHorizontal(shaky, { id: 'm-6', quantity: 'W', from: u(1), to: u(9) })
    expect(long.uncertaintyParts.scaleM).toBeGreaterThan(short.uncertaintyParts.scaleM)
    expect(shaky.metricResidualM).toBeGreaterThan(0)
  })

  it('keeps the pixels it read, so the number can be checked against the picture', () => {
    const m = measureHorizontal(frame, { id: 'm-7', quantity: 'W', from: u(4.5), to: u(2.1) })
    expect(m.pixel.u).toEqual({ from: u(2.1), to: u(4.5) })
    expect(m.valueM).toBeCloseTo(2.4, 3)
  })
})
