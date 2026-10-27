/**
 * N7-COUNCIL-FIX-02 (Council D-2/C-4/B-3): every rectangle the emitter is about to build a ring on, checked against
 * the walls it will be built with — before the emitter writes it, at the place the emitter actually reads it from.
 *
 * The thin-body pass (`thinBodies`) reads attached bodies, measured on their own rectangle. The emitter also builds the
 * main body, every storey of a body that has a footprint of its own on that storey (`storeyRects`) and every piece of
 * one (`pieceOf`), each through `rectAt`; a storey rectangle or a piece narrower than two of its walls reached the
 * validator without a reading of what it is, and the partial preview then took the whole body with it. Here each of
 * them is measured with the thickness the ring will have (`tOf`) and given one verdict:
 *
 *   HOLDS_TWO_WALLS        wide enough for its own two walls: a body with full walls
 *   SHARED_WALL            built without its wall on the shared side, and wide enough for the one it keeps
 *   THIN_WALLS             the source draws thin walls (or one solid wall) there, and it is built with them
 *   PORTICO                the plan draws posts or an intermittent far face: an open structure, not a ring
 *   SOURCE_CONFLICT        printed and drawn disagree about its width
 *   INSUFFICIENT_EVIDENCE  narrower than its walls and nothing in the source decides what it is
 *
 * Pure: bodies in, records out. The emitter is not told to build less; what cannot hold its walls is named here and
 * left to the partial preview, which now keeps the storeys below it (`cutFailedObject`).
 */
import { round6 } from '@buildapp/source-common'
import type { MassV2 } from './building.js'
import { rectAt } from './building.js'
import type { ThinBodyRecord } from './thin-body.js'

export type PreEmitVerdict = 'HOLDS_TWO_WALLS' | 'SHARED_WALL' | 'THIN_WALLS' | 'PORTICO' | 'SOURCE_CONFLICT' | 'INSUFFICIENT_EVIDENCE'

export type PreEmitRingCheck = {
  massId: string
  storeyIndex: number
  /** What the emitter builds the ring from: the body's rectangle, its own storey rectangle, or a piece of a storey. */
  kind: 'MAIN' | 'BODY' | 'STOREY_RECT' | 'PIECE'
  rectM: { x0: number; z0: number; x1: number; z1: number }
  widthM: number
  lengthM: number
  wallThicknessM: number
  verdict: PreEmitVerdict
  /** Whether the validator will refuse this ring for its own walls overlapping. */
  ringWouldOverlap: boolean
  why: string
}

const SIDES_ACROSS: Record<'X' | 'Z', ReadonlyArray<NonNullable<MassV2['openSide']>>> = { X: ['WEST', 'EAST'], Z: ['FRONT', 'REAR'] }

export function preEmitRingChecks(masses: readonly MassV2[], houseWallThicknessM: number, thin: readonly ThinBodyRecord[]): PreEmitRingCheck[] {
  const out: PreEmitRingCheck[] = []
  for (const m of masses) {
    const t = m.wallThicknessM ?? houseWallThicknessM
    for (const s of m.storeys) {
      const r = rectAt(m, s)
      const w = round6(r.x1 - r.x0)
      const d = round6(r.z1 - r.z0)
      const narrowAxis: 'X' | 'Z' = w <= d ? 'X' : 'Z'
      const width = Math.min(w, d)
      const own = m.storeyRects?.some((x) => x.storey === s) ?? false
      const kind: PreEmitRingCheck['kind'] = m.role === 'MAIN' ? 'MAIN' : m.pieceOf ? 'PIECE' : own ? 'STOREY_RECT' : 'BODY'
      const base = { massId: m.id, storeyIndex: s, kind, rectM: { x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z1 }, widthM: width, lengthM: Math.max(w, d), wallThicknessM: round6(t) }
      const rec = thin.find((x) => x.massId === m.id)
      if (width >= 2 * t - 1e-6) {
        out.push({ ...base, verdict: rec?.decision.kind === 'DRAWN_THIN_WALLS' ? 'THIN_WALLS' : 'HOLDS_TWO_WALLS', ringWouldOverlap: false, why: rec?.decision.kind === 'DRAWN_THIN_WALLS' ? `built with the ${t.toFixed(2)} m walls the plan draws: ${rec.decision.why}` : `${width.toFixed(2)} m across holds two ${t.toFixed(2)} m walls` })
        continue
      }
      // one wall across the narrow axis: the other side is the neighbour's wall
      if (m.openSide && SIDES_ACROSS[narrowAxis].includes(m.openSide)) {
        const fits = width >= t - 1e-6
        out.push({ ...base, verdict: fits ? 'SHARED_WALL' : 'INSUFFICIENT_EVIDENCE', ringWouldOverlap: !fits, why: fits ? `built without its ${m.openSide.toLowerCase()} wall, which the plan draws once for both bodies; ${width.toFixed(2)} m holds the one ${t.toFixed(2)} m wall it keeps` : `${width.toFixed(2)} m across does not hold even the one ${t.toFixed(2)} m wall it keeps` })
        continue
      }
      if (rec && kind === 'BODY') {
        const hyp = (k: string) => rec.hypotheses.some((h) => h.kind === k && h.status === 'SUPPORTED')
        const verdict: PreEmitVerdict = rec.firstBad.startsWith('SOURCE_CONFLICT') ? 'SOURCE_CONFLICT' : rec.decision.kind === 'SOLID_WALL' ? 'THIN_WALLS' : hyp('CANOPY_ON_POSTS') ? 'PORTICO' : 'INSUFFICIENT_EVIDENCE'
        out.push({ ...base, verdict, ringWouldOverlap: rec.decision.kind !== 'SOLID_WALL', why: `${width.toFixed(2)} m across, narrower than two ${t.toFixed(2)} m walls; the thin-body pass decided ${rec.decision.kind}: ${rec.decision.why}` })
        continue
      }
      const unread = kind === 'MAIN' ? 'the main body is not read by the thin-body pass' : kind === 'PIECE' ? `a piece of ${m.pieceOf}'s storey ${s}: the thin-body pass does not read pieces` : kind === 'STOREY_RECT' ? `storey ${s}'s own rectangle over ${m.id}: the thin-body pass reads a body on its own rectangle only` : 'the thin-body pass did not read it'
      out.push({ ...base, verdict: 'INSUFFICIENT_EVIDENCE', ringWouldOverlap: true, why: `${width.toFixed(2)} m across, narrower than two ${t.toFixed(2)} m walls (${(2 * t).toFixed(2)} m), and nothing in the source says what it is: ${unread}. Its ring cannot stand; the storeys of ${m.id} below it are kept` })
    }
  }
  return out
}
