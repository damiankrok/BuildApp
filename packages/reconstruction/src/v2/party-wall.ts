/**
 * N8-02B: one wall between two bodies that stand against each other.
 *
 * Two bodies whose rectangles meet were built with a ring each, so the face they share carried two exterior walls of
 * the house's thickness, one either side of the contact line, whatever the plan drew there. A plan that draws ONE band
 * there — a house wall the garage is built against, a wall the dimension chains run past — was built as two walls,
 * twice the thickness drawn, the garage's interior pushed out by a wall that is not there, and the doorway between the
 * bodies read at the wrong thickness, so a watermark over the band opened gaps the plan does not draw.
 *
 * Here the contact is read off the plan, per storey, across a window wider than both walls:
 *
 *   - ONE_WALL   one band, consistently placed, thinner than the two walls would be (`TWO_WALL_SHARE`): one wall of the
 *                band's drawn thickness, on the band, built once by the body on whose side the band lies (the host);
 *                the other body builds no wall over the shared stretch and its walls across run to the band;
 *   - TWO_WALLS  two bands with paper between them (a double wall, a movement joint), or one band as thick as both
 *                walls: the two walls stand, as before;
 *   - OPEN       (N8-03A) no wall ink at all across the window along the contact, the walls across drawn at both of its
 *                ends: one room runs from one body into the other (a garage under the house's upper storey, a hall
 *                into a wing), so neither body builds a wall there; each body's wall beside the shared stretch runs on
 *                over the end of the other's wall across, and the rooms either side are read as one;
 *   - UNDECIDED  too little wall drawn along the contact (but some), or a band that wanders, or a corner the one wall
 *                cannot be built at: the two walls stand, as before, and the run names why.
 *
 * Touching is never enough: a band is read, or nothing changes. Only the stretch where both bodies stand on the storey
 * is shared; beyond it each body keeps its own wall (`sideSegments`). Nothing here knows any house; every threshold is
 * in metres of the walls the run already read, or in pixels of the sheet. Pure: plan rasters and rectangles in,
 * records out.
 */
import { round6 } from '@buildapp/source-common'
import type { Raster } from '@buildapp/source-cv'
import type { MassV2 } from './building.js'
import { rectAt } from './building.js'
import type { PlanFrameV2 } from './frame.js'
import { NEUTRAL_INK_CHROMA, WALL_FILL_LUMA, lumaAt, rgbAt } from './scan.js'

export type PartySide = 'FRONT' | 'EAST' | 'REAR' | 'WEST'
export const OPPOSITE_SIDE: Record<PartySide, PartySide> = { FRONT: 'REAR', REAR: 'FRONT', EAST: 'WEST', WEST: 'EAST' }

/**
 * What one end of the shared stretch is. HOST_CORNER: a corner of the host (the other body runs on past it); the host's
 * wall across owns the corner and the one wall stops at its inner face. OTHER_CORNER: a corner of the other body inside
 * the host's face; the host's own wall runs on over the end of the other body's wall across, which stops at the contact
 * line, and the one wall starts at that wall's inner face. BOTH_CORNERS: both bodies end there; the host's wall across
 * owns the corner, the other's starts at the contact line. No wall of the other body is moved.
 */
export type PartyEnd = 'HOST_CORNER' | 'OTHER_CORNER' | 'BOTH_CORNERS'

/** One wall the plan draws between two bodies on one storey. */
export type PartyWallV2 = {
  id: string
  storeyIndex: number
  hostMassId: string
  otherMassId: string
  /** The host's side the wall stands on; the other body's is the opposite side. */
  hostFacade: PartySide
  /** Across the wall (x for EAST/WEST, z for FRONT/REAR): where the two bodies' rectangles meet. */
  contactAt: number
  /** Across the wall: the drawn band's low and high faces. */
  band: [number, number]
  thicknessM: number
  /** Along the wall: where both bodies stand on this storey. */
  span: [number, number]
  ends: [PartyEnd, PartyEnd]
  provenance: 'SOURCE_DERIVED'
  why: string
  /**
   * N8-03A: the plan draws no wall here at all (decision OPEN): nothing is built over the shared stretch by either body,
   * `band` is the contact line and `thicknessM` 0.
   */
  open?: true
}

export type PartyWallDecision = 'ONE_WALL' | 'TWO_WALLS' | 'OPEN' | 'UNDECIDED'

