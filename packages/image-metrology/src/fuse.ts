/**
 * §13 and §24. One quantity, several drawings, and what to believe.
 *
 * A semantic opening is observed more than once: the plan draws its gap, one
 * elevation shows its reveals, another elevation shows the same wall from the
 * other side, a callout prints its size, and a render shows it foreshortened.
 * Each of those is a measurement of the same metre, and they will not agree.
 *
 * Two things decide the answer, and they are different questions.
 *
 * AUTHORITY is about the kind of source. A printed dimension is the publisher
 * stating the number; a measurement off a registered technical drawing is this
 * pipeline reading it; a convention is nobody measuring anything. §24 puts
 * them in an order, and that order is not negotiable by a source being very
 * sure of itself — a confident reading of a render does not outrank a printed
 * 470.
 *
 * PRECISION is about the individual measurement. Two readings of the same
 * authority are combined by inverse variance, which is the ordinary thing to
 * do and the reason every measurement in this package carries a computed
 * uncertainty rather than a vibe.
 *
 * The loss is ROBUST because the failure that matters is not noise. A
 * measurement that has found the wrong feature is not a little wrong; it is
 * a different number about a different thing, and a least-squares fit given
 * one of those will move the answer most of the way towards it. Huber's loss
 * lets a disagreeing source bend the answer and not break it, and — more
 * usefully — the per-source residuals afterwards say which one disagreed.
 *
 * What this deliberately does NOT do is hide the disagreement. Sources that
 * agree within their own error bars produce a fused value tighter than any of
 * them; sources that do not produce the same value with the disagreement
 * stated and the status saying so. A number nobody can argue with is a number
 * nobody can check.
 */
import { round6 } from '@buildapp/source-common'
import { median, robustSigma } from './linalg.js'

/**
 * §24's order, as weights.
 *
 * The gaps between them are large on purpose: these are ranks and not
 * opinions, so a printed dimension has to outweigh any plausible pile of
 * inferred ones rather than merely outvote one of them.
 */
export const EVIDENCE_AUTHORITY = {
  PRINTED_DIMENSION: 1000,
  REGISTERED_TECHNICAL_DRAWING: 100,
  CORROBORATED_PLAN_GAP: 40,
  REGISTERED_PERSPECTIVE_PLANE: 10,
  VLM_ESTIMATE: 2,
  CONVENTION: 1,
} as const

export type EvidenceAuthority = keyof typeof EVIDENCE_AUTHORITY

export type QuantityObservation = {
  id: string
  /** Which drawing or statement this came from, for the per-view residual. */
  sourceId: string
  authority: EvidenceAuthority
  valueM: number
  /** How sure this one is, on its own. Zero is not allowed: nothing is exact. */
  uncertaintyM: number
  why: string
}

export type FusedQuantity = {
  valueM: number
  uncertaintyM: number
  /** How far each observation sits from the fused value, and whether the fit kept it. */
  residuals: Array<{ id: string; sourceId: string; authority: EvidenceAuthority; residualM: number; inlier: boolean; weight: number }>
  /** AGREED when every source is within its own error bar of the answer. */
  status: 'AGREED' | 'DISPUTED' | 'SINGLE_SOURCE'
  /** The authority that decided it, which is the highest one that stayed an inlier. */
  decidedBy: EvidenceAuthority
  why: string
}

export type FuseOptions = {
  /** Rounds of reweighting. */
  rounds?: number
  /** Huber's knee, in robust sigmas. */
  huberK?: number
  /** A source further than this many of its own sigmas from the answer is disputing it. */
  disputeSigmas?: number
  /** The floor under any stated uncertainty, in metres. Nothing is exact. */
  minSigmaM?: number
}

const DEFAULTS: Required<FuseOptions> = { rounds: 4, huberK: 1.345, disputeSigmas: 3, minSigmaM: 0.005 }

/**
 * Fuse several measurements of one quantity.
 *
 * `null` only when there is nothing to fuse. One observation comes back as
 * itself, marked SINGLE_SOURCE — which is honest and is the thing a caller
 * most needs to know, because a lone reading is exactly what this package has
 * spent the rest of its effort learning not to trust.
 */
