/**
 * N9-01 (C, D), relations R3 and R4: the delivered model's walls held against the ink of the plan of their storey.
 *
 * Both read the plan's ORIGINAL raster, with the plan reader's own definition of ink (`adaptiveInkMask` over the ink
 * channel: darker than the paper around it, so a smooth watermark is not ink and a pale tread line is), through the
 * storey's registered frame. Every length is stated in the sheet's own terms — its pixel size, the model's wall
 * thicknesses, the band thickness the reader measured on that sheet (`wallPx`) — never as a fixed share of dark pixels.
 *
 * R3 — MODEL → SOURCE. Each wall is sampled at stations along it; at each, a profile across its band (± a positional
 * tolerance) is read. A station is BAND (an ink run at least half the wall's drawn thickness), THIN (ink, but only
 * strokes thinner than that: a window's glazing lines, a dimension or furniture line, a hatch) or BLANK (no ink at all).
 * Stations inside the model's own openings are not read: a drawn gap there is the opening. Consecutive BAND stations
 * longer than a crossing wall's width are the drawn wall IN LINE with the model's; shorter ones are a crossing wall.
 *   - CONFLICT `WALL_ON_BLANK_PAPER`: a stretch of the wall, reaching one of its ends (or the whole wall), with no ink at
 *     all over more than two wall thicknesses and the tolerance — the model builds a wall where the drawing has none.
 *   - a gap with the drawn wall in line on BOTH sides is a drawn opening the model does not have: named
 *     (`DRAWN_GAP_NOT_MODELLED`), never a wall conflict.
 *   - thin strokes only: UNCHECKED (`THIN_LINES_ONLY`) — a glazed wall, a slab edge or a line the sheet draws; R3 cannot
 *     tell which.
 *   - the registration itself is held to the model: when fewer than half of a storey's exterior wall stations find
 *     drawn wall, the frame and the model cannot be told apart (wrong scale, mirror, wrong storey, or a wrong model) and
 *     the whole storey is UNCHECKED (`REGISTRATION_NOT_CORROBORATED`), never CONFLICT.
 *
 * R4 — SOURCE → MODEL. The thick ink of the sheet (an opening of the ink mask by half the reader's band thickness: walls
 * survive, text, dimension lines, furniture and hatching do not) that is connected to the modelled storey is the drawn
 * building of that storey. Whatever of it lies more than a tolerance (one exterior wall) outside the modelled storey's
 * footprint (slabs, wall bands, balconies, terraces, chimneys, columns) is measured: a piece standing more than two
 * exterior walls clear of the footprint with at least four wall thicknesses of drawn band is a drawn part of the storey
 * the model does not build (`DRAWN_WALLS_BEYOND_STOREY`). A registered storey sheet with no modelled walls is compared
 * with the footprint of the storey below: drawn band over it is a storey the model
 * does not build (`STOREY_DRAWN_NOT_MODELLED`) when that band closes an outline — each side of its extent drawn along at
 * least half its length — and anything less is UNCHECKED.
 *
 * Neither relation is independent of the reading in the strong sense: the walls were read from these sheets, so R3
 * catches what EMISSION did to the reading (walls joined across blank paper, a storey stretched past its walls), and R4
 * catches drawn walls the reading left out. Both are named as such in their evidence.
 */
import { round6 } from '@buildapp/source-common'
import type { CanonicalBuildingModel, Wall } from '@buildapp/model'
import { adaptiveInkMask, dilate, erode, inkChannel } from '@buildapp/source-cv'
import type { Mask, Raster } from '@buildapp/source-cv'
import { combineStatus, countStatuses } from './types.js'
import type { RelationItem, RelationResult } from './types.js'
import { bandQuad, wallAxes } from './plan-geometry.js'

export type PlanSheetInput = {
  frameId: string
  assetId: string
  storeyIndex: number
  mppX: number
  mppY: number
  /** Half a wall's thickness in pixels on this sheet, from the plan's own bands. */
  wallPx: number
  toPixel: (x: number, z: number) => { x: number; y: number }
  raster: Raster | undefined
}

/** A storey whose exterior wall stations find drawn wall less often than this is not corroborated by its own model. */
export const REGISTRATION_SUPPORT_MIN = 0.5

type StationClass = 'BAND' | 'THIN' | 'BLANK' | 'EXCLUDED'
type Station = { a: number; cls: StationClass; drawnWidthM?: number; inline?: boolean }

