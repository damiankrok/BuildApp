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
import { BuildingCommandSchema, applyCommand, applyCommands, runCommands } from '@buildapp/commands'
import type { BuildingCommand, CommandFailure } from '@buildapp/commands'
import { createEmptyModel, openingHeadRange, physicalCore, resolveWallTopology, serializeModel, wallLength } from '@buildapp/model'
import type { CanonicalBuildingModel } from '@buildapp/model'
import { ConstraintClassSchema } from './constraints.js'
import { classifyWallConflict, createdIdOf, frameOf, moveRingEdge, openRingWithout, proposeWallRepair, rewriteReferences, ringWallLines, startShiftAlong, wallLineOf } from './v2/wall-reconciliation.js'
import type { ReconciledReferences, WallConflict, WallConflictRelation, WallLine, WallRepairAction } from './v2/wall-reconciliation.js'

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

/** Does a whole program apply to an empty model? How a fitter that edits a program checks the edit without keeping the model. */
export function programApplies(program: readonly BuildingCommand[], label: string, modelId: string): boolean {
  return applyCommands(createEmptyModel(modelId, label), program).failedAt === undefined
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

// ---------------------------------------------------------------------------
// 005Y-N7 (A): walls the model refuses as overlapping, reconciled within the reading's uncertainty
// ---------------------------------------------------------------------------

/** One wall the model refused as overlapping another, and what was done about it. */
export type WallReconciliationRecord = {
  kind: 'GEOMETRY_RECONCILIATION'
  /** The program command that stated the wall. */
  commandIndex: number
  wallId: string
  otherWallId: string
  relation: WallConflictRelation
  action: WallRepairAction | 'EDGE_MOVED' | 'RING_OPENED'
  /** Plan area the model measured the two walls sharing, m². */
  overlapAreaM2: number
  penetrationM: number
  /** How far the wall (or the ring edge) moved, m. */
  moveM: number
  toleranceM: number
  withinUncertainty: boolean
  before: { start: { x: number; z: number }; end: { x: number; z: number } }
  after?: { start: { x: number; z: number }; end: { x: number; z: number } }
  why: string
}

/** A command left out because something it needs was left out. */
export type ReconciliationDependent = { commandIndex: number; type: string; id?: string; why: string }

export type WallReconcileResult =
  | { ok: true; program: BuildingCommand[]; indexMap: number[]; records: WallReconciliationRecord[]; dependents: ReconciliationDependent[] }
  | { ok: false; program: BuildingCommand[]; indexMap: number[]; records: WallReconciliationRecord[]; dependents: ReconciliationDependent[]; failedAt: number; command: BuildingCommand; errors: CommandFailure['errors']; refusal?: WallReconciliationRecord }

/** Repairs one program command may take before it is given up on. */
export const RECONCILE_MAX_ROUNDS = 6

const OVERLAP_PAIR = /walls (\S+) and (\S+) share ([0-9.]+) m²/

type OverlapPair = { a: string; b: string; area: number }

/** The wall pairs a refusal names, when overlap is all it refuses. */
function overlapPairsOf(errors: CommandFailure['errors']): OverlapPair[] | null {
  if (errors.length === 0 || !errors.every((e) => e.code === 'WALLS_OVERLAP')) return null
  const pairs: OverlapPair[] = []
  for (const e of errors) {
    const m = OVERLAP_PAIR.exec(e.message)
    if (!m) return null
    pairs.push({ a: m[1], b: m[2], area: Number(m[3]) })
  }
  return pairs.sort((p, q) => q.area - p.area || p.a.localeCompare(q.a) || p.b.localeCompare(q.b))
}

const wallLineIn = (model: CanonicalBuildingModel, id: string): WallLine | undefined => {
  const w = model.walls.find((x) => x.id === id)
  return w ? { id: w.id, start: w.start, end: w.end, thickness: w.thickness, kind: w.kind } : undefined
}

type RepairStep = {
  commands: BuildingCommand[]
  record: WallReconciliationRecord
  omitted: string[]
  startShift: Array<[string, number]>
  openedRing?: { id: string; wallIds: string[] }
  /** A wall left out as another's band: its openings go to that wall. */
  retarget?: { from: WallLine; to: WallLine }
  refused: boolean
}

const baseRecord = (i: number, n: WallLine, e: WallLine, pair: OverlapPair, c: WallConflict, toleranceM: number): Omit<WallReconciliationRecord, 'action' | 'moveM' | 'withinUncertainty' | 'why'> => ({
  kind: 'GEOMETRY_RECONCILIATION',
  commandIndex: i,
  wallId: n.id,
  otherWallId: e.id,
  relation: c.relation,
  overlapAreaM2: pair.area,
  penetrationM: c.penetrationM,
  toleranceM,
  before: { start: n.start, end: n.end },
})

/** A createWall the model refused: the largest overlap first, the wall moved, trimmed, left out or refused. */
function repairWall(model: CanonicalBuildingModel, command: Extract<BuildingCommand, { type: 'createWall' }>, pairs: OverlapPair[], toleranceM: number, i: number): RepairStep | null {
  const n = wallLineOf(command)
  const pair = pairs.find((p) => p.a === n.id || p.b === n.id)
  const e = pair && wallLineIn(model, pair.a === n.id ? pair.b : pair.a)
  if (!pair || !e) return null
  const conflict = classifyWallConflict(n, e, toleranceM)
  const repair = proposeWallRepair(n, e, conflict, toleranceM)
  const record: WallReconciliationRecord = { ...baseRecord(i, n, e, pair, conflict, toleranceM), action: repair.action, moveM: round6(repair.moveM ?? 0), withinUncertainty: repair.withinUncertainty, why: repair.why }
  if ('wall' in repair) {
    record.after = { start: repair.wall.start, end: repair.wall.end }
    return { commands: [{ ...command, start: repair.wall.start, end: repair.wall.end }], record, omitted: [], startShift: [[n.id, startShiftAlong(n, repair.wall)]], refused: false }
  }
  if (repair.action === 'REFUSED') return { commands: [], record, omitted: [], startShift: [], refused: true }
  return { commands: [], record, omitted: [n.id], startShift: [], ...(repair.action === 'DUPLICATE_OMITTED' ? { retarget: { from: n, to: e } } : {}), refused: false }
}

/**
 * A ring the model refused. Only an edge parallel to the wall it overlaps is ever moved: within the tolerance, the
 * edge (both its corners) goes onto that wall's face; an edge that IS that wall's band is left to it and the ring
 * opens into separate walls. A ring that would have to bend is refused.
 */
function repairRing(model: CanonicalBuildingModel, command: Extract<BuildingCommand, { type: 'createWallRing' }>, pairs: OverlapPair[], toleranceM: number, i: number): RepairStep | null {
  const ringId = command.id
  if (!ringId) return null
  const { lines, reversed } = ringWallLines(command, ringId)
  const candidates = pairs.flatMap((pair) => {
    const k = lines.findIndex((l) => l.id === pair.a || l.id === pair.b)
    const e = k >= 0 ? wallLineIn(model, lines[k].id === pair.a ? pair.b : pair.a) : undefined
    return e ? [{ pair, k, e, conflict: classifyWallConflict(lines[k], e, toleranceM) }] : []
  })
  if (candidates.length === 0) return null
  // a crossing is never moved away; otherwise the edge that moves least, then an edge that is wholly another's band
  const movable = (c: (typeof candidates)[number]) => c.conflict.relation === 'PARALLEL_OVERLAP' && c.conflict.shiftM !== undefined && Math.abs(c.conflict.shiftM) <= toleranceM
  const wholeBand = (c: (typeof candidates)[number]) => {
    const along = c.conflict.alongOverlap
    const L = Math.hypot(lines[c.k].end.x - lines[c.k].start.x, lines[c.k].end.z - lines[c.k].start.z)
    return c.conflict.relation === 'COINCIDENT_BAND' && !!along && along.from <= toleranceM && along.to >= L - toleranceM
  }
  const chosen = candidates.find((c) => c.conflict.relation === 'CROSSING') ?? candidates.find(movable) ?? candidates.find(wholeBand) ?? candidates[0]
  const { pair, k, e, conflict } = chosen
  const n = lines[k]
  const base = baseRecord(i, n, e, pair, conflict, toleranceM)
  if (conflict.relation === 'PARALLEL_OVERLAP' && conflict.shiftM !== undefined && Math.abs(conflict.shiftM) <= toleranceM) {
    const polygon = moveRingEdge(command.polygon, reversed, k, frameOf(e).inward, conflict.shiftM)
    const moved = ringWallLines({ ...command, polygon }, ringId).lines
    const record: WallReconciliationRecord = { ...base, action: 'EDGE_MOVED', moveM: round6(Math.abs(conflict.shiftM)), withinUncertainty: true, after: { start: moved[k].start, end: moved[k].end }, why: `${conflict.why}; the ring's edge moved onto the face of ${e.id}, within the plan's ${(toleranceM * 100).toFixed(1)} cm uncertainty` }
    return { commands: [{ ...command, polygon }], record, omitted: [], startShift: lines.map((l, j) => [l.id, startShiftAlong(l, moved[j])] as [string, number]).filter(([, s]) => s !== 0), refused: false }
  }
  if (wholeBand(chosen)) {
    const open = openRingWithout(command, ringId, k)
    const record: WallReconciliationRecord = { ...base, action: 'RING_OPENED', moveM: 0, withinUncertainty: true, why: `${conflict.why}: one wall stands there, ${e.id}; the ring's other ${open.walls.length} walls stand on their own and meet it` }
    return { commands: open.walls, record, omitted: [n.id], startShift: [], openedRing: { id: ringId, wallIds: open.keptIds }, retarget: { from: n, to: e }, refused: false }
  }
  const record: WallReconciliationRecord = { ...base, action: 'REFUSED', moveM: conflict.penetrationM, withinUncertainty: false, why: `${conflict.why}; an exterior ring is not bent to fit` }
  return { commands: [], record, omitted: [], startShift: [], refused: true }
}

/**
 * Run a program into a model, reconciling each wall the model refuses as overlapping another: the weaker wall moved
 * onto the stronger's face within `toleranceM`, an interior wall that cannot be placed left out and named, an exterior
 * one refused with the pair named. Every repair is a record; nothing is validated less. A program with no overlap
 * comes back unchanged.
 */
export function reconcileWallOverlaps(program: readonly BuildingCommand[], label: string, modelId: string, options: { toleranceM: number }): WallReconcileResult {
  const out: BuildingCommand[] = []
  const indexMap: number[] = program.map(() => -1)
  const records: WallReconciliationRecord[] = []
  const dependents: ReconciliationDependent[] = []
  const refs: ReconciledReferences = { omitted: new Set(), startShift: new Map(), openedRings: new Map(), retarget: new Map() }
  let model = createEmptyModel(modelId, label)
  for (let i = 0; i < program.length; i += 1) {
    const pending = rewriteReferences(program[i], refs)
    if (pending.length === 0) {
      const id = createdIdOf(program[i])
      if (id) refs.omitted.add(id)
      dependents.push({ commandIndex: i, type: program[i].type, ...(id ? { id } : {}), why: 'it needs a wall, or a part of one, that was left out' })
      continue
    }
    let rounds = 0
    while (pending.length > 0) {
      const command = pending.shift() as BuildingCommand
      const result = applyCommand(model, command)
      if (result.ok) {
        if (indexMap[i] < 0) indexMap[i] = out.length
        out.push(command)
        model = result.model
        continue
      }
      const isWall = command.type === 'createWall' || command.type === 'createWallRing'
      if (!isWall) {
        // Only walls are reconciled here. Anything else the model refuses — an opening a trim left touching its wall's
        // end, the door in it — goes on unapplied to the opening fit, which runs the whole program again and decides.
        if (indexMap[i] < 0) indexMap[i] = out.length
        out.push(command)
        continue
      }
      const pairs = overlapPairsOf(result.errors)
      const step = pairs && rounds < RECONCILE_MAX_ROUNDS ? (command.type === 'createWall' ? repairWall(model, command, pairs, options.toleranceM, i) : command.type === 'createWallRing' ? repairRing(model, command, pairs, options.toleranceM, i) : null) : null
      if (!step) return { ok: false, program: out, indexMap, records, dependents, failedAt: i, command, errors: result.errors }
      rounds += 1
      records.push(step.record)
      if (step.refused) return { ok: false, program: out, indexMap, records, dependents, failedAt: i, command, errors: result.errors, refusal: step.record }
      for (const id of step.omitted) refs.omitted.add(id)
      for (const [id, s] of step.startShift) refs.startShift.set(id, round6((refs.startShift.get(id) ?? 0) + s))
      if (step.openedRing) refs.openedRings.set(step.openedRing.id, step.openedRing.wallIds)
      if (step.retarget) refs.retarget.set(step.retarget.from.id, step.retarget)
      pending.unshift(...step.commands)
    }
  }
  return { ok: true, program: out, indexMap, records, dependents }
}

// ---------------------------------------------------------------------------
// N7-P1: the last valid model when a later object fails
// ---------------------------------------------------------------------------

/**
 * A model the validator refuses at one command used to be no model at all: one sliver of an attached body read
 * narrower than its two walls (`WALLS_OVERLAP` between the ring's own east and west walls) threw away the main body,
 * its floors and every wall already accepted before it. The validator is right to refuse the sliver. What it refuses
 * is that one object.
 *
 * So a refused command is taken out ATOMICALLY with what it is part of and what needs it, and the program is fitted
 * again: nothing already accepted is changed, nothing is validated less, and every command left out is named with
 * the failure that took it out. The BASE — the building, its levels and the main body's lowest floor and walls — is
 * the checkpoint: a failure inside it is not cut around (`cutFailedObject` answers null), because a preview without
 * the main body's walls is not a preview of this house.
 */
const HEADER_TYPES = new Set(['setModelName', 'createBuilding', 'defineMaterial', 'createLevel'])
/** A body's floor or walls on one storey, as `emit.ts` names them: `slab-<mass>-<storey>`, `ring-<mass>-<storey>`. */
const BODY_COMMAND_ID = /^(slab|ring)-(.+?)-(-?\d+)$/

/** At most this many objects are cut out of one program before the run gives up and refuses as before. */
export const PREVIEW_MAX_CUTS = 12

export type PreviewFailure = {
  /** Where the refused command stood in the program the solver emitted. */
  commandIndex: number
  type: string
  id?: string
  codes: string[]
  /** The validator's own sentence, which names walls and metres. */
  message: string
  objectIds: string[]
}

export type PreviewSkipped = {
  /** Where the command stood in the program the solver emitted. */
  commandIndex: number
  type: string
  id?: string
  /** FAILED: the refused command; SAME_BODY: part of the body it was part of; DEPENDENT: needed something left out; NOT_IN_MINIMAL_PREVIEW: outside the base. */
  cause: 'FAILED' | 'SAME_BODY' | 'DEPENDENT' | 'NOT_IN_MINIMAL_PREVIEW'
  why: string
}

export type PreviewCut = {
  program: BuildingCommand[]
  /** `kept[i]` is where input command i landed in `program`, or -1 when it was left out. */
  kept: number[]
  skipped: PreviewSkipped[]
}

const bodyOf = (command: BuildingCommand): { mass: string; storey: number } | undefined => {
  if (command.type !== 'createSlab' && command.type !== 'createWallRing') return undefined
  const m = BODY_COMMAND_ID.exec(createdIdOf(command) ?? '')
  return m ? { mass: m[2], storey: Number(m[3]) } : undefined
}

/** The ids a command creates: a ring creates its walls too. */
const createdIdsOf = (command: BuildingCommand): string[] => {
  const id = createdIdOf(command)
  if (!id) return []
  return command.type === 'createWallRing' ? [id, ...command.polygon.map((_, k) => `${id}-w${k}`)] : [id]
}

/** Is this command part of the base a preview cannot stand without: the header, the levels, the main body's floors and walls? */
export function isPreviewBase(command: BuildingCommand, mainMassId: string): boolean {
  if (HEADER_TYPES.has(command.type)) return true
  return bodyOf(command)?.mass === mainMassId
}

/** The lowest storey the main body has a floor or walls on, in this program. */
const lowestMainStorey = (program: readonly BuildingCommand[], mainMassId: string): number | undefined => {
  const storeys = program.map(bodyOf).filter((b): b is { mass: string; storey: number } => b?.mass === mainMassId).map((b) => b.storey)
  return storeys.length > 0 ? Math.min(...storeys) : undefined
}

/**
 * The program without the object command `failedAt` creates: a body's floor or walls take the rest of that body with
 * them (an attached body's every storey and its roof; the main body's storeys from that one up), anything else goes
 * alone; then every later command that names something left out goes too. Null when the failure is in the base.
 */
export function cutFailedObject(program: readonly BuildingCommand[], failedAt: number, mainMassId: string, failure: string): PreviewCut | null {
  const failed = program[failedAt]
  if (!failed || HEADER_TYPES.has(failed.type)) return null
  const body = bodyOf(failed)
  const group = new Set<number>([failedAt])
  if (body && body.mass === mainMassId) {
    const lowest = lowestMainStorey(program, mainMassId)
    if (lowest === undefined || body.storey <= lowest) return null
    program.forEach((c, i) => {
      const b = bodyOf(c)
      if (b && b.mass === mainMassId && b.storey >= body.storey) group.add(i)
    })
  } else if (body) {
    const m = body.mass
    program.forEach((c, i) => {
      const id = createdIdOf(c)
      if (id && (id.startsWith(`slab-${m}-`) || id.startsWith(`ring-${m}-`) || id === `roof-${m}` || id.startsWith(`roof-${m}-`) || id.startsWith(`${m}-`))) group.add(i)
    })
  }
  const named = (i: number): { type: string; id?: string } => {
    const id = createdIdOf(program[i])
    return { type: program[i].type, ...(id ? { id } : {}) }
  }
  // A body's walls can carry an exterior wall no id ties to it — a return of a recess that ran along its face. Once
  // the body is out, such a wall meets no wall that stands: it goes too, named, and the pass runs again without it.
  const leaning = new Map<number, string>()
  for (let round = 0; round < 4; round += 1) {
    const refs: ReconciledReferences = { omitted: new Set(), startShift: new Map(), openedRings: new Map(), retarget: new Map() }
    for (const i of [...group, ...leaning.keys()]) for (const id of createdIdsOf(program[i])) refs.omitted.add(id)
    const out: BuildingCommand[] = []
    const kept: number[] = program.map(() => -1)
    const skipped: PreviewSkipped[] = []
    program.forEach((c, i) => {
      if (group.has(i)) {
        skipped.push({ commandIndex: i, ...named(i), cause: i === failedAt ? 'FAILED' : 'SAME_BODY', why: i === failedAt ? failure : `part of the body ${body?.mass} whose ${failed.type} the model refused` })
        return
      }
      const lean = leaning.get(i)
      if (lean) {
        skipped.push({ commandIndex: i, ...named(i), cause: 'DEPENDENT', why: lean })
        return
      }
      const rewritten = rewriteReferences(c, refs)
      if (rewritten.length !== 1) {
        for (const id of createdIdsOf(c)) refs.omitted.add(id)
        skipped.push({ commandIndex: i, ...named(i), cause: 'DEPENDENT', why: 'it needs an object left out of this preview' })
        return
      }
      kept[i] = out.length
      out.push(rewritten[0])
    })
    const before = leaning.size
    if (body) for (const [i, why] of freeStandingExteriorWalls(program, kept, out)) leaning.set(i, why)
    if (leaning.size === before) return { program: out, kept, skipped }
  }
  return null
}

/** Segment-to-point distance in plan. */
const distanceToSegment = (p: { x: number; z: number }, a: { x: number; z: number }, b: { x: number; z: number }): number => {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const L2 = dx * dx + dz * dz
  const t = L2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / L2)) : 0
  return Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz))
}

