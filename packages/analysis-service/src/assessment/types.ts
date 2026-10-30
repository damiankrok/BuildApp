/**
 * N9-01: what a finished run says about its model, on three axes that are never folded into one.
 *
 *   technicalValidity          the delivered model is valid, compiles and closes, and the candidate replays — a
 *                              statement about the model alone; 0 ERROR is NOT agreement with the project
 *   decompositionCompleteness  the solver's own `modelCompleteness`, unchanged: how much of ITS reading the model holds
 *   sourceFidelity             relations between the model and the drawings, each PASS / CONFLICT / UNCHECKED, with the
 *                              object, the source, the measurement, the tolerance and how much of the source was looked at
 *   sourceUnchecked            every sheet, storey and registration axis no relation compared, and what it could check
 *
 * UNCHECKED is not PASS, and a source CONFLICT is not a technical failure: the model is delivered and shown whatever
 * the relations say (`previewAvailable`), with the conflicts named next to it.
 */
import type { ModelCompletenessVerdict } from '@buildapp/reconstruction'

export const MODEL_ASSESSMENT_SCHEMA_VERSION = '1.1.0' as const

export type RelationStatus = 'PASS' | 'CONFLICT' | 'UNCHECKED'

export type TechnicalCheck = {
  check: 'PROGRAM_REFUSALS' | 'MODEL_VALIDATION' | 'COMPILER' | 'CLOSURE' | 'REPLAY'
  errors: number
  warnings: number
  /** The findings by their own code and severity, at most `FINDINGS_LISTED` of each check, errors first. */
  findings: Array<{ code: string; severity: 'ERROR' | 'WARNING' | 'INFO'; /** The joint audit's own severity, where the grade differs from it. */ auditSeverity?: 'ERROR' | 'WARNING' | 'INFO'; objectId?: string; message: string }>
  note?: string
}

export type TechnicalValidity = {
  /** VALID: 0 ERROR over every check. It says nothing about the drawings. */
  status: 'VALID' | 'ERRORS'
  errors: number
  warnings: number
  checks: TechnicalCheck[]
  note: string
}

export type DecompositionCompleteness = {
  /** The solver's `modelCompleteness.verdict`, as it was before N9-01; absent from a run with no plan reading. */
  verdict: ModelCompletenessVerdict | 'NOT_ASSESSED'
  basis: 'ACCEPTED_DECOMPOSITION'
  meaning: string
}

/** One compared object of a relation. */
/** N9-02A: which axes of an elevation are registered (from `elevationRegistration`), on the items that are about one. */
export type ViewAxesSummary = { class: 'FULL' | 'ALONG_ONLY' | 'VERTICAL_ONLY' | 'UNREGISTERED'; side: string; along: string; vertical: string; scale: string }

export type RelationItem = {
  status: RelationStatus
  /** N9-02A, additive: for an elevation item, how far its registration reaches on each axis. */
  axes?: ViewAxesSummary
  /** What was compared: model object ids, or the storey / view the item is about. */
  objects: string[]
  /** The drawing compared with, when one was. */
  source: { frameId: string; assetId?: string; document: string; storeyIndex?: number; side?: string } | null
  /** Measured values, in metres or m² unless the key says otherwise. */
  measured: Record<string, number | string>
  /** The tolerance each measurement is held to, and where it comes from. */
  tolerance: Record<string, number | string>
  /** How much of the source or the object the comparison covered. */
  coverage: Record<string, number | string>
  /** A code naming the finding (WALL_ON_BLANK_PAPER, ROOF_INSIDE_ROOF, …). */
  code: string
  why: string
  /** What the measurement rests on, and what it does not prove. */
  evidence: string[]
}

export type RelationResult = {
  id: 'R1_ROOF_LAYERS' | 'R3_WALL_INK' | 'R4_STOREY_OUTLINE' | 'R5_REGISTERED_ELEVATIONS'
  title: string
  direction: 'MODEL_INTERNAL' | 'MODEL_TO_SOURCE' | 'SOURCE_TO_MODEL' | 'SOURCE_AND_MODEL'
  /** CONFLICT when any item conflicts; PASS only when every item passes; otherwise UNCHECKED. */
  status: RelationStatus
  counts: Record<RelationStatus, number>
  items: RelationItem[]
  /** What the relation cannot see, said once. */
  limits: string[]
}

