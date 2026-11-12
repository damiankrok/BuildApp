/**
 * v3.53.6: rooms are the storey's, not the roof bodies'.
 *
 * The roof cuts a storey into bodies; the plan draws its rooms on the storey. Read body by body, a room that crosses
 * the line between two bodies came out as two fragments (or, with no wall built on the line, as part of whatever the
 * fragments touched). Here the storey is read by zones (`storeyZones`, `readInterior` with `domain`), and the same plan
 * read under two different technical cuts — and under none — gives the same rooms. Beside it: the walls and doors the
 * cut used to hide (a wall the floor's edge cuts short, a door against the wall across a partition's line, a door
 * between two jamb nibs, a door between two corners — each only where the plan draws its swing), two bodies that are
 * one walled room (`joinOpenSeams`), a contact with only crossing partitions on it, and a flush facade drawn through a
 * contact's end. Every plan is drawn from invented dimensions at 50 px per metre with 0.40 m outer walls.
 */
import { describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-cv'
import { applyCommands } from '@buildapp/commands'
import { createEmptyModel, validateModel } from '@buildapp/model'
import { emitBuilding, floorOfBody, joinOpenSeams, readInterior, readPartyWalls, storeyZones } from '../src/index.js'
import type { BuildingV2, InteriorReading, MassV2, PartyWallV2, PlanFrameV2, RoomPolygon } from '../src/index.js'

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
/** A door's swing: its quarter arc and, with `leaf`, the leaf drawn open — a line from the hinge along that axis. */
type Arc = { cx: number; cz: number; r: number; from: number; to: number; leaf?: 'X' | 'Z' }
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
  for (const a of arcs) {
    if (!a.leaf) continue
    for (let k = 0; k <= Math.round(a.r * PPM); k += 1) put(Math.round(OX + a.cx * PPM) + (a.leaf === 'X' ? k : 0), Math.round(OY + a.cz * PPM) + (a.leaf === 'Z' ? k : 0), [120, 120, 120])
  }
  for (const a of arcs) for (let d = a.from; d <= a.to; d += 0.25) put(Math.round(OX + (a.cx + a.r * Math.cos((d * Math.PI) / 180)) * PPM), Math.round(OY + (a.cz + a.r * Math.sin((d * Math.PI) / 180)) * PPM), [120, 120, 120])
  return { width: W, height: H, data }
}
const ring = (r: { x0: number; z0: number; x1: number; z1: number }): Box[] => [
  { x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z0 + T },
  { x0: r.x0, z0: r.z1 - T, x1: r.x1, z1: r.z1 },
  { x0: r.x0, z0: r.z0, x1: r.x0 + T, z1: r.z1 },
  { x0: r.x1 - T, z0: r.z0, x1: r.x1, z1: r.z1 },
]
const mass = (id: string, role: 'MAIN' | 'ATTACHED', x0: number, z0: number, x1: number, z1: number): MassV2 => ({ id, role, x0, z0, x1, z1, storeys: [0], featureId: `f-${id}`, sourceMassId: `src-${id}` })
const openWall = (host: MassV2, other: MassV2, hostFacade: PartyWallV2['hostFacade'], contactAt: number, span: [number, number]): PartyWallV2 => ({ id: `open-${host.id}-0-${other.id}`, storeyIndex: 0, hostMassId: host.id, otherMassId: other.id, hostFacade, contactAt, band: [contactAt, contactAt], thicknessM: 0, span, ends: ['BOTH_CORNERS', 'BOTH_CORNERS'], open: true, provenance: 'SOURCE_DERIVED', why: 'test: no wall drawn' })
const zonesOf = (masses: MassV2[], partyWalls: PartyWallV2[], passages: Array<[number, number]> = []) => storeyZones({ masses, storeyIndex: 0, partyWalls, rectOf: (m) => m, wallOf: () => T, passagesOf: () => passages, minJoinM: 0.5 })
/** The storey read as the solver reads it: each zone once, on its floor. */
const readStorey = (raster: Raster, masses: MassV2[], partyWalls: PartyWallV2[], extra: Box[] = []): InteriorReading[] =>
  zonesOf(masses, partyWalls).zones.map((z) => readInterior(raster, frame, z.first, T, 0, [], [], { ...(z.domain ? { domain: z.domain } : {}), extraBarriers: [...z.shut, ...extra] }))
const roomAt = (readings: InteriorReading[], x: number, z: number): RoomPolygon | undefined => readings.flatMap((r) => r.rooms).find((room) => x > room.bounds.x0 && x < room.bounds.x1 && z > room.bounds.z0 && z < room.bounds.z1 && inside({ x, z }, room.polygon))
const inside = (p: { x: number; z: number }, poly: ReadonlyArray<{ x: number; z: number }>): boolean => {
  let c = false
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) c = !c
  }
  return c
}

