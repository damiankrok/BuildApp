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

/**
 * 1.2.0 (005K): every gap keeps the trace of its classification (`GapTrace`: the axis and the jamb that gave it, the
 * signature before the pattern override and without the runs-past flags, the pattern and width rules, wall-thick ink
 * at the jambs and in the wall band, the reason codes) and the boundary record carries one source-addressable record per
 * gap the classification left WEAK (`gap-evidence.ts`). Nothing a decision reads changed; the drawn-gap rule is OFF
 * unless asked for.
 */
export const BOUNDARY_EVIDENCE_VERSION = '1.2.0'

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
  /** Inside the wall's thickness (within half a wall of the jambs' axis, and a pixel): where infill is drawn. */
  inWall: boolean
  /**
   * The line runs on past a jamb (005C post-review): along the outside of a wall stretch, or on beyond a
   * wall's cross-section. Infill stops at its jambs; a paving edge, a kerb, a step or a slab outline does not.
   */
  runsPast: boolean
}

/**
 * Why a gap stands as it does (005K): the branch of `classifyGap` that decided it, then — in order — a callout, a shut
 * garage mouth or the drawn-gap rule that changed it. Corner legs carry CORNER_GLAZING.
 */
export type GapReason =
  | 'WIDER_THAN_ANY_OPENING'
  | 'INFILL_RUNS_PAST_JAMB'
  | 'GLAZING'
  | 'LEAF_ON_AXIS'
  | 'VEHICLE_DOOR'
  | 'NOTHING_DRAWN_WITHIN_LINTEL'
  | 'FACE_OR_DASHED_LINE_WITHIN_LINTEL'
  | 'CROSS_SECTIONS_NOT_A_HOLE'
  | 'WALL_STOPS_WIDER_THAN_LINTEL'
  | 'GLAZING_BETWEEN_PIERS'
  | 'ONE_LINE_BESIDE_PIER'
  | 'FREE_STANDING_BLOCK'
  | 'CALLOUT_WITH_DRAWN_INFILL'
  | 'CALLOUT_STATES_WIDTH_ONLY'
  | 'SHUT_GARAGE_MOUTH'
  | 'CORNER_GLAZING'
  | 'DRAWN_GAP_UPGRADE'

/**
 * The drawn-gap rule's conditions on one WEAK gap (005K, experimental, OFF unless asked for). Each reads the drawing
 * and the wall line only. The rule would read the gap as an opening only when every one holds:
 *
 *   wallJambs     both jambs are WALL, not free-standing blocks;
 *   alongJambs    both are stretches of THIS wall, not walls crossing the line — a line through a room has no wall to
 *                 have a hole in;
 *   withinLintel  no wider than a lintel conventionally spans: wider, only the drawing's own statement makes a hole;
 *   drawn         a door leaf, glazing or a face line is drawn across it — read as it stands, before the pattern
 *                 override, or with the runs-past flags dropped. BLANK and dashed-only gaps never qualify;
 *   inWallBand    the drawn line is a continuous line inside the wall's thickness, not beside it;
 *   jambInk       wall-thick ink (the wall-solid layer) fills the wall's band at both jambs, each on its own axis.
 */
export type DrawnGapCheck = {
  wallJambs: boolean
  alongJambs: boolean
  withinLintel: boolean
  drawn: boolean
  /** Which reading said "drawn": the signature as it stands, the one before the pattern override, or the one without runs-past. */
  drawnVia: 'SIGNATURE' | 'BEFORE_PATTERN' | 'WITHOUT_RUNS_PAST' | null
  inWallBand: boolean
  jambInk: boolean
  eligible: boolean
}

/**
 * What the drawing shows at a gap, kept from its classification (005K): the source-only observations its decision can
 * be replayed from without a picture.
 */
