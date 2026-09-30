/**
 * The plan resolver (BUILDPLAN-ANALYZER-005A).
 *
 * The structural pass reads a plan as a chain of single answers: one copy of
 * the drawing, one extent, one scale, one tiling of its cells — and a terminal
 * gate on the first result. A house passes when every one of those answers
 * happens to be right; a house where one of them is wrong fails, and the
 * failure names whichever link broke last rather than the choice that broke
 * it. On the phone this refused a house because the only copy of its plan that
 * arrived had a terrace line-closed against the wall, and refused another
 * because the only chain read on one axis measured a single room.
 *
 * This module does not change that pass. It runs AFTER it, and only when it
 * stopped, and asks the same code for a small, fixed set of other readings:
 *
 *   copy    the storey's other copies of the same plan (≤ 4)
 *   extent  the widest read chains (today) | the largest cluster of wall ink
 *   scale   the registration (today) | ≤ 2 scales the drawing's own FIRST
 *           readings of its long chains imply, when they disagree with it
 *   merge   largest rectangle first (today) | walled rectangle first
 *   faces   band-only sides on the band axis (today) | on the outer face
 *   mouths  a wide undrawn gap in front of a space walled on its other sides as
 *           the mouth of a pocket (today) | as an opening in the wall — asked
 *           only where a reading left such a mouth open (1.1.0)
 *
 * Every alternative is generated from the drawing — a reading the OCR made, a
 * wall the ink shows — never from the answer: nothing here solves for the
 * published footprint. The published figure only SCORES a reading, in the
 * same bands the gate already uses, and a reading still has to pass the gate
 * that refused the first one.
 *
 * Ranking is lexicographic on buckets that are the pipeline's existing
 * constants (6 %, 20 %, 35 %, 1.15), never a weighted sum: no new weights, so
 * nothing new to tune. Acceptance is strict — AGREES, or NEAR with an
 * independent corroboration, or no published figure and two — and a tie
 * between two different buildings is named, not broken: PLAN_RESOLUTION_
 * INCONCLUSIVE, with every reading weighed. Counts only, never a clock: the
 * same inputs give the same answer on a phone and on a server.
 *
 * Resolver 1.3.0 (BUILDPLAN-ANALYZER-005B) reads its scales and extents from
 * below instead of making its own:
 *
 *   - scale   the frame's independent metric hypotheses (source-metrics'
 *             `metricSolutions`), at most two besides the registration; the
 *             lattice of first readings is kept only for evidence sealed
 *             before 1.2.0 of the metric schema, which carries none
 *   - extent  adds the wall witness (the sheet's walls from pixels only)
 *   - ISOTROPY is now a witness for the registration too, when the metric
 *             solution chose or confirmed it from independent readings on both
 *             axes: the registration is then not fitted on the statements that
 *             agree with it, so agreeing with them is a second witness
 *
 * and a first reading that completes on a metric solution weaker than
 * SUPPORTED is challenged by those metric readings (`challengeFirstReading`).
 *
 * Two rules keep the published figure from choosing the building on its own
 * (1.2.0, after the post-implementation Council's decoy-footprint control:
 * with the figure scaled ×1.25 or ×0.8, the resolver built a different house
 * to match it on two development projects of three):
 *
 *   - A corroboration is a witness the figure is not. The share of wall ink
 *     the bodies explain ranks readings but corroborates none — it is counted
 *     in pixels, inside the same box the bodies come from. Agreement on both
 *     axes counts only for a scale the drawing's own long spans imply; the
 *     registration was fitted on those statements, so agreeing with them is
 *     not a second witness. A second copy of the plan that measures the same
 *     is.
 *   - The figure may refuse the first reading or choose among the others,
 *     never both. When the first reading stopped because it missed the
 *     published footprint, the figure is SPENT: every other reading is scored
 *     as if nothing were published, and needs two witnesses of its own.
 */
import { round6, stableId } from '@buildapp/source-common'
import type { PixelRect } from '@buildapp/source-common'
import { compareEvidence, metricSolutionFor } from '@buildapp/source-metrics'
import type { CoordinateRegistration, FrameMetricSolution, MetricEvidence, MetricEvidenceSet } from '@buildapp/source-metrics'
import type { SourceCoordinateFrame } from '@buildapp/source-observations'
import { STOREY_RANK, groundLabelledAmong, inferStructuralLayout, planSheet, planStoreyOf } from './layout.js'
import type { PlanReadingChoice, PlanSheet, StructuralLayoutDraft } from './layout.js'
import { planExtent, wallClusterExtent } from './plan-decomposition.js'
import { LAYOUT_REFUSAL_CODES } from './plan-diagnostics.js'
import { composeStructuralLayout } from './structural.js'
import type { StructuralPassOptions, StructuralPassResult } from './structural.js'
import { ringArea, ringBounds } from './structural-layout.js'
import type { AlternativeGroup, LayoutConflict, LayoutGateReason } from './structural-layout.js'
import { worldFrameFrom } from './v2/frame.js'

export const PLAN_RESOLVER_VERSION = '1.3.0' as const

/** Counts, never time: a slower device must reach the same answer. */
export const RESOLVER_BUDGET = { copies: 4, decompositions: 24, compositions: 4 } as const

/** How a reading of the published footprint came out, in the gate's own bands. Order is rank. */
export const FOOTPRINT_BUCKETS = ['AGREES', 'UNKNOWN', 'NEAR', 'WRONG'] as const
export type FootprintBucket = (typeof FOOTPRINT_BUCKETS)[number]

/** A witness to a reading that is neither the published figure nor the pixels the reading was made from. */
export type Corroboration = 'ISOTROPY' | 'CROSS_COPY'

/** What the published footprint did in a resolution: scored the readings, was spent refusing the first one, or was not published. */
export type PublishedFigureUse = 'SCORED' | 'SPENT' | 'NONE'

export type ScaleChoice =
  | { kind: 'REGISTRATION' }
  | {
      kind: 'METRIC_HYPOTHESIS'
      /** One scale for both axes, as the metric layer states it. */
      cmPerPx: number
      hypothesisId: string
      /** Independent readings on both axes state it: a witness the published figure is not. */
      axesMeasured: boolean
      why: string
    }
  | {
      kind: 'LATTICE'
      /** One scale for both axes: a published sheet is scaled uniformly. */
      cmPerPx: number
      /** The long spans whose readings, as the reader first made them, imply this scale. */
      anchors: Array<{ evidenceId: string; axis: 'X' | 'Y'; pixelLength: number; readCm: number }>
      why: string
    }

export type PlanHypothesis = {
  id: string
  frameId: string
  annotation: string
  extent: PlanReadingChoice['extent']
  scale: ScaleChoice
  merge: PlanReadingChoice['merge']
  faces: PlanReadingChoice['faces']
  mouths: PlanReadingChoice['mouths']
  /** Which of today's choices this reading departs from; empty for today's own reading. */
  departures: string[]
}

export type HypothesisScore = {
  /** A reading that cannot be a building: never accepted, never a partial. */
  hard: string[]
  /** The gate's refusals after the full composition (stage 2 only). */
  gateRefusals: string[]
  footprint: { areaM2: number; publishedM2?: number; residual?: number; bucket: FootprintBucket }
  /** Share of the plan's stated chain length this reading contradicts. */
  refutedShare: number
  /** Share of the sheet's long wall bands this reading's bodies explain: a ranking signal, never a corroboration. */
  wallCoverage: number
  corroborations: Corroboration[]
  /** The bodies, rounded to 0.1 m: two readings with the same key are one building read twice. */
  outlineKey: string
  masses: number
  /** The lowest storey's bodies, moved so the outline's own corner is the origin; and the wall thickness they were read at. */
  bodies: Array<{ x0: number; z0: number; x1: number; z1: number }>
  wallM: number
}

export type RankedReading = { hypothesis: PlanHypothesis; score: HypothesisScore; stage: 1 | 2 }

export type PlanResolutionCounts = { copies: number; decompositions: number; readings: number; distinctOutlines: number; compositions: number; publishedFigure: PublishedFigureUse }

