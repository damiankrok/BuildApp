/**
 * Floor-plan reconstruction v2 (§12): interior partitions, junctions, door
 * gaps, solid blocks and rooms, read off the plan raster inside a body.
 *
 * A partition on a published plan is a thin solid band — a few pixels of
 * neutral black, much thinner than an external wall and much heavier than a
 * furniture outline or a dimension line. Text and callouts on these sheets
 * are coloured; furniture is drawn in one-pixel grey lines. So a partition is
 * found by what it is: neutral ink at least three pixels wide across, running
 * for at least most of a metre along, and meeting another wall at an end.
 *
 * Rooms are then the cells of a flood fill over the body's interior with the
 * exterior walls, the partitions and their door gaps as barriers. An open-plan
 * space stays one room, and says so; nothing here invents a boundary that is
 * not drawn.
 */
import { round6 } from '@buildapp/source-common'
import type { PixelRect } from '@buildapp/source-common'
import type { Raster } from '@buildapp/source-cv'
import type { PlanFrameV2 } from './frame.js'
import { NEUTRAL_INK_CHROMA, lumaAt, rgbAt } from './scan.js'

export type InteriorWallPiece = {
  id: string
  storeyIndex: number
  /** The axis the wall RUNS along. */
  axis: 'X' | 'Z'
  /** Its centre line across, in world metres (z for an X-running wall, x for a Z-running one). */
  at: number
  from: number
  to: number
  thicknessM: number
  /** Whether each end meets another wall (exterior or interior) within a wall thickness. */
  ends: { start: 'JUNCTION' | 'FREE'; end: 'JUNCTION' | 'FREE' }
  pixelRect: PixelRect
  confidence: number
  why: string
}

export type InteriorDoorGap = {
  id: string
  storeyIndex: number
  wallAxis: 'X' | 'Z'
  at: number
  from: number
  to: number
  widthM: number
  /** The two wall pieces either side of it. */
  betweenIds: [string, string]
  confidence: number
  why: string
}

export type SolidBlock = {
  id: string
  storeyIndex: number
  x0: number
  z0: number
  x1: number
  z1: number
  pixelRect: PixelRect
  why: string
}

export type RoomPolygon = {
  id: string
  storeyIndex: number
  /** Rectilinear polygon in world metres, anticlockwise. */
  polygon: Array<{ x: number; z: number }>
  /**
   * N8-03D2: the openings in the storey's floor the room surrounds (a stair hole, a void), as their outlines on the
   * room's grid: not floor, not the room's. Absent when there are none.
   */
  holes?: Array<Array<{ x: number; z: number }>>
  areaM2: number
  /** Bounds of the polygon. */
  bounds: { x0: number; z0: number; x1: number; z1: number }
  /** Room number read inside it, when one was. */
  number?: string
  label?: string
  publishedAreaM2?: number
  /** Ids of the interior door gaps on its boundary. */
  doorIds: string[]
  /** True when the room is bounded partly by nothing drawn (open plan). */
  openPlan: boolean
  confidence: number
  why: string
}

export type InteriorReading = {
  storeyIndex: number
  frameId: string
  walls: InteriorWallPiece[]
  doors: InteriorDoorGap[]
  blocks: SolidBlock[]
  rooms: RoomPolygon[]
  /** `roomId`: the room a label was withheld from (N8-03A: settled again when the room is joined to another). */
  unresolved: Array<{ what: string; reason: string; roomId?: string }>
}

export type InteriorOptions = {
  /**
   * N7-COUNCIL-FIX-02: the plan's drawn-band thickness, m — the scale the partition window and the drawing tolerances
   * below were set against. The body is inset by the EXTERIOR wall (`wallThicknessM`); what counts as a partition is
   * measured against how heavily this plan is drawn, not against the outer wall (which can be twice a partition).
   * Defaults to the exterior wall, as before.
   */
  drawnWallM?: number
  /** Thinnest partition, as a fraction of the external wall thickness. */
  minPartitionFraction?: number
  /**
   * Thickest, as a fraction of the external wall thickness. 005U-N3: an interior wall may be as thick as the outer
   * wall — a bearing wall, or the fire wall between an integral garage and the house — and is still a wall that
   * divides rooms, not a solid block; thicker than the outer wall it is not read as a partition.
   */
  maxPartitionFraction?: number
  /**
   * 005U-N3: the thin-partition bound, as a fraction of the external wall thickness: the thickest partition read
   * against the outer wall, and the thickness ink must exceed in both directions to be a solid block (a chimney, a
   * column).
   */
  thinPartitionFraction?: number
  /** Shortest piece worth believing, in metres. */
  minPieceM?: number
  /** Door gap range, in metres. */
  doorMinM?: number
  doorMaxM?: number
  /** Flood-fill cell size, in metres. */
  cellM?: number
  /**
   * 005U-N4: the storey's whole footprint in world metres (every body on it), where a room number's other printings
   * are looked for; the body alone when absent.
   */
  labelArea?: { x0: number; z0: number; x1: number; z1: number }
  /** Rectangles that are not floor on this storey (a stair flight, a void), as room barriers. */
  extraBarriers?: ReadonlyArray<{ x0: number; z0: number; x1: number; z1: number }>
  /**
   * N8-03D2: the openings cut in this storey's slab (the stair hole, a void — the polygons the slab is cut with): room
   * barriers, every grid cell they touch; and where a room surrounds one, a hole in the room.
   */
  slabOpenings?: ReadonlyArray<ReadonlyArray<{ x: number; z: number }>>
  /**
   * v3.53.6: the floor this reading is taken on, when it is more than one body's: the rectangles inside the walls of
   * every body of one zone of the storey — bodies the plan draws no wall between, or only a wall with a stretch left
   * out — and the strips between their inner faces where no wall stands (`strip`). The roof may cut a storey into
   * bodies where the plan draws one room; partitions, doors and rooms are the storey's, so they are read on the
   * zone: the window is the rectangles' bounds, and nothing outside them is ink, floor or a wall's end. `body` and
   * `wallThicknessM` then only name the zone (labels, the outer wall's thickness on the sheet). Absent: the one body,
   * inset by its wall, as before.
   */
  domain?: ReadonlyArray<{ x0: number; z0: number; x1: number; z1: number; strip?: boolean }>
  /** v3.53.6: a line of diagnostics per doorway weighed by the rules that need a drawn swing (accepted or not). */
  onNote?: (note: string) => void
  /** Diagnostics hook. */
  onDebug?: (info: { axis: 'X' | 'Z'; centrePx: number; thick: number; runsPx: Array<{ from: number; to: number }> }) => void
}

/**
 * 005V-N1: the share of a side's length along which a body's drawn outer wall must show wall ink in its band for the
 * body to count as standing on its walls there. An outer wall with every opening a facade carries, or an open garage
 * mouth, still shows ink at its corners and piers; a side with ink at fewer than one position in twenty has no wall.
 */
export const UNWALLED_SIDE_COVER = 0.05

const DEFAULTS: Required<Omit<InteriorOptions, 'onDebug' | 'onNote' | 'extraBarriers' | 'labelArea' | 'drawnWallM' | 'slabOpenings' | 'domain'>> = { minPartitionFraction: 0.2, maxPartitionFraction: 1.0, thinPartitionFraction: 0.72, minPieceM: 0.55, doorMinM: 0.6, doorMaxM: 1.35, cellM: 0.05 }

/** Neutral dark ink: a wall, not a coloured annotation. */
const wallInk = (r: Raster, x: number, y: number): boolean => {
  const [rr, gg, bb] = rgbAt(r, x, y)
  const l = 0.299 * rr + 0.587 * gg + 0.114 * bb
  return l < 95 && Math.max(rr, gg, bb) - Math.min(rr, gg, bb) < 70
}

type Body = { x0: number; z0: number; x1: number; z1: number }

