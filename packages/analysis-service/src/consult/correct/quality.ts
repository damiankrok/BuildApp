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
 *
 * v3.54.16 audit fixes (quality 1.1.0):
 *  - A1: a defect keeps one identity across looks (`key`). It leaves the open set only by a verified closure, by an
 *    explicit SUPERSEDED / NO_LONGER_DIFFERENT statement of a later look on a NEW revision, or not at all. A later look
 *    that simply does not mention it does not close it (`carried`); a later look that calls it absent from the source
 *    while the earlier one saw it is a DISPUTE, which stays open — two answers about the same picture are named, not
 *    resolved by recency.
 *  - A4: CLOSED_VERIFIED needs the source measure to SUPPORT the built element (`sourceVerified === true`). A reviewer's
 *    agreement with no source measure is CLOSED_REVIEW_ONLY: not open, but never SOURCE_VERIFIED_IN_SCOPE.
 */
import type { PatchRecord } from './execute.js'
import type { ReviewDefect } from './registry.js'

export const QUALITY_VERSION = '1.1.0' as const

export const QUALITY_STATES = ['SOURCE_VERIFIED_IN_SCOPE', 'RECOGNIZABLE_PARTIAL', 'NEEDS_EVIDENCE', 'UNSUPPORTED_OPERATION', 'NO_IMPROVEMENT', 'BUDGET_OR_ROUND_LIMIT', 'NOT_REVIEWED'] as const
export type QualityState = (typeof QUALITY_STATES)[number]

export type DefectSettlement = 'CLOSED_VERIFIED' | 'CLOSED_REVIEW_ONLY' | 'RESOLVED_BY_REVIEW' | 'DISPUTED' | 'APPLIED_NOT_REVIEWED' | 'APPLIED_REVIEW_DISAGREES' | 'REJECTED_BY_SOURCE' | 'NEEDS_EVIDENCE' | 'UNSUPPORTED_OPERATION' | 'NO_PROPOSAL' | 'REFUSED' | 'ROUND_LIMIT'

/** One defect as the result carries it: where it came from, what was proposed and what became of it. */
export type DefectEntry = {
  id: string
  /** v3.54.16 (1.1.0): the defect's identity across looks — the ledger id under which it was first reported. */
  key: string
  look: number
  about: string
  scope: string
  severity: string
  certainty: string
  operation: string
  family?: string
  /** The earlier defect (ledger id or key) this one restates, as the reviewer declared it. */
  continues?: string
  proposalId?: string
  patchStatus?: string
  patchCode?: string
  settlement: DefectSettlement
  /** The revision on which the settlement was verified (CLOSED_VERIFIED only). */
  verifiedOn?: string
  /** The last look that reported it, when a later look looked and did not mention it (omission is not closure). */
  carriedFrom?: number
  why: string
}

/** A later look's explicit statement about an earlier defect (by its ledger id or key). */
export type DefectResolution = { look: number; revision: string; defectId: string; verdict: 'NO_LONGER_DIFFERENT' | 'NOT_IN_SOURCE' | 'SUPERSEDED'; note: string; supersededBy?: string }

