/**
 * v3.54.21 — the roof system: regions solved together. Every case here has geometry known independently of the solver
 * (45° roofs over invented rectangles, so every height is a difference of coordinates), and each positive case has its
 * counter-trial: a valley and the correct absence of one, eaves at different heights, a ridge turned after its heights
 * were read, a cross gable with no step of the outline, a relation stated apart.
 */
import { describe, expect, it } from 'vitest'
import { attachedGableLayout } from '../src/v2/attached-roof-form.js'
import { isValleyCut, valleyCutMainRoof } from '../src/v2/valley-cut.js'
import { pointInPoly, roofSystemTopAt, solveRoofSystem } from '../src/v2/roof-system.js'
import type { RoofRegion, RoofSystemSolution } from '../src/v2/roof-system.js'

const T = 0.25
/** A 12 × 8 m main gable, ridge along X at z = 4: eaves 3 m, ridge 7 m (45°). */
const MAIN: RoofRegion = { id: 'roof-main', hostBodyId: 'main', rect: { x0: 0, z0: 0, x1: 12, z1: 8 }, kind: 'GABLE', ridgeAxis: 'X', eaveY: 3, ridgeY: 7, thicknessM: T }
/** A 4 m wide wing in front of it (z from −5 to the party line z = 0), ridge along Z at x = 6: eaves 3 m, ridge 5 m (45°). */
const WING: RoofRegion = { id: 'roof-wing', hostBodyId: 'wing', rect: { x0: 4, z0: -5, x1: 8, z1: 0 }, kind: 'GABLE', ridgeAxis: 'Z', eaveY: 3, ridgeY: 5, thicknessM: T }

const area = (poly: ReadonlyArray<{ x: number; z: number }>): number => Math.abs(poly.reduce((s, a, i) => { const b = poly[(i + 1) % poly.length]; return s + a.x * b.z - b.x * a.z }, 0)) / 2
const total = (s: RoofSystemSolution): number => s.planes.reduce((t, p) => t + area(p.boundary), 0)
const has = (poly: ReadonlyArray<{ x: number; z: number }>, x: number, z: number): boolean => poly.some((p) => Math.abs(p.x - x) < 1e-5 && Math.abs(p.z - z) < 1e-5)
const planeOf = (s: RoofSystemSolution, id: string) => { const p = s.planes.find((q) => q.id === id); if (!p) throw new Error(`no plane ${id}: ${s.planes.map((q) => q.id).join(', ')}`); return p }
/** The roof stated independently: the highest of the regions' own surfaces over a point (each the lower of its slopes). */
const gableAt = (r: RoofRegion, x: number, z: number, ext: { z1?: number } = {}): number | undefined => {
  const inside = x >= r.rect.x0 && x <= r.rect.x1 && z >= r.rect.z0 && z <= (ext.z1 ?? r.rect.z1)
  if (!inside) return undefined
  const [u, u0, u1] = r.ridgeAxis === 'Z' ? [x, r.rect.x0, r.rect.x1] : [z, r.rect.z0, r.rect.z1]
  const tan = (r.ridgeY - r.eaveY) / ((u1 - u0) / 2)
  return r.eaveY + Math.min(u - u0, u1 - u) * tan
}

