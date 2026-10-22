/**
 * N7-P2: the openings an elevation draws, read from its pixels, against the plan's openings — and the gate a correction
 * must pass. Every picture here is drawn from invented dimensions and colours; no drawing or render of any real
 * building is used.
 *
 *   - the plan-free scan reads windows, a glazed door and a mullioned glazing at their drawn positions, and refuses a
 *     run of lamellas and a balustrade panel that look like openings;
 *   - one plan opening measured on the view finds the drawn jambs when the plan's gap stands off them;
 *   - a convention height is corrected only when a height-registered view and the plan-free twin agree; a printed
 *     callout, an untrusted view or a disagreeing twin keep the model;
 *   - MISSING_IN_MODEL, EXTRA_IN_MODEL, WRONG_FACADE and UNREGISTERED_VIEW are named, never acted on;
 *   - a perspective render is never registered as an elevation; an unregistered view says what is lost.
 */
import { describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-cv'
import { alignFacades, applyOpeningCorrections, measureOpeningOnView, scanFacadeOpenings, viewAudit } from '../src/index.js'
import type { ElevationFrameV2, FacadeBand, FacadeOpeningReading, FacadeView, LevelV2, OpeningV2 } from '../src/index.js'

type RGB = [number, number, number]
const PPM = 50
const FLOOR_ROW = 400
const X0 = 40
const EW = 800
const EH = 480

const frame = (shiftM = 0): ElevationFrameV2 => ({
  registration: { frameId: 'frame-front', assetId: 'asset-front' } as ElevationFrameV2['registration'],
  side: 'FRONT',
  planeAt: 0,
  alongOf: (px) => (px - X0) / PPM + shiftM,
  pxOf: (a) => X0 + (a - shiftM) * PPM,
  yOf: (py) => (FLOOR_ROW - py) / PPM,
  pyOf: (y) => FLOOR_ROW - y * PPM,
})

type Paint = { from: number; to: number; sill: number; head: number; fill: (row: number, col: number) => RGB }
const PLASTER: RGB = [200, 190, 170]
const GLASS = (): RGB => [70, 95, 130]
const DOOR_GLASS = (): RGB => [60, 80, 110]
const FRAME: RGB = [245, 245, 245]
const SLATS = (_r: number, c: number): RGB => (Math.floor(c / 4) % 2 === 0 ? [150, 110, 70] : [90, 60, 40])
const RAILING = (): RGB => [80, 85, 95]

/** A 14 m storey of plaster up to 2.8 m, sky over it, grass under the floor, with the given paints on it. */
function facade(paints: Paint[]): Raster {
  const data = new Uint8ClampedArray(EW * EH * 4)
  let seed = 11
  const noise = (): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return Math.round(((seed / 2147483648) * 2 - 1) * 3)
  }
  for (let y = 0; y < EH; y += 1) {
    for (let x = 0; x < EW; x += 1) {
      const a = (x - X0) / PPM
      const h = (FLOOR_ROW - y) / PPM
      let c: RGB = y >= FLOOR_ROW ? [70, 120, 60] : [140, 185, 230]
      if (a >= 0 && a <= 14 && h >= 0 && h < 2.8) c = PLASTER
      for (const p of paints) if (a >= p.from && a <= p.to && h >= p.sill && h <= p.head) c = p.fill(y, x)
      const n = noise()
      const k = (y * EW + x) * 4
      data[k] = c[0] + n
      data[k + 1] = c[1] + n
      data[k + 2] = c[2] + n
      data[k + 3] = 255
    }
  }
  return { width: EW, height: EH, data }
}

