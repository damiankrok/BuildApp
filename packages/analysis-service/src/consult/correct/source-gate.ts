/**
 * v3.54.16 — the source gate: a proposed element against the ORIGINAL picture, never against the model that stands.
 *
 * A box in a source elevation is supported when the picture itself draws an element there: its four borders carry an
 * edge (a frame line, a change from wall to glass) and its inside differs from the band around it. "Supported" is not
 * an absolute threshold tuned on a house: each box is scored against the null distribution of same-size boxes on the
 * same wall band of the same picture (rows of the box, columns across the facade), so the decision reads in standard
 * deviations of that picture's own texture. Two hypotheses — the model's element and the proposal — are compared on
 * the same footing; the gate names the better one, or says that the picture does not decide (NEEDS_EVIDENCE).
 *
 * The gate never edits a box: a registration error is tolerated by a small search around each hypothesis (the same
 * search for both), and the proposal is bound as given.
 *
 * v3.54.16 audit A2 (gate 1.1.0): a hypothesis is a SHAPE, not only a box — a raked head is its own top edge from
 * (x0, headLeftY) to (x1, headRightY). When either hypothesis is raked, both are scored as polygons (edges averaged
 * along each polygon side, inside against the ring outside the polygon, null shapes of the same form on the same wall
 * area), so two hypotheses with one bounding box but different heads are told apart. Rectangles alone keep the 1.0.0
 * scoring byte for byte. The KIND of an opening (glazed, solid, panelled) is a separate measure (`compareFill`): a fill
 * the picture cannot tell apart is UNDECIDED, never decided by the position test.
 */
import type { Raster } from '@buildapp/source-package'

export const SOURCE_GATE_VERSION = '1.1.0' as const

