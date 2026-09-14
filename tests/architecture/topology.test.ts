/**
 * Wall topology architecture tests:
 *   1. the demo never hand-trims a wall endpoint into another wall's thickness band again;
 *   2. an analyzer that knows a footprint, thicknesses, heights and openings — and nothing
 *      about junction solids — can build a closed house;
 *   3. a catalogue of deliberate topology mutations, each with the checker that catches it.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createDemoBuilding, demoBuildingCommands } from '@buildapp/demo'
import { createEmptyModel, ringPolygon, validateModel, wallLength, type CanonicalBuildingModel, type Vec2, type Wall } from '@buildapp/model'
import { applyCommand, runCommands, type BuildingCommand } from '@buildapp/commands'
import { compileBuilding, solidTriangles } from '@buildapp/geometry'
import { manifoldReport, materialLength, meshVolume, ringClosureReport } from '@buildapp/verification'

const ROOT = resolve(import.meta.dirname, '../..')

/** Signed depth of a point into a wall's thickness band: 0 on the outer line, `thickness` on the inner face. */
function depthInto(w: Wall, p: Vec2): { depth: number; along: number } {
  const L = wallLength(w)
  const ux = (w.end.x - w.start.x) / L
  const uz = (w.end.z - w.start.z) / L
  const nx = uz
  const nz = -ux
  return { depth: -((p.x - w.start.x) * nx + (p.z - w.start.z) * nz), along: (p.x - w.start.x) * ux + (p.z - w.start.z) * uz }
}

describe('the demo states walls on the natural footprint', () => {
  it('no wall endpoint lies inside another wall thickness band (no manual thickness-based corner trimming)', () => {
    const m = createDemoBuilding()
    const offenders: string[] = []
    for (const w of m.walls) {
      for (const [end, p] of [
        ['START', w.start],
        ['END', w.end],
      ] as const) {
        for (const v of m.walls) {
          if (v.id === w.id || v.levelId !== w.levelId) continue
          const { depth, along } = depthInto(v, p)
          if (along < -1e-6 || along > wallLength(v) + 1e-6) continue
          if (depth > 1e-6 && depth < v.thickness + 1e-6) offenders.push(`${w.id}.${end} at (${p.x}, ${p.z}) sits ${depth.toFixed(3)} m inside ${v.id}`)
        }
      }
    }
    expect(offenders).toEqual([])
    // the BUILDAPP-00 demo would have failed this test: its side walls started at z = thickness
    const old = JSON.parse(readFileSync(resolve(ROOT, 'packages/model/test/fixtures/demo-house-1.0.0.json'), 'utf8')) as CanonicalBuildingModel
    const oldRight = old.walls.find((w) => w.id === 'g-right')!
    expect(depthInto(old.walls.find((w) => w.id === 'g-front')!, oldRight.start).depth).toBeCloseTo(0.3, 12)
  })

  it('the exterior rings come from createWallRing on the footprint polygons and every junction is declared', () => {
    const commands = demoBuildingCommands()
    const rings = commands.filter((c) => c.type === 'createWallRing')
    expect(rings).toHaveLength(2)
    for (const r of rings) {
      if (r.type !== 'createWallRing') continue
      expect(r.polygon).toEqual([{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 8 }, { x: 0, z: 8 }])
    }
    const src = readFileSync(resolve(ROOT, 'packages/demo/src/demo-house.ts'), 'utf8')
    for (const line of src.split('\n').filter((l) => /type: 'createWall'/.test(l))) {
      expect(line, line).not.toMatch(/[+-] T\b|: T [},]/)
    }
    const m = createDemoBuilding()
    expect(m.wallRings).toHaveLength(2)
    for (const ring of m.wallRings) expect(ringPolygon(m, ring)).toEqual([{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 8 }, { x: 0, z: 8 }])
  })
})

// ---------------------------------------------------------------------------
// Analyzer-friendly build
// ---------------------------------------------------------------------------

/** What a plan analyzer knows about a small house. No thickness arithmetic anywhere. */
type HouseSpec = {
  footprint: Vec2[]
  wallThickness: number
  wallHeight: number
  partition: { from: Vec2; to: Vec2; thickness: number; height: number }
  door: { side: number; offset: number; width: number; height: number }
  windows: Array<{ side: number; offset: number; width: number; height: number; sill: number }>
}

const SPEC: HouseSpec = {
  footprint: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 8 }, { x: 0, z: 8 }],
  wallThickness: 0.3,
  wallHeight: 3,
  partition: { from: { x: 6, z: 8 }, to: { x: 6, z: 0 }, thickness: 0.12, height: 2.75 },
  door: { side: 0, offset: 1, width: 1, height: 2.1 },
  windows: [
    { side: 0, offset: 3.5, width: 1.5, height: 1.4, sill: 0.9 },
    { side: 0, offset: 7, width: 1.8, height: 1.4, sill: 0.9 },
    { side: 1, offset: 2, width: 1.2, height: 1.4, sill: 0.9 },
    { side: 2, offset: 4, width: 1.5, height: 1.4, sill: 0.9 },
    { side: 3, offset: 3, width: 1.2, height: 1.4, sill: 0.9 },
  ],
}