const medianOf = (xs: readonly number[]): number => {
  if (xs.length === 0) return 0
  const sorted = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Room number tokens: what the OCR read inside the body, with pixel boxes. */
export type LabelToken = {
  text: string
  box: PixelRect
  heightPx: number
  confidence: number
  /**
   * 005U-N4: a reading the page's orientation vote set aside — the same ink read another way up won the clash. It never
   * numbers a room by itself: it is a candidate, heard only for a room no kept reading numbers, and only when it is the
   * one reading of its ink that names a published room on the storey.
   */
  setAside?: boolean
  /** Which way up the reading was taken; a room number is printed upright. */
  orientation?: string
  /**
   * v3.45: read by the shipped numeric recogniser (`room-numbers.ts` in source-metrics), gated there, never on a
   * dimension line. Its size is not compared with the sheet's other text: on sheets whose dimension labels are set as
   * large as the room numbers that comparison refuses every number, whichever reader read it.
   */
  recognised?: boolean
}

/**
 * v3.45: the room-number tokens a plan's interior reader is shown, from the frame's OCR tokens. A token the recogniser
 * read (`reader: 'RECOGNISER'`, `room-numbers.ts` in source-metrics) supersedes the template's readings of the same
 * ink: those stay in the evidence and are no token here. A reading the page vote discarded is set aside.
 */
export function labelTokensOf(frameTokens: ReadonlyArray<{ id: string; text: string; box: PixelRect; heightPx: number; confidence: number; orientation?: string; pageVote?: 'KEPT' | 'DISCARDED'; reader?: 'RECOGNISER'; supersedes?: readonly string[] }>): LabelToken[] {
  const superseded = new Set(frameTokens.flatMap((t) => t.supersedes ?? []))
  return frameTokens.filter((t) => !superseded.has(t.id)).map((t) => ({ text: t.text, box: t.box, heightPx: t.heightPx, confidence: t.confidence, orientation: t.orientation, ...(t.pageVote === 'DISCARDED' ? { setAside: true } : {}), ...(t.reader === 'RECOGNISER' ? { recognised: true } : {}) }))
}

export function readInterior(
  raster: Raster,
  plan: PlanFrameV2,
  body: Body,
  wallThicknessM: number,
  storeyIndex: number,
  tokens: readonly LabelToken[] = [],
  publishedRooms: ReadonlyArray<{ number: string; label: string; areaM2: number }> = [],
  options: InteriorOptions = {},
): InteriorReading {
  const opt = { ...DEFAULTS, ...options }
  const unresolved: InteriorReading['unresolved'] = []
  const mpp = (plan.mppX + plan.mppY) / 2
  const drawnM = options.drawnWallM ?? wallThicknessM
  const wallPx = drawnM / mpp
  const minThick = Math.max(2, Math.round(wallPx * opt.minPartitionFraction))
  const maxThick = Math.max(minThick + 1, Math.round(wallPx * opt.maxPartitionFraction))
  // 005U-N3: the solid-block rule keeps the thin bound: where two wall-thick partitions cross, the crossing must not
  // separate from the walls into a compact "block" and be read as a chimney.
  const thinThick = Math.max(minThick + 1, Math.round(wallPx * opt.thinPartitionFraction))
  const minPiecePx = opt.minPieceM / mpp

  // The interior in pixels: the body inset by its external wall — or, read on a zone, the bounds of its floor.
  const zone = options.domain && options.domain.length > 0 ? options.domain : undefined
  const inner = zone
    ? { x0: Math.min(...zone.map((r) => r.x0)), z0: Math.min(...zone.map((r) => r.z0)), x1: Math.max(...zone.map((r) => r.x1)), z1: Math.max(...zone.map((r) => r.z1)) }
    : { x0: body.x0 + wallThicknessM, z0: body.z0 + wallThicknessM, x1: body.x1 - wallThicknessM, z1: body.z1 - wallThicknessM }
  /** v3.53.6: whether a world point lies on the zone's floor (always, inside the window, for one body). */
  const onFloor = (x: number, z: number): boolean => !zone || zone.some((r) => x >= r.x0 - 1e-9 && x <= r.x1 + 1e-9 && z >= r.z0 - 1e-9 && z <= r.z1 + 1e-9)
  const pa = plan.toPixel(inner.x0, inner.z1)
  const pb = plan.toPixel(inner.x1, inner.z0)
  const px0 = Math.ceil(Math.min(pa.x, pb.x))
  const px1 = Math.floor(Math.max(pa.x, pb.x))
  const py0 = Math.ceil(Math.min(pa.y, pb.y))
  const py1 = Math.floor(Math.max(pa.y, pb.y))
  if (px1 - px0 < 10 || py1 - py0 < 10) return { storeyIndex, frameId: plan.frameId, walls: [], doors: [], blocks: [], rooms: [], unresolved: [{ what: 'the interior of the body', reason: 'the body is too small on this sheet to read anything inside it' }] }

  const W = px1 - px0 + 1
  const H = py1 - py0 + 1
  // v3.53.6: the zone's floor on the window's pixels, each rectangle cut to whole pixels inside its faces as the one
  // body's window is; `dom[k]` is 1 + the rectangle's index, 0 off the floor
  const dom = zone ? new Uint16Array(W * H) : undefined
  if (zone && dom) {
    zone.forEach((r, k) => {
      const a = plan.toPixel(r.x0, r.z1)
      const b = plan.toPixel(r.x1, r.z0)
      const rx0 = Math.max(0, Math.ceil(Math.min(a.x, b.x)) - px0)
      const rx1 = Math.min(W - 1, Math.floor(Math.max(a.x, b.x)) - px0)
      const ry0 = Math.max(0, Math.ceil(Math.min(a.y, b.y)) - py0)
      const ry1 = Math.min(H - 1, Math.floor(Math.max(a.y, b.y)) - py0)
      for (let y = ry0; y <= ry1; y += 1) for (let x = rx0; x <= rx1; x += 1) if (dom[y * W + x] === 0 || !r.strip) dom[y * W + x] = k + 1
    })
  }
  const inDom = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H && (!dom || dom[y * W + x] > 0)
  const ink = new Uint8Array(W * H)
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) ink[y * W + x] = (!dom || dom[y * W + x] > 0) && wallInk(raster, px0 + x, py0 + y) ? 1 : 0
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= W || y >= H ? 0 : ink[y * W + x])

  // Horizontal run length through each pixel (across a vertical wall) and vertical run length (across a horizontal wall).
  const hRun = new Int16Array(W * H)
  const vRun = new Int16Array(W * H)
  for (let y = 0; y < H; y += 1) {
    let x = 0
    while (x < W) {
      if (at(x, y)) {
        let j = x
        while (j + 1 < W && at(j + 1, y)) j += 1
        const len = j - x + 1
        for (let k = x; k <= j; k += 1) hRun[y * W + k] = len
        x = j + 1
      } else x += 1
    }
  }
  for (let x = 0; x < W; x += 1) {
    let y = 0
    while (y < H) {
      if (at(x, y)) {
        let j = y
        while (j + 1 < H && at(x, j + 1)) j += 1
        const len = j - y + 1
        for (let k = y; k <= j; k += 1) vRun[k * W + x] = len
        y = j + 1
      } else y += 1
    }
  }

  // 005V-N1: a wall-thick partition is told from the outer wall by where the outer wall is, so the body must stand on
  // its drawn walls. On each side, the band where the body puts the outer wall (one and a half outer walls inside the
  // interior's edge to two outside it) is looked at along the side: a drawn outer wall holds ink there along most of
  // the side, openings and an open garage mouth notwithstanding. A side with wall ink at almost no position along it
  // (UNWALLED_SIDE_COVER) is a body registered beyond its drawing — the drawn outer wall then stands inside the
  // interior, where it would pass for a partition. The registration is uncertain there, and the thick partitions
  // 005U-N3 admits are not read on this body and storey; the thin ones are read as before.
  const sideCover = (vertical: boolean, high: boolean): number => {
    const reach = Math.ceil(wallPx * 2)
    const inside = Math.ceil(wallPx * 1.5)
    const extent = vertical ? W : H
    const length = vertical ? H : W
    const [from, to] = high ? [extent - 1 - inside, extent - 1 + reach] : [-reach, inside]
    let walled = 0
    for (let along = 0; along < length; along += 1) {
      let len = 0
      for (let c = from; c <= to; c += 1) {
        const dark = vertical ? wallInk(raster, px0 + c, py0 + along) : wallInk(raster, px0 + along, py0 + c)
        len = dark ? len + 1 : 0
        if (len >= minThick) {
          walled += 1
          break
        }
      }
    }
    return walled / length
  }
  // v3.53.6: on a zone each body's rectangle is weighed by itself, along the part of each side where the floor does not
  // run on (where it does, the plan draws no wall and none is expected); a strip between two bodies takes theirs
  const zoneThick: boolean[] = []
  const zoneUnwalled: string[] = []
  if (zone && dom) {
    zone.forEach((r, k) => {
      if (r.strip) return
      const a = plan.toPixel(r.x0, r.z1)
      const b = plan.toPixel(r.x1, r.z0)
      const rx0 = Math.ceil(Math.min(a.x, b.x)) - px0
      const rx1 = Math.floor(Math.max(a.x, b.x)) - px0
      const ry0 = Math.ceil(Math.min(a.y, b.y)) - py0
      const ry1 = Math.floor(Math.max(a.y, b.y)) - py0
      const reach = Math.ceil(wallPx * 2)
      const inside = Math.ceil(wallPx * 1.5)
      const bad: string[] = []
      ;(['west', 'east', 'top', 'bottom'] as const).forEach((name, s) => {
        const vertical = s < 2
        const high = s % 2 === 1
        const edge = vertical ? (high ? rx1 : rx0) : high ? ry1 : ry0
        const [from, to] = high ? [edge - inside, edge + reach] : [edge - reach, edge + inside]
        const [lo, hi] = vertical ? [ry0, ry1] : [rx0, rx1]
        let judged = 0
        let walled = 0
        for (let along = lo; along <= hi; along += 1) {
          // where the floor runs on past this side, no wall is expected
          const beyond = high ? edge + Math.ceil(wallPx * 0.5) + 1 : edge - Math.ceil(wallPx * 0.5) - 1
          if (vertical ? inDom(beyond, along) : inDom(along, beyond)) continue
          judged += 1
          let len = 0
          for (let c = from; c <= to; c += 1) {
            const dark = vertical ? wallInk(raster, px0 + c, py0 + along) : wallInk(raster, px0 + along, py0 + c)
            len = dark ? len + 1 : 0
            if (len >= minThick) {
              walled += 1
              break
            }
          }
        }
        if (judged * mpp >= opt.minPieceM && walled / judged < UNWALLED_SIDE_COVER) bad.push(name)
      })
      zoneThick[k] = bad.length === 0
      if (bad.length > 0) zoneUnwalled.push(...bad)
    })
    zone.forEach((r, k) => {
      if (r.strip) zoneThick[k] = zone.every((o, j) => o.strip || zoneThick[j])
    })
  }
  const unwalled = zone ? [...new Set(zoneUnwalled)] : (['west', 'east', 'top', 'bottom'] as const).filter((_, k) => sideCover(k < 2, k % 2 === 1) < UNWALLED_SIDE_COVER)
  const thickAdmitted = unwalled.length === 0
  if (!thickAdmitted && maxThick > thinThick) {
    unresolved.push({ what: `wall-thick partitions on storey ${storeyIndex}`, reason: `${zone ? 'a body of the zone' : 'the body'} stands on no drawn wall along its ${unwalled.join(', ')} side${unwalled.length > 1 ? 's' : ''} on this sheet: its registration is uncertain there, and ink as thick as the outer wall inside it may be the outer wall itself, so only partitions thinner than the outer wall are read${zone ? ' in it' : ''}` })
  }
  // 005U-N3: a wall as thick as the outer wall is a partition only standing clear of the outer wall. Within one
  // outer-wall thickness of the interior's edge, ink that thick is the outer wall's own — drawn thicker than it was
  // read, which the inset by the read thickness left inside — so there the thin-partition bound stays.
  const capAcross = (vertical: boolean, across: number, along?: number): number => {
    if (dom && along !== undefined) {
      // v3.53.6: on a zone, the edge is the floor's: within an outer wall of where it ends across the piece
      const [x, y] = vertical ? [Math.round(across), Math.round(along)] : [Math.round(along), Math.round(across)]
      const k = x >= 0 && y >= 0 && x < W && y < H ? dom[y * W + x] : 0
      const reach = Math.ceil(wallPx)
      const edge = vertical ? !inDom(x - reach, y) || !inDom(x + reach, y) : !inDom(x, y - reach) || !inDom(x, y + reach)
      return k === 0 || !zoneThick[k - 1] || edge ? Math.min(maxThick, thinThick) : maxThick
    }
    if (dom) return maxThick
    const extent = vertical ? W : H
    return !thickAdmitted || across < wallPx || across > extent - 1 - wallPx ? Math.min(maxThick, thinThick) : maxThick
  }
  // A pixel is "partition ink" for a vertical wall when its horizontal run is
  // partition-thick and its vertical run is long; and symmetrically.
  const isVerticalWallPixel = (x: number, y: number): boolean => {
    const h = hRun[y * W + x]
    return h >= minThick && h <= capAcross(true, x, y) && vRun[y * W + x] >= minPiecePx * 0.6
  }
  const isHorizontalWallPixel = (x: number, y: number): boolean => {
    const v = vRun[y * W + x]
    return v >= minThick && v <= capAcross(false, y, x) && hRun[y * W + x] >= minPiecePx * 0.6
  }

  type Axis = { centre: number; thick: number; runs: Array<{ from: number; to: number }> }
  const axesAlong = (vertical: boolean): Axis[] => {
    // Column (or row) profile: the number of wall pixels along it.
    const n = vertical ? W : H
    const m = vertical ? H : W
    const profile = new Int32Array(n)
    for (let i = 0; i < n; i += 1) {
      let c = 0
      for (let j = 0; j < m; j += 1) if (vertical ? isVerticalWallPixel(i, j) : isHorizontalWallPixel(j, i)) c += 1
      profile[i] = c
    }
    // Bands of consecutive columns with enough wall pixels.
    const axes: Axis[] = []
    let i = 0
    while (i < n) {
      if (profile[i] >= minPiecePx * 0.6) {
        let j = i
        while (j + 1 < n && profile[j + 1] >= minPiecePx * 0.6) j += 1
        const thick = j - i + 1
        if (thick >= minThick - 1 && thick <= capAcross(vertical, (i + j) / 2) * 2 + 2) {
          // Along the axis: solid where at least a partition's thickness of the
          // band's columns is ink. The band may be wider than one wall (two
          // walls a few pixels apart, or a wall beside a line of furniture),
          // so each piece measures its own thickness and centre from the ink
          // it actually contains.
          const counts: number[] = []
          const firstDark: number[] = []
          const lastDark: number[] = []
          for (let t = 0; t < m; t += 1) {
            let c = 0
            let fd = -1
            let ld = -1
            for (let k = i; k <= j; k += 1) {
              if (vertical ? at(k, t) : at(t, k)) {
                c += 1
                if (fd < 0) fd = k
                ld = k
              }
            }
            counts.push(c)
            firstDark.push(fd)
            lastDark.push(ld)
          }
          const solid = counts.map((c) => c >= Math.max(2, minThick - 1))
          const runs: Array<{ from: number; to: number }> = []
          let s: number | undefined
          for (let t = 0; t <= m; t += 1) {
            const v = t < m && solid[t]
            if (v && s === undefined) s = t
            if (!v && s !== undefined) { runs.push({ from: s, to: t - 1 }); s = undefined }
          }
          // Bridge one-or-two pixel breaks (anti-aliasing at a junction) and drop stubs.
          const merged: Array<{ from: number; to: number }> = []
          for (const r of runs) {
            const last = merged[merged.length - 1]
            if (last && r.from - last.to <= 3) last.to = r.to
            else merged.push({ ...r })
          }
          options.onDebug?.({ axis: vertical ? 'Z' : 'X', centrePx: (vertical ? px0 : py0) + (i + j) / 2, thick, runsPx: merged })
          for (const run of merged.filter((r) => r.to - r.from + 1 >= minPiecePx * 0.35)) {
            const pieceCounts: number[] = []
            const centres: number[] = []
            for (let t = run.from; t <= run.to; t += 1) {
              if (counts[t] > 0) {
                pieceCounts.push(lastDark[t] - firstDark[t] + 1)
                centres.push((firstDark[t] + lastDark[t]) / 2)
              }
            }
            const pieceThick = medianOf(pieceCounts)
            const centre = medianOf(centres)
            if (pieceThick < minThick - 1 || pieceThick > capAcross(vertical, centre, dom ? (run.from + run.to) / 2 : undefined)) continue
            // LINK-F1B: a piece flush against the window's edge whose ink runs on across that edge into the outer wall
            // beyond it (dark just outside the window along most of the piece) is that wall's own ink — drawn thicker
            // than the model's wall, or the body cut on a line beside its face — not a partition beside it. A partition
            // standing in the room has paper between it and the wall.
            if (dom) {
              // v3.53.6: on a zone the edge is wherever the floor ends beside the piece: off the floor within two
              // pixels of the band along most of the piece, and dark there
              let flush = false
              for (const low of [true, false]) {
                let off = 0
                let joined = 0
                for (let t = run.from; t <= run.to; t += 1) {
                  const k = [1, 2].map((d) => (low ? i - d : j + d)).find((c) => !(vertical ? inDom(c, t) : inDom(t, c)))
                  if (k === undefined) continue
                  off += 1
                  if (lumaAt(raster, vertical ? px0 + k : px0 + t, vertical ? py0 + t : py0 + k) < 200) joined += 1
                }
                if (off >= 0.8 * (run.to - run.from + 1) && joined >= 0.8 * (run.to - run.from + 1)) flush = true
              }
              if (flush) continue
            }
            const lowEdge = !dom && i <= 1
            const highEdge = !dom && j >= n - 2
            if (lowEdge || highEdge) {
              let joined = 0
              for (let t = run.from; t <= run.to; t += 1) {
                const k = lowEdge ? -1 : n
                const xw = vertical ? px0 + k : px0 + t
                const yw = vertical ? py0 + t : py0 + k
                if (lumaAt(raster, xw, yw) < 200) joined += 1
              }
              if (joined >= 0.8 * (run.to - run.from + 1)) continue
            }
            axes.push({ centre, thick: pieceThick, runs: [run] })
          }
        }
        i = j + 1
      } else i += 1
    }
    return axes.filter((a) => a.runs.length > 0)
  }

  const verticalAxes = axesAlong(true)
  const horizontalAxes = axesAlong(false)
  // v3.53.6: a wall the floor's edge cuts short. On a zone the line between two bodies runs across walls that stand
  // square to it: a garage's side wall carries on into the house as the wall beside its door, and the part of it past
  // the bodies' line is a stub a hand long — too short to be read as a piece, though the wall is metres long. A stub
  // is a piece when its ink runs on off the floor, in the outer wall's place, far enough that the whole is a piece's
  // length (`minPieceM`), it stands at least three pixels onto the floor, and it is a partition's thickness across.
  if (zone && dom) {
    for (const vertical of [true, false]) {
      const n = vertical ? W : H
      const m = vertical ? H : W
      const inkAt = (c: number, t: number): boolean => (vertical ? at(c, t) === 1 : at(t, c) === 1)
      const onDom = (c: number, t: number): boolean => (vertical ? inDom(c, t) : inDom(t, c))
      const rawInk = (c: number, t: number): boolean => (vertical ? wallInk(raster, px0 + c, py0 + t) : wallInk(raster, px0 + t, py0 + c))
      for (const dir of [1, -1] as const) {
        for (let t = 0; t < m; t += 1) {
          let c = 0
          while (c < n) {
            // a run across, on the floor's last row before it ends in the direction `dir` along
            if (!(inkAt(c, t) && !onDom(c, t + dir))) {
              c += 1
              continue
            }
            let e = c
            while (e + 1 < n && inkAt(e + 1, t) && !onDom(e + 1, t + dir)) e += 1
            const width = e - c + 1
            const mid = Math.round((c + e) / 2)
            let inDepth = 0
            while (inkAt(mid, t - dir * inDepth) && onDom(mid, t - dir * inDepth)) inDepth += 1
            let outDepth = 0
            while (outDepth < 4 * minPiecePx && !onDom(mid, t + dir * (1 + outDepth)) && rawInk(mid, t + dir * (1 + outDepth))) outDepth += 1
            const from = dir > 0 ? t - inDepth + 1 : t
            const to = dir > 0 ? t : t + inDepth - 1
            const known = (vertical ? verticalAxes : horizontalAxes).some((a) => Math.abs(a.centre - (c + e) / 2) <= Math.max(a.thick, width) / 2 + 1 && a.runs.some((r) => r.from <= to + 1 && r.to >= from - 1))
            if (!known && width >= minThick && width <= capAcross(vertical, (c + e) / 2, t - dir * Math.min(inDepth - 1, 1)) && inDepth >= 3 && inDepth < minPiecePx * 0.35 && outDepth >= wallPx * 0.8 && inDepth + outDepth >= minPiecePx) {
              ;(vertical ? verticalAxes : horizontalAxes).push({ centre: (c + e) / 2, thick: width, runs: [{ from, to }] })
            }
            c = e + 1
          }
        }
      }
    }
  }

  // World conversion of interior pixel coordinates.
  const worldX = (x: number): number => plan.toWorld(px0 + x, py0).x
  const worldZ = (y: number): number => plan.toWorld(px0, py0 + y).z

  const walls: InteriorWallPiece[] = []
  const doors: InteriorDoorGap[] = []
  const pieceOf = (vertical: boolean, axis: Axis, run: { from: number; to: number }, index: number): InteriorWallPiece => {
    const atWorld = vertical ? worldX(axis.centre) : worldZ(axis.centre)
    const a = vertical ? worldZ(run.to + 1) : worldX(run.from)
    const b = vertical ? worldZ(run.from) : worldX(run.to + 1)
    const from = Math.min(a, b)
    const to = Math.max(a, b)
    const half = axis.thick / 2
    const pixelRect: PixelRect = vertical
      ? { x0: round6(px0 + axis.centre - half), y0: py0 + run.from, x1: round6(px0 + axis.centre + half), y1: py0 + run.to }
      : { x0: px0 + run.from, y0: round6(py0 + axis.centre - half), x1: px0 + run.to, y1: round6(py0 + axis.centre + half) }
    return {
      id: `iwall-${storeyIndex}-${vertical ? 'z' : 'x'}-${index}`,
      storeyIndex,
      axis: vertical ? 'Z' : 'X',
      at: round6(atWorld),
      from: round6(from),
      to: round6(to),
      thicknessM: round6(axis.thick * mpp),
      ends: { start: 'FREE', end: 'FREE' },
      pixelRect,
      confidence: 0.6,
      why: `${(axis.thick * mpp).toFixed(2)} m of neutral ink running ${(to - from).toFixed(2)} m along ${vertical ? 'z' : 'x'} at ${vertical ? 'x' : 'z'} ${atWorld.toFixed(2)}`,
    }
  }
  let index = 0
  for (const axis of verticalAxes) for (const run of axis.runs) walls.push(pieceOf(true, axis, run, index++))
  index = 0
  for (const axis of horizontalAxes) for (const run of axis.runs) walls.push(pieceOf(false, axis, run, index++))

  /** v3.53.6: how far the zone's floor runs from `pos` along a line (`axis` the line runs along, at `at` across), `dir` ±1. */
  const floorReach = (axis: 'X' | 'Z', at: number, pos: number, dir: 1 | -1): number => {
    let p = pos
    for (let guard = 0; zone && guard <= zone.length; guard += 1) {
      const probe = p + dir * 1e-4
      const on = zone.filter((r) => (axis === 'Z' ? at >= r.x0 - 1e-9 && at <= r.x1 + 1e-9 && probe >= r.z0 && probe <= r.z1 : at >= r.z0 - 1e-9 && at <= r.z1 + 1e-9 && probe >= r.x0 && probe <= r.x1))
      if (on.length === 0) break
      const next = dir > 0 ? Math.max(...on.map((r) => (axis === 'Z' ? r.z1 : r.x1))) : Math.min(...on.map((r) => (axis === 'Z' ? r.z0 : r.x0)))
      if (Math.abs(next - p) < 1e-9) break
      p = next
    }
    return p
  }
  // Junctions: an end within a wall thickness of the body's inner face or of a perpendicular piece.
  const near = (v: number, target: number, tol: number): boolean => Math.abs(v - target) <= tol
  const tol = drawnM * 0.9
  for (const w of walls) {
    const perpendicular = walls.filter((o) => o.axis !== w.axis)
    const touches = (end: number): boolean => {
      if (zone) {
        // v3.53.6: on a zone a wall's end meets the outer wall where the floor ends along its own line within reach
        for (let d = -tol; d <= tol + 1e-9; d += Math.max(mpp / 2, 0.01)) if (w.axis === 'Z' ? !onFloor(w.at, end + d) : !onFloor(end + d, w.at)) return true
        return perpendicular.some((o) => near(o.at, end, tol) && o.from - tol <= w.at && o.to + tol >= w.at)
      }
      if (w.axis === 'Z') {
        if (near(end, inner.z0, tol) || near(end, inner.z1, tol)) return true
        return perpendicular.some((o) => near(o.at, end, tol) && o.from - tol <= w.at && o.to + tol >= w.at)
      }
      if (near(end, inner.x0, tol) || near(end, inner.x1, tol)) return true
      return perpendicular.some((o) => near(o.at, end, tol) && o.from - tol <= w.at && o.to + tol >= w.at)
    }
    w.ends = { start: touches(w.from) ? 'JUNCTION' : 'FREE', end: touches(w.to) ? 'JUNCTION' : 'FREE' }
    w.confidence = round6(w.ends.start === 'JUNCTION' && w.ends.end === 'JUNCTION' ? 0.8 : w.ends.start === 'JUNCTION' || w.ends.end === 'JUNCTION' ? 0.65 : 0.35)
  }

  // v3.53.6: a door's jambs drawn as nibs. A door set between two walls that run on past it — at the end of a
  // corridor, into an alcove — hangs between two short returns, one on each wall's face, a hand or two long: too short
  // to be read as pieces (`minPieceM`), so the doorway had no jamb and the room behind it ran into the corridor. A nib
  // is a run of ink standing {@link NIB_MIN_PX} pixels to {@link NIB_MAX_M} off the face of a piece, a partition's
  // thickness along that face, with the face bare either side of it. It is a jamb, never a wall of its own: it is kept
  // only when a door is read at its end, and a door with a nib for a jamb is read only where the plan draws its swing.
  const nibIds = new Set<string>()
  const nibs: InteriorWallPiece[] = []
  {
    const maxNib = Math.max(NIB_MIN_PX + 1, Math.round(NIB_MAX_M / mpp))
    const found: InteriorWallPiece[] = []
    for (const host of walls) {
      const vertical = host.axis === 'Z'
      const r = host.pixelRect
      const centre = (vertical ? (r.x0 + r.x1) / 2 - px0 : (r.y0 + r.y1) / 2 - py0)
      const half = (vertical ? r.x1 - r.x0 : r.y1 - r.y0) / 2
      const [t0, t1] = vertical ? [r.y0 - py0, r.y1 - py0] : [r.x0 - px0, r.x1 - px0]
      const inkAt = (c: number, t: number): boolean => (vertical ? at(c, t) === 1 : at(t, c) === 1)
      for (const side of [1, -1] as const) {
        const reach = (t: number): number => {
          // how far the ink stands off the piece's face at this position along it; Infinity where it runs on (a wall)
          const c0 = Math.round(centre)
          if (!inkAt(c0, t)) return 0
          let c = c0
          while (Math.abs(c + side - c0) <= half + maxNib + 2 && inkAt(c + side, t)) c += side
          const off = Math.abs(c - c0) - half
          return off > maxNib ? Number.POSITIVE_INFINITY : off
        }
        let t = Math.round(t0)
        while (t <= t1) {
          if (!(reach(t) >= NIB_MIN_PX && Number.isFinite(reach(t)))) {
            t += 1
            continue
          }
          let e = t
          while (e + 1 <= t1 && reach(e + 1) >= NIB_MIN_PX && Number.isFinite(reach(e + 1))) e += 1
          const thick = e - t + 1
          const bare = (q: number): boolean => q < t0 || q > t1 || reach(q) < NIB_MIN_PX
          const offs: number[] = []
          for (let q = t; q <= e; q += 1) offs.push(reach(q))
          const off = medianOf(offs)
          if (thick >= minThick - 1 && thick <= thinThick && bare(t - 1) && bare(e + 1)) {
            const face = centre + side * half
            const tip = face + side * off
            const across = (t + e + 1) / 2
            const [u0, u1] = vertical ? [worldX(Math.min(face, tip) + 0.5), worldX(Math.max(face, tip) + 0.5)] : [worldZ(Math.max(face, tip) + 0.5), worldZ(Math.min(face, tip) + 0.5)]
            const line = vertical ? worldZ(across) : worldX(across)
            const from = round6(Math.min(u0, u1))
            const to = round6(Math.max(u0, u1))
            const axis: 'X' | 'Z' = vertical ? 'X' : 'Z'
            const taken = [...walls, ...found].some((o) => o.axis === axis && Math.abs(o.at - line) <= drawnM * 0.5 && o.from < to + 0.02 && o.to > from - 0.02)
            if (!taken) {
              // its end on the host's face is a junction; the other is where the door hangs
              const atHostLow = Math.abs(from - host.at) < Math.abs(to - host.at)
              const id = `nib-${storeyIndex}-${found.length}`
              found.push({ id, storeyIndex, axis, at: round6(line), from, to, thicknessM: round6(thick * mpp), ends: atHostLow ? { start: 'JUNCTION', end: 'FREE' } : { start: 'FREE', end: 'JUNCTION' }, pixelRect: vertical ? { x0: round6(px0 + Math.min(face, tip)), y0: py0 + t, x1: round6(px0 + Math.max(face, tip)), y1: py0 + e } : { x0: px0 + t, y0: round6(py0 + Math.min(face, tip)), x1: px0 + e, y1: round6(py0 + Math.max(face, tip)) }, confidence: 0.5, why: `a ${(to - from).toFixed(2)} m nib standing off the face of ${host.id}: a door's jamb` })
            }
          }
          t = e + 1
        }
      }
    }
    for (const n of found) {
      nibs.push(n)
      nibIds.add(n.id)
    }
  }

  // Solid blocks: neutral ink thicker than a thin partition in both directions (a chimney, a column).
  const blocks: SolidBlock[] = []
  // 005W-N1: compact cores recovered from regions a partition runs into. They go out with the reading (the chimneys are
  // read from them) but stay out of the partitions, doors and rooms below, which read as before.
  const cores: Array<Omit<SolidBlock, 'id'>> = []
  {
    const seen = new Uint8Array(W * H)
    const thickEnough = (x: number, y: number): boolean => at(x, y) === 1 && hRun[y * W + x] > thinThick && vRun[y * W + x] > thinThick
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        if (seen[y * W + x] || !thickEnough(x, y)) continue
        // flood
        const stack = [[x, y]]
        const region: number[] = []
        let minX = x
        let maxX = x
        let minY = y
        let maxY = y
        let n = 0
        seen[y * W + x] = 1
        while (stack.length > 0) {
          const [cx, cy] = stack.pop() as [number, number]
          region.push(cy * W + cx)
          n += 1
          if (cx < minX) minX = cx
          if (cx > maxX) maxX = cx
          if (cy < minY) minY = cy
          if (cy > maxY) maxY = cy
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            const nx = cx + dx
            const ny = cy + dy
            if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny * W + nx] || !thickEnough(nx, ny)) continue
            seen[ny * W + nx] = 1
            stack.push([nx, ny])
          }
        }
        const bw = (maxX - minX + 1) * mpp
        const bh = (maxY - minY + 1) * mpp
        const fill = n / ((maxX - minX + 1) * (maxY - minY + 1))
        const push = (r: { minX: number; maxX: number; minY: number; maxY: number }, fillOf: number, how: string, into: 'blocks' | 'cores'): void => {
          const a = plan.toWorld(px0 + r.minX, py0 + r.maxY + 1)
          const b = plan.toWorld(px0 + r.maxX + 1, py0 + r.minY)
          // LINK-F1B: the window was cut to whole pixels inside the inner faces and a block's far edge is one past its last
          // pixel, so it may reach up to a pixel into the external wall it stands against; it is read inside the body
          const block = { storeyIndex, x0: round6(Math.max(a.x, inner.x0)), z0: round6(Math.max(a.z, inner.z0)), x1: round6(Math.min(b.x, inner.x1)), z1: round6(Math.min(b.z, inner.z1)), pixelRect: { x0: px0 + r.minX, y0: py0 + r.minY, x1: px0 + r.maxX + 1, y1: py0 + r.maxY + 1 }, why: `a ${((r.maxX - r.minX + 1) * mpp).toFixed(2)} × ${((r.maxY - r.minY + 1) * mpp).toFixed(2)} m block of solid ink (${Math.round(fillOf * 100)} % filled)${how}` }
          if (into === 'blocks') blocks.push({ id: `block-${storeyIndex}-${blocks.length}`, ...block })
          else cores.push(block)
        }
        if (bw >= 0.3 && bh >= 0.3 && bw <= 1.6 && bh <= 1.6 && fill >= 0.7) push({ minX, maxX, minY, maxY }, fill, '', 'blocks')
        else if (bw >= 0.3 && bh >= 0.3 && fill < 0.7) {
          // 005W-N1: a block a partition runs into is one region with it, and the partition's length empties the
          // region's box. Its compact core is what is left of the region where the ink runs, inside the region, at
          // least the block minimum (0.3 m) both across and along — the partition's thin arm falls away, a crossing of
          // two thin partitions leaves only the crossing. The core must then pass the same box and fill tests as any
          // block, which a crossing, a partition thick, does not.
          const core = coreOfRegion(region, W, Math.ceil(0.3 / mpp))
          for (const c of core) {
            const cw = (c.maxX - c.minX + 1) * mpp
            const ch = (c.maxY - c.minY + 1) * mpp
            const cf = c.n / ((c.maxX - c.minX + 1) * (c.maxY - c.minY + 1))
            if (cw >= 0.3 && ch >= 0.3 && cw <= 1.6 && ch <= 1.6 && cf >= 0.7) push(c, cf, `, the compact core of a ${bw.toFixed(2)} × ${bh.toFixed(2)} m region a partition runs into`, 'cores')
          }
        }
      }
    }
  }

  // A piece that lies along a solid block's edge is the block's outline, not a partition (it is dropped below).
  const onBlock = (w: InteriorWallPiece): boolean =>
    blocks.some((b) => {
      const pad = drawnM * 0.2
      if (w.axis === 'Z') return w.at >= b.x0 - pad && w.at <= b.x1 + pad && w.from >= b.z0 - pad && w.to <= b.z1 + pad
      return w.at >= b.z0 - pad && w.at <= b.z1 + pad && w.from >= b.x0 - pad && w.to <= b.x1 + pad
    })

  // Door gaps: between two collinear pieces on one axis, 0.6..1.35 m apart, where at least one piece is anchored.
  const cornerGaps: Array<{ a: InteriorWallPiece; b: InteriorWallPiece }> = []
  const byAxis = new Map<string, InteriorWallPiece[]>()
  // A solid block standing on a partition's line is a jamb for a door beside it.
  const pseudo: InteriorWallPiece[] = []
  for (const b of blocks) {
    for (const axis of ['Z', 'X'] as const) {
      const lo = axis === 'Z' ? b.x0 : b.z0
      const hi = axis === 'Z' ? b.x1 : b.z1
      for (const w of walls) {
        if (w.axis !== axis || w.at < lo - drawnM * 0.3 || w.at > hi + drawnM * 0.3) continue
        // N8-02B: a block against the body's inner face that the piece itself runs through end to end — the piece
        // thickening where it meets the outer wall — is no jamb beside a gap: as one it would stand between the piece
        // and the piece across a door, and hide the door
        const [from, to] = axis === 'Z' ? [b.z0, b.z1] : [b.x0, b.x1]
        const midAcross = axis === 'Z' ? (b.x0 + b.x1) / 2 : (b.z0 + b.z1) / 2
        const againstFace = zone
          ? [from - 0.021, to + 0.021].some((v) => (axis === 'Z' ? !onFloor(midAcross, v) : !onFloor(v, midAcross)))
          : Math.min(Math.abs(from - (axis === 'Z' ? inner.z0 : inner.x0)), Math.abs(to - (axis === 'Z' ? inner.z1 : inner.x1))) <= 0.02
        if (againstFace && w.from <= from + 0.02 && w.to >= to - 0.02) break
        pseudo.push({ ...w, id: `${b.id}:${axis}`, from: axis === 'Z' ? b.z0 : b.x0, to: axis === 'Z' ? b.z1 : b.x1, ends: { start: 'JUNCTION', end: 'JUNCTION' }, confidence: 0.5, why: `the edge of ${b.id}` })
        break
      }
    }
  }
  // N8-03D2: one line is the pieces whose drawn bands overlap across it, as well as those within the old bucket: a piece
  // that runs into a block or a wardrobe's carcass is measured thicker there, its centre moved off the line by half
  // the extra, and must still pair with the piece across the door from it
  {
    const all = [...walls, ...pseudo]
    const parent = all.map((_, i) => i)
    const root = (i: number): number => (parent[i] === i ? i : (parent[i] = root(parent[i])))
    const bucket = (w: InteriorWallPiece): number => Math.round(w.at / (drawnM * 0.5))
    for (let i = 0; i < all.length; i += 1) {
      for (let j = i + 1; j < all.length; j += 1) {
        const a = all[i]
        const b = all[j]
        if (a.axis !== b.axis) continue
        if (bucket(a) === bucket(b) || Math.abs(a.at - b.at) <= (a.thicknessM + b.thicknessM) / 2) parent[root(j)] = root(i)
      }
    }
    all.forEach((w, i) => {
      const key = `${w.axis}:${root(i)}`
      byAxis.set(key, [...(byAxis.get(key) ?? []), w])
    })
  }
  for (const [, pieces] of byAxis) {
    const sorted = [...pieces].sort((a, b) => a.from - b.from)
    // N8-03D2: the jamb before a gap is the piece reaching furthest along so far — a block's edge lying inside a wall's
    // extent is not the end of that wall
    // and never a block's outline, which is dropped below and would take the door with it
    let reach = sorted[0]
    for (let i = 0; i + 1 < sorted.length; i += 1) {
      if (sorted[i].to > reach.to + 1e-9 && !(onBlock(sorted[i]) && !sorted[i].id.includes(':'))) reach = sorted[i]
      if (onBlock(reach) && !reach.id.includes(':') && !(onBlock(sorted[i]) && !sorted[i].id.includes(':'))) reach = sorted[i]
      const a = reach
      const b = sorted[i + 1]
      const gap = b.from - a.to
      // Both jambs must be walls in their own right: anchored at an end, or long enough to be more than a stub.
      const jamb = (w: InteriorWallPiece): boolean => w.ends.start === 'JUNCTION' || w.ends.end === 'JUNCTION' || w.to - w.from >= 0.45
      // A gap a perpendicular partition runs THROUGH is a passage between two
      // different walls (a corridor crossing), not a door in one wall.
      const crossed = walls.some((w) => w.axis !== a.axis && w.at > a.to + 0.05 && w.at < b.from - 0.05 && w.from < a.at - 0.1 && w.to > a.at + 0.1)
      // And a gap whose BOTH jambs are corners with perpendicular partitions
      // is the width of a room or a corridor between two walls, not a door.
      const cornerAt = (pos: number): boolean => walls.some((w) => w.axis !== a.axis && Math.abs(w.at - pos) <= Math.max(0.13, w.thicknessM + 0.05) && w.from < a.at + 0.1 && w.to > a.at - 0.1)
      const passage = cornerAt(a.to) && cornerAt(b.from)
      // A gap between two block edges is a door only when a wall piece is one
      // of its jambs; and no gap is a door where a wall piece runs through it.
      const bothBlocks = a.id.includes(':') && b.id.includes(':')
      const walled = walls.some((w) => w !== a && w !== b && w.axis === a.axis && Math.abs(w.at - a.at) <= drawnM * 0.5 && w.from < b.from - 0.05 && w.to > a.to + 0.05)
      // v3.53.6: a gap between two corners that is otherwise a door's is weighed again below, on the swing the plan draws
      if (gap >= opt.doorMinM && gap <= opt.doorMaxM && jamb(a) && jamb(b) && !crossed && passage && !bothBlocks && !walled) cornerGaps.push({ a, b })
      if (gap >= opt.doorMinM && gap <= opt.doorMaxM && jamb(a) && jamb(b) && !crossed && !passage && !bothBlocks && !walled) {
        doors.push({
          id: `idoor-${storeyIndex}-${doors.length}`,
          storeyIndex,
          wallAxis: a.axis,
          at: round6((a.at + b.at) / 2),
          from: round6(a.to),
          to: round6(b.from),
          widthM: round6(gap),
          betweenIds: [a.id, b.id],
          confidence: round6(Math.min(a.confidence, b.confidence) * 0.95),
          why: `a ${gap.toFixed(2)} m break between two pieces of the same partition`,
        })
      }
    }
  }

  // N8-02B: a door at the end of a partition. A piece free at both ends whose end stands on the line of a perpendicular
  // piece, a door's width past that piece's end, is the far jamb of a door in that line when the plan draws the door's
  // swing in the gap (a quarter arc from either jamb, on either side): the door is cut there, and the piece is a wall.
  // Without a drawn swing the gap stays a passage or nothing, as before.
  // N8-03D2: the wall across the line may be a solid block's side (a chimney, a column) as well as a partition; and the
  // swing may be a leaf shorter than the gap (`doorSwingInGap`)
  const blockSides: InteriorWallPiece[] = blocks.flatMap((b) => [
    { ...sidePiece(b, 'X', b.z0, b.x0, b.x1), id: `${b.id}:side-z0` },
    { ...sidePiece(b, 'X', b.z1, b.x0, b.x1), id: `${b.id}:side-z1` },
    { ...sidePiece(b, 'Z', b.x0, b.z0, b.z1), id: `${b.id}:side-x0` },
    { ...sidePiece(b, 'Z', b.x1, b.z0, b.z1), id: `${b.id}:side-x1` },
  ])
  const jambIds = new Set<string>()
  for (const w of walls) {
    // N8-03D2: any free end, of any piece: a piece anchored at its other end, or the jamb of a door already read, may
    // still end a door's width short of the wall across its line
    for (const end of [w.from, w.to]) {
      if ((end === w.from ? w.ends.start : w.ends.end) === 'JUNCTION') continue
      for (const o of [...walls, ...blockSides]) {
        // a block's side is a face, not a band: the piece's end stands on it within the hinge's own slack across
        if (o === w || o.axis === w.axis || Math.abs(o.at - end) > Math.max(drawnM * 0.5, o.thicknessM, o.id.includes(':side') ? 2 * HINGE_ACROSS_M : 0)) continue
        if (!(o.ends.start === 'JUNCTION' || o.ends.end === 'JUNCTION' || o.to - o.from >= 0.45)) continue
        const near = w.at - w.thicknessM / 2
        const far = w.at + w.thicknessM / 2
        const gap: [number, number] | undefined = o.to <= near ? [o.to, near] : o.from >= far ? [far, o.from] : undefined
        if (!gap || gap[1] - gap[0] < opt.doorMinM || gap[1] - gap[0] > opt.doorMaxM) continue
        const walled = walls.some((x) => x !== o && x.axis === o.axis && Math.abs(x.at - o.at) <= drawnM * 0.5 && x.from < gap[1] - 0.05 && x.to > gap[0] + 0.05)
        const already = doors.some((d) => d.wallAxis === o.axis && Math.abs(d.at - o.at) <= drawnM * 0.5 && d.from < gap[1] - 0.05 && d.to > gap[0] + 0.05)
        const leaf = walled || already ? undefined : doorSwingInGap(raster, plan, o.axis, o.at, gap)
        if (!leaf) continue
        doors.push({
          id: `idoor-${storeyIndex}-${doors.length}`,
          storeyIndex,
          wallAxis: o.axis,
          at: o.at,
          from: round6(gap[0]),
          to: round6(gap[1]),
          widthM: round6(gap[1] - gap[0]),
          betweenIds: [o.id, `${w.id}:jamb`],
          confidence: round6(Math.min(o.confidence, 0.6) * 0.95),
          why: `a ${(gap[1] - gap[0]).toFixed(2)} m gap between the end of a partition and the ${o.id.includes(':side') ? 'side of the solid block' : 'wall'} across its line, its swing drawn${leaf.short ? ` (a ${leaf.radius.toFixed(2)} m leaf, shorter than the gap)` : ''}: a door, the wall across its far jamb`,
        })
        jambIds.add(w.id)
        break
      }
      // N8-03D2: and on to its other end — a partition between two doors is the jamb of both
    }
  }

  // N8-03A: a door at the end of a partition against the outer wall. A free end of a piece a door's width short of the
  // body's inner face, nothing of the piece's line between, is the near jamb of a door in that line when the plan draws
  // the door's swing in the gap and the outer wall's ink at its far jamb: the door is cut there, and the piece is a wall.
  // Without a drawn swing the gap stays a passage, as before.
  for (const w of walls) {
    for (const atStart of [true, false]) {
      if ((atStart ? w.ends.start : w.ends.end) === 'JUNCTION') continue
      const lo = zone ? floorReach(w.axis, w.at, w.from, -1) : w.axis === 'Z' ? inner.z0 : inner.x0
      const hi = zone ? floorReach(w.axis, w.at, w.to, 1) : w.axis === 'Z' ? inner.z1 : inner.x1
      const gap: [number, number] = atStart ? [lo, w.from] : [w.to, hi]
      const width = gap[1] - gap[0]
      if (width < opt.doorMinM || width > opt.doorMaxM) continue
      if (walls.some((x) => x !== w && x.axis === w.axis && Math.abs(x.at - w.at) <= drawnM * 0.5 && x.from < gap[1] - 0.05 && x.to > gap[0] + 0.05)) continue
      if (doors.some((d) => d.wallAxis === w.axis && Math.abs(d.at - w.at) <= drawnM * 0.5 && d.from < gap[1] - 0.05 && d.to > gap[0] + 0.05)) continue
      // the outer wall at the far jamb: wall ink over most of the band from half a drawn wall to a drawn wall past the face
      const face = atStart ? lo : hi
      const out = atStart ? -1 : 1
      let n = 0
      let inked = 0
      for (let d = drawnM * 0.5; d <= drawnM + 1e-9; d += mpp) {
        const along = face + out * d
        const p = w.axis === 'Z' ? plan.toPixel(w.at, along) : plan.toPixel(along, w.at)
        n += 1
        if (wallInk(raster, Math.round(p.x), Math.round(p.y))) inked += 1
      }
      if (n === 0 || inked < 0.5 * n) continue
      // a leaf hinges at a face: of the partition (either side) or of the outer wall where the plan draws it, which may
      // stand a little past the face the body puts it at — the swing is looked for from each
      let drawnJamb: number | undefined
      for (let d = -drawnM * 0.5; d <= drawnM + 1e-9; d += mpp) {
        const along = face + out * d
        const p = w.axis === 'Z' ? plan.toPixel(w.at, along) : plan.toPixel(along, w.at)
        if (wallInk(raster, Math.round(p.x), Math.round(p.y))) {
          drawnJamb = along
          break
        }
      }
      const spans: Array<[number, number]> = [gap, ...(drawnJamb !== undefined ? [(atStart ? [drawnJamb, gap[1]] : [gap[0], drawnJamb]) as [number, number]] : [])]
      const swing = spans.some((g) => [w.at, w.at - w.thicknessM / 2, w.at + w.thicknessM / 2].some((line) => swingDrawn(raster, plan, w.axis, line, g))) || spans.some((g) => !!doorSwingInGap(raster, plan, w.axis, w.at, g))
      if (!swing) continue
      doors.push({
        id: `idoor-${storeyIndex}-${doors.length}`,
        storeyIndex,
        wallAxis: w.axis,
        at: w.at,
        from: round6(gap[0]),
        to: round6(gap[1]),
        widthM: round6(width),
        betweenIds: atStart ? [`${w.id}:face`, w.id] : [w.id, `${w.id}:face`],
        confidence: round6(Math.min(w.confidence, 0.6) * 0.95),
        why: `a ${width.toFixed(2)} m gap between the end of a partition and the outer wall's inner face, its swing drawn and the outer wall drawn at its far jamb: a door, the outer wall its far jamb`,
      })
      jambIds.add(w.id)
    }
  }

  // N8-03D2: a door across the ends of two parallel partitions. Two pieces on parallel lines a door's width apart (face
  // to face), one ending where the other starts — their free ends at the same place along, the pieces running away from
  // each other, overlapping by no more than {@link STAGGER_MAX_M} — leave a doorway square to them between their faces:
  // a door there when the plan draws its swing in it (`doorSwingInGap`). Nothing else stands in the doorway (no wall of
  // either line between them, no wall across it). The door is a room boundary; it has no wall of its own to be cut in.
  for (let i = 0; i < walls.length; i += 1) {
    for (let j = 0; j < walls.length; j += 1) {
      const a = walls[i]
      const b = walls[j]
      // a ends (its `to`) where b starts (its `from`): a runs towards b's start and stops, b runs on from there
      if (i === j || a.axis !== b.axis || a.ends.end === 'JUNCTION' || b.ends.start === 'JUNCTION') continue
      const overlap = a.to - b.from
      if (overlap < 0 || overlap > STAGGER_MAX_M) continue
      const lowLine = Math.min(a.at, b.at)
      const highLine = Math.max(a.at, b.at)
      const lowT = (a.at < b.at ? a : b).thicknessM
      const highT = (a.at < b.at ? b : a).thicknessM
      const gap: [number, number] = [round6(lowLine + lowT / 2), round6(highLine - highT / 2)]
      const width = gap[1] - gap[0]
      if (width < opt.doorMinM || width > opt.doorMaxM) continue
      const across: 'X' | 'Z' = a.axis === 'X' ? 'Z' : 'X'
      // nothing stands in the doorway: no piece parallel to them between their lines over the overlap, none across it
      const blocked = walls.some((w) => w !== a && w !== b && ((w.axis === a.axis && w.at > gap[0] && w.at < gap[1] && w.from < a.to && w.to > b.from) || (w.axis === across && w.at >= b.from - 0.05 && w.at <= a.to + 0.05 && w.from < gap[1] && w.to > gap[0])))
      if (blocked) continue
      let found: { line: number; leaf: NonNullable<ReturnType<typeof doorSwingInGap>> } | undefined
      for (let line = b.from; line <= a.to + 1e-9 && !found; line += Math.max(mpp, 0.08)) {
        const leaf = doorSwingInGap(raster, plan, across, line, gap)
        if (leaf) found = { line, leaf }
      }
      if (!found) continue
      const line = round6((b.from + a.to) / 2)
      doors.push({
        id: `idoor-${storeyIndex}-${doors.length}`,
        storeyIndex,
        wallAxis: across,
        at: line,
        from: gap[0],
        to: gap[1],
        widthM: round6(width),
        betweenIds: [`${a.id}:end`, `${b.id}:start`],
        confidence: round6(Math.min(a.confidence, b.confidence, 0.6) * 0.95),
        why: `a ${width.toFixed(2)} m doorway between the faces of two parallel partitions whose ends meet along (${overlap.toFixed(2)} m overlap), its swing drawn${found.leaf.short ? ` (a ${found.leaf.radius.toFixed(2)} m leaf)` : ''}: a door with no wall of its own`,
      })
      jambIds.add(a.id)
      jambIds.add(b.id)
    }
  }

  // v3.53.6: the doors the rules above leave unread, each only where the plan draws the door's swing, and none where a
  // door is read already or where the storey has no floor (a stair's flight). They are read last, so the doors read
  // before keep their order (and their ids).
  const offFloor = (axis: 'X' | 'Z', line: number, gap: [number, number]): boolean => {
    const mid = (gap[0] + gap[1]) / 2
    const [x, z] = axis === 'X' ? [mid, line] : [line, mid]
    return (options.extraBarriers ?? []).some((r) => x >= r.x0 - 0.1 && x <= r.x1 + 0.1 && z >= r.z0 - 0.1 && z <= r.z1 + 0.1)
  }
  const noteSwing = (rule: string, axis: 'X' | 'Z', line: number, gap: [number, number], probe: { traced: number; at?: string }, found: boolean): void => options.onNote?.(`doorway ${rule} ${axis}@${line.toFixed(2)}:${gap[0].toFixed(2)}..${gap[1].toFixed(2)}: at most ${Math.round(probe.traced * 100)} % of a quarter arc is a drawn line${probe.at ? ` (${probe.at})` : ''}: ${found ? 'a door' : 'no door'}`)
  const tracedShare = (leaf: { traced?: number }): string => `${Math.round((leaf.traced ?? 0) * 100)} % of its arc a drawn line`
  const doorAt = (axis: 'X' | 'Z', line: number, gap: [number, number]): boolean => doors.some((d) => d.wallAxis === axis && Math.abs(d.at - line) <= drawnM * 0.5 && d.from < gap[1] - 0.05 && d.to > gap[0] + 0.05)
  // a door hung between two corners: the last stretch of a wall before the wall across it, its other jamb the corner of
  // the next room. Without a drawn swing it is the width of a room or a corridor, as before
  for (const { a, b } of cornerGaps) {
    const gap: [number, number] = [a.to, b.from]
    const line = round6((a.at + b.at) / 2)
    if (doorAt(a.axis, line, gap) || offFloor(a.axis, line, gap)) continue
    const probe: { traced: number; at?: string } = { traced: 0 }
    const leaf = swingArcInDoorway(raster, plan, a.axis, line, gap, probe)
    noteSwing('between two corners', a.axis, line, gap, probe, !!leaf)
    if (!leaf) continue
    doors.push({ id: `idoor-${storeyIndex}-${doors.length}`, storeyIndex, wallAxis: a.axis, at: line, from: round6(gap[0]), to: round6(gap[1]), widthM: round6(gap[1] - gap[0]), betweenIds: [a.id, b.id], confidence: round6(Math.min(a.confidence, b.confidence) * 0.9), why: `a ${(gap[1] - gap[0]).toFixed(2)} m break between two pieces of the same partition, each at a corner with a wall across, its swing drawn (${tracedShare(leaf)}, a ${leaf.radius.toFixed(2)} m leaf): a door hung between two corners` })
  }
  // v3.53.6: a door between a partition's free end and the wall ACROSS its line. A piece that stops a door's width
  // short of a perpendicular piece running through its line (a T, where N8-02B reads the L: the wall across ending at
  // the line) leaves a doorway between its end and that wall's face: a door there when the plan draws its swing in it.
  // Without a drawn swing the gap stays what it was. The wall across is the door's far jamb.
  for (const w of walls) {
    for (const atStart of [true, false]) {
      if ((atStart ? w.ends.start : w.ends.end) === 'JUNCTION') continue
      const end = atStart ? w.from : w.to
      const across = walls
        .filter((o) => o.axis !== w.axis && o.from - 0.05 <= w.at && o.to + 0.05 >= w.at && (atStart ? o.at < end : o.at > end) && (o.ends.start === 'JUNCTION' || o.ends.end === 'JUNCTION' || o.to - o.from >= 0.45))
        .sort((a, b) => Math.abs(a.at - end) - Math.abs(b.at - end))[0]
      if (!across) continue
      const face = atStart ? across.at + across.thicknessM / 2 : across.at - across.thicknessM / 2
      const gap: [number, number] = atStart ? [round6(face), w.from] : [w.to, round6(face)]
      const width = gap[1] - gap[0]
      if (width < opt.doorMinM || width > opt.doorMaxM) continue
      if (walls.some((x) => x !== w && x.axis === w.axis && Math.abs(x.at - w.at) <= drawnM * 0.5 && x.from < gap[1] - 0.05 && x.to > gap[0] + 0.05)) continue
      if (doorAt(w.axis, w.at, gap) || offFloor(w.axis, w.at, gap)) continue
      const probe: { traced: number; at?: string } = { traced: 0 }
      const leaf = [w.at, w.at - w.thicknessM / 2, w.at + w.thicknessM / 2].map((line) => swingArcInDoorway(raster, plan, w.axis, line, gap, probe)).find((x) => !!x)
      noteSwing('against the wall across', w.axis, w.at, gap, probe, !!leaf)
      if (!leaf) continue
      doors.push({
        id: `idoor-${storeyIndex}-${doors.length}`,
        storeyIndex,
        wallAxis: w.axis,
        at: w.at,
        from: gap[0],
        to: gap[1],
        widthM: round6(width),
        betweenIds: atStart ? [`${across.id}:across`, w.id] : [w.id, `${across.id}:across`],
        confidence: round6(Math.min(w.confidence, 0.6) * 0.95),
        why: `a ${width.toFixed(2)} m gap between the end of a partition and the face of the wall across its line, its swing drawn (${tracedShare(leaf)}, a ${leaf.radius.toFixed(2)} m leaf): a door, the wall across its far jamb`,
      })
      jambIds.add(w.id)
    }
  }

  // a door between two nibs, or between a nib and the end of a piece on its line: the jambs the plan draws for a door set
  // between two walls that run on past it. The nibs become its wall.
  for (const n of nibs) {
    const tip = n.ends.start === 'FREE' ? n.from : n.to
    const dir = n.ends.start === 'FREE' ? -1 : 1
    const facing = [...nibs, ...walls]
      .filter((o) => o !== n && o.axis === n.axis && Math.abs(o.at - n.at) <= Math.max(drawnM * 0.5, (o.thicknessM + n.thicknessM) / 2))
      .map((o) => ({ o, end: dir > 0 ? o.from : o.to }))
      .filter(({ o, end }) => (end - tip) * dir >= opt.doorMinM && (end - tip) * dir <= opt.doorMaxM && (!nibIds.has(o.id) || (dir > 0 ? o.ends.start : o.ends.end) === 'FREE'))
      .sort((p, q) => Math.abs(p.end - tip) - Math.abs(q.end - tip))[0]
    if (!facing) continue
    const gap: [number, number] = dir > 0 ? [tip, facing.end] : [facing.end, tip]
    const line = round6((n.at + facing.o.at) / 2)
    if (doorAt(n.axis, line, gap) || offFloor(n.axis, line, gap)) continue
    if (walls.some((x) => x !== facing.o && x.axis === n.axis && Math.abs(x.at - line) <= drawnM * 0.5 && x.from < gap[1] - 0.05 && x.to > gap[0] + 0.05)) continue
    if (walls.some((x) => x.axis !== n.axis && x.at > gap[0] + 0.05 && x.at < gap[1] - 0.05 && x.from < line - 0.1 && x.to > line + 0.1)) continue
    const probe: { traced: number; at?: string } = { traced: 0 }
    const leaf = swingArcInDoorway(raster, plan, n.axis, line, gap, probe)
    noteSwing('between nibs', n.axis, line, gap, probe, !!leaf)
    if (!leaf) continue
    for (const piece of [n, facing.o]) if (nibIds.has(piece.id) && !walls.includes(piece)) walls.push(piece)
    const [first, second] = dir > 0 ? [n, facing.o] : [facing.o, n]
    doors.push({ id: `idoor-${storeyIndex}-${doors.length}`, storeyIndex, wallAxis: n.axis, at: line, from: round6(gap[0]), to: round6(gap[1]), widthM: round6(gap[1] - gap[0]), betweenIds: [first.id, second.id], confidence: 0.5, why: `a ${(gap[1] - gap[0]).toFixed(2)} m doorway between ${nibIds.has(facing.o.id) ? 'two nibs standing off the walls either side' : 'a nib standing off a wall and the end of the partition on its line'}, its swing drawn (${tracedShare(leaf)}, a ${leaf.radius.toFixed(2)} m leaf): a door set between two walls that run on past it` })
    jambIds.add(n.id)
    if (nibIds.has(facing.o.id)) jambIds.add(facing.o.id)
  }

  // A free-standing piece with no junction at either end is a cupboard or a
  // worktop, not a wall — unless a door gap anchors it to a piece that is.
  const anchoredByDoor = new Set([...doors.flatMap((d) => d.betweenIds), ...jambIds])
  const kept = walls.filter((w) => (!nibIds.has(w.id) && (w.ends.start === 'JUNCTION' || w.ends.end === 'JUNCTION')) || anchoredByDoor.has(w.id))
  const dropped = walls.filter((w) => !kept.includes(w))
  for (const d of dropped.filter((w) => !nibIds.has(w.id))) unresolved.push({ what: `a ${(d.to - d.from).toFixed(2)} m thin band at ${d.axis === 'Z' ? 'x' : 'z'} ${d.at.toFixed(2)}`, reason: 'meets no wall at either end: fitted furniture or a line, not a partition' })
  const keptIds = new Set(kept.map((w) => w.id))
  const isPseudo = (id: string): boolean => id.includes(':')
  const keptDoors = doors.filter((d) => (keptIds.has(d.betweenIds[0]) || isPseudo(d.betweenIds[0])) && (keptIds.has(d.betweenIds[1]) || isPseudo(d.betweenIds[1])))

  for (let k = kept.length - 1; k >= 0; k -= 1) if (onBlock(kept[k])) kept.splice(k, 1)
  const finalIds = new Set(kept.map((w) => w.id))
  for (let k = keptDoors.length - 1; k >= 0; k -= 1) if (!(finalIds.has(keptDoors[k].betweenIds[0]) || isPseudo(keptDoors[k].betweenIds[0])) || !(finalIds.has(keptDoors[k].betweenIds[1]) || isPseudo(keptDoors[k].betweenIds[1]))) keptDoors.splice(k, 1)

  // Rooms: flood fill over a metric grid with walls, door gaps and blocks as barriers.
  const cell = opt.cellM
  const gx = Math.max(1, Math.round((inner.x1 - inner.x0) / cell))
  const gz = Math.max(1, Math.round((inner.z1 - inner.z0) / cell))
  const barrier = new Uint8Array(gx * gz)
  const mark = (x0: number, z0: number, x1: number, z1: number): void => {
    const i0 = Math.max(0, Math.floor((x0 - inner.x0) / cell))
    const i1 = Math.min(gx - 1, Math.ceil((x1 - inner.x0) / cell) - 1)
    const j0 = Math.max(0, Math.floor((z0 - inner.z0) / cell))
    const j1 = Math.min(gz - 1, Math.ceil((z1 - inner.z0) / cell) - 1)
    for (let j = j0; j <= j1; j += 1) for (let i = i0; i <= i1; i += 1) barrier[j * gx + i] = 1
  }
  for (const w of kept) {
    const half = Math.max(w.thicknessM / 2, cell * 0.6)
    if (w.axis === 'Z') mark(w.at - half, w.from, w.at + half, w.to)
    else mark(w.from, w.at - half, w.to, w.at + half)
  }
  for (const d of keptDoors) {
    const half = Math.max(drawnM * 0.3, cell * 0.6)
    if (d.wallAxis === 'Z') mark(d.at - half, d.from, d.at + half, d.to)
    else mark(d.from, d.at - half, d.to, d.at + half)
  }
  for (const b of blocks) mark(b.x0, b.z0, b.x1, b.z1)
  for (const b of options.extraBarriers ?? []) mark(b.x0, b.z0, b.x1, b.z1)
  // v3.53.6: on a zone, what lies between its rectangles is the outer walls and the open air: no floor
  if (zone) for (let j = 0; j < gz; j += 1) for (let i = 0; i < gx; i += 1) if (!onFloor(inner.x0 + (i + 0.5) * cell, inner.z0 + (j + 0.5) * cell)) barrier[j * gx + i] = 1
  // N8-03D2: a slab opening bars every cell it touches (a cell's centre or a corner inside it), so no room's cells lie on it
  const opening = new Uint8Array(gx * gz)
  for (const poly of options.slabOpenings ?? []) {
    const xs = poly.map((p) => p.x)
    const zs = poly.map((p) => p.z)
    const i0 = Math.max(0, Math.floor((Math.min(...xs) - inner.x0) / cell))
    const i1 = Math.min(gx - 1, Math.ceil((Math.max(...xs) - inner.x0) / cell))
    const j0 = Math.max(0, Math.floor((Math.min(...zs) - inner.z0) / cell))
    const j1 = Math.min(gz - 1, Math.ceil((Math.max(...zs) - inner.z0) / cell))
    const e = cell * 1e-3
    for (let j = j0; j <= j1; j += 1) {
      for (let i = i0; i <= i1; i += 1) {
        const x = inner.x0 + i * cell
        const z = inner.z0 + j * cell
        const probes = [{ x: x + cell / 2, z: z + cell / 2 }, { x: x + e, z: z + e }, { x: x + cell - e, z: z + e }, { x: x + e, z: z + cell - e }, { x: x + cell - e, z: z + cell - e }]
        if (probes.some((q) => pointInPolygon(q, poly))) {
          barrier[j * gx + i] = 1
          opening[j * gx + i] = 1
        }
      }
    }
  }
  const label = new Int32Array(gx * gz).fill(-1)
  const rooms: RoomPolygon[] = []
  let next = 0
  for (let j = 0; j < gz; j += 1) {
    for (let i = 0; i < gx; i += 1) {
      if (barrier[j * gx + i] || label[j * gx + i] >= 0) continue
      const id = next++
      const stack = [[i, j]]
      label[j * gx + i] = id
      const cells: Array<[number, number]> = []
      while (stack.length > 0) {
        const [ci, cj] = stack.pop() as [number, number]
        cells.push([ci, cj])
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const ni = ci + di
          const nj = cj + dj
          if (ni < 0 || nj < 0 || ni >= gx || nj >= gz || barrier[nj * gx + ni] || label[nj * gx + ni] >= 0) continue
          label[nj * gx + ni] = id
          stack.push([ni, nj])
        }
      }
      const area = cells.length * cell * cell
      if (area < 1.0) continue
      const polygon = tracePolygon(cells, gx, gz, cell, inner.x0, inner.z0)
      const holes = openingHoles(cells, opening, gx, gz, cell, inner.x0, inner.z0)
      const xs = polygon.map((p) => p.x)
      const zs = polygon.map((p) => p.z)
      const bounds = { x0: round6(Math.min(...xs)), z0: round6(Math.min(...zs)), x1: round6(Math.max(...xs)), z1: round6(Math.max(...zs)) }
      // Doors on this room's boundary: a door cell touches the room.
      const doorIds = keptDoors
        .filter((d) => {
          const i0 = Math.floor(((d.wallAxis === 'Z' ? d.at : d.from) - inner.x0) / cell)
          const j0 = Math.floor(((d.wallAxis === 'Z' ? d.from : d.at) - inner.z0) / cell)
          const i1 = Math.ceil(((d.wallAxis === 'Z' ? d.at : d.to) - inner.x0) / cell)
          const j1 = Math.ceil(((d.wallAxis === 'Z' ? d.to : d.at) - inner.z0) / cell)
          for (let jj = j0 - 2; jj <= j1 + 2; jj += 1) for (let ii = i0 - 2; ii <= i1 + 2; ii += 1) if (ii >= 0 && jj >= 0 && ii < gx && jj < gz && label[jj * gx + ii] === id) return true
          return false
        })
        .map((d) => d.id)
      // Open plan: the polygon's area is well above the largest rectangle a single room would be, and it has concave corners.
      const openPlan = polygon.length > 4 && area > 20
      rooms.push({ id: `room-${storeyIndex}-${rooms.length}`, storeyIndex, polygon, ...(holes.length > 0 ? { holes } : {}), areaM2: round6(area), bounds, doorIds, openPlan, confidence: 0.6, why: `${area.toFixed(2)} m² enclosed by ${polygon.length} wall faces${holes.length > 0 ? `, less ${holes.length} opening${holes.length === 1 ? '' : 's'} in the floor it surrounds` : ''}${openPlan ? '; several published rooms may share it (open plan)' : ''}` })
    }
  }

  // Room numbers: large short digit tokens inside a room.
  const keptTokens = tokens.filter((t) => !t.setAside)
  // the sheet's text height, from the template's tokens only: the recogniser's room numbers neither set nor face it
  const heights = keptTokens.filter((t) => !t.recognised).map((t) => t.heightPx).sort((a, b) => a - b)
  const medianHeight = heights.length > 0 ? heights[Math.floor(heights.length / 2)] : 0
  // v3.45: every published number printed inside each room; a room holding two or more is several published rooms in one
  // region (an open plan the walls do not divide, or a door the flood ran through): it takes none of them
  const printedIn = new Map<string, Set<string>>()
  for (const t of keptTokens) {
    if (!/^\d{1,2}$/.test(t.text)) continue
    // N8-03D2: a room number is printed upright; a reading taken another way up is a dimension or a callout's text
    if (t.orientation !== undefined && t.orientation !== 'HORIZONTAL') continue
    if (!t.recognised && medianHeight > 0 && t.heightPx < medianHeight * 1.15) continue
    const cx = (t.box.x0 + t.box.x1) / 2
    const cy = (t.box.y0 + t.box.y1) / 2
    const w = plan.toWorld(cx, cy)
    const room = rooms.find((r) => pointInPolygon(w, r.polygon))
    if (!room) continue
    const published = publishedRooms.find((p) => p.number === t.text)
    // A number that names no published room on this storey is a misread; it is kept out of the room.
    if (!published && publishedRooms.length > 0) continue
    printedIn.set(room.id, (printedIn.get(room.id) ?? new Set<string>()).add(t.text))
    if (room.number && room.number !== t.text) {
      unresolved.push({ what: `the number of ${room.id}`, reason: `two numbers (${room.number}, ${t.text}) are printed inside it` })
      continue
    }
    room.number = t.text
    if (published) {
      room.label = published.label
      room.publishedAreaM2 = published.areaM2
      const off = Math.abs(room.areaM2 - published.areaM2) / published.areaM2
      room.confidence = round6(Math.min(0.9, 0.6 + (off < 0.15 ? 0.25 : 0)))
      room.why += `; numbered ${t.text} = ${published.label} ${published.areaM2} m² published (${((room.areaM2 / published.areaM2 - 1) * 100).toFixed(0)} % off)`
      if (off > 0.4 && !room.openPlan) {
        const byArea = publishedRooms.filter((p) => p.number !== t.text && Math.abs(room.areaM2 - p.areaM2) / p.areaM2 < 0.12)
        unresolved.push({ roomId: room.id, what: `the label of ${room.id} (read as ${t.text})`, reason: `its ${room.areaM2} m² is ${(off * 100).toFixed(0)} % off the published ${published.label} ${published.areaM2} m²${byArea.length > 0 ? `; by area it would be ${byArea.map((p) => `${p.number} ${p.label} ${p.areaM2}`).join(' or ')}` : ''}` })
        // The digit is likelier misread than the plan mis-drawn: the label is withheld, the number kept as a reading.
        room.label = undefined
        room.publishedAreaM2 = undefined
        room.confidence = 0.5
      }
    }
  }
  const several = new Set<string>()
  for (const room of rooms) {
    const printed = [...(printedIn.get(room.id) ?? [])]
    if (printed.length < 2) continue
    several.add(room.id)
    const names = printed.map((n) => `${n} ${publishedRooms.find((p) => p.number === n)?.label ?? ''}`.trim())
    room.why += `; ${printed.length} published numbers are printed inside it (${names.join(', ')}): several published rooms in one region, none of them its number`
    room.number = undefined
    room.label = undefined
    room.publishedAreaM2 = undefined
    room.confidence = 0.5
  }
  // 005U-N4: a room no kept reading numbers may take its number from a reading the orientation vote set aside — the
  // page-wide vote picks one way up per clash by summed merit, and a garbled reading of the same ink another way up
  // (more glyphs, each matched worse) can outvote a clean one. The set-aside reading is heard only when it is the ONE
  // reading of its ink, any way up, that names a published room on this storey; when the published number is not
  // already some other room's; and when no other ink in the room offers a number. Anything else stays unnumbered and
  // is named. The area is never consulted to choose.
  const numberIn = (t: LabelToken): string | undefined => (/^\d{1,2}$/.test(t.text) && publishedRooms.some((p) => p.number === t.text) ? t.text : undefined)
  const sameInk = (a: PixelRect, b: PixelRect): boolean => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0
  const taken = new Set(rooms.map((r) => r.number).filter((n): n is string => !!n))
  for (const room of rooms) {
    if (room.number || several.has(room.id) || publishedRooms.length === 0) continue
    const inside = tokens.filter((t) => t.setAside && t.orientation === 'HORIZONTAL' && (medianHeight === 0 || t.heightPx >= medianHeight * 1.15) && pointInPolygon(plan.toWorld((t.box.x0 + t.box.x1) / 2, (t.box.y0 + t.box.y1) / 2), room.polygon))
    const offers = new Set<string>()
    for (const t of inside) {
      const readings = tokens.filter((o) => sameInk(o.box, t.box))
      const numbers = [...new Set(readings.map(numberIn).filter((n): n is string => !!n))]
      if (numbers.length === 1 && numberIn(t) === numbers[0]) offers.add(numbers[0])
      else if (numbers.length > 1) unresolved.push({ what: `the number of ${room.id}`, reason: `one printed label reads as ${numbers.join(' or ')} alike, each a published room: not chosen` })
    }
    if (offers.size !== 1) {
      if (offers.size > 1) unresolved.push({ what: `the number of ${room.id}`, reason: `set-aside readings offer ${[...offers.keys()].join(' and ')}: not chosen` })
      continue
    }
    const [number] = [...offers]
    // A room's number is printed once on its storey: the same number read on any other ink in the footprint, any way
    // up and at a room number's size, makes this reading one of two, and neither is taken.
    const area = options.labelArea ?? body
    const inArea = (o: LabelToken): boolean => {
      const w = plan.toWorld((o.box.x0 + o.box.x1) / 2, (o.box.y0 + o.box.y1) / 2)
      return w.x >= area.x0 && w.x <= area.x1 && w.z >= area.z0 && w.z <= area.z1
    }
    const own = inside.filter((t) => numberIn(t) === number)
    const elsewhere = tokens.filter((o) => o.text === number && (medianHeight === 0 || o.heightPx >= medianHeight * 1.15) && inArea(o) && !own.some((t) => sameInk(o.box, t.box)))
    if (elsewhere.length > 0) {
      unresolved.push({ what: `the number of ${room.id}`, reason: `a set-aside upright reading says ${number}, and ${elsewhere.length} other label${elsewhere.length === 1 ? '' : 's'} on the storey read ${number} too: not taken` })
      continue
    }
    if (taken.has(number)) {
      unresolved.push({ what: `the number of ${room.id}`, reason: `a set-aside reading says ${number}, already another room's number` })
      continue
    }
    const published = publishedRooms.find((p) => p.number === number)
    if (!published) continue
    // A reading the vote set aside carries less than a kept one: the published area is its check (never its chooser),
    // and a room far off it — open plan or not — keeps no number from it.
    const off = Math.abs(room.areaM2 - published.areaM2) / published.areaM2
    if (off > 0.4) {
      unresolved.push({ what: `the number of ${room.id}`, reason: `a set-aside upright reading says ${number} (${published.label} ${published.areaM2} m²), but the room's ${room.areaM2} m² is ${(off * 100).toFixed(0)} % off it: not taken` })
      continue
    }
    taken.add(number)
    room.number = number
    room.why += `; numbered ${number} from an upright reading the orientation vote set aside (the only reading of that label naming a published room) = ${published.label} ${published.areaM2} m² published (${((room.areaM2 / published.areaM2 - 1) * 100).toFixed(0)} % off)`
    room.label = published.label
    room.publishedAreaM2 = published.areaM2
    room.confidence = round6(Math.min(0.75, 0.55 + (off < 0.15 ? 0.15 : 0)))
  }
  return { storeyIndex, frameId: plan.frameId, walls: kept, doors: keptDoors, blocks: [...blocks, ...cores.map((c, i) => ({ id: `block-${storeyIndex}-${blocks.length + i}`, ...c }))], rooms, unresolved }
}

