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
import { PlanPolygonSchema, PlanRectSchema, Vec2Schema, Vec3Schema, finite, nonNegative, positive } from './geometry-types.js'

export const MODEL_SCHEMA_NAME = 'buildapp.canonical-building-model' as const
export const MODEL_SCHEMA_VERSION = '1.6.0' as const
/** Versions `validateModel` accepts: the current one, and older ones it migrates explicitly (see migrate.ts). */
export const SUPPORTED_SCHEMA_VERSIONS = ['1.0.0', '1.1.0', '1.2.0', '1.3.0', '1.4.0', '1.5.0', '1.6.0'] as const

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
 * FOLLOW_ROOF_PLANES (1.6.0) — at min(`height`, underside of whichever of the
 *   named roof planes covers the point), so a wall under a roof stated as a
 *   plane graph dies into it exactly as FOLLOW_ROOF does under a legacy roof.
 */
export const WallTopProfileSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('FLAT') }).strict(),
  z.object({ kind: z.literal('FOLLOW_ROOF'), roofId: IdSchema }).strict(),
  z.object({ kind: z.literal('FOLLOW_ROOF_PLANES'), planeIds: z.array(IdSchema).min(1) }).strict(),
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
    /**
     * What the door is for, when a source says (1.6.0): the ENTRANCE an
     * entrance assembly is built around, a GARAGE door (a sectional or up-and-over
     * door is also recognised by an assembly of PANELs alone), a TERRACE door, a
     * SERVICE door, an INTERIOR door. Absent: not stated.
     */
    usage: z.enum(['ENTRANCE', 'GARAGE', 'TERRACE', 'SERVICE', 'INTERIOR']).optional(),
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
/** One side of a roof's footprint rectangle. */
export const RoofEdgeSideSchema = z.enum(['MIN_X', 'MAX_X', 'MIN_Z', 'MAX_Z'])
export type RoofEdgeSide = z.infer<typeof RoofEdgeSideSchema>

/**
 * Members compiled WITH the roof, at its edges, so that the roof and its trim
 * are one closed composition rather than a plate with bars laid over it.
 *
 * `verge`: a board along each rake of a gable end, its top flush with the
 * slope, hanging `width` below it (measured vertically), `depth` deep along
 * the ridge axis; the plate stops where the board begins, and a wall under
 * the board follows the board's underside, not the plate's. `fascia`: a
 * board along the named eave or flat-roof edges, its top `topOffset` above
 * the plate top (0 = flush; a parapet-height band is positive), `height`
 * tall, `depth` deep across the edge; the plate stops at its inner face.
 */
export const RoofEdgeMembersSchema = z
  .object({
    verge: z
      .object({
        width: positive,
        depth: positive,
        materialId: IdSchema.optional(),
        /** The gable ends that carry a board, each with its own width and depth; absent = both ends, at `width` × `depth`. */
        ends: z.array(z.object({ side: RoofEdgeSideSchema, width: positive, depth: positive }).strict()).min(1).optional(),
      })
      .strict()
      .optional(),
    fascia: z.object({ sides: z.array(RoofEdgeSideSchema).min(1), topOffset: finite, height: positive, depth: positive, materialId: IdSchema.optional() }).strict().optional(),
  })
  .strict()
export type RoofEdgeMembers = z.infer<typeof RoofEdgeMembersSchema>

/**
 * How far the roof PLATE stops short of the footprint on each side, in
 * metres. The footprint is still what the roof covers (walls under it follow
 * it; its edge members sit on it); the plate is the slab that bears on the
 * walls, and a plate that bears on a wall ends inside that wall — at its
 * centreline, conventionally — rather than in the plane of the wall's outer
 * face, where a viewer would draw the plate's edge and the wall's face in one
 * place.
 */
export const RoofPlateInsetSchema = z
  .object({ minX: nonNegative.optional(), maxX: nonNegative.optional(), minZ: nonNegative.optional(), maxZ: nonNegative.optional() })
  .strict()
