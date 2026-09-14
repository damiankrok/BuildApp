/**
 * Simple semantic features: slabs, balconies, railings, chimneys, room floor
 * markers and stair placeholders. Each is an independent semantic scene
 * object with its own mesh, never a painted appearance trick.
 */
import { rectToPolygon, type Balcony, type Chimney, type Level, type Railing, type Room, type Slab, type Stair } from '@buildapp/model'
import { extrudePolygon, worldBox } from './primitives.js'
import type { GeometryPart, Triangle } from './types.js'

export function compileSlab(slab: Slab, level: Level): Triangle[] | null {
  const top = level.elevation + slab.topOffset
  const out: Triangle[] = []
  return extrudePolygon(out, slab.polygon, top - slab.thickness, top) ? out : null
}

export function compileBalcony(b: Balcony, level: Level): Triangle[] {
  const top = level.elevation + b.topOffset
  const out: Triangle[] = []
  extrudePolygon(out, rectToPolygon(b.footprint), top - b.thickness, top)
  return out
}

export function compileChimney(c: Chimney, level: Level): Triangle[] {
  const y0 = level.elevation + c.baseOffset
  const out: Triangle[] = []
  worldBox(out, c.footprint.minX, c.footprint.maxX, y0, y0 + c.height, c.footprint.minZ, c.footprint.maxZ)
  return out
}

/** A thin plate just above the floor, so a room is a selectable object. Not structural. */
export function compileRoomFloor(r: Room, level: Level): Triangle[] | null {
  const out: Triangle[] = []
  return extrudePolygon(out, r.polygon, level.elevation + 0.005, level.elevation + 0.02) ? out : null
}

export function compileStairPlaceholder(s: Stair, level: Level): Triangle[] {
  const out: Triangle[] = []
  worldBox(out, s.footprint.minX, s.footprint.maxX, level.elevation + 0.005, level.elevation + 0.06, s.footprint.minZ, s.footprint.maxZ)
  return out
}

export type RailingPiece = { part: GeometryPart; triangles: Triangle[] }

const POST = 0.05
const RAIL_H = 0.04
const RAIL_W = 0.05
const BAR = 0.012
const BAR_STEP = 0.12
const GLASS_T = 0.012

/**
 * Posts at both ends and every `postSpacing` between, a top rail, and the
 * infill: vertical bars, a glass panel, or nothing.
 */
export function compileRailing(r: Railing, level: Level): RailingPiece[] {
  const dx = r.end.x - r.start.x
  const dz = r.end.z - r.start.z
  const L = Math.hypot(dx, dz)
  const ux = dx / L
  const uz = dz / L
  // Perpendicular in plan.
  const px = -uz
  const pz = ux
  const y0 = level.elevation + r.baseOffset
  const y1 = y0 + r.height
  const posts: Triangle[] = []
  const rails: Triangle[] = []
  const infill: Triangle[] = []
  const boxAlong = (out: Triangle[], s0: number, s1: number, w: number, yb: number, yt: number): void => {
    // A box spanning s0..s1 along the railing, w wide across it, in the world
    // frame along the railing's own axes (via extrudePolygon of its plan rect).
    const corners = [
      { x: r.start.x + ux * s0 + px * (w / 2), z: r.start.z + uz * s0 + pz * (w / 2) },
      { x: r.start.x + ux * s1 + px * (w / 2), z: r.start.z + uz * s1 + pz * (w / 2) },
      { x: r.start.x + ux * s1 - px * (w / 2), z: r.start.z + uz * s1 - pz * (w / 2) },
      { x: r.start.x + ux * s0 - px * (w / 2), z: r.start.z + uz * s0 - pz * (w / 2) },
    ]
    extrudePolygon(out, corners, yb, yt)
  }
  const count = Math.max(1, Math.ceil(L / r.postSpacing - 1e-9))
  const positions: number[] = []
  for (let k = 0; k <= count; k++) positions.push((k / count) * L)
  for (const s of positions) boxAlong(posts, Math.max(0, s - POST / 2), Math.min(L, s + POST / 2), POST, y0, y1)
  boxAlong(rails, 0, L, RAIL_W, y1 - RAIL_H, y1)
  if (r.infill === 'BARS') {
    for (let k = 0; k + 1 < positions.length; k++) {
      const s0 = positions[k] + POST / 2
      const s1 = positions[k + 1] - POST / 2
      const n = Math.max(0, Math.floor((s1 - s0) / BAR_STEP))
      for (let i = 1; i <= n; i++) {
        const s = s0 + ((s1 - s0) * i) / (n + 1)
        boxAlong(infill, s - BAR / 2, s + BAR / 2, BAR, y0 + 0.05, y1 - RAIL_H)
      }
    }
  } else if (r.infill === 'GLASS') {
    for (let k = 0; k + 1 < positions.length; k++) {
      const s0 = positions[k] + POST / 2 + 0.01
      const s1 = positions[k + 1] - POST / 2 - 0.01
      if (s1 > s0) boxAlong(infill, s0, s1, GLASS_T, y0 + 0.05, y1 - RAIL_H)
    }
  }
  const out: RailingPiece[] = [
    { part: 'RAILING_POST', triangles: posts },
    { part: 'RAILING_RAIL', triangles: rails },
  ]
  if (infill.length > 0) out.push({ part: 'RAILING_INFILL', triangles: infill })
  return out
}
