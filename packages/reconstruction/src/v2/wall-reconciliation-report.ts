/**
 * 005Y-N7 (A): what the wall reconciliation did, said where the analysis trace, the result and a refusal say things.
 * A reconciled model is labelled for what it is: `PREVIEW_WITH_ADJUSTMENTS` when every wall stands, moved only within
 * the plan's uncertainty; `PARTIAL_SOURCE_GROUNDED` when a partition (and what it carried) had to be left out.
 */
import type { ReconciliationDependent, WallReconcileResult, WallReconciliationRecord } from '../candidate.js'
import type { SolverStep, UnresolvedCandidate } from '../candidate.js'
import { reconcileToleranceM } from './wall-reconciliation.js'

export type ReconstructionMode = 'PREVIEW_WITH_ADJUSTMENTS' | 'PARTIAL_SOURCE_GROUNDED' | 'REFUSED'

export type WallReconciliationReport = {
  mode: ReconstructionMode
  toleranceM: number
  records: WallReconciliationRecord[]
  /** Commands left out with a wall they needed: openings, finishes, evidence. */
  dependents: ReconciliationDependent[]
  /** Walls not in the model, by id. */
  omittedWalls: string[]
}

/** The tolerance of the coarsest plan read: a wall is uncertain by the plan it was drawn on. */
export function planReconcileTolerance(frames: ReadonlyArray<{ mppX: number; mppY: number }>): number {
  const mpp = Math.max(0, ...frames.map((f) => Math.max(f.mppX, f.mppY)))
  return reconcileToleranceM(mpp)
}

const OMITTING = new Set(['OMITTED'])

export function modeOf(result: WallReconcileResult): ReconstructionMode {
  if (!result.ok) return 'REFUSED'
  // the evidence of a wall left out goes with it; only something the model would have shown makes it partial
  return result.records.some((r) => OMITTING.has(r.action)) || result.dependents.some((d) => d.type !== 'setEvidence') ? 'PARTIAL_SOURCE_GROUNDED' : 'PREVIEW_WITH_ADJUSTMENTS'
}

const cm = (m: number): string => `${(m * 100).toFixed(1)} cm`

type Step = (s: Omit<SolverStep, 'index'>) => void
type Gap = (u: Omit<UnresolvedCandidate, 'id'>) => void
type Trace = (e: { phase: 'MODEL'; substage: string; status: 'PASSED' | 'DEGRADED' | 'FAILED'; counts: Record<string, number | string | boolean>; reasonCode?: string }) => void

/** Every record as a solver step; every wall left out, and everything that went with it, as a named gap. */
export function reportWallReconciliation(result: WallReconcileResult, step: Step, gap: Gap, trace: Trace): WallReconciliationReport {
  const toleranceM = result.records[0]?.toleranceM ?? 0
  for (const r of result.records)
    step({ stage: 'emission', what: `GEOMETRY_RECONCILIATION ${r.wallId} against ${r.otherWallId}`, method: r.action === 'REFUSED' ? 'REFUSED' : 'BOUNDED_SEARCH', detail: `${r.relation} → ${r.action}: moved ${cm(r.moveM)} (tolerance ${cm(r.toleranceM)}, overlap ${r.overlapAreaM2.toFixed(4)} m²); ${r.why}`, inputs: 2, outputs: r.action === 'OMITTED' || r.action === 'REFUSED' ? 0 : 1, residual: r.penetrationM })
  const omittedWalls = result.records.filter((r) => r.action === 'OMITTED').map((r) => r.wallId)
  for (const r of result.records.filter((x) => x.action === 'OMITTED')) gap({ what: `the partition ${r.wallId}`, reason: `left out of this preview: ${r.why}`, status: 'MISSING', observationIds: [], evidenceIds: [] })
  for (const d of result.dependents.filter((x) => x.type !== 'setEvidence')) gap({ what: `${d.type}${d.id ? ` ${d.id}` : ''}`, reason: `left out of this preview: ${d.why}`, status: 'MISSING', observationIds: [], evidenceIds: [] })
  const mode = modeOf(result)
  const counts: Record<string, number> = {}
  for (const r of result.records) counts[r.action.toLowerCase()] = (counts[r.action.toLowerCase()] ?? 0) + 1
  trace({ phase: 'MODEL', substage: 'WALL_RECONCILIATION', status: mode === 'REFUSED' ? 'FAILED' : 'DEGRADED', counts: { ...counts, dependents: result.dependents.length, toleranceMm: Math.round(toleranceM * 1000) }, reasonCode: mode })
  return { mode, toleranceM, records: result.records, dependents: result.dependents.filter((d) => d.type !== 'setEvidence'), omittedWalls }
}

/** A refusal's wall pair, in numbers someone can find on the plan. */
export function refusalDiagnostics(r: WallReconciliationRecord): Record<string, string | number> {
  const p = (v: { x: number; z: number }): string => `${v.x.toFixed(3)},${v.z.toFixed(3)}`
  return {
    reconciliation: r.relation,
    reconciliationWall: `${r.wallId} ${p(r.before.start)}→${p(r.before.end)}`,
    reconciliationAgainst: r.otherWallId,
    penetrationM: r.penetrationM,
    toleranceM: r.toleranceM,
    overlapAreaM2: r.overlapAreaM2,
    reconciliationWhy: r.why.slice(0, 240),
  }
}
