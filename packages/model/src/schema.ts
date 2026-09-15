/**
 * CanonicalBuildingModel — the versioned source of truth.
 *
 * Every semantic object has a stable `id`. Objects reference each other by id:
 *
 *   Window -> Opening -> Wall -> Level -> Building
 *   Door   -> Opening -> Wall -> Level -> Building
 *   Room   -> Level, Slab -> Level, Roof -> Level, Balcony -> Level, ...
 *
 * Vertical positions inside a level are *offsets from that level's finished
 * floor elevation*, so moving a level moves everything that stands on it. Plan
 * positions are world x/z. Lengths are metres, angles degrees.
 *
 * The schemas here are runtime validation (Zod) and the TypeScript types are
 * inferred from them, so a model that type-checks and a model that validates
 * are the same thing.
 */
import { z } from 'zod'
import { EvidenceSchema, EvidenceSourceSchema } from './evidence.js'
import { PlanPolygonSchema, PlanRectSchema, Vec2Schema, finite, nonNegative, positive } from './geometry-types.js'

export const MODEL_SCHEMA_NAME = 'buildapp.canonical-building-model' as const
export const MODEL_SCHEMA_VERSION = '1.3.0' as const
/** Versions `validateModel` accepts: the current one, and older ones it migrates explicitly (see migrate.ts). */
export const SUPPORTED_SCHEMA_VERSIONS = ['1.0.0', '1.1.0', '1.2.0', '1.3.0'] as const

/** Stable identifier: letters, digits, `_`, `-`, `.`, `:`. */
export const IdSchema = z.string().regex(/^[A-Za-z0-9_.:-]+$/, 'ids use letters, digits, _ - . :')

/**
 * The world frame, recorded verbatim in every persisted model so that a file
 * can never be read in the wrong frame. The values are constants; a model
 * that states a different frame fails validation.
 */
export const MODEL_FRAME = {
  x: 'right when looking at the front facade',
  y: 'up (vertical)',
  z: 'away from the front facade, into the building',
  origin: 'finished ground-floor level is y = 0; the front facade outer face is z = 0',
  handedness: 'LEFT_HANDED_AS_SPECIFIED',
  wallConvention:
    'a wall runs from start to end along its OUTER face at its base; its outward normal is up x u, ' +
    'so exterior rings are traversed counter-clockwise on a plan drawn with the front facade at the bottom ' +
    'and material lies to the left of the direction of travel',
  viewerNote: 'renderers working in a right-handed frame mirror z when building their scene',
} as const

export const FrameSchema = z
  .object({
    x: z.literal(MODEL_FRAME.x),
    y: z.literal(MODEL_FRAME.y),
    z: z.literal(MODEL_FRAME.z),
    origin: z.literal(MODEL_FRAME.origin),
    handedness: z.literal(MODEL_FRAME.handedness),
    wallConvention: z.literal(MODEL_FRAME.wallConvention),
    viewerNote: z.literal(MODEL_FRAME.viewerNote),
  })
  .strict()

export const UnitsSchema = z.object({ length: z.literal('m'), angle: z.literal('deg') }).strict()
export const MODEL_UNITS = { length: 'm', angle: 'deg' } as const

// ---------------------------------------------------------------------------
// Semantic objects
// ---------------------------------------------------------------------------

const base = {
  id: IdSchema,
  name: z.string().optional(),
  evidence: EvidenceSchema.optional(),
  /** Free-form tags for future tooling (e.g. "front-facade"). */
  tags: z.array(z.string()).optional(),
}

export const BuildingSchema = z
  .object({
    ...base,
    note: z.string().optional(),
  })
  .strict()
export type Building = z.infer<typeof BuildingSchema>

export const LevelSchema = z
  .object({
    ...base,
    buildingId: IdSchema,
    /** Ordering, ground floor = 0, upper floors positive, basements negative. */
    index: z.number().int(),
    /** Finished floor elevation, world y. */
    elevation: finite,
    /** Nominal storey height (finished floor to next finished floor). */
    height: positive,
  })
  .strict()
export type Level = z.infer<typeof LevelSchema>

