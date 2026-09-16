/**
 * MetricEvidenceSet — what a drawing STATES about its own measurements.
 *
 * The SourceObservationGraph records what was seen; this records what was
 * READ. They are different kinds of fact and they get different layers: an
 * edge found by a row scan is a pixel claim, and `+7,95` printed beside a
 * level line is a metric claim about the building. Only the second can ever
 * put a number in metres into a model, and only a handful of them exist on
 * any drawing, so each one is tracked individually, with its own provenance
 * and its own reasons to be doubted.
 *
 * Three rules hold everywhere in this file:
 *
 * - **The raw recognized text is never discarded.** `rawText` is what the
 *   reader saw, before parsing, before unit inference, before any chain
 *   arithmetic corrected it. A stage that keeps only the parsed number has
 *   thrown away the only thing a human can check.
 * - **A number that is not attached to something is not evidence.** Every
 *   piece of evidence names the geometry it measures and the observations
 *   that back it. OCR finding `415` somewhere on a page proves nothing; `415`
 *   sitting on a dimension line between two witness lines 41.5 px apart is a
 *   measurement.
 * - **Reading and believing are separate.** `confidence` is how sure the
 *   reader is of the characters; whether that becomes a hard constraint is
 *   the solver's decision, made later, from the whole picture.
 */
import { z } from 'zod'
import { PixelPointSchema, PixelRectSchema } from '@buildapp/source-common'
import { PixelGeometrySchema } from '@buildapp/source-observations'

export const METRIC_EVIDENCE_SCHEMA = 'buildapp.metric-evidence-set' as const
export const METRIC_EVIDENCE_SCHEMA_VERSION = '1.1.0' as const
export const SUPPORTED_METRIC_EVIDENCE_VERSIONS = ['1.0.0', '1.1.0'] as const

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/**
 * What a piece of metric evidence MEASURES.
 *
 * Kept deliberately close to what drawings actually print. A published
 * residential set states lengths along dimension lines, heights as level
 * datums against a zero, roof pitches as angles, rooms as areas in a table,
 * and openings as a `width/height` callout. Everything else a reconstruction
 * needs — wall thicknesses, storey heights, ridge positions — is DERIVED from
 * those, and derivation is the solver's job, not this layer's.
 */
export const MetricEvidenceKindSchema = z.enum([
  /** A length along a dimension line: the commonest and most authoritative kind. */
  'LINEAR_DIMENSION',
  /** A height against the drawing's zero, printed with a sign: `±0,00`, `+7,95`, `-0,32`. */
  'LEVEL_DATUM',
  /** A printed angle: a roof pitch, a splay. */
  'ANGLE',
  /** A room's floor area, from an area table or a room stamp. */
  'ROOM_AREA',
  /** The building's overall height, when the drawing states it rather than leaving it to two datums. */
  'BUILDING_HEIGHT',
  /** A statement of scale itself: a scale bar, a `1:100`, a known-length reference. */
  'SCALE_ANCHOR',
  /** An opening's size as a callout, usually `width/height` in centimetres. */
  'OPENING_CALLOUT',
  /** A run of consecutive dimensions that share a baseline and must sum. */
  'DIMENSION_CHAIN',
])
export type MetricEvidenceKind = z.infer<typeof MetricEvidenceKindSchema>

/** The unit a value is stated in. Values are stored as read; conversion is explicit and one-way. */
export const MetricUnitSchema = z.enum(['m', 'cm', 'mm', 'deg', 'm2'])
export type MetricUnit = z.infer<typeof MetricUnitSchema>

/** How a value was arrived at. `DERIVED` values can be as good as read ones, and must never be mistaken for them. */
export const MetricOriginSchema = z.enum([
  /** Read off the drawing by OCR, as printed. */
  'READ',
  /** Read, then corrected by the chain it belongs to. The original reading survives in `rawText` and `alternatives`. */
  'CHAIN_CORRECTED',
  /** Not printed anywhere: computed from other evidence, e.g. a chain's total from its segments. */
  'DERIVED',
  /** Stated by the source package's own metadata rather than by the drawing. */
  'PUBLISHED_METADATA',
])
export type MetricOrigin = z.infer<typeof MetricOriginSchema>

// ---------------------------------------------------------------------------
// OCR tokens
// ---------------------------------------------------------------------------

