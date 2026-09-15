/**
 * The Building DSL: every command an analyzer, a test or an editor tool can
 * issue against a CanonicalBuildingModel.
 *
 * Commands speak about semantic objects only. There is no `addMesh`: the
 * geometry subsystem owns triangles. Each command has a Zod schema so that a
 * command arriving as JSON (from a future reconstruction pipeline, from a
 * script, from a recorded session) is validated before it touches the model.
 * Defaults live here too, so a caller states only what it knows.
 */
import { z } from 'zod'
import {
  DEFAULT_JUNCTION_TOLERANCE,
  DoorAssemblySchema,
  EvidenceSchema,
  EvidenceSourceSchema,
  IdSchema,
  OpeningHeadSchema,
  OpeningKindSchema,
  OpeningLeafSchema,
  PlanPolygonSchema,
  PlanRectSchema,
  RoofCutModeSchema,
  RoofKindSchema,
  RoofOpeningKindSchema,
  StairDirectionSchema,
  StairSegmentSchema,
  Vec2Schema,
  Vec3Schema,
  WallEndRefSchema,
  WallJunctionKindSchema,
  WallTopProfileSchema,
} from '@buildapp/model'

const finite = z.number().finite()
const positive = z.number().finite().positive()
const nonNegative = z.number().finite().nonnegative()

const withId = { id: IdSchema.optional(), evidence: EvidenceSchema.optional(), name: z.string().optional(), tags: z.array(z.string()).optional() }

export const CreateBuildingSchema = z.object({ type: z.literal('createBuilding'), ...withId, note: z.string().optional() }).strict()

export const CreateLevelSchema = z
  .object({
    type: z.literal('createLevel'),
    ...withId,
    index: z.number().int(),
    elevation: finite,
    height: positive,
  })
  .strict()

export const CreateRoomSchema = z
  .object({
    type: z.literal('createRoom'),
    ...withId,
    levelId: IdSchema,
    polygon: PlanPolygonSchema,
    usage: z.string().optional(),
  })
  .strict()

/**
 * How one end of a wall being created meets an existing wall. Stated inline
 * on `createWall` so that a wall and its junctions enter the model in one
 * step: a wall drawn from footprint line to footprint line overlaps its
 * neighbours until its junctions exist, and every command must leave the
 * model valid. CORNER: `with` names the other wall's end, `owner` says which
 * of the two takes the corner block (SELF = the wall being created).
 */
export const WallEndJunctionSpecSchema = z.discriminatedUnion('kind', [
  z
    .object({ kind: z.literal('CORNER'), id: IdSchema.optional(), with: WallEndRefSchema, owner: z.enum(['SELF', 'OTHER']).default('SELF'), tolerance: nonNegative.default(DEFAULT_JUNCTION_TOLERANCE) })
    .strict(),
  z.object({ kind: z.literal('BUTT'), id: IdSchema.optional(), againstWallId: IdSchema, tolerance: nonNegative.default(DEFAULT_JUNCTION_TOLERANCE) }).strict(),
  z.object({ kind: z.literal('T'), id: IdSchema.optional(), againstWallId: IdSchema, tolerance: nonNegative.default(DEFAULT_JUNCTION_TOLERANCE) }).strict(),
])
export type WallEndJunctionSpec = z.input<typeof WallEndJunctionSpecSchema>

export const CreateWallSchema = z
  .object({
    type: z.literal('createWall'),
    ...withId,
    levelId: IdSchema,
    start: Vec2Schema,
    end: Vec2Schema,
    thickness: positive,
    height: positive,
    baseOffset: finite.default(0),
    kind: z.enum(['EXTERIOR', 'INTERIOR']).default('EXTERIOR'),
    topProfile: WallTopProfileSchema.optional(),
    materialId: IdSchema.optional(),
    /** Junctions at this wall's START and END, created together with the wall (ids `<wall>-j-start` / `<wall>-j-end` unless given). */
    startJunction: WallEndJunctionSpecSchema.optional(),
    endJunction: WallEndJunctionSpecSchema.optional(),
  })
  .strict()

