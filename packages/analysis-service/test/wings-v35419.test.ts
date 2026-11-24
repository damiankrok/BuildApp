/**
 * v3.54.19 — bodies for any orthogonal outline, the site plan's printed dimensions, ids that survive a rebuild.
 * Controlled outlines and numbers (not a benchmark house); every rule with its counter-trial.
 */
import { describe, expect, it } from 'vitest'
import { partitionOf, registerByPlan, solveMassing, wallEndsPx, wingsOf } from '../src/consult/massing/massing.js'
import type { OutlineObservation, SilhouetteObservation } from '../src/consult/massing/massing.js'
import { outlineScale } from '../src/consult/plan-outline.js'
import { literalMetres } from '../src/consult/site-dimensions.js'

type P = { x: number; z: number }
const area = (r: { minX: number; maxX: number; minZ: number; maxZ: number }): number => (r.maxX - r.minX) * (r.maxZ - r.minZ)
/** A T: a 16 × 6 m bar at the rear, a 6 × 6 m stem in front of its middle. */
const T: P[] = [{ x: 5, z: 0 }, { x: 11, z: 0 }, { x: 11, z: 6 }, { x: 16, z: 6 }, { x: 16, z: 12 }, { x: 0, z: 12 }, { x: 0, z: 6 }, { x: 5, z: 6 }]
/** A U: a 16 × 4 m base at the front and two 5 × 6 m legs behind its ends. */
const U: P[] = [{ x: 0, z: 0 }, { x: 16, z: 0 }, { x: 16, z: 10 }, { x: 11, z: 10 }, { x: 11, z: 4 }, { x: 5, z: 4 }, { x: 5, z: 10 }, { x: 0, z: 10 }]

