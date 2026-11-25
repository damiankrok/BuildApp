/**
 * The STRUCTURE of the house as one typed answer (v3.54.19 `form-read/1`: the elevations only, a witness of the body
 * arbitration; v3.54.20 `form-read/2`: all sheets, a contract the body builder executes — see the note at the prompt).
 *
 * Why: the contour reading states each elevation as polygons, and the body is then solved from silhouettes one view at a
 * time — what kind of roof the house has, how many storeys stand under the eaves, whether a strip is a part of the house
 * or a box of its own, is never asked of the sheets as a whole, and a hip seen from its short side IS a triangle. The
 * typed answer says those things; `structure.ts` agrees each of them with witnesses that do not come from this request
 * (the package's storey plans, the page's facts, the plan read's parts, the sketches' gable walls) and names what is
 * disputed; only agreed or unwitnessed-and-undisputed properties reach the builder.
 */
import { z } from 'zod'
import type { Raster } from '@buildapp/source-cv'
import { ConsultantUnavailable, settledOf } from './loop.js'
import type { ConsultSpend, ConsultantModel, ModelTurn, Price } from './loop.js'
import { reserveOf } from './cost.js'
import { encodePng } from '../diagnostics.js'
import { MAX_SIDE } from './tools.js'

export const FORM_READ_VERSION = '3.0.0' as const
export const FORM_READ_PROMPT_VERSION = 'form-read/3' as const

const ROOFS = ['GABLE', 'HIP', 'FLAT', 'SHED', 'MANSARD', 'OTHER'] as const
const SIDES = ['FRONT', 'LEFT', 'RIGHT', 'REAR', 'NONE'] as const
const STATUS = ['PRINTED', 'DERIVED', 'ESTIMATED', 'UNKNOWN'] as const
const NOT_VOLUMES = ['RECESS', 'PORCH', 'BAY', 'DORMER', 'BALCONY', 'CANOPY', 'CARPORT', 'TERRACE'] as const
const ROOF_OF = ['MAIN', 'PART', 'CROSS'] as const
const JOINS = ['VALLEY', 'ABUTS_WALL', 'SAME_PLANE', 'APART', 'NONE'] as const
const COVERED = ['MAIN_ROOF', 'OWN_ROOF', 'NONE'] as const
const CORNERS = ['FRONT', 'FRONT_LEFT', 'FRONT_RIGHT', 'REAR', 'REAR_LEFT', 'REAR_RIGHT', 'OTHER'] as const

/**
 * form-read/2 (v3.54.20) — the STRUCTURE of the house as one typed answer from ALL its sheets in one request: the
 * captioned elevations, the ground-floor plan, a section where the page has one, and the page's own facts as text. It is
 * a contract the analyzer executes (structure.ts agrees it with independent witnesses; the body builder takes the agreed
 * properties), not a description for a person:
 *  - sides are named as someone standing in FRONT of the house, OUTSIDE, looking at the front elevation, sees them
 *    (LEFT is that person's left) — the same for every picture, so opposite elevations cannot swap silently;
 *  - a recess, a porch, a bay, a dormer, a balcony, a canopy are named apart and are NOT volumes;
 *  - every number carries how it is known: PRINTED (the sheets print it), DERIVED (computed from printed numbers),
 *    ESTIMATED (by eye from proportions), UNKNOWN (then no number) — heights from the ground floor's floor level.
 */
/**
 * form-read/3 (v3.54.21) — the same request, asked of the ORIGINAL sheets (the publisher's elevation pictures chosen from
 * the package, not the list of elevations a sketch succeeded on), with perspective pictures as a qualitative witness of
 * how volumes and roofs relate, and with every ROOF REGION stated on its own: its identity, what it is the roof of, its
 * own pitch / eaves / ridge (never the main roof's copied down), where a cross gable stands on its elevation, and how
 * it meets the roof beside it (a valley, a wall, apart). The first 40 characters of the system text are those of /2 on
 * purpose: a recorded /2 answer is replayed for this request and parsed as a /3 answer without roof regions.
 */
