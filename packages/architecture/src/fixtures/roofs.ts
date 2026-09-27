/**
 * Diversity fixtures 1–8: roofs. Each is a small generic house whose roof is
 * composed from planes and edges; none is a copy of any project.
 */
import type { ArchitecturalFixture } from './types.js'
import { MAT, assembly, doorIn, gableHouse, hipRoof, planeThrough, rect, rel, ring, round, shedRoof, start, synthetic, windowIn, type Cmd } from './builders.js'

const T = 0.3
const H = 3.0

/** Windows and a door on the front facade of a W-wide house. */
const frontOpenings = (wall: string, W: number): Cmd[] => [...doorIn(wall, 'door-front', round(W / 2 - 0.5), 1.0, 2.1, 'ENTRANCE'), ...windowIn(wall, 'window-front-1', 1.2, 0.9, 1.4, 1.3), ...windowIn(wall, 'window-front-2', round(W - 2.6), 0.9, 1.4, 1.3)]

export const roofGable: ArchitecturalFixture = {
  id: 'roof-gable',
  title: 'Simple gable: two planes, a ridge, two eaves, four verges',
  capabilities: ['ROOF_GABLE'],
  commands: () => {
    const h = gableHouse({ W: 10, D: 8, H, t: T, pitchDeg: 35, overhang: 0.5, roofThickness: 0.25 })
    return [...h.commands, ...frontOpenings(h.walls.front, 10)]
  },
  expect: { assemblies: { ROOF: 1 }, primitives: { RoofPlane: 2, Ridge: 1, Eave: 2, Verge: 4, Fascia: 6 }, roofClassifications: ['GABLE'], minRelationships: 2 },
}

export const roofHip: ArchitecturalFixture = {
  id: 'roof-hip',
  title: 'Hip roof: four planes, four hips and a ridge',
  capabilities: ['ROOF_HIP'],
  commands: () => {
    const roof = hipRoof({ prefix: 'roof-main', levelId: 'level-0', W: 11, D: 8, eaveY: H, pitchDeg: 30, overhang: 0.6, thickness: 0.25 })
    return [
      ...start([{ id: 'level-0', index: 0, elevation: 0, height: 3 }]),
      ...roof.commands,
      ring({ id: 'ring-0', levelId: 'level-0', polygon: rect(0, 0, 11, 8), thickness: T, height: 6, followPlanes: roof.planeIds }),
      ...roof.planeIds.map((p, i) => rel('SUPPORTED_BY', p, `ring-0-w${[0, 2, 3, 1][i]}`)),
      ...frontOpenings('ring-0-w0', 11),
    ]
  },
  expect: { assemblies: { ROOF: 1 }, primitives: { RoofPlane: 4, HipEdge: 4, Ridge: 1, Eave: 4 }, roofClassifications: ['HIP'], minRelationships: 4 },
}

export const roofShed: ArchitecturalFixture = {
  id: 'roof-shed',
  title: 'Shed (mono-pitch) roof falling to the front',
  capabilities: ['ROOF_SHED'],
  commands: () => {
    const roof = shedRoof({ prefix: 'roof-main', levelId: 'level-0', W: 9, D: 7, eaveY: H, pitchDeg: 12, overhang: 0.4, thickness: 0.22 })
    return [
      ...start([{ id: 'level-0', index: 0, elevation: 0, height: 3 }]),
      ...roof.commands,
      ring({ id: 'ring-0', levelId: 'level-0', polygon: rect(0, 0, 9, 7), thickness: T, height: 6, followPlanes: roof.planeIds }),
      rel('SUPPORTED_BY', roof.planeIds[0], 'ring-0-w0'),
      rel('SUPPORTED_BY', roof.planeIds[0], 'ring-0-w2'),
      ...frontOpenings('ring-0-w0', 9),
    ]
  },
  expect: { assemblies: { ROOF: 1 }, primitives: { RoofPlane: 1, Eave: 1, Verge: 2, RoofBoundary: 1 }, roofClassifications: ['SHED'], minRelationships: 2 },
}

