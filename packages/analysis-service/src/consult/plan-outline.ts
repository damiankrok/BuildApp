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

export const PLAN_OUTLINE_VERSION = '1.5.0' as const
export const PLAN_OUTLINE_PROMPT_VERSION = 'plan-outline/3' as const
/** The main entrance is taken to stand on a side when its point lies within this share of the outline's extent from that side's edge. */
const ENTRANCE_NEAR_SHARE = 0.15
const MAX_OFF_AXIS_DEG = 8

export const PLAN_OUTLINE_SYSTEM = `You trace the outline of a house on one floor plan. You do not measure and you do not describe the house.
Give the outline of the OUTER faces of the exterior walls of the building on this plan — every enclosed part of it that stands on the ground (the house, an attached garage, a wing) — as one closed polygon of its real corners, in pixels of the picture you were sent (x to the right, y down), clockwise. Leave out terraces, steps, paving, pergolas, balcony slabs, the plot, dimension lines, text and furniture.
Name the parts the outline contains (e.g. MAIN, GARAGE, WING) and say whether every edge runs along the picture's axes.
If the plan itself shows which exterior door is the MAIN ENTRANCE — an entrance arrow or triangle at it, or entrance steps or a porch leading through it into a vestibule or hall — give the point where that door stands on the outline as "entrance" [x, y]. If the plan does not show it, leave "entrance" out: do not guess.
List the openings the plan draws in the EXTERIOR walls of that outline — windows, exterior doors, terrace doors, garage doors — as "openings": for each, the side of the picture its wall faces (TOP, RIGHT, BOTTOM or LEFT) and its two ends in pixels along that wall (x for TOP and BOTTOM, y for LEFT and RIGHT). Only openings the plan draws in exterior walls; no interior doors; nothing inferred.`

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
      openings: { type: 'array', description: 'the openings drawn in the exterior walls of the outline', items: { type: 'object', additionalProperties: false, required: ['side', 'from', 'to', 'kind'], properties: { side: { type: 'string', enum: ['TOP', 'RIGHT', 'BOTTOM', 'LEFT'] }, from: { type: 'number' }, to: { type: 'number' }, kind: { type: 'string', enum: ['WINDOW', 'DOOR', 'GLAZED_DOOR', 'GARAGE_DOOR'] } } } },
      note: { type: 'string' },
    },
  },
} as const

const Raw = z.object({ outline: z.array(z.tuple([z.number().finite(), z.number().finite()])).min(4), parts: z.array(z.string()), orthogonal: z.boolean(), entrance: z.tuple([z.number().finite(), z.number().finite()]).nullable().optional(), openings: z.array(z.object({ side: z.enum(['TOP', 'RIGHT', 'BOTTOM', 'LEFT']), from: z.number().finite(), to: z.number().finite(), kind: z.enum(['WINDOW', 'DOOR', 'GLAZED_DOOR', 'GARAGE_DOOR']) }).strict()).nullable().optional(), note: z.string().nullable().optional() }).strict()

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
  /**
   * plan-outline 1.2.0: the openings the plan draws in its exterior walls, by the side of the PLAN (its foot is the front),
   * each as a stretch of that side seen from outside, left to right, 0..1 — a turn of the house does not change it. A
   * second drawing's observation: it never adds an opening; it tells two side elevations apart.
   */
  openings?: PlanSideOpening[]
  /** plan-outline 1.5.0: oblique edges squared to the corner outside them (a named convention). */
  squared?: { edges: number; addedPx2: number; why: string }
  observation?: OutlineObservation
  /** The area of the outline at the analyzer's scale against the published footprint: a check, never an anchor. */
  check?: { areaM2: number; publishedM2?: number; share?: number }
  refused: string[]
}

export type PlanSideOpening = { side: 'FRONT' | 'RIGHT' | 'REAR' | 'LEFT'; u0: number; u1: number; kind: 'WINDOW' | 'DOOR' | 'GLAZED_DOOR' | 'GARAGE_DOOR' }

const toolInput = (turn: ModelTurn, name: string): unknown => (turn.content as Array<{ type: string; name?: string; input?: unknown }>).find((b) => b.type === 'tool_use' && b.name === name)?.input

/**
 * plan-outline 1.5.0 — an oblique edge of small extent (a bay window's splayed side, a chamfered corner) is replaced by
 * the two axis-parallel edges through the corner on the OUTSIDE of the outline: a bay becomes its bounding step (which
 * the body's builder then treats like any small step), a chamfer its square corner. A named MINIATURE CONVENTION, held
 * to a share of the outline's bounding rectangle per edge and in all — an outline whose oblique walls are a real part of
 * its form is refused as before (v3.54.19: a house with one splayed bay had no outline, no scale and no model).
 */