export type WallInkReading = {
  wall: Wall
  stepM: number
  tolM: number
  stations: Station[]
  /** Stations outside the model's openings that found the drawn wall (in line or crossing). */
  supported: number
  read: number
  verdict: { status: RelationItem['status']; code: string; why: string; blankM: number; thinM: number; gaps: number[] }
}

export type StoreyInk = {
  storeyIndex: number
  frameId: string
  levelId?: string
  /** Share of exterior wall stations with drawn wall; null with no exterior wall. */
  support: number | null
  corroborated: boolean
  walls: WallInkReading[]
}

/**
 * A storey's wall thickness for tolerances: the median of its walls that are walls — longer than they are thick. A
 * return or a stub stated 1.5 m thick and 0.2 m long is a block, not a wall band, and must not widen every tolerance.
 */
export function typicalThickness(walls: readonly Wall[], kind?: Wall['kind']): number {
  const ts = walls.filter((w) => (!kind || w.kind === kind) && wallAxes(w).length >= w.thickness).map((w) => w.thickness).sort((a, b) => a - b)
  if (ts.length === 0) return Math.max(0, ...walls.map((w) => w.thickness))
  return ts[Math.floor(ts.length / 2)]
}

const ink = (m: Mask, x: number, y: number): boolean => {
  const xi = Math.round(x)
  const yi = Math.round(y)
  return xi >= 0 && yi >= 0 && xi < m.width && yi < m.height && m.data[yi * m.width + xi] === 1
}

