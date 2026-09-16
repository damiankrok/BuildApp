/**
 * Decomposing a floor plan into the masses a building is actually made of.
 *
 * The stage this replaces took the outermost dimension on each axis, drew a
 * rectangle, and called it the building. That is wrong in a way no amount of
 * later numeric fitting can repair: a house with an attached garage set back
 * from the street is not a rectangle, and once the rectangle exists every
 * subsequent decision — which walls, which storeys, which roof — is a decision
 * about the wrong object.
 *
 * The replacement reads the plan as a grid of structural cells:
 *
 *  1. **Grid lines** come from two independent sources. The dimension chains
 *     give exact METRIC breakpoints — the positions where the draughtsman said
 *     one measurement ends and the next begins — and the wall bands give the
 *     DRAWN structure. The two do not coincide to the pixel and should not:
 *     a witness line is struck on a wall's FACE, a band's axis runs down its
 *     CENTRE. They are matched within a wall's thickness, the chain's position
 *     is kept because the chain is the metric authority, and the band's is
 *     kept beside it because that is where the ink actually is.
 *  2. **Cells** are the rectangles between consecutive lines.
 *  3. **Each grid edge gets a closure**: how much of it is shut, by a wall
 *     band or — a glazed wall is still a wall — by an unbroken thin line.
 *  4. **A flood fill over the cells** decides what is inside. Flooding cells
 *     rather than pixels is what makes doorways survive: a 0.9 m doorway in a
 *     5 m wall leaves that wall 82% shut, and 82% shut is shut, whereas a
 *     pixel fill pours straight through it and drowns the whole interior.
 *  5. **Adjacent cells of one class merge** into maximal rectangles, which are
 *     the masses.
 *
 * The result CAN be a single rectangle — when the evidence says so — and is
 * not one otherwise. Nothing here knows the name of any project, and nothing
 * here carries a dimension of any real building.
 */
import { round6 } from '@buildapp/source-common'
import type { PixelRect } from '@buildapp/source-common'
import type { Band, Mask } from '@buildapp/source-cv'
import type { CoordinateRegistration, DimensionChain } from '@buildapp/source-metrics'

/** Where a grid line came from. The two kinds are independent, and a line with both is as certain as a plan gets. */
export type GridLineSupport = {
  /** Chains whose segment boundaries fall on this line. */
  chainIds: string[]
  /**
   * The longest span, in pixels, of any chain that breaks here.
   *
   * A plan carries chains at several depths — one across the whole building,
   * one along a wing, one from a door to a corner — and they state different
   * KINDS of thing. Two lines a few centimetres apart, each with a printed
   * number on it, are told apart by which of them the longer chain broke at,
   * because the chain that measures more of the building is the one stating
   * structure rather than detail.
   */
  chainSpanPx: number
  /** Of those, the chains that had a number PRINTED on the segment, rather than deriving it from their own scale. */
  printedChainIds: string[]
  /** Wall bands whose axis lies on this line, by total length in pixels. */
  bandLength: number
  /** How much of the plan's extent the supporting bands span. */
  bandCoverage: number
}

export type GridLine = {
  axis: 'X' | 'Y'
  /** Position in the frame's pixels — the chain's, when a chain states one, because the chain is what the metre reading is attached to. */
  px: number
  /**
   * Every raw position that merged into this line, ascending. A witness line
   * and a wall axis are half a wall apart, so asking "is there ink on this
   * line" has to be asked at both.
   */
  probesPx: number[]
  support: GridLineSupport
  /** 0..1. */
  confidence: number
  why: string
}

export type CellClass = 'BUILT' | 'RECESS' | 'OUTSIDE'

/** How shut one edge of one cell is, and what shuts it. */
export type EdgeClosure = {
  /** Fraction covered by wall bands. */
  wall: number
  /** Fraction covered by continuous ink of any weight — glazing, a thin contour, a balustrade. */
  line: number
  /** The two combined: what the flood fill is stopped by. */
  closure: number
}

export type PlanCell = {
  ix: number
  iy: number
  rect: PixelRect
  classification: CellClass
  /** Closure of each edge, in order: top, right, bottom, left. */
  edges: [EdgeClosure, EdgeClosure, EdgeClosure, EdgeClosure]
  /** True when the flood fill could not reach this cell from outside the plan. */
  enclosed: boolean
  /** Ink inside the cell that is not wall: furniture, hatching, annotation. */
  interiorInk: number
  confidence: number
  why: string
}

export type PlanRegion = {
  id: string
  classification: CellClass
  /** In the frame's pixels. */
  rect: PixelRect
  /** In metres, in the registration's plane. */
  metric: { x0: number; z0: number; x1: number; z1: number }
  cells: Array<{ ix: number; iy: number }>
  confidence: number
  why: string
}

/**
 * The box the building's walls occupy.
 *
 * Distinct from the dimensioned extent, which usually reaches past the walls
 * to an eaves line, a terrace edge or a plot boundary — the outer segments of
 * a depth chain are very often a zone in front and a zone behind rather than
 * part of the building at all. The envelope is where the WALLS are, and a mass
 * that falls outside it is a paving pattern the flood fill happened to find a
 * ring around.
 */
export type WalledEnvelope = {
  rect: PixelRect
  metric: { x0: number; z0: number; x1: number; z1: number }
  /** How many wall bands on each axis it was taken from. */
  bands: { vertical: number; horizontal: number }
  why: string
}

export type PlanDecomposition = {
  frameId: string
  /** The wall thickness the plan's own bands imply, in pixels and in metres. */
  wallThickness: { px: number; m: number }
  /** The box the wall bands occupy, or null when no wall was found on one of the axes. */
  envelope: WalledEnvelope | null
  linesX: GridLine[]
  linesY: GridLine[]
  cells: PlanCell[]
  regions: PlanRegion[]
  /** The dimensioned extent the decomposition was cut from, in pixels. */
  extent: PixelRect
  /** Named things the decomposition could not settle. */
  unresolved: Array<{ what: string; reason: string }>
}

