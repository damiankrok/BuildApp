/**
 * BUILDPLAN-ANALYZER-005Y-N4 (D): a stair stands in its shaft, against the walls that bound it — never in them.
 *
 * The flights are read from one plan's tread ladders and the walls from the plan of the storey the stair stands on;
 * each reading carries a few pixels of registration and band uncertainty. Where the stair's laid-out outline runs a
 * few centimetres into a wall or stack along one of its sides (a flight drawn against a wall), the stair is moved off
 * it — by no more than `STAIR_SNAP_MAX_M`, the reading's own uncertainty — with the hole in the slab above it. A body
 * deeper inside the outline is not a bounding wall (a partition under a flight, a closet under the landing): it is
 * left where it stands and named, never moved and never deleted. When the bounding walls on two opposite sides leave
 * less room than the stair takes, nothing moves and the conflict is named.
 */
import type { BuildingCommand } from '@buildapp/commands'
import { layoutStair, resolveWallTopology, wallPhysicalFootprint } from '@buildapp/model'
import type { CanonicalBuildingModel } from '@buildapp/model'
import { round6 } from '@buildapp/source-common'
import { buildCandidateModel, programApplies } from '../candidate.js'

/** 005Y-N4 (D): a stair's place is read to within this: a bounding wall overlapping it by more is not moved away from. */
export const STAIR_SNAP_MAX_M = 0.15
/** 005Y-N4 (D): two bounding readings may leave this much less room than the stair takes; it is split and named. */
export const STAIR_CONTACT_RESIDUAL_M = 0.03

type Box = { minX: number; maxX: number; minZ: number; maxZ: number }
export type StairObstacle = { id: string; box: Box }
/** A tread or landing of the laid-out stair: its plan box, and the axis walked across it (`null` on a landing). */
export type StairCell = { box: Box; travel: 'x' | 'z' | null }
export type StairFit = {
  stairId: string
  action: 'NONE' | 'MOVED' | 'REFUSED'
  dx: number
  dz: number
  /** obstacles a side of the stair ran into, which the move clears */
  bounding: string[]
  /** obstacles deeper inside the stair's outline than a reading's uncertainty: under-stair walls and the like */
  inside: string[]
  why: string
}

const EPS = 1e-6

/**
 * The move (dx, dz) that takes a stair's outline `extent` off every obstacle overlapping one of its sides by at most
 * `STAIR_SNAP_MAX_M`. Each such obstacle is cleared along the axis of its shallower penetration, toward the stair's
 * interior side. A bounding wall runs beside a flight, across the walking direction of every tread it meets; a wall
 * the treads walk toward (under a flight's start or arrival end) is under the stair, not beside it. Pure plan arithmetic.
 */
