/**
 * EXTERIOR-COMPLETE E13 (contract v3.42): the messages between the analyzer and a vision model when the analyzer cannot
 * settle something itself, and the loop that turns an answer into a change of the canonical model — or refuses it.
 *
 * The analyzer states a PROBLEM (what is unsettled, which sources show it, which operations may answer it). The model
 * returns OBSERVATIONS in the image's own normalized coordinates, typed from a closed vocabulary that admits OTHER and
 * UNKNOWN, with a region, a location uncertainty and a class confidence kept apart, and may answer UNKNOWN or ask for
 * more evidence. The caller turns validated observations into a PROPOSAL — a domain operation on a named target of a
 * stated base revision, never code or a mesh — builds a VARIANT of the model on a copy, compiles it, compares it with
 * the sources and with the model it would replace, and records a DECISION: accepted, rejected or deferred, with every
 * check, both revisions, what changed, the compiler's errors before and after, and the calls it cost.
 *
 * Schema validation guarantees a message's shape, not its truth: every check that makes an observation usable is the
 * caller's deterministic `validate`, which never sees a reference answer. The loop is bounded (`maxRounds`, default two
 * automatic rounds per problem) and spends only what its `budget` allows; when the provider is unavailable, out of
 * budget or wrong, the analyzer's own model stands.
 *
 * Nothing here talks to a provider, reads a file or runs a compiler: `ask`, `validate`, `propose`, `buildVariant` and
 * `compare` are the caller's. The JSON Schema handed to a provider is generated from the Zod vocabularies below.
 */
import { z } from 'zod'

export const AI_LOOP_CONTRACT_VERSION = 'review-loop-1' as const

export const LoopTaskSchema = z.enum(['READ_TEXT', 'CLASSIFY_ELEMENT', 'RELATE_SOURCES', 'REVIEW_MODEL'])
export const ProblemCodeSchema = z.enum(['MISSING_FEATURE', 'UNSUPPORTED_FEATURE', 'WRONG_FAMILY', 'WRONG_POSITION', 'WRONG_TOPOLOGY', 'WRONG_PROPORTION', 'SOURCE_CONFLICT', 'UNCHECKED'])
/** What a model may say it sees. OTHER and UNKNOWN are answers, not failures. */
export const LoopObservationKindSchema = z.enum(['LEVEL_MARK', 'DIMENSION', 'OPENING_CALLOUT', 'DOOR', 'WINDOW', 'FRENCH_WINDOW', 'GARAGE_DOOR', 'BALCONY', 'RAILING', 'DORMER', 'ROOF_PLANE', 'TERRACE', 'OTHER', 'UNKNOWN'])
/** The domain operations a proposal may name. Never code, a mesh or a DSL command. */
export const ProposalOpSchema = z.enum(['ADD_SOURCE_READINGS', 'SET_OPENING_FAMILY', 'SET_ROOF_AXIS', 'RECONSIDER_EXTENT'])
export const AnswerStatusSchema = z.enum(['ANSWERED', 'UNKNOWN', 'NEED_MORE_EVIDENCE'])

const hex64 = z.string().regex(/^[0-9a-f]{64}$/)
const norm = z.number().min(0).max(1)
export const RegionNormSchema = z.object({ x0: norm, y0: norm, x1: norm, y1: norm }).strict().refine((r) => r.x1 > r.x0 && r.y1 > r.y0, 'a region has positive width and height')
export type RegionNorm = z.infer<typeof RegionNormSchema>

export const SourceRefSchema = z
  .object({
    assetId: z.string().min(1),
    byteHash: hex64,
    frameId: z.string().min(1),
    widthPx: z.number().int().positive(),
    heightPx: z.number().int().positive(),
    document: z.string().min(1),
    projection: z.string().min(1),
    side: z.string().min(1),
    storey: z.string().min(1),
    /** The part of the original the image shown is, and how it was scaled: image px = (original px − offset) × scale. */
    cropRectPx: z.object({ x0: z.number(), y0: z.number(), x1: z.number(), y1: z.number() }).strict(),
    transform: z.object({ scale: z.number().positive(), offsetPx: z.object({ x: z.number(), y: z.number() }).strict() }).strict(),
  })
  .strict()
export type SourceRef = z.infer<typeof SourceRefSchema>

export const KnownFactSchema = z.object({ what: z.string().min(1), value: z.union([z.string(), z.number()]), unit: z.string().optional(), provenance: z.string().min(1) }).strict()

