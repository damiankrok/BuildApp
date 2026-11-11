/**
 * The eaves line of a floor plan (v3.53.4): which parts of the building one roof covers.
 *
 * The bodies of a plan are cut on its WALLS, and a roof does not follow walls. One roof covers the rooms either side of
 * a bearing wall, the porch cut out of a corner and the terrace under the same eaves; cut on walls alone, the part
 * behind the wall became an annexe and was roofed flat by convention, and the porch was open ground.
 *
 * A plan drawn for building says where the roof ends: the eaves line, DASHED, runs outside the outer walls at the
 * eaves' projection. It is read here, and only as that:
 *
 *   a dashed line        a thin run of short dashes and short gaps, at least `minLineM` long — never a hatch, a
 *                        slatted table or a row of paving (those are the same run on many neighbouring rows);
 *   an eaves line        a dashed line that runs PARALLEL to an outer face of a walled body, outside it, between
 *                        `minOffsetM` and `maxOffsetM` away, over at least `minAlongM` — a pergola's beams, a terrace's
 *                        edge, the outline of a void or of a storey above are dashed too, and run elsewhere: across a
 *                        room, at right angles to the wall, metres from any face. Of two parallel candidates along the
 *                        same face the nearer is the eaves; the farther is a terrace or a gutter and is dropped;
 *   the outline          the eaves lines closed into a rectilinear loop: collinear pieces of one line join across what
 *                        hides them (a callout ring, a tree) when the gap is short or the line is seen leaving BOTH of
 *                        its corners; an end joins the perpendicular line it stops short of only where that line's own
 *                        end is at the same corner. The loop must enclose every walled body;
 *   the roofed footprint the outline taken in by the projection, side by side, to the faces of the bodies it runs
 *                        along (where a side runs along no body — a porch — by the median projection), cut into its
 *                        maximal rectangles.
 *
 * Nothing here says what KIND of roof stands on the footprint, how high it is, or that a wall stands under any of it:
 * an overall dimension, an eaves line and a paved terrace all end somewhere near the same place, and only the dashed
 * line parallel to the walls is the roof's edge. Where the line is not found, not closed or not around the bodies the
 * reading says so and nothing follows from it. Pixels and metres only; no sheet, publisher or project is known here.
 */
import { round6 } from '@buildapp/source-common'
import type { PixelRect } from '@buildapp/source-common'
import type { Raster } from '@buildapp/source-cv'

export const EAVE_OUTLINE_VERSION = '1.1.0'

export const EAVE_BOUNDS = {
  /** Ink of a dash: darker than this (a watermark, a tint and JPEG noise on white are lighter). */
  dashLuma: 215,
  /** A dash and a gap, in pixels: longer, and it is a line that stops or a solid stroke. */
  maxDashPx: 14,
  maxGapPx: 9,
  /** A dashed run has at least this many dashes. */
  minDashes: 8,
  /** A dashed line is at least this long, and at most this thick (rows of the same run). */
  minLineM: 1.2,
  maxThickPx: 3,
  /** The window searched around the bodies. */
  searchM: 2,
  /** An eaves line runs this far outside a face, over at least this length of it. */
  minOffsetM: 0.25,
  maxOffsetM: 1.2,
  minAlongM: 1,
  /** Collinear pieces join across a gap this long; a longer gap only between two corners. */
  bridgeM: 2,
  /** An end joins a perpendicular line this near, where that line's end is as near to the corner. */
  cornerM: 3,
  cornerEndM: 1.2,
  /** Lines within this many pixels are one line. */
  samePx: 3,
} as const

/** `axis` as the wall lines': X a vertical line (x fixed, running along y), Y a horizontal one. */
export type EaveLine = { axis: 'X' | 'Y'; atPx: number; fromPx: number; toPx: number; offsetM: number; body: number }

export type EaveOutlineState = 'CLOSED' | 'NO_EAVES_LINE' | 'NOT_CLOSED' | 'NOT_AROUND_THE_BODIES'

