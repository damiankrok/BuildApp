/**
 * StairTopologyHypothesis (§13): the staircase as the plans draw it, read
 * from the tread ladders and nothing else.
 *
 * A flight is a run of thin parallel strokes at an even going, a landing is
 * the empty square two perpendicular flights turn through, a winder is a
 * corner that fans, and the direction of climb is the arrowhead on the
 * walking line. All of it is topology first: which bands, in what order,
 * turning which way. Riser counts and an exact `going` are stated only when
 * the ladders support them — and even then the total rise is checked against
 * the storey height so that a miscount cannot hide.
 *
 * Nothing here infers a stair from a rectangle. If no ladder is found the
 * hypothesis is null and the caller records the absence.
 */
import { round6 } from '@buildapp/source-common'
import type { PixelRect } from '@buildapp/source-common'
import type { Raster } from '@buildapp/source-cv'
import type { PlanFrameV2 } from './frame.js'
import { cluster1d, median, rgbAt, thinStrokesAlong } from './scan.js'

export type TreadLadder = {
  id: string
  /** The direction the treads are crossed in: a ladder along X has stroke lines running along Z. */
  along: 'X' | 'Z'
  /** World coordinates of the stroke lines, in ascending order along `along`. */
  lines: number[]
  /** The band the strokes run across (the tread length), in world metres on the other axis. */
  band: { from: number; to: number }
  spacingM: number
  /** How many scan lines across the band saw the ladder. */
  support: number
  pixelRect: PixelRect
}

export type StairFlightHypothesis = {
  index: number
  ladderId: string
  direction: 'PLUS_X' | 'MINUS_X' | 'PLUS_Z' | 'MINUS_Z'
  /** The band across the direction of travel. */
  band: { from: number; to: number }
  /** Along the direction of travel: the first and last riser line. */
  from: number
  to: number
  riserLines: number[]
  risers: number
  goingM: number
}

export type StairLandingHypothesis = { index: number; x0: number; z0: number; x1: number; z1: number; turn: 'LEFT' | 'RIGHT' }

export type StairTopologyHypothesis = {
  id: string
  storeyIndex: number
  shaft: { x0: number; z0: number; x1: number; z1: number }
  widthM: number
  start: { x: number; z: number }
  flights: StairFlightHypothesis[]
  landings: StairLandingHypothesis[]
  /** Corner squares that fan instead of resting: not counted, named. */
  winderRegions: Array<{ x0: number; z0: number; x1: number; z1: number }>
  turnKind: 'STRAIGHT' | 'L' | 'U' | 'UNKNOWN'
  risersTotal: number
  riserCountInterval: { low: number; high: number }
  /** How the direction was fixed. */
  directionEvidence: 'ARROW' | 'SECTION' | 'ASSUMED'
  /** Where the arrowhead sits, in world metres, when one was found. */
  arrow?: { x: number; z: number }
  confidence: number
  unresolved: string[]
  why: string
}

export type StairOptions = {
  onDebug?: (line: string) => void
  goingMinM?: number
  goingMaxM?: number
  treadMinM?: number
  treadMaxM?: number
  minLines?: number
}
const DEFAULTS: Required<Omit<StairOptions, 'onDebug'>> = { goingMinM: 0.21, goingMaxM: 0.34, treadMinM: 0.75, treadMaxM: 1.5, minLines: 4 }

/**
 * Tread ladders inside a body: sequences of thin strokes at an even spacing,
 * seen on several scan lines across the same band.
 */
