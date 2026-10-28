/**
 * N8-03B: a door wider than one leaf, as the plan draws it (`drawnLeaves`), what it then is (`classifyOpeningFamily`)
 * and what fills it (`drawnLeafAssembly`), on a synthetic plan in the 005Y-N4 setting (a front wall 0.4 m thick at
 * 0.025 m/px). Every case is invented.
 *  - one leaf hung at a jamb, shorter than the gap, its arc drawn: a leaf beside a fixed light, the leaf its length;
 *  - the same leaf hung at a pivot inside the wall's thickness (drawn past the face only by the rest of its length);
 *  - two leaves meeting from both jambs: a pair;
 *  - two leaves that do not add up to the gap, leaves on both sides of the wall, a leaf with no arc, a line with no
 *    leaf's paper beside it, a leaf as wide as the gap, and a gap with glazing only: nothing;
 *  - a ground-storey opening to the floor wider than a door with such leaves is a glazed door, however wide; without
 *    them it stays what it was; above the ground storey and with a sill it is never asked;
 *  - the fill: panels from the wall's near jamb, the fractions the drawing's and summing to one, a leaf hinged at its
 *    own jamb, reversed with the wall.
 */
import { describe, expect, it } from 'vitest'
import { Canvas } from '@buildapp/synthetic-drawings'
import { doorLeafFound, drawnLeaves } from '../src/v2/openings-v2.js'
import type { DrawnLeaves, WallHost } from '../src/v2/openings-v2.js'
import type { PlanFrameV2 } from '../src/v2/frame.js'
import { classifyOpeningFamily } from '../src/v2/opening-reading.js'
import type { OpeningFamilyFacts, OpeningSymbols } from '../src/v2/opening-reading.js'
import { drawnLeafAssembly } from '../src/v2/emit.js'

const MPP = 0.025
const plan = { frameId: 'p', mppX: MPP, mppY: MPP, toPixel: (x: number, z: number) => ({ x: 60 + x / MPP, y: 300 - z / MPP }), toWorld: (px: number, py: number) => ({ x: (px - 60) * MPP, z: (300 - py) * MPP }) } as unknown as PlanFrameV2
const T = 0.4
const host: WallHost = { massId: 'main', facade: 'FRONT', planeAt: 0, from: 0, to: 12, centreAt: T / 2, storeyIndex: 0, floorY: 0, storeyHeightM: 3 }
const px = (x: number, z: number) => plan.toPixel(x, z)

function wall(c: Canvas, gap: [number, number]): void {
  c.fill(px(0, T).x, px(0, T).y, px(gap[0], 0).x, px(gap[0], 0).y, 0)
  c.fill(px(gap[1], T).x, px(gap[1], T).y, px(12, 0).x, px(12, 0).y, 0)
}
/**
 * A leaf `length` long hung at `jamb`, drawn open to the side `inward` (+1 into the building) from a pivot `pivotDepth`
 * past the wall's face on that side (negative: inside the wall's thickness), and the arc its tip sweeps.
 */
function leaf(c: Canvas, gap: [number, number], jamb: number, length: number, opts: { inward?: 1 | -1; pivotDepth?: number; arc?: boolean } = {}): void {
  const inward = opts.inward ?? 1
  const face = inward === 1 ? T : 0
  const pivotZ = face + inward * (opts.pivotDepth ?? 0)
  const towards = jamb === gap[0] ? 1 : -1
  const hingeX = jamb + towards * 0.03
  const a = px(hingeX, pivotZ)
  const b = px(hingeX, pivotZ + inward * length)
  c.line(a.x, a.y, b.x, b.y, 2, 170)
  if (opts.arc === false) return
  for (let deg = 0; deg <= 90; deg += 0.5) {
    const r = (deg * Math.PI) / 180
    const p = px(hingeX + towards * length * Math.cos(r), pivotZ + inward * length * Math.sin(r))
    c.plot(Math.round(p.x), Math.round(p.y), 150)
  }
}
/** thin glazing lines across the gap, in the wall's thickness */
function glazing(c: Canvas, gap: [number, number]): void {
  for (const z of [T * 0.35, T * 0.65]) {
    const a = px(gap[0], z)
    const b = px(gap[1], z)
    c.line(a.x, a.y, b.x, b.y, 1, 120)
  }
}
const read = (gap: [number, number], draw: (c: Canvas) => void): DrawnLeaves | undefined => {
  const c = new Canvas(560, 500)
  c.fill(0, 0, 559, 499, 236)
  wall(c, gap)
  draw(c)
  return drawnLeaves(c.toRaster(), plan, host, gap, T)
}

