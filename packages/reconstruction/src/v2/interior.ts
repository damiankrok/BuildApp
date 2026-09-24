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
import { rgbAt } from './scan.js'

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
  unresolved: Array<{ what: string; reason: string }>
}

export type InteriorOptions = {
  /** Thinnest partition, as a fraction of the external wall thickness. */
  minPartitionFraction?: number
  /** Thickest, as a fraction of the external wall thickness. */
  maxPartitionFraction?: number
  /** Shortest piece worth believing, in metres. */
  minPieceM?: number
  /** Door gap range, in metres. */
  doorMinM?: number
  doorMaxM?: number
  /** Flood-fill cell size, in metres. */
  cellM?: number
  /** Rectangles that are not floor on this storey (a stair flight, a void), as room barriers. */
  extraBarriers?: ReadonlyArray<{ x0: number; z0: number; x1: number; z1: number }>
  /** Diagnostics hook. */
  onDebug?: (info: { axis: 'X' | 'Z'; centrePx: number; thick: number; runsPx: Array<{ from: number; to: number }> }) => void
}

const DEFAULTS: Required<Omit<InteriorOptions, 'onDebug' | 'extraBarriers'>> = { minPartitionFraction: 0.2, maxPartitionFraction: 0.72, minPieceM: 0.55, doorMinM: 0.6, doorMaxM: 1.35, cellM: 0.05 }

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
export type LabelToken = { text: string; box: PixelRect; heightPx: number; confidence: number }

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
  const unresolved: Array<{ what: string; reason: string }> = []
  const mpp = (plan.mppX + plan.mppY) / 2
  const wallPx = wallThicknessM / mpp
  const minThick = Math.max(2, Math.round(wallPx * opt.minPartitionFraction))
  const maxThick = Math.max(minThick + 1, Math.round(wallPx * opt.maxPartitionFraction))
  const minPiecePx = opt.minPieceM / mpp

  // The interior in pixels: the body inset by its external wall.
  const inner = { x0: body.x0 + wallThicknessM, z0: body.z0 + wallThicknessM, x1: body.x1 - wallThicknessM, z1: body.z1 - wallThicknessM }
  const pa = plan.toPixel(inner.x0, inner.z1)
  const pb = plan.toPixel(inner.x1, inner.z0)
  const px0 = Math.ceil(Math.min(pa.x, pb.x))
  const px1 = Math.floor(Math.max(pa.x, pb.x))
  const py0 = Math.ceil(Math.min(pa.y, pb.y))
  const py1 = Math.floor(Math.max(pa.y, pb.y))
  if (px1 - px0 < 10 || py1 - py0 < 10) return { storeyIndex, frameId: plan.frameId, walls: [], doors: [], blocks: [], rooms: [], unresolved: [{ what: 'the interior of the body', reason: 'the body is too small on this sheet to read anything inside it' }] }

  const W = px1 - px0 + 1
  const H = py1 - py0 + 1
  const ink = new Uint8Array(W * H)
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) ink[y * W + x] = wallInk(raster, px0 + x, py0 + y) ? 1 : 0
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

  // A pixel is "partition ink" for a vertical wall when its horizontal run is
  // partition-thick and its vertical run is long; and symmetrically.
  const isVerticalWallPixel = (x: number, y: number): boolean => {
    const h = hRun[y * W + x]
    return h >= minThick && h <= maxThick && vRun[y * W + x] >= minPiecePx * 0.6
  }
  const isHorizontalWallPixel = (x: number, y: number): boolean => {
    const v = vRun[y * W + x]
    return v >= minThick && v <= maxThick && hRun[y * W + x] >= minPiecePx * 0.6
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
        if (thick >= minThick - 1 && thick <= maxThick * 2 + 2) {
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
            if (pieceThick < minThick - 1 || pieceThick > maxThick) continue
            axes.push({ centre: medianOf(centres), thick: pieceThick, runs: [run] })
          }
        }
        i = j + 1
      } else i += 1
    }
    return axes.filter((a) => a.runs.length > 0)
  }

  const verticalAxes = axesAlong(true)
  const horizontalAxes = axesAlong(false)

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

  // Junctions: an end within a wall thickness of the body's inner face or of a perpendicular piece.
  const near = (v: number, target: number, tol: number): boolean => Math.abs(v - target) <= tol
  const tol = wallThicknessM * 0.9
  for (const w of walls) {
    const perpendicular = walls.filter((o) => o.axis !== w.axis)
    const touches = (end: number): boolean => {
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

  // Solid blocks: neutral ink thicker than a partition in both directions (a chimney, a column).
  const blocks: SolidBlock[] = []
  {
    const seen = new Uint8Array(W * H)
    const thickEnough = (x: number, y: number): boolean => at(x, y) === 1 && hRun[y * W + x] > maxThick && vRun[y * W + x] > maxThick
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        if (seen[y * W + x] || !thickEnough(x, y)) continue
        // flood
        const stack = [[x, y]]
        let minX = x
        let maxX = x
        let minY = y
        let maxY = y
        let n = 0
        seen[y * W + x] = 1
        while (stack.length > 0) {
          const [cx, cy] = stack.pop() as [number, number]
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
        if (bw >= 0.3 && bh >= 0.3 && bw <= 1.6 && bh <= 1.6 && fill >= 0.7) {
          const a = plan.toWorld(px0 + minX, py0 + maxY + 1)
          const b = plan.toWorld(px0 + maxX + 1, py0 + minY)
          blocks.push({ id: `block-${storeyIndex}-${blocks.length}`, storeyIndex, x0: round6(a.x), z0: round6(a.z), x1: round6(b.x), z1: round6(b.z), pixelRect: { x0: px0 + minX, y0: py0 + minY, x1: px0 + maxX + 1, y1: py0 + maxY + 1 }, why: `a ${bw.toFixed(2)} × ${bh.toFixed(2)} m block of solid ink (${Math.round(fill * 100)} % filled)` })
        }
      }
    }
  }

  // Door gaps: between two collinear pieces on one axis, 0.6..1.35 m apart, where at least one piece is anchored.
  const byAxis = new Map<string, InteriorWallPiece[]>()
  // A solid block standing on a partition's line is a jamb for a door beside it.
  const pseudo: InteriorWallPiece[] = []
  for (const b of blocks) {
    for (const axis of ['Z', 'X'] as const) {
      const lo = axis === 'Z' ? b.x0 : b.z0
      const hi = axis === 'Z' ? b.x1 : b.z1
      for (const w of walls) {
        if (w.axis !== axis || w.at < lo - wallThicknessM * 0.3 || w.at > hi + wallThicknessM * 0.3) continue
        pseudo.push({ ...w, id: `${b.id}:${axis}`, from: axis === 'Z' ? b.z0 : b.x0, to: axis === 'Z' ? b.z1 : b.x1, ends: { start: 'JUNCTION', end: 'JUNCTION' }, confidence: 0.5, why: `the edge of ${b.id}` })
        break
      }
    }
  }
  for (const w of [...walls, ...pseudo]) {
    const key = `${w.axis}:${Math.round(w.at / (wallThicknessM * 0.5))}`
    byAxis.set(key, [...(byAxis.get(key) ?? []), w])
  }
  for (const [, pieces] of byAxis) {
    const sorted = [...pieces].sort((a, b) => a.from - b.from)
    for (let i = 0; i + 1 < sorted.length; i += 1) {
      const a = sorted[i]
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
      const walled = walls.some((w) => w !== a && w !== b && w.axis === a.axis && Math.abs(w.at - a.at) <= wallThicknessM * 0.5 && w.from < b.from - 0.05 && w.to > a.to + 0.05)
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

  // A free-standing piece with no junction at either end is a cupboard or a
  // worktop, not a wall — unless a door gap anchors it to a piece that is.
  const anchoredByDoor = new Set(doors.flatMap((d) => d.betweenIds))
  const kept = walls.filter((w) => w.ends.start === 'JUNCTION' || w.ends.end === 'JUNCTION' || anchoredByDoor.has(w.id))
  const dropped = walls.filter((w) => !kept.includes(w))
  for (const d of dropped) unresolved.push({ what: `a ${(d.to - d.from).toFixed(2)} m thin band at ${d.axis === 'Z' ? 'x' : 'z'} ${d.at.toFixed(2)}`, reason: 'meets no wall at either end: fitted furniture or a line, not a partition' })
  const keptIds = new Set(kept.map((w) => w.id))
  const isPseudo = (id: string): boolean => id.includes(':')
  const keptDoors = doors.filter((d) => (keptIds.has(d.betweenIds[0]) || isPseudo(d.betweenIds[0])) && (keptIds.has(d.betweenIds[1]) || isPseudo(d.betweenIds[1])))

  // A piece that lies along a solid block's edge is the block's outline, not a partition.
  const onBlock = (w: InteriorWallPiece): boolean =>
    blocks.some((b) => {
      const pad = wallThicknessM * 0.2
      if (w.axis === 'Z') return w.at >= b.x0 - pad && w.at <= b.x1 + pad && w.from >= b.z0 - pad && w.to <= b.z1 + pad
      return w.at >= b.z0 - pad && w.at <= b.z1 + pad && w.from >= b.x0 - pad && w.to <= b.x1 + pad
    })
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
    const half = Math.max(wallThicknessM * 0.3, cell * 0.6)
    if (d.wallAxis === 'Z') mark(d.at - half, d.from, d.at + half, d.to)
    else mark(d.from, d.at - half, d.to, d.at + half)
  }
  for (const b of blocks) mark(b.x0, b.z0, b.x1, b.z1)
  for (const b of options.extraBarriers ?? []) mark(b.x0, b.z0, b.x1, b.z1)
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
      rooms.push({ id: `room-${storeyIndex}-${rooms.length}`, storeyIndex, polygon, areaM2: round6(area), bounds, doorIds, openPlan, confidence: 0.6, why: `${area.toFixed(2)} m² enclosed by ${polygon.length} wall faces${openPlan ? '; several published rooms may share it (open plan)' : ''}` })
    }
  }

  // Room numbers: large short digit tokens inside a room.
  const heights = tokens.map((t) => t.heightPx).sort((a, b) => a - b)
  const medianHeight = heights.length > 0 ? heights[Math.floor(heights.length / 2)] : 0
  for (const t of tokens) {
    if (!/^\d{1,2}$/.test(t.text)) continue
    if (medianHeight > 0 && t.heightPx < medianHeight * 1.15) continue
    const cx = (t.box.x0 + t.box.x1) / 2
    const cy = (t.box.y0 + t.box.y1) / 2
    const w = plan.toWorld(cx, cy)
    const room = rooms.find((r) => pointInPolygon(w, r.polygon))
    if (!room) continue
    if (room.number && room.number !== t.text) {
      unresolved.push({ what: `the number of ${room.id}`, reason: `two numbers (${room.number}, ${t.text}) are printed inside it` })
      continue
    }
    const published = publishedRooms.find((p) => p.number === t.text)
    // A number that names no published room on this storey is a misread; it is kept out of the room.
    if (!published && publishedRooms.length > 0) continue
    room.number = t.text
    if (published) {
      room.label = published.label
      room.publishedAreaM2 = published.areaM2
      const off = Math.abs(room.areaM2 - published.areaM2) / published.areaM2
      room.confidence = round6(Math.min(0.9, 0.6 + (off < 0.15 ? 0.25 : 0)))
      room.why += `; numbered ${t.text} = ${published.label} ${published.areaM2} m² published (${((room.areaM2 / published.areaM2 - 1) * 100).toFixed(0)} % off)`
      if (off > 0.4 && !room.openPlan) {
        const byArea = publishedRooms.filter((p) => p.number !== t.text && Math.abs(room.areaM2 - p.areaM2) / p.areaM2 < 0.12)
        unresolved.push({ what: `the label of ${room.id} (read as ${t.text})`, reason: `its ${room.areaM2} m² is ${(off * 100).toFixed(0)} % off the published ${published.label} ${published.areaM2} m²${byArea.length > 0 ? `; by area it would be ${byArea.map((p) => `${p.number} ${p.label} ${p.areaM2}`).join(' or ')}` : ''}` })
        // The digit is likelier misread than the plan mis-drawn: the label is withheld, the number kept as a reading.
        room.label = undefined
        room.publishedAreaM2 = undefined
        room.confidence = 0.5
      }
    }
  }
  return { storeyIndex, frameId: plan.frameId, walls: kept, doors: keptDoors, blocks, rooms, unresolved }
}

/** Trace the outer boundary of a set of grid cells as a rectilinear polygon (anticlockwise in the x/z plane). */
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

function pointInPolygon(p: { x: number; z: number }, poly: ReadonlyArray<{ x: number; z: number }>): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside
  }
  return inside
}
