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
export const METRIC_EVIDENCE_SCHEMA_VERSION = '1.5.0' as const
/**
 * 005H (1.6.0): a set read with an external numeric recogniser carries the recogniser, each lattice's external reading
 * and ensemble decision, and each observation's ensemble summary. A set read without one has none of them and is,
 * byte for byte, a 1.5.0 set: it keeps that version, so its hash names the reader that produced it.
 */
export const METRIC_EVIDENCE_ENSEMBLE_SCHEMA_VERSION = '1.6.0' as const
/**
 * 005I (1.7.0 without a recogniser, 1.8.0 with one): the dimension topology between neighbouring lines — label-ink
 * marks (`TEXT_INK`), the global label assignment, axis groups, each chain's place in its group and each segment's label.
 * The 1.5.0 / 1.6.0 constants stay for reading older sets; a set read now is one of these two.
 */
export const METRIC_EVIDENCE_TOPOLOGY_SCHEMA_VERSION = '1.7.0' as const
export const METRIC_EVIDENCE_TOPOLOGY_ENSEMBLE_SCHEMA_VERSION = '1.8.0' as const
export const SUPPORTED_METRIC_EVIDENCE_VERSIONS = ['1.0.0', '1.1.0', '1.2.0', '1.3.0', '1.4.0', '1.5.0', '1.6.0', '1.7.0', '1.8.0'] as const

/** Why a crossing mark is doubted or rejected (005D; `TEXT_INK` 005I: label ink beside the line, not a stroke across it). */
export const DimensionMarkReasonSchema = z.enum(['LIGHTER_THAN_LINE', 'FAINT_SIDE', 'ONE_SIDED', 'WEDGE_NOT_STROKE', 'COLOUR_MISMATCH', 'DUPLICATE', 'STYLE_MISMATCH', 'NO_LINE_REFERENCE', 'TEXT_INK'])

/** 005E: the four reading-quality classes the numeric lattice gives an ink, from the image alone. */
export const OcrClassSchema = z.enum(['CLEAR', 'SUPPORTED', 'AMBIGUOUS', 'LOW_QUALITY'])

/** 005H: the P2 ensemble's decisions (`ensemble.ts`). */
export const EnsembleDecisionSchema = z.enum(['NO_VALUE', 'NOT_COMPARABLE', 'NOT_CORROBORATING', 'AGREES', 'CONTESTS', 'CONTESTS_COUNT', 'LEADS'])

const Sha256Schema = z.string().regex(/^[0-9a-f]{64}$/)
const ProbabilitySchema = z.number().min(0).max(1)

/** 005H: an external recogniser's reading of one label crop — candidates, never a value (`recogniser.ts`). */
export const ExternalReadingRecordSchema = z
  .object({
    engine: z.string().min(1),
    modelSha256: Sha256Schema,
    runtime: z.string().min(1),
    topK: z.array(z.object({ text: z.string().min(1), p: ProbabilitySchema }).strict()),
    greedy: z.object({ text: z.string(), meanP: ProbabilitySchema }).strict(),
    stable: z.boolean(),
    variants: z.array(z.object({ variant: z.enum(['BASE', 'PAD2', 'TRIM1', 'SCALE90']), top: z.string(), p: ProbabilitySchema }).strict()),
  })
  .strict()

/** 005H: what the ensemble rule made of the lattice's and the external reader's readings of one ink. */
export const LabelEnsembleRecordSchema = z
  .object({
    decision: EnsembleDecisionSchema,
    external: z.object({ text: z.string(), valueCm: z.number().positive().optional(), posterior: ProbabilitySchema, meanP: ProbabilitySchema, stable: z.boolean(), confident: z.boolean() }).strict(),
    lattice: z.object({ asRead: z.string(), valueCm: z.number().positive().optional(), ocrClass: OcrClassSchema }).strict(),
    asRead: z.string(),
    asReadValueCm: z.number().positive().optional(),
    ocrClass: OcrClassSchema,
    rival: z.object({ text: z.string().min(1), valueCm: z.number().positive(), witness: z.enum(['EXTERNAL', 'LATTICE']) }).strict().optional(),
    why: z.string().min(1),
  })
  .strict()

/** 005H: the recogniser a set was read with. */
export const RecogniserRecordSchema = z.object({ id: z.string().min(1), model: z.object({ name: z.string().min(1), sha256: Sha256Schema }).strict(), runtime: z.string().min(1), runtimeSha256: Sha256Schema.optional() }).strict()

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

