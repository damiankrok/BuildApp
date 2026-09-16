/**
 * The solver: from sealed evidence to a building candidate.
 *
 * Read the order, because the order is the argument:
 *
 *  1. **Massing** from the plan's dimension chains. The footprint is the one
 *     thing a set of drawings states unambiguously and repeatedly, so it is
 *     settled first and everything else is measured against it.
 *  2. **Levels** from the section's ladder of level datums. Heights are the
 *     other thing a drawing states outright.
 *  3. **Views** are registered against 1 and 2. An elevation states no
 *     dimension of its own, so it borrows both of its scales from numbers
 *     already established — never from a camera fitted to its own pixels.
 *  4. **Openings and facade solids** are read off those registered views,
 *     after fusion has reduced a detector's hundreds of sightings to the
 *     handful of members a building actually has.
 *  5. **The roof** is derived, not read: the ridge height above the eaves and
 *     the span between them give the pitch, and a printed pitch corroborates
 *     it where one is legible.
 *  6. **The DSL program** is emitted and sealed, and nothing else may touch
 *     the model.
 *
 * Three rules hold throughout, and the code is arranged so that breaking them
 * would be conspicuous:
 *
 * - Nothing here knows which project it is reconstructing. There is no
 *   publisher, no project name, no reference model, and no constant that came
 *   from one. Every number is read from the evidence or defaulted from a
 *   building convention that is stated where it is used.
 * - Every primitive that reaches the model carries a trace to the hypothesis,
 *   the evidence and the observations behind it.
 * - Anything the evidence does not determine becomes an entry in `unresolved`.
 *   It is never quietly defaulted into geometry that looks decided.
 */
import { round6, stableId } from '@buildapp/source-common'
import type { PixelRect } from '@buildapp/source-common'
import type { SourceCoordinateFrame, SourceObservation, SourceObservationGraph } from '@buildapp/source-observations'
import type { CoordinateRegistration, MetricEvidence, MetricEvidenceSet } from '@buildapp/source-metrics'
import type { BuildingCommand } from '@buildapp/commands'
import { detectContradictions, solveQuantity } from './constraints.js'
import type { Constraint, SolvedQuantity } from './constraints.js'
import { fuseCandidates } from './fusion.js'
import type { FusionCounts, RawCandidate } from './fusion.js'
import { elevationMetric, registerElevations, silhouetteExtent } from './views.js'
import type { BuildingSide, ElevationRegistration, MassingFacts } from './views.js'
import type { PrimitiveHypothesis, PrimitiveHypothesisSet, UnresolvedHypothesis } from './hypotheses.js'
import type { CandidateContradiction, PrimitiveTrace, SolverStep, UnresolvedCandidate } from './candidate.js'

export const SOLVER_NAME = 'reconstruction.solver' as const
export const SOLVER_VERSION = '1.0.0' as const

/**
 * Building conventions used where the sources say nothing.
 *
 * Every one of these is a DEFAULT, not a measurement, and everything built
 * from one is marked `ASSUMED` and listed in `unresolved`. They are collected
 * here rather than scattered through the code so that a reader can see the
 * whole set of things this solver is prepared to make up, and so that a
 * reviewer can argue with the list.
 */
export const CONVENTIONS = {
  /** A domestic external wall, when no plan dimension measures one. */
  wallThickness: 0.38,
  /** An intermediate floor slab. */
  slabThickness: 0.28,
  /** A roof build-up. */
  roofThickness: 0.28,
  /** An eaves overhang, when no elevation shows one clearly. */
  roofOverhang: 0.6,
  /** A storey, when the section gives no second datum. */
  storeyHeight: 2.8,
  /** The head of a domestic opening above its floor, when nothing states one. */
  openingHead: 2.2,
  /** A window's sill above its floor, when nothing states one. */
  windowSill: 0.9,
  /** A door leaf, when nothing states one. */
  doorHeight: 2.1,
} as const

export type ReconstructionInput = {
  label: string
  slug: string
  graph: SourceObservationGraph
  metrics: MetricEvidenceSet
  /** Restrict to these frames, for a mutation test that removes a drawing. */
  frameFilter?: (frame: SourceCoordinateFrame) => boolean
}

export type SolveContext = {
  steps: SolverStep[]
  constraints: Constraint[]
  quantities: SolvedQuantity[]
  hypotheses: PrimitiveHypothesis[]
  unresolvedHypotheses: UnresolvedHypothesis[]
  unresolved: UnresolvedCandidate[]
  traces: PrimitiveTrace[]
  fusion: FusionCounts
}

const step = (ctx: SolveContext, s: Omit<SolverStep, 'index'>): void => {
  ctx.steps.push({ ...s, index: ctx.steps.length })
}