export type PlanDecompositionOptions = {
  /** Two candidate lines of the SAME kind closer than this are one line. */
  snapPx?: number
  /** A band shorter than this fraction of the plan's extent does not make a grid line on its own. */
  minBandCoverage?: number
  /** Closure at or above which an edge stops the flood fill. */
  closureThreshold?: number
  /** Ink density above which a cell is considered to contain drawn content. */
  contentInk?: number
  /** Smallest cell worth keeping, in metres. */
  minCellM?: number
  /** Fallback wall thickness in pixels, used only when no band is thick enough to measure one. */
  fallbackWallPx?: number
  /** Shortest unbroken stretch of line work worth believing, in pixels. */
  minLinePx?: number
}

const DEFAULTS: Required<PlanDecompositionOptions> = {
  snapPx: 5,
  minBandCoverage: 0.18,
  closureThreshold: 0.62,
  contentInk: 0.02,
  minCellM: 0.45,
  fallbackWallPx: 12,
  minLinePx: 18,
}

const at = (m: Mask, x: number, y: number): number => (x < 0 || y < 0 || x >= m.width || y >= m.height ? 0 : m.data[y * m.width + x])

/**
 * The wall thickness this plan is drawn at, from the bands themselves.
 *
 * Length-weighted, because the longest bands are the ones most likely to be
 * walls rather than a heavy piece of furniture, and a median rather than a
 * mean because one very thick band — a hatched section cut, a filled column —
 * should not move it.
 */
export function bandWallThickness(bands: readonly Band[], fallbackPx: number): number {
  const weighted: Array<{ t: number; w: number }> = bands.filter((b) => b.length > 0).map((b) => ({ t: b.thickness, w: b.length }))
  if (weighted.length === 0) return fallbackPx
  weighted.sort((a, b) => a.t - b.t)
  const half = weighted.reduce((a, b) => a + b.w, 0) / 2
  let run = 0
  for (const entry of weighted) {
    run += entry.w
    if (run >= half) return entry.t
  }
  return weighted[weighted.length - 1].t
}

type RawLine = { px: number; support: GridLineSupport; probes: number[] }

/**
 * The grid lines a plan's own evidence supports.
 *
 * A chain segment boundary is a metric statement; a wall band axis is a drawn
 * one. Chains are collected first and keep their positions, because a
 * dimension is the only thing on the sheet that states a length; bands then
 * join the chain line they are within a wall's thickness of, or stand as their
 * own line when there is no chain near them.
 */
export function gridLines(
  chains: readonly DimensionChain[],
  bands: readonly Band[],
  extent: PixelRect,
  options: PlanDecompositionOptions = {},
): { linesX: GridLine[]; linesY: GridLine[] } {
  const opt = { ...DEFAULTS, ...options }
  const spanX = Math.max(1, extent.x1 - extent.x0)
  const spanY = Math.max(1, extent.y1 - extent.y0)

  const collect = (axis: 'X' | 'Y'): GridLine[] => {
    const span = axis === 'X' ? spanX : spanY
    const low = (axis === 'X' ? extent.x0 : extent.y0) - opt.snapPx
    const high = (axis === 'X' ? extent.x1 : extent.y1) + opt.snapPx
    const raw: RawLine[] = []
    const nearest = (px: number, tolerance: number): RawLine | undefined => {
      let best: RawLine | undefined
      let bestGap = tolerance
      for (const line of raw) {
        const gap = Math.abs(line.px - px)
        if (gap <= bestGap) {
          best = line
          bestGap = gap
        }
      }
      return best
    }

    // --- chains first: they carry the metric, so they keep their positions ---
    for (const chain of chains) {
      const runsAlong = (chain.axis === 'HORIZONTAL') === (axis === 'X')
      if (!runsAlong) continue
      const chainSpan = Math.max(...chain.ticksPx) - Math.min(...chain.ticksPx)
      for (const segment of chain.segments) {
        // A span nothing was read on and nothing derived is a tick the chain
        // itself does not believe.
        if (segment.valueCm === undefined) continue
        const printed = segment.origin === 'READ' || segment.origin === 'CHAIN_CORRECTED'
        for (const px of [segment.fromPx, segment.toPx]) {
          if (px < low || px > high) continue
          const held = nearest(px, opt.snapPx)
          const line = held ?? { px: round6(px), support: { chainIds: [], printedChainIds: [], chainSpanPx: 0, bandLength: 0, bandCoverage: 0 }, probes: [round6(px)] }
          if (!held) raw.push(line)
          if (!line.support.chainIds.includes(chain.id)) line.support.chainIds.push(chain.id)
          if (printed && !line.support.printedChainIds.includes(chain.id)) line.support.printedChainIds.push(chain.id)
          line.support.chainSpanPx = Math.max(line.support.chainSpanPx, round6(chainSpan))
          if (!line.probes.some((p) => Math.abs(p - px) <= 1)) line.probes.push(round6(px))
        }
      }
    }

    // --- then the bands, which join the chain line they belong to ------------
    for (const band of bands) {
      const across = (band.axis === 'VERTICAL') === (axis === 'X')
      if (!across) continue
      const px = band.axisPx
      if (px < low || px > high) continue
      // A witness line is struck on a wall's FACE and a band's axis runs down
      // its CENTRE, so a band belongs to a chain line that sits on its axis OR
      // on either of its faces. Where several chains break inside one wall —
      // an overall dimension to the outside of it and a room dimension to the
      // inside — the one that measures more of the building takes the band,
      // because that is the line the building's own outline follows and the
      // other is a note about a room.
      const faces = axis === 'X' ? [band.bounds.x0, band.bounds.x1] : [band.bounds.y0, band.bounds.y1]
      const window = Math.max(opt.snapPx, band.thickness * 0.75)
      const faceWindow = Math.max(opt.snapPx, band.thickness * 0.35)
      const claimants = raw.filter((l) => Math.abs(l.px - px) <= window || faces.some((f) => Math.abs(l.px - f) <= faceWindow))
      claimants.sort((a, b) => b.support.chainSpanPx - a.support.chainSpanPx || Math.abs(a.px - px) - Math.abs(b.px - px) || a.px - b.px)
      const held = claimants[0] ?? nearest(px, window)
      const line = held ?? { px: round6(px), support: { chainIds: [], printedChainIds: [], chainSpanPx: 0, bandLength: 0, bandCoverage: 0 }, probes: [round6(px)] }
      if (!held) raw.push(line)
      line.support.bandLength += band.length
      line.support.bandCoverage = Math.min(1, line.support.bandLength / span)
      // A wall has two faces and an axis, and which of the three a drawing
      // hangs its openings off varies: a window is drawn across the wall, a
      // garage door along its inner face, a terrace edge along its outer one.
      // All three are recorded so that looking for ink on this line looks
      // where the ink of this wall actually is.
      for (const probe of [px, ...faces]) if (!line.probes.some((q) => Math.abs(q - probe) <= 1)) line.probes.push(round6(probe))
    }

    return raw
      .filter((line) => line.support.chainIds.length > 0 || line.support.bandCoverage >= opt.minBandCoverage)
      .map((line) => {
        const chain = line.support.chainIds.length > 0
        const printed = line.support.printedChainIds.length > 0
        const band = line.support.bandCoverage >= opt.minBandCoverage
        // A tick whose number was READ is a statement; a tick whose number the
        // chain worked out from its own scale is an inference, and an
        // inference must not outrank the statement it was inferred from —
        // which is exactly what happens when a detail chain inside a room
        // carries a wall band and the overall chain across the sheet does not.
        const confidence = printed ? (band ? 0.95 : 0.8) : chain ? (band ? 0.75 : 0.5) : 0.6
        return {
          axis,
          px: round6(line.px),
          probesPx: [...line.probes].sort((a, b) => a - b),
          support: { ...line.support, bandCoverage: round6(line.support.bandCoverage) },
          confidence,
          why: chain && band
            ? `a dimension chain breaks here and a wall band ${Math.round(line.support.bandLength)} px long lies on it`
            : chain
              ? `${line.support.chainIds.length} dimension chain${line.support.chainIds.length === 1 ? '' : 's'} break here, with no wall drawn on the line`
              : `a wall band ${Math.round(line.support.bandLength)} px long lies here, with no dimension breaking on it`,
        }
      })
      .sort((a, b) => a.px - b.px)
  }

  return { linesX: collect('X'), linesY: collect('Y') }
}

