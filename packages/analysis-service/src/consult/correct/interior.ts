/**
 * v3.54.19 — BUILD_INTERIOR: the partitions and interior doors the ground-floor plan draws, built inside whichever body
 * stands (`plan-skeleton.ts` read them on the sheet; the caller mapped them into the model's frame).
 *
 * The interior is a property of the plan, not of the reconstruction that happened to place the outer walls. A body built
 * from the plan outline and the elevations, or one that replaced LOCAL's, is given the walls its own plan draws — through
 * the executor like every other change (commands, one transaction, a record), so the delivered model rebuilds byte for
 * byte. What is ASSUMED is said: the walls' height (no section is read here) and the doors' height.
 *
 * Refused, by name: a model that already has interior walls on that storey (they are kept — this operation never
 * replaces a reading), a plan skeleton that read nothing, walls that fall outside every body.
 */
import type { BuildingCommand } from '@buildapp/commands'
import type { CanonicalBuildingModel, Evidence } from '@buildapp/model'
import type { PlanSkeleton } from '../plan-skeleton.js'
import { bodiesOf } from '../massing/massing.js'
import { sideOfWall } from './execute.js'
import type { Bound, Ctx, CorrectionProposal, PlanGap, Refusal } from './execute.js'

export const INTERIOR_OPS_VERSION = '1.0.0' as const
export const INTERIOR_CONVENTIONS = {
  /** the height a partition is built to where nothing lower stands over it (no section is read): ASSUMED */
  heightM: 2.7,
  /** … and never nearer than this to the roof's eaves line */
  underEavesM: 0.15,
  minHeightM: 1.6,
  doorHeightM: 2.05,
  /** a piece shorter than this after clipping to its body is not built */
  minPieceM: 0.4,
  /** an end this near a body's inner face runs on to it */
  reachFaceM: 0.3,
  /** two pieces are one wall line when their centre lines are this near */
  sameLineM: 0.12,
  doorMinM: 0.6,
  doorMaxM: 2.4,
} as const

export type InteriorWall = { id: string; axis: 'X' | 'Z'; at: number; from: number; to: number; thicknessM: number }
export type InteriorDoor = { id: string; axis: 'X' | 'Z'; at: number; from: number; to: number }
/** The plan skeleton in the MODEL's frame (metres): what BUILD_INTERIOR builds from, and the exterior gaps as witnesses. */
export type InteriorObservation = { observationId: string; frameId: string; sourceByteHash: string; by: 'PLAN_SKELETON'; version: string; walls: InteriorWall[]; doors: InteriorDoor[]; gaps: Array<{ id: string; a: { x: number; z: number }; b: { x: number; z: number }; lines: boolean }>; why: string }

const r6 = (v: number): number => Math.round(v * 1e6) / 1e6

/** The skeleton (frame pixels) through the body's own map from the sheet to its frame. */
export function skeletonInModel(sk: PlanSkeleton, toModel: (px: number, py: number) => { x: number; z: number }): InteriorObservation {
  const seg = (axis: 'H' | 'V', at: number, from: number, to: number): { axis: 'X' | 'Z'; at: number; from: number; to: number } => {
    const a = axis === 'H' ? toModel(from, at) : toModel(at, from)
    const b = axis === 'H' ? toModel(to, at) : toModel(at, to)
    return Math.abs(b.x - a.x) >= Math.abs(b.z - a.z) ? { axis: 'X', at: r6((a.z + b.z) / 2), from: r6(Math.min(a.x, b.x)), to: r6(Math.max(a.x, b.x)) } : { axis: 'Z', at: r6((a.x + b.x) / 2), from: r6(Math.min(a.z, b.z)), to: r6(Math.max(a.z, b.z)) }
  }
  const edges = sk.outlinePx.map((p, i) => ({ p, q: sk.outlinePx[(i + 1) % sk.outlinePx.length] }))
  return {
    observationId: `skeleton-${sk.frameId.slice(-16)}`,
    frameId: sk.frameId,
    sourceByteHash: sk.sourceByteHash,
    by: 'PLAN_SKELETON',
    version: sk.version,
    walls: sk.walls.map((w) => ({ id: w.id, ...seg(w.axis, w.at, w.from, w.to), thicknessM: r6(Math.max(0.06, w.thicknessPx * sk.mPerPx)) })),
    doors: sk.doors.map((d) => ({ id: d.id, ...seg(d.axis, d.at, d.from, d.to) })),
    gaps: sk.gaps.flatMap((g) => {
      const e = edges[g.edge]
      if (!e) return []
      const horizontal = g.face === 'TOP' || g.face === 'BOTTOM'
      const a = horizontal ? toModel(g.from, e.p[1]) : toModel(e.p[0], g.from)
      const b = horizontal ? toModel(g.to, e.p[1]) : toModel(e.p[0], g.to)
      return [{ id: g.id, a: { x: r6(a.x), z: r6(a.z) }, b: { x: r6(b.x), z: r6(b.z) }, lines: g.lines }]
    }),
    why: `the ground-floor plan ${sk.frameId} read on the sheet in its own wall colour (${sk.ink.rgb.join(',')}): ${sk.walls.length} partition piece(s), ${sk.doors.length} interior door gap(s), ${sk.gaps.length} gap(s) in the exterior walls`,
  }
}