export type GapTrace = {
  /** The wall's axis across the gap, and the jamb(s) that ran along the line and gave it; LINE when neither did. */
  axisPx: number
  axisFrom: 'BOTH' | 'LEFT' | 'RIGHT' | 'LINE'
  jambAlong: [boolean, boolean]
  /** Share of a wall-square window at each jamb's edge, on that jamb's own axis, that is wall-thick ink (the solid layer). */
  jambInk: [number, number]
  /** Share of the gap's own wall band (its span by the wall's thickness, on the axis) that is ink. */
  bandInk: number
  /** The signature before the pattern override, and with every runs-past flag dropped. */
  signatureRaw: BoundaryGap['signature']
  signatureLoose: BoundaryGap['signature']
  patternAcross: boolean
  /** Some line drawn across the gap runs on past a jamb. */
  runsPast: boolean
  /** Within the lintel convention, wider but within the widest opening, or wider than any opening. */
  widthRule: 'LINTEL' | 'WIDE' | 'TOO_WIDE'
  /** The classification before any callout, garage mouth or rule. */
  classified: { cls: GapClass; boundary: BoundaryStrength }
  /** The drawn-gap rule's conditions, read for every gap classified WEAK. */
  drawnGapRule?: DrawnGapCheck
  reasons: GapReason[]
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
  /** 005K: how it was read, for its evidence record. Observational: no decision reads it. */
  trace?: GapTrace
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
  /**
   * 005K, experimental: read a WEAK gap whose drawn-gap conditions all hold (`DrawnGapCheck`) as an opening (STRONG).
   * OFF unless asked for; the product never asks.
   */
  drawnGapRule?: 'OFF' | 'ON'
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
  for (let i = 0; i + 1 < pieces.length; i += 1) gaps.push(classifyGap(mask, solid, axis, px, pieces[i], pieces[i + 1], options, { left: i === 0, right: i + 2 === pieces.length }))
  return { axis, px: round6(px), from: a, to: b, pieces, gaps, drawingBreaks }
}

