/**
 * ReconstructionCandidate — a building proposal, sealed against its evidence.
 *
 * The candidate is not a model. It is the *derivation* of a model: the four
 * input hashes it was computed from, the solver that computed it, the DSL
 * program it emitted, the hash of the model that program builds, and an
 * account of everything the solver decided, guessed at, or refused to decide.
 *
 * Two properties make it worth having:
 *
 * - **It replays.** Running the program against an empty model reproduces the
 *   model byte for byte. `verifyReplay` checks exactly that, and a candidate
 *   that does not replay is not a candidate — it is a model with a story
 *   attached. Nothing may modify a candidate's model except by changing the
 *   program and re-sealing.
 * - **It is honest about its inputs.** Four hashes, all required. A candidate
 *   built from different bytes, a different observation graph, different
 *   metric evidence or a different hypothesis set is a different candidate,
 *   and the hash says so before anyone has to compare the geometry.
 *
 * `unresolved` is the part to read first. A reconstruction of a published
 * house from published drawings WILL have holes, and the honest response is to
 * name them. A candidate whose unresolved list is empty is either perfect or
 * lying, and the second is much more likely.
 */
import { z } from 'zod'
import { hashArtifact, sha256Hex } from '@buildapp/source-common'
import { BuildingCommandSchema, runCommands } from '@buildapp/commands'
import type { BuildingCommand } from '@buildapp/commands'
import { createEmptyModel, serializeModel } from '@buildapp/model'
import type { CanonicalBuildingModel } from '@buildapp/model'
import { ConstraintClassSchema } from './constraints.js'

export const CANDIDATE_SCHEMA = 'buildapp.reconstruction-candidate' as const
export const CANDIDATE_SCHEMA_VERSION = '1.0.0' as const
export const SUPPORTED_CANDIDATE_VERSIONS = ['1.0.0'] as const

/** One quantity the solver settled, and how. */
export const SolvedQuantityRecordSchema = z
  .object({
    hypothesisId: z.string().min(1),
    parameter: z.string().min(1),
    value: z.number().finite(),
    unit: z.enum(['m', 'deg', 'count', 'none']),
    class: ConstraintClassSchema,
    low: z.number().finite(),
    high: z.number().finite(),
    residual: z.number(),
    constraintIds: z.array(z.string().min(1)),
    why: z.string().min(1),
  })
  .strict()
export type SolvedQuantityRecord = z.infer<typeof SolvedQuantityRecordSchema>

/** One step of the solve, in the order it happened. The trace §13 asks for. */
export const SolverStepSchema = z
  .object({
    index: z.number().int().nonnegative(),
    stage: z.string().min(1),
    what: z.string().min(1),
    /** The method used, from the small set this solver has. */
    method: z.enum(['WEIGHTED_LEAST_SQUARES', 'INTERVAL_INTERSECTION', 'ROBUST_VOTE', 'DISCRETE_SELECTION', 'BOUNDED_SEARCH', 'DIRECT', 'REFUSED']),
    /** What it produced, and what it cost. */
    detail: z.string(),
    inputs: z.number().int().nonnegative(),
    outputs: z.number().int().nonnegative(),
    residual: z.number().optional(),
  })
  .strict()
export type SolverStep = z.infer<typeof SolverStepSchema>

/** Something the candidate does not determine. Carried through, never defaulted away. */
export const UnresolvedCandidateSchema = z
  .object({
    id: z.string().min(1),
    what: z.string().min(1),
    /** The model object that stands in for it, when one does. */
    placeholderId: z.string().min(1).optional(),
    reason: z.string().min(1),
    status: z.enum(['MISSING', 'AMBIGUOUS', 'NOT_ATTEMPTED', 'REFUSED']),
    observationIds: z.array(z.string().min(1)),
    evidenceIds: z.array(z.string().min(1)),
  })
  .strict()
export type UnresolvedCandidate = z.infer<typeof UnresolvedCandidateSchema>

/** A contradiction the candidate carries rather than resolves. */
export const CandidateContradictionSchema = z
  .object({
    id: z.string().min(1),
    hypothesisId: z.string().min(1),
    parameter: z.string().min(1),
    values: z.array(z.number().finite()),
    unit: z.enum(['m', 'deg', 'count', 'none']),
    gap: z.number().nonnegative(),
    constraintIds: z.array(z.string().min(1)),
    why: z.string().min(1),
  })
  .strict()
