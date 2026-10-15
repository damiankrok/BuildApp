/**
 * features.mjs — 005R V1 deterministic image features (RESEARCH ONLY; never imported by production).
 *
 * Pure JavaScript on the decoders the repository already ships (jpeg-js, pngjs, omggif), so the same code runs on
 * Node 18.20.4 (the APK's runtime) and Node 22 without a native dependency. No model, no network, no randomness.
 *
 * Every feature is a property of the pixels alone: the router never sees a URL, caption, filename or page position.
 * The image is decoded, reduced by area averaging so its longer side is at most WORK_SIDE, and measured:
 *
 *   colour        mean HSV saturation, Hasler–Süsstrunk colourfulness, palette concentration (share of pixels in the
 *                 16 most frequent 4-bit colours), near-white and near-black shares
 *   structure     Sobel edge density; share of edge pixels within ±AXIS_TOL° of horizontal/vertical; share at
 *                 pitched-roof angles (20–55° either way); horizontal/vertical edge ratio
 *   drawing cues  longest dark horizontal run as a share of width in the lower half (a ground line); share of dark
 *                 pixels inside 3×3 all-dark neighbourhoods (thick poché: walls in plans, cut slabs in sections)
 *   scene cues    top band (upper 20 %): brightness, blue dominance, edge density (sky); vegetation share in the lower
 *                 40 %; warm-material share (wood, 15–45° hue); top band neutral and smooth (ceiling)
 *   geometry      aspect ratio (width / height), log of decoded pixel count
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const require = createRequire(join(process.env.BUILDAPP_ROOT ?? new URL('../../..', import.meta.url).pathname, 'package.json'))
const jpeg = require('jpeg-js')
const { PNG } = require('pngjs')
const { GifReader } = require('omggif')

export const FEATURE_VERSION = 'v1-features@1'
export const WORK_SIDE = 384
const AXIS_TOL = 5
const EDGE_T = 48

/** Decode JPEG / PNG / GIF bytes to { width, height, data: RGBA Uint8 }. Throws on anything else: never guesses. */
export function decode(bytes) {
  const b = Buffer.from(bytes)
  if (b[0] === 0xff && b[1] === 0xd8) {
    const img = jpeg.decode(b, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 1024 })
    return { width: img.width, height: img.height, data: img.data }
  }
  if (b[0] === 0x89 && b[1] === 0x50) {
    const img = PNG.sync.read(b)
    return { width: img.width, height: img.height, data: img.data }
  }
  if (b[0] === 0x47 && b[1] === 0x49) {
    const g = new GifReader(new Uint8Array(b))
    const data = new Uint8Array(g.width * g.height * 4)
    g.decodeAndBlitFrameRGBA(0, data)
    // transparent GIF pixels are the page background (white), not black
    for (let i = 0; i < data.length; i += 4) if (data[i + 3] === 0) data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 255
    return { width: g.width, height: g.height, data }
  }
  throw new Error('UNSUPPORTED_FORMAT')
}

/** Area-average downscale to longer side ≤ side; returns Float32 r,g,b planes. */
export function reduce(img, side = WORK_SIDE) {
  const s = Math.max(1, Math.max(img.width, img.height) / side)
  const w = Math.max(1, Math.round(img.width / s)), h = Math.max(1, Math.round(img.height / s))
  const r = new Float32Array(w * h), g = new Float32Array(w * h), bl = new Float32Array(w * h), n = new Float32Array(w * h)
  for (let y = 0; y < img.height; y++) {
    const ty = Math.min(h - 1, Math.floor((y * h) / img.height))
    for (let x = 0; x < img.width; x++) {
      const tx = Math.min(w - 1, Math.floor((x * w) / img.width)), i = (y * img.width + x) * 4, t = ty * w + tx
      const a = img.data[i + 3] / 255
      r[t] += img.data[i] * a + 255 * (1 - a); g[t] += img.data[i + 1] * a + 255 * (1 - a); bl[t] += img.data[i + 2] * a + 255 * (1 - a); n[t]++
    }
  }
  for (let t = 0; t < w * h; t++) { r[t] /= n[t]; g[t] /= n[t]; bl[t] /= n[t] }
  return { w, h, r, g, b: bl }
}

function hsv(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
  let hue = 0
  if (d > 0) hue = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  hue = (hue * 60 + 360) % 360
  return [hue, mx === 0 ? 0 : d / mx, mx / 255]
}

const round = (v) => Math.round(v * 1e6) / 1e6

