/**
 * v3.54.2 pilot — the consultant's contract (BuildPlan v3.54.2, "API jako konsultant i kontroler analizatora").
 *
 * The analyzer builds the house. A consultant (the provider's model, through `ConsultantModel`) is asked about ONE
 * problem the analyzer could not settle — today: printed dimension labels it could not read — and answers with what it
 * sees, what it still needs, and typed, bounded corrections. It never describes the house, never receives the
 * evaluation references, never runs code and never writes a model: the loop (`loop.ts`) validates each proposal, hands
 * the accepted ones to the analyzer's own consumer and keeps or rolls back the analyzer's result.
 */
// 0.2.0 (v3.54.3): geometry corrections after the build (ROOF_FEATURE with a `feature`, bound by the analyzer), the review
// of applied corrections (`appliedReview`), and a problem id on every proposal's record.
// 0.3.0 (v3.54.16): the post-build check proposes operations of the correction registry (`correct/registry.ts`) with a
// typed `patch`, a `defectId` and an optional `group`, and reports every difference in `defects` — supported or not.
// 0.4.0 (v3.54.16 audit A1): a defect keeps its identity across looks — `continues` names the earlier open defect it
// restates, and `resolved` states, explicitly, an earlier defect that no longer differs, is not in the source, or is
// superseded by a defect of this look. Silence about an earlier defect closes nothing.
import { DEFECT_SCHEMA, PATCH_SCHEMA } from './correct/registry.js'
import type { PatchFields, ReviewDefect } from './correct/registry.js'

export const CONSULTANT_CONTRACT_VERSION = '0.6.0' as const
export const CONSULTANT_PROMPT_VERSION = '0.7.0' as const

export const REVIEW_STATUSES = ['VERIFIED_IN_SCOPE', 'ISSUE_FOUND', 'NEED_EVIDENCE', 'UNKNOWN'] as const
export type ReviewStatus = (typeof REVIEW_STATUSES)[number]

/** The correction families with a consumer in the analyzer's metric layer. Anything else there is answered CAPABILITY_MISSING. */
export const CORRECTION_OPERATIONS = ['READ_LABEL', 'READ_DIMENSION'] as const
export type CorrectionOperation = (typeof CORRECTION_OPERATIONS)[number]
/** v3.54.3: the geometry families with a consumer after the build (`geometry.ts`). */
export const GEOMETRY_OPERATIONS = ['ROOF_FEATURE'] as const
/** v3.54.3: what the plan-outline consultation may propose (`consultBoundary`): a side of the building closed by glazing. */
export const BOUNDARY_OPERATIONS = ['CLASSIFY_BOUNDARY'] as const
export const SHEET_SIDES = ['TOP', 'BOTTOM', 'LEFT', 'RIGHT'] as const
export type SheetSide = (typeof SHEET_SIDES)[number]
export const BOUNDARY_CLASSES = ['GLAZED_WALL', 'SOLID_WALL', 'OPEN', 'NOT_BUILDING', 'UNSURE'] as const
export type BoundaryClass = (typeof BOUNDARY_CLASSES)[number]
/** What closes the building on one side of the plan sheet, and where on the sheet that boundary is drawn. */
export type ProposedBoundary = { side: SheetSide; class: BoundaryClass; region: Region }
export type GeometryOperation = (typeof GEOMETRY_OPERATIONS)[number]
/** What the post-build check may name; those outside GEOMETRY_OPERATIONS are recorded CAPABILITY_MISSING, by name. */
export const CHECK_OPERATIONS = ['ROOF_FEATURE', 'ASSIGN_VIEW', 'ROOF_FORM', 'OUTLINE_REGION', 'OPENING', 'MISSING_ELEMENT'] as const