export type Box = { x0: number; y0: number; x1: number; y1: number }
/** A box whose top edge may be raked: from (x0, headLeftY) to (x1, headRightY); y1 stays the bottom. */
export type Shape = Box & { headLeftY?: number; headRightY?: number }
export const isRaked = (s: Shape | undefined): boolean => !!s && typeof s.headLeftY === 'number' && typeof s.headRightY === 'number' && Math.abs(s.headLeftY - s.headRightY) >= 1
export const polygonOf = (s: Shape): Array<[number, number]> => [[s.x0, isRaked(s) ? (s.headLeftY as number) : s.y0], [s.x1, isRaked(s) ? (s.headRightY as number) : s.y0], [s.x1, s.y1], [s.x0, s.y1]]
const shift = (s: Shape, dx: number, dy: number): Shape => ({ x0: s.x0 + dx, y0: s.y0 + dy, x1: s.x1 + dx, y1: s.y1 + dy, ...(isRaked(s) ? { headLeftY: (s.headLeftY as number) + dy, headRightY: (s.headRightY as number) + dy } : {}) })
const inPoly = (poly: ReadonlyArray<readonly [number, number]>, x: number, y: number): boolean => {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

/** z of the support above the picture's own null boxes for "the source draws an element here". */
export const SUPPORT_Z_MIN = 2
/** z by which one hypothesis must beat the other for the picture to decide between them. */
export const HYPOTHESIS_Z_MARGIN = 1
/** Fewest null boxes for a distribution (fewer: the picture does not decide). */
const MIN_NULL = 8

const lum = (r: Raster): Float32Array => {
  const out = new Float32Array(r.width * r.height)
  for (let i = 0; i < out.length; i += 1) out[i] = 0.299 * r.data[i * 4] + 0.587 * r.data[i * 4 + 1] + 0.114 * r.data[i * 4 + 2]
  return out
}
const cache = new WeakMap<Raster, Float32Array>()
const lumOf = (r: Raster): Float32Array => {
  let l = cache.get(r)
  if (!l) {
    l = lum(r)
    cache.set(r, l)
  }
  return l
}

const clampBox = (b: Box, r: Raster): Box => ({ x0: Math.max(0, Math.min(r.width - 1, Math.round(b.x0))), y0: Math.max(0, Math.min(r.height - 1, Math.round(b.y0))), x1: Math.max(0, Math.min(r.width - 1, Math.round(b.x1))), y1: Math.max(0, Math.min(r.height - 1, Math.round(b.y1))) })

/** The raw support of one box: mean border edge strength and inside/outside contrast, both on 0..1. */
export function rawSupport(r: Raster, box: Box): number {
  const L = lumOf(r)
  const b = clampBox(box, r)
  const w = b.x1 - b.x0
  const h = b.y1 - b.y0
  if (w < 3 || h < 3) return 0
  const at = (x: number, y: number): number => L[Math.max(0, Math.min(r.height - 1, y)) * r.width + Math.max(0, Math.min(r.width - 1, x))]
  // border edges: across each border, the step between the MEAN of the line just inside and the line just outside,
  // averaged along the whole side (a frame's straight edge survives the averaging, a wall's texture does not), at the
  // offset within ±2 px where it is largest
  const lineMean = (horizontal: boolean, at0: number, from: number, to: number): number => {
    let s0 = 0
    let k = 0
    const st = Math.max(1, Math.floor((to - from) / 48))
    for (let t = from; t <= to; t += st) {
      s0 += horizontal ? at(t, at0) : at(at0, t)
      k += 1
    }
    return k > 0 ? s0 / k : 0
  }
  const sideStep = (horizontal: boolean, line: number, from: number, to: number, inward: 1 | -1): number => {
    let best = 0
    for (let d = -2; d <= 2; d += 1) {
      const inside = (lineMean(horizontal, line + d + inward, from, to) + lineMean(horizontal, line + d + 2 * inward, from, to)) / 2
      const outside = (lineMean(horizontal, line + d - inward, from, to) + lineMean(horizontal, line + d - 2 * inward, from, to)) / 2
      best = Math.max(best, Math.abs(inside - outside))
    }
    return best
  }
  const mx = Math.max(1, Math.round(w * 0.1))
  const my = Math.max(1, Math.round(h * 0.1))
  const edge = (sideStep(true, b.y0, b.x0 + mx, b.x1 - mx, 1) + sideStep(true, b.y1, b.x0 + mx, b.x1 - mx, -1) + sideStep(false, b.x0, b.y0 + my, b.y1 - my, 1) + sideStep(false, b.x1, b.y0 + my, b.y1 - my, -1)) / 4 / 255
  // contrast: the inside (shrunk by a fifth) against a ring a quarter of the box wide outside it
  const mean = (x0: number, y0: number, x1: number, y1: number, skip?: Box): number => {
    let s = 0
    let k = 0
    const sx = Math.max(1, Math.floor((x1 - x0) / 32))
    const sy = Math.max(1, Math.floor((y1 - y0) / 32))
    for (let y = Math.max(0, y0); y <= Math.min(r.height - 1, y1); y += sy) for (let x = Math.max(0, x0); x <= Math.min(r.width - 1, x1); x += sx) {
      if (skip && x >= skip.x0 && x <= skip.x1 && y >= skip.y0 && y <= skip.y1) continue
      s += L[y * r.width + x]
      k += 1
    }
    return k > 0 ? s / k : 0
  }
  const iw = Math.round(w / 5)
  const ih = Math.round(h / 5)
  const inside = mean(b.x0 + iw, b.y0 + ih, b.x1 - iw, b.y1 - ih)
  const rw = Math.max(2, Math.round(w / 4))
  const rh = Math.max(2, Math.round(h / 4))
  const ring = mean(b.x0 - rw, b.y0 - rh, b.x1 + rw, b.y1 + rh, b)
  const contrast = Math.abs(inside - ring) / 255
  return 0.5 * edge + 0.5 * contrast
}

/** The raw support of a polygon hypothesis (A2): border steps averaged along each side, inside against its ring. */
export function rawSupportShape(r: Raster, shape: Shape): number {
  const L = lumOf(r)
  const poly = polygonOf(shape)
  const w = shape.x1 - shape.x0
  const h = shape.y1 - Math.min(shape.y0, shape.headLeftY ?? shape.y0, shape.headRightY ?? shape.y0)
  if (w < 3 || h < 3) return 0
  const at = (x: number, y: number): number => L[Math.max(0, Math.min(r.height - 1, Math.round(y))) * r.width + Math.max(0, Math.min(r.width - 1, Math.round(x)))]
  const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length
  const cy = poly.reduce((a, p) => a + p[1], 0) / poly.length
  let edges = 0
  for (let i = 0; i < poly.length; i += 1) {
    const [ax, ay] = poly[i]
    const [bx, by] = poly[(i + 1) % poly.length]
    const len = Math.hypot(bx - ax, by - ay)
    if (len < 1) continue
    let nx = -(by - ay) / len
    let ny = (bx - ax) / len
    if ((cx - (ax + bx) / 2) * nx + (cy - (ay + by) / 2) * ny < 0) {
      nx = -nx
      ny = -ny
    }
    const k = Math.max(6, Math.min(32, Math.round(len)))
    // the mean along the side at each normal offset −4..4, computed once; the step at d uses offsets d±1, d±2
    const means = new Float64Array(9)
    for (let d = -4; d <= 4; d += 1) {
      let s0 = 0
      for (let t = 0; t < k; t += 1) {
        const u = 0.1 + (0.8 * t) / Math.max(1, k - 1)
        s0 += at(ax + (bx - ax) * u + nx * d, ay + (by - ay) * u + ny * d)
      }
      means[d + 4] = s0 / k
    }
    let best = 0
    for (let d = -2; d <= 2; d += 1) best = Math.max(best, Math.abs((means[d + 5] + means[d + 6]) / 2 - (means[d + 3] + means[d + 2]) / 2))
    edges += best
  }
  const edge = edges / poly.length / 255
  const shrunk = poly.map(([x, y]) => [cx + (x - cx) * 0.6, cy + (y - cy) * 0.6] as [number, number])
  const top = Math.min(...poly.map((p) => p[1]))
  const rw = Math.max(2, Math.round(w / 4))
  const rh = Math.max(2, Math.round(h / 4))
  let si = 0
  let ki = 0
  let so = 0
  let ko = 0
  const sx = Math.max(1, Math.floor((w + 2 * rw) / 24))
  const sy = Math.max(1, Math.floor((h + 2 * rh) / 24))
  for (let y = Math.max(0, Math.floor(top - rh)); y <= Math.min(r.height - 1, Math.ceil(shape.y1 + rh)); y += sy) for (let x = Math.max(0, Math.floor(shape.x0 - rw)); x <= Math.min(r.width - 1, Math.ceil(shape.x1 + rw)); x += sx) {
    if (inPoly(shrunk, x, y)) {
      si += L[y * r.width + x]
      ki += 1
    } else if (!inPoly(poly, x, y)) {
      so += L[y * r.width + x]
      ko += 1
    }
  }
  const contrast = ki > 0 && ko > 0 ? Math.abs(si / ki - so / ko) / 255 : 0
  return 0.5 * edge + 0.5 * contrast
}

/** The best raw support within ±tol px of the box (the registration's own uncertainty), the box itself unchanged. */
export function supportNear(r: Raster, box: Box, tolPx: number): number {
  const t = Math.max(0, Math.round(tolPx))
  const step = Math.max(1, Math.round(t / 3))
  let best = rawSupport(r, box)
  for (let dx = -t; dx <= t; dx += step) for (let dy = -t; dy <= t; dy += step) if (dx !== 0 || dy !== 0) best = Math.max(best, rawSupport(r, { x0: box.x0 + dx, y0: box.y0 + dy, x1: box.x1 + dx, y1: box.y1 + dy }))
  return best
}

/** The best polygon support within ±tol px (the same search as for boxes). */
export function supportNearShape(r: Raster, shape: Shape, tolPx: number): number {
  const t = Math.max(0, Math.round(tolPx))
  // the same ±tol window as for boxes, sampled at its corners, edges and centre (3 × 3), for the hypothesis and every null shape alike
  const step = Math.max(1, t)
  let best = rawSupportShape(r, shape)
  for (let dx = -t; dx <= t; dx += step) for (let dy = -t; dy <= t; dy += step) if (dx !== 0 || dy !== 0) best = Math.max(best, rawSupportShape(r, shift(shape, dx, dy)))
  return best
}

const overlaps = (a: Box, b: Box): boolean => Math.min(a.x1, b.x1) > Math.max(a.x0, b.x0) && Math.min(a.y1, b.y1) > Math.max(a.y0, b.y0)

export type NullBand = { mean: number; std: number; n: number }

/**
 * Same-size boxes on the same rows, across the facade's columns, none overlapping `exclude` (the element's own place
 * and every other element the model or the proposal holds there): the picture's own texture of "no element here".
 */
export function nullBand(r: Raster, box: Shape, facade: { x0: number; x1: number; y0?: number; y1?: number }, exclude: readonly Box[], tolPx: number, asPolygon = false): NullBand {
  const w = box.x1 - box.x0
  const h = box.y1 - box.y0
  const vals: number[] = []
  const lo = Math.max(0, Math.floor(facade.x0))
  const hi = Math.min(r.width - 1, Math.ceil(facade.x1)) - w
  const step = Math.max(2, Math.round(w / 3))
  // the box's own rows, and — where the wall area is given — every other row band of that wall the box fits in
  const top = facade.y0 === undefined ? box.y0 : Math.max(0, Math.floor(facade.y0))
  const bottom = facade.y1 === undefined ? box.y0 : Math.min(r.height - 1, Math.ceil(facade.y1)) - h
  const rows = [box.y0, ...(bottom > top ? Array.from({ length: Math.floor((bottom - top) / Math.max(2, Math.round(h / 2))) + 1 }, (_, i) => top + i * Math.max(2, Math.round(h / 2))) : [])].filter((y, i, a) => a.indexOf(y) === i)
  for (const y of rows) for (let x = lo; x <= hi; x += step) {
    const b = { x0: x, y0: y, x1: x + w, y1: y + h }
    const grown = { x0: b.x0 - tolPx, y0: b.y0 - tolPx, x1: b.x1 + tolPx, y1: b.y1 + tolPx }
    if (exclude.some((e) => overlaps(grown, e))) continue
    vals.push(asPolygon ? supportNearShape(r, shift(box, x - box.x0, y - box.y0), tolPx) : supportNear(r, b, tolPx))
  }
  const n = vals.length
  const mean = n > 0 ? vals.reduce((a, v) => a + v, 0) / n : 0
  const std = n > 1 ? Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / (n - 1)) : 0
  return { mean, std, n }
}

