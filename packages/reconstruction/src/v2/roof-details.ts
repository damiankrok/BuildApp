/**
 * Roof v2 details (§18): the attached body's roof from the section, chimneys
 * from the plans and the renders, rooflights from the renders.
 *
 * None of this is a convention. A flat roof's height is where the section
 * draws its slab; a parapet is the wall that continues above it; a chimney is
 * a solid block that stands on both storeys' plans in the same place and
 * rises above the roof line on a render; a rooflight is a patch in the roof
 * plane of a side render whose tone is not the covering's, of a size a
 * rooflight is. Each carries the views it was read from, and what it lacks.
 */
import { round6 } from '@buildapp/source-common'
import type { Raster } from '@buildapp/source-cv'
import type { ElevationFrameV2 } from './frame.js'
import { inkRuns, lumaAt, mergeRuns, toneClass, rgbAt } from './scan.js'
import type { SolidBlock } from './interior.js'

export type SectionFrame = {
  frameId: string
  /** Metres per pixel, and the pixel row of y = 0. */
  mpp: number
  zeroRow: number
  /** The pixel column of world x = 0, when the section is a cross-section along x (or z = 0 when along z). */
  originCol: number
  axis: 'X' | 'Z'
  yOf: (py: number) => number
  alongOf: (px: number) => number
  pxOf: (along: number) => number
  pyOf: (y: number) => number
}

/**
 * Register a section by its wall columns: the outermost long vertical
 * wall-thick bands are the outer faces of the body it cuts, and they are
 * matched to the envelope span whose length they fit.
 */
export function registerSection(raster: Raster, mppHint: number, zeroRow: number, spans: Array<{ axis: 'X' | 'Z'; from: number; to: number }>, frameId: string, ridgeY?: number): SectionFrame | undefined {
  let mpp = mppHint
  // Columns with long runs of dark ink: walls.
  const w = raster.width
  const h = raster.height
  const long: number[] = []
  for (let x = 0; x < w; x += 1) {
    let best = 0
    let run = 0
    for (let y = 0; y < h; y += 1) {
      if (lumaAt(raster, x, y) < 90) run += 1
      else run = 0
      if (run > best) best = run
    }
    if (best >= 1.8 / mpp) long.push(x)
  }
  if (long.length < 2) return undefined
  const runs = mergeRuns(long.map((x) => ({ from: x, to: x })), 2).filter((r) => r.to - r.from + 1 >= 0.15 / mpp)
  if (runs.length < 2) return undefined
  const left = runs[0].from
  const right = runs[runs.length - 1].to + 1
  const widthM = (right - left) * mpp
  const match = spans.map((s) => ({ s, err: Math.abs(s.to - s.from - widthM) })).sort((a, b) => a.err - b.err)[0]
  if (!match || match.err > 0.6) return undefined
  // The scale is the span the walls were matched to over the pixels between
  // them: a sheet is isotropic, and the ladder's own scale (fitted through a
  // few small labels) is kept only as the hint that chose the span.
  mpp = match.s.to - match.s.from > 0 ? (match.s.to - match.s.from) / (right - left) : mpp
  void ridgeY
  const originCol = left - match.s.from / mpp
  return {
    frameId,
    mpp,
    zeroRow,
    originCol: round6(originCol),
    axis: match.s.axis,
    yOf: (py) => round6((zeroRow - py) * mpp),
    alongOf: (px) => round6((px - originCol) * mpp),
    pxOf: (along) => round6(originCol + along / mpp),
    pyOf: (y) => round6(zeroRow - y / mpp),
  }
}

export type AttachedRoofReading = {
  massId: string
  slabTopY: number
  slabSoffitY: number
  /** The top of the wall that continues above the slab, when one does. */
  parapetTopY?: number
  clearHeightM: number
  confidence: number
  why: string
}

/**
 * A flat roof over an attached body as the section draws it: the topmost
 * horizontal thick band across the body's span, and the wall that stands
 * above it at the outer end.
 */
