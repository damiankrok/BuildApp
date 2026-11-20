/**
 * v3.54.16 — the sketch's typed elements as proposals, directly: no drawing them to a picture for the shape reader to
 * guess again. A sketch is an API reading of ONE original elevation in that elevation's own frame pixels; each of its
 * openings and chimneys becomes a proposal of the shared registry, bound and judged like a reviewer's — by the
 * registration of that frame and by the original picture (`source-gate.ts`), never by its agreement with the model.
 *
 * Matching is one to one: a sketch opening and a model opening are paired by the largest overlap first, each used once.
 * A pair that disagrees (place, size, height or kind) is an UPDATE of the model's opening; a sketch opening without a
 * partner is an ADD; a model opening without one is left alone — a sketch that misses an opening is not evidence that
 * the opening is not there. A stack already standing over the same stretch of the side is not proposed again.
 *
 * v3.54.16 audit A2 (1.1.0): the sketch's polygon is kept as a shape — a raked head's two ends travel with the
 * proposal (`headLeftY` / `headRightY`) — and the kind is compared exactly (a door, a glazed door and a garage door
 * are three kinds, not "not a window"). A pair that agrees in box but not in head or kind is an UPDATE.
 */
import type { CanonicalBuildingModel } from '@buildapp/model'
import type { ElevationSketch } from '../../appearance/elevation-sketch.js'
import { iou, isRaked } from './source-gate.js'
import type { Box, Shape } from './source-gate.js'
import { kindOfOpening, openingBoxes, openingSpan, OVERHANG_MIN_CHANGE_M, preferredView, shapeOfOpening, sideOfFacade, sideRoof } from './execute.js'
import type { BindView, CorrectionProposal, Side } from './execute.js'

export const SKETCH_PROPOSALS_VERSION = '1.5.0' as const
/** Below this overlap a model opening and a sketch opening are two different openings. */
export const PAIR_MIN_IOU = 0.1
/** At or above this overlap (and the same kind) a pair agrees: nothing to propose. */
export const AGREE_IOU = 0.8

const bbox = (poly: ReadonlyArray<readonly [number, number]>): Box => ({ x0: Math.min(...poly.map((p) => p[0])), y0: Math.min(...poly.map((p) => p[1])), x1: Math.max(...poly.map((p) => p[0])), y1: Math.max(...poly.map((p) => p[1])) })
/** The polygon's top at the bbox's left and right columns: a raked head when they differ by ≥ 2 px and 4 % of its height. */
export function headOf(poly: ReadonlyArray<readonly [number, number]>): { headLeftY: number; headRightY: number } | undefined {
  if (poly.length < 3) return undefined
  const b = bbox(poly)
  const topAt = (x: number): number | undefined => {
    const ys: number[] = []
    for (let i = 0; i < poly.length; i += 1) {
      const [ax, ay] = poly[i]
      const [bx, by] = poly[(i + 1) % poly.length]
      if ((ax - x) * (bx - x) > 0) continue
      if (ax === bx) ys.push(Math.min(ay, by))
      else ys.push(ay + ((by - ay) * (x - ax)) / (bx - ax))
    }
    return ys.length > 0 ? Math.min(...ys) : undefined
  }
  const l = topAt(b.x0)
  const r = topAt(b.x1)
  if (l === undefined || r === undefined) return undefined
  return Math.abs(l - r) >= Math.max(2, 0.04 * (b.y1 - b.y0)) ? { headLeftY: Math.round(l * 10) / 10, headRightY: Math.round(r * 10) / 10 } : undefined
}

/** An opening's span hidden on its side by another exterior wall standing further out over the same stretch. */
function occluded(m: CanonicalBuildingModel, sp: NonNullable<ReturnType<typeof openingSpan>>): boolean {
  const ax = sp.side === 'FRONT' || sp.side === 'REAR' ? 'x' : 'z'
  const perp = ax === 'x' ? 'z' : 'x'
  const out = sp.side === 'REAR' || sp.side === 'RIGHT' ? 1 : -1
  const face = sp.wall.start[perp]
  return m.walls.some((w) => {
    if (w.kind !== 'EXTERIOR' || w.id === sp.wall.id || Math.abs(w.start[perp] - w.end[perp]) > 1e-3) return false
    if ((w.start[perp] - face) * out <= 0.05) return false
    const lo = Math.min(w.start[ax], w.end[ax])
    const hi = Math.max(w.start[ax], w.end[ax])
    return Math.min(hi, sp.a1) - Math.max(lo, sp.a0) > 0.05
  })
}

