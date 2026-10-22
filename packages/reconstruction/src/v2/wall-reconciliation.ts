/**
 * 005Y-N7 (A): two walls the model refuses as overlapping, read as what they are.
 *
 * The model's validator (`wallOverlapIssues`) is strict and stays strict: two walls that share plan area over a common
 * height range, with no declared junction, are an error. This module does not relax that. It answers the question the
 * validator cannot: is the overlap a contradiction in the source, or a difference smaller than the reading itself —
 * a partition drawn into the band of the wall it stops against, a body measured a line weight into its neighbour,
 * the same band read twice?
 *
 * Every function here is pure geometry on wall lines (start, end, thickness, material to the left of travel, as the
 * model draws them). The driver that applies a repair and asks the model again lives with the other program passes in
 * `candidate.ts`. A repair moves only the WEAKER wall (an interior wall before an exterior one, a later command before
 * an earlier one), only onto a face of the stronger, and only by as much as the evidence's own uncertainty allows; a
 * wall that would have to move further is named, not moved.
 */
import { round6 } from '@buildapp/source-common'
import type { BuildingCommand } from '@buildapp/commands'

export type Vec2 = { x: number; z: number }

/** A wall as the model states it: the outer line from start to end, the material to its left, `thickness` deep. */
export type WallLine = { id: string; start: Vec2; end: Vec2; thickness: number; kind: 'EXTERIOR' | 'INTERIOR' }

/**
 * How many plan pixels a wall's position is uncertain by: a drawn face is a line about two pixels wide, and the
 * frame rounds a face to the pixel. A difference within this many pixels is a difference in the reading, not in the
 * house.
 */
export const WALL_RECONCILE_PX = 3

/** Walls closer to parallel than this (sine of the angle between them) are parallel. */
const PARALLEL_SIN = Math.sin((1 * Math.PI) / 180)
/** A repaired wall shorter than this is not a wall (the partition planner's own minimum run). */
export const RECONCILED_MIN_LENGTH_M = 0.2

/** The tolerance a plan of this scale supports, in metres. */
export const reconcileToleranceM = (metresPerPixel: number): number => round6(WALL_RECONCILE_PX * metresPerPixel)

type Frame = { p: Vec2; u: Vec2; inward: Vec2; L: number; T: number }

const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.z * b.z
const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, z: a.z - b.z })
const at = (p: Vec2, v: Vec2, s: number): Vec2 => ({ x: p.x + v.x * s, z: p.z + v.z * s })
const r6 = (p: Vec2): Vec2 => ({ x: round6(p.x), z: round6(p.z) })

/** A wall's frame: its start, unit direction, the side its material is on, length and thickness. */
export function frameOf(w: WallLine): Frame {
  const d = sub(w.end, w.start)
  const L = Math.hypot(d.x, d.z)
  const u = { x: d.x / L, z: d.z / L }
  return { p: w.start, u, inward: { x: -u.z, z: u.x }, L, T: w.thickness }
}

/** Depth of a point into a wall's band: 0 on its outer line, `thickness` on its inner face. */
export const depthInto = (f: Frame, pt: Vec2): number => dot(sub(pt, f.p), f.inward)
/** Distance of a point along a wall from its start. */
export const alongOf = (f: Frame, pt: Vec2): number => dot(sub(pt, f.p), f.u)

export type WallConflictRelation =
  /** The two bands are one band: the same wall read twice, or two bodies each claiming a shared wall. */
  | 'COINCIDENT_BAND'
  /** Parallel walls whose bands overlap across part of their depth. */
  | 'PARALLEL_OVERLAP'
  /** One end of the weaker wall stands in the other's band, or passes through it by no more than the tolerance. */
  | 'END_INTO_BAND'
  /** The other wall's end stands in the weaker wall's band. */
  | 'HOST_END_INTO_BAND'
  /** The weaker wall passes through the other one. */
  | 'CROSSING'

export type WallConflict = {
  relation: WallConflictRelation
  /** How deep the bands interpenetrate across their faces (parallel), or how far the end runs into the band. */
  penetrationM: number
  /** For an end: which end, how much to trim to reach the near face, and how far past the far face it reached. */
  end?: 'START' | 'END'
  trimM?: number
  throughM?: number
  /** For parallel walls: the lateral move (along the stronger wall's inward normal) that clears them. */
  shiftM?: number
  /** For parallel walls: the stretch, along the weaker wall from its start, that lies along the stronger. */
  alongOverlap?: { from: number; to: number }
  why: string
}

