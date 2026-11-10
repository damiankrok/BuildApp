/**
 * v3.53 — a whole-house description: what a reader of ALL of a page's sources at once may state about the building.
 *
 * The narrow per-picture tasks (`tasks.ts`) ask what one drawing shows. This asks the question the cascade could not:
 * which bodies the house is made of, how many storeys each has, what roof stands on each and how the roofs lie, which
 * openings each facade carries, which characteristic features the sources show, and in what broad colours. It is a
 * DESCRIPTION in a closed vocabulary, in metres in one stated frame — never a mesh, a command or an id of the model.
 * `described-house.ts` (reconstruction) turns an admitted description into the same `BuildingV2` the drawings' path
 * solves, and from there the same emitter, validator and compiler build it.
 *
 * Every dimension says what it rests on (`basis`): a number printed on a drawing, a figure published on the page, a
 * length scaled from a drawing, or an estimate from proportions. Only the first two are measurements, and neither is
 * verified by this file — `checkHouseDescription` compares them with the page's published figures and reports.
 * A side no source shows is stated as such (`hypotheticalSides`); what is placed there is a hypothesis.
 */
import { z } from 'zod'

export const HOUSE_DESCRIPTION_VERSION = '0.2.0'

export const HouseSideSchema = z.enum(['FRONT', 'REAR', 'LEFT', 'RIGHT'])
export type HouseSide = z.infer<typeof HouseSideSchema>

export const DimensionBasisSchema = z.enum(['PRINTED_ON_DRAWING', 'PUBLISHED_ON_PAGE', 'SCALED_FROM_DRAWING', 'ESTIMATED_FROM_PROPORTIONS'])
export type DimensionBasis = z.infer<typeof DimensionBasisSchema>

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/)
const images = z.array(z.number().int().min(1)).max(12).describe('The numbers of the pictures this rests on.')
const confidence = z.number().min(0).max(1)

export const ImageReadSchema = z
  .object({
    image: z.number().int().min(1).describe('The number the picture was given in the request.'),
    kind: z.enum(['FLOOR_PLAN', 'ELEVATION', 'SECTION', 'EXTERIOR_VIEW', 'INTERIOR', 'SITE_PLAN', 'OTHER']),
    storey: z.enum(['BASEMENT', 'GROUND', 'UPPER', 'ATTIC', 'NA']).describe('For a floor plan: which storey. Otherwise NA.'),
    shows: z.enum(['FRONT', 'REAR', 'LEFT', 'RIGHT', 'FRONT_LEFT', 'FRONT_RIGHT', 'REAR_LEFT', 'REAR_RIGHT', 'TOP', 'NA']).describe('For an elevation or exterior view: which side(s) of the house it shows, in the frame defined in the instructions.'),
    thisHouse: z.boolean().describe('False for a picture of another project, an advert, a logo, a mirrored variant sold separately, or anything that is not this building.'),
    mirrored: z.boolean().describe('True when this picture shows the house left-right mirrored relative to the ground-floor plan you took as the frame.'),
    note: z.string().max(200),
  })
  .strict()
export type ImageRead = z.infer<typeof ImageReadSchema>

export const DescribedRoofSchema = z
  .object({
    kind: z.enum(['GABLE', 'HIP', 'HALF_HIP', 'FLAT', 'SHED', 'PYRAMID', 'MANSARD', 'OTHER']),
    ridge: z.enum(['ALONG_X', 'ALONG_Z', 'NA']).describe('ALONG_X: the ridge runs parallel to the front facade. ALONG_Z: it runs front to back. NA for a flat, shed or pyramid roof.'),
    highSide: z.enum(['FRONT', 'REAR', 'LEFT', 'RIGHT', 'NA']).describe('SHED only: the side where the single slope is highest. Otherwise NA.'),
    pitchDeg: z.number().min(0).max(70),
    pitchBasis: DimensionBasisSchema,
    overhangM: z.number().min(0).max(1.5).describe('How far the eaves stand out past the walls; 0 when flush or unknown.'),
  })
  .strict()
export type DescribedRoof = z.infer<typeof DescribedRoofSchema>

