/**
 * EXTERIOR-COMPLETE (Bakopy): what stands behind a building's top on an elevation, and is not the building.
 *
 * The profile walks (`side-orientation.ts`, `attached-roof-form.ts`) read a body's top column by column as the first
 * pixel below the ceiling that is not background. Background was the sky the flood from the picture's top reached, and
 * pixels green by `g − max(r, b) ≥ 8`. A render that sets the house before a stand of trees breaks both: the crowns
 * are olive and near-black (their green barely above their red), and the sky seen through them is cut off from the
 * flood. The walk then stopped on the crowns, 0.9–1.4 m over the ridge, every attached body's view was refused as
 * misregistered and every attached roof built flat.
 *
 * Background here adds, to that sky:
 *  - VEGETATION by its neighbourhood: a plant-coloured pixel (a green-to-olive hue, saturated — a tiled or rendered
 *    surface is grey, red, brown or timber, never this) with enough plant-coloured pixels round it, or any pixel (the
 *    near-black shadows inside a crown) more than half of whose neighbourhood is plant-coloured, in a textured
 *    neighbourhood (leaves; a flat painted wall of that hue is not a tree);
 *  - SKY SEEN THROUGH IT: a bright bluish or near-white pixel among that vegetation (a crown's flecks of light), a
 *    smooth, bright, bluish pixel next to it, and pale pixels joined to such sky in small steps (a cloud), exactly as the
 *    sky's own flood grows.
 * Nothing else is removed: a dark roof, a chimney, a dormer or a gable is neither plant-coloured nor smooth bright
 * sky, and a roof pixel at a crown's edge has the crown over at most half of its neighbourhood.
 */
import type { Mask, Raster } from '@buildapp/source-cv'

/** Plant hues (degrees): yellow-green through green to teal. Below 50 are ochre, timber and brick. */
export const PLANT_HUE_DEG: readonly [number, number] = [50, 200]
/** A plant colour is at least this saturated and this bright (luma) — near-black pixels' hue is noise. */
export const PLANT_SAT_MIN = 0.4
export const PLANT_LUMA_MIN = 25
/** The neighbourhood's half-size (px) and the shares of plant colour in it that make a pixel vegetation. */
export const VEGETATION_RADIUS_PX = 4
export const VEGETATION_SHARE_PLANT = 0.3
export const VEGETATION_SHARE_OTHER = 0.55
/** Leaves are textured: the neighbourhood's mean local luma deviation is at least this. */
export const VEGETATION_TEXTURE_MIN = 6
/** Sky seen through trees: bluish (blue over red and green by this), this bright (luma), and smooth. */
export const SKY_BLUE_MIN = 6
export const SKY_LUMA_MIN = 160
export const SKY_TEXTURE_MAX = 4
/** A near-white pixel: at least this bright, its channels within this of each other. */
export const SKY_PALE_LUMA_MIN = 200
export const SKY_PALE_SPREAD_MAX = 40
/** Sky grows into a neighbour no further than this per channel (the sky flood's own step). */
export const SKY_STEP = 12

const luma = (r: number, g: number, b: number): number => 0.299 * r + 0.587 * g + 0.114 * b

function hueDeg(r: number, g: number, b: number): number {
  const mx = Math.max(r, g, b)
  const mn = Math.min(r, g, b)
  if (mx === mn) return 0
  const h = mx === r ? ((g - b) / (mx - mn)) % 6 : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4
  return (h * 60 + 360) % 360
}

export function plantColoured(r: number, g: number, b: number): boolean {
  if (g - Math.max(r, b) >= 8) return true
  const mx = Math.max(r, g, b)
  if (mx === 0) return false
  const sat = (mx - Math.min(r, g, b)) / mx
  const h = hueDeg(r, g, b)
  return sat >= PLANT_SAT_MIN && luma(r, g, b) >= PLANT_LUMA_MIN && h >= PLANT_HUE_DEG[0] && h <= PLANT_HUE_DEG[1]
}