const fmt = (m: number): string => `${(m * 100).toFixed(1)} cm`

/** Two parallel walls: how their bands overlap across their depth and along their length. */
function parallelConflict(n: WallLine, e: WallLine, toleranceM: number): WallConflict {
  const fn = frameOf(n)
  const fe = frameOf(e)
  const same = dot(fn.inward, fe.inward) > 0
  const d0 = depthInto(fe, n.start)
  const lo = same ? d0 : d0 - fn.T
  const hi = same ? d0 + fn.T : d0
  const a0 = alongOf(fe, n.start)
  const a1 = alongOf(fe, n.end)
  const from = Math.max(Math.min(a0, a1), 0)
  const to = Math.min(Math.max(a0, a1), fe.L)
  // the stretch of n that lies along e, measured along n from its start
  const nFrom = Math.min(Math.abs(from - a0), Math.abs(to - a0))
  const nTo = Math.max(Math.abs(from - a0), Math.abs(to - a0))
  // a band that lies within the other's (to the tolerance) is that wall read again
  if (lo >= -toleranceM && hi <= fe.T + toleranceM)
    return { relation: 'COINCIDENT_BAND', penetrationM: round6(Math.min(hi, fe.T) - Math.max(lo, 0)), alongOverlap: { from: round6(nFrom), to: round6(nTo) }, why: `${n.id} lies in the band of ${e.id} (faces ${fmt(lo)} and ${fmt(hi - fe.T)} off its faces) for ${(to - from).toFixed(2)} m` }
  const shift = (lo + hi) / 2 < fe.T / 2 ? -hi : fe.T - lo
  return { relation: 'PARALLEL_OVERLAP', penetrationM: round6(Math.abs(shift)), shiftM: round6(shift), alongOverlap: { from: round6(nFrom), to: round6(nTo) }, why: `${n.id} runs ${fmt(Math.abs(shift))} into the band of ${e.id}, parallel to it, for ${(to - from).toFixed(2)} m` }
}

/**
 * The stretch of a wall (from its start) that one of its long faces spends inside another wall's band, unclamped:
 * `[lo, hi]` in metres along it.
 */
function faceInterval(fn: Frame, faceDepth: number, fe: Frame): [number, number] {
  const q = at(fn.p, fn.inward, faceDepth)
  const s = dot(fn.u, fe.inward)
  const d0 = depthInto(fe, q)
  const t0 = (0 - d0) / s
  const t1 = (fe.T - d0) / s
  return [Math.min(t0, t1), Math.max(t0, t1)]
}

/** Two walls at an angle: where the weaker one meets the stronger one's band. */
function angledConflict(n: WallLine, e: WallLine, toleranceM: number): WallConflict {
  const fn = frameOf(n)
  const fe = frameOf(e)
  const faces = [faceInterval(fn, 0, fe), faceInterval(fn, fn.T, fe)]
  const tIn = Math.min(faces[0][0], faces[1][0])
  const tOut = Math.max(faces[0][1], faces[1][1])
  // An end inside the band, or one whose stub beyond the far face is within the tolerance. The wall's body is on the
  // near side: a start outside the band (tIn > 0) has passed through to the far side by tIn.
  if (tIn <= toleranceM && tOut < fn.L) {
    const through = Math.max(0, tIn)
    return { relation: 'END_INTO_BAND', end: 'START', penetrationM: round6(tOut), trimM: round6(tOut), throughM: round6(through), why: `the start of ${n.id} stands ${fmt(tOut)} into ${e.id}${through > 0 ? `, ${fmt(through)} past its far face` : ''}` }
  }
  if (tOut >= fn.L - toleranceM && tIn > 0) {
    const through = Math.max(0, fn.L - tOut)
    const trim = fn.L - tIn
    return { relation: 'END_INTO_BAND', end: 'END', penetrationM: round6(trim), trimM: round6(trim), throughM: round6(through), why: `the end of ${n.id} stands ${fmt(trim)} into ${e.id}${through > 0 ? `, ${fmt(through)} past its far face` : ''}` }
  }
  return { relation: 'CROSSING', penetrationM: round6(Math.max(0, Math.min(tOut, fn.L) - Math.max(tIn, 0))), why: `${n.id} passes through ${e.id} ${Math.max(tIn, 0).toFixed(2)}–${Math.min(tOut, fn.L).toFixed(2)} m from its start` }
}

