/**
 * EXTERIOR-COMPLETE: what fills an opening on the elevation decides a vehicle door and a door leaf where the plan's
 * symbols do not. The faces are drawn in the test: a flat neutral panel with grooves, glass mirroring sky and leaves,
 * timber, from the measured tones of published drawings; the rule never fires on width alone.
 */
import { describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-cv'
import { classifyOpeningFamily, openingFace } from '../src/v2/opening-reading.js'
import type { OpeningFamilyFacts, OpeningSymbols } from '../src/v2/opening-reading.js'

const W = 200
const H = 160
function face(kind: 'panel' | 'glass' | 'timber'): Raster {
  const data = new Uint8ClampedArray(W * H * 4)
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const o = (y * W + x) * 4
      let c: [number, number, number]
      if (kind === 'panel') c = y % 30 < 2 ? [60, 62, 66] : [88, 90, 94] // sections and their grooves, one tone along a row
      else if (kind === 'glass') c = (x * 7 + y * 3) % 50 < 20 ? [70, 96, 74] : [150, 166, 182] // sky and leaves mirrored, as drawn
      else c = [180 + ((x * 13) % 20), 120, 70] // timber
      data.set([...c, 255], o)
    }
  }
  return { width: W, height: H, data }
}
const symbols = (): OpeningSymbols => ({ glazed: () => true, leaf: () => undefined, leaves: () => undefined, swingDrawn: () => false }) as unknown as OpeningSymbols
const facts = (o: Partial<OpeningFamilyFacts>): OpeningFamilyFacts => ({ storeyIndex: 0, widthM: 2.5, sillAboveFloorM: 0, heightM: 2.3, heightsAssumed: false, doorBySymbol: false, doorSwing: false, attachedSingleStorey: false, symbols: symbols(), ...o })
const box = { x0: 0, y0: 0, x1: W - 1, y1: H - 1 }

describe('the face of an opening on the elevation', () => {
  it('tells a flat neutral panel, glass and timber apart', () => {
    expect(openingFace(face('panel'), box)?.kind).toBe('OPAQUE_PANEL')
    expect(openingFace(face('glass'), box)?.kind).toBe('GLAZED')
    expect(openingFace(face('timber'), box)?.kind).toBe('CLAD')
  })
  it('a box too small to read gives no face', () => {
    expect(openingFace(face('panel'), { x0: 0, y0: 0, x1: 5, y1: 5 })).toBeUndefined()
  })
})

describe('a vehicle door by its face', () => {
  const panel = openingFace(face('panel'), box)
  const glass = openingFace(face('glass'), box)
  it('a wide opening to the floor with a flat panel face, in a house with a stated garage, is a garage door', () => {
    const d = classifyOpeningFamily(facts({ face: panel, garageStated: true }))
    expect(d.family).toBe('GARAGE_DOOR')
    expect(d.provenance).toBe('VISUAL_SEMANTIC')
  })
  it('never without a stated garage, never with a glass face, never above the ground storey, never on width alone', () => {
    expect(classifyOpeningFamily(facts({ face: panel })).family).not.toBe('GARAGE_DOOR')
    expect(classifyOpeningFamily(facts({ face: glass, garageStated: true })).family).not.toBe('GARAGE_DOOR')
    expect(classifyOpeningFamily(facts({ face: panel, garageStated: true, storeyIndex: 1 })).family).not.toBe('GARAGE_DOOR')
    expect(classifyOpeningFamily(facts({ garageStated: true })).family).not.toBe('GARAGE_DOOR')
    expect(classifyOpeningFamily(facts({ face: panel, garageStated: true, heightM: 3.5 })).family).not.toBe('GARAGE_DOOR')
  })
})

describe('a door leaf by its face', () => {
  it('a door-sized opening to the floor with an opaque or timber face is a door, though the plan draws lines across it', () => {
    expect(classifyOpeningFamily(facts({ widthM: 1.1, heightM: 2.1, face: openingFace(face('panel'), box) })).family).toBe('DOOR')
    expect(classifyOpeningFamily(facts({ widthM: 1.1, heightM: 2.1, face: openingFace(face('timber'), box) })).family).toBe('DOOR')
  })
  it('with a glass face it stays what the plan says (a floor-length window here)', () => {
    expect(classifyOpeningFamily(facts({ widthM: 1.1, heightM: 2.1, face: openingFace(face('glass'), box) })).family).toBe('WINDOW')
  })
})
