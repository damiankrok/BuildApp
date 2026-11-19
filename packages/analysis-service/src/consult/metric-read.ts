/**
 * v3.54.14 R2 — the metric consultant: the provider's API reads a house's printed dimensions from the ORIGINAL plans
 * and sections before it is shown anything the analyzer read, then checks the analyzer's own readings against them;
 * a deterministic resolver decides, per label, what the analyzer is handed — and the analyzer, not the API, rebuilds.
 *
 *   1. independent read (`readDimensions`): one request per frame (every storey's plan, the sections), the picture as
 *      the analyzer reads it (its frame, downscaled by a whole factor only above 1400 px, the transform stated); the
 *      answer is a list of DimensionObservations (contract `buildapp.dimension-observation`, versioned below): the
 *      printed text, its unit and value in metres, where the text and the line's two ends are, the storey, the axis,
 *      what it measures (the house, a body, a room, an opening, a level…), what its ends rest on, and whether it is
 *      PRINTED, DERIVED, ESTIMATED or UNKNOWN. No value of the analyzer's is in that request.
 *   2. check of LOCAL (`verifyLocal`): a second request per frame with the analyzer's readings drawn on the picture as
 *      numbered boxes and their measured lines, and the table of what it read; per item AGREES / DISAGREES / UNREADABLE /
 *      INSUFFICIENT_EVIDENCE with the source text and a scoped proposal. Marked as its own stage: it saw the analyzer.
 *   3. resolution (`resolveMetric`, deterministic): an API reading joins an analyzer label by position; a different
 *      value is handed to the analyzer as a consulted reading only with a witness that is neither the API nor that
 *      label — the sum of its chain, or the label's own span at a scale other labels settle. A repeat of the same
 *      reading in the second request is never that witness. An API dimension the analyzer has no label for is handed as
 *      a consulted span (the metric layer snaps its ends and admits or refuses it by its own rules).
 *   4. what was built (`measureBuilt`): the model's spans and heights, so a value handed over is checked in the scene.
 *
 * Raw answers are kept beside the canonical observations; the same canonical set on the same code rebuilds the same
 * model. A new reading is a new revision, never a silent replacement.
 */
import { createHash } from 'node:crypto'
import { z } from 'zod'
import type { ConsultedLevel, ConsultedReading, ConsultedSpan, MetricEvidenceSet } from '@buildapp/source-metrics'
import type { CanonicalBuildingModel } from '@buildapp/model'
import type { Raster } from '@buildapp/source-cv'
import { encodePng } from '../diagnostics.js'
import type { CompiledScene } from '@buildapp/geometry'
import { MAX_SIDE } from './tools.js'
import { ConsultantUnavailable, settledOf } from './loop.js'
import { reserveOf } from './cost.js'
import type { ConsultSpend, ConsultantModel, ModelTurn, Price } from './loop.js'

export const DIMENSION_OBSERVATION_SCHEMA = 'buildapp.dimension-observation' as const
export const DIMENSION_OBSERVATION_VERSION = '1.1.0' as const
export const METRIC_READ_PROMPT_VERSION = 'metric-read/2' as const
export const METRIC_VERIFY_PROMPT_VERSION = 'metric-verify/2' as const
export const METRIC_RESOLVER_VERSION = '1.2.0' as const
export const VERIFY_MAX_ITEMS = 40

const finite = z.number().finite()
const P = z.tuple([finite, finite])
const KINDS = ['LENGTH', 'LEVEL', 'ANGLE', 'AREA'] as const
const UNITS = ['cm', 'm', 'mm', 'deg', 'm2', 'none'] as const
const STOREYS = ['GROUND', 'UPPER', 'ATTIC', 'BASEMENT', 'ROOF', 'UNKNOWN'] as const
const AXES = ['HORIZONTAL', 'VERTICAL', 'OBLIQUE', 'NONE'] as const
const SCOPES = ['WHOLE_HOUSE', 'BODY', 'WING', 'ROOM', 'OPENING', 'SEGMENT', 'WALL_THICKNESS', 'LEVEL', 'HEIGHT', 'OTHER', 'UNKNOWN'] as const
const REFERENCES = ['OUTER_FACE', 'INNER_FACE', 'AXIS', 'FINISHED_LEVEL', 'STRUCTURAL_LEVEL', 'TERRAIN', 'UNKNOWN'] as const
const STATUSES = ['PRINTED', 'DERIVED', 'ESTIMATED', 'UNKNOWN'] as const
/** 1.1.0: what a LEVEL marks (a ceiling is not the eaves, the terrain is not ±0,00) and what an ANGLE is. */
export const MARK_ROLES = ['FLOOR', 'TERRAIN', 'CEILING', 'EAVES', 'RIDGE', 'CHIMNEY', 'ROOF_PITCH', 'OTHER', 'UNKNOWN'] as const
export type MarkRole = (typeof MARK_ROLES)[number]
/**
 * The role a 1.0.0 answer (no role field) stated only in its free hint, read by a fixed vocabulary — `roleFrom: HINT`,
 * never stronger than the API's own field. A hint that names none of them, or two, gives no role.
 */
export function roleOfHint(kind: string, hint: string | undefined): MarkRole | undefined {
  if (!hint) return undefined
  const h = hint.toLowerCase()
  const hits = ([['RIDGE', /ridge|kalenic/], ['EAVES', /eave|okap/], ['CEILING', /ceiling|sufit|strop/], ['TERRAIN', /terrain|teren|grunt|ground level outside/], ['CHIMNEY', /chimney|komin/], ['FLOOR', /ground floor|floor level|parter|posadzk|±\s*0|finished floor|\bfloor\b/], ['ROOF_PITCH', /pitch|slope|nachyl|spadek/]] as Array<[MarkRole, RegExp]>).filter(([, re]) => re.test(h)).map(([r]) => r)
  const usable = hits.filter((r) => (kind === 'ANGLE' ? r === 'ROOF_PITCH' : r !== 'ROOF_PITCH'))
  return usable.length === 1 ? usable[0] : undefined
}