/** The thin lines drawn across a gap inside the wall's thickness, one per distinct line. */
export function gapStrokes(mask: Mask, axis: 'X' | 'Y', axisPx: number, from: number, to: number, wallPx: number, jambs?: { left?: LinePiece; right?: LinePiece; leftEnds?: boolean; rightEnds?: boolean }): GapStroke[] {
  const g0 = Math.round(from)
  const g1 = Math.round(to)
  const width = Math.max(1, g1 - g0)
  const centre = Math.round(axisPx)
  const ink = (c: number, s: number): number => (axis === 'X' ? inkAt(mask, c, s) : inkAt(mask, s, c))
  const t = Math.max(3, wallPx)
  // A jamb's own half-thickness, measured across its ink next to the gap: an exterior wall is often drawn thicker than
  // the sheet's typical wall, and its glazing at its own faces is inside it.
  const halfOf = (piece: LinePiece | undefined, side: 'left' | 'right'): number => {
    // only a stretch of this wall: a wall crossing the line is as thick across as it is long
    if (!piece || !piece.along) return t / 2
    const centre = Math.round(piece.axisPx)
    // a few positions into the jamb, the thickest: a reveal steps the wall thinner at its very edge
    let best = t / 2
    for (const k of [2, Math.round(t / 2), Math.round(t)]) {
      const at = side === 'left' ? piece.to - k : piece.from + k
      if (at < piece.from || at > piece.to) continue
      const inked = (c: number): boolean => (axis === 'X' ? inkAt(mask, c, at) : inkAt(mask, at, c)) === 1
      if (!inked(centre)) continue
      let lo = 0
      let hi = 0
      // at most twice the sheet's wall: more is a corner or a pier block, not this wall's thickness
      while (lo < t && inked(centre - lo - 1)) lo += 1
      while (hi < t && inked(centre + hi + 1)) hi += 1
      best = Math.max(best, (lo + hi + 1) / 2)
    }
    return best
  }
  const halfLeft = halfOf(jambs?.left, 'left')
  const halfRight = halfOf(jambs?.right, 'right')
  const half = Math.max(halfLeft, halfRight)
  const rows: Array<{ c: number; coverage: number; runs: number }> = []
  const band = Math.round(Math.max(wallPx * 0.75, half + 2))
  for (let c = centre - band; c <= centre + band; c += 1) {
    let inked = 0
    let runs = 0
    let inRun = false
    for (let s = g0; s < g1; s += 1) {
      const v = ink(c, s)
      inked += v
      if (v === 1 && !inRun) runs += 1
      inRun = v === 1
    }
    rows.push({ c, coverage: inked / width, runs })
  }
  const share = (c: number, a: number, b: number): number => {
    const lo = Math.round(Math.min(a, b))
    const hi = Math.round(Math.max(a, b))
    if (hi <= lo) return 0
    let n = 0
    for (let s = lo; s < hi; s += 1) n += ink(c, s)
    return n / (hi - lo)
  }
  // Does row `c` run on past a jamb? Alongside a stretch of wall it shows as a thin line with open ground between it
  // and the wall's ink; past the jamb's far end only beyond the last piece of the line, where the wall ends and the
  // building with it. Past a jamb's far end inside a facade it says nothing: the next window's own lines carry on the
  // same rows, and a pier between two windows is too short to tell from a wall crossing the line.
  const past = (c: number, piece: LinePiece | undefined, side: 'left' | 'right', ends: boolean): boolean => {
    if (!piece) return false
    const near = side === 'left' ? piece.to : piece.from
    const span: [number, number] = [near, side === 'left' ? Math.max(piece.from, near - 2 * t) : Math.min(piece.to, near + 2 * t)]
    const towardWall = c > piece.axisPx ? -1 : 1
    const own = side === 'left' ? halfLeft : halfRight
    const separate = Math.abs(c - piece.axisPx) > own + 1 && share(c, ...span) >= 0.7 && share(c + towardWall * 2, ...span) <= 0.3
    if (separate) return true
    if (!ends) return false
    const far = side === 'left' ? piece.from : piece.to
    return share(c, side === 'left' ? far - t : far, side === 'left' ? far : far + t) >= 0.7
  }
  // adjacent qualifying rows are one drawn line; its best row speaks for it
  const strokes: GapStroke[] = []
  let group: typeof rows = []
  const flush = (): void => {
    if (group.length === 0) return
    const best = [...group].sort((p, q) => q.coverage - p.coverage || p.runs - q.runs || Math.abs(p.c - centre) - Math.abs(q.c - centre))[0]
    strokes.push({
      offsetPx: best.c - centre,
      coverage: round6(best.coverage),
      runs: best.runs,
      continuous: best.runs <= 2,
      inWall: Math.abs(best.c - axisPx) <= half + 1,
      runsPast: past(best.c, jambs?.left, 'left', jambs?.leftEnds ?? false) || past(best.c, jambs?.right, 'right', jambs?.rightEnds ?? false),
    })
    group = []
  }
  for (const row of rows) {
    if (row.coverage >= 0.7) group.push(row)
    else flush()
  }
  flush()
  return strokes
}

/**
 * Parallel lines across a gap on BOTH sides of the wall, beyond its thickness: tiles, treads, a hatch of lines — a
 * pattern the gap sits in, not infill drawn in it. Glazing is confined to the wall; a sill or a step may stand on one
 * side of it.
 */
export function patternAcross(mask: Mask, axis: 'X' | 'Y', axisPx: number, from: number, to: number, wallPx: number): boolean {
  const g0 = Math.round(from)
  const g1 = Math.round(to)
  if (g1 <= g0) return false
  const t = Math.max(3, wallPx)
  const lineAt = (c: number): boolean => {
    let inked = 0
    let runs = 0
    let inRun = false
    for (let s = g0; s < g1; s += 1) {
      const v = axis === 'X' ? inkAt(mask, c, s) : inkAt(mask, s, c)
      inked += v
      if (v === 1 && !inRun) runs += 1
      inRun = v === 1
    }
    return inked / (g1 - g0) >= 0.7 && runs <= 2
  }
  const side = (dir: 1 | -1): boolean => {
    for (let k = Math.ceil(t / 2) + 2; k <= Math.round(t * 1.5); k += 1) if (lineAt(Math.round(axisPx) + dir * k)) return true
    return false
  }
  return side(1) && side(-1)
}

