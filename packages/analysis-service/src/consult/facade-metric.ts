/**
 * v3.54.19 — an elevation's wall openings as a typed list IN METRES: one request, told the facade's width (which the plan
 * gives), answering each opening's distance from the walls' left corner, its width, sill and height, and its storey.
 *
 * Why a second way of reading the same picture: the contour reading states every element as a polygon in the picture's
 * pixels, and everything read from it then passes a registration (wall ends, ground row, eaves) and a contrast gate. An
 * opening the contour reading missed, or one its registration could not place, is lost although the picture shows it. A
 * list in metres along a facade of known width needs neither: a position along the wall is a number that can be held
 * directly against the PLAN's gap in that wall. Measured on this stage's houses (`research/…/v35419/read-compare.ts`): held
 * against the plan's gaps, this list matched as many openings as the contour reading on every elevation and more on some.
 *
 * It is used for ONE thing: a gap the ground-floor plan draws in an exterior wall, which the model still has no opening
 * in, is filled when this reading independently puts an opening on that stretch (ADD_PLAN_OPENING) — the plan gives the
 * span, this reading the kind, the sill and the height. Never source-verified; never used without the plan's gap.
 */
import { z } from 'zod'
import type { Raster } from '@buildapp/source-cv'
import { ConsultantUnavailable, settledOf } from './loop.js'
import type { ConsultSpend, ConsultantModel, ModelTurn, Price } from './loop.js'
import { reserveOf } from './cost.js'
import { pictureOf } from './metric-read.js'

export const FACADE_METRIC_VERSION = '1.0.0' as const
export const FACADE_METRIC_PROMPT_VERSION = 'facade-metric/1' as const

export const FACADE_METRIC_SYSTEM = `You list the wall openings of one orthographic elevation of a house IN METRES. The total width of the building's walls on this elevation (outer corner to outer corner at ground level, without roof overhangs) is given to you: use it as the scale.
List EVERY opening in the walls — windows, entrance doors, glazed (terrace or balcony) doors, garage doors — each with: its kind; "leftM", the distance of its left edge from the walls' left outer corner as the picture shows it; "widthM"; "sillM", the height of its lower edge above the ground-floor level (0 for a door); "heightM"; "storey": GROUND for an opening of the ground floor, UPPER for one above it (an attic or first-floor window, a window in a gable).
Roof windows lying in the roof slope are not wall openings: leave them out. Do not invent an opening hidden behind something; do not merge two openings into one; do not list a recess, a canopy or a cladding panel as an opening.`

const KINDS = ['WINDOW', 'DOOR', 'GLAZED_DOOR', 'GARAGE_DOOR'] as const
const TOOL = {
  name: 'report_facade_openings',
  description: 'Report the wall openings of this elevation in metres.',
  input_schema: { type: 'object', additionalProperties: false, required: ['openings'], properties: { openings: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['kind', 'leftM', 'widthM', 'sillM', 'heightM', 'storey'], properties: { kind: { type: 'string', enum: KINDS }, leftM: { type: 'number' }, widthM: { type: 'number' }, sillM: { type: 'number' }, heightM: { type: 'number' }, storey: { type: 'string', enum: ['GROUND', 'UPPER'] } } } }, note: { type: 'string' } } },
} as const
const Raw = z.object({ openings: z.array(z.object({ kind: z.enum(KINDS), leftM: z.number().finite(), widthM: z.number().finite(), sillM: z.number().finite(), heightM: z.number().finite(), storey: z.enum(['GROUND', 'UPPER']) }).strict()), note: z.string().nullable().optional() }).strict()

export type FacadeMetricOpening = { kind: (typeof KINDS)[number]; leftM: number; widthM: number; sillM: number; heightM: number; storey: 'GROUND' | 'UPPER' }
export type FacadeMetricRead = { version: string; promptVersion: string; frameId: string; widthM: number; raw: unknown; usd: number; requestId?: string; openings: FacadeMetricOpening[]; refused: string[] }
type Ctx = { model: ConsultantModel; price: Price; spend?: ConsultSpend; signal?: AbortSignal }

