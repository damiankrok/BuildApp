/**
 * Recess topology from the zones a plan dimensions beyond its walls (§5.2, §16).
 *
 * A depth chain that reads `100 | 510 | 750 | 100` states a metre in front of
 * the front wall and a metre behind the rear one. Whether that metre is a
 * terrace, an eaves line or a RECESS the building wraps is decided by what is
 * DRAWN in it: a return wall is a wall-thick piece of ink standing in the
 * zone against the wall face, on the plan of the storey it exists on. This
 * pass scans each zone on each storey's plan for exactly that, and states the
 * recess as topology — a mouth on the outer plane, a back plane, a depth, the
 * returns found, and the open interval between them — never as a colour.
 */
import { round6 } from '@buildapp/source-common'
import type { Raster } from '@buildapp/source-cv'
import type { PlanFrameV2, WorldFrameV2 } from './frame.js'
import { bandPieces, mergeRuns } from './scan.js'
import type { Run } from './scan.js'

export type ZoneSide = 'FRONT' | 'REAR' | 'WEST' | 'EAST'

export type ReturnWall = {
  /** World interval along the zone (x for FRONT/REAR zones, z for WEST/EAST). */
  from: number
  to: number
  thicknessM: number
  /** How many of the scan lines showed it. */
  support: number
  scanLines: number
  /** The pixel rectangle the ink occupies on this plan. */
  pixelRect: { x0: number; y0: number; x1: number; y1: number }
}

export type RecessTopology = {
  id: string
  side: ZoneSide
  storeyIndex: number
  frameId: string
  /** The outer plane (mouth) and the wall face (back), in world metres along the zone's depth axis. */
  mouthAt: number
  backAt: number
  depthM: number
  /** The zone's full extent along the wall. */
  spanFrom: number
  spanTo: number
  returns: ReturnWall[]
  /** The open intervals between returns: where the recess actually is. */
  open: Array<{ from: number; to: number }>
  confidence: number
  why: string
}

export type ZoneSpec = {
  side: ZoneSide
  /** Along-the-wall extent in world metres. */
  from: number
  to: number
  /** Where the wall face is and where the outer plane is, along the depth axis. */
  backAt: number
  mouthAt: number
}

/**
 * Scan one zone on one plan for return walls.
 *
 * Scan lines are laid ACROSS the zone's depth (parallel to the wall face) at
 * 20..80 % of the depth; a return is a piece of ink at least half a wall
 * thick along the scan line that appears on most of the lines. Dimension
 * lines, text and balustrade lines are thin and inconsistent and do not pass.
 */