describe('roof system: one region', () => {
  it('a gable is two slopes and a ridge, nothing joined', () => {
    const s = solveRoofSystem([MAIN])
    expect(s.planes.map((p) => p.id).sort()).toEqual(['roof-main-maxZ', 'roof-main-minZ'])
    expect(planeOf(s, 'roof-main-minZ').boundary).toHaveLength(4)
    expect(total(s)).toBeCloseTo(96, 6)
    expect(s.creases).toHaveLength(1)
    expect(s.creases[0]).toMatchObject({ kind: 'RIDGE', startY: 7, endY: 7, gapM: 0 })
    expect(s.regions[0]).toMatchObject({ pitchDeg: 45, joined: false })
    expect(s.relations).toEqual([])
    expect(s.freeEdges.filter((e) => e.kind === 'EAVE')).toHaveLength(2)
    expect(s.freeEdges.filter((e) => e.kind === 'VERGE')).toHaveLength(4)
  })
  it('a hip is four planes meeting at a ridge and four hips, every shared edge at one height', () => {
    const s = solveRoofSystem([{ ...MAIN, kind: 'HIP', hipRunM: 4 }])
    expect(s.planes).toHaveLength(4)
    expect(total(s)).toBeCloseTo(96, 6)
    expect(s.creases.filter((c) => c.kind === 'RIDGE')).toHaveLength(1)
    expect(s.creases.filter((c) => c.kind === 'HIP')).toHaveLength(4)
    for (const c of s.creases) expect(c.gapM).toBe(0)
    expect(s.freeEdges.every((e) => e.kind === 'EAVE')).toBe(true)
    // the ridge runs from (4, 4) to (8, 4) at 7 m
    const ridge = s.creases.find((c) => c.kind === 'RIDGE')
    expect([ridge?.start.x, ridge?.end.x].sort()).toEqual([4, 8])
  })
})

describe('roof system: a wing whose ridge runs into the main slope', () => {
  const s = solveRoofSystem([MAIN, WING])
  it('two valleys from the corners on the main eave to where the wing ridge meets the slope — computed, not stated', () => {
    expect(s.relations).toHaveLength(1)
    expect(s.relations[0]).toMatchObject({ a: 'roof-wing', b: 'roof-main', kind: 'VALLEY', extendedM: 4 })
    const valleys = s.creases.filter((c) => c.kind === 'VALLEY')
    expect(valleys).toHaveLength(2)
    for (const v of valleys) {
      // from the eave corner (3 m) up to the apex at (6, 2), where 3 + z = 5
      const ends = [v.start, v.end].sort((a, b) => a.z - b.z)
      expect(ends[0].z).toBeCloseTo(0, 6)
      expect([4, 8]).toContain(ends[0].x)
      expect(ends[1]).toEqual({ x: 6, z: 2 })
      expect([v.startY, v.endY].sort()).toEqual([3, 5])
      expect(v.gapM).toBe(0)
    }
  })
  it('the wing planes run on over the slope to the valleys, the main slope is cut back to them, nothing overlaps', () => {
    const low = planeOf(s, 'roof-wing-minX').boundary
    for (const [x, z] of [[4, -5], [6, -5], [6, 2], [4, 0]]) expect(has(low, x, z)).toBe(true)
    const front = planeOf(s, 'roof-main-minZ').boundary
    expect(area(front)).toBeCloseTo(48 - 4, 6)
    for (const [x, z] of [[4, 0], [6, 2], [8, 0]]) expect(has(front, x, z)).toBe(true)
    expect(area(planeOf(s, 'roof-main-maxZ').boundary)).toBeCloseTo(48, 6)
    // the ground covered once: the two rectangles' areas
    expect(total(s)).toBeCloseTo(96 + 20, 6)
  })
  it('over every point the built roof is the higher of the two roofs', () => {
    for (let x = 0.263; x < 12; x += 0.5) for (let z = -4.757; z < 8; z += 0.5) {
      const want = Math.max(gableAt(MAIN, x, z) ?? -Infinity, gableAt(WING, x, z, { z1: 4 }) ?? -Infinity)
      const got = roofSystemTopAt(s, x, z)
      if (want === -Infinity) expect(got).toBeUndefined()
      else expect(got).toBeCloseTo(want, 6)
      // and exactly one plane holds it (no two surfaces through each other)
      expect(s.planes.filter((p) => pointInPoly({ x, z }, p.boundary, 0) ).length).toBeLessThanOrEqual(1)
    }
  })
  it('agrees with the drawings\' solver where that solver accepts the join (same valleys, same cut of the main slope)', () => {
    const main = { ridgeAxis: 'X' as const, ridgeAt: 4, eaveY: 3, ridgeY: 7, pitchDeg: 45, footprint: MAIN.rect }
    const layout = attachedGableLayout(WING.rect, 'Z', 45, 3, main)
    expect(layout.join.kind).toBe('VALLEY')
    if (layout.join.kind !== 'VALLEY') return
    for (const v of layout.join.valleys) expect(s.creases.some((c) => c.kind === 'VALLEY' && [c.start, c.end].some((p) => Math.abs(p.x - v.start.x) < 1e-6 && Math.abs(p.z - v.start.z) < 1e-6) && [c.start, c.end].some((p) => Math.abs(p.x - v.end.x) < 1e-6 && Math.abs(p.z - v.end.z) < 1e-6))).toBe(true)
    const cut = valleyCutMainRoof({ ...main, thicknessM: T, overhangM: 0, hasEdgeMembers: false }, [{ massId: 'wing', pitchDeg: 45, thicknessM: T, layout, planeIds: { LOW: 'l', HIGH: 'h' } }])
    expect(isValleyCut(cut)).toBe(true)
    if (!isValleyCut(cut)) return
    const theirs = cut.planes.find((p) => p.id === 'roof-main-plane-low')
    expect(area(theirs?.boundary ?? [])).toBeCloseTo(area(planeOf(s, 'roof-main-minZ').boundary), 6)
    for (const lp of layout.planes) expect(area(lp.boundary)).toBeCloseTo(area(planeOf(s, lp.key === 'LOW' ? 'roof-wing-minX' : 'roof-wing-maxX').boundary), 6)
  })
})

