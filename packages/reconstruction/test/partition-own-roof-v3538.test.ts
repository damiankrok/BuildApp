/**
 * v3.53.8 — a partition that runs from the main body into an attached body under a roof of its own.
 *
 * The found cause, on three public plans: a technical split of one storey into a main body and an attached body joined
 * by an open contact lets one partition run on through both; emitted as one wall it took the main roof's height and
 * profile, so the stretch over the attached body stood above that body's lower roof (WALL_NOT_UNDER_ROOF, and a spike in
 * the scene). The run is now cut at the attached body's face: under a flat slab the stretch rises to the slab's soffit and
 * follows no roof; under the body's own pitched roof it dies into that roof's planes. A door keeps its place and width.
 *
 * The house is the described-house fixture (a single-storey gable body and a garage), with invented dimensions.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { checkHouseDescription } from '@buildapp/source-vision'
import { applyCommands } from '@buildapp/commands'
import { createEmptyModel, validateModel } from '@buildapp/model'
import { compileBuilding } from '@buildapp/geometry'
import { buildingFromHouseDescription, emitBuilding } from '../src/index.js'
import type { BuildingV2, InteriorReading, InteriorWallPiece, PartyWallV2 } from '../src/index.js'

/** The fixture house: main 0..10.5 × 0..9 under a gable, the garage 10.5..15.5 × 1..7 beside it, one storey of 3 m. */
function house(roof: 'FLAT' | 'CROSS_GABLE'): BuildingV2 {
  const raw = JSON.parse(readFileSync(new URL('./fixtures/described-house-a.json', import.meta.url), 'utf8'))
  raw.bodies[0] = { ...raw.bodies[0], habitableAttic: false, eavesHeightM: 3.0, z0: 0, z1: 9 }
  raw.bodies[1] = { ...raw.bodies[1], z0: 1, z1: 7 }
  if (roof === 'CROSS_GABLE') {
    raw.bodies[0].roof = { ...raw.bodies[0].roof, ridge: 'ALONG_Z' }
    raw.bodies[1] = { ...raw.bodies[1], eavesHeightM: 2.6, roof: { ...raw.bodies[1].roof, kind: 'GABLE', ridge: 'ALONG_X', pitchDeg: 30, pitchBasis: 'PUBLISHED_ON_PAGE' } }
  }
  const checked = checkHouseDescription(raw)
  if (!checked.ok) throw new Error(JSON.stringify(checked.issues))
  return buildingFromHouseDescription(checked.description).building
}

const piece = (id: string, from: number, to: number, at = 4): InteriorWallPiece => ({ id, storeyIndex: 0, axis: 'X', at, from, to, thicknessM: 0.12, ends: { start: 'JUNCTION', end: 'JUNCTION' }, pixelRect: { x0: 0, y0: 0, x1: 1, y1: 1 }, confidence: 0.9, why: 'test' })
/** One partition at z = 4 from the main body's west wall to the garage's east wall, a 0.9 m door at x 10.55..11.45. */
const crossing: InteriorReading = {
  storeyIndex: 0,
  frameId: 'plan-0',
  walls: [piece('p-a', 0.25, 10.55), piece('p-b', 11.45, 15.25)],
  doors: [{ id: 'door-a', storeyIndex: 0, wallAxis: 'X', at: 4, from: 10.55, to: 11.45, widthM: 0.9, betweenIds: ['p-a', 'p-b'], confidence: 0.9, why: 'test' }],
  blocks: [],
  rooms: [],
  unresolved: [],
}
/** The contact the plan draws no wall on: the storey's split into two bodies is technical. */
const open: PartyWallV2 = { id: 'open-main-0-body-garage', storeyIndex: 0, hostMassId: 'main', otherMassId: 'body-garage', hostFacade: 'EAST', contactAt: 10.5, band: [10.5, 10.5], thicknessM: 0, span: [1, 7], ends: ['BOTH_CORNERS', 'BOTH_CORNERS'], open: true, provenance: 'SOURCE_DERIVED', why: 'test: no wall drawn' }

