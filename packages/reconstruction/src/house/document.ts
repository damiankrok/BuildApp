/**
 * v3.54.4 — `house.json`: one versioned document of a house's analysis (schema `buildapp.house-document`).
 *
 * Three layers in one file (Master Plan v3.54.4 §7.1):
 *   1. `source` + `observations` — which pictures were read, and what was seen on them in the pictures' own pixels:
 *      printed dimensions with their literal text and ends, level marks, traced outlines, elevations with the walls,
 *      eaves, ridges, openings and roof features seen on them, with their relations and the readings that compete;
 *   2. `geometry` — the agreed semantic geometry in metres in the model frame (x to the right seen from the front, y up,
 *      z from the front into the building; the finished ground floor at y = 0; the frontmost outer wall face at z = 0):
 *      levels, bodies with their outline polygons and roofs, the exterior outline of every level (whose edges are the
 *      host walls), openings on host walls, dormers, balconies, canopies, chimneys;
 *   3. `verification` — per PARAMETER: where it came from, which function consumed it, what it became in the program
 *      and in the compiled scene, and what was held, refused or left unknown.
 *
 * It is the audit of an analysis and the input of the deterministic builder (`program.ts`), bound to the existing domain
 * by that builder: commands → canonical model → compiler. It is not a second model of the house: nothing renders or
 * measures from this document without building it.
 *
 * A number is never bare. `Num` carries its basis — PRINTED (a value the source prints, converted to metres; the literal
 * stays in the observation it refers to), DERIVED (computed from printed values or measured on a registered drawing),
 * ESTIMATED (read off proportions, not a measurement), DEFAULT (a convention used only so the thing can be drawn),
 * UNKNOWN (`value: null` — never a hidden zero).
 */
import { z } from 'zod'

export const HOUSE_DOCUMENT_SCHEMA = 'buildapp.house-document' as const
export const HOUSE_DOCUMENT_VERSION = '0.6.0' as const

export const BasisSchema = z.enum(['PRINTED', 'DERIVED', 'ESTIMATED', 'DEFAULT', 'UNKNOWN'])
export type Basis = z.infer<typeof BasisSchema>

export const NumSchema = z
  .object({
    value: z.number().finite().nullable(),
    basis: BasisSchema,
    /** Ids of the observations (or of other parameters, as `geometry.…` paths) this value rests on. */
    refs: z.array(z.string()).optional(),
    /** How it was obtained, in a short sentence (a conversion, a derivation, why it is an estimate). */
    how: z.string().optional(),
    /** Half-width of what the source supports, in the value's unit. */
    uncertainty: z.number().finite().nonnegative().optional(),
  })
  .strict()
  .refine((n) => (n.basis === 'UNKNOWN') === (n.value === null), { message: 'UNKNOWN has a null value, and only UNKNOWN has one' })
export type Num = z.infer<typeof NumSchema>

const Vec2 = z.object({ x: z.number().finite(), z: z.number().finite() }).strict()
const Px = z.object({ x: z.number().finite(), y: z.number().finite() }).strict()
const Box = z.object({ x0: z.number().finite(), y0: z.number().finite(), x1: z.number().finite(), y1: z.number().finite() }).strict()
const Id = z.string().min(1).max(80).regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/)
const Origin = z.enum(['API', 'LOCAL', 'MANUAL'])
const SideSchema = z.enum(['FRONT', 'RIGHT', 'REAR', 'LEFT'])
export type HouseSide = z.infer<typeof SideSchema>

// ---------------------------------------------------------------------------------------------------------------------
// 1. sources and observations (pixels of the pictures as sent)
// ---------------------------------------------------------------------------------------------------------------------

const PictureSchema = z
  .object({
    id: Id,
    /** The source package's asset id, when the picture is one of its assets. */
    assetId: z.string().optional(),
    role: z.enum(['PLAN', 'SECTION', 'ELEVATION', 'RENDER', 'SITE_PLAN', 'OTHER']),
    /** For a plan: the storey it draws (0 = ground). */
    level: z.number().int().optional(),
    widthPx: z.number().positive(),
    heightPx: z.number().positive(),
    /** sha256 of the bytes the reader was sent, and how they relate to the original (a reduction factor; 1 = as published). */
    sha256: z.string().optional(),
    reduction: z.number().positive().optional(),
    thisHouse: z.boolean().default(true),
    note: z.string().optional(),
    /** v0.2: sha256 of the published bytes, how the reader was sent it, and the side its page caption names. */
    byteHash: z.string().optional(),
    sent: z.enum(['DETAIL', 'CONTEXT', 'THUMB_ONLY', 'NOT_SENT']).optional(),
    notSentWhy: z.string().optional(),
    captionSide: z.enum(['FRONT', 'RIGHT', 'REAR', 'LEFT']).optional(),
  })
  .strict()

const DimensionObservation = z
  .object({
    id: Id,
    picture: Id,
    literal: z.string().min(1),
    unit: z.enum(['cm', 'm', 'mm', 'ft-in', 'unknown']),
    /** The literal converted to metres by the program's own parser, never by the reader. */
    valueM: z.number().positive().nullable(),
    from: Px,
    to: Px,
    /** What the line measures: the whole walled outline on that axis, one body, or a part. */
    measures: z.enum(['OVERALL', 'BODY', 'PART', 'UNSURE']),
    /** What its ends stand on, in words: "outer wall faces, garage included; the open porch excluded". */
    includes: z.string().optional(),
    bodyId: Id.optional(),
    origin: Origin,
  })
  .strict()