/**
 * What is drawn across a gap, from the lines that can be its infill: continuous, inside the wall's thickness, and
 * stopping at the jambs. Two to four is glazing (a frame's face lines and the glass; more is a hatch); one on the axis a leaf; one at a
 * face a vehicle door; a line that runs on past a jamb or lies outside the wall is line work, and counts for nothing.
 */
export function gapSignature(strokes: readonly GapStroke[], wallPx: number): { signature: BoundaryGap['signature']; infill: GapStroke[] } {
  const infill = strokes.filter((s) => s.continuous && s.inWall && !s.runsPast)
  const signature: BoundaryGap['signature'] =
    infill.length >= 2 && infill.length <= 4 ? 'GLAZING' : infill.length === 1 ? (Math.abs(infill[0].offsetPx) <= wallPx * 0.25 ? 'LEAF_AXIS' : 'LEAF_FACE') : strokes.length > 0 ? 'DASHED' : 'BLANK'
  return { signature, infill }
}

/**
 * The line reader's own SOLID criterion (`readWallLine`: a window at least 80 % ink), applied to the wall-solid layer
 * at a jamb: wall-thick ink fills the wall's band there.
 */
const JAMB_SOLID = 0.8

/** Share of the window along [a, b) and across [c0, c1] that is wall-thick ink (a part of the wall-solid layer). */
function solidShare(solid: SolidLayer, axis: 'X' | 'Y', a: number, b: number, c0: number, c1: number): number {
  let all = 0
  let on = 0
  for (let s = a; s < b; s += 1) {
    for (let c = c0; c <= c1; c += 1) {
      const x = axis === 'X' ? c : s
      const y = axis === 'X' ? s : c
      all += 1
      if (x >= 0 && y >= 0 && x < solid.width && y < solid.height && solid.labels[y * solid.width + x] > 0) on += 1
    }
  }
  return all === 0 ? 0 : round6(on / all)
}

/** Share of the window along [a, b) and across [c0, c1] that is ink. */
function inkShare(mask: Mask, axis: 'X' | 'Y', a: number, b: number, c0: number, c1: number): number {
  let all = 0
  let on = 0
  for (let s = a; s < b; s += 1) {
    for (let c = c0; c <= c1; c += 1) {
      all += 1
      on += axis === 'X' ? inkAt(mask, c, s) : inkAt(mask, s, c)
    }
  }
  return all === 0 ? 0 : round6(on / all)
}

const drawnSignature = (sig: BoundaryGap['signature']): boolean => sig === 'GLAZING' || sig === 'LEAF_AXIS' || sig === 'LEAF_FACE'

/** The drawn-gap rule's conditions on a gap (005K): see `DrawnGapCheck`. Reads the gap's own geometry and ink only. */
export function drawnGapCheck(gap: Pick<BoundaryGap, 'jambs' | 'widthM' | 'signature' | 'strokes'>, trace: Pick<GapTrace, 'jambAlong' | 'jambInk' | 'signatureRaw' | 'signatureLoose'>, maxOpeningM: number): DrawnGapCheck {
  const wallJambs = gap.jambs[0] === 'WALL' && gap.jambs[1] === 'WALL'
  const alongJambs = trace.jambAlong[0] && trace.jambAlong[1]
  const withinLintel = gap.widthM <= maxOpeningM
  const drawnVia = drawnSignature(gap.signature) ? 'SIGNATURE' : drawnSignature(trace.signatureRaw) ? 'BEFORE_PATTERN' : drawnSignature(trace.signatureLoose) ? 'WITHOUT_RUNS_PAST' : null
  const drawn = drawnVia !== null
  const inWallBand = gap.strokes.some((k) => k.continuous && k.inWall)
  const jambInk = trace.jambInk[0] >= JAMB_SOLID && trace.jambInk[1] >= JAMB_SOLID
  return { wallJambs, alongJambs, withinLintel, drawn, drawnVia, inWallBand, jambInk, eligible: wallJambs && alongJambs && withinLintel && drawn && inWallBand && jambInk }
}