/** Trace the outer boundary of a set of grid cells as a rectilinear polygon (anticlockwise in the x/z plane). */
/**
 * N8-02B: whether the plan draws a door's swing in a gap of a wall line: a quarter arc of the gap's radius from either
 * jamb, on either side of the line, sampled at 12 points; at least 70 % of them on neutral line work (within a pixel).
 */
export function swingDrawn(raster: Raster, plan: PlanFrameV2, axis: 'X' | 'Z', at: number, gap: [number, number]): boolean {
  const lineAt = (x: number, y: number): boolean => {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (lumaAt(raster, x + dx, y + dy) >= 200) continue
        const [r, g, b] = rgbAt(raster, x + dx, y + dy)
        if (Math.max(r, g, b) - Math.min(r, g, b) < NEUTRAL_INK_CHROMA) return true
      }
    }
    return false
  }
  // LINK-F1B: the quarter arc is traced on the raster's pixel grid — hinge and wall line rounded to a pixel once, the
  // radius the gap's own pixel width between its two transformed jambs — so the frame's sub-pixel phase moves no sample
  const g = gapOnGrid(plan, axis, at, gap)
  for (const [hingeA, dir] of [[g.a0, g.dir], [g.a1, -g.dir]] as const) {
    for (const side of [-1, 1]) {
      let hit = 0
      let n = 0
      for (let deg = 12; deg <= 78; deg += 6) {
        const t = (deg * Math.PI) / 180
        const p = g.pixel(Math.round(hingeA) + dir * g.widthPx * Math.cos(t), g.line + side * g.across * g.widthPx * Math.sin(t))
        n += 1
        if (lineAt(Math.round(p.x), Math.round(p.y))) hit += 1
      }
      if (hit >= 0.7 * n) return true
    }
  }
  return false
}