describe('leaves drawn shorter than the gap', () => {
  it('one leaf at a jamb, its arc drawn, the rest of the gap empty: a leaf beside a fixed light, the leaf its length', () => {
    const g: [number, number] = [4, 5.5]
    const r = read(g, (c) => leaf(c, g, g[1], 0.85))
    expect(r?.arrangement).toBe('LEAF_AND_LIGHT')
    expect(r?.leaves).toHaveLength(1)
    expect(r?.leaves[0].hingeAt).toBe('HIGH')
    expect(r?.leaves[0].swing).toBe('IN')
    expect(Math.abs((r?.leaves[0].lengthM ?? 0) - 0.85)).toBeLessThanOrEqual(0.08)
  })
  it('the same leaf hung at a pivot inside the wall: its length is the arc’s, not what shows past the face', () => {
    const g: [number, number] = [4, 5.5]
    const r = read(g, (c) => leaf(c, g, g[0], 0.85, { pivotDepth: -0.2 }))
    expect(r?.arrangement).toBe('LEAF_AND_LIGHT')
    expect(r?.leaves[0].hingeAt).toBe('LOW')
    expect(Math.abs((r?.leaves[0].lengthM ?? 0) - 0.85)).toBeLessThanOrEqual(0.08)
  })
  it('an outward leaf is read on the outer side', () => {
    const g: [number, number] = [4, 5.5]
    const r = read(g, (c) => leaf(c, g, g[0], 0.85, { inward: -1 }))
    expect(r?.leaves[0].swing).toBe('OUT')
  })
  it('two leaves from both jambs that meet: a pair', () => {
    const g: [number, number] = [4, 5.8]
    const r = read(g, (c) => {
      leaf(c, g, g[0], 0.9)
      leaf(c, g, g[1], 0.9)
    })
    expect(r?.arrangement).toBe('DOUBLE')
    expect(r?.leaves.map((l) => l.hingeAt)).toEqual(['LOW', 'HIGH'])
  })
  it('two leaves that leave the middle of the gap unswept are neither a pair nor a leaf and a light', () => {
    const g: [number, number] = [4, 6.2]
    expect(read(g, (c) => { leaf(c, g, g[0], 0.6); leaf(c, g, g[1], 0.6) })).toBeUndefined()
  })
  it('leaves drawn on both sides of the wall are not read', () => {
    const g: [number, number] = [4, 5.8]
    expect(read(g, (c) => { leaf(c, g, g[0], 0.9); leaf(c, g, g[1], 0.9, { inward: -1 }) })).toBeUndefined()
  })
  it('a line at a jamb with no arc (a callout’s leader, a partition’s end) is no leaf', () => {
    const g: [number, number] = [4, 5.5]
    expect(read(g, (c) => leaf(c, g, g[1], 0.85, { arc: false }))).toBeUndefined()
  })
  it('a leaf as wide as the gap is no partial leaf: it is the gap’s own, read by doorLeafFound as before', () => {
    const g: [number, number] = [4, 5]
    const c = new Canvas(560, 500)
    c.fill(0, 0, 559, 499, 236)
    wall(c, g)
    leaf(c, g, g[0], 1, { pivotDepth: -T / 2 })
    expect(drawnLeaves(c.toRaster(), plan, host, g, T)).toBeUndefined()
    expect(doorLeafFound(c.toRaster(), plan, host, g, T)).toEqual({ swing: 'IN', hingeAt: 'LOW' })
  })
  it('glazing alone, however wide, holds no leaf', () => {
    const g: [number, number] = [3, 7]
    expect(read(g, (c) => glazing(c, g))).toBeUndefined()
  })
})

const symbols = (leaves?: DrawnLeaves): OpeningSymbols => ({ glazed: () => true, leaf: () => undefined, swingDrawn: () => true, leaves: () => leaves })
const facts = (f: Partial<OpeningFamilyFacts>): OpeningFamilyFacts => ({ storeyIndex: 0, widthM: 1.5, sillAboveFloorM: 0, heightM: 2.3, heightsAssumed: false, doorBySymbol: false, doorSwing: false, attachedSingleStorey: false, symbols: symbols(), ...f })
const light: DrawnLeaves = { arrangement: 'LEAF_AND_LIGHT', leaves: [{ hingeAt: 'HIGH', lengthM: 0.85, swing: 'IN' }], why: 'a leaf and a light' }
const pair: DrawnLeaves = { arrangement: 'DOUBLE', leaves: [{ hingeAt: 'LOW', lengthM: 0.9, swing: 'IN' }, { hingeAt: 'HIGH', lengthM: 0.9, swing: 'IN' }], why: 'a pair' }

