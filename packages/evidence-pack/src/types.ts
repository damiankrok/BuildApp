/**
 * What an Evidence Pack is built from: the files one analyzer run already wrote, as loose JSON.
 *
 * The pack reads them and nothing else, so it cannot change what the run decided: no analyzer
 * module imports this package, and the run's ordering, heuristics, timeouts and seeds never see it.
 * The shapes below name only the fields the pack reads; everything else is carried through
 * untouched. Older runs (metric evidence before schema 1.3.0) lack the 005D fields, and the pack
 * says so instead of inventing them.
 */
export type Rect = { x0: number; y0: number; x1: number; y1: number }

export type Json = Record<string, unknown>

export type RunRecord = {
  /** The run's own name in a pack directory: a house, a row, a blind draw. */
  runId: string
  /** source-package.json */
  pkg: Json & { id?: string; canonicalUrl?: string; contentHash?: string; adapter?: { id: string; version: string }; assets?: AssetJson[]; publishedFacts?: Array<{ key: string; value: number; unit: string; label?: string }>; failures?: Json[] }
  /** metric-evidence.json */
  metrics?: MetricsJson
  /** plan-diagnostics/digest.json */
  digest?: DigestJson
  /** analysis-trace.json */
  trace?: { outcome?: string; entries?: TraceEntry[] }
  /** result-summary.json (a completed run) */
  summary?: Json & { modelHash?: string; sceneSha256?: string; sceneContentHash?: string; candidateHash?: string; metricEvidenceHash?: string; observationGraphHash?: string; sourcePackageHash?: string; warningDetails?: Array<{ code: string; severity: string; message?: string }>; analyzer?: Record<string, string>; counts?: Json; masses?: number }
  /** failure.json (a run that stopped) */
  failure?: Json & { code?: string; reasonCode?: string; message?: string; stage?: string }
  /** model.json (a completed run) */
  model?: Json & { levels?: Array<{ id: string; index: number; elevation?: number }>; slabs?: Array<{ levelId: string; polygon: Array<{ x: number; z: number }> }>; walls?: unknown[]; openings?: unknown[] }
  /** performance.json */
  performance?: Json
  /** The analyzer's own model render (PNG bytes), already bounded; never a publisher drawing. */
  preview?: Uint8Array
  /** Where the run came from: the commit and every analyzer version, as the run declared them. */
  provenance: { gitSha?: string; versions: Record<string, string>; evidenceModeVersion?: string }
}

export type AssetJson = {
  id: string
  caption?: string
  roles?: Record<string, string>
  selectedVariantId?: string
  variants?: Array<{ id: string; url: string; byteHash: string; byteLength?: number; mediaType?: string; decoded?: { width: number; height: number }; crop?: unknown }>
}

export type TraceEntry = { stage?: string; substage?: string; status?: string; counts?: Record<string, number | string | boolean>; reasonCode?: string; detail?: string }

