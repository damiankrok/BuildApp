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
export const HOUSE_DOCUMENT_VERSION = '0.1.0' as const

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
  })
  .strict()

const ElevationFeature = z
  .object({
    id: Id,
    kind: z.enum(['WALL_DORMER_GABLE', 'ROOF_DORMER_GABLE', 'ROOF_DORMER_SHED', 'CROSS_GABLE', 'CANOPY', 'BALCONY', 'CHIMNEY', 'BAY', 'OTHER']),
    box: Box,
    bodyId: Id.optional(),
    /** For a dormer: the row where its own roof begins (its eaves), and its apex. */
    eavesY: z.number().finite().nullable().optional(),
    apexY: z.number().finite().nullable().optional(),
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
    origin: Origin,
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

const BalconySchema = z
  .object({ id: Id, level: z.number().int(), rect: z.object({ x0: z.number(), z0: z.number(), x1: z.number(), z1: z.number() }).strict(), topY: NumSchema, thicknessM: NumSchema, railing: z.boolean().default(true), basis: BasisSchema, refs: z.array(z.string()).default([]) })
  .strict()
const CanopySchema = z
  .object({ id: Id, kind: z.enum(['ENTRANCE_CANOPY', 'PORCH_ROOF', 'PORTICO', 'CARPORT', 'COVERED_TERRACE']), rect: z.object({ x0: z.number(), z0: z.number(), x1: z.number(), z1: z.number() }).strict(), undersideY: NumSchema, thicknessM: NumSchema, posts: z.array(Vec2).default([]), basis: BasisSchema, refs: z.array(z.string()).default([]) })
  .strict()
const ChimneySchema = z.object({ id: Id, rect: z.object({ x0: z.number(), z0: z.number(), x1: z.number(), z1: z.number() }).strict(), topY: NumSchema, basis: BasisSchema, refs: z.array(z.string()).default([]) }).strict()

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
    /** What exists and is NOT part of this document's check: the interior is kept as the builder finds it, never certified here. */
    interior: z.object({ status: z.enum(['NOT_BUILT', 'NOT_CHECKED']), note: z.string().optional() }).strict().default({ status: 'NOT_BUILT' }),
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
  })
  .strict()

const CheckRecord = z.object({ id: Id, what: z.string(), expected: z.string(), measured: z.string(), status: z.enum(['PASS', 'FAIL', 'NOT_CHECKED', 'UNKNOWN']), scope: z.enum(['IDENTITY', 'ORIENTATION', 'METRIC', 'BODIES', 'LEVELS', 'ROOFS', 'OPENINGS', 'FEATURES', 'COMPILE']), blocks: z.array(z.string()).default([]) }).strict()

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
  })
  .strict()

export const HouseDocumentSchema = z
  .object({
    schema: z.literal(HOUSE_DOCUMENT_SCHEMA),
    schemaVersion: z.literal(HOUSE_DOCUMENT_VERSION),
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
      })
      .strict(),
    reader: z.object({ engine: z.string(), model: z.string().optional(), prompt: z.string().optional(), at: z.string().optional() }).strict().optional(),
    observations: ObservationsSchema,
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
    dup('geometry objects', [...g.openings, ...g.dormers, ...g.balconies, ...g.canopies, ...g.chimneys].map((x) => x.id))
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
