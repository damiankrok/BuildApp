/**
 * N7-P2 (C): the openings an elevation draws, read from the elevation's pixels.
 *
 * `verifyAgainstViews` starts from `building.openings` and asks each view where that opening's sill and head are. That
 * cannot find an opening the model lacks, nor one standing a metre off. Two readers here look at the drawing instead:
 *
 *   - `scanFacadeOpenings` is plan-free: per storey band it learns the wall's materials from the stretches the plan
 *     says are solid, and an opening is a closed blob of what is none of them — an opening's size, not a run of slats,
 *     not a balustrade the model holds there. Bands come from the levels, the span from the walls; no plan opening is
 *     consulted. It is the independent "twin" a correction must agree with.
 *   - `measureOpeningOnView` measures one plan opening's jambs, sill and head on the view, walking out from the plan
 *     gap's middle across columns that are not wall.
 *
 * Pure: pixels and numbers in, readings out. A rejected blob is kept with the reason, so a negative is visible.
 */
import { round6 } from '@buildapp/source-common'
import type { Raster } from '@buildapp/source-cv'
import type { ElevationFrameV2 } from './frame.js'
import type { LevelV2 } from './building.js'
import type { Facade } from './openings-v2.js'
import { elevationExtent, wallAppearanceExtent } from './openings-v2.js'
import type { PixelBox } from './openings-v2.js'

/** How a view was registered: what its readings can be trusted for. */
export type FacadeViewRegistration = 'SILHOUETTE' | 'WALL_BAND' | 'SAME_SHEET' | 'CORNERS_AND_GROUND'

export type FacadeView = {
  frameId: string
  facade: Facade
  view: ElevationFrameV2
  raster: Raster
  registration: FacadeViewRegistration
  /** The view's heights are registered on an independent vertical anchor (the ridge datum and a sound ground). */
  heights: boolean
  /** Registration uncertainty in metres: along the facade, and vertically. */
  alongErrorM: number
  heightErrorM: number
}

export type FacadeOpeningKind = 'WINDOW' | 'DOOR' | 'GLAZED_DOOR'

export type FacadeOpeningReading = {
  id: string
  facade: Facade
  frameId: string
  observationIds: string[]
  /** The storey whose floor the opening stands over; null when it is in the gable over the top storey's walls. */
  storeyIndex: number | null
  from: number
  to: number
  widthM: number
  sillY: number
  headY: number
  kind: FacadeOpeningKind
  /** Mullions between outlines read as one glazing, as fractions of the width. */
  mullions: number[]
  /** It reaches the end of the facade's walls: a corner glazing or a door at the corner. */
  touchesCorner: 'START' | 'END' | null
  uncertaintyM: { along: number; height: number }
  /** Inside against the wall around it: luma difference and the share of glass-coloured pixels. */
  evidence: { contrast: number; glassShare: number; transitionsPerM: number }
  /** Heights are only as good as the view's vertical registration. */
  heightsTrusted: boolean
}

export type FacadeOpeningRejection = { observationIds: string[]; frameId: string; reason: string; box: PixelBox }

/** The sizes an opening comes in. */
export const OPENING_WIDTH_M = { min: 0.3, max: 8 } as const
export const OPENING_HEIGHT_M = { min: 0.35, max: 3.6 } as const
/** This share of an opening's pixels are glass-coloured (cool and darker than the wall). */
export const MIN_GLASS_SHARE = 0.35
/** Slats: more luma steps than this per metre across the inside. A window with mullions has a few. */
export const MAX_TRANSITIONS_PER_M = 7
const rgb = (r: Raster, x: number, y: number): [number, number, number] => {
  const xi = Math.min(r.width - 1, Math.max(0, Math.round(x)))
  const yi = Math.min(r.height - 1, Math.max(0, Math.round(y)))
  const o = (yi * r.width + xi) * 4
  return [r.data[o], r.data[o + 1], r.data[o + 2]]
}
const luma = (c: [number, number, number]): number => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]