describe('roof system: eaves at different heights', () => {
  it('wing eaves ABOVE the main eaves: the valleys start up the slope (the cut the drawings\' cutter refuses)', () => {
    const wing = { ...WING, eaveY: 3.4, ridgeY: 5.4 }
    const s = solveRoofSystem([MAIN, wing])
    expect(s.relations[0]).toMatchObject({ kind: 'VALLEY', cheekM: 0.4 })
    expect(s.adjustments).toEqual([])
    const valleys = s.creases.filter((c) => c.kind === 'VALLEY')
    expect(valleys).toHaveLength(2)
    for (const v of valleys) {
      const ends = [v.start, v.end].sort((a, b) => a.z - b.z)
      expect(ends[0].z).toBeCloseTo(0.4, 6)
      expect(ends[1].x).toBeCloseTo(6, 6)
      expect(ends[1].z).toBeCloseTo(2.4, 6)
      expect(Math.min(v.startY, v.endY)).toBeCloseTo(3.4, 6)
      expect(Math.max(v.startY, v.endY)).toBeCloseTo(5.4, 6)
    }
    // the main slope loses the whole strip under the wing up to the valleys: 4 × 0.4 and the triangle above it
    expect(area(planeOf(s, 'roof-main-minZ').boundary)).toBeCloseTo(48 - 1.6 - 4, 6)
    expect(total(s)).toBeCloseTo(96 + 20, 6)
    // the drawings' own functions: a valley is laid out, and the cutter refuses it by name
    const main = { ridgeAxis: 'X' as const, ridgeAt: 4, eaveY: 3, ridgeY: 7, pitchDeg: 45, footprint: MAIN.rect }
    const layout = attachedGableLayout(wing.rect, 'Z', 45, 3.4, main, { anyEaves: true })
    expect(layout.join.kind).toBe('VALLEY')
    const cut = valleyCutMainRoof({ ...main, thicknessM: T, overhangM: 0, hasEdgeMembers: false }, [{ massId: 'wing', pitchDeg: 45, thicknessM: T, layout, planeIds: { LOW: 'l', HIGH: 'h' } }])
    expect('refused' in cut && /do not start on the main eave/.test(cut.refused)).toBe(true)
  })
  it('wing eaves BELOW the main eaves, its ridge above them: abuts the wall up to the main eave, valleys from there', () => {
    const wing: RoofRegion = { ...WING, rect: { x0: 2, z0: -5, x1: 10, z1: 0 }, eaveY: 2, ridgeY: 6 }
    const s = solveRoofSystem([MAIN, wing])
    expect(s.relations[0].kind).toBe('VALLEY')
    const valleys = s.creases.filter((c) => c.kind === 'VALLEY')
    expect(valleys).toHaveLength(2)
    for (const v of valleys) {
      const ends = [v.start, v.end].sort((a, b) => a.z - b.z)
      // a metre in from each eave (where the wing plane has risen to the main eave's 3 m), up to (6, 3)
      expect([3, 9]).toContain(ends[0].x)
      expect(ends[0].z).toBeCloseTo(0, 6)
      expect(ends[1]).toEqual({ x: 6, z: 3 })
    }
    // below the main eave the wing plane meets the main wall along the party line: an abutment, a metre each side
    const ab = s.freeEdges.filter((e) => e.kind === 'ABUTMENT' && e.regionId === 'roof-wing')
    expect(ab).toHaveLength(2)
    for (const e of ab) expect(Math.abs(e.end.x - e.start.x)).toBeCloseTo(1, 6)
    const main = { ridgeAxis: 'X' as const, ridgeAt: 4, eaveY: 3, ridgeY: 7, pitchDeg: 45, footprint: MAIN.rect }
    const layout = attachedGableLayout(wing.rect, 'Z', 45, 2, main, { anyEaves: true })
    expect(layout.join.kind).toBe('VALLEY')
    if (layout.join.kind === 'VALLEY') for (const v of layout.join.valleys) expect(valleys.some((c) => [c.start, c.end].some((p) => Math.abs(p.x - v.start.x) < 1e-6 && Math.abs(p.z - v.start.z) < 1e-6))).toBe(true)
  })
})

