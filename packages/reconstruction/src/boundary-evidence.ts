/**
 * The evidence a building's outline is made of (BUILDPLAN-ANALYZER-005C).
 *
 * The walled envelope used to be the box of a plan's long wall bands, and a
 * side of the building drawn as piers and glazing has no long band: the box
 * stopped inside the building, and everything past it was ground by
 * construction. The band reader is blind in the same place for a second
 * reason — a pier shorter than a band's minimum length, a corner block wider
 * than a band may be thick, is no band at all — so the jambs of the very
 * openings that made the facade short were invisible too.
 *
 * This module reads the outline's evidence from the ink itself, and from
 * nothing else:
 *
 *   - a WALL-SOLID LAYER: the ink mask opened by a third of a wall, so
 *     hairlines, text and hatching vanish and every wall-thick piece of ink
 *     stays, labelled. A piece whose component is no bigger than two and a
 *     half walls on both sides is a POST — a column, a planter corner, a tree
 *     symbol — and a post is never the jamb of an opening. Anything bigger is
 *     part of a WALL.
 *   - a WALL LINE: along one line of the plan, where the ink is wall-thick
 *     (pieces), and the gaps between them;
 *   - each GAP classified from what is drawn in it and around it:
 *       DRAWING_BREAK_SUPPORTED  a break no wider than half a wall inside solid
 *                                ink: the drawing, not the building
 *       OPENING_SUPPORTED        a gap between wall jambs with a door, glazing
 *                                or a vehicle door drawn across it, or a
 *                                callout printing its width
 *       UNKNOWN_GAP              a gap between wall jambs, no wider than a
 *                                lintel conventionally spans, with nothing
 *                                drawn across: a door or a recess mouth — the
 *                                boundary solver decides it by what lies
 *                                behind it, never by its width
 *       TRUE_EXTERIOR_GAP        the wall stops: a post, no jamb, a blank gap
 *                                wider than a lintel spans, a line that is only
 *                                dashed (an overhead element) or runs past the
 *                                jambs (paving)
 *
 * Boundary continuity and physical solid are kept apart: a bridged opening
 * closes the outline and stays an opening. Nothing here reads a line of
 * thin ink as wall, which is what keeps a terrace outline, a paving edge or a
 * watermark from enclosing anything.
 *
 * Every threshold is a multiple of the sheet's own wall thickness or one of
 * the pipeline's existing conventions (the 3.2 m lintel, the 8 m ceiling, the
 * pocket rule); nothing here knows any building.
 */
import { round6 } from '@buildapp/source-common'
import type { PixelRect } from '@buildapp/source-common'
import { dilate, erode } from '@buildapp/source-cv'
import type { Mask } from '@buildapp/source-cv'

export const BOUNDARY_EVIDENCE_VERSION = '1.0.0'

/** One connected piece of wall-thick ink. */
export type SolidPart = { id: number; bounds: PixelRect; pixels: number; kind: 'WALL' | 'POST' }

/** The ink mask opened by a third of a wall, labelled. */
export type SolidLayer = {
  width: number
  height: number
  /** The opening radius, in pixels: a third of the sheet's wall. */
  radius: number
  wallPx: number
  /** Per pixel, the id of its part plus one; 0 where there is no wall-thick ink. */
  labels: Int32Array
  parts: SolidPart[]
}

/**
 * Open the mask by a third of a wall and label what survives.
 *
 * The radius comes from the SHEET's wall thickness, never from a wall
 * re-measured inside a frame: an eroded or cropped drawing must not shrink
 * the very operation that is meant to be robust to it.
 */
export function solidLayer(mask: Mask, wallPx: number): SolidLayer {
  const radius = Math.max(1, Math.round(wallPx * 0.3))
  const opened = dilate(erode(mask, radius), radius)
  const { width, height } = opened
  const labels = new Int32Array(width * height)
  const parts: SolidPart[] = []
  const stack = new Int32Array(width * height)
  for (let start = 0; start < width * height; start += 1) {
    if (opened.data[start] !== 1 || labels[start] !== 0) continue
    const id = parts.length
    let top = 0
    stack[top++] = start
    labels[start] = id + 1
    let pixels = 0
    let x0 = width
    let y0 = height
    let x1 = -1
    let y1 = -1
    while (top > 0) {
      const i = stack[--top]
      const x = i % width
      const y = (i - x) / width
      pixels += 1
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const xx = x + dx
          const yy = y + dy
          if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue
          const j = yy * width + xx
          if (opened.data[j] !== 1 || labels[j] !== 0) continue
          labels[j] = id + 1
          stack[top++] = j
        }
      }
    }
    const post = x1 - x0 + 1 <= wallPx * 2.5 && y1 - y0 + 1 <= wallPx * 2.5
    parts.push({ id, bounds: { x0, y0, x1, y1 }, pixels, kind: post ? 'POST' : 'WALL' })
  }
  return { width, height, radius, wallPx, labels, parts }
}