/**
 * LINK-F1B: a door gap on its wall's line in the raster's pixels: the two jambs along the line (`a0` at gap[0], `a1` at
 * gap[1]), which way along the sheet the gap runs (`dir`) and which way across it the world's + side lies (`across`),
 * the wall line's pixel row (column), rounded once, the gap's width in pixels between its two transformed ends and the
 * metres per pixel along it that width gives (not the frame's mean scale), and the pixel of an (along, across) pair.
 */
export function gapOnGrid(plan: PlanFrameV2, axis: 'X' | 'Z', at: number, gap: [number, number]): { a0: number; a1: number; dir: 1 | -1; across: 1 | -1; line: number; widthPx: number; mppAlong: number; pixel: (along: number, across: number) => { x: number; y: number }; alongM: (along: number) => number } {
  const pt = (along: number, acrossM: number): { x: number; y: number } => (axis === 'Z' ? plan.toPixel(acrossM, along) : plan.toPixel(along, acrossM))
  const A = (p: { x: number; y: number }): number => (axis === 'X' ? p.x : p.y)
  const C = (p: { x: number; y: number }): number => (axis === 'X' ? p.y : p.x)
  const j0 = pt(gap[0], at)
  const j1 = pt(gap[1], at)
  const a0 = A(j0)
  const a1 = A(j1)
  const dir: 1 | -1 = a1 >= a0 ? 1 : -1
  const across: 1 | -1 = C(pt(gap[0], at + 1)) >= C(j0) ? 1 : -1
  const widthPx = Math.abs(a1 - a0)
  const mppAlong = (gap[1] - gap[0]) / Math.max(1e-9, widthPx)
  const pixel = (alongPx: number, acrossPx: number): { x: number; y: number } => (axis === 'X' ? { x: alongPx, y: acrossPx } : { x: acrossPx, y: alongPx })
  const alongM = (alongPx: number): number => {
    const w = plan.toWorld(axis === 'X' ? alongPx : C(j0), axis === 'X' ? C(j0) : alongPx)
    return axis === 'X' ? w.x : w.z
  }
  return { a0, a1, dir, across, line: Math.round(C(j0)), widthPx, mppAlong, pixel, alongM }
}

