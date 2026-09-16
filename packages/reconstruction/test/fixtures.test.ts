/**
 * §25's three synthetic fixtures, reconstructed end to end.
 *
 * Each of them exists to make one WRONG reading attractive:
 *
 *  A — LARCHFIELD, a plain two-storey gable house. One box IS the answer here,
 *      and a reader that has learnt to split things must not split this.
 *  B — HOLLOWAY, a main body with a one-storey garage attached under a flat
 *      roof of its own. The bounding rectangle is 23 m² larger than the
 *      building, the upper plan covers only the house, and no single roof over
 *      the whole box can be right.
 *  C — REDMIRE, a footprint that steps at the first floor with a loggia bitten
 *      out of the ground-floor front. The outline is not the building and the
 *      two storeys cannot share a ring.
 *
 * Each is also drawn four more ways — at another scale, with the line work
 * drawn twice as heavy, cropped close, and covered in room names, areas and
 * furniture — and the TOPOLOGY has to survive all four. The dimensions are
 * allowed to move a centimetre or two; the number of bodies, which storeys
 * they reach and what is over them are not.
 */
import { describe, expect, it } from 'vitest'
import { HOLLOWAY, LARCHFIELD, REDMIRE, overallWidth } from '@buildapp/synthetic-drawings'
import type { SheetOptions, SyntheticHouse } from '@buildapp/synthetic-drawings'
import { ringBounds } from '../src/index.js'
import type { ReconstructionResult } from '../src/index.js'
import { buildFixture, solve } from './pipeline.js'

const run = async (house: SyntheticHouse, options: SheetOptions = {}): Promise<ReconstructionResult> => solve(await buildFixture(house, options))

const sizeOf = (result: ReconstructionResult, massId: string): [number, number] => {
  const mass = result.layout.masses.find((m) => m.id === massId)
  if (!mass) throw new Error(`no ${massId}`)
  const b = ringBounds(mass.ring)
  return [Number((b.x1 - b.x0).toFixed(2)), Number((b.z1 - b.z0).toFixed(2))]
}

/** What the topology IS, as a string, so a perturbation that changes it fails loudly. */
const topologyOf = (result: ReconstructionResult): string =>
  result.layout.masses
    .map((mass) => {
      const b = ringBounds(mass.ring)
      const roof = result.layout.roofSupports.find((r) => r.massId === mass.id)
      return `${mass.role} ${(b.x1 - b.x0).toFixed(1)}x${(b.z1 - b.z0).toFixed(1)} storeys ${mass.storeySpan.fromIndex}-${mass.storeySpan.toIndex} roof ${roof?.kind ?? 'NONE'}`
    })
    .sort()
    .join(' | ')

const PERTURBATIONS: Array<{ name: string; options: SheetOptions }> = [
  { name: 'drawn at another scale', options: { pixelsPerMetre: 30 } },
  { name: 'with the line work drawn heavy', options: { lineWeight: 2 } },
  { name: 'cropped close to the drawing', options: { margin: 92 } },
  { name: 'covered in room names, areas and furniture', options: { clutter: 0.8 } },
]

// ---------------------------------------------------------------------------
// A — a rectangular two-storey gable house
// ---------------------------------------------------------------------------

const LARCH = await run(LARCHFIELD)
const HOLL = await run(HOLLOWAY)
const RED = await run(REDMIRE)