export type Support = { raw: number; z: number | null; null: NullBand; supported: boolean | null }

/** A box's support in standard deviations above its own picture's null band; null when the band is too thin to decide. */
export function supportOf(r: Raster, box: Shape, facade: { x0: number; x1: number; y0?: number; y1?: number }, exclude: readonly Box[], tolPx: number, asPolygon = isRaked(box)): Support {
  const raw = asPolygon ? supportNearShape(r, box, tolPx) : supportNear(r, box, tolPx)
  const band = nullBand(r, box, facade, exclude, tolPx, asPolygon)
  if (band.n < MIN_NULL) return { raw, z: null, null: band, supported: null }
  const z = (raw - band.mean) / Math.max(band.std, 0.01)
  return { raw, z: Math.round(z * 100) / 100, null: band, supported: z >= SUPPORT_Z_MIN }
}

export type HypothesisVerdict = { winner: 'PROPOSED' | 'CURRENT' | 'UNDECIDED'; proposed: Support; current?: Support; why: string; /** 1.1.0: how the two were scored. */ measure?: 'BOX' | 'POLYGON' }

/**
 * The model's element (`current`, absent for an ADD) and the proposal, held against the same picture. The proposal wins
 * when the source supports it and it beats the current by HYPOTHESIS_Z_MARGIN (or the current is not supported at all);
 * the current wins when it beats the proposal by that margin; otherwise the picture does not decide.
 */