/**
 * N8-03D2: the leaf of a door drawn shorter than the gap it hangs in — a leaf is narrower than its opening by its frame
 * and the jamb's lining, and on these sheets the gap is measured to the partition's face. The swing is a quarter arc of
 * the leaf's own length, centred on its hinge, and the leaf is drawn open beside it: a straight line from the hinge,
 * square to the wall's line, as long as the arc's radius. Both must be on the drawing (arc 70 %, leaf 75 % of their
 * samples on neutral line work, within a pixel) for one radius between {@link SHORT_LEAF_MIN_FRACTION} of the gap (and
 * {@link SHORT_LEAF_MIN_M}) and the gap, with the hinge at a jamb or up to {@link HINGE_SLACK_M} inside the gap from it
 * and up to {@link HINGE_ACROSS_M} either side of the wall's line (the hinge sits on the frame, not on the face or the
 * centre line the gap is measured to).
 */
/** v3.53.6: the least a door's nib stands off the face of the wall it is on, in sheet pixels. */
export const NIB_MIN_PX = 2
/** v3.53.6: the most a nib stands off its wall, metres: past it the ink is a wall piece (read as one, or not a jamb). */
export const NIB_MAX_M = 0.35
/**
 * v3.53.6: the share of a door's quarter arc that must be drawn as a line for the doors read where the plan's walls
 * alone do not make a doorway (between two corners, against the wall across, between nibs): four fifths, the rest left
 * to what crosses an arc on a sheet — a dimension line, a room's number, the leaf's end.
 */
