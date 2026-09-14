import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createDemoBuilding } from '@buildapp/demo'
import { parseModel, polygonArea, resolveWallTopology, type CanonicalBuildingModel, type Vec2 } from '@buildapp/model'
import { runCommands, type BuildingCommand } from '@buildapp/commands'
import { boundsOf, boxesOverlap, manifoldReport, materialLength, materialRuns, meshVolume, overlapEstimate, unionMaterialRuns } from '@buildapp/verification'
import { compileBuilding, solidTriangles } from '../src/index.js'
import { V, withGround } from './helpers.js'

const RECT: Vec2[] = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 8 }, { x: 0, z: 8 }]
const T = 0.3
const H = 3

/** Every structural wall solid is closed with positive volume; no two walls share volume. */
function assertWallsDisjointAndClosed(model: CanonicalBuildingModel, scene = compileBuilding(model)): { volumes: Map<string, number> } {
  expect(scene.diagnostics).toEqual([])
  const volumes = new Map<string, number>()
  for (const w of model.walls) {
    const tris = solidTriangles(scene, w.id)
    expect(manifoldReport(tris), w.id).toMatchObject({ closed: true, boundaryEdges: 0, duplicateEdges: 0 })
    const v = meshVolume(tris)
    expect(v, w.id).toBeGreaterThan(0)
    volumes.set(w.id, v)
  }
  const ids = model.walls.map((w) => w.id)
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = solidTriangles(scene, ids[i])
      const b = solidTriangles(scene, ids[j])
      if (!boxesOverlap(boundsOf(a)!, boundsOf(b)!)) continue
      const est = overlapEstimate(a, b, 0.05)
      expect(est.volume, `${ids[i]}|${ids[j]} shared volume`).toBeLessThan(1e-9)
      expect(est.worstSharedLength, `${ids[i]}|${ids[j]} shared ray`).toBeLessThan(1e-9)
    }
  }
  return { volumes }
}

const sum = (xs: Iterable<number>): number => [...xs].reduce((s, x) => s + x, 0)

describe('closed rectangle from untrimmed footprint corners', () => {
  const model = withGround({ type: 'createWallRing', id: 'r', levelId: 'ground', polygon: RECT, thickness: T, height: H, walls: [{ id: 'front' }, { id: 'right' }, { id: 'rear' }, { id: 'left' }] })
  const scene = compileBuilding(model)

  it('the four walls are closed solids, disjoint, and their volumes add up to exactly the ring material', () => {
    const { volumes } = assertWallsDisjointAndClosed(model, scene)
    // outer area minus inner area, times height: every corner block counted exactly once
    const expected = (10 * 8 - (10 - 2 * T) * (8 - 2 * T)) * H
    expect(sum(volumes.values())).toBeCloseTo(expected, 9)
    expect(volumes.get('front')).toBeCloseTo(10 * T * H, 9)
    expect(volumes.get('right')).toBeCloseTo((8 - 2 * T) * T * H, 9)
  })

  it('corner material belongs to exactly one wall: a vertical ray through each corner block meets one solid', () => {
    const blocks: Array<[number, number, string]> = [
      [0.15, 0.15, 'front'],
      [9.85, 0.15, 'front'],
      [9.85, 7.85, 'rear'],
      [0.15, 7.85, 'rear'],
    ]
    for (const [x, z, owner] of blocks) {
      const hits = model.walls.map((w) => [w.id, materialLength(solidTriangles(scene, w.id), V(x, -1, z), V(0, 1, 0))] as const)
      expect(hits.filter(([, l]) => l > 1e-9).map(([id]) => id), `corner block at ${x},${z}`).toEqual([owner])
      expect(hits.find(([id]) => id === owner)![1]).toBeCloseTo(H, 9)
    }
  })

  it('no gap at any joint: a horizontal ray along each side crosses the ring twice, each time for exactly the thickness', () => {
    const solids = model.walls.map((w) => solidTriangles(scene, w.id))
    const all = (o: { x: number; y: number; z: number }, d: { x: number; y: number; z: number }) => unionMaterialRuns(solids, o, d)
    // across the building at z = 4: left wall then right wall
    const runsAre = (runs: Array<{ t0: number; t1: number }>, expected: number[][]): void => {
      expect(runs.length).toBe(expected.length)
      runs.forEach((r, i) => {
        expect(r.t0 - 1).toBeCloseTo(expected[i][0], 9)
        expect(r.t1 - 1).toBeCloseTo(expected[i][1], 9)
      })
    }
    runsAre(all(V(-1, 1.5, 4), V(1, 0, 0)), [
      [0, T],
      [10 - T, 10],
    ])
    // across at x = 5: front then rear
    runsAre(all(V(5, 1.5, -1), V(0, 0, 1)), [
      [0, T],
      [8 - T, 8],
    ])
    // along the front wall 0.15 m in from its outer face, through both corner blocks: one continuous run from 0 to 10
    // (the abutting solids' runs union into one interval — no daylight anywhere)
    runsAre(all(V(-1, 1.5, 0.15), V(1, 0, 0)), [[0, 10]])
    // along the right wall 0.15 m in from the outer face: front block, right wall, rear block — one run of 8 m
    runsAre(all(V(9.85, 1.5, -1), V(0, 0, 1)), [[0, 8]])
  })

  it('every mesh still belongs to the wall that produced it', () => {
    for (const w of model.walls) expect(scene.meshes.filter((m) => m.objectId === w.id && m.part === 'WALL')).toHaveLength(1)
    expect(scene.meshes.map((m) => m.objectKind)).not.toContain('wallJunction')
  })
})