function readWall(w: Wall, model: CanonicalBuildingModel, mask: Mask, sheet: PlanSheetInput, levelMaxT: number, mpp: number): WallInkReading {
  const { length, u, n } = wallAxes(w)
  const tolM = Math.max(3 * mpp, typicalThickness(model.walls.filter((x) => x.levelId === w.levelId), 'EXTERIOR') / 2)
  const stepM = Math.max(0.1, 2 * mpp)
  const excluded: Array<[number, number]> = []
  for (const o of model.openings) {
    if (o.wallId === w.id) excluded.push([o.offset - tolM, o.offset + o.width + tolM])
    for (const leaf of o.leaves ?? []) if (leaf.wallId === w.id) excluded.push([leaf.offset - tolM, leaf.offset + o.width + tolM])
  }
  const tPx = w.thickness / mpp
  const minRunPx = Math.max(2, 0.5 * tPx)
  const stations: Station[] = []
  for (let a = tolM; a <= length - tolM + 1e-9; a += stepM) {
    if (excluded.some(([x0, x1]) => a >= x0 && a <= x1)) {
      stations.push({ a, cls: 'EXCLUDED' })
      continue
    }
    const base = { x: w.start.x + u.x * a, z: w.start.z + u.z * a }
    const samples = Math.max(2, Math.ceil((w.thickness + 2 * tolM) / mpp))
    let dark = 0
    let run = 0
    let best = 0
    let bestClipped = false
    let runStart = 0
    for (let i = 0; i <= samples; i += 1) {
      const s = -tolM + ((w.thickness + 2 * tolM) * i) / samples
      const p = sheet.toPixel(base.x + n.x * s, base.z + n.z * s)
      const on = ink(mask, p.x, p.y)
      if (on) {
        dark += 1
        if (run === 0) runStart = i
        run += 1
      }
      if (!on || i === samples) {
        if (run > best) {
          best = run
          bestClipped = runStart === 0 || (on && i === samples)
        }
        run = 0
      }
    }
    const stepPx = (w.thickness + 2 * tolM) / samples / mpp
    const runPx = best * stepPx
    if (runPx >= minRunPx) stations.push({ a, cls: 'BAND', ...(bestClipped ? {} : { drawnWidthM: round6(runPx * mpp) }) })
    else stations.push({ a, cls: dark === 0 ? 'BLANK' : 'THIN' })
  }
  // in line: a run of BAND stations longer than a crossing wall is wide
  const crossM = levelMaxT + 2 * tolM
  for (let i = 0; i < stations.length; ) {
    if (stations[i].cls !== 'BAND') {
      i += 1
      continue
    }
    let j = i
    while (j < stations.length && stations[j].cls === 'BAND') j += 1
    const inline = (j - i) * stepM > crossM
    for (let k = i; k < j; k += 1) stations[k].inline = inline
    i = j
  }
  const read = stations.filter((s) => s.cls !== 'EXCLUDED')
  const supported = read.filter((s) => s.cls === 'BAND').length
  // regions of stations that are not in-line drawn wall
  const minLenM = 2 * levelMaxT + 2 * tolM
  const gaps: number[] = []
  let worstEnd: { blankM: number; thinM: number } = { blankM: 0, thinM: 0 }
  let whole = true
  for (let i = 0; i < stations.length; ) {
    if (stations[i].inline) {
      whole = false
      i += 1
      continue
    }
    let j = i
    while (j < stations.length && !stations[j].inline) j += 1
    const region = stations.slice(i, j)
    const blankM = region.filter((s) => s.cls === 'BLANK').length * stepM
    const thinM = region.filter((s) => s.cls === 'THIN').length * stepM
    const bounded = i > 0 && j < stations.length
    if (bounded) {
      if (blankM + thinM > 0) gaps.push(round6(blankM + thinM))
    } else if (blankM > worstEnd.blankM || (blankM === worstEnd.blankM && thinM > worstEnd.thinM)) worstEnd = { blankM, thinM }
    i = j
  }
  let verdict: WallInkReading['verdict']
  const L = round6(length)
  if (read.length === 0) verdict = { status: 'UNCHECKED', code: 'NOTHING_TO_READ', why: `${w.id} (${L} m) is all openings or shorter than its tolerance: no station to read`, blankM: 0, thinM: 0, gaps }
  else if (worstEnd.blankM >= minLenM) verdict = { status: 'CONFLICT', code: 'WALL_ON_BLANK_PAPER', why: `${w.id}: ${round6(worstEnd.blankM)} m of the wall ${whole ? '(the whole wall)' : 'reaching its end'} stands on paper with no ink at all — more than ${round6(minLenM)} m (two wall thicknesses and the tolerance): the drawing has no wall there`, blankM: round6(worstEnd.blankM), thinM: round6(worstEnd.thinM), gaps }
  else if (worstEnd.blankM + worstEnd.thinM >= minLenM) verdict = { status: 'UNCHECKED', code: 'THIN_LINES_ONLY', why: `${w.id}: ${round6(worstEnd.blankM + worstEnd.thinM)} m ${whole ? '(the whole wall)' : 'reaching its end'} stands on thin strokes only (${round6(worstEnd.thinM)} m) — glazing, a slab edge or a line of the sheet; R3 cannot tell which`, blankM: round6(worstEnd.blankM), thinM: round6(worstEnd.thinM), gaps }
  else verdict = { status: 'PASS', code: gaps.length > 0 ? 'DRAWN_GAP_NOT_MODELLED' : 'WALL_ON_INK', why: gaps.length > 0 ? `${w.id}: the drawn wall runs in line with it; ${gaps.length} drawn gap${gaps.length === 1 ? '' : 's'} in it (${gaps.join(', ')} m) the model does not open — an opening question, not a wall conflict` : `${w.id}: the drawn wall runs in line with it`, blankM: round6(worstEnd.blankM), thinM: round6(worstEnd.thinM), gaps }
  return { wall: w, stepM, tolM: round6(tolM), stations, supported, read: read.length, verdict }
}

/** R3 over every registered storey. */
export function readStoreyInk(model: CanonicalBuildingModel, sheet: PlanSheetInput, mask: Mask): StoreyInk {
  const level = model.levels.find((l) => l.index === sheet.storeyIndex)
  const walls = level ? model.walls.filter((w) => w.levelId === level.id) : []
  const mpp = (Math.abs(sheet.mppX) + Math.abs(sheet.mppY)) / 2
  // the widest real wall crossing this storey, and the typical exterior band, for the tolerances
  const levelMaxT = Math.max(typicalThickness(walls, 'EXTERIOR'), ...walls.filter((w) => wallAxes(w).length >= w.thickness).map((w) => w.thickness), 0)
  const readings = walls.map((w) => readWall(w, model, mask, sheet, levelMaxT, mpp))
  const exterior = readings.filter((r) => r.wall.kind === 'EXTERIOR')
  const read = exterior.reduce((a, r) => a + r.read, 0)
  const support = read > 0 ? round6(exterior.reduce((a, r) => a + r.supported, 0) / read) : null
  return { storeyIndex: sheet.storeyIndex, frameId: sheet.frameId, ...(level ? { levelId: level.id } : {}), support, corroborated: support !== null && support >= REGISTRATION_SUPPORT_MIN, walls: readings }
}