/** The inside of a box against a ring of wall around it. */
export function insideEvidence(raster: Raster, box: PixelBox, mpp: number): { contrast: number; glassShare: number; transitionsPerM: number } {
  const w = box.x1 - box.x0
  const h = box.y1 - box.y0
  const ix = Math.max(1, Math.round(w * 0.18))
  const iy = Math.max(1, Math.round(h * 0.18))
  let inSum = 0
  let inN = 0
  const inside: Array<[number, number, number]> = []
  for (let y = box.y0 + iy; y <= box.y1 - iy; y += 1) {
    for (let x = box.x0 + ix; x <= box.x1 - ix; x += 1) {
      const c = rgb(raster, x, y)
      inside.push(c)
      inSum += luma(c)
      inN += 1
    }
  }
  const ring = Math.max(3, Math.round(Math.min(w, h) * 0.2))
  let outSum = 0
  let outN = 0
  const sample = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= raster.width || y >= raster.height) return
    outSum += luma(rgb(raster, x, y))
    outN += 1
  }
  for (let x = box.x0 - ring; x <= box.x1 + ring; x += 1) {
    sample(x, box.y0 - ring)
    sample(x, box.y1 + ring)
  }
  for (let y = box.y0; y <= box.y1; y += 1) {
    sample(box.x0 - ring, y)
    sample(box.x1 + ring, y)
  }
  const inMean = inN > 0 ? inSum / inN : 0
  const outMean = outN > 0 ? outSum / outN : inMean
  // glass: cooler than neutral (blue at least red) and darker than the wall around it
  const glass = inside.filter((c) => c[2] >= c[0] - 4 && luma(c) < outMean - 10).length
  // luma steps across the middle rows, per metre of width
  let steps = 0
  let rows = 0
  for (const fy of [0.35, 0.5, 0.65]) {
    const y = Math.round(box.y0 + fy * h)
    let prev = luma(rgb(raster, box.x0 + ix, y))
    let rising = 0
    for (let x = box.x0 + ix + 1; x <= box.x1 - ix; x += 1) {
      const l = luma(rgb(raster, x, y))
      const d = l - prev
      const dir = d > 22 ? 1 : d < -22 ? -1 : 0
      if (dir !== 0 && dir !== rising) {
        steps += 1
        rising = dir
      }
      prev = l
    }
    rows += 1
  }
  const innerWidthM = Math.max(0.05, (w - 2 * ix) * mpp)
  return { contrast: round6(Math.abs(inMean - outMean)), glassShare: round6(inN > 0 ? glass / inN : 0), transitionsPerM: round6(steps / rows / innerWidthM) }
}

export type FacadeReadingContext = {
  /** The facade's walls along it, per storey (the plan's span of the bodies on this side). */
  wallSpan: { from: number; to: number }
  levels: readonly LevelV2[]
  /** The top of the facade's walls; a gable may hold openings above it, up to the ridge. */
  wallTopY: number
  ridgeY?: number
  /** Railings the model holds on this facade, in its frame: a balustrade panel is not a window. */
  railings: ReadonlyArray<{ from: number; to: number; baseY: number; topY: number }>
}

// ---------------------------------------------------------------------------
// The model-free scan: wall materials learnt per storey band, openings as what is none of them
// ---------------------------------------------------------------------------

/** A material is a colour that runs uninterrupted this far, horizontally or vertically (plaster, a board, a plinth) … */
export const MATERIAL_RUN_M = 0.45
/** … over at least this share of the band's pixels. */
export const MATERIAL_MIN_SHARE = 0.05
/** A pixel within this many levels on every channel of a material's colour is that material. */
export const MATERIAL_MATCH = 20
/** The foreign mask is closed over this radius before its blobs are taken (a frame bar, a slat, a highlight). */
export const CLOSE_M = 0.06
/** A row of the closed mask foreign over this share of the facade's width is a line of the building, cut before the blobs. */
export const FULL_ROW_SHARE = 0.7
/** A blob filling less of its box than this is texture or a shadow, not an opening. */
export const MIN_BLOB_FILL = 0.55
export type FacadeBand = {
  storeyIndex: number
  floorY: number
  topY: number
  /** For a gable, the top of the wall at a point along the facade (the roof's underside); absent: `topY` everywhere. */
  topAt?: (along: number) => number
  /** The stretches along the facade where a body has this storey, each with the top of its walls there. */
  covers?: ReadonlyArray<{ from: number; to: number; topY: number }>
  /**
   * Where the plan draws solid wall on this storey of this facade: the wall's appearance is learnt there. The openings
   * are then read from the pixels across the whole band, so a gap the plan places wrongly still shows as a difference.
   */
  solids?: ReadonlyArray<[number, number]>
}

