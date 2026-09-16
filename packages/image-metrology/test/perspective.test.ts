import { describe, expect, it } from 'vitest'
import { applyHomography, fitHomography, fitHomographyRobust, heightByCrossRatio, planarity, projectThrough, registerPerspectivePlane, solveCamera, vanishingPoint } from '../src/index.js'
import type { PlaneCorrespondence, WorldCorrespondence } from '../src/index.js'

/**
 * §20 D. A known camera, a known building, and the picture it would take.
 *
 * Everything below is measured against geometry stated here in metres and
 * projected through a camera stated here in pixels, so every error is the
 * solver's and none of it is the fixture's.
 */
const CAMERA = {
  focal: 900,
  principal: { u: 640, v: 400 },
  // Standing off to one side and a little above, looking back at the facade.
  eye: { x: -6, y: 2.4, z: -9 },
  target: { x: 5, y: 2.5, z: 0 },
}

const sub = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const cross = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x })
const unit = (a: { x: number; y: number; z: number }) => {
  const n = Math.hypot(a.x, a.y, a.z)
  return { x: a.x / n, y: a.y / n, z: a.z / n }
}
const forward = unit(sub(CAMERA.target, CAMERA.eye))
const right = unit(cross(forward, { x: 0, y: 1, z: 0 }))
const up = cross(right, forward)

/** The picture this camera takes of a point in the world. */
function shoot(w: { x: number; y: number; z: number }): { u: number; v: number } {
  const d = sub(w, CAMERA.eye)
  const z = d.x * forward.x + d.y * forward.y + d.z * forward.z
  const x = d.x * right.x + d.y * right.y + d.z * right.z
  const y = d.x * up.x + d.y * up.y + d.z * up.z
  return { u: CAMERA.principal.u + (CAMERA.focal * x) / z, v: CAMERA.principal.v - (CAMERA.focal * y) / z }
}

/** The facade is the plane z = 0: along it is world x, up it is world y. */
const onFacade = (id: string, x: number, y: number): PlaneCorrespondence => ({ id, pixel: shoot({ x, y, z: 0 }), metric: { x, y } })

/** §20 A's facade, photographed: 1.00 m door, 2.40 m window, 4.70 m glazing. */
const FACADE = { widthM: 10, heightM: 6.5 }
const OPENINGS = [
  { id: 'door', x0: 0.6, x1: 1.6, y0: 0.35, y1: 2.45 },
  { id: 'window', x0: 2.1, x1: 4.5, y0: 1.1, y1: 2.5 },
  { id: 'glazing', x0: 5.0, x1: 9.7, y0: 1.0, y1: 3.3 },
]

