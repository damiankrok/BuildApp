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
function face(kind: 'panel' | 'glass' | 'timber' | 'blind'): Raster {
  const data = new Uint8ClampedArray(W * H * 4)
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const o = (y * W + x) * 4
      let c: [number, number, number]
      if (kind === 'panel') c = y % 30 < 2 ? [60, 62, 66] : [88, 90, 94] // sections and their grooves, one tone along a row
      else if (kind === 'glass') c = (x * 7 + y * 3) % 50 < 20 ? [70, 96, 74] : [150, 166, 182] // sky and leaves mirrored, as drawn
      else if (kind === 'blind') c = y % 8 === 0 ? [128, 128, 130] : Math.floor(y / 3) % 2 === 0 ? [212, 216, 222] : [88, 94, 100] // glass behind a striped blind
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
  it('glass behind a striped blind is flat along each row but not one tone down it: no panel', () => {
    const blind = openingFace(face('blind'), box)
    expect(blind?.kind).not.toBe('OPAQUE_PANEL')
    expect(blind?.toneChangesPerRow).toBeGreaterThan(0.12)
    expect(openingFace(face('panel'), box)?.toneChangesPerRow).toBeLessThanOrEqual(0.12)
  })
  it('a shadow under the lintel across the top of a panel is one run at its edge, not a slat: still a panel', () => {
    const shaded = face('panel')
    // the wall above the head (white), a frame line, then the lintel's shadow fading into the panel
    for (let y = 0; y < 50; y += 1) for (let x = 0; x < W; x += 1) shaded.data.set(y < 22 ? [250, 250, 250, 255] : y === 22 ? [100, 100, 100, 255] : [45 + y / 2, 47 + y / 2, 49 + y / 2, 255], (y * W + x) * 4)
    expect(openingFace(shaded, box)?.kind).toBe('OPAQUE_PANEL')
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

describe('EXTERIOR-COMPLETE: a vehicle door is one panel across its whole width', () => {
  // Muraje's garden elevation: the plan's 5.21 m span on that wall is a stretch of flat grey wall and a large glazing;
  // read whole, the wall alone made the face opaque and a sectional gate was built over the terrace glazing.
  it('a flat panel with a glazing at one end reads opaque as a whole, but not across its width: no vehicle door', () => {
    const r = face('panel')
    const g = face('glass')
    for (let y = 0; y < H; y += 1) for (let x = Math.round(W * 0.8); x < W; x += 1) r.data.set(g.data.subarray((y * W + x) * 4, (y * W + x) * 4 + 4), (y * W + x) * 4)
    const f = openingFace(r, box)
    expect(f?.kind).toBe('OPAQUE_PANEL')
    expect(f?.acrossOpaque).toBe(false)
    expect(classifyOpeningFamily(facts({ face: f, garageStated: true, widthM: 5.2 })).family).not.toBe('GARAGE_DOOR')
  })
  it('one even panel is one across its width, and is the garage door', () => {
    const f = openingFace(face('panel'), box)
    expect(f?.acrossOpaque).toBe(true)
    expect(classifyOpeningFamily(facts({ face: f, garageStated: true })).family).toBe('GARAGE_DOOR')
  })
})


describe('v3.45 a garage room’s wall says vehicle door in any body', () => {
  const garageRoom = { why: 'room-0-0, numbered 7 = Garaż on the publisher’s list' }
  it('a 2.75 m opening to the floor in the main body’s wall of a garage room is its garage door', () => {
    const d = classifyOpeningFamily(facts({ widthM: 2.75, heightM: 2.25, garageRoom }))
    expect(d.family).toBe('GARAGE_DOOR')
    expect(d.notes.join(' ')).toMatch(/garage's wall/)
  })
  it('never above the ground storey, never narrower than a vehicle door, never taller than one, never with a sill', () => {
    expect(classifyOpeningFamily(facts({ widthM: 2.75, heightM: 2.25, garageRoom, storeyIndex: 1 })).family).not.toBe('GARAGE_DOOR')
    expect(classifyOpeningFamily(facts({ widthM: 1.0, heightM: 2.1, garageRoom })).family).toBe('DOOR')
    expect(classifyOpeningFamily(facts({ widthM: 2.75, heightM: 3.5, garageRoom })).family).not.toBe('GARAGE_DOOR')
    expect(classifyOpeningFamily(facts({ widthM: 2.75, heightM: 1.2, sillAboveFloorM: 1.0, garageRoom })).family).not.toBe('GARAGE_DOOR')
  })
  it('without the garage room, the main body’s wide opening to the floor stays glazing; an opaque face alone decides only in a low attached body', () => {
    const panel = openingFace(face('panel'), box)
    expect(classifyOpeningFamily(facts({ widthM: 2.75, heightM: 2.25 })).family).toBe('MULTI_PANEL_GLAZING')
    expect(classifyOpeningFamily(facts({ widthM: 2.75, heightM: 2.25, face: panel })).family).not.toBe('GARAGE_DOOR')
    expect(classifyOpeningFamily(facts({ widthM: 2.75, heightM: 2.25, face: panel, attachedSingleStorey: true })).family).toBe('GARAGE_DOOR')
  })
})
