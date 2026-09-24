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
import { ReconstructionCandidateSchema, StructuralLayoutHypothesisSetSchema, buildCandidateModel, verifyReplay } from '@buildapp/reconstruction'
import type { ReconstructionCandidate, SourceViewResidual, StructuralLayoutHypothesisSet } from '@buildapp/reconstruction'
import type { CanonicalBuildingModel } from '@buildapp/model'
import marcowkiAuto from './marcowki-auto.json' with { type: 'json' }
import marcowkiAutoLayout from './marcowki-auto-layout.json' with { type: 'json' }
import marcowkiAutoV2 from './marcowki-auto-v2.json' with { type: 'json' }
import marcowkiAutoV2Layout from './marcowki-auto-v2-layout.json' with { type: 'json' }
import marcowkiAutoV2Residuals from './marcowki-auto-v2-residuals.json' with { type: 'json' }

/**
 * What the analyzer-v2 verifier measured when it projected the candidate back
 * into the source views: one row per feature, the model's value against the
 * drawing's, and whether the two agree within the feature's own uncertainty.
 * Sealed against the candidate by hash, like the layout.
 */
export type SourceViewResiduals = { candidateHash: string; residuals: SourceViewResidual[] }

export type SealedCandidate = {
  /** A short, stable id used by selectors and scene bundles. */
  id: string
  label: string
  candidate: ReconstructionCandidate
  /**
   * What the solver decided the building was MADE OF, sealed beside the
   * program that draws it.
   *
   * The candidate carries the layout's id and hash but not the layout, and a
   * hash on its own answers no question anybody actually has: how many bodies,
   * which storeys they reach, what is over each of them, what the pass could
   * not settle. That is the part a reviewer reads and the part a benchmark
   * scores, so it travels with the candidate rather than being left behind in
   * a build directory.
   */
  layout: StructuralLayoutHypothesisSet
  /**
   * The source-view comparison, for a candidate whose solver produced one.
   * The first solver did not verify against the views, so it carries none;
   * absence is a fact about that solver, not a missing file.
   */
  residuals?: SourceViewResiduals
}

/** Every candidate committed to the repository, in a fixed order. */
export const SEALED_CANDIDATES: readonly SealedCandidate[] = [
  { id: 'marcowki-auto', label: 'Marcówki (auto)', candidate: marcowkiAuto as unknown as ReconstructionCandidate, layout: marcowkiAutoLayout as unknown as StructuralLayoutHypothesisSet },
  // The analyzer-v2 candidate: same building, second pipeline. It is sealed
  // beside the first rather than in its place so that the two can be put on
  // the same screen and compared; `npm run candidates:seal-v2` copies it in
  // from the pipeline's artefacts.
  {
    id: 'marcowki-auto-v2',
    label: 'Marcówki (auto v2)',
    candidate: marcowkiAutoV2 as unknown as ReconstructionCandidate,
    layout: marcowkiAutoV2Layout as unknown as StructuralLayoutHypothesisSet,
    residuals: marcowkiAutoV2Residuals as unknown as SourceViewResiduals,
  },
]

/**
 * A sealed candidate's layout, validated and checked against the candidate.
 *
 * The check is the point: a layout file that is not the one the candidate was
 * sealed from describes a different building, and silently showing it beside
 * this one would be worse than having no layout at all.
 */
export function layoutOf(id: string): StructuralLayoutHypothesisSet {
  const sealed = sealedCandidate(id)
  if (!sealed) throw new Error(`no sealed candidate called ${id}`)
  const parsed = StructuralLayoutHypothesisSetSchema.safeParse(sealed.layout)
  if (!parsed.success) throw new Error(`the layout sealed with ${id} does not validate: ${parsed.error.issues[0]?.message ?? 'unknown'}`)
  if (sealed.layout.contentHash !== sealed.candidate.structuralLayoutHash) {
    throw new Error(`the layout sealed with ${id} hashes to ${sealed.layout.contentHash.slice(0, 16)} and the candidate was built from ${(sealed.candidate.structuralLayoutHash ?? '').slice(0, 16)}`)
  }
  return sealed.layout
}

export const sealedCandidate = (id: string): SealedCandidate | undefined => SEALED_CANDIDATES.find((c) => c.id === id)

/**
 * A sealed candidate's source-view residuals, checked against the candidate,
 * or null when its solver produced none.
 *
 * Residuals measured on a different candidate would describe how well some
 * OTHER building matches the drawings, which is worse than showing nothing.
 */
export function sourceViewResidualsOf(id: string): SourceViewResiduals | null {
  const sealed = sealedCandidate(id)
  if (!sealed) throw new Error(`no sealed candidate called ${id}`)
  if (!sealed.residuals) return null
  if (sealed.residuals.candidateHash !== sealed.candidate.contentHash) {
    throw new Error(`the residuals sealed with ${id} were measured on ${sealed.residuals.candidateHash.slice(0, 16)} and the candidate is ${sealed.candidate.contentHash.slice(0, 16)}`)
  }
  return sealed.residuals
}

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