/** Is the stronger wall's end standing in the weaker wall's band (the weaker wall is the host there)? */
function hostEndConflict(n: WallLine, e: WallLine, toleranceM: number): WallConflict | null {
  const reverse = angledConflict(e, n, toleranceM)
  if (reverse.relation !== 'END_INTO_BAND') return null
  const fn = frameOf(n)
  const fe = frameOf(e)
  const tip = reverse.end === 'START' ? e.start : e.end
  const body = reverse.end === 'START' ? fe.u : { x: -fe.u.x, z: -fe.u.z }
  const depth = Math.min(fn.T, Math.max(0, depthInto(fn, tip)))
  // the stronger wall comes in through the face on its own side; the weaker one moves away from it until that face
  // is where the end stops
  const fromInner = dot(body, fn.inward) > 0
  const reach = fromInner ? fn.T - depth : depth
  const shift = fromInner ? -reach : reach
  return { relation: 'HOST_END_INTO_BAND', penetrationM: round6(reach), shiftM: round6(shift), why: `the ${reverse.end === 'START' ? 'start' : 'end'} of ${e.id} stands ${fmt(reach)} into ${n.id}` }
}

/** How the weaker wall `n` and the stronger wall `e` overlap. */
export function classifyWallConflict(n: WallLine, e: WallLine, toleranceM: number): WallConflict {
  const fn = frameOf(n)
  const fe = frameOf(e)
  const sin = Math.abs(fn.u.x * fe.u.z - fn.u.z * fe.u.x)
  if (sin < PARALLEL_SIN) return parallelConflict(n, e, toleranceM)
  const own = angledConflict(n, e, toleranceM)
  if (own.relation !== 'CROSSING') return own
  return hostEndConflict(n, e, toleranceM) ?? own
}

export type WallRepairAction = 'TRIMMED_TO_FACE' | 'SHIFTED_CLEAR' | 'DUPLICATE_TRIMMED' | 'DUPLICATE_OMITTED' | 'OMITTED' | 'REFUSED'

export type WallRepair =
  | { action: 'TRIMMED_TO_FACE' | 'SHIFTED_CLEAR' | 'DUPLICATE_TRIMMED'; wall: WallLine; moveM: number; withinUncertainty: true; why: string }
  | { action: 'DUPLICATE_OMITTED' | 'OMITTED' | 'REFUSED'; moveM?: number; withinUncertainty: boolean; why: string }

/** The wall with one end moved along it by `byM` (positive shortens it). */
export function trimWallEnd(w: WallLine, end: 'START' | 'END', byM: number): WallLine {
  const f = frameOf(w)
  return end === 'START' ? { ...w, start: r6(at(w.start, f.u, byM)) } : { ...w, end: r6(at(w.end, f.u, -byM)) }
}

/** The wall moved sideways by `byM` along `normal`. */
export function shiftWall(w: WallLine, normal: Vec2, byM: number): WallLine {
  return { ...w, start: r6(at(w.start, normal, byM)), end: r6(at(w.end, normal, byM)) }
}

const length = (w: WallLine): number => Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z)

/**
 * What to do with the weaker wall `n` so it no longer overlaps `e`, or why nothing may be done. A wall is moved only
 * onto a face of `e`: its end trimmed to the near face (the junction the drawing shows), or the whole wall moved off
 * the band by no more than the tolerance. A duplicate keeps only what lies beyond the stronger wall.
 */