const LEVEL: LevelV2 = { index: 0, id: 'level-0', elevation: 0, height: 2.8, wallTop: 2.8, featureId: 'f-level-0' }
const W1: Paint = { from: 1, to: 2.5, sill: 0.9, head: 2.2, fill: GLASS }
const D1: Paint = { from: 4, to: 5, sill: 0, head: 2.1, fill: DOOR_GLASS }
const W2: Paint = { from: 7, to: 9.4, sill: 0.9, head: 2.2, fill: GLASS }
const MULLION: Paint = { from: 8.17, to: 8.23, sill: 0.9, head: 2.2, fill: () => FRAME }
const LAMELLAS: Paint = { from: 10.5, to: 12.5, sill: 0.3, head: 2.5, fill: SLATS }
const BALUSTRADE: Paint = { from: 12.8, to: 13.8, sill: 0, head: 1.0, fill: RAILING }

const view = (raster: Raster, over: Partial<FacadeView> = {}): FacadeView => ({ frameId: 'frame-front', facade: 'FRONT', view: frame(), raster, registration: 'SILHOUETTE', heights: true, alongErrorM: 0.02, heightErrorM: 0.02, ...over })
const band = (solids: Array<[number, number]>): FacadeBand => ({ storeyIndex: 0, floorY: 0, topY: 2.75, covers: [{ from: 0, to: 14, topY: 2.75 }], solids })
const CTX = { wallSpan: { from: 0, to: 14 }, levels: [LEVEL], wallTopY: 2.8, railings: [{ from: 12.8, to: 13.8, baseY: 0, topY: 1.0 }] }

describe('N7-P2 plan-free scan of an elevation', () => {
  const raster = facade([W1, D1, W2, MULLION, LAMELLAS, BALUSTRADE])
  // the plan's solid wall: everything but its three gaps, the lamellas and the balustrade (none of them learnt as wall)
  const solids: Array<[number, number]> = [[0, 1], [2.5, 4], [5, 7], [9.4, 10.3], [12.6, 12.7]]
  const scan = scanFacadeOpenings(view(raster), [band(solids)], CTX)

  it('reads the windows, the glazed door and the mullioned glazing where they are drawn', () => {
    const at = (from: number): FacadeOpeningReading | undefined => scan.readings.find((r) => Math.abs(r.from - from) <= 0.1)
    for (const p of [W1, D1, W2]) {
      const r = at(p.from)
      expect(r, `${p.from}`).toBeDefined()
      expect(Math.abs((r as FacadeOpeningReading).to - p.to)).toBeLessThanOrEqual(0.1)
      expect(Math.abs((r as FacadeOpeningReading).sillY - p.sill)).toBeLessThanOrEqual(0.1)
      expect(Math.abs((r as FacadeOpeningReading).headY - p.head)).toBeLessThanOrEqual(0.1)
    }
    expect(at(D1.from)?.kind).toBe('GLAZED_DOOR')
    expect(at(W1.from)?.kind).toBe('WINDOW')
    // one glazing across its mullion, not two windows
    expect(scan.readings.filter((r) => r.from >= 6.9 && r.to <= 9.5)).toHaveLength(1)
  })

  it('refuses lamellas and a balustrade panel that stand out from the wall like openings', () => {
    expect(scan.readings.some((r) => r.to > LAMELLAS.from + 0.1 && r.from < LAMELLAS.to - 0.1)).toBe(false)
    expect(scan.readings.some((r) => r.to > BALUSTRADE.from + 0.1 && r.from < BALUSTRADE.to - 0.1)).toBe(false)
    expect(scan.rejected.some((j) => j.reason.startsWith('a run of slats'))).toBe(true)
    expect(scan.rejected.some((j) => j.reason.startsWith('a balustrade panel'))).toBe(true)
    expect(scan.readings).toHaveLength(3)
  })

  it('tells plain wall from an opening at a stretch of the facade', () => {
    expect(scan.foreignShare(0, 0.2, 0.8)).toBeLessThanOrEqual(0.03)
    expect(scan.foreignShare(0, 1.1, 2.4)).toBeGreaterThan(0.3)
    expect(scan.foreignShare(1, 1.1, 2.4)).toBeUndefined()
  })
})

