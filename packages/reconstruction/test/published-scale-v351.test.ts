/**
 * v3.51 ANY-LINK: the last-resort plan scale from the figures a page publishes (`published-scale.ts`) — the footprint
 * area, or the building's two plan dimensions. The whole path is measured on real pages
 * (research/source-to-model/ANYLINK-SET.json and the corpus replays); here, on a drawn sheet whose answer is known:
 * what it finds, and what it must never do — answer without a figure, without a readable sheet, from an outline that
 * is not the building, or against the page's other figure.
 */
import { describe, expect, it } from 'vitest'
import type { PixelRect } from '@buildapp/source-common'
import type { SourceCoordinateFrame } from '@buildapp/source-observations'
import { PUBLISHED_EXTENT_PROVENANCE, PUBLISHED_SCALE_PROVENANCE, scaleFromPublishedExtent, scaleFromPublishedFootprint } from '../src/v2/published-scale.js'
import type { PublishedScaleRefusal } from '../src/v2/published-scale.js'
import { PLAUSIBLE_WALL_M, wallCoverageOf, wallThicknessPlausible } from '../src/plan-resolution.js'
import { planSheet } from '../src/layout.js'
import type { StructuralPassOptions } from '../src/structural.js'
import { graphOf, metricsOf, partition, planFrame, sheet, walls } from './plan.js'

const frame = planFrame('frame-plan', 'GROUND', { width: 800, height: 600 })
const options = (raster: StructuralPassOptions['raster']): StructuralPassOptions =>
  ({ slug: 'test', sourcePackageId: 'src-test', sourcePackageHash: 'd'.repeat(64), graph: graphOf([frame]), metrics: metricsOf([], []), raster, levels: { floors: [0], heights: [2.8], evidenceIds: [], measured: false } }) as unknown as StructuralPassOptions

/**
 * One rectangular house: outer faces 600 px by 400 px, walls 12 px, two partitions, no dimension printed anywhere.
 * At 2.5 cm/px it is 15.0 m by 10.0 m, 150 m², with 30 cm walls.
 */
const house = (): StructuralPassOptions['raster'] => {
  const r = sheet(800, 600)
  walls(r, 100, 100, 700, 500)
  partition(r, 400, 100, 405, 500)
  partition(r, 100, 300, 400, 305)
  return () => r
}
const TRUE_CM_PER_PX = 2.5

describe('with no figure or no readable sheet there is no scale', () => {
  it('no published area, or an implausible one', () => {
    expect(scaleFromPublishedFootprint(options(() => undefined), frame, 0)).toBeUndefined()
    expect(scaleFromPublishedFootprint(options(() => undefined), frame, 8)).toBeUndefined()
    expect(scaleFromPublishedExtent(options(() => undefined), frame, 0, 10)).toBeUndefined()
    expect(scaleFromPublishedExtent(options(() => undefined), frame, 2, 2)).toBeUndefined()
  })
  it('a sheet whose pixels cannot be read (the figure alone states nothing)', () => {
    expect(scaleFromPublishedFootprint(options(() => undefined), frame, 120)).toBeUndefined()
    expect(scaleFromPublishedExtent(options(() => undefined), frame, 15, 10)).toBeUndefined()
  })
  it('the provenance names the reconstruction, not a reader of printed dimensions', () => {
    expect(PUBLISHED_SCALE_PROVENANCE).toMatch(/^reconstruction\.published-footprint-scale@/)
    expect(PUBLISHED_EXTENT_PROVENANCE).toMatch(/^reconstruction\.published-extent-scale@/)
  })
})

