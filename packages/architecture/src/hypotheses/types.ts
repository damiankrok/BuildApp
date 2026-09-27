import type { BuildingCommand } from '@buildapp/commands'
import type { AssemblyKind, CanonicalBuildingModel } from '@buildapp/model'
import type { ResolvedQuantity } from '../authority.js'
import type { CapabilityKey } from '../registry/capabilities.js'
import type { SemanticProposal } from '../proposals.js'

/**
 * The feature families the pipeline forms hypotheses about. A family is a
 * kind of assembly the evidence may add up to; the member-level capabilities
 * (COLUMN, BEAM) are what a family's emission is built from, not rivals.
 */
export const FAMILIES = ['DORMER', 'PERGOLA', 'CANOPY', 'CARPORT', 'EXTERIOR_STEPS', 'ROOF'] as const
export type Family = (typeof FAMILIES)[number]

/** Proposals the pipeline treats as one physical feature. */
export type FeatureGroup = {
  id: string
  /** The shared cross-view key, when the proposals carried one. */
  featureKey?: string
  proposalIds: string[]
  frames: string[]
}

export type RequirementCheck = {
  id: string
  description: string
  required: boolean
  met: boolean
  /** The proposals that count towards it. */
  matched: string[]
  frames: number
  need: number
  crossView: boolean
}

export type FamilyScore = {
  family: Family
  capability: CapabilityKey
  /** Every required requirement met. */
  satisfied: boolean
  /** Proposals whose kind the capability lists as ruling it out. */
  excludedBy: string[]
  /** Why the geometry cannot be this family, when it cannot. */
  implausible?: string
  /** 0..1: requirement weights × matched confidence × source authority. */
  score: number
  requirements: RequirementCheck[]
}

export type Decision = 'ACCEPTED' | 'UNKNOWN' | 'REJECTED'

export type Hypothesis = {
  id: string
  groupId: string
  decision: Decision
  family?: Family
  capability?: CapabilityKey
  confidence: number
  reasons: string[]
  /** Every family scored against the group, best first. */
  scores: FamilyScore[]
  /** For an UNKNOWN (and a rejected) feature: what it might be, and why that was not concluded. */
  alternatives: Array<{ kind: AssemblyKind; confidence: number; why: string }>
  /** Unmet optional requirements of the accepted family: what the assembly is missing. */
  missing: string[]
}

export type PipelineStage = 'OBSERVATION' | 'HYPOTHESIS' | 'FUSION' | 'TOPOLOGY' | 'METRIC_SOLVE' | 'DSL'

export type PipelineLog = Array<{ stage: PipelineStage; hypothesisId?: string; message: string }>

export type PipelineInput = {
  proposals: readonly SemanticProposal[]
  /** The model the features attach to (the house they stand against, the roof a dormer rises from). It is read, never written. */
  context: CanonicalBuildingModel
  /** Prefix for every emitted id, so two runs over one model do not collide. Default `hyp`. */
  idPrefix?: string
}

export type Emission = { hypothesisId: string; assemblyIds: string[]; objectIds: string[] }

export type PipelineResult = {
  proposals: SemanticProposal[]
  groups: FeatureGroup[]
  hypotheses: Hypothesis[]
  /** Every metric value the solve decided, with its authority, corroboration and conflicts. */
  quantities: ResolvedQuantity[]
  /** The Building DSL program that states the accepted and unknown features on top of the context. */
  commands: BuildingCommand[]
  emitted: Emission[]
  log: PipelineLog
}