describe('N7-P2 one plan opening measured on the view', () => {
  it('finds the drawn jambs when the plan’s gap stands 0.15 m off them, and the drawn sill and head', () => {
    const raster = facade([W1])
    const m = measureOpeningOnView(raster, frame(), [1.15, 2.65], [[0, 1.15], [2.65, 14]], 0, 2.75)
    expect(m).not.toBeNull()
    expect(Math.abs((m?.from ?? 0) - 1)).toBeLessThanOrEqual(0.06)
    expect(Math.abs((m?.to ?? 0) - 2.5)).toBeLessThanOrEqual(0.06)
    expect(Math.abs((m?.sillY ?? 0) - 0.9)).toBeLessThanOrEqual(0.06)
    expect(Math.abs((m?.headY ?? 0) - 2.2)).toBeLessThanOrEqual(0.06)
  })

  it('reads nothing where the view draws plain wall', () => {
    expect(measureOpeningOnView(facade([]), frame(), [5, 6], [[0, 5], [6, 14]], 0, 2.75)).toBeNull()
  })
})

// --- the matching and its gate, on readings given by hand
const opening = (id: string, over: Partial<OpeningV2> = {}): OpeningV2 => ({
  id,
  storeyIndex: 0,
  massId: 'main',
  facade: 'FRONT',
  planeAt: 0,
  interval: [1, 2.5],
  widthM: 1.5,
  sillY: 0.85,
  headY: 2.15,
  profile: 'RECTANGULAR',
  family: 'WINDOW',
  mullions: [],
  planGap: { frameId: 'plan', pixelRect: { x0: 0, y0: 0, x1: 1, y1: 1 } },
  provenance: { interval: 'SOURCE_EXACT', width: 'SOURCE_EXACT', sill: 'ASSUMED_FOR_RENDERING', head: 'ASSUMED_FOR_RENDERING', profile: 'ASSUMED_FOR_RENDERING', family: 'SOURCE_DERIVED' },
  uncertaintyM: 0.03,
  unresolved: [],
  confidence: 0.8,
  why: 'test',
  ...over,
}) as OpeningV2
const reading = (id: string, from: number, to: number, sillY: number, headY: number, over: Partial<FacadeOpeningReading> = {}): FacadeOpeningReading => ({ id, facade: 'FRONT', frameId: 'frame-front', observationIds: [], storeyIndex: 0, from, to, widthM: to - from, sillY, headY, kind: 'WINDOW', mullions: [], touchesCorner: null, uncertaintyM: { along: 0.04, height: 0.04 }, evidence: { contrast: 40, glassShare: 0.9, transitionsPerM: 1 }, heightsTrusted: true, ...over })
const raster0 = facade([])