// --- raster helpers for R4 ---------------------------------------------------

type P = { x: number; z: number }

function fillPolygon(mask: Uint8Array, width: number, height: number, poly: ReadonlyArray<{ x: number; y: number }>): void {
  const ys = poly.map((p) => p.y)
  const y0 = Math.max(0, Math.floor(Math.min(...ys)))
  const y1 = Math.min(height - 1, Math.ceil(Math.max(...ys)))
  for (let y = y0; y <= y1; y += 1) {
    const yc = y + 0.5
    const xs: number[] = []
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
      const a = poly[i]
      const b = poly[j]
      if (a.y > yc !== b.y > yc) xs.push(a.x + ((yc - a.y) * (b.x - a.x)) / (b.y - a.y))
    }
    xs.sort((a, b) => a - b)
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.ceil(xs[k] - 0.5))
      const xb = Math.min(width - 1, Math.floor(xs[k + 1] - 0.5))
      for (let x = xa; x <= xb; x += 1) mask[y * width + x] = 1
    }
  }
}

const rect = (r: { minX: number; maxX: number; minZ: number; maxZ: number }): P[] => [
  { x: r.minX, z: r.minZ },
  { x: r.maxX, z: r.minZ },
  { x: r.maxX, z: r.maxZ },
  { x: r.minX, z: r.maxZ },
]

/** The modelled storey in plan: slabs, wall bands, balconies, terraces, chimneys and members, as polygons. */
export function storeyPolygons(model: CanonicalBuildingModel, levelId: string): P[][] {
  const polys: P[][] = []
  for (const s of model.slabs) if (s.levelId === levelId) polys.push(s.polygon)
  for (const w of model.walls) if (w.levelId === levelId) polys.push(bandQuad(w))
  for (const b of model.balconies) if (b.levelId === levelId) polys.push(rect(b.footprint))
  for (const t of model.terraces) if (t.levelId === levelId) polys.push(t.polygon)
  for (const c of model.chimneys) if (c.levelId === levelId) polys.push(rect(c.footprint))
  for (const m of model.linearSolids) {
    if (m.levelId !== levelId) continue
    const h = Math.max(m.width, m.depth) / 2
    polys.push(rect({ minX: Math.min(m.start.x, m.end.x) - h, maxX: Math.max(m.start.x, m.end.x) + h, minZ: Math.min(m.start.z, m.end.z) - h, maxZ: Math.max(m.start.z, m.end.z) + h }))
  }
  return polys
}

function rasterise(polys: readonly P[][], sheet: PlanSheetInput, width: number, height: number): Uint8Array {
  const out = new Uint8Array(width * height)
  for (const p of polys) fillPolygon(out, width, height, p.map((v) => sheet.toPixel(v.x, v.z)))
  return out
}

/** Chamfer (3-4) distance in pixels from every pixel to the nearest set pixel of `from`. */
function distanceFrom(from: Uint8Array, width: number, height: number): Float32Array {
  const INF = 1e9
  const d = new Float32Array(width * height)
  for (let i = 0; i < d.length; i += 1) d[i] = from[i] ? 0 : INF
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x
      if (d[i] === 0) continue
      let v = d[i]
      if (x > 0) v = Math.min(v, d[i - 1] + 3)
      if (y > 0) {
        v = Math.min(v, d[i - width] + 3)
        if (x > 0) v = Math.min(v, d[i - width - 1] + 4)
        if (x < width - 1) v = Math.min(v, d[i - width + 1] + 4)
      }
      d[i] = v
    }
  }
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const i = y * width + x
      let v = d[i]
      if (x < width - 1) v = Math.min(v, d[i + 1] + 3)
      if (y < height - 1) {
        v = Math.min(v, d[i + width] + 3)
        if (x < width - 1) v = Math.min(v, d[i + width + 1] + 4)
        if (x > 0) v = Math.min(v, d[i + width - 1] + 4)
      }
      d[i] = v
    }
  }
  for (let i = 0; i < d.length; i += 1) d[i] = d[i] / 3
  return d
}

