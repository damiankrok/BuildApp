/**
 * BUILDPLAN-ANALYZER-005X: an indicative exterior model from ONE perspective picture.
 *
 * A photograph or a visualisation of a house is a perspective view, not an elevation. Nothing on it is measured: the
 * facade readers of the source analyzer refuse it by name, and they keep doing so. This path reads it for what a
 * perspective can give — which part of the picture is sky, planting, roof and wall; where the visible wall meets its
 * eaves and its ground; and which rectangles cut into that wall or sit in the roof — and puts what it reads into the
 * SAME intermediate the drawings feed: masses, a main roof, `OpeningV2` on the walls and `RooflightReading` on the
 * slopes of one `BuildingV2`, emitted by `emitBuilding` like any other.
 *
 * What it knows and what it assumes:
 * - The wall's eave line and ground line are fitted on the picture; their convergence is the perspective of the wall
 *   plane. A pinhole camera with an assumed focal length (one picture width) turns every column into a point on that
 *   plane, at a scale set by an ASSUMED wall height (a storey, or two where two rows of windows stand one above the
 *   other). Every length on the model is therefore indicative only: ASSUMED_FOR_RENDERING or VISUAL_INFERRED, never
 *   SOURCE_EXACT, and none of it reaches a quantity take-off.
 * - Openings are placed in the wall plane's own coordinates, corrected for the perspective, from rectangles of glass or
 *   door-like colour inside the wall band. A rectangle reaching the wall's foot is a door (a wide one a vehicle door);
 *   anything else is a window. A rooflight is a light patch in the roof plane, placed along the eaves by its column.
 * - The side walls, the back and the roof form behind the visible ridge are not seen: a closed body of an ASSUMED depth
 *   under a symmetric gable completes them, with no openings, no rooms and no claim to match the real house.
 *
 * Deterministic and colour-relative: the roof's and the wall's colours are read off the picture itself (the band under
 * the sky, the band under the roof), never a red roof or a white wall assumed. Nothing here knows a publisher, a house
 * or a file name.
 */
import { round6 } from '@buildapp/source-common'
import type { Raster } from '@buildapp/source-cv'
import { serializeModel } from '@buildapp/model'
import { buildCandidateModel, fitOpeningsToHosts } from '../candidate.js'
import { emitBuilding } from '../v2/emit.js'
import { skyMask } from '../v2/camera.js'
import type { BuildingV2, LevelV2, MainRoofV2, MassV2 } from '../v2/building.js'
import type { OpeningV2 } from '../v2/openings-v2.js'
import type { RooflightReading } from '../v2/roof-details.js'
import type { ProvenanceStatus } from '../v2/graph.js'
import { attachedGableLayout } from '../v2/attached-roof-form.js'
import type { MainRoofForJoin } from '../v2/attached-roof-form.js'

export const SINGLE_IMAGE_LABEL = 'MODEL ORIENTACYJNY Z 1 ZDJĘCIA'

export type SingleImageOptions = {
  /** The wall height, eaves to ground, of one storey: an assumption, not a reading. */
  storeyHeightM?: number
  /** The camera's focal length as a share of the picture's width: an assumption. */
  focalWidths?: number
  /** The wall thickness the closed body is drawn with. */
  wallThicknessM?: number
  debug?: (line: string) => void
}

/** One opening as the picture shows it: its rectangle in pixels and its place in the wall plane. */
export type PictureOpening = {
  id: string
  kind: 'WINDOW' | 'DOOR' | 'GARAGE_DOOR' | 'GLAZED_DOOR'
  rectPx: { x0: number; y0: number; x1: number; y1: number }
  /** Along the wall from its left end, and up from its foot, in the assumed metres. */
  along: [number, number]
  sillY: number
  headY: number
  confidence: number
  why: string
}

export type SingleImageReading = {
  ok: true
  /** Pixel rows of the wall's eave and ground lines at the wall's two ends. */
  wall: { x0: number; x1: number; eave: [number, number]; ground: [number, number]; widthM: number; heightM: number; storeys: number }
  /** The stretches of the front with eaves of their own, left to right, in metres along the front. */
  segments: Array<{ x0: number; x1: number; along: [number, number]; eave: [number, number]; heightM: number; main: boolean }>
  roof: { topRow: number; riseM: number; pitchDeg: number; depthM: number }
  colours: { roof: [number, number, number]; wall: [number, number, number] }
  openings: PictureOpening[]
  rooflights: Array<{ id: string; rectPx: { x0: number; y0: number; x1: number; y1: number }; along: [number, number]; upSlope: [number, number] }>
  /** What the reading had to assume, by name. */
  assumptions: string[]
  why: string[]
}

export type SingleImageRefusal = { ok: false; reason: string; why: string[] }

type RGB = [number, number, number]

const rgb = (r: Raster, x: number, y: number): RGB => {
  const o = (y * r.width + x) * 4
  return [r.data[o], r.data[o + 1], r.data[o + 2]]
}
const lumaOf = (c: RGB): number => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
const satOf = (c: RGB): number => {
  const mx = Math.max(c[0], c[1], c[2])
  return mx === 0 ? 0 : (mx - Math.min(c[0], c[1], c[2])) / mx
}
const hueOf = (c: RGB): number => {
  const [r, g, b] = c
  const mx = Math.max(r, g, b)
  const mn = Math.min(r, g, b)
  if (mx === mn) return 0
  const h = mx === r ? ((g - b) / (mx - mn)) % 6 : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4
  return (h * 60 + 360) % 360
}
const green = (c: RGB): boolean => c[1] - Math.max(c[0], c[2]) >= 8
const dist = (a: RGB, b: RGB): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const median = (xs: readonly number[]): number => {
  if (xs.length === 0) return Number.NaN
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}
const medianColour = (cs: readonly RGB[]): RGB => [median(cs.map((c) => c[0])), median(cs.map((c) => c[1])), median(cs.map((c) => c[2]))]

/**
 * The line through the most points within `tolerance` rows: every pair of points over a strided sample is a candidate,
 * the best is refined by least squares over its inliers. Deterministic.
 */