export type EaveOutlineReading = {
  version: string
  state: EaveOutlineState
  /** The eaves lines found (after joining), in the frame's pixels. */
  lines: EaveLine[]
  /** Dashed lines read near the bodies that are NOT the eaves (a pergola, a terrace edge, a void), counted. */
  otherDashedLines: number
  /** CLOSED only: the median projection, the outline's maximal rectangles and the same taken in to the walls' faces. */
  overhangM?: number
  outlineRects?: PixelRect[]
  roofedRects?: PixelRect[]
  why: string
}

type Run = { at: number; from: number; to: number }

/** Stretches of one row or column that alternate short dashes and short gaps. */
function dashedRuns(luma: (i: number) => number, n: number): Array<{ from: number; to: number }> {
  const B = EAVE_BOUNDS
  const out: Array<{ from: number; to: number }> = []
  let i = 0
  while (i < n) {
    if (luma(i) >= B.dashLuma) {
      i += 1
      continue
    }
    // a run starts on a dash
    const start = i
    let end = i
    let dashes = 0
    let k = i
    for (;;) {
      let d = k
      while (d < n && luma(d) < B.dashLuma) d += 1
      if (d - k > B.maxDashPx) break
      dashes += 1
      end = d
      let g = d
      while (g < n && luma(g) >= B.dashLuma) g += 1
      if (g >= n || g - d > B.maxGapPx) {
        k = g
        break
      }
      k = g
    }
    if (dashes >= B.minDashes) out.push({ from: start, to: end })
    i = Math.max(k, end + 1)
    // a solid stroke: skip it whole
    while (i < n && dashes === 0 && luma(i) < B.dashLuma) i += 1
  }
  return out
}

/** Thin, long dashed lines: a run repeated on many neighbouring rows is a hatch; neighbouring rows of one line merge. */
function thinLines(runs: Run[], minLenPx: number): Run[] {
  const B = EAVE_BOUNDS
  const long = runs.filter((r) => r.to - r.from >= minLenPx)
  const byAt = new Map<number, Run[]>()
  for (const r of long) byAt.set(r.at, [...(byAt.get(r.at) ?? []), r])
  const same = (a: Run, b: Run): boolean => Math.min(a.to, b.to) - Math.max(a.from, b.from) > 0.5 * Math.min(a.to - a.from, b.to - b.from)
  const kept = long.filter((r) => {
    let rows = 0
    for (let d = -2 * B.maxThickPx; d <= 2 * B.maxThickPx; d += 1) if ((byAt.get(r.at + d) ?? []).some((o) => same(r, o))) rows += 1
    return rows <= B.maxThickPx
  })
  kept.sort((a, b) => a.at - b.at || a.from - b.from)
  const merged: Run[] = []
  for (const r of kept) {
    const m = merged.find((o) => Math.abs(o.at - r.at) <= 2 && Math.min(o.to, r.to) - Math.max(o.from, r.from) > -8)
    if (m) {
      m.from = Math.min(m.from, r.from)
      m.to = Math.max(m.to, r.to)
    } else merged.push({ ...r })
  }
  return merged
}

/** The maximal rectangles of a set of grid cells, largest first, as index boxes. */
function maximalRectangles(inside: ReadonlySet<string>, nx: number, ny: number, area: (i0: number, j0: number, i1: number, j1: number) => number): Array<[number, number, number, number]> {
  const has = (i: number, j: number): boolean => inside.has(`${i}:${j}`)
  const found: Array<[number, number, number, number]> = []
  for (let i0 = 0; i0 < nx; i0 += 1) {
    for (let j0 = 0; j0 < ny; j0 += 1) {
      if (!has(i0, j0)) continue
      let jMax = ny - 1
      for (let i1 = i0; i1 < nx && has(i1, j0); i1 += 1) {
        let j1 = j0
        while (j1 + 1 <= jMax && has(i1, j1 + 1)) j1 += 1
        jMax = Math.min(jMax, j1)
        found.push([i0, j0, i1, jMax])
      }
    }
  }
  const contains = (a: [number, number, number, number], b: [number, number, number, number]): boolean => a[0] <= b[0] && a[1] <= b[1] && a[2] >= b[2] && a[3] >= b[3]
  const unique = [...new Map(found.map((r) => [r.join(':'), r])).values()]
  return unique
    .filter((r) => !unique.some((o) => o !== r && contains(o, r)))
    .sort((a, b) => area(...b) - area(...a) || a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3] - b[3])
}

