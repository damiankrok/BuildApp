/**
 * N7-FIX-01: one record per ring the model refused for its own walls overlapping (`WALLS_OVERLAP` between w1 and w3,
 * or w0 and w2), saying everything the run knew about that body on the way there: whether the thin-body pass looked at
 * it and why not, its rectangle and the thickness its ring was built at, the plan's ink on its far face before and
 * after openings are read, every reading and the decision, whether the wall reconciliation moved the ring before the
 * refusal, and whether the partial preview took the body out. The refusal is where the run stopped; this is the way to
 * the reading that made it. Pure: the run's own records in, a record out. Nothing here changes the model.
 */
import { round6 } from '@buildapp/source-common'
import type { PreviewFailure, PreviewSkipped, WallReconciliationRecord } from '../candidate.js'
import type { MassV2 } from './building.js'
import { rectAt } from './building.js'
import type { ThinBodyRecord } from './thin-body.js'
import type { PreEmitRingCheck } from './pre-emit.js'

export type RingCollisionDiagnostic = {
  ringId: string
  /**
   * OWN_WALLS: the ring's own walls overlap (it is narrower than two of them). BETWEEN_BODIES (N7-COUNCIL-FIX-02): it
   * overlaps another body's wall and the reconciliation refused to narrow it below its own walls to make room.
   */
  kind: 'OWN_WALLS' | 'BETWEEN_BODIES'
  /** BETWEEN_BODIES: the edge move refused, with the ring's width before, the width it would have had, and its walls' minimum. */
  narrowing?: { beforeM: number; afterM: number; minM: number; otherWallId: string }
  commandIndex: number
  /** The two walls the model named, and the area it measured them sharing. */
  walls: string[]
  overlapM2?: number
  massId?: string
  storeyIndex?: number
  /** Whether `thinBodies` handed this body to the adjudication, and when not, why not. */
  selectedByThinBodies: boolean
  notSelectedBecause?: string
  rectM?: { x0: number; z0: number; x1: number; z1: number }
  widthM?: number
  lengthM?: number
  /** The thickness the ring was built at, and the house's. */
  wallThicknessM?: number
  houseWallThicknessM: number
  /** The plan's ink on the body's far face: the band test's share (before openings) and the masonry share read along the face (after). */
  farFaceInk?: { beforeOpenings: number; afterOpenings?: number; openings?: number; wallWithOpenings?: boolean; why?: string }
  hypotheses: ThinBodyRecord['hypotheses']
  decision?: { kind: ThinBodyRecord['decision']['kind']; why: string }
  firstBad?: string
  refusal: string
  /** Whether the wall reconciliation moved or opened this ring before (or instead of) the refusal. */
  reconciliation: { changedGeometry: boolean; records: Array<{ attempt: number; action: string; moveM: number; why: string }> }
  /** N7-COUNCIL-FIX-02: what the check before emission took this ring's rectangle for, when it was not simply wide enough. */
  preEmit?: { kind: PreEmitRingCheck['kind']; verdict: PreEmitRingCheck['verdict']; why: string }
  /** Whether the partial preview left the body out, and what of it. */
  removedByPartialPreview: boolean
  removedIds: string[]
  why: string
}

const OVERLAP = /walls (\S+) and (\S+) share ([0-9.]+) m²/

/** The body and storey a ring or ring-wall id names: `ring-<massId>-<storey>[-w<k>]`. */
export function ringOwner(id: string, masses: readonly MassV2[]): { mass: MassV2; storey: number; ringId: string } | undefined {
  for (const m of [...masses].sort((a, b) => b.id.length - a.id.length)) {
    const prefix = `ring-${m.id}-`
    if (!id.startsWith(prefix)) continue
    const rest = /^(\d+)(?:-w\d)?$/.exec(id.slice(prefix.length))
    if (rest) return { mass: m, storey: Number(rest[1]), ringId: `${prefix}${rest[1]}` }
  }
  return undefined
}

