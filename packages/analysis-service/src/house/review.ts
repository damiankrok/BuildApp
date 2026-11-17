/**
 * v3.54.4 — the check of the BUILT house against its sources, and bounded corrections of the observations.
 *
 * The reader is shown the elevations again beside the model's own neutral views and the program's findings (checks,
 * what was held and why), and answers with differences and with typed corrections of OBSERVATIONS — a side, a roof, a
 * wall end, an opening box. It never edits the model. Each correction is applied alone to a copy of the observations,
 * the whole house is resolved and built again, and the correction stands only if the result is not worse by the
 * program's own measures; otherwise it is refused with a code. At most `reviewRounds` rounds.
 *
 * v3.54.5 — corrections that belong together are one transaction. The reader may label them with a `group`; and opening
 * corrections of one elevation that were each refused alone are tried once more together: narrowing one opening and
 * adding its neighbour is right only as a pair, and the first step judged against the house as it was before the
 * second is refused for a clash the second removes. A group is applied to a copy, the whole house is validated once
 * after all of it, and it stands or falls whole (nothing of a refused group remains). Every proposal carries the
 * revision it was made against; an answer about another revision changes nothing; an opening added where one is
 * already listed corrects that opening instead of making a second one.
 */
import { createHash } from 'node:crypto'
import { encodeJpeg } from '@buildapp/source-package'
import { renderModelViews, renderSideInFrame } from '../consult/model-views.js'
import { compileHouse } from './describe.js'
import type { SceneMeasure, SceneSide } from './measure.js'
import type { CompiledHouse } from './describe.js'
import { HOUSE_READING_LIMITS, READING_TOOLS, ReadingFailed, ask } from './read.js'
import type { ReadingContext, Selection } from './read.js'
import { sentPicture } from './pictures.js'
import type { SentPicture } from './pictures.js'

const box = { type: 'object', additionalProperties: false, required: ['x0', 'y0', 'x1', 'y1'], properties: { x0: { type: 'number' }, y0: { type: 'number' }, x1: { type: 'number' }, y1: { type: 'number' } } }
const side = { type: 'string', enum: ['FRONT', 'REAR', 'LEFT', 'RIGHT'] }
export const REVIEW_MAX_CORRECTIONS = 12
export const REVIEW_TOOL = {
  name: 'review_model',
  description: 'Differences between the built model and the sources, and corrections of what was READ from the sources.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['revision', 'verdict', 'differences', 'corrections'],
    properties: {
      revision: { type: 'string', description: 'The revision id you were given, copied.' },
      verdict: { type: 'string', enum: ['MATCHES', 'DIFFERS'], description: 'MATCHES: the exterior of the model agrees with the sources in outline, bodies, heights, roofs and the placement of openings, as far as a simple massing model can.' },
      differences: {
        type: 'array',
        maxItems: 12,
        description: 'In this order: orientation and overall size, bodies, levels and heights, roofs, openings, features.',
        items: { type: 'object', additionalProperties: false, required: ['scope', 'what'], properties: { scope: { type: 'string', enum: ['ORIENTATION', 'METRIC', 'BODIES', 'LEVELS', 'ROOFS', 'OPENINGS', 'FEATURES'] }, what: { type: 'string', maxLength: 240 } } },
      },
      defects: {
        type: 'array',
        maxItems: 12,
        description: 'v3.54.7: every important difference as a record, the most important first. Its region is a box in pixels of the ELEVATION picture named; the model picture of that side is drawn in the same frame, so the same box is the same place on the model.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'side', 'feature', 'meaning', 'weight', 'evidence', 'fix'],
          properties: {
            id: { type: 'string', maxLength: 8, description: 'd1, d2, …' },
            side: side,
            picture: { type: 'integer', minimum: 1, description: 'The elevation picture it is seen on.' },
            box: { ...box, description: 'The region, in pixels of that elevation picture (and of the model picture of that side).' },
            feature: { type: 'string', enum: ['GABLE_FRAME', 'LOGGIA_OR_RECESS', 'BALCONY', 'SUPPORTS', 'GLAZING_SHAPE', 'OPENING', 'GARAGE', 'BODY', 'ROOF', 'BAND', 'OTHER'] },
            meaning: { type: 'string', enum: ['MISSING', 'EXTRA', 'WRONG_SHAPE', 'WRONG_POSITION', 'WRONG_SIZE', 'WRONG_KIND'], description: 'What the MODEL has wrong against the source: MISSING = the source shows it and the model has not; EXTRA = the model has what the source does not.' },
            weight: { type: 'string', enum: ['KEY', 'MAJOR', 'MINOR'], description: 'KEY: a feature that makes the house recognisable (a frame, a recess, the shape of a large glazing, the garage).' },
            evidence: { type: 'string', maxLength: 240 },
            fix: { type: 'string', enum: ['CORRECTION', 'NEEDS_CLOSE_UP', 'UNRESOLVED'], description: 'CORRECTION: corrections below fix it (list their indices). NEEDS_CLOSE_UP: ask for closeUps of its box. UNRESOLVED: no correction of what was read can express it.' },
            corrections: { type: 'array', maxItems: 6, items: { type: 'integer', minimum: 0 }, description: 'Indices (0-based) into corrections that address it.' },
          },
        },
      },
      closeUps: { type: 'array', maxItems: 3, description: 'Regions to be shown enlarged next round: the elevation and the model in the same frame.', items: { type: 'object', additionalProperties: false, required: ['picture', 'box'], properties: { picture: { type: 'integer', minimum: 1 }, box: box } } },
      corrections: {
        type: 'array',
        maxItems: REVIEW_MAX_CORRECTIONS,
        description: 'Only where a reading of the SOURCE was wrong or missing and you can state the right one from the pictures. Coordinates in the pixels of the elevation picture named.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['op', 'why'],
          properties: {
            op: { type: 'string', enum: ['SET_ELEVATION_SIDE', 'SET_ROOF', 'SET_BODY_STOREYS', 'SET_ELEVATION_BODY', 'ADD_OPENING', 'REMOVE_OPENING', 'SET_OPENING_HEAD', 'SET_FEATURE', 'REMOVE_FEATURE'] },
            why: { type: 'string', maxLength: 240 },
            group: { type: 'string', maxLength: 16, description: 'The same short label on corrections that are only right TOGETHER (narrow one opening and add the one beside it; remove a dormer and add the windows it hid). They are applied as one change: all or none.' },
            picture: { type: 'integer', minimum: 1, description: 'The elevation picture (its number in THIS message).' },
            side: side,
            mirrored: { type: 'boolean' },
            bodyId: { type: 'string' },
            roofKind: { type: 'string', enum: ['GABLE', 'HIP', 'SHED', 'FLAT'] },
            ridge: { type: 'string', enum: ['ALONG_FRONT', 'FRONT_TO_BACK', 'NA'] },
            storeys: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 3 }, minItems: 1, maxItems: 4 },
            leftX: { type: 'number' },
            rightX: { type: 'number' },
            eavesY: { type: ['number', 'null'] },
            ridgeY: { type: ['number', 'null'] },
            id: { type: 'string', description: 'REMOVE_*: the id to remove, as listed. ADD_OPENING: omit for a NEW opening; give the id of a listed opening to CORRECT that opening (move it, resize it, change its kind) — never add a second opening where one is listed. SET_OPENING_HEAD: the listed opening. SET_FEATURE: the listed id to correct it — the SAME id with another kind REPLACES that reading (a balcony that is really a recessed loggia: its id, kind LOGGIA) — or a new id.' },
            kind: { type: 'string', description: 'For ADD_OPENING: WINDOW, DOOR, GLAZED_DOOR, GARAGE_DOOR. For SET_FEATURE: WALL_DORMER_GABLE, ROOF_DORMER_GABLE, ROOF_DORMER_SHED, BALCONY, LOGGIA, GABLE_FRAME, CANOPY.' },
            headLeftY: { type: ['number', 'null'], description: 'SET_OPENING_HEAD: the row of the top edge at the opening\'s LEFT side (a head under a roof slope, in a gable).' },
            headRightY: { type: ['number', 'null'], description: 'SET_OPENING_HEAD: the row of the top edge at its RIGHT side.' },
            apexX: { type: ['number', 'null'], description: 'SET_OPENING_HEAD: for a head rising to a point between its sides, the column of the point (its row is the top of the box).' },
            bandPx: { type: ['number', 'null'], description: 'SET_FEATURE GABLE_FRAME: the band\'s thickness along the rakes, in pixels measured vertically.' },
            legPx: { type: ['number', 'null'], description: 'SET_FEATURE GABLE_FRAME: the width of each leg, in pixels.' },
            posts: { type: ['boolean', 'null'], description: 'SET_FEATURE BALCONY / LOGGIA / CANOPY: true only when the picture SHOWS supports under it.' },
            box: box,
            level: { type: 'integer', minimum: 0, maximum: 3 },
            apexY: { type: ['number', 'null'] },
          },
        },
      },
    },
  },
} as const

