/**
 * Where a plan's building is, from physical evidence (BUILDPLAN-ANALYZER-005B).
 *
 * A chain's role is decided from geometry alone, before it may frame
 * anything: an interior chain that does not span the walls is never the
 * building's extent, and when it is refused the axis is taken from what the
 * drawing does say — an exterior chain's ticks, else the walls. When nothing
 * that framed the plan is refused, the legacy frame stands byte for byte.
 */
import { describe, expect, it } from 'vitest'
import { runLengthBands } from '@buildapp/source-cv'
import { bandWallThickness, chainRole, decomposePlan, planExtent, wallWitness } from '../src/index.js'
import { WALL, chain, mask, partition, registration, sheet, walls } from './plan.js'
import { BLACK, fillRect } from '../../source-cv/test/draw.js'
import type { DimensionChain, DimensionObservation } from '@buildapp/source-metrics'

const BANDS = { minThickness: 6, maxThickness: 30, minLength: 24 }

const surveyOf = (r: ReturnType<typeof sheet>) => {
  const m = mask(r)
  const bands = runLengthBands(m, BANDS)
  const wallPx = bandWallThickness(bands, WALL)
  return { m, bands, wallPx, witness: wallWitness(bands, wallPx) }
}

/** A 12 × 14 m building (at 5 cm/px) with a partition across it, and a detached logo in the corner of the sheet. */
const building = () => {
  const r = sheet(460, 460)
  walls(r, 40, 40, 279, 319)
  partition(r, 40, 180, 279, 185)
  // the publisher's logo: heavy ink, wall-thick, and nowhere near the building
  walls(r, 380, 390, 440, 440)
  return r
}

describe('the wall witness', () => {
  const { witness } = surveyOf(building())

  it('is the building’s own walls, to their outer faces (the last inked pixel)', () => {
    expect(witness?.rect).toEqual({ x0: 40, y0: 40, x1: 279, y1: 319 })
  })

  it('leaves a detached group of heavy ink — a logo — out', () => {
    expect(witness?.detached).toBeGreaterThanOrEqual(1)
  })
})

describe('a chain’s role, from geometry alone', () => {
  const { witness, wallPx } = surveyOf(building())
  if (!witness) throw new Error('the fixture has no witness')

  it('calls a chain drawn beside the building exterior', () => {
    const role = chainRole(chain('outside', 'VERTICAL', [40, 320], { baselinePx: 20 }), witness, wallPx)
    expect(role.role).toBe('EXTERIOR')
    expect(role.coversWitness).toBe(true)
    expect(role.refused).toBeUndefined()
  })

  it('calls a chain drawn across a room interior, and refuses it as the extent when it does not span the walls', () => {
    const role = chainRole(chain('room', 'VERTICAL', [40, 180], { baselinePx: 160 }), witness, wallPx)
    expect(role.role).toBe('INTERIOR')
    expect(role.coversWitness).toBe(false)
    expect(role.refused).toBe('INTERIOR_BASELINE')
  })

  it('never reads the number printed on the chain: the same chain with other values has the same role', () => {
    const a = chain('room', 'VERTICAL', [40, 180], { baselinePx: 160 })
    const b = { ...a, segments: a.segments.map((s) => ({ ...s, valueCm: (s.valueCm ?? 0) * 3 })) }
    expect(chainRole(b, witness, wallPx)).toEqual(chainRole(a, witness, wallPx))
  })
})

describe('the extent of a plan whose only read depth chain is interior', () => {
  const { bands, wallPx, witness } = surveyOf(building())
  const width = chain('width', 'HORIZONTAL', [40, 280], { baselinePx: 20 })
  const room = chain('room', 'VERTICAL', [40, 180], { baselinePx: 160 })

  it('the legacy frame takes the room for the building', () => {
    const legacy = planExtent([width, room], bands, wallPx)
    expect(legacy?.rect.y1).toBeLessThan(200)
  })

  it('takes the depth from an exterior chain’s ticks when one spans the building, whatever its labels read', () => {
    const ticks = chain('depth-unread', 'VERTICAL', [40, 180, 320], { baselinePx: 310, read: false })
    const e = planExtent([width, room, ticks], bands, wallPx, witness)
    expect(Math.abs((e?.rect.y0 ?? NaN) - 40)).toBeLessThanOrEqual(1)
    expect(Math.abs((e?.rect.y1 ?? NaN) - 320)).toBeLessThanOrEqual(1)
    expect(e?.provenance).toEqual({ x: 'DIMENSION_CHAIN_EXTENT', y: 'EXTERIOR_CHAIN_TICKS' })
    expect(e?.refused).toEqual(['room'])
    expect(e?.weak).toBe(true)
  })

  it('takes the depth from the walls when no exterior chain spans it', () => {
    const e = planExtent([width, room], bands, wallPx, witness)
    expect(Math.abs((e?.rect.y0 ?? NaN) - 40)).toBeLessThanOrEqual(1)
    expect(Math.abs((e?.rect.y1 ?? NaN) - 320)).toBeLessThanOrEqual(1)
    expect(e?.provenance?.y).toBe('WALL_GEOMETRY_EXTENT')
  })

  it('leaves the legacy frame byte for byte when the chains that framed it are not refused', () => {
    const depth = chain('depth', 'VERTICAL', [40, 320], { baselinePx: 310 })
    const legacy = planExtent([width, room, depth], bands, wallPx)
    const e = planExtent([width, room, depth], bands, wallPx, witness)
    expect(e?.rect).toEqual(legacy?.rect)
    expect(e?.weak).toBe(legacy?.weak)
    expect(e?.why).toBe(legacy?.why)
    expect(e?.refused).toEqual([])
  })
})

