/**
 * The steps that turn one gap in a wall into an opening, each tested on its own with plain values — no plan, no
 * elevation raster, no house. Every case is invented.
 */
import { describe, expect, it } from 'vitest'
import { classifyOpeningFamily, matchOpeningCallout, passageHead, preferredElevationExtent, resolveSillAndHead } from '../src/v2/opening-reading.js'
import type { OpeningFamilyFacts, OpeningSymbols } from '../src/v2/opening-reading.js'
import type { DrawnLeaves } from '../src/v2/openings-v2.js'

const symbols = (s: Partial<{ glazed: boolean; leaf: boolean; swing: boolean; leaves: DrawnLeaves }> = {}): OpeningSymbols => ({
  glazed: () => s.glazed ?? false,
  leaf: () => (s.leaf ? { swing: 'IN', hingeAt: 'LOW' } as never : undefined),
  swingDrawn: () => s.swing ?? false,
  leaves: () => s.leaves,
})
const facts = (f: Partial<OpeningFamilyFacts>): OpeningFamilyFacts => ({ storeyIndex: 0, widthM: 1.0, sillAboveFloorM: 0, heightM: 2.1, heightsAssumed: false, doorBySymbol: false, doorSwing: false, attachedSingleStorey: false, symbols: symbols(), ...f })

describe('classifyOpeningFamily', () => {
  it('an empty door-sized gap to the floor is a door; the same gap with glazing and no leaf drawn is a floor-length window', () => {
    expect(classifyOpeningFamily(facts({})).family).toBe('DOOR')
    expect(classifyOpeningFamily(facts({ symbols: symbols({ glazed: true }) })).family).toBe('WINDOW')
  })
  it('glazing with a door leaf drawn beside it is a glazed door, on the ground storey only', () => {
    expect(classifyOpeningFamily(facts({ symbols: symbols({ glazed: true, leaf: true }) })).family).toBe('GLAZED_DOOR')
    expect(classifyOpeningFamily(facts({ storeyIndex: 1, symbols: symbols({ glazed: true, leaf: true }) })).family).not.toBe('GLAZED_DOOR')
  })
  it('an opening with a sill above the floor is a window whatever its width', () => {
    expect(classifyOpeningFamily(facts({ sillAboveFloorM: 0.9, heightM: 1.3 })).family).toBe('WINDOW')
    expect(classifyOpeningFamily(facts({ sillAboveFloorM: 0.9, heightM: 1.3, widthM: 3 })).family).toBe('WINDOW')
  })
  it('wide openings to the floor are multi-panel glazing; between a door and that, a glazed door', () => {
    expect(classifyOpeningFamily(facts({ widthM: 2.4 })).family).toBe('MULTI_PANEL_GLAZING')
    expect(classifyOpeningFamily(facts({ widthM: 1.6, symbols: symbols({ glazed: true, swing: true }) })).family).toBe('GLAZED_DOOR')
  })
  it('a vehicle door needs the plan symbol: tracks or a garage mouth — never width alone', () => {
    expect(classifyOpeningFamily(facts({ widthM: 2.75, overheadTracks: { why: 'tracks' } })).family).toBe('GARAGE_DOOR')
    expect(classifyOpeningFamily(facts({ widthM: 2.75 })).family).toBe('MULTI_PANEL_GLAZING')
  })
  it('with assumed heights, a symbol-made vehicle door takes the floor and says its heights are assumed', () => {
    const d = classifyOpeningFamily(facts({ widthM: 2.75, heightsAssumed: true, sillAboveFloorM: 0.9, overheadTracks: { why: 'tracks' } }))
    expect(d.family).toBe('GARAGE_DOOR')
    expect(d.vehicleDoorAssumedHeights).toBe(true)
    expect(d.notes[0]).toContain('assumed')
  })
  it('with assumed heights and no symbol, only the door convention makes a door; everything else is an assumed window', () => {
    expect(classifyOpeningFamily(facts({ heightsAssumed: true, doorBySymbol: true })).family).toBe('DOOR')
    const w = classifyOpeningFamily(facts({ heightsAssumed: true, sillAboveFloorM: 0.9, widthM: 2.4 }))
    expect(w.family).toBe('WINDOW')
    expect(w.provenance).toBe('ASSUMED_FOR_RENDERING')
  })
  it('a garage room makes a glazed-looking door-sized opening its door (no French window in a garage)', () => {
    expect(classifyOpeningFamily(facts({ garageRoom: { why: 'a garage' }, symbols: symbols({ glazed: true }) })).family).toBe('DOOR')
  })
  it('narrower than a glazed door, to the floor, lines across the gap and a leaf or swing drawn: a door, its threshold drawn', () => {
    const d = classifyOpeningFamily(facts({ widthM: 0.7, symbols: symbols({ glazed: true, leaf: true }) }))
    expect(d.family).toBe('DOOR')
    expect(d.notes[0]).toContain('threshold')
    expect(classifyOpeningFamily(facts({ widthM: 0.7, symbols: symbols({ glazed: true, swing: true }) })).family).toBe('DOOR')
  })
  it('the same narrow glazed gap with neither leaf nor swing drawn stays a window, and the 0.75 m cut is not moved', () => {
    expect(classifyOpeningFamily(facts({ widthM: 0.7, symbols: symbols({ glazed: true }) })).family).toBe('WINDOW')
    expect(classifyOpeningFamily(facts({ widthM: 0.8, symbols: symbols({ glazed: true }) })).family).toBe('WINDOW')
    expect(classifyOpeningFamily(facts({ widthM: 0.7, sillAboveFloorM: 0.9, heightM: 1.2, symbols: symbols({ glazed: true, leaf: true }) })).family).toBe('WINDOW')
  })
  it('asks the plan for a leaf only where the rules reach it', () => {
    let asked = 0
    classifyOpeningFamily(facts({ sillAboveFloorM: 0.9, heightM: 1.3, symbols: { ...symbols(), leaf: () => (asked++, undefined) } }))
    expect(asked).toBe(0)
  })
})

