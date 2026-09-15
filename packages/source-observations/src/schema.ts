/**
 * SourceObservationGraph — what the analyzer SAW, never what the building is.
 *
 * This is the contract between source interpretation and reconstruction. It is
 * source-native: every observation lives in the pixel grid of one asset, with
 * a normalized copy so it survives a rescale. Nothing here is metric, nothing
 * here is 3D, and nothing here is a Building DSL command.
 *
 * The rule that gives the layer its value:
 *
 *   **A vision model produces OBSERVATIONS, not geometry.** It may say "there
 *   is a thick linear member here, it looks like a beam or a facade frame, it
 *   stands proud of the wall, and it continues towards the garage". It may not
 *   say "add a 0.4 x 0.3 m beam at x=7.9". Whether that observation becomes a
 *   beam, a portal frame or nothing at all is decided by the solver, from all
 *   the views at once, with metric anchors. An observation that turns straight
 *   into a wall has skipped every check that makes the result trustworthy.
 *
 * Three consequences run through the schema:
 *
 * - Every observation carries `confidence` AND an `uncertainty` in its own
 *   pixel units, because "0.8 confident" and "this edge is +/- 6 px" are
 *   different facts and a solver needs both.
 * - Ambiguity is represented, not resolved: `alternatives` holds the readings
 *   that were also admissible. A count of nine tread lines that might be ten
 *   must stay a count that might be ten.
 * - Disagreement is first class. Two views that contradict each other produce
 *   a `conflict`, never a silently averaged compromise.
 */
import { z } from 'zod'
import { NormPointSchema, PixelPointSchema, PixelRectSchema, PixelSizeSchema } from '@buildapp/source-common'

export const OBSERVATION_GRAPH_SCHEMA = 'buildapp.source-observation-graph' as const
export const OBSERVATION_GRAPH_SCHEMA_VERSION = '1.0.0' as const
export const SUPPORTED_GRAPH_VERSIONS = ['1.0.0'] as const

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/**
 * What an observation IS.
 *
 * Three families, deliberately kept apart:
 *
 * - METRIC / DRAWING: things a technical drawing states about itself — a
 *   printed dimension, a level datum, a room label. High authority, and the
 *   only route to real metres, but still an observation until corroborated.
 * - 2D GEOMETRIC: shapes found in the image with no architectural claim
 *   attached. A polyline is a polyline.
 * - ARCHITECTURAL CANDIDATE: a claim that a shape is a kind of building
 *   thing. Always a candidate: the name is a hypothesis the solver may reject.
 */
export const ObservationKindSchema = z.enum([
  // --- metric / drawing ---
  'PRINTED_DIMENSION',
  'LEVEL_DATUM',
  'ANGLE',
  'SCALE_ANCHOR',
  'ROOM_LABEL',
  'ROOM_AREA',
  'WALL_AXIS',
  'WALL_BAND',
  'OPENING_INTERVAL',
  'STAIR_SYMBOL',
  // --- 2D geometric ---
  'POINT',
  'LINE',
  'POLYLINE',
  'POLYGON',
  'RECTANGLE',
  'PROFILE',
  'SILHOUETTE',
  'PARALLEL_LINE_FAMILY',
  // --- architectural candidates ---
  'MASS_REGION',
  'WALL_REGION',
  'ROOF_REGION',
  'ROOF_EDGE',
  'RIDGE',
  'EAVE',
  'OPENING',
  'WINDOW',
  'DOOR',
  'BALCONY',
  'LOGGIA',
  'RAILING',
  'CHIMNEY',
  'STAIR',
  'SURFACE_REGION',
  /**
   * A source-visible THICK linear architectural member whose 3D primitive is
   * not yet known: a facade frame, a beam, a portal reveal, a fin, a parapet,
   * an edge frame. It exists because a flat coloured band and a solid that
   * stands proud of the wall look similar in a technical elevation and quite
   * different in a perspective render, and the difference is exactly what a
   * flat material-region model gets wrong. Observing the member without
   * naming its primitive is the honest middle step.
   */
  'LINEAR_VOLUME_CANDIDATE',
])
export type ObservationKind = z.infer<typeof ObservationKindSchema>

