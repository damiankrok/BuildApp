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
  EvidenceSchema,
  EvidenceSourceSchema,
  IdSchema,
  OpeningKindSchema,
  PlanPolygonSchema,
  PlanRectSchema,
  RoofKindSchema,
  Vec2Schema,
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
  })
  .strict()

export const CreateSlabSchema = z
  .object({
    type: z.literal('createSlab'),
    ...withId,
    levelId: IdSchema,
    polygon: PlanPolygonSchema,
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
    materialId: IdSchema.optional(),
  })
  .strict()

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
  CreateSlabSchema,
  CreateRoofSchema,
  CutOpeningSchema,
  PlaceWindowSchema,
  PlaceDoorSchema,
  CreateBalconySchema,
  CreateRailingSchema,
  PlaceChimneySchema,
  CreateStairPlaceholderSchema,
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