export const OBLIQUE_SQUARING = { edgeShare: 0.02, totalShare: 0.05 } as const
export function squareOblique(pts: ReadonlyArray<readonly [number, number]>): { outline: Array<[number, number]>; squared: number; addedPx2: number } {
  const n = pts.length
  const area2 = (v: ReadonlyArray<readonly [number, number]>): number => v.reduce((a, p, i) => a + p[0] * v[(i + 1) % v.length][1] - v[(i + 1) % v.length][0] * p[1], 0)
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const box = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys))
  const sign = Math.sign(area2(pts)) || 1
  const out: Array<[number, number]> = []
  let squared = 0
  let added = 0
  for (let i = 0; i < n; i += 1) {
    const a = pts[i]
    const b = pts[(i + 1) % n]
    out.push([a[0], a[1]])
    const ang = (Math.atan2(Math.abs(b[1] - a[1]), Math.abs(b[0] - a[0])) * 180) / Math.PI
    if (ang <= MAX_OFF_AXIS_DEG || ang >= 90 - MAX_OFF_AXIS_DEG) continue
    // the corner that lies OUTSIDE: the one whose triangle (a, corner, b) turns against the outline's own sense
    const cands: Array<[number, number]> = [[a[0], b[1]], [b[0], a[1]]]
    const outside = cands.find((c) => Math.sign((c[0] - a[0]) * (b[1] - a[1]) - (b[0] - a[0]) * (c[1] - a[1])) === sign) ?? cands[0]
    const tri = Math.abs((b[0] - a[0]) * (b[1] - a[1])) / 2
    if (tri > OBLIQUE_SQUARING.edgeShare * box) return { outline: pts.map((p) => [p[0], p[1]] as [number, number]), squared: 0, addedPx2: 0 }
    out.push(outside)
    squared += 1
    added += tri
  }
  if (added > OBLIQUE_SQUARING.totalShare * box) return { outline: pts.map((p) => [p[0], p[1]] as [number, number]), squared: 0, addedPx2: 0 }
  return { outline: out, squared, addedPx2: Math.round(added) }
}

/** Snap a traced outline to the plan's axes (each edge within 8°), dropping collinear corners; or say why not. */
export function orthogonalise(traced: ReadonlyArray<readonly [number, number]>): { outline: Array<[number, number]>; squared?: { edges: number; addedPx2: number } } | { refused: string } {
  const sq = squareOblique(traced)
  const pts = sq.outline
  const done = orthogonaliseSquare(pts)
  return 'refused' in done ? done : { ...done, ...(sq.squared > 0 ? { squared: { edges: sq.squared, addedPx2: sq.addedPx2 } } : {}) }
}
function orthogonaliseSquare(pts: ReadonlyArray<readonly [number, number]>): { outline: Array<[number, number]> } | { refused: string } {
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
  const read: PlanOutlineRead = { ...base, raw, usd, ...rid, outlinePx: o.outline, parts: p.data.parts, refused: [], ...(o.squared ? { squared: { ...o.squared, why: `MINIATURE_CONVENTION: ${o.squared.edges} oblique edge(s) of the traced outline (a bay's splayed side, a chamfered corner) are squared to the corner outside them (${o.squared.addedPx2} px² added): the traced outline is kept in the raw answer` } } : {}) }
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
  if (p.data.openings && p.data.openings.length > 0) {
    const xs = o.outline.map((q) => q[0])
    const ys = o.outline.map((q) => q[1])
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    const clamp = (v: number): number => Math.round(Math.min(1, Math.max(0, v)) * 1e4) / 1e4
    // along each side as a viewer outside it sees it, left to right: the foot (front) runs with x, the right side up the
    // sheet, the head (rear) against x, the left side down the sheet
    read.openings = p.data.openings.flatMap((q) => {
      const [a, b] = [q.from * pic.scale, q.to * pic.scale]
      const u = q.side === 'BOTTOM' ? [(a - x0) / (x1 - x0), (b - x0) / (x1 - x0)] : q.side === 'TOP' ? [(x1 - a) / (x1 - x0), (x1 - b) / (x1 - x0)] : q.side === 'RIGHT' ? [(y1 - a) / (y1 - y0), (y1 - b) / (y1 - y0)] : [(a - y0) / (y1 - y0), (b - y0) / (y1 - y0)]
      const [u0, u1] = [clamp(Math.min(...u)), clamp(Math.max(...u))]
      return u1 - u0 > 0.005 ? [{ side: q.side === 'BOTTOM' ? ('FRONT' as const) : q.side === 'TOP' ? ('REAR' as const) : q.side, u0, u1, kind: q.kind }] : []
    })
  }
  if (!f.scale) {
    read.refused.push(NO_PLAN_SCALE)
    return read
  }
  scaleOutline(read, f, f.scale)
  return read
}