export type QualitySummary = {
  version: string
  reviewCompleted: boolean
  state: QualityState
  /** Every state that applies, the primary first. */
  reasons: QualityState[]
  openKey: number
  openOther: number
  closedVerified: number
  /** Closed on the reviewer's word with no source measure supporting it (never SOURCE_VERIFIED_IN_SCOPE). */
  closedReviewOnly: number
  appliedNotReviewed: number
  /** The defects as they stand after every look (one per identity). */
  defects: DefectEntry[]
  /** Every statement of every look, for the record. */
  ledger: DefectEntry[]
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
    const id = `L${look}:${d.id}`
    const continues = (d as { continues?: string }).continues
    const base = { id, key: id, ...(continues ? { continues } : {}), look, about: d.about, scope: d.scope, severity: d.severity, certainty: d.certainty, operation: d.operation, ...(d.family && d.family !== 'NONE' ? { family: d.family } : {}), ...(p ? { proposalId: p.proposalId } : {}), ...(r ? { patchStatus: r.status, ...(r.code ? { patchCode: r.code } : {}) } : {}) }
    if (d.operation === 'UNSUPPORTED') return { ...base, settlement: 'UNSUPPORTED_OPERATION' as const, why: `no operation of the registry changes ${d.family ?? 'it'}: named, not corrected` }
    if (!p) return { ...base, settlement: roundLimited ? ('ROUND_LIMIT' as const) : ('NO_PROPOSAL' as const), why: roundLimited ? 'reported in the last look, when no further round could apply anything' : 'reported without a proposal the analyzer could apply' }
    if (!r) return { ...base, settlement: 'REFUSED' as const, why: 'its proposal has no record (not admitted)' }
    if (r.status === 'COMMITTED') {
      const ids = r.bound?.ids ?? []
      const verdicts = ids.map((x) => reviewedNext?.get(x)).filter((v): v is string => v !== undefined)
      if (!reviewedNext || verdicts.length === 0) return { ...base, settlement: roundLimited ? ('ROUND_LIMIT' as const) : ('APPLIED_NOT_REVIEWED' as const), why: 'applied, compiled and measured; no look at the new revision has judged it' }
      const agree = verdicts.every((v) => v === 'MATCHES' || v === 'ACCEPTABLE_APPROXIMATION')
      const measured = r.measure?.sourceVerified
      // A4: only a source measure that SUPPORTS the built element verifies; none at all is the reviewer's word alone
      if (agree && measured === true) return { ...base, settlement: 'CLOSED_VERIFIED' as const, ...(nextRevision ? { verifiedOn: nextRevision } : {}), why: `applied; the look at the new revision says ${verdicts.join(', ')}; the source measure supports the built element` }
      if (agree && (measured === null || measured === undefined)) return { ...base, settlement: 'CLOSED_REVIEW_ONLY' as const, ...(nextRevision ? { verifiedOn: nextRevision } : {}), why: `applied; the look at the new revision says ${verdicts.join(', ')}; no source measure confirms it (${r.measure?.why || 'not measured'}) — the reviewer's word, not a source verification` }
      return { ...base, settlement: 'APPLIED_REVIEW_DISAGREES' as const, why: `applied, but the look at the new revision says ${verdicts.join(', ')}${measured === false ? '; the source measure does not support the built element' : ''}` }
    }
    if (r.status === 'REJECTED_BY_SOURCE') return { ...base, settlement: 'REJECTED_BY_SOURCE' as const, why: r.why }
    if (r.status === 'NEEDS_EVIDENCE') return { ...base, settlement: 'NEEDS_EVIDENCE' as const, why: r.why }
    if (r.status === 'UNSUPPORTED_OPERATION') return { ...base, settlement: 'UNSUPPORTED_OPERATION' as const, why: r.why }
    return { ...base, settlement: 'REFUSED' as const, why: `${r.status}${r.code ? ` ${r.code}` : ''}: ${r.why}` }
  })
}

const norm = (t: string): string => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * A1: the defects as they stand after every look — one entry per identity (`key`), the latest statement about it.
 * Identity carries over by the later defect's `continues` (a ledger id or key of an earlier one) or by the same text,
 * side and operation; a SUPERSEDED resolution hands the key to the named defect of the later look. A defect a later
 * look does not mention stays as it was (`carriedFrom`). NO_LONGER_DIFFERENT closes it only on a revision other than
 * the one it was reported on (the model changed); NOT_IN_SOURCE, or NO_LONGER_DIFFERENT about the same revision,
 * is a DISPUTE between looks and stays open.
 * `lookRevision`: the revision each look judged. `lastLook`: the last look that succeeded.
 */