/**
 * The exterior gaps of the plan as the gate's second witness (`PlanGap`): each on the side of the model whose wall line it
 * lies on, over the ground storey. A gap that lies on no exterior wall of the model (a simplified corner) witnesses nothing.
 */
export function planGapsFromSkeleton(m: CanonicalBuildingModel, obs: InteriorObservation): PlanGap[] {
  const level = [...m.levels].sort((a, b) => a.elevation - b.elevation)[0]
  if (!level) return []
  const out: PlanGap[] = []
  for (const g of obs.gaps) {
    const alongX = Math.abs(g.b.x - g.a.x) >= Math.abs(g.b.z - g.a.z)
    const [at, a0, a1] = alongX ? [(g.a.z + g.b.z) / 2, Math.min(g.a.x, g.b.x), Math.max(g.a.x, g.b.x)] : [(g.a.x + g.b.x) / 2, Math.min(g.a.z, g.b.z), Math.max(g.a.z, g.b.z)]
    // the exterior wall of the ground storey this gap lies in: same direction, the gap inside its length, its line within a wall thickness
    for (const w of m.walls) {
      if (w.kind !== 'EXTERIOR' || w.levelId !== level.id) continue
      const wx = Math.abs(w.end.x - w.start.x) >= Math.abs(w.end.z - w.start.z)
      if (wx !== alongX) continue
      const [wat, w0, w1] = wx ? [w.start.z, Math.min(w.start.x, w.end.x), Math.max(w.start.x, w.end.x)] : [w.start.x, Math.min(w.start.z, w.end.z), Math.max(w.start.z, w.end.z)]
      if (Math.abs(wat - at) > w.thickness + 0.15 || a0 < w0 - 0.2 || a1 > w1 + 0.2) continue
      const side = sideOfWall(m, w)
      if (!side) continue
      out.push({ id: `plan-${g.id}`, side, a0: r6(a0), a1: r6(a1), storeyLo: level.elevation, storeyHi: level.elevation + Math.min(level.height, 3.2) })
      break
    }
  }
  return out
}

type Run = { id: string; axis: 'X' | 'Z'; at: number; from: number; to: number; thicknessM: number; doors: InteriorDoor[] }
/** Collinear pieces a door gap joins are one wall with that door in it; a door at a piece's end keeps a wall on its far side. */
export function interiorRuns(walls: readonly InteriorWall[], doors: readonly InteriorDoor[]): Run[] {
  const C = INTERIOR_CONVENTIONS
  const runs: Run[] = []
  const used = new Set<string>()
  const sorted = [...walls].sort((a, b) => (a.axis === b.axis ? a.at - b.at || a.from - b.from : a.axis < b.axis ? -1 : 1))
  for (const w of sorted) {
    if (used.has(w.id)) continue
    used.add(w.id)
    const run: Run = { id: w.id, axis: w.axis, at: w.at, from: w.from, to: w.to, thicknessM: w.thicknessM, doors: [] }
    for (let grown = true; grown; ) {
      grown = false
      for (const d of doors) {
        if (d.axis !== run.axis || Math.abs(d.at - run.at) > C.sameLineM || run.doors.includes(d)) continue
        const width = d.to - d.from
        if (width < C.doorMinM || width > C.doorMaxM) continue
        if (Math.abs(d.from - run.to) <= 0.15) {
          const next = sorted.find((q) => !used.has(q.id) && q.axis === run.axis && Math.abs(q.at - run.at) <= C.sameLineM && Math.abs(q.from - d.to) <= 0.15)
          run.doors.push(d)
          if (next) { used.add(next.id); run.to = next.to; run.thicknessM = Math.max(run.thicknessM, next.thicknessM) } else run.to = r6(d.to + 0.08)
          grown = true
        } else if (Math.abs(d.to - run.from) <= 0.15) {
          const prev = sorted.find((q) => !used.has(q.id) && q.axis === run.axis && Math.abs(q.at - run.at) <= C.sameLineM && Math.abs(q.to - d.from) <= 0.15)
          run.doors.push(d)
          if (prev) { used.add(prev.id); run.from = prev.from; run.thicknessM = Math.max(run.thicknessM, prev.thicknessM) } else run.from = r6(d.from - 0.08)
          grown = true
        }
      }
    }
    runs.push(run)
  }
  return runs
}