/** What the contact between two bodies on one storey was read as, with the numbers it stood on. */
export type PartyWallRecord = {
  storeyIndex: number
  frameId: string
  massIds: [string, string]
  /** The first body's side facing the second. */
  facade: PartySide
  contactAt: number
  span: [number, number]
  wallsM: [number, number]
  reading: PartyBandReading
  decision: PartyWallDecision
  why: string
  wall?: PartyWallV2
}

export type PartyBandReading = {
  /** Positions along the contact sampled (one per sheet pixel, the ends clear of the walls across). */
  samples: number
  /** Samples with wall ink in the window. */
  solid: number
  /** Samples whose ink nearest the contact is one band no thicker than both walls together. */
  one: number
  /** Samples with two bands a joint apart. */
  two: number
  /** Of `one`, those whose band lies within two pixels of the median faces. */
  consistent: number
  /** The median band across, in world metres (low, high face), and its thickness. */
  bandM?: [number, number]
  widthM?: number
  /** The window read across the contact, in world metres. */
  windowM: [number, number]
  /** N8-03A: at each end of the shared stretch, the share of the corner's window that holds wall ink. */
  cornersInk?: [number, number]
}

/** A band at least this share of the two walls' combined thickness is two walls drawn touching, not one. */
export const TWO_WALL_SHARE = 0.8
/** The thinnest band read as a wall between two bodies (a thinner one is a line). */
export const PARTY_MIN_WALL_M = 0.1
/** The shortest shared stretch read at all. */
export const PARTY_MIN_SPAN_M = 1.0
/** Positions along the contact with wall ink, as a share of all sampled, below which the plan draws too little there. */
export const PARTY_MIN_SOLID = 0.4
/** One-band positions, as a share of the solid ones, needed for one wall. */
export const PARTY_MIN_ONE = 0.6
/** Two-band positions, as a share of the solid ones, that make two walls. */
export const PARTY_MIN_TWO = 0.5
/** The widest paper between two bands that is a joint between two walls (wider is another line). */
export const PARTY_JOINT_MAX_M = 0.25
/** The window across the contact reaches this far past each body's wall. */
export const PARTY_WINDOW_PAST_M = 0.3
/** A run of ink thinner than this across the contact is a line (furniture, hatching, a leader), not a wall. */
export const PARTY_MIN_RUN_M = 0.08
/** A stretch of a body's own wall beside the shared one shorter than its wall thickness plus this cannot be built. */
export const PARTY_EXPOSED_SLACK_M = 0.1
/** N8-03A: positions with wall ink, as a share of all sampled, at or below which the plan draws no wall there (OPEN). */
export const PARTY_OPEN_MAX_SOLID = 0.02
/** N8-03A: the fewest positions sampled along a contact read as open. */
export const PARTY_OPEN_MIN_SAMPLES = 40
/** N8-03A: half the side of the square window about each end of the shared stretch where the walls across are looked for. */
export const PARTY_CORNER_WINDOW_M = 0.6
/** N8-03A: the share of that window holding wall ink for the corner to count as drawn. */
export const PARTY_CORNER_MIN_INK = 0.15

/**
 * Wall ink across the contact: dark neutral ink, or a flat neutral fill darker than `WALL_FILL_LUMA` — a wall drawn in
 * grey, or a wall under the printer's watermark, which lightens black to mid-grey but stays flat along the wall.
 */
function partyInk(r: Raster, x: number, y: number, along: { dx: number; dy: number }): boolean {
  const l = lumaAt(r, x, y)
  if (l >= WALL_FILL_LUMA) return false
  const [red, green, blue] = rgbAt(r, x, y)
  if (Math.max(red, green, blue) - Math.min(red, green, blue) >= NEUTRAL_INK_CHROMA) return false
  if (l < 90) return true
  return [-1, 1].every((s) => Math.abs(lumaAt(r, x + s * along.dx, y + s * along.dy) - l) <= 6)
}

/**
 * The band the plan draws across the contact between two bodies: at each sheet pixel along the shared stretch (clear of
 * the walls across at its ends), the runs of wall ink across a window from `windowM[0]` to `windowM[1]`; the run nearest
 * the contact is the band there, and a second run a joint away from it makes that position two bands.
 */