export function stairSnap(stairId: string, extent: Box, obstacles: readonly StairObstacle[], cells: readonly StairCell[] = []): StairFit {
  const lo = { x: -Infinity, z: -Infinity }
  const hi = { x: Infinity, z: Infinity }
  const bounding: string[] = []
  const inside: string[] = []
  const lim = { x: [extent.minX, extent.maxX], z: [extent.minZ, extent.maxZ] } as const
  const range = (bx: Box, axis: 'x' | 'z'): [number, number] => (axis === 'x' ? [bx.minX, bx.maxX] : [bx.minZ, bx.maxZ])
  const overlap = (p: [number, number], q: readonly [number, number] | [number, number]): number => Math.min(p[1], q[1]) - Math.max(p[0], q[0])
  for (const o of obstacles) {
    const hits = overlap(range(o.box, 'x'), lim.x) > EPS && overlap(range(o.box, 'z'), lim.z) > EPS
    let side = false
    for (const axis of ['x', 'z'] as const) {
      const other = axis === 'x' ? 'z' : 'x'
      if (overlap(range(o.box, other), lim[other]) <= EPS) continue
      const [o0, o1] = range(o.box, axis)
      const [e0, e1] = lim[axis]
      // beside the stair's far (+) or near (−) edge, at most a reading's uncertainty into it or away from it
      const plus = o0 >= e1 - STAIR_SNAP_MAX_M && o1 > e1 && o0 <= e1 + STAIR_SNAP_MAX_M
      const minus = o1 <= e0 + STAIR_SNAP_MAX_M && o0 < e0 && o1 >= e0 - STAIR_SNAP_MAX_M
      if (!plus && !minus) continue
      // the treads along that edge must run past the obstacle, not walk into it
      const edge = plus ? e1 : e0
      const near = cells.filter((c) => overlap(range(c.box, other), range(o.box, other)) > EPS && (plus ? range(c.box, axis)[1] >= edge - STAIR_SNAP_MAX_M : range(c.box, axis)[0] <= edge + STAIR_SNAP_MAX_M))
      if (near.some((c) => c.travel === axis)) continue
      side = true
      const pen = plus ? e1 - o0 : o1 - e0
      if (pen > EPS) bounding.push(o.id)
      if (plus) hi[axis] = Math.min(hi[axis], -pen)
      else lo[axis] = Math.max(lo[axis], pen)
    }
    if (hits && !side) inside.push(o.id)
  }
  const residuals: string[] = []
  const pick = (a: 'x' | 'z'): number | null => {
    if (lo[a] > hi[a] + EPS) {
      // two bounding readings closer than the stair is wide: within a contact tolerance, split the difference and say so
      if (lo[a] - hi[a] > STAIR_CONTACT_RESIDUAL_M) return null
      residuals.push(`${(lo[a] - hi[a]).toFixed(3)} m along ${a}`)
      return (lo[a] + hi[a]) / 2
    }
    if (lo[a] > 0) return lo[a]
    if (hi[a] < 0) return hi[a]
    return 0
  }
  const dx = pick('x')
  const dz = pick('z')
  if (dx === null || dz === null) {
    return { stairId, action: 'REFUSED', dx: 0, dz: 0, bounding, inside, why: `the walls bounding ${stairId} on opposite sides leave less room than its flights take (${bounding.join(', ')}): left where it was read, the conflict named` }
  }
  if (Math.abs(dx) < EPS && Math.abs(dz) < EPS) return { stairId, action: 'NONE', dx: 0, dz: 0, bounding, inside, why: `${stairId} clears every wall along its sides` }
  const residual = residuals.length > 0 ? `; the bounding readings leave ${residuals.join(', ')} less than the stair takes, split between its two sides` : ''
  return { stairId, action: 'MOVED', dx: round6(dx), dz: round6(dz), bounding, inside, why: `${stairId} ran into ${bounding.join(', ')} along its sides by up to ${Math.max(Math.abs(dx), Math.abs(dz)).toFixed(3)} m — within a reading's uncertainty — and stands against them instead${residual}` }
}

/** The obstacles on a stair's storey: every wall's physical footprint and every chimney stack, as plan boxes. */
function obstaclesOn(model: CanonicalBuildingModel, levelId: string): StairObstacle[] {
  const topology = resolveWallTopology(model)
  const out: StairObstacle[] = []
  for (const w of model.walls) {
    if (w.levelId !== levelId) continue
    const extent = topology.extents.get(w.id)
    if (!extent) continue
    const poly = wallPhysicalFootprint(w, extent)
    out.push({ id: w.id, box: { minX: Math.min(...poly.map((p) => p.x)), maxX: Math.max(...poly.map((p) => p.x)), minZ: Math.min(...poly.map((p) => p.z)), maxZ: Math.max(...poly.map((p) => p.z)) } })
  }
  for (const c of model.chimneys) out.push({ id: c.id, box: c.footprint })
  return out
}

/**
 * Fit every flight stair of an emitted program to the walls that bound it: its `start` moves by the snap, and every
 * hole in the slab of the storey it climbs to that lies over its read outline moves with it. Other commands are
 * untouched.
 */
export function fitStairToBoundingWalls(program: readonly BuildingCommand[], label: string, modelId: string): { program: BuildingCommand[]; fits: StairFit[] } {
  const model = buildCandidateModel(program, label, modelId)
  const fits: StairFit[] = []
  const moves = new Map<string, { dx: number; dz: number; toLevelId: string; extent: Box }>()
  for (const s of model.stairs) {
    if (s.kind !== 'FLIGHTS') continue
    const from = model.levels.find((l) => l.id === s.levelId)
    const to = model.levels.find((l) => l.id === s.toLevelId)
    if (!from || !to) continue
    const layout = layoutStair(s, from, to)
    if (!layout.ok || !layout.extent) continue
    const boxOf = (poly: ReadonlyArray<{ x: number; z: number }>): Box => ({ minX: Math.min(...poly.map((p) => p.x)), maxX: Math.max(...poly.map((p) => p.x)), minZ: Math.min(...poly.map((p) => p.z)), maxZ: Math.max(...poly.map((p) => p.z)) })
    const cells: StairCell[] = [
      ...layout.steps.filter((st) => st.tread).map((st) => ({ box: boxOf(st.tread ?? []), travel: Math.abs(st.direction.x) > Math.abs(st.direction.z) ? ('x' as const) : ('z' as const) })),
      ...layout.landings.map((l) => ({ box: boxOf(l.polygon), travel: null })),
    ]
    const fit = stairSnap(s.id, layout.extent, obstaclesOn(model, s.levelId), cells)
    fits.push(fit)
    if (fit.action === 'MOVED') moves.set(s.id, { dx: fit.dx, dz: fit.dz, toLevelId: s.toLevelId, extent: layout.extent })
  }
  if (moves.size === 0) return { program: [...program], fits }
  const over = (poly: ReadonlyArray<{ x: number; z: number }>, e: Box): boolean =>
    Math.min(...poly.map((p) => p.x)) < e.maxX && Math.max(...poly.map((p) => p.x)) > e.minX && Math.min(...poly.map((p) => p.z)) < e.maxZ && Math.max(...poly.map((p) => p.z)) > e.minZ
  const out = program.map((c): BuildingCommand => {
    if (c.type === 'createStair' && c.id !== undefined && moves.has(c.id)) {
      const m = moves.get(c.id) as { dx: number; dz: number }
      return { ...c, start: { x: round6(c.start.x + m.dx), z: round6(c.start.z + m.dz) } }
    }
    if (c.type === 'createSlab' && c.holes) {
      const m = [...moves.values()].find((v) => v.toLevelId === c.levelId)
      if (m) return { ...c, holes: c.holes.map((h) => (over(h, m.extent) ? h.map((p) => ({ x: round6(p.x + m.dx), z: round6(p.z + m.dz) })) : h)) }
    }
    return c
  })
  return { program: out, fits }
}

