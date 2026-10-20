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
import { emitBuilding, planeRoofPlaneId } from '../v2/emit.js'
import { skyMask } from '../v2/camera.js'
import type { BuildingV2, LevelV2, MassV2, PlaneRoofV2 } from '../v2/building.js'
import { planeAt, planeRoofLayout } from '../v2/plane-roof.js'
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
  /** A round head seen on the picture; the model's openings are level-headed, so it is noted, not built. */
  headShape?: 'ARCHED'
  /** The cross gable (index into `gables`) whose face above the eaves the opening stands in. */
  inGable?: number
  confidence: number
  why: string
}

export type SingleImageReading = {
  ok: true
  /** Pixel rows of the wall's eave and ground lines at the wall's two ends. */
  wall: { x0: number; x1: number; eave: [number, number]; ground: [number, number]; widthM: number; heightM: number; storeys: number }
  /** The stretches of the front with eaves of their own, left to right, in metres along the front. */
  segments: Array<{ x0: number; x1: number; along: [number, number]; eave: [number, number]; heightM: number; main: boolean; ends: { min: RoofEndReading; max: RoofEndReading } }>
  roof: { topRow: number; riseM: number; pitchDeg: number; depthM: number }
  colours: { roof: [number, number, number]; wall: [number, number, number] }
  openings: PictureOpening[]
  /** Rooflights by the segment whose roof they are set in: along the front, and up the slope as shares of its rise. */
  rooflights: Array<{ id: string; rectPx: { x0: number; y0: number; x1: number; y1: number }; along: [number, number]; upSlope: [number, number]; segment: number }>
  /** Gables facing the camera over the front (CROSS) or seen from aside beyond its ends (END), in pixels. */
  gables: Array<{ kind: 'CROSS' | 'END'; side?: 'MIN' | 'MAX'; x0: number; x1: number; apexX: number; apexY: number; along: [number, number]; riseM: number; pitchDeg: number }>
  /** What the reading had to assume, by name. */
  assumptions: string[]
  why: string[]
}

/** How one end of a roof was read: what it is and what said so. */
export type RoofEndReading = { kind: 'GABLE' | 'HIP'; evidence: 'GABLE_FACE' | 'PLATEAU' | 'RAMP' | 'SYMMETRY' | 'PARTY' | 'UNSEEN'; why: string; /** A hip's run in from the wall's end to where the ridge starts, along the front (metres). */ insetM?: number }

export type SingleImageRefusal = { ok: false; reason: string; why: string[] }

type RGB = [number, number, number]

/** Two neutral greys this far apart in tint (red and blue against green, in levels) are two surfaces. */
const TINT_APART = 9
/** Rows of another tint that end a grey covering's run: one row is a tile's shadow. */
const TINT_RUN = 4
/** Mean local deviation of luma (levels, 3 × 3 deviation averaged over 3 × 3) above which a surface is not render. */
const TEXTURE_MIN = 7
/** A smooth pixel this much darker than the lit wall about it is dark glass or a dark leaf. */
const DARK_SHARE = 0.45
/** Half the side of the square an opening must hold: thinner things are edges and lines. */
const OPENING_RADIUS = 3
/** A pixel whose 9 × 9 surroundings are this much foliage or flowers is planting, not facade. */
const VEGETATION_SHARE = 0.25
/** A component's columns holding less than this share of its height part it in two. */
const SPLIT_SHARE = 0.25
/** Two pieces join as panes of one opening while their joined box stays this full. */
const PANE_JOIN_FILL = 0.55
/** The widest mullion between a door and its side light. */
const ENTRANCE_MULLION_M = 0.35
/** Two eave stretches whose read columns lie within this many pixels of one line through both are one eave... */
const COLLINEAR_EAVE_PX = 4
/** ... for this share of the read columns of each. */
const COLLINEAR_SHARE = 0.7
/** The most stretches of eave read, one after another, before the rest is left unread. */
const MAX_EAVE_STRETCHES = 4
/** Rows under an eave line sampled for the wall it should stand on, and the share of them that must be neutral wall. */
const WALL_UNDER_EAVE_ROWS = 24
const WALL_UNDER_EAVE_SHARE = 0.5
/** The most the wall's foot line leans away from its eave line, in rows per column. */
const FOOT_LEAN = 0.12
/** A break in an eave's run of read columns wider than this share of the picture ends the run. */
const EAVE_RUN_GAP = 0.025
/** Wall starting this far above the eave line (share of the wall's height, and at least so many pixels) is a gable face. */
const GABLE_MIN_RISE = 0.2
const GABLE_MIN_RISE_PX = 12
/** Columns of a gable face further apart than this belong to two faces. */
const GABLE_GAP_PX = 25
/** Rows from a rake's line down to the face under it: the verge board and its shadow. */
const RAKE_SOFFIT_PX = 12
/** A rake slopes at least this steeply in the picture (rows per column). */
const RAKE_MIN_SLOPE = 0.3
/** The mean distance of a face's top points from its two rakes, at most. */
const RAKE_MAX_RESIDUAL_PX = 5
/** Luma levels by which a rooflight's glass or frame stands apart from the covering. */
const ROOFLIGHT_CONTRAST = 35
/** The least gap the model takes between two cuts in one roof, with a margin. */
const ROOFLIGHT_GAP_M = 0.12
/** The narrowest rooflight, along the eaves. */
const ROOFLIGHT_MIN_M = 0.35
/** A cross gable's body stands this far before the front it rises from: not seen, assumed. */
const CROSS_GABLE_DEPTH_M = 1.0
/** The narrowest cross gable that is built. */
const CROSS_GABLE_MIN_M = 1.5
/** A door's or a gate's height, head to floor: the scale a picture's doors give. */
const DOOR_HEIGHT_M = 2.2
/** An opening on the wall's foot lower than this is not a door. */
const MIN_DOOR_M = 1.5
/** A gate's leaf is at least this light against the wall about it; glass is darker. */
const GATE_LIGHTNESS = 0.75
/** A door and its side light: heads within this of each other. */
const ENTRANCE_HEAD_SPREAD_M = 0.6
/** How far a cross gable's verges and eaves stand proud of its walls. */
const VERGE_PROUD_M = 0.1
/** An opening within this of a cross gable's axis is taken to stand on it. */
const GABLE_AXIS_SNAP_M = 0.3
/** A cross gable's pitch, kept to a range a roof is built at. */
const CROSS_GABLE_MIN_PITCH = 25
const CROSS_GABLE_MAX_PITCH = 55
/** A segment's end within this share of the picture's width of another segment is a party end. */
const PARTY_GAP = 0.12
/** The roof's top at a wall's end at least this share of its rise: level to the end (a gable). */
const PLATEAU_END = 0.8
/** Under this share, and coming down from at least RAMP_INSET of the wall's run inside: a hip. */
const RAMP_END = 0.65
const RAMP_INSET = 0.08
/** How far past a wall's end, as a share of the picture's width, a hip's outline is followed down. */
const HIP_REACH_BEYOND = 0.08

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
/** Living planting is a vivid green; the trees glass reflects are a dull one. */
const foliage = (c: RGB): boolean => green(c) && satOf(c) > 0.25
const dist = (a: RGB, b: RGB): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const median = (xs: readonly number[]): number => {
  if (xs.length === 0) return Number.NaN
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}
const medianColour = (cs: readonly RGB[]): RGB => [median(cs.map((c) => c[0])), median(cs.map((c) => c[1])), median(cs.map((c) => c[2]))]

/** Box sums over a (2r+1)² window, edges clamped, from a summed-area table. */
function boxMean(values: Float32Array, W: number, H: number, r: number): Float32Array {
  const S = new Float64Array((W + 1) * (H + 1))
  for (let y = 0; y < H; y += 1) {
    let row = 0
    for (let x = 0; x < W; x += 1) {
      row += values[y * W + x]
      S[(y + 1) * (W + 1) + x + 1] = S[y * (W + 1) + x + 1] + row
    }
  }
  const out = new Float32Array(W * H)
  for (let y = 0; y < H; y += 1) {
    const y0 = Math.max(0, y - r)
    const y1 = Math.min(H, y + r + 1)
    for (let x = 0; x < W; x += 1) {
      const x0 = Math.max(0, x - r)
      const x1 = Math.min(W, x + r + 1)
      out[y * W + x] = (S[y1 * (W + 1) + x1] - S[y0 * (W + 1) + x1] - S[y1 * (W + 1) + x0] + S[y0 * (W + 1) + x0]) / ((y1 - y0) * (x1 - x0))
    }
  }
  return out
}

/** The local texture of the picture: the deviation of luma over 3 × 3, averaged over 3 × 3. */
export function textureMap(raster: Raster): Float32Array {
  const W = raster.width
  const H = raster.height
  const L = new Float32Array(W * H)
  const L2 = new Float32Array(W * H)
  for (let i = 0; i < W * H; i += 1) {
    const l = 0.299 * raster.data[i * 4] + 0.587 * raster.data[i * 4 + 1] + 0.114 * raster.data[i * 4 + 2]
    L[i] = l
    L2[i] = l * l
  }
  const m = boxMean(L, W, H, 1)
  const m2 = boxMean(L2, W, H, 1)
  const sd = new Float32Array(W * H)
  for (let i = 0; i < W * H; i += 1) sd[i] = Math.sqrt(Math.max(0, m2[i] - m[i] * m[i]))
  return boxMean(sd, W, H, 1)
}

