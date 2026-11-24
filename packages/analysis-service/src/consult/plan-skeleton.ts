/**
 * v3.54.19 — the plan skeleton: what the ground-floor plan DRAWS as walls, read on the sheet itself inside the outline a
 * body stands on — for any body, whoever built it.
 *
 * Until now the interior (partitions, interior doors) and the gaps of the exterior walls existed only where LOCAL's own
 * reconstruction succeeded; a body built from the plan outline and the elevations stood empty, and a body that replaced
 * LOCAL's took the interior away with it. Nothing about a partition depends on who placed the outer walls: it is ink on
 * the plan. This module reads it once, deterministically, with no request to any model:
 *
 *   1. HOW THIS SHEET DRAWS A WALL (`wallInkOf`): the commonest colour in the band just inside the traced outline. A
 *      publisher fills its walls black, dark green or mid grey; the partition reader's fixed "dark neutral ink" rule saw
 *      only the 3 px outlines of a grey wall. Pixels of that colour are painted as ink for the reader; a band that is
 *      paper says the walls are not filled (or the outline is not on them) and is named, never guessed around.
 *   2. THE WALL BANDS (`snapOutline`): each edge of the traced outline is moved onto the band of that colour it runs
 *      along (the median over the edge of where the band starts), when most of the edge finds one — so that the reading
 *      between the bands starts at the bands. This is the skeleton's own working outline, NOT a correction of the body's:
 *      a sheet may draw an outer layer of its walls in another tone, and the building's outer face is then outside it.
 *   3. THE GAPS OF THE EXTERIOR WALLS (`gaps`): stretches of an edge where the band is interrupted between two pieces of
 *      wall — where the plan draws an opening. A second drawing's witness for what an elevation reading proposes.
 *   4. THE INTERIOR (`walls`, `doors`): the reconstruction's own partition reader (`readInterior`, the reader LOCAL's
 *      models are built with) on the painted sheet, inside the snapped outline.
 *
 * Everything is stated in the plan frame's pixels: the body that stands maps it into its own frame (a body built turned
 * against the sheet turns it with the outline). Nothing here knows a house, a publisher or a benchmark.
 */
import type { Raster } from '@buildapp/source-cv'
import { readInterior } from '@buildapp/reconstruction'
import type { PlanFrameV2 } from '@buildapp/reconstruction'

export const PLAN_SKELETON_VERSION = '1.0.0' as const
export const PLAN_SKELETON = {
  /** the band the wall colour is sampled in, as shares of the outline's shorter extent, inward from the traced edge */
  bandFrom: 0.01,
  bandTo: 0.025,
  /** a colour within this of the commonest one (per channel) is that wall colour */
  colourTol: 26,
  /** the commonest colour must hold this share of the band (openings, corners and a traced edge a few px off take the rest) */
  minShare: 0.25,
  /** brighter than this, the band is paper: the walls are not filled */
  paperLuma: 215,
  /** how far an edge may be moved onto its band, as a share of the outline's shorter extent (plus 6 px) */
  snapReach: 0.03,
  /** the share of an edge's stations that must find a band for the edge to be moved */
  snapVote: 0.3,
  /** an exterior gap: metres along the wall */
  gapMinM: 0.45,
  gapMaxShare: 0.85,
  /** a partition piece shorter than this that meets a wall at one end only is furniture, not a wall */
  stubMinM: 0.9,
  /** a partition is at most this many times as thick as the sheet's exterior wall … */
  maxPartitionShare: 1.25,
  /** … and at least this many times as long as it is thick */
  minSlenderness: 2,
} as const

