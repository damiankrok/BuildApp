/**
 * Reading a floor plan.
 *
 * A plan's content is its wall bands, the gaps in them, and its stair. The
 * stair is the part this stage is here for: §11 of the brief, and the owner's
 * first finding, both come down to the same thing — a staircase read as a
 * rectangle is a staircase whose topology and orientation are guesses. So the
 * stair is read as a RUN OF TREADS with a walking line, flights, winders and,
 * where the drawing marks it, a direction of ascent; and when no tread run is
 * visible, nothing is reported except the fact that nothing was.
 *
 * What is deliberately not attempted here: text. Reading a room name off a
 * plan is OCR, this extractor has none, and inventing labels from the
 * publisher's room table would attach a name to a place on the drawing that
 * nothing in the image supports. The gap is recorded by name instead.
 */
import { round6 } from '@buildapp/source-common'
import type { PixelPoint, PixelRect } from '@buildapp/source-common'
import { connectedComponents, maskAt, parallelFamilies } from '@buildapp/source-cv'
import type { Mask, Segment } from '@buildapp/source-cv'
import type { ExtractorHandle, ObservationGraphBuilder, SourceCoordinateFrame, SourceObservation } from '@buildapp/source-observations'
import { linearBands } from '../depth.js'
import type { LinearBand } from '../depth.js'
import { scaleRect, scaleToFrame, workingSegments } from '../prepare.js'
import type { Prepared } from '../prepare.js'
import { readStair } from '../stair.js'
import type { StairReading } from '../stair.js'

export type PlanHandles = {
  walls: ExtractorHandle
  openings: ExtractorHandle
  stair: ExtractorHandle
  dimensions: ExtractorHandle
}

export const PLAN_EXTRACTORS: ReadonlyArray<{ key: keyof PlanHandles; name: string; version: string }> = [
  { key: 'walls', name: 'cv.plan-walls', version: '1.0.0' },
  { key: 'openings', name: 'cv.plan-openings', version: '1.0.0' },
  { key: 'stair', name: 'cv.stair-symbol', version: '1.0.0' },
  { key: 'dimensions', name: 'cv.dimension-chains', version: '1.0.0' },
]

export type PlanResult = {
  wallBands: SourceObservation[]
  openingIntervals: SourceObservation[]
  dimensionChains: SourceObservation[]
  stair: { reading: StairReading; symbol: SourceObservation; treads: SourceObservation; walkingLine: SourceObservation; flights: SourceObservation[]; winders: SourceObservation[]; direction: SourceObservation | null } | null
}

const isAxis = (s: Segment): boolean => s.angleDeg < 4 || s.angleDeg > 176 || Math.abs(s.angleDeg - 90) < 4

/** Ink fraction across the band at one position along it, in working coordinates. */
function crossFill(mask: Mask, band: LinearBand, along: number): number {
  const horizontal = band.orientation === 'HORIZONTAL'
  const lo = Math.round(horizontal ? band.rect.y0 : band.rect.x0)
  const hi = Math.round(horizontal ? band.rect.y1 : band.rect.x1)
  let ink = 0
  let total = 0
  for (let k = lo; k <= hi; k += 1) {
    total += 1
    ink += horizontal ? maskAt(mask, Math.round(along), k) : maskAt(mask, k, Math.round(along))
  }
  return total === 0 ? 0 : ink / total
}

/** Whether both of the band's own long edges carry ink at one position along it. */
function edgeFill(mask: Mask, band: LinearBand, along: number): number {
  const horizontal = band.orientation === 'HORIZONTAL'
  const edges = horizontal ? [band.rect.y0, band.rect.y1] : [band.rect.x0, band.rect.x1]
  let present = 0
  for (const edge of edges) {
    let hit = 0
    for (let d = -1; d <= 1; d += 1) hit += horizontal ? maskAt(mask, Math.round(along), Math.round(edge) + d) : maskAt(mask, Math.round(edge) + d, Math.round(along))
    if (hit > 0) present += 1
  }
  return present / edges.length
}

/**
 * Stretches along a wall band where the band's own edges are missing: a
 * doorway or a window reveal.
 *
 * The measure is the band's EDGES and not its interior, because a hatched or
 * poched wall is full of ink whether or not there is a door in it, while its
 * two drawn faces stop where the opening is.
 */