export function readAttachedRoof(raster: Raster, section: SectionFrame, massId: string, span: { from: number; to: number }, floorY: number, maxY: number): AttachedRoofReading | undefined {
  const c0 = section.pxOf(span.from)
  const c1 = section.pxOf(span.to)
  const from = Math.min(c0, c1)
  const to = Math.max(c0, c1)
  // Sample columns through the middle 60 % of the span, avoiding the walls.
  const cols: number[] = []
  for (let f = 0.25; f <= 0.75; f += 0.1) cols.push(round6(from + (to - from) * f))
  const bands: Array<{ top: number; bottom: number }> = []
  const rowTop = section.pyOf(maxY)
  const rowBottom = section.pyOf(floorY + 0.3)
  for (const x of cols) {
    const runs = inkRuns(raster, 'Y', x, Math.min(rowTop, rowBottom), Math.max(rowTop, rowBottom), 100, Math.max(3, Math.round(0.12 / section.mpp)))
    // The highest run thick enough to be a slab.
    const slab = runs.filter((r) => (r.to - r.from + 1) * section.mpp >= 0.15 && (r.to - r.from + 1) * section.mpp <= 0.6).sort((a, b) => a.from - b.from)[0]
    if (slab) bands.push({ top: slab.from, bottom: slab.to })
  }
  if (bands.length < 3) return undefined
  const top = median(bands.map((b) => b.top))
  const bottom = median(bands.map((b) => b.bottom))
  const slabTopY = section.yOf(top)
  const slabSoffitY = section.yOf(bottom + 1)
  // Parapet: at the outer end wall's columns, does the wall continue above
  // the slab top? A hatched wall is read by the share of its columns that are
  // ink on each row, not by one pixel.
  const outerCol = Math.abs(c1 - section.pxOf(0)) > Math.abs(c0 - section.pxOf(0)) ? c1 : c0
  const inward = outerCol === c1 ? -1 : 1
  const wallCols: number[] = []
  for (let d = 0.03; d <= 0.4; d += 0.03) wallCols.push(Math.round(outerCol + (inward * d) / section.mpp))
  let parapetTopY: number | undefined
  let y = top - 1
  while (y > 0) {
    let dark = 0
    for (const x of wallCols) if (lumaAt(raster, x, y) < 130) dark += 1
    if (dark / wallCols.length < 0.35) break
    y -= 1
  }
  const above = (top - 1 - y) * section.mpp
  if (above >= 0.08) parapetTopY = section.yOf(y + 1)
  return {
    massId,
    slabTopY: round6(slabTopY),
    slabSoffitY: round6(slabSoffitY),
    parapetTopY: parapetTopY === undefined ? undefined : round6(parapetTopY),
    clearHeightM: round6(slabSoffitY - floorY),
    confidence: 0.75,
    why: `the section draws a ${((bottom - top + 1) * section.mpp).toFixed(2)} m slab with its top at ${slabTopY.toFixed(2)} over this body on ${bands.length} columns${parapetTopY !== undefined ? ` and its outer wall continues to ${parapetTopY.toFixed(2)}` : ''}`,
  }
}

export type ChimneyReading = {
  id: string
  x0: number
  z0: number
  x1: number
  z1: number
  topY?: number
  storeysSeen: number[]
  renderFrames: string[]
  confidence: number
  why: string
}

/**
 * Chimneys: solid blocks that stand on the same plan position on every storey
 * that has a plan, and rise above the roof line on a render whose columns
 * cover them.
 */