export function findTreadLadders(raster: Raster, plan: PlanFrameV2, body: { x0: number; z0: number; x1: number; z1: number }, options: StairOptions = {}): TreadLadder[] {
  const opt = { ...DEFAULTS, ...options }
  const mpp = (plan.mppX + plan.mppY) / 2
  const pa = plan.toPixel(body.x0, body.z1)
  const pb = plan.toPixel(body.x1, body.z0)
  const px0 = Math.ceil(Math.min(pa.x, pb.x))
  const px1 = Math.floor(Math.max(pa.x, pb.x))
  const py0 = Math.ceil(Math.min(pa.y, pb.y))
  const py1 = Math.floor(Math.max(pa.y, pb.y))
  const minSpacing = opt.goingMinM / mpp
  const maxSpacing = opt.goingMaxM / mpp
  const ladders: TreadLadder[] = []

  for (const along of ['X', 'Z'] as const) {
    // Scan lines run along `along`; strokes cross them. Along X: scan rows; along Z: scan columns.
    const scanFrom = along === 'X' ? py0 : px0
    const scanTo = along === 'X' ? py1 : px1
    type Seq = { positions: number[]; scan: number }
    const sequences: Seq[] = []
    for (let s = scanFrom; s <= scanTo; s += 1) {
      const centres = along === 'X' ? thinStrokesAlong(raster, 'X', s, px0, px1) : thinStrokesAlong(raster, 'Y', s, py0, py1)
      // Even-spaced runs.
      let i = 0
      while (i < centres.length) {
        let j = i
        const gaps: number[] = []
        while (j + 1 < centres.length) {
          const g = centres[j + 1] - centres[j]
          if (g < minSpacing || g > maxSpacing) break
          if (gaps.length > 0 && Math.abs(g - median(gaps)) > median(gaps) * 0.3) break
          gaps.push(g)
          j += 1
        }
        if (j - i + 1 >= opt.minLines) sequences.push({ positions: centres.slice(i, j + 1), scan: s })
        i = j + 1
      }
    }
    // Group sequences that share the same lines across consecutive scans; a
    // symbol drawn over the treads (the walking-line arrowhead) breaks the
    // scans for a few pixels, so groups whose lines match are merged again
    // across a short break.
    type Group = { members: Seq[]; spacing: number }
    const used = new Set<number>()
    sequences.sort((a, b) => a.scan - b.scan)
    const groups: Group[] = []
    for (let k = 0; k < sequences.length; k += 1) {
      if (used.has(k)) continue
      const seed = sequences[k]
      const group = [seed]
      used.add(k)
      const spacing = median(seed.positions.slice(1).map((p, idx) => p - seed.positions[idx]))
      for (let m = k + 1; m < sequences.length; m += 1) {
        if (used.has(m)) continue
        const other = sequences[m]
        const last = group[group.length - 1]
        if (other.scan - last.scan > 4) break
        const overlap = Math.min(last.positions[last.positions.length - 1], other.positions[other.positions.length - 1]) - Math.max(last.positions[0], other.positions[0])
        if (overlap < spacing * 2) continue
        if (Math.abs(other.positions.length - seed.positions.length) > 2) continue
        group.push(other)
        used.add(m)
      }
      groups.push({ members: group, spacing })
    }
    const sameLines = (a: Group, b: Group): boolean => {
      const la = cluster1d(a.members.flatMap((g) => g.positions), a.spacing * 0.35).map((c) => c.centre)
      const lb = cluster1d(b.members.flatMap((g) => g.positions), a.spacing * 0.35).map((c) => c.centre)
      const shared = la.filter((x) => lb.some((y) => Math.abs(x - y) <= a.spacing * 0.35)).length
      return shared >= Math.min(la.length, lb.length) * 0.8 && shared >= opt.minLines - 1
    }
    let mergedAny = true
    while (mergedAny) {
      mergedAny = false
      for (let a = 0; a < groups.length && !mergedAny; a += 1) {
        for (let b = a + 1; b < groups.length; b += 1) {
          const ga = groups[a]
          const gb = groups[b]
          const aEnd = ga.members[ga.members.length - 1].scan
          const bStart = gb.members[0].scan
          const gap = bStart - aEnd
          if (gap < 0 || gap > Math.max(12, maxSpacing * 1.5)) continue
          if (!sameLines(ga, gb)) continue
          ga.members.push(...gb.members)
          groups.splice(b, 1)
          mergedAny = true
          break
        }
      }
    }
    for (const { members: group, spacing } of groups) {
      const seed = group[0]
      const support = group.length
      const bandPx = group[group.length - 1].scan - group[0].scan + 1
      const bandM = bandPx * mpp
      options.onDebug?.(`${along} seed scan ${seed.scan} positions ${seed.positions.map((p) => p.toFixed(1)).join(',')} group ${support} bandPx ${bandPx} bandM ${bandM.toFixed(2)}`)
      if (bandM < opt.treadMinM || bandM > opt.treadMaxM) continue
      if (support < 6) continue
      // The lines: cluster all positions in the group.
      const clusters = cluster1d(group.flatMap((g) => g.positions), spacing * 0.35).filter((c) => c.members.length >= support * 0.5)
      if (clusters.length < opt.minLines) continue
      const linesPx = clusters.map((c) => c.centre)
      const lines = linesPx.map((p) => (along === 'X' ? plan.toWorld(p, group[0].scan).x : plan.toWorld(group[0].scan, p).z)).sort((a, b) => a - b)
      const b0 = along === 'X' ? plan.toWorld(linesPx[0], group[0].scan - 1).z : plan.toWorld(group[0].scan - 1, linesPx[0]).x
      const b1 = along === 'X' ? plan.toWorld(linesPx[0], group[group.length - 1].scan + 1).z : plan.toWorld(group[group.length - 1].scan + 1, linesPx[0]).x
      ladders.push({
        id: `ladder-${along.toLowerCase()}-${ladders.length}`,
        along,
        lines: lines.map(round6),
        band: { from: round6(Math.min(b0, b1)), to: round6(Math.max(b0, b1)) },
        spacingM: round6(spacing * mpp),
        support,
        pixelRect:
          along === 'X'
            ? { x0: round6(Math.min(...linesPx)), y0: group[0].scan, x1: round6(Math.max(...linesPx)), y1: group[group.length - 1].scan }
            : { x0: group[0].scan, y0: round6(Math.min(...linesPx)), x1: group[group.length - 1].scan, y1: round6(Math.max(...linesPx)) },
      })
    }
  }
  return ladders
}