export type MarkJson = { atPx: number; class: 'TICK' | 'QUESTIONABLE' | 'REJECTED'; reasons: string[] }
export type ChainJson = {
  id: string
  frameId: string
  axis: 'HORIZONTAL' | 'VERTICAL'
  baselinePx: number
  ticksPx: number[]
  marks?: MarkJson[]
  segments: Array<{ fromPx: number; toPx: number; pixelLength: number; valueCm?: number; origin?: string; evidenceId?: string; confidence?: number; labelled?: boolean }>
  note?: string
  /** 005I: the chain's group among neighbouring parallel lines and what it is to them. */
  topology?: { groupId: string; roles: string[]; alignedEnds: [boolean, boolean] }
}
export type ObservationJson = {
  id: string
  frameId: string
  chainId: string
  textRegionId: string
  orientation: string
  rawText: string
  valueCm: number
  axis: 'X' | 'Y'
  fromPx: number
  toPx: number
  spanPx: number
  impliedCmPerPx: number
  independence: string
  status: string
  binding?: { role: string; offsetShare: number; questionableEnds: number; skipped: { tick: number; questionable: number; rejected: number } }
  valueAlternatives?: Array<{ text: string; valueCm: number; ratio: number }>
  /** 005E (metric evidence 1.4.0): the ink's lattice id, reading class and the value the span was finally given. */
  ocr?: { latticeId: string; rawTopText: string; ocrClass: string; asReadP: number; probabilityMargin: number; asReadVariant: string; selected?: { by: string; text?: string; valueCm?: number; imageScore?: number; imageRank?: number; metricResidualPx?: number }; refutedBy?: string }
}
export type HypothesisJson = { id: string; cmPerPixel: number; witnessIds: string[]; independentGroups: number; independentAxes: string[]; independentWeight: number; longestShare: number; corroborated: boolean; axesMeasured: boolean; plausible: boolean; why: string }
export type SolutionJson = {
  frameId: string
  relation: string
  confidence: string
  cmPerPixelX?: number
  cmPerPixelY?: number
  isotropy?: string
  selectedHypothesisId?: string
  hypotheses: HypothesisJson[]
  legacy: { cmPerPixel?: number; independentGroups: number }
  independentWitnesses: number
  supportingObservationIds: string[]
  conflictingObservationIds: string[]
  why: string
  topology?: { marks: Json; bindings: Json; neutralObservationIds: string[]; hierarchy?: Json; valueAmbiguity?: { observationId: string; rawText: string; alternatives: string[]; cmPerPixelLow: number; cmPerPixelHigh: number } }
}
export type OcrTokenJson = { id: string; frameId: string; text: string; box: Rect; orientation?: string; pageVote?: string; confidence?: number; score?: number; heightPx?: number; glyphs?: Array<{ char: string; score: number; alternatives?: Array<{ char: string; score: number }> }> }
/** 005E: one label ink's numeric lattice as the metric evidence records it. */
export type LatticeJson = {
  id: string
  frameId: string
  orientation: string
  box: Rect
  rawTopText: string
  asRead: string
  asReadValueCm?: number
  asReadVariant: string
  ocrClass: string
  classWhy: string
  asReadP: number
  probabilityMargin: number
  sequenceMargin: number
  minGlyphScore: number
  maxRunnerRatio: number
  entropy: number
  capHeightPx: number
  sequences: Array<{ text: string; valueCm?: number; logP: number; p: number; imageScore: number; nonTop: Array<{ index: number; top: string; chosen: string; ratio: number }>; minGlyphMargin: number; avgGlyphMargin: number; variants: string[]; pathIds: string[]; asRead: boolean }>
  glyphs: Array<{ box: Rect; candidates: Array<{ char: string; score: number; p: number }>; runnerRatio: number; topologyRunnerRatio: number; holes: number; touching: boolean; broken: boolean }>
  paths: Array<{ id: string; variant: string; kind: string; text: string; slope: number; cuts: number[]; changedBoundaries: number; segScore: number; ratioToBest: number }>
  expansions: number
  truncatedBy: string
  mergedCount?: number
  emittedMass?: number
  asReadStability?: { stable: boolean; bracket: string[] }
  /** 005F: the glyph counts, the ambiguity tail (a record, never a reading) and what the segmentation tried. */
  countAmbiguity?: { asRead: number; alternatives: number[]; decisive: string[]; widthAmbiguous: boolean; rivalP: number }
  tail?: Array<{ text: string; valueCm: number; logP: number; imageScore: number; nonTop: Array<{ index: number; top: string; chosen: string; ratio: number }>; pathIds: string[] }>
  segmentation?: { style: { pitch: number | null; samples: number }; counts: Array<{ variant: string; reader: number; anchor: number; alternatives: number[]; decisive: boolean; widthAmbiguous: boolean }>; counterCutsMoved: number; counterCutsPruned: number; segmentations: number; cellsScored: number; truncated: number }
  cache?: string
  /** 005H: the external recogniser's reading of the same crop (candidates), and the P2 ensemble's decision. */
  external?: { engine: string; modelSha256: string; runtime: string; topK: Array<{ text: string; p: number }>; greedy: { text: string; meanP: number }; stable: boolean; variants: Array<{ variant: string; top: string; p: number }> }
  ensemble?: { decision: string; external: { text: string; valueCm?: number; posterior: number; meanP: number; stable: boolean; confident: boolean }; lattice: { asRead: string; valueCm?: number; ocrClass: string }; asRead: string; asReadValueCm?: number; ocrClass: string; rival?: { text: string; valueCm: number; witness: string }; why: string }
}
/** 005I: one label's place in the global assignment, as the metric evidence records it. */
export type AssignmentJson = { text: string; orientation: string; box: Rect; status: string; chosen?: { chainId: string; interval: number }; margin?: number; bounded?: boolean; candidates: Array<{ chainId: string; interval: number; offset: number; side: string; againstConvention?: boolean; centred: boolean; cost: number }> }
export type SideConventionJson = { side: string | null; basis: string; anchors: { before: number; across: number; after: number } }
export type TopologyJson = {
  frameId: string
  labelHeightPx: number
  labelInkMarks: Array<{ chainId: string; atPx: number; class: string }>
  labelInkLines: Array<{ axis: string; baselinePx: number; fromPx: number; toPx: number; marks: number }>
  groups: Array<{ id: string; axis: string; chainIds: string[]; separations: Array<{ fromChainId: string; toChainId: string; px: number; heights: number }>; relations: Array<{ aChainId: string; bChainId: string; kind: string; alignedEnds: [boolean, boolean] }> }>
  assignment: { legacy: AssignmentJson[]; final?: AssignmentJson[] }
  /** 1.7.0+ after the 005I post-review: the side convention each assignment read from the sheet. */
  sideConventions?: { legacy: Record<string, SideConventionJson>; final?: Record<string, SideConventionJson> }
}
export type MetricsJson = {
  schemaVersion?: string
  contentHash?: string
  extractors?: Array<{ name: string; version: string }>
  chains?: ChainJson[]
  dimensionObservations?: ObservationJson[]
  metricSolutions?: SolutionJson[]
  chainRelations?: Array<{ kind: string; frameId: string; fromChainId: string; toChainId: string; check?: string; sum?: Json; span?: Json }>
  ocrTokens?: OcrTokenJson[]
  numericLattices?: LatticeJson[]
  /** 005H: the external numeric recogniser the labels were also read with. */
  recogniser?: { id: string; model: { name: string; sha256: string }; runtime: string; runtimeSha256?: string }
  /** 005I: each plan frame's dimension topology — label-ink marks, axis groups, the global label assignment. */
  dimensionTopology?: TopologyJson[]
  coordinateRegistrations?: Array<{ frameId: string; plane: string; metresPerPixelX: number; metresPerPixelY: number; anchors?: unknown[] }>
  evidence?: Array<{ id: string; kind: string; frameId: string; value: number; unit: string; origin?: string; rawText?: string; textBox?: Rect }>
}
/**
 * 005K: one gap a reading of the plan left WEAK, as the boundary records it (`gap-evidence.ts`): source-addressable
 * with its frame and decomposition, never a picture.
 */
