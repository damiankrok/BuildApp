import { describe, expect, it } from 'vitest'
import { depthProbeReport, lineCoverage, pointInPolygon, type OTri, type OVec3 } from '../src/index.js'

// Hand-built outward-wound boxes, so the oracles are tested against something they did not produce.
function box(min: OVec3, max: OVec3): OTri[] {
  const P = (x: number, y: number, z: number): OVec3 => ({ x, y, z })
  const q = (a: OVec3, b: OVec3, c: OVec3, d: OVec3): OTri[] => [
    { a, b, c },
    { a, b: c, c: d },
  ]
  const { x: x0, y: y0, z: z0 } = min
  const { x: x1, y: y1, z: z1 } = max
  return [
    ...q(P(x0, y1, z0), P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0)),
    ...q(P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)),
    ...q(P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)),
    ...q(P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0)),
    ...q(P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)),
    ...q(P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z0)),
  ]
}

describe('depth probe', () => {
  // a recess: two returns at z 0..1 and a back wall at z 1..1.4 between x 0.6 and 9.4
  const back = box({ x: 0, y: 0, z: 1 }, { x: 10, y: 3, z: 1.4 })
  const left = box({ x: 0, y: 0, z: 0 }, { x: 0.6, y: 3, z: 1 })
  const right = box({ x: 9.4, y: 0, z: 0 }, { x: 10, y: 3, z: 1 })

  it('measures a real recess: no material at the outer plane, first material exactly at the back plane', () => {
    const r = depthProbeReport([back, left, right], { origin: { x: 0.6, y: 0.2, z: -0.5 }, ea: { x: 8.8, y: 0, z: 0 }, eb: { x: 0, y: 2.6, z: 0 }, dir: { x: 0, y: 0, z: 1 }, samples: [20, 3] })
    expect(r.rays).toBe(60)
    expect(r.open).toBe(0)
    expect(r.atPlane).toBe(0)
    expect(r.shallowest).toBeCloseTo(1.5, 9)
    expect(r.deepest).toBeCloseTo(1.5, 9)
    // beside the mouth the return stands at the outer plane
    const side = depthProbeReport([back, left, right], { origin: { x: 0, y: 0.2, z: -0.5 }, ea: { x: 0.6, y: 0, z: 0 }, eb: { x: 0, y: 2.6, z: 0 }, dir: { x: 0, y: 0, z: 1 }, samples: [3, 3], planeTolerance: 0.501 })
    expect(side.atPlane).toBe(9)
    expect(side.shallowest).toBeCloseTo(0.5, 9)
  })

  it('a flat facade with the recess filled in is caught: material at the outer plane on every ray', () => {
    const filled = box({ x: 0.6, y: 0, z: 0 }, { x: 9.4, y: 3, z: 1 })
    const r = depthProbeReport([back, left, right, filled], { origin: { x: 0.6, y: 0.2, z: -0.5 }, ea: { x: 8.8, y: 0, z: 0 }, eb: { x: 0, y: 2.6, z: 0 }, dir: { x: 0, y: 0, z: 1 }, samples: [20, 3], planeTolerance: 0.501 })
    expect(r.atPlane).toBe(60)
    expect(r.shallowest).toBeCloseTo(0.5, 9)
  })
})

describe('line coverage', () => {
  it('reads a glass balustrade as one long run with post gaps, bars as many short runs, nothing as zero', () => {
    const glass = [box({ x: 0.1, y: 0, z: 0 }, { x: 1.9, y: 1, z: 0.02 }), box({ x: 2.1, y: 0, z: 0 }, { x: 3.9, y: 1, z: 0.02 })]
    const c = lineCoverage(glass, { x: 0, y: 0.5, z: 0.01 }, { x: 4, y: 0.5, z: 0.01 })
    expect(c.length).toBe(4)
    expect(c.covered).toBeCloseTo(3.6, 9)
    expect(c.fraction).toBeCloseTo(0.9, 9)
    expect(c.longestGap).toBeCloseTo(0.2, 9)
    expect(c.runs).toHaveLength(2)
    const bars = [0.2, 0.5, 0.8, 1.1].map((x) => box({ x, y: 0, z: 0 }, { x: x + 0.012, y: 1, z: 0.012 }))
    const b = lineCoverage(bars, { x: 0, y: 0.5, z: 0.006 }, { x: 1.3, y: 0.5, z: 0.006 })
    expect(b.fraction).toBeLessThan(0.05)
    expect(b.runs).toHaveLength(4)
    expect(lineCoverage([], { x: 0, y: 0.5, z: 0 }, { x: 1, y: 0.5, z: 0 })).toMatchObject({ covered: 0, fraction: 0, longestGap: 1 })
  })
})

describe('point in polygon', () => {
  const L = [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 2 }, { x: 2, z: 2 }, { x: 2, z: 4 }, { x: 0, z: 4 }]
  it('classifies points against an L-shaped room, edges counting as inside', () => {
    expect(pointInPolygon({ x: 1, z: 1 }, L)).toBe(true)
    expect(pointInPolygon({ x: 3, z: 1 }, L)).toBe(true)
    expect(pointInPolygon({ x: 3, z: 3 }, L)).toBe(false)
    expect(pointInPolygon({ x: 1, z: 3 }, L)).toBe(true)
    expect(pointInPolygon({ x: 5, z: 1 }, L)).toBe(false)
    expect(pointInPolygon({ x: 4, z: 1 }, L)).toBe(true)
  })
})