export const TRACED_ARC_MIN = 0.8
/** v3.53.6: how much darker than the sheet either side of it (three pixels off, 0..255) a pixel of a drawn arc is. */
export const ARC_LINE_CONTRAST = 25
/** v3.53.6: how far along the wall's line from the hinge, in pixels, the open leaf may be drawn (its bar's width, the frame). */
export const LEAF_REACH_PX = 3
export const SHORT_LEAF_MIN_FRACTION = 0.7
export const SHORT_LEAF_MIN_M = 0.55
export const HINGE_SLACK_M = 0.15
export const HINGE_ACROSS_M = 0.08
/** N8-03D2: a leaf is drawn as a line at most this many pixels wide. */
export const LEAF_MAX_PX = 3
/**
 * LINK-F1B: how far past its bounds, in pixels, a door's hinge, the far end of its arc and the wall's line may still be
 * drawn — the jambs' and the line's pixels are the map's predictions of where the partitions end and run, located to
 * within two tick localisations of the chain they were placed by (2 × LADDER_TICK_PX).
 */
export const JAMB_PHASE_PX = 2
/** N8-03D2: how far two parallel partitions' ends may pass each other along and still frame one doorway between them. */
export const STAGGER_MAX_M = 0.4

/**
 * N8-03D2: whether the plan draws a door's swing in a gap: `swingDrawn` (a leaf as long as the gap) or a shorter leaf
 * with its arc (`SHORT_LEAF_MIN_FRACTION`). Returns the leaf found, or undefined.
 */
