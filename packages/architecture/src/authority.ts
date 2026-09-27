/**
 * SOURCE AUTHORITY: which evidence decides a metric value.
 *
 *   printed technical dimensions
 *   > plan / section / elevation geometry
 *   > cross-view corroboration
 *   > perspective / render evidence
 *   > visual inference
 *   > architectural convention
 *
 * A quantity is resolved by the highest authority that states it. Lower
 * candidates are never averaged in: one that agrees is corroboration, one
 * that disagrees is a recorded CONFLICT, kept with both values and why the
 * lower one lost. A perspective render therefore never overrides a printed
 * dimension, however many renders agree with each other.
 */
import type { EvidenceStatus } from '@buildapp/model'

export const SOURCE_AUTHORITIES = ['PRINTED_DIMENSION', 'TECHNICAL_GEOMETRY', 'CROSS_VIEW', 'PERSPECTIVE', 'VISUAL_INFERENCE', 'CONVENTION'] as const
export type SourceAuthority = (typeof SOURCE_AUTHORITIES)[number]

/** Rank: 0 is the highest authority. */
export const authorityRank = (a: SourceAuthority): number => SOURCE_AUTHORITIES.indexOf(a)

/** The model evidence status a value resolved at this authority carries. */
export function evidenceStatusOf(a: SourceAuthority, corroborated = false): EvidenceStatus {
  switch (a) {
    case 'PRINTED_DIMENSION':
      return 'SOURCE_EXACT'
    case 'TECHNICAL_GEOMETRY':
      return corroborated ? 'SOURCE_CORROBORATED' : 'SOURCE_DERIVED'
    case 'CROSS_VIEW':
      return 'GEOMETRIC_INFERRED'
    case 'PERSPECTIVE':
    case 'VISUAL_INFERENCE':
      return 'VISUAL_INFERRED'
    case 'CONVENTION':
      return 'ASSUMED'
  }
}

export type QuantityCandidate = {
  value: number
  authority: SourceAuthority
  /** The proposal or evidence the value comes from. */
  sourceId: string
  /** How far off the value may honestly be (m, °). Defaults by authority. */
  tolerance?: number
}

export type QuantityConflict = { kept: { value: number; authority: SourceAuthority; sourceId: string }; lost: { value: number; authority: SourceAuthority; sourceId: string }; difference: number; why: string }

export type ResolvedQuantity = {
  key: string
  value: number
  authority: SourceAuthority
  sourceId: string
  status: EvidenceStatus
  /** Candidates that agreed with the kept value within tolerance. */
  corroboratedBy: string[]
  conflicts: QuantityConflict[]
}

const DEFAULT_TOLERANCE: Record<SourceAuthority, number> = {
  PRINTED_DIMENSION: 0.005,
  TECHNICAL_GEOMETRY: 0.05,
  CROSS_VIEW: 0.1,
  PERSPECTIVE: 0.25,
  VISUAL_INFERENCE: 0.4,
  CONVENTION: 1,
}

/**
 * Resolve one quantity from its candidates. The winner is the highest
 * authority; ties go to the tighter tolerance, then to the smaller source id
 * (deterministic). Returns null when there is no candidate: an unknown
 * quantity stays unknown.
 */
export function resolveQuantity(key: string, candidates: readonly QuantityCandidate[]): ResolvedQuantity | null {
  if (candidates.length === 0) return null
  const tol = (c: QuantityCandidate): number => c.tolerance ?? DEFAULT_TOLERANCE[c.authority]
  const sorted = [...candidates].sort((a, b) => authorityRank(a.authority) - authorityRank(b.authority) || tol(a) - tol(b) || (a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0))
  const kept = sorted[0]
  const corroboratedBy: string[] = []
  const conflicts: QuantityConflict[] = []
  for (const c of sorted.slice(1)) {
    const d = Math.abs(c.value - kept.value)
    if (d <= Math.max(tol(kept), tol(c))) corroboratedBy.push(c.sourceId)
    else
      conflicts.push({
        kept: { value: kept.value, authority: kept.authority, sourceId: kept.sourceId },
        lost: { value: c.value, authority: c.authority, sourceId: c.sourceId },
        difference: d,
        why: authorityRank(c.authority) > authorityRank(kept.authority) ? `${c.authority.toLowerCase()} does not override ${kept.authority.toLowerCase()}` : `two ${kept.authority.toLowerCase()} values disagree; the tighter one is kept and the other recorded`,
      })
  }
  const corroborated = corroboratedBy.some((id) => {
    const c = candidates.find((x) => x.sourceId === id)
    return c !== undefined && c.sourceId !== kept.sourceId
  })
  return { key, value: kept.value, authority: kept.authority, sourceId: kept.sourceId, status: evidenceStatusOf(kept.authority, corroborated), corroboratedBy, conflicts }
}
