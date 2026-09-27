/**
 * Generic, parametric builders for the synthetic architectural diversity
 * fixtures: a house shell, a plane roof of each common composition, and the
 * exterior assemblies. Everything is stated as Building DSL commands —
 * nothing here writes a model record or a triangle — and every dimension is
 * a parameter a fixture chooses. No builder names or copies a real project.
 *
 * Conventions: level 0 is the ground floor (y = 0 at its finished floor);
 * the front facade is z = 0 and the building extends into +z; a rectangular
 * footprint is W along x and D along z. A roof plane is placed so that its
 * underside meets the wall outer face at the stated eave height, which is
 * what lets the walls follow it exactly (FOLLOW_ROOF_PLANES).
 */
import type { BuildingCommand } from '@buildapp/commands'
import { roofPlaneDrop, type Assembly, type Evidence, type RoofClassification, type Vec2, type Vec3 } from '@buildapp/model'

export type Cmd = BuildingCommand

export const SOURCE_ID = 'src-synthetic-fixture'

export const MAT = {
  wall: 'mat-wall',
  roof: 'mat-roof',
  flatRoof: 'mat-flat-roof-membrane',
  slab: 'mat-slab',
  trim: 'mat-trim',
  timber: 'mat-timber',
  steel: 'mat-steel',
  paving: 'mat-paving',
  concrete: 'mat-concrete',
  glass: 'mat-glass',
} as const

/** The provenance every synthetic object carries: honest about being synthetic, with a lineage to one evidence source. */
export const synthetic = (locator: string): Evidence => ({ status: 'SOURCE_DERIVED', source: 'synthetic architectural diversity fixture', locator, confidence: 1, sourceIds: [SOURCE_ID] })

export function start(levels: ReadonlyArray<{ id: string; index: number; elevation: number; height: number }>): Cmd[] {
  return [
    { type: 'createBuilding', id: 'building', evidence: synthetic('building') },
    { type: 'addEvidenceSource', id: SOURCE_ID, kind: 'DERIVATION', label: 'synthetic architectural diversity fixture (generic parameters, no project)' },
    ...levels.map((l): Cmd => ({ type: 'createLevel', id: l.id, index: l.index, elevation: l.elevation, height: l.height, evidence: synthetic(l.id) })),
    { type: 'defineMaterial', id: MAT.wall, name: 'render', color: '#e8e2d6' },
    { type: 'defineMaterial', id: MAT.roof, name: 'roof tiles', color: '#4a4541' },
    { type: 'defineMaterial', id: MAT.flatRoof, name: 'flat roof membrane', color: '#6b6661' },
    { type: 'defineMaterial', id: MAT.slab, name: 'concrete slab', color: '#bdb9b3' },
    { type: 'defineMaterial', id: MAT.trim, name: 'painted trim', color: '#f2eee7' },
    { type: 'defineMaterial', id: MAT.timber, name: 'timber', color: '#b08a5f' },
    { type: 'defineMaterial', id: MAT.steel, name: 'steel', color: '#55585c' },
    { type: 'defineMaterial', id: MAT.paving, name: 'paving', color: '#a39a8f' },
    { type: 'defineMaterial', id: MAT.concrete, name: 'fair-faced concrete', color: '#b3aea7' },
    { type: 'defineMaterial', id: MAT.glass, name: 'glazing', color: '#9ec0d6', opacity: 0.35 },
  ]
}

/** A rectangle as a counter-clockwise plan polygon. */
export const rect = (x0: number, z0: number, x1: number, z1: number): Vec2[] => [
  { x: x0, z: z0 },
  { x: x1, z: z0 },
  { x: x1, z: z1 },
  { x: x0, z: z1 },
]

export const round = (v: number): number => Math.round(v * 1e9) / 1e9

/** The world y of a plane's top surface where its underside meets `undersideY` — how far above a wall top the top surface lies. */
export const topAboveUnderside = (pitchDeg: number, thickness: number): number => roofPlaneDrop({ pitchDeg, thickness })

/**
 * A roof plane stated by where its underside passes: through the plan point
 * `at` at world height `undersideY`, falling towards `downslope`.
 */