/** All V1 features of one decoded image. Deterministic to the bit on any Node ≥ 18. */
export function features(img) {
  const { w, h, r, g, b } = reduce(img)
  const N = w * h
  const lum = new Float32Array(N)
  let satSum = 0, white = 0, dark = 0, rgSum = 0, ybSum = 0, rg2 = 0, yb2 = 0
  const pal = new Map()
  for (let i = 0; i < N; i++) {
    lum[i] = 0.299 * r[i] + 0.587 * g[i] + 0.114 * b[i]
    const [, s] = hsv(r[i], g[i], b[i])
    satSum += s
    if (r[i] > 235 && g[i] > 235 && b[i] > 235) white++
    if (lum[i] < 60) dark++
    const rg = r[i] - g[i], yb = 0.5 * (r[i] + g[i]) - b[i]
    rgSum += rg; ybSum += yb; rg2 += rg * rg; yb2 += yb * yb
    const key = ((r[i] >> 4) << 8) | ((g[i] >> 4) << 4) | (b[i] >> 4)
    pal.set(key, (pal.get(key) ?? 0) + 1)
  }
  const mrg = rgSum / N, myb = ybSum / N
  const colourful = Math.sqrt(Math.max(0, rg2 / N - mrg * mrg) + Math.max(0, yb2 / N - myb * myb)) + 0.3 * Math.sqrt(mrg * mrg + myb * myb)
  const top16 = [...pal.values()].sort((a, c) => c - a).slice(0, 16).reduce((a, c) => a + c, 0) / N

  // Sobel on luminance
  let edges = 0, axis = 0, pitched = 0, horiz = 0, vert = 0
  const isEdge = new Uint8Array(N)
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x
    const gx = lum[i - w + 1] + 2 * lum[i + 1] + lum[i + w + 1] - lum[i - w - 1] - 2 * lum[i - 1] - lum[i + w - 1]
    const gy = lum[i + w - 1] + 2 * lum[i + w] + lum[i + w + 1] - lum[i - w - 1] - 2 * lum[i - w] - lum[i - w + 1]
    const m = Math.hypot(gx, gy)
    if (m < EDGE_T) continue
    edges++; isEdge[i] = 1
    // orientation of the EDGE (perpendicular to the gradient), folded to [0, 180)
    const ang = ((Math.atan2(gy, gx) * 180) / Math.PI + 90 + 360) % 180
    const dh = Math.min(ang, 180 - ang), dv = Math.abs(ang - 90)
    if (dh <= AXIS_TOL) { axis++; horiz++ } else if (dv <= AXIS_TOL) { axis++; vert++ } else if ((dh >= 20 && dh <= 55)) pitched++
  }
  const inner = Math.max(1, (w - 2) * (h - 2))

  // ground line: longest run of dark pixels along a row in the lower half, as a share of width
  let ground = 0
  for (let y = Math.floor(h / 2); y < h; y++) {
    let run = 0
    for (let x = 0; x < w; x++) { if (lum[y * w + x] < 110) { run++; if (run > ground * w) ground = run / w } else run = 0 }
  }
  // thick poché: dark pixels whose 3×3 neighbourhood is all dark
  let poche = 0
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    let all = true
    for (let dy = -1; dy <= 1 && all; dy++) for (let dx = -1; dx <= 1; dx++) if (lum[(y + dy) * w + x + dx] >= 80) { all = false; break }
    if (all) poche++
  }

  // scene bands
  const topRows = Math.max(1, Math.floor(h * 0.2)), lowStart = Math.floor(h * 0.6)
  let tBright = 0, tBlue = 0, tEdge = 0, tSat = 0, tNeutralSmooth = 0, veg = 0, warm = 0, tn = 0, ln = 0
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x
    const [hue, s, v] = hsv(r[i], g[i], b[i])
    if (hue >= 15 && hue <= 45 && s > 0.25 && v > 0.2) warm++
    if (y < topRows) {
      tn++; tBright += v; tSat += s; tEdge += isEdge[i]
      if (b[i] > r[i] + 8 && b[i] >= g[i] - 4 && v > 0.45) tBlue++
      if (s < 0.12 && !isEdge[i]) tNeutralSmooth++
    }
    if (y >= lowStart) { ln++; if (hue >= 60 && hue <= 170 && s > 0.2 && v > 0.15) veg++ }
  }
  return {
    featureVersion: FEATURE_VERSION,
    workW: w, workH: h,
    aspect: round(img.width / img.height),
    logPixels: round(Math.log10(img.width * img.height)),
    sat: round(satSum / N),
    colourful: round(colourful),
    top16: round(top16),
    white: round(white / N),
    dark: round(dark / N),
    edgeDensity: round(edges / inner),
    axisFrac: round(edges ? axis / edges : 0),
    pitchedFrac: round(edges ? pitched / edges : 0),
    hvRatio: round(vert ? horiz / vert : horiz ? 10 : 1),
    groundLine: round(ground),
    poche: round(poche / inner),
    skyBright: round(tBright / tn),
    skyBlue: round(tBlue / tn),
    skyEdge: round(tEdge / tn),
    skySat: round(tSat / tn),
    ceilingSmooth: round(tNeutralSmooth / tn),
    vegetation: round(veg / Math.max(1, ln)),
    warm: round(warm / N),
  }
}

export const FEATURE_NAMES = ['aspect', 'logPixels', 'sat', 'colourful', 'top16', 'white', 'dark', 'edgeDensity', 'axisFrac', 'pitchedFrac',
  'hvRatio', 'groundLine', 'poche', 'skyBright', 'skyBlue', 'skyEdge', 'skySat', 'ceilingSmooth', 'vegetation', 'warm']

export function featuresOfFile(path) {
  return features(decode(readFileSync(path)))
}
