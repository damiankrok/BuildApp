/**
 * v3.54.17 — the plan outline read: one request for the ground-floor plan the analyzer selected, asking only for the
 * outline of the building's outer wall faces in that picture's pixels. Nothing of the analyzer's is in the request.
 *
 * The outline becomes metres only through the plan scale the analyzer measured on its own (a STRONG, CONFIRMED scale of
 * the same frame); without it the read stays pixels and the missing anchor is named. The published footprint is a check
 * of the result (recorded beside it), never its anchor: the scale is not fitted to an area.
 *
 * Orthogonal outlines only: an edge more than 8° off the plan's axes is not snapped into one — the read is refused as
 * beyond the supported form. Collinear corners are dropped; the front is the plan's bottom edge as plans are printed
 * (z = 0 there, x to the right), and the elevations' agreement on the heights decides whether that holds (massing).
 */
import { z } from 'zod'
import type { Raster } from '@buildapp/source-cv'
import { ConsultantUnavailable, settledOf } from './loop.js'
import type { ConsultSpend, ConsultantModel, ModelTurn, Price } from './loop.js'
import { reserveOf } from './cost.js'
import { pictureOf } from './metric-read.js'
import type { OutlineObservation } from './massing/massing.js'

export const PLAN_OUTLINE_VERSION = '1.1.0' as const
export const PLAN_OUTLINE_PROMPT_VERSION = 'plan-outline/2' as const
/** The main entrance is taken to stand on a side when its point lies within this share of the outline's extent from that side's edge. */
const ENTRANCE_NEAR_SHARE = 0.15
const MAX_OFF_AXIS_DEG = 8

export const PLAN_OUTLINE_SYSTEM = `You trace the outline of a house on one floor plan. You do not measure and you do not describe the house.
Give the outline of the OUTER faces of the exterior walls of the building on this plan — every enclosed part of it that stands on the ground (the house, an attached garage, a wing) — as one closed polygon of its real corners, in pixels of the picture you were sent (x to the right, y down), clockwise. Leave out terraces, steps, paving, pergolas, balcony slabs, the plot, dimension lines, text and furniture.
Name the parts the outline contains (e.g. MAIN, GARAGE, WING) and say whether every edge runs along the picture's axes.
If the plan itself shows which exterior door is the MAIN ENTRANCE — an entrance arrow or triangle at it, or entrance steps or a porch leading through it into a vestibule or hall — give the point where that door stands on the outline as "entrance" [x, y]. If the plan does not show it, leave "entrance" out: do not guess.`

const TOOL = {
  name: 'report_outline',
  description: 'Report the outline of the outer wall faces as one closed polygon in pixels of the picture you were sent.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['outline', 'parts', 'orthogonal'],
    properties: {
      outline: { type: 'array', description: 'the corners, clockwise, in pixels of this picture', items: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 }, minItems: 4 },
      parts: { type: 'array', items: { type: 'string' } },
      orthogonal: { type: 'boolean' },
      entrance: { type: 'array', description: 'the main entrance door on the outline, in pixels of this picture — only when the plan shows which door it is', items: { type: 'number' }, minItems: 2, maxItems: 2 },
      note: { type: 'string' },
    },
  },
} as const

const Raw = z.object({ outline: z.array(z.tuple([z.number().finite(), z.number().finite()])).min(4), parts: z.array(z.string()), orthogonal: z.boolean(), entrance: z.tuple([z.number().finite(), z.number().finite()]).nullable().optional(), note: z.string().nullable().optional() }).strict()