export function planeThrough(p: { id: string; levelId: string; boundary: Vec2[]; at: Vec2; undersideY: number; pitchDeg: number; downslope: Vec2; thickness: number; materialId?: string; name?: string }): Cmd {
  return {
    type: 'createRoofPlane',
    id: p.id,
    name: p.name,
    evidence: synthetic(p.id),
    levelId: p.levelId,
    boundary: p.boundary,
    datum: { x: p.at.x, y: round(p.undersideY + topAboveUnderside(p.pitchDeg, p.thickness)), z: p.at.z },
    pitchDeg: p.pitchDeg,
    downslope: p.downslope,
    thickness: p.thickness,
    materialId: p.materialId ?? (p.pitchDeg === 0 ? MAT.flatRoof : MAT.roof),
  }
}

const roofAssembly = (id: string, classification: RoofClassification, planeIds: string[], edgeIds: string[], trimIds: string[] = [], extra: Partial<Extract<Assembly, { kind: 'ROOF' }>> = {}): Cmd => ({
  type: 'createAssembly',
  assembly: { id, kind: 'ROOF', name: `${classification.toLowerCase()} roof`, evidence: synthetic(id), classification, planeIds, edgeIds, openingIds: [], dormerIds: [], chimneyIds: [], trimIds, hostIds: [], quality: 'COMPLETE', ...extra },
})

export const rel = (kind: Extract<Cmd, { type: 'createRelationship' }>['kind'], from: string, to: string): Cmd => ({ type: 'createRelationship', kind, from, to, evidence: synthetic(`${from} ${kind} ${to}`) })

export type RoofResult = { commands: Cmd[]; planeIds: string[]; assemblyId: string; edgeIds: string[] }

/** Free edges with boards: fascia on eaves, verge boards on verges. */
function edgeWithBoard(id: string, kind: 'EAVE' | 'VERGE' | 'BOUNDARY' | 'ABUTMENT', planeId: string, a: Vec2, b: Vec2, board?: { height: number; depth: number }): Cmd {
  return { type: 'createRoofEdge', id, kind, planeId, start: a, end: b, evidence: synthetic(id), ...(board ? { board: { id: `${id}-board`, height: board.height, depth: board.depth, materialId: MAT.trim } } : {}) }
}

/**
 * A gable of two planes over a W × D footprint, ridge along x at D/2: eaves
 * front and rear with fascia boards, verges at both gable ends with verge
 * boards, the ridge found by CONNECT_ROOF_PLANES.
 */
export function gableRoof(p: { prefix: string; levelId: string; W: number; D: number; eaveY: number; pitchDeg: number; overhang: number; thickness: number; boards?: boolean; x0?: number; z0?: number }): RoofResult {
  const x0 = p.x0 ?? 0
  const z0 = p.z0 ?? 0
  const o = p.overhang
  const mid = z0 + p.D / 2
  const S = `${p.prefix}-plane-front`
  const N = `${p.prefix}-plane-rear`
  const board = p.boards === false ? undefined : { height: 0.22, depth: 0.04 }
  const commands: Cmd[] = [
    planeThrough({ id: S, levelId: p.levelId, boundary: rect(x0 - o, z0 - o, x0 + p.W + o, mid), at: { x: x0, z: z0 }, undersideY: p.eaveY, pitchDeg: p.pitchDeg, downslope: { x: 0, z: -1 }, thickness: p.thickness, name: 'front slope' }),
    planeThrough({ id: N, levelId: p.levelId, boundary: rect(x0 - o, mid, x0 + p.W + o, z0 + p.D + o), at: { x: x0, z: z0 + p.D }, undersideY: p.eaveY, pitchDeg: p.pitchDeg, downslope: { x: 0, z: 1 }, thickness: p.thickness, name: 'rear slope' }),
    { type: 'connectRoofPlanes', id: `${p.prefix}-ridge`, kind: 'RIDGE', planeIds: [S, N], evidence: synthetic('ridge') },
    edgeWithBoard(`${p.prefix}-eave-front`, 'EAVE', S, { x: x0 - o, z: z0 - o }, { x: x0 + p.W + o, z: z0 - o }, board),
    edgeWithBoard(`${p.prefix}-eave-rear`, 'EAVE', N, { x: x0 + p.W + o, z: z0 + p.D + o }, { x: x0 - o, z: z0 + p.D + o }, board),
    edgeWithBoard(`${p.prefix}-verge-front-west`, 'VERGE', S, { x: x0 - o, z: z0 - o }, { x: x0 - o, z: mid }, board),
    edgeWithBoard(`${p.prefix}-verge-front-east`, 'VERGE', S, { x: x0 + p.W + o, z: mid }, { x: x0 + p.W + o, z: z0 - o }, board),
    edgeWithBoard(`${p.prefix}-verge-rear-west`, 'VERGE', N, { x: x0 - o, z: mid }, { x: x0 - o, z: z0 + p.D + o }, board),
    edgeWithBoard(`${p.prefix}-verge-rear-east`, 'VERGE', N, { x: x0 + p.W + o, z: z0 + p.D + o }, { x: x0 + p.W + o, z: mid }, board),
  ]
  const edgeIds = [`${p.prefix}-ridge`, `${p.prefix}-eave-front`, `${p.prefix}-eave-rear`, `${p.prefix}-verge-front-west`, `${p.prefix}-verge-front-east`, `${p.prefix}-verge-rear-west`, `${p.prefix}-verge-rear-east`]
  const trims = board ? edgeIds.slice(1).map((e) => `${e}-board`) : []
  commands.push(roofAssembly(`${p.prefix}`, 'GABLE', [S, N], edgeIds, trims))
  return { commands, planeIds: [S, N], assemblyId: p.prefix, edgeIds }
}

