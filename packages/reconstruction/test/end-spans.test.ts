/**
 * BUILDPLAN-ANALYZER-005I §15–§16: a short end segment the drawing states is a span of the building, and walls may
 * refute a frame's side but never state one.
 *
 * Blind round 7 trimmed a `100` end segment — read the same by both readers and bound to its span — because the scale
 * kept was 3 % short and the reading missed it by 2.5 px; the frame stopped 0.9 m inside the house. The trim exists for
 * witness lines struck past a chain's last segment, and keeps doing that; what changes is that a segment the drawing
 * states (ticks at both ends, and a number printed on it or a neighbouring line ending where it ends) is not a stub,
 * and that every decision is on the record.
 */
import { describe, expect, it } from 'vitest'
import { dimensionedAxis, refuteByWalls } from '../src/index.js'
import type { PlanExtent } from '../src/index.js'
import type { DimensionChain } from '@buildapp/source-metrics'
import type { Band } from '@buildapp/source-cv'
import type { WallWitness } from '../src/plan-extent.js'

type Seg = DimensionChain['segments'][number]
const seg = (fromPx: number, toPx: number, origin: Seg['origin'] | 'UNRESOLVED', extra: Partial<Seg> = {}): Seg => ({
  index: 0,
  fromPx,
  toPx,
  pixelLength: toPx - fromPx,
  confidence: origin === 'READ' ? 0.9 : 0,
  ...(origin === 'UNRESOLVED' ? {} : { origin, valueCm: (toPx - fromPx) * 2.5 }),
  ...extra,
})
const vChain = (id: string, baselinePx: number, ticks: number[], segments: Seg[], extra: Partial<DimensionChain> = {}): DimensionChain => ({
  id,
  frameId: 'f',
  assetId: 'a',
  axis: 'VERTICAL',
  baselinePx,
  ticksPx: ticks,
  marks: ticks.map((atPx) => ({ atPx, class: 'TICK' as const, reasons: [] })),
  segments: segments.map((s, index) => ({ ...s, index })),
  closes: false,
  observationIds: [],
  ocrTokenIds: [],
  ...extra,
})

// 100 / 900 / 100 at 2.5 cm/px: the ends are 40 px, the middle 360 px; only the middle reads.
const TICKS = [120, 160, 520, 560]

describe('§15 short end spans', () => {
  it('an unread 40 px end segment with nothing stating it is trimmed — and the trim is on the record', () => {
    const c = vChain('c', 84, TICKS, [seg(120, 160, 'UNRESOLVED'), seg(160, 520, 'READ'), seg(520, 560, 'UNRESOLVED')])
    const axis = dimensionedAxis([c], 'VERTICAL')
    expect(axis).toMatchObject({ lo: 160, hi: 520 })
    expect(axis?.endSpans.map((e) => `${e.end}:${e.decision}`)).toEqual(['LO:TRIMMED_STUB', 'HI:TRIMMED_STUB'])
  })

  it('a labelled end segment between two ticks is kept: the number printed on it says it is a span', () => {
    const c = vChain('c', 84, TICKS, [seg(120, 160, 'UNRESOLVED', { labelled: true }), seg(160, 520, 'READ'), seg(520, 560, 'DERIVED', { labelled: true })])
    const axis = dimensionedAxis([c], 'VERTICAL')
    expect(axis).toMatchObject({ lo: 120, hi: 560 })
    expect(axis?.endSpans.map((e) => `${e.end}:${e.decision}`)).toEqual(['LO:KEPT_SUPPORTED', 'HI:KEPT_SUPPORTED'])
  })

  it('an unlabelled end segment is kept where a neighbouring line ends at the same mark (the topology states it)', () => {
    const c = vChain('c', 84, TICKS, [seg(120, 160, 'UNRESOLVED'), seg(160, 520, 'READ'), seg(520, 560, 'UNRESOLVED')], { topology: { groupId: 'g', roles: ['SUBDIVISION'], alignedEnds: [false, true] } })
    const axis = dimensionedAxis([c], 'VERTICAL')
    expect(axis).toMatchObject({ lo: 160, hi: 560 })
    expect(axis?.endSpans.map((e) => `${e.end}:${e.decision}`)).toEqual(['LO:TRIMMED_STUB', 'HI:KEPT_SUPPORTED'])
  })

  it('a doubted end mark ends nothing on its own: a labelled segment ending at a questionable mark is still trimmed', () => {
    const c = vChain('c', 84, TICKS, [seg(120, 160, 'UNRESOLVED'), seg(160, 520, 'READ'), seg(520, 560, 'UNRESOLVED', { labelled: true })])
    c.marks = TICKS.map((atPx) => ({ atPx, class: atPx === 560 ? ('QUESTIONABLE' as const) : ('TICK' as const), reasons: atPx === 560 ? ['TEXT_INK' as const] : [] }))
    expect(dimensionedAxis([c], 'VERTICAL')?.hi).toBe(520)
  })

  it('a long unread end segment was never a stub (the 005B rule stands): nothing to decide, nothing recorded', () => {
    const c = vChain('c', 84, [120, 400, 560], [seg(120, 400, 'READ'), seg(400, 560, 'UNRESOLVED')])
    const axis = dimensionedAxis([c], 'VERTICAL')
    expect(axis).toMatchObject({ lo: 120, hi: 560 })
    expect(axis?.endSpans).toEqual([])
  })
})

