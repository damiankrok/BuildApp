import { describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-cv'
import { drawingCharacter, measureVertical, registrationOverlay, silhouetteTop, verticalOpeningExtent } from '../src/index.js'
import { measureOpening, medianOf, paint, registerScene } from './scene.js'
import type { Opening, Painted, Scene } from './scene.js'

const near = (got: number, want: number, tol: number): void => expect(Math.abs(got - want), `${got} vs ${want}`).toBeLessThanOrEqual(tol)

/**
 * §20 A: a ten-metre facade with a 1.00 m door, a 2.40 m window and a 4.70 m
 * run of glazing. Budget: 0.03 m median on a clean raster, 0.08 m under
 * resizing and noise.
 */
const SCENE_A: Scene = {
  widthM: 10,
  heightM: 6.5,
  openings: [
    { id: 'door', x0: 0.6, x1: 1.6, y0: 0.35, y1: 2.45 },
    { id: 'window', x0: 2.1, x1: 4.5, y0: 1.1, y1: 2.5 },
    { id: 'glazing', x0: 5.0, x1: 9.7, y0: 1.0, y1: 3.3, mullions: 3 },
  ],
}

/** §20 C: a garage facade — a 2.75 m door beside a side door. */
const SCENE_C: Scene = {
  widthM: 7.4,
  heightM: 3.2,
  openings: [
    { id: 'garage', x0: 0.5, x1: 3.25, y0: 0.35, y1: 2.6 },
    { id: 'side-door', x0: 4.2, x1: 5.2, y0: 0.35, y1: 2.35 },
  ],
}

/** §20 B: a gable, whose apex is two rakes meeting and no rectilinear edge at all. */
const SCENE_B: Scene = {
  widthM: 8.4,
  heightM: 4.6,
  gableM: 2.6,
  openings: [
    { id: 'door', x0: 1.0, x1: 2.1, y0: 0.35, y1: 2.45 },
    { id: 'window', x0: 3.2, x1: 5.0, y0: 1.0, y1: 2.6 },
    { id: 'high-window', x0: 5.9, x1: 7.4, y0: 1.0, y1: 2.6 },
  ],
}

/** Deliberately sloppy: every proposal is a dozen pixels off, both ways. */
const SLOP = [9, -11, 7, -8]

type Errors = { widths: number[]; heights: number[]; sigmas: number[]; measured: number }

function run(scene: Scene, painted: Painted, searchPx = 22): Errors | null {
  const frame = registerScene(painted.raster, scene)
  if (!frame || frame.status === 'METRIC_FRAME_INVALID') return null
  const widths: number[] = []
  const heights: number[] = []
  const sigmas: number[] = []
  let measured = 0
  scene.openings.forEach((o: Opening, i) => {
    const U = (x: number): number => painted.originU + x * painted.pxPerMU
    const V = (y: number): number => painted.groundV - y * painted.pxPerMV
    const got = measureOpening(
      painted.raster,
      frame,
      o,
      { u0: U(o.x0) + SLOP[i % 4], u1: U(o.x1) + SLOP[(i + 1) % 4], v0: V(o.y0) + SLOP[(i + 2) % 4], v1: V(o.y1) + SLOP[(i + 3) % 4] },
      searchPx,
    )
    if (!got) return
    measured += 1
    widths.push(Math.abs(got.width.valueM - (o.x1 - o.x0)))
    heights.push(Math.abs(got.height.valueM - (o.y1 - o.y0)))
    sigmas.push(got.width.uncertaintyM)
  })
  return { widths, heights, sigmas, measured }
}

describe('§20 A: measuring a plain facade', () => {
  const painted = paint(SCENE_A, 120)

  it('registers it from two printed dimensions and nothing else', () => {
    const frame = registerScene(painted.raster, SCENE_A)
    expect(frame?.status).toBe('METRIC_FRAME_VALID')
    expect(frame!.transform.kind).toBe('ORTHOGRAPHIC_AFFINE')
    // 120 px to the metre, discovered rather than supplied.
    expect(frame!.uncertainty.metrePerPixelU).toBeCloseTo(1 / 120, 4)
    expect(frame!.metricResidualM).toBeLessThan(0.01)
  })

  it('measures every opening to within three centimetres', () => {
    const e = run(SCENE_A, painted)
    expect(e?.measured).toBe(3)
    expect(medianOf(e!.widths)).toBeLessThanOrEqual(0.03)
    expect(medianOf(e!.heights)).toBeLessThanOrEqual(0.03)
    expect(Math.max(...e!.widths)).toBeLessThanOrEqual(0.05)
  })

  it('§7: the mullions in the glazing do not narrow it', () => {
    // The run of glazing is drawn with three mullions across it. The opening
    // is the outer host cut, 4.70 m, and a measurement that stopped at the
    // first mullion would report 1.17 m.
    const e = run(SCENE_A, painted)
    expect(e!.widths[2]).toBeLessThanOrEqual(0.05)
  })

  it('§9: states an error bar that covers the error it actually made', () => {
    const e = run(SCENE_A, painted)
    e!.widths.forEach((err, i) => expect(err, `opening ${i}`).toBeLessThanOrEqual(e!.sigmas[i] * 3 + 0.02))
    // And it is a number the drawing produced. On a synthetic elevation
    // registered against exact dimensions the scale and registration terms are
    // genuinely zero, so every bar here is the two edges in quadrature — which
    // is what it should be, and is checked against the arithmetic rather than
    // against a constant somebody chose.
    e!.sigmas.forEach((sigma) => {
      expect(sigma).toBeGreaterThan(0)
      expect(sigma).toBeCloseTo(Math.hypot(0.25 / 120, 0.25 / 120), 4)
    })
  })
})

describe('§20 C: measuring a garage facade', () => {
  it('measures a 2.75 m door and the side door beside it', () => {
    const painted = paint(SCENE_C, 150)
    const e = run(SCENE_C, painted)
    expect(e?.measured).toBe(2)
    expect(medianOf(e!.widths)).toBeLessThanOrEqual(0.03)
  })
})

describe('§20 B: measuring a gabled facade', () => {
  it('registers on the eaves, which is where the rectilinear evidence is', () => {
    const painted = paint(SCENE_B, 130)
    const frame = registerScene(painted.raster, SCENE_B)
    expect(frame?.status).toBe('METRIC_FRAME_VALID')
    const e = run(SCENE_B, painted)
    expect(e?.measured).toBe(3)
    expect(medianOf(e!.widths)).toBeLessThanOrEqual(0.03)
  })
})

/**
 * §19, and mandatory. The same drawing at another size must measure the same
 * building — which is a statement about the whole chain, not just about
 * finding the outline.
 */
describe('§19: the same facade, resized and spoiled', () => {
  const grain = (r: Raster, amplitude: number): Raster => {
    const out: Raster = { width: r.width, height: r.height, data: new Uint8ClampedArray(r.data) }
    for (let i = 0; i < out.data.length; i += 4) {
      let h = (i * 2654435761) >>> 0
      h = (h ^ (h >>> 15)) >>> 0
      const n = Math.round(((h % 1000) / 1000 - 0.5) * amplitude)
      out.data[i] = out.data[i] + n
      out.data[i + 1] = out.data[i + 1] + n
      out.data[i + 2] = out.data[i + 2] + n
    }
    return out
  }

  for (const [label, pxPerM, squash] of [
    ['0.5x', 60, 1],
    ['1x', 120, 1],
    ['2x', 240, 1],
    ['anisotropic, 0.7 vertical', 120, 0.7],
    ['anisotropic, 1.3 vertical', 100, 1.3],
  ] as const) {
    it(`measures the same openings at ${label}`, () => {
      const painted = paint(SCENE_A, pxPerM, { squash })
      const e = run(SCENE_A, painted, Math.max(8, Math.round(22 * (pxPerM / 120))))
      expect(e, label).not.toBeNull()
      expect(e!.measured, label).toBe(3)
      expect(medianOf(e!.widths), label).toBeLessThanOrEqual(0.08)
      expect(medianOf(e!.heights), label).toBeLessThanOrEqual(0.08)
    })
  }

  it('measures the same openings with a margin cropped in', () => {
    const painted = paint(SCENE_A, 120, { margin: 20 })
    const e = run(SCENE_A, painted)
    expect(e!.measured).toBe(3)
    expect(medianOf(e!.widths)).toBeLessThanOrEqual(0.08)
  })

  it('refuses rather than registering the openings as the building', () => {
    // Past the point where the wall's own outline is below the noise, the
    // strongest rectilinear thing left in the picture is the openings, and a
    // registration fitted to those reports a scale six per cent wrong with
    // every appearance of confidence. Refusing is the only honest answer.
    const painted = paint(SCENE_A, 120)
    expect(registerScene(grain(painted.raster, 44), SCENE_A)).toBeNull()
  })

  it('measures the same openings through noise', () => {
    const painted = paint(SCENE_A, 120)
    const e = run(SCENE_A, { ...painted, raster: grain(painted.raster, 26) })
    expect(e).not.toBeNull()
    expect(e!.measured).toBe(3)
    expect(medianOf(e!.widths)).toBeLessThanOrEqual(0.08)
  })
})

/**
 * §15: a detector says about here; this says where. Measured against the wall
 * immediately either side, so the render's tone, light and reflections move
 * both strips together and only a hole moves one.
 */
describe('§15: how tall an opening is, measured against the wall beside it', () => {
  const painted = paint(SCENE_A, 120)
  const U = (x: number): number => painted.originU + x * painted.pxPerMU
  const V = (y: number): number => painted.groundV - y * painted.pxPerMV
  const storey = { from: V(6.4), to: V(0.05) }

  for (const o of SCENE_A.openings) {
    it(`measures the ${o.id} between its head and its sill`, () => {
      const got = verticalOpeningExtent(painted.raster, { from: U(o.x0), to: U(o.x1) }, storey)
      expect(got, o.id).not.toBeNull()
      // Within a pixel and a half of the rows the opening was drawn on.
      near(got!.fromPx, V(o.y1), 2)
      near(got!.toPx, V(o.y0), 2)
      expect(got!.fromRefined && got!.toRefined, o.id).toBe(true)
    })
  }

  it('§7: the mullions do not break the run of glazing into four openings', () => {
    const o = SCENE_A.openings[2]
    const got = verticalOpeningExtent(painted.raster, { from: U(o.x0), to: U(o.x1) }, storey)
    near(got!.toPx - got!.fromPx, (o.y1 - o.y0) * painted.pxPerMV, 3)
  })

  it('reports nothing over the pier between two windows', () => {
    // Half a metre of wall between a 2.4 m window and a 4.7 m run of glazing.
    // This is the case a generously sized reference strip gets wrong, by
    // reaching through the pier into the glazing and calling all three of them
    // one opening.
    expect(verticalOpeningExtent(painted.raster, { from: U(4.55), to: U(4.95) }, storey)).toBeNull()
  })

  it('turns into metres through the frame the drawing was registered with', () => {
    const frame = registerScene(painted.raster, SCENE_A)!
    const o = SCENE_A.openings[1]
    const got = verticalOpeningExtent(painted.raster, { from: U(o.x0), to: U(o.x1) }, storey)!
    const m = measureVertical(frame, { id: 'h', quantity: 'OPENING_HEIGHT', from: got.fromPx, to: got.toPx, fromSigmaPx: got.fromSigmaPx, toSigmaPx: got.toSigmaPx })
    expect(Math.abs(m.valueM - (o.y1 - o.y0))).toBeLessThanOrEqual(0.03)
  })

  it('is not fooled by a wall that is a different colour from its neighbour', () => {
    // A rendered panel beside a clad one differs all the way up. That is two
    // materials meeting, not a hole, and a rule that only looked at contrast
    // would report a six-metre window.
    const scene = paint(SCENE_A, 120)
    for (let v = 0; v < scene.raster.height; v += 1) {
      for (let u = Math.round(U(4.6)); u <= Math.round(U(4.95)); u += 1) {
        if (v < V(6.5) || v > V(0)) continue
        const i = (v * scene.raster.width + u) * 4
        scene.raster.data[i] = 150
        scene.raster.data[i + 1] = 150
        scene.raster.data[i + 2] = 150
      }
    }
    expect(verticalOpeningExtent(scene.raster, { from: U(4.6), to: U(4.95) }, storey)).toBeNull()
  })
})

/** §10: whether a drawing is a line drawing or a render, from the pixels. */
describe('§10: what kind of drawing this is', () => {
  /** A technical elevation: white paper, thin ink, and nothing else. */
  const lineDrawing = (): Raster => {
    const r: Raster = { width: 900, height: 600, data: new Uint8ClampedArray(900 * 600 * 4).fill(255) }
    const ink = (x0: number, y0: number, x1: number, y1: number): void => {
      for (let y = y0; y <= y1; y += 1) {
        for (let x = x0; x <= x1; x += 1) {
          if (x > x0 + 1 && x < x1 - 1 && y > y0 + 1 && y < y1 - 1) continue
          const i = (y * r.width + x) * 4
          r.data[i] = 20
          r.data[i + 1] = 20
          r.data[i + 2] = 20
        }
      }
    }
    ink(100, 90, 800, 520)
    ink(180, 180, 300, 320)
    ink(400, 180, 520, 320)
    ink(620, 240, 740, 520)
    return r
  }

  it('calls an elevation drawn as ink on paper a line drawing', () => {
    const got = drawingCharacter(lineDrawing())
    expect(got.kind).toBe('LINE_DRAWING')
    expect(got.flatShare).toBeGreaterThan(0.6)
    expect(got.tonesForHalf).toBe(1)
  })

  it('calls one drawn with a graded sky and a lit wall a render', () => {
    // Every tone in this one is a gradient, which is what a render is and
    // what a rectangle detector cannot be trusted on.
    const scene = paint(SCENE_A, 120)
    for (let y = 0; y < scene.raster.height; y += 1) {
      for (let x = 0; x < scene.raster.width; x += 1) {
        const i = (y * scene.raster.width + x) * 4
        const shade = Math.round((x / scene.raster.width) * 40 + (y / scene.raster.height) * 30)
        scene.raster.data[i] = Math.max(0, scene.raster.data[i] - shade)
        scene.raster.data[i + 1] = scene.raster.data[i]
        scene.raster.data[i + 2] = scene.raster.data[i]
      }
    }
    const got = drawingCharacter(scene.raster)
    expect(got.kind).toBe('RENDERED')
    expect(got.tonesForHalf).toBeGreaterThan(3)
  })

  it('says which it is in words a reader can check', () => {
    expect(drawingCharacter(lineDrawing()).why).toContain('ink on paper')
  })
})

/** The drawing's own top edge, which is what says which end of it is which. */
describe('the profile of a drawing', () => {
  it('follows a gable up to its apex and down again', () => {
    const painted = paint(SCENE_B, 130)
    const bounds = { x0: painted.originU, y0: 0, x1: painted.originU + SCENE_B.widthM * painted.pxPerMU, y1: painted.groundV }
    const top = silhouetteTop(painted.raster, bounds)
    const at = (x: number): number | null => top[Math.round(x * painted.pxPerMU)]
    const height = (x: number): number => {
      const row = at(x)
      return row === null || row === undefined ? Number.NaN : (painted.groundV - row) / painted.pxPerMV
    }
    // The eaves at each end, the apex in the middle.
    near(height(0.3), SCENE_B.heightM, 0.25)
    near(height(SCENE_B.widthM / 2), SCENE_B.heightM + (SCENE_B.gableM ?? 0), 0.25)
    near(height(SCENE_B.widthM - 0.3), SCENE_B.heightM, 0.25)
  })

  it('tells a building from its own mirror image', () => {
    // Two masses of different heights: the profile says which end is which,
    // where the openings on such a facade cannot.
    const scene: Scene = { widthM: 12, heightM: 6.4, openings: [{ id: 'w', x0: 1, x1: 2.4, y0: 1, y1: 2.6 }] }
    const painted = paint(scene, 100)
    // Knock the right-hand third down to a low flat-roofed block.
    for (let v = 0; v < painted.raster.height; v += 1) {
      for (let u = Math.round(painted.originU + 8 * painted.pxPerMU); u < painted.originU + 12 * painted.pxPerMU; u += 1) {
        if (v > painted.groundV - 3.0 * painted.pxPerMV) continue
        const i = (v * painted.raster.width + u) * 4
        painted.raster.data[i] = 250
        painted.raster.data[i + 1] = 250
        painted.raster.data[i + 2] = 250
      }
    }
    const bounds = { x0: painted.originU, y0: 0, x1: painted.originU + 12 * painted.pxPerMU, y1: painted.groundV }
    const top = silhouetteTop(painted.raster, bounds)
    const height = (x: number): number => {
      const row = top[Math.round(x * painted.pxPerMU)]
      return row === null || row === undefined ? 0 : (painted.groundV - row) / painted.pxPerMV
    }
    expect(height(2)).toBeGreaterThan(5.5)
    expect(height(10)).toBeLessThan(3.5)
    expect(height(10)).toBeGreaterThan(2.5)
  })
})

/** §22: the picture with everything the registration believes drawn on it. */
describe('§22: the overlay', () => {
  const painted = paint(SCENE_A, 120)
  const frame = registerScene(painted.raster, SCENE_A)!

  it('draws every anchor, its residual and which one was held back', () => {
    const svg = registrationOverlay(frame, { width: painted.raster.width, height: painted.raster.height })
    for (const anchor of frame.anchors) expect(svg, anchor.id).toContain(anchor.id)
    expect(svg).toContain('mm/px')
    expect(svg).toContain(frame.status)
  })

  it('rules a metric grid across the drawing in its own metres', () => {
    const svg = registrationOverlay(frame, { width: painted.raster.width, height: painted.raster.height, gridM: 1 })
    expect(svg).toContain('grid 1 m')
    // One line per metre across a 10 m facade and up a 6.5 m wall, at least.
    expect(svg.split('<line').length).toBeGreaterThan(16)
  })

  it('draws each measurement where it was read, with its error bar', () => {
    const o = SCENE_A.openings[1]
    const U = (x: number): number => painted.originU + x * painted.pxPerMU
    const V = (y: number): number => painted.groundV - y * painted.pxPerMV
    const got = measureOpening(painted.raster, frame, o, { u0: U(o.x0), u1: U(o.x1), v0: V(o.y0), v1: V(o.y1) }, 14)!
    const svg = registrationOverlay(frame, { width: painted.raster.width, height: painted.raster.height, measurements: [got.width, got.height] })
    expect(svg).toContain(`${got.width.valueM.toFixed(3)} ± ${got.width.uncertaintyM.toFixed(3)} m`)
    expect(svg).toContain('OPENING_WIDTH')
  })

  it('is a self-contained SVG with the drawing embedded', () => {
    const svg = registrationOverlay(frame, { width: 10, height: 10, imageHref: 'data:image/png;base64,AAAA' })
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true)
    expect(svg).toContain('data:image/png;base64,AAAA')
  })
})