describe('a front wall that is all openings', () => {
  // The south wall: three openings no wider than a garage door, and between them piers shorter than a wall is long.
  const front = () => {
    const r = sheet(400, 400)
    walls(r, 40, 40, 279, 319, [
      { side: 'S', from: 68, to: 127 },
      { side: 'S', from: 154, to: 213 },
      { side: 'S', from: 240, to: 252 },
    ])
    partition(r, 40, 180, 279, 185)
    return r
  }
  const chains = [chain('cx', 'HORIZONTAL', [40, 280], { baselinePx: 20 }), chain('cy', 'VERTICAL', [40, 320], { baselinePx: 20 })]
  const decompose = (r: ReturnType<typeof sheet>) => {
    const { m, bands, wallPx } = surveyOf(r)
    const frame = planExtent(chains, bands, wallPx)
    if (!frame) throw new Error('the fixture has no frame')
    return decomposePlan(m, chains, bands, registration(), frame.rect)
  }

  it('keeps the rooms behind it: both side walls run to it and stop together', () => {
    const d = decompose(front())
    expect(d.envelope?.rect.y1).toBe(320)
    const built = d.regions.filter((g) => g.classification === 'BUILT')
    const area = built.reduce((a, g) => a + (g.metric.x1 - g.metric.x0) * (g.metric.z1 - g.metric.z0), 0)
    expect(area).toBeCloseTo(12 * 14, 1)
  })

  it('does not follow one wall running on alone — a garden wall is not the building', () => {
    const r = sheet(400, 400)
    walls(r, 40, 40, 279, 199)
    // a garden wall continuing the west side, wall-thick, alone
    fillRect(r, 40, 199, 40 + WALL - 1, 319, BLACK)
    const d = decompose(r)
    expect(d.envelope?.rect.y1).toBeLessThanOrEqual(200)
  })
})

describe('post-review (005B): a refused axis is framed by the widest statement, never by a short one', () => {
  const house = () => {
    const r = sheet(400, 400)
    walls(r, 40, 40, 299, 319)
    fillRect(r, 40, 220, 299, 223, BLACK)
    return r
  }

  it('a room chain is refused and a short exterior read chain (corner to window) does not undo it: the outer ticks frame the depth', () => {
    const { bands, wallPx, witness } = surveyOf(house())
    const chains = [
      chain('width', 'HORIZONTAL', [40, 300], { baselinePx: 20 }),
      chain('room', 'VERTICAL', [40, 220], { baselinePx: 150 }),
      chain('west-partial', 'VERTICAL', [40, 110], { baselinePx: 20 }),
      chain('depth-unread', 'VERTICAL', [40, 320], { baselinePx: 330, read: false }),
    ]
    const e = planExtent(chains, bands, wallPx, witness)
    expect(Math.abs((e?.rect.y1 ?? NaN) - 320)).toBeLessThanOrEqual(1)
    expect(e?.refused).toEqual(['room'])
    expect(e?.provenance?.y).toBe('EXTERIOR_CHAIN_TICKS')
    expect(e?.weak).toBe(true)
  })

  it('wall-thick ink attached outside the building (a parapet) does not overrule a read chain that frames the depth', () => {
    const r = sheet(400, 440)
    walls(r, 40, 40, 299, 279)
    // an L-shaped terrace parapet attached at the south-east corner, beyond the east depth chain's line
    fillRect(r, 288, 279, 299, 399, BLACK)
    fillRect(r, 180, 388, 299, 399, BLACK)
    const { bands, wallPx, witness } = surveyOf(r)
    const chains = [chain('width', 'HORIZONTAL', [40, 300], { baselinePx: 20 }), chain('depth', 'VERTICAL', [40, 280], { baselinePx: 330 }), chain('west-depth', 'VERTICAL', [40, 280], { baselinePx: 20 })]
    const e = planExtent(chains, bands, wallPx, witness)
    expect(Math.abs((e?.rect.y1 ?? NaN) - 280)).toBeLessThanOrEqual(1)
  })
})