describe('rings of other shapes', () => {
  it('an L-shaped ring: the reflex corner notch is filled exactly once', () => {
    const L: Vec2[] = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 4 }, { x: 6, z: 4 }, { x: 6, z: 8 }, { x: 0, z: 8 }]
    const inner: Vec2[] = [{ x: T, z: T }, { x: 10 - T, z: T }, { x: 10 - T, z: 4 - T }, { x: 6 - T, z: 4 - T }, { x: 6 - T, z: 8 - T }, { x: T, z: 8 - T }]
    const model = withGround({ type: 'createWallRing', id: 'r', levelId: 'ground', polygon: L, thickness: T, height: H })
    const scene = compileBuilding(model)
    const { volumes } = assertWallsDisjointAndClosed(model, scene)
    expect(sum(volumes.values())).toBeCloseTo((polygonArea(L) - polygonArea(inner)) * H, 9)
    // the notch at the reflex vertex (6,4): material through its centre, owned by one wall
    const total = model.walls.reduce((s, w) => s + materialLength(solidTriangles(scene, w.id), V(6 - T / 2, -1, 4 - T / 2), V(0, 1, 0)), 0)
    expect(total).toBeCloseTo(H, 9)
    const owners = model.walls.filter((w) => materialLength(solidTriangles(scene, w.id), V(6 - T / 2, -1, 4 - T / 2), V(0, 1, 0)) > 1e-9)
    expect(owners).toHaveLength(1)
  })

  it('a regular hexagon: oblique corners close exactly (skewed end cuts), volume equals apothem-based ring area times height', () => {
    const a = 4 // apothem
    const R = a / Math.cos(Math.PI / 6)
    const hex: Vec2[] = Array.from({ length: 6 }, (_, i) => ({ x: R * Math.cos((i * Math.PI) / 3), z: R * Math.sin((i * Math.PI) / 3) }))
    const model = withGround({ type: 'createWallRing', id: 'r', levelId: 'ground', polygon: hex, thickness: T, height: H })
    const scene = compileBuilding(model)
    const { volumes } = assertWallsDisjointAndClosed(model, scene)
    const ringArea = 2 * Math.sqrt(3) * (a * a - (a - T) * (a - T))
    expect(sum(volumes.values())).toBeCloseTo(ringArea * H, 9)
    // the cuts really are skewed: outer and inner ends differ on every wall
    const t = resolveWallTopology(model)
    for (const w of model.walls) {
      const e = t.extents.get(w.id)!
      const skewed = Math.abs(e.start.outer - e.start.inner) > 1e-6 || Math.abs(e.end.outer - e.end.inner) > 1e-6
      expect(skewed, w.id).toBe(true)
    }
    // a ray from the centre outward through every corner meets exactly the wall depth along that direction
    const solids = model.walls.map((w) => solidTriangles(scene, w.id))
    for (let i = 0; i < 6; i++) {
      const ang = (i * Math.PI) / 3
      const runs = unionMaterialRuns(solids, V(0, 1.5, 0), V(Math.cos(ang), 0, Math.sin(ang)))
      expect(runs).toHaveLength(1)
      expect(runs[0].t1 - runs[0].t0).toBeCloseTo(T / Math.cos(Math.PI / 6), 9)
    }
  })

  it('walls of different thicknesses: the ring closes and each corner block belongs to its owner', () => {
    const model = withGround({
      type: 'createWallRing',
      id: 'r',
      levelId: 'ground',
      polygon: RECT,
      thickness: 0.3,
      height: H,
      walls: [{ id: 'front', thickness: 0.5 }, { id: 'right', thickness: 0.25 }, { id: 'rear', thickness: 0.3 }, { id: 'left', thickness: 0.4 }],
    })
    const scene = compileBuilding(model)
    const { volumes } = assertWallsDisjointAndClosed(model, scene)
    expect(sum(volumes.values())).toBeCloseTo((10 * 8 - (10 - 0.25 - 0.4) * (8 - 0.5 - 0.3)) * H, 9)
    // corner at (10,0) is the front wall's: its block spans the right wall's full thickness
    expect(materialLength(solidTriangles(scene, 'front'), V(9.9, -1, 0.4), V(0, 1, 0))).toBeCloseTo(H, 9)
    expect(materialLength(solidTriangles(scene, 'right'), V(9.9, -1, 0.4), V(0, 1, 0))).toBe(0)
  })

  it('a rotated ring compiles to the same volumes and closes the same way', () => {
    const ang = 0.7
    const rot = (p: Vec2): Vec2 => ({ x: 3 + p.x * Math.cos(ang) - p.z * Math.sin(ang), z: -2 + p.x * Math.sin(ang) + p.z * Math.cos(ang) })
    const model = withGround(
      { type: 'createWallRing', id: 'r', levelId: 'ground', polygon: RECT.map(rot), thickness: T, height: H },
      { type: 'cutOpening', id: 'o', wallId: 'r-w1', kind: 'WINDOW', offset: 0.35, sill: 0.9, width: 1.2, height: 1.4 },
    )
    const scene = compileBuilding(model)
    const { volumes } = assertWallsDisjointAndClosed(model, scene)
    expect(sum(volumes.values())).toBeCloseTo((10 * 8 - (10 - 2 * T) * (8 - 2 * T)) * H - 1.2 * 1.4 * T, 9)
    const t = resolveWallTopology(model)
    expect(t.extents.get('r-w1')!.start.outer).toBeCloseTo(T, 9)
    expect(t.extents.get('r-w1')!.start.inner).toBeCloseTo(T, 9)
    // the window sits 50 mm past the corner block and is really cut
    const w = model.walls[1]
    const u = { x: (w.end.x - w.start.x) / 8, z: (w.end.z - w.start.z) / 8 }
    const n = { x: u.z, z: -u.x }
    const c = { x: w.start.x + u.x * 0.95, z: w.start.z + u.z * 0.95 }
    expect(materialLength(solidTriangles(scene, 'r-w1'), V(c.x + n.x, 1.6, c.z + n.z), V(-n.x, 0, -n.z))).toBe(0)
  })
})