/**
 * The exterior walls of a cut program (`createWall`, a recess's returns) neither end of which meets a wall still
 * standing on its level — within the thicker wall's thickness: what stood against a body that was cut out.
 */
function freeStandingExteriorWalls(program: readonly BuildingCommand[], kept: readonly number[], out: readonly BuildingCommand[]): Array<[number, string]> {
  const linesOf = (commands: readonly BuildingCommand[]): Array<WallLine & { levelId: string }> => {
    const lines: Array<WallLine & { levelId: string }> = []
    for (const c of commands) {
      if (c.type === 'createWallRing' && c.id) lines.push(...ringWallLines(c, c.id).lines.map((l) => ({ ...l, levelId: c.levelId })))
      else if (c.type === 'createWall' && c.id) lines.push({ ...wallLineOf(c), levelId: c.levelId })
    }
    return lines
  }
  const standing = linesOf(out)
  const emitted = linesOf(program)
  const found: Array<[number, string]> = []
  program.forEach((c, i) => {
    if (kept[i] < 0 || c.type !== 'createWall' || (c.kind ?? 'EXTERIOR') !== 'EXTERIOR' || !c.id) return
    const self = wallLineOf(c)
    const meets = (lines: typeof standing, p: { x: number; z: number }): boolean => lines.some((l) => l.id !== self.id && l.levelId === c.levelId && distanceToSegment(p, l.start, l.end) <= Math.max(l.thickness, self.thickness) + 0.01)
    // only a wall the cut left standing alone: one the drawings show free-standing stays as they show it
    const metBefore = meets(emitted, self.start) || meets(emitted, self.end)
    if (metBefore && !meets(standing, self.start) && !meets(standing, self.end)) found.push([i, 'it stood against the body left out of this preview: no wall that stands meets either of its ends'])
  })
  return found
}

