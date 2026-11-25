/**
 * v3.54.17 — the witness → target resolver.
 *
 * A printed value witnesses a change of a model object only when both stand on the same body of the model, decided by
 * geometry, never by a name: the mark's text box lies at a place of a registered elevation (its frame's pixels, its
 * source bytes), the registration puts that place at a stretch of the side in metres, and the model's bodies (its
 * exterior wall rings with the roofs and roof planes that stand over them) say which body that stretch belongs to. The
 * target is resolved the same way: a roof or a plane by the body it stands over, a wall by its ring, a chimney by its
 * footprint, a level by the bodies that have walls on it.
 *
 * Neither the host text the proposer gives nor the host text the reader gave decides anything: two bodies called by the
 * same word, or a word that names a body the target is not on, are exactly the cases the names get wrong. The count of
 * roofs does not decide whether the house has more than one body either (two roofs on one body, or roof planes and no
 * roof at all, are both common): the bodies are counted.
 *
 * The datum must agree: the model's levels are stated from the drawing's finished ±0,00; a mark stated from the terrain
 * or a structural level is another number, however equal it looks.
 */
import type { CanonicalBuildingModel } from '@buildapp/model'
import { bodiesOf } from '../massing/massing.js'
import type { ModelBody } from '../massing/massing.js'
import type { BindView, PrintedWitness, Side } from './execute.js'

export const WITNESS_RESOLVER_VERSION = '1.0.0' as const
/** The datum the model's elevations are stated from. */
export const MODEL_DATUM = 'FINISHED_LEVEL' as const
const FOREIGN_DATUMS = new Set(['TERRAIN', 'STRUCTURAL_LEVEL'])

const along = (s: Side): 'x' | 'z' => (s === 'FRONT' || s === 'REAR' ? 'x' : 'z')
const extentOn = (b: ModelBody, s: Side): { lo: number; hi: number } => (along(s) === 'x' ? { lo: b.rect.minX, hi: b.rect.maxX } : { lo: b.rect.minZ, hi: b.rect.maxZ })
const inside = (b: ModelBody, x: number, z: number): boolean => x >= b.rect.minX - 0.05 && x <= b.rect.maxX + 0.05 && z >= b.rect.minZ - 0.05 && z <= b.rect.maxZ + 0.05
const area = (b: ModelBody): number => (b.rect.maxX - b.rect.minX) * (b.rect.maxZ - b.rect.minZ)

export type Located = { bodyId: string; side: Side; alongM: number; why: string }
export type Unlocated = { code: 'WITNESS_NOT_LOCATED' | 'WITNESS_AMBIGUOUS_PLACE'; why: string }

/** The body a printed mark stands at, through the registration of its own frame. */
export function locateWitness(bodies: readonly ModelBody[], views: readonly BindView[], w: PrintedWitness): Located | Unlocated {
  if (!w.box) return { code: 'WITNESS_NOT_LOCATED', why: `the mark ${w.literal ?? w.valueM} has no place in its picture: a printed number without coordinates cannot be put on a body` }
  const view = views.find((v) => v.frameId === w.frameId)
  if (!view) return { code: 'WITNESS_NOT_LOCATED', why: `the mark ${w.literal ?? w.valueM} is on ${w.frameId}, which no registration places on a side of the model (a section or an unregistered picture)` }
  const p = view.projection
  const cx = (w.box.x0 + w.box.x1) / 2
  const a = p.alongAtPx0 + p.alongSign * p.mpp * cx
  const tol = Math.max(0.1, view.alongErrorM)
  const hit = bodies.filter((b) => {
    const e = extentOn(b, view.side)
    return a >= e.lo - tol && a <= e.hi + tol
  })
  if (hit.length === 1) return { bodyId: hit[0].id, side: view.side, alongM: Math.round(a * 1e3) / 1e3, why: `at ${a.toFixed(2)} m along ${view.side.toLowerCase()} (registered ${view.origin.toLowerCase()}), over ${hit[0].id} only` }
  if (hit.length === 0) {
    // a mark printed beside the building (a level line's tag outside the walls) belongs to the nearest body end on that side
    const near = bodies.map((b) => {
      const e = extentOn(b, view.side)
      return { b, d: a < e.lo ? e.lo - a : a - e.hi }
    }).sort((x, y) => x.d - y.d)
    if (near.length > 0 && near[0].d < 1.5 && (near.length < 2 || near[1].d - near[0].d > 1)) return { bodyId: near[0].b.id, side: view.side, alongM: Math.round(a * 1e3) / 1e3, why: `at ${a.toFixed(2)} m along ${view.side.toLowerCase()}, ${near[0].d.toFixed(2)} m beside ${near[0].b.id}, the only body end that near` }
    return { code: 'WITNESS_NOT_LOCATED', why: `the mark is at ${a.toFixed(2)} m along ${view.side.toLowerCase()}, over no body of the model` }
  }
  return { code: 'WITNESS_AMBIGUOUS_PLACE', why: `the mark is at ${a.toFixed(2)} m along ${view.side.toLowerCase()}, where ${hit.map((b) => b.id).join(' and ')} stand one behind the other: the elevation does not say which one it marks` }
}