export type RoofPlateInset = z.infer<typeof RoofPlateInsetSchema>

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
    edgeMembers: RoofEdgeMembersSchema.optional(),
    plateInset: RoofPlateInsetSchema.optional(),
    materialId: IdSchema.optional(),
  })
  .strict()
export type Roof = z.infer<typeof RoofSchema>

/** ROOFLIGHT and PENETRATION as since 1.2.0; DORMER (1.6.0): the cut a dormer body makes in the roof plane it stands in. */
export const RoofOpeningKindSchema = z.enum(['ROOFLIGHT', 'PENETRATION', 'DORMER'])
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
    /**
     * A non-rectangular hole (1.6.0), in plan: a dormer's footprint on the roof
     * is a pentagon when its own roof dies into the host along two valleys.
     * Only on a roof PLANE (a legacy roof takes rectangles); `footprint` must
     * then be the outline's bounding rectangle.
     */
    outline: PlanPolygonSchema.optional(),
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
    /**
     * What the run is (1.6.0): a GUARD along a drop (a balcony edge, a landing),
     * a HANDRAIL beside steps, a BALUSTRADE (a guard of repeated balusters).
     * Absent: a railing, unclassified.
     */
    role: z.enum(['GUARD', 'HANDRAIL', 'BALUSTRADE']).optional(),
    /**
     * A railing that turns: the vertices of its plan polyline, `start` first
     * and `end` last. One post stands at every vertex, so two runs that meet
     * at a corner are one railing here rather than two railings with two
     * posts in one place.
     */
    path: z.array(Vec2Schema).min(2).optional(),
    materialId: IdSchema.optional(),
  })
  .strict()
export type Railing = z.infer<typeof RailingSchema>

/**
 * A terrace: an exterior floor a building stands beside — the paved platform
 * outside a living-room glazing, the floor of a loggia at ground level.
 * Distinct from a slab (which is the building's own floor plate) and from a
 * balcony (which is carried by the building): it lies on the ground, at or
 * near the finished-floor datum it serves, against the facade it names.
 */
export const TerraceSchema = z
  .object({
    ...base,
    levelId: IdSchema,
    polygon: PlanPolygonSchema,
    /** Top surface above the level's finished floor (0 = flush with the threshold). */
    topOffset: finite,
    /** Down to the terrain or the plinth: what the platform's edge shows. */
    thickness: positive,
    surface: z.enum(['PAVED', 'DECK', 'UNKNOWN']),
    /** PLINTH: the edge is a visible upstand to the terrain; FLUSH: the platform meets the ground. */
    edge: z.enum(['PLINTH', 'FLUSH']),
    /** The exterior walls the terrace lies against. */
    hostWallIds: z.array(IdSchema).optional(),
    materialId: IdSchema.optional(),
  })
  .strict()
export type Terrace = z.infer<typeof TerraceSchema>

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


/**
 * A linear architectural solid: a straight member with a rectangular
 * cross-section, extruded along its own centreline.
 *
 * This is the primitive a `SurfaceRegion` could not be. A region is a finish
 * band painted on a wall face; it has no thickness and it cannot cast a
 * shadow, turn a corner or be seen from the side. Real facades are full of
 * members that do all three — a frame standing proud of the wall, a beam over
 * an opening, a fin, a parapet upstand, a deep reveal — and modelling them as
 * colour is what makes a reconstruction come out flat.
 *
 * It is deliberately generic. Nothing about it names a project, a facade or a
 * style: it is a box swept along a line, which is what every one of those
 * members is.
 *
 * **The cross-section basis.** The member's own axes are derived from its
 * path, so two members with the same numbers are the same shape wherever they
 * are:
 *
 * - `pathDir` = normalize(end − start);
 * - `depthAxis` = normalize(pathDir × up) — for a horizontal member this is
 *   horizontal and perpendicular to the path, which is the direction it stands
 *   proud of a wall. For a vertical member the cross product degenerates and
 *   the axis falls back to world +z;
 * - `widthAxis` = normalize(depthAxis × pathDir) — for a horizontal member this
 *   is world up, which is the dimension you see in elevation.
 *
 * `rollDeg` then rotates both about the path, for a member whose section is not
 * square to the world (a raking gable member, a canted fin).
 *
 * So for a facade beam 0.40 m tall standing 0.30 m out of the wall:
 * `width = 0.40`, `depth = 0.30`.
 */
