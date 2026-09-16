/**
 * StructuralLayoutHypothesisSet — what the building IS MADE OF, before anything
 * is drawn.
 *
 * The layer this introduces sits between the metric evidence and the primitive
 * hypotheses, and it exists because of a specific failure. A reconstruction
 * that goes straight from "the widest dimension is 12.05 m and the deepest is
 * 14.91 m" to "here is a wall ring" has already decided that the building is
 * one rectangle, and no amount of careful fitting afterwards can undo that: the
 * garage, the recess, the second roof and the storey that covers only half the
 * plan are all gone before the first wall is emitted.
 *
 * So the composition is settled first, and separately:
 *
 * - **Storeys** — which levels the sources actually show, and which drawings
 *   show them. Not "two, because there is an upstairs".
 * - **Footprint regions** — per storey, the areas the plans enclose, each one
 *   traced to the wall bands and dimension chains that enclose it.
 * - **Masses** — regions stacked through the storeys that cover them, which is
 *   what a building is a composition of. A mass knows how far up it goes, and
 *   an attached single-storey garage therefore cannot acquire a first floor.
 * - **Attachments** — how the masses meet: shared wall, projection, recess,
 *   one above another.
 * - **Roof supports** — a roof per mass, over that mass's own footprint, with
 *   its own pitch and its own ridge.
 * - **Facade planes** — the exterior faces, which is where openings later go.
 * - **Recesses** — a loggia or a set-back entrance as TOPOLOGY: a mouth, a back
 *   wall, two returns and a depth.
 *
 * And, as at every other layer of this pipeline: **alternatives** where the
 * evidence supports more than one answer, **conflicts** where two sources
 * disagree and neither is averaged away, **gaps** where the sources say
 * nothing, and **traces** from every item back to the pixels it came from.
 *
 * Nothing here knows the name of any project and nothing here carries a
 * dimension of any real building.
 */
import { z } from 'zod'
import { PixelRectSchema } from '@buildapp/source-common'

export const LAYOUT_SET_SCHEMA = 'buildapp.structural-layout-hypothesis-set' as const
export const LAYOUT_SET_SCHEMA_VERSION = '1.0.0' as const
export const SUPPORTED_LAYOUT_VERSIONS = ['1.0.0'] as const

// ---------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------

/**
 * How a number came to be known.
 *
 * The same ladder the primitive layer uses, because the same distinction
 * matters here: a width READ off a chain and a width SCALED off a drawing are
 * both numbers and only one of them is a statement.
 */
export const LayoutBasisSchema = z.enum(['MEASURED', 'DERIVED', 'SCALED', 'CROSS_VIEW', 'ASSUMED'])
export type LayoutBasis = z.infer<typeof LayoutBasisSchema>

/** A number with the range it could be in and the evidence that says so. */
export const LayoutQuantitySchema = z
  .object({
    value: z.number().finite(),
    low: z.number().finite(),
    high: z.number().finite(),
    unit: z.enum(['m', 'deg', 'count', 'none']),
    basis: LayoutBasisSchema,
    evidenceIds: z.array(z.string().min(1)),
    why: z.string().min(1),
  })
  .strict()
export type LayoutQuantity = z.infer<typeof LayoutQuantitySchema>

/** A point on the plan, in world metres. */
export const PlanPointSchema = z.object({ x: z.number().finite(), z: z.number().finite() }).strict()
export type PlanPoint = z.infer<typeof PlanPointSchema>

/**
 * A footprint outline, as a ring of plan points.
 *
 * A ring rather than a rectangle even where the decomposition currently only
 * produces rectangles, because the whole point of this stage is that a
 * building is not a rectangle, and a schema that can only say "rectangle" will
 * quietly make it one again the first time it is asked to.
 */
export const PlanRingSchema = z.object({ points: z.array(PlanPointSchema).min(3) }).strict()
export type PlanRing = z.infer<typeof PlanRingSchema>

/** Which way a face looks, named from the plan rather than from the compass, because a drawing rarely says where north is. */
export const PlanSideSchema = z.enum(['MIN_X', 'MAX_X', 'MIN_Z', 'MAX_Z'])
export type PlanSide = z.infer<typeof PlanSideSchema>

// ---------------------------------------------------------------------------
// Storeys and footprints
// ---------------------------------------------------------------------------