export type GapRecordJson = {
  gapId: string
  decompositionId: string
  axis: 'X' | 'Y'
  linePx: number
  axisPx: number
  fromPx: number
  toPx: number
  widthM: number
  signature: string
  classified: { cls: string; boundary: string }
  final: { cls: string; boundary: string; occupancy: string }
  outline: string
  drawnGapRule: { mode: string; check: Record<string, boolean | string | null> | null; upgraded: boolean }
  reasons: string[]
  [key: string]: unknown
}
export type PlanJson = {
  frameId: string
  assetId?: string
  variantByteHash?: string
  storey?: string
  annotation?: string
  sizePx: { width: number; height: number }
  scale: { mppX: number; mppY: number; anchors: number; rmsM: number } | null
  wallPx: number
  extent: Rect
  extentWeak?: boolean
  extentProvenance?: { x: string; y: string }
  extentRefused?: string[]
  /** 005I: the framing chains' short end segments, kept or trimmed, and the sides the walls contradicted. */
  extentEndSpans?: Array<{ chainId: string; end: string; fromPx: number; toPx: number; pixelLength: number; decision: string; why: string }>
  extentRefutations?: Array<{ side: string; atPx: number; wallsPast: number; overshootPx: number; action: string; movedToPx?: number; chainId?: string; why: string }>
  metric?: Json
  envelope: Rect | null
  bands: Array<{ axis: 'H' | 'V'; bounds: Rect; thickness: number }>
  chains: Array<{ axis: 'H' | 'V'; baselinePx: number; ticksPx: number[]; read: number }>
  linesX?: number[]
  linesY?: number[]
  cells?: Array<{ ix: number; iy: number; rect: Rect; cls: string; enclosed: boolean }>
  regions?: Array<{ id: string; cls: string; rect: Rect }>
  wideOpenings?: Array<{ id?: string; kind: string; axis: 'X' | 'Y'; linePx: number; fromPx: number; toPx: number; widthM: number; decision: string; score: number; why: string }>
  bays?: Array<{ side: string; rect: Rect; mouth: string }>
  boundary?: {
    accepted: boolean
    gaps?: Record<string, number>
    candidates?: Array<{ id: string; cells: number; areaM2: number; perimeterM: number; wallM: number; strongOpeningM: number; weakOpeningM: number; unsupportedM: number; gapsBridged: number; maxBridgedGapM: number }>
    extensions?: Array<{ cells: number; areaM2: number; continuesAcrossM: number; accepted: boolean }>
    policies?: Json
    bodies?: Array<{ relation: string; built: boolean; enclosed: boolean; areaM2: number; rect: Rect; junctionWallShare: number; sideWallShare: number; mouthM?: number }>
    /** 005F: the extent's stated sides the box stops materially inside, and the completions judged. */
    extentConflicts?: Array<{ side: string; strength: string; chainIds: string[]; extentPx: number; boxPx: number; gapM: number; gapWalls: number; stretches: Array<{ fromPx: number; toPx: number }>; stretchesOmitted?: number; decision: string; why: string }>
    completions?: Array<{ kind: string; decision: string; reason: string; rectBefore: Rect; areaBeforeM2: number; rect: Rect; areaM2: number; junction: Json; sides: Json; evidence: Json; weakGaps?: Json; side?: string }>
    completionsUnjudged?: number
    box?: Rect
    why?: string
    /** 005K (boundary evidence 1.2.0): the reading's identity and scale, its WEAK gaps and the drawn-gap rule's mode. */
    decompositionId?: string
    mpp?: { x: number; y: number }
    drawnGapRule?: string
    gapEvidence?: GapRecordJson[]
    gapEvidenceOmitted?: number
  }
  masses: Array<{ id: string; rect: Rect }>
}
export type DigestJson = { planFrames?: number; selectedPlanFrameId: string | null; plans: PlanJson[]; skipped?: Array<{ frameId: string; why: string }>; resolution?: Record<string, number | string | boolean>; challenge?: Record<string, number | string | boolean>; storeys?: StoreyJson[] }

