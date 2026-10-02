/**
 * Extent-consistent envelope completion (BUILDPLAN-ANALYZER-005F, pre-reviews C and D).
 *
 * The long-band box (`walledEnvelope`) is cut from long walls, and 005C let the opening-aware outline widen it only
 * where the box's own interior runs on across an edge with neither wall nor opening. Two parts of a building that the
 * outline itself encloses fall through that rule:
 *
 *   an ATTACHED ROOM  beyond the box, joined to the house through a door, a wide opening or a counter line drawn across
 *                     its open side — a bay too shallow for a long band (005E blind 2: a 1 m kitchen bay);
 *   a BOX COMPLETION  inside the box, an end of a room the incumbent grid had no line for — a garage's end wall drawn as
 *                     two piers either side of its door — enclosed by the outline, and thrown away because the outline
 *                     may only replace the box when it adopts something beyond it.
 *
 * And nothing compared the box with the extent the dimension chains state. Here:
 *
 *   ENVELOPE_EXTENT_CONFLICT  a side of the extent that exterior chains state (SUPPORTED: one chain covering the wall
 *                             witness ends on it; STRONG: two such chains on distinct lines agree, or one closing chain
 *                             carries a reading) at least two walls past the box. It is always recorded. It never fills
 *                             anything: it only lets a part that reaches the stated side be judged as an attached room.
 *
 * A part is a connected component of cells the outline encloses and the reading does not build. It is first CLIPPED to
 * its free floor (pixels that are not wall-solid ink, in pieces at least three quarters of a wall across both ways) and
 * the cells within a wall of it: a wall's thickness read twice is no room, and a body is as tall as its own walls, not
 * as the grid cell that holds it. Then it is judged:
 *
 *   BOX_COMPLETION  inside the box, when nothing beyond the box was adopted: it continues built cells across open edge
 *                   of at least max(0.7 m, half the shared length) — a room's end, not a yard behind a wall;
 *   ATTACHED_ROOM   beyond the box, in a STRONG conflict's stretch and reaching its stated side, when all hold: a way in
 *                   from the house (open edge plus door-like bridged gaps ≥ 0.7 m — glazing is no way in, a post is no
 *                   jamb); its own perimeter at least half wall and under a tenth posts; room evidence (glazing between
 *                   wall jambs, a dimension chain measuring it, or a vehicle door); two return walls across its depth;
 *
 * and, for both: inside the extent; enclosed with drawn openings only (STRICT) too, or closed on every other gap by a
 * vehicle door — wall jambs, 2.2–3.2 m, a stroke drawn in it (never blank), a vehicle's depth behind it — which then
 * closes the topology in both readings and stays an opening (005C semantics); no larger than half of what the box
 * builds, and all completions together no larger either. Nothing here reads a published figure, a house name or a
 * protrusion threshold; a terrace on posts, a pergola, a canopy or line work encloses nothing and is never a part.
 */
import { round6 } from '@buildapp/source-common'
import type { PixelRect } from '@buildapp/source-common'
import type { BoundaryGap, SolidLayer, WallLine } from './boundary-evidence.js'
import type { OutlineEdge, OutlineResult } from './boundary-outline.js'

export type ExtentSide = 'W' | 'E' | 'N' | 'S'
export type ExtentStrength = 'SUPPORTED' | 'STRONG'

/** A side of the plan's extent that exterior dimension chains state, and how strongly (`extentSidesOf` in layout). */
export type ExtentSideStatement = { side: ExtentSide; atPx: number; strength: ExtentStrength; chainIds: string[] }

export const COMPLETION_BOUNDS = {
  /** A conflict: the extent's stated side lies at least this many walls past the box's face. */
  conflictWalls: 2,
  /** A stretch of a side no built cell explains: at least this many walls long; at most `stretchesPerSide` per side. */
  stretchWalls: 2,
  stretchesPerSide: 2,
  /** A way in: a door's width. */
  doorM: 0.7,
  /** A part's own perimeter: at least this share wall, under `postShare` posts. */
  sideWallShare: 0.5,
  postShare: 0.1,
  /** Free floor: a piece of non-wall pixels at least this many walls across both ways; a core cell this share free floor. */
  freeFloorWalls: 0.75,
  coreShare: 0.25,
  /** A continuation: open edge with built cells at least max(doorM, this share of the shared length). */
  continueShare: 0.5,
  /** A return wall: a perpendicular wall line whose wall ink covers this share of the strip's depth. */
  returnCover: 0.75,
  /** A vehicle door: wall jambs, this wide, a vehicle's length deep behind it. */
  vehicleMinM: 2.2,
  vehicleMaxM: 3.2,
  vehicleDepthM: 4.5,
  /** A part, and all completions together, no larger than this share of what the box builds. */
  partShare: 0.5,
  /** At most this many parts judged per plan. */
  maxParts: 16,
} as const

