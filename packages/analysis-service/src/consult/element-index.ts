/**
 * v3.54.17 R2 (audit §4, P0) — the editable elements of the revision a reviewer looks at, by their canonical ids.
 *
 * The reviewer's operations name "a listed element" (UPDATE_OPENING, REMOVE_OPENING, UPDATE_CHIMNEY, SET_PARAMETER,
 * SET_ROOF, SET_OUTLINE), but until now nothing was listed: the reviewer saw the model's pictures and could describe a
 * wrong door without any way to name it. This is that list — compact, versioned, deterministic, part of the message the
 * reviewer is actually sent — and never shown on the phone. For each element: its id, its type, its body / host / level,
 * the side it faces, where it is along that side as seen from outside (metres from the side's left end, and as a share
 * of the side), its heights, and where it is drawn in the model's SIDES picture (pixels), so a defect seen in the
 * pictures can be bound to an id instead of guessed.
 *
 * Not the whole model JSON: walls inside, slabs, materials and finishes are left out (no operation edits them by id).
 */
import { createHash } from 'node:crypto'
import type { CanonicalBuildingModel, Wall } from '@buildapp/model'
import { bodiesOf } from './massing/massing.js'
import { kindOfOpening, modelRevision, openingSpan, sideOfWall } from './correct/execute.js'
import type { Side } from './correct/execute.js'
import type { ModelViewPicture } from './model-views.js'

export const ELEMENT_INDEX_VERSION = '1.0.0' as const
/** The operations whose targetId must be a listed element (or a side / WHOLE where the registry says so). */
export const LISTED_TARGET_OPERATIONS = ['UPDATE_OPENING', 'REMOVE_OPENING', 'UPDATE_CHIMNEY', 'SET_PARAMETER', 'SET_ROOF', 'SET_OUTLINE', 'SET_ROOF_OVERHANG'] as const

export type IndexedElement = {
  id: string
  type: 'BODY' | 'LEVEL' | 'WALL' | 'OPENING' | 'ROOF' | 'ROOF_PLANE' | 'CHIMNEY'
  /** WINDOW, DOOR, GLAZED_DOOR, GARAGE_DOOR for an opening; the roof's kind for a roof. */
  kind?: string
  body?: string
  host?: string
  level?: string
  side?: Side
  /** Metres from the side's left end as seen from outside, and the same as a share of the side's walled length. */
  along?: [number, number]
  share?: [number, number]
  /** Heights above ±0.00 (sill and head of an opening; base and top of a wall or stack; eaves of a roof). */
  heights?: [number, number]
  /** Where it is drawn in the SIDES picture, in its pixels. */
  sidesPx?: { x0: number; x1: number; y0: number; y1: number }
  note?: string
}
export type ElementIndex = { version: typeof ELEMENT_INDEX_VERSION; revision: string; elements: IndexedElement[]; sha256: string }

const r2 = (v: number): number => Math.round(v * 100) / 100
const SIDES: Side[] = ['FRONT', 'RIGHT', 'REAR', 'LEFT']
const alongAxis = (s: Side): 'x' | 'z' => (s === 'FRONT' || s === 'REAR' ? 'x' : 'z')
/** Seen from outside, a side's left end: FRONT at min x, RIGHT at min z, REAR at max x, LEFT at max z (the SIDES picture). */
const leftIsLow = (s: Side): boolean => s === 'FRONT' || s === 'RIGHT'