export function readChimneys(blocksByStorey: ReadonlyArray<{ storeyIndex: number; blocks: readonly SolidBlock[] }>, views: ReadonlyArray<{ view: ElevationFrameV2; raster: Raster }>, roofTopY: (x: number, z: number) => number): ChimneyReading[] {
  const top = blocksByStorey.reduce((a, b) => (b.storeyIndex > a.storeyIndex ? b : a), blocksByStorey[0])
  if (!top) return []
  const out: ChimneyReading[] = []
  for (const block of top.blocks) {
    const cx = (block.x0 + block.x1) / 2
    const cz = (block.z0 + block.z1) / 2
    const storeysSeen = blocksByStorey.filter((s) => s.blocks.some((b) => Math.abs((b.x0 + b.x1) / 2 - cx) < 0.35 && Math.abs((b.z0 + b.z1) / 2 - cz) < 0.35)).map((s) => s.storeyIndex)
    // On a render of a facade: the column over the block's centre, above the roof plane.
    const renderFrames: string[] = []
    let topY: number | undefined
    for (const { view, raster } of views) {
      const along = view.side === 'FRONT' || view.side === 'REAR' ? cx : cz
      const px = view.pxOf(along)
      const roofY = roofTopY(cx, cz)
      const yStart = view.pyOf(roofY + 0.15)
      const yEnd = view.pyOf(roofY + 3.0)
      // Dark, neutral column straight up from the roof line.
      let y = yStart
      let count = 0
      while (y > yEnd) {
        const t = toneClass(rgbAt(raster, px, y))
        if (t === 'DARK' || t === 'MID') count += 1
        else break
        y -= 1
      }
      const heightM = count * view.registration.metresPerPixelV
      if (heightM >= 0.4) {
        renderFrames.push(view.registration.frameId)
        const yTop = view.yOf(y + 1)
        topY = topY === undefined ? yTop : (topY + yTop) / 2
      }
    }
    if (storeysSeen.length < Math.min(2, blocksByStorey.length) && renderFrames.length === 0) continue
    out.push({
      id: `chimney-${out.length}`,
      x0: block.x0,
      z0: block.z0,
      x1: block.x1,
      z1: block.z1,
      topY: topY === undefined ? undefined : round6(topY),
      storeysSeen,
      renderFrames,
      confidence: round6(Math.min(0.9, 0.4 + 0.2 * storeysSeen.length + 0.15 * renderFrames.length)),
      why: `a ${(block.x1 - block.x0).toFixed(2)} × ${(block.z1 - block.z0).toFixed(2)} m solid block drawn on storey${storeysSeen.length === 1 ? '' : 's'} ${storeysSeen.join(', ')}${renderFrames.length > 0 ? `, standing ${topY?.toFixed(2)} m tall on ${renderFrames.length} render${renderFrames.length === 1 ? '' : 's'}` : ', not seen above the roof on any render'}`,
    })
  }
  return out
}

export type RooflightReading = {
  id: string
  slope: 'LOW' | 'HIGH'
  /** Along the ridge (z for a ridge along z), and up the slope in plan (x for a ridge along z). */
  alongFrom: number
  alongTo: number
  slopeFrom: number
  slopeTo: number
  yFrom: number
  yTo: number
  frameId: string
  confidence: number
  why: string
}

/**
 * Rooflights on a side render: patches in the roof plane that are markedly
 * LIGHTER than the covering around them — glass reflecting the sky against
 * tiles — of a rooflight's size, not touching the roof region's edges. A
 * chimney is darker than the covering and never qualifies; the caller also
 * removes patches that overlap a chimney's plan position.
 */