function gapsAlong(mask: Mask, band: LinearBand, minGap: number): Array<{ from: number; to: number }> {
  const horizontal = band.orientation === 'HORIZONTAL'
  const lo = Math.round(horizontal ? band.rect.x0 : band.rect.y0)
  const hi = Math.round(horizontal ? band.rect.x1 : band.rect.y1)
  const gaps: Array<{ from: number; to: number }> = []
  let start = -1
  for (let t = lo; t <= hi; t += 1) {
    const open = edgeFill(mask, band, t) < 0.5
    if (open && start < 0) start = t
    if (!open && start >= 0) {
      if (t - start >= minGap) gaps.push({ from: start, to: t - 1 })
      start = -1
    }
  }
  if (start >= 0 && hi - start >= minGap) gaps.push({ from: start, to: hi })
  // An opening is INSIDE a wall, so a gap that runs to either end of the band
  // is the band stopping, not a hole in it.
  return gaps.filter((g) => g.from > lo + 1 && g.to < hi - 1)
}

const bandCentreLine = (band: LinearBand, from: number, to: number): { a: PixelPoint; b: PixelPoint } => {
  const horizontal = band.orientation === 'HORIZONTAL'
  const mid = horizontal ? (band.rect.y0 + band.rect.y1) / 2 : (band.rect.x0 + band.rect.x1) / 2
  return horizontal ? { a: { x: from, y: mid }, b: { x: to, y: mid } } : { a: { x: mid, y: from }, b: { x: mid, y: to } }
}

