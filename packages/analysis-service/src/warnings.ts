/**
 * What a finished run warns about, and which of those warnings limit the result.
 *
 * A warning used to be a sentence, and the phone called a result "limited" on
 * the count of sentences. Some sentences are information about how the run
 * worked, not about the house:
 *
 *   - no vision provider ran: every run on a phone is deterministic by design;
 *   - a guessed larger copy of a drawing does not exist: a guess (channel
 *     `VARIANT_CONVENTION`) that 404s leaves the copy it was derived from in hand;
 *   - one image published at two addresses was counted once.
 *
 * Calling a result "limited" for those taught the person to ignore the word.
 * So each warning carries a code and a severity:
 *
 *   - `INFO` — nothing about the house is missing or unchecked;
 *   - `LIMITING` — a drawing the page exposed was not read, a source-view check
 *     failed, a joint is open, or an invariant does not hold.
 *
 * The rule looks only at the kind of loss (channel, code), never at a project.
 * When the kind is unknown, the warning is LIMITING: calling a real loss
 * informational would be the worse mistake.
 */
import type { AcquisitionFailure } from '@buildapp/source-package'
import type { VisionMode } from './result.js'

export type WarningSeverity = 'INFO' | 'LIMITING'

export type AnalysisWarning = {
  code: string
  severity: WarningSeverity
  message: string
}

/** Acquisition failure codes that lose nothing: the same bytes, or the same drawing kept as its own asset. */
const NOTHING_LOST = new Set(['BYTE_IDENTICAL', 'DIFFERENT_CROP'])

/** A guessed address: derived from a copy already in hand by the publisher's naming convention. */
const GUESS_CHANNEL = 'VARIANT_CONVENTION'

export type WarningInputs = {
  visionMode: VisionMode
  failures: readonly AcquisitionFailure[]
  residuals: number
  residualsOutside: number
  exteriorJointErrors: number
  graphViolations: number
  ledgerViolations: number
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`
const words = (code: string): string => code.toLowerCase().replace(/_/g, ' ')

/** The run's warnings, in a stable order: how it ran, what it did not read, what did not check out. */
export function warningsOf(input: WarningInputs): AnalysisWarning[] {
  const out: AnalysisWarning[] = []
  if (input.visionMode === 'REPLAYED_GRAPH') out.push({ code: 'GRAPH_REPLAYED', severity: 'INFO', message: 'the observation graph was replayed from a sealed run' })
  else if (input.visionMode !== 'LIVE_PROVIDER') out.push({ code: 'DETERMINISTIC_ONLY', severity: 'INFO', message: 'no vision provider ran; every observation is from the deterministic analyzer' })

  // Grouped by what was lost, so three 404s on guesses are one line and a lost floor plan is another.
  const groups = new Map<string, { kind: 'GUESS' | 'DUPLICATE' | 'EXPOSED'; code: string; n: number }>()
  for (const f of input.failures) {
    const kind = NOTHING_LOST.has(f.code) ? 'DUPLICATE' : f.claim?.channel === GUESS_CHANNEL ? 'GUESS' : 'EXPOSED'
    const key = `${kind}|${f.code}`
    const g = groups.get(key)
    if (g) g.n += 1
    else groups.set(key, { kind, code: f.code, n: 1 })
  }
  for (const [, g] of [...groups].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (g.kind === 'DUPLICATE') {
      out.push({ code: `SOURCE_${g.code}`, severity: 'INFO', message: `${plural(g.n, 'source address', 'source addresses')} counted with another copy (${words(g.code)})` })
    } else if (g.kind === 'GUESS') {
      out.push({ code: `GUESSED_ADDRESS_${g.code}`, severity: 'INFO', message: `${plural(g.n, 'guessed larger copy', 'guessed larger copies')} not available (${words(g.code)}); the published copy was used` })
    } else {
      out.push({ code: `SOURCE_ADDRESS_${g.code}`, severity: 'LIMITING', message: `${plural(g.n, 'source address', 'source addresses')} not used (${words(g.code)})` })
    }
  }

  if (input.residualsOutside > 0) out.push({ code: 'RESIDUALS_OUTSIDE_TOLERANCE', severity: 'LIMITING', message: `${input.residualsOutside} of ${input.residuals} source-view checks outside tolerance` })
  if (input.exteriorJointErrors > 0) out.push({ code: 'EXTERIOR_JOINTS', severity: 'LIMITING', message: `${plural(input.exteriorJointErrors, 'exterior joint finding', 'exterior joint findings')} in the closure audit` })
  if (input.graphViolations + input.ledgerViolations > 0) {
    out.push({ code: 'INVARIANT_VIOLATIONS', severity: 'LIMITING', message: `${input.graphViolations} feature-graph and ${input.ledgerViolations} ledger invariant violations` })
  }
  return out
}