/**
 * Thin out lines that sit on top of one another, best-supported first.
 *
 * Taken in rank order rather than in position order, because a run of four
 * near-coincident candidates has to collapse onto the one the evidence is
 * strongest for — the printed dimension, not whichever of them happens to come
 * first along the axis. The losers hand over their probe positions, so the ink
 * they were drawn from is still looked at when edges are measured.
 */
function thinLines(lines: readonly GridLine[], minGapPx: number, probeGapPx: number): GridLine[] {
  const rank = (l: GridLine): number => l.confidence * 1e9 + Math.min(9999, l.support.chainSpanPx) * 1e3 + Math.min(999, l.support.bandLength)
  const order = [...lines].sort((a, b) => rank(b) - rank(a) || a.px - b.px)
  const kept: GridLine[] = []
  for (const line of order) {
    const clash = kept.find((k) => Math.abs(k.px - line.px) < minGapPx)
    if (clash) {
      // Only probes close enough to be the same piece of construction are
      // inherited: a line 40 cm away is a different wall, not another face of
      // this one, and probing there would measure the wrong ink.
      const merged = [...clash.probesPx, ...line.probesPx.filter((p) => Math.abs(p - clash.px) <= probeGapPx)]
      clash.probesPx = [...new Set(merged.map((p) => round6(p)))].sort((a, b) => a - b)
      continue
    }
    kept.push({ ...line, probesPx: [...line.probesPx] })
  }
  return kept.sort((a, b) => a.px - b.px)
}

/** The stretches of a grid line that wall bands lying on it cover. */
function wallIntervals(bands: readonly Band[], axis: 'X' | 'Y', line: GridLine, from: number, to: number, tolerance: number): Array<[number, number]> {
  const covered: Array<[number, number]> = []
  for (const band of bands) {
    const across = (band.axis === 'VERTICAL') === (axis === 'X')
    if (!across) continue
    // Compare against the band's extent across rather than its centre alone: a
    // wall drawn 18 px thick still shuts an edge falling anywhere inside it.
    const lo = axis === 'X' ? band.bounds.x0 : band.bounds.y0
    const hi = axis === 'X' ? band.bounds.x1 : band.bounds.y1
    if (!line.probesPx.some((p) => p >= lo - tolerance && p <= hi + tolerance)) continue
    const a = axis === 'X' ? band.bounds.y0 : band.bounds.x0
    const b = axis === 'X' ? band.bounds.y1 : band.bounds.x1
    const overlap: [number, number] = [Math.max(from, a), Math.min(to, b)]
    if (overlap[1] > overlap[0]) covered.push(overlap)
  }
  return covered
}

/** Overlapping probe windows merged, so a thick wall is scanned once rather than three times. */
function mergeWindows(windows: ReadonlyArray<readonly [number, number]>): Array<[number, number]> {
  const sorted = [...windows].map(([a, b]) => [a, b] as [number, number]).sort((p, q) => p[0] - q[0])
  const out: Array<[number, number]> = []
  for (const [a, b] of sorted) {
    const last = out[out.length - 1]
    if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b)
    else out.push([a, b])
  }
  return out
}