export function doorSwingInGap(raster: Raster, plan: PlanFrameV2, axis: 'X' | 'Z', at: number, gap: [number, number]): { hinge: number; radius: number; side: -1 | 1; short: boolean } | undefined {
  if (swingDrawn(raster, plan, axis, at, gap)) return { hinge: gap[0], radius: gap[1] - gap[0], side: 1, short: false }
  const width = gap[1] - gap[0]
  const mpp = (plan.mppX + plan.mppY) / 2
  const lineAt = (x: number, y: number): boolean => {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (lumaAt(raster, x + dx, y + dy) >= 200) continue
        const [r, g, b] = rgbAt(raster, x + dx, y + dy)
        if (Math.max(r, g, b) - Math.min(r, g, b) < NEUTRAL_INK_CHROMA) return true
      }
    }
    return false
  }
  const pt = (along: number, across: number): { x: number; y: number } => (axis === 'Z' ? plan.toPixel(across, along) : plan.toPixel(along, across))
  // a leaf is a line, not a band: the ink it is drawn with runs at most LEAF_MAX_PX across it (along the wall's line) —
  // the face of a partition beside the hinge is no leaf
  const inked = (x: number, y: number): boolean => {
    if (lumaAt(raster, x, y) >= 200) return false
    const [r, g, b] = rgbAt(raster, x, y)
    return Math.max(r, g, b) - Math.min(r, g, b) < NEUTRAL_INK_CHROMA
  }
  const thinLineAt = (fx: number, fy: number): boolean => {
    const x = Math.round(fx)
    const y = Math.round(fy)
    for (let d = -1; d <= 1; d += 1) {
      // the leaf runs across the wall's line: its width is measured along it (x for a wall along x, y for one along z)
      const cx = axis === 'X' ? x + d : x
      const cy = axis === 'X' ? y : y + d
      if (!inked(cx, cy)) continue
      let run = 1
      for (let k = 1; k <= LEAF_MAX_PX + 1 && inked(axis === 'X' ? cx - k : cx, axis === 'X' ? cy : cy - k); k += 1) run += 1
      for (let k = 1; k <= LEAF_MAX_PX + 1 && inked(axis === 'X' ? cx + k : cx, axis === 'X' ? cy : cy + k); k += 1) run += 1
      if (run <= LEAF_MAX_PX) return true
    }
    return false
  }
  const shortest = Math.max(SHORT_LEAF_MIN_M, SHORT_LEAF_MIN_FRACTION * width)
  // LINK-F1B: every hinge, radius and side on the raster's own pixel grid — hinges at whole pixels from each jamb into
  // the gap, wall lines at whole pixels either side of the drawn one, radii in whole pixels — with the slack, the reach
  // across and the shortest leaf in pixels at the gap's own scale (its width between its two transformed jambs). Stepping
  // the hypotheses in metres made the set of pixels tried depend on the frame's sub-pixel phase: the same drawn arc was
  // found in 10 of 49 phases of a ±2 px shift.
  const g = gapOnGrid(plan, axis, at, gap)
  const slackPx = Math.round(HINGE_SLACK_M / g.mppAlong)
  const acrossPx = Math.round(HINGE_ACROSS_M / g.mppAlong)
  const shortestPx = shortest / g.mppAlong
  let best: { hinge: number; radius: number; side: -1 | 1; arc: number; exact: number } | undefined
  let n = 0
  for (let deg = 12; deg <= 78; deg += 6) n += 1
  for (const [jamb, other, dir] of [[g.a0, g.a1, g.dir], [g.a1, g.a0, -g.dir]] as const) {
    // the hinge within the slack first, then up to JAMB_PHASE_PX further in and outside the jamb; radii shorter than the
    // gap first, then up to the far jamb and JAMB_PHASE_PX past it (and the hinge's own rounding to a whole pixel); the wall's line within HINGE_ACROSS_M first, then up to
    // JAMB_PHASE_PX further either side: every bound measured from a pixel the map predicts is that much uncertain, and
    // on a tie the reading within the bounds as mapped is kept
    const slacks = [...Array.from({ length: slackPx + 1 }, (_, k) => k), ...Array.from({ length: JAMB_PHASE_PX }, (_, k) => slackPx + k + 1), ...Array.from({ length: JAMB_PHASE_PX }, (_, k) => -(k + 1))]
    const offsets = [...Array.from({ length: 2 * acrossPx + 1 }, (_, k) => k - acrossPx), ...Array.from({ length: JAMB_PHASE_PX }, (_, k) => [-(acrossPx + k + 1), acrossPx + k + 1]).flat()]
    for (const slack of slacks) {
      const hingeA = Math.round(jamb) + dir * slack
      const within = Math.floor(Math.abs(other - hingeA)) - 1
      const radii = [...Array.from({ length: Math.max(0, within - Math.ceil(shortestPx) + 1) }, (_, k) => within - k), ...Array.from({ length: JAMB_PHASE_PX + 2 }, (_, k) => within + k + 1)]
      for (const radius of radii) {
        if (radius < shortestPx) continue
        for (const off of offsets) {
          const line = g.line + off
          for (const side of [-1, 1] as const) {
            // the arc's samples within a pixel of ink, and (to choose between hypotheses within that pixel of each
            // other) those on ink exactly
            let arc = 0
            let exact = 0
            for (let deg = 12; deg <= 78; deg += 6) {
              const t = (deg * Math.PI) / 180
              const p = g.pixel(hingeA + dir * radius * Math.cos(t), line + side * g.across * radius * Math.sin(t))
              if (lineAt(Math.round(p.x), Math.round(p.y))) arc += 1
              if (inked(Math.round(p.x), Math.round(p.y))) exact += 1
            }
            if (arc < 0.7 * n || (best && (arc < best.arc || (arc === best.arc && exact <= best.exact)))) continue
            let leaf = 0
            let m = 0
            for (let f = 0.15; f <= 0.95 + 1e-9; f += 0.1) {
              const p = g.pixel(hingeA, line + side * g.across * radius * f)
              m += 1
              if (thinLineAt(p.x, p.y)) leaf += 1
            }
            if (leaf >= 0.75 * m) best = { hinge: round6(g.alongM(hingeA)), radius: round6(radius * g.mppAlong), side, arc, exact }
          }
        }
      }
    }
  }
  return best ? { hinge: best.hinge, radius: best.radius, side: best.side, short: true } : undefined
}

/**
 * v3.53.6: the swing of a door in a doorway the plan's walls alone do not make one — between two corners, between the
 * end of a partition and the wall across its line, between two nibs. There the drawn swing is the whole evidence, and
 * what stands in such places besides doors is line work that crosses a circle here and there without following it
 * (stair treads, the cross of a wardrobe, a shower screen, a basin, a hatch) and the sheet's tone (a watermark's
 * edges). So the swing is read by its arc alone, and strictly:
 *  - the quarter arc, sampled about a pixel apart from 10° to 80°, lies on a LINE over {@link TRACED_ARC_MIN} of its
 *    length: within a pixel of the radius a neutral pixel darker by {@link ARC_LINE_CONTRAST} than the sheet three
 *    pixels inside AND three pixels outside it (an edge of tone is darker on one side only; an area is on neither);
 *  - the leaf closes the doorway: its hinge within {@link HINGE_SLACK_M} of one jamb (as for every leaf) and the far
 *    end of its arc within the same of the other;
 *  - the doorway is clear: no line (read as the arc is) runs along the wall's line from the hinge for the leaf's length. A leaf drawn there
 *    stands open INTO this gap — the same quarter arc belongs to the door of the wall square to this one.
 *  - the leaf is drawn open beside the arc (N8-03D2: an arc with no leaf is not a door): from the hinge, square to the
 *    wall's line, for the radius, three quarters of its samples on a line within {@link LEAF_REACH_PX}: ink at most
 *    `LEAF_MAX_PX` wide with paper either side (`doorSwingInGap`'s leaf, which stands a pixel off the wall it is opened
 *    against), or a line read as the arc is — on the smaller sheets a leaf is a grey bar as wide as a partition, and
 *    its outline is such a line where its width is not. The wall a leaf is opened against is never the leaf.
 */
export function swingArcInDoorway(raster: Raster, plan: PlanFrameV2, axis: 'X' | 'Z', at: number, gap: [number, number], probe?: { traced: number; at?: string }): { hinge: number; radius: number; side: -1 | 1; traced: number } | undefined {
  const neutral = (x: number, y: number): boolean => {
    const [r, g, b] = rgbAt(raster, x, y)
    return Math.max(r, g, b) - Math.min(r, g, b) < NEUTRAL_INK_CHROMA
  }
  const g = gapOnGrid(plan, axis, at, gap)
  const slackPx = Math.round(HINGE_SLACK_M / g.mppAlong)
  const acrossPx = Math.round(HINGE_ACROSS_M / g.mppAlong)
  // the doorway's band: every row (column) the wall's line may be drawn on, and two pixels more
  const reachAcross = acrossPx + JAMB_PHASE_PX + 2
  let best: { hinge: number; radius: number; side: -1 | 1; traced: number } | undefined
  for (const [jamb, other, dir] of [[g.a0, g.a1, g.dir], [g.a1, g.a0, -g.dir]] as const) {
    for (let slack = -JAMB_PHASE_PX; slack <= slackPx + JAMB_PHASE_PX; slack += 1) {
      const hingeA = Math.round(jamb) + dir * slack
      const reach = Math.abs(other - hingeA)
      for (let radius = Math.ceil(reach - slackPx - JAMB_PHASE_PX); radius <= Math.floor(reach + JAMB_PHASE_PX); radius += 1) {
        if (radius * g.mppAlong < SHORT_LEAF_MIN_M) continue
        const steps = Math.max(12, Math.round(radius * 1.2))
        for (let off = -(acrossPx + JAMB_PHASE_PX); off <= acrossPx + JAMB_PHASE_PX; off += 1) {
          const line = g.line + off
          for (const side of [-1, 1] as const) {
            let hit = 0
            for (let k = 0; k <= steps; k += 1) {
              const t = ((10 + (70 * k) / steps) * Math.PI) / 180
              const on = (r: number): { x: number; y: number } => {
                const p = g.pixel(hingeA + dir * r * Math.cos(t), line + side * g.across * r * Math.sin(t))
                return { x: Math.round(p.x), y: Math.round(p.y) }
              }
              for (const dr of [0, -1, 1]) {
                const p = on(radius + dr)
                if (!neutral(p.x, p.y)) continue
                const here = lumaAt(raster, p.x, p.y)
                const inner = on(radius + dr - 3)
                const outer = on(radius + dr + 3)
                if (lumaAt(raster, inner.x, inner.y) - here >= ARC_LINE_CONTRAST && lumaAt(raster, outer.x, outer.y) - here >= ARC_LINE_CONTRAST) {
                  hit += 1
                  break
                }
              }
            }
            const share = hit / (steps + 1)
            if (probe && share > probe.traced) {
              probe.traced = share
              const h = g.pixel(hingeA, line)
              const e = g.pixel(hingeA + dir * radius, line + side * g.across * radius)
              probe.at = `hinge px ${h.x},${h.y} radius ${radius} px towards ${e.x},${e.y}`
            }
            if (share < TRACED_ARC_MIN || (best && share <= best.traced)) continue
            // the doorway clear of a leaf drawn in it
            let inDoorway = 0
            let m = 0
            for (let f = 0.15; f <= 0.95 + 1e-9; f += 0.1) {
              m += 1
              let ink = false
              for (let d = -reachAcross; d <= reachAcross && !ink; d += 1) {
                // a line along the wall's line, as the arc is a line: darker than the sheet three pixels either side of it
                const at = (c: number): { x: number; y: number } => {
                  const p = g.pixel(hingeA + dir * radius * f, g.line + c)
                  return { x: Math.round(p.x), y: Math.round(p.y) }
                }
                const p = at(d)
                if (!neutral(p.x, p.y)) continue
                const here = lumaAt(raster, p.x, p.y)
                const a = at(d - 3)
                const b = at(d + 3)
                ink = lumaAt(raster, a.x, a.y) - here >= ARC_LINE_CONTRAST && lumaAt(raster, b.x, b.y) - here >= ARC_LINE_CONTRAST
              }
              if (ink) inDoorway += 1
            }
            if (inDoorway >= 0.75 * m) {
              if (probe && !(probe.at ?? '').includes('a leaf drawn in the doorway')) probe.at = `${probe.at ?? ''}; a leaf drawn in the doorway`
              continue
            }
            // the leaf, drawn open: from the hinge, square to the wall's line, for the radius — a line, a bar, or the
            // face of the wall it is opened against
            let leaf = 0
            for (let f = 0.15; f <= 0.95 + 1e-9; f += 0.1) {
              let drawn = false
              for (let d = -LEAF_REACH_PX; d <= LEAF_REACH_PX && !drawn; d += 1) {
                const at = (a: number): { x: number; y: number } => {
                  const p = g.pixel(hingeA + a, line + side * g.across * radius * f)
                  return { x: Math.round(p.x), y: Math.round(p.y) }
                }
                const p = at(d)
                if (!neutral(p.x, p.y)) continue
                const here = lumaAt(raster, p.x, p.y)
                const a = at(d - 3)
                const b = at(d + 3)
                if (lumaAt(raster, a.x, a.y) - here >= ARC_LINE_CONTRAST && lumaAt(raster, b.x, b.y) - here >= ARC_LINE_CONTRAST) drawn = true
                else if (here < 200) {
                  // a thin line a pixel off the face of the wall it is opened against (`doorSwingInGap`'s leaf): ink at
                  // most LEAF_MAX_PX wide along the wall's line, paper either side of it
                  let run = 1
                  for (let k = 1; k <= LEAF_MAX_PX + 1; k += 1) {
                    const q = at(d - k)
                    if (!(lumaAt(raster, q.x, q.y) < 200 && neutral(q.x, q.y))) break
                    run += 1
                  }
                  for (let k = 1; k <= LEAF_MAX_PX + 1; k += 1) {
                    const q = at(d + k)
                    if (!(lumaAt(raster, q.x, q.y) < 200 && neutral(q.x, q.y))) break
                    run += 1
                  }
                  drawn = run <= LEAF_MAX_PX
                }
              }
              if (drawn) leaf += 1
            }
            if (leaf < 0.75 * m) {
              if (probe && !(probe.at ?? '').includes('no leaf drawn')) probe.at = `${probe.at ?? ''}; no leaf drawn beside it`
              continue
            }
            best = { hinge: round6(g.alongM(hingeA)), radius: round6(radius * g.mppAlong), side, traced: round6(share) }
          }
        }
      }
    }
  }
  return best
}