export function proposeWallRepair(n: WallLine, e: WallLine, c: WallConflict, toleranceM: number): WallRepair {
  const tol = `the plan's ${fmt(toleranceM)} uncertainty`
  if (c.relation === 'END_INTO_BAND' && c.end && c.trimM !== undefined) {
    const fe = frameOf(e)
    if ((c.throughM ?? 0) > toleranceM || c.trimM > fe.T + toleranceM) return refuseOrOmit(n, c, toleranceM, `${c.why}: further than ${tol} beyond the band`)
    const wall = trimWallEnd(n, c.end, c.trimM)
    if (length(wall) < RECONCILED_MIN_LENGTH_M) return refuseOrOmit(n, c, toleranceM, `${c.why}: trimmed to the face it would be ${length(wall).toFixed(2)} m long`)
    return { action: 'TRIMMED_TO_FACE', wall, moveM: c.trimM, withinUncertainty: true, why: `${c.why}; its ${c.end.toLowerCase()} trimmed to the face of ${e.id}, the junction the plan draws` }
  }
  if ((c.relation === 'PARALLEL_OVERLAP' || c.relation === 'HOST_END_INTO_BAND') && c.shiftM !== undefined) {
    if (Math.abs(c.shiftM) > toleranceM) return refuseOrOmit(n, c, toleranceM, `${c.why}: clearing it would move it ${fmt(Math.abs(c.shiftM))}, more than ${tol}`)
    const normal = c.relation === 'PARALLEL_OVERLAP' ? frameOf(e).inward : frameOf(n).inward
    return { action: 'SHIFTED_CLEAR', wall: shiftWall(n, normal, c.shiftM), moveM: Math.abs(c.shiftM), withinUncertainty: true, why: `${c.why}; moved ${fmt(Math.abs(c.shiftM))} onto the face of ${e.id}, within ${tol}` }
  }
  if (c.relation === 'COINCIDENT_BAND' && c.alongOverlap) {
    const L = length(n)
    const before = c.alongOverlap.from
    const after = L - c.alongOverlap.to
    if (before < RECONCILED_MIN_LENGTH_M && after < RECONCILED_MIN_LENGTH_M)
      return { action: 'DUPLICATE_OMITTED', withinUncertainty: true, why: `${c.why}: the same wall as ${e.id}, which stands; it is not built twice` }
    // keep the longer stretch beyond the stronger wall: a wall continuing past another in line
    const wall = after >= before ? trimWallEnd(n, 'START', c.alongOverlap.to) : trimWallEnd(n, 'END', L - c.alongOverlap.from)
    if (before >= RECONCILED_MIN_LENGTH_M && after >= RECONCILED_MIN_LENGTH_M) return refuseOrOmit(n, c, toleranceM, `${c.why}: it continues on both sides of ${e.id}`)
    return { action: 'DUPLICATE_TRIMMED', wall, moveM: round6(after >= before ? c.alongOverlap.to : L - c.alongOverlap.from), withinUncertainty: true, why: `${c.why}: the stretch along ${e.id} is that wall; the rest continues it` }
  }
  return refuseOrOmit(n, c, toleranceM, c.why)
}

/** An interior wall the source cannot place is left out and named; an exterior one stops the model. */
function refuseOrOmit(n: WallLine, c: WallConflict, toleranceM: number, why: string): WallRepair {
  return n.kind === 'INTERIOR'
    ? { action: 'OMITTED', withinUncertainty: false, moveM: c.penetrationM, why: `${why}; the partition is left out of the model and named` }
    : { action: 'REFUSED', withinUncertainty: c.penetrationM <= toleranceM, moveM: c.penetrationM, why: `${why}; an exterior wall is not moved further than the reading allows` }
}

/** The walls a ring command states, in the order and orientation the model builds them (material to the left). */
export function ringWallLines(ring: { id?: string; polygon: Vec2[]; thickness: number; kind?: 'EXTERIOR' | 'INTERIOR'; walls?: Array<{ id?: string; thickness?: number } | undefined> }, ringId: string): { lines: WallLine[]; reversed: boolean } {
  const n = ring.polygon.length
  let signed = 0
  for (let i = 0; i < n; i += 1) {
    const a = ring.polygon[i]
    const b = ring.polygon[(i + 1) % n]
    signed += a.x * b.z - b.x * a.z
  }
  // the model's signed area is of (x, z) with z down the sheet: it reverses a ring whose shoelace here is negative
  const reversed = signed / 2 < 0
  const polygon = reversed ? [ring.polygon[0], ...ring.polygon.slice(1).reverse()] : ring.polygon
  const overrides: Array<{ id?: string; thickness?: number } | undefined> = []
  for (let i = 0; i < n; i += 1) {
    const o = ring.walls?.[i]
    if (o) overrides[reversed ? (n - 1 - i) % n : i] = o
  }
  return {
    reversed,
    lines: polygon.map((p, i) => ({ id: overrides[i]?.id ?? `${ringId}-w${i}`, start: p, end: polygon[(i + 1) % n], thickness: overrides[i]?.thickness ?? ring.thickness, kind: ring.kind ?? 'EXTERIOR' })),
  }
}