export function readPartyBand(raster: Raster, plan: PlanFrameV2, input: { axis: 'X' | 'Z'; contactAt: number; along: [number, number]; windowM: [number, number]; wallsM: [number, number] }): PartyBandReading & { bandPx?: [number, number] } {
  // the wall runs along `axis`: along Z its across is x (sheet columns), along X its across is z (sheet rows)
  const acrossIsX = input.axis === 'Z'
  const mppAcross = acrossIsX ? plan.mppX : plan.mppY
  const mppAlong = acrossIsX ? plan.mppY : plan.mppX
  const px = (across: number, along: number): { x: number; y: number } => (acrossIsX ? plan.toPixel(across, along) : plan.toPixel(along, across))
  const a0 = px(input.windowM[0], input.along[0])
  const a1 = px(input.windowM[1], input.along[1])
  const [c0, c1] = acrossIsX ? [Math.min(a0.x, a1.x), Math.max(a0.x, a1.x)] : [Math.min(a0.y, a1.y), Math.max(a0.y, a1.y)]
  const [l0, l1] = acrossIsX ? [Math.min(a0.y, a1.y), Math.max(a0.y, a1.y)] : [Math.min(a0.x, a1.x), Math.max(a0.x, a1.x)]
  const contactPx = acrossIsX ? px(input.contactAt, input.along[0]).x : px(input.contactAt, input.along[0]).y
  const minRun = Math.max(2, Math.round(PARTY_MIN_RUN_M / mppAcross))
  const jointMax = PARTY_JOINT_MAX_M / mppAcross
  const cap = (input.wallsM[0] + input.wallsM[1] + 0.1) / mppAcross
  const alongStep = acrossIsX ? { dx: 0, dy: 1 } : { dx: 1, dy: 0 }
  let samples = 0
  let solid = 0
  let two = 0
  const ones: Array<[number, number]> = []
  for (let l = Math.ceil(l0); l <= Math.floor(l1); l += 1) {
    samples += 1
    const runs: Array<[number, number]> = []
    let start: number | undefined
    for (let c = Math.floor(c0); c <= Math.ceil(c1) + 1; c += 1) {
      const ink = c <= Math.ceil(c1) && (acrossIsX ? partyInk(raster, c, l, alongStep) : partyInk(raster, l, c, alongStep))
      if (ink && start === undefined) start = c
      if (!ink && start !== undefined) {
        if (c - start >= minRun) runs.push([start, c - 1])
        start = undefined
      }
    }
    if (runs.length === 0) continue
    solid += 1
    const distance = (r: [number, number]): number => (contactPx < r[0] ? r[0] - contactPx : contactPx > r[1] ? contactPx - r[1] : 0)
    const nearest = [...runs].sort((p, q) => distance(p) - distance(q) || p[0] - q[0])[0]
    const partner = runs.some((r) => r !== nearest && (r[0] > nearest[1] ? r[0] - nearest[1] - 1 : nearest[0] - r[1] - 1) <= jointMax)
    if (partner) {
      two += 1
      continue
    }
    if (nearest[1] - nearest[0] + 1 <= cap) ones.push(nearest)
  }
  const reading: PartyBandReading & { bandPx?: [number, number] } = { samples, solid, one: ones.length, two, consistent: 0, windowM: input.windowM }
  if (ones.length === 0) return reading
  const median = (xs: number[]): number => {
    const s = [...xs].sort((p, q) => p - q)
    return s[Math.floor(s.length / 2)]
  }
  const e0 = median(ones.map((r) => r[0]))
  const e1 = median(ones.map((r) => r[1]))
  reading.consistent = ones.filter((r) => Math.abs(r[0] - e0) <= 2 && Math.abs(r[1] - e1) <= 2).length
  // the band's faces: the outer edges of its first and last ink pixels
  const w0 = acrossIsX ? plan.toWorld(e0, l0).x : plan.toWorld(l0, e0).z
  const w1 = acrossIsX ? plan.toWorld(e1 + 1, l0).x : plan.toWorld(l0, e1 + 1).z
  reading.bandPx = [e0, e1]
  reading.bandM = [round6(Math.min(w0, w1)), round6(Math.max(w0, w1))]
  reading.widthM = round6((e1 - e0 + 1) * mppAcross)
  void mppAlong
  return reading
}

/**
 * N8-03A: the share of a square about a point on the plan (half side `halfM`) holding wall ink — the walls across at an
 * end of a contact, drawn or not.
 */
