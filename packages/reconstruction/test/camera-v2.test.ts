/**
 * The v2 perspective camera, held to a synthetic render whose camera is known.
 *
 * A house with a gable roof and a flat-roofed garage is rasterised through a
 * known projection into flat colours — white walls, a dark roof, a grey
 * garage top, a blue sky and a green lawn where the ground plane lies — and
 * the solver has to find the camera back from the picture alone.
 */
import { describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-cv'
import { nearer, projectPoint, solvePerspectiveCamera } from '../src/v2/camera.js'
import type { EnvelopeForCamera } from '../src/v2/camera.js'

type Vec3 = { x: number; y: number; z: number }
type Rgb = [number, number, number]
type Camera = { position: Vec3; lookAt: Vec3; focalPx: number; width: number; height: number }

const HOUSE: EnvelopeForCamera = {
  x0: 0,
  x1: 9.6,
  z0: 0,
  z1: 10.8,
  eaveY: 5.4,
  ridgeY: 7.5,
  ridgeAxis: 'X',
  ridgeAt: 3.6,
  groundY: 0,
  // a garage behind the main body, lower than its eaves
  attached: [{ x0: 3.6, x1: 9.6, z0: 7.2, z1: 10.8, topY: 2.9 }],
}
const MAIN = { x0: 0, x1: 9.6, z0: 0, z1: 7.2 }

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x })
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z
const normalize = (a: Vec3): Vec3 => {
  const n = Math.hypot(a.x, a.y, a.z)
  return { x: a.x / n, y: a.y / n, z: a.z / n }
}

/** P = K [R | -RC], y up in the world, v down in the picture, principal point at the centre. */
function projectionOf(cam: Camera): number[] {
  const forward = normalize(sub(cam.lookAt, cam.position))
  const right = normalize(cross({ x: 0, y: 1, z: 0 }, forward))
  const up = cross(forward, right)
  const f = cam.focalPx
  const cu = cam.width / 2
  const cv = cam.height / 2
  const t = { x: -dot(right, cam.position), y: -dot(up, cam.position), z: -dot(forward, cam.position) }
  return [
    f * right.x + cu * forward.x, f * right.y + cu * forward.y, f * right.z + cu * forward.z, f * t.x + cu * t.z,
    -f * up.x + cv * forward.x, -f * up.y + cv * forward.y, -f * up.z + cv * forward.z, -f * t.y + cv * t.z,
    forward.x, forward.y, forward.z, t.z,
  ]
}

const project = (p: readonly number[], w: Vec3): { u: number; v: number; s: number } => {
  const s = p[8] * w.x + p[9] * w.y + p[10] * w.z + p[11]
  return { u: (p[0] * w.x + p[1] * w.y + p[2] * w.z + p[3]) / s, v: (p[4] * w.x + p[5] * w.y + p[6] * w.z + p[7]) / s, s }
}

/** For a plane, 1/depth is affine in (u, v); fit it from three points on the plane. */
function inverseDepthPlane(p: readonly number[], a: Vec3, b: Vec3, c: Vec3): (u: number, v: number) => number {
  const pa = project(p, a)
  const pb = project(p, b)
  const pc = project(p, c)
  const det = (pb.u - pa.u) * (pc.v - pa.v) - (pc.u - pa.u) * (pb.v - pa.v)
  const ia = 1 / pa.s
  const ib = 1 / pb.s
  const ic = 1 / pc.s
  const gu = ((ib - ia) * (pc.v - pa.v) - (ic - ia) * (pb.v - pa.v)) / det
  const gv = ((ic - ia) * (pb.u - pa.u) - (ib - ia) * (pc.u - pa.u)) / det
  return (u, v) => ia + gu * (u - pa.u) + gv * (v - pa.v)
}

type Face = { vertices: Vec3[]; colour: Rgb }

function housefaces(): Face[] {
  const g = HOUSE.groundY
  const e = HOUSE.eaveY
  const r = HOUSE.ridgeY
  const { x0, x1, z0, z1 } = MAIN
  const zr = HOUSE.ridgeAt
  const wall: Rgb = [242, 240, 232]
  const wallShade: Rgb = [214, 210, 200]
  const roof: Rgb = [70, 58, 52]
  const faces: Face[] = [
    { vertices: [{ x: x0, y: g, z: z0 }, { x: x1, y: g, z: z0 }, { x: x1, y: e, z: z0 }, { x: x0, y: e, z: z0 }], colour: wall },
    { vertices: [{ x: x0, y: g, z: z1 }, { x: x1, y: g, z: z1 }, { x: x1, y: e, z: z1 }, { x: x0, y: e, z: z1 }], colour: wall },
    { vertices: [{ x: x0, y: g, z: z0 }, { x: x0, y: g, z: z1 }, { x: x0, y: e, z: z1 }, { x: x0, y: r, z: zr }, { x: x0, y: e, z: z0 }], colour: wallShade },
    { vertices: [{ x: x1, y: g, z: z0 }, { x: x1, y: g, z: z1 }, { x: x1, y: e, z: z1 }, { x: x1, y: r, z: zr }, { x: x1, y: e, z: z0 }], colour: wallShade },
    { vertices: [{ x: x0, y: e, z: z0 }, { x: x1, y: e, z: z0 }, { x: x1, y: r, z: zr }, { x: x0, y: r, z: zr }], colour: roof },
    { vertices: [{ x: x0, y: e, z: z1 }, { x: x1, y: e, z: z1 }, { x: x1, y: r, z: zr }, { x: x0, y: r, z: zr }], colour: roof },
  ]
  for (const box of HOUSE.attached ?? []) {
    const top = box.topY
    const c = [{ x: box.x0, z: box.z0 }, { x: box.x1, z: box.z0 }, { x: box.x1, z: box.z1 }, { x: box.x0, z: box.z1 }]
    for (let k = 0; k < 4; k += 1) {
      const a = c[k]
      const b = c[(k + 1) % 4]
      faces.push({ vertices: [{ x: a.x, y: g, z: a.z }, { x: b.x, y: g, z: b.z }, { x: b.x, y: top, z: b.z }, { x: a.x, y: top, z: a.z }], colour: k % 2 === 0 ? wall : wallShade })
    }
    faces.push({ vertices: c.map((q) => ({ x: q.x, y: top, z: q.z })), colour: [150, 150, 150] })
  }
  return faces
}