export type ReviewCorrection = { op: string; why: string; group?: string; picture?: number; side?: string; mirrored?: boolean; bodyId?: string; roofKind?: string; ridge?: string; storeys?: number[]; leftX?: number; rightX?: number; eavesY?: number | null; ridgeY?: number | null; id?: string; kind?: string; box?: { x0: number; y0: number; x1: number; y1: number }; level?: number; apexY?: number | null; headLeftY?: number | null; headRightY?: number | null; apexX?: number | null; bandPx?: number | null; legPx?: number | null; posts?: boolean | null }
export type ReviewDefect = { id: string; side: string; picture?: number; box?: { x0: number; y0: number; x1: number; y1: number }; feature: string; meaning: string; weight: 'KEY' | 'MAJOR' | 'MINOR'; evidence: string; fix: 'CORRECTION' | 'NEEDS_CLOSE_UP' | 'UNRESOLVED'; corrections?: number[] }
export type ReviewAnswer = { revision: string; verdict: 'MATCHES' | 'DIFFERS'; differences: Array<{ scope: string; what: string }>; corrections: ReviewCorrection[]; defects?: ReviewDefect[]; closeUps?: Array<{ picture: number; box: { x0: number; y0: number; x1: number; y1: number } }> }
export type Proposal = { round: number; op: string; subject: string; why: string; state: 'APPLIED' | 'REJECTED'; code?: string; consumer: string; effect: string; /** v3.54.5: the transaction it belonged to, and the observations revision it was made against and (when applied) led to. */ group?: string; baseRevision?: string; revision?: string }

type Obs = { observations: { elevations: Array<Record<string, unknown> & { id: string; picture: string; bodies: Array<Record<string, unknown>>; openings: Array<Record<string, unknown>>; features: Array<Record<string, unknown>> }>; roofs: Array<Record<string, unknown>>; outlines: Array<Record<string, unknown>> } }
/** The revision of the observations: what was read, not the bookkeeping of which request read it. */
const revisionOf = (doc: unknown): string => createHash('sha256').update(JSON.stringify((doc as Obs).observations, (k, v) => (k === 'readIn' ? undefined : v))).digest('hex').slice(0, 12)
const OPENING_KINDS = ['WINDOW', 'DOOR', 'GLAZED_DOOR', 'GARAGE_DOOR']
const FEATURE_KINDS = ['WALL_DORMER_GABLE', 'ROOF_DORMER_GABLE', 'ROOF_DORMER_SHED', 'BALCONY', 'LOGGIA', 'GABLE_FRAME', 'CANOPY']

