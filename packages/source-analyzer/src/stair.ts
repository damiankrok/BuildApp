/**
 * Reading a staircase off a plan.
 *
 * The rule this file exists to obey: **nothing here may infer a staircase
 * from the size of a shaft.** A rectangle of the right proportions is not
 * evidence of a stair, and a stair reported as "a 2.6 x 3.1 m box" is exactly
 * how the current reference reconstruction came to have the wrong topology
 * and the wrong orientation. What a plan actually shows, and what is read
 * here, is a RUN OF TREAD LINES: a series of short parallel-ish strokes at
 * even spacing, with a walking line through them, a direction mark, and —
 * where the flight turns — a group of strokes that fan instead of running
 * parallel.
 *
 * So the output is the structure, not a summary of it:
 *
 *  - the tread lines themselves, counted, as a LINE_FAMILY;
 *  - the walking line through their midpoints, which carries the topology:
 *    a straight flight, a dog-leg, a U-turn;
 *  - each straight flight as its own run, and each fanning group as its own
 *    winder region;
 *  - the direction of ascent, when the drawing marks it — and an explicit
 *    AMBIGUOUS gap with both readings as alternatives when it does not.
 *
 * If no tread run is found, this file produces NO stair observation at all.
 * A named absence is the honest answer; a plausible staircase invented from a
 * bounding box is not.
 */
import { angleDeltaDeg, round6, segmentAngleDeg } from '@buildapp/source-common'
import type { PixelPoint, PixelRect } from '@buildapp/source-common'
import type { Segment } from '@buildapp/source-cv'

export type TreadRun = {
  /** The tread strokes, ordered along the direction of travel. */
  treads: Segment[]
  /** Midpoint of each tread, in the same order: the walking line. */
  walkingLine: PixelPoint[]
  bounds: PixelRect
  /** Median centre-to-centre spacing of consecutive treads, in pixels. */
  spacing: number
  /** Spread of tread angles, in degrees. A parallel flight is near zero; a winder fans. */
  angleSpreadDeg: number
  /** Maximal stretches of near-parallel treads, as index ranges into `treads`. */
  flights: Array<{ from: number; to: number; angleDeg: number }>
  /** Stretches where consecutive treads turn: a winder or a fan. */
  winders: Array<{ from: number; to: number; turnDeg: number }>
  /** How many of the run's two sides are closed by a line running along the flight: a stringer, a wall or a handrail. */
  stringers: number
}

export type StairDirection = {
  /** The stroke the arrow or UP/DOWN mark was drawn on. */
  axis: Segment
  /** The end the arrowhead points at: where the flight is climbing TO. */
  head: PixelPoint
  tail: PixelPoint
  confidence: number
  evidence: string
}

/** What the drawing gave up when it was asked for a staircase. */
export type StairAnalysis = {
  /** The staircase, when the drawing shows one it can be held to. */
  stair: StairReading | null
  /** Regular runs of strokes that were considered and not taken, with the reason. Evidence, not assertions. */
  rejected: Array<{ run: TreadRun; why: string }>
}

export type StairReading = {
  run: TreadRun
  direction: StairDirection | null
  /** Both directions, when the drawing does not settle it. */
  directionAlternatives: Array<{ head: PixelPoint; tail: PixelPoint; why: string }>
}