export const AnalyzerProblemSchema = z
  .object({
    contractVersion: z.literal(AI_LOOP_CONTRACT_VERSION),
    problemId: z.string().min(1),
    runId: z.string().min(1),
    modelRevision: z.string().min(1),
    modelHash: z.string().min(1),
    code: ProblemCodeSchema,
    task: LoopTaskSchema,
    subject: z.object({ kind: z.string().min(1), frameId: z.string().optional(), elementIds: z.array(z.string()).optional() }).strict(),
    question: z.string().min(1).max(1200),
    /** Facts the analyzer read itself, with their provenance. Never a reference answer, never the check it will run. */
    facts: z.array(KnownFactSchema).max(32),
    /** Optional readings the analyzer is choosing between; OTHER and UNKNOWN stay open. */
    hypotheses: z.array(z.object({ id: z.string().min(1), text: z.string().min(1) }).strict()).max(6).optional(),
    sources: z.array(SourceRefSchema).min(1).max(4),
    allowedOps: z.array(ProposalOpSchema).min(1),
    limits: z.object({ maxObservations: z.number().int().positive().max(64), maxRounds: z.number().int().positive().max(4), maxUsd: z.number().positive() }).strict(),
  })
  .strict()
export type AnalyzerProblem = z.infer<typeof AnalyzerProblemSchema>

export const LoopObservationSchema = z
  .object({
    /** Index into the problem's `sources`: which image this was seen on. */
    sourceIndex: z.number().int().nonnegative(),
    kind: LoopObservationKindSchema,
    /** Text exactly as printed, when the observation is a label: digits, signs and separators as drawn. */
    textAsPrinted: z.string().max(40).optional(),
    units: z.string().max(12).optional(),
    regionNorm: RegionNormSchema,
    /** How far the region may be off, as a fraction of the image's larger edge: apart from how sure the class is. */
    locationUncertaintyNorm: z.number().min(0).max(0.5),
    classConfidence: z.number().min(0).max(1),
    legible: z.boolean(),
    premise: z.string().min(1).max(400),
    counterEvidence: z.string().max(400).optional(),
  })
  .strict()
export type LoopObservation = z.infer<typeof LoopObservationSchema>

export const AiAnswerSchema = z
  .object({
    status: AnswerStatusSchema,
    observations: z.array(LoopObservationSchema).max(64),
    needMore: z.object({ what: z.string().min(1).max(300), why: z.string().min(1).max(300) }).strict().optional(),
    notes: z.string().max(600).optional(),
  })
  .strict()
export type AiAnswer = z.infer<typeof AiAnswerSchema>

export const RevisionProposalSchema = z
  .object({
    contractVersion: z.literal(AI_LOOP_CONTRACT_VERSION),
    proposalId: z.string().min(1),
    problemId: z.string().min(1),
    baseRevision: z.string().min(1),
    op: ProposalOpSchema,
    target: z.string().min(1),
    /** Indices of the validated observations the proposal rests on. */
    premises: z.array(z.number().int().nonnegative()).min(1),
    expectedEffect: z.string().min(1).max(600),
    checks: z.array(z.string().min(1)).min(1),
  })
  .strict()
export type RevisionProposal = z.infer<typeof RevisionProposalSchema>

export const CheckResultSchema = z.object({ name: z.string().min(1), passed: z.boolean().nullable(), detail: z.string() }).strict()
export type CheckResult = z.infer<typeof CheckResultSchema>

export const DecisionRecordSchema = z
  .object({
    contractVersion: z.literal(AI_LOOP_CONTRACT_VERSION),
    problemId: z.string().min(1),
    proposalId: z.string().optional(),
    outcome: z.enum(['ACCEPTED', 'REJECTED', 'DEFERRED']),
    why: z.string().min(1),
    rounds: z.number().int().nonnegative(),
    observationChecks: z.array(CheckResultSchema),
    proposalChecks: z.array(CheckResultSchema),
    oldRevision: z.string().min(1),
    newRevision: z.string().optional(),
    changedElements: z.array(z.string()),
    compile: z.object({ errorsBefore: z.record(z.string(), z.number()), errorsAfter: z.record(z.string(), z.number()).optional() }).strict(),
    sourceChecks: z.array(CheckResultSchema),
    calls: z.array(z.object({ model: z.string(), sessionId: z.string().nullable(), estimatedCostUsd: z.number().nullable(), status: z.string() }).strict()),
  })
  .strict()
export type DecisionRecord = z.infer<typeof DecisionRecordSchema>

