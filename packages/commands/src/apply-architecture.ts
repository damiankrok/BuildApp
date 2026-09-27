/**
 * Execution of the schema 1.6.0 commands: roof planes and the roof graph,
 * dormers, columns and beams, wall panels, platforms, exterior step runs,
 * assemblies and relationships.
 *
 * Every command here is deterministic: derived geometry (an edge's endpoints,
 * a dormer's valleys, a board along an eave) is computed from the model and
 * the command alone, and every derived id hangs off an id the command states
 * or the model's own `nextId`. The draft is re-validated as a whole by
 * `applyCommand` afterwards, so a command that would leave the roof graph
 * inconsistent is refused there, with the validator's code.
 */
import {
  hasObject,
  layoutDormer,
  linearSolidBasis,
  nextId,
  polygonBounds,
  roofJoinShape,
  roofPlaneBoundaries,
  roofPlaneTopAt,
  segmentOnBoundaries,
  sharedBoundarySegments,
  type Assembly,
  type CanonicalBuildingModel,
  type RoofEdge,
  type RoofPlane,
  type SemanticKind,
  type Vec2,
  type Vec3,
} from '@buildapp/model'
import type { ResolvedCommand } from './commands.js'

export type ArchitectureHelpers = {
  model: CanonicalBuildingModel
  add: (collection: keyof CanonicalBuildingModel, kind: SemanticKind, obj: { id?: string } & Record<string, unknown>) => string
  replace: (collection: keyof CanonicalBuildingModel, id: string, next: object) => void
  fail: (code: string, message: string, objectId?: string) => void
  common: (c: { name?: string; evidence?: unknown; tags?: string[] }) => Record<string, unknown>
}

type ArchitectureCommand = Extract<
  ResolvedCommand,
  { type: 'createRoofPlane' | 'connectRoofPlanes' | 'createRoofEdge' | 'createDormer' | 'createColumn' | 'createBeam' | 'createWallPanel' | 'createPlatform' | 'createStepRun' | 'createAssembly' | 'createRelationship' }
>

export const ARCHITECTURE_COMMAND_TYPES: ReadonlySet<string> = new Set([
  'createRoofPlane',
  'connectRoofPlanes',
  'createRoofEdge',
  'createDormer',
  'createColumn',
  'createBeam',
  'createWallPanel',
  'createPlatform',
  'createStepRun',
  'createAssembly',
  'createRelationship',
])

export const isArchitectureCommand = (c: ResolvedCommand): c is ArchitectureCommand => ARCHITECTURE_COMMAND_TYPES.has(c.type)

const normalize2 = (v: Vec2): Vec2 | null => {
  const l = Math.hypot(v.x, v.z)
  return l > 1e-12 ? { x: v.x / l, z: v.z / l } : null
}

const on = (p: RoofPlane, q: Vec2): Vec3 => ({ x: q.x, y: roofPlaneTopAt(p, q.x, q.z), z: q.z })