export const StoreyLayoutHypothesisSchema = z
  .object({
    id: z.string().min(1),
    /** 0 is the lowest storey the sources show. Not a floor number: a drawing's ground floor may be numbered anything. */
    index: z.number().int(),
    /** The drawings this storey was read from. A storey with none is a storey nothing shows. */
    frameIds: z.array(z.string().min(1)),
    elevation: LayoutQuantitySchema.optional(),
    height: LayoutQuantitySchema.optional(),
    /** The footprint regions this storey is made of. */
    footprintRegionIds: z.array(z.string().min(1)),
    /** True when this storey's plan was registered against another storey's rather than dimensioned on its own. */
    registeredFrom: z.string().min(1).optional(),
    confidence: z.number().min(0).max(1),
    why: z.string().min(1),
  })
  .strict()
export type StoreyLayoutHypothesis = z.infer<typeof StoreyLayoutHypothesisSchema>

/** What a region of a plan turned out to be. */
export const FootprintKindSchema = z.enum([
  /** Enclosed by walls: a part of the building. */
  'BUILT',
  /** A pocket the building wraps but does not enclose: a loggia, a recessed entrance, a covered terrace. */
  'RECESS',
  /**
   * Dimensioned, outside the walls: the strip under the eaves a depth chain
   * measures, an entrance platform, a terrace. Named because it is evidence —
   * it is how the overall depth exceeds the walled depth — not because it is
   * built.
   */
  'ZONE',
])
export type FootprintKind = z.infer<typeof FootprintKindSchema>

export const FootprintRegionHypothesisSchema = z
  .object({
    id: z.string().min(1),
    storeyId: z.string().min(1),
    kind: FootprintKindSchema,
    ring: PlanRingSchema,
    areaM2: z.number().nonnegative(),
    /** The plan it was cut from, and where on it. */
    frameId: z.string().min(1),
    pixelRect: PixelRectSchema,
    /**
     * How much of this region's perimeter is drawn as WALL, as against line
     * work or nothing at all. A region enclosed only by line work is enclosed
     * by a terrace edge, and this is the number that says so.
     */
    wallEvidence: z.object({ perimeterM: z.number().nonnegative(), walledM: z.number().nonnegative(), fraction: z.number().min(0).max(1) }).strict(),
    observationIds: z.array(z.string().min(1)),
    evidenceIds: z.array(z.string().min(1)),
    confidence: z.number().min(0).max(1),
    why: z.string().min(1),
  })
  .strict()
export type FootprintRegionHypothesis = z.infer<typeof FootprintRegionHypothesisSchema>

// ---------------------------------------------------------------------------
// Masses
// ---------------------------------------------------------------------------

/** What part a mass plays in the building. Inferred from size and attachment, never assigned by name. */
export const MassRoleSchema = z.enum([
  /** The largest mass, or the one the others attach to. */
  'MAIN',
  /** A mass sharing a wall with another and not standing on its own. */
  'ATTACHED',
  /** A mass that steps out of a facade without being a storey of its own. */
  'PROJECTION',
  'UNKNOWN',
])
export type MassRole = z.infer<typeof MassRoleSchema>

export const MassHypothesisSchema = z
  .object({
    id: z.string().min(1),
    role: MassRoleSchema,
    /** The mass's plan outline, taken from its lowest storey. */
    ring: PlanRingSchema,
    /** One footprint region per storey this mass covers, lowest first. */
    footprintRegionIds: z.array(z.string().min(1)).min(1),
    /** The storeys it spans, by index, inclusive. */
    storeySpan: z.object({ fromIndex: z.number().int(), toIndex: z.number().int(), storeyIds: z.array(z.string().min(1)).min(1) }).strict(),
    /** The exterior faces of this mass, by facade-plane id. */
    facadePlaneIds: z.array(z.string().min(1)),
    /** The roof over it, when one was inferred. */
    roofSupportId: z.string().min(1).optional(),
    widthM: LayoutQuantitySchema,
    depthM: LayoutQuantitySchema,
    observationIds: z.array(z.string().min(1)),
    evidenceIds: z.array(z.string().min(1)),
    confidence: z.number().min(0).max(1),
    why: z.string().min(1),
  })
  .strict()
export type MassHypothesis = z.infer<typeof MassHypothesisSchema>

