/**
 * v3.54.16 — what the check established, as states that do not lean on each other: a review that ran is not a model
 * that matches, a revision that may be reused is not a verified one, and an applied patch is not a closed defect until
 * a look at the NEW revision says so and the source measure agrees.
 *
 *   REVIEW_COMPLETED          the delivered revision itself was looked at (a technical fact, not a grade)
 *   SOURCE_VERIFIED_IN_SCOPE  that look found no open difference in its declared scope, nothing measured contradicts it
 *   RECOGNIZABLE_PARTIAL      differences remain, none of them KEY: a usable, recognisable model with named defects
 *   NEEDS_EVIDENCE            a KEY difference stays open because the source does not decide it (or a view lacks a datum)
 *   UNSUPPORTED_OPERATION     a KEY difference stays open because no operation of the registry can change it
 *   NO_IMPROVEMENT            supported proposals were tried for KEY differences and none was kept
 *   BUDGET_OR_ROUND_LIMIT     proposals were left unapplied, or applied and never looked at, when the rounds ran out
 *   NOT_REVIEWED              no look succeeded
 * CAN_REUSE is the accepted-revision store's own state and is reported beside these, never instead of them.
 */
import type { PatchRecord } from './execute.js'
import type { ReviewDefect } from './registry.js'

export const QUALITY_VERSION = '1.0.0' as const

export const QUALITY_STATES = ['SOURCE_VERIFIED_IN_SCOPE', 'RECOGNIZABLE_PARTIAL', 'NEEDS_EVIDENCE', 'UNSUPPORTED_OPERATION', 'NO_IMPROVEMENT', 'BUDGET_OR_ROUND_LIMIT', 'NOT_REVIEWED'] as const
export type QualityState = (typeof QUALITY_STATES)[number]

export type DefectSettlement = 'CLOSED_VERIFIED' | 'APPLIED_NOT_REVIEWED' | 'APPLIED_REVIEW_DISAGREES' | 'REJECTED_BY_SOURCE' | 'NEEDS_EVIDENCE' | 'UNSUPPORTED_OPERATION' | 'NO_PROPOSAL' | 'REFUSED' | 'ROUND_LIMIT'

/** One defect as the result carries it: where it came from, what was proposed and what became of it. */
export type DefectEntry = {
  id: string
  look: number
  about: string
  scope: string
  severity: string
  certainty: string
  operation: string
  family?: string
  proposalId?: string
  patchStatus?: string
  patchCode?: string
  settlement: DefectSettlement
  /** The revision on which the settlement was verified (CLOSED_VERIFIED only). */
  verifiedOn?: string
  why: string
}

export type QualitySummary = {
  version: string
  reviewCompleted: boolean
  state: QualityState
  /** Every state that applies, the primary first. */
  reasons: QualityState[]
  openKey: number
  openOther: number
  closedVerified: number
  appliedNotReviewed: number
  defects: DefectEntry[]
  why: string
}

/**
 * The defects of one look settled from the patch records of that look and the review of the next one.
 * `reviewedNext`: the next look's verdict on each applied element id (MATCHES / ACCEPTABLE_APPROXIMATION keep it closed).
 */
export function settleDefects(look: number, defects: readonly ReviewDefect[], proposals: ReadonlyArray<{ proposalId: string; defectId?: string }>, records: readonly PatchRecord[], reviewedNext: ReadonlyMap<string, string> | undefined, nextRevision: string | undefined, roundLimited: boolean): DefectEntry[] {
  return defects.map((d) => {
    const p = proposals.find((x) => x.defectId === d.id)
    const r = p ? records.find((x) => x.proposalId === p.proposalId || x.proposalId.endsWith(`:${p.proposalId}`)) : undefined
    const base = { id: `L${look}:${d.id}`, look, about: d.about, scope: d.scope, severity: d.severity, certainty: d.certainty, operation: d.operation, ...(d.family && d.family !== 'NONE' ? { family: d.family } : {}), ...(p ? { proposalId: p.proposalId } : {}), ...(r ? { patchStatus: r.status, ...(r.code ? { patchCode: r.code } : {}) } : {}) }
    if (d.operation === 'UNSUPPORTED') return { ...base, settlement: 'UNSUPPORTED_OPERATION' as const, why: `no operation of the registry changes ${d.family ?? 'it'}: named, not corrected` }
    if (!p) return { ...base, settlement: roundLimited ? ('ROUND_LIMIT' as const) : ('NO_PROPOSAL' as const), why: roundLimited ? 'reported in the last look, when no further round could apply anything' : 'reported without a proposal the analyzer could apply' }
    if (!r) return { ...base, settlement: 'REFUSED' as const, why: 'its proposal has no record (not admitted)' }
    if (r.status === 'COMMITTED') {
      const ids = r.bound?.ids ?? []
      const verdicts = ids.map((id) => reviewedNext?.get(id)).filter((v): v is string => v !== undefined)
      if (!reviewedNext || verdicts.length === 0) return { ...base, settlement: roundLimited ? ('ROUND_LIMIT' as const) : ('APPLIED_NOT_REVIEWED' as const), why: 'applied, compiled and measured; no look at the new revision has judged it' }
      const agree = verdicts.every((v) => v === 'MATCHES' || v === 'ACCEPTABLE_APPROXIMATION')
      if (agree && r.measure?.sourceVerified !== false) return { ...base, settlement: 'CLOSED_VERIFIED' as const, ...(nextRevision ? { verifiedOn: nextRevision } : {}), why: `applied; the look at the new revision says ${verdicts.join(', ')}; the source measure ${r.measure?.sourceVerified === true ? 'supports the built element' : 'is not contradicted'}` }
      return { ...base, settlement: 'APPLIED_REVIEW_DISAGREES' as const, why: `applied, but the look at the new revision says ${verdicts.join(', ')}${r.measure?.sourceVerified === false ? '; the source measure does not support the built element' : ''}` }
    }
    if (r.status === 'REJECTED_BY_SOURCE') return { ...base, settlement: 'REJECTED_BY_SOURCE' as const, why: r.why }
    if (r.status === 'NEEDS_EVIDENCE') return { ...base, settlement: 'NEEDS_EVIDENCE' as const, why: r.why }
    if (r.status === 'UNSUPPORTED_OPERATION') return { ...base, settlement: 'UNSUPPORTED_OPERATION' as const, why: r.why }
    return { ...base, settlement: 'REFUSED' as const, why: `${r.status}${r.code ? ` ${r.code}` : ''}: ${r.why}` }
  })
}