/** A z-buffered flat-colour render: sky, then the lawn where the ground plane is, then every face nearer than what is already there. */
function render(cam: Camera): Raster {
  const p = projectionOf(cam)
  const { width, height } = cam
  const data = new Uint8ClampedArray(width * height * 4)
  const zbuf = new Float64Array(width * height).fill(0)
  const paint = (i: number, c: Rgb): void => {
    data[i * 4] = c[0]
    data[i * 4 + 1] = c[1]
    data[i * 4 + 2] = c[2]
    data[i * 4 + 3] = 255
  }
  const sky: Rgb = [150, 190, 240]
  const lawn: Rgb = [95, 165, 75]
  const g = HOUSE.groundY
  const ground = inverseDepthPlane(p, { x: 0, y: g, z: 0 }, { x: 1, y: g, z: 0 }, { x: 0, y: g, z: 1 })
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x
      const inv = ground(x + 0.5, y + 0.5)
      if (inv > 0) {
        zbuf[i] = inv
        paint(i, lawn)
      } else paint(i, sky)
    }
  }
  for (const face of housefaces()) {
    const poly = face.vertices.map((v) => project(p, v))
    if (poly.some((q) => q.s <= 0)) throw new Error('a face is behind the test camera')
    const inv = inverseDepthPlane(p, face.vertices[0], face.vertices[1], face.vertices[2])
    const minV = Math.min(...poly.map((q) => q.v))
    const maxV = Math.max(...poly.map((q) => q.v))
    for (let y = Math.max(0, Math.floor(minV - 0.5)); y <= Math.min(height - 1, Math.ceil(maxV)); y += 1) {
      const yc = y + 0.5
      const xs: number[] = []
      for (let k = 0; k < poly.length; k += 1) {
        const a = poly[k]
        const b = poly[(k + 1) % poly.length]
        if (a.v <= yc === b.v <= yc) continue
        xs.push(a.u + ((yc - a.v) * (b.u - a.u)) / (b.v - a.v))
      }
      xs.sort((q, r) => q - r)
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.max(0, Math.ceil(xs[k] - 0.5)); x <= Math.min(width - 1, Math.ceil(xs[k + 1] - 0.5) - 1); x += 1) {
          const i = y * width + x
          const d = inv(x + 0.5, y + 0.5)
          if (d > zbuf[i]) {
            zbuf[i] = d
            paint(i, face.colour)
          }
        }
      }
    }
  }
  return { width, height, data }
}

/** Every corner the envelope names, main body and garage alike. */
function worldCorners(): Vec3[] {
  const out: Vec3[] = []
  for (const x of [MAIN.x0, MAIN.x1]) for (const z of [MAIN.z0, MAIN.z1]) for (const y of [HOUSE.groundY, HOUSE.eaveY]) out.push({ x, y, z })
  for (const x of [MAIN.x0, MAIN.x1]) out.push({ x, y: HOUSE.ridgeY, z: HOUSE.ridgeAt })
  for (const box of HOUSE.attached ?? []) for (const x of [box.x0, box.x1]) for (const z of [box.z0, box.z1]) for (const y of [HOUSE.groundY, box.topY]) out.push({ x, y, z })
  return out
}

const VIEWS: Array<{ name: string; cam: Camera; sides: string[]; near: Vec3; far: Vec3 }> = [
  {
    name: 'front-left three-quarter',
    cam: { position: { x: -9, y: 2.2, z: -11 }, lookAt: { x: 4.8, y: 3, z: 4 }, focalPx: 900, width: 800, height: 500 },
    sides: ['FRONT', 'LEFT'],
    near: { x: 0, y: 0, z: 0 },
    far: { x: 9.6, y: 0, z: 7.2 },
  },
  {
    name: 'rear-right',
    cam: { position: { x: 18, y: 3.5, z: 20 }, lookAt: { x: 5.5, y: 3, z: 5 }, focalPx: 950, width: 800, height: 500 },
    sides: ['REAR', 'RIGHT'],
    near: { x: 9.6, y: 0, z: 10.8 },
    far: { x: 0, y: 0, z: 0 },
  },
  {
    name: 'high front',
    cam: { position: { x: -5, y: 10, z: -14 }, lookAt: { x: 4.8, y: 2.5, z: 3.6 }, focalPx: 1000, width: 800, height: 500 },
    sides: ['FRONT', 'LEFT'],
    near: { x: 0, y: 5.4, z: 0 },
    far: { x: 9.6, y: 5.4, z: 7.2 },
  },
]