export const FORM_READ_SYSTEM = `You are given the sheets of ONE house project: its orthographic elevations (numbered, each with the publisher's caption), then where available its ground-floor plan and a cross-section, perspective pictures of the finished house (numbered P1, P2, …: NOT to scale, use them only to understand how volumes and roofs relate), and the facts the page states as text. Report the STRUCTURE of the house as typed facts the sheets agree on. Do not describe it in prose and do not guess what no sheet shows.
LEFT and RIGHT always mean the left and right of a person standing OUTSIDE in front of the house, looking at the FRONT elevation. Use the plan to tell which side elevation is which.
"storeys": ONE (ground floor only, the roof space not lived in), ONE_WITH_ATTIC (ground floor and rooms in the roof: windows in the gables, roof windows or dormers; the eaves about one storey high), TWO (two FULL storeys of walls under the eaves), TWO_WITH_ATTIC. "storeysBasis": the sheet that settles it (SECTION, ELEVATIONS, PLANS).
The MAIN volume: "mainRoofKind": GABLE (two slopes and two gable walls that rise to the ridge), HIP (slopes on all four sides, no gable wall), FLAT, SHED (one slope), MANSARD, OTHER. "mainRidgeAlong": FRONT when the main ridge runs parallel to the front elevation (the front shows a roof slope), SIDE when it runs front-to-back (the front shows a gable wall or, for a hip, the short hip slope), NONE for a flat roof. "pitchDeg", "eavesM", "ridgeM": the main roof's pitch in degrees, the height of the top of the walls under the eaves, and the height of the ridge, the two heights in metres ABOVE THE GROUND FLOOR'S FLOOR LEVEL (the section's ±0.00); each with its own status ("pitchStatus", "eavesStatus", "ridgeStatus"): PRINTED (a sheet or the page prints this number), DERIVED (computed from printed numbers), ESTIMATED (by eye from proportions), UNKNOWN (then the value is null).
"parts": every OTHER volume standing under its OWN roof (a lower garage, a wing, an annex): what it is, "where" it stands relative to the main volume as seen from the front (LEFT, RIGHT, FRONT for one projecting forward, REAR), its own storeys (ONE or TWO), its roof kind and ridgeAlong, and "lowerThanMain". A part of the house under the MAIN roof is not a part.
"roofs": every ROOF REGION of the house, the main roof first. "id": R1 for the main roof, then R2, R3, …. "of": MAIN; PART for the roof of a volume listed in "parts" ("part" = its number in that list, counted from 1); CROSS for a second ridge standing on the MAIN volume's own walls with no separate volume under it (a cross gable, a gabled wall dormer more than about 2 m wide) — the plan's outline has no step there. "kind" and "ridgeAlong" as for the main roof. "pitchDeg", "eavesM", "ridgeM" with their statuses are THIS region's own, measured as for the main roof — never copy the main roof's numbers to another region: where a region's own number is not printed and cannot be derived, estimate it from the elevation (ESTIMATED) or give null (UNKNOWN). "seenOn": the side whose elevation shows this region's gable wall or front (NONE for the main roof). "fromShare", "toShare": for a CROSS region, where its gable wall stands on that elevation as shares between 0 and 1 of the BUILDING's width, measured from the building's left edge AS THAT PICTURE DRAWS IT; null otherwise. "meets": the id of the roof region it meets (NONE for the main roof). "join": VALLEY (its ridge runs into the other roof's slope; the two fold into valleys), ABUTS_WALL (it ends against a wall that rises above it — a lower roof against a higher volume), SAME_PLANE (it continues the other roof's slope without a fold), APART (a wall or a step stands between the two roofs), NONE.
"notVolumes": things that are NOT volumes and must not be built as boxes: RECESS (a wall set back, an entrance niche), PORCH, BAY, DORMER, BALCONY, CANOPY, CARPORT, TERRACE (roofed or not), each with the side it is on and "covered": MAIN_ROOF (the main roof runs on over it), OWN_ROOF (it has a small roof or slab of its own), NONE (open to the sky).
"pictures": one entry for EVERY elevation picture, by its number: "shows" the side of the house it shows (FRONT, REAR, LEFT, RIGHT, or NONE if it cannot be told), "roofSeenAs" what the MAIN roof looks like on it (GABLE_END: a gable wall rising to the ridge; SLOPE: a roof slope with a level ridge as long as the eaves; HIP: a slope narrowing to a short ridge or a point; FLAT), and whether it shows the main entrance door and a garage door.
"perspectives": one entry for every perspective picture, by its number (1 for P1): "corner" the corner or side of the house it looks at (FRONT, FRONT_LEFT, FRONT_RIGHT, REAR, REAR_LEFT, REAR_RIGHT, OTHER) and "mirrored": true when it shows the house mirrored against the elevations.
"dormers", "chimneys", "roofWindows": counts over the whole house (a chimney seen on several elevations is one chimney).`