const NO_PLAN_SCALE = 'PLAN_SCALE: the analyzer measured no scale of this plan: the outline stays in pixels'
/** Puts a traced outline (pixels) in metres at a stated scale: the observation the massing solver takes, and the footprint check. */
export function scaleOutline(read: PlanOutlineRead, f: Pick<PlanOutlineInput, 'frameId' | 'sourceByteHash' | 'publishedFootprintM2'>, scale: { mPerPx: number; why: string }): void {
  const o = read.outlinePx
  if (!o) return
  const s = scale.mPerPx
  const minX = Math.min(...o.map((q) => q[0]))
  const maxY = Math.max(...o.map((q) => q[1]))
  const outline = o.map(([x, y]) => ({ x: Math.round((x - minX) * s * 1e4) / 1e4, z: Math.round((maxY - y) * s * 1e4) / 1e4 }))
  let a2 = 0
  for (let i = 0; i < outline.length; i += 1) {
    const q = outline[i]
    const r = outline[(i + 1) % outline.length]
    a2 += q.x * r.z - r.x * q.z
  }
  const areaM2 = Math.round(Math.abs(a2 / 2) * 100) / 100
  read.refused = read.refused.filter((x) => x !== NO_PLAN_SCALE)
  read.check = { areaM2, ...(f.publishedFootprintM2 ? { publishedM2: f.publishedFootprintM2, share: Math.round((areaM2 / f.publishedFootprintM2) * 1000) / 1000 } : {}) }
  read.observation = { observationId: `outline-${f.frameId.slice(-16)}`, frameId: f.frameId, sourceByteHash: f.sourceByteHash, outline, by: 'API_PLAN_OUTLINE', fidelity: 'SOURCE_TRACED', why: `the outer wall faces traced on ${f.frameId} (${(read.parts ?? []).join(', ') || 'parts not named'}), at the analyzer's own scale: ${scale.why}` }
}

/** Two scales of one drawing agree within this share, or none is taken from them. */
export const OUTLINE_SCALE_AGREE = 0.03
/**
 * plan-outline 1.3.0: a scale for a plan the analyzer measured none on, from the traced outline itself.
 *  - OVERALL: the house's two overall outer dimensions (printed on this plan with their axes, or published as length and
 *    width) over the outline's two extents — two numbers over two independent extents, taken only when the two scales
 *    agree; a printed number and a traced line, not an estimate.
 *  - FOOTPRINT (a hypothesis, never taken alone): the published footprint area over the outline's area. The caller must
 *    confirm it by something that does not come from the plan (the published height against the elevations' ridge).
 */
export function outlineScale(outlinePx: ReadonlyArray<readonly [number, number]>, facts: { horizontalM?: number; verticalM?: number; overallM?: [number, number]; /** where the pair comes from, for the record (default: the page's length and width) */ overallFrom?: string; footprintM2?: number }): { mPerPx: number; basis: 'OVERALL_DIMENSIONS' | 'FOOTPRINT_AREA'; why: string } | undefined {
  const xs = outlinePx.map((q) => q[0])
  const ys = outlinePx.map((q) => q[1])
  const [w, h] = [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)]
  if (!(w > 20 && h > 20)) return undefined
  const pair = facts.horizontalM && facts.verticalM ? { x: facts.horizontalM, y: facts.verticalM, how: 'printed on the plan with their axes' } : facts.overallM ? (w >= h ? { x: Math.max(...facts.overallM), y: Math.min(...facts.overallM), how: `${facts.overallFrom ?? 'published length and width'}, the longer over the longer extent` } : { x: Math.min(...facts.overallM), y: Math.max(...facts.overallM), how: `${facts.overallFrom ?? 'published length and width'}, the longer over the longer extent` }) : undefined
  if (pair) {
    const [sx, sy] = [pair.x / w, pair.y / h]
    const spread = Math.abs(sx - sy) / Math.max(sx, sy)
    if (spread <= OUTLINE_SCALE_AGREE) return { mPerPx: (sx + sy) / 2, basis: 'OVERALL_DIMENSIONS', why: `${pair.x} m over the outline's ${w.toFixed(0)} px and ${pair.y} m over its ${h.toFixed(0)} px (${pair.how}): ${(sx * 100).toFixed(3)} and ${(sy * 100).toFixed(3)} cm/px, ${(spread * 100).toFixed(1)} % apart` }
  }
  if (facts.footprintM2 && facts.footprintM2 > 10) {
    let a2 = 0
    for (let i = 0; i < outlinePx.length; i += 1) a2 += outlinePx[i][0] * outlinePx[(i + 1) % outlinePx.length][1] - outlinePx[(i + 1) % outlinePx.length][0] * outlinePx[i][1]
    const areaPx = Math.abs(a2 / 2)
    if (areaPx > 400) return { mPerPx: Math.sqrt(facts.footprintM2 / areaPx), basis: 'FOOTPRINT_AREA', why: `the published footprint ${facts.footprintM2} m² over the outline's ${areaPx.toFixed(0)} px² (a hypothesis: one number, to be confirmed by the published height)${pair ? '; the overall dimensions do not agree over the outline\'s extents' : ''}` }
  }
  return undefined
}