export type StairOptions = {
  /** A tread stroke is short. Longest admissible, as a fraction of the image's larger edge. */
  maxTreadFrac?: number
  /** And not a tick mark. Shortest admissible. */
  minTreadFrac?: number
  /** How many strokes make a run worth reporting. */
  minTreads?: number
  /** Coefficient of variation of spacing above which a group is not an evenly-stepped run. */
  maxSpacingCv?: number
  /** Consecutive treads turning by more than this are winding, not parallel. */
  turnThresholdDeg?: number
  /** Two strokes further apart in direction than this are not consecutive treads of one flight. */
  maxTurnPerStepDeg?: number
  /** A tread is much longer than the going: below this ratio a regular row of strokes is hatching, not a stair. */
  minLengthToSpacing?: number
  /**
   * The smallest going a published drawing can be read to show, as a fraction
   * of its larger edge.
   *
   * A step is about 0.27 m in a house 12 m across, so a going is a bit over
   * 1% of a sheet that shows the whole plan. Fill patterns — terrain hatch,
   * paving, planting, tiling — sit at a flat 3 to 5 pixels whatever the sheet
   * size, and they pass every other test a flight passes: even spacing, equal
   * lengths, ends held by a boundary, and on the live benchmark a passable
   * arrowhead. The only thing that reliably separates the two is the SIZE of
   * the step relative to the drawing.
   *
   * The default demands a clear separation rather than a marginal one, which
   * means a published raster must be large enough to actually resolve a flight
   * before one is reported off it. On the live benchmark's 853px plans the
   * going is around 1% and the hatch pitch around 0.5% — a factor of two, and
   * a factor of two is not a separation. So no staircase is read from those
   * plans, the runs that were considered are recorded as candidates with the
   * reason each was rejected, and the gap is named. That is the honest result:
   * a stair invented from a planting symbol cannot be undone downstream, and a
   * named gap can be filled by a larger source or a vision pass.
   */
  minSpacingFrac?: number
  /**
   * The region a staircase may be in — in practice, the extent of the
   * drawing's own wall bands. A stair is inside a building, and the patterns
   * that most resemble a flight on a published plan (terrain hatch, paving,
   * planting) are outside it.
   */
  within?: PixelRect
}

const DEFAULTS: Required<StairOptions> = { maxTreadFrac: 0.22, minTreadFrac: 0.02, minTreads: 4, maxSpacingCv: 0.42, turnThresholdDeg: 6, maxTurnPerStepDeg: 30, minLengthToSpacing: 2.5, minSpacingFrac: 0.018, within: { x0: -Infinity, y0: -Infinity, x1: Infinity, y1: Infinity } }

const midpoint = (s: Segment): PixelPoint => ({ x: round6((s.a.x + s.b.x) / 2), y: round6((s.a.y + s.b.y) / 2) })

const median = (xs: readonly number[]): number => {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2
}

const boundsOf = (pts: readonly PixelPoint[]): PixelRect => ({
  x0: round6(Math.min(...pts.map((p) => p.x))),
  y0: round6(Math.min(...pts.map((p) => p.y))),
  x1: round6(Math.max(...pts.map((p) => p.x))),
  y1: round6(Math.max(...pts.map((p) => p.y))),
})

/**
 * Chain tread strokes into a flight.
 *
 * Clustering by proximity alone does not survive a real drawing: a stair is
 * drawn against a wall, next to furniture, under a room number and through a
 * watermark, and a proximity cluster swallows all of it, after which no
 * uniformity test can find the stair inside the mess.
 *
 * So the relation used here is STEPPING, not nearness. Two strokes are
 * consecutive treads when they are a plausible going apart, of similar length,
 * nearly parallel, and the direction from one to the other is roughly
 * perpendicular to both — which is what "the next step" means, and which a
 * wall line, a dimension tick and a hatch stroke each fail in a different way.
 * Each stroke keeps its nearest admissible neighbour on each side, a link
 * survives only when both ends chose one another, and the resulting graph is a
 * set of paths: the flights.
 *
 * Because "nearly parallel" tolerates a turn of up to 30 degrees per step, one
 * path runs straight THROUGH a winder, so a quarter-turn stair comes back as
 * one run with a turn in it rather than as three unrelated families. That is
 * the difference between reading a topology and reading three rectangles.
 */
type TreadNode = { seg: Segment; mid: PixelPoint }

/** Signed distance from `from` to `to` along `from`'s own normal: which side the neighbour is on. */
function sideOf(from: TreadNode, to: TreadNode): number {
  const rad = (from.seg.angleDeg * Math.PI) / 180
  return (to.mid.x - from.mid.x) * -Math.sin(rad) + (to.mid.y - from.mid.y) * Math.cos(rad)
}