/** A hip roof over W × D (W ≥ D): four planes of one pitch, four hips, a ridge along x. */
export function hipRoof(p: { prefix: string; levelId: string; W: number; D: number; eaveY: number; pitchDeg: number; overhang: number; thickness: number }): RoofResult {
  const o = p.overhang
  const half = p.D / 2 + o
  const rx0 = -o + half
  const rx1 = p.W + o - half
  const rz = p.D / 2
  const ids = { S: `${p.prefix}-plane-front`, N: `${p.prefix}-plane-rear`, W: `${p.prefix}-plane-west`, E: `${p.prefix}-plane-east` }
  const v = (x: number, z: number): Vec2 => ({ x, z })
  const base = { levelId: p.levelId, undersideY: p.eaveY, pitchDeg: p.pitchDeg, thickness: p.thickness }
  const commands: Cmd[] = [
    planeThrough({ ...base, id: ids.S, boundary: [v(-o, -o), v(p.W + o, -o), v(rx1, rz), v(rx0, rz)], at: v(0, 0), downslope: v(0, -1), name: 'front slope' }),
    planeThrough({ ...base, id: ids.N, boundary: [v(p.W + o, p.D + o), v(-o, p.D + o), v(rx0, rz), v(rx1, rz)], at: v(0, p.D), downslope: v(0, 1), name: 'rear slope' }),
    planeThrough({ ...base, id: ids.W, boundary: [v(-o, p.D + o), v(-o, -o), v(rx0, rz)], at: v(0, 0), downslope: v(-1, 0), name: 'west hip end' }),
    planeThrough({ ...base, id: ids.E, boundary: [v(p.W + o, -o), v(p.W + o, p.D + o), v(rx1, rz)], at: v(p.W, 0), downslope: v(1, 0), name: 'east hip end' }),
    { type: 'connectRoofPlanes', id: `${p.prefix}-ridge`, kind: 'AUTO', planeIds: [ids.S, ids.N], evidence: synthetic('ridge') },
    { type: 'connectRoofPlanes', id: `${p.prefix}-hip-sw`, kind: 'AUTO', planeIds: [ids.S, ids.W], evidence: synthetic('hip') },
    { type: 'connectRoofPlanes', id: `${p.prefix}-hip-se`, kind: 'AUTO', planeIds: [ids.S, ids.E], evidence: synthetic('hip') },
    { type: 'connectRoofPlanes', id: `${p.prefix}-hip-nw`, kind: 'AUTO', planeIds: [ids.N, ids.W], evidence: synthetic('hip') },
    { type: 'connectRoofPlanes', id: `${p.prefix}-hip-ne`, kind: 'AUTO', planeIds: [ids.N, ids.E], evidence: synthetic('hip') },
    edgeWithBoard(`${p.prefix}-eave-front`, 'EAVE', ids.S, v(-o, -o), v(p.W + o, -o), { height: 0.22, depth: 0.04 }),
    edgeWithBoard(`${p.prefix}-eave-rear`, 'EAVE', ids.N, v(p.W + o, p.D + o), v(-o, p.D + o), { height: 0.22, depth: 0.04 }),
    edgeWithBoard(`${p.prefix}-eave-west`, 'EAVE', ids.W, v(-o, p.D + o), v(-o, -o), { height: 0.22, depth: 0.04 }),
    edgeWithBoard(`${p.prefix}-eave-east`, 'EAVE', ids.E, v(p.W + o, -o), v(p.W + o, p.D + o), { height: 0.22, depth: 0.04 }),
  ]
  const edgeIds = [`${p.prefix}-ridge`, `${p.prefix}-hip-sw`, `${p.prefix}-hip-se`, `${p.prefix}-hip-nw`, `${p.prefix}-hip-ne`, `${p.prefix}-eave-front`, `${p.prefix}-eave-rear`, `${p.prefix}-eave-west`, `${p.prefix}-eave-east`]
  commands.push(roofAssembly(p.prefix, 'HIP', Object.values(ids), edgeIds, edgeIds.slice(5).map((e) => `${e}-board`)))
  return { commands, planeIds: Object.values(ids), assemblyId: p.prefix, edgeIds }
}