export type CompletionKind = 'ATTACHED_ROOM' | 'BOX_COMPLETION'
export type CompletionDecision = 'ACCEPTED' | 'REJECTED' | 'QUESTION'

/** One part the outline encloses and the reading does not build, before and after its clip, and what became of it. */
export type CompletionPart = {
  kind: CompletionKind
  decision: CompletionDecision
  /** The guard that decided a rejection or a question, or the rule that accepted it. */
  reason: string
  cellsBefore: number
  rectBefore: PixelRect
  areaBeforeM2: number
  cells: Array<{ ix: number; iy: number }>
  rect: PixelRect
  areaM2: number
  /** The edge shared with the house: its length, the open part of it and the door-like bridged part. */
  junction: { lengthM: number; openM: number; doorM: number }
  /** Its own perimeter: length, wall and post shares. */
  sides: { lengthM: number; wallShare: number; postShare: number }
  evidence: { glazing: number; chains: number; vehicleDoors: number; returns: number; strictEncloses: boolean }
  /** The gaps its own perimeter leaves to the WEAK bridges: the closures the two readings may disagree on. */
  weakGaps: Array<{ widthM: number; signature: BoundaryGap['signature']; jambs: BoundaryGap['jambs']; vehicleDoor: boolean }>
  /** The conflict side it reaches, for an attached room. */
  side?: ExtentSide
}

export type ExtentConflict = {
  side: ExtentSide
  strength: ExtentStrength
  chainIds: string[]
  extentPx: number
  boxPx: number
  gapPx: number
  gapWalls: number
  gapM: number
  /** Stretches of the side no built cell explains, along the side's axis (the longest `stretchesPerSide`). */
  stretches: Array<{ fromPx: number; toPx: number }>
  /** Stretches the cap left out (B5F-10). */
  stretchesOmitted?: number
  /** ACCEPTED: an attached room explains it; ZONE: nothing enclosed reaches it; INCONCLUSIVE: something enclosed reaches it and fails; RECORDED: SUPPORTED only — recorded, never acted on. */
  decision: 'ACCEPTED' | 'ZONE' | 'INCONCLUSIVE' | 'RECORDED'
  why: string
}

/** `unjudged`: parts the `maxParts` cap left unjudged (judged largest first, so a room is never starved by slivers). */
export type CompletionResult = { conflicts: ExtentConflict[]; parts: CompletionPart[]; accepted: Uint8Array; addedM2: number; unjudged: number }

export type CompletionInput = {
  linesX: readonly number[]
  linesY: readonly number[]
  wallsX: readonly WallLine[]
  wallsY: readonly WallLine[]
  mppX: number
  mppY: number
  wallPx: number
  /** The reading's outline (EXCLUSION, or the one that shut garage mouths) and the drawn-openings-only one. */
  outline: OutlineResult
  strict: OutlineResult
  /** The long-band box's cells, the cells the box's own reading built, and those 005C adopted beyond the box. */
  inA: Uint8Array
  builtA: Uint8Array
  accepted: Uint8Array
  box: PixelRect | null
  extent: PixelRect
  solid: SolidLayer
  sides: readonly ExtentSideStatement[]
  /** The frame's dimension chains: room evidence when one measures a part. */
  chains: ReadonlyArray<{ axis: 'HORIZONTAL' | 'VERTICAL'; baselinePx: number; ticksPx: readonly number[] }>
}

type Interval = [number, number]
const coverOf = (intervals: readonly Interval[], a: number, b: number): number => {
  const clipped = intervals
    .map(([p, q]) => [Math.max(p, a), Math.min(q, b)] as Interval)
    .filter(([p, q]) => q > p)
    .sort((p, q) => p[0] - q[0])
  let total = 0
  let reach = -Infinity
  for (const [p, q] of clipped) {
    const s = Math.max(p, reach)
    if (q > s) total += q - s
    reach = Math.max(reach, q)
  }
  return total
}

type Neighbour = { j: number; edge: OutlineEdge; line: WallLine; a: number; b: number; lengthM: number; axis: 'X' | 'Y'; at: number }