/**
 * A house 8 × 9 m. Two bedrooms at its rear, 3.55 × 4.0 m each, with a partition between them and a wall with their
 * two doors towards the day room in front. Nothing is drawn on z = 6 (where one roof cut puts a line) nor on x = 4.05
 * off the partition (where another does).
 */
const twoBedrooms = (): Raster =>
  plan([
    ...ring({ x0: 0, z0: 0, x1: 8, z1: 9 }),
    // the partition between the bedrooms, from their front wall to the rear wall
    { x0: 3.95, z0: 4.5, x1: 4.07, z1: 8.6 },
    // the bedrooms' front wall, with a 0.9 m door into each
    { x0: 0.4, z0: 4.5, x1: 1.5, z1: 4.62 },
    { x0: 2.4, z0: 4.5, x1: 5.5, z1: 4.62 },
    { x0: 6.4, z0: 4.5, x1: 7.6, z1: 4.62 },
  ])
const whole = mass('main', 'MAIN', 0, 0, 8, 9)
const front = mass('main', 'MAIN', 0, 0, 8, 6)
const rear = mass('attached-0', 'ATTACHED', 0, 6, 8, 9)
const west = mass('main', 'MAIN', 0, 0, 4.6, 9)
const east = mass('attached-0', 'ATTACHED', 4.6, 0, 8, 9)

describe('v3.53.6: the cause — a room cut by nothing but the line between two roof bodies', () => {
  it('two bodies with no wall drawn between them are one zone: their floors and the strip between their inner faces', () => {
    const { zones, links } = zonesOf([front, rear], [openWall(front, rear, 'REAR', 6, [0, 8])])
    expect(zones).toHaveLength(1)
    expect(zones[0].members.map((m) => m.id)).toEqual(['main', 'attached-0'])
    expect(zones[0].first.id).toBe('main')
    expect(zones[0].domain).toEqual([
      { x0: 0.4, z0: 0.4, x1: 7.6, z1: 5.6 },
      { x0: 0.4, z0: 6.4, x1: 7.6, z1: 8.6 },
      { x0: 0.4, z0: 5.6, x1: 7.6, z1: 6.4, strip: true },
    ])
    expect(links[0]).toMatch(/main \+ attached-0 over 0\.40\.\.7\.60 \(no wall drawn\)/)
  })

  it('the two bedrooms are read whole across the line: 3 rooms, each bedroom its drawn 3.55 × 4.0 m', () => {
    const readings = readStorey(twoBedrooms(), [front, rear], [openWall(front, rear, 'REAR', 6, [0, 8])])
    const rooms = readings.flatMap((r) => r.rooms)
    expect(rooms).toHaveLength(3)
    const a = roomAt(readings, 2, 7)
    const b = roomAt(readings, 6, 7)
    const day = roomAt(readings, 4, 2)
    expect(a && b && day && a !== b && a !== day && b !== day).toBe(true)
    // drawn: 0.40..3.95 × 4.62..8.60 = 14.13 m², and 4.07..7.60 × 4.62..8.60 = 14.05 m² (the grid takes 5 cm off a side)
    expect(a?.areaM2).toBeGreaterThan(13.4)
    expect(a?.areaM2).toBeLessThan(14.2)
    expect(b?.areaM2).toBeGreaterThan(13.3)
    expect(b?.areaM2).toBeLessThan(14.1)
    expect(a?.bounds.z0).toBeLessThan(4.75)
    expect(a?.bounds.z1).toBeGreaterThan(8.5)
    expect(readings.flatMap((r) => r.doors)).toHaveLength(2)
  })

  it('the same plan under another cut, and under none: the same number of rooms, the same areas', () => {
    const none = readStorey(twoBedrooms(), [whole], [])
    const across = readStorey(twoBedrooms(), [front, rear], [openWall(front, rear, 'REAR', 6, [0, 8])])
    const along = readStorey(twoBedrooms(), [west, east], [openWall(west, east, 'EAST', 4.6, [0, 9])])
    for (const cut of [across, along]) {
      expect(cut.flatMap((r) => r.rooms)).toHaveLength(none.flatMap((r) => r.rooms).length)
      for (const [x, z] of [[2, 7], [6, 7], [4, 2]] as const) {
        const want = roomAt(none, x, z)
        const got = roomAt(cut, x, z)
        expect(got).toBeDefined()
        // the same room to within the reading grid (5 cm cells, phased on each window's own corner)
        expect(Math.abs((got?.areaM2 ?? 0) - (want?.areaM2 ?? 0))).toBeLessThan(0.45)
        for (const k of ['x0', 'z0', 'x1', 'z1'] as const) expect(Math.abs((got?.bounds[k] ?? 0) - (want?.bounds[k] ?? 0))).toBeLessThanOrEqual(0.1)
      }
    }
  })

  it('compiled: the storey built from the zone reading holds the three rooms and validates', () => {
    const wall = openWall(front, rear, 'REAR', 6, [0, 8])
    const [reading] = readStorey(twoBedrooms(), [front, rear], [wall])
    const prefixed: InteriorReading = { ...reading, walls: reading.walls.map((w) => ({ ...w, id: `main-${w.id}` })), doors: reading.doors.map((d) => ({ ...d, id: `main-${d.id}`, betweenIds: [`main-${d.betweenIds[0]}`, `main-${d.betweenIds[1]}`] as [string, string] })), rooms: reading.rooms.map((r) => ({ ...r, id: `main-${r.id}` })) }
    const applied = applyCommands(createEmptyModel('m', 'v3536'), emitBuilding(building([front, rear], [wall], [prefixed]), 'v3536').program)
    expect(applied.failedAt === undefined ? [] : applied.results[applied.failedAt]).toEqual([])
    expect(validateModel(applied.model).issues.filter((i) => i.severity === 'ERROR')).toEqual([])
    expect(applied.model.rooms).toHaveLength(3)
    // no wall on the line the roof was cut on: no exterior wall lies along z = 6
    for (const w of applied.model.walls.filter((x) => x.kind === 'EXTERIOR')) expect(Math.abs(w.start.z - 6) < 1e-6 && Math.abs(w.end.z - 6) < 1e-6).toBe(false)
    expect(applied.model.openings.filter((o) => o.kind === 'DOOR')).toHaveLength(2)
  })
})