const TOOL = {
  name: 'report_structure',
  description: 'Report the structure of the house as typed facts.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['storeys', 'storeysBasis', 'mainRoofKind', 'mainRidgeAlong', 'pitchDeg', 'pitchStatus', 'eavesM', 'eavesStatus', 'ridgeM', 'ridgeStatus', 'parts', 'roofs', 'notVolumes', 'pictures', 'perspectives', 'dormers', 'chimneys', 'roofWindows'],
    properties: {
      storeys: { type: 'string', enum: ['ONE', 'ONE_WITH_ATTIC', 'TWO', 'TWO_WITH_ATTIC'] },
      storeysBasis: { type: 'string', enum: ['SECTION', 'ELEVATIONS', 'PLANS'] },
      mainRoofKind: { type: 'string', enum: ROOFS },
      mainRidgeAlong: { type: 'string', enum: ['FRONT', 'SIDE', 'NONE'] },
      pitchDeg: { type: ['number', 'null'] },
      pitchStatus: { type: 'string', enum: STATUS },
      eavesM: { type: ['number', 'null'] },
      eavesStatus: { type: 'string', enum: STATUS },
      ridgeM: { type: ['number', 'null'] },
      ridgeStatus: { type: 'string', enum: STATUS },
      parts: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['what', 'where', 'storeys', 'roof', 'lowerThanMain'], properties: { what: { type: 'string', enum: ['GARAGE', 'WING', 'ANNEX'] }, where: { type: 'string', enum: ['LEFT', 'RIGHT', 'FRONT', 'REAR'] }, storeys: { type: 'string', enum: ['ONE', 'TWO'] }, roof: { type: 'object', additionalProperties: false, required: ['kind', 'ridgeAlong'], properties: { kind: { type: 'string', enum: ROOFS }, ridgeAlong: { type: 'string', enum: ['FRONT', 'SIDE', 'NONE'] } } }, lowerThanMain: { type: 'boolean' } } } },
      roofs: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'of', 'part', 'kind', 'ridgeAlong', 'pitchDeg', 'pitchStatus', 'eavesM', 'eavesStatus', 'ridgeM', 'ridgeStatus', 'seenOn', 'fromShare', 'toShare', 'meets', 'join'], properties: { id: { type: 'string' }, of: { type: 'string', enum: ROOF_OF }, part: { type: ['integer', 'null'] }, kind: { type: 'string', enum: ROOFS }, ridgeAlong: { type: 'string', enum: ['FRONT', 'SIDE', 'NONE'] }, pitchDeg: { type: ['number', 'null'] }, pitchStatus: { type: 'string', enum: STATUS }, eavesM: { type: ['number', 'null'] }, eavesStatus: { type: 'string', enum: STATUS }, ridgeM: { type: ['number', 'null'] }, ridgeStatus: { type: 'string', enum: STATUS }, seenOn: { type: 'string', enum: SIDES }, fromShare: { type: ['number', 'null'] }, toShare: { type: ['number', 'null'] }, meets: { type: 'string' }, join: { type: 'string', enum: JOINS } } } },
      notVolumes: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['what', 'where', 'covered'], properties: { what: { type: 'string', enum: NOT_VOLUMES }, where: { type: 'string', enum: ['FRONT', 'LEFT', 'RIGHT', 'REAR'] }, covered: { type: 'string', enum: COVERED } } } },
      perspectives: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['n', 'corner', 'mirrored'], properties: { n: { type: 'integer' }, corner: { type: 'string', enum: CORNERS }, mirrored: { type: 'boolean' } } } },
      pictures: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['n', 'shows', 'roofSeenAs', 'entranceDoor', 'garageDoor'], properties: { n: { type: 'integer' }, shows: { type: 'string', enum: SIDES }, roofSeenAs: { type: 'string', enum: ['GABLE_END', 'SLOPE', 'HIP', 'FLAT'] }, entranceDoor: { type: 'boolean' }, garageDoor: { type: 'boolean' } } } },
      dormers: { type: 'integer' },
      chimneys: { type: 'integer' },
      roofWindows: { type: 'integer' },
      note: { type: 'string' },
    },
  },
} as const

