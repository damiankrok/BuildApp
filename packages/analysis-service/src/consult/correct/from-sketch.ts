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
import { kindOfOpening, openingBoxes, OVERHANG_MIN_CHANGE_M, preferredView, shapeOfOpening, sideOfFacade, sideRoof } from './execute.js'
import type { BindView, CorrectionProposal, Side } from './execute.js'

export const SKETCH_PROPOSALS_VERSION = '1.3.0' as const
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
  const sketchOpenings = s.openings.map((o) => {
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
  for (const p of pairs) {
    if (usedS.has(p.i) || usedM.has(p.j)) continue
    usedS.add(p.i)
    usedM.add(p.j)
    const so = sketchOpenings[p.i]
    const mb = modelBoxes[p.j]
    if (!so.kind) {
      out.skipped.push({ sketchId: so.o.id, why: `${so.o.kind}: no opening kind of the registry takes it` })
      continue
    }
    const modelKind = kindOfOpening(model, mb.id)
    const sameKind = so.kind === modelKind
    const headAgrees = sameHead(so.shape, modelShape(mb.id))
    if (p.v >= AGREE_IOU && sameKind && headAgrees) {
      out.agreed.push({ sketchId: so.o.id, modelId: mb.id, iou: Math.round(p.v * 1000) / 1000 })
      continue
    }
    const diffs = [...(p.v < AGREE_IOU ? [`overlap ${p.v.toFixed(2)}`] : []), ...(sameKind ? [] : [`kind ${modelKind ?? '?'} → ${so.kind}`]), ...(headAgrees ? [] : [so.head ? 'a raked head' : 'a level head'])]
    out.proposals.push({ proposalId: pid('upd', so.o.id), baseRevision, operation: 'UPDATE_OPENING', targetId: mb.id, frameId: s.frameId, patch: { box: so.box, kind: so.kind, ...(so.head ?? {}) }, origin: 'SKETCH', uncertainty: 'MEDIUM', justification: `the sketch of this elevation draws ${so.o.id} (${so.o.kind}) where the model's ${mb.id} stands differently (${diffs.join(', ')})` })
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