export function elementIndexOf(m: CanonicalBuildingModel, sides?: Pick<ModelViewPicture, 'frame'>): ElementIndex {
  const exterior = m.walls.filter((w) => w.kind === 'EXTERIOR')
  const range = new Map<Side, { lo: number; hi: number }>()
  for (const s of SIDES) {
    const ws = exterior.filter((w) => sideOfWall(m, w) === s)
    if (ws.length === 0) continue
    const a = alongAxis(s)
    const vs = ws.flatMap((w) => [w.start[a], w.end[a]])
    range.set(s, { lo: Math.min(...vs), hi: Math.max(...vs) })
  }
  const fromLeft = (s: Side, a: number): number => {
    const r = range.get(s)
    if (!r) return a
    return leftIsLow(s) ? a - r.lo : r.hi - a
  }
  const span = (s: Side, a0: number, a1: number): Pick<IndexedElement, 'along' | 'share'> => {
    const r = range.get(s)
    const p = [fromLeft(s, a0), fromLeft(s, a1)].sort((x, y) => x - y) as [number, number]
    const L = r ? r.hi - r.lo : 0
    return { along: [r2(p[0]), r2(p[1])], ...(L > 0 ? { share: [Math.round((p[0] / L) * 100) / 100, Math.round((p[1] / L) * 100) / 100] as [number, number] } : {}) }
  }
  // the SIDES picture: tile i shows side i; screen x of a model point, row of a height (model-views.ts)
  const f = sides?.frame
  const screen = (s: Side, x: number, z: number): number | undefined => {
    if (!f?.tileCentreM || !f.centre) return undefined
    const i = SIDES.indexOf(s)
    const c = f.centre
    const sx = s === 'FRONT' ? x - c.x : s === 'RIGHT' ? z - c.z : s === 'REAR' ? -(x - c.x) : -(z - c.z)
    return i * f.tile + f.tile / 2 + (sx - f.tileCentreM[i]) * f.pxPerM
  }
  const pxBox = (s: Side, a0: number, a1: number, y0: number, y1: number, depth: number): IndexedElement['sidesPx'] => {
    if (!f) return undefined
    const pt = (a: number): number | undefined => (alongAxis(s) === 'x' ? screen(s, a, depth) : screen(s, depth, a))
    const p0 = pt(a0)
    const p1 = pt(a1)
    if (p0 === undefined || p1 === undefined) return undefined
    return { x0: Math.round(Math.min(p0, p1)), x1: Math.round(Math.max(p0, p1)), y0: Math.round(f.rowOfZero - y1 * f.pxPerM), y1: Math.round(f.rowOfZero - y0 * f.pxPerM) }
  }
  const depthOf = (s: Side, w: Wall): number => (alongAxis(s) === 'x' ? w.start.z : w.start.x)
  const levelElevation = new Map(m.levels.map((l) => [l.id, l.elevation]))
  const bodies = bodiesOf(m)
  const bodyOfWall = new Map<string, string>()
  const bodyOfRoof = new Map<string, string>()
  for (const b of bodies) {
    for (const w of b.wallIds) bodyOfWall.set(w, b.id)
    for (const r of [...b.roofIds, ...b.planeIds]) bodyOfRoof.set(r, b.id)
  }
  const out: IndexedElement[] = []
  for (const b of bodies) out.push({ id: b.id, type: 'BODY', note: `rings ${b.ringIds.join(', ')}; plan ${r2(b.rect.minX)}..${r2(b.rect.maxX)} × ${r2(b.rect.minZ)}..${r2(b.rect.maxZ)} m; roofs ${[...b.roofIds, ...b.planeIds].join(', ') || 'none'}` })
  for (const l of [...m.levels].sort((a, b) => a.index - b.index)) out.push({ id: l.id, type: 'LEVEL', heights: [r2(l.elevation), r2(l.elevation + l.height)], note: `storey ${l.index}` })
  for (const w of exterior) {
    const s = sideOfWall(m, w)
    const base = (levelElevation.get(w.levelId) ?? 0) + w.baseOffset
    const a = s ? alongAxis(s) : 'x'
    out.push({ id: w.id, type: 'WALL', ...(bodyOfWall.get(w.id) ? { body: bodyOfWall.get(w.id) } : {}), level: w.levelId, ...(s ? { side: s, ...span(s, w.start[a], w.end[a]) } : {}), heights: [r2(base), r2(base + w.height)], ...(s ? { sidesPx: pxBox(s, w.start[a], w.end[a], base, base + w.height, depthOf(s, w)) } : {}), ...(w.topProfile ? { note: 'its top follows the roof' } : {}) })
  }
  for (const o of m.openings) {
    const sp = openingSpan(m, o)
    const wall = m.walls.find((w) => w.id === o.wallId)
    out.push({ id: o.id, type: 'OPENING', kind: kindOfOpening(m, o.id) ?? o.kind, host: o.wallId, ...(bodyOfWall.get(o.wallId) ? { body: bodyOfWall.get(o.wallId) } : {}), ...(wall ? { level: wall.levelId } : {}), ...(sp ? { side: sp.side, ...span(sp.side, sp.a0, sp.a1), heights: [r2(sp.y0), r2(sp.y1)], sidesPx: pxBox(sp.side, sp.a0, sp.a1, sp.y0, sp.y1, depthOf(sp.side, sp.wall)) } : { note: 'on an interior wall' }) })
  }
  for (const r of m.roofs) out.push({ id: r.id, type: 'ROOF', kind: r.kind, ...(bodyOfRoof.get(r.id) ? { body: bodyOfRoof.get(r.id) } : {}), level: r.levelId, note: `pitch ${r2(r.pitchDeg)}°, ridge along ${r.ridgeAxis}` })
  for (const p of m.roofPlanes) out.push({ id: p.id, type: 'ROOF_PLANE', ...(bodyOfRoof.get(p.id) ? { body: bodyOfRoof.get(p.id) } : {}), level: p.levelId, note: `pitch ${r2(p.pitchDeg)}°` })
  for (const c of m.chimneys) {
    const base = (levelElevation.get(c.levelId) ?? 0) + c.baseOffset
    const fp = c.footprint as unknown as { x: number; z: number; width: number; depth: number }
    out.push({ id: c.id, type: 'CHIMNEY', level: c.levelId, heights: [r2(base), r2(base + c.height)], note: `plan ${r2(fp.x)}..${r2(fp.x + fp.width)} × ${r2(fp.z)}..${r2(fp.z + fp.depth)} m` })
  }
  const revision = modelRevision(m)
  return { version: ELEMENT_INDEX_VERSION, revision, elements: out, sha256: createHash('sha256').update(JSON.stringify({ revision, out })).digest('hex') }
}