/** One printed dimension as the API reported it, in the frame's pixels (canonical). */
export const DimensionObservationSchema = z
  .object({
    schema: z.literal(DIMENSION_OBSERVATION_SCHEMA),
    schemaVersion: z.literal(DIMENSION_OBSERVATION_VERSION),
    /** Stable: the frame, the kind, the printed text and where its text stands (16 px cells) — never the answer order. */
    id: z.string().regex(/^[A-Za-z0-9_.:-]+$/),
    frameId: z.string(),
    image: z.object({ sha256: z.string().regex(/^[0-9a-f]{64}$/), width: z.number().int().positive(), height: z.number().int().positive(), scale: z.number().positive() }).strict(),
    kind: z.enum(KINDS),
    literal: z.string().min(1),
    unit: z.enum(UNITS),
    /** The printed value in metres (degrees for an ANGLE, m² for an AREA); null when the text is not legible. */
    value: finite.nullable(),
    labelBox: z.tuple([finite, finite, finite, finite]),
    ends: z.object({ from: P, to: P }).strict().optional(),
    storey: z.enum(STOREYS),
    axis: z.enum(AXES),
    scope: z.enum(SCOPES),
    reference: z.enum(REFERENCES),
    status: z.enum(STATUSES),
    hostHint: z.string().max(120).optional(),
    note: z.string().max(300).optional(),
    /** 1.1.0: the role of a LEVEL / ANGLE, and where it came from (the API's field, or its 1.0.0 hint by vocabulary). */
    role: z.enum(MARK_ROLES).optional(),
    roleFrom: z.enum(['API', 'HINT']).optional(),
  })
  .strict()
export type DimensionObservation = z.infer<typeof DimensionObservationSchema>

/** What the API is asked to return per dimension (its own picture's pixels; the id and frame are the analyzer's). */
const RawItem = z
  .object({
    kind: z.enum(KINDS),
    literal: z.string().min(1),
    unit: z.enum(UNITS),
    value: finite.nullable(),
    labelBox: z.tuple([finite, finite, finite, finite]),
    ends: z.object({ from: P, to: P }).strict().nullable().optional(),
    storey: z.enum(STOREYS),
    axis: z.enum(AXES),
    scope: z.enum(SCOPES),
    reference: z.enum(REFERENCES),
    status: z.enum(STATUSES),
    hostHint: z.string().max(120).nullable().optional(),
    note: z.string().max(300).nullable().optional(),
    role: z.enum(MARK_ROLES).nullable().optional(),
  })
  .strict()

const READ_TOOL = {
  name: 'report_dimensions',
  description: 'Report every printed dimension, level mark and angle you can find on this drawing, one item each.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['items'],
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['kind', 'literal', 'unit', 'value', 'labelBox', 'storey', 'axis', 'scope', 'reference', 'status'],
          properties: {
            kind: { enum: KINDS },
            literal: { type: 'string', description: 'the text exactly as printed: its digits, sign and decimal separator (for example 1365, 4,50, +5,54, 28°)' },
            unit: { enum: UNITS, description: 'the unit the drawing uses for this text: cm for whole centimetres, m when a decimal comma/point is printed in metres, deg for an angle' },
            value: { type: ['number', 'null'], description: 'the printed value converted to metres (a level in metres above ±0.00, an angle in degrees); null when you cannot read it' },
            labelBox: { type: 'array', items: { type: 'number' }, minItems: 4, maxItems: 4, description: 'x0, y0, x1, y1 of the TEXT in pixels of this picture' },
            ends: { type: ['object', 'null'], additionalProperties: false, required: ['from', 'to'], properties: { from: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 }, to: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 } }, description: 'for a LENGTH: the two ends of its dimension line in pixels of this picture (where the extension lines or ticks cross it); null for a level or an angle' },
            storey: { enum: STOREYS },
            axis: { enum: AXES, description: 'the direction of the dimension line in this picture' },
            scope: { enum: SCOPES, description: 'what it measures: the whole house, one body or wing, a room, an opening, one segment of a chain, a wall thickness, a level, a height' },
            reference: { enum: REFERENCES, description: 'what its ends rest on: outer faces of walls, inner faces, axes; for a level, finished or structural level or terrain' },
            status: { enum: STATUSES, description: 'PRINTED when the number is printed on the drawing; DERIVED/ESTIMATED only if you computed or guessed it (say how in note); UNKNOWN if illegible' },
            hostHint: { type: ['string', 'null'], description: 'short: which wall, room or opening (e.g. "front wall, overall", "living room width")' },
            role: { enum: [...MARK_ROLES, null], description: 'for a LEVEL: what it marks — FLOOR (a finished floor, ±0,00 included), TERRAIN (the ground outside), CEILING, EAVES (the roof edge), RIDGE, CHIMNEY (its top); for an ANGLE: ROOF_PITCH; null for a LENGTH or an AREA' },
            note: { type: ['string', 'null'] },
          },
        },
      },
    },
  },
} as const

export const METRIC_READ_SYSTEM = `You read printed dimensions from one architectural drawing (a floor plan or a section of a house), literally. You do not see and are not told what anyone else read.

Report, with report_dimensions, every dimension line with its number, every level mark (for example ±0,00, +2,80, +5,54, −0,30), and every printed angle. For each:
- literal: exactly as printed (digits, sign, decimal comma or point). Never round, never convert in the literal, never complete a digit you cannot see. Illegible: status UNKNOWN, value null.
- value: the same number in metres (centimetre labels like 1365 → 13.65; 4,50 → 4.5; a level +5,54 → 5.54; an angle → degrees).
- labelBox: the box of the TEXT, and ends: the two ends of its dimension line, both in pixels of the picture you were sent (x right, y down). Point at where the line meets its extension lines or ticks, not at the walls.
- scope: WHOLE_HOUSE only for the outermost overall dimension of the building; a chain's pieces are SEGMENT; a room's inside size ROOM; an opening's width OPENING; a section's height between two levels HEIGHT; a level mark LEVEL.
- reference: OUTER_FACE when the line runs from outer wall face to outer wall face; INNER_FACE for inside sizes; AXIS for axis-to-axis; for levels FINISHED_LEVEL / STRUCTURAL_LEVEL / TERRAIN.
- status PRINTED unless you computed it (DERIVED, say how) or guessed (ESTIMATED). A sum of other numbers is DERIVED, never PRINTED.
A total height, a level above ground, a storey height and an opening's clear height are different things: name each by its scope and reference. Room areas in m² may be listed as AREA. Do not describe the house.`