export const FEATURE_KINDS = ['GABLE_DORMER', 'SHED_DORMER', 'FLAT_DORMER', 'CROSS_GABLE', 'CANOPY', 'OTHER'] as const
export type FeatureKind = (typeof FEATURE_KINDS)[number]
export const MODEL_SIDES = ['FRONT', 'RIGHT', 'REAR', 'LEFT'] as const
export type ModelSideName = (typeof MODEL_SIDES)[number]

/**
 * v3.54.3: where a roof feature is, in the terms one elevation drawing gives — pixels of that picture, nothing else.
 * The analyzer turns them into shares of the side and of the roof's rise and binds them to its own building.
 */
export type ProposedFeature = {
  kind: FeatureKind
  /** The model side it is on, as the model's views name it. */
  modelSide: ModelSideName
  /** The number of the source picture (an elevation drawing) it is read from. */
  picture: number
  /** In that picture: the outer edges of the building's walls on this side, the main roof's eaves line and its ridge line. */
  facade: { leftX: number; rightX: number; eavesY: number; ridgeY: number }
  /** In that picture: the feature's two sides (x0 < x1), the top of its own roof (y0) and its own eaves (y1), y down. */
  box: Region
  front: 'FLUSH_WITH_FACADE' | 'SET_BACK_ON_SLOPE' | 'UNKNOWN'
  glazed: boolean
  /** True when that picture shows the side left-to-right reversed against the model's view of it. */
  mirrored: boolean
}

export type AppliedReview = { id: string; verdict: 'MATCHES' | 'ACCEPTABLE_APPROXIMATION' | 'WRONG_PLACE' | 'WRONG_SIZE' | 'WRONG_KIND' | 'SHOULD_NOT_EXIST' | 'NOT_VISIBLE'; note: string }

/** What the reading direction of a printed label is, as the consultant sees it on the sheet. */
export const READING_DIRECTIONS = ['LEFT_TO_RIGHT', 'BOTTOM_TO_TOP', 'TOP_TO_BOTTOM', 'UPSIDE_DOWN'] as const
export type ReadingDirection = (typeof READING_DIRECTIONS)[number]

export type Region = { x0: number; y0: number; x1: number; y1: number }

export type ReviewObservation = { about: string; seen: string; certainty: 'CERTAIN' | 'LIKELY' | 'UNSURE' }

export type EvidenceRequest = { kind: 'SOURCE_REGION' | 'MEASUREMENT_CONTEXT' | 'OTHER'; target: string; region?: Region; why: string }

export type ProposedCorrection = {
  proposalId: string
  baseRevision: string
  operation: string
  targetId: string
  /** What the consultant understood the analyzer to hold now (a precondition, checked by the validator). */
  current?: string
  proposed: { literal: string; unit: 'cm' | 'm' | 'mm' | 'ft-in' | 'unknown'; direction?: ReadingDirection }
  /** READ_DIMENSION: the two ends of the dimension line (where its extension lines or ticks cross it), in overview pixels. */
  span?: Region
  /** ROOF_FEATURE (v3.54.3): where the feature is, in one elevation picture's pixels. */
  feature?: ProposedFeature
  /** CLASSIFY_BOUNDARY (v3.54.3): what closes the building on one side of the plan sheet. */
  boundary?: ProposedBoundary
  /** v3.54.16: an operation of the correction registry — its typed fields (`correct/registry.ts`). */
  patch?: PatchFields
  /** v3.54.16: the reported defect this proposal corrects. */
  defectId?: string
  /** v3.54.16: proposals that only make sense together share one group and are kept or undone together. */
  group?: string
  evidence: Array<{ sourceId: string; region?: Region }>
  justification: string
  alternatives: Array<{ literal: string; why: string }>
  uncertainty: 'LOW' | 'MEDIUM' | 'HIGH'
  expectedEffect: string
}