/** Which way up a run of text was read: the pass that read it (see `TextOrientation` in `ocr.ts`). */
export const TextOrientationSchema = z.enum(['HORIZONTAL', 'ROTATED_CW', 'ROTATED_CCW', 'INVERTED'])

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
    /** Which pass read it, and so which way up the text was taken to be (1.2.0; absent on older sets). */
    orientation: TextOrientationSchema.optional(),
    /**
     * Whether the legacy page-wide orientation vote kept this reading (1.2.0, floor plans only).
     * Every pass's reading is kept in the evidence; a DISCARDED one is raw evidence for the metric
     * solver and not a token any legacy reader (room labels, datums, callouts) was ever shown.
     */
    pageVote: z.enum(['KEPT', 'DISCARDED']).optional(),
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
    /**
     * How the value relates to what was printed (1.2.0). `rawText` is what the
     * reader saw; when the value is not that reading, this says what it was
     * turned into, why, and whether a scale chose it — a value a scale chose
     * may never be a witness for that scale.
     */
    derivation: z
      .object({
        rawText: z.string(),
        orientation: TextOrientationSchema.optional(),
        valueText: z.string(),
        substitutions: z.number().int().nonnegative(),
        dependsOnScale: z.boolean(),
        why: z.string().min(1),
      })
      .strict()
      .optional(),
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
    /** 005I (1.7.0): a number is printed on this segment and was bound to it, whether or not it could be read at the scale. */
    labelled: z.literal(true).optional(),
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
    /**
     * 005D (schema 1.3.0): what each crossing mark is, one per `ticksPx` entry — a TICK, QUESTIONABLE
     * (a span may run across it or stop at it) or REJECTED (not a measurement point) — and why.
     */
    marks: z
      .array(z.object({ atPx: z.number().finite(), class: z.enum(['TICK', 'QUESTIONABLE', 'REJECTED']), reasons: z.array(DimensionMarkReasonSchema) }).strict())
      .optional(),
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
    /**
     * 005I (1.7.0): the chain's place among its neighbouring parallel lines (`dimensionAxisGroups`): its group, what it
     * is to the others (OVERALL: another line subdivides it; SUBDIVISION: it subdivides another; PARTIAL; INDEPENDENT),
     * and whether a neighbour has a mark at each of its two ends.
     */
    topology: z
      .object({ groupId: z.string().min(1), roles: z.array(z.enum(['OVERALL', 'SUBDIVISION', 'PARTIAL', 'INDEPENDENT'])).min(1), alignedEnds: z.tuple([z.boolean(), z.boolean()]) })
      .strict()
      .optional(),
  })
  .strict()
export type DimensionChain = z.infer<typeof DimensionChainSchema>

const SideConventionRecordSchema = z
  .object({
    side: z.enum(['BEFORE', 'AFTER']).nullable(),
    basis: z.enum(['STATED', 'CONSISTENT', 'SILENT', 'CONTRADICTED']),
    anchors: z.object({ before: z.number().int().nonnegative(), across: z.number().int().nonnegative(), after: z.number().int().nonnegative() }).strict(),
  })
  .strict()
const SideConventionsRecordSchema = z.object({ HORIZONTAL: SideConventionRecordSchema, VERTICAL: SideConventionRecordSchema }).strict()

/** 005I: one label's place in the global assignment (`assignLabels`), with every line it could have named. */
export const LabelAssignmentRecordSchema = z
  .object({
    text: z.string().min(1),
    orientation: TextOrientationSchema,
    box: PixelRectSchema,
    status: z.enum(['BOUND', 'AMBIGUOUS', 'UNASSIGNED']),
    chosen: z.object({ chainId: z.string().min(1), interval: z.number().int().nonnegative() }).strict().optional(),
    margin: z.number().optional(),
    bounded: z.literal(true).optional(),
    candidates: z.array(
      z
        .object({
          chainId: z.string().min(1),
          interval: z.number().int().nonnegative(),
          offset: z.number().nonnegative(),
          /** Where the label lies on the page with respect to the line (above / left of it: BEFORE). */
          side: z.enum(['BEFORE', 'ACROSS', 'AFTER']),
          /** It lies on the side the sheet's convention does not print on, and paid for it. */
          againstConvention: z.boolean(),
          centred: z.boolean(),
          cost: z.number(),
        })
        .strict(),
    ),
  })
  .strict()