const RoofRaw = z.object({ kind: z.enum(ROOFS), ridgeAlong: z.enum(['FRONT', 'SIDE', 'NONE']) }).strict()
const Raw = z.object({
  storeys: z.enum(['ONE', 'ONE_WITH_ATTIC', 'TWO', 'TWO_WITH_ATTIC']),
  storeysBasis: z.enum(['SECTION', 'ELEVATIONS', 'PLANS']),
  mainRoofKind: z.enum(ROOFS),
  mainRidgeAlong: z.enum(['FRONT', 'SIDE', 'NONE']),
  pitchDeg: z.number().finite().min(0).max(80).nullable(),
  pitchStatus: z.enum(STATUS),
  eavesM: z.number().finite().min(0).max(15).nullable(),
  eavesStatus: z.enum(STATUS),
  ridgeM: z.number().finite().min(0).max(25).nullable(),
  ridgeStatus: z.enum(STATUS),
  parts: z.array(z.object({ what: z.enum(['GARAGE', 'WING', 'ANNEX']), where: z.enum(['LEFT', 'RIGHT', 'FRONT', 'REAR']), storeys: z.enum(['ONE', 'TWO']), roof: RoofRaw, lowerThanMain: z.boolean() }).strict()).max(6),
  // form-read/3; absent in a recorded /2 answer (replayed for the same request): then no roof region is stated beyond the main roof and the parts
  roofs: z.array(z.object({ id: z.string().min(1).max(8), of: z.enum(ROOF_OF), part: z.number().int().min(1).max(6).nullable(), kind: z.enum(ROOFS), ridgeAlong: z.enum(['FRONT', 'SIDE', 'NONE']), pitchDeg: z.number().finite().min(0).max(80).nullable(), pitchStatus: z.enum(STATUS), eavesM: z.number().finite().min(0).max(15).nullable(), eavesStatus: z.enum(STATUS), ridgeM: z.number().finite().min(0).max(25).nullable(), ridgeStatus: z.enum(STATUS), seenOn: z.enum(SIDES), fromShare: z.number().finite().min(0).max(1).nullable(), toShare: z.number().finite().min(0).max(1).nullable(), meets: z.string().max(8), join: z.enum(JOINS) }).strict()).max(10).optional(),
  notVolumes: z.array(z.object({ what: z.enum(NOT_VOLUMES), where: z.enum(['FRONT', 'LEFT', 'RIGHT', 'REAR']), covered: z.enum(COVERED).optional() }).strict()).max(24),
  perspectives: z.array(z.object({ n: z.number().int().min(1).max(8), corner: z.enum(CORNERS), mirrored: z.boolean() }).strict()).max(8).optional(),
  pictures: z.array(z.object({ n: z.number().int().min(1).max(12), shows: z.enum(SIDES), roofSeenAs: z.enum(['GABLE_END', 'SLOPE', 'HIP', 'FLAT']), entranceDoor: z.boolean(), garageDoor: z.boolean() }).strict()).max(12),
  dormers: z.number().int().min(0).max(20),
  chimneys: z.number().int().min(0).max(12),
  roofWindows: z.number().int().min(0).max(40),
  note: z.string().nullable().optional(),
}).strict()

export type ValueStatus = (typeof STATUS)[number]
export type FormRoofKind = (typeof ROOFS)[number]
type Wire = Omit<z.infer<typeof Raw>, 'note'>
/** The answer as the analyzer holds it: the main volume's facts together (the wire keeps them flat — a nested object came back mis-encoded from the provider). */
type RawForm = Omit<Wire, 'mainRoofKind' | 'mainRidgeAlong' | 'pitchDeg' | 'pitchStatus' | 'eavesM' | 'eavesStatus' | 'ridgeM' | 'ridgeStatus'> & { main: { roof: { kind: FormRoofKind; ridgeAlong: 'FRONT' | 'SIDE' | 'NONE' }; pitch: { deg: number | null; status: ValueStatus }; eaves: { m: number | null; status: ValueStatus }; ridge: { m: number | null; status: ValueStatus } } }
/**
 * The typed structure. `mainRoof`, `lowerParts`, `volumes`, `garageDoor`, `entrance` are the 1.0.0 names, derived from
 * the 2.0.0 answer (the arbitration's verdict and the recorded events read them).
 */