/** Free-form but controlled hints about what a candidate might turn out to be. Never load-bearing on their own. */
export const SemanticHintSchema = z.enum([
  'beam',
  'facade-frame',
  'portal',
  'fin',
  'parapet',
  'edge-frame',
  'reveal',
  'lintel',
  'column',
  'pilaster',
  'band',
  'cladding',
  'glazing',
  'railing',
  'balcony-slab',
  'side-return',
  'recess-mouth',
  'recess-back',
  'gable',
  'eave',
  'ridge',
  'verge',
  'chimney',
  'rooflight',
  'stair-flight',
  'stair-winder',
  'stair-direction',
  'tread-line',
  'dimension-chain',
  'level-datum',
  'room-number',
  'wall-band',
  'unknown',
])
export type SemanticHint = z.infer<typeof SemanticHintSchema>

/**
 * Where something sits in depth RELATIVE to the surface it is drawn on. This
 * is the qualitative answer a perspective render can give and a technical
 * elevation cannot; it is never converted to metres here, because without an
 * anchor that conversion is invention.
 */
export const DepthLayerSchema = z.enum(['FRONT', 'PROUD_OF_WALL', 'HOST_PLANE', 'RECESSED', 'BACK', 'UNKNOWN'])
export type DepthLayer = z.infer<typeof DepthLayerSchema>

/** How an observation was produced. A reader must be able to tell a measured edge from a model's opinion. */
export const ExtractorKindSchema = z.enum(['DETERMINISTIC_CV', 'VISION_MODEL', 'PUBLISHED_TEXT', 'ADAPTER_METADATA', 'DERIVED'])
export type ExtractorKind = z.infer<typeof ExtractorKindSchema>

export const ProvenanceSchema = z
  .object({
    extractor: ExtractorKindSchema,
    /** The specific extractor and its version, e.g. `cv.axis-lines@1`, `vision.anthropic/claude-opus-5@facade-decomposition-1`. */
    name: z.string().min(1),
    /** What it was run on, when that is narrower than the whole asset. */
    region: PixelRectSchema.optional(),
    /** A short, human-checkable statement of the evidence: a row scan, a run length, a model's cited cue. */
    detail: z.string(),
  })
  .strict()
export type Provenance = z.infer<typeof ProvenanceSchema>

/**
 * How wrong the geometry might be, in the asset's own pixels. Separate from
 * `confidence`: a model can be quite sure a roof edge exists (high confidence)
 * and quite unsure exactly where it is (large `positionPx`).
 */
export const UncertaintySchema = z
  .object({
    /** Positional tolerance on the observation's points, in pixels. */
    positionPx: z.number().nonnegative(),
    /** Angular tolerance, for things with a direction. */
    angleDeg: z.number().nonnegative().optional(),
    /** Why it is uncertain: a blurred edge, a shadow, an occluded end, a model's own hedge. */
    reason: z.string().optional(),
  })
  .strict()
export type Uncertainty = z.infer<typeof UncertaintySchema>

// ---------------------------------------------------------------------------
// Pixel geometry
// ---------------------------------------------------------------------------

/** The shape of an observation in its asset's pixel grid. */
export const PixelGeometrySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('POINT'), point: PixelPointSchema }).strict(),
  z.object({ type: z.literal('SEGMENT'), a: PixelPointSchema, b: PixelPointSchema }).strict(),
  z.object({ type: z.literal('POLYLINE'), points: z.array(PixelPointSchema).min(2) }).strict(),
  z.object({ type: z.literal('POLYGON'), points: z.array(PixelPointSchema).min(3) }).strict(),
  z.object({ type: z.literal('RECT'), rect: PixelRectSchema }).strict(),
  /** A set of parallel lines: a dimension chain, a run of stair treads, a louvre. */
  z.object({ type: z.literal('LINE_FAMILY'), lines: z.array(z.object({ a: PixelPointSchema, b: PixelPointSchema }).strict()).min(2) }).strict(),
])
export type PixelGeometry = z.infer<typeof PixelGeometrySchema>

/** The same shape normalized by the asset's decoded size, so two variants of one drawing can be compared. */
export const NormGeometrySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('POINT'), point: NormPointSchema }).strict(),
  z.object({ type: z.literal('SEGMENT'), a: NormPointSchema, b: NormPointSchema }).strict(),
  z.object({ type: z.literal('POLYLINE'), points: z.array(NormPointSchema).min(2) }).strict(),
  z.object({ type: z.literal('POLYGON'), points: z.array(NormPointSchema).min(3) }).strict(),
  z.object({ type: z.literal('RECT'), rect: z.object({ x0: z.number(), y0: z.number(), x1: z.number(), y1: z.number() }).strict() }).strict(),
  z.object({ type: z.literal('LINE_FAMILY'), lines: z.array(z.object({ a: NormPointSchema, b: NormPointSchema }).strict()).min(2) }).strict(),
])
export type NormGeometry = z.infer<typeof NormGeometrySchema>