const LevelObservation = z
  .object({
    id: Id,
    picture: Id,
    literal: z.string().min(1),
    valueM: z.number().finite().nullable(),
    meaning: z.enum(['GROUND_FLOOR', 'UPPER_FLOOR', 'RIDGE', 'EAVES', 'TERRAIN', 'FLOOR_BELOW_ZERO', 'TOTAL_HEIGHT', 'CLEAR_HEIGHT', 'KNEE_WALL', 'ROOF_PITCH_DEG', 'OTHER']),
    bodyId: Id.optional(),
    level: z.number().int().optional(),
    at: Px.optional(),
    origin: Origin,
  })
  .strict()

const OutlineObservation = z
  .object({
    id: Id,
    picture: Id,
    level: z.number().int(),
    /** WHOLE: the walled outline of the whole storey (outer wall faces). BODY: one body of it. OPEN: a roofed open zone. */
    what: z.enum(['WHOLE', 'BODY', 'OPEN']),
    bodyId: Id.optional(),
    role: z.enum(['MAIN', 'WING', 'GARAGE', 'BAY', 'PORCH', 'OTHER']).optional(),
    /** For a BODY: every level it has a storey on (0 = ground), as the plans and elevations show. */
    storeys: z.array(z.number().int()).optional(),
    polygon: z.array(Px).min(3),
    origin: Origin,
    note: z.string().optional(),
  })
  .strict()

const ElevationBody = z
  .object({
    bodyId: Id,
    /** The ends of this body's wall as the picture shows it, and where its eaves and its ridge are. */
    leftX: z.number().finite(),
    rightX: z.number().finite(),
    eavesY: z.number().finite().nullable(),
    ridgeY: z.number().finite().nullable(),
    /** What stands in front: 0 = nearest the viewer. */
    depthOrder: z.number().int().optional(),
  })
  .strict()

const ElevationOpening = z
  .object({
    id: Id,
    kind: z.enum(['WINDOW', 'DOOR', 'GLAZED_DOOR', 'GARAGE_DOOR', 'ROOF_WINDOW']),
    box: Box,
    bodyId: Id.optional(),
    /** The storey its sill stands in (0 = ground), or the dormer it is in. */
    level: z.number().int().optional(),
    inFeature: Id.optional(),
    certainty: z.enum(['CERTAIN', 'LIKELY', 'UNSURE']).default('LIKELY'),
    /** v0.3: a head that is not level: the rows of its top edge at its left and right sides; a pointed one, the column of its apex (its row is box.y0). */
    headLeftY: z.number().finite().optional(),
    headRightY: z.number().finite().optional(),
    apexX: z.number().finite().optional(),
    /** v0.6: what its box traces — the frame (the opening in the wall), only the glass, or only the part EXPOSED above something in front of it. Absent: not said (a reading before v0.6). */
    contour: z.enum(['FRAME', 'GLASS', 'EXPOSED', 'UNSURE']).optional(),
    /** v0.6: the row below which something in front (a railing) hides it, and what. */
    hiddenBelowY: z.number().finite().optional(),
    hiddenBy: Id.optional(),
    /** v0.6: the columns of the vertical profiles between panes, the rows of horizontal ones, and how many panes of a glazed door open. */
    mullionsX: z.array(z.number().finite()).optional(),
    transomsY: z.array(z.number().finite()).optional(),
    doorLeaves: z.number().int().min(0).optional(),
  })
  .strict()

/** v0.6 — a finish zone of a wall read on an elevation: colour and material as a surface, never a body or a wall. */
const ElevationZone = z
  .object({ id: Id, material: z.enum(['PLASTER', 'BOARD_CLADDING', 'WOOD', 'STONE', 'BRICK', 'METAL', 'CONCRETE', 'OTHER']), tone: z.enum(['LIGHT', 'MID', 'DARK', 'WARM', 'UNKNOWN']), box: Box, bodyId: Id.optional(), certainty: z.enum(['CERTAIN', 'LIKELY', 'UNSURE']), note: z.string().optional() })
  .strict()

/** v0.6 — a printed callout of an exterior opening on a floor plan ("234/303"): literal as printed, where, and the program's reading of it. */
const LabelObservation = z
  .object({ id: Id, picture: Id, level: z.number().int(), literal: z.string(), at: Px, wall: z.enum(['FRONT', 'REAR', 'LEFT', 'RIGHT', 'UNSURE']), kind: z.string(), widthM: z.number().positive().nullable(), heightM: z.number().positive().nullable(), origin: Origin })
  .strict()

/** v0.6 — one floor plan's interior as read (pixels of that plan picture, oriented as printed), for the resolver to register and place. */
const StoreyObservation = z
  .object({
    id: Id,
    picture: Id,
    level: z.number().int(),
    frontEdge: z.enum(['BOTTOM', 'TOP', 'LEFT', 'RIGHT']),
    outline: z.array(Px).min(3),
    partitions: z.array(z.object({ id: Id, a: Px, b: Px, thicknessPx: z.number().positive().optional() }).strict()).default([]),
    doors: z.array(z.object({ id: Id, at: Px, widthPx: z.number().positive().optional() }).strict()).default([]),
    rooms: z.array(z.object({ id: Id, polygon: z.array(Px).min(3), name: z.string(), number: z.string().optional(), areaLiteral: z.string().optional(), open: z.boolean().default(false) }).strict()).default([]),
    stairs: z.array(z.array(Px).min(3)).default([]),
    voids: z.array(z.array(Px).min(3)).default([]),
    origin: Origin,
  })
  .strict()