const VERIFY_TOOL = {
  name: 'report_verdicts',
  description: "Give one verdict per numbered item of the analyzer's table.",
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['verdicts'],
    properties: {
      verdicts: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['itemId', 'verdict', 'sourceLiteral', 'why'],
          properties: {
            itemId: { type: 'string' },
            verdict: { enum: ['AGREES', 'DISAGREES', 'UNREADABLE', 'INSUFFICIENT_EVIDENCE'] },
            sourceLiteral: { type: ['string', 'null'], description: 'the text printed at the marked place, as printed' },
            why: { type: 'string', description: 'what on the drawing supports the verdict (which line, which label)' },
            proposal: { type: ['object', 'null'], additionalProperties: false, required: ['literal', 'scope'], properties: { literal: { type: 'string' }, scope: { enum: SCOPES } } },
          },
        },
      },
    },
  },
} as const

export const METRIC_VERIFY_SYSTEM = `You check a deterministic analyzer's readings of printed dimensions against the drawing. The picture shows the analyzer's readings as numbered magenta boxes (around the text it read) and, where it measured a line, a cyan segment between the two ends it used. The table gives, per number, the text the analyzer read and the value it used.

For each item answer with report_verdicts: AGREES only if the text printed in that box is exactly what the analyzer read AND the cyan segment is that dimension's line; DISAGREES if the printed text differs or the segment is not that line (give sourceLiteral and a proposal with the printed literal and its scope); UNREADABLE if the text cannot be read; INSUFFICIENT_EVIDENCE if the box is not on a dimension. Name the specific label and line that support your verdict. "All correct" is not an answer: every item gets its own verdict and reason.`

export type MetricFrame = { frameId: string; kind: 'PLAN' | 'SECTION'; storey: (typeof STOREYS)[number]; raster: Raster; caption: string }
export type MetricReadRecord = { at: string; kind: string; [k: string]: unknown }
type Ctx = { model: ConsultantModel; price: Price; spend?: ConsultSpend; record?: (e: MetricReadRecord) => void; signal?: AbortSignal; now?: () => Date }

const sha = (b: Uint8Array | string): string => createHash('sha256').update(b).digest('hex')

/** The picture sent: the frame's raster, downscaled by a whole factor above MAX_SIDE (frame = picture × scale). */
export function pictureOf(raster: Raster, mark?: (data: Uint8ClampedArray, w: number, h: number, scale: number) => void): { png: Uint8Array; width: number; height: number; scale: number } {
  const k = Math.max(1, Math.ceil(Math.max(raster.width, raster.height) / MAX_SIDE))
  const w = Math.floor(raster.width / k)
  const h = Math.floor(raster.height / k)
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const si = (y * k * raster.width + x * k) * 4
    const di = (y * w + x) * 4
    data[di] = raster.data[si]
    data[di + 1] = raster.data[si + 1]
    data[di + 2] = raster.data[si + 2]
    data[di + 3] = 255
  }
  mark?.(data, w, h, k)
  return { png: encodePng({ width: w, height: h, data }), width: w, height: h, scale: k }
}

async function send(ctx: Ctx, note: string, system: string, content: unknown[], tool: unknown, pictures: number): Promise<{ turn: ModelTurn; usd: number } | { failed: string }> {
  const textChars = system.length + JSON.stringify(content.filter((c) => (c as { type: string }).type === 'text')).length + JSON.stringify(tool).length
  const reserveUsd = reserveOf(ctx.price, Math.ceil(textChars / 2.5) + pictures * 2600, ctx.model.maxOutputTokens, ctx.model.cache)
  const reservation = ctx.spend?.reserve(ctx.model.model, reserveUsd, note)
  try {
    const turn = await ctx.model.send({ system, messages: [{ role: 'user', content }], tools: [tool], ...(ctx.signal ? { signal: ctx.signal } : {}) })
    const settled = settledOf(ctx.price, turn.usage)
    const usd = settled.usd
    if (reservation) ctx.spend?.settle(reservation, settled)
    return { turn, usd }
  } catch (e) {
    const reason = e instanceof ConsultantUnavailable ? e.reason : 'TRANSPORT'
    if (reservation) ctx.spend?.settle(reservation, reason === 'NO_CREDENTIALS' || reason === 'REJECTED_UNBILLED' || reason === 'BUDGET' ? 'NOT_SENT' : { usd: reserveUsd, inputTokens: 0, outputTokens: 0 }, reason)
    return { failed: `${reason}: ${(e as Error).message.slice(0, 200)}` }
  }
}

const toolInput = (turn: ModelTurn, name: string): unknown => (turn.content as Array<{ type: string; name?: string; input?: unknown }>).find((b) => b.type === 'tool_use' && b.name === name)?.input

/** A stable id: frame, kind, printed digits and the text's 16 px cell; a collision takes a suffix in position order. */
function stableIds(frameId: string, items: Array<Omit<DimensionObservation, 'id'>>): DimensionObservation[] {
  const base = items.map((o) => {
    const cx = Math.round((o.labelBox[0] + o.labelBox[2]) / 2 / 16)
    const cy = Math.round((o.labelBox[1] + o.labelBox[3]) / 2 / 16)
    return `dim-${sha(frameId).slice(0, 8)}-${o.kind.toLowerCase()}-${o.literal.replace(/[^0-9]/g, '') || 'x'}-${cx}-${cy}`
  })
  const order = items.map((o, i) => ({ i, k: `${base[i]}|${o.labelBox[0].toFixed(1)}|${o.labelBox[1].toFixed(1)}` })).sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0))
  const used = new Map<string, number>()
  const id: string[] = []
  for (const { i } of order) {
    const n = used.get(base[i]) ?? 0
    used.set(base[i], n + 1)
    id[i] = n === 0 ? base[i] : `${base[i]}-${n}`
  }
  return items.map((o, i) => ({ ...o, id: id[i] }) as DimensionObservation).sort((a, b) => (a.id < b.id ? -1 : 1))
}

export type IndependentRead = { frameId: string; raw: unknown; observations: DimensionObservation[]; refused: string[]; usd: number; requestId?: string; model: string; promptVersion: string; /** v3.54.15: COMPLETE, TRUNCATED (partial), REFUSED or NO_TOOL_CALL — the response as a whole. */ response?: 'COMPLETE' | 'TRUNCATED' | 'REFUSED' | 'NO_TOOL_CALL' }

/** The role of a LEVEL / ANGLE: the API's own field (1.1.0), else its 1.0.0 hint by vocabulary; never for a LENGTH. */
function roleFields(kind: string, role: MarkRole | undefined, hint: string | undefined): { role?: MarkRole; roleFrom?: 'API' | 'HINT' } {
  if (kind !== 'LEVEL' && kind !== 'ANGLE') return {}
  if (role && role !== 'UNKNOWN') return { role, roleFrom: 'API' }
  const h = roleOfHint(kind, hint)
  return h ? { role: h, roleFrom: 'HINT' } : {}
}