export function cornerInk(raster: Raster, plan: PlanFrameV2, at: { x: number; z: number }, halfM: number): number {
  const a = plan.toPixel(at.x - halfM, at.z - halfM)
  const b = plan.toPixel(at.x + halfM, at.z + halfM)
  const [x0, x1] = [Math.ceil(Math.min(a.x, b.x)), Math.floor(Math.max(a.x, b.x))]
  const [y0, y1] = [Math.ceil(Math.min(a.y, b.y)), Math.floor(Math.max(a.y, b.y))]
  let n = 0
  let inked = 0
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      n += 1
      if (x >= 0 && y >= 0 && x < raster.width && y < raster.height && (partyInk(raster, x, y, { dx: 1, dy: 0 }) || partyInk(raster, x, y, { dx: 0, dy: 1 }))) inked += 1
    }
  }
  return n === 0 ? 0 : round6(inked / n)
}

type Rect = { x0: number; z0: number; x1: number; z1: number }
const alongOf = (r: Rect, side: PartySide): [number, number] => (side === 'FRONT' || side === 'REAR' ? [r.x0, r.x1] : [r.z0, r.z1])
const faceOf = (r: Rect, side: PartySide): number => (side === 'FRONT' ? r.z0 : side === 'REAR' ? r.z1 : side === 'WEST' ? r.x0 : r.x1)

export type PartyWallInput = {
  masses: readonly MassV2[]
  plans: ReadonlyMap<number, { raster: Raster; frame: PlanFrameV2 }>
  /** A body's wall thickness on the plan. */
  wallOf: (m: MassV2) => number
}

/**
 * Every contact between two bodies on every storey both stand on, read (`readPartyBand`) and decided. A body built
 * without a wall of its own on a side already (N7-P2R `openSide`) is left as it is.
 */
export function readPartyWalls(input: PartyWallInput): PartyWallRecord[] {
  const out: PartyWallRecord[] = []
  const sides: PartySide[] = ['FRONT', 'EAST', 'REAR', 'WEST']
  for (const [storey, plan] of [...input.plans].sort((p, q) => p[0] - q[0])) {
    const here = input.masses.filter((m) => m.storeys.includes(storey) && !m.pieceOf && !m.openSide)
    for (let i = 0; i < here.length; i += 1) {
      for (let k = i + 1; k < here.length; k += 1) {
        const a = here[i]
        const b = here[k]
        const ra = rectAt(a, storey)
        const rb = rectAt(b, storey)
        for (const side of sides) {
          const other = OPPOSITE_SIDE[side]
          const contact = faceOf(ra, side)
          if (Math.abs(faceOf(rb, other) - contact) > 0.05) continue
          const [alo, ahi] = alongOf(ra, side)
          const [blo, bhi] = alongOf(rb, other)
          const span: [number, number] = [round6(Math.max(alo, blo)), round6(Math.min(ahi, bhi))]
          if (span[1] - span[0] < PARTY_MIN_SPAN_M) continue
          // a contact is one exactly when the bodies lie on either side of it
          const aLow = side === 'EAST' || side === 'REAR'
          const ta = input.wallOf(a)
          const tb = input.wallOf(b)
          const window: [number, number] = aLow ? [round6(contact - ta - PARTY_WINDOW_PAST_M), round6(contact + tb + PARTY_WINDOW_PAST_M)] : [round6(contact - tb - PARTY_WINDOW_PAST_M), round6(contact + ta + PARTY_WINDOW_PAST_M)]
          const margin = Math.max(ta, tb) + 0.05
          const reading = readPartyBand(plan.raster, plan.frame, { axis: side === 'EAST' || side === 'WEST' ? 'Z' : 'X', contactAt: contact, along: [span[0] + margin, span[1] - margin], windowM: window, wallsM: [ta, tb] })
          const { bandPx: _bandPx, ...kept } = reading
          void _bandPx
          // N8-03A: a contact with no wall ink is open only where the walls across are drawn at its ends
          if (kept.samples >= PARTY_OPEN_MIN_SAMPLES && kept.solid <= PARTY_OPEN_MAX_SOLID * kept.samples) {
            const point = (along: number): { x: number; z: number } => (side === 'EAST' || side === 'WEST' ? { x: contact, z: along } : { x: along, z: contact })
            kept.cornersInk = [cornerInk(plan.raster, plan.frame, point(span[0]), PARTY_CORNER_WINDOW_M), cornerInk(plan.raster, plan.frame, point(span[1]), PARTY_CORNER_WINDOW_M)]
          }
          const record: PartyWallRecord = { storeyIndex: storey, frameId: plan.frame.frameId, massIds: [a.id, b.id], facade: side, contactAt: round6(contact), span, wallsM: [round6(ta), round6(tb)], reading: kept, decision: 'UNDECIDED', why: '' }
          decide(record, a, b, ra, rb, out)
          out.push(record)
        }
      }
    }
  }
  return out
}