const OPEN: ReadonlySet<DefectSettlement> = new Set(['APPLIED_REVIEW_DISAGREES', 'REJECTED_BY_SOURCE', 'NEEDS_EVIDENCE', 'UNSUPPORTED_OPERATION', 'NO_PROPOSAL', 'REFUSED', 'ROUND_LIMIT', 'APPLIED_NOT_REVIEWED'])

/**
 * The quality of the delivered revision. `defects` are the settled defects of the LAST look (earlier looks' defects are
 * kept for the record; what the last look no longer reports was answered by an applied patch it reviewed, or is not
 * seen any more — that look is the judge). `measuredContradictions` are known defects the analyzer itself measured
 * (an outline short of a printed dimension, a contradicted scale): an AI MATCHES never cancels them.
 */
export function qualityOf(input: { looked: boolean; checkedRevision: string | null; deliveredRevision: string | null; lastStatus: string | null; defects: readonly DefectEntry[]; allDefects?: readonly DefectEntry[]; measuredContradictions: number; pendingAtLimit: number; attemptedForKey: number; committedForKey: number }): QualitySummary {
  const all = input.allDefects ?? input.defects
  const reviewCompleted = input.looked && input.checkedRevision !== null && input.checkedRevision === input.deliveredRevision
  const open = input.defects.filter((d) => OPEN.has(d.settlement))
  const openKey = open.filter((d) => d.severity === 'KEY')
  const reasons: QualityState[] = []
  if (!input.looked) reasons.push('NOT_REVIEWED')
  if (openKey.some((d) => d.settlement === 'UNSUPPORTED_OPERATION')) reasons.push('UNSUPPORTED_OPERATION')
  if (openKey.some((d) => d.settlement === 'NEEDS_EVIDENCE')) reasons.push('NEEDS_EVIDENCE')
  if (input.pendingAtLimit > 0 || open.some((d) => d.settlement === 'ROUND_LIMIT' || d.settlement === 'APPLIED_NOT_REVIEWED') || (input.looked && !reviewCompleted)) reasons.push('BUDGET_OR_ROUND_LIMIT')
  if (input.attemptedForKey > 0 && input.committedForKey === 0 && openKey.length > 0) reasons.push('NO_IMPROVEMENT')
  const verified = reviewCompleted && open.length === 0 && input.measuredContradictions === 0 && input.lastStatus === 'VERIFIED_IN_SCOPE'
  if (verified) reasons.unshift('SOURCE_VERIFIED_IN_SCOPE')
  else if (input.looked && openKey.length === 0 && !reasons.includes('BUDGET_OR_ROUND_LIMIT')) reasons.unshift('RECOGNIZABLE_PARTIAL')
  else if (input.looked && openKey.length === 0) reasons.push('RECOGNIZABLE_PARTIAL')
  if (reasons.length === 0) reasons.push(openKey.length > 0 ? 'NEEDS_EVIDENCE' : 'RECOGNIZABLE_PARTIAL')
  const state = reasons[0]
  const closed = all.filter((d) => d.settlement === 'CLOSED_VERIFIED').length
  const notReviewed = all.filter((d) => d.settlement === 'APPLIED_NOT_REVIEWED').length
  const why = !input.looked ? 'no look at the model succeeded' : `${reviewCompleted ? 'the delivered revision was looked at' : 'the delivered revision was NOT the one looked at last'}; ${open.length} difference(s) open (${openKey.length} KEY)${open.length > 0 ? `: ${open.slice(0, 4).map((d) => `${d.id} ${d.settlement}`).join(', ')}` : ''}; ${closed} closed on a verified revision${input.measuredContradictions > 0 ? `; ${input.measuredContradictions} measured contradiction(s) the review does not cancel` : ''}`
  return { version: QUALITY_VERSION, reviewCompleted, state, reasons: [...new Set(reasons)], openKey: openKey.length, openOther: open.length - openKey.length, closedVerified: closed, appliedNotReviewed: notReviewed, defects: [...all], why }
}