/** One correction on a copy of the observations; undefined with a code when it names nothing that exists. */
export function applyCorrection(doc: unknown, c0: ReviewCorrection, sent: SentPicture[]): { doc: unknown; subject: string } | { code: string; why: string } {
  let c = c0
  const next = JSON.parse(JSON.stringify(doc)) as Obs
  const o = next.observations
  const bodies = new Set(o.outlines.filter((x) => x.what === 'BODY').map((x) => String(x.bodyId)))
  const pic = c.picture !== undefined ? sent[c.picture - 1] : undefined
  const el = pic ? o.elevations.find((e) => e.picture === pic.picture.id) : undefined
  const k = pic ? 1 / pic.scale : 1
  const r1 = (v: number): number => Math.round(v * k * 10) / 10
  const needEl = (): { code: string; why: string } | undefined => (el ? undefined : { code: 'WRONG_BINDING', why: `picture ${c.picture} is not an elevation that was read` })
  const B = (b: { x0: number; y0: number; x1: number; y1: number }): { x0: number; y0: number; x1: number; y1: number } => ({ x0: r1(Math.min(b.x0, b.x1)), y0: r1(Math.min(b.y0, b.y1)), x1: r1(Math.max(b.x0, b.x1)), y1: r1(Math.max(b.y0, b.y1)) })
  switch (c.op) {
    case 'SET_ELEVATION_SIDE': {
      if (!el || !c.side) return needEl() ?? { code: 'PARSE_REJECTED', why: 'no side given' }
      el.side = c.side
      el.alternatives = []
      if (typeof c.mirrored === 'boolean') el.mirrored = c.mirrored
      return { doc: next, subject: `${el.id}.side` }
    }
    case 'SET_ROOF': {
      if (!c.bodyId || !bodies.has(c.bodyId) || !c.roofKind) return { code: 'WRONG_BINDING', why: `no body ${c.bodyId} on the plan, or no roof kind` }
      const roof = o.roofs.find((r) => r.bodyId === c.bodyId)
      const ridge = c.roofKind === 'FLAT' || c.roofKind === 'SHED' ? 'NA' : (c.ridge ?? (roof?.ridge as string | undefined) ?? 'UNSURE')
      if (roof) Object.assign(roof, { kind: c.roofKind, ridge })
      else o.roofs.push({ id: `roof-${c.bodyId}`, bodyId: c.bodyId, kind: c.roofKind, ridge, pictures: [], origin: 'API' })
      return { doc: next, subject: `roof of ${c.bodyId}` }
    }
    case 'SET_BODY_STOREYS': {
      const body = o.outlines.find((x) => x.what === 'BODY' && x.bodyId === c.bodyId)
      if (!body || !c.storeys?.length) return { code: 'WRONG_BINDING', why: `no body ${c.bodyId} on the plan, or no storeys` }
      body.storeys = [...new Set(c.storeys.includes(0) ? c.storeys : [0, ...c.storeys])].sort((p, q) => p - q)
      return { doc: next, subject: `storeys of ${c.bodyId}` }
    }
    case 'SET_ELEVATION_BODY': {
      if (!el) return needEl() as { code: string; why: string }
      // v3.54.6: the reviewer names a body's wall ends as a box (x0..x1, its apex at y0) as often as by columns; both
      // say the same thing. A body the plan has not is a binding error; a correction without ends is a parse error.
      if (!c.bodyId || !bodies.has(c.bodyId)) return { code: 'WRONG_BINDING', why: `no body ${c.bodyId} on the plan (bodies: ${[...bodies].join(', ')})` }
      const left = typeof c.leftX === 'number' ? c.leftX : c.box?.x0
      const right = typeof c.rightX === 'number' ? c.rightX : c.box?.x1
      if (typeof left !== 'number' || typeof right !== 'number') return { code: 'PARSE_REJECTED', why: 'a body correction needs its two wall ends (leftX/rightX or a box)' }
      const top = typeof c.ridgeY === 'number' ? c.ridgeY : typeof c.apexY === 'number' ? c.apexY : c.box ? Math.min(c.box.y0, c.box.y1) : null
      const entry = { bodyId: c.bodyId, leftX: r1(Math.min(left, right)), rightX: r1(Math.max(left, right)), eavesY: typeof c.eavesY === 'number' ? r1(c.eavesY) : null, ridgeY: typeof top === 'number' ? r1(top) : null }
      const i = el.bodies.findIndex((b) => b.bodyId === c.bodyId)
      if (i >= 0) el.bodies[i] = entry
      else el.bodies.push(entry)
      return { doc: next, subject: `${el.id} body ${c.bodyId}` }
    }
    case 'ADD_OPENING': {
      if (!el) return needEl() as { code: string; why: string }
      if (!c.box || !c.kind || !OPENING_KINDS.includes(c.kind)) return { code: 'PARSE_REJECTED', why: 'an opening needs a kind and a box' }
      // with the id of an opening that was read: that opening corrected (moved, resized, another kind), not a second one
      const at = c.id ? el.openings.findIndex((x) => x.id === c.id) : -1
      if (at >= 0) {
        const old = el.openings[at]
        el.openings[at] = { id: old.id, kind: c.kind, box: B(c.box), ...(c.bodyId && bodies.has(c.bodyId) ? { bodyId: c.bodyId } : old.bodyId ? { bodyId: old.bodyId } : {}), ...(typeof c.level === 'number' ? { level: c.level } : typeof old.level === 'number' ? { level: old.level } : {}), ...(old.inFeature ? { inFeature: old.inFeature } : {}) }
        return { doc: next, subject: `${el.id}/${String(old.id)} (corrected)` }
      }
      // a retry of an addition lands on the opening the first try made: the same place is the same opening, not a second one
      const nb = B(c.box)
      const same = el.openings.findIndex((x) => {
        const q = x.box as { x0: number; y0: number; x1: number; y1: number } | undefined
        if (!q) return false
        const iw = Math.min(q.x1, nb.x1) - Math.max(q.x0, nb.x0)
        const ih = Math.min(q.y1, nb.y1) - Math.max(q.y0, nb.y0)
        if (iw <= 0 || ih <= 0) return false
        const inter = iw * ih
        return inter / ((q.x1 - q.x0) * (q.y1 - q.y0) + (nb.x1 - nb.x0) * (nb.y1 - nb.y0) - inter) > 0.5
      })
      if (same >= 0) {
        const old = el.openings[same]
        el.openings[same] = { id: old.id, kind: c.kind, box: nb, ...(c.bodyId && bodies.has(c.bodyId) ? { bodyId: c.bodyId } : old.bodyId ? { bodyId: old.bodyId } : {}), ...(typeof c.level === 'number' ? { level: c.level } : typeof old.level === 'number' ? { level: old.level } : {}), ...(old.inFeature ? { inFeature: old.inFeature } : {}) }
        return { doc: next, subject: `${el.id}/${String(old.id)} (same place: corrected, not added)` }
      }
      let n = el.openings.length + 1
      while (el.openings.some((x) => x.id === `o${n}`)) n += 1
      el.openings.push({ id: `o${n}`, kind: c.kind, box: B(c.box), ...(c.bodyId && bodies.has(c.bodyId) ? { bodyId: c.bodyId } : {}), ...(typeof c.level === 'number' ? { level: c.level } : {}) })
      return { doc: next, subject: `${el.id}/o${n}` }
    }
    case 'REMOVE_OPENING': {
      if (!el) return needEl() as { code: string; why: string }
      const i = el.openings.findIndex((x) => x.id === c.id)
      if (i < 0) return { code: 'WRONG_BINDING', why: `no opening ${c.id} on ${el.id}` }
      el.openings.splice(i, 1)
      return { doc: next, subject: `${el.id}/${c.id}` }
    }
    case 'SET_FEATURE': {
      if (!el) return needEl() as { code: string; why: string }
      // v3.54.7: a gable frame named without a box is the gable of the body it edges, as that elevation reads the body
      if (!c.box && c.kind === 'GABLE_FRAME' && c.bodyId) {
        const b = el.bodies.find((x) => x.bodyId === c.bodyId) as { leftX: number; rightX: number; ridgeY: number | null } | undefined
        if (b && typeof b.ridgeY === 'number') c = { ...c, box: { x0: b.leftX / k, x1: b.rightX / k, y0: b.ridgeY / k, y1: Number(el.groundY) / k } }
      }
      if (!c.box || !c.kind || !FEATURE_KINDS.includes(c.kind) || !c.id || !/^[a-z][a-z0-9-]{0,23}$/.test(c.id)) return { code: 'PARSE_REJECTED', why: 'a feature needs an id, a kind this builder has and a box' }
      if (c.kind === 'GABLE_FRAME' && !(typeof c.bandPx === 'number' && c.bandPx > 0)) return { code: 'PARSE_REJECTED', why: 'a gable frame needs the thickness of its band (bandPx)' }
      // v3.54.7: the same id with another kind replaces that reading in one step (a balcony on posts that is a recessed
      // loggia): what depended on the old reading — its posts, its projection — goes with it
      const entry = { id: c.id, kind: c.kind, box: B(c.box), ...(c.bodyId && bodies.has(c.bodyId) ? { bodyId: c.bodyId } : {}), ...(typeof c.eavesY === 'number' ? { eavesY: r1(c.eavesY) } : {}), ...(typeof c.apexY === 'number' ? { apexY: r1(c.apexY) } : {}), ...(typeof c.bandPx === 'number' && c.bandPx > 0 ? { bandPx: r1(c.bandPx) } : {}), ...(typeof c.legPx === 'number' && c.legPx > 0 ? { legPx: r1(c.legPx) } : {}), ...(typeof c.posts === 'boolean' ? { posts: c.posts } : c.kind === 'LOGGIA' ? { posts: false } : {}) }
      const i = el.features.findIndex((x) => x.id === c.id)
      if (i >= 0) el.features[i] = entry
      else el.features.push(entry)
      return { doc: next, subject: `${el.id}/${c.id}` }
    }
    case 'SET_OPENING_HEAD': {
      if (!el) return needEl() as { code: string; why: string }
      const o2 = el.openings.find((x) => x.id === c.id)
      if (!o2) return { code: 'WRONG_BINDING', why: `no opening ${c.id} on ${el.id}` }
      if (typeof c.headLeftY !== 'number' || typeof c.headRightY !== 'number') return { code: 'PARSE_REJECTED', why: 'a head needs the rows of its top edge at both sides' }
      o2.headLeftY = r1(c.headLeftY)
      o2.headRightY = r1(c.headRightY)
      if (typeof c.apexX === 'number') o2.apexX = r1(c.apexX)
      else delete o2.apexX
      // the box reaches the head's highest point
      const bx = o2.box as { x0: number; y0: number; x1: number; y1: number }
      o2.box = { ...bx, y0: Math.min(bx.y0, r1(Math.min(c.headLeftY, c.headRightY))) }
      return { doc: next, subject: `${el.id}/${String(o2.id)} (head)` }
    }
    case 'REMOVE_FEATURE': {
      if (!el) return needEl() as { code: string; why: string }
      const i = el.features.findIndex((x) => x.id === c.id)
      if (i < 0) return { code: 'WRONG_BINDING', why: `no feature ${c.id} on ${el.id}` }
      el.features.splice(i, 1)
      for (const x of el.openings) if (x.inFeature === c.id) delete x.inFeature
      return { doc: next, subject: `${el.id}/${c.id}` }
    }
    default:
      return { code: 'CAPABILITY_MISSING', why: `no consumer for a correction of kind ${c.op}` }
  }
}

const score = (h: CompiledHouse): { failing: Set<string>; trouble: number; built: number } => ({
  failing: new Set(h.document.verification.checks.filter((c) => c.status === 'FAIL').map((c) => c.id)),
  trouble: (h.built?.kernelRefusals.length ?? 0) + (h.built?.refusals.length ?? 0) + h.compileErrors.length + h.document.verification.held.length,
  built: h.bundle ? h.bundle.scene.meshes.length : 0,
})

/** Whether a correction's result stands, by the program's own measures; the code names why not. */
export function acceptCorrection(before: CompiledHouse, after: CompiledHouse, op: string, target?: string, refs: string[] = [], unconsumed: string[] = []): { ok: true; effect: string } | { ok: false; code: string; why: string } {
  if (after.rejected) return { ok: false, code: 'PARSE_REJECTED', why: after.rejected.slice(0, 2).join('; ') }
  if (!after.bundle) return { ok: false, code: 'HELD_BY_DEPENDENCY', why: 'the corrected observations no longer resolve to a geometry' }
  const a = score(before)
  const b = score(after)
  if (after.modelHash === before.modelHash) {
    // nothing was built of it. v3.54.6: the first actual point of loss, in order — the elevation it is on does not
    // register (its content cannot reach a wall), the builder held what it made, or the operation changed nothing
    const unregistered = (after.document.verification.views ?? []).filter((v) => v.elevation && !v.registered && v.why)
    if (target && unregistered.some((v) => v.elevation === target)) {
      const v = unregistered.find((x) => x.elevation === target)
      return { ok: false, code: 'HELD_BY_DEPENDENCY', why: `applied to the observations, but elevation ${target} does not register to the plan (${String(v?.why).slice(0, 160)}): nothing on it reaches a wall` }
    }
    // an opening it set that was agreed and not cut: what stopped the cut (its host wall refused, a conflict) is the reason
    const notCut = (after.document.verification.openings ?? []).filter((x) => x.ref && refs.includes(x.ref) && x.fit === 'NOT_BUILT' && x.why)
    if (notCut.length > 0) return { ok: false, code: 'HELD_BY_DEPENDENCY', why: `applied to the observations and agreed, but not cut: ${notCut[0].ref}: ${String(notCut[0].why).slice(0, 200)}` }
    // what it said that would have changed the model has no consumer: a missing capability, not a correction without effect
    if (unconsumed.length > 0) return { ok: false, code: 'CAPABILITY_MISSING', why: `the built model is the same with it: what it sets that the builder reads was already drawn so; its ${unconsumed.join(', ')} have no consumer in ${op}` }
    // say what stopped it, when the builder said
    const known = new Set(before.document.verification.held.map((h) => `${h.ref}|${h.code}`))
    const stopped = after.document.verification.held.filter((h) => !known.has(`${h.ref}|${h.code}`))[0]
    return stopped ? { ok: false, code: stopped.code, why: `not built: ${stopped.ref}: ${stopped.why.slice(0, 200)}` } : { ok: false, code: 'NOT_CONSUMED', why: 'the built model is the same with it: the correction reached no geometry' }
  }
  const newFailures = [...b.failing].filter((id) => !a.failing.has(id))
  if (newFailures.length > 0) return { ok: false, code: 'CONFLICT_OPEN', why: `with it a source check fails that passed before: ${newFailures.join(', ')}` }
  const removes = op === 'REMOVE_OPENING' || op === 'REMOVE_FEATURE' || op === 'MIXED'
  if (b.trouble > a.trouble) return { ok: false, code: 'COMPILE_CONFLICT', why: `with it ${b.trouble - a.trouble} more object(s) are held or refused by the builder than before` }
  if (!removes && b.built < a.built) return { ok: false, code: 'COMPILE_CONFLICT', why: `with it the scene has fewer objects (${b.built} against ${a.built})` }
  return { ok: true, effect: `model ${String(before.modelHash).slice(0, 10)} → ${String(after.modelHash).slice(0, 10)}; failing checks ${a.failing.size} → ${b.failing.size}; held or refused ${a.trouble} → ${b.trouble}; meshes ${a.built} → ${b.built}` }
}

