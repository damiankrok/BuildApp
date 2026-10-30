/**
 * N9-01: the service's model assessment as the Analyze panel shows it — three axes, each on its own line, never folded
 * into one verdict (`packages/analysis-service/src/assessment/types.ts` is the service's own statement of them).
 *
 * The panel derives nothing: it says what the service said. UNCHECKED is said as unchecked, never as a pass; a
 * conflict is named with its reason; and whatever the axes say, the model stays openable.
 */

export type RelationStatus = 'PASS' | 'CONFLICT' | 'UNCHECKED'

/** The members of `assessment` the panel reads; the service sends more, and an older one sends none. */
export type AssessmentView = {
  technicalValidity: { status: 'VALID' | 'ERRORS'; errors: number; warnings: number; checks: Array<{ check: string; errors: number; warnings: number }> }
  decompositionCompleteness: { verdict: string; meaning: string }
  sourceFidelity: { status: RelationStatus; relations: Array<{ id: string; title: string; status: RelationStatus; counts: Record<RelationStatus, number> }>; conflicts: string[] }
  sourceUnchecked: { counts: { total: number; none: number; partial: number }; items: Array<{ kind: string; what: string; why: string; registration?: { class: string; side: string; along: string; vertical: string; scale: string } }> }
  previewAvailable: boolean
  /** N9-02A: every elevation on four axes; absent from a service older than 1.4.0. */
  elevationRegistration?: { counts: { before: Record<string, number>; after: Record<string, number> }; views: Array<{ frameId: string; class: string; side: { state: string; value: string }; along: { state: string }; vertical: { state: string }; scale: { state: string } }> }
}

export type AssessmentLine = { axis: 'TECHNICAL' | 'COMPLETENESS' | 'FIDELITY' | 'UNCHECKED' | 'ELEVATIONS'; state: 'OK' | 'WARN' | 'OPEN'; label: string; value: string; detail: string[] }

const COMPLETENESS: Record<string, string> = {
  COMPLETE: 'complete',
  COMPLETE_WITH_OPEN_QUESTIONS: 'complete, with open questions',
  PARTIAL: 'partial',
  NOT_ASSESSED: 'not assessed',
}

export function assessmentLines(a: AssessmentView): AssessmentLine[] {
  const t = a.technicalValidity
  const f = a.sourceFidelity
  const u = a.sourceUnchecked.counts
  return [
    {
      axis: 'TECHNICAL',
      state: t.status === 'VALID' ? 'OK' : 'WARN',
      label: 'technical validity',
      value: t.status === 'VALID' ? 'valid — not evidence of agreement with the drawings' : `${t.errors} technical error${t.errors === 1 ? '' : 's'}`,
      detail: t.checks.filter((c) => c.errors > 0).map((c) => `${c.check}: ${c.errors} error${c.errors === 1 ? '' : 's'}`),
    },
    {
      axis: 'COMPLETENESS',
      state: a.decompositionCompleteness.verdict === 'COMPLETE' ? 'OK' : 'OPEN',
      label: 'reading completeness (decomposition)',
      value: COMPLETENESS[a.decompositionCompleteness.verdict] ?? a.decompositionCompleteness.verdict.toLowerCase(),
      detail: [a.decompositionCompleteness.meaning],
    },
    {
      axis: 'FIDELITY',
      state: f.status === 'PASS' ? 'OK' : f.status === 'CONFLICT' ? 'WARN' : 'OPEN',
      label: 'fidelity to the drawings',
      value: f.status === 'CONFLICT' ? `${f.conflicts.length} conflict${f.conflicts.length === 1 ? '' : 's'} with the drawings` : f.status === 'PASS' ? 'every relation agrees' : 'not checked in full — no conflict found is not agreement',
      detail: [...f.relations.map((r) => `${r.id} ${r.status.toLowerCase()} (pass ${r.counts.PASS} · conflict ${r.counts.CONFLICT} · unchecked ${r.counts.UNCHECKED})`), ...f.conflicts],
    },
    {
      axis: 'UNCHECKED',
      state: u.total === 0 ? 'OK' : 'OPEN',
      label: 'not compared with the model',
      value: `${u.total} source item${u.total === 1 ? '' : 's'} (none ${u.none} · partly ${u.partial})`,
      detail: a.sourceUnchecked.items.filter((i) => i.kind !== 'PERSPECTIVE').map((i) => `${i.kind.toLowerCase()} · ${i.what}${i.registration ? ` [${i.registration.class.toLowerCase().replace('_', ' ')}: side ${i.registration.side.toLowerCase()}, along ${i.registration.along.toLowerCase()}, vertical ${i.registration.vertical.toLowerCase()}]` : ''}: ${i.why}`),
    },
    ...(a.elevationRegistration ? [elevationLine(a.elevationRegistration)] : []),
  ]
}

/** N9-02A: how many elevations are registered on which axes — each view's side, along and vertical axis said apart. */
function elevationLine(e: NonNullable<AssessmentView['elevationRegistration']>): AssessmentLine {
  const c = e.counts.after
  const views = e.views.filter((v) => v.class !== undefined)
  return {
    axis: 'ELEVATIONS',
    state: (c.UNREGISTERED ?? 0) === 0 && (c.ALONG_ONLY ?? 0) === 0 && (c.VERTICAL_ONLY ?? 0) === 0 ? 'OK' : 'OPEN',
    label: 'elevations registered',
    value: `${c.FULL ?? 0} full · ${c.ALONG_ONLY ?? 0} along only · ${c.VERTICAL_ONLY ?? 0} vertical only · ${c.UNREGISTERED ?? 0} unregistered`,
    detail: views.map((v) => `${v.frameId}: ${v.class.toLowerCase().replace('_', ' ')} — side ${v.side.state.toLowerCase()} ${v.side.value.toLowerCase()}, along ${v.along.state.toLowerCase()}, vertical ${v.vertical.state.toLowerCase()}, scale ${v.scale.state.toLowerCase()}`),
  }
}