/** A stretch of a wall line where the ink is wall-thick. */
export type LinePiece = {
  from: number
  to: number
  /** Where the wall's own axis runs across this piece, in the line's cross coordinate. */
  axisPx: number
  kind: 'WALL' | 'POST'
  partId: number | null
  /**
   * True when the piece runs ALONG the line (at least 1.25 walls of it): a stretch of this wall. A shorter
   * piece is the cross-section of a wall crossing the line — solid, but no jamb of an opening in this line.
   */
  along: boolean
}

export type GapClass = 'DRAWING_BREAK_SUPPORTED' | 'OPENING_SUPPORTED' | 'UNKNOWN_GAP' | 'TRUE_EXTERIOR_GAP'
export type BoundaryStrength = 'STRONG' | 'WEAK' | 'NONE'

/** A thin line drawn across a gap, inside the wall's thickness. */
export type GapStroke = {
  /** Across the gap, from the jambs' axis, in pixels: 0 on the axis, ± half a wall on its faces. */
  offsetPx: number
  /** Share of the gap the line spans. */
  coverage: number
  /** Separate runs of ink along it: one or two is a line, more is a dashed (overhead) line. */
  runs: number
  continuous: boolean
}

/** What a printed callout says about a gap: an opening of this width, read here. */
export type GapCallout = { id: string; widthCm: number; confidence: number }

export type BoundaryGap = {
  id: string
  /** The wall line's orientation: X is a vertical line (x fixed) running along y; Y a horizontal one. */
  axis: 'X' | 'Y'
  linePx: number
  fromPx: number
  toPx: number
  widthM: number
  /** What stands at each end: wall, a free-standing block, or (a corner opening) the corner where the other facade leg meets it. */
  jambs: ['WALL' | 'POST' | 'CORNER', 'WALL' | 'POST' | 'CORNER']
  strokes: GapStroke[]
  /** What is drawn across it: two or more lines is glazing; one on the axis a door leaf; one at a face a vehicle door or a slab edge. */
  signature: 'GLAZING' | 'LEAF_AXIS' | 'LEAF_FACE' | 'DASHED' | 'BLANK'
  callout?: GapCallout
  cls: GapClass
  boundary: BoundaryStrength
  /** What fills it in the building: an opening, or nothing — the outside. */
  occupancy: 'OPENING' | 'EXTERIOR'
  why: string
}

/** One line of the plan read for wall ink: its pieces, the gaps between them, and the drawing breaks merged away. */
export type WallLine = {
  axis: 'X' | 'Y'
  px: number
  from: number
  to: number
  pieces: LinePiece[]
  gaps: BoundaryGap[]
  drawingBreaks: number
}

export type WallLineOptions = {
  wallPx: number
  /** Metres per pixel ALONG the line. */
  mppAlong: number
  /** The widest hole a wall may have on its width alone, in metres (the lintel convention). */
  maxOpeningM: number
  /** The widest hole that can be an opening when the drawing says so, in metres. */
  maxWideOpeningM: number
}

const inkAt = (m: Mask, x: number, y: number): number => (x < 0 || y < 0 || x >= m.width || y >= m.height ? 0 : m.data[y * m.width + x])

/**
 * Read one line of the plan for wall ink.
 *
 * A position along the line is SOLID when a wall-thick window within one wall
 * of the line is at least 80 % ink: the line may be a wall's face (a chain's
 * witness line) or its axis, and the wall is found either way. Solid runs at
 * least as long as the wall-solid layer keeps a piece are PIECES; a break no
 * wider than half a wall inside them is the drawing's, and is merged.
 */