export type PlanResolution =
  /** Nothing but today's reading could be generated: today's failure stands. */
  | { kind: 'NO_ALTERNATIVE'; counts: PlanResolutionCounts }
  | { kind: 'RESOLVED'; result: StructuralPassResult; metrics: MetricEvidenceSet; chosen: RankedReading; considered: RankedReading[]; counts: PlanResolutionCounts }
  | {
      kind: 'INCONCLUSIVE'
      /** TIE: two different buildings equally supported. NONE_HOLDS: every reading weighed breaks the layout or misses the published figure. */
      why: 'TIE' | 'NONE_HOLDS'
      considered: RankedReading[]
      counts: PlanResolutionCounts
      message: string
      diagnostics: Record<string, number | string | boolean>
    }

/** Told as each reading is weighed, for a caller reporting progress. Nothing it does reaches the result. */
export type ResolverProgress = (event: { stage: 1 | 2; index: number; total: number; label: string }) => void

// ---------------------------------------------------------------------------
// scale readings
// ---------------------------------------------------------------------------

/** A stated span on one frame: a chain segment carrying a printed number. */
type Statement = { evidence: MetricEvidence; axis: 'X' | 'Y'; pixelLength: number; firstReadCm?: number }

function statementsOn(metrics: MetricEvidenceSet, frameId: string): Statement[] {
  const byId = new Map(metrics.evidence.map((e) => [e.id, e]))
  const tokens = new Map(metrics.ocrTokens.map((t) => [t.id, t]))
  const out: Statement[] = []
  for (const chain of metrics.chains) {
    if (chain.frameId !== frameId) continue
    for (const segment of chain.segments) {
      if (segment.evidenceId === undefined) continue
      const evidence = byId.get(segment.evidenceId)
      if (!evidence || evidence.unit !== 'cm' || (evidence.origin !== 'READ' && evidence.origin !== 'CHAIN_CORRECTED')) continue
      // What the reader saw before the chain solver rewrote it to agree with the pooled scale.
      const token = evidence.ocrTokenIds.length === 1 ? tokens.get(evidence.ocrTokenIds[0]) : undefined
      // A leading zero is a trailing zero read upside down (005B): no dimension is printed with one.
      const firstReadCm = token && /^[1-9]\d{1,4}$/.test(token.text) ? Number(token.text) : undefined
      out.push({ evidence, axis: chain.axis === 'HORIZONTAL' ? 'X' : 'Y', pixelLength: segment.pixelLength, firstReadCm })
    }
  }
  return out.sort((a, b) => (a.evidence.id < b.evidence.id ? -1 : a.evidence.id > b.evidence.id ? 1 : 0))
}

/** Does `cm` over `pixelLength` agree with a scale, within 3 % or the plan's pixel tolerance, whichever is looser? */
const agrees = (cm: number, pixelLength: number, cmPerPx: number, tolerancePx: number): boolean =>
  Math.abs(cm - pixelLength * cmPerPx) <= Math.max(0.03 * cm, tolerancePx * cmPerPx)

/** The readings a statement carries WITHOUT a substitution the chain solver made: what was printed, as read. */
const zeroSubstitution = (s: Statement): number[] => (s.evidence.origin === 'READ' ? (/^0\d/.test(s.evidence.rawText) ? [] : [s.evidence.value]) : s.firstReadCm !== undefined && s.firstReadCm !== s.evidence.value ? [s.firstReadCm] : [])

/**
 * The scales the drawing's own first readings of its long spans imply, where
 * they disagree with the registration. At most two, strongest supported first.
 *
 * Only LONG spans (≥ 15 % of the building's extent on their axis): a room's
 * 1.20 m misread by one digit implies a wild scale and should imply nothing.
 * Only readings made without a substitution: the chain solver's corrections
 * were made TOWARD the registration, and cannot vote against it. And only a
 * scale those readings support MORE than they support the registration: one
 * misread overall dimension against three read ones is a misreading, and a
 * registration nothing printed supports is the thing in doubt.
 */
export function latticeScales(metrics: MetricEvidenceSet, frameId: string, registration: CoordinateRegistration, extent: PixelRect, tolerancePx: number): Array<Extract<ScaleChoice, { kind: 'LATTICE' }>> {
  const statements = statementsOn(metrics, frameId)
  const long = statements.filter((s) => s.pixelLength >= 0.15 * (s.axis === 'X' ? extent.x1 - extent.x0 : extent.y1 - extent.y0))
  const registered = (axis: 'X' | 'Y'): number => (axis === 'X' ? registration.metresPerPixelX : registration.metresPerPixelY) * 100
  const readings = long.flatMap((s) => zeroSubstitution(s).map((cm) => ({ s, cm, cmPerPx: cm / s.pixelLength })))
  const registrationWeight = readings.filter((r) => agrees(r.cm, r.s.pixelLength, registered(r.s.axis), tolerancePx)).reduce((a, r) => a + r.s.pixelLength, 0)
  const candidates = readings.filter((r) => !agrees(r.cm, r.s.pixelLength, registered(r.s.axis), tolerancePx))
  const scored = candidates
    .map((c) => {
      const support = readings.filter((r) => agrees(r.cm, r.s.pixelLength, c.cmPerPx, tolerancePx))
      return { c, support, weight: support.reduce((a, r) => a + r.s.pixelLength, 0) }
    })
    .sort((a, b) => b.weight - a.weight || a.c.cmPerPx - b.c.cmPerPx)
  const out: Array<Extract<ScaleChoice, { kind: 'LATTICE' }>> = []
  for (const { c, support, weight } of scored) {
    if (out.length >= 2 || weight <= registrationWeight) break
    if (out.some((o) => Math.abs(o.cmPerPx / c.cmPerPx - 1) <= 0.03)) continue
    const cmPerPx = round6(c.cmPerPx)
    out.push({
      kind: 'LATTICE',
      cmPerPx,
      anchors: support.map((r) => ({ evidenceId: r.s.evidence.id, axis: r.s.axis, pixelLength: r.s.pixelLength, readCm: r.cm })),
      why: `the reader's own "${c.cm}" over ${c.s.pixelLength} px on the ${c.s.axis === 'X' ? 'width' : 'depth'} axis implies ${cmPerPx} cm/px, against the ${round6(registered(c.s.axis))} cm/px the sheet was registered at`,
    })
  }
  return out
}

/**
 * The scales the metric layer states for a frame, other than the one it was
 * registered at: at most two, strongest independent evidence first (005B).
 * The resolver generates no scale of its own from these readings — the metric
 * solution already weighed them, orientation and independence included.
 */
export function metricScales(solution: FrameMetricSolution, registration: CoordinateRegistration): Array<Extract<ScaleChoice, { kind: 'METRIC_HYPOTHESIS' }>> {
  const registered = ((registration.metresPerPixelX + registration.metresPerPixelY) / 2) * 100
  return solution.hypotheses
    .filter((h) => h.plausible && h.independentGroups >= 1 && Math.abs(h.cmPerPixel / registered - 1) > 0.03)
    .sort((a, b) => compareEvidence(a, b) || a.cmPerPixel - b.cmPerPixel)
    .slice(0, 2)
    .map((h) => ({
      kind: 'METRIC_HYPOTHESIS' as const,
      cmPerPx: round6(h.cmPerPixel),
      hypothesisId: h.id,
      axesMeasured: h.axesMeasured,
      why: `the plan's readings as printed state ${round6(h.cmPerPixel)} cm/px (${h.why}), against the ${round6(registered)} cm/px it was registered at`,
    }))
}

/** Whether the frame's registration IS the scale its independent readings on both axes chose or confirmed. */
export const registrationMeasuredOnBothAxes = (solution: FrameMetricSolution | undefined): boolean =>
  solution !== undefined && solution.isotropy === 'MEASURED' && (solution.relation === 'CONFIRMED' || solution.relation === 'REPLACED' || solution.relation === 'ADDED')

/**
 * The metric evidence as a reading at another scale sees it: the frame's
 * registration replaced, each statement kept, re-read, or dropped.
 *
 * A statement that agrees with the new scale is kept. One that does not is
 * re-read — the reader's first reading, then the alternatives it recorded —
 * and becomes the first of those that agrees. One that none of its readings
 * reconcile is REFUTED: its value is set to 0, which the ladder treats as "no
 * statement", so it neither pins a span nor is silently rescaled. Spans the
 * chain derived from the old scale are derived again from the new one.
 *
 * The view keeps the ids and the content hash of the set it came from: every
 * id still names the same printed mark, and the reading that re-interpreted
 * it is sealed with the layout that used it.
 */