export const RoomSchema = z
  .object({
    ...base,
    levelId: IdSchema,
    polygon: PlanPolygonSchema,
    /** Room usage label, free text ("kitchen"). */
    usage: z.string().optional(),
  })
  .strict()
export type Room = z.infer<typeof RoomSchema>

/**
 * Where a wall stops at the top.
 *
 * FLAT — at `height`.
 * FOLLOW_ROOF — at min(`height`, underside of the named roof). A gable end
 *   wall under a gable roof therefore rises into the gable; an eave wall
 *   under the same roof is capped at the roof's underside.
 * POLYLINE — an explicit height along the wall's own `u` axis.
 */
export const WallTopProfileSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('FLAT') }).strict(),
  z.object({ kind: z.literal('FOLLOW_ROOF'), roofId: IdSchema }).strict(),
  z
    .object({
      kind: z.literal('POLYLINE'),
      points: z.array(z.object({ u: finite, height: positive }).strict()).min(2),
    })
    .strict(),
])
export type WallTopProfile = z.infer<typeof WallTopProfileSchema>

export const WallSchema = z
  .object({
    ...base,
    levelId: IdSchema,
    /** Outer-face line at the wall base, world x/z. */
    start: Vec2Schema,
    end: Vec2Schema,
    thickness: positive,
    /** Nominal height above the wall base. */
    height: positive,
    /** Base above the level's finished floor (normally 0). */
    baseOffset: finite,
    kind: z.enum(['EXTERIOR', 'INTERIOR']),
    topProfile: WallTopProfileSchema.optional(),
    materialId: IdSchema.optional(),
  })
  .strict()
export type Wall = z.infer<typeof WallSchema>

/** One end of a wall: `START` is where the wall's outer-face line begins, `END` where it ends. */
export const WallEndSchema = z.enum(['START', 'END'])
export type WallEnd = z.infer<typeof WallEndSchema>

export const WallEndRefSchema = z.object({ wallId: IdSchema, end: WallEndSchema }).strict()
export type WallEndRef = z.infer<typeof WallEndRefSchema>

export const WallJunctionKindSchema = z.enum(['CORNER', 'BUTT', 'T'])
export type WallJunctionKind = z.infer<typeof WallJunctionKindSchema>

/**
 * A wall junction: the caller states how walls meet, the model resolves the
 * physical wall extents (see topology.ts and docs/WALL_TOPOLOGY.md).
 *
 * CORNER — the ends `a` and `b` of two walls meet at their outer corner. The
 *   `owner` wall runs through the corner block and takes its material; the
 *   other wall stops at the owner's near face.
 * BUTT — the end `wall` terminates against a face of `againstWallId`, which
 *   is not modified and owns the material; the terminating wall stops at the
 *   host's near face. The contact must lie on the host's physical face.
 * T — a BUTT whose contact lies strictly inside the host's length (the host
 *   continues on both sides).
 *
 * Endpoints are stated in natural footprint coordinates: an endpoint may sit
 * anywhere within the other wall's thickness band (on its outer line, on its
 * inner face, or between). `tolerance` (m) bounds how far an endpoint may miss
 * that band before the junction is reported as a gap or an overshoot.
 */
const junctionBase = { ...base, tolerance: nonNegative }
export const WallJunctionSchema = z.discriminatedUnion('kind', [
  z.object({ ...junctionBase, kind: z.literal('CORNER'), a: WallEndRefSchema, b: WallEndRefSchema, owner: IdSchema }).strict(),
  z.object({ ...junctionBase, kind: z.literal('BUTT'), wall: WallEndRefSchema, againstWallId: IdSchema }).strict(),
  z.object({ ...junctionBase, kind: z.literal('T'), wall: WallEndRefSchema, againstWallId: IdSchema }).strict(),
])
export type WallJunction = z.infer<typeof WallJunctionSchema>

/** Default junction tolerance: one millimetre. */
export const DEFAULT_JUNCTION_TOLERANCE = 0.001

/**
 * A closed ring of walls on one level: `wallIds` in traversal order (wall i
 * runs from ring vertex i to vertex i+1) and `junctionIds[i]`, the CORNER
 * junction at vertex i between wall i-1's END and wall i's START. The ring
 * is a grouping over ordinary walls: they stay editable, and the ring's
 * polygon is the walls' start points (`ringPolygon`).
 */