export type LabelAssignmentRecord = z.infer<typeof LabelAssignmentRecordSchema>

/**
 * 005I (1.7.0): a plan frame's dimension topology — the marks label ink made (and the lines nothing else made), the
 * parallel lines grouped with how they stand to each other, and the global label assignment: the page vote's (`legacy`)
 * and, where the solver read the chains again, its own (`final`).
 */
export const DimensionTopologyRecordSchema = z
  .object({
    frameId: z.string().min(1),
    labelHeightPx: z.number().positive(),
    labelInkMarks: z.array(z.object({ chainId: z.string().min(1), atPx: z.number().finite(), class: z.enum(['QUESTIONABLE', 'REJECTED']) }).strict()),
    labelInkLines: z.array(z.object({ axis: z.enum(['HORIZONTAL', 'VERTICAL']), baselinePx: z.number().finite(), fromPx: z.number().finite(), toPx: z.number().finite(), marks: z.number().int().nonnegative() }).strict()),
    groups: z.array(
      z
        .object({
          id: z.string().min(1),
          axis: z.enum(['HORIZONTAL', 'VERTICAL']),
          chainIds: z.array(z.string().min(1)).min(1),
          separations: z.array(z.object({ fromChainId: z.string().min(1), toChainId: z.string().min(1), px: z.number().nonnegative(), heights: z.number().nonnegative() }).strict()),
          relations: z.array(z.object({ aChainId: z.string().min(1), bChainId: z.string().min(1), kind: z.enum(['SUBDIVIDES', 'CONTAINS', 'OVERLAPS']), alignedEnds: z.tuple([z.boolean(), z.boolean()]) }).strict()),
        })
        .strict(),
    ),
    assignment: z.object({ legacy: z.array(LabelAssignmentRecordSchema), final: z.array(LabelAssignmentRecordSchema).optional() }).strict(),
    /** The side convention each assignment read from the sheet's uncontested labels (`sideConventionsOf`). */
    sideConventions: z.object({ legacy: SideConventionsRecordSchema, final: SideConventionsRecordSchema.optional() }).strict(),
  })
  .strict()
export type DimensionTopologyRecord = z.infer<typeof DimensionTopologyRecordSchema>

// ---------------------------------------------------------------------------
// Dimension evidence (1.2.0, BUILDPLAN-ANALYZER-005B)
// ---------------------------------------------------------------------------

/**
 * One number printed on a chain, bound to the two ticks it could be
 * measuring, as READ — never as corrected.
 *
 * A reading only becomes a physical dimension when it is bound to endpoints:
 * this record is that binding, one per (reading, span) pair, for every way up
 * the ink was read. The same ink read in two passes is two records with one
 * `textRegionId`, and at most one of them can be what is printed.
 */