type Ctx = { model: ConsultantModel; price: Price; spend?: ConsultSpend; signal?: AbortSignal }
export type PlanOutlineInput = { frameId: string; raster: Raster; caption: string; sourceByteHash: string; /** metres per FRAME pixel, from the analyzer's own measured scale; absent = no metric anchor. */ scale?: { mPerPx: number; why: string }; publishedFootprintM2?: number }
export type PlanOutlineRead = {
  version: string
  promptVersion: string
  frameId: string
  raw: unknown
  usd: number
  requestId?: string
  /** The outline in frame pixels, as read and orthogonalised. */
  outlinePx?: Array<[number, number]>
  parts?: string[]
  /** plan-outline 1.1.0: the side of the outline the plan marks its main entrance on (the plan's own convention: its foot is the FRONT), with the point as read; absent when the plan does not show it or the point is not near one side. */
  entrance?: { px: [number, number]; side?: 'FRONT' | 'RIGHT' | 'REAR' | 'LEFT'; why: string }
  observation?: OutlineObservation
  /** The area of the outline at the analyzer's scale against the published footprint: a check, never an anchor. */
  check?: { areaM2: number; publishedM2?: number; share?: number }
  refused: string[]
}

const toolInput = (turn: ModelTurn, name: string): unknown => (turn.content as Array<{ type: string; name?: string; input?: unknown }>).find((b) => b.type === 'tool_use' && b.name === name)?.input

/** Snap a traced outline to the plan's axes (each edge within 8°), dropping collinear corners; or say why not. */
export function orthogonalise(pts: ReadonlyArray<readonly [number, number]>): { outline: Array<[number, number]> } | { refused: string } {
  const n = pts.length
  const dir: Array<'H' | 'V'> = []
  for (let i = 0; i < n; i += 1) {
    const [ax, ay] = pts[i]
    const [bx, by] = pts[(i + 1) % n]
    const ang = (Math.atan2(Math.abs(by - ay), Math.abs(bx - ax)) * 180) / Math.PI
    if (ang <= MAX_OFF_AXIS_DEG) dir.push('H')
    else if (ang >= 90 - MAX_OFF_AXIS_DEG) dir.push('V')
    else return { refused: `edge ${i} runs ${ang.toFixed(1)}° off the plan's axes: an outline with oblique walls is beyond the supported form` }
  }
  // merge runs of the same direction, then place each corner where its H edge's row meets its V edge's column
  const runs: Array<{ d: 'H' | 'V'; pts: Array<readonly [number, number]> }> = []
  for (let i = 0; i < n; i += 1) {
    const last = runs[runs.length - 1]
    if (last && last.d === dir[i]) last.pts.push(pts[(i + 1) % n])
    else runs.push({ d: dir[i], pts: [pts[i], pts[(i + 1) % n]] })
  }
  if (runs.length > 1 && runs[0].d === runs[runs.length - 1].d) {
    const first = runs.shift() as (typeof runs)[number]
    runs[runs.length - 1].pts.push(...first.pts)
  }
  if (runs.length < 4 || runs.length % 2 !== 0) return { refused: `the outline does not close as alternating horizontal and vertical walls (${runs.length} runs)` }
  const level = runs.map((r) => (r.d === 'H' ? r.pts.reduce((a, p) => a + p[1], 0) / r.pts.length : r.pts.reduce((a, p) => a + p[0], 0) / r.pts.length))
  const out: Array<[number, number]> = []
  for (let i = 0; i < runs.length; i += 1) {
    const a = runs[i]
    const b = runs[(i + 1) % runs.length]
    out.push(a.d === 'H' ? [level[(i + 1) % runs.length], level[i]] : [level[i], level[(i + 1) % runs.length]])
    void b
  }
  return { outline: out }
}

