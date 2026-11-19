/**
 * v3.54.13 — the appearance observation: what one picture of one side says about the FINISHES of the house, as
 * outlines of material classes in that picture's own pixels, with an explicit map to the source elevation it shows.
 *
 * It is colour, never geometry. Nothing in it names a wall or a model object: the consumer (consumer.ts) registers the
 * outlines on the elevation and finds, by what the compiled model shows there, which surface each part lands on. A
 * picture may be the source elevation itself (`toSource` the identity), a derivative of it (an OWNER's sketch, a
 * locally rendered reading) whose map is stated and measured, or a reading another tool returned. Its `producer` says
 * which; an outline from an uncertain reading is a hypothesis with its uncertainty, not a measurement.
 *
 * Versioned (`APPEARANCE_OBSERVATION_VERSION`): a reader or consumer that changes what an observation means raises it.
 * The order of regions and of keys never changes what is applied: the consumer sorts by `regionId`.
 */
import { z } from 'zod'

export const APPEARANCE_OBSERVATION_SCHEMA = 'buildapp.appearance-observation' as const
export const APPEARANCE_OBSERVATION_VERSION = '1.0.0' as const

/** Material classes: what a surface IS (render, timber, glass…), never a product's RGB. */
export const APPEARANCE_CLASSES = ['LIGHT_RENDER', 'DARK_RENDER', 'TIMBER', 'GLASS', 'ROOF', 'METAL', 'BACKGROUND', 'UNKNOWN'] as const
export type AppearanceClass = (typeof APPEARANCE_CLASSES)[number]

const finite = z.number().finite()
const Pt = z.tuple([finite, finite])
const Ring = z.array(Pt).min(3)

export const AppearanceRegionSchema = z
  .object({
    /** Stable within its observation (the same reading gives the same ids). */
    regionId: z.string().regex(/^[A-Za-z0-9_.:-]+$/),
    class: z.enum(APPEARANCE_CLASSES),
    /** The outline in the analysed image's pixels (x right, y down). */
    outline: Ring,
    /** Parts of the outline that are not this class (a panel of another finish inside it). Openings need not be listed. */
    holes: z.array(Ring).optional(),
    visibility: z.enum(['VISIBLE', 'PARTLY_OCCLUDED', 'UNCERTAIN']),
    /** How far, in the image's pixels, an edge of the outline may be from the true boundary. */
    uncertaintyPx: z.number().nonnegative(),
    /** What kind of surface the picture shows it on, when the picture says so (a frame, a band, a wall…). */
    hostHint: z.enum(['WALL', 'FRAME', 'BAND', 'SLAB', 'ROOF', 'OPENING', 'GATE', 'UNKNOWN']).optional(),
    /** Region ids this one continues into across a drawn line (one source boundary, split by the drawing). */
    continuesWith: z.array(z.string()).optional(),
  })
  .strict()
export type AppearanceRegion = z.infer<typeof AppearanceRegionSchema>

export const AppearanceObservationSchema = z
  .object({
    schema: z.literal(APPEARANCE_OBSERVATION_SCHEMA),
    schemaVersion: z.literal(APPEARANCE_OBSERVATION_VERSION),
    observationId: z.string().regex(/^[A-Za-z0-9_.:-]+$/),
    /** The facade the picture shows, in the solver's terms. */
    facade: z.enum(['FRONT', 'REAR', 'EAST', 'WEST']),
    source: z
      .object({
        /** The byte hash of the source elevation the picture is of (the package asset variant). */
        sourceByteHash: z.string().regex(/^[0-9a-f]{64}$/),
        /** The bytes actually analysed: equal to the source for a direct reading, the derivative's own otherwise. */
        imageSha256: z.string().regex(/^[0-9a-f]{64}$/),
        imageWidth: z.number().int().positive(),
        imageHeight: z.number().int().positive(),
        /** Size of the source elevation in its own pixels (the frame the solver registered). */
        sourceWidth: z.number().int().positive(),
        sourceHeight: z.number().int().positive(),
      })
      .strict(),
    /** Affine map from the analysed image's pixels to the source elevation's: [[a, b, tx], [c, d, ty]]. */
    toSource: z.tuple([z.tuple([finite, finite, finite]), z.tuple([finite, finite, finite])]),
    /** How the map was found and how well it fits (anchor residuals), or why it is the identity. */
    toSourceWhy: z.string(),
    regions: z.array(AppearanceRegionSchema),
    producer: z
      .object({
        kind: z.enum(['LOCAL_SKETCH_SEGMENTATION', 'API_CONTOUR_READING', 'MANUAL_DIAGNOSTIC']),
        version: z.string(),
        /** For an API reading: the model and the prompt/schema version (never a key). */
        model: z.string().optional(),
        promptVersion: z.string().optional(),
      })
      .strict(),
  })
  .strict()
export type AppearanceObservation = z.infer<typeof AppearanceObservationSchema>

/** Parse, and refuse what the schema allows but the meaning does not: duplicate ids, points far outside the image. */
export function parseAppearanceObservation(raw: unknown): AppearanceObservation {
  const o = AppearanceObservationSchema.parse(raw)
  const ids = new Set<string>()
  for (const r of o.regions) {
    if (ids.has(r.regionId)) throw new Error(`appearance observation ${o.observationId}: region id ${r.regionId} appears twice`)
    ids.add(r.regionId)
    const slack = Math.max(4, 0.02 * Math.max(o.source.imageWidth, o.source.imageHeight))
    for (const ring of [r.outline, ...(r.holes ?? [])]) {
      for (const [x, y] of ring) {
        if (x < -slack || y < -slack || x > o.source.imageWidth + slack || y > o.source.imageHeight + slack) {
          throw new Error(`appearance observation ${o.observationId}: region ${r.regionId} has a point (${x}, ${y}) outside its ${o.source.imageWidth}×${o.source.imageHeight} image`)
        }
      }
    }
  }
  // canonical order: what is applied never depends on the order a reader listed regions in
  return { ...o, regions: [...o.regions].sort((a, b) => (a.regionId < b.regionId ? -1 : a.regionId > b.regionId ? 1 : 0)) }
}

export const applyAffine = (m: AppearanceObservation['toSource'], x: number, y: number): [number, number] => [m[0][0] * x + m[0][1] * y + m[0][2], m[1][0] * x + m[1][1] * y + m[1][2]]