const ElevationFeature = z
  .object({
    id: Id,
    kind: z.enum(['WALL_DORMER_GABLE', 'ROOF_DORMER_GABLE', 'ROOF_DORMER_SHED', 'CROSS_GABLE', 'CANOPY', 'BALCONY', 'LOGGIA', 'GABLE_FRAME', 'PORTAL_BAND', 'CHIMNEY', 'BAY', 'OTHER']),
    box: Box,
    bodyId: Id.optional(),
    /** For a dormer: the row where its own roof begins (its eaves), and its apex. */
    eavesY: z.number().finite().nullable().optional(),
    apexY: z.number().finite().nullable().optional(),
    /** v0.3, GABLE_FRAME: the band's thickness along the rakes (vertical, px), each leg's width (px), the row its legs end at. */
    bandPx: z.number().finite().positive().optional(),
    legPx: z.number().finite().positive().optional(),
    legBottomY: z.number().finite().optional(),
    /** v0.3, BALCONY / LOGGIA / CANOPY: whether the picture shows posts under it. */
    posts: z.boolean().optional(),
    /** v0.4, GABLE_FRAME: the row each leg ends at, separately (a leg may stand on the ground, the other on a slab or a lower roof). */
    legLeftBottomY: z.number().finite().optional(),
    legRightBottomY: z.number().finite().optional(),
    /** v0.4, BALCONY / LOGGIA: the infill of its railing as drawn, the row of the railing's top, and where the kind came from (READ: a field of the answer; NOTE: recognised in the answer's note text, by `railingNote`). */
    railing: z.enum(['GLASS', 'BARS', 'SOLID', 'NONE']).optional(),
    railingFrom: z.enum(['READ', 'NOTE']).optional(),
    railingNote: z.string().optional(),
    railingTopY: z.number().finite().optional(),
    note: z.string().optional(),
    certainty: z.enum(['CERTAIN', 'LIKELY', 'UNSURE']).default('LIKELY'),
  })
  .strict()

const ElevationObservation = z
  .object({
    id: Id,
    picture: Id,
    /** The side of the house it shows, named by the PLAN: FRONT is the plan's front edge. */
    side: SideSchema,
    sideHow: z.string(),
    alternatives: z.array(SideSchema).default([]),
    /** True when the picture shows the house mirrored against the plan (another variant). */
    mirrored: z.boolean().default(false),
    projection: z.enum(['ORTHOGRAPHIC', 'PERSPECTIVE', 'UNSURE']).default('ORTHOGRAPHIC'),
    /** The row of the terrain line, and of the finished ground floor when it can be told apart. */
    groundY: z.number().finite(),
    bodies: z.array(ElevationBody),
    openings: z.array(ElevationOpening).default([]),
    features: z.array(ElevationFeature).default([]),
    /** v0.6: finish zones of its walls. */
    zones: z.array(ElevationZone).default([]),
    origin: Origin,
    /** v0.2. The row of the finished ground floor, when the reader could tell it from the terrain line. */
    floorY: z.number().finite().optional(),
    /** v0.2. `blind`: the reader SAID this side shows no window or door (an empty list alone says nothing). */
    blind: z.boolean().optional(),
    /** What limited the reading of this picture, as the reader stated it. */
    limits: z.enum(['NONE', 'PARTLY_HIDDEN', 'TOO_SMALL']).optional(),
    /** The request that described it: `FACADES` (the first reading) or `FACADES-<n>` (a targeted follow-up). */
    readIn: z.string().optional(),
  })
  .strict()

const RoofObservation = z
  .object({
    id: Id,
    bodyId: Id,
    kind: z.enum(['GABLE', 'HIP', 'SHED', 'FLAT', 'OTHER', 'UNSURE']),
    /** ALONG_FRONT: the ridge runs parallel to the front facade (the model's x). */
    ridge: z.enum(['ALONG_FRONT', 'FRONT_TO_BACK', 'NA', 'UNSURE']),
    pictures: z.array(Id).default([]),
    note: z.string().optional(),
    origin: Origin,
  })
  .strict()

const Conflict = z.object({ id: Id, about: z.string(), readings: z.array(z.string()).min(2), status: z.enum(['OPEN', 'SETTLED']), settledBy: z.string().optional() }).strict()

const ObservationsSchema = z
  .object({
    /** The plan edge the front facade is on, and how that is known. */
    front: z.object({ planEdge: z.enum(['BOTTOM', 'TOP', 'LEFT', 'RIGHT']), how: z.string(), origin: Origin }).strict().optional(),
    dimensions: z.array(DimensionObservation).default([]),
    levels: z.array(LevelObservation).default([]),
    outlines: z.array(OutlineObservation).default([]),
    elevations: z.array(ElevationObservation).default([]),
    roofs: z.array(RoofObservation).default([]),
    /** Published page facts used (key, value, unit), as the source package states them. */
    published: z.array(z.object({ key: z.string(), value: z.number(), unit: z.string(), raw: z.string().optional() }).strict()).default([]),
    relations: z.array(z.object({ kind: z.string(), a: z.string(), b: z.string(), note: z.string().optional() }).strict()).default([]),
    conflicts: z.array(Conflict).default([]),
    unknowns: z.array(z.string()).default([]),
    /** v0.6: printed callouts of exterior openings on the floor plans. */
    labels: z.array(LabelObservation).default([]),
    /** v0.6: each floor plan's interior as read. */
    storeys: z.array(StoreyObservation).default([]),
  })
  .strict()

// ---------------------------------------------------------------------------------------------------------------------
// 2. agreed geometry (metres, model frame)
// ---------------------------------------------------------------------------------------------------------------------

const RoofSchema = z
  .object({
    kind: z.enum(['GABLE', 'HIP', 'SHED', 'FLAT']),
    /** GABLE / HIP: the axis the ridge runs along. */
    ridgeAxis: z.enum(['X', 'Z']).optional(),
    /** Where the ridge stands on the other axis (model metres); absent = the middle of the body. */
    ridgeAt: NumSchema.optional(),
    /** SHED: the side the roof is high on. */
    highSide: SideSchema.optional(),
    pitchDeg: NumSchema,
    /** The top of the roof at its ridge (GABLE, HIP), at its high edge (SHED), or its top surface (FLAT), above ±0.00. */
    ridgeY: NumSchema,
    overhangM: NumSchema,
    thicknessM: NumSchema.optional(),
  })
  .strict()