describe('v3.53.6: counter-cases', () => {
  it('a wall on every shared side: each body its own zone, read inside its walls as before', () => {
    const wall: PartyWallV2 = { ...openWall(front, rear, 'REAR', 6, [0, 8]), id: 'party-main-0-attached-0', open: undefined, band: [5.8, 6.0], thicknessM: 0.2 }
    const { zones } = zonesOf([front, rear], [wall])
    expect(zones).toHaveLength(2)
    // the one wall runs the whole side: the side stands on the wall's face, and nothing else changes (no domain)
    expect(zones.every((z) => z.domain === undefined && z.shut.length === 0)).toBe(true)
    expect(floorOfBody(front, front, T, [wall]).base).toEqual({ x0: 0.4, z0: 0.4, x1: 7.6, z1: 5.8 })
    expect(floorOfBody(rear, rear, T, [wall]).base).toEqual({ x0: 0.4, z0: 6, x1: 7.6, z1: 8.6 })
  })

  it('a wall shared along PART of a side moves the floor along that part only', () => {
    const wing = mass('attached-0', 'ATTACHED', 4, 6, 8, 9)
    const wall: PartyWallV2 = { ...openWall(wing, front, 'FRONT', 6, [4, 8]), id: 'party-attached-0-0-main', open: undefined, band: [6.0, 6.12], thicknessM: 0.12 }
    const floor = floorOfBody(front, front, T, [wall])
    // behind the rest of the side (x 0.4..4) the body's own wall stands: the floor ends at its inner face, 5.6
    expect(floor.base).toEqual({ x0: 0.4, z0: 0.4, x1: 7.6, z1: 5.6 })
    expect(floor.more).toEqual([{ x0: 4, z0: 5.6, x1: 7.6, z1: 6, strip: true }])
    expect(floor.shut).toEqual([])
  })

  it('a wall with a stretch left out joins the two bodies over that stretch only', () => {
    const wall: PartyWallV2 = { ...openWall(front, rear, 'REAR', 6, [0, 8]), id: 'party-main-0-attached-0', open: undefined, band: [5.88, 6.0], thicknessM: 0.12 }
    const { zones } = zonesOf([front, rear], [wall], [[1, 4.5]])
    expect(zones).toHaveLength(1)
    expect(zones[0].domain?.filter((r) => r.strip)).toEqual([{ x0: 1, z0: 5.88, x1: 4.5, z1: 6, strip: true }])
  })

  it('two rooms with a drawn partition and door stay two rooms on a zone', () => {
    const readings = readStorey(twoBedrooms(), [front, rear], [openWall(front, rear, 'REAR', 6, [0, 8])])
    expect(roomAt(readings, 2, 7)?.id).not.toBe(roomAt(readings, 6, 7)?.id)
    expect(roomAt(readings, 2, 7)?.doorIds).toHaveLength(1)
  })

  it('an open living zone across the line stays one room, flagged open-plan, with no boundary invented on the line', () => {
    const wingL = mass('attached-0', 'ATTACHED', 0, 6, 5, 9)
    const raster = plan([{ x0: 0, z0: 0, x1: 8, z1: T }, { x0: 0, z0: 0, x1: T, z1: 9 }, { x0: 8 - T, z0: 0, x1: 8, z1: 6 }, { x0: 5 - T, z0: 6, x1: 8, z1: 6 - 0 + 0 }, { x0: 4.6, z0: 5.6, x1: 8, z1: 6 }, { x0: 4.6, z0: 6, x1: 5, z1: 9 }, { x0: 0, z0: 8.6, x1: 5, z1: 9 }])
    const readings = readStorey(raster, [front, wingL], [openWall(front, wingL, 'REAR', 6, [0, 5])])
    const rooms = readings.flatMap((r) => r.rooms)
    expect(rooms).toHaveLength(1)
    expect(rooms[0].openPlan).toBe(true)
    // 7.2 × 5.2 in the main body, 4.2 × 3.0 beyond the line
    expect(rooms[0].areaM2).toBeGreaterThan(49)
    expect(rooms[0].areaM2).toBeLessThan(51)
  })

  it('a recess under the roof is no room\'s floor: shut out with its back walls', () => {
    const raster = plan(ring({ x0: 0, z0: 0, x1: 8, z1: 9 }))
    const full = readStorey(raster, [whole], [])
    const less = readStorey(raster, [whole], [], [{ x0: 0, z0: 6, x1: 3, z1: 9 }])
    expect(full[0].rooms[0].areaM2 - less[0].rooms[0].areaM2).toBeGreaterThan(6.4)
    expect(roomAt(less, 1.5, 7.5)).toBeUndefined()
  })
})

