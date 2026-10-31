/**
 * N9-02R: the facade-anchor reader and the one validity basis R5, `elevationRegistration` and `sourceUnchecked` share,
 * on fresh synthetic sheets whose truth is known by construction (`fixtures/facade-holdout.ts`, frozen before the reader
 * was written). No house of the corpus is named and no threshold is fitted to one.
 */
import { describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-cv'
import type { SourceCoordinateFrame, SourceObservation } from '@buildapp/source-observations'
import type { SourceViewResidual, ViewAuditRecord } from '@buildapp/reconstruction'
import { checkValidity, elevationAxes, elevationRelation, sourceUncheckedOf } from '../src/index.js'
// research only: the reader is not part of the production assessment
import { facadeAnchors } from '../src/assessment/facade-anchors.js'
import type { ViewAdjudication } from '../src/index.js'
import { HOLDOUT_SEED, holdoutCases } from './fixtures/facade-holdout.js'
import type { HoldoutCase } from './fixtures/facade-holdout.js'

const cases = holdoutCases()
const byCase = (id: string): HoldoutCase => cases.find((c) => c.truth.id === id) as HoldoutCase
const read = (c: HoldoutCase) => facadeAnchors(c.raster as unknown as Raster, c.truth.outline)

describe('N9-02R (research reader): facade anchors on the original RGB', () => {
  it('the frozen holdout: every drawn facade is read to within 3 px and every undecidable one refused', () => {
    expect(HOLDOUT_SEED).toBe(92021)
    let accepted = 0
    for (const c of cases) {
      const a = read(c)
      if (c.truth.expected === 'REFUSE') expect(a.wallEnds.state, c.truth.id).not.toBe('ACCEPTED')
      if (c.truth.expected === 'ACCEPT') {
        expect(a.wallEnds.state, c.truth.id).toBe('ACCEPTED')
        expect(Math.abs((a.wallEnds.x0 as number) - c.truth.wallX0), c.truth.id).toBeLessThanOrEqual(3)
        expect(Math.abs((a.wallEnds.x1 as number) - c.truth.wallX1), c.truth.id).toBeLessThanOrEqual(3)
        accepted += 1
      }
      if (c.truth.expected === 'EITHER' && a.wallEnds.state === 'ACCEPTED') expect(Math.abs((a.wallEnds.x1 as number) - c.truth.wallX1) + Math.abs((a.wallEnds.x0 as number) - c.truth.wallX0), c.truth.id).toBeLessThanOrEqual(6)
    }
    expect(accepted).toBe(18)
  })

  it('1. a coloured facade of two finishes is one facade: no neutral band is needed', () => {
    for (const id of ['pos-colour-0', 'pos-colour-1', 'pos-dark-0', 'pos-dark-1']) {
      const c = byCase(id)
      const a = read(c)
      expect(a.wallEnds).toMatchObject({ state: 'ACCEPTED' })
      expect(Math.abs((a.wallEnds.x0 as number) - c.truth.wallX0)).toBeLessThanOrEqual(3)
    }
  })

  it('3. a white wall on a white sky with no line drawn is UNKNOWN, never guessed', () => {
    for (const id of ['neg-white-sky-0', 'neg-white-sky-1']) {
      const a = read(byCase(id))
      expect(a.wallEnds.state).toBe('UNKNOWN')
      expect(a.wallEnds.why).toContain('not separated from the background')
      expect(a.anchors.some((x) => x.type === 'UNCERTAIN')).toBe(true)
    }
    // the same white walls drawn in lines on white paper are read: the line is source evidence
    expect(read(byCase('pos-drawn-0')).wallEnds.state).toBe('ACCEPTED')
  })

  it('4. a wall end behind a tree is OCCLUDED, and the tree is named, not taken for the wall', () => {
    for (const id of ['neg-tree-end-0', 'neg-hidden-1']) {
      const a = read(byCase(id))
      expect(a.wallEnds.state).toBe('REFUSED')
      expect(a.wallEnds.why).toContain('OCCLUDED')
      expect(a.anchors.some((x) => x.type === 'OCCLUDER')).toBe(true)
    }
    // a tree before the middle of the facade hides no end
    expect(read(byCase('pos-tree-mid-0')).wallEnds.state).toBe('ACCEPTED')
  })

  it('5. a pergola is not wall: its post stands past the roof, and the wall end under the eaves is taken', () => {
    const c = byCase('pos-pergola-0')
    const a = read(c)
    expect(a.wallEnds.state).toBe('ACCEPTED')
    expect(Math.abs((a.wallEnds.x0 as number) - c.truth.wallX0)).toBeLessThanOrEqual(3)
    expect(Math.abs((a.wallEnds.x1 as number) - c.truth.wallX1)).toBeLessThanOrEqual(3)
    // a timber screen against timber cladding runs on past the roof: refused, never read as the wall
    const s = read(byCase('neg-screen-0'))
    expect(s.wallEnds.state).not.toBe('ACCEPTED')
  })

  it('and eaves and a balcony past the wall end are not the wall face', () => {
    for (const id of ['pos-balcony-0', 'pos-balcony-1', 'pos-white-0']) {
      const c = byCase(id)
      const a = read(c)
      expect(Math.abs((a.wallEnds.x0 as number) - c.truth.wallX0)).toBeLessThanOrEqual(3)
      expect(Math.abs((a.wallEnds.x1 as number) - c.truth.wallX1)).toBeLessThanOrEqual(3)
      expect(a.eaveRow).toBeGreaterThanOrEqual(c.truth.eaveRow)
    }
  })

  it('6. a chimney is not the ridge: it is named and refused, and the ridge row is the roof’s top', () => {
    const c = byCase('pos-gable-0')
    const a = read(c)
    const chimney = a.anchors.find((x) => x.type === 'CHIMNEY')
    expect(chimney?.accepted).toBe(false)
    expect(a.apex && 'row' in a.apex ? Math.abs(a.apex.row - c.truth.apexRow) : 999).toBeLessThanOrEqual(4)
  })

  it('a perspective (a leaning end) and a sheet cut through the facade are refused', () => {
    expect(read(byCase('neg-persp-0')).wallEnds.why).toContain('leans')
    expect(read(byCase('neg-crop-0')).wallEnds.why).toContain('different backgrounds')
  })

  it('12. the reader takes no model: its anchors are the same whatever model is later compared with them', () => {
    // the reader's only inputs are the pixels and the traced outline; nothing in it is located by an expected opening
    expect(facadeAnchors.length).toBeLessThanOrEqual(3)
    const c = byCase('pos-white-1')
    expect(JSON.stringify(read(c))).toBe(JSON.stringify(read(c)))
  })
})

// --- elevationAxes and R5 on holdout sheets -------------------------------------------------------------------------
const frameOf = (id: string, view: string, c: HoldoutCase): SourceCoordinateFrame => ({ id, assetId: `a-${id}`, variantByteHash: id.padEnd(64, '0').slice(0, 64), size: { width: c.raster.width, height: c.raster.height }, roles: { document: 'ELEVATION', storey: 'NONE', annotation: 'NONE', view, projection: 'ORTHOGRAPHIC_ELEVATION' } })
const outlineOf = (id: string, c: HoldoutCase): SourceObservation => ({ id: `s-${id}`, frameId: id, kind: 'SILHOUETTE', confidence: 0.9, pixelGeometry: { type: 'RECT', rect: c.truth.outline } }) as unknown as SourceObservation
const audit = (frameId: string, c: HoldoutCase, use: ViewAuditRecord['use'], extra: Partial<ViewAuditRecord> = {}): ViewAuditRecord => ({ frameId, assetId: `a-${frameId}`, document: 'ELEVATION', projection: 'ORTHOGRAPHIC_ELEVATION', labelledView: 'X', sizePx: { width: c.raster.width, height: c.raster.height }, use, why: use === 'NOT_REGISTERED' ? 'not registered' : 'registered', lost: [], ...extra })
type Sheet = { id: string; view: string; c: HoldoutCase; audit?: Partial<ViewAuditRecord> & { use?: ViewAuditRecord['use'] } }
function axes(sheets: Sheet[], world: { x: number; z: number }, datums: { ridgeY?: number; terrainY?: number } = {}) {
  const rasters = new Map(sheets.map((s) => [frameOf(s.id, s.view, s.c).variantByteHash, s.c.raster as unknown as Raster]))
  return elevationAxes({
    frames: sheets.map((s) => frameOf(s.id, s.view, s.c)),
    observations: sheets.map((s) => outlineOf(s.id, s.c)),
    raster: (f) => rasters.get(f.variantByteHash),
    world: { walled: { x0: 0, z0: 0, x1: world.x, z1: world.z }, envelope: { x0: 0, z0: 0, x1: world.x, z1: world.z } },
    ...datums,
    viewAudit: sheets.map((s) => audit(s.id, s.c, s.audit?.use ?? 'NOT_REGISTERED', s.audit)),
    solverRegistrations: [],
    openingsByFacade: { FRONT: 3, REAR: 3, LEFT: 1, RIGHT: 1 },
  })
}

describe('N9-02R: one validity basis for the axes', () => {
  it('2. no ridge datum: the facade is registered ALONG at its true scale, VERTICAL is UNAVAILABLE, not refused', () => {
    const c = byCase('pos-flat-1')
    const [v] = axes([{ id: 'f', view: 'FRONT', c }], { x: c.truth.wallM, z: 8 })
    expect(v.along.state).toBe('REGISTERED')
    expect(Math.abs((v.along.mpp as number) / c.truth.mpp - 1)).toBeLessThan(0.01)
    expect(v.validity).toMatchObject({ along: 'VALID', vertical: 'UNAVAILABLE', hand: 'KNOWN' })
  })

  it('7. two unlabelled sides: the span stands, the hand is UNKNOWN, no position is read', () => {
    const f = byCase('pos-flat-1')
    const s = byCase('pos-gable-0')
    const vs = axes([
      { id: 'f', view: 'FRONT', c: f },
      { id: 'r', view: 'REAR', c: f },
      { id: 's1', view: 'SIDE_UNSPECIFIED', c: s },
      { id: 's2', view: 'SIDE_UNSPECIFIED', c: s },
    ], { x: f.truth.wallM, z: s.truth.wallM })
    const v = vs.find((x) => x.frameId === 's1')
    expect(v?.validity).toMatchObject({ along: 'SPAN_ONLY', hand: 'UNKNOWN' })
    expect(v?.along.alongAtLeft).toBeUndefined()
  })

  it('8. a misleading scale: a view whose drawn width puts the span off the sheet scale of its siblings is DISPUTED, with the measure', () => {
    const f = byCase('pos-flat-1')
    // the plan says the walls are 20 % wider than this sheet draws them at the solver's scale
    const solverMpp = f.truth.mpp
    const vs = axes([
      { id: 'f', view: 'FRONT', c: f, audit: { use: 'OPENINGS_ONLY', side: 'FRONT', mpp: solverMpp, spanM: f.truth.wallM } },
      { id: 'r', view: 'REAR', c: f, audit: { use: 'OPENINGS_ONLY', side: 'REAR', mpp: solverMpp, spanM: f.truth.wallM } },
      { id: 'l', view: 'LEFT', c: f },
    ], { x: f.truth.wallM, z: f.truth.wallM * 1.2 })
    const l = vs.find((x) => x.frameId === 'l')
    expect(l?.validity.along).toBe('DISPUTED')
    expect(l?.along.dispute).toContain('OFF_SHEET_SCALE')
  })
})

// --- R5 on adjudicated axes ------------------------------------------------------------------------------------------
const cross = (ids: string[]) => ({ views: ids.map((frameId) => ({ frameId })), reconciliation: { iterations: 0, applied: 0, refused: 0, converged: true, residualsBefore: 0, residualsAfter: 0 } }) as never
const noAlign = { views: [], readings: [], rejected: [], comparisons: [], corrections: [], unregistered: [], counts: {} as never, statusCounts: {} as never }
const model = { openings: [{ id: 'o1' }, { id: 'o2' }], walls: [], roofs: [], roofPlanes: [] } as never
const res = (kind: SourceViewResidual['kind'], featureId: string, residualM: number, toleranceM = 0.13, objectId?: string): SourceViewResidual => ({ featureId, objectId, frameId: 'v', kind, modelM: 1, observedM: 1 - residualM, residualM, toleranceM, withinTolerance: Math.abs(residualM) <= toleranceM, why: 'the nearest tone edge' })
const mismatch = [res('OPENING_SILL', 'o1', -0.6, 0.13, 'o1'), res('OPENING_HEAD', 'o1', -0.5, 0.13, 'o1'), res('OPENING_SILL', 'o2', -0.55, 0.13, 'o2'), res('ROOF_EDGE', 'feat-roof', -0.5, 0.25, 'roof-main'), res('SILHOUETTE_WIDTH', 'silhouette-front', 0.3, 0.15)]
const r5 = (adj: ViewAdjudication | undefined, residuals = mismatch) => elevationRelation({ model, viewAudit: [{ frameId: 'v', assetId: 'a', document: 'ELEVATION', projection: 'ORTHOGRAPHIC_ELEVATION', labelledView: 'FRONT', sizePx: { width: 10, height: 10 }, use: 'REGISTERED', side: 'FRONT', mpp: 0.02, why: 'registered', lost: [] } as ViewAuditRecord], residuals, crossView: cross(['v']), facadeAlignment: noAlign, openings: [{ id: 'o1', facade: 'FRONT' }, { id: 'o2', facade: 'FRONT' }], ...(adj ? { adjudication: new Map([['v', adj]]) } : {}) })
const VALID: ViewAdjudication = { along: 'VALID', vertical: 'VALID', hand: 'KNOWN', why: { along: 'wall ends on the span', vertical: 'ridge datum at the apex, ground on the terrain' }, class: 'FULL', alongAnchorsShared: true }

describe('N9-02R: R5 judged on the adjudicated axes', () => {
  it('9. a disputed solver transform: R5 is UNCHECKED / REGISTRATION_DISPUTED, the raw residuals and the dispute are kept', () => {
    const disputed: ViewAdjudication = { ...VALID, along: 'DISPUTED', why: { ...VALID.why, along: 'SOLVER_REGISTRATION_CONTESTED: solver 0.016 m/px against this view’s wall ends 0.0147 m/px and the opposite view’s 0.0147 m/px' }, class: 'UNREGISTERED' }
    const before = r5(undefined)
    expect(before.items[0].status).toBe('CONFLICT')
    const after = r5(disputed)
    const item = after.items[0]
    expect(item.status).toBe('UNCHECKED')
    expect(item.code).toBe('REGISTRATION_DISPUTED')
    expect(item.measured.rawObserved).toBe(5)
    expect(item.measured.rawOutsideTolerance).toBe(5)
    expect(String(item.measured.alongDispute)).toContain('0.0147')
    expect(item.checks?.every((c) => c.validity === 'DISPUTED' || c.validity === 'CIRCULAR')).toBe(true)
    expect(item.coverage.executed).toBe(0)
  })

  it('and a vertical disputed by the solver’s own refusal of its heights sets the heights aside, not the view’s along checks', () => {
    const v: ViewAdjudication = { ...VALID, vertical: 'DISPUTED', why: { ...VALID.why, vertical: 'SOLVER_REFUSED_LOW_HEIGHTS' } }
    const item = r5(v, [...mismatch, res('RETURN_FACE', 'ret-1', 0.02, 0.08, 'ret-1')]).items[0]
    // the return face's row is placed by the disputed vertical too: nothing stands, the view is disputed
    expect(item.code).toBe('REGISTRATION_DISPUTED')
    const alongOnly = r5({ ...v, vertical: 'UNAVAILABLE' }, [...mismatch, res('RETURN_FACE', 'ret-1', 0.02, 0.08, 'ret-1')]).items[0]
    // with the vertical merely unavailable, the return face (an along check) stands on its own and agrees — a
    // model-anchored PASS on one check, the heights set aside and counted as such
    expect(alongOnly.coverage.executed).toBe(1)
    expect(alongOnly).toMatchObject({ status: 'PASS', code: 'ELEVATION_AGREES_MODEL_ANCHORED' })
    expect(alongOnly.measured.excludedUnavailable).toBe(4)
  })

  it('10. a verified transform and a real mismatch keep the CONFLICT; the width it was registered by is CIRCULAR, not counted', () => {
    const item = r5(VALID).items[0]
    expect(item.status).toBe('CONFLICT')
    expect(item.code).toBe('ELEVATION_DISAGREES')
    expect(item.checks?.find((c) => c.kind === 'SILHOUETTE_WIDTH')?.validity).toBe('CIRCULAR')
    expect(item.coverage.executed).toBe(4)
    expect(item.coverage.independent).toBe(0)
    expect(item.checks?.every((c) => c.modelAnchored)).toBe(true)
  })

  it('11. no registered axis: nothing is checked, and the budget says the view was compared on nothing', () => {
    const none: ViewAdjudication = { along: 'UNAVAILABLE', vertical: 'UNAVAILABLE', hand: 'KNOWN', why: { along: 'no wall end read', vertical: 'no ridge datum' }, class: 'UNREGISTERED', alongAnchorsShared: true }
    const rel = r5(none)
    expect(rel.items[0].status).toBe('UNCHECKED')
    expect(rel.items[0].coverage.executed).toBe(0)
    const budget = sourceUncheckedOf({ frames: [{ id: 'v', assetId: 'a', variantByteHash: 'x', size: { width: 10, height: 10 }, roles: { document: 'ELEVATION', storey: 'NONE', annotation: 'NONE', view: 'FRONT', projection: 'ORTHOGRAPHIC_ELEVATION' } } as SourceCoordinateFrame], viewAudit: [{ frameId: 'v', assetId: 'a', document: 'ELEVATION', projection: 'ORTHOGRAPHIC_ELEVATION', labelledView: 'FRONT', sizePx: { width: 10, height: 10 }, use: 'REGISTERED', side: 'FRONT', why: 'registered', lost: [] } as ViewAuditRecord], registeredPlans: [], skippedPlans: [], heightsMeasured: false, relations: [rel], adjudication: new Map([['v', none]]) })
    expect(budget.items[0]).toMatchObject({ kind: 'ELEVATION', extent: 'NONE', axes: { along: 'NONE', height: 'NONE' } })
  })

  it('a check needs exactly the axes it reads: heights both, a position along, the width is circular on a span registration', () => {
    expect(checkValidity('OPENING_SILL', { ...VALID, vertical: 'UNAVAILABLE' }).validity).toBe('UNAVAILABLE')
    expect(checkValidity('RETURN_FACE', { ...VALID, vertical: 'UNAVAILABLE' }).validity).toBe('VALID')
    expect(checkValidity('SILHOUETTE_WIDTH', VALID).validity).toBe('CIRCULAR')
    expect(checkValidity('SILHOUETTE_WIDTH', { ...VALID, alongAnchorsShared: false }).validity).toBe('VALID')
    expect(checkValidity('ROOF_EDGE', { ...VALID, along: 'SPAN_ONLY' }).validity).toBe('UNAVAILABLE')
  })
})