function decide(record: PartyWallRecord, a: MassV2, b: MassV2, ra: Rect, rb: Rect, earlier: readonly PartyWallRecord[]): void {
  const r = record.reading
  const [ta, tb] = record.wallsM
  const where = `${a.id}|${b.id} on storey ${record.storeyIndex}, ${(r.windowM[0]).toFixed(2)}..${(r.windowM[1]).toFixed(2)} across over ${record.span[0].toFixed(2)}..${record.span[1].toFixed(2)}`
  const counts = `${r.solid} of ${r.samples} positions drawn, ${r.one} one band, ${r.two} two`
  if (r.cornersInk && r.cornersInk.every((x) => x >= PARTY_CORNER_MIN_INK)) {
    open(record, a, b, ra, rb, where, counts, earlier)
    return
  }
  if (r.samples === 0 || r.solid < PARTY_MIN_SOLID * r.samples) {
    record.why = `${where}: the plan draws wall at ${counts}${r.cornersInk ? `, and the walls across are drawn at ${r.cornersInk.map((x) => `${(x * 100).toFixed(0)} %`).join(' and ')} of the corners' windows (${(PARTY_CORNER_MIN_INK * 100).toFixed(0)} % needed at both)` : ''}; too little to say what stands between the bodies, so each keeps its wall`
    return
  }
  if (r.two >= PARTY_MIN_TWO * r.solid) {
    record.decision = 'TWO_WALLS'
    record.why = `${where}: ${counts}: two bands a joint apart, two walls`
    return
  }
  if (r.one < PARTY_MIN_ONE * r.solid || r.consistent < PARTY_MIN_ONE * r.one || !r.bandM || r.widthM === undefined) {
    record.why = `${where}: ${counts}, ${r.consistent} of them on one line: the band is not one consistent wall, so each keeps its wall`
    return
  }
  const [b0, b1] = r.bandM
  const width = r.widthM
  if (width >= TWO_WALL_SHARE * (ta + tb)) {
    record.decision = 'TWO_WALLS'
    record.why = `${where}: one band ${width.toFixed(2)} m thick at ${b0.toFixed(2)}..${b1.toFixed(2)}, as thick as both walls (${ta.toFixed(2)} + ${tb.toFixed(2)} m): two walls drawn touching`
    return
  }
  if (width < PARTY_MIN_WALL_M) {
    record.why = `${where}: the band is ${width.toFixed(2)} m thick, a line rather than a wall, so each keeps its wall`
    return
  }
  const c = record.contactAt
  const side = record.facade
  const aLow = side === 'EAST' || side === 'REAR'
  const [lowT, highT] = aLow ? [ta, tb] : [tb, ta]
  if (b0 < c - lowT - 0.05 || b1 > c + highT + 0.05) {
    record.why = `${where}: the band at ${b0.toFixed(2)}..${b1.toFixed(2)} lies outside both bodies' walls about the contact at ${c.toFixed(2)}, so each keeps its wall`
    return
  }
  // the host is the body on whose side the band lies; a band across the contact is the main body's (or the first's)
  const centre = (b0 + b1) / 2
  const lowBody = aLow ? a : b
  const highBody = aLow ? b : a
  const byRole = a.role === 'MAIN' || (b.role !== 'MAIN' && a.id < b.id) ? a : b
  const host = Math.abs(centre - c) < 0.03 ? byRole : centre < c ? lowBody : highBody
  const other = host === a ? b : a
  const hostFacade = host === a ? side : OPPOSITE_SIDE[side]
  const [rh, ro] = host === a ? [ra, rb] : [rb, ra]
  const [th, to] = host === a ? [ta, tb] : [tb, ta]
  const [hlo, hhi] = alongOf(rh, hostFacade)
  const [olo, ohi] = alongOf(ro, OPPOSITE_SIDE[hostFacade])
  // the band's face toward the other body, and how far it stands from the contact line into the host
  const far = hostFacade === 'EAST' || hostFacade === 'REAR' ? b1 : b0
  const inset = hostFacade === 'EAST' || hostFacade === 'REAR' ? c - far : far - c
  const endKind = endKindOf(host, other, th, to, inset)
  const e0 = endKind(record.span[0], hlo, olo)
  const e1 = endKind(record.span[1], hhi, ohi)
  // a body sharing two sides that meet at a corner would need the corner between two shared walls: not built
  const adjacent = earlier.find((p) => p.storeyIndex === record.storeyIndex && p.wall && [p.wall.hostMassId, p.wall.otherMassId].some((id) => id === host.id || id === other.id) && sharesCorner(p.wall, host.id, hostFacade, other.id))
  const refusal = e0.refuse ?? e1.refuse ?? (adjacent ? `${adjacent.wall?.id} already stands on a side meeting this one at a corner` : undefined)
  if (refusal) {
    record.why = `${where}: one band ${width.toFixed(2)} m thick at ${b0.toFixed(2)}..${b1.toFixed(2)}, but ${refusal}; each keeps its wall`
    return
  }
  record.decision = 'ONE_WALL'
  record.why = `${where}: ${counts}, ${r.consistent} on one line: one band ${width.toFixed(2)} m thick at ${b0.toFixed(2)}..${b1.toFixed(2)} (both walls would be ${(ta + tb).toFixed(2)} m), on ${host.id}'s side of the contact at ${c.toFixed(2)}: one wall, built by ${host.id}; ${other.id} builds none over ${record.span[0].toFixed(2)}..${record.span[1].toFixed(2)}`
  record.wall = { id: `ring-${host.id}-${record.storeyIndex}-w${{ FRONT: 0, EAST: 1, REAR: 2, WEST: 3 }[hostFacade]}-party-${other.id}`, storeyIndex: record.storeyIndex, hostMassId: host.id, otherMassId: other.id, hostFacade, contactAt: c, band: [b0, b1], thicknessM: round6(b1 - b0), span: record.span, ends: [e0.kind, e1.kind], provenance: 'SOURCE_DERIVED', why: `the plan draws one ${(b1 - b0).toFixed(2)} m wall between ${host.id} and ${other.id} (${counts}, ${r.consistent} on one line), where two walls would be ${(ta + tb).toFixed(2)} m` }
}