describe('butt and T junctions in geometry', () => {
  it('a butting wall ends on the host face: contact, no shared volume, no gap', () => {
    const model = withGround(
      { type: 'createWall', id: 'host', levelId: 'ground', start: { x: 0, z: 0 }, end: { x: 10, z: 0 }, thickness: 0.3, height: H },
      { type: 'createWall', id: 'p', levelId: 'ground', start: { x: 5, z: 0 }, end: { x: 5, z: 4 }, thickness: 0.2, height: H, kind: 'INTERIOR', startJunction: { kind: 'BUTT', againstWallId: 'host' } },
    )
    const scene = compileBuilding(model)
    const { volumes } = assertWallsDisjointAndClosed(model, scene)
    expect(volumes.get('host')).toBeCloseTo(10 * 0.3 * H, 9)
    expect(volumes.get('p')).toBeCloseTo((4 - 0.3) * 0.2 * H, 9)
    expect(boundsOf(solidTriangles(scene, 'p'))!.min.z).toBeCloseTo(0.3, 12)
    // along the partition: host material 0..0.3 then the partition 0.3..4, no daylight between
    const runs = unionMaterialRuns([solidTriangles(scene, 'host'), solidTriangles(scene, 'p')], V(4.9, 1.5, -1), V(0, 0, 1))
    expect(runs).toHaveLength(1)
    expect(runs[0].t0 - 1).toBeCloseTo(0, 9)
    expect(runs[0].t1 - 1).toBeCloseTo(4, 9)
  })

  it('a T-junction from outside stops at the host outer face, the host keeps its full material', () => {
    const model = withGround(
      { type: 'createWall', id: 'host', levelId: 'ground', start: { x: 10, z: 0 }, end: { x: 10, z: 8 }, thickness: 0.3, height: H },
      { type: 'createWall', id: 'wing', levelId: 'ground', start: { x: 15, z: 6 }, end: { x: 10, z: 6 }, thickness: 0.3, height: H, endJunction: { kind: 'T', againstWallId: 'host' } },
    )
    const scene = compileBuilding(model)
    const { volumes } = assertWallsDisjointAndClosed(model, scene)
    expect(volumes.get('host')).toBeCloseTo(8 * 0.3 * H, 9)
    expect(volumes.get('wing')).toBeCloseTo(5 * 0.3 * H, 9)
    expect(boundsOf(solidTriangles(scene, 'wing'))!.min.x).toBeCloseTo(10, 12)
  })
})