/**
 * The smallest preview the source still supports when the base itself is refused with what stands on it: the header,
 * the levels and the main body's floors and walls alone, the walls at their storey's height instead of following roof
 * planes that are not built. Null when even that is refused: then there is no preview to give, and none is made up.
 */
export function minimalPreviewProgram(program: readonly BuildingCommand[], mainMassId: string, label: string, modelId: string): PreviewCut | null {
  const heightOf = new Map<string, number>()
  for (const c of program) if (c.type === 'createLevel' && c.id && c.height !== undefined) heightOf.set(c.id, c.height)
  const out: BuildingCommand[] = []
  const kept: number[] = program.map(() => -1)
  const skipped: PreviewSkipped[] = []
  program.forEach((c, i) => {
    if (!isPreviewBase(c, mainMassId)) {
      const id = createdIdOf(c)
      skipped.push({ commandIndex: i, type: c.type, ...(id ? { id } : {}), cause: 'NOT_IN_MINIMAL_PREVIEW', why: 'not part of the main body’s floors and walls, which are all this preview could build' })
      return
    }
    kept[i] = out.length
    if (c.type === 'createWallRing' && c.topProfile) {
      const { topProfile: _roof, ...walls } = c
      out.push({ ...walls, height: heightOf.get(c.levelId) ?? c.height })
    } else out.push(c)
  })
  if (!out.some((c) => c.type === 'createWallRing')) return null
  return programApplies(out, label, modelId) ? { program: out, kept, skipped } : null
}