export function readWallLine(mask: Mask, solid: SolidLayer, axis: 'X' | 'Y', px: number, from: number, to: number, options: WallLineOptions): WallLine {
  const t = Math.max(3, options.wallPx)
  const half = Math.max(1, Math.floor(t / 2))
  const need = Math.ceil((2 * half + 1) * 0.8)
  const reach = Math.round(t)
  const a = Math.max(0, Math.round(from))
  const b = Math.min((axis === 'X' ? mask.height : mask.width) - 1, Math.round(to))
  const cross0 = Math.round(px) - reach - half
  const cross1 = Math.round(px) + reach + half
  // along the line: whether it is solid there, and the centre of the qualifying window nearest the line
  const solidAt: boolean[] = []
  const centreAt: number[] = []
  const prefix = new Int32Array(cross1 - cross0 + 2)
  for (let s = a; s <= b; s += 1) {
    prefix[0] = 0
    for (let c = cross0; c <= cross1; c += 1) prefix[c - cross0 + 1] = prefix[c - cross0] + (axis === 'X' ? inkAt(mask, c, s) : inkAt(mask, s, c))
    // The qualifying window centres form one run per wall the strip crosses; the wall's axis is the middle of the
    // run nearest the line (a line struck on a wall's face must not pull the axis towards that face).
    let best = -1
    let bestGap = Infinity
    let runStart = -1
    for (let c = cross0 + half; c <= cross1 - half + 1; c += 1) {
      const ok = c <= cross1 - half && prefix[c + half - cross0 + 1] - prefix[c - half - cross0] >= need
      if (ok && runStart < 0) runStart = c
      if (!ok && runStart >= 0) {
        const mid = (runStart + c - 1) / 2
        const gap = px < runStart ? runStart - px : px > c - 1 ? px - (c - 1) : 0
        if (gap < bestGap || (gap === bestGap && Math.abs(mid - px) < Math.abs(best - px))) {
          bestGap = gap
          best = mid
        }
        runStart = -1
      }
    }
    solidAt.push(best >= 0)
    centreAt.push(best)
  }
  // runs of solid positions
  const runs: Array<{ from: number; to: number }> = []
  let start = -1
  for (let k = 0; k <= solidAt.length; k += 1) {
    const on = k < solidAt.length && solidAt[k]
    if (on && start < 0) start = k
    if (!on && start >= 0) {
      runs.push({ from: a + start, to: a + k })
      start = -1
    }
  }
  // drawing breaks: a break of at most half a wall between two solid runs is one piece of wall
  let drawingBreaks = 0
  const merged: Array<{ from: number; to: number }> = []
  for (const r of runs) {
    const last = merged[merged.length - 1]
    if (last && r.from - last.to <= Math.max(1, Math.round(t * 0.5))) {
      last.to = r.to
      drawingBreaks += 1
    } else merged.push({ ...r })
  }
  const minPiece = solid.radius * 2 + 1
  const pieces: LinePiece[] = []
  for (const r of merged) {
    if (r.to - r.from < minPiece) continue
    const centres: number[] = []
    for (let s = r.from; s < r.to; s += 1) if (centreAt[s - a] >= 0) centres.push(centreAt[s - a])
    const axisPx = centres.length > 0 ? centres.reduce((p, q) => p + q, 0) / centres.length : px
    // the piece's part in the wall-solid layer: the most common label along its axis
    const count = new Map<number, number>()
    for (let s = r.from; s < r.to; s += 1) {
      const c = Math.round(centreAt[s - a] >= 0 ? centreAt[s - a] : axisPx)
      const x = axis === 'X' ? c : s
      const y = axis === 'X' ? s : c
      const label = x >= 0 && y >= 0 && x < solid.width && y < solid.height ? solid.labels[y * solid.width + x] : 0
      if (label > 0) count.set(label - 1, (count.get(label - 1) ?? 0) + 1)
    }
    const partId = [...count.entries()].sort((p, q) => q[1] - p[1] || p[0] - q[0])[0]?.[0] ?? null
    const kind = partId === null ? 'POST' : solid.parts[partId].kind
    pieces.push({ from: r.from, to: r.to, axisPx: round6(axisPx), kind, partId, along: r.to - r.from >= t * 1.25 })
  }
  const gaps: BoundaryGap[] = []
  for (let i = 0; i + 1 < pieces.length; i += 1) gaps.push(classifyGap(mask, axis, px, pieces[i], pieces[i + 1], options))
  return { axis, px: round6(px), from: a, to: b, pieces, gaps, drawingBreaks }
}