export type HouseRoof = z.infer<typeof RoofSchema>

const BodySchema = z
  .object({
    id: Id,
    role: z.enum(['MAIN', 'WING', 'GARAGE', 'BAY', 'OTHER']),
    name: z.string().optional(),
    /** The levels (by index) this body has a storey on. */
    storeys: z.array(z.number().int()).min(1),
    /** Its outline: outer wall faces, counter-clockwise on a plan drawn with the front at the bottom. */
    outline: z.array(Vec2).min(3),
    outlineBasis: BasisSchema,
    refs: z.array(z.string()).default([]),
    roof: RoofSchema,
  })
  .strict()
export type HouseBody = z.infer<typeof BodySchema>

const OpeningSchema = z
  .object({
    id: Id,
    kind: z.enum(['WINDOW', 'DOOR', 'GLAZED_DOOR', 'GARAGE_DOOR']),
    level: z.number().int(),
    /** The exterior wall it is cut in: `wall-<level>-<edge index>` of that level's outline. */
    hostWall: Id,
    /** From the host wall's start (the outline's vertex of that index) along its outer face. */
    offsetM: NumSchema,
    widthM: NumSchema,
    heightM: NumSchema,
    /** Above the finished floor of its level. */
    sillM: NumSchema,
    panes: z.number().int().min(1).optional(),
    /** v0.3: a head that is not level. RAKED: the height above the sill at the far end (offset + width); `heightM` is the near end. POINTED: both sides at `heightM`, rising to `apexM` above the sill at `apexAtM` from the start. */
    head: z.discriminatedUnion('kind', [z.object({ kind: z.literal('RAKED'), heightFarM: NumSchema }).strict(), z.object({ kind: z.literal('POINTED'), apexAtM: NumSchema, apexM: NumSchema }).strict()]).optional(),
    /** v0.6: the frame as the elevation shows it, kept beside a rough opening a printed callout gives (two definitions, two constraints). */
    frame: z.object({ offsetM: z.number(), widthM: z.number(), contour: z.string() }).strict().optional(),
    /** v0.6: the printed callout this opening is bound to, and what it set. */
    label: z.object({ id: Id, literal: z.string(), sets: z.array(z.string()), how: z.string() }).strict().optional(),
    /** v0.6: the divisions of its glazing as read (fractions of its width from its start), or a convention said as one. */
    divisions: z.object({ mullions: z.array(z.number()), transoms: z.number().int().min(0).default(0), doorLeaves: z.number().int().min(0).optional(), basis: z.enum(['READ', 'DEFAULT']), how: z.string() }).strict().optional(),
    refs: z.array(z.string()).default([]),
  })
  .strict()
export type HouseOpening = z.infer<typeof OpeningSchema>

const DormerSchema = z
  .object({
    id: Id,
    bodyId: Id,
    /** WALL_GABLE: its front IS the facade wall, risen through the eaves, under a small gable of its own. ROOF_*: set on the slope. */
    kind: z.enum(['WALL_GABLE', 'ROOF_GABLE', 'ROOF_SHED']),
    /** The eaves wall under it (an edge of the body's top level). */
    hostWall: Id,
    fromM: NumSchema,
    toM: NumSchema,
    /** Where its own roof begins, and its apex (top surfaces), above ±0.00. */
    eaveY: NumSchema,
    ridgeY: NumSchema,
    refs: z.array(z.string()).default([]),
  })
  .strict()
export type HouseDormer = z.infer<typeof DormerSchema>

/** v0.4 — a typed value that is not a number: its value (null = not known), where it came from, how. */
const KindValueSchema = <T extends [string, ...string[]]>(values: T) => z.object({ value: z.enum(values).nullable(), basis: z.enum(['READ', 'NOTE', 'DEFAULT', 'UNKNOWN']), how: z.string().optional(), refs: z.array(z.string()).optional() }).strict()
const BalconySchema = z
  .object({
    id: Id,
    level: z.number().int(),
    rect: z.object({ x0: z.number(), z0: z.number(), x1: z.number(), z1: z.number() }).strict(),
    topY: NumSchema,
    thicknessM: NumSchema,
    railing: z.boolean().default(true),
    /** v0.4: the railing's infill as the source shows it (null: not known — the builder then draws its convention and says so). */
    railingInfill: KindValueSchema(['GLASS', 'BARS', 'SOLID', 'NONE']).optional(),
    /** v0.4: the railing's height above the slab, read or conventional (basis DEFAULT). */
    railingHeightM: NumSchema.optional(),
    /** Posts it stands on (a balcony over a portico): plan points, from the terrain to its underside. */
    posts: z.array(Vec2).default([]),
    basis: BasisSchema,
    refs: z.array(z.string()).default([]),
  })
  .strict()
const CanopySchema = z
  .object({ id: Id, kind: z.enum(['ENTRANCE_CANOPY', 'PORCH_ROOF', 'PORTICO', 'CARPORT', 'COVERED_TERRACE']), rect: z.object({ x0: z.number(), z0: z.number(), x1: z.number(), z1: z.number() }).strict(), undersideY: NumSchema, thicknessM: NumSchema, posts: z.array(Vec2).default([]), basis: BasisSchema, refs: z.array(z.string()).default([]) })
  .strict()
