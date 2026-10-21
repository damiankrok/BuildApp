/**
 * BUILDPLAN-ANALYZER-005Y-N5 (C5): the second band pass holds the walls that run the length of the building. On a sheet
 * whose partitions outnumber its outer walls the typical thickness is a partition's; an outer wall a hair over 1.9 of it
 * (A01: 22 px against 11) used to fall out of the pass, and its side of the house stood on the next line inside.
 *  - counterfactual: a ring of 22 px walls among many long 10 px partitions keeps all four of its walls as bands;
 *  - negative: a short thick blot (not a wall running the building's length) does not widen the window.
 */
import { describe, expect, it } from 'vitest'
import { planSheet } from '../src/index.js'
import type { StructuralLayoutOptions } from '../src/index.js'
import { PlanDrawing, render } from './transforms.js'
import { graphOf, metricsOf, planFrame, registration } from './plan.js'

const FRAME = 'frame-plan'
const W = 760
const H = 520

function options(draw: (p: PlanDrawing) => void): { opts: StructuralLayoutOptions; frame: ReturnType<typeof planFrame> } {
  const p = new PlanDrawing(W, H).ring(60, 60, 660, 420, 22)
  // partitions: long and many, so the typical band is theirs
  for (const x of [140, 200, 260, 320, 380, 440, 500, 560]) p.wall(x, 82, x + 9, 398)
  for (const y of [150, 240, 330]) p.wall(82, y, 638, y + 9)
  draw(p)
  const raster = render(p, 'id')
  const frame = planFrame(FRAME, 'GROUND', { width: W, height: H })
  const opts: StructuralLayoutOptions = { slug: 'running-walls', sourcePackageId: 'src-test', sourcePackageHash: 'e'.repeat(64), graph: graphOf([frame]), metrics: metricsOf([], [{ ...registration(FRAME), frameId: FRAME }]), raster: () => raster }
  return { opts, frame }
}
const outerWalls = (bands: ReadonlyArray<{ axis: string; axisPx: number; thickness: number }>) =>
  bands.filter((b) => b.thickness >= 18 && ((b.axis === 'VERTICAL' && (Math.abs(b.axisPx - 70.5) <= 2 || Math.abs(b.axisPx - 649.5) <= 2)) || (b.axis === 'HORIZONTAL' && (Math.abs(b.axisPx - 70.5) <= 2 || Math.abs(b.axisPx - 409.5) <= 2))))

describe('005Y-N5 the walls that run the length of the building', () => {
  it('a ring of 22 px walls among many 10 px partitions keeps all four as bands', () => {
    const { opts, frame } = options(() => undefined)
    const sheet = planSheet(frame, opts)
    expect(sheet?.wallPx).toBeLessThanOrEqual(11)
    expect(outerWalls(sheet?.bands ?? []).length).toBe(4)
  })
  it('negative: a short thick blot does not widen the window — a 40 px block is no band', () => {
    const { opts, frame } = options((p) => p.wall(400, 100, 439, 140))
    const sheet = planSheet(frame, opts)
    expect((sheet?.bands ?? []).some((b) => b.thickness >= 35)).toBe(false)
  })
})
