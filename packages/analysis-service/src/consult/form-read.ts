/**
 * v3.54.19 — the FORM of the house as one typed answer from all its captioned elevations in one request: storeys, how
 * many volumes stand under their own roofs, the main roof's kind and ridge direction, the lower parts with their roofs.
 *
 * Why: the contour reading states each elevation as polygons, and the body is then solved from silhouettes one view at a
 * time — what kind of roof the house has, and whether a front strip is a part of the house or a box of its own, is never
 * asked of the pictures as a whole. Measured on thirteen houses of this stage (`research/…/v35419/form-read.ts`): this
 * answer named the main roof's kind and its ridge direction as the drawings show them on every one, where the delivered
 * models had flat-roofed boxes beside a gable on three and two steep gables for a low hip on a fourth.
 *
 * It is used as a WITNESS, never as a builder: in the body arbitration, a LOCAL body that carries flat-roofed volumes the
 * typed answer does not report is contradicted by it (and the other body, built from the plan outline and the elevations
 * by the same solver as before, must then stand uncontradicted by everything — this answer included). No dimension is
 * taken from it.
 */
import { z } from 'zod'
import type { Raster } from '@buildapp/source-cv'
import { ConsultantUnavailable, settledOf } from './loop.js'
import type { ConsultSpend, ConsultantModel, ModelTurn, Price } from './loop.js'
import { reserveOf } from './cost.js'
import { pictureOf } from './metric-read.js'

export const FORM_READ_VERSION = '1.0.0' as const
export const FORM_READ_PROMPT_VERSION = 'form-read/1' as const

const ROOFS = ['GABLE', 'HIP', 'FLAT', 'SHED', 'MANSARD', 'OTHER'] as const
const SIDES = ['FRONT', 'LEFT', 'RIGHT', 'REAR', 'NONE'] as const

export const FORM_READ_SYSTEM = `You are given the orthographic elevations of ONE house (each captioned with the side it shows). Report the FORM of the house as typed facts. Do not describe it in prose and do not guess what no elevation shows.
"storeys": ONE (ground floor only, the roof space not lived in), ONE_WITH_ATTIC (ground floor and rooms in the roof: windows in the gables, roof windows or dormers), TWO (two full storeys under the eaves), TWO_WITH_ATTIC.
"volumes": how many separate volumes stand under their OWN roofs (the main house is one; a lower garage or wing with its own roof is another; a porch canopy or a dormer is NOT a volume).
"mainRoof": the roof of the main volume: its kind (GABLE: two slopes and two gable walls; HIP: slopes on all four sides; FLAT; SHED: one slope; MANSARD; OTHER), "ridgeAlong": FRONT when the ridge runs parallel to the front elevation (the front shows a roof slope), SIDE when it runs front to back (the front shows a gable), NONE for a flat roof; "pitchDeg": the slope's angle as the gable-end elevation draws it (0 if flat).
"lowerParts": each lower volume or attached part with its own roof: what it is (GARAGE, WING, ANNEX), its roof kind, and where it stands as seen on the front elevation (LEFT, RIGHT, FRONT for one projecting forward, REAR).
"dormers", "chimneys", "roofWindows": counts over the whole house (a chimney seen on several elevations is one chimney).
"garageDoor" and "entrance": the side whose elevation shows the garage door / the main entrance door (NONE if no elevation shows one).`

const TOOL = {
  name: 'report_form',
  description: 'Report the form of the house as typed facts.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['storeys', 'volumes', 'mainRoof', 'lowerParts', 'dormers', 'chimneys', 'roofWindows', 'garageDoor', 'entrance'],
    properties: {
      storeys: { type: 'string', enum: ['ONE', 'ONE_WITH_ATTIC', 'TWO', 'TWO_WITH_ATTIC'] },
      volumes: { type: 'integer' },
      mainRoof: { type: 'object', additionalProperties: false, required: ['kind', 'ridgeAlong', 'pitchDeg'], properties: { kind: { type: 'string', enum: ROOFS }, ridgeAlong: { type: 'string', enum: ['FRONT', 'SIDE', 'NONE'] }, pitchDeg: { type: 'number' } } },
      lowerParts: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['what', 'roof', 'where'], properties: { what: { type: 'string', enum: ['GARAGE', 'WING', 'ANNEX'] }, roof: { type: 'string', enum: ROOFS }, where: { type: 'string', enum: ['LEFT', 'RIGHT', 'FRONT', 'REAR'] } } } },
      dormers: { type: 'integer' },
      chimneys: { type: 'integer' },
      roofWindows: { type: 'integer' },
      garageDoor: { type: 'string', enum: SIDES },
      entrance: { type: 'string', enum: SIDES },
      note: { type: 'string' },
    },
  },
} as const