export function ringCollisions(input: {
  failures: readonly PreviewFailure[]
  skipped: readonly PreviewSkipped[]
  history: ReadonlyArray<{ attempt: number; record: WallReconciliationRecord }>
  /** The bodies as emitted (after the thin-body decisions), and the bodies the thin-body pass was given. */
  masses: readonly MassV2[]
  thin: readonly ThinBodyRecord[]
  houseWallThicknessM: number
  preEmit?: readonly PreEmitRingCheck[]
}): RingCollisionDiagnostic[] {
  const T = input.houseWallThicknessM
  const out: RingCollisionDiagnostic[] = []
  for (const f of input.failures) {
    if (!f.codes.includes('WALLS_OVERLAP')) continue
    const m = OVERLAP.exec(f.message)
    const walls = m ? [m[1], m[2]] : f.objectIds
    const owner = ringOwner(f.id ?? walls[0] ?? '', input.masses) ?? (walls[0] ? ringOwner(walls[0], input.masses) : undefined)
    if (!owner) continue
    const own = walls.every((w) => w.startsWith(`${owner.ringId}-`) || w === owner.ringId)
    // N7-COUNCIL-FIX-02: a ring refused against another body's wall is recorded when the reconciliation refused to
    // narrow it below its own two walls (Council D-1) — the collision it left unresolved, with the numbers
    const narrowed = own ? undefined : input.history.find((h) => h.record.narrowing && (h.record.wallId === owner.ringId || h.record.wallId.startsWith(`${owner.ringId}-`)))
    if (!own && !narrowed) continue
    const { mass, storey, ringId } = owner
    const r = rectAt(mass, storey)
    const w = round6(r.x1 - r.x0)
    const d = round6(r.z1 - r.z0)
    const t = mass.wallThicknessM ?? T
    const rec = input.thin.find((x) => x.massId === mass.id)
    const notSelectedBecause = rec
      ? undefined
      : mass.role !== 'ATTACHED'
        ? `it is the ${mass.role.toLowerCase()} body: the thin-body pass reads attached bodies only`
        : mass.pieceOf
          ? `it is a piece of ${mass.pieceOf}: the thin-body pass does not read pieces`
          : mass.storeyRects?.length
            ? 'it has storey rectangles of its own: the thin-body pass does not read them'
            : Math.min(w, d) >= 2 * t - 1e-6
              ? `as read it is ${Math.min(w, d).toFixed(2)} m across, not narrower than two ${t.toFixed(2)} m walls: it was not thin when the pass ran`
              : 'not recorded'
    const repairs = input.history.filter((h) => h.record.wallId === ringId || h.record.wallId.startsWith(`${ringId}-`))
    const changedGeometry = repairs.some((h) => h.record.action === 'EDGE_MOVED' || h.record.action === 'RING_OPENED')
    const removed = input.skipped.filter((s) => s.id !== undefined && (s.id === ringId || s.id.startsWith(`${ringId}-`) || s.id === `slab-${mass.id}-${storey}` || s.id === `roof-${mass.id}`)).map((s) => s.id as string)
    const fw = rec?.profile?.farWall
    const n = narrowed?.record.narrowing
    const why = [
      ...(narrowed && n ? [`the ring would have had to narrow from ${n.beforeM.toFixed(2)} m to ${n.afterM.toFixed(2)} m to clear ${narrowed.record.otherWallId}, below the ${n.minM.toFixed(2)} m its own walls need: not done, and the collision is left unresolved`] : []),
      rec ? `the thin-body pass read ${mass.id} and decided ${rec.decision.kind}${rec.decision.kind === 'KEEP_PARTIAL' ? ` (${rec.decision.why})` : ''}` : `the thin-body pass did not read ${mass.id}: ${notSelectedBecause}`,
      changedGeometry ? `the wall reconciliation changed the ring before it was refused (${repairs.map((h) => `${h.record.action.toLowerCase()} ${h.record.moveM.toFixed(2)} m`).join(', ')})` : 'the wall reconciliation did not change the ring',
      removed.length > 0 ? `the partial preview left out ${removed.length} object${removed.length === 1 ? '' : 's'} of the body` : 'the partial preview did not leave the body out',
    ].join('; ')
    const pre = input.preEmit?.find((c) => c.massId === mass.id && c.storeyIndex === storey)
    out.push({
      ringId,
      kind: own ? 'OWN_WALLS' : 'BETWEEN_BODIES',
      ...(narrowed && n ? { narrowing: { ...n, otherWallId: narrowed.record.otherWallId } } : {}),
      commandIndex: f.commandIndex,
      walls,
      ...(m ? { overlapM2: Number(m[3]) } : {}),
      massId: mass.id,
      storeyIndex: storey,
      selectedByThinBodies: !!rec,
      ...(notSelectedBecause ? { notSelectedBecause } : {}),
      rectM: { x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z1 },
      widthM: Math.min(w, d),
      lengthM: Math.max(w, d),
      wallThicknessM: round6(t),
      houseWallThicknessM: round6(T),
      ...(rec?.profile ? { farFaceInk: { beforeOpenings: rec.profile.farEdgeInk, ...(fw ? { afterOpenings: fw.pieceShare, openings: fw.gaps.length, wallWithOpenings: fw.holds, why: fw.why } : {}) } } : {}),
      hypotheses: rec?.hypotheses ?? [],
      ...(rec ? { decision: { kind: rec.decision.kind, why: rec.decision.why }, firstBad: rec.firstBad } : {}),
      refusal: f.message,
      reconciliation: { changedGeometry, records: repairs.map((h) => ({ attempt: h.attempt, action: h.record.action, moveM: h.record.moveM, why: h.record.why })) },
      ...(pre ? { preEmit: { kind: pre.kind, verdict: pre.verdict, why: pre.why } } : {}),
      removedByPartialPreview: removed.length > 0,
      removedIds: removed,
      why,
    })
  }
  return out
}