type Piece = { id: string; axis: 'X' | 'Z'; at: number; half: number; from: number; to: number; doors: InteriorDoor[]; height: number }
/**
 * The kernel takes no two walls sharing plan area. Read pieces do — a partition's end runs into the band of the wall it
 * meets, two walls cross, one wall is found twice. Resolved by geometry alone, deterministically: an end inside another
 * wall's band stops at that band's face (a butt joint); of two walls that cross, the thinner is cut into two at the
 * other's band; of two parallel pieces whose bands overlap, the shorter gives way over the stretch they share.
 */
export function resolveOverlaps(input: readonly Piece[]): Piece[] {
  const MIN = 0.15
  const EPS = 1e-6
  let ps = input.map((p) => ({ ...p }))
  const band = (p: Piece): [number, number] => [p.at - p.half, p.at + p.half]
  for (let pass = 0; pass < 12; pass += 1) {
    let changed = false
    const next: Piece[] = []
    outer: for (let i = 0; i < ps.length; i += 1) {
      const a = ps[i]
      for (let j = 0; j < ps.length; j += 1) {
        if (i === j) continue
        const b = ps[j]
        if (a.axis === b.axis) {
          // parallel: bands overlap across and stretches overlap along — the shorter (or, equal, the later) gives way
          const [a0, a1] = band(a)
          const [b0, b1] = band(b)
          if (Math.min(a1, b1) - Math.max(a0, b0) <= EPS) continue
          const lo = Math.max(a.from, b.from)
          const hi = Math.min(a.to, b.to)
          if (hi - lo <= EPS) continue
          const aGives = a.to - a.from < b.to - b.from || (a.to - a.from === b.to - b.from && i > j)
          if (!aGives) continue
          if (lo - a.from >= MIN) next.push({ ...a, to: lo })
          if (a.to - hi >= MIN) next.push({ ...a, id: lo - a.from >= MIN ? `${a.id}-r` : a.id, from: hi })
          changed = true
          continue outer
        }
        // perpendicular: b's band along a's line is [b.at − half, b.at + half]; a's band along b's line likewise
        const [bLo, bHi] = band(b)
        const [aLo, aHi] = band(a)
        if (Math.min(a.to, bHi) - Math.max(a.from, bLo) <= EPS || Math.min(b.to, aHi) - Math.max(b.from, aLo) <= EPS) continue
        const aStartsIn = a.from > bLo - EPS && a.from < bHi - EPS
        const aEndsIn = a.to > bLo + EPS && a.to < bHi + EPS
        if (aStartsIn || aEndsIn) {
          // a's end lies in b's band: it stops at the band's face
          const from = aStartsIn ? bHi : a.from
          const to = aEndsIn ? bLo : a.to
          if (to - from >= MIN) next.push({ ...a, from, to })
          changed = true
          continue outer
        }
        const bEndIn = (b.from > aLo - EPS && b.from < aHi - EPS) || (b.to > aLo + EPS && b.to < aHi + EPS)
        if (bEndIn) continue // b is trimmed on its own turn
        // a true crossing: the thinner wall (or, equal, the later) is cut in two at the other's band
        if (a.half < b.half || (a.half === b.half && i > j)) {
          if (bLo - a.from >= MIN) next.push({ ...a, to: bLo })
          if (a.to - bHi >= MIN) next.push({ ...a, id: bLo - a.from >= MIN ? `${a.id}-x` : a.id, from: bHi })
          changed = true
          continue outer
        }
      }
      next.push(a)
    }
    ps = next
    if (!changed) break
  }
  return ps.map((p) => ({ ...p, from: r6(p.from), to: r6(p.to) }))
}