export function reconcileLedger(entries: readonly DefectEntry[], resolutions: readonly DefectResolution[], lookRevision: ReadonlyMap<number, string>, lastLook: number): DefectEntry[] {
  const byKey = new Map<string, DefectEntry>()
  const keyOf = new Map<string, string>() // any id or key ever seen → its key
  const sorted = [...entries].sort((a, b) => a.look - b.look)
  // the settlement of a look's defects is pushed after the next look; process each look's statements in look order
  const looks = [...new Set([...sorted.map((e) => e.look), ...resolutions.map((r) => r.look)])].sort((a, b) => a - b)
  for (const look of looks) {
    // supersessions first: they name which new defect inherits which old identity
    const inherit = new Map<string, string>()
    for (const r of resolutions.filter((x) => x.look === look && x.verdict === 'SUPERSEDED' && x.supersededBy)) {
      const k = keyOf.get(r.defectId)
      if (k) inherit.set(`L${look}:${r.supersededBy}`, k)
    }
    for (const e of sorted.filter((x) => x.look === look)) {
      const prior = inherit.get(e.id) ?? (e.continues ? keyOf.get(e.continues) ?? keyOf.get(`L${look - 1}:${e.continues}`) : undefined) ?? [...byKey.values()].find((o) => o.look < look && norm(o.about) === norm(e.about) && o.scope === e.scope && o.operation === e.operation)?.key
      const key = prior ?? e.key
      const merged: DefectEntry = { ...e, key }
      byKey.set(key, merged)
      keyOf.set(e.id, key)
      keyOf.set(key, key)
    }
    for (const r of resolutions.filter((x) => x.look === look && x.verdict !== 'SUPERSEDED')) {
      const k = keyOf.get(r.defectId)
      const cur = k ? byKey.get(k) : undefined
      if (!cur || cur.look >= look || cur.settlement === 'CLOSED_VERIFIED') continue
      const reportedOn = lookRevision.get(cur.carriedFrom ?? cur.look)
      const changed = reportedOn !== undefined && reportedOn !== r.revision
      if (r.verdict === 'NO_LONGER_DIFFERENT' && changed) byKey.set(cur.key, { ...cur, look, settlement: 'RESOLVED_BY_REVIEW', why: `look ${look} on revision ${r.revision} states it no longer differs (${r.note.slice(0, 160)}); reported on ${reportedOn} — the reviewer's word on a changed model, not a source verification` })
      else byKey.set(cur.key, { ...cur, look, settlement: 'DISPUTED', why: `look ${look} says ${r.verdict === 'NOT_IN_SOURCE' ? 'the source does not show it' : 'it no longer differs on the same revision'} (${r.note.slice(0, 160)}); look ${cur.carriedFrom ?? cur.look} reported it: two answers about the same picture, neither chosen` })
    }
  }
  // what the last look neither repeated nor resolved is carried: omission is not closure
  return [...byKey.values()].map((e) => (e.look < lastLook && OPEN.has(e.settlement) && e.settlement !== 'DISPUTED' ? { ...e, carriedFrom: e.carriedFrom ?? e.look, why: `${e.why}; not mentioned by look ${lastLook}: still open (omission is not closure)` } : e))
}

const OPEN: ReadonlySet<DefectSettlement> = new Set(['DISPUTED', 'APPLIED_REVIEW_DISAGREES', 'REJECTED_BY_SOURCE', 'NEEDS_EVIDENCE', 'UNSUPPORTED_OPERATION', 'NO_PROPOSAL', 'REFUSED', 'ROUND_LIMIT', 'APPLIED_NOT_REVIEWED'])

/**
 * The quality of the delivered revision. `defects` are the defects as they stand after every look (`reconcileLedger`):
 * an earlier defect no later look closed, resolved or superseded is still open — the last look's silence is not a
 * verdict. `allDefects` is the full ledger, kept for the record. `measuredContradictions` are known defects the analyzer
 * itself measured (an outline short of a printed dimension, a contradicted scale): an AI MATCHES never cancels them.
 */