describe('roof system: the correct absence of a valley', () => {
  it('a low garage against a two-storey wall abuts: no valley, no cut, the main roof whole', () => {
    const main = { ...MAIN, eaveY: 6, ridgeY: 10 }
    const garage = { ...WING, eaveY: 2.8, ridgeY: 4.8 }
    const s = solveRoofSystem([main, garage])
    expect(s.relations).toHaveLength(1)
    expect(s.relations[0].kind).toBe('ABUTMENT')
    expect(s.creases.filter((c) => c.kind === 'VALLEY')).toHaveLength(0)
    expect(area(planeOf(s, 'roof-main-minZ').boundary)).toBeCloseTo(48, 6)
    expect(planeOf(s, 'roof-wing-minX').boundary.every((p) => p.z <= 1e-9)).toBe(true)
    expect(s.regions.every((r) => !r.joined)).toBe(true)
  })
  it('a wing whose ridge is under the main eaves by its reading abuts even when its planes are run on', () => {
    const s = solveRoofSystem([{ ...MAIN, eaveY: 4.95, ridgeY: 8.95 }, WING])
    expect(s.relations[0].kind).toBe('ABUTMENT')
    expect(s.creases.filter((c) => c.kind === 'VALLEY')).toHaveLength(0)
  })
  it('regions stated apart are not joined, whatever their heights (the source draws a wall between)', () => {
    const s = solveRoofSystem([MAIN, { ...WING, separateFrom: ['roof-main'] }])
    expect(s.relations[0].kind).toBe('SEPARATE')
    expect(s.creases.filter((c) => c.kind === 'VALLEY')).toHaveLength(0)
    expect(area(planeOf(s, 'roof-main-minZ').boundary)).toBeCloseTo(48, 6)
    expect(planeOf(s, 'roof-wing-minX').boundary.every((p) => p.z <= 1e-9)).toBe(true)
  })
  it('two gables in line (ridge to ridge) have a gable wall between them, not a valley', () => {
    const lower: RoofRegion = { id: 'roof-low', hostBodyId: 'low', rect: { x0: 12, z0: 1, x1: 17, z1: 7 }, kind: 'GABLE', ridgeAxis: 'X', eaveY: 2.8, ridgeY: 5.8, thicknessM: T }
    const s = solveRoofSystem([MAIN, lower])
    expect(s.relations[0].kind).toBe('IN_LINE')
    expect(s.creases.filter((c) => c.kind === 'VALLEY')).toHaveLength(0)
    expect(s.freeEdges.filter((e) => e.kind === 'ABUTMENT' && e.regionId === 'roof-low').length).toBeGreaterThan(0)
  })
  it('a wing wider than the side it stands against stops at the party line, by name', () => {
    const s = solveRoofSystem([{ ...MAIN, rect: { x0: 5, z0: 0, x1: 7, z1: 8 }, ridgeAxis: 'Z', eaveY: 3, ridgeY: 4 }, { ...WING, ridgeAxis: 'Z' }])
    expect(s.relations[0].kind).not.toBe('VALLEY')
  })
  it('a wing standing above the main ridge does not die into it', () => {
    const s = solveRoofSystem([MAIN, { ...WING, eaveY: 6, ridgeY: 8 }])
    expect(s.relations[0].kind).toBe('ABUTMENT')
    expect(s.relations[0].why).toMatch(/stands above/)
    expect(area(planeOf(s, 'roof-main-minZ').boundary)).toBeCloseTo(48, 6)
  })
})

