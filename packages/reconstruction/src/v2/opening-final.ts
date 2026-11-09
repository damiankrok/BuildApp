/**
 * v3.51 C2: an opening's feature after the LAST decision and the emission — what was accepted, and what was applied.
 *
 * The OPENING feature is recorded when the plan gap is read; the facade alignment, the residual repair and the fit to
 * the host wall run later and used to leave that record as it was first written. Here the record is closed from the
 * final state: its parameters are the ACCEPTED decision (the opening as the solver holds it after every correction),
 * each with its own provenance, and `application` says what the final program actually built — as accepted, fitted
 * (with the applied values and the reason's code) or not built. The source reading itself (a callout, a view's extent)
 * stays in its evidence and is never rewritten to what fitted.
 */
import { round6 } from '@buildapp/source-common'
import type { FeatureParameter, ProvenanceStatus, SolvedFeature } from './graph.js'

type FeatureParameters = Record<string, FeatureParameter>

export type FinalOpening = { id: string; interval: [number, number]; widthM: number; sillY: number; headY: number; family: string; uncertaintyM: number; provenance: { width: ProvenanceStatus; sill: ProvenanceStatus; head: ProvenanceStatus; profile: ProvenanceStatus; family: ProvenanceStatus } }
export type AppliedCut = { kind: string; sill: number; width: number; height: number }
export type OpeningApplication = NonNullable<SolvedFeature['application']>

const SAME_M = 1e-6

export function finalOpeningRecord(o: FinalOpening, levelElevation: number, cut: AppliedCut | undefined, fit: { action: string; code: string } | undefined): { parameters: FeatureParameters; parameterProvenance: Record<string, ProvenanceStatus>; application: OpeningApplication } {
  const p = (value: number, u: number): FeatureParameters[string] => ({ value: round6(value), low: round6(value - u), high: round6(value + u), unit: 'm' })
  const parameters: FeatureParameters = { from: p(o.interval[0], o.uncertaintyM), width: p(o.widthM, o.uncertaintyM), sillY: p(o.sillY, 0.1), headY: p(o.headY, 0.1) }
  const parameterProvenance = { sillY: o.provenance.sill, headY: o.provenance.head, width: o.provenance.width, profile: o.provenance.profile, family: o.provenance.family }
  const acceptedKind = o.family
  if (!cut) return { parameters, parameterProvenance, application: { state: 'NOT_BUILT', acceptedKind, reasonCode: fit?.code ?? 'NOT_EMITTED' } }
  const applied = { width: round6(cut.width), sillY: round6(levelElevation + cut.sill), headY: round6(levelElevation + cut.sill + cut.height), kind: cut.kind }
  const same = Math.abs(applied.width - o.widthM) <= SAME_M && Math.abs(applied.sillY - o.sillY) <= SAME_M && Math.abs(applied.headY - o.headY) <= SAME_M
  if (same) return { parameters, parameterProvenance, application: { state: 'AS_ACCEPTED', acceptedKind, applied } }
  return { parameters, parameterProvenance, application: { state: 'FITTED', acceptedKind, applied, reasonCode: fit?.code ?? 'EMISSION_BOUNDS' } }
}