export function metricsAtScale(metrics: MetricEvidenceSet, frameId: string, cmPerPx: number, tolerancePx: number): { view: MetricEvidenceSet; reread: Set<string>; refuted: Set<string>; refutedShare: number } {
  const statements = new Map(statementsOn(metrics, frameId).map((s) => [s.evidence.id, s]))
  const derived = new Map<string, number>()
  for (const chain of metrics.chains) {
    if (chain.frameId !== frameId) continue
    for (const segment of chain.segments) if (segment.evidenceId !== undefined && !statements.has(segment.evidenceId)) derived.set(segment.evidenceId, segment.pixelLength)
  }
  const reread = new Set<string>()
  const refuted = new Set<string>()
  let stated = 0
  let refutedLength = 0
  const evidence = metrics.evidence.map((e): MetricEvidence => {
    const s = statements.get(e.id)
    if (s) {
      stated += s.pixelLength
      if (agrees(e.value, s.pixelLength, cmPerPx, tolerancePx)) return e
      const options = [...(s.firstReadCm !== undefined ? [s.firstReadCm] : []), ...[...e.alternatives].sort((a, b) => b.confidence - a.confidence || a.value - b.value).map((a) => a.value)]
      const fits = options.find((cm) => cm > 0 && agrees(cm, s.pixelLength, cmPerPx, tolerancePx))
      if (fits !== undefined) {
        reread.add(e.id)
        return { ...e, value: fits }
      }
      refuted.add(e.id)
      refutedLength += s.pixelLength
      return { ...e, value: 0 }
    }
    const px = derived.get(e.id)
    if (px !== undefined && e.origin === 'DERIVED' && e.unit === 'cm') return { ...e, value: round6(px * cmPerPx) }
    return e
  })
  const coordinateRegistrations = metrics.coordinateRegistrations.map((r) => (r.frameId === frameId && r.plane === 'PLAN_XZ' ? { ...r, metresPerPixelX: round6(cmPerPx / 100), metresPerPixelY: round6(cmPerPx / 100), anisotropy: 1 } : r))
  return { view: { ...metrics, evidence, coordinateRegistrations }, reread, refuted, refutedShare: stated === 0 ? 0 : round6(refutedLength / stated) }
}

/** Share of the stated chain length on a frame that its registration contradicts: today's reading, scored like the others. */
function refutedShareAtRegistration(metrics: MetricEvidenceSet, frameId: string, registration: CoordinateRegistration, tolerancePx: number): number {
  let stated = 0
  let refuted = 0
  for (const s of statementsOn(metrics, frameId)) {
    stated += s.pixelLength
    const cmPerPx = (s.axis === 'X' ? registration.metresPerPixelX : registration.metresPerPixelY) * 100
    if (!agrees(s.evidence.value, s.pixelLength, cmPerPx, tolerancePx)) refuted += s.pixelLength
  }
  return stated === 0 ? 0 : round6(refuted / stated)
}

// ---------------------------------------------------------------------------
// scoring
// ---------------------------------------------------------------------------

/** A SPENT figure still refuses a reading that misses it, but no longer ranks or accepts one that meets it. */
const bucketOf = (areaM2: number, published: number | undefined, spent = false): HypothesisScore['footprint'] => {
  if (published === undefined || !(published > 0) || !(areaM2 > 0)) return { areaM2: round6(areaM2), ...(published !== undefined ? { publishedM2: published } : {}), bucket: 'UNKNOWN' }
  const residual = round6((areaM2 - published) / published)
  const error = Math.abs(residual)
  return { areaM2: round6(areaM2), publishedM2: published, residual, bucket: error > 0.2 ? 'WRONG' : spent ? 'UNKNOWN' : error <= 0.06 ? 'AGREES' : 'NEAR' }
}

const overlaps = (a: PixelRect, b: PixelRect): boolean => Math.min(a.x1, b.x1) > Math.max(a.x0, b.x0) && Math.min(a.y1, b.y1) > Math.max(a.y0, b.y0)

/** Everything about one reading that the ranking and the acceptance rule ask. */
function scoreReading(
  draft: StructuralLayoutDraft,
  context: { published?: number; spent?: boolean; refutedShare: number; sheet: PlanSheet; cluster: PixelRect | null; supportedOnBothAxes: boolean; otherCopies: Array<{ widthM: number; depthM: number }>; gateRefusals: string[] },
): HypothesisScore {
  const hard: string[] = []
  const base = draft.base
  if (!base || !draft.frame || draft.masses.length === 0) hard.push('NO_BODY')
  if (!worldFrameFrom(draft)) hard.push('NO_WORLD_FRAME')
  const lowest = draft.storeys.length > 0 ? Math.min(...draft.storeys.map((s) => s.index)) : 0
  const lowestIds = new Set(draft.storeys.filter((s) => s.index === lowest).map((s) => s.id))
  const built = draft.footprintRegions.filter((r) => r.kind === 'BUILT' && lowestIds.has(r.storeyId))
  const area = built.reduce((a, r) => a + ringArea(r.ring), 0)
  for (const m of draft.masses) {
    const b = ringBounds(m.ring)
    const finite = [b.x0, b.x1, b.z0, b.z1].every(Number.isFinite)
    if (!finite || b.x1 - b.x0 < 1 || b.z1 - b.z0 < 1) hard.push('DEGENERATE_GEOMETRY')
  }
  for (let i = 0; i < draft.masses.length; i += 1) {
    for (let j = i + 1; j < draft.masses.length; j += 1) {
      const a = ringBounds(draft.masses[i].ring)
      const b = ringBounds(draft.masses[j].ring)
      if (Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0)) > 0.5) hard.push('MASS_OVERLAP')
    }
  }
  if (base?.registration) {
    const r = base.registration
    if (Math.max(r.metresPerPixelX, r.metresPerPixelY) / Math.min(r.metresPerPixelX, r.metresPerPixelY) > 1.15) hard.push('ANISOTROPY')
    const wallM = base.decomposition.wallThickness.m
    if (!(wallM >= 0.15 && wallM <= 0.7)) hard.push('WALL_THICKNESS_IMPLAUSIBLE')
    const margin = 2 * base.wallPx
    for (const region of built) {
      const p = region.pixelRect
      if (p && (p.x0 < -margin || p.y0 < -margin || p.x1 > base.frame.size.width + margin || p.y1 > base.frame.size.height + margin)) hard.push('OUTSIDE_SHEET')
    }
  }

  // How much of the sheet's wall the bodies explain.
  const { bands, wallPx } = context.sheet
  const long = bands.filter((b) => b.length >= wallPx * 2.5)
  const within = context.cluster ?? base?.extent
  const mid = (b: (typeof long)[number]): { x: number; y: number } => ({ x: (b.bounds.x0 + b.bounds.x1) / 2, y: (b.bounds.y0 + b.bounds.y1) / 2 })
  const inside = (p: { x: number; y: number }, r: PixelRect, grow: number): boolean => p.x >= r.x0 - grow && p.x <= r.x1 + grow && p.y >= r.y0 - grow && p.y <= r.y1 + grow
  const walls = within ? long.filter((b) => inside(mid(b), within, 0)) : []
  const bodyRects = built.map((r) => r.pixelRect).filter((r): r is PixelRect => r !== undefined)
  const explained = walls.filter((b) => bodyRects.some((r) => inside(mid(b), r, wallPx)))
  const total = walls.reduce((a, b) => a + b.length, 0)
  const wallCoverage = total === 0 ? 0 : round6(explained.reduce((a, b) => a + b.length, 0) / total)

  const corroborations: Corroboration[] = []
  if (context.supportedOnBothAxes) corroborations.push('ISOTROPY')
  if (draft.masses.length > 0) {
    const all = draft.masses.map((m) => ringBounds(m.ring))
    const widthM = Math.max(...all.map((b) => b.x1)) - Math.min(...all.map((b) => b.x0))
    const depthM = Math.max(...all.map((b) => b.z1)) - Math.min(...all.map((b) => b.z0))
    if (context.otherCopies.some((o) => Math.abs(o.widthM / widthM - 1) <= 0.05 && Math.abs(o.depthM / depthM - 1) <= 0.05)) corroborations.push('CROSS_COPY')
  }

  const outlineKey = built
    .map((r) => ringBounds(r.ring))
    .map((b) => [b.x0, b.z0, b.x1, b.z1].map((v) => (Math.round(v * 10) / 10).toFixed(1)).join(','))
    .sort()
    .join('|')
  const raw = built.map((r) => ringBounds(r.ring))
  const minX = raw.length > 0 ? Math.min(...raw.map((b) => b.x0)) : 0
  const minZ = raw.length > 0 ? Math.min(...raw.map((b) => b.z0)) : 0
  const bodies = raw.map((b) => ({ x0: round6(b.x0 - minX), z0: round6(b.z0 - minZ), x1: round6(b.x1 - minX), z1: round6(b.z1 - minZ) })).sort((a, b) => a.x0 - b.x0 || a.z0 - b.z0 || a.x1 - b.x1 || a.z1 - b.z1)
  return {
    hard: [...new Set(hard)].sort(),
    gateRefusals: context.gateRefusals,
    footprint: bucketOf(area, context.published, context.spent),
    refutedShare: context.refutedShare,
    wallCoverage,
    corroborations,
    outlineKey,
    masses: draft.masses.length,
    bodies,
    wallM: round6(base?.decomposition.wallThickness.m ?? 0),
  }
}