/**
 * Read the eaves line around `bodies` (the walled bodies of the storey under the roof, in the frame's pixels).
 * `mppX`/`mppY` are the sheet's metres per pixel.
 */
export function readEaveOutline(raster: Raster, bodies: readonly PixelRect[], mppX: number, mppY: number): EaveOutlineReading {
  const B = EAVE_BOUNDS
  const none = (state: EaveOutlineState, why: string, lines: EaveLine[] = [], otherDashedLines = 0): EaveOutlineReading => ({ version: EAVE_OUTLINE_VERSION, state, lines, otherDashedLines, why })
  if (bodies.length === 0 || !(mppX > 0) || !(mppY > 0)) return none('NO_EAVES_LINE', 'no walled body or no scale to read an eaves line against')
  const luma = (x: number, y: number): number => {
    const o = (y * raster.width + x) * 4
    return 0.299 * raster.data[o] + 0.587 * raster.data[o + 1] + 0.114 * raster.data[o + 2]
  }
  const box = { x0: Math.min(...bodies.map((b) => b.x0)), x1: Math.max(...bodies.map((b) => b.x1)), y0: Math.min(...bodies.map((b) => b.y0)), y1: Math.max(...bodies.map((b) => b.y1)) }
  const wx0 = Math.max(0, Math.floor(box.x0 - B.searchM / mppX))
  const wx1 = Math.min(raster.width - 1, Math.ceil(box.x1 + B.searchM / mppX))
  const wy0 = Math.max(0, Math.floor(box.y0 - B.searchM / mppY))
  const wy1 = Math.min(raster.height - 1, Math.ceil(box.y1 + B.searchM / mppY))
  if (wx1 - wx0 < 8 || wy1 - wy0 < 8) return none('NO_EAVES_LINE', 'the bodies lie outside the sheet')

  const rowRuns: Run[] = []
  for (let y = wy0; y <= wy1; y += 1) for (const r of dashedRuns((i) => luma(wx0 + i, y), wx1 - wx0 + 1)) rowRuns.push({ at: y, from: wx0 + r.from, to: wx0 + r.to })
  const colRuns: Run[] = []
  for (let x = wx0; x <= wx1; x += 1) for (const r of dashedRuns((i) => luma(x, wy0 + i), wy1 - wy0 + 1)) colRuns.push({ at: x, from: wy0 + r.from, to: wy0 + r.to })
  const horizontal = thinLines(rowRuns, B.minLineM / mppX)
  const vertical = thinLines(colRuns, B.minLineM / mppY)

  // --- which dashed lines are eaves: parallel to an outer face of a body, outside every body, at an eaves' distance ---
  const insideABody = (x: number, y: number): boolean => bodies.some((b) => x > b.x0 + 3 && x < b.x1 - 3 && y > b.y0 + 3 && y < b.y1 - 3)
  const candidates: EaveLine[] = []
  const judge = (axis: 'X' | 'Y', r: Run): void => {
    const mppAcross = axis === 'Y' ? mppY : mppX
    const mppAlong = axis === 'Y' ? mppX : mppY
    let best: { offsetM: number; body: number } | undefined
    bodies.forEach((b, index) => {
      const [a0, a1] = axis === 'Y' ? [b.x0, b.x1] : [b.y0, b.y1]
      const [f0, f1] = axis === 'Y' ? [b.y0, b.y1] : [b.x0, b.x1]
      const lo = Math.max(r.from, a0)
      const hi = Math.min(r.to, a1)
      if ((hi - lo) * mppAlong < B.minAlongM) return
      for (const offsetPx of [f0 - r.at, r.at - f1]) {
        const offsetM = offsetPx * mppAcross
        if (offsetM < B.minOffsetM || offsetM > B.maxOffsetM) continue
        const mid = (lo + hi) / 2
        if (axis === 'Y' ? insideABody(mid, r.at) : insideABody(r.at, mid)) continue
        if (!best || offsetM < best.offsetM) best = { offsetM, body: index }
      }
    })
    if (best) candidates.push({ axis, atPx: r.at, fromPx: r.from, toPx: r.to, offsetM: round6(best.offsetM), body: best.body })
  }
  for (const r of horizontal) judge('Y', r)
  for (const r of vertical) judge('X', r)
  // of two parallel candidates outside the same stretch of the same face, the nearer is the eaves
  const sideOf = (l: EaveLine): number => {
    const b = bodies[l.body]
    return l.axis === 'Y' ? (l.atPx < b.y0 ? 0 : 1) : l.atPx < b.x0 ? 2 : 3
  }
  const eaves = candidates.filter((l) => !candidates.some((o) => o !== l && o.axis === l.axis && o.body === l.body && sideOf(o) === sideOf(l) && o.offsetM < l.offsetM - 1e-9 && Math.min(o.toPx, l.toPx) - Math.max(o.fromPx, l.fromPx) > 0.5 * (l.toPx - l.fromPx)))
  // The eaves line runs on past the body's corner by its own projection, and a callout ring or a tree cuts it into
  // pieces: a piece on the SAME line as one that runs along a face, outside every body, is that line too — the short
  // end past the corner is what joins it to the next side.
  const taken = new Set(eaves.map((l) => `${l.axis}:${l.atPx}:${l.fromPx}`))
  for (const [axis, runs] of [['Y', horizontal], ['X', vertical]] as const) {
    for (const r of runs) {
      if (taken.has(`${axis}:${r.at}:${r.from}`)) continue
      const along = eaves.find((l) => l.axis === axis && Math.abs(l.atPx - r.at) <= 2)
      const mid = (r.from + r.to) / 2
      if (!along || (axis === 'Y' ? insideABody(mid, r.at) : insideABody(r.at, mid))) continue
      eaves.push({ axis, atPx: along.atPx, fromPx: r.from, toPx: r.to, offsetM: along.offsetM, body: along.body })
    }
  }
  // The eaves leave the walls to go round what is roofed and unwalled — a porch on a post — and no face is near them
  // there. A dashed line both of whose ends stand on lines already read as eaves, running across them, joins two eaves
  // lines end to end: it is the eaves too. Repeated until nothing more joins.
  for (let grew = true; grew; ) {
    grew = false
    for (const [axis, runs] of [['Y', horizontal], ['X', vertical]] as const) {
      const mppAlong = axis === 'Y' ? mppX : mppY
      const mppAcross = axis === 'Y' ? mppY : mppX
      for (const r of runs) {
        if (taken.has(`${axis}:${r.at}:${r.from}`)) continue
        const mid = (r.from + r.to) / 2
        if (axis === 'Y' ? insideABody(mid, r.at) : insideABody(r.at, mid)) continue
        const meets = (end: number): EaveLine | undefined => eaves.find((c) => c.axis !== axis && Math.abs(c.atPx - end) * mppAlong <= B.cornerEndM && r.at >= c.fromPx - B.cornerEndM / mppAcross && r.at <= c.toPx + B.cornerEndM / mppAcross)
        const [a, b] = [meets(r.from), meets(r.to)]
        if (!a || !b || a === b) continue
        eaves.push({ axis, atPx: r.at, fromPx: r.from, toPx: r.to, offsetM: Math.min(a.offsetM, b.offsetM), body: a.body })
        taken.add(`${axis}:${r.at}:${r.from}`)
        grew = true
      }
    }
  }
  const other = horizontal.length + vertical.length - eaves.length
  const H = eaves.filter((l) => l.axis === 'Y').map((l) => ({ ...l }))
  const V = eaves.filter((l) => l.axis === 'X').map((l) => ({ ...l }))
  if (H.length < 2 || V.length < 2) return none('NO_EAVES_LINE', `${eaves.length} dashed line${eaves.length === 1 ? ' runs' : 's run'} parallel to an outer face at an eaves' distance (${H.length} along x, ${V.length} along y): no eaves line is drawn around the building on this plan`, eaves, other)

  // --- join: collinear pieces of one line, then ends at corners ---
  const joinCollinear = (lines: EaveLine[], crossing: EaveLine[], mppAlong: number): EaveLine[] => {
    const sorted = [...lines].sort((a, b) => a.atPx - b.atPx || a.fromPx - b.fromPx)
    const out: EaveLine[] = []
    for (const l of sorted) {
      const last = [...out].reverse().find((o) => Math.abs(o.atPx - l.atPx) <= B.samePx && l.fromPx >= o.fromPx)
      const cornered = (line: EaveLine, end: number): boolean => crossing.some((c) => Math.abs(c.atPx - end) <= B.cornerEndM / mppAlong + B.samePx && line.atPx >= c.fromPx - B.cornerEndM / mppAlong && line.atPx <= c.toPx + B.cornerEndM / mppAlong)
      if (last && l.fromPx <= last.toPx) {
        last.toPx = Math.max(last.toPx, l.toPx)
        continue
      }
      if (last) {
        const gapM = (l.fromPx - last.toPx) * mppAlong
        // a short gap is something printed over the line; a long one is the same line only where it is seen leaving both corners
        if (gapM <= B.bridgeM || (cornered(last, last.fromPx) && cornered(l, l.toPx))) {
          last.toPx = l.toPx
          last.offsetM = Math.min(last.offsetM, l.offsetM)
          continue
        }
      }
      out.push({ ...l })
    }
    return out
  }
  let Hj = joinCollinear(H, V, mppX)
  let Vj = joinCollinear(V, H, mppY)
  Hj = joinCollinear(Hj, Vj, mppX)
  const cornerPxX = B.cornerM / mppX
  const cornerPxY = B.cornerM / mppY
  const endPxX = B.cornerEndM / mppX
  const endPxY = B.cornerEndM / mppY
  for (const h of Hj) {
    for (const v of Vj) {
      // the corner (v.atPx, h.atPx): each line's end may stop short of it, the other's end must be near it
      const vNear = h.atPx >= v.fromPx - endPxY && h.atPx <= v.toPx + endPxY
      const hNear = v.atPx >= h.fromPx - endPxX && v.atPx <= h.toPx + endPxX
      if (vNear && h.fromPx > v.atPx && h.fromPx - v.atPx <= cornerPxX) h.fromPx = v.atPx
      if (vNear && h.toPx < v.atPx && v.atPx - h.toPx <= cornerPxX) h.toPx = v.atPx
      if (hNear && v.fromPx > h.atPx && v.fromPx - h.atPx <= cornerPxY) v.fromPx = h.atPx
      if (hNear && v.toPx < h.atPx && h.atPx - v.toPx <= cornerPxY) v.toPx = h.atPx
    }
  }
  const joined = [...Hj, ...Vj]

  // --- the outline: what the lines shut off from the outside, on the grid of their own coordinates ---
  const coords = (values: number[]): number[] => {
    const sorted = [...values].sort((a, b) => a - b)
    const out: number[] = []
    for (const v of sorted) if (out.length === 0 || v - out[out.length - 1] > B.samePx) out.push(v)
    return out
  }
  const xs = coords([wx0 - 1, wx1 + 1, ...Vj.map((v) => v.atPx), ...Hj.flatMap((h) => [h.fromPx, h.toPx])])
  const ys = coords([wy0 - 1, wy1 + 1, ...Hj.map((h) => h.atPx), ...Vj.flatMap((v) => [v.fromPx, v.toPx])])
  const nx = xs.length - 1
  const ny = ys.length - 1
  const vShut = (i: number, j: number): boolean => Vj.some((v) => Math.abs(v.atPx - xs[i]) <= B.samePx && Math.min(v.toPx, ys[j + 1]) - Math.max(v.fromPx, ys[j]) >= 0.5 * (ys[j + 1] - ys[j]))
  const hShut = (i: number, j: number): boolean => Hj.some((h) => Math.abs(h.atPx - ys[j]) <= B.samePx && Math.min(h.toPx, xs[i + 1]) - Math.max(h.fromPx, xs[i]) >= 0.5 * (xs[i + 1] - xs[i]))
  const outside = new Uint8Array(nx * ny)
  const stack: Array<[number, number]> = []
  for (let i = 0; i < nx; i += 1) for (let j = 0; j < ny; j += 1) if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1) stack.push([i, j])
  while (stack.length > 0) {
    const [i, j] = stack.pop() as [number, number]
    if (i < 0 || j < 0 || i >= nx || j >= ny || outside[j * nx + i] === 1) continue
    outside[j * nx + i] = 1
    if (i + 1 < nx && !vShut(i + 1, j)) stack.push([i + 1, j])
    if (i - 1 >= 0 && !vShut(i, j)) stack.push([i - 1, j])
    if (j + 1 < ny && !hShut(i, j + 1)) stack.push([i, j + 1])
    if (j - 1 >= 0 && !hShut(i, j)) stack.push([i, j - 1])
  }
  const inside = new Set<string>()
  for (let i = 0; i < nx; i += 1) for (let j = 0; j < ny; j += 1) if (outside[j * nx + i] === 0) inside.add(`${i}:${j}`)
  if (inside.size === 0) return none('NOT_CLOSED', `${joined.length} eaves lines are drawn (${Hj.length} along x, ${Vj.length} along y) and do not close around anything: a side is hidden or not drawn`, joined, other)
  const within = (x: number, y: number): boolean => {
    const i = xs.findIndex((v, k) => k < nx && x >= v && x <= xs[k + 1])
    const j = ys.findIndex((v, k) => k < ny && y >= v && y <= ys[k + 1])
    return i >= 0 && j >= 0 && inside.has(`${i}:${j}`)
  }
  const around = bodies.every((b) => within(b.x0 + 4, b.y0 + 4) && within(b.x1 - 4, b.y0 + 4) && within(b.x0 + 4, b.y1 - 4) && within(b.x1 - 4, b.y1 - 4) && within((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2))
  if (!around) return none('NOT_AROUND_THE_BODIES', 'the dashed lines parallel to the walls close around part of the plan only: not every walled body lies inside them, so they are not read as the eaves of the building', joined, other)

  // --- the roofed footprint: each side taken in to the faces of the bodies it runs along ---
  const offsets = joined.map((l) => l.offsetM).sort((a, b) => a - b)
  const overhangM = offsets[Math.floor(offsets.length / 2)]
  const faceFor = (axis: 'X' | 'Y', at: number, inward: 1 | -1): number => {
    // the nearest body face inward of the line, within an eaves' distance; else the median projection
    const mpp = axis === 'X' ? mppX : mppY
    const faces = bodies.flatMap((b) => (axis === 'X' ? [b.x0, b.x1] : [b.y0, b.y1]))
    const near = faces.map((f) => ({ f, d: (f - at) * inward * mpp })).filter((c) => c.d >= B.minOffsetM - 1e-9 && c.d <= B.maxOffsetM + 1e-9).sort((p, q) => p.d - q.d)[0]
    return near ? near.f : at + (inward * overhangM) / mpp
  }
  const boxes = maximalRectangles(inside, nx, ny, (i0, j0, i1, j1) => (xs[i1 + 1] - xs[i0]) * (ys[j1 + 1] - ys[j0]))
  const outlineRects = boxes.map(([i0, j0, i1, j1]) => ({ x0: xs[i0], y0: ys[j0], x1: xs[i1 + 1], y1: ys[j1 + 1] }))
  const roofedRects = outlineRects.map((r) => ({ x0: round6(faceFor('X', r.x0, 1)), y0: round6(faceFor('Y', r.y0, 1)), x1: round6(faceFor('X', r.x1, -1)), y1: round6(faceFor('Y', r.y1, -1)) }))
  if (roofedRects.some((r) => r.x1 - r.x0 <= 0 || r.y1 - r.y0 <= 0)) return none('NOT_CLOSED', 'the eaves lines close around less than their own projection: not an outline', joined, other)
  return {
    version: EAVE_OUTLINE_VERSION,
    state: 'CLOSED',
    lines: joined,
    otherDashedLines: other,
    overhangM: round6(overhangM),
    outlineRects,
    roofedRects,
    why: `a dashed line runs outside the outer walls, ${overhangM.toFixed(2)} m from them (median over ${joined.length} sides), and closes around every walled body: the eaves, enclosing ${roofedRects.length === 1 ? 'one rectangle' : `${roofedRects.length} rectangles that overlap`}${other > 0 ? `; ${other} other dashed line${other === 1 ? '' : 's'} near the walls run${other === 1 ? 's' : ''} elsewhere and ${other === 1 ? 'is' : 'are'} not read as eaves` : ''}`,
  }
}