/**
 * Declare how walls meet; the model resolves the physical extents (see
 * docs/WALL_TOPOLOGY.md). CORNER takes `a`, `b` and optionally `owner`
 * (default: `a`'s wall); BUTT and T take `wall` and `againstWallId`.
 */
export const CreateWallJunctionSchema = z
  .object({
    type: z.literal('createWallJunction'),
    ...withId,
    kind: WallJunctionKindSchema,
    a: WallEndRefSchema.optional(),
    b: WallEndRefSchema.optional(),
    owner: IdSchema.optional(),
    wall: WallEndRefSchema.optional(),
    againstWallId: IdSchema.optional(),
    tolerance: nonNegative.default(DEFAULT_JUNCTION_TOLERANCE),
  })
  .strict()

/** Per-edge overrides for `createWallRing`, in polygon order. */
export const RingWallOverrideSchema = z
  .object({
    id: IdSchema.optional(),
    name: z.string().optional(),
    evidence: EvidenceSchema.optional(),
    tags: z.array(z.string()).optional(),
    height: positive.optional(),
    thickness: positive.optional(),
    materialId: IdSchema.optional(),
    topProfile: WallTopProfileSchema.optional(),
  })
  .strict()

/**
 * A closed ring of walls from a natural footprint polygon: one wall per edge
 * along the polygon's outer line, one CORNER junction per vertex, and a
 * WallRing record grouping them. The caller never trims a corner: the
 * junctions resolve exactly-once corner material. Ids are deterministic:
 * `<ring>-w<i>` and `<ring>-j<i>` unless overridden.
 */
export const CreateWallRingSchema = z
  .object({
    type: z.literal('createWallRing'),
    ...withId,
    levelId: IdSchema,
    polygon: PlanPolygonSchema,
    thickness: positive,
    height: positive,
    baseOffset: finite.default(0),
    kind: z.enum(['EXTERIOR', 'INTERIOR']).default('EXTERIOR'),
    topProfile: WallTopProfileSchema.optional(),
    materialId: IdSchema.optional(),
    walls: z.array(RingWallOverrideSchema).optional(),
    /** Who owns each corner: ALTERNATE gives even-numbered edges their corners (front/rear on a rectangle); PRECEDING / FOLLOWING name the edge before / after the vertex. */
    cornerOwnership: z.enum(['ALTERNATE', 'PRECEDING', 'FOLLOWING']).default('ALTERNATE'),
    tolerance: nonNegative.default(DEFAULT_JUNCTION_TOLERANCE),
  })
  .strict()

/** A slab from its outer polygon; `holes` are polygons the compiler removes through the whole thickness (a stair void). */
export const CreateSlabSchema = z
  .object({
    type: z.literal('createSlab'),
    ...withId,
    levelId: IdSchema,
    polygon: PlanPolygonSchema,
    holes: z.array(PlanPolygonSchema).optional(),
    topOffset: finite.default(0),
    thickness: positive,
    materialId: IdSchema.optional(),
  })
  .strict()

export const CreateRoofSchema = z
  .object({
    type: z.literal('createRoof'),
    ...withId,
    levelId: IdSchema,
    kind: RoofKindSchema,
    footprint: PlanRectSchema,
    eaveOffset: finite,
    pitchDeg: z.number().finite().min(0).max(85).default(0),
    ridgeAxis: z.enum(['X', 'Z']).default('X'),
    overhang: nonNegative.default(0),
    thickness: positive.default(0.25),
    materialId: IdSchema.optional(),
    /** Walls whose top should die into this roof (their topProfile becomes FOLLOW_ROOF). */
    capWallIds: z.array(IdSchema).default([]),
  })
  .strict()

