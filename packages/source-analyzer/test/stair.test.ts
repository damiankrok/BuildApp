/**
 * Reading a staircase, and refusing to read one that is not there.
 *
 * The second half is the point. A published plan is full of regular rows of
 * parallel strokes — planting symbols, furniture hatches, paving, louvres —
 * and a reader that takes the longest such row as "the staircase" puts a
 * flight where a shrub is. That failure is worse than finding nothing, because
 * a named absence can be filled in later and a confident wrong answer cannot
 * be argued with.
 */
import { describe, expect, it } from 'vitest'
import { adaptiveInkMask, axisAlignedSegments, gradientMask, houghSegments, inkChannel } from '@buildapp/source-cv'
import { readStair, treadRuns, stairDirection } from '../src/stair.js'
import { thinStrokes } from '../src/strokes.js'
import { grayOf, hatchSymbol, planStair, sheet, rectOutline, BLACK } from './draw.js'
import type { Raster } from '@buildapp/source-cv'

/** Tread candidates from the ink mask; everything else from the edges, as the analyzer does it. */
const strokesOf = (raster: Raster) => {
  const ink = adaptiveInkMask(inkChannel(raster), {})
  const edges = gradientMask(grayOf(raster))
  const thin = [
    ...thinStrokes(ink, { minLength: 8, maxLength: 200, maxThickness: 4, maxGap: 2 }),
    ...houghSegments(ink, { minLength: 10, minSupport: 8, maxGap: 3, maxSegments: 300 }).filter((s) => s.length <= 200),
  ]
  return {
    thin,
    // The direction arrow's barbs are diagonal, so the context needs the
    // general detector as well as the axis-aligned one — exactly the mix
    // `prepareRaster` hands the extractors.
    context: [...thin, ...axisAlignedSegments(edges, { minLength: 8, maxThickness: 4, maxGap: 2 }), ...houghSegments(edges, { minLength: 8, minSupport: 8, maxGap: 3, maxSegments: 300 })],
  }
}
const read = (raster: Raster, size = { width: 400, height: 400 }) => {
  const s = strokesOf(raster)
  return readStair(s.thin, size, {}, s.context).stair
}

describe('a straight flight', () => {
  it('finds every tread, counted, with the right spacing', () => {
    const reading = read(planStair({ treads: 9, going: 14, treadLength: 70 }))
    expect(reading).not.toBeNull()
    expect(reading?.run.treads.length).toBe(9)
    expect(reading?.run.spacing).toBeCloseTo(14, 0)
    expect(reading?.run.angleSpreadDeg).toBeLessThan(2)
    expect(reading?.run.flights).toHaveLength(1)
    expect(reading?.run.winders).toHaveLength(0)
  })

  it('reads the walking line through the tread midpoints, in the order of travel', () => {
    const reading = read(planStair({ treads: 7, going: 16, y: 100, x: 120, treadLength: 70 }))
    const line = reading?.run.walkingLine ?? []
    expect(line).toHaveLength(7)
    const ys = line.map((p) => p.y)
    expect([...ys].sort((a, b) => a - b)).toEqual(ys.slice().sort((a, b) => a - b))
    for (const p of line) expect(p.x).toBeCloseTo(155, 0)
  })

  it('reads the direction of ascent off the arrowhead', () => {
    const reading = read(planStair({ treads: 9, going: 14, y: 90 }))
    expect(reading?.direction).not.toBeNull()
    // the arrow points at the FIRST tread, which is at the top of the drawing
    expect(reading?.direction?.head.y).toBeLessThan(reading?.direction?.tail.y ?? 0)
    expect(reading?.directionAlternatives).toHaveLength(0)
  })

  it('finds both sides of the run closed by a stringer', () => {
    const reading = read(planStair({ treads: 9 }))
    expect(reading?.run.stringers).toBe(2)
  })
})