/** The whole "analyzer": the spec becomes commands one to one. */
function analyzerCommands(s: HouseSpec): BuildingCommand[] {
  const side = (i: number): string => `house-w${i}`
  const out: BuildingCommand[] = [
    { type: 'createBuilding', id: 'b' },
    { type: 'createLevel', id: 'ground', index: 0, elevation: 0, height: s.wallHeight },
    { type: 'createWallRing', id: 'house', levelId: 'ground', polygon: s.footprint, thickness: s.wallThickness, height: s.wallHeight },
    {
      type: 'createWall',
      id: 'partition',
      levelId: 'ground',
      start: s.partition.from,
      end: s.partition.to,
      thickness: s.partition.thickness,
      height: s.partition.height,
      kind: 'INTERIOR',
      startJunction: { kind: 'T', againstWallId: side(2) },
      endJunction: { kind: 'T', againstWallId: side(0) },
    },
    { type: 'cutOpening', id: 'door-op', wallId: side(s.door.side), kind: 'DOOR', offset: s.door.offset, sill: 0, width: s.door.width, height: s.door.height },
    { type: 'placeDoor', id: 'door', openingId: 'door-op' },
  ]
  s.windows.forEach((w, i) => {
    out.push({ type: 'cutOpening', id: `win-op-${i}`, wallId: side(w.side), kind: 'WINDOW', offset: w.offset, sill: w.sill, width: w.width, height: w.height })
    out.push({ type: 'placeWindow', id: `win-${i}`, openingId: `win-op-${i}` })
  })
  return out
}

const analyzerHouse = (spec = SPEC): CanonicalBuildingModel => runCommands(createEmptyModel('house', 'analyzer house'), analyzerCommands(spec))

describe('analyzer-friendly build', () => {
  it('a footprint, thicknesses, heights and openings are enough to build a closed house with no junction arithmetic', () => {
    const m = analyzerHouse()
    expect(validateModel(m).issues).toEqual([])
    expect(m.walls).toHaveLength(5)
    expect(m.wallJunctions).toHaveLength(6)
    expect(m.doors).toHaveLength(1)
    expect(m.windows).toHaveLength(5)
    const scene = compileBuilding(m)
    expect(scene.diagnostics).toEqual([])
    // every wall closed, the four exterior walls add up to exactly the ring material minus the openings
    let ringVolume = 0
    for (const w of m.walls) {
      const tris = solidTriangles(scene, w.id)
      expect(manifoldReport(tris), w.id).toMatchObject({ closed: true })
      if (w.id.startsWith('house-')) ringVolume += meshVolume(tris)
    }
    const T = SPEC.wallThickness
    const openings = SPEC.door.width * SPEC.door.height + SPEC.windows.reduce((s, w) => s + w.width * w.height, 0)
    expect(ringVolume).toBeCloseTo((10 * 8 - (10 - 2 * T) * (8 - 2 * T)) * SPEC.wallHeight - openings * T, 9)
    // the independent ring oracle agrees the storey envelope is closed and nothing is doubled
    const report = ringClosureReport(SPEC.footprint, m.walls.map((w) => ({ id: w.id, triangles: solidTriangles(scene, w.id) })), { heights: [0.5, 2.4], step: 0.1 })
    expect(report.closed).toBe(true)
    expect(report.overlaps).toEqual([])
    // the partition ends on the inner faces of front and rear
    const p = solidTriangles(scene, 'partition')
    expect(materialLength(p, V(6.06, 1.5, -1), V(0, 0, 1))).toBeCloseTo(8 - 2 * T, 9)
    // the door is a real hole
    expect(materialLength(solidTriangles(scene, 'house-w0'), V(1.5, 1, -1), V(0, 0, 1))).toBe(0)
  })
})

const V = (x: number, y: number, z: number) => ({ x, y, z })

// ---------------------------------------------------------------------------
// Mutation catalogue
// ---------------------------------------------------------------------------

type Mutation = {
  name: string
  /** Break the model directly (as a corrupt file would) or through a command. */
  mutate: (m: CanonicalBuildingModel) => CanonicalBuildingModel | { rejected: string[] }
  /** Validation codes that must appear (model-level checker). */
  codes: string[]
  /** Optional geometry-level check on a scene the mutation can reach without the model refusing it. */
  oracle?: (m: CanonicalBuildingModel) => void
}

const clone = (m: CanonicalBuildingModel): CanonicalBuildingModel => JSON.parse(JSON.stringify(m)) as CanonicalBuildingModel
const rejectedBy = (m: CanonicalBuildingModel, c: BuildingCommand): { rejected: string[] } => {
  const r = applyCommand(m, c)
  return { rejected: r.ok ? [] : r.errors.map((e) => e.code) }
}