export const WallRingSchema = z
  .object({
    ...base,
    levelId: IdSchema,
    wallIds: z.array(IdSchema).min(3),
    junctionIds: z.array(IdSchema).min(3),
  })
  .strict()
export type WallRing = z.infer<typeof WallRingSchema>

export const OpeningKindSchema = z.enum(['WINDOW', 'DOOR', 'PASSAGE'])
export type OpeningKind = z.infer<typeof OpeningKindSchema>

/**
 * The shape of an opening's head. LEVEL (the default when absent) is the
 * rectangular opening of schema 1.0.0 / 1.1.0. RAKED slopes the head in a
 * straight line from `height` at the opening's near edge (`offset`) to
 * `heightFar` at its far edge (`offset + width`), both above the wall base —
 * a gable window whose head follows the roof. The structural hole is the
 * trapezoid; nothing is painted.
 */
export const OpeningHeadSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('LEVEL') }).strict(),
  z.object({ kind: z.literal('RAKED'), heightFar: positive }).strict(),
])
export type OpeningHead = z.infer<typeof OpeningHeadSchema>

/**
 * A further wall leaf the same physical opening passes through. Where two
 * walls stand back to back (two rings abutting, a cavity wall stated as two
 * leaves), one door is one semantic opening cut through every leaf; each leaf
 * has its own `offset` along its own wall because each wall has its own
 * origin. Sill, width, height and head are shared.
 */
export const OpeningLeafSchema = z.object({ wallId: IdSchema, offset: nonNegative }).strict()
export type OpeningLeaf = z.infer<typeof OpeningLeafSchema>

/**
 * A hole through its host wall, stated in the host wall's own frame:
 * `offset` along the wall from `start`, `sill` above the wall base, `height`
 * to the head at the near edge. `head` shapes the head (absent = level);
 * `leaves` names further wall leaves the same opening cuts through.
 */
export const OpeningSchema = z
  .object({
    ...base,
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
export type Opening = z.infer<typeof OpeningSchema>

/**
 * A window filling an opening: frame + glazing, as separate geometry parts.
 * `divisions` splits the glazing into vertical panes with mullions, which is
 * where future sash/pivot behaviour attaches.
 */
export const WindowSchema = z
  .object({
    ...base,
    openingId: IdSchema,
    frameWidth: positive,
    frameDepth: positive,
    /** Distance from the wall's outer face to the frame's outer face. */
    frameInset: nonNegative,
    glassThickness: positive,
    divisions: z.number().int().min(1),
    /**
     * Where the mullions stand, as fractions of the opening width from the
     * near edge, strictly increasing. When absent the glazing is split into
     * `divisions` equal panes.
     */
    mullions: z.array(z.number().gt(0).lt(1)).optional(),
    materialId: IdSchema.optional(),
  })
  .strict()
export type Window = z.infer<typeof WindowSchema>

/**
 * One panel of a composite door assembly, across the opening from its near
 * jamb (`offset` side) to its far jamb. `fraction` is the panel's share of
 * the opening width; the fractions of an assembly sum to 1. LEAF pivots on
 * its own `hinge` edge (LEFT = the edge nearer the opening's near jamb) by
 * the door's `openAngle` towards `swing`; `glazing: FULL` makes it a glazed
 * leaf (stiles and rails around a pane). GLAZED is a fixed glazed panel (a
 * sidelight) in its own frame; PANEL is a fixed solid panel (a sectional or
 * blank door). Mullions of `mullionWidth` stand between adjacent panels.
 */
export const DoorPanelSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('LEAF'), fraction: z.number().gt(0).lte(1), hinge: z.enum(['LEFT', 'RIGHT']), glazing: z.enum(['NONE', 'FULL']) }).strict(),
  z.object({ kind: z.literal('GLAZED'), fraction: z.number().gt(0).lte(1) }).strict(),
  z.object({ kind: z.literal('PANEL'), fraction: z.number().gt(0).lte(1) }).strict(),
])
export type DoorPanel = z.infer<typeof DoorPanelSchema>