/**
 * What one end of the shared stretch is, and why a wall could not be closed there: a stretch of a body's own wall
 * beside the shared one too short to build, or a common corner a band inside the host leaves open.
 */
function endKindOf(host: MassV2, other: MassV2, th: number, to: number, inset: number): (at: number, hostEnd: number, otherEnd: number) => { kind: PartyEnd; refuse?: string } {
  return (at: number, hostEnd: number, otherEnd: number): { kind: PartyEnd; refuse?: string } => {
    const hostCorner = Math.abs(at - hostEnd) <= 0.05
    const otherCorner = Math.abs(at - otherEnd) <= 0.05
    if (hostCorner && otherCorner) {
      // the host's wall across owns the corner; the other's starts at the contact: a band inside the host leaves the
      // other's interior open between the band and the contact past the host's wall unless the other's wall is no thicker
      return inset > 0.01 && to > th + 0.01 ? { kind: 'BOTH_CORNERS', refuse: `at the common corner ${at.toFixed(2)} the band stands ${inset.toFixed(2)} m inside ${host.id} and ${other.id}'s wall across (${to.toFixed(2)} m) is thicker than ${host.id}'s (${th.toFixed(2)} m): the corner cannot be closed` } : { kind: 'BOTH_CORNERS' }
    }
    if (hostCorner) {
      const exposed = Math.abs(otherEnd - at)
      return exposed < to + PARTY_EXPOSED_SLACK_M ? { kind: 'HOST_CORNER', refuse: `${other.id} runs ${exposed.toFixed(2)} m past ${host.id}'s corner at ${at.toFixed(2)}, too short for a wall of its own there` } : { kind: 'HOST_CORNER' }
    }
    const exposed = Math.abs(hostEnd - at)
    return exposed < th + PARTY_EXPOSED_SLACK_M ? { kind: 'OTHER_CORNER', refuse: `${host.id} runs ${exposed.toFixed(2)} m past ${other.id}'s corner at ${at.toFixed(2)}, too short for a wall of its own there` } : { kind: 'OTHER_CORNER' }
  }
}

