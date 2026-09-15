/**
 * Closed shapes and silhouettes: rectangles, profiles and slope histograms.
 *
 * Where `lines.ts` finds the strokes, this file finds the things strokes
 * ENCLOSE or BOUND, because those are what a building is made of. Three
 * questions, three answers:
 *
 *   - "is there an opening here?" — `rectangleCandidates`, which pairs
 *     detected horizontals and verticals and then asks the mask whether the
 *     perimeter it implies is actually inked. A rectangle is not four lines;
 *     it is four lines whose ends meet, and `closure` is the measurement of
 *     "meet".
 *   - "what is the outline?" — `profileTop` / `silhouettePolyline`, which
 *     reduce a filled shape to a skyline and then to a handful of vertices.
 *     A gable roof is two slopes and an apex; a polyline of three points says
 *     that, a mask of 40 000 pixels does not.
 *   - "what pitch?" — `dominantSlopes`, a length-weighted angle histogram.
 *     Length-weighted because a 300-pixel eaves line is evidence about the
 *     roof and a 9-pixel hatch tick is not, and counting both once each lets
 *     hatching outvote the building.
 *
 * As everywhere in this package, rectangles are INCLUSIVE pixel rectangles and
 * every ordering is total.
 */
import { rectIoU, round6 } from '@buildapp/source-common'
import type { PixelPoint, PixelRect } from '@buildapp/source-common'
import type { Mask } from './mask.js'
import { maskAt } from './mask.js'
import type { Segment } from './lines.js'
import { axisAlignedSegments } from './lines.js'

/**
 * A rectangle the mask might contain.
 *
 * `closure` is the fraction of the rectangle's perimeter that has ink behind
 * it, and it is the only score here that distinguishes a real object from a
 * coincidence: any two horizontals and any two verticals define a rectangle,
 * and the overwhelming majority of those rectangles are nothing at all.
 * `support` is the count of ink pixels lying in the perimeter band, which
 * separates "backed by a hairline" from "backed by a drawn frame".
 */
export type RectCandidate = { rect: PixelRect; support: number; closure: number }

/** Strokes thicker than this are bands, not rectangle edges; a rectangle's own edge may still be a few px of drawn line. */
const RECT_MAX_STROKE = 6
/** How far a detected perpendicular line may sit from a pairing's implied edge and still be taken as that edge. */
const RECT_SNAP_TOL = 3
/** Chebyshev slack when asking whether a perimeter pixel is backed. 1 px, so a candidate that is one pixel off still scores. */
const RECT_BAND_TOL = 1
/** Longest edges per orientation considered for pairing. Pairing is quadratic; this is what keeps it bounded on a dense sheet. */
const RECT_MAX_EDGES = 48

const isHorizontal = (s: Segment): boolean => s.angleDeg < 0.5 || s.angleDeg > 179.5
const isVertical = (s: Segment): boolean => Math.abs(s.angleDeg - 90) < 0.5

function snap(value: number, candidates: readonly number[], tol: number): number {
  let best = value
  let bestD = tol + 1
  for (const c of candidates) {
    const d = Math.abs(c - value)
    // `<` not `<=`, and candidates are pre-sorted ascending, so a tie keeps
    // the smaller coordinate: the choice is a property of the list, not of
    // the iteration.
    if (d < bestD) {
      bestD = d
      best = c
    }
  }
  return bestD <= tol ? best : value
}

/** Count ink inside an inclusive pixel box, clamped to the mask. */
function countBox(m: Mask, x0: number, y0: number, x1: number, y1: number): number {
  const ax0 = Math.max(0, x0)
  const ay0 = Math.max(0, y0)
  const ax1 = Math.min(m.width - 1, x1)
  const ay1 = Math.min(m.height - 1, y1)
  let c = 0
  for (let y = ay0; y <= ay1; y++) {
    const base = y * m.width
    for (let x = ax0; x <= ax1; x++) c += m.data[base + x]
  }
  return c
}

function backed(m: Mask, x: number, y: number): boolean {
  for (let dy = -RECT_BAND_TOL; dy <= RECT_BAND_TOL; dy++) for (let dx = -RECT_BAND_TOL; dx <= RECT_BAND_TOL; dx++) if (maskAt(m, x + dx, y + dy) === 1) return true
  return false
}