/** One recognized character, with the characters that would also have fitted. */
export const OcrGlyphSchema = z
  .object({
    char: z.string().min(1).max(2),
    /** How well the cell matched its winner, 0..1. */
    score: z.number().min(0).max(1),
    /** How much better the winner was than the runner-up, 0.5..1. A clean match that is not DECIDED is not trustworthy. */
    confidence: z.number().min(0).max(1),
    box: PixelRectSchema,
    alternatives: z.array(z.object({ char: z.string().min(1).max(2), score: z.number().min(0).max(1) }).strict()),
  })
  .strict()
export type OcrGlyph = z.infer<typeof OcrGlyphSchema>

/**
 * One run of characters as the reader saw it, BEFORE any interpretation.
 *
 * This is the layer's audit trail. Every piece of evidence cites the tokens it
 * came from, so a disputed dimension can be traced to a character, to a box on
 * a named asset, to the exact bytes that box was read from.
 */
export const OcrTokenSchema = z
  .object({
    id: z.string().min(1),
    frameId: z.string().min(1),
    assetId: z.string().min(1),
    variantByteHash: z.string().regex(/^[0-9a-f]{64}$/),
    /** Exactly what was read, joined. Never normalized, never corrected in place. */
    text: z.string().min(1),
    /** The weakest glyph's match score: a number is only as good as its worst character. */
    score: z.number().min(0).max(1),
    /** The weakest glyph's decidedness. */
    confidence: z.number().min(0).max(1),
    box: PixelRectSchema,
    /** Cap height in pixels: the size the text was set at, which is most of what separates a dimension from a room number. */
    heightPx: z.number().positive(),
    /** The italic slant that had to be removed to read it. */
    shearDeg: z.number().finite(),
    glyphs: z.array(OcrGlyphSchema).min(1),
  })
  .strict()
export type OcrToken = z.infer<typeof OcrTokenSchema>

// ---------------------------------------------------------------------------
// Association
// ---------------------------------------------------------------------------

/**
 * WHY a number is believed to measure a particular thing.
 *
 * A reader that accepts a number because it found it somewhere on the page has
 * not produced evidence. The association is the evidence: the number sits on
 * this dimension line, between these two witness lines, beside this level
 * marker, inside this opening symbol.
 */
export const AssociationKindSchema = z.enum([
  'DIMENSION_LINE',
  'WITNESS_LINE_PAIR',
  'LEVEL_MARKER',
  'ANGLE_MARKER',
  'OPENING_SYMBOL',
  'ROOM_STAMP',
  'SCALE_BAR',
  /**
   * The number was printed in the publisher's own technical specification
   * rather than on a drawing. There is no geometry to attach it to and none is
   * needed: "dach: dwuspadowy, nachylenie 40 st." states the pitch more plainly
   * than any drawn triangle does.
   */
  'PUBLISHED_SPECIFICATION',
  /** The number was read but could not be attached to anything. Kept, never used as a constraint. */
  'UNATTACHED',
])
export type AssociationKind = z.infer<typeof AssociationKindSchema>

export const AssociationSchema = z
  .object({
    kind: AssociationKindSchema,
    /** How good the attachment is, 0..1: distance to the feature, against the text's own size. */
    score: z.number().min(0).max(1),
    /** A sentence a human can check: "3.1 px from the chain baseline, inside the 41.5 px segment between ticks 2 and 3". */
    why: z.string().min(1),
    /** The observations the number was attached TO. */
    observationIds: z.array(z.string().min(1)),
  })
  .strict()
export type Association = z.infer<typeof AssociationSchema>

export const MetricProvenanceSchema = z
  .object({
    extractor: z.enum(['NUMERIC_OCR', 'CHAIN_SOLVER', 'REGISTRATION', 'PACKAGE_METADATA', 'DERIVED']),
    name: z.string().min(1),
    detail: z.string(),
  })
  .strict()
export type MetricProvenance = z.infer<typeof MetricProvenanceSchema>

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

/** A reading that would also have fitted. Kept so a later stage can revisit a decision this one made badly. */
export const MetricAlternativeSchema = z
  .object({
    value: z.number().finite(),
    unit: MetricUnitSchema,
    rawText: z.string(),
    confidence: z.number().min(0).max(1),
    why: z.string().min(1),
  })
  .strict()
export type MetricAlternative = z.infer<typeof MetricAlternativeSchema>

