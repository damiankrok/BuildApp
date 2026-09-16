/**
 * Reading openings off the plan, where they are drawn to scale.
 *
 * An elevation of a published project is very often a photo-realistic render,
 * and a rectangle detector run over one returns panes, cladding boards,
 * shadows and reflections along with the windows. A floor plan is the
 * opposite: it is a measured drawing, every opening in it is a GAP IN A WALL,
 * and the gap is at the position and the width the building has.
 *
 * So openings come from the plan and take their heights from elsewhere. The
 * plan gives:
 *
 * - which wall of which body an opening is in, and which storey;
 * - where along that wall it starts, in the dimension chains' own metres;
 * - how wide it is.
 *
 * And a Polish catalogue plan, like most, prints a CALLOUT against each
 * opening — `110/230`, `275/205` — which is its width and height in
 * centimetres. Where one can be matched to a gap it settles both, and where
 * the callout's width and the gap's width agree, the opening is measured
 * twice by two different means.
 *
 * What is left over is the sill, which a plan cannot show. It is taken from
 * the callout's own convention — an opening as tall as a door goes to the
 * floor — and said to be a convention where it is one.
 */
import { round6 } from '@buildapp/source-common'
import type { Raster } from '@buildapp/source-cv'
import { refineEdge } from '@buildapp/image-metrology'
import type { PixelRect } from '@buildapp/source-common'
import type { Band } from '@buildapp/source-cv'
import type { MetricEvidence } from '@buildapp/source-metrics'
import { ringBounds } from './structural-layout.js'
import type { MassHypothesis, PlanSide } from './structural-layout.js'

/** An opening as the plan shows it: a gap in a wall, in metres along that wall. */
export type PlanOpening = {
  id: string
  massId: string
  side: PlanSide
  /** Along the wall from the corner its ring starts at, in metres. */
  offsetM: number
  widthM: number
  /** Height, where a callout or a convention gives one. */
  heightM?: number
  sillM?: number
  /** The callout the opening was matched to, when one was. */
  callout?: { widthCm: number; heightCm: number; evidenceId: string; distanceM: number }
  /** Where the gap is on the plan, for the trace. */
  pixelRect: PixelRect
  confidence: number
  why: string
}

export type PlanOpeningOptions = {
  /** Narrowest gap that can be an opening, in metres. */
  minWidthM?: number
  /** Widest, in metres: a garage door is wide, a whole missing wall is not an opening. */
  maxWidthM?: number
  /** How far from a gap's centre a callout may be printed and still belong to it, in metres. */
  calloutReachM?: number
  /** How far a callout's width may be from the gap it is matched to, as a fraction of the gap. */
  calloutTolerance?: number
  /** How far a reveal may be refined from where the band reader left it, as a fraction of the wall's thickness. */
  revealSearch?: number
}

const DEFAULTS: Required<PlanOpeningOptions> = { minWidthM: 0.5, maxWidthM: 6.5, calloutReachM: 2.2, calloutTolerance: 0.35, revealSearch: 1 }

/**
 * The stretches of a line that are masonry rather than opening.
 *
 * Two kinds. The pieces of the wall band that runs ALONG the line are the
 * obvious ones. The other kind is where a wall CROSSES the line — a party
 * wall, a return, the far corner — because a wall meeting another wall is
 * solid there, and the band reader, which refuses any pixel whose run across
 * is longer than a wall is thick, cannot see it: at a crossing the run across
 * belongs to the other wall. Without them every junction reads as a hole.
 */
function coveredAlong(bands: readonly Band[], axis: 'X' | 'Z', linePx: number, tolerance: number): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (const band of bands) {
    const along = (band.axis === 'VERTICAL') === (axis === 'X')
    if (along) {
      const lo = axis === 'X' ? band.bounds.x0 : band.bounds.y0
      const hi = axis === 'X' ? band.bounds.x1 : band.bounds.y1
      if (linePx < lo - tolerance || linePx > hi + tolerance) continue
      for (const segment of band.segments) out.push([segment.from, segment.to])
      continue
    }
    // A wall crossing this line: solid where it crosses.
    const from = axis === 'X' ? band.bounds.y0 : band.bounds.x0
    const to = axis === 'X' ? band.bounds.y1 : band.bounds.x1
    const across0 = axis === 'X' ? band.bounds.x0 : band.bounds.y0
    const across1 = axis === 'X' ? band.bounds.x1 : band.bounds.y1
    if (linePx < across0 - tolerance || linePx > across1 + tolerance) continue
    if (!band.segments.some((segment) => segment.from - tolerance <= linePx && segment.to + tolerance >= linePx)) continue
    out.push([from, to])
  }
  out.sort((a, b) => a[0] - b[0])
  const merged: Array<[number, number]> = []
  for (const [a, b] of out) {
    const last = merged[merged.length - 1]
    if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b)
    else merged.push([a, b])
  }
  return merged
}