/**
 * Flat roof + parapet: the roof plate bears on the walls, parapet runs (wall
 * panels) stand on the plate over the walls, and the relationships say so —
 * not a slab with a decorative border.
 */
export const roofFlatParapet: ArchitecturalFixture = {
  id: 'roof-flat-parapet',
  title: 'Flat roof with parapet runs over its host walls',
  capabilities: ['ROOF_FLAT', 'PARAPET'],
  commands: () => {
    const W = 10
    const D = 8
    const tr = 0.25
    const tp = 0.2
    const top = H + tr
    const up = top + 0.6
    const plane = 'roof-main-plane'
    const panel = (id: string, a: { x: number; z: number }, b: { x: number; z: number }, wall: string): Cmd => {
      const L = round(Math.hypot(b.x - a.x, b.z - a.z))
      return { type: 'createWallPanel', id, levelId: 'level-0', role: 'PARAPET', start: a, end: b, thickness: tp, bottom: [{ u: 0, y: top }, { u: L, y: top }], top: [{ u: 0, y: up }, { u: L, y: up }], hostId: wall, materialId: MAT.wall, evidence: synthetic(id) }
    }
    const edges = [
      { id: 'roof-main-edge-front', a: { x: 0, z: 0 }, b: { x: W, z: 0 } },
      { id: 'roof-main-edge-east', a: { x: W, z: 0 }, b: { x: W, z: D } },
      { id: 'roof-main-edge-rear', a: { x: W, z: D }, b: { x: 0, z: D } },
      { id: 'roof-main-edge-west', a: { x: 0, z: D }, b: { x: 0, z: 0 } },
    ]
    const parapets = [
      panel('parapet-front', { x: 0, z: 0 }, { x: W, z: 0 }, 'ring-0-w0'),
      panel('parapet-east', { x: W, z: tp }, { x: W, z: D - tp }, 'ring-0-w1'),
      panel('parapet-rear', { x: W, z: D }, { x: 0, z: D }, 'ring-0-w2'),
      panel('parapet-west', { x: 0, z: D - tp }, { x: 0, z: tp }, 'ring-0-w3'),
    ]
    const parapetIds = ['parapet-front', 'parapet-east', 'parapet-rear', 'parapet-west']
    return [
      ...start([{ id: 'level-0', index: 0, elevation: 0, height: 3 }]),
      planeThrough({ id: plane, levelId: 'level-0', boundary: rect(0, 0, W, D), at: { x: 0, z: 0 }, undersideY: H, pitchDeg: 0, downslope: { x: 0, z: -1 }, thickness: tr, name: 'flat roof' }),
      ...edges.map((e): Cmd => ({ type: 'createRoofEdge', id: e.id, kind: 'BOUNDARY', planeId: plane, start: e.a, end: e.b, evidence: synthetic(e.id) })),
      ring({ id: 'ring-0', levelId: 'level-0', polygon: rect(0, 0, W, D), thickness: T, height: H, followPlanes: [plane] }),
      ...parapets,
      assembly({ id: 'roof-main', kind: 'ROOF', classification: 'FLAT', planeIds: [plane], edgeIds: edges.map((e) => e.id), openingIds: [], dormerIds: [], chimneyIds: [], trimIds: parapetIds, hostIds: [], quality: 'COMPLETE' }),
      ...[0, 1, 2, 3].map((i) => rel('SUPPORTED_BY', plane, `ring-0-w${i}`)),
      ...parapetIds.map((p) => rel('SUPPORTED_BY', p, plane)),
      ...parapetIds.map((p, i) => rel('ALIGNS_WITH', p, `ring-0-w${i}`)),
      ...parapetIds.map((p, i) => rel('ATTACHED_TO', p, edges[i].id)),
      ...frontOpenings('ring-0-w0', W),
    ]
  },
  expect: { assemblies: { ROOF: 1 }, primitives: { RoofPlane: 1, Parapet: 4, RoofBoundary: 4 }, roofClassifications: ['FLAT'], minRelationships: 16 },
}