export const DescribedBodySchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]{0,23}$/).describe('A short name of your own: main, garage, wing-1, porch.'),
    role: z.enum(['MAIN', 'GARAGE', 'WING', 'PORCH', 'BAY', 'OTHER']),
    x0: z.number(),
    x1: z.number(),
    z0: z.number(),
    z1: z.number(),
    storeys: z.number().int().min(1).max(4).describe('Storeys with full-height walls under the eaves (a bungalow with rooms in the roof has 1).'),
    habitableAttic: z.boolean().describe('True when there are rooms inside the pitched roof above the last full storey.'),
    eavesHeightM: z.number().min(1.8).max(16).describe('Top of this body’s walls at the eaves (or the top of a flat roof), above the ground floor level.'),
    heightBasis: DimensionBasisSchema,
    roof: DescribedRoofSchema,
    wallColour: hex.describe('The dominant colour of this body’s walls.'),
    images,
    confidence,
  })
  .strict()
export type DescribedBody = z.infer<typeof DescribedBodySchema>

export const DescribedOpeningSchema = z
  .object({
    bodyId: z.string(),
    side: HouseSideSchema.describe('The facade of that body the opening is in.'),
    storey: z.number().int().min(0).max(4).describe('0 = ground floor; a window in a gable end or knee wall of the attic is on the attic’s storey.'),
    kind: z.enum(['WINDOW', 'LARGE_GLAZING', 'ENTRANCE_DOOR', 'DOOR', 'GLAZED_DOOR', 'GARAGE_DOOR']),
    at: z.number().describe('Centre of the opening along its wall, in the plan frame: an x for FRONT and REAR walls, a z for LEFT and RIGHT walls.'),
    widthM: z.number().min(0.3).max(12),
    sillM: z.number().min(0).max(3).describe('Sill above that storey’s floor; 0 for doors and glazing to the floor.'),
    heightM: z.number().min(0.3).max(6),
    panes: z.number().int().min(1).max(8).describe('Vertical divisions seen across its width (1 when undivided).'),
    basis: z.enum(['PLAN_AND_ELEVATION', 'PLAN_ONLY', 'ELEVATION_ONLY', 'PICTURE_ONLY', 'HYPOTHETICAL']),
    images,
    confidence,
  })
  .strict()
export type DescribedOpening = z.infer<typeof DescribedOpeningSchema>

export const DescribedDormerSchema = z
  .object({
    bodyId: z.string(),
    slope: HouseSideSchema.describe('The side the roof slope carrying it faces.'),
    type: z.enum(['GABLE', 'SHED', 'FLAT']),
    at: z.number().describe('Centre along that slope’s eave, in the plan frame.'),
    widthM: z.number().min(0.6).max(10),
    images,
    confidence,
  })
  .strict()

export const DescribedRooflightSchema = z
  .object({ bodyId: z.string(), slope: HouseSideSchema, at: z.number(), widthM: z.number().min(0.4).max(3), images, confidence })
  .strict()

export const DescribedChimneySchema = z
  .object({ x: z.number(), z: z.number(), images, confidence })
  .strict()
  .describe('A stack standing above the roof, by its plan position.')

export const DescribedBalconySchema = z
  .object({
    bodyId: z.string(),
    side: HouseSideSchema,
    storey: z.number().int().min(1).max(4),
    from: z.number().describe('Its two ends along the facade, in the plan frame.'),
    to: z.number(),
    depthM: z.number().min(0.1).max(12).describe('How far it stands out from the wall; a terrace on the flat roof of a lower body is a balcony of the storey above it, as deep as that roof.'),
    railing: z.enum(['GLASS', 'BARS', 'SOLID', 'NONE']),
    images,
    confidence,
  })
  .strict()

export const DescribedTerraceSchema = z
  .object({ side: HouseSideSchema, from: z.number(), to: z.number(), depthM: z.number().min(0.5).max(12), images, confidence })
  .strict()
  .describe('A paved or decked ground-level terrace against a facade.')