export function qualityOf(input: { looked: boolean; checkedRevision: string | null; deliveredRevision: string | null; lastStatus: string | null; defects: readonly DefectEntry[]; allDefects?: readonly DefectEntry[]; resolutions?: readonly DefectResolution[]; lookRevision?: ReadonlyMap<number, string>; lastLook?: number; measuredContradictions: number; pendingAtLimit: number; attemptedForKey: number; committedForKey: number }): QualitySummary {
  const all = (input.allDefects ?? input.defects).map((d) => ({ ...d, key: d.key ?? d.id }))
  // A1: what stands is reconciled from the WHOLE ledger — never only from the last look's list
  const lastLook = input.lastLook ?? Math.max(0, ...input.defects.map((d) => d.look), ...all.map((d) => d.look))
  const current = input.allDefects ? reconcileLedger(all, input.resolutions ?? [], input.lookRevision ?? new Map(), lastLook) : all
  const reviewCompleted = input.looked && input.checkedRevision !== null && input.checkedRevision === input.deliveredRevision
  const open = current.filter((d) => OPEN.has(d.settlement))
  const openKey = open.filter((d) => d.severity === 'KEY')
  const reviewOnly = current.filter((d) => d.settlement === 'CLOSED_REVIEW_ONLY' || d.settlement === 'RESOLVED_BY_REVIEW')
  const reasons: QualityState[] = []
  if (!input.looked) reasons.push('NOT_REVIEWED')
  if (openKey.some((d) => d.settlement === 'UNSUPPORTED_OPERATION')) reasons.push('UNSUPPORTED_OPERATION')
  if (openKey.some((d) => d.settlement === 'NEEDS_EVIDENCE' || d.settlement === 'DISPUTED')) reasons.push('NEEDS_EVIDENCE')
  if (input.pendingAtLimit > 0 || open.some((d) => d.settlement === 'ROUND_LIMIT' || d.settlement === 'APPLIED_NOT_REVIEWED') || (input.looked && !reviewCompleted)) reasons.push('BUDGET_OR_ROUND_LIMIT')
  if (input.attemptedForKey > 0 && input.committedForKey === 0 && openKey.length > 0) reasons.push('NO_IMPROVEMENT')
  const verified = reviewCompleted && open.length === 0 && reviewOnly.length === 0 && input.measuredContradictions === 0 && input.lastStatus === 'VERIFIED_IN_SCOPE'
  if (verified) reasons.unshift('SOURCE_VERIFIED_IN_SCOPE')
  else if (input.looked && openKey.length === 0 && !reasons.includes('BUDGET_OR_ROUND_LIMIT')) reasons.unshift('RECOGNIZABLE_PARTIAL')
  else if (input.looked && openKey.length === 0) reasons.push('RECOGNIZABLE_PARTIAL')
  if (reasons.length === 0) reasons.push(openKey.length > 0 ? 'NEEDS_EVIDENCE' : 'RECOGNIZABLE_PARTIAL')
  const state = reasons[0]
  const closed = current.filter((d) => d.settlement === 'CLOSED_VERIFIED').length
  const notReviewed = all.filter((d) => d.settlement === 'APPLIED_NOT_REVIEWED').length
  const carried = open.filter((d) => d.carriedFrom !== undefined).length
  const why = !input.looked ? 'no look at the model succeeded' : `${reviewCompleted ? 'the delivered revision was looked at' : 'the delivered revision was NOT the one looked at last'}; ${open.length} difference(s) open (${openKey.length} KEY${carried > 0 ? `, ${carried} carried from earlier looks` : ''})${open.length > 0 ? `: ${open.slice(0, 4).map((d) => `${d.id} ${d.settlement}`).join(', ')}` : ''}; ${closed} closed on a verified revision${reviewOnly.length > 0 ? `; ${reviewOnly.length} closed on the reviewer's word only` : ''}${input.measuredContradictions > 0 ? `; ${input.measuredContradictions} measured contradiction(s) the review does not cancel` : ''}`
  return { version: QUALITY_VERSION, reviewCompleted, state, reasons: [...new Set(reasons)], openKey: openKey.length, openOther: open.length - openKey.length, closedVerified: closed, closedReviewOnly: reviewOnly.length, appliedNotReviewed: notReviewed, defects: current, ledger: all, why }
}