/**
 * Two readings of ONE building: the same bodies, each within a wall's
 * thickness of the other on every side. A body read on its walls' axes and
 * the same body read on their outer faces differ by exactly that, and are not
 * a disagreement about which building this is.
 */
export function sameBuilding(a: HypothesisScore, b: HypothesisScore): boolean {
  if (a.bodies.length === 0 || a.bodies.length !== b.bodies.length) return false
  const t = Math.max(a.wallM, b.wallM) + 0.05
  return a.bodies.every((x, i) => {
    const y = b.bodies[i]
    return Math.abs(x.x0 - y.x0) <= t && Math.abs(x.x1 - y.x1) <= t && Math.abs(x.z0 - y.z0) <= t && Math.abs(x.z1 - y.z1) <= t
  })
}

/** The ranking, lexicographic on buckets. Negative when `a` ranks ahead of `b`. */
export function compareReadings(a: RankedReading, b: RankedReading): number {
  const bucket = (v: number): number => Math.floor(v / 0.05 + 1e-9)
  return (
    a.score.hard.length - b.score.hard.length ||
    a.score.gateRefusals.length - b.score.gateRefusals.length ||
    FOOTPRINT_BUCKETS.indexOf(a.score.footprint.bucket) - FOOTPRINT_BUCKETS.indexOf(b.score.footprint.bucket) ||
    bucket(a.score.refutedShare) - bucket(b.score.refutedShare) ||
    bucket(b.score.wallCoverage) - bucket(a.score.wallCoverage) ||
    b.score.corroborations.length - a.score.corroborations.length ||
    a.hypothesis.departures.length - b.hypothesis.departures.length ||
    (a.hypothesis.id < b.hypothesis.id ? -1 : a.hypothesis.id > b.hypothesis.id ? 1 : 0)
  )
}

/** The first five steps of the ranking: what counts as "strictly better" between two different buildings. */
const evidenceTuple = (r: RankedReading): number[] => {
  const bucket = (v: number): number => Math.floor(v / 0.05 + 1e-9)
  return [r.score.hard.length, r.score.gateRefusals.length, FOOTPRINT_BUCKETS.indexOf(r.score.footprint.bucket), bucket(r.score.refutedShare), -bucket(r.score.wallCoverage), -r.score.corroborations.length]
}

/** Is this reading acceptable on its own, whatever else was weighed? */
export function acceptable(r: RankedReading): boolean {
  if (r.stage !== 2 || r.score.hard.length > 0 || r.score.gateRefusals.length > 0) return false
  const n = r.score.corroborations.length
  switch (r.score.footprint.bucket) {
    case 'AGREES':
      return true
    case 'NEAR':
      return n >= 1
    case 'UNKNOWN':
      return n >= 2
    default:
      return false
  }
}

const describe = (h: PlanHypothesis): string =>
  [
    `copy ${h.annotation.toLowerCase()} ${h.frameId.slice(-10)}`,
    h.extent === 'CHAIN_RECT' ? 'chain extent' : h.extent === 'WALL_WITNESS' ? 'wall-witness extent' : 'wall-ink extent',
    h.scale.kind === 'REGISTRATION' ? 'registered scale' : `scale ${h.scale.cmPerPx} cm/px`,
    h.merge === 'LARGEST_FIRST' ? 'largest-first tiling' : 'walled-first tiling',
    h.faces === 'AS_GRIDDED' ? 'sides as gridded' : 'outer faces',
    ...(h.mouths === 'SHUT' ? ['pocket mouths shut'] : []),
  ].join(', ')

const summaryOf = (r: RankedReading): string => {
  const f = r.score.footprint
  const area = f.publishedM2 !== undefined && f.residual !== undefined ? `${f.areaM2.toFixed(1)} m² (${f.residual >= 0 ? '+' : ''}${(f.residual * 100).toFixed(1)}% of ${f.publishedM2})` : `${f.areaM2.toFixed(1)} m²`
  const problems = [...r.score.hard, ...r.score.gateRefusals]
  const bucket = f.bucket === 'UNKNOWN' && f.residual !== undefined ? 'UNKNOWN (the figure is spent)' : f.bucket
  return `${describe(r.hypothesis)}: ${r.score.masses} bod${r.score.masses === 1 ? 'y' : 'ies'}, ${area}, ${bucket}${problems.length > 0 ? `, ${problems.join('+')}` : ''}${r.score.corroborations.length > 0 ? `, corroborated by ${r.score.corroborations.join('+')}` : ''}`
}

// ---------------------------------------------------------------------------
// the search
// ---------------------------------------------------------------------------

/**
 * Weigh the other readings of the plan when today's reading stopped.
 *
 * `incumbent` is today's composition, already run. The caller asks only when
 * it would otherwise stop (no world frame, no mass, or a layout refusal);
 * this function does not re-check that, and never returns the incumbent as a
 * resolution — today's reading had its chance.
 */
