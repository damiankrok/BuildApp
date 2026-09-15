/**
 * The vision provider contract.
 *
 * A provider is asked a NARROW visual question about ONE picture and may
 * answer only in this vocabulary. It cannot return a wall, a roof, a mesh, a
 * triangle or a DSL command, because there is nothing in this schema that
 * could carry one: every answer is a 2D shape on the image it was shown, with
 * a confidence, a tolerance and a sentence of evidence.
 *
 * Three decisions in here are worth stating plainly.
 *
 * **Normalized coordinates, not pixels.** A provider answers in [0, 1] of the
 * image it was handed. It is never told a pixel size it could scale by, so it
 * cannot silently answer about a different copy of the drawing, and a reading
 * taken off a 1280-wide elevation is directly comparable with the same reading
 * taken off a 400-wide one.
 *
 * **Relations by index.** A provider refers to its own observations by
 * position in its own list. It never sees, and therefore never invents, a
 * BuildApp id.
 *
 * **Prose is evidence, not truth.** `evidence` and `notes` are a sentence a
 * human can check. They land in `provenance.detail`, which is explicitly
 * outside the observation graph's content hash: a provider that rewords its
 * explanation has not changed what it saw.
 */
import { z } from 'zod'
import { DepthLayerSchema, ObservationKindSchema, ObservationValueSchema, RelationKindSchema, SemanticHintSchema } from '@buildapp/source-observations'

export const VISION_CONTRACT_VERSION = '1.0.0' as const

/**
 * The narrow tasks a provider may be asked. There is deliberately no
 * "interpret this building" task: a question that broad has no checkable
 * answer, and a provider asked it will return a story.
 */
export const VisionTaskSchema = z.enum(['FACADE_DECOMPOSITION', 'PLAN_INTERPRETATION', 'SECTION_INTERPRETATION'])
export type VisionTask = z.infer<typeof VisionTaskSchema>

/** A shape in the image's own normalized coordinates: x right, y DOWN, both in [0, 1]. */
export const VisionGeometrySchema = z
  .object({
    type: z.enum(['POINT', 'SEGMENT', 'POLYLINE', 'POLYGON', 'RECT', 'LINE_FAMILY']),
    /** `[x, y]` pairs. RECT is two opposite corners; LINE_FAMILY is consecutive pairs of endpoints. */
    points: z.array(z.tuple([z.number(), z.number()])).min(1).max(512),
  })
  .strict()
export type VisionGeometry = z.infer<typeof VisionGeometrySchema>

export const VisionAlternativeSchema = z
  .object({
    why: z.string().min(1).max(400),
    confidence: z.number().min(0).max(1),
    geometry: VisionGeometrySchema.optional(),
    count: z.number().int().nonnegative().optional(),
  })
  .strict()
export type VisionAlternative = z.infer<typeof VisionAlternativeSchema>

export const VisionObservationSchema = z
  .object({
    kind: ObservationKindSchema,
    semanticHints: z.array(SemanticHintSchema).max(8),
    geometry: VisionGeometrySchema,
    depthLayer: DepthLayerSchema.optional(),
    confidence: z.number().min(0).max(1),
    /** Positional tolerance as a fraction of the image's larger edge. A provider may not claim zero; a floor is applied if it tries. */
    positionUncertaintyNorm: z.number().min(0).max(0.5),
    angleUncertaintyDeg: z.number().min(0).max(180).optional(),
    /** One sentence a human can check against the picture. Prose: recorded, never treated as a fact. */
    evidence: z.string().min(1).max(600),
    value: ObservationValueSchema.optional(),
    alternatives: z.array(VisionAlternativeSchema).max(4).optional(),
  })
  .strict()
export type VisionObservationDraft = z.infer<typeof VisionObservationSchema>

export const VisionRelationSchema = z
  .object({
    kind: RelationKindSchema,
    /** Index into this response's own `observations`. */
    from: z.number().int().nonnegative(),
    to: z.number().int().nonnegative(),
    confidence: z.number().min(0).max(1),
    why: z.string().min(1).max(400),
  })
  .strict()
export type VisionRelationDraft = z.infer<typeof VisionRelationSchema>

export const VisionObservationResponseSchema = z
  .object({
    task: VisionTaskSchema,
    /** Echoed from the request. A provider that answers about the wrong picture is caught here rather than three stages later. */
    assetByteHash: z.string().regex(/^[0-9a-f]{64}$/),
    observations: z.array(VisionObservationSchema).max(256),
    relations: z.array(VisionRelationSchema).max(512),
    /** What the provider looked for and could not find. A named gap is worth more than silence. */
    notFound: z.array(z.string().max(300)).max(32).optional(),
    notes: z.array(z.string().max(600)).max(16).optional(),
  })
  .strict()
export type VisionObservationResponse = z.infer<typeof VisionObservationResponseSchema>

/** A published figure passed as context. Aggregates only: no coordinate, no dimension a provider could scale by. */
export const VisionContextFactSchema = z.object({ label: z.string(), value: z.number(), unit: z.string() }).strict()
export type VisionContextFact = z.infer<typeof VisionContextFactSchema>

export type VisionObservationRequest = {
  task: VisionTask
  asset: {
    assetId: string
    /** SHA-256 of the exact bytes shown. The provider must echo it. */
    byteHash: string
    mediaType: string
    /** The image itself. */
    bytes: Uint8Array
  }
  /** What the package says this drawing IS. A provider reasons differently about a plan and a render. */
  roles: { document: string; storey: string; annotation: string; view: string; projection: string }
  /** The decoded size, for the record and for converting the answer back to pixels. Never sent to the provider. */
  size: { width: number; height: number }
  /** Aggregate figures from the same package, when they are relevant. Never coordinates. */
  contextFacts?: readonly VisionContextFact[]
  /** An extra sentence of scope for this call, e.g. which band of the facade to look at. */
  focus?: string
  maxObservations?: number
}

/** What a provider IS, for the record and for the graph's hash. A version bump is a different reader. */
export type VisionProviderInfo = {
  /** Stable identifier, e.g. `vision.anthropic`. */
  id: string
  /** The model actually used, when the provider has one. */
  model: string
  /** The adapter's own version, bumped when its prompt or parsing changes. */
  version: string
}

/** The extractor name an observation from this provider carries, e.g. `vision.anthropic/claude-opus-5@facade-decomposition`. */
export const extractorNameFor = (provider: VisionProviderInfo, task: VisionTask): string => `${provider.id}/${provider.model}@${task.toLowerCase().replace(/_/g, '-')}`

/** The version an observation from this provider carries: adapter version plus contract version, so either moving re-hashes the graph. */
export const extractorVersionFor = (provider: VisionProviderInfo): string => `${provider.version}+contract-${VISION_CONTRACT_VERSION}`