/** The model the base of a program builds: its prefix up to the main body's last floor or walls, and that model's hash. */
export function previewCheckpoint(program: readonly BuildingCommand[], mainMassId: string, label: string, modelId: string): { commands: number; modelSha256: string; wallRings: string[]; slabs: string[] } | undefined {
  let last = -1
  program.forEach((c, i) => {
    if (bodyOf(c)?.mass === mainMassId) last = i
  })
  if (last < 0) return undefined
  const prefix = program.slice(0, last + 1)
  const applied = applyCommands(createEmptyModel(modelId, label), prefix)
  if (applied.failedAt !== undefined) return undefined
  return { commands: prefix.length, modelSha256: sha256Hex(serializeModel(applied.model)), wallRings: applied.model.wallRings.map((r) => r.id), slabs: applied.model.slabs.map((s) => s.id) }
}

export type PreviewFit = {
  /** The fit of the program that is built: the whole program, or what is left of it after the cuts. */
  fit: FitResult
  reconciled?: WallReconcileResult
  /**
   * N7-FIX-01 (Council D-1): every wall reconciliation of every attempt, in the input program's numbering — the first
   * attempt's too. `reconciled` is the last attempt's alone: a ring edge moved on the first attempt and refused after
   * it would otherwise leave no trace that the geometry the validator refused is not the geometry the emitter wrote.
   */
  reconciliationHistory: Array<{ attempt: number; record: WallReconciliationRecord }>
  /** Every refusal, in the order met; empty when the whole program was built. */
  failures: PreviewFailure[]
  skipped: PreviewSkipped[]
  basis: 'CHECKPOINT' | 'MINIMAL_BASE'
}

