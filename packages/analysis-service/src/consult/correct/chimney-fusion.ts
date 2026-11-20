/**
 * v3.54.17 R3 — one stack seen in two elevations at right angles is one stack, with both of its plan coordinates.
 *
 * An elevation gives a stack's place along its own side and its top; its depth only roughly (where it meets the roof,
 * and not at all when the ridge hides its foot). Proposed per elevation, a stack seen from the eaves side and again from
 * the gable end became two stacks — one at the ridge with the eaves view's place, one at the middle with the gable view's.
 * Here the sketched stacks of the registered elevations are paired across perpendicular views: the same top (within
 * `TOP_TOLERANCE_M`) and the same slope (the eaves view's stack is on the near slope when its foot is drawn below the
 * ridge, behind the ridge when its foot is the ridge line; the gable view gives which side of the ridge it stands on).
 * A pairing is used only when it is one to one and the only one — two stacks of one height on one slope are two
 * readings of the source, not a choice to make (they stay single-view proposals). A paired stack becomes ONE proposal
 * with the second view as its depth (`depthPicture` / `depthBox`, bound by the executor's SECOND_VIEW path), and the gable
 * view's proposal of it takes the eaves view as its depth: whichever passes the source gate first places it, the other is
 * its duplicate.
 * 1.1.0: the two eaves sides see the same stacks from opposite sides (the front's far slope is the rear's near one): an
 * eaves stack and one of the opposite elevation over the same stretch of the ridge, with the same top and not both on
 * their near slope, are one stack seen twice — not a second candidate that makes the gable view's pairing ambiguous. Both
 * readings take the gable view as their depth; the first through the gate places it, the other is its duplicate.
 */
import type { CanonicalBuildingModel } from '@buildapp/model'
import type { Box } from './source-gate.js'
import { alongAxis, alongOf, outward, yOf } from './execute.js'
import type { BindPicture, BindView, CorrectionProposal, Side } from './execute.js'

export const CHIMNEY_FUSION_VERSION = '1.1.0' as const
/** Two drawings of one stack give its top within this (≈ three pixels at the drawings' 1–2 cm/px). */
export const TOP_TOLERANCE_M = 0.3

export type SketchedStack = { proposalId: string; frameId: string; side: Side; view: BindView; box: Box; roofTopRow: number }
type Read = SketchedStack & { a0: number; a1: number; top: number; slope?: 'NEAR' | 'FAR' }
export type FusionRecord = { fused: Array<{ eaves: string; gable: string; why: string }>; left: Array<{ proposalId: string; why: string }>; /** every stack as read through its registration: side, along the side's axis, top, slope */ reads?: Array<{ proposalId: string; side: Side; a0: number; a1: number; top: number; slope?: 'NEAR' | 'FAR' }> }

