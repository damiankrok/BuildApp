/**
 * Where a plan's building is, from physical evidence (BUILDPLAN-ANALYZER-005B).
 *
 * The legacy frame of a plan is the widest dimension chain that READ
 * something on each axis. Nothing asked where that chain lies. When the depth
 * chain in a margin is unread — its labels read upside down — the widest
 * vertical chain left can be a short interior chain between two rooms, and the
 * building is framed as a strip a room deep with almost nothing enclosed; a
 * `PLAN_NO_WALLED_ENVELOPE` can have the same cause (the stage report names
 * the houses this was measured on).
 *
 * So a chain's ROLE is decided before it may frame anything, and it is decided
 * from geometry alone — never from the number printed on it:
 *
 *   - A WALL WITNESS is taken from the sheet's pixels: the wall bands at the
 *     sheet's wall thickness, grouped by adjacency, the largest group kept.
 *     A detached group — the publisher's logo in a corner, a title block, a
 *     north arrow — is a separate group and loses. No chain and no extent
 *     enters it, so it can check the chains without having been drawn by them.
 *   - A chain is EXTERIOR when the witness walls met along its span all lie on
 *     one side of its line, and INTERIOR when they lie on both sides or its
 *     line runs through a wall.
 *   - An interior chain may frame the building on its axis only when its span
 *     covers the witness on that axis; a room's width may not.
 *
 * The incumbent rectangle stands, byte for byte, whenever the chains it was
 * taken from are not refused: this only removes a chain that cannot be the
 * building's extent, it does not re-rank the ones that can.
 */
import { round6 } from '@buildapp/source-common'
import type { PixelRect } from '@buildapp/source-common'
import type { Band, Mask } from '@buildapp/source-cv'
import { gapStrokes } from './boundary-evidence.js'
import type { DimensionChain } from '@buildapp/source-metrics'

export type WallWitness = {
  /** The outer faces of the building's walls: the bounds of the largest group of wall bands. */
  rect: PixelRect
  /** The wall bands that group is made of. */
  bands: Band[]
  /** Groups the sheet's other wall-thick ink formed and lost: a logo, a title block. */
  detached: number
  why: string
}

export type ChainRole = 'EXTERIOR' | 'INTERIOR' | 'UNKNOWN'

export type ChainRoleRecord = {
  chainId: string
  axis: 'HORIZONTAL' | 'VERTICAL'
  role: ChainRole
  /** Whether its span covers the wall witness on its axis, within two walls at each end. */
  coversWitness: boolean
  /** Wall length met along its span on each side of its line, and running through it. */
  sides: { low: number; high: number; through: number }
  /** Why it may not frame the building, when it may not. */
  refused?: 'INTERIOR_BASELINE'
}

/** Bands long enough to be walls: the same cut the legacy frame uses (two and a half wall thicknesses). */
const wallBands = (bands: readonly Band[], wallPx: number): Band[] => bands.filter((b) => b.length >= wallPx * 2.5)

/**
 * The building's walls, from pixels only: the largest group of wall bands
 * joined where they come within two walls of each other.
 */