export type CandidateContradiction = z.infer<typeof CandidateContradictionSchema>

/** Which output primitive came from which hypothesis: the first link of the §22 trace. */
export const PrimitiveTraceSchema = z
  .object({
    objectId: z.string().min(1),
    kind: z.string().min(1),
    hypothesisId: z.string().min(1),
    evidenceIds: z.array(z.string().min(1)),
    observationIds: z.array(z.string().min(1)),
    /** Rival hypotheses this one beat, and why. */
    rejected: z.array(z.object({ hypothesisId: z.string().min(1), why: z.string().min(1) }).strict()),
    why: z.string().min(1),
  })
  .strict()
export type PrimitiveTrace = z.infer<typeof PrimitiveTraceSchema>

export const ReconstructionCandidateSchema = z
  .object({
    schema: z.literal(CANDIDATE_SCHEMA),
    schemaVersion: z.enum(SUPPORTED_CANDIDATE_VERSIONS),
    id: z.string().min(1),
    /** A short human name for the candidate. Never parsed. */
    label: z.string().min(1),
    /**
     * The id the model is built with. Part of the sealed candidate because the
     * model's own id is part of its serialization, so a replay that made one
     * up would produce different bytes and fail for a reason that has nothing
     * to do with the reconstruction.
     */
    modelId: z.string().min(1),
    sourcePackageId: z.string().min(1),
    sourcePackageHash: z.string().regex(/^[0-9a-f]{64}$/),
    observationGraphId: z.string().min(1),
    observationGraphHash: z.string().regex(/^[0-9a-f]{64}$/),
    metricEvidenceId: z.string().min(1),
    metricEvidenceHash: z.string().regex(/^[0-9a-f]{64}$/),
    hypothesisSetId: z.string().min(1),
    hypothesisSetHash: z.string().regex(/^[0-9a-f]{64}$/),
    solver: z.object({ name: z.string().min(1), version: z.string().min(1) }).strict(),
    /** The Building DSL program. Running it against an empty model builds the candidate. */
    program: z.array(BuildingCommandSchema),
    /** SHA-256 of the serialized model the program builds. */
    modelHash: z.string().regex(/^[0-9a-f]{64}$/),
    quantities: z.array(SolvedQuantityRecordSchema),
    contradictions: z.array(CandidateContradictionSchema),
    unresolved: z.array(UnresolvedCandidateSchema),
    traces: z.array(PrimitiveTraceSchema),
    steps: z.array(SolverStepSchema),
    /** How well the candidate agrees with what it was built from. */
    residuals: z
      .object({
        /** Root-mean-square of the soft constraints' residuals, in metres. */
        metricRmsM: z.number().nonnegative(),
        /** The worst single soft residual, in metres. */
        metricMaxM: z.number().nonnegative(),
        /** How many quantities were settled by each class. */
        hard: z.number().int().nonnegative(),
        soft: z.number().int().nonnegative(),
        unresolved: z.number().int().nonnegative(),
      })
      .strict(),
    contentHash: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict()
/**
 * The program is typed as the DSL's INPUT commands, not its parsed output.
 *
 * A command schema fills in defaults on parse — a wall's `kind`, a ring's
 * `cornerOwnership`, an opening's `head`. The program a candidate carries is
 * the one an author wrote and the one `runCommands` takes, so it is the input
 * shape; parsing it here as well would mean the sealed program and the
 * replayed program were different objects that happened to build the same
 * model, which is exactly the drift `verifyReplay` exists to rule out.
 */
export type ReconstructionCandidate = Omit<z.infer<typeof ReconstructionCandidateSchema>, 'program'> & { program: BuildingCommand[] }

export type CandidateDraft = Omit<ReconstructionCandidate, 'id' | 'contentHash' | 'modelHash'>

/**
 * Build the model a candidate's program describes.
 *
 * This is the ONLY way a candidate becomes geometry. There is no second path
 * that constructs the model directly and attaches a program afterwards,
 * because a program that is written down but never run is a program that
 * drifts from what it claims to describe.
 */
export function buildCandidateModel(program: readonly BuildingCommand[], label: string, modelId: string): CanonicalBuildingModel {
  return runCommands(createEmptyModel(modelId, label), program)
}

/** Seal a draft: run its program, hash the model it builds, and derive the candidate's own id. */
export function sealCandidate(draft: CandidateDraft, slug: string): { candidate: ReconstructionCandidate; model: CanonicalBuildingModel } {
  const model = buildCandidateModel(draft.program, draft.label, draft.modelId)
  const modelHash = sha256Hex(serializeModel(model))
  const withModel = { ...draft, modelHash }
  const contentHash = candidateContentHash(withModel)
  return { candidate: { ...withModel, id: `candidate-${slug}-${contentHash.slice(0, 16)}`, contentHash }, model }
}

/**
 * The candidate's content hash.
 *
 * HASHED: every input by id and hash, the solver's name and version, the
 * program verbatim, the model hash, every solved quantity, every
 * contradiction, every named hole, and every trace's links.
 *
 * NOT HASHED: prose — a step's `detail`, a trace's `why`, a hole's `reason`.
 * Rewording an explanation is not a different reconstruction. The solver
 * STEPS are hashed by their method and their counts for the same reason: what
 * the solver did is part of the result, how it narrated it is not.
 */
export function candidateContentHash(draft: Omit<ReconstructionCandidate, 'id' | 'contentHash'>): string {
  return hashArtifact(CANDIDATE_SCHEMA, CANDIDATE_SCHEMA_VERSION, [
    { label: 'package', ordered: { id: draft.sourcePackageId, hash: draft.sourcePackageHash } },
    { label: 'observations', ordered: { id: draft.observationGraphId, hash: draft.observationGraphHash } },
    { label: 'metrics', ordered: { id: draft.metricEvidenceId, hash: draft.metricEvidenceHash } },
    { label: 'hypotheses', ordered: { id: draft.hypothesisSetId, hash: draft.hypothesisSetHash } },
    { label: 'solver', ordered: draft.solver },
    { label: 'model-id', ordered: { id: draft.modelId, label: draft.label } },
    { label: 'program', ordered: draft.program },
    { label: 'model', ordered: draft.modelHash },
    { label: 'quantities', unordered: draft.quantities.map((q) => ({ hypothesisId: q.hypothesisId, parameter: q.parameter, value: q.value, unit: q.unit, class: q.class, low: q.low, high: q.high, residual: q.residual })) },
    { label: 'contradictions', unordered: draft.contradictions.map((c) => ({ hypothesisId: c.hypothesisId, parameter: c.parameter, values: c.values, unit: c.unit, gap: c.gap })) },
    { label: 'unresolved', unordered: draft.unresolved.map((u) => ({ what: u.what, status: u.status, placeholderId: u.placeholderId ?? null })) },
    { label: 'traces', unordered: draft.traces.map((t) => ({ objectId: t.objectId, kind: t.kind, hypothesisId: t.hypothesisId, evidenceIds: [...t.evidenceIds].sort(), observationIds: [...t.observationIds].sort() })) },
    { label: 'steps', ordered: draft.steps.map((s) => ({ index: s.index, stage: s.stage, method: s.method, inputs: s.inputs, outputs: s.outputs })) },
    { label: 'residuals', ordered: draft.residuals },
  ])
}

export type ReplayResult = { ok: true; model: CanonicalBuildingModel } | { ok: false; reason: string; expected: string; actual?: string }

/**
 * Replay a candidate and check the model comes back byte for byte.
 *
 * This is the property the whole stage rests on: the program IS the model, and
 * the model is not something that can be edited behind the program's back.
 */
export function verifyReplay(candidate: ReconstructionCandidate): ReplayResult {
  let model: CanonicalBuildingModel
  try {
    model = buildCandidateModel(candidate.program, candidate.label, candidate.modelId)
  } catch (error) {
    return { ok: false, reason: `the program did not run: ${error instanceof Error ? error.message : String(error)}`, expected: candidate.modelHash }
  }
  const actual = sha256Hex(serializeModel(model))
  if (actual !== candidate.modelHash) return { ok: false, reason: 'the program built a different model than the candidate was sealed with', expected: candidate.modelHash, actual }
  return { ok: true, model }
}