function build(b: BuildingV2, interior: InteriorReading) {
  const applied = applyCommands(createEmptyModel('m', 'v3538'), emitBuilding({ ...b, interior: [interior], partyWalls: [open] }, 'v3538').program)
  if (applied.failedAt !== undefined) throw new Error(JSON.stringify(applied.results[applied.failedAt]))
  const model = applied.model
  return { model, partitions: model.walls.filter((w) => w.kind === 'INTERIOR'), warnings: compileBuilding(model).diagnostics.filter((d) => d.code === 'WALL_NOT_UNDER_ROOF').map((d) => d.objectId) }
}

describe('v3.53.8: a partition under two roofs', () => {
  it('under a flat slab: the stretch in the garage rises to the slab soffit and follows no roof, and nothing stands above a roof', () => {
    const b = house('FLAT')
    const soffit = b.attachedRoofs.find((r) => r.massId === 'body-garage')?.slabSoffitY
    expect(soffit).toBeDefined()
    const { model, partitions, warnings } = build(b, crossing)
    expect(warnings).toEqual([])
    expect(validateModel(model).issues.filter((i) => i.severity === 'ERROR')).toEqual([])
    const main = partitions.find((w) => w.id === 'p-a')
    const garage = partitions.find((w) => w.id === 'p-a-under-body-garage')
    // cut at the garage's face, one wall either side, the run's id kept by the stretch outside every own-roof body
    expect([main?.start.x, main?.end.x, garage?.start.x, garage?.end.x]).toEqual([0.315, 10.5, 10.5, 15.185])
    expect(main?.topProfile?.kind).toBe('FOLLOW_ROOF_PLANES')
    expect(garage?.height).toBe(soffit)
    expect(garage?.topProfile).toBeUndefined()
  })

  it('under the body’s own pitched roof: the stretch dies into that roof’s planes, not the main roof’s', () => {
    const b = house('CROSS_GABLE')
    expect(b.pitchedAttachedRoofs.map((r) => r.massId)).toEqual(['body-garage'])
    const { partitions, warnings } = build(b, crossing)
    expect(warnings).toEqual([])
    const garage = partitions.find((w) => w.id === 'p-a-under-body-garage')
    expect(garage?.topProfile).toEqual({ kind: 'FOLLOW_ROOF_PLANES', planeIds: ['roof-body-garage-plane-low', 'roof-body-garage-plane-high'] })
    expect(partitions.find((w) => w.id === 'p-a')?.topProfile).toEqual({ kind: 'FOLLOW_ROOF_PLANES', planeIds: ['roof-main-plane-low', 'roof-main-plane-high'] })
  })

  it('the door keeps its place and its width: it moves with the stretch that holds it', () => {
    for (const roof of ['FLAT', 'CROSS_GABLE'] as const) {
      const { model } = build(house(roof), crossing)
      const door = model.openings.find((o) => o.id === 'door-a')
      const host = model.walls.find((w) => w.id === door?.wallId)
      expect(host?.id).toBe('p-a-under-body-garage')
      expect(Number(((host?.start.x ?? 0) + (door?.offset ?? 0)).toFixed(6))).toBe(10.55)
      expect(door?.width).toBe(0.9)
    }
  })

  it('counter-case: a partition wholly inside the main body is emitted as before, one wall under the main roof', () => {
    const inside: InteriorReading = { ...crossing, walls: [piece('p-c', 0.25, 10.25, 8)], doors: [] }
    const { partitions, warnings } = build(house('FLAT'), inside)
    expect(warnings).toEqual([])
    expect(partitions.map((w) => w.id)).toEqual(['p-c'])
    expect(partitions[0].height).toBe(3)
    expect(partitions[0].topProfile?.kind).toBe('FOLLOW_ROOF_PLANES')
  })

  it('counter-case: the warning itself stands — a body with no roof of its own is not cut, and a wall above every roof is still named', () => {
    const b = house('FLAT')
    const { warnings } = build({ ...b, attachedRoofs: [] }, crossing)
    expect(warnings).toEqual(['p-a'])
  })
})
