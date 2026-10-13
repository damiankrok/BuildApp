/**
 * Statement contests (BUILDPLAN-ANALYZER-005P, plan resolver 1.5.0).
 *
 * Plan resolution reads a printed dimension "as printed" through one reader: the classic template's token text (or the
 * READ value). The metric evidence also carries, for the same ink, the numeric lattice's own reading and the external
 * recogniser's (PP-OCRv6) reading with the ensemble rule's verdict on it. Those readers look at ONE crop: they are
 * estimators of one raster, never witnesses of one another, and nothing here counts their agreement as support.
 *
 * What this module states, for one statement, is only which values its CONFIDENT readers read:
 *
 *   AS_PRINTED  the value plan resolution reads as printed: for a CHAIN_CORRECTED statement the classic token's text
 *             when it is a dimension (/^[1-9]\d{1,4}$/); for a READ statement the evidence value. Upstream, the metric
 *             layer may already have taken that value from the lattice or the ensemble (a re-solved chain reads
 *             `readingOf`), so for READ it is "what the incumbent states", not necessarily the classic token
 *   LATTICE     the lattice on the same frame, box and orientation: its own reading, only when its OWN class (before
 *               the ensemble) is CLEAR or SUPPORTED
 *   EXTERNAL    that lattice's external reading, only when the frozen ensemble rule found it corroborating: AGREES,
 *               LEADS, or CONTESTS with the external reading as the named rival
 *
 * Two lattice records for the same frame, box and orientation (none exist in the development evidence) are joined as the
 * metric layer sealed them: the later record in the set's order wins, as in the research join it was validated against.
 *
 * A statement is CONTESTED when those values are not all the same. The contest is an observation about the reading;
 * it decides nothing. Plan resolution's consumers decide what a contest is allowed to do (`plan-resolution.ts`).
 * Pure: the evidence in, the record out; the same evidence gives the same record on every device.
 */
import type { MetricEvidence, MetricEvidenceSet, NumericLatticeRecord } from '@buildapp/source-metrics'

export const STATEMENT_CONTEST_VERSION = '1.0.0' as const

export type ConfidentReader = 'AS_PRINTED' | 'LATTICE' | 'EXTERNAL'

export type StatementContest = {
  /**
   * Each confident reader's value, in reader order; a reader that is absent or not confident is not listed. `cited`
   * (set by the source-conflict test only, plan resolver 1.5.0 N1a) marks a reading the frame's metric solution cites as
   * a witness of the registered scale: it may not vouch for that scale, so the conflict test sets it aside.
   */
  readings: Array<{ reader: ConfidentReader; valueCm: number; cited?: true }>
  /** The distinct confident values, ascending. */
  values: number[]
  /** Two or more distinct confident values. */
  contested: boolean
  /** The id of the lattice record joined to the ink, if any: the key a metric observation of the same ink carries. */
  latticeId?: string
}

type Token = MetricEvidenceSet['ocrTokens'][number]

const DIMENSION = /^[1-9]\d{1,4}$/
const dimensionOf = (text: string | undefined): number | undefined => (text !== undefined && DIMENSION.test(text) ? Number(text) : undefined)
const keyOf = (frameId: string, box: { x0: number; y0: number; x1: number; y1: number }, orientation: string | undefined): string => `${frameId}|${box.x0}|${box.x1}|${box.y0}|${box.y1}|${orientation ?? ''}`

/** The lattice's own reading, when its own class (not the ensemble's decision class) says it is confident. */
function latticeValue(lattice: NumericLatticeRecord): number | undefined {
  const own = lattice.ensemble?.lattice.ocrClass ?? lattice.ocrClass
  return own === 'CLEAR' || own === 'SUPPORTED' ? lattice.asReadValueCm : undefined
}

/** The external reading, when the frozen ensemble rule found it corroborating. */
function externalValue(lattice: NumericLatticeRecord): number | undefined {
  const e = lattice.ensemble
  if (!e) return undefined
  const value = e.external.valueCm ?? dimensionOf(e.external.text)
  if (e.decision === 'AGREES' || e.decision === 'LEADS') return value
  if (e.decision === 'CONTESTS' && e.rival?.witness === 'EXTERNAL') return value
  return undefined
}

/** A lookup from a statement's evidence (and its single token) to its contest record. */
export function statementContests(metrics: MetricEvidenceSet): (evidence: MetricEvidence, token: Token | undefined) => StatementContest {
  const lattices = new Map<string, NumericLatticeRecord>()
  for (const l of metrics.numericLattices ?? []) lattices.set(keyOf(l.frameId, l.box, l.orientation), l)
  return (evidence, token) => {
    const readings: StatementContest['readings'] = []
    const printed = evidence.origin === 'READ' ? evidence.value : dimensionOf(token?.text)
    if (printed !== undefined) readings.push({ reader: 'AS_PRINTED', valueCm: printed })
    const lattice = token ? lattices.get(keyOf(token.frameId, token.box, token.orientation)) : undefined
    const l = lattice ? latticeValue(lattice) : undefined
    if (l !== undefined) readings.push({ reader: 'LATTICE', valueCm: l })
    const x = lattice ? externalValue(lattice) : undefined
    if (x !== undefined) readings.push({ reader: 'EXTERNAL', valueCm: x })
    const values = [...new Set(readings.map((r) => r.valueCm))].sort((a, b) => a - b)
    return { readings, values, contested: values.length >= 2, ...(lattice ? { latticeId: lattice.id } : {}) }
  }
}