/** A mono-pitch roof falling to the front: eave at the front, a high boundary edge at the rear, verges at the sides. */
export function shedRoof(p: { prefix: string; levelId: string; W: number; D: number; eaveY: number; pitchDeg: number; overhang: number; thickness: number }): RoofResult {
  const o = p.overhang
  const id = `${p.prefix}-plane`
  const commands: Cmd[] = [
    planeThrough({ id, levelId: p.levelId, boundary: rect(-o, -o, p.W + o, p.D + o), at: { x: 0, z: 0 }, undersideY: p.eaveY, pitchDeg: p.pitchDeg, downslope: { x: 0, z: -1 }, thickness: p.thickness, name: 'mono-pitch' }),
    edgeWithBoard(`${p.prefix}-eave`, 'EAVE', id, { x: -o, z: -o }, { x: p.W + o, z: -o }, { height: 0.22, depth: 0.04 }),
    edgeWithBoard(`${p.prefix}-high-edge`, 'BOUNDARY', id, { x: p.W + o, z: p.D + o }, { x: -o, z: p.D + o }),
    edgeWithBoard(`${p.prefix}-verge-west`, 'VERGE', id, { x: -o, z: p.D + o }, { x: -o, z: -o }, { height: 0.22, depth: 0.04 }),
    edgeWithBoard(`${p.prefix}-verge-east`, 'VERGE', id, { x: p.W + o, z: -o }, { x: p.W + o, z: p.D + o }, { height: 0.22, depth: 0.04 }),
  ]
  const edgeIds = [`${p.prefix}-eave`, `${p.prefix}-high-edge`, `${p.prefix}-verge-west`, `${p.prefix}-verge-east`]
  commands.push(roofAssembly(p.prefix, 'SHED', [id], edgeIds, [`${p.prefix}-eave-board`, `${p.prefix}-verge-west-board`, `${p.prefix}-verge-east-board`]))
  return { commands, planeIds: [id], assemblyId: p.prefix, edgeIds }
}

/**
 * The wall ring of a storey whose walls die into roof planes. The nominal
 * height reaches past every underside so that the planes decide every top.
 */
export function ring(p: { id: string; levelId: string; polygon: Vec2[]; thickness: number; height: number; followPlanes?: string[]; cornerOwnership?: 'ALTERNATE' | 'PRECEDING' | 'FOLLOWING'; walls?: Array<{ height?: number }> }): Cmd {
  return {
    type: 'createWallRing',
    id: p.id,
    evidence: synthetic(p.id),
    levelId: p.levelId,
    polygon: p.polygon,
    thickness: p.thickness,
    height: p.height,
    materialId: MAT.wall,
    ...(p.followPlanes ? { topProfile: { kind: 'FOLLOW_ROOF_PLANES' as const, planeIds: p.followPlanes } } : {}),
    cornerOwnership: p.cornerOwnership ?? 'ALTERNATE',
    ...(p.walls ? { walls: p.walls } : {}),
  }
}

