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
import { renderModelViews } from '../consult/model-views.js'
import { compileHouse } from './describe.js'
import type { CompiledHouse } from './describe.js'
import { HOUSE_READING_LIMITS, ask } from './read.js'
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
      corrections: {
        type: 'array',
        maxItems: REVIEW_MAX_CORRECTIONS,
        description: 'Only where a reading of the SOURCE was wrong or missing and you can state the right one from the pictures. Coordinates in the pixels of the elevation picture named.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['op', 'why'],
          properties: {
            op: { type: 'string', enum: ['SET_ELEVATION_SIDE', 'SET_ROOF', 'SET_BODY_STOREYS', 'SET_ELEVATION_BODY', 'ADD_OPENING', 'REMOVE_OPENING', 'SET_FEATURE', 'REMOVE_FEATURE'] },
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
            id: { type: 'string', description: 'REMOVE_*: the id to remove, as listed. ADD_OPENING: omit for a NEW opening; give the id of a listed opening to CORRECT that opening (move it, resize it, change its kind) — never add a second opening where one is listed. SET_FEATURE: the listed id to correct it, or a new id.' },
            kind: { type: 'string', description: 'For ADD_OPENING: WINDOW, DOOR, GLAZED_DOOR, GARAGE_DOOR. For SET_FEATURE: WALL_DORMER_GABLE, ROOF_DORMER_GABLE, ROOF_DORMER_SHED, BALCONY, CANOPY.' },
            box: box,
            level: { type: 'integer', minimum: 0, maximum: 3 },
            apexY: { type: ['number', 'null'] },
          },
        },
      },
    },
  },
} as const

export type ReviewCorrection = { op: string; why: string; group?: string; picture?: number; side?: string; mirrored?: boolean; bodyId?: string; roofKind?: string; ridge?: string; storeys?: number[]; leftX?: number; rightX?: number; eavesY?: number | null; ridgeY?: number | null; id?: string; kind?: string; box?: { x0: number; y0: number; x1: number; y1: number }; level?: number; apexY?: number | null }
export type ReviewAnswer = { revision: string; verdict: 'MATCHES' | 'DIFFERS'; differences: Array<{ scope: string; what: string }>; corrections: ReviewCorrection[] }
export type Proposal = { round: number; op: string; subject: string; why: string; state: 'APPLIED' | 'REJECTED'; code?: string; consumer: string; effect: string; /** v3.54.5: the transaction it belonged to, and the observations revision it was made against and (when applied) led to. */ group?: string; baseRevision?: string; revision?: string }

type Obs = { observations: { elevations: Array<Record<string, unknown> & { id: string; picture: string; bodies: Array<Record<string, unknown>>; openings: Array<Record<string, unknown>>; features: Array<Record<string, unknown>> }>; roofs: Array<Record<string, unknown>>; outlines: Array<Record<string, unknown>> } }
/** The revision of the observations: what was read, not the bookkeeping of which request read it. */
const revisionOf = (doc: unknown): string => createHash('sha256').update(JSON.stringify((doc as Obs).observations, (k, v) => (k === 'readIn' ? undefined : v))).digest('hex').slice(0, 12)
const OPENING_KINDS = ['WINDOW', 'DOOR', 'GLAZED_DOOR', 'GARAGE_DOOR']
const FEATURE_KINDS = ['WALL_DORMER_GABLE', 'ROOF_DORMER_GABLE', 'ROOF_DORMER_SHED', 'BALCONY', 'CANOPY']