describe('resolveSillAndHead', () => {
  const host = { floorY: 0, storeyHeightM: 2.8 }
  const strong = () => ({ weak: false, confidence: 0.99 })
  const callout = (w: number, h: number) => ({ widthCm: w, heightCm: h, evidenceId: 'c', distanceM: 0.5, heightCandidates: [{ cm: h, score: 0.99 }] })
  it('a printed height the elevation agrees with is corroborated', () => {
    const r = resolveSillAndHead(host, { callout: callout(100, 150), elevation: { frameId: 'f', sillY: 0.85, headY: 2.3, contrast: 30, confidence: 0.7 } }, strong)
    expect(r?.sill).toBe('SOURCE_CORROBORATED')
    expect((r?.headY ?? 0) - (r?.sillY ?? 0)).toBeCloseTo(1.5, 6)
  })
  it('a printed door height with no elevation reaches the floor; a shorter one takes the common head', () => {
    expect(resolveSillAndHead(host, { callout: callout(90, 210), elevation: undefined }, strong)?.sillY).toBe(0)
    expect(resolveSillAndHead(host, { callout: callout(90, 150), elevation: undefined }, strong)?.headY).toBeCloseTo(2.2, 6)
  })
  it('a weak printed height the elevation contradicts gives way to the elevation', () => {
    const r = resolveSillAndHead(host, { callout: callout(100, 210), elevation: { frameId: 'f', sillY: 0.9, headY: 2.2, contrast: 30, confidence: 0.7 } }, () => ({ weak: true, confidence: 0.1 }))
    expect(r?.sill).toBe('IMAGE_METRIC_REGISTERED')
    expect(r?.sillY).toBe(0.9)
  })
  // E13 (Goździkowce 260/140 read 0.86 m tall from 0.06 on the elevation; Bakopy 220/140 read 0.86 from 0.25)
  it('a strong printed height the elevation refutes stands, and the refuted extent places neither end: the common head', () => {
    const r = resolveSillAndHead(host, { callout: callout(260, 140), elevation: { frameId: 'f', sillY: 0.06, headY: 0.92, contrast: 30, confidence: 0.7 } }, strong)
    expect(r?.head).toBe('SOURCE_EXACT')
    expect(r?.sill).toBe('ASSUMED_FOR_RENDERING')
    expect(r?.sillY).toBeCloseTo(0.8, 6)
    expect(r?.headY).toBeCloseTo(2.2, 6)
    expect(r?.notes.join(' ')).toMatch(/places neither end/)
    // taller than printed, from higher up: the same
    const t = resolveSillAndHead(host, { callout: callout(90, 140), elevation: { frameId: 'f', sillY: 1.25, headY: 1.96, contrast: 30, confidence: 0.7 } }, strong)
    expect(t?.sillY).toBeCloseTo(0.8, 6)
    // a printed door height still reaches the floor
    expect(resolveSillAndHead(host, { callout: callout(100, 210), elevation: { frameId: 'f', sillY: 0.5, headY: 1.6, contrast: 30, confidence: 0.7 } }, strong)?.sillY).toBe(0)
    // counter: an agreeing extent still places it, corroborated
    const ok = resolveSillAndHead(host, { callout: callout(260, 140), elevation: { frameId: 'f', sillY: 0.9, headY: 2.25, contrast: 30, confidence: 0.7 } }, strong)
    expect(ok?.sill).toBe('SOURCE_CORROBORATED')
    expect(ok?.sillY).toBeCloseTo(0.875, 6)
  })
  it('nothing read: null, so the caller assumes and says so', () => {
    expect(resolveSillAndHead(host, { callout: undefined, elevation: undefined }, strong)).toBeNull()
  })
})