/** The plan's solid stretches narrower than this are piers and jambs: too little wall to learn from. */
export const SOLID_SAMPLE_MIN_M = 0.3
/** A colour (16 levels a channel) holding this share of the solid wall's pixels is one of its materials. */
export const SOLID_MATERIAL_SHARE = 0.03

/** A run of one colour, within `MATERIAL_MATCH` of where it started. */
type ColourRun = { n: number; r: number; g: number; b: number }

/**
 * The band's pixels that are none of its materials (and not sky), as a mask over the raster, and the materials learnt.
 * A material is a colour that runs long — across a row (plaster, a plinth) or down a column (a board of cladding) —
 * within a tolerance of where the run began; runs are pooled into colours, and a colour holding enough of the band is
 * a material. Glass and a door leaf rarely run that far in one colour; where they do (a plain dark leaf), they are wall
 * here, and the plan's gap is then reported unseen rather than invented.
 */
export function foreignMask(raster: Raster, fv: FacadeView, band: FacadeBand, span: { from: number; to: number }, sky?: { data: Uint8Array; width: number }): { mask: Uint8Array; materials: Array<[number, number, number]>; cols: [number, number]; rows: [number, number]; inBand: (x: number, y: number) => boolean } {
  const v = fv.view
  const mpp = Math.abs(v.alongOf(1) - v.alongOf(0))
  const c0 = Math.max(0, Math.ceil(Math.min(v.pxOf(span.from), v.pxOf(span.to))) + 1)
  const c1 = Math.min(raster.width - 1, Math.floor(Math.max(v.pxOf(span.from), v.pxOf(span.to))) - 1)
  const top = Math.max(band.topY, ...(band.covers ?? []).map((c) => c.topY))
  const r0 = Math.max(0, Math.ceil(v.pyOf(top)))
  const r1 = Math.min(raster.height - 1, Math.floor(v.pyOf(band.floorY)))
  const mask = new Uint8Array(raster.width * raster.height)
  const colTop = new Float64Array(raster.width).fill(Infinity)
  for (let x = c0; x <= c1; x += 1) {
    const a = v.alongOf(x + 0.5)
    const cover = band.covers ? band.covers.find((c) => a >= c.from && a <= c.to) : { topY: band.topY }
    if (!cover) continue
    const t = Math.min(cover.topY, band.topAt ? band.topAt(a) : cover.topY)
    colTop[x] = v.pyOf(t)
  }
  const inBand = (x: number, y: number): boolean => x >= c0 && x <= c1 && y >= r0 && y <= r1 && y >= colTop[x] && !(sky && sky.data[y * sky.width + x])
  if (c1 - c0 < 4 || r1 - r0 < 4) return { mask, materials: [], cols: [c0, c1], rows: [r0, r1], inBand }
  const d = raster.data
  const close = (o: number, c: [number, number, number]): boolean => Math.abs(d[o] - c[0]) <= MATERIAL_MATCH && Math.abs(d[o + 1] - c[1]) <= MATERIAL_MATCH && Math.abs(d[o + 2] - c[2]) <= MATERIAL_MATCH
  const runPx = Math.max(3, Math.round(MATERIAL_RUN_M / mpp))
  const vRun = Math.max(3, Math.min(runPx, Math.round((r1 - r0) * 0.4)))
  const runsFound: ColourRun[] = []
  const scan = (len: number, at: (i: number) => [number, number], min: number): void => {
    let i = 0
    while (i < len) {
      const [x, y] = at(i)
      if (!inBand(x, y)) {
        i += 1
        continue
      }
      const o = (y * raster.width + x) * 4
      const seed: [number, number, number] = [d[o], d[o + 1], d[o + 2]]
      const run: ColourRun = { n: 0, r: 0, g: 0, b: 0 }
      let j = i
      while (j < len) {
        const [xj, yj] = at(j)
        const oj = (yj * raster.width + xj) * 4
        if (!inBand(xj, yj) || !close(oj, seed)) break
        run.n += 1
        run.r += d[oj]
        run.g += d[oj + 1]
        run.b += d[oj + 2]
        j += 1
      }
      if (run.n >= min) runsFound.push(run)
      i = Math.max(j, i + 1)
    }
  }
  let materials: Array<[number, number, number]> = []
  // the plan's solid wall: its colours, each holding enough of it, are the band's materials
  const trim = Math.max(2, Math.round(0.05 / mpp))
  const solidCols: Array<[number, number]> = (band.solids ?? [])
    .filter(([a, b]) => Math.abs(b - a) >= SOLID_SAMPLE_MIN_M)
    .map(([a, b]) => [Math.max(c0, Math.round(Math.min(v.pxOf(a), v.pxOf(b))) + trim), Math.min(c1, Math.round(Math.max(v.pxOf(a), v.pxOf(b))) - trim)] as [number, number])
    .filter(([a, b]) => b > a)
  if (solidCols.length > 0) {
    const bins = new Map<number, { n: number; r: number; g: number; b: number }>()
    let n = 0
    for (const [a, b] of solidCols) {
      for (let x = a; x <= b; x += 1) {
        for (let y = r0; y <= r1; y += 1) {
          if (!inBand(x, y)) continue
          const o = (y * raster.width + x) * 4
          const k = ((d[o] >> 4) << 8) | ((d[o + 1] >> 4) << 4) | (d[o + 2] >> 4)
          const e = bins.get(k) ?? { n: 0, r: 0, g: 0, b: 0 }
          e.n += 1
          e.r += d[o]
          e.g += d[o + 1]
          e.b += d[o + 2]
          bins.set(k, e)
          n += 1
        }
      }
    }
    // a material is a family of near colours (a board's grain, plaster in shade): bins pooled with the largest near them
    const clusters: Array<{ seed: [number, number, number]; n: number; members: Array<[number, number, number]> }> = []
    for (const [, e] of [...bins.entries()].sort((p, q) => q[1].n - p[1].n || p[0] - q[0])) {
      const c: [number, number, number] = [e.r / e.n, e.g / e.n, e.b / e.n]
      const host = clusters.find((k) => Math.abs(k.seed[0] - c[0]) <= MATERIAL_MATCH && Math.abs(k.seed[1] - c[1]) <= MATERIAL_MATCH && Math.abs(k.seed[2] - c[2]) <= MATERIAL_MATCH)
      if (host) {
        host.n += e.n
        if (e.n >= 0.002 * n) host.members.push(c)
      } else clusters.push({ seed: c, n: e.n, members: [c] })
    }
    materials = clusters
      .filter((k) => k.n >= SOLID_MATERIAL_SHARE * n)
      .sort((p, q) => q.n - p.n)
      .slice(0, 8)
      .flatMap((k) => k.members)
  }
  if (materials.length === 0) {
    // no solid stretch to learn from: the colours that run long across the band
    let total = 0
    for (let y = r0; y <= r1; y += 1) {
      scan(c1 - c0 + 1, (i) => [c0 + i, y], runPx)
      for (let x = c0; x <= c1; x += 1) if (inBand(x, y)) total += 1
    }
    for (let x = c0; x <= c1; x += 1) scan(r1 - r0 + 1, (i) => [x, r0 + i], vRun)
    const pools: Array<{ n: number; c: [number, number, number] }> = []
    for (const run of runsFound.sort((a, b) => b.n - a.n)) {
      const c: [number, number, number] = [run.r / run.n, run.g / run.n, run.b / run.n]
      const p = pools.find((q) => Math.abs(q.c[0] - c[0]) <= MATERIAL_MATCH && Math.abs(q.c[1] - c[1]) <= MATERIAL_MATCH && Math.abs(q.c[2] - c[2]) <= MATERIAL_MATCH)
      if (p) p.n += run.n
      else pools.push({ n: run.n, c })
    }
    materials = pools.filter((p) => p.n >= MATERIAL_MIN_SHARE * Math.max(1, total)).sort((a, b) => b.n - a.n).slice(0, 8).map((p) => p.c)
  }
  for (let y = r0; y <= r1; y += 1) {
    for (let x = c0; x <= c1; x += 1) {
      if (!inBand(x, y)) continue
      const o = (y * raster.width + x) * 4
      if (!materials.some((m) => close(o, m))) mask[y * raster.width + x] = 1
    }
  }
  return { mask, materials, cols: [c0, c1], rows: [r0, r1], inBand }
}

