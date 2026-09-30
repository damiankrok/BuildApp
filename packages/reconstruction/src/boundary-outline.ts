/**
 * The building's outline from its boundary evidence (BUILDPLAN-ANALYZER-005C).
 *
 * A flood over the plan's structural grid, from the grid's border inwards,
 * that only wall-thick ink and bridged openings stop. Line work never stops
 * it: a terrace outline, a paving edge, a canopy, a dashed overhead line or a
 * watermark encloses nothing here. The cells it cannot reach are the outline.
 *
 * Openings are bridged in two strengths:
 *
 *   STRONG  the drawing says so — glazing, a door leaf, a vehicle door, a
 *           callout printing the gap's width (`boundary-evidence.ts`);
 *   WEAK    a door-sized gap between two walls with nothing drawn across it.
 *           Its width cannot tell a doorway from the mouth of a recess, so it
 *           is decided by what lies BEHIND it: left open, would it let the
 *           outside into more than a pocket as deep as its mouth is wide? The
 *           rule is the pipeline's own (`max(6 m², 2.5 · width²)`, the pocket
 *           test of the enclosure hypotheses). A loggia, a recessed entrance, a
 *           porch between returns stays open; the front door of a house does not.
 *
 * The weak gaps are decided to a fixpoint in a fixed order: a gap is judged
 * only when the outside already reaches one side of it, and a mouth left open
 * exposes what is behind it to the next judgement (a loggia's glazed door).
 *
 * Bounded: one flood per judgement, at most `MAX_WEAK_GAPS` judged per plan.
 */
import { round6 } from '@buildapp/source-common'
import type { BoundaryGap, WallLine } from './boundary-evidence.js'

/** How many weak gaps one plan may have judged by what lies behind them. */
export const MAX_WEAK_GAPS = 48

export type OutlineEdge = {
  /** Wall-thick ink along the edge, as a share of it. */
  solid: number
  /** Bridged openings along it, as a share of it. */
  bridged: number
  /** True when ink and bridges cover it: the outline's flood stops here. */
  closed: boolean
}

export type OutlineGrid = {
  linesX: readonly number[]
  linesY: readonly number[]
  /** The wall line read along each grid line, same order as the lines. */
  wallsX: readonly WallLine[]
  wallsY: readonly WallLine[]
  mppX: number
  mppY: number
  wallPx: number
}