const Raw = z.object({
  storeys: z.enum(['ONE', 'ONE_WITH_ATTIC', 'TWO', 'TWO_WITH_ATTIC']),
  volumes: z.number().int().min(1).max(8),
  mainRoof: z.object({ kind: z.enum(ROOFS), ridgeAlong: z.enum(['FRONT', 'SIDE', 'NONE']), pitchDeg: z.number().finite().min(0).max(80) }).strict(),
  lowerParts: z.array(z.object({ what: z.enum(['GARAGE', 'WING', 'ANNEX']), roof: z.enum(ROOFS), where: z.enum(['LEFT', 'RIGHT', 'FRONT', 'REAR']) }).strict()).max(6),
  dormers: z.number().int().min(0).max(20),
  chimneys: z.number().int().min(0).max(12),
  roofWindows: z.number().int().min(0).max(40),
  garageDoor: z.enum(SIDES),
  entrance: z.enum(SIDES),
  note: z.string().nullable().optional(),
}).strict()

export type HouseForm = Omit<z.infer<typeof Raw>, 'note'>
export type FormRead = { version: string; promptVersion: string; pictures: number; raw: unknown; usd: number; requestId?: string; form?: HouseForm; refused: string[] }
type Ctx = { model: ConsultantModel; price: Price; spend?: ConsultSpend; signal?: AbortSignal }

const toolInput = (turn: ModelTurn, name: string): unknown => (turn.content as Array<{ type: string; name?: string; input?: unknown }>).find((b) => b.type === 'tool_use' && b.name === name)?.input

/** Flat-roofed volumes the typed form reports (its main roof, its lower parts). */
export const flatVolumesOf = (f: HouseForm): number => Number(f.mainRoof.kind === 'FLAT') + f.lowerParts.filter((p) => p.roof === 'FLAT').length

/**
 * What the typed form says of a body's roofs, as the arbitration counts it: a body that carries MORE flat-roofed volumes
 * than the form reports is contradicted (boxes the drawings do not show); a body whose main roof is of the form's kind
 * and carries no such box agrees. Anything else is not said (a hip the form calls a gable is the solver's own business).
 */
export function formVerdict(f: HouseForm, body: { flatVolumes: number; pitchedKinds: readonly string[] }): 'CONTRADICTS' | 'AGREES' | 'SILENT' {
  if (body.flatVolumes > flatVolumesOf(f)) return 'CONTRADICTS'
  if (f.mainRoof.kind === 'FLAT') return body.pitchedKinds.length === 0 ? 'AGREES' : 'SILENT'
  return body.pitchedKinds.length > 0 ? 'AGREES' : 'SILENT'
}

export async function readForm(ctx: Ctx, pictures: ReadonlyArray<{ caption: string; raster: Raster }>): Promise<FormRead> {
  const base = { version: FORM_READ_VERSION, promptVersion: FORM_READ_PROMPT_VERSION, pictures: pictures.length }
  const content: unknown[] = [{ type: 'text', text: `The elevations of one house (${pictures.length} picture(s)).` }]
  for (const p of pictures) {
    const pic = pictureOf(p.raster)
    content.push({ type: 'text', text: `Elevation captioned ${p.caption}:` }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: Buffer.from(pic.png).toString('base64') } })
  }
  const reserveUsd = reserveOf(ctx.price, Math.ceil((FORM_READ_SYSTEM.length + JSON.stringify(TOOL).length + 300) / 2.5) + 2600 * Math.max(1, pictures.length), Math.min(ctx.model.maxOutputTokens, 1200), ctx.model.cache)
  const reservation = ctx.spend?.reserve(ctx.model.model, reserveUsd, `form read (${pictures.length} elevations)`)
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
  const p = Raw.safeParse(raw)
  if (!p.success) return { ...base, raw, usd, ...rid, refused: [`NO_TOOL_CALL or malformed: ${p.error.issues[0]?.path.join('.')} ${p.error.issues[0]?.message}`] }
  const { note: _note, ...form } = p.data
  void _note
  // a flat main roof has no ridge; a pitched one has one — an answer that says otherwise is not a reading of the pictures
  if ((form.mainRoof.kind === 'FLAT') !== (form.mainRoof.ridgeAlong === 'NONE')) return { ...base, raw, usd, ...rid, refused: [`the answer contradicts itself: a ${form.mainRoof.kind} main roof with ridgeAlong ${form.mainRoof.ridgeAlong}`] }
  return { ...base, raw, usd, ...rid, form, refused: [] }
}