const gap = (ctx: SolveContext, u: Omit<UnresolvedCandidate, 'id'>): void => {
  ctx.unresolved.push({ ...u, id: stableId('gap', u.what.slice(0, 40), { what: u.what, status: u.status }) })
}

// ---------------------------------------------------------------------------
// 1. massing
// ---------------------------------------------------------------------------

export type PlanChoice = { frame: SourceCoordinateFrame; registration: CoordinateRegistration; evidence: MetricEvidence[] }

/**
 * The plan to measure the building from.
 *
 * Several renderings of one plan are all registered, and they do not all
 * deserve equal weight: the one fitted from the most anchors, at the highest
 * resolution, with the smallest residual, is the one whose numbers to use. The
 * others corroborate it, and a disagreement between them is already recorded
 * as a conflict by the metric layer.
 */
export function choosePlan(graph: SourceObservationGraph, metrics: MetricEvidenceSet, keep?: (f: SourceCoordinateFrame) => boolean): PlanChoice | undefined {
  const candidates = metrics.coordinateRegistrations
    .filter((r) => r.plane === 'PLAN_XZ')
    .map((registration) => ({ registration, frame: graph.coordinateFrames.find((f) => f.id === registration.frameId) }))
    .filter((c): c is { registration: CoordinateRegistration; frame: SourceCoordinateFrame } => c.frame !== undefined)
    .filter((c) => c.frame.roles.storey === 'GROUND' || c.frame.roles.storey === 'UNKNOWN')
    .filter((c) => (keep ? keep(c.frame) : true))
  if (candidates.length === 0) return undefined
  const best = candidates.sort((a, b) => {
    const score = (c: (typeof candidates)[number]): number => c.registration.confidence * 2 + c.registration.anchors.length * 0.1 + Math.min(1, c.frame.size.width / 1000) - c.registration.residual.rmsM * 4
    return score(b) - score(a) || a.frame.id.localeCompare(b.frame.id)
  })[0]
  return { frame: best.frame, registration: best.registration, evidence: metrics.evidence.filter((e) => e.frameId === best.frame.id) }
}

/**
 * The chain on each axis that states the building's own dimension.
 *
 * Not simply the longest one. A plan carries several chains per axis and they
 * measure different things: the walls, the walls plus a terrace, one wing, a
 * run of internal divisions. Length alone picks whichever happens to reach
 * furthest across the sheet, which on a plan with an entrance zone at each end
 * is the one that includes the zones — and the building comes out two metres
 * too deep with no indication that anything went wrong.
 *
 * Three signals, in order:
 *
 *  1. **Corroboration.** Two chains on one axis whose totals agree are stating
 *     the same dimension twice, which is as close to certain as a drawing
 *     gets. That is the case the overall dimension and its own subdivision
 *     make — `1205` above `790 + 415` — and it wins outright.
 *  2. **How much of it was actually READ.** A chain every segment of which
 *     carries a printed number is a statement; one held together by segments
 *     derived from the scale is an inference, and inference loses.
 *  3. **Span**, last, to separate what the first two leave tied.
 *
 * The totals that lose are not discarded — they stay in the metric evidence as
 * the chains they are, so the zones and the subdivisions remain on the record.
 */