/**
 * N8-03A: a contact the plan draws no wall on, its walls across drawn at both ends: open. The record carries a wall of
 * thickness 0 on the contact line, so the sides are split as for one wall (`sideSegments`) but nothing is built on it.
 * The host is the main body (or the first); which body it is changes nothing but the id.
 */
function open(record: PartyWallRecord, a: MassV2, b: MassV2, ra: Rect, rb: Rect, where: string, counts: string, earlier: readonly PartyWallRecord[]): void {
  const side = record.facade
  const c = record.contactAt
  const host = a.role === 'MAIN' || (b.role !== 'MAIN' && a.id < b.id) ? a : b
  const other = host === a ? b : a
  const hostFacade = host === a ? side : OPPOSITE_SIDE[side]
  const [rh, ro] = host === a ? [ra, rb] : [rb, ra]
  const [th, to] = host === a ? record.wallsM : [record.wallsM[1], record.wallsM[0]]
  const [hlo, hhi] = alongOf(rh, hostFacade)
  const [olo, ohi] = alongOf(ro, OPPOSITE_SIDE[hostFacade])
  const endKind = endKindOf(host, other, th, to, 0)
  const e0 = endKind(record.span[0], hlo, olo)
  const e1 = endKind(record.span[1], hhi, ohi)
  const adjacent = earlier.find((p) => p.storeyIndex === record.storeyIndex && p.wall && [p.wall.hostMassId, p.wall.otherMassId].some((id) => id === host.id || id === other.id) && sharesCorner(p.wall, host.id, hostFacade, other.id))
  const corners = (record.reading.cornersInk ?? []).map((x) => `${(x * 100).toFixed(0)} %`).join(' and ')
  const refusal = e0.refuse ?? e1.refuse ?? (adjacent ? `${adjacent.wall?.id} already stands on a side meeting this one at a corner` : undefined)
  if (refusal) {
    record.why = `${where}: ${counts}: no wall drawn between the bodies (walls across drawn at ${corners} of the corners' windows), but ${refusal}; each keeps its wall`
    return
  }
  record.decision = 'OPEN'
  record.why = `${where}: ${counts}: the plan draws no wall between the bodies, and the walls across are drawn at both ends (${corners} of the corners' windows): one space runs from ${host.id} into ${other.id}; neither builds a wall over ${record.span[0].toFixed(2)}..${record.span[1].toFixed(2)}`
  record.wall = { id: `open-${host.id}-${record.storeyIndex}-${other.id}`, storeyIndex: record.storeyIndex, hostMassId: host.id, otherMassId: other.id, hostFacade, contactAt: c, band: [c, c], thicknessM: 0, span: record.span, ends: [e0.kind, e1.kind], provenance: 'SOURCE_DERIVED', why: `the plan draws no wall between ${host.id} and ${other.id} on storey ${record.storeyIndex} (${counts}); the walls across are drawn at both ends`, open: true }
}

const SIDE_INDEX: Record<PartySide, number> = { FRONT: 0, EAST: 1, REAR: 2, WEST: 3 }
function sharesCorner(w: PartyWallV2, hostId: string, hostFacade: PartySide, otherId: string): boolean {
  const sideOf = (id: string): PartySide | undefined => (w.hostMassId === id ? w.hostFacade : w.otherMassId === id ? OPPOSITE_SIDE[w.hostFacade] : undefined)
  const meets = (p: PartySide | undefined, q: PartySide): boolean => p !== undefined && (SIDE_INDEX[p] + SIDE_INDEX[q]) % 2 === 1
  return meets(sideOf(hostId), hostFacade) || meets(sideOf(otherId), OPPOSITE_SIDE[hostFacade])
}

/**
 * One stretch of one side of a body on one storey: its own wall (OWN), the one wall it builds for two bodies (PARTY),
 * no wall because the other body's one wall stands there (NONE), or no wall because its own wall across owns the corner
 * there (CORNER: that wall runs to the corner).
 */
export type SideSegment = {
  kind: 'OWN' | 'PARTY' | 'NONE' | 'CORNER'
  /** Along the side (x for FRONT/REAR, z for EAST/WEST), increasing. */
  from: number
  to: number
  party?: PartyWallV2
}

/**
 * A body's sides on one storey, split where it shares a wall (`PartyWallV2`): undefined when it shares none there, so
 * every body that shares nothing is built exactly as before. The host's stretch is PARTY, trimmed at its own corners by
 * its own wall across (that wall owns the corner); the other body's is NONE over the whole shared span.
 */