/**
 * Where the wall actually stops.
 *
 * The band reader finds a gap between two pieces of masonry, and it finds it
 * a few pixels wide of the truth at each end: a run-length band needs its
 * thickness to hold all the way along, and the last few pixels of a wall
 * beside an opening are drawn with a reveal, a nib or an antialiased edge, so
 * the band gives up early. On the reference project's ground-floor plan the
 * rear glazing reads 5.03 m between band ends where the black poché actually
 * stops 4.74 m apart, against a printed 4.70 — about five pixels of lost wall
 * at each end, and a third of a metre on the answer.
 *
 * Those five pixels are not missing from the DRAWING. The end of the wall is
 * one of the hardest edges on the sheet — solid ink against an empty opening,
 * running the full thickness of the wall and nothing else — so it is found
 * here directly, and to a fraction of a pixel, instead of being inferred from
 * where a thickness test happened to fail.
 *
 * The search is deliberately short. A reveal is refined by a wall's thickness
 * at most, and never by enough to reach the next opening, because a reveal
 * that moves further than that is not a reveal being corrected; it is a
 * different feature being adopted.
 */
function refineReveal(raster: Raster, axis: 'X' | 'Z', linePx: number, atPx: number, wallPx: number, limitPx: number): { atPx: number; sigmaPx: number; why: string } | null {
  const search = Math.max(2, Math.min(wallPx, limitPx))
  // Across the wall's own thickness, a little either side of it: the reveal is
  // the one edge that runs the whole way through.
  const within = { from: linePx - wallPx * 0.6, to: linePx + wallPx * 1.6 }
  const found = refineEdge(raster, {
    axis: axis === 'Z' ? 'VERTICAL' : 'HORIZONTAL',
    nearPx: atPx,
    searchPx: search,
    within: axis === 'Z' ? within : within,
    minCoverageFraction: 0.3,
  })
  if (!found) return null
  return { atPx: found.atPx, sigmaPx: found.sigmaPx, why: found.why }
}

/**
 * Openings in one body's exterior walls, from the gaps in the walls that
 * enclose it.
 *
 * `toMetric` maps pixels along each axis to metres through the dimension
 * chains, so an opening's position is stated in the same centimetres the
 * drawing is.
 */
