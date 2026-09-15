/**
 * The sealed candidates, as data.
 *
 * A candidate is produced once, by the solver, and written out. Everything
 * downstream — BuildWorld's model selector, the mobile scene exporter, the
 * evaluation script — reads THIS, replays the program it carries, and gets the
 * same model. Nothing downstream runs a solver of its own.
 *
 * That matters more than it sounds. A viewer that re-derived the building
 * would show whatever its copy of the solver produced today, which is not
 * necessarily what was evaluated, screenshotted or shipped in an APK; the
 * hashes would still all agree with each other and none of them would mean
 * anything. Replaying a sealed program makes the thing on the screen the thing
 * that was measured.
 */
import { ReconstructionCandidateSchema, buildCandidateModel, verifyReplay } from '@buildapp/reconstruction'
import type { ReconstructionCandidate } from '@buildapp/reconstruction'
import type { CanonicalBuildingModel } from '@buildapp/model'
import marcowkiAuto from './marcowki-auto.json' with { type: 'json' }

export type SealedCandidate = {
  /** A short, stable id used by selectors and scene bundles. */
  id: string
  label: string
  candidate: ReconstructionCandidate
}

/** Every candidate committed to the repository, in a fixed order. */
export const SEALED_CANDIDATES: readonly SealedCandidate[] = [{ id: 'marcowki-auto', label: 'Marcówki (auto)', candidate: marcowkiAuto as unknown as ReconstructionCandidate }]

export const sealedCandidate = (id: string): SealedCandidate | undefined => SEALED_CANDIDATES.find((c) => c.id === id)

/**
 * Build a sealed candidate's model by replaying its own program.
 *
 * The replay is CHECKED, not assumed: if the program no longer builds the
 * model the candidate was sealed with — because a command's defaults changed,
 * or a validator grew stricter — this throws rather than quietly showing a
 * different building under the same hash.
 */
export function modelOf(id: string): CanonicalBuildingModel {
  const sealed = sealedCandidate(id)
  if (!sealed) throw new Error(`no sealed candidate called ${id}`)
  const parsed = ReconstructionCandidateSchema.safeParse(sealed.candidate)
  if (!parsed.success) throw new Error(`the sealed candidate ${id} does not validate: ${parsed.error.issues[0]?.message ?? 'unknown'}`)
  const replay = verifyReplay(sealed.candidate)
  if (!replay.ok) throw new Error(`the sealed candidate ${id} no longer replays: ${replay.reason}`)
  return replay.model
}

/** The same, without the replay check, for a caller that has already verified it. */
export const modelOfUnchecked = (sealed: SealedCandidate): CanonicalBuildingModel => buildCandidateModel(sealed.candidate.program, sealed.candidate.label, sealed.candidate.modelId)

/** What a viewer should show about a candidate beside the geometry it draws. */
export type CandidateStatus = {
  id: string
  label: string
  candidateHash: string
  sourcePackageHash: string
  observationGraphHash: string
  metricEvidenceHash: string
  modelHash: string
  solver: string
  /** Quantities by how they were settled. */
  hard: number
  soft: number
  unresolvedQuantities: number
  /** Named holes the candidate carries. */
  unresolved: number
  contradictions: number
  /** Objects in the model that trace back to evidence, against the total. */
  tracedObjects: number
  commands: number
}

export function candidateStatus(sealed: SealedCandidate): CandidateStatus {
  const c = sealed.candidate
  return {
    id: sealed.id,
    label: sealed.label,
    candidateHash: c.contentHash,
    sourcePackageHash: c.sourcePackageHash,
    observationGraphHash: c.observationGraphHash,
    metricEvidenceHash: c.metricEvidenceHash,
    modelHash: c.modelHash,
    solver: `${c.solver.name}@${c.solver.version}`,
    hard: c.residuals.hard,
    soft: c.residuals.soft,
    unresolvedQuantities: c.residuals.unresolved,
    unresolved: c.unresolved.length,
    contradictions: c.contradictions.length,
    tracedObjects: c.traces.length,
    commands: c.program.length,
  }
}