export function compareHypotheses(r: Raster, proposed: Shape, current: Shape | undefined, facade: { x0: number; x1: number; y0?: number; y1?: number }, others: readonly Box[], tolPx: number): HypothesisVerdict {
  const v = compareHypothesesOn(r, proposed, current, facade, others, tolPx)
  return { ...v, measure: isRaked(proposed) || isRaked(current) ? 'POLYGON' : 'BOX' }
}
function compareHypothesesOn(r: Raster, proposed: Shape, current: Shape | undefined, facade: { x0: number; x1: number; y0?: number; y1?: number }, others: readonly Box[], tolPx: number): HypothesisVerdict {
  // A2: a raked head on either side scores BOTH as polygons — one bounding box with two heads is two hypotheses
  const asPolygon = isRaked(proposed) || isRaked(current)
  const exclude = [proposed, ...(current ? [current] : []), ...others]
  const p = supportOf(r, proposed, facade, exclude, tolPx, asPolygon)
  const c = current ? supportOf(r, current, facade, exclude, tolPx, asPolygon) : undefined
  if (p.z === null) return { winner: 'UNDECIDED', proposed: p, ...(c ? { current: c } : {}), why: `too few free same-size places on this wall band (${p.null.n}) to know what the picture draws where nothing stands` }
  if (!c) {
    if (p.supported) return { winner: 'PROPOSED', proposed: p, why: `the source draws an element in the proposed box (z ${p.z} ≥ ${SUPPORT_Z_MIN} over ${p.null.n} same-size boxes on that band)` }
    if (p.z < SUPPORT_Z_MIN - HYPOTHESIS_Z_MARGIN) return { winner: 'CURRENT', proposed: p, why: `the source draws nothing distinct in the proposed box (z ${p.z} < ${SUPPORT_Z_MIN - HYPOTHESIS_Z_MARGIN} over ${p.null.n} same-size boxes on that band)` }
    return { winner: 'UNDECIDED', proposed: p, why: `the source draws something weak in the proposed box (z ${p.z}, between ${SUPPORT_Z_MIN - HYPOTHESIS_Z_MARGIN} and ${SUPPORT_Z_MIN}): not enough to add an element, not enough to say there is none` }
  }
  const cz = c.z ?? 0
  // a proposal the picture shows nothing at is refused whatever the model's element scores: it cannot be the source's
  if (p.z < SUPPORT_Z_MIN - HYPOTHESIS_Z_MARGIN) return { winner: 'CURRENT', proposed: p, current: c, why: `the source draws nothing distinct in the proposed box (z ${p.z} < ${SUPPORT_Z_MIN - HYPOTHESIS_Z_MARGIN}); the model's element (z ${cz}) is kept` }
  if (p.supported && (p.z - cz >= HYPOTHESIS_Z_MARGIN || !(c.supported ?? false))) return { winner: 'PROPOSED', proposed: p, current: c, why: `the source supports the proposal (z ${p.z}) ${c.supported ? `better than the model's element (z ${cz})` : `and not the model's element (z ${cz})`}` }
  if ((c.supported ?? false) && (cz - p.z >= HYPOTHESIS_Z_MARGIN || !p.supported)) return { winner: 'CURRENT', proposed: p, current: c, why: `the source supports the model's element (z ${cz}) ${p.supported ? 'better than' : 'and not'} the proposal (z ${p.z}): the model stands` }
  return { winner: 'UNDECIDED', proposed: p, current: c, why: `the picture does not decide between the model's element (z ${cz}) and the proposal (z ${p.z}): both stay named, neither is chosen` }
}

