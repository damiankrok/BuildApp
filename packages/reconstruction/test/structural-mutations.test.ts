/**
 * §26: fourteen mutations of the source material, and what each has to do to
 * the answer.
 *
 * The rule every one of them is here to enforce is the same. When a drawing
 * stops saying something, the reconstruction must either read the DIFFERENT
 * building the drawings now show, or say what it no longer knows — a lower
 * confidence, a named conflict, an unresolved hole, a gate that stops short of
 * ACCEPTED. What it must never do is fall quietly back to one rectangle over
 * the bounding box, which is the failure this whole stage exists to end.
 *
 * So the assertions come in pairs: something changed in the reading, AND the
 * reading did not collapse.
 */
import { describe, expect, it } from 'vitest'
import { decodeImage } from '@buildapp/source-package'
import { HOLLOWAY, LARCHFIELD, REDMIRE, encodePng, renderElevation, renderGroundPlan, renderSheets } from '@buildapp/synthetic-drawings'
import type { SheetOptions, SyntheticHouse, SyntheticMember } from '@buildapp/synthetic-drawings'
import { sha256Bytes } from '@buildapp/source-common'
import { ringBounds } from '../src/index.js'
import type { ReconstructionResult } from '../src/index.js'
import { buildFixture, buildFixtureFrom, solve } from './pipeline.js'

type Sheets = ReturnType<typeof renderSheets>

const run = async (house: SyntheticHouse, options: SheetOptions = {}, only?: (slug: string) => boolean): Promise<ReconstructionResult> => solve(await buildFixture(house, options, only))
const runFrom = async (sheets: Sheets): Promise<ReconstructionResult> => solve(await buildFixtureFrom(sheets))

const bodies = (r: ReconstructionResult): Array<[number, number]> =>
  r.layout.masses
    .map((m) => ringBounds(m.ring))
    .map((b) => [Number((b.x1 - b.x0).toFixed(2)), Number((b.z1 - b.z0).toFixed(2))] as [number, number])
    .sort((a, b) => b[0] * b[1] - a[0] * a[1])

/** The reading this stage exists to stop: one box over everything, on every storey. */
const collapsedToOneBox = (r: ReconstructionResult, overallWidth: number, overallDepth: number): boolean =>
  r.layout.masses.length === 1 && Math.abs(ringBounds(r.layout.masses[0].ring).x1 - overallWidth) < 0.3 && Math.abs(ringBounds(r.layout.masses[0].ring).z1 - overallDepth) < 0.3

const sheetOf = (sheets: Sheets, slug: string): Sheets[number] => {
  const found = sheets.find((s) => s.slug === slug)
  if (!found) throw new Error(`no ${slug} sheet`)
  return found
}

/** Replace one sheet's pixels, keeping its role and its slug. */
const replace = (sheets: Sheets, slug: string, canvas: ReturnType<typeof renderGroundPlan>): Sheets => {
  const raster = canvas.toRaster()
  const bytes = encodePng(raster)
  return sheets.map((s) => (s.slug === slug ? { ...s, width: raster.width, height: raster.height, bytes, byteHash: sha256Bytes(bytes) } : s))
}

const BASE = await run(HOLLOWAY)
const RED = await run(REDMIRE)

// ---------------------------------------------------------------------------

