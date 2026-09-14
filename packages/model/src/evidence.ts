/**
 * Evidence / provenance vocabulary.
 *
 * The model must already be able to carry uncertainty so that a future
 * analyzer is never forced to throw it away. Every semantic object may carry
 * an `Evidence` record, and any individual property may be given its own
 * status through `properties`.
 *
 * Ordering matters for later stages: only `SOURCE_EXACT` and
 * `SOURCE_CORROBORATED` should ever be allowed to act as hard metric
 * constraints. `ASSUMED` and `UNRESOLVED` are never matches against anything.
 */
import { z } from 'zod'

export const EVIDENCE_STATUSES = [
  'SOURCE_EXACT',
  'SOURCE_CORROBORATED',
  'SOURCE_DERIVED',
  'GEOMETRIC_INFERRED',
  'VISUAL_INFERRED',
  'ASSUMED',
  'UNRESOLVED',
] as const

export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number]

export const EvidenceStatusSchema = z.enum(EVIDENCE_STATUSES)

/** Statuses that may act as exact or hard metric constraints in later stages. */
export const HARD_EVIDENCE_STATUSES: readonly EvidenceStatus[] = ['SOURCE_EXACT', 'SOURCE_CORROBORATED']

export const isHardEvidence = (s: EvidenceStatus): boolean => HARD_EVIDENCE_STATUSES.includes(s)

/**
 * Provenance attached to a semantic object.
 *
 * `status` is the object's overall status. `properties` refines it per field
 * (e.g. `{ height: 'ASSUMED' }` on a wall whose plan position is exact but
 * whose height nobody measured). `sourceIds` reference `EvidenceSource`
 * records in the model so several objects can share one source description.
 */
export const EvidenceSchema = z
  .object({
    status: EvidenceStatusSchema,
    /** Free-text origin: a drawing name, a URL, "author" for manual input. */
    source: z.string().optional(),
    /** Where on the source: a dimension chain, a pixel region, a page anchor. */
    locator: z.string().optional(),
    /** What the value means, in words. */
    interpretation: z.string().optional(),
    /** 0..1 subjective confidence, when a producer has one. */
    confidence: z.number().min(0).max(1).optional(),
    note: z.string().optional(),
    /** Per-property overrides of `status`. */
    properties: z.record(z.string(), EvidenceStatusSchema).optional(),
    /** References into `model.evidenceSources`. */
    sourceIds: z.array(z.string()).optional(),
  })
  .strict()

export type Evidence = z.infer<typeof EvidenceSchema>

/** A shared, named source description that several objects may reference. */
export const EvidenceSourceSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(['DRAWING', 'PHOTO', 'RENDER', 'PUBLISHED_FACT', 'MANUAL', 'DERIVATION', 'OTHER']),
    label: z.string(),
    uri: z.string().optional(),
    note: z.string().optional(),
  })
  .strict()

export type EvidenceSource = z.infer<typeof EvidenceSourceSchema>

/** Default evidence for anything an author typed in by hand. */
export const manualEvidence = (note?: string): Evidence => ({
  status: 'ASSUMED',
  source: 'author',
  ...(note ? { note } : {}),
})
