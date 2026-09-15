/**
 * PrimitiveHypothesisSet — what the sources MIGHT mean, before anything is decided.
 *
 * This is the layer between "a thick band appears here on the front elevation"
 * and "there is a 0.4 by 0.3 metre solid spanning the facade at 2.8 metres".
 * It exists because those are different claims with different evidence, and
 * collapsing them is how a reconstruction becomes confident about things it
 * has no right to be confident about.
 *
 * A hypothesis is:
 *
 * - a KIND from a fixed vocabulary — a building mass, a wall ring, an opening,
 *   a linear solid — chosen from what the observations suggest;
 * - a set of PARAMETERS, each with a value, an interval it could be in, and
 *   the evidence that says so;
 * - a TRACE back to every observation and every piece of metric evidence it
 *   rests on;
 * - a set of RIVALS it excludes, because two hypotheses that describe the same
 *   ink cannot both be built.
 *
 * Nothing here is in the model's coordinate system yet and nothing here is a
 * command. Turning a hypothesis into geometry is the solver's job, and the
 * solver is allowed to reject it.
 */
import { z } from 'zod'
import { PixelRectSchema } from '@buildapp/source-common'

export const HYPOTHESIS_SET_SCHEMA = 'buildapp.primitive-hypothesis-set' as const
export const HYPOTHESIS_SET_SCHEMA_VERSION = '1.0.0' as const
export const SUPPORTED_HYPOTHESIS_VERSIONS = ['1.0.0'] as const

/**
 * What a hypothesis CLAIMS TO BE.
 *
 * The vocabulary is of building primitives, not of drawing features: a
 * `WALL_BAND` observation is evidence, a `WALL_SEGMENT` hypothesis is a claim.
 * Everything a reconstruction can put in a model has an entry, including the
 * two that exist to represent doubt honestly — a `SURFACE_REGION` for
 * something that is only a coloured area, and a `LINEAR_SOLID` for something
 * that stands proud of a wall without yet being a beam or a frame or a fin.
 */
export const HypothesisKindSchema = z.enum([
  'BUILDING_MASS',
  'LEVEL',
  'WALL_RING',
  'WALL_SEGMENT',
  'SLAB',
  'ROOF_SYSTEM',
  'ROOF_PLANE',
  'OPENING',
  'WINDOW',
  'DOOR',
  'RECESS',
  'LOGGIA',
  'BALCONY',
  'RAILING',
  'CHIMNEY',
  'STAIR',
  'SURFACE_REGION',
  'LINEAR_SOLID',
])
export type HypothesisKind = z.infer<typeof HypothesisKindSchema>

/**
 * How well a parameter is known.
 *
 * `interval` is the honest statement and `value` is the best guess inside it.
 * A parameter measured off a printed dimension has a tight interval; one
 * inferred from a band of pixels in an elevation has a wide one; one that is
 * a convention rather than a measurement says so in `basis` and gets the
 * widest interval of all.
 */
export const ParameterBasisSchema = z.enum([
  /** Read from a printed dimension, a level datum or an angle. */
  'MEASURED',
  /** Computed from measured things: a wall length from two chain segments. */
  'DERIVED',
  /** Scaled off the drawing through a registration, with no printed number. */
  'SCALED',
  /** Corroborated by a second view. */
  'CROSS_VIEW',
  /** A building convention used because the sources say nothing: a default wall thickness. */
  'ASSUMED',
])
export type ParameterBasis = z.infer<typeof ParameterBasisSchema>

export const HypothesisParameterSchema = z
  .object({
    name: z.string().min(1),
    value: z.number().finite(),
    /** The range the value could be in, at this layer's honesty. */
    low: z.number().finite(),
    high: z.number().finite(),
    unit: z.enum(['m', 'deg', 'count', 'none']),
    basis: ParameterBasisSchema,
    /** The metric evidence this parameter rests on. Empty means it rests on none, which is a fact worth seeing. */
    evidenceIds: z.array(z.string().min(1)),
    /** A sentence a human can check. */
    why: z.string().min(1),
  })
  .strict()
export type HypothesisParameter = z.infer<typeof HypothesisParameterSchema>

/** Where a hypothesis was seen, per view. The same feature seen twice has two of these. */
export const HypothesisSightingSchema = z
  .object({
    frameId: z.string().min(1),
    box: PixelRectSchema,
    observationIds: z.array(z.string().min(1)),
    /** How sure that view is, on its own. */
    confidence: z.number().min(0).max(1),
    /** What the view says about depth, when it says anything. */
    depthLayer: z.enum(['FRONT', 'PROUD_OF_WALL', 'HOST_PLANE', 'RECESSED', 'BACK', 'UNKNOWN']),
  })
  .strict()