/** Total length of a set of possibly overlapping intervals. */
function unionLength(intervals: Array<[number, number]>): number {
  intervals.sort((p, q) => p[0] - q[0])
  let total = 0
  let reach = -Infinity
  for (const [a, b] of intervals) {
    const start = Math.max(a, reach)
    if (b > start) total += b - start
    reach = Math.max(reach, b)
  }
  return total
}

/**
 * The stretches of a grid line that drawn LINE work shuts.
 *
 * A fully glazed wall, a balustrade, the thin outline of a terrace: none of
 * them are wall bands, all of them are the building's edge, and without them a
 * flood fill walks through a picture window and reports the living room as
 * garden.
 *
 * What counts is CONTINUITY. Ink beside the line at one point means nothing —
 * a plan is full of furniture, hatching and a printer's watermark, and every
 * one of them touches some line somewhere. Ink beside the line for an unbroken
 * stretch longer than a wall is thick is a drawn edge, so only runs that long
 * are returned and everything shorter is dropped on the floor.
 *
 * Measured over the WHOLE line and clipped afterwards, never per cell edge.
 * Continuity belongs to the drawing; a cell boundary that happens to cut a
 * long stroke in two does not make either half less continuous, and measuring
 * inside the cell would call both halves noise.
 */
function lineIntervals(mask: Mask, axis: 'X' | 'Y', line: GridLine, from: number, to: number, tolerance: number, minRun: number): Array<[number, number]> {
  const a = Math.max(0, Math.round(from))
  const b = Math.min((axis === 'X' ? mask.height : mask.width) - 1, Math.round(to))
  const covered: Array<[number, number]> = []
  if (b <= a) return covered
  const probes = mergeWindows(line.probesPx.map((p) => [Math.round(p - tolerance), Math.round(p + tolerance)] as const))
  let run = -1
  for (let t = a; t <= b + 1; t += 1) {
    let found = false
    if (t <= b) {
      for (const [lo, hi] of probes) {
        for (let s2 = lo; s2 <= hi; s2 += 1) {
          if (at(mask, axis === 'X' ? s2 : t, axis === 'X' ? t : s2) === 1) {
            found = true
            break
          }
        }
        if (found) break
      }
    }
    if (found) {
      if (run < 0) run = t
    } else if (run >= 0) {
      if (t - run >= minRun) covered.push([run, t])
      run = -1
    }
  }
  return covered
}

/** Ink inside a rectangle that is not part of a wall band: furniture, hatching, annotation, a room number. */
function interiorInk(mask: Mask, bands: readonly Band[], rect: PixelRect): number {
  const inset = 3
  const x0 = Math.round(rect.x0) + inset
  const x1 = Math.round(rect.x1) - inset
  const y0 = Math.round(rect.y0) + inset
  const y1 = Math.round(rect.y1) - inset
  if (x1 <= x0 || y1 <= y0) return 0
  const inBand = (x: number, y: number): boolean =>
    bands.some((b) => x >= b.bounds.x0 - 1 && x <= b.bounds.x1 + 1 && y >= b.bounds.y0 - 1 && y <= b.bounds.y1 + 1)
  let ink = 0
  let total = 0
  // Sample rather than scan: a cell can be a quarter of the sheet.
  const step = Math.max(1, Math.floor(Math.min(x1 - x0, y1 - y0) / 48))
  for (let y = y0; y <= y1; y += step) {
    for (let x = x0; x <= x1; x += step) {
      total += 1
      if (at(mask, x, y) === 1 && !inBand(x, y)) ink += 1
    }
  }
  return round6(total === 0 ? 0 : ink / total)
}

/**
 * One edge's closure, from the wall it is built of and the line work drawn on it.
 *
 * The two are unioned rather than maxed, because half a wall and half a
 * window in line with each other make one shut edge, and taking the larger of
 * the halves would call it half open.
 */
function closureOf(walls: ReadonlyArray<readonly [number, number]>, lines: ReadonlyArray<readonly [number, number]>, from: number, to: number): EdgeClosure {
  const span = Math.max(1, to - from)
  const clip = (intervals: ReadonlyArray<readonly [number, number]>): Array<[number, number]> => {
    const out: Array<[number, number]> = []
    for (const [a, b] of intervals) {
      const lo = Math.max(a, from)
      const hi = Math.min(b, to)
      if (hi > lo) out.push([lo, hi])
    }
    return out
  }
  const w = clip(walls)
  const l = clip(lines)
  return {
    wall: round6(Math.min(1, unionLength([...w]) / span)),
    line: round6(Math.min(1, unionLength([...l]) / span)),
    closure: round6(Math.min(1, unionLength([...w, ...l]) / span)),
  }
}

/**
 * The stretch of each axis a plan's dimensions actually speak about.
 *
 * The widest chain that READ something wins its axis. A chain whose every
 * segment was derived is a row of ticks the reader found and could not
 * interpret, and letting one of those set the extent hands the decomposition a
 * frame reaching out to a north arrow or a scale bar. Where no chain read
 * anything at all, nothing is returned and the caller has to say so.
 */
export function dimensionedExtent(chains: readonly DimensionChain[]): PixelRect | null {
  const pick = (axis: 'HORIZONTAL' | 'VERTICAL'): { lo: number; hi: number } | null => {
    let best: { lo: number; hi: number } | null = null
    for (const chain of chains) {
      if (chain.axis !== axis) continue
      const read = chain.segments.filter((seg) => seg.origin === 'READ' || seg.origin === 'CHAIN_CORRECTED')
      if (read.length === 0) continue
      // A chain's outermost segments are often not segments at all: a witness
      // line struck a centimetre past the last one, the end of the rule, a
      // tick belonging to a different chain that happened to be collinear. One
      // the chain could not read AND which is far shorter than the shortest it
      // could is not a span of the building, and letting it set the frame adds
      // a strip of nothing to whichever end it is on.
      const floor = Math.min(...read.map((seg) => seg.pixelLength)) * 0.5
      const segments = [...chain.segments].sort((a, b) => a.fromPx - b.fromPx)
      let first = 0
      let last = segments.length - 1
      while (first <= last && segments[first].origin !== 'READ' && segments[first].origin !== 'CHAIN_CORRECTED' && segments[first].pixelLength < floor) first += 1
      while (last >= first && segments[last].origin !== 'READ' && segments[last].origin !== 'CHAIN_CORRECTED' && segments[last].pixelLength < floor) last -= 1
      if (first > last) continue
      const lo = segments[first].fromPx
      const hi = segments[last].toPx
      if (!best || hi - lo > best.hi - best.lo) best = { lo, hi }
    }
    return best
  }
  const x = pick('HORIZONTAL')
  const y = pick('VERTICAL')
  if (!x || !y) return null
  return { x0: round6(x.lo), y0: round6(y.lo), x1: round6(x.hi), y1: round6(y.hi) }
}