export function resolvePlan(options: StructuralPassOptions, incumbent: StructuralPassResult, progress?: ResolverProgress): PlanResolution {
  const sheetCache = options.sheetCache ?? new Map<string, PlanSheet>()
  const shared: StructuralPassOptions = { ...options, sheetCache }
  const published = options.publishedAreas?.find((a) => a.key === 'footprint_area' && a.unit === 'm2')?.value
  // The figure may refuse any reading, and choose among them only when it did not refuse the first one.
  const spent = published !== undefined && incumbent.layout.gate.reasons.some((r) => r.severity === 'BLOCKING' && r.code === 'FOOTPRINT_AREA_WRONG')
  const publishedFigure: PublishedFigureUse = published === undefined ? 'NONE' : spent ? 'SPENT' : 'SCORED'

  // --- the copies of the base storey's plan --------------------------------
  const inView = options.graph.coordinateFrames.filter((f) => f.roles.projection === 'ORTHOGRAPHIC_PLAN' && f.roles.document === 'FLOOR_PLAN' && (!options.frameFilter || options.frameFilter(f)))
  const groundLabelled = groundLabelledAmong(inView)
  const storeyOf = (f: SourceCoordinateFrame): string => planStoreyOf(f, groundLabelled)
  const planFrames = inView.filter((f) => storeyOf(f) in STOREY_RANK)
  // The building stands on its lowest storey, and that is the plan re-read here, whichever plan
  // the first reading fell back on when the lowest one failed it.
  const baseStorey = [...new Set(planFrames.map(storeyOf))].sort((a, b) => STOREY_RANK[a] - STOREY_RANK[b])[0]
  const copies = planFrames
    .filter((f) => storeyOf(f) === baseStorey)
    .sort((a, b) => {
      const dimensioned = (f: SourceCoordinateFrame): number => (f.roles.annotation === 'DIMENSIONED' ? 1 : 0)
      return dimensioned(b) - dimensioned(a) || b.size.width * b.size.height - a.size.width * a.size.height || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    })
    .slice(0, RESOLVER_BUDGET.copies)

  type Decomposition = { frame: SourceCoordinateFrame; sheet: PlanSheet; cluster: PixelRect | null; extent: PlanReadingChoice['extent']; scale: ScaleChoice; mouths: PlanReadingChoice['mouths']; metrics: MetricEvidenceSet; reread: Set<string>; refutedShare: number; supportedOnBothAxes: boolean; otherCopies: Array<{ widthM: number; depthM: number }> }
  const decompositions: Decomposition[] = []
  const sheets = new Map<string, { sheet: PlanSheet; cluster: PixelRect | null }>()
  for (const frame of copies) {
    const sheet = planSheet(frame, shared)
    if (!sheet) continue
    sheets.set(frame.id, { sheet, cluster: wallClusterExtent(sheet.mask, sheet.wallPx)?.rect ?? null })
  }
  // What each copy, alone, says the building measures: its wall ink at its own printed scale.
  const copyExtents = new Map<string, { widthM: number; depthM: number }>()
  for (const [frameId, { cluster }] of sheets) {
    const registration = options.metrics.coordinateRegistrations.find((r) => r.frameId === frameId && r.plane === 'PLAN_XZ')
    if (cluster && registration) copyExtents.set(frameId, { widthM: (cluster.x1 - cluster.x0) * registration.metresPerPixelX, depthM: (cluster.y1 - cluster.y0) * registration.metresPerPixelY })
  }
  for (const frame of copies) {
    const got = sheets.get(frame.id)
    const registration = options.metrics.coordinateRegistrations.find((r) => r.frameId === frame.id && r.plane === 'PLAN_XZ')
    if (!got || !registration) continue
    const { sheet, cluster } = got
    const tolerancePx = Math.max(2, sheet.wallPx / 2)
    const chainRect = planExtent(options.metrics.chains.filter((c) => c.frameId === frame.id), sheet.bands, sheet.wallPx, sheet.witness)?.rect ?? null
    const extents: Array<PlanReadingChoice['extent']> = []
    if (chainRect) extents.push('CHAIN_RECT')
    const differs = (a: PixelRect, b: PixelRect): boolean => Math.max(Math.abs(a.x0 - b.x0), Math.abs(a.x1 - b.x1), Math.abs(a.y0 - b.y0), Math.abs(a.y1 - b.y1)) > sheet.wallPx
    if (cluster && (!chainRect || differs(cluster, chainRect))) extents.push('WALL_MASS_CLUSTER')
    // 005B: the walls from pixels only, as a third frame, when it says something the other two do not.
    const witness = sheet.witness?.rect
    if (witness && (!chainRect || differs(witness, chainRect)) && (!cluster || differs(witness, cluster))) extents.push('WALL_WITNESS')
    // Long spans are long relative to the building, so the wall ink's box judges them when there is one.
    const judge = cluster ?? chainRect
    const solution = metricSolutionFor(options.metrics, frame.id)
    // 1.3.0: the metric layer's own hypotheses; the first-reading lattice only for evidence that has none.
    const lattices: Array<Extract<ScaleChoice, { kind: 'LATTICE' | 'METRIC_HYPOTHESIS' }>> = solution ? metricScales(solution, registration) : judge ? latticeScales(options.metrics, frame.id, registration, judge, tolerancePx) : []
    const otherCopies = [...copyExtents.entries()].filter(([id]) => id !== frame.id).map(([, e]) => e)
    const statements = statementsOn(options.metrics, frame.id)
    const bothAxes = (cmX: number, cmY: number): boolean =>
      (['X', 'Y'] as const).every((axis) => statements.some((s) => s.axis === axis && judge !== null && s.pixelLength >= 0.15 * (axis === 'X' ? judge.x1 - judge.x0 : judge.y1 - judge.y0) && zeroSubstitution(s).some((cm) => agrees(cm, s.pixelLength, axis === 'X' ? cmX : cmY, tolerancePx))))
    for (const extent of extents) {
      // The registration was fitted on these same statements: agreeing with them on both axes is not a second
      // witness — unless the metric layer chose or confirmed it from independent readings on both axes (1.3.0).
      decompositions.push({ frame, sheet, cluster, extent, scale: { kind: 'REGISTRATION' }, mouths: 'AS_DECIDED', metrics: options.metrics, reread: new Set(), refutedShare: refutedShareAtRegistration(options.metrics, frame.id, registration, tolerancePx), supportedOnBothAxes: registrationMeasuredOnBothAxes(solution), otherCopies })
      for (const lattice of lattices) {
        const at = metricsAtScale(options.metrics, frame.id, lattice.cmPerPx, tolerancePx)
        decompositions.push({ frame, sheet, cluster, extent, scale: lattice, mouths: 'AS_DECIDED', metrics: at.view, reread: at.reread, refutedShare: at.refutedShare, supportedOnBothAxes: lattice.kind === 'METRIC_HYPOTHESIS' ? lattice.axesMeasured : bothAxes(lattice.cmPerPx, lattice.cmPerPx), otherCopies })
      }
    }
  }
  const bounded = decompositions.slice(0, RESOLVER_BUDGET.decompositions)
  const incumbentFrame = incumbent.draft.base?.frame.id

  // --- stage 1: every reading, without roofs, projection or gate ------------
  const readings: Array<RankedReading & { decomposition: Decomposition }> = []
  // A decomposition that left a wide gap open as the mouth of a pocket has another reading:
  // the gap as an opening in the wall (a garage door, a glazed wall). It is weighed only where
  // such a mouth exists, and within the same budget.
  const withShutMouths: Decomposition[] = []
  const mouthsLeftOpen = (draft: StructuralLayoutDraft): boolean =>
    (draft.base?.decomposition.wideOpenings ?? []).some((w) => w.decision === 'OPEN_SIDE' && (w.kind === 'BAY_MOUTH' ? w.evidence.corners === true : (w.evidence.pocketM2 ?? 0) > 0))
  let total = bounded.length * 4
  let index = 0
  const readAll = (d: Decomposition): void => {
    let pocketed = false
    for (const merge of ['LARGEST_FIRST', 'WALLED_FIRST'] as const) {
      for (const faces of ['AS_GRIDDED', 'OUTER_FACE'] as const) {
        index += 1
        const departures = [
          ...(d.frame.id !== incumbentFrame ? ['COPY'] : []),
          ...(d.extent !== 'CHAIN_RECT' ? ['EXTENT'] : []),
          ...(d.scale.kind !== 'REGISTRATION' ? ['SCALE'] : []),
          ...(merge !== 'LARGEST_FIRST' ? ['MERGE'] : []),
          ...(faces !== 'AS_GRIDDED' ? ['FACES'] : []),
          ...(d.mouths !== 'AS_DECIDED' ? ['MOUTHS'] : []),
        ]
        // Today's own reading already ran, and stopped.
        if (departures.length === 0) {
          pocketed ||= mouthsLeftOpen(incumbent.draft)
          continue
        }
        const hypothesis: PlanHypothesis = {
          id: stableId('plan-reading', `${d.extent}-${merge}-${faces}${d.mouths === 'SHUT' ? '-mouths-shut' : ''}`.toLowerCase(), {
            frameId: d.frame.id,
            extent: d.extent,
            scale: d.scale.kind === 'REGISTRATION' ? 'REG' : d.scale.cmPerPx,
            merge,
            faces,
            ...(d.mouths === 'SHUT' ? { mouths: d.mouths } : {}),
          }),
          frameId: d.frame.id,
          annotation: d.frame.roles.annotation,
          extent: d.extent,
          scale: d.scale,
          merge,
          faces,
          mouths: d.mouths,
          departures,
        }
        progress?.({ stage: 1, index, total, label: describe(hypothesis) })
        const choice = choiceOf(hypothesis, d)
        const draft = inferStructuralLayout({ ...shared, metrics: d.metrics, plan: choice })
        pocketed ||= mouthsLeftOpen(draft)
        readings.push({ hypothesis, stage: 1, decomposition: d, score: scoreReading(draft, { published, spent, refutedShare: d.refutedShare, sheet: d.sheet, cluster: d.cluster, supportedOnBothAxes: d.supportedOnBothAxes, otherCopies: d.otherCopies, gateRefusals: [] }) })
      }
    }
    if (pocketed && d.mouths === 'AS_DECIDED' && bounded.length + withShutMouths.length < RESOLVER_BUDGET.decompositions) {
      withShutMouths.push({ ...d, mouths: 'SHUT' })
      total += 4
    }
  }
  for (const d of bounded) readAll(d)
  for (const d of withShutMouths) readAll(d)
  const distinct = new Map<string, (typeof readings)[number]>()
  for (const r of [...readings].sort(compareReadings)) if (!distinct.has(r.score.outlineKey)) distinct.set(r.score.outlineKey, r)
  const counts: PlanResolutionCounts = { copies: copies.length, decompositions: bounded.length + withShutMouths.length, readings: readings.length, distinctOutlines: distinct.size, compositions: 0, publishedFigure }
  if (readings.length === 0) return { kind: 'NO_ALTERNATIVE', counts }

  // --- stage 2: the best few distinct buildings, through the whole pass -----
  const shortlist = [...distinct.values()].filter((r) => r.score.hard.length === 0 && r.score.footprint.bucket !== 'WRONG' && r.score.masses > 0).slice(0, RESOLVER_BUDGET.compositions)
  const composed: Array<RankedReading & { result: StructuralPassResult; decomposition: Decomposition }> = []
  shortlist.forEach((r, i) => {
    progress?.({ stage: 2, index: i + 1, total: shortlist.length, label: describe(r.hypothesis) })
    const result = composeStructuralLayout({ ...shared, metrics: r.decomposition.metrics, plan: choiceOf(r.hypothesis, r.decomposition) })
    const refusals = result.layout.gate.reasons.filter((g) => g.severity === 'BLOCKING' && LAYOUT_REFUSAL_CODES.has(g.code)).map((g) => g.code).sort()
    const d = r.decomposition
    composed.push({ hypothesis: r.hypothesis, stage: 2, decomposition: d, result, score: scoreReading(result.draft, { published, spent, refutedShare: d.refutedShare, sheet: d.sheet, cluster: d.cluster, supportedOnBothAxes: d.supportedOnBothAxes, otherCopies: d.otherCopies, gateRefusals: refusals }) })
  })
  counts.compositions = composed.length

  // Everything weighed, best first: the composed readings with their full score, the rest as stage 1 left them.
  const composedIds = new Set(composed.map((c) => c.hypothesis.id))
  const considered: RankedReading[] = [...composed, ...[...distinct.values()].filter((r) => !composedIds.has(r.hypothesis.id))]
    .map((r) => ({ hypothesis: r.hypothesis, score: r.score, stage: r.stage }))
    .sort(compareReadings)

  const best = [...composed].sort(compareReadings)[0]
  const refuse = (message: string, why: 'TIE' | 'NONE_HOLDS' = 'NONE_HOLDS'): PlanResolution => {
    const top = considered[0]
    return {
      kind: 'INCONCLUSIVE',
      why,
      considered,
      counts,
      message,
      diagnostics: {
        readingsWeighed: counts.readings,
        distinctOutlines: counts.distinctOutlines,
        compositions: counts.compositions,
        ...(top
          ? {
              bestReading: describe(top.hypothesis),
              bestFootprintBucket: top.score.footprint.bucket,
              bestFootprintM2: top.score.footprint.areaM2,
              ...(top.score.footprint.residual !== undefined ? { bestResidualPct: round6(top.score.footprint.residual * 100) } : {}),
              ...(top.score.hard.length + top.score.gateRefusals.length > 0 ? { bestProblems: [...top.score.hard, ...top.score.gateRefusals].join(',') } : {}),
            }
          : {}),
        ...Object.fromEntries(considered.slice(0, 4).map((r, i) => [`reading${i + 1}`, summaryOf(r)])),
      },
    }
  }
  if (!best || !acceptable(best)) {
    return refuse(
      best
        ? `${counts.readings} other readings of the plan were weighed and none holds: the best, ${summaryOf(best)}, ${best.score.hard.length + best.score.gateRefusals.length > 0 ? 'still breaks the layout' : best.score.footprint.bucket === 'NEAR' ? 'lands near the published footprint with nothing independent to confirm it' : best.score.footprint.bucket === 'UNKNOWN' ? (spent ? 'has only the published footprint behind it, and that figure already refused the first reading, so it cannot also choose the replacement' : 'has no published footprint to check against and too little else to confirm it') : 'does not match the published footprint'}`
        : `${counts.readings} other readings of the plan were weighed and none survived to a full composition`,
    )
  }
  // A different building that is not strictly worse is a tie, and a tie is named, not broken.
  const rival = considered.find((r) => r.hypothesis.id !== best.hypothesis.id && r.score.outlineKey !== best.score.outlineKey && !sameBuilding(r.score, best.score) && r.score.hard.length === 0 && r.score.footprint.bucket !== 'WRONG')
  if (rival) {
    const a = evidenceTuple(best)
    const b = evidenceTuple(rival)
    const first = a.findIndex((v, i) => v !== b[i])
    const strictlyWorse = first >= 0 && b[first] > a[first]
    if (!strictlyWorse) return refuse(`two readings of the plan are equally supported and describe different buildings: ${summaryOf(best)}; and ${summaryOf(rival)}`, 'TIE')
  }

  // --- seal the winner, saying how it was chosen -----------------------------
  const d = best.decomposition
  const h = best.hypothesis
  const rankOf = (id: string): number => considered.findIndex((r) => r.hypothesis.id === id)
  const members = considered.slice(0, 4)
  if (!members.some((m) => m.hypothesis.id === h.id)) members[members.length - 1] = best
  const alternatives: AlternativeGroup[] =
    members.length >= 2
      ? [
          {
            id: stableId('alternative', 'plan-reading', { chosen: h.id }),
            what: 'which reading of the base plan the building is taken from',
            // the rank among the readings weighed, best first: 0, -1, -2 ... (no invented weights)
            members: members.map((m) => ({ id: m.hypothesis.id, score: -rankOf(m.hypothesis.id), summary: summaryOf(m) })),
            chosenId: h.id,
            margin: rival ? rankOf(rival.hypothesis.id) - rankOf(h.id) : members.length,
            why: `today's reading stopped; of ${counts.readings} other readings (${counts.distinctOutlines} distinct buildings, ${counts.compositions} composed in full) this is the best supported`,
          },
        ]
      : []
  const conflicts: LayoutConflict[] =
    h.scale.kind === 'LATTICE' || h.scale.kind === 'METRIC_HYPOTHESIS'
      ? [
          {
            id: stableId('conflict', 'plan-scale', { frameId: h.frameId, cmPerPx: h.scale.cmPerPx }),
            kind: 'SCALE_DISAGREEMENT',
            what: `the plan was registered at one scale and its own ${h.scale.kind === 'LATTICE' ? 'long spans, as first read,' : 'readings, as printed,'} imply another: ${h.scale.why}`,
            itemIds: [h.frameId],
            evidenceIds: [...new Set([...(h.scale.kind === 'LATTICE' ? h.scale.anchors.map((a) => a.evidenceId) : []), ...d.reread])].sort(),
            magnitude: round6(h.scale.cmPerPx),
            unit: 'none',
            note: `${d.reread.size} statement${d.reread.size === 1 ? '' : 's'} re-read at the new scale; ${round6(d.refutedShare * 100)}% of the stated chain length refuted`,
          },
        ]
      : []
  const reasons: LayoutGateReason[] = [
    {
      code: 'PLAN_RESOLVED_BY_HYPOTHESIS',
      severity: 'DEGRADING',
      what: `the building is taken from another reading of the plan: ${describe(h)}`,
      why: `the first reading stopped; this one departs from it in ${h.departures.map((x) => x.toLowerCase()).join(', ')}, lands ${best.score.footprint.bucket === 'AGREES' ? 'within 6% of the published footprint' : best.score.footprint.bucket === 'NEAR' ? 'within 20% of the published footprint' : spent ? 'without the published footprint, which refused the first reading and so does not choose its replacement,' : 'without a published footprint'}${best.score.corroborations.length > 0 ? ` and is corroborated by ${best.score.corroborations.join(', ').toLowerCase().replace(/_/g, ' ')}` : ''}. A reading chosen among several is a partial result until someone confirms it`,
      itemIds: [],
    },
  ]
  const result = composeStructuralLayout({ ...shared, metrics: d.metrics, plan: choiceOf(h, d), resolution: { reasons, alternatives, conflicts } })
  return { kind: 'RESOLVED', result, metrics: d.metrics, chosen: { hypothesis: h, score: best.score, stage: 2 }, considered, counts }
}