/**
 * The ring's footprint with edge `edge` (in the model's orientation) moved sideways by `byM` along `normal`: both of
 * its corners move, so the neighbouring edges lengthen or shorten and stay where they were.
 */
export function moveRingEdge(polygon: readonly Vec2[], reversed: boolean, edge: number, normal: Vec2, byM: number): Vec2[] {
  const n = polygon.length
  // edge k of the model's ring runs between model vertices k and k+1; map them back to the stated polygon
  const stated = (k: number): number => (reversed ? (n - (k % n)) % n : k % n)
  const moved = new Set([stated(edge), stated(edge + 1)])
  return polygon.map((p, i) => (moved.has(i) ? r6(at(p, normal, byM)) : p))
}

/** How far a wall's start moved along it: what an opening's offset from the start must lose to stay where it was. */
export function startShiftAlong(before: WallLine, after: WallLine): number {
  return round6(alongOf(frameOf(after), before.start) * -1)
}

// ---------------------------------------------------------------------------
// Commands: a repaired wall written back, and the commands that refer to it
// ---------------------------------------------------------------------------

type CreateWall = Extract<BuildingCommand, { type: 'createWall' }>
type CreateWallRing = Extract<BuildingCommand, { type: 'createWallRing' }>

/** The wall a createWall command states. */
export const wallLineOf = (c: CreateWall): WallLine => ({ id: c.id ?? '', start: c.start, end: c.end, thickness: c.thickness, kind: c.kind ?? 'EXTERIOR' })

/**
 * A ring whose edge `drop` is another wall's band, as the open chain of its other edges: the same wall ids, each
 * cornered on the one before it as the ring cornered them. The chain's two free ends stand in the band they share and
 * are trimmed to its face like any other wall end.
 */
export function openRingWithout(c: CreateWallRing, ringId: string, drop: number): { walls: CreateWall[]; keptIds: string[] } {
  const { lines, reversed } = ringWallLines(c, ringId)
  const n = lines.length
  const overrideOf = (k: number) => c.walls?.[reversed ? (n - 1 - k + n) % n : k]
  const walls: CreateWall[] = []
  for (let step = 1; step < n; step += 1) {
    const k = (drop + step) % n
    const o = overrideOf(k) ?? {}
    const prev = walls[walls.length - 1]
    const ownership = c.cornerOwnership ?? 'ALTERNATE'
    // the ring's own rule for who owns corner k (between edge k-1 and edge k)
    const selfOwns = ownership === 'FOLLOWING' || (ownership === 'ALTERNATE' && k % 2 === 0)
    walls.push({
      type: 'createWall',
      id: lines[k].id,
      ...(o.name ? { name: o.name } : {}),
      ...(o.evidence ?? c.evidence ? { evidence: o.evidence ?? c.evidence } : {}),
      ...(o.tags ?? c.tags ? { tags: o.tags ?? c.tags } : {}),
      levelId: c.levelId,
      start: lines[k].start,
      end: lines[k].end,
      thickness: o.thickness ?? c.thickness,
      height: o.height ?? c.height,
      baseOffset: c.baseOffset ?? 0,
      kind: c.kind ?? 'EXTERIOR',
      ...(o.topProfile ?? c.topProfile ? { topProfile: o.topProfile ?? c.topProfile } : {}),
      ...(o.materialId ?? c.materialId ? { materialId: o.materialId ?? c.materialId } : {}),
      ...(prev ? { startJunction: { kind: 'CORNER' as const, id: `${ringId}-j${k}`, with: { wallId: prev.id ?? '', end: 'END' as const }, owner: selfOwns ? ('SELF' as const) : ('OTHER' as const), ...(c.tolerance !== undefined ? { tolerance: c.tolerance } : {}) } } : {}),
    })
  }
  return { walls, keptIds: walls.map((w) => w.id ?? '') }
}

/** What later commands need to know about the walls repaired so far. */
export type ReconciledReferences = {
  /** Objects left out of the model: a command that needs one goes too, a list that names one loses it. */
  omitted: Set<string>
  /** Metres each wall's start moved along it: what its openings' offsets lose. */
  startShift: Map<string, number>
  /** Rings opened into separate walls: their evidence goes to each wall. */
  openedRings: Map<string, string[]>
  /** A wall left out because it is another wall's band: openings cut in it are cut in that wall instead. */
  retarget: Map<string, { from: WallLine; to: WallLine }>
}

/** The smallest opening worth keeping when a trim cuts into it. */
const OPENING_MIN_WIDTH_M = 0.3

