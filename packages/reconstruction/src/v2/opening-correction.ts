/**
 * v3.51 C2: ONE admission policy for a later correction of an opening's sill or head.
 *
 * Two passes propose such corrections from the registered views — the facade alignment (`facade-alignment.ts`) and the
 * residual repair (`verify.ts`). They used to hold different rights: the repair refused to lift a door off its floor,
 * the alignment did not; the repair clamped a sill to the building's ±0,00, the alignment to the storey's floor. The
 * same proposal for the same opening must meet the same answer whoever makes it, so both ask here.
 *
 * What is decided: whether the proposed value may REPLACE the accepted one. The proposal's own reading stays what it
 * was (the caller records it); a refusal names its reason by code, not by sentence.
 */
import type { ProvenanceStatus } from './graph.js'

export type OpeningHeightProperty = 'sill' | 'head'

export type CorrectionRefusal =
  /** the accepted value is printed or corroborated: a view's reading does not overrule it */
  | 'PRINTED_VALUE_STANDS'
  /** the accepted value already rests on a reading, not on a convention: a second reading is recorded, not applied */
  | 'ALREADY_READ'
  /** the opening's height is printed: its sill does not move alone */
  | 'PRINTED_HEIGHT_STANDS'
  /** a door stands on its own access surface (its floor, landing or step): a sill read above it is something else */
  | 'DOOR_OFF_ITS_ACCESS'
  /** the proposal puts the sill below the opening's own floor */
  | 'BELOW_ITS_FLOOR'
  /** the proposal differs so far that it is another reading, not a correction */
  | 'DIFFERENT_READING'
  /** the corrected opening would not fit its wall (under 0.4 m tall, or above the wall's top) */
  | 'DOES_NOT_FIT_WALL'

export const DOOR_FAMILIES: ReadonlySet<string> = new Set(['DOOR', 'GLAZED_DOOR', 'GARAGE_DOOR'])
/** How far above its access surface a door's sill may be proposed before it is no longer the door's own threshold. */
export const DOOR_THRESHOLD_M = 0.05
export const MAX_CORRECTION_M = 1.2
export const MIN_OPENING_HEIGHT_M = 0.4
export const WALL_TOP_CLEARANCE_M = 0.05

export type CorrectionSubject = {
  family: string
  sillY: number
  headY: number
  provenance: { sill: ProvenanceStatus | string; head: ProvenanceStatus | string }
  /**
   * The surface the opening is reached from, in metres: its storey's floor — or, where the model knows one, the
   * landing, step or split-level floor it actually stands on. A door's sill refers to THIS, never to the building's
   * ±0,00.
   */
  accessY: number
  /** the top of the wall hosting it */
  wallTopY: number
}

const settled = (p: string): boolean => p === 'SOURCE_EXACT' || p === 'SOURCE_CORROBORATED'
const assumed = (p: string): boolean => p === 'ASSUMED_FOR_RENDERING' || p === 'UNRESOLVED'

export type CorrectionVerdict = { admitted: true } | { admitted: false; refusal: CorrectionRefusal }

/** The rules of one property on its own (authority, access surface, size of the change) — not yet the fit in the wall. */
function ruleOf(o: CorrectionSubject, property: OpeningHeightProperty, proposed: number): CorrectionVerdict {
  const current = property === 'sill' ? o.sillY : o.headY
  const prov = property === 'sill' ? o.provenance.sill : o.provenance.head
  if (settled(prov)) return { admitted: false, refusal: 'PRINTED_VALUE_STANDS' }
  if (!assumed(prov)) return { admitted: false, refusal: 'ALREADY_READ' }
  if (property === 'sill' && settled(o.provenance.head)) return { admitted: false, refusal: 'PRINTED_HEIGHT_STANDS' }
  if (property === 'sill' && DOOR_FAMILIES.has(o.family) && proposed > o.accessY + DOOR_THRESHOLD_M) return { admitted: false, refusal: 'DOOR_OFF_ITS_ACCESS' }
  if (property === 'sill' && proposed < o.accessY - DOOR_THRESHOLD_M) return { admitted: false, refusal: 'BELOW_ITS_FLOOR' }
  if (Math.abs(proposed - current) > MAX_CORRECTION_M) return { admitted: false, refusal: 'DIFFERENT_READING' }
  return { admitted: true }
}

/**
 * May the proposed sill and/or head replace the opening's accepted ones? The same answer for every caller. Each
 * property meets its own rules; what they leave must then fit the wall together, or none of it is applied.
 */
export function admitHeightCorrections(o: CorrectionSubject, proposals: { sill?: number; head?: number }): { sill?: CorrectionVerdict; head?: CorrectionVerdict } {
  const out: { sill?: CorrectionVerdict; head?: CorrectionVerdict } = {}
  if (proposals.sill !== undefined) out.sill = ruleOf(o, 'sill', proposals.sill)
  if (proposals.head !== undefined) out.head = ruleOf(o, 'head', proposals.head)
  const sill = out.sill?.admitted ? (proposals.sill as number) : o.sillY
  const head = out.head?.admitted ? (proposals.head as number) : o.headY
  if ((out.sill?.admitted || out.head?.admitted) && (head - sill < MIN_OPENING_HEIGHT_M || head > o.wallTopY - WALL_TOP_CLEARANCE_M)) {
    if (out.sill?.admitted) out.sill = { admitted: false, refusal: 'DOES_NOT_FIT_WALL' }
    if (out.head?.admitted) out.head = { admitted: false, refusal: 'DOES_NOT_FIT_WALL' }
  }
  return out
}

/** The sentence a refusal is reported with (for people; nothing reads it back). */
export function refusalSentence(refusal: CorrectionRefusal, o: CorrectionSubject, property: OpeningHeightProperty, proposed: number): string {
  const what = property === 'sill' ? 'sill' : 'head'
  switch (refusal) {
    case 'PRINTED_VALUE_STANDS':
      return `the ${what} is printed or corroborated, and a view reading ${proposed.toFixed(2)} m does not overrule it`
    case 'ALREADY_READ':
      return `the ${what} already comes from a reading; a second reading (${proposed.toFixed(2)} m) is recorded, not applied`
    case 'PRINTED_HEIGHT_STANDS':
      return `the height is printed (${(o.headY - o.sillY).toFixed(2)} m); a sill read at ${proposed.toFixed(2)} m would change it, so it is recorded, not applied`
    case 'DOOR_OFF_ITS_ACCESS':
      return `a ${o.family.toLowerCase().replace(/_/g, ' ')} stands on its own floor (${o.accessY.toFixed(2)} m); a sill read at ${proposed.toFixed(2)} m is recorded, not applied`
    case 'BELOW_ITS_FLOOR':
      return `a sill read at ${proposed.toFixed(2)} m is below the opening's own floor (${o.accessY.toFixed(2)} m): recorded, not applied`
    case 'DIFFERENT_READING':
      return `a ${Math.abs(proposed - (property === 'sill' ? o.sillY : o.headY)).toFixed(2)} m disagreement is not a correction, it is a different reading`
    case 'DOES_NOT_FIT_WALL':
      return `with its ${what} at ${proposed.toFixed(2)} m the opening would not fit its wall (top ${o.wallTopY.toFixed(2)} m): kept as the model has it`
  }
}