export type HypothesisSighting = z.infer<typeof HypothesisSightingSchema>

export const PrimitiveHypothesisSchema = z
  .object({
    id: z.string().min(1),
    kind: HypothesisKindSchema,
    /** The hypothesis this one is part of, when it is part of one: a wall segment in a ring, an opening in a wall. */
    parentId: z.string().min(1).optional(),
    parameters: z.array(HypothesisParameterSchema),
    sightings: z.array(HypothesisSightingSchema),
    /**
     * Hypotheses that describe the SAME source evidence and cannot both stand.
     * The solver picks at most one from each rival group, and records why.
     */
    rivalIds: z.array(z.string().min(1)),
    /**
     * Everything this hypothesis rests on, flattened: the observations that
     * suggested it and the metric evidence that measures it. This is the trace
     * §22 asks for, and it is mandatory — a primitive with no support is not a
     * hypothesis, it is an invention.
     */
    observationIds: z.array(z.string().min(1)),
    evidenceIds: z.array(z.string().min(1)),
    /** How many independent views corroborate it. One is a sighting; two is evidence. */
    viewSupport: z.number().int().nonnegative(),
    confidence: z.number().min(0).max(1),
    /** How it came to exist: which fusion rule made it, and out of how much. */
    provenance: z
      .object({
        rule: z.string().min(1),
        detail: z.string(),
        /** How many raw candidates were merged into this one. */
        merged: z.number().int().nonnegative(),
      })
      .strict(),
    note: z.string().optional(),
  })
  .strict()
export type PrimitiveHypothesis = z.infer<typeof PrimitiveHypothesisSchema>

/** Something the hypothesis layer looked for and could not propose. */
export const UnresolvedHypothesisSchema = z
  .object({
    id: z.string().min(1),
    kind: HypothesisKindSchema,
    what: z.string().min(1),
    reason: z.string().min(1),
    status: z.enum(['MISSING', 'AMBIGUOUS', 'NOT_ATTEMPTED']),
    observationIds: z.array(z.string().min(1)),
  })
  .strict()
export type UnresolvedHypothesis = z.infer<typeof UnresolvedHypothesisSchema>

export const PrimitiveHypothesisSetSchema = z
  .object({
    schema: z.literal(HYPOTHESIS_SET_SCHEMA),
    schemaVersion: z.enum(SUPPORTED_HYPOTHESIS_VERSIONS),
    id: z.string().min(1),
    sourcePackageId: z.string().min(1),
    sourcePackageHash: z.string().regex(/^[0-9a-f]{64}$/),
    observationGraphId: z.string().min(1),
    observationGraphHash: z.string().regex(/^[0-9a-f]{64}$/),
    metricEvidenceId: z.string().min(1),
    metricEvidenceHash: z.string().regex(/^[0-9a-f]{64}$/),
    proposers: z.array(z.object({ name: z.string().min(1), version: z.string().min(1) }).strict()),
    hypotheses: z.array(PrimitiveHypothesisSchema),
    unresolved: z.array(UnresolvedHypothesisSchema),
    /** How many raw candidates went in, against how many hypotheses came out. The fusion ratio, stated. */
    fusion: z
      .object({
        rawCandidates: z.number().int().nonnegative(),
        afterDuplicateSuppression: z.number().int().nonnegative(),
        afterClustering: z.number().int().nonnegative(),
        afterContinuityMerge: z.number().int().nonnegative(),
        accepted: z.number().int().nonnegative(),
        rejected: z.array(z.object({ why: z.string().min(1), count: z.number().int().nonnegative() }).strict()),
      })
      .strict(),
    contentHash: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict()
export type PrimitiveHypothesisSet = z.infer<typeof PrimitiveHypothesisSetSchema>

export const parameterOf = (h: PrimitiveHypothesis, name: string): HypothesisParameter | undefined => h.parameters.find((p) => p.name === name)
export const hypothesesOfKind = (set: PrimitiveHypothesisSet, kind: HypothesisKind): PrimitiveHypothesis[] => set.hypotheses.filter((h) => h.kind === kind)
export const childrenOf = (set: PrimitiveHypothesisSet, parentId: string): PrimitiveHypothesis[] => set.hypotheses.filter((h) => h.parentId === parentId)
