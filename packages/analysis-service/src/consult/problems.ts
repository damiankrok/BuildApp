/**
 * v3.54.2 pilot — which printed labels the analyzer asks about, chosen from its OWN evidence only (never from a
 * reference or an expected value): the labels of the plan frame it reads whose reading it could not settle.
 *
 * One printed number is one INK; the lattice reader may hold several readings of it (one per way up). An ink is asked
 * about when no reading of it is CLEAR, or when the frame's metric solution names one of its readings as conflicting or
 * as a witness of a scale it weighed. Inks bound to the longest spans come first (an overall dimension settles more
 * than a part), then inks with no binding at all (a label the chains never took), at most `MAX_LABELS`.
 */
import type { MetricEvidenceSet } from '@buildapp/source-metrics'
import type { Region } from './contract.js'

export const MAX_LABELS = 10

export type LabelLattice = { latticeId: string; orientation: string; asRead: string; ocrClass: string; decision?: string; externalText?: string }
export type LabelItem = {
  labelId: string
  frameId: string
  box: Region
  lattices: LabelLattice[]
  /** The longest span a reading of this ink is bound to, and its axis (X along the sheet, Y down it). */
  binding?: { observationId: string; chainId: string; axis: 'X' | 'Y'; spanPx: number; role: string }
  why: string
}
export type LabelProblem = {
  problemId: string
  kind: 'SCALE_UNSETTLED'
  frameId: string
  assetId: string
  labels: LabelItem[]
  /** The analyzer's own words on why the scale is not settled (its metric solution), for the second step only. */
  analyzerWhy: string
}

const overlap = (a: Region, b: Region): number => {
  const ix = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0))
  const iy = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0))
  const small = Math.min((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0))
  return small > 0 ? (ix * iy) / small : 0
}

/** The label problem of one plan frame, or none when its scale is settled (STRONG or SUPPORTED) and every primary ink is CLEAR. */
export function labelProblemOf(metrics: MetricEvidenceSet, frameId: string, assetId: string): LabelProblem | undefined {
  const solution = (metrics.metricSolutions ?? []).find((s) => s.frameId === frameId)
  // a label already given a consulted reading is not asked about again (v3.54.2 stage B: round 2 re-asked 327 and 104)
  // (an ink is one printed number however many ways up it was read: every lattice overlapping a consulted one is out too)
  const consultedBoxes = (metrics.numericLattices ?? []).filter((l) => l.frameId === frameId && l.ensemble?.decision === 'CONSULTED').map((l) => l.box)
  const lattices = (metrics.numericLattices ?? []).filter((l) => l.frameId === frameId && l.ensemble?.decision !== 'CONSULTED' && !consultedBoxes.some((b) => overlap(b, l.box) >= 0.5))
  const settled = solution && (solution.confidence === 'STRONG' || solution.confidence === 'SUPPORTED')
  // an unsettled plan with no label to ask about is still a problem: its printed dimensions may be read whole (READ_DIMENSION)
  if (lattices.length === 0) return settled ? undefined : { problemId: `scale:${frameId}`, kind: 'SCALE_UNSETTLED', frameId, assetId, labels: [], analyzerWhy: solution?.why ?? 'no metric solution was written for this frame' }
  const named = new Set<string>([...(solution?.conflictingObservationIds ?? []), ...(solution?.supportingObservationIds ?? []), ...(solution?.hypotheses ?? []).flatMap((h) => h.witnessIds)])
  const observations = (metrics.dimensionObservations ?? []).filter((o) => o.frameId === frameId)
  // one ink = lattices whose boxes overlap by half of the smaller
  // matched against the ink's FIRST box only: a union that grows would swallow its neighbours one by one
  const inks: Array<{ seed: Region; box: Region; members: typeof lattices }> = []
  for (const l of [...lattices].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const ink = inks.find((k) => overlap(k.seed, l.box) >= 0.5)
    if (ink) {
      ink.members.push(l)
      ink.box = { x0: Math.min(ink.box.x0, l.box.x0), y0: Math.min(ink.box.y0, l.box.y0), x1: Math.max(ink.box.x1, l.box.x1), y1: Math.max(ink.box.y1, l.box.y1) }
    } else inks.push({ seed: { ...l.box }, box: { ...l.box }, members: [l] })
  }
  const items: Array<LabelItem & { rank: number }> = []
  for (const ink of inks) {
    const ids = new Set(ink.members.map((m) => m.id))
    const obs = observations.filter((o) => o.ocr && ids.has(o.ocr.latticeId as string))
    const readClass = (m: (typeof lattices)[number]): string => m.ensemble?.ocrClass ?? m.ocrClass
    const clear = ink.members.some((m) => readClass(m) === 'CLEAR')
    const isNamed = obs.some((o) => named.has(o.id))
    if (settled && clear) continue
    if (clear && !isNamed) continue
    const primary = obs.filter((o) => o.binding?.role === 'PRIMARY').sort((a, b) => b.spanPx - a.spanPx)[0] ?? [...obs].sort((a, b) => b.spanPx - a.spanPx)[0]
    items.push({
      labelId: '',
      frameId,
      box: ink.box,
      lattices: ink.members.map((m) => ({ latticeId: m.id, orientation: m.orientation, asRead: m.ensemble?.asRead ?? m.asRead, ocrClass: readClass(m), ...(m.ensemble ? { decision: m.ensemble.decision, externalText: m.ensemble.external.text } : {}) })),
      ...(primary ? { binding: { observationId: primary.id, chainId: primary.chainId, axis: primary.axis as 'X' | 'Y', spanPx: primary.spanPx, role: primary.binding?.role ?? 'UNKNOWN' } } : {}),
      why: [clear ? '' : 'no reading of this ink is CLEAR', isNamed ? "the frame's metric solution weighed or named a reading of it" : '', primary ? '' : 'no dimension line took it'].filter(Boolean).join('; '),
      rank: (isNamed ? 1e6 : 0) + (primary ? primary.spanPx : -1),
    })
  }
  if (items.length === 0) return settled ? undefined : { problemId: `scale:${frameId}`, kind: 'SCALE_UNSETTLED', frameId, assetId, labels: [], analyzerWhy: solution?.why ?? '' }
  const chosen = items.sort((a, b) => b.rank - a.rank || a.box.y0 - b.box.y0 || a.box.x0 - b.box.x0).slice(0, MAX_LABELS)
  chosen.forEach((it, i) => (it.labelId = `L${i + 1}`))
  return {
    problemId: `scale:${frameId}`,
    kind: 'SCALE_UNSETTLED',
    frameId,
    assetId,
    labels: chosen.map(({ rank: _rank, ...it }) => it),
    analyzerWhy: solution?.why ?? 'no metric solution was written for this frame',
  }
}
