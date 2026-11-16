/**
 * v3.54.2 (pilot, off by default): a consultant's literal reading of ONE dimension label, as a third witness.
 *
 * The analyzer asks about a label it could not settle — a lattice in doubt, two readers that disagree, a decimal-metre
 * label its digit readers cannot read — and a consultant (the API, through the analysis service's consultation loop)
 * answers with what is PRINTED there. This module is the whole consumer of such an answer inside the metric layer:
 *
 * - It changes what the ink is READ AS (`readingOf`) and nothing else. The reading is SUPPORTED — one more reader is
 *   not a measurement — and CLEAR only where a second, independent reader of this run read the same literal with
 *   confidence (005H's AGREES standard: a corroborating recogniser reading, or a CLEAR/SUPPORTED lattice reading). The scale is still decided by the metric resolver from the arithmetic of the chains —
 *   a consulted value that no other chain agrees with settles nothing, and a wrong digit lands on a scale nothing else
 *   supports. Confidence of the consultant, or its agreement with itself, is never counted.
 * - The reading the ink had before stays a full-strength candidate (`rival`) when it has the same digit count, so a
 *   consulted value never removes the alternative it replaced; the chains choose between them as for any rival.
 * - The value is parsed by the analyzer's own parser (`dimensionValueOf`): a literal it cannot read as a length is
 *   refused, not interpreted. The consultant's own number is never taken.
 * - A consultation names the label by its lattice id on its frame; an id the run does not hold is refused (STALE_TARGET).
 *
 * Absent (the default and all the product runs), the reading is byte for byte what it was.
 */
import type { EnsembledLattice, LabelEnsemble } from './ensemble.js'
import { dimensionValueOf } from './numeric-lattice.js'

export const CONSULTED_READING_NAME = 'metrics.consulted-reading' as const
export const CONSULTED_READING_VERSION = '0.1.0' as const

/** One consultant reading of one label. `literal` is the printed text as read: digits and a decimal separator only. */
export type ConsultedReading = {
  proposalId: string
  frameId: string
  latticeId: string
  literal: string
  /** Who read it: an engine id, the model, and the provider's request id. Recorded, never weighed. */
  consultant: { engine: string; model: string; requestId?: string }
}

export type ConsultedOutcome = { proposalId: string; frameId: string; latticeId: string; status: 'APPLIED' | 'REFUSED'; why: string; valueCm?: number; prior?: string }

const digitsOf = (text: string): string => text.replace(/[^0-9]/g, '')
const LITERAL = /^[0-9]{1,5}([.,][0-9]{1,3})?$/