const CONSUMER: Record<string, string> = { SET_OPENING_HEAD: 'resolveHouse/openings(head) → houseProgram/cutOpening(RAKED|POINTED)', SET_ELEVATION_SIDE: 'resolveHouse/registration', SET_ROOF: 'resolveHouse/roofs → houseProgram/roofPlanes', SET_BODY_STOREYS: 'resolveHouse/bodies → houseProgram/walls', SET_ELEVATION_BODY: 'resolveHouse/registration+heights', ADD_OPENING: 'resolveHouse/openings → houseProgram/cutOpening', REMOVE_OPENING: 'resolveHouse/openings', SET_FEATURE: 'resolveHouse/features → houseProgram/wallDormer|balcony|loggia|gableFrame|canopy', REMOVE_FEATURE: 'resolveHouse/features' }

/** v3.54.7 — what a region of one side of a compiled model holds of the features a defect can be about, by one ruler. */
export type RegionMeasure = { frame: boolean; framePieces: number; balconies: Array<{ id: string; recessed: boolean; posts: number; projectsM: number }>; shaped: string[]; holes: string[] }
export type Region = { alongFrom: number; alongTo: number; yFrom: number; yTo: number }
export function regionMeasure(m: SceneMeasure | undefined, side: string, region: Region | null): RegionMeasure | null {
  const sf = m?.sides.find((x) => x.side === side)
  if (!m || !sf) return null
  const hit = (a0: number, a1: number): boolean => !region || (a1 >= region.alongFrom - 0.1 && a0 <= region.alongTo + 0.1)
  const hitY = (y0: number, y1: number): boolean => !region || (y1 >= region.yFrom - 0.1 && y0 <= region.yTo + 0.1)
  const frame = sf.frame && hit(sf.frame.alongFrom, sf.frame.alongTo) && hitY(sf.frame.bottomY, sf.frame.topY) ? sf.frame : null
  return {
    frame: !!frame,
    framePieces: frame?.pieces ?? 0,
    balconies: sf.balconies.filter((b) => hit(b.alongFrom, b.alongTo)).map((b) => ({ id: b.id, recessed: b.recessed, posts: b.posts, projectsM: b.projectsM })),
    shaped: sf.shapedOpenings.filter((o) => hit(o.alongFrom, o.alongTo)).map((o) => o.id),
    holes: m.openings.filter((o) => o.side === side && o.alongM !== null && hit(o.alongM, (o.alongM as number) + o.widthM) && hitY(o.bottomY, o.topY)).map((o) => o.id).sort(),
  }
}

/**
 * v3.54.7 — whether a defect's region got better, judged on the compiled scene (a changed hash is not an improvement).
 * IMPROVED / UNCHANGED / WORSE where the ruler can see the feature the defect names; NOT_MEASURABLE otherwise.
 */
export function judgeDefect(d: Pick<ReviewDefect, 'feature' | 'meaning'>, before: RegionMeasure | null, after: RegionMeasure | null): 'IMPROVED' | 'UNCHANGED' | 'WORSE' | 'NOT_MEASURABLE' {
  if (!before || !after) return 'NOT_MEASURABLE'
  const cmp = (b: number, a: number, better: 'UP' | 'DOWN'): 'IMPROVED' | 'UNCHANGED' | 'WORSE' => (a === b ? 'UNCHANGED' : (a > b) === (better === 'UP') ? 'IMPROVED' : 'WORSE')
  switch (d.feature) {
    case 'GABLE_FRAME':
      // its presence is counted; its size or shape is not seen by a presence
      return d.meaning === 'EXTRA' ? cmp(Number(before.frame), Number(after.frame), 'DOWN') : d.meaning === 'MISSING' ? cmp(Number(before.frame), Number(after.frame), 'UP') : 'NOT_MEASURABLE'
    case 'SUPPORTS':
      return cmp(before.balconies.reduce((s, b) => s + b.posts, 0), after.balconies.reduce((s, b) => s + b.posts, 0), d.meaning === 'MISSING' ? 'UP' : 'DOWN')
    case 'LOGGIA_OR_RECESS': {
      // a recess: a balcony slab that stands in the plane, without free supports
      const good = (r: RegionMeasure): number => r.balconies.filter((b) => b.recessed && b.posts === 0).length * 10 - r.balconies.reduce((s, b) => s + b.posts + (b.recessed ? 0 : 1), 0)
      return cmp(good(before), good(after), d.meaning === 'EXTRA' ? 'DOWN' : 'UP')
    }
    case 'GLAZING_SHAPE':
      // a shape MISSING is counted; a WRONG one (its slope, its point) is not seen by a count of shaped holes
      return d.meaning === 'MISSING' ? cmp(before.shaped.length, after.shaped.length, 'UP') : 'NOT_MEASURABLE'
    case 'OPENING':
      if (d.meaning === 'MISSING') return cmp(before.holes.length, after.holes.length, 'UP')
      if (d.meaning === 'EXTRA') return cmp(before.holes.length, after.holes.length, 'DOWN')
      return 'NOT_MEASURABLE'
    default:
      return 'NOT_MEASURABLE'
  }
}

/** v3.54.7 — one side as sent for comparison: the elevation and the model drawn in its frame, by hash. */
export type ReviewPair = { round: number; side: string; elevation?: string; picture?: number; sourceSha256?: string; renderSha256: string; modelHash: string; registered: boolean; frame?: { mPerPx: number; alongAtPx0: number; zeroRowPx: number; width: number; height: number }; why?: string }
export type DefectRecord = ReviewDefect & { round: number; elevation?: string; region: Region | null; revisionBefore: string; modelBefore: string; before: RegionMeasure | null; after?: RegionMeasure | null; modelAfter?: string; addressedBy: string[]; state: 'OPEN' | 'IMPROVED' | 'NOT_IMPROVED' | 'UNRESOLVED' | 'NOT_MEASURABLE' | 'SUPPLEMENT_ASKED' | 'MEASURED_PRESENT'; note?: string }
export type Supplement = { round: number; elevation: string; side: string; asked: string[]; answer: 'APPLIED' | 'REJECTED' | 'NOT_SENT' | 'NOTHING_NEW'; code?: string; effect: string }