/** How two masses, or a mass and a storey, stand in relation to one another. */
export const AttachmentKindSchema = z.enum(['ATTACHED_TO', 'SHARES_WALL_WITH', 'PROJECTS_FROM', 'RECESSED_WITHIN', 'SUPPORTS', 'TERMINATES_AT', 'ABOVE', 'BELOW'])
export type AttachmentKind = z.infer<typeof AttachmentKindSchema>

export const AttachmentRelationSchema = z
  .object({
    id: z.string().min(1),
    kind: AttachmentKindSchema,
    fromId: z.string().min(1),
    toId: z.string().min(1),
    /** Where the two touch, in world metres, when they touch along a line. */
    contact: z.object({ axis: z.enum(['X', 'Z']), at: z.number().finite(), from: z.number().finite(), to: z.number().finite() }).strict().optional(),
    evidenceIds: z.array(z.string().min(1)),
    confidence: z.number().min(0).max(1),
    why: z.string().min(1),
  })
  .strict()
export type AttachmentRelation = z.infer<typeof AttachmentRelationSchema>

// ---------------------------------------------------------------------------
// Recesses
// ---------------------------------------------------------------------------

/**
 * A recess as topology rather than as a colour.
 *
 * A loggia, a set-back entrance and a balcony under the roof are all the same
 * shape of fact: a MOUTH in a facade, a BACK plane set behind it, two RETURN
 * walls joining them, a SLAB under it, and a DEPTH. Storing it as a coloured
 * patch on an elevation — or worse as a free-standing box hung off the facade
 * — loses every one of those and produces a building that reads as flat.
 */
export const RecessHypothesisSchema = z
  .object({
    id: z.string().min(1),
    massId: z.string().min(1),
    footprintRegionId: z.string().min(1),
    /** The facade the recess opens through. */
    mouthSide: PlanSideSchema,
    mouth: z.object({ axis: z.enum(['X', 'Z']), at: z.number().finite(), from: z.number().finite(), to: z.number().finite() }).strict(),
    /** The plane at the back of it, parallel to the mouth. */
    backAt: z.number().finite(),
    depthM: LayoutQuantitySchema,
    /** Whether each side return wall was actually found, rather than assumed by symmetry. */
    returns: z.object({ low: z.boolean(), high: z.boolean() }).strict(),
    storeyIds: z.array(z.string().min(1)),
    observationIds: z.array(z.string().min(1)),
    evidenceIds: z.array(z.string().min(1)),
    confidence: z.number().min(0).max(1),
    why: z.string().min(1),
  })
  .strict()
export type RecessHypothesis = z.infer<typeof RecessHypothesisSchema>

// ---------------------------------------------------------------------------
// Roofs and facades
// ---------------------------------------------------------------------------

export const RoofKindSchema = z.enum(['GABLE', 'HIP', 'FLAT', 'MONOPITCH', 'UNKNOWN'])
export type RoofKind = z.infer<typeof RoofKindSchema>

/**
 * A roof system over ONE mass.
 *
 * The footprint is the mass's, not the building's. A building with a house and
 * a garage attached has two roofs at two pitches and two ridge heights, and
 * taking one roof over the union of them is the same category of error as
 * taking one rectangle over the plan.
 */
export const RoofSupportHypothesisSchema = z
  .object({
    id: z.string().min(1),
    massId: z.string().min(1),
    kind: RoofKindSchema,
    /** What the roof sits on: usually the mass's own ring. */
    ring: PlanRingSchema,
    pitchDeg: LayoutQuantitySchema.optional(),
    ridgeAxis: z.enum(['X', 'Z']).optional(),
    eaveLevelM: LayoutQuantitySchema.optional(),
    ridgeLevelM: LayoutQuantitySchema.optional(),
    overhangM: LayoutQuantitySchema.optional(),
    /** Other roof systems this one meets. */
    adjacentRoofIds: z.array(z.string().min(1)),
    /**
     * Where the pitch came from, in the order §8 fixes: a printed angle beats
     * a corroborated elevation, which beats a perspective. Stated so that a
     * later fit cannot quietly overrule a printed number.
     */
    authority: z.enum(['PRINTED_ANGLE', 'SECTION', 'ELEVATION_GEOMETRY', 'PERSPECTIVE', 'CONVENTION', 'NONE']),
    observationIds: z.array(z.string().min(1)),
    evidenceIds: z.array(z.string().min(1)),
    confidence: z.number().min(0).max(1),
    why: z.string().min(1),
  })
  .strict()