describe('v3.54.19 an outline of any number of corners is read as its own bodies', () => {
  it('a T: the bar, then the stem — nothing of the outline left over', () => {
    const w = wingsOf(T, 0.12 * 16 * 12, 2) as NonNullable<ReturnType<typeof wingsOf>>
    expect(w.rects).toHaveLength(2)
    expect(w.rects[0]).toEqual({ minX: 0, maxX: 16, minZ: 6, maxZ: 12 })
    expect(w.rects[1]).toEqual({ minX: 5, maxX: 11, minZ: 0, maxZ: 6 })
    expect(w.coveredM2).toBeCloseTo(w.outlineM2, 6)
  })
  it('a U: the base and both legs, three bodies', () => {
    const w = wingsOf(U, 0.12 * 16 * 10, 2) as NonNullable<ReturnType<typeof wingsOf>>
    expect(w.rects).toHaveLength(3)
    expect(w.rects.map(area).reduce((a, b) => a + b, 0)).toBeCloseTo(16 * 10 - 6 * 6, 6)
    // bodies never overlap and never leave the outline
    for (const [i, a] of w.rects.entries()) for (const b of w.rects.slice(i + 1)) expect(Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX) <= 1e-9 || Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ) <= 1e-9).toBe(true)
  })
  it('counter-trials: a notch too small to be a body is left unmodelled by area, never added; an oblique outline is not read', () => {
    // a 12 × 8 m house with a 1.5 × 1.5 m bay on its front: the bay is no body (below the wing share and the least side)
    const bay: P[] = [{ x: 0, z: 0 }, { x: 5, z: 0 }, { x: 5, z: -1.5 }, { x: 6.5, z: -1.5 }, { x: 6.5, z: 0 }, { x: 12, z: 0 }, { x: 12, z: 8 }, { x: 0, z: 8 }]
    const w = wingsOf(bay, 0.12 * 12 * 9.5, 2) as NonNullable<ReturnType<typeof wingsOf>>
    expect(w.rects).toEqual([{ minX: 0, maxX: 12, minZ: 0, maxZ: 8 }])
    expect(w.outlineM2 - w.coveredM2).toBeCloseTo(2.25, 6)
    expect(wingsOf([{ x: 0, z: 0 }, { x: 10, z: 1 }, { x: 10, z: 8 }, { x: 0, z: 8 }], 5, 2)).toBeUndefined()
  })
  it('at most four bodies, largest first', () => {
    // a comb: a 20 × 4 m back and five 2 × 5 m teeth
    const comb: P[] = [{ x: 0, z: 5 }, { x: 0, z: 9 }, { x: 20, z: 9 }, { x: 20, z: 5 }]
    for (let k = 4; k >= 0; k -= 1) comb.push({ x: k * 4 + 3, z: 5 }, { x: k * 4 + 3, z: 0 }, { x: k * 4 + 1, z: 0 }, { x: k * 4 + 1, z: 5 })
    const w = wingsOf(comb, 5, 2) as NonNullable<ReturnType<typeof wingsOf>>
    expect(w.rects).toHaveLength(4)
    expect(area(w.rects[0])).toBe(80)
  })
  it('the massing no longer refuses a T as "beyond the supported form": two bodies, each read from the elevations', () => {
    const MPP = 0.02
    const ZERO = 400
    const obs = (side: SilhouetteObservation['side'], lo: number, hi: number): SilhouetteObservation => {
      const c = (a: number): number => 100 + (a - lo) / MPP
      const r = (y: number): number => ZERO - y / MPP
      return { observationId: `sk-${side}`, side, frameId: `f-${side}`, sourceByteHash: '', groundRow: ZERO, walls: [[[c(lo), r(0)], [c(hi), r(0)], [c(hi), r(3)], [c(lo), r(3)]]], roofs: [[[c(lo), r(3)], [c(hi), r(3)], [c(hi), r(3.2)], [c(lo), r(3.2)]]] }
    }
    const outline: OutlineObservation = { observationId: 'o', frameId: 'plan', sourceByteHash: '', outline: T, by: 'API_PLAN_OUTLINE', fidelity: 'SOURCE_TRACED', why: 'test' }
    const h = solveMassing({ outline, silhouettes: [obs('FRONT', 0, 16), obs('RIGHT', 0, 12)] })
    expect(h.status).toBe('BUILDABLE')
    expect(h.bodies.map((b) => b.id)).toEqual(['mass-main', 'mass-wing-1'])
    expect(h.bodies[0].rect).toEqual({ minX: 0, maxX: 16, minZ: 6, maxZ: 12 })
    expect(h.alternatives.join(' ')).toMatch(/read as 2 bodies/)
  })
  it('massing 1.7.0: a lower body drawn under the roof of the one behind it does not become a spire — it takes the first body\'s pitch from its own walls; counter-trial: its own steep-but-possible roof stands', () => {
    const MPP = 0.02
    const ZERO = 500
    const poly = (lo: number, pts: Array<[number, number]>): Array<[number, number]> => pts.map(([a, y]) => [100 + (a - lo) / MPP, ZERO - y / MPP])
    const outline: OutlineObservation = { observationId: 'o', frameId: 'plan', sourceByteHash: '', outline: T, by: 'API_PLAN_OUTLINE', fidelity: 'SOURCE_TRACED', why: 'test' }
    // FRONT: the bar's slopes (a band 3..5.1 m over 16 m) and the stem's own gable end in front of them
    const front = (stemTop: number): SilhouetteObservation => ({ observationId: 'sk-F', side: 'FRONT', frameId: 'f-F', sourceByteHash: '', groundRow: ZERO, walls: [poly(0, [[0, 0], [16, 0], [16, 3], [0, 3]])], roofs: [poly(0, [[0, 3], [16, 3], [16, 5.1], [0, 5.1]]), poly(0, [[5, 3], [11, 3], [8, stemTop]])] })
    // a SIDE: the bar's gable end over its 6 m and, over the stem's 6 m, a roof drawn up to `stemTop`
    const side = (sd: 'LEFT' | 'RIGHT', stemTop: number): SilhouetteObservation => ({ observationId: `sk-${sd}`, side: sd, frameId: `f-${sd}`, sourceByteHash: '', groundRow: ZERO, walls: [poly(0, [[0, 0], [12, 0], [12, 3], [0, 3]])], roofs: [poly(0, [[6, 3], [12, 3], [9, 5.1]]), poly(0, [[0, 3], [6, 3], [6, stemTop], [0, stemTop]])] })
    const solve = (stemTop: number): ReturnType<typeof solveMassing> => solveMassing({ outline, silhouettes: [front(stemTop), side('LEFT', stemTop), side('RIGHT', stemTop)] })
    const spire = solve(9.5)
    const [main, wing] = spire.bodies
    expect(main.roof.pitchDeg).toBeGreaterThan(25)
    expect(main.roof.pitchDeg).toBeLessThan(45)
    expect(wing.roof.pitchDeg).toBe(main.roof.pitchDeg)
    expect(wing.roof.ridgeM as number).toBeLessThan(main.roof.ridgeM as number + 0.5)
    expect(wing.provenance.roof.fidelity).toBe('TRACE_UNCERTAIN')
    expect(spire.alternatives.join(' ')).toMatch(/another body's roof seen behind it/)
    // counter-trial: a 50° roof over the stem is a roof a house can have: kept as read
    const steep = solve(3 + 3 * Math.tan((50 * Math.PI) / 180))
    expect(steep.bodies[1].roof.pitchDeg as number).toBeGreaterThan(40)
    expect(steep.alternatives.join(' ')).not.toMatch(/another body's roof seen behind it/)
  })
  it('massing 1.7.0: two bodies in line are split on the wall the plan draws across the body near the elevations\' step; counter-trials: a wall too far, or too short, moves nothing', () => {
    const MPP = 0.02
    const ZERO = 500
    const poly = (pts: Array<[number, number]>): Array<[number, number]> => pts.map(([a, y]) => [100 + a / MPP, ZERO - y / MPP])
    const outline: OutlineObservation = { observationId: 'o', frameId: 'plan', sourceByteHash: '', outline: [{ x: 0, z: 0 }, { x: 14, z: 0 }, { x: 14, z: 8 }, { x: 0, z: 8 }], by: 'API_PLAN_OUTLINE', fidelity: 'SOURCE_TRACED', why: 'test' }
    // FRONT and REAR: a 3 m garage (top 3.6 m) beside the house (top 6 m); the drawn step stands at 3.0 m (FRONT) — an overhang short of the wall
    const view = (sd: 'FRONT' | 'REAR'): SilhouetteObservation => {
      const m = (a: number): number => (sd === 'FRONT' ? a : 14 - a)
      const q = (pts: Array<[number, number]>): Array<[number, number]> => poly(pts.map(([a, y]) => [m(a), y]))
      return { observationId: `sk-${sd}`, side: sd, frameId: `f-${sd}`, sourceByteHash: '', groundRow: ZERO, walls: [q([[0, 0], [14, 0], [14, 3], [0, 3]])], roofs: [q([[0, 3], [3, 3], [3, 3.6], [0, 3.6]]), q([[3, 3], [14, 3], [14, 6], [3, 6]])] }
    }
    const solve = (planWalls: Array<{ a: { x: number; z: number }; b: { x: number; z: number } }>): ReturnType<typeof solveMassing> => solveMassing({ outline, silhouettes: [view('FRONT'), view('REAR')], planWalls })
    const alone = solve([])
    expect(alone.bodies).toHaveLength(2)
    const stepAt = Math.min(...alone.bodies.map((b) => b.rect.maxX))
    expect(stepAt).toBeGreaterThan(2.5)
    expect(stepAt).toBeLessThan(3.5)
    // the plan draws the house's wall at 3.9 m, over 6 of the 8 m of depth
    const snapped = solve([{ a: { x: 3.9, z: 0.3 }, b: { x: 3.9, z: 6.3 } }])
    expect(Math.min(...snapped.bodies.map((b) => b.rect.maxX))).toBeCloseTo(3.9, 6)
    expect(snapped.alternatives.join(' ')).toMatch(/on the wall the plan draws across the body there/)
    // a wall 2 m from the step, and a 2 m stub near it: neither is where the bodies meet
    expect(Math.min(...solve([{ a: { x: 5.2, z: 0.3 }, b: { x: 5.2, z: 7.7 } }]).bodies.map((b) => b.rect.maxX))).toBeCloseTo(stepAt, 6)
    expect(Math.min(...solve([{ a: { x: 3.9, z: 0.3 }, b: { x: 3.9, z: 2.3 } }]).bodies.map((b) => b.rect.maxX))).toBeCloseTo(stepAt, 6)
  })
})