/**
 * A structural hole in a wall. `head` shapes the head (absent = level; RAKED
 * slopes it from `height` at the near edge to `heightFar` at the far edge);
 * `leaves` names further parallel wall leaves the same opening passes
 * through, each with its own offset along its own wall.
 */
export const CutOpeningSchema = z
  .object({
    type: z.literal('cutOpening'),
    ...withId,
    wallId: IdSchema,
    kind: OpeningKindSchema,
    offset: nonNegative,
    sill: nonNegative,
    width: positive,
    height: positive,
    head: OpeningHeadSchema.optional(),
    leaves: z.array(OpeningLeafSchema).optional(),
  })
  .strict()

export const PlaceWindowSchema = z
  .object({
    type: z.literal('placeWindow'),
    ...withId,
    openingId: IdSchema,
    frameWidth: positive.default(0.07),
    frameDepth: positive.default(0.08),
    frameInset: nonNegative.default(0.12),
    glassThickness: positive.default(0.024),
    divisions: z.number().int().min(1).default(1),
    /** Mullion positions as fractions of the opening width; when given, they replace the equal `divisions`. */
    mullions: z.array(z.number().gt(0).lt(1)).optional(),
    materialId: IdSchema.optional(),
  })
  .strict()

/**
 * A structural hole through a roof over `footprint` (the outline on the top
 * surface), cut VERTICAL (default) or NORMAL_TO_ROOF. ROOFLIGHT holes take a
 * `placeRooflight` fill; a PENETRATION names the chimney that passes through
 * it in `throughId` (a chimney needs a VERTICAL cut).
 */
export const CutRoofOpeningSchema = z
  .object({
    type: z.literal('cutRoofOpening'),
    ...withId,
    roofId: IdSchema,
    kind: RoofOpeningKindSchema,
    footprint: PlanRectSchema,
    cut: RoofCutModeSchema.optional(),
    throughId: IdSchema.optional(),
  })
  .strict()

export const PlaceRooflightSchema = z
  .object({
    type: z.literal('placeRooflight'),
    ...withId,
    roofOpeningId: IdSchema,
    frameWidth: positive.default(0.07),
    glassThickness: positive.default(0.024),
    materialId: IdSchema.optional(),
  })
  .strict()

/**
 * A door in a DOOR opening. Without `assembly` it is one hinged leaf; with
 * one, the opening hosts the stated panels side by side (`LEAF` with its
 * own hinge edge and optional full glazing, `GLAZED` fixed sidelights,
 * `PANEL` fixed solid panels) with mullions of `assembly.mullionWidth`
 * between them; the fractions sum to 1.
 */
export const PlaceDoorSchema = z
  .object({
    type: z.literal('placeDoor'),
    ...withId,
    openingId: IdSchema,
    hingeSide: z.enum(['LEFT', 'RIGHT']).default('LEFT'),
    swing: z.enum(['IN', 'OUT']).default('IN'),
    openAngle: z.number().finite().min(0).max(180).default(0),
    leafThickness: positive.default(0.045),
    frameWidth: positive.default(0.06),
    frameDepth: positive.default(0.12),
    frameInset: nonNegative.default(0.1),
    assembly: DoorAssemblySchema.optional(),
    materialId: IdSchema.optional(),
  })
  .strict()

export const CreateBalconySchema = z
  .object({
    type: z.literal('createBalcony'),
    ...withId,
    levelId: IdSchema,
    kind: z.enum(['BALCONY', 'TERRACE', 'LOGGIA']).default('BALCONY'),
    footprint: PlanRectSchema,
    topOffset: finite.default(0),
    thickness: positive.default(0.2),
    materialId: IdSchema.optional(),
  })
  .strict()