/**
 * Scan one registered view for openings, storey band by storey band, from its pixels alone: the band's materials are
 * learnt where they run long (`foreignMask`), and an opening is a stretch of columns mostly none of them, closed above
 * and below by them. The plan's openings are not consulted; the bands come from the levels, the span from the walls.
 */
export function scanFacadeOpenings(fv: FacadeView, bands: readonly FacadeBand[], ctx: FacadeReadingContext, sky?: { data: Uint8Array; width: number }, maskSink?: (mask: Uint8Array, closed: Uint8Array, box: { c0: number; r0: number; W: number; H: number }) => void): { readings: FacadeOpeningReading[]; rejected: FacadeOpeningRejection[]; foreignShare: (storeyIndex: number, from: number, to: number) => number | undefined } {
  const v = fv.view
  const raster = fv.raster
  const mpp = Math.abs(v.alongOf(1) - v.alongOf(0))
  const readings: FacadeOpeningReading[] = []
  const rejected: FacadeOpeningRejection[] = []
  const shares = new Map<number, (from: number, to: number) => number | undefined>()
  for (const band of bands) {
    const { mask, materials, cols, rows, inBand } = foreignMask(raster, fv, band, ctx.wallSpan, sky)
    const [c0, c1] = cols
    const [r0, r1] = rows
    if (c1 - c0 < 4 || r1 - r0 < 4) continue
    // the share of a stretch's pixels, over the band, that are none of the wall's materials (undefined: none learnt)
    if (materials.length > 0) shares.set(band.storeyIndex, (from, to) => {
      const xa = Math.max(c0, Math.round(Math.min(v.pxOf(from), v.pxOf(to))))
      const xb = Math.min(c1, Math.round(Math.max(v.pxOf(from), v.pxOf(to))))
      let n = 0
      let m = 0
      for (let x = xa; x <= xb; x += 1) for (let y = r0; y <= r1; y += 1) {
        if (!inBand(x, y)) continue
        m += 1
        if (mask[y * raster.width + x]) n += 1
      }
      return m >= 20 ? n / m : undefined
    })
    const colShare = (x: number): number => {
      let n = 0
      let m = 0
      for (let y = r0; y <= r1; y += 1) {
        if (!inBand(x, y)) continue
        m += 1
        if (mask[y * raster.width + x]) n += 1
      }
      return m >= 3 ? n / m : 0
    }
    // close the mask (a frame bar, a blind's slat, a reflection's highlight) and take its connected blobs
    const W = c1 - c0 + 1
    const H = r1 - r0 + 1
    const rad = Math.max(1, Math.round(CLOSE_M / mpp))
    const at = (x: number, y: number): number => mask[(r0 + y) * raster.width + (c0 + x)]
    const dil = new Uint8Array(W * H)
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
      if (!at(x, y)) continue
      for (let dy = -rad; dy <= rad; dy += 1) for (let dx = -rad; dx <= rad; dx += 1) {
        const xx = x + dx
        const yy = y + dy
        if (xx >= 0 && yy >= 0 && xx < W && yy < H) dil[yy * W + xx] = 1
      }
    }
    const closed = new Uint8Array(W * H)
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
      if (!inBand(c0 + x, r0 + y)) continue
      let all = 1
      for (let dy = -rad; dy <= rad && all; dy += 1) for (let dx = -rad; dx <= rad; dx += 1) {
        const xx = x + dx
        const yy = y + dy
        if (xx >= 0 && yy >= 0 && xx < W && yy < H && !dil[yy * W + xx]) {
          all = 0
          break
        }
      }
      closed[y * W + x] = all
    }
    // a row foreign across most of the facade is a line of the building (a slab's edge, the eaves' shadow, a plinth),
    // not an opening: cut it, so it does not join the openings it passes
    for (let y = 0; y < H; y += 1) {
      let n = 0
      let m = 0
      for (let x = 0; x < W; x += 1) {
        if (!inBand(c0 + x, r0 + y)) continue
        m += 1
        if (closed[y * W + x]) n += 1
      }
      if (m > 0 && n / m >= FULL_ROW_SHARE && m * mpp > 2 * OPENING_WIDTH_M.min) for (let x = 0; x < W; x += 1) closed[y * W + x] = 0
    }
    maskSink?.(mask, closed, { c0, r0, W, H })
    const label = new Int32Array(W * H).fill(-1)
    const blobs: Array<{ x0: number; y0: number; x1: number; y1: number; n: number }> = []
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
      if (!closed[y * W + x] || label[y * W + x] >= 0) continue
      const id = blobs.length
      const b = { x0: x, y0: y, x1: x, y1: y, n: 0 }
      const stack = [y * W + x]
      label[y * W + x] = id
      while (stack.length > 0) {
        const k = stack.pop() as number
        const kx = k % W
        const ky = (k - kx) / W
        b.n += 1
        if (kx < b.x0) b.x0 = kx
        if (kx > b.x1) b.x1 = kx
        if (ky < b.y0) b.y0 = ky
        if (ky > b.y1) b.y1 = ky
        for (const [nx, ny] of [[kx + 1, ky], [kx - 1, ky], [kx, ky + 1], [kx, ky - 1]]) {
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
          const q = ny * W + nx
          if (closed[q] && label[q] < 0) {
            label[q] = id
            stack.push(q)
          }
        }
      }
      blobs.push(b)
    }
    for (const bl of blobs) {
      const box = { x0: c0 + bl.x0, y0: r0 + bl.y0, x1: c0 + bl.x1, y1: r0 + bl.y1 }
      const wPx = bl.x1 - bl.x0 + 1
      const hPx = bl.y1 - bl.y0 + 1
      if (wPx * mpp < OPENING_WIDTH_M.min || hPx * mpp < OPENING_HEIGHT_M.min) continue
      const fill = bl.n / (wPx * hPx)
      if (fill < MIN_BLOB_FILL) {
        rejected.push({ observationIds: [], frameId: fv.frameId, reason: `a ragged foreign area (${(fill * 100).toFixed(0)} % of its box): texture or a shadow, not an opening`, box })
        continue
      }
      const a = v.alongOf(box.x0)
      const b = v.alongOf(box.x1 + 1)
      const from = round6(Math.min(a, b))
      const to = round6(Math.max(a, b))
      let sillY = round6(v.yOf(box.y1 + 1))
      const headY = round6(v.yOf(box.y0))
      if (Math.abs(sillY - band.floorY) <= 0.15) sillY = round6(band.floorY)
      const w = to - from
      const h = headY - sillY
      if (w > OPENING_WIDTH_M.max || h > OPENING_HEIGHT_M.max || h < OPENING_HEIGHT_M.min) {
        rejected.push({ observationIds: [], frameId: fv.frameId, reason: `not an opening's size: ${w.toFixed(2)} × ${h.toFixed(2)} m`, box })
        continue
      }
      const ev = insideEvidence(raster, box, mpp)
      if (ev.transitionsPerM > MAX_TRANSITIONS_PER_M && w > 0.8 && ev.glassShare < MIN_GLASS_SHARE) {
        rejected.push({ observationIds: [], frameId: fv.frameId, reason: `a run of slats, not glazing: ${ev.transitionsPerM.toFixed(1)} luma steps per metre across it`, box })
        continue
      }
      const railing = ctx.railings.find((r) => Math.min(to, r.to) - Math.max(from, r.from) > 0.6 * w && Math.abs(sillY - r.baseY) <= 0.2 && Math.abs(headY - r.topY) <= 0.2)
      if (railing) {
        rejected.push({ observationIds: [], frameId: fv.frameId, reason: `a balustrade panel: ${sillY.toFixed(2)}..${headY.toFixed(2)} m where the model holds a railing ${railing.baseY.toFixed(2)}..${railing.topY.toFixed(2)} m`, box })
        continue
      }
      const atFloor = Math.abs(sillY - band.floorY) <= 0.15 && h >= 1.8
      const glassy = ev.glassShare >= MIN_GLASS_SHARE
      readings.push({
        id: '',
        facade: fv.facade,
        frameId: fv.frameId,
        observationIds: [],
        storeyIndex: band.storeyIndex,
        from,
        to,
        widthM: round6(w),
        sillY,
        headY,
        kind: atFloor ? (glassy || w >= 1.6 ? 'GLAZED_DOOR' : 'DOOR') : 'WINDOW',
        mullions: [],
        touchesCorner: from - ctx.wallSpan.from <= 0.25 ? 'START' : ctx.wallSpan.to - to <= 0.25 ? 'END' : null,
        uncertaintyM: { along: round6(fv.alongErrorM + 2 * mpp), height: round6(fv.heightErrorM + 2 * mpp) },
        evidence: ev,
        heightsTrusted: fv.heights,
      })
    }
  }
  readings.sort((p, q) => p.from - q.from || p.sillY - q.sillY)
  readings.forEach((r, k) => (r.id = `fo-${fv.facade.toLowerCase()}-${k}`))
  return { readings, rejected, foreignShare: (storeyIndex, from, to) => shares.get(storeyIndex)?.(from, to) }
}