export function footprintFrom(metrics: MetricEvidenceSet, frameId: string): { width?: { value: number; chainId: string; evidenceIds: string[]; hard: boolean; why: string }; depth?: { value: number; chainId: string; evidenceIds: string[]; hard: boolean; why: string } } {
  const byId = new Map(metrics.evidence.map((e) => [e.id, e]))
  // A chain's total is recomputed here from the EVIDENCE its segments cite,
  // not read off the chain record. The chain knows the structure — which
  // segments there are and in what order — and the evidence knows the values,
  // and keeping one copy of each means a corrected reading reaches the
  // building instead of being shadowed by a total computed before the
  // correction.
  const valued = (c: (typeof metrics.chains)[number]): Array<{ value: number; origin: string; confidence: number; id?: string }> =>
    c.segments.map((s) => {
      const evidence = s.evidenceId ? byId.get(s.evidenceId) : undefined
      return { value: evidence?.value ?? s.valueCm ?? Number.NaN, origin: evidence?.origin ?? s.origin ?? 'UNRESOLVED', confidence: evidence?.confidence ?? s.confidence, id: s.evidenceId }
    })
  const chains = metrics.chains.filter((c) => c.frameId === frameId && c.segments.length > 0 && valued(c).every((v) => Number.isFinite(v.value)))
  const pick = (axis: 'HORIZONTAL' | 'VERTICAL') => {
    const mine = chains.filter((c) => c.axis === axis)
    if (mine.length === 0) return undefined
    const span = (c: (typeof mine)[number]): number => c.ticksPx[c.ticksPx.length - 1] - c.ticksPx[0]
    const readFraction = (c: (typeof mine)[number]): number => {
      const parts = valued(c)
      return parts.length === 0 ? 0 : parts.filter((p) => (p.origin === 'READ' || p.origin === 'CHAIN_CORRECTED') && p.confidence > 0.05).length / parts.length
    }
    const totalOf = (c: (typeof mine)[number]): number => round6(valued(c).reduce((a, p) => a + p.value, 0))
    const widest = Math.max(...mine.map(span))
    const scored = mine.map((c) => {
      const total = totalOf(c)
      const agrees = mine.filter((other) => other.id !== c.id && Math.abs(totalOf(other) - total) <= Math.max(2, total * 0.01))
      return { chain: c, total, agrees, score: agrees.length * 10 + readFraction(c) * 5 + span(c) / Math.max(1, widest) }
    })
    const best = scored.sort((a, b) => b.score - a.score || b.total - a.total || a.chain.id.localeCompare(b.chain.id))[0]
    const evidenceIds = valued(best.chain).map((p) => p.id).filter((id): id is string => id !== undefined)
    const fraction = readFraction(best.chain)
    // A total is a STATEMENT of the drawing only when every part of it was
    // printed there, or when a second chain that has SOME printed part says
    // the same thing. Two chains agreeing where neither carries a legible
    // number are not two statements — they are one sheet scale, derived
    // twice, and treating that as exact would make an inference unfalsifiable.
    const hard = fraction === 1 || (best.agrees.length > 0 && fraction > 0)
    return {
      value: round6(best.total / 100),
      chainId: best.chain.id,
      evidenceIds,
      hard,
      why:
        best.agrees.length > 0
          ? `two ${axis.toLowerCase()} chains agree on ${round6(best.total / 100)} m`
          : fraction === 1
            ? `a ${axis.toLowerCase()} chain whose every segment is printed sums to ${round6(best.total / 100)} m`
            : `the best-supported ${axis.toLowerCase()} chain sums to ${round6(best.total / 100)} m, with ${Math.round((1 - fraction) * 100)} per cent of it derived from the sheet scale rather than printed`,
    }
  }
  return { width: pick('HORIZONTAL'), depth: pick('VERTICAL') }
}

// ---------------------------------------------------------------------------
// 2. levels
// ---------------------------------------------------------------------------

export type LevelFacts = {
  /** Floor elevations above the entrance level, ground up. */
  floors: number[]
  /** Storey heights between them. */
  heights: number[]
  /** The highest datum the section prints: the ridge, where one is marked. */
  topDatum?: number
  /** The datum below the ridge: where the walls stop and the roof begins. */
  eaves?: number
  evidenceIds: string[]
  /** Whether the heights came from printed datums or from a convention. */
  measured: boolean
}

/**
 * The storeys, from the heights a section prints.
 *
 * A published section marks the finished floor of each storey and the ridge.
 * The gaps between consecutive datums are storey heights — except the last
 * one, which is the roof and is not a storey. Telling them apart needs one
 * rule, and the rule is geometric: the top datum is the ridge when the drawing
 * also shows a roof, and a gap smaller than a door is not a storey at all.
 */
export function levelsFrom(metrics: MetricEvidenceSet, frameId?: string): LevelFacts {
  const datums = metrics.evidence
    .filter((e) => e.kind === 'LEVEL_DATUM' && (frameId === undefined || e.frameId === frameId))
    .filter((e) => e.association.kind !== 'UNATTACHED')
    .sort((a, b) => a.value - b.value)
  if (datums.length < 2) return { floors: [0], heights: [CONVENTIONS.storeyHeight], evidenceIds: datums.map((d) => d.id), measured: false }
  const values: number[] = []
  for (const d of datums) {
    // Two datums a few centimetres apart are a finished floor and a structural
    // one, not two storeys.
    if (values.length > 0 && Math.abs(d.value - values[values.length - 1]) < 0.4) continue
    values.push(round6(d.value))
  }
  const topDatum = values[values.length - 1]
  // A section of a pitched house marks its heights in a fixed order: the floor
  // of each storey, then the EAVES where the walls stop, then the ridge. So
  // the top two datums are not storeys — the highest is the roof's apex and
  // the one below it is the top of the walls — and reading them as floors is
  // how a two-storey house comes out three storeys tall with a flat roof
  // wedged inside it.
  //
  // Below three datums there is nothing to split: a section that prints only a
  // floor and a ridge states no storey height at all, and the last gap is
  // taken as the storey rather than invented.
  const hasEaves = values.length >= 3
  const eaves = hasEaves ? values[values.length - 2] : undefined
  const floors = hasEaves ? values.slice(0, values.length - 2) : values.slice(0, Math.max(1, values.length - 1))
  const heights: number[] = []
  for (let i = 0; i + 1 < floors.length; i += 1) heights.push(round6(floors[i + 1] - floors[i]))
  if (eaves !== undefined && floors.length > 0) heights.push(round6(eaves - floors[floors.length - 1]))
  else if (heights.length === 0) heights.push(CONVENTIONS.storeyHeight)
  else heights.push(heights[heights.length - 1])
  return { floors, heights, topDatum, eaves, evidenceIds: datums.map((d) => d.id), measured: true }
}