const band = (axis: 'HORIZONTAL' | 'VERTICAL', x0: number, y0: number, x1: number, y1: number): Band => ({
  axis,
  bounds: { x0, y0, x1, y1 },
  thickness: 12,
  length: axis === 'VERTICAL' ? y1 - y0 : x1 - x0,
  fill: 1,
  axisPx: axis === 'VERTICAL' ? (x0 + x1) / 2 : (y0 + y1) / 2,
  pieces: 1,
  segments: [{ from: axis === 'VERTICAL' ? y0 : x0, to: axis === 'VERTICAL' ? y1 : x1 }],
})

describe('§16 walls refute a side, never state one', () => {
  // A house whose walls run 120–560 in y; a frame that stops at 520 (an extent cut through the house).
  const witness: WallWitness = {
    rect: { x0: 100, y0: 120, x1: 500, y1: 560 },
    bands: [band('VERTICAL', 100, 120, 112, 560), band('VERTICAL', 488, 120, 500, 560), band('HORIZONTAL', 100, 120, 500, 132), band('HORIZONTAL', 100, 548, 500, 560)],
    detached: 0,
    why: 'test',
  }
  const extent: PlanExtent = { rect: { x0: 100, y0: 120, x1: 500, y1: 520 }, weak: false, why: 'the chains', provenance: { x: 'DIMENSION_CHAIN_EXTENT', y: 'DIMENSION_CHAIN_EXTENT' } }

  it('with no dimension mark out there, the frame is kept and downgraded — the walls do not move it', () => {
    const out = refuteByWalls(extent, [], witness, 12)
    expect(out.rect).toEqual(extent.rect)
    expect(out.weak).toBe(true)
    expect(out.refutations?.map((r) => `${r.side}:${r.action}`)).toEqual(['S:DOWNGRADED'])
  })

  it('with a tick the drawing prints where the walls end, the side is taken to that tick — a dimension, not a wall', () => {
    const overall = vChain('overall', 60, [120, 560], [seg(120, 560, 'READ')])
    const out = refuteByWalls(extent, [overall], witness, 12)
    expect(out.rect.y1).toBe(560)
    expect(out.refutations?.[0]).toMatchObject({ side: 'S', action: 'ALTERNATE_DIMENSION_MARK', movedToPx: 560, chainId: 'overall' })
    // A side the walls had to question is weighed by the resolver, not taken on trust (post-review A1/E5).
    expect(out.weak).toBe(true)
  })

  // post-review A1/E5: a garage whose two walls run on 240 px past the main block's south side.
  const garage: WallWitness = {
    rect: { x0: 100, y0: 120, x1: 500, y1: 760 },
    bands: [band('VERTICAL', 100, 120, 112, 520), band('VERTICAL', 488, 120, 500, 760), band('VERTICAL', 300, 120, 312, 760), band('HORIZONTAL', 100, 120, 500, 132), band('HORIZONTAL', 100, 508, 300, 520), band('HORIZONTAL', 300, 748, 500, 760)],
    detached: 0,
    why: 'test',
  }

  it('a tick inside a line out there (a window jamb) is no side: only where a line ENDS, where the walls end', () => {
    const openings = vChain('openings', 540, [120, 520, 535, 560, 680, 760], [seg(120, 520, 'READ'), seg(520, 535, 'DERIVED'), seg(535, 560, 'DERIVED'), seg(560, 680, 'DERIVED'), seg(680, 760, 'DERIVED')])
    const out = refuteByWalls(extent, [openings], garage, 12)
    expect(out.refutations?.[0]).toMatchObject({ side: 'S', action: 'ALTERNATE_DIMENSION_MARK', movedToPx: 760, chainId: 'openings' })
    expect(out.weak).toBe(true)
  })

  it('a line that ends short of where the walls end moves nothing: the walls would still run on past it', () => {
    const short = vChain('short', 540, [120, 520, 535, 560], [seg(120, 520, 'READ'), seg(520, 535, 'DERIVED'), seg(535, 560, 'DERIVED')])
    const out = refuteByWalls(extent, [short], garage, 12)
    expect(out.rect).toEqual(extent.rect)
    expect(out.refutations?.map((r) => `${r.side}:${r.action}`)).toEqual(['S:DOWNGRADED'])
    expect(out.weak).toBe(true)
  })

  it('a side the drawing frames with its own overall dimension (OUTER_TOTAL_MARKS) is never asked', () => {
    expect(refuteByWalls({ ...extent, provenance: { x: 'DIMENSION_CHAIN_EXTENT', y: 'OUTER_TOTAL_MARKS' } }, [], garage, 12).refutations).toBeUndefined()
  })

  it('walls that stop at the side refute nothing; a side the walls framed is never asked', () => {
    expect(refuteByWalls({ ...extent, rect: { ...extent.rect, y1: 560 } }, [], witness, 12).refutations).toBeUndefined()
    expect(refuteByWalls({ ...extent, provenance: { x: 'DIMENSION_CHAIN_EXTENT', y: 'WALL_GEOMETRY_EXTENT' } }, [], witness, 12).refutations).toBeUndefined()
  })

  it('one wall running on (a garden wall) is not a contradiction', () => {
    const one: WallWitness = { ...witness, bands: [band('VERTICAL', 100, 120, 112, 560), band('VERTICAL', 488, 120, 500, 515)] }
    expect(refuteByWalls(extent, [], one, 12).refutations).toBeUndefined()
  })
})