export type HouseForm = RawForm & {
  mainRoof: { kind: FormRoofKind; ridgeAlong: 'FRONT' | 'SIDE' | 'NONE'; pitchDeg: number }
  lowerParts: Array<{ what: 'GARAGE' | 'WING' | 'ANNEX'; roof: FormRoofKind; where: 'LEFT' | 'RIGHT' | 'FRONT' | 'REAR' }>
  volumes: number
  garageDoor: (typeof SIDES)[number]
  entrance: (typeof SIDES)[number]
}
/** The 1.0.0 names over a 2.0.0 answer. */
export function formOf(raw: RawForm): HouseForm {
  const sideOf = (pick: (p: RawForm['pictures'][number]) => boolean): (typeof SIDES)[number] => raw.pictures.find((p) => pick(p) && p.shows !== 'NONE')?.shows ?? 'NONE'
  return { ...raw, mainRoof: { kind: raw.main.roof.kind, ridgeAlong: raw.main.roof.ridgeAlong, pitchDeg: raw.main.pitch.deg ?? 0 }, lowerParts: raw.parts.map((p) => ({ what: p.what, roof: p.roof.kind, where: p.where })), volumes: 1 + raw.parts.length, garageDoor: sideOf((p) => p.garageDoor), entrance: sideOf((p) => p.entranceDoor) }
}
export type FormRead = { version: string; promptVersion: string; pictures: number; raw: unknown; usd: number; requestId?: string; form?: HouseForm; refused: string[]; /** form-read/3: the request as it left — every picture's exact PNG bytes with the text that introduced it (the packet a delivery shows; never logged) */ sent?: Array<{ label: string; png: Uint8Array; width: number; height: number }>; sentText?: string[]; /** v3.54.21: who answered — the transport's id (`replay`: a recorded answer, given to the pictures of ITS request, not necessarily `sent`) and the contract the answer's own shape is of (a form-read/2 answer has no `roofs`) */ answeredBy?: { transport: string; contract: 'form-read/2' | 'form-read/3' | 'NONE'; /** the answer was bought in this run (it carries the provider's token counts); a replayed recording carries none */ live: boolean; /** v3.54.21 review F6: no answer came — the transport failed or the provider refused (`contract` is then NONE; `live` says whether the refusal was billed) */ unanswered?: 'TRANSPORT_FAILED' | 'REFUSED' } }
type Ctx = { model: ConsultantModel; price: Price; spend?: ConsultSpend; signal?: AbortSignal }

const toolInput = (turn: ModelTurn, name: string): unknown => (turn.content as Array<{ type: string; name?: string; input?: unknown }>).find((b) => b.type === 'tool_use' && b.name === name)?.input

/** Flat-roofed volumes the typed form reports (its main roof, its lower parts). */
export const flatVolumesOf = (f: HouseForm): number => Number(f.mainRoof.kind === 'FLAT') + f.lowerParts.filter((p) => p.roof === 'FLAT').length

/**
 * What the typed structure says of a body's roofs, as the arbitration counts it. A body that carries MORE flat-roofed
 * volumes than the structure reports is contradicted (boxes the drawings do not show). form 2.0.0: so is a body whose
 * main roof is of ANOTHER kind than the one reported — a gable where the sheets show a hip is not "a pitched roof, as
 * reported" (1.0.0 answered AGREES there). A body with the reported kind and no such box agrees; else nothing is said.
 */
export function formVerdict(f: HouseForm, body: { flatVolumes: number; pitchedKinds: readonly string[] }): 'CONTRADICTS' | 'AGREES' | 'SILENT' {
  if (body.flatVolumes > flatVolumesOf(f)) return 'CONTRADICTS'
  if (f.mainRoof.kind === 'FLAT') return body.pitchedKinds.length === 0 ? 'AGREES' : 'CONTRADICTS'
  if (body.pitchedKinds.length === 0) return 'CONTRADICTS'
  if (f.mainRoof.kind === 'GABLE' || f.mainRoof.kind === 'HIP') return body.pitchedKinds.includes(f.mainRoof.kind) ? 'AGREES' : 'CONTRADICTS'
  return 'SILENT'
}