export async function readPlanOutline(ctx: Ctx, f: PlanOutlineInput): Promise<PlanOutlineRead> {
  const base = { version: PLAN_OUTLINE_VERSION, promptVersion: PLAN_OUTLINE_PROMPT_VERSION, frameId: f.frameId }
  const pic = pictureOf(f.raster)
  const content = [
    { type: 'text', text: `A floor plan of a house — "${f.caption}". The picture is ${pic.width} × ${pic.height} px; give every corner in its pixels.` },
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: Buffer.from(pic.png).toString('base64') } },
  ]
  const reserveUsd = reserveOf(ctx.price, Math.ceil((PLAN_OUTLINE_SYSTEM.length + JSON.stringify(TOOL).length + 200) / 2.5) + 2600, ctx.model.maxOutputTokens, ctx.model.cache)
  const reservation = ctx.spend?.reserve(ctx.model.model, reserveUsd, `plan outline ${f.frameId}`)
  let turn: ModelTurn
  let usd = 0
  try {
    turn = await ctx.model.send({ system: PLAN_OUTLINE_SYSTEM, messages: [{ role: 'user', content }], tools: [TOOL], ...(ctx.signal ? { signal: ctx.signal } : {}) })
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
  const framePts = p.data.outline.map(([x, y]) => [x * pic.scale, y * pic.scale] as [number, number])
  if (framePts.some(([x, y]) => x < -5 || y < -5 || x > f.raster.width + 5 || y > f.raster.height + 5)) return { ...base, raw, usd, ...rid, refused: ['the outline leaves the picture'] }
  const o = orthogonalise(framePts)
  if ('refused' in o) return { ...base, raw, usd, ...rid, parts: p.data.parts, refused: [o.refused] }
  const read: PlanOutlineRead = { ...base, raw, usd, ...rid, outlinePx: o.outline, parts: p.data.parts, refused: [] }
  if (p.data.entrance) {
    const [ex, ey] = [p.data.entrance[0] * pic.scale, p.data.entrance[1] * pic.scale]
    const xs = o.outline.map((q) => q[0])
    const ys = o.outline.map((q) => q[1])
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    // how far the point stands from each side of the outline's box, as a share of the box across that side
    const d = [{ side: 'FRONT' as const, v: (y1 - ey) / (y1 - y0) }, { side: 'REAR' as const, v: (ey - y0) / (y1 - y0) }, { side: 'LEFT' as const, v: (ex - x0) / (x1 - x0) }, { side: 'RIGHT' as const, v: (x1 - ex) / (x1 - x0) }].sort((a, b) => Math.abs(a.v) - Math.abs(b.v))
    const one = Math.abs(d[0].v) <= ENTRANCE_NEAR_SHARE && Math.abs(d[1].v) > ENTRANCE_NEAR_SHARE
    read.entrance = { px: [Math.round(ex), Math.round(ey)], ...(one ? { side: d[0].side } : {}), why: one ? `the plan marks its main entrance ${(Math.abs(d[0].v) * 100).toFixed(0)} % in from the outline's ${d[0].side.toLowerCase()} side (the plan's foot is the front)` : `the entrance point is not near one side of the outline alone (${d.slice(0, 2).map((q) => `${q.side.toLowerCase()} ${(Math.abs(q.v) * 100).toFixed(0)} %`).join(', ')}): no side taken` }
  }
  if (!f.scale) {
    read.refused.push('PLAN_SCALE: the analyzer measured no scale of this plan: the outline stays in pixels')
    return read
  }
  const s = f.scale.mPerPx
  const minX = Math.min(...o.outline.map((q) => q[0]))
  const maxY = Math.max(...o.outline.map((q) => q[1]))
  const outline = o.outline.map(([x, y]) => ({ x: Math.round((x - minX) * s * 1e4) / 1e4, z: Math.round((maxY - y) * s * 1e4) / 1e4 }))
  let a2 = 0
  for (let i = 0; i < outline.length; i += 1) {
    const q = outline[i]
    const r = outline[(i + 1) % outline.length]
    a2 += q.x * r.z - r.x * q.z
  }
  const areaM2 = Math.round(Math.abs(a2 / 2) * 100) / 100
  read.check = { areaM2, ...(f.publishedFootprintM2 ? { publishedM2: f.publishedFootprintM2, share: Math.round((areaM2 / f.publishedFootprintM2) * 1000) / 1000 } : {}) }
  read.observation = { observationId: `outline-${f.frameId.slice(-16)}`, frameId: f.frameId, sourceByteHash: f.sourceByteHash, outline, by: 'API_PLAN_OUTLINE', fidelity: 'SOURCE_TRACED', why: `the outer wall faces traced on ${f.frameId} (${p.data.parts.join(', ') || 'parts not named'}), at the analyzer's own scale: ${f.scale.why}` }
  return read
}