describe('v3.54.19 the site plan\'s printed building dimensions', () => {
  it('a printed literal is parsed again: metres with a comma, centimetres as a whole number', () => {
    expect(literalMetres('17,7m')).toBe(17.7)
    expect(literalMetres('1228')).toBe(12.28)
    expect(literalMetres('9.6')).toBe(9.6)
    expect(literalMetres('ok. 12')).toBeUndefined()
  })
  it('the pair is a scale only when both dimensions agree over the outline\'s two extents — the longer over the longer', () => {
    // an outline 614 × 587 px of a 12.28 × 11.74 m house: 2 cm/px either way
    const o: Array<[number, number]> = [[100, 100], [714, 100], [714, 687], [100, 687]]
    const sc = outlineScale(o, { overallM: [11.74, 12.28], overallFrom: 'printed on the site plan' })
    expect(sc?.basis).toBe('OVERALL_DIMENSIONS')
    expect(sc?.mPerPx).toBeCloseTo(0.02, 4)
    expect(sc?.why).toMatch(/printed on the site plan/)
    // counter-trial: the roof's outline (0.8 m more on one axis only) does not agree with the walls' outline: no scale
    expect(outlineScale(o, { overallM: [11.74, 13.4] })).toBeUndefined()
  })
})

describe('v3.54.19 (massing 1.8.0) an outline is partitioned exactly into its bodies', () => {
  // a 9.6 × 10.2 m house with a 6 × 6.6 m garage standing against the MIDDLE of its left side, 1.8 m in from either end
  // (each of the two steps is 6.8 % of the bounding rectangle: more than a small step, so no convention closes them)
  const MID: P[] = [{ x: 0, z: 1.8 }, { x: 6, z: 1.8 }, { x: 6, z: 0 }, { x: 15.6, z: 0 }, { x: 15.6, z: 10.2 }, { x: 6, z: 10.2 }, { x: 6, z: 8.4 }, { x: 0, z: 8.4 }]
  it('REPRODUCES the loss: the largest rectangle that fits inside is the band house and garage share — the rest of the house is then dropped', () => {
    const w = wingsOf(MID, 0.12 * 15.6 * 10.2, 2) as NonNullable<ReturnType<typeof wingsOf>>
    expect(w.rects[0]).toEqual({ minX: 0, maxX: 15.6, minZ: 1.8, maxZ: 8.4 })
    expect(w.outlineM2 - w.coveredM2).toBeGreaterThan(25)
  })
  it('the exact partition is the garage and the house: two rectangles, nothing left over', () => {
    const p = partitionOf(MID) as NonNullable<ReturnType<typeof partitionOf>>
    expect(p).toHaveLength(2)
    expect(p).toContainEqual({ minX: 6, maxX: 15.6, minZ: 0, maxZ: 10.2 })
    expect(p).toContainEqual({ minX: 0, maxX: 6, minZ: 1.8, maxZ: 8.4 })
    expect(p.map(area).reduce((a, b) => a + b, 0)).toBeCloseTo(9.6 * 10.2 + 6 * 6.6, 6)
  })
  it('a T is its bar and its stem, a U its base and legs, a rectangle itself; counter-trial: a comb of five teeth has no partition into four', () => {
    expect(partitionOf(T)).toHaveLength(2)
    expect(partitionOf(U)).toHaveLength(3)
    expect(partitionOf([{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 3 }, { x: 0, z: 3 }])).toEqual([{ minX: 0, maxX: 4, minZ: 0, maxZ: 3 }])
    const comb: P[] = [{ x: 0, z: 5 }, { x: 0, z: 9 }, { x: 20, z: 9 }, { x: 20, z: 5 }]
    for (let k = 4; k >= 0; k -= 1) comb.push({ x: k * 4 + 3, z: 5 }, { x: k * 4 + 3, z: 0 }, { x: k * 4 + 1, z: 0 }, { x: k * 4 + 1, z: 5 })
    expect(partitionOf(comb)).toBeUndefined()
  })
  it('the massing builds the house and the garage as two bodies whose bounding box is the outline\'s', () => {
    const MPP = 0.02
    const ZERO = 400
    const obs = (side: SilhouetteObservation['side'], lo: number, hi: number): SilhouetteObservation => {
      const c = (a: number): number => 100 + (a - lo) / MPP
      const r = (y: number): number => ZERO - y / MPP
      return { observationId: `sk-${side}`, side, frameId: `f-${side}`, sourceByteHash: '', groundRow: ZERO, walls: [[[c(lo), r(0)], [c(hi), r(0)], [c(hi), r(3)], [c(lo), r(3)]]], roofs: [[[c(lo), r(3)], [c(hi), r(3)], [c(hi), r(3.2)], [c(lo), r(3.2)]]] }
    }
    const outline: OutlineObservation = { observationId: 'o', frameId: 'plan', sourceByteHash: '', outline: MID, by: 'API_PLAN_OUTLINE', fidelity: 'SOURCE_TRACED', why: 'test' }
    const h = solveMassing({ outline, silhouettes: [obs('FRONT', 0, 15.6), obs('RIGHT', 0, 10.2)] })
    expect(h.status).toBe('BUILDABLE')
    expect(h.bodies.map((b) => b.rect)).toEqual([{ minX: 6, maxX: 15.6, minZ: 0, maxZ: 10.2 }, { minX: 0, maxX: 6, minZ: 1.8, maxZ: 8.4 }])
    expect(h.alternatives.join(' ')).toMatch(/partitioned exactly/)
  })
})