const MUTATIONS: Mutation[] = [
  {
    name: '1. one missing exterior wall',
    mutate: (m) => {
      const x = clone(m)
      x.walls = x.walls.filter((w) => w.id !== 'house-w2')
      return x
    },
    codes: ['UNKNOWN_WALL'],
    oracle: (m) => {
      // geometry level: drop the rear wall's solid from a good scene and probe the envelope
      const scene = compileBuilding(m)
      const solids = m.walls.filter((w) => w.id !== 'house-w2').map((w) => ({ id: w.id, triangles: solidTriangles(scene, w.id) }))
      const r = ringClosureReport(SPEC.footprint, solids, { heights: [0.5, 2.4], step: 0.1 })
      expect(r.closed).toBe(false)
      expect(r.gaps.find((g) => g.edge === 2)!.length).toBeCloseTo(10, 1)
      expect(r.corners.filter((c) => !c.ok).map((c) => c.vertex)).toEqual([2, 3])
    },
  },
  {
    name: '2. one shifted corner',
    mutate: (m) => {
      const x = clone(m)
      x.walls.find((w) => w.id === 'house-w1')!.start = { x: 10, z: 0.5 }
      return x
    },
    codes: ['JUNCTION_GAP', 'RING_NOT_CLOSED'],
  },
  {
    name: '3. one undeclared overlapping wall',
    mutate: (m) => rejectedBy(m, { type: 'createWall', levelId: 'ground', start: { x: 3, z: -1 }, end: { x: 3, z: 2 }, thickness: 0.12, height: 2.5, kind: 'INTERIOR' }),
    codes: ['WALLS_OVERLAP'],
  },
  {
    name: '4a. incorrect corner owner (names a wall that is not at the corner)',
    mutate: (m) => rejectedBy(m, { type: 'setProperty', targetId: 'house-j1', property: 'owner', value: 'house-w3' }),
    codes: ['JUNCTION_OWNER_NOT_PARTICIPANT'],
  },
  {
    name: '4b. incorrect butt roles (the host is declared as the terminating wall)',
    mutate: (m) => {
      const x = clone(m)
      // the partition's front-wall T with the roles swapped: the front wall's END is already the ring corner's
      const j = x.wallJunctions.find((j) => j.id === 'partition-j-end')!
      if (j.kind === 'T') {
        j.wall = { wallId: 'house-w0', end: 'END' }
        j.againstWallId = 'partition'
      }
      return x
    },
    codes: ['ENDPOINT_JUNCTION_CONFLICT'],
  },
  {
    name: '4c. incorrect butt host (the partition is declared against the wrong wall)',
    mutate: (m) => {
      const x = clone(m)
      const j = x.wallJunctions.find((j) => j.id === 'partition-j-end')!
      if (j.kind === 'T') j.againstWallId = 'house-w2'
      return x
    },
    // the partition's END is 7.7 m past the rear wall's band (its START sits on that wall's outer line), and the
    // partition now overlaps the front wall it no longer declares a junction with
    codes: ['JUNCTION_OVERSHOOT|JUNCTION_GAP', 'WALLS_OVERLAP'],
  },
  {
    name: '5. broken T-junction (the partition lands beyond the host)',
    mutate: (m) => {
      const x = clone(m)
      const p = x.walls.find((w) => w.id === 'partition')!
      p.start = { x: 12, z: 8 }
      p.end = { x: 12, z: 0 }
      return x
    },
    codes: ['T_JUNCTION_POSITION'],
  },
  {
    name: '6. opening colliding with a consumed junction region',
    mutate: (m) => rejectedBy(m, { type: 'cutOpening', wallId: 'house-w1', kind: 'WINDOW', offset: 0.1, sill: 0.9, width: 1, height: 1.2 }),
    codes: ['OPENING_IN_JUNCTION_ZONE'],
  },
  {
    name: '7. one wall end claimed by two junctions',
    mutate: (m) => rejectedBy(m, { type: 'createWallJunction', kind: 'BUTT', wall: { wallId: 'house-w1', end: 'START' }, againstWallId: 'house-w0' }),
    codes: ['ENDPOINT_JUNCTION_CONFLICT'],
  },
  {
    name: '8. a wall reversed so its material lies outside',
    mutate: (m) => {
      const x = clone(m)
      const w = x.walls.find((w) => w.id === 'house-w0')!
      ;[w.start, w.end] = [w.end, w.start]
      return x
    },
    codes: ['JUNCTION_OVERSHOOT|JUNCTION_GAP', 'RING_NOT_CLOSED'],
  },
]

describe('mutation catalogue', () => {
  const good = analyzerHouse()
  expect(validateModel(good).issues).toEqual([])

  for (const mut of MUTATIONS) {
    it(`${mut.name} — caught by ${mut.codes.join(' + ')}`, () => {
      const result = mut.mutate(good)
      const codes = 'rejected' in result ? result.rejected : validateModel(result).issues.map((i) => i.code)
      for (const c of mut.codes) expect(c.split('|').some((alt) => codes.includes(alt)), `${mut.name}: ${c} in ${codes.join(', ')}`).toBe(true)
      if (!('rejected' in result)) expect(compileBuilding(result).meshes, 'a mutated model is not compiled').toEqual([])
      mut.oracle?.(good)
    })
  }
})