function classifyGap(mask: Mask, solid: SolidLayer, axis: 'X' | 'Y', linePx: number, left: LinePiece, right: LinePiece, options: WallLineOptions, ends?: { left: boolean; right: boolean }): BoundaryGap {
  const t = options.wallPx
  // The gap's axis is the wall's: taken from the jambs that run along the line. A cross-section of a wall crossing
  // the line has no axis of this wall (005C post-review: it used to pull the axis to the line itself).
  const along = [left, right].filter((p) => p.along)
  const axisPx = along.length > 0 ? along.reduce((a, p) => a + p.axisPx, 0) / along.length : linePx
  const widthPx = right.from - left.to
  const widthM = round6(widthPx * options.mppAlong)
  const strokes = gapStrokes(mask, axis, axisPx, left.to, right.from, t, { left, right, leftEnds: ends?.left, rightEnds: ends?.right })
  const read = gapSignature(strokes, t)
  // a pattern the gap sits in (tiles, treads) is line work, whatever its rows inside the wall look like
  const pattern = read.signature === 'GLAZING' && patternAcross(mask, axis, axisPx, left.to, right.from, t)
  const signature: BoundaryGap['signature'] = pattern ? 'DASHED' : read.signature
  const continuous = pattern ? [] : read.infill
  const jambs: BoundaryGap['jambs'] = [left.kind, right.kind]
  const walls = left.kind === 'WALL' && right.kind === 'WALL'
  const posts = jambs.filter((j) => j === 'POST').length
  const id = `gap-${axis}-${Math.round(linePx)}-${left.to}-${right.from}`
  const base = { id, axis, linePx: round6(linePx), fromPx: left.to, toPx: right.from, widthM, jambs, strokes, signature }
  const decide = (cls: GapClass, boundary: BoundaryStrength, reason: GapReason, why: string): { gap: BoundaryGap; reason: GapReason } => ({ gap: { ...base, cls, boundary, occupancy: boundary === 'NONE' ? 'EXTERIOR' : 'OPENING', why }, reason })
  const w = `${widthM.toFixed(2)} m`
  const decided = ((): { gap: BoundaryGap; reason: GapReason } => {
    if (widthM > options.maxWideOpeningM) return decide('TRUE_EXTERIOR_GAP', 'NONE', 'WIDER_THAN_ANY_OPENING', `a ${w} gap: wider than any opening a house wall carries`)
    // Lines that would be infill but run on past a jamb: glazing or a door drawn on the same row as a paving edge, or a
    // paving edge alone. The drawing cannot say which, so the gap is a question (WEAK), decided by what lies behind it,
    // never a drawn opening and never a wall's end (005C post-review).
    const loose = pattern ? signature : gapSignature(strokes.map((k) => ({ ...k, runsPast: false })), t).signature
    const drawnIf = (sig: BoundaryGap['signature']): boolean => sig === 'GLAZING' || (sig === 'LEAF_AXIS' && widthM <= options.maxOpeningM) || (sig === 'LEAF_FACE' && widthM >= 2.2 && left.along && right.along)
    if (walls && left.along && right.along && !drawnIf(signature) && drawnIf(loose)) return decide('UNKNOWN_GAP', 'WEAK', 'INFILL_RUNS_PAST_JAMB', `a ${w} gap between two stretches of wall whose lines across it run on past a jamb: infill or a paving edge, decided by what lies behind it`)
    if (walls) {
      if (signature === 'GLAZING') return decide('OPENING_SUPPORTED', 'STRONG', 'GLAZING', `a ${w} gap between two walls with ${continuous.length} lines drawn across it inside the wall: glazing`)
      if (signature === 'LEAF_AXIS' && widthM <= options.maxOpeningM) return decide('OPENING_SUPPORTED', 'STRONG', 'LEAF_ON_AXIS', `a ${w} gap between two walls with one line on the wall's axis: a door`)
      // a vehicle door is a leaf in THIS wall: both jambs are stretches of it, not walls crossing the line
      if (signature === 'LEAF_FACE' && widthM >= 2.2 && left.along && right.along) return decide('OPENING_SUPPORTED', 'STRONG', 'VEHICLE_DOOR', `a ${w} gap between two stretches of wall with one continuous line at a face of the wall, stopping at the jambs: a vehicle door`)
      // Nothing drawn: a hole in THIS wall only between two stretches of it. Between the cross-sections of two walls
      // crossing the line (a line through a room) there is no wall to have a hole in. A line drawn across it (a leaf
      // at a face, a dashed one) needs one stretch of this wall beside it.
      if (widthM <= options.maxOpeningM && (signature === 'BLANK' ? left.along && right.along : left.along || right.along)) return decide('UNKNOWN_GAP', 'WEAK', signature === 'BLANK' ? 'NOTHING_DRAWN_WITHIN_LINTEL' : 'FACE_OR_DASHED_LINE_WITHIN_LINTEL', `a ${w} gap between two walls with ${signature === 'BLANK' ? 'nothing' : 'only a line at its face or a dashed one'} drawn across: a door or the mouth of a recess, decided by what lies behind it`)
      if (widthM <= options.maxOpeningM) return decide('TRUE_EXTERIOR_GAP', 'NONE', 'CROSS_SECTIONS_NOT_A_HOLE', `a ${w} stretch between the cross-sections of walls crossing the line, with nothing drawn across it: a room or a passage, not a hole in a wall`)
      return decide('TRUE_EXTERIOR_GAP', 'NONE', 'WALL_STOPS_WIDER_THAN_LINTEL', `a ${w} gap between two walls, wider than a lintel spans, with ${signature === 'DASHED' ? 'only a dashed (overhead) line' : signature === 'BLANK' ? 'nothing' : 'only one line'} across it: where the wall stops`)
    }
    // a post is never a jamb — except between windows, where the glazing itself says the wall goes on; and a wall must
    // stand at one end at least: glazing drawn between two free posts is a pergola's or a balustrade's, not a facade's
    if (signature === 'GLAZING' && widthM <= options.maxOpeningM && posts < 2) {
      return decide('OPENING_SUPPORTED', 'STRONG', 'GLAZING_BETWEEN_PIERS', `a ${w} gap with ${continuous.length} continuous lines drawn across it inside the wall, beside ${posts === 2 ? 'two short piers' : 'a short pier'}: glazing between piers`)
    }
    // one continuous line from a short pier: a door beside a corner frame, or a railing from a column — decided by what is behind it
    if ((signature === 'LEAF_AXIS' || signature === 'LEAF_FACE') && widthM <= options.maxOpeningM && (left.along || right.along)) {
      return decide('UNKNOWN_GAP', 'WEAK', 'ONE_LINE_BESIDE_PIER', `a ${w} gap with one continuous line across it beside ${posts === 2 ? 'two short piers' : 'a short pier'}: a door by a corner frame, or a rail from a column — decided by what lies behind it`)
    }
    return decide('TRUE_EXTERIOR_GAP', 'NONE', 'FREE_STANDING_BLOCK', `a ${w} gap beside ${posts === 2 ? 'two free-standing blocks' : 'a free-standing block'} (a post, a column, a planter) with ${signature === 'GLAZING' ? 'glazing wider than a lintel spans' : signature === 'BLANK' ? 'nothing' : signature === 'DASHED' ? 'only a dashed line' : 'one line'} across it: not a wall`)
  })()
  // 005K: the trace of this reading, from the drawing and the wall line only — what an evidence record replays it from.
  // A jamb's wall ink is read on that jamb's own axis (two stretches of one wall may be drawn a few pixels apart; their
  // average axis can miss both), and on the gap's axis for a wall crossing the line.
  const half = Math.max(1, Math.floor(Math.max(3, t) / 2))
  const c0 = Math.round(axisPx) - half
  const c1 = Math.round(axisPx) + half
  const reach = Math.max(2, Math.round(t))
  const jambAxis = (p: LinePiece): number => Math.round(p.along ? p.axisPx : axisPx)
  const jambInk: [number, number] = [
    solidShare(solid, axis, Math.max(left.from, left.to - reach), left.to, jambAxis(left) - half, jambAxis(left) + half),
    solidShare(solid, axis, right.from, Math.min(right.to, right.from + reach), jambAxis(right) - half, jambAxis(right) + half),
  ]
  const { gap, reason } = decided
  const trace: GapTrace = {
    axisPx: round6(axisPx),
    axisFrom: left.along && right.along ? 'BOTH' : left.along ? 'LEFT' : right.along ? 'RIGHT' : 'LINE',
    jambAlong: [left.along, right.along],
    jambInk,
    bandInk: inkShare(mask, axis, left.to, right.from, c0, c1),
    signatureRaw: read.signature,
    signatureLoose: gapSignature(strokes.map((k) => ({ ...k, runsPast: false })), t).signature,
    patternAcross: pattern,
    runsPast: strokes.some((k) => k.runsPast),
    widthRule: widthM <= options.maxOpeningM ? 'LINTEL' : widthM <= options.maxWideOpeningM ? 'WIDE' : 'TOO_WIDE',
    classified: { cls: gap.cls, boundary: gap.boundary },
    reasons: [reason],
  }
  if (gap.boundary === 'WEAK') trace.drawnGapRule = drawnGapCheck(gap, trace, options.maxOpeningM)
  if (options.drawnGapRule === 'ON' && trace.drawnGapRule?.eligible) {
    return { ...gap, cls: 'OPENING_SUPPORTED', boundary: 'STRONG', occupancy: 'OPENING', why: `${gap.why}; drawn across it inside the wall, between two stretches of wall-thick ink: an opening (005K drawn-gap rule)`, trace: { ...trace, reasons: [reason, 'DRAWN_GAP_UPGRADE'] } }
  }
  return { ...gap, trace }
}