/** The JSON Schema a provider answers against, generated from the vocabularies above (never a second hand-kept copy). */
export function aiAnswerJsonSchema(maxObservations: number): Record<string, unknown> {
  const n = { type: 'number', minimum: 0, maximum: 1 }
  return {
    type: 'object',
    additionalProperties: false,
    required: ['status', 'observations'],
    properties: {
      status: { type: 'string', enum: [...AnswerStatusSchema.options], description: 'ANSWERED, or UNKNOWN when it cannot be seen, or NEED_MORE_EVIDENCE with what would settle it.' },
      observations: {
        type: 'array',
        maxItems: maxObservations,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['sourceIndex', 'kind', 'regionNorm', 'locationUncertaintyNorm', 'classConfidence', 'legible', 'premise'],
          properties: {
            sourceIndex: { type: 'integer', minimum: 0 },
            kind: { type: 'string', enum: [...LoopObservationKindSchema.options] },
            textAsPrinted: { type: 'string', maxLength: 40, description: 'Exactly as printed: digits, signs, commas. Do not convert.' },
            units: { type: 'string', maxLength: 12 },
            regionNorm: { type: 'object', additionalProperties: false, required: ['x0', 'y0', 'x1', 'y1'], properties: { x0: n, y0: n, x1: n, y1: n }, description: 'The box around what you saw, in [0,1] of the image, y down.' },
            locationUncertaintyNorm: { type: 'number', minimum: 0, maximum: 0.5 },
            classConfidence: n,
            legible: { type: 'boolean' },
            premise: { type: 'string', maxLength: 400, description: 'The visual cue, one sentence a reader can check against the image.' },
            counterEvidence: { type: 'string', maxLength: 400 },
          },
        },
      },
      needMore: { type: 'object', additionalProperties: false, required: ['what', 'why'], properties: { what: { type: 'string', maxLength: 300 }, why: { type: 'string', maxLength: 300 } } },
      notes: { type: 'string', maxLength: 600 },
    },
  }
}

/** A provider's answer, checked against the problem it answers: shape, source indices, the observation cap. */
export function parseAiAnswer(raw: unknown, problem: AnalyzerProblem): { ok: true; answer: AiAnswer } | { ok: false; why: string } {
  const parsed = AiAnswerSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, why: `SCHEMA_INVALID: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).slice(0, 4).join('; ')}` }
  const a = parsed.data
  if (a.observations.length > problem.limits.maxObservations) return { ok: false, why: `TOO_MANY_OBSERVATIONS: ${a.observations.length} > ${problem.limits.maxObservations}` }
  const badSource = a.observations.find((o) => o.sourceIndex >= problem.sources.length)
  if (badSource) return { ok: false, why: `WRONG_SOURCE: observation on source ${badSource.sourceIndex} of ${problem.sources.length}` }
  if (a.status === 'NEED_MORE_EVIDENCE' && !a.needMore) return { ok: false, why: 'NEED_MORE_EVIDENCE without saying what' }
  return { ok: true, answer: a }
}

export type LoopCall = { model: string; sessionId: string | null; estimatedCostUsd: number | null; status: string }
export type LoopSteps<V> = {
  /** Ask the provider (round 0 the cheaper one, then the next); returns its raw structured answer and the call's trace. */
  ask: (problem: AnalyzerProblem, round: number) => Promise<{ raw: unknown; call: LoopCall } | { unavailable: string; call?: LoopCall }>
  /** Deterministic checks of each observation, without a reference answer. Returns the usable observations' indices. */
  validate: (answer: AiAnswer, problem: AnalyzerProblem) => { usable: number[]; checks: CheckResult[]; enough: boolean; why: string }
  /** The domain proposal the usable observations support. */
  propose: (answer: AiAnswer, usable: number[], problem: AnalyzerProblem) => RevisionProposal
  /** Build, compile and render a variant on a copy of the canonical model. */
  buildVariant: (proposal: RevisionProposal, answer: AiAnswer) => Promise<V>
  /** Compare the variant with the model it would replace and with the sources: the decision's checks. */
  /**
   * E13: `unverified` — what else the variant changes that neither the validated observations nor a source check
   * decides (a side effect: an opening an elevation now places because the levels unlocked it). Not a regression, not
   * an improvement anyone checked: the variant is not applied, and a person decides.
   */
  compare: (variant: V) => { revision: string; changedElements: string[]; errorsAfter: Record<string, number>; sourceChecks: CheckResult[]; regressions: string[]; unverified?: string[] }
}

/**
 * One problem through the loop. Returns the decision record and, when accepted, the variant. A proposal on a stale base
 * revision, an operation the problem does not allow, a variant whose compile errors grow, any regression (a lost
 * opening, wall, body or entrance; an added element without a source) or a failed source check rejects the change —
 * atomically: the base model stands.
 */