describe('§11A: a facade seen at an angle', () => {
  const corners: PlaneCorrespondence[] = [onFacade('c0', 0, 0), onFacade('c1', FACADE.widthM, 0), onFacade('c2', FACADE.widthM, FACADE.heightM), onFacade('c3', 0, FACADE.heightM)]

  it('recovers the plane from its four corners', () => {
    const h = fitHomography(corners)
    expect(h).not.toBeNull()
    // A point the fit never saw: the middle of the wall.
    const got = applyHomography(h!, shoot({ x: 5, y: 3, z: 0 }).u, shoot({ x: 5, y: 3, z: 0 }).v)
    expect(got.x).toBeCloseTo(5, 4)
    expect(got.y).toBeCloseTo(3, 4)
  })

  it('measures an opening on it, in metres, from pixels alone', () => {
    const frame = registerPerspectivePlane({
      id: 'p', assetId: 'photo', horizontalAxis: 'X',
      region: { x0: 0, y0: 0, x1: 1280, y1: 800 },
      correspondences: corners,
    })
    expect(frame.status).toBe('METRIC_FRAME_VALID')
    expect(frame.transform.kind).toBe('PLANAR_HOMOGRAPHY')
    for (const o of OPENINGS) {
      // Both jambs, mapped through the plane and subtracted — never a pixel
      // length multiplied by a scale, which a perspective view does not have.
      const left = applyHomography((frame.transform as { h: number[] }).h, shoot({ x: o.x0, y: (o.y0 + o.y1) / 2, z: 0 }).u, shoot({ x: o.x0, y: (o.y0 + o.y1) / 2, z: 0 }).v)
      const rightEdge = applyHomography((frame.transform as { h: number[] }).h, shoot({ x: o.x1, y: (o.y0 + o.y1) / 2, z: 0 }).u, shoot({ x: o.x1, y: (o.y0 + o.y1) / 2, z: 0 }).v)
      // §20's budget for a homography is 0.08 m.
      expect(Math.abs(rightEdge.x - left.x - (o.x1 - o.x0)), o.id).toBeLessThanOrEqual(0.08)
    }
  })

  it('refuses when no one plane explains the points', () => {
    // Half of these are on the facade and half are on a wall at right angles
    // to it, labelled as though they were all on one.
    const mixed: PlaneCorrespondence[] = [
      onFacade('a', 0, 0),
      onFacade('b', 4, 0),
      onFacade('c', 4, 4),
      onFacade('d', 0, 4),
      { id: 'e', pixel: shoot({ x: 10, y: 0, z: 4 }), metric: { x: 10, y: 0 } },
      { id: 'f', pixel: shoot({ x: 10, y: 3, z: 6 }), metric: { x: 10, y: 3 } },
      { id: 'g', pixel: shoot({ x: 10, y: 1, z: 8 }), metric: { x: 10, y: 1 } },
    ]
    const frame = registerPerspectivePlane({ id: 'p', assetId: 'photo', horizontalAxis: 'X', region: { x0: 0, y0: 0, x1: 1280, y1: 800 }, correspondences: mixed }, { minInlierShare: 0.9 })
    expect(frame.status).not.toBe('METRIC_FRAME_VALID')
  })

  it('§21.12: one correspondence on the wrong feature is named, not absorbed', () => {
    const spoiled: PlaneCorrespondence[] = [
      ...corners,
      onFacade('m0', 3, 2),
      onFacade('m1', 7, 4),
      // This one's pixel is where 3 m along the wall is; its label says 8 m.
      { id: 'bad', pixel: shoot({ x: 3, y: 5, z: 0 }), metric: { x: 8, y: 5 } },
    ]
    const fit = fitHomographyRobust(spoiled, { tolerancePx: 2 })
    expect(fit).not.toBeNull()
    expect(fit!.inlierIds).not.toContain('bad')
    expect(fit!.inlierIds.length).toBe(6)
  })

  it('is deterministic whatever order the correspondences arrive in', () => {
    const a = fitHomographyRobust([...corners, onFacade('m', 3, 2)])
    const b = fitHomographyRobust([onFacade('m', 3, 2), ...corners].reverse())
    expect(JSON.stringify(b)).toBe(JSON.stringify(a))
  })
})