/** The thin lines drawn across a gap inside the wall's thickness, one per distinct line. */
export function gapStrokes(mask: Mask, axis: 'X' | 'Y', axisPx: number, from: number, to: number, wallPx: number): GapStroke[] {
  const g0 = Math.round(from)
  const g1 = Math.round(to)
  const width = Math.max(1, g1 - g0)
  const band = Math.round(wallPx * 0.75)
  const centre = Math.round(axisPx)
  const rows: Array<{ c: number; coverage: number; runs: number }> = []
  for (let c = centre - band; c <= centre + band; c += 1) {
    let ink = 0
    let runs = 0
    let inRun = false
    for (let s = g0; s < g1; s += 1) {
      const v = axis === 'X' ? inkAt(mask, c, s) : inkAt(mask, s, c)
      ink += v
      if (v === 1 && !inRun) runs += 1
      inRun = v === 1
    }
    rows.push({ c, coverage: ink / width, runs })
  }
  // adjacent qualifying rows are one drawn line; its best row speaks for it
  const strokes: GapStroke[] = []
  let group: typeof rows = []
  const flush = (): void => {
    if (group.length === 0) return
    const best = [...group].sort((p, q) => q.coverage - p.coverage || p.runs - q.runs || Math.abs(p.c - centre) - Math.abs(q.c - centre))[0]
    strokes.push({ offsetPx: best.c - centre, coverage: round6(best.coverage), runs: best.runs, continuous: best.runs <= 2 })
    group = []
  }
  for (const row of rows) {
    if (row.coverage >= 0.7) group.push(row)
    else flush()
  }
  flush()
  return strokes
}

function classifyGap(mask: Mask, axis: 'X' | 'Y', linePx: number, left: LinePiece, right: LinePiece, options: WallLineOptions): BoundaryGap {
  const t = options.wallPx
  const axisPx = (left.axisPx + right.axisPx) / 2
  const widthPx = right.from - left.to
  const widthM = round6(widthPx * options.mppAlong)
  const strokes = gapStrokes(mask, axis, axisPx, left.to, right.from, t)
  const continuous = strokes.filter((s) => s.continuous)
  const signature: BoundaryGap['signature'] =
    continuous.length >= 2 ? 'GLAZING' : continuous.length === 1 ? (Math.abs(continuous[0].offsetPx) <= t * 0.25 ? 'LEAF_AXIS' : 'LEAF_FACE') : strokes.length > 0 ? 'DASHED' : 'BLANK'
  const jambs: BoundaryGap['jambs'] = [left.kind, right.kind]
  const walls = left.kind === 'WALL' && right.kind === 'WALL'
  const posts = jambs.filter((j) => j === 'POST').length
  const id = `gap-${axis}-${Math.round(linePx)}-${left.to}-${right.from}`
  const base = { id, axis, linePx: round6(linePx), fromPx: left.to, toPx: right.from, widthM, jambs, strokes, signature }
  const decide = (cls: GapClass, boundary: BoundaryStrength, why: string): BoundaryGap => ({ ...base, cls, boundary, occupancy: boundary === 'NONE' ? 'EXTERIOR' : 'OPENING', why })
  const w = `${widthM.toFixed(2)} m`
  if (widthM > options.maxWideOpeningM) return decide('TRUE_EXTERIOR_GAP', 'NONE', `a ${w} gap: wider than any opening a house wall carries`)
  if (walls) {
    if (signature === 'GLAZING') return decide('OPENING_SUPPORTED', 'STRONG', `a ${w} gap between two walls with ${continuous.length} lines drawn across it inside the wall: glazing`)
    if (signature === 'LEAF_AXIS' && widthM <= options.maxOpeningM) return decide('OPENING_SUPPORTED', 'STRONG', `a ${w} gap between two walls with one line on the wall's axis: a door`)
    if (signature === 'LEAF_FACE' && widthM >= 2.2) return decide('OPENING_SUPPORTED', 'STRONG', `a ${w} gap between two walls with one continuous line at a face of the wall: a vehicle door`)
    // Nothing drawn: a hole in THIS wall only between two stretches of it. Between the cross-sections of two walls
    // crossing the line (a line through a room) there is no wall to have a hole in. A line drawn across it (a leaf
    // at a face, a dashed one) needs one stretch of this wall beside it.
    if (widthM <= options.maxOpeningM && (signature === 'BLANK' ? left.along && right.along : left.along || right.along)) return decide('UNKNOWN_GAP', 'WEAK', `a ${w} gap between two walls with ${signature === 'BLANK' ? 'nothing' : 'only a line at its face or a dashed one'} drawn across: a door or the mouth of a recess, decided by what lies behind it`)
    if (widthM <= options.maxOpeningM) return decide('TRUE_EXTERIOR_GAP', 'NONE', `a ${w} stretch between the cross-sections of walls crossing the line, with nothing drawn across it: a room or a passage, not a hole in a wall`)
    return decide('TRUE_EXTERIOR_GAP', 'NONE', `a ${w} gap between two walls, wider than a lintel spans, with ${signature === 'DASHED' ? 'only a dashed (overhead) line' : signature === 'BLANK' ? 'nothing' : 'only one line'} across it: where the wall stops`)
  }
  // a post is never a jamb — except between windows, where the glazing itself says the wall goes on
  if (signature === 'GLAZING' && widthM <= options.maxOpeningM) {
    return decide('OPENING_SUPPORTED', 'STRONG', `a ${w} gap with ${continuous.length} continuous lines drawn across it inside the wall, beside ${posts === 2 ? 'two short piers' : 'a short pier'}: glazing between piers`)
  }
  // one continuous line from a short pier: a door beside a corner frame, or a railing from a column — decided by what is behind it
  if ((signature === 'LEAF_AXIS' || signature === 'LEAF_FACE') && widthM <= options.maxOpeningM && (left.along || right.along)) {
    return decide('UNKNOWN_GAP', 'WEAK', `a ${w} gap with one continuous line across it beside ${posts === 2 ? 'two short piers' : 'a short pier'}: a door by a corner frame, or a rail from a column — decided by what lies behind it`)
  }
  return decide('TRUE_EXTERIOR_GAP', 'NONE', `a ${w} gap beside ${posts === 2 ? 'two free-standing blocks' : 'a free-standing block'} (a post, a column, a planter) with ${signature === 'GLAZING' ? 'glazing wider than a lintel spans' : signature === 'BLANK' ? 'nothing' : signature === 'DASHED' ? 'only a dashed line' : 'one line'} across it: not a wall`)
}

