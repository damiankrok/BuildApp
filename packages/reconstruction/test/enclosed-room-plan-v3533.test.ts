/**
 * v3.53.3 — the second reading of a plan whose box reading walked into a room through the room's own door, on a plan
 * drawn in code (5 cm/px; not a drawing of any real building).
 *
 * A house 20 × 12 m with a room across its right end, behind a partition with a door in it. The room's balcony door
 * stands in the thick rear wall hard against the corner: the 1.5 m opening is drawn with its frame as ink at the jambs
 * (so it MEASURES 0.9 m), its leaf as one line at the wall's inner face, and its width printed over it. The piece of
 * wall between the door and the corner is too short to read as a wall band, and a dimension tick stands at the door's
 * jamb — so on the wall's grid line the door's cell edge carries one piece of wall, not two, the door reads as where
 * the wall stops, and the flood walks through it into the room.
 */
import { describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-cv'
import { WALL, sheet } from './plan.js'
import { BLACK, drawLine, fillRect } from '../../source-cv/test/draw.js'
import { builtAt, clear, near, ring, run, wall } from './boundary-plan.js'
import type { Run } from './boundary-plan.js'

const REAR = 24 // the rear wall, 1.2 m: room for a leaf at its inner face clear of both faces' probes
const HOUSE_M2 = 20 * 12
const CALLOUT = [{ id: 'c1', at: { x: 409, y: 20 }, widthsCm: [{ value: 150, confidence: 0.99 }] }]

function plan(partitionAt: number): Raster {
  const r = sheet(520, 340)
  ring(r, 40, 40, 439, 279)
  wall(r, 40, 40, 439, 40 + REAR - 1)
  // the partition between the house and the room, and the door in it
  wall(r, partitionAt, 40, partitionAt + WALL - 1, 279)
  clear(r, partitionAt, 150, partitionAt + WALL - 1, 169)
  // the room's balcony door: opening, frame ink at both jambs, leaf at the inner face
  clear(r, 394, 40, 423, 40 + REAR - 1)
  fillRect(r, 394, 40, 399, 40 + REAR - 1, BLACK)
  fillRect(r, 418, 40, 423, 40 + REAR - 1, BLACK)
  drawLine(r, 400, 57, 417, 57, BLACK)
  return r
}
const read = (partitionAt: number, options: { callout?: boolean; openingAware?: boolean } = {}): Run =>
  run(plan(partitionAt), [40, 400, 440], [40, 280], options.callout === false ? [] : (CALLOUT as never), options.openingAware === false ? { openingAware: false } : {})
const inRoom: [number, number] = [390, 150]

describe('a room behind its own balcony door (v3.53.3)', () => {
  it('the cause: the box’s reading alone walks in through the door and leaves the room as ground', () => {
    const { d, builtM2 } = read(320, { openingAware: false })
    expect(builtAt(d, ...inRoom)).toBe(false)
    expect(builtAt(d, 200, 150)).toBe(true)
    expect(builtM2).toBeLessThan(HOUSE_M2 - 50)
  })

  it('read again with the room’s own named door shut, the box’s own reading builds the room, and the house is whole', () => {
    const { d, builtM2 } = read(320)
    expect(builtAt(d, ...inRoom)).toBe(true)
    expect(near(builtM2, HOUSE_M2)).toBe(true)
    const rooms = d.boundary?.enclosedRooms ?? []
    expect(rooms).toHaveLength(1)
    expect(rooms[0].built).toBe(true)
    expect(rooms[0].why).toMatch(/^the box's reading walked into it through its own opening; read again with that opening shut, it builds \d+\.\d m² of the room$/)
    expect(rooms[0].openings).toEqual([{ gapId: 'gap-Y-40-400-418', axis: 'Y', linePx: 40, fromPx: 400, toPx: 418, widthM: 0.9, signature: 'LEAF_FACE', calloutCm: 150 }])
    // built by the box's reading, not completed against bodies cut without it: no outline override, no completion left
    expect(d.outlineReading).toBeUndefined()
    expect(d.boundary?.completions).toEqual([])
    expect(d.boundary?.accepted).toBe(false)
    // one house: the room is not a body beside it
    const built = d.regions.filter((x) => x.classification === 'BUILT')
    expect(Math.min(...built.map((x) => x.rect.x0))).toBe(40)
    expect(Math.max(...built.map((x) => x.rect.x1))).toBe(440)
    expect(built.every((x) => x.rect.y0 === 40 && x.rect.y1 === 280)).toBe(true)
  })

  it('the second reading is another reading (its own identity), and the same one every time', () => {
    const again = read(320)
    const once = read(320)
    expect(JSON.stringify(again.d.cells)).toBe(JSON.stringify(once.d.cells))
    expect(again.d.boundary?.decompositionId).toBe(once.d.boundary?.decompositionId)
    expect(again.d.boundary?.decompositionId).not.toBe(read(320, { callout: false }).d.boundary?.decompositionId)
  })

  it('counter-case: with no width printed over the door nothing names the opening — the part stays ground, rejected as before', () => {
    const { d } = read(320, { callout: false })
    expect(builtAt(d, ...inRoom)).toBe(false)
    expect(d.boundary?.enclosedRooms).toBeUndefined()
    const parts = d.boundary?.completions ?? []
    expect(parts.map((p) => [p.kind, p.decision])).toEqual([['BOX_COMPLETION', 'REJECTED']])
    expect(parts[0].reason).toMatch(/^NO_CONTINUATION/)
    expect(parts[0].reread).toBeUndefined()
  })

  it('counter-case: a part larger than half of what the box builds is not a room of this house — then the box is the wrong object', () => {
    const { d } = read(300)
    expect(builtAt(d, ...inRoom)).toBe(false)
    expect(d.boundary?.enclosedRooms).toBeUndefined()
    expect(d.boundary?.completions.map((p) => p.decision)).toEqual(['REJECTED'])
  })
})