export function fuseQuantity(observations: readonly QuantityObservation[], options: FuseOptions = {}): FusedQuantity | null {
  const opt = { ...DEFAULTS, ...options }
  const ordered = [...observations].sort((a, b) => a.id.localeCompare(b.id))
  if (ordered.length === 0) return null
  const sigmaOf = (o: QuantityObservation): number => Math.max(opt.minSigmaM, o.uncertaintyM)

  if (ordered.length === 1) {
    const only = ordered[0]
    return {
      valueM: round6(only.valueM),
      uncertaintyM: round6(sigmaOf(only)),
      residuals: [{ id: only.id, sourceId: only.sourceId, authority: only.authority, residualM: 0, inlier: true, weight: 1 }],
      status: 'SINGLE_SOURCE',
      decidedBy: only.authority,
      why: `one source only: ${only.why}. Nothing corroborates it and nothing contradicts it.`,
    }
  }

  // Authority first, precision second: w = rank / sigma².
  const base = ordered.map((o) => EVIDENCE_AUTHORITY[o.authority] / sigmaOf(o) ** 2)
  let weights = [...base]
  let value = 0
  for (let round = 0; round < opt.rounds; round += 1) {
    const total = weights.reduce((a, w) => a + w, 0)
    value = total > 0 ? ordered.reduce((a, o, i) => a + weights[i] * o.valueM, 0) / total : median(ordered.map((o) => o.valueM))
    const residuals = ordered.map((o) => o.valueM - value)
    const spread = Math.max(1e-9, robustSigma(residuals))
    weights = base.map((w, i) => {
      const scaled = Math.abs(residuals[i]) / spread
      return w * (scaled <= opt.huberK ? 1 : opt.huberK / scaled)
    })
  }

  const total = weights.reduce((a, w) => a + w, 0)
  // The combined uncertainty, from the weights that produced the answer. Two
  // sources that agree are worth more than either; that is the whole point of
  // asking twice, and it is only true when they DO agree.
  const combined = total > 0 ? Math.sqrt(1 / ordered.reduce((a, o, i) => a + (weights[i] / base[i] || 0) / sigmaOf(o) ** 2, 0)) : Number.NaN
  const residuals = ordered.map((o, i) => {
    const residualM = o.valueM - value
    const inlier = Math.abs(residualM) <= opt.disputeSigmas * sigmaOf(o)
    return { id: o.id, sourceId: o.sourceId, authority: o.authority, residualM: round6(residualM), inlier, weight: round6(total > 0 ? weights[i] / total : 0) }
  })
  const disputed = residuals.filter((r) => !r.inlier)
  const inliers = residuals.filter((r) => r.inlier)
  const ranked = (a: EvidenceAuthority, b: EvidenceAuthority): number => EVIDENCE_AUTHORITY[b] - EVIDENCE_AUTHORITY[a]
  const decidedBy = (inliers.length > 0 ? inliers : residuals).map((r) => r.authority).sort(ranked)[0]
  const worst = disputed.sort((a, b) => Math.abs(b.residualM) - Math.abs(a.residualM))[0]
  const uncertaintyM = Number.isFinite(combined) ? Math.max(opt.minSigmaM, combined) : Math.max(...ordered.map(sigmaOf))

  return {
    valueM: round6(value),
    // A disputed quantity is not more certain for having been measured twice.
    // The spread between the sources is the honest bar when they disagree.
    uncertaintyM: round6(disputed.length === 0 ? uncertaintyM : Math.max(uncertaintyM, ...disputed.map((r) => Math.abs(r.residualM)))),
    residuals,
    status: disputed.length === 0 ? 'AGREED' : 'DISPUTED',
    decidedBy,
    why:
      disputed.length === 0
        ? `${ordered.length} sources agree on ${value.toFixed(3)} m within their own error bars, the strongest of them a ${decidedBy.toLowerCase().replace(/_/g, ' ')}`
        : `${ordered.length} sources, of which ${disputed.length} disagree: ${worst.sourceId} is ${Math.abs(worst.residualM).toFixed(3)} m out, ` +
          `which is ${(Math.abs(worst.residualM) / Math.max(opt.minSigmaM, ordered.find((o) => o.id === worst.id)?.uncertaintyM ?? opt.minSigmaM)).toFixed(1)}× its own stated uncertainty. ` +
          `The answer is ${value.toFixed(3)} m on the ${decidedBy.toLowerCase().replace(/_/g, ' ')}, and carries the disagreement as its error bar.`,
  }
}