describe('v3.54.19 (massing 1.8.0) the building\'s width on an elevation is taken half-way up the storey', () => {
  const ZERO = 450
  // a 7.9 m gable end drawn 548 px wide (x 222..770), eaves row 240, apex row 78; a stone plinth and terrace wall 66 px
  // high run on past it at the ground (x 50..875)
  const gable: Array<[number, number]> = [[222, 380], [222, 240], [496, 78], [770, 240], [770, 380]]
  const plinth: Array<[number, number]> = [[50, ZERO], [875, ZERO], [875, 380], [50, 380]]
  const roof: Array<[number, number]> = [[188, 240], [496, 53], [803, 240], [770, 240], [496, 78], [222, 240]]
  it('REPRODUCES the loss: over everything drawn as wall the gable is 825 px wide; half-way up the storey it is the house\'s own 548 px', () => {
    const all = [gable, plinth].flatMap((p) => p.map((q) => q[0]))
    expect(Math.max(...all) - Math.min(...all)).toBe(825)
    const e = wallEndsPx([gable, plinth], [roof], ZERO) as { x0: number; x1: number }
    expect(e.x1 - e.x0).toBeCloseTo(548, 0)
    const reg = registerByPlan({ observationId: 'o', side: 'LEFT', frameId: 'f', sourceByteHash: '', groundRow: ZERO, walls: [gable, plinth], roofs: [roof] }, { lo: 0, hi: 7.9 })
    expect('view' in reg && reg.view.projection.mpp).toBeCloseTo(7.9 / 548, 4)
  })
  it('counter-trials: plain walls from the ground to the eaves measure as before; with no roof drawn, or walls not drawn at that height, the whole extent stands', () => {
    const wall: Array<[number, number]> = [[100, ZERO], [600, ZERO], [600, 300], [100, 300]]
    const band: Array<[number, number]> = [[80, 300], [620, 300], [620, 200], [80, 200]]
    expect(wallEndsPx([wall], [band], ZERO)).toEqual({ x0: 100, x1: 600 })
    expect(wallEndsPx([gable, plinth], [], ZERO)).toEqual({ x0: 50, x1: 875 })
    // only a low wall is drawn (nothing at mid-storey height): the extent of what is drawn
    expect(wallEndsPx([plinth], [roof], ZERO)).toEqual({ x0: 50, x1: 875 })
  })
})