export const LinearSolidSchema = z
  .object({
    ...base,
    levelId: IdSchema,
    /**
     * The wall, roof or slab the member runs on, when it has one. Purely a
     * statement of relation: the member's geometry is world-space and does not
     * depend on its host, so a host that moves does not drag it.
     */
    hostId: IdSchema.optional(),
    /** The centreline, in world coordinates. */
    start: Vec3Schema,
    end: Vec3Schema,
    /** Across the member, along `widthAxis`: what you see in elevation. */
    width: positive,
    /** Across the member, along `depthAxis`: how far it stands proud. */
    depth: positive,
    /** Rotation of the cross-section about the path, in degrees. */
    rollDeg: finite.optional(),
    /**
     * What the member IS, where the evidence says (1.6.0): a column, a post, a
     * beam, a lintel, a pergola member, a roof edge board. Absent: the
     * unclassified facade member of 1.4.0 — which is what most of them are.
     * The role adds meaning, never geometry: the box is the same box.
     */
    role: z
      .enum(['COLUMN', 'POST', 'BEAM', 'LINTEL', 'RAFTER', 'PERGOLA_POST', 'PERGOLA_BEAM', 'FASCIA', 'VERGE_BOARD', 'FACADE_MEMBER', 'DECORATIVE', 'UNKNOWN_MEMBER'])
      .optional(),
    materialId: IdSchema,
  })
  .strict()
export type LinearSolid = z.infer<typeof LinearSolidSchema>
export type MemberRole = NonNullable<LinearSolid['role']>

/** Roles whose member stands vertically: a column, a post. */
export const VERTICAL_MEMBER_ROLES: readonly MemberRole[] = ['COLUMN', 'POST', 'PERGOLA_POST']
/** Roles whose member lies horizontally: a beam, a lintel, a pergola beam, a fascia board along an eave. */
export const HORIZONTAL_MEMBER_ROLES: readonly MemberRole[] = ['BEAM', 'LINTEL', 'PERGOLA_BEAM', 'FASCIA']
/** Roles that carry load in the sense a viewer groups as "structural members". */
export const STRUCTURAL_MEMBER_ROLES: readonly MemberRole[] = ['COLUMN', 'POST', 'BEAM', 'LINTEL', 'RAFTER', 'PERGOLA_POST', 'PERGOLA_BEAM']

// ---------------------------------------------------------------------------
// Schema 1.6.0 — architectural primitives, assemblies and typed relationships
// ---------------------------------------------------------------------------

/**
 * A roof PLANE: one planar roof surface, the unit a roof is composed of.
 *
 * A roof is not a type. A gable is two planes meeting at a ridge; a hip is
 * four meeting at hips and a ridge; two gables that cross are four planes and
 * two valleys; a dormer is a small roof whose planes die into a host plane.
 * So the model states planes and the edges between them (`RoofEdge`), and a
 * `RoofAssembly` groups them; a label such as GABLE or HIP is a description
 * of the result, never its definition.
 *
 * The plane's top surface is `y = datum.y − tan(pitch) · ((p − datum) · downslope)`
 * over its `boundary` (the plan outline of the top surface, overhang
 * included — the support polygon). The plate is `thickness` deep measured
 * perpendicular to the slope, so its underside lies `thickness / cos(pitch)`
 * below the top surface. Holes are the roof openings hosted on the plane.
 */
