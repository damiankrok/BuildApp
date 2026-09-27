/**
 * SEMANTIC PROPOSALS: the interface through which any detector — the
 * deterministic CV the analyzer has today, OCR, a floor-plan model, a vision
 * language model, the owner tapping a screen — contributes EVIDENCE.
 *
 * A proposal is never an object. It says "in this frame, this detector saw
 * something that looks like a vertical member here, with this confidence";
 * the hypothesis pipeline (hypotheses/) fuses proposals, weighs them by
 * source authority, and only then emits semantic objects. So a future ML
 * detector plugs in by producing proposals, and the evidence graph and the
 * solver stay the authority layer: no detector writes the model.
 */
import { z } from 'zod'
import { SOURCE_AUTHORITIES } from './authority.js'

export const DETECTORS = ['DETERMINISTIC_CV', 'OCR', 'ML_FLOORPLAN', 'VLM', 'OWNER', 'SYNTHETIC'] as const
export type Detector = (typeof DETECTORS)[number]

/**
 * What a proposal claims to have seen — drawing-level evidence, not
 * building objects.
 */
export const PROPOSAL_KINDS = [
  /** A planar roof surface region (plan outline, with a pitch and a fall where the view gives them). */
  'ROOF_PLANE_REGION',
  /** A line on a roof: a ridge, hip, valley or eave candidate, with heights where known. */
  'ROOF_LINE',
  /** A place where a host roof surface is interrupted (a hole, a body rising through it). */
  'ROOF_INTERRUPTION',
  /** A vertical facade face (a dormer front, a porch front). */
  'VERTICAL_FACADE',
  /** An opening in a facade. */
  'OPENING',
  /** A vertical member: a post, a column. */
  'VERTICAL_MEMBER',
  /** A horizontal member: a beam, a lintel, a pergola beam. */
  'HORIZONTAL_MEMBER',
  /** A continuous cover surface over an area (a roof, a slab, a canopy plate). */
  'COVER_SURFACE',
  /** Positive evidence that NO continuous cover spans an area (the sky seen between members). */
  'NO_COVER_OBSERVED',
  /** A step nosing line: a tread edge at a height. */
  'STEP_EDGE',
  /** A level exterior surface (a landing, a terrace). */
  'LEVEL_SURFACE',
  /** A printed dimension, level datum or angle, keyed to the quantity it states. */
  'PRINTED_DIMENSION',
  /** Geometry that was seen but that the detector could not name. */
  'UNCLASSIFIED_GEOMETRY',
] as const
export type ProposalKind = (typeof PROPOSAL_KINDS)[number]

const Vec3 = z.object({ x: z.number().finite(), y: z.number().finite(), z: z.number().finite() }).strict()

export const ProposalGeometrySchema = z.discriminatedUnion('type', [
  /** A planar outline in world coordinates (a plan outline carries its heights, or 0 when a plan cannot say). */
  z.object({ type: z.literal('POLYGON'), points: z.array(Vec3).min(3), pitchDeg: z.number().finite().optional(), downslope: z.object({ x: z.number(), z: z.number() }).strict().optional() }).strict(),
  z.object({ type: z.literal('SEGMENT'), start: Vec3, end: Vec3, width: z.number().positive().optional(), depth: z.number().positive().optional() }).strict(),
  /** A value, for a printed dimension: `quantity` names what it measures (e.g. `dormer.eaveY`). */
  z.object({ type: z.literal('VALUE'), quantity: z.string().min(1), value: z.number().finite(), tolerance: z.number().nonnegative().optional() }).strict(),
])
export type ProposalGeometry = z.infer<typeof ProposalGeometrySchema>

export const SemanticProposalSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(PROPOSAL_KINDS),
    geometry: ProposalGeometrySchema,
    confidence: z.number().min(0).max(1),
    /** The coordinate frame (drawing, view) the detector read. */
    sourceFrameId: z.string().min(1),
    detector: z.enum(DETECTORS),
    /** How much the source can be trusted for metric values: a printed dimension outranks a render. */
    authority: z.enum(SOURCE_AUTHORITIES),
    /**
     * Cross-view identity: proposals that share a key are the same physical
     * feature seen from different frames. Absent: the pipeline groups by
     * position alone.
     */
    featureKey: z.string().min(1).optional(),
    note: z.string().optional(),
  })
  .strict()
export type SemanticProposal = z.infer<typeof SemanticProposalSchema>

/** Validate proposals coming from outside (a future detector's JSON). Invalid ones are refused, by index, never repaired. */
export function parseProposals(input: unknown): { ok: true; proposals: SemanticProposal[] } | { ok: false; errors: string[] } {
  const r = z.array(SemanticProposalSchema).safeParse(input)
  if (r.success) {
    const ids = r.data.map((p) => p.id)
    const dup = ids.find((id, i) => ids.indexOf(id) !== i)
    return dup ? { ok: false, errors: [`proposal id ${dup} is used twice`] } : { ok: true, proposals: r.data }
  }
  return { ok: false, errors: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) }
}
