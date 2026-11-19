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
 */
import type { CanonicalBuildingModel } from '@buildapp/model'
import type { ElevationSketch } from '../../appearance/elevation-sketch.js'
import { iou } from './source-gate.js'
import type { Box } from './source-gate.js'
import { openingBoxes, sideOfFacade } from './execute.js'
import type { BindView, CorrectionProposal } from './execute.js'

export const SKETCH_PROPOSALS_VERSION = '1.0.0' as const
/** Below this overlap a model opening and a sketch opening are two different openings. */
export const PAIR_MIN_IOU = 0.1
/** At or above this overlap (and the same kind) a pair agrees: nothing to propose. */
export const AGREE_IOU = 0.8

const bbox = (poly: ReadonlyArray<readonly [number, number]>): Box => ({ x0: Math.min(...poly.map((p) => p[0])), y0: Math.min(...poly.map((p) => p[1])), x1: Math.max(...poly.map((p) => p[0])), y1: Math.max(...poly.map((p) => p[1])) })
const KIND: Record<string, 'WINDOW' | 'DOOR' | 'GLAZED_DOOR' | 'GARAGE_DOOR' | undefined> = { WINDOW: 'WINDOW', DOOR: 'DOOR', GLAZED_DOOR: 'GLAZED_DOOR', GATE: 'GARAGE_DOOR' }

export type SketchProposalAccount = { sketchId: string; frameId: string; side?: string; proposals: CorrectionProposal[]; agreed: Array<{ sketchId: string; modelId: string; iou: number }>; skipped: Array<{ sketchId: string; why: string }> }

export function proposalsFromSketch(s: ElevationSketch, facade: string, model: CanonicalBuildingModel, views: readonly BindView[], baseRevision: string): SketchProposalAccount {
  const side = sideOfFacade(facade)
  const view = views.find((v) => v.frameId === s.frameId && v.side === side) ?? views.find((v) => v.frameId === s.frameId)
  const out: SketchProposalAccount = { sketchId: s.sketchId, frameId: s.frameId, ...(side ? { side } : {}), proposals: [], agreed: [], skipped: [] }
  if (!view) {
    out.skipped.push({ sketchId: s.sketchId, why: 'its elevation is not registered to a side: nothing of it can be placed (an ASSIGN_VIEW could register it)' })
    return out
  }
  const isWindow = (id: string): boolean => model.windows.some((w) => w.openingId === id)
  const modelBoxes = openingBoxes(model, view)
  const sketchOpenings = s.openings.map((o) => ({ o, box: bbox(o.polygon), kind: KIND[o.kind] }))
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
    const sameKind = (so.kind === 'WINDOW') === isWindow(mb.id)
    if (p.v >= AGREE_IOU && sameKind) {
      out.agreed.push({ sketchId: so.o.id, modelId: mb.id, iou: Math.round(p.v * 1000) / 1000 })
      continue
    }
    out.proposals.push({ proposalId: pid('upd', so.o.id), baseRevision, operation: 'UPDATE_OPENING', targetId: mb.id, frameId: s.frameId, patch: { box: so.box, kind: so.kind }, origin: 'SKETCH', uncertainty: 'MEDIUM', justification: `the sketch of this elevation draws ${so.o.id} (${so.o.kind}) where the model's ${mb.id} stands differently (overlap ${p.v.toFixed(2)}${sameKind ? '' : ', another kind'})` })
  }
  sketchOpenings.forEach((so, i) => {
    if (usedS.has(i)) return
    if (!so.kind) {
      out.skipped.push({ sketchId: so.o.id, why: `${so.o.kind}: no opening kind of the registry takes it` })
      return
    }
    out.proposals.push({ proposalId: pid('add', so.o.id), baseRevision, operation: 'ADD_OPENING', targetId: view.side, frameId: s.frameId, patch: { box: so.box, kind: so.kind }, origin: 'SKETCH', uncertainty: 'MEDIUM', justification: `the sketch of this elevation draws ${so.o.id} (${so.o.kind}); the model has no opening there` })
  })
  for (const e of s.elements.filter((x) => x.kind === 'CHIMNEY')) {
    out.proposals.push({ proposalId: pid('chimney', e.id), baseRevision, operation: 'ADD_CHIMNEY', targetId: view.side, frameId: s.frameId, patch: { box: bbox(e.polygon) }, origin: 'SKETCH', uncertainty: 'MEDIUM', justification: `the sketch of this elevation draws a chimney (${e.id})` })
  }
  for (const e of s.elements.filter((x) => x.kind !== 'CHIMNEY' && x.kind !== 'GUTTER_DOWNPIPE')) out.skipped.push({ sketchId: e.id, why: `${e.kind}: UNSUPPORTED_OPERATION — no consumer of this element in registry 1.0.0 (named, not corrected)` })
  return out
}