/**
 * A garage (5 × 4 m) in front of a house (8 × 6 m), no wall between them over the garage's width: the garage runs 1.1 m
 * into the house, to its rear wall there. The garage's east side carries on into the house as a 0.12 m partition beside
 * the door to the rest of the house: 0.12 m of it stands past the house's inner face, then the 0.98 m door, then the
 * garage's rear wall across.
 */
const garage = mass('attached-0', 'ATTACHED', 0, 0, 5, 4)
const house = mass('main', 'MAIN', 0, 4, 8, 10)
const garageAndVestibule = (swing: boolean): Raster =>
  plan(
    [
      // the garage: its front, west and east walls (no rear wall: it runs into the house)
      { x0: 0, z0: 0, x1: 5, z1: T },
      { x0: 0, z0: 0, x1: T, z1: 4 },
      { x0: 5 - T, z0: 0, x1: 5, z1: 4 },
      // the house: its front wall east of the garage's inner face, and the rest of its ring
      { x0: 5 - T, z0: 4, x1: 8, z1: 4 + T },
      { x0: 0, z0: 4, x1: T, z1: 10 },
      { x0: 8 - T, z0: 4, x1: 8, z1: 10 },
      { x0: 0, z0: 10 - T, x1: 8, z1: 10 },
      // the garage's east side carried on 0.12 m past the house's inner face, as a partition
      { x0: 5 - T, z0: 4 + T, x1: 4.72, z1: 4.52 },
      // the garage's rear wall, inside the house
      { x0: T, z0: 5.5, x1: 4.72, z1: 5.62 },
    ],
    swing ? [{ cx: 4.66, cz: 4.52, r: 0.98, from: 0, to: 90, leaf: 'X' }] : [],
  )

describe('v3.53.6: a wall the floor\'s edge cuts short, and the door beside it', () => {
  it('the stub is read by its drawn length, the door against the wall across its line by its swing: garage and vestibule are two rooms', () => {
    const readings = readStorey(garageAndVestibule(true), [house, garage], [openWall(house, garage, 'FRONT', 4, [0, 5])])
    const g = roomAt(readings, 2, 2)
    const v = roomAt(readings, 6.5, 5.2)
    expect(g).toBeDefined()
    expect(v).toBeDefined()
    expect(g?.id).not.toBe(v?.id)
    // the garage: 4.2 m wide from its front wall to its rear wall in the house, 0.40..5.50
    expect(g?.areaM2).toBeGreaterThan(20.4)
    expect(g?.areaM2).toBeLessThan(21.6)
    expect(roomAt(readings, 2, 5)?.id).toBe(g?.id)
    const door = readings.flatMap((r) => r.doors).find((d) => /wall across its line/.test(d.why))
    expect(door).toMatchObject({ wallAxis: 'Z' })
    expect(door?.widthM).toBeGreaterThan(0.9)
    expect(door?.widthM).toBeLessThan(1.05)
  })

  it('no swing drawn: no door is read there (the gap stays what it was)', () => {
    const readings = readStorey(garageAndVestibule(false), [house, garage], [openWall(house, garage, 'FRONT', 4, [0, 5])])
    expect(readings.flatMap((r) => r.doors).some((d) => /wall across its line/.test(d.why))).toBe(false)
    expect(roomAt(readings, 2, 2)?.id).toBe(roomAt(readings, 6.5, 5.2)?.id)
  })
})

