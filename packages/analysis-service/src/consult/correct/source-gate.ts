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
 */
import type { Raster } from '@buildapp/source-package'

export const SOURCE_GATE_VERSION = '1.0.0' as const

export type Box = { x0: number; y0: number; x1: number; y1: number }

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

/** The best raw support within ±tol px of the box (the registration's own uncertainty), the box itself unchanged. */
export function supportNear(r: Raster, box: Box, tolPx: number): number {
  const t = Math.max(0, Math.round(tolPx))
  const step = Math.max(1, Math.round(t / 3))
  let best = rawSupport(r, box)
  for (let dx = -t; dx <= t; dx += step) for (let dy = -t; dy <= t; dy += step) if (dx !== 0 || dy !== 0) best = Math.max(best, rawSupport(r, { x0: box.x0 + dx, y0: box.y0 + dy, x1: box.x1 + dx, y1: box.y1 + dy }))
  return best
}

const overlaps = (a: Box, b: Box): boolean => Math.min(a.x1, b.x1) > Math.max(a.x0, b.x0) && Math.min(a.y1, b.y1) > Math.max(a.y0, b.y0)

export type NullBand = { mean: number; std: number; n: number }

/**
 * Same-size boxes on the same rows, across the facade's columns, none overlapping `exclude` (the element's own place
 * and every other element the model or the proposal holds there): the picture's own texture of "no element here".
 */
export function nullBand(r: Raster, box: Box, facade: { x0: number; x1: number; y0?: number; y1?: number }, exclude: readonly Box[], tolPx: number): NullBand {
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
    vals.push(supportNear(r, b, tolPx))
  }
  const n = vals.length
  const mean = n > 0 ? vals.reduce((a, v) => a + v, 0) / n : 0
  const std = n > 1 ? Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / (n - 1)) : 0
  return { mean, std, n }
}

export type Support = { raw: number; z: number | null; null: NullBand; supported: boolean | null }

/** A box's support in standard deviations above its own picture's null band; null when the band is too thin to decide. */
export function supportOf(r: Raster, box: Box, facade: { x0: number; x1: number; y0?: number; y1?: number }, exclude: readonly Box[], tolPx: number): Support {
  const raw = supportNear(r, box, tolPx)
  const band = nullBand(r, box, facade, exclude, tolPx)
  if (band.n < MIN_NULL) return { raw, z: null, null: band, supported: null }
  const z = (raw - band.mean) / Math.max(band.std, 0.01)
  return { raw, z: Math.round(z * 100) / 100, null: band, supported: z >= SUPPORT_Z_MIN }
}

export type HypothesisVerdict = { winner: 'PROPOSED' | 'CURRENT' | 'UNDECIDED'; proposed: Support; current?: Support; why: string }

/**
 * The model's element (`current`, absent for an ADD) and the proposal, held against the same picture. The proposal wins
 * when the source supports it and it beats the current by HYPOTHESIS_Z_MARGIN (or the current is not supported at all);
 * the current wins when it beats the proposal by that margin; otherwise the picture does not decide.
 */
export function compareHypotheses(r: Raster, proposed: Box, current: Box | undefined, facade: { x0: number; x1: number; y0?: number; y1?: number }, others: readonly Box[], tolPx: number): HypothesisVerdict {
  const exclude = [proposed, ...(current ? [current] : []), ...others]
  const p = supportOf(r, proposed, facade, exclude, tolPx)
  const c = current ? supportOf(r, current, facade, exclude, tolPx) : undefined
  if (p.z === null) return { winner: 'UNDECIDED', proposed: p, ...(c ? { current: c } : {}), why: `too few free same-size places on this wall band (${p.null.n}) to know what the picture draws where nothing stands` }
  if (!c) {
    if (p.supported) return { winner: 'PROPOSED', proposed: p, why: `the source draws an element in the proposed box (z ${p.z} ≥ ${SUPPORT_Z_MIN} over ${p.null.n} same-size boxes on that band)` }
    if (p.z < SUPPORT_Z_MIN - HYPOTHESIS_Z_MARGIN) return { winner: 'CURRENT', proposed: p, why: `the source draws nothing distinct in the proposed box (z ${p.z} < ${SUPPORT_Z_MIN - HYPOTHESIS_Z_MARGIN} over ${p.null.n} same-size boxes on that band)` }
    return { winner: 'UNDECIDED', proposed: p, why: `the source draws something weak in the proposed box (z ${p.z}, between ${SUPPORT_Z_MIN - HYPOTHESIS_Z_MARGIN} and ${SUPPORT_Z_MIN}): not enough to add an element, not enough to say there is none` }
  }
  const cz = c.z ?? 0
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