/** One correction on a copy of the observations; undefined with a code when it names nothing that exists. */
export function applyCorrection(doc: unknown, c: ReviewCorrection, sent: SentPicture[]): { doc: unknown; subject: string } | { code: string; why: string } {
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
      if (!c.box || !c.kind || !FEATURE_KINDS.includes(c.kind) || !c.id || !/^[a-z][a-z0-9-]{0,23}$/.test(c.id)) return { code: 'PARSE_REJECTED', why: 'a feature needs an id, a kind this builder has and a box' }
      const entry = { id: c.id, kind: c.kind, box: B(c.box), ...(c.bodyId && bodies.has(c.bodyId) ? { bodyId: c.bodyId } : {}), ...(typeof c.eavesY === 'number' ? { eavesY: r1(c.eavesY) } : {}), ...(typeof c.apexY === 'number' ? { apexY: r1(c.apexY) } : {}) }
      const i = el.features.findIndex((x) => x.id === c.id)
      if (i >= 0) el.features[i] = entry
      else el.features.push(entry)
      return { doc: next, subject: `${el.id}/${c.id}` }
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

const CONSUMER: Record<string, string> = { SET_ELEVATION_SIDE: 'resolveHouse/registration', SET_ROOF: 'resolveHouse/roofs → houseProgram/roofPlanes', SET_BODY_STOREYS: 'resolveHouse/bodies → houseProgram/walls', SET_ELEVATION_BODY: 'resolveHouse/registration+heights', ADD_OPENING: 'resolveHouse/openings → houseProgram/cutOpening', REMOVE_OPENING: 'resolveHouse/openings', SET_FEATURE: 'resolveHouse/features → houseProgram/wallDormer|balcony|canopy', REMOVE_FEATURE: 'resolveHouse/features' }

export async function reviewHouse(input: { ctx: ReadingContext; selection: Selection; facadesSent: SentPicture[]; observationsDocument: unknown; compiled: CompiledHouse; modelId: string; writeView?: (name: string, png: Uint8Array) => void }): Promise<{ compiled: CompiledHouse; observationsDocument: unknown; proposals: Proposal[]; rounds: number; verdicts: string[] }> {
  let doc = input.observationsDocument
  let compiled = input.compiled
  const proposals: Proposal[] = []
  const verdicts: string[] = []
  let rounds = 0
  const elevations = input.selection.elevations.map((p) => sentPicture(p, 'detail'))
  for (let round = 1; round <= HOUSE_READING_LIMITS.reviewRounds && compiled.bundle; round += 1) {
    const views = renderModelViews(compiled.bundle, 520)
    for (const v of views) input.writeView?.(`review-${round}-${v.name}.png`, v.png)
    const revision = revisionOf(doc)
    const o = (doc as Obs).observations
    const m = compiled.measured
    const g = compiled.document.geometry
    const checks = compiled.document.verification.checks
    const listing = o.elevations.map((e) => {
      const n = elevations.findIndex((s) => s.picture.id === e.picture) + 1
      return `picture ${n}: read as ${String(e.side)}${e.mirrored ? ' (mirrored)' : ''}; openings ${e.openings.map((x) => `${String(x.id)}=${String(x.kind)}`).join(', ') || 'none'}; features ${e.features.map((x) => `${String(x.id)}=${String(x.kind)}`).join(', ') || 'none'}`
    })
    const text = `Revision ${revision}. Pictures 1–${elevations.length}: the published elevations. Then two pictures of the MODEL the program built from your reading: its four sides in the order FRONT, RIGHT, REAR, LEFT, and a view from above with four views around it. The model is a plain massing model: no materials, no terrain, no interior.
What the program found:
- overall ${m?.exteriorWalls ? `${m.exteriorWalls.widthM.toFixed(2)} m wide × ${m.exteriorWalls.depthM.toFixed(2)} m deep` : 'not measured'}; top ${m?.heightAboveTerrainM !== null && m?.heightAboveTerrainM !== undefined ? `${m.heightAboveTerrainM.toFixed(2)} m above the terrain` : 'unknown'}
- bodies: ${g ? g.bodies.map((b) => `${b.id} ${b.role} levels ${b.storeys.join('+')} roof ${b.roof.kind}${b.roof.ridgeAxis ? ` ridge ${b.roof.ridgeAxis === 'X' ? 'ALONG_FRONT' : 'FRONT_TO_BACK'}` : ''} top +${(b.roof.ridgeY.value ?? 0).toFixed(2)}`).join('; ') : 'none'}
- checks failed: ${checks.filter((c) => c.status === 'FAIL').map((c) => `${c.what}: ${c.measured}`).join(' | ').slice(0, 900) || 'none'}
- not built, and why: ${compiled.document.verification.held.map((h) => `${h.ref} (${h.code}: ${h.why.slice(0, 110)})`).join(' | ').slice(0, 1500) || 'nothing'}
- what was read on the elevations: ${listing.join(' || ').slice(0, 1800)}
Compare the model with the elevations, side by side, in this order: which side is which and the overall proportions; the bodies; the heights of walls, eaves and ridges; the roofs; where the openings are; dormers, balconies, canopies. Call review_model. Give a correction only where what was READ from a picture is wrong or missing and the picture shows the right value; at most ${REVIEW_MAX_CORRECTIONS}, the ones that matter most for the whole exterior first. If the model already agrees, answer MATCHES with no corrections.`
    let answer: ReviewAnswer
    try {
      answer = await ask<ReviewAnswer>(input.ctx, 'REVIEW', round, text, elevations, REVIEW_TOOL, views.map((v) => ({ label: `The MODEL — ${v.name === 'SIDES' ? 'its four sides: FRONT, RIGHT, REAR, LEFT' : 'from above, and four views around it'}:`, mediaType: 'image/png', base64: Buffer.from(v.png).toString('base64'), width: v.name === 'SIDES' ? 2080 : 2600, height: 520 })), false)
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
    let applied = 0
    const corrections = (answer.corrections ?? []).slice(0, REVIEW_MAX_CORRECTIONS)
    /** One transaction: every correction on a copy, one validation of the whole house after all of them, all or none. */
    const transact = (items: ReviewCorrection[], group: string | undefined): boolean => {
      const base = revisionOf(doc)
      let next = doc
      const subjects: string[] = []
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
      const verdict = acceptCorrection(compiled, after, removesOnly ? 'REMOVE_OPENING' : items.some((c) => c.op === 'REMOVE_OPENING' || c.op === 'REMOVE_FEATURE') ? 'MIXED' : items[0].op, target, subjects.map((x) => x.replace(/\s*\(.*\)$/, '')), [...new Set(items.flatMap((c) => (c.op === 'SET_ROOF' ? ['eavesY', 'ridgeY', 'box'].filter((k) => (c as Record<string, unknown>)[k] !== undefined) : [])))])
      items.forEach((c, i) => proposals.push({ round, op: c.op, subject: subjects[i], why: c.why, state: verdict.ok ? 'APPLIED' : 'REJECTED', ...(verdict.ok ? {} : { code: verdict.code }), consumer: CONSUMER[c.op] ?? 'none', effect: verdict.ok ? verdict.effect : verdict.why, ...(group ? { group } : {}), baseRevision: base, ...(verdict.ok ? { revision: revisionOf(next) } : {}) }))
      if (!verdict.ok) return false
      doc = next
      compiled = after
      applied += items.length
      return true
    }
    const groups = new Map<string, ReviewCorrection[]>()
    const order: Array<{ group?: string; items: ReviewCorrection[] }> = []
    for (const c of corrections) {
      const label = typeof c.group === 'string' && c.group.trim() ? c.group.trim().slice(0, 16) : undefined
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
    if (answer.verdict === 'MATCHES' || applied === 0) break
  }
  return { compiled, observationsDocument: doc, proposals, rounds, verdicts }
}