/** v0.3 — a gable frame: the band along both rakes of a body's gable end on one side, and its legs (the returns, on the plan). */
const FrameSchema = z
  .object({
    id: Id,
    bodyId: Id,
    side: SideSchema,
    /** The band's thickness measured vertically, and across the rake (its width seen square to the slope). */
    bandM: NumSchema,
    /** How far the band stands back from the gable's outer plane into the roof (along the ridge). */
    depthM: NumSchema,
    /** The legs' width as the elevation shows them, when it shows legs; the plan's returns build them. */
    legM: NumSchema.optional(),
    /** v0.4: the band as read — its vertical thickness in pixels, the elevation's scale and the pitch it was turned across the rake by. */
    bandPx: z.number().finite().positive().optional(),
    bandMPerPx: z.number().finite().positive().optional(),
    /** v0.4: the height above ±0,00 each leg ends at, left and right as a viewer outside sees the side (null: not known). */
    legLeftBottomY: NumSchema.optional(),
    legRightBottomY: NumSchema.optional(),
    basis: BasisSchema,
    refs: z.array(z.string()).default([]),
  })
  .strict()
export type HouseFrame = z.infer<typeof FrameSchema>
/**
 * v0.4 — a portal band: the head of an open front (an entrance under a slab, a garage door under a flat roof) as the
 * elevation draws it, one continuous band from `start` to `end` along the side's outer plane, from its soffit to its top,
 * standing `depthM` back from the outer plane (over a recess: to its back wall).
 */
const PortalSchema = z
  .object({ id: Id, side: SideSchema, start: Vec2, end: Vec2, topY: NumSchema, soffitY: NumSchema, depthM: NumSchema, basis: BasisSchema, refs: z.array(z.string()).default([]) })
  .strict()
export type HousePortal = z.infer<typeof PortalSchema>
const ChimneySchema = z.object({ id: Id, rect: z.object({ x0: z.number(), z0: z.number(), x1: z.number(), z1: z.number() }).strict(), topY: NumSchema, basis: BasisSchema, refs: z.array(z.string()).default([]) }).strict()

/** A window lying in a roof slope: its plan rectangle on that slope. */
const RooflightSchema = z.object({ id: Id, bodyId: Id, rect: z.object({ x0: z.number(), z0: z.number(), x1: z.number(), z1: z.number() }).strict(), basis: BasisSchema, refs: z.array(z.string()).default([]) }).strict()

// ---------------------------------------------------------------------------------------------------------------------
// v3.54.9 — the interior: its source (in that source's own frame) and the agreed interior (in the house's frame)
// ---------------------------------------------------------------------------------------------------------------------

const StairSegmentLike = z.union([
  z.object({ kind: z.literal('FLIGHT'), risers: z.number().int().min(1), going: z.number().positive() }).strict(),
  z.object({ kind: z.literal('WINDER'), risers: z.number().int().min(1), turn: z.enum(['LEFT', 'RIGHT']), angleDeg: z.union([z.literal(90), z.literal(180)]) }).strict(),
  z.object({ kind: z.literal('LANDING'), length: z.number().positive(), turn: z.enum(['NONE', 'LEFT', 'RIGHT']), onRiser: z.literal(true).optional() }).strict(),
])
const InteriorWall = z.object({ id: Id, a: Vec2, b: Vec2, thickness: z.number().positive() }).strict()
const InteriorDoor = z.object({ id: Id, wallId: Id, offset: z.number().min(0), width: z.number().positive(), height: z.number().positive() }).strict()
const InteriorRoom = z.object({ id: Id, polygon: z.array(Vec2).min(3), holes: z.array(z.array(Vec2).min(3)).optional(), usage: z.string().optional() }).strict()
const InteriorStair = z
  .object({ id: Id, toLevel: z.number().int(), start: Vec2, direction: z.enum(['PLUS_X', 'MINUS_X', 'PLUS_Z', 'MINUS_Z']), width: z.number().positive(), waist: z.number().positive().optional(), footprint: z.object({ minX: z.number(), maxX: z.number(), minZ: z.number(), maxZ: z.number() }).strict().optional(), segments: z.array(StairSegmentLike).min(1) })
  .strict()

/**
 * Where an interior comes from, in that source's own frame: a model built from the same pages (LOCAL), named by its hash.
 * It is a source, not the house: the resolver places it in the house only through a verified transform.
 */
export const InteriorSourceSchema = z
  .object({
    origin: z.enum(['LOCAL', 'PLAN']),
    modelHash: z.string(),
    /** The source's outer extent (its exterior walls, outer faces) and its ground footprint, to register it against the house. */
    extent: z.object({ x0: z.number(), x1: z.number(), z0: z.number(), z1: z.number() }).strict(),
    footprint: z.array(z.array(Vec2).min(3)).min(1),
    /** The source's exterior wall thickness (its partitions meet the inner faces of these). */
    exteriorThicknessM: z.number().positive(),
    /** The centres of the openings in its exterior walls, per level: a second, independent check of which way it lies. */
    exteriorOpenings: z.array(z.object({ level: z.number().int(), at: Vec2, door: z.boolean().optional() }).strict()).default([]),
    levels: z.array(
      z
        .object({
          index: z.number().int(),
          elevation: z.number(),
          walls: z.array(InteriorWall).default([]),
          doors: z.array(InteriorDoor).default([]),
          rooms: z.array(InteriorRoom).default([]),
          stairs: z.array(InteriorStair.extend({ toLevel: z.number().int() })).default([]),
          /** Openings in this level's floor (a stair well, a void over a double-height room). */
          voids: z.array(z.array(Vec2).min(3)).default([]),
        })
        .strict(),
    ),
  })
  .strict()
export type HouseInteriorSource = z.infer<typeof InteriorSourceSchema>