/** Stage 1: one request per frame, nothing of the analyzer's in it. */
export async function readDimensions(ctx: Ctx, frames: readonly MetricFrame[]): Promise<IndependentRead[]> {
  const out: IndependentRead[] = []
  for (const f of frames) {
    const pic = pictureOf(f.raster)
    const content = [
      { type: 'text', text: `A ${f.kind === 'PLAN' ? `floor plan (${f.storey.toLowerCase()} storey)` : 'section'} of a house — "${f.caption}". The picture is ${pic.width} × ${pic.height} px; give every position in its pixels.` },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: Buffer.from(pic.png).toString('base64') } },
    ]
    const r = await send(ctx, `metric read ${f.frameId}`, METRIC_READ_SYSTEM, content, READ_TOOL, 1)
    if ('failed' in r) {
      ctx.record?.({ at: (ctx.now ?? (() => new Date()))().toISOString(), kind: 'METRIC_READ_FAILED', frameId: f.frameId, why: r.failed })
      out.push({ frameId: f.frameId, raw: null, observations: [], refused: [r.failed], usd: 0, model: ctx.model.model, promptVersion: METRIC_READ_PROMPT_VERSION })
      continue
    }
    const raw = toolInput(r.turn, READ_TOOL.name)
    const refused: string[] = []
    const items: Array<Omit<DimensionObservation, 'id'>> = []
    // v3.54.15: the response as a whole — a refusal, a missing tool call and a cut-off answer are named, never an empty read
    const response: IndependentRead['response'] = r.turn.stopReason === 'refusal' ? 'REFUSED' : r.turn.stopReason === 'max_tokens' ? 'TRUNCATED' : raw === undefined ? 'NO_TOOL_CALL' : 'COMPLETE'
    if (response === 'REFUSED') refused.push('REFUSED: the provider refused the answer (stop_reason refusal); nothing of it is read')
    if (response === 'TRUNCATED') refused.push('TRUNCATED: the answer was cut off at max_tokens; the items after the cut are missing (the read is partial)')
    const list = response === 'REFUSED' ? undefined : (raw as { items?: unknown[] } | undefined)?.items
    if (!Array.isArray(list) && response !== 'REFUSED') refused.push(`NO_TOOL_CALL: no report_dimensions answer${r.turn.stopReason ? ` (stop_reason ${r.turn.stopReason})` : ''}`)
    for (const [n, it] of (Array.isArray(list) ? list : []).entries()) {
      const p = RawItem.safeParse(it)
      if (!p.success) {
        refused.push(`item ${n}: ${p.error.issues[0]?.path.join('.')} ${p.error.issues[0]?.message}`)
        continue
      }
      const v = p.data
      const box = v.labelBox.map((x) => x * pic.scale) as [number, number, number, number]
      if (box[2] < box[0] || box[3] < box[1] || box[0] < -5 || box[1] < -5 || box[2] > f.raster.width + 5 || box[3] > f.raster.height + 5) {
        refused.push(`item ${n} "${v.literal}": its text box is not inside the picture`)
        continue
      }
      const parsed = valueOfLiteral(v.literal, v.unit, v.kind)
      // the value must be the printed literal's; a value the text does not state is not taken
      const value = v.status === 'UNKNOWN' ? null : parsed ?? null
      if (v.value !== null && parsed !== undefined && Math.abs(parsed - v.value) > 0.006 * Math.max(1, Math.abs(parsed))) refused.push(`item ${n} "${v.literal}": the value ${v.value} is not the printed literal's (${parsed}); the literal's is kept`)
      items.push({
        schema: DIMENSION_OBSERVATION_SCHEMA,
        schemaVersion: DIMENSION_OBSERVATION_VERSION,
        frameId: f.frameId,
        image: { sha256: sha(pic.png), width: pic.width, height: pic.height, scale: pic.scale },
        kind: v.kind,
        literal: v.literal.trim(),
        unit: v.unit,
        value,
        labelBox: box,
        ...(v.ends ? { ends: { from: [v.ends.from[0] * pic.scale, v.ends.from[1] * pic.scale] as [number, number], to: [v.ends.to[0] * pic.scale, v.ends.to[1] * pic.scale] as [number, number] } } : {}),
        storey: v.storey,
        axis: v.axis,
        scope: v.scope,
        reference: v.reference,
        status: v.status,
        ...(v.hostHint ? { hostHint: v.hostHint } : {}),
        ...(v.note ? { note: v.note } : {}),
        ...roleFields(v.kind, v.role ?? undefined, v.hostHint ?? undefined),
      })
    }
    const observations = stableIds(f.frameId, items).map((o) => DimensionObservationSchema.parse(o))
    ctx.record?.({ at: (ctx.now ?? (() => new Date()))().toISOString(), kind: 'METRIC_READ', frameId: f.frameId, observations: observations.length, refused: refused.length, usd: r.usd })
    out.push({ frameId: f.frameId, raw, observations, refused, usd: r.usd, response, ...(r.turn.requestId ? { requestId: r.turn.requestId } : {}), model: r.turn.model, promptVersion: METRIC_READ_PROMPT_VERSION })
  }
  return out
}

/** A printed literal's value: cm labels → m, decimal metres, signed levels, degrees. Undefined when it is not a number. */
export function valueOfLiteral(literal: string, unit: (typeof UNITS)[number], kind: (typeof KINDS)[number]): number | undefined {
  const t = literal.replace(/\s/g, '').replace('−', '-').replace('±', '').replace(/°$/, '').replace(/m2$|m²$/, '')
  if (!/^[+-]?[0-9]+([.,][0-9]+)?$/.test(t)) return undefined
  const n = Number(t.replace(',', '.'))
  if (!Number.isFinite(n)) return undefined
  if (kind === 'ANGLE' || unit === 'deg' || kind === 'AREA') return n
  if (unit === 'cm') return Math.round(n) / 100
  if (unit === 'mm') return n / 1000
  if (unit === 'm') return n
  return undefined
}

// ---- the analyzer's table ---------------------------------------------------------------------------------------

