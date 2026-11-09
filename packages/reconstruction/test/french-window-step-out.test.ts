/**
 * E13: an upper storey's window to the floor wider than one leaf is a French window unless something to step out onto
 * stands in front of it (Aurory 160/220, Trytomach 150/210, Muraje 180/210 became doors by width alone), and a window
 * an elevation read behind a balustrade is a door onto the balcony in front of it (Willa Maja's rear). Invented values.
 */
import { describe, expect, it } from 'vitest'
import { FRENCH_WINDOW_NOTE, classifyOpeningFamily, stepOutDoors } from '../src/v2/opening-reading.js'
import type { OpeningFamilyFacts } from '../src/v2/opening-reading.js'

const facts = (f: Partial<OpeningFamilyFacts>): OpeningFamilyFacts => ({ storeyIndex: 1, widthM: 1.6, sillAboveFloorM: 0, heightM: 2.2, heightsAssumed: false, doorBySymbol: false, doorSwing: false, attachedSingleStorey: false, symbols: { glazed: () => true, leaf: () => undefined, swingDrawn: () => true, leaves: () => undefined }, ...f })

describe('a window to the floor above the ground storey', () => {
  it('wider than one leaf, glazed or not: a French window, named as such', () => {
    const d = classifyOpeningFamily(facts({}))
    expect(d.family).toBe('WINDOW')
    // v3.51 (C2): the meaning is typed; the note beside it is for people
    expect(d.glazingToFloor).toBe('FRENCH_WINDOW')
    expect(d.notes).toContain(FRENCH_WINDOW_NOTE)
    expect(classifyOpeningFamily(facts({ widthM: 1.5, heightM: 2.1, symbols: { glazed: () => false, leaf: () => undefined, swingDrawn: () => false, leaves: () => undefined } })).family).toBe('WINDOW')
  })
  it('counter: the same opening on the ground storey is a terrace door, as before', () => {
    expect(classifyOpeningFamily(facts({ storeyIndex: 0 })).family).toBe('GLAZED_DOOR')
  })
  it('counter: a door-sized unglazed gap upstairs stays a door; a window above the floor stays a window', () => {
    expect(classifyOpeningFamily(facts({ widthM: 0.9, heightM: 2.1, symbols: { glazed: () => false, leaf: () => undefined, swingDrawn: () => false, leaves: () => undefined } })).family).toBe('DOOR')
    expect(classifyOpeningFamily(facts({ sillAboveFloorM: 0.9, heightM: 1.3 })).glazingToFloor).toBeUndefined()
  })
})

type O = Parameters<typeof stepOutDoors>[0][number]
const floor = 3
const french = (facade: O['facade'], planeAt: number, interval: [number, number], extra: Partial<O> = {}): O => ({ id: `o-${facade}`, storeyIndex: 1, facade, planeAt, interval, sillY: floor, headY: floor + 2.2, family: 'WINDOW', glazingToFloor: 'FRENCH_WINDOW', provenance: { sill: 'SOURCE_DERIVED' }, ...extra })
const slab = (x0: number, z0: number, x1: number, z1: number, storeyIndex = 1) => ({ id: 'balcony', storeyIndex, x0, z0, x1, z1 })
const floorOf = (s: number) => (s === 1 ? floor : s === 0 ? 0 : undefined)