describe('matchOpeningCallout and preferredElevationExtent', () => {
  const host = { facade: 'FRONT' as const, centreAt: 0.2 }
  const near = (w: number, x: number, confidence = 0.99) => ({ id: `c${w}-${x}`, confidence, textCentre: { x, z: -0.6 }, pixelCentre: [0, 0] as [number, number], candidates: { widths: [{ cm: w, score: confidence }], heights: [{ cm: 150, score: confidence }] } })
  it('takes the nearest callout whose width fits the gap; refuses one that does not fit or reads too weakly', () => {
    expect(matchOpeningCallout({ centre: 3, widthM: 1.0 }, host, [near(100, 3.5), near(100, 3.1)], 2, false).callout?.evidenceId).toBe('c100-3.1')
    expect(matchOpeningCallout({ centre: 3, widthM: 1.0 }, host, [near(150, 3)], 2, false).callout).toBeUndefined()
    expect(matchOpeningCallout({ centre: 3, widthM: 1.0 }, host, [near(100, 3, 0.1)], 2, false).callout).toBeUndefined()
  })
  // E13 (Willa Maja: the template's 116 and the recogniser's rival 110 at the same score, over a 1.08 m gap)
  it('two width readings tied on score: the plan gap they both fit picks the nearer; a clear score still wins', () => {
    const tied = { id: 't', confidence: 0.3, textCentre: { x: 3, z: -0.6 }, pixelCentre: [0, 0] as [number, number], candidates: { widths: [{ cm: 116, score: 0.5267 }, { cm: 110, score: 0.5267 }], heights: [{ cm: 277, score: 0.47 }, { cm: 230, score: 0.47 }] } }
    const m = matchOpeningCallout({ centre: 3, widthM: 1.08 }, host, [tied], 2, false).callout
    expect(m?.widthCm).toBe(110)
    expect(m?.resolvedBy).toMatch(/plan gap picked the width reading 110 over 116/)
    const clear = { ...tied, candidates: { ...tied.candidates, widths: [{ cm: 116, score: 0.6 }, { cm: 110, score: 0.5 }] } }
    expect(matchOpeningCallout({ centre: 3, widthM: 1.08 }, host, [clear], 2, false).callout?.widthCm).toBe(116)
    // rotated wall, mirrored order: the same tie, the same pick
    const side = { facade: 'WEST' as const, centreAt: 0.2 }
    const turned = { ...tied, textCentre: { x: -0.6, z: 3 }, candidates: { ...tied.candidates, widths: [{ cm: 110, score: 0.5267 }, { cm: 116, score: 0.5267 }] } }
    expect(matchOpeningCallout({ centre: 3, widthM: 1.08 }, side, [turned], 2, false).callout?.widthCm).toBe(110)
  })
  it('the object reader replaces the contrast reader when it contains it; a frame-short extent is no opening', () => {
    expect(preferredElevationExtent({ sillY: 0.8, headY: 2.3, contrast: 30 }, { sillY: 1.2, headY: 2.2, contrast: 20 })?.sillY).toBe(0.8)
    expect(preferredElevationExtent({ sillY: 1.4, headY: 2.3, contrast: 30 }, { sillY: 0.9, headY: 2.2, contrast: 20 })?.sillY).toBe(0.9)
    expect(preferredElevationExtent({ sillY: 2.0, headY: 2.3, contrast: 30 }, null)).toBeNull()
  })
})

// E13 (Goździkowce: the recess's mouth read 2.00 on the front elevation over a 2.10 m door in its back wall)
describe('passageHead', () => {
  it('a head read below an opening in the back wall is that opening seen through the mouth: the ceiling stays assumed', () => {
    const h = passageHead(2.0, [2.1, 1.4], 2.52)
    expect(h.read).toBe(false)
    expect(h.headY).toBe(2.52)
    expect(h.refused).toMatch(/seen through the mouth/)
  })
  it('counter: a head at or above the openings behind stands (the line weight allowed); nothing read is assumed; nothing behind, a reading stands', () => {
    expect(passageHead(2.4, [2.1], 2.52)).toEqual({ headY: 2.4, read: true })
    expect(passageHead(2.09, [2.1], 2.52)).toEqual({ headY: 2.09, read: true })
    expect(passageHead(undefined, [2.1], 2.52)).toEqual({ headY: 2.52, read: false })
    expect(passageHead(1.9, [], 2.52)).toEqual({ headY: 1.9, read: true })
  })
})
