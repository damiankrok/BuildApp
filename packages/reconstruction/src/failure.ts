/**
 * Why a reconstruction stopped, as a code a person and a program can both act on.
 *
 * A solver that cannot build a building has always known why — "the flood fill
 * reached every cell", "no wall band runs along one axis" — and has then thrown
 * a sentence that the service, rightly unwilling to pass an arbitrary message
 * to a phone, flattened into "the analyzer could not reconstruct a building".
 * The knowledge was there and was thrown away at the last step.
 *
 * So an EXPECTED failure is not an exception with a message: it is one of the
 * codes below, the phase it happened in, a sentence written for a reader, and
 * a set of flat counts that say how far the reading got. None of it carries a
 * path, a stack or a line of source, so all of it may cross to a client. A
 * generic failure is left for what nobody expected.
 */

export const RECONSTRUCTION_FAILURE_CODES = [
  // --- reading the plans --------------------------------------------------------
  /** The package has no floor plan at all. */
  'PLAN_NOT_FOUND',
  /** Floor plans are listed, but none of their bytes could be decoded here. */
  'PLAN_NOT_DECODABLE',
  /** The chosen plan states no usable scale: no chain read, or the only scale it supports is physically implausible. */
  'PLAN_NO_DIMENSION_FRAME',
  /** No wall-thick ink was found on the plan. */
  'PLAN_NO_WALL_BANDS',
  /** Walls were found, but not on both axes, so they enclose nothing. */
  'PLAN_NO_WALLED_ENVELOPE',
  /** Neither the chains nor the walls support two grid lines on each axis. */
  'PLAN_GRID_EMPTY',
  /** The flood fill reached every cell: no part of the plan is enclosed. */
  'PLAN_NO_ENCLOSED_CELLS',
  /** Enclosed cells exist, but every region they make is walled too little to be a building. */
  'PLAN_NO_BUILT_REGIONS',
  /** Regions were accepted, but no mass (or no world frame) could be made from them. */
  'PLAN_NO_MASSES',
  /** A body was built, and the layout gate found it contradicts the sources (its footprint against the published one, two bodies in one place). */
  'PLAN_LAYOUT_REJECTED',
  /** An upper plan could not be registered onto the one below. */
  'PLAN_STOREY_ALIGNMENT_FAILED',
  /** An upper plan fits two places on the one below almost equally well. */
  'PLAN_STOREY_ALIGNMENT_AMBIGUOUS',
  // --- registering the other views --------------------------------------------------
  'VIEW_REGISTRATION_NO_ANCHORS',
  'VIEW_REGISTRATION_AMBIGUOUS',
  'ELEVATION_REGISTRATION_FAILED',
  'SECTION_REGISTRATION_FAILED',
  // --- solving, emitting, compiling, verifying ----------------------------------------
  'TOPOLOGY_NO_VALID_HYPOTHESIS',
  'METRIC_SOLVE_FAILED',
  /** The model refused a command the solver emitted. */
  'MODEL_EMISSION_FAILED',
  'SCENE_COMPILE_FAILED',
  'VERIFY_REPLAY_FAILED',
  'VERIFY_CLOSURE_FAILED',
  /** Nobody expected this. The phase is still known. */
  'INTERNAL_ERROR',
] as const

export type ReconstructionFailureCode = (typeof RECONSTRUCTION_FAILURE_CODES)[number]

/** The solver's own phases, plus the two the service runs after it. */
export type ReconstructionFailurePhase = 'REGISTRATION' | 'TOPOLOGY' | 'METRICS' | 'MODEL' | 'COMPILE' | 'VERIFY'

/** Flat, safe facts about how far a reading got: counts, sizes, ids of frames. Never a path, never a stack. */
export type FailureDiagnostics = Record<string, number | string | boolean>

/** What a person is told first, per family of failure. */
export const FAILURE_TITLES: Record<ReconstructionFailureCode, string> = {
  PLAN_NOT_FOUND: 'No floor plan to read',
  PLAN_NOT_DECODABLE: 'The floor plans could not be decoded',
  PLAN_NO_DIMENSION_FRAME: 'The floor plan states no usable scale',
  PLAN_NO_WALL_BANDS: 'No walls found on the floor plan',
  PLAN_NO_WALLED_ENVELOPE: 'The floor-plan walls do not enclose a building',
  PLAN_GRID_EMPTY: 'No structural grid on the floor plan',
  PLAN_NO_ENCLOSED_CELLS: 'Could not reconstruct the floor-plan body',
  PLAN_NO_BUILT_REGIONS: 'Could not reconstruct the floor-plan body',
  PLAN_NO_MASSES: 'Could not reconstruct the floor-plan body',
  PLAN_LAYOUT_REJECTED: 'The floor-plan reading contradicts the project data',
  PLAN_STOREY_ALIGNMENT_FAILED: 'The storeys could not be aligned',
  PLAN_STOREY_ALIGNMENT_AMBIGUOUS: 'The storeys align two ways',
  VIEW_REGISTRATION_NO_ANCHORS: 'The views could not be registered',
  VIEW_REGISTRATION_AMBIGUOUS: 'The views register two ways',
  ELEVATION_REGISTRATION_FAILED: 'The elevations could not be registered',
  SECTION_REGISTRATION_FAILED: 'The section could not be registered',
  TOPOLOGY_NO_VALID_HYPOTHESIS: 'No consistent building topology',
  METRIC_SOLVE_FAILED: 'The dimensions could not be solved',
  MODEL_EMISSION_FAILED: 'The model could not be built',
  SCENE_COMPILE_FAILED: 'The 3D scene could not be compiled',
  VERIFY_REPLAY_FAILED: 'The result did not verify',
  VERIFY_CLOSURE_FAILED: 'The result did not verify',
  INTERNAL_ERROR: 'The analyzer hit an internal error',
}