export async function runReviewLoop<V>(problem: AnalyzerProblem, current: { revision: string; errors: Record<string, number> }, steps: LoopSteps<V>): Promise<{ decision: DecisionRecord; variant?: V }> {
  AnalyzerProblemSchema.parse(problem)
  const calls: LoopCall[] = []
  const base = { contractVersion: AI_LOOP_CONTRACT_VERSION, problemId: problem.problemId, oldRevision: current.revision, compile: { errorsBefore: current.errors }, calls }
  const record = (d: Omit<DecisionRecord, 'contractVersion' | 'problemId' | 'oldRevision' | 'compile' | 'calls'> & { errorsAfter?: Record<string, number> }): DecisionRecord => {
    const { errorsAfter, ...rest } = d
    return DecisionRecordSchema.parse({ ...base, ...rest, compile: { errorsBefore: current.errors, ...(errorsAfter ? { errorsAfter } : {}) } })
  }
  const roundNotes: string[] = []
  let lastChecks: CheckResult[] = []
  for (let round = 0; round < problem.limits.maxRounds; round += 1) {
    const got = await steps.ask(problem, round)
    if (got.call) calls.push(got.call)
    if ('unavailable' in got) {
      roundNotes.push(`round ${round + 1}: the provider did not answer (${got.unavailable})`)
      break
    }
    const parsed = parseAiAnswer(got.raw, problem)
    if (!parsed.ok) {
      roundNotes.push(`round ${round + 1}: the answer was refused whole (${parsed.why})`)
      lastChecks = [{ name: 'schema', passed: false, detail: parsed.why }]
      continue
    }
    const answer = parsed.answer
    if (answer.status !== 'ANSWERED') {
      roundNotes.push(`round ${round + 1}: ${answer.status === 'UNKNOWN' ? 'the model could not see it' : `the model asked for more: ${answer.needMore?.what}`}`)
      continue
    }
    const v = steps.validate(answer, problem)
    lastChecks = v.checks
    if (!v.enough) {
      roundNotes.push(`round ${round + 1}: the observations did not pass the deterministic checks (${v.why})`)
      continue
    }
    const proposal = RevisionProposalSchema.parse(steps.propose(answer, v.usable, problem))
    const proposalChecks: CheckResult[] = [
      { name: 'base revision', passed: proposal.baseRevision === current.revision, detail: `${proposal.baseRevision} against the current ${current.revision}` },
      { name: 'allowed operation', passed: problem.allowedOps.includes(proposal.op), detail: proposal.op },
      { name: 'premises are validated observations', passed: proposal.premises.every((i) => v.usable.includes(i)), detail: proposal.premises.join(',') },
    ]
    if (proposalChecks.some((c) => c.passed === false)) return { decision: record({ outcome: 'REJECTED', proposalId: proposal.proposalId, why: `the proposal is not admissible: ${proposalChecks.filter((c) => c.passed === false).map((c) => c.name).join(', ')}`, rounds: round + 1, observationChecks: v.checks, proposalChecks, changedElements: [], sourceChecks: [] }) }
    const variant = await steps.buildVariant(proposal, answer)
    const cmp = steps.compare(variant)
    const errorsGrew = Object.entries(cmp.errorsAfter).some(([code, n]) => n > (current.errors[code] ?? 0))
    const failedSource = cmp.sourceChecks.filter((c) => c.passed === false)
    const reasons = [...(errorsGrew ? ['compile errors grew'] : []), ...cmp.regressions.map((r) => `regression: ${r}`), ...failedSource.map((c) => `source check failed: ${c.name}`)]
    const accepted = reasons.length === 0 && cmp.sourceChecks.some((c) => c.passed === true)
    const unverified = cmp.unverified ?? []
    if (accepted && unverified.length > 0) {
      return { decision: record({ outcome: 'DEFERRED', proposalId: proposal.proposalId, why: `the readings pass and ${cmp.sourceChecks.filter((c) => c.passed).map((c) => c.name).join(', ')}, but the variant also changes what nothing checked: ${unverified.join('; ')}; it is not applied, and the person decides`, rounds: round + 1, observationChecks: v.checks, proposalChecks, newRevision: cmp.revision, changedElements: cmp.changedElements, sourceChecks: cmp.sourceChecks, errorsAfter: cmp.errorsAfter }) }
    }
    return {
      decision: record({ outcome: accepted ? 'ACCEPTED' : 'REJECTED', proposalId: proposal.proposalId, why: accepted ? `validated observations, an admissible proposal, no regression, and ${cmp.sourceChecks.filter((c) => c.passed).map((c) => c.name).join(', ')}` : `rolled back: ${reasons.join('; ') || 'no source check confirmed the change'}`, rounds: round + 1, observationChecks: v.checks, proposalChecks, newRevision: cmp.revision, changedElements: cmp.changedElements, sourceChecks: cmp.sourceChecks, errorsAfter: cmp.errorsAfter }),
      ...(accepted ? { variant } : {}),
    }
  }
  return { decision: record({ outcome: 'DEFERRED', why: `${roundNotes.join('; ') || 'no round was run'}; the analyzer's own model stands and the question goes to the user`, rounds: Math.min(problem.limits.maxRounds, calls.length), observationChecks: lastChecks, proposalChecks: [], changedElements: [], sourceChecks: [] }) }
}
