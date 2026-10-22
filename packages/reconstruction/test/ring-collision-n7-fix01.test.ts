/**
 * N7-FIX-01: a frame sits in the wall that hosts it (Council D-3), and a ring refused for its own walls carries the way
 * back to the reading that made it — including a reconciliation that changed the ring before it was refused (Council
 * D-1, kept now rather than dropped with the first attempt). Invented bodies; a reconstruction of nothing.
 */
import { describe, expect, it } from 'vitest'
import { emitBuilding, fitPreviewProgram, ringCollisions } from '../src/index.js'
import type { BuildingV2, MassV2, OpeningV2 } from '../src/index.js'

const T = 0.3
const building = (masses: MassV2[], extra: Partial<BuildingV2> = {}): BuildingV2 => ({
  label: 'fix01',
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
  interior: [],
  assemblies: [],
  surfaceRegions: [],
  ...extra,
})
const mass = (id: string, role: 'MAIN' | 'ATTACHED', x0: number, z0: number, x1: number, z1: number, more: Partial<MassV2> = {}): MassV2 => ({ id, role, x0, z0, x1, z1, storeys: [0], featureId: `f-${id}`, sourceMassId: `src-${id}`, ...more })
const opening = (id: string, massId: string, family: 'WINDOW' | 'DOOR', interval: [number, number], sillY: number, headY: number): OpeningV2 => ({
  id,
  storeyIndex: 0,
  massId,
  facade: 'EAST',
  planeAt: 0,
  interval,
  widthM: interval[1] - interval[0],
  sillY,
  headY,
  profile: 'RECTANGULAR',
  family,
  mullions: [],
  planGap: { frameId: 'plan-0', pixelRect: { x0: 0, y0: 0, x1: 1, y1: 1 } },
  provenance: { interval: 'SOURCE_DERIVED', width: 'SOURCE_DERIVED', sill: 'ASSUMED_FOR_RENDERING', head: 'ASSUMED_FOR_RENDERING', profile: 'ASSUMED_FOR_RENDERING', family: 'SOURCE_DERIVED' },
  uncertaintyM: 0.05,
  unresolved: [],
  confidence: 0.8,
  why: 'test',
})

describe('N7-FIX-01 (D-3) a frame in a body built with walls thinner than the house’s', () => {
  // a 0.50 m body with 0.12 m walls of its own (DRAWN_THIN_WALLS), a window and a door in its far wall
  const thin = building([mass('main', 'MAIN', 0, 0, 8, 10), mass('store', 'ATTACHED', 8, 2, 8.5, 8, { wallThicknessM: 0.12 })], {
    openings: [opening('o-win', 'store', 'WINDOW', [3, 4], 0.9, 2.1), opening('o-door', 'store', 'DOOR', [5, 6], 0, 2.1)],
  })
  const emitted = emitBuilding(thin, 'fix01')

  it('each frame takes the host wall’s thickness, never the house’s', () => {
    const units = emitted.program.filter((c) => c.type === 'placeWindow' || c.type === 'placeDoor') as Array<{ id: string; frameDepth?: number; frameInset?: number }>
    expect(units.map((u) => u.id).sort()).toEqual(['o-door-leaf', 'o-win-unit'])
    for (const u of units) {
      expect(u.frameDepth).toBeDefined()
      expect((u.frameDepth ?? 0) + (u.frameInset ?? 0)).toBeLessThanOrEqual(0.12 + 1e-9)
    }
  })

  it('the model takes every opening whole: no FILL_TOO_LARGE, nothing left out', () => {
    const fit = fitPreviewProgram(emitted.program, { label: 'fix01', modelId: 'm', mainMassId: 'main', toleranceM: 0.06 })
    expect(fit.failures).toEqual([])
    expect(fit.fit.ok).toBe(true)
    if (fit.fit.ok) expect(fit.fit.fits.filter((f) => f.action === 'DROPPED')).toEqual([])
  })

  it('a body at the house’s thickness emits its frames exactly as before (no frame fields where the default fits)', () => {
    const house = building([mass('main', 'MAIN', 0, 0, 8, 10), mass('garage', 'ATTACHED', 8, 2, 12, 8)], { openings: [opening('o-g', 'garage', 'WINDOW', [3, 4], 0.9, 2.1)] })
    const unit = emitBuilding(house, 'fix01').program.find((c) => c.type === 'placeWindow') as { frameDepth?: number; frameInset?: number }
    expect(unit.frameDepth).toBeUndefined()
    expect(unit.frameInset).toBeUndefined()
  })
})

describe('N7-FIX-01 a ring refused for its own walls: the way back to the reading', () => {
  it('a ring the reconciliation narrowed below two walls: its first-attempt move is kept and named', () => {
    // 0.62 m across (≥ 2T) as emitted, standing 5 cm into the main body's east wall
    const b = building([mass('main', 'MAIN', 0, 0, 10, 8), mass('attached-0', 'ATTACHED', 3, 8, 7, 11), mass('attached-1', 'ATTACHED', 9.95, 1, 10.57, 7)])
    const fit = fitPreviewProgram(emitBuilding(b, 'fix01').program, { label: 'fix01', modelId: 'm', mainMassId: 'main', toleranceM: 0.06 })
    expect(fit.failures.map((f) => `${f.type} ${f.id} ${f.codes.join(',')}`)).toEqual(['createWallRing ring-attached-1-0 WALLS_OVERLAP'])
    expect(fit.reconciliationHistory.map((h) => [h.attempt, h.record.action, h.record.wallId])).toEqual([[0, 'EDGE_MOVED', 'ring-attached-1-0-w3']])
    const [c] = ringCollisions({ failures: fit.failures, skipped: fit.skipped, history: fit.reconciliationHistory, masses: b.masses, thin: [], houseWallThicknessM: T })
    expect(c).toMatchObject({ ringId: 'ring-attached-1-0', walls: ['ring-attached-1-0-w1', 'ring-attached-1-0-w3'], massId: 'attached-1', selectedByThinBodies: false, widthM: 0.62, wallThicknessM: T, removedByPartialPreview: true })
    expect(c.notSelectedBecause).toMatch(/not narrower than two 0\.30 m walls/)
    expect(c.reconciliation.changedGeometry).toBe(true)
    expect(c.reconciliation.records[0]).toMatchObject({ attempt: 0, action: 'EDGE_MOVED', moveM: 0.05 })
    expect(c.why).toMatch(/the wall reconciliation changed the ring before it was refused/)
  })

  it('a refusal between two different bodies is not a ring refused for its own walls', () => {
    const fit = { failures: [{ commandIndex: 9, type: 'createWallRing', id: 'ring-b-0', codes: ['WALLS_OVERLAP'], message: 'walls ring-b-0-w3 and ring-a-0-w1 share 0.5 m² of plan area', objectIds: [] }] }
    const masses = [mass('a', 'MAIN', 0, 0, 5, 5), mass('b', 'ATTACHED', 4.8, 0, 9, 5)]
    expect(ringCollisions({ failures: fit.failures, skipped: [], history: [], masses, thin: [], houseWallThicknessM: T })).toEqual([])
  })
})
