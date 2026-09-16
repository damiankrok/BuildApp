import { describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-cv'
import { architecturalBounds, gradientThreshold, refineEdge } from '../src/index.js'

/** White paper. */
function paper(width: number, height: number): Raster {
  const data = new Uint8ClampedArray(width * height * 4).fill(255)
  return { width, height, data }
}

function fill(r: Raster, x0: number, y0: number, x1: number, y1: number, v: number): Raster {
  for (let y = Math.max(0, Math.round(y0)); y <= Math.min(r.height - 1, Math.round(y1)); y += 1) {
    for (let x = Math.max(0, Math.round(x0)); x <= Math.min(r.width - 1, Math.round(x1)); x += 1) {
      const i = (y * r.width + x) * 4
      r.data[i] = v
      r.data[i + 1] = v
      r.data[i + 2] = v
    }
  }
  return r
}

/** A deterministic hash, so a "random" texture is the same texture every run. */
const noiseAt = (x: number, y: number, salt: number): number => {
  let h = (x * 374761393 + y * 668265263 + salt * 2246822519) >>> 0
  h = (h ^ (h >>> 13)) >>> 0
  h = Math.imul(h, 1274126177) >>> 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

/** Bilinear resize, so the same scene can be asked for at another size. */
function resize(r: Raster, width: number, height: number): Raster {
  const out = paper(width, height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(r.width - 1.001, ((x + 0.5) * r.width) / width - 0.5)
      const sy = Math.min(r.height - 1.001, ((y + 0.5) * r.height) / height - 0.5)
      const x0 = Math.max(0, Math.floor(sx))
      const y0 = Math.max(0, Math.floor(sy))
      const fx = sx - x0
      const fy = sy - y0
      const at = (px: number, py: number): number => r.data[(py * r.width + Math.min(r.width - 1, px)) * 4]
      const v =
        at(x0, y0) * (1 - fx) * (1 - fy) + at(x0 + 1, y0) * fx * (1 - fy) + at(x0, Math.min(r.height - 1, y0 + 1)) * (1 - fx) * fy + at(x0 + 1, Math.min(r.height - 1, y0 + 1)) * fx * fy
      const i = (y * width + x) * 4
      out.data[i] = v
      out.data[i + 1] = v
      out.data[i + 2] = v
    }
  }
  return out
}

/**
 * A plain elevation: a body, a darker plinth, two windows and a door, on
 * paper. Its architectural extent is exactly BODY, which is what every
 * assertion below is measured against.
 */
const BODY = { x0: 200, y0: 120, x1: 800, y1: 500 }
function elevation(width = 1000, height = 600): Raster {
  const r = paper(width, height)
  fill(r, BODY.x0, BODY.y0, BODY.x1, BODY.y1, 210)
  fill(r, BODY.x0, 470, BODY.x1, BODY.y1, 120)
  fill(r, 280, 200, 400, 320, 60)
  fill(r, 560, 200, 680, 320, 60)
  fill(r, 430, 330, 520, 470, 40)
  return r
}

/** Foliage: high contrast, plenty of it, and straight nowhere. */
function trees(r: Raster, x0: number, x1: number, salt: number): Raster {
  for (let y = 60; y < r.height - 40; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      if (noiseAt(x >> 1, y >> 1, salt) > 0.45) continue
      const i = (y * r.width + x) * 4
      const v = 40 + Math.round(noiseAt(x, y, salt + 1) * 90)
      r.data[i] = v
      r.data[i + 1] = v
      r.data[i + 2] = v
    }
  }
  return r
}

const near = (got: number, want: number, tol: number): void => expect(Math.abs(got - want), `${got} vs ${want}`).toBeLessThanOrEqual(tol)