export type FormSheets = { /** the ground-floor plan, where the package has one */ plan?: Raster; /** a cross-section, where the package has one */ section?: Raster; /** form-read/3: perspective pictures of the finished house — a qualitative witness of how volumes and roofs relate, never a measure */ perspectives?: ReadonlyArray<{ caption: string; raster: Raster }>; /** the page's own facts, one per line (text the publisher states) */ facts?: readonly string[] }
export type RoofRegionRead = NonNullable<z.infer<typeof Raw>['roofs']>[number]

/**
 * form-read/3 — the picture the structure read is sent: the publisher's raster at its own resolution, or, above
 * `maxSide`, resampled by AREA to fit it exactly (every source pixel weighs in). The whole-factor decimation of the
 * measuring reads keeps pixel coordinates exact but drops every other row: an elevation 1480 px wide went out at 740 px,
 * with one-pixel roof and wall lines thinned to nothing. This read returns no pixel coordinate, so it keeps the detail.
 */
export function fitPicture(raster: Raster, maxSide: number): { png: Uint8Array; width: number; height: number; factor: number } {
  const side = Math.max(raster.width, raster.height)
  if (side <= maxSide) {
    const data = new Uint8ClampedArray(raster.width * raster.height * 4)
    for (let i = 0; i < raster.width * raster.height; i++) { data[i * 4] = raster.data[i * 4]; data[i * 4 + 1] = raster.data[i * 4 + 1]; data[i * 4 + 2] = raster.data[i * 4 + 2]; data[i * 4 + 3] = 255 }
    return { png: encodePng({ width: raster.width, height: raster.height, data }), width: raster.width, height: raster.height, factor: 1 }
  }
  const f = side / maxSide
  const w = Math.max(1, Math.round(raster.width / f))
  const h = Math.max(1, Math.round(raster.height / f))
  const data = new Uint8ClampedArray(w * h * 4)
  const fx = raster.width / w
  const fy = raster.height / h
  for (let y = 0; y < h; y++) {
    const y0 = y * fy
    const y1 = (y + 1) * fy
    for (let x = 0; x < w; x++) {
      const x0 = x * fx
      const x1 = (x + 1) * fx
      let r = 0, g = 0, b = 0, t = 0
      for (let sy = Math.floor(y0); sy < Math.min(raster.height, Math.ceil(y1)); sy++) {
        const wy = Math.min(y1, sy + 1) - Math.max(y0, sy)
        for (let sx = Math.floor(x0); sx < Math.min(raster.width, Math.ceil(x1)); sx++) {
          const wt = wy * (Math.min(x1, sx + 1) - Math.max(x0, sx))
          const si = (sy * raster.width + sx) * 4
          r += raster.data[si] * wt; g += raster.data[si + 1] * wt; b += raster.data[si + 2] * wt; t += wt
        }
      }
      const di = (y * w + x) * 4
      data[di] = r / t; data[di + 1] = g / t; data[di + 2] = b / t; data[di + 3] = 255
    }
  }
  return { png: encodePng({ width: w, height: h, data }), width: w, height: h, factor: Math.round(f * 1000) / 1000 }
}