function choiceOf(h: PlanHypothesis, d: { reread: Set<string> }): PlanReadingChoice {
  return { frameId: h.frameId, extent: h.extent, merge: h.merge, faces: h.faces, mouths: h.mouths, rereadEvidenceIds: d.reread, alignByFitOnly: h.scale.kind === 'LATTICE' }
}

/** What a diagnostics bundle and a trace say about a resolution: counts and one line per reading. */
export function resolutionRecord(resolution: PlanResolution): Record<string, number | string | boolean> {
  const out: Record<string, number | string | boolean> = { resolverVersion: PLAN_RESOLVER_VERSION, outcome: resolution.kind, ...resolution.counts }
  if (resolution.kind === 'NO_ALTERNATIVE') return out
  if (resolution.kind === 'RESOLVED') {
    const c = resolution.chosen.score
    out.chosen = summaryOf(resolution.chosen)
    out.chosenDepartures = resolution.chosen.hypothesis.departures.join(',')
    // the same facts as numbers, so a gate can hold a rule instead of a hash
    out.chosenAreaM2 = c.footprint.areaM2
    out.chosenBucket = c.footprint.bucket
    if (c.footprint.residual !== undefined) out.chosenResidualPct = round6(c.footprint.residual * 100)
    out.chosenMasses = c.masses
    out.chosenCorroborations = c.corroborations.join(',')
  }
  resolution.considered.slice(0, 4).forEach((r, i) => (out[`reading${i + 1}`] = summaryOf(r)))
  return out
}