/**
 * Bands long enough to be walls rather than a step, a pier, a bush or a piece
 * of furniture.
 *
 * Two and a half wall thicknesses. Generous on purpose: an exterior wall with
 * two wide windows in it survives as three short pieces, and the piece between
 * the windows is the only evidence that side of the building has a wall at
 * all. What this has to exclude is the drawn furniture of a sheet, which is
 * small in a different way — a kerb, a bush, a bath — and a threshold set to
 * exclude a broken wall as well would lose the wall.
 */
const longBands = (bands: readonly Band[], wallPx: number): Band[] => bands.filter((b) => b.length >= wallPx * 2.5)

/** The box the AXES of a set of bands span, taken out to the walls' outer faces. Null unless both orientations are present. */
function axisBox(bands: readonly Band[], wallPx: number): PixelRect | null {
  const vertical = bands.filter((b) => b.axis === 'VERTICAL').map((b) => b.axisPx)
  const horizontal = bands.filter((b) => b.axis === 'HORIZONTAL').map((b) => b.axisPx)
  if (vertical.length === 0 || horizontal.length === 0) return null
  const half = wallPx / 2
  return {
    x0: round6(Math.min(...vertical) - half),
    x1: round6(Math.max(...vertical) + half),
    y0: round6(Math.min(...horizontal) - half),
    y1: round6(Math.max(...horizontal) + half),
  }
}

/**
 * The frame of the plan to decompose.
 *
 * Two candidates, and they check each other. The dimension chains draw one
 * frame, and where the chains are good it is the better of the two because it
 * is metric. The wall bands draw another, and where the chains are sparse — an
 * upper-storey plan is very often dimensioned only where it differs from the
 * one below — the chain frame covers a corner of the building and calling it
 * the building would throw the rest away.
 *
 * So the walls vote. If most of the wall that was found lies inside the chain
 * frame, the chains are describing this building and the frame is theirs,
 * widened to whatever wall pokes out of it. If most of it lies outside, the
 * chains are describing a detail of it, the frame is the walls', and the
 * result is marked weak so that nothing downstream mistakes it for a metric
 * statement.
 */
export function planExtent(chains: readonly DimensionChain[], bands: readonly Band[], wallPx: number): { rect: PixelRect; weak: boolean; why: string } | null {
  const long = longBands(bands, wallPx)
  const chainRect = dimensionedExtent(chains)
  const fromBands = axisBox(long, wallPx)
  if (!chainRect) {
    if (!fromBands) return null
    return { rect: fromBands, weak: true, why: `no dimension chain on this frame read a value, so the frame is the ${long.length} wall bands' own` }
  }
  const within = (b: Band, rect: PixelRect): boolean => {
    const axisPx = b.axisPx
    return b.axis === 'VERTICAL' ? axisPx >= rect.x0 && axisPx <= rect.x1 : axisPx >= rect.y0 && axisPx <= rect.y1
  }
  // Even when the chains only describe a corner of the plan they say WHERE on
  // the sheet the plan is, and a sheet carries other drawn matter — a title
  // block, a logo, a north arrow, a second small drawing — that has nothing to
  // do with this building. Bands more than a third of the chains' own span
  // away from them are that other matter.
  const margin = 0.35
  const near: PixelRect = {
    x0: chainRect.x0 - (chainRect.x1 - chainRect.x0) * margin,
    x1: chainRect.x1 + (chainRect.x1 - chainRect.x0) * margin,
    y0: chainRect.y0 - (chainRect.y1 - chainRect.y0) * margin,
    y1: chainRect.y1 + (chainRect.y1 - chainRect.y0) * margin,
  }
  const candidates = long.filter((b) => within(b, near))
  const inside = candidates.filter((b) => within(b, chainRect))
  const lengthOf = (list: readonly Band[]): number => list.reduce((a, b) => a + b.length, 0)
  const held = lengthOf(inside)
  const loose = lengthOf(candidates) - held
  const widen = (rect: PixelRect, other: PixelRect | null): PixelRect =>
    other ? { x0: Math.min(rect.x0, other.x0), y0: Math.min(rect.y0, other.y0), x1: Math.max(rect.x1, other.x1), y1: Math.max(rect.y1, other.y1) } : rect
  if (held >= loose) {
    return { rect: widen(chainRect, axisBox(inside, wallPx)), weak: false, why: `the dimension chains' own span, with ${Math.round(held)} px of the ${Math.round(held + loose)} px of wall found lying inside it` }
  }
  const nearBands = axisBox(candidates, wallPx) ?? fromBands
  return {
    rect: widen(chainRect, nearBands),
    weak: true,
    why: `${Math.round(loose)} px of the ${Math.round(held + loose)} px of wall found lies outside the dimension chains' span, so the chains describe a detail of this plan and not its extent`,
  }
}