// ---------------------------------------------------------------------------
// Observations
// ---------------------------------------------------------------------------

/** A reading that was also admissible. Ambiguity is represented, never resolved by picking one and forgetting the rest. */
export const ObservationAlternativeSchema = z
  .object({
    why: z.string().min(1),
    confidence: z.number().min(0).max(1),
    pixelGeometry: PixelGeometrySchema.optional(),
    /** For a counted thing (tread lines, panels), the other count that would also fit. */
    count: z.number().int().nonnegative().optional(),
    semanticHints: z.array(SemanticHintSchema).optional(),
  })
  .strict()
export type ObservationAlternative = z.infer<typeof ObservationAlternativeSchema>

/** A measured value an observation carries, with the unit it is measured IN. Pixels and text, never metres. */
export const ObservationValueSchema = z
  .object({
    /** `px`, `deg`, `count`, `ratio`, or `text` for a label read off the drawing. */
    unit: z.enum(['px', 'deg', 'count', 'ratio', 'text']),
    number: z.number().finite().optional(),
    text: z.string().optional(),
  })
  .strict()
export type ObservationValue = z.infer<typeof ObservationValueSchema>

export const SourceObservationSchema = z
  .object({
    /** Deterministic: a function of what is observed, not of when or in what order. */
    id: z.string().min(1),
    /** The asset this was seen on. Pixel coordinates mean nothing without it. */
    assetId: z.string().min(1),
    /** The exact bytes, so an observation cannot silently migrate to another copy of the drawing. */
    variantByteHash: z.string().regex(/^[0-9a-f]{64}$/),
    /** The frame the pixel coordinates belong to. */
    frameId: z.string().min(1),
    kind: ObservationKindSchema,
    semanticHints: z.array(SemanticHintSchema),
    pixelGeometry: PixelGeometrySchema,
    normGeometry: NormGeometrySchema,
    value: ObservationValueSchema.optional(),
    depthLayer: DepthLayerSchema,
    confidence: z.number().min(0).max(1),
    uncertainty: UncertaintySchema,
    provenance: ProvenanceSchema,
    alternatives: z.array(ObservationAlternativeSchema),
    /** Free notes for a human reader. Never parsed. */
    note: z.string().optional(),
  })
  .strict()
export type SourceObservation = z.infer<typeof SourceObservationSchema>

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

/**
 * How two observations stand to one another.
 *
 * Spatial and depth relations are within one view. Identity relations cross
 * views and are deliberately timid: `POSSIBLY_SAME_FEATURE` is the default
 * and `SAME_FEATURE` needs real corroboration, because a false merge destroys
 * evidence that a later stage cannot recover, while a missed merge only
 * leaves work undone.
 */
export const RelationKindSchema = z.enum([
  // depth and occlusion, within a view
  'PROUD_OF',
  'RECESSED_BEHIND',
  'COPLANAR_WITH',
  'OCCLUDES',
  'INSIDE_RECESS',
  // topology, within a view
  'SPANS_BETWEEN',
  'CONTINUES_ACROSS',
  'ALIGNS_WITH',
  'SUPPORTS',
  'CONTAINS',
  // image-space direction, within a view
  'ABOVE',
  'BELOW',
  'LEFT_OF',
  'RIGHT_OF',
  // identity, across views
  'POSSIBLY_SAME_FEATURE',
  'SAME_FEATURE',
  'CORROBORATES',
  'CONTRADICTS',
])
export type RelationKind = z.infer<typeof RelationKindSchema>

export const ObservationRelationSchema = z
  .object({
    id: z.string().min(1),
    kind: RelationKindSchema,
    from: z.string().min(1),
    to: z.string().min(1),
    confidence: z.number().min(0).max(1),
    provenance: ProvenanceSchema,
    /** Why this relation was asserted, in a sentence a reader can check. */
    why: z.string().min(1),
  })
  .strict()
export type ObservationRelation = z.infer<typeof ObservationRelationSchema>