export type SkeletonWall = { id: string; axis: 'H' | 'V'; /** the centre line across (y for H, x for V), px */ at: number; from: number; to: number; thicknessPx: number; ends: { start: 'JUNCTION' | 'FREE'; end: 'JUNCTION' | 'FREE' }; confidence: number }
export type SkeletonDoor = { id: string; axis: 'H' | 'V'; at: number; from: number; to: number }
export type SkeletonGap = { id: string; /** index of the outline edge (corner i → corner i+1) */ edge: number; /** the way the wall faces on the sheet */ face: 'TOP' | 'RIGHT' | 'BOTTOM' | 'LEFT'; /** along the edge: x for TOP/BOTTOM, y for LEFT/RIGHT */ from: number; to: number; /** thin strokes run along the gap inside the band (a window's glazing lines) */ lines: boolean }
export type WallInk = { rgb: [number, number, number]; luma: number; share: number; filled: boolean; why: string }
export type PlanSkeleton = {
  version: string
  frameId: string
  sourceByteHash: string
  mPerPx: number
  ink: WallInk
  /** the outline as given, and as moved onto the wall bands (the same corners, the same order) */
  tracedPx: Array<[number, number]>
  outlinePx: Array<[number, number]>
  snapped: Array<{ edge: number; byPx: number; stations: number; of: number }>
  /** the exterior wall band's thickness on this sheet, px (0: not measured) */
  wallPx: number
  walls: SkeletonWall[]
  doors: SkeletonDoor[]
  gaps: SkeletonGap[]
  refused: string[]
}

const lumaOf = (r: number, g: number, b: number): number => 0.299 * r + 0.587 * g + 0.114 * b
const median = (v: number[]): number => { const s = [...v].sort((p, q) => p - q); return s.length === 0 ? NaN : s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2 }
/** The reader's own definition of wall ink (`interior.ts`): dark and neutral. */
const darkAt = (r: Raster, x: number, y: number): boolean => {
  const [xi, yi] = [Math.round(x), Math.round(y)]
  if (xi < 0 || yi < 0 || xi >= r.width || yi >= r.height) return false
  const i = (yi * r.width + xi) * 4
  return lumaOf(r.data[i], r.data[i + 1], r.data[i + 2]) < 95 && Math.max(r.data[i], r.data[i + 1], r.data[i + 2]) - Math.min(r.data[i], r.data[i + 1], r.data[i + 2]) < 70
}

type Edge = { i: number; dir: 'H' | 'V'; /** the fixed coordinate (y for H, x for V) */ c: number; a0: number; a1: number; /** +1: the inside is at larger c */ inward: 1 | -1; face: SkeletonGap['face'] }
/** The edges of an orthogonal outline, each with the side its inside lies on. */
export function edgesOf(outline: ReadonlyArray<readonly [number, number]>): Edge[] {
  let a2 = 0
  for (let i = 0; i < outline.length; i += 1) a2 += outline[i][0] * outline[(i + 1) % outline.length][1] - outline[(i + 1) % outline.length][0] * outline[i][1]
  // y runs down: a positive shoelace sum is clockwise ON THE SCREEN
  const cw = a2 > 0
  return outline.map((p, i) => {
    const q = outline[(i + 1) % outline.length]
    const dir: 'H' | 'V' = Math.abs(q[1] - p[1]) <= Math.abs(q[0] - p[0]) ? 'H' : 'V'
    // clockwise on the screen: walking right (+x) the inside is below (+y); walking down (+y) the inside is to the left (−x)
    const fwd = dir === 'H' ? q[0] > p[0] : q[1] > p[1]
    const inward: 1 | -1 = dir === 'H' ? (fwd === cw ? 1 : -1) : fwd === cw ? -1 : 1
    const face: SkeletonGap['face'] = dir === 'H' ? (inward === 1 ? 'TOP' : 'BOTTOM') : inward === 1 ? 'LEFT' : 'RIGHT'
    return { i, dir, c: dir === 'H' ? (p[1] + q[1]) / 2 : (p[0] + q[0]) / 2, a0: dir === 'H' ? Math.min(p[0], q[0]) : Math.min(p[1], q[1]), a1: dir === 'H' ? Math.max(p[0], q[0]) : Math.max(p[1], q[1]), inward, face }
  })
}
const shorterExtent = (outline: ReadonlyArray<readonly [number, number]>): number => Math.min(Math.max(...outline.map((q) => q[0])) - Math.min(...outline.map((q) => q[0])), Math.max(...outline.map((q) => q[1])) - Math.min(...outline.map((q) => q[1])))