export function executeArchitecture(h: ArchitectureHelpers, c: ArchitectureCommand): void {
  const m = h.model
  const plane = (id: string): RoofPlane | undefined => m.roofPlanes.find((p) => p.id === id)
  switch (c.type) {
    case 'createRoofPlane': {
      const ds = normalize2(c.downslope)
      if (!ds) return h.fail('INVALID_COMMAND', 'createRoofPlane: downslope must be a direction, not zero')
      h.add('roofPlanes', 'roofPlane', { id: c.id, ...h.common(c), levelId: c.levelId, boundary: c.boundary, datum: c.datum, pitchDeg: c.pitchDeg, downslope: ds, thickness: c.thickness, materialId: c.materialId })
      return
    }
    case 'connectRoofPlanes': {
      let [A, B] = c.planeIds.map(plane)
      if (!A || !B) return h.fail('UNKNOWN_ROOF_PLANE', `connectRoofPlanes: ${!A ? c.planeIds[0] : c.planeIds[1]} is not a roof plane`)
      let segments = sharedBoundarySegments(roofPlaneBoundaries(m, A), roofPlaneBoundaries(m, B))
      if (c.segment) {
        const want = c.segment
        segments = segments.filter((s) => segmentOnBoundaries(want.start, want.end, [[s.a, s.b, s.a]]))
        if (segments.length === 1) segments = [{ a: want.start, b: want.end }]
      }
      if (segments.length === 0) return h.fail('ROOF_PLANES_NOT_ADJACENT', `connectRoofPlanes: ${A.id} and ${B.id} share no boundary stretch${c.segment ? ' along the stated segment' : ''}`)
      if (segments.length > 1) return h.fail('ROOF_JOIN_AMBIGUOUS', `connectRoofPlanes: ${A.id} and ${B.id} share ${segments.length} boundary stretches; state the segment`)
      const seg = segments[0]
      let kind = c.kind
      if (kind === 'AUTO' || kind === 'ROOF_STEP') {
        const into = intoOuter(seg.a, seg.b, A.boundary)
        const shape = into ? roofJoinShape(A, B, seg.a, seg.b, into) : 'FLUSH'
        if (kind === 'AUTO') {
          if (shape === 'FLUSH') return h.fail('ROOF_JOIN_AMBIGUOUS', `connectRoofPlanes: ${A.id} and ${B.id} are one continuous plane along their shared edge; there is no crease to name`)
          const level = Math.abs(roofPlaneTopAt(A, seg.a.x, seg.a.z) - roofPlaneTopAt(A, seg.b.x, seg.b.z)) <= 1e-6
          kind = shape === 'STEP' ? 'ROOF_STEP' : shape === 'CONCAVE' ? 'VALLEY' : level ? 'RIDGE' : 'HIP'
        }
        if (kind === 'ROOF_STEP') {
          const mid = { x: (seg.a.x + seg.b.x) / 2, z: (seg.a.z + seg.b.z) / 2 }
          if (roofPlaneTopAt(B, mid.x, mid.z) > roofPlaneTopAt(A, mid.x, mid.z)) [A, B] = [B, A]
        }
      }
      h.add('roofEdges', 'roofEdge', { id: c.id, ...h.common(c), kind, planeIds: [A.id, B.id], start: on(A, seg.a), end: on(A, seg.b) })
      return
    }
    case 'createRoofEdge': {
      const p = plane(c.planeId)
      if (!p) return h.fail('UNKNOWN_ROOF_PLANE', `createRoofEdge: ${c.planeId} is not a roof plane`, c.planeId)
      const edgeId = h.add('roofEdges', 'roofEdge', { id: c.id, ...h.common(c), kind: c.kind, planeIds: [p.id], start: on(p, c.start), end: on(p, c.end) })
      if (c.board) {
        const edge = m.roofEdges.find((e) => e.id === edgeId) as RoofEdge
        const board = edgeBoard(m, p, edge, c.board.height, c.board.depth)
        if (!board) return h.fail('ROOF_EDGE_INVALID', `createRoofEdge: plane ${p.id} has material on neither side of edge ${edgeId}`, edgeId)
        const boardId = h.add('linearSolids', 'linearSolid', {
          id: c.board.id ?? `${edgeId}-board`,
          // the board is read with its edge: same provenance
          ...(c.evidence ? { evidence: c.evidence } : {}),
          levelId: p.levelId,
          hostId: edgeId,
          start: board.start,
          end: board.end,
          width: c.board.height,
          depth: c.board.depth,
          role: c.kind === 'VERGE' ? 'VERGE_BOARD' : 'FASCIA',
          materialId: c.board.materialId,
        })
        if (c.kind === 'VERGE') plumbCutAtApex(h, boardId, edge)
      }
      return
    }
    case 'createDormer':
      return createDormer(h, c)
    case 'createColumn': {
      const level = m.levels.find((l) => l.id === c.levelId)
      if (!level) return h.fail('UNKNOWN_LEVEL', `createColumn: level "${c.levelId}" does not exist`, c.levelId)
      const y0 = level.elevation + c.baseOffset
      h.add('linearSolids', 'linearSolid', { id: c.id, ...h.common(c), levelId: c.levelId, hostId: c.hostId, start: { x: c.base.x, y: y0, z: c.base.z }, end: { x: c.base.x, y: y0 + c.height, z: c.base.z }, width: c.width, depth: c.depth, rollDeg: c.rollDeg, role: c.role, materialId: c.materialId })
      return
    }
    case 'createBeam':
      h.add('linearSolids', 'linearSolid', { id: c.id, ...h.common(c), levelId: c.levelId, hostId: c.hostId, start: c.start, end: c.end, width: c.width, depth: c.depth, rollDeg: c.rollDeg, role: c.role, materialId: c.materialId })
      return
    case 'createWallPanel':
      h.add('wallPanels', 'wallPanel', { id: c.id, ...h.common(c), levelId: c.levelId, role: c.role, start: c.start, end: c.end, thickness: c.thickness, bottom: c.bottom, top: c.top, hostId: c.hostId, materialId: c.materialId })
      return
    case 'createPlatform':
      h.add('platforms', 'platform', { id: c.id, ...h.common(c), levelId: c.levelId, role: c.role, polygon: c.polygon, topOffset: c.topOffset, thickness: c.thickness, slope: c.slope, hostWallIds: c.hostWallIds.length > 0 ? c.hostWallIds : undefined, materialId: c.materialId })
      return
    case 'createStepRun': {
      const dir = normalize2(c.direction)
      if (!dir) return h.fail('INVALID_COMMAND', 'createStepRun: direction must be a direction, not zero')
      if ((c.rise === undefined) === (c.topOffset === undefined)) return h.fail('INVALID_COMMAND', 'createStepRun: state the rise of a step or the top of the last tread (topOffset), exactly one')
      const rise = c.rise ?? ((c.topOffset as number) - c.baseOffset) / c.steps
      if (!(rise > 0)) return h.fail('STEP_RUN_INVALID', `createStepRun: the run must climb; a rise of ${rise} m does not`)
      h.add('stepRuns', 'stepRun', { id: c.id, ...h.common(c), levelId: c.levelId, role: c.role, start: c.start, direction: dir, width: c.width, steps: c.steps, going: c.going, rise, baseOffset: c.baseOffset, construction: c.construction, treadThickness: c.treadThickness, materialId: c.materialId })
      return
    }
    case 'createAssembly': {
      if (m.assemblies.some((a) => a.id === c.assembly.id)) return h.fail('DUPLICATE_ID', `createAssembly: an assembly ${c.assembly.id} already exists`, c.assembly.id)
      h.add('assemblies', 'assembly', c.assembly as unknown as Record<string, unknown> & { id: string })
      return
    }
    case 'createRelationship':
      h.add('relationships', 'relationship', { id: c.id ?? relationshipId(m, c.kind, c.from, c.to), ...h.common(c), kind: c.kind, from: c.from, to: c.to, note: c.note })
      return
  }
}

