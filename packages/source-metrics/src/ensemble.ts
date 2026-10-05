/**
 * The two-witness reading of a dimension label (BUILDPLAN-ANALYZER-005H, policy P2 of 005G's bake-off).
 *
 * A label is read twice, independently, from the same pixels: by the numeric lattice (the template reader with its
 * segmentation, count and stability hypotheses) and by an external recogniser (`recogniser.ts`). This module is the
 * one rule that says what the label is read as when both have spoken. It never sees a scale, a chain or a published
 * figure — only the two readings — and it never makes a value canonical: it decides which value the metric layer
 * READS the ink as, how sure that reading is, and which other value stays a full candidate. The metric resolver then
 * decides, as it did before, by the arithmetic of the chains.
 *
 * The external reading CORROBORATES only when its top value states a dimension, its beam posterior and its greedy
 * mean character probability are both at least `OCR_ENSEMBLE_BOUNDS`, it is stable — the same top value as cut, with
 * 2 px more paper, 1 px less, and at 90 %, read from the bracket's own records — and it is the model's OWN answer: the
 * greedy reading over the model's whole alphabet is exactly that digit string. (The beam is held to digits; a frame the
 * model read as `·`, `⁵` or `/` hands its mass to a digit there, so `2·5` comes out of the beam as `25` at p ≈ 1. A
 * digit string the model did not itself read is no reading of the label — red team D, 005H.) Then:
 *
 *   AGREES          with the lattice's reading: two independent readers on one value. CLEAR. (005G P1, the strict
 *                   ensemble: 336 confident readings of 775, none wrong.)
 *   LEADS           a lattice reading that was not CLEAR or SUPPORTED (or stated no dimension): the image's
 *                   corroborated reading is the one read, SUPPORTED, and the lattice's value — when it has the same
 *                   count — stays a full-strength candidate. (005G P2: 631 confident of 775 with 2 wrong, 88 of 103
 *                   real with none.)
 *
 * Whatever its confidence, an external reading that DISAGREES with a CLEAR or SUPPORTED lattice reading doubts it —
 * neither wins because it is external, and a reader that is sure is no reason to trust the other one (the custom
 * reader's own CLEAR/SUPPORTED readings were wrong 10 times in 44 on 005G's real labels):
 *
 *   CONTESTS        the same digit count: AMBIGUOUS, the lattice's value still the one read. The external value is a
 *                   full-strength candidate beside it only when it corroborates; an unconfident or unstable value is
 *                   doubt and nothing more — a value its own reader does not hold at 0.9 would widen what a scale may
 *                   find to fit.
 *   CONTESTS_COUNT  another digit count: AMBIGUOUS, the external value recorded and never a candidate — a value of
 *                   another count never contests a scale (005F), but it does doubt the reading.
 *
 * The two readings are compared as digit strings, so a reading that states no dimension (five digits, say) still
 * agrees or disagrees; a value is needed only to lead or to be offered as a candidate. Anything else — an external
 * reading that agrees without corroborating, or disagrees with a lattice reading that was already in doubt without
 * corroborating (NOT_CORROBORATING), or leads with no dimension (NO_VALUE) — is recorded, and nothing changes.
 *
 * A reading outside what the digit-constrained reading states — a lattice reading with a decimal separator (`4,50`),
 * or a model whose own answer is not a bare digit string (`2·5`, `12⁵`, `1.910`) — is compared by its digits and its
 * separators: anything that reads otherwise than a CLEAR or SUPPORTED lattice reading doubts it (CONTESTS /
 * CONTESTS_COUNT, never a candidate); the rest is NOT_COMPARABLE — recorded only. Such a reading never agrees as CLEAR
 * on its digits alone (a lattice `72,408` and a model's `72408` read two numbers) and never leads.
 *
 * Nothing else changes: no lattice value is removed, no bound of the lattice moves, and the external reader's other
 * top-K values are recorded, never offered (`correctionReadings`).
 */
import type { LabelLattice, OcrClass } from './numeric-lattice.js'
import { dimensionValueOf } from './numeric-lattice.js'
import { EXTERNAL_VARIANTS } from './recogniser.js'
import type { ExternalReading } from './recogniser.js'

export const OCR_ENSEMBLE_NAME = 'metrics.ocr-ensemble' as const
export const OCR_ENSEMBLE_VERSION = '1.0.0' as const