const InteriorLevel = z
  .object({
    level: z.number().int(),
    walls: z.array(InteriorWall.extend({ how: z.string().optional() })).default([]),
    doors: z.array(InteriorDoor).default([]),
    rooms: z.array(InteriorRoom).default([]),
    stairs: z.array(InteriorStair).default([]),
    voids: z.array(z.array(Vec2).min(3)).default([]),
    /** What of the source's level was not placed, and why (outside the outline, a door that no longer fits its wall …). */
    dropped: z.array(z.object({ id: z.string(), kind: z.string(), why: z.string() }).strict()).default([]),
    /** v0.6: where this level's elements come from: LOCAL (an import through a checked transform), PLAN (read from this storey's plan), or both merged. */
    origin: z.enum(['LOCAL', 'PLAN', 'LOCAL+PLAN']).optional(),
  })
  .strict()
const InteriorSchema = z
  .object({
    /** NOT_BUILT: no interior source or none placed. BUILT / PARTIAL: placed through a verified transform. */
    status: z.enum(['NOT_BUILT', 'NOT_CHECKED', 'BUILT', 'PARTIAL']),
    note: z.string().optional(),
    source: z.object({ origin: z.string(), modelHash: z.string() }).strict().optional(),
    transform: z
      .object({ mirrorX: z.boolean(), mirrorZ: z.boolean(), scale: z.number().positive(), dx: z.number(), dz: z.number(), axisRatio: z.number(), overlap: z.number(), levels: z.array(z.object({ source: z.number().int(), house: z.number().int(), elevationGapM: z.number() }).strict()), how: z.string() })
      .strict()
      .optional(),
    levels: z.array(InteriorLevel).default([]),
    /** v0.6: what the plan readings gave per storey (placed or not, and why), beside the LOCAL import. */
    read: z.array(z.object({ level: z.number().int(), status: z.enum(['PLACED', 'NOT_PLACED', 'NOT_READ']), how: z.string(), added: z.object({ walls: z.number().int(), doors: z.number().int(), rooms: z.number().int(), voids: z.number().int() }).strict().optional() }).strict()).optional(),
  })
  .strict()
export type HouseInterior = z.infer<typeof InteriorSchema>

/** v0.6 — a finish zone agreed on a wall: host wall, along its outer face from its start, heights above its level's floor. */
const ZoneSchema = z
  .object({ id: Id, side: SideSchema, hostWall: Id, level: z.number().int(), a0: z.number(), a1: z.number(), b0: z.number(), b1: z.number(), material: z.string(), tone: z.string(), basis: BasisSchema, refs: z.array(z.string()).default([]) })
  .strict()

const GeometrySchema = z
  .object({
    frame: z.object({ units: z.literal('m'), up: z.literal('Y'), plan: z.literal('XZ'), origin: z.string(), front: z.string() }).strict(),
    wallThicknessM: NumSchema,
    slabThicknessM: NumSchema,
    terrainY: NumSchema,
    levels: z.array(z.object({ id: Id, index: z.number().int(), elevation: NumSchema, height: NumSchema }).strict()).min(1),
    bodies: z.array(BodySchema).min(1),
    /** The exterior outline of each level (the union of the bodies that have a storey there): its edges are the host walls. */
    outlines: z.array(z.object({ level: z.number().int(), polygon: z.array(Vec2).min(3) }).strict()).min(1),
    openings: z.array(OpeningSchema).default([]),
    dormers: z.array(DormerSchema).default([]),
    balconies: z.array(BalconySchema).default([]),
    canopies: z.array(CanopySchema).default([]),
    chimneys: z.array(ChimneySchema).default([]),
    rooflights: z.array(RooflightSchema).default([]),
    frames: z.array(FrameSchema).default([]),
    portals: z.array(PortalSchema).default([]),
    /** What exists and is NOT part of this document's check: the interior is kept as the builder finds it, never certified here. */
    interior: InteriorSchema.default({ status: 'NOT_BUILT', levels: [] }),
    /** v0.6: finish zones of the walls (presentation: never a body, a wall or a room). */
    zones: z.array(ZoneSchema).default([]),
  })
  .strict()
export type HouseGeometry = z.infer<typeof GeometrySchema>

// ---------------------------------------------------------------------------------------------------------------------
// 3. verification and state of use
// ---------------------------------------------------------------------------------------------------------------------

export const TRACE_CODES = ['NOT_SENT', 'WRONG_READ', 'WRONG_BINDING', 'PARSE_REJECTED', 'CAPABILITY_MISSING', 'NOT_CONSUMED', 'OVERRIDDEN', 'STALE_DEPENDENCY', 'REPRESENTATION_LIMIT', 'COMPILE_CONFLICT', 'SOURCE_UNKNOWN', 'HELD_BY_DEPENDENCY', 'CONFLICT_OPEN'] as const

const ParameterRecord = z
  .object({
    /** `geometry.bodies[garage].roof.ridgeY`, `geometry.openings[o3].offsetM`, … */
    path: z.string(),
    state: z.enum(['ACCEPTED', 'REJECTED', 'PENDING', 'HELD']),
    code: z.enum(TRACE_CODES).optional(),
    why: z.string().optional(),
    /** The function that consumed it, the program objects it became, and what the compiled scene measures for it. */
    consumer: z.string().optional(),
    programIds: z.array(z.string()).default([]),
    meshIds: z.array(z.string()).default([]),
    built: z.number().finite().nullable().optional(),
    /** v0.2. How the built value relates to the agreed one: EXACT; ADJUSTED within the reading's uncertainty; APPROXIMATED beyond it (said). */
    fit: z.enum(['EXACT', 'ADJUSTED', 'APPROXIMATED']).optional(),
    /** built − agreed, when they differ. */
    delta: z.number().finite().optional(),
  })
  .strict()