/** A relationship's default id: readable and stable, `rel-<from>-<kind>-<to>`, with the model's next free suffix if that is taken. */
function relationshipId(m: CanonicalBuildingModel, kind: string, from: string, to: string): string {
  const base = `rel-${from}-${kind.toLowerCase().replace(/_/g, '-')}-${to}`
  return hasObject(m, base) ? nextId(m, 'relationship') : base
}

function intoOuter(a: Vec2, b: Vec2, poly: readonly Vec2[]): Vec2 | null {
  const L = Math.hypot(b.x - a.x, b.z - a.z)
  if (L <= 0) return null
  const n = { x: -(b.z - a.z) / L, z: (b.x - a.x) / L }
  const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }
  const step = Math.min(0.01, L / 10)
  const inside = (p: Vec2): boolean => {
    let inn = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const pi = poly[i]
      const pj = poly[j]
      if (pi.z > p.z !== pj.z > p.z && p.x < ((pj.x - pi.x) * (p.z - pi.z)) / (pj.z - pi.z) + pi.x) inn = !inn
    }
    return inn
  }
  if (inside({ x: mid.x + n.x * step, z: mid.z + n.z * step })) return n
  if (inside({ x: mid.x - n.x * step, z: mid.z - n.z * step })) return { x: -n.x, z: -n.z }
  return null
}