export const DoorAssemblySchema = z
  .object({
    panels: z.array(DoorPanelSchema).min(1),
    mullionWidth: positive,
  })
  .strict()
export type DoorAssembly = z.infer<typeof DoorAssemblySchema>

/**
 * A door filling an opening: frame, leaf, handle. The leaf pivots about a
 * vertical axis on `hingeSide` (as seen from outside, along the wall's `u`)
 * and is rotated by `openAngle` degrees towards `swing`. With an `assembly`
 * the opening hosts several panels side by side (a leaf and a glazed
 * sidelight, a sectional panel, a fully glazed leaf); each LEAF panel then
 * states its own hinge edge and `hingeSide` is not used.
 */
export const DoorSchema = z
  .object({
    ...base,
    openingId: IdSchema,
    hingeSide: z.enum(['LEFT', 'RIGHT']),
    swing: z.enum(['IN', 'OUT']),
    openAngle: z.number().finite().min(0).max(180),
    leafThickness: positive,
    frameWidth: positive,
    frameDepth: positive,
    frameInset: nonNegative,
    assembly: DoorAssemblySchema.optional(),
    materialId: IdSchema.optional(),
  })
  .strict()
export type Door = z.infer<typeof DoorSchema>

/**
 * A slab: its outer `polygon` less zero or more `holes` (each a simple plan
 * polygon lying inside the outer polygon; a hole may share part of its
 * boundary with the outer polygon — a stair void against a wall — but never
 * cross it or another hole). The compiler removes each hole through the
 * whole thickness, so a vertical ray through a hole meets no slab material.
 */
export const SlabSchema = z
  .object({
    ...base,
    levelId: IdSchema,
    polygon: PlanPolygonSchema,
    holes: z.array(PlanPolygonSchema).optional(),
    /** Top surface above the level's finished floor (0 = it is the floor). */
    topOffset: finite,
    thickness: positive,
    materialId: IdSchema.optional(),
  })
  .strict()
export type Slab = z.infer<typeof SlabSchema>

export const RoofKindSchema = z.enum(['GABLE', 'FLAT'])
export type RoofKind = z.infer<typeof RoofKindSchema>

/**
 * A roof over a plan rectangle. `eaveOffset` is the height of the roof's top
 * surface at the footprint edge, above the level's finished floor. A gable
 * rises from both eaves at `pitchDeg` to a ridge along `ridgeAxis` through the
 * footprint's middle; a flat roof is a plate at the eave.
 */
export const RoofSchema = z
  .object({
    ...base,
    levelId: IdSchema,
    kind: RoofKindSchema,
    footprint: PlanRectSchema,
    eaveOffset: finite,
    pitchDeg: z.number().finite().min(0).max(85),
    ridgeAxis: z.enum(['X', 'Z']),
    overhang: nonNegative,
    thickness: positive,
    materialId: IdSchema.optional(),
  })
  .strict()
export type Roof = z.infer<typeof RoofSchema>

export const RoofOpeningKindSchema = z.enum(['ROOFLIGHT', 'PENETRATION'])
export type RoofOpeningKind = z.infer<typeof RoofOpeningKindSchema>

/**
 * How a roof opening is cut through the roof plate. VERTICAL (the default
 * when absent, and the only cut of schema 1.2.0): the prism over the plan
 * rectangle, its sides vertical — a chimney passes through such a hole.
 * NORMAL_TO_ROOF: the sides are perpendicular to the roof plane, so the hole
 * has the same outline on the top surface and on the underside measured
 * along the roof normal — how a rooflight unit sits in a pitched roof. The
 * `footprint` is always the outline on the roof's top surface in plan; a
 * normal cut's underside outline is shifted uphill by `thickness · sin pitch`.
 */
export const RoofCutModeSchema = z.enum(['VERTICAL', 'NORMAL_TO_ROOF'])
export type RoofCutMode = z.infer<typeof RoofCutModeSchema>