export const CreateRailingSchema = z
  .object({
    type: z.literal('createRailing'),
    ...withId,
    levelId: IdSchema,
    start: Vec2Schema,
    end: Vec2Schema,
    baseOffset: finite.default(0),
    height: positive.default(1.1),
    postSpacing: positive.default(1.2),
    infill: z.enum(['GLASS', 'BARS', 'NONE']).default('BARS'),
    hostId: IdSchema.optional(),
    materialId: IdSchema.optional(),
  })
  .strict()

export const PlaceChimneySchema = z
  .object({
    type: z.literal('placeChimney'),
    ...withId,
    levelId: IdSchema,
    footprint: PlanRectSchema,
    baseOffset: finite.default(0),
    height: positive,
    materialId: IdSchema.optional(),
  })
  .strict()

export const CreateStairPlaceholderSchema = z
  .object({
    type: z.literal('createStairPlaceholder'),
    ...withId,
    levelId: IdSchema,
    toLevelId: IdSchema,
    footprint: PlanRectSchema,
  })
  .strict()

/**
 * A real staircase from `levelId` up to `toLevelId`: the first riser line's
 * left-hand end `start` (facing `direction`), the stair `width`, and the
 * `segments` walked in order (FLIGHT / WINDER / LANDING, see the model). The
 * rise is `toLevel.elevation + topOffset − (level.elevation + baseOffset)`,
 * shared equally by every riser. `footprint` may be omitted: it is then the
 * rectangle the laid-out steps occupy.
 */
export const CreateStairSchema = z
  .object({
    type: z.literal('createStair'),
    ...withId,
    levelId: IdSchema,
    toLevelId: IdSchema,
    footprint: PlanRectSchema.optional(),
    start: Vec2Schema,
    direction: StairDirectionSchema,
    width: positive,
    baseOffset: finite.default(0),
    topOffset: finite.default(0),
    waist: positive.default(0.18),
    segments: z.array(StairSegmentSchema).min(1),
    materialId: IdSchema.optional(),
  })
  .strict()

/**
 * A finish region on one face of a wall: a wall-local rectangle (`a` along
 * the wall from its start, `b` up from its base) showing `materialId`. The
 * compiler clips it to the wall's real material (roof soffit, openings).
 */
export const CreateSurfaceRegionSchema = z
  .object({
    type: z.literal('createSurfaceRegion'),
    ...withId,
    hostId: IdSchema,
    face: z.enum(['OUTER', 'INNER']).default('OUTER'),
    rect: z.object({ a0: finite, a1: finite, b0: finite, b1: finite }).strict(),
    materialId: IdSchema,
  })
  .strict()

/**
 * A straight member with a rectangular cross-section, extruded along its own
 * centreline: a facade frame, a beam over an opening, a fin, a parapet
 * upstand, a deep reveal.
 *
 * Stated in world coordinates rather than host-local ones, because a member
 * often runs past its host — across a setback, from a garage face to a balcony
 * — and a host-local statement of that is a statement about two hosts.
 * `hostId` records the relation without making the geometry depend on it.
 *
 * `width` is the dimension seen in elevation and `depth` how far the member
 * stands proud; the axes they are measured along come from the path itself
 * (see `linearSolidBasis`), so the same numbers are the same shape wherever
 * the member is.
 */
export const CreateLinearSolidSchema = z
  .object({
    type: z.literal('createLinearSolid'),
    ...withId,
    levelId: IdSchema,
    hostId: IdSchema.optional(),
    start: Vec3Schema,
    end: Vec3Schema,
    width: positive,
    depth: positive,
    rollDeg: finite.optional(),
    materialId: IdSchema,
  })
  .strict()