describe('fixture A: a rectangular two-storey gable house', () => {
  const result = LARCH

  it('finds exactly one body, because one body is the truth', () => {
    expect(result.layout.masses).toHaveLength(1)
    expect(sizeOf(result, 'mass-0')).toEqual([LARCHFIELD.width, LARCHFIELD.depth])
  })

  it('carries that body up through both storeys', () => {
    const mass = result.layout.masses[0]
    expect(mass.storeySpan.fromIndex).toBe(0)
    expect(mass.storeySpan.toIndex).toBe(1)
    expect(result.layout.storeys).toHaveLength(2)
  })

  it('puts one gable roof over it at the pitch the section measures', () => {
    expect(result.layout.roofSupports).toHaveLength(1)
    const roof = result.layout.roofSupports[0]
    expect(roof.kind).toBe('GABLE')
    expect(Math.abs((roof.pitchDeg?.value ?? 0) - LARCHFIELD.roof.pitchDeg)).toBeLessThan(1)
    expect(roof.ridgeAxis).toBe(LARCHFIELD.roof.ridgeAxis)
  })

  it('accepts the layout', () => {
    expect(result.layout.gate.status).toBe('STRUCTURAL_LAYOUT_ACCEPTED')
  })

  for (const perturbation of PERTURBATIONS) {
    it(`reads the same building ${perturbation.name}`, async () => {
      const other = await run(LARCHFIELD, perturbation.options)
      expect(topologyOf(other)).toBe(topologyOf(result))
    })
  }
})

// ---------------------------------------------------------------------------
// B — a main body with a one-storey attached garage under its own roof
// ---------------------------------------------------------------------------

describe('fixture B: a main body with an attached one-storey garage', () => {
  const result = HOLL
  const garage = HOLLOWAY.wings![0]

  it('finds two bodies rather than the rectangle around them', () => {
    expect(result.layout.masses).toHaveLength(2)
    expect(sizeOf(result, 'mass-0')).toEqual([HOLLOWAY.width, HOLLOWAY.depth])
    expect(sizeOf(result, 'mass-1')).toEqual([garage.width, garage.depth])
    // The bounding rectangle would be this much bigger than the building.
    const covered = HOLLOWAY.width * HOLLOWAY.depth + garage.width * garage.depth
    expect(overallWidth(HOLLOWAY) * HOLLOWAY.depth - covered).toBeGreaterThan(15)
  })

  it('names the garage as attached to the house and sharing its wall', () => {
    expect(result.layout.masses.find((m) => m.id === 'mass-0')?.role).toBe('MAIN')
    expect(result.layout.masses.find((m) => m.id === 'mass-1')?.role).toBe('ATTACHED')
    const kinds = result.layout.attachments.map((a) => a.kind).sort()
    expect(kinds).toContain('ATTACHED_TO')
    expect(kinds).toContain('SHARES_WALL_WITH')
    const shared = result.layout.attachments.find((a) => a.kind === 'SHARES_WALL_WITH')
    expect(shared?.contact?.axis).toBe('X')
    expect(shared?.contact?.at).toBeCloseTo(HOLLOWAY.width, 1)
  })

  it('stops the garage at the ground floor and does not give it an upper ring', () => {
    const house = result.layout.masses.find((m) => m.id === 'mass-0')!
    const wing = result.layout.masses.find((m) => m.id === 'mass-1')!
    expect(house.storeySpan.toIndex).toBe(1)
    expect(wing.storeySpan.fromIndex).toBe(0)
    expect(wing.storeySpan.toIndex).toBe(0)
    // §6: the upper storey's footprint covers the house and nothing else.
    const upper = result.layout.footprintRegions.filter((r) => r.storeyId === 'storey-1')
    expect(upper).toHaveLength(1)
    expect(ringBounds(upper[0].ring).x1).toBeCloseTo(HOLLOWAY.width, 1)
  })

  it('puts a separate roof over each body, and not one roof over both', () => {
    expect(result.layout.roofSupports).toHaveLength(2)
    const main = result.layout.roofSupports.find((r) => r.massId === 'mass-0')!
    const wing = result.layout.roofSupports.find((r) => r.massId === 'mass-1')!
    expect(main.kind).toBe('GABLE')
    expect(wing.kind).toBe('FLAT')
    expect(Math.abs((main.pitchDeg?.value ?? 0) - HOLLOWAY.roof.pitchDeg)).toBeLessThan(1)
    // The main roof covers the house only.
    expect(ringBounds(main.ring).x1).toBeCloseTo(HOLLOWAY.width, 1)
    expect(result.model.roofs).toHaveLength(2)
  })

  it('says in as many words that the garage roof is a convention and not a reading', () => {
    const wing = result.layout.roofSupports.find((r) => r.massId === 'mass-1')!
    expect(wing.authority).toBe('CONVENTION')
    expect(result.layout.unresolved.some((u) => u.what.includes('roof over mass-1'))).toBe(true)
  })

  it('accepts the layout', () => {
    expect(result.layout.gate.status).toBe('STRUCTURAL_LAYOUT_ACCEPTED')
  })

  for (const perturbation of PERTURBATIONS) {
    it(`reads the same two bodies ${perturbation.name}`, async () => {
      const other = await run(HOLLOWAY, perturbation.options)
      expect(topologyOf(other)).toBe(topologyOf(result))
    })
  }
})

