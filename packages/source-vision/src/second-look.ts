/**
 * BUILDPLAN-ANALYZER-005Y-N4 (E): AI_SECOND_LOOK — a narrow, opt-in second reading of ONE ambiguity the deterministic
 * reader has already flagged, never a reading of the building.
 *
 * The question carries a crop of the drawing (its own byte hash), the hash of the asset it was cut from, and the two
 * or three readings the reader is choosing between. The provider is asked to read what is printed in the crop and is
 * told the candidates; its answer is text in the observation vocabulary (`value.unit: 'text'`), never a metre, a wall
 * or a command, and it goes through the same validation as any vision answer. What comes back is a record that sets
 * the two readings side by side — `AI_SAYS_X / CV_SAYS_Y` — and changes nothing: the record's provenance is
 * `AI_SUGGESTED`, and a caller may act on it only where its own deterministic check agrees (`CV_AI_VALIDATED`).
 *
 * A crop of a publisher's drawing leaves the machine only for a provider that runs elsewhere, and only with the
 * owner's consent: without it, or without credentials, the question is recorded as `AI_SECOND_LOOK_LIVE_NOT_RUN`.
 * A recorded fixture (`vision.fixture`) and the null provider run locally and need no consent.
 */
import { VisionResponseRejected, VisionUnavailable } from './reasoner.js'
import type { VisionReasoner } from './reasoner.js'
import type { VisionObservationRequest, VisionProviderInfo } from './schema.js'

/** Providers that answer without sending anything off the machine. */
const LOCAL_PROVIDERS = new Set(['vision.fixture', 'vision.none'])

export type SecondLookHypothesis = { id: string; text: string }

export type SecondLookQuestion = {
  id: string
  /** What is ambiguous, in one sentence a human can check against the crop. */
  ambiguity: string
  /** The asset the crop was cut from: its id and the hash of its full bytes. */
  source: { assetId: string; assetByteHash: string; cropRectPx: { x0: number; y0: number; x1: number; y1: number } }
  /** The crop shown to the provider, encoded, with the hash of exactly these bytes. */
  crop: { bytes: Uint8Array; byteHash: string; mediaType: string; width: number; height: number }
  /** Two or three readings the deterministic reader is choosing between. */
  hypotheses: readonly SecondLookHypothesis[]
  /** What the deterministic reader says, if anything: one of the hypotheses, or none (it refused). */
  cv: { hypothesisId: string | null; why: string }
}

export type SecondLookStatus = 'AI_SECOND_LOOK_LIVE_NOT_RUN' | 'ANSWERED' | 'NO_ANSWER' | 'REJECTED'
export type SecondLookAgreement = 'AGREE' | 'DISAGREE' | 'AI_UNMATCHED' | 'NONE'

export type SecondLookRecord = {
  questionId: string
  status: SecondLookStatus
  provider: VisionProviderInfo
  /** Why the question was not asked, or why the answer was refused. */
  reason?: string
  cvSays: string | null
  /** The text the provider read, as it read it; null when it did not answer. */
  aiSays: string | null
  /** The hypothesis the provider's text matches, if any. */
  aiHypothesisId: string | null
  agreement: SecondLookAgreement
  /** The three readings side by side: what the reader alone would do, what the provider suggests, and what passes both. */
  modes: { CV_ONLY: string | null; CV_AI_SUGGESTION: string | null; CV_AI_VALIDATED: string | null }
  /** Never SOURCE_EXACT: a model's reading of a crop is a suggestion. */
  provenance: 'AI_SUGGESTED'
  sourceAssetByteHash: string
  cropByteHash: string
}

export type SecondLookOptions = {
  /** The owner's explicit consent to send this crop to a provider that runs elsewhere. Absent means no. */
  ownerConsent?: boolean
  /** The deterministic check a suggestion must pass to be validated (e.g. the plan gap a width must fit). */
  validate?: (hypothesisId: string) => boolean
}

const normalise = (s: string): string => s.replace(/\s+/g, '').replace(/[\\|]/g, '/').toLowerCase()