export const DefineMaterialSchema = z
  .object({
    type: z.literal('defineMaterial'),
    id: IdSchema.optional(),
    name: z.string(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    opacity: z.number().min(0).max(1).optional(),
    note: z.string().optional(),
  })
  .strict()

export const AssignMaterialSchema = z
  .object({ type: z.literal('assignMaterial'), targetId: IdSchema, materialId: IdSchema.nullable() })
  .strict()

/** Translate a feature. Walls, railings, rooms, slabs and rect features move in plan; openings move along their wall; levels move vertically. */
export const MoveFeatureSchema = z
  .object({
    type: z.literal('moveFeature'),
    targetId: IdSchema,
    dx: finite.default(0),
    dy: finite.default(0),
    dz: finite.default(0),
    /** For openings: distance along the host wall. */
    dAlong: finite.default(0),
  })
  .strict()

/** Change a feature's size. Which fields apply depends on the kind; the rest are rejected. */
export const ResizeFeatureSchema = z
  .object({
    type: z.literal('resizeFeature'),
    targetId: IdSchema,
    width: positive.optional(),
    height: positive.optional(),
    thickness: positive.optional(),
    /** Walls and railings: new length, keeping `start` and direction. */
    length: positive.optional(),
    footprint: PlanRectSchema.optional(),
  })
  .strict()

/** Set one property of one object. The object is re-validated against its schema afterwards. */
export const SetPropertySchema = z
  .object({
    type: z.literal('setProperty'),
    targetId: IdSchema,
    property: z.string().min(1),
    value: z.unknown(),
  })
  .strict()

export const AddConstraintSchema = z
  .object({
    type: z.literal('addConstraint'),
    ...withId,
    kind: z.enum(['FIXED_VALUE', 'EQUAL', 'ALIGN', 'NOTE']),
    targetIds: z.array(IdSchema).min(1),
    property: z.string().optional(),
    value: finite.optional(),
    tolerance: nonNegative.optional(),
    note: z.string().optional(),
  })
  .strict()

export const RemoveFeatureSchema = z
  .object({
    type: z.literal('removeFeature'),
    targetId: IdSchema,
    /** Also remove dependants (openings of a wall, fills of an opening, ...). Default true. */
    cascade: z.boolean().default(true),
  })
  .strict()

export const SetEvidenceSchema = z
  .object({ type: z.literal('setEvidence'), targetId: IdSchema, evidence: EvidenceSchema })
  .strict()

export const AddEvidenceSourceSchema = z
  .object({ type: z.literal('addEvidenceSource'), ...EvidenceSourceSchema.omit({ id: true }).shape, id: IdSchema.optional() })
  .strict()

export const SetModelNameSchema = z.object({ type: z.literal('setModelName'), name: z.string() }).strict()

export const BuildingCommandSchema = z.discriminatedUnion('type', [
  CreateBuildingSchema,
  CreateLevelSchema,
  CreateRoomSchema,
  CreateWallSchema,
  CreateWallJunctionSchema,
  CreateWallRingSchema,
  CreateSlabSchema,
  CreateRoofSchema,
  CutOpeningSchema,
  PlaceWindowSchema,
  PlaceDoorSchema,
  CutRoofOpeningSchema,
  PlaceRooflightSchema,
  CreateBalconySchema,
  CreateRailingSchema,
  PlaceChimneySchema,
  CreateStairPlaceholderSchema,
  CreateStairSchema,
  CreateSurfaceRegionSchema,
  CreateLinearSolidSchema,
  DefineMaterialSchema,
  AssignMaterialSchema,
  MoveFeatureSchema,
  ResizeFeatureSchema,
  SetPropertySchema,
  AddConstraintSchema,
  RemoveFeatureSchema,
  SetEvidenceSchema,
  AddEvidenceSourceSchema,
  SetModelNameSchema,
])

/** A command as a caller writes it (defaults optional). */
export type BuildingCommand = z.input<typeof BuildingCommandSchema>
/** A command after defaults were applied. */
export type ResolvedCommand = z.output<typeof BuildingCommandSchema>
export type CommandType = ResolvedCommand['type']

export const COMMAND_TYPES: readonly CommandType[] = BuildingCommandSchema.options.map(
  (o) => o.shape.type.value as CommandType,
)
