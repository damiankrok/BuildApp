/**
 * v3.51 C1b: the first consumer of a section's own vertical dimensions — the GROUND storey's clear height.
 *
 * A published section dimensions each storey from its finished floor up to the underside of the slab over it (Marcówki:
 * 272 from ±0,00, under the +3,06 floor). That one relation fixes two model parameters the levels alone cannot: the
 * height of the storey's walls under the slab, and the band from that underside to the finished floor above (slab plus
 * floor build-up). Until now the band came from an assumed 2.72 m clear height — a convention that happened to be the
 * first reference house's printed value.
 *
 * The relation is bound by geometry, never by the reader's name or prose:
 *  - the dimension is a vertical segment on the section frame whose span at the section's own level-ladder scale equals
 *    its printed value (a chain or label reading whose line is not the dimension fails this — wrong line);
 *  - its lower end stands on the row of a printed storey floor k (the host); its upper end below the printed floor k+1;
 *  - the band floor(k+1) − (floor(k) + H) is a physically possible slab-and-floor thickness (BAND_MIN_M..BAND_MAX_M).
 * Without a printed floor above there is no band: a single storey's clear height is not a slab thickness, and an eaves
 * mark is not a floor. Two readings for the same storey that disagree are named as alternatives and neither is applied.
 *
 * Only the relation is decided here; the caller applies it and records it.
 */
import type { MetricEvidence, MetricEvidenceSet } from '@buildapp/source-metrics'
import type { LevelBasis } from '../solve.js'

export const BAND_MIN_M = 0.15
export const BAND_MAX_M = 0.5
/** The row tolerance of an end on a datum's row: this many pixels, or 5 cm at the ladder's scale, whichever is larger. */
export const END_ROW_PX = 4
export const END_ROW_M = 0.05
/** Two readings for one storey closer than this are one statement. */
export const SAME_READING_M = 0.02

export type ClearHeightRejection =
  /** not a vertical segment on the section frame */
  | 'NOT_A_VERTICAL_SEGMENT'
  /** its span at the ladder's scale is not its printed value: the line read is not this dimension's */
  | 'SPAN_DISAGREES_WITH_VALUE'
  /** its lower end stands on no printed storey floor */
  | 'NOT_ON_A_FLOOR'
  /** the storey it stands on has no printed floor above it (a single storey, or the top storey) */
  | 'NO_PRINTED_FLOOR_ABOVE'
  /** the band to the floor above is not a slab and its floor */
  | 'BAND_NOT_PHYSICAL'
  /** another reading for the same storey disagrees with it */
  | 'CONFLICTS_WITH_ANOTHER_READING'

export type ClearHeightCandidate = { evidenceId: string; valueM: number; bottomRow: number; topRow: number; x: number }
export type ClearHeightOutcome = { candidate: ClearHeightCandidate; storeyIndex?: number; bandM?: number; rejected?: ClearHeightRejection }

export type GroundClearHeight = {
  /** the floor index (in `floors`) the relation stands on: the ground floor */
  floorIndex: number
  clearHeightM: number
  /** the slab-and-floor band from the underside to the finished floor above, derived from two printed facts */
  bandM: number
  evidenceId: string
  ladderMetresPerPx: number
}

export type ClearHeightDecision = {
  accepted?: GroundClearHeight
  outcomes: ClearHeightOutcome[]
  /** NONE: no admissible reading; AMBIGUOUS: admissible readings disagree (named, none applied) */
  status: 'ACCEPTED' | 'AMBIGUOUS' | 'NONE'
}

type Datum = { value: number; row: number }

/** The section's ladder (elevation = a − row·mpp), least squares through its placed printed datums. */
export function sectionLadder(datums: readonly Datum[]): { mpp: number; rowOf: (elevation: number) => number } | undefined {
  if (datums.length < 2) return undefined
  const n = datums.length
  const mr = datums.reduce((s, d) => s + d.row, 0) / n
  const mv = datums.reduce((s, d) => s + d.value, 0) / n
  const sxx = datums.reduce((s, d) => s + (d.row - mr) ** 2, 0)
  if (sxx < 1e-9) return undefined
  const slope = datums.reduce((s, d) => s + (d.row - mr) * (d.value - mv), 0) / sxx
  // rows grow downwards and elevations upwards: a ladder slopes negative
  if (!(slope < 0)) return undefined
  const mpp = -slope
  return { mpp, rowOf: (elevation: number) => mr - (elevation - mv) / mpp }
}

