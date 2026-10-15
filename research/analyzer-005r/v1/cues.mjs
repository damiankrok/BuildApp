/**
 * cues.mjs — 005R V1 Task-B cues (RESEARCH ONLY; never imported by production).
 *
 * Two deterministic cues, and only on images a router sends to TECHNICAL_ELEVATION (an orthographic drawing, where a
 * row of pixels is a horizontal line of the facade). V1 emits NO Task-B observation on perspective images: a
 * periodicity in a perspective view is not a periodicity on the facade.
 *
 *   RAILING      a horizontal band whose column-darkness profile is periodic (thin vertical strokes at a regular
 *                pitch: balusters) over ≥ MIN_PERIODS periods; the box spans the band and the periodic run.
 *   GARAGE_DOOR  a rectangle resting on the lowest long dark horizontal line (the ground line) and crossed by
 *                ≥ MIN_RIBS evenly spaced horizontal strokes of the same extent (sectional door ribs).
 *
 * Known look-alikes these cues cannot exclude and therefore never upgrade beyond PROPOSED / UNVALIDATED_SCORE:
 * vertical board cladding and window mullions (railing), horizontal siding and louvres (garage door). The constants
 * below were written before any synthetic or real result was seen and are not tuned afterwards.
 */
import { decode } from './features.mjs'
import { readFileSync } from 'node:fs'

export const CUES_VERSION = 'v1-cues@1'
const SIDE = 768
const DARK = 120
const BAND = 0.03
const MIN_PERIODS = 6
const MIN_RIBS = 4

function gray(img) {
  const s = Math.max(1, Math.max(img.width, img.height) / SIDE)
  const w = Math.max(1, Math.round(img.width / s)), h = Math.max(1, Math.round(img.height / s))
  const g = new Float32Array(w * h), n = new Float32Array(w * h)
  for (let y = 0; y < img.height; y++) {
    const ty = Math.min(h - 1, Math.floor((y * h) / img.height))
    for (let x = 0; x < img.width; x++) {
      const tx = Math.min(w - 1, Math.floor((x * w) / img.width)), i = (y * img.width + x) * 4
      g[ty * w + tx] += 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2]; n[ty * w + tx]++
    }
  }
  for (let i = 0; i < w * h; i++) g[i] /= n[i]
  return { w, h, g, s: img.width / w, sy: img.height / h }
}

function periodicRun(profile) {
  // best lag by normalised autocorrelation of the mean-removed profile; then the longest run where strokes repeat at it
  const n = profile.length
  const m = profile.reduce((a, b) => a + b, 0) / n
  const p = profile.map((v) => v - m)
  const den = p.reduce((a, b) => a + b * b, 0)
  if (den <= 1e-6) return null
  let best = null
  for (let lag = 4; lag <= 40; lag++) {
    let num = 0
    for (let i = 0; i + lag < n; i++) num += p[i] * p[i + lag]
    const r = num / den
    if (!best || r > best.r) best = { lag, r }
  }
  if (!best || best.r < 0.5) return null
  // stroke positions: local maxima of darkness above the mean
  const peaks = []
  for (let i = 1; i + 1 < n; i++) if (p[i] > 0 && p[i] >= p[i - 1] && p[i] > p[i + 1]) peaks.push(i)
  let run = [], bestRun = []
  for (const q of peaks) {
    if (run.length && Math.abs(q - run[run.length - 1] - best.lag) <= 2) run.push(q)
    else run = [q]
    if (run.length > bestRun.length) bestRun = [...run]
  }
  return bestRun.length >= MIN_PERIODS ? { lag: best.lag, r: best.r, x0: bestRun[0], x1: bestRun[bestRun.length - 1], periods: bestRun.length } : null
}