export const DescribedCanopySchema = z
  .object({
    kind: z.enum(['ENTRANCE_CANOPY', 'PORCH_ROOF', 'CARPORT', 'COVERED_TERRACE', 'PERGOLA']),
    x0: z.number(),
    x1: z.number(),
    z0: z.number(),
    z1: z.number(),
    undersideM: z.number().min(1.8).max(8).describe('Height of its underside above the ground floor level.'),
    posts: z.number().int().min(0).max(12).describe('Free-standing posts or columns that carry it (0 when it cantilevers or hangs on walls).'),
    images,
    confidence,
  })
  .strict()
  .describe('A roof over an OPEN area (no walls of its own): its plan rectangle in the frame.')

export const HouseDescriptionSchema = z
  .object({
    images: z.array(ImageReadSchema).max(40).describe('One entry per picture you were given, in order.'),
    frame: z
      .object({
        planImage: z.number().int().min(0).describe('The ground-floor plan you took the frame from; 0 when there is none and the frame comes from elevations or views.'),
        frontIsPlanEdge: z.enum(['BOTTOM', 'TOP', 'LEFT', 'RIGHT', 'NA']).describe('Which edge of that plan picture the FRONT (entrance) facade lies along.'),
        how: z.string().max(300).describe('One sentence: how you identified the front and matched the elevations to the plan.'),
      })
      .strict(),
    overall: z
      .object({
        widthM: z.number().min(2).max(80).describe('Overall extent of the building along the front (x).'),
        depthM: z.number().min(2).max(80).describe('Overall extent front to back (z).'),
        basis: DimensionBasisSchema,
        printedWidthLabel: z.string().max(40).describe('The overall width exactly as printed on the plan (e.g. "1384" or "45\'-6\\""), or "" when none is printed.'),
        printedDepthLabel: z.string().max(40),
        ridgeHeightM: z.number().min(0).max(25).describe('Height of the highest ridge or roof top above the ground floor level; 0 when no source lets you tell.'),
        ridgeHeightBasis: DimensionBasisSchema,
        storeyHeightM: z.number().min(2.2).max(4.5).describe('Floor-to-floor height of a full storey.'),
      })
      .strict(),
    bodies: z.array(DescribedBodySchema).min(1).max(8),
    sides: z
      .array(
        z
          .object({
            side: HouseSideSchema,
            pictures: z.array(z.number().int().min(1)).max(12).describe('Every picture that shows this side: its elevation drawing first, then exterior views. Empty only when nothing shows it.'),
            openingsByStorey: z.array(z.number().int().min(0).max(40)).max(5).describe('How many openings in exterior walls you COUNT on this side, per storey from the ground up (e.g. [5, 2]). Count on the elevation first; then list exactly these in `openings`.'),
          })
          .strict(),
      )
      .length(4)
      .describe('One entry for each of FRONT, REAR, LEFT, RIGHT.'),
    openings: z.array(DescribedOpeningSchema).max(120),
    dormers: z.array(DescribedDormerSchema).max(12),
    rooflights: z.array(DescribedRooflightSchema).max(24),
    chimneys: z.array(DescribedChimneySchema).max(8),
    balconies: z.array(DescribedBalconySchema).max(8),
    terraces: z.array(DescribedTerraceSchema).max(6),
    canopies: z.array(DescribedCanopySchema).max(6),
    palette: z.object({ roof: hex, joinery: hex, garageDoor: hex, accent: hex, accentWhere: z.string().max(120) }).strict(),
    hypotheticalSides: z.array(HouseSideSchema).max(4).describe('Sides that NO picture shows: whatever you placed there is a guess.'),
    unknowns: z.array(z.string().max(240)).max(12).describe('What the sources do not let you tell, or where they contradict each other.'),
  })
  .strict()
export type HouseDescription = z.infer<typeof HouseDescriptionSchema>