/**
 * The box the wall bands occupy, snapped to the structural grid.
 *
 * Taken from the bands' AXES rather than their bounding boxes, because a band
 * is measured along its whole run and a run overshoots: a wall drawn past the
 * corner, a post standing out on a terrace, a right-hand wall whose ink
 * continues into a logo. An axis is a position and cannot overshoot, and half
 * a wall on either side of the outermost axes is the wall's own outer face.
 * The result is then snapped to the nearest grid line, because a dimension
 * chain states where that face is to the centimetre and a band estimates it.
 */
function walledEnvelope(
  bands: readonly Band[],
  linesX: readonly GridLine[],
  linesY: readonly GridLine[],
  wallPx: number,
  registration: CoordinateRegistration,
): WalledEnvelope | null {
  // Short bands are not walls. A bush, a step, a kerb and a pier are all drawn
  // in heavy ink and all of them sit outside the building, so an envelope
  // taken from every band there is reaches out to whichever of them is drawn
  // furthest away. A wall runs.
  const long = longBands(bands, wallPx)
  const box = axisBox(long, wallPx)
  if (!box) return null
  const vertical = long.filter((b) => b.axis === 'VERTICAL')
  const horizontal = long.filter((b) => b.axis === 'HORIZONTAL')
  const snap = (px: number, lines: readonly GridLine[]): number => {
    let best = px
    let gap = wallPx
    for (const line of lines) {
      const d = Math.abs(line.px - px)
      if (d < gap) {
        gap = d
        best = line.px
      }
    }
    return best
  }
  const rect: PixelRect = { x0: snap(box.x0, linesX), x1: snap(box.x1, linesX), y0: snap(box.y0, linesY), y1: snap(box.y1, linesY) }
  // One wall line on an axis gives a box with no thickness. That is not a
  // small envelope, it is the absence of one, and reporting it as a rectangle
  // would have every cell of the plan fall outside the building.
  if (rect.x1 - rect.x0 < wallPx * 4 || rect.y1 - rect.y0 < wallPx * 4) return null
  const u0 = (rect.x0 - registration.originPx.x) * registration.metresPerPixelX
  const u1 = (rect.x1 - registration.originPx.x) * registration.metresPerPixelX
  const v0 = (rect.y0 - registration.originPx.y) * registration.metresPerPixelY
  const v1 = (rect.y1 - registration.originPx.y) * registration.metresPerPixelY
  return {
    rect,
    metric: { x0: round6(Math.min(u0, u1)), z0: round6(Math.min(v0, v1)), x1: round6(Math.max(u0, u1)), z1: round6(Math.max(v0, v1)) },
    bands: { vertical: vertical.length, horizontal: horizontal.length },
    why: `the outermost of ${vertical.length} wall axes across and ${horizontal.length} along, taken to their outer faces and snapped to the dimension grid`,
  }
}

/**
 * Cut the plan into cells and say what each one is.
 *
 * The classification is three-way on purpose. BUILT and OUTSIDE are the
 * obvious cases; RECESS is the one that matters, because a porch, a loggia or
 * a recessed entrance is enclosed by the building on three sides and open on
 * the fourth, and a two-way classifier has to call it either a room — which
 * walls it in — or nothing — which deletes the most characteristic thing about
 * the facade. Giving it its own answer is what lets the solver build it as
 * topology later.
 */