/** A corridor 1.3 m wide between two walls that run on past a door set between two 0.15 m nibs. */
const corridor = (opts: { swing: boolean; nibs: boolean; leaf?: boolean }): Raster =>
  plan(
    [
      ...ring({ x0: 0, z0: 0, x1: 8, z1: 6 }),
      { x0: 3.0, z0: T, x1: 3.12, z1: 6 - T },
      { x0: 4.42, z0: T, x1: 4.54, z1: 6 - T },
      ...(opts.nibs ? [{ x0: 3.12, z0: 3.0, x1: 3.27, z1: 3.1 }, { x0: 4.27, z0: 3.0, x1: 4.42, z1: 3.1 }] : []),
    ],
    opts.swing ? [{ cx: 3.27, cz: 3.05, r: 1.0, from: 0, to: 90, ...(opts.leaf === false ? {} : { leaf: 'Z' as const }) }] : [],
  )
const hall = mass('main', 'MAIN', 0, 0, 8, 6)

describe('v3.53.6: a door set between two walls that run on past it', () => {
  it('two nibs and the swing drawn between them: a door, and the corridor behind it is its own room', () => {
    const readings = readStorey(corridor({ swing: true, nibs: true }), [hall], [])
    const door = readings[0].doors.find((d) => /nibs/.test(d.why))
    expect(door).toMatchObject({ wallAxis: 'X' })
    expect(door?.widthM).toBeGreaterThan(0.95)
    expect(door?.widthM).toBeLessThan(1.05)
    expect(roomAt(readings, 3.77, 1.5)?.id).not.toBe(roomAt(readings, 3.77, 4.5)?.id)
    // the nibs are the door's wall
    expect(readings[0].walls.filter((w) => w.id.startsWith('nib-'))).toHaveLength(2)
    expect(readings[0].rooms).toHaveLength(4)
  })

  it('an arc with no leaf drawn beside it is not a door\'s swing (N8-03D2): no door', () => {
    const readings = readStorey(corridor({ swing: true, nibs: true, leaf: false }), [hall], [])
    expect(readings[0].doors).toHaveLength(0)
  })

  it('a leaf drawn as a grey bar as wide as a partition (the smaller sheets) is a leaf: a door', () => {
    const base = corridor({ swing: true, nibs: true, leaf: false })
    // a bar 0.10 m wide: a dark outline, a grey fill
    const bar = plan([{ x0: 3.27, z0: 3.05, x1: 3.37, z1: 4.05, rgb: [170, 170, 170] }, { x0: 3.27, z0: 3.05, x1: 3.29, z1: 4.05, rgb: [70, 70, 70] }, { x0: 3.35, z0: 3.05, x1: 3.37, z1: 4.05, rgb: [70, 70, 70] }])
    for (let i = 0; i < base.data.length; i += 1) base.data[i] = Math.min(base.data[i], bar.data[i])
    expect(readStorey(base, [hall], [])[0].doors.filter((d) => /nibs/.test(d.why))).toHaveLength(1)
  })

  it('a leaf drawn IN the doorway: the arc is the swing of the door in the wall square to this one — no door here', () => {
    const base = corridor({ swing: true, nibs: true })
    const inDoorway = plan([{ x0: 3.27, z0: 3.04, x1: 4.27, z1: 3.06, rgb: [120, 120, 120] }])
    for (let i = 0; i < base.data.length; i += 1) base.data[i] = Math.min(base.data[i], inDoorway.data[i])
    expect(readStorey(base, [hall], [])[0].doors).toHaveLength(0)
  })

  it('an arc that does not close the doorway (a 0.70 m swing in a 1.00 m gap) is not this doorway\'s door', () => {
    const raster = plan([...ring({ x0: 0, z0: 0, x1: 8, z1: 6 }), { x0: 3.0, z0: T, x1: 3.12, z1: 6 - T }, { x0: 4.42, z0: T, x1: 4.54, z1: 6 - T }, { x0: 3.12, z0: 3.0, x1: 3.27, z1: 3.1 }, { x0: 4.27, z0: 3.0, x1: 4.42, z1: 3.1 }], [{ cx: 3.27, cz: 3.05, r: 0.7, from: 0, to: 90, leaf: 'Z' }])
    expect(readStorey(raster, [hall], [])[0].doors).toHaveLength(0)
  })

  it('the edge of a tone that follows the arc (a watermark) is no line: no door', () => {
    const base = corridor({ swing: false, nibs: true })
    // a grey quarter disc on the swing's place: its edge is the arc, darker on one side only
    for (let py = 0; py < H; py += 1) {
      for (let px = 0; px < W; px += 1) {
        const dx = (px - OX) / PPM - 3.27
        const dz = (py - OY) / PPM - 3.05
        if (dx > 0 && dz > 0.06 && Math.hypot(dx, dz) <= 1.0) {
          const o = (py * W + px) * 4
          if (base.data[o] > 180) base.data[o] = base.data[o + 1] = base.data[o + 2] = 180
        }
      }
    }
    expect(readStorey(base, [hall], [])[0].doors).toHaveLength(0)
  })

  it('lines that cross the arc\'s place without following it (stair treads) are no swing: no door', () => {
    // treads 0.25 m apart across the doorway's far side, and a line from the hinge that could pass for a leaf
    const treads: Box[] = Array.from({ length: 5 }, (_, k) => ({ x0: 3.12, z0: 3.3 + k * 0.25, x1: 4.42, z1: 3.32 + k * 0.25, rgb: [120, 120, 120] as [number, number, number] }))
    const raster = plan([...ring({ x0: 0, z0: 0, x1: 8, z1: 6 }), { x0: 3.0, z0: T, x1: 3.12, z1: 6 - T }, { x0: 4.42, z0: T, x1: 4.54, z1: 6 - T }, { x0: 3.12, z0: 3.0, x1: 3.27, z1: 3.1 }, { x0: 4.27, z0: 3.0, x1: 4.42, z1: 3.1 }, { x0: 3.27, z0: 3.05, x1: 3.29, z1: 4.05, rgb: [120, 120, 120] }, ...treads])
    const readings = readStorey(raster, [hall], [])
    expect(readings[0].doors).toHaveLength(0)
  })

  it('nibs with no swing drawn: no door, no wall of them, the corridor one room', () => {
    const readings = readStorey(corridor({ swing: false, nibs: true }), [hall], [])
    expect(readings[0].doors).toHaveLength(0)
    expect(readings[0].walls.some((w) => w.id.startsWith('nib-'))).toBe(false)
    expect(readings[0].rooms).toHaveLength(3)
  })

  it('a swing with no nibs: no door (an arc alone is a leaf drawn somewhere else)', () => {
    const readings = readStorey(corridor({ swing: true, nibs: false }), [hall], [])
    expect(readings[0].doors).toHaveLength(0)
    expect(readings[0].rooms).toHaveLength(3)
  })

  it('where the storey has no floor (a stair flight on the doorway) no such door is read', () => {
    const readings = readStorey(corridor({ swing: true, nibs: true }), [hall], [], [{ x0: 3.12, z0: 2.6, x1: 4.42, z1: 3.6 }])
    expect(readings[0].doors).toHaveLength(0)
  })
})

