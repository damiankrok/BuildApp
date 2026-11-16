/**
 * v3.54.3: one metric revision — the property, as a check on a sealed evidence set.
 *
 * A frame's metric solution states the scale the frame is read at. Everything that scale chose or computed is its
 * DEPENDENT: a chain segment whose value was corrected to fit a scale (CHAIN_CORRECTED) or computed from one (DERIVED),
 * and the frame's registration. A dependent made at another scale than the one the solution states is a value of a
 * revision that no longer stands, and it must not be in the set. A READ value is not a dependent: it is what the sheet
 * prints, it may disagree with the scale, and it is counted apart — never "fixed" here.
 *
 * Pure: a set in, the violations out. The metric layer's tests hold it on every set they build; the consultation loop
 * records it for every candidate it rebuilds.
 */
import type { MetricEvidenceSet } from './schema.js'

export type CoherenceViolation =
  | { kind: 'SEGMENT'; frameId: string; chainId: string; index: number; origin: string; valueCm: number; pixelLength: number; cmAtScale: number; residualPx: number }
  | { kind: 'REGISTRATION'; frameId: string; registrationId: string; axis: 'X' | 'Y'; metresPerPixel: number; solutionCmPerPixel: number }

export type CoherenceReport = {
  /** Frames whose solution states a scale. */
  frames: number
  /** Dependent values weighed (corrected and derived segments, registrations). */
  dependents: number
  violations: CoherenceViolation[]
  /** READ segments further from the frame's scale than the tolerance: observations that disagree, kept as they are. */
  readDisagreements: number
}

/** How far (px) a dependent may miss the scale it was made at; the chains' own solving tolerance is of this order. */
export const COHERENCE_TOLERANCE_PX = 3
/** Two scales within this ratio are one scale (the solver's own DISTINCT_RATIO). */
export const COHERENCE_SCALE_RATIO = 0.03

export function metricCoherence(set: Pick<MetricEvidenceSet, 'metricSolutions' | 'chains' | 'coordinateRegistrations'>, tolerancePx: number = COHERENCE_TOLERANCE_PX): CoherenceReport {
  const violations: CoherenceViolation[] = []
  let dependents = 0
  let readDisagreements = 0
  let frames = 0
  for (const s of set.metricSolutions ?? []) {
    const sx = s.cmPerPixelX ?? s.cmPerPixelY
    const sy = s.cmPerPixelY ?? s.cmPerPixelX
    if (sx === undefined || sy === undefined) continue
    frames += 1
    for (const c of set.chains.filter((x) => x.frameId === s.frameId)) {
      const scale = c.axis === 'HORIZONTAL' ? sx : sy
      for (const g of c.segments) {
        if (g.valueCm === undefined) continue
        const residualPx = Math.abs(g.valueCm / scale - g.pixelLength)
        // a relative allowance beside the absolute one: a long span carries the scale's own last digits
        const allowed = tolerancePx + g.pixelLength * 0.005
        if (g.origin === 'READ') {
          if (residualPx > allowed) readDisagreements += 1
          continue
        }
        dependents += 1
        if (residualPx > allowed) violations.push({ kind: 'SEGMENT', frameId: s.frameId, chainId: c.id, index: g.index, origin: g.origin ?? 'UNKNOWN', valueCm: g.valueCm, pixelLength: g.pixelLength, cmAtScale: Math.round(g.pixelLength * scale * 1e3) / 1e3, residualPx: Math.round(residualPx * 1e3) / 1e3 })
      }
    }
    // only a solution that REPLACED or ADDED the scale re-registers the frame at it; a kept page vote's registration is
    // the vote's own fit and is weighed by the reconstruction, not here
    if (s.relation !== 'REPLACED' && s.relation !== 'ADDED') continue
    for (const r of set.coordinateRegistrations.filter((x) => x.frameId === s.frameId)) {
      for (const [axis, mpp, cm] of [['X', r.metresPerPixelX, sx], ['Y', r.metresPerPixelY, sy]] as const) {
        if (mpp === undefined || !(mpp > 0)) continue
        dependents += 1
        if (Math.abs(Math.log((mpp * 100) / cm)) > COHERENCE_SCALE_RATIO) violations.push({ kind: 'REGISTRATION', frameId: s.frameId, registrationId: r.id, axis, metresPerPixel: mpp, solutionCmPerPixel: cm })
      }
    }
  }
  return { frames, dependents, violations, readDisagreements }
}
