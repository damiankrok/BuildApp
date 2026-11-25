/**
 * v3.54.21 (NEW-H Lyon) — the main body is never left open.
 *
 * A house whose main roof is flat behind an attic came out of LOCAL as an open box: no roof was emitted over the main
 * body (the main-roof path builds only a pitched roof; the flat plate existed for attached bodies only), so the scene
 * showed its partitions from above. The main body now carries the attached bodies' own flat plate when no pitched roof
 * is inferred over it. These tests hold the emitted model: a FLAT roof over the main body's rectangle, at the slab the
 * plate states, the top storey's walls capped by it and rising to the parapet where one is read, every command applying
 * and the model validating.
 */
import { describe, expect, it } from 'vitest'
import { applyCommands } from '@buildapp/commands'
import { createEmptyModel, validateModel } from '@buildapp/model'
import { readSpecifications, findingOf } from '@buildapp/source-metrics'
import { emitBuilding } from '../src/index.js'
import type { AttachedRoofV2, BuildingV2, MassV2 } from '../src/index.js'

const T = 0.4
const mass = (id: string, role: 'MAIN' | 'ATTACHED', x0: number, z0: number, x1: number, z1: number, storeys = [0]): MassV2 => ({ id, role, x0, z0, x1, z1, storeys, featureId: `f-${id}`, sourceMassId: `src-${id}` })
const building = (masses: MassV2[], attachedRoofs: AttachedRoofV2[]): BuildingV2 => ({
  label: 'main-flat',
  wallThicknessM: T,
  slabThicknessM: 0.25,
  levels: [0, 1].map((i) => ({ index: i, id: `lvl-${i}`, elevation: i * 3.02, height: 2.8, wallTop: i * 3.02 + 2.8, featureId: `f-lvl-${i}` })),
  masses,
  attachedRoofs,
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
})

const main = mass('main', 'MAIN', 0, 0, 9.05, 8.85, [0, 1])
const plate = (over: Partial<AttachedRoofV2> = {}): AttachedRoofV2 => ({ massId: 'main', slabTopY: 5.82, slabSoffitY: 5.57, footprint: { x0: 0, x1: 9.05, z0: 0, z1: 8.85 }, projectsOverZone: false, featureId: 'f-roof-main', provenance: 'ASSUMED_FOR_RENDERING', ...over })

describe('v3.54.21: a main body without a pitched roof is closed by a flat plate', () => {
  it('the plate is a FLAT roof over the main body, every command applies and the model validates', () => {
    const applied = applyCommands(createEmptyModel('m', 'main-flat'), emitBuilding(building([main], [plate()]), 'main-flat').program)
    expect(applied.failedAt === undefined ? [] : applied.results[applied.failedAt]).toEqual([])
    expect(validateModel(applied.model).issues.filter((i) => i.severity === 'ERROR')).toEqual([])
    const roofs = applied.model.roofs.filter((r) => r.id === 'roof-main')
    expect(roofs.map((r) => r.kind)).toEqual(['FLAT'])
    expect(roofs[0].footprint).toMatchObject({ minX: 0, maxX: 9.05, minZ: 0, maxZ: 8.85 })
  })

  it('without the plate the same body has no roof at all (the open box the plate closes)', () => {
    const applied = applyCommands(createEmptyModel('m', 'main-open'), emitBuilding(building([main], []), 'main-open').program)
    expect(applied.model.roofs).toEqual([])
  })

  it('a parapet read on the section raises the top storey walls to it', () => {
    const applied = applyCommands(createEmptyModel('m', 'main-parapet'), emitBuilding(building([main], [plate({ parapetTopY: 6.56, provenance: 'SOURCE_EXACT' })]), 'main-parapet').program)
    expect(applied.failedAt === undefined ? [] : applied.results[applied.failedAt]).toEqual([])
    const top = applied.model.walls.filter((w) => w.kind === 'EXTERIOR' && w.levelId === 'lvl-1')
    expect(top.length).toBeGreaterThan(0)
    for (const w of top) expect(w.height).toBeCloseTo(6.56 - 3.02, 6)
  })
})

describe('v3.54.21: the specification reader reads a flat roof where the page says it', () => {
  it('a printed roof angle below 3° is a flat roof\'s fall: ROOF_KIND FLAT, no pitch', () => {
    const r = readSpecifications([{ key: 'roof', label: 'Kąt nachylenia dachu', text: '1.15°' }], 'page')
    expect(findingOf(r.findings, 'ROOF_KIND')?.value).toBe('FLAT')
    expect(r.evidence.filter((e) => e.kind === 'ANGLE')).toEqual([])
  })

  it('on the roof\'s own line an inflected adjective is still the word: "płaskim dachem", "dach płaski"', () => {
    expect(findingOf(readSpecifications([{ key: 'roof', label: 'Dach', text: 'stropodach, z płaskim dachem nad całością' }], 'page').findings, 'ROOF_KIND')?.value).toBe('FLAT')
    expect(findingOf(readSpecifications([{ key: 'roof_type', label: 'Rodzaj dachu', text: 'płaskim dachem' }], 'page').findings, 'ROOF_KIND')?.value).toBe('FLAT')
  })

  it('a free description lends the main roof neither its words nor its numbers (a terrace\'s flat roof, an offer\'s 35)', () => {
    const r = readSpecifications([{ key: 'description', label: 'opis', text: 'Dom z dachem dwuspadowym i tarasem pod płaskim dachem. Rabat 35 st. dla pierwszych zamówień' }], 'page')
    expect(findingOf(r.findings, 'ROOF_KIND')).toBeUndefined()
    expect(r.evidence.filter((e) => e.kind === 'ANGLE')).toEqual([])
  })

  it('a pitched roof reads as before', () => {
    const r = readSpecifications([{ key: 'roof', label: 'Kąt nachylenia dachu', text: '40°' }], 'page')
    expect(r.evidence.find((e) => e.kind === 'ANGLE')?.value).toBe(40)
    expect(findingOf(r.findings, 'ROOF_KIND')).toBeUndefined()
  })
})