/**
 * An expected reconstruction failure.
 *
 * `message` is written for a reader and names only things in the SOURCE —
 * drawings, walls, chains — so it may be shown as is. `substage` says which
 * step of the phase stopped (PLAN_READ, PLAN_DECOMPOSITION, …). `plans` is the
 * decomposition digest, for a diagnostics bundle and its overlays.
 */
export class ReconstructionFailure extends Error {
  constructor(
    readonly code: ReconstructionFailureCode,
    readonly phase: ReconstructionFailurePhase,
    message: string,
    readonly diagnostics: FailureDiagnostics = {},
    readonly substage?: string,
    readonly plans?: PlanDiagnosticsReport,
  ) {
    super(message)
    this.name = 'ReconstructionFailure'
  }
}

export const isReconstructionFailure = (e: unknown): e is ReconstructionFailure => e instanceof ReconstructionFailure || (typeof e === 'object' && e !== null && (e as { name?: unknown }).name === 'ReconstructionFailure' && typeof (e as { code?: unknown }).code === 'string')

// ---------------------------------------------------------------------------
// The plan-decomposition digest
// ---------------------------------------------------------------------------

type Rect = { x0: number; y0: number; x1: number; y1: number }

/** One plan as the structural pass read it, in the frame's own pixels: enough to draw every overlay and to count. */
export type PlanDiagnostics = {
  frameId: string
  assetId: string
  storey: string
  annotation: string
  sizePx: { width: number; height: number }
  variantByteHash: string
  /** Metres per pixel, or null when the plan states no scale. */
  scale: { mppX: number; mppY: number; anchors: number; rmsM: number } | null
  wallPx: number
  extent: Rect
  extentWeak: boolean
  envelope: Rect | null
  bands: Array<{ axis: 'H' | 'V'; bounds: Rect; thickness: number }>
  chains: Array<{ axis: 'H' | 'V'; baselinePx: number; ticksPx: number[]; read: number }>
  linesX: number[]
  linesY: number[]
  cells: Array<{ ix: number; iy: number; rect: Rect; cls: 'B' | 'R' | 'O'; enclosed: boolean }>
  regions: Array<{ id: string; cls: 'BUILT' | 'RECESS'; rect: Rect }>
  wideOpenings: Array<{ kind: string; axis: 'X' | 'Y'; linePx: number; fromPx: number; toPx: number; widthM: number; decision: string; score: number; why: string }>
  bays: Array<{ side: string; rect: Rect; mouth: string }>
  hypotheses: Array<{ id: string; builtCells: number; closedOpenings: number; score: number; chosen: boolean; why: string }>
  masses: Array<{ id: string; rect: Rect }>
}

export type PlanDiagnosticsReport = {
  planFrames: number
  selectedPlanFrameId: string | null
  plans: PlanDiagnostics[]
  /** Frames the pass looked at and could not read, and why. */
  skipped: Array<{ frameId: string; why: string }>
}

/** The counts a failure screen shows, from the digest. */
export function planCounts(report: PlanDiagnosticsReport | undefined): FailureDiagnostics {
  if (!report) return {}
  const base = report.plans.find((p) => p.frameId === report.selectedPlanFrameId) ?? report.plans[0]
  const out: FailureDiagnostics = { planFrames: report.planFrames, plansRead: report.plans.length }
  if (report.selectedPlanFrameId) out.selectedPlanFrameId = report.selectedPlanFrameId
  if (!base) return out
  out.planSizePx = `${base.sizePx.width}x${base.sizePx.height}`
  out.dimensionChains = base.chains.length
  out.dimensionChainsRead = base.chains.filter((c) => c.read > 0).length
  out.scaleCmPerPx = base.scale ? Math.round(base.scale.mppX * 1e6) / 1e4 : 0
  out.wallBands = base.bands.length
  out.wallThicknessPx = base.wallPx
  out.walledEnvelope = base.envelope !== null
  out.gridLinesX = base.linesX.length
  out.gridLinesY = base.linesY.length
  out.cells = base.cells.length
  out.enclosedCells = base.cells.filter((c) => c.enclosed).length
  out.builtRegions = base.regions.filter((r) => r.cls === 'BUILT').length
  out.recessRegions = base.regions.filter((r) => r.cls === 'RECESS').length
  out.wideOpenings = base.wideOpenings.length
  out.wideOpeningsClosed = base.wideOpenings.filter((w) => w.decision === 'OPENING_IN_WALL').length
  out.masses = base.masses.length
  return out
}