/** 1. How this sheet draws a wall: the commonest colour of the band just inside the traced outline. */
export function wallInkOf(raster: Raster, outline: ReadonlyArray<readonly [number, number]>): WallInk {
  const S = shorterExtent(outline)
  const [d0, d1] = [Math.max(2, Math.round(PLAN_SKELETON.bandFrom * S)), Math.max(4, Math.round(PLAN_SKELETON.bandTo * S))]
  const hist = new Map<number, number>()
  let total = 0
  for (const e of edgesOf(outline)) {
    const trim = Math.min((e.a1 - e.a0) * 0.1, d1 * 3)
    for (let d = d0; d <= d1; d += 1) {
      const c = Math.round(e.c + d * e.inward)
      for (let a = Math.round(e.a0 + trim); a <= e.a1 - trim; a += 2) {
        const [x, y] = e.dir === 'H' ? [a, c] : [c, a]
        if (x < 0 || y < 0 || x >= raster.width || y >= raster.height) continue
        const i = (y * raster.width + x) * 4
        const k = ((raster.data[i] >> 4) << 8) | ((raster.data[i + 1] >> 4) << 4) | (raster.data[i + 2] >> 4)
        hist.set(k, (hist.get(k) ?? 0) + 1)
        total += 1
      }
    }
  }
  if (total === 0) return { rgb: [0, 0, 0], luma: 0, share: 0, filled: false, why: 'the outline has no band inside the picture to sample' }
  // the commonest colour that is not paper: a traced edge a few pixels outside its wall puts half the band on the paper
  // beside it, and the wall is still the commonest thing drawn there
  const binRgb = (k: number): [number, number, number] => [((k >> 8) & 15) * 16 + 8, ((k >> 4) & 15) * 16 + 8, (k & 15) * 16 + 8]
  const ranked = [...hist.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])
  const drawn = ranked.find(([k]) => lumaOf(...binRgb(k)) < PLAN_SKELETON.paperLuma)
  const [mk, mn] = drawn ?? ranked[0]
  const rgb = binRgb(mk)
  // the share of the band within the tolerance of that colour (the mode's bin alone undercounts a colour on a bin's edge)
  let near = 0
  for (const [k, n] of hist) if (Math.abs(((k >> 8) & 15) * 16 + 8 - rgb[0]) <= PLAN_SKELETON.colourTol && Math.abs(((k >> 4) & 15) * 16 + 8 - rgb[1]) <= PLAN_SKELETON.colourTol && Math.abs((k & 15) * 16 + 8 - rgb[2]) <= PLAN_SKELETON.colourTol) near += n
  void mn
  const luma = lumaOf(rgb[0], rgb[1], rgb[2])
  const share = Math.round((near / total) * 1000) / 1000
  const filled = luma < PLAN_SKELETON.paperLuma && share >= PLAN_SKELETON.minShare
  return { rgb, luma: Math.round(luma), share, filled, why: filled ? `the band just inside the traced outline is ${rgb.join(',')} on ${(share * 100).toFixed(0)} % of its length: this sheet's wall colour` : luma >= PLAN_SKELETON.paperLuma ? `the band just inside the traced outline is paper (${rgb.join(',')}): the walls are not filled on this sheet, or the outline does not run on them` : `no colour holds ${(PLAN_SKELETON.minShare * 100).toFixed(0)} % of the band inside the traced outline (the commonest, ${rgb.join(',')}, ${(share * 100).toFixed(0)} %)` }
}

/** The sheet as the partition reader expects it: pixels of the sheet's wall colour painted as ink (a copy). */
export function paintWalls(raster: Raster, ink: WallInk): Raster {
  const out: Raster = { width: raster.width, height: raster.height, data: new Uint8ClampedArray(raster.data) }
  if (!ink.filled) return out
  const T = PLAN_SKELETON.colourTol
  const d = out.data
  for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - ink.rgb[0]) <= T && Math.abs(d[i + 1] - ink.rgb[1]) <= T && Math.abs(d[i + 2] - ink.rgb[2]) <= T) { d[i] = 0; d[i + 1] = 0; d[i + 2] = 0 }
  return out
}