// ---------------------------------------------------------------------------
// the confidence-aware first success (1.3.0, BUILDPLAN-ANALYZER-005B)
// ---------------------------------------------------------------------------

const CONFIDENCE_RANK: Record<string, number> = { INCONCLUSIVE: 0, WEAK: 1, SUPPORTED: 2, STRONG: 3 }

/**
 * Whether a first reading that completed may keep the fast path.
 *
 * It may when its base plan's scale was chosen or confirmed by independent
 * readings (at least SUPPORTED) and its frame came from dimension chains; a
 * first reading that "completed" on a scale one reading states, or on a frame
 * the walls had to supply, has passed the gate without proving its metric
 * truth, and the metric readings the evidence does support are weighed against
 * it. Evidence sealed before the metric schema's 1.2.0 carries no solution and
 * keeps the fast path, as it always had.
 */
export function firstReadingNeedsChallenge(metrics: MetricEvidenceSet, incumbent: StructuralPassResult): { challenge: boolean; why: string } {
  const base = incumbent.draft.base
  if (!base) return { challenge: false, why: 'no base plan' }
  const solution = metricSolutionFor(metrics, base.frame.id)
  if (!solution) return { challenge: false, why: 'the metric evidence carries no independent solution for the base plan' }
  const chosen = solution.relation === 'CONFIRMED' || solution.relation === 'REPLACED' || solution.relation === 'ADDED'
  const supported = chosen && CONFIDENCE_RANK[solution.confidence] >= CONFIDENCE_RANK.SUPPORTED
  const framed = !base.extentProvenance || (base.extentProvenance.x === 'DIMENSION_CHAIN_EXTENT' && base.extentProvenance.y === 'DIMENSION_CHAIN_EXTENT')
  if (supported && framed) return { challenge: false, why: `the base plan's scale is ${solution.confidence} (${solution.relation.toLowerCase().replace(/_/g, ' ')}) and its frame is its dimension chains'` }
  return {
    challenge: true,
    why: [!supported ? `the base plan's scale is ${solution.confidence} (${solution.relation.toLowerCase().replace(/_/g, ' ')})` : '', !framed ? `its frame was taken from ${base.extentProvenance?.x}/${base.extentProvenance?.y}` : ''].filter(Boolean).join(', and '),
  }
}

export type ChallengeOutcome =
  | { kind: 'KEPT'; why: string; considered: RankedReading[]; counts: PlanResolutionCounts }
  | { kind: 'REPLACED'; why: string; result: StructuralPassResult; metrics: MetricEvidenceSet; chosen: RankedReading; considered: RankedReading[]; counts: PlanResolutionCounts }

/**
 * Weigh the METRIC alternatives to a first reading that completed on weak
 * metric evidence: the base copy at the other scales its readings support,
 * and — only when its frame was not its dimension chains' — framed by the
 * walls instead. Nothing else departs: the copy, the tiling, the faces and
 * the mouths stay the first reading's.
 *
 * The incumbent competes on the same score. An alternative replaces it only
 * when it is acceptable and strictly better on evidence the published figure
 * is not — fewer hard problems or refusals, less of the stated chain length
 * refuted, more of the wall explained, more independent corroborations — and
 * no worse against the figure. The figure alone never chooses between two
 * readings the drawing supports equally.
 */