function robustLine(points: ReadonlyArray<{ x: number; y: number }>, tolerance: number): { a: number; b: number; inliers: number } | undefined {
  if (points.length < 3) return undefined
  const step = Math.max(1, Math.floor(points.length / 60))
  const sample = points.filter((_, i) => i % step === 0)
  let best: { a: number; b: number; inliers: number } | undefined
  for (let i = 0; i < sample.length; i += 1)
    for (let j = i + 1; j < sample.length; j += 1) {
      const p = sample[i]
      const q = sample[j]
      if (Math.abs(q.x - p.x) < 10) continue
      const a = (q.y - p.y) / (q.x - p.x)
      if (Math.abs(a) > 0.35) continue
      const b = p.y - a * p.x
      let inliers = 0
      for (const r of points) if (Math.abs(r.y - (a * r.x + b)) <= tolerance) inliers += 1
      if (!best || inliers > best.inliers) best = { a, b, inliers }
    }
  if (!best) return undefined
  const fit = points.filter((r) => Math.abs(r.y - ((best as { a: number }).a * r.x + (best as { b: number }).b)) <= tolerance)
  const n = fit.length
  const mx = fit.reduce((s, r) => s + r.x, 0) / n
  const my = fit.reduce((s, r) => s + r.y, 0) / n
  const sxx = fit.reduce((s, r) => s + (r.x - mx) ** 2, 0)
  const sxy = fit.reduce((s, r) => s + (r.x - mx) * (r.y - my), 0)
  const a = sxx > 0 ? sxy / sxx : 0
  return { a, b: my - a * mx, inliers: n }
}

/**
 * Read one perspective picture of a house. Returns a refusal, by name, where the picture does not show a roof over a
 * wall band wide enough to place anything on.
 */