export function scanZoneForReturns(raster: Raster, plan: PlanFrameV2, world: WorldFrameV2, zone: ZoneSpec, storeyIndex: number): RecessTopology {
  const along = zone.side === 'FRONT' || zone.side === 'REAR' ? 'X' : 'Y'
  const depthM = Math.abs(zone.mouthAt - zone.backAt)
  const fractions = [0.2, 0.35, 0.5, 0.65, 0.8]
  const wallPx = plan.wallPx
  const minThick = Math.max(3, wallPx * 0.45)
  const hits: Array<Run[]> = []
  const scanPositions: number[] = []
  for (const f of fractions) {
    const depthAt = zone.backAt + (zone.mouthAt - zone.backAt) * f
    let lineAlong: number
    let from: number
    let to: number
    if (along === 'X') {
      const p0 = plan.toPixel(zone.from, depthAt)
      const p1 = plan.toPixel(zone.to, depthAt)
      lineAlong = p0.y
      from = Math.min(p0.x, p1.x)
      to = Math.max(p0.x, p1.x)
    } else {
      const p0 = plan.toPixel(depthAt, zone.from)
      const p1 = plan.toPixel(depthAt, zone.to)
      lineAlong = p0.x
      from = Math.min(p0.y, p1.y)
      to = Math.max(p0.y, p1.y)
    }
    scanPositions.push(lineAlong)
    // Across the scan line: ±0.35 wall thickness, so the reading is of the row itself and its immediate neighbours.
    const pieces = bandPieces(raster, along, lineAlong, from, to, Math.max(1, wallPx * 0.35), minThick * 0.7 * 2 * 0.35 + 1)
    hits.push(mergeRuns(pieces.filter((p) => p.to - p.from + 1 >= minThick), 2))
  }
  // Vote: an interval that appears on ≥ 60 % of the lines, merged across lines.
  const all: Array<Run & { line: number }> = []
  hits.forEach((runs, i) => runs.forEach((r) => all.push({ ...r, line: i })))
  const clusters: Array<{ from: number; to: number; lines: Set<number> }> = []
  for (const r of all.sort((a, b) => a.from - b.from)) {
    const c = clusters.find((k) => r.from <= k.to + wallPx * 0.5 && r.to >= k.from - wallPx * 0.5)
    if (c) {
      c.from = Math.min(c.from, r.from)
      c.to = Math.max(c.to, r.to)
      c.lines.add(r.line)
    } else clusters.push({ from: r.from, to: r.to, lines: new Set([r.line]) })
  }
  const returns: ReturnWall[] = []
  for (const c of clusters) {
    if (c.lines.size < Math.ceil(fractions.length * 0.6)) continue
    const thickPx = c.to - c.from + 1
    if (thickPx < minThick || thickPx > wallPx * 3.5) continue
    const w0 = along === 'X' ? plan.toWorld(c.from, scanPositions[0]).x : plan.toWorld(scanPositions[0], c.from).z
    const w1 = along === 'X' ? plan.toWorld(c.to + 1, scanPositions[0]).x : plan.toWorld(scanPositions[0], c.to + 1).z
    const lo = Math.min(w0, w1)
    const hi = Math.max(w0, w1)
    const depthPx = [plan.toPixel(zone.from, zone.backAt), plan.toPixel(zone.from, zone.mouthAt)]
    returns.push({
      from: round6(lo),
      to: round6(hi),
      thicknessM: round6(hi - lo),
      support: c.lines.size,
      scanLines: fractions.length,
      pixelRect:
        along === 'X'
          ? { x0: c.from, y0: Math.min(depthPx[0].y, depthPx[1].y), x1: c.to, y1: Math.max(depthPx[0].y, depthPx[1].y) }
          : { x0: Math.min(depthPx[0].x, depthPx[1].x), y0: c.from, x1: Math.max(depthPx[0].x, depthPx[1].x), y1: c.to },
    })
  }
  returns.sort((a, b) => a.from - b.from)
  // Open intervals between the returns, within the zone.
  const open: Array<{ from: number; to: number }> = []
  let cursor = zone.from
  for (const r of returns) {
    if (r.from - cursor > 0.3) open.push({ from: round6(cursor), to: round6(r.from) })
    cursor = Math.max(cursor, r.to)
  }
  if (zone.to - cursor > 0.3) open.push({ from: round6(cursor), to: round6(zone.to) })
  const confidence = returns.length === 0 ? 0.35 : round6(Math.min(0.9, 0.55 + 0.1 * returns.length + 0.05 * Math.min(...returns.map((r) => r.support / r.scanLines)) * 2))
  return {
    id: `recess-${zone.side.toLowerCase()}-${storeyIndex}`,
    side: zone.side,
    storeyIndex,
    frameId: plan.frameId,
    mouthAt: round6(zone.mouthAt),
    backAt: round6(zone.backAt),
    depthM: round6(depthM),
    spanFrom: round6(zone.from),
    spanTo: round6(zone.to),
    returns,
    open,
    confidence,
    why:
      returns.length === 0
        ? `no wall-thick ink stands in the ${depthM.toFixed(2)} m zone on the ${zone.side.toLowerCase()} on this storey's plan: a zone, not a recess`
        : `${returns.length} return wall${returns.length === 1 ? '' : 's'} of ${returns.map((r) => r.thicknessM.toFixed(2)).join(' / ')} m stand in the ${depthM.toFixed(2)} m zone on ${returns.map((r) => `${r.support}/${r.scanLines}`).join(', ')} scan lines; the recess opens over ${open.map((o) => `${o.from.toFixed(2)}..${o.to.toFixed(2)}`).join(' and ')}`,
  }
}