// ---------------------------------------------------------------------------
// Measuring one plan opening on a view: the plan says where to look, the pixels say where its edges are
// ---------------------------------------------------------------------------

/** How far past the plan's gap the edges are looked for, each side. */
export const EDGE_SEARCH_M = 0.6
/** A column of the opening's rows this unlike the wall belongs to the opening. */
export const EDGE_COLUMN_SHARE = 0.5
/** Wall-like columns inside an opening (a mullion, a frame bar) are crossed up to this width. */
export const EDGE_BRIDGE_M = 0.12

export type OpeningMeasurement = {
  from: number
  to: number
  sillY: number
  headY: number
  /** How the vertical extent was read, and the share of the opening's rows unlike the wall. */
  how: string
  share: number
}

/**
 * The opening a view draws where the plan puts a gap: its sill and head as the existing readers read them
 * (`wallAppearanceExtent`, else `elevationExtent`), then its two jambs, walked outward from the gap's middle across the
 * columns that are unlike the wall in the opening's rows, the wall's look learnt row by row from the plan's solid
 * stretches beside it. The plan's interval only says where to start: an edge may land past it or short of it, and that
 * difference is the measurement. Null when no opening is read there.
 */
export function measureOpeningOnView(raster: Raster, view: ElevationFrameV2, interval: [number, number], solids: ReadonlyArray<[number, number]>, floorY: number, topY: number): OpeningMeasurement | null {
  const vertical = wallAppearanceExtent(raster, view, interval, solids, floorY, topY) ?? elevationExtent(raster, view, interval, floorY, topY - floorY)
  if (!vertical || vertical.headY - vertical.sillY < OPENING_HEIGHT_M.min) return null
  const mpp = Math.abs(view.alongOf(1) - view.alongOf(0))
  const h = vertical.headY - vertical.sillY
  const y0 = Math.max(0, Math.round(view.pyOf(vertical.headY - 0.15 * h)))
  const y1 = Math.min(raster.height - 1, Math.round(view.pyOf(vertical.sillY + 0.15 * h)))
  if (y1 - y0 < 2) return null
  // the solid stretches either side of the gap, nearest first: the wall the jambs stand in
  const mid = (interval[0] + interval[1]) / 2
  const near = solids.filter(([a, b]) => Math.abs(b - a) >= SOLID_SAMPLE_MIN_M && Math.min(Math.abs(a - mid), Math.abs(b - mid)) <= Math.abs(interval[1] - interval[0]) / 2 + 2)
  if (near.length === 0) return null
  const trim = Math.max(2, Math.round(0.05 / mpp))
  const cols = (a: number, b: number): [number, number] => [Math.round(Math.min(view.pxOf(a), view.pxOf(b))) + trim, Math.round(Math.max(view.pxOf(a), view.pxOf(b))) - trim]
  const samples = near.map(([a, b]) => cols(a, b)).filter(([a, b]) => b > a).map(([a, b]) => [Math.max(0, a), Math.min(raster.width - 1, b)] as [number, number])
  if (samples.length === 0) return null
  const d = raster.data
  const rgb = (x: number, y: number): [number, number, number] => {
    const o = (y * raster.width + x) * 4
    return [d[o], d[o + 1], d[o + 2]]
  }
  const median = (v: number[]): number => [...v].sort((p, q) => p - q)[v.length >> 1]
  const wallsOf: Array<Array<{ c: [number, number, number]; tol: number }>> = []
  for (let y = y0; y <= y1; y += 1) {
    const walls: Array<{ c: [number, number, number]; tol: number }> = []
    for (const [s0, s1] of samples) {
      const px: Array<[number, number, number]> = []
      for (let x = s0; x <= s1; x += 1) px.push(rgb(x, y))
      const c: [number, number, number] = [median(px.map((p) => p[0])), median(px.map((p) => p[1])), median(px.map((p) => p[2]))]
      const spread = median(px.map((p) => Math.abs(p[0] - c[0]) + Math.abs(p[1] - c[1]) + Math.abs(p[2] - c[2])))
      if (spread <= 24) walls.push({ c, tol: Math.max(18, 3 * spread) })
    }
    wallsOf.push(walls)
  }
  const foreignShare = (x: number): number => {
    if (x < 0 || x >= raster.width) return 0
    let n = 0
    let m = 0
    for (let y = y0; y <= y1; y += 1) {
      const walls = wallsOf[y - y0]
      if (walls.length === 0) continue
      m += 1
      const p = rgb(x, y)
      if (!walls.some((w) => Math.abs(p[0] - w.c[0]) + Math.abs(p[1] - w.c[1]) + Math.abs(p[2] - w.c[2]) < w.tol)) n += 1
    }
    return m > 0 ? n / m : 0
  }
  const pxMid = Math.round(view.pxOf(mid))
  const span = Math.abs(view.pxOf(interval[1]) - view.pxOf(interval[0]))
  const reach = Math.round(span / 2 + EDGE_SEARCH_M / mpp)
  const bridge = Math.max(1, Math.round(EDGE_BRIDGE_M / mpp))
  const walk = (dir: 1 | -1): number => {
    let last = pxMid
    let wallRun = 0
    for (let k = 0; k <= reach; k += 1) {
      const x = pxMid + dir * k
      if (foreignShare(x) >= EDGE_COLUMN_SHARE) {
        last = x
        wallRun = 0
      } else if (++wallRun > bridge) break
    }
    return last
  }
  const left = walk(-1)
  const right = walk(1)
  if (right - left + 1 < OPENING_WIDTH_M.min / mpp) return null
  const a = view.alongOf(left)
  const b = view.alongOf(right + 1)
  return { from: round6(Math.min(a, b)), to: round6(Math.max(a, b)), sillY: vertical.sillY, headY: vertical.headY, how: vertical.why, share: vertical.share }
}