/** When an external reading is confident (005G's "confident", fixed before any confident-wrong figure existed). */
export const OCR_ENSEMBLE_BOUNDS = { posterior: 0.9, meanP: 0.9 } as const

export type EnsembleDecision = 'NO_VALUE' | 'NOT_COMPARABLE' | 'NOT_CORROBORATING' | 'AGREES' | 'CONTESTS' | 'CONTESTS_COUNT' | 'LEADS'

export type LabelEnsemble = {
  decision: EnsembleDecision
  /** The external reader's top value, what it states, and the three tests it had to pass. */
  external: { text: string; valueCm?: number; posterior: number; meanP: number; stable: boolean; confident: boolean }
  /** The lattice's own reading, unchanged. */
  lattice: { asRead: string; valueCm?: number; ocrClass: OcrClass }
  /** What the metric layer reads the ink as, and how sure that reading is. */
  asRead: string
  asReadValueCm?: number
  ocrClass: OcrClass
  /** The other witness's value when the two disagree with the same digit count: a candidate at full strength. */
  rival?: { text: string; valueCm: number; witness: 'EXTERNAL' | 'LATTICE' }
  why: string
}

/**
 * A label's lattice with what the external recogniser read on its crop and what this rule made of the two (absent
 * when no recogniser ran). The lattice module itself knows nothing of either: every lattice field stays its own reading.
 */
export type EnsembledLattice = LabelLattice & { external?: ExternalReading; ensemble?: LabelEnsemble }