/**
 * Intersecting gables: a main gable along x and a front wing whose gable runs
 * along z; the wing's planes die into the main front plane along two valleys.
 * One wall ring follows the T-shaped footprint.
 */
export const roofIntersectingGables: ArchitecturalFixture = {
  id: 'roof-intersecting-gables',
  title: 'Intersecting gables joined by two valleys',
  capabilities: ['ROOF_INTERSECTION', 'ROOF_VALLEY'],
  commands: () => {
    const W = 10
    const D = 8
    const o = 0.5
    const wx0 = 2
    const wx1 = 8
    const wz = -6
    const pitch = 35
    const tr = 0.25
    const mid = D / 2
    const wmid = (wx0 + wx1) / 2
    // one pitch, one eave height: the wing ridge dies into the main front slope where the heights meet,
    // as far up the slope as the wing is half wide
    const zMeet = round((wx1 - wx0) / 2)
    const v = (x: number, z: number) => ({ x, z })
    const planes: Cmd[] = [
      planeThrough({ id: 'roof-main-plane-front', levelId: 'level-0', boundary: [v(-o, -o), v(wx0 - o, -o), v(wmid, zMeet), v(wx1 + o, -o), v(W + o, -o), v(W + o, mid), v(-o, mid)], at: v(0, 0), undersideY: H, pitchDeg: pitch, downslope: v(0, -1), thickness: tr, name: 'main front slope' }),
      planeThrough({ id: 'roof-main-plane-rear', levelId: 'level-0', boundary: rect(-o, mid, W + o, D + o), at: v(0, D), undersideY: H, pitchDeg: pitch, downslope: v(0, 1), thickness: tr, name: 'main rear slope' }),
      planeThrough({ id: 'roof-wing-plane-west', levelId: 'level-0', boundary: [v(wx0 - o, wz - o), v(wmid, wz - o), v(wmid, zMeet), v(wx0 - o, -o)], at: v(wx0, 0), undersideY: H, pitchDeg: pitch, downslope: v(-1, 0), thickness: tr, name: 'wing west slope' }),
      planeThrough({ id: 'roof-wing-plane-east', levelId: 'level-0', boundary: [v(wmid, wz - o), v(wx1 + o, wz - o), v(wx1 + o, -o), v(wmid, zMeet)], at: v(wx1, 0), undersideY: H, pitchDeg: pitch, downslope: v(1, 0), thickness: tr, name: 'wing east slope' }),
    ]
    const planeIds = ['roof-main-plane-front', 'roof-main-plane-rear', 'roof-wing-plane-west', 'roof-wing-plane-east']
    const joins: Cmd[] = [
      { type: 'connectRoofPlanes', id: 'roof-main-ridge', kind: 'RIDGE', planeIds: ['roof-main-plane-front', 'roof-main-plane-rear'], evidence: synthetic('ridge') },
      { type: 'connectRoofPlanes', id: 'roof-wing-ridge', kind: 'RIDGE', planeIds: ['roof-wing-plane-west', 'roof-wing-plane-east'], evidence: synthetic('ridge') },
      { type: 'connectRoofPlanes', id: 'roof-valley-west', kind: 'VALLEY', planeIds: ['roof-wing-plane-west', 'roof-main-plane-front'], evidence: synthetic('valley') },
      { type: 'connectRoofPlanes', id: 'roof-valley-east', kind: 'VALLEY', planeIds: ['roof-wing-plane-east', 'roof-main-plane-front'], evidence: synthetic('valley') },
    ]
    const free: Array<[string, 'EAVE' | 'VERGE', string, { x: number; z: number }, { x: number; z: number }]> = [
      ['roof-eave-front-west', 'EAVE', 'roof-main-plane-front', v(-o, -o), v(wx0 - o, -o)],
      ['roof-eave-front-east', 'EAVE', 'roof-main-plane-front', v(wx1 + o, -o), v(W + o, -o)],
      ['roof-eave-rear', 'EAVE', 'roof-main-plane-rear', v(W + o, D + o), v(-o, D + o)],
      ['roof-eave-wing-west', 'EAVE', 'roof-wing-plane-west', v(wx0 - o, -o), v(wx0 - o, wz - o)],
      ['roof-eave-wing-east', 'EAVE', 'roof-wing-plane-east', v(wx1 + o, wz - o), v(wx1 + o, -o)],
      ['roof-verge-main-west-front', 'VERGE', 'roof-main-plane-front', v(-o, mid), v(-o, -o)],
      ['roof-verge-main-west-rear', 'VERGE', 'roof-main-plane-rear', v(-o, D + o), v(-o, mid)],
      ['roof-verge-main-east-front', 'VERGE', 'roof-main-plane-front', v(W + o, -o), v(W + o, mid)],
      ['roof-verge-main-east-rear', 'VERGE', 'roof-main-plane-rear', v(W + o, mid), v(W + o, D + o)],
      ['roof-verge-wing-west', 'VERGE', 'roof-wing-plane-west', v(wx0 - o, wz - o), v(wmid, wz - o)],
      ['roof-verge-wing-east', 'VERGE', 'roof-wing-plane-east', v(wmid, wz - o), v(wx1 + o, wz - o)],
    ]
    const freeEdges: Cmd[] = free.map(([id, kind, planeId, a, b]) => ({ type: 'createRoofEdge', id, kind, planeId, start: a, end: b, evidence: synthetic(id), board: { id: `${id}-board`, height: 0.22, depth: 0.04, materialId: MAT.trim } }))
    const footprint = [v(0, 0), v(wx0, 0), v(wx0, wz), v(wx1, wz), v(wx1, 0), v(W, 0), v(W, D), v(0, D)]
    return [
      ...start([{ id: 'level-0', index: 0, elevation: 0, height: 3 }]),
      ...planes,
      ...joins,
      ...freeEdges,
      ring({ id: 'ring-0', levelId: 'level-0', polygon: footprint, thickness: T, height: 7, followPlanes: planeIds }),
      assembly({ id: 'roof-main', kind: 'ROOF', classification: 'INTERSECTING', planeIds, edgeIds: ['roof-main-ridge', 'roof-wing-ridge', 'roof-valley-west', 'roof-valley-east', ...free.map((f) => f[0])], openingIds: [], dormerIds: [], chimneyIds: [], trimIds: free.map((f) => `${f[0]}-board`), hostIds: [], quality: 'COMPLETE' }),
      rel('SUPPORTED_BY', 'roof-main-plane-rear', 'ring-0-w6'),
      rel('SUPPORTED_BY', 'roof-wing-plane-west', 'ring-0-w1'),
      rel('SUPPORTED_BY', 'roof-wing-plane-east', 'ring-0-w3'),
      rel('MEETS', 'roof-wing-plane-west', 'roof-main-plane-front'),
      rel('MEETS', 'roof-wing-plane-east', 'roof-main-plane-front'),
      ...doorIn('ring-0-w2', 'door-front', 2.5, 1.0, 2.1, 'ENTRANCE'),
    ]
  },
  expect: { assemblies: { ROOF: 1 }, primitives: { RoofPlane: 4, Ridge: 2, Valley: 2, Eave: 5, Verge: 6 }, roofClassifications: ['INTERSECTING'], minRelationships: 5 },
}