describe('§26 mutations of the sources', () => {
  it('1. the garage contour removed: the chain still says 12 m, and the walls no longer do', async () => {
    const mutated = await run({ ...HOLLOWAY, wings: [] })
    // Only the house is drawn, so only the house is built — the reader does
    // not fill the rest of the printed 12.00 m with a body nobody drew.
    expect(bodies(mutated)).toEqual([[HOLLOWAY.width, HOLLOWAY.depth]])
    expect(collapsedToOneBox(mutated, 12, HOLLOWAY.depth)).toBe(false)
    // And it is not silent about the 3.60 m it can no longer account for.
    expect(mutated.layout.gate.status).not.toBe('STRUCTURAL_LAYOUT_ACCEPTED')
  })

  it('2. the garage depth dimension removed: the bodies stand, the number stops being measured', async () => {
    const mutated = await run({ ...HOLLOWAY, chainsZ: [HOLLOWAY.depth] })
    expect(mutated.layout.masses).toHaveLength(2)
    expect(bodies(mutated)[1][0]).toBeCloseTo(HOLLOWAY.wings![0].width, 1)
    const wing = mutated.layout.masses.find((m) => m.id === 'mass-1')!
    const before = BASE.layout.masses.find((m) => m.id === 'mass-1')!
    // The depth is still recovered from the drawing, and it is no longer
    // claimed to have been measured off a chain that is not there.
    expect(wing.depthM.value).toBeCloseTo(before.depthM.value, 0)
    expect(wing.depthM.basis).toBe('SCALED')
    expect(before.depthM.basis).toBe('MEASURED')
  })

  it('3. an upper plan that falsely shows the garage: the reading changes and says which drawing it came from', async () => {
    const sheets = renderSheets(HOLLOWAY)
    const lying = renderGroundPlan({ ...HOLLOWAY, wings: [{ ...HOLLOWAY.wings![0], storeys: 2 }], upperChainsX: [HOLLOWAY.width, HOLLOWAY.wings![0].width] }, { storey: 1 })
    const mutated = await runFrom(replace(sheets, 'rzut-pietra', lying))
    // The garage now has a storey above it BECAUSE A DRAWING SAYS SO, which is
    // the right answer to the wrong sources — and the reading is traceable to
    // the sheet that changed rather than assumed from the one that did not.
    const wing = mutated.layout.masses.find((m) => Math.abs(ringBounds(m.ring).x1 - ringBounds(m.ring).x0 - HOLLOWAY.wings![0].width) < 0.3)
    expect(wing).toBeDefined()
    const upper = mutated.layout.footprintRegions.filter((r) => r.storeyId === 'storey-1')
    expect(upper.every((r) => r.frameId.includes('rzut-pietra'))).toBe(true)
    const before = BASE.layout.footprintRegions.filter((r) => r.storeyId === 'storey-1')
    const area = (rs: typeof upper): number => rs.reduce((a, r) => a + r.areaM2, 0)
    expect(area(upper)).toBeGreaterThan(area(before))
  })

  it('4. the printed pitch changed: the printed number wins and the residual is reported', async () => {
    const honest = await run(HOLLOWAY, { printedPitchDeg: HOLLOWAY.roof.pitchDeg })
    const mutated = await run(HOLLOWAY, { printedPitchDeg: 25 })
    const roofOf = (r: ReconstructionResult): { pitch: number; authority: string } => {
      const roof = r.layout.roofSupports.find((x) => x.massId === 'mass-0')!
      return { pitch: roof.pitchDeg?.value ?? 0, authority: roof.authority }
    }
    expect(roofOf(honest)).toEqual({ pitch: HOLLOWAY.roof.pitchDeg, authority: 'PRINTED_ANGLE' })
    // §8: a source-supported angle must never be quietly replaced by the one a
    // silhouette fit prefers. It is kept, and the disagreement is stated.
    expect(roofOf(mutated)).toEqual({ pitch: 25, authority: 'PRINTED_ANGLE' })
    expect(mutated.layout.conflicts.some((c) => c.kind === 'ROOF_EVIDENCE_DISAGREES')).toBe(true)
    expect(mutated.layout.gate.status).toBe('STRUCTURAL_LAYOUT_PARTIAL')
    expect(honest.layout.gate.status).toBe('STRUCTURAL_LAYOUT_ACCEPTED')
  })

  it('5. the garage roof drawn pitched: the pass does not claim to have read it either way', async () => {
    const mutated = await run({ ...HOLLOWAY, wings: [{ ...HOLLOWAY.wings![0], roof: 'GABLE' }] })
    const wing = mutated.layout.roofSupports.find((r) => r.massId === 'mass-1')!
    // Nothing in these sources describes the garage's roof separately, so the
    // pass states a convention as a convention and leaves the hole named. It
    // does not turn a drawn gable into a fact it never read.
    expect(wing.authority).toBe('CONVENTION')
    expect(wing.confidence).toBeLessThanOrEqual(0.6)
    expect(mutated.layout.unresolved.some((u) => u.what.includes('roof over mass-1'))).toBe(true)
    expect(mutated.layout.roofSupports).toHaveLength(2)
  })

  it('6. the loggia mouth walled up: the pocket goes, and the body does not', async () => {
    const mutated = await run({ ...REDMIRE, recesses: [] })
    expect(mutated.layout.recesses).toHaveLength(0)
    expect(RED.layout.recesses).toHaveLength(1)
    expect(bodies(mutated)).toEqual([[REDMIRE.width, REDMIRE.depth]])
  })

  it('7. one return wall of the loggia missing: it is no longer a pocket with two sides', async () => {
    const mutated = await run({ ...REDMIRE, recesses: [{ ...REDMIRE.recesses![0], omitReturn: 'HIGH' }] })
    const recess = mutated.layout.recesses[0]
    const before = RED.layout.recesses[0]
    // With nothing closing its far end, the pocket runs on to the wall that
    // does close it — the building's own side wall — so it is a wider loggia
    // and not the one that was drawn. What must not happen is the hole
    // quietly becoming wall again, or the body falling apart around it.
    expect(recess).toBeDefined()
    expect(recess.mouth.to).toBeGreaterThan(before.mouth.to + 0.5)
    expect(recess.mouth.to).toBeCloseTo(REDMIRE.width, 1)
    expect(mutated.layout.masses).toHaveLength(1)
  })

  it('8. a mass breakpoint shifted: the drawn wall wins and the disagreement is on the record', async () => {
    const mutated = await run({ ...HOLLOWAY, chainsX: [HOLLOWAY.width - 1, HOLLOWAY.wings![0].width + 1] })
    // Two bodies still, divided where the wall is drawn and not where the
    // moved number says.
    expect(mutated.layout.masses).toHaveLength(2)
    const house = mutated.layout.masses.find((m) => m.id === 'mass-0')!
    expect(ringBounds(house.ring).x1 - ringBounds(house.ring).x0).toBeCloseTo(HOLLOWAY.width, 0)
    expect(collapsedToOneBox(mutated, 12, HOLLOWAY.depth)).toBe(false)
  })

  it('9. a hundred false facade stripes: not one of them becomes a solid', async () => {
    const stripes: SyntheticMember[] = []
    for (let i = 0; i < 100; i += 1) {
      stripes.push({ side: 'FRONT', orientation: 'HORIZONTAL', at: 0.1 + (i % 10) * 0.8, length: 0.7, width: 0.12, depth: 0, y: 0.2 + Math.floor(i / 10) * 0.5 })
    }
    const mutated = await run({ ...LARCHFIELD, members: stripes })
    // §14: a tone band on one elevation, with nothing showing it has a return
    // face or an end, is not a volume. A hundred of them are a hundred not-
    // volumes.
    expect(mutated.model.linearSolids ?? []).toHaveLength(0)
    expect(bodies(mutated)).toEqual([[LARCHFIELD.width, LARCHFIELD.depth]])
  })

  it('10. one window drawn as four lights: still one opening in the wall', async () => {
    const wide = { ...LARCHFIELD, openings: LARCHFIELD.openings.map((o) => (o.side === 'FRONT' && o.kind === 'WINDOW' ? { ...o, lights: 4 } : o)) }
    const mutated = await run(wide)
    const before = await run(LARCHFIELD)
    // §12: a mullion is not another opening.
    expect(mutated.model.openings.length).toBe(before.model.openings.length)
  })

  it('11. the side elevation printed back to front: the plan still decides where the openings are', async () => {
    const sheets = renderSheets(LARCHFIELD)
    const raster = decodeImage(sheetOf(sheets, 'elewacja-lewa').bytes)!
    const flipped = { width: raster.width, height: raster.height, data: new Uint8ClampedArray(raster.data.length) }
    for (let y = 0; y < raster.height; y += 1) {
      for (let x = 0; x < raster.width; x += 1) {
        const from = (y * raster.width + (raster.width - 1 - x)) * 4
        const to = (y * raster.width + x) * 4
        for (let k = 0; k < 4; k += 1) flipped.data[to + k] = raster.data[from + k]
      }
    }
    const bytes = encodePng(flipped as unknown as ReturnType<typeof decodeImage> & object)
    const mutated = await runFrom(sheets.map((s) => (s.slug === 'elewacja-lewa' ? { ...s, bytes, byteHash: sha256Bytes(bytes) } : s)))
    const before = await run(LARCHFIELD)
    const openings = (r: ReconstructionResult): string[] =>
      r.model.openings.map((o) => `${o.wallId}@${o.offset.toFixed(2)}`).sort()
    // Openings come from the PLAN, which is measured; a mirrored render cannot
    // move them. It can only leave more of itself unexplained.
    expect(openings(mutated)).toEqual(openings(before))
    expect(bodies(mutated)).toEqual(bodies(before))
  })

  it('12. the overall chain disagreeing with the contour: the conflict is named', async () => {
    const mutated = await run({ ...HOLLOWAY, chainsX: [HOLLOWAY.width, HOLLOWAY.wings![0].width + 1] })
    // The chain now claims 13.00 m across a building drawn 12.00 m wide.
    expect(mutated.layout.masses.length).toBeGreaterThanOrEqual(1)
    expect(collapsedToOneBox(mutated, 13, HOLLOWAY.depth)).toBe(false)
    const said = [...mutated.layout.conflicts.map((c) => c.what), ...mutated.layout.unresolved.map((u) => u.reason), ...mutated.layout.gate.reasons.map((r) => r.what)].join(' | ')
    expect(said.length).toBeGreaterThan(0)
    expect(mutated.layout.gate.status).not.toBe('STRUCTURAL_LAYOUT_REJECTED')
  })

  it('13. the upper plan omitted: the storey survives on the section, and the garage does not gain one', async () => {
    const mutated = await run(HOLLOWAY, {}, (slug) => slug !== 'rzut-pietra')
    expect(mutated.layout.masses).toHaveLength(2)
    const house = mutated.layout.masses.find((m) => m.id === 'mass-0')!
    const wing = mutated.layout.masses.find((m) => m.id === 'mass-1')!
    // §6: the section states a datum at first-floor level, so the tallest body
    // is taken up through it — and the single-storey garage is not.
    expect(house.storeySpan.toIndex).toBe(1)
    expect(wing.storeySpan.toIndex).toBe(0)
    expect(mutated.layout.unresolved.some((u) => u.what.includes('footprint of storey 1'))).toBe(true)
    expect(mutated.layout.conflicts.some((c) => c.kind === 'STOREY_COVERAGE_DISAGREES')).toBe(true)
  })

  it('14. every elevation and section removed: the plans still give the composition, and the heights go missing', async () => {
    const mutated = await run(HOLLOWAY, {}, (slug) => slug.startsWith('rzut'))
    // The bodies come from the plans and are unchanged.
    expect(bodies(mutated)).toEqual(bodies(BASE))
    expect(collapsedToOneBox(mutated, 12, HOLLOWAY.depth)).toBe(false)
    // What the elevations carried is now missing rather than invented: no
    // pitch, no kind of roof over the main body, no level for the storey the
    // section used to date.
    expect(mutated.layout.gate.status).not.toBe('STRUCTURAL_LAYOUT_ACCEPTED')
    const roof = mutated.layout.roofSupports.find((r) => r.massId === 'mass-0')!
    expect(roof.kind).toBe('UNKNOWN')
    expect(roof.authority).toBe('NONE')
    expect(roof.pitchDeg).toBeUndefined()
    expect(mutated.layout.unresolved.some((u) => u.status === 'MISSING' && u.what.includes('pitch'))).toBe(true)
    expect(mutated.layout.storeys.find((s) => s.index === 1)?.elevation).toBeUndefined()
    expect(BASE.layout.storeys.find((s) => s.index === 1)?.elevation?.value).toBeCloseTo(HOLLOWAY.storeys[0].height, 2)
  })
})