/**
 * A structural hole through a roof over a plan rectangle (the outline on the
 * top surface), cut VERTICAL or NORMAL_TO_ROOF (`cut`), so a ray through it
 * meets no roof material. ROOFLIGHT holes take a `Rooflight` fill; a
 * PENETRATION lets the element named by `throughId` (a chimney) pass through
 * the roof without sharing its volume. The rectangle (and, for a normal cut,
 * its underside outline) must lie inside the roof's covered area and, on a
 * gable, within one slope.
 */
export const RoofOpeningSchema = z
  .object({
    ...base,
    roofId: IdSchema,
    kind: RoofOpeningKindSchema,
    footprint: PlanRectSchema,
    cut: RoofCutModeSchema.optional(),
    throughId: IdSchema.optional(),
  })
  .strict()
export type RoofOpening = z.infer<typeof RoofOpeningSchema>

/**
 * A rooflight filling a ROOFLIGHT roof opening: a frame ring between the
 * roof's top surface and its underside, glazing at mid-depth. Separate
 * geometry parts, like a window.
 */
export const RooflightSchema = z
  .object({
    ...base,
    roofOpeningId: IdSchema,
    frameWidth: positive,
    glassThickness: positive,
    materialId: IdSchema.optional(),
  })
  .strict()
export type Rooflight = z.infer<typeof RooflightSchema>

export const BalconySchema = z
  .object({
    ...base,
    levelId: IdSchema,
    kind: z.enum(['BALCONY', 'TERRACE', 'LOGGIA']),
    footprint: PlanRectSchema,
    topOffset: finite,
    thickness: positive,
    materialId: IdSchema.optional(),
  })
  .strict()
export type Balcony = z.infer<typeof BalconySchema>

export const RailingSchema = z
  .object({
    ...base,
    levelId: IdSchema,
    start: Vec2Schema,
    end: Vec2Schema,
    /** Base of the railing above the level's finished floor. */
    baseOffset: finite,
    height: positive,
    postSpacing: positive,
    infill: z.enum(['GLASS', 'BARS', 'NONE']),
    /** The balcony / terrace this railing guards, when it does. */
    hostId: IdSchema.optional(),
    materialId: IdSchema.optional(),
  })
  .strict()
export type Railing = z.infer<typeof RailingSchema>

export const ChimneySchema = z
  .object({
    ...base,
    levelId: IdSchema,
    footprint: PlanRectSchema,
    baseOffset: finite,
    height: positive,
    materialId: IdSchema.optional(),
  })
  .strict()
export type Chimney = z.infer<typeof ChimneySchema>

/** Direction of travel in plan, for stairs. */
export const StairDirectionSchema = z.enum(['PLUS_X', 'MINUS_X', 'PLUS_Z', 'MINUS_Z'])
export type StairDirection = z.infer<typeof StairDirectionSchema>

/**
 * One segment of a stair's path, in travel order.
 *
 * FLIGHT — `risers` straight risers, each tread `going` deep; the first riser
 *   stands on the current riser line.
 * WINDER — `risers` tapered treads turning `angleDeg` (90 or 180) about the
 *   newel corner on the `turn` side, in the square (90°) or double square
 *   (180°) in front of the current riser line; the riser lines fan from the
 *   newel at equal angles and the next segment's first riser is the exit line.
 * LANDING — a level platform `length` along the travel direction (at least
 *   the stair width when it turns), optionally turning 90° LEFT or RIGHT.
 *
 * LEFT / RIGHT are as seen walking up, on a plan drawn with x to the right
 * and z up the page: walking +x, LEFT turns towards +z.
 */
export const StairSegmentSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('FLIGHT'), risers: z.number().int().min(1), going: positive }).strict(),
  z.object({ kind: z.literal('WINDER'), risers: z.number().int().min(1), turn: z.enum(['LEFT', 'RIGHT']), angleDeg: z.union([z.literal(90), z.literal(180)]) }).strict(),
  z.object({ kind: z.literal('LANDING'), length: positive, turn: z.enum(['NONE', 'LEFT', 'RIGHT']) }).strict(),
])
export type StairSegment = z.infer<typeof StairSegmentSchema>

const stairBase = {
  ...base,
  levelId: IdSchema,
  toLevelId: IdSchema,
  /** The overall plan footprint the stair occupies (a placeholder's only geometry; a flight stair's steps must lie inside it). */
  footprint: PlanRectSchema,
}