/** Ask one flagged question. Never throws for an unavailable or refusing provider: that is a recorded outcome. */
export async function secondLook(question: SecondLookQuestion, reasoner: VisionReasoner, options: SecondLookOptions = {}): Promise<SecondLookRecord> {
  if (question.hypotheses.length < 2 || question.hypotheses.length > 3) throw new Error(`a second look chooses between two or three readings; ${question.id} has ${question.hypotheses.length}`)
  const cvSays = question.cv.hypothesisId ? (question.hypotheses.find((h) => h.id === question.cv.hypothesisId)?.text ?? null) : null
  const base = { questionId: question.id, provider: reasoner.provider, cvSays, provenance: 'AI_SUGGESTED' as const, sourceAssetByteHash: question.source.assetByteHash, cropByteHash: question.crop.byteHash }
  const notRun = (status: SecondLookStatus, reason: string): SecondLookRecord => ({ ...base, status, reason, aiSays: null, aiHypothesisId: null, agreement: 'NONE', modes: { CV_ONLY: cvSays, CV_AI_SUGGESTION: null, CV_AI_VALIDATED: null } })
  const local = LOCAL_PROVIDERS.has(reasoner.provider.id)
  if (!local && options.ownerConsent !== true) return notRun('AI_SECOND_LOOK_LIVE_NOT_RUN', 'the owner has not consented to sending a crop of the drawing to an external provider')
  const request: VisionObservationRequest = {
    task: 'PLAN_INTERPRETATION',
    asset: { assetId: `${question.source.assetId}#crop`, byteHash: question.crop.byteHash, mediaType: question.crop.mediaType, bytes: question.crop.bytes },
    roles: { document: 'FLOOR_PLAN', storey: 'UNKNOWN', annotation: 'ANNOTATED', view: 'PLAN', projection: 'ORTHOGRAPHIC_PLAN' },
    size: { width: question.crop.width, height: question.crop.height },
    focus: `Read only the size printed in the ring callout in this crop, exactly as printed, as one PRINTED_DIMENSION with the text in \`value\` (unit "text"). It is one of: ${question.hypotheses.map((h) => `"${h.text}"`).join(', ')}, or something else — say what you see, not what fits. Do not convert anything to metres.`,
    maxObservations: 4,
  }
  if (!reasoner.available(request)) return notRun(local ? 'NO_ANSWER' : 'AI_SECOND_LOOK_LIVE_NOT_RUN', local ? 'no recorded answer for these bytes' : 'no provider credentials are configured')
  let texts: string[]
  try {
    const response = await reasoner.analyze(request)
    texts = response.observations.filter((o) => o.value?.unit === 'text' && typeof o.value.text === 'string').map((o) => o.value?.text as string)
  } catch (e) {
    if (e instanceof VisionUnavailable) return notRun(local ? 'NO_ANSWER' : 'AI_SECOND_LOOK_LIVE_NOT_RUN', e.message)
    if (e instanceof VisionResponseRejected) return notRun('REJECTED', `${e.code}: ${e.message}`)
    throw e
  }
  if (texts.length === 0) return notRun('NO_ANSWER', 'the provider read no printed text in the crop')
  const aiSays = texts[0]
  const matched = question.hypotheses.find((h) => normalise(h.text) === normalise(aiSays)) ?? null
  const agreement: SecondLookAgreement = !matched ? 'AI_UNMATCHED' : !question.cv.hypothesisId ? 'NONE' : matched.id === question.cv.hypothesisId ? 'AGREE' : 'DISAGREE'
  const validated = matched && (options.validate ? options.validate(matched.id) : false) ? matched.text : null
  return { ...base, status: 'ANSWERED', aiSays, aiHypothesisId: matched?.id ?? null, agreement, modes: { CV_ONLY: cvSays, CV_AI_SUGGESTION: matched?.text ?? null, CV_AI_VALIDATED: validated } }
}

/** The record's one-line ledger form: `AI_SAYS_X / CV_SAYS_Y`, or why nobody was asked. */
export const secondLookLine = (r: SecondLookRecord): string =>
  r.status === 'ANSWERED' ? `AI_SAYS_${r.aiSays ?? '?'} / CV_SAYS_${r.cvSays ?? 'NOTHING'} (${r.agreement}${r.modes.CV_AI_VALIDATED ? `, validated ${r.modes.CV_AI_VALIDATED}` : ''})` : `${r.status}: ${r.reason ?? ''}`