/**
 * The callouts that agree with a gap, each given to the one gap it agrees
 * with and lies nearest: within max(10 cm, 3 %) of its width (measured gaps
 * sit within 4 cm of their printed widths), within four walls or 1.5 m across
 * the line, and beside the gap along it.
 */
export function assignCallouts(
  lines: readonly WallLine[],
  callouts: ReadonlyArray<{ id: string; at: { x: number; y: number }; widthsCm: ReadonlyArray<{ value: number; confidence: number }> }>,
  mppAcross: (axis: 'X' | 'Y') => number,
  mppAlong: (axis: 'X' | 'Y') => number,
  wallPx: number,
): Map<string, GapCallout> {
  const out = new Map<string, GapCallout>()
  for (const c of [...callouts].sort((p, q) => (p.id < q.id ? -1 : p.id > q.id ? 1 : 0))) {
    let best: { gapId: string; distance: number; callout: GapCallout } | undefined
    for (const line of lines) {
      const across = line.axis === 'X' ? c.at.x : c.at.y
      const along = line.axis === 'X' ? c.at.y : c.at.x
      const off = Math.abs(across - line.px)
      if (off > Math.max(wallPx * 4, 1.5 / mppAcross(line.axis))) continue
      for (const g of line.gaps) {
        const slack = 1 / mppAlong(line.axis)
        if (along < g.fromPx - slack || along > g.toPx + slack) continue
        const widthCm = g.widthM * 100
        const agree = c.widthsCm.filter((w) => Math.abs(w.value - widthCm) <= Math.max(10, widthCm * 0.03)).sort((p, q) => q.confidence - p.confidence)[0]
        if (!agree) continue
        const mid = (g.fromPx + g.toPx) / 2
        const distance = Math.hypot(off, Math.abs(along - mid))
        if (!best || distance < best.distance) best = { gapId: g.id, distance, callout: { id: c.id, widthCm: agree.value, confidence: round6(agree.confidence) } }
      }
    }
    if (best && !out.has(best.gapId)) out.set(best.gapId, best.callout)
  }
  return out
}

/** Upgrade a gap a printed callout agrees with: its width is stated, so it is an opening wherever its jambs are walls. */
export function withCallout(gap: BoundaryGap, callout: GapCallout, maxWideOpeningM: number): BoundaryGap {
  const walls = gap.jambs[0] === 'WALL' && gap.jambs[1] === 'WALL'
  if (!walls || gap.widthM > maxWideOpeningM || gap.cls === 'OPENING_SUPPORTED') return { ...gap, callout }
  return { ...gap, callout, cls: 'OPENING_SUPPORTED', boundary: 'STRONG', occupancy: 'OPENING', why: `${gap.why}; a callout of ${callout.widthCm} cm printed beside it states its width: an opening` }
}