export function decomposePlan(
  mask: Mask,
  chains: readonly DimensionChain[],
  bands: readonly Band[],
  registration: CoordinateRegistration,
  extent: PixelRect,
  options: PlanDecompositionOptions = {},
): PlanDecomposition {
  const opt = { ...DEFAULTS, ...options }
  // A band counts as this building's only when its AXIS falls inside the
  // dimensioned extent and most of its run does too. A sheet carries a north
  // arrow, a title block and a printer's logo, all of them drawn in heavy ink,
  // and none of them are walls.
  const inside = bands.filter((b) => {
    const axisPx = b.axisPx
    const withinAxis = b.axis === 'VERTICAL' ? axisPx >= extent.x0 && axisPx <= extent.x1 : axisPx >= extent.y0 && axisPx <= extent.y1
    if (!withinAxis) return false
    const lo = b.axis === 'VERTICAL' ? Math.max(b.bounds.y0, extent.y0) : Math.max(b.bounds.x0, extent.x0)
    const hi = b.axis === 'VERTICAL' ? Math.min(b.bounds.y1, extent.y1) : Math.min(b.bounds.x1, extent.x1)
    const total = b.axis === 'VERTICAL' ? b.bounds.y1 - b.bounds.y0 : b.bounds.x1 - b.bounds.x0
    return total > 0 && (hi - lo) / total >= 0.6
  })
  const wallPx = bandWallThickness(inside, opt.fallbackWallPx)
  const mppX = registration.metresPerPixelX
  const mppY = registration.metresPerPixelY
  const wallM = round6(wallPx * Math.max(mppX, mppY))
  const all = gridLines(chains, inside, extent, options)
  const unresolved: PlanDecomposition['unresolved'] = []

  const minCellPx = opt.minCellM / Math.max(mppX, mppY)
  const linesX = thinLines(all.linesX, minCellPx, wallPx)
  const linesY = thinLines(all.linesY, minCellPx, wallPx)
  const envelope = walledEnvelope(inside, linesX, linesY, wallPx, registration)
  if (envelope === null) {
    unresolved.push({
      what: 'the extent of this building\u2019s walls',
      reason: 'no wall band runs along one of the two axes, so there is nothing to take an outer face from',
    })
  }
  if (linesX.length < 2 || linesY.length < 2) {
    unresolved.push({
      what: 'a structural grid for this plan',
      reason: `only ${linesX.length} vertical and ${linesY.length} horizontal lines are supported by a dimension chain or a wall band`,
    })
    return { frameId: registration.frameId, wallThickness: { px: round6(wallPx), m: wallM }, envelope, linesX, linesY, cells: [], regions: [], extent, unresolved }
  }

  const nx = linesX.length - 1
  const ny = linesY.length - 1
  const tolerance = Math.max(4, wallPx * 0.6)
  const lineTolerance = Math.max(3, wallPx * 0.35)

  // --- closures of every edge of the grid, computed once ---
  // vEdge[ix][iy] is the vertical edge on line ix beside cell row iy.
  const topY = linesY[0].px
  const bottomY = linesY[ny].px
  const leftX = linesX[0].px
  const rightX = linesX[nx].px
  const vEdge: EdgeClosure[][] = []
  for (let ix = 0; ix <= nx; ix += 1) {
    const walls = wallIntervals(inside, 'X', linesX[ix], topY, bottomY, tolerance)
    const drawn = lineIntervals(mask, 'X', linesX[ix], topY, bottomY, lineTolerance, opt.minLinePx)
    const column: EdgeClosure[] = []
    for (let iy = 0; iy < ny; iy += 1) column.push(closureOf(walls, drawn, linesY[iy].px, linesY[iy + 1].px))
    vEdge.push(column)
  }
  const hEdge: EdgeClosure[][] = []
  for (let iy = 0; iy <= ny; iy += 1) {
    const walls = wallIntervals(inside, 'Y', linesY[iy], leftX, rightX, tolerance)
    const drawn = lineIntervals(mask, 'Y', linesY[iy], leftX, rightX, lineTolerance, opt.minLinePx)
    const row: EdgeClosure[] = []
    for (let ix = 0; ix < nx; ix += 1) row.push(closureOf(walls, drawn, linesX[ix].px, linesX[ix + 1].px))
    hEdge.push(row)
  }

  // --- flood fill over the CELLS, from outside the plan inwards ---
  const reached = new Uint8Array(nx * ny)
  const index = (ix: number, iy: number): number => iy * nx + ix
  const open = (c: EdgeClosure): boolean => c.closure < opt.closureThreshold
  const queue: Array<[number, number]> = []
  const push = (ix: number, iy: number): void => {
    if (ix < 0 || iy < 0 || ix >= nx || iy >= ny) return
    if (reached[index(ix, iy)] === 1) return
    reached[index(ix, iy)] = 1
    queue.push([ix, iy])
  }
  // Anything beyond the walls is outside by construction, whatever ring of
  // paving, planting or plot boundary happens to be drawn around it. This is
  // what stops a front zone under the eaves from reading as a room.
  if (envelope) {
    for (let iy = 0; iy < ny; iy += 1) {
      for (let ix = 0; ix < nx; ix += 1) {
        const cx = (linesX[ix].px + linesX[ix + 1].px) / 2
        const cy = (linesY[iy].px + linesY[iy + 1].px) / 2
        if (cx < envelope.rect.x0 || cx > envelope.rect.x1 || cy < envelope.rect.y0 || cy > envelope.rect.y1) push(ix, iy)
      }
    }
  }
  for (let iy = 0; iy < ny; iy += 1) {
    if (open(vEdge[0][iy])) push(0, iy)
    if (open(vEdge[nx][iy])) push(nx - 1, iy)
  }
  for (let ix = 0; ix < nx; ix += 1) {
    if (open(hEdge[0][ix])) push(ix, 0)
    if (open(hEdge[ny][ix])) push(ix, ny - 1)
  }
  while (queue.length > 0) {
    const [ix, iy] = queue.pop() as [number, number]
    if (open(vEdge[ix][iy])) push(ix - 1, iy)
    if (open(vEdge[ix + 1][iy])) push(ix + 1, iy)
    if (open(hEdge[iy][ix])) push(ix, iy - 1)
    if (open(hEdge[iy + 1][ix])) push(ix, iy + 1)
  }

  // --- classify ---
  const cells: PlanCell[] = []
  for (let iy = 0; iy < ny; iy += 1) {
    for (let ix = 0; ix < nx; ix += 1) {
      const rect: PixelRect = { x0: linesX[ix].px, y0: linesY[iy].px, x1: linesX[ix + 1].px, y1: linesY[iy + 1].px }
      const edges: PlanCell['edges'] = [hEdge[iy][ix], vEdge[ix + 1][iy], hEdge[iy + 1][ix], vEdge[ix][iy]]
      const enclosed = reached[index(ix, iy)] === 0
      const shut = edges.filter((e) => e.closure >= opt.closureThreshold).length
      const content = interiorInk(mask, inside, rect)
      let classification: CellClass
      let why: string
      if (enclosed) {
        classification = 'BUILT'
        why = `no way in from outside the plan; ${shut} of its four edges are shut`
      } else if (shut >= 3 && envelope !== null && rect.x0 >= envelope.rect.x0 && rect.x1 <= envelope.rect.x1 && rect.y0 >= envelope.rect.y0 && rect.y1 <= envelope.rect.y1) {
        classification = 'RECESS'
        why = `open to the outside but shut on ${shut} sides: a pocket in the building rather than a room`
      } else {
        classification = 'OUTSIDE'
        why = `reachable from outside the plan with only ${shut} shut edge${shut === 1 ? '' : 's'}`
      }
      cells.push({
        ix,
        iy,
        rect,
        classification,
        edges,
        enclosed,
        interiorInk: content,
        confidence: round6(Math.min(0.95, 0.4 + 0.12 * shut + (enclosed ? 0.12 : 0) + (content >= opt.contentInk ? 0.05 : 0))),
        why,
      })
    }
  }

  // A recess is a pocket IN a building, so the building has to be around it.
  // Two tests, and a cell has to survive both. It must have built neighbours
  // on at least two of its shut sides — otherwise it is a patch of ground
  // that a dimension line, a watermark and the sheet's edge happen to have
  // boxed in — and those sides must not be opposite each other, because a gap
  // running clean between two parts of a building is a passage between them
  // and not a pocket in either.
  const byKey = new Map(cells.map((c) => [`${c.ix}:${c.iy}`, c]))
  const builtSides = (cell: PlanCell): boolean[] => {
    const neighbours: Array<[number, number]> = [
      [cell.ix, cell.iy - 1],
      [cell.ix + 1, cell.iy],
      [cell.ix, cell.iy + 1],
      [cell.ix - 1, cell.iy],
    ]
    return neighbours.map(([jx, jy], side) => cell.edges[side].closure >= opt.closureThreshold && byKey.get(`${jx}:${jy}`)?.classification === 'BUILT')
  }
  for (const cell of cells) {
    if (cell.classification !== 'RECESS') continue
    const [top, right, bottom, left] = builtSides(cell)
    const count = [top, right, bottom, left].filter(Boolean).length
    if (count < 2) {
      cell.classification = 'OUTSIDE'
      cell.why = `shut on ${cell.edges.filter((e) => e.closure >= opt.closureThreshold).length} sides but with the building on only ${count} of them: ground that happens to be boxed in, not a pocket`
    } else if (count === 2 && ((top && bottom) || (left && right))) {
      cell.classification = 'OUTSIDE'
      cell.why = 'the building is on two opposite sides of it: a gap between parts of the building, not a pocket in one'
    }
  }

  const regions = mergeRegions(cells, linesX, linesY, registration, nx, ny)
  if (regions.filter((r) => r.classification === 'BUILT').length === 0) {
    unresolved.push({ what: 'any built mass on this plan', reason: 'the flood fill reached every cell of the structural grid: no part of the plan is enclosed' })
  }
  return { frameId: registration.frameId, wallThickness: { px: round6(wallPx), m: wallM }, envelope, linesX, linesY, cells, regions, extent, unresolved }
}