describe('roof system: a cross gable with no step of the outline', () => {
  const cross: RoofRegion = { id: 'roof-cross', hostBodyId: 'main', rect: { x0: 4, z0: 0, x1: 8, z1: 4 }, kind: 'GABLE', ridgeAxis: 'Z', eaveY: 3, ridgeY: 5, thicknessM: T, over: 'roof-main' }
  const s = solveRoofSystem([MAIN, cross])
  it('is a second ridge over the same walls: two triangles on the main slope, two valleys, the outline untouched', () => {
    expect(s.relations[0]).toMatchObject({ a: 'roof-cross', b: 'roof-main', kind: 'CROSS_GABLE' })
    expect(area(planeOf(s, 'roof-cross-minX').boundary)).toBeCloseTo(2, 6)
    expect(area(planeOf(s, 'roof-cross-maxX').boundary)).toBeCloseTo(2, 6)
    expect(area(planeOf(s, 'roof-main-minZ').boundary)).toBeCloseTo(44, 6)
    expect(total(s)).toBeCloseTo(96, 6)
    expect(s.creases.filter((c) => c.kind === 'VALLEY')).toHaveLength(2)
    expect(s.regions.find((r) => r.id === 'roof-cross')).toMatchObject({ hostBodyId: 'main', joined: true })
    // over the front wall the roof rises to the cross ridge: a gable on that wall
    expect(roofSystemTopAt(s, 6, 0)).toBeCloseTo(5, 6)
    expect(roofSystemTopAt(s, 2, 0)).toBeCloseTo(3, 6)
  })
  it('is not the same roof as a T-shaped house with the same two ridge directions', () => {
    const t = solveRoofSystem([MAIN, WING])
    expect(total(t)).not.toBeCloseTo(total(s), 3)
    expect(t.relations[0].kind).toBe('VALLEY')
    expect(s.relations[0].kind).toBe('CROSS_GABLE')
  })
  it('a ridge read a little above the main ridge meets it (a named adjustment), not a step', () => {
    const tall = solveRoofSystem([MAIN, { ...cross, rect: { x0: 2, z0: 0, x1: 10, z1: 4 }, ridgeY: 7.15 }])
    expect(tall.adjustments).toHaveLength(1)
    expect(tall.adjustments[0]).toMatchObject({ regionId: 'roof-cross', property: 'ridgeY', from: 7.15, to: 7 })
    expect(tall.regions.find((r) => r.id === 'roof-cross')?.ridgeY).toBe(7)
  })
})