export type ConsultantReview = {
  status: ReviewStatus
  observations: ReviewObservation[]
  requestedEvidence: EvidenceRequest[]
  proposedCorrections: ProposedCorrection[]
  checked: string[]
  notChecked: string[]
  /** v3.54.3: the consultant's verdict on each correction the analyzer applied since its last look. */
  appliedReview?: AppliedReview[]
  /** v3.54.16: every difference found, with an id, whether or not an operation can correct it. */
  defects?: ReviewDefect[]
  /** 0.4.0: explicit statements about earlier open defects (by their listed ids). */
  resolved?: ReviewResolution[]
}

export const RESOLUTION_VERDICTS = ['NO_LONGER_DIFFERENT', 'NOT_IN_SOURCE', 'SUPERSEDED'] as const
export type ReviewResolution = { defectId: string; verdict: (typeof RESOLUTION_VERDICTS)[number]; note: string; supersededBy?: string }

/** The answer tool's input schema: the whole review in one call. Kept small (no unions beyond enums). */
export const REVIEW_TOOL_NAME = 'submit_review' as const
const REGION_SCHEMA = {
  type: 'object',
  properties: { x0: { type: 'number' }, y0: { type: 'number' }, x1: { type: 'number' }, y1: { type: 'number' } },
  required: ['x0', 'y0', 'x1', 'y1'],
  additionalProperties: false,
} as const
export const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: [...REVIEW_STATUSES] },
    observations: {
      type: 'array',
      items: { type: 'object', properties: { about: { type: 'string' }, seen: { type: 'string' }, certainty: { type: 'string', enum: ['CERTAIN', 'LIKELY', 'UNSURE'] } }, required: ['about', 'seen', 'certainty'], additionalProperties: false },
    },
    requestedEvidence: {
      type: 'array',
      items: { type: 'object', properties: { kind: { type: 'string', enum: ['SOURCE_REGION', 'MEASUREMENT_CONTEXT', 'OTHER'] }, target: { type: 'string' }, region: REGION_SCHEMA, why: { type: 'string' } }, required: ['kind', 'target', 'why'], additionalProperties: false },
    },
    proposedCorrections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          proposalId: { type: 'string' },
          baseRevision: { type: 'string' },
          operation: { type: 'string' },
          targetId: { type: 'string' },
          current: { type: 'string' },
          proposed: {
            type: 'object',
            properties: { literal: { type: 'string' }, unit: { type: 'string', enum: ['cm', 'm', 'mm', 'ft-in', 'unknown'] }, direction: { type: 'string', enum: [...READING_DIRECTIONS] } },
            required: ['literal', 'unit'],
            additionalProperties: false,
          },
          span: REGION_SCHEMA,
          feature: {
            type: 'object',
            properties: {
              kind: { type: 'string', enum: [...FEATURE_KINDS] },
              modelSide: { type: 'string', enum: [...MODEL_SIDES] },
              picture: { type: 'integer' },
              facade: { type: 'object', properties: { leftX: { type: 'number' }, rightX: { type: 'number' }, eavesY: { type: 'number' }, ridgeY: { type: 'number' } }, required: ['leftX', 'rightX', 'eavesY', 'ridgeY'], additionalProperties: false },
              box: REGION_SCHEMA,
              front: { type: 'string', enum: ['FLUSH_WITH_FACADE', 'SET_BACK_ON_SLOPE', 'UNKNOWN'] },
              glazed: { type: 'boolean' },
              mirrored: { type: 'boolean' },
            },
            required: ['kind', 'modelSide', 'picture', 'facade', 'box', 'front', 'glazed', 'mirrored'],
            additionalProperties: false,
          },
          boundary: { type: 'object', properties: { side: { type: 'string', enum: [...SHEET_SIDES] }, class: { type: 'string', enum: [...BOUNDARY_CLASSES] }, region: REGION_SCHEMA }, required: ['side', 'class', 'region'], additionalProperties: false },
          patch: PATCH_SCHEMA,
          defectId: { type: 'string' },
          group: { type: 'string' },
          evidence: { type: 'array', items: { type: 'object', properties: { sourceId: { type: 'string' }, region: REGION_SCHEMA }, required: ['sourceId'], additionalProperties: false } },
          justification: { type: 'string' },
          alternatives: { type: 'array', items: { type: 'object', properties: { literal: { type: 'string' }, why: { type: 'string' } }, required: ['literal', 'why'], additionalProperties: false } },
          uncertainty: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
          expectedEffect: { type: 'string' },
        },
        required: ['proposalId', 'baseRevision', 'operation', 'targetId', 'proposed', 'evidence', 'justification', 'alternatives', 'uncertainty', 'expectedEffect'],
        additionalProperties: false,
      },
    },
    checked: { type: 'array', items: { type: 'string' } },
    notChecked: { type: 'array', items: { type: 'string' } },
    appliedReview: {
      type: 'array',
      items: { type: 'object', properties: { id: { type: 'string' }, verdict: { type: 'string', enum: ['MATCHES', 'ACCEPTABLE_APPROXIMATION', 'WRONG_PLACE', 'WRONG_SIZE', 'WRONG_KIND', 'SHOULD_NOT_EXIST', 'NOT_VISIBLE'] }, note: { type: 'string' } }, required: ['id', 'verdict', 'note'], additionalProperties: false },
    },
    defects: { type: 'array', items: DEFECT_SCHEMA },
    resolved: {
      type: 'array',
      items: { type: 'object', properties: { defectId: { type: 'string' }, verdict: { type: 'string', enum: [...RESOLUTION_VERDICTS] }, note: { type: 'string' }, supersededBy: { type: 'string' } }, required: ['defectId', 'verdict', 'note'], additionalProperties: false },
    },
  },
  required: ['status', 'observations', 'requestedEvidence', 'proposedCorrections', 'checked', 'notChecked'],
  additionalProperties: false,
} as const