/** The index as the reviewer reads it: one short line per element. `sidesPicture` is the SIDES picture's number. */
export function elementIndexText(index: ElementIndex, sidesPicture?: number): string {
  const line = (e: IndexedElement): string =>
    [
      e.id,
      e.type + (e.kind ? `/${e.kind}` : ''),
      e.side ? e.side : '',
      e.body ? `body ${e.body}` : '',
      e.host ? `host ${e.host}` : '',
      e.level ? `level ${e.level}` : '',
      e.along ? `${e.along[0]}–${e.along[1]} m from the left${e.share ? ` (${Math.round(e.share[0] * 100)}–${Math.round(e.share[1] * 100)} %)` : ''}` : '',
      e.heights ? `${e.heights[0]}–${e.heights[1]} m high` : '',
      e.sidesPx && sidesPicture ? `picture ${sidesPicture} x ${e.sidesPx.x0}–${e.sidesPx.x1}, y ${e.sidesPx.y0}–${e.sidesPx.y1}` : '',
      e.note ?? '',
    ].filter(Boolean).join(' · ')
  return [
    `MODEL ELEMENT INDEX (index ${index.version}, revision ${index.revision}): the editable elements of THIS revision by their ids — the only ids a targetId may name. Positions along a side are metres from that side's left end as seen from outside (as in the SIDES picture and in a source elevation of that side), heights above ±0.00.`,
    ...index.elements.map(line),
  ].join('\n')
}