// v0.2 — the register of views: every side of the house from the source picture to the built wall.
const FourNums = z.object({ offsetM: z.number().finite(), widthM: z.number().finite(), heightM: z.number().finite(), sillM: z.number().finite() }).strict()
export const VIEW_STATES = ['NO_SOURCE', 'NOT_SENT', 'SENT_NOT_ANSWERED', 'PARTIAL', 'READ_COMPLETE', 'UNREADABLE', 'ASSIGNMENT_UNRESOLVED'] as const
const ViewRecord = z
  .object({
    side: SideSchema,
    /** What happened to this side's source. READ_COMPLETE says the picture was described; it does not say it was built. */
    state: z.enum(VIEW_STATES),
    why: z.string().optional(),
    picture: Id.optional(),
    elevation: Id.optional(),
    /** Other pictures that claimed this side and were not used for it. */
    alsoClaimedBy: z.array(Id).default([]),
    registered: z.boolean().default(false),
    /** picture pixel → metres along the side and above ±0,00; the residual at the wall ends it was fitted on and the anchor it was checked on. */
    transform: z.object({ mPerPx: z.number().finite(), alongAtPx0: z.number().finite(), groundRowPx: z.number().finite(), /** The row taken as ±0,00 and what it was taken from (door thresholds, the printed ridge, or the ground line and the terrain). */ zeroRowPx: z.number().finite().optional(), zeroHow: z.string().optional(), mirrored: z.boolean(), wallEnds: z.number().int(), residualM: z.number().finite(), checkAnchor: z.string() }).strict().optional(),
    /** The exterior walls of the outline that face this side (host wall ids), and the bodies named on the picture. */
    walls: z.array(z.string()).default([]),
    bodies: z.array(z.string()).default([]),
    read: z.object({ openings: z.number().int(), features: z.number().int(), blindStated: z.boolean() }).strict().default({ openings: 0, features: 0, blindStated: false }),
    agreed: z.object({ openings: z.number().int(), features: z.number().int() }).strict().default({ openings: 0, features: 0 }),
    built: z.object({ openings: z.number().int(), features: z.number().int() }).strict().default({ openings: 0, features: 0 }),
    notBuilt: z.array(z.string()).default([]),
    build: z.enum(['BUILT_COMPLETE', 'BUILT_PARTIAL', 'NOT_BUILT', 'NOTHING_TO_BUILD', 'NOT_ASSESSED']).default('NOT_ASSESSED'),
  })
  .strict()
export type HouseViewRecord = z.infer<typeof ViewRecord>

/** v0.2 — one agreed wall opening from its reading to the hole measured in the compiled scene. */
const OpeningRecord = z
  .object({
    id: Id,
    ref: z.string().optional(),
    side: SideSchema.optional(),
    hostWall: z.string(),
    level: z.number().int(),
    kind: z.string(),
    agreed: FourNums,
    /** What the program cut (its own numbers), and what the compiled scene measures of the hole. Null: not built. */
    built: FourNums.nullable(),
    cut: z.object({ widthM: z.number().finite(), heightM: z.number().finite(), bottomY: z.number().finite(), alongSideM: z.number().finite().nullable() }).strict().nullable(),
    fit: z.enum(['EXACT', 'ADJUSTED', 'APPROXIMATED', 'NOT_BUILT']),
    why: z.string().optional(),
  })
  .strict()
export type HouseOpeningRecord = z.infer<typeof OpeningRecord>

const CheckRecord = z.object({ id: Id, what: z.string(), expected: z.string(), measured: z.string(), status: z.enum(['PASS', 'FAIL', 'NOT_CHECKED', 'UNKNOWN']), scope: z.enum(['IDENTITY', 'ORIENTATION', 'METRIC', 'BODIES', 'LEVELS', 'ROOFS', 'OPENINGS', 'FEATURES', 'COMPILE', 'INTERIOR']), blocks: z.array(z.string()).default([]) }).strict()

const VerificationSchema = z
  .object({
    revision: z.string().optional(),
    parameters: z.array(ParameterRecord).default([]),
    checks: z.array(CheckRecord).default([]),
    /** Proposals kept for rebinding: what was observed and is not built, with the reason. */
    held: z.array(z.object({ ref: z.string(), code: z.enum(TRACE_CODES), why: z.string() }).strict()).default([]),
    knownDefects: z.array(z.object({ code: z.string(), what: z.string() }).strict()).default([]),
    coverage: z.record(z.string(), z.enum(['CHECKED', 'PARTLY_CHECKED', 'NOT_CHECKED'])).default({}),
    /** What may be measured off the built model. */
    quantities: z.enum(['USABLE_IN_SCOPE', 'LIMITED', 'NOT_USABLE', 'NOT_ASSESSED']).default('NOT_ASSESSED'),
    modelHash: z.string().optional(),
    sceneContentHash: z.string().optional(),
    /** v0.2. One record per side of the house, and one per agreed opening. */
    views: z.array(ViewRecord).default([]),
    openings: z.array(OpeningRecord).default([]),
    /**
     * v0.2. Five separate answers, never one: were the computations done; were the available sources accounted for; does
     * the built geometry agree with what was agreed; is the exterior complete in the assessed scope; may quantities be
     * taken. READ_COMPLETE is not BUILT_COMPLETE, and an accepted candidate is not a faithful house.
     */
    status: z
      .object({
        computation: z.enum(['DONE', 'PARTIAL', 'FAILED']),
        sources: z.enum(['READ_COMPLETE', 'READ_PARTIAL', 'NOT_READ']),
        geometry: z.enum(['BUILT_COMPLETE', 'BUILT_PARTIAL', 'NOT_BUILT']),
        exterior: z.enum(['COMPLETE_IN_SCOPE', 'PARTIAL', 'NOT_ASSESSED']),
        missing: z.array(z.string()).default([]),
      })
      .strict()
      .optional(),
  })
  .strict()