/** 8-connected labels of a binary mask; 0 is background. */
function label(m: Uint8Array, width: number, height: number): { labels: Int32Array; count: number } {
  const labels = new Int32Array(width * height)
  let count = 0
  const stack: number[] = []
  for (let i = 0; i < m.length; i += 1) {
    if (!m[i] || labels[i]) continue
    count += 1
    labels[i] = count
    stack.push(i)
    while (stack.length > 0) {
      const p = stack.pop() as number
      const x = p % width
      const y = (p - x) / width
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const q = ny * width + nx
          if (m[q] && !labels[q]) {
            labels[q] = count
            stack.push(q)
          }
        }
      }
    }
  }
  return { labels, count }
}

export type OutlinePiece = { pixels: number; maxDistanceM: number; bandLengthM: number; boxPx: { x0: number; y0: number; x1: number; y1: number }; conflict: boolean }

export type StoreyOutline = {
  storeyIndex: number
  frameId: string
  status: RelationItem['status']
  code: string
  why: string
  measured: Record<string, number | string>
  tolerance: Record<string, number | string>
  coverage: Record<string, number | string>
  pieces: OutlinePiece[]
  /** For the boards: the masks this storey was measured with, in sheet pixels. */
  masks?: { width: number; height: number; thick: Uint8Array; footprint: Uint8Array; outside: Uint8Array }
}

/** Thick ink: the ink mask opened by half the reader's band thickness, so walls survive and strokes do not. */
export function thickInk(mask: Mask, wallPx: number): Mask {
  const r = Math.max(1, Math.round(wallPx / 2))
  return dilate(erode(mask, r), r)
}