/** 005L: one other storey's registration and support, as the plan-diagnostics digest records it (numbers and ids only). */
export type StoreyJson = {
  frameId: string
  storeyIndex: number
  decision: string
  chosen: { targetId: string; scale: number; offsetX: number; offsetY: number; score: number; stated: boolean } | null
  margin: number | null
  resolution: number | null
  scaleBasis: { basis: string; corroborated: boolean } | null
  printedScale: { k: number; outcome: string } | null
  held: { by: string; standsElsewhere: boolean; overScore: number } | null
  regions: Array<{ regionId: string; bounds: { x0: number; z0: number; x1: number; z1: number }; body: boolean; overhang: string; unsupportedM2: number; standsOn: string[] }>
  why: string
}

/** One decision the analyzer made, as the timeline records it. */
export type DecisionEvent = {
  eventId: string
  seq: number
  stage: TimelineStage
  objectId: string
  decision: string
  reason: string
  supportIds: string[]
  conflictIds: string[]
  confidenceBefore?: string | number
  confidenceAfter?: string | number
  reversible: boolean
  downstream: TimelineStage[]
}

/**
 * The stages, in the order the analyzer takes them: every plan copy's metric evidence is read before a plan is
 * selected and decomposed. The first divergence is the first stage that differs.
 */
export const TIMELINE_STAGES = [
  'SOURCE',
  'DIMENSION_TICK_CLASSIFICATION',
  'DIMENSION_AXIS_GROUPS',
  'GLYPH_COUNT_HYPOTHESES',
  'OCR_SEQUENCE_CANDIDATES',
  'EXTERNAL_OCR_CANDIDATES',
  'OCR_READING',
  'LABEL_ASSIGNMENT',
  'LABEL_BINDING',
  'DIMENSION_HIERARCHY',
  'SCALE_HYPOTHESIS',
  'METRIC_RELATION',
  'REGISTRATION',
  'FRAME_SELECTION',
  'EXTENT',
  'BOUNDARY_GAPS',
  'ENVELOPE',
  'ENVELOPE_EXTENT_CONFLICT',
  'BODIES',
  'STOREY_SUPPORT',
  'FIRST_SUCCESS_CHALLENGE',
  'PLAN_RESOLUTION',
  'FINAL',
] as const
export type TimelineStage = (typeof TIMELINE_STAGES)[number]