export function wallWitness(bands: readonly Band[], wallPx: number, mask?: Mask): WallWitness | null {
  const walls = [...wallBands(bands, wallPx)].sort((a, b) => a.bounds.y0 - b.bounds.y0 || a.bounds.x0 - b.bounds.x0 || a.length - b.length)
  if (walls.length === 0) return null
  const gap = wallPx * 2
  const parent = walls.map((_, i) => i)
  const find = (i: number): number => {
    let r = i
    while (parent[r] !== r) r = parent[r]
    return r
  }
  const join = (i: number, j: number): void => {
    const ra = find(i)
    const rb = find(j)
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb)
  }
  for (let i = 0; i < walls.length; i += 1) {
    for (let j = i + 1; j < walls.length; j += 1) {
      const a = walls[i].bounds
      const b = walls[j].bounds
      if (a.x0 - gap <= b.x1 && b.x0 - gap <= a.x1 && a.y0 - gap <= b.y1 && b.y0 - gap <= a.y1) join(i, j)
    }
  }
  // 005C: one wall, broken by an opening, is one wall. Two collinear bands of one thickness whose facing ends are
  // separated by a gap with a door leaf on the wall's axis or glazing (two or more lines) drawn across it inside the
  // wall are joined, however far apart their groups otherwise are. A paving or kerb line at a face joins nothing, so
  // a planter lined up with a facade stays a separate group.
  if (mask) {
    for (let i = 0; i < walls.length; i += 1) {
      for (let j = 0; j < walls.length; j += 1) {
        const a = walls[i]
        const b = walls[j]
        if (i === j || a.axis !== b.axis || find(i) === find(j)) continue
        const t = Math.max(a.thickness, b.thickness)
        if (Math.abs(a.axisPx - b.axisPx) > t / 2 || Math.min(a.thickness, b.thickness) < t * 0.65) continue
        const vertical = a.axis === 'VERTICAL'
        const aEnd = vertical ? a.bounds.y1 : a.bounds.x1
        const bStart = vertical ? b.bounds.y0 : b.bounds.x0
        const width = bStart - aEnd
        if (width <= gap || width > wallPx * 20) continue
        const strokes = gapStrokes(mask, vertical ? 'X' : 'Y', (a.axisPx + b.axisPx) / 2, aEnd, bStart, wallPx).filter((s) => s.continuous)
        const drawn = strokes.length >= 2 || (strokes.length === 1 && Math.abs(strokes[0].offsetPx) <= wallPx * 0.25)
        if (drawn) join(i, j)
      }
    }
  }
  const groups = new Map<number, Band[]>()
  walls.forEach((w, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), w]))
  const ranked = [...groups.values()].map((members) => ({ members, length: members.reduce((a, b) => a + b.length, 0) })).sort((a, b) => b.length - a.length || a.members[0].bounds.y0 - b.members[0].bounds.y0 || a.members[0].bounds.x0 - b.members[0].bounds.x0)
  const best = ranked[0].members
  const vertical = best.filter((b) => b.axis === 'VERTICAL')
  const horizontal = best.filter((b) => b.axis === 'HORIZONTAL')
  if (vertical.length === 0 || horizontal.length === 0) return null
  const rect = {
    x0: round6(Math.min(...best.map((b) => b.bounds.x0))),
    y0: round6(Math.min(...best.map((b) => b.bounds.y0))),
    x1: round6(Math.max(...best.map((b) => b.bounds.x1))),
    y1: round6(Math.max(...best.map((b) => b.bounds.y1))),
  }
  if (rect.x1 - rect.x0 < wallPx * 4 || rect.y1 - rect.y0 < wallPx * 4) return null
  return {
    rect,
    bands: best,
    detached: ranked.length - 1,
    why: `${best.length} wall bands joined within two walls of each other (${Math.round(ranked[0].length)} px of wall), ${Math.round(rect.x1 - rect.x0)} × ${Math.round(rect.y1 - rect.y0)} px; ${ranked.length - 1} detached group${ranked.length === 2 ? '' : 's'} left out`,
  }
}

/**
 * A chain's role against the wall witness, from geometry alone.
 *
 * Along the chain's span, every witness wall that overlaps it is on one side
 * of the chain's line, on the other, or runs through it. A chain drawn outside
 * the building meets walls on one side only; a chain across a room meets them
 * on both, or crosses one.
 */