/** Judge every part the outline encloses and the reading does not build, against the extent's stated sides. */
export function completeBoundary(input: CompletionInput): CompletionResult {
  const { linesX: LX, linesY: LY, wallsX, wallsY, mppX, mppY, wallPx: W, outline, strict, inA, builtA, accepted, box, extent, solid } = input
  const B = COMPLETION_BOUNDS
  const nx = LX.length - 1
  const ny = LY.length - 1
  const index = (ix: number, iy: number): number => iy * nx + ix
  const anyAdopted = accepted.some((v) => v === 1)
  const areaOf = (k: number): number => {
    const x = k % nx
    const y = (k - x) / nx
    return (LX[x + 1] - LX[x]) * mppX * (LY[y + 1] - LY[y]) * mppY
  }
  const rectOfCell = (k: number): PixelRect => {
    const x = k % nx
    const y = (k - x) / nx
    return { x0: LX[x], x1: LX[x + 1], y0: LY[y], y1: LY[y + 1] }
  }
  const rectOf = (members: readonly number[]): PixelRect => {
    const r = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
    for (const k of members) {
      const q = rectOfCell(k)
      r.x0 = Math.min(r.x0, q.x0)
      r.x1 = Math.max(r.x1, q.x1)
      r.y0 = Math.min(r.y0, q.y0)
      r.y1 = Math.max(r.y1, q.y1)
    }
    return { x0: round6(r.x0), y0: round6(r.y0), x1: round6(r.x1), y1: round6(r.y1) }
  }
  const neighbours = (k: number): Neighbour[] => {
    const x = k % nx
    const y = (k - x) / nx
    return [
      { j: y > 0 ? k - nx : -1, edge: outline.hEdge[y][x], line: wallsY[y], a: LX[x], b: LX[x + 1], lengthM: (LX[x + 1] - LX[x]) * mppX, axis: 'Y', at: LY[y] },
      { j: x < nx - 1 ? k + 1 : -1, edge: outline.vEdge[x + 1][y], line: wallsX[x + 1], a: LY[y], b: LY[y + 1], lengthM: (LY[y + 1] - LY[y]) * mppY, axis: 'X', at: LX[x + 1] },
      { j: y < ny - 1 ? k + nx : -1, edge: outline.hEdge[y + 1][x], line: wallsY[y + 1], a: LX[x], b: LX[x + 1], lengthM: (LX[x + 1] - LX[x]) * mppX, axis: 'Y', at: LY[y + 1] },
      { j: x > 0 ? k - 1 : -1, edge: outline.vEdge[x][y], line: wallsX[x], a: LY[y], b: LY[y + 1], lengthM: (LY[y + 1] - LY[y]) * mppY, axis: 'X', at: LX[x] },
    ]
  }
  const shareOf = (n: Neighbour, kind: 'WALL' | 'POST'): number => coverOf(n.line.pieces.filter((p) => p.kind === kind).map((p) => [p.from, p.to] as Interval), n.a, n.b) / Math.max(1e-9, n.b - n.a)
  const gapsOn = (n: Neighbour): BoundaryGap[] => n.line.gaps.filter((g) => Math.min(g.toPx, n.b) - Math.max(g.fromPx, n.a) > 0)
  // A door-like opening: bridged, not glazing, a door wide, between wall jambs.
  const doorLike = (n: Neighbour): boolean => n.edge.bridged > 0 && gapsOn(n).some((g) => g.boundary !== 'NONE' && g.signature !== 'GLAZING' && g.widthM >= B.doorM && g.jambs[0] !== 'POST' && g.jambs[1] !== 'POST')
  // An edge one walks across: no ink closes it, or a door-like opening bridges it (005C `adopt`'s propagation). A solid
  // wall, or a wall with only a window in it, is not one.
  const passable = (n: Neighbour): boolean => !n.edge.closed || doorLike(n)
  const components = (want: (k: number) => boolean): number[][] => {
    const seen = new Uint8Array(nx * ny)
    const out: number[][] = []
    for (let k0 = 0; k0 < nx * ny; k0 += 1) {
      if (seen[k0] === 1 || !want(k0)) continue
      const members: number[] = []
      const stack = [k0]
      seen[k0] = 1
      while (stack.length > 0) {
        const k = stack.pop() as number
        members.push(k)
        for (const n of neighbours(k)) {
          if (n.j < 0 || seen[n.j] === 1 || !want(n.j)) continue
          seen[n.j] = 1
          stack.push(n.j)
        }
      }
      out.push(members.sort((p, q) => p - q))
    }
    return out
  }
  const builtM2 = [...builtA.keys()].filter((k) => builtA[k] === 1).reduce((a, k) => a + areaOf(k), 0)
  const isWallPixel = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= solid.width || y >= solid.height) return false
    const label = solid.labels[y * solid.width + x]
    return label > 0 && solid.parts[label - 1].kind === 'WALL'
  }

  // --- the extent's stated sides against the box ---
  const conflicts: ExtentConflict[] = []
  if (box) {
    for (const s of input.sides) {
      const horizontal = s.side === 'W' || s.side === 'E'
      const dir = s.side === 'E' || s.side === 'S' ? 1 : -1
      const boxPx = s.side === 'W' ? box.x0 : s.side === 'E' ? box.x1 : s.side === 'N' ? box.y0 : box.y1
      const gapPx = dir * (s.atPx - boxPx)
      if (gapPx < B.conflictWalls * W) continue
      // Stretches: the side's span where no built cell (the box's reading, or adopted) reaches within a wall of it.
      const [lo, hi] = horizontal ? [extent.y0, extent.y1] : [extent.x0, extent.x1]
      const explained: Interval[] = []
      for (let k = 0; k < nx * ny; k += 1) {
        if (builtA[k] !== 1 && accepted[k] !== 1) continue
        const r = rectOfCell(k)
        const outer = s.side === 'W' ? r.x0 : s.side === 'E' ? r.x1 : s.side === 'N' ? r.y0 : r.y1
        if (Math.abs(outer - s.atPx) <= W) explained.push(horizontal ? [r.y0, r.y1] : [r.x0, r.x1])
      }
      const free: Interval[] = []
      let at = lo
      for (const [p, q] of [...explained].sort((u, v) => u[0] - v[0])) {
        if (p > at) free.push([at, p])
        at = Math.max(at, q)
      }
      if (hi > at) free.push([at, hi])
      const long = free.filter(([p, q]) => q - p >= B.stretchWalls * W)
      const stretches = long
        .sort((u, v) => v[1] - v[0] - (u[1] - u[0]) || u[0] - v[0])
        .slice(0, B.stretchesPerSide)
        .sort((u, v) => u[0] - v[0])
        .map(([p, q]) => ({ fromPx: round6(p), toPx: round6(q) }))
      if (stretches.length === 0) continue
      conflicts.push({
        side: s.side,
        strength: s.strength,
        chainIds: [...s.chainIds],
        extentPx: round6(s.atPx),
        boxPx: round6(boxPx),
        gapPx: round6(gapPx),
        gapWalls: round6(gapPx / W),
        gapM: round6(gapPx * (horizontal ? mppX : mppY)),
        stretches,
        ...(long.length > stretches.length ? { stretchesOmitted: long.length - stretches.length } : {}),
        decision: s.strength === 'STRONG' ? 'ZONE' : 'RECORDED',
        why: '',
      })
    }
  }

  // --- the parts ---
  const parts: CompletionPart[] = []
  const acceptedOut = new Uint8Array(nx * ny)
  let addedM2 = 0
  const judge = (kind: CompletionKind, before: readonly number[], house: (k: number) => boolean): void => {
    if (parts.length >= B.maxParts) return
    const rectBefore = rectOf(before)
    const areaBeforeM2 = before.reduce((a, k) => a + areaOf(k), 0)
    // C1–C3 the clip: free floor in pieces at least three quarters of a wall across, core cells a quarter free floor,
    // and the cells within a wall of a core cell (the part's own walls).
    const X0 = Math.ceil(rectBefore.x0)
    const Y0 = Math.ceil(rectBefore.y0)
    const w = Math.max(1, Math.ceil(rectBefore.x1) - X0)
    const h = Math.max(1, Math.ceil(rectBefore.y1) - Y0)
    const inPart = new Uint8Array(w * h)
    for (const k of before) {
      const q = rectOfCell(k)
      for (let y = Math.ceil(q.y0); y < q.y1; y += 1) for (let x = Math.ceil(q.x0); x < q.x1; x += 1) if (!isWallPixel(x, y) && x - X0 < w && y - Y0 < h) inPart[(y - Y0) * w + (x - X0)] = 1
    }
    const label = new Int32Array(w * h)
    const wide: boolean[] = [false]
    for (let i0 = 0; i0 < w * h; i0 += 1) {
      if (inPart[i0] !== 1 || label[i0] !== 0) continue
      const id = wide.length
      label[i0] = id
      let bx0 = Infinity
      let bx1 = -Infinity
      let by0 = Infinity
      let by1 = -Infinity
      const stack = [i0]
      while (stack.length > 0) {
        const i = stack.pop() as number
        const x = i % w
        const y = (i - x) / w
        bx0 = Math.min(bx0, x)
        bx1 = Math.max(bx1, x)
        by0 = Math.min(by0, y)
        by1 = Math.max(by1, y)
        for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
          if (j < 0 || inPart[j] !== 1 || label[j] !== 0) continue
          label[j] = id
          stack.push(j)
        }
      }
      wide.push(Math.min(bx1 - bx0 + 1, by1 - by0 + 1) >= B.freeFloorWalls * W)
    }
    const core = before.filter((k) => {
      const q = rectOfCell(k)
      let free = 0
      let total = 0
      for (let y = Math.ceil(q.y0); y < q.y1; y += 1) {
        for (let x = Math.ceil(q.x0); x < q.x1; x += 1) {
          total += 1
          const l = x - X0 < w && y - Y0 < h ? label[(y - Y0) * w + (x - X0)] : 0
          if (l > 0 && wide[l]) free += 1
        }
      }
      return total > 0 && free / total >= B.coreShare
    })
    // C4 (005F post-review C5F-2): the part is what one reaches from the house — across open edges and door-like
    // openings, never through a solid wall. A room walled off beside it is not part of it, however the cells connect.
    const inBefore = new Set(before)
    const reached = new Set<number>()
    const queue: number[] = []
    for (const k of before) if (neighbours(k).some((n) => n.j >= 0 && !inBefore.has(n.j) && house(n.j) && passable(n))) {
      reached.add(k)
      queue.push(k)
    }
    while (queue.length > 0) {
      const k = queue.shift() as number
      for (const n of neighbours(k)) {
        if (n.j < 0 || !inBefore.has(n.j) || reached.has(n.j) || !passable(n)) continue
        reached.add(n.j)
        queue.push(n.j)
      }
    }
    const allCore = core
    const walledOff = allCore.filter((k) => !reached.has(k))
    const coreSet = new Set(allCore.filter((k) => reached.has(k)))
    const nearCore = (k: number): boolean => {
      const t = rectOfCell(k)
      return [...coreSet].some((q) => {
        const c = rectOfCell(q)
        // side-on, overlapping along the shared side, or corner-diagonal: within a wall both ways
        const gapX = Math.max(c.x0 - t.x1, t.x0 - c.x1)
        const gapY = Math.max(c.y0 - t.y1, t.y0 - c.y1)
        return gapX <= W && gapY <= W
      })
    }
    // the reached rooms and their own walls (cells of no free floor within a wall of them) — never another room's floor
    const anyCore = new Set(allCore)
    const kept = before.filter((k) => coreSet.has(k) || (!anyCore.has(k) && nearCore(k)))
    const mine = new Set(kept)
    // the house's own edges with the part: a window in them is the house's, not the part's (C5F-1)
    const junctionLines: Array<{ axis: 'X' | 'Y'; at: number; a: number; b: number }> = []
    const rect = kept.length > 0 ? rectOf(kept) : rectBefore
    const areaM2 = kept.reduce((a, k) => a + areaOf(k), 0)
    // the junction with the house, its own perimeter, and what is drawn on it
    let shared = 0
    let open = 0
    let doorway = 0
    let side = 0
    let sideWall = 0
    let sidePost = 0
    const sideGaps = new Map<string, BoundaryGap>()
    for (const k of kept) {
      for (const n of neighbours(k)) {
        if (n.j >= 0 && mine.has(n.j)) continue
        if (n.j >= 0 && house(n.j)) {
          shared += n.lengthM
          junctionLines.push({ axis: n.axis, at: n.at, a: n.a, b: n.b })
          if (!n.edge.closed) open += n.lengthM
          else if (doorLike(n)) doorway += n.lengthM * n.edge.bridged
          continue
        }
        side += n.lengthM
        sideWall += n.lengthM * shareOf(n, 'WALL')
        sidePost += n.lengthM * shareOf(n, 'POST')
        for (const g of gapsOn(n)) if (!sideGaps.has(g.id)) sideGaps.set(g.id, g)
      }
    }
    // Glazing of its own: a STRONG glazed gap between wall jambs on a line within the part's span — the same half wall
    // either side, whichever way up the plan is drawn (C5F-1) — and not on the edge it shares with the house.
    let glazing = 0
    for (const line of [...wallsX, ...wallsY]) {
      for (const g of line.gaps) {
        if (g.signature !== 'GLAZING' || g.boundary !== 'STRONG' || g.jambs.includes('POST')) continue
        const within =
          g.axis === 'X'
            ? g.linePx >= rect.x0 - 0.5 * W && g.linePx <= rect.x1 + 0.5 * W && g.fromPx >= rect.y0 - W && g.toPx <= rect.y1 + W
            : g.linePx >= rect.y0 - 0.5 * W && g.linePx <= rect.y1 + 0.5 * W && g.fromPx >= rect.x0 - W && g.toPx <= rect.x1 + W
        const onJunction = junctionLines.some((j) => j.axis === g.axis && Math.abs(j.at - g.linePx) <= W && Math.min(j.b, g.toPx) - Math.max(j.a, g.fromPx) > 0)
        if (within && !onJunction) glazing += 1
      }
    }
    // A chain measuring it (C5F-3): drawn across the part, with ticks within a wall of both of its ends along the chain.
    const chains = input.chains.filter((c) => {
      const [p0, p1] = c.axis === 'HORIZONTAL' ? [rect.x0, rect.x1] : [rect.y0, rect.y1]
      const across = c.axis === 'HORIZONTAL' ? c.baselinePx > rect.y0 && c.baselinePx < rect.y1 : c.baselinePx > rect.x0 && c.baselinePx < rect.x1
      return across && c.ticksPx.some((t) => Math.abs(t - p0) <= W) && c.ticksPx.some((t) => Math.abs(t - p1) <= W)
    }).length
    const depthBehind = (g: BoundaryGap): number => (g.axis === 'Y' ? (rect.y1 - rect.y0) * mppY : (rect.x1 - rect.x0) * mppX)
    const vehicle = [...sideGaps.values()].filter(
      (g) => g.boundary !== 'NONE' && g.jambs[0] === 'WALL' && g.jambs[1] === 'WALL' && g.widthM >= B.vehicleMinM && g.widthM <= B.vehicleMaxM && g.signature !== 'BLANK' && g.signature !== 'GLAZING',
    )
    const wallShare = side > 0 ? sideWall / side : 0
    const postShare = side > 0 ? sidePost / side : 0
    const inExtent = rect.x0 >= extent.x0 - 0.5 * W && rect.x1 <= extent.x1 + 0.5 * W && rect.y0 >= extent.y0 - 0.5 * W && rect.y1 <= extent.y1 + 0.5 * W
    const strictEncloses = kept.length > 0 && kept.every((k) => strict.inside[k] === 1)
    // A vehicle door closes the topology in both readings only with a vehicle's length behind it — through the part and
    // the built cells it continues (a garage's end is a few metres of a garage several metres deep).
    const houseDepth = (g: BoundaryGap): number => {
      let depth = depthBehind(g)
      if (kind === 'BOX_COMPLETION') {
        // the floor a vehicle drives onto: from the part, across open edges only (never through a wall), through the
        // built cells in the door's band — a search over edges, so the answer does not depend on which way up the plan
        // is drawn (177dfca) nor on a room behind a wall (C5F-4)
        const along = g.axis === 'Y' ? [rect.x0, rect.x1] : [rect.y0, rect.y1]
        const inBand = (k: number): boolean => {
          const r = rectOfCell(k)
          const [p, q] = g.axis === 'Y' ? [r.x0, r.x1] : [r.y0, r.y1]
          return Math.min(q, along[1]) - Math.max(p, along[0]) > 0
        }
        let reach = g.axis === 'Y' ? [rect.y0, rect.y1] : [rect.x0, rect.x1]
        const seen = new Set<number>(kept)
        const stack = [...kept]
        while (stack.length > 0) {
          const k = stack.pop() as number
          for (const n of neighbours(k)) {
            if (n.j < 0 || seen.has(n.j) || n.edge.closed || !house(n.j) || !inBand(n.j)) continue
            seen.add(n.j)
            stack.push(n.j)
            const r = rectOfCell(n.j)
            const [u, v] = g.axis === 'Y' ? [r.y0, r.y1] : [r.x0, r.x1]
            reach = [Math.min(reach[0], u), Math.max(reach[1], v)]
          }
        }
        depth = (reach[1] - reach[0]) * (g.axis === 'Y' ? mppY : mppX)
      }
      return depth
    }
    const vehicleDoors = vehicle.filter((g) => houseDepth(g) >= B.vehicleDepthM)
    const weakClosedByVehicle = [...sideGaps.values()].filter((g) => g.boundary === 'WEAK').every((g) => vehicleDoors.includes(g))
    const policiesAgree = strictEncloses || weakClosedByVehicle
    // returns: perpendicular wall lines across the part whose wall ink covers most of its depth (an attached room's sides)
    const returnsAcross = (sideOf: ExtentSide | undefined): number => {
      if (!sideOf) return 0
      const horizontal = sideOf === 'W' || sideOf === 'E'
      const perp = horizontal ? wallsY : wallsX
      const plines = horizontal ? LY : LX
      const [d0, d1] = horizontal ? [rect.x0, rect.x1] : [rect.y0, rect.y1]
      const [c0, c1] = horizontal ? [rect.y0, rect.y1] : [rect.x0, rect.x1]
      const found: number[] = []
      plines.forEach((p, i) => {
        if (p < c0 - W || p > c1 + W) return
        const cover = coverOf(perp[i].pieces.filter((q) => q.kind === 'WALL').map((q) => [q.from, q.to] as Interval), d0, d1) / Math.max(1, d1 - d0)
        if (cover >= B.returnCover && !found.some((f) => Math.abs(f - p) <= W * 1.5)) found.push(p)
      })
      return found.length
    }
    // the conflict side an attached room reaches (E1): its outer edge within a wall of a STRONG stated side, in a stretch
    let reaches: ExtentConflict | undefined
    if (kind === 'ATTACHED_ROOM') {
      for (const c of conflicts) {
        if (c.strength !== 'STRONG') continue
        const horizontal = c.side === 'W' || c.side === 'E'
        const outer = c.side === 'W' ? rect.x0 : c.side === 'E' ? rect.x1 : c.side === 'N' ? rect.y0 : rect.y1
        const [p, q] = horizontal ? [rect.y0, rect.y1] : [rect.x0, rect.x1]
        if (Math.abs(outer - c.extentPx) <= W && c.stretches.some((s) => Math.min(q, s.toPx) - Math.max(p, s.fromPx) > 0)) {
          reaches = c
          break
        }
      }
    }
    const returns = returnsAcross(reaches?.side)
    const continues = open >= Math.max(B.doorM, B.continueShare * shared)
    // a dashed line across a mouth is as much a roof edge as an overhead door: it closes a garage's end (BOX_COMPLETION),
    // never makes a room by itself (C5F-5)
    const roomDoors = vehicleDoors.filter((g) => g.signature !== 'DASHED')
    const room = open + doorway >= B.doorM && wallShare >= B.sideWallShare && postShare < B.postShare && (glazing > 0 || chains > 0 || roomDoors.length > 0)
    let decision: CompletionDecision = 'ACCEPTED'
    let reason: string
    if (core.length === 0) {
      decision = 'REJECTED'
      reason = 'WALL_SLIVER: no free floor three quarters of a wall across — the thickness of a wall, not a room'
    } else if (coreSet.size === 0 && shared > 0) {
      decision = 'REJECTED'
      reason = 'WALLED_OFF: no open edge or door reaches it from the house — a room or a yard behind a wall'
    } else if (shared === 0) {
      decision = 'REJECTED'
      reason = 'SEPARATE: it shares no edge with the house'
    } else if (kind === 'BOX_COMPLETION' && !continues) {
      decision = 'REJECTED'
      reason = `NO_CONTINUATION: ${open.toFixed(2)} m of open edge with the built rooms of ${shared.toFixed(2)} m shared — walled off from them, not their end`
    } else if (kind === 'ATTACHED_ROOM' && !reaches) {
      decision = 'REJECTED'
      reason = 'NO_STRONG_EXTENT: no side the chains strongly state lies past the box where it reaches'
    } else if (kind === 'ATTACHED_ROOM' && !room) {
      decision = 'REJECTED'
      reason = open + doorway < B.doorM ? `NO_WAY_IN: ${(open + doorway).toFixed(2)} m of open edge and door-like openings into the house` : postShare >= B.postShare ? `POSTS: ${Math.round(postShare * 100)}% of its perimeter is posts — a terrace or a canopy` : wallShare < B.sideWallShare ? `NOT_WALLED: ${Math.round(wallShare * 100)}% of its perimeter is wall` : 'NO_ROOM_EVIDENCE: no glazing of its own between wall jambs, no chain measuring it, no vehicle door drawn as a leaf'
    } else if (kind === 'ATTACHED_ROOM' && returns < 2) {
      decision = 'REJECTED'
      reason = `NO_RETURNS: ${returns} wall line${returns === 1 ? '' : 's'} run across its depth; an attached room has two`
    } else if (!inExtent) {
      decision = 'REJECTED'
      reason = 'BEYOND_EXTENT: it reaches past the extent the chains state'
    } else if (areaM2 > B.partShare * builtM2 || addedM2 + areaM2 > B.partShare * builtM2) {
      decision = 'QUESTION'
      reason = `TOO_LARGE: ${areaM2.toFixed(1)} m² against the ${builtM2.toFixed(1)} m² the box builds — then the box is the wrong object, not this part`
    } else if (!policiesAgree) {
      decision = 'QUESTION'
      reason = 'POLICIES_DISAGREE: drawn openings alone do not enclose it and no vehicle door closes it'
    } else reason = kind === 'BOX_COMPLETION' ? `CONTINUATION: ${open.toFixed(2)} m of open edge with the built rooms it ends` : `ATTACHED_ROOM: ${(open + doorway).toFixed(2)} m way in, ${Math.round(wallShare * 100)}% walled, ${glazing > 0 ? 'glazed' : chains > 0 ? 'measured by a chain' : 'a vehicle door'}, ${returns} returns, reaching the ${reaches?.side} side the chains state`
    if (decision === 'ACCEPTED') {
      addedM2 += areaM2
      for (const k of kept) acceptedOut[k] = 1
    }
    if (reaches && kind === 'ATTACHED_ROOM') {
      if (decision === 'ACCEPTED') reaches.decision = 'ACCEPTED'
      else if (reaches.decision === 'ZONE') reaches.decision = 'INCONCLUSIVE'
    }
    parts.push({
      kind,
      decision,
      reason,
      cellsBefore: before.length,
      rectBefore,
      areaBeforeM2: round6(areaBeforeM2),
      cells: kept.map((k) => ({ ix: k % nx, iy: Math.floor(k / nx) })),
      rect,
      areaM2: round6(areaM2),
      junction: { lengthM: round6(shared), openM: round6(open), doorM: round6(doorway) },
      sides: { lengthM: round6(side), wallShare: round6(wallShare), postShare: round6(postShare) },
      evidence: { glazing, chains, vehicleDoors: vehicleDoors.length, returns, strictEncloses },
      weakGaps: [...sideGaps.values()].filter((g) => g.boundary === 'WEAK').map((g) => ({ widthM: round6(g.widthM), signature: g.signature, jambs: g.jambs, vehicleDoor: vehicleDoors.includes(g) })),
      ...(reaches ? { side: reaches.side } : {}),
    })
    // what lies beside it behind a wall is recorded on its own, never carried in with it (C5F-2)
    if (walledOff.length > 0 && coreSet.size > 0 && parts.length < B.maxParts) {
      const off = before.filter((k) => !mine.has(k) && (walledOff.includes(k) || walledOff.some((q) => {
        const c = rectOfCell(q)
        const t = rectOfCell(k)
        return Math.max(c.x0 - t.x1, t.x0 - c.x1) <= W && Math.max(c.y0 - t.y1, t.y0 - c.y1) <= W
      })))
      const offRect = rectOf(off)
      const offM2 = off.reduce((a, k) => a + areaOf(k), 0)
      parts.push({
        kind,
        decision: 'REJECTED',
        reason: 'WALLED_OFF: enclosed beside it behind a wall, with no open edge or door from the house or from it',
        cellsBefore: before.length,
        rectBefore,
        areaBeforeM2: round6(areaBeforeM2),
        cells: off.map((k) => ({ ix: k % nx, iy: Math.floor(k / nx) })),
        rect: offRect,
        areaM2: round6(offM2),
        junction: { lengthM: 0, openM: 0, doorM: 0 },
        sides: { lengthM: 0, wallShare: 0, postShare: 0 },
        evidence: { glazing: 0, chains: 0, vehicleDoors: 0, returns: 0, strictEncloses: off.every((k) => strict.inside[k] === 1) },
        weakGaps: [],
      })
    }
  }
  // Largest first (B5F-1): the cap bounds the work, and wall slivers in scan order must not use it up before a room.
  const largestFirst = (groups: number[][]): number[][] =>
    groups.map((g) => ({ g, a: g.reduce((t, k) => t + areaOf(k), 0) })).sort((u, v) => v.a - u.a || u.g[0] - v.g[0]).map((x) => x.g)
  let unjudged = 0
  // Beyond the box: enclosed, not adopted. The house it attaches to is what the reading builds.
  for (const members of largestFirst(components((k) => outline.inside[k] === 1 && inA[k] === 0 && accepted[k] === 0))) {
    if (parts.length >= B.maxParts) unjudged += 1
    else judge('ATTACHED_ROOM', members, (k) => builtA[k] === 1 || accepted[k] === 1)
  }
  // Inside the box, when nothing beyond it was adopted: enclosed, not built by the box's own reading.
  if (!anyAdopted) {
    for (const members of largestFirst(components((k) => outline.inside[k] === 1 && inA[k] === 1 && builtA[k] === 0))) {
      if (parts.length >= B.maxParts) unjudged += 1
      else judge('BOX_COMPLETION', members, (k) => builtA[k] === 1)
    }
  }
  // a side no judged part reached cannot claim that nothing enclosed reaches it while parts went unjudged
  if (unjudged > 0) for (const c of conflicts) if (c.decision === 'ZONE') c.decision = 'INCONCLUSIVE'
  for (const c of conflicts) {
    c.why =
      c.decision === 'RECORDED'
        ? `one exterior chain states the ${c.side} side ${c.gapM.toFixed(2)} m past the box: recorded, not acted on`
        : c.decision === 'ACCEPTED'
          ? `the ${c.side} side the chains state ${c.gapM.toFixed(2)} m past the box is an attached room's outer wall`
          : c.decision === 'INCONCLUSIVE'
            ? unjudged > 0 && !parts.some((p) => p.side === c.side)
              ? `the ${c.side} side the chains state ${c.gapM.toFixed(2)} m past the box: ${unjudged} enclosed part${unjudged === 1 ? '' : 's'} went unjudged under the cap — nothing is built, and nothing is ruled out`
              : `something enclosed reaches the ${c.side} side the chains state ${c.gapM.toFixed(2)} m past the box, and fails the attached-room guards: nothing is built`
            : `nothing enclosed reaches the ${c.side} side the chains state ${c.gapM.toFixed(2)} m past the box: a terrace, a canopy or ground — nothing is built`
  }
  return { conflicts, parts, accepted: acceptedOut, addedM2: round6(addedM2), unjudged }
}