function scoreRect(m: Mask, r: PixelRect): RectCandidate {
  let total = 0
  let hit = 0
  for (let x = r.x0; x <= r.x1; x++) {
    total += 2
    if (backed(m, x, r.y0)) hit++
    if (backed(m, x, r.y1)) hit++
  }
  for (let y = r.y0 + 1; y <= r.y1 - 1; y++) {
    total += 2
    if (backed(m, r.x0, y)) hit++
    if (backed(m, r.x1, y)) hit++
  }
  // Disjoint bands, so a corner's ink is counted once: top band full width,
  // bottom band below it, left and right only on the rows strictly between.
  const t = RECT_BAND_TOL
  const topEnd = r.y0 + t
  const botStart = Math.max(r.y1 - t, topEnd + 1)
  const midFrom = topEnd + 1
  const midTo = botStart - 1
  let support = countBox(m, r.x0 - t, r.y0 - t, r.x1 + t, topEnd) + countBox(m, r.x0 - t, botStart, r.x1 + t, r.y1 + t)
  if (midTo >= midFrom) {
    const leftEnd = r.x0 + t
    const rightStart = Math.max(r.x1 - t, leftEnd + 1)
    support += countBox(m, r.x0 - t, midFrom, leftEnd, midTo) + countBox(m, rightStart, midFrom, r.x1 + t, midTo)
  }
  return { rect: r, support, closure: total === 0 ? 0 : round6(hit / total) }
}

/**
 * Rectangles implied by the axis-aligned line work, scored by how much of
 * their perimeter is really inked.
 *
 * The pairing is deliberately asymmetric and bounded. Taking every pair of
 * horizontals together with every pair of verticals is O(h^2 v^2) and is
 * hopeless on a real sheet, so instead each PAIR of horizontals proposes the
 * rectangle spanned by their shared x-extent (snapped onto a detected
 * vertical if one is within `RECT_SNAP_TOL`), and each pair of verticals
 * proposes the mirror of that. Every proposal is then judged by the mask
 * itself. This is the important move: the pairing only has to SUGGEST, and it
 * is `closure` — measured against ink, not against the segment list — that
 * decides. A suggestion whose fourth side was never drawn scores low and
 * disappears, so the cheap pairing costs nothing in precision.
 *
 * `minClosure` is inclusive and defaults to 0.6: an opening drawn as a
 * rectangle usually has a sill or a head interrupted by a dimension witness
 * line or a symbol, so demanding 0.9 loses real openings, while below about
 * 0.5 a U of three walls — and eventually an L of two — starts to qualify.
 *
 * Overlapping survivors are suppressed at IoU > 0.9 (via `rectIoU`, which
 * measures continuous rectangles and is therefore slightly conservative on
 * one-pixel boxes — it under-reports overlap, so suppression errs towards
 * keeping both).
 */