function chainTreads(nodes: readonly TreadNode[], opt: Required<StairOptions>): TreadNode[][] {
  const n = nodes.length
  const best = new Map<string, { j: number; d: number }>()
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      if (i === j) continue
      const a = nodes[i]
      const b = nodes[j]
      const d = Math.hypot(a.mid.x - b.mid.x, a.mid.y - b.mid.y)
      if (d < 1.5) continue
      // A going is shorter than a tread, so a pair further apart than the
      // shorter stroke's own length is not two consecutive steps.
      if (d > Math.max(6, Math.min(a.seg.length, b.seg.length) * 0.9)) continue
      const ratio = a.seg.length / Math.max(1e-6, b.seg.length)
      if (ratio < 0.5 || ratio > 2) continue
      if (angleDeltaDeg(a.seg.angleDeg, b.seg.angleDeg) > opt.maxTurnPerStepDeg) continue
      const stepAngle = segmentAngleDeg(a.mid, b.mid)
      if (angleDeltaDeg(stepAngle, a.seg.angleDeg) < 45 || angleDeltaDeg(stepAngle, b.seg.angleDeg) < 45) continue
      // Nearest is not the same as next. A drawing is full of short fragments
      // — an arc, a hatch, the end of a handrail — that sit closer to a tread
      // than the next tread does, and letting one of those win the slot breaks
      // the run exactly where it turns. So the cost charges for a difference in
      // LENGTH as well as for distance: a stroke the same length as this tread
      // a little further on beats a fragment half its length close by.
      const cost = d * (1 + 2 * Math.abs(Math.log(ratio)))
      const key = `${i}:${sideOf(a, b) >= 0 ? '+' : '-'}`
      const current = best.get(key)
      if (!current || cost < current.d || (cost === current.d && j < current.j)) best.set(key, { j, d: cost })
    }
  }

  // A one-sided preference is a coincidence; a mutual one is a step.
  const links = new Map<number, Set<number>>()
  const chose = (i: number, j: number): boolean => best.get(`${i}:+`)?.j === j || best.get(`${i}:-`)?.j === j
  for (let i = 0; i < n; i += 1) {
    for (const sign of ['+', '-']) {
      const link = best.get(`${i}:${sign}`)
      if (!link || !chose(link.j, i)) continue
      if (!links.has(i)) links.set(i, new Set())
      if (!links.has(link.j)) links.set(link.j, new Set())
      links.get(i)?.add(link.j)
      links.get(link.j)?.add(i)
    }
  }

  const seen = new Set<number>()
  const chains: TreadNode[][] = []
  const walk = (from: number): number[] => {
    const path = [from]
    seen.add(from)
    let prev = -1
    let at = from
    for (;;) {
      const next = [...(links.get(at) ?? [])].filter((k) => k !== prev && !seen.has(k)).sort((p, q) => p - q)[0]
      if (next === undefined) break
      path.push(next)
      seen.add(next)
      prev = at
      at = next
    }
    return path
  }
  // Walk from the ends first, so a path is traced whole rather than from its
  // middle; ties break on index, so the result never depends on Map order.
  const order = [...links.keys()].sort((a, b) => (links.get(a)?.size ?? 0) - (links.get(b)?.size ?? 0) || a - b)
  for (const i of order) {
    if (seen.has(i)) continue
    const path = walk(i)
    if (path.length < opt.minTreads) continue
    const chain = path.map((k) => nodes[k])
    // Canonical direction: the end whose midpoint sorts first comes first, so
    // the same drawing gives the same run whatever order the strokes arrived
    // in. Which end the flight CLIMBS to is a separate question, answered by
    // the direction mark and not by the traversal.
    const head = chain[0].mid
    const tail = chain[chain.length - 1].mid
    chains.push(head.y < tail.y || (head.y === tail.y && head.x <= tail.x) ? chain : [...chain].reverse())
  }
  return chains
}

/** Collapse strokes that are the same drawn line found twice, keeping the longest. */
function dedupe(nodes: readonly TreadNode[]): TreadNode[] {
  const kept: TreadNode[] = []
  for (const n of [...nodes].sort((a, b) => b.seg.length - a.seg.length || a.mid.x - b.mid.x || a.mid.y - b.mid.y)) {
    const same = kept.some((k) => Math.hypot(k.mid.x - n.mid.x, k.mid.y - n.mid.y) <= 1.5 && angleDeltaDeg(k.seg.angleDeg, n.seg.angleDeg) <= 6 && Math.abs(k.seg.length - n.seg.length) <= Math.max(3, n.seg.length * 0.25))
    if (!same) kept.push(n)
  }
  return kept.sort((a, b) => a.mid.y - b.mid.y || a.mid.x - b.mid.x)
}

/**
 * How many sides of a run are closed by a line running ALONG the flight.
 *
 * This is what separates a staircase from a shrub. Both are drawn as a row of
 * short parallel strokes at regular spacing; only the staircase is bounded, at
 * the ends of its treads, by something running the length of the flight — a
 * stringer, a wall, a handrail, the edge of the void. A hatch that fills a
 * planting symbol has strokes and nothing holding their ends.
 *
 * A side counts as closed when one line, running within 30 degrees of the
 * direction of travel, passes close to most of the tread ends on that side.
 */