// ---------------------------------------------------------------------------
// C — a stepped footprint with a loggia
// ---------------------------------------------------------------------------

describe('fixture C: a stepped footprint with a loggia bitten out of the front', () => {
  const result = RED
  const loggia = REDMIRE.recesses![0]

  it('finds one body the size of the whole footprint, not three rectangles', () => {
    expect(result.layout.masses).toHaveLength(1)
    expect(sizeOf(result, 'mass-0')).toEqual([REDMIRE.width, REDMIRE.depth])
  })

  it('reads the loggia as topology: a mouth, a back and two returns', () => {
    expect(result.layout.recesses).toHaveLength(1)
    const recess = result.layout.recesses[0]
    expect(recess.massId).toBe('mass-0')
    expect(recess.mouthSide).toBe('MAX_Z')
    expect(recess.mouth.at).toBeCloseTo(REDMIRE.depth, 1)
    // The pocket is measured between the AXES of the walls that bound it, the
    // way every grid line on the plan is, so it comes out half a wall narrower
    // and half a wall shallower than the hole drawn between their faces.
    const half = REDMIRE.wallThickness / 2
    expect(recess.mouth.to - recess.mouth.from).toBeCloseTo(loggia.width - REDMIRE.wallThickness, 1)
    expect(recess.depthM.value).toBeCloseTo(loggia.depth + half, 1)
    expect(recess.returns).toEqual({ low: true, high: true })
    // Where the mouth is: `at` counts from the far end of the front wall.
    expect(recess.mouth.from).toBeCloseTo(REDMIRE.width - loggia.at - loggia.width + half, 1)
  })

  it('does not build the loggia as a solid hung on the facade', () => {
    const solids = result.model.linearSolids ?? []
    expect(solids.length).toBeLessThan(3)
    for (const solid of solids) expect(solid.depth).toBeLessThan(loggia.depth)
  })

  it('steps the upper storey back from the rear wall, as its own plan draws it', () => {
    const upper = result.layout.footprintRegions.filter((r) => r.storeyId === 'storey-1')
    expect(upper).toHaveLength(1)
    const b = ringBounds(upper[0].ring)
    expect(b.z0).toBeCloseTo(REDMIRE.upperInset!.minZ!, 1)
    expect(b.z1).toBeCloseTo(REDMIRE.depth, 1)
    expect(b.x1 - b.x0).toBeCloseTo(REDMIRE.width, 1)
  })

  it('puts one gable over the body at the pitch the section measures', () => {
    expect(result.layout.roofSupports).toHaveLength(1)
    const roof = result.layout.roofSupports[0]
    expect(roof.kind).toBe('GABLE')
    expect(Math.abs((roof.pitchDeg?.value ?? 0) - REDMIRE.roof.pitchDeg)).toBeLessThan(1)
  })

  it('accepts the layout', () => {
    expect(result.layout.gate.status).toBe('STRUCTURAL_LAYOUT_ACCEPTED')
  })

  for (const perturbation of PERTURBATIONS) {
    it(`reads the same body and the same loggia ${perturbation.name}`, async () => {
      const other = await run(REDMIRE, perturbation.options)
      expect(topologyOf(other)).toBe(topologyOf(result))
      expect(other.layout.recesses).toHaveLength(1)
    })
  }
})