export type LocalItem = { itemId: string; frameId: string; dimensionId: string; latticeId?: string; literal: string; valueCm?: number; status: string; axis: 'X' | 'Y'; fromPx: number; toPx: number; atPx?: number; box?: { x0: number; y0: number; x1: number; y1: number }; chainId?: string; /** v3.54.15: the chain's way up was not settled; the label's reading the other way up. */ otherWayUp?: string }

/**
 * What the analyzer read on the given frames: every dimension observation in the way up its chain decided, its label's
 * box, the line it measured.
 *
 * v3.54.15: a reading the analyzer made the OTHER way up from the one its chain decided on evidence is not the analyzer's
 * claim — "0051" is "1500" read half a turn round on a sheet whose horizontal text was found upright — and is not shown
 * as one. Where no evidence settled the way up (`UNDECIDED`), the item is shown with the label's reading the other way
 * up beside it, so the check sees both and settles it from the drawing. The item ids count every observation, so an id
 * means the same observation whatever is left out.
 */
export function localTableOf(metrics: MetricEvidenceSet, frameIds: readonly string[]): LocalItem[] {
  const lat = new Map((metrics.numericLattices ?? []).map((l) => [l.id, l]))
  const chains = new Map((metrics.chains ?? []).map((c) => [c.id, c]))
  const decided = new Map((metrics.metricSolutions ?? []).flatMap((s) => (s.orientationDecisions ?? []).map((o) => [o.chainId, o] as const)))
  const all = metrics.dimensionObservations ?? []
  const out: LocalItem[] = []
  let n = 0
  for (const d of all) {
    if (!frameIds.includes(d.frameId)) continue
    n++
    const way = (d as { orientation?: string }).orientation
    const decision = d.chainId ? decided.get(d.chainId) : undefined
    if (decision && way && decision.chosen && decision.decidedBy !== 'UNDECIDED' && way !== decision.chosen) continue
    const other = decision && way && decision.decidedBy === 'UNDECIDED'
      ? all.find((x) => x.frameId === d.frameId && x.chainId === d.chainId && (x as { orientation?: string }).orientation !== way && x.fromPx === d.fromPx && x.toPx === d.toPx)?.rawText
      : undefined
    const latticeId = (d as { ocr?: { latticeId?: string } }).ocr?.latticeId
    const l = latticeId ? lat.get(latticeId) : undefined
    const chain = d.chainId ? chains.get(d.chainId) : undefined
    out.push({ itemId: `L${n}`, frameId: d.frameId, dimensionId: d.id, ...(latticeId ? { latticeId } : {}), literal: d.rawText, ...(typeof d.valueCm === 'number' ? { valueCm: d.valueCm } : {}), status: d.status, axis: d.axis as 'X' | 'Y', fromPx: d.fromPx, toPx: d.toPx, ...(chain ? { atPx: (chain as { baselinePx: number }).baselinePx } : {}), ...(l ? { box: l.box } : {}), ...(d.chainId ? { chainId: d.chainId } : {}), ...(other !== undefined && other !== d.rawText ? { otherWayUp: other } : {}) })
  }
  return out
}

export type LocalVerdict = { itemId: string; verdict: 'AGREES' | 'DISAGREES' | 'UNREADABLE' | 'INSUFFICIENT_EVIDENCE'; sourceLiteral: string | null; why: string; proposal?: { literal: string; scope: string } | null }
export type LocalCheck = { frameId: string; raw: unknown; verdicts: LocalVerdict[]; refused: string[]; usd: number; requestId?: string; promptVersion: string }

/** Stage 2: the analyzer's readings drawn on the picture, a verdict per item (this stage has seen the analyzer). */
export async function verifyLocal(ctx: Ctx, frames: readonly MetricFrame[], table: readonly LocalItem[]): Promise<LocalCheck[]> {
  const out: LocalCheck[] = []
  for (const f of frames) {
    // at most 40 items a picture, the longest lines first (the whole and body dimensions); the rest stay unchecked
    const items = table
      .filter((t) => t.frameId === f.frameId && t.box)
      .sort((a, b) => Math.abs(b.toPx - b.fromPx) - Math.abs(a.toPx - a.fromPx) || (a.itemId < b.itemId ? -1 : 1))
      .slice(0, VERIFY_MAX_ITEMS)
    if (items.length === 0) continue
    const pic = pictureOf(f.raster, (data, w, h, k) => {
      const put = (x: number, y: number, c: [number, number, number]): void => {
        const xi = Math.round(x / k)
        const yi = Math.round(y / k)
        if (xi < 0 || yi < 0 || xi >= w || yi >= h) return
        const i = (yi * w + xi) * 4
        data[i] = c[0]
        data[i + 1] = c[1]
        data[i + 2] = c[2]
      }
      for (const t of items) {
        const b = t.box as NonNullable<LocalItem['box']>
        for (let x = b.x0 - 3; x <= b.x1 + 3; x++) for (const y of [b.y0 - 3, b.y1 + 3]) put(x, y, [220, 0, 200])
        for (let y = b.y0 - 3; y <= b.y1 + 3; y++) for (const x of [b.x0 - 3, b.x1 + 3]) put(x, y, [220, 0, 200])
        if (t.atPx !== undefined) for (let s = Math.min(t.fromPx, t.toPx); s <= Math.max(t.fromPx, t.toPx); s++) for (const d of [-1, 0, 1]) (t.axis === 'X' ? put(s, t.atPx + d, [0, 190, 230]) : put(t.atPx + d, s, [0, 190, 230]))
      }
    })
    const lines = items.map((t) => `${t.itemId}: box at (${Math.round((t.box as NonNullable<LocalItem['box']>).x0 / pic.scale)}, ${Math.round((t.box as NonNullable<LocalItem['box']>).y0 / pic.scale)}) px; the analyzer read "${t.literal}"${t.valueCm !== undefined ? ` = ${t.valueCm} cm` : ''}${t.otherWayUp !== undefined ? ` (which way up it reads was not settled: the other way up it reads "${t.otherWayUp}")` : ''}; status ${t.status}; ${t.atPx !== undefined ? `measured line along ${t.axis === 'X' ? 'x' : 'y'} from ${Math.round(t.fromPx / pic.scale)} to ${Math.round(t.toPx / pic.scale)} px` : 'no measured line'}`)
    const content = [
      { type: 'text', text: `The analyzer's readings on this ${f.kind === 'PLAN' ? 'floor plan' : 'section'} (picture ${pic.width} × ${pic.height} px):\n${lines.join('\n')}` },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: Buffer.from(pic.png).toString('base64') } },
    ]
    const r = await send(ctx, `metric verify ${f.frameId}`, METRIC_VERIFY_SYSTEM, content, VERIFY_TOOL, 1)
    if ('failed' in r) {
      out.push({ frameId: f.frameId, raw: null, verdicts: [], refused: [r.failed], usd: 0, promptVersion: METRIC_VERIFY_PROMPT_VERSION })
      continue
    }
    const raw = toolInput(r.turn, VERIFY_TOOL.name) as { verdicts?: unknown[] } | undefined
    const refused: string[] = []
    const verdicts: LocalVerdict[] = []
    const known = new Set(items.map((t) => t.itemId))
    for (const v of raw?.verdicts ?? []) {
      const x = v as LocalVerdict
      if (!x || typeof x.itemId !== 'string' || !known.has(x.itemId) || !['AGREES', 'DISAGREES', 'UNREADABLE', 'INSUFFICIENT_EVIDENCE'].includes(x.verdict) || typeof x.why !== 'string' || x.why.trim().length < 8) {
        refused.push(`a verdict without a known item, a verdict or a reason: ${JSON.stringify(v).slice(0, 120)}`)
        continue
      }
      verdicts.push({ itemId: x.itemId, verdict: x.verdict, sourceLiteral: x.sourceLiteral ?? null, why: x.why, ...(x.proposal ? { proposal: x.proposal } : {}) })
    }
    const missing = items.filter((t) => !verdicts.some((v) => v.itemId === t.itemId)).length
    if (missing > 0) refused.push(`${missing} item(s) got no verdict: they stay unchecked`)
    out.push({ frameId: f.frameId, raw, verdicts, refused, usd: r.usd, ...(r.turn.requestId ? { requestId: r.turn.requestId } : {}), promptVersion: METRIC_VERIFY_PROMPT_VERSION })
  }
  return out
}

