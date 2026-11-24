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
import { pictureOf } from './metric-read.js'

export const FORM_READ_VERSION = '2.0.0' as const
export const FORM_READ_PROMPT_VERSION = 'form-read/2' as const

const ROOFS = ['GABLE', 'HIP', 'FLAT', 'SHED', 'MANSARD', 'OTHER'] as const
const SIDES = ['FRONT', 'LEFT', 'RIGHT', 'REAR', 'NONE'] as const
const STATUS = ['PRINTED', 'DERIVED', 'ESTIMATED', 'UNKNOWN'] as const
const NOT_VOLUMES = ['RECESS', 'PORCH', 'BAY', 'DORMER', 'BALCONY', 'CANOPY', 'CARPORT', 'TERRACE'] as const

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
export const FORM_READ_SYSTEM = `You are given the sheets of ONE house project: its orthographic elevations (numbered, each with the publisher's caption), then where available its ground-floor plan and a cross-section, and the facts the page states as text. Report the STRUCTURE of the house as typed facts the sheets agree on. Do not describe it in prose and do not guess what no sheet shows.
LEFT and RIGHT always mean the left and right of a person standing OUTSIDE in front of the house, looking at the FRONT elevation. Use the plan to tell which side elevation is which.
"storeys": ONE (ground floor only, the roof space not lived in), ONE_WITH_ATTIC (ground floor and rooms in the roof: windows in the gables, roof windows or dormers; the eaves about one storey high), TWO (two FULL storeys of walls under the eaves), TWO_WITH_ATTIC. "storeysBasis": the sheet that settles it (SECTION, ELEVATIONS, PLANS).
The MAIN volume: "mainRoofKind": GABLE (two slopes and two gable walls that rise to the ridge), HIP (slopes on all four sides, no gable wall), FLAT, SHED (one slope), MANSARD, OTHER. "mainRidgeAlong": FRONT when the main ridge runs parallel to the front elevation (the front shows a roof slope), SIDE when it runs front-to-back (the front shows a gable wall or, for a hip, the short hip slope), NONE for a flat roof. "pitchDeg", "eavesM", "ridgeM": the main roof's pitch in degrees, the height of the top of the walls under the eaves, and the height of the ridge, the two heights in metres ABOVE THE GROUND FLOOR'S FLOOR LEVEL (the section's ±0.00); each with its own status ("pitchStatus", "eavesStatus", "ridgeStatus"): PRINTED (a sheet or the page prints this number), DERIVED (computed from printed numbers), ESTIMATED (by eye from proportions), UNKNOWN (then the value is null).
"parts": every OTHER volume standing under its OWN roof (a lower garage, a wing, an annex): what it is, "where" it stands relative to the main volume as seen from the front (LEFT, RIGHT, FRONT for one projecting forward, REAR), its own storeys (ONE or TWO), its roof kind and ridgeAlong, and "lowerThanMain". A part of the house under the MAIN roof is not a part.
"notVolumes": things that are NOT volumes and must not be built as boxes: RECESS (a wall set back, an entrance niche), PORCH, BAY, DORMER, BALCONY, CANOPY, CARPORT, TERRACE (roofed or not), each with the side it is on.
"pictures": one entry for EVERY elevation picture, by its number: "shows" the side of the house it shows (FRONT, REAR, LEFT, RIGHT, or NONE if it cannot be told), "roofSeenAs" what the MAIN roof looks like on it (GABLE_END: a gable wall rising to the ridge; SLOPE: a roof slope with a level ridge as long as the eaves; HIP: a slope narrowing to a short ridge or a point; FLAT), and whether it shows the main entrance door and a garage door.
"dormers", "chimneys", "roofWindows": counts over the whole house (a chimney seen on several elevations is one chimney).`

const TOOL = {
  name: 'report_structure',
  description: 'Report the structure of the house as typed facts.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['storeys', 'storeysBasis', 'mainRoofKind', 'mainRidgeAlong', 'pitchDeg', 'pitchStatus', 'eavesM', 'eavesStatus', 'ridgeM', 'ridgeStatus', 'parts', 'notVolumes', 'pictures', 'dormers', 'chimneys', 'roofWindows'],
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
      notVolumes: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['what', 'where'], properties: { what: { type: 'string', enum: NOT_VOLUMES }, where: { type: 'string', enum: ['FRONT', 'LEFT', 'RIGHT', 'REAR'] } } } },
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
  notVolumes: z.array(z.object({ what: z.enum(NOT_VOLUMES), where: z.enum(['FRONT', 'LEFT', 'RIGHT', 'REAR']) }).strict()).max(24),
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
export type FormRead = { version: string; promptVersion: string; pictures: number; raw: unknown; usd: number; requestId?: string; form?: HouseForm; refused: string[] }
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

export type FormSheets = { /** the ground-floor plan, where the package has one */ plan?: Raster; /** a cross-section, where the package has one */ section?: Raster; /** the page's own facts, one per line (text the publisher states) */ facts?: readonly string[] }

export async function readForm(ctx: Ctx, pictures: ReadonlyArray<{ caption: string; raster: Raster }>, sheets: FormSheets = {}): Promise<FormRead> {
  const base = { version: FORM_READ_VERSION, promptVersion: FORM_READ_PROMPT_VERSION, pictures: pictures.length }
  const content: unknown[] = [{ type: 'text', text: `The sheets of one house: ${pictures.length} elevation picture(s)${sheets.plan ? ', the ground-floor plan' : ''}${sheets.section ? ', a cross-section' : ''}.` }]
  const image = (r: Raster): unknown => ({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: Buffer.from(pictureOf(r).png).toString('base64') } })
  pictures.forEach((p, i) => content.push({ type: 'text', text: `Elevation picture ${i + 1}, the publisher's caption: ${p.caption}` }, image(p.raster)))
  if (sheets.plan) content.push({ type: 'text', text: 'The ground-floor plan (the publisher draws the front of the house at the foot of the sheet unless the sheet marks the entrance elsewhere):' }, image(sheets.plan))
  if (sheets.section) content.push({ type: 'text', text: 'A cross-section:' }, image(sheets.section))
  if (sheets.facts && sheets.facts.length > 0) content.push({ type: 'text', text: `Facts the page states:\n${sheets.facts.join('\n')}` })
  const sheetsN = pictures.length + Number(!!sheets.plan) + Number(!!sheets.section)
  const reserveUsd = reserveOf(ctx.price, Math.ceil((FORM_READ_SYSTEM.length + JSON.stringify(TOOL).length + 600) / 2.5) + 2600 * Math.max(1, sheetsN), Math.min(ctx.model.maxOutputTokens, 1600), ctx.model.cache)
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
    return { ...base, raw: null, usd: 0, refused: [`${reason}: ${(e as Error).message.slice(0, 200)}`] }
  }
  const raw = toolInput(turn, TOOL.name)
  const rid = turn.requestId ? { requestId: turn.requestId } : {}
  if (turn.stopReason === 'refusal') return { ...base, raw, usd, ...rid, refused: ['REFUSED: the provider refused the answer'] }
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
  if (r.pictures.some((q) => q.n > pictures) || new Set(r.pictures.map((q) => q.n)).size !== r.pictures.length) return { raw, refused: [`the answer names pictures that were not given, or one twice (${r.pictures.map((q) => q.n).join(', ')} of ${pictures})`] }
  return { raw, form: formOf(r), refused: [] }
}