export function storeyOutline(model: CanonicalBuildingModel, sheet: PlanSheetInput, mask: Mask, ink3: StoreyInk, options: { keepMasks?: boolean } = {}): StoreyOutline {
  const { width, height } = mask
  const mpp = (Math.abs(sheet.mppX) + Math.abs(sheet.mppY)) / 2
  const thick = thickInk(mask, sheet.wallPx).data
  const levels = [...model.levels].sort((a, b) => a.index - b.index)
  const level = levels.find((l) => l.index === sheet.storeyIndex)
  const walls = level ? model.walls.filter((w) => w.levelId === level.id) : []
  const exterior = walls.filter((w) => w.kind === 'EXTERIOR')
  const tExt = typicalThickness(exterior.length > 0 ? exterior : model.walls, 'EXTERIOR')
  const bandPx = Math.max(1, 2 * sheet.wallPx)
  const base = { storeyIndex: sheet.storeyIndex, frameId: sheet.frameId }
  if (exterior.length === 0) {
    // a registered storey sheet the model builds no walls on: held against the storey below
    const below = levels.filter((l) => l.index < sheet.storeyIndex && model.walls.some((w) => w.levelId === l.id && w.kind === 'EXTERIOR')).pop()
    if (!below) return { ...base, status: 'UNCHECKED', code: 'NO_STOREY_TO_COMPARE', why: `storey ${sheet.storeyIndex}: the model builds no exterior wall on it or below it`, measured: {}, tolerance: {}, coverage: {}, pieces: [] }
    const tolPx = Math.max(3, tExt / mpp)
    const lower = dilate({ width, height, data: rasterise(storeyPolygons(model, below.id), sheet, width, height) }, Math.round(tolPx)).data
    // the drawn wall band over the storey below, and whether it encloses a space: every side of its extent drawn
    // along at least half its length (a closed outline with its openings), not a few strokes
    let px = 0
    let x0 = width
    let y0 = height
    let x1 = -1
    let y1 = -1
    for (let i = 0; i < thick.length; i += 1) {
      if (!thick[i] || !lower[i]) continue
      px += 1
      const x = i % width
      const y = (i - x) / width
      x0 = Math.min(x0, x)
      y0 = Math.min(y0, y)
      x1 = Math.max(x1, x)
      y1 = Math.max(y1, y)
    }
    const bandLengthM = round6((px / bandPx) * mpp)
    const reach = Math.ceil(bandPx)
    const sideShare = (horizontal: boolean, at: number): number => {
      const [a0, a1] = horizontal ? [x0, x1] : [y0, y1]
      let hit = 0
      for (let a = a0; a <= a1; a += 1) {
        let on = false
        for (let d = 0; d <= reach && !on; d += 1) {
          const c = at + (at === (horizontal ? y0 : x0) ? d : -d)
          const i = horizontal ? c * width + a : a * width + c
          if (c >= 0 && c < (horizontal ? height : width) && thick[i] && lower[i]) on = true
        }
        if (on) hit += 1
      }
      return a1 >= a0 ? hit / (a1 - a0 + 1) : 0
    }
    const sides = x1 < 0 ? [0, 0, 0, 0] : [sideShare(true, y0), sideShare(true, y1), sideShare(false, x0), sideShare(false, x1)]
    const spanM = x1 < 0 ? 0 : round6(Math.min(x1 - x0, y1 - y0) * mpp)
    const encloses = sides.every((v) => v >= 0.5) && spanM >= 4 * tExt
    const measured = { drawnBandOverStoreyBelowM: bandLengthM, drawnSpanM: spanM, sidesDrawnShare: sides.map((v) => round6(v)).join(' / '), modelledExteriorWalls: 0 }
    const tolerance = { positionM: round6(tolPx * mpp), sideDrawnMin: 0.5, spanMinM: round6(4 * tExt), bandThicknessPx: round6(bandPx) }
    if (encloses) return { ...base, status: 'CONFLICT', code: 'STOREY_DRAWN_NOT_MODELLED', why: `storey ${sheet.storeyIndex}: its registered plan draws a closed outline of wall band over the storey below (${bandLengthM} m of band, every side drawn along ≥ half its length, ${spanM} m across) and the model builds no wall on it`, measured, tolerance, coverage: { comparedWith: below.id }, pieces: [] }
    return { ...base, status: 'UNCHECKED', code: 'STOREY_SHEET_WITHOUT_MODEL', why: `storey ${sheet.storeyIndex}: the model builds no wall on it; its plan draws ${bandLengthM} m of wall band over the storey below, not a closed outline: not decidable`, measured, tolerance, coverage: { comparedWith: below.id }, pieces: [] }
  }
  const tolM = Math.max(3 * mpp, tExt)
  const tolPx = tolM / mpp
  const footprint = rasterise(storeyPolygons(model, (level as { id: string }).id), sheet, width, height)
  const grown = dilate({ width, height, data: footprint }, Math.round(tolPx)).data
  // the drawn building: thick-ink components that reach into the modelled storey
  const { labels, count } = label(thick, width, height)
  const touching = new Uint8Array(count + 1)
  const sizes = new Uint32Array(count + 1)
  for (let i = 0; i < labels.length; i += 1) {
    if (!labels[i]) continue
    sizes[labels[i]] += 1
    if (footprint[i]) touching[labels[i]] = 1
  }
  let drawn = 0
  let inside = 0
  const outside = new Uint8Array(width * height)
  for (let i = 0; i < labels.length; i += 1) {
    if (!labels[i] || !touching[labels[i]]) continue
    drawn += 1
    if (grown[i]) inside += 1
    else outside[i] = 1
  }
  const dist = distanceFrom(grown, width, height)
  const parts = label(outside, width, height)
  const acc = new Map<number, OutlinePiece>()
  for (let i = 0; i < parts.labels.length; i += 1) {
    const k = parts.labels[i]
    if (!k) continue
    const x = i % width
    const y = (i - x) / width
    const p = acc.get(k) ?? { pixels: 0, maxDistanceM: 0, bandLengthM: 0, boxPx: { x0: x, y0: y, x1: x, y1: y }, conflict: false }
    p.pixels += 1
    p.maxDistanceM = Math.max(p.maxDistanceM, (dist[i] + tolPx) * mpp)
    p.boxPx = { x0: Math.min(p.boxPx.x0, x), y0: Math.min(p.boxPx.y0, y), x1: Math.max(p.boxPx.x1, x), y1: Math.max(p.boxPx.y1, y) }
    acc.set(k, p)
  }
  const pieces = [...acc.values()]
    .map((p) => {
      const bandLengthM = round6((p.pixels / bandPx) * mpp)
      return { ...p, maxDistanceM: round6(p.maxDistanceM), bandLengthM, conflict: p.maxDistanceM >= 2 * tExt + tolM && bandLengthM >= 4 * tExt }
    })
    .sort((a, b) => b.maxDistanceM - a.maxDistanceM)
  const outlineStations = ink3.walls.filter((w) => w.wall.kind === 'EXTERIOR')
  const measured: Record<string, number | string> = {
    drawnInsideShare: drawn > 0 ? round6(inside / drawn) : 0,
    drawnOutsideM2: round6((drawn - inside) * mpp * mpp),
    maxDrawnOutsideM: pieces[0]?.maxDistanceM ?? 0,
    modelOutlineSupport: ink3.support ?? 0,
    modelExteriorWalls: outlineStations.length,
    modelFootprintM2: round6(footprint.reduce((a, v) => a + v, 0) * mpp * mpp),
  }
  const tolerance = { positionM: round6(tolM), pieceDistanceM: round6(2 * tExt + tolM), pieceBandLengthM: round6(4 * tExt), bandThicknessPx: round6(bandPx), source: 'one exterior wall thickness of the model; band thickness measured on the sheet by the plan reader' }
  const coverage = { drawnComponents: [...touching].filter(Boolean).length, sheet: `${width}×${height} px` }
  const masks = options.keepMasks ? { masks: { width, height, thick, footprint, outside } } : {}
  if (!ink3.corroborated) return { ...base, status: 'UNCHECKED', code: 'REGISTRATION_NOT_CORROBORATED', why: `storey ${sheet.storeyIndex}: only ${round6((ink3.support ?? 0) * 100)} % of its exterior wall stations find drawn wall (< ${REGISTRATION_SUPPORT_MIN * 100} %): the frame and the model cannot be told apart`, measured, tolerance, coverage, pieces, ...masks }
  const bad = pieces.filter((p) => p.conflict)
  if (bad.length > 0) return { ...base, status: 'CONFLICT', code: 'DRAWN_WALLS_BEYOND_STOREY', why: `storey ${sheet.storeyIndex}: ${bad.length} drawn wall piece${bad.length === 1 ? '' : 's'} stand up to ${bad[0].maxDistanceM} m outside the modelled storey (${bad.map((p) => `${p.bandLengthM} m of band`).join(', ')}): drawn parts of the storey the model does not build`, measured, tolerance, coverage, pieces, ...masks }
  return { ...base, status: 'PASS', code: 'OUTLINE_WITHIN_TOLERANCE', why: `storey ${sheet.storeyIndex}: ${round6((drawn > 0 ? inside / drawn : 0) * 100)} % of the drawn wall ink lies within ${round6(tolM)} m of the modelled storey; nothing drawn stands clear of it`, measured, tolerance, coverage, pieces, ...masks }
}