/**
 * Stepped roof levels: a two-storey body under a flat roof and a single-storey
 * wing beside it under a lower flat roof; the two planes meet in plan along
 * the body's wall at different heights — a roof step, closed by that wall.
 */
export const roofSteppedLevels: ArchitecturalFixture = {
  id: 'roof-stepped-levels',
  title: 'Stepped roof levels: an upper and a lower flat roof, one roof step',
  capabilities: ['ROOF_STEP', 'ROOF_FLAT'],
  commands: () => {
    const tr = 0.25
    const Hu = 5.8
    const Hl = 3.0
    const upper = 'roof-main-plane-upper'
    const lower = 'roof-main-plane-lower'
    return [
      ...start([{ id: 'level-0', index: 0, elevation: 0, height: 3 }]),
      planeThrough({ id: upper, levelId: 'level-0', boundary: rect(0, 0, 8, 8), at: { x: 0, z: 0 }, undersideY: Hu, pitchDeg: 0, downslope: { x: 0, z: -1 }, thickness: tr, name: 'upper flat roof' }),
      planeThrough({ id: lower, levelId: 'level-0', boundary: rect(8, 1, 13, 5), at: { x: 8, z: 1 }, undersideY: Hl, pitchDeg: 0, downslope: { x: 0, z: -1 }, thickness: tr, name: 'lower flat roof' }),
      { type: 'connectRoofPlanes', id: 'roof-main-step', kind: 'ROOF_STEP', planeIds: [upper, lower], evidence: synthetic('roof step') },
      ...[
        ['roof-upper-edge-front', upper, { x: 0, z: 0 }, { x: 8, z: 0 }],
        ['roof-upper-edge-rear', upper, { x: 8, z: 8 }, { x: 0, z: 8 }],
        ['roof-upper-edge-west', upper, { x: 0, z: 8 }, { x: 0, z: 0 }],
        ['roof-lower-edge-front', lower, { x: 8, z: 1 }, { x: 13, z: 1 }],
        ['roof-lower-edge-east', lower, { x: 13, z: 1 }, { x: 13, z: 5 }],
        ['roof-lower-edge-rear', lower, { x: 13, z: 5 }, { x: 8, z: 5 }],
      ].map(([id, planeId, a, b]): Cmd => ({ type: 'createRoofEdge', id: id as string, kind: 'BOUNDARY', planeId: planeId as string, start: a as { x: number; z: number }, end: b as { x: number; z: number }, evidence: synthetic(id as string) })),
      ring({ id: 'ring-0', levelId: 'level-0', polygon: rect(0, 0, 8, 8), thickness: T, height: Hu, followPlanes: [upper] }),
      // the wing: three walls against the body's east wall
      { type: 'createWall', id: 'wing-front', levelId: 'level-0', start: { x: 8, z: 1 }, end: { x: 13, z: 1 }, thickness: T, height: Hl, topProfile: { kind: 'FOLLOW_ROOF_PLANES', planeIds: [lower] }, materialId: MAT.wall, startJunction: { kind: 'T', againstWallId: 'ring-0-w1' }, evidence: synthetic('wing') },
      { type: 'createWall', id: 'wing-east', levelId: 'level-0', start: { x: 13, z: 1 }, end: { x: 13, z: 5 }, thickness: T, height: Hl, topProfile: { kind: 'FOLLOW_ROOF_PLANES', planeIds: [lower] }, materialId: MAT.wall, startJunction: { kind: 'CORNER', with: { wallId: 'wing-front', end: 'END' }, owner: 'OTHER' }, evidence: synthetic('wing') },
      { type: 'createWall', id: 'wing-rear', levelId: 'level-0', start: { x: 13, z: 5 }, end: { x: 8, z: 5 }, thickness: T, height: Hl, topProfile: { kind: 'FOLLOW_ROOF_PLANES', planeIds: [lower] }, materialId: MAT.wall, startJunction: { kind: 'CORNER', with: { wallId: 'wing-east', end: 'END' }, owner: 'SELF' }, endJunction: { kind: 'T', againstWallId: 'ring-0-w1' }, evidence: synthetic('wing') },
      assembly({ id: 'roof-main', kind: 'ROOF', classification: 'STEPPED', planeIds: [upper, lower], edgeIds: ['roof-main-step', 'roof-upper-edge-front', 'roof-upper-edge-rear', 'roof-upper-edge-west', 'roof-lower-edge-front', 'roof-lower-edge-east', 'roof-lower-edge-rear'], openingIds: [], dormerIds: [], chimneyIds: [], trimIds: [], hostIds: [], quality: 'COMPLETE' }),
      rel('SUPPORTED_BY', upper, 'ring-0-w0'),
      rel('SUPPORTED_BY', lower, 'wing-front'),
      rel('SUPPORTED_BY', lower, 'wing-east'),
      rel('MEETS', lower, 'ring-0-w1'),
      rel('ABOVE', upper, lower),
      ...doorIn('ring-0-w0', 'door-front', 3.5, 1.0, 2.1, 'ENTRANCE'),
      ...windowIn('ring-0-w0', 'window-upper', 3.0, 3.8, 2.0, 1.4),
    ]
  },
  expect: { assemblies: { ROOF: 1 }, primitives: { RoofPlane: 2, RoofStep: 1, RoofBoundary: 6 }, roofClassifications: ['STEPPED'], minRelationships: 5 },
}