export const MetricEvidenceSchema = z
  .object({
    id: z.string().min(1),
    kind: MetricEvidenceKindSchema,
    frameId: z.string().min(1),
    assetId: z.string().min(1),
    variantByteHash: z.string().regex(/^[0-9a-f]{64}$/),
    value: z.number().finite(),
    unit: MetricUnitSchema,
    origin: MetricOriginSchema,
    /** Exactly what the reader saw. Never discarded, whatever the parse or the chain later decided. */
    rawText: z.string(),
    /** Where the characters are printed. */
    textBox: PixelRectSchema.optional(),
    /** What the number measures, in the frame's pixels: a dimension line, a level line, an opening's mouth. */
    measuredGeometry: PixelGeometrySchema.optional(),
    /** The length of that geometry in pixels, when the value is a length: this and `value` together give a scale. */
    pixelLength: z.number().nonnegative().optional(),
    association: AssociationSchema,
    /** The chain this belongs to, when it belongs to one. */
    chainId: z.string().min(1).optional(),
    ocrTokenIds: z.array(z.string().min(1)),
    observationIds: z.array(z.string().min(1)),
    alternatives: z.array(MetricAlternativeSchema),
    confidence: z.number().min(0).max(1),
    provenance: MetricProvenanceSchema,
    note: z.string().optional(),
  })
  .strict()
export type MetricEvidence = z.infer<typeof MetricEvidenceSchema>

// ---------------------------------------------------------------------------
// Dimension chains
// ---------------------------------------------------------------------------

/**
 * One cell of a chain: the span between two consecutive witness lines.
 *
 * A segment knows its pixel length whether or not anyone managed to read the
 * number printed on it, which is the whole reason chains are worth building. A
 * chain with one confident reading fixes a scale; that scale then says what
 * every other segment in the chain must be, and an unreadable segment becomes
 * a derivable one rather than a hole.
 */
export const ChainSegmentSchema = z
  .object({
    index: z.number().int().nonnegative(),
    /** Position along the chain's axis, in the frame's pixels. */
    fromPx: z.number().finite(),
    toPx: z.number().finite(),
    pixelLength: z.number().positive(),
    /** The evidence printed on this segment, when a number was read there. */
    evidenceId: z.string().min(1).optional(),
    /** The value this segment is taken to have, in centimetres, and where it came from. */
    valueCm: z.number().positive().optional(),
    origin: MetricOriginSchema.optional(),
    confidence: z.number().min(0).max(1),
    /** Residual against the chain's scale, in centimetres: how far the reading is from what the pixels say. */
    residualCm: z.number().optional(),
  })
  .strict()
export type ChainSegment = z.infer<typeof ChainSegmentSchema>

export const DimensionChainSchema = z
  .object({
    id: z.string().min(1),
    frameId: z.string().min(1),
    assetId: z.string().min(1),
    /** The axis the chain runs along in the frame's pixels. */
    axis: z.enum(['HORIZONTAL', 'VERTICAL']),
    /** Where the chain's baseline sits on the other axis, in pixels. */
    baselinePx: z.number().finite(),
    /** The witness-line positions, ascending, in pixels along the chain's axis. */
    ticksPx: z.array(z.number().finite()).min(2),
    segments: z.array(ChainSegmentSchema),
    /**
     * The sum of the segment values. This is the chain's own arithmetic and it
     * is stated separately from any printed total, because a chain that sums
     * to something other than its printed total is a fact worth keeping, not
     * an error to hide.
     */
    derivedTotalCm: z.number().positive().optional(),
    /** A total printed for the chain as a whole, when one is. */
    printedTotal: z.object({ evidenceId: z.string().min(1), valueCm: z.number().positive() }).strict().optional(),
    /** Centimetres per pixel implied by the chain's own readings, with the spread of the fit. */
    scale: z.object({ cmPerPixel: z.number().positive(), residualRatio: z.number().nonnegative(), readSegments: z.number().int().nonnegative() }).strict().optional(),
    /** True when every segment has a value and they sum to the printed total within tolerance. */
    closes: z.boolean(),
    observationIds: z.array(z.string().min(1)),
    ocrTokenIds: z.array(z.string().min(1)),
    note: z.string().optional(),
  })
  .strict()