export function decideGroundClearHeight(input: {
  metrics: MetricEvidenceSet
  sectionFrameId: string | undefined
  floors: readonly number[]
  floorBasis: readonly LevelBasis[]
  /** index of ±0,00 in floors */
  groundAt: number
}): ClearHeightDecision {
  const none: ClearHeightDecision = { outcomes: [], status: 'NONE' }
  if (!input.sectionFrameId) return none
  const onFrame = input.metrics.evidence.filter((e) => e.frameId === input.sectionFrameId)
  const placed = onFrame
    .filter((e): e is MetricEvidence & { measuredGeometry: { type: 'SEGMENT'; a: { x: number; y: number }; b: { x: number; y: number } } } => e.kind === 'LEVEL_DATUM' && e.association.kind !== 'UNATTACHED' && e.measuredGeometry?.type === 'SEGMENT')
    .map((e) => ({ value: e.value, row: (e.measuredGeometry.a.y + e.measuredGeometry.b.y) / 2 }))
  const ladder = sectionLadder(placed)
  const dims = onFrame.filter((e) => e.kind === 'LINEAR_DIMENSION')
  if (!ladder || dims.length === 0) return none
  const tolRows = Math.max(END_ROW_PX, END_ROW_M / ladder.mpp)
  const k = input.groundAt
  const printedFloor = (i: number): boolean => i >= 0 && i < input.floors.length && input.floorBasis[i] !== 'CONVENTION'
  const outcomes: ClearHeightOutcome[] = []
  for (const e of dims) {
    const g = e.measuredGeometry
    const valueM = e.unit === 'cm' ? e.value / 100 : e.unit === 'mm' ? e.value / 1000 : e.value
    if (!g || g.type !== 'SEGMENT' || Math.abs(g.a.x - g.b.x) > 3 || Math.abs(g.a.y - g.b.y) < 2) {
      outcomes.push({ candidate: { evidenceId: e.id, valueM, bottomRow: NaN, topRow: NaN, x: NaN }, rejected: 'NOT_A_VERTICAL_SEGMENT' })
      continue
    }
    const candidate: ClearHeightCandidate = { evidenceId: e.id, valueM, bottomRow: Math.max(g.a.y, g.b.y), topRow: Math.min(g.a.y, g.b.y), x: (g.a.x + g.b.x) / 2 }
    const spanM = (candidate.bottomRow - candidate.topRow) * ladder.mpp
    if (Math.abs(spanM - valueM) > Math.max(END_ROW_M, 3 * ladder.mpp)) {
      outcomes.push({ candidate, rejected: 'SPAN_DISAGREES_WITH_VALUE' })
      continue
    }
    // the host: the printed storey floor whose row the lower end stands on
    const on = input.floors.findIndex((f, i) => printedFloor(i) && Math.abs(ladder.rowOf(f) - candidate.bottomRow) <= tolRows)
    if (on < 0) {
      outcomes.push({ candidate, rejected: 'NOT_ON_A_FLOOR' })
      continue
    }
    if (!printedFloor(on + 1)) {
      outcomes.push({ candidate, storeyIndex: on, rejected: 'NO_PRINTED_FLOOR_ABOVE' })
      continue
    }
    const bandM = input.floors[on + 1] - (input.floors[on] + valueM)
    if (bandM < BAND_MIN_M || bandM > BAND_MAX_M) {
      outcomes.push({ candidate, storeyIndex: on, bandM, rejected: 'BAND_NOT_PHYSICAL' })
      continue
    }
    outcomes.push({ candidate, storeyIndex: on, bandM })
  }
  const forGround = outcomes.filter((o) => !o.rejected && o.storeyIndex === k)
  if (forGround.length === 0) return { outcomes, status: 'NONE' }
  const values = forGround.map((o) => o.candidate.valueM)
  if (Math.max(...values) - Math.min(...values) > SAME_READING_M) {
    for (const o of forGround) o.rejected = 'CONFLICTS_WITH_ANOTHER_READING'
    return { outcomes, status: 'AMBIGUOUS' }
  }
  const pick = [...forGround].sort((a, b) => a.candidate.evidenceId.localeCompare(b.candidate.evidenceId))[0]
  return {
    outcomes,
    status: 'ACCEPTED',
    accepted: { floorIndex: k, clearHeightM: pick.candidate.valueM, bandM: Math.round((pick.bandM as number) * 1e6) / 1e6, evidenceId: pick.candidate.evidenceId, ladderMetresPerPx: ladder.mpp },
  }
}