export const HouseDocumentSchema = z
  .object({
    schema: z.literal(HOUSE_DOCUMENT_SCHEMA),
    /** 0.1.0 documents (v3.54.4) are a subset of 0.2.0 and are still read. */
    schemaVersion: z.enum(['0.1.0', '0.2.0', '0.3.0', '0.4.0', '0.5.0', HOUSE_DOCUMENT_VERSION]),
    id: Id,
    /** MANUAL_DIAGNOSTIC: a hand-checked description on the test path — never a product result, never an AI result. */
    origin: z.enum(['API_SOURCE_DESCRIPTION', 'MANUAL_DIAGNOSTIC']),
    source: z
      .object({
        sourcePackageHash: z.string().optional(),
        project: z.string().optional(),
        url: z.string().optional(),
        pictures: z.array(PictureSchema).default([]),
        missing: z.array(z.object({ what: z.string(), status: z.enum(['NOT_PUBLISHED', 'NOT_READABLE', 'NOT_SENT']) }).strict()).default([]),
        /** v0.2. Every picture the page names as an elevation or section: whether it was sent, asked about and answered. */
        views: z
          .array(z.object({ picture: Id, role: z.enum(['ELEVATION', 'SECTION']), asked: z.number().int().default(0), answer: z.enum(['DESCRIBED', 'NOT_ASKED', 'ASKED_NOT_ANSWERED', 'NOT_SENT', 'REPLAY_WITHOUT_FOLLOW_UP']), why: z.string().optional() }).strict())
          .default([]),
      })
      .strict(),
    reader: z.object({ engine: z.string(), model: z.string().optional(), prompt: z.string().optional(), at: z.string().optional() }).strict().optional(),
    observations: ObservationsSchema,
    /** v3.54.9: an interior from another source of the same pages (LOCAL), in its own frame; not an observation of the reading. */
    interiorSource: InteriorSourceSchema.optional(),
    /** Absent until the resolver agreed one: observations alone are not a house. */
    geometry: GeometrySchema.optional(),
    verification: VerificationSchema.default({}),
  })
  .strict()
export type HouseDocument = z.infer<typeof HouseDocumentSchema>
export type HouseObservations = z.infer<typeof ObservationsSchema>
export type HouseVerification = z.infer<typeof VerificationSchema>
export type HouseParameterRecord = z.infer<typeof ParameterRecord>
export type HouseCheck = z.infer<typeof CheckRecord>

/** Parse and check a document: the schema, then what the schema cannot say (ids unique, references that exist). */
export function parseHouseDocument(input: unknown): { ok: true; document: HouseDocument } | { ok: false; issues: string[] } {
  const r = HouseDocumentSchema.safeParse(input)
  if (!r.success) return { ok: false, issues: r.error.issues.slice(0, 40).map((i) => `${i.path.join('.')}: ${i.message}`) }
  const d = r.data
  const issues: string[] = []
  const dup = (what: string, ids: string[]): void => {
    const seen = new Set<string>()
    for (const id of ids) {
      if (seen.has(id)) issues.push(`${what}: id "${id}" is given twice`)
      seen.add(id)
    }
  }
  const pics = new Set(d.source.pictures.map((p) => p.id))
  dup('pictures', d.source.pictures.map((p) => p.id))
  const o = d.observations
  dup('observations', [...o.dimensions, ...o.levels, ...o.outlines, ...o.elevations, ...o.roofs].map((x) => x.id))
  for (const x of [...o.dimensions, ...o.levels, ...o.outlines, ...o.elevations]) if (!pics.has(x.picture)) issues.push(`observation ${x.id} names picture "${x.picture}", which the document does not list`)
  const g = d.geometry
  if (g) {
    dup('levels', g.levels.map((l) => l.id))
    dup('bodies', g.bodies.map((b) => b.id))
    dup('geometry objects', [...g.openings, ...g.dormers, ...g.balconies, ...g.canopies, ...g.chimneys, ...g.rooflights].map((x) => x.id))
    const levels = new Set(g.levels.map((l) => l.index))
    for (const b of g.bodies) for (const s of b.storeys) if (!levels.has(s)) issues.push(`body ${b.id} has a storey on level ${s}, which does not exist`)
    for (const ol of g.outlines) if (!levels.has(ol.level)) issues.push(`an outline is given for level ${ol.level}, which does not exist`)
    const walls = new Set(g.outlines.flatMap((ol) => ol.polygon.map((_, i) => `wall-${ol.level}-${i}`)))
    for (const x of g.openings) if (!walls.has(x.hostWall)) issues.push(`opening ${x.id} names host wall "${x.hostWall}", which is not an edge of an outline`)
    const bodies = new Set(g.bodies.map((b) => b.id))
    for (const x of g.dormers) {
      if (!walls.has(x.hostWall)) issues.push(`dormer ${x.id} names host wall "${x.hostWall}", which is not an edge of an outline`)
      if (!bodies.has(x.bodyId)) issues.push(`dormer ${x.id} names body "${x.bodyId}", which does not exist`)
    }
  }
  return issues.length > 0 ? { ok: false, issues } : { ok: true, document: d }
}

export const num = (value: number, basis: Exclude<Basis, 'UNKNOWN'>, how?: string, refs?: string[], uncertainty?: number): Num => ({ value, basis, ...(how ? { how } : {}), ...(refs && refs.length > 0 ? { refs } : {}), ...(uncertainty !== undefined ? { uncertainty } : {}) })
export const unknown = (how?: string): Num => ({ value: null, basis: 'UNKNOWN', ...(how ? { how } : {}) })
