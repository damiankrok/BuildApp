/**
 * Attached bodies by their relations (BUILDPLAN-ANALYZER-005C §17–§20, contract §2.3).
 *
 * A part of the plan beyond the long-band box is named by its junction with
 * the house, its own sides and its mouth — never by how far it reaches. A wing
 * whose rooms run on into the house is built; an open-mouthed garage waits for
 * the reading that shuts pocket mouths; a terrace on posts, a planter against
 * the front and a detached shed are never built. Synthetic, 5 cm/px, 0.6 m
 * walls; not a drawing of any real building.
 */
import { describe, expect, it } from 'vitest'
import { FAILURE_TITLES, RECONSTRUCTION_FAILURE_CODES, policiesDisagree } from '../src/index.js'
import type { PlanDecomposition } from '../src/index.js'
import { sheet } from './plan.js'
import { BLACK, drawLine } from '../../source-cv/test/draw.js'
import { builtAt, clear, glazeH, near, post, ring, run, wall } from './boundary-plan.js'

const X = [40, 360]
const HOUSE_M2 = 16 * 12
const relations = (d: PlanDecomposition) => (d.boundary?.bodies ?? []).map((b) => b.relation)

/** A house with a garage running 5.5 m out of its front between two side walls, the east one flush with the house. */
function garage(): ReturnType<typeof sheet> {
  const r = sheet(420, 460)
  ring(r, 40, 40, 359, 279)
  wall(r, 200, 268, 211, 379)
  wall(r, 348, 268, 359, 379)
  return r
}

describe('attached bodies are named by their relations', () => {
  it('a projecting wing whose rooms run on into the house: PROJECTING_WING, built', () => {
    const r = sheet(420, 420)
    ring(r, 40, 40, 359, 279)
    clear(r, 212, 268, 347, 279)
    wall(r, 200, 200, 211, 339)
    wall(r, 348, 200, 359, 339)
    wall(r, 200, 328, 229, 339)
    wall(r, 330, 328, 359, 339)
    glazeH(r, 328, 230, 329)
    const { d } = run(r, X, [40, 280, 340])
    const wing = d.boundary?.bodies.find((b) => b.relation === 'PROJECTING_WING')
    expect(wing?.built).toBe(true)
    expect(wing?.junction.wallShare ?? 1).toBeLessThan(0.5)
  })

  it('an open-mouthed garage with a flush side wall: OPEN_MOUTH_GARAGE, open in the first reading, built when mouths are shut', () => {
    const first = run(garage(), X, [40, 280, 380])
    expect(relations(first.d)).toContain('OPEN_MOUTH_GARAGE')
    expect(builtAt(first.d, 280, 330)).toBe(false)
    expect(near(first.builtM2, HOUSE_M2)).toBe(true)
    const shut = run(garage(), X, [40, 280, 380], [], { shutPocketMouths: true })
    expect(shut.d.boundary?.shutGarageMouths).toBe(1)
    expect(builtAt(shut.d, 280, 330)).toBe(true)
    expect(near(shut.builtM2, HOUSE_M2 + 8 * 5)).toBe(true)
  })

  it('a covered terrace on posts: COVERED_TERRACE, never built, even when mouths are shut', () => {
    const r = sheet(420, 460)
    ring(r, 40, 40, 359, 279)
    post(r, 60, 380)
    post(r, 340, 380)
    drawLine(r, 52, 280, 52, 388, BLACK)
    drawLine(r, 52, 388, 348, 388, BLACK)
    drawLine(r, 348, 280, 348, 388, BLACK)
    for (const shutPocketMouths of [false, true]) {
      const { d } = run(r, [40, 60, 340, 360], [40, 280, 380], [], { shutPocketMouths })
      expect(builtAt(d, 200, 330)).toBe(false)
      expect(relations(d)).not.toContain('OPEN_MOUTH_GARAGE')
    }
  })

  it('a planter walled against the front: named, never built', () => {
    const r = sheet(420, 420)
    ring(r, 40, 40, 359, 279)
    // a 1.5 × 1.2 m box of wall standing against the front
    wall(r, 120, 268, 131, 303)
    wall(r, 138, 268, 149, 303)
    wall(r, 120, 292, 149, 303)
    const { d } = run(r, [40, 120, 150, 360], [40, 280, 304])
    expect(builtAt(d, 140, 290)).toBe(false)
    const planter = d.boundary?.bodies.find((b) => b.rect.x0 >= 110 && b.rect.x1 <= 160 && b.rect.y0 >= 270)
    if (planter) expect(planter.built).toBe(false)
  })

  it('a detached shed standing apart: SEPARATE_BODY, never built', () => {
    const r = sheet(460, 420)
    ring(r, 40, 40, 359, 279)
    ring(r, 390, 300, 413, 323)
    const { d, builtM2 } = run(r, [40, 360, 390, 414], [40, 280, 300, 324])
    expect(builtAt(d, 400, 310)).toBe(false)
    expect(near(builtM2, HOUSE_M2)).toBe(true)
  })
})

describe('BOUNDARY_RESOLUTION_INCONCLUSIVE', () => {
  it('is a named failure code with a title', () => {
    expect(RECONSTRUCTION_FAILURE_CODES).toContain('BOUNDARY_RESOLUTION_INCONCLUSIVE')
    expect(FAILURE_TITLES.BOUNDARY_RESOLUTION_INCONCLUSIVE).toMatch(/outline/)
  })

  it('the two jamb policies are recorded, and both keep every room the box built', () => {
    // A wing at the SE corner, its east wall the house's own running on, a glazed front of short piers: adopted under
    // both policies. A 5 × 5 m corner room behind a wall with a drawn door, whose only way out is a blank 1.2 m gap:
    // the strict policy leaves the gap open, but the box's own reading built the room, and an adopted outline never
    // drops a cell the box built (005C post-review) — so the two policies build the same house.
    const r = sheet(420, 460)
    ring(r, 40, 40, 359, 279)
    clear(r, 200, 268, 347, 279)
    wall(r, 188, 268, 199, 399)
    wall(r, 348, 268, 359, 399)
    wall(r, 188, 388, 215, 399)
    wall(r, 332, 388, 359, 399)
    glazeH(r, 388, 216, 331)
    wall(r, 128, 40, 139, 139)
    wall(r, 40, 128, 139, 139)
    clear(r, 80, 128, 97, 139)
    drawLine(r, 80, 133, 97, 133, BLACK)
    clear(r, 40, 70, 51, 93)
    const { d } = run(r, [40, 188, 360], [40, 280, 400])
    const p = d.boundary?.policies
    expect(p?.exclusion.accepted).toBe(true)
    expect(p?.strict.accepted).toBe(true)
    expect(near(p?.exclusion.areaM2 ?? 0, HOUSE_M2 + 8.6 * 6)).toBe(true)
    expect(p?.strict.areaM2).toBe(p?.exclusion.areaM2)
    expect(p?.disagree).toBe(false)
    expect(relations(d)).toContain('PROJECTING_WING')
  })

  it('the policies disagree when either adopts and what they build differs by more than 6 %, one adopting and the other not included', () => {
    expect(policiesDisagree({ adopted: false, areaM2: 0 }, { adopted: true, areaM2: 215 })).toBe(true)
    expect(policiesDisagree({ adopted: true, areaM2: 215 }, { adopted: true, areaM2: 240 })).toBe(true)
    expect(policiesDisagree({ adopted: true, areaM2: 215 }, { adopted: true, areaM2: 220 })).toBe(false)
    expect(policiesDisagree({ adopted: false, areaM2: 192 }, { adopted: false, areaM2: 192 })).toBe(false)
  })
})