/**
 * N8-03A: along a room's outline, the stretches of edge on one line (x = `at` for axis 'Z', z = `at` for axis 'X'),
 * within `tol`: where the room meets a face.
 */
export function roomEdgeOn(room: Pick<RoomPolygon, 'polygon'>, axis: 'X' | 'Z', at: number, tol: number): Array<[number, number]> {
  const out: Array<[number, number]> = []
  const poly = room.polygon
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    if (axis === 'X' && Math.abs(a.z - at) <= tol && Math.abs(b.z - at) <= tol && a.x !== b.x) out.push([Math.min(a.x, b.x), Math.max(a.x, b.x)])
    if (axis === 'Z' && Math.abs(a.x - at) <= tol && Math.abs(b.x - at) <= tol && a.z !== b.z) out.push([Math.min(a.z, b.z), Math.max(a.z, b.z)])
  }
  return out
}

/**
 * N8-03A: rooms read on two bodies that are one room — the plan draws no wall where the bodies meet (`party-wall.ts`
 * OPEN) — joined into one, with the strips between their readings (where each body's reading put the wall it does not
 * have) as floor: its outline is traced on a grid of `cellM` over the parts and strips, its area counted on that grid.
 * Its number is the one its parts carry; where they carry two, a number that rooms outside the join carry too (`taken`)
 * is not this room's — a room's number is printed once on its storey — and with none or more than one left it gets
 * none, and the clash is named. Its label is the published room of
 * that number, withheld as `readInterior` withholds it when the joined area is more than 40 % off the published one —
 * the area checks the number, it never chooses it.
 */
export function joinRooms(id: string, parts: readonly RoomPolygon[], strips: ReadonlyArray<{ x0: number; z0: number; x1: number; z1: number }>, publishedRooms: ReadonlyArray<{ number: string; label: string; areaM2: number }>, taken: ReadonlySet<string> = new Set(), cellM = DEFAULTS.cellM): { room: RoomPolygon; unresolved: Array<{ what: string; reason: string }> } {
  const unresolved: Array<{ what: string; reason: string }> = []
  const all = [...parts.map((p) => p.bounds), ...strips]
  const x0 = Math.min(...all.map((b) => b.x0))
  const z0 = Math.min(...all.map((b) => b.z0))
  const gx = Math.max(1, Math.round((Math.max(...all.map((b) => b.x1)) - x0) / cellM))
  const gz = Math.max(1, Math.round((Math.max(...all.map((b) => b.z1)) - z0) / cellM))
  const cells: Array<[number, number]> = []
  for (let j = 0; j < gz; j += 1) {
    for (let i = 0; i < gx; i += 1) {
      const c = { x: x0 + (i + 0.5) * cellM, z: z0 + (j + 0.5) * cellM }
      // N8-03D2: a part's holes stay out of the joined floor, and stay its holes
      if (parts.some((p) => (p.holes ?? []).some((h) => pointInPolygon(c, h)))) continue
      if (parts.some((p) => pointInPolygon(c, p.polygon)) || strips.some((r) => c.x >= r.x0 && c.x <= r.x1 && c.z >= r.z0 && c.z <= r.z1)) cells.push([i, j])
    }
  }
  const polygon = tracePolygon(cells, gx, gz, cellM, x0, z0)
  const xs = polygon.map((p) => p.x)
  const zs = polygon.map((p) => p.z)
  const area = round6(cells.length * cellM * cellM)
  const carried = [...new Set(parts.map((p) => p.number).filter((n): n is string => !!n))]
  const own = carried.length > 1 ? carried.filter((n) => !taken.has(n)) : carried
  const numbers = own.length === 1 ? own : carried
  const room: RoomPolygon = {
    id,
    storeyIndex: parts[0].storeyIndex,
    polygon,
    ...(parts.some((p) => (p.holes ?? []).length > 0) ? { holes: parts.flatMap((p) => p.holes ?? []) } : {}),
    areaM2: area,
    bounds: { x0: round6(Math.min(...xs)), z0: round6(Math.min(...zs)), x1: round6(Math.max(...xs)), z1: round6(Math.max(...zs)) },
    doorIds: [...new Set(parts.flatMap((p) => p.doorIds))],
    openPlan: parts.some((p) => p.openPlan),
    confidence: round6(Math.min(...parts.map((p) => p.confidence))),
    why: `one room the plan draws across the meeting of two bodies with no wall between them: ${parts.map((p) => `${p.id} (${p.areaM2.toFixed(2)} m²)`).join(' and ')} with ${strips.length} strip${strips.length === 1 ? '' : 's'} between them, ${area.toFixed(2)} m²`,
  }
  if (numbers.length > 1) unresolved.push({ what: `the number of ${id}`, reason: `its parts carry the numbers ${numbers.join(' and ')}${own.length === 0 ? ', each carried by another room of the storey too' : ''}: not chosen` })
  if (carried.length > 1 && own.length === 1) room.why += `; its parts carry the numbers ${carried.join(' and ')}, and ${carried.filter((n) => taken.has(n)).join(' and ')} is carried by another room of the storey too (a room's number is printed once)`
  if (numbers.length === 1) {
    const [number] = numbers
    room.number = number
    const published = publishedRooms.find((p) => p.number === number)
    if (published) {
      const off = Math.abs(area - published.areaM2) / published.areaM2
      room.why += `; numbered ${number} = ${published.label} ${published.areaM2} m² published (${((area / published.areaM2 - 1) * 100).toFixed(0)} % off)`
      if (off > 0.4 && !room.openPlan) {
        unresolved.push({ what: `the label of ${id} (read as ${number})`, reason: `its ${area} m² is ${(off * 100).toFixed(0)} % off the published ${published.label} ${published.areaM2} m²` })
        room.confidence = 0.5
      } else {
        room.label = published.label
        room.publishedAreaM2 = published.areaM2
        room.confidence = round6(Math.min(0.9, 0.6 + (off < 0.15 ? 0.25 : 0)))
      }
    }
  }
  return { room, unresolved }
}

/**
 * N8-03D2: the holes of a flood region that are slab openings: the cells inside the region's outline but not of it,
 * grouped 4-connected, each group that holds a slab-opening cell traced as its own outline. A group with no opening
 * cell (a block standing in the room, a wall stub) is not a hole: the room's outline goes over it, as before.
 */
function openingHoles(cells: ReadonlyArray<[number, number]>, opening: Uint8Array, gx: number, gz: number, cell: number, x0: number, z0: number): Array<Array<{ x: number; z: number }>> {
  if (!cells.some(() => true)) return []
  const own = new Set(cells.map(([i, j]) => j * gx + i))
  let i0 = gx
  let i1 = -1
  let j0 = gz
  let j1 = -1
  for (const [i, j] of cells) {
    i0 = Math.min(i0, i)
    i1 = Math.max(i1, i)
    j0 = Math.min(j0, j)
    j1 = Math.max(j1, j)
  }
  // the outside: every non-region cell of the box reachable from the box's border
  const seen = new Set<number>()
  const stack: number[] = []
  for (let i = i0; i <= i1; i += 1) for (const j of [j0, j1]) stack.push(j * gx + i)
  for (let j = j0; j <= j1; j += 1) for (const i of [i0, i1]) stack.push(j * gx + i)
  const outside = new Set<number>()
  while (stack.length > 0) {
    const k = stack.pop() as number
    if (own.has(k) || outside.has(k)) continue
    outside.add(k)
    const i = k % gx
    const j = (k - i) / gx
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const ni = i + di
      const nj = j + dj
      if (ni >= i0 && ni <= i1 && nj >= j0 && nj <= j1) stack.push(nj * gx + ni)
    }
  }
  const holes: Array<Array<{ x: number; z: number }>> = []
  for (let j = j0; j <= j1; j += 1) {
    for (let i = i0; i <= i1; i += 1) {
      const k = j * gx + i
      if (own.has(k) || outside.has(k) || seen.has(k)) continue
      const group: Array<[number, number]> = []
      const st = [k]
      seen.add(k)
      while (st.length > 0) {
        const q = st.pop() as number
        const qi = q % gx
        const qj = (q - qi) / gx
        group.push([qi, qj])
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const n = (qj + dj) * gx + (qi + di)
          if (qi + di < i0 || qi + di > i1 || qj + dj < j0 || qj + dj > j1 || own.has(n) || outside.has(n) || seen.has(n)) continue
          seen.add(n)
          st.push(n)
        }
      }
      if (group.some(([gi, gj]) => opening[gj * gx + gi])) holes.push(tracePolygon(group, gx, gz, cell, x0, z0))
    }
  }
  return holes
}

/** N8-03D2: one side of a solid block as a zero-thickness wall piece, a jamb for the doors beside it. */
function sidePiece(b: SolidBlock, axis: 'X' | 'Z', at: number, from: number, to: number): Omit<InteriorWallPiece, 'id'> {
  return { storeyIndex: b.storeyIndex, axis, at, from, to, thicknessM: 0, ends: { start: 'JUNCTION', end: 'JUNCTION' }, pixelRect: b.pixelRect, confidence: 0.5, why: `a side of ${b.id}` }
}

function tracePolygon(cells: ReadonlyArray<[number, number]>, gx: number, gz: number, cell: number, x0: number, z0: number): Array<{ x: number; z: number }> {
  const set = new Set(cells.map(([i, j]) => j * gx + i))
  const inside = (i: number, j: number): boolean => i >= 0 && j >= 0 && i < gx && j < gz && set.has(j * gx + i)
  // Collect boundary edges as directed segments (anticlockwise: interior on the left when x right, z up).
  // Edges: bottom edge of cell (i,j) from (i,j)->(i+1,j) when cell below is outside, etc.
  const edges = new Map<string, [number, number]>()
  const key = (i: number, j: number): string => `${i},${j}`
  for (const [i, j] of cells) {
    if (!inside(i, j - 1)) edges.set(key(i, j), [i + 1, j]) // bottom: left→right
    if (!inside(i + 1, j)) edges.set(key(i + 1, j), [i + 1, j + 1]) // right: bottom→top
    if (!inside(i, j + 1)) edges.set(key(i + 1, j + 1), [i, j + 1]) // top: right→left
    if (!inside(i - 1, j)) edges.set(key(i, j + 1), [i, j]) // left: top→bottom
  }
  // Start at the lowest-leftmost vertex; walk.
  const starts = [...edges.keys()].map((k) => k.split(',').map(Number) as [number, number]).sort((a, b) => a[1] - b[1] || a[0] - b[0])
  if (starts.length === 0) return []
  const start = starts[0]
  const path: Array<[number, number]> = [start]
  let current = start
  const visited = new Set<string>()
  for (let guard = 0; guard < edges.size + 2; guard += 1) {
    const k = key(current[0], current[1])
    if (visited.has(k)) break
    visited.add(k)
    const nextV = edges.get(k)
    if (!nextV) break
    if (nextV[0] === start[0] && nextV[1] === start[1]) break
    path.push(nextV)
    current = nextV
  }
  // Remove collinear points.
  const pts = path.map(([i, j]) => ({ x: round6(x0 + i * cell), z: round6(z0 + j * cell) }))
  const out: Array<{ x: number; z: number }> = []
  for (let k = 0; k < pts.length; k += 1) {
    const p = pts[(k - 1 + pts.length) % pts.length]
    const q = pts[k]
    const r = pts[(k + 1) % pts.length]
    const collinear = (p.x === q.x && q.x === r.x) || (p.z === q.z && q.z === r.z)
    if (!collinear) out.push(q)
  }
  return out
}

export function pointInPolygon(p: { x: number; z: number }, poly: ReadonlyArray<{ x: number; z: number }>): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside
  }
  return inside
}

/**
 * 005W-N1: the compact parts of one flood region (indices `y * width + x`): the pixels whose horizontal and vertical ink
 * runs, counted inside the region only, are both at least `minRun` long, grouped 4-connected. Returns each part's box and
 * pixel count.
 */
export function coreOfRegion(region: readonly number[], width: number, minRun: number): Array<{ minX: number; maxX: number; minY: number; maxY: number; n: number }> {
  const inRegion = new Set(region)
  const run = (i: number, step: number, sameLine: (j: number) => boolean): number => {
    let k = 1
    for (let j = i - step; inRegion.has(j) && sameLine(j); j -= step) k += 1
    for (let j = i + step; inRegion.has(j) && sameLine(j); j += step) k += 1
    return k
  }
  const core = new Set(region.filter((i) => run(i, 1, (j) => Math.floor(j / width) === Math.floor(i / width)) >= minRun && run(i, width, () => true) >= minRun))
  const out: Array<{ minX: number; maxX: number; minY: number; maxY: number; n: number }> = []
  const seen = new Set<number>()
  for (const start of [...core].sort((a, b) => a - b)) {
    if (seen.has(start)) continue
    const stack = [start]
    seen.add(start)
    const box = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, n: 0 }
    while (stack.length > 0) {
      const i = stack.pop() as number
      const x = i % width
      const y = Math.floor(i / width)
      box.n += 1
      box.minX = Math.min(box.minX, x)
      box.maxX = Math.max(box.maxX, x)
      box.minY = Math.min(box.minY, y)
      box.maxY = Math.max(box.maxY, y)
      for (const j of [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i - width, i + width]) {
        if (j < 0 || seen.has(j) || !core.has(j)) continue
        seen.add(j)
        stack.push(j)
      }
    }
    out.push(box)
  }
  return out
}
