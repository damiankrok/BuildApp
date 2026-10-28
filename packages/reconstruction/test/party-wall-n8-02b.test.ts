/**
 * N8-02B: one wall where two bodies meet and the plan draws one band (`party-wall.ts`), built once, of the drawn
 * thickness, with its doorway cut in it; two walls where the plan draws two; nothing shared where the bodies do not meet;
 * and a door at the end of a partition only where its swing is drawn (`readInterior`). Every plan here is drawn from
 * invented dimensions at 50 px per metre: a house 8 m wide with 0.40 m walls, a garage built against its east face.
 */
import { describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-cv'
import { applyCommands } from '@buildapp/commands'
import { createEmptyModel, validateModel } from '@buildapp/model'
import { compileBuilding } from '@buildapp/geometry'
import type { Triangle, Vec3 } from '@buildapp/geometry'
import { emitBuilding, readInterior, readPartyWalls, sideSegments, swingDrawn } from '../src/index.js'
import type { BuildingV2, MassV2, PartyWallV2, PlanFrameV2 } from '../src/index.js'

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

type Box = { x0: number; z0: number; x1: number; z1: number; luma?: number }
function plan(boxes: Box[], arcs: Array<{ cx: number; cz: number; r: number; from: number; to: number }> = []): Raster {
  const data = new Uint8ClampedArray(W * H * 4).fill(255)
  const put = (px: number, py: number, l: number): void => {
    if (px < 0 || py < 0 || px >= W || py >= H) return
    const o = (py * W + px) * 4
    data[o] = l
    data[o + 1] = l
    data[o + 2] = l
  }
  for (const b of boxes) for (let py = Math.round(OY + b.z0 * PPM); py < Math.round(OY + b.z1 * PPM); py += 1) for (let px = Math.round(OX + b.x0 * PPM); px < Math.round(OX + b.x1 * PPM); px += 1) put(px, py, b.luma ?? 30)
  for (const a of arcs) for (let d = a.from; d <= a.to; d += 0.5) put(Math.round(OX + (a.cx + a.r * Math.cos((d * Math.PI) / 180)) * PPM), Math.round(OY + (a.cz + a.r * Math.sin((d * Math.PI) / 180)) * PPM), 120)
  return { width: W, height: H, data }
}
/** A rectangle's walls of thickness `t`, inside its outline; `skipEast`/`skipWest` leave that side undrawn. */
const ring = (r: { x0: number; z0: number; x1: number; z1: number }, t: number, skip: { east?: boolean; west?: boolean } = {}): Box[] => [
  { x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z0 + t },
  { x0: r.x0, z0: r.z1 - t, x1: r.x1, z1: r.z1 },
  ...(skip.west ? [] : [{ x0: r.x0, z0: r.z0, x1: r.x0 + t, z1: r.z1 }]),
  ...(skip.east ? [] : [{ x0: r.x1 - t, z0: r.z0, x1: r.x1, z1: r.z1 }]),
]
const mass = (id: string, role: 'MAIN' | 'ATTACHED', x0: number, z0: number, x1: number, z1: number, storeys = [0], more: Partial<MassV2> = {}): MassV2 => ({ id, role, x0, z0, x1, z1, storeys, featureId: `f-${id}`, sourceMassId: `src-${id}`, ...more })
const house = mass('main', 'MAIN', 0, 0, 8, 10, [0, 1])
const garage = mass('attached-0', 'ATTACHED', 8, 1, 12, 9)
const read = (masses: MassV2[], raster: Raster) => readPartyWalls({ masses, plans: new Map([[0, { raster, frame }]]), wallOf: () => T })

/**
 * The plan a garage built against a house draws: the house's walls, the garage's front, rear and far walls, and between
 * them one 0.25 m band standing inside the house's face (the house wall without its outer layer), broken by a 0.9 m door.
 */
const shared = (band: Box = { x0: 7.6, z0: 0, x1: 7.85, z1: 10 }, door: [number, number] | undefined = [3, 3.9]): Raster =>
  plan([
    ...ring({ x0: 0, z0: 0, x1: 8, z1: 10 }, T, { east: true }),
    { x0: 7.6, z0: 0, x1: 8, z1: 1 },
    { x0: 7.6, z0: 9, x1: 8, z1: 10 },
    ...(door ? [{ ...band, z1: door[0] }, { ...band, z0: door[1] }] : [band]),
    ...ring({ x0: 7.85, z0: 1, x1: 12, z1: 9 }, T, { west: true }),
  ])

describe('N8-02B: the band across a contact decides one wall or two', () => {
  it('one 0.25 m band inside the house: ONE_WALL on the band, built by the house, the garage builds none there', () => {
    const records = read([house, garage], shared())
    expect(records).toHaveLength(1)
    const r = records[0]
    expect(r.decision).toBe('ONE_WALL')
    expect(r.wall?.hostMassId).toBe('main')
    expect(r.wall?.hostFacade).toBe('EAST')
    expect(r.wall?.band[0]).toBeCloseTo(7.6, 1)
    expect(r.wall?.band[1]).toBeCloseTo(7.85, 1)
    expect(r.wall?.thicknessM).toBeGreaterThan(0.22)
    expect(r.wall?.thicknessM).toBeLessThan(0.3)
    expect(r.wall?.span).toEqual([1, 9])
    expect(r.wall?.ends).toEqual(['OTHER_CORNER', 'OTHER_CORNER'])
  })

  it('a band under a watermark (mid-grey, flat) is still the wall: no gap, no second reading', () => {
    const r = read([house, garage], plan([...ring({ x0: 0, z0: 0, x1: 8, z1: 10 }, T, { east: true }), { x0: 7.6, z0: 0, x1: 7.85, z1: 4 }, { x0: 7.6, z0: 4, x1: 7.85, z1: 5.5, luma: 94 }, { x0: 7.6, z0: 5.5, x1: 7.85, z1: 10 }, ...ring({ x0: 7.85, z0: 1, x1: 12, z1: 9 }, T, { west: true })]))[0]
    expect(r.decision).toBe('ONE_WALL')
    // only the two rows where black meets the grey are not flat along the wall
    expect(r.reading.samples - r.reading.solid).toBeLessThanOrEqual(2)
  })

  it('two bands a joint apart (a double wall, a movement joint): TWO_WALLS', () => {
    const r = read([house, garage], plan([...ring({ x0: 0, z0: 0, x1: 8, z1: 10 }, T), ...ring({ x0: 8, z0: 1, x1: 12, z1: 9 }, T).map((b) => ({ ...b, x0: Math.max(b.x0, 8.04) }))]))[0]
    expect(r.decision).toBe('TWO_WALLS')
    expect(r.wall).toBeUndefined()
  })

  it('one band as thick as both walls: two walls drawn touching, TWO_WALLS', () => {
    const r = read([house, garage], plan([...ring({ x0: 0, z0: 0, x1: 8, z1: 10 }, T), ...ring({ x0: 8, z0: 1, x1: 12, z1: 9 }, T)]))[0]
    expect(r.decision).toBe('TWO_WALLS')
    expect(r.reading.widthM).toBeGreaterThan(0.75)
  })

  it('bodies a metre apart share nothing: no record, nothing changes', () => {
    const apart = mass('attached-0', 'ATTACHED', 9, 1, 13, 9)
    expect(read([house, apart], plan([...ring({ x0: 0, z0: 0, x1: 8, z1: 10 }, T), ...ring({ x0: 9, z0: 1, x1: 13, z1: 9 }, T)]))).toEqual([])
  })

  it('touching is not enough: too little wall drawn along the contact leaves both walls, named UNDECIDED', () => {
    // a 1.2 m pier on the contact and nothing else: some wall, too little to say what stands there (N8-03A: with none
    // at all the contact is open, `open-contact-n8-03a.test.ts`)
    const r = read([house, garage], plan([...ring({ x0: 0, z0: 0, x1: 8, z1: 10 }, T, { east: true }), ...ring({ x0: 8, z0: 1, x1: 12, z1: 9 }, T, { west: true }), { x0: 7.6, z0: 4, x1: 8, z1: 5.2 }]))[0]
    expect(r.decision).toBe('UNDECIDED')
    expect(r.why).toMatch(/too little/)
  })

  it('a garage storey only: the house storey above shares nothing (the storey is not in the garage)', () => {
    const records = readPartyWalls({ masses: [house, garage], plans: new Map([[0, { raster: shared(), frame }], [1, { raster: shared(), frame: { ...frame, storeyIndex: 1 } }]]), wallOf: () => T })
    expect(records.map((r) => r.storeyIndex)).toEqual([0])
  })

  it('a garage running past the house (shared on part of its length) keeps its own wall there; too short a piece is refused', () => {
    const long = mass('attached-0', 'ATTACHED', 8, 1, 12, 12)
    const draw = (z1: number) => plan([...ring({ x0: 0, z0: 0, x1: 8, z1: 10 }, T, { east: true }), { x0: 7.6, z0: 0, x1: 8, z1: 1 }, { x0: 7.6, z0: 0, x1: 7.85, z1: 10 }, ...ring({ x0: 7.85, z0: 1, x1: 12, z1 }, T, { west: true }), { x0: 8, z0: 10, x1: 8.4, z1 }])
    const r = read([house, long], draw(12))[0]
    expect(r.decision).toBe('ONE_WALL')
    expect(r.wall?.span).toEqual([1, 10])
    expect(r.wall?.ends).toEqual(['OTHER_CORNER', 'HOST_CORNER'])
    const segs = sideSegments(r.wall ? [r.wall] : [], long, 0, () => T)
    expect(segs?.WEST.map((s) => [s.kind, s.from, s.to])).toEqual([['NONE', 1, 10], ['OWN', 10, 12]])
    const short = mass('attached-0', 'ATTACHED', 8, 1, 12, 10.3)
    const refused = read([house, short], draw(10.3))[0]
    expect(refused.decision).toBe('UNDECIDED')
    expect(refused.why).toMatch(/too short for a wall of its own/)
  })

  it('a body already built without its shared wall (N7-P2R) is left as it is', () => {
    expect(read([house, { ...garage, openSide: 'WEST' }], shared())).toEqual([])
  })
})

describe('N8-02B: the sides of the two bodies', () => {
  const wall = read([house, garage], shared())[0].wall as PartyWallV2
  it('the house: own wall, the one wall, own wall; the garage: no wall over the shared span, its own elsewhere', () => {
    const h = sideSegments([wall], house, 0, () => T)
    // the house's own wall runs on over the ends of the garage's walls across (0.40 m), the one wall between them
    expect(h?.EAST.map((s) => [s.kind, s.from, s.to])).toEqual([['OWN', 0, 1.4], ['PARTY', 1.4, 8.6], ['OWN', 8.6, 10]])
    expect(h?.WEST.map((s) => s.kind)).toEqual(['OWN'])
    const g = sideSegments([wall], garage, 0, () => T)
    expect(g?.WEST.map((s) => [s.kind, s.from, s.to])).toEqual([['NONE', 1, 9]])
    expect(g?.EAST.map((s) => s.kind)).toEqual(['OWN'])
    // a storey the body shares nothing on is built as before
    expect(sideSegments([wall], house, 1, () => T)).toBeUndefined()
  })
})

const building = (masses: MassV2[], partyWalls: PartyWallV2[], extra: Partial<BuildingV2> = {}): BuildingV2 => ({
  label: 'n8-02b',
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
  ...(partyWalls.length > 0 ? { partyWalls } : {}),
  ...extra,
})

function hits(t: Triangle, p: Vec3, q: Vec3): boolean {
  const d = { x: q.x - p.x, y: q.y - p.y, z: q.z - p.z }
  const e1 = { x: t.b.x - t.a.x, y: t.b.y - t.a.y, z: t.b.z - t.a.z }
  const e2 = { x: t.c.x - t.a.x, y: t.c.y - t.a.y, z: t.c.z - t.a.z }
  const h = { x: d.y * e2.z - d.z * e2.y, y: d.z * e2.x - d.x * e2.z, z: d.x * e2.y - d.y * e2.x }
  const a = e1.x * h.x + e1.y * h.y + e1.z * h.z
  if (Math.abs(a) < 1e-12) return false
  const f = 1 / a
  const s = { x: p.x - t.a.x, y: p.y - t.a.y, z: p.z - t.a.z }
  const u = f * (s.x * h.x + s.y * h.y + s.z * h.z)
  if (u < 0 || u > 1) return false
  const qq = { x: s.y * e1.z - s.z * e1.y, y: s.z * e1.x - s.x * e1.z, z: s.x * e1.y - s.y * e1.x }
  const v = f * (d.x * qq.x + d.y * qq.y + d.z * qq.z)
  if (v < 0 || u + v > 1) return false
  const tt = f * (e2.x * qq.x + e2.y * qq.y + e2.z * qq.z)
  return tt >= 0 && tt <= 1
}

describe('N8-02B: the one wall built, its doorway cut, nothing overlapping', () => {
  const wall = read([house, garage], shared())[0].wall as PartyWallV2
  const door = { id: 'shared-party-0-east-0-0', storeyIndex: 0, massId: 'main', otherMassId: 'attached-0', facade: 'EAST' as const, interval: [3, 3.9] as [number, number], widthM: 0.9, sillY: 0, headY: 2.1, family: 'DOOR' as const }
  const b = building([house, garage], [wall], { sharedDoors: [{ ...door, why: 'test', provenance: { head: 'ASSUMED_FOR_RENDERING' } } as unknown as BuildingV2['sharedDoors'][number]] })
  const program = emitBuilding(b, 'n8-02b').program
  const applied = applyCommands(createEmptyModel('m', 'n8-02b'), program)

  it('every command applies and the model validates: no WALLS_OVERLAP, no ring collision', () => {
    expect(applied.failedAt === undefined ? [] : applied.results[applied.failedAt]).toEqual([])
    const v = validateModel(applied.model)
    expect(v.issues.filter((i) => i.severity === 'ERROR')).toEqual([])
  })

  it('one wall of the drawn thickness between the bodies, on the band; the garage builds no wall of its own there', () => {
    const m = applied.model
    const party = m.walls.find((w) => w.id === wall.id)
    expect(party?.thickness).toBeCloseTo(wall.thicknessM, 6)
    expect(party?.start.x).toBeCloseTo(wall.band[1], 6)
    expect(m.walls.some((w) => w.id === 'ring-attached-0-0-w3')).toBe(false)
    // the house keeps its own wall where the garage does not stand against it
    expect(m.walls.find((w) => w.id === 'ring-main-0-w1-0')?.thickness).toBe(T)
    // the garage's walls across stay on its outline, under the end of the house's own wall; on the storey above the
    // house is whole again (a ring)
    expect(m.walls.find((w) => w.id === 'ring-attached-0-0-w0')?.start.x).toBe(8)
    expect(m.walls.find((w) => w.id === 'ring-main-0-w1-0')?.end.z).toBeCloseTo(1.4, 6)
    expect(m.wallRings.map((r) => r.id)).toEqual(['ring-main-1'])
    // between the faces at the contact nothing is built twice: across x 7.6..8.4 at z 5 only the one wall stands
    const across = m.walls.filter((w) => w.levelId === 'lvl-0' && Math.min(w.start.z, w.end.z) <= 5 && Math.max(w.start.z, w.end.z) >= 5 && Math.abs(w.start.x - w.end.x) < 1e-9 && w.start.x > 7 && w.start.x < 9)
    expect(across.map((w) => w.id)).toEqual([wall.id])
  })

  it('the doorway is cut in the one wall alone, and the compiled wall really has the hole', () => {
    const m = applied.model
    const o = m.openings.find((x) => x.id === door.id)
    expect(o?.wallId).toBe(wall.id)
    const scene = compileBuilding(m)
    expect(scene.diagnostics.filter((d) => d.severity === 'ERROR')).toEqual([])
    const tris = scene.meshes.filter((x) => x.solidId === wall.id).flatMap((x) => x.triangles)
    const through = (z: number) => tris.some((t) => hits(t, { x: wall.band[0] - 0.05, y: 1, z }, { x: wall.band[1] + 0.05, y: 1, z }))
    expect(through(3.45)).toBe(false)
    expect(through(6)).toBe(true)
  })
})

describe('N8-02B: a door at the end of a partition, only where its swing is drawn', () => {
  // a body 6 × 6 m: a partition along z at x 3 from the front wall to z 2.5, and a free piece along x at z 3.4 from
  // x 2.9 to x 4.4 — the gap between them on the first one's line is 0.85 m
  const body = { x0: 0, z0: 0, x1: 6, z1: 6 }
  const boxes = [...ring(body, T), { x0: 2.94, z0: 0, x1: 3.06, z1: 2.5 }, { x0: 2.9, z0: 3.35, x1: 4.4, z1: 3.45 }]
  const arc = { cx: 3, cz: 2.5, r: 0.85, from: 95, to: 175 }
  it('with the swing: the door is cut in the line and the free piece is kept as its far jamb', () => {
    const r = readInterior(plan(boxes, [arc]), frame, body, T, 0)
    const free = r.walls.find((w) => w.axis === 'X' && Math.abs(w.at - 3.4) < 0.05)
    expect(free).toBeDefined()
    const d = r.doors.find((x) => x.wallAxis === 'Z' && Math.abs(x.at - 3) < 0.05)
    expect(d?.widthM).toBeGreaterThan(0.75)
    expect(d?.widthM).toBeLessThan(0.95)
    expect(d?.betweenIds[1]).toBe(`${free?.id}:jamb`)
  })
  it('without it: the piece is furniture or a line, dropped as before, and no door is invented', () => {
    const r = readInterior(plan(boxes), frame, body, T, 0)
    expect(r.walls.some((w) => w.axis === 'X' && Math.abs(w.at - 3.4) < 0.05)).toBe(false)
    expect(r.doors.some((x) => x.wallAxis === 'Z' && Math.abs(x.at - 3) < 0.05)).toBe(false)
  })
  it('the swing test reads an arc of the gap radius and nothing else', () => {
    expect(swingDrawn(plan([], [arc]), frame, 'Z', 3, [2.5, 3.35])).toBe(true)
    expect(swingDrawn(plan([]), frame, 'Z', 3, [2.5, 3.35])).toBe(false)
    expect(swingDrawn(plan([], [{ ...arc, r: 0.4 }]), frame, 'Z', 3, [2.5, 3.35])).toBe(false)
  })
})