export type DimensionChain = z.infer<typeof DimensionChainSchema>

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * The plane a drawing's pixels map onto.
 *
 * A plan is a horizontal cut, so its two pixel axes are the world's x and z. An
 * elevation and a section are vertical cuts, so one pixel axis is a horizontal
 * world direction and the other is the world's y. Which horizontal direction
 * an elevation shows is a question about the building, not about the image, so
 * it is NOT decided here.
 */
export const RegistrationPlaneSchema = z.enum(['PLAN_XZ', 'ELEVATION_HY', 'SECTION_HY'])
export type RegistrationPlane = z.infer<typeof RegistrationPlaneSchema>

/** One thing the registration was fitted to, and how well it ended up fitting. */
export const RegistrationAnchorSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(['CHAIN_SEGMENT', 'CHAIN_TOTAL', 'PRINTED_DIMENSION', 'LEVEL_DATUM_PAIR', 'SCALE_BAR']),
    evidenceIds: z.array(z.string().min(1)).min(1),
    /** Along which pixel axis this anchor constrains the scale. */
    axis: z.enum(['X', 'Y']),
    /** The anchor's span in pixels and the metres it is stated to be. */
    pixelSpan: z.number().positive(),
    metricSpan: z.number(),
    /** Residual in metres after the fit. */
    residualM: z.number(),
    weight: z.number().nonnegative(),
  })
  .strict()
export type RegistrationAnchor = z.infer<typeof RegistrationAnchorSchema>

/**
 * A frame's pixel grid, tied to a metric frame.
 *
 * Deliberately an AXIS-ALIGNED AFFINE map and nothing more: a scale per pixel
 * axis, a sign per axis, and an origin. No rotation, no perspective, no camera.
 * An orthographic drawing on a published sheet is axis-aligned by construction,
 * and fitting a camera to one is fitting noise. The two scales are kept
 * separate rather than averaged because a scan, a crop and a resize all stretch
 * one axis and not the other, and `anisotropy` states how much.
 */
export const CoordinateRegistrationSchema = z
  .object({
    id: z.string().min(1),
    frameId: z.string().min(1),
    assetId: z.string().min(1),
    variantByteHash: z.string().regex(/^[0-9a-f]{64}$/),
    plane: RegistrationPlaneSchema,
    /** Metres per pixel along each pixel axis, separately. */
    metresPerPixelX: z.number().positive(),
    metresPerPixelY: z.number().positive(),
    /** How far from square the pixels are: `max/min` of the two scales, 1 when square. */
    anisotropy: z.number().min(1),
    /** The pixel that maps to the metric origin. */
    originPx: PixelPointSchema,
    /** Whether each pixel axis runs opposite to its world axis. Image y grows downwards, so `flipY` is normally true. */
    flipX: z.boolean(),
    flipY: z.boolean(),
    anchors: z.array(RegistrationAnchorSchema),
    /** Anchors the fit threw out, and why. A registration that silently absorbs an outlier is a registration that lies. */
    rejected: z.array(z.object({ id: z.string().min(1), evidenceIds: z.array(z.string().min(1)), why: z.string().min(1), residualM: z.number() }).strict()),
    residual: z.object({ rmsM: z.number().nonnegative(), maxM: z.number().nonnegative(), rmsPx: z.number().nonnegative() }).strict(),
    confidence: z.number().min(0).max(1),
    provenance: MetricProvenanceSchema,
    note: z.string().optional(),
  })
  .strict()
export type CoordinateRegistration = z.infer<typeof CoordinateRegistrationSchema>

// ---------------------------------------------------------------------------
// Conflicts, gaps and the set
// ---------------------------------------------------------------------------

/** Two metric statements that cannot both be true. Recorded, never averaged into a compromise neither drawing states. */
export const MetricConflictSchema = z
  .object({
    id: z.string().min(1),
    evidenceIds: z.array(z.string().min(1)).min(2),
    kind: z.enum(['CHAIN_DOES_NOT_SUM', 'SCALE_DISAGREEMENT', 'CONTRADICTORY_DIMENSION', 'DATUM_DISAGREEMENT', 'UNIT_AMBIGUOUS']),
    what: z.string().min(1),
    magnitude: z.number().nonnegative().optional(),
    unit: MetricUnitSchema.optional(),
    note: z.string().optional(),
  })
  .strict()
export type MetricConflict = z.infer<typeof MetricConflictSchema>