export const iou = (a: Box, b: Box): number => {
  const ix = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0))
  const iy = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0))
  const i = ix * iy
  const u = (a.x1 - a.x0) * (a.y1 - a.y0) + (b.x1 - b.x0) * (b.y1 - b.y0) - i
  return u > 0 ? i / u : 0
}


// ---------------------------------------------------------------------------------------------------------------
// A2: the fill of an opening — a separate measure from its place and size
// ---------------------------------------------------------------------------------------------------------------

export type FillClass = 'GLAZED' | 'SOLID' | 'PANELLED'
/** What each opening kind is expected to show inside its frame. WINDOW and GLAZED_DOOR share a fill: their difference is the sill. */
export const FILL_OF: Record<'WINDOW' | 'DOOR' | 'GLAZED_DOOR' | 'GARAGE_DOOR', FillClass> = { WINDOW: 'GLAZED', GLAZED_DOOR: 'GLAZED', DOOR: 'SOLID', GARAGE_DOOR: 'PANELLED' }
/** Fixed before any result (precision first: between the bands the picture does not decide). */
export const FILL_BANDS = { stripeYes: 0.6, stripeNo: 0.3, stripeAmp: 0.03, textureGlazed: 0.06, textureSolid: 0.02, tintGlazed: 12, tintSolid: 4 } as const