describe('finding the building in the picture', () => {
  it('reports the body of a plain elevation', () => {
    const b = architecturalBounds(elevation())
    expect(b).not.toBeNull()
    near(b!.rect.x0, BODY.x0, 2)
    near(b!.rect.y0, BODY.y0, 2)
    near(b!.rect.x1, BODY.x1, 2)
    near(b!.rect.y1, BODY.y1, 2)
  })

  it('is not moved by trees either side of it', () => {
    const scene = elevation()
    trees(scene, 20, 190, 7)
    trees(scene, 815, 980, 11)
    const b = architecturalBounds(scene)
    expect(b).not.toBeNull()
    // The foliage carries as much gradient as the walls do and more of it, so
    // this is the assertion the whole module exists for.
    near(b!.rect.x0, BODY.x0, 3)
    near(b!.rect.x1, BODY.x1, 3)
  })

  it('drops a watermark standing clear of the building', () => {
    // Drawn the way a real one is: lettering. Every stroke of it is straight
    // and some are hard-drawn, but a letterform is short and the gaps between
    // strokes are most of its height, so nothing in it runs.
    const scene = elevation()
    for (let i = 0; i < 5; i += 1) {
      for (const [a, b2] of [[250, 300], [330, 370], [395, 430]] as const) fill(scene, 890 + i * 18, a, 897 + i * 18, b2, 70)
    }
    const b = architecturalBounds(scene)
    near(b!.rect.x1, BODY.x1, 3)
  })

  it('keeps a solid outbuilding standing clear of the building', () => {
    // The other side of that, and worth stating because it is a limit rather
    // than a success: nothing here can tell a detached opaque wall-sized block
    // from a building, and nothing should. Quietly cropping it off would be
    // the failure this module exists to prevent, so a rule that dropped the
    // watermark by its distance or its weight would be the wrong rule.
    const scene = elevation()
    fill(scene, 880, 260, 960, 500, 90)
    const b = architecturalBounds(scene)
    near(b!.rect.x1, 960, 3)
  })

  it('ignores where the ground line leaves the picture, but not its height', () => {
    const scene = elevation()
    fill(scene, 0, 520, scene.width - 1, 523, 150)
    const b = architecturalBounds(scene)
    // The ground line runs frame to frame; its ends are the crop, not the
    // building, so they must not widen the answer.
    near(b!.rect.x0, BODY.x0, 3)
    near(b!.rect.x1, BODY.x1, 3)
    // Its own height is honest evidence, and it is below the plinth.
    expect(b!.rect.y1).toBeGreaterThanOrEqual(519)
  })

  it('finds nothing to measure in a blank sheet', () => {
    expect(architecturalBounds(paper(400, 300))).toBeNull()
  })

  it('is deterministic', () => {
    expect(JSON.stringify(architecturalBounds(elevation()))).toBe(JSON.stringify(architecturalBounds(elevation())))
  })
})

/**
 * §19. The same drawing at another size must measure the same building. This
 * is the test that caught a fixed gradient threshold sitting below the noise
 * floor: at 0.43x the noise joined foliage into apparently continuous columns
 * and the reported building was the treeline.
 */
describe('the same drawing at another size', () => {
  const scene = elevation()
  trees(scene, 20, 190, 7)
  trees(scene, 815, 980, 11)
  const truth = { x0: BODY.x0 / 1000, y0: BODY.y0 / 600, x1: BODY.x1 / 1000, y1: BODY.y1 / 600 }

  for (const [label, w, h, tol] of [
    ['0.5x', 500, 300, 0.01],
    ['1x', 1000, 600, 0.005],
    ['2x', 2000, 1200, 0.005],
    ['anisotropic 1.6 x 0.7', 1600, 420, 0.012],
    ['squashed to a thumbnail', 320, 192, 0.02],
  ] as const) {
    it(`measures the same building at ${label}`, () => {
      const b = architecturalBounds(resize(scene, w, h))
      expect(b, label).not.toBeNull()
      near(b!.rect.x0 / w, truth.x0, tol)
      near(b!.rect.y0 / h, truth.y0, tol)
      near(b!.rect.x1 / w, truth.x1, tol)
      near(b!.rect.y1 / h, truth.y1, tol)
    })
  }

  it('measures the same building through a crop with margins', () => {
    const crop = paper(1200, 800)
    for (let y = 0; y < 600; y += 1) for (let x = 0; x < 1000; x += 1) {
      const s = (y * 1000 + x) * 4
      const d = ((y + 100) * 1200 + x + 100) * 4
      crop.data[d] = scene.data[s]
      crop.data[d + 1] = scene.data[s + 1]
      crop.data[d + 2] = scene.data[s + 2]
    }
    const b = architecturalBounds(crop)
    near(b!.rect.x0, BODY.x0 + 100, 3)
    near(b!.rect.x1, BODY.x1 + 100, 3)
  })
})