describe('stepOutDoors', () => {
  // a body x 0..10, z 0..8; each face's balcony 1.2 m deep outside it
  const faces: Array<[O, ReturnType<typeof slab>]> = [
    [french('FRONT', 0, [3, 4.6]), slab(2.5, -1.2, 5.5, 0)],
    [french('REAR', 8, [3, 4.6]), slab(2.5, 8, 5.5, 9.2)],
    [french('WEST', 0, [3, 4.6]), slab(-1.2, 2.5, 0, 5.5)],
    [french('EAST', 10, [3, 4.6]), slab(10, 2.5, 11.2, 5.5)],
  ]
  it('a French window with a balcony slab of its storey in front of it opens onto it, on every face', () => {
    for (const [o, b] of faces) expect(stepOutDoors([o], [b], [], floorOf).map((x) => x.onto), o.facade).toEqual(['balcony'])
  })
  it('counter: no slab, a slab on another storey, a slab beside it or behind the face — still a French window', () => {
    for (const [o, b] of faces) {
      expect(stepOutDoors([o], [], [], floorOf)).toEqual([])
      expect(stepOutDoors([o], [{ ...b, storeyIndex: 2 }], [], floorOf)).toEqual([])
    }
    const [o] = faces[0]
    expect(stepOutDoors([o], [slab(4.3, -1.2, 7, 0)], [], floorOf)).toEqual([])
    expect(stepOutDoors([o], [slab(2.5, 0, 5.5, 1.2)], [], floorOf)).toEqual([])
  })
  it('a flat roof of a lower body at its floor in front of it is a roof terrace it opens onto; one a metre lower is not', () => {
    const [o] = faces[0]
    const roof = (top: number) => ({ massId: 'garage', slabTopY: top, footprint: { x0: 0, z0: -5, x1: 6, z1: 0 } })
    expect(stepOutDoors([o], [], [roof(floor + 0.2)], floorOf).map((x) => x.onto)).toEqual(['the flat roof of garage'])
    expect(stepOutDoors([o], [], [roof(floor - 1)], floorOf)).toEqual([])
  })
  it('a window an elevation read behind a balustrade, with a door\'s head, is a door onto the balcony in front', () => {
    const [, b] = faces[1]
    const behind = french('REAR', 8, [3, 4.6], { glazingToFloor: undefined, sillY: floor + 0.81, headY: floor + 2.73, provenance: { sill: 'IMAGE_METRIC_REGISTERED' } })
    expect(stepOutDoors([behind], [b], [], floorOf)).toEqual([{ opening: behind, onto: 'balcony', kind: 'BALCONY', behindBalustrade: true }])
  })
  it('counter: a printed window over a balcony, or one read short, is not made a door', () => {
    const [, b] = faces[1]
    const printed = french('REAR', 8, [3, 4.6], { glazingToFloor: undefined, sillY: floor + 0.8, headY: floor + 2.2, provenance: { sill: 'IMAGE_METRIC_REGISTERED' }, callout: { widthCm: 160, heightCm: 140 } })
    const short = french('REAR', 8, [3, 4.6], { glazingToFloor: undefined, sillY: floor + 0.9, headY: floor + 1.6, provenance: { sill: 'IMAGE_METRIC_REGISTERED' } })
    const assumed = french('REAR', 8, [3, 4.6], { glazingToFloor: undefined, sillY: floor + 0.9, headY: floor + 2.2, provenance: { sill: 'ASSUMED_FOR_RENDERING' } })
    expect(stepOutDoors([printed, short, assumed], [b], [], floorOf)).toEqual([])
  })
  it('counter: the ground storey is never touched', () => {
    const o = { ...faces[0][0], storeyIndex: 0, sillY: 0, headY: 2.2 }
    expect(stepOutDoors([o], [{ ...faces[0][1], storeyIndex: 0 }], [], floorOf)).toEqual([])
  })
  // v3.51 (C2): the description is not a control channel — only the typed meaning decides
  it('a French window by its typed meaning opens onto the balcony whatever its notes say; the note alone makes nothing a door', () => {
    const [o, b] = faces[0]
    const reworded = { ...o, unresolved: ['okno francuskie — drzwi tylko tam, gdzie stoi balkon'] }
    expect(stepOutDoors([reworded], [b], [], floorOf).map((x) => x.onto)).toEqual(['balcony'])
    const noteOnly = { ...o, glazingToFloor: undefined, unresolved: [FRENCH_WINDOW_NOTE] }
    expect(stepOutDoors([noteOnly], [b], [], floorOf)).toEqual([])
  })
})