describe('post-review (005B): side walls running on past a facade frame a terrace, not rooms', () => {
  it('a full-width covered terrace with a pier at its mouth, in front of a wall-thick facade, stays outside', () => {
    const r = sheet(460, 440)
    walls(r, 40, 40, 399, 279)
    fillRect(r, 40, 279, 51, 359, BLACK)
    fillRect(r, 388, 279, 399, 359, BLACK)
    fillRect(r, 205, 348, 229, 359, BLACK) // a masonry pier at the mouth
    const m = mask(r)
    const bands = runLengthBands(m, BANDS)
    const wallPx = bandWallThickness(bands, WALL)
    const witness = wallWitness(bands, wallPx)
    const chains = [chain('w', 'HORIZONTAL', [40, 400], { baselinePx: 20 }), chain('d', 'VERTICAL', [40, 280, 360], { baselinePx: 420 })]
    const e = planExtent(chains, bands, wallPx, witness)
    if (!e) throw new Error('no frame')
    const d = decomposePlan(m, chains, bands, registration(), e.rect)
    expect(d.envelope?.rect.y1).toBeLessThanOrEqual(281)
    const built = d.regions.filter((g) => g.classification === 'BUILT')
    expect(Math.max(...built.map((g) => g.rect.y1))).toBeLessThanOrEqual(281)
  })
})

describe('005D: an overall line beside the building frames an axis a line across it had framed', () => {
  const { bands, wallPx, witness } = surveyOf(building())
  const width = chain('width', 'HORIZONTAL', [40, 280], { baselinePx: 20 })
  type Mark = NonNullable<DimensionChain['marks']>[number]
  const mark = (atPx: number, cls: Mark['class'] = 'TICK', reasons: Mark['reasons'] = []): Mark => ({ atPx, class: cls, reasons })
  // A read depth chain drawn ACROSS the building: it crosses a wall face (a wide dark crossing) and frames 60–300.
  const across = { ...chain('across', 'VERTICAL', [60, 300], { baselinePx: 160 }), marks: [mark(60, 'TICK', ['WEDGE_NOT_STROKE']), mark(300)] }
  // The overall depth printed beside the building, end tick to end tick, its label centred on the whole of it.
  const overall = { ...chain('overall', 'VERTICAL', [40, 320], { baselinePx: 360, read: false }), marks: [mark(40), mark(320)] }
  const label = (chainId: string, from: number, to: number, role: 'PRIMARY' | 'ALTERNATIVE' = 'PRIMARY'): DimensionObservation =>
    ({ id: `obs-${chainId}`, frameId: 'frame-test', assetId: 'asset-test', chainId, textRegionId: 'r', orientation: 'ROTATED_CW', rawText: '1400', valueCm: 1400, axis: 'Y', fromPx: from, toPx: to, spanPx: to - from, impliedCmPerPx: 1400 / (to - from), independence: 'INDEPENDENT', status: 'RAW', ocrScore: 0.5, ocrConfidence: 0.6, leadingZero: false, binding: { role, offsetShare: 0.01, questionableEnds: 0, skipped: { tick: 0, questionable: 0, rejected: 0 } } }) as DimensionObservation

  it('widens the depth to the overall line’s end ticks, weak, naming the chain it outspanned', () => {
    const e = planExtent([width, across, overall], bands, wallPx, witness, [label('overall', 40, 320)])
    expect(e?.rect.y0).toBe(40)
    expect(e?.rect.y1).toBe(320)
    expect(e?.provenance?.y).toBe('OUTER_TOTAL_MARKS')
    expect(e?.refused).toContain('across')
    expect(e?.weak).toBe(true)
  })

  it('does nothing when no label is bound to the whole overall line as its primary span', () => {
    const before = planExtent([width, across, overall], bands, wallPx, witness)
    expect(planExtent([width, across, overall], bands, wallPx, witness, [label('overall', 40, 320, 'ALTERNATIVE')])).toEqual(before)
  })

  it('does nothing when the framing chain crosses no wall face (a read line beside the building is not outspanned)', () => {
    const beside = { ...across, marks: [mark(60), mark(300)] }
    const before = planExtent([width, beside, overall], bands, wallPx, witness)
    expect(planExtent([width, beside, overall], bands, wallPx, witness, [label('overall', 40, 320)])).toEqual(before)
  })

  it('does nothing when the overall line itself crosses a wall face', () => {
    const crossing = { ...overall, marks: [mark(40), mark(180, 'TICK', ['WEDGE_NOT_STROKE']), mark(320)], ticksPx: [40, 180, 320] }
    const before = planExtent([width, across, crossing], bands, wallPx, witness)
    expect(planExtent([width, across, crossing], bands, wallPx, witness, [label('overall', 40, 320)])).toEqual(before)
  })
})
