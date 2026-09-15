/**
 * Generic (non-Marcówki) proofs of the STAGE BUILDAPP-01A primitives: slab
 * holes, flight/winder stairs, roof cuts normal to the slope, composite door
 * assemblies and wall finish regions. Every number is measured from emitted
 * triangles by the independent oracles; nothing is read back from the model.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyModel, validateModel, type CanonicalBuildingModel } from '@buildapp/model'
import { runCommands, type BuildingCommand } from '@buildapp/commands'
import { boundsOf, manifoldReport, materialLength, materialRuns, meshVolume, overlapEstimate, upwardPlanes } from '@buildapp/verification'
import { compileBuilding, objectTriangles, solidTriangles, tessellateRegion } from '../src/index.js'
import { V, withGround } from './helpers.js'

const UP = V(0, 1, 0)
const codes = (m: unknown): string[] => validateModel(m).issues.map((i) => i.code)

describe('slab holes', () => {
  const slab = (holes: Array<Array<{ x: number; z: number }>>, polygon = [{ x: 0, z: 0 }, { x: 6, z: 0 }, { x: 6, z: 4 }, { x: 0, z: 4 }]): CanonicalBuildingModel =>
    withGround({ type: 'createSlab', id: 's', levelId: 'ground', polygon, holes, topOffset: 0, thickness: 0.3 })

  it('a rectangular hole: one closed solid, the hole volume gone, no material on a vertical line through it', () => {
    const scene = compileBuilding(slab([[{ x: 1, z: 1 }, { x: 3, z: 1 }, { x: 3, z: 2.5 }, { x: 1, z: 2.5 }]]))
    expect(scene.diagnostics).toEqual([])
    const t = solidTriangles(scene, 's')
    expect(manifoldReport(t)).toMatchObject({ closed: true, boundaryEdges: 0, duplicateEdges: 0 })
    expect(meshVolume(t)).toBeCloseTo((24 - 3) * 0.3, 9)
    expect(materialLength(t, V(2, -1, 1.75), UP)).toBe(0)
    expect(materialLength(t, V(0.5, -1, 1.75), UP)).toBeCloseTo(0.3, 9)
    expect(materialLength(t, V(2, -1, 3.2), UP)).toBeCloseTo(0.3, 9)
    // the hole's reveals face into it: a horizontal ray across the hole meets nothing between its walls
    expect(materialLength(t, V(-1, -0.15, 1.75), V(1, 0, 0))).toBeCloseTo(6 - 2, 9)
  })

  it('non-rectangular holes: a triangle and a hexagon, and an L-shaped hole sharing an edge with the outline', () => {
    const tri = [{ x: 1, z: 1 }, { x: 2.5, z: 1.2 }, { x: 1.4, z: 3 }]
    const hex = [3.5, 4, 4.5, 4.5, 4, 3.5].map((x, i) => ({ x, z: [1.2, 1.2, 2, 2.8, 2.8, 2][i] }))
    const scene = compileBuilding(slab([tri, hex]))
    expect(scene.diagnostics).toEqual([])
    const t = solidTriangles(scene, 's')
    expect(manifoldReport(t)).toMatchObject({ closed: true, boundaryEdges: 0, duplicateEdges: 0 })
    const area = (p: Array<{ x: number; z: number }>): number => Math.abs(p.reduce((a, q, i) => a + (q.x * p[(i + 1) % p.length].z - p[(i + 1) % p.length].x * q.z), 0) / 2)
    expect(meshVolume(t)).toBeCloseTo((24 - area(tri) - area(hex)) * 0.3, 9)
    expect(materialLength(t, V(1.6, -1, 1.6), UP)).toBe(0)
    expect(materialLength(t, V(4, -1, 2), UP)).toBe(0)
    expect(materialLength(t, V(3, -1, 2), UP)).toBeCloseTo(0.3, 9)
    // an L-shaped void against the outline's right edge (a stair void against a wall)
    const L = [{ x: 4, z: 0.5 }, { x: 6, z: 0.5 }, { x: 6, z: 3.5 }, { x: 5, z: 3.5 }, { x: 5, z: 1.5 }, { x: 4, z: 1.5 }]
    const s2 = compileBuilding(slab([L]))
    expect(s2.diagnostics).toEqual([])
    const t2 = solidTriangles(s2, 's')
    expect(manifoldReport(t2)).toMatchObject({ closed: true, boundaryEdges: 0, duplicateEdges: 0 })
    expect(meshVolume(t2)).toBeCloseTo((24 - (2 * 1 + 1 * 2)) * 0.3, 9)
    expect(materialLength(t2, V(5.5, -1, 2.5), UP)).toBe(0)
    expect(materialLength(t2, V(4.5, -1, 1), UP)).toBe(0)
    expect(materialLength(t2, V(4.5, -1, 2.5), UP)).toBeCloseTo(0.3, 9)
    // nothing is emitted on the shared edge: a ray along x at the void's height leaves the plate at x = 4 and meets nothing more
    const runs = materialRuns(t2, V(-1, -0.15, 1), V(1, 0, 0))
    expect(runs).toHaveLength(1)
    expect(runs[0].t1 - 1).toBeCloseTo(4, 9)
    // a hole inside a non-convex outline
    const outerL = [{ x: 0, z: 0 }, { x: 6, z: 0 }, { x: 6, z: 2 }, { x: 3, z: 2 }, { x: 3, z: 4 }, { x: 0, z: 4 }]
    const s3 = compileBuilding(slab([[{ x: 0.5, z: 2.5 }, { x: 2, z: 2.5 }, { x: 2, z: 3.5 }, { x: 0.5, z: 3.5 }]], outerL))
    expect(s3.diagnostics).toEqual([])
    const t3 = solidTriangles(s3, 's')
    expect(manifoldReport(t3).closed).toBe(true)
    expect(meshVolume(t3)).toBeCloseTo((18 - 1.5) * 0.3, 9)
  })

  it('refuses a hole outside the outline, holes that overlap, and a malformed hole; a slab without holes compiles as before', () => {
    const base = slab([])
    const m = structuredClone(base)
    m.slabs[0].holes = [[{ x: 5, z: 3 }, { x: 7, z: 3 }, { x: 7, z: 5 }, { x: 5, z: 5 }]]
    expect(codes(m)).toContain('SLAB_HOLE_OUTSIDE')
    m.slabs[0].holes = [[{ x: 1, z: 1 }, { x: 3, z: 1 }, { x: 3, z: 3 }, { x: 1, z: 3 }], [{ x: 2, z: 2 }, { x: 4, z: 2 }, { x: 4, z: 3.5 }, { x: 2, z: 3.5 }]]
    expect(codes(m)).toContain('SLAB_HOLES_OVERLAP')
    m.slabs[0].holes = [[{ x: 1, z: 1 }, { x: 3, z: 3 }, { x: 3, z: 1 }, { x: 1, z: 3 }]]
    expect(codes(m)).toContain('MALFORMED_POLYGON')
    const plain = solidTriangles(compileBuilding(base), 's')
    expect(meshVolume(plain)).toBeCloseTo(24 * 0.3, 9)
    expect(manifoldReport(plain).closed).toBe(true)
  })

  it('the region tessellation itself: triangles cover exactly the area, coincident opposite boundary segments cancel', () => {
    const t = tessellateRegion([{ u: 0, v: 0 }, { u: 4, v: 0 }, { u: 4, v: 3 }, { u: 0, v: 3 }], [[{ u: 3, v: 1 }, { u: 4, v: 1 }, { u: 4, v: 2 }, { u: 3, v: 2 }]])
    const area = t.triangles.reduce((a, [p, q, r]) => a + ((q.u - p.u) * (r.v - p.v) - (q.v - p.v) * (r.u - p.u)) / 2, 0)
    expect(area).toBeCloseTo(12 - 1, 12)
    for (const [p, q, r] of t.triangles) expect((q.u - p.u) * (r.v - p.v) - (q.v - p.v) * (r.u - p.u)).toBeGreaterThan(0)
    // the shared edge u = 4, v 1..2 appears in neither direction
    expect(t.boundary.some(([p, q]) => p.u === 4 && q.u === 4 && Math.min(p.v, q.v) >= 1 && Math.max(p.v, q.v) <= 2)).toBe(false)
    // every boundary segment is an edge of exactly one triangle in the same direction
    const edges = new Set(t.triangles.flatMap(([a, b, c]) => [`${a.u},${a.v}|${b.u},${b.v}`, `${b.u},${b.v}|${c.u},${c.v}`, `${c.u},${c.v}|${a.u},${a.v}`]))
    for (const [p, q] of t.boundary) expect(edges.has(`${p.u},${p.v}|${q.u},${q.v}`), `${p.u},${p.v} -> ${q.u},${q.v}`).toBe(true)
  })
})

describe('stairs with flights, winders and landings', () => {
  const two = (stair: Omit<Extract<BuildingCommand, { type: 'createStair' }>, 'type' | 'levelId' | 'toLevelId'>): CanonicalBuildingModel =>
    runCommands(createEmptyModel('st', 'st'), [
      { type: 'createBuilding', id: 'b' },
      { type: 'createLevel', id: 'ground', index: 0, elevation: 0, height: 2.7 },
      { type: 'createLevel', id: 'upper', index: 1, elevation: 2.7, height: 2.7 },
      { type: 'createStair', levelId: 'ground', toLevelId: 'upper', ...stair },
    ])
  // a quarter-turn winder stair walking +x, turning left to +z: 4 straight risers, 3 winders, 5 straight risers = 12 risers of 0.225
  const winderStair = () => two({ id: 'st', start: { x: 1, z: 2 }, direction: 'PLUS_X', width: 1, waist: 0.15, segments: [{ kind: 'FLIGHT', risers: 4, going: 0.27 }, { kind: 'WINDER', risers: 3, turn: 'LEFT', angleDeg: 90 }, { kind: 'FLIGHT', risers: 5, going: 0.27 }] })

  it('lays out a real staircase: closed steps, twelve equal risers measured from the treads, the top at the destination floor', () => {
    const m = winderStair()
    expect(validateModel(m).issues).toEqual([])
    const scene = compileBuilding(m)
    expect(scene.diagnostics).toEqual([])
    const t = solidTriangles(scene, 'st')
    expect(manifoldReport(t)).toMatchObject({ closed: true, boundaryEdges: 0, duplicateEdges: 0 })
    expect(meshVolume(t)).toBeGreaterThan(0)
    const b = boundsOf(t)!
    expect(b.max.y).toBeCloseTo(2.7, 9)
    expect(b.min.y).toBeCloseTo(0, 9)
    // the stair record's footprint was derived from the layout: flight 1 x 1..2.08, the corner x 2.08..3.08 z 1..2, flight 2 z 2..3.08
    const st = m.stairs[0]
    expect(st.footprint).toEqual({ minX: 1, maxX: 3.08, minZ: 1, maxZ: 3.08 })
    // tread tops: a vertical ray through each straight tread's centre stops at k × 0.225
    for (let k = 1; k <= 4; k++) {
      const runs = materialRuns(t, V(1 + (k - 0.5) * 0.27, -1, 1.5), UP)
      expect(runs[runs.length - 1].t1 - 1, `tread ${k}`).toBeCloseTo(k * 0.225, 9)
    }
    for (let k = 1; k <= 4; k++) {
      const runs = materialRuns(t, V(2.58, -1, 2 + (k - 0.5) * 0.27), UP)
      expect(runs[runs.length - 1].t1 - 1, `upper tread ${k}`).toBeCloseTo((7 + k) * 0.225, 9)
    }
    // the winders: three treads fanning about the newel (2.08, 2); a ray near the newel meets them in turn
    const tops = new Set<number>()
    for (const [x, z] of [
      [2.3, 1.2],
      [2.9, 1.3],
      [2.95, 1.9],
    ]) {
      const runs = materialRuns(t, V(x, -1, z), UP)
      tops.add(Number((runs[runs.length - 1].t1 - 1).toFixed(6)))
    }
    expect([...tops].sort()).toEqual([5, 6, 7].map((k) => Number((k * 0.225).toFixed(6))))
    // the arrival riser plate stands at z 3.08 and reaches the floor level; beyond it nothing
    expect(materialLength(t, V(2.58, 2.6, 3.07), V(0, 0, 1))).toBeGreaterThan(0)
    expect(materialLength(t, V(2.58, -1, 3.2), UP)).toBe(0)
    // twelve distinct tread/arrival heights, all multiples of 0.225
    const heights = new Set<number>()
    for (let x = 1.05; x < 3.08; x += 0.05) for (let z = 1.05; z < 3.08; z += 0.05) {
      const runs = materialRuns(t, V(x, -1, z), UP)
      if (runs.length > 0) heights.add(Number((runs[runs.length - 1].t1 - 1).toFixed(6)))
    }
    expect([...heights].sort((a, b) => a - b)).toEqual([...Array(12).keys()].map((k) => Number(((k + 1) * 0.225).toFixed(6))))
  })

  it('a half-turn winder and a turning landing lay out; refused layouts are named', () => {
    const half = two({ id: 'h', start: { x: 0, z: 0 }, direction: 'PLUS_Z', width: 1, segments: [{ kind: 'FLIGHT', risers: 3, going: 0.28 }, { kind: 'WINDER', risers: 5, turn: 'RIGHT', angleDeg: 180 }, { kind: 'FLIGHT', risers: 4, going: 0.28 }] })
    const hs = compileBuilding(half)
    expect(hs.diagnostics).toEqual([])
    const ht = solidTriangles(hs, 'h')
    expect(manifoldReport(ht).closed).toBe(true)
    expect(boundsOf(ht)!.max.y).toBeCloseTo(2.7, 9)
    // walking +z then turning right (towards +x... on the plan, right of +z is +x) the return flight runs −z beside the first
    expect(half.stairs[0].footprint).toEqual({ minX: 0, maxX: 2, minZ: 0, maxZ: 1.84 })
    const landing = two({ id: 'l', start: { x: 0, z: 0 }, direction: 'PLUS_X', width: 1, segments: [{ kind: 'FLIGHT', risers: 5, going: 0.25 }, { kind: 'LANDING', length: 1, turn: 'LEFT' }, { kind: 'FLIGHT', risers: 5, going: 0.25 }] })
    const ls = compileBuilding(landing)
    expect(ls.diagnostics).toEqual([])
    const lt = solidTriangles(ls, 'l')
    expect(manifoldReport(lt).closed).toBe(true)
    // the landing is level at riser 5's height over its whole square
    for (const [x, z] of [[1.3, -0.2], [2.2, -0.9], [1.8, -0.5]]) {
      const runs = materialRuns(lt, V(x, -1, z), UP)
      expect(runs[runs.length - 1].t1 - 1).toBeCloseTo(5 * 0.27, 9)
    }
    // the landing's first riser stands on its left edge (z = 0) and the return flight climbs north from it
    expect(materialRuns(lt, V(1.8, -1, 0.1), UP).pop()!.t1 - 1).toBeCloseTo(6 * 0.27, 9)
    expect(landing.stairs[0].footprint).toEqual({ minX: 0, maxX: 2.25, minZ: -1, maxZ: 1 })
    // refusals
    const bad = structuredClone(winderStair())
    const st = bad.stairs[0]
    if (st.kind !== 'FLIGHTS') throw new Error('flights')
    st.segments = [{ kind: 'FLIGHT', risers: 4, going: 0.27 }, { kind: 'WINDER', risers: 3, turn: 'LEFT', angleDeg: 90 }]
    expect(codes(bad)).toContain('STAIR_LAYOUT_INVALID')
    const small = structuredClone(winderStair())
    small.stairs[0].footprint = { minX: 1, maxX: 2.5, minZ: 1, maxZ: 3.08 }
    expect(codes(small)).toContain('STAIR_OUTSIDE_FOOTPRINT')
    const flat = structuredClone(winderStair())
    const fs = flat.stairs[0]
    if (fs.kind === 'FLIGHTS') fs.topOffset = -2.7
    expect(codes(flat)).toContain('STAIR_RISE_INVALID')
    // a wrong arrival is a valid model the oracle catches: the stair stops short of the floor
    const low = runCommands(winderStair(), [{ type: 'setProperty', targetId: 'st', property: 'topOffset', value: -0.3 }])
    expect(boundsOf(solidTriangles(compileBuilding(low), 'st'))!.max.y).toBeCloseTo(2.4, 9)
  })
})

describe('roof openings cut normal to the slope', () => {
  const PITCH = 40
  const T = 0.2
  const tan = Math.tan((PITCH * Math.PI) / 180)
  const sin = Math.sin((PITCH * Math.PI) / 180)
  const cos = Math.cos((PITCH * Math.PI) / 180)
  // a gable with the ridge along z at x = 4; the west slope rises with +x; a 0.8 (z) × 1.0 (x) hole on it
  const house = (cut: 'VERTICAL' | 'NORMAL_TO_ROOF') =>
    withGround(
      { type: 'createRoof', id: 'roof', levelId: 'ground', kind: 'GABLE', footprint: { minX: 0, maxX: 8, minZ: 0, maxZ: 6 }, eaveOffset: 3, pitchDeg: PITCH, ridgeAxis: 'Z', thickness: T },
      { type: 'cutRoofOpening', id: 'ro', roofId: 'roof', kind: 'ROOFLIGHT', footprint: { minX: 1, maxX: 2, minZ: 2, maxZ: 2.8 }, cut },
      { type: 'placeRooflight', id: 'rl', roofOpeningId: 'ro', frameWidth: 0.07, glassThickness: 0.024 },
    )
  // the west slope's upward normal and the direction down through the plate
  const normal = V(-sin, cos, 0)
  const down = V(sin, -cos, 0)
  const topY = (x: number): number => 3 + x * tan

  it('a normal cut is a real hole with the same outline along the roof normal; a vertical cut is not, and rays tell them apart', () => {
    for (const cut of ['NORMAL_TO_ROOF', 'VERTICAL'] as const) {
      const scene = compileBuilding(house(cut))
      expect(scene.diagnostics, cut).toEqual([])
      const roof = solidTriangles(scene, 'roof')
      expect(manifoldReport(roof), cut).toMatchObject({ closed: true, boundaryEdges: 0, duplicateEdges: 0 })
      expect(upwardPlanes(roof)[0].pitchDeg).toBeCloseTo(PITCH, 6)
      // through the hole's centre nothing, vertically and along the normal
      const cx = 1.5
      const cz = 2.4
      expect(materialLength(roof, V(cx, 0, cz), UP), cut).toBe(0)
      const start = V(cx + normal.x, topY(cx) + normal.y, cz)
      expect(materialLength(roof, V(start.x, start.y, start.z), down), cut).toBe(0)
      // just inside the UPHILL top edge (x = 2 − 0.02), a ray along the normal stays in a normal hole and hits the plate of a vertical one
      const ux = 2 - 0.02
      const nStart = V(ux + normal.x, topY(ux) + normal.y, cz)
      const alongNormal = materialLength(roof, nStart, down)
      // just inside the DOWNHILL top edge (x = 1 + 0.02), a vertical ray clears a vertical hole and hits the lip of a normal one
      const vertical = materialLength(roof, V(1 + 0.02, 0, cz), UP)
      if (cut === 'NORMAL_TO_ROOF') {
        expect(alongNormal).toBe(0)
        expect(vertical).toBeGreaterThan(0.05)
      } else {
        expect(alongNormal).toBeGreaterThan(0.05)
        expect(vertical).toBe(0)
      }
      // the perpendicular thickness beside the hole is the stated 0.2 in both cases; the removed volume is the same sloped area × thickness
      const bx = 2.5
      expect(materialLength(roof, V(bx + normal.x, topY(bx) + normal.y, cz), down), cut).toBeCloseTo(T, 6)
      const full = meshVolume(solidTriangles(compileBuilding(withGround({ type: 'createRoof', id: 'roof', levelId: 'ground', kind: 'GABLE', footprint: { minX: 0, maxX: 8, minZ: 0, maxZ: 6 }, eaveOffset: 3, pitchDeg: PITCH, ridgeAxis: 'Z', thickness: T })), 'roof'))
      expect(full - meshVolume(roof), cut).toBeCloseTo((1 * 0.8) / cos * T, 6)
      // the rooflight unit: frame and glass closed, no shared volume with the roof, the frame fills the cut (nothing along the normal through the frame's centre line but the frame)
      const frame = scene.meshes.find((m) => m.objectId === 'rl' && m.part === 'ROOFLIGHT_FRAME')!.triangles
      const glass = scene.meshes.find((m) => m.objectId === 'rl' && m.part === 'ROOFLIGHT_GLASS')!.triangles
      expect(manifoldReport(frame).closed).toBe(true)
      expect(manifoldReport(glass).closed).toBe(true)
      expect(overlapEstimate(roof, frame, 0.01).worstSharedLength, cut).toBeLessThan(1e-9)
      expect(materialLength(glass, V(cx, 0, cz), UP)).toBeCloseTo(0.024, 9)
      if (cut === 'NORMAL_TO_ROOF') {
        // the frame's sides are normal to the slope: along the normal through the frame member (0.035 in from the uphill edge) the frame reads the whole thickness
        const fx = 2 - 0.035
        expect(materialLength(frame, V(fx + normal.x, topY(fx) + normal.y, cz), down)).toBeCloseTo(T, 6)
      }
    }
  })

  it('validation: the underside outline must stay on the slope; a chimney penetration stays vertical; the mode is editable and undoable', () => {
    const m = house('NORMAL_TO_ROOF')
    const near = structuredClone(m)
    near.roofOpenings[0].footprint = { minX: 2.9, maxX: 3.95, minZ: 2, maxZ: 2.8 }
    expect(codes(near)).toContain('ROOF_OPENING_CROSSES_RIDGE')
    const vert = structuredClone(near)
    vert.roofOpenings[0].cut = 'VERTICAL'
    expect(codes(vert)).toEqual([])
    const pen = structuredClone(m)
    pen.chimneys.push({ id: 'ch', levelId: 'ground', footprint: { minX: 5, maxX: 5.6, minZ: 4, maxZ: 4.6 }, baseOffset: 0, height: 7 })
    pen.roofOpenings.push({ id: 'pen', roofId: 'roof', kind: 'PENETRATION', footprint: { minX: 5, maxX: 5.6, minZ: 4, maxZ: 4.6 }, cut: 'NORMAL_TO_ROOF', throughId: 'ch' })
    expect(codes(pen)).toContain('ROOF_PENETRATION_MISMATCH')
    const switched = runCommands(m, [{ type: 'setProperty', targetId: 'ro', property: 'cut', value: 'VERTICAL' }])
    expect(switched.roofOpenings[0].cut).toBe('VERTICAL')
  })
})

describe('composite door assemblies', () => {
  const doorHouse = (assembly: Extract<BuildingCommand, { type: 'placeDoor' }>['assembly'], extra: Partial<Extract<BuildingCommand, { type: 'placeDoor' }>> = {}) =>
    withGround(
      { type: 'createWall', id: 'w', levelId: 'ground', start: { x: 0, z: 0 }, end: { x: 6, z: 0 }, thickness: 0.45, height: 3 },
      { type: 'cutOpening', id: 'o', wallId: 'w', kind: 'DOOR', offset: 2, sill: 0, width: 1.05, height: 2.1 },
      { type: 'placeDoor', id: 'd', openingId: 'o', frameWidth: 0.06, frameDepth: 0.12, frameInset: 0.1, assembly, ...extra },
    )
  const across = (tris: readonly { a: { x: number; y: number; z: number }; b: { x: number; y: number; z: number }; c: { x: number; y: number; z: number } }[], x: number, y: number): number => materialLength(tris, V(x, y, -1), V(0, 0, 1))

  it('a leaf with a glazed sidelight: the frame carries a mullion, glass fills the sidelight, the leaf the rest, every part closed', () => {
    const m = doorHouse({ panels: [{ kind: 'LEAF', fraction: 0.72, hinge: 'LEFT', glazing: 'NONE' }, { kind: 'GLAZED', fraction: 0.28 }], mullionWidth: 0.04 })
    expect(validateModel(m).issues).toEqual([])
    const scene = compileBuilding(m)
    expect(scene.diagnostics).toEqual([])
    const parts = scene.meshes.filter((x) => x.objectId === 'd')
    expect(parts.map((p) => p.part).sort()).toEqual(['DOOR_FRAME', 'DOOR_GLASS', 'DOOR_HANDLE', 'DOOR_LEAF'])
    for (const p of parts) expect(manifoldReport(p.triangles).closed, p.part).toBe(true)
    const frame = parts.find((p) => p.part === 'DOOR_FRAME')!.triangles
    const glass = parts.find((p) => p.part === 'DOOR_GLASS')!.triangles
    const leaf = parts.find((p) => p.part === 'DOOR_LEAF')!.triangles
    // the panel boundary is at 0.72 of the width: x 2 + 0.756 = 2.756; the mullion 2.736..2.776
    expect(across(frame, 2.756, 1)).toBeCloseTo(0.12, 9)
    expect(across(glass, 2.9, 1)).toBeCloseTo(0.024, 9)
    expect(across(leaf, 2.9, 1)).toBe(0)
    expect(across(leaf, 2.4, 1)).toBeCloseTo(0.045, 9)
    expect(across(glass, 2.4, 1)).toBe(0)
    // the sidelight has a bottom rail (frame) and no glass at the sill; the leaf reaches the sill
    expect(across(frame, 2.9, 0.03)).toBeCloseTo(0.12, 9)
    expect(across(glass, 2.9, 0.03)).toBe(0)
    expect(across(leaf, 2.4, 0.03)).toBeCloseTo(0.045, 9)
    // the frame's volume is the opening less the two apertures, 0.12 deep
    const leafAperture = (2.756 - 0.02 - (2 + 0.06)) * (2.1 - 0.06)
    const glassAperture = (3.05 - 0.06 - (2.756 + 0.02)) * (2.1 - 0.06 - 0.06)
    expect(meshVolume(frame)).toBeCloseTo((1.05 * 2.1 - leafAperture - glassAperture) * 0.12, 9)
    // the wall is unchanged: the opening is still one structural hole of the printed size
    expect(across(solidTriangles(scene, 'w'), 2.5, 1)).toBe(0)
    expect(across(solidTriangles(scene, 'w'), 1.96, 1)).toBeCloseTo(0.45, 9)
    // a wrong-way assembly puts the glass on the other side: the same rays say so
    const mirrored = compileBuilding(doorHouse({ panels: [{ kind: 'GLAZED', fraction: 0.28 }, { kind: 'LEAF', fraction: 0.72, hinge: 'RIGHT', glazing: 'NONE' }], mullionWidth: 0.04 }))
    const mg = mirrored.meshes.find((x) => x.objectId === 'd' && x.part === 'DOOR_GLASS')!.triangles
    expect(across(mg, 2.9, 1)).toBe(0)
    expect(across(mg, 2.15, 1)).toBeCloseTo(0.024, 9)
  })

  it('a fixed panel (sectional door) and a fully glazed leaf; the glazed leaf swings with its pane; bad fractions are refused', () => {
    const panelScene = compileBuilding(doorHouse({ panels: [{ kind: 'PANEL', fraction: 1 }], mullionWidth: 0.04 }))
    const pParts = panelScene.meshes.filter((x) => x.objectId === 'd')
    expect(pParts.map((p) => p.part).sort()).toEqual(['DOOR_FRAME', 'DOOR_PANEL'])
    expect(across(pParts.find((p) => p.part === 'DOOR_PANEL')!.triangles, 2.5, 1)).toBeCloseTo(0.045, 9)
    const glazed = doorHouse({ panels: [{ kind: 'LEAF', fraction: 1, hinge: 'LEFT', glazing: 'FULL' }], mullionWidth: 0.04 })
    const gScene = compileBuilding(glazed)
    const gParts = gScene.meshes.filter((x) => x.objectId === 'd')
    expect(gParts.map((p) => p.part).sort()).toEqual(['DOOR_FRAME', 'DOOR_GLASS', 'DOOR_HANDLE', 'DOOR_LEAF'])
    for (const p of gParts) expect(manifoldReport(p.triangles).closed, p.part).toBe(true)
    const leafRing = gParts.find((p) => p.part === 'DOOR_LEAF')!.triangles
    const pane = gParts.find((p) => p.part === 'DOOR_GLASS')!.triangles
    expect(across(leafRing, 2.5, 1)).toBe(0)
    expect(across(pane, 2.5, 1)).toBeCloseTo(0.024, 9)
    expect(across(leafRing, 2.1, 1)).toBeCloseTo(0.045, 9)
    // opened 90°: the pane moves with the leaf into the building
    const open = compileBuilding(runCommands(glazed, [{ type: 'setProperty', targetId: 'd', property: 'openAngle', value: 90 }]))
    const openPane = open.meshes.find((x) => x.objectId === 'd' && x.part === 'DOOR_GLASS')!.triangles
    const ob = boundsOf(openPane)!
    expect(ob.max.z - ob.min.z).toBeGreaterThan(0.6)
    expect(meshVolume(openPane)).toBeCloseTo(meshVolume(pane), 9)
    const bad = structuredClone(glazed)
    bad.doors[0].assembly = { panels: [{ kind: 'LEAF', fraction: 0.5, hinge: 'LEFT', glazing: 'NONE' }, { kind: 'GLAZED', fraction: 0.3 }], mullionWidth: 0.04 }
    expect(codes(bad)).toContain('DOOR_ASSEMBLY_INVALID')
    // a door without an assembly compiles exactly as before: frame, leaf, handle
    const plain = compileBuilding(doorHouse(undefined))
    expect(plain.meshes.filter((x) => x.objectId === 'd').map((p) => p.part)).toEqual(['DOOR_FRAME', 'DOOR_LEAF', 'DOOR_HANDLE'])
  })
})

describe('wall finish regions', () => {
  const house = (...extra: BuildingCommand[]) =>
    withGround(
      { type: 'defineMaterial', id: 'timber', name: 'timber', color: '#8a6a3d' },
      { type: 'createRoof', id: 'roof', levelId: 'ground', kind: 'GABLE', footprint: { minX: 0, maxX: 8, minZ: 0, maxZ: 6 }, eaveOffset: 3, pitchDeg: 40, ridgeAxis: 'Z', thickness: 0.2 },
      { type: 'createWall', id: 'w', levelId: 'ground', start: { x: 0, z: 0 }, end: { x: 8, z: 0 }, thickness: 0.4, height: 7, topProfile: { kind: 'FOLLOW_ROOF', roofId: 'roof' } },
      { type: 'cutOpening', id: 'o', wallId: 'w', kind: 'WINDOW', offset: 1, sill: 0.9, width: 1.2, height: 1.4 },
      ...extra,
    )
  const towards = (tris: readonly { a: { x: number; y: number; z: number }; b: { x: number; y: number; z: number }; c: { x: number; y: number; z: number } }[], x: number, y: number) => materialRuns(tris, V(x, y, -1), V(0, 0, 1))

  it('a region is a thin skin in front of the face, clipped by the roof line and the opening, with the wall volume unchanged', () => {
    const m = house({ type: 'createSurfaceRegion', id: 'r', hostId: 'w', face: 'OUTER', rect: { a0: 0.5, a1: 3, b0: 0, b1: 7 }, materialId: 'timber' })
    expect(validateModel(m).issues).toEqual([])
    const scene = compileBuilding(m)
    expect(scene.diagnostics).toEqual([])
    const skin = objectTriangles(scene, 'r')
    expect(manifoldReport(skin)).toMatchObject({ closed: true, boundaryEdges: 0, duplicateEdges: 0 })
    const mesh = scene.meshes.find((x) => x.objectId === 'r')!
    expect(mesh).toMatchObject({ part: 'SURFACE_REGION', hostWallId: 'w', structural: false, materialId: 'timber' })
    // in front of the face: a ray towards the wall meets 2 mm of skin, 3 mm clear of the face, then the wall
    const runs = towards(skin, 2.5, 0.5)
    expect(runs).toHaveLength(1)
    expect(runs[0].t1 - runs[0].t0).toBeCloseTo(0.002, 9)
    expect(1 - runs[0].t1).toBeCloseTo(0.003, 9)
    const wallRuns = towards(solidTriangles(scene, 'w'), 2.5, 0.5)
    expect(wallRuns[0].t0).toBeCloseTo(1, 9)
    // not through the window, not outside the rectangle
    expect(towards(skin, 1.6, 1.5)).toHaveLength(0)
    expect(towards(skin, 4, 0.5)).toHaveLength(0)
    expect(towards(skin, 0.3, 0.5)).toHaveLength(0)
    // just outside the window's jamb the skin exists (the opening is a notch, not a cleared band)
    expect(towards(skin, 0.95, 1.5)).toHaveLength(1)
    expect(towards(skin, 2.5, 0.85)).toHaveLength(1)
    // clipped by the roof: at x = 2.5 the soffit is 3 + 2.5·tan40 − 0.2/cos40 above the base; the skin top is there, below the rect's 7
    const soffit = 3 + 2.5 * Math.tan((40 * Math.PI) / 180) - 0.2 / Math.cos((40 * Math.PI) / 180)
    expect(towards(skin, 2.5, soffit - 0.05)).toHaveLength(1)
    expect(towards(skin, 2.5, soffit + 0.05)).toHaveLength(0)
    // the wall itself is untouched by the region
    const without = compileBuilding(house())
    expect(meshVolume(solidTriangles(scene, 'w'))).toBeCloseTo(meshVolume(solidTriangles(without, 'w')), 9)
    expect(solidTriangles(scene, 'w')).toEqual(solidTriangles(without, 'w'))
  })

  it('an inner-face region sits behind the wall; refusals: not a wall, outside the wall, unknown material', () => {
    const m = house({ type: 'createSurfaceRegion', id: 'r', hostId: 'w', face: 'INNER', rect: { a0: 4, a1: 6, b0: 0.2, b1: 2 }, materialId: 'timber' })
    const scene = compileBuilding(m)
    const skin = objectTriangles(scene, 'r')
    const runs = materialRuns(skin, V(5, 1, 2), V(0, 0, -1))
    expect(runs).toHaveLength(1)
    // the inner face is at z = 0.4; the skin starts 3 mm behind it
    expect(2 - runs[0].t1).toBeCloseTo(0.403, 9)
    const bad = structuredClone(m)
    bad.surfaceRegions[0].hostId = 'roof'
    expect(codes(bad)).toContain('SURFACE_REGION_HOST_INVALID')
    bad.surfaceRegions[0].hostId = 'w'
    bad.surfaceRegions[0].rect = { a0: 4, a1: 9, b0: 0, b1: 2 }
    expect(codes(bad)).toContain('SURFACE_REGION_OUTSIDE_HOST')
    bad.surfaceRegions[0].rect = { a0: 4, a1: 6, b0: 0, b1: 2 }
    bad.surfaceRegions[0].materialId = 'nope'
    expect(codes(bad)).toContain('UNKNOWN_MATERIAL')
    // removing the wall removes its regions; removing the material removes them too
    const gone = runCommands(m, [{ type: 'removeFeature', targetId: 'w' }])
    expect(gone.surfaceRegions).toEqual([])
    const noMat = runCommands(m, [{ type: 'removeFeature', targetId: 'timber' }])
    expect(noMat.surfaceRegions).toEqual([])
  })
})