/** 2. Each edge of the traced outline moved onto the outer face of the wall band it runs along. */
export function snapOutline(painted: Raster, outline: ReadonlyArray<readonly [number, number]>): { outlinePx: Array<[number, number]>; snapped: PlanSkeleton['snapped']; wallPx: number } {
  const edges = edgesOf(outline)
  const S = shorterExtent(outline)
  const R = Math.round(PLAN_SKELETON.snapReach * S) + 6
  const scans = edges.map((e) => {
    const hits: Array<{ face: number; thick: number }> = []
    let of = 0
    const trim = Math.min((e.a1 - e.a0) * 0.08, R)
    for (let a = e.a0 + trim; a <= e.a1 - trim; a += 3) {
      of += 1
      let first: number | undefined
      for (let d = -R; d <= 3 * R; d += 1) {
        const c = e.c + d * e.inward
        const ink = e.dir === 'H' ? darkAt(painted, a, c) : darkAt(painted, c, a)
        if (ink && first === undefined) first = d
        if (!ink && first !== undefined) {
          if (d - first >= 3) { hits.push({ face: e.c + first * e.inward, thick: d - first }); break }
          first = undefined
        }
      }
    }
    return { e, hits, of }
  })
  const thickAll = median(scans.flatMap((s) => s.hits.map((h) => h.thick)))
  const snapped: PlanSkeleton['snapped'] = []
  const coord = scans.map((s) => {
    // a band at least 60 % as thick as the sheet's exterior wall is the wall; a thinner run before it is a line outside it
    const ok = s.hits.filter((h) => Number.isFinite(thickAll) && h.thick >= 0.6 * thickAll && h.thick <= 2.2 * thickAll)
    if (ok.length < Math.max(4, PLAN_SKELETON.snapVote * s.of)) return s.e.c
    const face = median(ok.map((h) => h.face))
    // the stations must agree on the face (an edge that runs along two different lines is not moved)
    const spread = median(ok.map((h) => Math.abs(h.face - face)))
    if (spread > 2) return s.e.c
    if (Math.abs(face - s.e.c) > 1e-6) snapped.push({ edge: s.e.i, byPx: Math.round((face - s.e.c) * 10) / 10, stations: ok.length, of: s.of })
    return face
  })
  const n = edges.length
  const outlinePx = edges.map((e, i) => {
    // corner i is where edge i−1 ends and edge i starts
    return (e.dir === 'H' ? [coord[(i + n - 1) % n], coord[i]] : [coord[i], coord[(i + n - 1) % n]]) as [number, number]
  })
  // an outline whose consecutive edges are not alternately H and V is left as traced
  const alternating = edges.every((e, i) => e.dir !== edges[(i + 1) % n].dir)
  return { outlinePx: alternating ? outlinePx : outline.map((q) => [q[0], q[1]] as [number, number]), snapped: alternating ? snapped : [], wallPx: Number.isFinite(thickAll) ? thickAll : 0 }
}

/** An orthogonal outline as rectangles: vertical slabs between its corners' columns, joined where their rows are the same. */
export function slabsOf(outline: ReadonlyArray<readonly [number, number]>): Array<{ x0: number; y0: number; x1: number; y1: number }> {
  const xs = [...new Set(outline.map((q) => Math.round(q[0] * 100) / 100))].sort((a, b) => a - b)
  const hs = edgesOf(outline).filter((e) => e.dir === 'H')
  const out: Array<{ x0: number; y0: number; x1: number; y1: number }> = []
  for (let k = 0; k + 1 < xs.length; k += 1) {
    const mid = (xs[k] + xs[k + 1]) / 2
    const ys = hs.filter((e) => e.a0 < mid && e.a1 > mid).map((e) => e.c).sort((a, b) => a - b)
    for (let j = 0; j + 1 < ys.length; j += 2) {
      const last = out.find((r) => Math.abs(r.x1 - xs[k]) < 1e-6 && Math.abs(r.y0 - ys[j]) < 1e-6 && Math.abs(r.y1 - ys[j + 1]) < 1e-6)
      if (last) last.x1 = xs[k + 1]
      else out.push({ x0: xs[k], y0: ys[j], x1: xs[k + 1], y1: ys[j + 1] })
    }
  }
  return out
}

/** The outline moved inward by `t` on every edge (an orthogonal offset); undefined where an edge would turn over. */
export function insetOutline(outline: ReadonlyArray<readonly [number, number]>, t: number): Array<[number, number]> | undefined {
  const edges = edgesOf(outline)
  const n = edges.length
  if (!edges.every((e, i) => e.dir !== edges[(i + 1) % n].dir)) return undefined
  const coord = edges.map((e) => e.c + t * e.inward)
  const pts = edges.map((e, i) => (e.dir === 'H' ? [coord[(i + n - 1) % n], coord[i]] : [coord[i], coord[(i + n - 1) % n]]) as [number, number])
  // every edge keeps its direction of travel
  for (let i = 0; i < n; i += 1) {
    const [p, q, P, Q] = [outline[i], outline[(i + 1) % n], pts[i], pts[(i + 1) % n]]
    const before = edges[i].dir === 'H' ? q[0] - p[0] : q[1] - p[1]
    const after = edges[i].dir === 'H' ? Q[0] - P[0] : Q[1] - P[1]
    if (before * after <= 0) return undefined
  }
  return pts
}

