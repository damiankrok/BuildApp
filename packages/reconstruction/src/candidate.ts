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
import { hashArtifact, round6, sha256Hex } from '@buildapp/source-common'
import { BuildingCommandSchema, applyCommand, runCommands } from '@buildapp/commands'
import type { BuildingCommand, CommandFailure } from '@buildapp/commands'
import { createEmptyModel, openingHeadRange, physicalCore, resolveWallTopology, serializeModel, wallLength } from '@buildapp/model'
import type { CanonicalBuildingModel } from '@buildapp/model'
import { ConstraintClassSchema } from './constraints.js'

export const CANDIDATE_SCHEMA = 'buildapp.reconstruction-candidate' as const
export const CANDIDATE_SCHEMA_VERSION = '1.1.0' as const
export const SUPPORTED_CANDIDATE_VERSIONS = ['1.0.0', '1.1.0'] as const

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
    /**
     * The structural layout this candidate was built from, and the verdict the
     * layout gate reached on it.
     *
     * Carried here rather than left behind because §27 makes the verdict part
     * of the candidate: a viewer may show a PARTIAL candidate for debugging,
     * and it must be able to say that is what it is showing.
     */
    structuralLayoutId: z.string().min(1),
    structuralLayoutHash: z.string().regex(/^[0-9a-f]{64}$/),
    structuralStatus: z.enum(['STRUCTURAL_LAYOUT_ACCEPTED', 'STRUCTURAL_LAYOUT_PARTIAL', 'STRUCTURAL_LAYOUT_REJECTED']),
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
    { label: 'layout', ordered: { id: draft.structuralLayoutId, hash: draft.structuralLayoutHash, status: draft.structuralStatus } },
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

// ---------------------------------------------------------------------------
// Openings fitted to their hosts: the program run once more, command by command
// ---------------------------------------------------------------------------

/**
 * Openings fitted to the walls that host them, before the candidate is sealed.
 *
 * The readers measure an opening where the drawing puts it: its printed width
 * and height, the interval the plan shows. The model has rules the drawing
 * does not state — a corner consumes the end of the wall it owns, a storey is
 * as tall as its datum says or as its convention assumes, an opening leaves
 * wall above it — and a reading can be true to the drawing and still not fit
 * the model's wall. A 2.90 m window printed on a gable end is a real window;
 * a storey taken at 2.80 m because no section datum was read cannot hold it.
 *
 * What this pass does NOT do is decide what fits. It applies the program
 * command by command and lets the model's own validator refuse; only an
 * opening refused for not fitting its host (OPENING_OUTSIDE_HOST,
 * OPENING_TOUCHES_WALL_EDGE, OPENING_IN_JUNCTION_ZONE) is changed, and only
 * by shrinking it into the wall material the model says is there. Every
 * change is returned so the caller names it as a hole; an opening that cannot
 * be kept at a useful size is dropped and named too. Any other refusal is not
 * this pass's business and is returned as the failure it is.
 */

export type OpeningFit = {
  openingId: string
  action: 'SHRUNK' | 'LOWERED' | 'DROPPED'
  code: string
  why: string
}

export type FitResult =
  /** `indexMap[i]` is where command i of the input landed in `program`, or -1 when it was dropped. */
  | { ok: true; program: BuildingCommand[]; fits: OpeningFit[]; indexMap: number[] }
  | { ok: false; program: BuildingCommand[]; fits: OpeningFit[]; indexMap: number[]; failedAt: number; command: BuildingCommand; errors: CommandFailure['errors'] }

const FIT_CODES = new Set(['OPENING_OUTSIDE_HOST', 'OPENING_TOUCHES_WALL_EDGE', 'OPENING_IN_JUNCTION_ZONE'])

/**
 * Refusals no fitting can answer (005A, Council F; disagreement 10): an opening
 * that overlaps one already cut in the same wall, whose host wall is not in the
 * model, or whose further leaves the model will not pass it through. The model
 * still refuses it — no validator is softened — and the run no longer dies of
 * one detail: the opening is not built, and the result says why.
 */
const DROP_CODES = new Set(['OPENINGS_OVERLAP', 'UNKNOWN_WALL', 'OPENING_LEAF_INVALID', 'OPENING_LEAF_LEVEL_MISMATCH', 'OPENING_LEAF_NOT_PARALLEL'])

/** Wall material an opening leaves beside it at a corner, and above it under the wall's top. */
const SIDE_MARGIN_M = 0.05
const HEAD_MARGIN_M = 0.1
const MIN_WIDTH_M = 0.4
const MIN_HEIGHT_M = 0.5

type CutOpening = Extract<BuildingCommand, { type: 'cutOpening' }>