export const RoofPlaneSchema = z
  .object({
    ...base,
    levelId: IdSchema,
    boundary: PlanPolygonSchema,
    /** A point on the top surface, world coordinates: the elevation datum the plane is stated from. */
    datum: Vec3Schema,
    /** Pitch of the top surface, degrees; 0 is a flat roof. */
    pitchDeg: z.number().finite().min(0).max(85),
    /** Unit plan vector pointing down the slope (where water runs). Stated even for a flat plane, where it is not used. */
    downslope: Vec2Schema,
    thickness: positive,
    materialId: IdSchema.optional(),
  })
  .strict()
export type RoofPlane = z.infer<typeof RoofPlaneSchema>

/**
 * How two roof planes meet, or how one ends.
 *
 * RIDGE — two planes meet at a level convex crease. HIP — a sloping convex
 * crease. VALLEY — a concave crease (two gables crossing, a dormer roof dying
 * into its host). ROOF_STEP — two planes meet in plan at different heights
 * (a stepped roof); the first plane is the upper one. VERGE — a sloping free
 * edge along which the slope runs (a gable end). EAVE — a level free edge the
 * slope runs down to. ABUTMENT — where a plane meets a wall rising past it.
 * BOUNDARY — any other free edge (a flat roof's edge).
 */
export const RoofEdgeKindSchema = z.enum(['RIDGE', 'HIP', 'VALLEY', 'ROOF_STEP', 'VERGE', 'EAVE', 'ABUTMENT', 'BOUNDARY'])
export type RoofEdgeKind = z.infer<typeof RoofEdgeKindSchema>
/** Edge kinds that join two planes. */
export const ROOF_JOIN_KINDS: readonly RoofEdgeKind[] = ['RIDGE', 'HIP', 'VALLEY', 'ROOF_STEP']

/**
 * One edge of the roof graph, in world coordinates, on the (upper) plane's
 * top surface. It adds no geometry of its own: it states a relation the
 * validator checks against the planes (the endpoints lie on each plane's
 * boundary and surface; a ridge is level and convex, a valley concave, an
 * eave level with the slope running down to it) and the compiler holds (the
 * two plates meet along it with no gap and no shared volume). Edge boards
 * (a fascia, a verge board) are linear solids hosted on the edge.
 */
export const RoofEdgeSchema = z
  .object({
    ...base,
    kind: RoofEdgeKindSchema,
    /** Two planes for RIDGE / HIP / VALLEY / ROOF_STEP (the upper one first for a step); one for the free kinds. */
    planeIds: z.array(IdSchema).min(1).max(2),
    start: Vec3Schema,
    end: Vec3Schema,
  })
  .strict()
export type RoofEdge = z.infer<typeof RoofEdgeSchema>

export const WallPanelProfilePointSchema = z.object({ u: finite, y: finite }).strict()
export type WallPanelProfilePoint = z.infer<typeof WallPanelProfilePointSchema>

/**
 * A wall PANEL: a vertical plate between two polylines, with no junction
 * topology and no openings — the wall a dormer cheek, a parapet run, a gable
 * infill or a knee wall is. Where a wall stands on a level at a flat base, a
 * panel's bottom and top are free: a dormer cheek's bottom follows the host
 * roof slope and its top the dormer roof's underside.
 *
 * `start → end` is the outer-face line in plan, as for a wall (outward normal
 * `up × u`, material behind it); `bottom` and `top` are WORLD heights along
 * the panel's own `u` (0 at `start`, the panel's length at the last point).
 * A panel that needs an opening is a wall.
 */
export const WallPanelSchema = z
  .object({
    ...base,
    levelId: IdSchema,
    role: z.enum(['PARAPET', 'DORMER_CHEEK', 'GABLE_INFILL', 'UPSTAND', 'KNEE_WALL', 'SCREEN', 'UNKNOWN_PANEL']),
    start: Vec2Schema,
    end: Vec2Schema,
    thickness: positive,
    bottom: z.array(WallPanelProfilePointSchema).min(2),
    top: z.array(WallPanelProfilePointSchema).min(2),
    /** What the panel stands on or rises from (a wall, a roof plane, a slab). A statement of relation; its geometry is its own. */
    hostId: IdSchema.optional(),
    materialId: IdSchema.optional(),
  })
  .strict()
