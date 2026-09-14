import { describe, expect, it } from 'vitest'
import { manifoldReport, materialLength, materialRuns, meshVolume, overlapEstimate, planeClusters, rayHits, type OTri, type OVec3 } from '../src/index.js'

// A unit cube wound outward, built here by hand so the oracles are tested against something they did not produce.
function cube(o: OVec3, s = 1): OTri[] {
  const P = (x: number, y: number, z: number): OVec3 => ({ x: o.x + x * s, y: o.y + y * s, z: o.z + z * s })
  const q = (a: OVec3, b: OVec3, c: OVec3, d: OVec3): OTri[] => [
    { a, b, c },
    { a, b: c, c: d },
  ]
  return [
    ...q(P(0, 1, 0), P(0, 1, 1), P(1, 1, 1), P(1, 1, 0)), // top +y
    ...q(P(0, 0, 0), P(1, 0, 0), P(1, 0, 1), P(0, 0, 1)), // bottom -y
    ...q(P(1, 0, 0), P(1, 1, 0), P(1, 1, 1), P(1, 0, 1)), // +x
    ...q(P(0, 0, 0), P(0, 0, 1), P(0, 1, 1), P(0, 1, 0)), // -x
    ...q(P(0, 0, 1), P(1, 0, 1), P(1, 1, 1), P(0, 1, 1)), // +z
    ...q(P(0, 0, 0), P(0, 1, 0), P(1, 1, 0), P(1, 0, 0)), // -z
  ]
}

describe('geometry oracles', () => {
  it('measure a unit cube', () => {
    const c = cube({ x: 0, y: 0, z: 0 })
    expect(meshVolume(c)).toBeCloseTo(1, 12)
    expect(manifoldReport(c)).toMatchObject({ closed: true, boundaryEdges: 0, duplicateEdges: 0, vertexCount: 8 })
    const hits = rayHits(c, { x: 0.5, y: -1, z: 0.5 }, { x: 0, y: 1, z: 0 })
    expect(hits.map((h) => [h.t, h.entering])).toEqual([
      [1, true],
      [2, false],
    ])
    expect(materialLength(c, { x: 0.5, y: -1, z: 0.5 }, { x: 0, y: 1, z: 0 })).toBeCloseTo(1, 12)
    expect(materialRuns(c, { x: 0.5, y: 0.25, z: 0.5 }, { x: 0, y: 1, z: 0 })).toEqual([{ t0: 0, t1: 0.75 }])
  })

  it('detects an inside-out cube and an open box', () => {
    const c = cube({ x: 0, y: 0, z: 0 }).map((t) => ({ a: t.a, b: t.c, c: t.b }))
    expect(meshVolume(c)).toBeCloseTo(-1, 12)
    const open = cube({ x: 0, y: 0, z: 0 }).slice(2)
    expect(manifoldReport(open).closed).toBe(false)
    expect(manifoldReport(open).boundaryEdges).toBe(4)
  })

  it('estimates overlap between two solids', () => {
    const a = cube({ x: 0, y: 0, z: 0 })
    const b = cube({ x: 0.5, y: 0, z: 0 })
    const est = overlapEstimate(a, b, 0.1)
    expect(est.volume).toBeCloseTo(0.5, 6)
    expect(est.worstSharedLength).toBeCloseTo(1, 9)
    expect(overlapEstimate(a, cube({ x: 1, y: 0, z: 0 })).volume).toBe(0)
  })

  it('reads plane pitch from normals', () => {
    const tris: OTri[] = [{ a: { x: 0, y: 0, z: 0 }, b: { x: 1, y: 0, z: 0 }, c: { x: 1, y: 1, z: 1 } }]
    const [p] = planeClusters(tris)
    expect(p.pitchDeg).toBeCloseTo(45, 9)
  })
})