describe('roof system: hips, several wings, a ridge on the ridge', () => {
  it('a gable wing runs into a hip main roof the same way', () => {
    const s = solveRoofSystem([{ ...MAIN, kind: 'HIP', hipRunM: 4 }, WING])
    expect(s.relations[0].kind).toBe('VALLEY')
    expect(s.creases.filter((c) => c.kind === 'VALLEY')).toHaveLength(2)
    expect(total(s)).toBeCloseTo(96 + 20, 6)
  })
  it('a hip wing has no hip end where it runs into the main roof, and one at its free end', () => {
    const s = solveRoofSystem([MAIN, { ...WING, kind: 'HIP', hipRunM: 2 }])
    const ids = s.planes.filter((p) => p.regionId === 'roof-wing').map((p) => p.id).sort()
    expect(ids).toEqual(['roof-wing-maxX', 'roof-wing-minX', 'roof-wing-minZ'])
    expect(s.creases.filter((c) => c.kind === 'VALLEY')).toHaveLength(2)
    expect(s.creases.filter((c) => c.kind === 'HIP')).toHaveLength(2)
    expect(total(s)).toBeCloseTo(96 + 20, 6)
  })
  it('two wings on one slope leave it one polygon with two notches', () => {
    const a = { ...WING, id: 'roof-a', hostBodyId: 'a', rect: { x0: 1, z0: -5, x1: 5, z1: 0 } }
    const b = { ...WING, id: 'roof-b', hostBodyId: 'b', rect: { x0: 7, z0: -5, x1: 11, z1: 0 } }
    const s = solveRoofSystem([MAIN, a, b])
    expect(s.planes.filter((p) => p.id.startsWith('roof-main-minZ'))).toHaveLength(1)
    expect(area(planeOf(s, 'roof-main-minZ').boundary)).toBeCloseTo(48 - 8, 6)
    expect(s.creases.filter((c) => c.kind === 'VALLEY')).toHaveLength(4)
  })
  it('a wing as high as the main roof splits the slope in two at the ridge', () => {
    const s = solveRoofSystem([MAIN, { ...WING, rect: { x0: 2, z0: -5, x1: 10, z1: 0 }, ridgeY: 7 }])
    const pieces = s.planes.filter((p) => p.id.startsWith('roof-main-minZ'))
    expect(pieces.map((p) => p.id).sort()).toEqual(['roof-main-minZ-0', 'roof-main-minZ-1'])
    expect(pieces.reduce((t, p) => t + area(p.boundary), 0)).toBeCloseTo(48 - 16, 6)
    // the wing ridge reaches the main ridge at (6, 4)
    expect(s.creases.some((c) => c.kind === 'RIDGE' && c.regionIds[0] === 'roof-wing' && [c.start, c.end].some((p) => p.x === 6 && p.z === 4))).toBe(true)
  })
})

describe('roof system: parameters after the last transformation', () => {
  it('heights read over a long span and kept over a short one are named as not one roof\'s (never clipped to a limit)', () => {
    // a ridge 8.51 m over eaves 3.30 m was read across 11.72 m (41.7°); turned along the body, the span is 3.39 m
    const s = solveRoofSystem([{ id: 'roof-wing', hostBodyId: 'wing', rect: { x0: 0, z0: 0, x1: 3.3852, z1: 11.718 }, kind: 'HIP', ridgeAxis: 'Z', eaveY: 3.298924, ridgeY: 8.511048, thicknessM: T }])
    expect(s.violations).toHaveLength(1)
    expect(s.violations[0].property).toBe('pitchDeg')
    expect(s.violations[0].value).toBeCloseTo(72.0092, 2)
    // the same heights over the span they were read across are a roof
    expect(solveRoofSystem([{ id: 'roof-wing', hostBodyId: 'wing', rect: { x0: 0, z0: 0, x1: 11.718, z1: 3.3852 }, kind: 'GABLE', ridgeAxis: 'Z', eaveY: 3.298924, ridgeY: 8.511048, thicknessM: T }]).violations).toEqual([])
  })
  it('a ridge that is not above its eaves is refused by name and takes no part', () => {
    const s = solveRoofSystem([MAIN, { ...WING, ridgeY: 2.9 }])
    expect(s.violations.some((v) => v.regionId === 'roof-wing' && v.property === 'ridgeY')).toBe(true)
    expect(s.planes.every((p) => p.regionId === 'roof-main')).toBe(true)
  })
})
