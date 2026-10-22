/**
 * 005Y-N7 (B): how the model agrees with each source view, in one record.
 *
 * `verifyAgainstViews` projects the building into every registered elevation and measures what it can (opening sills
 * and heads, roof edges, recess planes, members, the silhouette); `repairFromResiduals` then moves what may move within
 * its own uncertainty, a bounded number of times. Both leave their numbers in long lists. This module states them per
 * view and per kind — how many checks, how many within tolerance, the typical and the worst residual, and which
 * features stand outside — so a reader (or a diagnostics bundle) can see at once which elevation disagrees with the
 * plan and about what. It decides nothing and moves nothing.
 */
import { round6 } from '@buildapp/source-common'
import type { RepairTrace, ResidualKind, SourceViewResidual } from './verify.js'

export type CrossViewKindSummary = {
  kind: ResidualKind
  checks: number
  withinTolerance: number
  /** Median and largest absolute residual, metres. */
  medianAbsM: number
  maxAbsM: number
  /** Features outside tolerance, worst first (at most `OUTLIERS_LISTED`). */
  outliers: Array<{ featureId: string; residualM: number; toleranceM: number }>
}

export type CrossViewSummary = {
  frameId: string
  side: string
  /** The view's registration: metres per pixel across and up, and how its span was fixed. */
  registration?: { mpp: number; spanM?: number; why?: string }
  checks: number
  withinTolerance: number
  kinds: CrossViewKindSummary[]
  /** AGREES: every check within tolerance; DISAGREES: a third or more outside; otherwise MIXED; UNCHECKED: none. */
  verdict: 'AGREES' | 'MIXED' | 'DISAGREES' | 'UNCHECKED'
}

export type CrossViewResiduals = {
  views: CrossViewSummary[]
  /** What the bounded reconciliation did: iterations, operations applied and refused, whether it converged. */
  reconciliation: { iterations: number; applied: number; refused: number; converged: boolean; residualsBefore: number; residualsAfter: number }
}

/** How many outliers a kind lists. */
export const OUTLIERS_LISTED = 5
/** A view disagrees when at least this share of its checks are outside tolerance. */
const DISAGREE_SHARE = 1 / 3

const median = (v: number[]): number => {
  if (v.length === 0) return 0
  const s = [...v].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

/** One kind of check on one view. */
export function summariseKind(kind: ResidualKind, rs: readonly SourceViewResidual[]): CrossViewKindSummary {
  const abs = rs.map((r) => Math.abs(r.residualM))
  const outliers = rs
    .filter((r) => !r.withinTolerance)
    .sort((a, b) => Math.abs(b.residualM) - Math.abs(a.residualM))
    .slice(0, OUTLIERS_LISTED)
    .map((r) => ({ featureId: r.featureId, residualM: round6(r.residualM), toleranceM: round6(r.toleranceM) }))
  return { kind, checks: rs.length, withinTolerance: rs.filter((r) => r.withinTolerance).length, medianAbsM: round6(median(abs)), maxAbsM: round6(abs.length > 0 ? Math.max(...abs) : 0), outliers }
}

/** The verdict a view's checks give. */
export function verdictOf(checks: number, within: number): CrossViewSummary['verdict'] {
  if (checks === 0) return 'UNCHECKED'
  if (within === checks) return 'AGREES'
  return (checks - within) / checks >= DISAGREE_SHARE ? 'DISAGREES' : 'MIXED'
}

/**
 * The residuals of every registered view, per view and per kind, with the reconciliation's outcome. Views with no
 * residual are listed as UNCHECKED: a view the model was not compared with is not a view it agrees with.
 */
export function crossViewResiduals(residuals: readonly SourceViewResidual[], views: ReadonlyArray<{ frameId: string; side: string; mpp?: number; spanM?: number; spanWhy?: string }>, repair: RepairTrace): CrossViewResiduals {
  const out: CrossViewSummary[] = []
  for (const v of [...views].sort((a, b) => (a.frameId < b.frameId ? -1 : a.frameId > b.frameId ? 1 : 0))) {
    const mine = residuals.filter((r) => r.frameId === v.frameId)
    const kinds = [...new Set(mine.map((r) => r.kind))].sort().map((k) => summariseKind(k, mine.filter((r) => r.kind === k)))
    const within = mine.filter((r) => r.withinTolerance).length
    out.push({
      frameId: v.frameId,
      side: v.side,
      ...(v.mpp !== undefined ? { registration: { mpp: round6(v.mpp), ...(v.spanM !== undefined ? { spanM: round6(v.spanM) } : {}), ...(v.spanWhy ? { why: v.spanWhy } : {}) } } : {}),
      checks: mine.length,
      withinTolerance: within,
      kinds,
      verdict: verdictOf(mine.length, within),
    })
  }
  const its = repair.iterations
  return {
    views: out,
    reconciliation: {
      iterations: its.length,
      applied: its.reduce((n, i) => n + i.applied.length, 0),
      refused: its.reduce((n, i) => n + i.refused.length, 0),
      converged: repair.converged,
      residualsBefore: its[0]?.residualsBefore ?? 0,
      residualsAfter: its[its.length - 1]?.residualsAfter ?? 0,
    },
  }
}