/** A wall with a 0.9 m gap whose two jambs are corners with walls across. */
const cornerDoor = (swing: boolean): Raster =>
  plan(
    [
      ...ring({ x0: 0, z0: 0, x1: 8, z1: 6 }),
      { x0: T, z0: 3.0, x1: 2.0, z1: 3.12 },
      { x0: 2.9, z0: 3.0, x1: 8 - T, z1: 3.12 },
      { x0: 1.88, z0: 3.12, x1: 2.0, z1: 6 - T },
      { x0: 2.9, z0: T, x1: 3.02, z1: 3.0 },
    ],
    swing ? [{ cx: 2.06, cz: 3.06, r: 0.84, from: 0, to: 90, leaf: 'Z' }] : [],
  )

describe('v3.53.6: a door hung between two corners', () => {
  it('the swing drawn: a door', () => {
    const readings = readStorey(cornerDoor(true), [hall], [])
    expect(readings[0].doors.filter((d) => /between two corners/.test(d.why))).toHaveLength(1)
    expect(roomAt(readings, 2.45, 2)?.id).not.toBe(roomAt(readings, 2.45, 4.5)?.id)
  })

  it('no swing: the width of a room between two walls, as before', () => {
    const readings = readStorey(cornerDoor(false), [hall], [])
    expect(readings[0].doors).toHaveLength(0)
    expect(roomAt(readings, 2.45, 2)?.id).toBe(roomAt(readings, 2.45, 4.5)?.id)
  })
})