describe('the building’s two published dimensions set the scale its outline has them at', () => {
  it('finds the scale of the drawn house, whichever way round the page gives the figures', () => {
    for (const [a, b] of [[15, 10], [10, 15]] as const) {
      const outcome = scaleFromPublishedExtent(options(house()), frame, a, b)
      expect(outcome?.basis).toBe('PLAN_EXTENT')
      expect(Math.abs((outcome?.cmPerPx ?? 0) / TRUE_CM_PER_PX - 1)).toBeLessThan(0.03)
      expect(outcome?.publishedExtentM).toEqual([15, 10])
      expect(Math.abs((outcome?.outlineExtentM?.[0] ?? 0) / 15 - 1)).toBeLessThan(0.02)
      expect(Math.abs((outcome?.outlineExtentM?.[1] ?? 0) / 10 - 1)).toBeLessThan(0.02)
      // an approximation, and marked one where it is stored
      const reg = outcome?.metrics.coordinateRegistrations.find((r) => r.frameId === frame.id)
      expect(reg?.anchors).toEqual([])
      expect(reg?.confidence).toBeLessThan(0.5)
      expect(reg?.note).toMatch(/^APPROXIMATE/)
    }
  })

  it('counter-case: figures whose sides ask for two scales describe something this outline is not', () => {
    const refusals: PublishedScaleRefusal[] = []
    expect(scaleFromPublishedExtent(options(house()), frame, 15, 6, { refusals })).toBeUndefined()
    expect(refusals).toContain('SIDES_DISAGREE')
  })

  it('counter-case: the page’s footprint must be met at the same scale — three figures, one scale', () => {
    const refusals: PublishedScaleRefusal[] = []
    expect(scaleFromPublishedExtent(options(house()), frame, 15, 10, { footprintM2: 300, refusals })).toBeUndefined()
    expect(refusals).toContain('OTHER_PUBLISHED_FIGURE_DISAGREES')
    expect(scaleFromPublishedExtent(options(house()), frame, 15, 10, { footprintM2: 150 })?.basis).toBe('PLAN_EXTENT')
  })

  it('counter-case: a scale at which the drawn walls are not walls is refused', () => {
    // 6.6 m by 4.4 m asks for 1.1 cm/px: the 12 px walls would be 13 cm thick
    const refusals: PublishedScaleRefusal[] = []
    expect(scaleFromPublishedExtent(options(house()), frame, 6.6, 4.4, { refusals })).toBeUndefined()
    expect(refusals).toContain('WALL_THICKNESS_IMPLAUSIBLE')
    // the same through the footprint: 29 m² asks for the same 1.1 cm/px
    const byArea: PublishedScaleRefusal[] = []
    expect(scaleFromPublishedFootprint(options(house()), frame, 29, { refusals: byArea })).toBeUndefined()
    expect(byArea).toContain('WALL_THICKNESS_IMPLAUSIBLE')
  })
})

describe('the published footprint sets the scale only of an outline that is the building', () => {
  it('finds the scale of the drawn house', () => {
    const outcome = scaleFromPublishedFootprint(options(house()), frame, 150)
    expect(outcome?.basis).toBe('FOOTPRINT_AREA')
    expect(Math.abs((outcome?.cmPerPx ?? 0) / TRUE_CM_PER_PX - 1)).toBeLessThan(0.03)
  })

  it('counter-case: an area that meets the page’s footprint but not its two dimensions sets no scale', () => {
    // 20 m by 7.5 m is also 150 m²: the area agrees, the house is another shape
    const refusals: PublishedScaleRefusal[] = []
    expect(scaleFromPublishedFootprint(options(house()), frame, 150, { extentM: [20, 7.5], refusals })).toBeUndefined()
    expect(refusals).toContain('OTHER_PUBLISHED_FIGURE_DISAGREES')
    expect(scaleFromPublishedFootprint(options(house()), frame, 150, { extentM: [10, 15] })?.outlineExtentM?.[0]).toBeGreaterThan(14.5)
  })

  it('counter-case: an area so large that the drawn walls would be over 70 cm thick is refused', () => {
    // 1500 m² asks for about 7.9 cm/px: the 12 px walls would be 95 cm
    const refusals: PublishedScaleRefusal[] = []
    expect(scaleFromPublishedFootprint(options(house()), frame, 1500, { refusals })).toBeUndefined()
    expect(refusals).toContain('WALL_THICKNESS_IMPLAUSIBLE')
  })
})

describe('what makes a reading the building', () => {
  it('a wall is between 15 cm and 70 cm thick', () => {
    expect(wallThicknessPlausible(PLAUSIBLE_WALL_M.min)).toBe(true)
    expect(wallThicknessPlausible(0.3)).toBe(true)
    expect(wallThicknessPlausible(0.08)).toBe(false)
    expect(wallThicknessPlausible(0.95)).toBe(false)
  })

  it('bodies that leave most of the sheet’s walls outside do not explain it', () => {
    const plan = planSheet(frame, options(house()))
    expect(plan).toBeDefined()
    const whole: PixelRect = { x0: 100, y0: 100, x1: 700, y1: 500 }
    const corner: PixelRect = { x0: 100, y0: 100, x1: 250, y1: 220 }
    expect(wallCoverageOf(plan!, whole, [whole])).toBeGreaterThan(0.9)
    expect(wallCoverageOf(plan!, whole, [corner])).toBeLessThan(0.5)
    expect(wallCoverageOf(plan!, whole, [])).toBe(0)
  })
})