export type WallPanel = z.infer<typeof WallPanelSchema>

/**
 * A PLATFORM: a small exterior floor that is not a terrace and not the
 * building's slab — the LANDING in front of an entrance door, a raised
 * PORCH, a RAMP, a PLINTH. Its top is level at `topOffset`, or, for a ramp,
 * falls `gradient` metres per metre along `slope.downhill` from `slope.origin`.
 */
export const PlatformSchema = z
  .object({
    ...base,
    levelId: IdSchema,
    role: z.enum(['LANDING', 'PORCH', 'RAMP', 'PLINTH', 'UNKNOWN_PLATFORM']),
    polygon: PlanPolygonSchema,
    /** Top surface above the level's finished floor (at `slope.origin` for a ramp). */
    topOffset: finite,
    thickness: positive,
    slope: z.object({ origin: Vec2Schema, downhill: Vec2Schema, gradient: z.number().finite().gt(0).lte(0.5) }).strict().optional(),
    /** The exterior walls the platform lies against. */
    hostWallIds: z.array(IdSchema).optional(),
    materialId: IdSchema.optional(),
  })
  .strict()
export type Platform = z.infer<typeof PlatformSchema>

/**
 * An EXTERIOR STEP RUN: `steps` treads, each `going` deep and `rise` above
 * the last, climbing from `baseOffset` (the grade it starts from) along
 * `direction`. `start` is the left-hand end of the first riser line facing up
 * the run; the run is `width` wide to the right. SOLID steps stand on the
 * grade (the usual masonry run: one closed stepped solid); OPEN_TREADS are
 * separate treads `treadThickness` deep.
 *
 * Deliberately NOT a `Stair`: a stair joins two storeys inside a building and
 * owns its risers between two floors; an exterior run joins the ground to a
 * landing or a threshold and is part of an entrance or a garden. Step `k`
 * (1-based) is the primitive `${id}:step-${k}`.
 */
export const StepRunSchema = z
  .object({
    ...base,
    levelId: IdSchema,
    role: z.enum(['ENTRANCE_STEPS', 'GARDEN_STEPS', 'ACCESS_STEPS', 'UNKNOWN_STEPS']),
    start: Vec2Schema,
    /** Unit plan vector of travel, walking up. */
    direction: Vec2Schema,
    width: positive,
    steps: z.number().int().min(1).max(40),
    going: positive,
    rise: positive,
    baseOffset: finite,
    construction: z.enum(['SOLID', 'OPEN_TREADS']),
    treadThickness: positive.optional(),
    materialId: IdSchema.optional(),
  })
  .strict()
export type StepRun = z.infer<typeof StepRunSchema>

/** The kinds of first-class architectural assembly. */
export const AssemblyKindSchema = z.enum(['ROOF', 'DORMER', 'BALCONY', 'TERRACE', 'LOGGIA', 'CANOPY', 'PERGOLA', 'CARPORT', 'ENTRANCE', 'EXTERIOR_STAIR', 'FACADE', 'GARAGE', 'UNKNOWN'])
export type AssemblyKind = z.infer<typeof AssemblyKindSchema>

/**
 * How much of an assembly the model holds. COMPLETE: every component its kind
 * requires is present. PARTIAL: some are, and `missing` names the rest.
 * FRAGMENTARY: little more than where it is — an unknown assembly, a feature
 * seen once.
 */
export const AssemblyQualitySchema = z.enum(['COMPLETE', 'PARTIAL', 'FRAGMENTARY'])
export type AssemblyQuality = z.infer<typeof AssemblyQualitySchema>

/** Another reading of the same evidence, kept instead of being forced away (a dormer or a roof projection; a canopy or a pergola). */
export const AssemblyAlternativeSchema = z
  .object({ kind: AssemblyKindSchema, confidence: z.number().min(0).max(1), why: z.string().min(1) })
  .strict()
