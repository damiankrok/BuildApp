/**
 * HYPOTHESIS → FUSION: what each group of proposals adds up to.
 *
 * Every family is scored against every group by its capability's evidence
 * requirements (registry/capabilities.ts): a required requirement unmet means
 * the family is not concluded; an exclusion present rules it out (a continuous
 * cover rules out a pergola); a plausibility check on the geometry can reject
 * it (a cover too small for a car is not a carport). The score weighs each
 * requirement by the confidence of what matched it and the authority of the
 * source it came from.
 *
 * The decision:
 *  - ACCEPTED: the most specific family that is satisfied, when no rival of
 *    the same specificity comes within AMBIGUITY_MARGIN of it, and the
 *    evidence is not one visual reading alone.
 *  - UNKNOWN: nothing (or more than one thing) is concluded, but the feature
 *    is real — at least two proposals, from two frames or from a technical
 *    drawing. It becomes an UnknownArchitecturalAssembly with the families it
 *    might be as alternatives. It is never forced into a known family.
 *  - REJECTED: too little to state anything; nothing is emitted, and the
 *    hypothesis is kept in the result with why.
 */
import type { AssemblyKind } from '@buildapp/model'
import { authorityRank, type SourceAuthority } from '../authority.js'
import { capability, type CapabilityKey, type EvidenceRequirement } from '../registry/capabilities.js'
import type { SemanticProposal } from '../proposals.js'
import { polygonArea } from './geometry.js'
import type { Family, FamilyScore, FeatureGroup, Hypothesis, RequirementCheck } from './types.js'

export const AMBIGUITY_MARGIN = 0.1

const CAPABILITY_OF: Record<Family, CapabilityKey> = {
  DORMER: 'ROOF_DORMER',
  PERGOLA: 'PERGOLA',
  CANOPY: 'CANOPY',
  CARPORT: 'CARPORT',
  EXTERIOR_STEPS: 'EXTERIOR_STEPS',
  // a roof's composition (gable, hip, intersecting …) is read from its topology, not competed for
  ROOF: 'ROOF_GABLE',
}

/** More specific families win over less specific ones without an ambiguity: a dormer's own roof plane does not make it a roof. */
const SPECIFICITY: Record<Family, number> = { DORMER: 3, PERGOLA: 2, CANOPY: 2, CARPORT: 2, EXTERIOR_STEPS: 2, ROOF: 1 }

export const ASSEMBLY_OF: Record<Family, AssemblyKind> = { DORMER: 'DORMER', PERGOLA: 'PERGOLA', CANOPY: 'CANOPY', CARPORT: 'CARPORT', EXTERIOR_STEPS: 'EXTERIOR_STAIR', ROOF: 'ROOF' }

const AUTHORITY_FACTOR: Record<SourceAuthority, number> = { PRINTED_DIMENSION: 1, TECHNICAL_GEOMETRY: 1, CROSS_VIEW: 0.9, PERSPECTIVE: 0.7, VISUAL_INFERENCE: 0.5, CONVENTION: 0.3 }

/** A parking bay is 2.5 × 5 m: a cover smaller than that is not a carport. */
const CARPORT_MIN_COVER_M2 = 12

function check(req: EvidenceRequirement, ps: readonly SemanticProposal[]): RequirementCheck {
  const matched = ps.filter((p) => req.kinds.includes(p.kind) && (!req.quantities || p.geometry.type !== 'VALUE' || req.quantities.some((q) => p.geometry.type === 'VALUE' && p.geometry.quantity.startsWith(q))))
  const frames = new Set(matched.map((p) => p.sourceFrameId)).size
  const met = matched.length >= req.minCount && (!req.crossView || frames >= 2)
  return { id: req.id, description: req.description, required: req.required, met, matched: matched.map((p) => p.id), frames, need: req.minCount, crossView: req.crossView === true }
}

function plausibility(family: Family, ps: readonly SemanticProposal[]): string | undefined {
  if (family === 'CARPORT') {
    const covers = ps.filter((p) => p.kind === 'COVER_SURFACE' && p.geometry.type === 'POLYGON')
    const area = Math.max(0, ...covers.map((p) => (p.geometry.type === 'POLYGON' ? polygonArea(p.geometry.points.map((q) => ({ x: q.x, z: q.z }))) : 0)))
    if (area < CARPORT_MIN_COVER_M2) return `the cover spans ${area.toFixed(1)} m², less than a parking bay (${CARPORT_MIN_COVER_M2} m²)`
  }
  if (family === 'EXTERIOR_STEPS') {
    // one nosing per physical edge (frames see the same edges); distinct edges must stand at distinct heights
    const edges: Array<{ x: number; z: number; y: number }> = []
    for (const p of ps) {
      if (p.kind !== 'STEP_EDGE' || p.geometry.type !== 'SEGMENT') continue
      const g = p.geometry
      const q = { x: (g.start.x + g.end.x) / 2, z: (g.start.z + g.end.z) / 2, y: (g.start.y + g.end.y) / 2 }
      if (!edges.some((e) => Math.hypot(e.x - q.x, e.z - q.z) <= 0.1)) edges.push(q)
    }
    if (new Set(edges.map((e) => e.y.toFixed(3))).size !== edges.length) return 'two nosings stand at one height: they are not one flight'
  }
  return undefined
}