export function readSingleImage(raster: Raster, options: SingleImageOptions = {}): SingleImageReading | SingleImageRefusal {
  const why: string[] = []
  const assumptions: string[] = []
  const W = raster.width
  const H = raster.height
  const sky = skyMask(raster)
  const isSky = (x: number, y: number): boolean => sky.data[y * W + x] === 1
  // --- the roof's colour: the first non-sky, non-planting band under the sky, over the middle half of the picture
  const roofSamples: RGB[] = []
  const tops: number[] = new Array(W).fill(-1)
  for (let x = 0; x < W; x += 1) {
    for (let y = 0; y < H; y += 1) {
      if (isSky(x, y)) continue
      const c = rgb(raster, x, y)
      if (green(c)) break
      tops[x] = y
      break
    }
  }
  for (let x = Math.floor(W * 0.25); x < W * 0.75; x += 2) {
    if (tops[x] < 0) continue
    for (let y = tops[x] + 3; y < Math.min(H, tops[x] + 12); y += 1) roofSamples.push(rgb(raster, x, y))
  }
  if (roofSamples.length < 50) return { ok: false, reason: 'no roof under the sky: the picture does not show a house against the sky', why }
  const roof = medianColour(roofSamples)
  // Where trees stand behind a roof, the first thing under the sky is planting: the roof's top there is the first
  // roof-coloured pixel under it, found once the roof's colour is known.
  const findTop = (x: number): number => {
    for (let y = 0; y < H * 0.85; y += 1) {
      if (isSky(x, y)) continue
      const c = rgb(raster, x, y)
      if (isRoof(c) && isRoof(rgb(raster, x, Math.min(H - 1, y + 2))) && isRoof(rgb(raster, x, Math.min(H - 1, y + 4)))) return y
    }
    return -1
  }
  // A covering is one hue in light and shade: a coloured roof by its hue, a grey one by being neutral and not light.
  const roofHue = hueOf(roof)
  const roofSat = satOf(roof)
  const isRoof = (c: RGB): boolean => !green(c) && (roofSat > 0.2 ? satOf(c) > 0.15 && Math.min(Math.abs(hueOf(c) - roofHue), 360 - Math.abs(hueOf(c) - roofHue)) <= 30 : satOf(c) < 0.2 && lumaOf(c) < 170)
  for (let x = 0; x < W; x += 1) tops[x] = findTop(x)
  why.push(`roof colour ${roof.join(',')} (median of the band under the sky over the middle half)`)
  // --- per column: where the roof ends, and the wall colour under it
  const eaveRows: Array<{ x: number; y: number }> = []
  const wallSamples: RGB[] = []
  const roofEnd: number[] = new Array(W).fill(-1)
  // The roof runs down from the sky until the first run of light neutral pixels: the soffit or the wall under the
  // eaves. A covering's own shading (tile rows, a dark ridge) never stops it; planting before any wall does.
  const lightNeutral = (c: RGB): boolean => lumaOf(c) >= 170 && satOf(c) <= 0.18
  for (let x = 0; x < W; x += 1) {
    if (tops[x] < 0) continue
    let roofLike = 0
    let end = -1
    for (let y = tops[x]; y < H - 3; y += 1) {
      const c = rgb(raster, x, y)
      if (green(c)) break
      if (lightNeutral(c) && lightNeutral(rgb(raster, x, y + 1)) && lightNeutral(rgb(raster, x, y + 2))) {
        end = y - 1
        break
      }
      if (isRoof(c)) roofLike += 1
    }
    if (end < 0 || end - tops[x] < 4 || roofLike < 0.5 * (end - tops[x] + 1)) continue
    roofEnd[x] = end
  }
  for (let x = 0; x < W; x += 1) {
    if (roofEnd[x] < 0) continue
    for (let y = roofEnd[x] + 6; y < Math.min(H, roofEnd[x] + 30); y += 1) {
      const c = rgb(raster, x, y)
      if (!green(c) && satOf(c) < 0.25) wallSamples.push(c)
    }
  }
  if (wallSamples.length < 100) return { ok: false, reason: 'no wall under the roof: nothing neutral stands under the roof band', why }
  // The wall is the lightest common neutral under the roof: the median of the brighter half (shadows under the eaves
  // and glass are the darker half).
  const bright = [...wallSamples].sort((a, b) => lumaOf(b) - lumaOf(a)).slice(0, Math.ceil(wallSamples.length / 2))
  const wall = medianColour(bright)
  const wallTol = Math.max(28, 0.14 * lumaOf(wall))
  const isWall = (c: RGB): boolean => dist(c, wall) <= wallTol
  why.push(`wall colour ${wall.join(',')} (median of the lighter half of the band under the roof)`)
  // --- the wall band: its first row under the roof, and its foot: the end of the run of neutral surface (wall, light or
  // shaded, and the glass and frames in it) before planting, paving or a coloured plinth takes over for good.
  const neutral = (c: RGB): boolean => !green(c) && satOf(c) < 0.22 && lumaOf(c) > 50
  const footRows: Array<{ x: number; y: number }> = []
  for (let x = 0; x < W; x += 1) {
    if (roofEnd[x] < 0) continue
    let first = -1
    for (let y = roofEnd[x] + 1; y < Math.min(H, roofEnd[x] + 40); y += 1)
      if (lightNeutral(rgb(raster, x, y))) {
        first = y
        break
      }
    if (first < 0) continue
    eaveRows.push({ x, y: first })
    let lastNeutral = first
    for (let y = first; y < H; y += 1) {
      if (neutral(rgb(raster, x, y))) lastNeutral = y
      else if (y - lastNeutral > 12) break
    }
    if (lastNeutral - first > 12) footRows.push({ x, y: lastNeutral })
  }
  options.debug?.(`columns ${JSON.stringify({ tops, roofEnd, eaveRows, footRows })}`)
  // --- the wall segments: one eave line after another, each the longest run of columns it holds. A front with a wing,
  // a recessed bay or a porch has eaves at more than one height; each stretch is its own wall segment.
  type Segment = { x0: number; x1: number; a: number; b: number }
  const segments: Segment[] = []
  let remaining = [...eaveRows]
  const minRun = Math.max(20, Math.round(W * 0.06))
  for (let k = 0; k < 4 && remaining.length >= minRun; k += 1) {
    const line = robustLine(remaining, 3)
    if (!line) break
    const xs = remaining.filter((p) => Math.abs(p.y - (line.a * p.x + line.b)) <= 3).map((p) => p.x).sort((p, q) => p - q)
    // The longest run of inlier columns with gaps of at most a few pixels.
    let best: [number, number] = [xs[0], xs[0]]
    let start = xs[0]
    for (let i = 1; i <= xs.length; i += 1) {
      if (i === xs.length || xs[i] - xs[i - 1] > 12) {
        if (xs[i - 1] - start > best[1] - best[0]) best = [start, xs[i - 1]]
        if (i < xs.length) start = xs[i]
      }
    }
    if (best[1] - best[0] < minRun) break
    if (segments.some((s) => Math.min(s.x1, best[1]) - Math.max(s.x0, best[0]) > 0)) {
      remaining = remaining.filter((p) => p.x < best[0] || p.x > best[1])
      continue
    }
    // A stretch on the line of one already found, across a short break (a downpipe, a sign), is the same eave.
    const same = segments.find((s) => Math.min(Math.abs(best[0] - s.x1), Math.abs(s.x0 - best[1])) <= 40 && Math.abs(s.a * (best[0] < s.x0 ? s.x0 : s.x1) + s.b - (line.a * (best[0] < s.x0 ? s.x0 : s.x1) + line.b)) <= 4)
    if (same) {
      same.x0 = Math.min(same.x0, best[0])
      same.x1 = Math.max(same.x1, best[1])
    } else segments.push({ x0: best[0], x1: best[1], a: line.a, b: line.b })
    remaining = remaining.filter((p) => p.x < best[0] || p.x > best[1])
  }
  if (segments.length === 0) return { ok: false, reason: 'no straight eave line could be fitted', why }
  segments.sort((p, q) => p.x0 - q.x0)
  const main = segments.reduce((m, s) => (s.x1 - s.x0 > m.x1 - m.x0 ? s : m), segments[0])
  const wx0 = segments[0].x0
  const wx1 = segments[segments.length - 1].x1
  if (main.x1 - main.x0 < W * 0.12) return { ok: false, reason: 'the visible wall is too narrow to place openings on', why: [...why, `segments ${segments.map((g) => `${g.x0}..${g.x1} y=${g.a.toFixed(3)}x+${g.b.toFixed(0)}`).join('; ')}`] }
  const eaveOf = (s: Segment) => (x: number): number => s.a * x + s.b
  const eaveAt = eaveOf(main)
  // The foot: planting, a flower box or a car in front of the wall only ever hides its lower part, so a column's foot
  // is at most as low as the real one. In each of a dozen stretches of the wall the lowest foot stands; the line is
  // fitted to those.
  const bins = 12
  const lows: Array<{ x: number; y: number }> = []
  // A column between two segments (a porch, a corner the eaves could not be read on) belongs to the nearer one.
  const segmentAt = (x: number): Segment | undefined => {
    if (x < segments[0].x0 || x > segments[segments.length - 1].x1) return undefined
    const inside = segments.find((s) => x >= s.x0 && x <= s.x1)
    if (inside) return inside
    const i = segments.findIndex((s) => s.x0 > x)
    const left = segments[i - 1]
    const right = segments[i]
    return x - left.x1 <= right.x0 - x ? left : right
  }
  // Over the widest segment only: a wing's foot may run on into paving of the wall's own grey; the widest segment's
  // foot, extended, is the front's.
  for (let k = 0; k < bins; k += 1) {
    const a = main.x0 + ((main.x1 - main.x0) * k) / bins
    const b = main.x0 + ((main.x1 - main.x0) * (k + 1)) / bins
    const inBin = footRows.filter((p) => p.x >= a && p.x < b && p.y > eaveOf(main)(p.x) + 8)
    if (inBin.length === 0) continue
    lows.push(inBin.reduce((m, p) => (p.y > m.y ? p : m), inBin[0]))
  }
  const foot = robustLine(lows, 6)
  if (!foot || foot.inliers < 3) return { ok: false, reason: 'no straight wall foot could be fitted', why: [...why, `${segments.length} eave segments, ${lows.length} stretch lows`] }
  const footAt = (x: number): number => foot.a * x + foot.b
  why.push(`${segments.length} wall segment${segments.length === 1 ? '' : 's'} by their eave lines (${segments.map((s) => `${s.x0}..${s.x1}`).join(', ')}), the widest ${main.x0}..${main.x1}; foot line y = ${foot.a.toFixed(4)} x + ${foot.b.toFixed(1)} (${foot.inliers} of ${lows.length} stretch lows)`)
  // --- the wall plane: a pinhole camera, an assumed focal length and wall height, set on the widest segment
  const focal = (options.focalWidths ?? 1) * W
  const cx = W / 2
  assumptions.push(`focal length ${(options.focalWidths ?? 1).toFixed(2)} picture widths (a normal lens); the perspective of the wall plane is the convergence of its eave and foot lines`)
  const heightPx = (x: number): number => footAt(x) - eaveAt(x)
  // --- candidate openings: markedly darker than the wall beside them, inside each segment's band
  const bandTop = (x: number): number => {
    const s = segmentAt(x)
    return s ? eaveOf(s)(x) : Number.NaN
  }
  // The wall's own brightness about each pixel: the 85th percentile of the neutral band pixels within ±30 columns and
  // ±8 rows (sampled every third pixel). A shadow under the eaves is wall in its own light; an opening is markedly
  // darker than the wall around it at the same height, or busy with bars and reflections where the wall is smooth.
  const lumaGrid = new Float32Array(W * H).fill(-1)
  for (let x = wx0; x <= wx1; x += 1) {
    if (!segmentAt(x)) continue
    for (let y = Math.ceil(bandTop(x)) + 1; y < Math.floor(footAt(x)); y += 1) {
      const c = rgb(raster, x, y)
      if (neutral(c)) lumaGrid[y * W + x] = lumaOf(c)
    }
  }
  const refAt = (x: number, y: number): number => {
    const vs: number[] = []
    for (let dy = -8; dy <= 8; dy += 3)
      for (let dx = -30; dx <= 30; dx += 3) {
        const xx = x + dx
        const yy = y + dy
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue
        const v = lumaGrid[yy * W + xx]
        if (v >= 0) vs.push(v)
      }
    if (vs.length < 8) return Number.NaN
    vs.sort((p, q) => p - q)
    return vs[Math.floor(vs.length * 0.85)]
  }
  const busy = (x: number, y: number): boolean => {
    let lo = 255
    let hi = 0
    for (let dy = -2; dy <= 2; dy += 1)
      for (let dx = -2; dx <= 2; dx += 1) {
        const xx = Math.min(W - 1, Math.max(0, x + dx))
        const yy = Math.min(H - 1, Math.max(0, y + dy))
        const l = lumaOf(rgb(raster, xx, yy))
        lo = Math.min(lo, l)
        hi = Math.max(hi, l)
      }
    return hi - lo > 70
  }
  const mask = new Uint8Array(W * H)
  for (let x = wx0; x <= wx1; x += 1) {
    if (!segmentAt(x)) continue
    for (let y = Math.ceil(bandTop(x)) + 2; y < Math.floor(footAt(x)); y += 1) {
      const c = rgb(raster, x, y)
      if (green(c) || isSky(x, y) || satOf(c) > 0.45) continue
      const ref = refAt(x, y)
      if (!(ref > 0)) continue
      if (lumaOf(c) < ref * 0.72 || (lumaOf(c) < ref * 0.92 && busy(x, y))) mask[y * W + x] = 1
    }
  }
  // Thin structures — a shadow's edge, a groove, a downpipe, a frame's outline — go: an opening of the mask with a 5 px
  // square keeps only what is at least that thick (panes, door leaves).
  const R = 2
  const eroded = new Uint8Array(W * H)
  for (let y = R; y < H - R; y += 1)
    for (let x = R; x < W - R; x += 1) {
      let all = 1
      for (let dy = -R; dy <= R && all; dy += 1) for (let dx = -R; dx <= R; dx += 1) if (!mask[(y + dy) * W + x + dx]) { all = 0; break }
      eroded[y * W + x] = all
    }
  const opened = new Uint8Array(W * H)
  for (let y = R; y < H - R; y += 1)
    for (let x = R; x < W - R; x += 1) {
      if (!eroded[y * W + x]) continue
      for (let dy = -R; dy <= R; dy += 1) for (let dx = -R; dx <= R; dx += 1) opened[(y + dy) * W + x + dx] = 1
    }
  type Comp = { x0: number; y0: number; x1: number; y1: number; n: number }
  let comps: Comp[] = []
  const seen = new Uint8Array(W * H)
  for (let y = 0; y < H; y += 1)
    for (let x = 0; x < W; x += 1) {
      const i = y * W + x
      if (!opened[i] || seen[i]) continue
      const stack = [i]
      seen[i] = 1
      const c: Comp = { x0: x, y0: y, x1: x, y1: y, n: 0 }
      while (stack.length > 0) {
        const j = stack.pop() as number
        const jx = j % W
        const jy = (j - jx) / W
        c.n += 1
        c.x0 = Math.min(c.x0, jx)
        c.x1 = Math.max(c.x1, jx)
        c.y0 = Math.min(c.y0, jy)
        c.y1 = Math.max(c.y1, jy)
        for (const k of [jx > 0 ? j - 1 : -1, jx < W - 1 ? j + 1 : -1, j - W, j + W]) {
          if (k < 0 || k >= W * H || seen[k] || !opened[k]) continue
          seen[k] = 1
          stack.push(k)
        }
      }
      comps.push(c)
    }
  // The shadow under the eaves: wide, low, against the band's top.
  comps = comps.filter((c) => !(c.y0 <= bandTop(Math.round((c.x0 + c.x1) / 2)) + 4 && c.x1 - c.x0 > 3 * (c.y1 - c.y0)))
  // Panes of one opening, split by bars: joined while the joined box stays mostly filled.
  let merged = true
  while (merged) {
    merged = false
    comps.sort((p, q) => q.n - p.n || p.x0 - q.x0 || p.y0 - q.y0)
    outer: for (let i = 0; i < comps.length; i += 1)
      for (let j = i + 1; j < comps.length; j += 1) {
        const p = comps[i]
        const q = comps[j]
        const gapX = Math.max(0, Math.max(p.x0, q.x0) - Math.min(p.x1, q.x1))
        const gapY = Math.max(0, Math.max(p.y0, q.y0) - Math.min(p.y1, q.y1))
        if (gapX > 6 || gapY > 6) continue
        const box = { x0: Math.min(p.x0, q.x0), y0: Math.min(p.y0, q.y0), x1: Math.max(p.x1, q.x1), y1: Math.max(p.y1, q.y1) }
        const n = p.n + q.n
        if (n / ((box.x1 - box.x0 + 1) * (box.y1 - box.y0 + 1)) < 0.45) continue
        comps[i] = { ...box, n }
        comps.splice(j, 1)
        merged = true
        break outer
      }
  }
  const storeyH = options.storeyHeightM ?? 2.9
  const tOf = (x: number, y: number): number => (footAt(x) - y) / heightPx(x)
  // Two storeys only where at least two openings stand wholly in the upper half of the band and two wholly in the lower.
  const solid = comps.filter((c) => c.n / ((c.x1 - c.x0 + 1) * (c.y1 - c.y0 + 1)) >= 0.5 && c.x1 - c.x0 >= 0.04 * (wx1 - wx0) && c.y1 - c.y0 >= 0.15 * heightPx((c.x0 + c.x1) / 2))
  const upper = solid.filter((c) => tOf((c.x0 + c.x1) / 2, c.y1) > 0.52).length
  const lower = solid.filter((c) => tOf((c.x0 + c.x1) / 2, c.y0) < 0.48).length
  const storeys = upper >= 2 && lower >= 2 ? 2 : 1
  const wallH = storeyH * storeys
  assumptions.push(`wall height ${wallH.toFixed(2)} m eaves to ground on the widest segment: ${storeys} storey${storeys === 1 ? '' : 's'} of an assumed ${storeyH} m (${storeys === 2 ? 'two rows of windows stand one over the other' : 'one row of openings'})`)
  // Each column on the wall plane: X = (c − cx)·H/h, Z = f·H/h, with the widest segment's lines extended over the
  // whole front; the plane's own coordinate is the distance along it from the front's left end.
  const pointOf = (x: number): { X: number; Z: number } => ({ X: ((x - cx) * wallH) / heightPx(x), Z: (focal * wallH) / heightPx(x) })
  const p0 = pointOf(wx0)
  const p1 = pointOf(wx1)
  const widthM = Math.hypot(p1.X - p0.X, p1.Z - p0.Z)
  const alongOf = (x: number): number => {
    const p = pointOf(x)
    return ((p.X - p0.X) * (p1.X - p0.X) + (p.Z - p0.Z) * (p1.Z - p0.Z)) / widthM
  }
  // A segment's wall height, at the scale of the widest one, from its own eave line over the shared foot.
  const segmentHeight = (s: Segment): number => {
    const m = (s.x0 + s.x1) / 2
    return Math.max(1.8, (wallH * (footAt(m) - eaveOf(s)(m))) / heightPx(m))
  }
  why.push(`the visible front is ${widthM.toFixed(2)} m wide at that height (indicative)`)
  // --- openings
  const openings: PictureOpening[] = []
  for (const c of comps) {
    const bw = c.x1 - c.x0 + 1
    const bh = c.y1 - c.y0 + 1
    const fill = c.n / (bw * bh)
    const mid = (c.x0 + c.x1) / 2
    const seg = segmentAt(Math.round(mid))
    if (!seg) continue
    const segH = segmentHeight(seg)
    const t0 = tOf(mid, c.y1 + 1)
    const t1 = tOf(mid, c.y0)
    const a0 = alongOf(c.x0)
    const a1 = alongOf(c.x1 + 1)
    const wM = a1 - a0
    const hM = (t1 - t0) * wallH
    if (fill < 0.45 || wM < 0.35 || hM < 0.6 || wM > 6 || hM > segH * 0.95) continue
    // A shadow under the eaves runs along the top of the wall: not an opening.
    const topGap = (tOf(mid, eaveOf(seg)(mid)) - t1) * wallH
    if (topGap < 0.12 && wM > 1.5) continue
    // Inside its segment's stretch of the front, gaps shared out to the neighbours at their middles.
    const si = segments.indexOf(seg)
    const lo = si > 0 ? (segments[si - 1].x1 + seg.x0) / 2 : seg.x0
    const hi = si + 1 < segments.length ? (seg.x1 + segments[si + 1].x0) / 2 : seg.x1
    if (a0 < alongOf(lo) + 0.1 || a1 > alongOf(hi) - 0.1) continue
    const sillY = Math.max(0, t0 * wallH)
    const headY = Math.min(segH - 0.1, t1 * wallH)
    const toFloor = sillY <= 0.35
    const kind: PictureOpening['kind'] = toFloor ? (wM >= 2.2 ? 'GARAGE_DOOR' : 'GLAZED_DOOR') : 'WINDOW'
    openings.push({
      id: `photo-opening-${openings.length}`,
      kind,
      rectPx: { x0: c.x0, y0: c.y0, x1: c.x1 + 1, y1: c.y1 + 1 },
      along: [round6(a0), round6(a1)],
      sillY: round6(toFloor ? 0 : sillY),
      headY: round6(headY),
      confidence: round6(Math.min(0.6, 0.25 + fill * 0.35)),
      why: `a ${bw} × ${bh} px rectangle of glass or door colour in the wall band (${Math.round(fill * 100)} % filled), ${wM.toFixed(2)} × ${hM.toFixed(2)} m on the wall plane${toFloor ? ', reaching the wall foot' : ''}`,
    })
  }
  // Pieces of one opening stacked one over the other (a door's glazed top over its glazed sides, split by a transom):
  // over most of the narrower one's width, with less than 0.4 m between them, they are one opening.
  let joined = true
  while (joined) {
    joined = false
    for (let i = 0; i < openings.length && !joined; i += 1)
      for (let j = i + 1; j < openings.length && !joined; j += 1) {
        const p = openings[i]
        const q = openings[j]
        const overlap = Math.min(p.along[1], q.along[1]) - Math.max(p.along[0], q.along[0])
        const narrower = Math.min(p.along[1] - p.along[0], q.along[1] - q.along[0])
        const gap = Math.max(p.sillY, q.sillY) - Math.min(p.headY, q.headY)
        if (overlap < 0.5 * narrower || gap > 0.4) continue
        const sill = Math.min(p.sillY, q.sillY)
        const head = Math.max(p.headY, q.headY)
        const along: [number, number] = [Math.min(p.along[0], q.along[0]), Math.max(p.along[1], q.along[1])]
        const toFloor = sill <= 0.35
        openings[i] = { ...p, kind: toFloor ? (along[1] - along[0] >= 2.2 ? 'GARAGE_DOOR' : 'GLAZED_DOOR') : 'WINDOW', rectPx: { x0: Math.min(p.rectPx.x0, q.rectPx.x0), y0: Math.min(p.rectPx.y0, q.rectPx.y0), x1: Math.max(p.rectPx.x1, q.rectPx.x1), y1: Math.max(p.rectPx.y1, q.rectPx.y1) }, along: [round6(along[0]), round6(along[1])], sillY: round6(toFloor ? 0 : sill), headY: round6(head), why: `${p.why}; joined with the piece above or below it (${q.why})` }
        openings.splice(j, 1)
        joined = true
      }
  }
  // Overlapping readings of one opening: keep the larger.
  openings.sort((p, q) => q.along[1] - q.along[0] - (p.along[1] - p.along[0]))
  const kept: PictureOpening[] = []
  for (const o of openings) if (!kept.some((k) => Math.min(k.along[1], o.along[1]) - Math.max(k.along[0], o.along[0]) > -0.1 && Math.min(k.headY, o.headY) - Math.max(k.sillY, o.sillY) > 0.05)) kept.push(o)
  kept.sort((p, q) => p.along[0] - q.along[0])
  kept.forEach((o, i) => (o.id = `photo-opening-${i}`))
  // --- the roof over the widest segment: its top row, its rise and a pitch
  const topRows = [] as number[]
  for (let x = main.x0; x <= main.x1; x += 1) if (tops[x] >= 0) topRows.push(tops[x])
  topRows.sort((p, q) => p - q)
  const topRow = topRows[Math.floor(topRows.length * 0.1)]
  const riseM = Math.max(1, ((eaveAt((main.x0 + main.x1) / 2) - topRow) * wallH) / heightPx((main.x0 + main.x1) / 2))
  // --- rooflights: light patches inside the roof over the widest segment, between its eave and its top
  const rooflights: SingleImageReading['rooflights'] = []
  {
    const rmask = new Uint8Array(W * H)
    const roofL = lumaOf(roof)
    for (let x = main.x0; x <= main.x1; x += 1)
      for (let y = Math.max(0, tops[x] + 2); y < eaveAt(x) - 2; y += 1) {
        if (tops[x] < 0 || isSky(x, y)) continue
        const c = rgb(raster, x, y)
        if (lumaOf(c) > roofL + 50 && c[2] >= c[0] - 10 && !isWall(c)) rmask[y * W + x] = 1
      }
    const rseen = new Uint8Array(W * H)
    for (let i = 0; i < W * H; i += 1) {
      if (!rmask[i] || rseen[i]) continue
      const stack = [i]
      rseen[i] = 1
      let x0 = W
      let y0 = H
      let x1 = 0
      let y1 = 0
      let n = 0
      while (stack.length > 0) {
        const j = stack.pop() as number
        const jx = j % W
        const jy = (j - jx) / W
        n += 1
        x0 = Math.min(x0, jx)
        x1 = Math.max(x1, jx)
        y0 = Math.min(y0, jy)
        y1 = Math.max(y1, jy)
        for (const k of [jx > 0 ? j - 1 : -1, jx < W - 1 ? j + 1 : -1, j - W, j + W]) {
          if (k < 0 || k >= W * H || rseen[k] || !rmask[k]) continue
          rseen[k] = 1
          stack.push(k)
        }
      }
      const a0 = alongOf(x0)
      const a1 = alongOf(x1 + 1)
      if (n < 30 || a1 - a0 < 0.4 || a1 - a0 > 1.8) continue
      // Glass set in the covering: the covering surrounds it on most of a ring a few pixels outside its box.
      let ring = 0
      let roofy = 0
      for (let xx = x0 - 3; xx <= x1 + 3; xx += 1)
        for (const yy of [y0 - 3, y1 + 3]) {
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue
          ring += 1
          if (isRoof(rgb(raster, xx, yy))) roofy += 1
        }
      for (let yy = y0 - 3; yy <= y1 + 3; yy += 1)
        for (const xx of [x0 - 3, x1 + 3]) {
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue
          ring += 1
          if (isRoof(rgb(raster, xx, yy))) roofy += 1
        }
      if (ring === 0 || roofy / ring < 0.6) continue
      const mid = (x0 + x1) / 2
      const up0 = (eaveAt(mid) - (y1 + 1)) / Math.max(1, eaveAt(mid) - topRow)
      const up1 = (eaveAt(mid) - y0) / Math.max(1, eaveAt(mid) - topRow)
      if (up0 < 0.05 || up1 > 0.95) continue
      rooflights.push({ id: `photo-rooflight-${rooflights.length}`, rectPx: { x0, y0, x1: x1 + 1, y1: y1 + 1 }, along: [round6(a0), round6(a1)], upSlope: [round6(up0), round6(up1)] })
    }
    // Patches of one glass broken by its frame or glazing bar: the larger stands, overlapping ones (with a 0.1 m gap
    // the model needs between two cuts) are dropped.
    rooflights.sort((p, q) => q.along[1] - q.along[0] - (p.along[1] - p.along[0]))
    const keptLights: typeof rooflights = []
    for (const r of rooflights) if (!keptLights.some((k) => Math.min(k.along[1], r.along[1]) - Math.max(k.along[0], r.along[0]) > -0.1)) keptLights.push(r)
    keptLights.sort((p, q) => p.along[0] - q.along[0])
    rooflights.length = 0
    keptLights.forEach((r, i) => rooflights.push({ ...r, id: `photo-rooflight-${i}` }))
  }
  const mainAlong: [number, number] = [alongOf(main.x0), alongOf(main.x1)]
  const depthM = Math.max(6, Math.min(12, (mainAlong[1] - mainAlong[0]) * 0.9))
  const pitchDeg = round6(Math.max(25, Math.min(50, (Math.atan(riseM / (depthM / 2)) * 180) / Math.PI)))
  assumptions.push(`depth ${depthM.toFixed(2)} m (not seen: 0.9 of the widest segment, kept to 6..12 m); a symmetric gable over each segment, its ridge along the front, at a pitch of ${pitchDeg.toFixed(1)}° from the main roof's apparent rise of ${riseM.toFixed(2)} m`)
  assumptions.push('the side walls, the back and the roof behind the ridges are not seen: closed, without openings, as a hypothesis; all segments stand on one front plane')
  // The segments as stretches of the front: the gaps between them (a porch, a corner the eaves could not be read on)
  // are shared out to their neighbours at their middles.
  const cuts = segments.map((s) => [alongOf(s.x0), alongOf(s.x1)] as [number, number])
  for (let i = 0; i + 1 < cuts.length; i += 1) {
    const midGap = (cuts[i][1] + cuts[i + 1][0]) / 2
    cuts[i][1] = midGap
    cuts[i + 1][0] = midGap
  }
  return {
    ok: true,
    wall: { x0: wx0, x1: wx1, eave: [round6(eaveAt(wx0)), round6(eaveAt(wx1))], ground: [round6(footAt(wx0)), round6(footAt(wx1))], widthM: round6(widthM), heightM: round6(wallH), storeys },
    segments: segments.map((s, i) => ({ x0: s.x0, x1: s.x1, along: [round6(cuts[i][0]), round6(cuts[i][1])] as [number, number], eave: [round6(eaveOf(s)(s.x0)), round6(eaveOf(s)(s.x1))] as [number, number], heightM: round6(s === main ? wallH : segmentHeight(s)), main: s === main })),
    roof: { topRow, riseM: round6(riseM), pitchDeg, depthM: round6(depthM) },
    colours: { roof, wall },
    openings: kept,
    rooflights,
    assumptions,
    why,
  }
}