export function challengeFirstReading(options: StructuralPassOptions, incumbent: StructuralPassResult, progress?: ResolverProgress): ChallengeOutcome {
  const sheetCache = options.sheetCache ?? new Map<string, PlanSheet>()
  const shared: StructuralPassOptions = { ...options, sheetCache }
  const published = options.publishedAreas?.find((a) => a.key === 'footprint_area' && a.unit === 'm2')?.value
  const base = incumbent.draft.base
  const counts: PlanResolutionCounts = { copies: 1, decompositions: 0, readings: 0, distinctOutlines: 0, compositions: 0, publishedFigure: published === undefined ? 'NONE' : 'SCORED' }
  const registration = base ? options.metrics.coordinateRegistrations.find((r) => r.frameId === base.frame.id && r.plane === 'PLAN_XZ') : undefined
  const sheet = base ? planSheet(base.frame, shared) : undefined
  if (!base || !registration || !sheet) return { kind: 'KEPT', why: 'the first reading has no registered base plan to weigh alternatives on', considered: [], counts }
  const solution = metricSolutionFor(options.metrics, base.frame.id)
  const tolerancePx = Math.max(2, sheet.wallPx / 2)
  const cluster = wallClusterExtent(sheet.mask, sheet.wallPx)?.rect ?? null
  const differs = (a: PixelRect, b: PixelRect): boolean => Math.max(Math.abs(a.x0 - b.x0), Math.abs(a.x1 - b.x1), Math.abs(a.y0 - b.y0), Math.abs(a.y1 - b.y1)) > sheet.wallPx
  // What the base storey's other copies say the building measures, as the resolver asks it.
  const otherCopies: Array<{ widthM: number; depthM: number }> = []
  for (const frame of options.graph.coordinateFrames) {
    if (frame.id === base.frame.id || frame.roles.projection !== 'ORTHOGRAPHIC_PLAN' || frame.roles.document !== 'FLOOR_PLAN' || frame.roles.storey !== base.frame.roles.storey) continue
    if (options.frameFilter && !options.frameFilter(frame)) continue
    const other = planSheet(frame, shared)
    const reg = options.metrics.coordinateRegistrations.find((r) => r.frameId === frame.id && r.plane === 'PLAN_XZ')
    const c = other ? wallClusterExtent(other.mask, other.wallPx)?.rect : undefined
    if (c && reg) otherCopies.push({ widthM: (c.x1 - c.x0) * reg.metresPerPixelX, depthM: (c.y1 - c.y0) * reg.metresPerPixelY })
  }
  type Alt = { extent: PlanReadingChoice['extent']; scale: ScaleChoice; metrics: MetricEvidenceSet; reread: Set<string>; refutedShare: number; supportedOnBothAxes: boolean }
  const alts: Alt[] = []
  for (const scale of solution ? metricScales(solution, registration) : []) {
    const at = metricsAtScale(options.metrics, base.frame.id, scale.cmPerPx, tolerancePx)
    alts.push({ extent: 'CHAIN_RECT', scale, metrics: at.view, reread: at.reread, refutedShare: at.refutedShare, supportedOnBothAxes: scale.axesMeasured })
  }
  const regShare = refutedShareAtRegistration(options.metrics, base.frame.id, registration, tolerancePx)
  // The walls may re-frame the plan only when it was the frame that was weak: a weak scale is
  // answered by the scales the readings support, not by drawing the building somewhere else.
  const framedByChains = !base.extentProvenance || (base.extentProvenance.x === 'DIMENSION_CHAIN_EXTENT' && base.extentProvenance.y === 'DIMENSION_CHAIN_EXTENT')
  if (!framedByChains && cluster && differs(cluster, base.extent)) alts.push({ extent: 'WALL_MASS_CLUSTER', scale: { kind: 'REGISTRATION' }, metrics: options.metrics, reread: new Set(), refutedShare: regShare, supportedOnBothAxes: registrationMeasuredOnBothAxes(solution) })
  if (!framedByChains && sheet.witness && differs(sheet.witness.rect, base.extent) && (!cluster || differs(sheet.witness.rect, cluster)))
    alts.push({ extent: 'WALL_WITNESS', scale: { kind: 'REGISTRATION' }, metrics: options.metrics, reread: new Set(), refutedShare: regShare, supportedOnBothAxes: registrationMeasuredOnBothAxes(solution) })
  counts.decompositions = alts.length
  const incumbentScore = scoreReading(incumbent.draft, { published, spent: false, refutedShare: regShare, sheet, cluster, supportedOnBothAxes: registrationMeasuredOnBothAxes(solution), otherCopies, gateRefusals: [] })
  const incumbentHypothesis: PlanHypothesis = { id: stableId('plan-reading', 'first-reading', { frameId: base.frame.id }), frameId: base.frame.id, annotation: base.frame.roles.annotation, extent: 'CHAIN_RECT', scale: { kind: 'REGISTRATION' }, merge: 'LARGEST_FIRST', faces: 'AS_GRIDDED', mouths: 'AS_DECIDED', departures: [] }
  const incumbentRanked: RankedReading = { hypothesis: incumbentHypothesis, score: incumbentScore, stage: 2 }
  const composed: Array<RankedReading & { result: StructuralPassResult; alt: Alt }> = []
  alts.forEach((alt, i) => {
    const hypothesis: PlanHypothesis = {
      id: stableId('plan-reading', `challenge-${alt.extent}`.toLowerCase(), { frameId: base.frame.id, extent: alt.extent, scale: alt.scale.kind === 'REGISTRATION' ? 'REG' : alt.scale.cmPerPx }),
      frameId: base.frame.id,
      annotation: base.frame.roles.annotation,
      extent: alt.extent,
      scale: alt.scale,
      merge: 'LARGEST_FIRST',
      faces: 'AS_GRIDDED',
      mouths: 'AS_DECIDED',
      departures: [...(alt.extent !== 'CHAIN_RECT' ? ['EXTENT'] : []), ...(alt.scale.kind !== 'REGISTRATION' ? ['SCALE'] : [])],
    }
    progress?.({ stage: 1, index: i + 1, total: alts.length, label: describe(hypothesis) })
    counts.readings += 1
    const choice = choiceOf(hypothesis, alt)
    const draft = inferStructuralLayout({ ...shared, metrics: alt.metrics, plan: choice })
    const stage1 = scoreReading(draft, { published, spent: false, refutedShare: alt.refutedShare, sheet, cluster, supportedOnBothAxes: alt.supportedOnBothAxes, otherCopies, gateRefusals: [] })
    if (stage1.hard.length > 0 || stage1.footprint.bucket === 'WRONG' || stage1.masses === 0) {
      composed.push({ hypothesis, score: stage1, stage: 1, result: incumbent, alt })
      return
    }
    const result = composeStructuralLayout({ ...shared, metrics: alt.metrics, plan: choice })
    counts.compositions += 1
    const refusals = result.layout.gate.reasons.filter((g) => g.severity === 'BLOCKING' && LAYOUT_REFUSAL_CODES.has(g.code)).map((g) => g.code).sort()
    composed.push({ hypothesis, stage: 2, result, alt, score: scoreReading(result.draft, { published, spent: false, refutedShare: alt.refutedShare, sheet, cluster, supportedOnBothAxes: alt.supportedOnBothAxes, otherCopies, gateRefusals: refusals }) })
  })
  counts.distinctOutlines = new Set([incumbentScore.outlineKey, ...composed.map((c) => c.score.outlineKey)]).size
  const considered = [incumbentRanked, ...composed.map((c) => ({ hypothesis: c.hypothesis, score: c.score, stage: c.stage }))].sort(compareReadings)
  // Better on the drawing's own evidence, never on the published figure alone.
  const bucket = (v: number): number => Math.floor(v / 0.05 + 1e-9)
  const drawingTuple = (r: RankedReading): number[] => [r.score.hard.length, r.score.gateRefusals.length, bucket(r.score.refutedShare), -bucket(r.score.wallCoverage), -r.score.corroborations.length]
  const strictlyBetter = (a: RankedReading, b: RankedReading): boolean => {
    const [x, y] = [drawingTuple(a), drawingTuple(b)]
    const first = x.findIndex((v, i) => v !== y[i])
    return first >= 0 && x[first] < y[first] && FOOTPRINT_BUCKETS.indexOf(a.score.footprint.bucket) <= FOOTPRINT_BUCKETS.indexOf(b.score.footprint.bucket)
  }
  const winner = composed.filter((c) => c.stage === 2 && acceptable(c) && strictlyBetter(c, incumbentRanked)).sort(compareReadings)[0]
  if (!winner) return { kind: 'KEPT', why: `${alts.length} metric reading${alts.length === 1 ? '' : 's'} of the base plan weighed; none is better supported by the drawing than the first reading`, considered, counts }
  const h = winner.hypothesis
  const reasons: LayoutGateReason[] = [
    {
      code: 'PLAN_RESOLVED_BY_HYPOTHESIS',
      severity: 'DEGRADING',
      what: `the building is taken from another metric reading of the plan: ${describe(h)}`,
      why: `the first reading completed on weak metric evidence; this reading departs from it in ${h.departures.map((x) => x.toLowerCase()).join(', ')} and is better supported by the drawing itself${winner.score.corroborations.length > 0 ? `, corroborated by ${winner.score.corroborations.join(', ').toLowerCase().replace(/_/g, ' ')}` : ''}. A reading chosen among several is a partial result until someone confirms it`,
      itemIds: [],
    },
  ]
  const alternatives: AlternativeGroup[] = [
    {
      id: stableId('alternative', 'plan-reading', { chosen: h.id }),
      what: 'which metric reading of the base plan the building is taken from',
      members: considered.slice(0, 4).map((m, i) => ({ id: m.hypothesis.id, score: -i, summary: summaryOf(m) })),
      chosenId: h.id,
      margin: 1,
      why: `the first reading completed on weak metric evidence; of ${counts.readings} metric readings this is the best supported by the drawing`,
    },
  ]
  const conflicts: LayoutConflict[] =
    h.scale.kind === 'METRIC_HYPOTHESIS'
      ? [{ id: stableId('conflict', 'plan-scale', { frameId: h.frameId, cmPerPx: h.scale.cmPerPx }), kind: 'SCALE_DISAGREEMENT', what: `the plan was registered at one scale and its readings, as printed, imply another: ${h.scale.why}`, itemIds: [h.frameId], evidenceIds: [...winner.alt.reread].sort(), magnitude: round6(h.scale.cmPerPx), unit: 'none', note: `${winner.alt.reread.size} statement${winner.alt.reread.size === 1 ? '' : 's'} re-read at the new scale` }]
      : []
  const result = composeStructuralLayout({ ...shared, metrics: winner.alt.metrics, plan: choiceOf(h, winner.alt), resolution: { reasons, alternatives, conflicts } })
  return { kind: 'REPLACED', why: `the metric reading ${describe(h)} is better supported than the first reading`, result, metrics: winner.alt.metrics, chosen: { hypothesis: h, score: winner.score, stage: 2 }, considered, counts }
}

/** What a trace records about a challenge: the outcome, the counts, the readings weighed. */
export function challengeRecord(outcome: ChallengeOutcome, why: string): Record<string, number | string | boolean> {
  const out: Record<string, number | string | boolean> = { resolverVersion: PLAN_RESOLVER_VERSION, outcome: outcome.kind, trigger: why, ...outcome.counts }
  if (outcome.kind === 'REPLACED') out.chosen = summaryOf(outcome.chosen)
  outcome.considered.slice(0, 4).forEach((r, i) => (out[`reading${i + 1}`] = summaryOf(r)))
  return out
}
