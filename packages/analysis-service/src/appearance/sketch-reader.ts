/**
 * v3.54.13 — a flat-colour elevation drawing (an OWNER's sketch, a locally rendered reading) read into material
 * outlines: no model, no network, the drawing's own colours.
 *
 * The drawing's colours are clustered (deterministic k-means), and each cluster is named by its colour FAMILY relative
 * to the drawing — warm and saturated is timber, cool-tinted is glass, neutral is light / dark render by its lightness
 * among the neutrals, a mid neutral is metal or paving — never by a fixed RGB, so another shade of the same timber stays
 * timber. The background is what is near-white and reachable from the border. The drawing's own lines (thin and dark)
 * are taken out by an opening and given to the finish on either side, so a boundary runs through the middle of its
 * line. Each class's connected parts become outlines in the drawing's pixels.
 */
import type { AppearanceClass, AppearanceRegion } from './contract.js'
import { components, count, fillHoles, grid, open, simplifyLoop, traceOuter } from './mask.js'
import type { Grid } from './mask.js'

export const SKETCH_READER_VERSION = '1.0.0' as const

export type RasterRGBA = { width: number; height: number; data: Uint8ClampedArray | Uint8Array }
export type ClusterNaming = { rgb: [number, number, number]; share: number; class: AppearanceClass; why: string }

const hueOf = (r: number, g: number, b: number): number => {
  const mx = Math.max(r, g, b)
  const mn = Math.min(r, g, b)
  if (mx - mn < 1e-9) return 0
  let h = mx === r ? ((g - b) / (mx - mn)) % 6 : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4
  h *= 60
  return h < 0 ? h + 360 : h
}

/** Name the clusters: families first (warm, cool, neutral), neutrals by lightness rank among themselves. */
export function nameClusters(centroids: Array<[number, number, number]>, shares: number[]): ClusterNaming[] {
  const info = centroids.map((c, i) => {
    const [r, g, b] = c.map((v) => v / 255) as [number, number, number]
    const L = (r + g + b) / 3
    const C = Math.max(r, g, b) - Math.min(r, g, b)
    return { i, r, g, b, L, C, H: hueOf(r, g, b), share: shares[i] }
  })
  const neutrals = info.filter((x) => x.C < 0.1)
  const Ls = neutrals.map((x) => x.L).sort((a, b) => a - b)
  const darkest = Ls[0] ?? 0
  const lightest = Ls[Ls.length - 1] ?? 1
  return info.map((x) => {
    const rgb: [number, number, number] = [Math.round(x.r * 255), Math.round(x.g * 255), Math.round(x.b * 255)]
    if (x.C >= 0.18 && x.H >= 5 && x.H <= 65) return { rgb, share: x.share, class: 'TIMBER', why: `warm and saturated (hue ${x.H.toFixed(0)}°, chroma ${x.C.toFixed(2)})` }
    if (x.C >= 0.05 && x.H >= 165 && x.H <= 265) return { rgb, share: x.share, class: 'GLASS', why: `cool-tinted (hue ${x.H.toFixed(0)}°, chroma ${x.C.toFixed(2)})` }
    if (x.C < 0.1) {
      const span = Math.max(0.05, lightest - darkest)
      const rel = (x.L - darkest) / span
      if (rel >= 0.8 && x.L >= 0.75) return { rgb, share: x.share, class: 'LIGHT_RENDER', why: `neutral, among the lightest of the drawing (lightness ${x.L.toFixed(2)})` }
      if (rel <= 0.3 || x.L <= 0.36) return { rgb, share: x.share, class: 'DARK_RENDER', why: `neutral, among the darkest of the drawing (lightness ${x.L.toFixed(2)})` }
      return { rgb, share: x.share, class: 'METAL', why: `a mid neutral (lightness ${x.L.toFixed(2)}): a gate, a plinth or paving, not a render` }
    }
    return { rgb, share: x.share, class: 'UNKNOWN', why: `no family (hue ${x.H.toFixed(0)}°, chroma ${x.C.toFixed(2)})` }
  })
}

/** Deterministic k-means on a regular subsample of the non-background pixels: farthest-point seeding, fixed rounds. */
function kmeans(px: Array<[number, number, number]>, k: number): Array<[number, number, number]> {
  const d2 = (a: readonly number[], b: readonly number[]): number => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
  const cents: Array<[number, number, number]> = [px[0]]
  while (cents.length < k) {
    let best = 0
    let far = px[0]
    for (const p of px) {
      const d = Math.min(...cents.map((c) => d2(p, c)))
      if (d > best) {
        best = d
        far = p
      }
    }
    if (best <= 1) break
    cents.push(far)
  }
  for (let round = 0; round < 20; round++) {
    const sum = cents.map(() => [0, 0, 0, 0])
    for (const p of px) {
      let bi = 0
      let bd = Infinity
      cents.forEach((c, i) => {
        const d = d2(p, c)
        if (d < bd) {
          bd = d
          bi = i
        }
      })
      sum[bi][0] += p[0]
      sum[bi][1] += p[1]
      sum[bi][2] += p[2]
      sum[bi][3] += 1
    }
    cents.forEach((c, i) => {
      if (sum[i][3] > 0) cents[i] = [sum[i][0] / sum[i][3], sum[i][1] / sum[i][3], sum[i][2] / sum[i][3]]
    })
  }
  return cents
}