/**
 * The reading, as the building the drawings' path builds: one body per wall segment along the front (the widest is
 * the main one under the main gable, the others attached with gables of their own), the openings on the front wall of
 * the segment they stand in, the rooflights on the main front slope. Every feature id names the picture.
 */
export function buildingFromSingleImage(reading: SingleImageReading, options: SingleImageOptions = {}): BuildingV2 {
  const T = options.wallThicknessM ?? 0.3
  const depth = reading.roof.depthM
  const storeys = reading.wall.storeys
  const storeyH = round6(reading.wall.heightM / storeys)
  const levels: LevelV2[] = Array.from({ length: storeys }, (_, i) => ({ index: i, id: `lvl-${i}`, elevation: round6(i * storeyH), height: storeyH, wallTop: round6((i + 1) * storeyH), featureId: `photo-level-${i}` }))
  const masses: MassV2[] = reading.segments.map((s, i) => ({ id: s.main ? 'main' : `wing-${i}`, role: s.main ? 'MAIN' : 'ATTACHED', x0: round6(s.along[0]), z0: 0, x1: round6(s.along[1]), z1: s.main ? depth : round6(Math.max(4, depth * 0.85)), storeys: s.main ? levels.map((l) => l.index) : [0], featureId: `photo-mass-${i}`, sourceMassId: `photo-segment-${i}` }))
  const main = masses.find((m) => m.role === 'MAIN') as MassV2
  const pitch = reading.roof.pitchDeg
  const tan = Math.tan((pitch * Math.PI) / 180)
  const eaveY = round6(storeys * storeyH)
  const ridgeY = round6(eaveY + (depth / 2) * tan)
  const mainRoof: MainRoofV2 = { massId: 'main', kind: 'GABLE', pitchDeg: pitch, ridgeAxis: 'X', ridgeAt: round6(depth / 2), eaveY, ridgeY, footprint: { x0: main.x0, z0: 0, x1: main.x1, z1: depth }, coversZones: false, coversZonesWhy: 'one picture: no zones are read', buildUpVerticalM: 0.15, thicknessM: 0.28, authority: 'ASSUMED_FOR_RENDERING', featureId: 'photo-roof', provenance: 'ASSUMED_FOR_RENDERING' }
  const join: MainRoofForJoin = { ridgeAxis: 'X', ridgeAt: mainRoof.ridgeAt, eaveY, ridgeY, pitchDeg: pitch, footprint: { x0: main.x0, x1: main.x1, z0: 0, z1: depth } }
  const pitchedAttachedRoofs: BuildingV2['pitchedAttachedRoofs'] = masses
    .filter((m) => m.role === 'ATTACHED')
    .map((m) => {
      const wingEave = round6(storeyH)
      const body = { x0: m.x0, x1: m.x1, z0: m.z0, z1: m.z1 }
      return {
        massId: m.id,
        kind: 'GABLE',
        ridgeAxis: 'X',
        pitchDeg: pitch,
        pitchSource: 'MEASURED',
        eaveY: wingEave,
        ridgeY: round6(wingEave + ((m.z1 - m.z0) / 2) * tan),
        thicknessM: 0.28,
        footprint: body,
        layout: attachedGableLayout(body, 'X', pitch, wingEave, join),
        form: { kind: 'GABLE', ridgeAxis: 'X', pitchDeg: pitch, pitchSource: 'MEASURED', measuredRiseM: 0, expectedRiseM: 0, readings: [], confidence: 0.3, why: 'assumed from the main roof of one picture' },
        featureId: `photo-roof-${m.id}`,
        provenance: 'ASSUMED_FOR_RENDERING',
      } satisfies BuildingV2['pitchedAttachedRoofs'][number]
    })
  const prov = (p: ProvenanceStatus): OpeningV2['provenance'] => ({ interval: p, width: p, sill: p, head: p, profile: 'ASSUMED_FOR_RENDERING', family: 'VISUAL_SEMANTIC' })
  const openings: OpeningV2[] = []
  for (const o of reading.openings) {
    const centre = (o.along[0] + o.along[1]) / 2
    const mass = masses.find((m) => centre >= m.x0 && centre <= m.x1)
    if (!mass) continue
    // A wall under the eaves stops where the roof's underside meets it: the roof's thickness, measured plumb, below.
    const top = (mass.role === 'MAIN' ? storeys * storeyH : storeyH) - mainRoof.thicknessM / Math.cos((pitch * Math.PI) / 180)
    const storeyIndex = mass.role === 'MAIN' ? Math.min(storeys - 1, Math.floor((o.sillY + 0.3) / storeyH)) : 0
    const floor = storeyIndex * storeyH
    const head = Math.min(o.headY, Math.min(top, floor + storeyH) - 0.15)
    const sill = o.kind === 'WINDOW' ? Math.max(floor + 0.2, o.sillY) : floor
    const lo = Math.max(mass.x0 + T + 0.1, o.along[0])
    const hi = Math.min(mass.x1 - T - 0.1, o.along[1])
    if (hi - lo < 0.3 || head - sill < 0.4) continue
    openings.push({
      id: o.id,
      storeyIndex,
      massId: mass.id,
      facade: 'FRONT',
      planeAt: 0,
      interval: [round6(lo), round6(hi)],
      widthM: round6(hi - lo),
      sillY: round6(sill),
      headY: round6(head),
      profile: 'RECTANGULAR',
      family: o.kind,
      mullions: [],
      planGap: { frameId: 'photo', pixelRect: o.rectPx },
      provenance: prov('ASSUMED_FOR_RENDERING'),
      uncertaintyM: 0.3,
      unresolved: ['indicative: placed on the wall plane of one perspective picture at an assumed scale'],
      confidence: o.confidence,
      why: o.why,
    })
  }
  const half = depth / 2
  const rooflights: BuildingV2['rooflights'] = reading.rooflights
    .filter((r) => r.along[0] >= main.x0 + 0.3 && r.along[1] <= main.x1 - 0.3)
    .map((r) => {
      const s0 = round6(Math.max(0.3, r.upSlope[0] * half))
      const s1 = round6(Math.min(half - 0.3, Math.max(s0 + 0.5, r.upSlope[1] * half)))
      const rl: RooflightReading = { id: r.id, slope: 'LOW', alongFrom: r.along[0], alongTo: r.along[1], slopeFrom: s0, slopeTo: s1, yFrom: round6(eaveY + s0 * tan), yTo: round6(eaveY + s1 * tan), frameId: 'photo', confidence: 0.35, why: `a light patch in the roof over ${r.along[0].toFixed(2)}..${r.along[1].toFixed(2)} m along the eaves` }
      return { ...rl, featureId: `photo-${r.id}`, provenance: 'VISUAL_SEMANTIC' as ProvenanceStatus, widthM: round6(r.along[1] - r.along[0]), lengthM: round6((s1 - s0) / Math.cos((pitch * Math.PI) / 180)) }
    })
  return {
    label: SINGLE_IMAGE_LABEL,
    wallThicknessM: T,
    slabThicknessM: 0.25,
    levels,
    masses,
    mainRoof,
    attachedRoofs: [],
    pitchedAttachedRoofs,
    recesses: [],
    returns: [],
    balconies: [],
    railings: [],
    portalHeads: [],
    verges: [],
    terraces: [],
    massTones: [],
    returnTones: [],
    facadeGraph: { nodes: [], edges: [] },
    chimneys: [],
    rooflights,
    openings,
    sharedDoors: [],
    interior: [],
    assemblies: [],
    surfaceRegions: [],
  }
}