export type FillFeatures = { stripe: number; stripeAmp: number; texture: number; tint: number; samples: number }

/** Inside the shape (shrunk by 15 %): row periodicity (panels), mean gradient (frames, bars, reflections), blue tint against the ring. */
export function fillFeatures(r: Raster, shape: Shape): FillFeatures {
  const L = lumOf(r)
  const poly = polygonOf(shape)
  const cx = poly.reduce((a, p) => a + p[0], 0) / 4
  const cy = poly.reduce((a, p) => a + p[1], 0) / 4
  const inner = poly.map(([x, y]) => [cx + (x - cx) * 0.85, cy + (y - cy) * 0.85] as [number, number])
  const top = Math.max(0, Math.floor(Math.min(...inner.map((p) => p[1]))))
  const bot = Math.min(r.height - 2, Math.ceil(Math.max(...inner.map((p) => p[1]))))
  const lft = Math.max(0, Math.floor(Math.min(...inner.map((p) => p[0]))))
  const rgt = Math.min(r.width - 2, Math.ceil(Math.max(...inner.map((p) => p[0]))))
  const rows: number[] = []
  let grad = 0
  let n = 0
  let tintIn = 0
  for (let y = top; y <= bot; y += 1) {
    let s0 = 0
    let k = 0
    for (let x = lft; x <= rgt; x += 1) {
      if (!inPoly(inner, x, y)) continue
      const i = y * r.width + x
      s0 += L[i]
      k += 1
      grad += Math.abs(L[i + 1] - L[i]) + Math.abs(L[i + r.width] - L[i])
      tintIn += r.data[i * 4 + 2] - (r.data[i * 4] + r.data[i * 4 + 1]) / 2
      n += 1
    }
    if (k > 0) rows.push(s0 / k)
  }
  if (n < 30 || rows.length < 8) return { stripe: 0, stripeAmp: 0, texture: 0, tint: 0, samples: n }
  // detrended row profile and its normalised autocorrelation at lags 2..rows/3
  const m = rows.length
  const xm = (m - 1) / 2
  const ym = rows.reduce((a, v) => a + v, 0) / m
  const slope = rows.reduce((a, v, i) => a + (i - xm) * (v - ym), 0) / Math.max(1e-9, rows.reduce((a, _, i) => a + (i - xm) ** 2, 0))
  const d = rows.map((v, i) => v - ym - slope * (i - xm))
  const v0 = d.reduce((a, v) => a + v * v, 0) / m
  let stripe = 0
  if (v0 > 1e-6) for (let lag = 2; lag <= Math.floor(m / 3); lag += 1) {
    let c = 0
    for (let i = 0; i + lag < m; i += 1) c += d[i] * d[i + lag]
    stripe = Math.max(stripe, c / (m - lag) / v0)
  }
  // the ring's tint, outside the shape
  let tintOut = 0
  let no = 0
  const w = shape.x1 - shape.x0
  for (let y = Math.max(0, Math.floor(shape.y0)); y <= Math.min(r.height - 1, Math.ceil(shape.y1)); y += 2) for (const x of [Math.round(shape.x0 - w / 4), Math.round(shape.x1 + w / 4)]) {
    if (x < 0 || x >= r.width) continue
    const i = y * r.width + x
    tintOut += r.data[i * 4 + 2] - (r.data[i * 4] + r.data[i * 4 + 1]) / 2
    no += 1
  }
  return { stripe: Math.round(stripe * 1000) / 1000, stripeAmp: Math.round((Math.sqrt(v0) / 255) * 1000) / 1000, texture: Math.round((grad / n / 2 / 255) * 1000) / 1000, tint: Math.round((tintIn / n - (no > 0 ? tintOut / no : 0)) * 10) / 10, samples: n }
}