function countStringers(treads: readonly Segment[], walkingLine: readonly PixelPoint[], spacing: number, segments: readonly Segment[]): number {
  const travel = segmentAngleDeg(walkingLine[0], walkingLine[walkingLine.length - 1])
  const extent = Math.hypot(walkingLine[walkingLine.length - 1].x - walkingLine[0].x, walkingLine[walkingLine.length - 1].y - walkingLine[0].y)
  if (extent <= 0) return 0
  const treadSet = new Set(treads)
  const candidates = segments.filter((s) => !treadSet.has(s) && s.length >= extent * 0.6 && angleDeltaDeg(s.angleDeg, travel) <= 30)
  const tolerance = Math.max(2.5, spacing * 0.9)

  // The two sides: for each tread, the endpoint further along its own
  // direction and the one behind it, taken consistently.
  const sides: PixelPoint[][] = [[], []]
  for (const t of treads) {
    const forward = segmentAngleDeg(t.a, t.b)
    const flip = angleDeltaDeg(forward, travel + 90) > 90
    sides[flip ? 1 : 0].push(t.a)
    sides[flip ? 0 : 1].push(t.b)
  }

  let closed = 0
  for (const ends of sides) {
    if (ends.length === 0) continue
    const covered = candidates.some((line) => {
      const near = ends.filter((p) => distanceToSegment(p, line) <= tolerance).length
      return near >= ends.length * 0.7
    })
    if (covered) closed += 1
  }
  return closed
}

function distanceToSegment(p: PixelPoint, s: Segment): number {
  const vx = s.b.x - s.a.x
  const vy = s.b.y - s.a.y
  const len2 = vx * vx + vy * vy
  if (len2 === 0) return Math.hypot(p.x - s.a.x, p.y - s.a.y)
  const t = Math.max(0, Math.min(1, ((p.x - s.a.x) * vx + (p.y - s.a.y) * vy) / len2))
  return Math.hypot(p.x - (s.a.x + t * vx), p.y - (s.a.y + t * vy))
}

/**
 * Find the runs of evenly stepped strokes in a drawing.
 *
 * Returns every run that qualifies, best first. A plan with two staircases has
 * two runs; a plan with none has none, and that is a result.
 */
export function treadRuns(strokes: readonly Segment[], imageSize: { width: number; height: number }, options: StairOptions = {}, context: readonly Segment[] = strokes): TreadRun[] {
  const opt = { ...DEFAULTS, ...options }
  const larger = Math.max(imageSize.width, imageSize.height)
  const candidates = strokes.filter((s) => s.length >= opt.minTreadFrac * larger && s.length <= opt.maxTreadFrac * larger)
  if (candidates.length < opt.minTreads) return []

  // Two detectors find the same drawn line twice, and a duplicate is worse
  // than useless here: each copy takes one of the two links the real stroke
  // needed, so a flight and the winder it turns into end up as two separate
  // runs — the topology lost at exactly the point that matters.
  const nodes = dedupe(candidates.map((seg) => ({ seg, mid: midpoint(seg) })))
  const runs: TreadRun[] = []

  for (const chain of chainTreads(nodes, opt)) {
    const ordered = chain.map((c) => c.seg)
    const walkingLine = chain.map((c) => c.mid)
    const gaps: number[] = []
    for (let i = 1; i < walkingLine.length; i += 1) gaps.push(Math.hypot(walkingLine[i].x - walkingLine[i - 1].x, walkingLine[i].y - walkingLine[i - 1].y))
    const spacing = median(gaps)
    if (spacing < Math.max(2, opt.minSpacingFrac * larger)) continue
    const cv = Math.sqrt(gaps.reduce((a, g) => a + (g - spacing) ** 2, 0) / gaps.length) / spacing
    if (cv > opt.maxSpacingCv) continue
    // The discriminator against hatching and against a row of dimension
    // ticks: a tread is several times longer than the going between treads.
    const medLen = median(ordered.map((s) => s.length))
    if (medLen < spacing * opt.minLengthToSpacing) continue

    const angles = ordered.map((s) => s.angleDeg)
    let spread = 0
    for (const a of angles) for (const b of angles) spread = Math.max(spread, angleDeltaDeg(a, b))

    const flights: TreadRun['flights'] = []
    const winders: TreadRun['winders'] = []
    let start = 0
    for (let i = 1; i <= ordered.length; i += 1) {
      const turn = i < ordered.length ? angleDeltaDeg(ordered[i].angleDeg, ordered[i - 1].angleDeg) : Infinity
      if (turn <= opt.turnThresholdDeg) continue
      if (i - start >= 2) flights.push({ from: start, to: i - 1, angleDeg: round6(median(angles.slice(start, i))) })
      if (i >= ordered.length) break
      let j = i
      let total = 0
      while (j < ordered.length && angleDeltaDeg(ordered[j].angleDeg, ordered[j - 1].angleDeg) > opt.turnThresholdDeg) {
        total += angleDeltaDeg(ordered[j].angleDeg, ordered[j - 1].angleDeg)
        j += 1
      }
      winders.push({ from: i - 1, to: j - 1, turnDeg: round6(total) })
      start = j - 1
      i = j - 1
    }

    const bounds = boundsOf(ordered.flatMap((t) => [t.a, t.b]))
    runs.push({
      treads: ordered,
      walkingLine,
      bounds,
      spacing: round6(spacing),
      angleSpreadDeg: round6(spread),
      flights,
      winders,
      stringers: countStringers(ordered, walkingLine, spacing, context),
    })
  }

  // Best run first: most treads, then the longest reach. A plan with two
  // staircases returns both and the caller decides what to do with them.
  runs.sort((a, b) => b.treads.length - a.treads.length || b.spacing * b.treads.length - a.spacing * a.treads.length || a.bounds.y0 - b.bounds.y0 || a.bounds.x0 - b.bounds.x0)
  return runs
}