export type SingleImageModel = {
  ok: true
  reading: SingleImageReading
  building: BuildingV2
  /** The emitted model, serialized: the same command program and validator the drawings' path uses. */
  modelJson: string
  /** Openings the model fitted to its walls or dropped, by name. */
  fits: Array<{ openingId: string; action: string; why: string }>
}

/**
 * One picture to a model: read, build, emit, fit and run through the model's own validator. The model is named
 * `MODEL ORIENTACYJNY Z 1 ZDJĘCIA` and every object in it carries an evidence status that is not a measurement.
 */
export function reconstructFromSingleImage(raster: Raster, modelId: string, options: SingleImageOptions = {}): SingleImageModel | SingleImageRefusal {
  const reading = readSingleImage(raster, options)
  if (!reading.ok) return reading
  const building = buildingFromSingleImage(reading, options)
  const emitted = emitBuilding(building, SINGLE_IMAGE_LABEL, options.debug)
  const fit = fitOpeningsToHosts(emitted.program, SINGLE_IMAGE_LABEL, modelId)
  if (!fit.ok) return { ok: false, reason: `the model refused command ${fit.failedAt} (${fit.command.type}): ${fit.errors.map((e) => e.code).join(', ')}`, why: reading.why }
  const model = buildCandidateModel(fit.program, SINGLE_IMAGE_LABEL, modelId)
  return { ok: true, reading, building, modelJson: serializeModel(model), fits: fit.fits.map((f) => ({ openingId: f.openingId, action: f.action, why: f.why })) }
}