/** 005Y-N4 (D): a partition stops this far below a flight's underside at the least; less than this is no wall there. */
export const UNDER_STAIR_MIN_HEIGHT_M = 0.3

export type UnderStairWall = { wallId: string; stairId: string; action: 'FOLLOWS_SOFFIT' | 'REFUSED'; points?: Array<{ u: number; height: number }>; why: string }

/**
 * The top of a partition standing under a flight: its own height where no tread or landing is above it, and the
 * underside of the cells above it where they are (the stair's underside is stepped, cell by cell, as the compiler
 * builds it: a cell's bottom is its top less a riser and the waist). An axis-aligned wall only; `null` when it is
 * not under the stair (a cell reaching no more than `STAIR_CONTACT_RESIDUAL_M` across its thickness only grazes it), or when a cell above it would leave less than `UNDER_STAIR_MIN_HEIGHT_M` of wall (a wall
 * crossing the lowest steps is a conflict, not a wall under the stair).
 */
export function underStairProfile(
  wall: { start: { x: number; z: number }; end: { x: number; z: number }; thickness: number; height: number; base: number },
  body: Box,
  cells: ReadonlyArray<{ box: Box; bottom: number }>,
): Array<{ u: number; height: number }> | null | 'TOO_LOW' {
  const alongX = Math.abs(wall.end.x - wall.start.x) > Math.abs(wall.end.z - wall.start.z)
  const forward = alongX ? wall.end.x >= wall.start.x : wall.end.z >= wall.start.z
  const length = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z)
  const uOf = (v: number): number => (forward ? v - (alongX ? wall.start.x : wall.start.z) : (alongX ? wall.start.x : wall.start.z) - v)
  const spans: Array<{ u0: number; u1: number; top: number }> = []
  const across = (c: { box: Box }): number => (alongX ? Math.min(c.box.maxZ, body.maxZ) - Math.max(c.box.minZ, body.minZ) : Math.min(c.box.maxX, body.maxX) - Math.max(c.box.minX, body.minX))
  // cells grazing the wall's face by a contact residual are beside it, not over it: a wall only they reach is no wall under the stair
  if (!cells.some((c) => across(c) > STAIR_CONTACT_RESIDUAL_M && Math.min(c.box.maxX, body.maxX) - Math.max(c.box.minX, body.minX) > EPS && Math.min(c.box.maxZ, body.maxZ) - Math.max(c.box.minZ, body.minZ) > EPS)) return null
  for (const c of cells) {
    const ox = Math.min(c.box.maxX, body.maxX) - Math.max(c.box.minX, body.minX)
    const oz = Math.min(c.box.maxZ, body.maxZ) - Math.max(c.box.minZ, body.minZ)
    if (ox <= EPS || oz <= EPS) continue
    const top = c.bottom - wall.base
    if (top >= wall.height - EPS) continue
    const [a, b] = alongX ? [Math.max(c.box.minX, body.minX), Math.min(c.box.maxX, body.maxX)] : [Math.max(c.box.minZ, body.minZ), Math.min(c.box.maxZ, body.maxZ)]
    const [u0, u1] = [uOf(a), uOf(b)].sort((p, q) => p - q)
    spans.push({ u0: Math.max(0, u0), u1: Math.min(length, u1), top })
  }
  if (spans.length === 0) return null
  if (spans.some((s) => s.top < UNDER_STAIR_MIN_HEIGHT_M)) return 'TOO_LOW'
  const cuts = [...new Set([0, length, ...spans.flatMap((s) => [s.u0, s.u1])].map((u) => round6(u)))].sort((p, q) => p - q)
  const points: Array<{ u: number; height: number }> = []
  for (let i = 0; i + 1 < cuts.length; i += 1) {
    const mid = (cuts[i] + cuts[i + 1]) / 2
    const h = round6(Math.min(wall.height, ...spans.filter((s) => s.u0 <= mid && s.u1 >= mid).map((s) => s.top)))
    const last = points[points.length - 1]
    if (last && Math.abs(last.height - h) < EPS) last.u = cuts[i + 1]
    else points.push({ u: cuts[i], height: h }, { u: cuts[i + 1], height: h })
  }
  // merge the trailing duplicates the run-extension above leaves
  return points.filter((p, i) => i === 0 || p.u !== points[i - 1].u || p.height !== points[i - 1].height)
}