describe('v3.54.19 R2 a partition whose every rectangle is a body comes before the largest rectangle', () => {
  // a 15.6 m front: a garage wing on the left, a deeper middle part, a shallower right part — three tops at three depths
  const STEPPED = [{ x: 0, z: 7.4 }, { x: 6, z: 7.4 }, { x: 6, z: 9.2 }, { x: 12, z: 9.2 }, { x: 12, z: 6.8 }, { x: 15.6, z: 6.8 }, { x: 15.6, z: 0 }, { x: 0, z: 0 }]
  const aBody = (q: { minX: number; maxX: number; minZ: number; maxZ: number }): boolean => Math.min(q.maxX - q.minX, q.maxZ - q.minZ) >= 2 && (q.maxX - q.minX) * (q.maxZ - q.minZ) >= 0.12 * 15.6 * 9.2

  it('without the rule the largest rectangle slices all three parts and leaves a 0.6 m strip', () => {
    const p = partitionOf(STEPPED) as NonNullable<ReturnType<typeof partitionOf>>
    expect(p).toHaveLength(3)
    expect(Math.min(...p.map((q) => Math.min(q.maxX - q.minX, q.maxZ - q.minZ)))).toBeCloseTo(0.6, 6)
  })

  it('with it the three parts stand side by side, each from the front to its own rear wall', () => {
    const p = partitionOf(STEPPED, 4, aBody) as NonNullable<ReturnType<typeof partitionOf>>
    expect([...p].sort((a, b) => a.minX - b.minX)).toEqual([{ minX: 0, maxX: 6, minZ: 0, maxZ: 7.4 }, { minX: 6, maxX: 12, minZ: 0, maxZ: 9.2 }, { minX: 12, maxX: 15.6, minZ: 0, maxZ: 6.8 }])
  })

  it('an outline with no such cover still gets its fewest-rectangle cover (the caller refuses the sliver)', () => {
    const NOTCH = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 8 }, { x: 9, z: 8 }, { x: 9, z: 8.5 }, { x: 0, z: 8.5 }]
    const p = partitionOf(NOTCH, 4, aBody) as NonNullable<ReturnType<typeof partitionOf>>
    expect(p).toHaveLength(2)
    expect(p.every(aBody)).toBe(false)
  })
})