/** v3.54.7 — a targeted re-reading of ONE elevation for the characteristic features a review found missing. */
export const SUPPLEMENT_TOOL = {
  name: 'describe_characteristic_features',
  description: 'The characteristic features of ONE elevation (picture 1), in its pixels: frames around gables, recessed loggias or portals, balconies and their supports, and the shape of the heads of large glazings. Give ONLY what the picture shows.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['features', 'heads'],
    properties: {
      features: (READING_TOOLS.FACADES.input_schema.properties.elevations.items.properties as Record<string, unknown>).features,
      heads: {
        type: 'array',
        maxItems: 8,
        description: 'For a LISTED opening whose top edge is not level (under a roof slope, in a gable): the rows of its top edge at its left and right sides; apexX for a point between them.',
        items: { type: 'object', additionalProperties: false, required: ['id', 'headLeftY', 'headRightY'], properties: { id: { type: 'string' }, headLeftY: { type: 'number' }, headRightY: { type: 'number' }, apexX: { type: ['number', 'null'] }, topY: { type: ['number', 'null'], description: 'The row of its highest point when that is above the listed box.' } } },
      },
    },
  },
} as const
type SupplementAnswer = { features: Array<Record<string, unknown> & { id: string; kind: string; box: { x0: number; y0: number; x1: number; y1: number } }>; heads: Array<{ id: string; headLeftY: number; headRightY: number; apexX?: number | null; topY?: number | null }> }
const CHARACTERISTIC = new Set(['GABLE_FRAME', 'LOGGIA_OR_RECESS', 'SUPPORTS', 'GLAZING_SHAPE', 'BALCONY'])