/** A post: solid ink this dark … */
export const POST_LUMA = 128
/** … filling at least this share of the block at the corner, which is at least `POST_MIN_M` and at most `POST_MAX_M` a side. */
export const POST_FILL = 0.85
export const POST_MIN_M = 0.15
export const POST_MAX_M = 1.0

/**
 * The post a plan draws at an outer corner of a roofed, unwalled area: a solid block of ink standing in the corner
 * (`inward` points from the corner into the area, one step per axis). The block is followed along both faces from the
 * corner while it stays solid; anything thinner than a post, or longer than one (a wall), is none.
 */
export function readCornerPost(raster: Raster, corner: { x: number; y: number }, inward: { dx: number; dy: number }, mppX: number, mppY: number): PixelRect | undefined {
  const dark = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= raster.width || y >= raster.height) return false
    const o = (y * raster.width + x) * 4
    return 0.299 * raster.data[o] + 0.587 * raster.data[o + 1] + 0.114 * raster.data[o + 2] < POST_LUMA
  }
  // the corner's own pixel inside the area, allowing the face line to sit a pixel or two off the grid line
  const cx = Math.round(corner.x) + (inward.dx > 0 ? 0 : -1)
  const cy = Math.round(corner.y) + (inward.dy > 0 ? 0 : -1)
  let start: { x: number; y: number } | undefined
  for (let k = 0; k <= 3 && !start; k += 1) for (const [ox, oy] of [[k, k], [k, 0], [0, k]] as const) if (!start && dark(cx + ox * inward.dx, cy + oy * inward.dy) && dark(cx + (ox + 2) * inward.dx, cy + (oy + 2) * inward.dy)) start = { x: cx + ox * inward.dx, y: cy + oy * inward.dy }
  if (!start) return undefined
  const maxX = Math.ceil(POST_MAX_M / mppX) + 1
  const maxY = Math.ceil(POST_MAX_M / mppY) + 1
  let w = 0
  while (w <= maxX && dark(start.x + w * inward.dx, start.y + 2 * inward.dy)) w += 1
  let h = 0
  while (h <= maxY && dark(start.x + 2 * inward.dx, start.y + h * inward.dy)) h += 1
  if (w > maxX || h > maxY || w * mppX < POST_MIN_M || h * mppY < POST_MIN_M) return undefined
  let filled = 0
  for (let j = 0; j < h; j += 1) for (let i = 0; i < w; i += 1) if (dark(start.x + i * inward.dx, start.y + j * inward.dy)) filled += 1
  if (filled < POST_FILL * w * h) return undefined
  const x0 = Math.min(start.x, start.x + (w - 1) * inward.dx)
  const y0 = Math.min(start.y, start.y + (h - 1) * inward.dy)
  return { x0, y0, x1: x0 + w, y1: y0 + h }
}
