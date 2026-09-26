/**
 * Emitting a BuildingV2 as a Building DSL program.
 *
 * Every command is bound to the solved feature it came from, so the feature
 * graph can say which model object each feature became and the ledger can
 * say which evidence reached the model. Frame: MODEL_FRAME, front outer
 * plane z = 0, exterior rings anticlockwise from the front-west corner:
 * w0 front (x0→x1 at z0), w1 east (z0→z1 at x1), w2 rear (x1→x0 at z1),
 * w3 west (z1→z0 at x0).
 */
import { round6 } from '@buildapp/source-common'
import type { BuildingCommand } from '@buildapp/commands'
import type { EvidenceStatus } from '@buildapp/model'
import type { BuildingV2, MassV2 } from './building.js'
import type { ProvenanceStatus } from './graph.js'
import type { OpeningV2 } from './openings-v2.js'
import { CONVENTIONS } from '../solve.js'

export type Binding = { featureId: string; objectId: string; objectKind: string; commandIndex: number }

export type EmitResult = { program: BuildingCommand[]; bindings: Binding[]; notes: string[]; dropped: Array<{ featureId: string; why: string }> }

export const MATERIALS_V2 = {
  wall: 'mat-wall',
  slab: 'mat-slab',
  roof: 'mat-roof',
  member: 'mat-member',
  glass: 'mat-glass',
  dark: 'mat-render-dark',
  timber: 'mat-timber',
  partition: 'mat-partition',
  chimney: 'mat-chimney',
  terrace: 'mat-terrace',
  mid: 'mat-render-mid',
} as const

/** The material a broad tone read off the renders stands for. */
const materialForTone = (tone: string | undefined, fallback: string): string => (tone === 'DARK' ? MATERIALS_V2.dark : tone === 'MID' ? MATERIALS_V2.mid : fallback)

const modelStatus = (p: ProvenanceStatus): EvidenceStatus => {
  switch (p) {
    case 'SOURCE_EXACT':
      return 'SOURCE_EXACT'
    case 'SOURCE_CORROBORATED':
      return 'SOURCE_CORROBORATED'
    case 'SOURCE_DERIVED':
      return 'SOURCE_DERIVED'
    case 'IMAGE_METRIC_REGISTERED':
      return 'VISUAL_INFERRED'
    case 'VISUAL_SEMANTIC':
      return 'VISUAL_INFERRED'
    case 'ASSUMED_FOR_RENDERING':
      return 'ASSUMED'
    case 'UNRESOLVED':
      return 'UNRESOLVED'
  }
}

export const ringWallId = (massId: string, storey: number, side: 'FRONT' | 'EAST' | 'REAR' | 'WEST'): string => `ring-${massId}-${storey}-w${{ FRONT: 0, EAST: 1, REAR: 2, WEST: 3 }[side]}`

/** Where an opening sits along its ring wall, measured from the wall's start in the anticlockwise traversal. */
export function wallOffset(mass: MassV2, facade: OpeningV2['facade'], interval: [number, number]): { offset: number; reversed: boolean } {
  switch (facade) {
    case 'FRONT':
      return { offset: round6(interval[0] - mass.x0), reversed: false }
    case 'EAST':
      return { offset: round6(interval[0] - mass.z0), reversed: false }
    case 'REAR':
      return { offset: round6(mass.x1 - interval[1]), reversed: true }
    case 'WEST':
      return { offset: round6(mass.z1 - interval[1]), reversed: true }
  }
}

