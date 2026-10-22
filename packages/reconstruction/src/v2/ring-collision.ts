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

export type RingCollisionDiagnostic = {
  ringId: string
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
}): RingCollisionDiagnostic[] {
  const T = input.houseWallThicknessM
  const out: RingCollisionDiagnostic[] = []
  for (const f of input.failures) {
    if (!f.codes.includes('WALLS_OVERLAP')) continue
    const m = OVERLAP.exec(f.message)
    const walls = m ? [m[1], m[2]] : f.objectIds
    const owner = ringOwner(f.id ?? walls[0] ?? '', input.masses) ?? (walls[0] ? ringOwner(walls[0], input.masses) : undefined)
    // only a ring refused for its OWN walls: both named walls belong to it
    if (!owner || !walls.every((w) => w.startsWith(`${owner.ringId}-`) || w === owner.ringId)) continue
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
            : Math.min(w, d) >= 2 * T - 1e-6
              ? `as read it is ${Math.min(w, d).toFixed(2)} m across, not narrower than two ${T.toFixed(2)} m walls: it was not thin when the pass ran`
              : 'not recorded'
    const repairs = input.history.filter((h) => h.record.wallId === ringId || h.record.wallId.startsWith(`${ringId}-`))
    const changedGeometry = repairs.some((h) => h.record.action === 'EDGE_MOVED' || h.record.action === 'RING_OPENED')
    const removed = input.skipped.filter((s) => s.id !== undefined && (s.id === ringId || s.id.startsWith(`${ringId}-`) || s.id === `slab-${mass.id}-${storey}` || s.id === `roof-${mass.id}`)).map((s) => s.id as string)
    const fw = rec?.profile?.farWall
    const why = [
      rec ? `the thin-body pass read ${mass.id} and decided ${rec.decision.kind}${rec.decision.kind === 'KEEP_PARTIAL' ? ` (${rec.decision.why})` : ''}` : `the thin-body pass did not read ${mass.id}: ${notSelectedBecause}`,
      changedGeometry ? `the wall reconciliation changed the ring before it was refused (${repairs.map((h) => `${h.record.action.toLowerCase()} ${h.record.moveM.toFixed(2)} m`).join(', ')})` : 'the wall reconciliation did not change the ring',
      removed.length > 0 ? `the partial preview left out ${removed.length} object${removed.length === 1 ? '' : 's'} of the body` : 'the partial preview did not leave the body out',
    ].join('; ')
    out.push({
      ringId,
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
      removedByPartialPreview: removed.length > 0,
      removedIds: removed,
      why,
    })
  }
  return out
}