describe('v3.53.6: a contact with only crossing walls on it, and a flush facade through its end', () => {
  const read = (masses: MassV2[], raster: Raster) => readPartyWalls({ masses, plans: new Map([[0, { raster, frame }]]), wallOf: () => T })
  /** The 8 × 9 m house as two bodies, nothing on z = 6 but the partition between two rooms crossing it (twice, 0.2 m). */
  const crossed = (more: Box[] = []): Raster => plan([...ring({ x0: 0, z0: 0, x1: 8, z1: 9 }), { x0: 2.6, z0: 4.5, x1: 2.8, z1: 8.6 }, { x0: 5.2, z0: 4.5, x1: 5.4, z1: 8.6 }, ...more])

  it('partitions crossing the line are no wall on it: OPEN, with the ink along the line counted apart', () => {
    const r = read([front, rear], crossed())[0]
    expect(r.reading.solid).toBeGreaterThan(0.02 * r.reading.samples)
    expect(r.reading.along).toBe(0)
    expect(r.decision).toBe('OPEN')
  })

  it('a wall that runs along the line for a metre is a wall on it: not open', () => {
    const r = read([front, rear], crossed([{ x0: 1, z0: 5.94, x1: 2, z1: 6.06 }]))[0]
    expect(r.reading.along).toBeGreaterThan(40)
    expect(r.decision).not.toBe('OPEN')
  })

  it('a window in the flush facade at the contact\'s end: the facade is drawn through it, OPEN', () => {
    const lines: Box[] = [0.04, 0.2, 0.36].map((x) => ({ x0: x, z0: 5.2, x1: x + 0.02, z1: 6.8, rgb: [110, 110, 110] as [number, number, number] }))
    const raster = plan([{ x0: 0, z0: 0, x1: 8, z1: T }, { x0: 0, z0: 9 - T, x1: 8, z1: 9 }, { x0: 8 - T, z0: 0, x1: 8, z1: 9 }, { x0: 0, z0: 0, x1: T, z1: 5.2 }, { x0: 0, z0: 6.8, x1: T, z1: 9 }, ...lines])
    const r = read([front, rear], raster)[0]
    expect(r.reading.cornersInk?.[0]).toBeLessThan(0.15)
    expect(r.reading.flushFacade?.[0]).toBeGreaterThanOrEqual(0.9)
    expect(r.decision).toBe('OPEN')
  })

  it('nothing drawn at the flush end (a contact off the drawing): not open', () => {
    const raster = plan([{ x0: 0, z0: 0, x1: 8, z1: T }, { x0: 0, z0: 9 - T, x1: 8, z1: 9 }, { x0: 8 - T, z0: 0, x1: 8, z1: 9 }, { x0: 0, z0: 0, x1: T, z1: 5.2 }, { x0: 0, z0: 6.8, x1: T, z1: 9 }])
    const r = read([front, rear], raster)[0]
    expect(r.reading.flushFacade?.[0]).toBeLessThan(0.9)
    expect(r.decision).toBe('UNDECIDED')
  })

  it('a strip a wall thick is no body a room runs into: the new evidence is not heard for it', () => {
    const strip = mass('attached-0', 'ATTACHED', 0, 6, 8, 6.6)
    const r = read([front, strip], crossed())[0]
    expect(r.reading.flushFacade).toBeUndefined()
    expect(r.decision).not.toBe('OPEN')
  })
})