export type SketchReading = { regions: AppearanceRegion[]; clusters: ClusterNaming[]; width: number; height: number }

export function readSketch(img: RasterRGBA, options: { clusters?: number; minAreaPx?: number; lineWidthPx?: number } = {}): SketchReading {
  const { width: W, height: H, data } = img
  const k = options.clusters ?? 8
  const minArea = options.minAreaPx ?? 400
  const lineR = options.lineWidthPx ?? 2
  const rgbAt = (i: number): [number, number, number] => [data[4 * i], data[4 * i + 1], data[4 * i + 2]]
  // 1. background: near-white and neutral, reachable from the border
  const nearWhite = (i: number): boolean => {
    const [r, g, b] = rgbAt(i)
    return Math.min(r, g, b) >= 238 && Math.max(r, g, b) - Math.min(r, g, b) <= 10
  }
  const bg = grid(W, H)
  const stack: number[] = []
  const seed = (x: number, y: number): void => {
    const i = y * W + x
    if (!bg.data[i] && nearWhite(i)) {
      bg.data[i] = 1
      stack.push(i)
    }
  }
  for (let x = 0; x < W; x++) {
    seed(x, 0)
    seed(x, H - 1)
  }
  for (let y = 0; y < H; y++) {
    seed(0, y)
    seed(W - 1, y)
  }
  while (stack.length > 0) {
    const i = stack.pop() as number
    const x = i % W
    const y = (i - x) / W
    if (x > 0) seed(x - 1, y)
    if (x < W - 1) seed(x + 1, y)
    if (y > 0) seed(x, y - 1)
    if (y < H - 1) seed(x, y + 1)
  }
  // 2. the drawing's colours: k-means on a regular subsample of what is not background
  const sample: Array<[number, number, number]> = []
  const stride = Math.max(1, Math.floor(Math.sqrt((W * H) / 40000)))
  for (let y = 0; y < H; y += stride) for (let x = 0; x < W; x += stride) if (!bg.data[y * W + x]) sample.push(rgbAt(y * W + x))
  if (sample.length === 0) return { regions: [], clusters: [], width: W, height: H }
  const cents = kmeans(sample, k)
  const label = new Uint8Array(W * H)
  const share = cents.map(() => 0)
  for (let i = 0; i < W * H; i++) {
    if (bg.data[i]) {
      label[i] = 255
      continue
    }
    const p = rgbAt(i)
    let bi = 0
    let bd = Infinity
    cents.forEach((c, ci) => {
      const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2
      if (d < bd) {
        bd = d
        bi = ci
      }
    })
    label[i] = bi
    share[bi] += 1
  }
  const total = share.reduce((a, b) => a + b, 0)
  const named = nameClusters(cents, share.map((s) => s / total))
  const CLASSES: AppearanceClass[] = ['TIMBER', 'GLASS', 'LIGHT_RENDER', 'DARK_RENDER', 'METAL', 'UNKNOWN']
  const classOf = new Uint8Array(W * H).fill(255)
  for (let i = 0; i < W * H; i++) if (label[i] !== 255) classOf[i] = CLASSES.indexOf(named[label[i]].class)
  // 3. the drawing's lines: what an opening of the class masks removes (thin), given to the nearest surviving class
  const kept = new Uint8Array(W * H).fill(255)
  for (let c = 0; c < CLASSES.length; c++) {
    const m: Grid = grid(W, H)
    for (let i = 0; i < W * H; i++) if (classOf[i] === c) m.data[i] = 1
    const o = open(m, lineR)
    for (let i = 0; i < W * H; i++) if (o.data[i]) kept[i] = c
  }
  // fill the removed pixels from their kept neighbours, ring by ring (a breadth-first growth: each line splits down its middle)
  let frontier: number[] = []
  for (let i = 0; i < W * H; i++) if (kept[i] !== 255) frontier.push(i)
  while (frontier.length > 0) {
    const next: number[] = []
    for (const i of frontier) {
      const x = i % W
      const y = (i - x) / W
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
        if (j < 0 || kept[j] !== 255 || bg.data[j]) continue
        kept[j] = kept[i]
        next.push(j)
      }
    }
    frontier = next
  }
  // 4. outlines, class by class, component by component
  const regions: AppearanceRegion[] = []
  for (let c = 0; c < CLASSES.length; c++) {
    const m: Grid = grid(W, H)
    for (let i = 0; i < W * H; i++) if (kept[i] === c) m.data[i] = 1
    let n = 0
    for (const comp of components(m)) {
      if (count(comp) < minArea) continue
      const loop = simplifyLoop(traceOuter(fillHoles(comp)), 1.5)
      if (loop.length < 3) continue
      regions.push({ regionId: `${CLASSES[c].toLowerCase().replace(/_/g, '-')}-${n++}`, class: CLASSES[c], outline: loop.map(([x, y]) => [x, y] as [number, number]), visibility: 'VISIBLE', uncertaintyPx: lineR + 1.5 })
    }
  }
  return { regions, clusters: named, width: W, height: H }
}