/**
 * Corner openings: a window or door that turns a corner with no solid block at
 * it. Each facade line then ends in a stretch with no wall-thick ink between
 * its last pier and the corner, and the corner itself is only thin lines.
 *
 * A leg — from a line's end pier to a perpendicular grid line inside that end
 * stretch — is bridged when it is no wider than a lintel spans, a door or
 * glazing is drawn along it inside the wall (the same signature a gap needs),
 * and the other facade reaches the corner: the perpendicular line has wall-thick
 * ink within a wall of it, or a leg of its own ending there. A leg with nothing
 * drawn along it is where the wall stops.
 */
export function cornerLegs(mask: Mask, linesX: readonly WallLine[], linesY: readonly WallLine[], optionsX: WallLineOptions, optionsY: WallLineOptions): { x: BoundaryGap[][]; y: BoundaryGap[][] } {
  const t = optionsX.wallPx
  type Leg = { gap: BoundaryGap; line: WallLine; corner: number; other: WallLine }
  const candidates = (lines: readonly WallLine[], perpendicular: readonly WallLine[], options: WallLineOptions): Leg[][] =>
    lines.map((line) => {
      const out: Leg[] = []
      if (line.pieces.length === 0) return out
      const first = line.pieces[0]
      const last = line.pieces[line.pieces.length - 1]
      for (const other of perpendicular) {
        const c = other.px
        for (const [piece, lo, hi, end] of [
          [first, c, first.from, 'start'],
          [last, last.to, c, 'end'],
        ] as const) {
          if (end === 'start' ? !(c >= line.from && c < first.from - 1) : !(c > last.to + 1 && c <= line.to)) continue
          const widthPx = hi - lo
          const widthM = round6(widthPx * options.mppAlong)
          if (widthPx < t * 0.5 || widthM > options.maxOpeningM) continue
          const strokes = gapStrokes(mask, line.axis, piece.axisPx, lo, hi, t)
          const continuous = strokes.filter((s) => s.continuous)
          if (continuous.length === 0) continue
          const signature: BoundaryGap['signature'] = continuous.length >= 2 ? 'GLAZING' : Math.abs(continuous[0].offsetPx) <= t * 0.25 ? 'LEAF_AXIS' : 'LEAF_FACE'
          const jambs: BoundaryGap['jambs'] = end === 'start' ? ['CORNER', piece.kind] : [piece.kind, 'CORNER']
          out.push({
            line,
            other,
            corner: c,
            gap: {
              id: `corner-${line.axis}-${Math.round(line.px)}-${Math.round(lo)}-${Math.round(hi)}`,
              axis: line.axis,
              linePx: line.px,
              fromPx: round6(lo),
              toPx: round6(hi),
              widthM,
              jambs,
              strokes,
              signature,
              cls: 'OPENING_SUPPORTED',
              boundary: 'STRONG',
              occupancy: 'OPENING',
              why: `a ${widthM.toFixed(2)} m opening turning a corner: ${continuous.length} line${continuous.length === 1 ? '' : 's'} drawn along it inside the wall from its pier to the corner, and the other facade reaches the corner`,
            },
          })
        }
      }
      return out
    })
  const cx = candidates(linesX, linesY, optionsX)
  const cy = candidates(linesY, linesX, optionsY)
  // the other facade reaches the corner: wall-thick ink within a wall of it, or a leg of its own ending there
  const reaches = (other: WallLine, at: number, legs: Leg[][], perpendicularIndex: number): boolean =>
    other.pieces.some((p) => at >= p.from - t && at <= p.to + t) || (legs[perpendicularIndex] ?? []).some((l) => Math.abs(l.corner - at) <= 1)
  const accept = (own: Leg[][], perpendicularLegs: Leg[][], perpendicular: readonly WallLine[]): BoundaryGap[][] =>
    own.map((legs, i) => {
      const line = (own === cx ? linesX : linesY)[i]
      return legs
        .filter((leg) => reaches(leg.other, line.px, perpendicularLegs, perpendicular.indexOf(leg.other)))
        .sort((a, b) => a.gap.fromPx - b.gap.fromPx || a.gap.toPx - b.gap.toPx)
        .map((leg) => leg.gap)
    })
  return { x: accept(cx, cy, linesY), y: accept(cy, cx, linesX) }
}