export type PlanRelations = { r3: RelationResult; r4: RelationResult; storeys: Array<{ ink: StoreyInk; outline: StoreyOutline }> }

const sourceOf = (s: PlanSheetInput): RelationItem['source'] => ({ frameId: s.frameId, assetId: s.assetId, document: 'FLOOR_PLAN', storeyIndex: s.storeyIndex })

export function planRelations(model: CanonicalBuildingModel, sheets: readonly PlanSheetInput[], options: { keepMasks?: boolean } = {}): PlanRelations {
  const r3Items: RelationItem[] = []
  const r4Items: RelationItem[] = []
  const storeys: PlanRelations['storeys'] = []
  const registered = new Set(sheets.map((s) => s.storeyIndex))
  for (const sheet of [...sheets].sort((a, b) => a.storeyIndex - b.storeyIndex)) {
    if (!sheet.raster) {
      const item = { status: 'UNCHECKED' as const, objects: [`storey ${sheet.storeyIndex}`], source: sourceOf(sheet), measured: {}, tolerance: {}, coverage: {}, code: 'RASTER_NOT_AVAILABLE', why: `the plan of storey ${sheet.storeyIndex} was registered but its pixels are not available to this run`, evidence: [] }
      r3Items.push(item)
      r4Items.push(item)
      continue
    }
    const mask = adaptiveInkMask(inkChannel(sheet.raster), {})
    const ink3 = readStoreyInk(model, sheet, mask)
    const outline = storeyOutline(model, sheet, mask, ink3, options)
    storeys.push({ ink: ink3, outline })
    const evidence3 = ['the plan raster of this storey, read with the plan reader’s own ink definition', 'the walls were read from this sheet: R3 checks what the model built against what is drawn, not an independent survey']
    if (ink3.walls.length > 0 && !ink3.corroborated) {
      r3Items.push({ status: 'UNCHECKED', objects: ink3.walls.map((w) => w.wall.id), source: sourceOf(sheet), measured: { exteriorSupport: ink3.support ?? 0, walls: ink3.walls.length }, tolerance: { supportMin: REGISTRATION_SUPPORT_MIN }, coverage: { stations: ink3.walls.reduce((a, w) => a + w.read, 0) }, code: 'REGISTRATION_NOT_CORROBORATED', why: `storey ${sheet.storeyIndex}: only ${round6((ink3.support ?? 0) * 100)} % of the exterior wall stations find drawn wall: a wrong frame (scale, mirror, storey) cannot be told from a wrong model; nothing on this storey is called a conflict`, evidence: evidence3 })
    } else {
      const pass = ink3.walls.filter((w) => w.verdict.status === 'PASS')
      for (const w of ink3.walls.filter((x) => x.verdict.status !== 'PASS')) {
        r3Items.push({ status: w.verdict.status, objects: [w.wall.id], source: sourceOf(sheet), measured: { lengthM: round6(wallAxes(w.wall).length), thicknessM: w.wall.thickness, blankM: w.verdict.blankM, thinM: w.verdict.thinM, stationsRead: w.read, stationsOnBand: w.supported }, tolerance: { positionM: w.tolM, stepM: round6(w.stepM) }, coverage: { readShare: w.stations.length > 0 ? round6(w.read / w.stations.length) : 0 }, code: w.verdict.code, why: w.verdict.why, evidence: evidence3 })
      }
      if (pass.length > 0) {
        const gaps = pass.flatMap((w) => w.verdict.gaps.map((g) => `${w.wall.id}: ${g} m`))
        r3Items.push({ status: 'PASS', objects: pass.map((w) => w.wall.id), source: sourceOf(sheet), measured: { walls: pass.length, exteriorSupport: ink3.support ?? 0, drawnGapsNotModelled: gaps.length }, tolerance: { positionM: round6(Math.max(...pass.map((w) => w.tolM))) }, coverage: { stations: pass.reduce((a, w) => a + w.read, 0) }, code: 'WALLS_ON_INK', why: `storey ${sheet.storeyIndex}: ${pass.length} wall${pass.length === 1 ? '' : 's'} run on the drawn wall${gaps.length > 0 ? `; drawn gaps the model does not open: ${gaps.slice(0, 8).join('; ')}${gaps.length > 8 ? ' …' : ''}` : ''}`, evidence: evidence3 })
      }
    }
    r4Items.push({ status: outline.status, objects: [`storey ${sheet.storeyIndex}`], source: sourceOf(sheet), measured: outline.measured, tolerance: outline.tolerance, coverage: outline.coverage, code: outline.code, why: outline.why, evidence: ['thick ink of the plan raster connected to the modelled storey', 'drawn walls the reading left out are what R4 sees; it does not see a wall the sheet does not draw thick'] })
  }
  for (const l of model.levels) {
    if (registered.has(l.index) || !model.walls.some((w) => w.levelId === l.id)) continue
    const item = { status: 'UNCHECKED' as const, objects: [l.id], source: null, measured: {}, tolerance: {}, coverage: {}, code: 'NO_REGISTERED_PLAN', why: `the model builds walls on ${l.id} (storey ${l.index}) and no plan of that storey was registered: nothing to hold them against`, evidence: [] }
    r3Items.push(item)
    r4Items.push(item)
  }
  const limits3 = ['walls are compared with the plan they were read from: R3 sees what emission did, not what the reading missed', 'a doubled wall inside one drawn band is not detected', 'a storey whose own walls do not corroborate its frame is UNCHECKED, never CONFLICT']
  const limits4 = ['only ink drawn as thick as half a wall band counts as a drawn wall', 'ink not connected to the modelled storey (a detached garage, a garden wall) is not compared', 'a storey whose own walls do not corroborate its frame is UNCHECKED, never CONFLICT']
  return {
    r3: { id: 'R3_WALL_INK', title: 'model walls stand on drawn walls', direction: 'MODEL_TO_SOURCE', status: combineStatus(r3Items), counts: countStatuses(r3Items), items: r3Items, limits: limits3 },
    r4: { id: 'R4_STOREY_OUTLINE', title: 'each storey’s drawn walls lie within the modelled storey', direction: 'SOURCE_TO_MODEL', status: combineStatus(r4Items), counts: countStatuses(r4Items), items: r4Items, limits: limits4 },
    storeys,
  }
}
