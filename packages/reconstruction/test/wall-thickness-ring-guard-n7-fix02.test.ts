/**
 * N7-COUNCIL-FIX-02: the exterior wall is read off the outer faces (Council B-1), a body is gated and built with the
 * same thickness (B-2), the wall reconciliation never narrows a ring below its own two walls (D-1), and every rectangle
 * the emitter builds is checked before it is built (D-2/C-4/B-3). Invented bodies and bands; a reconstruction of
 * nothing.
 */
import { describe, expect, it } from 'vitest'
import type { Band } from '@buildapp/source-cv'
import { applyCommands } from '@buildapp/commands'
import { createEmptyModel } from '@buildapp/model'
import { bodyWallThickness, emitBuilding, exteriorFaceThickness, fitPreviewProgram, houseWallThickness, minBodySpanM, preEmitRingChecks, ringCollisions } from '../src/index.js'
import type { BuildingV2, MassV2 } from '../src/index.js'

const T = 0.3
const building = (masses: MassV2[], levels = 1, extra: Partial<BuildingV2> = {}): BuildingV2 => ({
  label: 'fix02',
  wallThicknessM: T,
  slabThicknessM: 0.25,
  levels: Array.from({ length: levels }, (_, i) => ({ index: i, id: `lvl-${i}`, elevation: i * 2.9, height: 2.9, wallTop: i * 2.9 + 2.65, featureId: `f-lvl-${i}` })),
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
const mass = (id: string, role: 'MAIN' | 'ATTACHED', x0: number, z0: number, x1: number, z1: number, storeys = [0], more: Partial<MassV2> = {}): MassV2 => ({ id, role, x0, z0, x1, z1, storeys, featureId: `f-${id}`, sourceMassId: `src-${id}`, ...more })
const fit = (b: BuildingV2) => fitPreviewProgram(emitBuilding(b, 'fix02').program, { label: 'fix02', modelId: 'm', mainMassId: 'main', toleranceM: 0.06 })
const builtRings = (f: ReturnType<typeof fit>) => {
  if (!f.fit.ok) return []
  const applied = applyCommands(createEmptyModel('m', 'fix02'), f.fit.program)
  return applied.model.wallRings.map((r) => r.id)
}

describe('N7-COUNCIL-FIX-02 (D-1): the reconciliation never narrows a ring below its own walls', () => {
  // the Council's case: a body 5 cm into the main body's east wall, moved onto its face
  const d1 = (w: number, t = T) => building([mass('main', 'MAIN', 0, 0, 10, 8), mass('attached-0', 'ATTACHED', 3, 8, 7, 11), mass('attached-1', 'ATTACHED', 9.95, 1, 9.95 + w, 7, [0], t !== T ? { wallThicknessM: t } : {})])

  it('0.62 m, moved 0.05 m, would be 0.57 m < 2 × 0.30: refused with the numbers; the sound part of the house is built', () => {
    const f = fit(d1(0.62))
    const refused = f.reconciliationHistory.find((h) => h.record.action === 'REFUSED')
    expect(refused?.record).toMatchObject({ wallId: 'ring-attached-1-0-w3', otherWallId: 'ring-main-0-w1', narrowing: { beforeM: 0.62, afterM: 0.57, minM: 0.6 } })
    expect(f.reconciliationHistory.some((h) => h.record.action === 'EDGE_MOVED')).toBe(false)
    // no refusal of the ring for its OWN walls any more: the geometry the validator saw is the geometry the plan drew
    expect(f.failures.map((x) => x.message)).not.toContainEqual(expect.stringMatching(/ring-attached-1-0-w1 and ring-attached-1-0-w3/))
    expect(builtRings(f)).toEqual(['ring-main-0', 'ring-attached-0-0'])
    const [c] = ringCollisions({ failures: f.failures, skipped: f.skipped, history: f.reconciliationHistory, masses: d1(0.62).masses, thin: [], houseWallThicknessM: T })
    expect(c).toMatchObject({ kind: 'BETWEEN_BODIES', ringId: 'ring-attached-1-0', narrowing: { afterM: 0.57, minM: 0.6 } })
  })

  it('0.70 m, moved 0.05 m, is 0.65 m ≥ 0.60: moved as before, and built', () => {
    const f = fit(d1(0.7))
    expect(f.failures).toEqual([])
    expect(f.reconciliationHistory.map((h) => h.record.action)).toEqual(['EDGE_MOVED'])
    expect(builtRings(f)).toContain('ring-attached-1-0')
  })

  it('a body with its own thinner walls is measured with them: 0.62 m at 0.25 m walls may be moved to 0.57 m', () => {
    const f = fit(d1(0.62, 0.25))
    expect(f.failures).toEqual([])
    expect(f.reconciliationHistory.map((h) => h.record.action)).toEqual(['EDGE_MOVED'])
    expect(builtRings(f)).toContain('ring-attached-1-0')
  })

  it('a thicker body is protected by its own walls: 0.92 m at 0.45 m walls is not moved to 0.87 m', () => {
    const f = fit(d1(0.92, 0.45))
    expect(f.reconciliationHistory.find((h) => h.record.action === 'REFUSED')?.record.narrowing).toEqual({ beforeM: 0.92, afterM: 0.87, minM: 0.9 })
  })
})

describe('N7-COUNCIL-FIX-02 (D-2/C-4/B-3): every rectangle the emitter builds is checked before it is built', () => {
  it('a storey rectangle narrower than its walls: named before emission, and the body keeps its sound storey below', () => {
    const att = mass('attached-0', 'ATTACHED', 8, 0, 12, 6, [0, 1], { storeyRects: [{ storey: 1, x0: 8, z0: 0, x1: 8.45, z1: 6 }] })
    const b = building([mass('main', 'MAIN', 0, 0, 8, 6, [0, 1]), att], 2)
    const checks = preEmitRingChecks(b.masses, T, [])
    expect(checks.filter((c) => c.verdict !== 'HOLDS_TWO_WALLS')).toEqual([expect.objectContaining({ massId: 'attached-0', storeyIndex: 1, kind: 'STOREY_RECT', widthM: 0.45, verdict: 'INSUFFICIENT_EVIDENCE', ringWouldOverlap: true })])
    const f = fit(b)
    expect(f.failures.map((x) => x.id)).toEqual(['ring-attached-0-1'])
    // FIX-01 and before: the storey-0 ring and slab of the same body went with it (SAME_BODY)
    expect(f.skipped.filter((s) => s.cause === 'SAME_BODY').map((s) => s.id)).not.toContain('ring-attached-0-0')
    expect(builtRings(f).sort()).toEqual(['ring-attached-0-0', 'ring-main-0', 'ring-main-1'])
  })

  it('a piece narrower than its walls and a narrow main body are named; wide bodies hold', () => {
    const piece = mass('main-s1-1', 'ATTACHED', 2, 2, 2.4, 6, [1], { pieceOf: 'main' })
    const narrowMain = mass('main', 'MAIN', 0, 0, 0.5, 6, [0])
    expect(preEmitRingChecks([mass('main', 'MAIN', 0, 0, 8, 6, [0, 1]), piece], T, []).filter((c) => c.verdict !== 'HOLDS_TWO_WALLS').map((c) => [c.kind, c.verdict])).toEqual([['PIECE', 'INSUFFICIENT_EVIDENCE']])
    expect(preEmitRingChecks([narrowMain], T, []).map((c) => [c.kind, c.verdict])).toEqual([['MAIN', 'INSUFFICIENT_EVIDENCE']])
    expect(preEmitRingChecks([mass('main', 'MAIN', 0, 0, 8, 6), mass('attached-0', 'ATTACHED', 8, 0, 9.2, 6, [0], { wallThicknessM: 0.25 })], 0.45, []).map((c) => c.verdict)).toEqual(['HOLDS_TWO_WALLS', 'HOLDS_TWO_WALLS'])
  })

  it('a body built without its wall on the shared side holds when one wall fits', () => {
    const c = preEmitRingChecks([mass('attached-0', 'ATTACHED', 8, 0, 8.45, 6, [0], { openSide: 'WEST' })], T, [])
    expect(c.map((x) => [x.verdict, x.ringWouldOverlap])).toEqual([['SHARED_WALL', false]])
  })
})

describe('N7-COUNCIL-FIX-02: bodies with different exterior walls', () => {
  it('a garage drawn with 0.25 m walls beside a 0.45 m house: built at 0.25 m, no WALLS_OVERLAP, COMPLETE', () => {
    const b = building([mass('main', 'MAIN', 0, 0, 8, 6), mass('attached-0', 'ATTACHED', 8, 1, 9.0, 5, [0], { wallThicknessM: 0.25 })], 1, { wallThicknessM: 0.45 })
    const f = fit(b)
    expect(f.failures).toEqual([])
    expect(f.fit.ok).toBe(true)
    const ring = emitBuilding(b, 'fix02').program.find((c) => c.type === 'createWallRing' && c.id === 'ring-attached-0-0') as { thickness: number }
    expect(ring.thickness).toBe(0.25)
    // at the house's 0.45 m the same 1.0 m body could not stand: two walls are 0.90 m and the gate wants 1.10 m
    expect(minBodySpanM(0.45)).toBeCloseTo(1.1, 6)
    expect(minBodySpanM(0.25)).toBe(1)
  })
})

// --- the outer faces, read off bands ----------------------------------------------------------------------------------
const band = (axis: 'VERTICAL' | 'HORIZONTAL', a0: number, a1: number, r0: number, r1: number): Band =>
  ({ axis, bounds: axis === 'VERTICAL' ? { x0: a0, x1: a1, y0: r0, y1: r1 } : { x0: r0, x1: r1, y0: a0, y1: a1 }, thickness: a1 - a0, length: r1 - r0, fill: 1, axisPx: (a0 + a1) / 2, pieces: 1 }) as unknown as Band

describe('N7-COUNCIL-FIX-02 (B-1): the exterior wall from the outer faces, not from the median of every band', () => {
  // 100 px = 1 m; a 10 × 8 m house with 0.43 m outer walls and many 0.20 m partitions (more partition than facade)
  const mpp = 0.01
  const outer = [band('VERTICAL', 0, 43, 0, 800), band('VERTICAL', 957, 1000, 0, 800), band('HORIZONTAL', 0, 43, 0, 1000), band('HORIZONTAL', 757, 800, 0, 1000)]
  const partitions = [200, 350, 500, 650, 800].map((x) => band('VERTICAL', x, x + 20, 43, 757)).concat([250, 400, 550].map((y) => band('HORIZONTAL', y, y + 20, 43, 957)))
  const house = { x0: 0, y0: 0, x1: 1000, y1: 800 }

  it('reads 0.43 m off the four faces where the all-band median says 0.20 m', () => {
    const r = houseWallThickness([...outer, ...partitions], house, mpp, mpp, 20, 0.2, 0.38)
    expect(r.source).toBe('EXTERIOR_FACE_BANDS')
    expect(r.m).toBeCloseTo(0.43, 6)
    expect(r.faces.map((f) => f.side).sort()).toEqual(['E', 'N', 'S', 'W'])
  })

  it('a plan whose faces carry too little band falls back to the all-band median, said to be an estimate', () => {
    const r = houseWallThickness([band('VERTICAL', 0, 43, 0, 50), ...partitions], house, mpp, mpp, 20, 0.2, 0.38)
    expect(r).toMatchObject({ source: 'ALL_BANDS_ESTIMATE', m: 0.2 })
    expect(r.why).toMatch(/^ESTIMATE/)
    expect(houseWallThickness([], house, mpp, mpp, 20, 0.05, 0.38)).toMatchObject({ source: 'CONVENTION', m: 0.38 })
  })

  it('a garage whose own faces are drawn 0.25 m gets its own wall; its face against the house does not vote', () => {
    const garage = { x0: 1000, y0: 100, x1: 1400, y1: 700 }
    const garageBands = [band('VERTICAL', 1375, 1400, 100, 700), band('HORIZONTAL', 100, 125, 1000, 1400), band('HORIZONTAL', 675, 700, 1000, 1400)]
    const houseReading = houseWallThickness([...outer, ...partitions], house, mpp, mpp, 20, 0.2, 0.38)
    const own = bodyWallThickness([...outer, ...partitions, ...garageBands], garage, [house], mpp, mpp, 20, houseReading)
    expect(own?.m).toBeCloseTo(0.25, 6)
    expect(own?.faces.map((f) => f.side).sort()).toEqual(['E', 'N', 'S'])
    // a body drawn as the house is carries no reading of its own
    expect(bodyWallThickness([...outer], house, [], mpp, mpp, 20, houseReading)).toBeUndefined()
    expect(exteriorFaceThickness([], garage, [house], mpp, mpp, 20)).toBeNull()
  })
})