export type AssemblyAlternative = z.infer<typeof AssemblyAlternativeSchema>

/** A descriptive label for a roof assembly. It describes the plane graph; it never defines it. */
export const RoofClassificationSchema = z.enum(['GABLE', 'HIP', 'HALF_HIP', 'SHED', 'FLAT', 'MANSARD', 'INTERSECTING', 'STEPPED', 'COMPOSITE', 'UNKNOWN'])
export type RoofClassification = z.infer<typeof RoofClassificationSchema>

/** What one edge of a platform-like assembly meets: a wall, a guard, nothing, steps, an open side. */
export const EdgeConditionSchema = z
  .object({ edgeIndex: z.number().int().min(0), condition: z.enum(['WALL', 'GUARDED', 'FREE', 'STEPS', 'OPEN']), targetId: IdSchema.optional() })
  .strict()
export type EdgeCondition = z.infer<typeof EdgeConditionSchema>

const assemblyBase = {
  ...base,
  /** What the assembly is attached to or stands against: a building's walls, a host roof, a terrace. */
  hostIds: z.array(IdSchema),
  quality: AssemblyQualitySchema,
  /** Components the sources imply and the model does not hold, named: why a partial assembly is partial. */
  missing: z.array(z.string().min(1)).optional(),
  alternatives: z.array(AssemblyAlternativeSchema).optional(),
}
const platformAssembly = {
  ...assemblyBase,
  /** The floor of the assembly: a balcony, a terrace, or a platform. */
  platformId: IdSchema.optional(),
  railingIds: z.array(IdSchema),
  /** What carries it: columns, posts, walls, brackets. */
  supportIds: z.array(IdSchema),
  edgeConditions: z.array(EdgeConditionSchema).optional(),
}
const coverAssembly = {
  ...assemblyBase,
  /** Posts and columns (linear members) or walls the cover stands on. */
  supportIds: z.array(IdSchema),
  /** Beams carrying the cover. */
  beamIds: z.array(IdSchema),
  /** A cover stated as a roof: a roof assembly of roof planes. */
  roofAssemblyId: IdSchema.optional(),
  /** A cover stated as a slab (a concrete canopy plate). */
  slabId: IdSchema.optional(),
  /** The sides of its plan extent with no wall: what makes it a canopy and not a room. */
  openSides: z.array(RoofEdgeSideSchema),
}

/**
 * An ASSEMBLY: a first-class architectural composition that references its
 * primitives by stable id. It owns no geometry and no triangles: the
 * primitives compile, the assembly says what they are together. A partial
 * assembly is valid and says what it lacks; an ambiguous one keeps its
 * alternatives. UNKNOWN is the safe home of source-supported geometry that
 * cannot be classified: it keeps where the thing is and what was seen,
 * without inventing what it is.
 */