export function cues(img) {
  const { w, h, g, s, sy } = gray(img)
  const out = []
  const bh = Math.max(3, Math.round(h * BAND))
  // RAILING: bands of rows; merge vertically adjacent hits with the same lag and overlapping x-range
  const hits = []
  for (let y0 = 0; y0 + bh <= h; y0 += Math.ceil(bh / 2)) {
    const prof = new Array(w).fill(0)
    for (let y = y0; y < y0 + bh; y++) for (let x = 0; x < w; x++) prof[x] += g[y * w + x] < DARK ? 1 : 0
    const r = periodicRun(prof.map((v) => v / bh))
    if (r) hits.push({ y0, y1: y0 + bh, ...r })
  }
  const merged = []
  for (const hb of hits) {
    const last = merged[merged.length - 1]
    if (last && hb.y0 <= last.y1 && Math.abs(hb.lag - last.lag) <= 1 && hb.x0 <= last.x1 && hb.x1 >= last.x0) {
      last.y1 = hb.y1; last.x0 = Math.min(last.x0, hb.x0); last.x1 = Math.max(last.x1, hb.x1); last.r = Math.max(last.r, hb.r); last.periods = Math.max(last.periods, hb.periods)
    } else merged.push({ ...hb })
  }
  for (const m of merged) {
    out.push({ kind: 'RAILING', box: [Math.floor(m.x0 * s), Math.floor(m.y0 * sy), Math.min(img.width, Math.ceil((m.x1 + 1) * s)), Math.min(img.height, Math.ceil(m.y1 * sy))],
      score: Math.round(Math.min(1, m.r) * 1e6) / 1e6, visibleEvidence: ['PERIODIC_VERTICAL_STROKES'], detail: `pitch ${m.lag}px × ${m.periods} periods, r=${m.r.toFixed(3)}` })
  }
  // GARAGE_DOOR: ground line = lowest row with a dark run ≥ 60 % of the width
  let ground = -1
  for (let y = h - 1; y >= Math.floor(h / 2) && ground < 0; y--) {
    let run = 0, bestRun = 0
    for (let x = 0; x < w; x++) { run = g[y * w + x] < DARK ? run + 1 : 0; bestRun = Math.max(bestRun, run) }
    if (bestRun >= 0.6 * w) ground = y
  }
  if (ground > 0) {
    const segs = new Map()   // key x0:x1 (rounded to 4 px) → rows
    for (let y = Math.floor(h * 0.3); y < ground - 2; y++) {
      let x = 0
      while (x < w) {
        if (g[y * w + x] < DARK) {
          let e = x
          while (e < w && g[y * w + e] < DARK) e++
          if (e - x >= w * 0.06 && e - x <= w * 0.45) {
            const key = `${Math.round(x / 4)}:${Math.round(e / 4)}`
            segs.set(key, [...(segs.get(key) ?? []), y])
          }
          x = e
        } else x++
      }
    }
    for (const [key, ys] of [...segs].sort()) {
      const rows = [...new Set(ys)].sort((a, b) => a - b).filter((y, i, a) => i === 0 || y - a[i - 1] > 1)
      if (rows.length < MIN_RIBS) continue
      const gaps = rows.slice(1).map((y, i) => y - rows[i])
      const mg = gaps.reduce((a, b) => a + b, 0) / gaps.length
      if (gaps.some((d) => Math.abs(d - mg) > 0.25 * mg) || ground - rows[rows.length - 1] > 2.5 * mg) continue
      const [a, b] = key.split(':').map((v) => Number(v) * 4)
      const ratio = (b - a) / (ground - rows[0])
      if (ratio < 0.8 || ratio > 3.5) continue
      out.push({ kind: 'GARAGE_DOOR', box: [Math.floor(a * s), Math.floor(rows[0] * sy), Math.min(img.width, Math.ceil(b * s)), Math.min(img.height, Math.ceil(ground * sy))],
        score: Math.round(Math.min(1, rows.length / 8) * 1e6) / 1e6, visibleEvidence: ['GROUND_LINE', 'EVEN_HORIZONTAL_RIBS'], detail: `${rows.length} ribs, pitch ${mg.toFixed(1)}px` })
    }
  }
  return out
}

export function cuesOfFile(path) {
  return cues(decode(readFileSync(path)))
}