export async function readForm(ctx: Ctx, pictures: ReadonlyArray<{ caption: string; raster: Raster }>, sheets: FormSheets = {}): Promise<FormRead> {
  const sent: NonNullable<FormRead['sent']> = []
  const base: { version: string; promptVersion: string; pictures: number; sent: typeof sent; sentText: string[]; answeredBy: NonNullable<FormRead['answeredBy']> } = { version: FORM_READ_VERSION, promptVersion: FORM_READ_PROMPT_VERSION, pictures: pictures.length, sent, sentText: [] as string[], answeredBy: { transport: ctx.model.id, contract: 'NONE', live: false } }
  const content: unknown[] = [{ type: 'text', text: `The sheets of one house: ${pictures.length} elevation picture(s)${sheets.plan ? ', the ground-floor plan' : ''}${sheets.section ? ', a cross-section' : ''}${(sheets.perspectives ?? []).length > 0 ? `, ${(sheets.perspectives ?? []).length} perspective picture(s)` : ''}.` }]
  const image = (r: Raster): unknown => {
    const fit = fitPicture(r, MAX_SIDE)
    const before = content[content.length - 1] as { type?: string; text?: string } | undefined
    sent.push({ label: before?.type === 'text' ? (before.text ?? '') : '', png: fit.png, width: fit.width, height: fit.height })
    return { type: 'image', source: { type: 'base64', media_type: 'image/png', data: Buffer.from(fit.png).toString('base64') } }
  }
  pictures.forEach((p, i) => { content.push({ type: 'text', text: `Elevation picture ${i + 1}, the publisher's caption: ${p.caption}` }); content.push(image(p.raster)) })
  if (sheets.plan) { content.push({ type: 'text', text: 'The ground-floor plan (the publisher draws the front of the house at the foot of the sheet unless the sheet marks the entrance elsewhere):' }); content.push(image(sheets.plan)) }
  if (sheets.section) { content.push({ type: 'text', text: 'A cross-section:' }); content.push(image(sheets.section)) }
  ;(sheets.perspectives ?? []).forEach((q, i) => { content.push({ type: 'text', text: `Perspective picture P${i + 1} (${q.caption}; a rendering, NOT to scale):` }); content.push(image(q.raster)) })
  if (sheets.facts && sheets.facts.length > 0) content.push({ type: 'text', text: `Facts the page states:\n${sheets.facts.join('\n')}` })
  base.sentText = content.filter((c) => (c as { type: string }).type === 'text').map((c) => (c as { text: string }).text)
  const sheetsN = pictures.length + Number(!!sheets.plan) + Number(!!sheets.section) + (sheets.perspectives ?? []).length
  const reserveUsd = reserveOf(ctx.price, Math.ceil((FORM_READ_SYSTEM.length + JSON.stringify(TOOL).length + 600) / 2.5) + 2600 * Math.max(1, sheetsN), Math.min(ctx.model.maxOutputTokens, 2800), ctx.model.cache)
  const reservation = ctx.spend?.reserve(ctx.model.model, reserveUsd, `structure read (${sheetsN} sheets)`)
  let turn: ModelTurn
  let usd = 0
  try {
    turn = await ctx.model.send({ system: FORM_READ_SYSTEM, messages: [{ role: 'user', content }], tools: [TOOL], ...(ctx.signal ? { signal: ctx.signal } : {}) })
    const settled = settledOf(ctx.price, turn.usage)
    usd = settled.usd
    if (reservation) ctx.spend?.settle(reservation, settled)
  } catch (e) {
    const reason = e instanceof ConsultantUnavailable ? e.reason : 'TRANSPORT'
    if (reservation) ctx.spend?.settle(reservation, reason === 'NO_CREDENTIALS' || reason === 'REJECTED_UNBILLED' || reason === 'BUDGET' ? 'NOT_SENT' : { usd: reserveUsd, inputTokens: 0, outputTokens: 0 }, reason)
    return { ...base, answeredBy: { ...base.answeredBy, unanswered: 'TRANSPORT_FAILED' }, raw: null, usd: 0, refused: [`${reason}: ${(e as Error).message.slice(0, 200)}`] }
  }
  const raw = toolInput(turn, TOOL.name)
  const rid = turn.requestId ? { requestId: turn.requestId } : {}
  const live = (turn.usage?.inputTokens ?? 0) + (turn.usage?.outputTokens ?? 0) > 0
  if (turn.stopReason === 'refusal') return { ...base, answeredBy: { transport: ctx.model.id, contract: 'NONE', live, unanswered: 'REFUSED' }, raw, usd, ...rid, refused: ['REFUSED: the provider refused the answer'] }
  base.answeredBy = { transport: ctx.model.id, contract: raw && typeof raw === 'object' && Array.isArray((raw as { roofs?: unknown }).roofs) ? 'form-read/3' : 'form-read/2', live }
  return { ...base, usd, ...rid, ...parseForm(raw, pictures.length) }
}