export function scoreFamily(family: Family, ps: readonly SemanticProposal[]): FamilyScore {
  const cap = capability(CAPABILITY_OF[family])
  const requirements = cap.evidenceRequirements.map((r) => check(r, ps))
  const byId = new Map(ps.map((p) => [p.id, p]))
  let num = 0
  let den = 0
  cap.evidenceRequirements.forEach((r, i) => {
    den += r.weight
    const c = requirements[i]
    if (!c.met) return
    const ms = c.matched.map((id) => byId.get(id) as SemanticProposal)
    num += (r.weight * ms.reduce((a, p) => a + p.confidence * AUTHORITY_FACTOR[p.authority], 0)) / ms.length
  })
  const excludedBy = ps.filter((p) => cap.exclusions.includes(p.kind)).map((p) => p.id)
  const implausible = plausibility(family, ps)
  return {
    family,
    capability: cap.key,
    satisfied: requirements.every((c) => c.met || !c.required),
    excludedBy,
    ...(implausible ? { implausible } : {}),
    score: den > 0 ? Math.round((num / den) * 1e4) / 1e4 : 0,
    requirements,
  }
}

const viable = (s: FamilyScore): boolean => s.satisfied && s.excludedBy.length === 0 && !s.implausible

function whyNot(s: FamilyScore): string {
  const parts: string[] = []
  const unmet = s.requirements.filter((c) => c.required && !c.met)
  if (unmet.length > 0) parts.push(`missing ${unmet.map((c) => (c.crossView && c.matched.length >= c.need ? `${c.description} (seen in ${c.frames} frame${c.frames === 1 ? '' : 's'}, needs two)` : c.description)).join('; ')}`)
  if (s.excludedBy.length > 0) parts.push(`ruled out by ${s.excludedBy.join(', ')}`)
  if (s.implausible) parts.push(s.implausible)
  return parts.join('; ') || 'a rival reading scored as high'
}

export function decide(group: FeatureGroup, ps: readonly SemanticProposal[], index: number): Hypothesis {
  const id = `h${index + 1}`
  const scores = (Object.keys(CAPABILITY_OF) as Family[]).map((f) => scoreFamily(f, ps)).sort((a, b) => b.score - a.score || (a.family < b.family ? -1 : 1))
  const reasons: string[] = []
  const alternativesFrom = (list: readonly FamilyScore[]): Hypothesis['alternatives'] =>
    list
      .filter((s) => s.requirements.some((c) => c.met && c.matched.length > 0))
      .map((s) => ({ kind: ASSEMBLY_OF[s.family], confidence: Math.min(0.95, Math.round(s.score * 100) / 100), why: whyNot(s) }))
  const visualOnly = group.frames.length < 2 && ps.every((p) => authorityRank(p.authority) >= authorityRank('VISUAL_INFERENCE'))
  const technical = ps.some((p) => authorityRank(p.authority) <= authorityRank('TECHNICAL_GEOMETRY'))
  const spatial = ps.filter((p) => p.geometry.type !== 'VALUE')
  const realFeature = spatial.length >= 2 && (group.frames.length >= 2 || technical)

  const ok = scores.filter(viable)
  const top = ok.length > 0 ? Math.max(...ok.map((s) => SPECIFICITY[s.family])) : 0
  const contenders = ok.filter((s) => SPECIFICITY[s.family] === top)
  const best = contenders[0]
  const rival = contenders[1]
  if (best && visualOnly) reasons.push(`${best.family.toLowerCase()} fits, but the evidence is one visual reading from one frame: a hint, not an object`)
  else if (best && rival && best.score - rival.score < AMBIGUITY_MARGIN) reasons.push(`${best.family.toLowerCase()} (${best.score}) and ${rival.family.toLowerCase()} (${rival.score}) fit the evidence equally well`)
  else if (best) {
    const missing = best.requirements.filter((c) => !c.required && !c.met).map((c) => c.description)
    reasons.push(`${best.family.toLowerCase()}: every required requirement met (${best.requirements.filter((c) => c.met).map((c) => c.id).join(', ')})`)
    // the rivals the evidence partly supports, and why they were not concluded
    for (const s of scores) if (s !== best && s.requirements.some((c) => c.met && c.matched.length > 0) && (s.excludedBy.length > 0 || s.implausible || !s.satisfied)) reasons.push(`not ${s.family.toLowerCase()}: ${whyNot(s)}`)
    return { id, groupId: group.id, decision: 'ACCEPTED', family: best.family, capability: best.capability, confidence: best.score, reasons, scores, alternatives: [], missing }
  } else reasons.push('no family has every required requirement met')

  const alternatives = alternativesFrom(best && rival ? contenders : scores).sort((a, b) => b.confidence - a.confidence || (a.kind < b.kind ? -1 : 1))
  if (realFeature) {
    reasons.push(`kept as an unknown assembly: ${spatial.length} observations${group.frames.length >= 2 ? ` from ${group.frames.length} frames` : ' from a technical drawing'}`)
    return { id, groupId: group.id, decision: 'UNKNOWN', capability: 'UNKNOWN_ASSEMBLY', confidence: Math.round(Math.min(0.5, ...ps.map((p) => p.confidence)) * 100) / 100, reasons, scores, alternatives, missing: [] }
  }
  reasons.push(spatial.length < 2 ? 'a single observation states nothing: no object is emitted' : 'seen in one frame only, and not a technical drawing: no object is emitted')
  return { id, groupId: group.id, decision: 'REJECTED', confidence: 0, reasons, scores, alternatives, missing: [] }
}