/** The share of foliage (green) and flowers (strongly saturated) about each pixel, over 9 × 9. */
function vegetationShare(raster: Raster): Float32Array {
  const n = raster.width * raster.height
  const v = new Float32Array(n)
  for (let i = 0; i < n; i += 1) {
    const c: RGB = [raster.data[i * 4], raster.data[i * 4 + 1], raster.data[i * 4 + 2]]
    v[i] = foliage(c) || satOf(c) > 0.45 ? 1 : 0
  }
  return boxMean(v, raster.width, raster.height, 4)
}

/**
 * The line through the most points within `tolerance` rows: every pair of points over a strided sample is a candidate,
 * the best is refined by least squares over its inliers. Deterministic.
 */
function robustLine(points: ReadonlyArray<{ x: number; y: number }>, tolerance: number, slope: { about: number; within: number } = { about: 0, within: 0.35 }): { a: number; b: number; inliers: number } | undefined {
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
      if (Math.abs(a - slope.about) > slope.within) continue
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

type Line = { a: number; b: number }
/** A gable face in the picture: its base columns on the eave line, its apex and its two rakes (rows as lines in x). */
type GableFace = { x0: number; x1: number; apexX: number; apexY: number; left: Line; right: Line; kind: 'CROSS' | 'END'; side?: 'MIN' | 'MAX'; residualPx: number }

const leastSquares = (pts: ReadonlyArray<{ x: number; y: number }>): Line & { residual: number } => {
  const n = pts.length
  const mx = pts.reduce((s, p) => s + p.x, 0) / n
  const my = pts.reduce((s, p) => s + p.y, 0) / n
  const sxx = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0)
  const a = sxx > 0 ? pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / sxx : 0
  const b = my - a * mx
  return { a, b, residual: pts.reduce((s, p) => s + Math.abs(p.y - (a * p.x + b)), 0) }
}

/**
 * The best inverted V through the top points of a raised stretch of wall: a left rake rising to the right and a right
 * rake falling to the right, split at the column that fits both best. Undefined where no split gives two rakes of the
 * right lean within a few pixels.
 */