/**
 * Fit a program into a model; when the model refuses a command after the base, take that object out
 * (`cutFailedObject`) and fit what is left, up to `PREVIEW_MAX_CUTS` times; when it refuses the base, keep at most the
 * main body's floors and walls (`minimalPreviewProgram`). `fit.indexMap` is always in the input program's numbering.
 * When no preview can be built, the first refusal comes back exactly as the plain fit returned it.
 */
export function fitPreviewProgram(program: BuildingCommand[], options: { label: string; modelId: string; mainMassId: string; toleranceM: number }): PreviewFit {
  const { label, modelId, mainMassId, toleranceM } = options
  const attemptFit = (prog: BuildingCommand[]): { fit: FitResult; reconciled?: WallReconcileResult; failedInput?: number } => {
    const firstFit = fitOpeningsToHosts(prog, label, modelId)
    const reconciled = !firstFit.ok && firstFit.errors.every((e) => e.code === 'WALLS_OVERLAP') ? reconcileWallOverlaps(prog, label, modelId, { toleranceM }) : undefined
    const refit = reconciled?.ok ? fitOpeningsToHosts(reconciled.program, label, modelId) : undefined
    const fit: FitResult = reconciled && refit ? { ...refit, indexMap: reconciled.indexMap.map((k) => (k >= 0 ? refit.indexMap[k] : -1)) } : reconciled && !reconciled.ok ? { ...firstFit, ...reconciled, fits: [] } : firstFit
    if (fit.ok) return { fit, ...(reconciled ? { reconciled } : {}) }
    // where the refused command stood in `prog`: a refit refuses in the reconciled program's own numbering
    const failedInput = reconciled && refit ? reconciled.indexMap.reduce((best, k, i) => (k >= 0 && k <= fit.failedAt ? i : best), -1) : fit.failedAt
    return { fit, ...(reconciled ? { reconciled } : {}), failedInput }
  }
  const first = attemptFit(program)
  let attempt = first
  let current = program
  /** origin[k]: the input command that command k of `current` is */
  let origin = program.map((_, i) => i)
  const failures: PreviewFailure[] = []
  const skipped: PreviewSkipped[] = []
  let basis: PreviewFit['basis'] = 'CHECKPOINT'
  const reconciliationHistory: PreviewFit['reconciliationHistory'] = []
  const remember = (a: typeof attempt, n: number): void => {
    for (const r of a.reconciled?.records ?? []) reconciliationHistory.push({ attempt: n, record: { ...r, commandIndex: origin[r.commandIndex] ?? -1 } })
  }
  remember(first, 0)
  while (!attempt.fit.ok && failures.length < PREVIEW_MAX_CUTS) {
    const at = attempt.failedInput ?? -1
    const refused = attempt.fit
    const failure: PreviewFailure = {
      commandIndex: origin[at] ?? -1,
      type: refused.command.type,
      ...('id' in refused.command && typeof refused.command.id === 'string' ? { id: refused.command.id } : {}),
      codes: [...new Set(refused.errors.map((e) => e.code))],
      message: (refused.errors[0]?.message ?? '').slice(0, 300),
      objectIds: [...new Set(refused.errors.map((e) => e.objectId).filter((id): id is string => typeof id === 'string'))],
    }
    const why = `the model refused it: ${failure.codes.join(', ')}${failure.message ? ` (${failure.message})` : ''}`
    let cut = at >= 0 ? cutFailedObject(current, at, mainMassId, why) : null
    if (!cut) {
      cut = minimalPreviewProgram(current, mainMassId, label, modelId)
      if (!cut) break
      basis = 'MINIMAL_BASE'
    }
    failures.push(failure)
    for (const sk of cut.skipped) skipped.push({ ...sk, commandIndex: origin[sk.commandIndex] ?? -1 })
    const next: number[] = cut.program.map(() => -1)
    cut.kept.forEach((k, i) => {
      if (k >= 0) next[k] = origin[i]
    })
    origin = next
    current = cut.program
    attempt = attemptFit(current)
    remember(attempt, failures.length)
    if (basis === 'MINIMAL_BASE') break
  }
  if (failures.length === 0) return { fit: first.fit, ...(first.reconciled ? { reconciled: first.reconciled } : {}), reconciliationHistory, failures, skipped, basis }
  // no preview could be built — or what is left has no main body walls to show: the run refuses exactly as the plain
  // fit would have
  const mainWalls = current.some((c) => c.type === 'createWallRing' && bodyOf(c)?.mass === mainMassId)
  if (!attempt.fit.ok || !mainWalls) return { fit: first.fit, ...(first.reconciled ? { reconciled: first.reconciled } : {}), reconciliationHistory, failures: [], skipped: [], basis }
  const keptAt = new Map(origin.map((o, k) => [o, k]))
  const fitIndex = attempt.fit.indexMap
  return {
    fit: { ...attempt.fit, indexMap: program.map((_, i) => (keptAt.has(i) ? (fitIndex[keptAt.get(i) as number] ?? -1) : -1)) },
    ...(attempt.reconciled ? { reconciled: attempt.reconciled } : {}),
    reconciliationHistory,
    failures,
    skipped,
    basis,
  }
}