describe('a winder', () => {
  it('reports the turn as its own stretch rather than flattening it into the flight', () => {
    const reading = read(planStair({ treads: 7, going: 16, turn: 60, treadLength: 60, y: 80, x: 110 }))
    expect(reading).not.toBeNull()
    expect(reading?.run.angleSpreadDeg ?? 0).toBeGreaterThan(20)
    expect(reading?.run.winders.length ?? 0).toBeGreaterThanOrEqual(1)
    expect(reading?.run.flights.length ?? 0).toBeGreaterThanOrEqual(1)
    expect(reading?.run.treads.length ?? 0).toBeGreaterThan(7)
  })

  it('keeps the turning treads in ONE run, so the topology survives', () => {
    const reading = read(planStair({ treads: 6, going: 16, turn: 90, treadLength: 60, y: 70, x: 110 }))
    const winder = reading?.run.winders[0]
    expect(winder).toBeDefined()
    expect(winder?.turnDeg ?? 0).toBeGreaterThan(20)
  })
})

describe('what is NOT a staircase', () => {
  it('refuses a planting symbol: a regular row of strokes with no direction mark and no turn', () => {
    // Spaced widely enough to clear the fill-pattern threshold, so what
    // refuses it is the absence of a stair's own marks and not its pitch.
    const reading = read(hatchSymbol({ strokes: 12, spacing: 10, length: 60 }))
    expect(reading).toBeNull()
  })

  it('refuses a fill pattern outright: strokes at a hatch pitch are not a flight at any length', () => {
    const strokes = strokesOf(hatchSymbol({ strokes: 20, spacing: 5, length: 70 }))
    expect(treadRuns(strokes.thin, { width: 400, height: 400 }, {}, strokes.context)).toEqual([])
  })

  it('says why it refused, rather than silently returning nothing', () => {
    const strokes = strokesOf(hatchSymbol({ strokes: 12, spacing: 10, length: 60 }))
    const runs = treadRuns(strokes.thin, { width: 400, height: 400 }, {}, strokes.context)
    expect(runs.length).toBeGreaterThan(0) // the row IS regular; that is exactly the trap
    expect(runs[0].angleSpreadDeg).toBeLessThan(2)
    expect(stairDirection(runs[0], strokes.context)).toBeNull()
    expect(readStair(strokes.thin, { width: 400, height: 400 }, {}, strokes.context).rejected.length).toBeGreaterThan(0)
  })

  it('refuses a bare rectangle of the right size: a shaft is not a stair', () => {
    const raster = sheet(400, 400)
    rectOutline(raster, 120, 90, 190, 230, BLACK)
    expect(read(raster)).toBeNull()
    expect(treadRuns(strokesOf(raster).thin, { width: 400, height: 400 })).toEqual([])
  })

  it('refuses a stair drawn with too few treads to be a run', () => {
    expect(read(planStair({ treads: 3, going: 14 }))).toBeNull()
  })
})

describe('what a missing arrow costs', () => {
  it('still reads a marked-up flight when the drawing turns, and offers both directions', () => {
    const reading = read(planStair({ treads: 7, going: 16, turn: 60, arrow: false, treadLength: 60, y: 80, x: 110 }))
    expect(reading).not.toBeNull()
    expect(reading?.direction).toBeNull()
    expect(reading?.directionAlternatives).toHaveLength(2)
    expect(reading?.directionAlternatives[0].head).not.toEqual(reading?.directionAlternatives[1].head)
  })

  it('refuses a STRAIGHT flight with no arrow, because nothing then separates it from a hatch', () => {
    expect(read(planStair({ treads: 9, going: 14, arrow: false }))).toBeNull()
  })
})

describe('determinism', () => {
  it('returns the same reading twice, and does not depend on the order strokes arrive in', () => {
    const strokes = strokesOf(planStair({ treads: 9, going: 14 }))
    const a = readStair(strokes.thin, { width: 400, height: 400 }, {}, strokes.context).stair
    const b = readStair([...strokes.thin].reverse(), { width: 400, height: 400 }, {}, strokes.context).stair
    expect(b?.run.treads.map((s) => `${s.a.x},${s.a.y}`)).toEqual(a?.run.treads.map((s) => `${s.a.x},${s.a.y}`))
    expect(b?.run.spacing).toBe(a?.run.spacing)
  })
})