/** The mean of `v` over a (2r+1)² box about each pixel (an integral image). */
function boxMean(v: Float32Array, W: number, H: number, r: number): Float32Array {
  const S = new Float64Array((W + 1) * (H + 1))
  for (let y = 0; y < H; y += 1) {
    let row = 0
    for (let x = 0; x < W; x += 1) {
      row += v[y * W + x]
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

/** The local texture: the deviation of luma over 3 × 3, averaged over the box of radius `r`. */
function texture(raster: Raster, r: number): Float32Array {
  const W = raster.width
  const H = raster.height
  const L = new Float32Array(W * H)
  const L2 = new Float32Array(W * H)
  for (let i = 0; i < W * H; i += 1) {
    const l = luma(raster.data[i * 4], raster.data[i * 4 + 1], raster.data[i * 4 + 2])
    L[i] = l
    L2[i] = l * l
  }
  const m = boxMean(L, W, H, 1)
  const m2 = boxMean(L2, W, H, 1)
  const sd = new Float32Array(W * H)
  for (let i = 0; i < W * H; i += 1) sd[i] = Math.sqrt(Math.max(0, m2[i] - m[i] * m[i]))
  return boxMean(sd, W, H, r)
}

const cache = new WeakMap<Mask, Mask>()

/** The sky `sky` widened by the vegetation before it and the sky seen through that vegetation. Cached per sky mask. */
export function elevationBackground(raster: Raster, sky: Mask): Mask {
  const hit = cache.get(sky)
  if (hit) return hit
  const W = raster.width
  const H = raster.height
  const d = raster.data
  const plant = new Float32Array(W * H)
  for (let i = 0; i < W * H; i += 1) plant[i] = plantColoured(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) ? 1 : 0
  const share = boxMean(plant, W, H, VEGETATION_RADIUS_PX)
  const tex = texture(raster, VEGETATION_RADIUS_PX)
  const fine = texture(raster, 1)
  const out = new Uint8Array(W * H)
  const stack: number[] = []
  for (let i = 0; i < W * H; i += 1) {
    if (sky.data[i] === 1) {
      out[i] = 1
      continue
    }
    const vegetation = tex[i] >= VEGETATION_TEXTURE_MIN && share[i] >= (plant[i] === 1 ? VEGETATION_SHARE_PLANT : VEGETATION_SHARE_OTHER)
    // sky between the leaves: bright and bluish or near-white, among vegetation (a crown's flecks of light)
    const o = i * 4
    const l = luma(d[o], d[o + 1], d[o + 2])
    const light = (d[o + 2] - Math.max(d[o], d[o + 1]) >= SKY_BLUE_MIN && l >= SKY_LUMA_MIN) || (l >= SKY_PALE_LUMA_MIN && Math.max(d[o], d[o + 1], d[o + 2]) - Math.min(d[o], d[o + 1], d[o + 2]) <= SKY_PALE_SPREAD_MAX)
    if (vegetation || (light && share[i] >= VEGETATION_SHARE_PLANT)) {
      out[i] = 1
      stack.push(i)
    }
  }
  const skyish = (i: number): boolean => {
    const o = i * 4
    return d[o + 2] - Math.max(d[o], d[o + 1]) >= SKY_BLUE_MIN && luma(d[o], d[o + 1], d[o + 2]) >= SKY_LUMA_MIN && fine[i] <= SKY_TEXTURE_MAX
  }
  const near = (i: number, j: number): boolean => Math.abs(d[i * 4] - d[j * 4]) <= SKY_STEP && Math.abs(d[i * 4 + 1] - d[j * 4 + 1]) <= SKY_STEP && Math.abs(d[i * 4 + 2] - d[j * 4 + 2]) <= SKY_STEP
  // the sky seen through the vegetation: from the vegetation into smooth bright blue, and on from that sky in small steps
  const isSky = new Uint8Array(W * H)
  while (stack.length > 0) {
    const i = stack.pop() as number
    const x = i % W
    for (const j of [x + 1 < W ? i + 1 : -1, x > 0 ? i - 1 : -1, i + W < W * H ? i + W : -1, i - W]) {
      if (j < 0 || out[j] === 1) continue
      if (isSky[i] === 1 ? !near(i, j) || !(skyish(j) || (luma(d[j * 4], d[j * 4 + 1], d[j * 4 + 2]) >= 200 && fine[j] <= SKY_TEXTURE_MAX)) : !skyish(j)) continue
      out[j] = 1
      isSky[j] = 1
      stack.push(j)
    }
  }
  const mask = { width: W, height: H, data: out } as Mask
  cache.set(sky, mask)
  return mask
}

export type SilhouetteOverBackground = { extent: { x0: number; y0: number; x1: number; y1: number }; why: string }

/** A column belongs to the building where what stands on the ground in it rises at least this share of the tallest. */
export const SILHOUETTE_MIN_HEIGHT_SHARE = 0.25
/** The share of the ground row's height cut off over it before the region is found (paving, a kerb). */
export const SILHOUETTE_GROUND_CUT = 0.03
/** The share of that height a column's top must run solid below it. */
export const SILHOUETTE_SOLID_SHARE = 0.02
/** A step in the top this share of the building's height or more is an edge of a block standing on the roof. */
export const SILHOUETTE_STEP_SHARE = 0.03
/** A block on the roof no wider than this share of the span is a chimney, not the roof. */
export const SILHOUETTE_CHIMNEY_MAX_SHARE = 0.06
/** The width of the running median the top is read through, as a share of the span. */
export const SILHOUETTE_MEDIAN_SHARE = 0.015
/** Columns of the building further apart than this many px are two things, not one. */
export const SILHOUETTE_MAX_GAP_PX = 6

/**
 * The building's outline on a render set before trees, measured against `elevationBackground`: the largest connected
 * region of what is not background above the ground line (`groundRow`, kept from the measured extent) is the building
 * — glazing that mirrors the trees only makes holes in it — and in each column its top is the highest pixel of that
 * region. The building is the run of columns, about the tallest, that rise at least `SILHOUETTE_MIN_HEIGHT_SHARE` of
 * it: a paved strip or a lawn edge along the ground is low and is left out; a chimney or a gable stands on the body and
 * is in.
 */
export function silhouetteOverBackground(raster: Raster, sky: Mask, groundRow: number): SilhouetteOverBackground | undefined {
  const bg = elevationBackground(raster, sky)
  const W = raster.width
  const ground = Math.min(raster.height - 1, Math.round(groundRow))
  // the region is found over the ground line, clear of the paving drawn along it (which joins anything standing on it)
  const base = ground - Math.max(4, Math.round(ground * SILHOUETTE_GROUND_CUT))
  if (base <= 2) return undefined
  // the largest 8-connected region of non-background over the ground line
  const label = new Int32Array(W * (base + 1)).fill(-1)
  const stack: number[] = []
  let best = -1
  let bestSize = 0
  for (let start = 0, id = 0; start < W * (base + 1); start += 1) {
    if (bg.data[start] === 1 || label[start] >= 0) continue
    label[start] = id
    stack.push(start)
    let size = 0
    while (stack.length > 0) {
      const i = stack.pop() as number
      size += 1
      const x = i % W
      const y = (i - x) / W
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= W || ny > base) continue
          const j = ny * W + nx
          if (label[j] >= 0 || bg.data[j] === 1) continue
          label[j] = id
          stack.push(j)
        }
      }
    }
    if (size > bestSize) {
      bestSize = size
      best = id
    }
    id += 1
  }
  if (best < 0) return undefined
  // in each column, the highest row from which the region runs solid for `run` px: a fleck of lit leaf or sky touching
  // an eave is not the top; a chimney is
  const run = Math.max(4, Math.round(base * SILHOUETTE_SOLID_SHARE))
  const top = new Int32Array(W).fill(-1)
  for (let x = 0; x < W; x += 1) {
    let n = 0
    for (let y = base; y >= 0; y -= 1) {
      n = label[y * W + x] === best ? n + 1 : 0
      if (n >= run) top[x] = y
    }
  }
  let tallest = -1
  for (let x = 0; x < W; x += 1) if (top[x] >= 0 && (tallest < 0 || base - top[x] > base - top[tallest])) tallest = x
  if (tallest < 0) return undefined
  const need = (base - top[tallest]) * SILHOUETTE_MIN_HEIGHT_SHARE
  const tall = (x: number): boolean => top[x] >= 0 && base - top[x] >= need
  let x0 = tallest
  let x1 = tallest
  for (let x = tallest, gap = 0; x >= 0; x -= 1) {
    if (tall(x)) {
      x0 = x
      gap = 0
    } else if (++gap > SILHOUETTE_MAX_GAP_PX) break
  }
  for (let x = tallest, gap = 0; x < W; x += 1) {
    if (tall(x)) {
      x1 = x
      gap = 0
    } else if (++gap > SILHOUETTE_MAX_GAP_PX) break
  }
  // the registration hangs the ridge datum from the top: a chimney standing over the ridge is not its top. A chimney
  // is a narrow block — a step up and a step down within `SILHOUETTE_CHIMNEY_MAX_SHARE` of the span; a gable's apex is
  // a slope, never a step, and stays
  const roofTop = Array.from(top)
  const jump = Math.max(4, Math.round((base - top[tallest]) * SILHOUETTE_STEP_SHARE))
  const widest = Math.max(3, Math.round((x1 - x0) * SILHOUETTE_CHIMNEY_MAX_SHARE))
  const chimneys: Array<[number, number]> = []
  for (let a = x0 + 1; a <= x1; a += 1) {
    if (!(roofTop[a - 1] - roofTop[a] >= jump)) continue
    // the block ends where the top comes back down to the roof it stood on (within half a step): the roof's line
    // carried on from the columns before the block — level on a ridge, the rake on a slope
    const k = Math.min(10, a - 1 - x0)
    const slope = k > 0 ? (roofTop[a - 1] - roofTop[a - 1 - k]) / k : 0
    const line = (x: number): number => roofTop[a - 1] + slope * (x - (a - 1))
    for (let b = a; b <= Math.min(x1 - 1, a + widest); b += 1) {
      if (roofTop[b + 1] >= line(b + 1) - jump / 2) {
        for (let x = a; x <= b; x += 1) roofTop[x] = roofTop[a - 1] + ((roofTop[b + 1] - roofTop[a - 1]) * (x - a + 1)) / (b - a + 2)
        chimneys.push([a, b])
        a = b
        break
      }
    }
  }
  // what is left of a crown's flecks along the top is a few columns wide: the top is read through a running median
  // `SILHOUETTE_MEDIAN_SHARE` of the span wide, which a gable's apex survives within a few pixels
  const half = Math.max(1, Math.round(((x1 - x0) * SILHOUETTE_MEDIAN_SHARE) / 2))
  const smooth = (x: number): number => {
    const w: number[] = []
    for (let u = Math.max(x0, x - half); u <= Math.min(x1, x + half); u += 1) if (tall(u)) w.push(roofTop[u])
    w.sort((p, q) => p - q)
    return w.length > 0 ? w[Math.floor(w.length / 2)] : roofTop[x]
  }
  let y0 = base
  for (let x = x0; x <= x1; x += 1) if (tall(x)) y0 = Math.min(y0, Math.round(smooth(x)))
  if (x1 - x0 < 10) return undefined
  return { extent: { x0, y0, x1: x1 + 1, y1: ground }, why: `the silhouette measured against the sky and the vegetation behind it: columns ${x0}..${x1} rise at least ${Math.round(SILHOUETTE_MIN_HEIGHT_SHARE * 100)} % of the tallest from the ground at row ${Math.round(groundRow)}, the top at row ${y0}${chimneys.length > 0 ? ` (${chimneys.length} narrow block${chimneys.length === 1 ? '' : 's'} over the roof, columns ${chimneys.map(([a, b]) => `${a}..${b}`).join(', ')}, taken for chimneys and left out)` : ''}` }
}