export function rectangleCandidates(m: Mask, opts: { minSize?: number; minClosure?: number; maxCandidates?: number } = {}): RectCandidate[] {
  const minSize = Math.max(2, Math.floor(opts.minSize ?? 8))
  const minClosure = opts.minClosure ?? 0.6
  const maxCandidates = Math.max(1, Math.floor(opts.maxCandidates ?? 200))

  const segs = axisAlignedSegments(m, { minLength: minSize, maxThickness: RECT_MAX_STROKE, maxGap: 2 })
  const byLength = (p: Segment, q: Segment): number => q.length - p.length || p.a.y - q.a.y || p.a.x - q.a.x
  const hs = segs.filter(isHorizontal).sort(byLength).slice(0, RECT_MAX_EDGES)
  const vs = segs.filter(isVertical).sort(byLength).slice(0, RECT_MAX_EDGES)
  const vxs = [...new Set(vs.map((s) => s.a.x))].sort((p, q) => p - q)
  const hys = [...new Set(hs.map((s) => s.a.y))].sort((p, q) => p - q)

  const seen = new Set<string>()
  const proposals: PixelRect[] = []
  const propose = (x0: number, y0: number, x1: number, y1: number): void => {
    const r = { x0: Math.round(x0), y0: Math.round(y0), x1: Math.round(x1), y1: Math.round(y1) }
    if (r.x1 - r.x0 < minSize || r.y1 - r.y0 < minSize) return
    if (r.x0 < 0 || r.y0 < 0 || r.x1 >= m.width || r.y1 >= m.height) return
    const key = `${r.x0},${r.y0},${r.x1},${r.y1}`
    if (seen.has(key)) return
    seen.add(key)
    proposals.push(r)
  }

  for (let i = 0; i < hs.length; i++) {
    for (let j = i + 1; j < hs.length; j++) {
      const top = hs[i].a.y <= hs[j].a.y ? hs[i] : hs[j]
      const bottom = hs[i].a.y <= hs[j].a.y ? hs[j] : hs[i]
      if (bottom.a.y - top.a.y < minSize) continue
      const xl = Math.max(top.a.x, bottom.a.x)
      const xr = Math.min(top.b.x, bottom.b.x)
      if (xr - xl < minSize) continue
      propose(snap(xl, vxs, RECT_SNAP_TOL), top.a.y, snap(xr, vxs, RECT_SNAP_TOL), bottom.a.y)
    }
  }
  for (let i = 0; i < vs.length; i++) {
    for (let j = i + 1; j < vs.length; j++) {
      const left = vs[i].a.x <= vs[j].a.x ? vs[i] : vs[j]
      const right = vs[i].a.x <= vs[j].a.x ? vs[j] : vs[i]
      if (right.a.x - left.a.x < minSize) continue
      const yt = Math.max(left.a.y, right.a.y)
      const yb = Math.min(left.b.y, right.b.y)
      if (yb - yt < minSize) continue
      propose(left.a.x, snap(yt, hys, RECT_SNAP_TOL), right.a.x, snap(yb, hys, RECT_SNAP_TOL))
    }
  }

  const scored = proposals.map((r) => scoreRect(m, r)).filter((c) => c.closure >= minClosure)
  const area = (r: PixelRect): number => (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1)
  scored.sort((p, q) => q.closure - p.closure || area(q.rect) - area(p.rect) || p.rect.x0 - q.rect.x0 || p.rect.y0 - q.rect.y0 || p.rect.x1 - q.rect.x1 || p.rect.y1 - q.rect.y1)

  const out: RectCandidate[] = []
  for (const c of scored) {
    if (out.length >= maxCandidates) break
    if (out.some((k) => rectIoU(k.rect, c.rect) > 0.9)) continue
    out.push(c)
  }
  return out
}

/**
 * Topmost inked row per column, or -1 for a column with no ink.
 *
 * This is a SILHOUETTE, and its value is that it is the one measurement of a
 * building drawing that survives everything happening inside the outline.
 * Whatever is hatched, dimensioned or annotated within a facade, the skyline
 * above it is the roof.
 */
export function profileTop(m: Mask): Int32Array {
  const out = new Int32Array(m.width).fill(-1)
  for (let y = 0; y < m.height; y++) {
    const base = y * m.width
    for (let x = 0; x < m.width; x++) if (m.data[base + x] === 1 && out[x] === -1) out[x] = y
  }
  return out
}

/** Bottommost inked row per column, or -1. The ground line, where the drawing has one. */
export function profileBottom(m: Mask): Int32Array {
  const out = new Int32Array(m.width).fill(-1)
  for (let y = 0; y < m.height; y++) {
    const base = y * m.width
    for (let x = 0; x < m.width; x++) if (m.data[base + x] === 1) out[x] = y
  }
  return out
}

/**
 * The top profile reduced to a polyline.
 *
 * Columns with no ink are simply absent, so a gap in the silhouette is bridged
 * by a straight chord between the columns either side of it rather than
 * splitting the result into pieces: the caller asked for "the outline", and a
 * missing column is nearly always a dashed line or a compression artefact,
 * not a hole in the building. A caller that needs the pieces should read
 * `profileTop` directly and split on -1.
 *
 * The default tolerance of 2 px is chosen against the failure mode that
 * matters: too tight and every stair-step of a rasterised slope becomes a
 * vertex, drowning the real corners; too loose and a shallow gable's apex is
 * absorbed into a single straight run, which is the one vertex the caller
 * came for. 2 px clears rasterisation (never more than ~1 px) with margin and
 * keeps any corner deeper than that.
 */