/**
 * A stair from `levelId` up to `toLevelId`.
 *
 * PLACEHOLDER — a footprint only (schema 1.0.0 – 1.2.0).
 * FLIGHTS — a real staircase: the path starts on the first riser line, whose
 *   left-hand end (facing `direction`) is `start` and which runs `width`
 *   across the travel direction; `segments` describe flights, winders and
 *   landings in walking order; the total rise is from `level.elevation +
 *   baseOffset` to `toLevel.elevation + topOffset`, divided equally over
 *   every riser; the last segment must be a FLIGHT whose last riser is the
 *   arrival at the destination floor (its tread is that floor). `waist` is
 *   the vertical depth of each step's solid below its tread nosing.
 */
export const StairSchema = z.discriminatedUnion('kind', [
  z.object({ ...stairBase, kind: z.literal('PLACEHOLDER') }).strict(),
  z
    .object({
      ...stairBase,
      kind: z.literal('FLIGHTS'),
      start: Vec2Schema,
      direction: StairDirectionSchema,
      width: positive,
      baseOffset: finite,
      topOffset: finite,
      waist: positive,
      segments: z.array(StairSegmentSchema).min(1),
      materialId: IdSchema.optional(),
    })
    .strict(),
])
export type Stair = z.infer<typeof StairSchema>
export type FlightStair = Extract<Stair, { kind: 'FLIGHTS' }>

/**
 * A finish region on one face of a wall: a wall-local rectangle (`a` along
 * the wall from its start, `b` up from its base) on the OUTER or INNER face
 * that shows `materialId` instead of the wall's own material. It is
 * appearance, not structure: it has no thickness of its own, changes no
 * wall volume, and is clipped by the compiler to the wall's real material —
 * its top follows a roof soffit and every opening is left out of it.
 */
export const SurfaceRegionSchema = z
  .object({
    ...base,
    hostId: IdSchema,
    face: z.enum(['OUTER', 'INNER']),
    rect: z.object({ a0: finite, a1: finite, b0: finite, b1: finite }).strict(),
    materialId: IdSchema,
  })
  .strict()
export type SurfaceRegion = z.infer<typeof SurfaceRegionSchema>

export const MaterialSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    /** `#rrggbb` */
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    opacity: z.number().min(0).max(1).optional(),
    note: z.string().optional(),
  })
  .strict()
export type Material = z.infer<typeof MaterialSchema>

export const ConstraintSchema = z
  .object({
    ...base,
    kind: z.enum(['FIXED_VALUE', 'EQUAL', 'ALIGN', 'NOTE']),
    targetIds: z.array(IdSchema).min(1),
    /** Property the constraint speaks about, e.g. "height", "thickness". */
    property: z.string().optional(),
    value: finite.optional(),
    tolerance: nonNegative.optional(),
    note: z.string().optional(),
  })
  .strict()
export type Constraint = z.infer<typeof ConstraintSchema>

// ---------------------------------------------------------------------------
// The model
// ---------------------------------------------------------------------------

export const CanonicalBuildingModelSchema = z
  .object({
    schema: z.literal(MODEL_SCHEMA_NAME),
    schemaVersion: z.literal(MODEL_SCHEMA_VERSION),
    id: IdSchema,
    name: z.string(),
    units: UnitsSchema,
    frame: FrameSchema,
    building: BuildingSchema.nullable(),
    levels: z.array(LevelSchema),
    rooms: z.array(RoomSchema),
    walls: z.array(WallSchema),
    wallJunctions: z.array(WallJunctionSchema),
    wallRings: z.array(WallRingSchema),
    openings: z.array(OpeningSchema),
    windows: z.array(WindowSchema),
    doors: z.array(DoorSchema),
    slabs: z.array(SlabSchema),
    roofs: z.array(RoofSchema),
    roofOpenings: z.array(RoofOpeningSchema),
    rooflights: z.array(RooflightSchema),
    balconies: z.array(BalconySchema),
    railings: z.array(RailingSchema),
    chimneys: z.array(ChimneySchema),
    stairs: z.array(StairSchema),
    surfaceRegions: z.array(SurfaceRegionSchema),
    materials: z.array(MaterialSchema),
    constraints: z.array(ConstraintSchema),
    evidenceSources: z.array(EvidenceSourceSchema),
    meta: z
      .object({
        createdWith: z.string(),
        notes: z.array(z.string()),
      })
      .strict(),
  })
  .strict()