/** The dormer host: a one-and-a-half-storey gable house whose front slope takes a dormer. */
export function dormerHost(): { commands: Cmd[]; frontPlane: string } {
  const h = gableHouse({ W: 10, D: 8, H, t: T, pitchDeg: 40, overhang: 0.5, roofThickness: 0.25 })
  return { commands: [...h.commands, ...frontOpenings(h.walls.front, 10)], frontPlane: h.roof.planeIds[0] }
}

export const roofDormerGable: ArchitecturalFixture = {
  id: 'roof-dormer-gable',
  title: 'Gable dormer cut into the front slope',
  capabilities: ['ROOF_DORMER', 'ROOF_VALLEY', 'ROOF_GABLE'],
  commands: () => {
    const host = dormerHost()
    const t = Math.tan((40 * Math.PI) / 180)
    // the dormer front 1 m up the slope from the wall line; its eave 1.3 m above the host there
    const frontY = H + 0.25 / Math.cos((40 * Math.PI) / 180) + 1.0 * t
    return [
      ...host.commands,
      { type: 'createDormer', id: 'dormer-front', hostPlaneId: host.frontPlane, hostRoofAssemblyId: 'roof-main', dormerType: 'GABLE', front: { start: { x: 3.5, z: 1.0 }, end: { x: 5.5, z: 1.0 } }, eaveY: round(frontY + 1.3), ridgeY: round(frontY + 1.3 + 1.0 * t), wallThickness: 0.2, roofThickness: 0.2, frontOverhang: 0.3, wallMaterialId: MAT.wall, roofMaterialId: MAT.roof, window: { width: 1.2, height: 0.9, sillAboveRoof: 0.3 }, evidence: synthetic('dormer') },
    ]
  },
  expect: { assemblies: { ROOF: 2, DORMER: 1 }, primitives: { RoofPlane: 4, Valley: 2, Ridge: 2, RoofOpening: 1, Window: 3 }, roofClassifications: ['GABLE', 'GABLE'], minRelationships: 10 },
}