/**
 * Find the direction of ascent.
 *
 * The drawing convention is a long line running up the flight with an
 * arrowhead at the top end. So: a stroke inside the run's bounds, roughly
 * perpendicular to the treads, long enough to span most of them, with two
 * short strokes meeting one of its ends at an angle. No arrowhead, no
 * direction — the caller records the ambiguity rather than picking a way.
 */
export function stairDirection(run: TreadRun, segments: readonly Segment[]): StairDirection | null {
  const treadAngle = median(run.treads.map((s) => s.angleDeg))
  const inside = (p: PixelPoint): boolean => p.x >= run.bounds.x0 - 4 && p.x <= run.bounds.x1 + 4 && p.y >= run.bounds.y0 - 4 && p.y <= run.bounds.y1 + 4
  const runLength = Math.hypot(run.walkingLine[run.walkingLine.length - 1].x - run.walkingLine[0].x, run.walkingLine[run.walkingLine.length - 1].y - run.walkingLine[0].y)
  const treadSet = new Set(run.treads)

  const treadLength = median(run.treads.map((s) => s.length))
  // The arrow is drawn ALONG the walking line, through the middle of the
  // treads. A stringer is also long, also inside the run and also
  // perpendicular to the treads — but it runs through their ENDS, so asking
  // that the candidate pass near the midpoints separates the two.
  const nearMidpoints = (s: Segment): boolean => run.walkingLine.filter((p) => distanceToSegment(p, s) <= Math.max(3, treadLength * 0.3)).length >= run.walkingLine.length * 0.6
  const axes = segments
    .filter((s) => !treadSet.has(s) && inside(s.a) && inside(s.b) && s.length >= Math.max(run.spacing * 2.5, runLength * 0.45) && angleDeltaDeg(s.angleDeg, treadAngle) >= 45 && nearMidpoints(s))
    .sort((a, b) => b.length - a.length)

  for (const axis of axes) {
    const barbLimit = axis.length * 0.35
    for (const end of [axis.a, axis.b] as const) {
      const other = end === axis.a ? axis.b : axis.a
      const barbs = segments.filter((s) => {
        if (s === axis || treadSet.has(s)) return false
        if (s.length > barbLimit || s.length < 2) return false
        const near = Math.min(Math.hypot(s.a.x - end.x, s.a.y - end.y), Math.hypot(s.b.x - end.x, s.b.y - end.y))
        if (near > Math.max(4, axis.length * 0.12)) return false
        const delta = angleDeltaDeg(s.angleDeg, axis.angleDeg)
        return delta >= 15 && delta <= 75
      })
      if (barbs.length >= 2) {
        return { axis, head: end, tail: other, confidence: 0.82, evidence: `a ${round6(axis.length)}px line runs up the flight with ${barbs.length} short strokes meeting one end at 12-75 degrees: an arrowhead, and it points at (${end.x}, ${end.y})` }
      }
    }
  }
  return null
}