export type UncheckedItem = {
  kind: 'ELEVATION' | 'SECTION' | 'PLAN' | 'STOREY' | 'PERSPECTIVE' | 'REGISTRATION_AXIS'
  /** N9-02A, additive: for an elevation, its four-axis registration (`elevationRegistration`). */
  registration?: ViewAxesSummary
  frameId?: string
  storeyIndex?: number
  side?: string
  /** For a view: how far its registration went on each axis. */
  axes?: { along: 'FULL' | 'ENDS_ONLY' | 'NONE'; height: 'FULL' | 'DATUM_ONLY' | 'NONE' }
  /** FULL: compared as far as N9-01 compares; PARTIAL: some of what it shows was compared; NONE: nothing was. */
  extent: 'PARTIAL' | 'NONE'
  what: string
  why: string
  /** What the sheet could check were it compared. */
  couldCheck: string
}

export type SourceUnchecked = {
  items: UncheckedItem[]
  counts: { total: number; byKind: Record<string, number>; none: number; partial: number }
}

export type SourceFidelity = {
  /** CONFLICT when any relation conflicts; PASS only when every relation passes; otherwise UNCHECKED. */
  status: RelationStatus
  relations: RelationResult[]
  counts: Record<RelationStatus, number>
  /** One sentence per conflicting item, for a headline. */
  conflicts: string[]
  meaning: string
}

export type ModelAssessment = {
  schema: 'buildapp.model-assessment'
  schemaVersion: typeof MODEL_ASSESSMENT_SCHEMA_VERSION
  technicalValidity: TechnicalValidity
  decompositionCompleteness: DecompositionCompleteness
  sourceFidelity: SourceFidelity
  sourceUnchecked: SourceUnchecked
  /** The 3D model is delivered and shown whatever the three axes say. */
  previewAvailable: true
  /**
   * N9-02A, additive: every elevation on four axes (SIDE, ALONG, VERTICAL, SCALE) from source evidence only, a
   * diagnostic that feeds nothing back into the model, with the solver's own use of each view beside it.
   */
  elevationRegistration: ElevationRegistrationReport
  summary: string
}

export type ElevationRegistrationReport = {
  views: import('./elevation-axes.js').ElevationAxes[]
  counts: { before: Record<'FULL' | 'ALONG_ONLY' | 'VERTICAL_ONLY' | 'UNREGISTERED', number>; after: Record<'FULL' | 'ALONG_ONLY' | 'VERTICAL_ONLY' | 'UNREGISTERED', number> }
  /** Checkable feature slots (a facade width, a wall end, an opening's position or height …) the four axes add. */
  slots: { before: number; after: number }
  /** Views the solver registered further than this diagnostic does, by frame, with why. */
  lost: Array<{ frameId: string; before: string; after: string; why: string }>
  datums: { ridgeY: number | null; terrainY: number | null }
}

export const FINDINGS_LISTED = 12

export const countStatuses = (items: ReadonlyArray<{ status: RelationStatus }>): Record<RelationStatus, number> => ({
  PASS: items.filter((i) => i.status === 'PASS').length,
  CONFLICT: items.filter((i) => i.status === 'CONFLICT').length,
  UNCHECKED: items.filter((i) => i.status === 'UNCHECKED').length,
})

/** CONFLICT if any; PASS only if all pass (and there is at least one); otherwise UNCHECKED. */
export const combineStatus = (items: ReadonlyArray<{ status: RelationStatus }>): RelationStatus => {
  if (items.some((i) => i.status === 'CONFLICT')) return 'CONFLICT'
  if (items.length > 0 && items.every((i) => i.status === 'PASS')) return 'PASS'
  return 'UNCHECKED'
}