// ---------------------------------------------------------------------------
// Conflicts and gaps
// ---------------------------------------------------------------------------

/** Two readings that cannot both be right. Recorded, never averaged. */
export const ObservationConflictSchema = z
  .object({
    id: z.string().min(1),
    /** The observations that disagree. */
    observationIds: z.array(z.string().min(1)).min(2),
    kind: z.enum(['POSITION', 'COUNT', 'PRESENCE', 'LABEL', 'ANGLE', 'SCALE']),
    what: z.string().min(1),
    /** How far apart they are, in the unit the conflict is about. */
    magnitude: z.number().nonnegative().optional(),
    unit: z.enum(['px', 'deg', 'count', 'ratio', 'none']).optional(),
    note: z.string().optional(),
  })
  .strict()
export type ObservationConflict = z.infer<typeof ObservationConflictSchema>

/** Something a stage looked for and did not find. A named hole is worth more than silence. */
export const UnresolvedObservationSchema = z
  .object({
    id: z.string().min(1),
    what: z.string().min(1),
    /** The asset it was looked for on, when the search was scoped to one. */
    assetId: z.string().optional(),
    reason: z.string().min(1),
    /** `MISSING` — looked for, not found. `AMBIGUOUS` — found, but could not be pinned down. `NOT_ATTEMPTED` — out of this stage's scope. */
    status: z.enum(['MISSING', 'AMBIGUOUS', 'NOT_ATTEMPTED']),
  })
  .strict()
export type UnresolvedObservation = z.infer<typeof UnresolvedObservationSchema>

// ---------------------------------------------------------------------------
// Frames and the graph
// ---------------------------------------------------------------------------

/**
 * A coordinate frame: one asset variant's pixel grid. Observations name a
 * frame rather than an asset alone, because the same drawing at two
 * resolutions is two grids and mixing them is the acquisition bug all over
 * again in a new place.
 */
export const SourceCoordinateFrameSchema = z
  .object({
    id: z.string().min(1),
    assetId: z.string().min(1),
    variantByteHash: z.string().regex(/^[0-9a-f]{64}$/),
    size: PixelSizeSchema,
    /** The asset's roles, copied so the graph can be read without the package beside it. */
    roles: z.object({ document: z.string(), storey: z.string(), annotation: z.string(), view: z.string(), projection: z.string() }).strict(),
  })
  .strict()
export type SourceCoordinateFrame = z.infer<typeof SourceCoordinateFrameSchema>

export const SourceObservationGraphSchema = z
  .object({
    schema: z.literal(OBSERVATION_GRAPH_SCHEMA),
    schemaVersion: z.enum(SUPPORTED_GRAPH_VERSIONS),
    id: z.string().min(1),
    /** The package these observations were made on. */
    sourcePackageId: z.string().min(1),
    sourcePackageHash: z.string().regex(/^[0-9a-f]{64}$/),
    /** Every extractor that contributed, with its version: part of the hash, because a different extractor is a different reading. */
    extractors: z.array(z.object({ name: z.string().min(1), version: z.string().min(1), kind: ExtractorKindSchema }).strict()),
    coordinateFrames: z.array(SourceCoordinateFrameSchema),
    observations: z.array(SourceObservationSchema),
    relations: z.array(ObservationRelationSchema),
    conflicts: z.array(ObservationConflictSchema),
    unresolved: z.array(UnresolvedObservationSchema),
    contentHash: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict()
export type SourceObservationGraph = z.infer<typeof SourceObservationGraphSchema>

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const observationsOn = (graph: SourceObservationGraph, frameId: string): SourceObservation[] => graph.observations.filter((o) => o.frameId === frameId)
export const observationsOfKind = (graph: SourceObservationGraph, kind: ObservationKind): SourceObservation[] => graph.observations.filter((o) => o.kind === kind)
export const observationById = (graph: SourceObservationGraph, id: string): SourceObservation | undefined => graph.observations.find((o) => o.id === id)
export const relationsFrom = (graph: SourceObservationGraph, id: string): ObservationRelation[] => graph.relations.filter((r) => r.from === id)

/** Every observation carrying a hint, whatever its kind — how a consumer asks "what looked like a facade frame anywhere?". */
export const observationsWithHint = (graph: SourceObservationGraph, hint: SemanticHint): SourceObservation[] => graph.observations.filter((o) => o.semanticHints.includes(hint))