describe('N7-P2 plan against elevation: codes and the correction gate', () => {
  it('corrects a convention sill and head when the height-registered view and the plan-free twin agree', () => {
    const o = opening('o1')
    const report = alignFacades({ openings: [o], views: [view(raster0)], levels: [LEVEL], unregistered: [], read: new Map([['frame-front', { measured: [{ opening: o, reading: reading('fm-o1', 1, 2.5, 1.2, 2.3) }], candidates: [], rejected: [], scanned: [reading('fo-0', 1.02, 2.48, 1.22, 2.28)] }]]) })
    const c = report.comparisons.find((x) => x.openingId === 'o1')
    expect(c?.codes).toEqual(['SILL_MISMATCH', 'HEAD_MISMATCH'])
    expect(c?.delta?.sillM).toBeCloseTo(0.35, 6)
    expect(report.corrections.map((x) => [x.property, x.before, x.after])).toEqual([['sill', 0.85, 1.21], ['head', 2.15, 2.29]])
    const [after] = applyOpeningCorrections([o], report.corrections)
    expect([after.sillY, after.headY]).toEqual([1.21, 2.29])
    expect([after.provenance.sill, after.provenance.head]).toEqual(['IMAGE_METRIC_REGISTERED', 'IMAGE_METRIC_REGISTERED'])
    expect(after.interval).toEqual(o.interval)
  })

  it('never overwrites a printed callout, never corrects from an untrusted view, never without the twin', () => {
    const measured = (o: OpeningV2) => [{ opening: o, reading: reading(`fm-${o.id}`, 1, 2.5, 1.2, 2.3) }]
    const twin = [reading('fo-0', 1.02, 2.48, 1.22, 2.28)]
    const callout = opening('o2', { callout: { widthCm: 150, heightCm: 130, evidenceId: 'e', distanceM: 0.2 }, provenance: { ...opening('x').provenance, sill: 'SOURCE_EXACT', head: 'SOURCE_EXACT' } })
    const a = alignFacades({ openings: [callout], views: [view(raster0)], levels: [LEVEL], unregistered: [], read: new Map([['frame-front', { measured: measured(callout), candidates: [], rejected: [], scanned: twin }]]) })
    expect(a.corrections).toEqual([])
    expect(a.comparisons[0].codes).toContain('SILL_MISMATCH')
    const o = opening('o3')
    const untrusted = alignFacades({ openings: [o], views: [view(raster0, { heights: false })], levels: [LEVEL], unregistered: [], read: new Map([['frame-front', { measured: measured(o), candidates: [], rejected: [], scanned: twin }]]) })
    expect(untrusted.corrections).toEqual([])
    expect(untrusted.comparisons[0].codes).toEqual([])
    const disagreeing = alignFacades({ openings: [o], views: [view(raster0)], levels: [LEVEL], unregistered: [], read: new Map([['frame-front', { measured: measured(o), candidates: [], rejected: [], scanned: [reading('fo-0', 1.02, 2.48, 0.6, 2.28)] }]]) })
    expect(disagreeing.corrections.map((x) => x.property)).toEqual(['head'])
    const alone = alignFacades({ openings: [o], views: [view(raster0)], levels: [LEVEL], unregistered: [], read: new Map([['frame-front', { measured: measured(o), candidates: [], rejected: [], scanned: [] }]]) })
    expect(alone.corrections).toEqual([])
    expect(alone.comparisons[0].note).toMatch(/reads nothing there: the two readings do not agree, the model is kept/)
  })

  it('settles a printed height read two ways alike by the view, taking the printed number, not the pixels', () => {
    const cands = [{ cm: 275, score: 0.5988 }, { cm: 225, score: 0.5979 }, { cm: 224, score: 0.5755 }, { cm: 276, score: 0.5721 }, { cm: 229, score: 0.5593 }]
    const garage = opening('g1', { family: 'GARAGE_DOOR', interval: [8.5, 11.25], widthM: 2.75, sillY: 0, headY: 2.75, callout: { widthCm: 275, heightCm: 275, evidenceId: 'e', distanceM: 0.6, heightCandidates: cands }, unresolved: ['the printed height reads 275 or 225 alike, and no elevation shows this wall'], provenance: { ...opening('x').provenance, sill: 'SOURCE_DERIVED', head: 'UNRESOLVED' } } as Partial<OpeningV2>)
    const run = (headY: number, heights = true) => alignFacades({ openings: [garage], views: [view(raster0, { heights })], levels: [LEVEL], unregistered: [], read: new Map([['frame-front', { measured: [{ opening: garage, reading: reading('fm-g1', 8.5, 11.3, 0, headY) }], candidates: [], rejected: [], scanned: [] }]]) })
    const r = run(2.2)
    expect(r.corrections.map((c) => [c.property, c.before, c.after, c.provenance, c.calloutHeightCm])).toEqual([['head', 2.75, 2.25, 'SOURCE_CORROBORATED', 225]])
    const [after] = applyOpeningCorrections([garage], r.corrections)
    expect(after.headY).toBe(2.25)
    expect(after.callout?.heightCm).toBe(225)
    expect(after.provenance.head).toBe('SOURCE_CORROBORATED')
    expect(after.unresolved).toEqual([])
    // the view fits the reading the model already took, or fits neither, or is not registered for heights: kept
    expect(run(2.72).corrections).toEqual([])
    expect(run(2.5).corrections).toEqual([])
    expect(run(2.2, false).corrections).toEqual([])
    // two printed numbers both fit the view: no choice is made for the source
    const wide = opening('g2', { ...garage, id: 'g2', callout: { widthCm: 275, heightCm: 275, evidenceId: 'e', distanceM: 0.6, heightCandidates: [{ cm: 275, score: 0.6 }, { cm: 225, score: 0.6 }, { cm: 210, score: 0.59 }] } })
    const two = alignFacades({ openings: [wide], views: [view(raster0)], levels: [LEVEL], unregistered: [], read: new Map([['frame-front', { measured: [{ opening: wide, reading: reading('fm-g2', 8.5, 11.3, 0, 2.17) }], candidates: [], rejected: [], scanned: [] }]]) })
    expect(two.corrections).toEqual([])
    expect(two.comparisons[0].note).toMatch(/does not pick exactly one/)
  })

  it('refuses a correction its wall cannot hold', () => {
    const o = opening('o4')
    const r = alignFacades({ openings: [o], views: [view(raster0)], levels: [LEVEL], unregistered: [], read: new Map([['frame-front', { measured: [{ opening: o, reading: reading('fm-o4', 1, 2.5, 1.2, 2.9) }], candidates: [], rejected: [], scanned: [reading('fo-0', 1, 2.5, 1.2, 2.9)] }]]) })
    expect(r.corrections).toEqual([])
    expect(r.comparisons[0].note).toMatch(/do not fit the storey's wall/)
  })

  it('names offsets and widths in metres but never moves an interval on pixels', () => {
    const o = opening('o5', { provenance: { ...opening('x').provenance, sill: 'SOURCE_EXACT', head: 'SOURCE_EXACT' } })
    const r = alignFacades({ openings: [o], views: [view(raster0)], levels: [LEVEL], unregistered: [], read: new Map([['frame-front', { measured: [{ opening: o, reading: reading('fm-o5', 1.3, 3.1, 0.85, 2.15) }], candidates: [], rejected: [] }]]) })
    expect(r.comparisons[0].codes).toEqual(['HORIZONTAL_OFFSET', 'WIDTH_MISMATCH'])
    expect(r.comparisons[0].delta?.centreM).toBeCloseTo(0.45, 6)
    expect(r.comparisons[0].delta?.widthM).toBeCloseTo(0.3, 6)
    expect(r.corrections).toEqual([])
  })

  it('reports an opening the view draws and the plan lacks, and a plan gap the view draws as wall', () => {
    const o = opening('o6', { interval: [5, 6], widthM: 1 })
    const r = alignFacades({ openings: [o], views: [view(raster0)], levels: [LEVEL], unregistered: [], read: new Map([['frame-front', { measured: [{ opening: o, reading: null }], candidates: [reading('fo-1', 10, 11.5, 0.9, 2.2)], rejected: [], scanned: [], foreignShare: () => 0.004 }]]) })
    expect(r.comparisons.find((c) => c.readingId === 'fo-1')?.codes).toEqual(['MISSING_IN_MODEL'])
    expect(r.comparisons.find((c) => c.openingId === 'o6')?.codes).toEqual(['EXTRA_IN_MODEL'])
    expect(r.corrections).toEqual([])
    // an unread gap the view does not show as wall is neither confirmed nor contradicted
    const unsure = alignFacades({ openings: [o], views: [view(raster0)], levels: [LEVEL], unregistered: [], read: new Map([['frame-front', { measured: [{ opening: o, reading: null }], candidates: [], rejected: [], scanned: [], foreignShare: () => 0.2 }]]) })
    expect(unsure.comparisons[0].codes).toEqual([])
  })

  it('flags a side view whose openings stand where the opposite wall’s are, and the facades no view covers', () => {
    const east = [opening('e1', { facade: 'EAST', interval: [1, 2], widthM: 1 }), opening('e2', { facade: 'EAST', interval: [4, 5], widthM: 1 }), opening('e3', { facade: 'EAST', interval: [7, 8], widthM: 1 })]
    const west = [opening('w1', { facade: 'WEST', interval: [9, 10], widthM: 1 })]
    const side = view(raster0, { frameId: 'frame-side', facade: 'WEST' })
    const cands = [reading('fo-a', 1, 2, 0.9, 2.2, { facade: 'WEST' }), reading('fo-b', 4, 5, 0.9, 2.2, { facade: 'WEST' }), reading('fo-c', 7, 8, 0.9, 2.2, { facade: 'WEST' })]
    const r = alignFacades({ openings: [...east, ...west], views: [side], levels: [LEVEL], unregistered: [{ facade: 'EAST', why: 'no view of this side was registered' }, { facade: 'WEST', why: 'covered' }], read: new Map([['frame-side', { measured: [{ opening: west[0], reading: null }], candidates: cands, rejected: [] }]]) })
    expect(r.comparisons.some((c) => c.codes.includes('WRONG_FACADE'))).toBe(true)
    expect(r.comparisons.filter((c) => c.codes.includes('UNREGISTERED_VIEW')).map((c) => c.openingId)).toEqual(['e1', 'e2', 'e3'])
    expect(r.unregistered.map((u) => u.facade)).toEqual(['EAST'])
    expect(r.counts.UNREGISTERED_VIEW).toBe(3)
  })
})

describe('N7-P2 view audit', () => {
  const f = (id: string, projection: string, view: string, document = projection === 'PERSPECTIVE' ? 'PERSPECTIVE_RENDER' : 'ELEVATION') => ({ id, assetId: `asset-${id}`, roles: { document, projection, view }, size: { width: 1280, height: 576 } }) as never
  it('never registers a perspective render as an elevation, and says what an unregistered view loses', () => {
    const records = viewAudit({
      frames: [f('a-front', 'ORTHOGRAPHIC_ELEVATION', 'FRONT'), f('b-side', 'ORTHOGRAPHIC_ELEVATION', 'SIDE_UNSPECIFIED'), f('c-render', 'PERSPECTIVE', 'FRONT'), f('d-render', 'PERSPECTIVE', 'UNSPECIFIED')],
      first: [],
      firstRefused: [{ frameId: 'b-side', why: 'its ground lands 0.6 m off the other views' }],
      refusals: new Map(),
      registered: [{ frameId: 'a-front', side: 'FRONT', sideConfidence: 1, mpp: 0.02, spanM: 14, spanWhy: 'plan span', bottomY: 0, anisotropyCheck: 0.04, confidence: 0.9, why: 'silhouette on the ridge datum' } as never],
      openingsOnly: new Map(),
      sameSheet: new Set(),
      heightsRefused: new Set(),
      cameras: [{ frameId: 'c-render', solved: true, residualPx: 3.2, why: '' }, { frameId: 'd-render', solved: false, why: 'too few vanishing lines' }],
    })
    const by = new Map(records.map((r) => [r.frameId, r]))
    expect(by.get('a-front')?.use).toBe('REGISTERED')
    expect(by.get('a-front')?.groundErrorPx).toBeCloseTo(2, 6)
    expect(by.get('a-front')?.sideBasis).toBe('LABELLED')
    expect(by.get('c-render')?.use).toBe('PERSPECTIVE_CHECK_ONLY')
    expect(by.get('d-render')?.use).toBe('PERSPECTIVE_UNUSED')
    expect(records.filter((r) => r.projection === 'PERSPECTIVE').every((r) => r.side === undefined && r.mpp === undefined)).toBe(true)
    expect(by.get('b-side')?.use).toBe('NOT_REGISTERED')
    expect(by.get('b-side')?.why).toMatch(/ground lands/)
    expect(by.get('b-side')?.lost.length).toBeGreaterThan(0)
  })
})