export const AssemblySchema = z.discriminatedUnion('kind', [
  z
    .object({
      ...assemblyBase,
      kind: z.literal('ROOF'),
      classification: RoofClassificationSchema,
      planeIds: z.array(IdSchema).min(1),
      edgeIds: z.array(IdSchema),
      openingIds: z.array(IdSchema),
      dormerIds: z.array(IdSchema),
      chimneyIds: z.array(IdSchema),
      /** Edge boards (linear solids) and parapet panels belonging to the roof. */
      trimIds: z.array(IdSchema),
    })
    .strict(),
  z
    .object({
      ...assemblyBase,
      kind: z.literal('DORMER'),
      dormerType: z.enum(['GABLE', 'SHED', 'FLAT', 'UNKNOWN']),
      hostRoofAssemblyId: IdSchema.optional(),
      hostPlaneIds: z.array(IdSchema).min(1),
      /** The dormer body's outline on the host roof, in plan. */
      footprintOnRoof: PlanPolygonSchema,
      /** Its front wall and cheeks (walls and wall panels). */
      wallIds: z.array(IdSchema),
      localRoofAssemblyId: IdSchema.optional(),
      /** The DORMER roof opening cut in the host plane. */
      cutOpeningId: IdSchema.optional(),
      /** Openings in its front wall. */
      openingIds: z.array(IdSchema),
    })
    .strict(),
  z.object({ ...platformAssembly, kind: z.literal('BALCONY') }).strict(),
  z.object({ ...platformAssembly, kind: z.literal('TERRACE') }).strict(),
  z.object({ ...platformAssembly, kind: z.literal('LOGGIA'), recessWallIds: z.array(IdSchema) }).strict(),
  z.object({ ...coverAssembly, kind: z.literal('CANOPY'), usage: z.enum(['ENTRANCE', 'TERRACE_COVER', 'SHELTER', 'UNKNOWN']) }).strict(),
  z.object({ ...coverAssembly, kind: z.literal('CARPORT'), bays: z.number().int().min(1).optional() }).strict(),
  z
    .object({
      ...assemblyBase,
      kind: z.literal('PERGOLA'),
      postIds: z.array(IdSchema),
      primaryBeamIds: z.array(IdSchema),
      secondaryBeamIds: z.array(IdSchema),
      slabOrTerraceId: IdSchema.optional(),
      /** A pergola is open: repeated beams are not a roof. */
      coverage: z.literal('OPEN'),
    })
    .strict(),
  z
    .object({
      ...assemblyBase,
      kind: z.literal('ENTRANCE'),
      doorId: IdSchema.optional(),
      landingId: IdSchema.optional(),
      stepRunIds: z.array(IdSchema),
      canopyId: IdSchema.optional(),
      supportIds: z.array(IdSchema),
      railingIds: z.array(IdSchema),
    })
    .strict(),
  z.object({ ...assemblyBase, kind: z.literal('EXTERIOR_STAIR'), stepRunIds: z.array(IdSchema), landingIds: z.array(IdSchema), railingIds: z.array(IdSchema) }).strict(),
  z
    .object({
      ...assemblyBase,
      kind: z.literal('FACADE'),
      side: z.enum(['FRONT', 'REAR', 'LEFT', 'RIGHT', 'OTHER']),
      wallIds: z.array(IdSchema).min(1),
      openingIds: z.array(IdSchema),
      memberIds: z.array(IdSchema),
      regionIds: z.array(IdSchema),
    })
    .strict(),
  z
    .object({
      ...assemblyBase,
      kind: z.literal('GARAGE'),
      wallIds: z.array(IdSchema),
      doorIds: z.array(IdSchema),
      roofAssemblyId: IdSchema.optional(),
      /** A garage under a legacy roof. */
      roofIds: z.array(IdSchema),
    })
    .strict(),
  z
    .object({
      ...assemblyBase,
      kind: z.literal('UNKNOWN'),
      /** The evidence sources (model.evidenceSources) that show something is there. */
      sourceEvidenceIds: z.array(IdSchema).min(1),
      /** World-space box the thing occupies, as far as it is known. */
      metricExtent: z.object({ min: Vec3Schema, max: Vec3Schema }).strict(),
      approximateTopology: z.enum(['VOLUME', 'PLANAR', 'LINEAR', 'POINT_CLUSTER', 'UNKNOWN']),
      /** What was actually measured: planar patches and segments, world coordinates. */
      observedPlanesOrSegments: z.array(
        z.discriminatedUnion('kind', [
          z.object({ kind: z.literal('PLANE'), outline: z.array(Vec3Schema).min(3) }).strict(),
          z.object({ kind: z.literal('SEGMENT'), start: Vec3Schema, end: Vec3Schema }).strict(),
        ]),
      ),
      unresolvedReason: z.string().min(1),
    })
    .strict(),
])
export type Assembly = z.infer<typeof AssemblySchema>
export type AssemblyOf<K extends AssemblyKind> = Extract<Assembly, { kind: K }>