/**
 * Merge adjacent cells of one class into maximal rectangles, biggest first.
 *
 * Reading order will not do here. Taken row by row, a one-cell-wide sliver in
 * the top row claims the whole column beneath it before the body of the
 * building is ever reached, and the house comes out as two strips instead of
 * one mass. Taking the largest rectangle first — largest by AREA ON THE SHEET,
 * not by cell count, since cells are whatever size the dimension chains made
 * them — puts the masses down before the offcuts. Ties are broken by position
 * so the answer is the same twice.
 */
function mergeRegions(
  cells: readonly PlanCell[],
  linesX: readonly GridLine[],
  linesY: readonly GridLine[],
  registration: CoordinateRegistration,
  nx: number,
  ny: number,
): PlanRegion[] {
  const byIndex = new Map(cells.map((c) => [`${c.ix}:${c.iy}`, c]))
  const claimed = new Set<string>()
  const regions: PlanRegion[] = []

  const toMetric = (rect: PixelRect): PlanRegion['metric'] => {
    const u0 = (rect.x0 - registration.originPx.x) * registration.metresPerPixelX
    const u1 = (rect.x1 - registration.originPx.x) * registration.metresPerPixelX
    const v0 = (rect.y0 - registration.originPx.y) * registration.metresPerPixelY
    const v1 = (rect.y1 - registration.originPx.y) * registration.metresPerPixelY
    return { x0: round6(Math.min(u0, u1)), z0: round6(Math.min(v0, v1)), x1: round6(Math.max(u0, u1)), z1: round6(Math.max(v0, v1)) }
  }
  const free = (ix: number, iy: number, klass: CellClass): boolean => {
    const cell = byIndex.get(`${ix}:${iy}`)
    return cell !== undefined && cell.classification === klass && !claimed.has(`${ix}:${iy}`)
  }
  const widthPx = (ix: number): number => linesX[ix + 1].px - linesX[ix].px
  const heightPx = (iy: number): number => linesY[iy + 1].px - linesY[iy].px

  for (;;) {
    let best: { ix: number; iy: number; w: number; h: number; area: number; klass: CellClass } | null = null
    for (let iy = 0; iy < ny; iy += 1) {
      for (let ix = 0; ix < nx; ix += 1) {
        const seed = byIndex.get(`${ix}:${iy}`)
        if (!seed || seed.classification === 'OUTSIDE' || claimed.has(`${ix}:${iy}`)) continue
        const klass = seed.classification
        let reach = nx - ix
        let spanY = 0
        for (let h = 1; iy + h <= ny; h += 1) {
          let run = 0
          while (run < reach && free(ix + run, iy + h - 1, klass)) run += 1
          reach = Math.min(reach, run)
          if (reach === 0) break
          spanY += heightPx(iy + h - 1)
          let spanX = 0
          for (let k = 0; k < reach; k += 1) spanX += widthPx(ix + k)
          const area = spanX * spanY
          if (!best || area > best.area + 1e-9) best = { ix, iy, w: reach, h, area, klass }
        }
      }
    }
    if (!best) break
    const members: Array<{ ix: number; iy: number }> = []
    for (let dy = 0; dy < best.h; dy += 1) {
      for (let dx = 0; dx < best.w; dx += 1) {
        claimed.add(`${best.ix + dx}:${best.iy + dy}`)
        members.push({ ix: best.ix + dx, iy: best.iy + dy })
      }
    }
    const rect: PixelRect = { x0: linesX[best.ix].px, y0: linesY[best.iy].px, x1: linesX[best.ix + best.w].px, y1: linesY[best.iy + best.h].px }
    const confidences = members.map((mm) => byIndex.get(`${mm.ix}:${mm.iy}`)?.confidence ?? 0)
    regions.push({
      id: `region-${best.klass.toLowerCase()}-${best.ix}-${best.iy}`,
      classification: best.klass,
      rect,
      metric: toMetric(rect),
      cells: members,
      confidence: round6(Math.min(...confidences)),
      why: `${members.length} adjacent ${best.klass.toLowerCase()} cell${members.length === 1 ? '' : 's'} merged`,
    })
  }
  return regions.sort((a, b) => (b.rect.x1 - b.rect.x0) * (b.rect.y1 - b.rect.y0) - (a.rect.x1 - a.rect.x0) * (a.rect.y1 - a.rect.y0) || a.id.localeCompare(b.id))
}