export function silhouettePolyline(m: Mask, opts: { simplifyTolerance?: number } = {}): PixelPoint[] {
  const tolerance = Math.max(0, opts.simplifyTolerance ?? 2)
  const top = profileTop(m)
  const pts: PixelPoint[] = []
  for (let x = 0; x < top.length; x++) if (top[x] >= 0) pts.push({ x, y: top[x] })
  return simplifyPolyline(pts, tolerance)
}

/**
 * Ramer-Douglas-Peucker simplification.
 *
 * Iterative over an explicit stack, not recursive: the natural input here is
 * one point per column, so a 4000-pixel-wide sheet is a 4000-point polyline
 * and a degenerate (monotone) one recurses 4000 deep, which overflows in a
 * browser long before it is slow. Ties on the farthest point resolve to the
 * lowest index, so the vertex set is a function of the geometry alone.
 */
export function simplifyPolyline(points: readonly PixelPoint[], tolerance: number): PixelPoint[] {
  const n = points.length
  const copy = (p: PixelPoint): PixelPoint => ({ x: round6(p.x), y: round6(p.y) })
  if (n <= 2) return points.map(copy)
  const tol = Math.max(0, tolerance)
  const keep = new Uint8Array(n)
  keep[0] = 1
  keep[n - 1] = 1
  const stack: number[] = [0, n - 1]
  while (stack.length > 0) {
    const end = stack.pop() as number
    const start = stack.pop() as number
    if (end - start < 2) continue
    const ax = points[start].x
    const ay = points[start].y
    const bx = points[end].x
    const by = points[end].y
    const dx = bx - ax
    const dy = by - ay
    const len = Math.hypot(dx, dy)
    let far = -1
    let farD = tol
    for (let i = start + 1; i < end; i++) {
      const pxx = points[i].x - ax
      const pyy = points[i].y - ay
      const d = len === 0 ? Math.hypot(pxx, pyy) : Math.abs(pxx * dy - pyy * dx) / len
      if (d > farD) {
        farD = d
        far = i
      }
    }
    if (far < 0) continue
    keep[far] = 1
    stack.push(start, far, far, end)
  }
  const out: PixelPoint[] = []
  for (let i = 0; i < n; i++) if (keep[i] === 1) out.push(copy(points[i]))
  return out
}

/**
 * Length-weighted angle histogram in 1-degree buckets.
 *
 * This is how a roof pitch is recovered IN IMAGE SPACE — it is an angle on a
 * picture, not a pitch in the world, and it only becomes a pitch once someone
 * else supplies the drawing's scale and confirms the view is orthographic and
 * unrotated. Read it as evidence, not as an answer.
 *
 * The reported `angleDeg` is not the bucket centre but the length-weighted
 * mean of the members inside the bucket, so a well-measured 40.03-degree roof
 * reports 40.03 and not 40.5. Buckets do not wrap: a family straddling 0/180
 * lands in two buckets, which a caller comparing near-horizontal slopes must
 * allow for. `minLength` defaults to 0 — every segment counts — because the
 * caller who wants a floor already filtered upstream.
 */
export function dominantSlopes(segments: readonly Segment[], opts: { minLength?: number } = {}): Array<{ angleDeg: number; totalLength: number; count: number }> {
  const minLength = Math.max(0, opts.minLength ?? 0)
  const total = new Float64Array(180)
  const count = new Int32Array(180)
  const weighted = new Float64Array(180)
  const plain = new Float64Array(180)
  for (const s of segments) {
    if (s.length < minLength) continue
    const b = Math.min(179, Math.max(0, Math.floor(s.angleDeg)))
    total[b] += s.length
    count[b] += 1
    weighted[b] += s.length * s.angleDeg
    plain[b] += s.angleDeg
  }
  const out: Array<{ angleDeg: number; totalLength: number; count: number }> = []
  for (let b = 0; b < 180; b++) {
    if (count[b] === 0) continue
    const angleDeg = total[b] > 0 ? weighted[b] / total[b] : plain[b] / count[b]
    out.push({ angleDeg: round6(angleDeg), totalLength: round6(total[b]), count: count[b] })
  }
  out.sort((p, q) => q.totalLength - p.totalLength || p.angleDeg - q.angleDeg)
  return out
}