function peakedFace(pts: ReadonlyArray<{ x: number; y: number }>): { apexX: number; apexY: number; left: Line; right: Line; residual: number } | undefined {
  if (pts.length < 8) return undefined
  let best: { apexX: number; apexY: number; left: Line; right: Line; residual: number } | undefined
  for (let k = 4; k <= pts.length - 4; k += 1) {
    const l = leastSquares(pts.slice(0, k))
    const r = leastSquares(pts.slice(k))
    if (l.a > -RAKE_MIN_SLOPE || r.a < RAKE_MIN_SLOPE) continue
    const residual = (l.residual + r.residual) / pts.length
    if (best && residual >= best.residual) continue
    const apexX = (r.b - l.b) / (l.a - r.a)
    if (apexX < pts[0].x - 10 || apexX > pts[pts.length - 1].x + 10) continue
    best = { apexX, apexY: l.a * apexX + l.b, left: { a: l.a, b: l.b }, right: { a: r.a, b: r.b }, residual }
  }
  return best && best.residual <= RAKE_MAX_RESIDUAL_PX ? best : undefined
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
    for (let y = tops[x] + 3; y < Math.min(H, tops[x] + 40); y += 1) {
      const c = rgb(raster, x, y)
      // A cloud the sky's flood did not reach is pale or blue; a covering is neither.
      if (green(c) || c[2] - Math.max(c[0], c[1]) >= 6 || (lumaOf(c) >= 200 && satOf(c) < 0.12)) continue
      roofSamples.push(c)
    }
  }
  if (roofSamples.length < 50) return { ok: false, reason: 'no roof under the sky: the picture does not show a house against the sky', why }
  // The covering is the commonest colour of that band, not its median: a band that crosses a chimney, a dormer's face
  // or a wall seen over a low roof is still mostly covering. Colours are binned coarsely and the fullest bin, with its
  // neighbours, gives the median.
  const binOf = (c: RGB): number => (c[0] >> 5) * 64 + (c[1] >> 5) * 8 + (c[2] >> 5)
  const counts = new Map<number, number>()
  for (const c of roofSamples) counts.set(binOf(c), (counts.get(binOf(c)) ?? 0) + 1)
  // the fullest neighbourhood of bins, not the fullest bin: a colour on a bin's edge must not swing the choice
  const around = (key: number): number => {
    let n = 0
    for (let dr = -1; dr <= 1; dr += 1)
      for (let dg = -1; dg <= 1; dg += 1)
        for (let db = -1; db <= 1; db += 1) {
          const r = (key >> 6) + dr
          const g = ((key >> 3) & 7) + dg
          const b = (key & 7) + db
          if (r >= 0 && r < 8 && g >= 0 && g < 8 && b >= 0 && b < 8) n += counts.get(r * 64 + g * 8 + b) ?? 0
        }
    return n
  }
  const fullest = [...counts.keys()].map((k) => [k, around(k)] as const).sort((p, q) => q[1] - p[1] || p[0] - q[0])[0][0]
  const near = (c: RGB): boolean => Math.abs((c[0] >> 5) - (fullest >> 6)) <= 1 && Math.abs((c[1] >> 5) - ((fullest >> 3) & 7)) <= 1 && Math.abs((c[2] >> 5) - (fullest & 7)) <= 1
  const roof = medianColour(roofSamples.filter(near))
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
  // Where the run ended on a wall of another tint, the wall starts on the next row: there is no light soffit to find.
  const endedOnTint = new Uint8Array(W)
  // The roof runs down from the sky until the first run of light neutral pixels: the soffit or the wall under the
  // eaves. A covering's own shading (tile rows, a dark ridge) never stops it; planting before any wall does.
  const lightNeutral = (c: RGB): boolean => lumaOf(c) >= 170 && satOf(c) <= 0.18
  // A grey covering over a wall in the shade of its eaves: both are neutral and neither is light, but they are not the
  // same grey. Its tint — the small residue of red and blue against green — is the covering's own; a run of rows of
  // another tint is the wall under it.
  const tint = (c: RGB): [number, number] => [c[0] - c[1], c[2] - c[1]]
  const roofTint = tint(roof)
  const otherTint = (c: RGB): boolean => lumaOf(c) > 60 && Math.hypot(tint(c)[0] - roofTint[0], tint(c)[1] - roofTint[1]) > TINT_APART
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
      if (roofSat <= 0.2 && y > tops[x] + 4) {
        let run = 0
        while (run < TINT_RUN && y + run < H && otherTint(rgb(raster, x, y + run)) && !green(rgb(raster, x, y + run))) run += 1
        if (run === TINT_RUN) {
          end = y - 1
          endedOnTint[x] = 1
          break
        }
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
    let first = endedOnTint[x] ? roofEnd[x] + 1 : -1
    if (first < 0)
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
  /** `seen`: the stretch of columns its eave was read on at its widest; a merged eave spans what lies between. */
  type Segment = { x0: number; x1: number; a: number; b: number; seen: [number, number] }
  const segments: Segment[] = []
  let remaining = [...eaveRows]
  const minRun = Math.max(20, Math.round(W * 0.06))
  // a downpipe, a chimney's shadow or a tree across the eaves breaks their run for a few columns, not for a wall's width
  const runGap = Math.max(12, Math.round(W * EAVE_RUN_GAP))
  for (let k = 0; k < MAX_EAVE_STRETCHES && remaining.length >= minRun; k += 1) {
    const line = robustLine(remaining, 3)
    if (!line) break
    const xs = remaining.filter((p) => Math.abs(p.y - (line.a * p.x + line.b)) <= 3).map((p) => p.x).sort((p, q) => p - q)
    // The longest run of inlier columns with gaps of at most a few pixels.
    let best: [number, number] = [xs[0], xs[0]]
    let start = xs[0]
    for (let i = 1; i <= xs.length; i += 1) {
      if (i === xs.length || xs[i] - xs[i - 1] > runGap) {
        if (xs[i - 1] - start > best[1] - best[0]) best = [start, xs[i - 1]]
        if (i < xs.length) start = xs[i]
      }
    }
    if (best[1] - best[0] < minRun) break
    // Under an eave stands a wall: a stretch whose band under the line is mostly not neutral surface (a pergola's
    // timber, trees, a hedge) is something else's edge.
    let wallLike = 0
    let sampled = 0
    for (let x = best[0]; x <= best[1]; x += 2)
      for (let dy = 3; dy <= WALL_UNDER_EAVE_ROWS; dy += 3) {
        const y = Math.round(line.a * x + line.b) + dy
        if (y < 0 || y >= H) continue
        sampled += 1
        const c = rgb(raster, x, y)
        // (a cloud the sky's flood did not reach is neutral too, but blue)
        if (neutral(c) && c[2] - Math.max(c[0], c[1]) < 6) wallLike += 1
      }
    if (sampled === 0 || wallLike / sampled < WALL_UNDER_EAVE_SHARE) {
      remaining = remaining.filter((p) => p.x < best[0] || p.x > best[1])
      continue
    }
    if (segments.some((s) => Math.min(s.x1, best[1]) - Math.max(s.x0, best[0]) > 0)) {
      remaining = remaining.filter((p) => p.x < best[0] || p.x > best[1])
      continue
    }
    // A stretch on the line of one already found, across a short break (a downpipe, a sign), is the same eave.
    const same = segments.find((s) => Math.min(Math.abs(best[0] - s.x1), Math.abs(s.x0 - best[1])) <= 40 && Math.abs(s.a * (best[0] < s.x0 ? s.x0 : s.x1) + s.b - (line.a * (best[0] < s.x0 ? s.x0 : s.x1) + line.b)) <= 4)
    if (same) {
      same.x0 = Math.min(same.x0, best[0])
      same.x1 = Math.max(same.x1, best[1])
      same.seen = [same.x0, same.x1]
    } else segments.push({ x0: best[0], x1: best[1], a: line.a, b: line.b, seen: [best[0], best[1]] })
    remaining = remaining.filter((p) => p.x < best[0] || p.x > best[1])
  }
  if (segments.length === 0) return { ok: false, reason: 'no straight eave line could be fitted', why }
  segments.sort((p, q) => p.x0 - q.x0)
  // Two stretches on one line, however far apart — a cross gable, a downpipe or a tree between them — are one eave:
  // they meet within a few pixels across the gap and run alike. A wing whose eave stands lower or higher is not.
  for (let i = 0; i + 1 < segments.length; ) {
    const s = segments[i]
    const t = segments[i + 1]
    // one line through the eave rows of both holds most of each: the short stretch's own fit may lean, its rows do not
    const ofS = eaveRows.filter((p) => p.x >= s.x0 && p.x <= s.x1)
    const ofT = eaveRows.filter((p) => p.x >= t.x0 && p.x <= t.x1)
    const line = robustLine([...ofS, ...ofT], COLLINEAR_EAVE_PX)
    const holds = (pts: Array<{ x: number; y: number }>): boolean => !!line && pts.filter((p) => Math.abs(p.y - (line.a * p.x + line.b)) <= COLLINEAR_EAVE_PX).length >= COLLINEAR_SHARE * pts.length
    if (!line || !holds(ofS) || !holds(ofT)) {
      i += 1
      continue
    }
    segments.splice(i, 2, { x0: s.x0, x1: t.x1, a: line.a, b: line.b, seen: s.seen[1] - s.seen[0] >= t.seen[1] - t.seen[0] ? s.seen : t.seen })
    why.push(`the eaves over ${s.x0}..${s.x1} and ${t.x0}..${t.x1} are one line: one wall`)
  }
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
  // Over the widest segment's widest stretch of read eave only: a wing's foot, or the foot under an entrance between two
  // stretches of one eave, may run on into paving of the wall's own grey; that stretch's foot, extended, is the front's.
  const [fx0, fx1] = main.seen
  for (let k = 0; k < bins; k += 1) {
    const a = fx0 + ((fx1 - fx0) * k) / bins
    const b = fx0 + ((fx1 - fx0) * (k + 1)) / bins
    const inBin = footRows.filter((p) => p.x >= a && p.x < b && p.y > eaveOf(main)(p.x) + 8)
    if (inBin.length === 0) continue
    lows.push(inBin.reduce((m, p) => (p.y > m.y ? p : m), inBin[0]))
  }
  // The foot runs on the wall's plane like its eaves: in a picture of a wall the two lines converge slowly, never cross
  // it. Only lines near the eave line's own lean are fitted.
  const fitted = robustLine(lows, 6, { about: main.a, within: FOOT_LEAN })
  // Where no such line holds the stretch lows, the foot is taken parallel to the eaves at the lows' median depth under
  // them: the wall's height is then read the same along it, which is what a nearly square-on view shows anyway.
  const parallel = (): { a: number; b: number; inliers: number } | undefined => {
    if (lows.length < 3) return undefined
    const depth = median(lows.map((p) => p.y - (main.a * p.x + main.b)))
    return depth > 8 ? { a: main.a, b: main.b + depth, inliers: lows.filter((p) => Math.abs(p.y - (main.a * p.x + main.b + depth)) <= 6).length } : undefined
  }
  const foot = fitted && Math.abs(fitted.a - main.a) <= FOOT_LEAN && fitted.inliers >= 3 ? fitted : parallel()
  if (foot && foot !== fitted) assumptions.push('the wall\'s foot could not be fitted as a line of its own: taken parallel to the eaves at the median depth of the stretch lows')
  if (!foot || foot.inliers < 3) return { ok: false, reason: 'no straight wall foot could be fitted', why: [...why, `${segments.length} eave segments, ${lows.length} stretch lows`] }
  const footAt = (x: number): number => foot.a * x + foot.b
  why.push(`${segments.length} wall segment${segments.length === 1 ? '' : 's'} by their eave lines (${segments.map((s) => `${s.x0}..${s.x1}`).join(', ')}), the widest ${main.x0}..${main.x1}; foot line y = ${foot.a.toFixed(4)} x + ${foot.b.toFixed(1)} (${foot.inliers} of ${lows.length} stretch lows)`)
  // --- the wall plane: a pinhole camera, an assumed focal length and wall height, set on the widest segment
  const focal = (options.focalWidths ?? 1) * W
  const cx = W / 2
  assumptions.push(`focal length ${(options.focalWidths ?? 1).toFixed(2)} picture widths (a normal lens); the perspective of the wall plane is the convergence of its eave and foot lines`)
  const heightPx = (x: number): number => footAt(x) - eaveAt(x)
  // --- gable faces: wall that rises above the eave line in an inverted V under two rakes. Inside the front it is a
  // gable facing the camera over a part of the front (a cross gable, a wall dormer); beyond the front's end it is the
  // end of the roof seen from aside (a gable end). Read off the columns where the wall starts high above the eaves.
  const eaveNear = (x: number): number => eaveOf(segmentAt(x) ?? (x < wx0 ? segments[0] : segments[segments.length - 1]))(x)
  const raised = eaveRows.filter((p) => p.y < eaveNear(p.x) - Math.max(GABLE_MIN_RISE_PX, GABLE_MIN_RISE * heightPx(p.x))).sort((p, q) => p.x - q.x)
  const gableFaces: GableFace[] = []
  for (let i = 0; i < raised.length; ) {
    let j = i + 1
    while (j < raised.length && raised[j].x - raised[j - 1].x <= GABLE_GAP_PX) j += 1
    const run = raised.slice(i, j)
    const face = peakedFace(run)
    i = j
    if (!face) continue
    // where the rakes come down to the eave line, but no further than the raised wall was read: a rake's last stretch
    // runs on over the eaves of the roofs beside it
    const s = segmentAt(Math.round(face.apexX)) ?? (face.apexX < wx0 ? segments[0] : segments[segments.length - 1])
    // (the raised columns stop where the face is less than the threshold above the eaves: the rakes run on below that)
    const below = (x: number): number => Math.max(GABLE_MIN_RISE_PX, GABLE_MIN_RISE * heightPx(x))
    const xl = Math.max((s.b - face.left.b) / (face.left.a - s.a), run[0].x - below(run[0].x) / Math.abs(face.left.a))
    const xr = Math.min((s.b - face.right.b) / (face.right.a - s.a), run[run.length - 1].x + below(run[run.length - 1].x) / Math.abs(face.right.a))
    if (!(xl < face.apexX && face.apexX < xr) || xr - xl < minRun * 0.8) continue
    const lean = (face.apexX - xl) / (xr - face.apexX)
    if (lean < 1 / 3 || lean > 3) continue
    const inside = xl >= wx0 - GABLE_GAP_PX && xr <= wx1 + GABLE_GAP_PX
    gableFaces.push({ x0: Math.round(xl), x1: Math.round(xr), apexX: round6(face.apexX), apexY: round6(face.apexY), left: face.left, right: face.right, kind: inside ? 'CROSS' : 'END', ...(inside ? {} : { side: face.apexX < wx0 ? ('MIN' as const) : ('MAX' as const) }), residualPx: round6(face.residual) })
  }
  for (const g of gableFaces) why.push(`a ${g.kind === 'CROSS' ? 'gable facing the camera over the front' : `gable end at the ${g.side === 'MIN' ? 'left' : 'right'}`} over columns ${g.x0}..${g.x1}, apex at (${g.apexX.toFixed(0)}, ${g.apexY.toFixed(0)}), its rakes fitted within ${g.residualPx.toFixed(1)} px`)
  const crossAt = (x: number): GableFace | undefined => gableFaces.find((g) => g.kind === 'CROSS' && x >= g.x0 && x <= g.x1)
  /** The underside of a cross gable's rakes at a column, a few pixels under the rake line. */
  const rakeAt = (g: GableFace, x: number): number => (x <= g.apexX ? g.left.a * x + g.left.b : g.right.a * x + g.right.b) + RAKE_SOFFIT_PX
  // --- candidate openings: inside each segment's band, from its eaves, or from a cross gable's rakes, to its foot
  const bandTop = (x: number): number => {
    const s = segmentAt(x)
    if (!s) return Number.NaN
    const g = crossAt(x)
    return g ? Math.min(eaveOf(s)(x), rakeAt(g, x)) : eaveOf(s)(x)
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
  // An opening is told from the wall by its texture, not by its brightness alone: a rendered wall of any colour — white,
  // grey, dark, in sun or in shade — is smooth, while glass reflects, frames and bars cut it, a door has panels and a
  // gate its ribs. A light gate in a light wall and a dark wall beside dark glass are both read; a smooth very dark
  // rectangle (dark glass in shade, a dark leaf) is read by its darkness against the wall about it.
  const texture = textureMap(raster)
  const veg = vegetationShare(raster)
  const mask = new Uint8Array(W * H)
  for (let x = wx0; x <= wx1; x += 1) {
    if (!segmentAt(x)) continue
    for (let y = Math.ceil(bandTop(x)) + 2; y < Math.floor(footAt(x)); y += 1) {
      const i = y * W + x
      const c = rgb(raster, x, y)
      if (foliage(c) || isSky(x, y) || satOf(c) > 0.45 || veg[i] >= VEGETATION_SHARE) continue
      if (texture[i] > TEXTURE_MIN) {
        mask[i] = 1
        continue
      }
      const ref = refAt(x, y)
      if (ref > 0 && lumaOf(c) < ref * DARK_SHARE) mask[i] = 1
    }
  }
  // Thin structures — the edge between two wall finishes, a groove, a downpipe, a frame's outline — go: an opening of
  // the mask with a square of 2R+1 px keeps only what is at least that thick (panes, door leaves, gates).
  const R = OPENING_RADIUS
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
  if (options.debug) {
    // the mask and what the opening kept, run-length coded: value,count pairs
    const runs: number[] = []
    for (let i = 0; i < W * H; i += 1) {
      const v = mask[i] + 2 * opened[i]
      if (runs.length > 0 && runs[runs.length - 2] === v) runs[runs.length - 1] += 1
      else runs.push(v, 1)
    }
    options.debug(`mask ${W} ${H} ${runs.join(',')}`)
  }
  type Comp = { x0: number; y0: number; x1: number; y1: number; n: number }
  let comps: Comp[] = []
  const seen = new Uint8Array(W * H)
  const label = new Int32Array(W * H).fill(-1)
  for (let y = 0; y < H; y += 1)
    for (let x = 0; x < W; x += 1) {
      const i = y * W + x
      if (!opened[i] || seen[i]) continue
      const stack = [i]
      seen[i] = 1
      const id = comps.length
      const c: Comp = { x0: x, y0: y, x1: x, y1: y, n: 0 }
      while (stack.length > 0) {
        const j = stack.pop() as number
        const jx = j % W
        const jy = (j - jx) / W
        label[j] = id
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
  // Two openings, or an opening and a textured pilaster beside it, touch in the mask more often than not. Where a
  // component's columns thin out — a run of columns holding less than a quarter of its height — it is two things.
  comps = comps.flatMap((c, id) => {
    const h = c.y1 - c.y0 + 1
    const counts: number[] = []
    for (let x = c.x0; x <= c.x1; x += 1) {
      let n = 0
      for (let y = c.y0; y <= c.y1; y += 1) if (label[y * W + x] === id) n += 1
      counts.push(n)
    }
    const parts: Comp[] = []
    let start = -1
    for (let k = 0; k <= counts.length; k += 1) {
      const thick = k < counts.length && counts[k] >= Math.max(4, SPLIT_SHARE * h)
      if (thick && start < 0) start = k
      if (!thick && start >= 0) {
        const part: Comp = { x0: c.x0 + start, x1: c.x0 + k - 1, y0: H, y1: 0, n: 0 }
        for (let x = part.x0; x <= part.x1; x += 1)
          for (let y = c.y0; y <= c.y1; y += 1)
            if (label[y * W + x] === id) {
              part.n += 1
              part.y0 = Math.min(part.y0, y)
              part.y1 = Math.max(part.y1, y)
            }
        if (part.x1 - part.x0 >= 2 * OPENING_RADIUS) parts.push(part)
        start = -1
      }
    }
    return parts
  })
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
        if (n / ((box.x1 - box.x0 + 1) * (box.y1 - box.y0 + 1)) < PANE_JOIN_FILL) continue
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
  // The scale: a door or a gate standing on the wall's foot is about a door's height tall, whatever the wall is. Where
  // the picture shows such openings, the wall's height is what makes them so (a wall with a knee wall or a band over its
  // openings is taller than a storey); where it shows none, the assumed storey height stands.
  const doorShares = solid
    .filter((c) => !crossAt(Math.round((c.x0 + c.x1) / 2)) && footAt((c.x0 + c.x1) / 2) - c.y1 <= 0.12 * heightPx((c.x0 + c.x1) / 2))
    .map((c) => (footAt((c.x0 + c.x1) / 2) - c.y0) / heightPx((c.x0 + c.x1) / 2))
    .filter((f) => f >= 0.4 && f <= 0.95)
  const byDoors = doorShares.length > 0 ? DOOR_HEIGHT_M / median(doorShares) : Number.NaN
  const wallH = Number.isFinite(byDoors) ? round6(Math.min(storeys * storeyH + 1.8, Math.max(storeys * 2.6, byDoors))) : storeyH * storeys
  assumptions.push(
    Number.isFinite(byDoors)
      ? `wall height ${wallH.toFixed(2)} m eaves to ground on the widest segment: ${doorShares.length} door${doorShares.length === 1 ? '' : 's'} or gate${doorShares.length === 1 ? '' : 's'} on its foot take ${doorShares.map((f) => `${Math.round(f * 100)} %`).join(', ')} of it, and a door is taken ${DOOR_HEIGHT_M} m tall; ${storeys} storey${storeys === 1 ? '' : 's'}`
      : `wall height ${wallH.toFixed(2)} m eaves to ground on the widest segment: ${storeys} storey${storeys === 1 ? '' : 's'} of an assumed ${storeyH} m (${storeys === 2 ? 'two rows of windows stand one over the other' : 'one row of openings'})`,
  )
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
  // A wide opening on the foot is a gate where it is opaque and about as light as the wall beside it (a sectional or
  // panelled leaf); glass reflects and reads darker than the wall: a glazed door, however wide.
  const kindOf = (toFloor: boolean, widthM: number, r: { x0: number; y0: number; x1: number; y1: number }): PictureOpening['kind'] => {
    if (!toFloor) return 'WINDOW'
    if (widthM < 2.2) return 'GLAZED_DOOR'
    const inside: number[] = []
    for (let y = r.y0; y < r.y1; y += 2) for (let x = r.x0; x < r.x1; x += 2) inside.push(lumaOf(rgb(raster, x, y)))
    const ref = refAt(Math.round((r.x0 + r.x1) / 2), Math.round((r.y0 + r.y1) / 2))
    return ref > 0 && median(inside) >= GATE_LIGHTNESS * ref ? 'GARAGE_DOOR' : 'GLAZED_DOOR'
  }
  const openings: PictureOpening[] = []
  for (const c of comps) {
    const bw = c.x1 - c.x0 + 1
    const bh = c.y1 - c.y0 + 1
    const fill = c.n / (bw * bh)
    const mid = (c.x0 + c.x1) / 2
    const seg = segmentAt(Math.round(mid))
    if (!seg) continue
    // An opening stands in one face of the wall: one that runs across a cross gable's side, from the face above the
    // eaves onto the wall beside it, is the corner's shadow or a column, not an opening.
    // Nor does one cross the line of the eaves within a cross gable's face, half on the face above and half on the wall
    // under it: there the face stands on its cornice and the floor behind it.
    const across = (e: number): boolean => Math.min(e - c.x0, c.x1 - e) >= 0.2 * (c.x1 - c.x0 + 1)
    const eaveRow = eaveOf(seg)(mid)
    const straddles = c.y0 < eaveRow - 4 && c.y1 > eaveRow + 0.25 * heightPx(mid)
    if (straddles && gableFaces.some((g) => g.kind === 'CROSS' && (across(g.x0) || across(g.x1) || (mid >= g.x0 && mid <= g.x1)))) continue
    // Under a cross gable the wall rises to the rakes: its height there is the face's, not the eaves'.
    const gable = crossAt(Math.round(mid))
    const segH = gable ? Math.max(segmentHeight(seg), (wallH * (footAt(mid) - rakeAt(gable, mid))) / heightPx(mid)) : segmentHeight(seg)
    const t0 = tOf(mid, c.y1 + 1)
    const t1 = tOf(mid, c.y0)
    const a0 = alongOf(c.x0)
    const a1 = alongOf(c.x1 + 1)
    const wM = a1 - a0
    const hM = (t1 - t0) * wallH
    options.debug?.(`comp ${c.x0},${c.y0}..${c.x1},${c.y1} n=${c.n} fill=${fill.toFixed(2)} w=${wM.toFixed(2)} h=${hM.toFixed(2)} segH=${segH.toFixed(2)}`)
    if (fill < 0.45 || wM < 0.35 || hM < 0.6 || wM > 6 || hM > segH * 0.95) continue
    // A shadow under the eaves runs along the top of the wall: not an opening.
    const topGap = (tOf(mid, gable ? rakeAt(gable, mid) : eaveOf(seg)(mid)) - t1) * wallH
    if (topGap < 0.12 && wM > 1.5) continue
    // Inside its segment's stretch of the front, gaps shared out to the neighbours at their middles; a cross gable's
    // face is its own stretch, whatever segments its eaves were read on either side.
    const si = segments.indexOf(seg)
    const lo = si > 0 ? (segments[si - 1].x1 + seg.x0) / 2 : seg.x0
    const hi = si + 1 < segments.length ? (seg.x1 + segments[si + 1].x0) / 2 : seg.x1
    if (gable ? c.x0 < gable.x0 || c.x1 > gable.x1 : a0 < alongOf(lo) + 0.1 || a1 > alongOf(hi) - 0.1) continue
    const sillY = Math.max(0, t0 * wallH)
    const headY = Math.min(segH - 0.1, t1 * wallH)
    const toFloor = sillY <= 0.35
    // A low patch on the foot is a step, a plinth or a shadow, not a door; a long low strip under the eaves is their
    // shadow or a cornice, not a window.
    if (toFloor && headY < MIN_DOOR_M) continue
    if (!toFloor && wM > 2 * hM && hM < 0.9 && Math.abs(tOf(mid, eaveOf(seg)(mid)) - t1) * wallH < 0.4) continue
    const kind = kindOf(toFloor, wM, { x0: c.x0, y0: c.y0, x1: c.x1 + 1, y1: c.y1 + 1 })
    // A round head: the top corners of the box empty while the middle of its top is full.
    const share = (x0: number, x1: number, y0: number, y1: number): number => {
      let n = 0
      let all = 0
      for (let y = Math.round(y0); y <= Math.round(y1); y += 1)
        for (let x = Math.round(x0); x <= Math.round(x1); x += 1) {
          all += 1
          if (opened[y * W + x]) n += 1
        }
      return all > 0 ? n / all : 0
    }
    const cw = (c.x1 - c.x0) * 0.2
    const chh = (c.y1 - c.y0) * 0.15
    const corners = [share(c.x0, c.x0 + cw, c.y0, c.y0 + chh), share(c.x1 - cw, c.x1, c.y0, c.y0 + chh)]
    const arched = bh >= 20 && Math.max(...corners) < 0.4 && (corners[0] + corners[1]) / 2 < 0.25 && share(mid - cw / 2, mid + cw / 2, c.y0, c.y0 + chh) > 0.6
    openings.push({
      id: `photo-opening-${openings.length}`,
      kind,
      ...(arched ? { headShape: 'ARCHED' as const } : {}),
      ...(gable && sillY > segmentHeight(seg) - 0.3 ? { inGable: gableFaces.indexOf(gable) } : {}),
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
        openings[i] = { ...p, kind: kindOf(toFloor, along[1] - along[0], p.rectPx), rectPx: { x0: Math.min(p.rectPx.x0, q.rectPx.x0), y0: Math.min(p.rectPx.y0, q.rectPx.y0), x1: Math.max(p.rectPx.x1, q.rectPx.x1), y1: Math.max(p.rectPx.y1, q.rectPx.y1) }, along: [round6(along[0]), round6(along[1])], sillY: round6(toFloor ? 0 : sill), headY: round6(head), why: `${p.why}; joined with the piece above or below it (${q.why})` }
        openings.splice(j, 1)
        joined = true
      }
  }
  // A door and the glazed side light beside it, both down to the floor with a narrow mullion between, are one
  // entrance: side by side, less than 0.35 m apart, heads within 0.4 m of each other.
  let paired = true
  while (paired) {
    paired = false
    openings.sort((p, q) => p.along[0] - q.along[0])
    for (let i = 0; i + 1 < openings.length && !paired; i += 1) {
      const p = openings[i]
      const q = openings[i + 1]
      if (p.sillY > 0 || q.sillY > 0 || q.along[0] - p.along[1] > ENTRANCE_MULLION_M || Math.abs(p.headY - q.headY) > ENTRANCE_HEAD_SPREAD_M) continue
      const along: [number, number] = [p.along[0], Math.max(p.along[1], q.along[1])]
      openings[i] = { ...p, kind: kindOf(true, along[1] - along[0], p.rectPx), rectPx: { x0: Math.min(p.rectPx.x0, q.rectPx.x0), y0: Math.min(p.rectPx.y0, q.rectPx.y0), x1: Math.max(p.rectPx.x1, q.rectPx.x1), y1: Math.max(p.rectPx.y1, q.rectPx.y1) }, along: [round6(along[0]), round6(along[1])], headY: round6(Math.max(p.headY, q.headY)), why: `${p.why}; one entrance with the leaf or side light beside it (${q.why})` }
      openings.splice(i + 1, 1)
      paired = true
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
  // --- rooflights: compact patches that are not covering, set in the roof over any segment, between its eaves (or a
  // cross gable's rakes) and its top. Glass and frames differ from the covering in colour, light or dark: a white frame
  // on a grey roof as well as blue glass on a red one. A patch reaching the roof's outline is a chimney or a dormer's
  // face, not a rooflight; one the covering does not surround on most of a ring is not set in the roof.
  const rooflights: SingleImageReading['rooflights'] = []
  {
    const rmask = new Uint8Array(W * H)
    const roofL = lumaOf(roof)
    const segTop = segments.map((sg) => {
      const rows: number[] = []
      for (let x = sg.x0; x <= sg.x1; x += 1) if (tops[x] >= 0) rows.push(tops[x])
      rows.sort((p, q) => p - q)
      return rows.length > 0 ? rows[Math.floor(rows.length * 0.1)] : -1
    })
    for (let x = wx0; x <= wx1; x += 1) {
      const sg = segmentAt(x)
      if (!sg || tops[x] < 0) continue
      const g = crossAt(x)
      const bottom = Math.min(eaveOf(sg)(x), g ? rakeAt(g, x) - 2 * RAKE_SOFFIT_PX : H) - 2
      for (let y = Math.max(0, tops[x] + 2); y < bottom; y += 1) {
        if (isSky(x, y)) continue
        const c = rgb(raster, x, y)
        if (!isRoof(c) && !green(c) && (Math.abs(lumaOf(c) - roofL) > ROOFLIGHT_CONTRAST || satOf(c) > 0.3)) rmask[y * W + x] = 1
      }
    }
    const rseen = new Uint8Array(W * H)
    const patches: Array<{ x0: number; y0: number; x1: number; y1: number; n: number; touchesTop: boolean }> = []
    for (let i = 0; i < W * H; i += 1) {
      if (!rmask[i] || rseen[i]) continue
      const stack = [i]
      rseen[i] = 1
      const pixels: number[] = []
      let touchesTop = false
      while (stack.length > 0) {
        const j = stack.pop() as number
        const jx = j % W
        const jy = (j - jx) / W
        pixels.push(j)
        if (jy <= tops[jx] + 4) touchesTop = true
        for (const k of [jx > 0 ? j - 1 : -1, jx < W - 1 ? j + 1 : -1, j - W, j + W]) {
          if (k < 0 || k >= W * H || rseen[k] || !rmask[k]) continue
          rseen[k] = 1
          stack.push(k)
        }
      }
      // Two rooflights side by side touch through their frames: where the patch's columns thin out it is two.
      const xs = pixels.map((j) => j % W)
      const ys = pixels.map((j) => (j - (j % W)) / W)
      const px0 = Math.min(...xs)
      const px1 = Math.max(...xs)
      const ph = Math.max(...ys) - Math.min(...ys) + 1
      const counts = new Array(px1 - px0 + 1).fill(0)
      for (const x of xs) counts[x - px0] += 1
      // thin against the patch's own typical column, not its full height: a rooflight in perspective is a slanted box
      const typical = median(counts.filter((c) => c > 0))
      let start = -1
      for (let k = 0; k <= counts.length; k += 1) {
        const thick = k < counts.length && counts[k] >= Math.max(2, SPLIT_SHARE * Math.min(ph, 2 * typical))
        if (thick && start < 0) start = k
        if (!thick && start >= 0) {
          const part = { x0: px0 + start, x1: px0 + k - 1, y0: H, y1: 0, n: 0, touchesTop }
          pixels.forEach((j, q) => {
            if (xs[q] < part.x0 || xs[q] > part.x1) return
            part.n += 1
            part.y0 = Math.min(part.y0, ys[q])
            part.y1 = Math.max(part.y1, ys[q])
          })
          patches.push(part)
          start = -1
        }
      }
    }
    // A glass broken by a reflection or a glazing bar leaves fragments narrower than any rooflight: each joins its
    // nearest fragment beside it (a few pixels apart, overlapping in rows) until it is wide enough to stand alone.
    const narrow = (p: (typeof patches)[number]): boolean => alongOf(p.x1 + 1) - alongOf(p.x0) < ROOFLIGHT_MIN_M
    let grew = true
    while (grew) {
      grew = false
      patches.sort((p, q) => p.x0 - q.x0 || p.y0 - q.y0)
      for (let i = 0; i < patches.length && !grew; i += 1) {
        const p = patches[i]
        if (!narrow(p) || p.touchesTop) continue
        let best = -1
        let bestGap = Infinity
        for (let j = 0; j < patches.length; j += 1) {
          const q = patches[j]
          if (j === i || !narrow(q) || q.touchesTop) continue
          const gap = Math.max(q.x0 - p.x1, p.x0 - q.x1)
          const rows = Math.min(p.y1, q.y1) - Math.max(p.y0, q.y0)
          if (gap <= 3 && rows > 0 && gap < bestGap) {
            best = j
            bestGap = gap
          }
        }
        if (best < 0) continue
        const q = patches[best]
        patches[i] = { x0: Math.min(p.x0, q.x0), x1: Math.max(p.x1, q.x1), y0: Math.min(p.y0, q.y0), y1: Math.max(p.y1, q.y1), n: p.n + q.n, touchesTop: false }
        patches.splice(best, 1)
        grew = true
      }
    }
    for (const { x0, y0, x1, y1, n, touchesTop } of patches) {
      if (n >= 30) options.debug?.(`patch ${x0},${y0}..${x1},${y1} n=${n} top=${touchesTop}`)
      const a0 = alongOf(x0)
      const a1 = alongOf(x1 + 1)
      const bw = x1 - x0 + 1
      const bh = y1 - y0 + 1
      if (touchesTop || n < 30 || bh < 5 || bh > 2.5 * bw || a1 - a0 < ROOFLIGHT_MIN_M || a1 - a0 > 1.8) continue
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
      options.debug?.(`patch-ring ${x0},${y0} ${(roofy / Math.max(1, ring)).toFixed(2)} along ${a0.toFixed(2)}..${a1.toFixed(2)}`)
      if (ring === 0 || roofy / ring < 0.6) continue
      const mid = (x0 + x1) / 2
      const sg = segmentAt(Math.round(mid))
      if (!sg) continue
      const si = segments.indexOf(sg)
      const eaveRow = eaveOf(sg)(mid)
      const rise = Math.max(1, eaveRow - segTop[si])
      const up0 = (eaveRow - (y1 + 1)) / rise
      const up1 = (eaveRow - y0) / rise
      options.debug?.(`patch-up ${x0},${y0} ${up0.toFixed(2)}..${up1.toFixed(2)}`)
      if (up0 < 0.05 || up1 > 0.95) continue
      rooflights.push({ id: `photo-rooflight-${rooflights.length}`, rectPx: { x0, y0, x1: x1 + 1, y1: y1 + 1 }, along: [round6(a0), round6(a1)], upSlope: [round6(up0), round6(up1)], segment: si })
    }
    // Patches of one glass broken by its frame or glazing bar: the larger stands, overlapping ones (with a 0.1 m gap
    // the model needs between two cuts) are dropped.
    rooflights.sort((p, q) => q.along[1] - q.along[0] - (p.along[1] - p.along[0]))
    const keptLights: typeof rooflights = []
    const overlap = (k: (typeof rooflights)[number], r: (typeof rooflights)[number]): number => Math.min(k.along[1], r.along[1]) - Math.max(k.along[0], r.along[0])
    for (const r of rooflights) if (!keptLights.some((k) => overlap(k, r) > 0.25 * Math.min(k.along[1] - k.along[0], r.along[1] - r.along[0]))) keptLights.push(r)
    keptLights.sort((p, q) => p.along[0] - q.along[0])
    // Two rooflights side by side, closer than the model's least gap between two cuts: each gives up half the shortfall.
    for (let i = 0; i + 1 < keptLights.length; i += 1) {
      const p = keptLights[i]
      const q = keptLights[i + 1]
      const short = ROOFLIGHT_GAP_M - (q.along[0] - p.along[1])
      if (short <= 0) continue
      keptLights[i] = { ...p, along: [p.along[0], round6(p.along[1] - short / 2)] }
      keptLights[i + 1] = { ...q, along: [round6(q.along[0] + short / 2), q.along[1]] }
    }
    rooflights.length = 0
    keptLights.forEach((r, i) => rooflights.push({ ...r, id: `photo-rooflight-${i}` }))
  }
  // --- the roof's ends: over each segment, does the top run level to the end of the wall (a gable, its verge at the
  // corner), or come down to the eaves inside the wall's run (a hip)? A gable seen from aside (a face above the eaves
  // beyond the front's end) is a gable. A slope coming down to a corner far from the camera is also what a gable's verge
  // looks like seen obliquely, so it stands as a hip only where the other end does not show a gable; a segment's end
  // close to another segment is a party end and follows its own other end.
  const roofEnds = segments.map((sg, si) => {
    const rise = (x: number): number => (tops[x] >= 0 ? eaveOf(sg)(x) - tops[x] : Number.NaN)
    const rises: number[] = []
    for (let x = sg.x0; x <= sg.x1; x += 1) if (Number.isFinite(rise(x))) rises.push(rise(x))
    rises.sort((p, q) => p - q)
    const R = rises.length > 0 ? rises[Math.floor(rises.length * 0.8)] : Number.NaN
    const span = sg.x1 - sg.x0
    const read = (side: 'MIN' | 'MAX'): RoofEndReading => {
      const end = side === 'MIN' ? sg.x0 : sg.x1
      const inward = side === 'MIN' ? 1 : -1
      const neighbour = side === 'MIN' ? segments[si - 1] : segments[si + 1]
      const party = !!neighbour && (side === 'MIN' ? sg.x0 - neighbour.x1 : neighbour.x0 - sg.x1) <= PARTY_GAP * W
      const face = gableFaces.find((g) => g.kind === 'END' && g.side === side && (si === 0 || si === segments.length - 1))
      if (face && !party) return { kind: 'GABLE', evidence: 'GABLE_FACE', why: `a gable face beyond the front's ${side === 'MIN' ? 'left' : 'right'} end, apex at column ${face.apexX.toFixed(0)}` }
      if (!(R > 0)) return party ? { kind: 'GABLE', evidence: 'PARTY', why: 'against another segment of the front' } : { kind: 'GABLE', evidence: 'UNSEEN', why: 'no roof top read over the segment' }
      const near: number[] = []
      const reach = Math.max(3, Math.round(span * 0.03))
      for (let k = 0; k <= reach; k += 1) {
        const v = rise(end + inward * k)
        if (Number.isFinite(v)) near.push(v)
      }
      const ratio = median(near) / R
      // Where the top reaches the roof's rise, going in from the end; a cross gable's own top on the way hides the hip.
      let inset = span
      let hidden = false
      for (let k = 0; k <= span; k += 1) {
        const x = end + inward * k
        if (crossAt(x)) {
          hidden = true
          break
        }
        const v = rise(x)
        if (Number.isFinite(v) && v >= 0.9 * R) {
          inset = k
          break
        }
      }
      // the outline followed on past the wall's end while it keeps coming down: the roof's overhang and, at a corner
      // the eaves were not read to, the rest of a hip
      let out = 0
      for (let k = 1; k <= Math.round(HIP_REACH_BEYOND * W); k += 1) {
        const x = end - inward * k
        if (x < 0 || x >= W || tops[x] < 0 || tops[x] < tops[x + inward] - 1 || eaveOf(sg)(x) - tops[x] <= 0.1 * R) break
        out = k
      }
      const beyond = rise(end - inward * out) / R
      if (Math.min(ratio, beyond) < RAMP_END && inset >= RAMP_INSET * span) {
        const from = end + inward * inset
        const to = end - inward * out
        return { kind: 'HIP', evidence: 'RAMP', ...(hidden ? {} : { insetM: round6(Math.abs(alongOf(from) - alongOf(to))) }), why: `the top comes down to ${(ratio * 100).toFixed(0)} % of the roof's rise at the wall's end and ${(beyond * 100).toFixed(0)} % ${out} px past it, ${hidden ? 'its start hidden behind a cross gable' : `from ${((inset / span) * 100).toFixed(0)} % of the wall's run inside it`}` }
      }
      if (party) return { kind: 'GABLE', evidence: 'PARTY', why: 'against another segment of the front' }
      if (ratio >= PLATEAU_END) return { kind: 'GABLE', evidence: 'PLATEAU', why: `the top runs level to the wall's end (${(ratio * 100).toFixed(0)} % of the roof's rise there)` }
      return { kind: 'GABLE', evidence: 'UNSEEN', why: `the top at the wall's end stands at ${Number.isFinite(ratio) ? (ratio * 100).toFixed(0) : '?'} % of the roof's rise: neither level nor come down` }
    }
    const min = read('MIN')
    const max = read('MAX')
    const strongGable = (e: RoofEndReading): boolean => e.evidence === 'GABLE_FACE' || e.evidence === 'PLATEAU'
    const settle = (own: RoofEndReading, other: RoofEndReading): RoofEndReading => {
      if (own.evidence === 'RAMP' && strongGable(other)) return { kind: 'GABLE', evidence: 'SYMMETRY', why: `${own.why}; but the other end shows a gable, and a far gable's verge seen obliquely comes down the same way` }
      if ((own.evidence === 'PARTY' || own.evidence === 'UNSEEN') && other.evidence === 'RAMP') return { kind: 'HIP', evidence: own.evidence === 'PARTY' ? 'PARTY' : 'SYMMETRY', why: `${own.why}; the other end is hipped` }
      return own
    }
    return { min: settle(min, max), max: settle(max, min) }
  })
  for (const [i, e] of roofEnds.entries()) why.push(`segment ${segments[i].x0}..${segments[i].x1}: ${e.min.kind.toLowerCase()} at the left (${e.min.evidence.toLowerCase()}: ${e.min.why}), ${e.max.kind.toLowerCase()} at the right (${e.max.evidence.toLowerCase()}: ${e.max.why})`)
  const mainAlong: [number, number] = [alongOf(main.x0), alongOf(main.x1)]
  // The depth is not seen. A hip seen coming down inside the wall's run says it, though: under one pitch a hip runs in
  // from the end by half the depth. Without a hip, 0.9 of the widest segment stands, kept to 6..12 m.
  const mainEnds = roofEnds[segments.indexOf(main)]
  const insets = [mainEnds.min.insetM, mainEnds.max.insetM].filter((v): v is number => v !== undefined && v > 0)
  const depthM = insets.length > 0 ? Math.max(6, Math.min(12, 2 * median(insets))) : Math.max(6, Math.min(12, (mainAlong[1] - mainAlong[0]) * 0.9))
  const pitchDeg = round6(Math.max(25, Math.min(50, (Math.atan(riseM / (depthM / 2)) * 180) / Math.PI)))
  assumptions.push(`depth ${depthM.toFixed(2)} m (not seen: ${insets.length > 0 ? `twice the hip's run in from the wall's end, ${insets.map((v) => v.toFixed(2)).join(' and ')} m, under one pitch` : '0.9 of the widest segment'}, kept to 6..12 m); every slope at a pitch of ${pitchDeg.toFixed(1)}° from the main roof's apparent rise of ${riseM.toFixed(2)} m; the roof's ends as read: ${roofEnds.map((e) => `${e.min.kind.toLowerCase()}/${e.max.kind.toLowerCase()}`).join(', ')}`)
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
    segments: segments.map((s, i) => ({ x0: s.x0, x1: s.x1, along: [round6(cuts[i][0]), round6(cuts[i][1])] as [number, number], eave: [round6(eaveOf(s)(s.x0)), round6(eaveOf(s)(s.x1))] as [number, number], heightM: round6(s === main ? wallH : segmentHeight(s)), main: s === main, ends: roofEnds[i] })),
    gables: gableFaces.map((g) => {
      const along: [number, number] = [round6(alongOf(g.x0)), round6(alongOf(g.x1))]
      const riseM = round6(((eaveNear(g.apexX) - g.apexY) * wallH) / heightPx(g.apexX))
      return { kind: g.kind, ...(g.side ? { side: g.side } : {}), x0: g.x0, x1: g.x1, apexX: g.apexX, apexY: g.apexY, along, riseM, pitchDeg: round6((Math.atan(riseM / Math.max(0.5, (along[1] - along[0]) / 2)) * 180) / Math.PI) }
    }),
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
 * the main one), each under a roof of its own planes whose ends are the gables or hips the picture showed; a gable
 * facing the camera over part of the front is a shallow body before the main one under a gable of its own, its ridge
 * running back into the main slope between two valleys. The openings stand on the front wall of the body they are in,
 * those over the eaves in a cross gable's face; the rooflights in whichever plane of their segment's roof holds them.
 * Every feature id names the picture.
 */
export function buildingFromSingleImage(reading: SingleImageReading, options: SingleImageOptions = {}): BuildingV2 {
  const T = options.wallThicknessM ?? 0.3
  const depth = reading.roof.depthM
  const storeys = reading.wall.storeys
  const storeyH = round6(reading.wall.heightM / storeys)
  const levels: LevelV2[] = Array.from({ length: storeys }, (_, i) => ({ index: i, id: `lvl-${i}`, elevation: round6(i * storeyH), height: storeyH, wallTop: round6((i + 1) * storeyH), featureId: `photo-level-${i}` }))
  const masses: MassV2[] = reading.segments.map((s, i) => ({ id: s.main ? 'main' : `wing-${i}`, role: s.main ? 'MAIN' : 'ATTACHED', x0: round6(s.along[0]), z0: 0, x1: round6(s.along[1]), z1: s.main ? depth : round6(Math.max(4, depth * 0.85)), storeys: s.main ? levels.map((l) => l.index) : [0], featureId: `photo-mass-${i}`, sourceMassId: `photo-segment-${i}` }))
  const pitch = reading.roof.pitchDeg
  const tan = Math.tan((pitch * Math.PI) / 180)
  const thickness = 0.28
  const eaveOf = (i: number): number => (reading.segments[i].main ? round6(storeys * storeyH) : round6(Math.min(storeys * storeyH, Math.max(2.2, reading.segments[i].heightM))))
  // --- each segment's body under a roof of its own planes, its ends as the picture showed them
  const planeRoofs: PlaneRoofV2[] = masses.map((m, i) => {
    const seg = reading.segments[i]
    const eaveY = eaveOf(i)
    const ends = { min: seg.ends.min.kind, max: seg.ends.max.kind }
    const layout = planeRoofLayout({ x0: m.x0, x1: m.x1, z0: m.z0, z1: m.z1 }, 'X', pitch, eaveY, ends)
    return { massId: m.id, ridgeAxis: 'X', pitchDeg: pitch, eaveY, ridgeY: layout.ridgeY, ends, thicknessM: thickness, layout, featureId: `photo-roof-${m.id}`, provenance: 'ASSUMED_FOR_RENDERING', why: `one picture: ${seg.ends.min.kind.toLowerCase()} at the left end (${seg.ends.min.why}), ${seg.ends.max.kind.toLowerCase()} at the right (${seg.ends.max.why}); pitch and depth assumed` }
  })
  const main = masses.find((m) => m.role === 'MAIN') as MassV2
  const mainRoof = planeRoofs.find((r) => r.massId === main.id) as PlaneRoofV2
  // --- cross gables: a shallow body before the body behind it, a gable of its own with its ridge running back into the
  // main slope; its pitch is the face's, lowered where the ridge would otherwise not die into the main roof's front slope
  const pitchedAttachedRoofs: BuildingV2['pitchedAttachedRoofs'] = []
  const crosses: Array<{ mass: MassV2; gable: SingleImageReading['gables'][number]; index: number; pitchDeg: number; reach: number }> = []
  reading.gables.forEach((g, k) => {
    if (g.kind !== 'CROSS') return
    const lo = Math.max(main.x0 + T + VERGE_PROUD_M, g.along[0])
    const hi = Math.min(main.x1 - T - VERGE_PROUD_M, g.along[1])
    if (hi - lo < CROSS_GABLE_MIN_M) return
    const half = (hi - lo) / 2
    const mid = (lo + hi) / 2
    // the valleys stay on the front slope: the ridge meets it no deeper than the hips leave room for, nor near the ridge
    const room = Math.min(depth / 2 - 0.3, mainRoof.ends.min === 'HIP' ? mid - main.x0 - 0.3 : Infinity, mainRoof.ends.max === 'HIP' ? main.x1 - mid - 0.3 : Infinity)
    if (!(room > 0.5)) return
    const pitchDeg = round6(Math.min(Math.max(CROSS_GABLE_MIN_PITCH, g.pitchDeg), CROSS_GABLE_MAX_PITCH, (Math.atan((tan * room) / half) * 180) / Math.PI))
    const mass: MassV2 = { id: `gable-${k}`, role: 'ATTACHED', x0: round6(lo), z0: -CROSS_GABLE_DEPTH_M, x1: round6(hi), z1: 0, storeys: [0], featureId: `photo-gable-${k}`, sourceMassId: `photo-gable-${k}` }
    const eaveY = mainRoof.eaveY
    // the gable's verges and eaves stand a little proud of its walls, so the roof's cut edges and the walls' faces are
    // not one plane and every wall top lies strictly under a plane
    const body = { x0: round6(mass.x0 - VERGE_PROUD_M), x1: round6(mass.x1 + VERGE_PROUD_M), z0: round6(mass.z0 - VERGE_PROUD_M), z1: mass.z1 }
    const join: MainRoofForJoin = { ridgeAxis: 'X', ridgeAt: round6(depth / 2), eaveY, ridgeY: mainRoof.ridgeY, pitchDeg: pitch, footprint: { x0: main.x0, x1: main.x1, z0: 0, z1: depth } }
    const layout = attachedGableLayout(body, 'Z', pitchDeg, eaveY, join)
    masses.push(mass)
    pitchedAttachedRoofs.push({
      massId: mass.id,
      kind: 'GABLE',
      ridgeAxis: 'Z',
      pitchDeg,
      pitchSource: 'MEASURED',
      eaveY,
      ridgeY: layout.ridgeY,
      thicknessM: thickness,
      footprint: body,
      layout,
      form: { kind: 'GABLE', ridgeAxis: 'Z', pitchDeg, pitchSource: 'MEASURED', measuredRiseM: g.riseM, expectedRiseM: round6(half * Math.tan((pitchDeg * Math.PI) / 180)), readings: [], confidence: 0.3, why: `a gable facing the camera over ${g.along[0].toFixed(2)}..${g.along[1].toFixed(2)} m, its face rising ${g.riseM.toFixed(2)} m over the eaves (${g.pitchDeg.toFixed(1)}° on the picture)` },
      joinRoofId: planeRoofPlaneId(main.id, 'LOW'),
      featureId: `photo-roof-${mass.id}`,
      provenance: 'ASSUMED_FOR_RENDERING',
    })
    const reach = layout.join.kind === 'VALLEY' ? Math.max(...layout.join.valleys.map((v) => v.end.z)) : 0
    crosses.push({ mass, gable: g, index: k, pitchDeg, reach })
  })
  // --- openings, on the front of the body they stand in: a cross gable first, else their segment's body
  const prov = (p: ProvenanceStatus): OpeningV2['provenance'] => ({ interval: p, width: p, sill: p, head: p, profile: 'ASSUMED_FOR_RENDERING', family: 'VISUAL_SEMANTIC' })
  const openings: OpeningV2[] = []
  for (const o of reading.openings) {
    const centre = (o.along[0] + o.along[1]) / 2
    const cross = crosses.find((c) => centre >= c.mass.x0 && centre <= c.mass.x1)
    const mass = cross?.mass ?? masses.find((m) => !crosses.some((c) => c.mass === m) && centre >= m.x0 && centre <= m.x1)
    if (!mass) continue
    const segIndex = masses.indexOf(mass)
    const cos = Math.cos(((cross ? cross.pitchDeg : pitch) * Math.PI) / 180)
    // A wall stops where the roof's underside meets it: under the eaves, or under a cross gable's rakes at that point.
    const top = cross
      ? (x: number): number => mainRoof.eaveY + (Math.min(x - cross.mass.x0, cross.mass.x1 - x)) * Math.tan((cross.pitchDeg * Math.PI) / 180) - thickness / cos
      : (): number => (mass.role === 'MAIN' ? storeys * storeyH : eaveOf(segIndex)) - thickness / cos
    const storeyIndex = mass.role === 'MAIN' ? Math.min(storeys - 1, Math.floor((o.sillY + 0.3) / storeyH)) : 0
    const floor = storeyIndex * storeyH
    let lo = Math.max(mass.x0 + T + 0.1, o.along[0])
    let hi = Math.min(mass.x1 - T - 0.1, o.along[1])
    const sill = o.kind === 'WINDOW' ? Math.max(floor + 0.2, o.sillY) : floor
    // In a gable's face the rakes close in over an opening: it narrows about its middle until its corners stand under
    // them at a useful height, rather than being dropped.
    const snapped = !!cross && lo < (cross.mass.x0 + cross.mass.x1) / 2 + GABLE_AXIS_SNAP_M && hi > (cross.mass.x0 + cross.mass.x1) / 2 - GABLE_AXIS_SNAP_M
    if (cross && snapped) {
      // an opening at the apex of a gable stands on its axis: the picture's few centimetres off it would leave a sliver
      // of wall between the opening's head and the ridge
      const axis = (cross.mass.x0 + cross.mass.x1) / 2
      const half = (hi - lo) / 2
      lo = axis - half
      hi = axis + half
    }
    if (cross) {
      const mid = (lo + hi) / 2
      while (hi - lo > 0.4 && Math.min(top(lo), top(hi)) - 0.15 < Math.min(o.headY, sill + 0.6)) {
        lo = Math.min(mid - 0.2, lo + 0.05)
        hi = Math.max(mid + 0.2, hi - 0.05)
      }
    }
    const ceiling = Math.min(top(lo), top(hi)) - 0.15
    const head = Math.min(o.headY, cross ? ceiling : Math.min(ceiling, floor + storeyH - 0.15))
    if (hi - lo < 0.3 || head - sill < 0.4) continue
    openings.push({
      id: o.id,
      storeyIndex,
      massId: mass.id,
      facade: 'FRONT',
      planeAt: mass.z0,
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
      unresolved: ['indicative: placed on the wall plane of one perspective picture at an assumed scale', ...(o.headShape === 'ARCHED' ? ['a round head is seen on the picture; the model builds level heads'] : []), ...(snapped ? ["centred on the gable's axis, which it straddles on the picture"] : [])],
      confidence: o.confidence,
      why: o.why,
    })
  }
  // --- rooflights, in the plane of their segment's roof that holds them: up the front slope by their share of the
  // roof's rise; where that falls past a hip, on the hip at the same height, near the front corner the picture sees
  const rooflights: BuildingV2['rooflights'] = []
  for (const r of reading.rooflights) {
    const mass = masses[r.segment]
    const roof = planeRoofs[r.segment]
    if (!mass || !roof) continue
    const half = (mass.z1 - mass.z0) / 2
    const along: [number, number] = [Math.max(mass.x0 + 0.3, r.along[0]), Math.min(mass.x1 - 0.3, r.along[1])]
    if (along[1] - along[0] < 0.3) continue
    const up: [number, number] = [Math.max(0.3, r.upSlope[0] * half), Math.min(half - 0.3, Math.max(r.upSlope[0] * half + 0.5, r.upSlope[1] * half))]
    let box = { x0: along[0], x1: along[1], z0: up[0], z1: up[1] }
    let plane = planeAt(roof.layout, { x: (box.x0 + box.x1) / 2, z: (box.z0 + box.z1) / 2 })
    if (plane && (plane.key === 'END_MIN' || plane.key === 'END_MAX')) {
      // on the hip: at the same height, its run down the hip from the end's eave; across it, beside the front corner
      const w = box.x1 - box.x0
      const l = box.z1 - box.z0
      const xFrom = plane.key === 'END_MAX' ? mass.x1 - up[1] : mass.x0 + up[0]
      box = { x0: xFrom, x1: xFrom + l, z0: up[1] + 0.3, z1: up[1] + 0.3 + w }
      plane = planeAt(roof.layout, { x: (box.x0 + box.x1) / 2, z: (box.z0 + box.z1) / 2 })
    }
    if (!plane) continue
    const corners = [{ x: box.x0, z: box.z0 }, { x: box.x1, z: box.z0 }, { x: box.x1, z: box.z1 }, { x: box.x0, z: box.z1 }]
    const inset = 0.05
    const held = corners.every((c) => planeAt(roof.layout, { x: c.x + Math.sign((box.x0 + box.x1) / 2 - c.x) * inset, z: c.z + Math.sign((box.z0 + box.z1) / 2 - c.z) * inset })?.key === plane?.key)
    // not under a cross gable's planes, which run over the main slope up to their valleys
    const covered = crosses.some((c) => mass === main && box.x1 > c.mass.x0 - 0.1 && box.x0 < c.mass.x1 + 0.1 && box.z0 < c.reach + 0.1)
    if (!held || covered) continue
    const rl: RooflightReading = { id: r.id, slope: 'LOW', alongFrom: round6(box.x0), alongTo: round6(box.x1), slopeFrom: round6(box.z0), slopeTo: round6(box.z1), yFrom: 0, yTo: 0, frameId: 'photo', confidence: 0.35, why: `a patch set in the roof over ${r.along[0].toFixed(2)}..${r.along[1].toFixed(2)} m along the front, ${Math.round(r.upSlope[0] * 100)}..${Math.round(r.upSlope[1] * 100)} % up its rise; in the roof plane ${plane.key.toLowerCase()}` }
    rooflights.push({ ...rl, featureId: `photo-${r.id}`, provenance: 'VISUAL_SEMANTIC' as ProvenanceStatus, widthM: round6(box.x1 - box.x0), lengthM: round6(box.z1 - box.z0), planeId: planeRoofPlaneId(mass.id, plane.key), ridgeAxis: 'X' })
  }
  return {
    label: SINGLE_IMAGE_LABEL,
    wallThicknessM: T,
    slabThicknessM: 0.25,
    levels,
    masses,
    attachedRoofs: [],
    pitchedAttachedRoofs,
    planeRoofs,
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