export function fuseChimneys(model: CanonicalBuildingModel, stacks: readonly SketchedStack[], proposals: readonly CorrectionProposal[], pictures: readonly BindPicture[]): { proposals: CorrectionProposal[]; record: FusionRecord } {
  const record: FusionRecord = { fused: [], left: [] }
  const main = [...model.roofs].filter((r) => r.kind !== 'FLAT' && r.pitchDeg > 0).sort((a, b) => (b.footprint.maxX - b.footprint.minX) * (b.footprint.maxZ - b.footprint.minZ) - (a.footprint.maxX - a.footprint.minX) * (a.footprint.maxZ - a.footprint.minZ))[0]
  if (!main) return { proposals: [...proposals], record: { ...record, left: stacks.map((s) => ({ proposalId: s.proposalId, why: 'no pitched roof to tell an eaves view from a gable view' })) } }
  const ridgeAxis = main.ridgeAxis === 'Z' ? 'z' : 'x'
  const ridgeAt = ridgeAxis === 'x' ? (main.footprint.minZ + main.footprint.maxZ) / 2 : (main.footprint.minX + main.footprint.maxX) / 2
  const reads: Read[] = stacks.map((s) => {
    const p = s.view.projection
    const xs = [alongOf(p, s.box.x0), alongOf(p, s.box.x1)]
    const eavesView = alongAxis(s.side) === ridgeAxis
    // the foot drawn on the ridge line (within 3 px) is the ridge hiding it: the stack stands behind the ridge
    const slope = eavesView ? (s.box.y1 <= s.roofTopRow + 3 ? 'FAR' : 'NEAR') : undefined
    return { ...s, a0: Math.min(...xs), a1: Math.max(...xs), top: yOf(p, s.box.y0), ...(slope ? { slope } : {}) }
  })
  const r3 = (v: number): number => Math.round(v * 1000) / 1000
  record.reads = reads.map((r) => ({ proposalId: r.proposalId, side: r.side, a0: r3(r.a0), a1: r3(r.a1), top: r3(r.top), ...(r.slope ? { slope: r.slope } : {}) }))
  const eaves = reads.filter((r) => r.slope)
  const gables = reads.filter((r) => !r.slope)
  // the side of the ridge a gable view's stack stands on, as seen from each eaves side: NEAR to that side, or FAR
  const slopeFrom = (g: Read, e: Read): 'NEAR' | 'FAR' => {
    const c = (g.a0 + g.a1) / 2
    return Math.sign(c - ridgeAt) === outward(e.side) ? 'NEAR' : 'FAR'
  }
  const fits = (e: Read, g: Read): boolean => Math.abs(e.top - g.top) <= TOP_TOLERANCE_M && slopeFrom(g, e) === e.slope
  // the same stack seen from the opposite eaves side: the same stretch of the ridge, the same top, not both near
  const overlap = (a: Read, b: Read): number => Math.min(a.a1, b.a1) - Math.max(a.a0, b.a0)
  const twin = (a: Read, b: Read): boolean => a !== b && outward(a.side) !== outward(b.side) && overlap(a, b) > 0.5 * Math.min(a.a1 - a.a0, b.a1 - b.a0) && Math.abs(a.top - b.top) <= TOP_TOLERANCE_M && !(a.slope === 'NEAR' && b.slope === 'NEAR')
  // gable views of the two ends see the same stacks: pair each eaves stack with the stacks of ONE gable frame at a time
  const out = [...proposals]
  const gableFrames = [...new Set(gables.map((g) => g.frameId))]
  for (const e of eaves) {
    const options = gableFrames.map((f) => gables.filter((g) => g.frameId === f && fits(e, g)))
    const pick = options.find((o) => o.length === 1)?.[0]
    if (!pick) {
      record.left.push({ proposalId: e.proposalId, why: options.some((o) => o.length > 1) ? 'two stacks of one height on that slope in the gable view: which is which is not told by the source' : 'no stack of the same top on the same slope in a gable view' })
      continue
    }
    // one to one: no other eaves stack fits that gable stack
    if (eaves.some((o) => o !== e && !twin(e, o) && fits(o, pick))) {
      record.left.push({ proposalId: e.proposalId, why: `${pick.proposalId} fits two stacks of the eaves view: left unpaired` })
      continue
    }
    const pic = pictures.find((x) => x.frameId === pick.frameId)
    const at = out.findIndex((p) => p.proposalId === e.proposalId)
    if (!pic || at < 0) continue
    out[at] = { ...out[at], patch: { ...(out[at].patch ?? {}), depthPicture: pic.n, depthBox: pick.box }, justification: `${out[at].justification}; its depth from ${pick.proposalId} (the ${pick.side.toLowerCase()} elevation: same top ${pick.top.toFixed(2)} m vs ${e.top.toFixed(2)} m, on the ${e.slope === 'FAR' ? 'far' : 'near'} slope)` }
    // the same stack proposed from a gable view takes its depth from this eaves view in turn: whichever of the two the
    // source gate lets through first places the stack with both coordinates, the other is then its duplicate
    const epic = pictures.find((x) => x.frameId === e.frameId)
    for (const g of options.filter((o) => o.length === 1).map((o) => o[0])) {
      const k = out.findIndex((p) => p.proposalId === g.proposalId)
      if (k >= 0 && epic) out[k] = { ...out[k], patch: { ...(out[k].patch ?? {}), depthPicture: epic.n, depthBox: e.box }, justification: `${out[k].justification}; its depth from ${e.proposalId} (the ${e.side.toLowerCase()} elevation)` }
    }
    const twins = eaves.filter((o) => twin(e, o)).map((o) => o.proposalId)
    record.fused.push({ eaves: e.proposalId, gable: pick.proposalId, why: `top ${e.top.toFixed(2)} / ${pick.top.toFixed(2)} m, ${e.slope === 'FAR' ? 'behind the ridge' : 'on the near slope'}${twins.length ? `; the same stack as ${twins.join(', ')} seen from the opposite side` : ''}` })
  }
  return { proposals: out, record }
}