export function emitBuilding(b: BuildingV2, modelName: string, onDebug?: (line: string) => void): EmitResult {
  const program: BuildingCommand[] = []
  const bindings: Binding[] = []
  const notes: string[] = []
  const dropped: Array<{ featureId: string; why: string }> = []
  const push = (command: BuildingCommand, featureId?: string, objectKind?: string): void => {
    program.push(command)
    if (featureId && objectKind && 'id' in command && typeof command.id === 'string') bindings.push({ featureId, objectId: command.id, objectKind, commandIndex: program.length - 1 })
  }
  const evidence = (targetId: string, status: ProvenanceStatus, interpretation: string, properties?: Record<string, ProvenanceStatus>): void => {
    push({ type: 'setEvidence', targetId, evidence: { status: modelStatus(status), interpretation, ...(properties ? { properties: Object.fromEntries(Object.entries(properties).map(([k, v]) => [k, modelStatus(v)])) } : {}) } })
  }

  push({ type: 'setModelName', name: modelName })
  push({ type: 'createBuilding', id: 'bld-auto-v2', name: modelName })
  push({ type: 'defineMaterial', id: MATERIALS_V2.wall, name: 'Rendered wall', color: '#e8e4dc' })
  push({ type: 'defineMaterial', id: MATERIALS_V2.slab, name: 'Concrete slab', color: '#c9c6c0' })
  push({ type: 'defineMaterial', id: MATERIALS_V2.roof, name: 'Roof covering', color: '#5a5550' })
  push({ type: 'defineMaterial', id: MATERIALS_V2.member, name: 'Facade member', color: '#ece9e2' })
  push({ type: 'defineMaterial', id: MATERIALS_V2.glass, name: 'Glazing', color: '#9fc3d8', opacity: 0.35 })
  push({ type: 'defineMaterial', id: MATERIALS_V2.dark, name: 'Dark render', color: '#3a3a3c' })
  push({ type: 'defineMaterial', id: MATERIALS_V2.timber, name: 'Timber cladding', color: '#b07a4a' })
  push({ type: 'defineMaterial', id: MATERIALS_V2.partition, name: 'Partition', color: '#d9d5cc' })
  push({ type: 'defineMaterial', id: MATERIALS_V2.chimney, name: 'Chimney', color: '#6d6a66' })
  push({ type: 'defineMaterial', id: MATERIALS_V2.terrace, name: 'Terrace paving', color: '#a49c92' })
  push({ type: 'defineMaterial', id: MATERIALS_V2.mid, name: 'Grey render', color: '#8e8983' })

  const levelId = (index: number): string => b.levels.find((l) => l.index === index)?.id ?? 'lvl-0'
  const levelOf = (index: number) => b.levels.find((l) => l.index === index)
  for (const l of b.levels) {
    push({ type: 'createLevel', id: l.id, name: l.index === 0 ? 'Ground' : `Level ${l.index}`, index: l.index, elevation: round6(l.elevation), height: round6(l.height) }, l.featureId, 'levels')
  }

  // --- masses: slab and ring per storey -------------------------------------
  const capWallIds: string[] = []
  const attachedCapIds = new Map<string, string[]>()
  const emittedInteriorByStorey = new Map<number, string[]>()
  for (const m of b.masses) {
    const polygon = [
      { x: m.x0, z: m.z0 },
      { x: m.x1, z: m.z0 },
      { x: m.x1, z: m.z1 },
      { x: m.x0, z: m.z1 },
    ]
    for (const storey of m.storeys) {
      const l = levelOf(storey)
      if (!l) continue
      const isTop = storey === Math.max(...m.storeys)
      const attached = b.attachedRoofs.find((r) => r.massId === m.id)
      const holes = b.stair && b.stair.toLevel === storey && m.id === b.masses.find((x) => x.role === 'MAIN')?.id ? [[{ x: b.stair.slabHole.x0, z: b.stair.slabHole.z0 }, { x: b.stair.slabHole.x1, z: b.stair.slabHole.z0 }, { x: b.stair.slabHole.x1, z: b.stair.slabHole.z1 }, { x: b.stair.slabHole.x0, z: b.stair.slabHole.z1 }]] : undefined
      // A floor slab over a storey of this body spans between the inner faces
      // of the walls that carry it: the walls run from the ground to the
      // eaves in one face, and the slab meets them face to face. A slab edge
      // drawn in the plane of the wall's outer face — or a slab top in the
      // plane of the wall's top, seen through a door at floor level — is two
      // faces in one place. The lowest slab is the plinth and keeps the full
      // outline.
      const bearsOnWalls = storey !== Math.min(...m.storeys)
      const inset = bearsOnWalls ? round6(b.wallThicknessM) : 0
      const slabPolygon = inset > 0 ? [{ x: round6(m.x0 + inset), z: round6(m.z0 + inset) }, { x: round6(m.x1 - inset), z: round6(m.z0 + inset) }, { x: round6(m.x1 - inset), z: round6(m.z1 - inset) }, { x: round6(m.x0 + inset), z: round6(m.z1 - inset) }] : polygon
      // A stair void that reaches a wall ends at the wall's inner face: the slab is not there to be cut.
      const clippedHoles = holes?.map((h) => h.map((p) => ({ x: round6(Math.min(Math.max(p.x, m.x0 + inset), m.x1 - inset)), z: round6(Math.min(Math.max(p.z, m.z0 + inset), m.z1 - inset)) })))
      push({ type: 'createSlab', id: `slab-${m.id}-${storey}`, levelId: l.id, polygon: slabPolygon, ...(clippedHoles ? { holes: clippedHoles } : {}), topOffset: 0, thickness: b.slabThicknessM, materialId: MATERIALS_V2.slab }, m.featureId, 'slabs')
      // A single-storey attached body under a flat roof: its walls rise to the parapet where the section draws one.
      const height = attached && isTop ? round6((attached.parapetTopY ?? attached.slabTopY) - l.elevation) : round6(l.height)
      const ringId = `ring-${m.id}-${storey}`
      // The body's walls take the tone the renders show for them: a dark body is built in dark render.
      const tone = b.massTones.find((t) => t.massId === m.id)
      const ringMaterial = tone && tone.share >= 0.5 ? materialForTone(tone.tone, MATERIALS_V2.wall) : MATERIALS_V2.wall
      push({ type: 'createWallRing', id: ringId, levelId: l.id, polygon, thickness: b.wallThicknessM, height, baseOffset: 0, kind: 'EXTERIOR', cornerOwnership: 'ALTERNATE', materialId: ringMaterial }, m.featureId, 'wallRings')
      if (isTop && !attached) capWallIds.push(`${ringId}-w0`, `${ringId}-w1`, `${ringId}-w2`, `${ringId}-w3`)
      if (attached && isTop) attachedCapIds.set(m.id, [`${ringId}-w0`, `${ringId}-w1`, `${ringId}-w2`, `${ringId}-w3`])
    }
    evidence(`ring-${m.id}-${m.storeys[0]}`, 'SOURCE_EXACT', `${(m.x1 - m.x0).toFixed(2)} × ${(m.z1 - m.z0).toFixed(2)} m body from the plan's printed chains and wall bands`)
  }

  // --- return walls (the recess topology) -------------------------------------
  // A return standing under an attached body's roof dies into that roof: the portal pier under the head.
  const returnsUnderAttached = new Map<string, string[]>()
  for (const r of b.returns) {
    const l = levelOf(r.storeyIndex)
    if (!l) continue
    const mainMass = b.masses.find((m) => m.role === 'MAIN')
    const isTop = r.storeyIndex === Math.max(...(mainMass?.storeys ?? [0]))
    const ownTone = b.returnTones.find((t) => t.returnId === r.id)
    push({ type: 'createWall', id: r.id, levelId: l.id, start: r.start, end: r.end, thickness: r.thicknessM, height: round6(l.height), baseOffset: 0, kind: 'EXTERIOR', materialId: ownTone && ownTone.share >= 0.5 ? materialForTone(ownTone.tone, MATERIALS_V2.member) : MATERIALS_V2.member }, r.featureId, 'walls')
    const x0 = Math.min(r.start.x, r.end.x)
    const x1 = Math.max(r.start.x, r.end.x)
    const z0 = Math.min(r.start.z, r.end.z)
    const z1 = Math.max(r.start.z, r.end.z)
    const under = b.attachedRoofs.find((a) => {
      const mass = b.masses.find((m) => m.id === a.massId)
      return !!mass && mass.storeys.includes(r.storeyIndex) && x0 >= a.footprint.x0 - 0.01 && x1 <= a.footprint.x1 + 0.01 && z0 >= a.footprint.z0 - 0.01 && z1 <= a.footprint.z1 + 0.01 && (r.side === 'FRONT' || r.side === 'REAR' ? r.alongInterval[0] >= a.footprint.x0 - 0.01 && r.alongInterval[1] <= a.footprint.x1 + 0.01 : r.alongInterval[0] >= a.footprint.z0 - 0.01 && r.alongInterval[1] <= a.footprint.z1 + 0.01)
    })
    if (under) returnsUnderAttached.set(under.massId, [...(returnsUnderAttached.get(under.massId) ?? []), r.id])
    else if (isTop) capWallIds.push(r.id)
    evidence(r.id, r.provenance, r.why)
  }

  // --- interior: partitions with their doors, rooms --------------------------------
  for (const storey of b.interior) {
    const l = levelOf(storey.storeyIndex)
    if (!l) continue
    const mainMass = b.masses.find((m) => m.role === 'MAIN')
    const isTop = storey.storeyIndex === Math.max(...(mainMass?.storeys ?? [0]))
    // Merge collinear pieces joined by door gaps into one wall each.
    type Run = { axis: 'X' | 'Z'; at: number; from: number; to: number; thicknessM: number; pieces: string[]; doors: typeof storey.doors; featureId: string }
    const runs: Run[] = []
    const byPiece = new Map(storey.walls.map((w) => [w.id, w]))
    const used = new Set<string>()
    for (const w of storey.walls) {
      if (used.has(w.id)) continue
      const run: Run = { axis: w.axis, at: w.at, from: w.from, to: w.to, thicknessM: w.thicknessM, pieces: [w.id], doors: [], featureId: w.id }
      used.add(w.id)
      let grew = true
      while (grew) {
        grew = false
        for (const d of storey.doors) {
          if (d.wallAxis !== run.axis || Math.abs(d.at - run.at) > b.wallThicknessM * 0.5) continue
          const [a, c] = d.betweenIds
          const other = run.pieces.includes(a) ? c : run.pieces.includes(c) ? a : undefined
          if (!other || run.doors.includes(d)) continue
          const piece = byPiece.get(other)
          run.doors.push(d)
          if (piece && !used.has(piece.id)) {
            used.add(piece.id)
            run.pieces.push(piece.id)
            run.from = Math.min(run.from, piece.from)
            run.to = Math.max(run.to, piece.to)
          } else {
            // A block jamb: the run reaches the door's far edge.
            run.from = Math.min(run.from, d.from, d.to)
            run.to = Math.max(run.to, d.from, d.to)
          }
          grew = true
        }
      }
      runs.push(run)
    }
    const height = isTop ? round6(l.height) : round6(l.height - b.slabThicknessM)
    // Ends are trimmed short of whatever they meet — the exterior ring's inner
    // face, a perpendicular partition — so no two walls share plan area; the
    // model's wall compiler wants a declared junction for that, and a 15 mm
    // gap at a partition end is below anything the plan states.
    const gapM = 0.015
    const massOf = (run: Run): MassV2 | undefined => b.masses.find((m) => m.storeys.includes(storey.storeyIndex) && (run.axis === 'X' ? run.at >= m.z0 && run.at <= m.z1 && run.from >= m.x0 - 0.5 && run.to <= m.x1 + 0.5 : run.at >= m.x0 && run.at <= m.x1 && run.from >= m.z0 - 0.5 && run.to <= m.z1 + 0.5))
    for (const run of runs) {
      const m = massOf(run)
      if (m) {
        const inner = run.axis === 'X' ? [m.x0 + b.wallThicknessM, m.x1 - b.wallThicknessM] : [m.z0 + b.wallThicknessM, m.z1 - b.wallThicknessM]
        run.from = Math.max(run.from, inner[0] + gapM)
        run.to = Math.min(run.to, inner[1] - gapM)
      }
      for (const other of runs) {
        if (other === run || other.axis === run.axis) continue
        const otherHalf = other.thicknessM / 2
        const crossesRun = other.from - 0.05 <= run.at && other.to + 0.05 >= run.at
        if (!crossesRun) continue
        if (Math.abs(run.from - other.at) <= otherHalf + 0.06) run.from = round6(other.at + otherHalf + gapM)
        if (Math.abs(run.to - other.at) <= otherHalf + 0.06) run.to = round6(other.at - otherHalf - gapM)
      }
    }
    // A second pass on the rectangles themselves: any end that still lies
    // inside a perpendicular partition is pulled back to its face.
    const rectOf = (r: Run): { x0: number; z0: number; x1: number; z1: number } => (r.axis === 'X' ? { x0: r.from, x1: r.to, z0: r.at - r.thicknessM / 2, z1: r.at + r.thicknessM / 2 } : { x0: r.at - r.thicknessM / 2, x1: r.at + r.thicknessM / 2, z0: r.from, z1: r.to })
    for (let pass = 0; pass < 2; pass += 1) {
      for (const run of runs) {
        for (const other of runs) {
          if (other === run || other.axis === run.axis) continue
          const o = rectOf(other)
          const acrossInside = run.axis === 'X' ? run.at > o.z0 - 0.02 && run.at < o.z1 + 0.02 : run.at > o.x0 - 0.02 && run.at < o.x1 + 0.02
          if (!acrossInside) continue
          const lo = run.axis === 'X' ? o.x0 : o.z0
          const hi = run.axis === 'X' ? o.x1 : o.z1
          if (run.from >= lo - 0.02 && run.from <= hi + 0.02) run.from = round6(hi + gapM)
          if (run.to >= lo - 0.02 && run.to <= hi + 0.02) run.to = round6(lo - gapM)
        }
      }
    }
    for (const run of runs) onDebug?.(`storey ${storey.storeyIndex} run ${run.featureId} ${run.axis} at ${run.at} ${run.from}..${run.to} t ${run.thicknessM} doors ${run.doors.map((d) => `${d.from}..${d.to}`).join(',')}`)
    for (const run of runs) {
      if (run.to - run.from < 0.2) {
        for (const piece of run.pieces) dropped.push({ featureId: piece, why: `the partition is ${(run.to - run.from).toFixed(2)} m long once trimmed to the walls it meets` })
        continue
      }
      const half = run.thicknessM / 2
      const start = run.axis === 'X' ? { x: round6(run.from), z: round6(run.at - half) } : { x: round6(run.at + half), z: round6(run.from) }
      const end = run.axis === 'X' ? { x: round6(run.to), z: round6(run.at - half) } : { x: round6(run.at + half), z: round6(run.to) }
      push({ type: 'createWall', id: run.featureId, levelId: l.id, start, end, thickness: round6(run.thicknessM), height, baseOffset: 0, kind: 'INTERIOR', materialId: MATERIALS_V2.partition }, run.featureId, 'walls')
      emittedInteriorByStorey.set(storey.storeyIndex, [...(emittedInteriorByStorey.get(storey.storeyIndex) ?? []), run.featureId])
      for (const piece of run.pieces) if (piece !== run.featureId) bindings.push({ featureId: piece, objectId: run.featureId, objectKind: 'walls', commandIndex: program.length - 1 })
      evidence(run.featureId, 'SOURCE_DERIVED', `${run.pieces.length} piece${run.pieces.length === 1 ? '' : 's'} of partition ink on the plan${run.doors.length > 0 ? ` with ${run.doors.length} door gap${run.doors.length === 1 ? '' : 's'}` : ''}`, { height: 'SOURCE_DERIVED' })
      for (const d of run.doors) {
        // A door needs wall on both sides of it: a gap at a trimmed end (a block jamb) is narrowed to leave a stub.
        const runLength = round6(run.to - run.from)
        const offset = round6(Math.max(0.06, Math.min(d.from, d.to) - run.from))
        const width = round6(Math.min(d.widthM, runLength - 0.06 - offset))
        if (width < 0.5 || offset + width > runLength - 0.05) continue
        push({ type: 'cutOpening', id: d.id, wallId: run.featureId, kind: 'DOOR', offset, sill: 0, width, height: Math.min(CONVENTIONS.doorHeight, round6(height - 0.1)) }, d.id, 'openings')
        push({ type: 'placeDoor', id: `${d.id}-leaf`, openingId: d.id, frameDepth: round6(Math.min(0.1, run.thicknessM * 0.6)), frameInset: 0.01, leafThickness: round6(Math.min(0.045, run.thicknessM * 0.3)), materialId: MATERIALS_V2.timber }, d.id, 'doors')
        evidence(d.id, 'SOURCE_DERIVED', d.why, { height: 'ASSUMED_FOR_RENDERING' })
      }
    }
    for (const room of storey.rooms) {
      if (room.polygon.length < 4) continue
      push({ type: 'createRoom', id: room.id, levelId: l.id, polygon: room.polygon, ...(room.label ? { usage: room.label } : {}) }, room.id, 'rooms')
      evidence(room.id, room.number ? 'SOURCE_CORROBORATED' : 'SOURCE_DERIVED', room.why)
    }
  }

  // --- roofs -------------------------------------------------------------------
  /**
   * The verge boards, as the main roof's own edge members: vertical depth
   * from the member's perpendicular width at the pitch, depth along the
   * ridge from the closure (the depth of the frame's returns). A gable read
   * at one end only takes its board at that end.
   */
  function vergeMembers(): { edgeMembers?: { verge: { width: number; depth: number; materialId: string; ends: Array<{ side: 'MIN_X' | 'MAX_X' | 'MIN_Z' | 'MAX_Z'; width: number; depth: number }> } } } {
    const roof = b.mainRoof
    if (!roof || b.verges.length === 0) return {}
    const cos = Math.cos((roof.pitchDeg * Math.PI) / 180)
    const ends = b.verges.map((v) => ({ side: (roof.ridgeAxis === 'Z' ? (v.side === 'FRONT' ? 'MIN_Z' : 'MAX_Z') : v.side === 'FRONT' ? 'MIN_X' : 'MAX_X') as 'MIN_X' | 'MAX_X' | 'MIN_Z' | 'MAX_Z', width: round6((v.member.widthM ?? 0.5) / cos), depth: round6(v.depthM) }))
    const first = ends[0]
    return { edgeMembers: { verge: { width: first.width, depth: first.depth, materialId: MATERIALS_V2.member, ends } } }
  }
  if (b.mainRoof) {
    const roof = b.mainRoof
    const l = levelOf(Math.max(...(b.masses.find((m) => m.id === roof.massId)?.storeys ?? [0])))
    const interiorTop = l ? emittedInteriorByStorey.get(l.index) ?? [] : []
    push(
      {
        type: 'createRoof',
        id: 'roof-main',
        levelId: l?.id ?? 'lvl-0',
        kind: 'GABLE',
        footprint: { minX: roof.footprint.x0, maxX: roof.footprint.x1, minZ: roof.footprint.z0, maxZ: roof.footprint.z1 },
        eaveOffset: round6(roof.eaveY - (l?.elevation ?? 0)),
        pitchDeg: roof.pitchDeg,
        ridgeAxis: roof.ridgeAxis,
        overhang: 0,
        thickness: roof.thicknessM,
        ...vergeMembers(),
        materialId: MATERIALS_V2.roof,
        capWallIds: [...capWallIds, ...interiorTop],
      },
      roof.featureId,
      'roofs',
    )
    for (const v of b.verges) bindings.push({ featureId: v.featureId, objectId: 'roof-main', objectKind: 'roofs', commandIndex: program.length - 1 })
    evidence('roof-main', roof.provenance, `${roof.pitchDeg}° gable on the authority of ${roof.authority.toLowerCase().replace(/_/g, ' ')}; ${roof.coversZonesWhy}${b.verges.length > 0 ? `; verge boards along both rakes, ${b.verges.map((v) => `${v.side.toLowerCase()} ${(v.member.widthM ?? 0).toFixed(2)} m wide by ${v.depthM.toFixed(2)} m deep`).join(', ')}` : ''}`, { footprint: roof.coversZones ? 'SOURCE_CORROBORATED' : 'SOURCE_DERIVED', ...(b.verges.length > 0 ? { 'edgeMembers.verge': b.verges.every((v) => v.depthProvenance === 'SOURCE_DERIVED') ? 'SOURCE_DERIVED' : 'IMAGE_METRIC_REGISTERED' } : {}) })
  }
  for (const r of b.attachedRoofs) {
    const mass = b.masses.find((m) => m.id === r.massId)
    const l = levelOf(Math.max(...(mass?.storeys ?? [0])))
    // The plate bears into the walls that carry it (to their centreline); the
    // head that edges it over the zone in front is its own fascia member.
    const half = round6(b.wallThicknessM / 2)
    const head = b.portalHeads.find((p) => p.massId === r.massId)
    const fascia = head && mass ? { sides: ['MIN_Z' as const], topOffset: round6(head.y1 - r.slabTopY), height: round6(head.y1 - head.y0), depth: round6(mass.z0 - r.footprint.z0), materialId: MATERIALS_V2.dark } : undefined
    push(
      {
        type: 'createRoof',
        id: `roof-${r.massId}`,
        levelId: l?.id ?? 'lvl-0',
        kind: 'FLAT',
        footprint: { minX: r.footprint.x0, maxX: r.footprint.x1, minZ: r.footprint.z0, maxZ: r.footprint.z1 },
        eaveOffset: round6(r.slabTopY - (l?.elevation ?? 0)),
        overhang: 0,
        thickness: round6(Math.max(0.12, r.slabTopY - r.slabSoffitY)),
        ...(fascia && fascia.depth > 0.05 ? { edgeMembers: { fascia } } : {}),
        plateInset: { minX: half, maxX: half, minZ: half, maxZ: half },
        materialId: MATERIALS_V2.roof,
        // Its returns under the head, and the partitions of its top storey, die into the plate.
        capWallIds: [...(returnsUnderAttached.get(r.massId) ?? []), ...(l ? (emittedInteriorByStorey.get(l.index) ?? []).filter((id) => id.startsWith(`${r.massId}-iwall-`)) : [])],
      },
      r.featureId,
      'roofs',
    )
    if (head) bindings.push({ featureId: head.featureId, objectId: `roof-${r.massId}`, objectKind: 'roofs', commandIndex: program.length - 1 })
    evidence(`roof-${r.massId}`, r.provenance, `${r.reading ? r.reading.why : 'no section draws this roof; its height is the storey height'}${head ? `; its edge over the zone is the portal head, ${head.why}` : ''}`, { eaveOffset: r.reading ? 'SOURCE_EXACT' : 'ASSUMED_FOR_RENDERING', ...(head ? { 'edgeMembers.fascia': head.provenance } : {}) })
  }

  // --- balconies, railings, terraces -------------------------------------------
  // Portal heads and verges are the roofs' own edge members (above); nothing here stands proud as a loose bar.
  for (const bal of b.balconies) {
    const l = levelOf(bal.storeyIndex)
    if (!l) continue
    push({ type: 'createBalcony', id: bal.id, levelId: l.id, kind: bal.kind, footprint: { minX: bal.x0, maxX: bal.x1, minZ: bal.z0, maxZ: bal.z1 }, topOffset: round6(bal.topY - l.elevation), thickness: bal.thicknessM, materialId: bal.kind === 'TERRACE' ? MATERIALS_V2.slab : MATERIALS_V2.dark }, bal.featureId, 'balconies')
    evidence(bal.id, bal.provenance, `${bal.why}${bal.ends ? `; ends: ${bal.ends.map((e) => `${e.kind.toLowerCase()} at ${e.at.toFixed(2)}`).join(', ')}` : ''}`)
  }
  for (const r of b.railings) {
    const l = levelOf(r.storeyIndex)
    if (!l) continue
    push({ type: 'createRailing', id: r.id, levelId: l.id, start: r.start, end: r.end, ...(r.path ? { path: r.path } : {}), baseOffset: round6(r.baseY - l.elevation), height: r.heightM, postSpacing: 1.0, infill: 'GLASS', ...(r.hostId ? { hostId: r.hostId } : {}), materialId: MATERIALS_V2.glass }, r.featureId, 'railings')
    evidence(r.id, r.provenance, r.why, r.path ? { path: 'SOURCE_DERIVED' } : undefined)
  }
  for (const t of b.terraces) {
    const l = levelOf(t.storeyIndex)
    if (!l) continue
    const hostWallIds = t.massIds.map((mid) => ringWallId(mid, t.storeyIndex, t.side === 'WEST' ? 'WEST' : t.side === 'EAST' ? 'EAST' : t.side))
    push({ type: 'createTerrace', id: t.id, levelId: l.id, polygon: t.polygon, topOffset: round6(t.topY - l.elevation), thickness: t.thicknessM, surface: t.surface, edge: t.edge, hostWallIds, materialId: MATERIALS_V2.terrace }, t.featureId, 'terraces')
    evidence(t.id, t.provenance, t.why, { thickness: b.terrainY === undefined ? 'ASSUMED_FOR_RENDERING' : 'SOURCE_DERIVED' })
  }

  // --- chimneys and rooflights ---------------------------------------------------
  for (const c of b.chimneys) {
    const l = levelOf(0)
    const top = c.topY ?? (b.mainRoof ? b.mainRoof.ridgeY - 0.1 : 0)
    push({ type: 'placeChimney', id: c.id, levelId: l?.id ?? 'lvl-0', footprint: { minX: c.x0, maxX: c.x1, minZ: c.z0, maxZ: c.z1 }, baseOffset: 0, height: round6(top - (l?.elevation ?? 0)), materialId: MATERIALS_V2.chimney }, c.featureId, 'chimneys')
    if (b.mainRoof) {
      // The model cuts a penetration strictly within one slope; a stack that
      // straddles the ridge pierces both, so it is placed through the roof
      // without a cut and the fact is noted rather than the footprint bent.
      const roof = b.mainRoof
      const across: [number, number] = roof.ridgeAxis === 'Z' ? [c.x0, c.x1] : [c.z0, c.z1]
      const straddles = roof.kind === 'GABLE' && across[0] < roof.ridgeAt + 0.01 && across[1] > roof.ridgeAt - 0.01
      if (straddles) notes.push(`${c.id} straddles the ridge at ${roof.ridgeAt}: placed through the roof without a penetration cut, which the model confines to one slope`)
      else push({ type: 'cutRoofOpening', id: `${c.id}-pen`, roofId: 'roof-main', kind: 'PENETRATION', footprint: { minX: c.x0, maxX: c.x1, minZ: c.z0, maxZ: c.z1 }, throughId: c.id }, c.featureId, 'roofOpenings')
    }
    evidence(c.id, c.provenance, c.why, { height: c.topY === undefined ? 'ASSUMED_FOR_RENDERING' : 'IMAGE_METRIC_REGISTERED' })
  }
  for (const r of b.rooflights) {
    if (!b.mainRoof) break
    const along: [number, number] = [r.alongFrom, r.alongTo]
    const slope: [number, number] = [Math.min(r.slopeFrom, r.slopeTo), Math.max(r.slopeFrom, r.slopeTo)]
    const footprint = b.mainRoof.ridgeAxis === 'Z' ? { minX: slope[0], maxX: slope[1], minZ: along[0], maxZ: along[1] } : { minX: along[0], maxX: along[1], minZ: slope[0], maxZ: slope[1] }
    push({ type: 'cutRoofOpening', id: r.id, roofId: 'roof-main', kind: 'ROOFLIGHT', footprint, cut: 'NORMAL_TO_ROOF' }, r.featureId, 'roofOpenings')
    push({ type: 'placeRooflight', id: `${r.id}-unit`, roofOpeningId: r.id, materialId: MATERIALS_V2.glass }, r.featureId, 'rooflights')
    evidence(r.id, r.provenance, r.why)
  }

  // --- exterior openings ------------------------------------------------------------
  for (const o of b.openings) {
    const mass = b.masses.find((m) => m.id === o.massId)
    const l = levelOf(o.storeyIndex)
    if (!mass || !l) continue
    const wallId = ringWallId(mass.id, o.storeyIndex, o.facade)
    const { offset, reversed } = wallOffset(mass, o.facade, o.interval)
    const sill = round6(Math.max(0, o.sillY - l.elevation))
    const nearIsTall = o.tallEdge === undefined ? true : (o.tallEdge === 'LOW') !== reversed
    const heightNear = round6(Math.max(0.3, (nearIsTall || o.headFarY === undefined ? o.headY : o.headFarY) - o.sillY))
    const heightFar = o.headFarY === undefined ? undefined : round6(Math.max(0.3, (nearIsTall ? o.headFarY : o.headY) - o.sillY))
    const kind = o.family === 'WINDOW' || o.family === 'MULTI_PANEL_GLAZING' ? 'WINDOW' : 'DOOR'
    push({ type: 'cutOpening', id: o.id, wallId, kind, offset: Math.max(0, offset), sill, width: o.widthM, height: heightNear, ...(heightFar !== undefined && o.profile === 'RAKED_SINGLE' ? { head: { kind: 'RAKED', heightFar } } : {}) }, o.id, 'openings')
    if (kind === 'WINDOW') {
      push({ type: 'placeWindow', id: `${o.id}-unit`, openingId: o.id, ...(o.mullions.length > 0 ? { mullions: o.mullions } : {}), materialId: MATERIALS_V2.glass }, o.id, 'windows')
    } else if (o.family === 'GARAGE_DOOR') {
      push({ type: 'placeDoor', id: `${o.id}-leaf`, openingId: o.id, assembly: { panels: [{ kind: 'PANEL', fraction: 1 }], mullionWidth: 0.04 } }, o.id, 'doors')
    } else if (o.family === 'GLAZED_DOOR') {
      push({ type: 'placeDoor', id: `${o.id}-leaf`, openingId: o.id, assembly: { panels: [{ kind: 'LEAF', fraction: 1, hinge: 'LEFT', glazing: 'FULL' }], mullionWidth: 0.04 }, materialId: MATERIALS_V2.glass }, o.id, 'doors')
    } else {
      push({ type: 'placeDoor', id: `${o.id}-leaf`, openingId: o.id, materialId: MATERIALS_V2.timber }, o.id, 'doors')
    }
    evidence(o.id, o.provenance.head === 'SOURCE_EXACT' || o.provenance.head === 'SOURCE_CORROBORATED' ? 'SOURCE_CORROBORATED' : o.provenance.head === 'ASSUMED_FOR_RENDERING' ? 'ASSUMED_FOR_RENDERING' : 'SOURCE_DERIVED', o.why, { offset: o.provenance.interval, width: o.provenance.width, sill: o.provenance.sill, height: o.provenance.head, head: o.provenance.profile, kind: o.provenance.family })
  }
  for (const d of b.sharedDoors) {
    const mass = b.masses.find((m) => m.id === d.massId)
    const other = b.masses.find((m) => m.id === d.otherMassId)
    const l = levelOf(d.storeyIndex)
    if (!mass || !other || !l) continue
    const wallId = ringWallId(mass.id, d.storeyIndex, d.facade)
    const { offset } = wallOffset(mass, d.facade, d.interval)
    const otherFacade = d.facade === 'EAST' ? 'WEST' : d.facade === 'WEST' ? 'EAST' : d.facade === 'FRONT' ? 'REAR' : 'FRONT'
    const otherOffset = wallOffset(other, otherFacade, d.interval).offset
    push({ type: 'cutOpening', id: d.id, wallId, kind: 'DOOR', offset: Math.max(0, offset), sill: 0, width: d.widthM, height: round6(d.headY - d.sillY), leaves: [{ wallId: ringWallId(other.id, d.storeyIndex, otherFacade), offset: Math.max(0, otherOffset) }] }, d.id, 'openings')
    push({ type: 'placeDoor', id: `${d.id}-leaf`, openingId: d.id, materialId: MATERIALS_V2.timber }, d.id, 'doors')
    evidence(d.id, 'SOURCE_DERIVED', d.why, { height: d.provenance.head })
  }

  // --- the stair -----------------------------------------------------------------------
  if (b.stair) {
    const s = b.stair
    const from = levelOf(s.fromLevel)
    const to = levelOf(s.toLevel)
    if (from && to) {
      if (s.emit === 'FLIGHTS') {
        const h = s.hypothesis
        const first = h.flights[0]
        // The first riser line's left-hand end, facing the direction of travel.
        const start = first.direction === 'PLUS_X' ? { x: first.from, z: first.band.to } : first.direction === 'MINUS_X' ? { x: first.from, z: first.band.from } : first.direction === 'PLUS_Z' ? { x: first.band.from, z: first.from } : { x: first.band.to, z: first.from }
        const segments: Array<{ kind: 'FLIGHT'; risers: number; going: number } | { kind: 'LANDING'; length: number; turn: 'NONE' | 'LEFT' | 'RIGHT' }> = []
        h.flights.forEach((f, i) => {
          segments.push({ kind: 'FLIGHT', risers: f.risers, going: round6(f.goingM) })
          const landing = h.landings[i]
          if (landing) segments.push({ kind: 'LANDING', length: round6(h.widthM), turn: landing.turn })
        })
        push({ type: 'createStair', id: 'stair-main', levelId: from.id, toLevelId: to.id, start: { x: round6(start.x), z: round6(start.z) }, direction: first.direction, width: round6(h.widthM), segments }, s.featureId, 'stairs')
        evidence('stair-main', s.provenance, h.why)
      } else {
        push({ type: 'createStairPlaceholder', id: 'stair-main', levelId: from.id, toLevelId: to.id, footprint: { minX: s.hypothesis.shaft.x0, maxX: s.hypothesis.shaft.x1, minZ: s.hypothesis.shaft.z0, maxZ: s.hypothesis.shaft.z1 } }, s.featureId, 'stairs')
        evidence('stair-main', 'UNRESOLVED', s.hypothesis.why)
      }
    }
  }

  // --- finish regions --------------------------------------------------------------------
  for (const r of b.surfaceRegions) {
    const mass = b.masses.find((m) => m.id === r.wallRef.massId)
    if (!mass) continue
    const l = levelOf(r.wallRef.storeyIndex)
    if (!l) continue
    const wallId = ringWallId(mass.id, r.wallRef.storeyIndex, r.wallRef.side)
    const { offset, reversed } = wallOffset(mass, r.wallRef.side, r.along)
    const a0 = Math.max(0, offset)
    const a1 = round6(a0 + (r.along[1] - r.along[0]))
    void reversed
    const material = r.tone === 'WARM' ? MATERIALS_V2.timber : materialForTone(r.tone, MATERIALS_V2.wall)
    push({ type: 'createSurfaceRegion', id: r.id, hostId: wallId, face: 'OUTER', rect: { a0, a1, b0: round6(r.y[0] - l.elevation), b1: round6(r.y[1] - l.elevation) }, materialId: material }, r.featureId, 'surfaceRegions')
    evidence(r.id, 'VISUAL_SEMANTIC', `a ${r.tone.toLowerCase()} finish region read on the render: colour, not geometry`)
  }

  return { program, bindings, notes, dropped }
}