export type RoofSupportHypothesis = z.infer<typeof RoofSupportHypothesisSchema>

/** One exterior face of one mass, over one range of storeys: where openings go and what an elevation is a picture of. */
export const FacadePlaneHypothesisSchema = z
  .object({
    id: z.string().min(1),
    massId: z.string().min(1),
    side: PlanSideSchema,
    /** The plane's position and extent in world metres. */
    axis: z.enum(['X', 'Z']),
    at: z.number().finite(),
    from: z.number().finite(),
    to: z.number().finite(),
    storeyIds: z.array(z.string().min(1)),
    /** False when another mass stands against it: an interior party wall is not a facade. */
    exterior: z.boolean(),
    /** Elevation frames that appear to show this face. Empty is normal for a face no drawing looks at. */
    frameIds: z.array(z.string().min(1)),
    confidence: z.number().min(0).max(1),
    why: z.string().min(1),
  })
  .strict()
export type FacadePlaneHypothesis = z.infer<typeof FacadePlaneHypothesisSchema>

// ---------------------------------------------------------------------------
// Doubt
// ---------------------------------------------------------------------------

/**
 * Two or more readings of the same evidence, with the one taken and the margin
 * it won by.
 *
 * A margin near zero is the interesting case and the reason this is a set
 * rather than a single answer: it says the decomposition could as easily have
 * gone the other way, which is a thing a reviewer needs to see and a repair
 * loop needs to be able to revisit.
 */
export const AlternativeGroupSchema = z
  .object({
    id: z.string().min(1),
    what: z.string().min(1),
    members: z
      .array(z.object({ id: z.string().min(1), score: z.number().finite(), summary: z.string().min(1) }).strict())
      .min(2),
    chosenId: z.string().min(1),
    /** How far ahead the chosen one was. Small means the choice is weak, whatever its confidence says. */
    margin: z.number().finite(),
    why: z.string().min(1),
  })
  .strict()
export type AlternativeGroup = z.infer<typeof AlternativeGroupSchema>

export const LayoutConflictSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum([
      'CHAIN_DISAGREES_WITH_CONTOUR',
      'STOREY_COVERAGE_DISAGREES',
      'ROOF_EVIDENCE_DISAGREES',
      'MASS_OVERLAP',
      'SCALE_DISAGREEMENT',
      'VIEW_DISAGREEMENT',
    ]),
    what: z.string().min(1),
    itemIds: z.array(z.string().min(1)),
    evidenceIds: z.array(z.string().min(1)),
    magnitude: z.number().finite().optional(),
    unit: z.enum(['m', 'deg', 'count', 'none']).optional(),
    note: z.string().optional(),
  })
  .strict()
export type LayoutConflict = z.infer<typeof LayoutConflictSchema>

export const LayoutGapSchema = z
  .object({
    id: z.string().min(1),
    what: z.string().min(1),
    reason: z.string().min(1),
    status: z.enum(['MISSING', 'AMBIGUOUS', 'NOT_ATTEMPTED', 'REFUSED']),
    frameIds: z.array(z.string().min(1)),
  })
  .strict()
export type LayoutGap = z.infer<typeof LayoutGapSchema>

/** One structural item, back to the pixels. §5 requires every accepted exterior segment to carry one of these. */
export const LayoutTraceSchema = z
  .object({
    id: z.string().min(1),
    itemId: z.string().min(1),
    what: z.string().min(1),
    frameId: z.string().min(1).optional(),
    pixelRect: PixelRectSchema.optional(),
    observationIds: z.array(z.string().min(1)),
    evidenceIds: z.array(z.string().min(1)),
    why: z.string().min(1),
  })
  .strict()
export type LayoutTrace = z.infer<typeof LayoutTraceSchema>

// ---------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------

/**
 * §9's gate. A layout that violates a high-authority fact does not get to
 * become a model just because it is the best layout that was found.
 */
export const LayoutStatusSchema = z.enum(['STRUCTURAL_LAYOUT_ACCEPTED', 'STRUCTURAL_LAYOUT_PARTIAL', 'STRUCTURAL_LAYOUT_REJECTED'])
export type LayoutStatus = z.infer<typeof LayoutStatusSchema>