const SKIP_KEYS = new Set(['type', 'id'])

/** Does a command name an omitted object where it needs it (a scalar), or only in a list it can lose it from? */
function withoutOmitted(value: unknown, omitted: ReadonlySet<string>, key: string): { value: unknown; needs: boolean } {
  if (typeof value === 'string') return { value, needs: !SKIP_KEYS.has(key) && omitted.has(value) }
  if (Array.isArray(value)) {
    let needs = false
    const kept: unknown[] = []
    for (const v of value) {
      if (typeof v === 'string' && omitted.has(v)) continue
      const inner = withoutOmitted(v, omitted, key)
      if (inner.needs) needs = true
      kept.push(inner.value)
    }
    return { value: kept, needs }
  }
  if (value && typeof value === 'object') {
    let needs = false
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      const inner = withoutOmitted(v, omitted, k)
      if (inner.needs) needs = true
      out[k] = inner.value
    }
    return { value: out, needs }
  }
  return { value, needs: false }
}

/**
 * A later command as it must read after the repairs: offsets measured from a start that moved, evidence of a ring
 * that is now walls, nothing that needs an object left out. Empty when the command cannot stand.
 */
export function rewriteReferences(command: BuildingCommand, refs: ReconciledReferences): BuildingCommand[] {
  if (command.type === 'setEvidence' && refs.openedRings.has(command.targetId)) return (refs.openedRings.get(command.targetId) ?? []).map((id) => ({ ...command, targetId: id }))
  if (command.type === 'cutOpening') {
    // a further leaf left out is a leaf the opening no longer passes through, not a reason to lose the opening
    if (command.leaves?.some((l) => refs.omitted.has(l.wallId))) {
      const leaves = command.leaves.filter((l) => !refs.omitted.has(l.wallId))
      const { leaves: _dropped, ...rest } = command
      command = leaves.length > 0 ? { ...rest, leaves } : rest
    }
    const moved = refs.retarget.get(command.wallId)
    if (moved) {
      const onto = retargetOpening(command, moved.from, moved.to)
      if (!onto) return []
      command = onto
    }
  }
  if (refs.omitted.size > 0) {
    const { value, needs } = withoutOmitted(command, refs.omitted, '')
    if (needs) return []
    command = value as BuildingCommand
  }
  if (command.type === 'cutOpening' && refs.startShift.has(command.wallId)) {
    const offset = round6(command.offset - (refs.startShift.get(command.wallId) ?? 0))
    if (offset >= 0) return [{ ...command, offset }]
    const width = round6(command.width + offset)
    return width >= OPENING_MIN_WIDTH_M ? [{ ...command, offset: 0, width }] : []
  }
  if (command.type === 'createSurfaceRegion' && refs.startShift.has(command.hostId)) {
    const s = refs.startShift.get(command.hostId) ?? 0
    return [{ ...command, rect: { ...command.rect, a0: round6(command.rect.a0 - s), a1: round6(command.rect.a1 - s) } }]
  }
  return [command]
}

/** The objects a command creates, by id: what goes with it when it is left out. */
export const createdIdOf = (command: BuildingCommand): string | undefined => ('id' in command && typeof command.id === 'string' ? command.id : undefined)

/**
 * An opening cut in a wall that is left out as another wall's band, cut in that wall at the same place in the world:
 * its span projected onto the other wall's line. Null when less than a useful opening lands on it.
 */
export function retargetOpening(c: Extract<BuildingCommand, { type: 'cutOpening' }>, from: WallLine, to: WallLine): Extract<BuildingCommand, { type: 'cutOpening' }> | null {
  const ff = frameOf(from)
  const ft = frameOf(to)
  const a0 = alongOf(ft, at(from.start, ff.u, c.offset))
  const a1 = alongOf(ft, at(from.start, ff.u, c.offset + c.width))
  const lo = Math.max(0, Math.min(a0, a1))
  const hi = Math.min(ft.L, Math.max(a0, a1))
  if (hi - lo < OPENING_MIN_WIDTH_M) return null
  const reversed = dot(ff.u, ft.u) < 0
  const openEnd = c.openEnd && reversed ? (c.openEnd === 'START' ? 'END' : 'START') : c.openEnd
  return { ...c, wallId: to.id, offset: round6(lo), width: round6(hi - lo), ...(openEnd ? { openEnd } : {}) }
}
