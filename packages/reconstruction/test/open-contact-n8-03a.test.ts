/**
 * N8-03A: where two bodies meet and the plan draws no wall at all between them — a garage running in under the house's
 * upper storey — nothing is built on the contact (`party-wall.ts` OPEN), the rooms either side are one room
 * (`joinRooms`), a partition that stops a door's width short of the outer wall with the swing drawn keeps its door
 * (`readInterior`), and an overhead door's tracks are read in the plan's grey line ink only (`overheadDoorTracks`).
 * Every plan here is drawn from invented dimensions at 50 px per metre: a house 8 m wide with 0.40 m walls, a garage
 * against its east face whose room runs on into the house.
 */
import { describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-cv'
import { applyCommands } from '@buildapp/commands'
import { createEmptyModel, validateModel } from '@buildapp/model'
import { emitBuilding, joinRooms, overheadDoorTracks, readInterior, readPartyWalls, roomEdgeOn, sideSegments } from '../src/index.js'
import type { BuildingV2, MassV2, PartyWallV2, PlanFrameV2, RoomPolygon, WallHost } from '../src/index.js'

const PPM = 50
const OX = 40
const OY = 40
const W = 800
const H = 700
const T = 0.4

const frame: PlanFrameV2 = {
  frameId: 'plan-0',
  assetId: 'asset-plan',
  storeyIndex: 0,
  mppX: 1 / PPM,
  mppY: 1 / PPM,
  originPx: { x: OX, y: OY },
  why: 'test',
  toWorld: (px, py) => ({ x: (px - OX) / PPM, z: (py - OY) / PPM }),
  toPixel: (x, z) => ({ x: OX + x * PPM, y: OY + z * PPM }),
  wallPx: (T * PPM) / 2,
}

type Box = { x0: number; z0: number; x1: number; z1: number; rgb?: [number, number, number] }
type Arc = { cx: number; cz: number; r: number; from: number; to: number }
function plan(boxes: Box[], arcs: Arc[] = []): Raster {
  const data = new Uint8ClampedArray(W * H * 4).fill(255)
  const put = (px: number, py: number, [r, g, b]: [number, number, number]): void => {
    if (px < 0 || py < 0 || px >= W || py >= H) return
    const o = (py * W + px) * 4
    data[o] = r
    data[o + 1] = g
    data[o + 2] = b
  }
  for (const b of boxes) for (let py = Math.round(OY + b.z0 * PPM); py < Math.round(OY + b.z1 * PPM); py += 1) for (let px = Math.round(OX + b.x0 * PPM); px < Math.round(OX + b.x1 * PPM); px += 1) put(px, py, b.rgb ?? [30, 30, 30])
  for (const a of arcs) for (let d = a.from; d <= a.to; d += 0.5) put(Math.round(OX + (a.cx + a.r * Math.cos((d * Math.PI) / 180)) * PPM), Math.round(OY + (a.cz + a.r * Math.sin((d * Math.PI) / 180)) * PPM), [120, 120, 120])
  return { width: W, height: H, data }
}
const ring = (r: { x0: number; z0: number; x1: number; z1: number }, t: number, skip: { east?: boolean; west?: boolean } = {}): Box[] => [
  { x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z0 + t },
  { x0: r.x0, z0: r.z1 - t, x1: r.x1, z1: r.z1 },
  ...(skip.west ? [] : [{ x0: r.x0, z0: r.z0, x1: r.x0 + t, z1: r.z1 }]),
  ...(skip.east ? [] : [{ x0: r.x1 - t, z0: r.z0, x1: r.x1, z1: r.z1 }]),
]
const mass = (id: string, role: 'MAIN' | 'ATTACHED', x0: number, z0: number, x1: number, z1: number, storeys = [0]): MassV2 => ({ id, role, x0, z0, x1, z1, storeys, featureId: `f-${id}`, sourceMassId: `src-${id}` })
const house = mass('main', 'MAIN', 0, 0, 8, 10, [0, 1])
const garage = mass('attached-0', 'ATTACHED', 8, 1, 12, 9)
const read = (masses: MassV2[], raster: Raster) => readPartyWalls({ masses, plans: new Map([[0, { raster, frame }]]), wallOf: () => T })
/** The L the plan draws: the house's walls but its east face where the garage stands, the garage's but its west face. */
const lShape = (more: Box[] = []): Raster => plan([...ring({ x0: 0, z0: 0, x1: 8, z1: 10 }, T, { east: true }), { x0: 7.6, z0: 0, x1: 8, z1: 1 }, { x0: 7.6, z0: 9, x1: 8, z1: 10 }, ...ring({ x0: 8, z0: 1, x1: 12, z1: 9 }, T, { west: true }), ...more])

describe('N8-03A: a contact the plan draws no wall on is open', () => {
  it('no ink along the contact, the walls across drawn at both ends: OPEN, a wall of nothing on the contact line', () => {
    const r = read([house, garage], lShape())[0]
    expect(r.decision).toBe('OPEN')
    expect(r.reading.solid).toBe(0)
    expect(r.reading.cornersInk?.every((x) => x >= 0.15)).toBe(true)
    expect(r.wall).toMatchObject({ open: true, hostMassId: 'main', otherMassId: 'attached-0', hostFacade: 'EAST', band: [8, 8], thicknessM: 0, span: [1, 9], ends: ['OTHER_CORNER', 'OTHER_CORNER'] })
  })

  it('nothing drawn at the ends either (a contact off the drawing): UNDECIDED, both walls stand, the corners named', () => {
    const r = read([house, garage], plan([]))[0]
    expect(r.decision).toBe('UNDECIDED')
    expect(r.wall).toBeUndefined()
    expect(r.why).toMatch(/corners' windows/)
  })

  it('a little wall along the contact (a stub, a pier) is not open: UNDECIDED as before', () => {
    const r = read([house, garage], lShape([{ x0: 7.6, z0: 4, x1: 8, z1: 5.2 }]))[0]
    expect(r.reading.solid).toBeGreaterThan(0)
    expect(r.decision).toBe('UNDECIDED')
  })

  it('the sides: the house keeps its own wall past the garage, run on over the end of the garage wall across; the garage builds none on the contact', () => {
    const wall = read([house, garage], lShape())[0].wall as PartyWallV2
    const houseSides = sideSegments([wall], house, 0, () => T)
    expect(houseSides?.EAST.map((s) => [s.kind, s.from, s.to])).toEqual([['OWN', 0, 1.4], ['NONE', 1.4, 8.6], ['OWN', 8.6, 10]])
    const garageSides = sideSegments([wall], garage, 0, () => T)
    expect(garageSides?.WEST.map((s) => [s.kind, s.from, s.to])).toEqual([['NONE', 1, 9]])
    expect(garageSides?.FRONT.map((s) => s.kind)).toEqual(['OWN'])
    // the storey above shares nothing: the house is a ring there
    expect(sideSegments([wall], house, 1, () => T)).toBeUndefined()
  })
})

const building = (masses: MassV2[], partyWalls: PartyWallV2[]): BuildingV2 => ({
  label: 'n8-03a',
  wallThicknessM: T,
  slabThicknessM: 0.25,
  levels: [0, 1].map((i) => ({ index: i, id: `lvl-${i}`, elevation: i * 2.9, height: 2.9, wallTop: i * 2.9 + 2.65, featureId: `f-lvl-${i}` })),
  masses,
  attachedRoofs: [],
  pitchedAttachedRoofs: [],
  recesses: [],
  returns: [],
  balconies: [],
  railings: [],
  portalHeads: [],
  verges: [],
  terraces: [],
  massTones: [],
  returnTones: [],
  facadeGraph: { nodes: [], edges: [] },
  chimneys: [],
  rooflights: [],
  openings: [],
  sharedDoors: [],
  interior: [],
  assemblies: [],
  surfaceRegions: [],
  partyWalls,
})

describe('N8-03A: an open contact builds no wall, and the L closes', () => {
  const wall = read([house, garage], lShape())[0].wall as PartyWallV2
  const applied = applyCommands(createEmptyModel('m', 'n8-03a'), emitBuilding(building([house, garage], [wall]), 'n8-03a').program)

  it('every command applies and the model validates: no WALLS_OVERLAP, no ring collision', () => {
    expect(applied.failedAt === undefined ? [] : applied.results[applied.failedAt]).toEqual([])
    expect(validateModel(applied.model).issues.filter((i) => i.severity === 'ERROR')).toEqual([])
  })

  it('on the ground storey no wall stands on the contact between the garage’s corners; above it the house is whole', () => {
    const m = applied.model
    const onContact = m.walls.filter((w) => w.levelId === 'lvl-0' && Math.abs(w.start.x - w.end.x) < 1e-9 && w.start.x > 7.5 && w.start.x < 8.5 && Math.min(w.start.z, w.end.z) < 5 && Math.max(w.start.z, w.end.z) > 5)
    expect(onContact).toEqual([])
    expect(m.walls.some((w) => w.id.startsWith('ring-attached-0-0-w3'))).toBe(false)
    // the house's own pieces either side reach over the garage's front and rear walls (1..1.4, 8.6..9)
    expect(m.walls.find((w) => w.id === 'ring-main-0-w1-0')?.end.z).toBeCloseTo(1.4, 6)
    expect(m.walls.find((w) => w.id === 'ring-main-0-w1-1')?.start.z).toBeCloseTo(8.6, 6)
    expect(m.wallRings.map((r) => r.id)).toEqual(['ring-main-1'])
  })
})

describe('N8-03A: rooms either side of an open contact are one room', () => {
  const rect = (id: string, x0: number, z0: number, x1: number, z1: number, number?: string): RoomPolygon => ({
    id,
    storeyIndex: 0,
    polygon: [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }],
    areaM2: (x1 - x0) * (z1 - z0),
    bounds: { x0, z0, x1, z1 },
    doorIds: [],
    openPlan: false,
    confidence: 0.6,
    why: 'test',
    ...(number ? { number } : {}),
  })
  // the house's reading stops at x 7.6 (its inner face), the garage's at 8.4: the strip between is floor
  const inHouse = rect('main-room-0-2', 4, 2, 7.6, 6)
  const inGarage = rect('attached-0-room-0-0', 8.4, 1.4, 11.6, 8.6, '10')
  const strip = { x0: 7.6, z0: 2, x1: 8.4, z1: 6 }
  const published = [{ number: '10', label: 'Garaż', areaM2: 41.5 }, { number: '1', label: 'Wiatrołap', areaM2: 4.3 }]

  it('the edge each room has on its face is found on the outline', () => {
    expect(roomEdgeOn(inHouse, 'Z', 7.6, 0.08)).toEqual([[2, 6]])
    expect(roomEdgeOn(inGarage, 'Z', 8.4, 0.08)).toEqual([[1.4, 8.6]])
  })

  it('joined: one outline over both and the strip, its area counted, its number and label checked on the joined area', () => {
    const { room, unresolved } = joinRooms('main-room-0-2', [inHouse, inGarage], [strip], published)
    expect(room.areaM2).toBeCloseTo(14.4 + 3.2 + 23.04, 1)
    expect(room.bounds).toEqual({ x0: 4, z0: 1.4, x1: 11.6, z1: 8.6 })
    expect(room.number).toBe('10')
    expect(room.label).toBe('Garaż')
    expect(unresolved).toEqual([])
  })

  it('a joined room far off the published area keeps its number but no label, named', () => {
    const { room, unresolved } = joinRooms('main-room-0-2', [inHouse, inGarage], [strip], [{ number: '10', label: 'Garaż', areaM2: 20 }])
    expect(room.number).toBe('10')
    expect(room.label).toBeUndefined()
    expect(unresolved[0].what).toMatch(/label/)
  })

  it('two numbers: a number another room of the storey carries is not this room’s; otherwise neither is chosen', () => {
    const misread = { ...inHouse, number: '1' }
    expect(joinRooms('j', [misread, inGarage], [strip], published, new Set(['1'])).room.number).toBe('10')
    const both = joinRooms('j', [misread, inGarage], [strip], published)
    expect(both.room.number).toBeUndefined()
    expect(both.unresolved[0].reason).toMatch(/1 and 10/)
  })
})

describe('N8-03A: a door at the end of a partition against the outer wall, only where its swing is drawn', () => {
  // a body 6 × 6 m: a partition along x at z 3 from the west wall to x 4.75 — 0.85 m short of the east wall's inner face
  const body = { x0: 0, z0: 0, x1: 6, z1: 6 }
  const boxes = [...ring(body, T), { x0: 0.4, z0: 2.95, x1: 4.75, z1: 3.05 }]
  const arc = { cx: 5.6, cz: 3, r: 0.85, from: 95, to: 175 }
  it('with the swing: a door from the partition’s end to the outer wall, cut in the partition’s line', () => {
    const r = readInterior(plan(boxes, [arc]), frame, body, T, 0)
    const w = r.walls.find((x) => x.axis === 'X' && Math.abs(x.at - 3) < 0.05)
    const d = r.doors.find((x) => x.wallAxis === 'X' && Math.abs(x.at - 3) < 0.05)
    expect(d?.from).toBeCloseTo(4.75, 1)
    expect(d?.to).toBeCloseTo(5.6, 6)
    expect(d?.betweenIds).toEqual([w?.id, `${w?.id}:face`])
    // two rooms either side of the partition and its door
    expect(r.rooms.filter((x) => x.areaM2 > 5)).toHaveLength(2)
  })
  it('without it: no door is invented, and the rooms run round the end of the partition into one', () => {
    const r = readInterior(plan(boxes), frame, body, T, 0)
    expect(r.doors).toEqual([])
    expect(r.rooms.filter((x) => x.areaM2 > 5)).toHaveLength(1)
  })
  it('a swing drawn but no outer wall at the far jamb (the gap opens onto nothing drawn): no door', () => {
    const open = [{ x0: 0, z0: 0, x1: 6, z1: 0.4 }, { x0: 0, z0: 5.6, x1: 6, z1: 6 }, { x0: 0, z0: 0, x1: 0.4, z1: 6 }, { x0: 5.6, z0: 0, x1: 6, z1: 2 }, { x0: 5.6, z0: 4, x1: 6, z1: 6 }, { x0: 0.4, z0: 2.95, x1: 4.75, z1: 3.05 }]
    const r = readInterior(plan(open, [arc]), frame, body, T, 0)
    expect(r.doors.some((x) => x.wallAxis === 'X' && Math.abs(x.at - 3) < 0.05)).toBe(false)
  })
})

describe('N8-03A: an overhead door’s tracks are drawn in grey line ink', () => {
  // a garage front wall at z 0..0.4 with a gate x 1..6; dashed grey tracks from both jambs 3 m into the room, and a red
  // dimension printed across the far end of one of them
  const host: WallHost = { massId: 'attached-0', facade: 'FRONT', planeAt: 0, from: 0, to: 7, centreAt: 0.2, storeyIndex: 0, floorY: 0, storeyHeightM: 2.8 }
  const dashes = (x: number): Box[] => Array.from({ length: 30 }, (_, i) => ({ x0: x - 0.01, z0: 0.4 + i * 0.1, x1: x + 0.01, z1: 0.4 + i * 0.1 + 0.07, rgb: [176, 176, 176] as [number, number, number] }))
  const wall = [{ x0: 0, z0: 0, x1: 1, z1: 0.4 }, { x0: 6, z0: 0, x1: 7, z1: 0.4 }]
  const red: Box[] = Array.from({ length: 8 }, (_, i) => ({ x0: 5.95, z0: 3.45 + i * 0.08, x1: 6.05, z1: 3.45 + i * 0.08 + 0.05, rgb: [150, 78, 78] as [number, number, number] }))
  it('two tracks of one length: the gate is an overhead door', () => {
    const t = overheadDoorTracks(plan([...wall, ...dashes(1.02), ...dashes(5.98)]), frame, host, [1, 6], T)
    expect(t?.lengthsM[0]).toBeCloseTo(t?.lengthsM[1] ?? 0, 1)
  })
  it('red text past the end of one track does not lengthen it: still two tracks of one length', () => {
    const t = overheadDoorTracks(plan([...wall, ...dashes(1.02), ...dashes(5.98), ...red]), frame, host, [1, 6], T)
    expect(t).toBeDefined()
    expect(Math.abs((t?.lengthsM[0] ?? 0) - (t?.lengthsM[1] ?? 9))).toBeLessThan(0.1)
  })
  it('no tracks: nothing', () => {
    expect(overheadDoorTracks(plan(wall), frame, host, [1, 6], T)).toBeUndefined()
  })
})