/**
 * Read a staircase, or report that the drawing does not show one.
 *
 * `strokes` are the candidate tread lines — thin strokes from the INK mask,
 * where a drawn line is one stroke. They must not come from an edge mask,
 * where a single drawn line becomes two parallel edges two pixels apart and
 * every line in the drawing therefore looks like a two-tread flight.
 * `context` is everything else the drawing contains, used for the stringers
 * and the direction arrow.
 *
 * A regular row of parallel strokes is NOT enough. A published plan is full of
 * them: planting symbols, furniture hatches, louvres, paving. Emitting the
 * longest such row as "the staircase" is how a reconstruction ends up with a
 * flight where a shrub is, and it is a worse failure than reporting nothing,
 * because nothing can be recovered from downstream while a confident wrong
 * answer cannot be argued with.
 *
 * So a run is only read as a stair when the drawing shows something that only
 * a stair has:
 *
 *  - a DIRECTION MARK up the flight, AND the run closed along both sides by a
 *    stringer, a wall or a handrail. The arrow alone is not enough: on a real
 *    plan a striped garden symbol produced a passable arrow, and only the
 *    missing sides gave it away.
 *  - or a WINDER — treads that fan rather than run parallel — with the run
 *    likewise closed along both sides. A hatch does not turn.
 *
 * Everything else comes back as a `rejected` candidate with its reason. Those
 * are kept and reported as evidence, because "the drawing has four regular
 * runs of strokes and none of them can be held to be the stair" is a finding,
 * and silence is not.
 */
export function readStair(strokes: readonly Segment[], imageSize: { width: number; height: number }, options: StairOptions = {}, context: readonly Segment[] = strokes): StairAnalysis {
  const opt = { ...DEFAULTS, ...options }
  const runs = treadRuns(strokes, imageSize, options, context)
  const rejected: Array<{ run: TreadRun; why: string }> = []

  const inside = (run: TreadRun): boolean => run.bounds.x0 >= opt.within.x0 && run.bounds.y0 >= opt.within.y0 && run.bounds.x1 <= opt.within.x1 && run.bounds.y1 <= opt.within.y1

  const qualified = runs
    .map((run) => ({ run, direction: stairDirection(run, context) }))
    .filter((c) => {
      if (!inside(c.run)) {
        rejected.push({ run: c.run, why: 'it lies outside the extent of the drawing\u2019s own wall bands, and a staircase is inside a building — terrain hatch, paving and planting are what lie outside it' })
        return false
      }
      const bounded = c.run.stringers >= 2
      const turns = c.run.angleSpreadDeg > opt.turnThresholdDeg
      if (bounded && (c.direction || turns)) return true
      rejected.push({
        run: c.run,
        why: !bounded
          ? `${c.direction ? 'an arrow was found on it, but' : 'no arrow was found, and'} its run is closed along ${c.run.stringers} of its 2 sides, so nothing holds the ends of its strokes the way a stringer, a wall or a handrail holds a flight's`
          : 'the run is bounded on both sides but carries neither a direction arrow nor a turn, so nothing distinguishes it from a hatch or a planting symbol',
      })
      return false
    })

  if (qualified.length === 0) return { stair: null, rejected }
  // A marked stair outranks an inferred one, then the longer run.
  qualified.sort((a, b) => Number(Boolean(b.direction)) - Number(Boolean(a.direction)) || b.run.treads.length - a.run.treads.length)
  const { run, direction } = qualified[0]
  const first = run.walkingLine[0]
  const last = run.walkingLine[run.walkingLine.length - 1]
  const stair: StairReading = {
    run,
    direction,
    directionAlternatives: direction
      ? []
      : [
          { head: last, tail: first, why: 'the flight could climb towards the far end of the walking line' },
          { head: first, tail: last, why: 'or towards the near end; the drawing carries no arrowhead to settle it' },
        ],
  }
  return { stair, rejected }
}

/** Every run found, for a plan that shows more than one stair. */
export const allStairRuns = treadRuns
