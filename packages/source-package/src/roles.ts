/**
 * Role classification.
 *
 * Roles are assigned by an adapter from signals it understands — a URL slug,
 * a caption, the discovery endpoint a candidate came from — and merged here
 * by confidence. Five dimensions are classified independently, because they
 * genuinely vary independently: the same storey is published both dimensioned
 * and with an area table, and a publisher may label both side elevations
 * identically while still telling you they are elevations.
 *
 * The rule that matters: **an unresolved dimension stays UNKNOWN.** A guessed
 * class is worse than an honest UNKNOWN because a later stage cannot tell the
 * two apart, and a wrong storey or a wrong side silently poisons every
 * measurement taken from that drawing.
 */
import type { AnnotationRole, DocumentRole, ProjectionRole, RoleEvidence, SourceRoles, StoreyRole, ViewRole } from './schema.js'

/** A partial, evidenced claim about one or more role dimensions. */
export type RoleClaim = {
  document?: DocumentRole
  storey?: StoreyRole
  annotation?: AnnotationRole
  view?: ViewRole
  projection?: ProjectionRole
  signal: string
  detail: string
  confidence: number
}

export const UNKNOWN_ROLES: SourceRoles = { document: 'UNKNOWN', storey: 'UNKNOWN', annotation: 'UNKNOWN', view: 'UNKNOWN', projection: 'UNKNOWN' }

const DIMENSIONS = ['document', 'storey', 'annotation', 'view', 'projection'] as const
type Dimension = (typeof DIMENSIONS)[number]

/**
 * Merge claims into one role set plus the evidence for it.
 *
 * Per dimension the highest-confidence claim wins. When two claims of equal
 * top confidence disagree, the dimension is left UNKNOWN and the disagreement
 * is kept in the evidence — an unresolvable conflict must not be resolved by
 * whichever claim happened to be first.
 */
export function mergeRoleClaims(claims: readonly RoleClaim[]): { roles: SourceRoles; evidence: RoleEvidence[] } {
  const roles: SourceRoles = { ...UNKNOWN_ROLES }
  const evidence: RoleEvidence[] = []
  for (const dim of DIMENSIONS) {
    const relevant = claims.filter((c) => c[dim] !== undefined)
    if (relevant.length === 0) continue
    const best = Math.max(...relevant.map((c) => c.confidence))
    const top = relevant.filter((c) => c.confidence === best)
    const values = [...new Set(top.map((c) => String(c[dim])))]
    for (const c of relevant) evidence.push({ dimension: dim, signal: c.signal, detail: c.detail, confidence: c.confidence })
    if (values.length === 1) {
      ;(roles as Record<Dimension, string>)[dim] = values[0]
    } else {
      evidence.push({ dimension: dim, signal: 'conflict', detail: `equally confident claims disagree (${values.join(' vs ')}); left UNKNOWN`, confidence: best })
    }
  }
  // sort so the evidence list is content, not discovery order
  evidence.sort((a, b) => a.dimension.localeCompare(b.dimension) || b.confidence - a.confidence || a.signal.localeCompare(b.signal) || a.detail.localeCompare(b.detail))
  return { roles, evidence }
}

/**
 * The projection a document role implies, when it implies one at all. Kept
 * separate from the document classification so an adapter that knows better
 * (a render that is actually an orthographic view, say) can outrank it.
 */
export function projectionForDocument(document: DocumentRole): ProjectionRole {
  switch (document) {
    case 'FLOOR_PLAN':
    case 'SITE_PLAN':
      return 'ORTHOGRAPHIC_PLAN'
    case 'SECTION':
      return 'ORTHOGRAPHIC_SECTION'
    case 'ELEVATION':
      return 'ORTHOGRAPHIC_ELEVATION'
    case 'PERSPECTIVE_RENDER':
      return 'PERSPECTIVE'
    default:
      return 'UNKNOWN'
  }
}

/** The storey dimension only means something for a plan. */
export const storeyApplies = (document: DocumentRole): boolean => document === 'FLOOR_PLAN' || document === 'SITE_PLAN'

/** The view dimension only means something for an elevation or a render. */
export const viewApplies = (document: DocumentRole): boolean => document === 'ELEVATION' || document === 'PERSPECTIVE_RENDER'

/** Fill NOT_APPLICABLE where a dimension cannot apply, leaving UNKNOWN where it applies but was not determined. */
export function normalizeRoles(roles: SourceRoles): SourceRoles {
  const out = { ...roles }
  if (out.document !== 'UNKNOWN') {
    if (!storeyApplies(out.document) && out.storey === 'UNKNOWN') out.storey = 'NOT_APPLICABLE'
    if (!viewApplies(out.document) && out.view === 'UNKNOWN') out.view = 'NOT_APPLICABLE'
    if (out.projection === 'UNKNOWN') out.projection = projectionForDocument(out.document)
  }
  return out
}

/** Roles that a later stage can actually measure against: a known document role and a known projection. */
export const isAnalysable = (roles: SourceRoles): boolean => roles.document !== 'UNKNOWN' && roles.document !== 'CHROME' && roles.projection !== 'UNKNOWN'