/** The fill the picture shows, or null when it is between the bands (precision first). */
export function fillClassOf(f: FillFeatures): FillClass | null {
  const b = FILL_BANDS
  if (f.samples < 30) return null
  if (f.stripe >= b.stripeYes && f.stripeAmp >= b.stripeAmp) return 'PANELLED'
  if (f.stripe >= b.stripeNo) return null
  if (f.texture >= b.textureGlazed || f.tint >= b.tintGlazed) return 'GLAZED'
  if (f.texture <= b.textureSolid && f.tint < b.tintSolid) return 'SOLID'
  return null
}

export type FillVerdict = { winner: 'PROPOSED' | 'CURRENT' | 'UNDECIDED'; observed: FillClass | null; features: FillFeatures; why: string }

/** Two kinds of one opening held against what its inside shows. Kinds with the same expected fill are never decided here. */
export function compareFill(r: Raster, shape: Shape, proposedKind: keyof typeof FILL_OF, currentKind: keyof typeof FILL_OF): FillVerdict {
  const features = fillFeatures(r, shape)
  const observed = fillClassOf(features)
  const fp = FILL_OF[proposedKind]
  const fc = FILL_OF[currentKind]
  const stats = `stripe ${features.stripe}, texture ${features.texture}, tint ${features.tint}`
  if (fp === fc) return { winner: 'UNDECIDED', observed, features, why: `${proposedKind} and ${currentKind} both show a ${fp.toLowerCase()} fill: the picture's inside cannot tell them apart (${stats})` }
  if (observed === null) return { winner: 'UNDECIDED', observed, features, why: `the inside of the opening is between the fill bands (${stats}): neither ${proposedKind} nor ${currentKind} is shown clearly` }
  if (observed === fp) return { winner: 'PROPOSED', observed, features, why: `the inside shows a ${observed.toLowerCase()} fill (${stats}), as a ${proposedKind} does and a ${currentKind} does not` }
  if (observed === fc) return { winner: 'CURRENT', observed, features, why: `the inside shows a ${observed.toLowerCase()} fill (${stats}), as the model's ${currentKind} does and a ${proposedKind} does not` }
  return { winner: 'UNDECIDED', observed, features, why: `the inside shows a ${observed.toLowerCase()} fill (${stats}), which is neither ${proposedKind} nor ${currentKind}` }
}