export type OutlineResult = {
  /** Per cell (row-major, `iy * nx + ix`): 1 inside the outline. */
  inside: Uint8Array
  nx: number
  ny: number
  /** vEdge[ix][iy], hEdge[iy][ix], as the decomposition indexes its edges. */
  vEdge: OutlineEdge[][]
  hEdge: OutlineEdge[][]
  /** Gaps bridged, by strength, and the weak ones left open as pocket mouths. */
  bridged: { strong: BoundaryGap[]; weak: Array<{ gap: BoundaryGap; exposedM2: number; limitM2: number }> }
  pocketMouths: Array<{ gap: BoundaryGap; exposedM2: number; limitM2: number }>
  /** Weak gaps the flood never reached from outside: interior doorways, irrelevant to the outline. */
  unjudged: number
  floods: number
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

/** Solve the outline on a grid whose lines have been read for wall ink. */
export function solveOutline(grid: OutlineGrid): OutlineResult {
  const { linesX, linesY, wallsX, wallsY, mppX, mppY, wallPx } = grid
  const nx = linesX.length - 1
  const ny = linesY.length - 1
  const tolerance = Math.max(2, Math.round(wallPx * 0.25))
  const allGaps = [...wallsX, ...wallsY].flatMap((l) => l.gaps)
  const strong = allGaps.filter((g) => g.boundary === 'STRONG')
  const weak = allGaps.filter((g) => g.boundary === 'WEAK').sort((p, q) => (p.id < q.id ? -1 : p.id > q.id ? 1 : 0))
  const cellArea = (ix: number, iy: number): number => (linesX[ix + 1] - linesX[ix]) * mppX * (linesY[iy + 1] - linesY[iy]) * mppY
  const index = (ix: number, iy: number): number => iy * nx + ix

  // the edges under a set of bridges
  const edgesUnder = (open: ReadonlySet<string>): { vEdge: OutlineEdge[][]; hEdge: OutlineEdge[][] } => {
    const bridgesOf = (line: WallLine): Interval[] => line.gaps.filter((g) => g.boundary === 'STRONG' || (g.boundary === 'WEAK' && !open.has(g.id))).map((g) => [g.fromPx, g.toPx])
    const edge = (line: WallLine, a: number, b: number): OutlineEdge => {
      const span = Math.max(1e-9, b - a)
      const pieces: Interval[] = line.pieces.map((p) => [p.from, p.to])
      const bridges = bridgesOf(line)
      const solid = coverOf(pieces, a, b)
      const covered = coverOf([...pieces, ...bridges], a, b)
      return { solid: round6(Math.min(1, solid / span)), bridged: round6(Math.min(1, Math.max(0, covered - solid) / span)), closed: span - covered <= tolerance }
    }
    const vEdge: OutlineEdge[][] = []
    for (let ix = 0; ix <= nx; ix += 1) {
      const column: OutlineEdge[] = []
      for (let iy = 0; iy < ny; iy += 1) column.push(edge(wallsX[ix], linesY[iy], linesY[iy + 1]))
      vEdge.push(column)
    }
    const hEdge: OutlineEdge[][] = []
    for (let iy = 0; iy <= ny; iy += 1) {
      const row: OutlineEdge[] = []
      for (let ix = 0; ix < nx; ix += 1) row.push(edge(wallsY[iy], linesX[ix], linesX[ix + 1]))
      hEdge.push(row)
    }
    return { vEdge, hEdge }
  }

  let floods = 0
  const flood = (vEdge: OutlineEdge[][], hEdge: OutlineEdge[][]): Uint8Array => {
    floods += 1
    const reached = new Uint8Array(nx * ny)
    const queue: Array<[number, number]> = []
    const push = (ix: number, iy: number): void => {
      if (ix < 0 || iy < 0 || ix >= nx || iy >= ny || reached[index(ix, iy)] === 1) return
      reached[index(ix, iy)] = 1
      queue.push([ix, iy])
    }
    for (let iy = 0; iy < ny; iy += 1) {
      if (!vEdge[0][iy].closed) push(0, iy)
      if (!vEdge[nx][iy].closed) push(nx - 1, iy)
    }
    for (let ix = 0; ix < nx; ix += 1) {
      if (!hEdge[0][ix].closed) push(ix, 0)
      if (!hEdge[ny][ix].closed) push(ix, ny - 1)
    }
    while (queue.length > 0) {
      const [ix, iy] = queue.pop() as [number, number]
      if (!vEdge[ix][iy].closed) push(ix - 1, iy)
      if (!vEdge[ix + 1][iy].closed) push(ix + 1, iy)
      if (!hEdge[iy][ix].closed) push(ix, iy - 1)
      if (!hEdge[iy + 1][ix].closed) push(ix, iy + 1)
    }
    return reached
  }

  // Which cells a gap separates: the cells on both sides of every edge it overlaps. Beyond the grid's border is
  // outside by definition (index -1: always reached).
  const sidesOf = (g: BoundaryGap): number[] => {
    const out: number[] = []
    if (g.axis === 'X') {
      const ix = linesX.findIndex((p) => Math.abs(p - g.linePx) < 1e-6)
      if (ix < 0) return out
      for (let iy = 0; iy < ny; iy += 1) {
        if (Math.min(linesY[iy + 1], g.toPx) - Math.max(linesY[iy], g.fromPx) <= 0) continue
        out.push(ix > 0 ? index(ix - 1, iy) : -1, ix < nx ? index(ix, iy) : -1)
      }
    } else {
      const iy = linesY.findIndex((p) => Math.abs(p - g.linePx) < 1e-6)
      if (iy < 0) return out
      for (let ix = 0; ix < nx; ix += 1) {
        if (Math.min(linesX[ix + 1], g.toPx) - Math.max(linesX[ix], g.fromPx) <= 0) continue
        out.push(iy > 0 ? index(ix, iy - 1) : -1, iy < ny ? index(ix, iy) : -1)
      }
    }
    return out
  }
  const touchesReached = (g: BoundaryGap, reached: Uint8Array): boolean => {
    const sides = sidesOf(g).map((i) => (i < 0 ? 1 : reached[i]))
    return sides.some((v) => v === 1) && sides.some((v) => v === 0)
  }

  const open = new Set<string>()
  const judged = new Map<string, { exposedM2: number; limitM2: number; bridged: boolean }>()
  let current = edgesUnder(open)
  let reached = flood(current.vEdge, current.hEdge)
  const budget = weak.slice(0, MAX_WEAK_GAPS)
  for (let changed = true; changed; ) {
    changed = false
    for (const g of budget) {
      if (open.has(g.id) || judged.get(g.id)?.bridged === true) continue
      if (!touchesReached(g, reached)) continue
      const trial = new Set(open)
      trial.add(g.id)
      const edges = edgesUnder(trial)
      const next = flood(edges.vEdge, edges.hEdge)
      let exposed = 0
      for (let iy = 0; iy < ny; iy += 1) for (let ix = 0; ix < nx; ix += 1) if (next[index(ix, iy)] === 1 && reached[index(ix, iy)] === 0) exposed += cellArea(ix, iy)
      const limitM2 = Math.max(6, 2.5 * g.widthM * g.widthM)
      if (exposed <= limitM2) {
        open.add(g.id)
        judged.set(g.id, { exposedM2: round6(exposed), limitM2: round6(limitM2), bridged: false })
        current = edges
        reached = next
        changed = true
      } else judged.set(g.id, { exposedM2: round6(exposed), limitM2: round6(limitM2), bridged: true })
    }
  }
  const inside = new Uint8Array(nx * ny)
  for (let i = 0; i < inside.length; i += 1) inside[i] = reached[i] === 1 ? 0 : 1
  return {
    inside,
    nx,
    ny,
    vEdge: current.vEdge,
    hEdge: current.hEdge,
    bridged: {
      strong,
      weak: budget.filter((g) => judged.get(g.id)?.bridged === true).map((g) => ({ gap: g, exposedM2: judged.get(g.id)?.exposedM2 ?? 0, limitM2: judged.get(g.id)?.limitM2 ?? 0 })),
    },
    pocketMouths: budget.filter((g) => open.has(g.id)).map((g) => ({ gap: g, exposedM2: judged.get(g.id)?.exposedM2 ?? 0, limitM2: judged.get(g.id)?.limitM2 ?? 0 })),
    unjudged: weak.length - judged.size,
    floods,
  }
}

/** The outline's perimeter, and what supports it (lengths in metres). */
export type OutlineSupport = {
  perimeterM: number
  wallM: number
  strongOpeningM: number
  weakOpeningM: number
  unsupportedM: number
  gapsBridged: number
  maxBridgedGapM: number
  areaM2: number
  extentM: { x: number; z: number }
}

export function outlineSupport(grid: OutlineGrid, result: OutlineResult): OutlineSupport {
  const { linesX, linesY, mppX, mppY } = grid
  const { nx, ny, inside, vEdge, hEdge } = result
  const at = (ix: number, iy: number): boolean => ix >= 0 && iy >= 0 && ix < nx && iy < ny && inside[iy * nx + ix] === 1
  let perimeter = 0
  let wall = 0
  let bridged = 0
  let unsupported = 0
  let area = 0
  let x0 = Infinity
  let x1 = -Infinity
  let y0 = Infinity
  let y1 = -Infinity
  const weakIds = new Set(result.bridged.weak.map((w) => w.gap.id))
  let weakLength = 0
  const tally = (e: OutlineEdge, lengthM: number): void => {
    perimeter += lengthM
    wall += lengthM * e.solid
    bridged += lengthM * e.bridged
    unsupported += lengthM * Math.max(0, 1 - e.solid - e.bridged)
  }
  for (let iy = 0; iy < ny; iy += 1) {
    for (let ix = 0; ix < nx; ix += 1) {
      if (!at(ix, iy)) continue
      const w = (linesX[ix + 1] - linesX[ix]) * mppX
      const h = (linesY[iy + 1] - linesY[iy]) * mppY
      area += w * h
      x0 = Math.min(x0, linesX[ix])
      x1 = Math.max(x1, linesX[ix + 1])
      y0 = Math.min(y0, linesY[iy])
      y1 = Math.max(y1, linesY[iy + 1])
      if (!at(ix, iy - 1)) tally(hEdge[iy][ix], w)
      if (!at(ix, iy + 1)) tally(hEdge[iy + 1][ix], w)
      if (!at(ix - 1, iy)) tally(vEdge[ix][iy], h)
      if (!at(ix + 1, iy)) tally(vEdge[ix + 1][iy], h)
    }
  }
  const used = [...result.bridged.strong, ...result.bridged.weak.map((w) => w.gap)]
  for (const g of result.bridged.weak) weakLength += g.gap.widthM
  void weakIds
  return {
    perimeterM: round6(perimeter),
    wallM: round6(wall),
    strongOpeningM: round6(Math.max(0, bridged - weakLength)),
    weakOpeningM: round6(weakLength),
    unsupportedM: round6(unsupported),
    gapsBridged: used.length,
    maxBridgedGapM: round6(Math.max(0, ...used.map((g) => g.widthM))),
    areaM2: round6(area),
    extentM: { x: round6(Number.isFinite(x1) ? (x1 - x0) * mppX : 0), z: round6(Number.isFinite(y1) ? (y1 - y0) * mppY : 0) },
  }
}