/** The ensemble a consulted reading makes of one lattice. Pure: the lattice (with whatever witnesses it had) and the reading in. */
export function consultedOf(lattice: EnsembledLattice, reading: ConsultedReading): { ensemble: LabelEnsemble } | { refused: string } {
  const literal = reading.literal.trim()
  if (!LITERAL.test(literal)) return { refused: `"${reading.literal}" is not a printed length as this layer reads one (digits, at most one decimal separator)` }
  const valueCm = dimensionValueOf(literal)
  if (valueCm === undefined) return { refused: `"${literal}" states no length the analyzer's parser reads` }
  const base: LabelEnsemble = lattice.ensemble ?? {
    decision: 'NO_VALUE',
    external: { text: '', posterior: 0, meanP: 0, stable: false, confident: false },
    lattice: { asRead: lattice.asRead, ...(lattice.asReadValueCm !== undefined ? { valueCm: lattice.asReadValueCm } : {}), ocrClass: lattice.ocrClass },
    asRead: lattice.asRead,
    ...(lattice.asReadValueCm !== undefined ? { asReadValueCm: lattice.asReadValueCm } : {}),
    ocrClass: lattice.ocrClass,
    why: 'no external reader heard this label',
  }
  const prior = { text: base.asRead, valueCm: base.asReadValueCm }
  const witness: 'LATTICE' | 'EXTERNAL' = base.asRead === base.lattice.asRead ? 'LATTICE' : 'EXTERNAL'
  const sameCount = digitsOf(prior.text).length === digitsOf(literal).length
  // the reading it replaces stays a candidate at full strength (same count only: another count never contests a scale)
  const rival = prior.valueCm !== undefined && prior.valueCm !== valueCm && sameCount ? { rival: { text: prior.text, valueCm: prior.valueCm, witness } } : base.rival && base.rival.valueCm !== valueCm ? { rival: base.rival } : {}
  const agreesWith = [base.lattice.asRead, base.external.text].filter((t) => t !== '' && t === literal)
  // Two independent readers on one value is CLEAR, by the rule 005H gives the lattice and the recogniser (AGREES): the
  // consultant and a CORROBORATING external reading (confident, stable, its own answer), or a CLEAR/SUPPORTED lattice
  // reading, of the same literal. The consultant alone, or beside a reader in doubt, is one reader: SUPPORTED.
  const extCorroborates = base.external.confident && base.external.stable && lattice.external?.greedy.text === base.external.text
  const latticeConfident = base.lattice.ocrClass === 'CLEAR' || base.lattice.ocrClass === 'SUPPORTED'
  const second = (extCorroborates && base.external.text === literal) || (latticeConfident && base.lattice.asRead === literal)
  return {
    ensemble: {
      ...base,
      decision: 'CONSULTED',
      asRead: literal,
      asReadValueCm: valueCm,
      ocrClass: second ? 'CLEAR' : 'SUPPORTED',
      ...rival,
      consulted: { proposalId: reading.proposalId, literal, valueCm, engine: reading.consultant.engine, model: reading.consultant.model, ...(reading.consultant.requestId ? { requestId: reading.consultant.requestId } : {}), prior: { asRead: base.asRead, ocrClass: base.ocrClass, decision: base.decision } },
      why: `consulted (${reading.proposalId}): the label is printed ${literal}${agreesWith.length > 0 ? ` (as ${agreesWith.length === 2 ? 'both readers' : base.lattice.asRead === literal ? 'the lattice' : 'the external reader'} also read it${second ? ', with confidence: CLEAR' : ', without confidence'})` : ''}; before, it was read ${base.asRead || '(nothing)'} ${base.ocrClass} (${base.decision})${'rival' in rival && rival.rival ? `, and ${rival.rival.text} stays a candidate` : ''} — the chains decide the scale`,
    },
  }
}

/**
 * Applies a frame's consulted readings to its lattices (keyed by lattice id). Every reading is answered: APPLIED, or
 * REFUSED with why. A second reading of the same label in one run is refused (one consultant value per label).
 */
export function applyConsultedReadings<T extends { id: string; lattice: EnsembledLattice }>(frameId: string, held: Iterable<T>, readings: readonly ConsultedReading[]): { updated: Map<string, EnsembledLattice>; outcomes: ConsultedOutcome[] } {
  const mine = readings.filter((r) => r.frameId === frameId)
  const byId = new Map<string, T>()
  for (const h of held) byId.set(h.id, h)
  const updated = new Map<string, EnsembledLattice>()
  const outcomes: ConsultedOutcome[] = []
  for (const r of mine) {
    const h = byId.get(r.latticeId)
    if (!h) {
      outcomes.push({ proposalId: r.proposalId, frameId, latticeId: r.latticeId, status: 'REFUSED', why: 'STALE_TARGET: this run holds no label of that id on that frame' })
      continue
    }
    if (updated.has(r.latticeId)) {
      outcomes.push({ proposalId: r.proposalId, frameId, latticeId: r.latticeId, status: 'REFUSED', why: 'DUPLICATE_TARGET: the label already has a consulted reading in this run' })
      continue
    }
    const made = consultedOf(h.lattice, r)
    if ('refused' in made) {
      outcomes.push({ proposalId: r.proposalId, frameId, latticeId: r.latticeId, status: 'REFUSED', why: `UNPARSEABLE: ${made.refused}` })
      continue
    }
    updated.set(r.latticeId, { ...h.lattice, ensemble: made.ensemble })
    outcomes.push({ proposalId: r.proposalId, frameId, latticeId: r.latticeId, status: 'APPLIED', why: made.ensemble.why, valueCm: made.ensemble.asReadValueCm, prior: made.ensemble.consulted?.prior.asRead })
  }
  return { updated, outcomes }
}