// ---- resolution ---------------------------------------------------------------------------------------------------

export type MetricDecision = {
  itemId?: string
  observationId?: string
  frameId: string
  local?: string
  api?: string
  verdict?: LocalVerdict['verdict']
  decision: 'AGREES' | 'CORRECTED' | 'RETAINED' | 'UNRESOLVED' | 'NEW_SPAN' | 'NOT_MATCHED' | 'LEVEL_HANDED'
  witness?: string
  why: string
}
export type MetricResolution = { resolverVersion: string; decisions: MetricDecision[]; readings: ConsultedReading[]; spans: ConsultedSpan[]; /** 1.2.0: printed level marks handed to the section's ladder (admitted or refused by the drawing, not here). */ levels?: ConsultedLevel[] }

const centre = (b: { x0: number; y0: number; x1: number; y1: number }): [number, number] => [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2]

/**
 * Stage 3, deterministic. An API reading joins the analyzer's label whose text box it covers (centres within the
 * larger of 12 px and the label's height). Equal values: AGREES. A different value is handed to the analyzer only with
 * a witness that is neither the API nor the label itself:
 *   CHAIN — the label's chain closes on its parent dimension with the API value and not with the analyzer's;
 *   SCALE — the label's line, at the frame's scale settled by OTHER labels, measures the API value (within 3 %, 4 cm)
 *           and not the analyzer's.
 * The second request's DISAGREES is recorded, never counted as a witness (the same reader twice is one reader).
 */