/** Something metric this pass looked for and could not establish. A named hole beats a confident invention. */
export const UnresolvedMetricSchema = z
  .object({
    id: z.string().min(1),
    what: z.string().min(1),
    frameId: z.string().optional(),
    reason: z.string().min(1),
    status: z.enum(['MISSING', 'AMBIGUOUS', 'NOT_ATTEMPTED']),
    /** The tokens that were read but could not be turned into evidence, when that is why. */
    ocrTokenIds: z.array(z.string().min(1)).optional(),
  })
  .strict()
export type UnresolvedMetric = z.infer<typeof UnresolvedMetricSchema>

/**
 * What the publisher's printed specification says about the building, beyond
 * its numbers.
 *
 * A roof's KIND and whether it has eaves are not measurements, so they are not
 * evidence in the metric sense, and they are exactly the sort of thing that a
 * silhouette fit will otherwise decide for itself. They are kept here, beside
 * the pitch that came from the same sentence, because the sentence is one
 * statement and splitting it across two artifacts loses the fact that they
 * corroborate each other.
 */
export const SpecificationFindingSchema = z
  .object({
    /** The specification key the finding was read from. */
    key: z.string().min(1),
    subject: z.enum(['ROOF_KIND', 'ROOF_EAVES', 'STOREY_COUNT', 'GARAGE_PRESENT']),
    value: z.string().min(1),
    /** The words that said so, quoted from the specification. */
    quote: z.string().min(1),
    confidence: z.number().min(0).max(1),
    why: z.string().min(1),
  })
  .strict()
export type SpecificationFinding = z.infer<typeof SpecificationFindingSchema>

export const MetricEvidenceSetSchema = z
  .object({
    schema: z.literal(METRIC_EVIDENCE_SCHEMA),
    schemaVersion: z.enum(SUPPORTED_METRIC_EVIDENCE_VERSIONS),
    id: z.string().min(1),
    /** Both inputs are named by hash: this set is only valid for these exact bytes. */
    sourcePackageId: z.string().min(1),
    sourcePackageHash: z.string().regex(/^[0-9a-f]{64}$/),
    observationGraphId: z.string().min(1),
    observationGraphHash: z.string().regex(/^[0-9a-f]{64}$/),
    extractors: z.array(z.object({ name: z.string().min(1), version: z.string().min(1) }).strict()),
    ocrTokens: z.array(OcrTokenSchema),
    evidence: z.array(MetricEvidenceSchema),
    chains: z.array(DimensionChainSchema),
    coordinateRegistrations: z.array(CoordinateRegistrationSchema),
    /** Non-numeric statements from the publisher's technical specification. Empty when the package carries none. */
    specificationFindings: z.array(SpecificationFindingSchema).default([]),
    conflicts: z.array(MetricConflictSchema),
    unresolved: z.array(UnresolvedMetricSchema),
    contentHash: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict()
export type MetricEvidenceSet = z.infer<typeof MetricEvidenceSetSchema>

// ---------------------------------------------------------------------------
// Queries and conversions
// ---------------------------------------------------------------------------

/** Metres, from whatever length unit the value is stated in. Angles and areas are refused rather than guessed at. */
export function toMetres(value: number, unit: MetricUnit): number {
  if (unit === 'm') return value
  if (unit === 'cm') return value / 100
  if (unit === 'mm') return value / 1000
  throw new Error(`toMetres: ${unit} is not a length`)
}

/** Centimetres, the unit chains do their arithmetic in because that is the unit plans print. */
export function toCentimetres(value: number, unit: MetricUnit): number {
  if (unit === 'cm') return value
  if (unit === 'm') return value * 100
  if (unit === 'mm') return value / 10
  throw new Error(`toCentimetres: ${unit} is not a length`)
}

export const LENGTH_UNITS: readonly MetricUnit[] = ['m', 'cm', 'mm']
export const isLengthUnit = (unit: MetricUnit): boolean => LENGTH_UNITS.includes(unit)

export const evidenceOn = (set: MetricEvidenceSet, frameId: string): MetricEvidence[] => set.evidence.filter((e) => e.frameId === frameId)
export const evidenceOfKind = (set: MetricEvidenceSet, kind: MetricEvidenceKind): MetricEvidence[] => set.evidence.filter((e) => e.kind === kind)
export const registrationFor = (set: MetricEvidenceSet, frameId: string): CoordinateRegistration | undefined => set.coordinateRegistrations.find((r) => r.frameId === frameId)