/** The first place a correct proposal was lost (brief §9). */
export const LOSS_POINTS = [
  'NOT_SENT',
  'NOT_SEEN',
  'UNREADABLE',
  'WRONG_READ',
  'WRONG_BINDING',
  'PARSE_REJECTED',
  'CAPABILITY_MISSING',
  'VALIDATION_REJECTED',
  'NOT_CONSUMED',
  'OVERRIDDEN',
  'STALE_CACHE',
  'REPRESENTATION_LIMIT',
  'COMPILE_CONFLICT',
] as const
export type LossPoint = (typeof LOSS_POINTS)[number]

/** Structural check of a review as the model sent it. Returns the review or why it is not one. */
export function parseReview(input: unknown): { review: ConsultantReview } | { refused: string } {
  const o = input as Partial<ConsultantReview> | null
  if (!o || typeof o !== 'object') return { refused: 'the answer is not an object' }
  if (!REVIEW_STATUSES.includes(o.status as ReviewStatus)) return { refused: `status ${String(o.status)} is not one of ${REVIEW_STATUSES.join(', ')}` }
  for (const k of ['observations', 'requestedEvidence', 'proposedCorrections', 'checked', 'notChecked'] as const) if (!Array.isArray(o[k])) return { refused: `${k} is not a list` }
  for (const p of o.proposedCorrections as ProposedCorrection[]) {
    if (!p || typeof p.proposalId !== 'string' || typeof p.operation !== 'string' || typeof p.targetId !== 'string' || !p.proposed || typeof p.proposed.literal !== 'string') return { refused: 'a proposed correction lacks proposalId, operation, targetId or proposed.literal' }
  }
  // 0.4.0: a resolution that does not name an earlier defect and a known verdict is dropped by name, not guessed
  const review = o as ConsultantReview
  if (review.resolved !== undefined) {
    if (!Array.isArray(review.resolved)) return { refused: 'resolved is not a list' }
    review.resolved = review.resolved.filter((r) => r && typeof r.defectId === 'string' && RESOLUTION_VERDICTS.includes(r.verdict) && typeof r.note === 'string' && (r.verdict !== 'SUPERSEDED' || typeof r.supersededBy === 'string'))
  }
  return { review }
}