/** The same opening, shrunk into the wall material the model says its host has. */
function fitted(model: CanonicalBuildingModel, command: CutOpening): { command: CutOpening; action: OpeningFit['action']; why: string } | { drop: string } {
  const walls = [command.wallId, ...(command.leaves ?? []).map((l) => l.wallId)]
  const offsets = [command.offset, ...(command.leaves ?? []).map((l) => l.offset)]
  const topology = resolveWallTopology(model)
  let lo = -Infinity
  let hi = Infinity
  let top = Infinity
  // One interval along the host that every leaf allows, expressed as a shift of the host's own offset.
  walls.forEach((id, i) => {
    const wall = model.walls.find((w) => w.id === id)
    if (!wall) return
    const L = wallLength(wall)
    const extent = topology.extents.get(wall.id)
    const core = extent ? physicalCore(extent) : { a0: 0, a1: L }
    const shift = offsets[i] - command.offset
    lo = Math.max(lo, Math.max(core.a0, 0) + SIDE_MARGIN_M - shift)
    hi = Math.min(hi, Math.min(core.a1, L) - SIDE_MARGIN_M - shift)
    top = Math.min(top, wall.height - HEAD_MARGIN_M)
  })
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || !Number.isFinite(top)) return { drop: 'its host wall is not in the model' }
  const a0 = Math.max(command.offset, lo)
  const a1 = Math.min(command.offset + command.width, hi)
  const width = round6(a1 - a0)
  if (width < MIN_WIDTH_M) return { drop: `the wall material its host leaves beside the corners is ${Math.max(0, hi - lo).toFixed(2)} m, too little to hold it` }
  const range = openingHeadRange(command)
  const headRoom = top - command.sill
  if (headRoom < MIN_HEIGHT_M) return { drop: `its sill at ${command.sill.toFixed(2)} m leaves ${Math.max(0, headRoom).toFixed(2)} m under the wall's top` }
  const scale = range.max > top ? headRoom / Math.max(1e-9, range.max - command.sill) : 1
  const height = round6(command.height * scale)
  const head = command.head && command.head.kind === 'RAKED' ? { ...command.head, heightFar: round6(Math.max(0.3, command.head.heightFar * scale)) } : command.head
  const shifted = round6(a0 - command.offset)
  const next: CutOpening = {
    ...command,
    offset: round6(a0),
    width,
    height: Math.max(0.3, height),
    ...(head ? { head } : {}),
    ...(command.leaves ? { leaves: command.leaves.map((l) => ({ ...l, offset: round6(l.offset + shifted) })) } : {}),
  }
  const narrowed = width < command.width - 1e-6
  const lowered = scale < 1 - 1e-9
  const why = [
    narrowed ? `narrowed from ${command.width.toFixed(2)} to ${width.toFixed(2)} m to stay within the wall material its host's corners leave` : '',
    lowered ? `its head brought down from ${range.max.toFixed(2)} to ${(command.sill + (range.max - command.sill) * scale).toFixed(2)} m to leave wall under the ${(top + HEAD_MARGIN_M).toFixed(2)} m wall top` : '',
  ]
    .filter(Boolean)
    .join('; ')
  return { command: next, action: lowered && !narrowed ? 'LOWERED' : 'SHRUNK', why: why || 'moved inside its host' }
}

/**
 * Run a program, fitting the openings its walls refuse.
 *
 * Commands that refer to a dropped opening — its window or door, its evidence
 * — are dropped with it, since they describe a thing the model does not have.
 */
export function fitOpeningsToHosts(program: readonly BuildingCommand[], label: string, modelId: string): FitResult {
  const out: BuildingCommand[] = []
  const fits: OpeningFit[] = []
  const indexMap: number[] = program.map(() => -1)
  const dropped = new Set<string>()
  let model = createEmptyModel(modelId, label)
  for (let i = 0; i < program.length; i += 1) {
    const command = program[i]
    const refers = (command.type === 'placeWindow' || command.type === 'placeDoor') && dropped.has(command.openingId)
    const describes = command.type === 'setEvidence' && dropped.has(command.targetId)
    if (refers || describes) continue
    const result = applyCommand(model, command)
    if (!result.ok && command.type === 'cutOpening' && result.errors.every((e) => FIT_CODES.has(e.code) || DROP_CODES.has(e.code))) {
      const code = result.errors[0].code
      const openingId = command.id ?? `command-${i}`
      const unanswerable = result.errors.find((e) => DROP_CODES.has(e.code))
      if (unanswerable) {
        dropped.add(openingId)
        const what =
          unanswerable.code === 'UNKNOWN_WALL'
            ? 'a wall it names is not in the model'
            : unanswerable.code === 'OPENINGS_OVERLAP'
              ? 'it overlaps an opening already cut in the same wall'
              : 'the model will not pass it through the further wall it names'
        fits.push({ openingId, action: 'DROPPED', code: unanswerable.code, why: `not built: ${what} (${unanswerable.message})` })
        continue
      }
      const fit = fitted(model, command)
      if ('drop' in fit) {
        dropped.add(openingId)
        fits.push({ openingId, action: 'DROPPED', code, why: `not built: ${fit.drop}` })
        continue
      }
      const retry = applyCommand(model, fit.command)
      if (!retry.ok) {
        dropped.add(openingId)
        fits.push({ openingId, action: 'DROPPED', code, why: `not built: even fitted, the model refuses it (${retry.errors.map((e) => e.code).join(', ')})` })
        continue
      }
      fits.push({ openingId, action: fit.action, code, why: fit.why })
      indexMap[i] = out.length
      out.push(fit.command)
      model = retry.model
      continue
    }
    if (!result.ok) return { ok: false, program: out, fits, indexMap, failedAt: i, command, errors: result.errors }
    indexMap[i] = out.length
    out.push(command)
    model = result.model
  }
  return { ok: true, program: out, fits, indexMap }
}