/** A JSON Schema of the subset of Zod used above — what a provider is constrained to. */
export type JsonSchemaNode = { [k: string]: unknown }
export function jsonSchemaOf(schema: z.ZodTypeAny): JsonSchemaNode {
  const d = schema.description ? { description: schema.description } : {}
  const def = (schema as unknown as { _def: Record<string, unknown> })._def
  switch (def.typeName) {
    case 'ZodObject': {
      const shape = (schema as z.ZodObject<z.ZodRawShape>).shape
      return { type: 'object', additionalProperties: false, required: Object.keys(shape), properties: Object.fromEntries(Object.entries(shape).map(([k, v]) => [k, jsonSchemaOf(v as z.ZodTypeAny)])), ...d }
    }
    case 'ZodArray':
      return { type: 'array', items: jsonSchemaOf(def.type as z.ZodTypeAny), ...d }
    case 'ZodEnum':
      return { type: 'string', enum: [...(def.values as string[])], ...d }
    case 'ZodNumber':
      return { type: (def.checks as Array<{ kind: string }>).some((c) => c.kind === 'int') ? 'integer' : 'number', ...d }
    case 'ZodString':
      return { type: 'string', ...d }
    case 'ZodBoolean':
      return { type: 'boolean', ...d }
    default:
      throw new Error(`jsonSchemaOf: unsupported ${String(def.typeName)}`)
  }
}

export const houseDescriptionJsonSchema = (): JsonSchemaNode => jsonSchemaOf(HouseDescriptionSchema)

/** What the reader is told about one picture: its number, and nothing a caption could bias (no file name, no role). */
export type HouseDescriptionImage = { number: number; widthPx: number; heightPx: number }

/** A figure the page publishes in its text, as the source package holds it. */
export type PublishedFigure = { key: string; label: string; raw: string; value: number; unit: string }

export const HOUSE_DESCRIPTION_SYSTEM = [
  'You read architectural source material — floor plans, elevations, sections, exterior pictures — of ONE house, published on a house-plan web page, and state what the building is, in a closed vocabulary and in metres.',
  'You state only what the pictures and the published figures support. Where they do not let you tell, you say so in `unknowns` and mark the side in `hypotheticalSides`; you never invent a measurement and never present an estimate as a printed figure.',
  'Your answer is a description for a program that builds a simplified, recognisable model of the exterior: main bodies, garage and wings, storeys, roofs and how they lie, openings on the right walls, and the features that make the house recognisable. Interior walls and furniture are not wanted.',
].join('\n')