describe('openings near junctions', () => {
  const ring = (...more: BuildingCommand[]): CanonicalBuildingModel =>
    withGround({ type: 'createWallRing', id: 'r', levelId: 'ground', polygon: RECT, thickness: T, height: H, walls: [{ id: 'front' }, { id: 'right' }, { id: 'rear' }, { id: 'left' }] }, ...more)

  it('a legal opening 50 mm from a corner survives junction resolution as a real hole', () => {
    // on the owner, right up to the corner; on the trimmed wall, right after the consumed zone
    const model = ring(
      { type: 'cutOpening', id: 'near-owner', wallId: 'front', kind: 'WINDOW', offset: 8.75, sill: 0.9, width: 1.2, height: 1.4 },
      { type: 'cutOpening', id: 'near-trimmed', wallId: 'right', kind: 'WINDOW', offset: 0.35, sill: 0.9, width: 1.2, height: 1.4 },
    )
    const scene = compileBuilding(model)
    assertWallsDisjointAndClosed(model, scene)
    expect(materialLength(solidTriangles(scene, 'front'), V(9.35, 1.6, -1), V(0, 0, 1))).toBe(0)
    expect(materialLength(solidTriangles(scene, 'front'), V(9.975, 1.6, -1), V(0, 0, 1))).toBeCloseTo(T, 9)
    expect(materialLength(solidTriangles(scene, 'right'), V(11, 1.6, 0.95), V(-1, 0, 0))).toBe(0)
    expect(materialLength(solidTriangles(scene, 'right'), V(11, 1.6, 0.325), V(-1, 0, 0))).toBeCloseTo(T, 9)
    expect(meshVolume(solidTriangles(scene, 'right'))).toBeCloseTo(((8 - 2 * T) * H - 1.2 * 1.4) * T, 9)
  })

  it('an opening reaching into a consumed junction zone is refused by name, not shrunk', () => {
    expect(() => ring({ type: 'cutOpening', id: 'bad', wallId: 'right', kind: 'WINDOW', offset: 0.2, sill: 0.9, width: 1.2, height: 1.4 })).toThrow(/OPENING_IN_JUNCTION_ZONE/)
    expect(() => ring({ type: 'cutOpening', id: 'bad', wallId: 'left', kind: 'DOOR', offset: 6.9, sill: 0, width: 1, height: 2.1 })).toThrow(/OPENING_IN_JUNCTION_ZONE/)
    // a model that states such an opening directly does not compile
    const model = ring()
    model.openings.push({ id: 'bad', wallId: 'right', kind: 'WINDOW', offset: 0.2, sill: 0.9, width: 1.2, height: 1.4 })
    const scene = compileBuilding(model)
    expect(scene.meshes).toEqual([])
    expect(scene.diagnostics[0].message).toContain('OPENING_IN_JUNCTION_ZONE')
  })
})

