/**
 * v3.53.6, through the whole pipeline: two rooms that cross the line between two roof bodies.
 *
 * An L: a main body 8.4 × 6.8 m and a wing 4.2 × 5.0 m on its east side, flush with the rear, no wall drawn between
 * them (the sheet draws a storey, not roof bodies). The footprint is cut into two rectangles on the line of the wing's
 * front wall, about z = 1.8..2.0 m, right across the main body. Two rooms at the front of the house, 3.14 m deep, lie
 * on both sides of that line: only their two side walls cross it. Everything is drawn from the invented spec below and
 * goes in as PNG sheets, in the model frame (x from the west face, z from the front plane).
 *
 * The file uses nothing but the pipeline's entry, so it runs unchanged on the revision before the fix.
 */
import { describe, expect, it } from 'vitest'
import { decodeImage } from '@buildapp/source-package'
import { applyCommands } from '@buildapp/commands'
import { createEmptyModel, validateModel } from '@buildapp/model'
import type { SyntheticHouse } from '@buildapp/synthetic-drawings'
import { emitBuilding, reconstructV2 } from '../src/index.js'
import type { ReconstructionV2Result } from '../src/index.js'
import { buildFixture } from './pipeline.js'

const T = 0.4
export const house: SyntheticHouse = {
  name: 'Two bedrooms across the line',
  frame: 'MODEL',
  width: 8.4,
  depth: 6.8,
  wallThickness: T,
  storeys: [{ name: 'ground', height: 2.9 }],
  roof: { pitchDeg: 35, overhang: 0, ridgeAxis: 'X' },
  openings: [
    { side: 'FRONT', kind: 'DOOR', at: 1.2, width: 1.0, height: 2.1, sill: 0, storey: 0 },
    { side: 'FRONT', kind: 'WINDOW', at: 4.4, width: 1.5, height: 1.4, sill: 0.9, storey: 0 },
  ],
  members: [],
  chainsX: [8.4, 4.2],
  chainsZ: [6.8],
  // z runs from the front plane: the wing stands over z 1.8..6.8, its inner width 2.2..6.4
  wings: [{ name: 'wing', width: 4.2, depth: 5.0, offsetZ: 0, storeys: 1, roof: 'GABLE', openings: [{ side: 'RIGHT', kind: 'WINDOW', at: 2.6, width: 1.2, height: 1.3, sill: 0.9, storey: 0 }, { side: 'RIGHT', kind: 'WINDOW', at: 4.9, width: 1.2, height: 1.3, sill: 0.9, storey: 0 }] }],
  partitions: [
    // no wall between the bodies over the wing's inner width (a zero-length band whose "door" is the stretch left white)
    { storey: 0, axis: 'Z', at: 8.2, from: 2.2, to: 2.2, thickness: T, doors: [{ at: 2.2, width: 4.2 }] },
    // the two front rooms' rear wall, with a 0.9 m door into each
    { storey: 0, axis: 'X', at: 3.6, from: 0.4, to: 6.06, thickness: 0.12, doors: [{ at: 1.2, width: 0.9 }, { at: 4.0, width: 0.9 }] },
    // the wall between them, and the wall towards the day room: both cross the line the footprint is cut on
    { storey: 0, axis: 'Z', at: 3.2, from: 0.4, to: 3.54, thickness: 0.12 },
    { storey: 0, axis: 'Z', at: 6.0, from: 0.4, to: 3.54, thickness: 0.12 },
  ],
}
// drawn: 0.40..3.14 and 3.26..5.94 m wide, both 0.40..3.54 m deep
const ROOM_WEST_M2 = (3.14 - 0.4) * (3.54 - 0.4)
const ROOM_EAST_M2 = (5.94 - 3.26) * (3.54 - 0.4)

async function run(): Promise<ReconstructionV2Result> {
  const fx = await buildFixture(house, {})
  return reconstructV2({
    label: 'v3536',
    slug: 'v3536',
    sourcePackageId: fx.pkg.id,
    sourcePackageHash: fx.pkg.contentHash,
    graph: fx.graph,
    metrics: fx.metrics,
    raster: (frame) => {
      const asset = fx.pkg.assets.find((a) => a.id === frame.assetId)
      const bytes = asset ? fx.bytesByUrl.get(asset.variants[0].url) : undefined
      return bytes ? decodeImage(bytes) : undefined
    },
  })
}
const inside = (p: { x: number; z: number }, poly: ReadonlyArray<{ x: number; z: number }>): boolean => {
  let c = false
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) c = !c
  }
  return c
}

describe('v3.53.6, whole pipeline: two rooms across the line between two roof bodies', () => {
  it('the storey has three rooms; each front room is one polygon of its drawn area on both sides of the line, and no wall stands on the line', async () => {
    const result = await run()
    const b = result.building
    expect(b.masses).toHaveLength(2)
    // the line the footprint was cut on runs across the main body, through the two front rooms
    const line = Math.min(...b.masses.map((m) => m.z1))
    expect(line).toBeGreaterThan(1.7)
    expect(line).toBeLessThan(2.3)
    const rooms = b.interior.filter((r) => r.storeyIndex === 0).flatMap((r) => r.rooms)
    const at = (x: number, z: number) => rooms.find((r) => inside({ x, z }, r.polygon))
    const west = at(1.8, 1.0)
    const east = at(4.6, 1.0)
    const day = at(7.0, 5.0)
    expect(west).toBeDefined()
    expect(east).toBeDefined()
    expect(day).toBeDefined()
    expect(new Set([west?.id, east?.id, day?.id]).size).toBe(3)
    // the same polygon holds the room's floor beyond the line
    expect(at(1.8, 3.0)?.id).toBe(west?.id)
    expect(at(4.6, 3.0)?.id).toBe(east?.id)
    expect(rooms).toHaveLength(3)
    expect(Math.abs((west?.areaM2 ?? 0) - ROOM_WEST_M2)).toBeLessThan(ROOM_WEST_M2 * 0.06)
    expect(Math.abs((east?.areaM2 ?? 0) - ROOM_EAST_M2)).toBeLessThan(ROOM_EAST_M2 * 0.06)
    // compiled: the program applies, validates, carries the three rooms and the two doors, and builds no wall on the line
    const applied = applyCommands(createEmptyModel('m', 'v3536'), emitBuilding(b, 'v3536').program)
    expect(applied.failedAt === undefined ? [] : applied.results[applied.failedAt]).toEqual([])
    expect(validateModel(applied.model).issues.filter((i) => i.severity === 'ERROR')).toEqual([])
    expect(applied.model.rooms).toHaveLength(3)
    expect(applied.model.openings.filter((o) => o.kind !== 'WINDOW' && applied.model.walls.find((w) => w.id === o.wallId)?.kind === 'INTERIOR')).toHaveLength(2)
    const onLine = applied.model.walls.filter((w) => Math.abs(w.start.z - w.end.z) < 1e-6 && Math.abs(w.start.z - line) < 0.45 && Math.min(w.start.x, w.end.x) < 7.9)
    expect(onLine.map((w) => w.id)).toEqual([])
  }, 120_000)
})