export function bindBuildInterior(ctx: Ctx, _p: CorrectionProposal): Bound | Refusal {
  const C = INTERIOR_CONVENTIONS
  const m = ctx.model
  const obs = ctx.interior
  if (!obs) return { status: 'NEEDS_EVIDENCE', code: 'NO_PLAN_SKELETON', why: 'BUILD_INTERIOR needs the plan skeleton (the ground-floor plan read on the sheet inside the body\'s outline): none was read' }
  const record = { source: { frameId: obs.frameId, sourceByteHash: obs.sourceByteHash } }
  if (obs.walls.length === 0) return { status: 'NEEDS_EVIDENCE', code: 'NO_PARTITIONS_READ', why: `the plan skeleton read no partition inside the outline (${obs.why})`, record }
  const level = [...m.levels].sort((a, b) => a.elevation - b.elevation)[0]
  if (!level) return { status: 'UNSUPPORTED_OPERATION', code: 'NO_LEVEL', why: 'the model has no storey to build the interior on' }
  if (m.walls.some((w) => w.kind === 'INTERIOR' && w.levelId === level.id)) return { status: 'INVALID', code: 'INTERIOR_PRESENT', why: `the ground storey already has interior walls (${m.walls.filter((w) => w.kind === 'INTERIOR' && w.levelId === level.id).length}): they are kept, not replaced`, record }
  const bodies = bodiesOf(m).filter((b) => b.levelIds.includes(level.id) && b.wallIds.length > 0)
  if (bodies.length === 0) return { status: 'UNSUPPORTED_OPERATION', code: 'NO_BODY', why: 'the model has no walled body on its ground storey', record }
  const wallById = new Map(m.walls.map((w) => [w.id, w]))
  const inner = bodies.map((b) => {
    const t = Math.max(...b.wallIds.map((id) => wallById.get(id)?.thickness ?? 0.3))
    // the lowest line a roof over this body starts at (a roof stated by its eaves, or a plane's datum): the walls stay under it
    const over = (f: { minX: number; maxX: number; minZ: number; maxZ: number }): boolean => Math.min(f.maxX, b.rect.maxX) - Math.max(f.minX, b.rect.minX) > 0.5 && Math.min(f.maxZ, b.rect.maxZ) - Math.max(f.minZ, b.rect.minZ) > 0.5
    const eaves = [...m.roofs.filter((r) => over(r.footprint)).map((r) => r.eaveOffset), ...m.roofPlanes.filter((pl) => b.planeIds.includes(pl.id)).map((pl) => pl.datum.y - level.elevation)]
    const top = eaves.length > 0 ? Math.min(...eaves) - C.underEavesM : level.height
    return { b, t, rect: { minX: b.rect.minX + t, maxX: b.rect.maxX - t, minZ: b.rect.minZ + t, maxZ: b.rect.maxZ - t }, height: r6(Math.max(C.minHeightM, Math.min(C.heightM, top, level.height))) }
  })
  const evidenceOf = (interpretation: string, properties: Record<string, Evidence['status']>): Evidence => ({ status: 'SOURCE_DERIVED', source: obs.frameId, interpretation, properties } as Evidence)
  const cmds: BuildingCommand[] = []
  if (!m.materials.some((x) => x.id === 'mat-partition')) cmds.push({ type: 'defineMaterial', id: 'mat-partition', name: 'Partition', color: '#d9d5cc' } as BuildingCommand)
  const wallIds: string[] = []
  const doorIds: string[] = []
  let lengthM = 0
  const taken = new Set(m.walls.map((w) => w.id))
  const pieces: Piece[] = []
  for (const run of interiorRuns(obs.walls, obs.doors)) {
    for (const [k, body] of inner.entries()) {
      const r = body.rect
      const [lo, hi, a0, a1] = run.axis === 'X' ? [r.minX, r.maxX, r.minZ, r.maxZ] : [r.minZ, r.maxZ, r.minX, r.maxX]
      const half = run.thicknessM / 2
      // inside this body across its own line (a piece on the outer wall's line is the outer wall, not a partition)
      if (run.at - half <= a0 + 0.02 || run.at + half >= a1 - 0.02) continue
      let from = Math.max(run.from, lo)
      let to = Math.min(run.to, hi)
      if (from - lo <= C.reachFaceM) from = lo
      if (hi - to <= C.reachFaceM) to = hi
      if (to - from < C.minPieceM) continue
      pieces.push({ id: inner.length > 1 && k > 0 ? `${run.id}-b${k}` : run.id, axis: run.axis, at: run.at, half, from, to, doors: run.doors, height: body.height })
    }
  }
  for (const pc of resolveOverlaps(pieces)) {
    let id = pc.id
    for (let n = 2; taken.has(id); n += 1) id = `${pc.id}-${n}`
    taken.add(id)
    const start = pc.axis === 'X' ? { x: r6(pc.from), z: r6(pc.at - pc.half) } : { x: r6(pc.at + pc.half), z: r6(pc.from) }
    const end = pc.axis === 'X' ? { x: r6(pc.to), z: r6(pc.at - pc.half) } : { x: r6(pc.at + pc.half), z: r6(pc.to) }
    cmds.push({ type: 'createWall', id, levelId: level.id, start, end, thickness: r6(pc.half * 2), height: pc.height, baseOffset: 0, kind: 'INTERIOR', materialId: 'mat-partition', evidence: evidenceOf(`partition ink on the plan (${obs.frameId}), read in the sheet's wall colour; its height is not read`, { start: 'SOURCE_DERIVED', end: 'SOURCE_DERIVED', thickness: 'SOURCE_DERIVED', height: 'ASSUMED' }) } as BuildingCommand)
    wallIds.push(id)
    lengthM += pc.to - pc.from
    for (const d of pc.doors) {
      const d0 = Math.max(d.from, pc.from + 0.06)
      const d1 = Math.min(d.to, pc.to - 0.06)
      if (d1 - d0 < C.doorMinM) continue
      let did = d.id
      for (let n = 2; taken.has(did); n += 1) did = `${d.id}-${n}`
      taken.add(did)
      cmds.push({ type: 'cutOpening', id: did, wallId: id, kind: 'DOOR', offset: r6(d0 - pc.from), sill: 0, width: r6(d1 - d0), height: r6(Math.min(C.doorHeightM, pc.height - 0.1)), evidence: evidenceOf('a door gap between two pieces of the same partition on the plan; its height is not read', { offset: 'SOURCE_DERIVED', width: 'SOURCE_DERIVED', height: 'ASSUMED' }) } as BuildingCommand)
      doorIds.push(did)
    }
  }
  if (wallIds.length === 0) return { status: 'NEEDS_EVIDENCE', code: 'NO_PARTITION_INSIDE_A_BODY', why: `none of the ${obs.walls.length} partition piece(s) the plan draws lies inside a body of the model (the plan and the model do not share a frame, or the body is not where the plan has it)`, record }
  const allowed = [...wallIds.map((id) => `walls:${id}`), ...wallIds.map((id) => `wallJunctions:${id}*`), ...doorIds.map((id) => `openings:${id}`), 'materials:mat-partition']
  const measure = (working: CanonicalBuildingModel): { failure?: string; measure: { sourceVerified: boolean | null; why: string } } => {
    const built = working.walls.filter((w) => w.kind === 'INTERIOR' && wallIds.includes(w.id)).length
    if (built !== wallIds.length) return { failure: `${wallIds.length - built} interior wall(s) were not built`, measure: { sourceVerified: false, why: 'the candidate lacks walls the commands create' } }
    return { measure: { sourceVerified: null, why: `${wallIds.length} interior wall(s), ${lengthM.toFixed(1)} m, with ${doorIds.length} door(s), from the partition ink of ${obs.frameId} (${obs.why}); built to ${[...new Set(inner.map((q) => q.height.toFixed(2)))].join(' / ')} m (ASSUMED: no section is read); not source-verified by a second drawing` } }
  }
  return { commands: cmds, allowed, expect: { kind: 'CUSTOM', measure }, record: { ...record, bound: { frameId: obs.frameId, ids: wallIds, values: { walls: wallIds.length, doors: doorIds.length, lengthM: Math.round(lengthM * 100) / 100 } } } }
}