const digitsOf = (text: string): string => text.replace(/[^0-9]/g, '')
const digitCount = (text: string): number => digitsOf(text).length
const hasSeparator = (text: string): boolean => /[,.]/.test(text)
/** A reading's digits and separators: any mark read as a decimal separator is one separator, anything else drops. */
const formOf = (text: string): string => text.replace(/[,.·，．、'’′]/g, ',').replace(/[^0-9,]/g, '')

/** The external reading's verdict on one lattice, by the P2 rule. Pure: the two readings in, the decision out. */
export function ensembleOf(lattice: Pick<LabelLattice, 'asRead' | 'asReadValueCm' | 'ocrClass'>, external: ExternalReading): LabelEnsemble {
  const top = external.topK[0]
  const text = top?.text ?? ''
  const posterior = top?.p ?? 0
  const meanP = external.greedy.meanP
  const own = external.greedy.text
  const valueCm = dimensionValueOf(text)
  const confident = posterior >= OCR_ENSEMBLE_BOUNDS.posterior && meanP >= OCR_ENSEMBLE_BOUNDS.meanP
  // stable by the bracket's own reads: every variant read, each with the same top value — not the recogniser's word
  const stable = external.stable && text !== '' && EXTERNAL_VARIANTS.every((v) => external.variants.some((x) => x.variant === v && x.top === text))
  // the model's own answer over its whole alphabet is this digit string (the beam alone may be a digit it never read)
  const heard = text !== '' && own === text
  const corroborating = confident && stable && heard
  const ext = { text, ...(valueCm !== undefined ? { valueCm } : {}), posterior, meanP, stable, confident }
  const mine = { asRead: lattice.asRead, ...(lattice.asReadValueCm !== undefined ? { valueCm: lattice.asReadValueCm } : {}), ocrClass: lattice.ocrClass }
  const unchanged = { lattice: mine, asRead: lattice.asRead, ...(lattice.asReadValueCm !== undefined ? { asReadValueCm: lattice.asReadValueCm } : {}), ocrClass: lattice.ocrClass }
  if (text === '' || digitsOf(own) === '') return { decision: 'NO_VALUE', external: ext, ...unchanged, why: `the external reader read no digit${own ? ` (it read ${own})` : ''}: recorded only` }
  const missing = (): string =>
    [
      posterior < OCR_ENSEMBLE_BOUNDS.posterior ? `posterior ${posterior} < ${OCR_ENSEMBLE_BOUNDS.posterior}` : '',
      meanP < OCR_ENSEMBLE_BOUNDS.meanP ? `mean character p ${meanP} < ${OCR_ENSEMBLE_BOUNDS.meanP}` : '',
      stable ? '' : 'its value moves under the stability bracket',
      heard ? '' : `its own reading is ${own}, not the digits ${text}`,
    ]
      .filter(Boolean)
      .join('; ')
  const said = `the external reader read ${heard ? text : `${own} (digits ${text})`} (p ${posterior}${corroborating ? ', stable' : `; ${missing()}`})`
  const latticeDigits = digitsOf(lattice.asRead)
  const latticeValued = lattice.asReadValueCm !== undefined
  const latticeConfident = (lattice.ocrClass === 'CLEAR' || lattice.ocrClass === 'SUPPORTED') && latticeDigits !== ''
  // Outside the digit-constrained comparison: a decimal lattice reading, or a model whose own answer is not bare digits.
  if (!heard || hasSeparator(lattice.asRead)) {
    // Agreement needs the same reading, separators included: a lattice that put a comma where the model saw none (or
    // the other way round) reads another number, however the digits line up — never CLEAR on the digits alone.
    if (latticeConfident && formOf(lattice.asRead) !== formOf(own)) {
      const sameCount = digitCount(own) === latticeDigits.length
      return { decision: sameCount ? 'CONTESTS' : 'CONTESTS_COUNT', external: ext, ...unchanged, ocrClass: 'AMBIGUOUS', why: `the lattice read ${lattice.asRead} (${lattice.ocrClass}) and ${said}: a reading outside the digit-constrained one is no candidate, but the reading is in doubt` }
    }
    return { decision: 'NOT_COMPARABLE', external: ext, ...unchanged, why: `${said}: outside what the digit-constrained reading states — recorded only` }
  }
  // The two readings are compared as what they read — digit strings — whether or not the string states a dimension.
  if (latticeDigits === text) {
    if (corroborating) return { decision: 'AGREES', external: ext, ...unchanged, ocrClass: 'CLEAR', why: `both readers read ${lattice.asRead}: the lattice ${lattice.ocrClass}, ${said}` }
    return { decision: 'NOT_CORROBORATING', external: ext, ...unchanged, why: `${said}: it agrees with the lattice without corroborating it — recorded only` }
  }
  if (latticeConfident) {
    if (digitCount(text) === latticeDigits.length) {
      const rival = corroborating && valueCm !== undefined && latticeValued ? { rival: { text, valueCm, witness: 'EXTERNAL' as const } } : {}
      return { decision: 'CONTESTS', external: ext, ...unchanged, ocrClass: 'AMBIGUOUS', ...rival, why: `the lattice read ${lattice.asRead} (${lattice.ocrClass}) and ${said}: neither wins because it is external — ${'rival' in rival ? 'both stay candidates' : 'the reading is in doubt'}` }
    }
    return { decision: 'CONTESTS_COUNT', external: ext, ...unchanged, ocrClass: 'AMBIGUOUS', why: `the lattice read ${lattice.asRead} (${lattice.ocrClass}) and ${said}, another digit count: the reading is in doubt, and a value of another count never contests a scale` }
  }
  if (valueCm === undefined) return { decision: 'NO_VALUE', external: ext, ...unchanged, why: `${said}, which states no dimension: recorded only` }
  if (!corroborating) return { decision: 'NOT_CORROBORATING', external: ext, ...unchanged, why: `the lattice read ${lattice.asRead || '(nothing)'} ${lattice.ocrClass}; ${said}: recorded only` }
  const rival = latticeValued && latticeDigits.length === text.length ? { text: lattice.asRead, valueCm: lattice.asReadValueCm as number, witness: 'LATTICE' as const } : undefined
  return {
    decision: 'LEADS',
    external: ext,
    lattice: mine,
    asRead: text,
    asReadValueCm: valueCm,
    ocrClass: 'SUPPORTED',
    ...(rival ? { rival } : {}),
    why: `the lattice read ${lattice.asRead || '(nothing)'} ${lattice.ocrClass}${latticeValued ? '' : ', no dimension'}; ${said}: ${text} is read${rival ? `, ${lattice.asRead} stays a candidate` : ''}`,
  }
}

/** What the metric layer reads an ink as: the ensemble's reading when an external witness was heard, the lattice's own otherwise. */
export function readingOf(lattice: EnsembledLattice): { asRead: string; valueCm?: number; ocrClass: OcrClass } {
  const e = lattice.ensemble
  if (!e) return { asRead: lattice.asRead, ...(lattice.asReadValueCm !== undefined ? { valueCm: lattice.asReadValueCm } : {}), ocrClass: lattice.ocrClass }
  return { asRead: e.asRead, ...(e.asReadValueCm !== undefined ? { valueCm: e.asReadValueCm } : {}), ocrClass: e.ocrClass }
}