/** Pool ladders read on several plans of one building: the same flight drawn on two storeys is one ladder, kept from the plan that saw it best. */
export function poolLadders(all: ReadonlyArray<{ ladder: TreadLadder; storeyIndex: number }>): Array<{ ladder: TreadLadder; storeyIndices: number[] }> {
  const out: Array<{ ladder: TreadLadder; storeyIndices: number[] }> = []
  for (const { ladder, storeyIndex } of [...all].sort((a, b) => b.ladder.support - a.ladder.support || b.ladder.lines.length - a.ladder.lines.length)) {
    const same = out.find((o) => o.ladder.along === ladder.along && Math.abs(o.ladder.band.from - ladder.band.from) < 0.35 && Math.abs(o.ladder.band.to - ladder.band.to) < 0.35 && Math.min(o.ladder.lines[o.ladder.lines.length - 1], ladder.lines[ladder.lines.length - 1]) - Math.max(o.ladder.lines[0], ladder.lines[0]) > 0.4)
    if (same) {
      if (!same.storeyIndices.includes(storeyIndex)) same.storeyIndices.push(storeyIndex)
      continue
    }
    out.push({ ladder, storeyIndices: [storeyIndex] })
  }
  return out
}

/** A small filled dark triangle (an arrowhead) near a point, within `reachPx`. */
function arrowheadNear(raster: Raster, px: number, py: number, reachPx: number): { x: number; y: number } | null {
  let best: { x: number; y: number; n: number } | null = null
  const r = Math.ceil(reachPx)
  for (let y = Math.round(py) - r; y <= Math.round(py) + r; y += 1) {
    for (let x = Math.round(px) - r; x <= Math.round(px) + r; x += 1) {
      // A 5×5 window mostly dark and neutral, ISOLATED: the ring three
      // pixels further out must be mostly light, or this is a wall.
      const isDark = (xx: number, yy: number): boolean => {
        const [rr, gg, bb] = rgbAt(raster, xx, yy)
        return 0.299 * rr + 0.587 * gg + 0.114 * bb < 110 && Math.max(rr, gg, bb) - Math.min(rr, gg, bb) < 80
      }
      let dark = 0
      for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) if (isDark(x + dx, y + dy)) dark += 1
      if (dark < 16) continue
      let ring = 0
      let ringDark = 0
      for (let dy = -6; dy <= 6; dy += 1) for (let dx = -6; dx <= 6; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 5) continue
        ring += 1
        if (isDark(x + dx, y + dy)) ringDark += 1
      }
      if (ringDark / ring > 0.3) continue
      if (!best || dark > best.n) best = { x, y, n: dark }
    }
  }
  return best ? { x: best.x, y: best.y } : null
}