const KIND: Record<string, 'WINDOW' | 'DOOR' | 'GLAZED_DOOR' | 'GARAGE_DOOR' | undefined> = { WINDOW: 'WINDOW', DOOR: 'DOOR', GLAZED_DOOR: 'GLAZED_DOOR', GATE: 'GARAGE_DOOR' }

export type SketchProposalAccount = { sketchId: string; frameId: string; side?: string; proposals: CorrectionProposal[]; agreed: Array<{ sketchId: string; modelId: string; iou: number }>; skipped: Array<{ sketchId: string; why: string }> }

/** `sideOf` (v3.54.17 R3): the side this elevation shows when the orientation hypothesis says it is not its label's. */
export function proposalsFromSketch(s: ElevationSketch, facade: string, model: CanonicalBuildingModel, views: readonly BindView[], baseRevision: string, sideOf?: Side): SketchProposalAccount {
  const side = sideOf ?? sideOfFacade(facade)
  const view = preferredView(views, s.frameId, side) ?? (sideOf ? undefined : preferredView(views, s.frameId))
  const out: SketchProposalAccount = { sketchId: s.sketchId, frameId: s.frameId, ...(side ? { side } : {}), proposals: [], agreed: [], skipped: [] }
  if (!view) {
    out.skipped.push({ sketchId: s.sketchId, why: 'its elevation is not registered to a side: nothing of it can be placed (an ASSIGN_VIEW could register it)' })
    return out
  }
  const modelBoxes = openingBoxes(model, view)
  // v3.54.17 R3: an opening drawn on a roof surface and on no wall zone (a roof window, a skylight) is not a wall opening;
  // a window in a gable's triangle is in the gable wall's zone and stays one
  const inside = (poly: ReadonlyArray<readonly [number, number]>, x: number, y: number): boolean => {
    let c = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if (poly[i][1] > y !== poly[j][1] > y && x < ((poly[j][0] - poly[i][0]) * (y - poly[i][1])) / (poly[j][1] - poly[i][1]) + poly[i][0]) c = !c
    return c
  }
  const inRoof = (o: { polygon: ReadonlyArray<readonly [number, number]> }): boolean => {
    const b = bbox(o.polygon)
    const cx = (b.x0 + b.x1) / 2
    const cy = (b.y0 + b.y1) / 2
    return s.roofs.some((r) => inside(r.polygon, cx, cy)) && !s.walls.some((w) => inside(w.polygon, cx, cy))
  }
  for (const o of s.openings) if (inRoof(o)) out.skipped.push({ sketchId: o.id, why: 'drawn on the roof and on no wall (a roof window): not an opening of a wall' })
  const sketchOpenings = s.openings.filter((o) => !inRoof(o)).map((o) => {
    const head = headOf(o.polygon)
    const box = bbox(o.polygon)
    return { o, box, head, shape: (head ? { ...box, ...head } : box) as Shape, kind: KIND[o.kind] }
  })
  const modelShape = (id: string): Shape | undefined => {
    const op = model.openings.find((x) => x.id === id)
    return op ? shapeOfOpening(model, op, view) : undefined
  }
  const sameHead = (a: Shape, b: Shape | undefined): boolean => {
    if (!b || isRaked(a) !== isRaked(b)) return false
    if (!isRaked(a)) return true
    const tol = Math.max(2, 0.04 * (a.y1 - a.y0))
    return Math.abs((a.headLeftY as number) - (b.headLeftY as number)) <= tol && Math.abs((a.headRightY as number) - (b.headRightY as number)) <= tol
  }
  // one to one, the largest overlap first
  const pairs = sketchOpenings.flatMap((so, i) => modelBoxes.map((mb, j) => ({ i, j, v: iou(so.box, mb.box) }))).filter((p) => p.v >= PAIR_MIN_IOU).sort((a, b) => b.v - a.v)
  const usedS = new Set<number>()
  const usedM = new Set<number>()
  const pid = (what: string, id: string): string => `sk:${s.frameId.slice(-10)}:${what}:${id}`
  const chosen: Array<{ i: number; j: number; v: number }> = []
  for (const p of pairs) {
    if (usedS.has(p.i) || usedM.has(p.j)) continue
    usedS.add(p.i)
    usedM.add(p.j)
    chosen.push(p)
  }
  // v3.54.17 R3: one opening of the sketch over several of the model (two windows that are one glazed band in the
  // source): the model openings it covers (most of their area) that pair with nothing are absorbed by its update; a
  // sketch opening that pairs with none of them updates the largest it covers. Never more than the sketch covers.
  const area = (b: { x0: number; y0: number; x1: number; y1: number }): number => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0)
  const coverOf = (a: { x0: number; y0: number; x1: number; y1: number }, b: { x0: number; y0: number; x1: number; y1: number }): number => area({ x0: Math.max(a.x0, b.x0), y0: Math.max(a.y0, b.y0), x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1) }) / Math.max(1e-9, area(b))
  const ABSORB_COVER = 0.6
  const absorbsOf = new Map<number, string[]>()
  sketchOpenings.forEach((so, i) => {
    if (!so.kind) return
    const covered = modelBoxes.map((mb, j) => ({ mb, j })).filter(({ j, mb }) => !usedM.has(j) && coverOf(so.box, mb.box) >= ABSORB_COVER)
    if (covered.length === 0) return
    if (!usedS.has(i)) {
      // no pair: the largest covered opening is the one updated
      const biggest = covered.reduce((a, c) => (area(c.mb.box) > area(a.mb.box) ? c : a))
      usedS.add(i)
      usedM.add(biggest.j)
      chosen.push({ i, j: biggest.j, v: iou(so.box, biggest.mb.box) })
      covered.splice(covered.indexOf(biggest), 1)
    }
    for (const c of covered) usedM.add(c.j)
    if (covered.length) absorbsOf.set(i, covered.map((c) => c.mb.id))
  })
  for (const p of chosen) {
    const so = sketchOpenings[p.i]
    const mb = modelBoxes[p.j]
    const absorbs = absorbsOf.get(p.i) ?? []
    if (!so.kind) {
      out.skipped.push({ sketchId: so.o.id, why: `${so.o.kind}: no opening kind of the registry takes it` })
      continue
    }
    const modelKind = kindOfOpening(model, mb.id)
    const sameKind = so.kind === modelKind
    const headAgrees = sameHead(so.shape, modelShape(mb.id))
    if (p.v >= AGREE_IOU && sameKind && headAgrees && absorbs.length === 0) {
      out.agreed.push({ sketchId: so.o.id, modelId: mb.id, iou: Math.round(p.v * 1000) / 1000 })
      continue
    }
    const diffs = [...(p.v < AGREE_IOU ? [`overlap ${p.v.toFixed(2)}`] : []), ...(sameKind ? [] : [`kind ${modelKind ?? '?'} → ${so.kind}`]), ...(headAgrees ? [] : [so.head ? 'a raked head' : 'a level head']), ...(absorbs.length ? [`one opening over ${[mb.id, ...absorbs].join(' + ')}`] : [])]
    out.proposals.push({ proposalId: pid('upd', so.o.id), baseRevision, operation: 'UPDATE_OPENING', targetId: mb.id, frameId: s.frameId, patch: { box: so.box, kind: so.kind, ...(so.head ?? {}), ...(absorbs.length ? { absorbs } : {}) }, origin: 'SKETCH', uncertainty: 'MEDIUM', justification: `the sketch of this elevation draws ${so.o.id} (${so.o.kind}) where the model's ${mb.id} stands differently (${diffs.join(', ')})` })
  }
  // v3.54.17 R3: a model opening the sketch pairs with nothing is put to the ORIGINAL picture (REMOVE_OPENING: removed only
  // where the source shows nothing distinct in its box) — first, so the sketch's own openings are placed after it. Not
  // proposed when the sketch draws no opening at all on this side, nor for an opening another body stands in front of here,
  // nor where the sketch draws no VISIBLE wall zone over the opening.
  if (sketchOpenings.length > 0) {
    const removals: CorrectionProposal[] = []
    modelBoxes.forEach((mb, j) => {
      if (usedM.has(j)) return
      const op = model.openings.find((x) => x.id === mb.id)
      const sp = op ? openingSpan(model, op) : undefined
      if (!sp || occluded(model, sp)) {
        out.skipped.push({ sketchId: mb.id, why: sp ? 'another body stands in front of it on this side: the drawing does not show it' : 'not on an exterior side' })
        return
      }
      // absence is evidence only on a wall the sketch says it SEES there: no visible wall zone over the opening, no removal
      const cx = (mb.box.x0 + mb.box.x1) / 2
      const cy = (mb.box.y0 + mb.box.y1) / 2
      if (!s.walls.some((w) => w.visibility === 'VISIBLE' && inside(w.polygon, cx, cy))) {
        out.skipped.push({ sketchId: mb.id, why: 'the sketch draws no visible wall where the model has this opening: its absence says nothing' })
        return
      }
      removals.push({ proposalId: pid('rem', mb.id), baseRevision, operation: 'REMOVE_OPENING', targetId: mb.id, frameId: s.frameId, patch: {}, origin: 'SKETCH', uncertainty: 'MEDIUM', justification: `the sketch of this elevation draws no opening where the model has ${mb.id}; the original picture decides` })
    })
    out.proposals.unshift(...removals)
  }
  sketchOpenings.forEach((so, i) => {
    if (usedS.has(i)) return
    if (!so.kind) {
      out.skipped.push({ sketchId: so.o.id, why: `${so.o.kind}: no opening kind of the registry takes it` })
      return
    }
    out.proposals.push({ proposalId: pid('add', so.o.id), baseRevision, operation: 'ADD_OPENING', targetId: view.side, frameId: s.frameId, patch: { box: so.box, kind: so.kind, ...(so.head ?? {}) }, origin: 'SKETCH', uncertainty: 'MEDIUM', justification: `the sketch of this elevation draws ${so.o.id} (${so.o.kind}); the model has no opening there` })
  })
  for (const e of s.elements.filter((x) => x.kind === 'CHIMNEY')) {
    out.proposals.push({ proposalId: pid('chimney', e.id), baseRevision, operation: 'ADD_CHIMNEY', targetId: view.side, frameId: s.frameId, patch: { box: bbox(e.polygon) }, origin: 'SKETCH', uncertainty: 'MEDIUM', justification: `the sketch of this elevation draws a chimney (${e.id})` })
  }
  // v3.54.17 R3: the main roof's overhang — the drawn roof's ends past the drawn walls' outer corners, through the same
  // registration (SET_ROOF_OVERHANG; the binder reads both ends, checks them and the walls against the side's)
  const roof = sideRoof(model, view.side)
  if (roof && s.roofs.length > 0 && s.walls.length > 0) {
    const area = (poly: ReadonlyArray<readonly [number, number]>): number => Math.abs(poly.reduce((a, q, i) => a + q[0] * poly[(i + 1) % poly.length][1] - poly[(i + 1) % poly.length][0] * q[1], 0)) / 2
    const main = [...s.roofs].sort((a, b) => area(b.polygon) - area(a.polygon))[0].polygon
    const rx = main.map((q) => q[0])
    const wx = s.walls.flatMap((w) => w.polygon.map((q) => q[0]))
    const [roofLeftX, roofRightX, wallLeftX, wallRightX] = [Math.min(...rx), Math.max(...rx), Math.min(...wx), Math.max(...wx)]
    const drawn = ((wallLeftX - roofLeftX + roofRightX - wallRightX) / 2) * view.projection.mpp
    if (Math.abs(drawn - roof.overhang) >= OVERHANG_MIN_CHANGE_M) out.proposals.push({ proposalId: pid('overhang', roof.id), baseRevision, operation: 'SET_ROOF_OVERHANG', targetId: roof.id, frameId: s.frameId, patch: { roofLeftX, roofRightX, wallLeftX, wallRightX }, origin: 'SKETCH', uncertainty: 'MEDIUM', justification: `the sketch of this elevation draws the roof ${(((wallLeftX - roofLeftX) * view.projection.mpp)).toFixed(2)} / ${(((roofRightX - wallRightX) * view.projection.mpp)).toFixed(2)} m past the walls; the model's ${roof.id} has ${roof.overhang.toFixed(2)} m` })
  }
  for (const e of s.elements.filter((x) => x.kind !== 'CHIMNEY' && x.kind !== 'GUTTER_DOWNPIPE')) out.skipped.push({ sketchId: e.id, why: `${e.kind}: UNSUPPORTED_OPERATION — no consumer of this element in registry 1.0.0 (named, not corrected)` })
  return out
}