/** A window or a door in a wall, with its fill. */
export function windowIn(wallId: string, id: string, offset: number, sill: number, width: number, height: number): Cmd[] {
  return [
    { type: 'cutOpening', id: `${id}-opening`, wallId, kind: 'WINDOW', offset, sill, width, height, evidence: synthetic(id) },
    { type: 'placeWindow', id, openingId: `${id}-opening`, divisions: width > 1.2 ? 2 : 1, evidence: synthetic(id) },
  ]
}

export function doorIn(wallId: string, id: string, offset: number, width: number, height: number, usage: 'ENTRANCE' | 'GARAGE' | 'TERRACE' | 'SERVICE' | 'INTERIOR'): Cmd[] {
  return [
    { type: 'cutOpening', id: `${id}-opening`, wallId, kind: 'DOOR', offset, sill: 0, width, height, evidence: synthetic(id) },
    { type: 'placeDoor', id, openingId: `${id}-opening`, usage, evidence: synthetic(id) },
  ]
}

/**
 * A single-storey house under a plane gable roof: the ring, a front door and
 * windows. Returns its parts' ids for the exterior assemblies that attach.
 */
export function gableHouse(p: { W: number; D: number; H: number; t: number; pitchDeg: number; overhang: number; roofThickness: number; boards?: boolean }): { commands: Cmd[]; roof: RoofResult; walls: { front: string; east: string; rear: string; west: string }; ridgeUndersideY: number } {
  const roof = gableRoof({ prefix: 'roof-main', levelId: 'level-0', W: p.W, D: p.D, eaveY: p.H, pitchDeg: p.pitchDeg, overhang: p.overhang, thickness: p.roofThickness, boards: p.boards })
  const ridgeUndersideY = p.H + (p.D / 2) * Math.tan((p.pitchDeg * Math.PI) / 180)
  const commands: Cmd[] = [
    ...start([{ id: 'level-0', index: 0, elevation: 0, height: 3 }]),
    ...roof.commands,
    ring({ id: 'ring-0', levelId: 'level-0', polygon: rect(0, 0, p.W, p.D), thickness: p.t, height: round(ridgeUndersideY + 1), followPlanes: roof.planeIds }),
    rel('SUPPORTED_BY', roof.planeIds[0], 'ring-0-w0'),
    rel('SUPPORTED_BY', roof.planeIds[1], 'ring-0-w2'),
  ]
  return { commands, roof, walls: { front: 'ring-0-w0', east: 'ring-0-w1', rear: 'ring-0-w2', west: 'ring-0-w3' }, ridgeUndersideY }
}

/** A vertical member standing on `baseY` (world) up to `topY`, centred at `at`. */
export function post(id: string, levelId: string, role: 'COLUMN' | 'POST' | 'PERGOLA_POST', at: Vec2, baseY: number, topY: number, size: number, materialId: string): Cmd {
  return { type: 'createColumn', id, levelId, role, base: at, baseOffset: round(baseY), height: round(topY - baseY), width: size, depth: size, materialId, evidence: synthetic(id) }
}

/** A level beam whose TOP is at `topY`, along a plan segment. */
export function beam(id: string, levelId: string, role: 'BEAM' | 'PERGOLA_BEAM', a: Vec2, b: Vec2, topY: number, height: number, breadth: number, materialId: string): Cmd {
  const y = round(topY - height / 2)
  const s: Vec3 = { x: a.x, y, z: a.z }
  const e: Vec3 = { x: b.x, y, z: b.z }
  return { type: 'createBeam', id, levelId, role, start: s, end: e, width: height, depth: breadth, materialId, evidence: synthetic(id) }
}

export const assembly = (a: Assembly): Cmd => ({ type: 'createAssembly', assembly: { ...a, evidence: a.evidence ?? synthetic(a.id) } as Assembly })