export type PlanSkeletonInput = { frameId: string; sourceByteHash: string; raster: Raster; /** the outline of the outer wall faces, orthogonal, in frame pixels */ outlinePx: ReadonlyArray<readonly [number, number]>; mPerPx: number }

/** 3 + 4. The gaps of the exterior walls and the interior, inside an outline at a stated scale. */
export function readPlanSkeleton(input: PlanSkeletonInput): PlanSkeleton {
  const traced = input.outlinePx.map((q) => [q[0], q[1]] as [number, number])
  const s = input.mPerPx
  const ink = wallInkOf(input.raster, traced)
  const base = { version: PLAN_SKELETON_VERSION, frameId: input.frameId, sourceByteHash: input.sourceByteHash, mPerPx: s, ink, tracedPx: traced }
  const empty = { outlinePx: traced, snapped: [], wallPx: 0, walls: [], doors: [], gaps: [] }
  if (!(s > 0) || traced.length < 4) return { ...base, ...empty, refused: ['PLAN_SKELETON: no outline at a scale'] }
  if (!ink.filled) return { ...base, ...empty, refused: [`WALL_STYLE: ${ink.why}`] }
  const painted = paintWalls(input.raster, ink)
  const snap = snapOutline(painted, traced)
  const outline = snap.outlinePx
  const refused: string[] = []
  const wallPx = snap.wallPx
  if (!(wallPx >= 3)) return { ...base, ...empty, outlinePx: outline, snapped: snap.snapped, refused: ['EXTERIOR_BAND: no wall band was found along the outline: nothing is read inside it'] }
  const wallM = wallPx * s
  if (wallM < 0.12 || wallM > 0.9) refused.push(`EXTERIOR_BAND: the band along the outline is ${wallM.toFixed(2)} m thick at this scale: not an exterior wall's thickness (the scale or the outline is doubtful)`)

  // 3. the gaps of the exterior walls
  const gaps: SkeletonGap[] = []
  for (const e of edgesOf(outline)) {
    const len = e.a1 - e.a0
    if (len * s < 2 * PLAN_SKELETON.gapMinM) continue
    const inkAt = (a: number): boolean => {
      let n = 0
      for (const f of [0.3, 0.5, 0.7]) { const c = e.c + f * wallPx * e.inward; if (e.dir === 'H' ? darkAt(painted, a, c) : darkAt(painted, c, a)) n += 1 }
      return n >= 2
    }
    let start: number | undefined
    let seenWall = false
    for (let a = Math.round(e.a0); a <= Math.round(e.a1); a += 1) {
      const w = inkAt(a)
      if (w) {
        if (start !== undefined && seenWall) {
          const [g0, g1] = [start, a]
          const lenM = (g1 - g0) * s
          if (lenM >= PLAN_SKELETON.gapMinM && g1 - g0 <= PLAN_SKELETON.gapMaxShare * len) {
            // thin strokes along the gap inside the band: rows (across the wall) that are dark on most of the gap
            let rows = 0
            for (let d = 1; d < wallPx; d += 1) {
              const c = e.c + d * e.inward
              let dark = 0
              for (let q = g0 + 1; q < g1; q += 1) if (e.dir === 'H' ? darkAt(input.raster, q, c) : darkAt(input.raster, c, q)) dark += 1
              if (dark >= 0.7 * (g1 - g0 - 1)) rows += 1
            }
            gaps.push({ id: `gap-${e.i}-${Math.round(g0)}`, edge: e.i, face: e.face, from: g0, to: g1, lines: rows >= 1 })
          }
        }
        start = undefined
        seenWall = true
      } else if (start === undefined) start = a
    }
  }

  // 4. the interior: the reconstruction's partition reader on the painted sheet, inside the snapped outline
  const xs = outline.map((q) => q[0])
  const ys = outline.map((q) => q[1])
  const [bx0, bx1, by0, by1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const frame: PlanFrameV2 = { frameId: input.frameId, assetId: input.frameId, storeyIndex: 0, mppX: s, mppY: s, originPx: { x: bx0, y: by1 }, why: 'the outline on its wall bands, at the scale given', toWorld: (px, py) => ({ x: (px - bx0) * s, z: (by1 - py) * s }), toPixel: (x, z) => ({ x: bx0 + x / s, y: by1 - z / s }), wallPx: wallPx / 2 }
  const body = { x0: 0, z0: 0, x1: (bx1 - bx0) * s, z1: (by1 - by0) * s }
  let domain: Array<{ x0: number; z0: number; x1: number; z1: number }> | undefined
  if (outline.length > 4) {
    const inner = insetOutline(outline, wallPx)
    if (!inner) refused.push('FLOOR: the outline has an edge shorter than two wall thicknesses: the interior is read inside its bounding rectangle')
    else domain = slabsOf(inner).map((r) => { const a = frame.toWorld(r.x0, r.y1); const b = frame.toWorld(r.x1, r.y0); return { x0: a.x, z0: a.z, x1: b.x, z1: b.z } })
  }
  const walls: SkeletonWall[] = []
  const doors: SkeletonDoor[] = []
  try {
    const reading = readInterior(painted, frame, body, wallM, 0, [], [], domain ? { domain } : {})
    const px = (axis: 'X' | 'Z', at: number, from: number, to: number): { axis: 'H' | 'V'; at: number; from: number; to: number } => {
      // an X-running wall is a horizontal line of the sheet at row y(at); a Z-running one a vertical line at column x(at)
      if (axis === 'X') { const a = frame.toPixel(from, at); const b = frame.toPixel(to, at); return { axis: 'H', at: a.y, from: Math.min(a.x, b.x), to: Math.max(a.x, b.x) } }
      const a = frame.toPixel(at, from); const b = frame.toPixel(at, to)
      return { axis: 'V', at: a.x, from: Math.min(a.y, b.y), to: Math.max(a.y, b.y) }
    }
    const r1 = (v: number): number => Math.round(v * 10) / 10
    const doorEnds = reading.doors.flatMap((d) => [{ axis: d.wallAxis, at: d.at, u: d.from }, { axis: d.wallAxis, at: d.at, u: d.to }])
    for (const w of reading.walls) {
      const lenM = w.to - w.from
      const free = Number(w.ends.start === 'FREE') + Number(w.ends.end === 'FREE')
      // a piece that ends at a door gap ends at a doorway, not in the open
      const atDoor = (u: number): boolean => doorEnds.some((q) => q.axis === w.axis && Math.abs(q.at - w.at) < 0.12 && Math.abs(q.u - u) < 0.12)
      const open = Number(w.ends.start === 'FREE' && !atDoor(w.from)) + Number(w.ends.end === 'FREE' && !atDoor(w.to))
      if (open === 2 || (open === 1 && lenM < PLAN_SKELETON.stubMinM)) continue
      // a "wall" thicker than the sheet's own exterior wall, or nearly as thick as it is long, is a filled object drawn in
      // the wall's tone (a dark bed, a hearth, a column): not a partition
      if (w.thicknessM > PLAN_SKELETON.maxPartitionShare * wallM || lenM < PLAN_SKELETON.minSlenderness * w.thicknessM) continue
      void free
      const p = px(w.axis, w.at, w.from, w.to)
      walls.push({ id: `iw-${p.axis}${Math.round(p.at)}-${Math.round(p.from)}`, axis: p.axis, at: r1(p.at), from: r1(p.from), to: r1(p.to), thicknessPx: r1(w.thicknessM / s), ends: w.axis === 'X' ? w.ends : { start: w.ends.end, end: w.ends.start }, confidence: w.confidence })
    }
    for (const d of reading.doors) {
      const p = px(d.wallAxis, d.at, d.from, d.to)
      doors.push({ id: `id-${p.axis}${Math.round(p.at)}-${Math.round(p.from)}`, axis: p.axis, at: r1(p.at), from: r1(p.from), to: r1(p.to) })
    }
  } catch (e) {
    refused.push(`INTERIOR: the partition reader failed (${(e as Error).message.slice(0, 160)})`)
  }
  return { ...base, outlinePx: outline.map((q) => [Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10] as [number, number]), snapped: snap.snapped, wallPx: Math.round(wallPx * 10) / 10, walls, doors, gaps, refused }
}