describe('roof-following ring', () => {
  it('a ring under a gable roof: eave walls die into the soffit on both faces, gable walls rise into the gable, corners closed', () => {
    const model = withGround(
      { type: 'createWallRing', id: 'r', levelId: 'ground', polygon: [{ x: 0, z: 0 }, { x: 8, z: 0 }, { x: 8, z: 6 }, { x: 0, z: 6 }], thickness: 0.4, height: 6, walls: [{ id: 'front' }, { id: 'right' }, { id: 'rear' }, { id: 'left' }] },
      { type: 'createRoof', id: 'roof', levelId: 'ground', kind: 'GABLE', footprint: { minX: 0, maxX: 8, minZ: 0, maxZ: 6 }, eaveOffset: 3, pitchDeg: 40, ridgeAxis: 'X', overhang: 0.5, thickness: 0.2, capWallIds: ['front', 'right', 'rear', 'left'] },
    )
    const scene = compileBuilding(model)
    assertWallsDisjointAndClosed(model, scene)
    const drop = 0.2 / Math.cos((40 * Math.PI) / 180)
    const slope = Math.tan((40 * Math.PI) / 180)
    const front = solidTriangles(scene, 'front')
    expect(materialLength(front, V(4, -1, 0.001), V(0, 1, 0))).toBeCloseTo(3 - drop + 0.001 * slope, 6)
    expect(materialLength(front, V(4, -1, 0.399), V(0, 1, 0))).toBeCloseTo(3 - drop + 0.399 * slope, 6)
    const roof = solidTriangles(scene, 'roof')
    for (const z of [0.05, 0.2, 0.35]) {
      const w = materialRuns(front, V(4, -1, z), V(0, 1, 0))
      const r = materialRuns(roof, V(4, -1, z), V(0, 1, 0))
      expect(r[0].t0 - w[0].t1).toBeCloseTo(0, 9)
    }
    // the gable wall, trimmed by the front wall, rises to the ridge underside at the middle
    const left = solidTriangles(scene, 'left')
    expect(materialLength(left, V(0.2, -1, 3), V(0, 1, 0))).toBeCloseTo(3 + 3 * slope - drop, 9)
    expect(boundsOf(left)!.min.z).toBeCloseTo(0.4, 12)
    expect(boundsOf(left)!.max.z).toBeCloseTo(5.6, 12)
    // the corner block at (0,0) belongs to the front wall and stops at the eave soffit like the rest of it
    expect(materialLength(front, V(0.2, -1, 0.2), V(0, 1, 0))).toBeCloseTo(3 - drop + 0.2 * slope, 6)
  })
})

describe('demo before / after', () => {
  const FIXTURE = resolve(import.meta.dirname, '../../model/test/fixtures/demo-house-1.0.0.json')

  it('the topology demo compiles to the same per-wall solids as the hand-trimmed BUILDAPP-00 demo', () => {
    const before = parseModel(readFileSync(FIXTURE, 'utf8'))
    const after = createDemoBuilding()
    expect(before.wallJunctions).toEqual([])
    expect(after.wallJunctions.length).toBeGreaterThanOrEqual(13)
    expect(after.wallRings.map((r) => r.id).sort()).toEqual(['ring-ground', 'ring-upper'])
    const sb = compileBuilding(before)
    const sa = compileBuilding(after)
    expect(sb.diagnostics).toEqual([])
    expect(sa.diagnostics).toEqual([])
    expect(after.walls.map((w) => w.id).sort()).toEqual(before.walls.map((w) => w.id).sort())
    for (const w of before.walls) {
      const tb = solidTriangles(sb, w.id)
      const ta = solidTriangles(sa, w.id)
      const bb = boundsOf(tb)!
      const ba = boundsOf(ta)!
      for (const k of ['x', 'y', 'z'] as const) {
        expect(ba.min[k], `${w.id} min ${k}`).toBeCloseTo(bb.min[k], 9)
        expect(ba.max[k], `${w.id} max ${k}`).toBeCloseTo(bb.max[k], 9)
      }
      expect(meshVolume(ta), `${w.id} volume`).toBeCloseTo(meshVolume(tb), 9)
    }
    // every opening sits at the same world position: the wall-local offsets were re-stated from the new wall origins
    for (const o of before.openings) {
      const oa = after.openings.find((x) => x.id === o.id)!
      const wb = before.walls.find((w) => w.id === o.wallId)!
      const wa = after.walls.find((w) => w.id === oa.wallId)!
      const at = (w: typeof wb, offset: number): Vec2 => {
        const L = Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z)
        return { x: w.start.x + ((w.end.x - w.start.x) / L) * offset, z: w.start.z + ((w.end.z - w.start.z) / L) * offset }
      }
      const pb = at(wb, o.offset)
      const pa = at(wa, oa.offset)
      expect(pa.x, o.id).toBeCloseTo(pb.x, 9)
      expect(pa.z, o.id).toBeCloseTo(pb.z, 9)
    }
    expect(sa.stats.triangleCount).toBe(sb.stats.triangleCount)
  })

  it('the new demo declares its topology and its walls never overlap', () => {
    const m = createDemoBuilding()
    const t = resolveWallTopology(m)
    expect(t.issues).toEqual([])
    expect([...t.endClaims.keys()].sort()).toEqual(
      ['g-front:END', 'g-front:START', 'g-right:END', 'g-right:START', 'g-rear:END', 'g-rear:START', 'g-left:END', 'g-left:START', 'g-partition:END', 'g-partition:START', 'gar-front:END', 'gar-right:START', 'gar-right:END', 'gar-rear:START', 'gar-rear:END', 'u-front:END', 'u-front:START', 'u-right:END', 'u-right:START', 'u-rear:END', 'u-rear:START', 'u-left:END', 'u-left:START'].sort(),
    )
    assertWallsDisjointAndClosed(m)
  })
})