export function sideSegments(partyWalls: readonly PartyWallV2[] | undefined, m: Pick<MassV2, 'id' | 'x0' | 'z0' | 'x1' | 'z1' | 'storeyRects'>, storey: number, hostWallM: (massId: string) => number): Record<PartySide, SideSegment[]> | undefined {
  const mine = (partyWalls ?? []).filter((p) => p.storeyIndex === storey && (p.hostMassId === m.id || p.otherMassId === m.id))
  if (mine.length === 0) return undefined
  const r = rectAt(m, storey)
  const out = {} as Record<PartySide, SideSegment[]>
  for (const side of ['FRONT', 'EAST', 'REAR', 'WEST'] as const) {
    const [lo, hi] = alongOf(r, side)
    const cuts: SideSegment[] = []
    for (const p of mine) {
      const hostHere = p.hostMassId === m.id && p.hostFacade === side
      const otherHere = p.otherMassId === m.id && OPPOSITE_SIDE[p.hostFacade] === side
      if (!hostHere && !otherHere) continue
      if (p.open) {
        // N8-03A: no wall on the contact; at an end that is a corner of the body across only, this body's own wall runs
        // on over the end of that body's wall across, which stops at the contact line
        const across = hostWallM(hostHere ? p.otherMassId : p.hostMassId)
        const runsOn = (end: PartyEnd): boolean => (hostHere ? end === 'OTHER_CORNER' : end === 'HOST_CORNER')
        cuts.push({ kind: 'NONE', from: round6(Math.max(lo, p.span[0] + (runsOn(p.ends[0]) ? across : 0))), to: round6(Math.min(hi, p.span[1] - (runsOn(p.ends[1]) ? across : 0))), party: p })
        continue
      }
      if (otherHere) cuts.push({ kind: 'NONE', from: Math.max(lo, p.span[0]), to: Math.min(hi, p.span[1]), party: p })
      else {
        const [from, to] = partyStretch(p, hostWallM(m.id), hostWallM(p.otherMassId))
        // at its own corner the host's wall across owns the corner: the stretch under it is that wall's; at the other
        // body's corner the host's own wall runs on over the end of the other's wall across (the gap is left OWN)
        if (p.ends[0] !== 'OTHER_CORNER') cuts.push({ kind: 'CORNER', from: round6(p.span[0]), to: from, party: p })
        cuts.push({ kind: 'PARTY', from, to, party: p })
        if (p.ends[1] !== 'OTHER_CORNER') cuts.push({ kind: 'CORNER', from: to, to: round6(p.span[1]), party: p })
      }
    }
    cuts.sort((p, q) => p.from - q.from)
    const segs: SideSegment[] = []
    let at = lo
    for (const c of cuts) {
      if (c.from > at + 1e-6) segs.push({ kind: 'OWN', from: round6(at), to: round6(c.from) })
      segs.push(c)
      at = Math.max(at, c.to)
    }
    if (hi > at + 1e-6) segs.push({ kind: 'OWN', from: round6(at), to: round6(hi) })
    // own stretches next to each other are one wall
    const merged: SideSegment[] = []
    for (const s of segs) {
      const last = merged[merged.length - 1]
      if (last && last.kind === 'OWN' && s.kind === 'OWN') last.to = s.to
      else merged.push({ ...s })
    }
    out[side] = merged
  }
  return out
}

/**
 * Along the wall: the stretch the one wall stands on — the shared span less the corners: the host's wall across at its
 * own corners, the other body's wall across (under the host's own wall running on) at the other's.
 */
export const partyStretch = (p: PartyWallV2, hostWallM: number, otherWallM: number): [number, number] => [round6(p.span[0] + (p.ends[0] === 'OTHER_CORNER' ? otherWallM : hostWallM)), round6(p.span[1] - (p.ends[1] === 'OTHER_CORNER' ? otherWallM : hostWallM))]

/** The face of the shared wall toward the other body (where the other body's walls across stop). */
export const partyFarFace = (p: PartyWallV2): number => (p.hostFacade === 'EAST' || p.hostFacade === 'REAR' ? p.band[1] : p.band[0])
/** The face of the shared wall toward the host. */
export const partyNearFace = (p: PartyWallV2): number => (p.hostFacade === 'EAST' || p.hostFacade === 'REAR' ? p.band[0] : p.band[1])