export async function reviewHouse(input: { ctx: ReadingContext; selection: Selection; facadesSent: SentPicture[]; observationsDocument: unknown; compiled: CompiledHouse; modelId: string; writeView?: (name: string, png: Uint8Array) => void }): Promise<{ compiled: CompiledHouse; observationsDocument: unknown; proposals: Proposal[]; rounds: number; verdicts: string[]; defects: DefectRecord[]; pairs: ReviewPair[]; supplements: Supplement[] }> {
  let doc = input.observationsDocument
  let compiled = input.compiled
  const proposals: Proposal[] = []
  const verdicts: string[] = []
  const defects: DefectRecord[] = []
  const pairs: ReviewPair[] = []
  const supplements: Supplement[] = []
  let rounds = 0
  let closeUps: Array<{ picture: number; box: { x0: number; y0: number; x1: number; y1: number } }> = []
  const elevations = input.selection.elevations.map((p) => sentPicture(p, 'detail'))
  const shaOf = (b64: string): string => createHash('sha256').update(Buffer.from(b64, 'base64')).digest('hex')
  /** The frame of the elevation picture n (1-based, as sent) on the compiled house, when its elevation registers. */
  const frameOf = (h: CompiledHouse, n: number): { elevation: string; side: string; frame?: { mPerPx: number; alongAtPx0: number; zeroRowPx: number; width: number; height: number }; why?: string } | undefined => {
    const sp = elevations[n - 1]
    if (!sp) return undefined
    const el = (doc as Obs).observations.elevations.find((e) => e.picture === sp.picture.id)
    if (!el) return undefined
    const view = (h.document.verification.views ?? []).find((v) => v.elevation === el.id)
    const side = String(view?.side ?? el.side)
    const tf = view?.registered ? view.transform : undefined
    if (!tf) return { elevation: el.id, side, why: view?.why ?? 'the elevation does not register to the plan' }
    // the registration is in the picture's own pixels; the picture was sent at `scale`
    return { elevation: el.id, side, frame: { mPerPx: tf.mPerPx / sp.scale, alongAtPx0: tf.alongAtPx0, zeroRowPx: (tf.zeroRowPx ?? tf.groundRowPx) * sp.scale, width: sp.width, height: sp.height } }
  }
  const regionOf = (h: CompiledHouse, n: number | undefined, box: ReviewDefect['box']): Region | null => {
    if (n === undefined || !box) return null
    const f = frameOf(h, n)?.frame
    if (!f) return null
    const a = [f.mPerPx * box.x0 + f.alongAtPx0, f.mPerPx * box.x1 + f.alongAtPx0].sort((p, q) => p - q)
    const m = Math.abs(f.mPerPx)
    const y = [(f.zeroRowPx - box.y1) * m, (f.zeroRowPx - box.y0) * m].sort((p, q) => p - q)
    return { alongFrom: a[0], alongTo: a[1], yFrom: y[0], yTo: y[1] }
  }
  for (let round = 1; round <= HOUSE_READING_LIMITS.reviewRounds && compiled.bundle; round += 1) {
    const views = renderModelViews(compiled.bundle, 520)
    for (const v of views) input.writeView?.(`review-${round}-${v.name}.png`, v.png)
    const revision = revisionOf(doc)
    const o = (doc as Obs).observations
    const m = compiled.measured
    const g = compiled.document.geometry
    const checks = compiled.document.verification.checks
    const walls = m?.exteriorWalls
    // v3.54.7 — per side: the elevation and the model drawn in ITS frame (registered), so a box is the same place on both
    const extra: Array<{ label: string; mediaType: string; base64: string; width: number; height: number }> = []
    const pairLines: string[] = []
    if (walls) {
      for (let n = 1; n <= elevations.length; n += 1) {
        const fo = frameOf(compiled, n)
        if (!fo) continue
        const sp = elevations[n - 1]
        if (!fo.frame) {
          pairs.push({ round, side: fo.side, elevation: fo.elevation, picture: n, sourceSha256: shaOf(sp.jpegBase64), renderSha256: views[0].sha256, modelHash: String(compiled.modelHash), registered: false, why: String(fo.why ?? '').slice(0, 200) })
          pairLines.push(`picture ${n} (${fo.side}): does NOT register to the plan (${String(fo.why ?? '').slice(0, 100)}) — compare it with the ${fo.side} tile of the four sides, without a common frame`)
          continue
        }
        const r = renderSideInFrame(compiled.bundle, fo.side as SceneSide, walls, fo.frame)
        input.writeView?.(`review-${round}-pair-${n}-${fo.side}.png`, r.png)
        extra.push({ label: `The MODEL's ${fo.side} side, drawn in the frame of picture ${n} (same size; a pixel of picture ${n} is the same place here):`, mediaType: 'image/png', base64: Buffer.from(r.png).toString('base64'), width: r.width, height: r.height })
        pairs.push({ round, side: fo.side, elevation: fo.elevation, picture: n, sourceSha256: shaOf(sp.jpegBase64), renderSha256: r.sha256, modelHash: String(compiled.modelHash), registered: true, frame: fo.frame })
        pairLines.push(`picture ${n} (${fo.side}) ↔ model ${fo.side} in the same frame`)
      }
      // close-ups asked for in the previous round: the region of the elevation and of the model, enlarged, in one frame
      for (const c of closeUps.slice(0, 3)) {
        const fo = frameOf(compiled, c.picture)
        const sp = elevations[c.picture - 1]
        if (!fo?.frame || !sp) continue
        const bx = { x0: Math.max(0, Math.min(c.box.x0, c.box.x1)), x1: Math.min(sp.width, Math.max(c.box.x0, c.box.x1)), y0: Math.max(0, Math.min(c.box.y0, c.box.y1)), y1: Math.min(sp.height, Math.max(c.box.y0, c.box.y1)) }
        if (bx.x1 - bx.x0 < 8 || bx.y1 - bx.y0 < 8) continue
        const k = Math.min(4, 800 / Math.max(bx.x1 - bx.x0, bx.y1 - bx.y0))
        const crop = cropSent(sp, bx, k)
        const r = renderSideInFrame(compiled.bundle, fo.side as SceneSide, walls, { width: crop.width, height: crop.height, mPerPx: fo.frame.mPerPx / k, alongAtPx0: fo.frame.alongAtPx0 + fo.frame.mPerPx * bx.x0, zeroRowPx: (fo.frame.zeroRowPx - bx.y0) * k })
        extra.push({ label: `CLOSE-UP of picture ${c.picture}, columns ${bx.x0.toFixed(0)}–${bx.x1.toFixed(0)}, rows ${bx.y0.toFixed(0)}–${bx.y1.toFixed(0)}, enlarged ×${k.toFixed(2)} — the SOURCE:`, mediaType: 'image/jpeg', base64: crop.jpegBase64, width: crop.width, height: crop.height })
        extra.push({ label: 'and the MODEL in the same frame:', mediaType: 'image/png', base64: Buffer.from(r.png).toString('base64'), width: r.width, height: r.height })
        pairs.push({ round, side: fo.side, elevation: fo.elevation, picture: c.picture, sourceSha256: shaOf(crop.jpegBase64), renderSha256: r.sha256, modelHash: String(compiled.modelHash), registered: true, frame: { mPerPx: fo.frame.mPerPx / k, alongAtPx0: fo.frame.alongAtPx0 + fo.frame.mPerPx * bx.x0, zeroRowPx: (fo.frame.zeroRowPx - bx.y0) * k, width: crop.width, height: crop.height }, why: 'close-up' })
      }
    }
    closeUps = []
    const listing = o.elevations.map((e) => {
      const n = elevations.findIndex((s) => s.picture.id === e.picture) + 1
      const k = elevations[n - 1]?.scale ?? 1
      const bx = (b: unknown): string => {
        const q = b as { x0: number; y0: number; x1: number; y1: number } | undefined
        return q ? `[${Math.round(q.x0 * k)},${Math.round(q.y0 * k)},${Math.round(q.x1 * k)},${Math.round(q.y1 * k)}]` : ''
      }
      return `picture ${n}: read as ${String(e.side)}${e.mirrored ? ' (mirrored)' : ''}; openings ${e.openings.map((x) => `${String(x.id)}=${String(x.kind)}${bx(x.box)}${typeof x.headLeftY === 'number' ? ' (raked head)' : ''}`).join(', ') || 'none'}; features ${e.features.map((x) => `${String(x.id)}=${String(x.kind)}${bx(x.box)}${x.posts === true ? ' on posts' : ''}`).join(', ') || 'none'}`
    })
    const text = `Revision ${revision}. Pictures 1–${elevations.length}: the published elevations. Then the MODEL the program built from your reading: ${extra.length ? `each side drawn in the frame of its elevation (${pairLines.join('; ')}), then ` : ''}its four sides in one row in the order FRONT, RIGHT, REAR, LEFT, and a view from above with four views around it. The model is a plain massing model: no materials, no terrain, no interior.
What the program found:
- overall ${m?.exteriorWalls ? `${m.exteriorWalls.widthM.toFixed(2)} m wide × ${m.exteriorWalls.depthM.toFixed(2)} m deep` : 'not measured'}; top ${m?.heightAboveTerrainM !== null && m?.heightAboveTerrainM !== undefined ? `${m.heightAboveTerrainM.toFixed(2)} m above the terrain` : 'unknown'}
- bodies: ${g ? g.bodies.map((b) => `${b.id} ${b.role} levels ${b.storeys.join('+')} roof ${b.roof.kind}${b.roof.ridgeAxis ? ` ridge ${b.roof.ridgeAxis === 'X' ? 'ALONG_FRONT' : 'FRONT_TO_BACK'}` : ''} top +${(b.roof.ridgeY.value ?? 0).toFixed(2)}`).join('; ') : 'none'}
- checks failed: ${checks.filter((c) => c.status === 'FAIL').map((c) => `${c.what}: ${c.measured}`).join(' | ').slice(0, 900) || 'none'}
- not built, and why: ${compiled.document.verification.held.map((h) => `${h.ref} (${h.code}: ${h.why.slice(0, 110)})`).join(' | ').slice(0, 1500) || 'nothing'}
- what was read on the elevations (boxes in pixels of the pictures as sent): ${listing.join(' || ').slice(0, 2400)}
Compare each elevation with the model's same side, in this order: which side is which and the overall proportions; the bodies; the heights of walls, eaves and ridges; the roofs; frames around gables, recesses and loggias, balconies and their supports; where the openings are and the shape of their heads; dormers, canopies. Call review_model. Record every important difference in defects, with its region as a box in the elevation picture's pixels, what it means and how much it matters; a feature that makes the house recognisable (a gable frame, a recessed loggia or portal, the shape of a large glazing, the garage) is KEY. Give a correction only where what was READ from a picture is wrong or missing and the picture shows the right value; at most ${REVIEW_MAX_CORRECTIONS}, the ones that matter most first. A wall that was not built cannot take an opening: fix what holds the wall (its body, its roof, the head of the glazing) before adding an opening to it again. A reading of the wrong kind (a balcony on posts that the picture shows recessed) is corrected by SET_FEATURE with the same id and the right kind. If you cannot tell from these pictures, ask for closeUps. If the model already agrees, answer MATCHES with no corrections.`
    let answer: ReviewAnswer
    try {
      answer = await ask<ReviewAnswer>(input.ctx, 'REVIEW', round, text, elevations, REVIEW_TOOL, [...extra, ...views.map((v) => ({ label: `The MODEL — ${v.name === 'SIDES' ? 'its four sides: FRONT, RIGHT, REAR, LEFT' : 'from above, and four views around it'}:`, mediaType: 'image/png', base64: Buffer.from(v.png).toString('base64'), width: v.name === 'SIDES' ? 2080 : 2600, height: 520 }))], false)
    } catch (e) {
      proposals.push({ round, op: 'REVIEW', subject: 'the whole round', why: (e as Error).message.slice(0, 200), state: 'REJECTED', code: 'NOT_SENT', consumer: 'reviewHouse', effect: 'the house stands as built' })
      break
    }
    rounds = round
    verdicts.push(answer.verdict)
    if (!Array.isArray(answer.corrections)) answer.corrections = []
    if (answer.revision !== revision) {
      proposals.push({ round, op: 'REVIEW', subject: 'the whole round', why: `the answer names revision ${String(answer.revision).slice(0, 20)}, the house is at ${revision}`, state: 'REJECTED', code: 'STALE_DEPENDENCY', consumer: 'reviewHouse', effect: 'no correction applied' })
      break
    }
    const corrections = (answer.corrections ?? []).slice(0, REVIEW_MAX_CORRECTIONS)
    // v3.54.7 — the defects as data, each with its region measured on the model as it stands now
    const roundDefects: DefectRecord[] = (Array.isArray(answer.defects) ? answer.defects : []).slice(0, 12).map((d) => {
      const region = regionOf(compiled, d.picture, d.box)
      const el = typeof d.picture === 'number' ? frameOf(compiled, d.picture)?.elevation : undefined
      const before = regionMeasure(compiled.measured, d.side, region)
      // a feature said MISSING that the scene ruler measures in that region is there: what disagrees is the reviewer's
      // view of it, not the model — it is recorded as such, and it is neither repaired again nor counted as open
      const present = d.meaning === 'MISSING' && !!before && ((d.feature === 'GABLE_FRAME' && before.frame) || (d.feature === 'GLAZING_SHAPE' && before.shaped.length > 0) || (d.feature === 'LOGGIA_OR_RECESS' && before.balconies.some((b) => b.recessed && b.posts === 0)))
      return { ...d, round, ...(el ? { elevation: el } : {}), region, revisionBefore: revision, modelBefore: String(compiled.modelHash), before, addressedBy: [], state: present ? 'MEASURED_PRESENT' : d.fix === 'UNRESOLVED' ? 'UNRESOLVED' : 'OPEN', ...(present ? { note: 'the scene ruler measures this feature in the region on the model reviewed' } : {}) }
    })
    defects.push(...roundDefects)
    const defectsOf = (items: ReviewCorrection[]): DefectRecord[] => roundDefects.filter((d) => d.state !== 'MEASURED_PRESENT' && (d.corrections ?? []).some((i) => items.includes(corrections[i])))
    let applied = 0
    /** One transaction: every correction on a copy, one validation of the whole house after all of them, all or none. */
    const transact = (items: ReviewCorrection[], group: string | undefined): boolean => {
      const base = revisionOf(doc)
      let next = doc
      const subjects: string[] = []
      // v3.54.7 — the host first: an opening that was not cut because its wall was refused, or because it stood above its
      // wall, is not fixed by adding it to that wall again. Only together with a change of what holds it.
      const hostOps = new Set(['SET_ELEVATION_BODY', 'SET_ROOF', 'SET_BODY_STOREYS', 'SET_OPENING_HEAD', 'SET_FEATURE', 'SET_ELEVATION_SIDE'])
      if (!items.some((c) => hostOps.has(c.op))) {
        for (const c of items) {
          if (c.op !== 'ADD_OPENING' || !c.id || typeof c.picture !== 'number') continue
          const el = frameOf(compiled, c.picture)?.elevation
          const ref = `${el}/${c.id}`
          const og = compiled.document.geometry?.openings.find((x) => x.refs.includes(ref))
          const notCut = (compiled.document.verification.openings ?? []).find((x) => x.ref === ref && x.fit === 'NOT_BUILT')
          const above = og ? compiled.compileErrors.find((e) => (e as { objectId?: string }).objectId === og.id && /ABOVE_WALL_TOP|HOST/.test(String((e as { code?: string }).code))) : undefined
          if (notCut && (above || /host wall|refused by the kernel/.test(String(notCut.why ?? '')))) {
            for (const x of items) proposals.push({ round, op: x.op, subject: x.id ?? `picture ${x.picture ?? '?'}`, why: x.why, state: 'REJECTED', code: 'HOST_FIRST', consumer: CONSUMER[x.op] ?? 'none', effect: `opening ${ref} was not cut because of what holds it (${String(above ? (above as { message?: string }).message : notCut.why).slice(0, 140)}); adding it to the same wall again changes nothing — the wall, the body or the head must be corrected with it`, ...(group ? { group } : {}), baseRevision: base })
            return false
          }
        }
      }
      for (const c of items) {
        const r = applyCorrection(next, c, elevations)
        if ('code' in r) {
          for (const x of items) proposals.push({ round, op: x.op, subject: x.id ?? x.bodyId ?? `picture ${x.picture ?? '?'}`, why: x.why, state: 'REJECTED', code: r.code, consumer: CONSUMER[x.op] ?? 'none', effect: x === c ? r.why : `its group was refused whole: ${r.why}`, ...(group ? { group } : {}), baseRevision: base })
          return false
        }
        next = r.doc
        subjects.push(r.subject)
      }
      // an operation that leaves the observations as they were restates the current reading: nothing to apply
      if (revisionOf(next) === base) {
        const dropped = items.flatMap((c) => (c.op === 'SET_ROOF' ? ['eavesY', 'ridgeY', 'box'].filter((k) => (c as Record<string, unknown>)[k] !== undefined) : []))
        items.forEach((c, i) => proposals.push({ round, op: c.op, subject: subjects[i], why: c.why, state: 'REJECTED', code: dropped.length ? 'CAPABILITY_MISSING' : 'NO_CHANGE', consumer: CONSUMER[c.op] ?? 'none', effect: dropped.length ? `it restates what was read; its ${[...new Set(dropped)].join(', ')} have no consumer in ${c.op}` : 'it restates what was read: the observations are unchanged', ...(group ? { group } : {}), baseRevision: base }))
        return false
      }
      const after = compileHouse(JSON.parse(JSON.stringify(next)), input.modelId)
      const removesOnly = items.every((c) => c.op === 'REMOVE_OPENING' || c.op === 'REMOVE_FEATURE')
      const target = (() => {
        const c = items[0]
        const pic = typeof c.picture === 'number' ? elevations[c.picture - 1] : undefined
        return pic ? (doc as Obs).observations.elevations.find((e) => e.picture === pic.picture.id)?.id : undefined
      })()
      let verdict = acceptCorrection(compiled, after, removesOnly ? 'REMOVE_OPENING' : items.some((c) => c.op === 'REMOVE_OPENING' || c.op === 'REMOVE_FEATURE') ? 'MIXED' : items[0].op, target, subjects.map((x) => x.replace(/\s*\(.*\)$/, '')), [...new Set(items.flatMap((c) => (c.op === 'SET_ROOF' ? ['eavesY', 'ridgeY', 'box'].filter((k) => (c as Record<string, unknown>)[k] !== undefined) : [])))])
      // v3.54.7 — a correction that answers a defect stands only if that defect's region measures better on the new model
      const mine = defectsOf(items)
      if (verdict.ok && mine.length > 0) {
        const judged = mine.map((d) => {
          const region = regionOf(after, d.picture, d.box) ?? d.region
          const am = regionMeasure(after.measured, d.side, region)
          return { d, am, j: judgeDefect(d, d.before, am) }
        })
        const measurable = judged.filter((x) => x.j !== 'NOT_MEASURABLE')
        if (measurable.length > 0 && !measurable.some((x) => x.j === 'IMPROVED')) {
          verdict = { ok: false, code: 'NO_IMPROVEMENT', why: `the model changed (${String(compiled.modelHash).slice(0, 10)} → ${String(after.modelHash).slice(0, 10)}) but the region of ${measurable.map((x) => `${x.d.id} (${x.d.feature} ${x.d.meaning}: ${x.j})`).join(', ')} measures no better` }
          for (const x of judged) x.d.note = verdict.why
        } else {
          for (const x of judged) {
            x.d.after = x.am
            x.d.modelAfter = String(after.modelHash)
            x.d.state = x.j === 'IMPROVED' ? 'IMPROVED' : x.j === 'NOT_MEASURABLE' ? 'NOT_MEASURABLE' : 'NOT_IMPROVED'
          }
        }
      }
      for (const d of mine) d.addressedBy.push(...subjects.map((x) => `${x}${group ? ` [${group}]` : ''} → ${verdict.ok ? 'APPLIED' : verdict.code}`))
      items.forEach((c, i) => proposals.push({ round, op: c.op, subject: subjects[i], why: c.why, state: verdict.ok ? 'APPLIED' : 'REJECTED', ...(verdict.ok ? {} : { code: verdict.code }), consumer: CONSUMER[c.op] ?? 'none', effect: verdict.ok ? verdict.effect : verdict.why, ...(group ? { group } : {}), baseRevision: base, ...(verdict.ok ? { revision: revisionOf(next) } : {}) }))
      if (!verdict.ok) return false
      doc = next
      compiled = after
      applied += items.length
      return true
    }
    const groups = new Map<string, ReviewCorrection[]>()
    const order: Array<{ group?: string; items: ReviewCorrection[] }> = []
    // corrections the reviewer tied to ONE defect are one transaction: they are right together (replace the reading,
    // remove what depended on it, rebuild in one step)
    const tie = new Map<ReviewCorrection, string>()
    for (const d of roundDefects) {
      const cs = (d.corrections ?? []).map((i) => corrections[i]).filter((c): c is ReviewCorrection => !!c)
      if (cs.length >= 2) for (const c of cs) if (!tie.has(c) && !(typeof c.group === 'string' && c.group.trim())) tie.set(c, `defect-${d.id}`.slice(0, 16))
    }
    for (const c of corrections) {
      const label = typeof c.group === 'string' && c.group.trim() ? c.group.trim().slice(0, 16) : tie.get(c)
      if (!label) {
        order.push({ items: [c] })
        continue
      }
      const list = groups.get(label)
      if (list) list.push(c)
      else {
        const items = [c]
        groups.set(label, items)
        order.push({ group: label, items })
      }
    }
    const refusedAlone: ReviewCorrection[] = []
    for (const t of order) {
      const ok = transact(t.items, t.group)
      if (!ok && !t.group && (t.items[0].op === 'ADD_OPENING' || t.items[0].op === 'REMOVE_OPENING') && ['COMPILE_CONFLICT', 'CONFLICT_OPEN'].includes(proposals[proposals.length - 1]?.code ?? '')) refusedAlone.push(t.items[0])
    }
    // An opening correction refused alone for a clash is judged again once the others have been applied (its clash may
    // have been with the state before a later correction), and those still refused are tried together, per elevation:
    // a correct pair is not lost because its first step, judged alone, collided with what its second step removes.
    const still: ReviewCorrection[] = []
    for (const c of refusedAlone) if (!transact([c], 'retry')) still.push(c)
    const byPicture = new Map<number, ReviewCorrection[]>()
    for (const c of still) if (typeof c.picture === 'number') byPicture.set(c.picture, [...(byPicture.get(c.picture) ?? []), c])
    for (const [picture, items] of byPicture) if (items.length >= 2) transact(items, `auto-p${picture}`)
    // v3.54.7 — a DIFFERS whose important characteristic defects no applied correction answered: one targeted re-reading
    // of the elevation they are on (the addressee is the reading, not the model), at most two per round
    if (answer.verdict === 'DIFFERS') {
      const open = roundDefects.filter((d) => d.state !== 'IMPROVED' && d.state !== 'MEASURED_PRESENT' && d.weight !== 'MINOR' && CHARACTERISTIC.has(d.feature) && typeof d.picture === 'number')
      const byPic = new Map<number, DefectRecord[]>()
      for (const d of open) byPic.set(d.picture as number, [...(byPic.get(d.picture as number) ?? []), d])
      let k = 0
      for (const [n, ds] of byPic) {
        if (k >= 2) break
        k += 1
        const r = await supplement(n, ds, round * 10 + k)
        if (r) applied += 1
      }
    }
    if (Array.isArray(answer.closeUps) && answer.closeUps.length > 0) closeUps = answer.closeUps.slice(0, 3)
    if (answer.verdict === 'MATCHES' || (applied === 0 && closeUps.length === 0)) break
  }
  return { compiled, observationsDocument: doc, proposals, rounds, verdicts, defects, pairs, supplements }

  async function supplement(n: number, ds: DefectRecord[], round: number): Promise<boolean> {
    const sp = elevations[n - 1]
    const el = (doc as Obs).observations.elevations.find((e) => e.picture === sp?.picture.id)
    if (!sp || !el) return false
    const k = sp.scale
    const listed = el.openings.map((x) => {
      const q = x.box as { x0: number; y0: number; x1: number; y1: number }
      return `${String(x.id)}=${String(x.kind)} [${Math.round(q.x0 * k)},${Math.round(q.y0 * k)},${Math.round(q.x1 * k)},${Math.round(q.y1 * k)}]`
    })
    const asked = ds.map((d) => `${d.id}: ${d.feature} ${d.meaning} — ${d.evidence.slice(0, 160)}`)
    const text = `Picture 1: ONE elevation (${String(el.side)}) of a house. A comparison of this elevation with the model built from its reading found: ${asked.join(' | ')}.
Openings already read on it (boxes in pixels of picture 1): ${listed.join(', ') || 'none'}.
Call describe_characteristic_features: every gable frame (with the vertical thickness of its band and the width of its legs), every loggia or recessed portal (recessed behind the wall plane), every balcony (say whether supports are DRAWN), and, for listed openings whose top edge follows a roof slope, the rows of their top edge at both sides. Give only what the picture shows; an empty list where it shows none.`
    const rec: Supplement = { round, elevation: el.id, side: String(el.side), asked, answer: 'NOT_SENT', effect: '' }
    supplements.push(rec)
    for (const d of ds) d.state = d.state === 'OPEN' || d.state === 'NOT_IMPROVED' || d.state === 'UNRESOLVED' ? 'SUPPLEMENT_ASKED' : d.state
    let ans: SupplementAnswer
    try {
      ans = await ask<SupplementAnswer>(input.ctx, 'REVIEW', round, text, [sp], SUPPLEMENT_TOOL, [], false)
    } catch (e) {
      rec.code = e instanceof ReadingFailed ? e.code : 'NOT_SENT'
      rec.effect = (e as Error).message.slice(0, 200)
      return false
    }
    const next = JSON.parse(JSON.stringify(doc)) as Obs
    const e2 = next.observations.elevations.find((e) => e.id === el.id) as Obs['observations']['elevations'][number]
    const r1 = (v: number): number => Math.round((v / k) * 10) / 10
    const B = (b: { x0: number; y0: number; x1: number; y1: number }) => ({ x0: r1(Math.min(b.x0, b.x1)), y0: r1(Math.min(b.y0, b.y1)), x1: r1(Math.max(b.x0, b.x1)), y1: r1(Math.max(b.y0, b.y1)) })
    const overlap = (a: { x0: number; x1: number }, b: { x0: number; x1: number }): number => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) / Math.max(1e-9, Math.min(a.x1 - a.x0, b.x1 - b.x0))
    for (const f of Array.isArray(ans.features) ? ans.features : []) {
      if (!['GABLE_FRAME', 'LOGGIA', 'BALCONY', 'CANOPY'].includes(f.kind) || !f.box) continue
      if (f.kind === 'GABLE_FRAME' && !(typeof f.bandPx === 'number' && f.bandPx > 0)) continue
      const box = B(f.box)
      const entry: Record<string, unknown> = { id: '', kind: f.kind, box, ...(typeof f.bodyId === 'string' ? { bodyId: f.bodyId } : {}), ...(typeof f.bandPx === 'number' && f.bandPx > 0 ? { bandPx: r1(f.bandPx) } : {}), ...(typeof f.legPx === 'number' && f.legPx > 0 ? { legPx: r1(f.legPx) } : {}), ...(typeof f.legBottomY === 'number' ? { legBottomY: r1(f.legBottomY) } : {}), ...(typeof f.posts === 'boolean' ? { posts: f.posts } : f.kind === 'LOGGIA' ? { posts: false } : {}), origin: undefined }
      delete entry.origin
      // a balcony or loggia over the same stretch REPLACES the reading that was there (one interpretation of one place)
      const same = e2.features.findIndex((x) => (x.kind === f.kind || (['BALCONY', 'LOGGIA'].includes(String(x.kind)) && ['BALCONY', 'LOGGIA'].includes(f.kind))) && overlap(x.box as { x0: number; x1: number }, box) > 0.5)
      if (same >= 0) e2.features[same] = { ...entry, id: e2.features[same].id }
      else {
        let i = e2.features.length + 1
        while (e2.features.some((x) => x.id === `s${i}`)) i += 1
        e2.features.push({ ...entry, id: `s${i}` })
      }
    }
    for (const h of Array.isArray(ans.heads) ? ans.heads : []) {
      const o2 = e2.openings.find((x) => x.id === h.id)
      if (!o2 || typeof h.headLeftY !== 'number' || typeof h.headRightY !== 'number') continue
      o2.headLeftY = r1(h.headLeftY)
      o2.headRightY = r1(h.headRightY)
      if (typeof h.apexX === 'number') o2.apexX = r1(h.apexX)
      const bx = o2.box as { x0: number; y0: number; x1: number; y1: number }
      const top = Math.min(r1(h.headLeftY), r1(h.headRightY), typeof h.topY === 'number' ? r1(h.topY) : Infinity)
      o2.box = { ...bx, y0: Math.min(bx.y0, top) }
    }
    if (revisionOf(next) === revisionOf(doc)) {
      rec.answer = 'NOTHING_NEW'
      rec.effect = 'the re-reading adds nothing to what was read'
      return false
    }
    const after = compileHouse(JSON.parse(JSON.stringify(next)), input.modelId)
    let verdict = acceptCorrection(compiled, after, 'SET_FEATURE', el.id)
    const judged = ds.map((d) => {
      const am = regionMeasure(after.measured, d.side, regionOf(after, d.picture, d.box) ?? d.region)
      return { d, am, j: judgeDefect(d, d.before, am) }
    })
    const measurable = judged.filter((x) => x.j !== 'NOT_MEASURABLE')
    if (verdict.ok && measurable.length > 0 && !measurable.some((x) => x.j === 'IMPROVED')) verdict = { ok: false, code: 'NO_IMPROVEMENT', why: `the model changed but the region of ${measurable.map((x) => `${x.d.id} (${x.j})`).join(', ')} measures no better` }
    rec.answer = verdict.ok ? 'APPLIED' : 'REJECTED'
    if (!verdict.ok) rec.code = verdict.code
    rec.effect = verdict.ok ? verdict.effect : verdict.why
    proposals.push({ round, op: 'SUPPLEMENT', subject: el.id, why: asked.join(' | ').slice(0, 240), state: verdict.ok ? 'APPLIED' : 'REJECTED', ...(verdict.ok ? {} : { code: verdict.code }), consumer: 'reviewHouse/supplement → resolveHouse/features+openings', effect: rec.effect, baseRevision: revisionOf(doc), ...(verdict.ok ? { revision: revisionOf(next) } : {}) })
    for (const x of judged) {
      x.d.addressedBy.push(`supplement ${el.id} → ${verdict.ok ? 'APPLIED' : verdict.code}`)
      if (verdict.ok) {
        x.d.after = x.am
        x.d.modelAfter = String(after.modelHash)
        x.d.state = x.j === 'IMPROVED' ? 'IMPROVED' : x.j === 'NOT_MEASURABLE' ? 'NOT_MEASURABLE' : 'NOT_IMPROVED'
      }
    }
    if (!verdict.ok) return false
    doc = next
    compiled = after
    return true
  }
}