export function extractPlan(builder: ObservationGraphBuilder, frame: SourceCoordinateFrame, prepared: Prepared, handles: PlanHandles): PlanResult {
  const { mask, luma, scale } = prepared
  const working = workingSegments(prepared)
  const larger = Math.max(prepared.size.width, prepared.size.height)
  const result: PlanResult = { wallBands: [], openingIntervals: [], dimensionChains: [], stair: null }

  const components = connectedComponents(mask, { minPixels: Math.max(40, Math.round(mask.width * mask.height * 0.0004)) })
  const body = components.length > 0 ? components.reduce((a, c) => (c.pixels > a.pixels ? c : a)) : null
  const bodyRect: PixelRect | null = body ? body.bounds : null

  // ---- wall bands ---------------------------------------------------------
  const bands = linearBands(luma, working.all.filter(isAxis), { minThicknessFrac: 0.004, maxThicknessFrac: 0.045, minLengthFrac: 0.05, minAspect: 2.5, maxBands: 64 })
  for (const band of bands) {
    const rect = scaleRect(band.rect, scale)
    const horizontal = band.orientation === 'HORIZONTAL'
    // How solid the band is: a hatched or poched wall is mostly ink, a pair of
    // stray parallel annotation lines is not.
    const along = Math.round(horizontal ? band.rect.x0 : band.rect.y0)
    const alongEnd = Math.round(horizontal ? band.rect.x1 : band.rect.y1)
    const step = Math.max(1, Math.floor((alongEnd - along) / 64))
    let fillSum = 0
    let fillCount = 0
    for (let t = along; t <= alongEnd; t += step) {
      fillSum += crossFill(mask, band, t)
      fillCount += 1
    }
    const fill = fillCount === 0 ? 0 : fillSum / fillCount
    const observation = builder.observe(handles.walls, {
      frame,
      kind: 'WALL_BAND',
      pixelGeometry: { type: 'RECT', rect },
      semanticHints: ['wall-band'],
      value: { unit: 'px', number: round6(band.thickness * scale) },
      depthLayer: 'HOST_PLANE',
      confidence: round6(Math.min(0.85, 0.35 + fill * 0.5)),
      uncertainty: { positionPx: round6(Math.max(1, larger * 0.004)), angleDeg: 1, reason: 'the band is bounded by its drawn edges; a rendered finish or a dimension line running alongside can widen it' },
      detail: `a ${round6(band.length * scale)}x${round6(band.thickness * scale)}px ${horizontal ? 'horizontal' : 'vertical'} band, ${round6(fill * 100)}% filled across its thickness`,
    })
    result.wallBands.push(observation)

    // ---- the holes in it --------------------------------------------------
    const openings = gapsAlong(mask, band, Math.max(6, prepared.workingSize.width * 0.02))
    for (const gap of openings) {
      const line = bandCentreLine(band, gap.from, gap.to)
      const interval = builder.observe(handles.openings, {
        frame,
        kind: 'OPENING_INTERVAL',
        pixelGeometry: { type: 'SEGMENT', a: scaleToFrame(line.a, scale), b: scaleToFrame(line.b, scale) },
        semanticHints: ['reveal'],
        value: { unit: 'px', number: round6((gap.to - gap.from) * scale) },
        confidence: 0.6,
        uncertainty: { positionPx: round6(Math.max(1, larger * 0.004)), angleDeg: 1, reason: 'the interval is where the band edges stop; a door swing drawn across it shortens the measured gap' },
        detail: `the wall band's edges are absent for ${round6((gap.to - gap.from) * scale)}px along its length`,
      })
      result.openingIntervals.push(interval)
      builder.relate(handles.openings, { kind: 'CONTAINS', from: observation, to: interval, confidence: 0.7, why: 'the interval lies within this band, between its two ends' })
    }
  }

  // ---- dimension chains ---------------------------------------------------
  // Short ticks in a regular row, outside the building's own outline.
  const outside = working.all.filter((s) => {
    if (!bodyRect) return false
    const cx = (s.a.x + s.b.x) / 2
    const cy = (s.a.y + s.b.y) / 2
    const inset = Math.max(4, prepared.workingSize.width * 0.02)
    return cx < bodyRect.x0 + inset || cx > bodyRect.x1 - inset || cy < bodyRect.y0 + inset || cy > bodyRect.y1 - inset
  })
  for (const family of parallelFamilies(outside.filter((s) => s.length <= prepared.workingSize.width * 0.05), { angleToleranceDeg: 3, minMembers: 4 })) {
    if (family.spacing === null || family.spacing <= 1) continue
    const members = family.members
    const points = members.flatMap((s) => [scaleToFrame(s.a, scale), scaleToFrame(s.b, scale)])
    const lines = members.map((s) => ({ a: scaleToFrame(s.a, scale), b: scaleToFrame(s.b, scale) }))
    result.dimensionChains.push(
      builder.observe(handles.dimensions, {
        frame,
        kind: 'PARALLEL_LINE_FAMILY',
        pixelGeometry: { type: 'LINE_FAMILY', lines },
        semanticHints: ['dimension-chain'],
        value: { unit: 'count', number: members.length },
        confidence: 0.5,
        uncertainty: { positionPx: round6(Math.max(1, larger * 0.004)), angleDeg: 2, reason: 'a regular row of ticks outside the outline reads as a dimension chain; the printed numbers themselves are not read here' },
        detail: `${members.length} short parallel ticks at ${round6(family.angleDeg)} degrees, ${round6((family.spacing ?? 0) * scale)}px apart, outside the drawing's outline`,
        note: `spans (${round6(Math.min(...points.map((p) => p.x)))}, ${round6(Math.min(...points.map((p) => p.y)))}) to (${round6(Math.max(...points.map((p) => p.x)))}, ${round6(Math.max(...points.map((p) => p.y)))})`,
      }),
    )
  }
  builder.unresolved('the printed numbers on the dimension chains of this plan', 'this extractor reads geometry only; no OCR is performed, so the chains are located but not valued', 'NOT_ATTEMPTED', frame.assetId)
  builder.unresolved('room names and printed areas on this plan', 'this extractor reads geometry only; attaching the publisher’s room table to places on the drawing would assert a position the image does not support', 'NOT_ATTEMPTED', frame.assetId)

  // ---- the stair ----------------------------------------------------------
  // A staircase is inside the building. The extent of this plan's own wall
  // bands is the best available statement of where that is, and it excludes
  // the patterns that most resemble a flight — terrain hatch, paving, planting
  // — which lie outside the walls and which every other test admits.
  const wallRects = bands.map((b) => b.rect)
  // Inflated by the walls' own thickness: the bands mark the wall FACES, and a
  // stair drawn tight against an outer wall reaches the inside of it.
  const thicknesses = [...bands.map((b) => b.thickness)].sort((a, b) => a - b)
  const margin = thicknesses.length > 0 ? thicknesses[thicknesses.length >> 1] * 1.5 : 0
  const within =
    wallRects.length >= 4
      ? {
          x0: Math.min(...wallRects.map((r) => r.x0)) - margin,
          y0: Math.min(...wallRects.map((r) => r.y0)) - margin,
          x1: Math.max(...wallRects.map((r) => r.x1)) + margin,
          y1: Math.max(...wallRects.map((r) => r.y1)) + margin,
        }
      : undefined
  const analysis = readStair(working.thin, prepared.workingSize, within ? { within } : {}, [...working.thin, ...working.all])
  // Even when no run can be held to be the staircase, the runs that were
  // considered are evidence and are kept. "This plan has four regular runs of
  // strokes and none of them can be held to be the stair" is a finding; an
  // empty graph says nothing at all.
  for (const candidate of analysis.rejected.slice(0, 3)) {
    builder.observe(handles.stair, {
      frame,
      kind: 'PARALLEL_LINE_FAMILY',
      pixelGeometry: { type: 'LINE_FAMILY', lines: candidate.run.treads.map((s) => ({ a: scaleToFrame(s.a, scale), b: scaleToFrame(s.b, scale) })) },
      semanticHints: ['unknown'],
      value: { unit: 'count', number: candidate.run.treads.length },
      confidence: 0.3,
      uncertainty: { positionPx: round6(Math.max(1.5, larger * 0.004)), angleDeg: 3, reason: 'a regular run of strokes whose meaning this extractor could not settle' },
      detail: `${candidate.run.treads.length} strokes ${round6(candidate.run.spacing * scale)}px apart, considered as a possible staircase and not taken: ${candidate.why}`,
      note: 'kept as evidence, not as an assertion that anything here is a stair',
    })
  }
  const reading = analysis.stair
  if (!reading) {
    builder.unresolved(
      'a staircase on this plan',
      `${analysis.rejected.length} regular run(s) of strokes were considered and none could be held to be a staircase; a stair is never inferred from the size of a shaft, so none is reported${analysis.rejected.length > 0 ? `. The closest: ${analysis.rejected[0].why}` : ''}`,
      analysis.rejected.length > 0 ? 'AMBIGUOUS' : 'MISSING',
      frame.assetId,
    )
    return result
  }

  const run = reading.run
  const symbolRect = scaleRect(run.bounds, scale)
  const symbol = builder.observe(handles.stair, {
    frame,
    kind: 'STAIR_SYMBOL',
    pixelGeometry: { type: 'RECT', rect: symbolRect },
    semanticHints: ['stair-flight'],
    value: { unit: 'count', number: run.treads.length },
    confidence: 0.7,
    uncertainty: { positionPx: round6(Math.max(2, larger * 0.005)), reason: 'the extent of the tread run; a landing beyond the last tread is not part of it' },
    detail: `${run.treads.length} evenly spaced strokes ${round6(run.spacing * scale)}px apart, spanning ${round6(run.angleSpreadDeg)} degrees of tread direction`,
  })

  const treads = builder.observe(handles.stair, {
    frame,
    kind: 'STAIR',
    pixelGeometry: { type: 'LINE_FAMILY', lines: run.treads.map((s) => ({ a: scaleToFrame(s.a, scale), b: scaleToFrame(s.b, scale) })) },
    semanticHints: ['tread-line'],
    value: { unit: 'count', number: run.treads.length },
    confidence: 0.72,
    uncertainty: { positionPx: round6(Math.max(1.5, larger * 0.004)), angleDeg: 2, reason: 'a tread partly hidden by a handrail, a landing edge or the direction arrow may be missed, so the count is a lower bound' },
    detail: `the individual tread lines, counted: ${run.treads.length}, median spacing ${round6(run.spacing * scale)}px`,
    alternatives: [{ why: 'a tread overlapped by the direction arrow or a landing edge can be missed, so one more tread than counted is admissible', confidence: 0.3, count: run.treads.length + 1 }],
  })
  builder.relate(handles.stair, { kind: 'CONTAINS', from: symbol, to: treads, confidence: 0.9, why: 'the tread lines are what the stair symbol is made of' })

  const walkingLine = builder.observe(handles.stair, {
    frame,
    kind: 'POLYLINE',
    pixelGeometry: { type: 'POLYLINE', points: run.walkingLine.map((p) => scaleToFrame(p, scale)) },
    semanticHints: ['stair-flight'],
    confidence: 0.65,
    uncertainty: { positionPx: round6(Math.max(2, larger * 0.006)), angleDeg: 3, reason: 'the line through the tread midpoints, which is the geometric walking line rather than the drawn one' },
    detail: `the path through the midpoints of the ${run.treads.length} treads: ${run.flights.length} straight flight(s) and ${run.winders.length} turn(s)`,
  })
  builder.relate(handles.stair, { kind: 'CONTAINS', from: symbol, to: walkingLine, confidence: 0.85, why: 'the walking line runs through this stair symbol' })

  const flights = run.flights.map((flight) => {
    const members = run.treads.slice(flight.from, flight.to + 1)
    return builder.observe(handles.stair, {
      frame,
      kind: 'STAIR',
      pixelGeometry: { type: 'POLYLINE', points: run.walkingLine.slice(flight.from, flight.to + 1).map((p) => scaleToFrame(p, scale)) },
      semanticHints: ['stair-flight'],
      value: { unit: 'count', number: members.length },
      confidence: 0.66,
      uncertainty: { positionPx: round6(Math.max(2, larger * 0.006)), angleDeg: 3 },
      detail: `${members.length} consecutive treads all within ${round6(6)} degrees of ${round6(flight.angleDeg)}: one straight flight`,
    })
  })
  const winders = run.winders.map((winder) => {
    const pts = run.walkingLine.slice(winder.from, winder.to + 1).map((p) => scaleToFrame(p, scale))
    const region: PixelRect = {
      x0: round6(Math.min(...pts.map((p) => p.x))),
      y0: round6(Math.min(...pts.map((p) => p.y))),
      x1: round6(Math.max(...pts.map((p) => p.x))),
      y1: round6(Math.max(...pts.map((p) => p.y))),
    }
    return builder.observe(handles.stair, {
      frame,
      kind: 'STAIR',
      pixelGeometry: { type: 'RECT', rect: region.x1 > region.x0 && region.y1 > region.y0 ? region : { ...region, x1: region.x1 + 1, y1: region.y1 + 1 } },
      semanticHints: ['stair-winder'],
      value: { unit: 'deg', number: winder.turnDeg },
      confidence: 0.6,
      uncertainty: { positionPx: round6(Math.max(2, larger * 0.006)), reason: 'the region spanned by the treads whose direction changes' },
      detail: `treads ${winder.from + 1}-${winder.to + 1} fan through ${round6(winder.turnDeg)} degrees rather than running parallel: the flight turns here`,
    })
  })
  for (const f of [...flights, ...winders]) builder.relate(handles.stair, { kind: 'CONTAINS', from: symbol, to: f, confidence: 0.8, why: 'this part of the run lies within the stair symbol' })

  let direction: SourceObservation | null = null
  if (reading.direction) {
    const d = reading.direction
    direction = builder.observe(handles.stair, {
      frame,
      kind: 'STAIR',
      pixelGeometry: { type: 'SEGMENT', a: scaleToFrame(d.tail, scale), b: scaleToFrame(d.head, scale) },
      semanticHints: ['stair-direction'],
      confidence: d.confidence,
      uncertainty: { positionPx: round6(Math.max(2, larger * 0.006)), angleDeg: 4, reason: 'the arrow locates the direction of ascent; which storey it ascends to is not on this drawing' },
      detail: d.evidence,
    })
    builder.relate(handles.stair, { kind: 'CONTAINS', from: symbol, to: direction, confidence: 0.85, why: 'the direction mark is drawn within the stair symbol' })
  } else {
    builder.unresolved('the direction of ascent of this stair', 'no arrowhead was found on any line running up the flight, so the drawing does not settle which end climbs', 'AMBIGUOUS', frame.assetId)
  }

  result.stair = { reading, symbol, treads, walkingLine, flights, winders, direction }
  return result
}