/** The typed answer checked against its own contract: a value and its status, a roof and its ridge, a picture and its number. */
export function parseForm(raw: unknown, pictures: number): { raw: unknown; form?: HouseForm; refused: string[] } {
  // a nested value sent as its own JSON text (seen without strict tools) is the same answer in another encoding
  const decoded = raw && typeof raw === 'object' && !Array.isArray(raw) ? Object.fromEntries(Object.entries(raw as Record<string, unknown>).map(([k, v]) => { if (typeof v !== 'string' || !/^\s*[[{]/.test(v)) return [k, v]; try { return [k, JSON.parse(v) as unknown] } catch { return [k, v] } })) : raw
  const p = Raw.safeParse(decoded)
  if (!p.success) return { raw, refused: [`NO_TOOL_CALL or malformed: ${p.error.issues[0]?.path.join('.')} ${p.error.issues[0]?.message}`] }
  const { note: _note, mainRoofKind, mainRidgeAlong, pitchDeg, pitchStatus, eavesM, eavesStatus, ridgeM, ridgeStatus, ...rest } = p.data
  void _note
  const r: RawForm = { ...rest, main: { roof: { kind: mainRoofKind, ridgeAlong: mainRidgeAlong }, pitch: { deg: pitchDeg, status: pitchStatus }, eaves: { m: eavesM, status: eavesStatus }, ridge: { m: ridgeM, status: ridgeStatus } } }
  // a flat roof has no ridge; a pitched one has one — an answer that says otherwise is not a reading of the sheets
  for (const [name, roof] of [['main', r.main.roof] as const, ...r.parts.map((q, i) => [`part ${i + 1}`, q.roof] as const)]) if ((roof.kind === 'FLAT') !== (roof.ridgeAlong === 'NONE')) return { raw, refused: [`the answer contradicts itself: a ${roof.kind} ${name} roof with ridgeAlong ${roof.ridgeAlong}`] }
  // a number and its status go together: UNKNOWN has no number, anything else has one
  for (const [name, v, st] of [['pitch', r.main.pitch.deg, r.main.pitch.status], ['eaves', r.main.eaves.m, r.main.eaves.status], ['ridge', r.main.ridge.m, r.main.ridge.status]] as const) if ((st === 'UNKNOWN') !== (v === null)) return { raw, refused: [`the answer contradicts itself: ${name} ${v === null ? 'without a number' : v} with status ${st}`] }
  if (r.main.eaves.m !== null && r.main.ridge.m !== null && r.main.roof.kind !== 'FLAT' && r.main.ridge.m <= r.main.eaves.m) return { raw, refused: [`the answer contradicts itself: the ridge (${r.main.ridge.m} m) is not above the eaves (${r.main.eaves.m} m)`] }
  // form-read/3: a roof region and its own numbers — the same consistency as the main roof's, and its references hold
  for (const q of r.roofs ?? []) {
    if ((q.kind === 'FLAT') !== (q.ridgeAlong === 'NONE')) return { raw, refused: [`the answer contradicts itself: a ${q.kind} roof ${q.id} with ridgeAlong ${q.ridgeAlong}`] }
    for (const [name, v, st] of [['pitch', q.pitchDeg, q.pitchStatus], ['eaves', q.eavesM, q.eavesStatus], ['ridge', q.ridgeM, q.ridgeStatus]] as const) if ((st === 'UNKNOWN') !== (v === null)) return { raw, refused: [`the answer contradicts itself: roof ${q.id} ${name} ${v === null ? 'without a number' : v} with status ${st}`] }
    if (q.of === 'PART' && (q.part === null || q.part > r.parts.length)) return { raw, refused: [`roof ${q.id} is the roof of part ${q.part}, and ${r.parts.length} part(s) are listed`] }
    if (q.meets !== 'NONE' && q.meets !== '' && !(r.roofs ?? []).some((o) => o.id === q.meets && o.id !== q.id)) return { raw, refused: [`roof ${q.id} meets ${q.meets}, which is not a roof of this answer`] }
    if (q.fromShare !== null && q.toShare !== null && q.toShare <= q.fromShare) return { raw, refused: [`roof ${q.id} stands from ${q.fromShare} to ${q.toShare} of the width`] }
  }
  if (new Set((r.roofs ?? []).map((q) => q.id)).size !== (r.roofs ?? []).length) return { raw, refused: ['the answer names a roof region twice'] }
  if (r.pictures.some((q) => q.n > pictures) || new Set(r.pictures.map((q) => q.n)).size !== r.pictures.length) return { raw, refused: [`the answer names pictures that were not given, or one twice (${r.pictures.map((q) => q.n).join(', ')} of ${pictures})`] }
  return { raw, form: formOf(r), refused: [] }
}