describe('solvePerspectiveCamera on a synthetic render', () => {
  for (const view of VIEWS) {
    it(`recovers the ${view.name} camera from the silhouette`, () => {
      const raster = render(view.cam)
      const truth = projectionOf(view.cam)
      const camera = solvePerspectiveCamera(raster, `frame-${view.name}`, HOUSE)
      expect(camera, view.name).not.toBeNull()
      if (!camera) return

      expect(camera.frameId).toBe(`frame-${view.name}`)
      expect(camera.anchors.length).toBeGreaterThanOrEqual(6)
      expect(camera.residualPx.rms).toBeLessThan(2)
      expect([...camera.visibleSides].sort()).toEqual([...view.sides].sort())

      // every corner the envelope names, seen or hidden, lands where the true camera puts it
      for (const corner of worldCorners()) {
        const expected = project(truth, corner)
        const got = projectPoint(camera, corner)
        expect(got, `${view.name}: corner (${corner.x}, ${corner.y}, ${corner.z})`).not.toBeNull()
        if (!got) continue
        expect(Math.hypot(got.u - expected.u, got.v - expected.v), `${view.name}: corner (${corner.x}, ${corner.y}, ${corner.z})`).toBeLessThan(3)
      }

      // and the camera itself is where it was
      const c = camera.solution.centre
      const range = Math.hypot(view.cam.position.x - view.cam.lookAt.x, view.cam.position.y - view.cam.lookAt.y, view.cam.position.z - view.cam.lookAt.z)
      expect(Math.hypot(c.x - view.cam.position.x, c.y - view.cam.position.y, c.z - view.cam.position.z)).toBeLessThan(0.1 * range)

      // depth order
      expect(nearer(camera, view.near, view.far)).toBe(true)
      expect(nearer(camera, view.far, view.near)).toBe(false)

      expect(camera.confidence).toBeGreaterThan(0.5)
      expect(camera.why).toContain('IoU')
    })
  }

  it('names the corners it used, and finds the garage where the view shows it', () => {
    const rear = VIEWS[1]
    const camera = solvePerspectiveCamera(render(rear.cam), 'frame-rear', HOUSE)
    expect(camera).not.toBeNull()
    if (!camera) return
    const kinds = new Set(camera.anchors.map((a) => a.kind))
    expect(kinds.has('GROUND_CORNER')).toBe(true)
    expect(kinds.has('EAVE_CORNER')).toBe(true)
    expect(kinds.has('GABLE_APEX') || kinds.has('RIDGE_END')).toBe(true)
    expect(kinds.has('ATTACHED_TOP_CORNER')).toBe(true)
    for (const anchor of camera.anchors) {
      expect(anchor.confidence).toBeGreaterThan(0)
      expect(anchor.why.length).toBeGreaterThan(0)
    }
    // the ridge end on the visible right gable is its apex; the other is the far end of the ridge
    const apex = camera.anchors.find((a) => a.id === 'ridge:x1')
    if (apex) expect(apex.kind).toBe('GABLE_APEX')
    const farEnd = camera.anchors.find((a) => a.id === 'ridge:x0')
    if (farEnd) expect(farEnd.kind).toBe('RIDGE_END')
  })

  it('is deterministic', () => {
    const raster = render(VIEWS[0].cam)
    const a = solvePerspectiveCamera(raster, 'frame-a', HOUSE)
    const b = solvePerspectiveCamera(raster, 'frame-a', HOUSE)
    expect(a).toEqual(b)
  })

  it('returns null on a blank raster', () => {
    const white: Raster = { width: 320, height: 200, data: new Uint8ClampedArray(320 * 200 * 4).fill(255) }
    expect(solvePerspectiveCamera(white, 'frame-blank', HOUSE)).toBeNull()
    const black: Raster = { width: 320, height: 200, data: new Uint8ClampedArray(320 * 200 * 4) }
    for (let i = 3; i < black.data.length; i += 4) black.data[i] = 255
    expect(solvePerspectiveCamera(black, 'frame-dark', HOUSE)).toBeNull()
  })

  it('projects nothing that is behind the camera', () => {
    const view = VIEWS[0]
    const camera = solvePerspectiveCamera(render(view.cam), 'frame-behind', HOUSE)
    expect(camera).not.toBeNull()
    if (!camera) return
    expect(projectPoint(camera, { x: -30, y: 2, z: -30 })).toBeNull()
    expect(nearer(camera, { x: -30, y: 2, z: -30 }, { x: 0, y: 0, z: 0 })).toBe(false)
  })
})