/**
 * 005Y-N4 (D): every interior wall on a stair's storey that stands under its flights stops at their underside
 * (a POLYLINE top). Nothing is deleted. A wall the stair would cut lower than `UNDER_STAIR_MIN_HEIGHT_M`, or one
 * whose openings the lowered top would no longer hold, keeps its height and is named.
 */
export function followStairSoffits(program: readonly BuildingCommand[], label: string, modelId: string): { program: BuildingCommand[]; walls: UnderStairWall[] } {
  const model = buildCandidateModel(program, label, modelId)
  const topology = resolveWallTopology(model)
  const walls: UnderStairWall[] = []
  const profiles = new Map<string, Array<{ u: number; height: number }>>()
  for (const s of model.stairs) {
    if (s.kind !== 'FLIGHTS') continue
    const from = model.levels.find((l) => l.id === s.levelId)
    const to = model.levels.find((l) => l.id === s.toLevelId)
    if (!from || !to) continue
    const layout = layoutStair(s, from, to)
    if (!layout.ok) continue
    const base = layout.baseY
    const bottomOf = (top: number): number => Math.max(base, top - layout.riserHeight - s.waist)
    const boxOf = (poly: ReadonlyArray<{ x: number; z: number }>): Box => ({ minX: Math.min(...poly.map((p) => p.x)), maxX: Math.max(...poly.map((p) => p.x)), minZ: Math.min(...poly.map((p) => p.z)), maxZ: Math.max(...poly.map((p) => p.z)) })
    const cells = [...layout.steps.filter((st) => st.tread).map((st) => ({ box: boxOf(st.tread ?? []), bottom: bottomOf(st.top) })), ...layout.landings.map((l) => ({ box: boxOf(l.polygon), bottom: bottomOf(l.top) }))]
    for (const w of model.walls) {
      if (w.levelId !== s.levelId || w.kind !== 'INTERIOR') continue
      const extent = topology.extents.get(w.id)
      if (!extent) continue
      const body = boxOf(wallPhysicalFootprint(w, extent))
      const level = model.levels.find((l) => l.id === w.levelId)
      const profile = underStairProfile({ start: w.start, end: w.end, thickness: w.thickness, height: w.height, base: (level?.elevation ?? 0) + w.baseOffset }, body, cells)
      if (profile === null) continue
      if (profile === 'TOO_LOW' || (w.topProfile && w.topProfile.kind !== 'FLAT')) {
        walls.push({ wallId: w.id, stairId: s.id, action: 'REFUSED', why: profile === 'TOO_LOW' ? `${w.id} crosses the lowest steps of ${s.id}: not a wall under the stair; kept, the conflict named` : `${w.id} already follows another top; kept as read` })
        continue
      }
      profiles.set(w.id, profile)
      walls.push({ wallId: w.id, stairId: s.id, action: 'FOLLOWS_SOFFIT', points: profile, why: `${w.id} stands under ${s.id}: it stops at the flights' underside, down to ${Math.min(...profile.map((p) => p.height)).toFixed(2)} m` })
    }
  }
  if (profiles.size === 0) return { program: [...program], walls }
  let out = [...program]
  for (const [wallId, points] of profiles) {
    const next = out.map((c): BuildingCommand => (c.type === 'createWall' && c.id === wallId ? { ...c, topProfile: { kind: 'POLYLINE', points } } : c))
    // the lowered top must still hold the wall's openings: the model's own validator decides
    if (programApplies(next, label, modelId)) out = next
    else {
      const entry = walls.find((x) => x.wallId === wallId)
      if (entry) Object.assign(entry, { action: 'REFUSED', why: `${wallId} stands under the stair, but its openings do not fit under the flights' underside: kept at its height, the conflict named` })
    }
  }
  return { program: out, walls }
}
