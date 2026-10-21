/**
 * BUILDPLAN-ANALYZER-005Y-N5: an opening that runs on through a CORNER junction (`Opening.openEnd`).
 *
 * One glazing wraps a corner of the body with no pier: two openings, one in each wall of the corner, each stating
 * that its corner-side edge reaches the wall's physical end. Between their common sill and head the corner block is
 * open; below the sill and above the head it stays wall. The two openings are one join only together: each names the
 * other through the corner's junction, they share a sill, a height and a level head, and both reach the corner.
 * Anything less is a stated open end with nothing to meet: validation warns, and the opening is cut as stated, closed
 * on that side — never half-way. (Commands validate one at a time, so the first of the two is always alone for a step.)
 */
import type { CanonicalBuildingModel, Opening, Wall, WallEnd } from './schema.js'
import { physicalCore, type ResolvedTopology, type WallExtent } from './topology.js'

/** Sill and head of the two openings of one open corner agree within this (m). */
export const OPEN_END_HEIGHT_TOLERANCE_M = 0.005
/** How far beyond the other wall's thickness an open-ended opening's edge may stop short of the wall's end (m). */
export const OPEN_END_REACH_EXTRA_M = 0.15

export type OpenEndJoin = {
  /** The span this opening cuts along its wall: its stated span carried on to the wall's physical end. */
  span: { a0: number; a1: number }
  /** The opening on the other wall of the corner that states the same open corner. */
  partner: Opening
  partnerWall: Wall
  /** This wall's role at the corner: the OWNER runs through the corner block, the TRIMMED wall stops at its near face. */
  role: 'OWNER' | 'TRIMMED'
  junctionId: string
}

const isLevel = (o: Opening): boolean => o.head === undefined || o.head.kind === 'LEVEL'

/** The join an open-ended opening makes, or why it makes none. */
export function openEndJoin(m: Pick<CanonicalBuildingModel, 'walls' | 'openings'>, topology: ResolvedTopology, o: Opening): { ok: true; join: OpenEndJoin } | { ok: false; reason: string } {
  const end = o.openEnd
  if (!end) return { ok: false, reason: `opening ${o.id} states no open end` }
  if ((o.leaves ?? []).length > 0) return { ok: false, reason: `opening ${o.id} cuts further leaves; an open corner joins single-leaf openings only` }
  if (!isLevel(o)) return { ok: false, reason: `opening ${o.id} has a raked head; an open corner needs a level head` }
  const claim = topology.endClaims.get(`${o.wallId}:${end}`)
  const junction = claim ? topology.junctions.get(claim.junctionId) : undefined
  if (!claim || !junction || !junction.ok || junction.kind !== 'CORNER') return { ok: false, reason: `the ${end} of wall ${o.wallId} is not a resolved CORNER junction` }
  const other = junction.participants.find((p) => p.wallId !== o.wallId)
  const self = junction.participants.find((p) => p.wallId === o.wallId)
  if (!other || !self || !other.end) return { ok: false, reason: `corner ${junction.id} has no second wall end` }
  const partners = m.openings.filter((x) => x.wallId === other.wallId && x.openEnd === other.end)
  if (partners.length !== 1) return { ok: false, reason: `the ${other.end} of wall ${other.wallId} (the other side of corner ${junction.id}) has ${partners.length} open-ended openings, not one` }
  const partner = partners[0]
  const partnerWall = m.walls.find((w) => w.id === other.wallId)
  if (!partnerWall) return { ok: false, reason: `wall ${other.wallId} does not exist` }
  if (!isLevel(partner)) return { ok: false, reason: `opening ${partner.id} across corner ${junction.id} has a raked head` }
  if (Math.abs(partner.sill - o.sill) > OPEN_END_HEIGHT_TOLERANCE_M || Math.abs(partner.sill + partner.height - (o.sill + o.height)) > OPEN_END_HEIGHT_TOLERANCE_M) {
    return { ok: false, reason: `openings ${o.id} (${o.sill}..${o.sill + o.height} m) and ${partner.id} (${partner.sill}..${partner.sill + partner.height} m) across corner ${junction.id} differ in sill or head; an open corner needs one band` }
  }
  // Both pieces reach the corner, or neither is opened: a corner cut on one side only is a pier with a notch.
  const ownWall = m.walls.find((w) => w.id === o.wallId)
  const ownExtent = topology.extents.get(o.wallId)
  const partnerExtent = topology.extents.get(partnerWall.id)
  if (!ownWall || !ownExtent || !partnerExtent) return { ok: false, reason: `the walls of corner ${junction.id} have no resolved extent` }
  const span = openEndSpan(o, end, ownExtent, partnerWall.thickness)
  if (!span.ok) return { ok: false, reason: span.reason }
  const across = openEndSpan(partner, other.end, partnerExtent, ownWall.thickness)
  if (!across.ok) return { ok: false, reason: across.reason }
  return { ok: true, join: { span: { a0: span.a0, a1: span.a1 }, partner, partnerWall, role: self.role === 'OWNER' ? 'OWNER' : 'TRIMMED', junctionId: junction.id } }
}

/**
 * The span an open-ended opening cuts along its wall: its stated span carried on to the wall's physical end on its
 * open side. Refused when the stated edge stops short of that end by more than the other wall's thickness and
 * `OPEN_END_REACH_EXTRA_M`: the opening then does not reach the corner it names.
 */
export function openEndSpan(o: Opening, end: WallEnd, extent: WallExtent, otherWallThickness: number): { ok: true; a0: number; a1: number } | { ok: false; reason: string } {
  const core = physicalCore(extent)
  const a0 = o.offset
  const a1 = o.offset + o.width
  const reach = otherWallThickness + OPEN_END_REACH_EXTRA_M
  const short = end === 'END' ? core.a1 - a1 : a0 - core.a0
  if (short > reach) return { ok: false, reason: `opening ${o.id} stops ${short.toFixed(3)} m short of the ${end} of wall ${o.wallId} (more than ${reach.toFixed(3)} m): it does not reach the corner` }
  if (short < -reach) return { ok: false, reason: `opening ${o.id} runs ${(-short).toFixed(3)} m past the ${end} of wall ${o.wallId}` }
  return end === 'END' ? { ok: true, a0, a1: core.a1 } : { ok: true, a0: core.a0, a1 }
}