describe('v3.53.6: two rectangles that are one walled room', () => {
  // a 3 × 3 grid: columns 0..100..110..140 px, rows 0..50..100..150 px, 0.03 m a pixel
  const xs = [0, 100, 110, 140]
  const ys = [0, 50, 100, 150]
  const edge = { wall: 0, line: 0, opening: 0, closure: 0 }
  const cells = xs.slice(0, -1).flatMap((x0, ix) => ys.slice(0, -1).map((y0, iy) => ({ ix, iy, rect: { x0, y0, x1: xs[ix + 1], y1: ys[iy + 1] }, classification: 'BUILT' as const, edges: [edge, edge, edge, edge] as [typeof edge, typeof edge, typeof edge, typeof edge], enclosed: true, interiorInk: 0, confidence: 1, why: '' })))
  const decomposition = { cells } as unknown as Parameters<typeof joinOpenSeams>[1]
  const registration = { originPx: { x: 0, y: 0 }, metresPerPixelX: 0.03, metresPerPixelY: 0.03 } as unknown as Parameters<typeof joinOpenSeams>[4]
  const region = (id: string, ix0: number, iy0: number, ix1: number, iy1: number) => ({ id, classification: 'BUILT' as const, rect: { x0: xs[ix0], y0: ys[iy0], x1: xs[ix1 + 1], y1: ys[iy1 + 1] }, metric: { x0: 0, z0: 0, x1: 0, z1: 0 }, cells: Array.from({ length: (ix1 - ix0 + 1) * (iy1 - iy0 + 1) }, (_, k) => ({ ix: ix0 + (k % (ix1 - ix0 + 1)), iy: iy0 + Math.floor(k / (ix1 - ix0 + 1)) })), confidence: 0.9, why: 'test' })
  const upper = region('region-built-0-0', 0, 0, 0, 0) // 3.0 × 1.5 m
  const lower = region('region-built-0-1', 0, 1, 1, 1) // 3.3 × 1.5 m: 0.3 m wider
  const band = (x0: number, y0: number, x1: number, y1: number, axis: 'HORIZONTAL' | 'VERTICAL') => ({ axis, bounds: { x0, y0, x1, y1 }, thickness: axis === 'HORIZONTAL' ? y1 - y0 + 1 : x1 - x0 + 1, length: axis === 'HORIZONTAL' ? x1 - x0 + 1 : y1 - y0 + 1, fill: 1, axisPx: axis === 'HORIZONTAL' ? (y0 + y1) / 2 : (x0 + x1) / 2, pieces: 1 }) as unknown as Parameters<typeof joinOpenSeams>[2][number]

  it('no wall on the seam, a step of 0.3 m, the notch a wall thick: one body, the rectangle around both', () => {
    const { regions, joined } = joinOpenSeams([upper, lower], decomposition, [], 15, registration, 1.12)
    expect(regions).toHaveLength(1)
    expect(regions[0].rect).toEqual({ x0: 0, y0: 0, x1: 110, y1: 100 })
    expect(regions[0].cells).toHaveLength(4)
    expect(joined[0]).toMatch(/seam 3\.00 m, step 0\.30 m/)
  })

  it('a wall drawn along the seam: two bodies', () => {
    const { regions, refused } = joinOpenSeams([upper, lower], decomposition, [band(0, 45, 99, 55, 'HORIZONTAL')], 15, registration, 1.12)
    expect(regions).toHaveLength(2)
    expect(refused[0]).toMatch(/of the 3\.00 m seam is wall/)
  })

  it('the side walls crossing the seam at its ends are the room\'s own: still one body', () => {
    const { regions } = joinOpenSeams([upper, lower], decomposition, [band(0, 0, 12, 100, 'VERTICAL')], 15, registration, 1.12)
    expect(regions).toHaveLength(1)
  })

  it('a wing wider than a body beside the seam (an L): two bodies', () => {
    const wide = region('region-built-0-1', 0, 1, 2, 1) // 4.2 m against 3.0 m: 1.2 m more
    const { regions, refused } = joinOpenSeams([upper, wide], decomposition, [], 15, registration, 1.12)
    expect(regions).toHaveLength(2)
    expect(refused[0]).toMatch(/as much as a body is wide/)
  })

  it('open ground in the corner of the rectangle around both: two bodies', () => {
    const big = [0, 100, 130, 160]
    const groundCells = big.slice(0, -1).flatMap((x0, ix) => ys.slice(0, -1).map((y0, iy) => ({ ix, iy, rect: { x0, y0, x1: big[ix + 1], y1: ys[iy + 1] }, classification: 'BUILT' as const, edges: [edge, edge, edge, edge], enclosed: true, interiorInk: 0, confidence: 1, why: '' })))
    const a = { ...upper }
    const b = { ...lower, rect: { x0: 0, y0: 50, x1: 130, y1: 100 } }
    const { regions, refused } = joinOpenSeams([a, b], { cells: groundCells } as unknown as Parameters<typeof joinOpenSeams>[1], [], 15, registration, 1.12)
    expect(regions).toHaveLength(2)
    expect(refused[0]).toMatch(/open ground/)
  })
})

function building(masses: MassV2[], partyWalls: PartyWallV2[], interior: InteriorReading[]): BuildingV2 {
  return {
    label: 'v3536',
    wallThicknessM: T,
    slabThicknessM: 0.25,
    levels: [{ index: 0, id: 'lvl-0', elevation: 0, height: 2.9, wallTop: 2.65, featureId: 'f-lvl-0' }],
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
    interior,
    assemblies: [],
    surfaceRegions: [],
    partyWalls,
  }
}
