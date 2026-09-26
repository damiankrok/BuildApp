/**
 * The stages of one link analysis, and what "progress" means.
 *
 * Progress is the position in the pipeline, not a clock: it moves when a
 * stage starts or finishes and, inside the one stage that has countable
 * units (reading the drawings, one asset at a time), when a unit is done.
 * Nothing advances on a timer, so a stalled analysis shows a stalled bar.
 *
 * The weights say how much of a typical run each stage takes. They were read
 * off real runs (see `docs/ANALYZER_API.md`); they shape the bar and nothing
 * else — a wrong weight makes the bar uneven, never dishonest about which
 * stage is running.
 */

export const ANALYSIS_STAGES = [
  'ACQUIRING_SOURCE',
  'CLASSIFYING_SOURCES',
  'EXTRACTING_OBSERVATIONS',
  'REGISTERING_VIEWS',
  'SOLVING_TOPOLOGY',
  'SOLVING_METRICS',
  'BUILDING_MODEL',
  'COMPILING_SCENE',
  'VERIFYING',
] as const

export type AnalysisStage = (typeof ANALYSIS_STAGES)[number]

export const TERMINAL_STATUSES = ['COMPLETED', 'FAILED', 'CANCELLED'] as const
export type TerminalStatus = (typeof TERMINAL_STATUSES)[number]

/** A job's status: waiting, one of the stages, or finished one way or another. */
export type AnalysisStatus = 'QUEUED' | AnalysisStage | TerminalStatus

export const ANALYSIS_STATUSES: readonly AnalysisStatus[] = ['QUEUED', ...ANALYSIS_STAGES, ...TERMINAL_STATUSES]

export const isTerminal = (status: AnalysisStatus): status is TerminalStatus => (TERMINAL_STATUSES as readonly string[]).includes(status)

/** What a person reads beside each stage. */
export const STAGE_LABELS: Record<AnalysisStage, string> = {
  ACQUIRING_SOURCE: 'Fetching the project page and its drawings',
  CLASSIFYING_SOURCES: 'Sorting plans, elevations, sections and renders',
  EXTRACTING_OBSERVATIONS: 'Reading the drawings',
  REGISTERING_VIEWS: 'Registering the views to one frame',
  SOLVING_TOPOLOGY: 'Solving bodies, roof, recesses, stair and rooms',
  SOLVING_METRICS: 'Sizing openings, roof details and facade assemblies',
  BUILDING_MODEL: 'Building and verifying the model',
  COMPILING_SCENE: 'Compiling the 3D scene',
  VERIFYING: 'Checking replay, hashes and joints',
}

/** Share of a typical run spent in each stage. Sums to 1. */
export const STAGE_WEIGHTS: Record<AnalysisStage, number> = {
  // Measured on a real 20-asset project through the API (BUILDAPP-03Y1 report):
  // fetching ~11 % of the wall time, reading the drawings ~85 %, everything
  // from registration to verification together ~4 %.
  ACQUIRING_SOURCE: 0.1,
  CLASSIFYING_SOURCES: 0.01,
  EXTRACTING_OBSERVATIONS: 0.8,
  REGISTERING_VIEWS: 0.01,
  SOLVING_TOPOLOGY: 0.01,
  SOLVING_METRICS: 0.02,
  BUILDING_MODEL: 0.01,
  COMPILING_SCENE: 0.01,
  VERIFYING: 0.03,
}

/** Overall progress, 0..1, for being `fraction` of the way through `stage`. */
export function progressAt(stage: AnalysisStage, fraction = 0): number {
  const index = ANALYSIS_STAGES.indexOf(stage)
  let done = 0
  for (let i = 0; i < index; i++) done += STAGE_WEIGHTS[ANALYSIS_STAGES[i]]
  const f = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0
  return Math.min(1, Number((done + STAGE_WEIGHTS[stage] * f).toFixed(4)))
}

/** One report from the pipeline to whoever is watching it. */
export type AnalysisProgress = {
  stage: AnalysisStage
  stageIndex: number
  stageCount: number
  /** How far through this stage, when the stage has countable units; 0 at its start. */
  stageFraction: number
  /** Overall, 0..1. Never decreases within one run. */
  progress: number
  /** A short fact about where it is, e.g. "asset 4 of 20". Never a path. */
  detail?: string
}

export function progressEvent(stage: AnalysisStage, stageFraction = 0, detail?: string): AnalysisProgress {
  return {
    stage,
    stageIndex: ANALYSIS_STAGES.indexOf(stage),
    stageCount: ANALYSIS_STAGES.length,
    stageFraction: Math.min(1, Math.max(0, stageFraction)),
    progress: progressAt(stage, stageFraction),
    ...(detail ? { detail } : {}),
  }
}