/** What an opening of a kind can be (metres): outside it, the item is not taken (named). */
export function plausibleOpening(o: FacadeMetricOpening, facadeWidthM: number): string | undefined {
  if (!(o.widthM >= 0.3) || o.leftM < -0.1 || o.leftM + o.widthM > facadeWidthM + 0.1) return `spans ${o.leftM.toFixed(2)}..${(o.leftM + o.widthM).toFixed(2)} m of a ${facadeWidthM.toFixed(2)} m facade`
  if (o.kind === 'WINDOW') return o.sillM >= 0 && o.sillM <= 2.2 && o.heightM >= 0.3 && o.heightM <= 2.8 ? undefined : `a window with sill ${o.sillM} m and height ${o.heightM} m`
  if (o.kind === 'GARAGE_DOOR') return o.sillM <= 0.25 && o.heightM >= 1.8 && o.heightM <= 3.3 && o.widthM >= 2 ? undefined : `a garage door ${o.widthM} × ${o.heightM} m, sill ${o.sillM} m`
  return o.sillM <= 0.3 && o.heightM >= 1.8 && o.heightM <= 3 ? undefined : `a door ${o.heightM} m high with its foot at ${o.sillM} m`
}

const toolInput = (turn: ModelTurn, name: string): unknown => (turn.content as Array<{ type: string; name?: string; input?: unknown }>).find((b) => b.type === 'tool_use' && b.name === name)?.input

export async function readFacadeMetric(ctx: Ctx, f: { frameId: string; raster: Raster; side: string; widthM: number; caption: string }): Promise<FacadeMetricRead> {
  const base = { version: FACADE_METRIC_VERSION, promptVersion: FACADE_METRIC_PROMPT_VERSION, frameId: f.frameId, widthM: f.widthM }
  const pic = pictureOf(f.raster)
  const content = [
    { type: 'text', text: `The ${f.side.toLowerCase()} elevation of a house — "${f.caption}". The building's walls on this elevation are ${f.widthM.toFixed(2)} m wide, outer corner to outer corner. The picture is ${pic.width} × ${pic.height} px.` },
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: Buffer.from(pic.png).toString('base64') } },
  ]
  const reserveUsd = reserveOf(ctx.price, Math.ceil((FACADE_METRIC_SYSTEM.length + JSON.stringify(TOOL).length + 300) / 2.5) + 2600, Math.min(ctx.model.maxOutputTokens, 2500), ctx.model.cache)
  const reservation = ctx.spend?.reserve(ctx.model.model, reserveUsd, `facade metric ${f.frameId}`)
  let turn: ModelTurn
  let usd = 0
  try {
    turn = await ctx.model.send({ system: FACADE_METRIC_SYSTEM, messages: [{ role: 'user', content }], tools: [TOOL], ...(ctx.signal ? { signal: ctx.signal } : {}) })
    const settled = settledOf(ctx.price, turn.usage)
    usd = settled.usd
    if (reservation) ctx.spend?.settle(reservation, settled)
  } catch (e) {
    const reason = e instanceof ConsultantUnavailable ? e.reason : 'TRANSPORT'
    if (reservation) ctx.spend?.settle(reservation, reason === 'NO_CREDENTIALS' || reason === 'REJECTED_UNBILLED' || reason === 'BUDGET' ? 'NOT_SENT' : { usd: reserveUsd, inputTokens: 0, outputTokens: 0 }, reason)
    return { ...base, raw: null, usd: 0, openings: [], refused: [`${reason}: ${(e as Error).message.slice(0, 200)}`] }
  }
  const raw = toolInput(turn, TOOL.name)
  const rid = turn.requestId ? { requestId: turn.requestId } : {}
  if (turn.stopReason === 'refusal') return { ...base, raw, usd, ...rid, openings: [], refused: ['REFUSED: the provider refused the answer'] }
  const p = Raw.safeParse(raw)
  if (!p.success) return { ...base, raw, usd, ...rid, openings: [], refused: [`NO_TOOL_CALL or malformed: ${p.error.issues[0]?.path.join('.')} ${p.error.issues[0]?.message}`] }
  const refused: string[] = []
  const openings = p.data.openings.filter((o, i) => { const why = plausibleOpening(o, f.widthM); if (why) refused.push(`item ${i}: ${why}: not taken`); return !why })
  return { ...base, raw, usd, ...rid, openings, refused }
}