export const LayoutGateReasonSchema = z
  .object({
    code: z.string().min(1),
    what: z.string().min(1),
    /** BLOCKING rejects; DEGRADING makes the layout partial; NOTED is recorded and changes nothing. */
    severity: z.enum(['BLOCKING', 'DEGRADING', 'NOTED']),
    itemIds: z.array(z.string().min(1)),
    why: z.string().min(1),
  })
  .strict()
export type LayoutGateReason = z.infer<typeof LayoutGateReasonSchema>

export const LayoutGateSchema = z.object({ status: LayoutStatusSchema, reasons: z.array(LayoutGateReasonSchema) }).strict()
export type LayoutGate = z.infer<typeof LayoutGateSchema>

// ---------------------------------------------------------------------------
// The set
// ---------------------------------------------------------------------------

export const StructuralLayoutHypothesisSetSchema = z
  .object({
    schema: z.literal(LAYOUT_SET_SCHEMA),
    schemaVersion: z.enum(SUPPORTED_LAYOUT_VERSIONS),
    id: z.string().min(1),
    sourcePackageId: z.string().min(1),
    sourcePackageHash: z.string().regex(/^[0-9a-f]{64}$/),
    observationGraphId: z.string().min(1),
    observationGraphHash: z.string().regex(/^[0-9a-f]{64}$/),
    metricEvidenceId: z.string().min(1),
    metricEvidenceHash: z.string().regex(/^[0-9a-f]{64}$/),

    storeys: z.array(StoreyLayoutHypothesisSchema),
    masses: z.array(MassHypothesisSchema),
    footprintRegions: z.array(FootprintRegionHypothesisSchema),
    recesses: z.array(RecessHypothesisSchema),
    attachments: z.array(AttachmentRelationSchema),
    roofSupports: z.array(RoofSupportHypothesisSchema),
    facadePlanes: z.array(FacadePlaneHypothesisSchema),

    alternatives: z.array(AlternativeGroupSchema),
    conflicts: z.array(LayoutConflictSchema),
    unresolved: z.array(LayoutGapSchema),
    traces: z.array(LayoutTraceSchema),

    gate: LayoutGateSchema,
    contentHash: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict()
export type StructuralLayoutHypothesisSet = z.infer<typeof StructuralLayoutHypothesisSetSchema>

// ---------------------------------------------------------------------------
// Small readers
// ---------------------------------------------------------------------------

export const storeyOf = (set: StructuralLayoutHypothesisSet, index: number): StoreyLayoutHypothesis | undefined => set.storeys.find((s) => s.index === index)
export const regionsOfStorey = (set: StructuralLayoutHypothesisSet, storeyId: string): FootprintRegionHypothesis[] => set.footprintRegions.filter((r) => r.storeyId === storeyId)
export const roofOfMass = (set: StructuralLayoutHypothesisSet, massId: string): RoofSupportHypothesis | undefined => set.roofSupports.find((r) => r.massId === massId)
export const facadesOfMass = (set: StructuralLayoutHypothesisSet, massId: string): FacadePlaneHypothesis[] => set.facadePlanes.filter((f) => f.massId === massId)
export const relationsOf = (set: StructuralLayoutHypothesisSet, id: string): AttachmentRelation[] => set.attachments.filter((a) => a.fromId === id || a.toId === id)

/** The rectangle a ring sits in, which is diagnostic and — §4 — never a mass on its own. */
export function ringBounds(ring: PlanRing): { x0: number; z0: number; x1: number; z1: number } {
  const xs = ring.points.map((p) => p.x)
  const zs = ring.points.map((p) => p.z)
  return { x0: Math.min(...xs), z0: Math.min(...zs), x1: Math.max(...xs), z1: Math.max(...zs) }
}

/** Shoelace area, in square metres, sign discarded. */
export function ringArea(ring: PlanRing): number {
  let sum = 0
  for (let i = 0; i < ring.points.length; i += 1) {
    const a = ring.points[i]
    const b = ring.points[(i + 1) % ring.points.length]
    sum += a.x * b.z - b.x * a.z
  }
  return Math.abs(sum) / 2
}

/** A closed rectangular ring, anticlockwise in plan, which is the convention the wall ring emitter expects. */
export function rectangleRing(x0: number, z0: number, x1: number, z1: number): PlanRing {
  return { points: [{ x: x0, z: z0 }, { x: x0, z: z1 }, { x: x1, z: z1 }, { x: x1, z: z0 }] }
}