export function buildHouseDescriptionPrompt(input: { images: HouseDescriptionImage[]; published: PublishedFigure[]; pageTitle?: string }): string {
  const figures = input.published.length > 0 ? input.published.map((f) => `- ${f.label}: ${f.raw} (${f.key} = ${f.value} ${f.unit})`).join('\n') : '- (the page publishes no figures)'
  return [
    `You are given ${input.images.length} pictures from one project page${input.pageTitle ? ` ("${input.pageTitle}")` : ''}, each preceded by its number. Some may be interiors, site plans, adverts or other projects — classify every picture in \`images\` and ignore the ones that are not this building's plans, elevations, section or exterior.`,
    '',
    'Figures the page publishes in its text (metres; they are the publisher\'s, not verified):',
    figures,
    '',
    'THE FRAME. One frame for everything, in metres:',
    '- FRONT is the facade with the main entrance door. Stand outside facing it: x runs along the front from your LEFT to your RIGHT; z runs from the front of the house AWAY from you to the REAR.',
    '- x = 0 is the leftmost face of the whole building, z = 0 its frontmost face. Every body is an axis-aligned rectangle x0..x1, z0..z1 of its OUTER wall faces. Approximate an L-, T- or U-shaped house by several rectangles that touch but do not overlap; bay windows and small offsets under 0.5 m may be ignored.',
    '- LEFT is the facade at small x, RIGHT at large x. Positions `at`, `from`, `to` are plan coordinates: an x for FRONT and REAR walls, a z for LEFT and RIGHT walls. Careful with the REAR elevation drawing: it is seen from behind, so plan x increases from the drawing\'s right to its left; the same holds for z on the LEFT elevation. Use the plan to settle which end is which.',
    '- Heights are above the ground-floor floor level (±0,00).',
    '',
    'HOW TO WORK.',
    '1. Find the ground-floor plan. Locate the entrance; that fixes FRONT. Read the overall dimensions printed along the outer dimension lines (centimetres on Polish drawings, feet-inches on American ones) and convert to metres; if none is printed, use the published width/depth; if neither, scale from doors (about 0.9 m) or stairs and say ESTIMATED_FROM_PROPORTIONS.',
    '2. Decompose the footprint into bodies: the main body, an attached garage, wings, a projecting porch. A roof on posts over an open area (carport, covered terrace, entrance canopy) is a `canopy`, not a body.',
    '3. For each body: full storeys, whether the roof holds rooms, the height of the eaves, and its roof — kind, ridge direction, pitch. Use the section and elevations for heights and pitch (printed level marks first); a roof or site plan shows ridges and valleys from above; use exterior views for the roof\'s shape when drawings are missing. A roof whose kind you cannot see is `OTHER`, never a guessed FLAT.',
    '   Ridge direction, checked two ways: the triangular (gable) walls stand at the two ENDS of the ridge, so a body whose triangle faces the front has its ridge ALONG_Z; and on the elevation of a side parallel to the ridge you see the roof slope as a broad band, not a triangle. A lower roof over a garage or wing has its own ridge — look at it on its own, it need not follow the main one.',
    '   A single slope (SHED): `highSide` is the side whose wall is TALLEST, where the roof\'s upper edge is; `eavesHeightM` is the wall height on the opposite, low side. Check it on a side elevation or a view from the corner.',
    '4. Go round the four facades, one at a time: FRONT, REAR, LEFT, RIGHT. For each, first name the pictures that show it and COUNT its openings per storey (`sides`); then list every one of them in `openings` with its body, side, storey, kind, centre, width, sill and height. A side that a picture shows and for which you list nothing is almost always an omission — look again. Take positions and widths from the plans, sills and heights from the elevations, and both from exterior views when there is nothing else (then say PICTURE_ONLY). Do not list interior doors. Windows in a roof slope are `rooflights` — count them on the elevations and views too; windows in a dormer belong to the `dormer`.',
    '5. Add what makes the house recognisable when a picture shows it: dormers, every chimney above the roof, balconies with their railing, terraces, and roofs over open areas (porch, covered terrace, carport, entrance canopy) with their posts.',
    '6. Colours: one hex per body for its walls, and the roof, joinery, garage door and accent (cladding, plinth, frames).',
    '7. A side that no elevation and no exterior view shows goes in `hypotheticalSides`; openings you still place there from the plan are PLAN_ONLY, anything else there is HYPOTHETICAL.',
    '',
    'Be literal about counts: three windows drawn are three openings. Prefer the drawings to the renders when they disagree, and say so in `unknowns`.',
    'Return the description as the structured output only.',
  ].join('\n')
}

/** The lists whose entries stand or fall one by one. Bodies and the overall size are the house itself: they do not. */
const ITEM_SCHEMAS = { openings: DescribedOpeningSchema, dormers: DescribedDormerSchema, rooflights: DescribedRooflightSchema, chimneys: DescribedChimneySchema, balconies: DescribedBalconySchema, terraces: DescribedTerraceSchema, canopies: DescribedCanopySchema } as const

export type HouseDescriptionIssue = { code: string; severity: 'REJECT' | 'WARN'; detail: string }

const overlapArea = (a: { x0: number; x1: number; z0: number; z1: number }, b: { x0: number; x1: number; z0: number; z1: number }): number => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0))

/**
 * Deterministic admission of a description: shape, internal consistency, and agreement with the page's own figures.
 * A REJECT means the description cannot be built as stated (the caller refuses it whole); a WARN is carried into the
 * result. Nothing here knows a house, a publisher or an expected answer.
 */
