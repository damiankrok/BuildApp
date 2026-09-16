import { describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-cv'
import { drawingCharacter, registerOrthographic, silhouetteTop, verticalOpeningExtent } from '../src/index.js'
import type { MetricAnchor } from '../src/index.js'
import { measureOpening, paint, registerScene } from './scene.js'
import type { Scene } from './scene.js'

/**
 * §21. Twelve ways of getting a boundary wrong, and what must happen to each.
 *
 * The requirement is not that every one of these is corrected. Several of them
 * cannot be, from the evidence available, and pretending otherwise is the
 * failure mode this whole stage exists to remove. The requirement is that none
 * of them produces SILENTLY WRONG metric geometry: each is either measured
 * correctly, or refused, or comes back carrying an error bar or a residual
 * that says how wrong it might be.
 */
const SCENE: Scene = {
  widthM: 10,
  heightM: 6.5,
  openings: [
    { id: 'door', x0: 0.6, x1: 1.6, y0: 0.35, y1: 2.45 },
    { id: 'window', x0: 2.1, x1: 4.5, y0: 1.1, y1: 2.5 },
    { id: 'glazing', x0: 5.0, x1: 9.7, y0: 1.0, y1: 3.3, mullions: 3 },
  ],
}

const copy = (r: Raster): Raster => ({ width: r.width, height: r.height, data: new Uint8ClampedArray(r.data) })
const put = (r: Raster, x: number, y: number, v: number): void => {
  if (x < 0 || y < 0 || x >= r.width || y >= r.height) return
  const i = (y * r.width + x) * 4
  r.data[i] = v
  r.data[i + 1] = v
  r.data[i + 2] = v
}

const base = paint(SCENE, 120)
const U = (x: number): number => base.originU + x * base.pxPerMU
const V = (y: number): number => base.groundV - y * base.pxPerMV
const STOREY = { from: V(6.4), to: V(0.05) }

/** The glazing, whose 4.70 m width is the number every mutation below is scored on. */
const GLAZING = SCENE.openings[2]
const widthOf = (raster: Raster, scene = SCENE, painted = base): number | null => {
  const frame = registerScene(raster, scene)
  if (!frame || frame.status === 'METRIC_FRAME_INVALID') return null
  const u = (x: number): number => painted.originU + x * painted.pxPerMU
  const v = (y: number): number => painted.groundV - y * painted.pxPerMV
  const got = measureOpening(raster, frame, GLAZING, { u0: u(GLAZING.x0), u1: u(GLAZING.x1), v0: v(GLAZING.y0), v1: v(GLAZING.y1) }, 20)
  return got ? got.width.valueM : null
}

const TRUE_WIDTH = GLAZING.x1 - GLAZING.x0

describe('§21: twelve wrong boundaries, none of them silently wrong', () => {
  it('1. a mullion is not the outer edge of the opening it divides', () => {
    // The run of glazing has three mullions across it. Taking the first one
    // for the reveal would report 1.17 m instead of 4.70.
    const got = widthOf(base.raster)
    expect(got).not.toBeNull()
    expect(Math.abs(got! - TRUE_WIDTH)).toBeLessThanOrEqual(0.05)
  })

  it('2. a shadow eight pixels outside the reveal does not widen it', () => {
    const scene = copy(base.raster)
    for (let v = Math.round(V(GLAZING.y1)); v <= Math.round(V(GLAZING.y0)); v += 1) {
      for (let d = 1; d <= 8; d += 1) {
        put(scene, Math.round(U(GLAZING.x1)) + d, v, 150)
        put(scene, Math.round(U(GLAZING.x0)) - d, v, 150)
      }
    }
    const got = widthOf(scene)
    expect(got).not.toBeNull()
    // Eight pixels either side is 0.13 m. The reveal is a harder edge than
    // the shadow and runs the whole height of the opening, so it wins.
    expect(Math.abs(got! - TRUE_WIDTH)).toBeLessThanOrEqual(0.1)
  })

  it('3. a crop that removes a building edge is refused, not guessed', () => {
    // The right-hand quarter of the facade is gone. The registration is fitted
    // to two overall dimensions, and one of them no longer exists.
    const cut: Raster = { width: Math.round(U(7.5)), height: base.raster.height, data: new Uint8ClampedArray(Math.round(U(7.5)) * base.raster.height * 4).fill(255) }
    for (let v = 0; v < cut.height; v += 1) {
      for (let u = 0; u < cut.width; u += 1) {
        const i = (v * cut.width + u) * 4
        const j = (v * base.raster.width + u) * 4
        cut.data[i] = base.raster.data[j]
        cut.data[i + 1] = base.raster.data[j + 1]
        cut.data[i + 2] = base.raster.data[j + 2]
      }
    }
    const frame = registerScene(cut, SCENE)
    // Either it refuses outright, or it registers and its own anchors say the
    // building is not 10 m wide in this picture. What it must not do is
    // report a scale as though nothing were missing.
    if (frame && frame.status !== 'METRIC_FRAME_INVALID') {
      const wall = frame.anchors.find((a) => a.id === 'wall-right')
      expect(wall, 'a right-hand wall anchor on a picture with no right-hand wall').toBeDefined()
      expect(frame.uncertainty.metrePerPixelU, 'a scale fitted across a missing quarter of the building').toBeGreaterThan(1 / 120)
    }
  })

  it('4. an anchor shifted fifteen pixels is reported as a residual', () => {
    const anchor = (id: string, x: number | undefined, y: number | undefined, u: number, v: number): MetricAnchor => ({
      id,
      pixel: { u, v },
      metric: { x, y },
      pixelSigma: 0.5,
      metricSigma: 0.001,
      kind: 'WALL_FACE',
      evidenceIds: [],
      why: 'fixture',
    })
    const good = [anchor('h0', 0, undefined, 100, 500), anchor('h1', 4, undefined, 580, 500), anchor('h2', 7, undefined, 940, 500), anchor('h3', 10, undefined, 1300, 500), anchor('v0', undefined, 0, 700, 880), anchor('v1', undefined, 6.5, 700, 100)]
    const moved = good.map((a) => (a.id === 'h1' ? { ...a, pixel: { u: a.pixel.u + 15, v: a.pixel.v } } : a))
    const region = { x0: 0, y0: 0, x1: 1400, y1: 1000 }
    const clean = registerOrthographic({ id: 'a', assetId: 'x', horizontalAxis: 'X', region, anchors: good })
    const bent = registerOrthographic({ id: 'b', assetId: 'x', horizontalAxis: 'X', region, anchors: moved })
    expect(clean.metricResidualM).toBeLessThan(0.01)
    // 15 px is 0.125 m on this drawing. It has to show up as a number.
    expect(bent.metricResidualM).toBeGreaterThan(0.02)
    // At the default quarter-metre this drawing is still within what it is
    // believed to, and saying so is honest. Held to the five centimetres a
    // technical elevation should manage, the same anchors are rejected.
    const strict = registerOrthographic({ id: 'c', assetId: 'x', horizontalAxis: 'X', region, anchors: moved }, { toleranceM: 0.05 })
    expect(strict.status).not.toBe('METRIC_FRAME_VALID')
    expect(registerOrthographic({ id: 'd', assetId: 'x', horizontalAxis: 'X', region, anchors: good }, { toleranceM: 0.05 }).status).toBe('METRIC_FRAME_VALID')
  })

  it('5. an anisotropic resize changes the pixels and not the building', () => {
    const squashed = paint(SCENE, 120, { squash: 0.7 })
    const frame = registerScene(squashed.raster, SCENE)
    expect(frame?.status).toBe('METRIC_FRAME_VALID')
    const got = widthOf(squashed.raster, SCENE, squashed)
    expect(got).not.toBeNull()
    expect(Math.abs(got! - TRUE_WIDTH)).toBeLessThanOrEqual(0.08)
  })

  it('6. a drawing and a render of the same aspect are not the same kind of thing', () => {
    // §10: the one thing that must not happen is the two being treated alike
    // because their sizes match.
    const line: Raster = { width: 900, height: 600, data: new Uint8ClampedArray(900 * 600 * 4).fill(255) }
    for (let y = 100; y <= 500; y += 1) for (const x of [150, 151, 700, 701]) put(line, x, y, 20)
    for (let x = 150; x <= 701; x += 1) for (const y of [100, 101, 500, 501]) put(line, x, y, 20)
    const render = paint({ ...SCENE, widthM: 9, heightM: 6 }, 90)
    expect(drawingCharacter(line).kind).toBe('LINE_DRAWING')
    expect(drawingCharacter(render.raster).kind).toBe('RENDERED')
  })

  it('7. a mirrored elevation is a different building, and its profile says so', () => {
    const asymmetric: Scene = { widthM: 12, heightM: 6.4, openings: [{ id: 'w', x0: 1, x1: 2.4, y0: 1, y1: 2.6 }] }
    const painted = paint(asymmetric, 100)
    for (let v = 0; v < painted.raster.height; v += 1) {
      for (let u = Math.round(painted.originU + 8 * painted.pxPerMU); u < painted.originU + 12 * painted.pxPerMU; u += 1) {
        if (v > painted.groundV - 3.0 * painted.pxPerMV) continue
        put(painted.raster, u, v, 250)
      }
    }
    const mirrored: Raster = { width: painted.raster.width, height: painted.raster.height, data: new Uint8ClampedArray(painted.raster.data.length) }
    for (let v = 0; v < painted.raster.height; v += 1) {
      for (let u = 0; u < painted.raster.width; u += 1) {
        const from = (v * painted.raster.width + (painted.raster.width - 1 - u)) * 4
        const to = (v * painted.raster.width + u) * 4
        mirrored.data[to] = painted.raster.data[from]
        mirrored.data[to + 1] = painted.raster.data[from + 1]
        mirrored.data[to + 2] = painted.raster.data[from + 2]
      }
    }
    // Decided the way the pipeline decides it: from the drawing's own top
    // edge, which on a tall house beside a low garage cannot be mistaken for
    // its mirror image.
    // Over the whole facade, not over what is left of it: the point of the
    // test is that the low end is part of the building, and asking
    // architecturalBounds where the building is would crop it off first.
    const facade = { x0: painted.originU, y0: 0, x1: painted.originU + asymmetric.widthM * painted.pxPerMU, y1: painted.groundV }
    const tallEnd = (r: Raster): 'LEFT' | 'RIGHT' => {
      const top = silhouetteTop(r, facade)
      const mean = (from: number, to: number): number => {
        const rows = top.slice(from, to).filter((v): v is number => v !== null)
        return rows.length === 0 ? r.height : rows.reduce((a, b) => a + b, 0) / rows.length
      }
      const half = Math.round(top.length / 2)
      return mean(10, half - 10) < mean(half + 10, top.length - 10) ? 'LEFT' : 'RIGHT'
    }
    expect(tallEnd(painted.raster)).toBe('LEFT')
    expect(tallEnd(mirrored)).toBe('RIGHT')
  })

  it('8. a perspective view registered as orthographic does not come back clean', () => {
    // Four anchors on a receding wall: the far end is foreshortened, so no
    // single scale explains them. The fit must say so, in a residual or a
    // refusal, rather than average the two ends.
    const anchor = (id: string, x: number, u: number): MetricAnchor => ({ id, pixel: { u, v: 500 }, metric: { x }, pixelSigma: 0.5, metricSigma: 0.001, kind: 'WALL_FACE', evidenceIds: [], why: 'fixture' })
    // A 10 m wall seen at an angle: equal metric steps, shrinking pixel steps.
    const frame = registerOrthographic({
      id: 'p',
      assetId: 'x',
      horizontalAxis: 'X',
      region: { x0: 0, y0: 0, x1: 1400, y1: 1000 },
      anchors: [
        anchor('h0', 0, 200),
        anchor('h1', 3.33, 640),
        anchor('h2', 6.67, 950),
        anchor('h3', 10, 1160),
        { ...anchor('v0', 0, 700), metric: { y: 0 }, pixel: { u: 700, v: 880 } },
        { ...anchor('v1', 0, 700), id: 'v1', metric: { y: 6.5 }, pixel: { u: 700, v: 100 } },
      ],
    })
    expect(frame.status).not.toBe('METRIC_FRAME_VALID')
    expect(frame.metricResidualM).toBeGreaterThan(0.2)
  })

  it('9. a proposal thirty pixels out is corrected, not adopted', () => {
    const frame = registerScene(base.raster, SCENE)!
    const got = measureOpening(base.raster, frame, GLAZING, { u0: U(GLAZING.x0) + 30, u1: U(GLAZING.x1) - 30, v0: V(GLAZING.y0) - 30, v1: V(GLAZING.y1) + 30 }, 40)
    expect(got).not.toBeNull()
    expect(Math.abs(got!.width.valueM - TRUE_WIDTH)).toBeLessThanOrEqual(0.05)
  })

  it('10. a low-contrast opening is measured or refused, never invented', () => {
    const faint = copy(base.raster)
    for (let v = Math.round(V(GLAZING.y1)); v <= Math.round(V(GLAZING.y0)); v += 1) {
      for (let u = Math.round(U(GLAZING.x0)); u <= Math.round(U(GLAZING.x1)); u += 1) {
        const i = (v * faint.width + u) * 4
        // Barely darker than the 190 wall around it.
        if (faint.data[i] < 120) put(faint, u, v, 182)
      }
    }
    const extent = verticalOpeningExtent(faint, { from: U(GLAZING.x0), to: U(GLAZING.x1) }, STOREY)
    if (extent) {
      expect(Math.abs(extent.fromPx - V(GLAZING.y1))).toBeLessThanOrEqual(3)
      expect(Math.abs(extent.toPx - V(GLAZING.y0))).toBeLessThanOrEqual(3)
    }
  })

  it('11. a raked head is not reported as a rectangle', () => {
    // A window under a roof slope: its head rises across its width. A reading
    // that returns one head height for it is wrong, and the honest answer is
    // to refuse — which is what a boundary that will not hold across the
    // opening does here.
    const raked = copy(base.raster)
    const x0 = Math.round(U(2.1))
    const x1 = Math.round(U(4.5))
    for (let u = x0; u <= x1; u += 1) {
      const head = V(2.5) - ((u - x0) / (x1 - x0)) * 0.8 * base.pxPerMV
      for (let v = Math.round(V(2.5)) - 1; v <= Math.round(head) + 1; v += 1) put(raked, u, v, 52)
      for (let v = Math.round(head) - 1; v < Math.round(V(2.5)); v += 1) put(raked, u, v, 52)
    }
    const extent = verticalOpeningExtent(raked, { from: U(2.1), to: U(4.5) }, STOREY)
    // Whatever comes back, it must not claim a crisp head: a sloping head is
    // not a drawn horizontal line, so the refinement cannot land on one.
    if (extent) expect(extent.fromRefined && extent.toRefined && extent.fromSigmaPx <= 0.3).toBe(false)
  })

  it('12. a correspondence that does not fit is refused rather than averaged', () => {
    const anchor = (id: string, x: number, u: number, sigma = 0.001): MetricAnchor => ({ id, pixel: { u, v: 500 }, metric: { x }, pixelSigma: 0.5, metricSigma: sigma, kind: 'WALL_FACE', evidenceIds: [], why: 'fixture' })
    const frame = registerOrthographic({
      id: 'bad',
      assetId: 'x',
      horizontalAxis: 'X',
      region: { x0: 0, y0: 0, x1: 1400, y1: 1000 },
      anchors: [
        anchor('h0', 0, 100),
        anchor('h1', 4, 580),
        // This one is paired with the wrong feature entirely: 7 m of building
        // at the pixel where 1 m of it is.
        anchor('h2', 7, 220),
        anchor('h3', 10, 1300),
        { ...anchor('v0', 0, 700), metric: { y: 0 }, pixel: { u: 700, v: 880 } },
        { ...anchor('v1', 0, 700), id: 'v1', metric: { y: 6.5 }, pixel: { u: 700, v: 100 } },
      ],
    })
    // The robust fit keeps the scale the other three agree on, and the bad
    // pairing is named as the one that does not fit.
    expect(frame.transform.kind).toBe('ORTHOGRAPHIC_AFFINE')
    expect(frame.status).not.toBe('METRIC_FRAME_VALID')
    const worst = [...frame.residuals].sort((a, b) => Math.abs(b.residualXM ?? 0) - Math.abs(a.residualXM ?? 0))[0]
    expect(worst.anchorId).toBe('h2')
  })
})