/**
 * The callouts that agree with a gap, each given to the one gap it agrees
 * with and lies nearest: within max(10 cm, 3 %) of its width (measured gaps
 * sit within 4 cm of their printed widths), within four walls or 1.5 m across
 * the line, and printed over the gap along it. A callout two gaps agree with
 * about equally goes to neither.
 */
export function assignCallouts(
  lines: readonly WallLine[],
  callouts: ReadonlyArray<{ id: string; at: { x: number; y: number }; widthsCm: ReadonlyArray<{ value: number; confidence: number }> }>,
  mppAcross: (axis: 'X' | 'Y') => number,
  mppAlong: (axis: 'X' | 'Y') => number,
  wallPx: number,
): Map<string, GapCallout> {
  const out = new Map<string, GapCallout>()
  void mppAlong
  for (const c of [...callouts].sort((p, q) => (p.id < q.id ? -1 : p.id > q.id ? 1 : 0))) {
    const agreeing: Array<{ gapId: string; distance: number; callout: GapCallout }> = []
    for (const line of lines) {
      const across = line.axis === 'X' ? c.at.x : c.at.y
      const along = line.axis === 'X' ? c.at.y : c.at.x
      const off = Math.abs(across - line.px)
      if (off > Math.max(wallPx * 4, 1.5 / mppAcross(line.axis))) continue
      for (const g of line.gaps) {
        // printed over the gap itself, never beside it (005C post-review: a neighbouring window's callout is not this gap's)
        if (along < g.fromPx || along > g.toPx) continue
        const widthCm = g.widthM * 100
        const agree = c.widthsCm.filter((w) => Math.abs(w.value - widthCm) <= Math.max(10, widthCm * 0.03)).sort((p, q) => q.confidence - p.confidence)[0]
        if (!agree) continue
        const mid = (g.fromPx + g.toPx) / 2
        // a callout read with alternatives states a width it is not sure of: it corroborates, it does not decide
        const sure = c.widthsCm.length === 1
        agreeing.push({ gapId: g.id, distance: Math.hypot(off, Math.abs(along - mid)), callout: { id: c.id, widthCm: agree.value, confidence: round6(sure ? agree.confidence : Math.min(agree.confidence, 0.5)) } })
      }
    }
    agreeing.sort((p, q) => p.distance - q.distance)
    // two gaps the callout agrees with equally: it belongs to neither
    if (agreeing.length === 0 || (agreeing.length > 1 && agreeing[1].distance - agreeing[0].distance <= wallPx)) continue
    if (!out.has(agreeing[0].gapId)) out.set(agreeing[0].gapId, agreeing[0].callout)
  }
  return out
}