export function checkHouseDescription(raw: unknown, published: PublishedFigure[] = []): { ok: true; description: HouseDescription; issues: HouseDescriptionIssue[] } | { ok: false; issues: HouseDescriptionIssue[] } {
  const issues: HouseDescriptionIssue[] = []
  // one feature stated outside the vocabulary's bounds is that feature's loss, not the house's: it is dropped and named
  let candidate = raw
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const copy: Record<string, unknown> = { ...(raw as Record<string, unknown>) }
    for (const [key, item] of Object.entries(ITEM_SCHEMAS)) {
      const list = copy[key]
      if (!Array.isArray(list)) continue
      copy[key] = list.filter((entry, i) => {
        const r = item.safeParse(entry)
        if (!r.success) issues.push({ code: 'ITEM_INVALID_DROPPED', severity: 'WARN', detail: `${key}[${i}] ${r.error.issues[0]?.path.join('.') ?? ''}: ${r.error.issues[0]?.message ?? 'invalid'}` })
        return r.success
      })
    }
    candidate = copy
  }
  const parsed = HouseDescriptionSchema.safeParse(candidate)
  if (!parsed.success) return { ok: false, issues: [...issues, ...parsed.error.issues.slice(0, 12).map((i) => ({ code: 'SCHEMA_INVALID', severity: 'REJECT' as const, detail: `${i.path.join('.')}: ${i.message}` }))] }
  const d = parsed.data
  const reject = (code: string, detail: string): void => void issues.push({ code, severity: 'REJECT', detail })
  const warn = (code: string, detail: string): void => void issues.push({ code, severity: 'WARN', detail })
  const ids = new Set<string>()
  for (const b of d.bodies) {
    if (ids.has(b.id)) reject('BODY_ID_REPEATED', b.id)
    ids.add(b.id)
    if (!(b.x1 - b.x0 >= 1) || !(b.z1 - b.z0 >= 1)) reject('BODY_DEGENERATE', `${b.id}: ${b.x0}..${b.x1} × ${b.z0}..${b.z1}`)
  }
  if (d.bodies.filter((b) => b.role === 'MAIN').length !== 1) reject('MAIN_BODY_COUNT', `${d.bodies.filter((b) => b.role === 'MAIN').length} bodies are called MAIN`)
  for (let i = 0; i < d.bodies.length; i += 1)
    for (let j = i + 1; j < d.bodies.length; j += 1) {
      const a = d.bodies[i]
      const b = d.bodies[j]
      const o = overlapArea(a, b)
      const smaller = Math.min((a.x1 - a.x0) * (a.z1 - a.z0), (b.x1 - b.x0) * (b.z1 - b.z0))
      if (o > 0.5 * smaller) reject('BODIES_COINCIDE', `${a.id} and ${b.id} share ${o.toFixed(1)} m² of ${smaller.toFixed(1)}`)
      else if (o > 0.25) warn('BODIES_OVERLAP', `${a.id} and ${b.id} overlap by ${o.toFixed(2)} m²`)
    }
  const bx0 = Math.min(...d.bodies.map((b) => b.x0))
  const bx1 = Math.max(...d.bodies.map((b) => b.x1))
  const bz0 = Math.min(...d.bodies.map((b) => b.z0))
  const bz1 = Math.max(...d.bodies.map((b) => b.z1))
  const within = (a: number, b: number, tol: number): boolean => Math.abs(a - b) <= tol * Math.max(a, b)
  if (!within(bx1 - bx0, d.overall.widthM, 0.08) || !within(bz1 - bz0, d.overall.depthM, 0.08)) warn('BODIES_DO_NOT_SPAN_OVERALL', `bodies span ${(bx1 - bx0).toFixed(2)} × ${(bz1 - bz0).toFixed(2)} m, overall stated ${d.overall.widthM} × ${d.overall.depthM}`)
  // the page's own figures: width and length in either order (publishers disagree on which is which), and the footprint
  const fig = (key: string): number | undefined => published.find((f) => f.key === key)?.value
  const pw = fig('building_width')
  const pl = fig('building_length')
  if (pw !== undefined && pl !== undefined) {
    const direct = within(d.overall.widthM, pw, 0.1) && within(d.overall.depthM, pl, 0.1)
    const swapped = within(d.overall.widthM, pl, 0.1) && within(d.overall.depthM, pw, 0.1)
    if (!direct && !swapped) warn('OVERALL_DISAGREES_WITH_PUBLISHED_EXTENT', `stated ${d.overall.widthM} × ${d.overall.depthM} m, the page publishes ${pw} × ${pl}`)
  } else if (pw !== undefined && !within(d.overall.widthM, pw, 0.1) && !within(d.overall.depthM, pw, 0.1)) warn('OVERALL_DISAGREES_WITH_PUBLISHED_EXTENT', `neither ${d.overall.widthM} nor ${d.overall.depthM} m is the published width ${pw}`)
  const area = d.bodies.reduce((s, b) => s + (b.x1 - b.x0) * (b.z1 - b.z0), 0)
  const pa = fig('footprint_area')
  if (pa !== undefined && !within(area, pa, 0.15)) warn('FOOTPRINT_DISAGREES_WITH_PUBLISHED_AREA', `bodies cover ${area.toFixed(1)} m², the page publishes ${pa}`)
  const ph = fig('building_height')
  if (ph !== undefined && d.overall.ridgeHeightM > 0 && !within(d.overall.ridgeHeightM, ph, 0.15)) warn('HEIGHT_DISAGREES_WITH_PUBLISHED', `ridge stated ${d.overall.ridgeHeightM} m, the page publishes ${ph}`)
  const pp = fig('roof_pitch')
  const main = d.bodies.find((b) => b.role === 'MAIN')
  if (pp !== undefined && main && main.roof.kind !== 'FLAT' && Math.abs(main.roof.pitchDeg - pp) > 5) warn('PITCH_DISAGREES_WITH_PUBLISHED', `main roof stated ${main.roof.pitchDeg}°, the page publishes ${pp}°`)
  const known = (id: string, what: string): void => {
    if (!ids.has(id)) warn('UNKNOWN_BODY', `${what} names body ${id}`)
  }
  d.openings.forEach((o, i) => known(o.bodyId, `opening ${i}`))
  d.dormers.forEach((o, i) => known(o.bodyId, `dormer ${i}`))
  d.rooflights.forEach((o, i) => known(o.bodyId, `rooflight ${i}`))
  d.balconies.forEach((o, i) => known(o.bodyId, `balcony ${i}`))
  const shown = new Set(d.images.filter((i) => i.thisHouse && (i.kind === 'ELEVATION' || i.kind === 'EXTERIOR_VIEW')).flatMap((i) => i.shows.split('_')))
  for (const s of HouseSideSchema.options) if (!shown.has(s) && !d.hypotheticalSides.includes(s)) warn('SIDE_NOT_SHOWN_NOT_DECLARED', `${s}: no elevation or view is listed for it, yet it is not declared hypothetical`)
  // each side: what was counted on it against what was listed for it
  for (const side of HouseSideSchema.options) {
    const entries = d.sides.filter((x) => x.side === side)
    if (entries.length !== 1) {
      warn('SIDES_NOT_ONE_EACH', `${side} has ${entries.length} entries in sides`)
      continue
    }
    const counted = entries[0].openingsByStorey
    const listed = d.openings.filter((o) => o.side === side)
    const storeys = Math.max(counted.length, ...listed.map((o) => o.storey + 1), 0)
    for (let st = 0; st < storeys; st += 1) {
      const c = counted[st] ?? 0
      const l = listed.filter((o) => o.storey === st).length
      if (c !== l) warn('SIDE_COUNT_MISMATCH', `${side} storey ${st}: ${c} counted, ${l} listed`)
    }
    if (entries[0].pictures.length > 0 && listed.length === 0 && !d.hypotheticalSides.includes(side)) warn('SIDE_SHOWN_BUT_EMPTY', `${side}: pictures ${entries[0].pictures.join(', ')} show it, no opening is listed`)
  }
  if (d.overall.basis === 'PRINTED_ON_DRAWING' && d.overall.printedWidthLabel === '' && d.overall.printedDepthLabel === '') warn('PRINTED_BASIS_WITHOUT_LABEL', 'the overall size is called printed, but no printed label is quoted')
  return issues.some((i) => i.severity === 'REJECT') ? { ok: false, issues } : { ok: true, description: d, issues }
}