export const DimensionObservationSchema = z
  .object({
    id: z.string().min(1),
    frameId: z.string().min(1),
    chainId: z.string().min(1),
    /** The ink this was read from; the same region read another way up shares it. */
    textRegionId: z.string().min(1),
    orientation: TextOrientationSchema,
    /** Exactly what the pass read. Never a substitution. */
    rawText: z.string().min(1),
    valueCm: z.number().positive(),
    axis: z.enum(['X', 'Y']),
    /** The ticks the number is bound to, along the chain's axis, in the frame's pixels. */
    fromPx: z.number().finite(),
    toPx: z.number().finite(),
    spanPx: z.number().positive(),
    impliedCmPerPx: z.number().positive(),
    ocrScore: z.number().min(0).max(1),
    ocrConfidence: z.number().min(0).max(1),
    /** A cm dimension is never printed with a leading zero; a trailing zero turned half a turn is one. */
    leadingZero: z.boolean(),
    /**
     * INDEPENDENT: its orientation was settled without the scale it is weighed against.
     * ORIENTATION_BY_OTHER_AXIS: the other axis's scale chose which way up it is, so it is not a witness of isotropy.
     * ORIENTATION_UNDECIDED: nothing settled which way up it is; it witnesses nothing.
     * ORIENTATION_BY_SCALE: its way up was chosen because, read so, it fits a scale other labels state; it
     * witnesses nothing about that scale.
     */
    independence: z.enum(['INDEPENDENT', 'ORIENTATION_BY_OTHER_AXIS', 'ORIENTATION_UNDECIDED', 'ORIENTATION_BY_SCALE']),
    /** RAW until the frame is solved; ACCEPTED when it became a READ segment, REJECTED when the chosen scale contradicts it. */
    status: z.enum(['RAW', 'ACCEPTED', 'REJECTED']),
    /**
     * 005D (schema 1.3.0): how this span stands among the spans the same label could measure.
     * PRIMARY: the one it measures (centred, the fewest questionable ends); ALTERNATIVE: another
     * candidate, recorded and never a witness; AMBIGUOUS: the label ties between spans of different
     * length and measures none decisively; UNCENTRED: no candidate is centred on the label.
     */
    binding: z
      .object({
        role: z.enum(['PRIMARY', 'ALTERNATIVE', 'AMBIGUOUS', 'UNCENTRED']),
        offsetShare: z.number().nonnegative(),
        questionableEnds: z.number().int().nonnegative(),
        skipped: z.object({ tick: z.number().int().nonnegative(), questionable: z.number().int().nonnegative(), rejected: z.number().int().nonnegative() }).strict(),
      })
      .strict()
      .optional(),
    /** 005D: the values this ink may be within one character the matcher half-saw (V1). Never witnesses on their own. 005E: the lattice's other values. */
    valueAlternatives: z.array(z.object({ text: z.string().min(1), valueCm: z.number().positive(), ratio: z.number().min(0).max(1) }).strict()).optional(),
    /**
     * 005E (schema 1.4.0): the ink's numeric lattice and what became of its values. `rawText` is the lattice's
     * as-read string; `rawTopText` what the 005D reader read. `selected` is the value the span is given once a scale
     * is chosen — AS_READ, STRUCTURAL (the one assignment its total and children agree on), SCALE_RANKED (the
     * best-image value that fits the chosen scale: DERIVED, never a witness) or UNRESOLVED — with its image score and
     * its metric support recorded apart. `refutedBy` marks an as-read value its own hierarchy refuted.
     */
    ocr: z
      .object({
        latticeId: z.string().min(1),
        rawTopText: z.string().min(1),
        ocrClass: OcrClassSchema,
        asReadP: z.number().min(0).max(1),
        probabilityMargin: z.number().finite(),
        asReadVariant: z.enum(['DEFAULT', 'STRICT', 'SAUVOLA']),
        selected: z
          .object({
            by: z.enum(['AS_READ', 'STRUCTURAL', 'SCALE_RANKED', 'UNRESOLVED']),
            text: z.string().min(1).optional(),
            valueCm: z.number().positive().optional(),
            imageScore: z.number().min(0).max(1).optional(),
            imageRank: z.number().int().nonnegative().optional(),
            metricResidualPx: z.number().nonnegative().optional(),
          })
          .strict()
          .optional(),
        refutedBy: z.literal('STRUCTURAL').optional(),
        /**
         * 005H (schema 1.6.0): when an external recogniser read the ink, what the ensemble rule decided and the two
         * readings it decided between; `ocrClass` above and `rawText` are then the ensemble's.
         */
        ensemble: z
          .object({ decision: EnsembleDecisionSchema, latticeAsRead: z.string(), latticeClass: OcrClassSchema, externalText: z.string(), externalPosterior: ProbabilitySchema, externalStable: z.boolean() })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
export type DimensionObservation = z.infer<typeof DimensionObservationSchema>

/** Which way up one chain's labels were taken to be, and on what evidence. */
export const OrientationDecisionSchema = z
  .object({
    chainId: z.string().min(1),
    axis: z.enum(['X', 'Y']),
    chosen: TextOrientationSchema.nullable(),
    decidedBy: z.enum(['SINGLE_READING', 'CHAIN_SELF_CONSISTENCY', 'AXIS_SELF_CONSISTENCY', 'TYPOGRAPHY', 'AXIS_MAJORITY', 'PAGE_UPRIGHT', 'OTHER_AXIS_SCALE', 'UNDECIDED']),
    candidates: z.array(
      z
        .object({
          orientation: TextOrientationSchema,
          readings: z.number().int().nonnegative(),
          selfConsistent: z.number().int().nonnegative(),
          leadingZeros: z.number().int().nonnegative(),
          otherAxisFits: z.number().int().nonnegative(),
          merit: z.number().nonnegative(),
        })
        .strict(),
    ),
    why: z.string().min(1),
  })
  .strict()
export type OrientationDecision = z.infer<typeof OrientationDecisionSchema>

/** One scale the frame's raw readings support, with its witnesses counted by independence. */
export const ScaleHypothesisSchema = z
  .object({
    id: z.string().min(1),
    cmPerPixel: z.number().positive(),
    /** Distinct pieces of ink within tolerance of it, one per text region. */
    witnessIds: z.array(z.string().min(1)),
    groups: z.number().int().nonnegative(),
    independentGroups: z.number().int().nonnegative(),
    chains: z.number().int().nonnegative(),
    /** Axes carrying at least one INDEPENDENT witness. */
    independentAxes: z.array(z.enum(['X', 'Y'])),
    weight: z.number().nonnegative(),
    independentWeight: z.number().nonnegative(),
    /** The longest independent witness, as a share of the longest chain on its axis. */
    longestShare: z.number().min(0),
    /** Independent witnesses measuring at least a quarter of their axis (substantial), and at least half of it (major). */
    substantialWitnesses: z.number().int().nonnegative(),
    majorWitnesses: z.number().int().nonnegative(),
    /** A major reading and a second substantial one, on another chain, agree. */
    corroborated: z.boolean(),
    /** Each axis carries a substantial independent reading, and one of them is major. */
    axesMeasured: z.boolean(),
    residualPx: z.number().nonnegative(),
    plausible: z.boolean(),
    why: z.string().min(1),
  })
  .strict()
export type ScaleHypothesis = z.infer<typeof ScaleHypothesisSchema>

/** How much the chosen metric solution of a frame can be believed, and why. */
export const MetricConfidenceSchema = z.enum(['STRONG', 'SUPPORTED', 'WEAK', 'INCONCLUSIVE'])
export type MetricConfidence = z.infer<typeof MetricConfidenceSchema>

/**
 * A plan frame's metric solution, decided from independent evidence only.
 *
 * `relation` says what happened to the scale the legacy pooled vote chose:
 *   CONFIRMED           independent readings agree with it; its numbers are kept as they were
 *   REPLACED            independent readings contradict it and outweigh whatever supports it
 *   LEGACY_UNCONFIRMED  it is kept, but nothing independent supports it beyond what `legacy` counts
 *   ADDED               the legacy vote had no scale; independent readings state one
 *   NO_SCALE            neither has one
 */
export const FrameMetricSolutionSchema = z
  .object({
    frameId: z.string().min(1),
    assetId: z.string().min(1),
    relation: z.enum(['CONFIRMED', 'REPLACED', 'LEGACY_UNCONFIRMED', 'ADDED', 'NO_SCALE']),
    confidence: MetricConfidenceSchema,
    cmPerPixelX: z.number().positive().optional(),
    cmPerPixelY: z.number().positive().optional(),
    anisotropy: z.number().min(1).optional(),
    /** MEASURED when each axis has its own independent witness; ASSUMED when one axis borrows the other's. */
    isotropy: z.enum(['MEASURED', 'ASSUMED', 'NONE']),
    selectedHypothesisId: z.string().min(1).optional(),
    hypotheses: z.array(ScaleHypothesisSchema),
    legacy: z
      .object({
        cmPerPixel: z.number().positive().optional(),
        independentGroups: z.number().int().nonnegative(),
        independentWeight: z.number().nonnegative(),
        correctedAnchors: z.number().int().nonnegative(),
        readAnchors: z.number().int().nonnegative(),
      })
      .strict(),
    independentWitnesses: z.number().int().nonnegative(),
    supportingObservationIds: z.array(z.string().min(1)),
    conflictingObservationIds: z.array(z.string().min(1)),
    orientationDecisions: z.array(OrientationDecisionSchema),
    /** Chains re-read from the tokens their orientation decision chose, instead of the page vote's. */
    rereadChainIds: z.array(z.string().min(1)),
    counts: z
      .object({ textRegions: z.number().int().nonnegative(), observations: z.number().int().nonnegative(), hypotheses: z.number().int().nonnegative() })
      .strict(),
    /**
     * 005D (schema 1.3.0): the frame's dimension graph as it was bound — marks by class, observations
     * by binding role, the inks V3 kept from deciding between the selected and the vote's scale, and,
     * when the selected scale rests on one ink whose own glyph alternatives move it beyond the pixel
     * tolerance, the interval it could lie in (VALUE_AMBIGUOUS). The published figure never chooses in it.
     */
    topology: z
      .object({
        marks: z.object({ tick: z.number().int().nonnegative(), questionable: z.number().int().nonnegative(), rejected: z.number().int().nonnegative() }).strict(),
        bindings: z.object({ primary: z.number().int().nonnegative(), alternative: z.number().int().nonnegative(), ambiguous: z.number().int().nonnegative(), uncentred: z.number().int().nonnegative() }).strict(),
        neutralObservationIds: z.array(z.string().min(1)),
        hierarchy: z
          .object({
            totals: z.number().int().nonnegative(),
            agreesAsRead: z.number().int().nonnegative(),
            conflictsAsRead: z.number().int().nonnegative(),
            incomplete: z.number().int().nonnegative(),
            afterCorrection: z.number().int().nonnegative(),
            parallelCopies: z.number().int().nonnegative(),
            /** A total and its children disagree as read, the selected scale on one side and a distinct rival on the other, and no counted reading outside the pair decides: the confidence is INCONCLUSIVE (005D §43). */
            undecidedConflict: z.boolean().optional(),
          })
          .strict()
          .optional(),
        valueAmbiguity: z
          .object({ observationId: z.string().min(1), rawText: z.string().min(1), alternatives: z.array(z.string().min(1)), cmPerPixelLow: z.number().positive(), cmPerPixelHigh: z.number().positive() })
          .strict()
          .optional(),
        /**
         * 005E: reading quality behind the decision — the classes of the selected scale's counted inks, how many inks
         * could not decide (LOW_QUALITY), the inks contested between two scales (a lattice value of theirs fits a rival
         * with standing), and the selected scale's inks the class rules demoted.
         */
        ocr: z
          .object({
            counted: z.object({ clear: z.number().int().nonnegative(), supported: z.number().int().nonnegative(), ambiguous: z.number().int().nonnegative(), unrated: z.number().int().nonnegative() }).strict(),
            lowQuality: z.number().int().nonnegative(),
            contestedObservationIds: z.array(z.string().min(1)),
            demotedObservationIds: z.array(z.string().min(1)),
          })
          .strict()
          .optional(),
        /**
         * 005E: several inks agree on the selected scale, but only as weak readings: blind to reading quality the scale
         * would rank SUPPORTED or better, with it not — and either a rival with standing has a witness read better than
         * a demoted one (BETTER_CLASS_RIVAL), or two ambiguous inks' own lattice values agree on another scale
         * (CANDIDATE_CONSENSUS). The confidence is INCONCLUSIVE; the challenger is named, never selected.
         */
        falseConsensus: z
          .object({
            kind: z.enum(['BETTER_CLASS_RIVAL', 'CANDIDATE_CONSENSUS']),
            selectedHypothesisId: z.string().min(1),
            challengerHypothesisId: z.string().min(1).optional(),
            candidateCmPerPixel: z.number().positive().optional(),
            /** Every distinct scale two coin tosses' held alternatives agree on (bounded), with the pair behind it. */
            candidateScales: z.array(z.object({ cmPerPixel: z.number().positive(), observationIds: z.array(z.string().min(1)) }).strict()).optional(),
            /** The selection's inks a rival contests, and those read too ambiguously to corroborate. */
            contestedObservationIds: z.array(z.string().min(1)).optional(),
            demotedObservationIds: z.array(z.string().min(1)),
            blindConfidence: z.enum(['STRONG', 'SUPPORTED', 'WEAK', 'INCONCLUSIVE']),
            why: z.string().min(1),
          })
          .strict()
          .optional(),
        /** 005E: totals refuted as read whose children (read SUPPORTED or better) agree with exactly one assignment of lattice values. */
        structural: z
          .array(
            z
              .object({
                totalChainId: z.string().min(1),
                partChainId: z.string().min(1),
                assignment: z.array(z.object({ observationId: z.string().min(1), asReadCm: z.number().positive(), chosenCm: z.number().positive() }).strict()),
                refutedObservationIds: z.array(z.string().min(1)),
              })
              .strict(),
          )
          .optional(),
      })
      .strict()
      .optional(),
    why: z.string().min(1),
  })
  .strict()
export type FrameMetricSolution = z.infer<typeof FrameMetricSolutionSchema>

/**
 * Two chains on one frame and how they stand to each other, from their ticks
 * alone: which one totals which, which nests inside which. A chain's role
 * (overall, part, interior) is decided later, against the walls; these are
 * the relations it is decided from.
 */
export const ChainRelationSchema = z
  .object({
    kind: z.enum(['TOTAL_OF', 'NESTED_IN', 'SHARES_ENDPOINT', 'SEGMENT_OF', 'PARALLEL_COPY_OF', 'CONFLICTS_WITH']),
    frameId: z.string().min(1),
    fromChainId: z.string().min(1),
    toChainId: z.string().min(1),
    /** For TOTAL_OF: the total's value against the parts' sum, when both are known. Recorded, never forced. */
    sum: z.object({ totalCm: z.number().positive(), partsCm: z.number().positive(), residualCm: z.number(), agrees: z.boolean() }).strict().optional(),
    /** 005D: the span of `fromChainId` the relation is about, when it is not the whole chain (a total over part of a line). */
    span: z.object({ fromPx: z.number().finite(), toPx: z.number().finite() }).strict().optional(),
    /**
     * 005D: the hierarchy check, on values AS READ (primary bindings, the decided orientation, no
     * substitution): AGREES_AS_READ, CONFLICT_AS_READ, INCOMPLETE (a value unread), or
     * AGREES_AFTER_CORRECTION (the solved chain closes only through a corrected or derived value —
     * recorded, never evidence). Nothing is re-read to make a check close.
     */
    check: z.enum(['AGREES_AS_READ', 'CONFLICT_AS_READ', 'INCOMPLETE', 'AGREES_AFTER_CORRECTION']).optional(),
  })
  .strict()
export type ChainRelation = z.infer<typeof ChainRelationSchema>

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

/**
 * 005E: one label ink's numeric lattice (`labelLattice`), bounded: the as-read string and the 005D one, the emitted
 * sequences with their image-only scores, the as-read path's glyphs with every candidate, and each ink variant and
 * segmentation the reader tried. Numbers only: no pixel of the drawing.
 */
export const NumericLatticeRecordSchema = z
  .object({
    id: z.string().min(1),
    frameId: z.string().min(1),
    orientation: TextOrientationSchema,
    box: PixelRectSchema,
    reader: z.object({ name: z.string().min(1), version: z.string().min(1) }).strict(),
    rawTopText: z.string().min(1),
    asRead: z.string().min(1),
    asReadValueCm: z.number().positive().optional(),
    asReadVariant: z.enum(['DEFAULT', 'STRICT', 'SAUVOLA']),
    ocrClass: OcrClassSchema,
    classWhy: z.string().min(1),
    asReadP: z.number().min(0).max(1),
    probabilityMargin: z.number().finite(),
    sequenceMargin: z.number().nonnegative(),
    minGlyphScore: z.number().min(0).max(1),
    maxRunnerRatio: z.number().min(0),
    entropy: z.number().nonnegative(),
    capHeightPx: z.number().positive(),
    sequences: z.array(
      z
        .object({
          text: z.string().min(1),
          valueCm: z.number().positive().optional(),
          logP: z.number().finite(),
          p: z.number().min(0).max(1),
          imageScore: z.number().min(0).max(1),
          nonTop: z.array(z.object({ index: z.number().int().nonnegative(), top: z.string().min(1), chosen: z.string().min(1), ratio: z.number().min(0) }).strict()),
          minGlyphMargin: z.number().finite(),
          avgGlyphMargin: z.number().finite(),
          variants: z.array(z.enum(['DEFAULT', 'STRICT', 'SAUVOLA'])),
          pathIds: z.array(z.string().min(1)),
          asRead: z.boolean(),
        })
        .strict(),
    ),
    glyphs: z.array(
      z
        .object({
          box: PixelRectSchema,
          candidates: z.array(z.object({ char: z.string().min(1).max(2), score: z.number().min(0).max(1), p: z.number().min(0).max(1) }).strict()),
          runnerRatio: z.number().min(0),
          topologyRunnerRatio: z.number().min(0),
          holes: z.number().int().nonnegative(),
          touching: z.boolean(),
          broken: z.boolean(),
        })
        .strict(),
    ),
    paths: z.array(
      z
        .object({
          id: z.string().min(1),
          variant: z.enum(['DEFAULT', 'STRICT', 'SAUVOLA']),
          kind: z.enum(['ANCHOR', 'RECUT']),
          text: z.string().min(1),
          slope: z.number().finite(),
          cuts: z.array(z.number().int()),
          changedBoundaries: z.number().int().nonnegative(),
          segScore: z.number().min(0).max(1),
          ratioToBest: z.number().min(0),
        })
        .strict(),
    ),
    expansions: z.number().int().nonnegative(),
    truncatedBy: z.enum(['MASS', 'COUNT', 'FLOOR', 'NONE']),
    /** Values merged before the count/mass cut, and the share of their probability the emitted ones carry. */
    mergedCount: z.number().int().nonnegative(),
    emittedMass: z.number().min(0).max(1),
    /** The as-read string under the stability bracket's masks, and whether its value held. */
    asReadStability: z.object({ stable: z.boolean(), bracket: z.array(z.string()) }).strict(),
    /**
     * 005F (schema 1.5.0): the glyph counts the ink was read at (`countAmbiguity`), the values two moderate substitutions
     * reach past the count bound (`tail`: a record, never a reading), and what the segmentation tried (`segmentation`).
     */
    countAmbiguity: z
      .object({ asRead: z.number().int().nonnegative(), alternatives: z.array(z.number().int().positive()), decisive: z.array(z.enum(['DEFAULT', 'STRICT', 'SAUVOLA'])), widthAmbiguous: z.boolean(), rivalP: z.number().min(0).max(1) })
      .strict()
      .optional(),
    tail: z
      .array(
        z
          .object({
            text: z.string().min(1),
            valueCm: z.number().positive(),
            logP: z.number().finite(),
            imageScore: z.number().min(0).max(1),
            nonTop: z.array(z.object({ index: z.number().int().nonnegative(), top: z.string().min(1), chosen: z.string().min(1), ratio: z.number().min(0) }).strict()),
            pathIds: z.array(z.string().min(1)),
          })
          .strict(),
      )
      .optional(),
    segmentation: z
      .object({
        style: z.object({ pitch: z.number().positive().nullable(), samples: z.number().int().nonnegative() }).strict(),
        counts: z.array(
          z
            .object({
              variant: z.enum(['DEFAULT', 'STRICT', 'SAUVOLA']),
              reader: z.number().int().nonnegative(),
              anchor: z.number().int().nonnegative(),
              alternatives: z.array(z.number().int().positive()),
              decisive: z.boolean(),
              widthAmbiguous: z.boolean(),
            })
            .strict(),
        ),
        counterCutsMoved: z.number().int().nonnegative(),
        counterCutsPruned: z.number().int().nonnegative(),
        segmentations: z.number().int().nonnegative(),
        cellsScored: z.number().int().nonnegative(),
        truncated: z.number().int().nonnegative(),
      })
      .strict()
      .optional(),
    cache: z.enum(['HIT', 'MISS']),
    /** 005H (schema 1.6.0): the external recogniser's reading of the same crop, and the ensemble rule's decision. */
    external: ExternalReadingRecordSchema.optional(),
    ensemble: LabelEnsembleRecordSchema.optional(),
  })
  .strict()
export type NumericLatticeRecord = z.infer<typeof NumericLatticeRecordSchema>

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
    /** 1.2.0: every number bound to its span, per orientation; empty on older sets. */
    dimensionObservations: z.array(DimensionObservationSchema).optional(),
    /** 1.2.0: each plan frame's independent metric solution; empty on older sets. */
    metricSolutions: z.array(FrameMetricSolutionSchema).optional(),
    /** 1.2.0: how the chains of a frame stand to each other; empty on older sets. */
    chainRelations: z.array(ChainRelationSchema).optional(),
    /** 1.4.0: each dimension-label ink's numeric lattice, as the reader generated it from the image alone. */
    numericLattices: z.array(NumericLatticeRecordSchema).optional(),
    /** 1.6.0: the external numeric recogniser the labels were also read with; absent when none was. */
    recogniser: RecogniserRecordSchema.optional(),
    /** 1.7.0: each plan frame's dimension topology (005I). */
    dimensionTopology: z.array(DimensionTopologyRecordSchema).optional(),
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
export const metricSolutionFor = (set: MetricEvidenceSet, frameId: string): FrameMetricSolution | undefined => (set.metricSolutions ?? []).find((s) => s.frameId === frameId)