/**
 * Two verge boards that meet end to end at a gable apex — the ends of their
 * edges coincide and they stand proud of the same gable face — are cut
 * plumb there: each ends in the vertical plane through the apex that bisects
 * the angle between them, so they meet in one face instead of overlapping.
 * The cut is stated on both boards (the one already in the model is
 * restated), so the joint is model data the compiler follows.
 */
function plumbCutAtApex(h: ArchitectureHelpers, boardId: string, edge: RoofEdge): void {
  const m = h.model
  const board = m.linearSolids.find((s) => s.id === boardId)
  if (!board) return
  const near = (a: Vec3, b: Vec3): boolean => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) <= 1e-6
  const dirOf = (a: Vec3, b: Vec3): Vec3 => {
    const l = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
    return { x: (b.x - a.x) / l, y: (b.y - a.y) / l, z: (b.z - a.z) / l }
  }
  const mine = linearSolidBasis(board)
  for (const other of m.linearSolids) {
    if (other.id === boardId || other.role !== 'VERGE_BOARD' || !other.hostId) continue
    const oe = m.roofEdges.find((e) => e.id === other.hostId)
    if (!oe || oe.kind !== 'VERGE') continue
    const theirs = linearSolidBasis(other)
    // the same gable face: both boards stand proud in the same horizontal direction
    const sameFace = Math.abs(mine.depthAxis.x * theirs.depthAxis.x + mine.depthAxis.z * theirs.depthAxis.z) > 1 - 1e-6 && Math.abs(mine.depthAxis.y) < 1e-6 && Math.abs(theirs.depthAxis.y) < 1e-6
    if (!sameFace) continue
    for (const [myEnd, apex] of [['end', edge.end], ['start', edge.start]] as const) {
      const theirEnd = near(oe.start, apex) ? 'start' : near(oe.end, apex) ? 'end' : null
      if (!theirEnd) continue
      // towards the apex along mine, away from it along theirs
      const into = myEnd === 'end' ? dirOf(edge.start, edge.end) : dirOf(edge.end, edge.start)
      const away = theirEnd === 'start' ? dirOf(oe.start, oe.end) : dirOf(oe.end, oe.start)
      const n = { x: into.x + away.x, y: into.y + away.y, z: into.z + away.z }
      const nl = Math.hypot(n.x, n.y, n.z)
      // a plumb cut only: the bisecting plane must be vertical (a mirrored pair about it)
      if (nl < 1e-6 || Math.abs(n.y) > 1e-6 * nl) continue
      // each board's cut normal points out of the board at that end: along `into` for mine, against `away` for theirs
      const mineCut = { point: { ...apex }, normal: { x: n.x / nl, y: 0, z: n.z / nl } }
      const theirCut = { point: { ...apex }, normal: { x: -n.x / nl, y: 0, z: -n.z / nl } }
      const self = m.linearSolids.find((s) => s.id === boardId)
      if (self) h.replace('linearSolids', boardId, { ...self, [myEnd === 'end' ? 'endCut' : 'startCut']: mineCut })
      h.replace('linearSolids', other.id, { ...other, [theirEnd === 'start' ? 'startCut' : 'endCut']: theirCut })
    }
  }
}

/**
 * The centreline of a board along a free edge: its top arris on the edge,
 * its inner face in the plane of the plate's edge face, standing `depth`
 * outside the plane and hanging `height` below the edge (measured across the
 * board, which for a sloping verge is square to the slope).
 */