describe('what counts as an edge in this picture', () => {
  it('falls back to the floor on a noiseless drawing', () => {
    expect(gradientThreshold(elevation())).toBe(10)
  })

  it('rises above the noise when there is noise', () => {
    const grainy = elevation()
    for (let i = 0; i < grainy.data.length; i += 4) {
      const v = grainy.data[i] + Math.round((noiseAt(i, 3, 5) - 0.5) * 30)
      grainy.data[i] = v
      grainy.data[i + 1] = v
      grainy.data[i + 2] = v
    }
    expect(gradientThreshold(grainy)).toBeGreaterThan(12)
  })

  it('still finds the building through that noise', () => {
    const grainy = elevation()
    for (let i = 0; i < grainy.data.length; i += 4) {
      const v = grainy.data[i] + Math.round((noiseAt(i, 3, 5) - 0.5) * 30)
      grainy.data[i] = v
      grainy.data[i + 1] = v
      grainy.data[i + 2] = v
    }
    const b = architecturalBounds(grainy)
    near(b!.rect.x0, BODY.x0, 3)
    near(b!.rect.x1, BODY.x1, 3)
  })
})

/** §6: a proposal says "about here"; this says where, to a fraction of a pixel. */
describe('refining an edge to sub-pixel', () => {
  it('finds a wall the proposal missed by twenty pixels', () => {
    const e = refineEdge(elevation(), { axis: 'VERTICAL', nearPx: BODY.x0 + 20, searchPx: 30, within: { from: BODY.y0, to: BODY.y1 } })
    expect(e).not.toBeNull()
    near(e!.atPx, BODY.x0, 1)
    expect(e!.sigmaPx).toBeLessThanOrEqual(1)
  })

  it('places an edge drawn between two pixels between those two pixels', () => {
    // A half-covered column: the true edge is at 299.5, and rounding to the
    // nearest whole pixel would cost half a pixel for nothing.
    const r = paper(600, 400)
    fill(r, 300, 50, 500, 350, 40)
    for (let y = 50; y <= 350; y += 1) {
      const i = (y * 600 + 299) * 4
      r.data[i] = 148
      r.data[i + 1] = 148
      r.data[i + 2] = 148
    }
    const e = refineEdge(r, { axis: 'VERTICAL', nearPx: 302, searchPx: 8, within: { from: 50, to: 350 } })
    expect(e).not.toBeNull()
    expect(e!.atPx).toBeGreaterThan(298.6)
    expect(e!.atPx).toBeLessThan(300.4)
  })

  it('prefers the long wall to the short shadow beside it', () => {
    const r = paper(600, 400)
    fill(r, 300, 50, 500, 350, 40)
    fill(r, 292, 150, 294, 200, 90)
    const e = refineEdge(r, { axis: 'VERTICAL', nearPx: 293, searchPx: 12, within: { from: 50, to: 350 } })
    near(e!.atPx, 300, 1.5)
  })

  it('reports nothing rather than guessing when there is no edge to find', () => {
    expect(refineEdge(paper(400, 300), { axis: 'VERTICAL', nearPx: 200, searchPx: 20 })).toBeNull()
  })
})