export type CanonicalBuildingModel = z.infer<typeof CanonicalBuildingModelSchema>

/** The collections that hold semantic objects, in canonical order. */
export const OBJECT_COLLECTIONS = [
  'levels',
  'rooms',
  'walls',
  'wallJunctions',
  'wallRings',
  'openings',
  'windows',
  'doors',
  'slabs',
  'roofs',
  'roofOpenings',
  'rooflights',
  'balconies',
  'railings',
  'chimneys',
  'stairs',
  'surfaceRegions',
  'materials',
  'constraints',
  'evidenceSources',
] as const

export type ObjectCollection = (typeof OBJECT_COLLECTIONS)[number]

export const SEMANTIC_KINDS = [
  'building',
  'level',
  'room',
  'wall',
  'wallJunction',
  'wallRing',
  'opening',
  'window',
  'door',
  'slab',
  'roof',
  'roofOpening',
  'rooflight',
  'balcony',
  'railing',
  'chimney',
  'stair',
  'surfaceRegion',
  'material',
  'constraint',
  'evidenceSource',
] as const

export type SemanticKind = (typeof SEMANTIC_KINDS)[number]

export const COLLECTION_OF_KIND: Record<Exclude<SemanticKind, 'building'>, ObjectCollection> = {
  level: 'levels',
  room: 'rooms',
  wall: 'walls',
  wallJunction: 'wallJunctions',
  wallRing: 'wallRings',
  opening: 'openings',
  window: 'windows',
  door: 'doors',
  slab: 'slabs',
  roof: 'roofs',
  roofOpening: 'roofOpenings',
  rooflight: 'rooflights',
  balcony: 'balconies',
  railing: 'railings',
  chimney: 'chimneys',
  stair: 'stairs',
  surfaceRegion: 'surfaceRegions',
  material: 'materials',
  constraint: 'constraints',
  evidenceSource: 'evidenceSources',
}

export const KIND_OF_COLLECTION: Record<ObjectCollection, Exclude<SemanticKind, 'building'>> = {
  levels: 'level',
  rooms: 'room',
  walls: 'wall',
  wallJunctions: 'wallJunction',
  wallRings: 'wallRing',
  openings: 'opening',
  windows: 'window',
  doors: 'door',
  slabs: 'slab',
  roofs: 'roof',
  roofOpenings: 'roofOpening',
  rooflights: 'rooflight',
  balconies: 'balcony',
  railings: 'railing',
  chimneys: 'chimney',
  stairs: 'stair',
  surfaceRegions: 'surfaceRegion',
  materials: 'material',
  constraints: 'constraint',
  evidenceSources: 'evidenceSource',
}

export type SemanticObject =
  | Building
  | Level
  | Room
  | Wall
  | WallJunction
  | WallRing
  | Opening
  | Window
  | Door
  | Slab
  | Roof
  | RoofOpening
  | Rooflight
  | Balcony
  | Railing
  | Chimney
  | Stair
  | SurfaceRegion
  | Material
  | Constraint

/** A fresh, empty, valid model. */
export function createEmptyModel(id: string, name: string, createdWith = 'buildapp'): CanonicalBuildingModel {
  return {
    schema: MODEL_SCHEMA_NAME,
    schemaVersion: MODEL_SCHEMA_VERSION,
    id,
    name,
    units: { ...MODEL_UNITS },
    frame: { ...MODEL_FRAME },
    building: null,
    levels: [],
    rooms: [],
    walls: [],
    wallJunctions: [],
    wallRings: [],
    openings: [],
    windows: [],
    doors: [],
    slabs: [],
    roofs: [],
    roofOpenings: [],
    rooflights: [],
    balconies: [],
    railings: [],
    chimneys: [],
    stairs: [],
    surfaceRegions: [],
    materials: [],
    constraints: [],
    evidenceSources: [],
    meta: { createdWith, notes: [] },
  }
}