export function readRooflights(view: ElevationFrameV2, raster: Raster, roof: { eaveY: number; ridgeY: number; pitchDeg: number; eaveAlong: number; ridgeAlong: number; slope: 'LOW' | 'HIGH' }, walledAlong: { from: number; to: number }, onDebug?: (message: string) => void): RooflightReading[] {
  const yEave = view.pyOf(roof.eaveY + 0.15)
  const yRidge = view.pyOf(roof.ridgeY - 0.15)
  const top = Math.round(Math.min(yEave, yRidge))
  const bottom = Math.round(Math.max(yEave, yRidge))
  const c0 = view.pxOf(walledAlong.from)
  const c1 = view.pxOf(walledAlong.to)
  const left = Math.round(Math.min(c0, c1))
  const right = Math.round(Math.max(c0, c1))
  const W = right - left + 1
  const H = bottom - top + 1
  if (W <= 0 || H <= 0) return []
  const mpp = view.registration.metresPerPixelU
  const lumas: number[] = []
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) lumas.push(lumaAt(raster, left + x, top + y))
  const roofMedian = median(lumas)
  const out: RooflightReading[] = []
  // Glass reflecting the sky is far lighter than the covering, but how far
  // depends on the render: the patch is taken at the lowest step above the
  // covering at which it comes out as a filled rectangle on its own, rather
  // than merged with a lit strip of roof beside it.
  for (const step of [30, 50, 70]) {
  const threshold = roofMedian + step
  const mask = new Uint8Array(W * H)
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) mask[y * W + x] = lumaAt(raster, left + x, top + y) > threshold ? 1 : 0
  const seen = new Uint8Array(W * H)
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (seen[y * W + x] || !mask[y * W + x]) continue
      const stack = [[x, y]]
      seen[y * W + x] = 1
      let n = 0
      let x0 = x
      let x1 = x
      let y0 = y
      let y1 = y
      while (stack.length > 0) {
        const [cx, cy] = stack.pop() as [number, number]
        n += 1
        if (cx < x0) x0 = cx
        if (cx > x1) x1 = cx
        if (cy < y0) y0 = cy
        if (cy > y1) y1 = cy
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = cx + dx
          const ny = cy + dy
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny * W + nx] || !mask[ny * W + nx]) continue
          seen[ny * W + nx] = 1
          stack.push([nx, ny])
        }
      }
      const wM = (x1 - x0 + 1) * mpp
      const hM = (y1 - y0 + 1) * view.registration.metresPerPixelV
      const fill = n / ((x1 - x0 + 1) * (y1 - y0 + 1))
      if (n >= 12 && step === 30) onDebug?.(`${view.side} patch px ${left + x0}..${left + x1} × ${top + y0}..${top + y1}: ${wM.toFixed(2)} × ${hM.toFixed(2)} m, fill ${fill.toFixed(2)}, along ${view.alongOf(left + x0).toFixed(2)}..${view.alongOf(left + x1 + 1).toFixed(2)}, y ${view.yOf(top + y1 + 1).toFixed(2)}..${view.yOf(top + y0).toFixed(2)}${x0 === 0 || y0 === 0 || x1 === W - 1 || y1 === H - 1 ? ' (touches the region edge)' : ''}`)
      if (wM < 0.45 || wM > 1.8 || hM < 0.35 || hM > 1.8 || fill < 0.8) continue
      if (x0 === 0 || y0 === 0 || x1 === W - 1 || y1 === H - 1) continue
      // Already found at a lower step: the same glass.
      const a0px = view.alongOf(left + x0)
      const a1px = view.alongOf(left + x1 + 1)
      if (out.some((r) => Math.min(r.alongTo, Math.max(a0px, a1px)) - Math.max(r.alongFrom, Math.min(a0px, a1px)) > 0.1)) continue
      const a0 = view.alongOf(left + x0)
      const a1 = view.alongOf(left + x1 + 1)
      const yLow = view.yOf(top + y1 + 1)
      const yHigh = view.yOf(top + y0)
      const tan = Math.tan((roof.pitchDeg * Math.PI) / 180)
      const sFrom = (yLow - roof.eaveY) / tan
      const sTo = (yHigh - roof.eaveY) / tan
      const dir = roof.ridgeAlong > roof.eaveAlong ? 1 : -1
      out.push({
        id: `rooflight-${view.side.toLowerCase()}-${out.length}`,
        slope: roof.slope,
        alongFrom: round6(Math.min(a0, a1)),
        alongTo: round6(Math.max(a0, a1)),
        slopeFrom: round6(roof.eaveAlong + dir * Math.min(sFrom, sTo)),
        slopeTo: round6(roof.eaveAlong + dir * Math.max(sFrom, sTo)),
        yFrom: round6(yLow),
        yTo: round6(yHigh),
        frameId: view.registration.frameId,
        confidence: round6(Math.min(0.75, 0.45 + fill * 0.3)),
        why: `a ${wM.toFixed(2)} × ${hM.toFixed(2)} m patch ${Math.round(threshold - roofMedian)} luma lighter than the covering in the roof plane of the ${view.side.toLowerCase()} render (${Math.round(fill * 100)} % filled)`,
      })
    }
  }
  }
  out.sort((a, b) => a.alongFrom - b.alongFrom)
  return out.map((r, i) => ({ ...r, id: `rooflight-${view.side.toLowerCase()}-${i}` }))
}

const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2
}