export function chainRole(chain: DimensionChain, witness: WallWitness, wallPx: number): ChainRoleRecord {
  const horizontal = chain.axis === 'HORIZONTAL'
  const lo = chain.ticksPx[0]
  const hi = chain.ticksPx[chain.ticksPx.length - 1]
  const span = Math.max(1, hi - lo)
  const b = chain.baselinePx
  let low = 0
  let high = 0
  let through = 0
  for (const w of witness.bands) {
    const along0 = horizontal ? w.bounds.x0 : w.bounds.y0
    const along1 = horizontal ? w.bounds.x1 : w.bounds.y1
    const overlap = Math.min(hi, along1) - Math.max(lo, along0)
    if (overlap <= wallPx / 2) continue
    const across0 = horizontal ? w.bounds.y0 : w.bounds.x0
    const across1 = horizontal ? w.bounds.y1 : w.bounds.x1
    if (across1 < b - wallPx / 2) low += overlap
    else if (across0 > b + wallPx / 2) high += overlap
    else through += overlap
  }
  const [w0, w1] = horizontal ? [witness.rect.x0, witness.rect.x1] : [witness.rect.y0, witness.rect.y1]
  const coversWitness = lo <= w0 + 2 * wallPx && hi >= w1 - 2 * wallPx
  // Walls on both sides, each at least a sixth of the span, or a wall the line runs through for
  // more than a wall's thickness: the chain is drawn across the building, not beside it.
  const interior = (Math.min(low, high) >= span / 6 && Math.min(low, high) > 0) || through > wallPx
  const exterior = !interior && low + high > 0 && Math.min(low, high) <= span * 0.05
  const role: ChainRole = interior ? 'INTERIOR' : exterior ? 'EXTERIOR' : 'UNKNOWN'
  return {
    chainId: chain.id,
    axis: chain.axis,
    role,
    coversWitness,
    sides: { low: round6(low), high: round6(high), through: round6(through) },
    ...(role === 'INTERIOR' && !coversWitness ? { refused: 'INTERIOR_BASELINE' as const } : {}),
  }
}

/** The chains that may frame the building: every chain but an interior one that does not span the walls. */
export function framingChains(chains: readonly DimensionChain[], witness: WallWitness | null, wallPx: number): { allowed: DimensionChain[]; roles: ChainRoleRecord[] } {
  if (!witness) return { allowed: [...chains], roles: [] }
  const roles = chains.map((c) => chainRole(c, witness, wallPx))
  const refused = new Set(roles.filter((r) => r.refused).map((r) => r.chainId))
  return { allowed: chains.filter((c) => !refused.has(c.id)), roles }
}

/** Does any read chain survive on this axis? */
export const readOn = (chains: readonly DimensionChain[], axis: 'HORIZONTAL' | 'VERTICAL'): boolean =>
  chains.some((c) => c.axis === axis && c.segments.some((s) => s.origin === 'READ' || s.origin === 'CHAIN_CORRECTED'))

/**
 * The exterior chains that frame an axis by their ticks alone, when no read
 * chain survives there: an exterior chain spanning at least half the witness
 * is a drawn statement of where the building is, whatever its labels read.
 */
export function exteriorSpan(chains: readonly DimensionChain[], roles: readonly ChainRoleRecord[], axis: 'HORIZONTAL' | 'VERTICAL', witness: WallWitness): { lo: number; hi: number; chainId: string } | null {
  const [w0, w1] = axis === 'HORIZONTAL' ? [witness.rect.x0, witness.rect.x1] : [witness.rect.y0, witness.rect.y1]
  let best: { lo: number; hi: number; chainId: string } | null = null
  for (const c of chains) {
    if (c.axis !== axis) continue
    if (roles.find((r) => r.chainId === c.id)?.role !== 'EXTERIOR') continue
    const lo = c.ticksPx[0]
    const hi = c.ticksPx[c.ticksPx.length - 1]
    // It must lie over the building, not beside it.
    const overlap = Math.min(hi, w1) - Math.max(lo, w0)
    if (overlap < (w1 - w0) * 0.5) continue
    if (!best || hi - lo > best.hi - best.lo || (hi - lo === best.hi - best.lo && c.id < best.chainId)) best = { lo, hi, chainId: c.id }
  }
  return best
}