/** v3.54.7 — a region of a picture as sent, enlarged by `k`: the close-up of the source. */
function cropSent(sp: SentPicture, box: { x0: number; y0: number; x1: number; y1: number }, k: number): { jpegBase64: string; width: number; height: number } {
  const r = sp.picture.raster
  const s = sp.scale
  const x0 = Math.max(0, Math.floor(box.x0 / s))
  const y0 = Math.max(0, Math.floor(box.y0 / s))
  const x1 = Math.min(r.width, Math.ceil(box.x1 / s))
  const y1 = Math.min(r.height, Math.ceil(box.y1 / s))
  const width = Math.max(1, Math.round((box.x1 - box.x0) * k))
  const height = Math.max(1, Math.round((box.y1 - box.y0) * k))
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(x1 - 1, Math.max(x0, Math.floor(x0 + ((x + 0.5) / width) * (x1 - x0))))
      const sy = Math.min(y1 - 1, Math.max(y0, Math.floor(y0 + ((y + 0.5) / height) * (y1 - y0))))
      const a = (sy * r.width + sx) * 4
      const b = (y * width + x) * 4
      data[b] = r.data[a]
      data[b + 1] = r.data[a + 1]
      data[b + 2] = r.data[a + 2]
      data[b + 3] = 255
    }
  }
  return { jpegBase64: Buffer.from(encodeJpeg({ width, height, data }, 88)).toString('base64'), width, height }
}