// ---------------------------------------------------------------------------
// 3. views
// ---------------------------------------------------------------------------

/** Register every elevation the graph carries against the massing already established. */
export function registerElevationFrames(graph: SourceObservationGraph, massing: MassingFacts, keep?: (f: SourceCoordinateFrame) => boolean): { registrations: ElevationRegistration[]; refused: Array<{ frameId: string; why: string }> } {
  const seenAsset = new Set<string>()
  const refusedEarly: Array<{ frameId: string; why: string }> = []
  const frames: Array<{ frame: SourceCoordinateFrame; extent: PixelRect }> = []
  const ordered = graph.coordinateFrames
    .filter((f) => f.roles.projection === 'ORTHOGRAPHIC_ELEVATION')
    .filter((f) => (keep ? keep(f) : true))
    .sort((a, b) => b.size.width - a.size.width || a.id.localeCompare(b.id))
  for (const frame of ordered) {
    // One registration per drawing: a second rendering of the same elevation
    // adds pixels, not evidence.
    if (seenAsset.has(frame.assetId)) continue
    const extent = silhouetteExtent(graph.observations.filter((o) => o.frameId === frame.id))
    if (!extent) {
      refusedEarly.push({ frameId: frame.id, why: 'no silhouette was found on this drawing, so there is nothing to scale against' })
      continue
    }
    seenAsset.add(frame.assetId)
    frames.push({ frame, extent })
  }
  const { registrations, refused } = registerElevations(frames, massing)
  return { registrations, refused: [...refusedEarly, ...refused].sort((a, b) => a.frameId.localeCompare(b.frameId)) }
}

// ---------------------------------------------------------------------------
// 4. facade features
// ---------------------------------------------------------------------------

const rectOfObservation = (o: SourceObservation): PixelRect | undefined => {
  const g = o.pixelGeometry
  if (g.type === 'RECT') return g.rect
  const points = g.type === 'POLYGON' || g.type === 'POLYLINE' ? g.points : g.type === 'SEGMENT' ? [g.a, g.b] : g.type === 'POINT' ? [g.point] : g.lines.flatMap((l) => [l.a, l.b])
  if (points.length === 0) return undefined
  return { x0: Math.min(...points.map((p) => p.x)), y0: Math.min(...points.map((p) => p.y)), x1: Math.max(...points.map((p) => p.x)), y1: Math.max(...points.map((p) => p.y)) }
}

/** Turn observations on registered views into raw candidates the fusion layer can reduce. */
export function candidatesFrom(graph: SourceObservationGraph, registrations: readonly ElevationRegistration[], kinds: readonly string[]): RawCandidate<{ side: BuildingSide; registration: ElevationRegistration }>[] {
  const byFrame = new Map(registrations.map((r) => [r.frameId, r]))
  const out: RawCandidate<{ side: BuildingSide; registration: ElevationRegistration }>[] = []
  for (const o of graph.observations) {
    if (!kinds.includes(o.kind)) continue
    const registration = byFrame.get(o.frameId)
    if (!registration || !registration.side) continue
    const box = rectOfObservation(o)
    if (!box) continue
    const frame = graph.coordinateFrames.find((f) => f.id === o.frameId)
    if (!frame) continue
    const width = box.x1 - box.x0
    const height = box.y1 - box.y0
    out.push({
      id: o.id,
      frameId: o.frameId,
      assetKey: `${registration.side}`,
      box,
      norm: { x0: round6(box.x0 / frame.size.width), y0: round6(box.y0 / frame.size.height), x1: round6(box.x1 / frame.size.width), y1: round6(box.y1 / frame.size.height) },
      orientation: width > height * 1.6 ? 'HORIZONTAL' : height > width * 1.6 ? 'VERTICAL' : 'OTHER',
      confidence: o.confidence,
      depthLayer: o.depthLayer,
      viewRole: 'ORTHOGRAPHIC_ELEVATION',
      observationIds: [o.id],
      payload: { side: registration.side, registration },
    })
  }
  return out.sort((a, b) => a.id.localeCompare(b.id))
}

export { fuseCandidates, elevationMetric, detectContradictions, solveQuantity, step, gap }
export type { Constraint, SolvedQuantity, CandidateContradiction, PrimitiveTrace, SolverStep, UnresolvedCandidate }
