/**
 * v3.54.19 — the building's overall dimensions as the SITE PLAN prints them: one small request, a typed answer of two
 * numbers with their printed text. Not a sketch, not a description: a publisher's site plan ("usytuowanie na działce")
 * draws the building as one outline with its two outer dimensions and the plot's margins around it, and for a plan sheet
 * that carries no dimension line of its own these two printed numbers are the only metric statement about the plan.
 *
 * What is done with them is not decided here: `outlineScale` takes them as two lengths over the two extents of the traced
 * outline and accepts them only when both give the same scale (3 %) — a wrong read, a roof outline instead of the walls,
 * or a site plan drawn turned against the floor plan fails that agreement and is named, never used.
 *
 * Asked only when the plan has no scale of its own and the page states no length and width: a house LOCAL measured needs
 * no site plan.
 */
import { z } from 'zod'
import type { Raster } from '@buildapp/source-cv'
import { ConsultantUnavailable, reserveOrUnavailable, settledOf } from './loop.js'
import type { ConsultSpend, ConsultantModel, ModelTurn, Price } from './loop.js'
import { reserveOf } from './cost.js'
import { pictureOf } from './metric-read.js'

export const SITE_DIMENSIONS_VERSION = '1.0.0' as const
export const SITE_DIMENSIONS_PROMPT_VERSION = 'site-dimensions/1' as const

export const SITE_DIMENSIONS_SYSTEM = `You read printed dimensions on the site plan of a house project. You do not measure and you do not estimate.
The picture shows a plot with a building on it and dimension lines. Report the two overall OUTER dimensions of the BUILDING itself that are PRINTED on the picture: its extent along the picture's horizontal axis ("horizontal") and along the picture's vertical axis ("vertical"). Each is one printed number on a dimension line that spans the whole building in that direction.
Do NOT report the plot's dimensions, the distances from the building to the plot's edges, or a sum that includes them. If a chain prints the margins and the building as separate numbers (for example 4,0 | 17,7 | 4,0 with 25,7 below), the building is the middle number.
Give each as the text exactly as printed and its value in metres (a number printed in centimetres such as 1228 is 12.28 m). If a dimension of the building is not printed, leave it out: do not derive it.`

const TOOL = {
  name: 'report_site_dimensions',
  description: 'Report the building\'s two overall outer dimensions printed on the site plan.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: [],
    properties: {
      horizontal: { type: 'object', additionalProperties: false, required: ['literal', 'valueM'], properties: { literal: { type: 'string' }, valueM: { type: 'number' } } },
      vertical: { type: 'object', additionalProperties: false, required: ['literal', 'valueM'], properties: { literal: { type: 'string' }, valueM: { type: 'number' } } },
      note: { type: 'string' },
    },
  },
} as const

const Dim = z.object({ literal: z.string().min(1).max(40), valueM: z.number().finite() }).strict()
const Raw = z.object({ horizontal: Dim.nullable().optional(), vertical: Dim.nullable().optional(), note: z.string().nullable().optional() }).strict()

type Ctx = { model: ConsultantModel; price: Price; spend?: ConsultSpend; signal?: AbortSignal }
export type SiteDimensionsRead = { version: string; promptVersion: string; frameId: string; raw: unknown; usd: number; requestId?: string; horizontalM?: number; verticalM?: number; literals?: { horizontal?: string; vertical?: string }; refused: string[] }

const toolInput = (turn: ModelTurn, name: string): unknown => (turn.content as Array<{ type: string; name?: string; input?: unknown }>).find((b) => b.type === 'tool_use' && b.name === name)?.input

/** The number a printed literal states, in metres: the literal is parsed again (a value that does not follow from its own text is not taken). */
export function literalMetres(literal: string): number | undefined {
  const t = literal.replace(/\s+/g, '').replace(/m$/i, '').replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(t)) return undefined
  const v = Number(t)
  // a whole number of three or four digits is centimetres; a decimal or a small number is metres
  if (/^\d{3,4}$/.test(t)) return v / 100
  return v
}

export async function readSiteDimensions(ctx: Ctx, f: { frameId: string; raster: Raster; caption: string }): Promise<SiteDimensionsRead> {
  const base = { version: SITE_DIMENSIONS_VERSION, promptVersion: SITE_DIMENSIONS_PROMPT_VERSION, frameId: f.frameId }
  const pic = pictureOf(f.raster)
  const content = [
    { type: 'text', text: `The site plan of a house project — "${f.caption}". The picture is ${pic.width} × ${pic.height} px.` },
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: Buffer.from(pic.png).toString('base64') } },
  ]
  const reserveUsd = reserveOf(ctx.price, Math.ceil((SITE_DIMENSIONS_SYSTEM.length + JSON.stringify(TOOL).length + 200) / 2.5) + 2600, Math.min(ctx.model.maxOutputTokens, 600), ctx.model.cache)
  let reservation: { id: string; usd: number } | undefined
  let turn: ModelTurn
  let usd = 0
  try {
    reservation = reserveOrUnavailable(ctx.spend, ctx.model.model, reserveUsd, `site dimensions ${f.frameId}`)
    turn = await ctx.model.send({ system: SITE_DIMENSIONS_SYSTEM, messages: [{ role: 'user', content }], tools: [TOOL], ...(ctx.signal ? { signal: ctx.signal } : {}) })
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
  const refused: string[] = []
  const take = (axis: 'horizontal' | 'vertical'): number | undefined => {
    const d = p.data[axis]
    if (!d) return undefined
    const own = literalMetres(d.literal)
    if (own === undefined) { refused.push(`${axis}: "${d.literal}" is not a printed length`); return undefined }
    if (Math.abs(own - d.valueM) > 0.011) { refused.push(`${axis}: the value given (${d.valueM} m) does not follow from the printed text "${d.literal}" (${own} m)`); return undefined }
    if (own < 3 || own > 60) { refused.push(`${axis}: ${own} m is not a house's overall dimension`); return undefined }
    return own
  }
  const [h, v] = [take('horizontal'), take('vertical')]
  return { ...base, raw, usd, ...rid, ...(h !== undefined ? { horizontalM: h } : {}), ...(v !== undefined ? { verticalM: v } : {}), literals: { ...(p.data.horizontal ? { horizontal: p.data.horizontal.literal } : {}), ...(p.data.vertical ? { vertical: p.data.vertical.literal } : {}) }, refused }
}