export function planOpenings(
  mass: MassHypothesis,
  massRect: PixelRect,
  bands: readonly Band[],
  wallPx: number,
  toMetric: { x: (px: number) => number; z: (px: number) => number },
  callouts: readonly MetricEvidence[],
  options: PlanOpeningOptions = {},
  /** The plan's own pixels, so a reveal can be found rather than inferred. */
  raster?: Raster,
): PlanOpening[] {
  const opt = { ...DEFAULTS, ...options }
  const bounds = ringBounds(mass.ring)
  const out: PlanOpening[] = []
  const tolerance = Math.max(4, wallPx * 0.8)

  const sides: Array<{ side: PlanSide; axis: 'X' | 'Z'; linePx: number; fromPx: number; toPx: number; reversed: boolean }> = [
    { side: 'MIN_Z', axis: 'Z', linePx: massRect.y0, fromPx: massRect.x0, toPx: massRect.x1, reversed: false },
    { side: 'MAX_X', axis: 'X', linePx: massRect.x1, fromPx: massRect.y0, toPx: massRect.y1, reversed: false },
    { side: 'MAX_Z', axis: 'Z', linePx: massRect.y1, fromPx: massRect.x0, toPx: massRect.x1, reversed: true },
    { side: 'MIN_X', axis: 'X', linePx: massRect.x0, fromPx: massRect.y0, toPx: massRect.y1, reversed: true },
  ]

  for (const side of sides) {
    const covered = coveredAlong(bands, side.axis, side.linePx, tolerance)
    // The corners belong to the walls that meet there, not to this one.
    const inset = wallPx
    const from = side.fromPx + inset
    const to = side.toPx - inset
    if (to <= from) continue
    const gaps: Array<[number, number]> = []
    let cursor = from
    for (const [a, b] of covered) {
      if (b < from || a > to) continue
      if (a > cursor) gaps.push([cursor, Math.min(a, to)])
      cursor = Math.max(cursor, b)
    }
    if (cursor < to) gaps.push([cursor, to])

    for (const [rawA, rawB] of gaps) {
      // The band reader's ends are a proposal; the drawing says where the wall
      // stops. Refined outward-in from each end, and only ever by a fraction
      // of the gap, so a correction can never swallow the opening.
      const limit = Math.max(2, (rawB - rawA) * 0.2)
      const revealLo = raster ? refineReveal(raster, side.axis, side.linePx, rawA, wallPx, limit) : null
      const revealHi = raster ? refineReveal(raster, side.axis, side.linePx, rawB, wallPx, limit) : null
      const a = revealLo?.atPx ?? rawA
      const b = revealHi?.atPx ?? rawB
      if (b <= a) continue
      const refinedWhy =
        revealLo || revealHi
          ? `; its reveals were found in the drawing itself, ${revealLo ? `${round6(a - rawA)} px` : 'not moved'} and ${revealHi ? `${round6(b - rawB)} px` : 'not moved'} from where the band reader left them`
          : ''
      const alongMetric = side.axis === 'X' ? toMetric.z : toMetric.x
      const world0 = alongMetric(a)
      const world1 = alongMetric(b)
      const widthM = round6(Math.abs(world1 - world0))
      if (widthM < opt.minWidthM || widthM > opt.maxWidthM) continue
      // Where along the wall, measured the way the ring was emitted: the
      // anticlockwise traversal every wall id in the model follows.
      const lo = Math.min(world0, world1)
      const hi = Math.max(world0, world1)
      const wallFrom = side.axis === 'X' ? bounds.z0 : bounds.x0
      const wallTo = side.axis === 'X' ? bounds.z1 : bounds.x1
      const offsetM = round6(side.reversed ? wallTo - hi : lo - wallFrom)
      const centreWorld = (lo + hi) / 2
      const pixelRect: PixelRect =
        side.axis === 'X'
          ? { x0: round6(side.linePx - wallPx / 2), y0: round6(a), x1: round6(side.linePx + wallPx / 2), y1: round6(b) }
          : { x0: round6(a), y0: round6(side.linePx - wallPx / 2), x1: round6(b), y1: round6(side.linePx + wallPx / 2) }

      // A callout printed against this gap. Matched on POSITION first and then
      // checked on width, so a callout that belongs to a different opening
      // cannot capture this one just by being the nearest number on the sheet.
      let matched: PlanOpening['callout']
      for (const callout of callouts) {
        if (!callout.textBox) continue
        const cx = (callout.textBox.x0 + callout.textBox.x1) / 2
        const cy = (callout.textBox.y0 + callout.textBox.y1) / 2
        const alongPx = side.axis === 'X' ? cy : cx
        const acrossPx = side.axis === 'X' ? cx : cy
        const alongDistance = Math.abs(alongMetric(alongPx) - centreWorld)
        const acrossDistance = Math.abs((side.axis === 'X' ? toMetric.x(acrossPx) : toMetric.z(acrossPx)) - (side.axis === 'X' ? toMetric.x(side.linePx) : toMetric.z(side.linePx)))
        if (alongDistance > opt.calloutReachM || acrossDistance > opt.calloutReachM) continue
        const pair = openingPair(callout)
        if (!pair) continue
        if (Math.abs(pair.widthCm / 100 - widthM) > Math.max(0.25, widthM * opt.calloutTolerance)) continue
        const distance = round6(Math.hypot(alongDistance, acrossDistance))
        if (matched && matched.distanceM <= distance) continue
        matched = { widthCm: pair.widthCm, heightCm: pair.heightCm, evidenceId: callout.id, distanceM: distance }
      }

      const width = matched ? round6(matched.widthCm / 100) : widthM
      const height = matched ? round6(matched.heightCm / 100) : undefined
      out.push({
        id: `plan-opening-${mass.id}-${side.side.toLowerCase()}-${out.length}`,
        massId: mass.id,
        side: side.side,
        offsetM,
        widthM: width,
        heightM: height,
        // A door-height opening reaches the floor; a shorter one does not, and
        // where nothing states the sill the head is taken to be at the usual
        // lintel of a domestic storey. Both are conventions and both say so.
        sillM: height === undefined ? undefined : height >= 1.95 ? 0 : round6(Math.max(0, 2.2 - height)),
        callout: matched,
        pixelRect,
        confidence: round6(matched ? Math.min(0.9, 0.6 + (1 - matched.distanceM / opt.calloutReachM) * 0.3) : 0.55),
        why: matched
          ? `a ${round6(widthM)} m gap in the wall with "${matched.widthCm}/${matched.heightCm}" printed ${matched.distanceM} m from it: the plan and the callout agree on the width${refinedWhy}`
          : `a ${widthM} m gap in a wall the plan draws as continuous either side of it, with no callout near enough to name it${refinedWhy}`,
      })
    }
  }
  return out.sort((a, b) => a.side.localeCompare(b.side) || a.offsetM - b.offsetM)
}

/** `110/230` read as a width and a height in centimetres. */
export function openingPair(evidence: MetricEvidence): { widthCm: number; heightCm: number } | null {
  const text = evidence.rawText.replace(/\s/g, '')
  const m = /^(\d{2,3})[/xX](\d{2,3})$/.exec(text)
  if (m) {
    const widthCm = Number(m[1])
    const heightCm = Number(m[2])
    if (widthCm >= 40 && widthCm <= 700 && heightCm >= 40 && heightCm <= 400) return { widthCm, heightCm }
  }
  return null
}