export const roofDormerShed: ArchitecturalFixture = {
  id: 'roof-dormer-shed',
  title: 'Shed dormer cut into the front slope',
  capabilities: ['ROOF_DORMER', 'ROOF_VALLEY', 'ROOF_SHED'],
  commands: () => {
    const host = dormerHost()
    const t = Math.tan((40 * Math.PI) / 180)
    const frontY = H + 0.25 / Math.cos((40 * Math.PI) / 180) + 1.0 * t
    return [
      ...host.commands,
      { type: 'createDormer', id: 'dormer-front', hostPlaneId: host.frontPlane, hostRoofAssemblyId: 'roof-main', dormerType: 'SHED', front: { start: { x: 3.0, z: 1.0 }, end: { x: 7.0, z: 1.0 } }, eaveY: round(frontY + 1.25), shedPitchDeg: 12, wallThickness: 0.2, roofThickness: 0.2, frontOverhang: 0.3, wallMaterialId: MAT.wall, roofMaterialId: MAT.roof, window: { width: 2.4, height: 0.7, sillAboveRoof: 0.25 }, evidence: synthetic('dormer') },
    ]
  },
  expect: { assemblies: { ROOF: 2, DORMER: 1 }, primitives: { RoofPlane: 3, Valley: 1, RoofOpening: 1 }, roofClassifications: ['SHED', 'GABLE'], minRelationships: 8 },
}