export function resolveMetric(input: { metrics: MetricEvidenceSet; table: readonly LocalItem[]; reads: readonly IndependentRead[]; checks: readonly LocalCheck[]; consultant: { engine: string; model: string }; /** v1.1.0: the page's published footprint area (m²), text beside the drawings — a witness neither reader produced. */ publishedFootprintM2?: number }): MetricResolution {
  const decisions: MetricDecision[] = []
  const readings: ConsultedReading[] = []
  const spans: ConsultedSpan[] = []
  const verdictOf = new Map(input.checks.flatMap((c) => c.verdicts.map((v) => [v.itemId, v] as const)))
  const used = new Set<string>()
  const obsAll = input.reads.flatMap((r) => r.observations)
  for (const t of input.table) {
    if (!t.box) continue
    const [cx, cy] = centre(t.box)
    const tol = Math.max(12, t.box.y1 - t.box.y0, t.box.x1 - t.box.x0) * 0.75 + 4
    const match = obsAll
      .filter((o) => o.frameId === t.frameId && o.kind === 'LENGTH' && !used.has(o.id))
      .map((o) => ({ o, d: Math.hypot((o.labelBox[0] + o.labelBox[2]) / 2 - cx, (o.labelBox[1] + o.labelBox[3]) / 2 - cy) }))
      .filter((x) => x.d <= tol)
      .sort((a, b) => a.d - b.d || (a.o.id < b.o.id ? -1 : 1))[0]?.o
    const verdict = verdictOf.get(t.itemId)
    if (!match) {
      decisions.push({ itemId: t.itemId, frameId: t.frameId, local: t.literal, ...(verdict ? { verdict: verdict.verdict } : {}), decision: 'NOT_MATCHED', why: 'the independent read reported no dimension at this label: the analyzer\'s reading stands' })
      continue
    }
    used.add(match.id)
    const apiCm = match.value !== null ? Math.round(match.value * 100 * 10) / 10 : undefined
    const base = { itemId: t.itemId, observationId: match.id, frameId: t.frameId, local: t.literal, api: match.literal, ...(verdict ? { verdict: verdict.verdict } : {}) }
    if (apiCm === undefined || match.status !== 'PRINTED') {
      decisions.push({ ...base, decision: 'RETAINED', why: `the API reading is ${match.status}${apiCm === undefined ? ' with no value' : ''}: not a printed fact, the analyzer's reading stands` })
      continue
    }
    if (t.valueCm !== undefined && Math.abs(t.valueCm - apiCm) <= 0.5) {
      decisions.push({ ...base, decision: 'AGREES', why: `both read ${apiCm} cm${t.status === 'ACCEPTED' ? '' : ` (the analyzer's own status: ${t.status})`}` })
      if (t.status !== 'ACCEPTED' && t.latticeId) readings.push({ proposalId: `mr:${match.id}`, frameId: t.frameId, latticeId: t.latticeId, literal: match.literal.replace(/\s/g, ''), consultant: input.consultant })
      continue
    }
    const scaleOrChain = witnessOf(input.metrics, input.table, t, apiCm)
    const witness = scaleOrChain.ok ? scaleOrChain : footprintWitness(match, obsAll, t, input.publishedFootprintM2) ?? scaleOrChain
    if (!witness.ok) {
      decisions.push({ ...base, decision: 'UNRESOLVED', why: `the API reads ${apiCm} cm, the analyzer ${t.valueCm ?? 'nothing'}: ${witness.why}${verdict?.verdict === 'DISAGREES' ? '; the check also disagrees, but the same reader twice is not a second witness' : ''}` })
      continue
    }
    if (!t.latticeId || !/^[0-9]{1,5}([.,][0-9]{1,3})?$/.test(match.literal.replace(/\s/g, ''))) {
      decisions.push({ ...base, decision: 'UNRESOLVED', witness: witness.kind, why: `${witness.why}, but the label has no lattice to hand a reading to (or the literal is not a plain length): named, not applied` })
      continue
    }
    readings.push({ proposalId: `mr:${match.id}`, frameId: t.frameId, latticeId: t.latticeId, literal: match.literal.replace(/\s/g, ''), consultant: input.consultant })
    decisions.push({ ...base, decision: 'CORRECTED', witness: witness.kind, why: witness.why })
    // v1.1.0: a whole-house dimension witnessed by the page's area is also measured on its own line (its ends), so the
    // metric layer can weigh it beside the other overall as two consulted dimensions on different lines
    if (witness.kind === 'FOOTPRINT' && match.ends) {
      used.add(`span:${match.id}`)
      spans.push({ proposalId: `ms:${match.id}`, frameId: match.frameId, literal: match.literal.replace(/\s/g, ''), unit: match.unit === 'm' ? 'm' : match.unit === 'mm' ? 'mm' : 'cm', from: { x: match.ends.from[0], y: match.ends.from[1] }, to: { x: match.ends.to[0], y: match.ends.to[1] }, consultant: input.consultant })
    }
  }
  // API dimensions the analyzer has no label for: whole dimensions and body spans with both ends, handed as spans
  for (const o of obsAll) {
    if (used.has(o.id) || o.kind !== 'LENGTH' || o.status !== 'PRINTED' || !o.ends || o.value === null) continue
    if (!['WHOLE_HOUSE', 'BODY', 'WING', 'SEGMENT'].includes(o.scope)) continue
    if (!/^[0-9]{1,5}([.,][0-9]{1,3})?$/.test(o.literal.replace(/\s/g, ''))) continue
    spans.push({ proposalId: `ms:${o.id}`, frameId: o.frameId, literal: o.literal.replace(/\s/g, ''), unit: o.unit === 'm' ? 'm' : o.unit === 'mm' ? 'mm' : 'cm', from: { x: o.ends.from[0], y: o.ends.from[1] }, to: { x: o.ends.to[0], y: o.ends.to[1] }, consultant: input.consultant })
    decisions.push({ observationId: o.id, frameId: o.frameId, api: o.literal, decision: 'NEW_SPAN', why: `a printed ${o.scope.toLowerCase().replace(/_/g, ' ')} dimension the analyzer read no label for: handed as a span, the metric layer snaps and judges it` })
  }
  // 1.2.0: every printed level mark with a text box is handed to the section it was read on; the drawing decides
  // (`external-levels.ts`: the level symbol under it, one ladder, a printed ±0,00). No LOCAL agreement is required —
  // the witness is the drawing's own geometry, not a second reader.
  const levels: ConsultedLevel[] = []
  for (const o of obsAll) {
    if (o.kind !== 'LEVEL' || o.status !== 'PRINTED' || o.value === null) continue
    levels.push({ proposalId: `ml:${o.id}`, frameId: o.frameId, literal: o.literal.trim(), box: { x0: o.labelBox[0], y0: o.labelBox[1], x1: o.labelBox[2], y1: o.labelBox[3] }, model: input.consultant.model })
    decisions.push({ observationId: o.id, frameId: o.frameId, api: o.literal, decision: 'LEVEL_HANDED', why: `a printed level mark (${o.value} m${o.role ? `, ${o.role}` : ''}): handed to the section's ladder, which admits it only by the drawing` })
  }
  return { resolverVersion: METRIC_RESOLVER_VERSION, decisions, readings, spans, levels }
}

/**
 * v1.1.0 FOOTPRINT: a whole-house dimension read by the API is witnessed by the page's published footprint area when
 * the perpendicular whole-house dimension printed on the same drawing, multiplied by it, gives that area (0.5 %), the two
 * lines measure both readings at one scale of the picture (3 %), and the analyzer's own reading does not give the area.
 * The area is printed text beside the drawings, read by neither reader: the same reader's two labels are no witness of
 * each other, but both agreeing with the page's area at one drawing scale is. A footprint that is not a rectangle (a
 * wing, a recess) has no such product, so nothing is witnessed there.
 */
function footprintWitness(o: DimensionObservation, all: readonly DimensionObservation[], t: LocalItem, footprintM2: number | undefined): { ok: true; kind: 'FOOTPRINT'; why: string } | undefined {
  if (!footprintM2 || footprintM2 <= 0 || o.scope !== 'WHOLE_HOUSE' || !o.ends || o.value === null || o.status !== 'PRINTED') return undefined
  const len = (x: DimensionObservation): number => (x.ends ? Math.hypot(x.ends.to[0] - x.ends.from[0], x.ends.to[1] - x.ends.from[1]) : 0)
  const cm = (x: DimensionObservation): number => Math.round((x.value as number) * 1000) / 10
  const other = all.find((q) => q.id !== o.id && q.frameId === o.frameId && q.kind === 'LENGTH' && q.scope === 'WHOLE_HOUSE' && q.status === 'PRINTED' && q.value !== null && q.ends && q.axis !== o.axis && q.axis !== 'OBLIQUE' && o.axis !== 'OBLIQUE')
  if (!other || len(o) < 20 || len(other) < 20) return undefined
  const kA = cm(o) / len(o)
  const kB = cm(other) / len(other)
  if (Math.abs(kA - kB) / Math.max(kA, kB) > 0.03) return undefined
  const tol = Math.max(0.005 * footprintM2, 0.1)
  const area = (cm(o) * cm(other)) / 1e4
  const localArea = t.valueCm !== undefined ? (t.valueCm * cm(other)) / 1e4 : undefined
  if (Math.abs(area - footprintM2) > tol || (localArea !== undefined && Math.abs(localArea - footprintM2) <= tol)) return undefined
  return { ok: true, kind: 'FOOTPRINT', why: `the page's published footprint ${footprintM2} m² is ${cm(o)} × ${cm(other)} cm (${area.toFixed(3)} m²), both lines at one scale of the drawing (${kA.toFixed(4)} / ${kB.toFixed(4)} cm/px); ${t.valueCm ?? 'no reading'} would give ${localArea?.toFixed(2) ?? '—'} m²` }
}

function witnessOf(metrics: MetricEvidenceSet, table: readonly LocalItem[], t: LocalItem, apiCm: number): { ok: true; kind: 'CHAIN' | 'SCALE'; why: string } | { ok: false; why: string } {
  // CHAIN: the other pieces of the same chain read by the analyzer, and a parent dimension spanning them
  if (t.chainId) {
    const pieces = table.filter((x) => x.chainId === t.chainId && x.frameId === t.frameId && x.valueCm !== undefined)
    const lo = Math.min(...pieces.map((x) => Math.min(x.fromPx, x.toPx)))
    const hi = Math.max(...pieces.map((x) => Math.max(x.fromPx, x.toPx)))
    const parent = table.find((x) => x.frameId === t.frameId && x.axis === t.axis && x !== t && x.chainId !== t.chainId && x.valueCm !== undefined && Math.abs(Math.min(x.fromPx, x.toPx) - lo) <= 6 && Math.abs(Math.max(x.fromPx, x.toPx) - hi) <= 6)
    if (parent && pieces.length >= 2) {
      const others = pieces.filter((x) => x !== t).reduce((s, x) => s + (x.valueCm as number), 0)
      const withApi = Math.abs(others + apiCm - (parent.valueCm as number))
      const withLocal = t.valueCm === undefined ? Infinity : Math.abs(others + t.valueCm - (parent.valueCm as number))
      if (withApi <= 1 && withLocal > 1) return { ok: true, kind: 'CHAIN', why: `the chain closes on its overall ${parent.valueCm} cm with ${apiCm} (the other pieces sum to ${others}) and not with ${t.valueCm ?? 'no reading'}` }
    }
  }
  // SCALE: the frame's scale settled by other labels
  const sol = (metrics.metricSolutions ?? []).find((s) => s.frameId === t.frameId) as { cmPerPixelX?: number; cmPerPixelY?: number; confidence?: string } | undefined
  const k = t.axis === 'X' ? sol?.cmPerPixelX : sol?.cmPerPixelY
  const settled = sol?.confidence && sol.confidence !== 'INCONCLUSIVE' && sol.confidence !== 'UNKNOWN'
  if (k && settled) {
    const measured = Math.abs(t.toPx - t.fromPx) * k
    const tolCm = Math.max(4, 0.03 * apiCm)
    // the label must not be the only anchor of that scale (the same anchor is no test of itself)
    const anchors = (metrics.coordinateRegistrations ?? []).flatMap((r) => (r as { anchors?: Array<{ evidenceIds?: string[] }> }).anchors ?? [])
    const selfAnchor = anchors.length <= 1 && anchors.some((a) => (a.evidenceIds ?? []).some((id) => id.includes(t.dimensionId.slice(-10))))
    if (!selfAnchor && Math.abs(measured - apiCm) <= tolCm && (t.valueCm === undefined || Math.abs(measured - t.valueCm) > tolCm)) return { ok: true, kind: 'SCALE', why: `the label's line measures ${measured.toFixed(1)} cm at the scale other labels settle (${k.toFixed(4)} cm/px, ${sol?.confidence}): ${apiCm} fits, ${t.valueCm ?? 'no reading'} does not` }
    return { ok: false, why: `at the settled scale the line measures ${measured.toFixed(1)} cm: ${Math.abs(measured - apiCm) <= tolCm ? 'both readings fit or the label anchors the scale itself' : `the API's ${apiCm} does not fit either`}` }
  }
  return { ok: false, why: 'no closing chain and no scale settled by other labels on this frame: no witness' }
}

// ---- what was built ---------------------------------------------------------------------------------------------

export type BuiltMeasure = { outlineX: number; outlineZ: number; levels: Array<{ id: string; elevation: number; height: number }>; ridge?: number; eaves?: number; openings: number; walls: number }
/** The model's spans and heights as built: the exterior walls' box (outer faces), levels, the highest and lowest roof points. */
export function measureBuilt(model: CanonicalBuildingModel, scene: CompiledScene): BuiltMeasure {
  const r3 = (v: number): number => Math.round(v * 1000) / 1000
  const ext = new Set(model.walls.filter((w) => (w as { exterior?: boolean; role?: string }).role !== 'INTERIOR' && !/iwall|partition|nib|party/.test(w.id)).map((w) => w.id))
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, rTop = -Infinity
  // the main roof: the roof object with the largest surface; its lowest point is the eaves (a wing's lower eaves are not)
  const roofArea = new Map<string, number>()
  const roofLow = new Map<string, number>()
  for (const m of scene.meshes) {
    if (m.part === 'WALL' && ext.has(m.objectId)) for (const t of m.triangles) for (const p of [t.a, t.b, t.c]) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z) }
    if (m.part === 'ROOF' || m.part === 'ROOF_PLANE') for (const t of m.triangles) {
      const ux = t.b.x - t.a.x, uy = t.b.y - t.a.y, uz = t.b.z - t.a.z, vx = t.c.x - t.a.x, vy = t.c.y - t.a.y, vz = t.c.z - t.a.z
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
      const a2 = Math.hypot(nx, ny, nz)
      // the roof's top surface only (its underside and its edge faces are its thickness, not its eaves)
      if (a2 < 1e-9 || ny / a2 < 0.3) continue
      roofArea.set(m.objectId, (roofArea.get(m.objectId) ?? 0) + a2 / 2)
      for (const p of [t.a, t.b, t.c]) { rTop = Math.max(rTop, p.y); roofLow.set(m.objectId, Math.min(roofLow.get(m.objectId) ?? Infinity, p.y)) }
    }
  }
  const main = [...roofArea].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0]
  const rLow = main !== undefined ? (roofLow.get(main) as number) : Infinity
  return {
    outlineX: r3(x1 - x0),
    outlineZ: r3(z1 - z0),
    levels: model.levels.map((l) => ({ id: l.id, elevation: l.elevation, height: l.height })),
    ...(rTop > -Infinity ? { ridge: r3(rTop), ...(rLow < Infinity ? { eaves: r3(rLow) } : {}) } : {}),
    openings: model.openings.length,
    walls: ext.size,
  }
}