/**
 * A TYPED RELATIONSHIP between two semantic objects: `from` <kind> `to`.
 * "post-1 SUPPORTED_BY terrace-1", "canopy-1 COVERS landing-1",
 * "railing-1 GUARDS balcony-1", "dormer-roof OVERLAPS_INTENTIONALLY host".
 * Relationships are model data, not a graph database: the validator checks
 * that they name real objects, and the geometry closure audit holds the
 * meeting kinds (a SUPPORTED_BY post must touch what carries it).
 */
export const RelationshipKindSchema = z.enum([
  'HOSTED_BY',
  'SUPPORTED_BY',
  'CONNECTED_TO',
  'CONTINUES_TO',
  'TERMINATES_AT',
  'MEETS',
  'INTERSECTS',
  'OVERLAPS_INTENTIONALLY',
  'COVERS',
  'GUARDS',
  'OPENS_INTO',
  'ATTACHED_TO',
  'ALIGNS_WITH',
  'ABOVE',
  'BELOW',
])
export type RelationshipKind = z.infer<typeof RelationshipKindSchema>
/** Relationship kinds that say two objects physically meet: the closure audit requires them to touch. */
export const MEETING_RELATIONSHIP_KINDS: readonly RelationshipKind[] = ['HOSTED_BY', 'SUPPORTED_BY', 'CONNECTED_TO', 'CONTINUES_TO', 'TERMINATES_AT', 'MEETS', 'ATTACHED_TO']
/** Relationship kinds that allow two objects to share volume on purpose. */
export const OVERLAP_RELATIONSHIP_KINDS: readonly RelationshipKind[] = ['INTERSECTS', 'OVERLAPS_INTENTIONALLY']

export const RelationshipSchema = z
  .object({
    ...base,
    kind: RelationshipKindSchema,
    from: IdSchema,
    to: IdSchema,
    note: z.string().optional(),
  })
  .strict()
export type Relationship = z.infer<typeof RelationshipSchema>

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
    linearSolids: z.array(LinearSolidSchema),
    terraces: z.array(TerraceSchema),
    roofPlanes: z.array(RoofPlaneSchema),
    roofEdges: z.array(RoofEdgeSchema),
    wallPanels: z.array(WallPanelSchema),
    platforms: z.array(PlatformSchema),
    stepRuns: z.array(StepRunSchema),
    assemblies: z.array(AssemblySchema),
    relationships: z.array(RelationshipSchema),
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
  'linearSolids',
  'terraces',
  'roofPlanes',
  'roofEdges',
  'wallPanels',
  'platforms',
  'stepRuns',
  'assemblies',
  'relationships',
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
  'linearSolid',
  'terrace',
  'roofPlane',
  'roofEdge',
  'wallPanel',
  'platform',
  'stepRun',
  'assembly',
  'relationship',
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
  linearSolid: 'linearSolids',
  terrace: 'terraces',
  roofPlane: 'roofPlanes',
  roofEdge: 'roofEdges',
  wallPanel: 'wallPanels',
  platform: 'platforms',
  stepRun: 'stepRuns',
  assembly: 'assemblies',
  relationship: 'relationships',
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
  linearSolids: 'linearSolid',
  terraces: 'terrace',
  roofPlanes: 'roofPlane',
  roofEdges: 'roofEdge',
  wallPanels: 'wallPanel',
  platforms: 'platform',
  stepRuns: 'stepRun',
  assemblies: 'assembly',
  relationships: 'relationship',
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
  | LinearSolid
  | Terrace
  | RoofPlane
  | RoofEdge
  | WallPanel
  | Platform
  | StepRun
  | Assembly
  | Relationship
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
    linearSolids: [],
    terraces: [],
    roofPlanes: [],
    roofEdges: [],
    wallPanels: [],
    platforms: [],
    stepRuns: [],
    assemblies: [],
    relationships: [],
    materials: [],
    constraints: [],
    evidenceSources: [],
    meta: { createdWith, notes: [] },
  }
}