describe('what a gap with drawn leaves is', () => {
  it('a ground-storey opening to the floor wider than a door with a leaf and a light, or a pair, is a glazed door that carries them', () => {
    const d = classifyOpeningFamily(facts({ symbols: symbols(light) }))
    expect(d.family).toBe('GLAZED_DOOR')
    expect(d.leaves).toBe(light)
    expect(d.provenance).toBe('SOURCE_DERIVED')
    expect(classifyOpeningFamily(facts({ widthM: 1.8, symbols: symbols(pair) })).leaves).toBe(pair)
  })
  it('so is one as wide as a screen of panes: a leaf drawn in it makes it a terrace door, still one opening', () => {
    const d = classifyOpeningFamily(facts({ widthM: 2.3, symbols: symbols(light) }))
    expect(d.family).toBe('GLAZED_DOOR')
    expect(d.leaves).toBe(light)
  })
  it('without drawn leaves nothing changes: a wide one is multi-panel glazing, a narrower one a glazed door with no leaves', () => {
    expect(classifyOpeningFamily(facts({ widthM: 2.3 })).family).toBe('MULTI_PANEL_GLAZING')
    const d = classifyOpeningFamily(facts({ widthM: 1.5 }))
    expect(d.family).toBe('GLAZED_DOOR')
    expect(d.leaves).toBeUndefined()
  })
  it('the leaves are not asked above the ground storey, with a sill, with assumed heights, or for a single door’s width', () => {
    const asked: string[] = []
    const spy: OpeningSymbols = { ...symbols(light), leaves: () => { asked.push('x'); return light } }
    expect(classifyOpeningFamily(facts({ storeyIndex: 1, widthM: 2.3, symbols: spy })).family).toBe('MULTI_PANEL_GLAZING')
    expect(classifyOpeningFamily(facts({ sillAboveFloorM: 0.9, heightM: 1.3, symbols: spy })).family).toBe('WINDOW')
    classifyOpeningFamily(facts({ heightsAssumed: true, symbols: spy }))
    classifyOpeningFamily(facts({ widthM: 1.0, symbols: spy }))
    expect(asked).toHaveLength(0)
  })
})

describe('what fills a door with drawn leaves', () => {
  it('a leaf at the high jamb and a light: the light first from the near jamb, the leaf hinged at its own (right) edge', () => {
    const a = drawnLeafAssembly(light, 1.5, false)
    expect(a.assembly.panels.map((p) => p.kind)).toEqual(['GLAZED', 'LEAF'])
    expect(a.assembly.panels[1]).toMatchObject({ hinge: 'RIGHT', glazing: 'FULL' })
    expect(a.assembly.panels[1].fraction).toBeCloseTo(0.85 / 1.5, 6)
    expect(a.assembly.panels.reduce((s, p) => s + p.fraction, 0)).toBeCloseTo(1, 9)
    expect(a.hingeSide).toBe('RIGHT')
    expect(a.swing).toBe('IN')
  })
  it('the same on a wall that runs against the plan: the leaf first, hinged at the near (left) jamb', () => {
    const a = drawnLeafAssembly(light, 1.5, true)
    expect(a.assembly.panels.map((p) => p.kind)).toEqual(['LEAF', 'GLAZED'])
    expect(a.assembly.panels[0]).toMatchObject({ hinge: 'LEFT' })
  })
  it('a pair: two leaves, each hinged at its own jamb, sharing the width as drawn', () => {
    const a = drawnLeafAssembly({ ...pair, leaves: [{ ...pair.leaves[0], lengthM: 0.8 }, { ...pair.leaves[1], lengthM: 1.0 }] }, 1.8, false)
    expect(a.assembly.panels.map((p) => (p.kind === 'LEAF' ? p.hinge : p.kind))).toEqual(['LEFT', 'RIGHT'])
    expect(a.assembly.panels[0].fraction).toBeCloseTo(0.8 / 1.8, 6)
    expect(a.assembly.panels.reduce((s, p) => s + p.fraction, 0)).toBe(1)
  })
})