describe('§11B: where the camera was', () => {
  /** Points on two walls and the ground, so they are not coplanar. */
  const world: WorldCorrespondence[] = [
    { id: 'p0', world: { x: 0, y: 0, z: 0 } },
    { id: 'p1', world: { x: 10, y: 0, z: 0 } },
    { id: 'p2', world: { x: 10, y: 6.5, z: 0 } },
    { id: 'p3', world: { x: 0, y: 6.5, z: 0 } },
    { id: 'p4', world: { x: 0, y: 0, z: 7 } },
    { id: 'p5', world: { x: 10, y: 0, z: 7 } },
    { id: 'p6', world: { x: 10, y: 4, z: 7 } },
    { id: 'p7', world: { x: 4, y: 2, z: 3.5 } },
  ].map((p) => ({ ...p, pixel: shoot(p.world) }))

  it('resects the camera the picture was taken with', () => {
    const solved = solveCamera(world)
    expect(solved).not.toBeNull()
    expect(solved!.rmsPx).toBeLessThan(0.5)
    expect(solved!.maxPx).toBeLessThan(1)
    // The focal length and the camera's position, recovered from the picture.
    expect(solved!.focalPx.x).toBeCloseTo(CAMERA.focal, -1)
    expect(Math.hypot(solved!.centre.x - CAMERA.eye.x, solved!.centre.y - CAMERA.eye.y, solved!.centre.z - CAMERA.eye.z)).toBeLessThan(0.2)
  })

  it('reprojects a point it never saw to where the camera would put it', () => {
    const solved = solveCamera(world)!
    const unseen = { x: 6.5, y: 5.25, z: 2 }
    const got = projectThrough(solved, unseen)
    const want = shoot(unseen)
    expect(got).not.toBeNull()
    expect(Math.hypot(got!.u - want.u, got!.v - want.v)).toBeLessThan(1)
  })

  it('§21.12: refuses a camera from coplanar points, however many there are', () => {
    // Nine points, all on the facade, measured perfectly. There is no camera
    // to be had from them and the solve must say so rather than answer.
    const flat: WorldCorrespondence[] = [
      [0, 0], [5, 0], [10, 0], [0, 3], [5, 3], [10, 3], [0, 6.5], [5, 6.5], [10, 6.5],
    ].map(([x, y], i) => ({ id: `f${i}`, world: { x, y, z: 0 }, pixel: shoot({ x, y, z: 0 }) }))
    expect(planarity(flat.map((p) => p.world))).toBeLessThan(0.02)
    expect(solveCamera(flat)).toBeNull()
  })

  it('refuses when there are not enough points to resect from', () => {
    expect(solveCamera(world.slice(0, 5))).toBeNull()
  })

  it('reports how far a bad correspondence lands, rather than absorbing it', () => {
    const spoiled = world.map((p) => (p.id === 'p6' ? { ...p, pixel: { u: p.pixel.u + 60, v: p.pixel.v - 40 } } : p))
    const solved = solveCamera(spoiled)
    expect(solved).not.toBeNull()
    expect(solved!.inlierIds).not.toContain('p6')
    expect(solved!.maxPx).toBeGreaterThan(4)
  })
})

describe('§12: vanishing points, and measuring without a camera', () => {
  it('finds where a family of parallel lines meets', () => {
    // Four horizontal lines on the facade, at different heights.
    const lines = [0.5, 2, 3.5, 5].map((y, i) => ({ id: `l${i}`, a: shoot({ x: 0, y, z: 0 }), b: shoot({ x: 10, y, z: 0 }) }))
    const got = vanishingPoint(lines)
    expect(got).not.toBeNull()
    expect(got!.rmsPx).toBeLessThan(0.5)
    // Where the world x direction vanishes: a point infinitely far along it.
    const far = shoot({ x: 1e7, y: 0, z: 0 })
    expect(Math.hypot(got!.pixel!.u - far.u, got!.pixel!.v - far.v)).toBeLessThan(5)
  })

  it('says a direction is not foreshortened rather than dividing by zero', () => {
    // The vertical direction is parallel to the image plane for this camera's
    // roll, so its lines stay parallel in the picture.
    const lines = [0, 3, 6, 9].map((x, i) => ({ id: `v${i}`, a: { u: 100 + x * 40, v: 50 }, b: { u: 100 + x * 40, v: 700 } }))
    const got = vanishingPoint(lines)
    expect(got).not.toBeNull()
    expect(got!.pixel).toBeNull()
    expect(got!.why).toContain('at infinity')
  })

  it('measures a height against a known one, with no camera at all', () => {
    const vertical = vanishingPoint([0, 4, 8].map((x, i) => ({ id: `v${i}`, a: shoot({ x, y: 0, z: 0 }), b: shoot({ x, y: 6, z: 0 }) })))!
    const horizon: [{ u: number; v: number }, { u: number; v: number }] = [shoot({ x: 1e7, y: 0, z: 0 }), shoot({ x: 0, y: 0, z: 1e7 })]
    const got = heightByCrossRatio({
      vertical,
      horizon,
      reference: { foot: shoot({ x: 1, y: 0, z: 0 }), top: shoot({ x: 1, y: 3, z: 0 }), heightM: 3 },
      target: { foot: shoot({ x: 8, y: 0, z: 0 }), top: shoot({ x: 8, y: 4.5, z: 0 }) },
    })
    expect(got).not.toBeNull()
    // A fallback, and held to a fallback's standard: within a fifth of a metre
    // on a 4.5 m height, which is worth having and is not a printed dimension.
    expect(Math.abs(got!.heightM - 4.5)).toBeLessThan(0.2)
  })
})
