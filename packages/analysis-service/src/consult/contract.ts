/**
 * v3.54.2 pilot — the consultant's contract (BuildPlan v3.54.2, "API jako konsultant i kontroler analizatora").
 *
 * The analyzer builds the house. A consultant (the provider's model, through `ConsultantModel`) is asked about ONE
 * problem the analyzer could not settle — today: printed dimension labels it could not read — and answers with what it
 * sees, what it still needs, and typed, bounded corrections. It never describes the house, never receives the
 * evaluation references, never runs code and never writes a model: the loop (`loop.ts`) validates each proposal, hands
 * the accepted ones to the analyzer's own consumer and keeps or rolls back the analyzer's result.
 */
export const CONSULTANT_CONTRACT_VERSION = '0.1.0' as const
export const CONSULTANT_PROMPT_VERSION = '0.2.0' as const

export const REVIEW_STATUSES = ['VERIFIED_IN_SCOPE', 'ISSUE_FOUND', 'NEED_EVIDENCE', 'UNKNOWN'] as const
export type ReviewStatus = (typeof REVIEW_STATUSES)[number]

/** The correction families with a consumer in the analyzer. Anything else is answered CAPABILITY_MISSING. */
export const CORRECTION_OPERATIONS = ['READ_LABEL', 'READ_DIMENSION'] as const
export type CorrectionOperation = (typeof CORRECTION_OPERATIONS)[number]

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
}

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
  return { review: o as ConsultantReview }
}
