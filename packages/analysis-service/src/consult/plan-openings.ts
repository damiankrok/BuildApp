/**
 * v3.54.18 R3 — two drawings of one wall: the openings a plan draws in an exterior wall and the openings an elevation
 * draws on it, both as stretches of the wall seen from outside, left to right, 0..1.
 *
 * Used for one thing: telling apart elevations whose captions do not (two pictures both captioned "side elevation").
 * Nothing here adds, moves or removes an opening; a plan stretch is an observation of a second drawing, never a fact of
 * the model.
 */
import type { Side } from './correct/execute.js'

export const PLAN_OPENINGS_VERSION = '1.0.0' as const
export type Stretch = { u0: number; u1: number }
/** Two stretches are one opening when they share this much of the longer of them. */
export const STRETCH_AGREE = 0.4
/** An assignment of elevations to sides is taken on the plan's word when it beats the next by this many matched openings (net). */
export const SIDE_MARGIN = 1.5

/** How well the openings a plan draws on a side and the openings an elevation draws agree: matched, less half of each side's unmatched. */
export function stretchAgreement(plan: readonly Stretch[], drawn: readonly Stretch[]): { matched: number; score: number } {
  const free = [...plan]
  let matched = 0
  for (const d of [...drawn].sort((a, b) => a.u0 - b.u0)) {
    const best = free.map((p, i) => ({ i, share: (Math.min(d.u1, p.u1) - Math.max(d.u0, p.u0)) / Math.max(d.u1 - d.u0, p.u1 - p.u0, 1e-6) })).sort((a, b) => b.share - a.share)[0]
    if (best && best.share >= STRETCH_AGREE) {
      matched += 1
      free.splice(best.i, 1)
    }
  }
  return { matched, score: matched - 0.5 * (drawn.length - matched) - 0.5 * (plan.length - matched) }
}

const ORDER: Side[] = ['FRONT', 'RIGHT', 'REAR', 'LEFT']
/**
 * The model side a side of the PLAN SHEET is, for a body whose front is the sheet's `planFront` side (absent: the foot).
 * A rigid turn: the sides keep their order round the house.
 */
export function planSideInModel(planSide: Side, planFront: Side = 'FRONT'): Side {
  return ORDER[(ORDER.indexOf(planSide) - ORDER.indexOf(planFront) + 4) % 4]
}

/** The ground-storey openings of an elevation sketch as stretches between its wall ends (frame pixels in, 0..1 out). */
export function drawnStretches(sketch: { groundRow?: number | null; walls: ReadonlyArray<{ polygon: ReadonlyArray<readonly [number, number]> }>; openings: ReadonlyArray<{ polygon: ReadonlyArray<readonly [number, number]> }> }): Stretch[] {
  const pts = sketch.walls.flatMap((w) => w.polygon)
  if (pts.length === 0 || typeof sketch.groundRow !== 'number') return []
  const [x0, x1] = [Math.min(...pts.map((q) => q[0])), Math.max(...pts.map((q) => q[0]))]
  const ground = sketch.groundRow
  // the wall's own height at its ends (a gable's apex is not a storey): the lower of the two end corners' tops
  const near = Math.max(2, 0.03 * (x1 - x0))
  const endTop = (cx: number): number => Math.min(...pts.filter((q) => Math.abs(q[0] - cx) <= near && q[1] < ground - 2).map((q) => q[1]), ground)
  const wallTop = Math.max(endTop(x0), endTop(x1))
  const storey = Math.max(1, ground - wallTop)
  return sketch.openings.flatMap((o) => {
    const xs = o.polygon.map((q) => q[0])
    const ys = o.polygon.map((q) => q[1])
    const mid = (Math.min(...ys) + Math.max(...ys)) / 2
    // the plan is the lowest storey's: an opening whose middle stands above the drawn wall's end height is not on it
    if (ground - mid > storey) return []
    return [{ u0: Math.max(0, (Math.min(...xs) - x0) / (x1 - x0)), u1: Math.min(1, (Math.max(...xs) - x0) / (x1 - x0)) }]
  }).filter((s) => s.u1 - s.u0 > 0.005)
}