/**
 * Upgrade a gap a printed callout agrees with. A callout states the gap's WIDTH, not what fills it: with a leaf, a
 * vehicle door or glazing drawn across (whatever else kept it from being an opening) it is an opening; with nothing
 * or only a dashed line across it, it is a door-sized question like any blank gap (WEAK), decided by what lies
 * behind it. So is a callout read with alternatives.
 */
export function withCallout(gap: BoundaryGap, callout: GapCallout, maxWideOpeningM: number): BoundaryGap {
  const walls = gap.jambs[0] === 'WALL' && gap.jambs[1] === 'WALL'
  if (!walls || gap.widthM > maxWideOpeningM || gap.cls === 'OPENING_SUPPORTED') return { ...gap, callout }
  const drawn = gap.signature === 'GLAZING' || gap.signature === 'LEAF_AXIS' || gap.signature === 'LEAF_FACE'
  if (drawn && callout.confidence > 0.5) return { ...gap, callout, cls: 'OPENING_SUPPORTED', boundary: 'STRONG', occupancy: 'OPENING', why: `${gap.why}; a callout of ${callout.widthCm} cm printed over it states its width: an opening`, ...because(gap, 'CALLOUT_WITH_DRAWN_INFILL') }
  if (gap.cls === 'UNKNOWN_GAP') return { ...gap, callout }
  return { ...gap, callout, cls: 'UNKNOWN_GAP', boundary: 'WEAK', occupancy: 'OPENING', why: `${gap.why}; a callout of ${callout.widthCm} cm printed over it states its width, not what fills it: decided by what lies behind it`, ...because(gap, 'CALLOUT_STATES_WIDTH_ONLY') }
}