/** The body (or the bodies, for a level they share) the target object belongs to. */
export function targetBodies(m: CanonicalBuildingModel, bodies: readonly ModelBody[], targetId: string): { ids: string[]; what: string } | undefined {
  const roof = bodies.filter((b) => b.roofIds.includes(targetId))
  if (roof.length > 0) return { ids: roof.map((b) => b.id), what: `roof ${targetId}` }
  const plane = bodies.filter((b) => b.planeIds.includes(targetId))
  if (plane.length > 0) return { ids: plane.map((b) => b.id), what: `roof plane ${targetId}` }
  // a roof stated in planes is named by its region (`roof-<body>`: the name its planes carry before the side they drain to)
  const region = bodies.filter((b) => b.planeIds.length > 0 && b.planeIds.some((id) => id.replace(/-(minX|maxX|minZ|maxZ)(-\d+)?$/, '') === targetId))
  if (region.length > 0) return { ids: region.map((b) => b.id), what: `roof ${targetId}` }
  const wall = bodies.filter((b) => b.wallIds.includes(targetId))
  if (wall.length > 0) return { ids: wall.map((b) => b.id), what: `wall ${targetId}` }
  const w = m.walls.find((x) => x.id === targetId)
  if (w) {
    const mx = (w.start.x + w.end.x) / 2
    const mz = (w.start.z + w.end.z) / 2
    const b = bodies.filter((x) => inside(x, mx, mz)).sort((p, q) => area(p) - area(q))[0]
    return b ? { ids: [b.id], what: `interior wall ${targetId}` } : undefined
  }
  const c = m.chimneys.find((x) => x.id === targetId)
  if (c) {
    const b = bodies.filter((x) => inside(x, (c.footprint.minX + c.footprint.maxX) / 2, (c.footprint.minZ + c.footprint.maxZ) / 2)).sort((p, q) => area(p) - area(q))[0]
    return b ? { ids: [b.id], what: `chimney ${targetId}` } : undefined
  }
  if (m.levels.some((l) => l.id === targetId)) {
    const on = bodies.filter((b) => b.levelIds.includes(targetId))
    return { ids: (on.length > 0 ? on : bodies).map((b) => b.id), what: `level ${targetId}` }
  }
  return undefined
}

export type Resolution =
  | { ok: true; witness: PrintedWitness; located?: Located; targetBodyIds?: string[]; datum: string; why: string }
  | { ok: false; code: string; why: string }

/**
 * Among the anchored witnesses of the right role and value: the one standing on the target's body. In a one-body model
 * the place is not needed (there is no other body to confuse), only the datum.
 */
export function resolveWitness(m: CanonicalBuildingModel, views: readonly BindView[], targetId: string, property: string, candidates: readonly PrintedWitness[]): Resolution {
  const levelLike = property === 'LEVEL_ELEVATION' || property === 'WALL_HEIGHT' || property === 'CHIMNEY_HEIGHT'
  const datumOk = (w: PrintedWitness): boolean => !levelLike || !w.datum || !FOREIGN_DATUMS.has(w.datum)
  const dated = candidates.filter(datumOk)
  if (dated.length === 0) return { ok: false, code: 'DATUM_MISMATCH', why: `the mark is stated from ${[...new Set(candidates.map((w) => w.datum))].join(' / ')}, the model's levels from the drawing's finished ±0,00: an equal number on another datum is another height` }
  const datumOf = (w: PrintedWitness): string => (levelLike ? (w.datum && w.datum !== 'UNKNOWN' ? w.datum : `${MODEL_DATUM} (not stated on the mark: the drawing's ±0,00 taken)`) : 'NOT_A_LEVEL')
  const bodies = bodiesOf(m)
  if (bodies.length <= 1) {
    const distinct = new Set(dated.map((w) => w.frameId))
    if (distinct.size > 1) return { ok: false, code: 'AMBIGUOUS_WITNESS', why: `the value is printed on ${[...distinct].join(' and ')}: two marks on different pictures do not confirm each other, and neither is chosen` }
    return { ok: true, witness: dated[0], datum: datumOf(dated[0]), why: `one body: the mark on ${dated[0].frameId} witnesses ${targetId}` }
  }
  const tgt = targetBodies(m, bodies, targetId)
  if (!tgt) return { ok: false, code: 'TARGET_NOT_IN_BODY', why: `${targetId} stands over none of the model's ${bodies.length} bodies` }
  const located = dated.map((w) => ({ w, loc: locateWitness(bodies, views, w) }))
  const placed = located.filter((x): x is { w: PrintedWitness; loc: Located } => 'bodyId' in x.loc)
  if (placed.length === 0) {
    const first = located[0].loc as Unlocated
    return { ok: false, code: first.code, why: `${bodies.length} bodies (${bodies.map((b) => b.id).join(', ')}): ${located.map((x) => (x.loc as Unlocated).why).join('; ').slice(0, 400)}` }
  }
  const on = placed.filter((x) => tgt.ids.includes(x.loc.bodyId))
  if (on.length === 0) return { ok: false, code: 'HOST_NOT_BOUND', why: `the mark stands over ${[...new Set(placed.map((x) => x.loc.bodyId))].join(', ')} (${placed[0].loc.why}); ${tgt.what} is on ${tgt.ids.join(', ')}: a value printed for another body does not witness this one, whatever the names say` }
  const distinct = new Set(on.map((x) => `${x.w.frameId}|${x.loc.bodyId}`))
  if (distinct.size > 1 && new Set(on.map((x) => x.loc.bodyId)).size > 1) return { ok: false, code: 'AMBIGUOUS_WITNESS', why: `the value is printed over ${[...distinct].map((d) => d.replace('|', ' at ')).join(' and ')}: marks on different bodies do not confirm each other` }
  return { ok: true, witness: on[0].w, located: on[0].loc, targetBodyIds: tgt.ids, datum: datumOf(on[0].w), why: `${on[0].loc.why}; ${tgt.what} is on ${tgt.ids.join(', ')}` }
}