function edgeBoard(m: CanonicalBuildingModel, p: RoofPlane, e: RoofEdge, height: number, depth: number): { start: Vec3; end: Vec3 } | null {
  const into = intoOuter({ x: e.start.x, z: e.start.z }, { x: e.end.x, z: e.end.z }, roofPlaneBoundaries(m, p)[0])
  if (!into) return null
  const basis = linearSolidBasis({ start: e.start, end: e.end })
  // depth axis: horizontal, square to the edge; point it outwards
  const sign = basis.depthAxis.x * -into.x + basis.depthAxis.z * -into.z >= 0 ? 1 : -1
  const out = { x: basis.depthAxis.x * sign, y: basis.depthAxis.y * sign, z: basis.depthAxis.z * sign }
  const w = basis.widthAxis
  const shift = (q: Vec3): Vec3 => ({ x: q.x + out.x * (depth / 2) - w.x * (height / 2), y: q.y + out.y * (depth / 2) - w.y * (height / 2), z: q.z + out.z * (depth / 2) - w.z * (height / 2) })
  return { start: shift(e.start), end: shift(e.end) }
}

function createDormer(h: ArchitectureHelpers, c: Extract<ArchitectureCommand, { type: 'createDormer' }>): void {
  const m = h.model
  const host = m.roofPlanes.find((p) => p.id === c.hostPlaneId)
  if (!host) return h.fail('UNKNOWN_ROOF_PLANE', `createDormer: ${c.hostPlaneId} is not a roof plane`, c.hostPlaneId)
  const level = m.levels.find((l) => l.id === host.levelId)
  if (!level) return h.fail('UNKNOWN_LEVEL', `createDormer: the host plane's level ${host.levelId} does not exist`)
  const r = layoutDormer({ type: c.dormerType, host, front: c.front, eaveY: c.eaveY, ridgeY: c.ridgeY, shedPitchDeg: c.shedPitchDeg, wallThickness: c.wallThickness, roofThickness: c.roofThickness, frontOverhang: c.frontOverhang })
  if (!r.ok) return h.fail('DORMER_LAYOUT_INVALID', `createDormer ${c.id}: ${r.reason}`, c.id)
  const L = r.layout
  const id = c.id
  const ev = c.evidence
  const cutId = h.add('roofOpenings', 'roofOpening', { id: `${id}-cut`, evidence: ev, roofId: host.id, kind: 'DORMER', footprint: polygonBounds(L.cutOutline), outline: L.cutOutline })
  const planeId = new Map<string, string>()
  for (const p of L.planes) {
    const pid = h.add('roofPlanes', 'roofPlane', { id: `${id}-roof${L.planes.length > 1 ? `-${p.key.toLowerCase()}` : ''}`, evidence: ev, levelId: host.levelId, boundary: p.boundary, datum: p.datum, pitchDeg: p.pitchDeg, downslope: p.downslope, thickness: p.thickness, materialId: c.roofMaterialId ?? host.materialId })
    planeId.set(p.key, pid)
  }
  const edgeIds: string[] = []
  for (const e of L.edges) {
    const planeIds = e.planes.map((k) => (k === 'HOST' ? host.id : (planeId.get(k) as string)))
    edgeIds.push(h.add('roofEdges', 'roofEdge', { id: `${id}-${e.key}`, evidence: ev, kind: e.kind, planeIds, start: e.start, end: e.end }))
  }
  const fw = L.frontWall
  const frontId = h.add('walls', 'wall', {
    id: `${id}-front`,
    evidence: ev,
    levelId: host.levelId,
    start: fw.start,
    end: fw.end,
    thickness: fw.thickness,
    height: fw.height,
    baseOffset: fw.baseY - level.elevation,
    kind: 'EXTERIOR',
    topProfile: { kind: 'FOLLOW_ROOF_PLANES', planeIds: [...planeId.values()] },
    materialId: c.wallMaterialId,
  })
  const openingIds: string[] = []
  if (c.window) {
    const w = c.window
    const offset = (L.width - w.width) / 2
    const sill = L.hostDropAtFront + w.sillAboveRoof
    const headroom = Math.min(L.frontUndersideAt(offset), L.frontUndersideAt(offset + w.width)) - fw.baseY
    if (offset <= 0.05 || sill + w.height > headroom - 0.05) return h.fail('DORMER_LAYOUT_INVALID', `createDormer ${id}: a ${w.width} × ${w.height} m window with its sill ${w.sillAboveRoof} m above the roof does not fit the ${L.width.toFixed(3)} m front wall under its roof`, id)
    const openingId = h.add('openings', 'opening', { id: `${id}-window-opening`, evidence: ev, wallId: frontId, kind: 'WINDOW', offset, sill, width: w.width, height: w.height })
    openingIds.push(openingId)
    h.add('windows', 'window', { id: `${id}-window`, evidence: ev, openingId, frameWidth: w.frameWidth, frameDepth: 0.08, frameInset: Math.min(0.06, Math.max(0, fw.thickness - 0.08)), glassThickness: 0.024, divisions: w.divisions, materialId: w.materialId })
  }
  const cheekIds: string[] = []
  for (const ch of L.cheeks) {
    cheekIds.push(h.add('wallPanels', 'wallPanel', { id: `${id}-cheek-${ch.key.toLowerCase()}`, evidence: ev, levelId: host.levelId, role: 'DORMER_CHEEK', start: ch.start, end: ch.end, thickness: ch.thickness, bottom: ch.bottom, top: ch.top, hostId: host.id, materialId: c.wallMaterialId }))
  }
  const localRoofId = `${id}-roof-assembly`
  const planes = [...planeId.values()]
  const classification = c.dormerType === 'GABLE' ? 'GABLE' : c.dormerType === 'SHED' ? 'SHED' : 'FLAT'
  h.add('assemblies', 'assembly', { id: localRoofId, kind: 'ROOF', evidence: ev, classification, planeIds: planes, edgeIds, openingIds: [], dormerIds: [], chimneyIds: [], trimIds: [], hostIds: [host.id], quality: 'COMPLETE' })
  const dormer: Assembly = {
    id,
    ...(c.name ? { name: c.name } : {}),
    ...(ev ? { evidence: ev } : {}),
    ...(c.tags ? { tags: c.tags } : {}),
    kind: 'DORMER',
    dormerType: c.dormerType,
    ...(c.hostRoofAssemblyId ? { hostRoofAssemblyId: c.hostRoofAssemblyId } : {}),
    hostPlaneIds: [host.id],
    footprintOnRoof: L.cutOutline,
    wallIds: [frontId, ...cheekIds],
    localRoofAssemblyId: localRoofId,
    cutOpeningId: cutId,
    openingIds,
    hostIds: [host.id],
    quality: 'COMPLETE',
  }
  h.add('assemblies', 'assembly', dormer as unknown as Record<string, unknown> & { id: string })
  const rel = (kind: string, from: string, to: string): void => {
    h.add('relationships', 'relationship', { id: `${id}-rel-${from.startsWith(id) ? from.slice(id.length + 1) : from}-${kind.toLowerCase().replace(/_/g, '-')}-${to.startsWith(id) ? to.slice(id.length + 1) : to}`, kind, from, to })
  }
  rel('HOSTED_BY', frontId, host.id)
  for (const ch of cheekIds) rel('HOSTED_BY', ch, host.id)
  for (const p of planes) {
    rel('SUPPORTED_BY', p, frontId)
    rel('MEETS', p, host.id)
  }
  // each dormer plane bears on the cheek under its eave: L on the left cheek, R on the right, a single plane on both
  const cheekOf = (key: string): string[] => (key === 'L' ? [cheekIds[0]] : key === 'R' ? [cheekIds[1]] : cheekIds)
  for (const p of L.planes) for (const ch of cheekOf(p.key)) rel('SUPPORTED_BY', planeId.get(p.key) as string, ch)
  if (c.hostRoofAssemblyId) {
    const roof = m.assemblies.find((a) => a.id === c.hostRoofAssemblyId)
    if (!roof || roof.kind !== 'ROOF') return h.fail('ASSEMBLY_REFERENCE_INVALID', `createDormer: ${c.hostRoofAssemblyId} is not a roof assembly`, c.hostRoofAssemblyId)
    h.replace('assemblies', roof.id, { ...roof, dormerIds: [...roof.dormerIds, id], openingIds: [...roof.openingIds, cutId] })
  }
}