/** The gap's trace with one more reason appended (005K), for a decision taken after its classification. */
export function because(gap: BoundaryGap, reason: GapReason): { trace?: GapTrace } {
  return gap.trace ? { trace: { ...gap.trace, reasons: [...gap.trace.reasons, reason] } } : {}
}

/**
 * Corner openings: a window or door that turns a corner with no solid block at
 * it. Each facade line then ends in a stretch with no wall-thick ink between
 * its last pier and the corner, and the corner itself is only thin lines.
 *
 * A leg — from a line's end pier to a perpendicular grid line inside that end
 * stretch — is bridged when it is no wider than a lintel spans, its pier is a
 * stretch of WALL, glazing (two to four lines inside the wall, stopping at the
 * pier) is drawn along it, and the other facade reaches the corner: the
 * perpendicular line has wall-thick ink within a wall of it, or a leg of its
 * own ending there. A leg with anything less drawn along it is where the wall
 * stops.
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
          // a leg is glazing from a WALL pier (005C post-review): one outline line per leg is a platform's edge, and
          // a free-standing post is no jamb of a facade that turns a corner
          if (piece.kind !== 'WALL' || !piece.along) continue
          const strokes = gapStrokes(mask, line.axis, piece.axisPx, lo, hi, t, end === 'start' ? { right: piece, rightEnds: line.pieces.length === 1 } : { left: piece, leftEnds: line.pieces.length === 1 })
          const { signature, infill: continuous } = gapSignature(strokes, t)
          if (signature !== 'GLAZING') continue
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