/**
 * Assemble the ladders in a body into one stair.
 *
 * Ladders are chained where one's band meets the next at a corner square of
 * about the band's width; the square is a LANDING when it is empty of
 * strokes. The direction of climb comes from an arrowhead at one end of the
 * chain; failing that from the section (the caller passes the storey rise and
 * the flight the section cuts, when it knows one); failing that it is stated
 * as ASSUMED.
 */
export function assembleStair(raster: Raster, plan: PlanFrameV2, ladders: readonly TreadLadder[], storeyIndex: number, riseM: number, options: StairOptions = {}): StairTopologyHypothesis | null {
  const opt = { ...DEFAULTS, ...options }
  if (ladders.length === 0) return null
  const mpp = (plan.mppX + plan.mppY) / 2
  // Chain: sort ladders by adjacency. Start from the ladder with the most lines; repeatedly attach a ladder whose band overlaps the current ladder's end square.
  const remaining = [...ladders]
  const chain: TreadLadder[] = []
  remaining.sort((a, b) => b.lines.length - a.lines.length || a.id.localeCompare(b.id))
  chain.push(remaining.shift() as TreadLadder)
  const widthOf = (l: TreadLadder): number => l.band.to - l.band.from
  const touches = (a: TreadLadder, b: TreadLadder): 'AT_END' | 'AT_START' | null => {
    if (a.along === b.along) {
      // Collinear ladders: same band, one continues the other.
      const sameBand = Math.abs(a.band.from - b.band.from) < 0.3 && Math.abs(a.band.to - b.band.to) < 0.3
      if (!sameBand) return null
      if (Math.abs(b.lines[0] - a.lines[a.lines.length - 1]) < widthOf(a) * 1.2) return 'AT_END'
      if (Math.abs(a.lines[0] - b.lines[b.lines.length - 1]) < widthOf(a) * 1.2) return 'AT_START'
      return null
    }
    // Perpendicular: b's band must contain a's end square, and b's first/last line must sit next to a's band.
    const w = widthOf(a)
    const aEnd = a.lines[a.lines.length - 1]
    const aStart = a.lines[0]
    const bNear = (v: number): boolean => Math.abs(b.lines[0] - a.band.to) < w * 1.2 || Math.abs(b.lines[b.lines.length - 1] - a.band.from) < w * 1.2 || Math.abs(b.lines[0] - a.band.from) < w * 1.2 || Math.abs(b.lines[b.lines.length - 1] - a.band.to) < w * 1.2 || v === v
    if (b.band.from - w * 0.3 <= aEnd + w && b.band.to + w * 0.3 >= aEnd && bNear(aEnd)) return 'AT_END'
    if (b.band.from - w * 0.3 <= aStart && b.band.to + w * 0.3 >= aStart - w && bNear(aStart)) return 'AT_START'
    return null
  }
  let grew = true
  while (grew && remaining.length > 0) {
    grew = false
    for (let i = 0; i < remaining.length; i += 1) {
      const tail = chain[chain.length - 1]
      const head = chain[0]
      const r = remaining[i]
      if (touches(tail, r) === 'AT_END' || touches(r, tail) === 'AT_START') {
        chain.push(r)
        remaining.splice(i, 1)
        grew = true
        break
      }
      if (touches(head, r) === 'AT_START' || touches(r, head) === 'AT_END') {
        chain.unshift(r)
        remaining.splice(i, 1)
        grew = true
        break
      }
    }
  }
  // Shaft = union of the ladders' rectangles (bands × line extents) in world metres.
  const rects = chain.map((l) => (l.along === 'X' ? { x0: l.lines[0], x1: l.lines[l.lines.length - 1], z0: l.band.from, z1: l.band.to } : { x0: l.band.from, x1: l.band.to, z0: l.lines[0], z1: l.lines[l.lines.length - 1] }))
  const shaft = { x0: round6(Math.min(...rects.map((r) => r.x0))), z0: round6(Math.min(...rects.map((r) => r.z0))), x1: round6(Math.max(...rects.map((r) => r.x1))), z1: round6(Math.max(...rects.map((r) => r.z1))) }
  const widthM = round6(median(chain.map(widthOf)))

  // Direction: an arrowhead on the walking line just beyond either end of the
  // chain — within a fifth of the width of the band's centre line, and between
  // a tenth and seven tenths of the width past the outermost riser line.
  const arrowBeyond = (l: TreadLadder, which: 'first' | 'last'): { x: number; z: number } | null => {
    const line = which === 'first' ? l.lines[0] : l.lines[l.lines.length - 1]
    const sign = which === 'first' ? -1 : 1
    const mid = (l.band.from + l.band.to) / 2
    const w = widthOf(l)
    let best: { x: number; y: number } | null = null
    for (let f = 0.1; f <= 0.7 && !best; f += 0.1) {
      const alongAt = line + sign * f * w
      const p = l.along === 'X' ? plan.toPixel(alongAt, mid) : plan.toPixel(mid, alongAt)
      best = arrowheadNear(raster, p.x, p.y, (w * 0.2) / mpp)
    }
    if (!best) return null
    const wpt = plan.toWorld(best.x, best.y)
    return { x: round6(wpt.x), z: round6(wpt.z) }
  }
  let arrow: { x: number; z: number } | undefined
  let arrowAt: 'HEAD' | 'TAIL' | undefined
  const chainEnds: Array<{ at: 'HEAD' | 'TAIL'; ladder: TreadLadder }> = [{ at: 'HEAD', ladder: chain[0] }]
  if (chain.length > 1) chainEnds.push({ at: 'TAIL', ladder: chain[chain.length - 1] })
  for (const e of chainEnds) {
    // The free end of an end ladder is the line farther from the rest of the chain.
    const other = chain.length > 1 ? (e.at === 'HEAD' ? chain[1] : chain[chain.length - 2]) : undefined
    const centreOfOther = other ? (other.along === e.ladder.along ? (other.lines[0] + other.lines[other.lines.length - 1]) / 2 : (other.band.from + other.band.to) / 2) : (e.ladder.lines[0] + e.ladder.lines[e.ladder.lines.length - 1]) / 2
    const firstIsFree = other ? Math.abs(e.ladder.lines[0] - centreOfOther) > Math.abs(e.ladder.lines[e.ladder.lines.length - 1] - centreOfOther) : true
    const candidates: Array<'first' | 'last'> = other ? [firstIsFree ? 'first' : 'last'] : ['first', 'last']
    for (const which of candidates) {
      const found = arrowBeyond(e.ladder, which)
      if (found) {
        arrow = found
        arrowAt = e.at
        break
      }
    }
    if (arrow) break
  }
  // Orient the chain so that it climbs from HEAD to TAIL: if the arrow is at the HEAD, reverse.
  let ordered = [...chain]
  if (arrowAt === 'HEAD') ordered = ordered.reverse()
  const directionEvidence: StairTopologyHypothesis['directionEvidence'] = arrow ? 'ARROW' : 'ASSUMED'

  // Flights, in climbing order, with the direction along each ladder settled by the chain geometry.
  const flights: StairFlightHypothesis[] = []
  const landings: StairLandingHypothesis[] = []
  const unresolved: string[] = []
  for (let i = 0; i < ordered.length; i += 1) {
    const l = ordered[i]
    const prev = ordered[i - 1]
    const nextL = ordered[i + 1]
    // Which way along the ladder do we travel? Towards the next ladder's band, or away from the previous one's.
    let forward = true
    const centreOf = (o: TreadLadder): number => (o.band.from + o.band.to) / 2
    if (nextL && nextL.along !== l.along) forward = centreOf(nextL) > (l.lines[0] + l.lines[l.lines.length - 1]) / 2
    else if (prev && prev.along !== l.along) forward = centreOf(prev) < (l.lines[0] + l.lines[l.lines.length - 1]) / 2
    else if (arrow) forward = (l.along === 'X' ? arrow.x : arrow.z) > (l.lines[0] + l.lines[l.lines.length - 1]) / 2
    const lines = forward ? [...l.lines] : [...l.lines].reverse()
    const direction = l.along === 'X' ? (forward ? 'PLUS_X' : 'MINUS_X') : forward ? 'PLUS_Z' : 'MINUS_Z'
    // Risers: one per line; the far edge of the band the flight climbs onto counts when it is not drawn as a line
    // (the landing edge or the arrival edge is the last riser).
    let riserLines = lines
    const spacing = l.spacingM
    if (prev) {
      // The edge of the landing this flight climbs off is its first riser when the ladder did not draw it.
      const edge = l.along === 'X' ? (forward ? prev.band.to : prev.band.from) : forward ? prev.band.to : prev.band.from
      const near = l.along === prev.along ? undefined : edge
      if (near !== undefined && Math.abs(Math.abs(near - lines[0]) - spacing) < spacing * 0.5 && (forward ? near < lines[0] : near > lines[0])) riserLines = [round6(near), ...lines]
    }
    if (nextL) {
      // The landing edge is nextL's band boundary nearest to our last line: add it if it is one going beyond the last line.
      const edge = l.along === 'X' ? (forward ? nextL.band.from : nextL.band.to) : forward ? nextL.band.from : nextL.band.to
      if (Math.abs(Math.abs(edge - lines[lines.length - 1]) - spacing) < spacing * 0.5 && (forward ? edge > lines[lines.length - 1] : edge < lines[lines.length - 1])) riserLines = [...riserLines, round6(edge)]
    }
    flights.push({ index: flights.length, ladderId: l.id, direction, band: l.band, from: riserLines[0], to: riserLines[riserLines.length - 1], riserLines, risers: riserLines.length, goingM: l.spacingM })
    if (nextL) {
      // The corner square between this ladder's end and the next ladder's start.
      const lastLine = riserLines[riserLines.length - 1]
      const square = l.along === 'X'
        ? { x0: Math.min(lastLine, forward ? lastLine + widthM : lastLine - widthM), x1: Math.max(lastLine, forward ? lastLine + widthM : lastLine - widthM), z0: l.band.from, z1: l.band.to }
        : { x0: l.band.from, x1: l.band.to, z0: Math.min(lastLine, forward ? lastLine + widthM : lastLine - widthM), z1: Math.max(lastLine, forward ? lastLine + widthM : lastLine - widthM) }
      // Turn: left or right, from the two directions.
      const nextForward = ((): boolean => {
        const after = ordered[i + 2]
        if (after && after.along !== nextL.along) return centreOf(after) > (nextL.lines[0] + nextL.lines[nextL.lines.length - 1]) / 2
        return centreOf(l) < (nextL.lines[0] + nextL.lines[nextL.lines.length - 1]) / 2
      })()
      const nextDirection = nextL.along === 'X' ? (nextForward ? 'PLUS_X' : 'MINUS_X') : nextForward ? 'PLUS_Z' : 'MINUS_Z'
      landings.push({ index: landings.length, ...roundRect(square), turn: turnOf(direction, nextDirection) })
    }
  }
  const risersTotal = flights.reduce((a, f) => a + f.risers, 0)
  const riserM = risersTotal > 0 ? riseM / risersTotal : 0
  const goingOk = flights.every((f) => f.goingM >= opt.goingMinM && f.goingM <= opt.goingMaxM)
  const riserOk = riserM >= 0.15 && riserM <= 0.2
  if (!riserOk) unresolved.push(`riser count: ${risersTotal} risers over ${riseM.toFixed(2)} m would be ${riserM.toFixed(3)} m each`)
  if (!goingOk) unresolved.push('going outside 0.21..0.34 m on a flight')
  if (!arrow) unresolved.push('direction of climb (no arrowhead found)')
  const turnKind: StairTopologyHypothesis['turnKind'] = flights.length === 1 ? 'STRAIGHT' : flights.length === 2 ? 'L' : flights.length === 3 ? 'U' : 'UNKNOWN'
  const lowRisers = Math.max(1, risersTotal - flights.length)
  const highRisers = risersTotal + flights.length
  const first = flights[0]
  const start = first.direction === 'PLUS_X' || first.direction === 'MINUS_X' ? { x: first.from, z: first.band.from } : { x: first.band.from, z: first.from }
  const confidence = round6(Math.min(0.9, 0.45 + (arrow ? 0.2 : 0) + (riserOk ? 0.15 : 0) + (goingOk ? 0.1 : 0)))
  return {
    id: `stair-${storeyIndex}`,
    storeyIndex,
    shaft,
    widthM,
    start: { x: round6(start.x), z: round6(start.z) },
    flights,
    landings,
    winderRegions: [],
    turnKind,
    risersTotal,
    riserCountInterval: { low: lowRisers, high: highRisers },
    directionEvidence,
    arrow,
    confidence,
    unresolved,
    why: `${flights.length} tread ladder${flights.length === 1 ? '' : 's'} (${flights.map((f) => `${f.risers} risers ${f.direction.toLowerCase().replace('_', ' ')} at ${f.goingM.toFixed(3)} m`).join(', ')}) with ${landings.length} corner square${landings.length === 1 ? '' : 's'} between them; ${risersTotal} risers over ${riseM.toFixed(2)} m = ${riserM.toFixed(3)} m each${arrow ? `; the arrowhead at (${arrow.x}, ${arrow.z}) fixes the climb` : '; no arrowhead found'}`,
  }
}

const roundRect = (r: { x0: number; z0: number; x1: number; z1: number }): { x0: number; z0: number; x1: number; z1: number } => ({ x0: round6(r.x0), z0: round6(r.z0), x1: round6(r.x1), z1: round6(r.z1) })

/** LEFT when the heading turns anticlockwise seen from above with x right and z away (the model's left-handed plan). */
function turnOf(a: StairFlightHypothesis['direction'], b: StairFlightHypothesis['direction']): 'LEFT' | 'RIGHT' {
  const heading: Record<StairFlightHypothesis['direction'], number> = { PLUS_X: 0, PLUS_Z: 90, MINUS_X: 180, MINUS_Z: 270 }
  const delta = (heading[b] - heading[a] + 360) % 360
  // Plan drawn with the front at the bottom: +x right, +z up the sheet. Turning from +x to +z is a turn to the LEFT.
  return delta === 90 ? 'LEFT' : 'RIGHT'
}
